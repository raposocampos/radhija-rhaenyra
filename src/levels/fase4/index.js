// FASE 4 · Operação Patinho — definição da fase (formato: tipo LevelDef, docs/ARQUITETURA.md §4.1).
// Primeira fase do superbafo da Radhija. Cenário: ./world/index.js. Puzzle: ./puzzle.js.
import layout from './layout.js';
import lighting from './lighting.js';
import { buildWorld } from './world/index.js';
import { createPuzzle } from './puzzle.js';

/** @import { LevelDef } from '../../types' */

/** @type {LevelDef} */
export default {
  id: 'fase4',
  number: 4,
  name: 'Operação Patinho',
  subtitle: 'Manhã no terraço do prédio',
  intro: 'O patinho de borracha caiu no terraço, bem no cantinho dos pombos. Hora de estrear o superbafo da Radhija!',
  item: 'duck',
  ambience: 'city',
  texts: {
    celebrate: 'Quén-quén! O patinho voltou para casa!',
    victoryTitle: 'Operação Patinho concluída!',
    victorySub: 'Os pombos ficaram de nariz torcido — e o patinho está salvo.',
  },
  layout,
  lighting,
  build: buildWorld,
  createPuzzle,
};
