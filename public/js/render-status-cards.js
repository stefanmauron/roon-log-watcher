/* Roon Log Watcher status-card facade.
   v8.69 keeps top-card rendering in a named module so frontend.js only orchestrates rendering. */
(function(){
  function renderHealthCards(data, ctx){
    if(window.RLWRenderHealth && window.RLWRenderHealth.renderHealth){
      return window.RLWRenderHealth.renderHealth(data, ctx || {});
    }
  }
  function renderStatusCard(label, value, cls, note, ctx){
    if(window.RLWRenderHealth && window.RLWRenderHealth.healthCard){
      return window.RLWRenderHealth.healthCard(label, value, cls, note, ctx || {});
    }
    var esc = ctx && ctx.esc ? ctx.esc : function(v){ return String(v == null ? '' : v); };
    return '<div class="health ' + esc(cls || '') + '"><div>' + esc(label) + '</div><b>' + esc(value) + '</b><small>' + esc(note || '') + '</small></div>';
  }
  window.RLWRenderStatusCards = { renderHealthCards: renderHealthCards, renderStatusCard: renderStatusCard };
})();
