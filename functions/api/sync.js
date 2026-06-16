const { json, readAssetJSON } = require('../_shared');

export async function onRequestGet(context) {
  const logs = await readAssetJSON(context, '/data/sync.json', []);
  return json(logs);
}

export async function onRequestOptions() {
  return json({});
}
