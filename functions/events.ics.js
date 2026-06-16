// /events.ics — 纯公告事件日历（不含红黑石）
// CF Pages Function：用 fetch 读静态 JSON，ICS 生成逻辑内联（不依赖 fs/path）

const TYPE_LABELS = {
  traveling_spirit: '旅行先祖',
  season: '季节',
  activity: '活动',
  bonus: '双倍活动',
  maintenance: '维护更新',
  other: '其他',
};

function esc(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function toICSLocalDateTime(isoStr) {
  const d = new Date(isoStr);
  const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bj.getUTCDate()).padStart(2, '0');
  const h = String(bj.getUTCHours()).padStart(2, '0');
  const min = String(bj.getUTCMinutes()).padStart(2, '0');
  const s = String(bj.getUTCSeconds()).padStart(2, '0');
  return y + m + day + 'T' + h + min + s;
}

const CRLF = '\r\n';

export async function onRequestGet(context) {
  try {
    // 从静态 JSON 读取事件
    let enabled = [];
    try {
      const eventsRes = await context.env.ASSETS.fetch(new Request('https://placeholder/data/events.json'));
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        enabled = events.filter(e => e.enabled === true);
      }
    } catch (e) {
      // 读唔到就返回空日历
    }

    const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mo-sky-stones//Sky:CoL Events (CN)//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:光遇·活动',
      'X-WR-CALDESC:光遇国服活动日历',
      'X-WR-TIMEZONE:Asia/Shanghai',
    ];

    for (const ev of enabled) {
      const label = TYPE_LABELS[ev.type] || ev.type;
      const uid = ev.id + '@mo-sky-stones';
      const start = toICSLocalDateTime(ev.start);
      const end = toICSLocalDateTime(ev.end);
      const cleanTitle = (ev.title || '').replace(/#[^#\s]+#/g, '').replace(/\n/g, ' ').trim();

      lines.push(
        'BEGIN:VEVENT',
        'UID:' + uid,
        'DTSTAMP:' + dtstamp,
        'DTSTART;TZID=Asia/Shanghai:' + start,
        'DTEND;TZID=Asia/Shanghai:' + end,
        'SUMMARY:' + esc('【' + label + '】' + cleanTitle),
        'DESCRIPTION:' + esc('类型:' + label + '\\n标题:' + cleanTitle),
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'BEGIN:VALARM',
        'UID:' + uid + '-alarm',
        'X-WR-ALARMUID:' + uid + '-alarm',
        'TRIGGER;RELATED=START:-PT15M',
        'ACTION:DISPLAY',
        'DESCRIPTION:' + esc(label + '将在 15 分钟后开始'),
        'END:VALARM',
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');

    return new Response(lines.join(CRLF), {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="events.ics"',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response('Error generating events: ' + err.message, { status: 500 });
  }
}
