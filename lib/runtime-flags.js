'use strict';

/**
 * Runtime behaviour and incident severity helpers.
 *
 * High-level algorithm:
 * 1. Trust explicit critical/fatal/panic labels first.
 * 2. Promote known risk patterns such as crashes, database failures and severe RAAT
 *    or endpoint disconnects.
 * 3. Promote GC or memory pressure only when the text also contains a pressure-like
 *    signal, so harmless lifecycle lines do not become warnings.
 * 4. Fall back to info for normal lifecycle and diagnostic events.
 */
function normalizeSeverity(rawSeverity, event) {
  const raw = String(rawSeverity || '').toLowerCase();
  const type = String((event && (event.type || event.title)) || '').toLowerCase();
  const text = [
    event && event.title,
    event && event.message,
    event && event.likelyCause,
    event && event.recommendation,
    event && event.source
  ].filter(Boolean).join(' ').toLowerCase();
  const combined = type + ' ' + text;

  if (/critical|fatal|panic/.test(raw)) return 'critical';
  if (/warn|degraded/.test(raw)) return 'warning';
  if (/exception|crash|uncaught|stacktrace|segmentation|fatal/.test(combined)) return 'critical';
  if (/database/.test(combined) && /corrupt|error|failed|exception/.test(combined)) return 'critical';
  if (/raat|endpoint|transport|audio-zone|device/.test(combined) && /lost|disconnect|timeout|drop|unavailable|failed/.test(combined)) return 'warning';
  if (/gc/.test(combined) && (/pressure|pause/.test(combined)) && /[1-9][0-9]{3,}\s*ms|1[0-9](?:\.[0-9]+)?\s*%|[2-9][0-9](?:\.[0-9]+)?\s*%/.test(combined)) return 'warning';
  if (/memory/.test(combined) && /high|growth|increase|leak|pressure/.test(combined)) return 'warning';

  return 'info';
}

module.exports = {
  normalizeSeverity
};
