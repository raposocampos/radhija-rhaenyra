// Fase de desenvolvimento: abrir ?level=fase7&play. Fora do catálogo principal enquanto é protótipo.
// Apresenta o Lambe-Lambe da Rhaenyra (R / L2 perto da irmã) e a lama que deixa a Radhija lenta e sem arrancada.
import layout from './layout.js';
import lighting from './lighting.js';
import { createPuzzle } from './puzzle.js';

/** @type {import('../../types').LevelDef<import('../../types').Fase7Props>} */
export default {
  id: 'fase7', number: 7, name: 'Lambe-Lambe na Pracinha', subtitle: 'Manhã depois da chuva',
  intro: 'Choveu a noite toda e a pracinha virou um lamaçal! A bolinha caiu no parquinho e o frisbee parou lá no alto do escorregador. Bora buscar os dois para o piquenique?',
  item: 'frisbee', ambience: 'day',
  texts: {
    celebrate: 'Bolinha e frisbee no piquenique!',
    victoryTitle: 'Pracinha concluída!',
    victorySub: 'Um túnel de lama, um Lambe-Lambe caprichado e uma descida de escorregador.',
  },
  layout, lighting,
  load: async () => ({ build: (await import('./world/index.js')).buildWorld }),
  createPuzzle,
};
