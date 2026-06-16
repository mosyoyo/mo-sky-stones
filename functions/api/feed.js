const { json, readAssetJSON } = require('../_shared');

function compactFeed(feed) {
  return {
    id: feed.id,
    title: feed.title || '',
    content: feed.content || '',
    createTime: feed.createTime || 0,
    status: feed.status || 'pending',
    autoType: feed.autoType || 'other',
    parsed: Boolean(feed.parsed),
    parsedResult: feed.parsedResult || null,
  };
}

export async function onRequestGet(context) {
  const feeds = await readAssetJSON(context, '/data/feeds.json', []);
  return json(feeds.map(compactFeed));
}

export async function onRequestOptions() {
  return json({});
}
