const { generateEventsICS } = require('../src/event-utils');
const { publicEvent } = require('../src/event-overrides');
const { matchSpirit } = require('../src/spirit-match');
const { parseSelectedSpirits } = require('../src/spirit-query');
const { handleIcsRequest } = require('./_ics-response');
const { readAssetJSON } = require('./_shared');

export async function onRequestGet(context) {
  const rawEvents = await readAssetJSON(context, '/data/events.json', []);
  const saved = await readAssetJSON(context, '/data/spirit-subscriptions.json', { selected: [] });
  const selected = parseSelectedSpirits(context.request.url, saved);
  const events = rawEvents.filter(event => matchSpirit(event, selected)).map(publicEvent);
  const ics = generateEventsICS(events, {
    name: '光遇·指定先祖',
    description: selected.length ? `光遇指定复刻先祖提醒：${selected.join('、')}` : '光遇指定复刻先祖提醒',
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
  return handleIcsRequest(context, onRequestGet);
}
