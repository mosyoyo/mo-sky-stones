// 本地测试脚本：验证推算引擎和 .ics 生成器
// 红石、黑石分开生成

const { generateICS } = require('./ics-generator');
const { applyEventOverrides, publicEvent, restoreInternalFields, stableJSON, updateEventOverrides } = require('./src/event-overrides');
const { generateEventsICS, generateSpiritEventsICS } = require('./src/event-utils');
const { matchSpirit } = require('./src/spirit-match');
const { parseSelectedSpirits } = require('./src/spirit-query');
const { buildCalendar, parseReminderOptions, parseTypes } = require('./functions/_shared');
const { handleIcsRequest } = require('./functions/_ics-response');
const { disableFeedEvents, shouldKeepFeedEvent } = require('./src/feed-events');
const { initialMaxTime } = require('./src/scripts/fetchFeeds');
const { shouldAutoIgnoreParsedFeed } = require('./src/scripts/parseFeed');
const { stableJSON: stableWikiJSON, toUTCSpiritWindow } = require('./src/scripts/fetchWikiEvents');
const { stableJSON: stableSpiritJSON } = require('./src/scripts/fetchSoulSpirits');
const { verifySoulSpirits } = require('./src/scripts/verifySoulSpirits');
const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.log(`❌ ${message}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ ${message}`);
  return true;
}

// 生成红石
const redICS = generateICS('red', 30);
const redPath = path.join(__dirname, 'preview-red.ics');
fs.writeFileSync(redPath, redICS);
const redCount = (redICS.match(/BEGIN:VEVENT/g) || []).length;

// 生成黑石
const blackICS = generateICS('black', 30);
const blackPath = path.join(__dirname, 'preview-black.ics');
fs.writeFileSync(blackPath, blackICS);
const blackCount = (blackICS.match(/BEGIN:VEVENT/g) || []).length;

console.log('=== 生成成功 ===');
console.log(`红石文件: preview-red.ics (${redICS.length} 字节, ${redCount} 个事件)`);
console.log(`黑石文件: preview-black.ics (${blackICS.length} 字节, ${blackCount} 个事件)`);
console.log('');

// 打印红石预览
console.log('=== 红石事件预览（前 5 个）===');
const redEvents = redICS.split('BEGIN:VEVENT').slice(1, 6);
for (const e of redEvents) {
  const summary = e.match(/SUMMARY:(.+)/)?.[1];
  const dtstart = e.match(/DTSTART[^:]*:(.+)/)?.[1];
  console.log(`- ${summary} @ ${dtstart}`);
}
console.log('');

// 打印黑石预览
console.log('=== 黑石事件预览（前 5 个）===');
const blackEvents = blackICS.split('BEGIN:VEVENT').slice(1, 6);
for (const e of blackEvents) {
  const summary = e.match(/SUMMARY:(.+)/)?.[1];
  const dtstart = e.match(/DTSTART[^:]*:(.+)/)?.[1];
  console.log(`- ${summary} @ ${dtstart}`);
}

// 验证每日只 1 个事件
console.log('');
console.log('=== 每日事件数验证 ===');
const dayRegex = /UID:(\d{8})T/;
const allEvents = redICS.split('BEGIN:VEVENT').slice(1);
const dayCount = {};
for (const e of allEvents) {
  const m = e.match(dayRegex);
  if (m) dayCount[m[1]] = (dayCount[m[1]] || 0) + 1;
}
const days = Object.keys(dayCount);
const maxPerDay = Math.max(0, ...Object.values(dayCount));
console.log(`共 ${days.length} 个红石日，每日最多 ${maxPerDay} 场（期望 1 场）`);
if (maxPerDay === 1) {
  console.log('✅ 验证通过');
} else {
  console.log('❌ 验证失败');
  process.exitCode = 1;
}

console.log('');
console.log('=== 默认订阅参数验证 ===');
const defaultTypes = parseTypes('https://sky-ics.pages.dev/calendar.ics');
assert(defaultTypes.includes('red'), 'calendar.ics 默认包含红石');
assert(!defaultTypes.includes('black'), 'calendar.ics 默认不包含黑石');
assert(defaultTypes.includes('traveling_spirit') && defaultTypes.includes('maintenance'), 'calendar.ics 默认包含公告事件类型');

const eventReminderOptions = parseReminderOptions('https://sky-ics.pages.dev/events.ics');
assert(eventReminderOptions.endOnly.size === 0, 'events.ics 默认不套用首页 endOnly');

const defaultCalendar = buildCalendar([], defaultTypes, { reminderOpts: { endOnly: new Set(['traveling_spirit', 'season', 'activity']) } });
assert(defaultCalendar.includes('SUMMARY:【红石】'), 'calendar.ics 默认组合能生成红石事件');
assert(defaultCalendar.includes('END:VCALENDAR'), 'calendar.ics 默认组合结构完整');
assert(defaultCalendar.includes('REFRESH-INTERVAL;VALUE=DURATION:PT1H'), 'calendar.ics 默认组合包含订阅刷新间隔');
assert(defaultCalendar.includes('X-PUBLISHED-TTL:PT1H'), 'calendar.ics 默认组合包含发布 TTL');

console.log('');
console.log('=== 自定义订阅生成验证 ===');
const customUrl = 'https://sky-ics.pages.dev/calendar.ics?types=red,black,bonus,candle_heap,maintenance&endOnly=red,black,maintenance';
const customTypes = parseTypes(customUrl);
const customReminderOptions = parseReminderOptions(customUrl);
assert(customTypes.join(',') === 'red,black,bonus,candle_heap,maintenance', '自定义订阅会按 URL 保留所选类型顺序');
assert(customReminderOptions.endOnly.has('red') && customReminderOptions.endOnly.has('black') && customReminderOptions.endOnly.has('maintenance'), '自定义订阅会解析红石、黑石、维护简化提醒');
assert(!customReminderOptions.endOnly.has('bonus') && !customReminderOptions.endOnly.has('candle_heap'), '双倍和大蜡烛默认不是简化提醒');

function countSummaries(ics, prefix) {
  return (ics.match(new RegExp(`SUMMARY:${prefix}`, 'g')) || []).length;
}

const redLastUrl = 'https://sky-ics.pages.dev/calendar.ics?types=red&endOnly=red';
const redAllUrl = 'https://sky-ics.pages.dev/calendar.ics?types=red';
const redLastCustomCalendar = buildCalendar([], ['red'], { url: redLastUrl, reminderOpts: parseReminderOptions(redLastUrl) });
const redAllCustomCalendar = buildCalendar([], ['red'], { url: redAllUrl, reminderOpts: parseReminderOptions(redAllUrl) });
assert(countSummaries(redLastCustomCalendar, '【红石】') === countSummaries(defaultCalendar, '【红石】'), '红石开关打开时保持每日最后一场');
assert(countSummaries(redAllCustomCalendar, '【红石】') > countSummaries(redLastCustomCalendar, '【红石】'), '红石开关关闭时生成每日全部场次');

const blackLastUrl = 'https://sky-ics.pages.dev/calendar.ics?types=black&endOnly=black';
const blackAllUrl = 'https://sky-ics.pages.dev/calendar.ics?types=black';
const blackLastCustomCalendar = buildCalendar([], ['black'], { url: blackLastUrl, reminderOpts: parseReminderOptions(blackLastUrl) });
const blackAllCustomCalendar = buildCalendar([], ['black'], { url: blackAllUrl, reminderOpts: parseReminderOptions(blackAllUrl) });
assert(countSummaries(blackAllCustomCalendar, '【黑石】') > countSummaries(blackLastCustomCalendar, '【黑石】'), '黑石开关关闭时生成每日全部场次');

const customEvents = [
  { enabled: true, id: 'bonus-heart', type: 'bonus', title: '【双倍】双倍爱心', start: '2026-06-19T04:00:00.000Z', end: '2026-06-26T04:00:00.000Z' },
  { enabled: true, id: 'candle-heap', type: 'candle_heap', title: '【大蜡烛】大蜡烛堆', start: '2026-06-20T04:00:00.000Z', end: '2026-06-21T04:00:00.000Z' },
  { enabled: true, id: 'maintenance-0624', type: 'maintenance', title: '【维护】6月24日 维护', start: '2026-06-23T17:00:00.000Z', end: '2026-06-24T02:00:00.000Z' },
  { enabled: true, id: 'activity-test', type: 'activity', title: '【活动】测试活动', start: '2026-06-20T04:00:00.000Z', end: '2026-06-26T04:00:00.000Z' },
];
const bonusAndCandleCalendar = buildCalendar(customEvents, ['bonus', 'candle_heap'], { reminderOpts: { endOnly: new Set() } });
assert(bonusAndCandleCalendar.includes('SUMMARY:【双倍】双倍爱心') && bonusAndCandleCalendar.includes('SUMMARY:【大蜡烛】大蜡烛堆'), '双倍和大蜡烛同时选择时会同时生成');
assert(!bonusAndCandleCalendar.includes('SUMMARY:【活动】测试活动') && !bonusAndCandleCalendar.includes('SUMMARY:【维护】6月24日 维护'), '自定义订阅不会生成未选择的公告类型');

const maintenanceDefaultCalendar = buildCalendar(customEvents, ['maintenance'], { reminderOpts: { endOnly: new Set() } });
assert(maintenanceDefaultCalendar.includes('SUMMARY:【维护开始】6月24日维护'), '维护默认生成开始提醒');
assert(maintenanceDefaultCalendar.includes('SUMMARY:【维护结束】6月24日维护'), '维护默认生成结束提醒');

const maintenanceEndOnlyCalendar = buildCalendar(customEvents, ['maintenance'], { reminderOpts: { endOnly: new Set(['maintenance']) } });
assert(!maintenanceEndOnlyCalendar.includes('SUMMARY:【维护开始】6月24日维护'), '维护简化提醒不会生成开始提醒');
assert(maintenanceEndOnlyCalendar.includes('SUMMARY:【维护结束】6月24日维护'), '维护简化提醒只保留结束提醒');

console.log('');
console.log('=== 公告隐藏一致性验证 ===');
const ignoredEvents = [
  { id: 'a', sourceFeedId: 'feed-1', enabled: true },
  { id: 'b', sourceFeedId: 'feed-2', enabled: true },
];
disableFeedEvents(ignoredEvents, 'feed-1');
assert(ignoredEvents[0].enabled === false, '忽略公告会关闭对应日历事件');
assert(ignoredEvents[1].enabled === true, '忽略公告不会影响其他事件');
assert(shouldKeepFeedEvent({ status: 'approved' }, { type: 'bonus', start: '2026-01-01', end: '2026-01-02' }), '同步只保留已批准公告事件');
assert(!shouldKeepFeedEvent({ status: 'ignored' }, { type: 'bonus', start: '2026-01-01', end: '2026-01-02' }), '同步不会让已忽略公告复活');
assert(!shouldKeepFeedEvent({ status: 'pending' }, { type: 'bonus', start: '2026-01-01', end: '2026-01-02' }), '同步不会让待审核公告提前进日历');
assert(shouldAutoIgnoreParsedFeed({ status: 'pending', parsedResult: { type: 'other' } }), '解析为其他的待审核公告会自动忽略');
assert(!shouldAutoIgnoreParsedFeed({ status: 'approved', parsedResult: { type: 'other' } }), '已批准公告不会被其他类型规则自动忽略');
assert(!shouldAutoIgnoreParsedFeed({ status: 'pending', parsedResult: { type: 'bonus' } }), '可进入日历的公告不会被其他类型规则自动忽略');

console.log('');
console.log('=== 公告抓取游标验证 ===');
const oldFeeds = [{ createTime: 1000 }, { createTime: 3000 }];
assert(initialMaxTime(oldFeeds, true) === 999, '补历史模式从最旧公告之前继续抓');
assert(initialMaxTime(oldFeeds, false) > Date.now(), '默认同步从最新公告开始抓');
assert(stableWikiJSON({ b: 2, a: 1 }) === stableWikiJSON({ a: 1, b: 2 }), 'Wiki 活动同步 no-op 判断不受字段顺序影响');
const hopeSeedWindow = toUTCSpiritWindow('2026-06-18');
assert(hopeSeedWindow.start === '2026-06-17T22:00:00.000Z', 'Wiki 复刻开始时间为周四 06:00 北京');
assert(hopeSeedWindow.end === '2026-06-22T04:00:00.000Z', 'Wiki 复刻结束时间为周一 12:00 北京');
const pianistWindow = toUTCSpiritWindow('2026-06-11');
assert(pianistWindow.start === '2026-06-10T22:00:00.000Z', '上一期复刻开始时间同样按北京时间 06:00');
assert(pianistWindow.end === '2026-06-15T04:00:00.000Z', '上一期复刻结束时间同样按北京时间 12:00');

console.log('');
console.log('=== 事件人工覆盖验证 ===');
const generatedEvents = [
  { id: 'event-a', enabled: true, title: '旧标题', type: 'activity', start: '2026-06-01T00:00:00.000Z', end: '2026-06-03T00:00:00.000Z' },
  { id: 'event-b', enabled: true, title: '会被删除', type: 'bonus', start: '2026-06-04T00:00:00.000Z', end: '2026-06-06T00:00:00.000Z' },
];
const savedEvents = [
  { ...generatedEvents[0], title: '人工标题' },
  { id: 'manual-c', enabled: true, title: '手动新增', type: 'maintenance', start: '2026-06-07T00:00:00.000Z', end: '2026-06-07T02:00:00.000Z' },
];
const overrides = updateEventOverrides([], generatedEvents, savedEvents);
const mergedEvents = applyEventOverrides(generatedEvents, overrides);
assert(mergedEvents.some(event => event.id === 'event-a' && event.title === '人工标题'), '事件页修改会在同步后保留');
assert(!mergedEvents.some(event => event.id === 'event-b'), '事件页删除会在同步后保留');
assert(mergedEvents.some(event => event.id === 'manual-c' && event._source === 'manual'), '事件页手动新增会在同步后保留');
const unchangedOverrides = updateEventOverrides([], generatedEvents, generatedEvents);
assert(unchangedOverrides.length === 0, '事件页未改动保存不会冻结所有自动事件');
const keptOverrides = updateEventOverrides(overrides, savedEvents, savedEvents);
assert(keptOverrides.length === overrides.length, '已有人工覆盖在再次保存时会保留');
assert(stableJSON({ b: 2, a: 1 }) === stableJSON({ a: 1, b: 2 }), '后台保存 no-op 判断不受对象字段顺序影响');
const internalEvent = { id: 'event-internal', enabled: true, title: '带内部字段', source: 'wiki', wikiUrl: 'https://example.com', _source: 'wiki', _names: ['先祖名'] };
const publicInternalEvent = publicEvent(internalEvent);
assert(!('_source' in publicInternalEvent) && !('_names' in publicInternalEvent), '后台公开事件会移除下划线内部字段');
assert(!('source' in publicInternalEvent) && !('wikiUrl' in publicInternalEvent), '后台公开事件会移除数据源字段');
const restoredInternalEvents = restoreInternalFields([internalEvent], [{ id: 'event-internal', enabled: false, title: '人工关闭' }]);
assert(restoredInternalEvents[0]._names?.[0] === '先祖名' && restoredInternalEvents[0]._source === 'wiki', '后台保存会保留先祖匹配所需内部字段');
assert(restoredInternalEvents[0].enabled === false && restoredInternalEvents[0].title === '人工关闭', '后台保存会覆盖用户可编辑字段');

console.log('');
console.log('=== ICS DESCRIPTION 格式验证 ===');
const activityICS = generateEventsICS([
  { enabled: true, type: 'activity', title: '测试活动', start: '2026-06-20T00:00:00.000Z', end: '2026-06-24T00:00:00.000Z' },
]);
assert(activityICS.includes('REFRESH-INTERVAL;VALUE=DURATION:PT1H'), '活动 ICS 包含订阅刷新间隔');
assert(activityICS.includes('X-PUBLISHED-TTL:PT1H'), '活动 ICS 包含发布 TTL');
const descriptionLines = activityICS.split('\r\n').filter(line => line.startsWith('DESCRIPTION:'));
assert(descriptionLines.length > 0, '活动 ICS 会生成 DESCRIPTION');
assert(descriptionLines.some(line => line.includes('\r\\n ')), '活动 DESCRIPTION 保持与红石一致的 CR + 字面换行拼法');
assert(activityICS.includes('DESCRIPTION:类型: 活动\r\\n 标题: 测试活动\r\\n 时间:'), '活动 DESCRIPTION 使用红石同款折叠字面换行拼法');
const redDescriptionLines = redICS.split('\r\n').filter(line => line.startsWith('DESCRIPTION:'));
assert(redDescriptionLines.length > 0, '红石 ICS 会生成 DESCRIPTION');
assert(redDescriptionLines.some(line => line.includes('\\n ') && line.includes('地图: ') && line.includes('区域: ') && line.includes('时间: ')), '红石 DESCRIPTION 保持上午可用版本的折叠字面换行拼法');
assert(redICS.includes('TRIGGER;RELATED=START:-PT10M'), '红石提醒为开始前 10 分钟');
assert(redICS.includes('含 10 分钟提醒') && !redICS.includes('含 15 分钟提醒'), '红石日历描述与 10 分钟提醒一致');
handleIcsRequest(
  { request: new Request('https://sky-ics.pages.dev/calendar.ics', { method: 'HEAD' }) },
  async () => new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR', { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } }),
).then(async response => {
  assert(response.status === 200, 'ICS 路由支持 HEAD 预检');
  assert((await response.text()) === '', 'ICS HEAD 响应不返回 body');
});
const summaryICS = generateEventsICS([
  { enabled: true, type: 'season', title: '【季节】狂欢季', start: '2026-04-23T04:00:00.000Z', end: '2026-07-08T04:00:00.000Z' },
  { enabled: true, type: 'activity', title: '【活动】端午节', start: '2026-06-19T04:00:00.000Z', end: '2026-07-02T04:00:00.000Z' },
  { enabled: true, type: 'traveling_spirit', title: '【复刻】希望之种', start: '2026-06-17T22:00:00.000Z', end: '2026-06-22T04:00:00.000Z' },
]);
assert(summaryICS.includes('SUMMARY:【季节结束】狂欢季 明天就要结束了'), '季节结束提醒 SUMMARY 与连续事件区分');
assert(summaryICS.includes('SUMMARY:【活动结束】端午节'), '活动结束提醒 SUMMARY 与连续事件区分');
assert(summaryICS.includes('SUMMARY:【先祖离开】希望之种'), '先祖离开提醒 SUMMARY 与连续事件区分');
const chineseUidICS = generateEventsICS([
  { enabled: true, type: 'traveling_spirit', title: '【复刻】希望之种', id: 'wiki-traveling_spirit-希望之种-0618', start: '2026-06-17T22:00:00.000Z', end: '2026-06-22T04:00:00.000Z' },
  { enabled: true, type: 'traveling_spirit', title: '【复刻】致敬钢琴家', id: 'wiki-traveling_spirit-致敬钢琴家-0618', start: '2026-06-17T22:00:00.000Z', end: '2026-06-22T04:00:00.000Z' },
]);
const uidLines = chineseUidICS.split('\r\n').filter(line => line.startsWith('UID:') && line.includes('-range@'));
assert(uidLines.length === 2 && new Set(uidLines).size === 2, '中文事件 UID 会保留稳定区分信息');
assert(uidLines.every(line => !line.includes('---0618')), '中文事件 UID 不会退化成空标题');

console.log('');
console.log('=== 指定先祖匹配验证 ===');
assert(matchSpirit({ type: 'traveling_spirit', title: '旅行先祖', _names: ['排箫先祖'] }, ['排箫先祖']), '指定先祖订阅会匹配 _names');
assert(matchSpirit({ type: 'traveling_spirit', title: '【复刻】希望之种' }, ['希望之种']), '指定先祖订阅会匹配复刻标题');
assert(!matchSpirit({ type: 'traveling_spirit', title: '【复刻】希望之种' }, ['希望']), '指定先祖订阅不会用短词误匹配标题');
assert(!matchSpirit({ type: 'activity', title: '排箫先祖', _names: ['排箫先祖'] }, ['排箫先祖']), '指定先祖订阅只匹配复刻事件');
const selectedFromUrl = parseSelectedSpirits('https://sky-ics.pages.dev/spirit-events.ics?spirits=希望之种,%E8%87%B4%E6%95%AC%E9%92%A2%E7%90%B4%E5%AE%B6,希望之种,多余先祖', { selected: ['旧配置'] });
assert(selectedFromUrl.length === 3 && selectedFromUrl[0] === '希望之种' && selectedFromUrl[1] === '致敬钢琴家', '指定先祖订阅优先使用 URL 参数并限制最多 3 个');
const selectedWithPercent = parseSelectedSpirits('https://sky-ics.pages.dev/spirit-events.ics?spirits=50%25先祖', { selected: [] });
assert(selectedWithPercent[0] === '50%先祖', '指定先祖订阅参数不会重复 decode');
const selectedFallback = parseSelectedSpirits('https://sky-ics.pages.dev/spirit-events.ics', { selected: ['希望之种'] });
assert(selectedFallback.length === 1 && selectedFallback[0] === '希望之种', '指定先祖订阅无 URL 参数时兼容后台保存配置');
const soulSpirits = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'soul-spirits.json'), 'utf8'));
const soulInfo = new Map(soulSpirits.spirits.map(item => [item.spiritName, item]));
const spiritSubscriptionICS = generateSpiritEventsICS([
  { enabled: true, type: 'traveling_spirit', title: '【复刻】希望之种', id: 'wiki-traveling_spirit-希望之种-0618', start: hopeSeedWindow.start, end: hopeSeedWindow.end },
], { selected: ['希望之种'], spiritInfo: soulInfo });
assert(spiritSubscriptionICS.includes('DTSTART:20260617T220000Z') && spiritSubscriptionICS.includes('DTEND:20260622T040000Z'), '指定先祖 ICS 复用 06:00/12:00 精确复刻时间');
assert(spiritSubscriptionICS.includes('SUMMARY:【复刻】希望之种返场'), '指定先祖 ICS 标题面向蹲先祖场景');
assert(spiritSubscriptionICS.includes('DESCRIPTION:希望之种返场\r\\n 开始: 6/18 06:00\r\\n 离开: 6/22 12:00'), '指定先祖 ICS 备注简短且使用红石同款字节拼法');
assert(spiritSubscriptionICS.includes('物品: 面具、发型、斗篷、乐谱'), '指定先祖 ICS 备注带可搜索/可编辑物品');
assert(verifySoulSpirits(soulSpirits).length === 0, '完整先祖列表通过结构校验');
assert(soulSpirits.spirits.length >= 50, '完整先祖列表包含 50 个以上先祖');
assert(stableSpiritJSON({ b: 2, a: 1 }) === stableSpiritJSON({ a: 1, b: 2 }), '完整先祖同步 no-op 判断不受字段顺序影响');
