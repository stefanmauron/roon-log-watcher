'use strict';

function createSignalFactory() {
  let sequence = 0;
  return function createSignal(type, event, patch = {}) {
    sequence += 1;
    return Object.assign({
      id: 'signal-' + sequence,
      kind: 'runtime-signal',
      type,
      severity: event.severity || 'info',
      time: event.time,
      receivedAt: event.receivedAt,
      source: event.source,
      evidenceEventId: event.id
    }, patch);
  };
}

function memoryObservedRule(event, context) {
  if (event.type !== 'memory.sample.detected') return [];
  const value = Number(event.valueMB || 0);
  if (!(value > 0)) return [];
  if (!['Physical Memory', 'Managed Memory', 'Unmanaged Memory'].includes(event.metric)) return [];
  return [context.createSignal('runtime.memory.observed', event, {
    severity: 'info',
    message: `${event.metric}: ${Math.round(value)} MB`,
    metric: event.metric,
    valueMB: value
  })];
}

function playbackRiskRule(event, context) {
  if (event.type !== 'raat.disconnected' && event.type !== 'playback.warning.detected') return [];
  const nearbyMemory = context.recentEvents.filter(e => e.type === 'memory.sample.detected').slice(-5);
  return [context.createSignal('runtime.playback-risk.detected', event, {
    severity: event.severity || 'warning',
    zone: event.zone || null,
    message: event.title || event.type,
    nearbyMemorySamples: nearbyMemory.map(e => ({ metric: e.metric, valueMB: e.valueMB, time: e.time })).slice(-3)
  })];
}

const defaultRules = [memoryObservedRule, playbackRiskRule];

function createCorrelationEngine({ maxSignals = 500, recentWindowMs = 4 * 60 * 1000, rules = defaultRules } = {}) {
  const recentEvents = [];
  const createSignal = createSignalFactory();
  const ruleErrors = [];

  function remember(event) {
    if (!event) return;
    recentEvents.push(event);
    const cutoff = Date.now() - Math.max(1000, recentWindowMs);
    while (recentEvents.length > maxSignals || (recentEvents[0] && new Date(recentEvents[0].receivedAt || recentEvents[0].time).getTime() < cutoff)) {
      recentEvents.shift();
    }
  }

  function inspect(event) {
    if (!event || event.kind !== 'normalized-domain-event') return [];
    const signals = [];
    const context = { recentEvents: recentEvents.slice(), createSignal };
    for (const rule of rules) {
      if (typeof rule !== 'function') continue;
      try {
        const produced = rule(event, context) || [];
        for (const signal of produced) if (signal) signals.push(signal);
      } catch (err) {
        ruleErrors.push({ rule: rule.name || 'anonymous-rule', message: err.message, time: new Date().toISOString(), eventType: event.type });
        while (ruleErrors.length > 50) ruleErrors.shift();
      }
    }
    return signals;
  }

  function process(event) {
    const signals = inspect(event);
    remember(event);
    return signals;
  }

  function snapshot() {
    return { recentEvents: recentEvents.slice(), maxSignals, recentWindowMs, ruleCount: rules.length, ruleErrors: ruleErrors.slice() };
  }

  return { process, snapshot, inspect };
}

module.exports = { createCorrelationEngine, defaultRules, memoryObservedRule, playbackRiskRule };
