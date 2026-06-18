function disableFeedEvents(events, feedId) {
  for (const event of events || []) {
    if (event.sourceFeedId === feedId) event.enabled = false;
  }
}

function shouldKeepFeedEvent(feed, parsed) {
  return feed?.status === 'approved'
    && parsed?.type !== 'other'
    && Boolean(parsed?.start)
    && Boolean(parsed?.end);
}

module.exports = { disableFeedEvents, shouldKeepFeedEvent };
