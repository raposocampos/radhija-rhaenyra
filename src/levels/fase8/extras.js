// Pontos das animações escondidas desta fase (src/game/extras.js; docs/ARQUITETURA.md, "Extras"): E perto, de frente.
// Rolar de costas no chão, encostada na pilha de roupa do canto sudoeste (as roupinhas voam).
import { PILE } from './layout.js';

/** @type {import('../../types').ExtraSpot[]} */
export default [
  { id: 'pilha-de-roupa', kind: 'roll', x: PILE.x, z: PILE.z, r: PILE.r + 0.5, stand: { x: PILE.x + PILE.r + 0.3, z: PILE.z - 0.05 }, face: { x: PILE.x + PILE.r + 0.3, z: PILE.z - 1 } },
];
