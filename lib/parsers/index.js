'use strict';

const domainEvents = require('../domain-events');
const memoryParser = require('./roon-memory-parser');
const playbackParser = require('./playback-parser');
const raatParser = require('./raat-parser');
const serverLifecycleParser = require('./server-lifecycle-parser');

const defaultParsers = [memoryParser, playbackParser, raatParser, serverLifecycleParser];

function createParserError(parsedLogLine, err, parserName = 'unknown-parser') {
  return domainEvents.createNormalizedEvent(parsedLogLine, {
    domain: 'parser',
    type: 'parser.error',
    severity: 'warning',
    title: 'Parser error',
    message: err && err.message ? err.message : String(err || 'Unknown parser error'),
    parserName
  });
}

function normalizeParserOutput(parsedLogLine, output, parserName) {
  if (!Array.isArray(output)) return [];
  return output.filter(Boolean).map(event => {
    if (domainEvents.isNormalizedEvent(event)) return event;
    return domainEvents.createNormalizedEvent(parsedLogLine, Object.assign({ parserName }, event));
  });
}

function parseDomainEvents(parsedLogLine, parsers = defaultParsers) {
  const events = [];
  for (const parser of parsers) {
    if (!parser || typeof parser.parse !== 'function') continue;
    const parserName = parser.name || parser.parserName || 'anonymous-parser';
    try {
      events.push(...normalizeParserOutput(parsedLogLine, parser.parse(parsedLogLine), parserName));
    } catch (err) {
      events.push(createParserError(parsedLogLine, err, parserName));
    }
  }
  return events;
}

function listParsers(parsers = defaultParsers) {
  return parsers.map(parser => ({
    name: parser.name || parser.parserName || 'anonymous-parser',
    domains: parser.domains || [],
    version: parser.version || 1
  }));
}

module.exports = { defaultParsers, parseDomainEvents, listParsers, createParserError };
