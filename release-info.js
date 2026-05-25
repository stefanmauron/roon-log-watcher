'use strict';

// Compact release metadata for the dashboard UI, status line and collapsible
// release panels. Long-form documentation lives in docs/ so the UI metadata stays
// small and less likely to drift from the visible app version.
const APP_VERSION = '8.82';

const RUNTIME_CAPABILITIES = [
  'Release-candidate readiness: documentation, command registry, startup options and release metadata are now validated by an automated release:check command.',
  'Platform boundary hardening: log discovery, diagnostics, dashboard snapshots and browser opening now consume platform capabilities through the platform adapter instead of scattered platform conditionals.',
  'Operator documentation lockstep: README, architecture documentation, startup options, runtime capabilities and release history have been synchronized for the RC preparation step.',
  'Dashboard tooltip hardening: info popovers are now rendered in a viewport-level floating layer so they are no longer clipped by cards, scroll panes or the browser edge.',
  'Documentation synchronization: architecture, startup options, CLI parameters and command registry now reflect the current runtime-service architecture.',
  'Startup reference completeness: docs/startup-options.md lists every npm startup variant, matching node app.js command and supported CLI parameter.',
  'Operator accuracy: custom dashboard ports are documented through the implemented --memory-port flag instead of the outdated --port example.',
  'Runtime Service Extraction: memory parsing/polling and incident lifecycle state now live in focused services instead of lib/app-main.js.',
  'Orchestrator hardening: lib/app-main.js is reduced below 800 lines and protected by a stricter architecture fitness threshold.',
  'Service-level regression coverage expanded: memory runtime parsing and incident lifecycle recovery now have direct node --test coverage.',
  'Runtime Decomposition: zone-state tracking and playback-session tracking now live in focused services instead of lib/app-main.js.',
  'Service-level test coverage: zone-state and playback-session behaviour is validated with node --test so future refactoring has faster feedback.',
  'Architecture guardrails extended: npm test now checks that app-main.js remains below an orchestration-size threshold and delegates zone/playback runtime domains.',
  'Refactoring Hardening: live log processing is extracted from app-main.js into lib/live-log-processing-service.js while preserving the legacy runtime path.',
  'Pipeline resilience: parser, hook and correlation failures are converted into bounded parser/pipeline error events instead of stopping live processing.',
  'Deterministic event identity: normalized events now use stable hash-based IDs to improve testability and correlation traceability.',
  'Rule-based correlation: correlation logic now runs through isolated rules with rule-error tracking and snapshot metadata.',
  'Architecture quality gates: npm test now also runs scripts/architecture-check.js to protect parser, pipeline, domain-event and bootstrap boundaries.',
  'Event Normalization Foundation: log lines now flow through Raw Log Line → Parsed Log Line → Normalized Domain Event → Correlated Runtime Signal.',
  'Parser boundaries: memory, playback, RAAT and server lifecycle detection have first-class parser modules under lib/parsers/.',
  'Correlation engine scaffold: normalized events can now produce runtime signals without coupling the UI to raw log strings.',
  'Runtime state migration: recent normalized events, runtime signals and parser errors are tracked in the central runtime-state shape.',
  'Platform adapter foundation: platform checks and notification/path profile capabilities are isolated behind lib/platform-adapter.js.',
  'Test foundation: node --test validates the event pipeline and correlation signal path.',
  'Startup-order hotfix: dashboard service initialization is completed before memory window startup, diagnose mode and runtime start are executed.',
  'Architecture documentation: docs/architecture.md describes backend services, frontend modules, runtime state, metrics store and dashboard data flow.',
  'App Main Final Extraction: terminal output smoothing, process-memory monitoring and memory parser test mode now live in focused service modules.',
  'App Main Domain Split: app.js remains a tiny entry point while app-main.js delegates log-file services, diagnostics and dashboard wiring to focused modules.',
  'Final architecture cleanup: app.js is now a tiny entry point and the application runtime is delegated to lib/app-main.js.',
  'Compact UI metadata: app version, status line, What\'s New and dashboard release panels are generated from this file.',
  'Live Roon telemetry: follows active Roon logs and updates the dashboard near real time.',
  'Memory analysis: tracks Managed, Physical and derived Unmanaged memory with trend and plausibility interpretation.',
  'Runtime Behaviour Intelligence: correlates memory growth, GC pressure and relevant incidents into simple status cards.',
  'Incident context: correlates playback, RAAT, device, network, database and runtime events on one timeline.',
  'Operator workflow: newest-first live logs, local timeline times, persistent UI settings and diagnostic export helpers.',
  'Modular internals: backend analysis, dashboard API, log discovery, incident detection and frontend renderers live in focused modules.'
];

const WHATS_NEW = [
  'v8.82 prepares the codebase for a Release Candidate by tightening platform boundaries and adding automated documentation/command-registry validation.',
  'Added scripts/release-candidate-check.js and npm run release:check to verify release metadata, startup documentation, CLI parameter coverage and release history synchronization.',
  'Refactored remaining platform-specific decisions in log discovery, startup URL opening, diagnostics and dashboard health snapshots toward the platform adapter boundary.',
  'Updated README.md, docs/architecture.md, docs/startup-options.md, docs/runtime-capabilities.md and docs/release-history.md for release-candidate readiness.',
  'v8.81 fixes dashboard tooltip rendering so long information texts stay readable and are positioned within the visible browser viewport.',
  'Tooltip popovers now use a shared floating portal instead of inline absolute positioning, preventing clipping inside Controls & Export, Runtime Behaviour Intelligence and other dashboard cards.',
  'v8.80 fixes a startup-order regression in the tail backend and keeps the synchronized architecture/startup documentation from v8.79.',
  'Updated docs/architecture.md with the current event-pipeline, runtime-service, correlation and dashboard data architecture.',
  'Expanded docs/startup-options.md into the canonical operator reference for install, diagnostics, npm scripts, direct node app.js commands and CLI parameters.',
  'Corrected custom dashboard-port documentation to use the implemented --memory-port parameter.',
  'Synchronized lib/command-registry.js with package.json so ready/startup hints describe all relevant launch modes.',
  'v8.78 completes the next refactoring loop by extracting memory runtime behaviour and incident lifecycle state from lib/app-main.js.',
  'Added lib/memory-runtime-service.js for memory parsing, memory correlation, threshold alerts and Linux process-memory polling.',
  'Added lib/incident-lifecycle-service.js for incident lifecycle start/degrade/recover state, dedupe counters and health-score delegation.',
  'Reduced lib/app-main.js from roughly 1,263 to under 800 lines so it is now much closer to pure runtime orchestration.',
  'Added tests for memory runtime parsing and incident lifecycle recovery.',
  'Tightened scripts/architecture-check.js with a 900-line app-main threshold and service-extraction guardrails.',
  'v8.77 continues the runtime decomposition by extracting zone-state tracking and playback-session tracking from lib/app-main.js.',
  'Added lib/zone-state-service.js for zone extraction, endpoint state, reconnect counters, GC impact and zone snapshots.',
  'Added lib/playback-session-service.js for playback lifecycle/session updates and playback timeline completion events.',
  'Reduced lib/app-main.js from roughly 1,538 to roughly 1,255 lines while preserving compatibility wrappers for the existing runtime path.',
  'Added service-level tests for zone-state and playback-session behaviour.',
  'Extended scripts/architecture-check.js with app-main size and runtime-decomposition guardrails.',
  'v8.76 hardens the event-normalization foundation with concrete refactoring guardrails and failure isolation.',
  'Extracted live log processing setup from lib/app-main.js into lib/live-log-processing-service.js.',
  'Reworked lib/event-pipeline.js so hook, parser and correlation failures are captured as quality events rather than breaking the watcher loop.',
  'Reworked lib/correlation-engine.js into a small rule engine with default rules, snapshots and isolated rule-error tracking.',
  'Added deterministic normalized-event IDs and parser metadata for better tests, diagnostics and future event-store work.',
  'Added scripts/architecture-check.js and wired it into npm test as a lightweight architectural fitness function.',
  'v8.75 introduces the Event Normalization Foundation for safer future refactoring and feature work.',
  'Added lib/domain-events.js as the canonical Raw Log Line → Parsed Log Line → Normalized Domain Event model.',
  'Added parser modules for Roon memory samples, playback activity, RAAT connectivity and server lifecycle events.',
  'Added lib/correlation-engine.js to turn normalized events into runtime signals while preserving the legacy detection path.',
  'Added lib/platform-adapter.js to isolate macOS/Linux checks and notification capabilities.',
  'Runtime state now contains bounded stores for normalized events, runtime signals, parser errors and quality counters.',
  'Added npm test / node --test coverage for the event pipeline and runtime-signal path.',
  'v8.74 fixes the v8.73 startup-order regression where dashboardService could be accessed before initialization when starting the memory window.',
  'Startup execution is now wrapped in runApplication() and invoked only after services and dashboard wiring have been initialized.',
  'Verified with JavaScript syntax check and node app.js --diagnose --no-cleanup.',
  'App version, status line, Runtime Capabilities, What\'s New, Release History and README are updated to v8.74.',
  'v8.72 performs App Main Final Extraction by moving terminal output buffering, Roon process-memory helpers and memory parser test execution into dedicated modules.',
  'Added lib/terminal-output-service.js for smooth terminal output queueing and shutdown-safe terminal handling.',
  'Added lib/process-memory-monitor.js for Roon process selection and Linux /proc memory reads.',
  'Added lib/memory-test-runner.js for isolated memory-parser test execution.',
  'Updated status line, Runtime Capabilities, What\'s New, Release History and README for v8.72.',
  'v8.71 performs App Main Domain Split by extracting log-file discovery wrappers, diagnose-mode output and dashboard server/export wiring from lib/app-main.js.',
  'Added lib/log-file-service.js for runtime-profile wrappers, configured base directory handling, mounted volume listing and safe log-file discovery.',
  'Added lib/diagnostics-runner.js so npm run diagnose output is separated from normal runtime orchestration.',
  'Added lib/dashboard-service.js to centralize dashboard API/export wiring and reduce repeated boilerplate in app-main.js.',
  'Updated status line, Runtime Capabilities, What\'s New, Release History and README for v8.71.',
  'v8.70 performs Final Architecture Cleanup by turning app.js into a tiny entry point and moving the remaining runtime orchestration into lib/app-main.js.',
  'Added lib/app-main.js as the canonical runtime orchestrator for startup, configuration, log watching, dashboard server wiring and shutdown delegation.',
  'Reduced app.js to a small bootstrap file so future changes no longer have to touch the executable entry point.',
  'Updated status line, Runtime Capabilities, What\'s New, Release History and README for v8.70.',
  'v8.69 added public/js/error-state.js for JavaScript error reporting and watcher-stopped status messages.',
  'Added public/js/ui-interactions.js for resize handling, metric checkbox binding, GC toggle handling and refresh scheduling.',
  'Added public/js/render-status-cards.js and public/js/render-memory-panels.js as explicit boundaries for top KPI cards and memory-panel rendering.',
  'public/frontend.js is now more focused on dashboard orchestration while preserving the existing chart and rendering behaviour.',
  'The app version, status line, Runtime Capabilities, What\'s New and Release History are updated to v8.69.',
  'v8.68 performs Final App.js Decomposition by moving startup/ready console output, URL opening, shutdown handling, command registry metadata, stream manager scaffolding and memory sampling helpers into dedicated modules.',
  'Added lib/startup-runner.js for startup summaries, ready messages, URL opening and shutdown handler registration.',
  'Added lib/command-registry.js as the central place for documented npm/direct Node start commands.',
  'Added lib/log-stream-manager.js and lib/memory-sampler.js as focused extraction points for stream lifecycle and memory sampling helpers.',
  'app.js delegates more lifecycle and sampling responsibilities to modules while preserving runtime behaviour.',
  'release-info.js is now compact UI metadata only: app version, status line, Runtime Capabilities, What\'s New and Release History panels.',
  'Runtime Capabilities, What\'s New and Release History remain collapsed by default at startup.'
];

const RELEASE_HISTORY = [
  ['v8.82', 'Release Candidate Preparation: adds release:check documentation validation, tightens platform adapter boundaries and synchronizes README, architecture, startup options, runtime capabilities and release history.'],
  ['v8.81', 'Dashboard Tooltip Hardening: moves tooltip display to a viewport-level floating layer so info popovers are readable and no longer clipped by panels or browser edges.'],
  ['v8.80', 'Startup Order Hotfix: wires the live log inspector from live-log-processing-service into the tail backend to fix ReferenceError: inspectLine is not defined.'],
  ['v8.79', 'Documentation and Startup Reference Synchronization: aligns architecture docs, startup options, CLI parameter reference and command registry with the current runtime-service architecture.'],
  ['v8.78', 'Runtime Service Extraction: extracts memory runtime behaviour and incident lifecycle state into focused services, reduces app-main below 800 lines and tightens architecture/test guardrails.'],
  ['v8.77', 'Runtime Decomposition: extracts zone-state and playback-session runtime logic into focused services, adds service tests and stricter architecture checks.'],
  ['v8.76', 'Refactoring Hardening: extracts live log processing, strengthens event-pipeline resilience, adds deterministic event IDs, rule-based correlation and automated architecture checks.'],
  ['v8.75', 'Event Normalization Foundation: adds domain event model, parser modules, correlation-engine scaffold, platform adapter, runtime-state quality counters and node --test coverage.'],
  ['v8.74', 'Startup-order hotfix: initializes dashboard service before starting the memory window and runtime loop; keeps v8.73 architecture documentation.'],
  ['v8.73', 'Architecture documentation: added docs/architecture.md and a compact README architecture overview for DevOps-oriented maintainability.'],
  ['v8.72', 'App Main Final Extraction: extracted terminal output buffering, process-memory helpers and memory parser test mode from lib/app-main.js into focused services.'],
  ['v8.71', 'App Main Domain Split: extracted log-file services, diagnose-mode output and dashboard service wiring from lib/app-main.js into focused modules.'],
  ['v8.70', 'Final Architecture Cleanup: app.js is reduced to a tiny entry point while lib/app-main.js owns runtime orchestration.'],
  ['v8.69', 'Frontend final split: extracted browser error state, UI interaction wiring, status-card facade and memory-panel module boundaries into dedicated public/js modules.'],
  ['v8.68', 'Final app.js decomposition: extracted startup/ready console output, URL opening, shutdown handling, command registry metadata, stream manager scaffolding and memory sampling helpers into dedicated modules.'],
  ['v8.67', 'Documentation and release-info consolidation: moved long-form runtime capabilities, startup options and release history into docs/ while keeping release-info.js compact.'],
  ['v8.66', 'Playback and zone rendering cleanup: split playback sessions, zone/endpoint rendering and playback performance metrics into focused browser modules.'],
  ['v8.65', 'Log rendering and event UI cleanup: split combined log/event rendering into focused browser modules for incidents, playback, live logs and shared formatters.'],
  ['v8.64', 'State and data-flow normalization: added backend and browser-side dashboard data contracts and normalized API-client loading.'],
  ['v8.63', 'App.js final slimdown: extracted dashboard snapshots, exports and diagnostic summary generation into lib/dashboard-data-builder.js.'],
  ['v8.62', 'Frontend slimdown: extracted major dashboard section renderers from public/frontend.js into focused browser modules.'],
  ['v8.61', 'Actual core slimdown: delegated process cleanup and platform log discovery from app.js to focused modules.'],
  ['v8.60', 'Backend core consolidation: extracted shared log classification helpers into lib/log-classification.js.'],
  ['v8.59', 'Real frontend split: moved tooltip text and derivation explanations into public/js/render-tooltips.js.'],
  ['v8.58', 'Real app core extraction: moved dashboard server startup, log-line normalisation and app-core runtime context into dedicated modules.'],
  ['v8.57', 'Metrics store and event pipeline extraction: centralised log-line processing and bounded runtime-store retention.'],
  ['v8.56', 'App core slimdown: extracted startup logging, notification delivery, runtime-state shape and event-pipeline scaffolding.'],
  ['v8.55', 'Frontend controller extraction: added modular browser assets for API access, UI state and shared render utilities.'],
  ['v8.54', 'Log discovery and incident detection extraction: moved log path discovery, cleanup, incident and timeline classification into dedicated modules.'],
  ['v8.53', 'Duplicate frontend and app orchestration cleanup: removed duplicate frontend.js and extracted dashboard routes/runtime helpers.'],
  ['v8.52', 'Analysis engine extraction for Health Score, memory growth, GC pressure, plausibility and Runtime Behaviour Intelligence modules.'],
  ['v8.51', 'Frontend asset cleanup for dashboard CSS and browser JavaScript extraction.'],
  ['v8.50', 'Configuration and threshold cleanup for config loading, CLI parsing, thresholds and log pattern compilation.'],
  ['v8.49', 'Dashboard UI extraction into lib/dashboard-html.js while preserving existing routes and behaviour.'],
  ['v8.48', 'Module extraction cleanup for shared helpers, memory conversion and runtime severity logic.'],
  ['v8.47', 'Code structure cleanup with centralized release metadata.']
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRuntimeCapabilitiesHtml() {
  return RUNTIME_CAPABILITIES.map(item => `<div>✓ ${escapeHtml(item)}</div>`).join('\n');
}

function renderWhatsNewHtml() {
  return WHATS_NEW.map(item => `<div>• ${escapeHtml(item)}</div>`).join('\n');
}

function renderReleaseHistoryHtml() {
  return RELEASE_HISTORY
    .map(([version, text]) => `<div><strong>${escapeHtml(version)}</strong> • ${escapeHtml(text)}</div>`)
    .join('\n');
}

module.exports = {
  APP_VERSION,
  RUNTIME_CAPABILITIES,
  WHATS_NEW,
  RELEASE_HISTORY,
  renderRuntimeCapabilitiesHtml,
  renderWhatsNewHtml,
  renderReleaseHistoryHtml
};
