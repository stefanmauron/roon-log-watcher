'use strict';

// Central registry for documented startup variants. Keep this list synchronized
// with package.json scripts and docs/startup-options.md.
const STARTUP_COMMANDS = [
  ['start', 'node app.js --all --interval 0.25 --memory-window', 'Default dashboard start with all live log lines and the memory window.'],
  ['init', 'node app.js --write-default-config', 'Create config.json from defaults.'],
  ['diagnose', 'node app.js --diagnose', 'Print log discovery diagnostics and exit.'],
  ['diagnose:linux', 'node app.js --diagnose', 'Same diagnostics command, kept as a Linux-friendly alias.'],
  ['start:all', 'node app.js --all', 'Monitor all configured/new log lines with the configured polling interval.'],
  ['start:fast', 'node app.js --interval 1', 'Use one-second polling with the default log selection.'],
  ['start:all-fast', 'node app.js --all --interval 0.25', 'Show all new log lines with fast near-real-time polling.'],
  ['start:memory', 'node app.js --memory-window --interval 1', 'Open the memory dashboard window with one-second polling.'],
  ['start:all-memory', 'node app.js --all --interval 0.25 --memory-window', 'Recommended full monitoring mode with dashboard and fast all-log polling.'],
  ['start:memory-debug', 'node app.js --all --interval 0.25 --memory-window --memory-debug', 'Full monitoring with additional memory debug output.'],
  ['start:no-cleanup', 'node app.js --no-cleanup', 'Start without cleaning older watcher processes.'],
  ['start:dashboard', 'node app.js --all --interval 0.25 --memory-window', 'Alias for the recommended dashboard mode.'],
  ['memory:test', 'node app.js --memory-test-file', 'Run the memory parser test helper. Pass a file path after --memory-test-file when needed.'],
  ['test', 'node --test && npm run architecture:check', 'Run unit/regression tests and architecture fitness checks.'],
  ['architecture:check', 'node scripts/architecture-check.js', 'Run architecture guardrails only.']
];

function getStartupCommands() {
  return STARTUP_COMMANDS.map(([name, command, description]) => ({ name, command, description }));
}

function getReadyConsoleLines() {
  return [
    'Ready. To test, trigger Play/Pause, skip a track, or switch zones in Roon.',
    'Recommended full dashboard mode: npm run start:all-memory',
    'Show all new log lines with fast polling: npm run start:all-fast',
    'Show memory chart window: npm run start:memory',
    'Or directly: node app.js --all --interval 1 --memory-window',
    'Diagnostics: npm run diagnose',
    'All startup options: docs/startup-options.md',
    'Stop: CTRL+C'
  ];
}

module.exports = { STARTUP_COMMANDS, getStartupCommands, getReadyConsoleLines };
