// parseFeed.js — 解析公告内容，自动识别类型 + 提取时间 + 去重
// 核心：从正文提取时间，同一活动的多条动态合并为1个事件

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

// === 自动分类 ===

const TYPE_RULES = [
  {
    type: 'traveling_spirit',
    label: '旅行先祖',
    keywords: ['旅行先祖', '先祖到访', '先祖到临', '复刻', '先祖即将到访', '先祖即将到临', '先祖到临提醒'],
  },
  {
    type: 'season',
    label: '季节',
    keywords: ['季节开启', '季节结束', '新季节', '赛季', '季节即将', '季蜡'],
  },
  {
    type: 'activity',
    label: '活动',
    keywords: ['活动开启', '周年庆', '自然日', '音乐节', '花憩节', '彩染季', '端午节', '端午', '寻宝节', '星光奖', '致梵高', '龙舟'],
  },
  {
    type: 'bonus',
    label: '双倍活动',
    keywords: ['双倍蜡烛', '双倍爱心', '双倍季蜡', '额外烛火'],
  },
  {
    type: 'maintenance',
    label: '维护/更新',
    keywords: ['更新时间', '维护', '版本更新', '开服', '更新内容'],
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

// === 时间解析 ===

/**
 * 提取中文日期范围（从正文中提取）
 * 支持格式：
 *   - "6月19日00:00至6月26日23:59"
 *   - "6月19日 ~ 6月26日"
 *   - "6月19日~7月2日"  (正文中的波浪号/连字符)
 *   - "6月19日开启"
 *   - "本周四早上6:00至下周一中午12:00"
 *
 * 重要：时间信息通常在正文中而非标题，调用时务必传入完整 content
 */
function extractDateRange(text, now) {
  if (!now) now = new Date();
  const year = now.getFullYear();

  // 先去掉标题行（第一行通常是标题重复），只保留正文内容
  const lines = text.split('\n');
  const contentLines = lines.slice(1).join('\n') || text;

  // 模式1: X月X日XX:XX 至/~/— X月X日XX:XX（最精确的格式）
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
    const end = new Date(year, month - 1, day, 23, 59, 59);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  // 模式3: "本周X HH:MM 至 下周X HH:MM"（旅行先祖常见格式）
  const weekDayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };

  const pattern3full = /本周([一二三四五六日天])\s*(?:早上|上午)?\s*(\d{1,2}[:：]\d{2})?\s*至\s*下周([一二三四五六日天])\s*(?:中午|下午|晚上)?\s*(\d{1,2}[:：]\d{2})?/;
  const m3full = contentLines.match(pattern3full);

  if (m3full) {
    const startDow = weekDayMap[m3full[1]];
    const startTimeRaw = (m3full[2] || '06:00').replace('：', ':');
    const endDow = weekDayMap[m3full[3]];
    const endTimeRaw = (m3full[4] || '12:00').replace('：', ':');

    const [startH, startM] = startTimeRaw.split(':').map(Number);
    const [endH, endM] = endTimeRaw.split(':').map(Number);

    const currentDow = now.getDay();
    let daysToStart = startDow - currentDow;
    if (daysToStart < 0) daysToStart += 7;

    const startDate = new Date(now);
    startDate.setDate(now.getDate() + daysToStart);
    startDate.setHours(startH, startM, 0, 0);

    let daysToEnd = endDow - currentDow + 7;
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + daysToEnd);
    endDate.setHours(endH, endM, 0, 0);

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

    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 0, 0);

    return { start: startDate.toISOString(), end: endDate.toISOString() };
  }

  return null;
}

// === 去重逻辑 ===

/**
 * 判断两个事件是否是同一个活动（应该合并）
 * 规则：同一类型 + 时间范围有重叠
 */
function isSameActivity(ev1, ev2) {
  // 类型不同，肯定不是同一个活动
  if (ev1.type !== ev2.type) return false;

  // 旅行先祖：同一周只保留一个（按 start 日期判断是否同一周）
  if (ev1.type === 'traveling_spirit') {
    const s1 = new Date(ev1.start);
    const s2 = new Date(ev2.start);
    // 如果开始时间在同一天或相差不超过3天，认为是同一周先祖
    return Math.abs(s1 - s2) < 4 * 24 * 60 * 60 * 1000;
  }

  // 其他类型：时间范围有重叠就算同一个活动
  const s1 = new Date(ev1.start).getTime();
  const e1 = new Date(ev1.end).getTime();
  const s2 = new Date(ev2.start).getTime();
  const e2 = new Date(ev2.end).getTime();
  // 重叠条件：s1 < e2 && s2 < e1
  return s1 < e2 && s2 < e1;
}

/**
 * 从多个重复事件中选择最佳的一条
 * 优先级：
 * 1. 有更长时间范围的（活动持续时间长的说明信息更完整）
 * 2. 标题更有信息量的（含"更新内容"/"规则"等关键字的优先）
 * 3. 发布时间更晚的（更接近活动开始）
 */
function pickBestEvent(candidates) {
  if (candidates.length === 1) return candidates[0];

  // 计算每个事件的持续时间（小时）
  const withDuration = candidates.map(ev => {
    const dur = (new Date(ev.end) - new Date(ev.start)) / (1000 * 60 * 60);
    const titleScore = ev.title.length;
    // 含关键词的加分
    const bonusKeywords = ['更新内容', '规则', '详情', '公告', '内容公告'];
    const keywordBonus = bonusKeywords.some(kw => ev.title.includes(kw)) ? 1000 : 0;
    return { ev, dur, titleScore, keywordBonus };
  });

  // 排序：持续时间长的优先 > 关键词加分 > 标题长的优先 > 发布时间晚的优先
  withDuration.sort((a, b) => {
    // 优先选时间范围最完整的
    if (b.dur !== a.dur) return b.dur - a.dur;
    // 其次选有"更新内容"等关键词的
    if (b.keywordBonus !== a.keywordBonus) return b.keywordBonus - a.keywordBonus;
    // 再次选标题更有信息的
    if (b.titleScore !== a.titleScore) return b.titleScore - a.titleScore;
    // 最后选发布时间更晚的
    return (b.createTime || 0) - (a.createTime || 0);
  });

  return withDuration[0].ev;
}

/**
 * 合并去重事件列表
 */
function deduplicateEvents(rawEvents) {
  if (rawEvents.length === 0) return [];

  // 分组：同一类型的放一起
  const groups = [];
  const assigned = new Set();

  for (let i = 0; i < rawEvents.length; i++) {
    if (assigned.has(i)) continue;
    const group = [rawEvents[i]];
    assigned.add(i);

    for (let j = i + 1; j < rawEvents.length; j++) {
      if (assigned.has(j)) continue;
      if (isSameActivity(rawEvents[i], rawEvents[j])) {
        group.push(rawEvents[j]);
        assigned.add(j);
      }
    }

    groups.push(group);
  }

  // 每组选最佳
  const result = groups.map(group => {
    if (group.length === 1) return group[0];
    const best = pickBestEvent(group);
    // 记录合并了哪些源
    best.mergedFrom = group.map(g => g.sourceFeedId).filter(id => id !== best.sourceFeedId);
    return best;
  });

  const merged = rawEvents.length - result.length;
  if (merged > 0) {
    console.log(`   🔀 去重合并了 ${merged} 个重复事件`);
  }

  return result;
}

// === 主流程 ===

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

  // 阶段1：解析每条 feed，提取类型和时间
  for (const feed of feeds) {
    // 跳过已解析的（除非强制）
    if (feed.parsed && !forceReparsed) continue;

    // 自动分类
    feed.autoType = detectType(feed.content, feed.title, feed.topics);

    // 用公告发布时间作为基准时间来解析日期（更准确）
    const baseTime = feed.createTime ? new Date(feed.createTime) : new Date();

    // 从正文提取时间
    const dateRange = extractDateRange(feed.content, baseTime);
    if (dateRange && feed.autoType !== 'other') {
      feed.parsedEvent = dateRange;
    } else if (forceReparsed && !dateRange) {
      feed.parsedEvent = null;
    }

    feed.parsed = true;
    parsedCount++;

    if (feed.autoType === 'other') {
      skippedCount++;
    }
  }

  // 阶段1b：自动 approve——有明确类型且有时间的自动设为 approved
  let autoApproved = 0;
  for (const feed of feeds) {
    if (feed.status === 'pending' && feed.autoType && feed.autoType !== 'other' && feed.parsedEvent) {
      feed.status = 'approved';
      autoApproved++;
    } else if (feed.status === 'pending' && feed.autoType === 'other') {
      feed.status = 'ignored';
    }
  }
  if (autoApproved > 0) {
    console.log(`   ✅ 自动审核通过 ${autoApproved} 条（有类型+有时间）`);
  }

  // 阶段2：从 approved 且有时间的 feed 生成候选事件
  const candidateEvents = [];
  for (const feed of feeds) {
    if (feed.status === 'approved' && feed.parsedEvent) {
      candidateEvents.push({
        id: `${feed.autoType}-${feed.id.slice(0, 8)}`,
        enabled: true,
        type: feed.autoType,
        title: (feed.title || feed.content.slice(0, 20)).replace(/#[^#\s]+#/g, '').replace(/\n/g, ' ').trim(),
        start: feed.parsedEvent.start,
        end: feed.parsedEvent.end,
        sourceFeedId: feed.id,
        createTime: feed.createTime,
      });
    }
  }

  console.log(`   📋 候选事件 ${candidateEvents.length} 条（去重前）`);

  // 阶段3：去重
  const dedupedEvents = deduplicateEvents(candidateEvents);

  // 阶段4：与已有 events.json 合并
  // 策略：用去重后的事件列表替换整个 events.json
  // 保留已有事件中手动修改的 enabled 字段
  const oldEnabledMap = {};
  for (const oldEv of events) {
    oldEnabledMap[oldEv.sourceFeedId] = oldEv.enabled;
  }

  const finalEvents = dedupedEvents.map(ev => {
    // 如果之前有手动改过 enabled，保留
    if (ev.sourceFeedId in oldEnabledMap) {
      ev.enabled = oldEnabledMap[ev.sourceFeedId];
    }
    // 清理辅助字段
    delete ev.createTime;
    return ev;
  });

  writeJSON('feeds.json', feeds);
  writeJSON('events.json', finalEvents);

  console.log(`\n✅ 解析完成！已解析 ${parsedCount} 条，跳过 ${skippedCount} 条 (other)`);
  console.log(`   📊 最终事件 ${finalEvents.length} 条（去重后）`);
  return { parsedCount, skippedCount, eventCount: finalEvents.length };
}

if (require.main === module) {
  main();
}

module.exports = { detectType, extractDateRange, deduplicateEvents, main };
