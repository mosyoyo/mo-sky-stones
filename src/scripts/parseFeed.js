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
  const events = readJSON('events.json', []);
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

  // === 自动过审规则（唔需要人工 review） ===
  // 1. 大蜡烛 / 双倍 / 复刻 / 维护 → 直接过
  // 2. 活动 → duration ≥ 3 天 + 非线下 → 直接过
  //    季节 → 唔自动过（季节有「结束」「开启」两类，自动过风险大）
  // 命中规则 → status=approved，自动入 events.json
  const AUTO_APPROVE_TYPES = new Set(['candle_heap', 'bonus', 'traveling_spirit', 'maintenance']);
  for (const feed of parsedFeeds) {
    if (feed.status !== 'pending' || !feed.parsedResult) continue;
    const p = feed.parsedResult;
    if (p.type === 'other' || !p.start || !p.end) continue;
    const event = { start: p.start, end: p.end };
    let shouldApprove = false;
    if (AUTO_APPROVE_TYPES.has(p.type)) {
      shouldApprove = true;
    } else if (p.type === 'activity' && isLikelyGameActivity(event) && !isOfflineEvent(feed.title || '', feed.content || '')) {
      shouldApprove = true;
    }
    if (shouldApprove && !eventMap.has(feed.id)) {
      feed.status = 'approved';
      eventMap.set(feed.id, eventFromFeed(feed, p));
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

  writeJSON('feeds.json', parsedFeeds);
  writeJSON('events.json', finalEvents);
  appendSyncLog({
    message: `解析公告 ${parsedFeeds.length} 条，过滤无时间 ${droppedCount} 条，自动过审 ${autoApprovedCount} 条，反查关闭 ${droppedFromEvents} 条`,
    addedEvents: parsedCount,
    autoApproved: autoApprovedCount,
    droppedFromEvents,
  });
  console.log(`parsed feeds: ${parsedFeeds.length}, dropped: ${droppedCount}, new events: ${parsedCount}, autoApproved: ${autoApprovedCount}, droppedFromEvents: ${droppedFromEvents}`);
}

if (require.main === module) main();

module.exports = { eventFromFeed, main, parseFeed };
