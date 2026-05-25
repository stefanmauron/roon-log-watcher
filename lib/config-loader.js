'use strict';

const fs = require('fs');
const path = require('path');

const MINIMAL_DEFAULT_CONFIG = Object.freeze({
  baseDirectory: '/Volumes/Data',
  showAllLogLines: false,
  memoryWindow: false,
  useTailBackend: true,
  autoCleanupOldInstances: true,
  fileNameIncludes: ['log', 'txt']
});

function loadJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadConfig(options) {
  const configPath = options.configPath;
  const examplePath = options.examplePath || path.join(path.dirname(configPath), 'config.example.json');

  if (fs.existsSync(configPath)) {
    try {
      return loadJsonFile(configPath);
    } catch (err) {
      throw new Error(`Could not read config.json: ${err.message}`);
    }
  }

  if (fs.existsSync(examplePath)) {
    try {
      return loadJsonFile(examplePath);
    } catch (_) {
      // Fall through to minimal defaults if the example file is damaged.
    }
  }

  return { ...MINIMAL_DEFAULT_CONFIG };
}

function writeDefaultConfig(options) {
  const configPath = options.configPath;
  const examplePath = options.examplePath || path.join(path.dirname(configPath), 'config.example.json');

  if (fs.existsSync(configPath)) {
    return { created: false, message: 'config.json already exists. Leaving it unchanged.' };
  }

  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, configPath);
    return { created: true, message: 'Created config.json from config.example.json.' };
  }

  fs.writeFileSync(configPath, JSON.stringify({ baseDirectory: '/Volumes/Data' }, null, 2) + '\n');
  return { created: true, message: 'Created minimal config.json.' };
}

module.exports = {
  loadConfig,
  writeDefaultConfig,
  MINIMAL_DEFAULT_CONFIG
};
