// Fase 9 da campanha (levels/index.js). Também abre por ?level=fase9&play.
// A maior fase antes da 10: quatro cômodos, três impulsos na parede, a escada de rodinhas, o duto do aquecedor e o
// gato do vovô dormindo em cima do livro.
import layout from './layout.js';
import lighting from './lighting.js';
import { createPuzzle } from './puzzle.js';

/** @type {import('../../types').LevelDef<import('../../types').Fase9Props>} */
export default {
  id: 'fase9', number: 9, name: 'Biblioteca do Vovô', subtitle: 'Noite de chuva na casa do vovô',
  intro: 'Chove lá fora e é hora da história. Mas o vovô esqueceu os óculos no alto da estante, e o Bichano dorme em cima do livro, lá no alto do armário do escritório. Será que as duas conseguem levar tudo até a mesinha da poltrona?',
  item: 'book', ambience: 'rain',
  texts: {
    celebrate: 'Óculos e livro na mesinha: hora da história!',
    victoryTitle: 'Biblioteca concluída!',
    victorySub: 'Uma escada de rodinhas, um duto cheiroso e um gato muito ofendido.',
  },
  layout, lighting,
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,
};
