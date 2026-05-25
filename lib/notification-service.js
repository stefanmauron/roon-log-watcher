'use strict';

const { execFile } = require('child_process');

function escapeAppleScript(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function createNotificationService({ enabled, platform = process.platform, execFileImpl = execFile } = {}) {
  const active = enabled === true && platform === 'darwin';
  return {
    enabled: active,
    send(title, message, subtitle) {
      if (!active) return;
      execFileImpl('osascript', [
        '-e',
        `display notification "${escapeAppleScript(String(message || '').slice(0, 180))}" with title "${escapeAppleScript(title || 'Roon Log Watcher')}" subtitle "${escapeAppleScript(subtitle || '')}"`
      ], () => {});
    }
  };
}

module.exports = {
  createNotificationService,
  escapeAppleScript
};
