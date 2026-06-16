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
 *   - "本周四6:00至下周一12:00"
 *
 * 重要：时间信息通常在正文中而非标题，调用时务必传入完整 content
 */
function extractDateRange(text, now) {
  if (!now) now = new Date();
  const year = now.getFullYear();

  // 模式0: 先清理标题行（第一行通常是标题重复），只保留正文内容
  // 很多公告格式: "标题\n\n正文..."
  const contentLines = text.split('\n').slice(1).join('\n') || text;

  // 模式1: X月X日XX:XX 至 X月X日XX:XX（最精确的格式）
  const pattern1 = /(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})?\s*[至~\-—]\s*(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})?/;
  const m1 = contentLines.match(pattern1);
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
  const m2 = contentLines.match(pattern2);
  if (m2) {
    const month = parseInt(m2[1]);
    const day = parseInt(m2[2]);
    const start = new Date(year, month - 1, day, 0, 0, 0);
    // 默认活动持续到当天结束
    const end = new Date(year, month - 1, day, 23, 59, 59);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  // 模式3: "本周X HH:MM 至 下周X HH:MM"（旅行先祖常见格式）
  const weekDayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };

  // 先匹配完整格式: 本周X(早上/上午/下午/晚上/中午)?HH:MM 至 下周X(早上/上午/下午/晚上/中午)?HH:MM
  const pattern3full = /本周([一二三四五六日天])\s*(?:早上|上午)?\s*(\d{1,2}[:：]\d{2})?\s*至\s*下周([一二三四五六日天])\s*(?:中午|下午|晚上)?\s*(\d{1,2}[:：]\d{2})?/;
  const m3full = contentLines.match(pattern3full);

  if (m3full) {
    const startDow = weekDayMap[m3full[1]];
    const startTimeRaw = (m3full[2] || '06:00').replace('：', ':');
    const endDow = weekDayMap[m3full[3]];
    const endTimeRaw = (m3full[4] || '12:00').replace('：', ':');

    const [startH, startM] = startTimeRaw.split(':').map(Number);
    const [endH, endM] = endTimeRaw.split(':').map(Number);

    // 计算本周目标日（以当前日期为基准）
    const currentDow = now.getDay(); // 0=Sun, 1=Mon...

    // 本周X: 找到当前周的那个星期X
    let daysToStart = startDow - currentDow;
    // 如果已经过了本周的目标日，说明公告是提前发布的，目标日还没到
    // 但如果目标日还没到（daysToStart > 0），那就是本周
    // 如果 daysToStart < 0，说明目标日已过——但公告说"本周X"通常意味着未来的那个X
    // 保守处理：如果 daysToStart <= 0，加7天表示下周（但公告说"本周"所以可能是当天或已过）
    // 对于旅行先祖场景：公告通常在周四前发布，所以 daysToStart 应该 >= 0
    if (daysToStart < 0) daysToStart += 7;

    const startDate = new Date(now);
    startDate.setDate(now.getDate() + daysToStart);
    startDate.setHours(startH, startM, 0, 0);

    // 下周X: 本周X + 7天内到下周X
    let daysToEnd = endDow - currentDow + 7;
    // 如果 endDow >= startDow，也可以 = endDow - startDow + 7 从 start 算
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + daysToEnd);
    endDate.setHours(endH, endM, 0, 0);

    // 安全检查：end 必须在 start 之后
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 7);
    }

    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }

  // 模式3b: 简化版——只有"本周X"没有"至下周X"
  const pattern3b = /本周([一二三四五六日天])\s*(?:早上|上午|下午|晚上)?\s*(\d{1,2}[:：]\d{2})?\s*(?:开启|开始|到临|到访)?/;
  const m3b = contentLines.match(pattern3b);
  if (m3b) {
    const startDow = weekDayMap[m3b[1]];
    const startTimeRaw = (m3b[2] || '06:00').replace('：', ':');
    const [startH, startM] = startTimeRaw.split(':').map(Number);

    const currentDow = now.getDay();
    let daysToStart = startDow - currentDow;
    if (daysToStart < 0) daysToStart += 7;

    const startDate = new Date(now);
    startDate.setDate(now.getDate() + daysToStart);
    startDate.setHours(startH, startM, 0, 0);

    // 默认持续到当天 23:59
    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 0, 0);

    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }

  return null;
}

/**
 * 主流程：解析 feeds.json 中的条目
 * --force 参数: 强制重新解析所有条目（忽略 parsed 标记）
 * 默认: 只解析 parsed=false 的条目
 */
function main() {
  const forceReparsed = process.argv.includes('--force') || process.argv.includes('--reparse');
  console.log(forceReparsed ? '🔄 强制重新解析所有公告...' : '🔍 开始解析公告...');

  const feeds = readJSON('feeds.json');
  const events = readJSON('events.json');

  let parsedCount = 0;
  let skippedCount = 0;

  for (const feed of feeds) {
    // 跳过已解析的（除非强制）
    if (feed.parsed && !forceReparsed) continue;

    // 自动分类
    feed.autoType = detectType(feed.content, feed.title, feed.topics);

    // 用公告发布时间作为基准时间来解析日期（更准确）
    // createTime 是毫秒时间戳
    const baseTime = feed.createTime ? new Date(feed.createTime) : new Date();

    // 尝试从正文提取时间（不是标题）
    const dateRange = extractDateRange(feed.content, baseTime);
    if (dateRange && feed.autoType !== 'other') {
      feed.parsedEvent = dateRange;
    } else if (forceReparsed) {
      // 强制重解析时，如果之前有 parsedEvent 但现在解析不到，保留旧的
      // 如果确实解析不到，设为 null
      if (!dateRange) feed.parsedEvent = null;
    }

    feed.parsed = true;
    parsedCount++;

    // 自动为 approved 且有时间的 feed 生成/更新 event
    if (feed.status === 'approved' && feed.parsedEvent) {
      const existingIdx = events.findIndex(e => e.sourceFeedId === feed.id);
      const eventData = {
        id: `${feed.autoType}-${feed.id.slice(0, 8)}`,
        enabled: true,
        type: feed.autoType,
        title: (feed.title || feed.content.slice(0, 20)).replace(/#[^#\s]+#/g, '').replace(/\n/g, ' ').trim(),
        start: feed.parsedEvent.start,
        end: feed.parsedEvent.end,
        sourceFeedId: feed.id,
      };
      if (existingIdx >= 0) {
        // 更新已有事件
        events[existingIdx] = { ...events[existingIdx], ...eventData };
        console.log(`   🔄 更新事件: ${eventData.title} (${eventData.start.slice(0,10)} ~ ${eventData.end.slice(0,10)})`);
      } else {
        events.push(eventData);
        console.log(`   ✨ 创建事件: ${eventData.title} (${eventData.start.slice(0,10)} ~ ${eventData.end.slice(0,10)})`);
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
