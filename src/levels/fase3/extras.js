// Pontos das animações escondidas desta fase (src/game/extras.js; docs/ARQUITETURA.md, "Extras"): E perto, de frente.
// Beber água na beirinha do lago, de frente para a ilha: um ponto por bacia do anel de água.
import { POND, ISLAND } from './layout.js';

/** @type {import('../../types').ExtraSpot[]} */
export default POND.ring.map((c, i) => ({
  id: `lago-${i + 1}`, kind: /** @type {const} */ ('drink'), x: c.x, z: c.z, r: c.r + 0.45, face: { x: ISLAND.x, z: ISLAND.z }, color: '#7fb6d8',
}));
