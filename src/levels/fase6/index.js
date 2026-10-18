// Protótipo isolado: abrir ?level=fase6&play. Não pertence ao catálogo principal.
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @type {import('../../types').LevelDef<import('../../types').Fase6Props>} */
export default {
  id: 'fase6', number: 6, name: 'Expresso do Superbafo', subtitle: 'Uma oficina cheia de brinquedos',
  intro: 'A bolinha-planeta ficou no vagão! Um pulão muda o trilho. Um superbafo faz o trem espirrar. Vamos levar o planeta ao foguete?',
  item: 'ball', ambience: 'day',
  texts: { celebrate: 'O planeta chegou ao foguete!', victoryTitle: 'Expresso do Superbafo concluído!', victorySub: 'Um pulão, um atchim e duas irmãs trabalhando juntas.' },
  layout, lighting: LIGHTING_DEFAULT,
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,
};
