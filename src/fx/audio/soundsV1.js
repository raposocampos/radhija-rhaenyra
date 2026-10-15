// Sons da v1: dogs (passos, latidos, arrancada, batida), fase 1 (cordinha, portão, carrinho, cenoura),
// coleta, comemoração, vitória e UI — e as tabelas de mixagem por som (MIN_GAP, PITCH_VAR, VERB).
// Cada som: (G, dest, t, p, opts) → duração (s). A biblioteca completa é montada em ./sounds.js.
import { mtof, clamp, env, gn, flt, osc, tone, nz, fm, marimba, bark, squeak } from './synth.js';

// Intervalo mínimo entre repetições (s) — evita metralhadora de sons.
export const MIN_GAP = {
  step: 0.055, dash: 0.12, pushStart: 0.3, bump: 0.15,
  'bark-radhija': 0.2, 'bark-rhaenyra': 0.24, tug: 0.3, latch: 0.2, gateCreak: 0.4,
  reveal: 0.5, pickupCarrot: 0.3, collect: 0.05, switch: 0.12,
  uiClick: 0.04, uiHover: 0.07, pause: 0.15, resume: 0.15, celebrate: 0.6, victory: 1.5,
};
// Variação aleatória de altura (fração) por som.
export const PITCH_VAR = {
  step: 0.12, dash: 0.08, bump: 0.08, 'bark-radhija': 0.05, 'bark-rhaenyra': 0.05,
  tug: 0.06, latch: 0.04, gateCreak: 0.05, pickupCarrot: 0.04, collect: 0.0,
  uiClick: 0.03, uiHover: 0.04, switch: 0.02, reveal: 0, celebrate: 0, victory: 0,
};
// Envio para o reverb.
export const VERB = {
  step: 0, dash: 0.05, bump: 0.05, 'bark-radhija': 0.12, 'bark-rhaenyra': 0.12, tug: 0.08,
  latch: 0.15, gateCreak: 0.15, reveal: 0.45, pickupCarrot: 0.12, collect: 0.3, switch: 0.15,
  celebrate: 0.3, victory: 0.28, uiClick: 0, uiHover: 0, pause: 0.1, resume: 0.1,
};
export const UI_SOUNDS = new Set(['uiClick', 'uiHover', 'pause', 'resume']);
export const LOW_PRIORITY = new Set(['step', 'uiHover', 'bump']);

// ---------------------------------------------------------------------------
//  Biblioteca de sons: (G, dest, t, p, opts) → duração (s)
// ---------------------------------------------------------------------------
export const SOUNDS = {
  step(G, o, t, p, opts) {
    const sp = clamp(opts.speed ?? 2, 0.5, 6);
    const lvl = 0.07 + 0.05 * Math.min(1, sp / 4);
    nz(G, o, { t, a: 0.002, d: 0.045, peak: lvl, type: 'bandpass', f: 2600 * p, q: 0.8 });
    nz(G, o, { t: t + 0.012, a: 0.002, d: 0.03, peak: lvl * 0.6, type: 'bandpass', f: 4200 * p, q: 1.2 });
    nz(G, o, { t, a: 0.003, d: 0.04, peak: lvl * 1.2, type: 'lowpass', f: 380 * p, q: 0.7 });
    return 0.1;
  },
  dash(G, o, t, p) {
    const w = nz(G, o, { t, a: 0.07, d: 0.3, peak: 0.34, type: 'bandpass', f: 420 * p, q: 1.6 });
    w.fl.frequency.cancelScheduledValues(t);
    w.fl.frequency.setValueAtTime(420 * p, t);
    w.fl.frequency.exponentialRampToValueAtTime(1900 * p, t + 0.11);
    w.fl.frequency.exponentialRampToValueAtTime(700 * p, t + 0.37);
    nz(G, o, { t: t + 0.02, a: 0.05, d: 0.18, peak: 0.05, type: 'highpass', f: 4000, q: 0.5 });
    return 0.45;
  },
  pushStart(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 150 * p, to: 68 * p, t, a: 0.005, d: 0.18, peak: 0.32 });
    nz(G, o, { t, a: 0.004, d: 0.12, peak: 0.12, type: 'bandpass', f: 420, q: 1.8 });
    tone(G, o, { type: 'sawtooth', f: 160 * p, to: 230 * p, t: t + 0.06, a: 0.03, d: 0.16, peak: 0.07, filt: { type: 'bandpass', f: 900, q: 5 } });
    return 0.3;
  },
  bump(G, o, t, p, opts) {
    const s = clamp(opts.strength ?? 0.7, 0.2, 1.2);
    tone(G, o, { type: 'sine', f: 190 * p, to: 58 * p, t, a: 0.004, d: 0.17, peak: 0.36 * s });
    nz(G, o, { t, a: 0.002, d: 0.07, peak: 0.13 * s, type: 'lowpass', f: 800, q: 0.7 });
    tone(G, o, { type: 'sine', f: 520 * p, to: 360 * p, t: t + 0.01, a: 0.004, d: 0.09, peak: 0.05 * s });
    return 0.25;
  },
  'bark-radhija'(G, o, t, p, opts) {
    const c = { f0: 650, f1: 1350, f2: 2900, dur: 0.12, peak: 0.68 };
    let d = bark(G, o, t, p, c);
    if (opts.double ?? Math.random() < 0.3) d = 0.17 + bark(G, o, t + 0.17, p * 1.07, { ...c, dur: 0.1, peak: 0.7 });
    return d;
  },
  'bark-rhaenyra'(G, o, t, p, opts) {
    const c = { f0: 450, f1: 980, f2: 2300, dur: 0.17, peak: 0.66 };
    let d = bark(G, o, t, p, c);
    if (opts.double ?? Math.random() < 0.2) d = 0.22 + bark(G, o, t + 0.22, p * 0.96, { ...c, dur: 0.14, peak: 0.7 });
    return d;
  },
  tug(G, o, t, p) {
    const d = 0.46;
    const s = osc(G, 'sawtooth', 52 * p, t, t + d + 0.05);
    s.frequency.linearRampToValueAtTime(118 * p, t + d);
    const bp = flt(G, 'bandpass', 1150 * p, 2.6);
    bp.frequency.linearRampToValueAtTime(1500 * p, t + d);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.06, hold: 0.24, d: 0.16, peak: 0.42 });
    s.connect(bp); bp.connect(g); g.connect(o);
    nz(G, o, { t, a: 0.05, hold: 0.2, d: 0.15, peak: 0.06, type: 'bandpass', f: 2600, q: 1.4 });
    // "toc" da corda chegando ao fim
    tone(G, o, { type: 'sine', f: 240 * p, to: 170 * p, t: t + d - 0.02, a: 0.003, d: 0.1, peak: 0.12 });
    return d + 0.15;
  },
  latch(G, o, t, p) {
    const click = (tt, amp) => {
      nz(G, o, { t: tt, a: 0.0012, d: 0.028, peak: 0.2 * amp, type: 'bandpass', f: 3400, q: 0.9 });
      [2650, 3980, 5270].forEach((f, i) => tone(G, o, { type: 'sine', f: f * p, t: tt, a: 0.0015, d: 0.08 - i * 0.018, peak: 0.055 * amp }));
    };
    click(t, 1);
    click(t + 0.075, 0.75);
    tone(G, o, { type: 'sine', f: 230 * p, to: 140 * p, t: t + 0.075, a: 0.002, d: 0.09, peak: 0.16 });
    return 0.25;
  },
  gateCreak(G, o, t, p) {
    const d = 0.52;
    const s = osc(G, 'sawtooth', 72 * p, t, t + d + 0.05);
    s.frequency.linearRampToValueAtTime(108 * p, t + d * 0.45);
    s.frequency.linearRampToValueAtTime(86 * p, t + d);
    const bp = flt(G, 'bandpass', 900 * p, 6);
    bp.frequency.linearRampToValueAtTime(1300 * p, t + d * 0.45);
    bp.frequency.linearRampToValueAtTime(1080 * p, t + d);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.05, hold: 0.28, d: 0.2, peak: 0.56 });
    s.connect(bp); bp.connect(g); g.connect(o);
    tone(G, o, { type: 'triangle', f: 640 * p, to: 860 * p, glideT: d * 0.5, t, a: 0.06, hold: 0.2, d: 0.24, peak: 0.05, vib: 14, vibRate: 7 });
    return d + 0.1;
  },
  reveal(G, o, t) {
    const notes = [72, 76, 79, 84, 88, 91, 96];
    notes.forEach((m, i) => fm(G, o, { f: mtof(m), t: t + i * 0.065, d: 0.75, peak: 0.09, ratio: 2.01, index: 1.1, idxD: 0.25 }));
    const pad = flt(G, 'lowpass', 600, 0.7);
    pad.frequency.setValueAtTime(600, t);
    pad.frequency.exponentialRampToValueAtTime(3200, t + 0.6);
    pad.connect(o);
    tone(G, pad, { type: 'triangle', f: mtof(72), t, a: 0.25, hold: 0.25, d: 0.8, peak: 0.07 });
    tone(G, pad, { type: 'triangle', f: mtof(79) * 1.003, t, a: 0.25, hold: 0.25, d: 0.8, peak: 0.05 });
    nz(G, o, { t, a: 0.35, d: 0.55, peak: 0.03, type: 'highpass', f: 5000, to: 9000, q: 0.6 });
    return 1.5;
  },
  pickupCarrot(G, o, t, p) {
    squeak(G, o, t, p, 950, 1680, 1420, 0.14, 0.2);
    squeak(G, o, t + 0.17, p, 1520, 1230, 920, 0.16, 0.15);
    return 0.4;
  },
  collect(G, o, t, p, opts) {
    const c = clamp(opts.count ?? 1, 1, 6);
    const pairs = [[79, 86], [81, 88], [84, 91], [86, 93], [88, 96], [91, 98]];
    const [m1, m2] = pairs[c - 1];
    fm(G, o, { f: mtof(m1) * p, t, d: 0.3, peak: 0.15, ratio: 3, index: 1.4, idxD: 0.07 });
    fm(G, o, { f: mtof(m2) * p, t: t + 0.08, d: 0.65, peak: 0.17, ratio: 3, index: 1.4, idxD: 0.09 });
    tone(G, o, { type: 'sine', f: mtof(m2 + 12) * p, t: t + 0.08, a: 0.002, d: 0.35, peak: 0.025 });
    if (opts.total && c >= opts.total) {
      fm(G, o, { f: mtof(m2 + 5) * p, t: t + 0.18, d: 0.7, peak: 0.08, ratio: 3, index: 1.2, idxD: 0.1 });
      fm(G, o, { f: mtof(m2 + 12) * p, t: t + 0.27, d: 0.8, peak: 0.06, ratio: 3, index: 1, idxD: 0.1 });
    }
    return 1.1;
  },
  switch(G, o, t, p, opts) {
    const k = opts.name === 'rhaenyra' ? 0.8 : 1;
    tone(G, o, { type: 'sine', f: 430 * p * k, to: 720 * p * k, glideT: 0.08, t, a: 0.008, d: 0.13, peak: 0.16 });
    tone(G, o, { type: 'triangle', f: 720 * p * k, to: 960 * p * k, glideT: 0.06, t: t + 0.07, a: 0.008, d: 0.16, peak: 0.07 });
    nz(G, o, { t, a: 0.03, d: 0.12, peak: 0.03, type: 'bandpass', f: 1200, to: 2800, q: 1.2 });
    return 0.35;
  },
  uiClick(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 1450 * p, to: 1050 * p, t, a: 0.001, d: 0.05, peak: 0.13 });
    tone(G, o, { type: 'sine', f: 2900 * p, t, a: 0.001, d: 0.02, peak: 0.03 });
    return 0.1;
  },
  uiHover(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 2100 * p, t, a: 0.003, d: 0.045, peak: 0.035 });
    return 0.08;
  },
  pause(G, o, t) {
    tone(G, o, { type: 'triangle', f: mtof(79), t, a: 0.004, d: 0.16, peak: 0.1 });
    tone(G, o, { type: 'triangle', f: mtof(74), t: t + 0.09, a: 0.004, d: 0.28, peak: 0.1 });
    return 0.45;
  },
  resume(G, o, t) {
    tone(G, o, { type: 'triangle', f: mtof(74), t, a: 0.004, d: 0.14, peak: 0.09 });
    tone(G, o, { type: 'triangle', f: mtof(81), t: t + 0.08, a: 0.004, d: 0.24, peak: 0.09 });
    return 0.4;
  },
  celebrate(G, o, t) {
    [72, 76, 79, 84, 88].forEach((m, i) => marimba(G, o, mtof(m), t + i * 0.075, 0.13, 0.5));
    [96, 100, 103].forEach((m, i) => fm(G, o, { f: mtof(m), t: t + 0.4 + i * 0.06, d: 0.5, peak: 0.03, ratio: 2.01, index: 0.8, idxD: 0.2 }));
    return 1.3;
  },
  victory(G, o, t) {
    const mel = [
      [0.0, 72], [0.13, 76], [0.26, 79], [0.39, 84],
      [0.65, 81], [0.78, 79], [0.91, 76], [1.04, 79],
      [1.3, 86], [1.43, 83],
    ];
    mel.forEach(([dt, m]) => marimba(G, o, mtof(m), t + dt, 0.13, 0.5));
    marimba(G, o, mtof(84), t + 1.56, 0.15, 1.2);
    [72, 76, 79].forEach((m) => marimba(G, o, mtof(m), t + 1.56, 0.07, 1.1));
    // baixo suave
    [[0, 48], [0.65, 53], [1.04, 55], [1.56, 48]].forEach(([dt, m], i) =>
      tone(G, o, { type: 'triangle', f: mtof(m), t: t + dt, a: 0.01, d: i === 3 ? 1.2 : 0.5, peak: 0.12, filt: { type: 'lowpass', f: 900, q: 0.7 } }));
    // brilhinho final
    [96, 100, 103, 108].forEach((m, i) => fm(G, o, { f: mtof(m), t: t + 1.7 + i * 0.07, d: 0.7, peak: 0.028, ratio: 2.01, index: 0.8, idxD: 0.25 }));
    return 3.0;
  },
};
