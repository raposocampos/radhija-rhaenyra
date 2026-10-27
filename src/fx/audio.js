// Áudio 100% sintetizado em WebAudio (sem arquivos).
// API: createAudio() → { unlock(), setVolume(v), getVolume(), play(name, opts) }
// Música (audio/music.js, temas em audio/themes.js), num canal próprio: setMusic(id | null) escolhe o tema (menu, mapa
// ou o id da fase; pode ser chamado antes do unlock e começa nele), setMusicVolume(v)/musicVolume e setMusicOn(on)/musicOn
// (salvos no navegador; a música começa ligada).
// Extras: stop(name), setMuffled(on), setAmbience('day'|'dusk'|'night'|'city'|'rain'), names, analyze(name, opts).
// Loops por velocidade: play('cartRoll', {speed}) e play('crateDrag', {speed}) — chame a cada quadro; somem sozinhos.
// As partes moram em ./audio/: graph.js (mixagem), synth.js (primitivas), soundsV1.js/soundsV2.js (sons),
// sounds.js (biblioteca), ambience.js (ambiente por fase) e loops.js (carrinho/caixote).
import { clamp, gn } from './audio/synth.js';
import { buildGraph } from './audio/graph.js';
import { SOUNDS, MIN_GAP, PITCH_VAR, VERB, UI_SOUNDS, LOW_PRIORITY, SOUND_NAMES } from './audio/sounds.js';
import { startAmbient } from './audio/ambience.js';
import { createRoll } from './audio/loops.js';
import { createMusic } from './audio/music.js';
import { themeFor } from './audio/themes.js';
import { storageKey } from '../game/storageKey.js';

export { SOUND_NAMES };

const VOL_KEY = storageKey('operacao-cenoura:volume');
const MUSIC_KEY = storageKey('operacao-cenoura:musica');

// ---------------------------------------------------------------------------
//  API
// ---------------------------------------------------------------------------
export function createAudio() {
  let volume = 0.7;
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY));
    if (Number.isFinite(v)) volume = clamp(v, 0, 1);
  } catch (_) { /* sem storage */ }
  // música: ligada por padrão, num volume médio (a jogadora desliga ou muda nas Opções)
  let musicVol = 0.6;
  let musicOn = true;
  try {
    const m = JSON.parse(localStorage.getItem(MUSIC_KEY) || 'null');
    if (m && Number.isFinite(m.volume)) musicVol = clamp(m.volume, 0, 1);
    if (m && typeof m.on === 'boolean') musicOn = m.on;
  } catch (_) { /* sem storage ou JSON estragado: o padrão */ }
  let musicTheme = null;
  let music = null;
  const musicLevel = () => (musicOn ? musicVol : 0);
  const saveMusic = () => { try { localStorage.setItem(MUSIC_KEY, JSON.stringify({ volume: musicVol, on: musicOn })); } catch (_) {} };

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
        music = createMusic(ctx, { noise: G.noise, volume: musicLevel() });
        if (muffled) music.setMuffled(true);
        if (musicTheme) music.play(musicTheme);
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
    music?.setMuffled(muffled);
  }

  /** Tema da música: 'menu', 'mapa' ou o id da fase (sem tema próprio: silêncio). Antes do unlock, fica guardado. */
  function setMusic(id) {
    musicTheme = themeFor(id);
    music?.play(musicTheme);
  }
  function setMusicVolume(v) {
    musicVol = clamp(Number(v) || 0, 0, 1);
    music?.setVolume(musicLevel());
    saveMusic();
  }
  function setMusicOn(on) {
    musicOn = !!on;
    music?.setVolume(musicLevel());
    saveMusic();
  }

  /** Ambiente sonoro da fase: 'day' | 'dusk' | 'night' | 'city' | 'rain'. Pode ser chamado antes do unlock. */
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
    setMusic,
    setMusicVolume,
    setMusicOn,
    get musicVolume() { return musicVol; },
    get musicOn() { return musicOn; },
    /** O tema pedido (toca depois do unlock) e o que está tocando agora. */
    get musicTheme() { return musicTheme; },
    get musicPlaying() { return music?.theme ?? null; },
    get unlocked() { return !!ctx && ctx.state === 'running'; },
    get context() { return ctx; },
    names: SOUND_NAMES,
    analyze,
  };
}
