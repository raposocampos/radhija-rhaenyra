// Pontos das animações escondidas desta fase (src/game/extras.js; docs/ARQUITETURA.md, "Extras"): E perto, de frente.
// Comer no pote de ração e beber no de água da cozinha, cheirar as flores do canteiro do quintal (espirro), cavar no canteiro de terra fofa
// e rolar no gramado macio.
import { DOG_BOWLS, FLOWER_BED, PICNIC } from './layout.js';

/** @type {import('../../types').ExtraSpot[]} */
export default [
  { id: 'racao', kind: 'eat', x: DOG_BOWLS.x - 0.15, z: DOG_BOWLS.z, r: 0.55, stand: { x: DOG_BOWLS.x - 0.15, z: DOG_BOWLS.z + 0.34 }, face: { x: DOG_BOWLS.x - 0.15, z: DOG_BOWLS.z }, color: '#9a5a2a' },
  { id: 'agua', kind: 'drink', x: DOG_BOWLS.x + 0.15, z: DOG_BOWLS.z, r: 0.55, stand: { x: DOG_BOWLS.x + 0.15, z: DOG_BOWLS.z + 0.34 }, face: { x: DOG_BOWLS.x + 0.15, z: DOG_BOWLS.z }, color: '#9cc8e8' },
  { id: 'flores', kind: 'sneeze', x: FLOWER_BED.x, z: FLOWER_BED.z, r: FLOWER_BED.hx + 0.35, face: { x: FLOWER_BED.x, z: FLOWER_BED.z }, h: 0.3, particles: 'pollen', color: '#ffd0e0' },
  { id: 'terra-fofa', kind: 'dig', x: 1.6, z: 3.55, r: 0.55, color: '#8a6a48' },
  { id: 'gramado', kind: 'roll', x: PICNIC.x + 1.6, z: PICNIC.z + 0.9, r: 0.6, stand: { x: PICNIC.x + 1.6, z: PICNIC.z + 0.9 }, face: { x: PICNIC.x + 1.6, z: PICNIC.z - 0.1 } },
];
