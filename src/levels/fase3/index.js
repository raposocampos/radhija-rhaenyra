// FASE 3 · Operação Pantufa — definição da fase (formato: docs/CONTRATO.md §4 "Definição de fase").
// Cenário: ./world/index.js (Agente Cenário). Puzzle: ./puzzle.js (Agente Mecânica).
import layout from './layout.js';
import lighting from './lighting.js';
import { buildWorld } from './world/index.js';
import { createPuzzle } from './puzzle.js';

export default {
  id: 'fase3',
  number: 3,
  name: 'Operação Pantufa',
  subtitle: 'Noite no jardim do lago',
  intro: 'A Dona Gansa levou a pantufa da tutora para a ilha do lago. Hora de uma missão noturna!',
  item: 'slipper',
  ambience: 'night',
  texts: {
    celebrate: 'Eba! A pantufa voltou para casa!',
    victoryTitle: 'Operação Pantufa concluída!',
    victorySub: 'A pantufa está salva — e a Dona Gansa ficou só no susto.',
  },
  layout,
  lighting,
  build: buildWorld,
  createPuzzle,
};
