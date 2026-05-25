/* Roon Log Watcher error-state helpers.
   v8.69 extracts browser error reporting from the main frontend entrypoint. */
(function(){
  function installGlobalErrorHandler(statusId){
    window.onerror = function(message, source, lineno, colno, error){
      var el = document.getElementById(statusId || 'status');
      if (el) el.textContent = 'JavaScript error: ' + message + ' at line ' + lineno + ':' + colno;
      return false;
    };
  }
  function setStatus(el, text){ if(el && el.textContent !== String(text)) el.textContent = String(text); }
  function setWatcherStopped(statusEl, bottomSessionInfoEl, reason){
    var msg = 'Monitoring Runtime State: watcher stopped / connection lost';
    if(reason) msg += ' — ' + reason;
    msg += ' • last values may be stale';
    setStatus(bottomSessionInfoEl, msg);
    setStatus(statusEl, msg);
  }
  window.RLWErrorState = { installGlobalErrorHandler: installGlobalErrorHandler, setStatus: setStatus, setWatcherStopped: setWatcherStopped };
})();
