// Fase 8 da campanha (levels/index.js). Também abre por ?level=fase8&play.
// Apresenta o impulso na parede da Rhaenyra: dois botões no alto, uma meia no varal e uma mantinha em cima da máquina.
import layout from './layout.js';
import lighting from './lighting.js';
import { createPuzzle } from './puzzle.js';

/** @type {import('../../types').LevelDef<import('../../types').Fase8Props>} */
export default {
  id: 'fase8', number: 8, name: 'Lavanderia de Domingo', subtitle: 'Manhã de sol na área de serviço',
  intro: 'Domingo é dia de lavar roupa! A meia listrada ficou presa lá no alto do varal e a mantinha da Rhaenyra está em cima da máquina. Na parede com patinhas, a Rhaenyra pega impulso e alcança os botões. Bora buscar as duas para a caminha?',
  item: 'sock', ambience: 'day',
  texts: {
    celebrate: 'Meia e mantinha na caminha!',
    victoryTitle: 'Lavanderia concluída!',
    victorySub: 'Dois impulsos na parede, uma arrancada no varal e um cesto com rodinhas.',
  },
  layout, lighting,
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,
};
