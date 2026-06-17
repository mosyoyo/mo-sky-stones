const { githubPutJSON, json, readAssetJSON } = require('../_shared');

const SUBSCRIPTIONS_PATH = 'data/spirit-subscriptions.json';

function normalizeList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(Boolean))];
}

function normalizePayload(body) {
  if (!body || typeof body !== 'object') throw new Error('payload must be an object');
  return {
    selected: normalizeList(body.selected),
  };
}

export async function onRequestGet(context) {
  const items = await readAssetJSON(context, '/data/spirit-items.json', { spirits: [] });
  const saved = await readAssetJSON(context, `/${SUBSCRIPTIONS_PATH}`, { selected: [] });
  return json({
    items: Array.isArray(items.spirits) ? items.spirits : [],
    selected: normalizeList(saved.selected),
    updatedAt: saved.updatedAt || null,
  });
}

export async function onRequestPost(context) {
  try {
    const payload = normalizePayload(await context.request.json());
    const next = {
      selected: payload.selected,
      updatedAt: new Date().toISOString(),
    };
    const result = await githubPutJSON(context.env, SUBSCRIPTIONS_PATH, next, 'chore: update spirit subscriptions');
    return json({ ok: true, ...next, commit: result.commit && result.commit.sha });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
