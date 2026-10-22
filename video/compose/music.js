// Música original do trailer, 100% sintetizada (WebAudio, renderizada offline): ré maior, 120 BPM (1 tempo = 0,5 s =
// 15 quadros), para os cortes caírem nas batidas. A forma (seções por compasso) vem da linha do tempo de cada formato.
// Instrumentos: corda dedilhada (Karplus-Strong), marimba e glockenspiel (parciais), caixinha de música, pad de
// serras desafinadas, baixo, bateria (bumbo, palma, chimbal, chocalho, prato) e efeitos (subida, impacto, sopro).
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
const S16 = BEAT / 4;

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// acordes: voicing do pad (MIDI) e baixo
export const CHORDS = {
  D: { pad: [50, 54, 57, 62, 64], bass: 38, arp: [62, 66, 69, 74, 76] },
  A: { pad: [52, 57, 61, 64, 66], bass: 45, arp: [61, 64, 69, 73, 76] },
  Bm: { pad: [50, 54, 59, 62, 66], bass: 47, arp: [62, 66, 71, 74, 78] },
  G: { pad: [50, 55, 59, 62, 69], bass: 43, arp: [62, 67, 71, 74, 79] },
  'F#m': { pad: [49, 54, 57, 61, 64], bass: 42, arp: [61, 66, 69, 73, 76] },
  Em: { pad: [52, 55, 59, 64, 66], bass: 40, arp: [64, 67, 71, 76, 79] },
  Asus: { pad: [52, 57, 62, 64, 69], bass: 45, arp: [62, 64, 69, 74, 76] },
};

// melodias por compasso: [colcheia de início (0..7), nota MIDI, duração em colcheias]
const MEL = {
  verse: {
    D: [[0, 66, 1], [2, 69, 1], [3, 74, 1], [4, 73, 2], [6, 69, 2]],
    A: [[0, 69, 1], [2, 71, 1], [3, 73, 1], [4, 76, 3]],
    Bm: [[0, 74, 1], [2, 73, 1], [3, 71, 1], [4, 69, 2], [6, 66, 2]],
    G: [[0, 67, 2], [2, 71, 2], [4, 69, 4]],
  },
  chorus: {
    G: [[0, 71, 2], [2, 69, 1], [3, 71, 1], [4, 74, 2], [6, 71, 1], [7, 69, 1]],
    A: [[0, 69, 2], [2, 73, 2], [4, 76, 3], [7, 74, 1]],
    'F#m': [[0, 73, 2], [2, 69, 1], [3, 73, 1], [4, 78, 2], [6, 76, 1], [7, 74, 1]],
    Bm: [[0, 74, 3], [3, 73, 1], [4, 71, 4]],
    D: [[0, 78, 2], [2, 76, 1], [3, 74, 1], [4, 74, 4]],
  },
  chorusEnd: { Bm: [[0, 74, 2], [2, 76, 2], [4, 78, 4]] },
  break: {
    Bm: [[0, 74, 4], [4, 73, 2], [6, 71, 2]],
    G: [[0, 71, 6], [6, 69, 2]],
    D: [[0, 69, 4], [4, 66, 4]],
    A: [[0, 64, 2], [2, 66, 2], [4, 69, 4]],
  },
};

// ------------------------------------------------------------------------------------------------ utilidades
function noiseBuffer(ctx, sec, seed = 1) {
  const n = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    d[i] = (s / 4294967296) * 2 - 1;
  }
  return b;
}

/** Corda dedilhada (Karplus-Strong), em buffer (cache por nota). */
function pluckBuffer(ctx, cache, midi, { decay = 0.996, bright = 0.5, sec = 1.6 } = {}) {
  const key = `${midi}:${decay}:${bright}`;
  if (cache.has(key)) return cache.get(key);
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * sec);
  const b = ctx.createBuffer(1, n, sr);
  const d = b.getChannelData(0);
  const period = sr / hz(midi);
  const N = Math.max(2, Math.floor(period));
  const frac = period - N;
  const line = new Float32Array(N + 2);
  let s = (midi * 7919) >>> 0;
  for (let i = 0; i < line.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    // ataque um pouco filtrado (dedo, não palheta)
    line[i] = ((s / 4294967296) * 2 - 1) * (i % 2 ? 1 : 0.8);
  }
  let idx = 0;
  let last = 0;
  for (let i = 0; i < n; i++) {
    const a = line[idx];
    const nb = line[(idx + 1) % N];
    const v = a + (nb - a) * frac;
    const out = decay * (bright * v + (1 - bright) * last);
    last = v;
    line[idx] = out;
    d[i] = v;
    idx = (idx + 1) % N;
  }
  // tira a componente contínua e suaviza o fim
  let m = 0;
  for (let i = 0; i < n; i++) m += d[i];
  m /= n;
  for (let i = 0; i < n; i++) d[i] = (d[i] - m) * Math.min(1, (n - i) / (sr * 0.05));
  cache.set(key, b);
  return b;
}

function env(g, t, { a = 0.005, peak = 1, d = 0.3, s = 0, r = 0.2, hold = 0 }) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (s > 0) {
    g.gain.setTargetAtTime(peak * s, t + a, d / 3);
    g.gain.setValueAtTime(peak * s, t + a + Math.max(d, hold));
    g.gain.setTargetAtTime(0.0001, t + a + Math.max(d, hold), r / 4);
  } else {
    g.gain.setTargetAtTime(0.0001, t + a, d / 4);
  }
}

// ------------------------------------------------------------------------------------------------ instrumentos
export function createInstruments(ctx, out) {
  const cache = new Map();
  const noise = noiseBuffer(ctx, 2.5, 77);
  const noise2 = noiseBuffer(ctx, 2.5, 991);
  const mk = (gain, dest) => {
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(dest);
    return g;
  };
  const pan = (dest, p) => {
    const sp = ctx.createStereoPanner();
    sp.pan.value = p;
    sp.connect(dest);
    return sp;
  };

  const I = {
    pluck(t, midi, vel = 0.5, p = 0, decay = 0.996) {
      const src = ctx.createBufferSource();
      src.buffer = pluckBuffer(ctx, cache, midi, { decay });
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400 + vel * 3000;
      const g = mk(vel * 0.55, pan(out.pluck, p));
      src.connect(lp).connect(g);
      src.start(t);
    },
    strum(t, notes, vel = 0.5, gap = 0.012, p = 0) {
      notes.forEach((m, i) => I.pluck(t + i * gap, m, vel * (0.85 + 0.15 * (i / notes.length)), p + (i - notes.length / 2) * 0.08));
    },
    marimba(t, midi, vel = 0.5, p = 0) {
      const f = hz(midi);
      const dest = pan(out.mallet, p);
      for (const [k, a, dec] of [[1, 1, 0.55], [3.93, 0.28, 0.12], [9.9, 0.07, 0.05]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * k;
        const g = ctx.createGain();
        env(g, t, { a: 0.003, peak: vel * a * 0.5, d: dec });
        o.connect(g).connect(dest);
        o.start(t);
        o.stop(t + dec * 2 + 0.2);
      }
    },
    glock(t, midi, vel = 0.5, p = 0, len = 1.4) {
      const f = hz(midi);
      const dest = pan(out.bell, p);
      for (const [k, a, dec] of [[1, 1, len], [2.756, 0.32, len * 0.35], [5.404, 0.16, len * 0.18], [8.933, 0.06, 0.12]]) {
        if (f * k > 18000) continue;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * k;
        const g = ctx.createGain();
        env(g, t, { a: 0.002, peak: vel * a * 0.5, d: dec });
        o.connect(g).connect(dest);
        o.start(t);
        o.stop(t + dec * 1.6 + 0.2);
      }
    },
    musicbox(t, midi, vel = 0.4, p = 0) {
      const f = hz(midi);
      const dest = pan(out.bell, p);
      for (const [k, a, dec, det] of [[1, 1, 1.1, 0], [1, 0.5, 0.9, 7], [4.02, 0.22, 0.2, 0], [6.1, 0.08, 0.08, 0]]) {
        if (f * k > 18000) continue;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * k;
        o.detune.value = det;
        const g = ctx.createGain();
        env(g, t, { a: 0.002, peak: vel * a * 0.45, d: dec });
        o.connect(g).connect(dest);
        o.start(t);
        o.stop(t + dec * 1.6 + 0.2);
      }
    },
    pad(t, notes, dur, vel = 0.3, cutoff = 1400) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(cutoff * 0.6, t);
      lp.frequency.linearRampToValueAtTime(cutoff, t + Math.min(1.2, dur * 0.5));
      lp.Q.value = 0.4;
      const g = ctx.createGain();
      const a = Math.min(0.35, dur * 0.3);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + a);
      g.gain.setValueAtTime(vel, t + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
      lp.connect(g).connect(out.pad);
      notes.forEach((m, i) => {
        for (const det of [-9, 0, 9]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = hz(m);
          o.detune.value = det + (i % 2 ? 2 : -2);
          const og = ctx.createGain();
          og.gain.value = 0.3 / notes.length;
          const sp = ctx.createStereoPanner();
          sp.pan.value = det / 14;
          o.connect(og).connect(sp).connect(lp);
          o.start(t);
          o.stop(t + dur + 0.8);
        }
      });
    },
    bass(t, midi, len, vel = 0.6) {
      const f = hz(midi);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.008);
      g.gain.setTargetAtTime(vel * 0.7, t + 0.01, 0.08);
      g.gain.setValueAtTime(vel * 0.7, t + Math.max(0.02, len - 0.04));
      g.gain.linearRampToValueAtTime(0, t + len + 0.05);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      lp.Q.value = 0.7;
      g.connect(lp).connect(out.bass);
      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.value = f;
      const o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.value = f * 2;
      const g2 = ctx.createGain();
      g2.gain.value = 0.22;
      o1.connect(g);
      o2.connect(g2).connect(g);
      for (const o of [o1, o2]) { o.start(t); o.stop(t + len + 0.1); }
    },
    lead(t, midi, len, vel = 0.35, p = 0) {
      // sopro suave (triângulo + quadrada filtrada, vibrato que entra devagar)
      const f = hz(midi);
      const dest = pan(out.lead, p);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.06);
      g.gain.setValueAtTime(vel, t + Math.max(0.07, len - 0.08));
      g.gain.linearRampToValueAtTime(0, t + len + 0.12);
      lp.connect(g).connect(dest);
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.2;
      const vg = ctx.createGain();
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, len));
      vib.connect(vg);
      for (const [type, a] of [['triangle', 0.5], ['square', 0.12]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        vg.connect(o.frequency);
        const og = ctx.createGain();
        og.gain.value = a;
        o.connect(og).connect(lp);
        o.start(t);
        o.stop(t + len + 0.2);
      }
      vib.start(t);
      vib.stop(t + len + 0.2);
    },
    kick(t, vel = 1) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(155, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.003);
      g.gain.setTargetAtTime(0.0001, t + 0.02, 0.11);
      o.connect(g).connect(out.drums);
      o.start(t);
      o.stop(t + 0.6);
      // clique
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      const ng = ctx.createGain();
      env(ng, t, { a: 0.001, peak: vel * 0.18, d: 0.012 });
      n.connect(hp).connect(ng).connect(out.drums);
      n.start(t, 0.3, 0.05);
      out.duck?.(t, vel);
    },
    clap(t, vel = 0.6, p = 0.05) {
      const dest = pan(out.drums, p);
      for (const [dt, a, d] of [[0, 0.6, 0.01], [0.011, 0.55, 0.01], [0.022, 0.5, 0.012], [0.03, 1, 0.16]]) {
        const n = ctx.createBufferSource();
        n.buffer = noise2;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1350;
        bp.Q.value = 1.1;
        const g = ctx.createGain();
        env(g, t + dt, { a: 0.001, peak: vel * a * 0.7, d });
        n.connect(bp).connect(g).connect(dest);
        n.start(t + dt, ((t + dt) * 3.7) % 1.5, 0.3);
      }
      out.verbHit?.(t, 0.12 * vel);
    },
    snare(t, vel = 0.5) {
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'highpass';
      bp.frequency.value = 900;
      const g = ctx.createGain();
      env(g, t, { a: 0.001, peak: vel * 0.55, d: 0.13 });
      n.connect(bp).connect(g).connect(out.drums);
      n.start(t, (t * 7.3) % 1.5, 0.3);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(170, t + 0.08);
      const og = ctx.createGain();
      env(og, t, { a: 0.001, peak: vel * 0.35, d: 0.08 });
      o.connect(og).connect(out.drums);
      o.start(t);
      o.stop(t + 0.2);
    },
    hat(t, vel = 0.25, open = false, p = 0.2) {
      const n = ctx.createBufferSource();
      n.buffer = noise2;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7600;
      const g = ctx.createGain();
      env(g, t, { a: 0.001, peak: vel * 0.4, d: open ? 0.32 : 0.035 });
      n.connect(hp).connect(g).connect(pan(out.drums, p));
      n.start(t, (t * 3.1) % 2, open ? 0.5 : 0.1);
    },
    shaker(t, vel = 0.15, p = -0.25) {
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 6200;
      bp.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.018);
      g.gain.setTargetAtTime(0.0001, t + 0.02, 0.025);
      n.connect(bp).connect(g).connect(pan(out.drums, p));
      n.start(t, (t * 5.7) % 2, 0.12);
    },
    tom(t, midi, vel = 0.6) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(hz(midi) * 1.6, t);
      o.frequency.exponentialRampToValueAtTime(hz(midi), t + 0.08);
      const g = ctx.createGain();
      env(g, t, { a: 0.002, peak: vel * 0.6, d: 0.28 });
      o.connect(g).connect(out.drums);
      o.start(t);
      o.stop(t + 0.5);
    },
    crash(t, vel = 0.5, len = 2.4) {
      const n = ctx.createBufferSource();
      n.buffer = noise2;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 4200;
      const pk = ctx.createBiquadFilter();
      pk.type = 'peaking';
      pk.frequency.value = 8000;
      pk.gain.value = 6;
      const g = ctx.createGain();
      env(g, t, { a: 0.002, peak: vel * 0.32, d: len });
      n.connect(hp).connect(pk).connect(g).connect(out.fx);
      n.start(t, 0, Math.min(2.4, len + 0.5));
      if (len > 2.2) {
        const n2 = ctx.createBufferSource();
        n2.buffer = noise;
        const hp2 = ctx.createBiquadFilter();
        hp2.type = 'highpass';
        hp2.frequency.value = 4800;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(vel * 0.1, t + 2.2);
        g2.gain.setTargetAtTime(0.0001, t + 2.2, len / 6);
        n2.connect(hp2).connect(g2).connect(out.fx);
        n2.start(t + 2.2, 0, 2.4);
      }
      out.verbHit?.(t, 0.2 * vel);
    },
    /** Subida de ruído (antes de um impacto): de t até t+len. */
    riser(t, len, vel = 0.35) {
      const n = ctx.createBufferSource();
      n.buffer = noise;
      n.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(7000, t + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + len);
      g.gain.linearRampToValueAtTime(0, t + len + 0.03);
      n.connect(bp).connect(g).connect(out.fx);
      n.start(t);
      n.stop(t + len + 0.05);
    },
    /** Prato ao contrário (sobe até t+len). */
    reverse(t, len, vel = 0.3) {
      const n = ctx.createBufferSource();
      n.buffer = noise2;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + len - 0.01);
      g.gain.linearRampToValueAtTime(0, t + len);
      n.connect(hp).connect(g).connect(out.fx);
      n.start(t, 0, len + 0.05);
    },
    /** Impacto grave (boom). */
    boom(t, vel = 0.8) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.9);
      const g = ctx.createGain();
      env(g, t, { a: 0.004, peak: vel * 0.9, d: 1.1 });
      o.connect(g).connect(out.fx);
      o.start(t);
      o.stop(t + 1.6);
      out.duck?.(t, 1.2);
    },
    /** Sopro de transição (whoosh): ruído com filtro que passa e pan de um lado ao outro. */
    whoosh(t, len = 0.45, vel = 0.3, dir = 1) {
      const n = ctx.createBufferSource();
      n.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(500, t);
      bp.frequency.exponentialRampToValueAtTime(3800, t + len * 0.6);
      bp.frequency.exponentialRampToValueAtTime(900, t + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + len * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      const sp = ctx.createStereoPanner();
      sp.pan.setValueAtTime(-0.7 * dir, t);
      sp.pan.linearRampToValueAtTime(0.7 * dir, t + len);
      n.connect(bp).connect(g).connect(sp).connect(out.fx);
      n.start(t, (t * 1.7) % 1.5, len + 0.05);
    },
    /** "Pop" de texto aparecendo. */
    pop(t, vel = 0.25, pitch = 1) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(980 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(420 * pitch, t + 0.07);
      const g = ctx.createGain();
      env(g, t, { a: 0.002, peak: vel, d: 0.09 });
      o.connect(g).connect(out.fx);
      o.start(t);
      o.stop(t + 0.2);
    },
    /** Brilhinho (notas agudas rápidas). */
    sparkle(t, vel = 0.25, base = 86) {
      [0, 4, 7, 12, 16].forEach((k, i) => I.glock(t + i * 0.045, base + k, vel * (1 - i * 0.12), (i % 2 ? 0.4 : -0.4), 0.6));
    },
  };
  return I;
}

// ------------------------------------------------------------------------------------------------ arranjo
/**
 * Toca a forma (lista de seções) a partir de t0. Cada seção: { type, chords: ['D', ...] (um por compasso),
 * end?: true (último compasso da música) }. Devolve a duração total (s).
 */
export function playForm(ctx, I, form, t0 = 0) {
  let bar = 0;
  const at = (b, s16 = 0) => t0 + b * BAR + s16 * S16;
  form.forEach((sec, si) => {
    const next = form[si + 1];
    sec.chords.forEach((name, k) => {
      const ch = CHORDS[name];
      const b = bar + k;
      const lastBar = k === sec.chords.length - 1;
      const T = sec.type;
      const intoBig = lastBar && next && ['logo', 'chorus', 'final', 'verse'].includes(next.type) && T !== 'chorus';
      // ---- pad (todas as seções, mais aberto no refrão)
      const padVel = { intro: 0.34, build: 0.3, logo: 0.22, verse: 0.15, soft: 0.24, fill: 0.16, chorus: 0.17, break: 0.24, final: 0.2, outro: 0.28 }[T] ?? 0.18;
      const cutoff = { intro: 1100, build: 1800, chorus: 2600, final: 2800, verse: 1700, outro: 1300 }[T] ?? 1500;
      const padLen = T === 'outro' && sec.end && lastBar ? BAR * 2.5 : BAR;
      I.pad(at(b), ch.pad, padLen, padVel, cutoff);

      // ---- caixinha de música (abertura, fim e respiros)
      if (['intro', 'build', 'outro', 'soft'].includes(T)) {
        const arp = ch.arp;
        const pat = T === 'build' ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 2, 1, 3, 2, 4, 3, 1];
        const steps = T === 'outro' && sec.end && lastBar ? [0] : [0, 1, 2, 3, 4, 5, 6, 7];
        for (const s of steps) {
          if (T === 'intro' && s % 2 && k === 0 && s > 4) continue;
          I.musicbox(at(b, s * 2), arp[pat[s]] + (T === 'soft' ? 0 : 12), { intro: 0.46, build: 0.42, outro: 0.4, soft: 0.3 }[T], (s % 2 ? 0.35 : -0.35));
        }
      }

      // ---- baixo
      if (['logo', 'soft', 'break', 'outro'].includes(T)) {
        if (!(T === 'outro' && k > 0)) I.bass(at(b), ch.bass, T === 'outro' ? BAR * 2 : BAR * 0.95, 0.55);
      } else if (['verse', 'chorus', 'final'].includes(T)) {
        const pat = T === 'verse' ? [[0, 0, 2], [3, 0, 1], [4, 12, 2], [6, 0, 1], [8, 0, 2], [11, 7, 1], [12, 12, 2], [14, 7, 2]]
          : [[0, 0, 2], [2, 12, 1], [4, 0, 2], [6, 12, 1], [8, 0, 2], [10, 7, 1], [12, 12, 2], [14, 7, 1]];
        for (const [s, iv, len] of pat) I.bass(at(b, s), ch.bass + iv, len * S16 * 0.9, 0.6);
      } else if (T === 'fill' || T === 'build') {
        I.bass(at(b), ch.bass, BAR * 0.5, 0.45);
      }

      // ---- corda dedilhada
      if (['verse', 'chorus', 'final', 'logo', 'soft'].includes(T)) {
        const top = ch.pad.slice(1).map((m) => m + 12);
        const hits = T === 'soft' ? [0, 6, 10] : T === 'logo' ? [0, 3, 6, 10, 14] : [0, 3, 6, 8, 11, 14];
        for (const s of hits) I.strum(at(b, s), s === 0 ? top : top.slice(1), s === 0 ? 0.55 : 0.4, 0.011, 0);
      }

      // ---- marimba (verso) e glock (refrão)
      if (T === 'verse') for (const [e, m, d] of MEL.verse[name] || []) I.marimba(at(b, e * 2), m + 12, 0.55, 0.15);
      if (T === 'chorus' || T === 'final') {
        const m2 = (T === 'chorus' && lastBar && MEL.chorusEnd[name]) || MEL.chorus[name] || [];
        for (const [e, m, d] of m2) {
          I.glock(at(b, e * 2), m + 12, 0.5, -0.1, 0.9 + d * 0.15);
          I.marimba(at(b, e * 2), m, 0.32, 0.2);
        }
      }
      if (T === 'break') for (const [e, m, d] of MEL.break[name] || []) I.lead(at(b, e * 2), m, d * BEAT / 2, 0.22, 0);
      if (T === 'soft') {
        const motif = [[0, 78], [3, 76], [6, 74], [10, 73]];
        for (const [s, m] of motif) I.glock(at(b, s), m + (k % 2 ? -2 : 0), 0.35, 0.3, 1.2);
      }

      // ---- bateria
      if (T === 'verse' || T === 'chorus' || T === 'final') {
        for (const s of [0, 6, 8]) I.kick(at(b, s), 0.95);
        if (T !== 'verse' && k % 2 === 1) I.kick(at(b, 14), 0.7);
        for (const s of [4, 12]) I.clap(at(b, s), 0.62);
        for (let s = 0; s < 16; s++) I.shaker(at(b, s), s % 2 ? 0.16 : 0.09);
        if (T !== 'verse') for (const s of [2, 6, 10, 14]) I.hat(at(b, s), 0.3, s === 14 && k % 2 === 1);
      } else if (T === 'logo') {
        I.kick(at(b, 0), 0.9);
        I.kick(at(b, 8), 0.6);
        I.clap(at(b, 12), 0.4);
        for (let s = 0; s < 16; s += 2) I.shaker(at(b, s + 1), 0.13);
      } else if (T === 'soft') {
        I.kick(at(b, 0), 0.4);
        for (let s = 0; s < 16; s += 2) I.shaker(at(b, s + 1), 0.08);
      } else if (T === 'break') {
        I.kick(at(b, 0), 0.75);
        I.clap(at(b, 8), 0.5);
        for (let s = 2; s < 16; s += 4) I.hat(at(b, s), 0.18);
        if (lastBar) for (let s = 0; s < 16; s++) I.snare(at(b, s), 0.12 + 0.5 * (s / 15));
      } else if (T === 'fill') {
        I.kick(at(b, 0), 0.8);
        const toms = [50, 50, 47, 47, 45, 45, 43, 43];
        for (let s = 8; s < 16; s++) I.tom(at(b, s), toms[s - 8], 0.5 + (s - 8) * 0.04);
        for (let s = 0; s < 8; s++) I.snare(at(b, s), 0.12 + s * 0.04);
      } else if (T === 'build') {
        for (let s = 0; s < 16; s++) I.snare(at(b, s), 0.08 + 0.4 * Math.pow(s / 15, 1.6));
      } else if (T === 'outro' && k === 0) {
        I.kick(at(b, 0), 0.9);
      }

      // ---- efeitos de passagem
      if (intoBig) {
        I.riser(at(b), BAR, T === 'build' ? 0.32 : 0.2);
        I.reverse(at(b, 8), BAR / 2, 0.22);
      }
      const isFirst = k === 0;
      if (isFirst && ['logo', 'chorus', 'final', 'outro'].includes(T)) {
        I.crash(at(b), T === 'outro' ? 0.5 : 0.42, T === 'outro' ? 4 : 2.4);
        if (T === 'logo' || T === 'final') I.boom(at(b), 0.7);
      }
    });
    bar += sec.chords.length;
  });
  return bar * BAR;
}
