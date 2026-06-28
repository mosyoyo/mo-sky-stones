const assert = require('assert');
const { hasSimilarEvent } = require('./mergeEvents');

const wikiDragonBoat = {
  type: 'activity',
  title: '【活动】端午节',
  start: '2026-06-19T04:00:00.000Z',
  end: '2026-07-02T04:00:00.000Z',
};

const neteaseDragonBoat = {
  type: 'activity',
  title: '【活动】端午节',
  start: '2026-06-18T16:00:00.000Z',
  end: '2026-07-02T15:59:00.000Z',
};

const neteaseAnniversary = {
  type: 'activity',
  title: '【活动】周年庆',
  start: '2026-07-04T04:00:00.000Z',
  end: '2026-07-24T04:00:00.000Z',
};

assert.strictEqual(hasSimilarEvent([wikiDragonBoat], neteaseDragonBoat), true);
assert.strictEqual(hasSimilarEvent([wikiDragonBoat], neteaseAnniversary), false);

console.log('mergeEvents tests passed');
