# Roon Log Watcher Architecture

## Purpose

Roon Log Watcher is a near real-time observability and diagnostics application for the Roon ecosystem. It monitors active Roon log files, converts relevant log lines into runtime events, correlates those events into operational signals and exposes the resulting telemetry through a lightweight local dashboard.

The architecture is optimized for ongoing refactoring and feature growth. New log knowledge should be added as parser, domain-event or correlation logic without forcing changes in dashboard rendering, platform discovery or startup orchestration.

## Architectural principles

1. Logs are treated as domain events, not as UI strings.
2. Runtime logic is separated from dashboard rendering.
3. Platform-specific behaviour is isolated behind adapter boundaries.
4. Correlation happens over normalized events and runtime state, not over scattered UI state.
5. The application must remain observable itself through parser errors, quality counters, metrics and architecture checks.
6. Refactoring means increasing changeability while preserving visible behaviour.

## High-level data flow

```text
Roon log files
    ↓
Log Discovery & Stream Management
    ↓
Raw Log Line
    ↓
Log Line Processor
    ↓
Event Pipeline
    ↓
Parsed Log Line
    ↓
Parser Registry
    ↓
Normalized Domain Event
    ↓
Correlation Engine
    ↓
Runtime Signal
    ↓
Runtime Services
    ↓
Runtime State & Metrics Store
    ↓
Dashboard API
    ↓
Frontend Renderer
```

The legacy inspection path is still preserved where needed for compatibility, but new behaviour should be implemented against normalized events and focused runtime services.

## Entry point and orchestration

### `app.js`

Minimal bootstrap entry point.

Responsibilities:

- Load the runtime orchestrator.
- Surface fatal startup failures.
- Avoid business logic.

### `lib/app-main.js`

Runtime orchestrator.

Responsibilities:

- Load configuration and CLI options.
- Initialize services.
- Wire dependencies.
- Start diagnostics, dashboard, stream processing and shutdown handling.
- Delegate runtime domains to focused services.

Guardrail: this file should remain orchestration-focused and below the architecture-check threshold.

## Startup and CLI layer

Files:

- `lib/cli-options.js`
- `lib/command-registry.js`
- `lib/startup-runner.js`
- `docs/startup-options.md`

Responsibilities:

- Parse command-line options.
- Define documented startup variants.
- Print ready/startup information.
- Keep npm scripts, direct Node examples and operator documentation synchronized.

Relevant CLI parameters are documented in `docs/startup-options.md`.

## Platform boundary

Files:

- `lib/platform-adapter.js`
- `lib/log-discovery.js`
- `lib/process-memory-monitor.js`
- `lib/notification-service.js`

Responsibilities:

- Discover macOS and Linux runtime profiles.
- Locate relevant Roon log directories.
- Integrate with platform notification mechanisms where available.
- Sample process memory on supported platforms.

Design rule: direct platform checks should not leak into domain logic. Platform-specific decisions should be concentrated in adapter/discovery modules.

## Log ingestion and streaming

Files:

- `lib/log-file-service.js`
- `lib/log-discovery.js`
- `lib/log-stream-manager.js`
- `lib/log-watcher.js`
- `lib/live-log-processing-service.js`

Responsibilities:

- Discover log files.
- Start and manage tail/polling streams.
- Ignore historical content when runtime-only monitoring is intended.
- Route new log lines into the processing pipeline.
- Keep terminal output separate from analysis logic.

## Event pipeline and parser layer

Files:

- `lib/event-pipeline.js`
- `lib/domain-events.js`
- `lib/log-line-processor.js`
- `lib/parsers/index.js`
- `lib/parsers/roon-memory-parser.js`
- `lib/parsers/playback-parser.js`
- `lib/parsers/raat-parser.js`
- `lib/parsers/server-lifecycle-parser.js`
- `lib/parsers/zone-utils.js`

Responsibilities:

- Convert raw log lines into parsed log-line objects.
- Run parser modules.
- Emit normalized domain events with stable event identity.
- Record parser and pipeline errors without stopping live processing.
- Keep parsing independent from frontend rendering.

Expected event pipeline shape:

```text
RawLogLine → ParsedLogLine → NormalizedEvent → RuntimeSignal
```

## Correlation layer

Files:

- `lib/correlation-engine.js`
- `lib/runtime-intelligence.js`
- `lib/plausibility-check.js`
- `lib/health-score.js`

Responsibilities:

- Convert normalized events into runtime signals.
- Evaluate rule-based correlations.
- Track runtime behaviour indicators.
- Support health scoring and plausibility checks.

Correlation should be rule-oriented, testable and independent of dashboard DOM assumptions.

## Runtime services

Files:

- `lib/memory-runtime-service.js`
- `lib/incident-lifecycle-service.js`
- `lib/playback-session-service.js`
- `lib/zone-state-service.js`
- `lib/memory-sampler.js`
- `lib/process-memory-monitor.js`

Responsibilities:

- Maintain memory runtime samples, trends and memory-related alerts.
- Maintain incident lifecycle state: start, degrade, recover and dedupe counters.
- Maintain playback session lifecycle and playback timeline completion events.
- Maintain zone and endpoint state.
- Keep domain behaviour outside `app-main.js`.

These services are the primary extension points for future Roon diagnostics features.

## Analysis modules

Files:

- `lib/memory-analysis.js`
- `lib/memory-trends.js`
- `lib/gc-analysis.js`
- `lib/incident-detector.js`
- `lib/timeline-detector.js`
- `lib/log-classification.js`
- `lib/log-patterns.js`
- `lib/thresholds.js`

Responsibilities:

- Detect incidents and timeline events.
- Interpret memory and GC behaviour.
- Classify relevant log patterns.
- Apply thresholds and severity mappings.

## Runtime state and metrics

Files:

- `lib/runtime-state.js`
- `lib/metrics-store.js`

Responsibilities:

- Keep bounded in-memory state.
- Store memory points, incidents, timeline events, playback metrics and zone state.
- Store normalized events, runtime signals, parser errors and quality counters.
- Provide stable snapshots to dashboard/data builders.

Design rule: runtime state is internal; frontend contracts should be shaped by the dashboard data layer.

## Dashboard API and data contract

Files:

- `lib/dashboard-service.js`
- `lib/api-routes.js`
- `lib/dashboard-data-builder.js`
- `lib/dashboard-data-contract.js`
- `lib/dashboard-html.js`

Responsibilities:

- Start the local dashboard API/server.
- Convert runtime state into frontend-ready payloads.
- Preserve stable frontend contracts and legacy aliases where needed.
- Keep HTML/API concerns away from parser and runtime services.

## Frontend architecture

Files:

- `public/frontend.js`
- `public/js/dashboard-controller.js`
- `public/js/api-client.js`
- `public/js/data-contract.js`
- `public/js/dom-bindings.js`
- `public/js/ui-state.js`
- `public/js/ui-interactions.js`
- `public/js/error-state.js`
- `public/js/render-*.js`
- `public/style.css`

Responsibilities:

- Poll dashboard API.
- Render status cards, memory panels, runtime health, incidents, timeline, playback, zones and live logs.
- Preserve UI preferences.
- Avoid owning runtime or detection logic.

Design rule: frontend modules render data; they should not duplicate backend diagnostics logic.

## Notifications

Files:

- `lib/notification-service.js`

Responsibilities:

- Format alerts.
- Map severities.
- Route notifications through platform capabilities where available.

## Testing and architecture fitness

Files:

- `test/*.test.js`
- `scripts/architecture-check.js`

Validation commands:

```bash
npm test
npm run architecture:check
node --check app.js
```

`npm test` runs Node.js tests and architecture guardrails. The architecture check protects important boundaries such as app-main size, service extraction and parser/pipeline structure.


## Release-candidate quality gates

The Release Candidate preparation step adds an explicit validation layer around the refactored architecture. A release candidate should pass the following commands before it is shared:

```bash
npm test
npm run architecture:check
npm run release:check
node app.js --diagnose --no-cleanup
```

The release check validates that `package.json`, `release-info.js`, README, startup documentation, runtime capabilities, release history and `lib/command-registry.js` describe the same application version and the same operator-facing commands. This prevents documentation drift after refactoring.

The architectural acceptance criteria for this stage are:

- `app.js` remains a tiny bootstrap entry point.
- `lib/app-main.js` remains an orchestration layer and delegates runtime domains to services.
- New log knowledge enters through `RawLogLine → ParsedLogLine → NormalizedEvent → RuntimeSignal`.
- Platform-specific decisions stay behind the platform adapter or dedicated discovery/notification boundaries.
- Parser, correlation and runtime services are testable without the dashboard UI.
- Startup variants, CLI flags and release metadata are documented in lockstep with the code.

## Refactoring extension rules

When adding new features:

1. Add new log knowledge as a parser or domain event first.
2. Add correlation rules over normalized events, not scattered raw-string checks.
3. Put domain lifecycle behaviour into a runtime service.
4. Expose data through `dashboard-data-builder.js` / dashboard data contracts.
5. Render in frontend modules without duplicating backend analysis.
6. Add at least one focused regression test or architecture guardrail.
7. Update `README.md`, `docs/startup-options.md`, `docs/runtime-capabilities.md`, `docs/release-history.md` and `release-info.js` when runtime behaviour or startup options change.
