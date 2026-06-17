// /api/settings — 管理「数据源偏好」source-config.json
// 数据结构：6 类事件各自选择 netease / wiki
// {
//   "traveling_spirit": "wiki",
//   "season": "wiki",
//   "activity": "wiki",
//   "bonus": "netease",       // 锁定：仅来自网易大神
//   "candle_heap": "netease", // 锁定：仅来自网易大神
//   "maintenance": "netease"  // 锁定：仅来自网易大神
// }
// 用户核心决策 6/17 晚：双倍/大蜡烛/维护 这三类**固定来自网易大神**，
// admin 设置页只能切换另外三类（旅行先祖/季节/活动）。

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

// 这三类固定走 netease，admin 无法切换
const NETEASE_LOCKED_TYPES = new Set(['bonus', 'candle_heap', 'maintenance']);

const ALLOWED_TYPES = new Set(Object.keys(DEFAULT_CONFIG));
const ALLOWED_SOURCES = new Set(['netease', 'wiki']);

function validateConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('配置必须是对象');
  const out = {};
  for (const [type, source] of Object.entries(input)) {
    if (!ALLOWED_TYPES.has(type)) throw new Error(`未知类型: ${type}`);
    if (!ALLOWED_SOURCES.has(source)) throw new Error(`类型 ${type} 的值必须是 netease / wiki，得到: ${source}`);
    // 锁定类型：忽略客户端提交的值，强制 netease
    if (NETEASE_LOCKED_TYPES.has(type)) {
      out[type] = 'netease';
      continue;
    }
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
