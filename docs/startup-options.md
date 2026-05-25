# Startup Options and CLI Parameters

This document is the canonical operator reference for starting Roon Log Watcher. Keep it synchronized with `package.json`, `lib/command-registry.js` and `lib/cli-options.js`.

## Install and initialize

```bash
npm install
npm run init
npm run diagnose
```

`npm run init` writes a default `config.json` if needed. `npm run diagnose` checks log discovery, Roon process detection, platform compatibility and runtime prerequisites before you start live monitoring.

## Recommended daily-driver mode

```bash
npm run start:all-memory
```

Equivalent direct command:

```bash
node app.js --all --interval 0.25 --memory-window
```

This starts the full monitoring stack: broad live log monitoring, fast polling, runtime memory analysis, GC interpretation, incident correlation, playback/session tracking, live dashboard and diagnostic export helpers.

## npm startup variants

| npm script | Direct command | Purpose |
| --- | --- | --- |
| `npm run start` | `node app.js --all --interval 0.25 --memory-window` | Default dashboard start with all live log lines and memory window. |
| `npm run init` | `node app.js --write-default-config` | Create `config.json` from defaults. |
| `npm run diagnose` | `node app.js --diagnose` | Run diagnostics and exit. |
| `npm run diagnose:linux` | `node app.js --diagnose` | Same diagnostics command, kept as a Linux-friendly alias. |
| `npm run start:all` | `node app.js --all` | Monitor all configured/new log lines with configured polling. |
| `npm run start:fast` | `node app.js --interval 1` | Use one-second polling with default log selection. |
| `npm run start:all-fast` | `node app.js --all --interval 0.25` | Show all new log lines with fast near-real-time polling. |
| `npm run start:memory` | `node app.js --memory-window --interval 1` | Open the memory dashboard window. |
| `npm run start:all-memory` | `node app.js --all --interval 0.25 --memory-window` | Recommended full monitoring mode. |
| `npm run start:memory-debug` | `node app.js --all --interval 0.25 --memory-window --memory-debug` | Full monitoring with additional memory debug output. |
| `npm run start:no-cleanup` | `node app.js --no-cleanup` | Start without cleaning older watcher processes. |
| `npm run start:dashboard` | `node app.js --all --interval 0.25 --memory-window` | Alias for recommended dashboard mode. |
| `npm run memory:test` | `node app.js --memory-test-file` | Run memory parser test helper. Pass a file path after the flag when needed. |
| `npm test` | `node --test && npm run architecture:check` | Run tests and architecture fitness checks. |
| `npm run architecture:check` | `node scripts/architecture-check.js` | Run architecture guardrails only. |

## CLI parameters

| Parameter | Alias | Value | Effect |
| --- | --- | --- | --- |
| `--all` | `-a` | none | Show/process all new log lines instead of only highlighted events. |
| `--interval` | `-i` | seconds | Polling interval in seconds. Minimum effective interval is 0.25 seconds. |
| `--memory-window` | `--memory` | none | Enable the local dashboard/memory window service. |
| `--memory-port` | none | port | Port for the memory/dashboard window. Default: `17666`. Valid range: `1024`-`65535`. |
| `--memory-debug` | none | none | Enable additional memory parser/debug output. |
| `--memory-test-file` | none | optional path | Run memory parser test mode against a file when a path is supplied. |
| `--diagnose` | none | none | Run diagnostics and exit without starting normal monitoring. |
| `--write-default-config` | none | none | Write a default `config.json` and exit. |
| `--smooth-output` | none | none | Enable buffered/smoothed terminal output. |
| `--terminal-logs` | none | none | Print live log lines to the terminal in addition to dashboard processing. |
| `--no-cleanup` | none | none | Disable automatic cleanup of older watcher processes. Useful for debugging startup issues. |


## Release-candidate validation

Before publishing a release candidate, run:

```bash
npm run release:check
```

This executes `npm test` (also available as `npm run test`), `npm run architecture:check` and the release documentation synchronization check. The check verifies the current version, startup-command registry, direct `node app.js` commands, CLI parameter documentation, release history and README references.

## Direct Node.js examples

```bash
node app.js --all --interval 1 --memory-window
```

Runs all monitoring sources with one-second polling and opens the dashboard.

```bash
node app.js --all --interval 0.25 --memory-window --memory-port 17667
```

Runs the full dashboard mode on a custom local port.

```bash
node app.js --diagnose
```

Runs diagnostics directly without using npm scripts.

```bash
node app.js --memory-window --interval 1 --terminal-logs
```

Runs the dashboard while also writing live log lines to the terminal.

## Recommended troubleshooting flow

1. Run `npm run diagnose`.
2. Start with `npm run start:all-memory`.
3. If no data appears, verify that Roon/RoonServer is running and producing fresh log lines.
4. If an older watcher blocks startup, use `npm run start:no-cleanup` only for debugging or stop old Node processes manually.
5. For Linux server setups, check discovered log directories in diagnose output before assuming a parsing problem.
