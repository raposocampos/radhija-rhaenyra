// FASE 8 · Manhã de domingo na lavanderia — preset de iluminação (formato: LIGHTING_DEFAULT em
// src/core/engine.js). O sol vem do norte (de trás da parede do fundo, como no inverno daqui): a parede faz a
// sombra e a janela desenha um retângulo de sol no chão. O resto é a claridade azulada do céu limpo, que entra
// por cima da maquete (sem teto); o cenário acende uma luz quente perto da caminha e o brilho da janela.
import { SUN } from './layout.js';

export default {
  sun: { dir: SUN.direction, color: SUN.color, intensity: SUN.intensity, shadowBias: -0.0005, shadowNormalBias: 0.03 },
  hemi: { sky: '#cfdff0', ground: '#9a7a58', intensity: 0.95 },
  fog: { color: '#d9e6f2', near: 18, far: 52 },
  exposure: 0.98,
  sky: {
    zenith: '#5f9bd8', mid: '#8fbde6', horizon: '#d6e8f4', ground: '#b9a68e', sun: '#fff3dc',
    stars: 0, clouds: 0.35, glow: 0.4, disk: 0.6, cloudTint: [1.0, 0.98, 0.95],
  },
  env: { intensity: 0.5, ground: '#9a7a58' },
  grade: { warm: [1.05, 1.01, 0.95], sat: 1.06, lift: [0.004, 0.004, 0.006], vignette: 0.26 },
  bloom: { strength: 0.32, radius: 0.55, threshold: 0.92 },
};
