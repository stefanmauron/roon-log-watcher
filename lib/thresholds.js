'use strict';

const DEFAULT_THRESHOLDS = Object.freeze({
  alertDedupeMs: 60_000,
  memoryAlerts: Object.freeze({
    physicalMemoryMB: 2500,
    unmanagedMemoryMB: 1800,
    managedMemoryMB: 1200,
    growthWindowMinutes: 30,
    growthThresholdMB: 200,
    minSamplesForGrowth: 5,
    enabled: true
  })
});

function buildThresholds(config) {
  return {
    alertDedupeMs: Number(config.alertDedupeMs || DEFAULT_THRESHOLDS.alertDedupeMs),
    memoryAlerts: Object.assign({}, DEFAULT_THRESHOLDS.memoryAlerts, config.memoryAlerts || {})
  };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  buildThresholds
};
