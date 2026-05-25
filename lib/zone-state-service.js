'use strict';

function createZoneStateService(deps) {
  const zoneStats = deps.zoneStats;
  const zoneMaxItems = deps.zoneMaxItems;
  const isBenignPlaybackRaatDisconnect = deps.isBenignPlaybackRaatDisconnect;
  const recoverIncidentLifecyclesForZone = deps.recoverIncidentLifecyclesForZone;
  const trimLine = deps.trimLine;
  const pushLimited = deps.pushLimited;
  const averageNumber = deps.averageNumber;

  function normalizeZoneName(value) {
    return String(value || '').replace(/^[\s"']+|[\s"']+$/g, '').replace(/\s+/g, ' ').trim() || 'Unknown zone';
  }

  function isInternalOrUnknownZone(value) {
    const z = normalizeZoneName(value).toLowerCase();
    return !z || z === 'unknown zone' || z === 'audio/env' || z === 'env' || z === 'audio' || z === 'device' || z === 'local' || z === 'core';
  }

  function cleanEndpointDisplayName(value) {
    let z = normalizeZoneName(value);
    z = z.replace(/^zone\s+/i, '').replace(/^endpoint\s+/i, '').replace(/^raat\s+/i, '').trim();
    return z || 'Unknown zone';
  }

  function isUserFacingZone(value) {
    return !isInternalOrUnknownZone(value);
  }

  function getPlaybackSource(file, line) {
    const text = String(line || '');
    if (/RoonServer/i.test(file || text)) return 'RoonServer';
    if (/RoonAppliance/i.test(file || text)) return 'RoonAppliance';
    return 'Roon';
  }

  function extractZoneFromLine(line) {
    const text = String(line || '');
    const patterns = [
      /\[zone\s+([^\]]+)\]/i,
      /zone[\s:=]+["']?([^,"'\]\)]+)["']?/i,
      /endpoint[\s:=]+["']?([^,"'\]\)]+)["']?/i,
      /\[(PLAYING|LOADING|STOPPED)\s+@\s*([^\]]+)\]/i
    ];
    for (const rx of patterns) {
      const m = text.match(rx);
      if (!m) continue;
      const value = rx.source.includes('PLAYING') ? m[2] : m[1];
      const cleaned = cleanEndpointDisplayName(value);
      if (cleaned) return cleaned;
    }
    return 'Unknown zone';
  }

  function getOrCreateZoneStats(zone) {
    const key = cleanEndpointDisplayName(zone);
    let item = zoneStats.get(key);
    if (!item) {
      item = {
        zone: key,
        state: 'unknown',
        health: 'healthy',
        lastSeenAt: null,
        lastTrack: '',
        lastArtist: '',
        reconnects: 0,
        bufferingSamples: [],
        startLatencySamples: [],
        rttSamplesUs: [],
        incidentEvents: [],
        gcImpactEvents: 0,
        _bufferingStartedAt: null,
        _lastPlaybackStartedAt: null
      };
      zoneStats.set(key, item);
    }
    return item;
  }

  function extractTrackFromLine(line) {
    const text = String(line || '');
    const m = text.match(/\[(PLAYING|LOADING|STOPPED)\s+@[^\]]*\]\s+(.+)$/i);
    if (!m) return null;
    const full = m[2].trim();
    const parts = full.split(' - ');
    if (parts.length >= 2) {
      return { title: parts.slice(0, -1).join(' - ').trim(), artist: parts.slice(-1)[0].trim(), full };
    }
    return { title: full, artist: '', full };
  }

  function updateZoneStatsFromLine(file, line) {
    const text = String(line || '');
    const zone = extractZoneFromLine(text);
    if (!isUserFacingZone(zone)) return;
    const z = getOrCreateZoneStats(zone);
    const now = Date.now();
    z.lastSeenAt = new Date(now).toISOString();

    const track = extractTrackFromLine(text);
    if (track) {
      z.lastTrack = track.title;
      z.lastArtist = track.artist;
    }

    if (/starting playback/i.test(text)) {
      z.state = 'starting';
      z._lastPlaybackStartedAt = now;
    }

    if (/state changed:.*prepared\s*=>\s*buffering|\{"status":"Buffering"\}|\[loading\s+@/i.test(text)) {
      z.state = 'buffering';
      z._bufferingStartedAt = now;
    }

    if (/state changed:.*buffering\s*=>\s*ready|\{"status":"Ready"\}/i.test(text)) {
      if (z._bufferingStartedAt) pushLimited(z.bufferingSamples, Math.max(0, now - z._bufferingStartedAt), 30);
      z.state = 'ready';
      z._bufferingStartedAt = null;
      recoverIncidentLifecyclesForZone(zone, 'Endpoint reached Ready state');
    }

    if (/state changed:.*ready\s*=>\s*playing|\{"status":"Playing"\}|onplayfeedback\s+playing|\[playing\s+@/i.test(text)) {
      if (z._lastPlaybackStartedAt) pushLimited(z.startLatencySamples, Math.max(0, now - z._lastPlaybackStartedAt), 30);
      z.state = 'playing';
      z._lastPlaybackStartedAt = null;
      recoverIncidentLifecyclesForZone(zone, 'Endpoint reached Playing state');
    }

    if (/onplayfeedback\s+stopped|\[stopped\s+@|all streams were disposed/i.test(text)) z.state = 'stopped';

    if (/reconnect|transport lost|device lost|device disappeared|raat.*disconnect/i.test(text) && !isBenignPlaybackRaatDisconnect(text)) {
      z.reconnects += 1;
      z.health = 'review';
      pushLimited(z.incidentEvents, { time: new Date().toISOString(), severity: 'warning', message: trimLine(text).slice(0, 180) }, 50);
    }

    const rtt = text.match(/\brtt=(\d+)us\b/i);
    if (rtt) pushLimited(z.rttSamplesUs, Number(rtt[1]), 40);
  }

  function applyZoneMemoryImpact(samples, line) {
    if (!samples || !samples.length) return;
    const gcSample = samples.find(s => s.gcPauseMs != null || s.gcRuntimePercent != null);
    if (!gcSample) return;
    const pause = Number(gcSample.gcPauseMs || 0);
    const pct = Number(gcSample.gcRuntimePercent || 0);
    if (pause < 500 && pct < 10) return;
    for (const z of zoneStats.values()) {
      if (z.state === 'playing' || z.state === 'buffering') {
        z.gcImpactEvents += 1;
        if (pause > 2000 || pct > 20) z.health = 'review';
      }
    }
  }

  function getZoneSnapshot() {
    const now = Date.now();
    return Array.from(zoneStats.values()).map(z => {
      const lastSeenMs = z.lastSeenAt ? new Date(z.lastSeenAt).getTime() : 0;
      const ageSec = lastSeenMs ? Math.round((now - lastSeenMs) / 1000) : null;
      const avgBufferingMs = averageNumber(z.bufferingSamples);
      const avgStartLatencyMs = averageNumber(z.startLatencySamples);
      const avgRttUs = averageNumber(z.rttSamplesUs);
      const hourAgo = now - 60 * 60 * 1000;
      const recentIncidents = (z.incidentEvents || []).filter(e => new Date(e.time).getTime() >= hourAgo).length;
      let health = z.health || 'healthy';
      if (ageSec != null && ageSec > 300) health = 'idle';
      if (recentIncidents >= 3) health = 'review';
      return {
        zone: z.zone,
        health,
        state: z.state,
        lastSeenAt: z.lastSeenAt,
        ageSec,
        lastTrack: z.lastTrack,
        lastArtist: z.lastArtist,
        reconnects: z.reconnects || 0,
        avgBufferingMs: avgBufferingMs == null ? null : Math.round(avgBufferingMs),
        avgStartLatencyMs: avgStartLatencyMs == null ? null : Math.round(avgStartLatencyMs),
        avgRttUs: avgRttUs == null ? null : Math.round(avgRttUs),
        gcImpactEvents: z.gcImpactEvents || 0,
        incidentsLastHour: recentIncidents
      };
    }).sort((a,b) => {
      const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
      const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
      return bt - at;
    }).slice(0, zoneMaxItems);
  }

  return {
    normalizeZoneName,
    cleanEndpointDisplayName,
    isUserFacingZone,
    getPlaybackSource,
    extractZoneFromLine,
    extractTrackFromLine,
    updateZoneStatsFromLine,
    applyZoneMemoryImpact,
    getZoneSnapshot
  };
}

module.exports = { createZoneStateService };
