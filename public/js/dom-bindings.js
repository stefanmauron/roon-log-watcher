/* DOM binding helpers.
   v8.59 introduces a dedicated home for dashboard event-listener wiring so
   future button, panel and checkbox handling can move out of frontend.js. */
(function(window){
  'use strict';
  function bindAll(selector, eventName, handler){
    var nodes = document.querySelectorAll ? document.querySelectorAll(selector) : [];
    for(var i=0;i<nodes.length;i++) nodes[i].addEventListener(eventName, handler);
    return nodes.length;
  }
  window.RLWDomBindings = { bindAll: bindAll };
})(window);
