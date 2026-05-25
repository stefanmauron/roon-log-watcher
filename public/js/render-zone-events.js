/* Zone and endpoint renderer.
   v8.66 separates endpoint/zone state from playback-session rendering. */
(function(window){
  'use strict';
function renderZones(data, deps){
    deps = deps || {}; var zoneEl=deps.zoneEl, zoneMetaEl=deps.zoneMetaEl, esc=deps.esc;
    if(!zoneEl || !zoneMetaEl) return;
    var items = data && data.zones && data.zones.slice ? data.zones.slice(0, 8) : [];
    if(!items.length){ zoneEl.innerHTML = '<span class="muted">No zone activity detected yet. Start playback to see endpoint health, buffering, latency and jitter.</span>'; zoneMetaEl.textContent = '0 zones'; return; }
    var html = '';
    for(var i=0;i<items.length;i++){
      var z = items[i], health = String(z.health || 'healthy').toLowerCase();
      var healthCls = health === 'review' || health === 'warning' ? 'review' : (health === 'idle' ? 'idle' : (health === 'critical' || health === 'bad' ? 'bad' : ''));
      var title = z.zone || 'Unknown zone'; var track = z.lastTrack ? (z.lastArtist ? z.lastTrack + ' – ' + z.lastArtist : z.lastTrack) : (z.state || 'idle');
      var rtt = z.avgRttUs == null ? 'RTT -' : ('RTT ' + (z.avgRttUs >= 1000 ? Math.round(z.avgRttUs/1000) + 'ms' : z.avgRttUs + 'µs'));
      var buffering = z.avgBufferingMs == null ? 'buffer -' : 'buffer ' + z.avgBufferingMs + 'ms'; var start = z.avgStartLatencyMs == null ? 'start -' : 'start ' + z.avgStartLatencyMs + 'ms';
      var incidents = 'inc/h ' + (z.incidentsLastHour || 0), reconnects = 'reconn ' + (z.reconnects || 0), gc = 'GC ' + (z.gcImpactEvents || 0);
      html += '<div class="zonerow"><div><div class="zonetitle">' + esc(title) + '</div><div class="zonemeta">' + esc(track) + '</div><div class="zonemeta">' + esc([start, buffering, rtt].join(' · ')) + '</div></div><div class="zonekpis"><span class="zonehealth ' + healthCls + '">' + esc(health === 'review' ? 'review' : health) + '</span><br>' + esc([reconnects, gc, incidents].join(' · ')) + '</div></div>';
    }
    zoneEl.innerHTML = html; zoneMetaEl.textContent = items.length + ' active/recent zones';
  }
  window.RLWRenderZoneEvents = { renderZones: renderZones };
})(window);
