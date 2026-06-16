const { githubPutJSON, json, readAssetJSON } = require('../_shared');

export async function onRequestGet(context) {
  const events = await readAssetJSON(context, '/data/events.json', []);
  return json(events);
}

export async function onRequestPost(context) {
  try {
    const events = await context.request.json();
    if (!Array.isArray(events)) return json({ error: 'events must be an array' }, 400);
    await githubPutJSON(context.env, 'data/events.json', events, 'chore: update calendar events');
    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
