'use strict';

// Runtime Behaviour Intelligence correlation classifier.
// Input: recent log lines around a meaningful memory step.
// Output: a human-readable suspected cause with confidence and short evidence snippets.
// This is intentionally heuristic: it explains where to look first, not a guaranteed root cause.
function inferMemoryCorrelationCause(logs = [], currentLine = '') {
  const text = logs.map(l => l.text || '').concat([currentLine || '']).join('\n').toLowerCase();
  const evidence = [];
  function collect(pattern, max = 3) {
    for (const l of logs) {
      const line = String(l.text || '');
      if (pattern.test(line) && evidence.length < max) evidence.push(line.slice(0, 220));
    }
  }

  if (/(client connected|initialized fresh session|remoting\/brokerserver|serverconnectionv2|roon api|distributedbroker)/i.test(text)) {
    collect(/client connected|initialized fresh session|remoting\/brokerserver|serverconnectionv2|distributedbroker/i);
    return { category: 'Client / remote connection', title: 'Client connection activity detected', confidence: 'high', explanation: 'A Roon client or remote session was active shortly before the memory increase. Additional session state, UI data and caches may remain allocated after the client disconnects.', evidence };
  }
  if (/(library stats|library\/|endmutation|metadata\/albumdetails|album details|tracks:|performances:)/i.test(text)) {
    collect(/library stats|library\/|endmutation|metadata\/albumdetails|album details/i);
    return { category: 'Library / metadata', title: 'Library or metadata activity detected', confidence: 'high', explanation: 'Library mutations or metadata screen generation occurred near the memory step. Metadata objects, browse state or cached library structures may explain retained memory.', evidence };
  }
  if (/(imagecache|getimagedata|artwork|thumbnail|cover\/|avatar\/)/i.test(text)) {
    collect(/imagecache|getimagedata|artwork|thumbnail|cover\/|avatar\//i);
    return { category: 'Image / artwork cache', title: 'Image cache generation detected', confidence: 'medium', explanation: 'Artwork or image cache activity occurred near the memory step. This often increases memory during browsing or playback UI updates.', evidence };
  }
  if (/(qobuz|tidal|ftmsi-b|filecache|streaming-|getfileurl|reportstreamingstart|prebuffer)/i.test(text)) {
    collect(/qobuz|tidal|ftmsi-b|filecache|getfileurl|reportstreamingstart|prebuffer/i);
    return { category: 'Streaming / cache', title: 'Streaming/cache activity detected', confidence: 'medium', explanation: 'Streaming cache, prebuffering or Qobuz/Tidal requests were active near the memory increase. This is often normal, but retained cache structures can explain a higher plateau.', evidence };
  }
  if (/(startstream|raatclient|tcpaudiosource|endpoint .*state changed|buffering|ready => playing|playing @)/i.test(text)) {
    collect(/startstream|raatclient|tcpaudiosource|endpoint .*state changed|buffering|ready => playing|playing @/i);
    return { category: 'Playback / RAAT', title: 'Playback transition detected', confidence: 'medium', explanation: 'Playback and endpoint negotiation events occurred near the memory increase. Some stream, DSP and endpoint state can remain allocated after the transition.', evidence };
  }
  if (/(\[stats\]|gc pauses|last gc pause|dbperf)/i.test(text)) {
    collect(/\[stats\]|gc pauses|last gc pause|dbperf/i);
    return { category: 'Runtime / GC', title: 'Runtime memory step detected', confidence: 'low', explanation: 'A memory step was detected, but nearby logs mainly contain runtime statistics. No clear functional trigger was found in the recent log window.', evidence };
  }
  return { category: 'Unknown', title: 'Memory increase without clear log cause', confidence: 'low', explanation: 'The memory graph shows a meaningful step, but no strong matching Roon event was found in the recent logs.', evidence };
}

module.exports = { inferMemoryCorrelationCause };
