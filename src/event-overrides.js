function eventKey(event) {
  return String(event?.id || event?.sourceFeedId || '').trim();
}

function publicEvent(event) {
  const { _source, _group, _names, ...rest } = event || {};
  return rest;
}

function updateEventOverrides(existingOverrides, beforeEvents, afterEvents) {
  const overrides = new Map((existingOverrides || []).map(event => [eventKey(event), publicEvent(event)]).filter(([key]) => key));
  const beforeKeys = new Set((beforeEvents || []).map(eventKey).filter(Boolean));
  const afterKeys = new Set((afterEvents || []).map(eventKey).filter(Boolean));

  for (const event of afterEvents || []) {
    const key = eventKey(event);
    if (!key) continue;
    overrides.set(key, publicEvent(event));
  }

  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      overrides.set(key, { id: key, enabled: false, deleted: true });
    }
  }

  return [...overrides.values()];
}

function applyEventOverrides(events, overrides) {
  const overrideMap = new Map((overrides || []).map(event => [eventKey(event), publicEvent(event)]).filter(([key]) => key));
  const used = new Set();
  const result = [];

  for (const event of events || []) {
    const key = eventKey(event);
    const override = overrideMap.get(key);
    if (!override) {
      result.push(event);
      continue;
    }
    used.add(key);
    if (override.deleted) continue;
    result.push({ ...event, ...override });
  }

  for (const [key, override] of overrideMap) {
    if (used.has(key) || override.deleted) continue;
    result.push({ enabled: true, ...override, _source: override._source || 'manual' });
  }

  return result;
}

module.exports = {
  applyEventOverrides,
  eventKey,
  publicEvent,
  updateEventOverrides,
};
