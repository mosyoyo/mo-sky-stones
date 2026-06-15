import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateCalendar } from './src/ics.js';
import { lastStoneEventOn, upcomingStoneEvents } from './src/stones.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const red = generateCalendar('red', { days: 120, from: new Date('2026-06-15T00:00:00+08:00') });
const black = generateCalendar('black', { days: 120, from: new Date('2026-06-15T00:00:00+08:00') });

fs.writeFileSync(path.join(__dirname, 'preview-red.ics'), red);
fs.writeFileSync(path.join(__dirname, 'preview-black.ics'), black);

assert.match(red, /^BEGIN:VCALENDAR\r\nVERSION:2.0\r\n/);
assert.match(red, /DTSTART:\d{8}T\d{6}Z\r\n/);
assert.doesNotMatch(red + black, /T240000/);
assert.doesNotMatch(red + black, /DESCRIPTION|LOCATION|VALARM|TZID|X-WR-|来源|source|github\.com/i);

const friday = new Date('2026-06-19T00:00:00+08:00');
assert.equal(lastStoneEventOn(friday, 'red').startTime, '17:08');
assert.equal(upcomingStoneEvents('red', 1, new Date('2026-06-18T16:30:00Z'))[0].date.getUTCDate(), 19);

const redEvents = upcomingStoneEvents('red', 120, new Date('2026-06-15T00:00:00+08:00'));
const dates = new Set(redEvents.map(({ date }) => date.toISOString().slice(0, 10)));
assert.equal(dates.size, redEvents.length);

console.log(`Generated ${eventCount(red)} red events and ${eventCount(black)} black events.`);
console.log('ICS compatibility checks passed.');

function eventCount(ics) {
  return (ics.match(/BEGIN:VEVENT/g) ?? []).length;
}
