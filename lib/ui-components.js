'use strict';

// Small server-side UI helpers for dashboard templates. Keep repeated markup here
// instead of duplicating string fragments in dashboard-html.js.
function assetHref(fileName, version) {
  return `/${fileName}?v=${encodeURIComponent(version || 'dev')}`;
}

function dashboardConfigScript(config) {
  const safe = JSON.stringify(config || {}).replace(/</g, '\\u003c');
  return `<script>window.__RLW_DASHBOARD_CONFIG__ = ${safe};</script>`;
}

module.exports = { assetHref, dashboardConfigScript };
