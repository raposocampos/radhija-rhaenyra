// Pontos das animações escondidas desta fase (src/game/extras.js; docs/ARQUITETURA.md, "Extras"): E perto, de frente.
// Rolar na pilha de roupa do canto sudoeste (sobe nela, rola de costas e desce).
import { PILE } from './layout.js';

/** @type {import('../../types').ExtraSpot[]} */
export default [
  { id: 'pilha-de-roupa', kind: 'roll', x: PILE.x, z: PILE.z, r: PILE.r + 0.45, stand: { x: PILE.x, z: PILE.z }, face: { x: PILE.x + 1, z: PILE.z }, y: 0.12 },
];
