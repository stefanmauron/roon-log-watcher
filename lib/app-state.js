'use strict';

function createRuntimeHealthText({ memoryPointCount, statsLinesDetected, activeTailStreams, lastLogAgeSeconds }) {
  const lastLog = lastLogAgeSeconds == null ? 'never' : `${lastLogAgeSeconds}s ago`;
  return `OK - ${memoryPointCount} memory point(s), ${statsLinesDetected} stats line(s), ${activeTailStreams} tail stream(s), last log ${lastLog}`;
}

function createMemoryExportSnapshot({ runStartedAt, points, alerts, timeline, memoryCorrelations, incidents, incidentLifecycle, playbackSessions, zones, healthScore }) {
  return {
    generatedAt: new Date().toISOString(),
    runStartedAt,
    points,
    alerts,
    timeline,
    memoryCorrelations,
    incidents,
    incidentLifecycle,
    playbackSessions,
    zones,
    healthScore
  };
}

module.exports = { createRuntimeHealthText, createMemoryExportSnapshot };
