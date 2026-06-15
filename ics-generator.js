// iCalendar (.ics) 生成器
// 输出 RFC 5545 标准的日历订阅文件
// 每个订阅只包含"最后一场"事件，避免骚扰

const { generateLastEvents } = require('./calendar-engine');

/**
 * 格式化时间为 ICS 格式: YYYYMMDDTHHMMSS
 */
function formatICSDateTime(date, timeStr) {
  const [hh, mm] = timeStr.split(':');
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}00`;
}

/**
 * 格式化 UTC 时间戳
 */
function formatICSDateTimeUTC(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * 转义 ICS 文本字段
 */
function escapeICS(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * 生成 ICS 字符串
 * @param {'red' | 'black'} filterType - 'red' 红石, 'black' 黑石
 * @param {number} days - 生成未来多少天
 * @param {string} calName - 日历显示名
 */
function generateICS(filterType, days = 30, calName = '光遇') {
  const upcoming = generateLastEvents(filterType, days);
  const now = new Date();
  const dtstamp = formatICSDateTimeUTC(now);
  const typeName = filterType === 'red' ? '红石' : '黑石';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//sky-stones-ics//Sky:CoL ' + typeName + ' (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    `X-WR-CALDESC:光遇国服${typeName}降落时间表（仅含每日最后一场，含 15 分钟提醒）`,
    'X-WR-TIMEZONE:Asia/Shanghai',
  ];

  for (const { date, event } of upcoming) {
    const summary = `【${typeName}】${event.map}·${event.area}`;
    const description = [
      `类型: ${typeName}`,
      `地图: ${event.map}`,
      `区域: ${event.area}`,
      `时间: ${event.startTime} - ${event.endTime}`,
      '',
      '⚡ 今日最后一场红石雨 / 黑石雨',
      '数据来源: github.com/CikiSyteen/sky-stones (基于游戏内机制)',
    ].join('\n');

    const dtstart = formatICSDateTime(date, event.startTime);
    const dtend = formatICSDateTime(date, event.endTime);
    const uid = `${dtstart}-${event.map}-${event.area}-${event.type}-last@sky-stones-ics`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Shanghai:${dtstart}`,
      `DTEND;TZID=Asia/Shanghai:${dtend}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(description)}`,
      `LOCATION:${escapeICS(event.map + ' - ' + event.area)}`,
      'CATEGORIES:游戏,光遇,' + typeName,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + escapeICS(`${typeName}即将开始 - ${event.map}·${event.area}`),
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

module.exports = { generateICS };
