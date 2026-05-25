'use strict';

const memoryAnalysis = require('../memory-analysis');
const { createNormalizedEvent } = require('../domain-events');

function extractSamples(line) {
  return memoryAnalysis.extractMemorySamples(line);
}

function extractGcInfo(line) {
  return memoryAnalysis.extractGcInfo(line);
}

function parse(parsed) {
  const samples = extractSamples(parsed.line || '');
  if (!samples.length) return [];
  const gc = extractGcInfo(parsed.line || '');
  return samples.map(sample => createNormalizedEvent(parsed, {
    domain: 'memory',
    type: 'memory.sample.detected',
    title: 'Memory sample detected',
    metric: sample.metric,
    valueMB: Number(Number(sample.valueMB || 0).toFixed(2)),
    gcRuntimePercent: gc.gcRuntimePercent,
    gcPauseMs: gc.gcPauseMs
  }));
}

module.exports = { name: 'roon-memory-parser', domains: ['memory'], version: 1, parse, extractSamples, extractGcInfo };
