// fetchFeeds.js — 从网易大神抓取官方动态
// 支持翻页抓取，默认往前3个月
// 输出：data/feeds.json + data/processedIds.json

const fs = require('fs');
const path = require('path');
const { DASHEN_UID, FEED_LIST_URL, FEED_TYPES } = require('../config');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// 默认往前抓多少天（3个月）
const DEFAULT_LOOKBACK_DAYS = 90;

function readJSON(filename) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function writeJSON(filename, data) {
  const fp = path.join(DATA_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 抓取大神动态列表（单页）
 */
async function fetchFeedPage(maxTime) {
  let url = `${FEED_LIST_URL}?feedTypes=${FEED_TYPES}&someOneUid=${DASHEN_UID}`;
  if (maxTime) {
    url += `&maxTime=${maxTime}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API 返回 ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`API 报错: ${json.errmsg}`);
  return {
    feeds: json.result.feeds || [],
    nextMaxTime: json.result.nextRangeParam?.maxTime || null,
  };
}

/**
 * 解析原始 feed 数据，提取关键字段
 */
function parseFeed(raw) {
  let content = {};
  try {
    content = JSON.parse(raw.content);
  } catch (e) {
    content = { type: raw.type, body: { text: raw.content } };
  }

  const body = content.body || {};
  let text = body.text || '';
  // 清理正文中的话题标签（#光遇# #xxx#）
  text = text.replace(/#[^#\n]+#/g, '').replace(/\n{3,}/g, '\n\n').trim();
  let title = (body.title || '').replace(/#[^#\n]+#/g, '').trim();
  // 如果没有 title，取正文第一行
  if (!title) {
    const firstLine = text.split('\n').find(l => l.trim().length > 0) || '';
    title = firstLine.trim().slice(0, 40);
  }
  const media = (body.media || []).map(m => ({
    name: m.name,
    url: m.url,
    mimeType: m.mimeType,
  }));

  return {
    id: raw.id,
    uid: raw.uid,
    type: raw.type,
    title,
    content: text,
    media,
    createTime: raw.createTime,
    updateTime: raw.updateTime,
    topics: (raw.topicInfoList || []).map(t => t.topicName),
    status: 'pending',       // pending / approved / ignored
    autoType: null,           // 自动识别类型
    parsed: false,            // 是否已解析过时间
    parsedEvent: null,        // 解析结果
  };
}

/**
 * 主流程：翻页抓取 → 合并 → 保存
 * @param {number} lookbackDays - 往前抓多少天，默认90天
 */
async function main(lookbackDays) {
  if (!lookbackDays) lookbackDays = DEFAULT_LOOKBACK_DAYS;
  const cutoffTime = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

  console.log(`📡 开始抓取大神动态（往前 ${lookbackDays} 天）...`);

  const feeds = readJSON('feeds.json');
  const processedIds = readJSON('processedIds.json');
  const existingIds = new Set(feeds.map(f => f.id));
  const processedSet = new Set(processedIds);

  let allNewFeeds = [];
  let maxTime = null; // 第一次不传，之后用 nextRangeParam
  let page = 0;
  const MAX_PAGES = 30; // 安全上限

  while (page < MAX_PAGES) {
    page++;
    const { feeds: rawFeeds, nextMaxTime } = await fetchFeedPage(maxTime);

    if (rawFeeds.length === 0) {
      console.log(`   第 ${page} 页：无数据，停止`);
      break;
    }

    const lastTime = rawFeeds[rawFeeds.length - 1].createTime;
    const lastDate = new Date(lastTime).toISOString().slice(0, 10);

    // 过滤新动态
    let newInPage = 0;
    for (const raw of rawFeeds) {
      if (existingIds.has(raw.id) || processedSet.has(raw.id)) continue;
      const feed = parseFeed(raw);
      allNewFeeds.push(feed);
      processedIds.push(raw.id);
      newInPage++;
    }

    console.log(`   第 ${page} 页：${rawFeeds.length} 条（新增 ${newInPage}），最新到 ${lastDate}`);

    // 检查是否已经超过了时间范围
    if (lastTime <= cutoffTime) {
      console.log(`   ✅ 已到达 ${lookbackDays} 天前，停止翻页`);
      break;
    }

    // 翻页
    if (!nextMaxTime) {
      console.log(`   无更多数据，停止`);
      break;
    }
    maxTime = nextMaxTime;
  }

  // 合并：新的放最前，按时间排序
  const allFeeds = [...allNewFeeds, ...feeds];
  // 按 createTime 降序排列
  allFeeds.sort((a, b) => (b.createTime || 0) - (a.createTime || 0));

  writeJSON('feeds.json', allFeeds);
  writeJSON('processedIds.json', processedIds);

  console.log(`\n✅ 完成！新增 ${allNewFeeds.length} 条，总计 ${allFeeds.length} 条，翻了 ${page} 页`);
  return { newCount: allNewFeeds.length, total: allFeeds.length, pages: page };
}

// 直接运行
if (require.main === module) {
  const lookbackDays = parseInt(process.argv[2]) || DEFAULT_LOOKBACK_DAYS;
  main(lookbackDays).catch(err => {
    console.error('❌ 抓取失败:', err.message);
    process.exit(1);
  });
}

module.exports = { fetchFeedPage, parseFeed, main, DEFAULT_LOOKBACK_DAYS };
