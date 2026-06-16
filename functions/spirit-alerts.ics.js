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

function generateSpiritAlertsICS() {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mo-sky-stones//Sky:CoL Spirit Alert Test (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:光遇·旅行先祖测试-提醒',
    'X-WR-CALDESC:旅行先祖最小可用测试（开始和结束提醒）',
    'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VEVENT',
    'UID:traveling-spirit-20260618-start@mo-sky-stones',
    `DTSTAMP:${dtstamp}`,
    'DTSTART:20260617T220000Z',
    'DTEND:20260617T223000Z',
    `SUMMARY:${escapeICS('【旅行先祖】先祖开始')}`,
    `DESCRIPTION:${escapeICS('旅行先祖将在 6月18日 06:00 到临')}`,
    'LOCATION:旅行先祖',
    'CATEGORIES:游戏,光遇,旅行先祖',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'UID:traveling-spirit-20260618-start-alarm@mo-sky-stones',
    'X-WR-ALARMUID:traveling-spirit-20260618-start-alarm@mo-sky-stones',
    'TRIGGER;RELATED=START:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS('旅行先祖将在 10 分钟后开始')}`,
    'END:VALARM',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:traveling-spirit-20260622-end@mo-sky-stones',
    `DTSTAMP:${dtstamp}`,
    'DTSTART:20260622T030000Z',
    'DTEND:20260622T033000Z',
    `SUMMARY:${escapeICS('【旅行先祖】先祖即将离开')}`,
    `DESCRIPTION:${escapeICS('旅行先祖将在 6月22日 12:00 离开')}`,
    'LOCATION:旅行先祖',
    'CATEGORIES:游戏,光遇,旅行先祖',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'UID:traveling-spirit-20260622-end-alarm@mo-sky-stones',
    'X-WR-ALARMUID:traveling-spirit-20260622-end-alarm@mo-sky-stones',
    'TRIGGER;RELATED=START:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS('旅行先祖将在 1 小时后离开')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.map(foldLine).join(CRLF)}${CRLF}`;
}

export async function onRequestGet() {
  return new Response(generateSpiritAlertsICS(), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="spirit-alerts.ics"',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
