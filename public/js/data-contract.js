/* Browser-side mirror of the dashboard API contract.
   It normalizes /api/memory responses before rendering, while preserving the
   legacy field names that older rendering helpers still read. */
(function(window){
  'use strict';
  var SCHEMA_VERSION = 1;
  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function num(v, fallback){ var n = Number(v); return isFinite(n) ? n : (fallback == null ? 0 : fallback); }
  function normalize(raw){
    var data = obj(raw);
    var health = obj(data.health);
    var out = {
      schemaVersion: data.schemaVersion || SCHEMA_VERSION,
      ok: data.ok !== false,
      generatedAt: data.generatedAt || new Date().toISOString(),
      runStartedAt: data.runStartedAt || null,
      server: {
        pid: data.pid || health.pid || null,
        timezoneOffsetMinutes: data.serverTimezoneOffsetMinutes != null ? data.serverTimezoneOffsetMinutes : health.serverTimezoneOffsetMinutes,
        timezoneName: data.serverTimezoneName || health.serverTimezoneName || ''
      },
      counts: {
        pointCount: num(data.pointCount, arr(data.points).length),
        statsLinesDetected: num(data.statsLinesDetected, 0),
        recentLogCount: num(data.recentLogCount, 0),
        playbackSessionCount: num(data.playbackSessionCount, arr(data.playbackSessions).length)
      },
      memory: {
        points: arr(data.points),
        sessionPoints: arr(data.sessionPoints).length ? arr(data.sessionPoints) : arr(data.points),
        latestByMetric: obj(data.latestByMetric),
        gcEvents: arr(data.gcEvents),
        correlations: arr(data.memoryCorrelations)
      },
      events: {
        alerts: arr(data.alerts),
        timeline: arr(data.timeline),
        incidents: arr(data.incidents),
        incidentLifecycle: arr(data.incidentLifecycle),
        recentLogs: arr(data.recentLogs)
      },
      playback: {
        sessions: arr(data.playbackSessions),
        activeSessions: arr(data.activePlaybackSessions),
        zones: arr(data.zones)
      },
      health: Object.assign({}, health, { score: num(data.healthScore != null ? data.healthScore : health.healthScore, 100) }),
      config: { alertConfig: obj(data.alertConfig) }
    };
    out.points = out.memory.points;
    out.sessionPoints = out.memory.sessionPoints;
    out.latestByMetric = out.memory.latestByMetric;
    out.gcEvents = out.memory.gcEvents;
    out.memoryCorrelations = out.memory.correlations;
    out.alerts = out.events.alerts;
    out.timeline = out.events.timeline;
    out.incidents = out.events.incidents;
    out.incidentLifecycle = out.events.incidentLifecycle;
    out.recentLogs = out.events.recentLogs;
    out.playbackSessions = out.playback.sessions;
    out.activePlaybackSessions = out.playback.activeSessions;
    out.zones = out.playback.zones;
    out.pointCount = out.counts.pointCount;
    out.statsLinesDetected = out.counts.statsLinesDetected;
    out.recentLogCount = out.counts.recentLogCount;
    out.playbackSessionCount = out.counts.playbackSessionCount;
    out.healthScore = out.health.score;
    out.alertConfig = out.config.alertConfig;
    out.pid = out.server.pid;
    out.serverTimezoneOffsetMinutes = out.server.timezoneOffsetMinutes;
    out.serverTimezoneName = out.server.timezoneName;
    return out;
  }
  window.RLWDataContract = { schemaVersion: SCHEMA_VERSION, normalize: normalize };
})(window);
