// Pontos das animações escondidas desta fase (src/game/extras.js; docs/ARQUITETURA.md, "Extras"): E perto, de frente.
// Andar no balanço (os dois assentos) e cavar na caixa de areia (pula para dentro pela borda sul ou norte e volta).
import { SWINGS, SANDBOX } from './layout.js';

/** @type {import('../../types').ExtraSpot[]} */
export default [
  ...SWINGS.seats.map((ox, i) => ({ id: `balanco-${i + 1}`, kind: /** @type {const} */ ('swing'), x: SWINGS.x + ox, z: SWINGS.z, r: 0.75, seat: i })),
  { id: 'areia-sul', kind: 'dig', x: SANDBOX.x, z: SANDBOX.z + SANDBOX.hz, r: 0.55, hop: true, stand: { x: SANDBOX.x, z: SANDBOX.z + 0.18 }, face: { x: SANDBOX.x, z: SANDBOX.z - 0.4 }, color: '#e6cf98' },
  { id: 'areia-norte', kind: 'dig', x: SANDBOX.x, z: SANDBOX.z - SANDBOX.hz, r: 0.55, hop: true, stand: { x: SANDBOX.x, z: SANDBOX.z - 0.18 }, face: { x: SANDBOX.x, z: SANDBOX.z + 0.4 }, color: '#e6cf98' },
];
