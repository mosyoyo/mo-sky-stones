const CRLF = '\r\n';
const OFFICIAL_UID = '154db622a20e4327ac277bc35d4f2e76';

const TYPE_LABELS = {
  traveling_spirit: '复刻',
  season: '季节',
  activity: '活动',
  bonus: '双倍',
  candle_heap: '大蜡烛',
  maintenance: '维护',
  other: '其他',
};

// 各类型提醒配置
// - start: 事件开始前多久提醒（RELATED=START）
// - end:   事件结束前多久提醒（RELATED=END），维护系结束时
const REMINDERS = {
  traveling_spirit: { start: '-PT10M', end: '-PT1H', startDesc: '复刻先祖即将开始', endDesc: '复刻先祖1小时后离开' },
  season:            { start: '-P1D',   end: '-P1D',  startDesc: '季节明天就要开始了', endDesc: '季节明天就要结束了' },
  activity:          { start: '-PT10M', end: '-PT1H', startDesc: '活动即将开始',       endDesc: '活动1小时后结束' },
  bonus:             { start: '-PT10M', end: '-PT3H', startDesc: '双倍即将开始',       endDesc: '双倍3小时后结束' },
  candle_heap:       { start: '-PT10M', end: '-PT10M',startDesc: '大蜡烛即将开始',     endDesc: '大蜡烛即将结束' },
  maintenance:       { start: '-PT0M',  end: '-PT0M', startDesc: '维护结束',           endDesc: '维护结束' },
};

const TYPE_KEYWORDS = {
  traveling_spirit: ['旅行先祖', '先祖到访', '复刻', '先祖即将到访', '到临提醒'],
  season: ['季节开启', '季节结束', '新季节', '赛季'],
  activity: ['活动开启', '周年庆', '自然日', '音乐节', '花憩节', '彩染季', '端午', '七周年'],
  bonus: ['双倍', '双倍蜡烛', '双倍爱心', '双倍季蜡', '双倍心火', '双倍烛火', '额外烛火'],
  candle_heap: ['大蜡烛', '大蜡烛堆', '大蜡烛堆将出现在天空王国各地'],
  maintenance: ['停服', '维护', '更新维护', '升级维护', '更新时间公告', '更新中无法正常游戏', '开服时间'],
};

function escapeICS(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeDescriptionICS(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function escapeICSLine(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .trim();
}

function foldLine(line) {
  return String(line || '');
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
  for (const type of ['maintenance', 'traveling_spirit', 'bonus', 'candle_heap', 'season', 'activity']) {
    if (TYPE_KEYWORDS[type].some(keyword => text.includes(keyword))) return type;
  }
  return 'other';
}

function cleanEventTitle(title = '', content = '', type = '') {
  let text = cleanText(`${title}\n${content}`)
    .replace(/#[^#\n]+#/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const firstLine = cleanText(title).split('\n')[0] || text;
  let short = firstLine
    .replace(/#[^#\n]+#/g, '')
    .replace(/^\d{1,2}月\d{1,2}日[丨|\s]*/, '')
    .trim();

  if (/[丨|]/.test(short)) short = short.split(/[丨|]/).pop().trim();

  if (type === 'traveling_spirit' || /旅行先祖|复刻|先祖到访|先祖即将到访/.test(text)) return '旅行先祖';
  if (type === 'candle_heap' || /大蜡烛/.test(text)) return '《光·遇》大蜡烛';
  if (type === 'maintenance' || /停服|维护|版本更新|更新时间公告/.test(text)) return '《光·遇》维护更新';
  if (/端午/.test(text)) return '《光·遇》端午节';
  if (/七周年/.test(text)) return '《光·遇》七周年';
  if (/致梵高/.test(text)) return '《光·遇》致梵高';
  if (/星光奖/.test(text)) return '《光·遇》星光奖';
  if (/自然日/.test(text)) return '《光·遇》自然日';
  if (/音乐节/.test(text)) return '《光·遇》音乐节';
  if (/花憩节/.test(text)) return '《光·遇》花憩节';

  short = short
    .replace(/《光·遇》/g, '')
    .replace(/更新内容公告|更新时间公告|更新公告|规则说明|到临提醒|即将到临|正式开启/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return short ? `《光·遇》${short}` : (TYPE_LABELS[type] || '光遇提醒');
}

function extractTravelingSpiritLabel(text = '') {
  const source = cleanText(text);
  const lines = source
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  // 优先取物理第 3 行（用户指定）
  if (lines.length >= 3) {
    const third = lines[2];
    if (/[，,]/.test(third) && third.length <= 16 && !/光遇|先祖|到临|即将|重返天空王国|与先祖/.test(third)) {
      return third.replace(/[~～。！？!?,，]$/, '');
    }
  }

  // Fallback 1: 找含逗号的非描述性行
  const direct = lines.find(line => /[，,]/.test(line) && !/光遇|先祖|到临|即将|重返天空王国|与先祖/.test(line));
  if (direct) {
    const parts = direct.split(/[，,]/).map(part => part.trim()).filter(Boolean);
    const tail = parts[parts.length - 1];
    if (tail && tail.length <= 12) return tail.replace(/[~～。！？!?,，]$/, '');
  }

  // Fallback 2: 正则匹配
  const whispered = source.match(/先祖正在(?:[^，。！？\n]{1,10}?)([^，。！？\n]{2,12})/);
  if (whispered && whispered[1]) return whispered[1].replace(/[~～。！？!?,，]$/, '');

  return '';
}

function isLikelyGameActivity(event) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }
  const durationDays = Math.max(0, (end - start) / 86400000);
  return durationDays >= 3;
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

function parseBeijingDateTime(year, month, day, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0));
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

  const sameDayTimeRange = text.match(/(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[:：](\d{2})\s*(?:至|到|~|—|-)\s*(\d{1,2})[:：](\d{2})/);
  if (sameDayTimeRange) {
    const month = Number(sameDayTimeRange[1]);
    const day = Number(sameDayTimeRange[2]);
    const startHour = Number(sameDayTimeRange[3]);
    const startMinute = Number(sameDayTimeRange[4]);
    const endHour = Number(sameDayTimeRange[5]);
    const endMinute = Number(sameDayTimeRange[6]);
    let start = parseBeijingDateTime(year, month, day, startHour, startMinute);
    let end = parseBeijingDateTime(year, month, day, endHour, endMinute);
    if (end <= start) end = addDays(end, 1);
    return { start: start.toISOString(), end: end.toISOString() };
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

function compactUid(value) {
  const id = uidPart(value);
  return id.length > 28 ? id.slice(-28) : id;
}

function eventDurationDays(event) {
  return Math.max(0, (new Date(event.end) - new Date(event.start)) / 86400000);
}

function shortSummary(title, label) {
  // 唔再剥【】，因为标题已经包含【】
  const cleaned = String(title || label || '光遇提醒').replace(/\s+/g, '').trim();
  return cleaned || label || '光遇提醒';
}

function buildDescription(lines) {
  const chunks = Array.isArray(lines) ? lines : [lines];
  return chunks.map(line => escapeICSLine(line)).join('\r\n ');
}

function createTimedEvent({ uid, dtstamp, start, end, summary, description, location, category, alarm }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatUTC(start)}`,
    `DTEND:${formatUTC(end)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeDescriptionICS(description)}`,
    `LOCATION:${escapeICS(location || category)}`,
    `CATEGORIES:${escapeICS(category || location || '')}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
  ];
  if (alarm) {
    lines.push(
      'BEGIN:VALARM',
      `TRIGGER;RELATED=START:${alarm.trigger}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(alarm.description)}`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return buildLines(lines);
}

function createAllDayEvent({ uid, dtstamp, start, end, summary, description, location, category, alarm }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${formatDateValue(start)}`,
    `DTEND;VALUE=DATE:${formatDateValue(addDays(end, 1))}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeDescriptionICS(description)}`,
    `LOCATION:${escapeICS(location || category)}`,
    `CATEGORIES:${escapeICS(category || location || '')}`,
    'X-MICROSOFT-CDO-ALLDAYEVENT:TRUE',
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
  ];
  if (alarm) {
    lines.push(
      'BEGIN:VALARM',
      `TRIGGER;RELATED=START:${alarm.trigger}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(alarm.description)}`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return buildLines(lines);
}

function buildReminderEvents(events, options = {}) {
  const types = new Set(options.types || Object.keys(TYPE_LABELS));
  const endOnly = options.endOnly instanceof Set
    ? options.endOnly
    : new Set(Array.isArray(options.endOnly) ? options.endOnly : []);
  const allDay = options.allDay instanceof Set
    ? options.allDay
    : new Set(Array.isArray(options.allDay) ? options.allDay : []);
  const dtstamp = formatUTC(new Date());
  const blocks = [];

  for (const event of events || []) {
    if (!event || event.enabled !== true || !types.has(event.type)) continue;
    if (!event.start || !event.end || new Date(event.end) <= new Date(event.start)) continue;

    const label = TYPE_LABELS[event.type] || event.type;
    const id = compactUid(event.sourceFeedId || event.id || event.title);
    const title = event.title || label;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const durationDays = eventDurationDays(event);
    const useAllDay = allDay.has(event.type) || event.allDay === true;

    if (event.type === 'activity' && !isLikelyGameActivity(event)) {
      continue;
    }

    const summary = shortSummary(title, label);
    const reminder = REMINDERS[event.type] || REMINDERS.activity;

    // 1) range 事件（持续事件）
    if (!endOnly.has(event.type)) {
      const rangeDesc = buildDescription([
        `类型: ${label}`,
        `标题: ${summary}`,
        `时间: ${beijingText(start)} - ${beijingText(end)}`,
      ]);
      const rangeAlarm = { trigger: reminder.start, description: reminder.startDesc };
      const rangeUid = `${id}-range@sky-stones-ics`;
      blocks.push(useAllDay
        ? createAllDayEvent({
            uid: rangeUid,
            dtstamp,
            start,
            end,
            summary,
            description: rangeDesc,
            location: label,
            category: label,
            alarm: rangeAlarm,
          })
        : createTimedEvent({
            uid: rangeUid,
            dtstamp,
            start,
            end,
            summary,
            description: rangeDesc,
            location: label,
            category: label,
            alarm: rangeAlarm,
          }));
    }

    // 2) end 提醒（结束前 X 小时/天）
    // 红石黑石不参与
    if (event.type !== 'maintenance' || endOnly.has(event.type)) {
      const endTitle = event.type === 'traveling_spirit'
        ? '复刻先祖即将离开'
        : `【${label}】即将结束`;
      const endDesc = buildDescription([
        `标题: ${summary}`,
        `结束时间: ${beijingText(end)}`,
      ]);
      const endUid = `${id}-end-reminder@sky-stones-ics`;
      // 结束事件：从 end 时间前 N 开始，到 end 后 30min
      const endStart = addMinutes(end, parseISODurationMinutes(reminder.end));
      blocks.push(useAllDay
        ? createAllDayEvent({
            uid: endUid,
            dtstamp,
            start: endStart,
            end: addMinutes(end, 30),
            summary: endTitle,
            description: endDesc,
            location: label,
            category: label,
            alarm: { trigger: reminder.end, description: reminder.endDesc },
          })
        : createTimedEvent({
            uid: endUid,
            dtstamp,
            start: endStart,
            end: addMinutes(end, 30),
            summary: endTitle,
            description: endDesc,
            location: label,
            category: label,
            alarm: { trigger: reminder.end, description: reminder.endDesc },
          }));
    }
  }

  return blocks;
}

// 把 ISO 8601 duration (e.g. -PT1H, -P1D) 转成分钟数（取绝对值用于计算时间偏移）
function parseISODurationMinutes(value) {
  if (!value) return 0;
  // 去掉负号，我们只需要绝对值来计算「N 分钟前」
  const s = String(value).replace(/^-/, '');
  const m = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return 0;
  const days = Number(m[1] || 0);
  const hours = Number(m[2] || 0);
  const minutes = Number(m[3] || 0);
  return days * 24 * 60 + hours * 60 + minutes;
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
  REMINDERS,
  buildReminderEvents,
  cleanText,
  cleanEventTitle,
  detectType,
  escapeICS,
  extractTravelingSpiritLabel,
  extractDateRange,
  formatUTC,
  generateEventsICS,
  isLikelyGameActivity,
  normalizeFeed,
  parseISODurationMinutes,
  uidPart,
};
