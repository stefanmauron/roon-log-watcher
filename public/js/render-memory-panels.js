/* Roon Log Watcher memory panel facade.
   v8.69 introduces an explicit module boundary for memory-panel rendering. Heavy chart drawing remains in frontend.js for compatibility and will be the next safe extraction target. */
(function(){
  function renderMemorySummary(ctx){
    if(ctx && typeof ctx.renderAnalysis === 'function') return ctx.renderAnalysis(ctx.points || []);
  }
  function renderLatestValues(ctx){
    if(ctx && typeof ctx.renderLatest === 'function') return ctx.renderLatest(ctx.points || []);
  }
  window.RLWRenderMemoryPanels = { renderMemorySummary: renderMemorySummary, renderLatestValues: renderLatestValues };
})();
