export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = url.searchParams.get('data') || '';
  let ics = '';
  try {
    ics = decodeURIComponent(raw);
  } catch (_) {
    ics = raw;
  }
  ics = ics.replace(/\r?\n/g, '\r\n').trim();
  if (!ics.startsWith('BEGIN:VCALENDAR')) {
    ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mo-sky-stones//Custom ICS Test//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:自定义ICS测试',
      ics,
      'END:VCALENDAR',
    ].join('\r\n');
  }
  if (!ics.endsWith('\r\n')) ics += '\r\n';
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="custom.ics"',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
