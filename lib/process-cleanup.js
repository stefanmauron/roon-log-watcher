'use strict';

const { execFileSync } = require('child_process');
const sharedUtils = require('./shared-utils');

// Process cleanup is intentionally isolated from app.js because it touches host
// processes. The matching rules are conservative: only watcher-owned node app.js
// sessions, the configured memory-window port and tail -F commands matching Roon
// log paths are targeted.
function cleanupOldWatcherProcesses({ port, startup = console.log, currentPid = process.pid } = {}) {
  startup('Cleaning up previous watcher sessions...');
  const killed = [];

  function collectCandidates() {
    const candidates = new Map();

    for (const pid of getPidsListeningOnPort(port)) {
      if (pid === currentPid) continue;
      const cmd = getProcessCommand(pid);
      if (isLikelyOldWatcherCommand(cmd)) {
        candidates.set(pid, { pid, reason: 'old memory webserver on port ' + port, command: cmd });
      } else {
        startup(`Port ${port} is used by PID ${pid}, but it does not look like this watcher. Leaving it untouched: ${cmd || '(unknown command)'}`);
      }
    }

    for (const proc of listProcesses()) {
      if (proc.pid === currentPid) continue;
      if (isLikelyOldWatcherCommand(proc.command)) {
        candidates.set(proc.pid, { pid: proc.pid, reason: 'old roon-log-watcher node process', command: proc.command });
      }
      if (isLikelyWatcherTailCommand(proc.command)) {
        candidates.set(proc.pid, { pid: proc.pid, reason: 'orphaned watcher tail -F process', command: proc.command });
      }
    }

    return [...candidates.values()];
  }

  for (const candidate of collectCandidates()) {
    if (terminateProcess(candidate.pid, candidate.reason, candidate.command, 'SIGTERM', startup)) killed.push(candidate.pid);
  }

  if (killed.length > 0) sharedUtils.sleepMs(700);

  for (const candidate of collectCandidates()) {
    if (terminateProcess(candidate.pid, candidate.reason + ' (force cleanup)', candidate.command, 'SIGKILL', startup)) killed.push(candidate.pid);
  }

  if (killed.length > 0) sharedUtils.sleepMs(300);

  const uniqueKilled = [...new Set(killed)];
  if (uniqueKilled.length === 0) startup('Cleanup finished: no previous watcher sessions found.');
  else startup('Cleanup finished: removed ' + uniqueKilled.length + ' previous watcher process(es).');
  startup('Starting fresh monitoring session...');
}

function listProcesses() {
  try {
    const out = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
    return out.split(/\r?\n/).map(line => {
      const m = line.match(/^\s*(\d+)\s+(.+)$/);
      if (!m) return null;
      return { pid: Number(m[1]), command: m[2] };
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function getProcessCommand(pid) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim();
  } catch (_) {
    return '';
  }
}

function getPidsListeningOnPort(port) {
  try {
    const out = execFileSync('lsof', ['-nP', '-iTCP:' + String(port), '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    return out.split(/\r?\n/).map(s => Number(s.trim())).filter(Number.isInteger);
  } catch (_) {
    return [];
  }
}

function isLikelyOldWatcherCommand(command) {
  const cmd = String(command || '');
  if (!/\bnode\b/.test(cmd) || !/\bapp\.js\b/.test(cmd)) return false;
  return /--memory-window|--memory|--all|--interval|--diagnose|roon-log-watcher/i.test(cmd);
}

function isLikelyWatcherTailCommand(command) {
  const cmd = String(command || '');
  if (!/^tail\s+-n\s+0\s+-F\s+/i.test(cmd)) return false;
  return /\/(RoonServer|Roon|RAATServer|RoonGoer|RoonAppliance|RoonBridge)\/Logs\//i.test(cmd) || /\/.RoonServer\/Logs\//i.test(cmd);
}

function terminateProcess(pid, reason, command, signal = 'SIGTERM', startup = console.log) {
  try {
    startup(`Stopping ${reason}: PID ${pid} (${signal})`);
    process.kill(pid, signal);
    return true;
  } catch (err) {
    if (err && err.code === 'ESRCH') return false;
    startup(`Could not stop PID ${pid}: ${err.message}`);
    return false;
  }
}

module.exports = {
  cleanupOldWatcherProcesses,
  listProcesses,
  getProcessCommand,
  getPidsListeningOnPort,
  isLikelyOldWatcherCommand,
  isLikelyWatcherTailCommand
};
