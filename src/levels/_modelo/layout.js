// MODELO DE FASE (não registrado no jogo) — LAYOUT. Ponto de partida para fases novas: copie a pasta
// src/levels/_modelo/ e siga docs/COMO-CRIAR-UMA-FASE.md. Testado por test/modelo-fase.test.mjs.
// Metros, Y para cima, Norte = -Z, câmera ao sul. Mureta norte-sul em x = 0 com um portão;
// a placa (só a Rhaenyra pesa) abre o portão; a bolinha está do lado leste; o objetivo, a oeste.
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -5, maxX: 5, minZ: -4, maxZ: 4 } };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.0, z: -2.4, yaw: 0.6 }),
  rhaenyra: withStart('rhaenyra', { x: -3.7, z: -2.6, yaw: 0.8 }),
};

// Portão na mureta (mesma convenção das outras fases: folha ao longo de -Z local, abre para o leste).
export const GATE = { hinge: { x: 0, z: 1.5 }, latchPost: { x: 0, z: 0.3 }, length: 1.2, closedYaw: 0, openYaw: -1.75, openTime: 0.8, closeTime: 0.9 };
export const PLATE = { x: -1.6, z: 2.6, r: 0.45, requires: 'large' };
export const BALL = { x: 3.0, z: -2.0, pickupR: 0.55 };

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'limite-norte', shape: 'box', x: 0, z: -4.5, hx: 6, hz: 0.5 },
  { id: 'limite-sul', shape: 'box', x: 0, z: 4.5, hx: 6, hz: 0.5 },
  { id: 'limite-oeste', shape: 'box', x: -5.5, z: 0, hx: 0.5, hz: 5 },
  { id: 'limite-leste', shape: 'box', x: 5.5, z: 0, hx: 0.5, hz: 5 },
  { id: 'mureta-norte', shape: 'box', x: 0, z: -2.1, hx: 0.1, hz: 2.4 }, // z de -4.5 a 0.3
  { id: 'mureta-sul', shape: 'box', x: 0, z: 3.0, hx: 0.1, hz: 1.5 }, // z de 1.5 a 4.5
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [{ id: 'osso-canto', x: 3.8, z: 3.0 }];
export const COLLECTIBLE_PICKUP_R = 0.42;

export const NAV_NODES = {
  W_home: { x: -3.2, z: -2.2 },
  W_mid: { x: -1.6, z: 0.2 },
  W_plate: { x: -1.6, z: 2.0 },
  W_gate: { x: -0.8, z: 0.9 },
  E_gate: { x: 0.8, z: 0.9 },
  E_mid: { x: 2.2, z: -0.4 },
  E_ball: { x: 3.0, z: -1.4 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['W_home', 'W_mid'],
  ['W_mid', 'W_gate'],
  ['W_mid', 'W_plate'],
  ['W_plate', 'W_gate'],
  ['W_gate', 'E_gate', { requires: 'gateOpen' }],
  ['E_gate', 'E_mid'],
  ['E_mid', 'E_ball'],
];

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: -3.6, z: -3.0, r: 0.9,
  celebrate: { radhija: { x: -3.2, z: -2.7 }, rhaenyra: { x: -4.0, z: -2.7 } },
  entryPoints: [{ x: -4.5, z: 0.5 }, { x: -1.5, z: -3.5 }],
};

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -3.5, maxX: 3.5, minZ: -3.0, maxZ: 2.5 },
  title: { center: { x: -2.5, z: -2.6 }, radius: 5.0, angle: 0.5, height: 2.0, look: { x: -2.8, y: 0.8, z: -2.8 } },
  celebrate: { pos: [-3.3, 1.3, 0.1], look: [-3.6, 0.34, -2.9] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = { WORLD, DOGS, GATE, PLATE, BALL, STATIC_COLLIDERS, COLLECTIBLES, COLLECTIBLE_PICKUP_R, NAV_NODES, NAV_EDGES, GOAL, CAMERA };
export default LAYOUT;
