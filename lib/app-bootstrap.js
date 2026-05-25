'use strict';

// App bootstrap helpers keep startup/banner concerns out of app.js.
// They deliberately avoid knowing anything about log parsing or dashboard state.
function createStartupLogger(output = console.log) {
  let count = 0;
  return function startup(message) {
    count += 1;
    output(`[startup ${String(count).padStart(2, '0')}] ${message}`);
  };
}

function createShutdownRegistry() {
  const handlers = [];
  return {
    add(handler) {
      if (typeof handler === 'function') handlers.push(handler);
    },
    run() {
      for (const handler of handlers) {
        try { handler(); } catch (_) {}
      }
    }
  };
}

function getRuntimeBanner({ version, port, memoryWindowEnabled }) {
  const mode = memoryWindowEnabled ? `dashboard http://localhost:${port}` : 'terminal only';
  return `Roon Log Watcher v${version} - ${mode}`;
}

module.exports = {
  createStartupLogger,
  createShutdownRegistry,
  getRuntimeBanner
};
