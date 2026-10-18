// Pontos das animações escondidas desta fase (src/game/extras.js; docs/ARQUITETURA.md, "Extras"): E perto, de frente.
// Beber na poça do pé do bebedouro dos passarinhos e cheirar a lavanda do vaso do canto (com espirro).
/** @type {import('../../types').ExtraSpot[]} */
export default [
  { id: 'poca-bebedouro', kind: 'drink', x: 3.72, z: -0.3, r: 0.55 },
  { id: 'lavanda', kind: 'sneeze', x: 6.1, z: 3.7, r: 0.75, h: 0.45, particles: 'pollen', color: '#b49ae0' },
];
