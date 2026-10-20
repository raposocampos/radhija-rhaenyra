// Sons da Festa no Quintal (fase 10). Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o feedback toca nos eventos water:*, boat:dock, bucket:*, deck:arrive, rope:grab,
// rope:drop, pigeon:peck, cake:*, shed:*, generator:*, painting:look, item:drop e no item:pickup dos três enfeites. Tudo
// de uma vez só (a água correndo e o motor do gerador vêm em trechos curtos, emitidos pela fase enquanto duram: nada
// fica tocando na pausa).
import { mtof, nz, tone, fm, marimba, flaps, drips, boing, osc, flt, gn, env } from './synth.js';

export const SOUNDS_QUINTAL = {
  // pegou o chapeuzinho: papelão fininho e um plim
  pickupHat(G, o, t, p) {
    nz(G, o, { t, a: 0.004, d: 0.08, peak: 0.06, type: 'bandpass', f: 3200 * p, q: 1.2 });
    marimba(G, o, mtof(84) * p, t + 0.05, 0.05, 0.4);
    marimba(G, o, mtof(91) * p, t + 0.13, 0.04, 0.4);
    return 0.6;
  },
  // pegou o laço: o cetim deslizando e um brilho
  pickupRibbon(G, o, t, p) {
    nz(G, o, { t, a: 0.03, d: 0.18, peak: 0.05, type: 'bandpass', f: 4200 * p, to: 2400 * p, toT: 0.2, q: 0.8, buf: G.pink });
    fm(G, o, { f: mtof(88) * p, t: t + 0.08, d: 0.5, peak: 0.045, ratio: 3, index: 1.2, idxD: 0.1 });
    return 0.6;
  },
  // pegou a vela do 3: tique de cera e o tilintar das estrelinhas
  pickupCandle(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.04, peak: 0.07, type: 'bandpass', f: 1800 * p, q: 2 });
    for (let i = 0; i < 3; i++) fm(G, o, { f: mtof(93 + i * 4) * p, t: t + 0.06 + i * 0.06, d: 0.35, peak: 0.03, ratio: 2.76, index: 1.4, idxD: 0.15 });
    return 0.6;
  },
  // golfada de água correndo pela mangueira e caindo na piscininha
  waterGush(G, o, t, p, opts = {}) {
    const d = Math.max(0.4, opts.dur ?? 0.9);
    nz(G, o, { t, a: 0.12, hold: d - 0.3, d: 0.2, peak: 0.04, type: 'bandpass', f: 900 * p, q: 0.7, buf: G.pink });
    nz(G, o, { t, a: 0.1, hold: d - 0.3, d: 0.2, peak: 0.025, type: 'highpass', f: 3500 * p, q: 0.5 });
    drips(G, o, t + 0.05, 5, d - 0.1, 0.018, 900, 2200);
    return d + 0.1;
  },
  // a água começa a correr: o "fssst" da torneira e o primeiro jato
  waterStart(G, o, t, p) {
    nz(G, o, { t, a: 0.06, d: 0.35, peak: 0.07, type: 'bandpass', f: 1400 * p, to: 800 * p, toT: 0.3, q: 1.1, buf: G.pink });
    drips(G, o, t + 0.15, 6, 0.4, 0.03, 1000, 2600);
    return 0.6;
  },
  // a água parou (caixote em cima da mangueira)
  waterStop(G, o, t, p) {
    nz(G, o, { t, a: 0.01, d: 0.25, peak: 0.05, type: 'bandpass', f: 700 * p, to: 300 * p, toT: 0.25, q: 1.2, buf: G.pink });
    tone(G, o, { type: 'sine', f: 200 * p, to: 120 * p, t, a: 0.01, d: 0.2, peak: 0.03 });
    return 0.35;
  },
  // a piscininha encheu: bolhinhas e um arpejo
  waterFull(G, o, t, p) {
    drips(G, o, t, 8, 0.5, 0.03, 700, 1800);
    [72, 76, 79, 84].forEach((m, i) => marimba(G, o, mtof(m) * p, t + 0.1 + i * 0.09, 0.05, 0.5));
    return 0.9;
  },
  // o barquinho encosta na borda inflável
  boatDock(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 180 * p, to: 120 * p, t, a: 0.004, d: 0.14, peak: 0.08 });
    nz(G, o, { t, a: 0.004, d: 0.1, peak: 0.05, type: 'lowpass', f: 600 * p, q: 1, buf: G.pink });
    drips(G, o, t + 0.05, 3, 0.2, 0.02, 800, 1600);
    return 0.4;
  },
  // roldana rangendo (o balde sobe ou desce)
  pulleyCreak(G, o, t, p, opts = {}) {
    const up = opts.up !== false;
    tone(G, o, { type: 'sawtooth', f: (up ? 620 : 520) * p, to: (up ? 760 : 440) * p, t, a: 0.03, hold: 0.06, d: 0.12, peak: 0.012, filt: { type: 'bandpass', f: 1500 * p, q: 8 }, vib: 30, vibRate: 28 });
    return 0.25;
  },
  // o balde de lata: "clonc"
  bucketClank(G, o, t, p) {
    fm(G, o, { f: 420 * p, t, d: 0.4, peak: 0.07, ratio: 2.41, index: 3, idxD: 0.06 });
    fm(G, o, { f: 610 * p, t: t + 0.01, d: 0.3, peak: 0.04, ratio: 3.17, index: 2.5, idxD: 0.05 });
    nz(G, o, { t, a: 0.001, d: 0.05, peak: 0.06, type: 'bandpass', f: 2600 * p, q: 2 });
    return 0.5;
  },
  // patinhas na tábua do deque
  deckThump(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.08, peak: 0.1, type: 'lowpass', f: 500 * p, q: 1, buf: G.pink });
    tone(G, o, { type: 'sine', f: 140 * p, to: 90 * p, t, a: 0.002, d: 0.1, peak: 0.05 });
    return 0.2;
  },
  // pegou (ou soltou) a corda: o rangido da fibra
  ropeCreak(G, o, t, p) {
    nz(G, o, { t, a: 0.02, d: 0.16, peak: 0.05, type: 'bandpass', f: 700 * p, to: 1100 * p, toT: 0.15, q: 4, buf: G.pink });
    return 0.25;
  },
  // o pombo bicando e batendo as asas em quem chega perto do laço
  pigeonPeck(G, o, t, p) {
    for (let i = 0; i < 3; i++) nz(G, o, { t: t + i * 0.07, a: 0.001, d: 0.02, peak: 0.08, type: 'bandpass', f: 2800 * p, q: 3 });
    flaps(G, o, t + 0.2, 4, 12, 0.07);
    tone(G, o, { type: 'sine', f: 520 * p, to: 420 * p, t: t + 0.18, a: 0.02, d: 0.18, peak: 0.03, vib: 20, vibRate: 18 });
    return 0.6;
  },
  // o enfeite no andar certo: plim duplo e açúcar
  cakePlace(G, o, t, p) {
    fm(G, o, { f: mtof(84) * p, t, d: 0.6, peak: 0.06, ratio: 3.5, index: 1.3, idxD: 0.1 });
    fm(G, o, { f: mtof(91) * p, t: t + 0.11, d: 0.7, peak: 0.055, ratio: 3.5, index: 1.3, idxD: 0.1 });
    drips(G, o, t + 0.2, 4, 0.3, 0.015, 3000, 5000);
    return 0.9;
  },
  // fora de ordem: o enfeite balança (boing murcho)
  cakeWrong(G, o, t, p) {
    boing(G, o, t, p, 240, 0.06, 0.4);
    tone(G, o, { type: 'triangle', f: 330 * p, to: 220 * p, t: t + 0.2, a: 0.01, d: 0.3, peak: 0.035 });
    return 0.6;
  },
  // o enfeite cai na grama
  cakeFall(G, o, t, p) {
    nz(G, o, { t, a: 0.003, d: 0.09, peak: 0.07, type: 'lowpass', f: 450 * p, q: 0.9, buf: G.pink });
    return 0.15;
  },
  // o bolo pronto: buzininha de festa e o arpejo de parabéns
  partyHorn(G, o, t, p) {
    tone(G, o, { type: 'sawtooth', f: 520 * p, to: 700 * p, glideT: 0.12, t, a: 0.02, hold: 0.35, d: 0.15, peak: 0.03, filt: { type: 'bandpass', f: 1400 * p, q: 1.5 }, vib: 14, vibRate: 7 });
    nz(G, o, { t: t + 0.05, a: 0.05, hold: 0.25, d: 0.1, peak: 0.02, type: 'bandpass', f: 4200 * p, q: 1, buf: G.pink });
    [72, 76, 79, 84, 88].forEach((m, i) => marimba(G, o, mtof(m) * p, t + 0.55 + i * 0.1, 0.055, 0.6));
    return 1.4;
  },
  // porta basculante subindo (rolamento e mola) e descendo (baque)
  shedOpen(G, o, t, p) {
    nz(G, o, { t, a: 0.1, hold: 0.4, d: 0.2, peak: 0.04, type: 'lowpass', f: 380 * p, q: 1.4, buf: G.pink });
    tone(G, o, { type: 'sawtooth', f: 160 * p, to: 210 * p, t, a: 0.1, hold: 0.4, d: 0.2, peak: 0.006, filt: { type: 'bandpass', f: 700 * p, q: 5 } });
    nz(G, o, { t: t + 0.7, a: 0.002, d: 0.06, peak: 0.06, type: 'bandpass', f: 1600 * p, q: 3 });
    return 0.9;
  },
  shedClose(G, o, t, p) {
    nz(G, o, { t, a: 0.06, hold: 0.25, d: 0.1, peak: 0.03, type: 'lowpass', f: 360 * p, q: 1.4, buf: G.pink });
    nz(G, o, { t: t + 0.42, a: 0.002, d: 0.14, peak: 0.12, type: 'lowpass', f: 420 * p, q: 0.9, buf: G.pink });
    return 0.6;
  },
  // olhando o quadro de perto: um brilho de lembrança
  paintingChime(G, o, t, p) {
    [79, 83, 86, 91].forEach((m, i) => fm(G, o, { f: mtof(m) * p, t: t + i * 0.08, d: 0.7, peak: 0.035, ratio: 2, index: 0.8, idxD: 0.2 }));
    return 1.0;
  },
  // largou um enfeite no chão
  itemDrop(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.07, peak: 0.06, type: 'lowpass', f: 700 * p, q: 0.9, buf: G.pink });
    return 0.12;
  },
  // galinha ciscando: "cóc… cóc" (dois toques curtos e nasais)
  cluck(G, o, t, p) {
    for (const [dt, f0] of [[0, 560], [0.13, 640]]) {
      tone(G, o, { type: 'square', f: f0 * p, to: f0 * 0.78 * p, glideT: 0.06, t: t + dt, a: 0.004, d: 0.06, peak: 0.022, filt: { type: 'bandpass', f: 1300 * p, q: 1.6 } });
      nz(G, o, { t: t + dt, a: 0.002, d: 0.04, peak: 0.018, type: 'bandpass', f: 2200 * p, q: 2 });
    }
    return 0.3;
  },
  // galinha assustada: "có-có-có-CÓÓ!" correndo
  chickenAlarm(G, o, t, p) {
    for (let i = 0; i < 3; i++) tone(G, o, { type: 'square', f: 640 * p, to: 520 * p, glideT: 0.05, t: t + i * 0.09, a: 0.003, d: 0.05, peak: 0.024, filt: { type: 'bandpass', f: 1400 * p, q: 1.5 } });
    tone(G, o, { type: 'square', f: 720 * p, to: 980 * p, glideT: 0.12, t: t + 0.3, a: 0.01, hold: 0.06, d: 0.16, peak: 0.03, filt: { type: 'bandpass', f: 1600 * p, q: 1.2 } });
    return 0.6;
  },
  // o bater de asas do voo curto
  wingFlap(G, o, t, p) {
    void p;
    return flaps(G, o, t, 7, 13, 0.13);
  },
  // o caixote travando na marca do chão: "toc" de madeira e um plim
  crateClick(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.05, peak: 0.08, type: 'bandpass', f: 1100 * p, q: 2.2 });
    marimba(G, o, mtof(84) * p, t + 0.04, 0.045, 0.35);
    return 0.4;
  },
  // batida na piñata: papelão grosso
  pinataThump(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 150 * p, to: 90 * p, glideT: 0.12, t, a: 0.003, d: 0.14, peak: 0.12 });
    nz(G, o, { t, a: 0.002, d: 0.09, peak: 0.06, type: 'bandpass', f: 900 * p, q: 0.8, buf: G.pink });
    return 0.25;
  },
  // colheu um legume: a terra soltando
  pluck(G, o, t, p) {
    nz(G, o, { t, a: 0.004, d: 0.08, peak: 0.05, type: 'lowpass', f: 900 * p, q: 0.8, buf: G.pink });
    boing(G, o, t + 0.03, p, 330, 0.03, 0.18);
    return 0.25;
  },
  // o gerador: a cordinha de partida correndo (zíper com catraca) e o motor girando duas vezes
  genPull(G, o, t, p) {
    nz(G, o, { t, a: 0.02, d: 0.32, peak: 0.07, type: 'bandpass', f: 700 * p, to: 2600 * p, toT: 0.3, q: 2.2 });
    for (let i = 0; i < 6; i++) nz(G, o, { t: t + 0.03 + i * 0.045, a: 0.001, d: 0.018, peak: 0.045, type: 'highpass', f: 3500 * p, q: 1 });
    for (let i = 0; i < 2; i++) tone(G, o, { type: 'sine', f: 90 * p, to: 60 * p, glideT: 0.06, t: t + 0.14 + i * 0.13, a: 0.003, d: 0.07, peak: 0.08 });
    return 0.5;
  },
  // engasgando: tossidas do motor, cada vez mais juntas
  genCrank(G, o, t, p) {
    const times = [0, 0.17, 0.29, 0.46, 0.55, 0.63, 0.71, 0.78, 0.84, 0.9, 0.95];
    times.forEach((dt, i) => {
      const k = i / times.length;
      tone(G, o, { type: 'sawtooth', f: (68 + k * 26) * p, to: 44 * p, glideT: 0.05, t: t + dt, a: 0.003, d: 0.06, peak: 0.045 + 0.03 * k, filt: { type: 'lowpass', f: 520 * p, q: 1 } });
      nz(G, o, { t: t + dt, a: 0.002, d: 0.05, peak: 0.028, type: 'lowpass', f: 700 * p, q: 0.8, buf: G.pink });
    });
    return 1.05;
  },
  // pegou: o ronco sobe e firma, com um plim
  genStart(G, o, t, p) {
    tone(G, o, { type: 'sawtooth', f: 38 * p, to: 52 * p, glideT: 0.35, t, a: 0.05, hold: 0.25, d: 0.25, peak: 0.07, filt: { type: 'lowpass', f: 520 * p, q: 1.4 } });
    nz(G, o, { t, a: 0.03, hold: 0.2, d: 0.3, peak: 0.03, type: 'bandpass', f: 800 * p, q: 0.6, buf: G.pink });
    marimba(G, o, mtof(79) * p, t + 0.35, 0.03, 0.4);
    marimba(G, o, mtof(86) * p, t + 0.45, 0.025, 0.4);
    return 0.8;
  },
  // ligado: o "tá-tá-tá" do motor (ronco grave pulsando) e o chiado do escapamento; vem em trechos que se emendam
  genHum(G, o, t, p) {
    const d = 0.95;
    const s = osc(G, 'sawtooth', 50 * p, t, t + d + 0.05);
    const lp = flt(G, 'lowpass', 420 * p, 1.2);
    const am = gn(G, 0.5);
    const lfo = osc(G, 'square', 12.5 * p, t, t + d + 0.05);
    const lfoG = gn(G, 0.5);
    lfo.connect(lfoG);
    lfoG.connect(am.gain);
    const out = gn(G, 0);
    env(out.gain, t, { a: 0.08, hold: d - 0.2, d: 0.12, peak: 0.045 });
    s.connect(lp);
    lp.connect(am);
    am.connect(out);
    out.connect(o);
    nz(G, o, { t, a: 0.08, hold: d - 0.2, d: 0.12, peak: 0.01, type: 'bandpass', f: 900 * p, q: 0.7, buf: G.pink });
    return d + 0.1;
  },
};
export const MIN_GAP_QUINTAL = {
  pickupHat: 0.3, pickupRibbon: 0.3, pickupCandle: 0.3, waterGush: 0.5, waterStart: 0.4, waterStop: 0.4, waterFull: 0.6,
  boatDock: 0.4, pulleyCreak: 0.32, bucketClank: 0.25, deckThump: 0.15, ropeCreak: 0.25, pigeonPeck: 0.5, cakePlace: 0.3,
  cakeWrong: 0.4, cakeFall: 0.2, partyHorn: 1, shedOpen: 0.5, shedClose: 0.5, paintingChime: 0.8, itemDrop: 0.15,
  cluck: 0.5, chickenAlarm: 0.6, wingFlap: 0.4, crateClick: 0.2, pinataThump: 0.2, pluck: 0.2,
  genPull: 0.4, genCrank: 0.8, genStart: 0.6, genHum: 0.5,
};
export const PITCH_VAR_QUINTAL = {
  pickupHat: 0.02, pickupRibbon: 0.02, pickupCandle: 0.02, waterGush: 0.05, waterStart: 0.03, waterStop: 0.03, waterFull: 0.01,
  boatDock: 0.04, pulleyCreak: 0.06, bucketClank: 0.04, deckThump: 0.06, ropeCreak: 0.05, pigeonPeck: 0.05, cakePlace: 0.01,
  cakeWrong: 0.03, cakeFall: 0.05, partyHorn: 0.01, shedOpen: 0.03, shedClose: 0.03, paintingChime: 0.01, itemDrop: 0.05,
  cluck: 0.08, chickenAlarm: 0.06, wingFlap: 0.06, crateClick: 0.03, pinataThump: 0.06, pluck: 0.06,
  genPull: 0.04, genCrank: 0.03, genStart: 0.02, genHum: 0.01,
};
export const VERB_QUINTAL = {
  pickupHat: 0.15, pickupRibbon: 0.15, pickupCandle: 0.15, waterGush: 0.06, waterStart: 0.06, waterStop: 0.05, waterFull: 0.18,
  boatDock: 0.08, pulleyCreak: 0.08, bucketClank: 0.12, deckThump: 0.06, ropeCreak: 0.05, pigeonPeck: 0.06, cakePlace: 0.2,
  cakeWrong: 0.1, cakeFall: 0.05, partyHorn: 0.22, shedOpen: 0.1, shedClose: 0.1, paintingChime: 0.25, itemDrop: 0.05,
  cluck: 0.05, chickenAlarm: 0.05, wingFlap: 0.04, crateClick: 0.08, pinataThump: 0.05, pluck: 0.04,
  genPull: 0.05, genCrank: 0.06, genStart: 0.08, genHum: 0.03,
};
