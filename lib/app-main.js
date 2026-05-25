const fs = require('fs');
const path = require('path');
const ROOT_DIR = path.join(__dirname, '..');
const releaseInfo = require('../release-info');
const sharedUtils = require('./shared-utils');
const memoryAnalysis = require('./memory-analysis');
const runtimeFlags = require('./runtime-flags');
const dashboardHtml = require('./dashboard-html');
const configLoader = require('./config-loader');
const cliOptions = require('./cli-options');
const thresholds = require('./thresholds');
const logPatterns = require('./log-patterns');
const healthScore = require('./health-score');
const memoryTrends = require('./memory-trends');
const gcAnalysis = require('./gc-analysis');
const runtimeIntelligence = require('./runtime-intelligence');
const plausibilityCheck = require('./plausibility-check');
const apiRoutes = require('./api-routes');
const appState = require('./app-state');
const logWatcher = require('./log-watcher');
const logDiscovery = require('./log-discovery');
const processCleanup = require('./process-cleanup');
const incidentDetector = require('./incident-detector');
const timelineDetector = require('./timeline-detector');
const appBootstrap = require('./app-bootstrap');
const notificationService = require('./notification-service');
const metricsStore = require('./metrics-store');
const runtimeStateFactory = require('./runtime-state');
const eventPipeline = require('./event-pipeline');
const serverStartup = require('./server-startup');
const liveLogProcessingServiceFactory = require('./live-log-processing-service');
const logClassification = require('./log-classification');
const appCoreContextFactory = require('./app-core-context');
const dashboardDataBuilderFactory = require('./dashboard-data-builder');
const startupRunner = require('./startup-runner');
const logStreamManagerFactory = require('./log-stream-manager');
const memorySampler = require('./memory-sampler');
const logFileServiceFactory = require('./log-file-service');
const diagnosticsRunner = require('./diagnostics-runner');
const dashboardServiceFactory = require('./dashboard-service');
const terminalOutputServiceFactory = require('./terminal-output-service');
const processMemoryMonitorFactory = require('./process-memory-monitor');
const memoryTestRunner = require('./memory-test-runner');
const platformAdapterFactory = require('./platform-adapter');
const correlationEngineFactory = require('./correlation-engine');
const zoneStateServiceFactory = require('./zone-state-service');
const playbackSessionServiceFactory = require('./playback-session-service');
const incidentLifecycleServiceFactory = require('./incident-lifecycle-service');
const memoryRuntimeServiceFactory = require('./memory-runtime-service');

const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
const argv = process.argv.slice(2);
const cli = cliOptions.createCliOptions(argv);
const args = new Set(argv);

if (args.has('--write-default-config')) {
  const result = configLoader.writeDefaultConfig({ configPath: CONFIG_PATH });
  console.log(result.message);
  process.exit(0);
}

let config;
try {
  config = configLoader.loadConfig({ configPath: CONFIG_PATH });
  if (!fs.existsSync(CONFIG_PATH)) console.log('config.json not found. Using defaults from config.example.json or built-in fallback.');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
const showAllLogLines = args.has('--all') || args.has('-a') || config.showAllLogLines === true;
const diagnoseOnly = args.has('--diagnose');
const scanExisting = false; // historic scanning disabled: runtime-only memory monitoring
const memoryTestFile = cli.get('--memory-test-file');
const platformAdapter = platformAdapterFactory.createPlatformAdapter();
const sendMacNotifications = platformAdapter.isMac && config.sendMacNotifications !== false;
const watchFromEnd = true; // always start at end of existing logs; no historic data is read
const fileNameIncludes = (config.fileNameIncludes || ['log', 'txt']).map(s => String(s).toLowerCase());
const warnedDirectoryReadErrors = new Set();
const maxFilesPerDirectory = Math.max(1, Number(config.maxFilesPerDirectory || 50));
const pollIntervalMs = cliOptions.getPollIntervalMs(cli, config);
const memoryWindowEnabled = args.has('--memory-window') || args.has('--memory') || config.memoryWindow === true;
const memoryWindowPort = cliOptions.getMemoryWindowPort(cli, config);
const memoryHistoryMaxPoints = Math.max(100, Number(config.memoryHistoryMaxPoints || 2000));
const memorySeedBytes = Math.max(0, Number(config.memorySeedBytes || 100 * 1024 * 1024));
const memoryDebug = args.has('--memory-debug') || config.memoryDebug === true;
const memoryRescanIntervalMs = Math.max(5000, Number(config.memoryRescanIntervalSeconds || 30) * 1000);
const processMemoryPollingEnabled = config.processMemoryPolling !== false;
const processMemoryPollIntervalMs = Math.max(1000, Number(config.processMemoryPollIntervalSeconds || 5) * 1000);
const smoothTerminalOutput = args.has('--smooth-output') || config.smoothTerminalOutput === true;
const terminalLogsEnabled = args.has('--terminal-logs') || config.terminalLogs === true;
const terminalOutputIntervalMs = Math.max(10, Number(config.terminalOutputIntervalMs || 40));
// v8.72: terminal smoothing queue/timer moved into terminal-output-service.
const terminalOutput = terminalOutputServiceFactory.createTerminalOutputService({
  enabled: terminalLogsEnabled,
  smooth: smoothTerminalOutput,
  intervalMs: terminalOutputIntervalMs
});
const tailProcesses = new Map();
const logStreamManager = logStreamManagerFactory.createLogStreamManager({ logWatcher, tailProcesses });
const processMemoryMonitor = processMemoryMonitorFactory.createProcessMemoryMonitor({ fs, processCleanup });
const useTailBackend = config.useTailBackend !== false;
// Single source of truth for UI/footer/release-note version labels.
// The actual version and release panel content live in release-info.js so future
// releases only need one metadata update instead of scattered string changes.
const APP_VERSION = releaseInfo.APP_VERSION;
const autoCleanupOldInstances = !args.has('--no-cleanup') && config.autoCleanupOldInstances !== false;
let lastLogLineAt = 0;
let lastWaitingLogAt = 0;
let suppressDiscoveryLogs = false;
const startup = appBootstrap.createStartupLogger();
const logFileService = logFileServiceFactory.createLogFileService({
  fs,
  path,
  logDiscovery,
  fileNameIncludes,
  maxFilesPerDirectory,
  warnedDirectoryReadErrors,
  startup,
  isDiscoveryLogSuppressed: () => suppressDiscoveryLogs
});
const appCoreContext = appCoreContextFactory.createAppCoreContext({ appVersion: APP_VERSION, configPath: CONFIG_PATH });
const runtimeState = runtimeStateFactory.createRuntimeState({ runStartedAt: appCoreContext.startedAt, appVersion: APP_VERSION });
runtimeState.server.tailProcesses = tailProcesses;
const correlationEngine = correlationEngineFactory.createCorrelationEngine({ maxSignals: Number(config.correlationMaxEvents || 500) });

const patterns = logPatterns.compilePatterns(config.patterns, message => console.warn('[config]', message));
const positions = runtimeState.server.positions;
const recentAlerts = new Map();
const runtimeThresholds = thresholds.buildThresholds(config);
const DEDUPE_MS = runtimeThresholds.alertDedupeMs;
const notifications = notificationService.createNotificationService({ enabled: sendMacNotifications });
const dashboardDataBuilder = dashboardDataBuilderFactory.createDashboardDataBuilder({ appState, sharedUtils, appVersion: APP_VERSION });

const memoryClients = runtimeState.server.memoryClients;
const memoryPoints = runtimeState.telemetry.memoryPoints;
let memoryStatsLinesDetected = 0;
let memoryLineSequence = 0;
const recentLogLines = runtimeState.events.recentLogLines;
let recentLogSequence = 0;
const recentLogMaxLines = Math.max(100, Number(config.recentLogMaxLines || 1000));
const runStartedAt = new Date().toISOString();
const alertEvents = runtimeState.events.alerts;
const alertMaxEvents = Math.max(50, Number(config.alertMaxEvents || 200));
const timelineEvents = runtimeState.events.timeline;
const timelineMaxEvents = Math.max(100, Number(config.timelineMaxEvents || 300));
const recentMemoryByMetric = runtimeState.telemetry.recentMemoryByMetric;
const timelineDedup = new Map();
const incidentEvents = runtimeState.events.incidents;
const incidentLifecycles = runtimeState.events.incidentLifecycle;
const incidentMaxEvents = Math.max(50, Number(config.incidentMaxEvents || 120));
const playbackSessions = runtimeState.playback.sessions;
const playbackMaxSessions = Math.max(20, Number(config.playbackMaxSessions || 80));
const activePlaybackSessions = runtimeState.playback.activeSessions;
const zoneStats = runtimeState.playback.zones;
const memoryCorrelationEvents = runtimeState.events.memoryCorrelations;
const memoryCorrelationMaxEvents = Math.max(20, Number(config.memoryCorrelationMaxEvents || 80));
const zoneMaxItems = Math.max(10, Number(config.zoneMaxItems || 40));
const memoryAlertConfig = runtimeThresholds.memoryAlerts;

function runApplication() {
  if (autoCleanupOldInstances && !diagnoseOnly && !memoryTestFile) {
    processCleanup.cleanupOldWatcherProcesses({ port: memoryWindowPort, startup });
  }

  startup('Node.js ' + process.version + ' on ' + platformAdapter.platform + '/' + process.arch);
  startup('Runtime profile: ' + getRuntimeProfile().name);
  startup('Loading configuration from ' + CONFIG_PATH);
  startup('Configuration loaded. Starting log directory discovery...');
  let directories = getDirectories(config);
  startup('Log directory discovery finished: ' + directories.length + ' candidate director' + (directories.length === 1 ? 'y' : 'ies') + '.');
  suppressDiscoveryLogs = true;

  if (memoryTestFile) {
    runMemoryTestFile(memoryTestFile);
    process.exit(0);
  }

  startupRunner.printStartupSummary({
    appVersion: APP_VERSION,
    showAllLogLines,
    terminalLogsEnabled,
    smoothTerminalOutput,
    terminalOutputIntervalMs,
    useTailBackend,
    pollIntervalMs,
    memoryWindowEnabled,
    memoryWindowPort,
    processMemoryPollingEnabled,
    processMemoryPollIntervalMs,
    directories
  });

  let existingDirectories = directories.filter(d => fs.existsSync(d));
  if (existingDirectories.length === 0) {
    console.error('No log directories were found yet for runtime profile:', getRuntimeProfile().name);
    console.error('The watcher will keep running and retry discovery every polling interval.');
    if (platformAdapter.isMac) console.error('Mounted /Volumes entries:', listMountedVolumes().join(', ') || '(none)');
    if (platformAdapter.isLinux) console.error(platformAdapter.getLinuxHints());
  }

  if (diagnoseOnly) {
    diagnose(existingDirectories);
    process.exit(0);
  }

  initialise(existingDirectories);
  if (memoryWindowEnabled) {
    memoryRuntimeService.refreshRuntimeProcessInfo(true);
    memoryRuntimeService.startProcessMemoryPolling();
    startMemoryWindow();
  }
  startupRunner.printReadyMessage();

  setInterval(() => {
    existingDirectories = refreshDirectories(existingDirectories);
    if (!useTailBackend) poll(existingDirectories);
  }, pollIntervalMs);

  setInterval(() => {
    if (!useTailBackend) return;
    if (lastLogLineAt === 0 || Date.now() - lastLogLineAt > 30000) {
      console.log(`[watcher] running. active tail streams: ${tailProcesses.size}, memory points: ${memoryPoints.length}, waiting for new log lines...`);
    }
  }, 30000);
}


// v8.61: Host cleanup and platform-specific Roon log discovery now live in
// dedicated modules. app.js keeps only thin wrappers where the runtime still
// needs local configuration such as startup logging or maxFilesPerDirectory.
function sleepMs(ms) {
  return sharedUtils.sleepMs(ms);
}

function pushLimited(arr, value, max) {
  return sharedUtils.pushLimited(arr, value, max);
}

function averageNumber(arr) {
  return sharedUtils.averageNumber(arr);
}

function listProcesses() {
  return processCleanup.listProcesses();
}

function getRuntimeProfile() {
  return platformAdapter.getRuntimeProfile();
}

function getConfiguredBaseDirectory(cfg) {
  return logFileService.getConfiguredBaseDirectory(cfg);
}

function getDirectories(cfg) {
  return logFileService.getDirectories(cfg);
}

function listMountedVolumes() {
  return platformAdapter.listMountedVolumes();
}

function fallbackKnownLogFiles(dir) {
  return logFileService.fallbackKnownLogFiles(dir);
}

function listLogFiles(dir) {
  return logFileService.listLogFiles(dir);
}

function diagnose(dirs) {
  return diagnosticsRunner.diagnose({
    fs,
    path,
    configPath: CONFIG_PATH,
    config,
    dirs,
    maxFilesPerDirectory,
    logFileService,
    findRoonProcesses,
    selectBestRoonProcess
  });
}

function refreshDirectories(currentDirectories) {
  const rediscovered = getDirectories(config).filter(d => fs.existsSync(d));
  const currentSet = new Set(currentDirectories.map(d => path.resolve(d)));
  const newDirs = rediscovered.filter(d => !currentSet.has(path.resolve(d)));
  if (newDirs.length > 0) {
    console.log('New log director' + (newDirs.length === 1 ? 'y' : 'ies') + ' discovered:');
    newDirs.forEach(d => console.log(' -', d));
    initialise(newDirs);
    return [...new Set([...currentDirectories, ...newDirs].map(d => path.resolve(d)))];
  }
  if (currentDirectories.length === 0) {
    const now = Date.now();
    if (now - lastWaitingLogAt > 10000) {
      lastWaitingLogAt = now;
      console.log('Still waiting for Roon log directories. Checked runtime profile:', getRuntimeProfile().name, 'baseDirectory:', getConfiguredBaseDirectory(config));
    }
  }
  return currentDirectories;
}

function initialise(dirs) {
  startup('Initialising watchers for ' + dirs.length + ' director' + (dirs.length === 1 ? 'y' : 'ies') + '...');
  let count = 0;
  for (const dir of dirs) {
    const files = listLogFiles(dir);
    console.log(`${dir}: ${files.length} log file(s) found.`);
    files.forEach((file, index) => {
      const stat = fs.statSync(file);
      const start = watchFromEnd ? stat.size : 0;
      positions.set(file, start);
      count += 1;
      if (index < 20) console.log(`  watching: ${path.basename(file)} (${Math.round(stat.size / 1024)} KB, modified ${new Date(stat.mtimeMs).toLocaleString()})`);
    });
    if (files.length > 20) console.log(`  ... plus ${files.length - 20} more`);
    if (useTailBackend) {
      const before = tailProcesses.size;
      startTailForFiles(files);
      console.log(`  tail streams added: ${tailProcesses.size - before}`);
    }
  }
  if (useTailBackend) console.log(`tail -F streams active: ${tailProcesses.size}`);
  if (count === 0) console.log('No log files found. Run npm run diagnose and check config.json.');
  if (memoryWindowEnabled) {
    console.log('Runtime-only memory monitoring: existing log content is ignored.');
    console.log('Memory points detected since watcher start:', memoryPoints.length);
  }
}


function isAppleDoubleFile(file) {
  return logWatcher.isAppleDoubleFile(file);
}

function shouldTailFile(file) {
  return logWatcher.shouldTailFile(file);
}

function startTailForFile(file) {
  return logWatcher.startTailForFile({ file, tailProcesses, positions, inspectLine });
}

function startTailForFiles(files) {
  return logWatcher.startTailForFiles({ files, tailProcesses, positions, inspectLine });
}


function poll(dirs) {
  for (const dir of dirs) {
    for (const file of listLogFiles(dir)) {
      let stat;
      try { stat = fs.statSync(file); } catch (_) { continue; }
      if (!positions.has(file)) {
        const start = watchFromEnd ? stat.size : 0;
        positions.set(file, start);
        console.log('New log file detected:', file);
        if (!watchFromEnd && stat.size > 0) readNewBytes(file, 0, stat.size);
        continue;
      }
      const oldPos = positions.get(file);
      const newPos = stat.size;
      if (newPos < oldPos) {
        positions.set(file, 0);
        readNewBytes(file, 0, newPos);
      } else if (newPos > oldPos) {
        readNewBytes(file, oldPos, newPos);
      }
    }
  }
}



function readNewBytes(file, start, end) {
  if (end <= start) return;
  let data;
  try {
    const fd = fs.openSync(file, 'r');
    const length = end - start;
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    fs.closeSync(fd);
    data = buffer.toString('utf8');
    positions.set(file, end);
  } catch (err) {
    console.error('Cannot read log file:', file, err.message);
    return;
  }
  data.split(/\r?\n/).filter(Boolean).forEach(line => processLogLine(file, line));
}


const {
  isBenignPlaybackRaatDisconnect,
  isNormalPlaybackTransition,
  isBenignHttpStatus,
  isRemoteAccessOnlyProblem,
  isBenignStreamingCacheActivity,
  isRealStreamingMetadataProblem,
  isCriticalDatabaseProblem,
  isSlowDatabaseFlush,
  isBenignForAlerting
} = logClassification;

const zoneStateService = zoneStateServiceFactory.createZoneStateService({
  zoneStats,
  zoneMaxItems,
  isBenignPlaybackRaatDisconnect,
  recoverIncidentLifecyclesForZone,
  trimLine,
  pushLimited,
  averageNumber
});

const playbackSessionService = playbackSessionServiceFactory.createPlaybackSessionService({
  playbackSessions,
  activePlaybackSessions,
  playbackMaxSessions,
  cleanEndpointDisplayName: zoneStateService.cleanEndpointDisplayName,
  extractZoneFromLine: zoneStateService.extractZoneFromLine,
  extractTrackFromLine: zoneStateService.extractTrackFromLine,
  getPlaybackSource: zoneStateService.getPlaybackSource,
  isUserFacingZone: zoneStateService.isUserFacingZone,
  isBenignStreamingCacheActivity,
  recoverIncidentLifecyclesForZone,
  addTimelineEvent
});

const incidentLifecycleService = incidentLifecycleServiceFactory.createIncidentLifecycleService({
  metricsStore,
  incidentEvents,
  incidentLifecycles,
  timelineEvents,
  alertEvents,
  incidentMaxEvents,
  normalizeSeverity,
  normalizeZoneName: zoneStateService.normalizeZoneName,
  extractZoneFromLine: zoneStateService.extractZoneFromLine,
  addTimelineEvent,
  calculateHealthScore: healthScore.calculateIncidentHealthScore
});

const memoryRuntimeService = memoryRuntimeServiceFactory.createMemoryRuntimeService({
  path,
  memoryAnalysis,
  memoryTrends,
  gcAnalysis,
  runtimeIntelligence,
  memorySampler,
  metricsStore,
  processMemoryMonitor,
  platformAdapter,
  memoryWindowEnabled,
  processMemoryPollingEnabled,
  processMemoryPollIntervalMs,
  memoryHistoryMaxPoints,
  memoryDebug,
  memoryPoints,
  recentMemoryByMetric,
  recentLogLines,
  memoryCorrelationEvents,
  memoryCorrelationMaxEvents,
  memoryAlertConfig,
  alertDedupeMs: DEDUPE_MS,
  applyZoneMemoryImpact,
  addTimelineEvent,
  addIncident,
  addAlertEvent,
  sendNotification,
  broadcastMemoryPoint,
  trimLine
});

const liveLogProcessingService = liveLogProcessingServiceFactory.createLiveLogProcessingService({
  runtimeState,
  config,
  correlationEngine,
  patterns,
  isBenignForAlerting,
  collectMemoryData,
  detectPlaybackSession,
  updateZoneStatsFromLine,
  detectTimelineEvent,
  detectIncidentFromLine,
  emitAlert,
  trimLine,
  addRecentLogLine,
  writeLogLine,
  showAllLogLines,
  terminalLogsEnabled
});
const processLogLine = liveLogProcessingService.processLogLine;
const inspectLine = liveLogProcessingService.inspectLine;

function writeLogLine(text) {
  return terminalOutput.writeLogLine(text);
}

function ensureTerminalOutputTimer() {
  return terminalOutput.ensureTimer();
}

function addRecentLogLine(text, isMatch) {
  recentLogSequence += 1;
  metricsStore.pushBounded(recentLogLines, {
    seq: recentLogSequence,
    receivedAt: new Date().toISOString(),
    text,
    isMatch: Boolean(isMatch)
  }, recentLogMaxLines);
}


// Runtime decomposition: zone and playback state are owned by focused services.
// app-main keeps compatibility wrappers because downstream runtime wiring still calls
// these well-known functions during the transition to a fully event-driven pipeline.
function normalizeZoneName(value) { return zoneStateService.normalizeZoneName(value); }
function cleanEndpointDisplayName(value) { return zoneStateService.cleanEndpointDisplayName(value); }
function isUserFacingZone(value) { return zoneStateService.isUserFacingZone(value); }
function getPlaybackSource(file, line) { return zoneStateService.getPlaybackSource(file, line); }
function extractZoneFromLine(line) { return zoneStateService.extractZoneFromLine(line); }
function updateZoneStatsFromLine(file, line) { return zoneStateService.updateZoneStatsFromLine(file, line); }
function applyZoneMemoryImpact(samples, line) { return zoneStateService.applyZoneMemoryImpact(samples, line); }
function getZoneSnapshot() { return zoneStateService.getZoneSnapshot(); }
function extractTrackFromLine(line) { return zoneStateService.extractTrackFromLine(line); }
function extractSignalFromLine(line) { return playbackSessionService.extractSignalFromLine(line); }
function getOrCreatePlaybackSession(zone, source, reason) { return playbackSessionService.getOrCreatePlaybackSession(zone, source, reason); }
function updatePlaybackSession(session, eventName, line, patch) { return playbackSessionService.updatePlaybackSession(session, eventName, line, patch); }
function completePlaybackSession(session, line, reason) { return playbackSessionService.completePlaybackSession(session, line, reason); }
function buildPlaybackSummary(session, reason) { return playbackSessionService.buildPlaybackSummary(session, reason); }
function detectPlaybackSession(file, line) { return playbackSessionService.detectPlaybackSession(file, line); }

// Central severity normalisation for all incident/timeline producers.
// Individual parsers may emit raw hints, but the UI should receive a small,
// predictable severity vocabulary so colours, health score and lifecycle state
// stay consistent across the dashboard.
function normalizeSeverity(rawSeverity, event) {
  return runtimeFlags.normalizeSeverity(rawSeverity, event);
}

function addTimelineEvent(event) {
  // Centralised bounded/deduped timeline storage. The classification still happens in
  // timeline-detector.js; this function only owns retention and normalised severity.
  return metricsStore.addTimelineEvent({
    list: timelineEvents,
    event,
    maxItems: timelineMaxEvents,
    dedupeMap: timelineDedup,
    normalizeSeverity
  });
}


function addIncident(event) {
  return incidentLifecycleService.addIncident(event);
}

function recoverIncidentLifecyclesForZone(zone, reason) {
  return incidentLifecycleService.recoverIncidentLifecyclesForZone(zone, reason);
}

function getIncidentLifecycleSnapshot() {
  return incidentLifecycleService.getIncidentLifecycleSnapshot();
}

function rememberIncidentSignal(type, source, windowMs) {
  return incidentLifecycleService.rememberIncidentSignal(type, source, windowMs);
}

function getIncidentHealthScore() {
  return incidentLifecycleService.getIncidentHealthScore();
}


function detectIncidentFromLine(file, line, matches) {
  return incidentDetector.detectIncidentFromLine({
    file, line, matches,
    isBenignPlaybackRaatDisconnect,
    isNormalPlaybackTransition,
    isBenignHttpStatus,
    isBenignStreamingCacheActivity,
    isRealStreamingMetadataProblem,
    isRemoteAccessOnlyProblem,
    isCriticalDatabaseProblem,
    isSlowDatabaseFlush,
    rememberIncidentSignal,
    addIncident
  });
}

function getIncidentHealthScore() {
  return healthScore.calculateIncidentHealthScore({
    incidentEvents,
    timelineEvents,
    alertEvents
  });
}


function detectTimelineEvent(file, line, matches) {
  return timelineDetector.detectTimelineEvent({
    file, line, matches,
    isBenignPlaybackRaatDisconnect,
    isNormalPlaybackTransition,
    isBenignHttpStatus,
    isBenignStreamingCacheActivity,
    isRealStreamingMetadataProblem,
    isCriticalDatabaseProblem,
    isSlowDatabaseFlush,
    addTimelineEvent
  });
}

function emitAlert(fileName, pattern, line) {
  const key = `${pattern.name}|${line.slice(0, 180)}`;
  const now = Date.now();
  if (now - (recentAlerts.get(key) || 0) < DEDUPE_MS) return;
  recentAlerts.set(key, now);

  const severity = (pattern.severity || 'warning').toUpperCase();
  console.log('\n================ ROON LOG ALERT ================');
  console.log('Time:', new Date().toLocaleString());
  console.log('Severity:', severity);
  console.log('Category:', pattern.name);
  console.log('Log:', fileName);
  console.log('Line:', line);
  console.log('================================================\n');

  addAlertEvent({
    type: 'log-pattern',
    severity: severity.toLowerCase(),
    title: pattern.name,
    message: line,
    source: fileName
  });

  if (pattern.notify !== false) {
    sendNotification(`${severity}: ${pattern.name}`, line, fileName);
  }
}

function addAlertEvent(event) {
  const enriched = Object.assign({
    id: Date.now() + '-' + Math.random().toString(16).slice(2),
    time: new Date().toISOString()
  }, event);
  metricsStore.pushBounded(alertEvents, enriched, alertMaxEvents);
  addTimelineEvent({ type: event.type || 'alert', severity: event.severity || 'warning', title: event.title || 'Alert', message: event.message || '', source: event.source || '', dedupeMs: 30000 });
}

function sendNotification(title, message, subtitle) {
  notifications.send(title, message, subtitle);
}

function collectMemoryData(file, rawLine, trimmedLine, reason = 'live') {
  return memoryRuntimeService.collectMemoryData(file, rawLine, trimmedLine, reason);
}

function findRoonProcesses() {
  return memoryRuntimeService.findRoonProcesses();
}

function selectBestRoonProcess(processes) {
  return memoryRuntimeService.selectBestRoonProcess(processes);
}

function extractMemorySamples(line) {
  return memoryRuntimeService.extractMemorySamples(line);
}

function extractLogClockDisplay(line) {
  return memoryRuntimeService.extractLogClockDisplay(line);
}

function extractLogTimestamp(line) {
  return memoryRuntimeService.extractLogTimestamp(line);
}

function toMB(value, unit) {
  return memoryRuntimeService.toMB(value, unit);
}


function runMemoryTestFile(file) {
  return memoryTestRunner.runMemoryTestFile({
    file,
    fs,
    path,
    extractMemorySamples,
    extractLogTimestamp,
    trimLine
  });
}

function buildDashboardDataContext() {
  return {
    memoryPoints,
    alertEvents,
    timelineEvents,
    memoryCorrelationEvents,
    incidentEvents,
    playbackSessions,
    activePlaybackSessions,
    recentLogLines,
    recentLogSequence,
    memoryStatsLinesDetected: memoryRuntimeService.getMemoryStatsLinesDetected(),
    runStartedAt,
    lastLogLineAt,
    runtimeProcessInfo: memoryRuntimeService.getRuntimeProcessInfo(),
    processMemoryPollingEnabled,
    tailProcesses,
    memoryWindowPort,
    terminalLogsEnabled,
    memoryAlertConfig,
    getIncidentLifecycleSnapshot,
    getZoneSnapshot,
    getIncidentHealthScore,
    getRuntimeProfile,
    normalizeSeverity,
    isUserFacingZone
  };
}

const dashboardService = dashboardServiceFactory.createDashboardService({
  rootDir: ROOT_DIR,
  dashboardHtml,
  releaseInfo,
  appVersion: APP_VERSION,
  memoryWindowPort,
  memoryHistoryMaxPoints,
  memoryDebug,
  dashboardDataBuilder,
  serverStartup,
  apiRoutes,
  openUrl,
  getDebugStats: () => ({ points: memoryPoints.length, statsLines: memoryRuntimeService.getMemoryStatsLinesDetected() }),
  getContext: buildDashboardDataContext
});

function exportDiagnosticSummary() {
  return dashboardService.exportDiagnosticSummary();
}

function startMemoryWindow() {
  return dashboardService.startMemoryWindow();
}

function exportMemoryJson() {
  return dashboardService.exportMemoryJson();
}

function exportLogsText() {
  return dashboardService.exportLogsText();
}

function getHealthText() {
  return dashboardService.getHealthText();
}

function getMemorySnapshot() {
  return dashboardService.getMemorySnapshot();
}

function getHealthSnapshot() {
  return dashboardService.getHealthSnapshot();
}

function exportMemoryCsv() {
  return dashboardService.exportMemoryCsv();
}

function broadcastMemoryPoint(point) {
  return dashboardService.broadcastMemoryPoint(memoryClients, point);
}

function openUrl(url) {
  return startupRunner.openUrl(url);
}

function trimLine(line) {
  return sharedUtils.trimLine(line);
}


startupRunner.registerShutdownHandlers({ stop: () => logStreamManager.stopAll() });
runApplication();
