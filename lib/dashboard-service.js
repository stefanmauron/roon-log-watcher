'use strict';

// v8.71: Dashboard exports and HTTP startup now live behind a small service.
// app-main.js supplies live getters, while this module owns the repeated export
// and server-wiring boilerplate.
function createDashboardService(options) {
  const {
    rootDir,
    dashboardHtml,
    releaseInfo,
    appVersion,
    memoryWindowPort,
    memoryHistoryMaxPoints,
    memoryDebug,
    dashboardDataBuilder,
    serverStartup,
    apiRoutes,
    openUrl,
    getDebugStats,
    getContext
  } = options;

  function exportDiagnosticSummary() {
    return dashboardDataBuilder.createDiagnosticSummary(getContext());
  }

  function exportMemoryJson() {
    return dashboardDataBuilder.createMemoryExportJson(getContext());
  }

  function exportLogsText() {
    return dashboardDataBuilder.createLogsText(getContext());
  }

  function getHealthText() {
    return dashboardDataBuilder.createHealthText(getContext());
  }

  function getMemorySnapshot() {
    return dashboardDataBuilder.createMemorySnapshot(getContext());
  }

  function getHealthSnapshot() {
    return dashboardDataBuilder.createHealthSnapshot(getContext());
  }

  function exportMemoryCsv() {
    return dashboardDataBuilder.createMemoryCsv(getContext());
  }

  function startMemoryWindow() {
    return serverStartup.startDashboardServer({
      port: memoryWindowPort,
      requestHandler: apiRoutes.createDashboardRequestHandler({
        rootDir,
        dashboardHtml,
        releaseInfo,
        appVersion,
        memoryWindowPort,
        memoryHistoryMaxPoints,
        getMemorySnapshot,
        exportMemoryCsv,
        exportMemoryJson,
        exportLogsText,
        exportDiagnosticSummary,
        getHealthSnapshot,
        getHealthText
      }),
      openUrl,
      memoryDebug,
      getDebugStats
    });
  }

  function broadcastMemoryPoint(memoryClients, point) {
    const payload = `event: point\ndata: ${JSON.stringify(point)}\n\n`;
    for (const client of memoryClients) client.write(payload);
  }

  return {
    startMemoryWindow,
    exportDiagnosticSummary,
    exportMemoryJson,
    exportLogsText,
    getHealthText,
    getMemorySnapshot,
    getHealthSnapshot,
    exportMemoryCsv,
    broadcastMemoryPoint
  };
}

module.exports = { createDashboardService };
