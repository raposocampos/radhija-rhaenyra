// FASE 3 · Operação Pantufa — definição da fase (formato: tipo LevelDef, docs/ARQUITETURA.md §4.1).
// Cenário: ./world/index.js (sob demanda). Puzzle: ./puzzle.js.
import layout from './layout.js';
import lighting from './lighting.js';
import { createPuzzle } from './puzzle.js';

/** @import { LevelDef, Fase3Props } from '../../types' */

/** @type {LevelDef<Fase3Props>} */
export default {
  id: 'fase3',
  number: 3,
  name: 'Operação Pantufa',
  subtitle: 'Noite no jardim do lago',
  intro: 'A Dona Gansa levou a pantufa da tutora para a ilha do lago. Hora de uma missão noturna!',
  item: 'slipper',
  ambience: 'night',
  texts: {
    celebrate: 'Eba! A pantufa voltou para casa!',
    victoryTitle: 'Operação Pantufa concluída!',
    victorySub: 'A pantufa está salva — e a Dona Gansa ficou só no susto.',
  },
  layout,
  lighting,
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,
};
