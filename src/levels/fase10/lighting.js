// FASE 10 · Fim de tarde virando noite no quintal — preset de iluminação (formato: LIGHTING_DEFAULT em src/core/engine.js).
// O sol baixo e alaranjado vem do oeste, bem de lado (sombras compridas no gramado); o céu passa do laranja no
// horizonte para o lilás e o azul lá em cima. As luzinhas da festa (quando o disjuntor liga), as lanternas e as
// janelas acesas da casa dão o calor da noite que chega.
import { SUN } from './layout.js';

export default {
  sun: { dir: SUN.direction, color: SUN.color, intensity: SUN.intensity, shadowBias: -0.0005, shadowNormalBias: 0.03 },
  hemi: { sky: '#9a8ac8', ground: '#5a4a34', intensity: 0.95 },
  fog: { color: '#5a4a6a', near: 22, far: 60 },
  exposure: 1.15,
  sky: {
    zenith: '#2a2e5a', mid: '#7a5c8a', horizon: '#f2a46a', ground: '#3a2e30', sun: '#ffc48a',
    stars: 0.25, clouds: 1, glow: 0.7, disk: 0.6, cloudTint: [0.95, 0.66, 0.6],
  },
  env: { intensity: 0.45, ground: '#5a4a34' },
  grade: { warm: [1.07, 1.0, 0.94], sat: 1.1, lift: [0.008, 0.005, 0.01], vignette: 0.26 },
  bloom: { strength: 0.6, radius: 0.55, threshold: 0.8 },
};
