const {
  cleanEventTitle,
  detectType,
  extractBonusLabel,
  extractDateRange,
  extractTravelingSpiritLabel,
  isLikelyGameActivity,
  isOfflineEvent,
  isTravelingSpiritUpcoming,
  normalizeFeed,
  uidPart,
} = require('../event-utils');
const { appendSyncLog, readJSON, writeJSON } = require('./common');

const TYPE_TITLE_PREFIX = {
  traveling_spirit: '【复刻】',
  season: '【季节】',
  activity: '【活动】',
  bonus: '【双倍】',
  candle_heap: '【大蜡烛】',
  maintenance: '【维护】',
};

// 网易大神数据源只保留的 3 类（其余 3 类改从 wiki 抓取）
// 用户的核心决策：除了维护和大蜡烛双倍，其余全部抓 wiki
// 注：实际拆分不在这里做，parseFeed.js 保留全部类型，mergeEvents.js 按 config 决定
const NETEASE_ALLOWED_TYPES = new Set(['maintenance', 'candle_heap', 'bonus']);
const WIKI_TAKEN_TYPES = new Set(['traveling_spirit', 'season', 'activity']);

function parseFeed(feed) {
  let type = detectType(feed.title, feed.content);
  const baseTime = Number(feed.createTime || 0) > 0 ? new Date(Number(feed.createTime)) : new Date();
  const range = extractDateRange(feed.title, feed.content, baseTime);
  if (type === 'activity' && range && !isLikelyGameActivity(range)) {
    type = 'other';
  }

  // 过滤规则：
  // 1. 复刻先祖：只保留「即将到临/即将来临」类预告，过滤「到临提醒/已到来/已离开」
  // 2. 长周期事件（活动/复刻/季节/双倍/大蜡烛）：duration < 1 天全部 drop
  // 3. 线下活动（见面会/签售/漫展/票务/现场/舞台/演出…）一律 drop
  //    维护通常 < 1 天，保留
  const LONG_EVENT_TYPES = new Set(['traveling_spirit', 'activity', 'season', 'bonus', 'candle_heap']);
  if (isOfflineEvent(feed.title || '', feed.content || '')) {
    type = 'other';
  } else if (type === 'traveling_spirit' && !isTravelingSpiritUpcoming(feed.title || '', feed.content || '')) {
    type = 'other';
  } else if (LONG_EVENT_TYPES.has(type) && range && range.start && range.end) {
    const durationMs = new Date(range.end) - new Date(range.start);
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (durationMs < oneDayMs) {
      type = 'other';
    }
  }

  const spiritLabel = type === 'traveling_spirit'
    ? extractTravelingSpiritLabel(`${feed.title || ''}\n${feed.content || ''}`)
    : '';
  const bonusLabel = type === 'bonus'
    ? extractBonusLabel(`${feed.title || ''}\n${feed.content || ''}`)
    : '';
  const prefix = TYPE_TITLE_PREFIX[type] || '';
  const baseTitle = spiritLabel
    ? `${prefix}${spiritLabel}`
    : bonusLabel
      ? `${prefix}${bonusLabel}`
      : (cleanEventTitle(feed.title, feed.content, type) && prefix
          ? `${prefix}${cleanEventTitle(feed.title, feed.content, type).replace(/^[《【].+?[》】]\s*/, '')}`
          : cleanEventTitle(feed.title, feed.content, type));
  return {
    type,
    title: baseTitle,
    start: range ? range.start : '',
    end: range ? range.end : '',
  };
}

function eventFromFeed(feed, parsed) {
  return {
    id: `${parsed.type}-${uidPart(feed.id)}`,
    enabled: feed.status === 'approved',
    type: parsed.type,
    title: parsed.title || feed.title || parsed.type,
    start: parsed.start,
    end: parsed.end,
    sourceFeedId: feed.id,
  };
}

function main() {
  const feeds = readJSON('feeds.json', []);
  // 读 events-netease.json（网易大神事件现状）作为基线。
  // 旧版读 events.json 会把 wiki 事件当 netease 现状污染了 id 命名空间。
  // 兼容：events-netease.json 不存在时回退到 events.json
  let events = readJSON('events-netease.json', null);
  if (events === null) events = readJSON('events.json', []);
  const eventMap = new Map(events.map(event => [event.sourceFeedId || event.id, event]));
  const parsedFeeds = [];
  let parsedCount = 0;
  let droppedCount = 0;
  let autoApprovedCount = 0;

  for (const feed of feeds) {
    if (feed.raw) {
      const normalized = normalizeFeed(feed.raw);
      feed.title = normalized.title;
      feed.content = normalized.content;
    }
    const parsed = parseFeed(feed);
    if (!parsed.start || !parsed.end) {
      eventMap.delete(feed.id);
      droppedCount++;
      continue;
    }
    feed.autoType = parsed.type;
    feed.parsed = Boolean(parsed.start && parsed.end);
    feed.parsedResult = parsed;
    parsedFeeds.push(feed);

    const existing = eventMap.get(feed.id);
    if (existing && parsed.type !== 'other' && parsed.start && parsed.end) {
      Object.assign(existing, {
        type: parsed.type,
        title: parsed.title || existing.title,
        start: parsed.start,
        end: parsed.end,
      });
    }

    if (feed.status === 'approved' && parsed.type !== 'other' && parsed.start && parsed.end) {
      if (!existing) {
        eventMap.set(feed.id, eventFromFeed(feed, parsed));
        parsedCount++;
      }
    }
  }

  // === 自动过审规则 ===
  // 通过：feed.status 改 approved + events.json 写入
  //   - 大蜡烛 / 双倍 / 复刻：游戏内固定周期事件
  //   - 维护：仅「纯 更新时间公告」+ 排除所有变种（补偿/延迟/特刊/AR/活动/投票/联动/纪念品/向导 等）
  // 不通过（保持 pending）：活动 / 季节 / 维护变种
  // 关键词检测：先查标题（必查），再查 content 整词匹配（避免「更新内容」「更新结束」误中）
  const MAINTENANCE_SKIP_KEYWORDS = [
    '维护补偿', '延迟开服', '推迟', '王国特刊', 'AR功能',
    '运营活动', '更新内容公告', '纪念品', '向导', '开服',
    // 用户新增
    '投票', '联动', '舞台', '签售', '见面会', '漫展', '票务',
    '创作激励', '成果展示', '纪录片', '发布会回顾',
  ];
  for (const feed of parsedFeeds) {
    if (feed.status !== 'pending' || !feed.parsedResult) continue;
    const p = feed.parsedResult;
    if (p.type === 'other' || !p.start || !p.end) continue;
    const title = feed.title || '';
    const content = feed.content || '';
    let shouldApprove = false;
    if (p.type === 'candle_heap' || p.type === 'bonus' || p.type === 'traveling_spirit') {
      // 复刻「已到临提醒/已离开」剔除（只保留「即将到临/即将来临」）
      if (p.type === 'traveling_spirit' && !isTravelingSpiritUpcoming(title, content)) continue;
      shouldApprove = true;
    } else if (p.type === 'maintenance') {
      // skip 关键词：标题必查 + content 整词匹配
      const hasSkip = MAINTENANCE_SKIP_KEYWORDS.some(k => {
        if (title.includes(k)) return true;
        // content 用「完整词组」匹配（k 长度 ≥ 4 才查 content）
        return k.length >= 4 && content.includes(k);
      });
      const isPure = title.includes('更新时间公告') && !hasSkip;
      if (isPure) shouldApprove = true;
    }
    if (shouldApprove) {
      // ✅ 关键修复：一定要改 feed.status，公告页（admin/feed）才不会再显示
      feed.status = 'approved';
      const existing = eventMap.get(feed.id);
      if (existing) {
        existing.enabled = true;
        existing.type = p.type;
        existing.title = p.title || existing.title;
        existing.start = p.start;
        existing.end = p.end;
      } else {
        eventMap.set(feed.id, eventFromFeed(feed, p));
      }
      autoApprovedCount++;
    }
  }

  // 复刻先祖按时间窗口去重：同一时间窗口内只保留最早那条
  const allEvents = [...eventMap.values()];
  const spiritEvents = allEvents.filter(e => e.type === 'traveling_spirit' && e.start);
  const spiritByBucket = new Map();
  for (const ev of spiritEvents) {
    const bucket = Math.floor(new Date(ev.start).getTime() / (10 * 24 * 60 * 60 * 1000));
    if (!spiritByBucket.has(bucket)) spiritByBucket.set(bucket, []);
    spiritByBucket.get(bucket).push(ev);
  }
  const keptIds = new Set();
  for (const [, group] of spiritByBucket) {
    if (group.length === 1) {
      keptIds.add(group[0].id);
    } else {
      group.sort((a, b) => new Date(a.start) - new Date(b.start));
      keptIds.add(group[0].id);
    }
  }
  const finalEvents = allEvents.filter(e => e.type !== 'traveling_spirit' || keptIds.has(e.id));

  // === 双数据源拆分准备：events-netease.json 保留全部类型作为兜底 ===
  // 用户的核心决策：维护/大蜡烛/双倍 → 网易大神（锁定，仅此源）；旅行先祖/季节/活动 → wiki（netease 兜底）
  // events-netease.json 保留全部类型，但由 mergeEvents.js 按 source-config.json
  // 决定哪些走网易大神、哪些走 wiki。锁定类型不参与兜底。
  // 这样 wiki 抓不到时（沙箱被反爬墙挡/未来 wiki API 变更）可切换类型的网易大神兜底不会丢事件。
  const neteaseEvents = finalEvents;

  // 清理已过期 enabled 事件（end < 现在）—— ICS 唔再显示，iOS 也不会堆积历史
  const now = Date.now();
  let droppedExpired = 0;
  for (const e of finalEvents) {
    if (e.enabled && e.end && new Date(e.end).getTime() < now) {
      e.enabled = false;
      droppedExpired++;
    }
  }

  // === 反向校验：events.json 里 enabled=true 但对应 feed 已被判 other → 关掉 ===
  // 原因：历史上可能手动 enabled 过，但现在解析规则发现呢条系线下/单日/已结束
  let droppedFromEvents = 0;
  for (const feed of parsedFeeds) {
    const ev = eventMap.get(feed.id);
    if (!ev || !ev.enabled) continue;
    const p = feed.parsedResult;
    if (!p) continue;
    if (p.type === 'other' || !p.start || !p.end) {
      ev.enabled = false;
      droppedFromEvents++;
    }
  }

  // === 全局「不感兴趣」关键词 → 直接 status=ignored，从公告页消失 ===
  // 适用范围：所有 feed（不限于哪种 autoType）
  // 用户明确说「直接过滤掉」的类型：投票、运营活动、联动、舞台演出、签售、漫展、票务
  //                  + 成果展示、纪录片、发布会回顾、创作激励 等线下内容
  //                  + 季节/活动类「更新内容公告」（伴生维护公告，但主体是活动）
  //                  + 维护变种公告：补偿、延迟、AR、纪念品、向导
  //                  + 复刻已到临提醒（6月11日 旅行先祖到临提醒之类）
  //                  + detectType 错判为 maintenance 的季节内容：迁徙季/七夕/彩染季
  // 注：季节公告（季节开启提醒、季节倒计时）保留 pending 让人工看
  const GLOBAL_IGNORE_KEYWORDS = [
    '投票', '运营活动', '运营活动公告', '联动', '舞台', '签售', '见面会', '漫展', '票务',
    '成果展示', '纪录片', '发布会回顾', '创作激励', '王国特刊',
    '更新内容公告',  // 季节/活动类伴生维护公告（不是纯 更新时间公告）
    '维护补偿', '延迟开服', 'AR功能', '纪念品', '向导',  // 维护变种
    '到临提醒', '到临啦', '重返天空王国',  // 复刻已到临
    // detectType 错判为 maintenance 的季节公告
    '迁徙季旅途', '七夕', '彩染季', '云巢染色工坊', '奇妙之旅', '迁徙季',
    '维护后正式开启', '维护后开启', '更新维护后',
  ];
  let ignoredByKeyword = 0;
  for (const feed of parsedFeeds) {
    if (feed.status !== 'pending') continue;
    const t = feed.title || '';
    if (GLOBAL_IGNORE_KEYWORDS.some(k => t.includes(k))) {
      feed.status = 'ignored';
      ignoredByKeyword++;
    }
  }

  writeJSON('feeds.json', parsedFeeds);
  // events-netease.json：网易大神原始事件（保留全部类型作为兜底）
  // 供 mergeEvents.js 与 events-wiki.json 合并时去重使用
  writeJSON('events-netease.json', neteaseEvents);
  // events.json 不再这里写——syncEvents.js 跑完 parseFeed 后会跑 mergeEvents，
  // mergeEvents 才是 events.json 的最终写者（按 source-config.json 合并 netease + wiki）
  appendSyncLog({
    message: `解析公告 ${parsedFeeds.length} 条，过滤无时间 ${droppedCount} 条，自动过审 ${autoApprovedCount} 条，反查关闭 ${droppedFromEvents} 条，清理过期 ${droppedExpired} 条，关键词忽略 ${ignoredByKeyword} 条（events-netease.json 全量 ${neteaseEvents.length} 条，待 merge）`,
    addedEvents: parsedCount,
    autoApproved: autoApprovedCount,
    droppedFromEvents,
    droppedExpired,
    ignoredByKeyword,
  });
  console.log(`parsed feeds: ${parsedFeeds.length}, dropped: ${droppedCount}, new events: ${parsedCount}, autoApproved: ${autoApprovedCount}, droppedFromEvents: ${droppedFromEvents}, droppedExpired: ${droppedExpired}, ignoredByKeyword: ${ignoredByKeyword}`);
}

if (require.main === module) main();

module.exports = { eventFromFeed, main, parseFeed };
