// Estatística descritiva. Nenhum número deste módulo é uma meta de FPS.
export function distribution(values) {
  if (!values.length || values.some((n) => !Number.isFinite(n) || n < 0)) throw new Error('invalid performance sample');
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p) => {
    const index = (sorted.length - 1) * p, lower = Math.floor(index);
    return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
  };
  const median = percentile(0.5), mean = values.reduce((a, b) => a + b, 0) / values.length;
  const deviations = values.map((n) => Math.abs(n - median)).sort((a, b) => a - b);
  const middle = (deviations.length - 1) / 2;
  return { count: values.length, min: sorted[0], max: sorted.at(-1), mean,
    p50: median, p90: percentile(0.9), p95: percentile(0.95), p99: percentile(0.99),
    stddev: Math.sqrt(values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / values.length),
    mad: (deviations[Math.floor(middle)] + deviations[Math.ceil(middle)]) / 2 };
}

export function validateWindow(sample) {
  const errors = [];
  if (!sample.level || !sample.root || !Number.isInteger(sample.generation) || sample.generation < 0) errors.push('identity: missing level/load/root');
  const q = sample.quality;
  if (!q || q.pixelRatio !== 1 || q.buffer.join('x') !== '1280x720' || !q.shadows || !q.bloom ||
      q.shadowSize.join('x') !== '2048x2048' || q.passes.length !== 4 || !q.passes.every(Boolean)) errors.push('quality: reduced rendering');
  if (sample.frames.length < sample.minimumFrames || sample.elapsedMs < sample.minimumDurationMs) errors.push('sample: insufficient duration/frames');
  for (const frame of sample.frames) {
    if (frame.level !== sample.level || frame.root !== sample.root || frame.generation !== sample.generation || frame.state !== 'playing') errors.push('identity: mixed level/load/state');
    if (!(frame.calls > 20 && frame.triangles > 1000)) errors.push('draw: scene was not rendered');
    for (const key of ['updateMs', 'renderMs', 'frameCpuMs', 'rafTimestamp']) {
      if (!Number.isFinite(frame[key]) || frame[key] < 0) errors.push(`timing: invalid ${key}`);
    }
  }
  const intervals = sample.frames.slice(1).map((f, i) => f.rafTimestamp - sample.frames[i].rafTimestamp);
  if (!intervals.length || intervals.some((n) => !(n > 0))) errors.push('timing: invalid rAF cadence');
  return [...new Set(errors)];
}

export function summarizeWindow(sample) {
  return {
    cadenceMs: distribution(sample.frames.slice(1).map((f, i) => f.rafTimestamp - sample.frames[i].rafTimestamp)),
    updateMs: distribution(sample.frames.map((f) => f.updateMs)),
    renderMs: distribution(sample.frames.map((f) => f.renderMs)),
    frameCpuMs: distribution(sample.frames.map((f) => f.frameCpuMs)),
  };
}

export function investigationEnvelope(values, floor) {
  const stats = distribution(values);
  // Limite exploratório calculado APÓS medir: inclui dispersão observada e margem.
  // Serve para investigar nova medição equivalente, nunca para aprovar GPU física.
  return { ...stats, upper: stats.max + Math.max(stats.max - stats.min, 3 * stats.mad, stats.p50 * 0.1, floor) };
}

export function compareReferences(a, b) {
  if (a.reference !== 'a' || b.reference !== 'b' || !a.run || !a.attempt || a.run !== b.run || a.attempt !== b.attempt) throw new Error('distinct A/B references must belong to the same run/attempt');
  const times = [a.startedAtUtc, a.endedAtUtc, b.startedAtUtc, b.endedAtUtc].map(Date.parse);
  if (times.some((t) => !Number.isFinite(t)) || times.some((t, i) => i > 0 && t < times[i - 1])) throw new Error('references must be sequential and timestamped');
  if (!a.passed || !b.passed || !a.commit || !a.buildHash || a.commit !== b.commit || a.buildHash !== b.buildHash) throw new Error('references must pass on the same commit/build');
  if (JSON.stringify(a.environment) !== JSON.stringify(b.environment) || JSON.stringify(a.conditions) !== JSON.stringify(b.conditions) ||
      JSON.stringify(a.levels) !== JSON.stringify(b.levels)) throw new Error('incomparable environment/protocol/catalog');
  return a.levels.map((level) => {
    const visitsA = a.samples.filter((s) => s.level === level && s.measured);
    const visitsB = b.samples.filter((s) => s.level === level && s.measured);
    if (visitsA.length !== 3 || visitsB.length !== 3) throw new Error(`incomplete references: ${level}`);
    const visits = [...visitsA, ...visitsB];
    if (visits.some((s) => JSON.stringify(s.quality) !== JSON.stringify(visits[0].quality) || JSON.stringify(s.camera) !== JSON.stringify(visits[0].camera))) throw new Error(`incomparable quality/camera: ${level}`);
    const fields = {
      cadenceP95Ms: (s) => s.summary.cadenceMs.p95,
      frameCpuP95Ms: (s) => s.summary.frameCpuMs.p95,
      loadMs: (s) => s.load.loadedAt - s.load.startedAt,
      uiReleasedRenderMs: (s) => s.load.firstUiReleasedRenderAt - s.load.startedAt,
      heapUsedBytes: (s) => s.heap.usedSize,
    };
    return { level, metrics: Object.fromEntries(Object.entries(fields).map(([metric, read]) => {
      const valuesA = visitsA.map(read), valuesB = visitsB.map(read);
      const envelope = investigationEnvelope([...valuesA, ...valuesB], metric.endsWith('Bytes') ? 1048576 : metric.includes('P95') ? 5 : 50);
      return [metric, { referenceA: distribution(valuesA), referenceB: distribution(valuesB), rawA: valuesA, rawB: valuesB, envelope }];
    })) };
  });
}

export const REFERENCE_LEVELS = ['fase1', 'fase2', 'fase3', 'fase4', 'fase5'];

export function aggregateReferences(pairs) {
  if (pairs.length !== 5 || new Set(pairs.map((p) => p.level)).size !== 5 ||
      pairs.some((p) => !REFERENCE_LEVELS.includes(p.level))) throw new Error('exactly five distinct phase pairs are required');
  const first = pairs[0].a;
  const phases = REFERENCE_LEVELS.map((level) => {
    const { a, b } = pairs.find((p) => p.level === level);
    for (const reference of [a, b]) {
      if (reference.schema !== 2 || reference.selectedLevel !== level || JSON.stringify(reference.levels) !== JSON.stringify([level]) ||
          JSON.stringify(reference.catalog) !== JSON.stringify(REFERENCE_LEVELS)) throw new Error(`wrong isolated phase/catalog: ${level}`);
      if (reference.commit !== first.commit || reference.buildHash !== first.buildHash || reference.run !== first.run || reference.attempt !== first.attempt ||
          JSON.stringify(reference.conditions) !== JSON.stringify(first.conditions)) throw new Error('all phases must share SHA/build/run/attempt/protocol');
      if (reference.conditions.protocol !== 'isolated-level-v2' || reference.conditions.minimumFrames !== 20 || reference.conditions.minimumDurationMs !== 8000) throw new Error('isolated protocol was reduced or changed');
      if (reference.samples.length !== 4 || [0, 1, 2, 3].some((cycle) => reference.samples.filter((s) => s.cycle === cycle && s.level === level && s.measured === (cycle > 0)).length !== 1)) throw new Error(`incomplete isolated visits: ${level}`);
      for (const sample of reference.samples) {
        const errors = validateWindow(sample);
        if (errors.length || (sample.measured && (sample.frames.length < 20 || sample.minimumFrames !== 20 || sample.minimumDurationMs !== 8000))) throw new Error(`invalid isolated window ${level}: ${errors.join('; ') || 'reduced sample'}`);
      }
      if (JSON.stringify(reference.negativeProof?.rejectedBy) !== JSON.stringify(['draw: scene was not rendered'])) throw new Error(`missing real negative proof: ${level}`);
    }
    const comparison = compareReferences(a, b)[0];
    const sample = a.samples.find((s) => s.measured);
    return { ...comparison, environment: a.environment, conditions: a.conditions, quality: sample.quality, camera: sample.camera };
  });
  return { schema: 2, commit: first.commit, buildHash: first.buildHash, run: first.run, attempt: first.attempt, phases };
}

export function createBaseline(aggregate) {
  return { schema: 2, status: 'candidate-not-adopted', commit: aggregate.commit, buildHash: aggregate.buildHash, run: aggregate.run, attempt: aggregate.attempt,
    phases: aggregate.phases.map(({ level, environment: originalEnvironment, conditions, quality, camera, metrics }) => {
      const { runner: _runner, ...environment } = originalEnvironment;
      return { level, environment, conditions, quality, camera,
        limits: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, value.envelope.upper])) };
    }) };
}

export function evaluateBaseline(baseline, aggregate) {
  const candidate = createBaseline(aggregate);
  const commonReasons = [];
  if (baseline.schema !== 2 || baseline.status !== 'adopted' || !baseline.commit || !baseline.buildHash || !baseline.run) commonReasons.push('baseline must be explicitly adopted and identify its schema/source');
  if (JSON.stringify(baseline.phases?.map((p) => p.level)) !== JSON.stringify(REFERENCE_LEVELS)) commonReasons.push('baseline catalog changed or incomplete');
  return { baselineCommit: baseline.commit, baselineRun: baseline.run, phases: candidate.phases.map((current) => {
    const phase = baseline.phases?.find((p) => p.level === current.level), reasons = [...commonReasons];
    if (JSON.stringify(phase?.environment) !== JSON.stringify(current.environment)) reasons.push('environment changed; do not compare timings');
    if (JSON.stringify(phase?.conditions) !== JSON.stringify(current.conditions)) reasons.push('protocol changed');
    if (JSON.stringify(phase?.quality) !== JSON.stringify(current.quality) || JSON.stringify(phase?.camera) !== JSON.stringify(current.camera)) reasons.push('quality/camera changed');
    const metrics = [];
    if (!reasons.length) for (const [metric, value] of Object.entries(aggregate.phases.find((p) => p.level === current.level).metrics)) {
      const upper = phase.limits[metric];
      if (!Number.isFinite(upper) || upper <= 0) { reasons.push(`invalid baseline limit: ${metric}`); continue; }
      metrics.push({ metric, baselineUpper: upper, observedMax: value.envelope.max, requiresInvestigation: value.envelope.max > upper });
    }
    return { level: current.level, comparable: !reasons.length, reasons, metrics: reasons.length ? [] : metrics };
  }) };
}
