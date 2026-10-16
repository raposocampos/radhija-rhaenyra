// FASE 5 · Tarde de chuva dentro de casa — preset de iluminação (formato: LIGHTING_DEFAULT em
// src/core/engine.js). A "luz do sol" é a claridade fria e difusa de um dia nublado, quase de cima
// (a maquete não tem teto) e fraca; o calor vem das luzes da casa (abajur da sala, pendente da cozinha,
// arandela do corredor), que o cenário acende. Lá fora (acima das paredes) é um céu de chuva escuro.
import { SUN } from './layout.js';

export default {
  sun: { dir: SUN.direction, color: SUN.color, intensity: SUN.intensity, shadowBias: -0.0005, shadowNormalBias: 0.03 },
  hemi: { sky: '#aab6cf', ground: '#7a5f4a', intensity: 1.3 },
  fog: { color: '#2b303a', near: 16, far: 46 },
  exposure: 1.18,
  sky: {
    zenith: '#20252f', mid: '#353c49', horizon: '#4d5563', ground: '#22252b', sun: '#9aa3b4',
    stars: 0, clouds: 1, glow: 0.15, disk: 0, cloudTint: [0.35, 0.38, 0.44],
  },
  env: { intensity: 0.45, ground: '#5a4636' },
  grade: { warm: [1.04, 1.0, 0.95], sat: 1.05, lift: [0.006, 0.004, 0.004], vignette: 0.3 },
  bloom: { strength: 0.42, radius: 0.55, threshold: 0.85 },
};
