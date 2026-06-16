// fetchFeeds.js — 从网易大神抓取官方动态
// 输出：data/feeds.json + data/processedIds.json

const fs = require('fs');
const path = require('path');
const { DASHEN_UID, FEED_LIST_URL, FEED_TYPES } = require('../config');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

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
 * 抓取大神动态列表
 */
async function fetchFeedList() {
  const url = `${FEED_LIST_URL}?feedTypes=${FEED_TYPES}&someOneUid=${DASHEN_UID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API 返回 ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`API 报错: ${json.errmsg}`);
  return json.result.feeds || [];
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
  // 清理正文中的话题标签行（#光遇# #xxx#）
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
    autoType: null,           // 自动识别类型（第二阶段）
    parsed: false,            // 是否已解析过时间
    parsedEvent: null,        // 解析结果
  };
}

/**
 * 主流程：抓取 → 合并 → 保存
 */
async function main() {
  console.log('📡 开始抓取大神动态...');

  const feeds = readJSON('feeds.json');
  const processedIds = readJSON('processedIds.json');
  const existingIds = new Set(feeds.map(f => f.id));
  const processedSet = new Set(processedIds);

  const rawFeeds = await fetchFeedList();
  console.log(`   抓到 ${rawFeeds.length} 条动态`);

  let newCount = 0;
  for (const raw of rawFeeds) {
    // 跳过已处理嘅
    if (existingIds.has(raw.id) || processedSet.has(raw.id)) continue;

    const feed = parseFeed(raw);
    feeds.unshift(feed);  // 新嘅放最前
    processedIds.push(raw.id);
    newCount++;
    console.log(`   📢 新公告: ${feed.title || feed.content.slice(0, 30)}`);
  }

  writeJSON('feeds.json', feeds);
  writeJSON('processedIds.json', processedIds);

  console.log(`\n✅ 完成！新增 ${newCount} 条，总计 ${feeds.length} 条`);
  return { newCount, total: feeds.length };
}

// 直接运行
if (require.main === module) {
  main().catch(err => {
    console.error('❌ 抓取失败:', err.message);
    process.exit(1);
  });
}

module.exports = { fetchFeedList, parseFeed, main };
