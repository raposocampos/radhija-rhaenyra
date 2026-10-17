// ARENA DO BAFO (fase de desenvolvimento, fora do menu) — DEFINIÇÃO. Abra com ?level=bafo&play.
// Primeiro puzzle do superbafo da Radhija ("o pombo e o portão"), com cenário provisório.
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { buildBafoWorld } from './world.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @import { LevelDef, BafoProps } from '../../types' */

/** @type {LevelDef<BafoProps>} */
export default {
  id: 'bafo',
  number: 0,
  name: 'Arena do Bafo',
  subtitle: 'Protótipo',
  intro: 'O pombo está guardando o portão. Um ventilador, um duto e um superbafo da Radhija devem resolver…',
  item: 'carrot',
  ambience: 'day',
  texts: {
    celebrate: 'Eba! O bafo salvou o dia!',
    victoryTitle: 'Arena do Bafo concluída!',
    victorySub: 'O pombo voou, o portão abriu e a cenoura voltou para casa.',
  },
  layout,
  lighting: LIGHTING_DEFAULT,
  build: buildBafoWorld,
  createPuzzle,
};
