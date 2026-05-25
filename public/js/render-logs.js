/* Backward-compatible log/event renderer facade.
   v8.65 splits the implementation into render-incidents.js, render-playback.js, render-log-stream.js and log-formatters.js.
   Existing frontend calls continue to use window.RLWRenderLogs while new code can depend on the focused modules directly. */
(function(window){
  'use strict';
  var fmt = window.RLWLogFormatters || {};
  var inc = window.RLWRenderIncidents || {};
  var playback = window.RLWRenderPlayback || {};
  var stream = window.RLWRenderLogStream || {};
  window.RLWRenderLogs = {
    avg: fmt.avg,
    fmtMs: fmt.fmtMs,
    fmtUs: fmt.fmtUs,
    fmtDurationMs: fmt.fmtDurationMs,
    renderAlerts: inc.renderAlerts,
    renderIncidents: inc.renderIncidents,
    renderPlaybackSessions: playback.renderPlaybackSessions,
    renderZones: playback.renderZones,
    renderIncidentLifecycle: inc.renderIncidentLifecycle,
    renderPerformanceMetrics: playback.renderPerformanceMetrics,
    renderLogs: stream.renderLogs
  };
})(window);
