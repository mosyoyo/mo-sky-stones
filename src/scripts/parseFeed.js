// parseFeed.js — 解析公告内容，自动识别类型 + 提取时间
// MVP：只做关键词分类，时间解析等第二阶段

const fs = require('fs');
const path = require('path');

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

// === 第二阶段：自动分类 ===

const TYPE_RULES = [
  {
    type: 'traveling_spirit',
    label: '旅行先祖',
    keywords: ['旅行先祖', '先祖到访', '先祖到临', '复刻', '先祖即将到访', '先祖即将到临'],
  },
  {
    type: 'season',
    label: '季节',
    keywords: ['季节开启', '季节结束', '新季节', '赛季'],
  },
  {
    type: 'activity',
    label: '活动',
    keywords: ['活动开启', '周年庆', '自然日', '音乐节', '花憩节', '彩染季', '端午节', '端午', '寻宝节', '星光奖', '致梵高'],
  },
  {
    type: 'bonus',
    label: '双倍活动',
    keywords: ['双倍蜡烛', '双倍爱心', '双倍季蜡', '额外烛火'],
  },
  {
    type: 'maintenance',
    label: '维护/更新',
    keywords: ['更新时间', '维护', '版本更新', '开服'],
  },
];

/**
 * 自动识别类型
 */
function detectType(text, title, topics) {
  const combined = `${title} ${text} ${(topics || []).join(' ')}`.toLowerCase();

  for (const rule of TYPE_RULES) {
    for (const kw of rule.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        return rule.type;
      }
    }
  }
  return 'other';
}

// === 第三阶段：时间解析（MVP 简化版）===

/**
 * 提取中文日期范围
 * 支持格式：
 *   - "6月19日00:00至6月26日23:59"
 *   - "6月19日 ~ 6月26日"
 *   - "6月19日开启"
 *   - "本周四早上6:00至下周一中午12:00"
 */
function extractDateRange(text) {
  const now = new Date();
  const year = now.getFullYear();

  // 模式1: X月X日XX:XX 至 X月X日XX:XX
  const pattern1 = /(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})?\s*[至~\-—]\s*(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})?/;
  const m1 = text.match(pattern1);
  if (m1) {
    const startMonth = parseInt(m1[1]);
    const startDay = parseInt(m1[2]);
    const startTime = m1[3] || '00:00';
    const endMonth = parseInt(m1[4]);
    const endDay = parseInt(m1[5]);
    const endTime = m1[6] || '23:59';

    const start = new Date(year, startMonth - 1, startDay, ...startTime.split(':').map(Number));
    let end = new Date(year, endMonth - 1, endDay, ...endTime.split(':').map(Number));

    // 如果结束日期在开始之前，说明跨年
    if (end < start) end = new Date(year + 1, endMonth - 1, endDay, ...endTime.split(':').map(Number));

    return { start: start.toISOString(), end: end.toISOString() };
  }

  // 模式2: X月X日开启/开始
  const pattern2 = /(\d{1,2})月(\d{1,2})日\s*(?:开启|开始|正式开启)/;
  const m2 = text.match(pattern2);
  if (m2) {
    const month = parseInt(m2[1]);
    const day = parseInt(m2[2]);
    const start = new Date(year, month - 1, day, 0, 0, 0);
    // 默认活动持续到当天结束
    const end = new Date(year, month - 1, day, 23, 59, 59);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  // 模式3: "本周X" / "下周X" (旅行先祖常见格式)
  const weekDayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
  const pattern3 = /本?周([一二三四五六日天])\s*(?:早上|上午|下午|晚上)?\s*(\d{1,2}:\d{2})?\s*至?\s*(?:下周([一二三四五六日天]))?\s*(?:早上|上午|下午|晚上|中午)?\s*(\d{1,2}:\d{2})?/;
  const m3 = text.match(pattern3);
  if (m3) {
    const startDow = weekDayMap[m3[1]];
    const startTime = m3[2] || '06:00';
    const endDow = weekDayMap[m3[3]];
    const endTime = m3[4] || '12:00';

    // 计算本周目标日
    const currentDow = now.getDay();
    let daysUntilStart = startDow - currentDow;
    if (daysUntilStart < 0) daysUntilStart += 7;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() + daysUntilStart);
    startDate.setHours(...startTime.split(':').map(Number), 0, 0);

    let endDate;
    if (endDow !== undefined) {
      // 下周的目标日
      const daysUntilEnd = endDow - currentDow + 7;
      endDate = new Date(now);
      endDate.setDate(now.getDate() + daysUntilEnd);
      endDate.setHours(...endTime.split(':').map(Number), 0, 0);
    } else {
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 0, 0);
    }

    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }

  return null;
}

/**
 * 主流程：解析 feeds.json 中 status=pending 且 parsed=false 的条目
 */
function main() {
  console.log('🔍 开始解析公告...');

  const feeds = readJSON('feeds.json');
  const events = readJSON('events.json');

  let parsedCount = 0;
  let skippedCount = 0;

  for (const feed of feeds) {
    if (feed.parsed) continue;

    // 自动分类
    feed.autoType = detectType(feed.content, feed.title, feed.topics);

    // 尝试提取时间
    const dateRange = extractDateRange(feed.content);
    if (dateRange && feed.autoType !== 'other') {
      feed.parsedEvent = dateRange;
    }

    feed.parsed = true;
    parsedCount++;

    // 自动为 approved 且有时间的 feed 生成 event
    if (feed.status === 'approved' && feed.parsedEvent) {
      const existingEvent = events.find(e => e.sourceFeedId === feed.id);
      if (!existingEvent) {
        events.push({
          id: `${feed.autoType}-${feed.id.slice(0, 8)}`,
          enabled: true,
          type: feed.autoType,
          title: feed.title || feed.content.slice(0, 20),
          start: feed.parsedEvent.start,
          end: feed.parsedEvent.end,
          sourceFeedId: feed.id,
        });
        console.log(`   ✨ 自动创建事件: ${feed.title || feed.content.slice(0, 30)}`);
      }
    }

    if (feed.autoType === 'other') {
      skippedCount++;
    }
  }

  writeJSON('feeds.json', feeds);
  writeJSON('events.json', events);

  console.log(`\n✅ 解析完成！已解析 ${parsedCount} 条，跳过 ${skippedCount} 条 (other)`);
  return { parsedCount, skippedCount };
}

if (require.main === module) {
  main();
}

module.exports = { detectType, extractDateRange, main };
