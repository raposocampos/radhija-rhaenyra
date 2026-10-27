// PANDORÓPOLIS — o mapa das fases (Jogar → Fases). Não é uma fase do catálogo: é o "lugar" de onde se escolhe a
// fase, andando livre com as duas numa cidadezinha em câmera isométrica (src/game/game.js: o hub). O cenário vem
// sob demanda (./world/index.js), como nas fases. Abre também por ?mapa (direto no mapa, para testes e prévias).
import layout from './layout.js';
import lighting from './lighting.js';
import { createPuzzle } from './puzzle.js';

/** @type {import('../../types').LevelDef<import('../../types').MapaProps>} */
export default {
  id: 'mapa',
  number: 0,
  name: 'Pandorópolis',
  subtitle: 'O mapa das fases',
  intro: 'Andem pela cidade até a bandeirinha de uma fase e apertem Entrar.',
  item: 'carrot',
  ambience: 'city',
  texts: { celebrate: '', victoryTitle: '', victorySub: '' },
  layout,
  lighting,
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,
};
