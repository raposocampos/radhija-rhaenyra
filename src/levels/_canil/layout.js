// CANIL DAS DOGS (fase de desenvolvimento, fora do menu: ?level=canil&play) — LAYOUT.
// Bancada para comparar o modelo atual das cachorrinhas com o novo (src/dogs/v2/): uma vitrine com as quatro
// (Radhija e Rhaenyra, cada uma no modelo atual e no novo) e espaço para as dogs do jogador andarem perto.
// Metros, Y para cima, Norte = -Z, câmera ao sul (mesmas convenções das fases).
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -4, maxX: 4, minZ: -3.2, maxZ: 3.2 } };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -0.55, z: 1.9, yaw: Math.PI }),
  rhaenyra: withStart('rhaenyra', { x: 0.55, z: 2.0, yaw: Math.PI }),
};

/**
 * Vitrine: cada dog no seu tapete (r = raio do tapete e do colisor). Em cada par, a do modelo atual à esquerda e a
 * do novo à direita, para quem olha da câmera.
 * @type {{ z: number, r: number, spots: { kind: import('../../types').DogName, model: 'v1' | 'v2', x: number }[] }}
 */
export const SHOWCASE = {
  z: -1.2,
  r: 0.46,
  spots: [
    { kind: 'radhija', model: 'v1', x: -1.75 },
    { kind: 'radhija', model: 'v2', x: -0.62 },
    { kind: 'rhaenyra', model: 'v1', x: 0.6 },
    { kind: 'rhaenyra', model: 'v2', x: 1.8 },
  ],
};

/** Paredes do estúdio (norte e laterais; o sul fica aberto para a câmera). */
export const ROOM = { wallH: 1.35, sideH: 1.25, wall: 0.12 };

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'limite-norte', shape: 'box', x: 0, z: -3.7, hx: 5, hz: 0.5 },
  { id: 'limite-sul', shape: 'box', x: 0, z: 3.7, hx: 5, hz: 0.5 },
  { id: 'limite-oeste', shape: 'box', x: -4.5, z: 0, hx: 0.5, hz: 4.2 },
  { id: 'limite-leste', shape: 'box', x: 4.5, z: 0, hx: 0.5, hz: 4.2 },
  ...SHOWCASE.spots.map((s, i) => ({ id: `tapete-${i + 1}`, shape: /** @type {'circle'} */ ('circle'), x: s.x, z: SHOWCASE.z, r: SHOWCASE.r })),
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [];

export const NAV_NODES = {
  S_west: { x: -2.6, z: 1.5 },
  S_mid: { x: 0, z: 1.3 },
  S_east: { x: 2.6, z: 1.5 },
  W_side: { x: -3.2, z: -1.2 },
  E_side: { x: 3.2, z: -1.2 },
  NW: { x: -2.8, z: -2.5 },
  NE: { x: 2.8, z: -2.5 },
  N_mid: { x: 0, z: -2.6 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['S_west', 'S_mid'],
  ['S_mid', 'S_east'],
  ['S_west', 'W_side'],
  ['S_east', 'E_side'],
  ['W_side', 'NW'],
  ['E_side', 'NE'],
  ['NW', 'N_mid'],
  ['NE', 'N_mid'],
];

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: 0, z: 2.6, r: 0.8,
  celebrate: { radhija: { x: -0.45, z: 2.45 }, rhaenyra: { x: 0.45, z: 2.55 } },
  entryPoints: [{ x: -3.4, z: 2.6 }, { x: 3.4, z: 2.6 }],
};

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  // mais baixa e de frente que nas fases: a vitrine é vista quase na altura das dogs
  offset: [0.25, 1.7, 3.5],
  lookHeight: 0.28,
  limits: { minX: -2.8, maxX: 2.8, minZ: -1.6, maxZ: 2.4 },
  title: { center: { x: 0, z: -1.2 }, radius: 3.6, angle: 0.25, angleAmp: 0.18, height: 1.3, look: { x: 0, y: 0.32, z: -1.2 } },
  celebrate: { pos: [0.3, 1.0, 4.4], look: [0, 0.3, 2.5] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  WORLD, DOGS, SHOWCASE, ROOM, STATIC_COLLIDERS, COLLECTIBLES, NAV_NODES, NAV_EDGES, GOAL, CAMERA,
};
export default LAYOUT;
