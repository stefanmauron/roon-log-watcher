/* Roon Log Watcher dashboard controller helpers.
   v8.65 gives refresh-cycle timing and data normalization a dedicated namespace. */
(function(window){
  'use strict';
  function schedule(intervalMs, fn){
    if(typeof fn !== 'function') return null;
    fn();
    return window.setInterval(fn, intervalMs || 1000);
  }
  function dashboardPort(config){
    if(window.RLWApiClient && window.RLWApiClient.dashboardPort) return window.RLWApiClient.dashboardPort();
    config = config || window.__RLW_DASHBOARD_CONFIG__ || {};
    return Number(config.port || window.location.port || 0) || 17666;
  }
  function normalizeSnapshot(data){
    if(window.RLWDataContract && window.RLWDataContract.normalize) return window.RLWDataContract.normalize(data);
    return data;
  }
  function createRefreshLoop(options){
    options = options || {};
    var intervalMs = Number(options.intervalMs || 1000);
    var load = options.load;
    var render = options.render;
    var onError = options.onError;
    var busy = false;
    function tick(){
      if(busy || typeof load !== 'function' || typeof render !== 'function') return;
      busy = true;
      Promise.resolve().then(load).then(normalizeSnapshot).then(render).catch(function(err){
        if(typeof onError === 'function') onError(err);
      }).then(function(){ busy = false; });
    }
    tick();
    return window.setInterval(tick, intervalMs);
  }
  window.RLWDashboardController = {
    schedule: schedule,
    dashboardPort: dashboardPort,
    normalizeSnapshot: normalizeSnapshot,
    createRefreshLoop: createRefreshLoop
  };
})(window);
