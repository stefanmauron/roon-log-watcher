# Release History

## v8.82 – Release Candidate Preparation

- Added `npm run release:check` and `scripts/release-candidate-check.js` as the release-candidate documentation and metadata gate.
- Validates that `package.json`, `release-info.js`, README, startup options, runtime capabilities, release history and command registry remain synchronized.
- Tightened platform-boundary usage in log discovery, diagnostics, dashboard snapshots and startup browser opening.
- Updated architecture documentation with explicit release-candidate quality gates and operator validation commands.

## v8.81 – Dashboard Tooltip Hardening

- Info tooltips are rendered in a viewport-level floating layer.
- Long explanations are constrained to the visible browser viewport and remain readable near panel edges.
- Fixes clipped tooltips in Controls & Export and Runtime Behaviour Intelligence cards.

## v8.80 – Startup Order Hotfix

- Fixed startup regression `ReferenceError: inspectLine is not defined` when the tail backend starts active log streams.
- Explicitly wires `liveLogProcessingService.inspectLine` into `log-watcher` through `startTailForFile(s)`.
- Added an architecture check to prevent this startup-order regression from returning.
- Retains the v8.79 documentation synchronization for architecture, startup variants and CLI parameters.

## v8.79 – Documentation and Startup Reference Synchronization

- Updated `docs/architecture.md` to reflect the current runtime-service architecture after event normalization, runtime decomposition and service extraction.
- Expanded `docs/startup-options.md` into the canonical operator reference for install, diagnostics, npm scripts, direct Node.js commands and CLI parameters.
- Corrected the custom dashboard port documentation from the non-implemented `--port` flag to the implemented `--memory-port` flag.
- Synchronized `lib/command-registry.js` with `package.json` startup scripts so console hints and documentation describe the same launch modes.
- Updated README, Runtime Capabilities, Release History and dashboard release metadata for v8.79.

## v8.78 – Runtime Service Extraction

- Extracted memory parsing, memory correlation, memory alerts and Linux process-memory polling from `lib/app-main.js` into `lib/memory-runtime-service.js`.
- Extracted incident lifecycle start/degrade/recover state from `lib/app-main.js` into `lib/incident-lifecycle-service.js`.
- Reduced `lib/app-main.js` below 800 lines so it acts primarily as runtime orchestration and wiring.
- Added direct regression tests for memory runtime parsing and incident lifecycle recovery.
- Tightened architecture checks with a 900-line app-main limit and explicit service-extraction guardrails.

## v8.77 – Runtime Decomposition

- Extracted zone-state tracking from `lib/app-main.js` into `lib/zone-state-service.js`.
- Extracted playback-session tracking from `lib/app-main.js` into `lib/playback-session-service.js`.
- Reduced `lib/app-main.js` to an orchestration-focused layer while keeping compatibility wrappers for the existing runtime path.
- Added service-level tests for zone and playback runtime behaviour.
- Extended architecture checks with app-main size and runtime-decomposition guardrails.

## v8.76 - Refactoring Hardening

- Extracted live log processing setup from `lib/app-main.js` into `lib/live-log-processing-service.js`.
- Hardened the event pipeline with failure isolation for hooks, parser registry and correlation engine.
- Added deterministic normalized-event IDs for testability and traceability.
- Reworked the correlation engine into isolated rules with snapshot metadata and rule-error tracking.
- Added parser metadata and automated architecture checks through `npm run architecture:check`.


## v8.75 - Event Normalization Foundation

- Added canonical Raw Log Line → Parsed Log Line → Normalized Domain Event → Correlated Runtime Signal pipeline.
- Added `lib/domain-events.js` and parser modules for memory, playback, RAAT and server lifecycle events.
- Added `lib/correlation-engine.js` to prepare generic runtime-signal correlation over normalized events.
- Added `lib/platform-adapter.js` for platform-specific notification and runtime-profile capabilities.
- Migrated runtime-state shape to include normalized events, runtime signals, parser errors and quality counters.
- Added `npm test` / `node --test` coverage for the event pipeline.
- Preserved the legacy inspection path to keep visible runtime behaviour compatible.

## v8.74 - Startup Order Hotfix + Architecture Documentation

- Fixed startup-order regression where `dashboardService` could be accessed before initialization.
- Wrapped runtime startup in `runApplication()` and execute it only after service wiring has completed.
- Kept `docs/architecture.md` and README Architecture Overview from v8.73.
- Verified JavaScript syntax and `node app.js --diagnose --no-cleanup`.
- Updated app version, status line, Runtime Capabilities, What's New and README.

## v8.73 - Architecture Documentation

- Added `docs/architecture.md` with a DevOps-oriented application architecture overview.
- Added compact Architecture Overview section to README.
- Documented backend services, frontend modules, runtime state, metrics store and dashboard data flow.

## v8.72 - App Main Final Extraction

- Extracted terminal output buffering into `lib/terminal-output-service.js`.
- Extracted Roon process-memory selection and Linux `/proc` sampling helpers into `lib/process-memory-monitor.js`.
- Extracted memory parser test mode into `lib/memory-test-runner.js`.
- Updated app version, status line, Runtime Capabilities, What's New and README.


## v8.71 - App Main Domain Split

- Extracted log-file service wrappers from `lib/app-main.js` into `lib/log-file-service.js`.
- Extracted diagnose-mode output into `lib/diagnostics-runner.js`.
- Extracted dashboard server/export wiring into `lib/dashboard-service.js`.
- Kept `app.js` as the small runtime entry point and further reduced orchestration boilerplate.

## v8.70 - Final Architecture Cleanup

- Reduced `app.js` to a tiny bootstrap entry point.
- Added `lib/app-main.js` as the canonical runtime orchestrator.
- Kept runtime behaviour unchanged while improving maintainability.
- Updated app version, status line, Runtime Capabilities, What's New and README.

## v8.69 – Frontend Final Split

- Extracted browser error reporting into `public/js/error-state.js`.
- Extracted resize, polling, GC toggle and metric-checkbox wiring into `public/js/ui-interactions.js`.
- Added `public/js/render-status-cards.js` as the facade for top KPI/status-card rendering.
- Added `public/js/render-memory-panels.js` as the next safe boundary for memory-panel extraction.
- Updated app version, status line, Runtime Capabilities, What’s New and README.

## v8.68 – Final App.js Decomposition

- Extracted startup summary and ready-message output into `lib/startup-runner.js`.
- Added `lib/command-registry.js` for documented startup commands.
- Added stream lifecycle and memory sampling helper modules.
- Updated app version, status line, Runtime Capabilities, What’s New and README.


This file contains the longer release history for Roon Log Watcher. The dashboard still renders a compact release history from `release-info.js` so the UI remains fast and consistent.

## v8.67 – Documentation & Release Info Consolidation

- Moved long-form documentation into dedicated files under `docs/`.
- Added `docs/release-history.md` for the full release timeline.
- Added `docs/runtime-capabilities.md` for detailed capability descriptions.
- Added `docs/startup-options.md` for supported launch modes and direct Node.js startup patterns.
- Kept `release-info.js` focused on compact UI metadata: app version, Runtime Capabilities, What's New and Release History panels.
- Updated UI version/status line to v8.67.
- Runtime Capabilities, What's New and Release History remain collapsed by default at startup.

## Recent architecture releases

- v8.66: Playback and zone rendering cleanup; split playback sessions, zone/endpoint rendering and playback performance metrics into focused browser modules.
- v8.65: Log rendering and event UI cleanup; split combined log/event rendering into focused browser modules for incidents, playback, live logs and shared formatters.
- v8.64: State and data-flow normalization; added backend and browser-side dashboard data contracts, grouped runtime-state shape and normalized API-client loading while preserving legacy field aliases.
- v8.63: App.js final slimdown; extracted dashboard data snapshots, health snapshots, CSV/JSON/log exports and diagnostic summary generation into `lib/dashboard-data-builder.js`.
- v8.62: Frontend slimdown; extracted major dashboard section renderers from `public/frontend.js` into focused browser modules while preserving UI behaviour.
- v8.61: Actual core slimdown; removed duplicated process-cleanup and platform log-discovery code from `app.js`, delegating it to focused modules while preserving runtime behaviour.
- v8.60: Backend core consolidation; extracted shared log classification helpers into `lib/log-classification.js` while preserving alert, incident and timeline behaviour.
- v8.59: Real frontend split; moved tooltip text and derivation explanations into `public/js/render-tooltips.js` and added controller, DOM, health and timeline module namespaces.
- v8.58: Real app core extraction; moved dashboard server startup, log-line normalisation and app-core runtime context into dedicated modules.
- v8.57: Metrics store and event pipeline extraction; routed log-line processing through `lib/event-pipeline.js` and centralised bounded runtime-store retention in `lib/metrics-store.js`.
- v8.56: App core slimdown; extracted startup logging, notification delivery, bounded metrics helpers, runtime-state shape and event-pipeline scaffolding.
- v8.55: Frontend controller extraction; added modular browser assets for API access, UI state and shared render utilities.
- v8.54: Log discovery and incident detection extraction; moved log path discovery, cleanup, incident and timeline classification into dedicated modules.
- v8.53: Duplicate frontend and app orchestration cleanup; removed duplicate frontend.js and extracted dashboard routes/runtime helpers.
- v8.52: Analysis engine extraction for Health Score, memory growth, GC pressure, plausibility and Runtime Behaviour Intelligence modules.
- v8.51: Frontend asset cleanup for dashboard CSS and browser JavaScript extraction.
- v8.50: Configuration and threshold cleanup for config loading, CLI parsing, thresholds and log pattern compilation.
- v8.49: Dashboard UI extraction into `lib/dashboard-html.js` while preserving existing routes and behaviour.
- v8.48: Module extraction cleanup for shared helpers, memory conversion and runtime severity logic.
- v8.47: Code structure cleanup with centralized release metadata.
