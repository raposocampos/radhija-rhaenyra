// Recanto das Patinhas — iluminação (formato de LIGHTING_DEFAULT em src/core/engine.js).
// MANHÃ (a da carga e do jogo): sol baixo e dourado do leste, céu claro com neblina baixa e orvalho; a neblina rosada
// do horizonte esconde o fim da cidade. O sol é forte e quente e o preenchimento (hemisfério e mapa do ambiente) mais
// fraco e azulado: a sombra fica marcada e fria, o sol, cor de mel (o contraste das maquetes de "It Takes Two").
// NOITE (só a abertura, "A noite da garoa"): a mesma direção de luz, fria e fraca como a lua por trás das nuvens, céu
// fechado, quase sem estrelas.
// A troca entre as duas acontece no preto da cena (src/story/scene/mood.js), mexendo só em cores e intensidades: as
// duas usam os mesmos programas da GPU (a sombra continua ligada nas duas, o mapa do ambiente é o da manhã).
import { SUN } from './layout.js';

/** @type {import('../../../types').LightingPreset} */
export const MORNING = {
  // o sol: mais quente que o do layout (mel, não creme) e mais forte; o viés da sombra é o de antes
  sun: { dir: SUN.direction, color: '#ffcf96', intensity: 3.25, shadowBias: -0.0004, shadowNormalBias: 0.028 },
  // o preenchimento: céu azul de verdade por cima (as sombras puxam para o azul) e o chão de grama e terra, quente
  hemi: { sky: '#a9c6ee', ground: '#9a8656', intensity: 0.92 },
  // a neblina rosada do horizonte: pêssego com um quê de rosa, começando um pouco mais longe (o meio do condomínio
  // fica nítido) e fechando antes da cidade acabar
  fog: { color: '#efd5cb', near: 20, far: 66 },
  exposure: 1.06,
  sky: {
    zenith: '#6b9fd8', mid: '#b4d0ee', horizon: '#ffd7c4', ground: '#d6b9a0', sun: '#fff0d2',
    stars: 0, clouds: 0.8, glow: 1.0, disk: 0.9, cloudTint: [1.0, 0.9, 0.86],
  },
  env: { intensity: 0.5, ground: '#7f8a52' },
  // mais saturação e um contraste leve: as sombras descem um pouco (lift menor) e o quente sobe nos realces
  grade: { warm: [1.04, 1.0, 0.94], sat: 1.13, lift: [0.002, 0.003, 0.006], vignette: 0.24 },
  bloom: { strength: 0.26, radius: 0.55, threshold: 0.9 },
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
