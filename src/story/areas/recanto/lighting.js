// Recanto das Patinhas — iluminação (formato de LIGHTING_DEFAULT em src/core/engine.js).
// MANHÃ (a da carga e do jogo): sol baixo e dourado do leste, céu claro com neblina baixa e orvalho; a neblina rosada
// do horizonte esconde o fim da cidade. NOITE (só a abertura, "A noite da garoa"): a mesma direção de luz, fria e fraca
// como a lua por trás das nuvens, céu fechado, quase sem estrelas.
// A troca entre as duas acontece no preto da cena (src/story/scene/mood.js), mexendo só em cores e intensidades: as
// duas usam os mesmos programas da GPU (a sombra continua ligada nas duas, o mapa do ambiente é o da manhã).
import { SUN } from './layout.js';

/** @type {import('../../../types').LightingPreset} */
export const MORNING = {
  sun: { dir: SUN.direction, color: SUN.color, intensity: 2.7, shadowBias: -0.0004, shadowNormalBias: 0.028 },
  hemi: { sky: '#cfe0f4', ground: '#8f8a5c', intensity: 1.1 },
  fog: { color: '#e8d9cc', near: 18, far: 64 },
  exposure: 1.1,
  sky: {
    zenith: '#79a6d6', mid: '#b9d2ea', horizon: '#ffe0c2', ground: '#cdb89a', sun: '#fff1d6',
    stars: 0, clouds: 0.8, glow: 0.9, disk: 0.9, cloudTint: [1.0, 0.92, 0.84],
  },
  env: { intensity: 0.62, ground: '#7f8a52' },
  grade: { warm: [1.03, 1.0, 0.95], sat: 1.06, lift: [0.006, 0.005, 0.004], vignette: 0.22 },
  bloom: { strength: 0.25, radius: 0.55, threshold: 0.9 },
};

/** A noite da garoa (só cores e intensidades mudam em relação à manhã). */
export const NIGHT = {
  sun: { color: '#8ea6e8', intensity: 0.75 },
  hemi: { sky: '#3d4f86', ground: '#1f2433', intensity: 0.85 },
  fog: { color: '#141b33', near: 9, far: 38 },
  exposure: 1.25,
  sky: {
    zenith: '#060b1e', mid: '#111a3c', horizon: '#26305a', ground: '#0f1424', sun: '#c9d6ff',
    stars: 0.18, clouds: 1, glow: 0.25, disk: 0, cloudTint: [0.16, 0.19, 0.3],
  },
  env: { intensity: 0.18 },
  grade: { warm: [0.97, 1.0, 1.06], sat: 0.92, lift: [0.004, 0.006, 0.018], vignette: 0.34 },
  bloom: { strength: 0.5, radius: 0.55, threshold: 0.84 },
};

export default MORNING;
