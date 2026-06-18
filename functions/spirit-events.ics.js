const { generateEventsICS } = require('../src/event-utils');
const { publicEvent } = require('../src/event-overrides');
const { matchSpirit } = require('../src/spirit-match');
const { readAssetJSON } = require('./_shared');

export async function onRequestGet(context) {
  const rawEvents = await readAssetJSON(context, '/data/events.json', []);
  const saved = await readAssetJSON(context, '/data/spirit-subscriptions.json', { selected: [] });
  const selected = Array.isArray(saved.selected)
    ? saved.selected.map(name => String(name || '').trim()).filter(Boolean)
    : [];
  const events = rawEvents.filter(event => matchSpirit(event, selected)).map(publicEvent);
  const ics = generateEventsICS(events, {
    name: '光遇·指定先祖',
    description: '光遇指定复刻先祖提醒',
    types: ['traveling_spirit'],
    endOnly: new Set(),
  });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="spirit-events.ics"',
      'Cache-Control': 'public, max-age=900',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
