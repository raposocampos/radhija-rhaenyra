import { mtof, rnd, pick, env, gn, flt, osc, tone, fm, nz, drips } from './synth.js';

// ---------------------------------------------------------------------------
//  Ambiente por fase: 'day' (passarinhos), 'dusk' (grilos começando + vento),
//  'night' (grilos, sapinhos e sino de vento), 'city' (manhã no terraço: passarinhos + trânsito
//  lá embaixo) e 'rain' (dentro de casa num dia de chuva: chuva na janela, relógio e trovão longe).
//  Troca suave com setAmbience(kind).
// ---------------------------------------------------------------------------
export const AMBIENCE = {
  day: { wind: 0.05, birds: [2600, 7800], crickets: 0, bed: 0, frogs: 0, chime: [26000, 52000], chimeP: 0.45 },
  dusk: { wind: 0.068, birds: [8000, 17000], crickets: 0.4, bed: 0.006, frogs: 0, chime: [20000, 38000], chimeP: 0.4 },
  night: { wind: 0.036, birds: null, crickets: 1, bed: 0.016, frogs: 1, chime: [9000, 19000], chimeP: 0.85 },
  city: { wind: 0.07, birds: [3200, 9000], crickets: 0, bed: 0, frogs: 0, chime: [30000, 60000], chimeP: 0.25, traffic: 1 },
  rain: { wind: 0.012, birds: null, crickets: 0, bed: 0, frogs: 0, chime: [60000, 90000], chimeP: 0, rain: 1, clock: 1 },
};

export function startAmbient(G, isAlive) {
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

  // chuva (chiado agudo + "tamborilar" médio com AM lenta) e trânsito distante (ronco grave),
  // ambos do mesmo ruído rosa; ficam mudos fora de 'rain' / 'city'
  const bedSrc = ctx.createBufferSource();
  bedSrc.buffer = G.pink;
  bedSrc.loop = true;
  const rainHp = flt(G, 'highpass', 900, 0.5);
  const rainLp = flt(G, 'lowpass', 6500, 0.5);
  const rainG = gn(G, (cfg().rain || 0) * 0.07);
  const patBp = flt(G, 'bandpass', 1800, 0.9);
  const patAm = gn(G, 0.6);
  const patL = osc(G, 'sine', 0.13, now, now + 1e6);
  const patLg = gn(G, 0.35);
  patL.connect(patLg); patLg.connect(patAm.gain);
  const patG = gn(G, (cfg().rain || 0) * 0.05);
  bedSrc.connect(rainHp); rainHp.connect(rainLp); rainLp.connect(rainG); rainG.connect(G.amb);
  bedSrc.connect(patBp); patBp.connect(patAm); patAm.connect(patG); patG.connect(G.amb);
  const trafLp = flt(G, 'lowpass', 240, 0.6);
  const trafG = gn(G, (cfg().traffic || 0) * 0.06);
  const trafL = osc(G, 'sine', 0.05, now, now + 1e6);
  const trafLg = gn(G, 0.02);
  trafL.connect(trafLg); trafLg.connect(trafG.gain);
  bedSrc.connect(trafLp); trafLp.connect(trafG); trafG.connect(G.amb);
  bedSrc.start(now);

  G.setAmbience = (kind) => {
    G.ambience = AMBIENCE[kind] ? kind : 'day';
    const c = cfg();
    const t = ctx.currentTime;
    wg.gain.setTargetAtTime(c.wind, t, 1.2);
    l1g.gain.setTargetAtTime(c.wind * 0.56, t, 1.2);
    bedG.gain.setTargetAtTime(c.bed * 8, t, 1.5);
    rainG.gain.setTargetAtTime((c.rain || 0) * 0.07, t, 1.5);
    patG.gain.setTargetAtTime((c.rain || 0) * 0.05, t, 1.5);
    trafG.gain.setTargetAtTime((c.traffic || 0) * 0.06, t, 1.5);
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
  // gotas batendo no vidro, relógio da sala e trovão bem longe (só em 'rain')
  const dropLoop = () => {
    if (!isAlive()) return;
    const c = cfg();
    if (running() && c.rain > 0) {
      const v = voice(0.5, 0.9, 0.2);
      drips(G, v.g, ctx.currentTime + 0.02, 1 + ((Math.random() * 3) | 0), 0.5, 0.012 * c.rain, 2600, 5200);
      v.free(1500);
    }
    setTimeout(dropLoop, rnd(250, 900));
  };
  let tick = 0;
  const clockLoop = () => {
    if (!isAlive()) return;
    const c = cfg();
    if (running() && c.clock > 0) {
      const t = ctx.currentTime + 0.02;
      tone(G, G.amb, { type: 'triangle', f: tick++ % 2 ? 2100 : 2500, t, a: 0.001, d: 0.025, peak: 0.012 * c.clock });
    }
    setTimeout(clockLoop, 1000);
  };
  const thunderLoop = () => {
    if (!isAlive()) return;
    const c = cfg();
    if (running() && c.rain > 0 && Math.random() < 0.7) {
      const t = ctx.currentTime + 0.05;
      const d = rnd(2.2, 3.4);
      nz(G, G.amb, { t, a: 0.3, hold: 0.3, d, peak: 0.1 * c.rain, type: 'lowpass', f: 150, to: 60, toT: d, q: 0.6, buf: G.pink });
      nz(G, G.amb, { t: t + rnd(0.1, 0.4), a: 0.06, d: 0.7, peak: 0.045 * c.rain, type: 'lowpass', f: 300, q: 0.7, buf: G.pink });
    }
    setTimeout(thunderLoop, rnd(20000, 42000));
  };
  setTimeout(dropLoop, 1200);
  setTimeout(clockLoop, 1500);
  setTimeout(thunderLoop, rnd(9000, 16000));
  setTimeout(birdLoop, 1800);
  setTimeout(chimeLoop, rnd(8000, 16000));
  setTimeout(cricketLoop, 900);
  setTimeout(frogLoop, 2500);
}
