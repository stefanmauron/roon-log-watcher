/* Shared log/event formatting helpers.
   v8.65 keeps formatting separate from section renderers so log, incident, playback and timeline UI can reuse the same small helpers. */
(function(window){
  'use strict';
  function avg(values){
    var nums = [];
    for(var i=0;i<(values||[]).length;i++){ var n = Number(values[i]); if(isFinite(n)) nums.push(n); }
    if(!nums.length) return null;
    var sum = 0; for(var j=0;j<nums.length;j++) sum += nums[j];
    return sum / nums.length;
  }
  function fmtMs(v){
    if(v == null || !isFinite(Number(v))) return '-';
    v = Math.max(0, Math.round(Number(v)));
    return v >= 1000 ? (Math.round(v / 100) / 10) + 's' : v + 'ms';
  }
  function fmtUs(v){
    if(v == null || !isFinite(Number(v))) return '-';
    v = Math.max(0, Math.round(Number(v)));
    return v >= 1000 ? (Math.round(v / 100) / 10) + 'ms' : v + 'µs';
  }
  function fmtDurationMs(v){
    v = Number(v || 0);
    if(!isFinite(v) || v <= 0) return '-';
    var sec = Math.round(v / 1000);
    if(sec < 60) return sec + 's';
    var min = Math.floor(sec / 60);
    var rest = sec % 60;
    return min + 'm ' + rest + 's';
  }

  window.RLWLogFormatters = { avg:avg, fmtMs:fmtMs, fmtUs:fmtUs, fmtDurationMs:fmtDurationMs };
})(window);
