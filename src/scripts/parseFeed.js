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

  // === 自动过审规则（无需人工 review） ===
  // - 大蜡烛 / 双倍 / 复刻：游戏内固定周期事件，规则简单可自动
  // - 维护：只通过「纯更新时间公告」（标题含「更新时间公告」且不含补偿/延迟/特刊/AR/活动等变种）
  // 活动 / 季节：保持人工审阅（活动变种多，季节开启/结束边界模糊）
  const MAINTENANCE_SKIP_KEYWORDS = [
    '维护补偿', '延迟开服', '推迟', '王国特刊', 'AR功能',
    '运营活动', '更新内容公告', '纪念品', '向导',
  ];
  for (const feed of parsedFeeds) {
    if (feed.status !== 'pending' || !feed.parsedResult) continue;
    const p = feed.parsedResult;
    if (p.type === 'other' || !p.start || !p.end) continue;
    let shouldApprove = false;
    if (p.type === 'candle_heap' || p.type === 'bonus' || p.type === 'traveling_spirit') {
      shouldApprove = true;
    } else if (p.type === 'maintenance') {
      const title = feed.title || '';
      // 纯维护公告：必须含「更新时间公告」+ 命中任何一个补偿/延迟/活动变种关键词就跳过
      const hasSkip = MAINTENANCE_SKIP_KEYWORDS.some(k => title.includes(k));
      const isPure = title.includes('更新时间公告') && !hasSkip;
      if (isPure) shouldApprove = true;
    }
    if (shouldApprove) {
      const existing = eventMap.get(feed.id);
      if (existing) {
        // 已有 event（历史 enabled=false）：直接翻 enabled=true + 同步最新 parsed
        existing.enabled = true;
        existing.type = p.type;
        existing.title = p.title || existing.title;
        existing.start = p.start;
        existing.end = p.end;
      } else {
        feed.status = 'approved';
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

  writeJSON('feeds.json', parsedFeeds);
  writeJSON('events.json', finalEvents);
  appendSyncLog({
    message: `解析公告 ${parsedFeeds.length} 条，过滤无时间 ${droppedCount} 条，自动过审 ${autoApprovedCount} 条，反查关闭 ${droppedFromEvents} 条，清理过期 ${droppedExpired} 条`,
    addedEvents: parsedCount,
    autoApproved: autoApprovedCount,
    droppedFromEvents,
    droppedExpired,
  });
  console.log(`parsed feeds: ${parsedFeeds.length}, dropped: ${droppedCount}, new events: ${parsedCount}, autoApproved: ${autoApprovedCount}, droppedFromEvents: ${droppedFromEvents}, droppedExpired: ${droppedExpired}`);
}

if (require.main === module) main();

module.exports = { eventFromFeed, main, parseFeed };
