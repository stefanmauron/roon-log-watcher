'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rules = [
  {
    name: 'app entrypoint stays tiny',
    file: 'app.js',
    check(text) { return text.split(/\r?\n/).length <= 80; },
    message: 'app.js should remain a small bootstrap entry point.'
  },

  {
    name: 'app-main stays below orchestration threshold',
    file: 'lib/app-main.js',
    check(text) { return text.split(/\r?\n/).length <= 900; },
    message: 'app-main.js should stay a true orchestrator by delegating runtime domains to services.'
  },
  {
    name: 'runtime decomposition services exist',
    file: 'lib/app-main.js',
    check(text) { return /zone-state-service/.test(text) && /playback-session-service/.test(text) && /memory-runtime-service/.test(text) && /incident-lifecycle-service/.test(text); },
    message: 'zone, playback, memory and incident lifecycle logic should be delegated to focused services.'
  },

  {
    name: 'app-main avoids platform conditionals',
    file: 'lib/app-main.js',
    check(text) { return !/process\.platform/.test(text); },
    message: 'app-main.js should use the platform adapter instead of direct process.platform checks.'
  },
  {
    name: 'memory runtime service owns memory parsing and polling',
    file: 'lib/memory-runtime-service.js',
    check(text) { return /collectMemoryData/.test(text) && /extractMemorySamples/.test(text) && /startProcessMemoryPolling/.test(text); },
    message: 'memory runtime behaviour should live outside app-main.js.'
  },
  {
    name: 'incident lifecycle service owns lifecycle state',
    file: 'lib/incident-lifecycle-service.js',
    check(text) { return /recoverIncidentLifecyclesForZone/.test(text) && /getIncidentLifecycleSnapshot/.test(text); },
    message: 'incident lifecycle state should live outside app-main.js.'
  },
  {
    name: 'event pipeline remains independent from UI/dashboard',
    file: 'lib/event-pipeline.js',
    check(text) { return !/dashboard|frontend|public\/js|notification-service/i.test(text); },
    message: 'event-pipeline.js must not depend on UI, dashboard or notification concerns.'
  },
  {
    name: 'parser registry remains independent from runtime orchestration',
    file: 'lib/parsers/index.js',
    check(text) { return !/app-main|dashboard|tail|process-cleanup|notification/i.test(text); },
    message: 'parsers must only parse domain events and not orchestrate runtime behaviour.'
  },
  {
    name: 'domain events remain deterministic enough for testing',
    file: 'lib/domain-events.js',
    check(text) { return /stableHash/.test(text) && !/Math\.random/.test(text); },
    message: 'domain events should avoid random IDs so parser/correlation tests remain stable.'
  },

  {
    name: 'tail backend receives live log inspector',
    file: 'lib/app-main.js',
    check(text) { return /const inspectLine = liveLogProcessingService\.inspectLine;/.test(text) && /startTailForFiles\(\{ files, tailProcesses, positions, inspectLine \}\)/.test(text); },
    message: 'tail startup must pass the live log inspector from live-log-processing-service to log-watcher.'
  },
  {
    name: 'correlation engine is rule based',
    file: 'lib/correlation-engine.js',
    check(text) { return /defaultRules/.test(text) && /ruleErrors/.test(text); },
    message: 'correlation engine should expose rule-based extension points and isolate rule failures.'
  }
];

let failed = false;
for (const rule of rules) {
  const filePath = path.join(root, rule.file);
  const text = fs.readFileSync(filePath, 'utf8');
  if (!rule.check(text)) {
    failed = true;
    console.error(`✗ ${rule.name}: ${rule.message}`);
  } else {
    console.log(`✓ ${rule.name}`);
  }
}

if (failed) process.exit(1);
