// Áudio 100% sintetizado em WebAudio (sem arquivos). Dono: Agente Polimento.
// API do contrato: createAudio() → { unlock(), setVolume(v), getVolume(), play(name, opts) }
// Extras: stop(name), setMuffled(on), setAmbience('day'|'dusk'|'night'), names, analyze(name, opts).
// Loops por velocidade: play('cartRoll', {speed}) e play('crateDrag', {speed}) — chame a cada quadro; somem sozinhos.
//
// Cadeia: vozes → sfx/amb (→ abafador lowpass da pausa) → compressor → master → saída
//         vozes de UI → compressor (não são abafadas)        reverb curto como envio.

const VOL_KEY = 'operacao-cenoura:volume';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// Intervalo mínimo entre repetições (s) — evita metralhadora de sons.
const MIN_GAP = {
  step: 0.055, dash: 0.12, pushStart: 0.3, bump: 0.15,
  'bark-radhija': 0.2, 'bark-rhaenyra': 0.24, tug: 0.3, latch: 0.2, gateCreak: 0.4,
  reveal: 0.5, pickupCarrot: 0.3, collect: 0.05, switch: 0.12,
  uiClick: 0.04, uiHover: 0.07, pause: 0.15, resume: 0.15, celebrate: 0.6, victory: 1.5,
};
// Variação aleatória de altura (fração) por som.
const PITCH_VAR = {
  step: 0.12, dash: 0.08, bump: 0.08, 'bark-radhija': 0.05, 'bark-rhaenyra': 0.05,
  tug: 0.06, latch: 0.04, gateCreak: 0.05, pickupCarrot: 0.04, collect: 0.0,
  uiClick: 0.03, uiHover: 0.04, switch: 0.02, reveal: 0, celebrate: 0, victory: 0,
};
// Envio para o reverb.
const VERB = {
  step: 0, dash: 0.05, bump: 0.05, 'bark-radhija': 0.12, 'bark-rhaenyra': 0.12, tug: 0.08,
  latch: 0.15, gateCreak: 0.15, reveal: 0.45, pickupCarrot: 0.12, collect: 0.3, switch: 0.15,
  celebrate: 0.3, victory: 0.28, uiClick: 0, uiHover: 0, pause: 0.1, resume: 0.1,
};
const UI_SOUNDS = new Set(['uiClick', 'uiHover', 'pause', 'resume']);
const LOW_PRIORITY = new Set(['step', 'uiHover', 'bump']);

// ---------------------------------------------------------------------------
//  Grafo
// ---------------------------------------------------------------------------
function makeNoise(ctx, seconds, pink = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (!pink) {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else {
    // ruído rosa (Paul Kellet, versão econômica)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  }
  return buf;
}

function makeImpulse(ctx, seconds = 1.6, decay = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45; // um pouco mais escuro
      d[i] = lp * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
    }
  }
  return buf;
}

function buildGraph(ctx, volume, { noComp = false } = {}) {
  const G = { ctx };
  G.master = ctx.createGain();
  G.master.gain.value = volume;
  G.master.connect(ctx.destination);
  if (noComp) {
    G.comp = ctx.createGain();
  } else {
    G.comp = ctx.createDynamicsCompressor();
    G.comp.threshold.value = -16;
    G.comp.knee.value = 12;
    G.comp.ratio.value = 3.5;
    G.comp.attack.value = 0.004;
    G.comp.release.value = 0.22;
  }
  G.comp.connect(G.master);

  G.muffle = ctx.createBiquadFilter();
  G.muffle.type = 'lowpass';
  G.muffle.frequency.value = 20000;
  G.muffle.Q.value = 0.6;
  G.muffle.connect(G.comp);

  G.sfx = ctx.createGain();
  G.sfx.gain.value = 0.95;
  G.sfx.connect(G.muffle);

  G.amb = ctx.createGain();
  G.amb.gain.value = 0;
  G.amb.connect(G.muffle);

  G.ui = ctx.createGain();
  G.ui.gain.value = 0.8;
  G.ui.connect(G.comp);

  G.verbSend = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx);
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.42;
  G.verbSend.connect(conv);
  conv.connect(verbOut);
  verbOut.connect(G.muffle);

  G.noise = makeNoise(ctx, 2);
  G.pink = makeNoise(ctx, 4, true);
  return G;
}

// ---------------------------------------------------------------------------
//  Primitivas
// ---------------------------------------------------------------------------
function env(param, t, { a = 0.005, peak = 1, d = 0.2, hold = 0 }) {
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + a);
  if (hold > 0) param.setValueAtTime(peak, t + a + hold);
  param.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
}
function gn(G, v = 0) {
  const g = G.ctx.createGain();
  g.gain.value = v;
  return g;
}
function flt(G, type, f, q = 1) {
  const b = G.ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}
function osc(G, type, f, t, stop) {
  const o = G.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(stop);
  return o;
}
function noiseSrc(G, t, stop, buf) {
  const s = G.ctx.createBufferSource();
  s.buffer = buf || G.noise;
  s.loop = true;
  s.start(t, Math.random() * (s.buffer.duration - 0.1));
  s.stop(stop);
  return s;
}
// Tom simples com glide, vibrato e filtro opcionais.
function tone(G, dest, o) {
  const { type = 'sine', f, to, glideT, t, a = 0.005, d = 0.2, hold = 0, peak = 0.2, vib = 0, vibRate = 6, filt } = o;
  const end = t + a + hold + d;
  const s = osc(G, type, f, t, end + 0.05);
  if (to) s.frequency.exponentialRampToValueAtTime(to, t + (glideT ?? a + hold + d));
  if (vib) {
    const l = osc(G, 'sine', vibRate, t, end + 0.05);
    const lg = gn(G, vib);
    l.connect(lg);
    lg.connect(s.frequency);
  }
  const g = gn(G, 0);
  env(g.gain, t, { a, peak, d, hold });
  if (filt) {
    const fl = flt(G, filt.type || 'bandpass', filt.f, filt.q ?? 1);
    s.connect(fl);
    fl.connect(g);
  } else s.connect(g);
  g.connect(dest);
  return { s, g, end };
}
// Ruído filtrado com envelope.
function nz(G, dest, o) {
  const { t, d = 0.1, a = 0.002, hold = 0, peak = 0.2, type = 'bandpass', f = 1000, to, toT, q = 1, buf } = o;
  const end = t + a + hold + d;
  const s = noiseSrc(G, t, end + 0.05, buf);
  const fl = flt(G, type, f, q);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + (toT ?? a + hold + d));
  const g = gn(G, 0);
  env(g.gain, t, { a, peak, d, hold });
  s.connect(fl);
  fl.connect(g);
  g.connect(dest);
  return { s, fl, g, end };
}
// Nota FM (sino / marimba).
function fm(G, dest, o) {
  const { f, t, d = 0.6, peak = 0.2, ratio = 3.5, index = 2, idxD = 0.12, a = 0.003 } = o;
  const end = t + a + d;
  const car = osc(G, 'sine', f, t, end + 0.05);
  const mod = osc(G, 'sine', f * ratio, t, end + 0.05);
  const mg = gn(G, 0);
  mg.gain.setValueAtTime(f * index, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * index * 0.02), t + idxD);
  mod.connect(mg);
  mg.connect(car.frequency);
  const g = gn(G, 0);
  env(g.gain, t, { a, peak, d });
  car.connect(g);
  g.connect(dest);
  return end;
}
function marimba(G, dest, f, t, peak, d = 0.55) {
  fm(G, dest, { f, t, d: d * 0.5, peak: peak * 0.7, ratio: 4, index: 1.6, idxD: 0.03, a: 0.002 });
  tone(G, dest, { type: 'sine', f, t, a: 0.003, d, peak: peak * 0.75 });
  tone(G, dest, { type: 'sine', f: f * 2, t, a: 0.002, d: d * 0.35, peak: peak * 0.18 });
}

// ---------------------------------------------------------------------------
//  Latido com formantes (glissando + passa-bandas em paralelo)
// ---------------------------------------------------------------------------
function bark(G, dest, t, p, c) {
  const d = c.dur;
  const end = t + d + 0.06;
  const src = osc(G, 'sawtooth', c.f0 * 0.82 * p, t, end);
  src.frequency.linearRampToValueAtTime(c.f0 * 1.28 * p, t + d * 0.28);
  src.frequency.exponentialRampToValueAtTime(c.f0 * 0.8 * p, t + d);
  const sub = osc(G, 'triangle', c.f0 * 0.82 * p, t, end);
  sub.frequency.linearRampToValueAtTime(c.f0 * 1.28 * p, t + d * 0.28);
  sub.frequency.exponentialRampToValueAtTime(c.f0 * 0.8 * p, t + d);

  const amp = gn(G, 0);
  env(amp.gain, t, { a: 0.008, hold: d * 0.3, d: d * 0.7, peak: c.peak });
  const soft = flt(G, 'lowpass', 5200, 0.5);
  amp.connect(soft);
  soft.connect(dest);

  const F1 = flt(G, 'bandpass', c.f1 * p, 4.5);
  F1.frequency.setValueAtTime(c.f1 * 0.85 * p, t);
  F1.frequency.linearRampToValueAtTime(c.f1 * 1.25 * p, t + d * 0.3);
  F1.frequency.linearRampToValueAtTime(c.f1 * 0.9 * p, t + d);
  const F2 = flt(G, 'bandpass', c.f2 * p, 7);
  const g1 = gn(G, 1.0);
  const g2 = gn(G, 0.55);
  src.connect(F1); F1.connect(g1); g1.connect(amp);
  src.connect(F2); F2.connect(g2); g2.connect(amp);
  const body = flt(G, 'lowpass', c.f0 * 2.2 * p, 0.7);
  const gb = gn(G, 0.22);
  sub.connect(body); body.connect(gb); gb.connect(amp);
  // respiração
  nz(G, dest, { t, a: 0.004, d: d * 0.8, peak: c.peak * 0.05, type: 'bandpass', f: 3600, q: 1.2 });
  return d + 0.1;
}

// ---------------------------------------------------------------------------
//  Squeak de brinquedo de borracha
// ---------------------------------------------------------------------------
function squeak(G, dest, t, p, f1, f2, f3, d, peak) {
  const end = t + d + 0.05;
  const mk = (type) => {
    const s = osc(G, type, f1 * p, t, end);
    s.frequency.exponentialRampToValueAtTime(f2 * p, t + d * 0.38);
    s.frequency.exponentialRampToValueAtTime(f3 * p, t + d);
    return s;
  };
  const tri = mk('triangle');
  const sq = mk('square');
  const lfo = osc(G, 'sine', 31, t, end);
  const lg = gn(G, 26 * p);
  lfo.connect(lg); lg.connect(tri.frequency); lg.connect(sq.frequency);
  const amp = gn(G, 0);
  env(amp.gain, t, { a: 0.012, hold: d * 0.45, d: d * 0.55, peak });
  const sqLp = flt(G, 'lowpass', 3800, 0.8);
  const sqG = gn(G, 0.16);
  tri.connect(amp);
  sq.connect(sqLp); sqLp.connect(sqG); sqG.connect(amp);
  // tremolo de "borracha"
  const trem = osc(G, 'sine', 42, t, end);
  const tg = gn(G, 0.25);
  const ampMod = gn(G, 0.75);
  trem.connect(tg); tg.connect(ampMod.gain);
  amp.connect(ampMod);
  ampMod.connect(dest);
}

// ---------------------------------------------------------------------------
//  Biblioteca de sons: (G, dest, t, p, opts) → duração (s)
// ---------------------------------------------------------------------------
const SOUNDS = {
  step(G, o, t, p, opts) {
    const sp = clamp(opts.speed ?? 2, 0.5, 6);
    const lvl = 0.07 + 0.05 * Math.min(1, sp / 4);
    nz(G, o, { t, a: 0.002, d: 0.045, peak: lvl, type: 'bandpass', f: 2600 * p, q: 0.8 });
    nz(G, o, { t: t + 0.012, a: 0.002, d: 0.03, peak: lvl * 0.6, type: 'bandpass', f: 4200 * p, q: 1.2 });
    nz(G, o, { t, a: 0.003, d: 0.04, peak: lvl * 1.2, type: 'lowpass', f: 380 * p, q: 0.7 });
    return 0.1;
  },
  dash(G, o, t, p) {
    const w = nz(G, o, { t, a: 0.07, d: 0.3, peak: 0.34, type: 'bandpass', f: 420 * p, q: 1.6 });
    w.fl.frequency.cancelScheduledValues(t);
    w.fl.frequency.setValueAtTime(420 * p, t);
    w.fl.frequency.exponentialRampToValueAtTime(1900 * p, t + 0.11);
    w.fl.frequency.exponentialRampToValueAtTime(700 * p, t + 0.37);
    nz(G, o, { t: t + 0.02, a: 0.05, d: 0.18, peak: 0.05, type: 'highpass', f: 4000, q: 0.5 });
    return 0.45;
  },
  pushStart(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 150 * p, to: 68 * p, t, a: 0.005, d: 0.18, peak: 0.32 });
    nz(G, o, { t, a: 0.004, d: 0.12, peak: 0.12, type: 'bandpass', f: 420, q: 1.8 });
    tone(G, o, { type: 'sawtooth', f: 160 * p, to: 230 * p, t: t + 0.06, a: 0.03, d: 0.16, peak: 0.07, filt: { type: 'bandpass', f: 900, q: 5 } });
    return 0.3;
  },
  bump(G, o, t, p, opts) {
    const s = clamp(opts.strength ?? 0.7, 0.2, 1.2);
    tone(G, o, { type: 'sine', f: 190 * p, to: 58 * p, t, a: 0.004, d: 0.17, peak: 0.36 * s });
    nz(G, o, { t, a: 0.002, d: 0.07, peak: 0.13 * s, type: 'lowpass', f: 800, q: 0.7 });
    tone(G, o, { type: 'sine', f: 520 * p, to: 360 * p, t: t + 0.01, a: 0.004, d: 0.09, peak: 0.05 * s });
    return 0.25;
  },
  'bark-radhija'(G, o, t, p, opts) {
    const c = { f0: 650, f1: 1350, f2: 2900, dur: 0.12, peak: 0.68 };
    let d = bark(G, o, t, p, c);
    if (opts.double ?? Math.random() < 0.3) d = 0.17 + bark(G, o, t + 0.17, p * 1.07, { ...c, dur: 0.1, peak: 0.7 });
    return d;
  },
  'bark-rhaenyra'(G, o, t, p, opts) {
    const c = { f0: 450, f1: 980, f2: 2300, dur: 0.17, peak: 0.66 };
    let d = bark(G, o, t, p, c);
    if (opts.double ?? Math.random() < 0.2) d = 0.22 + bark(G, o, t + 0.22, p * 0.96, { ...c, dur: 0.14, peak: 0.7 });
    return d;
  },
  tug(G, o, t, p) {
    const d = 0.46;
    const s = osc(G, 'sawtooth', 52 * p, t, t + d + 0.05);
    s.frequency.linearRampToValueAtTime(118 * p, t + d);
    const bp = flt(G, 'bandpass', 1150 * p, 2.6);
    bp.frequency.linearRampToValueAtTime(1500 * p, t + d);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.06, hold: 0.24, d: 0.16, peak: 0.42 });
    s.connect(bp); bp.connect(g); g.connect(o);
    nz(G, o, { t, a: 0.05, hold: 0.2, d: 0.15, peak: 0.06, type: 'bandpass', f: 2600, q: 1.4 });
    // "toc" da corda chegando ao fim
    tone(G, o, { type: 'sine', f: 240 * p, to: 170 * p, t: t + d - 0.02, a: 0.003, d: 0.1, peak: 0.12 });
    return d + 0.15;
  },
  latch(G, o, t, p) {
    const click = (tt, amp) => {
      nz(G, o, { t: tt, a: 0.0012, d: 0.028, peak: 0.2 * amp, type: 'bandpass', f: 3400, q: 0.9 });
      [2650, 3980, 5270].forEach((f, i) => tone(G, o, { type: 'sine', f: f * p, t: tt, a: 0.0015, d: 0.08 - i * 0.018, peak: 0.055 * amp }));
    };
    click(t, 1);
    click(t + 0.075, 0.75);
    tone(G, o, { type: 'sine', f: 230 * p, to: 140 * p, t: t + 0.075, a: 0.002, d: 0.09, peak: 0.16 });
    return 0.25;
  },
  gateCreak(G, o, t, p) {
    const d = 0.52;
    const s = osc(G, 'sawtooth', 72 * p, t, t + d + 0.05);
    s.frequency.linearRampToValueAtTime(108 * p, t + d * 0.45);
    s.frequency.linearRampToValueAtTime(86 * p, t + d);
    const bp = flt(G, 'bandpass', 900 * p, 6);
    bp.frequency.linearRampToValueAtTime(1300 * p, t + d * 0.45);
    bp.frequency.linearRampToValueAtTime(1080 * p, t + d);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.05, hold: 0.28, d: 0.2, peak: 0.56 });
    s.connect(bp); bp.connect(g); g.connect(o);
    tone(G, o, { type: 'triangle', f: 640 * p, to: 860 * p, glideT: d * 0.5, t, a: 0.06, hold: 0.2, d: 0.24, peak: 0.05, vib: 14, vibRate: 7 });
    return d + 0.1;
  },
  reveal(G, o, t) {
    const notes = [72, 76, 79, 84, 88, 91, 96];
    notes.forEach((m, i) => fm(G, o, { f: mtof(m), t: t + i * 0.065, d: 0.75, peak: 0.09, ratio: 2.01, index: 1.1, idxD: 0.25 }));
    const pad = flt(G, 'lowpass', 600, 0.7);
    pad.frequency.setValueAtTime(600, t);
    pad.frequency.exponentialRampToValueAtTime(3200, t + 0.6);
    pad.connect(o);
    tone(G, pad, { type: 'triangle', f: mtof(72), t, a: 0.25, hold: 0.25, d: 0.8, peak: 0.07 });
    tone(G, pad, { type: 'triangle', f: mtof(79) * 1.003, t, a: 0.25, hold: 0.25, d: 0.8, peak: 0.05 });
    nz(G, o, { t, a: 0.35, d: 0.55, peak: 0.03, type: 'highpass', f: 5000, to: 9000, q: 0.6 });
    return 1.5;
  },
  pickupCarrot(G, o, t, p) {
    squeak(G, o, t, p, 950, 1680, 1420, 0.14, 0.2);
    squeak(G, o, t + 0.17, p, 1520, 1230, 920, 0.16, 0.15);
    return 0.4;
  },
  collect(G, o, t, p, opts) {
    const c = clamp(opts.count ?? 1, 1, 6);
    const pairs = [[79, 86], [81, 88], [84, 91], [86, 93], [88, 96], [91, 98]];
    const [m1, m2] = pairs[c - 1];
    fm(G, o, { f: mtof(m1) * p, t, d: 0.3, peak: 0.15, ratio: 3, index: 1.4, idxD: 0.07 });
    fm(G, o, { f: mtof(m2) * p, t: t + 0.08, d: 0.65, peak: 0.17, ratio: 3, index: 1.4, idxD: 0.09 });
    tone(G, o, { type: 'sine', f: mtof(m2 + 12) * p, t: t + 0.08, a: 0.002, d: 0.35, peak: 0.025 });
    if (opts.total && c >= opts.total) {
      fm(G, o, { f: mtof(m2 + 5) * p, t: t + 0.18, d: 0.7, peak: 0.08, ratio: 3, index: 1.2, idxD: 0.1 });
      fm(G, o, { f: mtof(m2 + 12) * p, t: t + 0.27, d: 0.8, peak: 0.06, ratio: 3, index: 1, idxD: 0.1 });
    }
    return 1.1;
  },
  switch(G, o, t, p, opts) {
    const k = opts.name === 'rhaenyra' ? 0.8 : 1;
    tone(G, o, { type: 'sine', f: 430 * p * k, to: 720 * p * k, glideT: 0.08, t, a: 0.008, d: 0.13, peak: 0.16 });
    tone(G, o, { type: 'triangle', f: 720 * p * k, to: 960 * p * k, glideT: 0.06, t: t + 0.07, a: 0.008, d: 0.16, peak: 0.07 });
    nz(G, o, { t, a: 0.03, d: 0.12, peak: 0.03, type: 'bandpass', f: 1200, to: 2800, q: 1.2 });
    return 0.35;
  },
  uiClick(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 1450 * p, to: 1050 * p, t, a: 0.001, d: 0.05, peak: 0.13 });
    tone(G, o, { type: 'sine', f: 2900 * p, t, a: 0.001, d: 0.02, peak: 0.03 });
    return 0.1;
  },
  uiHover(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 2100 * p, t, a: 0.003, d: 0.045, peak: 0.035 });
    return 0.08;
  },
  pause(G, o, t) {
    tone(G, o, { type: 'triangle', f: mtof(79), t, a: 0.004, d: 0.16, peak: 0.1 });
    tone(G, o, { type: 'triangle', f: mtof(74), t: t + 0.09, a: 0.004, d: 0.28, peak: 0.1 });
    return 0.45;
  },
  resume(G, o, t) {
    tone(G, o, { type: 'triangle', f: mtof(74), t, a: 0.004, d: 0.14, peak: 0.09 });
    tone(G, o, { type: 'triangle', f: mtof(81), t: t + 0.08, a: 0.004, d: 0.24, peak: 0.09 });
    return 0.4;
  },
  celebrate(G, o, t) {
    [72, 76, 79, 84, 88].forEach((m, i) => marimba(G, o, mtof(m), t + i * 0.075, 0.13, 0.5));
    [96, 100, 103].forEach((m, i) => fm(G, o, { f: mtof(m), t: t + 0.4 + i * 0.06, d: 0.5, peak: 0.03, ratio: 2.01, index: 0.8, idxD: 0.2 }));
    return 1.3;
  },
  victory(G, o, t) {
    const mel = [
      [0.0, 72], [0.13, 76], [0.26, 79], [0.39, 84],
      [0.65, 81], [0.78, 79], [0.91, 76], [1.04, 79],
      [1.3, 86], [1.43, 83],
    ];
    mel.forEach(([dt, m]) => marimba(G, o, mtof(m), t + dt, 0.13, 0.5));
    marimba(G, o, mtof(84), t + 1.56, 0.15, 1.2);
    [72, 76, 79].forEach((m) => marimba(G, o, mtof(m), t + 1.56, 0.07, 1.1));
    // baixo suave
    [[0, 48], [0.65, 53], [1.04, 55], [1.56, 48]].forEach(([dt, m], i) =>
      tone(G, o, { type: 'triangle', f: mtof(m), t: t + dt, a: 0.01, d: i === 3 ? 1.2 : 0.5, peak: 0.12, filt: { type: 'lowpass', f: 900, q: 0.7 } }));
    // brilhinho final
    [96, 100, 103, 108].forEach((m, i) => fm(G, o, { f: mtof(m), t: t + 1.7 + i * 0.07, d: 0.7, peak: 0.028, ratio: 2.01, index: 0.8, idxD: 0.25 }));
    return 3.0;
  },
};

// ---------------------------------------------------------------------------
//  v2: sons das fases 2 e 3, companheira, transição e navegação
// ---------------------------------------------------------------------------
// Grasnado cômico: dente-de-serra nasal com formantes, curva "a-HONK".
function honk(G, dest, t, p, { f = 380, d = 0.22, peak = 0.32, bend = 1.18, end = 0.86 } = {}) {
  const stop = t + d + 0.06;
  const mk = (type, mult) => {
    const s = osc(G, type, f * 0.9 * p * mult, t, stop);
    s.frequency.linearRampToValueAtTime(f * bend * p * mult, t + d * 0.25);
    s.frequency.exponentialRampToValueAtTime(f * end * p * mult, t + d);
    return s;
  };
  const saw = mk('sawtooth', 1);
  const sq = mk('square', 1.005);
  const amp = gn(G, 0);
  env(amp.gain, t, { a: 0.012, hold: d * 0.45, d: d * 0.55, peak });
  const F1 = flt(G, 'bandpass', 1050 * p, 3.2);
  const F2 = flt(G, 'bandpass', 2350 * p, 6);
  const F3 = flt(G, 'lowpass', 600 * p, 0.8);
  const g1 = gn(G, 1.0);
  const g2 = gn(G, 0.6);
  const g3 = gn(G, 0.35);
  const sqG = gn(G, 0.4);
  saw.connect(F1); F1.connect(g1); g1.connect(amp);
  saw.connect(F2); F2.connect(g2); g2.connect(amp);
  sq.connect(sqG); sqG.connect(F3); F3.connect(g3); g3.connect(amp);
  // vibrato áspero (garganta)
  const l = osc(G, 'sine', 34, t, stop);
  const lg = gn(G, f * 0.035 * p);
  l.connect(lg); lg.connect(saw.frequency); lg.connect(sq.frequency);
  amp.connect(dest);
  nz(G, dest, { t, a: 0.006, d: d * 0.5, peak: peak * 0.08, type: 'bandpass', f: 2800, q: 1.4 });
  return d + 0.06;
}
// Batidas de asa: rajadas de ruído grave.
function flaps(G, dest, t, n, rate, peak) {
  for (let i = 0; i < n; i++) {
    const tt = t + i / rate + rnd(-0.008, 0.008);
    nz(G, dest, { t: tt, a: 0.01, d: 0.07, peak: peak * rnd(0.75, 1), type: 'bandpass', f: rnd(380, 560), q: 0.9, buf: G.pink });
  }
  return n / rate + 0.1;
}
// Gotinhas: blips senoidais caindo de altura.
function drips(G, dest, t, n, spread, peak, lo = 1400, hi = 3200) {
  for (let i = 0; i < n; i++) {
    const tt = t + Math.random() * spread;
    const f = rnd(lo, hi);
    tone(G, dest, { type: 'sine', f, to: f * 0.55, t: tt, a: 0.002, d: 0.05, peak: peak * rnd(0.5, 1) });
  }
}
function boing(G, dest, t, p, f0, peak, d = 0.38) {
  const end = t + d + 0.05;
  const s = osc(G, 'triangle', f0 * p, t, end);
  s.frequency.exponentialRampToValueAtTime(f0 * 2 * p, t + 0.05);
  s.frequency.exponentialRampToValueAtTime(f0 * 1.25 * p, t + d);
  const l = osc(G, 'sine', 15, t, end);
  const lg = gn(G, 0);
  lg.gain.setValueAtTime(f0 * 0.18 * p, t);
  lg.gain.exponentialRampToValueAtTime(1, t + d);
  l.connect(lg); lg.connect(s.frequency);
  const lp = flt(G, 'lowpass', 2200, 0.7);
  const g = gn(G, 0);
  env(g.gain, t, { a: 0.004, d, peak });
  s.connect(lp); lp.connect(g); g.connect(dest);
}

const SOUNDS2 = {
  // ---------- itens ----------
  pickupBall(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 150 * p, to: 70 * p, t, a: 0.003, d: 0.11, peak: 0.3 });
    boing(G, o, t, p, 250, 0.16, 0.36);
    tone(G, o, { type: 'sine', f: 170 * p, to: 80 * p, t: t + 0.21, a: 0.003, d: 0.09, peak: 0.16 });
    boing(G, o, t + 0.21, p * 1.12, 250, 0.08, 0.28);
    fm(G, o, { f: mtof(88) * p, t: t + 0.08, d: 0.4, peak: 0.04, ratio: 3, index: 1, idxD: 0.08 });
    return 0.6;
  },
  pickupSlipper(G, o, t, p) {
    const f = nz(G, o, { t, a: 0.05, d: 0.2, peak: 0.16, type: 'bandpass', f: 600 * p, to: 1500 * p, toT: 0.12, q: 0.8, buf: G.pink });
    void f;
    tone(G, o, { type: 'sine', f: 300 * p, to: 210 * p, t: t + 0.02, a: 0.02, d: 0.16, peak: 0.12 });
    squeak(G, o, t + 0.12, p, 1100, 1400, 1250, 0.09, 0.06);
    fm(G, o, { f: mtof(91) * p, t: t + 0.16, d: 0.45, peak: 0.035, ratio: 2.01, index: 0.9, idxD: 0.15 });
    return 0.6;
  },
  // ---------- companheira: Fica / Vem ----------
  stay(G, o, t, p, opts) {
    const big = opts.name === 'rhaenyra';
    const c = big ? { f0: 420, f1: 930, f2: 2200, dur: 0.1, peak: 0.42 } : { f0: 610, f1: 1300, f2: 2800, dur: 0.075, peak: 0.42 };
    const d = bark(G, o, t, p * 0.95, c);
    tone(G, o, { type: 'triangle', f: mtof(76) * p, t: t + 0.06, a: 0.004, d: 0.12, peak: 0.05 });
    tone(G, o, { type: 'triangle', f: mtof(72) * p, t: t + 0.13, a: 0.004, d: 0.22, peak: 0.05 });
    return d + 0.3;
  },
  come(G, o, t, p, opts) {
    const big = opts.name === 'rhaenyra';
    const c = big ? { f0: 470, f1: 1000, f2: 2350, dur: 0.09, peak: 0.4 } : { f0: 700, f1: 1400, f2: 3000, dur: 0.07, peak: 0.4 };
    bark(G, o, t, p * 1.06, c);
    tone(G, o, { type: 'triangle', f: mtof(74) * p, t: t + 0.05, a: 0.004, d: 0.1, peak: 0.05 });
    tone(G, o, { type: 'triangle', f: mtof(79) * p, t: t + 0.11, a: 0.004, d: 0.2, peak: 0.055 });
    return 0.4;
  },
  // ---------- placa de pressão ----------
  plateDown(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 120 * p, to: 52 * p, t, a: 0.003, d: 0.16, peak: 0.34 });
    nz(G, o, { t, a: 0.0015, d: 0.03, peak: 0.16, type: 'bandpass', f: 1900 * p, q: 1.2 });
    nz(G, o, { t: t + 0.004, a: 0.002, d: 0.08, peak: 0.1, type: 'lowpass', f: 700, q: 0.8 });
    tone(G, o, { type: 'sawtooth', f: 92 * p, to: 128 * p, t: t + 0.05, a: 0.03, d: 0.18, peak: 0.06, filt: { type: 'bandpass', f: 760, q: 6 } });
    return 0.35;
  },
  plateUp(G, o, t, p) {
    nz(G, o, { t, a: 0.0015, d: 0.025, peak: 0.1, type: 'bandpass', f: 2600 * p, q: 1.4 });
    tone(G, o, { type: 'sine', f: 210 * p, to: 140 * p, t, a: 0.003, d: 0.08, peak: 0.14 });
    tone(G, o, { type: 'sawtooth', f: 128 * p, to: 96 * p, t: t + 0.02, a: 0.02, d: 0.12, peak: 0.04, filt: { type: 'bandpass', f: 820, q: 6 } });
    return 0.2;
  },
  // ---------- portão ----------
  gateClose(G, o, t, p) {
    const d = 0.34;
    const s = osc(G, 'sawtooth', 104 * p, t, t + d + 0.05);
    s.frequency.linearRampToValueAtTime(76 * p, t + d);
    const bp = flt(G, 'bandpass', 1150 * p, 6);
    bp.frequency.linearRampToValueAtTime(880 * p, t + d);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.04, hold: 0.16, d: 0.14, peak: 0.36 });
    s.connect(bp); bp.connect(g); g.connect(o);
    SOUNDS.latch(G, o, t + d - 0.02, p);
    tone(G, o, { type: 'sine', f: 150 * p, to: 70 * p, t: t + d, a: 0.003, d: 0.14, peak: 0.24 });
    return d + 0.3;
  },
  gateLocked(G, o, t, p) {
    const click = (tt, amp, f0) => {
      nz(G, o, { t: tt, a: 0.001, d: 0.03, peak: 0.24 * amp, type: 'bandpass', f: f0, q: 1 });
      [2400, 3650, 5100].forEach((f, i) => tone(G, o, { type: 'sine', f: f * p, t: tt, a: 0.0015, d: 0.12 - i * 0.025, peak: 0.06 * amp }));
    };
    click(t, 1, 3000);
    click(t + 0.06, 0.8, 2400);
    tone(G, o, { type: 'sine', f: 180 * p, to: 62 * p, t: t + 0.06, a: 0.003, d: 0.2, peak: 0.36 });
    nz(G, o, { t: t + 0.06, a: 0.002, d: 0.09, peak: 0.12, type: 'lowpass', f: 900 });
    fm(G, o, { f: mtof(79) * p, t: t + 0.2, d: 0.4, peak: 0.07, ratio: 3, index: 1.2, idxD: 0.08 });
    fm(G, o, { f: mtof(86) * p, t: t + 0.29, d: 0.6, peak: 0.08, ratio: 3, index: 1.2, idxD: 0.08 });
    return 0.9;
  },
  // ---------- calço ----------
  wedgeKick(G, o, t, p, opts) {
    tone(G, o, { type: 'sine', f: 560 * p, to: 390 * p, t, a: 0.002, d: 0.07, peak: 0.22 });
    tone(G, o, { type: 'triangle', f: 1180 * p, to: 900 * p, t, a: 0.001, d: 0.035, peak: 0.07 });
    nz(G, o, { t, a: 0.001, d: 0.04, peak: 0.14, type: 'bandpass', f: 950 * p, q: 1.5 });
    // deslize na pedra
    nz(G, o, { t: t + 0.03, a: 0.03, hold: 0.08, d: 0.12, peak: 0.07, type: 'bandpass', f: 1600, to: 900, q: 1.2 });
    if (opts.locked) {
      tone(G, o, { type: 'sine', f: 440 * p, to: 300 * p, t: t + 0.22, a: 0.002, d: 0.09, peak: 0.24 });
      nz(G, o, { t: t + 0.22, a: 0.001, d: 0.05, peak: 0.12, type: 'bandpass', f: 800, q: 1.4 });
      fm(G, o, { f: mtof(81) * p, t: t + 0.32, d: 0.5, peak: 0.07, ratio: 3, index: 1.2, idxD: 0.08 });
      return 0.9;
    }
    return 0.35;
  },
  // ---------- água ----------
  splash(G, o, t, p) {
    nz(G, o, { t, a: 0.004, d: 0.32, peak: 0.3, type: 'bandpass', f: 2600 * p, to: 700 * p, toT: 0.3, q: 0.9 });
    nz(G, o, { t, a: 0.002, d: 0.12, peak: 0.14, type: 'highpass', f: 4500, q: 0.6 });
    tone(G, o, { type: 'sine', f: 340 * p, to: 120 * p, t, a: 0.004, d: 0.12, peak: 0.16 });
    drips(G, o, t + 0.08, 7, 0.45, 0.05);
    return 0.7;
  },
  shake(G, o, t, p) {
    const d = 0.72;
    const s = noiseSrc(G, t, t + d + 0.05, G.pink);
    const bp = flt(G, 'bandpass', 950 * p, 0.9);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.05, hold: d * 0.5, d: d * 0.45, peak: 0.22 });
    const am = gn(G, 0.5);
    const l = osc(G, 'sine', 15, t, t + d + 0.05);
    l.frequency.linearRampToValueAtTime(10, t + d);
    const lg = gn(G, 0.5);
    l.connect(lg); lg.connect(am.gain);
    s.connect(bp); bp.connect(am); am.connect(g); g.connect(o);
    flaps(G, o, t + 0.05, 6, 11, 0.06);
    drips(G, o, t + 0.1, 10, d, 0.035, 1800, 3800);
    return d + 0.2;
  },
  waterOff(G, o, t, p) {
    const d = 0.9;
    const h = nz(G, o, { t, a: 0.01, hold: 0.1, d, peak: 0.16, type: 'lowpass', f: 7000, to: 500, toT: d, q: 0.6 });
    void h;
    const s = osc(G, 'sine', 210 * p, t + 0.1, t + 0.7);
    s.frequency.exponentialRampToValueAtTime(90 * p, t + 0.65);
    const l = osc(G, 'sine', 19, t + 0.1, t + 0.7);
    const lg = gn(G, 30);
    l.connect(lg); lg.connect(s.frequency);
    const g = gn(G, 0);
    env(g.gain, t + 0.1, { a: 0.03, hold: 0.2, d: 0.3, peak: 0.08 });
    s.connect(g); g.connect(o);
    drips(G, o, t + 0.45, 4, 0.6, 0.05, 1500, 2600);
    fm(G, o, { f: mtof(84) * p, t: t + 0.55, d: 0.6, peak: 0.05, ratio: 2.01, index: 1, idxD: 0.2 });
    fm(G, o, { f: mtof(91) * p, t: t + 0.65, d: 0.7, peak: 0.045, ratio: 2.01, index: 1, idxD: 0.2 });
    return 1.4;
  },
  valve(G, o, t, p) {
    const d = 0.55;
    const s = osc(G, 'sawtooth', 150 * p, t, t + d + 0.05);
    s.frequency.linearRampToValueAtTime(205 * p, t + d * 0.6);
    s.frequency.linearRampToValueAtTime(180 * p, t + d);
    const r = osc(G, 'square', 23, t, t + d + 0.05);
    const rg = gn(G, 18 * p);
    r.connect(rg); rg.connect(s.frequency);
    const bp = flt(G, 'bandpass', 1900 * p, 9);
    const g = gn(G, 0);
    env(g.gain, t, { a: 0.04, hold: d * 0.55, d: d * 0.4, peak: 0.42 });
    s.connect(bp); bp.connect(g); g.connect(o);
    tone(G, o, { type: 'triangle', f: 1250 * p, to: 1500 * p, glideT: d * 0.6, t, a: 0.06, hold: 0.2, d: 0.25, peak: 0.035, vib: 25, vibRate: 9 });
    nz(G, o, { t: t + d - 0.04, a: 0.001, d: 0.04, peak: 0.14, type: 'bandpass', f: 2600, q: 1.3 });
    tone(G, o, { type: 'sine', f: 260 * p, to: 170 * p, t: t + d - 0.03, a: 0.002, d: 0.1, peak: 0.16 });
    return d + 0.2;
  },
  crateSink(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 170 * p, to: 50 * p, t, a: 0.004, d: 0.42, peak: 0.5 });
    nz(G, o, { t, a: 0.004, d: 0.7, peak: 0.36, type: 'bandpass', f: 1900 * p, to: 420 * p, toT: 0.6, q: 0.8 });
    nz(G, o, { t, a: 0.002, d: 0.2, peak: 0.16, type: 'highpass', f: 4200, q: 0.6 });
    for (let i = 0; i < 6; i++) {
      const tt = t + 0.25 + i * rnd(0.07, 0.14);
      const f = rnd(380, 620) * p;
      tone(G, o, { type: 'sine', f, to: f * 1.9, t: tt, a: 0.004, d: 0.06, peak: 0.05 });
    }
    drips(G, o, t + 0.15, 9, 0.7, 0.05);
    [76, 81, 88].forEach((m, i) => fm(G, o, { f: mtof(m) * p, t: t + 0.75 + i * 0.08, d: 0.7, peak: 0.06, ratio: 2.01, index: 1, idxD: 0.2 }));
    return 1.8;
  },
  // ---------- lanternas ----------
  lanternOn(G, o, t, p) {
    fm(G, o, { f: mtof(91) * p, t, d: 1.2, peak: 0.1, ratio: 2.76, index: 0.9, idxD: 0.4 });
    fm(G, o, { f: mtof(98) * p, t: t + 0.05, d: 0.9, peak: 0.05, ratio: 2.76, index: 0.7, idxD: 0.3 });
    tone(G, o, { type: 'sine', f: mtof(103) * p, t: t + 0.09, a: 0.002, d: 0.6, peak: 0.02 });
    tone(G, o, { type: 'sine', f: 220 * p, t, a: 0.12, hold: 0.1, d: 0.6, peak: 0.05, filt: { type: 'lowpass', f: 600, q: 0.7 } });
    for (let i = 0; i < 5; i++) nz(G, o, { t: t + rnd(0, 0.25), a: 0.001, d: 0.012, peak: 0.05, type: 'highpass', f: 3500, q: 0.7 });
    return 1.4;
  },
  lanternOff(G, o, t, p) {
    fm(G, o, { f: mtof(84) * p, t, d: 0.5, peak: 0.06, ratio: 2.76, index: 0.6, idxD: 0.2 });
    fm(G, o, { f: mtof(79) * p, t: t + 0.1, d: 0.6, peak: 0.05, ratio: 2.76, index: 0.5, idxD: 0.2 });
    nz(G, o, { t, a: 0.02, d: 0.25, peak: 0.05, type: 'bandpass', f: 900, to: 400, q: 0.8, buf: G.pink });
    return 0.8;
  },
  // ---------- Dona Gansa ----------
  honk(G, o, t, p) {
    return honk(G, o, t, p, {});
  },
  gooseAlert(G, o, t, p) {
    honk(G, o, t, p, { f: 400, d: 0.12, peak: 0.24, bend: 1.08, end: 1.12 });
    honk(G, o, t + 0.17, p, { f: 430, d: 0.16, peak: 0.28, bend: 1.12, end: 1.25 });
    return 0.45;
  },
  gooseCharge(G, o, t, p) {
    honk(G, o, t, p * 1.04, { f: 410, d: 0.14, peak: 0.3 });
    honk(G, o, t + 0.16, p * 1.08, { f: 420, d: 0.13, peak: 0.3 });
    honk(G, o, t + 0.31, p * 1.12, { f: 440, d: 0.2, peak: 0.34, bend: 1.25 });
    flaps(G, o, t, 9, 13, 0.1);
    return 0.8;
  },
  gooseHit(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 320 * p, to: 110 * p, t, a: 0.002, d: 0.14, peak: 0.34 });
    nz(G, o, { t, a: 0.001, d: 0.06, peak: 0.16, type: 'bandpass', f: 1200, q: 1 });
    honk(G, o, t + 0.05, p * 1.15, { f: 450, d: 0.18, peak: 0.3, bend: 1.3, end: 0.9 });
    flaps(G, o, t + 0.04, 5, 14, 0.09);
    return 0.5;
  },
  gooseLured(G, o, t, p) {
    honk(G, o, t, p * 0.9, { f: 340, d: 0.1, peak: 0.12, bend: 1.0, end: 1.05 });
    honk(G, o, t + 0.14, p * 0.92, { f: 350, d: 0.17, peak: 0.15, bend: 1.06, end: 1.3 });
    return 0.4;
  },
  gooseReturn(G, o, t, p) {
    honk(G, o, t, p * 0.88, { f: 360, d: 0.15, peak: 0.16, bend: 1.06, end: 0.92 });
    honk(G, o, t + 0.2, p * 0.82, { f: 330, d: 0.22, peak: 0.14, bend: 1.02, end: 0.8 });
    return 0.5;
  },
  // ---------- transição e menus ----------
  curtainIn(G, o, t) {
    nz(G, o, { t, a: 0.22, d: 0.2, peak: 0.07, type: 'bandpass', f: 500, to: 1800, toT: 0.36, q: 1.1, buf: G.pink });
    marimba(G, o, mtof(67), t + 0.3, 0.06, 0.6);
    marimba(G, o, mtof(60), t + 0.3, 0.05, 0.7);
    return 1.0;
  },
  curtainOut(G, o, t) {
    nz(G, o, { t, a: 0.12, d: 0.4, peak: 0.06, type: 'bandpass', f: 1800, to: 600, toT: 0.5, q: 1.1, buf: G.pink });
    [72, 76, 79, 84].forEach((m, i) => marimba(G, o, mtof(m), t + 0.08 + i * 0.07, 0.07, 0.5));
    fm(G, o, { f: mtof(96), t: t + 0.4, d: 0.6, peak: 0.02, ratio: 2.01, index: 0.8, idxD: 0.2 });
    return 1.1;
  },
  uiMove(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 1650 * p, t, a: 0.002, d: 0.035, peak: 0.05 });
    return 0.06;
  },
  uiBack(G, o, t, p) {
    tone(G, o, { type: 'sine', f: 1200 * p, to: 820 * p, t, a: 0.002, d: 0.07, peak: 0.1 });
    return 0.1;
  },
  uiDenied(G, o, t, p) {
    tone(G, o, { type: 'triangle', f: 233 * p, t, a: 0.003, d: 0.08, peak: 0.12 });
    tone(G, o, { type: 'triangle', f: 208 * p, t: t + 0.11, a: 0.003, d: 0.12, peak: 0.12 });
    return 0.3;
  },
};
Object.assign(SOUNDS, SOUNDS2);
Object.assign(MIN_GAP, {
  pickupBall: 0.3, pickupSlipper: 0.3, stay: 0.15, come: 0.15, plateDown: 0.15, plateUp: 0.15,
  gateClose: 0.4, gateLocked: 0.5, wedgeKick: 0.2, splash: 0.18, shake: 0.6, waterOff: 0.8, valve: 0.35,
  crateSink: 1.0, lanternOn: 0.2, lanternOff: 0.2, honk: 0.25, gooseAlert: 0.6, gooseCharge: 0.6,
  gooseHit: 0.3, gooseLured: 0.6, gooseReturn: 0.6, curtainIn: 0.5, curtainOut: 0.5, uiMove: 0.03, uiBack: 0.08, uiDenied: 0.2,
});
Object.assign(PITCH_VAR, {
  pickupBall: 0.04, pickupSlipper: 0.04, stay: 0.03, come: 0.03, plateDown: 0.05, plateUp: 0.05, wedgeKick: 0.06,
  splash: 0.08, shake: 0.06, valve: 0.04, honk: 0.06, gooseAlert: 0.04, gooseCharge: 0.03, gooseHit: 0.04,
  curtainIn: 0, curtainOut: 0, uiMove: 0.02, uiDenied: 0, gateLocked: 0, crateSink: 0.03, lanternOn: 0.02,
});
Object.assign(VERB, {
  pickupBall: 0.12, pickupSlipper: 0.15, stay: 0.12, come: 0.12, plateDown: 0.1, plateUp: 0.08, gateClose: 0.15,
  gateLocked: 0.2, wedgeKick: 0.1, splash: 0.2, shake: 0.08, waterOff: 0.3, valve: 0.15, crateSink: 0.3,
  lanternOn: 0.5, lanternOff: 0.35, honk: 0.18, gooseAlert: 0.18, gooseCharge: 0.15, gooseHit: 0.15, gooseLured: 0.18,
  gooseReturn: 0.18, curtainIn: 0.2, curtainOut: 0.25, uiMove: 0, uiBack: 0, uiDenied: 0,
});
['curtainIn', 'curtainOut', 'uiMove', 'uiBack', 'uiDenied'].forEach((n) => UI_SOUNDS.add(n));
LOW_PRIORITY.add('uiMove');

export const SOUND_NAMES = [...Object.keys(SOUNDS), 'cartRoll', 'crateDrag'];

// ---------------------------------------------------------------------------
//  Ambiente por fase: 'day' (passarinhos), 'dusk' (grilos começando + vento),
//  'night' (grilos, sapinhos e sino de vento). Troca suave com setAmbience(kind).
// ---------------------------------------------------------------------------
const AMBIENCE = {
  day: { wind: 0.05, birds: [2600, 7800], crickets: 0, bed: 0, frogs: 0, chime: [26000, 52000], chimeP: 0.45 },
  dusk: { wind: 0.068, birds: [8000, 17000], crickets: 0.4, bed: 0.006, frogs: 0, chime: [20000, 38000], chimeP: 0.4 },
  night: { wind: 0.036, birds: null, crickets: 1, bed: 0.016, frogs: 1, chime: [9000, 19000], chimeP: 0.85 },
};

function startAmbient(G, isAlive) {
  const { ctx } = G;
  const now = ctx.currentTime;
  const cfg = () => AMBIENCE[G.ambience] || AMBIENCE.day;
  G.amb.gain.setValueAtTime(0, now);
  G.amb.gain.linearRampToValueAtTime(0.55, now + 3);

  // vento: ruído rosa → passa-banda com LFOs lentos
  const wind = ctx.createBufferSource();
  wind.buffer = G.pink;
  wind.loop = true;
  const hp = flt(G, 'highpass', 140, 0.5);
  const bp = flt(G, 'bandpass', 480, 0.55);
  const wg = gn(G, cfg().wind);
  const l1 = osc(G, 'sine', 0.071, now, now + 1e6);
  const l1g = gn(G, cfg().wind * 0.56);
  l1.connect(l1g); l1g.connect(wg.gain);
  const l2 = osc(G, 'sine', 0.043, now, now + 1e6);
  const l2g = gn(G, 220);
  l2.connect(l2g); l2g.connect(bp.frequency);
  wind.connect(hp); hp.connect(bp); bp.connect(wg); wg.connect(G.amb);
  wind.start(now);

  // "cama" distante de grilos: ruído estreito em ~4,6 kHz com trinado (AM) e frases lentas
  const bed = ctx.createBufferSource();
  bed.buffer = G.noise;
  bed.loop = true;
  const bbp = flt(G, 'bandpass', 4600, 14);
  const bam = gn(G, 0.5);
  const trill = osc(G, 'square', 29, now, now + 1e6);
  const tg = gn(G, 0.5);
  trill.connect(tg); tg.connect(bam.gain);
  const phrase = gn(G, 0.6);
  const pl = osc(G, 'sine', 0.55, now, now + 1e6);
  const plg = gn(G, 0.4);
  pl.connect(plg); plg.connect(phrase.gain);
  const bedG = gn(G, cfg().bed * 8);
  bed.connect(bbp); bbp.connect(bam); bam.connect(phrase); phrase.connect(bedG); bedG.connect(G.amb);
  bed.start(now);

  G.setAmbience = (kind) => {
    G.ambience = AMBIENCE[kind] ? kind : 'day';
    const c = cfg();
    const t = ctx.currentTime;
    wg.gain.setTargetAtTime(c.wind, t, 1.2);
    l1g.gain.setTargetAtTime(c.wind * 0.56, t, 1.2);
    bedG.gain.setTargetAtTime(c.bed * 8, t, 1.5);
  };

  const birdOut = gn(G, 1);
  const birdLp = flt(G, 'lowpass', 7000, 0.6);
  birdOut.connect(birdLp);
  birdLp.connect(G.amb);
  const birdVerb = gn(G, 0.35);
  birdLp.connect(birdVerb);
  birdVerb.connect(G.verbSend);

  const chirp = (dest, t, f0, f1, d, peak, vibF, vibD) => {
    const s = osc(G, 'sine', f0, t, t + d + 0.03);
    s.frequency.exponentialRampToValueAtTime(f1, t + d);
    if (vibD) {
      const m = osc(G, 'sine', vibF, t, t + d + 0.03);
      const mg = gn(G, vibD);
      m.connect(mg); mg.connect(s.frequency);
    }
    const g = gn(G, 0);
    env(g.gain, t, { a: Math.min(0.012, d * 0.3), peak, d: d * 0.8, hold: d * 0.1 });
    s.connect(g); g.connect(dest);
  };
  const voice = (gain, panRange = 0.85, verb = 0) => {
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-panRange, panRange);
    const g = gn(G, gain);
    g.connect(pan); pan.connect(G.amb);
    let vs = null;
    if (verb) { vs = gn(G, verb); pan.connect(vs); vs.connect(G.verbSend); }
    return { g, free: (ms) => setTimeout(() => { try { g.disconnect(); pan.disconnect(); vs?.disconnect(); } catch (_) {} }, ms) };
  };

  const birdCall = () => {
    const t = ctx.currentTime + 0.05;
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.85, 0.85);
    const dist = gn(G, rnd(0.5, 1) * (G.ambience === 'dusk' ? 0.6 : 1));
    dist.connect(pan); pan.connect(birdOut);
    const base = rnd(0.9, 1.15);
    const sp = (Math.random() * 3) | 0;
    let dur = 1;
    if (sp === 0) {
      const n = 4 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i++) {
        const f = (4300 - i * 160) * base;
        chirp(dist, t + i * 0.075, f, f * 0.78, 0.05, 0.05, 45, 180);
      }
      dur = n * 0.075 + 0.2;
    } else if (sp === 1) {
      chirp(dist, t, 3100 * base, 3900 * base, 0.12, 0.05, 26, 110);
      chirp(dist, t + 0.19, 2700 * base, 2150 * base, 0.18, 0.045, 24, 90);
      dur = 0.5;
    } else {
      const n = 2 + ((Math.random() * 2) | 0);
      for (let i = 0; i < n; i++) chirp(dist, t + i * 0.16, 2500 * base, 4600 * base, 0.035, 0.05, 0, 0);
      dur = n * 0.16 + 0.1;
    }
    setTimeout(() => { try { dist.disconnect(); pan.disconnect(); } catch (_) {} }, (dur + 1.5) * 1000);
  };

  // grilo: frase de 3–4 pulsos de ~4,5 kHz
  const cricket = (amp) => {
    const v = voice(amp, 0.9, 0.15);
    const t = ctx.currentTime + 0.03;
    const f = rnd(4200, 5000);
    const reps = 1 + ((Math.random() * 3) | 0);
    const pulses = 3 + ((Math.random() * 2) | 0);
    for (let r = 0; r < reps; r++) {
      for (let i = 0; i < pulses; i++) {
        tone(G, v.g, { type: 'sine', f, t: t + r * 0.32 + i * 0.035, a: 0.004, d: 0.022, peak: 0.02 });
      }
    }
    v.free((reps * 0.32 + 1) * 1000);
  };

  // sapinho: coaxar grave com pulsos (e às vezes um "piu" agudo de perereca)
  const frog = () => {
    const v = voice(rnd(0.5, 1), 0.8, 0.3);
    const t = ctx.currentTime + 0.03;
    if (Math.random() < 0.7) {
      const f0 = rnd(150, 230);
      const n = Math.random() < 0.5 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const tt = t + k * 0.24;
        const d = rnd(0.12, 0.18);
        const s = osc(G, 'sawtooth', f0, tt, tt + d + 0.05);
        s.frequency.linearRampToValueAtTime(f0 * 1.12, tt + d);
        const am = gn(G, 0);
        const pulse = osc(G, 'square', rnd(24, 32), tt, tt + d + 0.05);
        const pg = gn(G, 0.5);
        pulse.connect(pg); pg.connect(am.gain);
        const off = gn(G, 0.5);
        const bpf = flt(G, 'bandpass', rnd(650, 850), 3);
        const g = gn(G, 0);
        env(g.gain, tt, { a: 0.015, hold: d * 0.5, d: d * 0.5, peak: 0.07 });
        s.connect(bpf); bpf.connect(am); am.connect(off); off.connect(g); g.connect(v.g);
      }
    } else {
      const n = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) tone(G, v.g, { type: 'sine', f: 2700, to: 3100, t: t + i * 0.42, a: 0.01, d: 0.08, peak: 0.018 });
    }
    v.free(3000);
  };

  const chime = () => {
    const t = ctx.currentTime + 0.05;
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.6, 0.6);
    const g = gn(G, 1);
    g.connect(pan); pan.connect(G.amb);
    const vs = gn(G, 0.6);
    pan.connect(vs); vs.connect(G.verbSend);
    const scale = G.ambience === 'night' ? [81, 84, 88, 89, 93, 96] : [84, 86, 88, 91, 93, 96];
    const n = 3 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      fm(G, g, { f: mtof(pick(scale)), t: t + i * rnd(0.14, 0.32), d: 2.2, peak: 0.022, ratio: 1.41, index: 1.2, idxD: 0.5 });
    }
    setTimeout(() => { try { g.disconnect(); pan.disconnect(); } catch (_) {} }, 5000);
  };

  const running = () => ctx.state === 'running';
  const birdLoop = () => {
    if (!isAlive()) return;
    const c = cfg();
    if (running() && c.birds) {
      birdCall();
      if (Math.random() < 0.3) setTimeout(birdCall, rnd(500, 1300));
    }
    const r = c.birds || [6000, 9000];
    setTimeout(birdLoop, rnd(r[0], r[1]));
  };
  const chimeLoop = () => {
    if (!isAlive()) return;
    const c = cfg();
    if (running() && Math.random() < c.chimeP) chime();
    setTimeout(chimeLoop, rnd(c.chime[0], c.chime[1]));
  };
  const cricketLoop = () => {
    if (!isAlive()) return;
    const c = cfg();
    if (running() && c.crickets > 0 && Math.random() < c.crickets) cricket(rnd(0.4, 1) * (0.5 + 0.5 * c.crickets));
    setTimeout(cricketLoop, rnd(350, 1100));
  };
  const frogLoop = () => {
    if (!isAlive()) return;
    const c = cfg();
    if (running() && c.frogs > 0 && Math.random() < 0.6 * c.frogs) frog();
    setTimeout(frogLoop, rnd(2200, 6500));
  };
  setTimeout(birdLoop, 1800);
  setTimeout(chimeLoop, rnd(8000, 16000));
  setTimeout(cricketLoop, 900);
  setTimeout(frogLoop, 2500);
}

// ---------------------------------------------------------------------------
//  Loops controlados por velocidade: rodas do carrinho ('roll') e caixote arrastando ('drag')
// ---------------------------------------------------------------------------
function createRoll(G, kind = 'roll') {
  const { ctx } = G;
  const drag = kind === 'drag';
  const src = ctx.createBufferSource();
  src.buffer = G.pink;
  src.loop = true;
  const bp = flt(G, 'bandpass', drag ? 320 : 210, drag ? 0.9 : 1.1);
  const lp = flt(G, 'lowpass', drag ? 1400 : 900, 0.6);
  const g = gn(G, 0);
  src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(G.sfx);
  src.start();
  let phase = 0;
  let last = 0;
  const hold = (param, t) => {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); }
  };
  return {
    drive(speed) {
      const t = ctx.currentTime;
      const ref = drag ? 0.7 : 0.85;
      const s = clamp(Math.abs(speed) / ref, 0, 1.4);
      hold(g.gain, t);
      g.gain.setTargetAtTime((drag ? 0.34 : 0.28) * s, t, 0.06);
      g.gain.setTargetAtTime(0.0, t + 0.22, 0.09); // some sozinho se parar de receber chamadas
      bp.frequency.setTargetAtTime((drag ? 260 : 170) + (drag ? 140 : 80) * s, t, 0.1);
      const dt = clamp(t - last, 0, 0.1);
      last = t;
      phase += Math.abs(speed) * dt * (drag ? 7 : 3.6);
      if (phase >= 1 && s > 0.05) {
        phase %= 1;
        const k = rnd(0.85, 1.15);
        const o = gn(G, 1);
        o.connect(G.sfx);
        if (drag) {
          // grão de madeira raspando na pedra
          nz(G, o, { t, a: 0.004, d: rnd(0.04, 0.09), peak: 0.07 * Math.min(1, s), type: 'bandpass', f: rnd(700, 1300) * k, q: 2.5 });
          if (Math.random() < 0.3) tone(G, o, { type: 'sine', f: 190 * k, to: 140 * k, t, a: 0.002, d: 0.06, peak: 0.05 * Math.min(1, s) });
        } else {
          tone(G, o, { type: 'sine', f: 330 * k, to: 250 * k, t, a: 0.002, d: 0.05, peak: 0.07 * Math.min(1, s) });
          nz(G, o, { t, a: 0.001, d: 0.025, peak: 0.05 * Math.min(1, s), type: 'bandpass', f: 1100 * k, q: 2 });
        }
        setTimeout(() => o.disconnect(), 400);
      }
    },
    stop() {
      const t = ctx.currentTime;
      hold(g.gain, t);
      g.gain.setTargetAtTime(0, t, 0.08);
    },
  };
}

// ---------------------------------------------------------------------------
//  API
// ---------------------------------------------------------------------------
export function createAudio() {
  let volume = 0.7;
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY));
    if (Number.isFinite(v)) volume = clamp(v, 0, 1);
  } catch (_) { /* sem storage */ }

  let ctx = null;
  let G = null;
  let roll = null;
  let drag = null;
  let ambience = 'day';
  let muffled = false;
  let voices = 0;
  const last = new Map();

  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC({ latencyHint: 'interactive' });
        G = buildGraph(ctx, volume);
        G.ambience = ambience;
        startAmbient(G, () => !!ctx);
      }
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
    } catch (_) { /* áudio indisponível: jogo segue mudo */ }
  }

  function setVolume(v) {
    volume = clamp(Number(v) || 0, 0, 1);
    if (G) G.master.gain.setTargetAtTime(volume, ctx.currentTime, 0.03);
    try { localStorage.setItem(VOL_KEY, String(volume)); } catch (_) {}
  }

  function setMuffled(on) {
    muffled = !!on;
    if (!G) return;
    const t = ctx.currentTime;
    G.muffle.frequency.cancelScheduledValues(t);
    G.muffle.frequency.setTargetAtTime(muffled ? 600 : 20000, t, muffled ? 0.06 : 0.12);
    G.amb.gain.cancelScheduledValues(t);
    G.amb.gain.setTargetAtTime(muffled ? 0.3 : 0.55, t, 0.2);
    if (muffled) { roll?.stop(); drag?.stop(); }
  }

  /** Ambiente sonoro da fase: 'day' | 'dusk' | 'night'. Pode ser chamado antes do unlock. */
  function setAmbience(kind) {
    ambience = kind || 'day';
    if (G) G.setAmbience?.(ambience);
  }

  function out(bus, gain, pan, verb) {
    const g = gn(G, gain);
    const nodes = [g];
    let node = g;
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      node = p;
      nodes.push(p);
    }
    node.connect(G[bus]);
    if (verb > 0) {
      const s = gn(G, verb);
      node.connect(s);
      s.connect(G.verbSend);
      nodes.push(s);
    }
    return { g, nodes };
  }

  function play(name, opts = {}) {
    if (!ctx || !G) return;
    try {
      if (name === 'cartRoll') {
        if (muffled) return;
        roll ||= createRoll(G);
        roll.drive(opts.speed ?? 0.85);
        return;
      }
      if (name === 'crateDrag') {
        if (muffled) return;
        drag ||= createRoll(G, 'drag');
        drag.drive(opts.speed ?? 0.7);
        return;
      }
      const fn = SOUNDS[name];
      if (!fn) return;
      const now = ctx.currentTime;
      const gap = MIN_GAP[name] ?? 0.035;
      if (now - (last.get(name) ?? -10) < gap) return;
      if (voices > 40 && LOW_PRIORITY.has(name)) return;
      last.set(name, now);
      const pv = PITCH_VAR[name] ?? 0.035;
      const p = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * pv);
      const g = (opts.volume ?? 1) * (1 + (Math.random() * 2 - 1) * 0.1);
      const bus = UI_SOUNDS.has(name) ? 'ui' : 'sfx';
      const o = out(bus, g, opts.pan ?? 0, VERB[name] ?? 0.08);
      const dur = fn(G, o.g, now + 0.008, p, opts) || 0.5;
      voices++;
      setTimeout(() => {
        voices--;
        for (const n of o.nodes) { try { n.disconnect(); } catch (_) {} }
      }, (dur + 1.2) * 1000);
    } catch (err) {
      console.error('[audio] falha ao tocar', name, err);
    }
  }

  function stop(name) {
    if (name === 'cartRoll') roll?.stop();
    if (name === 'crateDrag') drag?.stop();
    if (!name) { roll?.stop(); drag?.stop(); }
  }

  // Mede pico/RMS de um som renderizando offline (sem compressor). Uso: depuração.
  async function analyze(name, opts = {}) {
    const sr = 44100;
    const off = new OfflineAudioContext(2, sr * 3.5, sr);
    const G2 = buildGraph(off, 1, { noComp: true });
    const fn = SOUNDS[name];
    if (!fn) return { name, error: 'desconhecido' };
    const bus = UI_SOUNDS.has(name) ? 'ui' : 'sfx';
    const g = gn(G2, 1);
    g.connect(G2[bus]);
    if ((VERB[name] ?? 0) > 0) { const s = gn(G2, VERB[name]); g.connect(s); s.connect(G2.verbSend); }
    fn(G2, g, 0.01, 1, opts);
    const buf = await off.startRendering();
    const d = buf.getChannelData(0);
    let peak = 0, sum = 0, n = 0;
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      if (a > 0.001) { sum += d[i] * d[i]; n++; }
    }
    const rms = n ? Math.sqrt(sum / n) : 0;
    return { name, peak: +peak.toFixed(3), rms: +rms.toFixed(4), activeSec: +(n / sr).toFixed(2) };
  }

  return {
    unlock,
    setVolume,
    getVolume: () => volume,
    play,
    stop,
    setMuffled,
    setAmbience,
    get ambience() { return ambience; },
    get unlocked() { return !!ctx && ctx.state === 'running'; },
    get context() { return ctx; },
    names: SOUND_NAMES,
    analyze,
  };
}
