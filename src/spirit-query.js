function parseSelectedSpirits(url, saved) {
  const params = new URL(url).searchParams;
  const raw = params.get('spirits') || params.get('names') || '';
  const selected = raw
    ? raw.split(',').map(name => decodeURIComponent(name).trim()).filter(Boolean)
    : Array.isArray(saved?.selected)
      ? saved.selected.map(name => String(name || '').trim()).filter(Boolean)
      : [];
  return [...new Set(selected)].slice(0, 3);
}

module.exports = { parseSelectedSpirits };
