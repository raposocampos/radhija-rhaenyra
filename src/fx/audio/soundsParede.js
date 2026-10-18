// Sons do impulso na parede e dos botões/alavancas do alto. Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o feedback toca nos eventos dog:wallJump, wall:touch, wall:button,
// wall:tick, wall:timeout e hatch:*. Todos de uma vez só (pausa e troca de fase não deixam rastro).
import { mtof, nz, tone, fm, marimba } from './synth.js';

export const SOUNDS_PAREDE = {
  // impulso: patinhas raspando a parede ("tec-tec-tec") sobre o "hup" do salto
  wallKick(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 130 * p, to: 75 * p, t, a: 0.004, d: 0.1, peak: 0.2 });
    nz(G, o, { t: t + 0.02, a: 0.05, d: 0.18, peak: 0.1, type: 'bandpass', f: 600 * p, to: 1700 * p, toT: 0.2, q: 1.3 });
    for (let i = 0; i < 4; i++) {
      nz(G, o, { t: t + 0.3 + i * 0.055, a: 0.001, d: 0.022, peak: 0.075 - i * 0.008, type: 'bandpass', f: (1900 + i * 160) * p, q: 3.2 });
    }
    return 0.6;
  },
  // a pata encostando no alto: toquinho seco
  wallTap(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.03, peak: 0.12, type: 'bandpass', f: 1500 * p, q: 2.4 });
    tone(G, o, { type: 'triangle', f: 420 * p, to: 300 * p, t, a: 0.002, d: 0.05, peak: 0.05 });
    return 0.12;
  },
  // botão: clique de mola e "plim" que sobe (opts.on = acendeu)
  buttonClick(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.018, peak: 0.2, type: 'highpass', f: 2600 * p, q: 0.8 });
    tone(G, o, { type: 'square', f: 1180 * p, t, a: 0.001, d: 0.02, peak: 0.03 });
    nz(G, o, { t: t + 0.07, a: 0.001, d: 0.02, peak: 0.12, type: 'bandpass', f: 2000 * p, q: 2 });
    fm(G, o, { f: mtof(84) * p, t: t + 0.09, d: 0.5, peak: 0.06, ratio: 3.5, index: 1.2, idxD: 0.1 });
    fm(G, o, { f: mtof(91) * p, t: t + 0.18, d: 0.6, peak: 0.05, ratio: 3.5, index: 1.2, idxD: 0.1 });
    return 0.8;
  },
  // alavanca: "clanc" metálico de catraca e um tum (opts.on = desceu)
  leverClunk(G, o, t, p, opts = {}) {
    for (let i = 0; i < 3; i++) nz(G, o, { t: t + i * 0.04, a: 0.001, d: 0.02, peak: 0.08, type: 'bandpass', f: (2400 - i * 300) * p, q: 4 });
    tone(G, o, { type: 'triangle', f: (opts.on ? 200 : 260) * p, to: (opts.on ? 120 : 180) * p, t: t + 0.12, a: 0.002, d: 0.12, peak: 0.12 });
    nz(G, o, { t: t + 0.12, a: 0.002, d: 0.08, peak: 0.08, type: 'lowpass', f: 700 * p, q: 1 });
    if (opts.on) marimba(G, o, mtof(81) * p, t + 0.2, 0.05, 0.45);
    return 0.6;
  },
  // relógio do botão: tique baixinho (o último segundo é mais agudo)
  buttonTick(G, o, t, p, opts = {}) {
    const hi = (opts.left ?? 2) <= 1;
    nz(G, o, { t, a: 0.001, d: 0.012, peak: hi ? 0.06 : 0.04, type: 'bandpass', f: (hi ? 3400 : 2600) * p, q: 5 });
    return 0.05;
  },
  // o tempo acabou: dois bipes descendo
  buttonTimeout(G, o, t, p) {
    tone(G, o, { type: 'triangle', f: mtof(76) * p, t, a: 0.004, d: 0.12, peak: 0.07 });
    tone(G, o, { type: 'triangle', f: mtof(69) * p, t: t + 0.13, a: 0.004, d: 0.2, peak: 0.07 });
    return 0.4;
  },
  // portinhola subindo (madeira e dobradiça) / descendo (pof)
  hatchOpen(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.03, peak: 0.12, type: 'bandpass', f: 1800 * p, q: 2.5 });
    tone(G, o, { type: 'sawtooth', f: 380 * p, to: 520 * p, t: t + 0.04, a: 0.04, d: 0.22, peak: 0.018 });
    nz(G, o, { t: t + 0.04, a: 0.04, d: 0.2, peak: 0.04, type: 'bandpass', f: 900 * p, to: 1400 * p, toT: 0.2, q: 3 });
    return 0.35;
  },
  hatchClose(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 180 * p, to: 95 * p, t, a: 0.003, d: 0.1, peak: 0.14 });
    nz(G, o, { t, a: 0.002, d: 0.06, peak: 0.1, type: 'lowpass', f: 900 * p, q: 1 });
    return 0.2;
  },
};
export const MIN_GAP_PAREDE = {
  wallKick: 0.3, wallTap: 0.1, buttonClick: 0.15, leverClunk: 0.2, buttonTick: 0.3, buttonTimeout: 0.3, hatchOpen: 0.2, hatchClose: 0.2,
};
export const PITCH_VAR_PAREDE = {
  wallKick: 0.06, wallTap: 0.08, buttonClick: 0.02, leverClunk: 0.03, buttonTick: 0, buttonTimeout: 0, hatchOpen: 0.05, hatchClose: 0.05,
};
export const VERB_PAREDE = {
  wallKick: 0.05, wallTap: 0.05, buttonClick: 0.15, leverClunk: 0.1, buttonTick: 0.02, buttonTimeout: 0.1, hatchOpen: 0.06, hatchClose: 0.06,
};
