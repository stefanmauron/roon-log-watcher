/* Roon Log Watcher UI interaction wiring.
   v8.69 moves resize, metric filter, GC toggle and polling bootstrap out of frontend.js. */
(function(){
  function bindMetricInputs(selector, handler){
    if(window.RLWDomBindings && window.RLWDomBindings.bindAll){
      window.RLWDomBindings.bindAll(selector, 'change', handler);
      return;
    }
    var inputs = document.querySelectorAll ? document.querySelectorAll(selector) : [];
    for(var i=0; i<inputs.length; i++) inputs[i].onchange = handler;
  }
  function schedulePolling(intervalMs, requestFn){
    if(window.RLWDashboardController && window.RLWDashboardController.schedule){
      window.RLWDashboardController.schedule(intervalMs || 1000, function(){ setTimeout(requestFn, 50); });
      return;
    }
    setTimeout(requestFn, 50);
    setInterval(requestFn, intervalMs || 1000);
  }
  function initDashboardInteractions(opts){
    opts = opts || {};
    var requestFn = opts.requestMemory;
    if(typeof requestFn !== 'function') return;
    window.addEventListener('resize', requestFn);
    if(opts.showGcEl){
      opts.showGcEl.onchange = function(){
        if(typeof opts.saveUiSetting === 'function') opts.saveUiSetting('showGcMarkers', !!opts.showGcEl.checked);
        if(typeof opts.renderLastData === 'function') opts.renderLastData(); else requestFn();
      };
    }
    bindMetricInputs('input[data-metric]', function(){ if(typeof opts.renderLastData === 'function') opts.renderLastData(); else requestFn(); });
    schedulePolling(opts.intervalMs || 1000, requestFn);
  }
  window.RLWUiInteractions = { bindMetricInputs: bindMetricInputs, schedulePolling: schedulePolling, initDashboardInteractions: initDashboardInteractions };
})();
