'use strict';

/**
 * Canonical dashboard API contract for the browser UI.
 *
 * The dashboard used to grow by adding similarly named fields directly to the
 * /api/memory payload. This normalizer keeps backward-compatible aliases while
 * making one explicit data model the source of truth for new UI code.
 */
const DASHBOARD_SCHEMA_VERSION = 1;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDashboardSnapshot(raw) {
  const data = asObject(raw);
  const health = asObject(data.health);
  const canonical = {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    ok: data.ok !== false,
    generatedAt: data.generatedAt || new Date().toISOString(),
    runStartedAt: data.runStartedAt || null,
    server: {
      pid: data.pid || health.pid || process.pid,
      timezoneOffsetMinutes: data.serverTimezoneOffsetMinutes ?? health.serverTimezoneOffsetMinutes ?? null,
      timezoneName: data.serverTimezoneName || health.serverTimezoneName || ''
    },
    counts: {
      pointCount: asNumber(data.pointCount, asArray(data.points).length),
      statsLinesDetected: asNumber(data.statsLinesDetected, 0),
      recentLogCount: asNumber(data.recentLogCount, 0),
      playbackSessionCount: asNumber(data.playbackSessionCount, asArray(data.playbackSessions).length)
    },
    memory: {
      points: asArray(data.points),
      sessionPoints: asArray(data.sessionPoints).length ? asArray(data.sessionPoints) : asArray(data.points),
      latestByMetric: asObject(data.latestByMetric),
      gcEvents: asArray(data.gcEvents),
      correlations: asArray(data.memoryCorrelations)
    },
    events: {
      alerts: asArray(data.alerts),
      timeline: asArray(data.timeline),
      incidents: asArray(data.incidents),
      incidentLifecycle: asArray(data.incidentLifecycle),
      recentLogs: asArray(data.recentLogs)
    },
    playback: {
      sessions: asArray(data.playbackSessions),
      activeSessions: asArray(data.activePlaybackSessions),
      zones: asArray(data.zones)
    },
    health: Object.assign({}, health, {
      score: asNumber(data.healthScore ?? health.healthScore, 100)
    }),
    config: {
      alertConfig: asObject(data.alertConfig)
    }
  };

  // Backward-compatible aliases used by older frontend rendering functions.
  canonical.points = canonical.memory.points;
  canonical.sessionPoints = canonical.memory.sessionPoints;
  canonical.latestByMetric = canonical.memory.latestByMetric;
  canonical.gcEvents = canonical.memory.gcEvents;
  canonical.memoryCorrelations = canonical.memory.correlations;
  canonical.alerts = canonical.events.alerts;
  canonical.timeline = canonical.events.timeline;
  canonical.incidents = canonical.events.incidents;
  canonical.incidentLifecycle = canonical.events.incidentLifecycle;
  canonical.recentLogs = canonical.events.recentLogs;
  canonical.playbackSessions = canonical.playback.sessions;
  canonical.activePlaybackSessions = canonical.playback.activeSessions;
  canonical.zones = canonical.playback.zones;
  canonical.pointCount = canonical.counts.pointCount;
  canonical.statsLinesDetected = canonical.counts.statsLinesDetected;
  canonical.recentLogCount = canonical.counts.recentLogCount;
  canonical.playbackSessionCount = canonical.counts.playbackSessionCount;
  canonical.healthScore = canonical.health.score;
  canonical.alertConfig = canonical.config.alertConfig;
  canonical.pid = canonical.server.pid;
  canonical.serverTimezoneOffsetMinutes = canonical.server.timezoneOffsetMinutes;
  canonical.serverTimezoneName = canonical.server.timezoneName;

  return canonical;
}

module.exports = { DASHBOARD_SCHEMA_VERSION, normalizeDashboardSnapshot };
