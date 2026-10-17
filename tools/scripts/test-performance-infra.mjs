import test from 'node:test';
import assert from 'node:assert/strict';
import { distribution, validateWindow, investigationEnvelope, compareReferences, createBaseline, evaluateBaseline } from './lib/performance-report.mjs';

const sample = () => ({ level: 'fase1', root: 'root-a', generation: 1, minimumFrames: 3, minimumDurationMs: 30, elapsedMs: 32,
  quality: { pixelRatio: 1, buffer: [1280, 720], shadows: true, bloom: true, shadowSize: [2048, 2048], passes: [true, true, true, true] },
  frames: [0, 16, 32].map((rafTimestamp) => ({ level: 'fase1', root: 'root-a', generation: 1, state: 'playing', calls: 200, triangles: 5000,
    updateMs: 1, renderMs: 4, frameCpuMs: 6, rafTimestamp })) });

test('percentis interpolados e dispersão preservam uma cauda lenta real', () => {
  const stats = distribution([10, 10, 10, 10, 100]);
  assert.equal(stats.p50, 10); assert.equal(stats.mean, 28);
  assert.ok(Math.abs(stats.p95 - 82) < 1e-9); assert.equal(stats.mad, 0);
  assert.ok(stats.stddev > 30);
  assert.throws(() => distribution([])); assert.throws(() => distribution([NaN]));
});
test('prova negativa: render removido não pode parecer um ganho de desempenho', () => {
  const value = sample(); assert.deepEqual(validateWindow(value), []);
  value.frames.forEach((f) => { f.calls = 0; f.triangles = 0; f.renderMs = 0; });
  assert.deepEqual(validateWindow(value), ['draw: scene was not rendered']);
});
test('prova negativa: qualidade reduzida e reload misturado são recusados', () => {
  const value = sample(); value.quality.bloom = false; value.frames[1].root = 'root-b';
  assert.ok(validateWindow(value).some((e) => e.startsWith('quality:')));
  assert.ok(validateWindow(value).some((e) => e.startsWith('identity:')));
});
test('limite é calculado da dispersão observada; referências de outro SHA não se misturam', () => {
  assert.equal(investigationEnvelope([100, 100, 100, 100, 100, 100], 5).upper, 110);
  assert.equal(investigationEnvelope([100, 100, 100, 100, 100, 150], 5).upper, 200);
  const [a, b] = references(); b.commit = 'another-commit';
  assert.throws(() => compareReferences(a, b), /same commit/);
});

function references() {
  return ['a', 'b'].map((reference, index) => ({ reference, run: '123', attempt: '1', passed: true, commit: 'same-sha', buildHash: 'same-build',
    startedAtUtc: `2026-10-18T00:0${index * 2}:00Z`, endedAtUtc: `2026-10-18T00:0${index * 2 + 1}:00Z`,
    environment: { runner: 'same-runner' }, conditions: { quality: 'full' }, levels: ['fase1'],
    samples: [1, 2, 3].map(() => ({ level: 'fase1', measured: true, quality: { bloom: true }, camera: [1, 2, 3],
      summary: { cadenceMs: { p95: 16 }, frameCpuMs: { p95: 12 } },
      load: { startedAt: 100, loadedAt: 110, firstUiReleasedRenderAt: 120 }, heap: { usedSize: 1024 } })) }));
}
test('duas referências válidas combinam; duplicata A, execução diferente e sobreposição são recusadas', () => {
  const [a, b] = references();
  assert.equal(compareReferences(a, b)[0].metrics.loadMs.envelope.count, 6);
  assert.throws(() => compareReferences(a, a), /distinct A\/B/);
  assert.throws(() => compareReferences(a, { ...b, run: '456' }), /same run/);
  assert.throws(() => compareReferences(a, { ...b, startedAtUtc: a.startedAtUtc }), /sequential/);
});
test('baseline fixa acusa excesso futuro; novo ambiente não é comparado nem recalibra o limite', () => {
  const [a, b] = references(), comparison = compareReferences(a, b);
  const baseline = { ...createBaseline(a, comparison), status: 'adopted' };
  const oldLimit = baseline.phases[0].limits.cadenceP95Ms;
  const changed = structuredClone(comparison);
  changed[0].metrics.cadenceP95Ms.envelope.max = oldLimit + 100;
  const result = evaluateBaseline(baseline, a, changed);
  assert.equal(result.comparable, true);
  assert.equal(result.metrics.find((m) => m.metric === 'cadenceP95Ms').requiresInvestigation, true);
  assert.equal(baseline.phases[0].limits.cadenceP95Ms, oldLimit);
  assert.equal(evaluateBaseline(baseline, { ...a, environment: { cpu: 'different' } }, changed).comparable, false);
});
