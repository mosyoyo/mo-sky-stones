// /calendar.ics — 合并日历（红黑石 + 公告事件）

const { buildCalendarICS } = require('../../src/scripts/buildEvents');

export async function onRequestGet() {
  try {
    const ics = buildCalendarICS();
    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="calendar.ics"',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(`Error generating calendar: ${err.message}`, { status: 500 });
  }
}
