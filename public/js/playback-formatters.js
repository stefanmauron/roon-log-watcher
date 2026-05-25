/* Shared helpers for playback and zone renderer modules.
   v8.66 keeps formatting dependencies consistent across split playback UI modules. */
(function(window){
  'use strict';
  var fmt = window.RLWLogFormatters || {};
  window.RLWPlaybackFormatters = {
    avg: fmt.avg || function(){ return null; },
    fmtMs: fmt.fmtMs || function(){ return '-'; },
    fmtUs: fmt.fmtUs || function(){ return '-'; }
  };
})(window);
