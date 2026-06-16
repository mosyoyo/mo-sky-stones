// buildEvents.js — 从 events.json 生成 ICS 文件（本地/GitHub Actions 用）
// 格式与 ics-generator.js 完全一致：UTC 时间，CRLF 换行，含 VALARM

const fs = require('fs');
const path = require('path');
const { generateICS: generateStoneICS } = require('../../ics-generator');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function readJSON(filename) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function writeJSON(filename, data) {
  const fp = path.join(DATA_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 转义 ICS 文本
 */
function esc(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line) {
  const out = [];
  let current = '';

  for (const ch of Array.from(line)) {
    const next = current + ch;
    if (current && Buffer.byteLength(next, 'utf8') > 73) {
      out.push(current);
      current = ' ' + ch;
    } else {
      current = next;
    }
  }

  out.push(current);
  return out.join('\r\n');
}

function buildLines(lines) {
  return lines.map(foldLine).join('\r\n');
}

function foldBlock(block) {
  return String(block).split(/\r?\n/).map(foldLine).join('\r\n');
}

function joinCalendarParts(parts) {
  return parts.map(foldBlock).join('\r\n');
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

/**
 * 从 events.json 生成 VEVENT 块（UTC 格式，与红石 ICS 一致）
 */
function buildEventVEVENTS() {
  const events = readJSON('events.json');
  const enabled = events.filter(e => e.enabled === true);
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const typeLabels = {
    traveling_spirit: '旅行先祖',
    season: '季节',
    activity: '活动',
    bonus: '双倍活动',
    maintenance: '维护更新',
    other: '其他',
  };

  const lines = [];
  for (const ev of enabled) {
    const label = typeLabels[ev.type] || ev.type;
    const startDate = validDate(ev.start);
    const endDate = validDate(ev.end);
    if (!startDate || !endDate || endDate <= startDate) continue;

    // 清理标题中的话题标签和多余换行
    const cleanTitle = (ev.title || '').replace(/#[^#\s]+#/g, '').replace(/\n/g, ' ').trim();

    // 描述：与红石 ICS 格式一致，用 \n 分隔多行
    const descLines = [
      '类型: ' + label,
      '标题: ' + cleanTitle,
    ];
    const description = descLines.map(l => esc(l)).join('\\n');

    const eventStart = startDate;
    const eventStartEnd = addMinutes(eventStart, 60);
    const endReminderStart = addMinutes(endDate, -60);
    const endReminderEnd = addMinutes(endReminderStart, 30);
    const safeLabel = label.replace(/\s+/g, '');
    const baseUid = `${formatICSUTCDate(eventStart)}-${safeLabel}-公告-${ev.type}@sky-stones-ics`;

    lines.push(buildLines([
      'BEGIN:VEVENT',
      `UID:${baseUid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatICSUTCDate(eventStart)}`,
      `DTEND:${formatICSUTCDate(eventStartEnd)}`,
      `SUMMARY:${esc(`【${label}】${cleanTitle}`)}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${esc(label)}`,
      `CATEGORIES:游戏,光遇,${label}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      `UID:${baseUid}-alarm`,
      `X-WR-ALARMUID:${baseUid}-alarm`,
      'TRIGGER;RELATED=START:-PT10M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`${label}将在 10 分钟后开始`)}`,
      'END:VALARM',
      'END:VEVENT',
    ]));

    if (endReminderStart > eventStart) {
      const endUid = `${formatICSUTCDate(endReminderStart)}-${safeLabel}-结束提醒-${ev.type}@sky-stones-ics`;
      lines.push(buildLines([
        'BEGIN:VEVENT',
        `UID:${endUid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${formatICSUTCDate(endReminderStart)}`,
        `DTEND:${formatICSUTCDate(endReminderEnd)}`,
        `SUMMARY:${esc(`【${label}】即将结束`)}`,
        `DESCRIPTION:${esc(`${cleanTitle}\n结束时间: ${formatBeijingTimeRange(endReminderStart, endDate)}`)}`,
        `LOCATION:${esc(label)}`,
        `CATEGORIES:游戏,光遇,${label}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'BEGIN:VALARM',
        `UID:${endUid}-alarm`,
        `X-WR-ALARMUID:${endUid}-alarm`,
        'TRIGGER;RELATED=START:PT0M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(`${label}将在 1 小时后结束`)}`,
        'END:VALARM',
        'END:VEVENT',
      ]));
    }
  }
  return lines;
}

/**
 * 生成合并的 calendar.ics
 * 包含：红黑石算法事件 + 公告事件
 */
function buildCalendarICS() {
  const eventVEVENTS = buildEventVEVENTS();

  // 红石 ICS（用现有算法引擎）
  const redICS = generateStoneICS('red', 60, '光遇·红石(最后一场)');
  // 黑石 ICS
  const blackICS = generateStoneICS('black', 60, '光遇·黑石(最后一场)');

  // 从 ICS 字符串中提取 VEVENT 块
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

  const redEvents = extractVEVENTS(redICS);
  const blackEvents = extractVEVENTS(blackICS);
  const allEvents = [...redEvents, ...blackEvents, ...eventVEVENTS];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//mo-sky-stones//Sky:CoL Calendar (CN)//ZH`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:光遇·日历',
    'X-WR-CALDESC:光遇国服红黑石+活动日历',
    'X-WR-TIMEZONE:Asia/Shanghai',
    ...allEvents,
    'END:VCALENDAR',
  ];

  return joinCalendarParts(lines);
}

/**
 * 单独生成公告事件 ICS（不含红黑石）
 */
function buildEventsICS() {
  const eventVEVENTS = buildEventVEVENTS();

  if (eventVEVENTS.length === 0) {
    // 冇公告事件，返回空日历
    return buildLines([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mo-sky-stones//Sky:CoL Events (CN)//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:光遇·活动',
      'X-WR-CALDESC:光遇国服活动日历',
      'X-WR-TIMEZONE:Asia/Shanghai',
      'END:VCALENDAR',
    ]);
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mo-sky-stones//Sky:CoL Events (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:光遇·活动',
    'X-WR-CALDESC:光遇国服活动日历',
    'X-WR-TIMEZONE:Asia/Shanghai',
    ...eventVEVENTS,
    'END:VCALENDAR',
  ];

  return joinCalendarParts(lines);
}

function main() {
  console.log('🔧 生成 ICS 文件...');

  // 生成合并日历
  const calendarICS = buildCalendarICS();
  const calendarPath = path.join(DATA_DIR, '..', 'calendar.ics');
  fs.writeFileSync(calendarPath, calendarICS, 'utf-8');
  console.log(`   ✅ calendar.ics 已生成`);

  // 生成纯活动日历
  const eventsICS = buildEventsICS();
  const eventsPath = path.join(DATA_DIR, '..', 'events.ics');
  fs.writeFileSync(eventsPath, eventsICS, 'utf-8');
  console.log(`   ✅ events.ics 已生成`);

  // 统计
  const events = readJSON('events.json');
  const enabled = events.filter(e => e.enabled).length;
  console.log(`   📊 ${enabled} 个已启用事件`);

  return { enabled };
}

if (require.main === module) {
  main();
}

module.exports = { buildCalendarICS, buildEventsICS, main };
