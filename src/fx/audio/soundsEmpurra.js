// Sons do empurrão em pé da Rhaenyra e do que cai lá de cima. Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o feedback toca nos eventos dog:rear, dog:shove, shove:*, dog:shoved e dog:huff.
import { mtof, nz, tone, fm, squeak, boing } from './synth.js';

export const SOUNDS_EMPURRA = {
  // ficar de pé: "hup" curtinho e as patas da frente apoiando
  shoveRear(G, o, t, p) {
    tone(G, o, { type: 'triangle', f: 290 * p, to: 360 * p, glideT: 0.08, t, a: 0.01, d: 0.09, peak: 0.05, filt: { type: 'lowpass', f: 1800, q: 0.7 } });
    nz(G, o, { t: t + 0.04, a: 0.006, d: 0.07, peak: 0.05, type: 'bandpass', f: 900 * p, q: 1.2, buf: G.pink });
    nz(G, o, { t: t + 0.36, a: 0.002, d: 0.05, peak: 0.07, type: 'lowpass', f: 1100 * p, q: 0.8, buf: G.pink });
    return 0.45;
  },
  // cada empurrão: um tum no que ela empurra (opts.kind: tronco abafado, madeira oca, a irmã fofinha)
  shoveThump(G, o, t, p, opts = {}) {
    const k = opts.kind;
    if (k === 'sister') {
      nz(G, o, { t, a: 0.01, d: 0.1, peak: 0.08, type: 'lowpass', f: 650 * p, q: 0.7, buf: G.pink });
      return 0.15;
    }
    const wood = k === 'table' || k === 'shelf';
    tone(G, o, { type: 'sine', f: (wood ? 190 : 120) * p, to: (wood ? 120 : 70) * p, t, a: 0.003, d: wood ? 0.12 : 0.16, peak: 0.16 });
    nz(G, o, { t, a: 0.002, d: wood ? 0.05 : 0.08, peak: wood ? 0.12 : 0.08, type: 'bandpass', f: (wood ? 1300 : 600) * p, q: wood ? 2.2 : 1 });
    if (wood) tone(G, o, { type: 'triangle', f: 640 * p, to: 520 * p, t, a: 0.002, d: 0.08, peak: 0.03 });
    return 0.25;
  },
  // a copa balançando: farfalhar que cresce a cada empurrão (opts.n)
  leafRustle(G, o, t, p, opts = {}) {
    const n = Math.min(3, opts.n ?? 1);
    nz(G, o, { t: t + 0.03, a: 0.05, hold: 0.1 + n * 0.06, d: 0.3, peak: 0.03 + n * 0.012, type: 'bandpass', f: 2600 * p, to: 3600 * p, toT: 0.4, q: 0.8, buf: G.pink });
    nz(G, o, { t: t + 0.2, a: 0.04, hold: 0.05, d: 0.25, peak: 0.02 + n * 0.008, type: 'highpass', f: 4200 * p, q: 0.7 });
    return 0.7;
  },
  // o item se solta: estalinho de galho ou o arrasto na madeira
  shoveRelease(G, o, t, p, opts = {}) {
    if (opts.kind === 'tree') {
      nz(G, o, { t, a: 0.001, d: 0.03, peak: 0.1, type: 'bandpass', f: 2400 * p, q: 3 });
      nz(G, o, { t: t + 0.035, a: 0.001, d: 0.025, peak: 0.07, type: 'bandpass', f: 3000 * p, q: 3 });
    } else nz(G, o, { t, a: 0.02, hold: 0.12, d: 0.08, peak: 0.05, type: 'bandpass', f: 1500 * p, to: 2200 * p, toT: 0.2, q: 2.5 });
    fm(G, o, { f: mtof(86) * p, t: t + 0.05, d: 0.35, peak: 0.03, ratio: 3, index: 0.8, idxD: 0.1 });
    return 0.45;
  },
  // quique no chão (opts.k = força 0..1; opts.id escolhe o material: bola, patinho, ursinho)
  shoveBounce(G, o, t, p, opts = {}) {
    const k = Math.max(0.15, Math.min(1, opts.k ?? 0.6));
    if (opts.id === 'mesinha') {
      squeak(G, o, t, p * (0.95 + k * 0.1), 1200, 1600, 1300, 0.08, 0.05 + k * 0.05);
      nz(G, o, { t, a: 0.002, d: 0.04, peak: 0.06 * k, type: 'lowpass', f: 900 * p, q: 0.8, buf: G.pink });
      return 0.2;
    }
    if (opts.id === 'estante') {
      nz(G, o, { t, a: 0.01, d: 0.12, peak: 0.1 * k, type: 'lowpass', f: 600 * p, q: 0.6, buf: G.pink });
      tone(G, o, { type: 'sine', f: 170 * p, to: 120 * p, t, a: 0.004, d: 0.1, peak: 0.07 * k });
      return 0.2;
    }
    boing(G, o, t, p * (0.9 + k * 0.25), 300, 0.04 + k * 0.08, 0.16);
    nz(G, o, { t, a: 0.001, d: 0.03, peak: 0.08 * k, type: 'lowpass', f: 1200 * p, q: 0.7 });
    return 0.25;
  },
  // mesa e estante voltando aos pés: "toc" seco (opts.k)
  shoveSettle(G, o, t, p, opts = {}) {
    const k = Math.max(0.2, Math.min(1, opts.k ?? 0.6));
    nz(G, o, { t, a: 0.001, d: 0.035, peak: 0.1 * k, type: 'bandpass', f: 1700 * p, q: 2.6 });
    tone(G, o, { type: 'sine', f: 240 * p, to: 160 * p, t, a: 0.002, d: 0.06, peak: 0.06 * k });
    return 0.12;
  },
  // a irmã empurrada: "ip!" surpreso (mais grave na Rhaenyra)
  shovedYip(G, o, t, p, opts = {}) {
    const r = opts.name === 'rhaenyra' ? 0.78 : 1;
    tone(G, o, { type: 'triangle', f: 760 * p * r, to: 1080 * p * r, glideT: 0.05, t, a: 0.008, d: 0.08, peak: 0.07, filt: { type: 'lowpass', f: 3200, q: 0.8 } });
    return 0.15;
  },
  // "hmpf": duas bufadas pelo nariz, a segunda mais longa
  huff(G, o, t, p) {
    nz(G, o, { t, a: 0.01, d: 0.07, peak: 0.07, type: 'bandpass', f: 1100 * p, to: 700 * p, toT: 0.08, q: 1.6, buf: G.pink });
    nz(G, o, { t: t + 0.13, a: 0.015, hold: 0.04, d: 0.16, peak: 0.08, type: 'bandpass', f: 1000 * p, to: 560 * p, toT: 0.2, q: 1.4, buf: G.pink });
    tone(G, o, { type: 'sine', f: 210 * p, to: 160 * p, t: t + 0.13, a: 0.02, d: 0.14, peak: 0.025 });
    return 0.4;
  },
};
export const MIN_GAP_EMPURRA = {
  shoveRear: 0.3, shoveThump: 0.12, leafRustle: 0.25, shoveRelease: 0.2, shoveBounce: 0.05, shoveSettle: 0.1, shovedYip: 0.3, huff: 0.4,
};
export const PITCH_VAR_EMPURRA = {
  shoveRear: 0.05, shoveThump: 0.06, leafRustle: 0.08, shoveRelease: 0.05, shoveBounce: 0.05, shoveSettle: 0.08, shovedYip: 0.04, huff: 0.05,
};
export const VERB_EMPURRA = {
  shoveRear: 0.04, shoveThump: 0.08, leafRustle: 0.06, shoveRelease: 0.08, shoveBounce: 0.06, shoveSettle: 0.06, shovedYip: 0.05, huff: 0.03,
};
