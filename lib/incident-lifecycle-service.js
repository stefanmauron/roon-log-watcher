'use strict';

function createIncidentLifecycleService(options) {
  const {
    metricsStore,
    incidentEvents,
    incidentLifecycles,
    timelineEvents,
    alertEvents,
    incidentMaxEvents,
    normalizeSeverity,
    normalizeZoneName,
    extractZoneFromLine,
    addTimelineEvent,
    calculateHealthScore
  } = options;

  const activeIncidentLifecycles = new Map();
  const incidentDedup = new Map();
  const incidentCounters = new Map();
  let incidentLifecycleSequence = 0;

  function addIncident(event) {
    const enriched = metricsStore.addIncidentEvent({
      list: incidentEvents,
      event,
      maxItems: incidentMaxEvents,
      dedupeMap: incidentDedup,
      normalizeSeverity
    });
    if (!enriched) return null;
    const dedupeMs = Math.max(5000, Number((event && event.dedupeMs) || 60000));
    addTimelineEvent({
      type: 'incident',
      severity: enriched.severity,
      title: enriched.title,
      message: (enriched.likelyCause ? enriched.likelyCause + ' — ' : '') + (enriched.message || ''),
      source: enriched.source || '',
      dedupeMs
    });
    registerIncidentLifecycle(enriched);
    return enriched;
  }

  function getIncidentZone(event) {
    const candidates = [
      event.zone,
      event.affectedZone,
      extractZoneFromLine(event.message || ''),
      extractZoneFromLine(event.lastLine || ''),
      extractZoneFromLine(event.title || '')
    ];
    for (const item of candidates) {
      const zone = normalizeZoneName(item);
      if (zone && zone !== 'Unknown zone') return zone;
    }
    return 'Unknown zone';
  }

  function getIncidentImpact(severity, type) {
    const sev = String(severity || '').toLowerCase();
    const t = String(type || '').toLowerCase();
    if (sev === 'critical') return 'high';
    if (/exception|crash|database|audio-zone|raat/.test(t)) return sev === 'warning' ? 'medium' : 'low';
    if (sev === 'warning') return 'medium';
    return 'low';
  }

  function shouldSuppressUnknownZoneLifecycle(event, zone) {
    const z = normalizeZoneName(zone);
    if (z !== 'Unknown zone') return false;
    const severity = String(event.severity || '').toLowerCase();
    const type = String(event.type || event.title || '').toLowerCase();
    const text = [event.message, event.likelyCause, event.recommendation, event.lastLine, event.title].filter(Boolean).join(' ').toLowerCase();

    if (severity === 'critical') return false;
    if (/exception|crash|fatal|stacktrace|segmentation/.test(type + ' ' + text)) return false;
    if (/raat|endpoint|audio-zone|device-lost|transport/.test(type) && /disconnect|lost|timeout|drop|unavailable/.test(text)) return false;

    if (/playback session completed|normal playback transition|track advanced|sync|regroup|zone transition|dbperf|flush|downloaded files|allblockdownloaded/.test(text)) return true;
    if (/database-stress|remote-access-connectivity|streaming-metadata-issues/.test(type)) return true;
    if (severity === 'info') return true;
    return false;
  }

  function registerIncidentLifecycle(event) {
    const type = String(event.type || event.title || 'incident');
    const zone = getIncidentZone(event);
    if (shouldSuppressUnknownZoneLifecycle(event, zone)) return;
    const key = type + '|' + zone;
    let item = activeIncidentLifecycles.get(key);
    const nowIso = new Date().toISOString();
    if (!item) {
      incidentLifecycleSequence += 1;
      item = {
        id: 'il-' + incidentLifecycleSequence,
        type,
        title: event.title || type,
        status: 'started',
        startedAt: nowIso,
        degradedAt: null,
        recoveredAt: null,
        updatedAt: nowIso,
        durationMs: 0,
        impact: getIncidentImpact(event.severity, type),
        affectedZone: zone,
        severity: event.severity || 'info',
        occurrences: Number(event.occurrences || 1),
        source: event.source || '',
        message: event.message || '',
        likelyCause: event.likelyCause || '',
        recommendation: event.recommendation || ''
      };
      activeIncidentLifecycles.set(key, item);
      metricsStore.pushBounded(incidentLifecycles, item, 120);
    } else {
      item.status = 'degraded';
      if (!item.degradedAt) item.degradedAt = nowIso;
      item.updatedAt = nowIso;
      item.durationMs = new Date(item.updatedAt).getTime() - new Date(item.startedAt).getTime();
      item.impact = getIncidentImpact(event.severity, type);
      item.severity = event.severity || item.severity;
      item.occurrences = Math.max(Number(item.occurrences || 1), Number(event.occurrences || 1));
      item.message = event.message || item.message;
      item.likelyCause = event.likelyCause || item.likelyCause;
      item.recommendation = event.recommendation || item.recommendation;
    }
  }

  function recoverIncidentLifecyclesForZone(zone, reason) {
    const normalized = normalizeZoneName(zone);
    const nowIso = new Date().toISOString();
    for (const [key, item] of activeIncidentLifecycles.entries()) {
      if (item.recoveredAt) continue;
      if (normalized !== 'Unknown zone' && item.affectedZone !== 'Unknown zone' && item.affectedZone !== normalized) continue;
      item.status = 'recovered';
      item.recoveredAt = nowIso;
      item.updatedAt = nowIso;
      item.durationMs = new Date(item.recoveredAt).getTime() - new Date(item.startedAt).getTime();
      item.recoveryReason = reason || 'Playback recovered';
      activeIncidentLifecycles.delete(key);
    }
  }

  function getIncidentLifecycleSnapshot() {
    const now = Date.now();
    return incidentLifecycles.slice(-80).map(item => {
      const started = new Date(item.startedAt).getTime();
      const end = item.recoveredAt ? new Date(item.recoveredAt).getTime() : now;
      return Object.assign({}, item, {
        durationMs: Math.max(0, end - started),
        durationSec: Math.round(Math.max(0, end - started) / 1000)
      });
    }).sort((a, b) => new Date(b.updatedAt || b.startedAt).getTime() - new Date(a.updatedAt || a.startedAt).getTime());
  }

  function rememberIncidentSignal(type, source, windowMs) {
    const now = Date.now();
    const key = `${type}|${source || ''}`;
    const arr = (incidentCounters.get(key) || []).filter(t => now - t <= windowMs);
    arr.push(now);
    incidentCounters.set(key, arr);
    return arr.length;
  }

  function getIncidentHealthScore() {
    return calculateHealthScore({ incidentEvents, timelineEvents, alertEvents });
  }

  return {
    addIncident,
    recoverIncidentLifecyclesForZone,
    getIncidentLifecycleSnapshot,
    rememberIncidentSignal,
    getIncidentHealthScore,
    getDebugState: () => ({ active: activeIncidentLifecycles.size, deduped: incidentDedup.size, counters: incidentCounters.size })
  };
}

module.exports = { createIncidentLifecycleService };
