/* Timeline renderer namespace.
   v8.62 extracts notable event rendering from public/frontend.js. */
(function(window){
  'use strict';
  function renderTimeline(data, deps){
    deps = deps || {};
    var timelineEl = deps.timelineEl, timelineMetaEl = deps.timelineMetaEl;
    var fmtTime = deps.fmtTime || function(v){ return String(v || ''); };
    var esc = deps.esc || function(v){ return String(v == null ? '' : v); };
    if(!timelineEl || !timelineMetaEl) return;
    var items = data && data.timeline && data.timeline.slice ? data.timeline.slice(-80).reverse() : [];
    if(!items.length){
      timelineEl.innerHTML = '<span class="muted">No notable events detected yet. Playback, RAAT changes, GC pauses, memory jumps, alerts and errors will appear here.</span>';
      timelineMetaEl.textContent = '0 events';
      return;
    }
    var html = '';
    for(var i=0;i<items.length;i++){
      var e = items[i];
      var sev = String(e.severity || 'info').toLowerCase();
      if(sev !== 'critical' && sev !== 'warning') sev = 'info';
      var when = e.time ? fmtTime(e.time) : '';
      html += '<div class="tlrow">' +
        '<div class="muted">' + esc(when) + '</div>' +
        '<div><span class="tlbadge tl-' + sev + '">' + esc(sev) + '</span></div>' +
        '<div><div class="tl-title">' + esc(e.title || e.type || 'Event') + '</div>' +
        '<div class="tl-msg">' + esc(e.message || '') + '</div>' +
        '<div class="tl-source">' + esc(e.source || '') + '</div></div>' +
        '</div>';
    }
    timelineEl.innerHTML = html;
    timelineMetaEl.textContent = items.length + ' latest';
  }
  window.RLWRenderTimeline = { renderTimeline: renderTimeline };
})(window);
