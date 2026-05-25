'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPipeline } = require('../lib/event-pipeline');
const { createCorrelationEngine } = require('../lib/correlation-engine');
const playbackParser = require('../lib/parsers/playback-parser');

test('event pipeline normalizes playback lines and still calls legacy inspectLine', () => {
  let inspected = null;
  const pipeline = createPipeline({
    parsers: [playbackParser],
    inspectLine(file, line, context) { inspected = { file, line, context }; }
  });
  const result = pipeline('/tmp/RoonServer/Logs/RoonServer_log.txt', '[Living Room] [Enhanced, 44.1kHz 16bit => 44.1kHz 16bit] [10% buf] [PLAYING @ 0:01] Song - Artist');
  assert.equal(result.parsed.source, 'RoonServer/RoonServer_log.txt');
  assert.ok(result.normalizedEvents.some(e => e.type === 'playback.track.detected'));
  assert.ok(inspected.context.normalizedEvents.length >= 1);
});

test('correlation engine emits runtime signal for playback risk', () => {
  const engine = createCorrelationEngine();
  const pipeline = createPipeline({
    parsers: [playbackParser],
    correlationEngine: engine
  });
  const result = pipeline('/tmp/RoonServer/Logs/RoonServer_log.txt', '[zone Living Room] [PLAYING @ 0:01] Song - Artist timeout failed');
  assert.ok(result.runtimeSignals.some(s => s.type === 'runtime.playback-risk.detected'));
});

test('pipeline contains parser errors without stopping legacy processing', () => {
  let inspected = false;
  const badParser = { name: 'bad-parser', parse() { throw new Error('boom'); } };
  const pipeline = createPipeline({
    parsers: [badParser],
    inspectLine() { inspected = true; }
  });
  const result = pipeline('/tmp/RoonServer/Logs/RoonServer_log.txt', '05/25 08:00:00 Info: test');
  assert.equal(inspected, true);
  assert.ok(result.normalizedEvents.some(e => e.type === 'parser.error' && e.parserName === 'bad-parser'));
});

test('correlation engine exposes rule metadata and isolates failing rules', () => {
  const brokenRule = () => { throw new Error('rule failed'); };
  const engine = createCorrelationEngine({ rules: [brokenRule] });
  const pipeline = createPipeline({ parsers: [playbackParser], correlationEngine: engine });
  pipeline('/tmp/RoonServer/Logs/RoonServer_log.txt', '[zone Living Room] [PLAYING @ 0:01] Song - Artist timeout failed');
  const snapshot = engine.snapshot();
  assert.equal(snapshot.ruleCount, 1);
  assert.ok(snapshot.ruleErrors.length >= 1);
});
