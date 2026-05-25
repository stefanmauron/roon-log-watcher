'use strict';

// GC pressure analysis.
// The parser in app.js extracts GC pause duration and runtime percentage from Roon stats.
// This module decides whether the values are just informative timeline markers or a real
// runtime pressure incident. Occasional short GC pauses are normal and are deliberately calm.
function formatGcMessage(pause, pct, label) {
  const parts = [];
  if (pause) parts.push(`${Math.round(pause)}ms ${label || 'pause'}`);
  if (pct) parts.push(`${pct}% runtime in GC`);
  return parts.join(', ');
}

function analyzeGcPoint(point = {}) {
  if (point.gcPauseMs == null && point.gcRuntimePercent == null) return {};
  const pause = Number(point.gcPauseMs || 0);
  const pct = Number(point.gcRuntimePercent || 0);
  const result = {};

  if (pause >= 250 || pct >= 5) {
    const warning = pause >= 1000 || pct >= 10;
    result.timelineEvent = {
      type: 'gc',
      severity: warning ? 'warning' : 'info',
      title: warning ? 'Runtime garbage collection pressure observed' : 'Short runtime garbage collection pause observed',
      message: formatGcMessage(pause, pct, 'pause'),
      source: point.source,
      dedupeMs: 30000
    };
  }

  if (pause >= 1500 || pct >= 15) {
    result.incident = {
      type: 'gc-pressure',
      severity: pause >= 1000 || pct >= 15 ? 'critical' : 'warning',
      confidence: 'medium',
      title: 'High GC pressure',
      occurrences: 1,
      message: formatGcMessage(pause, pct, 'GC pause'),
      likelyCause: 'The managed runtime spent unusually much time in garbage collection.',
      recommendation: 'Correlate with playback, metadata/library updates and memory growth. Occasional spikes are OK; repeated spikes may cause responsiveness issues.',
      source: point.source,
      dedupeMs: 2 * 60 * 1000
    };
  }

  return result;
}

module.exports = { analyzeGcPoint };
