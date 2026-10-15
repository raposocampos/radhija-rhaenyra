import { clamp, rnd, gn, flt, tone, nz } from './synth.js';

// ---------------------------------------------------------------------------
//  Loops controlados por velocidade: rodas do carrinho ('roll') e caixote arrastando ('drag')
// ---------------------------------------------------------------------------
export function createRoll(G, kind = 'roll') {
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
