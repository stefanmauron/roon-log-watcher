'use strict';

const ui = require('./ui-components');

// Returns only the HTML shell. CSS and browser-side JavaScript are served from /public
// so UI styling and dashboard behaviour can be maintained independently from the server.
function getMemoryWindowHtml(context) {
  const { releaseInfo, APP_VERSION, memoryWindowPort, memoryHistoryMaxPoints } = context;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roon Log Watcher - Memory Monitor</title>
<link rel="stylesheet" href="${ui.assetHref('style.css', APP_VERSION)}">
</head>
<body>
<header>
  <h1>Roon Log Watcher - Memory Monitor</h1>
</header>
<main>
  <div class="card">
    <div id="health" class="healthgrid"></div>
    <div id="chartWrap"><canvas id="chart"></canvas></div>
    <!-- Chart layers are intentionally located directly below the graph.
         Diagnostic overlays such as GC should be easy to enable, but not create visual noise by default. -->
    <div class="chartLayerControls" aria-label="Chart layers">
      <span class="chartLayerTitle">Chart layers <span class="info-wrap"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Choose which memory curves and diagnostic markers are visible in the chart. This only changes the display, not the collected data.</span></span></span>
      <label><input type="checkbox" data-metric="Managed Memory" checked> Managed</label>
      <label><input type="checkbox" data-metric="Physical Memory" checked> Physical</label>
      <label><input type="checkbox" data-metric="Unmanaged Memory" checked> Unmanaged</label>
      <label><input type="checkbox" id="showGc"> GC markers</label>
    </div>
    <div id="stats" class="grid memorygrid"></div>
    <div id="analysis" class="grid"></div>
    <div class="playbackZoneGrid">
      <div class="playbackbox">
        <div class="playbackhead"><strong class="head-title">Playback Sessions <span class="info-wrap"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Groups log lines that belong to one playback start, skip or track change. It helps you see whether playback completed normally or needs review.</span></span></strong><span id="playbackMeta" class="muted">Waiting for playback activity…</span></div>
        <div id="playbackSessions"></div>
      </div>
      <div class="zonebox">
        <div class="zonehead"><strong class="head-title">Zone / Endpoint Monitoring <span class="info-wrap"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Shows recent Roon zones and endpoints. It summarizes playback state, buffering, reconnects, network round-trip time and nearby incidents.</span></span></strong><span id="zoneMeta" class="muted">Waiting for zone activity…</span></div>
        <div id="zoneEndpointStatus"></div>
      </div>
      <div class="perfbox">
        <div class="perfhead"><strong class="head-title">Playback Performance Metrics <span class="info-wrap"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Condenses playback timing into simple indicators such as track start, buffering, stream negotiation, RAAT sync and endpoint response time.</span></span></strong><span id="perfMeta" class="muted">Waiting for metrics…</span></div>
        <div id="playbackPerformanceMetrics"></div>
      </div>
      <div class="lifecyclebox">
        <div class="lifecyclehead"><strong class="head-title">Incident Lifecycle Monitoring <span class="info-wrap"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Follows problems from first detection to recovery. Duration and impact are estimated from related warning, error and recovery log lines.</span></span></strong><span id="lifecycleMeta" class="muted">Waiting for incidents…</span></div>
        <div id="incidentLifecycle"></div>
      </div>
    </div>
    <div class="diagnosisTimelineGrid">
      <div class="incidentbox">
        <div class="incidenthead"><strong class="head-title">Intelligent Diagnosis <span class="info-wrap"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Looks for repeated patterns in Roon logs and suggests likely causes. Treat this as a helpful hint, not as a guaranteed root cause.</span></span></strong><span id="incidentMeta" class="muted">Waiting for incidents…</span></div>
        <div id="incidents"></div>
      </div>
      <div class="timelinebox">
        <div class="timelinehead"><strong class="head-title">Event / Incident Timeline <span class="info-wrap"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Chronological list of important events such as playback changes, RAAT issues, GC activity, memory jumps, warnings and errors.</span></span></strong><span id="timelineMeta" class="muted">Waiting for notable events…</span></div>
        <div id="timeline"></div>
      </div>
    </div>
    <div class="alertbox">
      <div class="alerthead"><strong class="head-title">Alerts <span class="info-wrap"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Shows higher-priority findings from the current run. Alerts are created from warning, error and critical patterns in the live logs.</span></span></strong><span id="alertMeta" class="muted">No alerts yet</span></div>
      <div id="alerts"></div>
    </div>
    <div class="logControlsGrid">
      <div class="logbox live-log-bottom">
        <div class="loghead"><strong class="head-title">Live log output <span class="info-wrap"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Shows the newest log lines seen by this watcher. This is the raw evidence behind the dashboard cards and diagnostics.</span></span></strong><span id="logMeta" class="muted">Waiting for new log entries…</span></div>
        <pre id="logOutput"></pre>
      </div>
      <aside class="sideControls">
        <div class="sideControlsTitle">Controls & Export <span class="info-wrap info-right"><span class="info-dot" tabindex="0">i</span><span class="info-tip">Use these controls to export the collected memory data, visible logs or a diagnostic summary from the current watcher run.</span></span></div>
        <div class="toolbar">
          <a class="btn" href="/api/export/memory.csv">Export memory CSV</a>
          <a class="btn" href="/api/export/memory.json">Export memory JSON</a>
          <a class="btn" href="/api/export/logs.txt">Export live logs</a>
          <a class="btn" href="/api/export/diagnostic-summary.md">Export diagnostic summary</a>
          <input id="logSearch" class="search" placeholder="Filter logs…">
        </div>
        <details class="releaseDetails">
          <summary>Runtime capabilities</summary>
          <div class="releaseBody">
${releaseInfo.renderRuntimeCapabilitiesHtml()}
          </div>
        </details>
        <details class="releaseDetails">
          <summary>What's new in v${APP_VERSION}</summary>
          <div class="releaseBody">
${releaseInfo.renderWhatsNewHtml()}
          </div>
        </details>
        <details class="releaseDetails">
          <summary>Release history</summary>
          <div class="releaseBody releaseHistory">
${releaseInfo.renderReleaseHistoryHtml()}
          </div>
        </details>
      </aside>
    </div>
  </div>
</main>
<div id="bottomStatusBar" role="status" aria-live="off"><div id="bottomSessionInfo">Monitoring Runtime State: waiting for data…</div><div class="bottomCopyright">Software made with love for audio nerds, because rebooting is not debugging! (c) by logforensics · v${APP_VERSION}</div></div>
${ui.dashboardConfigScript({ port: memoryWindowPort, maxPoints: memoryHistoryMaxPoints, appVersion: APP_VERSION })}
  <script src="${ui.assetHref('js/data-contract.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/api-client.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/ui-state.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-utils.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-tooltips.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/dashboard-controller.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/dom-bindings.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-health.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-memory.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-runtime.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-timeline.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/log-formatters.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-incidents.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/playback-formatters.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-playback-events.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-zone-events.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-playback-metrics.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-playback.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-log-stream.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-logs.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/error-state.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-status-cards.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/render-memory-panels.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('js/ui-interactions.js', APP_VERSION)}" defer></script>
  <script src="${ui.assetHref('frontend.js', APP_VERSION)}" defer></script>
</body>
</html>`;
}


module.exports = { getMemoryWindowHtml };
