// buildEvents.js — 从 events.json 生成 calendar.ics
// 合并红黑石算法事件 + 公告事件

const fs = require('fs');
const path = require('path');
const { generateLastEvents } = require('../../calendar-engine');
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
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * 格式化 ISO 时间为 ICS UTC 格式
 */
function toICSDateTime(isoStr) {
  const d = new Date(isoStr);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * 格式化 ISO 时间为 ICS 本地时间格式（TZID）
 */
function toICSLocalDateTime(isoStr) {
  const d = new Date(isoStr);
  // 转为北京时间
  const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bj.getUTCDate()).padStart(2, '0');
  const h = String(bj.getUTCHours()).padStart(2, '0');
  const min = String(bj.getUTCMinutes()).padStart(2, '0');
  const s = String(bj.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}`;
}

/**
 * 从 events.json 生成 VEVENT 块
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
    const uid = `${ev.id}@mo-sky-stones`;
    const start = toICSLocalDateTime(ev.start);
    const end = toICSLocalDateTime(ev.end);
    // 清理标题中的话题标签和多余换行
    const cleanTitle = ev.title.replace(/#[^#\s]+#/g, '').replace(/\n/g, ' ').trim();

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Shanghai:${start}`,
      `DTEND;TZID=Asia/Shanghai:${end}`,
      `SUMMARY:${esc(`【${label}】${cleanTitle}`)}`,
      `DESCRIPTION:${esc(`类型:${label}\\n标题:${cleanTitle}`)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      // 15 分钟提醒
      'BEGIN:VALARM',
      `UID:${uid}-alarm`,
      `X-WR-ALARMUID:${uid}-alarm`,
      'TRIGGER;RELATED=START:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`${label}将在 15 分钟后开始`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  return lines;
}

/**
 * 生成合并嘅 calendar.ics
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

  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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

  return lines.join('\r\n');
}

/**
 * 单独生成公告事件 ICS（不含红黑石）
 */
function buildEventsICS() {
  const eventVEVENTS = buildEventVEVENTS();

  if (eventVEVENTS.length === 0) {
    // 冇公告事件，返回空日历
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mo-sky-stones//Sky:CoL Events (CN)//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:光遇·活动',
      'X-WR-CALDESC:光遇国服活动日历',
      'X-WR-TIMEZONE:Asia/Shanghai',
      'END:VCALENDAR',
    ].join('\r\n');
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

  return lines.join('\r\n');
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
