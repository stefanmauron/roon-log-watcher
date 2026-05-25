# Runtime Capabilities

## v8.82 Release-candidate readiness

- Release-candidate readiness is now validated with `npm run release:check`.
- The release check verifies version metadata, startup documentation, CLI parameter coverage, release history and command-registry synchronization.
- Platform-specific decisions have been tightened around `lib/platform-adapter.js` for log discovery, diagnostics, dashboard health snapshots and browser opening.
- README, architecture documentation, startup options, runtime capabilities and release history are synchronized for the RC preparation step.

## v8.81 Dashboard Tooltip Hardening

- Dashboard information tooltips use a shared floating portal.
- Popovers are constrained to the visible browser viewport.
- Scroll panels and card boundaries no longer clip tooltip text.

## v8.80 Startup Order Hotfix

- Architecture documentation now reflects the current v8.78+ runtime-service architecture, including memory runtime, incident lifecycle, playback session and zone-state services.
- Startup documentation now lists all npm startup variants from `package.json` and the matching direct `node app.js` commands.
- CLI parameter documentation now covers `--all`, `--interval`, `--memory-window`, `--memory-port`, `--memory-debug`, `--memory-test-file`, `--diagnose`, `--write-default-config`, `--smooth-output`, `--terminal-logs` and `--no-cleanup`.
- The previous misleading custom-port example using `--port` has been corrected to the implemented `--memory-port` parameter.
- `lib/command-registry.js` is now synchronized with documented npm scripts so ready/startup hints no longer lag behind supported launch modes.


## v8.78 Runtime Service Extraction

- Memory runtime behaviour is isolated in `lib/memory-runtime-service.js`, including log-based memory parsing, GC enrichment, growth alerts, memory correlation and Linux `/proc` polling.
- Incident lifecycle behaviour is isolated in `lib/incident-lifecycle-service.js`, including start/degrade/recover state and user-facing lifecycle snapshots.
- `lib/app-main.js` is now below 800 lines and protected by a stricter architectural fitness function.
- Service tests cover the newly extracted memory and incident lifecycle boundaries.

## v8.77 Runtime Decomposition

- Zone-state runtime behaviour is isolated in `lib/zone-state-service.js`.
- Playback-session lifecycle behaviour is isolated in `lib/playback-session-service.js`.
- `lib/app-main.js` is now closer to a pure orchestrator and no longer owns the detailed zone/playback implementation logic.
- Service-level tests and architecture checks make future refactoring safer.


## v8.76 refactoring hardening

- Live log processing has a dedicated service boundary.
- Event-pipeline failures are captured as bounded quality events instead of stopping the watcher loop.
- Normalized events use deterministic hash-based identifiers.
- Correlation logic is rule-based and isolates rule failures.
- `npm test` includes parser/pipeline tests plus an architectural fitness check.


## v8.75 event-normalization and refactoring foundation

- Canonical event pipeline: Raw Log Line → Parsed Log Line → Normalized Domain Event → Correlated Runtime Signal.
- Focused parser modules for memory, playback, RAAT and server lifecycle detection.
- Runtime-signal correlation scaffold for future root-cause, health-score and diagnostic intelligence work.
- Central runtime-state stores for normalized events, runtime signals, parser errors and quality counters.
- Platform adapter foundation for macOS/Linux-specific behaviour.
- Node built-in test runner coverage for the core event pipeline.

## v8.74 startup-order and architecture note

- Dashboard service initialization is completed before memory window startup and runtime execution.
- Architecture documentation is available in `docs/architecture.md`.
- Runtime Capabilities, What's New and Release History remain centralized in `release-info.js` for the dashboard UI.

## v8.72 architecture note

The application now keeps more runtime helpers outside `lib/app-main.js`: terminal output smoothing, process-memory discovery and memory-parser test execution are implemented as dedicated services.


## v8.71 architecture note

The app now starts through a tiny `app.js` bootstrap and delegates runtime orchestration to `lib/app-main.js`. This keeps the executable entry point stable while preserving all existing runtime capabilities.


Roon Log Watcher provides a local near real-time dashboard for understanding what Roon Server is currently doing and how stable the runtime appears.

## Monitoring and diagnostics

- Live Roon log following with near real-time dashboard updates.
- Roon log discovery for macOS and Linux-oriented deployments.
- Playback, RAAT, endpoint, zone, network and runtime event correlation.
- Incident detection for disconnects, audio-device losses, streaming problems, database concerns, exceptions and crashes.
- Local timeline with newest runtime events and live log context.

## Memory and runtime intelligence

- Managed Memory, Physical Memory and derived Unmanaged Memory tracking.
- Memory-growth trend calculation using recent samples and MB/h growth estimation.
- GC Pressure classification and correlation with memory behaviour.
- Plausibility checks for Managed + Unmanaged versus Physical Memory interpretation.
- Runtime Behaviour Intelligence that combines memory, GC and incident signals into understandable dashboard cards.

## Dashboard and operator workflow

- Browser dashboard without Electron or database dependency.
- Info tooltips with plain-language explanations, formulas and high-level algorithms for calculated metrics.
- Runtime Capabilities, What's New and Release History panels are collapsed by default at startup.
- Export helpers for diagnostic summaries and runtime evidence.
- Persistent UI settings for a calmer troubleshooting workflow.

## Architecture status

The application has been progressively refactored into focused backend and frontend modules. `app.js` remains the orchestration entry point, while dashboard rendering, API routes, data contracts, log classification, memory analysis, incident detection and frontend renderers now live in dedicated files.


## v8.69 Architecture Capability

v8.69 adds focused frontend module boundaries for error handling, UI interaction wiring, status-card rendering and memory-panel rendering. This makes future dashboard changes safer without changing the visible behaviour.

## v8.68 Architecture Capability

v8.68 adds final app.js decomposition helpers for startup lifecycle, command documentation, stream lifecycle scaffolding and memory sample validation. The dashboard behaviour is intentionally preserved.
