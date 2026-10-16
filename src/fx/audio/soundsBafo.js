// Sons do superbafo da Radhija e das reações ao cheiro. Cada som: (G, dest, t, p, opts) → duração (s).
// A biblioteca completa é montada em ./sounds.js.
import { nz, tone, flaps } from './synth.js';

export const SOUNDS_BAFO = {
  // Mira: enche o peito (ar entrando, subindo).
  bafoAim(G, o, t, p) {
    nz(G, o, { t, a: 0.26, d: 0.12, peak: 0.1, type: 'bandpass', f: 600 * p, to: 1500 * p, toT: 0.36, q: 1.5 });
    return 0.45;
  },
  // "HÁÁÁ!": ar com formante de "á", um fiapo de voz e um sopro grave no começo.
  bafo(G, o, t, p) {
    const d = 0.55;
    nz(G, o, { t, a: 0.03, hold: 0.05, d, peak: 0.26, type: 'bandpass', f: 900 * p, to: 650 * p, toT: d, q: 1.3 });
    nz(G, o, { t, a: 0.02, d: d * 0.8, peak: 0.11, type: 'bandpass', f: 1500 * p, q: 2.2 });
    tone(G, o, { type: 'sawtooth', f: 520 * p, to: 380 * p, t, a: 0.03, d: 0.35, peak: 0.07, filt: { type: 'bandpass', f: 1100, q: 3 } });
    nz(G, o, { t: t + 0.02, a: 0.01, d: 0.18, peak: 0.08, type: 'lowpass', f: 300, q: 0.7 });
    return 0.8;
  },
  // Nuvem saindo de um duto: "pfff" abafado.
  scentPuff(G, o, t, p) {
    nz(G, o, { t, a: 0.02, d: 0.3, peak: 0.14, type: 'bandpass', f: 520 * p, to: 260 * p, toT: 0.3, q: 1.2 });
    return 0.4;
  },
  // Pombo fugindo do cheiro: bater de asas + "rru-rru" assustado.
  pigeonFlee(G, o, t, p) {
    flaps(G, o, t, 9, 14, 0.2);
    tone(G, o, { type: 'sine', f: 330 * p, to: 260 * p, t: t + 0.02, a: 0.02, d: 0.12, peak: 0.08 });
    tone(G, o, { type: 'sine', f: 360 * p, to: 280 * p, t: t + 0.16, a: 0.02, d: 0.14, peak: 0.07 });
    return 0.9;
  },
  // Pombo pousando: arrulho grave.
  pigeonCoo(G, o, t, p) {
    flaps(G, o, t, 3, 12, 0.12);
    tone(G, o, { type: 'sine', f: 240 * p, to: 300 * p, t: t + 0.1, a: 0.04, d: 0.18, peak: 0.08, vib: 8, vibRate: 22 });
    tone(G, o, { type: 'sine', f: 290 * p, to: 230 * p, t: t + 0.32, a: 0.04, d: 0.22, peak: 0.07, vib: 8, vibRate: 22 });
    return 0.7;
  },
  // Rhaenyra sentindo o cheiro: fungada + "blé" nasal.
  yuck(G, o, t, p) {
    nz(G, o, { t, a: 0.005, d: 0.07, peak: 0.1, type: 'highpass', f: 2500, q: 0.7 });
    tone(G, o, { type: 'sawtooth', f: 250 * p, to: 165 * p, t: t + 0.08, a: 0.01, d: 0.24, peak: 0.09, filt: { type: 'bandpass', f: 700, q: 4 } });
    return 0.4;
  },
};
export const MIN_GAP_BAFO = { bafoAim: 0.3, bafo: 0.3, scentPuff: 0.3, yuck: 1.2, pigeonFlee: 0.8, pigeonCoo: 0.8 };
export const PITCH_VAR_BAFO = { bafoAim: 0.03, bafo: 0.04, scentPuff: 0.05, yuck: 0.05 };
export const VERB_BAFO = { bafoAim: 0.05, bafo: 0.12, scentPuff: 0.15, yuck: 0.08, pigeonFlee: 0.15, pigeonCoo: 0.15 };
