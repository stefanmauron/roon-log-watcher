# Roon Log Watcher v8.82

## Current release: v8.82 Release Candidate Preparation

v8.82 prepares the project for a Release Candidate. The main change is not a new dashboard feature, but a quality hardening step: architecture documentation, startup variants, CLI parameters, release metadata and command registry entries are now synchronized and covered by an automated release check.

What changed in v8.82:

- Added `npm run release:check` as the release-candidate validation command.
- Added `scripts/release-candidate-check.js` to verify release metadata, startup documentation, CLI parameter coverage and release history synchronization.
- Tightened the platform boundary so log discovery, diagnostics, dashboard health snapshots and browser opening use platform capabilities through `lib/platform-adapter.js`.
- Updated architecture documentation, startup options, runtime capabilities, release history and README for release-candidate readiness.
- Kept the v8.81 tooltip hardening and v8.80 startup hotfix.

## Recommended startup

```bash
npm install
npm run init
npm run diagnose
npm run start:all-memory
```

`npm run start:all-memory` starts the complete monitoring stack including broad live log monitoring, fast polling, runtime memory analysis, GC interpretation, incident correlation, playback/session tracking, live dashboard and diagnostic export helpers.

More startup variants and CLI parameters are documented in [`docs/startup-options.md`](docs/startup-options.md).

## Release-candidate readiness

Before publishing a release candidate, run:

```bash
npm run release:check
```

This command runs the regression tests, architecture guardrails and release documentation checks. It verifies that `package.json`, `release-info.js`, README, architecture documentation, startup options, runtime capabilities, release history and command registry are in sync.

## Important documents

- [Architecture documentation](docs/architecture.md)
- [Startup options and CLI parameters](docs/startup-options.md)
- [Runtime capabilities](docs/runtime-capabilities.md)
- [Release history](docs/release-history.md)
- [Release-candidate checklist](docs/release-candidate-checklist.md)

## Architecture overview

Roon Log Watcher is structured as a local observability pipeline:

```text
Roon log files
  → Log discovery and stream management
  → RawLogLine
  → Event pipeline
  → ParsedLogLine
  → NormalizedEvent
  → Correlation engine
  → RuntimeSignal
  → Runtime services
  → Runtime state and metrics store
  → Dashboard API
  → Frontend renderer
```

The current backend is intentionally split into focused areas:

- Bootstrap and runtime orchestration: `app.js`, `lib/app-main.js`
- Startup and CLI documentation: `lib/cli-options.js`, `lib/command-registry.js`, `docs/startup-options.md`
- Platform boundary: `lib/platform-adapter.js`, `lib/log-discovery.js`, `lib/notification-service.js`, `lib/process-memory-monitor.js`
- Log discovery and streaming: `lib/log-file-service.js`, `lib/log-stream-manager.js`, `lib/log-watcher.js`, `lib/live-log-processing-service.js`
- Event normalization and parsing: `lib/event-pipeline.js`, `lib/domain-events.js`, `lib/parsers/*`
- Runtime services: `lib/memory-runtime-service.js`, `lib/incident-lifecycle-service.js`, `lib/playback-session-service.js`, `lib/zone-state-service.js`
- Correlation and analysis: `lib/correlation-engine.js`, `lib/runtime-intelligence.js`, `lib/plausibility-check.js`, `lib/health-score.js`
- Runtime state and metrics: `lib/runtime-state.js`, `lib/metrics-store.js`
- Dashboard API and data contracts: `lib/dashboard-service.js`, `lib/api-routes.js`, `lib/dashboard-data-builder.js`, `lib/dashboard-data-contract.js`
- Frontend rendering: `public/frontend.js`, `public/js/*`

The main architectural rule is: new Roon log knowledge should enter the system as parser/domain-event/correlation logic, not as UI-specific string handling.

## Validation

```bash
npm test
npm run architecture:check
npm run release:check
node app.js --diagnose --no-cleanup
```

## Common direct commands

```bash
node app.js --all --interval 0.25 --memory-window
node app.js --all --interval 0.25 --memory-window --memory-port 17667
node app.js --diagnose
node app.js --memory-window --interval 1 --terminal-logs
```

## Project status

This is a hobby monitoring and diagnostics tool for near real-time Roon log observation. It is designed to help identify what Roon is logging at the moment problems occur. It comes without warranty or formal support.
