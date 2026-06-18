function disableFeedEvents(events, feedId) {
  for (const event of events || []) {
    if (event.sourceFeedId === feedId) event.enabled = false;
  }
}

module.exports = { disableFeedEvents };
