'use strict';

function normalizeZoneName(value) {
  return String(value || 'Unknown zone').replace(/^zone\s+/i, '').trim() || 'Unknown zone';
}

function cleanEndpointDisplayName(value) {
  let z = normalizeZoneName(value);
  z = z.replace(/\s*@\s*\d{1,3}(?:\.\d{1,3}){3}:\d+\s*$/i, '').trim();
  return z || 'Unknown zone';
}

function isInternalOrUnknownZone(value) {
  const z = normalizeZoneName(value).toLowerCase();
  if (!z || z === 'unknown zone' || z === 'unknown' || z === 'null' || z === 'undefined') return true;
  if (z === 'audio/env' || z === 'audio' || z === 'env') return true;
  if (z.includes('audio/env')) return true;
  if (z.includes('zoneplayer ->')) return true;
  if (/^(zoneplayer|stream|endpoint|raat|raatclient|tcpaudiosource|transport|broker|library|metadata|easyhttp|dbperf)$/.test(z)) return true;
  return false;
}

function isUserFacingZone(value) {
  return !isInternalOrUnknownZone(value);
}

function extractZoneFromLine(line) {
  const text = String(line || '');
  let m = text.match(/\[zone\s+([^\]]+)\]/i);
  if (m) return cleanEndpointDisplayName(m[1]);
  m = text.match(/\[([^\]]+)\]\s*\[zoneplayer(?:\/raat)?\]/i);
  if (m) return cleanEndpointDisplayName(m[1]);
  m = text.match(/\[([^\]]+)\]\s*\[(?:Enhanced|Lossless|High Quality|Low Quality|Bit-Perfect|DSP)/i);
  if (m) return cleanEndpointDisplayName(m[1]);
  return 'Unknown zone';
}

module.exports = { normalizeZoneName, cleanEndpointDisplayName, isInternalOrUnknownZone, isUserFacingZone, extractZoneFromLine };
