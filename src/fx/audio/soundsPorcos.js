// Sons dos porquinhos (fase 10 e a arena ?level=porcos). Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o feedback toca nos eventos pig:* e veggie:drop. Tudo de uma vez só.
//   pigOink (opts.kind: 'idle' | 'pester' | 'grumpy' | 'alert' | 'happy') · pigSnort (fuçando) · pigMunch (comendo)
//   pigBump (esbarrão) · pigFull (satisfeito) · pigSnore (cochilo) · pigShake (orelhas batendo) · pigGate (porteira)
//   · veggieDrop (legume no chão) · bellRing (o sininho da arena)
import { osc, gn, flt, env, nz, tone, rnd } from './synth.js';

/**
 * Grunhido nasal de porco: dente-de-serra grave com formantes, a altura sobe e cai depressa ("óinc"), vibrato áspero
 * de garganta e um sopro pelo focinho.
 */
function grunt(G, dest, t, p, { f = 165, d = 0.13, peak = 0.22, up = 1.35, end = 0.8, rough = 38, f1 = 720, f2 = 1650 } = {}) {
  const stop = t + d + 0.06;
  const saw = osc(G, 'sawtooth', f * p, t, stop);
  saw.frequency.linearRampToValueAtTime(f * up * p, t + d * 0.3);
  saw.frequency.exponentialRampToValueAtTime(f * end * p, t + d);
  const sq = osc(G, 'square', f * 0.5 * p, t, stop);
  sq.frequency.linearRampToValueAtTime(f * up * 0.5 * p, t + d * 0.3);
  sq.frequency.exponentialRampToValueAtTime(f * end * 0.5 * p, t + d);
  const amp = gn(G, 0);
  env(amp.gain, t, { a: 0.01, hold: d * 0.35, d: d * 0.65, peak });
  const F1 = flt(G, 'bandpass', f1 * p, 3.4);
  F1.frequency.setValueAtTime(f1 * 0.8 * p, t);
  F1.frequency.linearRampToValueAtTime(f1 * 1.15 * p, t + d * 0.35);
  const F2 = flt(G, 'bandpass', f2 * p, 6);
  const LP = flt(G, 'lowpass', 420 * p, 0.8);
  const g1 = gn(G, 1), g2 = gn(G, 0.45), g3 = gn(G, 0.5);
  saw.connect(F1); F1.connect(g1); g1.connect(amp);
  saw.connect(F2); F2.connect(g2); g2.connect(amp);
  sq.connect(LP); LP.connect(g3); g3.connect(amp);
  // garganta: trêmulo rápido na altura
  const l = osc(G, 'sine', rough, t, stop);
  const lg = gn(G, f * 0.09 * p);
  l.connect(lg); lg.connect(saw.frequency); lg.connect(sq.frequency);
  amp.connect(dest);
  nz(G, dest, { t, a: 0.004, d: d * 0.7, peak: peak * 0.18, type: 'bandpass', f: 1100 * p, q: 1.2, buf: G.pink });
  return d + 0.06;
}

export const SOUNDS_PORCOS = {
  pigOink(G, o, t, p, opts = {}) {
    const kind = opts.kind || 'idle';
    if (kind === 'happy') {
      // "oinc-oinc-oinc" agudinho e rápido
      for (let i = 0; i < 3; i++) grunt(G, o, t + i * 0.13, p * (1.18 + i * 0.05), { d: 0.09, peak: 0.2, up: 1.45 });
      return 0.5;
    }
    if (kind === 'grumpy') {
      // bufo comprido e grave: "hrrrmpf"
      grunt(G, o, t, p * 0.82, { d: 0.26, peak: 0.24, up: 1.12, end: 0.7, rough: 26 });
      nz(G, o, { t: t + 0.18, a: 0.01, d: 0.14, peak: 0.06, type: 'bandpass', f: 700 * p, q: 1, buf: G.pink });
      return 0.45;
    }
    if (kind === 'alert') {
      grunt(G, o, t, p * 1.08, { d: 0.11, peak: 0.24, up: 1.6, end: 0.95 });
      return 0.2;
    }
    if (kind === 'pester') {
      // "oinc-oinc" de quem quer brincar
      grunt(G, o, t, p * rnd(1, 1.08), { d: 0.12, peak: 0.22 });
      grunt(G, o, t + 0.17, p * rnd(1.05, 1.14), { d: 0.1, peak: 0.2, up: 1.4 });
      return 0.35;
    }
    grunt(G, o, t, p * rnd(0.92, 1.02), { d: 0.14, peak: 0.16, up: 1.25 });
    return 0.22;
  },
  // fuçando a terra: sopradas curtinhas com trêmulo
  pigSnort(G, o, t, p) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.11;
      nz(G, o, { t: tt, a: 0.006, d: 0.06, peak: 0.06, type: 'bandpass', f: rnd(600, 900) * p, q: 1.6, buf: G.pink });
    }
    grunt(G, o, t + 0.05, p * 0.85, { d: 0.08, peak: 0.07, up: 1.1, end: 0.9 });
    return 0.4;
  },
  // mastigando legume: crec-crec e o "nhac" grave
  pigMunch(G, o, t, p) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.12 + rnd(-0.01, 0.01);
      nz(G, o, { t: tt, a: 0.001, d: 0.035, peak: 0.07, type: 'highpass', f: 2400 * p, q: 0.8 });
      tone(G, o, { type: 'sine', f: 180 * p, to: 110 * p, t: tt, a: 0.002, d: 0.05, peak: 0.05 });
    }
    return 0.42;
  },
  // esbarrão: tump surdo e um "óinc" curto
  pigBump(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 150 * p, to: 62 * p, t, a: 0.002, d: 0.13, peak: 0.26 });
    nz(G, o, { t, a: 0.002, d: 0.06, peak: 0.09, type: 'lowpass', f: 700, q: 0.8, buf: G.pink });
    grunt(G, o, t + 0.04, p * 1.1, { d: 0.09, peak: 0.16, up: 1.5 });
    return 0.3;
  },
  // satisfeito depois de comer: "hmmm" grave e contente
  pigFull(G, o, t, p) {
    grunt(G, o, t, p * 0.78, { d: 0.32, peak: 0.13, up: 1.06, end: 0.88, rough: 18, f1: 520 });
    return 0.45;
  },
  // ronquinho: puxa "rrrr" e solta um assobio fraquinho
  pigSnore(G, o, t, p) {
    const stop = t + 0.75;
    const src = osc(G, 'sawtooth', 70 * p, t, stop);
    const am = osc(G, 'sine', 21, t, stop);
    const ag = gn(G, 0.5);
    const amp = gn(G, 0);
    env(amp.gain, t, { a: 0.25, hold: 0.15, d: 0.3, peak: 0.05 });
    const lp = flt(G, 'lowpass', 380 * p, 1.2);
    const mod = gn(G, 0.5);
    am.connect(ag); ag.connect(mod.gain);
    src.connect(lp); lp.connect(mod); mod.connect(amp); amp.connect(o);
    nz(G, o, { t: t + 0.75, a: 0.08, d: 0.35, peak: 0.02, type: 'bandpass', f: 1300 * p, q: 3, buf: G.pink });
    return 1.25;
  },
  // sacudida: orelhas batendo (rajadinhas rápidas)
  pigShake(G, o, t, p) {
    for (let i = 0; i < 9; i++) {
      nz(G, o, { t: t + i * 0.055, a: 0.004, d: 0.035, peak: 0.05 * (1 - i / 12), type: 'bandpass', f: rnd(900, 1400) * p, q: 1.2, buf: G.pink });
    }
    return 0.6;
  },
  // porteira de madeira: rangido e a tranca batendo
  pigGate(G, o, t, p, opts = {}) {
    const open = opts.open !== false;
    nz(G, o, { t, a: 0.06, hold: 0.22, d: 0.2, peak: 0.03, type: 'bandpass', f: (open ? 650 : 800) * p, to: (open ? 1100 : 600) * p, toT: 0.45, q: 11 });
    tone(G, o, { type: 'sawtooth', f: 130 * p, to: 170 * p, t, a: 0.06, hold: 0.2, d: 0.2, peak: 0.006, filt: { type: 'bandpass', f: 700 * p, q: 6 } });
    const clack = t + (open ? 0.02 : 0.48);
    nz(G, o, { t: clack, a: 0.001, d: 0.06, peak: 0.12, type: 'lowpass', f: 650 * p, q: 1 });
    nz(G, o, { t: clack + 0.02, a: 0.001, d: 0.03, peak: 0.06, type: 'bandpass', f: 2100 * p, q: 3 });
    return 0.7;
  },
  // sininho de chamar os porquinhos: "blim-blim" de latão
  bellRing(G, o, t, p) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.16;
      tone(G, o, { type: 'sine', f: 1568 * p, t: tt, a: 0.002, d: 0.5, peak: 0.07 / (1 + i * 0.3) });
      tone(G, o, { type: 'sine', f: 1568 * 2.76 * p, t: tt, a: 0.001, d: 0.18, peak: 0.025 });
      tone(G, o, { type: 'sine', f: 1568 * 1.5 * p, t: tt, a: 0.002, d: 0.35, peak: 0.02 });
    }
    return 1.0;
  },
  // legume caindo na terra: baque macio e as folhas
  veggieDrop(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 190 * p, to: 90 * p, t, a: 0.002, d: 0.09, peak: 0.12 });
    nz(G, o, { t, a: 0.002, d: 0.07, peak: 0.07, type: 'lowpass', f: 900 * p, q: 0.8, buf: G.pink });
    nz(G, o, { t: t + 0.02, a: 0.01, d: 0.12, peak: 0.025, type: 'bandpass', f: 3200 * p, q: 1.5 });
    return 0.25;
  },
};
export const MIN_GAP_PORCOS = {
  pigOink: 0.22, pigSnort: 0.5, pigMunch: 0.3, pigBump: 0.25, pigFull: 0.4, pigSnore: 0.9, pigShake: 0.5, pigGate: 0.4, veggieDrop: 0.12,
  bellRing: 0.5,
};
export const PITCH_VAR_PORCOS = {
  pigOink: 0.07, pigSnort: 0.06, pigMunch: 0.08, pigBump: 0.05, pigFull: 0.04, pigSnore: 0.05, pigShake: 0.05, pigGate: 0.04, veggieDrop: 0.08,
  bellRing: 0.01,
};
export const VERB_PORCOS = {
  pigOink: 0.1, pigSnort: 0.05, pigMunch: 0.04, pigBump: 0.06, pigFull: 0.08, pigSnore: 0.05, pigShake: 0.05, pigGate: 0.12, veggieDrop: 0.05,
  bellRing: 0.3,
};
