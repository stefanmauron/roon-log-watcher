'use strict';

const fs = require('fs');
const path = require('path');

function send(res, status, contentType, body, extraHeaders = {}) {
  res.writeHead(status, Object.assign({ 'Content-Type': contentType, 'Cache-Control': 'no-store' }, extraHeaders));
  res.end(body);
}

function sendJson(res, value, pretty = false) {
  send(res, 200, 'application/json; charset=utf-8', JSON.stringify(value, null, pretty ? 2 : 0), {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*'
  });
}

function serveAsset({ req, res, rootDir }) {
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  const fileName = pathname.slice(1);
  const filePath = path.join(rootDir, 'public', fileName);
  const contentType = fileName.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8';
  fs.readFile(filePath, 'utf8', (err, body) => {
    if (err) return send(res, 404, 'text/plain; charset=utf-8', 'Asset not found');
    send(res, 200, contentType, body);
  });
}

function createDashboardRequestHandler(deps) {
  const {
    rootDir,
    dashboardHtml,
    releaseInfo,
    appVersion,
    memoryWindowPort,
    memoryHistoryMaxPoints,
    getMemorySnapshot,
    exportMemoryCsv,
    exportMemoryJson,
    exportLogsText,
    exportDiagnosticSummary,
    getHealthSnapshot,
    getHealthText
  } = deps;

  return function dashboardRequestHandler(req, res) {
    let pathname;
    try { pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname; }
    catch (_) { pathname = req.url || '/'; }

    if (pathname === '/' || pathname === '/index.html') {
      return send(res, 200, 'text/html; charset=utf-8', dashboardHtml.getMemoryWindowHtml({ releaseInfo, APP_VERSION: appVersion, memoryWindowPort, memoryHistoryMaxPoints }));
    }

    if (pathname === '/style.css' || pathname === '/frontend.js' || pathname.startsWith('/js/')) {
      return serveAsset({ req, res, rootDir });
    }

    if (pathname === '/data' || pathname === '/api/memory' || pathname === '/debug') {
      return sendJson(res, getMemorySnapshot());
    }

    if (pathname === '/api/export/memory.csv') {
      return send(res, 200, 'text/csv; charset=utf-8', exportMemoryCsv(), { 'Content-Disposition': 'attachment; filename="roon-memory.csv"' });
    }

    if (pathname === '/api/export/memory.json') {
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(exportMemoryJson(), null, 2), { 'Content-Disposition': 'attachment; filename="roon-memory.json"' });
    }

    if (pathname === '/api/export/logs.txt') {
      return send(res, 200, 'text/plain; charset=utf-8', exportLogsText(), { 'Content-Disposition': 'attachment; filename="roon-live-logs.txt"' });
    }

    if (pathname === '/api/export/diagnostic-summary.md') {
      return send(res, 200, 'text/markdown; charset=utf-8', exportDiagnosticSummary(), { 'Content-Disposition': 'attachment; filename="roon-diagnostic-summary.md"' });
    }

    if (pathname === '/api/health') {
      return sendJson(res, getHealthSnapshot(), true);
    }

    if (pathname === '/health') {
      return send(res, 200, 'text/plain; charset=utf-8', getHealthText());
    }

    // Backward-compatible fallback: if a browser/proxy appends a query or unusual suffix, still serve data.
    if (String(req.url || '').startsWith('/data')) {
      return sendJson(res, getMemorySnapshot());
    }

    return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  };
}

module.exports = { createDashboardRequestHandler, sendJson };
