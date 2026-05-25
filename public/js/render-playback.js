/* Playback facade.
   v8.66 keeps the existing RLWRenderPlayback API while implementation lives in smaller modules. */
(function(window){
  'use strict';
  var playback = window.RLWRenderPlaybackEvents || {};
  var zones = window.RLWRenderZoneEvents || {};
  var metrics = window.RLWRenderPlaybackMetrics || {};
  window.RLWRenderPlayback = {
    renderPlaybackSessions: playback.renderPlaybackSessions || function(){},
    renderZones: zones.renderZones || function(){},
    renderPerformanceMetrics: metrics.renderPerformanceMetrics || function(){}
  };
})(window);
