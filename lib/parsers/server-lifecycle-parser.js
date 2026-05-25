'use strict';

const { createNormalizedEvent } = require('../domain-events');

function parse(parsed) {
  const text = parsed.line || '';
  const events = [];
  if (/starting roon|roonserver.*start|server startup|starting.*server/i.test(text)) events.push(createNormalizedEvent(parsed, { domain: 'server', type: 'server.started', title: 'Roon Server startup detected' }));
  if (/shutdown|stopping roon|server stopped|exiting/i.test(text)) events.push(createNormalizedEvent(parsed, { domain: 'server', type: 'server.stopped', severity: 'warning', title: 'Roon Server shutdown detected' }));
  if (/exception|fatal|crash|panic|segmentation fault/i.test(text)) events.push(createNormalizedEvent(parsed, { domain: 'server', type: 'server.exception', severity: 'critical', title: 'Server exception detected' }));
  return events;
}

module.exports = { name: 'server-lifecycle-parser', domains: ['server'], version: 1, parse };
