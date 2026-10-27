// Música do jogo, sintetizada (WebAudio, sem arquivos), num canal próprio: o volume da música não mexe no dos efeitos.
// Os temas (themes.js) viram notas aqui: stepEvents() diz o que toca em cada semicolcheia (melodia, acompanhamento,
// baixo, tapete de acordes e percussão; puro, testado sem navegador) e o tocador agenda as notas um pouco à frente
// (relógio do áudio), troca de tema com um cruzamento suave e abafa na pausa como os outros sons.
// API: createMusic(ctx, { noise }) → { play(id | null), setVolume(v), setMuffled(on), get theme, stop() }
import { THEMES, compileTheme } from './themes.js';

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Notas por instrumento: os que sustentam (sopros, sanfona) duram até a próxima nota; os percutidos ignoram. */
const SUSTAINS = new Set(['whistle', 'flute', 'clarinet', 'accordion']);

/** Fundamental do baixo: entre A1 e G#2 (33–44). */
const bassRoot = (pc) => 33 + ((pc - 9 + 12) % 12);

/**
 * O que toca na semicolcheia `s` (0–15) do compasso `bar` (0–7) do tema compilado. Puro: sem áudio.
 * → [{ part: 'lead'|'arp'|'bass'|'pad'|'perc', inst, midi?, notes?, vel, steps }]
 */
export function stepEvents(T, bar, s) {
  const B = T.bars[bar % 8];
  const ch = B.chord;
  const out = [];
  // tapete de acordes: o compasso inteiro
  // (uma oitava acima, menos nos acordes que já começam alto: o tapete fica entre C4 e C6)
  if (T.pad > 0 && s === 0) out.push({ part: 'pad', inst: 'pad', notes: ch.notes.map((n) => n + (ch.notes[0] >= 62 ? 0 : 12)), vel: T.pad, steps: 16 });
  // melodia: a duração vai até a próxima nota (no máximo uma semínima e meia)
  const n = B.lead[s];
  if (n != null) {
    let len = 1;
    while (s + len < 16 && B.lead[s + len] == null && len < 6) len++;
    out.push({ part: 'lead', inst: T.lead, midi: n, vel: s % 4 === 0 ? 1 : 0.82, steps: len });
  }
  // acompanhamento em colcheias
  if (T.arp && s % 2 === 0) {
    const tones = ch.notes.slice(0, 3);
    if (T.arpStyle === 'updown') {
      const order = [0, 1, 2, 1, 0, 1, 2, 1];
      out.push({ part: 'arp', inst: T.arp, midi: tones[order[s / 2]] + 12, vel: s % 4 === 0 ? 0.62 : 0.45, steps: 2 });
    } else if (n == null) {
      out.push({ part: 'arp', inst: T.arp, midi: tones[(s / 2) % tones.length] + 12, vel: 0.28, steps: 2 });
    }
  }
  // baixo
  const r = bassRoot(ch.root);
  const fifth = r + 7;
  const third = r + (ch.notes[1] - ch.notes[0]);
  switch (T.bass) {
    case 'pop':
      if (s === 0 || s === 8) out.push({ part: 'bass', inst: 'bass', midi: r, vel: 1, steps: 4 });
      if (s === 6 || s === 14) out.push({ part: 'bass', inst: 'bass', midi: fifth, vel: 0.7, steps: 2 });
      break;
    case 'walk':
      if (s % 4 === 0) out.push({ part: 'bass', inst: 'bass', midi: [r, third, fifth, r + 12][s / 4], vel: s === 0 ? 1 : 0.8, steps: 3 });
      break;
    case 'stroll':
      if (s === 0) out.push({ part: 'bass', inst: 'bass', midi: r, vel: 1, steps: 8 });
      if (s === 10) out.push({ part: 'bass', inst: 'bass', midi: fifth, vel: 0.75, steps: 5 });
      break;
    case 'calm':
      if (s === 0) out.push({ part: 'bass', inst: 'bass', midi: r, vel: 0.9, steps: 8 });
      if (s === 8) out.push({ part: 'bass', inst: 'bass', midi: fifth, vel: 0.7, steps: 8 });
      break;
    case 'pizz':
      if (s % 4 === 0) out.push({ part: 'bass', inst: 'pizz', midi: (s / 4) % 2 ? fifth : r, vel: s === 0 ? 1 : 0.8, steps: 1 });
      break;
    case 'train':
      if (s % 2 === 0) out.push({ part: 'bass', inst: 'pizz', midi: (s / 2) % 2 ? fifth : r, vel: s % 4 === 0 ? 1 : 0.7, steps: 1 });
      break;
    default:
      break;
  }
  // percussão
  const P = (inst, vel) => out.push({ part: 'perc', inst, vel, steps: 1 });
  switch (T.perc) {
    case 'pop':
      if (s === 0 || s === 8) P('kick', 0.8);
      if (s === 4 || s === 12) P('clap', 1);
      if (s % 2 === 0) P('shaker', s % 4 === 2 ? 1 : 0.6);
      break;
    case 'walk':
      if (s === 0 || s === 10) P('kick', 0.55);
      if (s % 2 === 0) P('shaker', s % 4 === 0 ? 0.5 : 1);
      break;
    case 'soft':
      if (s % 4 === 2) P('shaker', 0.8);
      if (s === 0) P('kick', 0.35);
      break;
    case 'brush':
      if (s === 4 || s === 12) P('brush', 1);
      if (s === 0) P('kick', 0.4);
      if (s % 4 === 2) P('shaker', 0.45);
      break;
    case 'train':
      if (s % 2 === 0) P('wood', s % 4 === 0 ? 1 : 0.55);
      if (s === 0 || s === 8) P('kick', 0.6);
      break;
    case 'party':
      if (s % 4 === 0) P('kick', 0.75);
      if (s === 4 || s === 12) P('clap', 1);
      P('tamb', s % 2 === 0 ? 0.7 : 0.35);
      break;
    case 'clock':
      if (s % 4 === 0) P('rim', (s / 4) % 2 ? 0.5 : 0.8);
      break;
    default:
      break;
  }
  return out;
}

/** Temas compilados uma vez (partitura → MIDI). */
const COMPILED = new Map();
export function compiled(id) {
  if (!Object.hasOwn(THEMES, id)) return null;
  if (!COMPILED.has(id)) COMPILED.set(id, compileTheme(THEMES[id]));
  return COMPILED.get(id);
}

// ---------------------------------------------------------------- instrumentos
/**
 * Instrumentos sintetizados: cada um agenda as próprias vozes em `t` (segundos do relógio do áudio) e se desliga
 * sozinho. `dest` é o ganho do tema (o cruzamento entre temas mexe só nele).
 */
function makeInstruments(ctx, noise) {
  const env = (g, t, a, peak, d) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  /** Envelope de nota sustentada (ataque, sustentação até `len`, soltura curta). */
  const hold = (g, t, a, peak, len, rel = 0.08) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a + 0.01, len));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, len) + rel);
  };
  const osc = (type, f, t, stop, dest) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  };
  const gain = (dest) => { const g = ctx.createGain(); g.connect(dest); return g; };
  const lp = (f, dest, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; };
  const vibrato = (o, f, t, stop, depth = 0.006, rate = 5.4, delay = 0.14) => {
    const l = ctx.createOscillator();
    const lg = ctx.createGain();
    l.frequency.value = rate;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * depth, t + delay + 0.1);
    l.connect(lg).connect(o.frequency);
    l.start(t);
    l.stop(stop);
  };
  const noiseHit = (t, dest, { type = 'highpass', f = 6000, q = 0.8, peak = 0.05, d = 0.05, a = 0.003 }) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    const g = ctx.createGain();
    s.connect(b).connect(g).connect(dest);
    env(g, t, a, peak, d);
    s.start(t, Math.random() * 0.5);
    s.stop(t + a + d + 0.05);
  };

  return {
    marimba(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); env(g, t, 0.004, 0.2 * v, 0.42); osc('sine', f, t, t + 0.55, g);
      const h = gain(dest); env(h, t, 0.002, 0.045 * v, 0.09); osc('sine', f * 3.98, t, t + 0.16, h);
    },
    pluck(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest);
      const b = lp(3200, g);
      b.frequency.setValueAtTime(3200, t);
      b.frequency.exponentialRampToValueAtTime(700, t + 0.22);
      env(g, t, 0.003, 0.1 * v, 0.3);
      osc('triangle', f, t, t + 0.36, b);
      osc('sawtooth', f * 1.003, t, t + 0.22, b);
    },
    whistle(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); hold(g, t, 0.05, 0.12 * v, len, 0.07);
      const o = osc('sine', f * 0.97, t, t + len + 0.2, g);
      o.frequency.linearRampToValueAtTime(f, t + 0.06);
      vibrato(o, f, t, t + len + 0.2);
    },
    flute(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); hold(g, t, 0.06, 0.1 * v, len, 0.09);
      const o = osc('sine', f, t, t + len + 0.2, g);
      vibrato(o, f, t, t + len + 0.2, 0.005, 5);
      const g2 = gain(g); g2.gain.value = 0.12; osc('triangle', f * 2, t, t + len + 0.2, g2);
      noiseHit(t, dest, { type: 'bandpass', f: f * 2, q: 2, peak: 0.02 * v, d: 0.12, a: 0.02 });
    },
    keys(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); env(g, t, 0.006, 0.15 * v, 1.1); osc('sine', f, t, t + 1.25, g);
      const h = gain(dest); env(h, t, 0.003, 0.04 * v, 0.35); osc('sine', f * 2, t, t + 0.45, h);
      const tri = gain(dest); env(tri, t, 0.004, 0.035 * v, 0.7); osc('triangle', f * 1.003, t, t + 0.8, tri);
    },
    bell(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); env(g, t, 0.003, 0.12 * v, 1.6); osc('sine', f, t, t + 1.7, g);
      const h = gain(dest); env(h, t, 0.002, 0.045 * v, 0.6); osc('sine', f * 2.76, t, t + 0.7, h);
      const k = gain(dest); env(k, t, 0.001, 0.02 * v, 0.22); osc('sine', f * 5.4, t, t + 0.3, k);
    },
    toy(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); env(g, t, 0.002, 0.14 * v, 0.34); osc('triangle', f, t, t + 0.42, g);
      const h = gain(dest); env(h, t, 0.001, 0.025 * v, 0.07); osc('square', f * 3, t, t + 0.1, h);
    },
    clarinet(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); hold(g, t, 0.035, 0.07 * v, len, 0.07);
      const b = lp(Math.min(4200, f * 4), g, 0.9);
      const o = osc('square', f, t, t + len + 0.2, b);
      vibrato(o, f, t, t + len + 0.2, 0.004, 5.2, 0.2);
    },
    vibes(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); env(g, t, 0.004, 0.14 * v, 1.3);
      const trem = ctx.createGain();
      trem.gain.value = 0.75;
      trem.connect(g);
      const l = ctx.createOscillator(); const lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = 0.25;
      l.connect(lg).connect(trem.gain); l.start(t); l.stop(t + 1.45);
      osc('sine', f, t, t + 1.45, trem);
      const h = gain(dest); env(h, t, 0.002, 0.03 * v, 0.2); osc('sine', f * 4, t, t + 0.25, h);
    },
    accordion(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); hold(g, t, 0.03, 0.05 * v, len, 0.07);
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 1600; b.Q.value = 0.6; b.connect(g);
      const o1 = osc('sawtooth', f, t, t + len + 0.2, b);
      const o2 = osc('sawtooth', f * 1.006, t, t + len + 0.2, b);
      osc('square', f * 0.5, t, t + len + 0.2, b);
      vibrato(o1, f, t, t + len + 0.2, 0.003, 5.8, 0.05);
      vibrato(o2, f, t, t + len + 0.2, 0.003, 5.8, 0.05);
    },
    bass(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); hold(g, t, 0.008, 0.2 * v, Math.max(0.12, len * 0.9), 0.12);
      const b = lp(700, g);
      osc('triangle', f, t, t + len + 0.25, b);
      osc('sine', f, t, t + len + 0.25, b);
    },
    pizz(t, m, v, len, dest) {
      const f = mtof(m);
      const g = gain(dest); env(g, t, 0.004, 0.2 * v, 0.2);
      const b = lp(900, g);
      osc('triangle', f, t, t + 0.3, b);
      osc('sine', f * 2, t, t + 0.15, b);
    },
    pad(t, notes, v, len, dest) {
      const g = gain(dest);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.35);
      g.gain.setValueAtTime(v, t + Math.max(0.4, len - 0.3));
      g.gain.linearRampToValueAtTime(0.0001, t + len + 0.2);
      const b = lp(900, g);
      for (const m of notes) {
        osc('sawtooth', mtof(m), t, t + len + 0.3, b);
        osc('sawtooth', mtof(m) * 1.004, t, t + len + 0.3, b);
      }
    },
    kick(t, v, dest) {
      const g = gain(dest); env(g, t, 0.002, 0.4 * v, 0.16);
      const o = osc('sine', 130, t, t + 0.2, g);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    },
    clap(t, v, dest) { noiseHit(t, dest, { type: 'bandpass', f: 1700, q: 0.9, peak: 0.15 * v, d: 0.11, a: 0.002 }); },
    shaker(t, v, dest) { noiseHit(t, dest, { type: 'highpass', f: 6500, peak: 0.045 * v, d: 0.05, a: 0.004 }); },
    tamb(t, v, dest) {
      noiseHit(t, dest, { type: 'highpass', f: 8000, peak: 0.05 * v, d: 0.08, a: 0.002 });
      const g = gain(dest); env(g, t, 0.001, 0.012 * v, 0.06); osc('square', 5200, t, t + 0.08, g);
    },
    rim(t, v, dest) {
      const g = gain(dest); env(g, t, 0.001, 0.07 * v, 0.04);
      const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 2400; b.Q.value = 4; b.connect(g);
      osc('square', 1800, t, t + 0.06, b);
    },
    brush(t, v, dest) { noiseHit(t, dest, { type: 'bandpass', f: 3200, q: 0.7, peak: 0.05 * v, d: 0.22, a: 0.03 }); },
    wood(t, v, dest) {
      const g = gain(dest); env(g, t, 0.001, 0.1 * v, 0.06); osc('sine', 950, t, t + 0.09, g);
      const h = gain(dest); env(h, t, 0.001, 0.04 * v, 0.03); osc('sine', 1900, t, t + 0.05, h);
    },
  };
}

// ---------------------------------------------------------------- tocador
/**
 * @param {AudioContext} ctx
 * @param {{ noise: AudioBuffer, volume?: number }} opts
 */
export function createMusic(ctx, { noise, volume = 0.6 }) {
  const LOOK = 0.15; // agenda até 150 ms à frente
  // canal da música: entrada dos temas → abafador da pausa → volume → compressor → saída
  const input = ctx.createGain();
  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = 20000;
  muffle.Q.value = 0.6;
  const vol = ctx.createGain();
  vol.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  comp.attack.value = 0.005;
  comp.release.value = 0.25;
  input.connect(muffle).connect(vol).connect(comp).connect(ctx.destination);
  const I = makeInstruments(ctx, noise);

  /** O tema tocando: ganho próprio (para o cruzamento), relógio e posição. */
  let cur = null;
  let timer = 0;

  function schedule() {
    if (!cur) return;
    const now = ctx.currentTime;
    const T = cur.T;
    const sd = 60 / T.bpm / 4;
    // aba escondida ou relógio parado: sem rajada de notas atrasadas, recomeça logo à frente
    if (cur.next < now - 0.05) cur.next = now + 0.05;
    while (cur.next < now + LOOK) {
      const bar = Math.floor(cur.step / 16) % 8, s = cur.step % 16;
      const t = cur.next + (s % 2 === 1 ? T.swing * sd : 0);
      for (const e of stepEvents(T, bar, s)) {
        try {
          const fn = I[e.inst];
          if (!fn) continue;
          if (e.part === 'perc') fn(t, e.vel, cur.g);
          else if (e.part === 'pad') fn(t, e.notes, e.vel, e.steps * sd, cur.g);
          else fn(t, e.midi, e.vel, (SUSTAINS.has(e.inst) ? Math.min(e.steps, 6) : e.steps) * sd * 0.92, cur.g);
        } catch (_) { /* uma voz que falhe não para a música */ }
      }
      cur.next += sd;
      cur.step++;
    }
  }
  function ensureTimer() {
    if (!timer) timer = setInterval(schedule, 25);
  }

  function fadeOut(c, sec = 0.9) {
    if (!c) return;
    const t = ctx.currentTime;
    c.g.gain.cancelScheduledValues(t);
    c.g.gain.setValueAtTime(Math.max(0.0001, c.g.gain.value), t);
    c.g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
    setTimeout(() => { try { c.g.disconnect(); } catch (_) {} }, (sec + 1.8) * 1000);
  }

  /** Toca o tema `id` (menu, mapa, fase1…); o mesmo que já toca continua; null para com um fade. */
  function play(id) {
    const T = id ? compiled(id) : null;
    if (cur && T && cur.id === id) return;
    const old = cur;
    cur = null;
    fadeOut(old, T ? 1.2 : 0.8);
    if (!T) {
      if (timer) { clearInterval(timer); timer = 0; }
      return;
    }
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(T.gain, t + 1.0);
    g.connect(input);
    // com outro tema saindo, o novo entra meio compasso depois (o cruzamento não embola as melodias)
    cur = { id, T, g, step: 0, next: t + (old ? 0.5 : 0.1) };
    ensureTimer();
  }

  return {
    play,
    stop: () => play(null),
    /** Volume da música (0–1; a nota desligada é 0). */
    setVolume(v) {
      const t = ctx.currentTime;
      vol.gain.cancelScheduledValues(t);
      vol.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), t, 0.08);
    },
    /** Pausa: a música fica longe e abafada, como os outros sons. */
    setMuffled(on) {
      const t = ctx.currentTime;
      muffle.frequency.cancelScheduledValues(t);
      muffle.frequency.setTargetAtTime(on ? 900 : 20000, t, on ? 0.08 : 0.15);
      input.gain.cancelScheduledValues(t);
      input.gain.setTargetAtTime(on ? 0.5 : 1, t, 0.2);
    },
    get theme() { return cur?.id ?? null; },
  };
}
