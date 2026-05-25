/* Raw live log stream rendering.
   v8.65 keeps newest-first log output, filtering and sequence tracking in one focused module. */
(function(window){
  'use strict';
function renderLogs(data, deps){
    deps = deps || {}; var logOutputEl=deps.logOutputEl, logMetaEl=deps.logMetaEl, logSearchEl=deps.logSearchEl, fmtTime=deps.fmtTime, esc=deps.esc; var lastRenderedLogSeq=deps.lastRenderedLogSeq || 0;
    if(!logOutputEl || !logMetaEl) return lastRenderedLogSeq;
    var logs = data && data.recentLogs && data.recentLogs.slice ? data.recentLogs : []; var query = logSearchEl && logSearchEl.value ? String(logSearchEl.value).toLowerCase().trim() : '';
    if(query){ logs = logs.filter(function(line){ return String(line.text || '').toLowerCase().indexOf(query) >= 0; }); }
    if(!logs.length){ logOutputEl.textContent = 'Waiting for new log entries…'; logMetaEl.textContent = '0 log lines in this run'; return lastRenderedLogSeq; }
    var html = ''; logs = logs.slice().reverse();
    for(var i=0;i<logs.length;i++){ var line = logs[i]; var stamp = ''; try { stamp = fmtTime(line.receivedAt); } catch(e) { stamp = ''; } var cls = line.isMatch ? 'match' : ''; html += '<span class="muted">' + esc(stamp) + '</span> <span class="' + cls + '">' + esc(line.text || '') + '</span>' + String.fromCharCode(10); if(line.seq && line.seq > lastRenderedLogSeq) lastRenderedLogSeq = line.seq; }
    logOutputEl.innerHTML = html; logMetaEl.textContent = logs.length + ' shown / ' + (data.recentLogCount || logs.length) + ' total in this run'; logOutputEl.scrollTop = 0; return lastRenderedLogSeq;
  }
  window.RLWRenderLogStream = { renderLogs:renderLogs };
})(window);
