/* Persistent dashboard UI state helpers.
   Kept separate from rendering code so panel open/closed behaviour and localStorage keys stay consistent. */
(function(window){
  'use strict';
  var KEY = 'roonLogWatcherUiSettings';
  function load(){
    try { return JSON.parse(window.localStorage.getItem(KEY) || '{}'); }
    catch (_) { return {}; }
  }
  function save(key, value){
    try {
      var settings = load();
      settings[key] = value;
      window.localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (_) {}
  }
  window.RLWUiState = { key: KEY, load: load, save: save };
})(window);
