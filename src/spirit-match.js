function matchSpirit(event, selected) {
  if (!event || event.type !== 'traveling_spirit') return false;
  const names = new Set([
    cleanSpiritName(event.title),
    ...(Array.isArray(event._names) ? event._names.map(cleanSpiritName) : []),
  ].filter(Boolean));
  const fallback = `${event.id || ''}\n${event.sourceFeedId || ''}`;
  return (selected || []).some(name => {
    const needle = cleanSpiritName(name);
    return needle && (names.has(needle) || fallback.includes(needle));
  });
}

function cleanSpiritName(value) {
  return String(value || '')
    .replace(/^【[^】]+】/, '')
    .replace(/^旅行先祖[:：]/, '')
    .trim();
}

module.exports = { cleanSpiritName, matchSpirit };
