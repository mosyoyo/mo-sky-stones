const { cleanEventTitle, detectType, extractDateRange, uidPart } = require('../../src/event-utils');
const { stableJSON, updateEventOverrides } = require('../../src/event-overrides');
const { disableFeedEvents } = require('../../src/feed-events');
const { githubPutJSONFiles, json, readAssetJSON } = require('../_shared');

function upsertEvent(events, feed, item) {
  const type = item.type || feed.autoType || detectType(feed.title, feed.content);
  const baseTime = Number(feed.createTime || 0) > 0 ? new Date(Number(feed.createTime)) : new Date();
  const range = item.start && item.end ? { start: item.start, end: item.end } : extractDateRange(feed.title, feed.content, baseTime);
  if (type === 'other' || !range) return;

  const id = item.id || `${type}-${uidPart(feed.id)}`;
  const existing = events.find(event => event.id === id || event.sourceFeedId === feed.id);
  const event = existing || { id, sourceFeedId: feed.id };
  Object.assign(event, {
    enabled: item.enabled !== false,
    type,
    title: item.title || cleanEventTitle(feed.title, feed.content, type) || feed.title || type,
    start: range.start,
    end: range.end,
  });
  if (!existing) events.push(event);
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return json({ error: 'items must be a non-empty array' }, 400);

    const feeds = await readAssetJSON(context, '/data/feeds.json', []);
    const events = await readAssetJSON(context, '/data/events.json', []);
    const beforeFeeds = feeds.map(feed => ({ ...feed }));
    const beforeEvents = events.map(event => ({ ...event }));
    const beforeOverrides = await readAssetJSON(context, '/data/event-overrides.json', []);
    const feedMap = new Map(feeds.map(feed => [feed.id, feed]));
    const missing = [];
    let approved = 0;
    let ignored = 0;

    for (const item of items) {
      const feed = feedMap.get(item.feedId);
      if (!feed) {
        missing.push(item.feedId);
        continue;
      }
      feed.status = item.status || 'approved';
      if (feed.status === 'approved') {
        approved++;
        upsertEvent(events, feed, item);
      } else if (feed.status === 'ignored') {
        ignored++;
        disableFeedEvents(events, feed.id);
      }
    }

    const overrides = updateEventOverrides(beforeOverrides, beforeEvents, events);
    if (
      stableJSON(beforeFeeds) === stableJSON(feeds)
      && stableJSON(beforeEvents) === stableJSON(events)
      && stableJSON(beforeOverrides) === stableJSON(overrides)
    ) {
      return json({ ok: true, approved, ignored, missing, unchanged: true });
    }
    await githubPutJSONFiles(context.env, {
      'data/feeds.json': feeds,
      'data/events.json': events,
      'data/event-overrides.json': overrides,
    }, `chore: batch review ${items.length} feeds`);
    return json({ ok: true, approved, ignored, missing });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
