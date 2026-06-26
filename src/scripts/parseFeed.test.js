const assert = require('assert');
const { detectType, extractCandleHeapDateRange, extractDateRange, normalizeFeed } = require('../event-utils');
const { parseFeed, parseFeedVariants } = require('./parseFeed');
const { readJSON } = require('./common');

function feedById(id) {
  const feeds = readJSON('feeds.json', []);
  const feed = feeds.find(item => item.id === id);
  assert(feed, `missing fixture feed ${id}`);
  return feed.raw ? { ...feed, ...normalizeFeed(feed.raw) } : feed;
}

function assertRange(actual, start, end, label) {
  assert.deepStrictEqual(
    { start: actual.start, end: actual.end },
    { start, end },
    label,
  );
}

{
  const feed = feedById('68a7cf29096b31459c78faa9');
  assert(feed.content.includes('我们将在8月28日 01:00~10:00进行版本更新'), 'longText should be visible');
  assert.strictEqual(detectType(feed.title, feed.content), 'maintenance');
  assertRange(parseFeed(feed), '2025-08-27T17:00:00.000Z', '2025-08-28T02:00:00.000Z', 'maintenance longText time');
}

{
  const feed = feedById('6a36104746804c0398433bec');
  const parsed = parseFeed(feed);
  assert.strictEqual(parsed.type, 'bonus');
  assert.strictEqual(parsed.title, '【双倍】双倍爱心');
  assertRange(parsed, '2026-06-20T16:00:00.000Z', '2026-06-27T15:59:00.000Z', 'double hearts range');
}

{
  const feed = feedById('69b0ea851c874c5d28969990');
  const parsed = parseFeed(feed);
  assert.strictEqual(parsed.type, 'bonus');
  assert.strictEqual(parsed.title, '【双倍】双倍心火');
  assertRange(parsed, '2026-03-11T16:00:00.000Z', '2026-03-18T15:59:00.000Z', 'double light range');
}

{
  const feed = feedById('6933aa47e273a4279341694a');
  const parsed = parseFeed(feed);
  assert.strictEqual(parsed.type, 'bonus');
  assert.strictEqual(parsed.title, '【双倍】双倍爱心');
  assertRange(parsed, '2025-12-06T16:00:00.000Z', '2025-12-13T15:59:00.000Z', 'omitted month range');
}

{
  const feed = feedById('6950c7683352477c9553899b');
  const parsed = parseFeed(feed);
  assert.strictEqual(parsed.type, 'bonus');
  assert.strictEqual(parsed.title, '【双倍】双倍心火');
  assertRange(parsed, '2025-12-31T16:00:00.000Z', '2026-01-07T15:59:00.000Z', 'explicit year range');
}

{
  const feed = feedById('6965c3480a702c7f59f95da2');
  assert.strictEqual(detectType(feed.title, feed.content), 'candle_heap');
  assertRange(
    extractDateRange(feed.title, feed.content, new Date(Number(feed.createTime))),
    '2026-01-14T16:00:00.000Z',
    '2026-01-21T15:59:00.000Z',
    'candle heap range',
  );
  assert.strictEqual(parseFeed(feed).type, 'candle_heap');
}

{
  const feed = feedById('6891579632744c08451361af');
  const variants = parseFeedVariants(feed);
  assert.deepStrictEqual(variants.map(item => item.type), ['bonus']);
  assertRange(variants[0], '2025-08-05T16:00:00.000Z', '2025-08-12T15:59:00.000Z', 'weekly double light range');
}

{
  const feed = feedById('682ae5084a18c1699d6ada2d');
  assert.strictEqual(detectType(feed.title, feed.content), 'bonus');
  const variants = parseFeedVariants(feed);
  assert.deepStrictEqual(variants.map(item => item.type), ['bonus']);
  assertRange(variants[0], '2025-05-19T16:00:00.000Z', '2025-05-21T15:59:00.000Z', 'double hearts from may 20');
}

{
  const feed = feedById('68d60fc7b9520518a1e70c40');
  assert.strictEqual(detectType(feed.title, feed.content), 'candle_heap');
  assertRange(
    extractCandleHeapDateRange(feed.title, feed.content, new Date(Number(feed.createTime))),
    '2025-09-30T16:00:00.000Z',
    '2025-10-08T15:59:00.000Z',
    'candle heap has priority over embedded double',
  );
  const variants = parseFeedVariants(feed);
  assert.strictEqual(variants.length, 2);
  assert.deepStrictEqual(variants.map(item => item.type), ['candle_heap', 'bonus']);
  assertRange(variants[0], '2025-09-30T16:00:00.000Z', '2025-10-08T15:59:00.000Z', 'candle variant');
  assertRange(variants[1], '2025-09-30T16:00:00.000Z', '2025-10-08T15:59:00.000Z', 'bonus variant');
}

{
  const feed = feedById('67c16d07de937f6e153c427f');
  assert.strictEqual(detectType(feed.title, feed.content), 'other');
  assert.strictEqual(parseFeed(feed).type, 'other');
}

console.log('parseFeed tests passed');
