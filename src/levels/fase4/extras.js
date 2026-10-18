// Pontos das animações escondidas desta fase (src/game/extras.js; docs/ARQUITETURA.md, "Extras"): E perto, de frente.
// Cheirar as flores das floreiras (com espirro): dos dois lados, nos dois trechos.
import { PLANTERS } from './layout.js';

/** @type {import('../../types').ExtraSpot[]} */
export default [-2.4, -1.0, 2.0, 3.0].map((z, i) => ({
  id: `floreira-${i + 1}`, kind: /** @type {const} */ ('sneeze'), x: PLANTERS.x, z, r: 0.8, h: PLANTERS.height, particles: 'pollen', color: '#ffd36b',
}));
