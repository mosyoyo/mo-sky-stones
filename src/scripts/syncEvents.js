const { main: fetchFeeds } = require('./fetchFeeds');
const { main: parseFeed } = require('./parseFeed');
const { main: buildEvents } = require('./buildEvents');

async function main() {
  await fetchFeeds();
  parseFeed();
  buildEvents();
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
