// Sons do Modo História (capítulo 1, Cadê a Cenoura?): a cenoura de borracha que faz "fiu", o ronco e o radinho do
// porteiro, os pombos (arrulho e asas), o varal e o pregador, o pulso do Faro, o plim da pista e do mural, a meia, a
// botina, o trinco, a janela, os passarinhos da manhã, o balde e a bola. Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o HUD da história toca nos eventos story:sfx (src/story/ui/storyHud.js).
// Nada de voz humana (o "uá-uá" fica para depois): só o ronco e o rádio.
import { mtof, nz, tone, squeak, flaps, boing, marimba, rnd } from './synth.js';

export const SOUNDS_HISTORIA = {
  // a cenoura de borracha apertada: um "fiu" comprido que sobe e volta
  fiu(G, o, t, p) {
    squeak(G, o, t, p, 980, 1650, 1240, 0.34, 0.2);
    return 0.42;
  },
  // o porteiro roncando (fora de vista): o ar entra rouco e sai num assobio
  ronco(G, o, t, p) {
    nz(G, o, { t, a: 0.55, d: 0.35, peak: 0.16, type: 'bandpass', f: 220 * p, to: 330 * p, toT: 0.8, q: 2.2, buf: G.pink });
    tone(G, o, { type: 'sawtooth', f: 72 * p, to: 84 * p, t, a: 0.5, d: 0.4, peak: 0.05, filt: { type: 'lowpass', f: 420, q: 1.6 } });
    tone(G, o, { type: 'sine', f: 760 * p, to: 520 * p, t: t + 1.0, a: 0.15, d: 0.35, peak: 0.03 });
    return 1.6;
  },
  // ele acorda: o ronco corta num ronquinho e no "clique" do rádio desligando
  'ronco-fim'(G, o, t, p) {
    nz(G, o, { t, a: 0.05, d: 0.18, peak: 0.16, type: 'bandpass', f: 260 * p, q: 2, buf: G.pink });
    nz(G, o, { t: t + 0.32, a: 0.001, d: 0.03, peak: 0.12, type: 'bandpass', f: 2200, q: 3 });
    return 0.5;
  },
  // o radinho da guarita: uma musiquinha fina e chiada, de longe
  radinho(G, o, t, p) {
    nz(G, o, { t, a: 0.08, hold: 1.1, d: 0.3, peak: 0.022, type: 'bandpass', f: 2600, q: 0.6 });
    const notes = [76, 79, 81, 79, 76, 74, 76];
    notes.forEach((m, i) => tone(G, o, { type: 'square', f: mtof(m) * p, t: t + i * 0.17, a: 0.01, d: 0.13, peak: 0.022, filt: { type: 'bandpass', f: 1500, q: 1.2 } }));
    return 1.5;
  },
  // pombos arrulhando: "rrrú-rú" grave com tremolo
  arrulho(G, o, t, p) {
    for (let i = 0; i < 2; i++) {
      const tt = t + i * 0.42;
      tone(G, o, { type: 'sine', f: 330 * p, to: 260 * p, t: tt, a: 0.05, d: 0.3, peak: 0.08 });
      tone(G, o, { type: 'triangle', f: 660 * p, to: 520 * p, t: tt, a: 0.05, d: 0.24, peak: 0.025 });
      nz(G, o, { t: tt, a: 0.04, d: 0.22, peak: 0.03, type: 'bandpass', f: 420, q: 3, buf: G.pink });
    }
    return 0.9;
  },
  // asas batendo (pombos subindo)
  asas(G, o, t, p, opts = {}) {
    return flaps(G, o, t, 7, 13 * p, 0.12 * (opts.volume ?? 1));
  },
  // o varal sacudindo: a corda vibra e as roupas batem
  varal(G, o, t, p) {
    tone(G, o, { type: 'triangle', f: 140 * p, to: 110 * p, t, a: 0.01, d: 0.5, peak: 0.08 });
    for (let i = 0; i < 4; i++) nz(G, o, { t: t + i * 0.09, a: 0.01, d: 0.08, peak: 0.06, type: 'bandpass', f: rnd(500, 900), q: 1, buf: G.pink });
    return 0.6;
  },
  // o pregador abrindo: "tlec" e um boing da mola
  pregador(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.03, peak: 0.2, type: 'bandpass', f: 2600 * p, q: 3 });
    boing(G, o, t + 0.02, p, 520, 0.08, 0.25);
    return 0.35;
  },
  // o pulso do Faro: uma fungada e a onda abrindo, com um brilho de sininhos
  faro(G, o, t, p) {
    for (let i = 0; i < 3; i++) nz(G, o, { t: t + i * 0.09, a: 0.015, d: 0.06, peak: 0.08, type: 'bandpass', f: 1800 * p, q: 1.4 });
    nz(G, o, { t: t + 0.25, a: 0.25, d: 0.6, peak: 0.07, type: 'bandpass', f: 600 * p, to: 2400 * p, toT: 0.7, q: 0.8, buf: G.pink });
    [84, 88, 91, 96].forEach((m, i) => marimba(G, o, mtof(m) * p, t + 0.32 + i * 0.07, 0.045, 0.7));
    return 1.2;
  },
  // uma pista nova na lupa: plim-plim de caixinha de música
  pista(G, o, t, p) {
    marimba(G, o, mtof(88) * p, t, 0.08, 0.6);
    marimba(G, o, mtof(93) * p, t + 0.11, 0.08, 0.8);
    tone(G, o, { type: 'sine', f: mtof(100) * p, t: t + 0.11, a: 0.002, d: 0.5, peak: 0.02 });
    return 0.9;
  },
  // mural: o cartão pregado no lugar certo
  pino(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.04, peak: 0.12, type: 'bandpass', f: 1400 * p, q: 2 });
    marimba(G, o, mtof(84) * p, t + 0.03, 0.07, 0.5);
    return 0.5;
  },
  // mural: a ligação errada (o cartão volta)
  erro(G, o, t, p) {
    tone(G, o, { type: 'triangle', f: 330 * p, to: 220 * p, t, a: 0.01, d: 0.22, peak: 0.08 });
    boing(G, o, t + 0.05, p, 180, 0.06, 0.3);
    return 0.4;
  },
  // a meia perdida achada
  meia(G, o, t, p) {
    marimba(G, o, mtof(79) * p, t, 0.07, 0.4);
    marimba(G, o, mtof(84) * p, t + 0.08, 0.07, 0.4);
    marimba(G, o, mtof(88) * p, t + 0.16, 0.08, 0.6);
    return 0.8;
  },
  // a botina do porteiro no chão
  botina(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 95 * p, to: 60 * p, t, a: 0.003, d: 0.12, peak: 0.16 });
    nz(G, o, { t, a: 0.002, d: 0.06, peak: 0.06, type: 'lowpass', f: 700, q: 0.7, buf: G.pink });
    return 0.2;
  },
  // o trinco do portãozinho
  trinco(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.035, peak: 0.18, type: 'bandpass', f: 1900 * p, q: 3 });
    nz(G, o, { t: t + 0.09, a: 0.001, d: 0.05, peak: 0.14, type: 'bandpass', f: 1300 * p, q: 3 });
    return 0.25;
  },
  // o portãozinho de ferro abrindo (rangido curto)
  portao(G, o, t, p) {
    tone(G, o, { type: 'sawtooth', f: 520 * p, to: 760 * p, t, a: 0.05, hold: 0.4, d: 0.3, peak: 0.035, filt: { type: 'bandpass', f: 1200, q: 4 } });
    return 0.8;
  },
  // o basculante fechando (a mão da tutora)
  janela(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.06, peak: 0.14, type: 'bandpass', f: 1500 * p, q: 2 });
    tone(G, o, { type: 'sine', f: 240 * p, to: 180 * p, t: t + 0.02, a: 0.002, d: 0.1, peak: 0.06 });
    return 0.25;
  },
  // passarinhos da manhã (de leve)
  passarinhos(G, o, t, p, opts = {}) {
    const v = opts.volume ?? 1;
    for (let i = 0; i < 5; i++) {
      const tt = t + i * 0.22 + rnd(0, 0.06);
      const f = rnd(2600, 3600) * p;
      tone(G, o, { type: 'sine', f, to: f * 1.35, t: tt, a: 0.005, d: 0.07, peak: 0.03 * v });
    }
    return 1.4;
  },
  // a Rhaenyra sacudindo as patas molhadas
  sacudir(G, o, t, p) {
    for (let i = 0; i < 8; i++) nz(G, o, { t: t + i * 0.06, a: 0.004, d: 0.05, peak: 0.05, type: 'bandpass', f: rnd(1800, 3000) * p, q: 1.2 });
    return 0.6;
  },
  // a porta travada sacudindo
  trancado(G, o, t, p) {
    for (let i = 0; i < 3; i++) nz(G, o, { t: t + i * 0.08, a: 0.002, d: 0.05, peak: 0.12, type: 'bandpass', f: 700 * p, q: 2.5, buf: G.pink });
    return 0.35;
  },
  // a lixeira de rodinhas chacoalhando
  lixeira(G, o, t, p) {
    nz(G, o, { t, a: 0.01, d: 0.18, peak: 0.07, type: 'bandpass', f: 480 * p, q: 1.6, buf: G.pink });
    tone(G, o, { type: 'triangle', f: 210 * p, to: 180 * p, t, a: 0.004, d: 0.12, peak: 0.04 });
    return 0.3;
  },
  // pulinho macio (subindo pelo toldo)
  pulinho(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 180 * p, to: 120 * p, t, a: 0.003, d: 0.08, peak: 0.07 });
    return 0.12;
  },
  // a corda esticando e o balde virando
  corda(G, o, t, p) {
    tone(G, o, { type: 'triangle', f: 160 * p, to: 230 * p, t, a: 0.02, d: 0.2, peak: 0.05 });
    return 0.3;
  },
  // o balde de metal batendo no chão
  balde(G, o, t, p) {
    [523, 787, 1290].forEach((f, i) => tone(G, o, { type: 'sine', f: f * p, t, a: 0.002, d: 0.6 - i * 0.12, peak: 0.07 - i * 0.015 }));
    nz(G, o, { t, a: 0.001, d: 0.08, peak: 0.12, type: 'bandpass', f: 2200 * p, q: 1.5 });
    return 0.7;
  },
  // a bola quicando e rolando
  bola(G, o, t, p) {
    for (let i = 0; i < 3; i++) tone(G, o, { type: 'sine', f: 140 * p, to: 90 * p, t: t + i * (0.22 - i * 0.05), a: 0.002, d: 0.08, peak: 0.1 / (i + 1) });
    return 0.6;
  },
  // o interfone da torre: o bip de cada botão
  bip(G, o, t, p) {
    tone(G, o, { type: 'square', f: 1320 * p, t, a: 0.002, hold: 0.05, d: 0.05, peak: 0.035, filt: { type: 'lowpass', f: 3200, q: 0.7 } });
    return 0.14;
  },
  // a senha certa: a porta destrava (dois tons que sobem e o estalo do trinco elétrico)
  'interfone-ok'(G, o, t, p) {
    tone(G, o, { type: 'square', f: 880 * p, t, a: 0.002, hold: 0.09, d: 0.05, peak: 0.03, filt: { type: 'lowpass', f: 3000, q: 0.7 } });
    tone(G, o, { type: 'square', f: 1320 * p, t: t + 0.13, a: 0.002, hold: 0.16, d: 0.08, peak: 0.03, filt: { type: 'lowpass', f: 3000, q: 0.7 } });
    nz(G, o, { t: t + 0.36, a: 0.001, d: 0.05, peak: 0.14, type: 'bandpass', f: 1500 * p, q: 3 });
    return 0.5;
  },
  // a senha errada: um zumbido grave e curto
  'interfone-erro'(G, o, t, p) {
    tone(G, o, { type: 'sawtooth', f: 150 * p, t, a: 0.004, hold: 0.26, d: 0.08, peak: 0.05, filt: { type: 'lowpass', f: 900, q: 0.8 } });
    return 0.4;
  },
  // o porteiro espirra lá dentro (o cheiro chegou): o ar puxado e o "tchim" abafado
  espirro(G, o, t, p) {
    nz(G, o, { t, a: 0.22, d: 0.08, peak: 0.07, type: 'bandpass', f: 700 * p, to: 1500 * p, toT: 0.25, q: 1.6, buf: G.pink });
    nz(G, o, { t: t + 0.34, a: 0.004, d: 0.22, peak: 0.2, type: 'bandpass', f: 2100 * p, to: 900 * p, toT: 0.2, q: 1.1 });
    tone(G, o, { type: 'sine', f: 240 * p, to: 130 * p, t: t + 0.34, a: 0.004, d: 0.16, peak: 0.08 });
    return 0.7;
  },
  // rajada do vento sul (o terraço)
  vento(G, o, t, p) {
    nz(G, o, { t, a: 0.35, hold: 0.6, d: 0.8, peak: 0.07, type: 'bandpass', f: 380 * p, to: 760 * p, toT: 1.2, q: 0.6, buf: G.pink });
    return 1.8;
  },
};

export const MIN_GAP_HISTORIA = { ronco: 1.2, radinho: 1.2, arrulho: 0.4, asas: 0.15, faro: 0.6, pista: 0.12, botina: 0.12, passarinhos: 1, bip: 0.08, espirro: 1 };
export const PITCH_VAR_HISTORIA = { fiu: 0.04, arrulho: 0.06, asas: 0.05, pista: 0, pino: 0.02, botina: 0.05, pulinho: 0.06, bola: 0.05 };
export const VERB_HISTORIA = { fiu: 0.12, ronco: 0.08, radinho: 0.06, arrulho: 0.12, faro: 0.3, pista: 0.25, meia: 0.2, portao: 0.15, balde: 0.25, vento: 0.2 };
