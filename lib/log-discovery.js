'use strict';

const fs = require('fs');
const path = require('path');
const { createPlatformAdapter } = require('./platform-adapter');

const platformAdapter = createPlatformAdapter();

// Discovery is kept separate from app orchestration so platform-specific Roon
// path rules can evolve without touching log parsing or dashboard code.
function getRuntimeProfile() {
  return platformAdapter.getRuntimeProfile();
}

function getConfiguredBaseDirectory(cfg = {}) {
  return platformAdapter.getConfiguredBaseDirectory(cfg);
}

function getEnvLogDirectories() {
  return ['ROON_LOG_DIR', 'ROONSERVER_LOG_DIR', 'ROONSERVER_DATAROOT']
    .map(name => process.env[name])
    .filter(Boolean)
    .flatMap(value => {
      const resolved = path.resolve(value);
      return [resolved, path.join(resolved, 'Logs'), path.join(resolved, 'RoonServer', 'Logs')];
    });
}

function getLinuxKnownRootCandidates() {
  const home = process.env.HOME || '';
  const user = process.env.USER || process.env.LOGNAME || '';
  const candidates = [];
  if (home) candidates.push(home, path.join(home, 'RoonServer'), path.join(home, '.RoonServer'), path.join(home, '.local', 'share', 'RoonServer'));
  if (user) candidates.push(path.join('/home', user), path.join('/home', user, 'RoonServer'), path.join('/home', user, '.RoonServer'));
  candidates.push('/var/roon', '/var/lib/roon', '/opt/roon', '/opt/RoonServer', '/usr/local/RoonServer', '/srv/roon');
  return [...new Set(candidates.filter(Boolean).map(d => path.resolve(d)))];
}

function getDefaultLinuxLogDirectories() {
  const dirs = [];
  for (const root of getLinuxKnownRootCandidates()) {
    dirs.push(path.join(root, 'Logs'), path.join(root, 'RoonServer', 'Logs'), path.join(root, 'RAATServer', 'Logs'), path.join(root, 'RoonAppliance', 'Logs'), path.join(root, 'RoonBridge', 'Logs'));
  }
  return [...new Set(dirs.map(d => path.resolve(d)))].filter(existsDirectory);
}

function knownRoonLogDirectories(baseDir) {
  const base = path.resolve(baseDir || '/Volumes/Data');
  const candidates = [
    path.join(base, 'Logs'), path.join(base, 'RoonServer', 'Logs'), path.join(base, '.RoonServer', 'Logs'), path.join(base, 'Roon', 'Logs'),
    path.join(base, 'RAATServer', 'Logs'), path.join(base, 'RoonGoer', 'Logs'), path.join(base, 'RoonAppliance', 'Logs'), path.join(base, 'RoonBridge', 'Logs'),
    path.join(base, 'RoonServer', 'RoonServer', 'Logs'), path.join(base, 'RoonServer', 'Roon', 'Logs'), path.join(base, 'RoonServer', 'RAATServer', 'Logs')
  ];
  return candidates.filter(existsDirectory);
}

function discoverLogDirectories(baseDir, cfg = {}, fileNameIncludes = ['log', 'txt']) {
  const result = [];
  const maxDepth = Number(cfg.discoveryMaxDepth || 4);
  const dirIncludes = (cfg.directoryNameIncludes || ['roon', 'raat']).map(s => String(s).toLowerCase());
  const includes = (fileNameIncludes || ['log', 'txt']).map(s => String(s).toLowerCase());
  const excludes = (cfg.excludeDirectories || []).map(d => path.resolve(d));

  function isExcluded(dir) {
    const resolved = path.resolve(dir);
    return excludes.some(ex => resolved === ex || resolved.startsWith(ex + path.sep));
  }

  function walk(dir, depth) {
    if (depth > maxDepth || isExcluded(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    const hasLogFiles = entries.some(e => e.isFile() && includes.some(s => e.name.toLowerCase().includes(s)));
    const baseName = path.basename(dir).toLowerCase();
    const parentName = path.basename(path.dirname(dir)).toLowerCase();
    const looksLikeRoon = dirIncludes.some(s => baseName.includes(s) || parentName.includes(s));
    if (baseName === 'logs' && hasLogFiles && looksLikeRoon) result.push(dir);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      walk(path.join(dir, entry.name), depth + 1);
    }
  }

  walk(baseDir, 0);
  return [...new Set(result.map(d => path.resolve(d)))];
}

function getDirectories(cfg = {}, options = {}) {
  const log = typeof options.log === 'function' ? options.log : () => {};
  const fileNameIncludes = options.fileNameIncludes || ['log', 'txt'];
  const manual = Array.isArray(cfg.logDirectories) ? cfg.logDirectories.filter(Boolean) : [];
  if (cfg.logDirectory) manual.push(cfg.logDirectory);
  const baseDirectory = getConfiguredBaseDirectory(cfg);
  log('Base directory: ' + baseDirectory);
  const known = [...knownRoonLogDirectories(baseDirectory), ...getEnvLogDirectories(), ...(platformAdapter.shouldUseLinuxLogDirectoryFallbacks() ? getDefaultLinuxLogDirectories() : [])].filter(existsDirectory);
  log('Known direct Roon log paths found: ' + known.length);
  let discovered = [];
  const shouldDeepDiscover = cfg.forceDeepDiscovery === true || ((manual.length + known.length) === 0 && cfg.autoDiscoverRoonLogDirectories !== false);
  if (shouldDeepDiscover) {
    log('Deep discovery enabled. Scanning for additional Logs directories...');
    discovered = discoverLogDirectories(baseDirectory, cfg, fileNameIncludes);
    log('Deep discovery finished: ' + discovered.length + ' director' + (discovered.length === 1 ? 'y' : 'ies') + ' found.');
  } else {
    log('Deep discovery skipped because direct log paths were found. Set forceDeepDiscovery=true in config.json to enable it.');
  }
  return [...new Set([...manual, ...known, ...discovered].map(d => path.resolve(d)))].sort();
}

function fallbackKnownLogFiles(dir, maxFilesPerDirectory = 50) {
  const parentName = path.basename(path.dirname(dir));
  const candidates = [];
  const stems = [parentName + '_log', 'RoonServer_log', 'Roon_log', 'RAATServer_log', 'RoonAppliance_log', 'RoonBridge_log', 'RoonGoer_log'];
  for (const stem of [...new Set(stems)]) {
    candidates.push(path.join(dir, stem + '.txt'), path.join(dir, stem));
    for (let i = 1; i <= 3; i++) {
      const suffix = String(i).padStart(2, '0');
      candidates.push(path.join(dir, stem + '.' + suffix + '.txt'), path.join(dir, stem + '.' + suffix));
    }
  }
  return [...new Set(candidates)].filter(file => {
    try { return fs.existsSync(file) && fs.statSync(file).isFile(); } catch (_) { return false; }
  }).slice(0, maxFilesPerDirectory);
}

function listMountedVolumes() {
  try { return fs.readdirSync('/Volumes'); } catch (_) { return []; }
}

function existsDirectory(dir) {
  try { return fs.existsSync(dir) && fs.statSync(dir).isDirectory(); } catch (_) { return false; }
}

module.exports = {
  getRuntimeProfile,
  getConfiguredBaseDirectory,
  getDirectories,
  discoverLogDirectories,
  knownRoonLogDirectories,
  getEnvLogDirectories,
  getDefaultLinuxLogDirectories,
  fallbackKnownLogFiles,
  listMountedVolumes
};
