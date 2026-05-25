'use strict';

/**
 * Module extraction roadmap for the next cleanup steps.
 *
 * This file documents the intended responsibility split and gives future changes a
 * stable place to align against. It is not part of the hot runtime path.
 */
module.exports = {
  app: 'Startup orchestration, CLI arguments and wiring between modules.',
  logDiscovery: 'Roon log path discovery across macOS, Linux, mounted volumes and configured paths.',
  processCleanup: 'Old watcher detection, port conflict cleanup and tail process handling.',
  memoryAnalysis: 'Managed / Physical / Unmanaged memory, MB/h growth, GC pressure and plausibility checks.',
  healthScore: 'Health score deductions, weighting, incident influence and final score explanation.',
  runtimeFlags: 'Runtime Behaviour Intelligence, incident classification and severity normalization.',
  dashboardServer: 'HTTP endpoints, memory window, dashboard HTML and export routes.'
};
