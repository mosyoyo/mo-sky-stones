const { buildCalendar, parseReminderOptions, parseTypes, readAssetJSON } = require('./_shared');

// 排除 _source/_group/_names 等内部字段，只保留真正的事件属性
function cleanEvent(e) {
  const { _source, _group, _names, ...rest } = e;
  return rest;
}

export async function onRequestGet(context) {
  const rawEvents = await readAssetJSON(context, '/data/events.json', []);
  // 清洗内部字段，避免泄漏到 ICS
  const events = rawEvents.map(cleanEvent);
  const url = new URL(context.request.url);
  const types = parseTypes(context.request.url);
  const reminderOpts = parseReminderOptions(context.request.url);
  if (!url.searchParams.has('types') && !url.searchParams.has('endOnly')) {
    ['traveling_spirit', 'season', 'activity'].forEach(type => reminderOpts.endOnly.add(type));
  }
  const ics = buildCalendar(events, types, { reminderOpts });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="calendar.ics"',
      'Cache-Control': 'public, max-age=900',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
