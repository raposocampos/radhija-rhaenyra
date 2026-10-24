// ARENA DO BAFO (fase de desenvolvimento, fora do menu: ?level=bafo&play) — LAYOUT.
// Primeiro puzzle do superbafo, "o pombo e o portão":
//   1. A Rhaenyra empurra o VENTILADOR pelo trilho até o encaixe que mira a GRADE do corredor.
//   2. A Radhija entra no CORREDOR estreito (só ela cabe) e solta o superbafo na corrente de ar.
//   3. O vento leva a nuvem para o DUTO, que atravessa a mureta e sai ao lado do POLEIRO A.
//   4. O POMBO não aguenta o cheiro e voa para o POLEIRO B, que tem uma placa: o PORTÃO abre e trava.
//   5. A cenoura está do outro lado; levem-na para casa.
// Metros, Y para cima, Norte = -Z, câmera ao sul (mesmas convenções das fases).
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -5.5, maxX: 5.5, minZ: -4, maxZ: 4 } };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.6, z: -1.6, yaw: 1.2 }),
  rhaenyra: withStart('rhaenyra', { x: -4.2, z: -2.1, yaw: 1.2 }),
};

// Mureta alta que divide a arena (x = 1,2), com o portão no meio (abre para o leste).
export const WALL = { x: 1.2, half: 0.1, gapZ: 0.6 };
export const GATE = { hinge: { x: 1.2, z: 0.6 }, latchPost: { x: 1.2, z: -0.6 }, length: 1.2, closedYaw: 0, openYaw: -1.6, openTime: 0.9 };

// Corredor de manutenção (oeste): de x -1,7 a 1,1 em z = 2,4; entrada estreita no lado norte (x -0,65 a -0,15),
// virada para o centro da arena. Paredes baixas (0,35 m) para a câmera enxergar a Radhija lá dentro.
export const CORRIDOR = { x0: -1.7, x1: 1.1, z: 2.4, half: 0.32, door: { x0: -0.65, x1: -0.15 } };
// Duto: boca no fundo do corredor, sai do outro lado da mureta, soprando para o poleiro A. A boca abre para o oeste (o
// corredor e o vento): só engole o cheiro que chega pela frente dela. O pombo só sente o cheiro que veio pelo duto.
export const DUCT = {
  inlet: { x: 0.85, z: 2.4, r: 0.32, dirX: -1, dirZ: 0 },
  // exit: a nuvem sai pela boca da caixa da saída (que tem colisor), não de dentro dela
  outlet: { x: 1.65, z: 2.4, dirX: 1, dirZ: 0, speed: 1.3, exit: 0.25 },
  travel: 1.0,
};
// Ventilador num trilho norte–sul; sopra para o leste. Alinhado (encaixe) quando z = CORRIDOR.z.
export const FAN = {
  start: { x: -2.5, z: 0.4 }, half: 0.3, minX: -2.5, maxX: -2.5, minZ: 0.0, maxZ: 3.0, pushSpeed: 0.8,
  alignZ: 2.4, snap: 0.22,
  wind: { offset: 0.32, length: 3.4, halfWidth: 0.26, strength: 2.4 },
};
// Poleiros (altos: as dogs não alcançam). O pombo começa no A; o B tem a placa do portão.
export const PERCH_A = { x: 2.3, z: 2.4, y: 1.25, smellR: 0.55 };
export const PERCH_B = { x: 2.3, z: -2.2, y: 1.25 };
export const CARROT = { x: 4.2, z: 1.4, pickupR: 0.55 };

/** Parede fina ao longo de X, de x0 a x1 (extra: blocks, height…). @returns {import('../../types').BoxCollider} */
const wallSeg = (id, x0, x1, z, hz = 0.05, extra = {}) => ({ id, shape: 'box', x: (x0 + x1) / 2, z, hx: (x1 - x0) / 2, hz, ...extra });

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'limite-norte', shape: 'box', x: 0, z: -4.5, hx: 6.5, hz: 0.5 },
  { id: 'limite-sul', shape: 'box', x: 0, z: 4.5, hx: 6.5, hz: 0.5 },
  { id: 'limite-oeste', shape: 'box', x: -6.0, z: 0, hx: 0.5, hz: 5 },
  { id: 'limite-leste', shape: 'box', x: 6.0, z: 0, hx: 0.5, hz: 5 },
  // mureta (dois trechos; o portão fecha o meio)
  { id: 'mureta-norte', shape: 'box', x: WALL.x, z: (-4.5 - WALL.gapZ) / 2, hx: WALL.half, hz: (4.5 - WALL.gapZ) / 2 },
  { id: 'mureta-sul', shape: 'box', x: WALL.x, z: (4.5 + WALL.gapZ) / 2, hx: WALL.half, hz: (4.5 - WALL.gapZ) / 2 },
  // corredor: parede sul, parede norte com a entrada estreita, grade no oeste (o vento passa; as dogs não)
  wallSeg('corredor-sul', CORRIDOR.x0, CORRIDOR.x1, CORRIDOR.z + CORRIDOR.half, 0.05, { height: 0.35 }),
  wallSeg('corredor-norte-oeste', CORRIDOR.x0, CORRIDOR.door.x0, CORRIDOR.z - CORRIDOR.half, 0.05, { height: 0.35 }),
  wallSeg('corredor-norte-leste', CORRIDOR.door.x1, CORRIDOR.x1, CORRIDOR.z - CORRIDOR.half, 0.05, { height: 0.35 }),
  wallSeg('corredor-vao-grande', CORRIDOR.door.x0, CORRIDOR.door.x1, CORRIDOR.z - CORRIDOR.half, 0.05, { blocks: 'large' }),
  { id: 'grade', shape: 'box', x: CORRIDOR.x0 - 0.02, z: CORRIDOR.z, hx: 0.04, hz: CORRIDOR.half },
  // duto: a caixa da boca no fundo do corredor e a da saída do outro lado da mureta (world.js)
  { id: 'duto-boca', shape: 'box', x: DUCT.inlet.x + 0.08, z: DUCT.inlet.z, hx: 0.11, hz: 0.23 },
  { id: 'duto-saida', shape: 'box', x: DUCT.outlet.x, z: DUCT.outlet.z, hx: 0.12, hz: 0.18 },
  // postes dos poleiros
  { id: 'poleiro-a', shape: 'circle', x: PERCH_A.x, z: PERCH_A.z, r: 0.14 },
  { id: 'poleiro-b', shape: 'circle', x: PERCH_B.x, z: PERCH_B.z, r: 0.14 },
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [{ id: 'osso-canto-leste', x: 4.6, z: -3.0 }];
export const COLLECTIBLE_PICKUP_R = 0.42;

export const NAV_NODES = {
  W_home: { x: -3.8, z: -1.8 },
  W_fan: { x: -3.4, z: 1.2 },
  W_mid: { x: -1.5, z: -0.3 },
  W_door: { x: -0.4, z: 1.55 },
  C_in: { x: -0.4, z: 2.4 },
  W_gate: { x: 0.4, z: 0.0 },
  E_gate: { x: 2.0, z: 0.0 },
  E_carrot: { x: 3.7, z: 1.0 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['W_home', 'W_mid'],
  ['W_home', 'W_fan'],
  ['W_fan', 'W_mid'],
  ['W_mid', 'W_door'],
  ['W_door', 'C_in', { requires: 'small' }],
  ['W_mid', 'W_gate'],
  ['W_door', 'W_gate'],
  ['W_gate', 'E_gate', { requires: 'gateOpen' }],
  ['E_gate', 'E_carrot'],
];

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: -4.3, z: -3.0, r: 0.9,
  celebrate: { radhija: { x: -3.9, z: -2.6 }, rhaenyra: { x: -4.7, z: -2.6 } },
  entryPoints: [{ x: -5.0, z: 0.8 }, { x: -2.2, z: -3.5 }],
};

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -4.0, maxX: 4.0, minZ: -3.2, maxZ: 2.6 },
  title: { center: { x: -3.0, z: -2.4 }, radius: 5.0, angle: 0.5, height: 2.0, look: { x: -3.4, y: 0.8, z: -2.6 } },
  celebrate: { pos: [-4.0, 1.3, 0.2], look: [-4.3, 0.34, -2.8] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  WORLD, DOGS, WALL, GATE, CORRIDOR, DUCT, FAN, PERCH_A, PERCH_B, CARROT,
  STATIC_COLLIDERS, COLLECTIBLES, COLLECTIBLE_PICKUP_R, NAV_NODES, NAV_EDGES, GOAL, CAMERA,
};
export default LAYOUT;
