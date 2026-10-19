// CANIL DAS DOGS (fase de desenvolvimento, fora do menu: ?level=canil&play) — LAYOUT.
// Bancada para comparar o modelo atual das cachorrinhas com o novo (src/dogs/v2/): uma vitrine com as quatro
// (Radhija e Rhaenyra, cada uma no modelo atual e no novo) e espaço para as dogs do jogador andarem perto.
// Metros, Y para cima, Norte = -Z, câmera ao sul (mesmas convenções das fases).
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -4, maxX: 4, minZ: -3.2, maxZ: 3.2 } };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  // de lado, fora do quadro da vitrine (a câmera dela fica entre a vitrine e o sul)
  radhija: withStart('radhija', { x: -3.0, z: 1.8, yaw: 2.55 }),
  rhaenyra: withStart('rhaenyra', { x: -3.35, z: 2.45, yaw: 2.55 }),
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

/**
 * Enquadramentos da vitrine (câmera.focusShot): ponto olhado (x, y) e distância (scale × CAMERA.offset). O ponto fica
 * um pouco à direita do centro do grupo, para o painel (à direita da tela) não cobrir as dogs.
 * @type {Record<'vitrine' | 'radhija' | 'rhaenyra', { x: number, y: number, scale: number }>}
 */
export const FRAMING = {
  vitrine: { x: 0.8, y: 0.32, scale: 1.45 },
  radhija: { x: -0.86, y: 0.26, scale: 0.62 },
  rhaenyra: { x: 1.55, y: 0.28, scale: 0.66 },
};

/** Paredes do estúdio (norte e laterais; o sul fica aberto para a câmera). */
export const ROOM = { wallH: 1.35, sideH: 1.25, wall: 0.12 };

/** Paredes finas no lugar das paredes desenhadas (e um rodapé invisível ao sul, junto da câmera). */
/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'parede-norte', shape: 'box', x: 0, z: WORLD.bounds.minZ - ROOM.wall / 2, hx: 4.3, hz: ROOM.wall / 2 },
  { id: 'limite-sul', shape: 'box', x: 0, z: WORLD.bounds.maxZ + 0.06, hx: 4.3, hz: 0.06 },
  { id: 'parede-oeste', shape: 'box', x: WORLD.bounds.minX - ROOM.wall / 2, z: 0, hx: ROOM.wall / 2, hz: 3.4 },
  { id: 'parede-leste', shape: 'box', x: WORLD.bounds.maxX + ROOM.wall / 2, z: 0, hx: ROOM.wall / 2, hz: 3.4 },
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
  WORLD, DOGS, SHOWCASE, FRAMING, ROOM, STATIC_COLLIDERS, COLLECTIBLES, NAV_NODES, NAV_EDGES, GOAL, CAMERA,
};
export default LAYOUT;
