'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const releaseInfo = require(path.join(root, 'release-info.js'));
const commandRegistry = require(path.join(root, 'lib/command-registry.js'));

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function fail(message) { failures.push(message); }

const failures = [];
const version = String(pkg.version).replace(/\.0$/, '');

if (releaseInfo.APP_VERSION !== version) {
  fail(`package.json version ${pkg.version} and release-info APP_VERSION ${releaseInfo.APP_VERSION} are not synchronized.`);
}

for (const doc of ['README.md', 'docs/architecture.md', 'docs/startup-options.md', 'docs/runtime-capabilities.md', 'docs/release-history.md']) {
  if (!fs.existsSync(path.join(root, doc))) fail(`${doc} is missing.`);
}

const readme = read('README.md');
if (!readme.includes(`Roon Log Watcher v${version}`)) fail('README.md does not reference the current release version.');
if (!readme.includes('Release-candidate readiness')) fail('README.md is missing the release-candidate readiness section.');

const startupDocs = read('docs/startup-options.md');
for (const { name, command } of commandRegistry.getStartupCommands()) {
  if (!startupDocs.includes(`npm run ${name}`) && name !== 'start') fail(`docs/startup-options.md does not mention npm run ${name}.`);
  if (!startupDocs.includes(command)) fail(`docs/startup-options.md does not document command: ${command}`);
}
for (const flag of ['--all', '--interval', '--memory-window', '--memory-port', '--memory-debug', '--memory-test-file', '--diagnose', '--write-default-config', '--smooth-output', '--terminal-logs', '--no-cleanup']) {
  if (!startupDocs.includes(flag)) fail(`docs/startup-options.md does not document ${flag}.`);
}
if (startupDocs.includes('--port')) fail('docs/startup-options.md still references deprecated --port. Use --memory-port.');

const releaseHistory = read('docs/release-history.md');
if (!releaseHistory.includes(`v${version}`)) fail('docs/release-history.md does not include the current version.');
if (!releaseInfo.RELEASE_HISTORY.some(([v]) => v === `v${version}`)) fail('release-info.js RELEASE_HISTORY does not include the current version.');

const runtimeCapabilities = read('docs/runtime-capabilities.md');
if (!runtimeCapabilities.includes('Release-candidate')) fail('docs/runtime-capabilities.md does not describe release-candidate readiness.');

const architecture = read('docs/architecture.md');
for (const term of ['RawLogLine', 'ParsedLogLine', 'NormalizedEvent', 'RuntimeSignal', 'Release-candidate quality gates']) {
  if (!architecture.includes(term)) fail(`docs/architecture.md is missing ${term}.`);
}

const pkgScripts = Object.keys(pkg.scripts || {});
for (const { name } of commandRegistry.getStartupCommands()) {
  if (!pkgScripts.includes(name)) fail(`command-registry contains ${name}, but package.json scripts does not.`);
}

if (failures.length) {
  for (const message of failures) console.error('✗ ' + message);
  process.exit(1);
}

console.log('✓ release candidate documentation and command registry checks passed');
