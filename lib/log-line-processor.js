'use strict';

function createLogLineProcessor({ pipeline, onProcessed, onError } = {}) {
  if (typeof pipeline !== 'function') throw new Error('createLogLineProcessor requires pipeline(file, line)');
  return function processLogLine(file, rawLine) {
    const line = String(rawLine || '').trim();
    if (!line) return null;
    try {
      const result = pipeline(file, line);
      if (typeof onProcessed === 'function') onProcessed(result);
      return result;
    } catch (err) {
      if (typeof onError === 'function') return onError(err, { file, line });
      throw err;
    }
  };
}

module.exports = { createLogLineProcessor };
