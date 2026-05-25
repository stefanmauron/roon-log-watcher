/* Playback performance metrics renderer.
   v8.66 isolates latency, buffering, RAAT sync and endpoint RTT cards. */
(function(window){
  'use strict';
  var pf = window.RLWPlaybackFormatters || {};
  var avg = pf.avg || function(){ return null; };
  var fmtMs = pf.fmtMs || function(){ return '-'; };
  var fmtUs = pf.fmtUs || function(){ return '-'; };
function renderPerformanceMetrics(data, deps){
    deps = deps || {}; var perfEl=deps.perfEl, perfMetaEl=deps.perfMetaEl, esc=deps.esc;
    if(!perfEl || !perfMetaEl) return;
    var zones = data && data.zones && data.zones.slice ? data.zones : []; var sessions = data && data.playbackSessions && data.playbackSessions.slice ? data.playbackSessions : []; var completed = sessions.filter(function(s){ return s && s.completedAt; });
    var startValues = completed.map(function(s){ return s.startLatencyMs; }).filter(function(v){ return v != null; }); if(!startValues.length) startValues = zones.map(function(z){ return z.avgStartLatencyMs; }).filter(function(v){ return v != null; });
    var bufferValues = zones.map(function(z){ return z.avgBufferingMs; }).filter(function(v){ return v != null; }); var negotiationValues = completed.map(function(s){ return s.durationMs; }).filter(function(v){ return v != null && v >= 0 && v < 60000; }); var rttValues = zones.map(function(z){ return z.avgRttUs; }).filter(function(v){ return v != null; });
    var reconnects = zones.reduce(function(sum,z){ return sum + Number(z.reconnects || 0); }, 0); var gcImpact = zones.reduce(function(sum,z){ return sum + Number(z.gcImpactEvents || 0); }, 0); var incidents = zones.reduce(function(sum,z){ return sum + Number(z.incidentsLastHour || 0); }, 0);
    var reviewSessions = completed.filter(function(s){ return s.health === 'review' || s.severity === 'warning' || s.severity === 'critical'; }).length; var dspSessions = sessions.filter(function(s){ return /Enhanced|DSP|SampleRateConversion|ParametricEQ|HeadroomGain/i.test([s.quality, s.format, s.summary, s.lastLine].join(' ')); }).length;
    var raatStability = 'stable'; if(reconnects >= 3 || incidents >= 3 || reviewSessions >= 3) raatStability = 'review'; if(reconnects >= 8 || incidents >= 8) raatStability = 'unstable';
    if(!sessions.length && !zones.length){ perfEl.innerHTML = '<span class="muted">No playback performance data yet. Start playback to calculate latency, buffering, RAAT stability and endpoint RTT.</span>'; perfMetaEl.textContent = '0 metrics'; return; }
    var items = [ ['Track start', fmtMs(avg(startValues)), startValues.length ? startValues.length + ' samples' : 'waiting for start events'], ['Buffering', fmtMs(avg(bufferValues)), bufferValues.length ? bufferValues.length + ' zone samples' : 'waiting for buffering events'], ['Stream negotiation', fmtMs(avg(negotiationValues)), negotiationValues.length ? negotiationValues.length + ' completed sessions' : 'waiting for completed sessions'], ['DSP pipeline', dspSessions ? dspSessions + ' sessions' : 'inactive', dspSessions ? 'enhanced path detected' : 'No DSP activity detected'], ['RAAT sync', raatStability, reconnects + ' reconnects · ' + incidents + ' inc/h'], ['Endpoint RTT', fmtUs(avg(rttValues)), rttValues.length ? rttValues.length + ' endpoint samples' : 'waiting for RTT samples'] ];
    var html = '<div class="perfgrid">'; for(var i=0;i<items.length;i++){ html += '<div class="perfitem"><div class="perfline">' + esc(items[i][0]) + ': <strong>' + esc(items[i][1]) + '</strong></div><div class="perfsub">' + esc(items[i][2]) + '</div></div>'; } html += '</div>';
    perfEl.innerHTML = html; perfMetaEl.textContent = (completed.length || sessions.length) + ' sessions · ' + zones.length + ' zones';
  }
  window.RLWRenderPlaybackMetrics = { renderPerformanceMetrics: renderPerformanceMetrics };
})(window);
