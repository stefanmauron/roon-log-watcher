'use strict';

const { sourceFromFile } = require('./incident-detector');

// Timeline detection is deliberately separate from incidents: timeline entries
// explain what happened, while incidents decide whether operator attention is
// needed. This keeps noisy playback transitions out of the health logic.
function detectTimelineEvent(ctx) {
  const line = String(ctx.line || '');
  const lower = line.toLowerCase();
  const source = sourceFromFile(ctx.file || '');
  const msg = line.slice(0, 320);
  const addTimelineEvent = ctx.addTimelineEvent;
  if (!addTimelineEvent) return;

  if (ctx.isBenignPlaybackRaatDisconnect(line) || ctx.isNormalPlaybackTransition(line) || ctx.isBenignHttpStatus(line)) return;

  if (ctx.matches && ctx.matches.length) {
    for (const m of ctx.matches) {
      addTimelineEvent({ type: 'log-alert', severity: (m.severity || 'warning').toLowerCase(), title: m.name || 'Log alert', message: msg, source, dedupeMs: 30000 });
    }
  }

  if (/raat/.test(lower) && /(disconnect|disconnected|lost|drop|dropped|reconnect|reconnected|timeout|timed out)/.test(lower)) {
    addTimelineEvent({ type: 'raat', severity: /(disconnect|lost|drop|timeout)/.test(lower) ? 'warning' : 'info', title: /(disconnect|lost|drop|timeout)/.test(lower) ? 'Endpoint transport needs attention' : 'Endpoint negotiation completed successfully', message: msg, source, dedupeMs: 20000 });
  }
  if (/(audio device|device).*?(lost|removed|disconnect|unavailable)|zone.*?(lost|disconnect|reconnect)/.test(lower)) {
    addTimelineEvent({ type: 'audio-zone', severity: 'warning', title: 'Audio zone state change needs attention', message: msg, source, dedupeMs: 20000 });
  }
  if (/(exception|crash|fatal|stacktrace|segmentation fault)/.test(lower)) {
    addTimelineEvent({ type: 'exception', severity: 'critical', title: 'Exception / crash signal', message: msg, source, dedupeMs: 60000 });
  }
  if (ctx.isCriticalDatabaseProblem(line) || ctx.isSlowDatabaseFlush(line)) {
    addTimelineEvent({ type: 'database', severity: ctx.isCriticalDatabaseProblem(line) ? 'critical' : 'warning', title: ctx.isCriticalDatabaseProblem(line) ? 'Database error requires attention' : 'Temporary database flush delay observed', message: msg, source, dedupeMs: 30000 });
  }
  if (ctx.isBenignStreamingCacheActivity(line)) {
    addTimelineEvent({ type: 'network-content', severity: 'info', title: 'Normal playback transition detected', message: msg, source, dedupeMs: 120000 });
  } else if (ctx.isRealStreamingMetadataProblem(line)) {
    addTimelineEvent({ type: 'network-content', severity: 'info', title: 'Temporary metadata delay detected without playback impact', message: msg, source, dedupeMs: 60000 });
  }
  if (/(roonserver|roon).*?(starting|started|startup|shutting down|shutdown|restart|restarted)/.test(lower)) {
    addTimelineEvent({ type: 'server-lifecycle', severity: /shutting|shutdown|restart/.test(lower) ? 'warning' : 'info', title: 'Server lifecycle', message: msg, source, dedupeMs: 60000 });
  }
}

module.exports = { detectTimelineEvent };
