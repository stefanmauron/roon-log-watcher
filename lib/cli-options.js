'use strict';

function createCliOptions(argv) {
  const values = Array.isArray(argv) ? argv.slice() : [];
  const set = new Set(values);

  function has(name, alias) {
    return set.has(name) || (alias ? set.has(alias) : false);
  }

  function get(name, alias) {
    const names = [name, alias].filter(Boolean);
    for (const n of names) {
      const idx = values.findIndex(a => a === n);
      if (idx >= 0) return values[idx + 1];
      const inline = values.find(a => a.startsWith(n + '='));
      if (inline) return inline.split('=').slice(1).join('=');
    }
    return undefined;
  }

  return { argv: values, has, get };
}

function getPollIntervalMs(cli, config) {
  const seconds = Number(cli.get('--interval', '-i') || config.pollIntervalSeconds || 5);
  if (!Number.isFinite(seconds) || seconds <= 0) return 5000;
  return Math.max(250, seconds * 1000);
}

function getMemoryWindowPort(cli, config) {
  const port = Number(cli.get('--memory-port') || config.memoryWindowPort || 17666);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return 17666;
  return port;
}

module.exports = {
  createCliOptions,
  getPollIntervalMs,
  getMemoryWindowPort
};
