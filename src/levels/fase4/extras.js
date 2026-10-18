// Pontos das animações escondidas desta fase (src/game/extras.js; docs/ARQUITETURA.md, "Extras"): E perto, de frente.
// Cheirar as flores das floreiras (com espirro): dos dois lados, nos dois trechos.
import { PLANTERS } from './layout.js';

/** @type {import('../../types').ExtraSpot[]} */
export default [-2.4, -1.0, 2.0, 3.0].flatMap((z, i) => [1, -1].map((side) => ({
  id: `floreira-${i + 1}${side > 0 ? 'l' : 'o'}`, kind: /** @type {const} */ ('sneeze'), x: PLANTERS.x + side * (PLANTERS.half + 0.3), z, r: 0.5,
  face: { x: PLANTERS.x, z }, h: PLANTERS.height, particles: 'pollen', color: '#ffd36b',
})));
