// /events.ics — 纯公告事件日历（不含红黑石）

const { buildEventsICS } = require('../../src/scripts/buildEvents');

export async function onRequestGet() {
  try {
    const ics = buildEventsICS();
    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="events.ics"',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(`Error generating events: ${err.message}`, { status: 500 });
  }
}
