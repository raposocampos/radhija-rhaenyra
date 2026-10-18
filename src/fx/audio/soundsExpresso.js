// Sons do Expresso do Superbafo (fase 6): o trenzinho de brinquedo que espirra. Cada som:
// (G, dest, t, p, opts) → duração (s). Entram na biblioteca em ./sounds.js; o feedback toca nos eventos
// expresso:* do puzzle (um "atchim" por viagem; as baforadas seguem a distância andada).
import { mtof, nz, tone, fm, boing, marimba } from './synth.js';

export const SOUNDS_EXPRESSO = {
  // "ah... ah...": o nariz de mola puxa o ar duas vezes, subindo
  trainSniff(G, o, t, p) {
    nz(G, o, { t, a: 0.12, d: 0.16, peak: 0.08, type: 'bandpass', f: 900 * p, to: 1600 * p, toT: 0.26, q: 1.2, buf: G.pink });
    tone(G, o, { type: 'triangle', f: 420 * p, to: 560 * p, t: t + 0.02, a: 0.08, d: 0.14, peak: 0.05 });
    nz(G, o, { t: t + 0.3, a: 0.1, d: 0.12, peak: 0.1, type: 'bandpass', f: 1100 * p, to: 2000 * p, toT: 0.2, q: 1.3, buf: G.pink });
    tone(G, o, { type: 'triangle', f: 520 * p, to: 700 * p, t: t + 0.31, a: 0.07, d: 0.12, peak: 0.06 });
    return 0.6;
  },
  // ATCHIM! estouro de ruído, buzininha de brinquedo descendo e o "boing" da mola do nariz
  trainSneeze(G, o, t, p) {
    nz(G, o, { t, a: 0.004, d: 0.32, peak: 0.34, type: 'bandpass', f: 2400 * p, to: 700 * p, toT: 0.3, q: 0.8 });
    nz(G, o, { t, a: 0.002, d: 0.12, peak: 0.2, type: 'lowpass', f: 900 * p, q: 0.7, buf: G.pink });
    tone(G, o, { type: 'square', f: 620 * p, to: 330 * p, t: t + 0.01, a: 0.005, d: 0.24, peak: 0.06, filt: { type: 'lowpass', f: 2200, q: 0.8 } });
    boing(G, o, t + 0.06, p, 220, 0.12, 0.42);
    return 0.6;
  },
  // baforada da chaminé: "tchu" de vapor e um toque grave de roda de madeira
  trainChuff(G, o, t, p) {
    nz(G, o, { t, a: 0.008, d: 0.11, peak: 0.07, type: 'bandpass', f: 1500 * p, to: 900 * p, toT: 0.1, q: 0.9 });
    tone(G, o, { type: 'sine', f: 180 * p, to: 140 * p, t, a: 0.003, d: 0.05, peak: 0.04 });
    return 0.18;
  },
  // agulha mudando: clac-clac de madeira e o plim do sininho da placa
  railSwitch(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.04, peak: 0.22, type: 'bandpass', f: 1800 * p, q: 2.5 });
    nz(G, o, { t: t + 0.07, a: 0.001, d: 0.05, peak: 0.18, type: 'bandpass', f: 1200 * p, q: 2.5 });
    marimba(G, o, mtof(84) * p, t + 0.1, 0.06, 0.5);
    return 0.6;
  },
  // bolinha rolando pela canaleta de madeira
  ballRoll(G, o, t, p) {
    nz(G, o, { t, a: 0.05, hold: 0.35, d: 0.25, peak: 0.07, type: 'bandpass', f: 380 * p, to: 620 * p, toT: 0.6, q: 1.4, buf: G.pink });
    for (let i = 0; i < 5; i++) tone(G, o, { type: 'sine', f: 240 * p, t: t + 0.08 + i * 0.12, a: 0.002, d: 0.04, peak: 0.025 });
    return 0.75;
  },
  // bolinha chegando na bandeja: plim duplo
  trayDing(G, o, t, p) {
    fm(G, o, { f: mtof(86) * p, t, d: 0.7, peak: 0.07, ratio: 3.5, index: 1.4, idxD: 0.1 });
    fm(G, o, { f: mtof(91) * p, t: t + 0.11, d: 0.8, peak: 0.06, ratio: 3.5, index: 1.4, idxD: 0.1 });
    return 1;
  },
  // apito de brinquedo ao voltar para a estação: "piuí"
  toyWhistle(G, o, t, p) {
    tone(G, o, { type: 'triangle', f: 980 * p, to: 1180 * p, t, a: 0.02, d: 0.16, peak: 0.07, vib: 18, vibRate: 30 });
    tone(G, o, { type: 'triangle', f: 1180 * p, to: 940 * p, t: t + 0.2, a: 0.02, d: 0.24, peak: 0.07, vib: 18, vibRate: 30 });
    nz(G, o, { t, a: 0.02, d: 0.4, peak: 0.02, type: 'highpass', f: 3000 });
    return 0.5;
  },
};
export const MIN_GAP_EXPRESSO = { trainSniff: 0.5, trainSneeze: 0.5, trainChuff: 0.12, railSwitch: 0.2, ballRoll: 0.5, trayDing: 0.4, toyWhistle: 0.5 };
export const PITCH_VAR_EXPRESSO = { trainSniff: 0.03, trainSneeze: 0.04, trainChuff: 0.08, railSwitch: 0.04, ballRoll: 0.03, trayDing: 0.02, toyWhistle: 0.03 };
export const VERB_EXPRESSO = { trainSniff: 0.1, trainSneeze: 0.14, trainChuff: 0.05, railSwitch: 0.1, ballRoll: 0.08, trayDing: 0.22, toyWhistle: 0.15 };
