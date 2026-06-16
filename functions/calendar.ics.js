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

/**
 * ISO 时间 → UTC ICS 格式 (20260618T060000Z)
 * 与 ics-generator.js 的 formatICSDateTimeUTC 一致
 */
function toICSUTC(isoStr) {
  const d = new Date(isoStr);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * ICS 文本转义（与 ics-generator.js 的 escapeICS 完全一致）
 */
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

function buildLines(lines) {
  return lines.map(foldLine).join(CRLF);
}

function foldBlock(block) {
  return String(block).split(/\r?\n/).map(foldLine).join(CRLF);
}

function joinCalendarParts(parts) {
  return parts.map(foldBlock).join(CRLF);
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
    const redEvents = extractVEVENTS(redICS).map(foldBlock);
    const blackEvents = extractVEVENTS(blackICS).map(foldBlock);

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
          const startDate = validDate(ev.start);
          const endDate = validDate(ev.end);
          if (!startDate || !endDate || endDate <= startDate) continue;

          const dtstart = toICSUTC(ev.start);
          const dtend = toICSUTC(ev.end);
          const cleanTitle = (ev.title || '').replace(/#[^#\s]+#/g, '').replace(/\n/g, ' ').trim();

          // 描述：与红石 ICS 完全一致——用字面量 \n（不行折叠）
          // 红石 ics-generator.js 的 DESCRIPTION 经过双重 escapeICS：
          //   第一层：每行 escapeICS → 第二层：整段再 escapeICS → \r\n 中的 \n 变成 \\n
          // 最终输出：CR + 字面量 \n + 空格，iOS 能正确识别
          // 这里直接用 \n 字面量连接，再整体 escapeICS，效果完全一致
          const descriptionLines = [
            '类型: ' + label,
            '标题: ' + cleanTitle,
          ];
          const description = escapeICS(descriptionLines.join('\n'));

          const lines = [
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
          ];
          eventVEVENTS.push(buildLines(lines));
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

    return new Response(joinCalendarParts(calendarLines), {
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
