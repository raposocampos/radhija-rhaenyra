// Sons do Lambe-Lambe e da pracinha enlameada (fase 7). Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o feedback toca nos eventos dog:lick, mud:*, slide:*, puddle:splash e
// picnic:deliver. Nada fica tocando: são todos de uma vez só (pausa e troca de fase não deixam rastro).
import { mtof, nz, tone, fm, marimba, drips, boing } from './synth.js';

export const SOUNDS_LAMBE = {
  // lambida: estalinho molhado da língua e um "slurp" curto que sobe (opts.solo: lambidinha no focinho)
  lickSlurp(G, o, t, p, opts = {}) {
    const k = opts.solo ? 0.7 : 1;
    nz(G, o, { t, a: 0.012, d: 0.1, peak: 0.1 * k, type: 'bandpass', f: 700 * p, to: 1900 * p, toT: 0.11, q: 2.2, buf: G.pink });
    tone(G, o, { type: 'sine', f: 260 * p, to: 520 * p, t: t + 0.01, a: 0.01, d: 0.09, peak: 0.05 * k });
    nz(G, o, { t: t + 0.09, a: 0.001, d: 0.025, peak: 0.07 * k, type: 'bandpass', f: 2600 * p, q: 3 });
    return 0.2;
  },
  // pisando na lama: "chlep" grave e úmido
  mudSquelch(G, o, t, p) {
    nz(G, o, { t, a: 0.006, d: 0.14, peak: 0.16, type: 'lowpass', f: 700 * p, to: 260 * p, toT: 0.13, q: 2.5, buf: G.pink });
    tone(G, o, { type: 'sine', f: 150 * p, to: 90 * p, t, a: 0.005, d: 0.09, peak: 0.07 });
    nz(G, o, { t: t + 0.05, a: 0.002, d: 0.05, peak: 0.05, type: 'bandpass', f: 1300 * p, q: 4 });
    return 0.22;
  },
  // placas de lama caindo no chão: dois "ploc" abafados
  mudPlop(G, o, t, p) {
    for (let i = 0; i < 2; i++) {
      nz(G, o, { t: t + 0.06 + i * 0.11, a: 0.002, d: 0.06, peak: 0.08, type: 'lowpass', f: 520 * p, q: 3, buf: G.pink });
      tone(G, o, { type: 'sine', f: (190 - i * 30) * p, to: 110 * p, t: t + 0.06 + i * 0.11, a: 0.002, d: 0.06, peak: 0.05 });
    }
    return 0.35;
  },
  // limpinha! arpejo de brilho subindo
  cleanSparkle(G, o, t, p) {
    [79, 84, 88, 91, 96].forEach((m, i) => fm(G, o, { f: mtof(m) * p, t: t + i * 0.07, d: 0.6, peak: 0.055, ratio: 3.5, index: 1.2, idxD: 0.12 }));
    nz(G, o, { t, a: 0.15, d: 0.4, peak: 0.03, type: 'highpass', f: 6000 });
    return 1;
  },
  // tentou a arrancada enlameada: "pfff" pesado
  dashBlocked(G, o, t, p) {
    nz(G, o, { t, a: 0.01, d: 0.16, peak: 0.1, type: 'lowpass', f: 900 * p, to: 300 * p, toT: 0.15, q: 1.2, buf: G.pink });
    tone(G, o, { type: 'triangle', f: 220 * p, to: 140 * p, t, a: 0.01, d: 0.14, peak: 0.035 });
    return 0.2;
  },
  // patinhas correndo rampa acima
  slideScrabble(G, o, t, p) {
    for (let i = 0; i < 7; i++) nz(G, o, { t: t + i * 0.085, a: 0.001, d: 0.025, peak: 0.07, type: 'bandpass', f: (1800 + i * 120) * p, q: 3 });
    tone(G, o, { type: 'triangle', f: 330 * p, to: 520 * p, t, a: 0.05, d: 0.5, peak: 0.02 });
    return 0.65;
  },
  // descendo de barriga: "zuuum" de plástico molhado que sobe e esvai
  slideWhoosh(G, o, t, p) {
    nz(G, o, { t, a: 0.15, hold: 0.45, d: 0.35, peak: 0.12, type: 'bandpass', f: 600 * p, to: 2400 * p, toT: 0.85, q: 1.3, buf: G.pink });
    tone(G, o, { type: 'sine', f: 300 * p, to: 760 * p, t, a: 0.1, hold: 0.4, d: 0.35, peak: 0.035, vib: 8, vibRate: 11 });
    drips(G, o, t + 0.2, 5, 0.6, 0.03);
    return 1.05;
  },
  // chegou embaixo: tum macio e respingos
  slideThump(G, o, t, p) {
    nz(G, o, { t, a: 0.003, d: 0.12, peak: 0.12, type: 'lowpass', f: 420 * p, q: 0.8, buf: G.pink });
    tone(G, o, { type: 'sine', f: 120 * p, to: 70 * p, t, a: 0.003, d: 0.1, peak: 0.08 });
    drips(G, o, t + 0.04, 6, 0.35, 0.04);
    return 0.45;
  },
  // escorregou de volta: "fiiip" descendo e o boing de quem caiu sentada
  slipBack(G, o, t, p) {
    nz(G, o, { t, a: 0.02, d: 0.28, peak: 0.08, type: 'bandpass', f: 2200 * p, to: 700 * p, toT: 0.28, q: 2, buf: G.pink });
    tone(G, o, { type: 'triangle', f: 700 * p, to: 300 * p, t, a: 0.01, d: 0.28, peak: 0.04 });
    boing(G, o, t + 0.3, p, 180, 0.08, 0.3);
    return 0.65;
  },
  // pisando numa poça d'água
  puddleSplash(G, o, t, p) {
    nz(G, o, { t, a: 0.003, d: 0.16, peak: 0.13, type: 'bandpass', f: 2200 * p, to: 900 * p, toT: 0.15, q: 1 });
    drips(G, o, t + 0.04, 4, 0.25, 0.035);
    return 0.35;
  },
  // pegou o frisbee: "plec" de plástico e plim
  pickupFrisbee(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.03, peak: 0.18, type: 'bandpass', f: 3200 * p, q: 3 });
    tone(G, o, { type: 'triangle', f: 880 * p, to: 1320 * p, t: t + 0.02, a: 0.005, d: 0.14, peak: 0.06 });
    marimba(G, o, mtof(88) * p, t + 0.08, 0.06, 0.5);
    return 0.6;
  },
  // objeto na toalha de piquenique: pof no tecido e plim duplo
  picnicPlop(G, o, t, p) {
    nz(G, o, { t, a: 0.004, d: 0.08, peak: 0.1, type: 'lowpass', f: 600 * p, q: 0.9, buf: G.pink });
    fm(G, o, { f: mtof(84) * p, t: t + 0.06, d: 0.6, peak: 0.06, ratio: 3.5, index: 1.3, idxD: 0.1 });
    fm(G, o, { f: mtof(91) * p, t: t + 0.17, d: 0.7, peak: 0.05, ratio: 3.5, index: 1.3, idxD: 0.1 });
    return 0.9;
  },
};
export const MIN_GAP_LAMBE = {
  lickSlurp: 0.12, mudSquelch: 0.15, mudPlop: 0.2, cleanSparkle: 1, dashBlocked: 0.4, slideScrabble: 0.5, slideWhoosh: 0.6,
  slideThump: 0.3, slipBack: 0.5, puddleSplash: 0.18, pickupFrisbee: 0.3, picnicPlop: 0.3,
};
export const PITCH_VAR_LAMBE = {
  lickSlurp: 0.08, mudSquelch: 0.1, mudPlop: 0.08, cleanSparkle: 0.01, dashBlocked: 0.05, slideScrabble: 0.05, slideWhoosh: 0.03,
  slideThump: 0.05, slipBack: 0.04, puddleSplash: 0.1, pickupFrisbee: 0.03, picnicPlop: 0.02,
};
export const VERB_LAMBE = {
  lickSlurp: 0.05, mudSquelch: 0.04, mudPlop: 0.05, cleanSparkle: 0.25, dashBlocked: 0.04, slideScrabble: 0.06, slideWhoosh: 0.12,
  slideThump: 0.08, slipBack: 0.1, puddleSplash: 0.08, pickupFrisbee: 0.12, picnicPlop: 0.2,
};
