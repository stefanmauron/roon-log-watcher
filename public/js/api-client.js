/* Roon Log Watcher dashboard API client.
   v8.65 normalizes API responses here so renderers receive one stable data contract. */
(function(window){
  'use strict';
  function readConfig(){ return window.__RLW_DASHBOARD_CONFIG__ || {}; }
  function dashboardPort(){
    var cfg = readConfig();
    return Number(cfg.port || window.location.port || 0) || 17666;
  }
  function apiUrl(path){
    return window.location.protocol + '//' + window.location.hostname + ':' + dashboardPort() + path;
  }
  function normalize(path, data){
    if((path === '/data' || path.indexOf('/api/memory') === 0) && window.RLWDataContract && window.RLWDataContract.normalize){
      return window.RLWDataContract.normalize(data);
    }
    return data;
  }
  function fetchJson(path){
    return fetch(apiUrl(path), { cache: 'no-store' }).then(function(response){
      if(!response.ok) throw new Error('HTTP ' + response.status + ' from ' + path);
      return response.json();
    }).then(function(data){ return normalize(path, data); });
  }
  window.RLWApiClient = {
    dashboardPort: dashboardPort,
    apiUrl: apiUrl,
    fetchJson: fetchJson,
    fetchMemorySnapshot: function(){ return fetchJson('/api/memory?nocache=' + Date.now()); }
  };
})(window);
