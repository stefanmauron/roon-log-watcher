/* Shared browser-side formatting helpers for dashboard renderers. */
(function(window){
  'use strict';
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  function number(value){ var x = Number(value); return isFinite(x) ? x : 0; }
  function fmtNumber(value){ var x = Number(value); return isFinite(x) ? String(Math.round(x)) : '-'; }
  function fmtMB(value){ return fmtNumber(value) + ' MB'; }
  function fmtRate(value){ if(value == null || !isFinite(value)) return '-'; var sign = value > 0 ? '+' : ''; return sign + Math.round(value) + ' MB/h'; }
  function pad2(value){ value = Number(value); return (value < 10 ? '0' : '') + String(value); }
  window.RLWRenderUtils = { esc: esc, n: number, fmtNumber: fmtNumber, fmtMB: fmtMB, fmtRate: fmtRate, pad2: pad2 };
})(window);
