const { generateEventsICS } = require('../event-utils');
const { readJSON, writeRoot } = require('./common');

function main() {
  const events = readJSON('events.json', []);
  const ics = generateEventsICS(events, {
    name: '光遇·活动提醒',
    description: '光遇国服活动提醒',
  });
  const enabledCount = events.filter(e => e.enabled === true).length;
  if (process.env.WRITE_STATIC_ICS === '1') {
    writeRoot('events.ics', ics);
    console.log(`events.ics generated: ${enabledCount} enabled events`);
    return;
  }
  console.log(`events.ics validated: ${enabledCount} enabled events, ${ics.length} bytes`);
}

if (require.main === module) main();

module.exports = { main };
