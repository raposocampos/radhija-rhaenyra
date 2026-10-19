// ARENA DO EMPURRÃO (fase de desenvolvimento, fora do menu) — DEFINIÇÃO. Abra com ?level=empurra&play.
// Treino do empurrão em pé da Rhaenyra: a arvorezinha com a bolinha nos galhos, a mesinha com o patinho e a estante
// baixa com o ursinho (cenário em world.js). Fica no pacote de desenvolvimento (dev.js), por isso o build é direto.
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { buildEmpurraWorld } from './world.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @import { LevelDef, EmpurraProps } from '../../types' */

/** @type {LevelDef<EmpurraProps>} */
export default {
  id: 'empurra',
  number: 0,
  name: 'Arena do Empurrão',
  subtitle: 'Protótipo',
  intro: 'A Rhaenyra tem mania de empurrar! Segure Shift de frente para a arvorezinha, a mesinha ou a estante: ela fica de pé, empurra três vezes e o que está lá em cima cai.',
  item: 'ball',
  ambience: 'day',
  texts: {
    celebrate: 'Que empurrão!',
    victoryTitle: 'Arena do Empurrão concluída!',
    victorySub: 'A Rhaenyra derrubou a bolinha da árvore e levou para casa.',
  },
  layout,
  lighting: LIGHTING_DEFAULT,
  build: buildEmpurraWorld,
  createPuzzle,
};
