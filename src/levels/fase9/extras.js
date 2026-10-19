// Pontos das animações escondidas desta fase (src/game/extras.js; docs/ARQUITETURA.md, "Extras"): E perto, de frente.
// Beber na poça do guarda-chuva do hall, cheirar a samambaia do jardim de inverno (espirro) e rolar no tapete persa
// na frente da lareira.
import { UMBRELLA_STAND, POTS, RUG } from './layout.js';

/** @type {import('../../types').ExtraSpot[]} */
export default [
  { id: 'poca-guarda-chuva', kind: 'drink', x: UMBRELLA_STAND.x + 0.22, z: UMBRELLA_STAND.z + 0.22, r: 0.55, color: '#9cc0d8' },
  { id: 'samambaia', kind: 'sneeze', x: POTS[0].x, z: POTS[0].z, r: POTS[0].r + 0.5, face: { x: POTS[0].x, z: POTS[0].z }, h: 0.45, particles: 'pollen', color: '#c8e08a' },
  { id: 'tapete', kind: 'roll', x: RUG.x + 0.35, z: RUG.z - 0.15, r: 0.55, stand: { x: RUG.x + 0.35, z: RUG.z - 0.15 }, face: { x: RUG.x + 0.35, z: RUG.z - 1.15 } },
];
