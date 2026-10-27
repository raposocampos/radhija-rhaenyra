// PANDORÓPOLIS — luz do mapa: fim de tarde dourado (o mesmo clima quente das fases), névoa bem longe (a câmera
// isométrica fica a ~24 m das dogs) e sombra do sol.
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @type {import('../../types').LightingPreset} */
export default {
  ...LIGHTING_DEFAULT,
  sun: { ...LIGHTING_DEFAULT.sun, dir: [-0.55, 0.62, 0.42], color: '#ffd6a0', intensity: 3.0, shadowBias: -0.0004, shadowNormalBias: 0.04 },
  hemi: { sky: '#c4dcf5', ground: '#8f8a52', intensity: 1.15 },
  fog: { color: '#cfe3ef', near: 70, far: 190 },
  exposure: 1.1,
  sky: { ...LIGHTING_DEFAULT.sky, horizon: '#ffe0b8', mid: '#b3d3ec', zenith: '#6aa3d8' },
  grade: { warm: [1.03, 1.0, 0.95], sat: 1.12, lift: [0.006, 0.004, 0.0], vignette: 0.18 },
};
