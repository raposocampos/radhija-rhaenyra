// MODELO DE FASE (não registrado no jogo) — DEFINIÇÃO. Ver docs/COMO-CRIAR-UMA-FASE.md.
// Usa o cenário provisório em blocos (_placeholder.js); troque por um world/ de verdade, carregado sob demanda
// com `load` (docs/COMO-CRIAR-UMA-FASE.md §8).
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { buildPlaceholderWorld } from '../_placeholder.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @import { LevelDef } from '../../types' */

/** @type {LevelDef} */
export default {
  id: 'modelo',
  number: 4,
  name: 'Operação Osso',
  subtitle: 'Manhã no quintal',
  intro: 'A bolinha caiu do outro lado da mureta. Trabalho em equipe!',
  item: 'ball',
  ambience: 'day',
  texts: {
    celebrate: 'Eba! A bolinha voltou!',
    victoryTitle: 'Operação Osso concluída!',
    victorySub: 'Mais uma para a coleção.',
  },
  layout,
  lighting: LIGHTING_DEFAULT,
  build: ({ root }) => buildPlaceholderWorld({ root, layout }),
  createPuzzle,
};
