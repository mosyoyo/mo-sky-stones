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
  return {
    type,
    title: spiritLabel ? `旅行先祖·${spiritLabel}` : cleanEventTitle(feed.title, feed.content, type),
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

  writeJSON('feeds.json', parsedFeeds);
  writeJSON('events.json', [...eventMap.values()]);
  appendSyncLog({ message: `解析公告 ${parsedFeeds.length} 条，过滤无时间 ${droppedCount} 条`, addedEvents: parsedCount });
  console.log(`parsed feeds: ${parsedFeeds.length}, dropped: ${droppedCount}, new events: ${parsedCount}`);
}

if (require.main === module) main();

module.exports = { eventFromFeed, main, parseFeed };
