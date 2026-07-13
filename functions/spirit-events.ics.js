const { generateSpiritEventsICS } = require('../src/event-utils');
const { publicEvent } = require('../src/event-overrides');
const { matchSpirit } = require('../src/spirit-match');
const { parseSelectedSpirits } = require('../src/spirit-query');
const { createIcsResponse, handleIcsRequest } = require('./_ics-response');
const { readAssetJSON } = require('./_shared');

export async function onRequestGet(context) {
  const rawEvents = await readAssetJSON(context, '/data/events.json', []);
  const soulData = await readAssetJSON(context, '/data/soul-spirits.json', { spirits: [] });
  const saved = await readAssetJSON(context, '/data/spirit-subscriptions.json', { selected: [] });
  const selected = parseSelectedSpirits(context.request.url, saved);
  const events = rawEvents.filter(event => matchSpirit(event, selected)).map(publicEvent);
  const spiritInfo = new Map((Array.isArray(soulData.spirits) ? soulData.spirits : [])
    .map(item => [String(item.spiritName || '').trim(), item]));
  const ics = generateSpiritEventsICS(events, {
    name: '光遇·指定先祖',
    selected,
    spiritInfo,
  });
  return createIcsResponse(context.request, ics, 'spirit-events.ics');
}

export async function onRequest(context) {
  return handleIcsRequest(context, onRequestGet);
}
