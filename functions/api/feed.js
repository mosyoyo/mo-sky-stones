const { json, readAssetJSON } = require('../_shared');

export async function onRequestGet(context) {
  const feeds = await readAssetJSON(context, '/data/feeds.json', []);
  return json(feeds);
}

export async function onRequestOptions() {
  return json({});
}
