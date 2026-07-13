const { generateEventsICS } = require('../src/event-utils');
const { parseReminderOptions, parseTypes, readAssetJSON } = require('./_shared');
const { createIcsResponse, handleIcsRequest } = require('./_ics-response');

// 默认包含 6 类事件（按 source-config 默认配置：traveling_spirit/season/activity 走 wiki，
// bonus/candle_heap/maintenance 固定走 netease，合并后 events.json 全包含）
const EVENT_TYPES = ['traveling_spirit', 'season', 'activity', 'bonus', 'candle_heap', 'maintenance'];

// 排除 _source/_group/_names 等内部字段，只保留真正的事件属性
function cleanEvent(e) {
  const { _source, _group, _names, ...rest } = e;
  return rest;
}

export async function onRequestGet(context) {
  const rawEvents = await readAssetJSON(context, '/data/events.json', []);
  const soulData = await readAssetJSON(context, '/data/soul-spirits.json', { spirits: [] });
  // 清洗内部字段，避免泄漏到 ICS
  const events = rawEvents.map(cleanEvent);
  const types = new URL(context.request.url).searchParams.has('types') ? parseTypes(context.request.url) : EVENT_TYPES;
  const reminderOpts = parseReminderOptions(context.request.url);
  const spiritInfo = new Map((Array.isArray(soulData.spirits) ? soulData.spirits : [])
    .map(item => [String(item.spiritName || '').trim(), item]));
  const ics = generateEventsICS(events, {
    name: '光遇·活动提醒',
    types,
    endOnly: reminderOpts.endOnly,
    spiritInfo,
  });
  return createIcsResponse(context.request, ics, 'events.ics');
}

export async function onRequest(context) {
  return handleIcsRequest(context, onRequestGet);
}
