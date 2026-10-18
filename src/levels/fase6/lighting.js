// FASE 6 · Fim de tarde ensolarado dentro da oficina — preset de iluminação (formato: LIGHTING_DEFAULT em
// src/core/engine.js). O "sol" entra quente pelo alto e pelo sudoeste (a maquete não tem teto), com sombras
// suaves; as luminárias e a claridade das janelas são PointLights quentes do cenário. Acima das paredes, um
// céu claro de fim de tarde.
import { SUN } from './layout.js';

export default {
  sun: { dir: SUN.direction, color: SUN.color, intensity: SUN.intensity, shadowBias: -0.0005, shadowNormalBias: 0.03 },
  hemi: { sky: '#d3dff0', ground: '#9a7454', intensity: 1.2 },
  fog: { color: '#e9d3b6', near: 18, far: 52 },
  exposure: 1.1,
  sky: {
    zenith: '#79a5d6', mid: '#b8d1e6', horizon: '#ffdcae', ground: '#d8b892', sun: '#fff2d6',
    stars: 0, clouds: 1, glow: 0.8, disk: 0, cloudTint: [1.0, 0.9, 0.8],
  },
  env: { intensity: 0.55, ground: '#8a6a4a' },
  grade: { warm: [1.04, 1.0, 0.94], sat: 1.06, lift: [0.006, 0.004, 0.002], vignette: 0.26 },
  bloom: { strength: 0.3, radius: 0.55, threshold: 0.88 },
};
