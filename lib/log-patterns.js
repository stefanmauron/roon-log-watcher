'use strict';

/**
 * Compile configured log patterns once at startup.
 *
 * A pattern has a user-facing name, severity, regex string and notify flag in
 * config.json. The watcher keeps the original fields and adds `re`, the compiled
 * case-insensitive regular expression used by handleLine(). Invalid patterns are
 * skipped so one broken custom expression does not prevent the watcher from
 * starting.
 */
function compilePatterns(patterns, warn) {
  return (patterns || []).map(p => {
    try {
      return { ...p, re: new RegExp(p.regex, 'i') };
    } catch (err) {
      if (typeof warn === 'function') warn(`Skipping invalid log pattern "${p && p.name ? p.name : 'unnamed'}": ${err.message}`);
      return null;
    }
  }).filter(Boolean);
}

module.exports = {
  compilePatterns
};
