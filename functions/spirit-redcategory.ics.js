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
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//sky-stones-ics//Sky:CoL 红石 (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:光遇·红石(旅行先祖测试)',
    'X-WR-CALDESC:光遇国服红石格式旅行先祖测试',
    'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VEVENT',
    'UID:20260617T220000Z-雨林-大树屋-red-last@sky-stones-ics',
    `DTSTAMP:${dtstamp}`,
    'DTSTART:20260617T220000Z',
    'DTEND:20260617T230000Z',
    `SUMMARY:${escapeICS('【红石】旅行先祖·测试')}`,
    `DESCRIPTION:${escapeICS('地图: 雨林\r\n 区域: 大树屋\r\n 时间: 06:00 - 07:00')}`,
    `LOCATION:${escapeICS('雨林 - 大树屋')}`,
    'CATEGORIES:游戏,光遇,红石',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'UID:20260617T220000Z-雨林-大树屋-red-last@sky-stones-ics-alarm-test',
    'X-WR-ALARMUID:20260617T220000Z-雨林-大树屋-red-last@sky-stones-ics-alarm-test',
    'TRIGGER;RELATED=START:-PT10M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS('测试将在 10 分钟后开始')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join(CRLF);
}

export async function onRequestGet() {
  return new Response(generateICS(), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="spirit-redcategory.ics"',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
