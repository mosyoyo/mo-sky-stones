// 红黑石事件推算引擎
// 规则来源：https://github.com/CikiSyteen/sky-stones
// 国服规则（基于游戏内机制逆向）

const { STONE_CONFIG } = require('./config');

/**
 * 判断某日期是否有红石/黑石
 * @param {Date} date - 当地时区日期
 * @returns {'red' | 'black' | null}
 */
function getStoneType(date) {
  const day = date.getDate();
  const dow = date.getDay(); // 0=周日, 1=周一, ..., 6=周六
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

  const dow = date.getDay();
  const day = date.getDate();
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const lastEvent = getLastEventOnDate(date);
    if (lastEvent && lastEvent.type === filterType) {
      result.push({ date, event: lastEvent });
    }
  }
  return result;
}

module.exports = {
  getStoneType,
  getEventsOnDate,
  getLastEventOnDate,
  generateLastEvents,
};
