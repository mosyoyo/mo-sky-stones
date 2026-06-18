const fs = require('fs');
const path = require('path');
const { appendSyncLog, writeJSON } = require('./common');

// ─── 配置 ─────────────────────────────────────────────────────────────────

// Wiki「活动日历」页（独立 SMW 页面，结构更规整、含真实年份）
const WIKI_CALENDAR_URL = 'https://wiki.biligame.com/sky/活动日历';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 「最近活动」列表条目模式（来自 WebFetch 抓到的 markdown）
// 例：[奇妙之旅：狂欢季](https://...)  04.23 - 07.08
// 例：国际服集体复刻： [被遗忘的天堂一隅](...)， ...  06.17 - 07.02
const RE_EVENT_LINE = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s+(\d{1,2}\.\d{1,2})\s*[-–]\s*(\d{1,2}\.\d{1,2})/g;
// 「纯文本 + 日期」模式
const RE_PLAIN = /^(.+?)\s{2,}(\d{1,2}\.\d{1,2})\s*[-–]\s*(\d{1,2}\.\d{1,2})/;

// 「最近活动」版块的边界
// 注意：HTML 里是 <b>最近活动</b>，但解析前会先做 HTML→markdown 转换，所以这里就用纯文字
const SECTION_START = '最近活动';
// 「◀YYYY年▶」= 当前年份（活动日历页是真实年份；首页是占位符「◀2333年▶」）
const RE_YEAR = /◀(\d{4})年▶/;

// 标题前缀 → 事件类型映射
// 注意：只保留国服相关前缀（user 决策 6/17 晚：只关心国服，国际服全部过滤）
// 国际服的前缀已删除（line.startsWith('国际服') 在主循环会先 continue）
const PREFIX_TO_TYPE = {
  '奇妙之旅：': 'season',
  '国服复刻：': 'traveling_spirit',
  '国服复刻:': 'traveling_spirit',
  '国服集体复刻：': 'activity',
  '国服集体复刻:': 'activity',
};

// ─── 工具 ─────────────────────────────────────────────────────────────────

function fetchHTML(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,*/*' },
    signal: controller.signal,
  })
    .then(r => {
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return r.text();
    })
    .catch(e => {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error(`请求超时 (15s): ${url}`);
      throw e;
    });
}

// 把 Wiki「活动日历」页的 HTML 表格转换为 markdown 风格文本
// 目的：让现有正则（依赖 [text](url) 格式）能正常匹配
// 例：
//   <a href="/sky/狂欢季" title="狂欢季">奇妙之旅：狂欢季</a>&#160;&#160;04.23 - 07.08
//   <a href="/sky/端午节">端午节</a>&nbsp;&nbsp;06.19 - 07.02<br />
// 转换为：
//   [奇妙之旅：狂欢季](https://wiki.biligame.com/sky/狂欢季)  04.23 - 07.08
//   [端午节](https://wiki.biligame.com/sky/端午节)  06.19 - 07.02
function htmlToMarkdownLike(html) {
  // 1. 提取 <a> 标签里的纯文本和 href（避免 href 中含属性顺序差异影响正则）
  //    <a href="URL" title="...">TEXT</a>  →  [TEXT](https://wiki.biligame.comURL)
  let s = html.replace(
    /<a\s+[^>]*?href="([^"]+)"[^>]*>([^<]*)<\/a>/gi,
    (_m, href, text) => {
      // 路径 href：补全成绝对 URL（处理以 / 开头的相对路径）
      const fullUrl = href.startsWith('http')
        ? href
        : `https://wiki.biligame.com${href.startsWith('/') ? '' : '/'}${href}`;
      // 清理 text 里的空白
      const cleanText = text.trim();
      return `[${cleanText}](${fullUrl})`;
    }
  );
  // 2. HTML 实体 → 字符
  s = s
    .replace(/&#160;/g, '  ')   // 不间断空格 → 两个普通空格
    .replace(/&nbsp;/g, '  ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  // 3. <br />、<br> → 换行
  s = s.replace(/<br\s*\/?>/gi, '\n');
  // 4. 表格标签 → 换行（让 <td> 里的内容分行处理）
  s = s
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/b>/gi, '\n');
  // 5. 去掉残留 HTML 标签
  s = s.replace(/<[^>]+>/g, '');
  return s;
}

function parseMonthDay(year, mmdd) {
  // mmdd = "04.23" → "2026-04-23"
  const parts = mmdd.split('.');
  if (parts.length !== 2) return null;
  return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

function toUTCChina12(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const utcMs = Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 4, 0, 0, 0);
  return new Date(utcMs).toISOString();
}

function toUTCSpiritWindow(startDateStr) {
  if (!startDateStr) return { start: null, end: null };
  const parts = startDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return { start: null, end: null };
  const [year, month, day] = parts;
  const base = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const weekday = base.getUTCDay();
  const daysToMonday = (8 - weekday) % 7;
  const mondayNoonBJ = new Date(Date.UTC(year, month - 1, day + daysToMonday, 4, 0, 0, 0));
  const thursdaySixBJ = new Date(Date.UTC(year, month - 1, day + daysToMonday - 5, 22, 0, 0, 0));
  return { start: thursdaySixBJ.toISOString(), end: mondayNoonBJ.toISOString() };
}

function detectType(title) {
  for (const [prefix, type] of Object.entries(PREFIX_TO_TYPE)) {
    if (title.startsWith(prefix)) return { type, cleanTitle: title.slice(prefix.length) };
  }
  // 无前缀的（如「端午节」/「周年庆」）→ activity
  return { type: 'activity', cleanTitle: title };
}

// ─── 主解析 ──────────────────────────────────────────────────────────────

function parseCalendarHTML(html) {
  // 0. 先把 HTML 转成 markdown 风格文本（这样现成的正则才能匹配）
  html = htmlToMarkdownLike(html);

  // 1. 找「最近活动」版块
  const startIdx = html.indexOf(SECTION_START);
  if (startIdx < 0) {
    throw new Error('找不到「最近活动」版块');
  }
  // 活动日历页：section 结束于「◀YYYY年▶」导航行
  // 兼容首页（如果误用）：兜底用「更多结果」或文末
  const yearMatch = html.match(RE_YEAR);
  let endIdx;
  if (yearMatch) {
    // ◀YYYY年▶ 行开头
    const yearLineStart = html.lastIndexOf('\n', yearMatch.index) + 1;
    endIdx = yearLineStart;
  } else {
    // 兜底：找「...更多结果」或文末
    const lastMore = html.lastIndexOf('...更多结果');
    if (lastMore > 0) {
      endIdx = html.lastIndexOf('\n', lastMore) + 1;
    } else {
      endIdx = html.length;
    }
  }
  const section = html.slice(startIdx, endIdx);

  // 2. 提取年份（活动日历页是真实值）
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  // 3. 解析每行事件
  const events = [];
  // Step 1: 去掉所有「[...更多结果](...)」整段（不管它后面还跟不跟内容）
  let cleaned = section.replace(/\[?\.\.\.更多结果\]\([^)]*\)/g, '');
  // Step 2: 按行处理
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (line === SECTION_START) continue;
    if (line.startsWith('◀')) continue;
    // 过滤国际服相关行（user 决策 6/17 晚：只关心国服）
    if (line.startsWith('国际服') || line.includes('国际服')) continue;
    if (line.startsWith('国际服集体复刻：') || line.startsWith('国服集体复刻：')) {
      // 集体复刻：标题为「国际服集体复刻： 名字1，名字2，...」
      const dateMatch = line.match(/(\d{1,2}\.\d{1,2})\s*[-–]\s*(\d{1,2}\.\d{1,2})\s*$/);
      if (!dateMatch) continue;
      const startMD = dateMatch[1];
      const endMD   = dateMatch[2];
      const namesBlock = line.slice(0, line.indexOf(dateMatch[0])).trim();
      // 提取引号中的名字（[name](url)）
      const nameRe = /\[([^\]]+)\]\([^)]+\)/g;
      const names = [];
      let m;
      while ((m = nameRe.exec(namesBlock))) names.push(m[1]);
      if (names.length === 0) continue;

      events.push({
        id: `wiki-group-${startMD.replace('.', '')}-${endMD.replace('.', '')}`,
        type: 'activity',
        title: `【活动】国际服集体复刻（${names.join('、')}）`,
        start: toUTCChina12(parseMonthDay(year, startMD)),
        end:   toUTCChina12(parseMonthDay(year, endMD)),
        source: 'wiki',
        wikiUrl: WIKI_CALENDAR_URL,
        _group: true,
        _names: names,
      });
      continue;
    }

    // 普通行：[title](url)  MM.DD - MM.DD
    const linkMatch = line.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s+(\d{1,2}\.\d{1,2})\s*[-–]\s*(\d{1,2}\.\d{1,2})/);
    if (linkMatch) {
      const rawTitle = linkMatch[1];
      const url = linkMatch[2];
      const startMD = linkMatch[3];
      const endMD = linkMatch[4];
      const { type, cleanTitle } = detectType(rawTitle);

      // 季节/活动：取 link 的 basename 作 id
      let idBase = cleanTitle;
      const urlMatch = url.match(/\/sky\/([^/?#]+)/);
      if (urlMatch) idBase = decodeURIComponent(urlMatch[1]);

      const titlePrefix = type === 'season' ? '【季节】' : type === 'traveling_spirit' ? '【复刻】' : '【活动】';
      const spiritWindow = type === 'traveling_spirit'
        ? toUTCSpiritWindow(parseMonthDay(year, startMD))
        : null;

      events.push({
        id: `wiki-${type}-${idBase}-${startMD.replace('.', '')}`.replace(/\s+/g, ''),
        type,
        title: `${titlePrefix}${cleanTitle}`,
        start: spiritWindow ? spiritWindow.start : toUTCChina12(parseMonthDay(year, startMD)),
        end:   spiritWindow ? spiritWindow.end : toUTCChina12(parseMonthDay(year, endMD)),
        source: 'wiki',
        wikiUrl: url,
      });
      continue;
    }

    // 纯文本 + 日期（无 link），如「端午节  06.19 - 07.02」
    const plainMatch = line.match(RE_PLAIN);
    if (plainMatch) {
      const rawTitle = plainMatch[1].trim();
      const startMD = plainMatch[2];
      const endMD = plainMatch[3];
      const { type, cleanTitle } = detectType(rawTitle);

      const titlePrefix = type === 'season' ? '【季节】' : type === 'traveling_spirit' ? '【复刻】' : '【活动】';
      const spiritWindow = type === 'traveling_spirit'
        ? toUTCSpiritWindow(parseMonthDay(year, startMD))
        : null;

      events.push({
        id: `wiki-${type}-${cleanTitle}-${startMD.replace('.', '')}`.replace(/\s+/g, ''),
        type,
        title: `${titlePrefix}${cleanTitle}`,
        start: spiritWindow ? spiritWindow.start : toUTCChina12(parseMonthDay(year, startMD)),
        end:   spiritWindow ? spiritWindow.end : toUTCChina12(parseMonthDay(year, endMD)),
        source: 'wiki',
        wikiUrl: WIKI_CALENDAR_URL,
      });
    }
  }

  return events;
}

// ─── Mock 模式（沙箱 IP 被反爬墙挡时使用） ─────────────────────────────
// 内容来自 2026-06-17 通过 WebFetch 抓到的 wiki「活动日历」页面「最近活动」版块
// 注意：mock 移除了 markdown 的 title 段（"..."）以模拟实际 HTML 抓取后的纯链接形式
// 注意：活动日历页的「更多结果」**都带 `[...` 前缀**（首页会有 1 个丢失前缀的）
const MOCK_HTML = `
**最近活动**

[奇妙之旅：狂欢季](https://wiki.biligame.com/sky/%E7%8B%82%E6%AC%A2%E5%AD%A3)  04.23 - 07.08
[...更多结果](https://wiki.biligame.com/sky/季节ask) [端午节](https://wiki.biligame.com/sky/2026%E5%B9%B4%E7%AB%AF%E5%8D%88%E8%8A%82)  06.19 - 07.02
[周年庆](https://wiki.biligame.com/sky/2026%E5%B9%B4%E5%91%A8%E5%B9%B4%E5%BA%86)  07.04 - 07.24
[国服复刻：致敬钢琴家](https://wiki.biligame.com/sky/%E6%97%85%E8%A1%8C%E5%85%88%E7%A5%96%EF%BC%9A%E8%87%B4%E6%95%AC%E9%92%A2%E7%90%B4%E5%AE%B6)  06.11 - 06.15
[国服复刻：希望之种](https://wiki.biligame.com/sky/%E6%97%85%E8%A1%8C%E5%85%88%E7%A5%96%EF%BC%9A%E5%B8%8C%E6%9C%9B%E4%B9%8B%E7%A7%8D)  06.18 - 06.22
国际服集体复刻： [被遗忘的天堂一隅](https://wiki.biligame.com/sky/Traveling_Spirits:Remnant_of_a_Forgotten_Haven)， [被遗弃之处的回响](https://wiki.biligame.com/sky/Traveling_Spirits:Echo_of_an_Abandoned_Refuge)， [失落小镇的记忆](https://wiki.biligame.com/sky/Traveling_Spirits:Memory_of_a_Lost_Village)， [沙漠绿洲的余痕](https://wiki.biligame.com/sky/Traveling_Spirits:Vestige_of_a_Deserted_Oasis)  06.17 - 07.02
[...更多结果](https://wiki.biligame.com/sky/集体复刻ask)
◀2026年▶
`;

// ─── 主流程 ─────────────────────────────────────────────────────────────

async function main() {
  const useMock = process.argv.includes('--mock');
  const syncLog = [];

  try {
    appendSyncLog({ message: '开始抓取 Wiki 活动日历…', source: 'wiki' });
    console.log('🌐 抓取 Wiki 活动日历页...');

    let html;
    if (useMock) {
      console.log('⚠️  使用 --mock 模式（用本地示例 HTML）');
      html = MOCK_HTML;
    } else {
      html = await fetchHTML(WIKI_CALENDAR_URL);
    }

    console.log(`📄 HTML 长度: ${html.length} 字符`);

    const events = parseCalendarHTML(html);
    console.log(`✅ 解析到 ${events.length} 条事件:`);
    for (const e of events) {
      console.log(`  - [${e.type}] ${e.title}  ${e.start} → ${e.end}`);
    }

    const output = {
      _meta: {
        source: WIKI_CALENDAR_URL,
        lastUpdated: new Date().toISOString(),
        counts: {
          season:            events.filter(e => e.type === 'season').length,
          activity:          events.filter(e => e.type === 'activity').length,
          traveling_spirit:  events.filter(e => e.type === 'traveling_spirit').length,
        },
      },
      events: events.map(({ _group, _names, ...rest }) => rest),
    };

    writeJSON('events-wiki.json', output);
    appendSyncLog({ message: `Wiki 活动日历抓取完成: ${events.length} 条事件`, source: 'wiki' });
    console.log(`\n📦 已写入 data/events-wiki.json (${events.length} 条)`);
  } catch (err) {
    appendSyncLog({ message: `Wiki 抓取失败: ${err.message}`, source: 'wiki', error: err.message });
    console.error('❌ Wiki fetch failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main, parseCalendarHTML, toUTCSpiritWindow };
