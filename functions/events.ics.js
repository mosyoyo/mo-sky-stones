const { generateEventsICS } = require('../src/event-utils');
const { parseReminderOptions, parseTypes, readAssetJSON } = require('./_shared');

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
  // 清洗内部字段，避免泄漏到 ICS
  const events = rawEvents.map(cleanEvent);
  const types = new URL(context.request.url).searchParams.has('types') ? parseTypes(context.request.url) : EVENT_TYPES;
  const reminderOpts = parseReminderOptions(context.request.url);
  const ics = generateEventsICS(events, {
    name: '光遇·活动提醒',
    types,
    endOnly: reminderOpts.endOnly,
  });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="events.ics"',
      'Cache-Control': 'public, max-age=900',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
