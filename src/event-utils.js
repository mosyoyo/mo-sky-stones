const CRLF = '\r\n';
const OFFICIAL_UID = '154db622a20e4327ac277bc35d4f2e76';

const TYPE_LABELS = {
  traveling_spirit: '旅行先祖',
  season: '季节',
  activity: '活动',
  bonus: '双倍活动',
  maintenance: '维护更新',
  other: '其他',
};

const TYPE_KEYWORDS = {
  traveling_spirit: ['旅行先祖', '先祖到访', '复刻', '先祖即将到访', '到临提醒'],
  season: ['季节开启', '季节结束', '新季节', '赛季'],
  activity: ['活动开启', '周年庆', '自然日', '音乐节', '花憩节', '彩染季', '端午', '七周年'],
  bonus: ['双倍蜡烛', '双倍爱心', '双倍季蜡', '额外烛火'],
  maintenance: ['停服', '维护', '更新维护', '升级维护'],
};

function escapeICS(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line) {
  const out = [];
  let current = '';
  const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const byteLength = value => encoder ? encoder.encode(value).length : Buffer.byteLength(value, 'utf8');
  for (const ch of Array.from(line)) {
    const next = current + ch;
    if (current && byteLength(next) > 73) {
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

function formatUTC(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  return addMinutes(date, days * 24 * 60);
}

function beijingDateParts(date) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(date));
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function formatDateValue(date) {
  const p = beijingDateParts(date);
  return `${p.year}${String(p.month).padStart(2, '0')}${String(p.day).padStart(2, '0')}`;
}

function beijingText(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

function detectType(title = '', content = '') {
  const text = `${title}\n${content}`;
  for (const type of ['maintenance', 'traveling_spirit', 'bonus', 'season', 'activity']) {
    if (TYPE_KEYWORDS[type].some(keyword => text.includes(keyword))) return type;
  }
  return 'other';
}

function cleanText(text = '') {
  return String(text)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseContentPayload(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && parsed.body ? parsed.body : parsed;
  } catch (_) {
    return null;
  }
}

function parseDateMatch(match, fallbackYear) {
  const month = Number(match[1]);
  const day = Number(match[2]);
  const hour = match[3] == null ? 0 : Number(match[3]);
  const minute = match[4] == null ? 0 : Number(match[4]);
  return new Date(Date.UTC(fallbackYear, month - 1, day, hour - 8, minute, 0));
}

const WEEKDAY_MAP = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
};

function relativeWeekdayDate(text, now) {
  const match = text.match(/(本周|下周)([日天一二三四五六])(?:早上|上午|中午|下午|晚上)?\s*(\d{1,2})[:：](\d{2})/);
  if (!match) return null;
  const base = beijingDateParts(now);
  const todayWeekday = new Date(Date.UTC(base.year, base.month - 1, base.day, 4, 0, 0)).getUTCDay();
  const target = WEEKDAY_MAP[match[2]];
  let delta = target - todayWeekday;
  if (match[1] === '下周') delta += 7;
  const hour = Number(match[3]);
  const minute = Number(match[4]);
  return new Date(Date.UTC(base.year, base.month - 1, base.day + delta, hour - 8, minute, 0));
}

function extractDateRange(title = '', content = '', now = new Date()) {
  const text = cleanText(`${title}\n${content}`);
  const year = beijingDateParts(now).year;
  const relatives = [...text.matchAll(/(?:本周|下周)[日天一二三四五六](?:早上|上午|中午|下午|晚上)?\s*\d{1,2}[:：]\d{2}/g)]
    .map(match => relativeWeekdayDate(match[0], now))
    .filter(Boolean);
  if (relatives.length >= 2) {
    relatives.sort((a, b) => a - b);
    return { start: relatives[0].toISOString(), end: relatives[relatives.length - 1].toISOString() };
  }

  const dateTime = '(\\d{1,2})月(\\d{1,2})日(?:\\s*(\\d{1,2})[:：](\\d{2}))?';
  const between = new RegExp(`${dateTime}[\\s\\S]{0,20}(?:至|到|~|—|-)[\\s\\S]{0,20}${dateTime}`);
  const range = text.match(between);
  if (range) {
    const start = parseDateMatch([null, range[1], range[2], range[3], range[4]], year);
    const end = parseDateMatch([null, range[5], range[6], range[7] ?? '23', range[8] ?? '59'], year);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const startOnly = text.match(new RegExp(dateTime));
  if (!startOnly) return null;
  const start = parseDateMatch(startOnly, year);
  const end = addDays(start, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function uidPart(value) {
  return String(value || 'event').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'event';
}

function eventDurationDays(event) {
  return Math.max(0, (new Date(event.end) - new Date(event.start)) / 86400000);
}

function createTimedEvent({ uid, dtstamp, start, end, summary, description, location, category, alarm }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatUTC(start)}`,
    `DTEND:${formatUTC(end)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location || category)}`,
    `CATEGORIES:游戏,光遇,${escapeICS(category)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
  ];
  if (alarm) {
    lines.push(
      'BEGIN:VALARM',
      `UID:${uid}-alarm`,
      `X-WR-ALARMUID:${uid}-alarm`,
      `TRIGGER;RELATED=START:${alarm.trigger}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(alarm.description)}`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return buildLines(lines);
}

function createAllDayEvent({ uid, dtstamp, start, end, summary, description, location, category }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${formatDateValue(start)}`,
    `DTEND;VALUE=DATE:${formatDateValue(addDays(end, 1))}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location || category)}`,
    `CATEGORIES:游戏,光遇,${escapeICS(category)}`,
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
  return buildLines(lines);
}

function buildReminderEvents(events, options = {}) {
  const types = new Set(options.types || Object.keys(TYPE_LABELS));
  const dtstamp = formatUTC(new Date());
  const blocks = [];

  for (const event of events || []) {
    if (!event || event.enabled !== true || !types.has(event.type)) continue;
    if (!event.start || !event.end || new Date(event.end) <= new Date(event.start)) continue;

    const label = TYPE_LABELS[event.type] || event.type;
    const id = uidPart(event.id || event.sourceFeedId || event.title);
    const title = event.title || label;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const duration = eventDurationDays(event);
    const desc = `类型: ${label}\n标题: ${title}\n时间: ${beijingText(start)} - ${beijingText(end)}`;

    if (event.type === 'bonus') {
      blocks.push(createAllDayEvent({
        uid: `${id}-bonus-all-day@sky-stones-ics`,
        dtstamp,
        start,
        end,
        summary: `【${label}】${title}`,
        description: desc,
        location: label,
        category: label,
      }));
      continue;
    }

    if (event.type === 'traveling_spirit' && duration <= 5) {
      blocks.push(createTimedEvent({
        uid: `${id}-spirit-range@sky-stones-ics`,
        dtstamp,
        start,
        end,
        summary: `【${label}】${title}`,
        description: desc,
        location: label,
        category: label,
        alarm: { trigger: '-PT10M', description: `${label}将在 10 分钟后开始` },
      }));
    } else if (event.type !== 'season') {
      blocks.push(createTimedEvent({
        uid: `${id}-start@sky-stones-ics`,
        dtstamp,
        start,
        end: addMinutes(start, 60),
        summary: `【${label}】${title}`,
        description: desc,
        location: label,
        category: label,
        alarm: { trigger: '-PT10M', description: `${label}将在 10 分钟后开始` },
      }));
    }

    const endOffset = event.type === 'traveling_spirit' ? 120 : 24 * 60;
    const reminderStart = addMinutes(end, -endOffset);
    if (reminderStart > start) {
      blocks.push(createTimedEvent({
        uid: `${id}-end-reminder@sky-stones-ics`,
        dtstamp,
        start: reminderStart,
        end: addMinutes(reminderStart, 30),
        summary: event.type === 'traveling_spirit' ? '⚠️旅行先祖即将离开' : `【${label}】即将结束`,
        description: `${title}\n结束时间: ${beijingText(end)}`,
        location: label,
        category: label,
        alarm: { trigger: 'PT0M', description: `${label}即将结束` },
      }));
    }
  }

  return blocks;
}

function generateEventsICS(events, options = {}) {
  const name = options.name || '光遇·活动';
  const desc = options.description || '光遇国服活动提醒';
  const blocks = buildReminderEvents(events, options);
  return buildLines([
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mo-sky-stones//Sky:CoL Events (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(name)}`,
    `X-WR-CALDESC:${escapeICS(desc)}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
    ...blocks,
    'END:VCALENDAR',
  ]);
}

function normalizeFeed(raw) {
  const id = String(raw.id || raw.feedId || raw.feed_id || '');
  const body = parseContentPayload(raw.content) || parseContentPayload(raw.detail?.result?.feed?.content) || {};
  const title = cleanText(body.title || raw.title || raw.share_title || raw.summary || raw.contentTitle || '');
  const content = cleanText(body.text || raw.text || raw.desc || raw.plainText || raw.content || '');
  const autoType = detectType(title, content);
  return {
    id,
    title: title || content.slice(0, 48) || id,
    content,
    createTime: Number(raw.createTime || raw.create_time || raw.createdAt || Date.now()),
    status: 'pending',
    autoType,
    parsed: false,
    raw,
  };
}

module.exports = {
  CRLF,
  OFFICIAL_UID,
  TYPE_LABELS,
  buildReminderEvents,
  cleanText,
  detectType,
  escapeICS,
  extractDateRange,
  formatUTC,
  generateEventsICS,
  normalizeFeed,
  uidPart,
};
