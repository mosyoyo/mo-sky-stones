// iCalendar (.ics) 生成器
// 输出格式完全参照 preview-red.ics（iOS 已验证可用）
// 含规则：最后一场 >= 23:00 时改用前一场

const { generateLastEvents } = require('./calendar-engine');

/**
 * 将日期+时间转为北京时间字符串（供 TZID=Asia/Shanghai 用）
 * 返回格式：YYYYMMDDTHHMMSS
 */
function bjToString(date, timeStr) {
  const [hh, mm] = timeStr.split(':');
  const d = new Date(date);
  d.setHours(parseInt(hh), parseInt(mm), 0, 0);
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${YYYY}${MM}${DD}T${HH}${mi}00`;
}

/**
 * 转义 ICS 特殊字符
 */
function escapeICS(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * 生成 ICS 字符串
 * @param {'red' | 'black'} filterType
 * @param {number} days - 生成未来多少天
 * @param {string} calName - 日历显示名
 */
function generateICS(filterType, days = 30, calName = '光遇') {
  const upcoming = generateLastEvents(filterType, days);
  const now = new Date();
  // DTSTAMP 用 UTC（固定，不影响）
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const typeName = filterType === 'red' ? '红石' : '黑石';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//sky-stones-ics//Sky:CoL ${typeName} (CN)//ZH`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    `X-WR-CALDESC:光遇国服${typeName}降落时间表（仅含每日最后一场，含 15 分钟提醒）`,
    'X-WR-TIMEZONE:Asia/Shanghai',
  ];

  for (const { date, event } of upcoming) {
    const summary = `【${typeName}】${event.map}·${event.area}`;

    // DESCRIPTION 用字面 \n（不换行，iOS 接受）
    const descLines = [
      `类型: ${typeName}`,
      `地图: ${event.map}`,
      `区域: ${event.area}`,
      `时间: ${event.startTime} - ${event.endTime}`,
      '',
      '⚡ 今日最后一场红石雨 / 黑石雨',
      '数据来源: github.com/CikiSyteen/sky-stones (基于游戏内机制)',
    ];
    const description = descLines.map(l => escapeICS(l)).join('\\n');

    // 时间字符串（北京时间）
    const startStr = bjToString(date, event.startTime);
    // endTime = 24:00 时特殊处理（Apple 接受 240000）
    let endStr = bjToString(date, event.endTime);
    if (event.endTime === '24:00') {
      const YYYY = date.getFullYear();
      const MM = String(date.getMonth() + 1).padStart(2, '0');
      const DD = String(date.getDate()).padStart(2, '0');
      endStr = `${YYYY}${MM}${DD}T240000`;
    }

    const uid = `${startStr}-${event.map}-${event.area}-${event.type}-last@sky-stones-ics`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Shanghai:${startStr}`,
      `DTEND;TZID=Asia/Shanghai:${endStr}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${escapeICS(event.map + ' - ' + event.area)}`,
      'CATEGORIES:游戏,光遇,' + typeName,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${typeName}即将开始 - ${event.map}·${event.area}`,
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  // 用 \n 作行结束（preview-red.ics 就是这样）
  return lines.join('\n');
}

module.exports = { generateICS };
