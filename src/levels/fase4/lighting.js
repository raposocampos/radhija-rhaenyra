// FASE 4 · Manhã — preset de iluminação (formato: LIGHTING_DEFAULT em src/core/engine.js).
// Sol baixo de manhã a leste-sudeste (dourado claro, sombras longas para o noroeste), céu azul limpo com
// horizonte leitoso de cidade e um pouco de névoa azulada nos prédios do fundo.
import { SUN } from './layout.js';

export default {
  sun: { dir: SUN.direction, color: SUN.color, intensity: SUN.intensity, shadowBias: -0.0004, shadowNormalBias: 0.025 },
  hemi: { sky: '#b9d6f5', ground: '#a08c74', intensity: 1.15 },
  fog: { color: '#cfdcea', near: 18, far: 80 },
  exposure: 1.1,
  sky: {
    zenith: '#3f7fd0', mid: '#8fbbe6', horizon: '#f4e6d2', ground: '#c9b9a6', sun: '#fff6df',
    stars: 0, clouds: 0.7, glow: 0.7, disk: 1, cloudTint: [1.0, 0.95, 0.88],
  },
  env: { intensity: 0.65, ground: '#8f8478' },
  grade: { warm: [1.02, 1.0, 0.97], sat: 1.06, lift: [0.004, 0.004, 0.006], vignette: 0.22 },
  bloom: { strength: 0.2, radius: 0.5, threshold: 0.92 },
};
