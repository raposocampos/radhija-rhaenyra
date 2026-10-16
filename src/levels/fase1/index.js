// FASE 1 · Operação Cenoura — definição da fase (formato: tipo LevelDef, docs/ARQUITETURA.md §4.1).
// Cenário: ./world.js (sob demanda). Puzzle: ./puzzle.js.
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @import { LevelDef } from '../../types' */

/** @type {LevelDef} */
export default {
  id: 'fase1',
  number: 1,
  name: 'Operação Cenoura',
  subtitle: 'Fim de tarde no jardim',
  intro: 'A cenoura de brinquedo foi parar do outro lado da cerca. Tragam ela de volta para casa!',
  item: 'carrot', // ícone do item da fase na UI
  ambience: 'day', // som ambiente: 'day' | 'dusk' | 'night' | 'city' | 'rain'
  texts: {
    celebrate: 'Eba! A cenoura chegou em casa!',
    victoryTitle: 'Operação Cenoura concluída!',
    victorySub: 'Radhija e Rhaenyra trouxeram a cenoura de volta.',
  },
  layout,
  lighting: LIGHTING_DEFAULT,
  // Cenário fora do pacote inicial: baixado só quando a fase carrega.
  load: async () => ({ build: (await import('./world.js')).buildWorld }),
  createPuzzle,
};
