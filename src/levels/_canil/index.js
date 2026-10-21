// CANIL DAS DOGS (fase de desenvolvimento, fora do menu) — DEFINIÇÃO. Abra com ?level=canil&play.
// Bancada da troca dos modelos das cachorrinhas: a vitrine mostra o modelo atual e o novo (src/dogs/v2/) lado a lado
// em todas as poses. O modelo novo é o padrão das fases; para jogar com o anterior: ?level=1&play&dogs=atual.
// Fica no pacote de desenvolvimento (dev.js), por isso o build é direto.
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { buildCanilWorld } from './world.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @import { LevelDef } from '../../types' */

/** @type {LevelDef<import('./display.js').CanilProps>} */
export default {
  id: 'canil',
  number: 0,
  name: 'Canil das Dogs',
  subtitle: 'Modelos novos',
  intro: 'A vitrine mostra a Radhija e a Rhaenyra no modelo atual e no novo, lado a lado. Escolha a pose no painel; as dogs do jogo andam por aqui como sempre.',
  item: 'ball',
  ambience: 'day',
  texts: {
    celebrate: 'Que dogs!',
    victoryTitle: 'Canil das Dogs',
    victorySub: 'Comparação dos modelos.',
  },
  layout,
  lighting: LIGHTING_DEFAULT,
  build: buildCanilWorld,
  createPuzzle,
};
