// Trilha do trailer renderizada offline (OfflineAudioContext): a música (music.js), os efeitos de passagem da
// montagem e os sons sintetizados do próprio jogo (src/fx/audio), tocados na hora em que aconteceram nas cenas.
import { createInstruments, playForm } from './music.js';
import { buildGraph } from '../../src/fx/audio/graph.js';
import { SOUNDS, UI_SOUNDS, VERB } from '../../src/fx/audio/sounds.js';
import { gn } from '../../src/fx/audio/synth.js';

function impulse(ctx, sec = 2.4, decay = 3.0) {
  const n = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let s = 12345 + c * 777;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      lp = lp * 0.6 + ((s / 4294967296) * 2 - 1) * 0.4;
      d[i] = lp * Math.pow(1 - i / n, decay) * (i < 400 ? i / 400 : 1);
    }
  }
  return b;
}

/**
 * @param {{ duration: number, form: any[], musicStart?: number, cues?: any[], gameSounds?: any[], sampleRate?: number,
 *   gameGain?: number }} o
 * → { wav (base64), stats }
 */
export async function renderSoundtrack({ duration, form, musicStart = 0, cues = [], gameSounds = [], sampleRate = 48000, gameGain = 0.5 }) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const gain = (v, dest) => {
    const g = ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  };
  // master: compressor suave e limitador
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  limiter.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 10;
  comp.ratio.value = 2.6;
  comp.attack.value = 0.008;
  comp.release.value = 0.22;
  comp.connect(limiter);
  const music = gain(0.85, comp);
  const duck = gain(1, music);
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx);
  const verbSend = gain(1);
  verbSend.connect(verb);
  verb.connect(gain(0.3, music));
  const bus = (g, dest, send = 0) => {
    const n = gain(g, dest);
    if (send) n.connect(gain(send, verbSend));
    return n;
  };
  const out = {
    pluck: bus(0.5, duck, 0.22),
    mallet: bus(0.55, music, 0.3),
    bell: bus(0.7, music, 0.42),
    pad: bus(1.6, duck, 0.35),
    bass: bus(0.62, duck, 0),
    lead: bus(0.9, music, 0.4),
    drums: bus(0.72, music, 0.04),
    fx: bus(0.6, comp, 0.18),
  };
  // "bombeado" leve do bumbo no pad, na corda e no baixo
  out.duck = (t, v = 1) => {
    duck.gain.setValueAtTime(1 - 0.28 * Math.min(1, v), t);
    duck.gain.setTargetAtTime(1, t + 0.01, 0.07);
  };
  const I = createInstruments(ctx, out);
  playForm(ctx, I, form, musicStart);

  // efeitos da montagem (sopros nos cortes, pops dos textos, brilhos, impactos)
  for (const c of cues) {
    try {
      if (c.type === 'whoosh') I.whoosh(c.t, c.len ?? 0.45, c.vel ?? 0.28, c.dir ?? 1);
      else if (c.type === 'pop') I.pop(c.t, c.vel ?? 0.22, c.pitch ?? 1);
      else if (c.type === 'sparkle') I.sparkle(c.t, c.vel ?? 0.22, c.base ?? 86);
      else if (c.type === 'boom') I.boom(c.t, c.vel ?? 0.6);
      else if (c.type === 'riser') I.riser(c.t, c.len ?? 1, c.vel ?? 0.2);
      else if (c.type === 'crash') I.crash(c.t, c.vel ?? 0.35, c.len ?? 2);
    } catch (e) {
      console.warn('efeito', c, e);
    }
  }

  // sons do jogo (os mesmos do jogo, sintetizados), cada um na hora da cena
  const G = buildGraph(ctx, 1, { noComp: true });
  G.master.disconnect();
  const gameBus = gain(gameGain, comp);
  G.master.connect(gameBus);
  let played = 0;
  for (const s of gameSounds) {
    const fn = SOUNDS[s.name];
    if (!fn || UI_SOUNDS.has(s.name) || s.t < 0 || s.t > duration - 0.05) continue;
    const g = gn(G, (s.volume ?? 1) * (s.gain ?? 1));
    let node = g;
    if (s.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, s.pan * 0.6));
      g.connect(p);
      node = p;
    }
    node.connect(G.sfx);
    const v = VERB[s.name] ?? 0.08;
    if (v > 0) {
      const sv = gn(G, v);
      node.connect(sv);
      sv.connect(G.verbSend);
    }
    try {
      fn(G, g, Math.max(0.001, s.t), s.pitch ?? 1, { ...(s.opts || {}) });
      played++;
    } catch (e) {
      console.warn('som do jogo', s.name, e);
    }
  }

  const buf = await ctx.startRendering();
  // pico a -3 dBFS (o volume final, -14 LUFS, é ajustado pelo ffmpeg em duas passadas)
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = peak > 0 ? 0.708 / peak : 1;
  // nível por segundo (RMS, dBFS) para a revisão
  const perSec = [];
  for (let s0 = 0; s0 < L.length; s0 += sampleRate) {
    let sum = 0;
    const s1 = Math.min(L.length, s0 + sampleRate);
    for (let i = s0; i < s1; i++) sum += (L[i] * L[i] + R[i] * R[i]) / 2;
    const rms = Math.sqrt(sum / Math.max(1, s1 - s0)) * k;
    perSec.push(+(20 * Math.log10(rms + 1e-9)).toFixed(1));
  }
  // WAV 16 bits, estéreo
  const n = L.length;
  const bytes = new Uint8Array(44 + n * 4);
  const dv = new DataView(bytes.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data');
  dv.setUint32(40, n * 4, true);
  for (let i = 0, o = 44; i < n; i++, o += 4) {
    dv.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(L[i] * k * 32767))), true);
    dv.setInt16(o + 2, Math.max(-32768, Math.min(32767, Math.round(R[i] * k * 32767))), true);
  }
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return { wav: btoa(bin), stats: { peakBefore: +peak.toFixed(3), gameSounds: played, perSecDb: perSec } };
}
