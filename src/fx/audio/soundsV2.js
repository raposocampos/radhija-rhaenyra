// Sons da v2: itens das fases 2 e 3, companheira (Fica/Vem), placa de pressão, portão, calço, água,
// lanternas, Dona Gansa, transição entre fases e navegação nos menus — e as entradas deles nas tabelas
// de mixagem. A biblioteca completa é montada em ./sounds.js.
import { mtof, rnd, env, gn, flt, osc, noiseSrc, tone, nz, fm, marimba, bark, squeak, honk, flaps, drips, boing } from './synth.js';
import { SOUNDS } from './soundsV1.js'; // sons da v1 reaproveitados (ex.: o trinco no fim do portão fechando)

// ---------------------------------------------------------------------------
//  v2: sons das fases 2 e 3, companheira, transição e navegação
// ---------------------------------------------------------------------------
export const SOUNDS2 = {
  // ---------- itens ----------
  pickupBall(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 150 * p, to: 70 * p, t, a: 0.003, d: 0.11, peak: 0.3 });
    boing(G, o, t, p, 250, 0.16, 0.36);
    tone(G, o, { type: 'sine', f: 170 * p, to: 80 * p, t: t + 0.21, a: 0.003, d: 0.09, peak: 0.16 });
    boing(G, o, t + 0.21, p * 1.12, 250, 0.08, 0.28);
    fm(G, o, { f: mtof(88) * p, t: t + 0.08, d: 0.4, peak: 0.04, ratio: 3, index: 1, idxD: 0.08 });
    return 0.6;
  },
  pickupSlipper(G, o, t, p) {
    const f = nz(G, o, { t, a: 0.05, d: 0.2, peak: 0.16, type: 'bandpass', f: 600 * p, to: 1500 * p, toT: 0.12, q: 0.8, buf: G.pink });
    void f;
    tone(G, o, { type: 'sine', f: 300 * p, to: 210 * p, t: t + 0.02, a: 0.02, d: 0.16, peak: 0.12 });
    squeak(G, o, t + 0.12, p, 1100, 1400, 1250, 0.09, 0.06);
    fm(G, o, { f: mtof(91) * p, t: t + 0.16, d: 0.45, peak: 0.035, ratio: 2.01, index: 0.9, idxD: 0.15 });
    return 0.6;
  },
  // ---------- companheira: Fica / Vem ----------
  stay(G, o, t, p, opts) {
    const big = opts.name === 'rhaenyra';
    const c = big ? { f0: 420, f1: 930, f2: 2200, dur: 0.1, peak: 0.42 } : { f0: 610, f1: 1300, f2: 2800, dur: 0.075, peak: 0.42 };
    const d = bark(G, o, t, p * 0.95, c);
    tone(G, o, { type: 'triangle', f: mtof(76) * p, t: t + 0.06, a: 0.004, d: 0.12, peak: 0.05 });
    tone(G, o, { type: 'triangle', f: mtof(72) * p, t: t + 0.13, a: 0.004, d: 0.22, peak: 0.05 });
    return d + 0.3;
  },
  come(G, o, t, p, opts) {
    const big = opts.name === 'rhaenyra';
    const c = big ? { f0: 470, f1: 1000, f2: 2350, dur: 0.09, peak: 0.4 } : { f0: 700, f1: 1400, f2: 3000, dur: 0.07, peak: 0.4 };
    bark(G, o, t, p * 1.06, c);
    tone(G, o, { type: 'triangle', f: mtof(74) * p, t: t + 0.05, a: 0.004, d: 0.1, peak: 0.05 });
    tone(G, o, { type: 'triangle', f: mtof(79) * p, t: t + 0.11, a: 0.004, d: 0.2, peak: 0.055 });
    return 0.4;
  },
  // ---------- placa de pressão ----------
  plateDown(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 120 * p, to: 52 * p, t, a: 0.003, d: 0.16, peak: 0.34 });
    nz(G, o, { t, a: 0.0015, d: 0.03, peak: 0.16, type: 'bandpass', f: 1900 * p, q: 1.2 });
    nz(G, o, { t: t + 0.004, a: 0.002, d: 0.08, peak: 0.1, type: 'lowpass', f: 700, q: 0.8 });
    tone(G, o, { type: 'sawtooth', f: 92 * p, to: 128 * p, t: t + 0.05, a: 0.03, d: 0.18, peak: 0.06, filt: { type: 'bandpass', f: 760, q: 6 } });
    return 0.35;
  },
  plateUp(G, o, t, p) {
    nz(G, o, { t, a: 0.0015, d: 0.025, peak: 0.1, type: 'bandpass', f: 2600 * p, q: 1.4 });
    tone(G, o, { type: 'sine', f: 210 * p, to: 140 * p, t, a: 0.003, d: 0.08, peak: 0.14 });
    tone(G, o, { type: 'sawtooth', f: 128 * p, to: 96 * p, t: t + 0.02, a: 0.02, d: 0.12, peak: 0.04, filt: { type: 'bandpass', f: 820, q: 6 } });
    return 0.2;
  },
  // ---------- portão ----------
  gateClose(G, o, t, p) {
    const d = 0.34;
    const s = osc(G, 'sawtooth', 104 * p, t, t + d + 0.05);
    s.frequency.linearRampToValueAtTime(76 * p, t + d);
    const bp = flt(G, 'bandpass', 1150 * p, 6);
    bp.frequency.linearRampToValueAtTime(880 * p, t + d);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.04, hold: 0.16, d: 0.14, peak: 0.36 });
    s.connect(bp); bp.connect(g); g.connect(o);
    SOUNDS.latch(G, o, t + d - 0.02, p);
    tone(G, o, { type: 'sine', f: 150 * p, to: 70 * p, t: t + d, a: 0.003, d: 0.14, peak: 0.24 });
    return d + 0.3;
  },
  gateLocked(G, o, t, p) {
    const click = (tt, amp, f0) => {
      nz(G, o, { t: tt, a: 0.001, d: 0.03, peak: 0.24 * amp, type: 'bandpass', f: f0, q: 1 });
      [2400, 3650, 5100].forEach((f, i) => tone(G, o, { type: 'sine', f: f * p, t: tt, a: 0.0015, d: 0.12 - i * 0.025, peak: 0.06 * amp }));
    };
    click(t, 1, 3000);
    click(t + 0.06, 0.8, 2400);
    tone(G, o, { type: 'sine', f: 180 * p, to: 62 * p, t: t + 0.06, a: 0.003, d: 0.2, peak: 0.36 });
    nz(G, o, { t: t + 0.06, a: 0.002, d: 0.09, peak: 0.12, type: 'lowpass', f: 900 });
    fm(G, o, { f: mtof(79) * p, t: t + 0.2, d: 0.4, peak: 0.07, ratio: 3, index: 1.2, idxD: 0.08 });
    fm(G, o, { f: mtof(86) * p, t: t + 0.29, d: 0.6, peak: 0.08, ratio: 3, index: 1.2, idxD: 0.08 });
    return 0.9;
  },
  // ---------- calço ----------
  wedgeKick(G, o, t, p, opts) {
    tone(G, o, { type: 'sine', f: 560 * p, to: 390 * p, t, a: 0.002, d: 0.07, peak: 0.22 });
    tone(G, o, { type: 'triangle', f: 1180 * p, to: 900 * p, t, a: 0.001, d: 0.035, peak: 0.07 });
    nz(G, o, { t, a: 0.001, d: 0.04, peak: 0.14, type: 'bandpass', f: 950 * p, q: 1.5 });
    // deslize na pedra
    nz(G, o, { t: t + 0.03, a: 0.03, hold: 0.08, d: 0.12, peak: 0.07, type: 'bandpass', f: 1600, to: 900, q: 1.2 });
    if (opts.locked) {
      tone(G, o, { type: 'sine', f: 440 * p, to: 300 * p, t: t + 0.22, a: 0.002, d: 0.09, peak: 0.24 });
      nz(G, o, { t: t + 0.22, a: 0.001, d: 0.05, peak: 0.12, type: 'bandpass', f: 800, q: 1.4 });
      fm(G, o, { f: mtof(81) * p, t: t + 0.32, d: 0.5, peak: 0.07, ratio: 3, index: 1.2, idxD: 0.08 });
      return 0.9;
    }
    return 0.35;
  },
  // ---------- água ----------
  splash(G, o, t, p) {
    nz(G, o, { t, a: 0.004, d: 0.32, peak: 0.3, type: 'bandpass', f: 2600 * p, to: 700 * p, toT: 0.3, q: 0.9 });
    nz(G, o, { t, a: 0.002, d: 0.12, peak: 0.14, type: 'highpass', f: 4500, q: 0.6 });
    tone(G, o, { type: 'sine', f: 340 * p, to: 120 * p, t, a: 0.004, d: 0.12, peak: 0.16 });
    drips(G, o, t + 0.08, 7, 0.45, 0.05);
    return 0.7;
  },
  shake(G, o, t, p) {
    const d = 0.72;
    const s = noiseSrc(G, t, t + d + 0.05, G.pink);
    const bp = flt(G, 'bandpass', 950 * p, 0.9);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.05, hold: d * 0.5, d: d * 0.45, peak: 0.22 });
    const am = gn(G, 0.5);
    const l = osc(G, 'sine', 15, t, t + d + 0.05);
    l.frequency.linearRampToValueAtTime(10, t + d);
    const lg = gn(G, 0.5);
    l.connect(lg); lg.connect(am.gain);
    s.connect(bp); bp.connect(am); am.connect(g); g.connect(o);
    flaps(G, o, t + 0.05, 6, 11, 0.06);
    drips(G, o, t + 0.1, 10, d, 0.035, 1800, 3800);
    return d + 0.2;
  },
  waterOff(G, o, t, p) {
    const d = 0.9;
    const h = nz(G, o, { t, a: 0.01, hold: 0.1, d, peak: 0.16, type: 'lowpass', f: 7000, to: 500, toT: d, q: 0.6 });
    void h;
    const s = osc(G, 'sine', 210 * p, t + 0.1, t + 0.7);
    s.frequency.exponentialRampToValueAtTime(90 * p, t + 0.65);
    const l = osc(G, 'sine', 19, t + 0.1, t + 0.7);
    const lg = gn(G, 30);
    l.connect(lg); lg.connect(s.frequency);
    const g = gn(G, 0);
    env(g.gain, t + 0.1, { a: 0.03, hold: 0.2, d: 0.3, peak: 0.08 });
    s.connect(g); g.connect(o);
    drips(G, o, t + 0.45, 4, 0.6, 0.05, 1500, 2600);
    fm(G, o, { f: mtof(84) * p, t: t + 0.55, d: 0.6, peak: 0.05, ratio: 2.01, index: 1, idxD: 0.2 });
    fm(G, o, { f: mtof(91) * p, t: t + 0.65, d: 0.7, peak: 0.045, ratio: 2.01, index: 1, idxD: 0.2 });
    return 1.4;
  },
  valve(G, o, t, p) {
    const d = 0.55;
    const s = osc(G, 'sawtooth', 150 * p, t, t + d + 0.05);
    s.frequency.linearRampToValueAtTime(205 * p, t + d * 0.6);
    s.frequency.linearRampToValueAtTime(180 * p, t + d);
    const r = osc(G, 'square', 23, t, t + d + 0.05);
    const rg = gn(G, 18 * p);
    r.connect(rg); rg.connect(s.frequency);
    const bp = flt(G, 'bandpass', 1900 * p, 9);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.04, hold: d * 0.55, d: d * 0.4, peak: 0.42 });
    s.connect(bp); bp.connect(g); g.connect(o);
    tone(G, o, { type: 'triangle', f: 1250 * p, to: 1500 * p, glideT: d * 0.6, t, a: 0.06, hold: 0.2, d: 0.25, peak: 0.035, vib: 25, vibRate: 9 });
    nz(G, o, { t: t + d - 0.04, a: 0.001, d: 0.04, peak: 0.14, type: 'bandpass', f: 2600, q: 1.3 });
    tone(G, o, { type: 'sine', f: 260 * p, to: 170 * p, t: t + d - 0.03, a: 0.002, d: 0.1, peak: 0.16 });
    return d + 0.2;
  },
  crateSink(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 170 * p, to: 50 * p, t, a: 0.004, d: 0.42, peak: 0.5 });
    nz(G, o, { t, a: 0.004, d: 0.7, peak: 0.36, type: 'bandpass', f: 1900 * p, to: 420 * p, toT: 0.6, q: 0.8 });
    nz(G, o, { t, a: 0.002, d: 0.2, peak: 0.16, type: 'highpass', f: 4200, q: 0.6 });
    for (let i = 0; i < 6; i++) {
      const tt = t + 0.25 + i * rnd(0.07, 0.14);
      const f = rnd(380, 620) * p;
      tone(G, o, { type: 'sine', f, to: f * 1.9, t: tt, a: 0.004, d: 0.06, peak: 0.05 });
    }
    drips(G, o, t + 0.15, 9, 0.7, 0.05);
    [76, 81, 88].forEach((m, i) => fm(G, o, { f: mtof(m) * p, t: t + 0.75 + i * 0.08, d: 0.7, peak: 0.06, ratio: 2.01, index: 1, idxD: 0.2 }));
    return 1.8;
  },
  // ---------- lanternas ----------
  lanternOn(G, o, t, p) {
    fm(G, o, { f: mtof(91) * p, t, d: 1.2, peak: 0.1, ratio: 2.76, index: 0.9, idxD: 0.4 });
    fm(G, o, { f: mtof(98) * p, t: t + 0.05, d: 0.9, peak: 0.05, ratio: 2.76, index: 0.7, idxD: 0.3 });
    tone(G, o, { type: 'sine', f: mtof(103) * p, t: t + 0.09, a: 0.002, d: 0.6, peak: 0.02 });
    tone(G, o, { type: 'sine', f: 220 * p, t, a: 0.12, hold: 0.1, d: 0.6, peak: 0.05, filt: { type: 'lowpass', f: 600, q: 0.7 } });
    for (let i = 0; i < 5; i++) nz(G, o, { t: t + rnd(0, 0.25), a: 0.001, d: 0.012, peak: 0.05, type: 'highpass', f: 3500, q: 0.7 });
    return 1.4;
  },
  lanternOff(G, o, t, p) {
    fm(G, o, { f: mtof(84) * p, t, d: 0.5, peak: 0.06, ratio: 2.76, index: 0.6, idxD: 0.2 });
    fm(G, o, { f: mtof(79) * p, t: t + 0.1, d: 0.6, peak: 0.05, ratio: 2.76, index: 0.5, idxD: 0.2 });
    nz(G, o, { t, a: 0.02, d: 0.25, peak: 0.05, type: 'bandpass', f: 900, to: 400, q: 0.8, buf: G.pink });
    return 0.8;
  },
  // ---------- Dona Gansa ----------
  honk(G, o, t, p) {
    return honk(G, o, t, p, {});
  },
  gooseAlert(G, o, t, p) {
    honk(G, o, t, p, { f: 400, d: 0.12, peak: 0.24, bend: 1.08, end: 1.12 });
    honk(G, o, t + 0.17, p, { f: 430, d: 0.16, peak: 0.28, bend: 1.12, end: 1.25 });
    return 0.45;
  },
  gooseCharge(G, o, t, p) {
    honk(G, o, t, p * 1.04, { f: 410, d: 0.14, peak: 0.3 });
    honk(G, o, t + 0.16, p * 1.08, { f: 420, d: 0.13, peak: 0.3 });
    honk(G, o, t + 0.31, p * 1.12, { f: 440, d: 0.2, peak: 0.34, bend: 1.25 });
    flaps(G, o, t, 9, 13, 0.1);
    return 0.8;
  },
  gooseHit(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 320 * p, to: 110 * p, t, a: 0.002, d: 0.14, peak: 0.34 });
    nz(G, o, { t, a: 0.001, d: 0.06, peak: 0.16, type: 'bandpass', f: 1200, q: 1 });
    honk(G, o, t + 0.05, p * 1.15, { f: 450, d: 0.18, peak: 0.3, bend: 1.3, end: 0.9 });
    flaps(G, o, t + 0.04, 5, 14, 0.09);
    return 0.5;
  },
  gooseLured(G, o, t, p) {
    honk(G, o, t, p * 0.9, { f: 340, d: 0.1, peak: 0.12, bend: 1.0, end: 1.05 });
    honk(G, o, t + 0.14, p * 0.92, { f: 350, d: 0.17, peak: 0.15, bend: 1.06, end: 1.3 });
    return 0.4;
  },
  gooseReturn(G, o, t, p) {
    honk(G, o, t, p * 0.88, { f: 360, d: 0.15, peak: 0.16, bend: 1.06, end: 0.92 });
    honk(G, o, t + 0.2, p * 0.82, { f: 330, d: 0.22, peak: 0.14, bend: 1.02, end: 0.8 });
    return 0.5;
  },
  // ---------- transição e menus ----------
  curtainIn(G, o, t) {
    nz(G, o, { t, a: 0.22, d: 0.2, peak: 0.07, type: 'bandpass', f: 500, to: 1800, toT: 0.36, q: 1.1, buf: G.pink });
    marimba(G, o, mtof(67), t + 0.3, 0.06, 0.6);
    marimba(G, o, mtof(60), t + 0.3, 0.05, 0.7);
    return 1.0;
  },
  curtainOut(G, o, t) {
    nz(G, o, { t, a: 0.12, d: 0.4, peak: 0.06, type: 'bandpass', f: 1800, to: 600, toT: 0.5, q: 1.1, buf: G.pink });
    [72, 76, 79, 84].forEach((m, i) => marimba(G, o, mtof(m), t + 0.08 + i * 0.07, 0.07, 0.5));
    fm(G, o, { f: mtof(96), t: t + 0.4, d: 0.6, peak: 0.02, ratio: 2.01, index: 0.8, idxD: 0.2 });
    return 1.1;
  },
  uiMove(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 1650 * p, t, a: 0.002, d: 0.035, peak: 0.05 });
    return 0.06;
  },
  uiBack(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 1200 * p, to: 820 * p, t, a: 0.002, d: 0.07, peak: 0.1 });
    return 0.1;
  },
  uiDenied(G, o, t, p) {
    tone(G, o, { type: 'triangle', f: 233 * p, t, a: 0.003, d: 0.08, peak: 0.12 });
    tone(G, o, { type: 'triangle', f: 208 * p, t: t + 0.11, a: 0.003, d: 0.12, peak: 0.12 });
    return 0.3;
  },
  // ---------- pulo da Rhaenyra ----------
  // Decolagem: impulso grave das patas + "fuuu" de ar subindo.
  jump(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 120 * p, to: 70 * p, t, a: 0.004, d: 0.1, peak: 0.22 });
    nz(G, o, { t, a: 0.004, d: 0.05, peak: 0.08, type: 'lowpass', f: 500, q: 0.7 });
    nz(G, o, { t: t + 0.02, a: 0.06, d: 0.2, peak: 0.12, type: 'bandpass', f: 500 * p, to: 1500 * p, toT: 0.22, q: 1.4 });
    return 0.35;
  },
  // Pouso: baque macio de patas na grama, com um leve chiado de poeira.
  land(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 150 * p, to: 52 * p, t, a: 0.003, d: 0.14, peak: 0.34 });
    nz(G, o, { t, a: 0.002, d: 0.06, peak: 0.12, type: 'lowpass', f: 650, q: 0.7 });
    nz(G, o, { t: t + 0.015, a: 0.003, d: 0.08, peak: 0.05, type: 'bandpass', f: 2600 * p, q: 0.9 });
    return 0.25;
  },
};
export const MIN_GAP_V2 = {
  jump: 0.12, land: 0.12,
  pickupBall: 0.3, pickupSlipper: 0.3, stay: 0.15, come: 0.15, plateDown: 0.15, plateUp: 0.15,
  gateClose: 0.4, gateLocked: 0.5, wedgeKick: 0.2, splash: 0.18, shake: 0.6, waterOff: 0.8, valve: 0.35,
  crateSink: 1.0, lanternOn: 0.2, lanternOff: 0.2, honk: 0.25, gooseAlert: 0.6, gooseCharge: 0.6,
  gooseHit: 0.3, gooseLured: 0.6, gooseReturn: 0.6, curtainIn: 0.5, curtainOut: 0.5, uiMove: 0.03, uiBack: 0.08, uiDenied: 0.2,
};
export const PITCH_VAR_V2 = {
  jump: 0.06, land: 0.06,
  pickupBall: 0.04, pickupSlipper: 0.04, stay: 0.03, come: 0.03, plateDown: 0.05, plateUp: 0.05, wedgeKick: 0.06,
  splash: 0.08, shake: 0.06, valve: 0.04, honk: 0.06, gooseAlert: 0.04, gooseCharge: 0.03, gooseHit: 0.04,
  curtainIn: 0, curtainOut: 0, uiMove: 0.02, uiDenied: 0, gateLocked: 0, crateSink: 0.03, lanternOn: 0.02,
};
export const VERB_V2 = {
  jump: 0.04, land: 0.04,
  pickupBall: 0.12, pickupSlipper: 0.15, stay: 0.12, come: 0.12, plateDown: 0.1, plateUp: 0.08, gateClose: 0.15,
  gateLocked: 0.2, wedgeKick: 0.1, splash: 0.2, shake: 0.08, waterOff: 0.3, valve: 0.15, crateSink: 0.3,
  lanternOn: 0.5, lanternOff: 0.35, honk: 0.18, gooseAlert: 0.18, gooseCharge: 0.15, gooseHit: 0.15, gooseLured: 0.18,
  gooseReturn: 0.18, curtainIn: 0.2, curtainOut: 0.25, uiMove: 0, uiBack: 0, uiDenied: 0,
};
