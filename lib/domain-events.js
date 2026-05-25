'use strict';

const path = require('path');

let sequence = 0;

function nowIso() {
  return new Date().toISOString();
}

function trimLine(value) {
  return String(value || '').trim();
}

function stableHash(input) {
  const text = String(input || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function nextEventId(parsed, eventType) {
  sequence += 1;
  const seed = [parsed && parsed.fileName, parsed && parsed.timestamp, eventType, parsed && parsed.line].join('|');
  return `evt-${stableHash(seed)}-${sequence}`;
}

function getSourceFromFile(file) {
  const fileName = path.basename(file || '');
  const parent = path.basename(path.dirname(path.dirname(file || ''))) || 'Log';
  return `${parent}/${fileName || 'unknown'}`;
}

function extractLogTimestamp(line) {
  const text = String(line || '');
  const m = text.match(/\[Local\s+(\d{2})\/(\d{2})\s+(\d{2}:\d{2}:\d{2})\]/i) || text.match(/^(\d{2})\/(\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (!m) return null;
  const year = new Date().getFullYear();
  const month = Number(m[1]);
  const day = Number(m[2]);
  const iso = new Date(year, month - 1, day, ...m[3].split(':').map(Number)).toISOString();
  return iso;
}

function extractLogClockDisplay(line) {
  const text = String(line || '');
  const m = text.match(/\[Local\s+(\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})\]/i) || text.match(/^(\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : null;
}

function createRawLogLine(file, rawLine) {
  const line = trimLine(rawLine);
  if (!line) return null;
  return {
    kind: 'raw-log-line',
    file,
    fileName: path.basename(file || ''),
    source: getSourceFromFile(file),
    raw: String(rawLine || ''),
    line,
    receivedAt: nowIso()
  };
}

function createParsedLogLine(raw) {
  if (!raw) return null;
  return Object.assign({}, raw, {
    kind: 'parsed-log-line',
    timestamp: extractLogTimestamp(raw.line) || raw.receivedAt,
    logTimeDisplay: extractLogClockDisplay(raw.line),
    lower: raw.line.toLowerCase()
  });
}

function createNormalizedEvent(parsed, patch = {}) {
  const eventType = patch.type || patch.eventType || 'log.line';
  const event = Object.assign({
    id: patch.id || nextEventId(parsed, eventType),
    kind: 'normalized-domain-event',
    type: eventType,
    severity: patch.severity || 'info',
    time: parsed.timestamp || parsed.receivedAt || nowIso(),
    receivedAt: parsed.receivedAt || nowIso(),
    source: parsed.source,
    file: parsed.file,
    fileName: parsed.fileName,
    line: parsed.line,
    logTimeDisplay: parsed.logTimeDisplay || null,
    domain: eventType.split('.')[0] || 'log',
    schemaVersion: 1
  }, patch);
  event.id = event.id || nextEventId(parsed, eventType);
  return event;
}

function isNormalizedEvent(event) {
  return Boolean(event && event.kind === 'normalized-domain-event' && event.type && event.time && event.source);
}

module.exports = {
  nowIso,
  trimLine,
  stableHash,
  nextEventId,
  getSourceFromFile,
  extractLogTimestamp,
  extractLogClockDisplay,
  createRawLogLine,
  createParsedLogLine,
  createNormalizedEvent,
  isNormalizedEvent
};
