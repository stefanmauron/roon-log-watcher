'use strict';

function createPlaybackSessionService(deps) {
  const playbackSessions = deps.playbackSessions;
  const activePlaybackSessions = deps.activePlaybackSessions;
  const playbackMaxSessions = deps.playbackMaxSessions;
  const cleanEndpointDisplayName = deps.cleanEndpointDisplayName;
  const extractZoneFromLine = deps.extractZoneFromLine;
  const extractTrackFromLine = deps.extractTrackFromLine;
  const getPlaybackSource = deps.getPlaybackSource;
  const isUserFacingZone = deps.isUserFacingZone;
  const isBenignStreamingCacheActivity = deps.isBenignStreamingCacheActivity;
  const recoverIncidentLifecyclesForZone = deps.recoverIncidentLifecyclesForZone;
  const addTimelineEvent = deps.addTimelineEvent;
  let playbackSessionSequence = Number(deps.initialSequence || 0);

  function extractSignalFromLine(line) {
    const text = String(line || '');
    const m = text.match(/\[([^\]]*?)\s*,\s*([^\]]+?=>[^\]]+?)\]\s*\[[0-9]+%\s+buf\]/i);
    if (m) return { quality: m[1].trim(), format: m[2].trim() };
    const q = text.match(/SignalPath Quality\s*=\s*(.+)$/i);
    if (q) return { quality: q[1].trim(), format: '' };
    return null;
  }

  function getOrCreatePlaybackSession(zone, source, reason) {
    const key = cleanEndpointDisplayName(zone);
    let session = activePlaybackSessions.get(key);
    const now = Date.now();
    if (!session || session.completed || (now - new Date(session.updatedAt).getTime()) > 10 * 60 * 1000) {
      playbackSessionSequence += 1;
      session = {
        id: 'ps-' + playbackSessionSequence,
        sequence: playbackSessionSequence,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        zone: key,
        track: '',
        artist: '',
        sourceService: '',
        quality: '',
        format: '',
        state: 'starting',
        severity: 'info',
        health: 'healthy',
        durationMs: null,
        startLatencyMs: null,
        bufferingAt: null,
        readyAt: null,
        playingAt: null,
        events: [],
        eventCount: 0,
        source: source || '',
        lastLine: '',
        summary: reason || 'Playback session started'
      };
      activePlaybackSessions.set(key, session);
      playbackSessions.push(session);
      if (playbackSessions.length > playbackMaxSessions) playbackSessions.splice(0, playbackSessions.length - playbackMaxSessions);
    }
    return session;
  }

  function updatePlaybackSession(session, eventName, line, patch) {
    Object.assign(session, patch || {});
    session.updatedAt = new Date().toISOString();
    session.lastLine = String(line || '').slice(0, 260);
    session.eventCount += 1;
    if (eventName) {
      session.events.push({ time: session.updatedAt, name: eventName, line: String(line || '').slice(0, 220) });
      if (session.events.length > 30) session.events.splice(0, session.events.length - 30);
    }
  }

  function completePlaybackSession(session, line, reason) {
    if (!session || session.completedAt) return;
    session.completedAt = new Date().toISOString();
    session.updatedAt = session.completedAt;
    session.state = session.state || 'completed';
    session.durationMs = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
    if (session.playingAt) session.startLatencyMs = new Date(session.playingAt).getTime() - new Date(session.startedAt).getTime();
    session.summary = buildPlaybackSummary(session, reason);
    session.health = session.severity === 'warning' || session.severity === 'critical' ? 'review' : 'healthy';
    recoverIncidentLifecyclesForZone(session.zone, 'Playback session completed');
    addTimelineEvent({
      type: 'playback-session',
      severity: session.health === 'healthy' ? 'info' : 'warning',
      title: session.health === 'healthy' ? 'Playback session completed' : 'Playback session needs review',
      message: session.summary,
      source: session.source || '',
      dedupeMs: 1000
    });
  }

  function buildPlaybackSummary(session, reason) {
    const parts = [];
    if (isUserFacingZone(session.zone)) parts.push(session.zone);
    if (session.track) parts.push(session.artist ? session.track + ' – ' + session.artist : session.track);
    if (session.sourceService) parts.push(session.sourceService);
    if (session.quality || session.format) parts.push([session.quality, session.format].filter(Boolean).join(' · '));
    if (session.startLatencyMs != null) parts.push('start ' + Math.max(0, Math.round(session.startLatencyMs)) + 'ms');
    if (reason) parts.push(reason);
    return parts.join(' · ');
  }

  function detectPlaybackSession(file, line) {
    const text = String(line || '');
    const lower = text.toLowerCase();
    const source = getPlaybackSource(file, text);
    const zone = extractZoneFromLine(text);
    const isPlaybackRelated = /starting playback|\[playing\s+@|\[loading\s+@|\[stopped\s+@|startstream|state changed:.*(buffering|ready|playing|prepared)|onplayfeedback\s+(playing|stopped)|playing:\s*https?:|queueing:\s*https?:|reportstreaming(start|end)|\[raat\/tcpaudiosource\]|_advance \(track\)|\[zone .*?\] next\b|all streams were disposed|signalpath quality/i.test(text);
    if (!isPlaybackRelated) return;
    if (!isUserFacingZone(zone)) return;

    const session = getOrCreatePlaybackSession(zone, source, 'Playback activity detected');

    if (/qobuz/i.test(text)) updatePlaybackSession(session, 'streaming source', text, { sourceService: 'Qobuz' });
    else if (/tidal/i.test(text)) updatePlaybackSession(session, 'streaming source', text, { sourceService: 'TIDAL' });
    else if (/playing:\s*https?:/i.test(text) || /queueing:\s*https?:/i.test(text)) updatePlaybackSession(session, 'stream url', text, { sourceService: session.sourceService || 'Streaming' });

    const track = extractTrackFromLine(text);
    if (track) updatePlaybackSession(session, 'track identified', text, { track: track.title, artist: track.artist });

    const signal = extractSignalFromLine(text);
    if (signal) updatePlaybackSession(session, 'signal path', text, { quality: signal.quality || session.quality, format: signal.format || session.format });

    if (/starting playback/i.test(text)) updatePlaybackSession(session, 'starting playback', text, { state: 'starting' });
    if (/startstream/i.test(text)) updatePlaybackSession(session, 'RAAT stream start', text, { state: 'streaming' });
    if (/state changed:.*prepared\s*=>\s*buffering/i.test(text) || /\{"status":"Buffering"\}/i.test(text)) updatePlaybackSession(session, 'buffering', text, { state: 'buffering', bufferingAt: new Date().toISOString() });
    if (/state changed:.*buffering\s*=>\s*ready/i.test(text) || /\{"status":"Ready"\}/i.test(text)) updatePlaybackSession(session, 'ready', text, { state: 'ready', readyAt: new Date().toISOString() });
    if (/state changed:.*ready\s*=>\s*playing/i.test(text) || /\{"status":"Playing"\}/i.test(text) || /onplayfeedback\s+playing/i.test(text) || /\[playing\s+@\s*0:0/i.test(lower)) {
      const nowIso = new Date().toISOString();
      updatePlaybackSession(session, 'playing', text, { state: 'playing', playingAt: session.playingAt || nowIso });
      completePlaybackSession(session, text, 'healthy');
    }
    if (/\[raat\/tcpaudiosource\]\s*connected/i.test(text)) updatePlaybackSession(session, 'tcp audio connected', text, { state: session.state || 'connected' });
    if (/\[raat\/tcpaudiosource\]\s*disconnecting/i.test(text)) updatePlaybackSession(session, 'tcp audio disconnecting', text, {});
    if (/onplayfeedback\s+stopped|\[stopped\s+@|all streams were disposed/i.test(text)) updatePlaybackSession(session, 'stopped/disposed', text, { state: 'stopped' });
    if (/\[zone .*?\] next\b|_advance \(track\)/i.test(text)) {
      completePlaybackSession(session, text, 'track advanced');
      activePlaybackSessions.delete(cleanEndpointDisplayName(zone));
    }

    if (/(timeout|timed out|failed|networkerror|unreachable|lost|drop|dropped)/i.test(text) && !isBenignStreamingCacheActivity(text)) {
      updatePlaybackSession(session, 'warning signal', text, { severity: 'warning', health: 'review' });
    }
  }

  return {
    extractSignalFromLine,
    getOrCreatePlaybackSession,
    updatePlaybackSession,
    completePlaybackSession,
    buildPlaybackSummary,
    detectPlaybackSession
  };
}

module.exports = { createPlaybackSessionService };
