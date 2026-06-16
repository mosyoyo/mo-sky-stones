const { generateEventsICS } = require('../event-utils');
const { readJSON, writeRoot } = require('./common');

function main() {
  const events = readJSON('events.json', []);
  const ics = generateEventsICS(events, {
    name: '光遇·活动提醒',
    description: '光遇国服活动提醒',
  });
  writeRoot('events.ics', ics);
  console.log(`events.ics generated: ${(events.filter(e => e.enabled === true)).length} enabled events`);
}

if (require.main === module) main();

module.exports = { main };
