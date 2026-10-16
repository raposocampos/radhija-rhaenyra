// Sons da v3: itens e mecânicas das fases 4 (terraço) e 5 (dentro de casa) e as entradas deles nas
// tabelas de mixagem. Cada som: (G, dest, t, p, opts) → duração (s). A biblioteca completa é montada
// em ./sounds.js.
import { mtof, nz, tone, fm, squeak, flaps, marimba } from './synth.js';

export const SOUNDS3 = {
  // ---------- itens ----------
  // Patinho de borracha: o "quén-quén" apertado pela boca + brilho.
  pickupDuck(G, o, t, p) {
    squeak(G, o, t, p, 1250, 1650, 1350, 0.11, 0.09);
    squeak(G, o, t + 0.16, p * 1.06, 1300, 1750, 1450, 0.09, 0.07);
    fm(G, o, { f: mtof(89) * p, t: t + 0.12, d: 0.42, peak: 0.035, ratio: 3, index: 0.9, idxD: 0.1 });
    return 0.6;
  },
  // Ursinho de pelúcia: "fofo" abafado e uma frase de caixinha de música.
  pickupBear(G, o, t, p) {
    nz(G, o, { t, a: 0.03, d: 0.16, peak: 0.14, type: 'lowpass', f: 700 * p, q: 0.6, buf: G.pink });
    tone(G, o, { type: 'sine', f: 190 * p, to: 140 * p, t: t + 0.01, a: 0.02, d: 0.14, peak: 0.1 });
    [84, 88, 91, 96].forEach((m, i) => marimba(G, o, mtof(m) * p, t + 0.1 + i * 0.09, 0.05, 0.5));
    return 0.8;
  },
  // ---------- terraço ----------
  // Pombo que nem liga para o latido: um "rru" preguiçoso.
  pigeonShrug(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 250 * p, to: 210 * p, t, a: 0.04, d: 0.24, peak: 0.07, vib: 7, vibRate: 20 });
    return 0.4;
  },
  // Pombo do caminho saindo voando (mais curto que o do poleiro).
  pigeonHop(G, o, t, p) {
    flaps(G, o, t, 6, 15, 0.16);
    tone(G, o, { type: 'sine', f: 340 * p, to: 280 * p, t: t + 0.03, a: 0.02, d: 0.12, peak: 0.06 });
    return 0.6;
  },
  // ---------- casa ----------
  // Trava do portãozinho: clique de plástico.
  babyLatch(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.025, peak: 0.22, type: 'bandpass', f: 3200 * p, q: 3 });
    tone(G, o, { type: 'triangle', f: 900 * p, to: 600 * p, t: t + 0.005, a: 0.001, d: 0.04, peak: 0.08 });
    nz(G, o, { t: t + 0.07, a: 0.001, d: 0.02, peak: 0.12, type: 'bandpass', f: 2400 * p, q: 3 });
    return 0.2;
  },
  // Caixa de papelão escorregando no piso (ao começar a empurrar).
  boxScuff(G, o, t, p) {
    nz(G, o, { t, a: 0.02, d: 0.22, peak: 0.12, type: 'bandpass', f: 480 * p, to: 360 * p, toT: 0.2, q: 0.9, buf: G.pink });
    return 0.3;
  },
};
export const MIN_GAP_V3 = { pickupDuck: 0.3, pickupBear: 0.3, pigeonShrug: 0.6, pigeonHop: 0.6, babyLatch: 0.2, boxScuff: 0.25 };
export const PITCH_VAR_V3 = { pickupDuck: 0.04, pickupBear: 0.02, pigeonShrug: 0.05, pigeonHop: 0.05, babyLatch: 0.04, boxScuff: 0.06 };
export const VERB_V3 = { pickupDuck: 0.12, pickupBear: 0.2, pigeonShrug: 0.12, pigeonHop: 0.15, babyLatch: 0.08, boxScuff: 0.06 };
