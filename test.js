// 本地测试脚本：验证推算引擎和 .ics 生成器
// 红石、黑石分开生成

const { generateICS } = require('./ics-generator');
const { applyEventOverrides, updateEventOverrides } = require('./src/event-overrides');
const { generateEventsICS } = require('./src/event-utils');
const { matchSpirit } = require('./src/spirit-match');
const { buildCalendar, parseReminderOptions, parseTypes } = require('./functions/_shared');
const { disableFeedEvents, shouldKeepFeedEvent } = require('./src/feed-events');
const { initialMaxTime } = require('./src/scripts/fetchFeeds');
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

console.log('');
console.log('=== 公告抓取游标验证 ===');
const oldFeeds = [{ createTime: 1000 }, { createTime: 3000 }];
assert(initialMaxTime(oldFeeds, true) === 999, '补历史模式从最旧公告之前继续抓');
assert(initialMaxTime(oldFeeds, false) > Date.now(), '默认同步从最新公告开始抓');

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

console.log('');
console.log('=== ICS DESCRIPTION 格式验证 ===');
const activityICS = generateEventsICS([
  { enabled: true, type: 'activity', title: '测试活动', start: '2026-06-20T00:00:00.000Z', end: '2026-06-24T00:00:00.000Z' },
]);
const descriptionLines = activityICS.split('\r\n').filter(line => line.startsWith('DESCRIPTION:'));
assert(descriptionLines.length > 0, '活动 ICS 会生成 DESCRIPTION');
assert(descriptionLines.every(line => !/[\r\n]/.test(line)), 'DESCRIPTION 字段行内不含真实 CR/LF');
const redDescriptionLines = redICS.split('\r\n').filter(line => line.startsWith('DESCRIPTION:'));
assert(redDescriptionLines.length > 0, '红石 ICS 会生成 DESCRIPTION');
assert(redDescriptionLines.every(line => !/[\r\n]/.test(line)), '红石 DESCRIPTION 字段行内不含真实 CR/LF');
assert(redICS.includes('TRIGGER;RELATED=START:-PT10M'), '红石提醒为开始前 10 分钟');
assert(redICS.includes('含 10 分钟提醒') && !redICS.includes('含 15 分钟提醒'), '红石日历描述与 10 分钟提醒一致');

console.log('');
console.log('=== 指定先祖匹配验证 ===');
assert(matchSpirit({ type: 'traveling_spirit', title: '旅行先祖', _names: ['排箫先祖'] }, ['排箫先祖']), '指定先祖订阅会匹配 _names');
assert(!matchSpirit({ type: 'activity', title: '排箫先祖', _names: ['排箫先祖'] }, ['排箫先祖']), '指定先祖订阅只匹配复刻事件');
