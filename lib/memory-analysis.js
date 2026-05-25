'use strict';

/**
 * Memory analysis helpers.
 *
 * app.js still owns the live state and chart snapshots in this release, but pure
 * conversion logic lives here now. This is the first safe extraction step before
 * moving the larger Managed / Physical / Unmanaged Memory, GC Pressure and trend
 * calculations into this module.
 */
function toMB(value, unit) {
  const u = String(unit).toLowerCase();
  if (u === 'kb' || u === 'kib') return value / 1024;
  if (u === 'gb' || u === 'gib') return value * 1024;
  return value;
}

module.exports = {
  toMB
};
