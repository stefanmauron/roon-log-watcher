'use strict';

const { createNormalizedEvent } = require('../domain-events');
const { extractZoneFromLine, isUserFacingZone } = require('./zone-utils');

function parse(parsed) {
  const text = parsed.line || '';
  if (!/raat|tcpaudiosource|transport lost|device lost|device disappeared|disconnect|reconnect/i.test(text)) return [];
  const zone = extractZoneFromLine(text);
  const base = { domain: 'raat', zone: isUserFacingZone(zone) ? zone : null };
  const events = [];
  if (/\[raat\/tcpaudiosource\]\s*connected/i.test(text) || /reconnect/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'raat.connected', title: 'RAAT connected' })));
  if (/\[raat\/tcpaudiosource\]\s*disconnecting|transport lost|device lost|device disappeared|raat.*disconnect/i.test(text)) events.push(createNormalizedEvent(parsed, Object.assign({}, base, { type: 'raat.disconnected', severity: 'warning', title: 'RAAT disconnected' })));
  return events;
}

module.exports = { name: 'raat-parser', domains: ['raat'], version: 1, parse };
