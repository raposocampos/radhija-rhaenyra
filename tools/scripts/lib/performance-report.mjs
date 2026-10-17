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

export function createBaseline(reference, comparison) {
  const { runner: _runner, ...environment } = reference.environment;
  return { schema: 1, status: 'candidate-not-adopted', commit: reference.commit, run: reference.run, attempt: reference.attempt,
    environment, conditions: reference.conditions,
    phases: comparison.map(({ level, metrics }) => {
      const sample = reference.samples.find((s) => s.level === level && s.measured);
      return { level, quality: sample.quality, camera: sample.camera,
        limits: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, value.envelope.upper])) };
    }) };
}

export function evaluateBaseline(baseline, reference, comparison) {
  const candidate = createBaseline(reference, comparison), reasons = [];
  if (baseline.schema !== 1 || baseline.status !== 'adopted' || !baseline.commit || !baseline.run) reasons.push('baseline must be explicitly adopted and identify its source');
  if (JSON.stringify(baseline.environment) !== JSON.stringify(candidate.environment)) reasons.push('environment changed; do not compare timings');
  if (JSON.stringify(baseline.conditions) !== JSON.stringify(candidate.conditions)) reasons.push('protocol changed');
  if (JSON.stringify(baseline.phases?.map((p) => ({ level: p.level, quality: p.quality, camera: p.camera }))) !==
      JSON.stringify(candidate.phases.map((p) => ({ level: p.level, quality: p.quality, camera: p.camera })))) reasons.push('catalog/quality/camera changed');
  const metrics = [];
  if (!reasons.length) for (const row of comparison) {
    const phase = baseline.phases.find((p) => p.level === row.level);
    for (const [metric, value] of Object.entries(row.metrics)) {
      const upper = phase.limits[metric];
      if (!Number.isFinite(upper) || upper <= 0) { reasons.push(`invalid baseline limit: ${row.level}/${metric}`); continue; }
      metrics.push({ level: row.level, metric, baselineUpper: upper, observedMax: value.envelope.max,
        requiresInvestigation: value.envelope.max > upper });
    }
  }
  return { comparable: !reasons.length, baselineCommit: baseline.commit, baselineRun: baseline.run,
    reasons, metrics: reasons.length ? [] : metrics };
}
