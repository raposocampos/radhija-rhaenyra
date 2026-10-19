// FASE 9 · Noite de chuva na casa do vovô — preset de iluminação (formato: LIGHTING_DEFAULT em src/core/engine.js).
// O "sol" é o luar frio e fraco que entra por cima da maquete (sem teto), com sombra suave. O calor vem das luzes
// da casa que o cenário acende: o fogo da lareira (tremendo), o abajur da poltrona, a luminária da escrivaninha e a
// arandela do hall. Lá fora (acima das paredes e atrás das vidraças) é um céu de chuva escuro e azulado.
import { SUN } from './layout.js';

export default {
  sun: { dir: SUN.direction, color: SUN.color, intensity: SUN.intensity, shadowBias: -0.0005, shadowNormalBias: 0.03 },
  hemi: { sky: '#7d8cb4', ground: '#5a4232', intensity: 1.05 },
  fog: { color: '#1b2030', near: 18, far: 50 },
  exposure: 1.2,
  sky: {
    zenith: '#0b1020', mid: '#182035', horizon: '#2c3550', ground: '#15171e', sun: '#8d9bc0',
    stars: 0, clouds: 1, glow: 0.12, disk: 0, cloudTint: [0.22, 0.25, 0.33],
  },
  env: { intensity: 0.35, ground: '#4a3628' },
  grade: { warm: [1.06, 1.0, 0.94], sat: 1.06, lift: [0.006, 0.005, 0.008], vignette: 0.32 },
  bloom: { strength: 0.5, radius: 0.55, threshold: 0.82 },
};
