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
  traveling_spirit: { start: '-PT10M', end: '-PT16H', startDesc: '复刻先祖即将开始', endDesc: '复刻先祖明晚就要离开' },
  season:            { start: '-P1D',   end: '-P1D',  startDesc: '季节明天就要开始了', endDesc: '季节明天就要结束了' },
  activity:          { start: '-PT10M', end: '-PT1H', startDesc: '活动即将开始',       endDesc: '活动1小时后结束' },
  bonus:             { start: '-PT10M', end: '-PT3H', startDesc: '双倍即将开始',       endDesc: '双倍3小时后结束' },
  candle_heap:       { start: '-PT10M', end: '-PT10M',startDesc: '大蜡烛即将开始',     endDesc: '大蜡烛即将结束' },
  maintenance:       { start: '-PT0M',  end: '-PT0M', startDesc: '维护结束',           endDesc: '维护结束' },
};

const TYPE_KEYWORDS = {
  // 复刻先祖：只匹配「即将到临/即将来临」类预告公告
  // 「到临提醒」「已到来」类（如「勤劳的先祖在今天重返天空王国啦」）会另行过滤
  traveling_spirit: ['旅行先祖即将到临', '旅行先祖即将来临', '先祖即将到访', '复刻先祖'],
  season: ['季节开启', '季节结束', '新季节', '赛季'],
  activity: ['活动开启', '周年庆', '自然日', '音乐节', '花憩节', '彩染季', '端午', '七周年'],
  bonus: ['双倍', '双倍蜡烛', '双倍爱心', '双倍季蜡', '双倍心火', '双倍烛火', '额外烛火'],
  candle_heap: ['大蜡烛', '大蜡烛堆', '大蜡烛堆将出现在天空王国各地'],
  maintenance: ['停服', '维护', '更新维护', '升级维护', '更新时间公告', '更新中无法正常游戏', '开服时间'],
};

// 复刻先祖过滤：标题/正文含这些关键词的动态视为「已到来」或「非本周复刻」，应过滤
// 1. 「到临提醒」/「到临啦」/「重返天空王国」= 已到来
// 2. 「即将离开」/「已离开」= 已结束
const SPIRIT_DROP_KEYWORDS = ['到临提醒', '到临啦', '重返天空王国', '即将离开', '已离开'];

// 判断复刻先祖动态是否应该保留（只保留「即将到临/即将来临」类预告）
function isTravelingSpiritUpcoming(title = '', content = '') {
  const text = `${title}\n${content}`;
  // 含 drop 关键词 → 过滤
  if (SPIRIT_DROP_KEYWORDS.some(k => text.includes(k))) return false;
  // 必须含「即将到临」「即将来临」或「先祖即将到访」
  if (text.includes('即将到临') || text.includes('即将来临') || text.includes('先祖即将到访')) return true;
  return false;
}

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
  const titleOnly = title || '';
  const text = `${title}
${content}`;

  const BONUS_TITLE_KEYWORDS = ['双倍蜡烛', '双倍爱心', '双倍季蜡', '双倍心火', '双倍烛火', '额外烛火'];
  const CANDLE_TITLE_KEYWORDS = ['大蜡烛堆将出现在天空王国各地', '大蜡烛堆'];
  if (CANDLE_TITLE_KEYWORDS.some(k => text.includes(k))) return 'candle_heap';
  if (BONUS_TITLE_KEYWORDS.some(k => text.includes(k))) return 'bonus';

  const MAINT_TITLE_KEYWORDS = ['更新时间公告', '停服维护公告', '停服公告', '升级维护公告', '更新维护公告'];
  const MAINT_BODY_PATTERNS = [
    /我们将在\d{1,2}月\d{1,2}日\s*\d{1,2}[:：]\d{2}\s*(?:至|到|~|—|-)\s*\d{1,2}[:：]\d{2}进行版本更新/,
    /将于\d{1,2}月\d{1,2}日\s*\d{1,2}[:：]\d{2}\s*(?:至|到|~|—|-)\s*\d{1,2}[:：]\d{2}进行(?:停服|版本)?(?:更新|维护)/,
  ];
  if (MAINT_TITLE_KEYWORDS.some(k => titleOnly.includes(k)) || MAINT_BODY_PATTERNS.some(pattern => pattern.test(text))) {
    return 'maintenance';
  }

  const BONUS_FALLBACK_KEYWORDS = ['双倍'];
  if (BONUS_TITLE_KEYWORDS.some(k => titleOnly.includes(k))) return 'bonus';
  if (BONUS_FALLBACK_KEYWORDS.some(k => text.includes(k))) return 'bonus';

  for (const type of ['season', 'activity', 'traveling_spirit']) {
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
  if (type === 'maintenance') {
    // 从标题提取日期，如「6月12日 更新时间公告」→「6月12日 维护」
    const dateMatch = firstLine.match(/(\d{1,2}月\d{1,2}日)/);
    return dateMatch ? `${dateMatch[1]} 维护` : '维护更新';
  }
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

function extractBonusLabel(text = '') {
  const t = cleanText(text);
  if (/双倍爱心/.test(t)) return '双倍爱心';
  if (/双倍心火/.test(t)) return '双倍心火';
  if (/双倍烛火/.test(t)) return '双倍烛火';
  if (/双倍季蜡/.test(t)) return '双倍季蜡';
  if (/双倍蜡烛/.test(t)) return '双倍蜡烛';
  return '';
}

// 线下活动关键词（粉丝见面会、签售、舞台剧、COSPLAY 集会、漫展等 → 视作 non-game event）
const OFFLINE_KEYWORDS = [
  '见面会', '签售', '签售会', '舞台剧', '音乐会', '演唱会', '展览', '漫展',
  '粉丝见面', '线下活动', '线下见面', '线下面基', '面基', '参展', '展会',
  '签到', '现场', '主办方', '票务', '门票', '售票', '预约报名',
  '到场', '出席', '舞台剧', '演出',
];

function isOfflineEvent(title = '', content = '') {
  const text = `${title}\n${content}`;
  return OFFLINE_KEYWORDS.some(k => text.includes(k));
}

// 单日期事件 = start 到 end 横跨 ≤ 1 自然日（不是「24h 时长」）
// 适用于：复刻/季节/活动/双倍/大蜡烛等持续型事件；维护除外
function isSingleDayEvent(event) {
  if (!event || !event.start || !event.end) return false;
  const s = beijingDateParts(event.start);
  const e = beijingDateParts(event.end);
  if (!s.year || !e.year) return false;
  // 跨自然日数
  const dayDiff = Math.floor((Date.UTC(e.year, e.month - 1, e.day) - Date.UTC(s.year, s.month - 1, s.day)) / 86400000);
  return dayDiff <= 0;
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
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
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

function resolveRangeYears(startMonth, endMonth, baseYear) {
  const startYear = baseYear;
  const endYear = endMonth < startMonth ? baseYear + 1 : baseYear;
  return { startYear, endYear };
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

  // Tight format: 6月12日01:00~10:00 (no space between day and time)
  const tightDayRange = text.match(/(\d{1,2})月(\d{1,2})日(\d{1,2})[:：](\d{2})\s*(?:至|到|~|—|-)\s*(\d{1,2})[:：](\d{2})/);
  if (tightDayRange) {
    const month = Number(tightDayRange[1]);
    const day = Number(tightDayRange[2]);
    const startHour = Number(tightDayRange[3]);
    const startMinute = Number(tightDayRange[4]);
    const endHour = Number(tightDayRange[5]);
    const endMinute = Number(tightDayRange[6]);
    let start = parseBeijingDateTime(year, month, day, startHour, startMinute);
    let end = parseBeijingDateTime(year, month, day, endHour, endMinute);
    if (end <= start) end = addDays(end, 1);
    return { start: start.toISOString(), end: end.toISOString() };
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

  const fullYearRange = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：](\d{2}))?\s*(?:期间|至|到|~|—|-)\s*(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：](\d{2}))?/);
  if (fullYearRange) {
    const start = parseBeijingDateTime(
      Number(fullYearRange[1]),
      Number(fullYearRange[2]),
      Number(fullYearRange[3]),
      Number(fullYearRange[4] || 0),
      Number(fullYearRange[5] || 0),
    );
    const end = parseBeijingDateTime(
      Number(fullYearRange[6]),
      Number(fullYearRange[7]),
      Number(fullYearRange[8]),
      Number(fullYearRange[9] || 23),
      Number(fullYearRange[10] || 59),
    );
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const monthDayRange = text.match(/(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：](\d{2}))?\s*(?:期间|至|到|~|—|-)\s*(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：](\d{2}))?/);
  if (monthDayRange) {
    const startMonth = Number(monthDayRange[1]);
    const startDay = Number(monthDayRange[2]);
    const endMonth = Number(monthDayRange[5]);
    const endDay = Number(monthDayRange[6]);
    const { startYear, endYear } = resolveRangeYears(startMonth, endMonth, year);
    const start = parseBeijingDateTime(
      startYear,
      startMonth,
      startDay,
      Number(monthDayRange[3] || 0),
      Number(monthDayRange[4] || 0),
    );
    const end = parseBeijingDateTime(
      endYear,
      endMonth,
      endDay,
      Number(monthDayRange[7] || 23),
      Number(monthDayRange[8] || 59),
    );
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const omittedMonthRange = text.match(/(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[:：](\d{2}))?\s*(?:期间|至|到|~|—|-)\s*(\d{1,2})日(?:\s*(\d{1,2})[:：](\d{2}))?/);
  if (omittedMonthRange) {
    const startMonth = Number(omittedMonthRange[1]);
    const startDay = Number(omittedMonthRange[2]);
    const endDay = Number(omittedMonthRange[5]);
    const start = parseBeijingDateTime(
      year,
      startMonth,
      startDay,
      Number(omittedMonthRange[3] || 0),
      Number(omittedMonthRange[4] || 0),
    );
    const end = parseBeijingDateTime(
      year,
      startMonth,
      endDay,
      Number(omittedMonthRange[6] || 23),
      Number(omittedMonthRange[7] || 59),
    );
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const dateTime = '(\\d{1,2})月(\\d{1,2})日(?:\\s*(\\d{1,2})[:：](\\d{2}))?';
  const between = new RegExp(`${dateTime}[\\s\\S]{0,20}(?:至|到|~|—|-)[\\s\\S]{0,20}${dateTime}`);
  const range = text.match(between);
  if (range) {
    const startMonth = Number(range[1]);
    const endMonth = Number(range[5]);
    const { startYear, endYear } = resolveRangeYears(startMonth, endMonth, year);
    const start = parseDateMatch([null, range[1], range[2], range[3], range[4]], startYear);
    const end = parseDateMatch([null, range[5], range[6], range[7] ?? '23', range[8] ?? '59'], endYear);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  const startOnly = text.match(new RegExp(dateTime));
  if (!startOnly) return null;
  const start = parseDateMatch(startOnly, year);
  const end = addDays(start, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function uidPart(value) {
  const text = String(value || 'event');
  const ascii = text.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  const hash = fnv1a(text);
  return ascii ? `${ascii}-${hash}` : `event-${hash}`;
}

function extractContextualDateRange(title = '', content = '', now = new Date(), patterns = []) {
  const text = cleanText(`${title}\n${content}`);
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index++) {
    if (!patterns.some(pattern => pattern.test(lines[index]))) continue;
    const windowText = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 3)).join('\n');
    const range = extractDateRange('', windowText, now);
    if (range) return range;
  }
  return extractDateRange(title, content, now);
}

function extractBonusDateRange(title = '', content = '', now = new Date()) {
  return extractContextualDateRange(title, content, now, [
    /好友[将可]?收获双倍(?:爱心|心火|烛火|季蜡|蜡烛)/,
    /好友可获得双倍(?:爱心|心火|烛火|季蜡|蜡烛)/,
    /双倍(?:爱心|心火|烛火|季蜡|蜡烛)/,
    /额外烛火/,
  ]);
}

function extractCandleHeapDateRange(title = '', content = '', now = new Date()) {
  return extractContextualDateRange(title, content, now, [
    /大蜡烛堆将出现在天空王国各地/,
    /大蜡烛堆/,
  ]);
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (const ch of String(value || '')) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
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

function buildReminderEvents(events, options = {}) {
  const types = new Set(options.types || Object.keys(TYPE_LABELS));
  const spiritInfo = options.spiritInfo instanceof Map ? options.spiritInfo : new Map();
  const endOnly = options.endOnly instanceof Set
    ? options.endOnly
    : new Set(Array.isArray(options.endOnly) ? options.endOnly : []);
  const blocks = [];

  for (const event of events || []) {
    if (!event || event.enabled !== true || !types.has(event.type)) continue;
    if (!event.start || !event.end || new Date(event.end) <= new Date(event.start)) continue;

    const label = TYPE_LABELS[event.type] || event.type;
    const id = compactUid(event.sourceFeedId || event.id || event.title);
    const title = event.title || label;
    const start = new Date(event.start);
    const end = new Date(event.end);
    const dtstamp = formatUTC(new Date(event.updatedAt || event.start));
    const durationDays = eventDurationDays(event);
    // 连续事件默认全部全天（用户决策：持续事件无明确时间点，用全天更直观）
    const useAllDay = true;

    if (event.type === 'activity' && !isLikelyGameActivity(event)) {
      continue;
    }

    const summary = shortSummary(title, label);
    const reminder = REMINDERS[event.type] || REMINDERS.activity;
    const spiritName = event.type === 'traveling_spirit' ? cleanSpiritEventName(title) : '';
    const info = spiritName ? (spiritInfo.get(spiritName) || {}) : {};
    const spiritDetails = event.type === 'traveling_spirit'
      ? [
          info.season ? `所属季节: ${info.season}` : '',
          Array.isArray(info.items) && info.items.length ? `可兑换物品: ${info.items.filter(Boolean).slice(0, 8).join('、')}` : '',
          info.wikiUrl ? `Wiki: ${info.wikiUrl}` : '',
        ].filter(Boolean)
      : [];

    if (event.type === 'maintenance') {
      const maintenanceTitle = summary.replace(/^【[^】]+】/, '');
      const maintenanceDesc = buildDescription([
        `标题: ${summary}`,
        `开始时间: ${beijingText(start)}`,
        `结束时间: ${beijingText(end)}`,
      ]);

      if (!endOnly.has(event.type)) {
        blocks.push(createTimedEvent({
          uid: `${id}-start-reminder@sky-stones-ics`,
          dtstamp,
          start,
          end: addMinutes(start, 1),
          summary: `【维护开始】${maintenanceTitle}`,
          description: maintenanceDesc,
          location: label,
          category: label,
          alarm: { trigger: '-PT0M', description: '维护开始' },
        }));
      }

      blocks.push(createTimedEvent({
        uid: `${id}-end-reminder@sky-stones-ics`,
        dtstamp,
        start: end,
        end: addMinutes(end, 1),
        summary: `【维护结束】${maintenanceTitle}`,
        description: maintenanceDesc,
        location: label,
        category: label,
        alarm: { trigger: '-PT0M', description: '维护结束' },
      }));
      continue;
    }

    // 1) range 事件（持续事件，全天格式）
    if (!endOnly.has(event.type)) {
      const rangeDesc = buildDescription([
        `类型: ${label}`,
        `标题: ${summary}`,
        `时间: ${beijingText(start)} - ${beijingText(end)}`,
        ...spiritDetails,
      ]);
      const rangeAlarm = { trigger: reminder.start, description: reminder.startDesc };
      const rangeUid = `${id}-range@sky-stones-ics`;
      blocks.push(createAllDayEvent({
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
    // 智能提前量：
    //   - 若 end 为北京时间当日 00:00（= 当日 0 点结束），则提前到当日 20:00（= 4 小时前）
    //   - 否则按 reminder.end 提前
    if (event.type !== 'maintenance' || endOnly.has(event.type)) {
      // end 提醒 SUMMARY 直接带标题，方便 iOS 列表一眼看出
      const endSummary = summary.replace(/^【[^】]+】/, '');
      const endTitle = event.type === 'traveling_spirit'
        ? `【先祖离开】${endSummary}`
        : event.type === 'season'
          ? `【季节结束】${endSummary} 明天就要结束了`
          : event.type === 'activity'
            ? `【活动结束】${endSummary}`
            : `${summary} 即将结束`;
      const { endStart, leadLabel } = computeEndReminderStart(end, reminder);
      const endDesc = buildDescription([
        `标题: ${summary}`,
        `结束时间: ${beijingText(end)}`,
        `提醒: ${leadLabel}（事件开始时响）`,
        ...spiritDetails,
      ]);
      const endUid = `${id}-end-reminder@sky-stones-ics`;
      blocks.push(createTimedEvent({
        uid: endUid,
        dtstamp,
        start: endStart,
        end,
        summary: endTitle,
        description: endDesc,
        location: label,
        category: label,
        alarm: { trigger: '-PT0M', description: leadLabel },
      }));
    }
  }

  return blocks;
}

// 计算 end 提醒事件 DTSTART：
//   - 算 end 当日 20:00 北京嘅时间点 = endBeijing8pm
//   - 若 leadMinutes (按 reminder.end 提前) 对应嘅时间点 < endBeijing8pm
//     （即「正常提前」会响 8 点之后），就改用 endBeijing8pm
//   - 否则按 reminder.end
function computeEndReminderStart(end, reminder) {
  const baseLabel = reminder.endDesc;
  const leadMinutes = parseISODurationMinutes(reminder.end);

  // 拎 end 北京时间部分（年月日时分）
  const beijingParts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(end);
  const get = (t) => Number(beijingParts.find(p => p.type === t)?.value);

  // endBeijing8pm = end 当日 20:00 北京
  const endBJ8pm = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), 20 - 8, 0, 0));
  // UTC = 北京 - 8h，所以 20:00 北京 = 12:00 UTC（同日）

  // 按 reminder 提前后嘅时间点
  const leadStart = addMinutes(end, -leadMinutes);

  // 如果 leadStart 晚过 20:00（响 20:00 之后），就提前到 20:00
  if (leadStart.getTime() > endBJ8pm.getTime()) {
    return {
      endStart: endBJ8pm,
      leadLabel: `${baseLabel}（已提前到 20:00 提醒）`,
    };
  }
  return { endStart: leadStart, leadLabel: baseLabel };
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
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...blocks,
    'END:VCALENDAR',
  ]);
}

function generateSpiritEventsICS(events, options = {}) {
  const name = options.name || '光遇·指定先祖';
  const selected = Array.isArray(options.selected) ? options.selected : [];
  const spiritInfo = options.spiritInfo instanceof Map ? options.spiritInfo : new Map();
  const blocks = [];

  for (const event of events || []) {
    if (!event || event.enabled !== true || event.type !== 'traveling_spirit') continue;
    if (!event.start || !event.end || new Date(event.end) <= new Date(event.start)) continue;
    const spiritName = cleanSpiritEventName(event.title);
    if (selected.length && !selected.map(cleanSpiritEventName).includes(spiritName)) continue;
    const info = spiritInfo.get(spiritName) || {};
    const items = Array.isArray(info.items) ? info.items.filter(Boolean).slice(0, 8) : [];
    const start = new Date(event.start);
    const end = new Date(event.end);
    const dtstamp = formatUTC(new Date(event.updatedAt || event.start));
    const desc = buildDescription([
      `${spiritName}返场`,
      `开始: ${beijingText(start)}`,
      `离开: ${beijingText(end)}`,
      items.length ? `物品: ${items.join('、')}` : '',
    ].filter(Boolean));
    const id = compactUid(event.id || event.sourceFeedId || spiritName);

    blocks.push(createTimedEvent({
      uid: `${id}-spirit-range@sky-stones-ics`,
      dtstamp,
      start,
      end,
      summary: `【复刻】${spiritName}返场`,
      description: desc,
      location: '旅行先祖',
      category: '复刻',
      alarm: { trigger: '-PT10M', description: `${spiritName}将在 10 分钟后到来` },
    }));
  }

  return buildLines([
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mo-sky-stones//Sky:CoL Spirit Events (CN)//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(name)}`,
    `X-WR-CALDESC:${escapeICS(selected.length ? `光遇指定先祖提醒：${selected.join('、')}` : '光遇指定先祖提醒')}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...blocks,
    'END:VCALENDAR',
  ]);
}

function cleanSpiritEventName(value) {
  return String(value || '')
    .replace(/^【[^】]+】/, '')
    .replace(/^旅行先祖[:：]/, '')
    .replace(/返场$/, '')
    .trim();
}

function normalizeFeed(raw) {
  const id = String(raw.id || raw.feedId || raw.feed_id || '');
  const body = parseContentPayload(raw.content) || parseContentPayload(raw.detail?.result?.feed?.content) || {};
  const title = cleanText(body.title || raw.title || raw.share_title || raw.summary || raw.contentTitle || '');
  const bodyText = cleanText(body.text || '');
  const longText = cleanText(body.longText || '');
  const content = longText || bodyText || cleanText(raw.text || raw.desc || raw.plainText || raw.content || '');
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
  SPIRIT_DROP_KEYWORDS,
  buildReminderEvents,
  cleanText,
  cleanEventTitle,
  detectType,
  escapeICS,
  extractBonusLabel,
  extractBonusDateRange,
  extractCandleHeapDateRange,
  extractTravelingSpiritLabel,
  extractDateRange,
  formatUTC,
  generateEventsICS,
  generateSpiritEventsICS,
  isLikelyGameActivity,
  isOfflineEvent,
  isSingleDayEvent,
  isTravelingSpiritUpcoming,
  normalizeFeed,
  parseISODurationMinutes,
  uidPart,
};
