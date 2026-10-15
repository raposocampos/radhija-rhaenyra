// FASE 3 · Noite — preset de iluminação (formato: LIGHTING_DEFAULT em src/core/engine.js).
// Lua alta a nordeste (fria, azulada, única luz com sombra) + céu estrelado; o calor vem das luzes
// práticas do cenário (porta de vidro, lanternas, lamparina, cordões). Preenchimento azul suficiente
// para o gramado nunca ficar preto.
import { SUN } from './layout.js';

export default {
  sun: { dir: SUN.direction, color: '#9fb6ff', intensity: 1.55, shadowBias: -0.0004, shadowNormalBias: 0.03 },
  hemi: { sky: '#4f68aa', ground: '#2a3142', intensity: 1.55 },
  fog: { color: '#18213f', near: 15, far: 60 },
  exposure: 1.32,
  sky: {
    zenith: '#050c24', mid: '#122052', horizon: '#2b3d72', ground: '#121828', sun: '#dfe8ff',
    stars: 1.0, clouds: 0.25, glow: 0.4, disk: 0.6, cloudTint: [0.14, 0.18, 0.32],
  },
  env: { intensity: 0.4, ground: '#1a2030' },
  grade: { warm: [0.99, 1.0, 1.05], sat: 1.06, lift: [0.004, 0.006, 0.016], vignette: 0.3 },
  bloom: { strength: 0.55, radius: 0.55, threshold: 0.82 },
};
