'use strict';

// v8.71: Centralizes platform/profile discovery wrappers and safe log-file
// listing. Keeping this logic out of app-main.js makes the runtime
// orchestrator focus on flow instead of filesystem edge cases.
function createLogFileService(options) {
  const {
    fs,
    path,
    logDiscovery,
    fileNameIncludes,
    maxFilesPerDirectory,
    warnedDirectoryReadErrors,
    startup,
    isDiscoveryLogSuppressed
  } = options;

  function getRuntimeProfile() {
    return logDiscovery.getRuntimeProfile();
  }

  function getConfiguredBaseDirectory(config) {
    return logDiscovery.getConfiguredBaseDirectory(config);
  }

  function getDirectories(config) {
    const discoveryLog = (message) => {
      if (!isDiscoveryLogSuppressed()) startup(message);
    };
    return logDiscovery.getDirectories(config, { log: discoveryLog, fileNameIncludes });
  }

  function listMountedVolumes() {
    return logDiscovery.listMountedVolumes();
  }

  function fallbackKnownLogFiles(dir) {
    return logDiscovery.fallbackKnownLogFiles(dir, maxFilesPerDirectory);
  }

  function listLogFiles(dir) {
    try {
      return fs.readdirSync(dir)
        .map(name => path.join(dir, name))
        .filter(file => {
          try {
            const stat = fs.statSync(file);
            if (!stat.isFile()) return false;
            if (path.basename(file).startsWith('._')) return false;
            const lower = path.basename(file).toLowerCase();
            return fileNameIncludes.some(s => lower.includes(s));
          } catch (_) { return false; }
        })
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
        .slice(0, maxFilesPerDirectory);
    } catch (err) {
      const fallback = fallbackKnownLogFiles(dir);
      const key = path.resolve(dir) + '|' + err.code;
      if (!warnedDirectoryReadErrors.has(key)) {
        warnedDirectoryReadErrors.add(key);
        console.warn('Cannot list directory:', dir, err.code || '', err.message);
        if (fallback.length > 0) {
          console.warn('Using known Roon log file-name fallback for this directory. Files found:', fallback.map(f => path.basename(f)).join(', '));
        } else {
          console.warn('No known Roon log files could be opened directly in this directory. Check permissions and set config.json > logDirectories if the Roon data root is elsewhere.');
        }
      }
      return fallback;
    }
  }

  return {
    getRuntimeProfile,
    getConfiguredBaseDirectory,
    getDirectories,
    listMountedVolumes,
    fallbackKnownLogFiles,
    listLogFiles
  };
}

module.exports = { createLogFileService };
