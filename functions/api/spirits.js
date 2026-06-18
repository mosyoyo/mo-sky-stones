const { githubPutJSONFiles, json, readAssetJSON } = require('../_shared');

const SUBSCRIPTIONS_PATH = 'data/spirit-subscriptions.json';
const SOUL_SPIRITS_PATH = 'data/soul-spirits.json';

function normalizeList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(Boolean))];
}

function normalizePayload(body) {
  if (!body || typeof body !== 'object') throw new Error('payload must be an object');
  return {
    selected: normalizeList(body.selected),
    items: Array.isArray(body.items) ? body.items : null,
  };
}

function normalizeSpiritPatch(patch) {
  const spiritName = String(patch?.spiritName || '').trim();
  if (!spiritName) return null;
  return {
    spiritName,
    season: String(patch.season || '').trim(),
    items: normalizeList(patch.items),
  };
}

export async function onRequestGet(context) {
  const items = await readAssetJSON(context, '/data/soul-spirits.json', { spirits: [] });
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
    const current = await readAssetJSON(context, `/${SUBSCRIPTIONS_PATH}`, { selected: [] });
    const files = {};
    const unchangedSelected = normalizeList(current.selected).join('\n') === payload.selected.join('\n');
    if (!unchangedSelected) {
      files[SUBSCRIPTIONS_PATH] = {
        selected: payload.selected,
        updatedAt: new Date().toISOString(),
      };
    }

    if (payload.items && payload.items.length) {
      const data = await readAssetJSON(context, `/${SOUL_SPIRITS_PATH}`, { spirits: [] });
      const patches = payload.items.map(normalizeSpiritPatch).filter(Boolean);
      const byName = new Map(patches.map(item => [item.spiritName, item]));
      const spirits = (Array.isArray(data.spirits) ? data.spirits : []).map(item => {
        const patch = byName.get(item.spiritName);
        return patch ? { ...item, season: patch.season || item.season || '', items: patch.items } : item;
      });
      files[SOUL_SPIRITS_PATH] = { ...data, spirits };
    }

    const paths = Object.keys(files);
    if (!paths.length) {
      return json({ ok: true, selected: payload.selected, updatedAt: current.updatedAt || null, unchanged: true });
    }
    const result = await githubPutJSONFiles(context.env, files, 'chore: update spirit subscriptions');
    return json({ ok: true, selected: payload.selected, updatedAt: files[SUBSCRIPTIONS_PATH]?.updatedAt || current.updatedAt || null, commit: result.object && result.object.sha });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
