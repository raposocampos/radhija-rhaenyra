// Primitivas de síntese (envelopes, osciladores, filtros, ruído, FM) e "instrumentos" reutilizados
// pela biblioteca de sons: latido com formantes, squeak de borracha, grasnado, asas, gotas e boing.
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// ---------------------------------------------------------------------------
//  Primitivas
// ---------------------------------------------------------------------------
export function env(param, t, { a = 0.005, peak = 1, d = 0.2, hold = 0 }) {
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) param.setValueAtTime(peak, t + a + hold);
  param.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
}
export function gn(G, v = 0) {
  const g = G.ctx.createGain();
  g.gain.value = v;
  return g;
}
export function flt(G, type, f, q = 1) {
  const b = G.ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}
export function osc(G, type, f, t, stop) {
  const o = G.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(stop);
  return o;
}
export function noiseSrc(G, t, stop, buf) {
  const s = G.ctx.createBufferSource();
  s.buffer = buf || G.noise;
  s.loop = true;
  s.start(t, Math.random() * (s.buffer.duration - 0.1));
  s.stop(stop);
  return s;
}
// Tom simples com glide, vibrato e filtro opcionais.
export function tone(G, dest, o) {
  const { type = 'sine', f, to, glideT, t, a = 0.005, d = 0.2, hold = 0, peak = 0.2, vib = 0, vibRate = 6, filt } = o;
  const end = t + a + hold + d;
  const s = osc(G, type, f, t, end + 0.05);
  if (to) s.frequency.exponentialRampToValueAtTime(to, t + (glideT ?? a + hold + d));
  if (vib) {
    const l = osc(G, 'sine', vibRate, t, end + 0.05);
    const lg = gn(G, vib);
    l.connect(lg);
    lg.connect(s.frequency);
  }
  const g = gn(G, 0);
  env(g.gain, t, { a, peak, d, hold });
  if (filt) {
    const fl = flt(G, filt.type || 'bandpass', filt.f, filt.q ?? 1);
    s.connect(fl);
    fl.connect(g);
  } else s.connect(g);
  g.connect(dest);
  return { s, g, end };
}
// Ruído filtrado com envelope.
export function nz(G, dest, o) {
  const { t, d = 0.1, a = 0.002, hold = 0, peak = 0.2, type = 'bandpass', f = 1000, to, toT, q = 1, buf } = o;
  const end = t + a + hold + d;
  const s = noiseSrc(G, t, end + 0.05, buf);
  const fl = flt(G, type, f, q);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + (toT ?? a + hold + d));
  const g = gn(G, 0);
  env(g.gain, t, { a, peak, d, hold });
  s.connect(fl);
  fl.connect(g);
  g.connect(dest);
  return { s, fl, g, end };
}
// Nota FM (sino / marimba).
export function fm(G, dest, o) {
  const { f, t, d = 0.6, peak = 0.2, ratio = 3.5, index = 2, idxD = 0.12, a = 0.003 } = o;
  const end = t + a + d;
  const car = osc(G, 'sine', f, t, end + 0.05);
  const mod = osc(G, 'sine', f * ratio, t, end + 0.05);
  const mg = gn(G, 0);
  mg.gain.setValueAtTime(f * index, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * index * 0.02), t + idxD);
  mod.connect(mg);
  mg.connect(car.frequency);
  const g = gn(G, 0);
  env(g.gain, t, { a, peak, d });
  car.connect(g);
  g.connect(dest);
  return end;
}
export function marimba(G, dest, f, t, peak, d = 0.55) {
  fm(G, dest, { f, t, d: d * 0.5, peak: peak * 0.7, ratio: 4, index: 1.6, idxD: 0.03, a: 0.002 });
  tone(G, dest, { type: 'sine', f, t, a: 0.003, d, peak: peak * 0.75 });
  tone(G, dest, { type: 'sine', f: f * 2, t, a: 0.002, d: d * 0.35, peak: peak * 0.18 });
}

// ---------------------------------------------------------------------------
//  Latido com formantes (glissando + passa-bandas em paralelo)
// ---------------------------------------------------------------------------
export function bark(G, dest, t, p, c) {
  const d = c.dur;
  const end = t + d + 0.06;
  const src = osc(G, 'sawtooth', c.f0 * 0.82 * p, t, end);
  src.frequency.linearRampToValueAtTime(c.f0 * 1.28 * p, t + d * 0.28);
  src.frequency.exponentialRampToValueAtTime(c.f0 * 0.8 * p, t + d);
  const sub = osc(G, 'triangle', c.f0 * 0.82 * p, t, end);
  sub.frequency.linearRampToValueAtTime(c.f0 * 1.28 * p, t + d * 0.28);
  sub.frequency.exponentialRampToValueAtTime(c.f0 * 0.8 * p, t + d);

  const amp = gn(G, 0);
  env(amp.gain, t, { a: 0.008, hold: d * 0.3, d: d * 0.7, peak: c.peak });
  const soft = flt(G, 'lowpass', 5200, 0.5);
  amp.connect(soft);
  soft.connect(dest);

  const F1 = flt(G, 'bandpass', c.f1 * p, 4.5);
  F1.frequency.setValueAtTime(c.f1 * 0.85 * p, t);
  F1.frequency.linearRampToValueAtTime(c.f1 * 1.25 * p, t + d * 0.3);
  F1.frequency.linearRampToValueAtTime(c.f1 * 0.9 * p, t + d);
  const F2 = flt(G, 'bandpass', c.f2 * p, 7);
  const g1 = gn(G, 1.0);
  const g2 = gn(G, 0.55);
  src.connect(F1); F1.connect(g1); g1.connect(amp);
  src.connect(F2); F2.connect(g2); g2.connect(amp);
  const body = flt(G, 'lowpass', c.f0 * 2.2 * p, 0.7);
  const gb = gn(G, 0.22);
  sub.connect(body); body.connect(gb); gb.connect(amp);
  // respiração
  nz(G, dest, { t, a: 0.004, d: d * 0.8, peak: c.peak * 0.05, type: 'bandpass', f: 3600, q: 1.2 });
  return d + 0.1;
}

// ---------------------------------------------------------------------------
//  Squeak de brinquedo de borracha
// ---------------------------------------------------------------------------
export function squeak(G, dest, t, p, f1, f2, f3, d, peak) {
  const end = t + d + 0.05;
  const mk = (type) => {
    const s = osc(G, type, f1 * p, t, end);
    s.frequency.exponentialRampToValueAtTime(f2 * p, t + d * 0.38);
    s.frequency.exponentialRampToValueAtTime(f3 * p, t + d);
    return s;
  };
  const tri = mk('triangle');
  const sq = mk('square');
  const lfo = osc(G, 'sine', 31, t, end);
  const lg = gn(G, 26 * p);
  lfo.connect(lg); lg.connect(tri.frequency); lg.connect(sq.frequency);
  const amp = gn(G, 0);
  env(amp.gain, t, { a: 0.012, hold: d * 0.45, d: d * 0.55, peak });
  const sqLp = flt(G, 'lowpass', 3800, 0.8);
  const sqG = gn(G, 0.16);
  tri.connect(amp);
  sq.connect(sqLp); sqLp.connect(sqG); sqG.connect(amp);
  // tremolo de "borracha"
  const trem = osc(G, 'sine', 42, t, end);
  const tg = gn(G, 0.25);
  const ampMod = gn(G, 0.75);
  trem.connect(tg); tg.connect(ampMod.gain);
  amp.connect(ampMod);
  ampMod.connect(dest);
}

// Grasnado cômico: dente-de-serra nasal com formantes, curva "a-HONK".
export function honk(G, dest, t, p, { f = 380, d = 0.22, peak = 0.32, bend = 1.18, end = 0.86 } = {}) {
  const stop = t + d + 0.06;
  const mk = (type, mult) => {
    const s = osc(G, type, f * 0.9 * p * mult, t, stop);
    s.frequency.linearRampToValueAtTime(f * bend * p * mult, t + d * 0.25);
    s.frequency.exponentialRampToValueAtTime(f * end * p * mult, t + d);
    return s;
  };
  const saw = mk('sawtooth', 1);
  const sq = mk('square', 1.005);
  const amp = gn(G, 0);
  env(amp.gain, t, { a: 0.012, hold: d * 0.45, d: d * 0.55, peak });
  const F1 = flt(G, 'bandpass', 1050 * p, 3.2);
  const F2 = flt(G, 'bandpass', 2350 * p, 6);
  const F3 = flt(G, 'lowpass', 600 * p, 0.8);
  const g1 = gn(G, 1.0);
  const g2 = gn(G, 0.6);
  const g3 = gn(G, 0.35);
  const sqG = gn(G, 0.4);
  saw.connect(F1); F1.connect(g1); g1.connect(amp);
  saw.connect(F2); F2.connect(g2); g2.connect(amp);
  sq.connect(sqG); sqG.connect(F3); F3.connect(g3); g3.connect(amp);
  // vibrato áspero (garganta)
  const l = osc(G, 'sine', 34, t, stop);
  const lg = gn(G, f * 0.035 * p);
  l.connect(lg); lg.connect(saw.frequency); lg.connect(sq.frequency);
  amp.connect(dest);
  nz(G, dest, { t, a: 0.006, d: d * 0.5, peak: peak * 0.08, type: 'bandpass', f: 2800, q: 1.4 });
  return d + 0.06;
}
// Batidas de asa: rajadas de ruído grave.
export function flaps(G, dest, t, n, rate, peak) {
  for (let i = 0; i < n; i++) {
    const tt = t + i / rate + rnd(-0.008, 0.008);
    nz(G, dest, { t: tt, a: 0.01, d: 0.07, peak: peak * rnd(0.75, 1), type: 'bandpass', f: rnd(380, 560), q: 0.9, buf: G.pink });
  }
  return n / rate + 0.1;
}
// Gotinhas: blips senoidais caindo de altura.
export function drips(G, dest, t, n, spread, peak, lo = 1400, hi = 3200) {
  for (let i = 0; i < n; i++) {
    const tt = t + Math.random() * spread;
    const f = rnd(lo, hi);
    tone(G, dest, { type: 'sine', f, to: f * 0.55, t: tt, a: 0.002, d: 0.05, peak: peak * rnd(0.5, 1) });
  }
}
export function boing(G, dest, t, p, f0, peak, d = 0.38) {
  const end = t + d + 0.05;
  const s = osc(G, 'triangle', f0 * p, t, end);
  s.frequency.exponentialRampToValueAtTime(f0 * 2 * p, t + 0.05);
  s.frequency.exponentialRampToValueAtTime(f0 * 1.25 * p, t + d);
  const l = osc(G, 'sine', 15, t, end);
  const lg = gn(G, 0);
  lg.gain.setValueAtTime(f0 * 0.18 * p, t);
  lg.gain.exponentialRampToValueAtTime(1, t + d);
  l.connect(lg); lg.connect(s.frequency);
  const lp = flt(G, 'lowpass', 2200, 0.7);
  const g = gn(G, 0);
  env(g.gain, t, { a: 0.004, d, peak });
  s.connect(lp); lp.connect(g); g.connect(dest);
}
