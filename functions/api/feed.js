const { cleanEventTitle } = require('../../src/event-utils');
const { json, readAssetJSON } = require('../_shared');

function compactFeed(feed) {
  return {
    id: feed.id,
    title: feed.title || '',
    content: feed.content || '',
    createTime: feed.createTime || 0,
    status: feed.status || 'pending',
    autoType: feed.autoType || 'other',
    calendarTitle: feed.parsedResult?.title || cleanEventTitle(feed.title, feed.content, feed.autoType || 'other'),
    parsed: Boolean(feed.parsed),
    parsedResult: feed.parsedResult || null,
  };
}

export async function onRequestGet(context) {
  const feeds = await readAssetJSON(context, '/data/feeds.json', []);
  const seen = new Set();
  const unique = [];
  for (const feed of feeds) {
    const item = compactFeed(feed);
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return json(unique);
}

export async function onRequestOptions() {
  return json({});
}
