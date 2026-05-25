'use strict';

// Memory growth trend calculation.
// High-level algorithm:
// 1. Use only samples of the same metric inside the configured observation window.
// 2. Require a minimum number of samples to avoid reporting startup noise.
// 3. Compare oldest and newest value in the window.
// 4. If the delta exceeds the threshold, emit both a memory alert and an incident payload.
function evaluateGrowthAlert({ metric, point, memoryPoints = [], memoryAlertConfig = {} } = {}) {
  const windowMinutes = Math.max(1, Number(memoryAlertConfig.growthWindowMinutes || 30));
  const windowMs = windowMinutes * 60 * 1000;
  const threshold = Number(memoryAlertConfig.growthThresholdMB || 200);
  const minSamples = Number(memoryAlertConfig.minSamplesForGrowth || 5);
  const latestTime = new Date(point.receivedAt).getTime();

  const series = memoryPoints
    .filter(p => p.metric === metric && latestTime - new Date(p.receivedAt).getTime() <= windowMs)
    .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));

  if (series.length < minSamples) return null;
  const first = series[0];
  const delta = Number(point.valueMB || 0) - Number(first.valueMB || 0);
  if (delta < threshold) return null;

  return {
    alert: {
      key: 'growth-' + metric,
      severity: 'warning',
      title: metric + ' growth',
      message: `+${Math.round(delta)} MB in ${windowMinutes} min`
    },
    incident: {
      type: 'memory-growth',
      severity: metric === 'Unmanaged Memory' ? 'warning' : 'info',
      confidence: 'medium',
      title: metric + ' growth trend',
      occurrences: series.length,
      message: `+${Math.round(delta)} MB over ${windowMinutes} minutes`,
      likelyCause: metric === 'Unmanaged Memory'
        ? 'Possible native/audio/RAAT/DSP buffer growth or leak-like behaviour.'
        : 'Memory use is increasing over the observation window.',
      recommendation: 'Watch whether the value stabilizes or continues rising. Export the session if it keeps growing.',
      source: point.source,
      dedupeMs: 5 * 60 * 1000
    }
  };
}

module.exports = { evaluateGrowthAlert };
