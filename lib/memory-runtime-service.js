'use strict';

function createMemoryRuntimeService(options) {
  const {
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
    alertDedupeMs,
    applyZoneMemoryImpact,
    addTimelineEvent,
    addIncident,
    addAlertEvent,
    sendNotification,
    broadcastMemoryPoint,
    trimLine
  } = options;

  const lastMemorySnapshotByMetric = new Map();
  const memoryCorrelationDedup = new Map();
  const memoryAlertDedup = new Map();
  let memoryStatsLinesDetected = 0;
  let memoryLineSequence = 0;
  let memoryCorrelationSequence = 0;
  let runtimeProcessInfo = null;
  let processMemoryTimer = null;

  function collectMemoryData(file, rawLine, trimmedLine, reason = 'live') {
    if (!memoryWindowEnabled) return;

    const samples = extractMemorySamples(rawLine);
    if (samples.length === 0) return;
    if (String(rawLine).toLowerCase().includes('[stats]')) memoryStatsLinesDetected += 1;

    const timestamp = extractLogTimestamp(rawLine) || new Date().toISOString();
    const logTimeDisplay = extractLogClockDisplay(rawLine) || null;
    const parent = path.basename(path.dirname(path.dirname(file)));
    const source = `${parent || 'Log'}/${path.basename(file)}`;

    const lineSequence = ++memoryLineSequence;
    const gcInfo = extractGcInfo(rawLine);
    const correlationBefore = snapshotMemoryMetrics();
    applyZoneMemoryImpact(samples.map(sample => Object.assign({}, sample, gcInfo)), rawLine);
    for (const sample of samples) {
      const point = {
        time: timestamp,
        receivedAt: new Date().toISOString(),
        phase: reason === 'live' ? 'live' : 'history',
        sequence: lineSequence,
        metric: sample.metric,
        valueMB: Number(sample.valueMB.toFixed(2)),
        source,
        gcRuntimePercent: gcInfo.gcRuntimePercent,
        gcPauseMs: gcInfo.gcPauseMs,
        line: trimmedLine.slice(0, 500),
        logTimeDisplay
      };
      const duplicateKey = `${point.time}|${point.metric}|${point.valueMB}|${point.source}`;
      if (memoryPoints.some(p => `${p.time}|${p.metric}|${p.valueMB}|${p.source}` === duplicateKey)) continue;
      metricsStore.pushBounded(memoryPoints, point, memoryHistoryMaxPoints);
      if (memoryDebug) console.log(`[MEMORY] ${reason}: ${point.metric} ${point.valueMB} MB @ ${point.time} (${point.source})`);
      recordMemoryTimeline(point);
      broadcastMemoryPoint(point);
      evaluateMemoryAlerts(point);
    }
    detectMemoryIncreaseCorrelation(samples, correlationBefore, {
      time: timestamp,
      receivedAt: new Date().toISOString(),
      source,
      line: trimmedLine.slice(0, 500),
      sequence: lineSequence,
      gcRuntimePercent: gcInfo.gcRuntimePercent,
      gcPauseMs: gcInfo.gcPauseMs,
      logTimeDisplay
    });
  }

  function snapshotMemoryMetrics() {
    const out = {};
    for (const [metric, item] of lastMemorySnapshotByMetric.entries()) out[metric] = item ? Number(item.valueMB || 0) : 0;
    return out;
  }

  function detectMemoryIncreaseCorrelation(samples, before, context) {
    if (!Array.isArray(samples) || samples.length === 0) return;

    const after = Object.assign({}, before || {});
    for (const sample of samples) {
      if (!sample || !sample.metric) continue;
      after[sample.metric] = Number(sample.valueMB || 0);
      lastMemorySnapshotByMetric.set(sample.metric, { valueMB: Number(sample.valueMB || 0), time: context.receivedAt, source: context.source });
    }

    const importantMetrics = ['Physical Memory', 'Managed Memory', 'Unmanaged Memory'];
    const deltas = {};
    let maxDelta = 0;
    let totalPositiveDelta = 0;
    for (const metric of importantMetrics) {
      const prev = Number((before || {})[metric] || 0);
      const next = Number(after[metric] || 0);
      if (!prev || !next) continue;
      const delta = Math.round(next - prev);
      deltas[metric] = delta;
      if (delta > 0) {
        totalPositiveDelta += delta;
        if (delta > maxDelta) maxDelta = delta;
      }
    }

    if (maxDelta < 45 && totalPositiveDelta < 80) return;

    const now = new Date(context.receivedAt).getTime();
    const recentWindowMs = 4 * 60 * 1000;
    const nearbyLogs = recentLogLines.filter(l => {
      const ts = new Date(l.receivedAt).getTime();
      return Number.isFinite(ts) && ts <= now && now - ts <= recentWindowMs;
    }).slice(-220);
    const cause = runtimeIntelligence.inferMemoryCorrelationCause(nearbyLogs, context.line || '');
    const key = `${cause.category}|${Math.floor(now / 120000)}|${Math.round(totalPositiveDelta / 25)}`;
    if (memoryCorrelationDedup.has(key)) return;
    memoryCorrelationDedup.set(key, now);
    for (const [k, ts] of Array.from(memoryCorrelationDedup.entries())) {
      if (now - ts > 20 * 60 * 1000) memoryCorrelationDedup.delete(k);
    }

    const event = {
      id: 'memcorr-' + (++memoryCorrelationSequence),
      time: context.time,
      receivedAt: context.receivedAt,
      sequence: context.sequence,
      severity: totalPositiveDelta >= 250 ? 'warning' : 'info',
      title: cause.title,
      category: cause.category,
      memoryDeltaMB: totalPositiveDelta,
      maxMetricDeltaMB: maxDelta,
      deltas,
      confidence: cause.confidence,
      explanation: cause.explanation,
      evidence: cause.evidence.slice(0, 5),
      source: context.source,
      line: context.line || ''
    };
    memoryCorrelationEvents.push(event);
    if (memoryCorrelationEvents.length > memoryCorrelationMaxEvents) memoryCorrelationEvents.splice(0, memoryCorrelationEvents.length - memoryCorrelationMaxEvents);

    addTimelineEvent({
      type: 'memory-correlation',
      severity: event.severity,
      title: 'Memory increase correlation flag',
      message: `${Math.round(totalPositiveDelta)} MB increase correlated with ${cause.title}`,
      source: context.source,
      dedupeMs: 60000
    });
  }

  function recordMemoryTimeline(point) {
    const metric = point.metric;
    const value = Number(point.valueMB || 0);
    const last = recentMemoryByMetric.get(metric);
    recentMemoryByMetric.set(metric, { value, time: Date.now(), point });
    if (last && Math.abs(value - last.value) >= 150 && (Date.now() - last.time) < 10 * 60 * 1000) {
      addTimelineEvent({
        type: 'memory-change',
        severity: 'info',
        title: metric + (value > last.value ? ' increase' : ' drop'),
        message: `${metric}: ${Math.round(last.value)} MB → ${Math.round(value)} MB (${value > last.value ? '+' : ''}${Math.round(value - last.value)} MB)`,
        source: point.source,
        dedupeMs: 20000
      });
    }
    if (metric === 'Physical Memory' && value >= Number(memoryAlertConfig.physicalMemoryMB || Infinity)) {
      addTimelineEvent({ type: 'memory-threshold', severity: 'warning', title: 'Physical memory high', message: `${Math.round(value)} MB physical memory`, source: point.source, dedupeMs: 60000 });
    }
    const gc = gcAnalysis.analyzeGcPoint(point);
    if (gc.timelineEvent) addTimelineEvent(gc.timelineEvent);
    if (gc.incident) addIncident(gc.incident);
  }

  function evaluateMemoryAlerts(point) {
    if (!memoryAlertConfig.enabled) return;
    const metric = point.metric;
    const value = Number(point.valueMB || 0);
    if (metric === 'Physical Memory' && value >= Number(memoryAlertConfig.physicalMemoryMB || Infinity)) {
      addMemoryAlert('physical-high', 'warning', 'Physical Memory high', `${Math.round(value)} MB physical memory`, point);
    }
    if (metric === 'Unmanaged Memory' && value >= Number(memoryAlertConfig.unmanagedMemoryMB || Infinity)) {
      addMemoryAlert('unmanaged-high', 'warning', 'Unmanaged Memory high', `${Math.round(value)} MB unmanaged memory`, point);
    }
    if (metric === 'Managed Memory' && value >= Number(memoryAlertConfig.managedMemoryMB || Infinity)) {
      addMemoryAlert('managed-high', 'warning', 'Managed Memory high', `${Math.round(value)} MB managed memory`, point);
    }
    evaluateGrowthAlert(metric, point);
  }

  function addMemoryAlert(key, severity, title, message, point) {
    const dedupeKey = key + '|' + point.source;
    const now = Date.now();
    if (now - (memoryAlertDedup.get(dedupeKey) || 0) < alertDedupeMs) return;
    memoryAlertDedup.set(dedupeKey, now);
    addAlertEvent({ type: 'memory', severity, title, message, source: point.source, metric: point.metric, valueMB: Math.round(point.valueMB) });
    sendNotification(`${severity.toUpperCase()}: ${title}`, message, point.source || 'Memory');
  }

  function evaluateGrowthAlert(metric, point) {
    const growth = memoryTrends.evaluateGrowthAlert({ metric, point, memoryPoints, memoryAlertConfig });
    if (!growth) return;
    if (growth.alert) addMemoryAlert(growth.alert.key, growth.alert.severity, growth.alert.title, growth.alert.message, point);
    if (growth.incident) addIncident(growth.incident);
  }

  function findRoonProcesses() {
    return processMemoryMonitor.findRoonProcesses();
  }

  function selectBestRoonProcess(processes) {
    return processMemoryMonitor.selectBestRoonProcess(processes);
  }

  function refreshRuntimeProcessInfo(verbose = false) {
    const previousPid = runtimeProcessInfo && runtimeProcessInfo.pid;
    runtimeProcessInfo = selectBestRoonProcess(findRoonProcesses());
    if (verbose || (runtimeProcessInfo && runtimeProcessInfo.pid !== previousPid)) {
      if (runtimeProcessInfo) console.log(`Roon process for memory polling: PID ${runtimeProcessInfo.pid} (${runtimeProcessInfo.command})`);
      else console.log('Roon process for memory polling: not found. Log-based memory points may still appear if Roon emits [stats] lines.');
    }
    return runtimeProcessInfo;
  }

  function startProcessMemoryPolling() {
    if (!memoryWindowEnabled || !processMemoryPollingEnabled) return;
    if (processMemoryTimer) return;
    if (!platformAdapter.isLinux) return;
    pollProcessMemory();
    processMemoryTimer = setInterval(pollProcessMemory, processMemoryPollIntervalMs);
  }

  function pollProcessMemory() {
    const proc = runtimeProcessInfo || refreshRuntimeProcessInfo(false);
    if (!proc) {
      refreshRuntimeProcessInfo(false);
      return;
    }
    const sample = readLinuxProcMemory(proc.pid);
    if (!sample) {
      runtimeProcessInfo = null;
      refreshRuntimeProcessInfo(true);
      return;
    }
    addProcessMemoryPoints(proc, sample);
  }

  function readLinuxProcMemory(pid) {
    return processMemoryMonitor.readLinuxProcMemory(pid);
  }

  function addProcessMemoryPoints(proc, sample) {
    const nowIso = new Date().toISOString();
    const defs = [
      ['Physical Memory', sample.VmRSS],
      ['Virtual Memory', sample.VmSize],
      ['Data Memory', sample.VmData]
    ].filter(([, value]) => Number.isFinite(value));
    if (defs.length === 0) return;
    const sequence = ++memoryLineSequence;
    const correlationBefore = snapshotMemoryMetrics();
    const samples = [];
    for (const [metric, valueMB] of defs) {
      const point = {
        time: nowIso,
        receivedAt: nowIso,
        phase: 'live',
        sequence,
        metric,
        valueMB: Number(valueMB.toFixed(2)),
        source: `process/${proc.pid}`,
        gcRuntimePercent: null,
        gcPauseMs: null,
        line: `Linux /proc memory sample from ${proc.command}`.slice(0, 500)
      };
      metricsStore.pushBounded(memoryPoints, point, memoryHistoryMaxPoints);
      samples.push({ metric, valueMB: point.valueMB });
      recordMemoryTimeline(point);
      broadcastMemoryPoint(point);
      evaluateMemoryAlerts(point);
    }
    detectMemoryIncreaseCorrelation(samples, correlationBefore, {
      time: nowIso,
      receivedAt: nowIso,
      source: `process/${proc.pid}`,
      line: `Linux /proc memory sample from ${proc.command}`.slice(0, 500),
      sequence,
      gcRuntimePercent: null,
      gcPauseMs: null
    });
  }

  function extractGcInfo(line) {
    const text = String(line || '');
    const runtime =
      text.match(/([0-9]+(?:\.[0-9]+)?)%\s+of\s+runtime\s+in\s+GC\s+pauses/i) ||
      text.match(/GC\s+pauses?[^0-9]{0,40}([0-9]+(?:\.[0-9]+)?)\s*%/i);
    const pause =
      text.match(/([0-9]+(?:\.[0-9]+)?)\s*ms\s+last\s+GC\s+pause(?:\s+duration)?/i) ||
      text.match(/([0-9]+(?:\.[0-9]+)?)\s*ms\s+GC\s+pause/i) ||
      text.match(/last\s+GC\s+pause[^0-9]{0,40}([0-9]+(?:\.[0-9]+)?)\s*ms/i) ||
      text.match(/GC\s+pause[^0-9]{0,40}([0-9]+(?:\.[0-9]+)?)\s*ms/i);
    return {
      gcRuntimePercent: runtime ? Number(runtime[1]) : null,
      gcPauseMs: pause ? Number(pause[1]) : null
    };
  }

  function extractMemorySamples(line) {
    const text = String(line);
    const lower = text.toLowerCase();
    const memoryKeywords = [
      '[stats]', 'mem', 'memory', 'rss', 'resident', 'working set', 'workingset', 'private bytes',
      'heap', 'virtual', 'physical', 'managed', 'unmanaged', 'vm', 'gc', 'alloc', 'allocated'
    ];

    if (!memoryKeywords.some(keyword => lower.includes(keyword))) return [];

    const samples = [];
    const usedKeys = new Set();

    if (lower.includes('[stats]')) {
      const statsPatterns = [
        ['Virtual Memory', /(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|gb|gib)\s+Virtual\b/i],
        ['Physical Memory', /(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|gb|gib)\s+Physical\b/i],
        ['Managed Memory', /(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|gb|gib)\s+Managed\b/i],
        ['Unmanaged Memory', /(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|gb|gib)\s+(?:estimated\s+)?Unmanaged\b/i]
      ];
      for (const [metric, re] of statsPatterns) {
        const m = text.match(re);
        if (m) addSample(samples, usedKeys, metric, Number(m[1]), m[2]);
      }
      if (samples.length > 0) return samples;
    }

    const labelled = /\b(memory|mem|rss|resident|working\s*set|workingset|private\s*bytes|heap(?:\s*used)?|virtual|physical|managed|unmanaged|vm|allocated|alloc)\b[^\d\n\r]{0,24}(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|gb|gib)\b/gi;
    let match;
    while ((match = labelled.exec(text)) !== null) {
      addSample(samples, usedKeys, normaliseMetric(match[1]), Number(match[2]), match[3]);
    }

    const reverseLabelled = /(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|gb|gib)\b[^a-zA-Z\n\r]{0,24}(?:estimated\s+)?\b(memory|mem|rss|resident|working\s*set|workingset|private\s*bytes|heap(?:\s*used)?|virtual|physical|managed|unmanaged|vm|allocated|alloc)\b/gi;
    while ((match = reverseLabelled.exec(text)) !== null) {
      addSample(samples, usedKeys, normaliseMetric(match[3]), Number(match[1]), match[2]);
    }

    if (samples.length === 0) {
      const genericUnits = /(\d+(?:\.\d+)?)\s*(kb|kib|mb|mib|gb|gib)\b/gi;
      while ((match = genericUnits.exec(text)) !== null) {
        addSample(samples, usedKeys, 'Memory', Number(match[1]), match[2]);
      }
    }

    return samples;
  }

  function addSample(samples, usedKeys, metric, value, unit) {
    if (!Number.isFinite(value)) return;
    const valueMB = memoryAnalysis.toMB(value, unit);
    if (!memorySampler.isUsableSample({ mb: valueMB }) || valueMB <= 0) return;

    const key = `${metric}|${Math.round(valueMB * 100) / 100}`;
    if (usedKeys.has(key)) return;
    usedKeys.add(key);
    samples.push({ metric, valueMB });
  }

  function normaliseMetric(metric) {
    const m = String(metric).toLowerCase().replace(/\s+/g, ' ').trim();
    if (m.includes('rss') || m.includes('resident')) return 'Resident / RSS';
    if (m.includes('working')) return 'Working Set';
    if (m.includes('private')) return 'Private Bytes';
    if (m.includes('heap')) return 'Heap Used';
    if (m === 'vm' || m.includes('virtual')) return 'Virtual Memory';
    if (m.includes('physical')) return 'Physical Memory';
    if (m.includes('unmanaged')) return 'Unmanaged Memory';
    if (m.includes('managed')) return 'Managed Memory';
    if (m.includes('alloc')) return 'Allocated';
    return 'Memory';
  }

  function extractLogClockDisplay(line) {
    const text = String(line || '');
    const local = text.match(/\[Local\s+\d{2}\/\d{2}\s+(\d{2}:\d{2}:\d{2})\]/i);
    if (local) return local[1];
    const monthDayTime = text.match(/\b\d{2}\/\d{2}\s+(\d{2}:\d{2}:\d{2})\b/);
    if (monthDayTime) return monthDayTime[1];
    const iso = text.match(/\b\d{4}-\d{2}-\d{2}[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/);
    if (iso) return iso[1];
    return null;
  }

  function extractLogTimestamp(line) {
    const text = String(line);
    const monthDayTime = text.match(/\b(\d{2})\/(\d{2})\s+(\d{2}:\d{2}:\d{2})\b/);
    if (monthDayTime) {
      const year = new Date().getFullYear();
      const month = Number(monthDayTime[1]);
      const day = Number(monthDayTime[2]);
      const [hh, mm, ss] = monthDayTime[3].split(':').map(Number);
      const date = new Date(year, month - 1, day, hh, mm, ss);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }

    const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/);
    if (isoMatch) {
      const date = new Date(isoMatch[0].replace(' ', 'T'));
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }

    return null;
  }

  function toMB(value, unit) {
    return memoryAnalysis.toMB(value, unit);
  }

  return {
    collectMemoryData,
    findRoonProcesses,
    selectBestRoonProcess,
    refreshRuntimeProcessInfo,
    startProcessMemoryPolling,
    extractGcInfo,
    extractMemorySamples,
    extractLogClockDisplay,
    extractLogTimestamp,
    toMB,
    getRuntimeProcessInfo: () => runtimeProcessInfo,
    getMemoryStatsLinesDetected: () => memoryStatsLinesDetected,
    getDebugState: () => ({
      memoryStatsLinesDetected,
      memoryLineSequence,
      memoryCorrelationSequence,
      lastMemoryMetrics: lastMemorySnapshotByMetric.size,
      correlationDedupeKeys: memoryCorrelationDedup.size,
      alertDedupeKeys: memoryAlertDedup.size,
      processMemoryPollingActive: Boolean(processMemoryTimer)
    })
  };
}

module.exports = { createMemoryRuntimeService };
