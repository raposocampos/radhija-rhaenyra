// MODO HISTÓRIA · Capítulo 1 · Cadê a Cenoura? — o Recanto das Patinhas (a fatia jogável, etapa 2).
// Não é uma fase do catálogo: o núcleo carrega como a área da história (src/game/game.js, índice STORY), com a abertura
// "A noite da garoa" e a missão do capítulo (docs/HISTORIA.md). O cenário vem sob demanda (./world/index.js), como nas
// fases; layout, iluminação e puzzle ficam estáticos (os testes em Node usam sem o cenário).
import layout from './layout.js';
import { MORNING } from './lighting.js';
import { createPuzzle } from './puzzle.js';

/** @type {import('../../../types').LevelDef<any> & { story: { chapter: number, music: string } }} */
export default {
  id: 'recanto',
  number: 1,
  name: 'Cadê a Cenoura?',
  subtitle: 'Recanto das Patinhas',
  intro: '',
  item: 'carrot',
  ambience: 'day',
  texts: { celebrate: '', victoryTitle: '', victorySub: '' },
  layout,
  lighting: MORNING,
  story: { chapter: 1, music: 'recanto' },
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,
};
