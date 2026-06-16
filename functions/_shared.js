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

function extractVEVENTS(ics) {
  const events = [];
  const blocks = String(ics).split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const endIdx = blocks[i].indexOf('END:VEVENT');
    if (endIdx !== -1) events.push('BEGIN:VEVENT' + blocks[i].slice(0, endIdx) + 'END:VEVENT');
  }
  return events;
}

function parseTypes(url) {
  const value = new URL(url).searchParams.get('types');
  if (!value) return Object.keys(TYPE_LABELS);
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

function buildCalendar(events, types) {
  const include = new Set(types);
  const parts = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mo-sky-stones//Sky:CoL Calendar (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:光遇·自选日历',
    'X-WR-CALDESC:光遇国服自选日历',
    'X-WR-TIMEZONE:Asia/Shanghai',
  ];

  if (include.has('red')) parts.push(...extractVEVENTS(generateStoneICS('red', 60, '光遇·红石(最后一场)')));
  if (include.has('black')) parts.push(...extractVEVENTS(generateStoneICS('black', 60, '光遇·黑石(最后一场)')));
  const eventTypes = [...include].filter(type => !['red', 'black'].includes(type));
  if (eventTypes.length) {
    const ics = generateEventsICS(events, { name: '光遇·活动提醒', types: eventTypes });
    parts.push(...extractVEVENTS(ics));
  }

  parts.push('END:VCALENDAR');
  return parts.join('\r\n');
}

function githubConfig(env) {
  return {
    token: env.GITHUB_TOKEN,
    owner: env.GITHUB_OWNER,
    repo: env.GITHUB_REPO,
    branch: env.GITHUB_BRANCH || 'main',
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

module.exports = {
  JSON_HEADERS,
  buildCalendar,
  githubPutJSON,
  json,
  parseTypes,
  readAssetJSON,
};
