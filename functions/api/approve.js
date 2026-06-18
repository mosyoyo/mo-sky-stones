const { detectType, extractDateRange, uidPart } = require('../../src/event-utils');
const { disableFeedEvents } = require('../../src/feed-events');
const { githubPutJSON, json, readAssetJSON } = require('../_shared');

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const feeds = await readAssetJSON(context, '/data/feeds.json', []);
    const events = await readAssetJSON(context, '/data/events.json', []);
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

    await githubPutJSON(context.env, 'data/feeds.json', feeds, `chore: ${feed.status} feed ${feed.id}`);
    await githubPutJSON(context.env, 'data/events.json', events, `chore: update event from feed ${feed.id}`);
    return json({ ok: true, feed, events });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
