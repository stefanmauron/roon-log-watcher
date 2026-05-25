# Release-candidate checklist

Use this checklist before publishing a Release Candidate build.

## 1. Install and diagnostics

```bash
npm install
npm run init
npm run diagnose
```

Expected result: diagnostics complete without startup exceptions and show the discovered Roon log directories or actionable hints.

## 2. Automated validation

```bash
npm run release:check
```

This runs the regression tests, architecture guardrails and documentation synchronization checks.

## 3. Runtime smoke test

```bash
node app.js --all --interval 0.25 --memory-window --no-cleanup
```

Expected result: dashboard starts, live log processing is active, no `ReferenceError` or startup-order exception appears, and the dashboard is reachable on the configured memory port.

## 4. Dashboard visual check

Check these panels manually:

- Status cards and runtime health load without JavaScript errors.
- Info tooltips are readable near card edges and viewport boundaries.
- Controls & Export buttons remain clickable.
- Runtime Capabilities, What's New and Release History open and collapse correctly.
- Diagnostic summary and live-log export work.

## 5. Documentation check

Confirm that these files reference the current version and startup model:

- `README.md`
- `docs/architecture.md`
- `docs/startup-options.md`
- `docs/runtime-capabilities.md`
- `docs/release-history.md`
- `release-info.js`

## 6. Release decision

A build is RC-ready when automated checks pass, diagnostics are clean, the dashboard smoke test works and the documentation matches the packaged version.
