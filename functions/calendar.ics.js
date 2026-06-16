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

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function formatICSUTCDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatBeijingTimeRange(start, end) {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

function formatBeijingClockRange(start, end) {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

function uidPart(value) {
  return String(value || 'event').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'event';
}

function displayEventInfo(ev, label, cleanTitle, start, end) {
  if (ev.type === 'traveling_spirit') {
    return {
      startSummary: '【旅行先祖】遇境·复刻先祖',
      endSummary: '【旅行先祖】即将结束',
      location: '遇境 - 旅行先祖',
      description: [
        '地图: 遇境',
        '区域: 旅行先祖',
        '时间: ' + formatBeijingClockRange(start, end),
      ].join('\n'),
      startAlarm: '旅行先祖将在 10 分钟后开始',
      endAlarm: '旅行先祖将在 1 小时后结束',
    };
  }

  return {
    startSummary: '【' + label + '】' + cleanTitle,
    endSummary: '【' + label + '】即将结束',
    location: label,
    description: [
      '类型: ' + label,
      '标题: ' + cleanTitle,
    ].join('\n'),
    startAlarm: label + '将在 10 分钟后开始',
    endAlarm: label + '将在 1 小时后结束',
  };
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
          const startDate = validDate(ev.start);
          const endDate = validDate(ev.end);
          if (!startDate || !endDate || endDate <= startDate) continue;

          const cleanTitle = (ev.title || '').replace(/#[^#\s]+#/g, '').replace(/\n/g, ' ').trim();

          const eventStart = startDate;
          const eventStartEnd = addMinutes(eventStart, 60);
          const display = displayEventInfo(ev, label, cleanTitle, eventStart, eventStartEnd);
          const endReminderStart = addMinutes(endDate, -60);
          const endReminderEnd = addMinutes(endReminderStart, 30);
          const safeLabel = label.replace(/\s+/g, '');
          const eventId = uidPart(ev.id);
          const baseUid = `${formatICSUTCDate(eventStart)}-${safeLabel}-公告-${eventId}@sky-stones-ics`;

          const startLines = [
            'BEGIN:VEVENT',
            'UID:' + baseUid,
            'DTSTAMP:' + dtstamp,
            'DTSTART:' + formatICSUTCDate(eventStart),
            'DTEND:' + formatICSUTCDate(eventStartEnd),
            'SUMMARY:' + escapeICS(display.startSummary),
            'DESCRIPTION:' + escapeICS(display.description),
            'LOCATION:' + escapeICS(display.location),
            'CATEGORIES:游戏,光遇,' + label,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            'BEGIN:VALARM',
            'UID:' + baseUid + '-alarm',
            'X-WR-ALARMUID:' + baseUid + '-alarm',
            'TRIGGER;RELATED=START:-PT10M',
            'ACTION:DISPLAY',
            'DESCRIPTION:' + escapeICS(display.startAlarm),
            'END:VALARM',
            'END:VEVENT',
          ];
          eventVEVENTS.push(buildLines(startLines));

          if (endReminderStart > eventStart) {
            const endUid = `${formatICSUTCDate(endReminderStart)}-${safeLabel}-结束提醒-${eventId}@sky-stones-ics`;
            const endLines = [
              'BEGIN:VEVENT',
              'UID:' + endUid,
              'DTSTAMP:' + dtstamp,
              'DTSTART:' + formatICSUTCDate(endReminderStart),
              'DTEND:' + formatICSUTCDate(endReminderEnd),
              'SUMMARY:' + escapeICS(display.endSummary),
              'DESCRIPTION:' + escapeICS(`${cleanTitle}\n结束时间: ${formatBeijingTimeRange(endReminderStart, endDate)}`),
              'LOCATION:' + escapeICS(display.location),
              'CATEGORIES:游戏,光遇,' + label,
              'STATUS:CONFIRMED',
              'TRANSP:OPAQUE',
              'BEGIN:VALARM',
              'UID:' + endUid + '-alarm',
              'X-WR-ALARMUID:' + endUid + '-alarm',
              'TRIGGER;RELATED=START:PT0M',
              'ACTION:DISPLAY',
              'DESCRIPTION:' + escapeICS(display.endAlarm),
              'END:VALARM',
              'END:VEVENT',
            ];
            eventVEVENTS.push(buildLines(endLines));
          }
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
