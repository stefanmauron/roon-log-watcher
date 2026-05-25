'use strict';

// Small context builder for startup diagnostics and future dependency injection.
// It avoids scattering runtime metadata across banner/status/reporting code.
function createAppCoreContext({ appVersion, configPath, pid = process.pid, platform = process.platform, startedAt = new Date().toISOString() } = {}) {
  return { appVersion, configPath, pid, platform, startedAt };
}

module.exports = { createAppCoreContext };
