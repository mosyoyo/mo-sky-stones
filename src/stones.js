const TIME_SLOTS = {
  2: ['09:08~10:00', '14:08~15:00', '19:08~20:00'],
  3: ['09:08~10:00', '15:08~16:00', '21:08~22:00'],
  5: ['11:08~12:00', '17:08~18:00', '23:08~24:00'],
  6: ['10:08~11:00', '14:08~15:00', '22:08~23:00'],
  0: ['07:08~08:00', '13:08~14:00', '19:08~20:00'],
};

const MAPS = ['霞谷', '暮土', '禁阁', '云野', '雨林'];

const AREAS = {
  霞谷: { 2: '滑冰场', 3: '滑冰场', 5: '圆梦村', 6: '圆梦村', 0: '雪隐峰' },
  暮土: { 2: '边陲荒漠', 3: '远古战场', 5: '黑水港湾', 6: '巨兽荒原', 0: '失落方舟' },
  禁阁: { 2: '星光沙漠', 3: '星光沙漠', 5: '商船星球', 6: '商船星球', 0: '商船星球' },
  云野: { 2: '蝴蝶平原', 3: '仙乡', 5: '云顶浮石', 6: '幽光山洞', 0: '圣岛' },
  雨林: { 2: '荧光森林', 3: '密林遗迹', 5: '大树屋', 6: '雨林神殿', 0: '秘密花园' },
};

const DAYS = {
  red: {
    firstHalf: [6, 0],
    secondHalf: [5, 0],
  },
  black: {
    firstHalf: [2],
    secondHalf: [3],
  },
};

export function stoneTypeOn(date) {
  const day = beijingPlainDate(date);
  const dayOfWeek = day.getUTCDay();
  const half = day.getUTCDate() <= 15 ? 'firstHalf' : 'secondHalf';

  if (DAYS.red[half].includes(dayOfWeek)) return 'red';
  if (DAYS.black[half].includes(dayOfWeek)) return 'black';
  return null;
}

export function lastStoneEventOn(date, wantedType = 'red') {
  const day = beijingPlainDate(date);
  const type = stoneTypeOn(day);
  if (type !== wantedType) return null;

  const dayOfWeek = day.getUTCDay();
  const slots = TIME_SLOTS[dayOfWeek] ?? [];
  if (slots.length === 0) return null;

  const slot = pickSlot(slots);
  const [startTime, endTime] = slot.split('~');
  const map = MAPS[day.getUTCDate() % MAPS.length];

  return {
    type,
    map,
    area: AREAS[map]?.[dayOfWeek] ?? '',
    startTime,
    endTime,
  };
}

export function upcomingStoneEvents(wantedType = 'red', days = 120, from = new Date()) {
  const start = beijingPlainDate(from);

  const events = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate() + offset
    ));

    const event = lastStoneEventOn(date, wantedType);
    if (event) events.push({ date, event });
  }

  return events;
}

function pickSlot(slots) {
  const last = slots.at(-1);
  const [hour] = last.split('~')[0].split(':').map(Number);

  if (hour >= 23 && slots.length > 1) {
    return slots.at(-2);
  }

  return last;
}

function beijingPlainDate(date) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    beijing.getUTCFullYear(),
    beijing.getUTCMonth(),
    beijing.getUTCDate()
  ));
}
