'use strict';

const http = require('http');

// Dashboard server bootstrap extracted from app.js.
// This module owns only HTTP creation/listen/error handling. It deliberately receives
// all dashboard callbacks from app.js, so export generation and runtime snapshots stay
// close to the current application state while the server lifecycle is isolated.
function startDashboardServer({
  port,
  host = '127.0.0.1',
  requestHandler,
  openUrl,
  memoryDebug = false,
  getDebugStats = () => ({ points: 0, statsLines: 0 }),
  log = console.log,
  error = console.error
}) {
  if (typeof requestHandler !== 'function') throw new Error('startDashboardServer requires requestHandler');
  const server = http.createServer(requestHandler);

  server.listen(port, host, () => {
    const url = `http://localhost:${port}`;
    log('Memory chart window:', url);
    log('Memory data endpoint:', `${url}/api/memory`);
    log('Memory health endpoint:', `${url}/health`);
    if (typeof openUrl === 'function') openUrl(url);
  });

  server.on('error', err => {
    if (err && err.code === 'EADDRINUSE') {
      error('Cannot start memory chart window: port ' + port + ' is already in use.');
      error('Tip: an older watcher is probably still running. Run `pkill -f "node app.js"` or restart with normal cleanup enabled.');
    } else {
      error('Cannot start memory chart window:', err && err.message ? err.message : err);
    }
  });

  let debugTimer = null;
  if (memoryDebug) {
    debugTimer = setInterval(() => {
      const stats = getDebugStats() || {};
      log(`[MEMORY-SERVER] points=${stats.points || 0}, statsLines=${stats.statsLines || 0}, endpoint=http://localhost:${port}/api/memory`);
    }, 5000);
  }

  return { server, debugTimer };
}

module.exports = { startDashboardServer };
