'use strict';

// Bounded runtime-store helpers.
// Roon Log Watcher is intentionally runtime-only: it follows new log lines and does not
// persist a database. Long sessions can still generate many memory samples, incidents and
// log rows, so every list that feeds the dashboard should be trimmed through this module.
function toLimit(maxItems) {
  return Math.max(1, Number(maxItems || 1));
}

function pushBounded(list, item, maxItems) {
  list.push(item);
  trimBounded(list, maxItems);
  return item;
}

function trimBounded(list, maxItems) {
  const limit = toLimit(maxItems);
  if (list.length > limit) list.splice(0, list.length - limit);
  return list;
}

function pushUniqueBounded(list, item, maxItems, keyFn) {
  if (typeof keyFn === 'function') {
    const key = keyFn(item);
    if (list.some(existing => keyFn(existing) === key)) return { inserted: false, item };
  }
  pushBounded(list, item, maxItems);
  return { inserted: true, item };
}

function newest(list, count) {
  return list.slice(-Math.max(0, Number(count || 0))).reverse();
}

function addTimelineEvent({ list, event, maxItems, dedupeMap, normalizeSeverity, defaultDedupeMs = 15000 }) {
  const now = Date.now();
  const base = event || {};
  const normalized = Object.assign({
    id: now + '-' + Math.random().toString(16).slice(2),
    time: new Date().toISOString(),
    severity: 'info'
  }, base);
  if (typeof normalizeSeverity === 'function') normalized.severity = normalizeSeverity(normalized.severity, normalized);

  const key = `${normalized.type || 'event'}|${normalized.source || ''}|${normalized.title || ''}|${String(normalized.message || '').slice(0, 120)}`;
  const dedupeMs = Math.max(1000, Number(normalized.dedupeMs || defaultDedupeMs));
  if (dedupeMap && now - (dedupeMap.get(key) || 0) < dedupeMs) return null;
  if (dedupeMap) dedupeMap.set(key, now);
  return pushBounded(list, normalized, maxItems);
}

function addIncidentEvent({ list, event, maxItems, dedupeMap, normalizeSeverity, defaultDedupeMs = 60000 }) {
  const now = Date.now();
  const base = event || {};
  const key = `${base.type || 'incident'}|${base.title || ''}|${base.source || ''}`;
  const dedupeMs = Math.max(5000, Number(base.dedupeMs || defaultDedupeMs));
  if (dedupeMap && now - (dedupeMap.get(key) || 0) < dedupeMs) return null;
  if (dedupeMap) dedupeMap.set(key, now);
  const enriched = Object.assign({
    id: now + '-' + Math.random().toString(16).slice(2),
    time: new Date().toISOString(),
    severity: 'info',
    confidence: 'medium',
    occurrences: 1,
    likelyCause: '',
    recommendation: ''
  }, base);
  if (typeof normalizeSeverity === 'function') enriched.severity = normalizeSeverity(enriched.severity, enriched);
  return pushBounded(list, enriched, maxItems);
}

module.exports = {
  pushBounded,
  trimBounded,
  pushUniqueBounded,
  newest,
  addTimelineEvent,
  addIncidentEvent
};
