const { appendSyncLog, readJSON, writeJSON } = require('./common');

// 数据源偏好（与 admin 设置页保持一致）
// 6 类事件各自选择 netease 或 wiki 数据源
const DEFAULT_SOURCE_CONFIG = {
  traveling_spirit: 'wiki',
  season:           'wiki',
  activity:         'wiki',
  bonus:            'netease',
  candle_heap:      'netease',
  maintenance:      'netease',
};

// 过滤「国际服」相关事件（user 决策 6/17 晚：只关心国服）
// 触发条件：title / wikiUrl / description / _names 等任一字段含「国际服」三字
// 范围：合并层兜底过滤（fetchWikiEvents 已经做了一层过滤，这里再保一道）
// 涵盖：国际服复刻 / 国际服集体复刻 / 国际服季节 / 国际服活动 等所有变体
function isInternational(e) {
  // 检查所有可能含"国际服"字眼的字段（防御性）
  // 场景：title / wikiUrl / _names / _raw / description 等
  const fields = [e.title, e.wikiUrl, e.description, ...(e._names || [])];
  for (const f of fields) {
    if (typeof f === 'string' && f.includes('国际服')) return true;
  }
  return false;
}

// 合并策略：
// 1. 按 type 在 source-config 找数据源
// 2. 从该数据源取所有该 type 的事件
// 3. 用 (type, start) 作 dedup key（同一天两个数据源都有的事件 → 优先 wiki）
// 4. 输出到 events.json（覆写）
function merge() {
  const neteaseEvents = readJSON('events-netease.json', []);
  const wikiEvents    = readJSON('events-wiki.json',   { events: [] });
  const wikiEventsArr = Array.isArray(wikiEvents) ? wikiEvents : (wikiEvents.events || []);

  let config = readJSON('source-config.json', null);
  if (!config) {
    config = DEFAULT_SOURCE_CONFIG;
    writeJSON('source-config.json', config);
  }

  // 按 type 分组两边事件
  const byType = (events) => {
    const m = new Map();
    for (const e of events) {
      if (!m.has(e.type)) m.set(e.type, []);
      m.get(e.type).push(e);
    }
    return m;
  };
  const neByType = byType(neteaseEvents);
  const wkByType = byType(wikiEventsArr);

  const result = [];
  const seen = new Set();  // dedup key = `${type}|${startDate}`

  // 1) 先按 config 顺序加首选数据源
  const typeOrder = Object.keys(DEFAULT_SOURCE_CONFIG);
  for (const type of typeOrder) {
    const source = config[type] || DEFAULT_SOURCE_CONFIG[type];
    const sourceList = source === 'wiki' ? (wkByType.get(type) || []) : (neByType.get(type) || []);

    for (const e of sourceList) {
      if (e.enabled === false) continue;
      if (isInternational(e)) continue;  // 防御性兜底：去掉国际服事件
      const startKey = (e.start || '').slice(0, 10);  // YYYY-MM-DD
      const key = `${type}|${startKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // 标记 source 字段；wiki 事件没有 enabled 字段，补 true（ICS 过滤要 enabled === true）
      result.push({ enabled: true, ...e, _source: source });
    }
  }

  // 2) 兜底：另一数据源有但首选源没有的，按 wiki > netease 优先级补
  //    防止 wiki 抓不到时网易大神的同 type 事件被吃掉
  for (const type of typeOrder) {
    const source = config[type] || DEFAULT_SOURCE_CONFIG[type];
    const fallbackList = source === 'wiki' ? (neByType.get(type) || []) : (wkByType.get(type) || []);
    for (const e of fallbackList) {
      if (e.enabled === false) continue;
      if (isInternational(e)) continue;  // 防御性兜底：去掉国际服事件
      const startKey = (e.start || '').slice(0, 10);
      const key = `${type}|${startKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ enabled: true, ...e, _source: source === 'wiki' ? 'netease' : 'wiki' });
    }
  }

  return { result, config };
}

function main() {
  try {
    console.log('🔀 开始合并双数据源...');
    const { result, config } = merge();
    writeJSON('events.json', result);

    // 统计
    const byType = {};
    const bySource = { netease: 0, wiki: 0 };
    for (const e of result) {
      byType[e.type] = (byType[e.type] || 0) + 1;
      bySource[e._source] = (bySource[e._source] || 0) + 1;
    }

    console.log(`✅ 合并完成: 共 ${result.length} 条事件`);
    console.log('  按类型:', JSON.stringify(byType));
    console.log('  按数据源:', JSON.stringify(bySource));
    console.log('  配置:', JSON.stringify(config));

    appendSyncLog({
      message: `合并完成: ${result.length} 条（netease ${bySource.netease} + wiki ${bySource.wiki}），按 type: ${JSON.stringify(byType)}`,
      source: 'merge',
    });
  } catch (err) {
    appendSyncLog({ message: `合并失败: ${err.message}`, source: 'merge', error: err.message });
    console.error('❌ Merge failed:', err.message);
    process.exit(1);
  }
}

main();
