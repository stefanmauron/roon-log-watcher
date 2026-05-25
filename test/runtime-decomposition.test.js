'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zoneStateServiceFactory = require('../lib/zone-state-service');
const playbackSessionServiceFactory = require('../lib/playback-session-service');

function createServices() {
  const zoneStats = new Map();
  const timeline = [];
  const recovered = [];
  const zoneService = zoneStateServiceFactory.createZoneStateService({
    zoneStats,
    zoneMaxItems: 10,
    isBenignPlaybackRaatDisconnect: () => false,
    recoverIncidentLifecyclesForZone: (zone, reason) => recovered.push({ zone, reason }),
    trimLine: value => String(value).replace(/\s+/g, ' ').trim(),
    pushLimited(arr, value, max) { arr.push(value); if (arr.length > max) arr.splice(0, arr.length - max); },
    averageNumber(arr) { return arr && arr.length ? arr.reduce((sum, v) => sum + Number(v || 0), 0) / arr.length : null; }
  });
  const playbackSessions = [];
  const activePlaybackSessions = new Map();
  const playbackService = playbackSessionServiceFactory.createPlaybackSessionService({
    playbackSessions,
    activePlaybackSessions,
    playbackMaxSessions: 10,
    cleanEndpointDisplayName: zoneService.cleanEndpointDisplayName,
    extractZoneFromLine: zoneService.extractZoneFromLine,
    extractTrackFromLine: zoneService.extractTrackFromLine,
    getPlaybackSource: zoneService.getPlaybackSource,
    isUserFacingZone: zoneService.isUserFacingZone,
    isBenignStreamingCacheActivity: () => false,
    recoverIncidentLifecyclesForZone: (zone, reason) => recovered.push({ zone, reason }),
    addTimelineEvent: event => timeline.push(event)
  });
  return { zoneService, playbackService, zoneStats, playbackSessions, activePlaybackSessions, timeline, recovered };
}

test('zone state service extracts user-facing zone and updates playback state', () => {
  const { zoneService, zoneStats } = createServices();
  const line = 'Info: [zone Living Room] state changed: ready => playing';
  assert.equal(zoneService.extractZoneFromLine(line), 'Living Room');
  zoneService.updateZoneStatsFromLine('/tmp/RoonServer_log.txt', line);
  assert.equal(zoneStats.get('Living Room').state, 'playing');
});

test('playback session service completes a healthy playing session', () => {
  const { playbackService, playbackSessions, timeline } = createServices();
  playbackService.detectPlaybackSession('/tmp/RoonServer_log.txt', 'Info: [zone Living Room] starting playback');
  playbackService.detectPlaybackSession('/tmp/RoonServer_log.txt', 'Info: [PLAYING @ 0:00/3:10] Song Title - Artist Name zone=Living Room');
  assert.equal(playbackSessions.length, 1);
  assert.equal(playbackSessions[0].completedAt !== null, true);
  assert.equal(playbackSessions[0].health, 'healthy');
  assert.equal(timeline.some(e => e.type === 'playback-session'), true);
});
