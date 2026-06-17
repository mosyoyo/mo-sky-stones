const { generateEventsICS } = require('../src/event-utils');
const { parseReminderOptions, parseTypes, readAssetJSON } = require('./_shared');

const EVENT_TYPES = ['traveling_spirit', 'season', 'activity', 'bonus', 'maintenance'];

export async function onRequestGet(context) {
  const events = await readAssetJSON(context, '/data/events.json', []);
  const types = new URL(context.request.url).searchParams.has('types') ? parseTypes(context.request.url) : EVENT_TYPES;
  const reminderOpts = parseReminderOptions(context.request.url);
  const ics = generateEventsICS(events, {
    name: '光遇·活动提醒',
    types,
    endOnly: reminderOpts.endOnly,
    allDay: reminderOpts.allDay,
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
