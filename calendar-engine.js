// 红黑石事件推算引擎
// 规则来源：https://github.com/CikiSyteen/sky-stones
// 国服规则（基于游戏内机制逆向）

const { STONE_CONFIG } = require('./config');

/**
 * 获取北京时区的日期组件
 * @param {Date} date - UTC Date 对象
 * @returns {{day: number, dow: number}}
 */
function getBeijingDateParts(date) {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const utcDate = new Date(dateStr);
  return {
    day: utcDate.getUTCDate(),
    dow: utcDate.getUTCDay(),
  };
}

/**
 * 获取当前北京日历日的零点对应的 UTC 时间戳
 * @param {Date} [now=new Date()] - 参考时间点
 * @returns {Date} 代表北京日历日零点的 UTC Date 对象
 */
function getBeijingMidnightUTC(now = new Date()) {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000);
}

/**
 * 判断某日期是否有红石/黑石
 * @param {Date} date - Date 对象（北京日历日的零点 UTC 时间戳）
 * @returns {'red' | 'black' | null}
 */
function getStoneType(date) {
  const { day, dow } = getBeijingDateParts(date);
  const isFirstHalf = day <= STONE_CONFIG.halfMonthBoundary;

  if (isFirstHalf) {
    if (STONE_CONFIG.redStoneDays.firstHalf.includes(dow)) return 'red';
    if (STONE_CONFIG.blackStoneDays.firstHalf.includes(dow)) return 'black';
  } else {
    if (STONE_CONFIG.redStoneDays.secondHalf.includes(dow)) return 'red';
    if (STONE_CONFIG.blackStoneDays.secondHalf.includes(dow)) return 'black';
  }
  return null;
}

/**
 * 获取某日期的红黑石事件（全部时段）
 * @param {Date} date
 * @returns {Array<{type, map, area, startTime, endTime}>}
 */
function getEventsOnDate(date) {
  const type = getStoneType(date);
  if (!type) return [];

  const { day, dow } = getBeijingDateParts(date);
  const slots = STONE_CONFIG.timeSlots[dow] || [];
  const map = STONE_CONFIG.maps[day % 5];
  const area = (STONE_CONFIG.areas[map] && STONE_CONFIG.areas[map][dow]) || '';

  return slots.map(slot => {
    const [startTime, endTime] = slot.split('~');
    return { type, map, area, startTime, endTime };
  });
}

/**
 * 获取某日期的"最后一场"红黑石事件
 * 规则：如果最尾一场开始时间 >= 23:00（太晚），则改用前一场
 * @param {Date} date
 * @returns {{type, map, area, startTime, endTime} | null}
 */
function getLastEventOnDate(date) {
  const events = getEventsOnDate(date);
  if (events.length === 0) return null;
  // 时间已按时间顺序排列，取最后一个
  let last = events[events.length - 1];
  // 如果太晚（>= 23:00 才开始），改用前一场
  const [startHH, startMM] = last.startTime.split(':').map(Number);
  if (startHH >= 23 && events.length >= 2) {
    last = events[events.length - 2];
  }
  return last;
}

/**
 * 生成未来 N 天的"最后一场"事件
 * @param {'red' | 'black'} filterType - 过滤红石或黑石
 * @param {number} days
 * @returns {Array<{date: Date, event: Object}>}
 */
function generateLastEvents(filterType, days = 60) {
  const result = [];
  const today = getBeijingMidnightUTC();

  for (let i = 0; i < days; i++) {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const lastEvent = getLastEventOnDate(date);
    if (lastEvent && lastEvent.type === filterType) {
      result.push({ date, event: lastEvent });
    }
  }
  return result;
}

/**
 * 生成未来 N 天的红黑石事件
 * @param {'red' | 'black'} filterType - 过滤红石或黑石
 * @param {number} days
 * @param {{lastOnly?: boolean}} options
 * @returns {Array<{date: Date, event: Object}>}
 */
function generateEvents(filterType, days = 60, options = {}) {
  if (options.lastOnly !== false) return generateLastEvents(filterType, days);

  const result = [];
  const today = getBeijingMidnightUTC();

  for (let i = 0; i < days; i++) {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const events = getEventsOnDate(date).filter(event => event.type === filterType);
    events.forEach(event => result.push({ date, event }));
  }
  return result;
}

module.exports = {
  generateEvents,
  getStoneType,
  getEventsOnDate,
  getLastEventOnDate,
  generateLastEvents,
  getBeijingDateParts,
  getBeijingMidnightUTC,
};
