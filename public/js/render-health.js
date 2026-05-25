/* Health renderer namespace.
   v8.62 moves top KPI rendering out of the dashboard entry point. */
(function(window){
  'use strict';

  function healthCard(label, value, cls, note, deps){
    deps = deps || {};
    var esc = deps.esc || function(v){ return String(v == null ? '' : v); };
    var infoIcon = deps.infoIcon || function(){ return ''; };
    var noteText = note ? ' <span class="note">(' + esc(note) + ')</span>' : '';
    // Keep the info icon at the end of the first line, after the full note in brackets.
    return '<div class="health ' + cls + '"><div class="health-title"><span class="dot"></span><span>' + esc(label) + noteText + ' ' + infoIcon(label) + '</span></div><div class="value">' + esc(value) + '</div></div>';
  }

  function renderHealth(data, deps){
    deps = deps || {};
    var healthEl = deps.healthEl;
    if(!healthEl) return;
    var card = deps.healthCard || function(label, value, cls, note){ return healthCard(label, value, cls, note, deps); };
    var port = deps.port || 17666;
    var h = data && data.health ? data.health : {};
    var logAge = h.lastLogAgeSeconds;
    var memAge = h.lastMemoryAgeSeconds;
    var html = '';
    var score = data && data.healthScore != null ? data.healthScore : h.healthScore;
    var scoreCls = score == null ? 'warn' : (score >= 90 ? 'ok' : (score >= 70 ? 'warn' : 'bad'));
    html += card('Roon Health Score', score == null ? 'warming up' : String(score) + '/100', scoreCls, 'last hour incident score');
    var tailsOk = (h.activeTailStreams || 0) > 0;
    html += card('Log streams', String(h.activeTailStreams || 0), tailsOk ? 'ok' : 'bad', 'tail -F active');
    var lastLogValue = !tailsOk ? 'offline' : (logAge == null ? 'healthy' : (logAge < 120 ? logAge + 's ago' : logAge + 's ago'));
    var lastLogClass = !tailsOk ? 'bad' : (logAge == null ? 'ok' : (logAge < 120 ? 'ok' : 'warn'));
    var lastLogNote = !tailsOk ? 'no active log stream' : (logAge == null ? 'watching, no new line yet' : (logAge < 120 ? 'live log input healthy' : 'no log line for >2 min'));
    html += card('Last log line', lastLogValue, lastLogClass, lastLogNote);
    html += card('Memory data', memAge == null ? 'waiting' : memAge + 's ago', memAge == null ? 'warn' : (memAge < 120 ? 'ok' : 'warn'), (h.memoryPointCount || 0) + ' points');
    html += card('Web server', 'ok: ' + port, 'ok', 'runtime-only dashboard');
    healthEl.innerHTML = html;
  }

  window.RLWRenderHealth = { healthCard: healthCard, renderHealth: renderHealth };
})(window);
