const {
  cleanEventTitle,
  detectType,
  extractBonusDateRange,
  extractBonusLabel,
  extractCandleHeapDateRange,
  extractDateRange,
  extractTravelingSpiritLabel,
  isLikelyGameActivity,
  isOfflineEvent,
  isTravelingSpiritUpcoming,
  normalizeFeed,
  uidPart,
} = require('../event-utils');
const { shouldKeepFeedEvent } = require('../feed-events');
const { appendSyncLog, readJSON, writeJSON } = require('./common');

const TYPE_TITLE_PREFIX = {
  traveling_spirit: '【复刻】',
  season: '【季节】',
  activity: '【活动】',
  bonus: '【双倍】',
  candle_heap: '【大蜡烛】',
  maintenance: '【维护】',
};

const NETEASE_KEEP_TYPES = new Set(['activity', 'bonus', 'candle_heap', 'maintenance']);
const BONUS_KEYWORDS = [
  '双倍爱心', '双倍心火', '双倍烛火', '双倍季蜡', '双倍蜡烛', '额外烛火',
  '收获双倍爱心', '收获双倍心火', '收获双倍烛火', '收获双倍季蜡', '收获双倍蜡烛',
  '收获一份双倍爱心', '收获一份双倍心火', '收获一份双倍烛火',
];
const CANDLE_KEYWORDS = ['大蜡烛堆将出现在天空王国各地', '大蜡烛堆'];

function shouldAutoIgnoreParsedFeed(feed) {
  return feed?.status === 'pending' && feed?.parsedResult?.type === 'other';
}

function shouldKeepNeteaseEventType(type) {
  return NETEASE_KEEP_TYPES.has(type);
}

function parseFeed(feed) {
  return parseFeedVariants(feed)[0] || {
    type: 'other',
    title: '',
    start: '',
    end: '',
  };
}

function hasAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function buildParsed(feed, type, range) {
  const spiritLabel = type === 'traveling_spirit'
    ? extractTravelingSpiritLabel(`${feed.title || ''}\n${feed.content || ''}`)
    : '';
  const bonusLabel = type === 'bonus'
    ? extractBonusLabel(`${feed.title || ''}\n${feed.content || ''}`)
    : '';
  const prefix = TYPE_TITLE_PREFIX[type] || '';
  const title = cleanEventTitle(feed.title, feed.content, type);
  const baseTitle = spiritLabel
    ? `${prefix}${spiritLabel}`
    : bonusLabel
      ? `${prefix}${bonusLabel}`
      : (title && prefix ? `${prefix}${title.replace(/^[《【].+?[》】]\s*/, '')}` : title);
  return {
    type,
    title: baseTitle,
    start: range ? range.start : '',
    end: range ? range.end : '',
  };
}

function pushUnique(variants, parsed) {
  if (!parsed || !parsed.type || !parsed.start || !parsed.end) return;
  if (variants.some(item => item.type === parsed.type && item.start === parsed.start && item.end === parsed.end)) return;
  variants.push(parsed);
}

function parseFeedVariants(feed) {
  const title = feed.title || '';
  const content = feed.content || '';
  const text = `${title}\n${content}`;
  const baseTime = Number(feed.createTime || 0) > 0 ? new Date(Number(feed.createTime)) : new Date();
  const variants = [];
  const isOffline = isOfflineEvent(title, content);

  if (hasAny(text, CANDLE_KEYWORDS)) {
    const range = extractCandleHeapDateRange(title, content, baseTime);
    if (range && range.start && range.end) {
      pushUnique(variants, buildParsed(feed, 'candle_heap', range));
    }
  }

  if (hasAny(text, BONUS_KEYWORDS)) {
    const range = extractBonusDateRange(title, content, baseTime);
    if (range && range.start && range.end) {
      pushUnique(variants, buildParsed(feed, 'bonus', range));
    }
  }

  if (isOffline) {
    return variants;
  }

  let type = detectType(title, content);
  if (!NETEASE_KEEP_TYPES.has(type)) {
    type = 'other';
  }

  const range = type === 'bonus'
    ? extractBonusDateRange(title, content, baseTime)
    : type === 'candle_heap'
      ? extractCandleHeapDateRange(title, content, baseTime)
      : extractDateRange(title, content, baseTime);

  const LONG_EVENT_TYPES = new Set(['traveling_spirit', 'activity', 'season', 'candle_heap']);
  if (type === 'activity' && range && !isLikelyGameActivity(range)) {
    type = 'other';
  } else if (type === 'traveling_spirit' && !isTravelingSpiritUpcoming(title, content)) {
    type = 'other';
  } else if (LONG_EVENT_TYPES.has(type) && type !== 'bonus' && range && range.start && range.end) {
    const durationMs = new Date(range.end) - new Date(range.start);
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (durationMs < oneDayMs) {
      type = 'other';
    }
  }

  if (type !== 'other' && range && range.start && range.end) {
    pushUnique(variants, buildParsed(feed, type, range));
  }

  return variants;
}

function eventFromFeed(feed, parsed) {
  return {
    id: `${parsed.type}-${uidPart(parsed.sourceFeedId || feed.id)}`,
    enabled: feed.status === 'approved',
    type: parsed.type,
    title: parsed.title || feed.title || parsed.type,
    start: parsed.start,
    end: parsed.end,
    sourceFeedId: parsed.sourceFeedId || feed.id,
  };
}

function main() {
  const feeds = readJSON('feeds.json', []);
  // 读 events-netease.json（网易大神事件现状）作为基线。
  // 旧版读 events.json 会把 wiki 事件当 netease 现状污染了 id 命名空间。
  // 兼容：events-netease.json 不存在时回退到 events.json
  let events = readJSON('events-netease.json', null);
  if (events === null) events = readJSON('events.json', []);
  const eventMap = new Map(events.map(event => [event.sourceFeedId || event.id, event]));
  const parsedFeeds = [];
  let parsedCount = 0;
  let droppedCount = 0;
  let autoApprovedCount = 0;

  for (const feed of feeds) {
    if (feed.raw) {
      const normalized = normalizeFeed(feed.raw);
      feed.title = normalized.title;
      feed.content = normalized.content;
    }
    const parsedList = parseFeedVariants(feed);
    for (const key of [...eventMap.keys()]) {
      if (key === feed.id || key.startsWith(`${feed.id}::`)) eventMap.delete(key);
    }
    if (!parsedList.length) {
      droppedCount++;
      continue;
    }
    feed.autoType = parsedList[0].type;
    feed.parsed = true;
    feed.parsedResult = parsedList[0];
    feed.parsedResults = parsedList;
    parsedFeeds.push(feed);

    for (const [index, parsed] of parsedList.entries()) {
      if (!shouldKeepFeedEvent(feed, parsed)) continue;
      const sourceFeedId = index === 0 ? feed.id : `${feed.id}::${parsed.type}`;
      const parsedWithSource = { ...parsed, sourceFeedId };
      const existing = eventMap.get(sourceFeedId);
      if (existing) {
        Object.assign(existing, {
          type: parsed.type,
          title: parsed.title || existing.title,
          start: parsed.start,
          end: parsed.end,
        });
      } else {
        eventMap.set(sourceFeedId, eventFromFeed(feed, parsedWithSource));
        parsedCount++;
      }
    }
  }

  // === 自动过审规则 ===
  // 通过：feed.status 改 approved + events.json 写入
  //   - 大蜡烛 / 双倍 / 复刻：游戏内固定周期事件
  //   - 维护：仅「纯 更新时间公告」+ 排除所有变种（补偿/延迟/特刊/AR/活动/投票/联动/纪念品/向导 等）
  // 不通过（保持 pending）：活动 / 季节 / 维护变种
  // 关键词检测：先查标题（必查），再查 content 整词匹配（避免「更新内容」「更新结束」误中）
  const MAINTENANCE_SKIP_KEYWORDS = [
    '维护补偿', '延迟开服', '推迟', '王国特刊', 'AR功能',
    '运营活动', '更新内容公告', '纪念品', '向导', '开服',
    // 用户新增
    '投票', '联动', '舞台', '签售', '见面会', '漫展', '票务',
    '创作激励', '成果展示', '纪录片', '发布会回顾',
  ];
  for (const feed of parsedFeeds) {
    if (feed.status !== 'pending' || !feed.parsedResults?.length) continue;
    const title = feed.title || '';
    const content = feed.content || '';
    let approvedAny = false;
    for (const p of feed.parsedResults) {
      if (p.type === 'other' || !p.start || !p.end) continue;
      let shouldApprove = false;
      if (p.type === 'candle_heap' || p.type === 'bonus' || p.type === 'traveling_spirit') {
        if (p.type === 'traveling_spirit' && !isTravelingSpiritUpcoming(title, content)) continue;
        shouldApprove = true;
      } else if (p.type === 'maintenance') {
        const hasSkip = MAINTENANCE_SKIP_KEYWORDS.some(k => {
          if (title.includes(k)) return true;
          return k.length >= 4 && content.includes(k);
        });
        const isPure = title.includes('更新时间公告') && !hasSkip;
        if (isPure) shouldApprove = true;
      }
      if (!shouldApprove) continue;
      feed.status = 'approved';
      const key = p.type === 'candle_heap' ? `${feed.id}::candle_heap`
        : p.type === 'bonus' ? `${feed.id}::bonus`
        : feed.id;
      const existing = eventMap.get(key);
      const parsedWithSource = { ...p, sourceFeedId: key };
      if (existing) {
        existing.enabled = true;
        existing.type = p.type;
        existing.title = p.title || existing.title;
        existing.start = p.start;
        existing.end = p.end;
      } else {
        eventMap.set(key, eventFromFeed(feed, parsedWithSource));
      }
      approvedAny = true;
      autoApprovedCount++;
    }
  }

  // 复刻先祖按时间窗口去重：同一时间窗口内只保留最早那条
  const allEvents = [...eventMap.values()];
  const spiritEvents = allEvents.filter(e => e.type === 'traveling_spirit' && e.start);
  const spiritByBucket = new Map();
  for (const ev of spiritEvents) {
    const bucket = Math.floor(new Date(ev.start).getTime() / (10 * 24 * 60 * 60 * 1000));
    if (!spiritByBucket.has(bucket)) spiritByBucket.set(bucket, []);
    spiritByBucket.get(bucket).push(ev);
  }
  const keptIds = new Set();
  for (const [, group] of spiritByBucket) {
    if (group.length === 1) {
      keptIds.add(group[0].id);
    } else {
      group.sort((a, b) => new Date(a.start) - new Date(b.start));
      keptIds.add(group[0].id);
    }
  }
  const finalEvents = allEvents.filter(e => e.type !== 'traveling_spirit' || keptIds.has(e.id));

  const neteaseEvents = finalEvents.filter(e => shouldKeepNeteaseEventType(e.type));

  // 清理已过期 enabled 事件（end < 现在）—— ICS 唔再显示，iOS 也不会堆积历史
  const now = Date.now();
  let droppedExpired = 0;
  for (const e of finalEvents) {
    if (e.enabled && e.end && new Date(e.end).getTime() < now) {
      e.enabled = false;
      droppedExpired++;
    }
  }

  // === 反向校验：events.json 里 enabled=true 但对应 feed 已被判 other → 关掉 ===
  // 原因：历史上可能手动 enabled 过，但现在解析规则发现呢条系线下/单日/已结束
  let droppedFromEvents = 0;
  for (const feed of parsedFeeds) {
    const ev = eventMap.get(feed.id);
    if (!ev || !ev.enabled) continue;
    const p = feed.parsedResult;
    if (!p) continue;
    if (p.type === 'other' || !p.start || !p.end) {
      ev.enabled = false;
      droppedFromEvents++;
    }
  }

  // === 全局「不感兴趣」关键词 → 直接 status=ignored，从公告页消失 ===
  // 适用范围：所有 feed（不限于哪种 autoType）
  // 用户明确说「直接过滤掉」的类型：投票、运营活动、联动、舞台演出、签售、漫展、票务
  //                  + 成果展示、纪录片、发布会回顾、创作激励 等线下内容
  //                  + 季节/活动类「更新内容公告」（伴生维护公告，但主体是活动）
  //                  + 维护变种公告：补偿、延迟、AR、纪念品、向导
  //                  + 复刻已到临提醒（6月11日 旅行先祖到临提醒之类）
  //                  + detectType 错判为 maintenance 的季节内容：迁徙季/七夕/彩染季
  // 注：季节公告（季节开启提醒、季节倒计时）保留 pending 让人工看
  const GLOBAL_IGNORE_KEYWORDS = [
    '投票', '运营活动', '运营活动公告', '联动', '舞台', '签售', '见面会', '漫展', '票务',
    '成果展示', '纪录片', '发布会回顾', '创作激励', '王国特刊',
    '更新内容公告',  // 季节/活动类伴生维护公告（不是纯 更新时间公告）
    '维护补偿', '延迟开服', 'AR功能', '纪念品', '向导',  // 维护变种
    '到临提醒', '到临啦', '重返天空王国',  // 复刻已到临
    // detectType 错判为 maintenance 的季节公告
    '迁徙季旅途', '七夕', '彩染季', '云巢染色工坊', '奇妙之旅', '迁徙季',
    '维护后正式开启', '维护后开启', '更新维护后',
  ];
  let ignoredByKeyword = 0;
  for (const feed of parsedFeeds) {
    if (feed.status !== 'pending') continue;
    const t = feed.title || '';
    if (GLOBAL_IGNORE_KEYWORDS.some(k => t.includes(k))) {
      feed.status = 'ignored';
      ignoredByKeyword++;
    }
  }

  let ignoredOther = 0;
  for (const feed of parsedFeeds) {
    if (!shouldAutoIgnoreParsedFeed(feed)) continue;
    feed.status = 'ignored';
    ignoredOther++;
  }

  writeJSON('feeds.json', parsedFeeds);
  // events-netease.json：只保留锁定类型（双倍/大蜡烛/维护），供 mergeEvents.js 使用
  // 其他类型不写入，避免 mergeEvents 兜底时混入
  writeJSON('events-netease.json', neteaseEvents);
  // events.json 不再这里写——syncEvents.js 跑完 parseFeed 后会跑 mergeEvents，
  // mergeEvents 才是 events.json 的最终写者（按 source-config.json 合并 netease + wiki）
  appendSyncLog({
    message: `解析公告 ${parsedFeeds.length} 条，过滤无时间 ${droppedCount} 条，自动过审 ${autoApprovedCount} 条，反查关闭 ${droppedFromEvents} 条，清理过期 ${droppedExpired} 条，关键词忽略 ${ignoredByKeyword} 条，其他忽略 ${ignoredOther} 条（events-netease.json 全量 ${neteaseEvents.length} 条，待 merge）`,
    addedEvents: parsedCount,
    autoApproved: autoApprovedCount,
    droppedFromEvents,
    droppedExpired,
    ignoredByKeyword,
    ignoredOther,
  });
  console.log(`parsed feeds: ${parsedFeeds.length}, dropped: ${droppedCount}, new events: ${parsedCount}, autoApproved: ${autoApprovedCount}, droppedFromEvents: ${droppedFromEvents}, droppedExpired: ${droppedExpired}, ignoredByKeyword: ${ignoredByKeyword}, ignoredOther: ${ignoredOther}`);
}

if (require.main === module) main();

module.exports = { eventFromFeed, main, parseFeed, parseFeedVariants, shouldAutoIgnoreParsedFeed, shouldKeepNeteaseEventType };
