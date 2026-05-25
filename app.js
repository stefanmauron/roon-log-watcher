#!/usr/bin/env node
'use strict';

// Roon Log Watcher entry point.
// The actual application orchestration lives in lib/app-main.js so this file
// stays intentionally small and only bootstraps the runtime.
require('./lib/app-main');
