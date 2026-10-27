// Fase 10 da campanha (levels/index.js), a última da demo. Também abre por ?level=fase10&play.
// A maior fase: três cenários (a casa, a varanda com o quintal e o fundo do quintal), três enfeites para o bolo de
// aniversário de 3 anos das dogs e o enigma da ordem, com a pista no quadro da festa do ano passado.
import layout from './layout.js';
import extras from './extras.js';
import lighting from './lighting.js';
import { createPuzzle } from './puzzle.js';

/** @type {import('../../types').LevelDef<import('../../types').Fase10Props>} */
export default {
  id: 'fase10', number: 10, name: 'Festa no Quintal', subtitle: 'O aniversário de 3 anos das duas',
  intro: 'Hoje a Radhija e a Rhaenyra fazem 3 anos, e a festa está quase pronta no quintal. Só falta enfeitar o bolo: o laço, a vela do 3 e o chapeuzinho sumiram pelo quintal. E o bolo tem de ficar igualzinho ao do ano passado…',
  item: 'hat', ambience: 'dusk',
  texts: {
    celebrate: 'Parabéns, Radhija e Rhaenyra: 3 anos!',
    victoryTitle: 'Festa completa!',
    victorySub: 'Um balde na roldana, uma piscininha cheia e o bolo igualzinho ao do ano passado.',
  },
  layout, lighting,
  // o código do cenário e o que ele baixa da rede (a foto), antes da montagem e do aquecimento da GPU
  load: async () => {
    const world = await import('./world/index.js');
    await world.preloadWorld();
    return { build: world.buildWorld };
  },
  createPuzzle,
  extras,
};
