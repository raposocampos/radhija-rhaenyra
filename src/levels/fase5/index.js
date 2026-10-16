// FASE 5 · Operação Ursinho — definição da fase (formato: tipo LevelDef, docs/ARQUITETURA.md §4.1).
// Primeira fase dentro de casa, feita para o pulo da Rhaenyra. Cenário: ./world/index.js. Puzzle: ./puzzle.js.
import layout from './layout.js';
import lighting from './lighting.js';
import { buildWorld } from './world/index.js';
import { createPuzzle } from './puzzle.js';

/** @import { LevelDef } from '../../types' */

/** @type {LevelDef} */
export default {
  id: 'fase5',
  number: 5,
  name: 'Operação Ursinho',
  subtitle: 'Tarde de chuva dentro de casa',
  intro: 'Chove lá fora e o ursinho sumiu para o outro lado da casa, no meio das caixas da mudança. Hora de a Rhaenyra mostrar o pulo!',
  item: 'bear',
  ambience: 'rain',
  texts: {
    celebrate: 'Eba! O ursinho voltou para a caminha!',
    victoryTitle: 'Operação Ursinho concluída!',
    victorySub: 'Portãozinho, caixas e toalha de mesa: nada segura essas duas.',
  },
  layout,
  lighting,
  build: buildWorld,
  createPuzzle,
};
