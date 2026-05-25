'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const memoryRuntimeServiceFactory = require('../lib/memory-runtime-service');
const incidentLifecycleServiceFactory = require('../lib/incident-lifecycle-service');
const memoryAnalysis = require('../lib/memory-analysis');
const memoryTrends = require('../lib/memory-trends');
const gcAnalysis = require('../lib/gc-analysis');
const runtimeIntelligence = require('../lib/runtime-intelligence');
const memorySampler = require('../lib/memory-sampler');
const metricsStore = require('../lib/metrics-store');
const healthScore = require('../lib/health-score');

test('memory runtime service parses Roon stats and stores bounded memory points', () => {
  const memoryPoints = [];
  const timeline = [];
  const alerts = [];
  const service = memoryRuntimeServiceFactory.createMemoryRuntimeService({
    path: require('node:path'),
    memoryAnalysis,
    memoryTrends,
    gcAnalysis,
    runtimeIntelligence,
    memorySampler,
    metricsStore,
    processMemoryMonitor: { findRoonProcesses: () => [], selectBestRoonProcess: () => null, readLinuxProcMemory: () => null },
    platformAdapter: { isLinux: false },
    memoryWindowEnabled: true,
    processMemoryPollingEnabled: false,
    processMemoryPollIntervalMs: 1000,
    memoryHistoryMaxPoints: 10,
    memoryDebug: false,
    memoryPoints,
    recentMemoryByMetric: new Map(),
    recentLogLines: [],
    memoryCorrelationEvents: [],
    memoryCorrelationMaxEvents: 5,
    memoryAlertConfig: { enabled: false },
    alertDedupeMs: 1000,
    applyZoneMemoryImpact: () => {},
    addTimelineEvent: event => timeline.push(event),
    addIncident: () => {},
    addAlertEvent: event => alerts.push(event),
    sendNotification: () => {},
    broadcastMemoryPoint: () => {},
    trimLine: line => String(line).trim()
  });

  service.collectMemoryData('/tmp/RoonServer/RoonServer_log.txt', '05/24 13:50:00 [Local 05/24 15:50:00] Info: [stats] 36758mb Virtual, 1083mb Physical, 419mb Managed, 664mb estimated Unmanaged', 'stats line');

  assert.equal(service.getMemoryStatsLinesDetected(), 1);
  assert.deepEqual(memoryPoints.map(point => point.metric), ['Virtual Memory', 'Physical Memory', 'Managed Memory', 'Unmanaged Memory']);
  assert.equal(memoryPoints[1].valueMB, 1083);
  assert.equal(timeline.length, 0);
  assert.equal(alerts.length, 0);
});

test('incident lifecycle service starts, degrades and recovers incidents by zone', () => {
  const incidentEvents = [];
  const incidentLifecycles = [];
  const timelineEvents = [];
  const alertEvents = [];
  const service = incidentLifecycleServiceFactory.createIncidentLifecycleService({
    metricsStore,
    incidentEvents,
    incidentLifecycles,
    timelineEvents,
    alertEvents,
    incidentMaxEvents: 20,
    normalizeSeverity: severity => severity || 'warning',
    normalizeZoneName: value => value || 'Unknown zone',
    extractZoneFromLine: line => /Kitchen/.test(line) ? 'Kitchen' : 'Unknown zone',
    addTimelineEvent: event => timelineEvents.push(event),
    calculateHealthScore: healthScore.calculateIncidentHealthScore
  });

  service.addIncident({ type: 'raat-disconnect', severity: 'warning', title: 'RAAT disconnect', message: 'Zone Kitchen disconnected', zone: 'Kitchen' });
  service.addIncident({ type: 'raat-disconnect', severity: 'warning', title: 'RAAT disconnect still active', message: 'Zone Kitchen still disconnected', zone: 'Kitchen' });

  let snapshot = service.getIncidentLifecycleSnapshot();
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].status, 'degraded');
  assert.equal(snapshot[0].affectedZone, 'Kitchen');

  service.recoverIncidentLifecyclesForZone('Kitchen', 'Playback recovered');
  snapshot = service.getIncidentLifecycleSnapshot();
  assert.equal(snapshot[0].status, 'recovered');
  assert.equal(snapshot[0].recoveryReason, 'Playback recovered');
  assert.ok(service.getIncidentHealthScore());
});
