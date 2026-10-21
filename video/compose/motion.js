// Matemática de animação do trailer: curvas, molas e sorteio determinístico.
// Tudo é função pura do tempo: qualquer quadro pode ser desenhado em qualquer ordem (vários desenhistas em paralelo).

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Progresso de t entre a e b (0..1). */
export const prog = (t, a, b) => clamp((t - a) / Math.max(1e-6, b - a));

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inQuart: (t) => t * t * t * t,
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  smooth: (t) => t * t * (3 - 2 * t),
};

/**
 * Mola amortecida (resposta a um degrau de 0 para 1), em s desde o disparo.
 * freq: oscilações por segundo; damp: 0..1 (0,4 = bem elástica, 1 = sem passar do ponto).
 */
export function spring(t, { freq = 1.6, damp = 0.55 } = {}) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  if (damp >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * t) * (Math.cos(wd * t) + ((damp * w) / wd) * Math.sin(wd * t));
}

/** Entra com mola em `at` e sai com curva em `out` (dur s): 0 → 1 → 0. */
export function inOut(t, at, out, { inF = 1.7, inD = 0.55, outDur = 0.28 } = {}) {
  const a = spring(t - at, { freq: inF, damp: inD });
  if (out === undefined || out === null || t < out) return a;
  return a * (1 - ease.inCubic(prog(t, out, out + outDur)));
}

/** Sorteio determinístico (mulberry32) a partir de uma semente. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído suave 1D determinístico (para tremidinhas de câmera). */
export function noise1(x, seed = 1) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => {
    const s = Math.sin((n + seed * 101.7) * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}
