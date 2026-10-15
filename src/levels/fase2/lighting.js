// FASE 2 · Crepúsculo — preset de iluminação (formato: LIGHTING_DEFAULT em src/core/engine.js).
// Sol recém-posto a oés-noroeste: luz baixa, quente e fraca; céu azul profundo com horizonte pêssego.
import { SUN } from './layout.js';

export default {
  sun: { dir: SUN.direction, color: SUN.color, intensity: SUN.intensity },
  hemi: { sky: '#8aa0d6', ground: '#5a4a50', intensity: 1.25 },
  fog: { color: '#6f7aa8', near: 11, far: 52 },
  exposure: 1.18,
  sky: {
    zenith: '#22356e', mid: '#5e72ae', horizon: '#ffb07e', ground: '#4c4560', sun: '#ffc79a',
    stars: 0.18, clouds: 0.75, glow: 0.8, disk: 0.0, cloudTint: [0.95, 0.62, 0.55],
  },
  env: { intensity: 0.55, ground: '#4a4a52' },
  grade: { warm: [1.0, 0.99, 1.04], sat: 1.06, lift: [0.004, 0.004, 0.012], vignette: 0.28 },
  bloom: { strength: 0.32, radius: 0.55, threshold: 0.86 },
};
