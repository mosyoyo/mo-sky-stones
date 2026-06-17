const { buildCalendar, parseReminderOptions, parseTypes, readAssetJSON } = require('./_shared');

export async function onRequestGet(context) {
  const events = await readAssetJSON(context, '/data/events.json', []);
  const types = parseTypes(context.request.url);
  const reminderOpts = parseReminderOptions(context.request.url);
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
