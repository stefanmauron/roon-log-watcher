/* Playback session renderer.
   v8.66 separates track/session transitions from zone and performance rendering. */
(function(window){
  'use strict';
function renderPlaybackSessions(data, deps){
    deps = deps || {}; var playbackEl=deps.playbackEl, playbackMetaEl=deps.playbackMetaEl, fmtTime=deps.fmtTime, esc=deps.esc;
    if(!playbackEl || !playbackMetaEl) return;
    var items = data && data.playbackSessions && data.playbackSessions.slice ? data.playbackSessions.filter(function(s){ return s && s.zone && String(s.zone).toLowerCase() !== 'unknown zone' && String(s.zone).toLowerCase() !== 'audio/env'; }).slice(-12).reverse() : [];
    if(!items.length){ playbackEl.innerHTML = '<span class="muted">No playback session detected yet. Start or skip a track to see grouped playback transitions.</span>'; playbackMetaEl.textContent = '0 sessions'; return; }
    var html = '';
    for(var i=0;i<items.length;i++){
      var s = items[i], when = s.startedAt ? fmtTime(s.startedAt) : '', state = s.completedAt ? (s.health === 'review' ? 'review' : 'healthy') : (s.state || 'active'), cls = s.health === 'review' || s.severity === 'warning' ? 'review' : '';
      var title = (s.zone || '') + (s.track ? ' · ' + s.track : '');
      var meta = []; if(s.artist) meta.push(s.artist); if(s.sourceService) meta.push(s.sourceService); if(s.quality) meta.push(s.quality); if(s.format) meta.push(s.format);
      var timing = []; if(s.startLatencyMs != null) timing.push('start ' + Math.max(0, Math.round(s.startLatencyMs)) + 'ms'); if(s.eventCount != null) timing.push(String(s.eventCount) + ' events');
      html += '<div class="psrow"><div><div class="muted">' + esc(when) + '</div><span class="psstate ' + cls + '">' + esc(state) + '</span></div><div><div class="pstitle">' + esc(title) + '</div><div class="psmeta">' + esc(meta.join(' · ') || s.summary || '') + '</div></div><div class="psvalue">' + esc(timing.join(' · ') || (s.state || '')) + '</div></div>';
    }
    playbackEl.innerHTML = html; playbackMetaEl.textContent = items.length + ' latest · grouped playback transitions';
  }
  window.RLWRenderPlaybackEvents = { renderPlaybackSessions: renderPlaybackSessions };
})(window);
