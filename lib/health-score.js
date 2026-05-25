'use strict';

// Central Health Score calculation.
// Inputs: incident events, GC timeline events and memory alerts from the last runtime window.
// Output: a 0-100 operator score. 100 means no relevant recent signals; lower values mean
// repeated or severe recent signals need review. The module intentionally caps penalties per
// incident category so one noisy subsystem cannot dominate the whole score.
function calculateIncidentHealthScore({ incidentEvents = [], timelineEvents = [], alertEvents = [], now = Date.now() } = {}) {
  const recent = incidentEvents.filter(e => now - new Date(e.time).getTime() <= 60 * 60 * 1000);
  let score = 100;
  const categoryPenaltyCap = new Map();

  for (const e of recent) {
    const sev = String(e.severity || 'info').toLowerCase();
    const type = String(e.type || 'other');
    let penalty = sev === 'critical' ? 25 : sev === 'warning' ? 4 : 0;

    if (type === 'streaming-cache-activity' || type === 'remote-access-connectivity') penalty = 0;
    if (type === 'streaming-metadata-issues') penalty = Math.min(penalty, 2);
    if (type === 'database-stress' && sev !== 'critical') penalty = Math.min(penalty, 4);

    categoryPenaltyCap.set(type, (categoryPenaltyCap.get(type) || 0) + penalty);
  }

  for (const [type, value] of categoryPenaltyCap.entries()) {
    const cap = type === 'streaming-metadata-issues' ? 6 :
                type === 'database-stress' ? 10 :
                type === 'raat-instability' ? 18 :
                type === 'audio-zone-instability' ? 14 : 25;
    score -= Math.min(cap, value);
  }

  const gcWarningRecent = timelineEvents.filter(e => e.type === 'gc' && String(e.severity || '').toLowerCase() === 'warning' && now - new Date(e.time).getTime() <= 30 * 60 * 1000).length;
  if (gcWarningRecent > 3) score -= Math.min(8, gcWarningRecent - 3);

  const memWarns = alertEvents.filter(e => e.type === 'memory' && now - new Date(e.time).getTime() <= 60 * 60 * 1000).length;
  score -= Math.min(15, memWarns * 3);

  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = { calculateIncidentHealthScore };
