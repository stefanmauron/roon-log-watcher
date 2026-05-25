'use strict';

const path = require('path');
const metricsStore = require('./metrics-store');
const eventPipeline = require('./event-pipeline');
const logLineProcessor = require('./log-line-processor');

function createLiveLogProcessingService(options = {}) {
  const required = [
    'runtimeState', 'config', 'correlationEngine', 'patterns', 'isBenignForAlerting',
    'collectMemoryData', 'detectPlaybackSession', 'updateZoneStatsFromLine',
    'detectTimelineEvent', 'detectIncidentFromLine', 'emitAlert', 'trimLine',
    'addRecentLogLine', 'writeLogLine'
  ];
  for (const key of required) {
    if (options[key] == null) throw new Error(`createLiveLogProcessingService requires ${key}`);
  }

  const runtimeState = options.runtimeState;
  const config = options.config || {};
  const showAllLogLines = Boolean(options.showAllLogLines);
  const terminalLogsEnabled = Boolean(options.terminalLogsEnabled);

  function inspectLine(file, line) {
    const fileName = path.basename(file);
    const trimmed = options.trimLine(line);
    const matches = options.isBenignForAlerting(line) ? [] : options.patterns.filter(p => p.re.test(line));

    options.collectMemoryData(file, line, trimmed, 'live');
    options.detectPlaybackSession(file, trimmed);
    options.updateZoneStatsFromLine(file, trimmed);

    if (showAllLogLines) {
      const displayLine = `${matches.length ? '[MATCH]' : '[LOG]'} ${path.basename(path.dirname(path.dirname(file)))}/${fileName}: ${trimmed}`;
      options.addRecentLogLine(displayLine, matches.length > 0);
      if (terminalLogsEnabled) options.writeLogLine(displayLine);
    }
    options.detectTimelineEvent(file, trimmed, matches);
    options.detectIncidentFromLine(file, trimmed, matches);
    for (const pattern of matches) options.emitAlert(fileName, pattern, trimmed);
  }

  function recordNormalizedEvent(event) {
    runtimeState.quality.normalizedEvents += 1;
    runtimeState.quality.lastProcessedAt = new Date().toISOString();
    if (event && event.type === 'parser.error') runtimeState.quality.parserErrors += 1;
    metricsStore.pushBounded(runtimeState.events.normalizedEvents, event, Number(config.normalizedEventHistoryMax || 500));
    if (event && event.type === 'parser.error') metricsStore.pushBounded(runtimeState.events.parserErrors, event, 100);
  }

  function recordRuntimeSignal(signal) {
    runtimeState.quality.runtimeSignals += 1;
    metricsStore.pushBounded(runtimeState.events.runtimeSignals, signal, Number(config.runtimeSignalHistoryMax || 300));
  }

  const processLogLine = logLineProcessor.createLogLineProcessor({
    pipeline: eventPipeline.createPipeline({
      inspectLine,
      correlationEngine: options.correlationEngine,
      onNormalizedEvent: recordNormalizedEvent,
      onRuntimeSignal: recordRuntimeSignal,
      onPipelineError(errorEvent) {
        runtimeState.quality.pipelineErrors += 1;
        metricsStore.pushBounded(runtimeState.events.pipelineErrors, errorEvent, 100);
      }
    }),
    onProcessed(result) {
      runtimeState.quality.processedLines += 1;
      runtimeState.quality.lastProcessedAt = new Date().toISOString();
      return result;
    },
    onError(err, context) {
      runtimeState.quality.processingErrors += 1;
      runtimeState.quality.parserErrors += 1;
      console.error('Log-line processing failed:', err.message, context && context.file ? '(' + context.file + ')' : '');
      return null;
    }
  });

  return { inspectLine, processLogLine, recordNormalizedEvent, recordRuntimeSignal };
}

module.exports = { createLiveLogProcessingService };
