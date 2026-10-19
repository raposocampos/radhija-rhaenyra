// Sons da Biblioteca do Vovô (fase 9). Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o feedback toca nos eventos ladder:*, cat:*, book:*, door:*, power:on,
// duct:open/close, fan:switch, table:deliver e no item:pickup dos óculos e do livro. Tudo de uma vez só (nada fica
// tocando depois da pausa).
import { mtof, nz, tone, fm, marimba } from './synth.js';

export const SOUNDS_BIBLIOTECA = {
  // pegou os óculos: tlim de armação de metal
  pickupGlasses(G, o, t, p) {
    fm(G, o, { f: mtof(93) * p, t, d: 0.5, peak: 0.05, ratio: 2.76, index: 2, idxD: 0.2 });
    fm(G, o, { f: mtof(98) * p, t: t + 0.07, d: 0.45, peak: 0.035, ratio: 2.76, index: 1.6, idxD: 0.2 });
    return 0.6;
  },
  // pegou o livro: "tump" de capa dura e o folhear
  pickupBook(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.09, peak: 0.12, type: 'lowpass', f: 500 * p, q: 0.9, buf: G.pink });
    for (let i = 0; i < 4; i++) nz(G, o, { t: t + 0.08 + i * 0.05, a: 0.004, d: 0.04, peak: 0.03, type: 'bandpass', f: (2600 + i * 200) * p, q: 1.5 });
    marimba(G, o, mtof(84) * p, t + 0.12, 0.04, 0.4);
    return 0.5;
  },
  // rodinhas da escada correndo no trilho (opts.dur)
  ladderRoll(G, o, t, p, opts = {}) {
    const d = Math.max(0.2, opts.dur ?? 0.5);
    nz(G, o, { t, a: 0.03, hold: d - 0.1, d: 0.12, peak: 0.05, type: 'bandpass', f: 380 * p, q: 2, buf: G.pink });
    tone(G, o, { type: 'triangle', f: 95 * p, to: 80 * p, t, a: 0.03, hold: d - 0.1, d: 0.12, peak: 0.015 });
    return d + 0.15;
  },
  // patinha no degrau de madeira
  ladderStep(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.05, peak: 0.07, type: 'bandpass', f: 900 * p, q: 2.5 });
    tone(G, o, { type: 'sine', f: 240 * p, to: 180 * p, t, a: 0.002, d: 0.06, peak: 0.03 });
    return 0.1;
  },
  // miado ofendido: "mrrrrau?"
  catMeow(G, o, t, p) {
    tone(G, o, { type: 'sawtooth', f: 520 * p, to: 760 * p, glideT: 0.22, t, a: 0.04, hold: 0.18, d: 0.22, peak: 0.035, filt: { type: 'bandpass', f: 1400 * p, q: 2.2 }, vib: 12, vibRate: 22 });
    tone(G, o, { type: 'sine', f: 700 * p, to: 480 * p, t: t + 0.22, a: 0.02, d: 0.22, peak: 0.03 });
    return 0.55;
  },
  // o gato pulando: "fff" de pelo
  catJump(G, o, t, p) {
    nz(G, o, { t, a: 0.03, d: 0.2, peak: 0.05, type: 'bandpass', f: 1800 * p, to: 900 * p, toT: 0.2, q: 1, buf: G.pink });
    return 0.3;
  },
  // patinhas macias no chão
  catLand(G, o, t, p) {
    nz(G, o, { t, a: 0.003, d: 0.07, peak: 0.06, type: 'lowpass', f: 420 * p, q: 0.9, buf: G.pink });
    return 0.12;
  },
  // portinha de gato batendo e voltando
  catFlap(G, o, t, p) {
    for (let i = 0; i < 3; i++) nz(G, o, { t: t + i * 0.09, a: 0.002, d: 0.04, peak: 0.07 / (i + 1), type: 'bandpass', f: 1200 * p, q: 3 });
    return 0.35;
  },
  // ronronar na almofada
  catPurr(G, o, t, p) {
    for (let i = 0; i < 6; i++) nz(G, o, { t: t + i * 0.12, a: 0.04, d: 0.06, peak: 0.025, type: 'lowpass', f: 160 * p, q: 3, buf: G.pink });
    return 0.8;
  },
  // o livro caindo do armário: "fuu" e o baque
  bookFall(G, o, t, p) {
    nz(G, o, { t, a: 0.04, d: 0.25, peak: 0.04, type: 'bandpass', f: 1100 * p, to: 500 * p, toT: 0.3, q: 1, buf: G.pink });
    return 0.35;
  },
  bookThud(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.14, peak: 0.16, type: 'lowpass', f: 380 * p, q: 0.8, buf: G.pink });
    tone(G, o, { type: 'sine', f: 120 * p, to: 70 * p, t, a: 0.002, d: 0.12, peak: 0.08 });
    return 0.25;
  },
  // porta abrindo (rangido) e fechando (trinco)
  doorCreak(G, o, t, p) {
    nz(G, o, { t, a: 0.08, hold: 0.25, d: 0.2, peak: 0.035, type: 'bandpass', f: 900 * p, to: 1500 * p, toT: 0.5, q: 12 });
    tone(G, o, { type: 'sawtooth', f: 180 * p, to: 230 * p, t, a: 0.08, hold: 0.2, d: 0.2, peak: 0.008, filt: { type: 'bandpass', f: 900 * p, q: 6 } });
    return 0.6;
  },
  doorLatch(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.08, peak: 0.12, type: 'lowpass', f: 600 * p, q: 1 });
    nz(G, o, { t: t + 0.05, a: 0.001, d: 0.03, peak: 0.08, type: 'bandpass', f: 2600 * p, q: 4 });
    return 0.2;
  },
  // ar correndo no duto
  ductWhoosh(G, o, t, p, opts = {}) {
    const d = Math.max(0.5, opts.dur ?? 2);
    nz(G, o, { t, a: 0.2, hold: d - 0.5, d: 0.3, peak: 0.035, type: 'bandpass', f: 600 * p, to: 1100 * p, toT: d, q: 0.8, buf: G.pink });
    return d + 0.1;
  },
  // disjuntor: "clunk" pesado e o zumbido da energia subindo
  powerOn(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.1, peak: 0.16, type: 'lowpass', f: 420 * p, q: 1.2 });
    nz(G, o, { t: t + 0.03, a: 0.001, d: 0.04, peak: 0.08, type: 'bandpass', f: 2200 * p, q: 3 });
    tone(G, o, { type: 'sawtooth', f: 60 * p, t: t + 0.08, a: 0.25, hold: 0.25, d: 0.35, peak: 0.012, filt: { type: 'lowpass', f: 300 * p, q: 1 } });
    fm(G, o, { f: mtof(79) * p, t: t + 0.32, d: 0.5, peak: 0.035, ratio: 2, index: 1, idxD: 0.2 });
    return 0.9;
  },
  // registro do duto: as palhetas deitando (clac-clac-clac) e o ar entrando
  ductOpen(G, o, t, p) {
    for (let i = 0; i < 5; i++) nz(G, o, { t: t + i * 0.05, a: 0.001, d: 0.03, peak: 0.05, type: 'bandpass', f: (1500 + i * 120) * p, q: 3 });
    nz(G, o, { t: t + 0.25, a: 0.1, d: 0.4, peak: 0.025, type: 'bandpass', f: 700 * p, q: 0.8, buf: G.pink });
    return 0.8;
  },
  ductClose(G, o, t, p) {
    for (let i = 0; i < 3; i++) nz(G, o, { t: t + i * 0.05, a: 0.001, d: 0.03, peak: 0.04, type: 'bandpass', f: (1300 - i * 100) * p, q: 3 });
    return 0.25;
  },
  // botão do ventilador: clique e o motor subindo (ou descendo)
  fanSwitch(G, o, t, p, opts = {}) {
    nz(G, o, { t, a: 0.001, d: 0.025, peak: 0.07, type: 'bandpass', f: 2400 * p, q: 3 });
    const on = opts.on !== false;
    tone(G, o, { type: 'triangle', f: (on ? 70 : 140) * p, to: (on ? 140 : 60) * p, glideT: 0.6, t: t + 0.03, a: 0.1, hold: 0.3, d: 0.3, peak: 0.02 });
    return 0.8;
  },
  // a Rhaenyra firma as patas na escadinha
  ladderHold(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.06, peak: 0.06, type: 'bandpass', f: 700 * p, q: 2 });
    tone(G, o, { type: 'sine', f: 200 * p, to: 160 * p, t, a: 0.003, d: 0.08, peak: 0.025 });
    return 0.15;
  },
  // objeto na mesinha: toque de madeira e plim duplo
  tableDeliver(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.06, peak: 0.08, type: 'bandpass', f: 1100 * p, q: 2 });
    fm(G, o, { f: mtof(86) * p, t: t + 0.06, d: 0.6, peak: 0.06, ratio: 3.5, index: 1.3, idxD: 0.1 });
    fm(G, o, { f: mtof(93) * p, t: t + 0.17, d: 0.7, peak: 0.05, ratio: 3.5, index: 1.3, idxD: 0.1 });
    return 0.9;
  },
};
export const MIN_GAP_BIBLIOTECA = {
  pickupGlasses: 0.3, pickupBook: 0.3, ladderRoll: 0.3, ladderStep: 0.08, catMeow: 0.5, catJump: 0.3, catLand: 0.2, catFlap: 0.3,
  catPurr: 1, bookFall: 0.3, bookThud: 0.2, doorCreak: 0.4, doorLatch: 0.2, ductWhoosh: 0.5, tableDeliver: 0.3,
  powerOn: 0.5, ductOpen: 0.4, ductClose: 0.3, fanSwitch: 0.2, ladderHold: 0.2,
};
export const PITCH_VAR_BIBLIOTECA = {
  pickupGlasses: 0.02, pickupBook: 0.03, ladderRoll: 0.03, ladderStep: 0.08, catMeow: 0.04, catJump: 0.05, catLand: 0.06, catFlap: 0.05,
  catPurr: 0.03, bookFall: 0.04, bookThud: 0.05, doorCreak: 0.04, doorLatch: 0.04, ductWhoosh: 0.03, tableDeliver: 0.02,
  powerOn: 0.02, ductOpen: 0.03, ductClose: 0.03, fanSwitch: 0.03, ladderHold: 0.05,
};
export const VERB_BIBLIOTECA = {
  pickupGlasses: 0.15, pickupBook: 0.1, ladderRoll: 0.06, ladderStep: 0.05, catMeow: 0.12, catJump: 0.05, catLand: 0.05, catFlap: 0.06,
  catPurr: 0.05, bookFall: 0.06, bookThud: 0.08, doorCreak: 0.12, doorLatch: 0.08, ductWhoosh: 0.1, tableDeliver: 0.2,
  powerOn: 0.12, ductOpen: 0.08, ductClose: 0.06, fanSwitch: 0.06, ladderHold: 0.04,
};
