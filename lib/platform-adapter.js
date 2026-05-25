'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function escapeAppleScript(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function createPlatformAdapter({ platform = process.platform, arch = process.arch, env = process.env, execFileImpl = execFile, fsImpl = fs } = {}) {
  const isMac = platform === 'darwin';
  const isLinux = platform === 'linux';
  const name = isMac ? 'macOS' : isLinux ? 'Linux' : platform || 'generic';

  function listMountedVolumes() {
    try { return fsImpl.readdirSync('/Volumes'); } catch (_) { return []; }
  }

  function getDefaultBaseDirectory() {
    if (isMac) return '/Volumes/Data';
    if (isLinux) return env.HOME || '/var/roon';
    return env.HOME || process.cwd();
  }

  function getRuntimeProfile() {
    return { platform, arch, name, defaultBaseDirectory: getDefaultBaseDirectory(), supportsProcMemory: isLinux, canOpenBrowser: isMac || (isLinux && Boolean(env.DISPLAY)) };
  }

  function getConfiguredBaseDirectory(cfg = {}) {
    const configured = cfg.baseDirectory;
    if (isLinux && (!configured || configured === '/Volumes/Data')) return getDefaultBaseDirectory();
    return configured || getDefaultBaseDirectory();
  }

  function shouldUseLinuxLogDirectoryFallbacks() {
    return isLinux;
  }

  function getMemorySourceLabel() {
    return isLinux ? '/proc/<pid>/status VmRSS/VmSize' : 'Roon [stats] log lines';
  }

  function openUrl(url) {
    if (!url) return;
    if (isMac) execFileImpl('open', [url], () => {});
    else if (isLinux && env.DISPLAY) execFileImpl('xdg-open', [url], () => {});
  }

  function sendNotification({ enabled, title, message, subtitle }) {
    if (!enabled || !isMac) return;
    execFileImpl('osascript', [
      '-e',
      `display notification "${escapeAppleScript(String(message || '').slice(0, 180))}" with title "${escapeAppleScript(title || 'Roon Log Watcher')}" subtitle "${escapeAppleScript(subtitle || '')}"`
    ], () => {});
  }

  function getLinuxHints() {
    return 'Linux hints: check ~/.RoonServer/Logs, /var/roon/RoonServer/Logs, or set config.json > logDirectories.';
  }

  return { platform, arch, name, isMac, isLinux, path, listMountedVolumes, getDefaultBaseDirectory, getConfiguredBaseDirectory, shouldUseLinuxLogDirectoryFallbacks, getRuntimeProfile, getMemorySourceLabel, openUrl, sendNotification, getLinuxHints };
}

module.exports = { createPlatformAdapter, escapeAppleScript };
