// /events.ics — 纯公告事件日历（不含红黑石）
// CF Pages Function：用 fetch 读静态 JSON，ICS 生成逻辑内联（不依赖 fs/path）
// 格式与红石 ics-generator.js 完全一致：UTC 时间，CRLF 换行，含 VALARM

const TYPE_LABELS = {
  traveling_spirit: '旅行先祖',
  season: '季节',
  activity: '活动',
  bonus: '双倍活动',
  maintenance: '维护更新',
  other: '其他',
};

/**
 * ICS 文本转义（与 ics-generator.js 的 escapeICS 完全一致）
 */
function escapeICS(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * ISO 时间 → UTC ICS 格式 (20260618T060000Z)
 */
function toICSUTC(isoStr) {
  const d = new Date(isoStr);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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
      const dtstart = toICSUTC(ev.start);
      const dtend = toICSUTC(ev.end);
      const cleanTitle = (ev.title || '').replace(/#[^#\s]+#/g, '').replace(/\n/g, ' ').trim();

      // 描述：与红石 ICS 完全一致——用字面量 \n（不行折叠）
      // 红石 ics-generator.js 双重 escapeICS 产生 CR + 字面量 \n + 空格
      // 这里直接用 \n 连接再整体 escapeICS，效果一致
      const descriptionLines = [
        '类型: ' + label,
        '标题: ' + cleanTitle,
      ];
      const description = escapeICS(descriptionLines.join('\n'));

      lines.push(
        'BEGIN:VEVENT',
        'UID:' + uid,
        'DTSTAMP:' + dtstamp,
        'DTSTART:' + dtstart,
        'DTEND:' + dtend,
        'SUMMARY:' + escapeICS('【' + label + '】' + cleanTitle),
        'DESCRIPTION:' + description,
        'LOCATION:' + escapeICS(label),
        'CATEGORIES:游戏,光遇,' + label,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'BEGIN:VALARM',
        'UID:' + uid + '-alarm',
        'X-WR-ALARMUID:' + uid + '-alarm',
        'TRIGGER;RELATED=START:-PT10M',
        'ACTION:DISPLAY',
        'DESCRIPTION:' + escapeICS(label + '将在 10 分钟后开始'),
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
