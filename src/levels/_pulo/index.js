// ARENA DO PULO (fase de desenvolvimento, fora do menu) — DEFINIÇÃO. Abra com ?level=pulo&play.
// Cenário provisório em blocos (_placeholder.js: troncos puláveis viram toras) com a parede de treino do impulso
// na parede (world.js). Fica no pacote de desenvolvimento (dev.js), por isso o build é direto.
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { buildPuloWorld } from './world.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @import { LevelDef, PuloProps } from '../../types' */

/** @type {LevelDef<PuloProps>} */
export default {
  id: 'pulo',
  number: 0,
  name: 'Arena do Pulo',
  subtitle: 'Protótipo',
  intro: 'Teste o pulo da Rhaenyra: troncos dá para pular; muretas altas, não. Na parede com patinhas pintadas, o pulo vira impulso para alcançar o botão e a alavanca.',
  item: 'ball',
  ambience: 'day',
  texts: {
    celebrate: 'Que pulo!',
    victoryTitle: 'Arena do Pulo concluída!',
    victorySub: 'A Rhaenyra pulou a cerca e trouxe a bolinha.',
  },
  layout,
  lighting: LIGHTING_DEFAULT,
  build: buildPuloWorld,
  createPuzzle,
};
