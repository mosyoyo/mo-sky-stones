const { updateEventOverrides } = require('../../src/event-overrides');
const { githubPutJSONFiles, json, readAssetJSON } = require('../_shared');

export async function onRequestGet(context) {
  const events = await readAssetJSON(context, '/data/events.json', []);
  return json(events);
}

export async function onRequestPost(context) {
  try {
    const events = await context.request.json();
    if (!Array.isArray(events)) return json({ error: 'events must be an array' }, 400);
    const beforeEvents = await readAssetJSON(context, '/data/events.json', []);
    const beforeOverrides = await readAssetJSON(context, '/data/event-overrides.json', []);
    const overrides = updateEventOverrides(beforeOverrides, beforeEvents, events);
    await githubPutJSONFiles(context.env, {
      'data/events.json': events,
      'data/event-overrides.json': overrides,
    }, 'chore: update calendar events');
    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
