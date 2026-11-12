// Sons do Modo História (capítulo 1, Cadê a Cenoura?): a cenoura de borracha que faz "fiu", o ronco e o radinho do
// porteiro, os pombos (arrulho e asas), o varal e o pregador, o pulso e o modo do Faro (liga, desliga, a fungada e a
// dog cansada sem fôlego), o plim da pista e do mural, a meia, a
// botina, o trinco, a janela, os passarinhos da manhã, o balde e a bola. Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o HUD da história toca nos eventos story:sfx (src/story/ui/storyHud.js).
// Nada de voz humana de verdade: as falas têm "vozes" de sílabas sintetizadas (voz-*, tocadas pela máquina de escrever
// das legendas e da HQ, src/story/ui/subtitles.js): a Radhija aguda e rápida, a Rhaenyra grave e boba, os pombos
// "pru" arrulhados e o porteiro "uá-uá" de trombone abafado. opts.mood: 'grito' (mais aberto), 'sussurro' (só sopro),
// 'sono' (arrastado e caindo).
// O quadro de dedução (src/story/ui/board.js) usa quadro-abre/quadro-fecha/deduz-certo/rabisco/pergunta/neuronio.
import { mtof, nz, tone, squeak, flaps, boing, marimba, rnd, pick, osc, gn, flt, env } from './synth.js';

/** Vogais (formantes F1/F2, Hz): a, é, i, ó, u. */
const VOWELS = [[780, 1250], [520, 1850], [330, 2250], [520, 950], [360, 780]];

/**
 * Uma sílaba "falada": dente-de-serra com o tom subindo e caindo, por dois formantes de vogal, e um estalinho de
 * consoante no começo. No sussurro, o sopro passa pelos formantes no lugar do tom.
 * @returns {number} a duração (s)
 */
function syl(G, o, t, p, { f0, d, peak, vowel, bright = 1, vib = 0, fall = 0.9, mood = 'normal', cons = 3200 }) {
  if (mood === 'grito') { bright *= 1.18; d *= 1.15; peak *= 1.1; }
  if (mood === 'sono') { d *= 1.45; fall *= 0.88; bright *= 0.85; }
  const [F1, F2] = vowel;
  if (mood === 'sussurro') {
    nz(G, o, { t, a: 0.01, hold: d * 0.3, d: d * 0.7, peak: peak * 0.5, type: 'bandpass', f: F2 * bright * p, q: 4 });
    nz(G, o, { t, a: 0.01, hold: d * 0.3, d: d * 0.7, peak: peak * 0.35, type: 'bandpass', f: F1 * bright * p, q: 3, buf: G.pink });
    return d + 0.05;
  }
  const end = t + d + 0.06;
  const s = osc(G, 'sawtooth', f0 * 1.04 * p, t, end);
  s.frequency.linearRampToValueAtTime(f0 * 1.12 * p, t + d * 0.3);
  s.frequency.exponentialRampToValueAtTime(f0 * fall * p, t + d);
  if (vib) {
    const l = osc(G, 'sine', 7, t, end);
    const lg = gn(G, f0 * vib * p);
    l.connect(lg); lg.connect(s.frequency);
  }
  const amp = gn(G, 0);
  env(amp.gain, t, { a: 0.008, hold: d * 0.35, d: d * 0.65, peak });
  const b1 = flt(G, 'bandpass', F1 * bright, 5);
  const b2 = flt(G, 'bandpass', F2 * bright, 8);
  const g1 = gn(G, 1);
  const g2 = gn(G, 0.5);
  s.connect(b1); b1.connect(g1); g1.connect(amp);
  s.connect(b2); b2.connect(g2); g2.connect(amp);
  const lp = flt(G, 'lowpass', 4200, 0.5);
  amp.connect(lp); lp.connect(o);
  nz(G, o, { t, a: 0.002, d: 0.018, peak: peak * 0.12, type: 'bandpass', f: cons, q: 1.5 });
  return d + 0.06;
}

export const SOUNDS_HISTORIA = {
  // ---------------------------------------------------------------------------------------- as vozes das falas
  // a Radhija: aguda, rápida, cheia de vogal aberta (latidinho falado)
  'voz-radhija'(G, o, t, p, opts = {}) {
    return syl(G, o, t, p, { f0: rnd(560, 690), d: rnd(0.06, 0.08), peak: 0.22, vowel: pick(VOWELS), bright: 1.25, mood: opts.mood });
  },
  // a Rhaenyra: mais grave, mais lenta e boba (vogais redondas e um balanço no tom)
  'voz-rhaenyra'(G, o, t, p, opts = {}) {
    return syl(G, o, t, p, { f0: rnd(290, 350), d: rnd(0.1, 0.13), peak: 0.24, vowel: pick([VOWELS[0], VOWELS[3], VOWELS[4], VOWELS[3]]), bright: 0.92, vib: 0.05, fall: 0.8, mood: opts.mood, cons: 1800 });
  },
  // os pombos: "pru" arrulhado (um tom redondo que rola e cai, com o "p" estalado na frente)
  'voz-pombo'(G, o, t, p, opts = {}) {
    const m = opts.mood;
    const d = m === 'sono' ? 0.18 : m === 'grito' ? 0.14 : 0.12;
    const pk = m === 'sussurro' ? 0.03 : 0.075;
    const end = t + d + 0.06;
    const f = rnd(320, 370) * p;
    const s = osc(G, 'sine', f, t, end);
    s.frequency.exponentialRampToValueAtTime(f * 0.8, t + d);
    const ov = osc(G, 'triangle', f * 2, t, end);
    ov.frequency.exponentialRampToValueAtTime(f * 1.6, t + d);
    const og = gn(G, 0.18);
    ov.connect(og);
    const amp = gn(G, 0);
    env(amp.gain, t, { a: 0.012, hold: d * 0.4, d: d * 0.6, peak: pk });
    // o "rrr": o volume rola a ~26 Hz
    const roll = osc(G, 'sine', 26, t, end);
    const rg = gn(G, 0.45);
    const body = gn(G, 0.6);
    roll.connect(rg); rg.connect(body.gain);
    s.connect(body); og.connect(body); body.connect(amp); amp.connect(o);
    nz(G, o, { t, a: 0.001, d: 0.014, peak: pk * 0.5, type: 'lowpass', f: 900, q: 0.7, buf: G.pink });
    return d + 0.06;
  },
  // o porteiro: "uá" de trombone com surdina (o filtro abre e fecha), grave e abafado
  'voz-porteiro'(G, o, t, p, opts = {}) {
    const m = opts.mood;
    const d = m === 'sono' ? 0.26 : 0.17;
    const pk = m === 'sussurro' ? 0.04 : m === 'grito' ? 0.14 : 0.1;
    const end = t + d + 0.06;
    const f0 = rnd(140, 172) * p;
    const s = osc(G, 'sawtooth', f0 * 0.96, t, end);
    s.frequency.linearRampToValueAtTime(f0 * 1.04, t + d * 0.4);
    s.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + d);
    const sub = osc(G, 'square', f0 * 0.5, t, end);
    const sg = gn(G, 0.12);
    sub.connect(sg);
    const wah = flt(G, 'lowpass', 320, 7);
    wah.frequency.setValueAtTime(320, t);
    wah.frequency.linearRampToValueAtTime(m === 'grito' ? 1900 : 1400, t + d * 0.4);
    wah.frequency.exponentialRampToValueAtTime(520, t + d);
    const amp = gn(G, 0);
    env(amp.gain, t, { a: 0.02, hold: d * 0.4, d: d * 0.6, peak: pk });
    s.connect(wah); sg.connect(wah); wah.connect(amp); amp.connect(o);
    return d + 0.06;
  },
  // ---------------------------------------------------------------------------------------- o quadro de dedução
  // o quadro abre: um sopro que sobe e um brilho de sininhos graves
  'quadro-abre'(G, o, t, p) {
    nz(G, o, { t, a: 0.18, d: 0.35, peak: 0.05, type: 'bandpass', f: 400 * p, to: 1800 * p, toT: 0.45, q: 0.9, buf: G.pink });
    [64, 71, 76].forEach((m, i) => marimba(G, o, mtof(m) * p, t + 0.12 + i * 0.07, 0.035, 0.9));
    return 1.1;
  },
  // o quadro fecha: o sopro descendo
  'quadro-fecha'(G, o, t, p) {
    nz(G, o, { t, a: 0.04, d: 0.3, peak: 0.045, type: 'bandpass', f: 1600 * p, to: 380 * p, toT: 0.3, q: 0.9, buf: G.pink });
    return 0.45;
  },
  // uma ligação acende (a pista nova no quadro): um fio de luz faiscando
  neuronio(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 1900 * p, to: 2900 * p, t, a: 0.004, d: 0.18, peak: 0.025 });
    nz(G, o, { t, a: 0.003, d: 0.12, peak: 0.025, type: 'bandpass', f: 5200, q: 2 });
    return 0.3;
  },
  // a dedução certa: o acorde que abre (como uma ideia batendo) e o brilho dourado
  'deduz-certo'(G, o, t, p) {
    [60, 64, 67, 72].forEach((m, i) => marimba(G, o, mtof(m) * p, t + i * 0.06, 0.06, 1.1));
    tone(G, o, { type: 'triangle', f: mtof(84) * p, t: t + 0.26, a: 0.01, d: 0.9, peak: 0.025, vib: 6, vibRate: 5 });
    nz(G, o, { t: t + 0.24, a: 0.05, d: 0.6, peak: 0.03, type: 'highpass', f: 6000, q: 0.7 });
    return 1.4;
  },
  // a pista sendo anotada: o lápis riscando o papel
  rabisco(G, o, t, p) {
    for (let i = 0; i < 5; i++) nz(G, o, { t: t + i * 0.07 + rnd(0, 0.02), a: 0.01, d: 0.05, peak: 0.035, type: 'bandpass', f: rnd(2600, 4200) * p, q: 2.5 });
    return 0.5;
  },
  // uma pergunta nova: duas notas em suspense
  pergunta(G, o, t, p) {
    marimba(G, o, mtof(69) * p, t, 0.05, 0.8);
    marimba(G, o, mtof(75) * p, t + 0.18, 0.05, 1.0);
    tone(G, o, { type: 'sine', f: mtof(57) * p, t, a: 0.08, d: 0.9, peak: 0.03 });
    return 1.2;
  },
  // ---------------------------------------------------------------------------------------- o cenário

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
  // o modo Faro liga (src/story/faro/faroMode.js): três fungadas fundas puxando o ar e um brilho que sobe (a visão de
  // cheiro abrindo)
  'faro-liga'(G, o, t, p) {
    for (let i = 0; i < 3; i++) nz(G, o, { t: t + i * 0.1, a: 0.02, d: 0.07, peak: 0.075, type: 'bandpass', f: (1500 + i * 250) * p, q: 1.3 });
    nz(G, o, { t: t + 0.22, a: 0.3, d: 0.45, peak: 0.05, type: 'bandpass', f: 500 * p, to: 2200 * p, toT: 0.65, q: 0.8, buf: G.pink });
    tone(G, o, { type: 'sine', f: mtof(72) * p, to: mtof(84) * p, glideT: 0.45, t: t + 0.25, a: 0.12, d: 0.5, peak: 0.028 });
    [79, 84, 88].forEach((m, i) => marimba(G, o, mtof(m) * p, t + 0.34 + i * 0.07, 0.035, 0.6));
    return 1.0;
  },
  // o modo Faro desliga: o ar saindo pelo focinho e o brilho descendo
  'faro-desliga'(G, o, t, p) {
    nz(G, o, { t, a: 0.03, d: 0.28, peak: 0.05, type: 'bandpass', f: 1400 * p, to: 500 * p, toT: 0.3, q: 0.9, buf: G.pink });
    marimba(G, o, mtof(84) * p, t + 0.04, 0.03, 0.4);
    marimba(G, o, mtof(77) * p, t + 0.12, 0.028, 0.5);
    return 0.6;
  },
  // sem fôlego: a fungada falha (duas puxadinhas fracas), o bufo com os beiços tremendo e um "hum" cansado caindo
  'faro-cansado'(G, o, t, p) {
    nz(G, o, { t, a: 0.02, d: 0.05, peak: 0.045, type: 'bandpass', f: 1300 * p, q: 1.2 });
    nz(G, o, { t: t + 0.12, a: 0.02, d: 0.05, peak: 0.035, type: 'bandpass', f: 1150 * p, q: 1.2 });
    const flutter = gn(G, 0.6);
    const lfo = osc(G, 'sine', 24, t + 0.2, t + 0.85);
    const depth = gn(G, 0.4);
    lfo.connect(depth); depth.connect(flutter.gain);
    flutter.connect(o);
    nz(G, flutter, { t: t + 0.22, a: 0.03, hold: 0.12, d: 0.35, peak: 0.09, type: 'lowpass', f: 900 * p, to: 420 * p, toT: 0.5, q: 0.8, buf: G.pink });
    tone(G, o, { type: 'triangle', f: 230 * p, to: 160 * p, t: t + 0.26, a: 0.03, hold: 0.08, d: 0.3, peak: 0.035, filt: { type: 'lowpass', f: 900, q: 0.7 } });
    return 0.9;
  },
  // uma fungada (a cada ~1,25 s com o modo Faro ligado): duas puxadinhas curtas, baixinho
  fungada(G, o, t, p) {
    nz(G, o, { t, a: 0.012, d: 0.045, peak: 0.05, type: 'bandpass', f: 1700 * p, q: 1.5 });
    nz(G, o, { t: t + 0.085, a: 0.012, d: 0.05, peak: 0.045, type: 'bandpass', f: 1900 * p, q: 1.5 });
    return 0.2;
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
  // o trovão do relâmpago (a noite da garoa): o estalo abafado, o estrondo grave e a rolagem que vai sumindo (~2 s)
  trovao(G, o, t, p, opts = {}) {
    const v = opts.volume ?? 1;
    nz(G, o, { t, a: 0.004, d: 0.18, peak: 0.1 * v, type: 'lowpass', f: 1400 * p, to: 300 * p, toT: 0.18, q: 0.7 });
    nz(G, o, { t: t + 0.03, a: 0.06, hold: 0.25, d: 1.7, peak: 0.2 * v, type: 'lowpass', f: 260 * p, to: 70 * p, toT: 1.9, q: 0.9, buf: G.pink });
    tone(G, o, { type: 'sine', f: 52 * p, to: 34 * p, t: t + 0.02, a: 0.05, hold: 0.2, d: 1.2, peak: 0.12 * v });
    // a rolagem: três ondas mais fracas, cada vez mais longe
    for (let i = 0; i < 3; i++) {
      nz(G, o, { t: t + 0.45 + i * 0.42 + rnd(0, 0.08), a: 0.12, d: 0.5, peak: (0.09 - i * 0.022) * v, type: 'lowpass', f: rnd(160, 220) * p, q: 1.1, buf: G.pink });
    }
    return 2.3;
  },
  // rajada do vento sul (o terraço)
  vento(G, o, t, p) {
    nz(G, o, { t, a: 0.35, hold: 0.6, d: 0.8, peak: 0.07, type: 'bandpass', f: 380 * p, to: 760 * p, toT: 1.2, q: 0.6, buf: G.pink });
    return 1.8;
  },
  // ---------------------------------------------------------------------------------------- a casa (casaPuzzles.js)
  // o aspirador robô andando: o motorzinho zumbindo e as escovas raspando
  aspirador(G, o, t, p) {
    tone(G, o, { type: 'sawtooth', f: 118 * p, to: 124 * p, t, a: 0.12, hold: 0.7, d: 0.3, peak: 0.03, filt: { type: 'lowpass', f: 700, q: 1.2 } });
    nz(G, o, { t, a: 0.1, hold: 0.7, d: 0.3, peak: 0.05, type: 'bandpass', f: 2400 * p, q: 1.4 });
    return 1.2;
  },
  // o aspirador apitando (acordou, trombou, levou susto ou chegou na base)
  'aspirador-bip'(G, o, t, p) {
    tone(G, o, { type: 'square', f: 1760 * p, t, a: 0.002, hold: 0.05, d: 0.04, peak: 0.03, filt: { type: 'lowpass', f: 3600, q: 0.7 } });
    tone(G, o, { type: 'square', f: 2350 * p, t: t + 0.12, a: 0.002, hold: 0.05, d: 0.05, peak: 0.03, filt: { type: 'lowpass', f: 3600, q: 0.7 } });
    return 0.25;
  },
  // a goteira na panela da despensa: o "ploc" (no escuro dá medo)
  pingo(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 1400 * p, to: 2300 * p, t, a: 0.002, d: 0.09, peak: 0.07});
    tone(G, o, { type: 'sine', f: 620 * p, to: 480 * p, t: t + 0.01, a: 0.002, d: 0.12, peak: 0.03});
    return 0.2;
  },
  // o interruptor da despensa: o clique da tecla e o zumbidinho da lâmpada acendendo
  interruptor(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.025, peak: 0.16, type: 'bandpass', f: 2600 * p, q: 3 });
    tone(G, o, { type: 'sine', f: 120 * p, t: t + 0.05, a: 0.02, hold: 0.15, d: 0.2, peak: 0.02 });
    return 0.4;
  },
  // a lata de biscoito batendo no chão e correndo (metal fino)
  lata(G, o, t, p) {
    [880, 1320, 2050].forEach((f, i) => tone(G, o, { type: 'sine', f: f * p, t, a: 0.002, d: 0.5 - i * 0.12, peak: 0.06 - i * 0.012 }));
    nz(G, o, { t, a: 0.001, d: 0.06, peak: 0.12, type: 'bandpass', f: 3200 * p, q: 1.5 });
    for (let i = 1; i < 5; i++) nz(G, o, { t: t + 0.2 + i * 0.15, a: 0.002, d: 0.05, peak: 0.04 / i, type: 'bandpass', f: 2600 * p, q: 2 });
    return 1.1;
  },
  // a toalha escorregando pela mesa
  toalha(G, o, t, p) {
    nz(G, o, { t, a: 0.05, hold: 0.15, d: 0.2, peak: 0.06, type: 'bandpass', f: 1800 * p, to: 900 * p, toT: 0.35, q: 0.8, buf: G.pink });
    return 0.45;
  },
  // ---------------------------------------------------------------------------------------- a Rhaenyra distraída
  // (src/story/scene/lesada.js) o focinho na porta fechada: o toc na madeira e o "tóim" de desenho, que vai caindo
  bonk(G, o, t, p) {
    nz(G, o, { t, a: 0.001, d: 0.05, peak: 0.16, type: 'bandpass', f: 900 * p, q: 2.2, buf: G.pink });
    tone(G, o, { type: 'sine', f: 160 * p, to: 95 * p, t, a: 0.002, d: 0.14, peak: 0.12 });
    boing(G, o, t + 0.03, p, 420, 0.05, 0.5);
    return 0.6;
  },
  // a bolha de sabão estourando: um ploc agudo e curtinho
  bolha(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 1500 * p, to: 2600 * p, t, a: 0.001, d: 0.045, peak: 0.07 });
    nz(G, o, { t, a: 0.001, d: 0.025, peak: 0.05, type: 'highpass', f: 3000 * p, q: 0.7 });
    return 0.12;
  },
  // a Radhija bufando (o "aff"): o ar saindo pelo focinho, com um tiquinho de voz no fim
  bufa(G, o, t, p) {
    nz(G, o, { t, a: 0.03, hold: 0.06, d: 0.2, peak: 0.07, type: 'bandpass', f: 1400 * p, to: 700 * p, toT: 0.25, q: 1.2, buf: G.pink });
    tone(G, o, { type: 'triangle', f: 520 * p, to: 380 * p, t: t + 0.05, a: 0.02, d: 0.16, peak: 0.025, filt: { type: 'lowpass', f: 1800, q: 0.7 } });
    return 0.35;
  },
  // o tropeço: as unhas arranhando o chão e o "pof" do peito
  tropeco(G, o, t, p) {
    for (let i = 0; i < 4; i++) nz(G, o, { t: t + i * 0.035, a: 0.002, d: 0.03, peak: 0.05, type: 'bandpass', f: rnd(2400, 3400) * p, q: 2 });
    tone(G, o, { type: 'sine', f: 120 * p, to: 70 * p, t: t + 0.14, a: 0.003, d: 0.1, peak: 0.1 });
    return 0.3;
  },
};

export const MIN_GAP_HISTORIA = {
  ronco: 1.2, radinho: 1.2, arrulho: 0.4, asas: 0.15, faro: 0.6, pista: 0.12, botina: 0.12, passarinhos: 1, bip: 0.08, espirro: 1, trovao: 1.5,
  'faro-liga': 0.3, 'faro-desliga': 0.2, 'faro-cansado': 0.6, fungada: 0.5,
  'voz-radhija': 0.045, 'voz-rhaenyra': 0.07, 'voz-pombo': 0.07, 'voz-porteiro': 0.1, neuronio: 0.06, rabisco: 0.3, 'quadro-abre': 0.3, 'quadro-fecha': 0.3,
  aspirador: 0.8, 'aspirador-bip': 0.2, pingo: 0.4, lata: 0.5, toalha: 0.3,
  bonk: 0.4, bolha: 0.06, bufa: 0.5, tropeco: 0.4,
};
export const PITCH_VAR_HISTORIA = {
  fiu: 0.04, arrulho: 0.06, asas: 0.05, pista: 0, pino: 0.02, botina: 0.05, pulinho: 0.06, bola: 0.05, fungada: 0.08, 'faro-cansado': 0.04,
  'voz-radhija': 0.05, 'voz-rhaenyra': 0.05, 'voz-pombo': 0.05, 'voz-porteiro': 0.04, 'deduz-certo': 0, pergunta: 0,
  bonk: 0.06, bolha: 0.12, bufa: 0.05, tropeco: 0.05,
};
export const VERB_HISTORIA = {
  fiu: 0.12, ronco: 0.08, radinho: 0.06, arrulho: 0.12, faro: 0.3, 'faro-liga': 0.3, 'faro-desliga': 0.2, pista: 0.25, meia: 0.2, portao: 0.15, balde: 0.25, vento: 0.2, trovao: 0.3,
  'voz-radhija': 0.03, 'voz-rhaenyra': 0.03, 'voz-pombo': 0.04, 'voz-porteiro': 0.04, 'quadro-abre': 0.3, 'deduz-certo': 0.35, pergunta: 0.3, neuronio: 0.2,
};
