// /calendar.ics — 合并日历（红黑石 + 公告事件）
// CF Pages Function：用 fetch 读静态 JSON，ICS 生成逻辑内联（不依赖 fs/path）
// 格式与红石 ics-generator.js 完全一致：UTC 时间，CRLF 换行，含 VALARM

const { generateICS: generateStoneICS } = require('../ics-generator');

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

/**
 * ISO 时间 → UTC ICS 格式 (20260618T060000Z)
 * 与 ics-generator.js 的 formatICSDateTimeUTC 一致
 */
function toICSUTC(isoStr) {
  const d = new Date(isoStr);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function extractVEVENTS(icsStr) {
  const events = [];
  const blocks = icsStr.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const endIdx = blocks[i].indexOf('END:VEVENT');
    if (endIdx !== -1) {
      events.push('BEGIN:VEVENT' + blocks[i].slice(0, endIdx) + 'END:VEVENT');
    }
  }
  return events;
}

const CRLF = '\r\n';

export async function onRequestGet(context) {
  try {
    // 1. 红黑石事件（算法推算，不依赖 JSON）
    const redICS = generateStoneICS('red', 60, '光遇·红石(最后一场)');
    const blackICS = generateStoneICS('black', 60, '光遇·黑石(最后一场)');
    const redEvents = extractVEVENTS(redICS);
    const blackEvents = extractVEVENTS(blackICS);

    // 2. 公告事件（从静态 JSON 读取）
    let eventVEVENTS = [];
    try {
      const eventsRes = await context.env.ASSETS.fetch(new Request('https://placeholder/data/events.json'));
      if (eventsRes.ok) {
        const events = await eventsRes.json();
        const enabled = events.filter(e => e.enabled === true);
        const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        for (const ev of enabled) {
          const label = TYPE_LABELS[ev.type] || ev.type;
          const uid = ev.id + '@mo-sky-stones';
          const dtstart = toICSUTC(ev.start);
          const dtend = toICSUTC(ev.end);
          const cleanTitle = (ev.title || '').replace(/#[^#\s]+#/g, '').replace(/\n/g, ' ').trim();

          // 描述：与红石 ICS 格式一致，用 \n 分隔多行
          const descLines = [
            '类型: ' + label,
            '标题: ' + cleanTitle,
          ];
          const description = descLines.map(l => esc(l)).join('\\n');

          const lines = [
            'BEGIN:VEVENT',
            'UID:' + uid,
            'DTSTAMP:' + dtstamp,
            'DTSTART:' + dtstart,
            'DTEND:' + dtend,
            'SUMMARY:' + esc('【' + label + '】' + cleanTitle),
            'DESCRIPTION:' + description,
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
          ];
          eventVEVENTS.push(lines.join(CRLF));
        }
      }
    } catch (e) {
      // 读唔到 events.json 就跳过公告事件
    }

    // 3. 合并
    const allEvents = [...redEvents, ...blackEvents, ...eventVEVENTS];
    const calendarLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mo-sky-stones//Sky:CoL Calendar (CN)//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:光遇·日历',
      'X-WR-CALDESC:光遇国服红黑石+活动日历',
      'X-WR-TIMEZONE:Asia/Shanghai',
      ...allEvents,
      'END:VCALENDAR',
    ];

    return new Response(calendarLines.join(CRLF), {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="calendar.ics"',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response('Error generating calendar: ' + err.message, { status: 500 });
  }
}
