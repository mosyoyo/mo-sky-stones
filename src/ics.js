import { upcomingStoneEvents } from './stones.js';

const BEIJING_OFFSET_HOURS = 8;
const TYPE_NAMES = { red: '红石', black: '黑石' };

export function generateCalendar(type = 'red', options = {}) {
  const days = options.days ?? 120;
  const name = options.name ?? `光遇${TYPE_NAMES[type]}最后一场`;
  const events = upcomingStoneEvents(type, days, options.from ?? new Date());
  const dtstamp = formatUtc(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//mo-sky-stones//Sky Stones ${TYPE_NAMES[type]}//ZH-CN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-CALDESC:${escapeText(`光遇国服${TYPE_NAMES[type]}降落时间表（仅含每日最后一场，含 15 分钟提醒）`)}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
  ];

  for (const item of events) {
    lines.push(...eventLines(item, dtstamp));
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

function eventLines({ date, event }, dtstamp) {
  const typeName = TYPE_NAMES[event.type];
  const localDay = [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('');

  return [
    'BEGIN:VEVENT',
    `UID:${localDay}-${event.type}-last@mo-sky-stones`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatUtc(beijingTimeToUtc(date, event.startTime))}`,
    `DTEND:${formatUtc(beijingTimeToUtc(date, event.endTime))}`,
    `SUMMARY:${escapeText(`【${typeName}】${event.map}·${event.area}`)}`,
    `DESCRIPTION:${escapeText([
      `类型: ${typeName}`,
      `地图: ${event.map}`,
      `区域: ${event.area}`,
      `时间: ${event.startTime} - ${event.endTime}`,
    ].join('\n'))}`,
    `LOCATION:${escapeText(`${event.map}·${event.area}`)}`,
    `CATEGORIES:游戏,光遇,${typeName}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`${typeName}即将开始 - ${event.map}·${event.area}`)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
  ];
}

function beijingTimeToUtc(date, time) {
  const [rawHour, minute] = time.split(':').map(Number);
  const hour = rawHour === 24 ? 0 : rawHour;
  const dayOffset = rawHour === 24 ? 1 : 0;

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + dayOffset,
    hour - BEIJING_OFFSET_HOURS,
    minute,
    0
  ));
}

function formatUtc(date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('');
}

function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldLine(line) {
  const encoder = new TextEncoder();
  const output = [];
  let current = '';

  for (const char of Array.from(line)) {
    const next = current + char;
    if (current && encoder.encode(next).length > 73) {
      output.push(current);
      current = ` ${char}`;
    } else {
      current = next;
    }
  }

  output.push(current);
  return output.join('\r\n');
}

function pad(value) {
  return String(value).padStart(2, '0');
}
