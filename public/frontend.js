/* Roon Log Watcher dashboard frontend entrypoint.
   v8.69 moves browser error handling, polling/UI binding and status-card facades into dedicated public/js modules. */
(function(){
  if(window.RLWErrorState && window.RLWErrorState.installGlobalErrorHandler){
    window.RLWErrorState.installGlobalErrorHandler('status');
  }
  var dashboardConfig = window.__RLW_DASHBOARD_CONFIG__ || {};
  var port = window.RLWApiClient ? window.RLWApiClient.dashboardPort() : (Number(dashboardConfig.port || location.port || 0) || 17666);
  var maxPoints = Number(dashboardConfig.maxPoints || 0) || 500;
  var statusEl = document.getElementById('status');
  var bottomSessionInfoEl = document.getElementById('bottomSessionInfo');
  var statsEl = document.getElementById('stats');
  var analysisEl = document.getElementById('analysis');
  var tableEl = document.getElementById('table');
  var lastEl = document.getElementById('last');
  var logOutputEl = document.getElementById('logOutput');
  var logMetaEl = document.getElementById('logMeta');
  var memoryCorrelationEl = null;
  var memoryCorrelationMetaEl = null;
  var healthEl = document.getElementById('health');
  var logSearchEl = document.getElementById('logSearch');
  var alertsEl = document.getElementById('alerts');
  var alertMetaEl = document.getElementById('alertMeta');
  var timelineEl = document.getElementById('timeline');
  var timelineMetaEl = document.getElementById('timelineMeta');
  var serverTimezoneOffsetMinutes = null;
  var serverTimezoneName = '';
  var incidentsEl = document.getElementById('incidents');
  var incidentMetaEl = document.getElementById('incidentMeta');
  var playbackEl = document.getElementById('playbackSessions');
  var playbackMetaEl = document.getElementById('playbackMeta');
  var zoneEl = document.getElementById('zoneEndpointStatus');
  var zoneMetaEl = document.getElementById('zoneMeta');
  var perfEl = document.getElementById('playbackPerformanceMetrics');
  var perfMetaEl = document.getElementById('perfMeta');
  var lifecycleEl = document.getElementById('incidentLifecycle');
  var lifecycleMetaEl = document.getElementById('lifecycleMeta');
  var lastRenderedLogSeq = 0;
  var canvas = document.getElementById('chart');
  var showGcEl = document.getElementById('showGc');
  var uiSettingsKey = 'roonLogWatcher.uiSettings.v1';
  function loadUiSettings(){ try { return JSON.parse(localStorage.getItem(uiSettingsKey) || '{}'); } catch(e) { return {}; } }
  function saveUiSetting(key, value){ try { var s = loadUiSettings(); s[key] = value; localStorage.setItem(uiSettingsKey, JSON.stringify(s)); } catch(e) {} }
  var uiSettings = loadUiSettings();
  if (showGcEl) showGcEl.checked = uiSettings.showGcMarkers === true;
  var ctx = canvas.getContext && canvas.getContext('2d');
  var metricOrder = ['Managed Memory','Physical Memory','Unmanaged Memory','Virtual Memory'];
  // High-contrast diagnostic palette: intentionally avoids traffic-light colors.
  // Curves and cards share the same mapping for fast visual cross-reference.
  var metricPalette = {
    'Managed Memory':   { stroke:'#ff4fd8', soft:'rgba(255,79,216,.15)', border:'rgba(255,79,216,.72)', text:'#ffd4f5' },
    'Physical Memory':  { stroke:'#22d3c5', soft:'rgba(34,211,197,.14)', border:'rgba(34,211,197,.70)', text:'#c9fffb' },
    'Unmanaged Memory': { stroke:'#b8794a', soft:'rgba(184,121,74,.17)', border:'rgba(184,121,74,.74)', text:'#ffd9bd' },
    'Virtual Memory':   { stroke:'#71717a', soft:'rgba(113,113,122,.08)', border:'rgba(113,113,122,.35)', text:'#e4e4e7', neutral:true }
  };
  var fallbackColors = ['#ff4fd8','#22d3c5','#b8794a','#8b5cf6'];
  var lastData = null;
  var liveWindowSamples = 300; // stats samples, not metric points
  // Browser-side live buffer: keeps live points stable even when a polling response
  // temporarily contains no sessionPoints. This prevents the chart from flashing empty.
  var browserLivePoints = [];
  var browserLiveKeys = {};
  var browserLiveMaxPoints = liveWindowSamples * 4 * 3;

  
  function setTextIfChanged(el, text){
    if(el && el.textContent !== String(text)) el.textContent = String(text);
  }
  function setStatus(text){
    // Keep a stable header DOM to prevent visible flicker during frequent refreshes.
    if(window.RLWErrorState && window.RLWErrorState.setStatus) return window.RLWErrorState.setStatus(statusEl, text);
    if(statusEl && statusEl.textContent !== text) statusEl.textContent = text;
  }
  function setWatcherStopped(reason){
    if(window.RLWErrorState && window.RLWErrorState.setWatcherStopped){
      return window.RLWErrorState.setWatcherStopped(statusEl, bottomSessionInfoEl, reason);
    }
    var msg = 'Monitoring Runtime State: watcher stopped / connection lost';
    if(reason) msg += ' — ' + reason;
    msg += ' • last values may be stale';
    if(bottomSessionInfoEl) setTextIfChanged(bottomSessionInfoEl, msg);
    setStatus(msg);
  }
  function updateSessionMeta(data, points, gcEvents){
    var meta = document.getElementById('sessionMeta');
    var first = points.length ? displayTimeFromPoint(points[0], points[0]._time) : '-';
    var last = points.length ? displayTimeFromPoint(points[points.length-1], points[points.length-1]._time) : '-';
    var memoryEvents = data.statsLinesDetected || 0;
    var logLines = data.recentLogCount || 0;
    var pid = data.pid || '-';

    // The former top Monitoring Runtime State card may be removed. The bottom
    // status bar must still receive the complete session information.
    if(meta){
      setTextIfChanged(document.getElementById('metaPoints'), data.pointCount || 0);
      setTextIfChanged(document.getElementById('metaDisplayed'), points.length);
      setTextIfChanged(document.getElementById('metaMemoryEvents'), memoryEvents);
      setTextIfChanged(document.getElementById('metaGcEvents'), gcEvents.length);
      setTextIfChanged(document.getElementById('metaLogLines'), logLines);
      setTextIfChanged(document.getElementById('metaWindow'), first + ' → ' + last);
      setTextIfChanged(document.getElementById('metaPid'), pid);
    } else {
      setStatus('points ' + (data.pointCount || 0) + ' • displayed ' + points.length);
    }

    if(bottomSessionInfoEl){
      var bottomText = 'Monitoring Runtime State: points ' + (data.pointCount || 0) +
        ' • displayed ' + points.length +
        ' • memory events ' + memoryEvents +
        ' • GC events ' + gcEvents.length +
        ' • log lines ' + logLines +
        ' • timeline ' + first + ' → ' + last +
        ' • pid ' + pid;
      setTextIfChanged(bottomSessionInfoEl, bottomText);
    }
  }

  function esc(v){ return window.RLWRenderUtils ? window.RLWRenderUtils.esc(v) : String(v == null ? '' : v).replace(/[&<>\"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function tooltipModule(){ return window.RLWRenderTooltips || null; }
  function infoIcon(key, alignRight){
    var mod = tooltipModule();
    if(mod && mod.infoIcon) return mod.infoIcon(key, alignRight, esc);
    return '<span class="info-wrap' + (alignRight ? ' info-right' : '') + '"><span class="info-dot" tabindex="0">i</span><span class="info-tip">' + esc(key || 'Additional information about this dashboard element.') + '</span></span>';
  }
  function labelWithInfo(label){
    var mod = tooltipModule();
    if(mod && mod.labelWithInfo) return mod.labelWithInfo(label, esc);
    return '<span>' + esc(label) + '</span> ' + infoIcon(label);
  }
  function n(v){ return window.RLWRenderUtils ? window.RLWRenderUtils.n(v) : (function(){ var x = Number(v); return isFinite(x) ? x : 0; })(); }
  function t(v){ var x = new Date(v).getTime(); return isFinite(x) ? x : Date.now(); }
  function pad2(v){ return window.RLWRenderUtils ? window.RLWRenderUtils.pad2(v) : (v = Number(v), (v < 10 ? '0' : '') + String(v)); }
  function localDateForDisplay(ms){
    // Always let the browser render timestamps in the user's local timezone.
    // Do not manually apply serverTimezoneOffsetMinutes here: ISO timestamps already
    // represent an absolute moment in time and toLocaleTimeString() applies the
    // local offset exactly once. Manually applying the offset caused a 2h UTC/local drift.
    return new Date(ms);
  }
  function fmtTime(ms){
    try {
      return localDateForDisplay(ms).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    } catch(e) { return String(ms); }
  }
  function fmtAxisTime(ms, includeMs){
    try {
      var d = localDateForDisplay(ms);
      var base = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      if(includeMs) base += '.' + String(d.getMilliseconds() + 1000).slice(1);
      return base;
    } catch(e) { return String(ms); }
  }
  function displayTimeFromPoint(p, fallbackMs){
    if(p && p.logTimeDisplay) return String(p.logTimeDisplay);
    if(p && p.localTimeDisplay) return String(p.localTimeDisplay);
    return fmtTime(fallbackMs != null ? fallbackMs : (p && (p._receivedAt || p._time || p.receivedAt || p.time)));
  }
  function displayAxisTimeFromSample(sample, fallbackMs){
    if(sample && sample.displayTime) return String(sample.displayTime);
    return fmtAxisTime(fallbackMs, false);
  }
  function fmtNumber(v){ return window.RLWRenderUtils ? window.RLWRenderUtils.fmtNumber(v) : (function(){ var x = Number(v); return isFinite(x) ? String(Math.round(x)) : '-'; })(); }
  function fmtMB(v){ return window.RLWRenderUtils ? window.RLWRenderUtils.fmtMB(v) : fmtNumber(v) + ' MB'; }
  function fmtRate(v){ return window.RLWRenderUtils ? window.RLWRenderUtils.fmtRate(v) : (v == null || !isFinite(v) ? '-' : ((v > 0 ? '+' : '') + Math.round(v) + ' MB/h')); }

  function requestMemory(){
    setStatus('Requesting /api/memory at ' + fmtTime(Date.now()) + ' ...');
    if(window.RLWApiClient && window.RLWApiClient.fetchMemorySnapshot){
      window.RLWApiClient.fetchMemorySnapshot().then(function(data){
        render(data);
      }).catch(function(e){
        setWatcherStopped((e && e.message) ? e.message : 'network error while loading /api/memory');
      });
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET','/api/memory?nocache=' + new Date().getTime(),true);
    xhr.onreadystatechange = function(){
      if(xhr.readyState !== 4) return;
      if(xhr.status < 200 || xhr.status >= 300){
        setStatus('HTTP error from /api/memory: ' + xhr.status + '\nOpen http://localhost:' + port + '/api/memory directly to check the server.');
        return;
      }
      try {
        var data = JSON.parse(xhr.responseText || '{}');
        if(window.RLWDataContract && window.RLWDataContract.normalize) data = window.RLWDataContract.normalize(data);
        render(data);
      } catch(e) {
        setStatus('JSON parse error from /api/memory: ' + e.message + '\nFirst 500 chars:\n' + (xhr.responseText || '').slice(0,500));
      }
    };
    xhr.onerror = function(){ setWatcherStopped('network error while loading /api/memory'); };
    xhr.ontimeout = function(){ setWatcherStopped('request timeout while loading /api/memory'); };
    try { xhr.send(null); } catch(e) { setStatus('XHR send failed: ' + e.message); }
  }


  function normaliseGc(data){
    // Roon exposes GC information in periodic [stats] snapshots rather than as
    // dedicated GC events. This function turns noisy snapshot values into a
    // smaller set of derived markers only when GC pressure changes materially.
    var raw = data && data.gcEvents && data.gcEvents.slice ? data.gcEvents.slice() : [];
    for(var i=0;i<raw.length;i++) raw[i]._time = t(raw[i].receivedAt || raw[i].time);
    raw.sort(function(a,b){ return a._time-b._time; });

    // Roon repeats GC values inside periodic [stats] snapshots. Those snapshots
    // are not individual GC events. Convert them into derived markers only when
    // GC pressure changes materially; otherwise the chart becomes unreadable.
    var out = [];
    var lastPause = null;
    var lastRuntime = null;
    var lastMarkerTime = 0;
    for(i=0;i<raw.length;i++){
      var ev = raw[i];
      var pause = ev.gcPauseMs == null ? null : Number(ev.gcPauseMs);
      var runtime = ev.gcRuntimePercent == null ? null : Number(ev.gcRuntimePercent);
      if((pause == null || !isFinite(pause)) && (runtime == null || !isFinite(runtime))) continue;
      var first = out.length === 0;
      var pauseChanged = pause != null && isFinite(pause) && (lastPause == null || Math.abs(pause - lastPause) >= 25);
      var runtimeChanged = runtime != null && isFinite(runtime) && (lastRuntime == null || Math.abs(runtime - lastRuntime) >= 0.05);
      var notablePause = pause != null && isFinite(pause) && pause >= 100 && (ev._time - lastMarkerTime) >= 30000;
      if(first || pauseChanged || runtimeChanged || notablePause){
        ev._derivedGcMarker = true;
        out.push(ev);
        lastMarkerTime = ev._time;
      }
      if(pause != null && isFinite(pause)) lastPause = pause;
      if(runtime != null && isFinite(runtime)) lastRuntime = runtime;
    }
    return out;
  }

  function filterByRange(points){
    if(!points.length) return points;
    var range = rangeEl ? rangeEl.value : '6h';
    if(range === 'all') return points;
    var maxT = points[points.length-1]._time;
    var duration = range === '30m' ? 30*60*1000 : range === '24h' ? 24*60*60*1000 : 6*60*60*1000;
    var minT = maxT - duration;
    var out = [];
    for(var i=0;i<points.length;i++){ if(points[i]._time >= minT) out.push(points[i]); }
    return out.length ? out : points;
  }

  function getSampleKey(p){
    if (p.statsLineId != null) return String(p.statsLineId);
    if (p.line) return String(p.line);
    return String(p.receivedAt || '') + '|' + String(p.time || '') + '|' + String(Math.floor((p.sequence || 0) / 10));
  }

  function getPointKey(p){
    return [p.source || '', p.sequence || '', p.metric || '', p.valueMB || '', p.receivedAt || '', p.time || ''].join('|');
  }

  function mergeBrowserLivePoints(newPoints){
    if(!newPoints || !newPoints.length) return;
    for(var i=0;i<newPoints.length;i++){
      var p = newPoints[i];
      if((p.phase || 'history') !== 'live') continue;
      var key = getPointKey(p);
      if(browserLiveKeys[key]) continue;
      browserLiveKeys[key] = true;
      browserLivePoints.push(p);
    }
    if(browserLivePoints.length > browserLiveMaxPoints){
      var removeCount = browserLivePoints.length - browserLiveMaxPoints;
      var removed = browserLivePoints.splice(0, removeCount);
      for(var r=0;r<removed.length;r++){ delete browserLiveKeys[getPointKey(removed[r])]; }
    }
  }

  function getRollingSessionWindow(points, sampleLimit){
    var samples = [];
    var seen = {};
    var i, key;
    points.sort(function(a,b){ return a.sequence-b.sequence || a._receivedAt-b._receivedAt || metricRank(a.metric)-metricRank(b.metric); });
    for(i=0;i<points.length;i++){
      key = getSampleKey(points[i]);
      if(!seen[key]){ seen[key] = { key:key, readTime: points[i]._receivedAt, displayTime: points[i].logTimeDisplay || null, items: [] }; samples.push(seen[key]); }
      if(points[i]._receivedAt < seen[key].readTime) seen[key].readTime = points[i]._receivedAt;
      seen[key].items.push(points[i]);
    }
    samples.sort(function(a,b){ return a.readTime-b.readTime; });
    if(samples.length > sampleLimit) samples = samples.slice(samples.length - sampleLimit);
    var out = [];
    for(i=0;i<samples.length;i++){
      for(var j=0;j<samples[i].items.length;j++){
        var p = samples[i].items[j];
        p._sampleIndex = i;
        p._sampleReadTime = samples[i].readTime;
        out.push(p);
      }
    }
    return out;
  }

  function render(data){
    lastData = data;
    var liveOnly = true;
    if(data && data.sessionPoints && data.sessionPoints.slice){ mergeBrowserLivePoints(data.sessionPoints); }
    var sourcePoints = data && data.points && data.points.slice ? data.points.slice(-maxPoints) : [];
    var allPoints = sourcePoints;
    var i;
    for(i=0;i<allPoints.length;i++){
      allPoints[i]._time = t(allPoints[i].time || allPoints[i].receivedAt);
      allPoints[i]._receivedAt = t(allPoints[i].receivedAt || allPoints[i].time);
      allPoints[i].valueMB = n(allPoints[i].valueMB);
      allPoints[i].metric = allPoints[i].metric || 'Memory';
      allPoints[i].phase = 'live';
      allPoints[i].sequence = n(allPoints[i].sequence || (i+1));
    }
    if(!liveOnly) allPoints.sort(function(a,b){ return a._time-b._time || metricRank(a.metric)-metricRank(b.metric); });
    var points;
    if(liveOnly){
      points = getRollingSessionWindow(allPoints, liveWindowSamples);
      points.sort(function(a,b){ return a._sampleIndex-b._sampleIndex || metricRank(a.metric)-metricRank(b.metric); });
    } else {
      points = filterByRange(allPoints);
    }
    var gcEvents = normaliseGc(data);
    var gcVisible = [];
    if(points.length){
      // Do not pre-filter GC markers by parsed log time in live mode. The chart
      // x-axis uses rolling sample indices/read timestamps, so drawGcPauseMarkers
      // performs the correct nearest-sample mapping and filtering.
      gcVisible = gcEvents.slice(-200);
    }
    var liveCount = allPoints.length;
    if(statusEl && statusEl.classList) statusEl.style.display = 'none';
    updateSessionMeta(data, points, gcEvents);

    renderHealth(data);
    renderAlerts(data);
    renderIncidents(data);
    renderPlaybackSessions(data);
    renderZones(data);
    renderPerformanceMetrics(data);
    renderIncidentLifecycle(data);
    renderTimeline(data);
    renderLogs(data);

    if(points.length === 0){
      statsEl.innerHTML = '';
      if(analysisEl) analysisEl.innerHTML = '';
      if(tableEl) tableEl.innerHTML = '';
      if(lastEl) lastEl.textContent = '';
      clearChart();
      return;
    }

    draw(points, gcVisible, data.memoryCorrelations || []);
    renderLatest(points);
    renderMemoryCorrelations(data.memoryCorrelations || []);
    renderAnalysis(points);
    renderHealth(data);
    renderAlerts(data);
    renderIncidents(data);
    renderPlaybackSessions(data);
    renderZones(data);
    renderPerformanceMetrics(data);
    renderIncidentLifecycle(data);
    renderTimeline(data);
    renderLogs(data);
    var last = points[points.length-1];
    lastEl.textContent = 'Last source: ' + (last.source || '-') + '\\n' + (last.line || '');
  }


  function healthClass(ok, warn){ return ok ? 'ok' : warn ? 'warn' : 'bad'; }
  function healthCard(label, value, cls, note){
    if(window.RLWRenderHealth && window.RLWRenderHealth.healthCard){
      return window.RLWRenderHealth.healthCard(label, value, cls, note, { esc: esc, infoIcon: infoIcon });
    }
    var noteText = note ? ' <span class="note">(' + esc(note) + ')</span>' : '';
    return '<div class="health ' + cls + '"><div class="health-title"><span class="dot"></span><span>' + esc(label) + noteText + ' ' + infoIcon(label) + '</span></div><div class="value">' + esc(value) + '</div></div>';
  }
  function renderHealth(data){
    if(window.RLWRenderStatusCards && window.RLWRenderStatusCards.renderHealthCards){
      return window.RLWRenderStatusCards.renderHealthCards(data, { healthEl: healthEl, port: port, healthCard: healthCard });
    }
    if(window.RLWRenderHealth && window.RLWRenderHealth.renderHealth){
      return window.RLWRenderHealth.renderHealth(data, { healthEl: healthEl, port: port, healthCard: healthCard });
    }
  }

  function renderAlerts(data){
    if(window.RLWRenderLogs && window.RLWRenderLogs.renderAlerts){
      return window.RLWRenderLogs.renderAlerts(data, { alertsEl: alertsEl, alertMetaEl: alertMetaEl, fmtTime: fmtTime, esc: esc });
    }
  }

  function renderIncidents(data){
    if(window.RLWRenderLogs && window.RLWRenderLogs.renderIncidents){
      return window.RLWRenderLogs.renderIncidents(data, { incidentsEl: incidentsEl, incidentMetaEl: incidentMetaEl, fmtTime: fmtTime, esc: esc });
    }
  }

  function renderPlaybackSessions(data){
    if(window.RLWRenderLogs && window.RLWRenderLogs.renderPlaybackSessions){
      return window.RLWRenderLogs.renderPlaybackSessions(data, { playbackEl: playbackEl, playbackMetaEl: playbackMetaEl, fmtTime: fmtTime, esc: esc });
    }
  }

  function renderZones(data){
    if(window.RLWRenderLogs && window.RLWRenderLogs.renderZones){
      return window.RLWRenderLogs.renderZones(data, { zoneEl: zoneEl, zoneMetaEl: zoneMetaEl, esc: esc });
    }
  }

  function avg(values){ return window.RLWRenderLogs && window.RLWRenderLogs.avg ? window.RLWRenderLogs.avg(values) : null; }
  function fmtMs(v){ return window.RLWRenderLogs && window.RLWRenderLogs.fmtMs ? window.RLWRenderLogs.fmtMs(v) : '-'; }
  function fmtUs(v){ return window.RLWRenderLogs && window.RLWRenderLogs.fmtUs ? window.RLWRenderLogs.fmtUs(v) : '-'; }
  function fmtDurationMs(v){ return window.RLWRenderLogs && window.RLWRenderLogs.fmtDurationMs ? window.RLWRenderLogs.fmtDurationMs(v) : '-'; }

  function renderIncidentLifecycle(data){
    if(window.RLWRenderLogs && window.RLWRenderLogs.renderIncidentLifecycle){
      return window.RLWRenderLogs.renderIncidentLifecycle(data, { lifecycleEl: lifecycleEl, lifecycleMetaEl: lifecycleMetaEl, esc: esc, fmtDurationMs: fmtDurationMs });
    }
  }

  function renderPerformanceMetrics(data){
    if(window.RLWRenderLogs && window.RLWRenderLogs.renderPerformanceMetrics){
      return window.RLWRenderLogs.renderPerformanceMetrics(data, { perfEl: perfEl, perfMetaEl: perfMetaEl, esc: esc, avg: avg, fmtMs: fmtMs, fmtUs: fmtUs });
    }
  }

  function renderTimeline(data){
    if(window.RLWRenderTimeline && window.RLWRenderTimeline.renderTimeline){
      return window.RLWRenderTimeline.renderTimeline(data, { timelineEl: timelineEl, timelineMetaEl: timelineMetaEl, fmtTime: fmtTime, esc: esc });
    }
  }

  function renderLogs(data){
    if(window.RLWRenderLogs && window.RLWRenderLogs.renderLogs){
      var nextSeq = window.RLWRenderLogs.renderLogs(data, { logOutputEl: logOutputEl, logMetaEl: logMetaEl, logSearchEl: logSearchEl, fmtTime: fmtTime, esc: esc, lastRenderedLogSeq: lastRenderedLogSeq });
      if(nextSeq != null) lastRenderedLogSeq = nextSeq;
    }
  }

  function renderLatest(points){
    var latest = {}, metrics = [], i, p;
    for(i=0;i<points.length;i++) latest[points[i].metric] = points[i];
    for(var k in latest){ if(Object.prototype.hasOwnProperty.call(latest,k)){ metrics.push(k); } }
    metrics.sort(function(a,b){ return metricRank(a)-metricRank(b) || (a < b ? -1 : 1); });
    var growth = computeGrowth(points);
    var html = '';
    for(i=0;i<metrics.length;i++){
      if(metrics[i] === 'Virtual Memory') continue; // not plotted; avoid a misleading card
      p = latest[metrics[i]];
      var g = growth[metrics[i]];
      var trendText = g ? fmtRate(g.mbPerHour) : '-';
      var trendNote = g ? g.note : 'waiting for samples';
      var mp = metricColor(metrics[i]);
      var cardStyle = '--metric-color:' + mp.stroke + ';--metric-text:' + mp.text + ';--metric-glow:' + hexToRgba(mp.stroke,.50) + ';border-color:' + mp.border + ';background:linear-gradient(180deg,' + mp.soft + ',rgba(17,18,23,.96));';
      html += '<div class="stat metric-card" style="' + esc(cardStyle) + '"><div class="label"><span class="dot metric-dot"></span>' + labelWithInfo(metrics[i]) + '</div><div class="value metric-value">' + fmtMB(p.valueMB) + '</div><div class="label">' + esc(displayTimeFromPoint(p, p._receivedAt)) + '</div><div class="label" style="margin-top:8px;">Trend ' + infoIcon(metrics[i] + ' Trend') + '</div><div class="value metric-value" style="font-size:14px;">' + esc(trendText) + '</div><div class="label">' + esc(trendNote) + '</div></div>';
    }
    var relation = latestValue(points,'Managed Memory') + latestValue(points,'Unmanaged Memory') - latestValue(points,'Physical Memory');
    var relationAbs = Math.abs(relation);
    var relationClass = relationAbs < 100 ? 'ok' : (relationAbs < 250 ? 'warn' : 'bad');
    var relationValue = relationAbs < 100 ? 'OK' : (relationAbs < 250 ? 'Check' : 'Mismatch');
    html += '<div class="stat plausibility ' + relationClass + '"><div class="label"><span class="dot"></span>' + labelWithInfo('Plausibility Check') + '</div><div class="value ' + relationClass + '">' + esc(relationValue) + '</div><div class="label">Managed + Unmanaged − Physical: ' + fmtNumber(relation) + ' MB</div><div class="label" style="margin-top:8px;">Status</div><div class="value" style="font-size:14px;">' + (relationAbs < 100 ? 'consistent' : 'review') + '</div><div class="label">memory accounting</div></div>';
    var gc = computeGcPressure(points);
    html += '<div class="stat gc-pressure-card ' + esc(gc.className) + '"><div class="label"><span class="dot"></span>' + labelWithInfo('GC Pressure') + '</div><div class="value">' + esc(gc.status) + '</div><div class="label">Last pause: ' + esc(gc.pauseText) + '</div><div class="label">Runtime GC: ' + esc(gc.runtimeText) + '</div><div class="label" style="margin-top:8px;">Trend ' + infoIcon('GC Trend') + '</div><div class="value" style="font-size:14px;">' + esc(gc.trend) + '</div></div>';
    html += '<div id="memoryCorrelationCard" class="stat memory-correlation-card trend-neutral"><div class="label"><span class="dot"></span>' + labelWithInfo('Runtime Behaviour Intelligence') + '</div><div id="memoryCorrelationMeta" class="value">0 flags</div><div id="memoryCorrelations" class="memoryCorrelationCompact"><div class="mcempty">No behavioural signals detected yet.</div></div></div>';
    statsEl.innerHTML = html;
    // The detailed metric table and raw last-source block were removed from the UI.
    // The same information is already available in the compact memory cards,
    // chart, Monitoring Runtime State header and live log output.
    if(tableEl) tableEl.innerHTML = '';
  }


  function memoryCorrelationTrendClass(delta){
    delta = Number(delta || 0);
    if(delta > 0) return 'trend-up';
    if(delta < 0) return 'trend-down';
    return 'trend-neutral';
  }

  function memoryCorrelationTrendColor(ev){
    var delta = Number((ev && (ev.memoryDeltaMB || ev.maxMetricDeltaMB)) || 0);
    if(delta > 0) return { stroke:'#ef4444', fill:'#f87171', text:'#fca5a5' };
    if(delta < 0) return { stroke:'#22c55e', fill:'#4ade80', text:'#86efac' };
    return { stroke:'#71717a', fill:'#a1a1aa', text:'#d4d4d8' };
  }

  function renderMemoryCorrelations(items){
    var memoryCorrelationCardEl = document.getElementById('memoryCorrelationCard');
    memoryCorrelationEl = document.getElementById('memoryCorrelations');
    memoryCorrelationMetaEl = document.getElementById('memoryCorrelationMeta');
    if(!memoryCorrelationEl || !memoryCorrelationMetaEl) return;
    items = items && items.slice ? items.slice(-12).reverse() : [];
    if(!items.length){
      if(memoryCorrelationCardEl) memoryCorrelationCardEl.className = 'stat memory-correlation-card trend-neutral';
      memoryCorrelationEl.innerHTML = '<div class="mcempty">No behavioural signals detected yet. Insights appear here when memory drift, GC pressure or runtime events correlate.</div>';
      memoryCorrelationMetaEl.textContent = '0 flags';
      return;
    }
    var latest = items[0];
    var latestDelta = Number(latest.memoryDeltaMB || latest.maxMetricDeltaMB || 0);
    if(memoryCorrelationCardEl) memoryCorrelationCardEl.className = 'stat memory-correlation-card ' + memoryCorrelationTrendClass(latestDelta);
    memoryCorrelationMetaEl.textContent = (latestDelta > 0 ? '+' : '') + fmtNumber(latestDelta) + ' MB';
    var html = '';
    var shown = Math.min(3, items.length);
    for(var i=0;i<shown;i++){
      var ev = items[i];
      var delta = Number(ev.memoryDeltaMB || ev.maxMetricDeltaMB || 0);
      var conf = ev.confidence || '-';
      html += '<div class="mcmini">' +
        '<div class="mcminiDelta">' + (delta > 0 ? '+' : '') + esc(fmtNumber(delta)) + ' MB</div>' +
        '<div><div class="mcminiTitle">' + esc(ev.title || ev.category || 'Memory increase') + '</div>' +
        '<div class="mcminiMeta">' + esc(ev.logTimeDisplay || fmtTime(t(ev.receivedAt || ev.time))) + ' · ' + esc(ev.category || 'Memory') + ' · ' + esc(conf) + '</div></div>' +
      '</div>';
    }
    if(items.length > shown){
      html += '<div class="mcminiMeta">+' + (items.length - shown) + ' more correlation flag(s)</div>';
    }
    memoryCorrelationEl.innerHTML = html;
  }

  function computeGcPressure(points){
    var samples = [];
    var seen = {};
    for(var i=0;i<points.length;i++){
      var p = points[i];
      if(p.gcPauseMs == null && p.gcRuntimePercent == null) continue;
      var key = String(p.sequence || p._sampleIndex || i);
      if(seen[key]) continue;
      seen[key] = true;
      samples.push(p);
    }
    if(!samples.length){
      return { status:'Waiting', className:'gc-neutral', pauseText:'-', runtimeText:'-', trend:'waiting for stats' };
    }
    samples.sort(function(a,b){ return (a._sampleIndex-b._sampleIndex) || (a._receivedAt-b._receivedAt); });
    var first = samples[0], last = samples[samples.length-1];
    var pause = Number(last.gcPauseMs);
    var runtime = Number(last.gcRuntimePercent);
    var firstPause = Number(first.gcPauseMs);
    var firstRuntime = Number(first.gcRuntimePercent);
    var score = 0;
    if(isFinite(pause)){ if(pause >= 1000) score += 3; else if(pause >= 250) score += 2; else if(pause >= 100) score += 1; }
    if(isFinite(runtime)){ if(runtime >= 10) score += 3; else if(runtime >= 5) score += 2; else if(runtime >= 2.5) score += 1; }
    var status = score >= 5 ? 'High' : score >= 3 ? 'Moderate' : score >= 1 ? 'Low' : 'Low';
    var className = score >= 5 ? 'gc-high' : score >= 3 ? 'gc-moderate' : 'gc-low';
    var pauseDelta = (isFinite(pause) && isFinite(firstPause)) ? pause - firstPause : 0;
    var runtimeDelta = (isFinite(runtime) && isFinite(firstRuntime)) ? runtime - firstRuntime : 0;
    var trend = 'stable';
    if(pauseDelta > 50 || runtimeDelta > .25) trend = 'rising';
    else if(pauseDelta < -50 || runtimeDelta < -.25) trend = 'falling';
    return {
      status: status,
      className: className,
      pauseText: isFinite(pause) ? Math.round(pause) + ' ms' : '-',
      runtimeText: isFinite(runtime) ? runtime.toFixed(runtime >= 10 ? 1 : 2) + '%' : '-',
      trend: trend
    };
  }

  function renderAnalysis(points){
    if(!analysisEl) return;
    analysisEl.innerHTML = '';
  }

  function latestValue(points, metric){ var v=0; for(var i=0;i<points.length;i++){ if(points[i].metric===metric) v=points[i].valueMB; } return v; }

  function computeGrowth(points){
    var byMetric = {}, result = {};
    var liveOnly = true;
    for(var i=0;i<points.length;i++){
      var p = points[i];
      if(!byMetric[p.metric]) byMetric[p.metric] = [];
      byMetric[p.metric].push(p);
    }
    for(var metric in byMetric){
      if(!Object.prototype.hasOwnProperty.call(byMetric, metric)) continue;
      var arr = byMetric[metric];
      if(arr.length < 2) continue;
      arr.sort(function(a,b){
        var ax = liveOnly ? a._receivedAt : a._time;
        var bx = liveOnly ? b._receivedAt : b._time;
        return ax-bx || a.sequence-b.sequence;
      });
      var maxSamples = 500;
      if(arr.length > maxSamples) arr = arr.slice(arr.length - maxSamples);
      var first = arr[0], last = arr[arr.length-1];
      var timeFirst = liveOnly ? first._receivedAt : first._time;
      var timeLast = liveOnly ? last._receivedAt : last._time;
      var hours = (timeLast - timeFirst) / 3600000;
      var minutes = hours * 60;
      if(!isFinite(hours) || hours <= 0){
        result[metric] = { mbPerHour: null, note: arr.length + ' samples; waiting for time spread' };
        continue;
      }
      if(liveOnly && minutes < 5){
        result[metric] = { mbPerHour: null, note: 'warming up; trend after 5 min (' + Math.round(minutes) + ' min)' };
        continue;
      }
      result[metric] = { mbPerHour: (last.valueMB - first.valueMB) / hours, note: arr.length + ' samples over ' + fmtNumber(hours) + ' h' };
    }
    return result;
  }


  function metricColor(name){
    if(metricPalette[name]) return metricPalette[name];
    var idx = metricRank(name) % fallbackColors.length;
    var c = fallbackColors[idx < 0 ? 0 : idx];
    return { stroke:c, soft:hexToRgba(c,.12), border:hexToRgba(c,.55), text:'#e4e4e7' };
  }

  function hexToRgba(hex, alpha){
    hex = String(hex || '').replace('#','');
    if(hex.length !== 6) return 'rgba(113,113,122,' + alpha + ')';
    var r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function metricRank(name){
    for(var i=0;i<metricOrder.length;i++){ if(metricOrder[i] === name) return i; }
    return 999;
  }

  function getVisibleMetricMap(){
    var map = {};
    var inputs = document.querySelectorAll ? document.querySelectorAll('input[data-metric]') : [];
    for(var i=0;i<inputs.length;i++){ map[inputs[i].getAttribute('data-metric')] = !!inputs[i].checked; }
    return map;
  }

  function visiblePoints(points){
    var visible = getVisibleMetricMap();
    var out = [];
    for(var i=0;i<points.length;i++){
      if(points[i].metric === 'Virtual Memory') continue;
      if(visible[points[i].metric]) out.push(points[i]);
    }
    return out;
  }

  function resize(){
    var dpr = window.devicePixelRatio || 1;
    var wrap = document.getElementById('chartWrap');
    var rect = wrap ? wrap.getBoundingClientRect() : canvas.getBoundingClientRect();
    var width = Math.max(600, Math.floor(rect.width || 1000));
    var height = 300;
    if (canvas.width !== Math.floor(width * dpr)) canvas.width = Math.floor(width * dpr);
    if (canvas.height !== Math.floor(height * dpr)) canvas.height = Math.floor(height * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '300px';
    canvas.style.maxHeight = '300px';
    canvas.style.minHeight = '300px';
    if(ctx && ctx.setTransform) ctx.setTransform(dpr,0,0,dpr,0,0);
    return {w:width,h:height};
  }

  function clearChart(){
    if(!ctx) return;
    var s = resize();
    ctx.clearRect(0,0,s.w,s.h);
  }

  function draw(points, gcEvents, memoryCorrelations){
    if(!ctx){ return; }
    var liveOnly = true;
    points = visiblePoints(points);
    if(points.length === 0){ clearChart(); return; }
    var s = resize(), w=s.w, h=s.h;
    var left=74,right=22,top=34,bottom=58;
    var pw=w-left-right, ph=h-top-bottom;
    var minT=Infinity,maxT=-Infinity,minV=Infinity,maxV=-Infinity,i;
    if(liveOnly){
      points.sort(function(a,b){ return a._sampleIndex-b._sampleIndex || metricRank(a.metric)-metricRank(b.metric); });
      minT = 0;
      maxT = Math.max(liveWindowSamples - 1, 1);
      for(i=0;i<points.length;i++){
        var xvLive = points[i]._sampleIndex != null ? points[i]._sampleIndex : i;
        points[i]._xVal = xvLive;
        if(points[i].valueMB < minV) minV = points[i].valueMB;
        if(points[i].valueMB > maxV) maxV = points[i].valueMB;
      }
    } else {
      for(i=0;i<points.length;i++){
        var xv = points[i]._time;
        points[i]._xVal = xv;
        if(xv < minT) minT = xv;
        if(xv > maxT) maxT = xv;
        if(points[i].valueMB < minV) minV = points[i].valueMB;
        if(points[i].valueMB > maxV) maxV = points[i].valueMB;
      }
    }
    if(!isFinite(minT) || !isFinite(maxT)){ minT=0; maxT=1; }
    if(minT === maxT){ minT -= 1; maxT += 1; }
    if(!isFinite(minV) || !isFinite(maxV)){ minV = 0; maxV = 1; }
    if(minV === maxV){ minV -= 25; maxV += 25; }
    var rangeV = maxV - minV;
    var padV = Math.max(15, rangeV * 0.12);
    minV = Math.max(0, minV - padV);
    maxV = maxV + padV;
    function niceStep(range){
      var rough = Math.max(1, range / 5);
      var mag = Math.pow(10, Math.floor(Math.log(rough) / Math.LN10));
      var res = rough / mag;
      var step = res >= 5 ? 5 : res >= 2 ? 2 : 1;
      return step * mag;
    }
    var stepV = niceStep(maxV - minV);
    minV = Math.max(0, Math.floor(minV / stepV) * stepV);
    maxV = Math.ceil(maxV / stepV) * stepV;
    if(maxV <= minV) maxV = minV + stepV;
    function x(v){ return left + ((v-minT)/(maxT-minT))*pw; }
    function y(v){ return top + ph - ((v-minV)/(maxV-minV))*ph; }

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#111217'; ctx.fillRect(0,0,w,h);
    ctx.font='10.5px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
    ctx.strokeStyle='#2a2c32'; ctx.lineWidth=1;
    ctx.fillStyle='#a1a1aa';
    for(i=0;i<=5;i++){
      var yy = top + ph*i/5;
      var val = maxV - (maxV-minV)*i/5;
      ctx.beginPath(); ctx.moveTo(left,yy); ctx.lineTo(left+pw,yy); ctx.stroke();
      ctx.fillText(Math.round(val) + ' MB',8,yy+4);
    }
    var readMin = Infinity, readMax = -Infinity;
    if(liveOnly){
      for(i=0;i<points.length;i++){
        var rt = points[i]._sampleReadTime || points[i]._receivedAt;
        if(rt < readMin) readMin = rt;
        if(rt > readMax) readMax = rt;
      }
    }
    var includeMs = liveOnly && isFinite(readMin) && isFinite(readMax) && (readMax - readMin < 60000);
    for(i=0;i<=4;i++){
      var tt = minT + (maxT-minT)*i/4;
      var xx = x(tt);
      ctx.beginPath(); ctx.moveTo(xx,top); ctx.lineTo(xx,top+ph); ctx.stroke();
      var label;
      if(liveOnly){
        var best = null, bestDist = Infinity;
        for(var li=0; li<points.length; li++){
          var d = Math.abs(points[li]._xVal - tt);
          if(d < bestDist){ bestDist = d; best = points[li]; }
        }
        if(best){
          var sampleNo = (best._sampleIndex != null ? best._sampleIndex + 1 : Math.round(tt) + 1);
          label = displayAxisTimeFromSample(best, best._sampleReadTime || best._receivedAt) + '  #' + sampleNo;
        } else {
          label = '#' + (Math.round(tt) + 1);
        }
      } else {
        label = fmtTime(tt);
      }
      ctx.fillText(label,xx-48,top+ph+30);
    }


    var metrics=[], exists={};
    for(i=0;i<points.length;i++){ if(!exists[points[i].metric]){ exists[points[i].metric]=true; metrics.push(points[i].metric); } }
    metrics.sort(function(a,b){ return metricRank(a)-metricRank(b) || (a < b ? -1 : 1); });
    for(var m=0;m<metrics.length;m++){
      var metric = metrics[m];
      var color = metricColor(metric).stroke;
      var series=[];
      for(i=0;i<points.length;i++){ if(points[i].metric === metric) series.push(points[i]); }
      series.sort(function(a,b){ return (a._xVal-b._xVal) || (a._time-b._time); });
      ctx.strokeStyle=color; ctx.lineWidth=2;
      ctx.beginPath();
      for(i=0;i<series.length;i++){
        var px=x(series[i]._xVal), py=y(series[i].valueMB);
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.stroke();
      ctx.fillStyle=color;
      var start = Math.max(0, series.length-80);
      for(i=start;i<series.length;i++){ ctx.beginPath(); ctx.arc(x(series[i]._xVal),y(series[i].valueMB),2.2,0,Math.PI*2); ctx.fill(); }
    }

    // Draw GC markers on top of the memory curves so the thin event lines stay visible.
    drawGcPauseMarkers(gcEvents || [], points, x, top, ph, minT, maxT, liveOnly);

    drawMemoryCorrelationFlags(memoryCorrelations || [], points, x, top, ph, minT, maxT, liveOnly);

    var lx=left, ly=18;
    for(m=0;m<metrics.length;m++){
      ctx.fillStyle=metricColor(metrics[m]).stroke; ctx.fillRect(lx,ly-10,10,10);
      ctx.fillStyle='#e4e4e7'; ctx.fillText(metrics[m],lx+16,ly);
      lx += Math.min(220,90 + metrics[m].length*7);
    }
    if(showGcEl && showGcEl.checked){ ctx.fillStyle='#fb923c'; ctx.fillRect(lx,ly-10,10,10); ctx.fillStyle='#e4e4e7'; ctx.fillText('GC activity',lx+16,ly); }
  }

  function drawGcPauseMarkers(gcEvents, points, x, top, ph, minT, maxT, liveOnly){
    // GC markers are an optional diagnostic overlay. They are disabled by
    // default because repeated runtime [stats] updates can otherwise distract
    // from the primary memory curves.
    if(!showGcEl || !showGcEl.checked || !gcEvents || !gcEvents.length || !points || !points.length) return;
    var samples = [];
    var seen = {};
    for(var i=0;i<points.length;i++){
      var p = points[i];
      var key = p._sampleIndex != null ? String(p._sampleIndex) : String(p._xVal);
      if(seen[key]) continue;
      seen[key] = true;
      samples.push(p);
    }
    var visible = [];
    for(i=0;i<gcEvents.length;i++){
      var ev = gcEvents[i];
      var ts = t((liveOnly && ev.receivedAt) ? ev.receivedAt : (ev.time || ev.receivedAt));
      var xVal = ts;
      if(liveOnly){
        var best = null, bestDist = Infinity;
        for(var j=0;j<samples.length;j++){
          var st = samples[j]._sampleReadTime || samples[j]._receivedAt || samples[j]._time;
          var d = Math.abs(st - ts);
          if(d < bestDist){ bestDist = d; best = samples[j]; }
        }
        if(!best || bestDist > 6*60*1000) continue;
        xVal = best._xVal;
      }
      if(xVal < minT || xVal > maxT) continue;
      var pause = ev.gcPauseMs == null ? null : Number(ev.gcPauseMs);
      var runtime = ev.gcRuntimePercent == null ? null : Number(ev.gcRuntimePercent);
      visible.push({ ev:ev, xVal:xVal, ts:ts, pause:pause, runtime:runtime, _px:x(xVal) });
    }
    if(!visible.length) return;

    // GC is derived from periodic [stats] snapshots, not from dedicated log events.
    // Therefore the chart shows GC as a compact activity strip instead of many
    // full-height event lines. Only notable/high pauses get a subtle vertical hint.
    visible.sort(function(a,b){ return a._px-b._px || a.ts-b.ts; });
    var clusters = [];
    var minGapPx = 36;
    for(i=0;i<visible.length;i++){
      var cur = visible[i];
      var last = clusters.length ? clusters[clusters.length-1] : null;
      if(last && Math.abs(cur._px - last._px) < minGapPx){
        last.count += 1;
        last._px = (last._px * (last.count-1) + cur._px) / last.count;
        last.xVal = cur.xVal;
        last.ts = cur.ts;
        last.lastPause = isFinite(cur.pause) ? cur.pause : last.lastPause;
        last.maxPause = Math.max(last.maxPause || 0, isFinite(cur.pause) ? cur.pause : 0);
        last.lastRuntime = isFinite(cur.runtime) ? cur.runtime : last.lastRuntime;
      } else {
        clusters.push({
          xVal: cur.xVal,
          ts: cur.ts,
          count: 1,
          _px: cur._px,
          lastPause: isFinite(cur.pause) ? cur.pause : null,
          maxPause: isFinite(cur.pause) ? cur.pause : 0,
          lastRuntime: isFinite(cur.runtime) ? cur.runtime : null
        });
      }
    }
    clusters = clusters.slice(-8);
    ctx.save();
    ctx.font='10px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
    for(i=0;i<clusters.length;i++){
      var c = clusters[i];
      var gx = Math.max(x(minT)+4, Math.min(x(maxT)-4, c._px));
      var intensity = Math.min(1, Math.max(.28, (c.maxPause || 0) / 350));
      var alpha = .30 + intensity * .45;

      // Compact top activity strip.
      ctx.fillStyle='rgba(251,146,60,' + alpha.toFixed(2) + ')';
      ctx.fillRect(gx-2, top+3, 4, 18);
      ctx.beginPath(); ctx.arc(gx, top+12, 4 + Math.min(5, c.count), 0, Math.PI*2); ctx.fill();

      // Only draw a full-height line for a genuinely notable pause.
      if((c.maxPause || 0) >= 250){
        ctx.strokeStyle='rgba(251,146,60,.28)';
        ctx.setLineDash([3,4]);
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(gx,top+24); ctx.lineTo(gx,top+ph); ctx.stroke();
        ctx.setLineDash([]);
      }

      var label = c.count > 1 ? 'GC×' + c.count : 'GC';
      if((c.maxPause || 0) >= 100 || c.count > 1){
        var bw = c.count > 1 ? 34 : 22;
        var bx = Math.max(x(minT)+2, Math.min(gx+7, x(maxT)-bw-2));
        ctx.fillStyle='rgba(251,146,60,.88)';
        ctx.fillRect(bx, top+2, bw, 13);
        ctx.fillStyle='#111217';
        ctx.fillText(label, bx+3, top+12);
      }
    }
    ctx.restore();
  }

  function drawMemoryCorrelationFlags(flags, points, x, top, ph, minT, maxT, liveOnly){
    // Correlation flags are drawn after GC and memory curves so suspected
    // behaviour changes remain visible without altering the raw data series.
    if(!flags || !flags.length || !points || !points.length) return;
    var byKey = {};
    var samples = [];
    for(var i=0;i<points.length;i++){
      var key = points[i]._sampleIndex != null ? String(points[i]._sampleIndex) : String(points[i]._xVal);
      if(!byKey[key]){ byKey[key] = points[i]; samples.push(points[i]); }
    }
    samples.sort(function(a,b){ return (a._sampleReadTime || a._receivedAt || 0) - (b._sampleReadTime || b._receivedAt || 0); });
    var visible = [];
    for(i=0;i<flags.length;i++){
      var ev = flags[i];
      var ts = t(ev.receivedAt || ev.time);
      var best = null, bestDist = Infinity;
      for(var j=0;j<samples.length;j++){
        var st = samples[j]._sampleReadTime || samples[j]._receivedAt || samples[j]._time;
        var d = Math.abs(st - ts);
        if(d < bestDist){ bestDist = d; best = samples[j]; }
      }
      if(!best || bestDist > 6*60*1000) continue;
      var xv = liveOnly ? best._xVal : ts;
      if(xv < minT || xv > maxT) continue;
      visible.push({ ev:ev, xVal:xv, ts:ts });
    }
    if(!visible.length) return;
    visible = visible.slice(-8);
    ctx.save();
    ctx.font='10.5px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
    for(i=0;i<visible.length;i++){
      var xx = x(visible[i].xVal);
      var ev = visible[i].ev;
      var trendColor = memoryCorrelationTrendColor(ev);
      ctx.strokeStyle = trendColor.stroke;
      ctx.lineWidth = 1.2;
      if(ctx.setLineDash) ctx.setLineDash([4,3]);
      ctx.beginPath(); ctx.moveTo(xx, top); ctx.lineTo(xx, top+ph); ctx.stroke();
      if(ctx.setLineDash) ctx.setLineDash([]);
      ctx.fillStyle = trendColor.fill;
      ctx.beginPath();
      ctx.moveTo(xx, top+6); ctx.lineTo(xx+12, top+10); ctx.lineTo(xx, top+14); ctx.closePath(); ctx.fill();
      var delta = Number(ev.memoryDeltaMB || ev.maxMetricDeltaMB || 0);
      ctx.fillStyle = trendColor.text;
      var label = (delta > 0 ? '+' : '') + fmtNumber(delta) + ' MB';
      ctx.fillText(label, Math.min(xx+15, x(maxT)-70), top+14 + (i%3)*13);
    }
    ctx.restore();
  }

  if(window.RLWUiInteractions && window.RLWUiInteractions.initDashboardInteractions){
    window.RLWUiInteractions.initDashboardInteractions({
      requestMemory: requestMemory,
      showGcEl: showGcEl,
      saveUiSetting: saveUiSetting,
      renderLastData: function(){ if(lastData) render(lastData); else requestMemory(); },
      intervalMs: 1000
    });
  } else {
    window.addEventListener('resize', requestMemory);
    if (showGcEl) showGcEl.onchange = function(){ saveUiSetting('showGcMarkers', !!showGcEl.checked); if(lastData) render(lastData); else requestMemory(); };
    var bindMetricChange = function(){ if(lastData) render(lastData); else requestMemory(); };
    var metricInputs = document.querySelectorAll ? document.querySelectorAll('input[data-metric]') : [];
    for(var mi=0; mi<metricInputs.length; mi++) metricInputs[mi].onchange = bindMetricChange;
    setTimeout(requestMemory, 50);
    setInterval(requestMemory, 1000);
  }
})();
