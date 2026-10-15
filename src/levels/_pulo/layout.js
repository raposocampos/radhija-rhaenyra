// ARENA DO PULO (fase de desenvolvimento, fora do menu: ?level=pulo&play) — LAYOUT.
// Campo para sentir o pulo da Rhaenyra: dois troncos de treino, uma cerca de troncos que atravessa a arena
// (só a Rhaenyra passa, pulando) e, do outro lado, a bolinha e uma mureta alta que não dá para pular.
// Metros, Y para cima, Norte = -Z, câmera ao sul (mesmas convenções das fases).
import { DOGS as BASE_DOGS } from '../fase1/layout.js';

export const WORLD = { bounds: { minX: -5, maxX: 5, minZ: -4, maxZ: 4 } };

/** @type {(name: import('../../types').DogName, start: { x: number, z: number, yaw: number }) => import('../../types').DogStats} */
const withStart = (name, start) => ({ ...BASE_DOGS[name], start });
/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.0, z: -1.9, yaw: 1.2 }),
  rhaenyra: withStart('rhaenyra', { x: -3.7, z: -2.2, yaw: 1.2 }),
};

export const LOG_FENCE = { x: 1.0, hx: 0.15 }; // cerca de troncos (pulável) de norte a sul
export const TALL_WALL = { x: 2.7, zMin: 1.3, zMax: 4.5 }; // mureta alta (não pulável)
export const BALL = { x: 3.7, z: -2.0, pickupR: 0.55 };

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'limite-norte', shape: 'box', x: 0, z: -4.5, hx: 6, hz: 0.5 },
  { id: 'limite-sul', shape: 'box', x: 0, z: 4.5, hx: 6, hz: 0.5 },
  { id: 'limite-oeste', shape: 'box', x: -5.5, z: 0, hx: 0.5, hz: 5 },
  { id: 'limite-leste', shape: 'box', x: 5.5, z: 0, hx: 0.5, hz: 5 },
  // troncos de treino
  { id: 'tronco-treino-1', shape: 'box', x: -1.8, z: 1.4, hx: 0.6, hz: 0.13, jumpable: true, height: 0.26 },
  { id: 'tronco-treino-2', shape: 'box', x: -0.7, z: -1.5, hx: 0.13, hz: 0.55, jumpable: true, height: 0.26 },
  // cerca de troncos (atravessa a arena: sem pular, ninguém passa)
  { id: 'cerca-troncos', shape: 'box', x: LOG_FENCE.x, z: 0, hx: LOG_FENCE.hx, hz: 4.5, jumpable: true, height: 0.3 },
  // mureta alta: o pulo não passa
  { id: 'mureta-alta', shape: 'box', x: TALL_WALL.x, z: (TALL_WALL.zMin + TALL_WALL.zMax) / 2, hx: 0.1, hz: (TALL_WALL.zMax - TALL_WALL.zMin) / 2 },
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [{ id: 'osso-atras-da-mureta', x: 3.9, z: 3.1 }];
export const COLLECTIBLE_PICKUP_R = 0.42;

export const NAV_NODES = {
  W_home: { x: -3.1, z: -1.4 },
  W_mid: { x: -1.2, z: 0.2 },
  W_fence: { x: 0.4, z: 0.2 },
  E_fence: { x: 1.6, z: 0.2 },
  E_ball: { x: 3.4, z: -1.4 },
  E_wall: { x: 3.9, z: 0.6 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['W_home', 'W_mid'],
  ['W_mid', 'W_fence'],
  // A companheira não pula: a aresta exige uma flag que nunca liga (ela espera junto à cerca).
  ['W_fence', 'E_fence', { requires: 'jump' }],
  ['E_fence', 'E_ball'],
  ['E_fence', 'E_wall'],
  ['E_ball', 'E_wall'],
];

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: -3.6, z: -2.9, r: 0.9,
  celebrate: { radhija: { x: -3.2, z: -2.6 }, rhaenyra: { x: -4.0, z: -2.6 } },
  entryPoints: [{ x: -4.5, z: 0.8 }, { x: -1.6, z: -3.5 }],
};

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -3.5, maxX: 3.6, minZ: -3.2, maxZ: 2.6 },
  title: { center: { x: -2.5, z: -2.4 }, radius: 5.0, angle: 0.5, height: 2.0, look: { x: -2.8, y: 0.8, z: -2.6 } },
  celebrate: { pos: [-3.3, 1.3, 0.2], look: [-3.6, 0.34, -2.8] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = { WORLD, DOGS, LOG_FENCE, TALL_WALL, BALL, STATIC_COLLIDERS, COLLECTIBLES, COLLECTIBLE_PICKUP_R, NAV_NODES, NAV_EDGES, GOAL, CAMERA };
export default LAYOUT;
