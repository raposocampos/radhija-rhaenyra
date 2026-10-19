// ARENA DOS PORQUINHOS (fase de desenvolvimento, fora do menu) — DEFINIÇÃO. Abra com ?level=porcos&play.
// Quintal de teste do personagem novo da fase 10: o chiqueiro com três porquinhos, o botão que abre a porteira, o
// sininho que chama todos de volta e os legumes que distraem (milho, cenoura, aboborinha). Fica no pacote de
// desenvolvimento (dev.js), por isso o build é direto.
import layout from './layout.js';
import { createPuzzle } from './puzzle.js';
import { buildPorcosWorld } from './world.js';
import { LIGHTING_DEFAULT } from '../../core/engine.js';

/** @import { LevelDef, PorcosProps } from '../../types' */

/** @type {LevelDef<PorcosProps>} */
export default {
  id: 'porcos',
  number: 0,
  name: 'Arena dos Porquinhos',
  subtitle: 'Protótipo',
  intro: 'A bolinha caiu no chiqueiro! Pise no botão para abrir a porteira… e cuidado: os porquinhos adoram atrapalhar. Legumes distraem eles por um tempo.',
  item: 'ball',
  ambience: 'day',
  texts: {
    celebrate: 'Oinc! A bolinha voltou!',
    victoryTitle: 'Arena dos Porquinhos concluída!',
    victorySub: 'Os porquinhos ganharam lanche e a bolinha voltou para a caminha.',
  },
  layout,
  lighting: LIGHTING_DEFAULT,
  build: buildPorcosWorld,
  createPuzzle,
};
