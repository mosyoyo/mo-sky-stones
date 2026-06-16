const CRLF = '\r\n';

function escapeICS(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function generateICS() {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//sky-stones-ics//Sky:CoL 旅行先祖 (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:光遇·旅行先祖(测试)',
    'X-WR-CALDESC:光遇国服旅行先祖测试（红石格式）',
    'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VEVENT',
    'UID:20260617T220000Z-遇境-旅行先祖-spirit-last@sky-stones-ics',
    `DTSTAMP:${dtstamp}`,
    'DTSTART:20260617T220000Z',
    'DTEND:20260617T230000Z',
    `SUMMARY:${escapeICS('【旅行先祖】遇境·复刻先祖')}`,
    `DESCRIPTION:${escapeICS('地图: 遇境\r\n 区域: 旅行先祖\r\n 时间: 06:00 - 07:00')}`,
    `LOCATION:${escapeICS('遇境 - 旅行先祖')}`,
    'CATEGORIES:游戏,光遇,旅行先祖',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'UID:20260617T220000Z-遇境-旅行先祖-spirit-last@sky-stones-ics-alarm',
    'X-WR-ALARMUID:20260617T220000Z-遇境-旅行先祖-spirit-last@sky-stones-ics-alarm',
    'TRIGGER;RELATED=START:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS('旅行先祖将在 10 分钟后开始')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join(CRLF);
}

export async function onRequestGet() {
  return new Response(generateICS(), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="spirit-redstyle.ics"',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
