'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function isAppleDoubleFile(file) {
  return path.basename(file).startsWith('._');
}

function shouldTailFile(file) {
  if (isAppleDoubleFile(file)) return false;
  const base = path.basename(file).toLowerCase();
  // Runtime-only monitoring should follow active log files. Rotated files remain
  // visible to diagnostics, but tailing them creates unnecessary processes/noise.
  return base.endsWith('_log.txt') || base.endsWith('_log');
}

function startTailForFile({ file, tailProcesses, positions, inspectLine }) {
  const resolved = path.resolve(file);
  if (tailProcesses.has(resolved)) return false;
  if (!shouldTailFile(resolved)) return false;

  let stat;
  try { stat = fs.statSync(resolved); } catch (_) { return false; }
  if (!stat.isFile()) return false;

  positions.set(resolved, stat.size);

  const child = spawn('tail', ['-n', '0', '-F', resolved], { stdio: ['ignore', 'pipe', 'pipe'] });
  tailProcesses.set(resolved, { child, buffer: '' });
  console.log('  tail -F started:', path.basename(path.dirname(path.dirname(resolved))) + '/' + path.basename(resolved));

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    const state = tailProcesses.get(resolved);
    if (!state) return;
    state.buffer += chunk;
    const parts = state.buffer.split(/\r?\n/);
    state.buffer = parts.pop() || '';
    for (const line of parts) if (line) inspectLine(resolved, line);
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    const text = String(chunk || '').trim();
    if (!text) return;
    if (!/has appeared|has been replaced|file truncated|following new file/i.test(text)) {
      console.warn(`[tail] ${path.basename(resolved)}: ${text}`);
    }
  });

  child.on('exit', (code, signal) => {
    tailProcesses.delete(resolved);
    if (code !== 0 && signal !== 'SIGTERM') {
      console.warn(`tail stopped for ${resolved} (code=${code}, signal=${signal || 'none'}). It will be restarted on next discovery pass.`);
    }
  });
  return true;
}

function startTailForFiles({ files, tailProcesses, positions, inspectLine }) {
  let added = 0;
  for (const file of files) if (startTailForFile({ file, tailProcesses, positions, inspectLine })) added += 1;
  return added;
}

function stopTailProcesses(tailProcesses) {
  for (const { child } of tailProcesses.values()) {
    try { child.kill('SIGTERM'); } catch (_) {}
  }
}

module.exports = { isAppleDoubleFile, shouldTailFile, startTailForFile, startTailForFiles, stopTailProcesses };
