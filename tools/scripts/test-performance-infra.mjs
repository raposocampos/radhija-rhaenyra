import test from 'node:test';
import assert from 'node:assert/strict';
import { distribution, validateWindow, investigationEnvelope, compareReferences, aggregateReferences, createBaseline, evaluateBaseline, REFERENCE_LEVELS } from './lib/performance-report.mjs';

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

function references(level = 'fase1') {
  return ['a', 'b'].map((reference, index) => ({ schema: 2, selectedLevel: level, reference, run: '123', attempt: '1', passed: true, commit: 'same-sha', buildHash: 'same-build',
    startedAtUtc: `2026-10-18T00:0${index * 2}:00Z`, endedAtUtc: `2026-10-18T00:0${index * 2 + 1}:00Z`,
    environment: { runner: `runner-${level}`, cpu: `cpu-${level}` }, conditions: { protocol: 'isolated-level-v2', minimumFrames: 20, minimumDurationMs: 8000 }, levels: [level], catalog: REFERENCE_LEVELS,
    negativeProof: { rejectedBy: ['draw: scene was not rendered'] },
    samples: [0, 1, 2, 3].map((cycle) => ({ ...sample(), cycle, level, root: `${level}-${cycle}`, generation: cycle, measured: cycle > 0,
      minimumFrames: cycle ? 20 : 4, minimumDurationMs: cycle ? 8000 : 1000, elapsedMs: cycle ? 9000 : 1800,
      frames: Array.from({ length: cycle ? 20 : 4 }, (_, frame) => ({ ...sample().frames[0], level, root: `${level}-${cycle}`, generation: cycle, rafTimestamp: frame * 450 })), camera: [1, 2, 3],
      summary: { cadenceMs: { p95: 450 }, frameCpuMs: { p95: 12 } },
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
  const aggregate = aggregateReferences(pairs());
  const baseline = { ...createBaseline(aggregate), status: 'adopted' };
  const oldLimit = baseline.phases[0].limits.cadenceP95Ms;
  const changed = structuredClone(aggregate);
  changed.phases[0].metrics.cadenceP95Ms.envelope.max = oldLimit + 100;
  const result = evaluateBaseline(baseline, changed);
  assert.equal(result.phases[0].comparable, true);
  assert.equal(result.phases[0].metrics.find((m) => m.metric === 'cadenceP95Ms').requiresInvestigation, true);
  assert.equal(baseline.phases[0].limits.cadenceP95Ms, oldLimit);
  changed.phases[0].environment.cpu = 'different';
  const mismatch = evaluateBaseline(baseline, changed);
  assert.equal(mismatch.phases[0].comparable, false);
  assert.equal(mismatch.phases[1].comparable, true, 'ambiente de outra fase permanece comparável');
});

function pairs() { return REFERENCE_LEVELS.map((level) => { const [a, b] = references(level); return { level, a, b }; }); }
test('agregação exige cinco pares completos e preserva ambiente próprio de cada fase', () => {
  const values = pairs(), aggregate = aggregateReferences(values);
  assert.equal(aggregate.phases.length, 5);
  assert.notEqual(aggregate.phases[0].environment.cpu, aggregate.phases[1].environment.cpu);
  assert.throws(() => aggregateReferences(values.slice(0, 4)), /five distinct/);
  assert.throws(() => aggregateReferences([...values.slice(0, 4), values[0]]), /five distinct/);
  assert.throws(() => aggregateReferences([...values, values[0]]), /five distinct/);
  values[2].b.selectedLevel = 'fase1';
  assert.throws(() => aggregateReferences(values), /wrong isolated phase/);
});
test('agregação recusa mistura de SHA/build/run, visita/prova ausente e qualidade diferente no par', () => {
  for (const field of ['commit', 'buildHash', 'run', 'attempt']) {
    const values = pairs(); values[1].a[field] = values[1].b[field] = 'different';
    assert.throws(() => aggregateReferences(values), /share SHA/);
  }
  const missing = pairs(); missing[1].b.samples.pop();
  assert.throws(() => aggregateReferences(missing), /incomplete isolated visits/);
  const negative = pairs(); negative[1].b.negativeProof = null;
  assert.throws(() => aggregateReferences(negative), /missing real negative/);
  const quality = pairs(); quality[1].b.samples[1].quality.bloom = false;
  assert.throws(() => aggregateReferences(quality), /invalid isolated window.*quality/);
  const inverted = pairs(); [inverted[1].a, inverted[1].b] = [inverted[1].b, inverted[1].a];
  assert.throws(() => aggregateReferences(inverted), /distinct A\/B/);
});
