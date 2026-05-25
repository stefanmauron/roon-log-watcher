'use strict';

/**
 * Small shared helpers used across the watcher runtime.
 *
 * These helpers are intentionally kept dependency-free because they are used during
 * early startup, terminal output, CSV export and dashboard data shaping. Keeping them
 * here avoids scattering tiny utility implementations across app.js.
 */
function sleepMs(ms) {
  try {
    // Synchronous sleep without external dependencies; keeps startup sequencing deterministic.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, Number(ms) || 0));
  } catch (_) {
    const end = Date.now() + Math.max(0, Number(ms) || 0);
    while (Date.now() < end) {}
  }
}

function trimLine(line) {
  return String(line).replace(/\s+/g, ' ').trim();
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return '"' + text.replace(/"/g, '""') + '"';
}

function averageNumber(arr) {
  if (!arr || !arr.length) return null;
  return arr.reduce((sum, v) => sum + Number(v || 0), 0) / arr.length;
}

function pushLimited(arr, value, max) {
  arr.push(value);
  if (arr.length > max) arr.splice(0, arr.length - max);
}

module.exports = {
  sleepMs,
  trimLine,
  csvCell,
  averageNumber,
  pushLimited
};
