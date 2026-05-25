'use strict';

const path = require('path');

function sourceFromFile(file) {
  const fileName = path.basename(file);
  const parent = path.basename(path.dirname(path.dirname(file))) || 'Log';
  return `${parent}/${fileName}`;
}

// High-level incident rules. The module does not mutate dashboard state directly;
// app.js provides addIncident/rememberIncidentSignal callbacks so state ownership
// remains centralized while the classification rules are easier to review.
function detectIncidentFromLine(ctx) {
  const line = String(ctx.line || '');
  const lower = line.toLowerCase();
  const source = sourceFromFile(ctx.file || '');
  const msg = line.slice(0, 360);
  const remember = ctx.rememberIncidentSignal;
  const addIncident = ctx.addIncident;
  if (!remember || !addIncident) return;

  if (ctx.isBenignPlaybackRaatDisconnect(line) || ctx.isNormalPlaybackTransition(line) || ctx.isBenignHttpStatus(line)) return;

  if (/raat/.test(lower) && /(disconnect|disconnected|lost|drop|dropped|timeout|timed out)/.test(lower)) {
    const count = remember('raat-instability', source, 5 * 60 * 1000);
    if (count >= 3) addIncident({
      type: 'raat-instability', severity: count >= 8 ? 'critical' : 'warning', confidence: 'high',
      title: 'Endpoint transport instability detected', occurrences: count,
      message: `${count} RAAT transport disconnect/loss/timeout signals were observed in the last 5 minutes.`,
      likelyCause: 'Likely endpoint transport, network, Wi‑Fi, switch, sleep/wake or RAATServer instability.',
      recommendation: 'Check the affected endpoint and network path if playback was interrupted or the same endpoint repeats this pattern.',
      source, dedupeMs: 2 * 60 * 1000
    });
  }

  if (/(audio device|device).*?(lost|removed|disconnect|unavailable)|zone.*?(lost|disconnect)/.test(lower)) {
    const count = remember('audio-zone-instability', source, 5 * 60 * 1000);
    if (count >= 2) addIncident({
      type: 'audio-zone-instability', severity: 'warning', confidence: 'medium',
      title: 'Audio zone stability issue detected', occurrences: count,
      message: `${count} audio device or zone loss signals were observed in the last 5 minutes.`,
      likelyCause: 'Likely endpoint reconnect, device sleep/wake, driver issue or unstable network path.',
      recommendation: 'Check the endpoint power/network state if the zone disappears repeatedly or playback is affected.',
      source, dedupeMs: 2 * 60 * 1000
    });
  }

  if (ctx.isBenignStreamingCacheActivity(line)) {
    return;
  } else if (ctx.isRealStreamingMetadataProblem(line)) {
    const count = remember('streaming-metadata-issues', source, 10 * 60 * 1000);
    if (count >= 10) addIncident({
      type: 'streaming-metadata-issues', severity: 'warning', confidence: 'medium',
      title: 'Repeated metadata or streaming delay detected', occurrences: count,
      message: `${count} metadata or streaming delay signals were observed in the last 10 minutes. No playback impact is assumed unless playback also stops, buffers repeatedly or the endpoint fails to recover.`,
      likelyCause: 'Likely temporary external service latency, metadata lookup delay, cache refresh or short internet fluctuation.',
      recommendation: 'Treat as informational unless it correlates with audible dropouts, repeated buffering or failed playback starts.',
      source, dedupeMs: 5 * 60 * 1000
    });
  }

  if (ctx.isRemoteAccessOnlyProblem(line)) {
    const count = remember('remote-access-connectivity', source, 60 * 60 * 1000);
    if (count >= 3) addIncident({
      type: 'remote-access-connectivity', severity: 'info', confidence: 'medium',
      title: 'Remote access connectivity notice', occurrences: count,
      message: `${count} remote-access connectivity notices in the last hour.`,
      likelyCause: 'Likely Roon ARC / remote access NAT, UPnP or IPv4 reachability issue. This does not necessarily affect local playback.',
      recommendation: 'Only investigate if Roon ARC or remote access is affected. Local playback health should remain green.',
      source, dedupeMs: 15 * 60 * 1000
    });
  }

  if (/(exception|crash|fatal|stacktrace|segmentation fault)/.test(lower)) {
    addIncident({
      type: 'exception-crash', severity: 'critical', confidence: 'high', title: 'Exception or crash signal', occurrences: 1,
      message: msg,
      likelyCause: 'A runtime exception or crash-like signal was logged.',
      recommendation: 'Export the incident package and inspect the surrounding logs before/after this line.',
      source, dedupeMs: 5 * 60 * 1000
    });
  }

  if (ctx.isCriticalDatabaseProblem(line) || ctx.isSlowDatabaseFlush(line)) {
    const count = remember('database-stress', source, 10 * 60 * 1000);
    if (ctx.isCriticalDatabaseProblem(line) || count >= 3) addIncident({
      type: 'database-stress', severity: ctx.isCriticalDatabaseProblem(line) ? 'critical' : 'warning', confidence: 'medium',
      title: 'Database / library stress', occurrences: count,
      message: msg,
      likelyCause: 'Possible database corruption/error or unusually slow database flush. Normal dbperf flushes are ignored.',
      recommendation: 'Correlate with memory and GC events; if repeated, check storage health and Roon database activity.',
      source, dedupeMs: 3 * 60 * 1000
    });
  }
}

module.exports = { detectIncidentFromLine, sourceFromFile };
