// FASE 2 · Operação Bolinha — definição da fase (formato: tipo LevelDef, docs/ARQUITETURA.md §4.1).
// Cenário: ./world/index.js (sob demanda). Puzzle: ./puzzle.js.
import layout from './layout.js';
import extras from './extras.js';
import lighting from './lighting.js';
import { createPuzzle } from './puzzle.js';

/** @import { LevelDef, Fase2Props } from '../../types' */

/** @type {LevelDef<Fase2Props>} */
export default {
  id: 'fase2',
  number: 2,
  name: 'Operação Bolinha',
  subtitle: 'Crepúsculo na área de serviço',
  intro: 'A bolinha de tênis voou por cima da mureta e caiu do outro lado do canal. Bora buscar antes de escurecer!',
  item: 'ball',
  ambience: 'dusk',
  texts: {
    celebrate: 'Eba! A bolinha voltou para a caminha!',
    victoryTitle: 'Operação Bolinha concluída!',
    victorySub: 'A bolinha está de volta, sequinha e babada.',
  },
  layout,
  lighting,
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,
  extras,
};
