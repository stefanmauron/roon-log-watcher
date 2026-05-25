/* Incident and alert rendering.
   v8.65 separates diagnosis panels from live-log rendering to reduce cross-impact when incident UI changes. */
(function(window){
  'use strict';
function renderAlerts(data, deps){
    deps = deps || {}; var alertsEl=deps.alertsEl, alertMetaEl=deps.alertMetaEl, fmtTime=deps.fmtTime, esc=deps.esc;
    if(!alertsEl || !alertMetaEl) return;
    var alerts = data && data.alerts && data.alerts.slice ? data.alerts.slice(-20).reverse() : [];
    if(!alerts.length){ alertsEl.innerHTML = '<span class="muted">No alerts in this run.</span>'; alertMetaEl.textContent = '0 alerts'; return; }
    var html = '';
    for(var i=0;i<alerts.length;i++){
      var a = alerts[i]; var when = a.time ? fmtTime(a.time) : '';
      html += '<div class="alertrow"><span class="muted">' + esc(when) + '</span> <strong>' + esc((a.severity || 'info').toUpperCase()) + '</strong> ' + esc(a.title || '') + ' — ' + esc(a.message || '') + '</div>';
    }
    alertsEl.innerHTML = html; alertMetaEl.textContent = alerts.length + ' latest';
  }
function renderIncidents(data, deps){
    deps = deps || {}; var incidentsEl=deps.incidentsEl, incidentMetaEl=deps.incidentMetaEl, fmtTime=deps.fmtTime, esc=deps.esc;
    if(!incidentsEl || !incidentMetaEl) return;
    var items = data && data.incidents && data.incidents.slice ? data.incidents.slice(-20).reverse() : [];
    var score = data && data.healthScore != null ? data.healthScore : null;
    if(!items.length){ incidentsEl.innerHTML = '<span class="muted">No diagnosis yet. Repeated RAAT/audio/content/database/memory/GC patterns will appear here with likely causes.</span>'; incidentMetaEl.textContent = score == null ? 'no incidents' : 'Health Score ' + score + '/100'; return; }
    var html = '';
    for(var i=0;i<items.length;i++){
      var e = items[i]; var sev = String(e.severity || 'info').toLowerCase(); if(sev !== 'critical' && sev !== 'warning') sev = 'info'; var when = e.time ? fmtTime(e.time) : '';
      html += '<div class="incident ' + sev + '">' +
        '<div class="incident-title">' + esc(e.title || e.type || 'Incident') + '</div>' +
        '<div class="incident-meta">' + esc(when) + ' · ' + esc(sev.toUpperCase()) + ' · confidence ' + esc(e.confidence || 'medium') + ' · occurrences ' + esc(e.occurrences || 1) + '</div>' +
        '<div>' + esc(e.message || '') + '</div>' +
        (e.likelyCause ? '<div class="diagnosis"><strong>Likely cause:</strong> ' + esc(e.likelyCause) + '</div>' : '') +
        (e.recommendation ? '<div class="diagnosis"><strong>Recommended check:</strong> ' + esc(e.recommendation) + '</div>' : '') +
        (e.source ? '<div class="tl-source">' + esc(e.source) + '</div>' : '') +
        '</div>';
    }
    incidentsEl.innerHTML = html; incidentMetaEl.textContent = (score == null ? '' : 'Health Score ' + score + '/100 · ') + items.length + ' latest';
  }
function renderIncidentLifecycle(data, deps){
    deps = deps || {}; var lifecycleEl=deps.lifecycleEl, lifecycleMetaEl=deps.lifecycleMetaEl, esc=deps.esc, fmtDurationMs=deps.fmtDurationMs || (window.RLWLogFormatters && window.RLWLogFormatters.fmtDurationMs);
    if(!lifecycleEl || !lifecycleMetaEl) return;
    var items = data && data.incidentLifecycle && data.incidentLifecycle.slice ? data.incidentLifecycle.slice(0, 10) : [];
    if(!items.length){ lifecycleEl.innerHTML = '<span class="muted">No incident lifecycle yet. Started, degraded and recovered incidents will appear here with duration, impact and affected zone.</span>'; lifecycleMetaEl.textContent = '0 incidents'; return; }
    var html = '', running = 0;
    for(var i=0;i<items.length;i++){
      var e = items[i]; var status = String(e.status || (e.recoveredAt ? 'recovered' : 'started')).toLowerCase(); var cls = status; if(String(e.severity || '').toLowerCase() === 'critical') cls += ' critical'; if(!e.recoveredAt) running++;
      var when = e.startedAt ? new Date(e.startedAt).toLocaleTimeString() : ''; var title = e.title || e.type || 'Incident'; var zone = e.affectedZone || e.zone || 'Unknown zone'; var impact = e.impact || 'low';
      html += '<div class="lcrow"><div><div class="muted">' + esc(when) + '</div><span class="lcstate ' + esc(cls) + '">' + esc(status) + '</span></div><div><div class="lctitle">' + esc(title) + '</div><div class="lcmeta">Zone: ' + esc(zone) + ' · duration ' + esc(fmtDurationMs(e.durationMs)) + '</div><div class="lcmeta">' + esc(e.recoveryReason || e.message || '') + '</div></div><div class="lcimpact">impact<br><strong>' + esc(impact) + '</strong></div></div>';
    }
    lifecycleEl.innerHTML = html; lifecycleMetaEl.textContent = running ? (running + ' active / ' + items.length + ' latest') : (items.length + ' recovered/latest');
  }
  window.RLWRenderIncidents = { renderAlerts:renderAlerts, renderIncidents:renderIncidents, renderIncidentLifecycle:renderIncidentLifecycle };
})(window);
