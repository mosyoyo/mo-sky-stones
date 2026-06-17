const {
  cleanEventTitle,
  detectType,
  extractDateRange,
  extractTravelingSpiritLabel,
  isLikelyGameActivity,
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
  const spiritLabel = type === 'traveling_spirit'
    ? extractTravelingSpiritLabel(`${feed.title || ''}\n${feed.content || ''}`)
    : '';
  const prefix = TYPE_TITLE_PREFIX[type] || '';
  const baseTitle = spiritLabel
    ? `${prefix}${spiritLabel}`
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
    enabled: false,
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

  writeJSON('feeds.json', parsedFeeds);
  writeJSON('events.json', finalEvents);
  appendSyncLog({ message: `解析公告 ${parsedFeeds.length} 条，过滤无时间 ${droppedCount} 条`, addedEvents: parsedCount });
  console.log(`parsed feeds: ${parsedFeeds.length}, dropped: ${droppedCount}, new events: ${parsedCount}`);
}

if (require.main === module) main();

module.exports = { eventFromFeed, main, parseFeed };
