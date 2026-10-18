// Sons da Lavanderia de Domingo (fase 8). Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o feedback toca nos eventos sock:yank, rack:move, washer:spin,
// blanket:*, bed:deliver e no item:pickup da meia. Todos de uma vez só (nada fica tocando depois da pausa).
import { mtof, nz, tone, fm, marimba, boing } from './synth.js';

export const SOUNDS_LAVANDERIA = {
  // pegou a meia: pregador estalando ("plic") e o elástico do punho
  pickupSock(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.02, peak: 0.16, type: 'bandpass', f: 3000 * p, q: 3 });
    tone(G, o, { type: 'triangle', f: 520 * p, to: 760 * p, t: t + 0.03, a: 0.004, d: 0.12, peak: 0.05 });
    marimba(G, o, mtof(86) * p, t + 0.1, 0.05, 0.45);
    return 0.6;
  },
  // o tranco da arrancada no pregador: "tóim" de mola e um puxão de tecido
  sockYank(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.08, peak: 0.12, type: 'bandpass', f: 1400 * p, to: 2600 * p, toT: 0.08, q: 1.6, buf: G.pink });
    boing(G, o, t + 0.02, p, 380, 0.07, 0.3);
    return 0.45;
  },
  // motor do varal descendo (opts.dir = 'down') ou subindo: zumbido com polia rangendo
  rackMotor(G, o, t, p, opts = {}) {
    const down = opts.dir !== 'up';
    tone(G, o, { type: 'sawtooth', f: (down ? 150 : 120) * p, to: (down ? 120 : 160) * p, t, a: 0.08, hold: 0.7, d: 0.25, peak: 0.022 });
    nz(G, o, { t, a: 0.08, hold: 0.7, d: 0.25, peak: 0.03, type: 'bandpass', f: 480 * p, q: 4 });
    for (let i = 0; i < 4; i++) nz(G, o, { t: t + 0.12 + i * 0.22, a: 0.004, d: 0.05, peak: 0.025, type: 'bandpass', f: (2100 + i * 90) * p, q: 6 });
    return 1.1;
  },
  // centrífuga: ronco que acelera e o tambor batendo (dura opts.time s)
  washerSpin(G, o, t, p, opts = {}) {
    const dur = Math.max(1.5, opts.time ?? 4);
    tone(G, o, { type: 'sawtooth', f: 55 * p, to: 95 * p, glideT: dur * 0.6, t, a: 0.4, hold: dur - 0.9, d: 0.5, peak: 0.05 });
    nz(G, o, { t, a: 0.4, hold: dur - 0.9, d: 0.5, peak: 0.06, type: 'lowpass', f: 300 * p, to: 700 * p, toT: dur * 0.6, q: 1.2, buf: G.pink });
    for (let k = 0.5; k < dur - 0.5; k += 0.32) nz(G, o, { t: t + k, a: 0.003, d: 0.07, peak: 0.035, type: 'lowpass', f: 260 * p, q: 2 });
    return dur + 0.2;
  },
  // a mantinha escorregando e caindo: "fuuu" de pano
  blanketFall(G, o, t, p) {
    nz(G, o, { t, a: 0.06, d: 0.35, peak: 0.08, type: 'bandpass', f: 900 * p, to: 400 * p, toT: 0.4, q: 0.9, buf: G.pink });
    return 0.5;
  },
  // pano macio aterrissando (opts.inBasket: o plástico do cesto responde)
  blanketPlop(G, o, t, p, opts = {}) {
    nz(G, o, { t, a: 0.004, d: 0.12, peak: 0.14, type: 'lowpass', f: 520 * p, q: 0.8, buf: G.pink });
    tone(G, o, { type: 'sine', f: 110 * p, to: 70 * p, t, a: 0.003, d: 0.1, peak: 0.07 });
    if (opts.inBasket) nz(G, o, { t: t + 0.01, a: 0.001, d: 0.05, peak: 0.06, type: 'bandpass', f: 1500 * p, q: 3 });
    return 0.3;
  },
  // objeto na caminha: pof no estofado e plim duplo
  bedPlop(G, o, t, p) {
    nz(G, o, { t, a: 0.004, d: 0.1, peak: 0.1, type: 'lowpass', f: 560 * p, q: 0.9, buf: G.pink });
    fm(G, o, { f: mtof(84) * p, t: t + 0.06, d: 0.6, peak: 0.06, ratio: 3.5, index: 1.3, idxD: 0.1 });
    fm(G, o, { f: mtof(91) * p, t: t + 0.17, d: 0.7, peak: 0.05, ratio: 3.5, index: 1.3, idxD: 0.1 });
    return 0.9;
  },
};
export const MIN_GAP_LAVANDERIA = {
  pickupSock: 0.3, sockYank: 0.3, rackMotor: 0.5, washerSpin: 1, blanketFall: 0.3, blanketPlop: 0.2, bedPlop: 0.3,
};
export const PITCH_VAR_LAVANDERIA = {
  pickupSock: 0.03, sockYank: 0.05, rackMotor: 0.02, washerSpin: 0.02, blanketFall: 0.05, blanketPlop: 0.06, bedPlop: 0.02,
};
export const VERB_LAVANDERIA = {
  pickupSock: 0.12, sockYank: 0.08, rackMotor: 0.06, washerSpin: 0.05, blanketFall: 0.06, blanketPlop: 0.06, bedPlop: 0.2,
};
