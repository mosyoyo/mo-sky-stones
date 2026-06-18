const { detectType, extractDateRange, uidPart } = require('../../src/event-utils');
const { updateEventOverrides } = require('../../src/event-overrides');
const { disableFeedEvents } = require('../../src/feed-events');
const { githubPutJSONFiles, json, readAssetJSON } = require('../_shared');

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const feeds = await readAssetJSON(context, '/data/feeds.json', []);
    const events = await readAssetJSON(context, '/data/events.json', []);
    const beforeEvents = events.map(event => ({ ...event }));
    const beforeOverrides = await readAssetJSON(context, '/data/event-overrides.json', []);
    const feed = feeds.find(item => item.id === body.feedId);
    if (!feed) return json({ error: 'feed not found' }, 404);

    feed.status = body.status || 'approved';
    if (feed.status === 'approved') {
      const type = body.type || feed.autoType || detectType(feed.title, feed.content);
      const baseTime = Number(feed.createTime || 0) > 0 ? new Date(Number(feed.createTime)) : new Date();
      const range = body.start && body.end ? { start: body.start, end: body.end } : extractDateRange(feed.title, feed.content, baseTime);
      if (type !== 'other' && range) {
        const id = body.id || `${type}-${uidPart(feed.id)}`;
        const existing = events.find(event => event.id === id || event.sourceFeedId === feed.id);
        const event = existing || { id, sourceFeedId: feed.id };
        Object.assign(event, {
          enabled: body.enabled !== false,
          type,
          title: body.title || feed.title || type,
          start: range.start,
          end: range.end,
        });
        if (!existing) events.push(event);
      }
    } else if (feed.status === 'ignored') {
      disableFeedEvents(events, feed.id);
    }

    const overrides = updateEventOverrides(beforeOverrides, beforeEvents, events);
    await githubPutJSONFiles(context.env, {
      'data/feeds.json': feeds,
      'data/events.json': events,
      'data/event-overrides.json': overrides,
    }, `chore: ${feed.status} feed ${feed.id}`);
    return json({ ok: true, feed, events });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
