// /api/settings — 管理「数据源偏好」source-config.json
// 数据结构：6 类事件各自选择 netease / wiki
// {
//   "traveling_spirit": "wiki",
//   "season": "wiki",
//   "activity": "wiki",
//   "bonus": "netease",
//   "candle_heap": "netease",
//   "maintenance": "netease"
// }

const { json, githubPutJSON } = require('../_shared');

const CONFIG_PATH = 'data/source-config.json';

const DEFAULT_CONFIG = {
  traveling_spirit: 'wiki',
  season:           'wiki',
  activity:         'wiki',
  bonus:            'netease',
  candle_heap:      'netease',
  maintenance:      'netease',
};

const ALLOWED_TYPES = new Set(Object.keys(DEFAULT_CONFIG));
const ALLOWED_SOURCES = new Set(['netease', 'wiki']);

function validateConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('配置必须是对象');
  const out = {};
  for (const [type, source] of Object.entries(input)) {
    if (!ALLOWED_TYPES.has(type)) throw new Error(`未知类型: ${type}`);
    if (!ALLOWED_SOURCES.has(source)) throw new Error(`类型 ${type} 的值必须是 netease / wiki，得到: ${source}`);
    out[type] = source;
  }
  // 补全缺省项
  for (const [type, source] of Object.entries(DEFAULT_CONFIG)) {
    if (!(type in out)) out[type] = source;
  }
  return out;
}

export async function onRequestGet(context) {
  try {
    const res = await context.env.ASSETS.fetch(new Request(`https://placeholder/${CONFIG_PATH}`));
    if (!res.ok) {
      return json({ config: DEFAULT_CONFIG, isDefault: true, lastUpdated: null });
    }
    const config = await res.json();
    return json({ config, isDefault: false, lastUpdated: null });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const next = validateConfig(body.config);
    const result = await githubPutJSON(
      context.env,
      CONFIG_PATH,
      next,
      `chore: update source-config.json (${new Date().toISOString().slice(0, 10)})`
    );
    return json({ ok: true, config: next, commit: result.commit && result.commit.sha });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
