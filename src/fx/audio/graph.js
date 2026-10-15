// Grafo de mixagem do áudio sintetizado e buffers de ruído/reverb.
// Cadeia: vozes → sfx/amb (→ abafador lowpass da pausa) → compressor → master → saída;
//         vozes de UI → compressor (não são abafadas); reverb curto como envio (verbSend).
export function makeNoise(ctx, seconds, pink = false) {
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

export function buildGraph(ctx, volume, { noComp = false } = {}) {
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
