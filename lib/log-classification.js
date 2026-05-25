'use strict';

// Backend log classification helpers extracted from app.js in v8.60.
// These functions decide whether a raw Roon log line is operationally relevant,
// benign runtime noise, or a likely incident signal. Keeping them in one module
// makes the alert/timeline/incident pipeline easier to review and keeps the same
// rules available to multiple detectors without duplicating regular expressions.

function normalise(line) {
  return String(line || '').toLowerCase();
}

function isBenignPlaybackRaatDisconnect(line) {
  const lower = normalise(line);
  // Normal playback transitions such as skipping to the next track can log this line.
  // It does not indicate RAAT endpoint instability and should not affect alerts, timeline or health.
  return /debug:\s*\[raat\/tcpaudiosource\]\s*disconnecting\b/.test(lower);
}

function isNormalPlaybackTransition(line) {
  const lower = normalise(line);
  return /\[(zoneplayer|zoneplayer\/raat|raatclient)\].*?(buffering|ready|playing|prepared)/.test(lower) ||
         /state changed:.*?(prepared|buffering|ready|playing)/.test(lower) ||
         /\[zone .*?\] next\b/.test(lower) ||
         /_advance \(track\)/.test(lower) ||
         /all streams were disposed/.test(lower) ||
         /signalpath quality|--\[ signalpath \]/.test(lower) ||
         /\[prebuffer\] ready/.test(lower) ||
         /\[zone .*?\] onplayfeedback (playing|stopped)/.test(lower) ||
         /\[.*?\] \[.*?\] \[100% buf\]/.test(lower);
}

function isBenignHttpStatus(line) {
  const lower = normalise(line);
  // Successful and cache/status responses during normal browsing/playback should not affect health.
  return /\[easyhttp\].*returned after .*status code:\s*(200|201|204|304)\b/.test(lower);
}

function isRemoteAccessOnlyProblem(line) {
  const lower = normalise(line);
  return /\[mobile\].*remoteconnectivity|upnperror|multinat|natpmp|no upnp routers|ipv4_connectivity.*networkerror/.test(lower);
}

function isBenignStreamingCacheActivity(line) {
  const text = String(line || '');
  // Roon frequently logs FTMSI/FileCache accessTimeOut or bandwidth reallocations during normal
  // track changes, prefetching and cache housekeeping. These are useful log facts, but a single
  // occurrence is not a service degradation.
  if (/ftmsi-b/i.test(text) && /(filecache|accesstimeout|allocated bw changed|download status|bw limit)/i.test(text)) return true;
  if (/download status:.*accesstimeout:true/i.test(text)) return true;
  return false;
}

function isRealStreamingMetadataProblem(line) {
  const text = String(line || '');
  const lower = text.toLowerCase();
  if (isBenignStreamingCacheActivity(text) || isBenignHttpStatus(text) || isNormalPlaybackTransition(text)) return false;
  // Only treat real failures as streaming/metadata problems. Common cache transitions,
  // 304 not modified, 200/201 successes, prebuffering and normal track changes are benign.
  return /(qobuz|tidal|metadata|metadatasvc|download|streaming).*?(timeout|timed out|fail|failed|networkerror|unreachable|refused|reset)/i.test(text) ||
         /\[easyhttp\].*status code:\s*(5[0-9]{2}|408|429)\b/.test(lower);
}

function isCriticalDatabaseProblem(line) {
  const lower = normalise(line);
  return /(database|sqlite|leveldb).*?(corrupt|malformed|locked|repair|recover|exception|fatal)/.test(lower);
}

function isSlowDatabaseFlush(line) {
  const lower = normalise(line);
  return /\[dbperf\].*flush.*\s([5-9][0-9]{3}|[1-9][0-9]{4,})\s*ms/.test(lower);
}

function isBenignForAlerting(line) {
  return isBenignPlaybackRaatDisconnect(line) ||
    isNormalPlaybackTransition(line) ||
    isBenignHttpStatus(line) ||
    isBenignStreamingCacheActivity(line);
}

module.exports = {
  isBenignPlaybackRaatDisconnect,
  isNormalPlaybackTransition,
  isBenignHttpStatus,
  isRemoteAccessOnlyProblem,
  isBenignStreamingCacheActivity,
  isRealStreamingMetadataProblem,
  isCriticalDatabaseProblem,
  isSlowDatabaseFlush,
  isBenignForAlerting
};
