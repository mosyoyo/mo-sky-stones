const { OFFICIAL_UID, normalizeFeed } = require('../event-utils');
const { appendSyncLog, readJSON, writeJSON } = require('./common');

const LIST_URL = 'https://inf.ds.163.com/v1/web/feed/basic/getSomeOneFeeds';
const DETAIL_URL = 'https://inf.ds.163.com/v1/web/feed/basic/facade';
const FEED_TYPES = '1,2,3,4,6,7,10,11';
const TARGET_COUNT = 100;
const PAGE_SIZE = 100;

function collectFeeds(payload) {
  const found = [];
  const seen = new Set();

  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    const id = value.id || value.feedId || value.feed_id;
    if (id && !seen.has(String(id))) {
      const hasText = value.title || value.content || value.text || value.desc || value.summary || value.share_title;
      if (hasText) {
        seen.add(String(id));
        found.push(value);
      }
    }

    for (const item of Object.values(value)) walk(item);
  }

  walk(payload);
  return found;
}

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 mo-sky-stones',
      'Accept': 'application/json,text/plain,*/*',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function collectByType(payload) {
  const source = [];
  const seen = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(walk);
    if (Array.isArray(value.list)) value.list.forEach(walk);
    if (Array.isArray(value.items)) value.items.forEach(walk);
    if (Array.isArray(value.data)) value.data.forEach(walk);
    const id = value.id || value.feedId || value.feed_id;
    if (id && !seen.has(String(id))) {
      seen.add(String(id));
      source.push(value);
    }
    for (const item of Object.values(value)) walk(item);
  }
  walk(payload);
  return source;
}

async function fetchDetail(feedId) {
  const url = new URL(DETAIL_URL);
  url.searchParams.set('feedId', feedId);
  try {
    return await fetchJSON(url);
  } catch (_) {
    return null;
  }
}

async function main() {
  const current = readJSON('feeds.json', []);
  const currentMap = new Map(current.map(feed => [feed.id, feed]));
  const list = [];
  const oldestTime = current
    .map(feed => Number(feed.createTime || 0))
    .filter(Boolean)
    .sort((a, b) => a - b)[0];
  let maxTime = oldestTime ? oldestTime - 1 : Date.now() + 24 * 60 * 60 * 1000;
  let minTime = 0;
  let page = 0;

  while (list.length < TARGET_COUNT && page < 10) {
    const url = new URL(LIST_URL);
    url.searchParams.set('feedTypes', FEED_TYPES);
    url.searchParams.set('someOneUid', OFFICIAL_UID);
    url.searchParams.set('maxTime', String(maxTime));
    url.searchParams.set('minTime', String(minTime));
    const payload = await fetchJSON(url);
    const batch = collectFeeds(payload);
    for (const item of batch) list.push(item);
    const typed = collectByType(payload);
    for (const item of typed) list.push(item);
    const nextRange = payload?.result?.nextRangeParam;
    const nextMaxTime = Number(nextRange?.maxTime);
    const nextMinTime = Number(nextRange?.minTime ?? 0);
    if (!nextMaxTime || Number.isNaN(nextMaxTime) || nextMaxTime >= maxTime) break;
    maxTime = nextMaxTime;
    minTime = nextMinTime;
    page++;
  }

  const unique = [];
  const seen = new Set();
  for (const raw of list) {
    const feedId = String(raw.id || raw.feedId || raw.feed_id || '');
    if (!feedId || seen.has(feedId)) continue;
    seen.add(feedId);
    unique.push(raw);
    if (unique.length >= TARGET_COUNT) break;
  }

  const newFeeds = [];

  for (const raw of unique) {
    const feedId = String(raw.id || raw.feedId || raw.feed_id || '');
    if (!feedId || currentMap.has(feedId)) continue;
    const detail = await fetchDetail(feedId);
    const merged = detail ? { ...raw, detail } : raw;
    const feed = normalizeFeed(merged);
    if (!feed.id) continue;
    currentMap.set(feed.id, feed);
    newFeeds.push(feed);
  }

  const feeds = [...currentMap.values()].sort((a, b) => Number(b.createTime || 0) - Number(a.createTime || 0));
  writeJSON('feeds.json', feeds);
  appendSyncLog({
    message: `发现新公告 ${newFeeds.length} 条（已拉取 ${feeds.length} 条）`,
    added: newFeeds.map(feed => feed.title),
  });

  console.log(`feeds: ${feeds.length}, new: ${newFeeds.length}`);
}

if (require.main === module) {
  main().catch(err => {
    appendSyncLog({ message: '抓取失败', error: err.message });
    console.error(err);
    process.exit(1);
  });
}

module.exports = { collectFeeds, main };
