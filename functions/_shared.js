const { generateICS: generateStoneICS } = require('../ics-generator');
const { generateEventsICS, TYPE_LABELS } = require('../src/event-utils');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: JSON_HEADERS });
}

async function readAssetJSON(context, pathname, fallback) {
  const res = await context.env.ASSETS.fetch(new Request(`https://placeholder${pathname}`));
  if (!res.ok) return fallback;
  return res.json();
}

function appConfig(env) {
  let merged = {};
  if (env.APP_CONFIG) {
    try {
      merged = JSON.parse(env.APP_CONFIG);
    } catch (_) {
      merged = {};
    }
  }
  return {
    adminPassword: merged.adminPassword || env.ADMIN_PASSWORD,
    githubToken: merged.githubToken || env.GITHUB_TOKEN,
    githubOwner: merged.githubOwner || env.GITHUB_OWNER,
    githubRepo: merged.githubRepo || env.GITHUB_REPO,
    githubBranch: merged.githubBranch || env.GITHUB_BRANCH || 'main',
    webAnalyticsToken: merged.webAnalyticsToken || env.CF_WEB_ANALYTICS_TOKEN || env.CLOUDFLARE_WEB_ANALYTICS_TOKEN,
  };
}

async function signAdminAuth(value, secret) {
  const input = new TextEncoder().encode(`${value}.${secret}`);
  const buf = await crypto.subtle.digest('SHA-256', input);
  const bytes = [...new Uint8Array(buf)];
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractVEVENTS(ics) {
  const events = [];
  const blocks = String(ics).split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const endIdx = blocks[i].indexOf('END:VEVENT');
    if (endIdx !== -1) events.push('BEGIN:VEVENT' + blocks[i].slice(0, endIdx) + 'END:VEVENT');
  }
  return events;
}

const DEFAULT_CALENDAR_TYPES = ['red', 'traveling_spirit', 'season', 'activity', 'bonus', 'candle_heap', 'maintenance'];
function parseTypes(url) {
  const value = new URL(url).searchParams.get('types');
  if (!value) return DEFAULT_CALENDAR_TYPES;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

// 解析新提醒选项：endOnly
// 支持 ?endOnly=traveling_spirit,activity&eventMode=all (向后兼容)
function parseReminderOptions(url) {
  const params = new URL(url).searchParams;
  const allTypes = ['red', 'black', ...Object.keys(TYPE_LABELS)];
  const allowedTypes = new Set(allTypes);
  const result = { endOnly: new Set() };

  // 1) 新参数：endOnly
  const endOnlyRaw = params.get('endOnly');
  if (endOnlyRaw) {
    if (endOnlyRaw === 'all') {
      allTypes.forEach(t => result.endOnly.add(t));
    } else {
      endOnlyRaw.split(',').map(s => s.trim()).filter(Boolean).forEach(t => {
        if (allowedTypes.has(t)) result.endOnly.add(t);
      });
    }
  }

  // 2) 向后兼容旧 eventMode
  const eventMode = params.get('eventMode');
  if (eventMode && !endOnlyRaw) {
    if (eventMode === 'end') {
      allTypes.forEach(t => result.endOnly.add(t));
    }
  }

  return result;
}

// 旧函数保留向后兼容
function parseEventMode(url) {
  return new URL(url).searchParams.get('eventMode') || 'all';
}

function buildCalendar(events, types, options = {}) {
  const include = new Set(types);
  const reminderOpts = options.reminderOpts || parseReminderOptions(options.url || 'https://x/?');
  const params = options.url ? new URL(options.url).searchParams : null;
  const isExplicitCustom = !!(params && (params.has('types') || params.has('endOnly')));
  const stoneLastOnly = type => !isExplicitCustom || reminderOpts.endOnly.has(type);
  const parts = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mo-sky-stones//Sky:CoL Calendar (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:光遇·自选日历',
    'X-WR-CALDESC:光遇国服自选日历',
    'X-WR-TIMEZONE:Asia/Shanghai',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  if (include.has('red')) parts.push(...extractVEVENTS(generateStoneICS('red', 60, stoneLastOnly('red') ? '光遇·红石(最后一场)' : '光遇·红石(全部场次)', { lastOnly: stoneLastOnly('red') })));
  if (include.has('black')) parts.push(...extractVEVENTS(generateStoneICS('black', 60, stoneLastOnly('black') ? '光遇·黑石(最后一场)' : '光遇·黑石(全部场次)', { lastOnly: stoneLastOnly('black') })));
  const eventTypes = [...include].filter(type => !['red', 'black'].includes(type));
  if (eventTypes.length) {
    const ics = generateEventsICS(events, {
      name: '光遇·活动提醒',
      types: eventTypes,
      endOnly: reminderOpts.endOnly,
    });
    parts.push(...extractVEVENTS(ics));
  }

  parts.push('END:VCALENDAR');
  return parts.join('\r\n');
}

function githubConfig(env) {
  const cfg = appConfig(env);
  return {
    token: cfg.githubToken,
    owner: cfg.githubOwner,
    repo: cfg.githubRepo,
    branch: cfg.githubBranch,
  };
}

async function githubGetFile(env, path) {
  const cfg = githubConfig(env);
  if (!cfg.token || !cfg.owner || !cfg.repo) throw new Error('GitHub env is not configured');
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'mo-sky-stones-admin',
    },
  });
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  return res.json();
}

async function githubPutJSON(env, path, data, message) {
  const cfg = githubConfig(env);
  const current = await githubGetFile(env, path);
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2) + '\n')));
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'mo-sky-stones-admin',
    },
    body: JSON.stringify({
      message,
      content,
      sha: current.sha,
      branch: cfg.branch,
    }),
  });
  if (!res.ok) throw new Error(`GitHub write failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function githubRequest(env, path, options = {}) {
  const cfg = githubConfig(env);
  if (!cfg.token || !cfg.owner || !cfg.repo) throw new Error('GitHub env is not configured');
  const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'mo-sky-stones-admin',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub request failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function githubPutJSONFiles(env, files, message) {
  const cfg = githubConfig(env);
  const ref = await githubRequest(env, `/git/ref/heads/${cfg.branch}`);
  const baseCommit = await githubRequest(env, `/git/commits/${ref.object.sha}`);
  const tree = [];

  for (const [path, data] of Object.entries(files)) {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2) + '\n')));
    const blob = await githubRequest(env, '/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content, encoding: 'base64' }),
    });
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const nextTree = await githubRequest(env, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
  });
  const nextCommit = await githubRequest(env, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: nextTree.sha, parents: [ref.object.sha] }),
  });
  return githubRequest(env, `/git/refs/heads/${cfg.branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: nextCommit.sha }),
  });
}

module.exports = {
  JSON_HEADERS,
  appConfig,
  buildCalendar,
  githubPutJSONFiles,
  githubPutJSON,
  json,
  parseEventMode,
  parseReminderOptions,
  parseTypes,
  readAssetJSON,
  signAdminAuth,
};
