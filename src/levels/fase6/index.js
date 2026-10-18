// Fase 6 da campanha (levels/index.js). O link do tempo de protótipo, ?level=fase6&play, continua abrindo esta fase.
import layout from './layout.js';
import extras from './extras.js';
import lighting from './lighting.js';
import { createPuzzle } from './puzzle.js';

/** @type {import('../../types').LevelDef<import('../../types').Fase6Props>} */
export default {
  id: 'fase6', number: 6, name: 'Expresso do Superbafo', subtitle: 'Uma oficina cheia de brinquedos',
  intro: 'A bolinha-planeta ficou no vagão! Um pulão muda o trilho. Um superbafo faz o trem espirrar. Vamos levar o planeta ao foguete?',
  item: 'ball', ambience: 'day',
  texts: { celebrate: 'Planeta e lua a bordo: o foguete decolou!', victoryTitle: 'Expresso do Superbafo concluído!', victorySub: 'Pulões, atchins, uma cancela segura e duas irmãs trabalhando juntas.' },
  layout, lighting,
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,
  extras,
};
