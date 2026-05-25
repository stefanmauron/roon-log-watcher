'use strict';

const { createNormalizedEvent } = require('../domain-events');
const { extractZoneFromLine, isUserFacingZone } = require('./zone-utils');

function extractTrackFromLine(line) {
  const text = String(line || '');
  const m = text.match(/\[(PLAYING|LOADING|STOPPED)\s+@[^\]]*\]\s+(.+)$/i);
  if (!m) return null;
  const full = m[2].trim();
  const parts = full.split(' - ');
  if (parts.length >= 2) return { title: parts.slice(0, -1).join(' - ').trim(), artist: parts.slice(-1)[0].trim(), full };
  return { title: full, artist: '', full };
}

function extractSignalFromLine(line) {
  const text = String(line || '');
  const m = text.match(/\[([^\]]*?)\s*,\s*([^\]]+?=>[^\]]+?)\]\s*\[[0-9]+%\s+buf\]/i);
  if (m) return { quality: m[1].trim(), format: m[2].trim() };
  const q = text.match(/SignalPath Quality\s*=\s*(.+)$/i);
  if (q) return { quality: q[1].trim(), format: '' };
  return null;
}

function parse(parsed) {
  const text = parsed.line || '';
  const lower = text.toLowerCase();
  const isPlaybackRelated = /starting playback|\[playing\s+@|\[loading\s+@|\[stopped\s+@|startstream|state changed:.*(buffering|ready|playing|prepared)|onplayfeedback\s+(playing|stopped)|playing:\s*https?:|queueing:\s*https?:|reportstreaming(start|end)|\[raat\/tcpaudiosource\]|_advance \(track\)|\[zone .*?\] next\b|all streams were disposed|signalpath quality/i.test(text);
  if (!isPlaybackRelated) return [];
  const zone = extractZoneFromLine(text);
  if (!isUserFacingZone(zone)) return [];
  const events = [];
  const base = { zone, domain: 'playback' };
  events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.activity.detected', title: 'Playback activity detected' })));
  const track = extractTrackFromLine(text);
  if (track) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.track.detected', title: 'Track identified', track })));
  const signal = extractSignalFromLine(text);
  if (signal) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.signal.detected', title: 'Signal path detected', signal })));
  if (/starting playback/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.starting', title: 'Playback starting' })));
  if (/startstream/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.stream.started', title: 'RAAT stream started' })));
  if (/state changed:.*prepared\s*=>\s*buffering/i.test(text) || /\{"status":"Buffering"\}/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.buffering', title: 'Playback buffering' })));
  if (/state changed:.*buffering\s*=>\s*ready/i.test(text) || /\{"status":"Ready"\}/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.ready', title: 'Playback ready' })));
  if (/state changed:.*ready\s*=>\s*playing/i.test(text) || /\{"status":"Playing"\}/i.test(text) || /onplayfeedback\s+playing/i.test(text) || /\[playing\s+@\s*0:0/i.test(lower)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.playing', title: 'Playback playing' })));
  if (/onplayfeedback\s+stopped|\[stopped\s+@|all streams were disposed/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.stopped', title: 'Playback stopped' })));
  if (/\[zone .*?\] next\b|_advance \(track\)/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.track.advanced', title: 'Track advanced' })));
  if (/qobuz/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.source.detected', title: 'Qobuz source detected', service: 'Qobuz' })));
  if (/tidal/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.source.detected', title: 'TIDAL source detected', service: 'TIDAL' })));
  if (/(timeout|timed out|failed|networkerror|unreachable|lost|drop|dropped)/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'playback.warning.detected', severity: 'warning', title: 'Playback warning detected' })));
  return events;
}

module.exports = { name: 'playback-parser', domains: ['playback'], version: 1, parse, extractTrackFromLine, extractSignalFromLine };
