'use strict';

const commandRegistry = require('./command-registry');
const { createPlatformAdapter } = require('./platform-adapter');

function printStartupSummary({ appVersion, showAllLogLines, terminalLogsEnabled, smoothTerminalOutput, terminalOutputIntervalMs, useTailBackend, pollIntervalMs, memoryWindowEnabled, memoryWindowPort, processMemoryPollingEnabled, processMemoryPollIntervalMs, directories }) {
  console.log('Roon Log Watcher v' + appVersion + ' starting (dashboard-only edition)...');
  console.log('Mode:', showAllLogLines ? 'show all new log lines' : 'show warnings/anomalies only');
  console.log('Log output:', terminalLogsEnabled ? (smoothTerminalOutput ? `terminal smooth (${terminalOutputIntervalMs}ms per line)` : 'terminal immediate / rolling') : 'browser window only');
  console.log('Log read backend:', useTailBackend ? 'tail -F event stream' : 'polling');
  console.log('Polling:', pollIntervalMs / 1000, 'seconds');
  console.log('Memory window:', memoryWindowEnabled ? `enabled on http://localhost:${memoryWindowPort}` : 'disabled');
  console.log('Process memory polling:', memoryWindowEnabled && processMemoryPollingEnabled ? `enabled every ${processMemoryPollIntervalMs / 1000}s` : 'disabled');
  console.log('Log directories:');
  directories.forEach(d => console.log(' -', d));
  console.log('');
}

function printReadyMessage() {
  console.log('');
  commandRegistry.getReadyConsoleLines().forEach(line => console.log(line));
  console.log('');
}

function openUrl(url, adapter = createPlatformAdapter()) {
  adapter.openUrl(url);
}

function registerShutdownHandlers({ stop }) {
  const handler = () => {
    try { stop(); } catch (_) {}
    process.exit(0);
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}

module.exports = { printStartupSummary, printReadyMessage, openUrl, registerShutdownHandlers };
