// ARENA DO PULO (fase de desenvolvimento, fora do menu) — DEFINIÇÃO. Abra com ?level=pulo&play.
// Usa o cenário provisório em blocos (_placeholder.js): troncos puláveis aparecem como toras.
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { buildPlaceholderWorld } from '../_placeholder.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @import { LevelDef } from '../../types' */

/** @type {LevelDef} */
export default {
  id: 'pulo',
  number: 0,
  name: 'Arena do Pulo',
  subtitle: 'Protótipo',
  intro: 'Teste o pulo da Rhaenyra: troncos dá para pular; muretas altas, não.',
  item: 'ball',
  ambience: 'day',
  texts: {
    celebrate: 'Que pulo!',
    victoryTitle: 'Arena do Pulo concluída!',
    victorySub: 'A Rhaenyra pulou a cerca e trouxe a bolinha.',
  },
  layout,
  lighting: LIGHTING_DEFAULT,
  build: ({ root }) => buildPlaceholderWorld({ root, layout }),
  createPuzzle,
};
