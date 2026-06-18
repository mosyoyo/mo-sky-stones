function matchSpirit(event, selected) {
  if (!event || event.type !== 'traveling_spirit') return false;
  const names = Array.isArray(event._names) ? event._names.join('\n') : '';
  const text = `${event.title || ''}\n${event.id || ''}\n${event.sourceFeedId || ''}\n${names}`;
  return (selected || []).some(name => {
    const needle = String(name || '').trim();
    return needle && text.includes(needle);
  });
}

module.exports = { matchSpirit };
