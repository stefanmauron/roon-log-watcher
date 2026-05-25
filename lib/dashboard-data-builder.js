'use strict';

const dataContract = require('./dashboard-data-contract');

/**
 * Builds dashboard API payloads and export documents from the live runtime state.
 *
 * This module intentionally contains no log-watching side effects. It receives
 * the current state from app.js and turns it into stable JSON/text/CSV outputs
 * for the browser dashboard and export endpoints. Keeping this logic outside
 * app.js makes the main application file a smaller orchestration layer and
 * gives the UI data contract a single place to evolve.
 */
function createDashboardDataBuilder({ appState, sharedUtils, appVersion }) {
  function summarizeCountsBySeverity(items, normalizeSeverity) {
    const result = { critical: 0, warning: 0, info: 0 };
    for (const item of items || []) {
      const sev = normalizeSeverity(item && item.severity, item || {});
      result[sev] = (result[sev] || 0) + 1;
    }
    return result;
  }

  function latestMetricValue(memoryPoints, metricName) {
    for (let i = memoryPoints.length - 1; i >= 0; i -= 1) {
      if (memoryPoints[i].metric === metricName) return memoryPoints[i];
    }
    return null;
  }

  function formatMetricLine(label, point) {
    if (!point) return `- ${label}: n/a`;
    const value = Number(point.valueMB);
    return `- ${label}: ${Number.isFinite(value) ? Math.round(value) + ' MB' : 'n/a'} (${point.logTimeDisplay || point.localTimeDisplay || point.receivedAt || 'unknown time'})`;
  }

  function createHealthSnapshot(ctx) {
    const now = Date.now();
    const lastLogAgeSeconds = ctx.lastLogLineAt ? Math.round((now - ctx.lastLogLineAt) / 1000) : null;
    const lastMemory = ctx.memoryPoints.length ? ctx.memoryPoints[ctx.memoryPoints.length - 1] : null;
    const lastMemoryAt = lastMemory ? new Date(lastMemory.receivedAt).getTime() : 0;
    const lastMemoryAgeSeconds = lastMemoryAt ? Math.round((now - lastMemoryAt) / 1000) : null;
    return {
      ok: true,
      runStartedAt: ctx.runStartedAt,
      generatedAt: new Date().toISOString(),
      serverTimezoneOffsetMinutes: new Date().getTimezoneOffset(),
      serverTimezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      pid: process.pid,
      platform: ctx.getRuntimeProfile().platform || ctx.getRuntimeProfile().name,
      runtimeProfile: ctx.getRuntimeProfile().name,
      roonProcess: ctx.runtimeProcessInfo ? { pid: ctx.runtimeProcessInfo.pid, command: ctx.runtimeProcessInfo.command } : null,
      processMemoryPolling: ctx.processMemoryPollingEnabled && Boolean(ctx.getRuntimeProfile().supportsProcMemory),
      activeTailStreams: ctx.tailProcesses.size,
      watchedFiles: ctx.tailProcesses.size,
      memoryPointCount: ctx.memoryPoints.length,
      statsLinesDetected: ctx.memoryStatsLinesDetected,
      recentLogCount: ctx.recentLogSequence,
      healthScore: ctx.getIncidentHealthScore(),
      incidentCount: ctx.incidentEvents.length,
      lastLogAt: ctx.lastLogLineAt ? new Date(ctx.lastLogLineAt).toISOString() : null,
      lastLogAgeSeconds,
      lastMemoryAt: lastMemory ? lastMemory.receivedAt : null,
      lastMemoryAgeSeconds,
      webServerPort: ctx.memoryWindowPort,
      mode: 'runtime-only',
      terminalLogsEnabled: ctx.terminalLogsEnabled
    };
  }

  function createMemorySnapshot(ctx) {
    // Runtime-only: expose only memory points collected from newly appended log
    // entries after this watcher process started. No historic startup/tail scans
    // are included.
    const points = ctx.memoryPoints.slice().sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime() || a.sequence - b.sequence);
    const latestByMetric = {};
    for (const point of points) latestByMetric[point.metric] = point;

    const gcEvents = [];
    const seenGc = new Set();
    for (const point of points) {
      if (point.gcPauseMs == null && point.gcRuntimePercent == null) continue;
      const key = `${point.receivedAt}|${point.source}|${point.gcPauseMs}|${point.gcRuntimePercent}`;
      if (seenGc.has(key)) continue;
      seenGc.add(key);
      gcEvents.push({
        time: point.time,
        receivedAt: point.receivedAt,
        phase: 'live',
        source: point.source,
        gcPauseMs: point.gcPauseMs,
        gcRuntimePercent: point.gcRuntimePercent,
        logTimeDisplay: point.logTimeDisplay || null
      });
    }

    // Timeline GC markers are added as fallback events because older dashboard
    // versions could miss GC markers when parsed log time and rolling read time
    // drifted apart.
    for (const ev of ctx.timelineEvents) {
      if (!ev || ev.type !== 'gc') continue;
      const key = `${ev.time}|${ev.source || ''}|${ev.message || ''}`;
      if (seenGc.has(key)) continue;
      seenGc.add(key);
      const msg = String(ev.message || '');
      const pauseMatch = msg.match(/([0-9]+(?:\.[0-9]+)?)\s*ms/i);
      const pctMatch = msg.match(/([0-9]+(?:\.[0-9]+)?)\s*%/i);
      gcEvents.push({
        time: ev.time,
        receivedAt: ev.time,
        phase: 'live',
        source: ev.source || 'timeline',
        gcPauseMs: pauseMatch ? Number(pauseMatch[1]) : null,
        gcRuntimePercent: pctMatch ? Number(pctMatch[1]) : null
      });
    }

    return dataContract.normalizeDashboardSnapshot({
      ok: true,
      points,
      sessionPoints: points,
      pointCount: points.length,
      statsLinesDetected: ctx.memoryStatsLinesDetected,
      latestByMetric,
      gcEvents,
      generatedAt: new Date().toISOString(),
      serverTimezoneOffsetMinutes: new Date().getTimezoneOffset(),
      serverTimezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      pid: process.pid,
      recentLogs: ctx.recentLogLines.slice(-500),
      recentLogCount: ctx.recentLogSequence,
      health: createHealthSnapshot(ctx),
      alerts: ctx.alertEvents.slice(-50),
      timeline: ctx.timelineEvents.slice(-120),
      memoryCorrelations: ctx.memoryCorrelationEvents.slice(-50),
      incidents: ctx.incidentEvents.slice(-50),
      incidentLifecycle: ctx.getIncidentLifecycleSnapshot().slice(0, 40),
      playbackSessions: ctx.playbackSessions.filter(s => ctx.isUserFacingZone(s.zone)).slice(-30),
      activePlaybackSessions: Array.from(ctx.activePlaybackSessions.values()).slice(-10),
      zones: ctx.getZoneSnapshot(),
      playbackSessionCount: ctx.playbackSessions.length,
      healthScore: ctx.getIncidentHealthScore(),
      alertConfig: ctx.memoryAlertConfig,
      runStartedAt: ctx.runStartedAt
    });
  }

  function createMemoryExportJson(ctx) {
    return appState.createMemoryExportSnapshot({
      runStartedAt: ctx.runStartedAt,
      points: ctx.memoryPoints,
      alerts: ctx.alertEvents,
      timeline: ctx.timelineEvents,
      memoryCorrelations: ctx.memoryCorrelationEvents,
      incidents: ctx.incidentEvents,
      incidentLifecycle: ctx.getIncidentLifecycleSnapshot(),
      playbackSessions: ctx.playbackSessions.filter(s => ctx.isUserFacingZone(s.zone)),
      zones: ctx.getZoneSnapshot(),
      healthScore: ctx.getIncidentHealthScore()
    });
  }

  function createLogsText(ctx) {
    return ctx.recentLogLines.map(l => `[${l.receivedAt}] ${l.text}`).join('\n') + '\n';
  }

  function createHealthText(ctx) {
    const h = createHealthSnapshot(ctx);
    return appState.createRuntimeHealthText({
      memoryPointCount: ctx.memoryPoints.length,
      statsLinesDetected: ctx.memoryStatsLinesDetected,
      activeTailStreams: ctx.tailProcesses.size,
      lastLogAgeSeconds: h.lastLogAgeSeconds
    });
  }

  function createDiagnosticSummary(ctx) {
    const health = createHealthSnapshot(ctx);
    const incidentCounts = summarizeCountsBySeverity(ctx.incidentEvents, ctx.normalizeSeverity);
    const timelineCounts = summarizeCountsBySeverity(ctx.timelineEvents, ctx.normalizeSeverity);
    const lifecycle = ctx.getIncidentLifecycleSnapshot();
    const recentAlerts = ctx.alertEvents.slice(-20).reverse();
    const recentIncidents = ctx.incidentEvents.slice(-20).reverse();
    const recentCorrelations = ctx.memoryCorrelationEvents.slice(-10).reverse();
    const latestManaged = latestMetricValue(ctx.memoryPoints, 'Managed Memory');
    const latestPhysical = latestMetricValue(ctx.memoryPoints, 'Physical Memory');
    const latestUnmanaged = latestMetricValue(ctx.memoryPoints, 'Unmanaged Memory');

    const lines = [];
    lines.push('# Roon Log Watcher diagnostic summary');
    lines.push('');
    lines.push(`Generated: ${new Date().toString()}`);
    lines.push(`App version: v${appVersion}`);
    lines.push(`Runtime PID: ${process.pid}`);
    lines.push(`Run started: ${ctx.runStartedAt}`);
    lines.push(`Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'} (offset ${new Date().getTimezoneOffset()} min)`);
    lines.push('');
    lines.push('## Current runtime state');
    lines.push(`- Health score: ${ctx.getIncidentHealthScore()}/100`);
    lines.push(`- Memory points: ${ctx.memoryPoints.length}`);
    lines.push(`- Stats lines detected: ${ctx.memoryStatsLinesDetected}`);
    lines.push(`- Recent log lines captured: ${ctx.recentLogSequence}`);
    lines.push(`- Last log age: ${health.lastLogAgeSeconds == null ? 'n/a' : health.lastLogAgeSeconds + 's'}`);
    lines.push(`- Last memory age: ${health.lastMemoryAgeSeconds == null ? 'n/a' : health.lastMemoryAgeSeconds + 's'}`);
    lines.push('');
    lines.push('## Latest memory telemetry');
    lines.push(formatMetricLine('Managed Memory', latestManaged));
    lines.push(formatMetricLine('Physical Memory', latestPhysical));
    lines.push(formatMetricLine('Unmanaged Memory', latestUnmanaged));
    lines.push('');
    lines.push('## Event counts');
    lines.push(`- Incidents: critical ${incidentCounts.critical || 0}, warning ${incidentCounts.warning || 0}, info ${incidentCounts.info || 0}`);
    lines.push(`- Timeline: critical ${timelineCounts.critical || 0}, warning ${timelineCounts.warning || 0}, info ${timelineCounts.info || 0}`);
    lines.push(`- Active lifecycle items: ${lifecycle.filter(i => i.status !== 'recovered').length}`);
    lines.push('');
    lines.push('## Recent incidents');
    if (!recentIncidents.length) lines.push('- none');
    for (const item of recentIncidents) lines.push(`- [${(item.severity || 'info').toUpperCase()}] ${item.title || item.type || 'Incident'} — ${item.message || item.likelyCause || ''}`);
    lines.push('');
    lines.push('## Recent memory correlations');
    if (!recentCorrelations.length) lines.push('- none');
    for (const item of recentCorrelations) lines.push(`- [${(item.severity || 'info').toUpperCase()}] ${item.title || item.type || 'Memory correlation'} — ${item.message || item.likelyCause || ''}`);
    lines.push('');
    lines.push('## Recent alerts');
    if (!recentAlerts.length) lines.push('- none');
    for (const item of recentAlerts) lines.push(`- [${(item.severity || 'info').toUpperCase()}] ${item.title || 'Alert'} — ${item.message || ''}`);
    lines.push('');
    lines.push('## Last live log lines');
    for (const line of ctx.recentLogLines.slice(-30)) lines.push(`- [${line.receivedAt}] ${line.text}`);
    lines.push('');
    return lines.join('\n') + '\n';
  }

  function createMemoryCsv(ctx) {
    const header = ['receivedAt','logTime','metric','valueMB','source','gcRuntimePercent','gcPauseMs','line'];
    const rows = ctx.memoryPoints.map(p => [p.receivedAt, p.time, p.metric, Math.round(Number(p.valueMB) || 0), p.source, p.gcRuntimePercent == null ? '' : p.gcRuntimePercent, p.gcPauseMs == null ? '' : p.gcPauseMs, p.line || '']);
    return [header, ...rows].map(row => row.map(sharedUtils.csvCell).join(',')).join('\n') + '\n';
  }

  return {
    createMemorySnapshot,
    createHealthSnapshot,
    createMemoryExportJson,
    createLogsText,
    createHealthText,
    createDiagnosticSummary,
    createMemoryCsv
  };
}

module.exports = { createDashboardDataBuilder };
