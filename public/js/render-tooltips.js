/* Dashboard tooltip registry.
   v8.59 moves human-readable explanations, formulas and derivation notes out of
   the main frontend controller so tooltip wording can be reviewed independently
   from rendering and polling logic. */
(function(window){
  'use strict';
  var INFO_TEXTS = {
    'Managed Memory':'Memory directly managed by the Roon/Mono runtime, mainly .NET objects. Formula: read latest Roon stats value labelled Managed and show it in MB. Trend derivation: take the first and latest live sample in the visible window, calculate latest − first, divide by elapsed hours, then show MB/hour after at least 5 minutes of data.',
    'Physical Memory':'Real RAM currently used by the Roon process as reported by Roon stats. Formula: read latest Physical Memory value in MB. Trend derivation: same method as the memory trend cards: latest live sample minus first live sample, normalized to MB/hour. Plausibility expectation: Physical should roughly align with Managed + Unmanaged, with normal measurement differences.',
    'Unmanaged Memory':'Memory outside the managed .NET heap, for example native libraries, buffers and audio/runtime components. Formula: read latest Roon stats value labelled estimated Unmanaged. Trend derivation: latest − first over the live observation window, divided by elapsed hours. A persistent positive trend can indicate growing native buffers or leak-like behaviour.',
    'Memory Trend':'Trend derivation: collect up to the latest 500 live samples for this metric, sort by receive time, ignore the trend until at least 5 minutes are available, then calculate (latest MB − first MB) / elapsed hours. The result is a rate in MB/hour, not a guaranteed future prediction.',
    'Managed Memory Trend':'Trend derivation: collect live Managed Memory samples, use first and latest sample in the current window, then calculate (latest MB − first MB) / elapsed hours. Shown only after the warm-up period so short startup noise is not overinterpreted.',
    'Physical Memory Trend':'Trend derivation: collect live Physical Memory samples, use first and latest sample in the current window, then calculate (latest MB − first MB) / elapsed hours. This estimates the current direction of real process RAM usage.',
    'Unmanaged Memory Trend':'Trend derivation: collect live Unmanaged Memory samples, use first and latest sample in the current window, then calculate (latest MB − first MB) / elapsed hours. A rising trend is a signal to observe whether native/audio buffers stabilize or continue growing.',
    'Plausibility Check':'Checks whether the memory numbers tell a consistent story. Formula: Managed + Unmanaged − Physical. Below about 100 MB is OK, 100–250 MB means Check, above 250 MB means Mismatch/review.',
    'GC Pressure':'GC means garbage collection: the runtime cleaning unused managed objects. Algorithm: look at the latest GC pause time and runtime-in-GC percentage from Roon stats. Score: +1/+2/+3 for pauses above 100/250/1000 ms and +1/+2/+3 for runtime-in-GC above 2.5/5/10%. Trend derivation: compare the first and latest GC sample; if pause rises by more than 50 ms or runtime-in-GC rises by more than 0.25 percentage points, show rising; if either falls by the same amount, show falling; otherwise stable.',
    'GC Trend':'Trend derivation: compare the first and latest GC samples in the current live window. Rising means GC pause increased by more than 50 ms or runtime-in-GC increased by more than 0.25 percentage points. Falling uses the same thresholds in the opposite direction. Stable means no relevant movement.',
    'Runtime Behaviour Intelligence':'High-level algorithm: scan recent memory growth, GC pressure and nearby runtime events; group related signals; count only suspicious patterns as flags. Trend/flag derivation: compare the previous and current Managed/Physical/Unmanaged samples, ignore small allocator noise, flag only if the biggest metric jump is at least 45 MB or the combined positive jump is at least 80 MB, then correlate the jump with log lines from the previous 4 minutes. It is a hint for investigation, not a guaranteed root cause.',
    'Roon Health Score':'High-level algorithm: start at 100 for the last hour, subtract weighted penalties for recent warnings, critical errors, alerts and correlated incidents, then clamp the result to 0–100. Higher means calmer logs.',
    'Log streams':'Counts active log files currently followed by tail -F. Formula: number of open live tail streams. If this is zero, the watcher is not receiving live Roon log input.',
    'Last log line':'Shows freshness of live log input. Formula: current time − timestamp of the newest log line seen by the watcher. A long silence can be normal when Roon is idle, but during playback you normally expect activity.',
    'Memory data':'Shows freshness and amount of runtime-only memory data. Formula: current time − newest memory sample; point count = number of memory samples collected since watcher start. Existing old log content is ignored.',
    'Web server':'Local dashboard server used by this tool. Algorithm: if the page/API are reachable on the shown port, the card is OK. It does not measure Roon health directly.'
  };
  function escapeFallback(value){
    return String(value == null ? '' : value).replace(/[&<>\"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
  }
  function infoIcon(key, alignRight, esc){
    var escape = esc || escapeFallback;
    var text = INFO_TEXTS[key] || key || 'Additional information about this dashboard element.';
    return '<span class="info-wrap' + (alignRight ? ' info-right' : '') + '"><span class="info-dot" tabindex="0">i</span><span class="info-tip">' + escape(text) + '</span></span>';
  }
  function labelWithInfo(label, esc){
    var escape = esc || escapeFallback;
    return '<span>' + escape(label) + '</span> ' + infoIcon(label, false, escape);
  }

  function getTipText(wrap){
    if(!wrap) return '';
    var tip = wrap.querySelector ? wrap.querySelector('.info-tip') : null;
    return tip ? (tip.textContent || '').trim() : '';
  }
  function ensureTooltipPortal(){
    var existing = document.getElementById('rlwTooltipPortal');
    if(existing) return existing;
    var portal = document.createElement('div');
    portal.id = 'rlwTooltipPortal';
    portal.className = 'rlw-tooltip-portal';
    portal.setAttribute('role', 'tooltip');
    portal.setAttribute('aria-hidden', 'true');
    portal.style.display = 'none';
    document.body.appendChild(portal);
    return portal;
  }
  function placeTooltip(portal, anchor, preferRight){
    var rect = anchor.getBoundingClientRect();
    var margin = 12;
    var gap = 10;
    portal.style.display = 'block';
    portal.style.left = '0px';
    portal.style.top = '0px';
    var width = Math.min(320, Math.max(220, window.innerWidth - (margin * 2)));
    portal.style.width = width + 'px';
    var height = portal.offsetHeight || 80;
    var left = preferRight ? rect.right - width : rect.left;
    if(left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
    if(left < margin) left = margin;
    var top = rect.bottom + gap;
    if(top + height > window.innerHeight - margin) top = rect.top - height - gap;
    if(top < margin) top = margin;
    var arrowLeft = Math.min(width - 24, Math.max(14, rect.left + rect.width / 2 - left - 5));
    portal.style.left = Math.round(left) + 'px';
    portal.style.top = Math.round(top) + 'px';
    portal.style.setProperty('--tip-arrow-left', Math.round(arrowLeft) + 'px');
  }
  function initFloatingTooltips(){
    if(!document.querySelectorAll) return;
    var portal = ensureTooltipPortal();
    var activeWrap = null;
    var hideTimer = null;
    function clearHide(){ if(hideTimer){ clearTimeout(hideTimer); hideTimer = null; } }
    function hideSoon(){ clearHide(); hideTimer = setTimeout(function(){
      portal.classList.remove('visible');
      portal.setAttribute('aria-hidden', 'true');
      portal.style.display = 'none';
      activeWrap = null;
    }, 80); }
    function show(wrap){
      var text = getTipText(wrap);
      if(!text) return;
      clearHide();
      activeWrap = wrap;
      portal.textContent = text;
      portal.setAttribute('aria-hidden', 'false');
      placeTooltip(portal, wrap.querySelector('.info-dot') || wrap, wrap.classList && wrap.classList.contains('info-right'));
      requestAnimationFrame(function(){ portal.classList.add('visible'); });
    }
    document.addEventListener('mouseover', function(ev){
      var wrap = ev.target && ev.target.closest ? ev.target.closest('.info-wrap') : null;
      if(wrap) show(wrap);
    });
    document.addEventListener('mouseout', function(ev){
      var wrap = ev.target && ev.target.closest ? ev.target.closest('.info-wrap') : null;
      if(wrap && (!ev.relatedTarget || !wrap.contains(ev.relatedTarget))) hideSoon();
    });
    document.addEventListener('focusin', function(ev){
      var wrap = ev.target && ev.target.closest ? ev.target.closest('.info-wrap') : null;
      if(wrap) show(wrap);
    });
    document.addEventListener('focusout', function(ev){
      var wrap = ev.target && ev.target.closest ? ev.target.closest('.info-wrap') : null;
      if(wrap) hideSoon();
    });
    portal.addEventListener('mouseenter', clearHide);
    portal.addEventListener('mouseleave', hideSoon);
    window.addEventListener('scroll', function(){ if(activeWrap) placeTooltip(portal, activeWrap.querySelector('.info-dot') || activeWrap, activeWrap.classList && activeWrap.classList.contains('info-right')); }, true);
    window.addEventListener('resize', function(){ if(activeWrap) placeTooltip(portal, activeWrap.querySelector('.info-dot') || activeWrap, activeWrap.classList && activeWrap.classList.contains('info-right')); });
    document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') hideSoon(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFloatingTooltips); else initFloatingTooltips();

  window.RLWRenderTooltips = { texts: INFO_TEXTS, infoIcon: infoIcon, labelWithInfo: labelWithInfo, initFloatingTooltips: initFloatingTooltips };
})(window);
