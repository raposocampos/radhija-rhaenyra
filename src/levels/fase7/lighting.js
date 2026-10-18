// FASE 7 · Manhã depois da chuva na pracinha — preset de iluminação (formato: LIGHTING_DEFAULT em
// src/core/engine.js). Sol ainda baixo vindo do leste-sudeste entre nuvens que vão embora, céu lavado e
// ar úmido (névoa clara ao longe). O chão molhado reflete o céu (env mais forte que nas fases secas).
import { SUN } from './layout.js';

export default {
  sun: { dir: SUN.direction, color: SUN.color, intensity: SUN.intensity, shadowBias: -0.0005, shadowNormalBias: 0.03 },
  hemi: { sky: '#cfe2f2', ground: '#6f7f4c', intensity: 1.25 },
  fog: { color: '#dbe6ea', near: 16, far: 46 },
  exposure: 1.08,
  sky: {
    zenith: '#6f9fd2', mid: '#a9c9e6', horizon: '#e9eef0', ground: '#b9c2a4', sun: '#fff6e2',
    stars: 0, clouds: 1, glow: 0.55, disk: 0.6, cloudTint: [0.98, 0.98, 1.0],
  },
  env: { intensity: 0.7, ground: '#6a7552' },
  grade: { warm: [1.0, 1.0, 1.0], sat: 1.08, lift: [0.004, 0.005, 0.007], vignette: 0.22 },
  bloom: { strength: 0.28, radius: 0.5, threshold: 0.86 },
};
