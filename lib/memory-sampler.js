'use strict';

function createMemoryPoint({ source, metric, mb, unit, rawValue, logClock, timestamp, line, reason, sequence }) {
  return {
    source,
    metric,
    mb,
    unit,
    rawValue,
    logClock,
    timestamp,
    line,
    reason,
    sequence
  };
}

function isUsableSample(sample) {
  return sample && Number.isFinite(Number(sample.mb)) && sample.mb >= 0;
}

module.exports = { createMemoryPoint, isUsableSample };
