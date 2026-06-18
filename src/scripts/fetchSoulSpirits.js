const { readJSON, writeJSON } = require('./common');

const SOURCE_URL = 'https://wiki.biligame.com/sky/旅行先祖回归记录';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function decodeHTML(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function stripTags(value = '') {
  return decodeHTML(String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function decodeWikiTitle(value = '') {
  try {
    return decodeURIComponent(value.replace(/_/g, ' '));
  } catch (_) {
    return value.replace(/_/g, ' ');
  }
}

function toISODate(value) {
  const match = String(value || '').match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function linkCandidates(row) {
  const links = [];
  const re = /<a\b[^>]*href="\/sky\/([^"#?]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = re.exec(row))) {
    const text = stripTags(match[2]);
    const title = decodeWikiTitle(match[1]);
    const name = text || title;
    if (!name) continue;
    if (name.includes('Image:') || name.startsWith('UI-')) continue;
    if (/^(首页|先祖|旅行先祖|国服|国际服|感恩季|追光季|归属季|音韵季|魔法季|圣岛季|预言季|梦想季|集结季|小王子季|风行季|潜海季|表演季|破晓季|欧若拉季|追忆季|夜行季|拾光季)$/.test(name)) continue;
    links.push({ name, url: `https://wiki.biligame.com/sky/${match[1]}` });
  }
  return links;
}

function extractSeason(row) {
  const imageMatch = row.match(/UI-([^"<>]+?季)logo\.(?:png|jpg|webp)/i);
  if (imageMatch) return decodeHTML(imageMatch[1]);
  const text = stripTags(row);
  const seasonMatch = text.match(/(感恩季|追光季|归属季|音韵季|魔法季|圣岛季|预言季|梦想季|集结季|小王子季|风行季|潜海季|表演季|破晓季|欧若拉季|追忆季|夜行季|拾光季|九色鹿季|筑巢季|重组季|梦想季|王子季)/);
  return seasonMatch ? seasonMatch[1] : '';
}

function extractItems(row, spiritName) {
  const items = new Set();
  const re = /UI-([^"<>]+?)-([^"<>]+?)\.(?:png|jpg|webp)/gi;
  let match;
  while ((match = re.exec(row))) {
    const kind = decodeHTML(match[1]);
    const owner = decodeHTML(match[2]);
    if (owner === spiritName && !kind.includes('logo')) items.add(kind);
  }
  return [...items];
}

function slugifyName(name, used) {
  const base = encodeURIComponent(name)
    .replace(/%/g, '')
    .toLowerCase()
    .slice(0, 40) || 'spirit';
  let slug = base;
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function parseSoulSpiritsHTML(html, fetchedAt = new Date().toISOString()) {
  const rows = [...String(html).matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(match => match[0]);
  const byName = new Map();

  for (const row of rows) {
    const dateMatch = row.match(/(\d{4}[./-]\d{1,2}[./-]\d{1,2})[\s\S]{0,120}[—\-~至到]+[\s\S]{0,120}(\d{4}[./-]\d{1,2}[./-]\d{1,2})/);
    if (!dateMatch) continue;
    const links = linkCandidates(row);
    if (!links.length) continue;
    const spirit = links[0];
    const spiritName = spirit.name.replace(/^旅行先祖[:：]/, '').trim();
    if (!spiritName || spiritName.length > 16) continue;

    const lastRevisit = toISODate(dateMatch[1]);
    const existing = byName.get(spiritName);
    const next = {
      spiritName,
      season: extractSeason(row),
      lastRevisit,
      visitCount: (existing?.visitCount || 0) + 1,
      items: [...new Set([...(existing?.items || []), ...extractItems(row, spiritName)])],
      wikiUrl: spirit.url,
    };
    if (!existing || lastRevisit > existing.lastRevisit) {
      byName.set(spiritName, next);
    } else {
      existing.visitCount = next.visitCount;
      existing.items = next.items;
    }
  }

  const used = new Set();
  const spirits = [...byName.values()]
    .sort((a, b) => b.lastRevisit.localeCompare(a.lastRevisit) || a.spiritName.localeCompare(b.spiritName, 'zh-Hans-CN'))
    .map(item => ({ id: slugifyName(item.spiritName, used), ...item }));

  return {
    _meta: {
      source: SOURCE_URL,
      fetchedAt,
      spiritCount: spirits.length,
    },
    spirits,
  };
}

async function fetchHTML(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

async function main() {
  const html = await fetchHTML(SOURCE_URL);
  const data = parseSoulSpiritsHTML(html);
  if (data.spirits.length < 50) {
    throw new Error(`先祖数量异常：${data.spirits.length}，期望至少 50`);
  }
  const current = readJSON('soul-spirits.json', null);
  if (current && stableJSON(current.spirits) === stableJSON(data.spirits)) {
    console.log(`soul-spirits.json unchanged: ${data.spirits.length} spirits`);
    return;
  }
  writeJSON('soul-spirits.json', data);
  console.log(`soul-spirits.json written: ${data.spirits.length} spirits`);
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { main, parseSoulSpiritsHTML, SOURCE_URL, stableJSON };
