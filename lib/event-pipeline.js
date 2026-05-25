'use strict';

const domainEvents = require('./domain-events');
const parserRegistry = require('./parsers');

function safeCall(fn, ...args) {
  if (typeof fn !== 'function') return undefined;
  return fn(...args);
}

// Canonical runtime pipeline.
// Raw Log Line -> Parsed Log Line -> Normalized Domain Events -> Correlated Runtime Signals.
// The optional inspectLine hook preserves the legacy runtime path while the rest of the
// app migrates away from string-based analysis toward event-based processing.
function createPipeline({ inspectLine, onRawLogLine, onParsedLogLine, onNormalizedEvent, correlationEngine, onRuntimeSignal, onPipelineError, parsers } = {}) {
  if (inspectLine != null && typeof inspectLine !== 'function') throw new Error('event-pipeline inspectLine must be a function');
  const configuredParsers = parsers || parserRegistry.defaultParsers;

  return function processLine(file, rawLine) {
    const raw = domainEvents.createRawLogLine(file, rawLine);
    if (!raw) return null;

    const pipelineErrors = [];
    function capture(stage, err) {
      const errorEvent = domainEvents.createNormalizedEvent(domainEvents.createParsedLogLine(raw), {
        domain: 'pipeline',
        type: 'pipeline.error',
        severity: 'warning',
        title: 'Pipeline error',
        stage,
        message: err && err.message ? err.message : String(err || 'Unknown pipeline error')
      });
      pipelineErrors.push(errorEvent);
      safeCall(onPipelineError, errorEvent, err);
      return errorEvent;
    }

    try { safeCall(onRawLogLine, raw); } catch (err) { capture('raw-hook', err); }

    const parsed = domainEvents.createParsedLogLine(raw);
    try { safeCall(onParsedLogLine, parsed); } catch (err) { capture('parsed-hook', err); }

    let normalizedEvents = [];
    try {
      normalizedEvents = parserRegistry.parseDomainEvents(parsed, configuredParsers);
    } catch (err) {
      normalizedEvents = [parserRegistry.createParserError(parsed, err, 'parser-registry')];
    }
    normalizedEvents.push(...pipelineErrors);

    const runtimeSignals = [];
    for (const event of normalizedEvents) {
      try { safeCall(onNormalizedEvent, event); } catch (err) { capture('normalized-event-hook', err); }
      if (correlationEngine && typeof correlationEngine.process === 'function') {
        try {
          const signals = correlationEngine.process(event) || [];
          for (const signal of signals) {
            runtimeSignals.push(signal);
            safeCall(onRuntimeSignal, signal, event);
          }
        } catch (err) {
          const errorEvent = capture('correlation-engine', err);
          normalizedEvents.push(errorEvent);
        }
      }
    }

    if (inspectLine) inspectLine(file, parsed.line, { raw, parsed, normalizedEvents, runtimeSignals });
    return { file, line: parsed.line, raw, parsed, normalizedEvents, runtimeSignals, parserCount: configuredParsers.length };
  };
}

module.exports = { createPipeline };
