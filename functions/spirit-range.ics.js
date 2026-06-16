const CRLF = '\r\n';

function escapeICS(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line) {
  const bytes = new TextEncoder();
  const out = [];
  let current = '';

  for (const ch of Array.from(line)) {
    const next = current + ch;
    if (current && bytes.encode(next).length > 73) {
      out.push(current);
      current = ' ' + ch;
    } else {
      current = next;
    }
  }

  out.push(current);
  return out.join(CRLF);
}

function generateSpiritRangeICS() {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const title = '【旅行先祖】6月18日丨本周旅行先祖即将到临';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mo-sky-stones//Sky:CoL Spirit Range Test (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:光遇·旅行先祖测试-日期',
    'X-WR-CALDESC:旅行先祖最小可用测试（连续日期）',
    'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VEVENT',
    'UID:traveling-spirit-20260618-range@mo-sky-stones',
    `DTSTAMP:${dtstamp}`,
    'DTSTART;VALUE=DATE:20260618',
    'DTEND;VALUE=DATE:20260623',
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS('本周旅行先祖测试，时间: 6月18日 06:00 - 6月22日 12:00')}`,
    'LOCATION:旅行先祖',
    'CATEGORIES:游戏,光遇,旅行先祖',
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
}

export async function onRequestGet() {
  return new Response(generateSpiritRangeICS(), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="spirit-range.ics"',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
