// iCalendar (.ics) 生成器
// 输出 RFC 5545 标准的日历订阅文件
// 默认只包含"最后一场"事件，避免骚扰；自定义订阅可选择全部场次

const { generateEvents } = require('./calendar-engine');

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
function generateICS(filterType, days = 30, calName = '光遇', options = {}) {
  const lastOnly = options.lastOnly !== false;
  const upcoming = generateEvents(filterType, days, { lastOnly });
  const now = new Date();
  const dtstamp = formatICSDateTimeUTC(now);
  const typeName = filterType === 'red' ? '红石' : '黑石';
  const descMode = lastOnly ? '仅含每日最后一场' : '包含每日全部场次';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//sky-stones-ics//Sky:CoL ' + typeName + ' (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    `X-WR-CALDESC:光遇国服${typeName}降落时间表（${descMode}，含 10 分钟提醒）`,
    'X-WR-TIMEZONE:Asia/Shanghai',
  ];

  for (const { date, event } of upcoming) {
    const summary = `【${typeName}】${event.map}·${event.area}`;
    // 这里保留上午可订阅版本的旧拼法：
    // CR + 字面量 \n + 空格。安卓日历对这个字节形态很敏感。
    const descriptionLines = [
      `地图: ${event.map}`,
      `区域: ${event.area}`,
      `时间: ${event.startTime} - ${event.endTime}`,
    ];
    const description = descriptionLines
      .map(line => escapeICS(line))
      .join('\r\n ');

    // 转 UTC 时间（iOS/Android 都识识别，更可靠）
    const [sh, sm] = event.startTime.split(':');
    const [eh, em] = event.endTime.split(':');
    const dtStart = new Date(date);
    dtStart.setHours(parseInt(sh), parseInt(sm), 0, 0);
    // 北京时间是 UTC+8，减 8 小时得到 UTC
    const dtStartUTC = new Date(dtStart.getTime() - 8 * 60 * 60 * 1000);

    const dtEnd = new Date(date);
    dtEnd.setHours(parseInt(eh), parseInt(em), 0, 0);
    const dtEndUTC = new Date(dtEnd.getTime() - 8 * 60 * 60 * 1000);

    const dtstart = formatICSDateTimeUTC(dtStartUTC);
    const dtend = formatICSDateTimeUTC(dtEndUTC);
    const uid = `${dtstart}-${event.map}-${event.area}-${event.type}-last@sky-stones-ics`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(description)}`,
      `LOCATION:${escapeICS(event.map + ' - ' + event.area)}`,
      'CATEGORIES:游戏,光遇,' + typeName,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      `UID:${uid}-alarm`,
      `X-WR-ALARMUID:${uid}-alarm`,
      'TRIGGER;RELATED=START:-PT10M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(`${typeName}将在 10 分钟后开始`)}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

module.exports = { generateICS };
