'use strict';

const metricsStore = require('./metrics-store');

/**
 * Canonical runtime state shape.
 *
 * app.js still keeps some legacy variable references for compatibility, but new
 * modules should use this layout when exchanging state. It mirrors the v8.65
 * dashboard contract: telemetry, events, playback, server/runtime metadata and
 * configuration are grouped explicitly instead of growing as flat ad-hoc fields.
 */
function createRuntimeState(options = {}) {
  return {
    meta: {
      runStartedAt: options.runStartedAt || new Date().toISOString(),
      appVersion: options.appVersion || null
    },
    telemetry: {
      memoryPoints: [],
      recentMemoryByMetric: new Map(),
      statsLinesDetected: 0
    },
    events: {
      recentLogLines: [],
      alerts: [],
      timeline: [],
      incidents: [],
      incidentLifecycle: [],
      memoryCorrelations: [],
      normalizedEvents: [],
      runtimeSignals: [],
      parserErrors: [],
      pipelineErrors: []
    },
    playback: {
      sessions: [],
      activeSessions: new Map(),
      zones: new Map()
    },
    quality: {
      processedLines: 0,
      normalizedEvents: 0,
      runtimeSignals: 0,
      parserErrors: 0,
      processingErrors: 0,
      pipelineErrors: 0,
      lastProcessedAt: null
    },
    server: {
      tailProcesses: new Map(),
      memoryClients: new Set(),
      positions: new Map()
    },
    helpers: {
      pushBounded: metricsStore.pushBounded,
      trimBounded: metricsStore.trimBounded
    },

    // Legacy aliases keep older modules working while the code base migrates to
    // the grouped state shape above.
    get runStartedAt() { return this.meta.runStartedAt; },
    get memoryPoints() { return this.telemetry.memoryPoints; },
    get recentLogLines() { return this.events.recentLogLines; },
    get alertEvents() { return this.events.alerts; },
    get timelineEvents() { return this.events.timeline; },
    get incidentEvents() { return this.events.incidents; },
    get normalizedEvents() { return this.events.normalizedEvents; },
    get runtimeSignals() { return this.events.runtimeSignals; },
    pushBounded: metricsStore.pushBounded,
    trimBounded: metricsStore.trimBounded
  };
}

module.exports = { createRuntimeState };
