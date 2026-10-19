// Sons das animações escondidas (src/game/extras.js). Cada som: (G, dest, t, p, opts) → duração (s).
// Entram na biblioteca em ./sounds.js; o feedback toca nos eventos extra:*. Fofos e curtinhos.
import { mtof, nz, tone, fm, marimba, drips, boing, bark } from './synth.js';

export const SOUNDS_EXTRAS = {
  // força: "hmm!" fechadinho, um pouco mais agudo a cada empurrão (opts.n = 0, 1, 2)
  extraStrain(G, o, t, p, opts = {}) {
    const n = opts.n ?? 0;
    const f = (190 + n * 22) * p;
    tone(G, o, { type: 'triangle', f, to: f * 1.08, t, a: 0.05, hold: 0.22, d: 0.12, peak: 0.035, vib: 7, vibRate: 9 });
    nz(G, o, { t, a: 0.05, hold: 0.2, d: 0.1, peak: 0.012, type: 'bandpass', f: 520 * p, q: 6 });
    return 0.45;
  },
  // o cocô saindo: "ploc" de desenho
  extraPlop(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 620 * p, to: 140 * p, t, a: 0.002, d: 0.13, peak: 0.12 });
    nz(G, o, { t: t + 0.01, a: 0.002, d: 0.06, peak: 0.05, type: 'lowpass', f: 700 * p, q: 1 });
    return 0.3;
  },
  // alívio: suspiro "aaah" e um plim de estrelinha
  extraRelief(G, o, t, p) {
    nz(G, o, { t, a: 0.08, hold: 0.25, d: 0.35, peak: 0.045, type: 'bandpass', f: 900 * p, to: 600 * p, toT: 0.6, q: 1.4, buf: G.pink });
    tone(G, o, { type: 'sine', f: 330 * p, to: 250 * p, t, a: 0.08, hold: 0.2, d: 0.3, peak: 0.02 });
    fm(G, o, { f: mtof(88) * p, t: t + 0.32, d: 0.7, peak: 0.05, ratio: 3.5, index: 1.2, idxD: 0.12 });
    marimba(G, o, mtof(95) * p, t + 0.42, 0.04, 0.5);
    return 1.1;
  },
  // patada de cavar: terra raspando
  extraScratch(G, o, t, p) {
    nz(G, o, { t, a: 0.003, d: 0.09, peak: 0.07, type: 'bandpass', f: 1300 * p, to: 700 * p, toT: 0.09, q: 1.2 });
    return 0.15;
  },
  // lambida de água
  extraLap(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 900 * p, to: 1500 * p, t, a: 0.002, d: 0.05, peak: 0.04 });
    drips(G, o, t + 0.02, 1, 0.02, 0.025, 1800 * p, 2600 * p);
    return 0.12;
  },
  // mastigando ração: crec-crec
  extraCrunch(G, o, t, p) {
    for (let i = 0; i < 3; i++) nz(G, o, { t: t + i * 0.035, a: 0.001, d: 0.025, peak: 0.06, type: 'bandpass', f: (2400 + i * 300) * p, q: 2.5 });
    return 0.16;
  },
  // cavando na areia
  extraDig(G, o, t, p) {
    nz(G, o, { t, a: 0.004, d: 0.12, peak: 0.07, type: 'lowpass', f: 1100 * p, to: 600 * p, toT: 0.12, q: 0.8, buf: G.pink });
    return 0.18;
  },
  // farejando: três fungadinhas
  extraSniff(G, o, t, p) {
    for (let i = 0; i < 3; i++) nz(G, o, { t: t + i * 0.13, a: 0.01, d: 0.06, peak: 0.035, type: 'highpass', f: 2200 * p, q: 0.7 });
    return 0.45;
  },
  // espirro fofo: "a-a-tchim!"
  extraSneeze(G, o, t, p) {
    tone(G, o, { type: 'triangle', f: 520 * p, to: 760 * p, t, a: 0.04, d: 0.08, peak: 0.02 });
    nz(G, o, { t: t + 0.12, a: 0.002, d: 0.14, peak: 0.13, type: 'bandpass', f: 3200 * p, to: 1600 * p, toT: 0.14, q: 1.4 });
    tone(G, o, { type: 'square', f: 880 * p, to: 440 * p, t: t + 0.12, a: 0.002, d: 0.08, peak: 0.015 });
    return 0.45;
  },
  // focinhada na bola: "boop" de borracha
  extraBoop(G, o, t, p) {
    boing(G, o, t, p, 520, 0.06, 0.22);
    return 0.3;
  },
  // rolando na roupa: farfalhar
  extraRustle(G, o, t, p) {
    nz(G, o, { t, a: 0.05, hold: 0.12, d: 0.18, peak: 0.05, type: 'bandpass', f: 800 * p, to: 1300 * p, toT: 0.3, q: 0.9, buf: G.pink });
    return 0.4;
  },
  // o segredo: jingle de conquista só dele. Sininhos subindo rápido ("tu-ru-ru-rin!", lá maior), um acorde brilhante
  // que fica no ar, uma chuvinha de sininhos agudos descendo e um calorzinho grave embaixo
  extraSecret(G, o, t, p) {
    const run = [76, 81, 85, 88, 93];
    run.forEach((m, i) => {
      fm(G, o, { f: mtof(m) * p, t: t + i * 0.068, d: 0.34, peak: 0.07, ratio: 3.01, index: 1.4, idxD: 0.08 });
      tone(G, o, { type: 'triangle', f: mtof(m) * p, t: t + i * 0.068, a: 0.003, d: 0.18, peak: 0.035 });
    });
    const t2 = t + run.length * 0.068 + 0.04;
    [81, 85, 88, 93, 97].forEach((m, i) => fm(G, o, { f: mtof(m) * p, t: t2 + i * 0.012, d: 1.15, peak: 0.045, ratio: 2.01, index: 0.9, idxD: 0.3 }));
    [105, 104, 102, 100, 97, 93].forEach((m, i) => fm(G, o, { f: mtof(m) * p, t: t2 + 0.16 + i * 0.07, d: 0.42, peak: 0.018, ratio: 2.01, index: 0.6, idxD: 0.2 }));
    tone(G, o, { type: 'triangle', f: mtof(57) * p, t: t2, a: 0.012, d: 0.95, peak: 0.09, filt: { type: 'lowpass', f: 700, q: 0.7 } });
    tone(G, o, { type: 'sine', f: mtof(64) * p, t: t2 + 0.02, a: 0.02, d: 0.8, peak: 0.04 });
    nz(G, o, { t: t2, a: 0.03, d: 0.9, peak: 0.012, type: 'highpass', f: 7200 * p, q: 0.7 });
    return 2.0;
  },
  // latidinho feliz na reverência ("arf!", mais grave na Rhaenyra)
  extraYip(G, o, t, p, opts = {}) {
    const c = opts.name === 'rhaenyra' ? { f0: 500, f1: 1080, f2: 2450, dur: 0.1, peak: 0.4 } : { f0: 740, f1: 1480, f2: 3100, dur: 0.08, peak: 0.4 };
    return bark(G, o, t, p * 1.1, c);
  },
  // freada dos zoomies: patinhas raspando no chão
  extraSkid(G, o, t, p) {
    nz(G, o, { t, a: 0.01, hold: 0.06, d: 0.16, peak: 0.06, type: 'bandpass', f: 1700 * p, to: 800 * p, toT: 0.22, q: 1.1, buf: G.pink });
    tone(G, o, { type: 'sine', f: 150 * p, to: 90 * p, t, a: 0.005, d: 0.12, peak: 0.05 });
    return 0.3;
  },
  // pousinho dos pulinhos de alegria: tap macio das patinhas
  extraPat(G, o, t, p) {
    nz(G, o, { t, a: 0.002, d: 0.05, peak: 0.05, type: 'lowpass', f: 900 * p, q: 0.8, buf: G.pink });
    tone(G, o, { type: 'sine', f: 210 * p, to: 140 * p, t, a: 0.002, d: 0.06, peak: 0.04 });
    return 0.1;
  },
  // a irmã vendo: "uuu!" subindo e um plim de coraçãozinho
  extraAww(G, o, t, p, opts = {}) {
    const k = opts.name === 'rhaenyra' ? 0.82 : 1;
    tone(G, o, { type: 'triangle', f: 430 * p * k, to: 690 * p * k, glideT: 0.22, t, a: 0.03, hold: 0.08, d: 0.2, peak: 0.045, vib: 6, vibRate: 7, filt: { type: 'lowpass', f: 2600, q: 0.7 } });
    marimba(G, o, mtof(93) * p, t + 0.2, 0.05, 0.45);
    fm(G, o, { f: mtof(100) * p, t: t + 0.26, d: 0.45, peak: 0.02, ratio: 2.01, index: 0.7, idxD: 0.2 });
    return 0.75;
  },
  // corrente do balanço rangendo
  extraCreak(G, o, t, p) {
    nz(G, o, { t, a: 0.03, hold: 0.08, d: 0.12, peak: 0.03, type: 'bandpass', f: 1700 * p, to: 2100 * p, toT: 0.2, q: 9 });
    tone(G, o, { type: 'sine', f: 1100 * p, to: 1250 * p, t, a: 0.03, d: 0.18, peak: 0.008 });
    return 0.3;
  },
};
export const MIN_GAP_EXTRAS = {
  extraStrain: 0.2, extraPlop: 0.2, extraRelief: 0.5, extraScratch: 0.08, extraLap: 0.08, extraCrunch: 0.1, extraDig: 0.1,
  extraSniff: 0.3, extraSneeze: 0.3, extraBoop: 0.2, extraRustle: 0.2, extraCreak: 0.25,
  extraSecret: 1.5, extraYip: 0.2, extraSkid: 0.2, extraPat: 0.08, extraAww: 0.5,
};
export const PITCH_VAR_EXTRAS = {
  extraStrain: 0.02, extraPlop: 0.05, extraRelief: 0.02, extraScratch: 0.08, extraLap: 0.1, extraCrunch: 0.08, extraDig: 0.08,
  extraSniff: 0.06, extraSneeze: 0.04, extraBoop: 0.06, extraRustle: 0.08, extraCreak: 0.06,
  extraSecret: 0, extraYip: 0.05, extraSkid: 0.08, extraPat: 0.1, extraAww: 0.03,
};
export const VERB_EXTRAS = {
  extraStrain: 0.05, extraPlop: 0.08, extraRelief: 0.2, extraScratch: 0.04, extraLap: 0.06, extraCrunch: 0.04, extraDig: 0.04,
  extraSniff: 0.04, extraSneeze: 0.08, extraBoop: 0.1, extraRustle: 0.05, extraCreak: 0.1,
  extraSecret: 0.32, extraYip: 0.08, extraSkid: 0.04, extraPat: 0.03, extraAww: 0.15,
};
