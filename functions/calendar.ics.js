const { buildCalendar, parseReminderOptions, parseTypes, readAssetJSON } = require('./_shared');
const { createIcsResponse, handleIcsRequest } = require('./_ics-response');
const { publicEvent } = require('../src/event-overrides');

export async function onRequestGet(context) {
  const rawEvents = await readAssetJSON(context, '/data/events.json', []);
  const soulData = await readAssetJSON(context, '/data/soul-spirits.json', { spirits: [] });
  // 清洗内部字段，避免泄漏到 ICS
  const events = rawEvents.map(publicEvent);
  const url = new URL(context.request.url);
  const types = parseTypes(context.request.url);
  const reminderOpts = parseReminderOptions(context.request.url);
  if (!url.searchParams.has('types') && !url.searchParams.has('endOnly')) {
    ['traveling_spirit', 'season', 'activity'].forEach(type => reminderOpts.endOnly.add(type));
  }
  const spiritInfo = new Map((Array.isArray(soulData.spirits) ? soulData.spirits : [])
    .map(item => [String(item.spiritName || '').trim(), item]));
  const ics = buildCalendar(events, types, { reminderOpts, url: context.request.url, spiritInfo });
  return createIcsResponse(context.request, ics, 'calendar.ics');
}

export async function onRequest(context) {
  return handleIcsRequest(context, onRequestGet);
}
