// ARENA DO EMPURRÃO (fase de desenvolvimento, fora do menu: ?level=empurra&play) — LAYOUT.
// Quintal para treinar o empurrão em pé da Rhaenyra (segurar Shift · R1 de frente para algo empurrável no alto):
// a arvorezinha com a bolinha presa nos galhos (o objetivo: derrubar e levar para casa), a mesinha com o patinho na
// beirada de trás e a estante baixa com o ursinho em cima. Três empurrões e o que está lá em cima cai do outro lado.
// A irmã também pode ser empurrada (ela dá uns passinhos para trás, indignada).
// Metros, Y para cima, Norte = -Z, câmera ao sul (mesmas convenções das fases).
import { withStart } from '../../dogs/config.js';
import { SHOVE_PROP_SIZE, treeTrunkRadius } from '../../world/shoveProps.js';

export const WORLD = { bounds: { minX: -5, maxX: 5, minZ: -4, maxZ: 4 } };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.0, z: -1.3, yaw: 1.3 }),
  rhaenyra: withStart('rhaenyra', { x: -3.5, z: -1.9, yaw: 1.3 }),
};

/**
 * Ponto local (lx lateral, ly altura, lz rumo à dog) de um objeto em (o.x, o.z) com a face empurrada virada para
 * (o.nx, o.nz) → mundo. É o mesmo giro do cenário (rotation.y = atan2(nx, nz)).
 * @param {{ x: number, z: number, nx: number, nz: number }} o
 */
export const toWorld = (o, lx, ly, lz) => ({ x: o.x + o.nz * lx + o.nx * lz, y: ly, z: o.z - o.nx * lx + o.nz * lz });

const TS = SHOVE_PROP_SIZE.tree;
const TB = SHOVE_PROP_SIZE.table;
const SH = SHOVE_PROP_SIZE.shelf;

/** Arvorezinha: empurrada pelo oeste (a dog fica de perfil para a câmera); a bolinha no lado sul da copa. */
export const TREE = { x: 0.3, z: -1.7, nx: -1, nz: 0, ball: { lx: 0.34, ly: 1.0, lz: -0.1 } };
/** Mesinha: empurrada pelo leste; o patinho perto da beirada oeste (de trás). */
export const TABLE = { x: -1.2, z: 1.3, nx: 1, nz: 0, duck: { lx: -0.12, lz: -TB.d / 2 + 0.085 } };
/** Estante baixa: empurrada pelo oeste; o ursinho sentado rente à beirada leste (de trás). */
export const SHELF = { x: 2.6, z: 1.2, nx: -1, nz: 0, bear: { lx: 0.12, lz: -SH.d / 2 + 0.075 } };

const ballAt = toWorld(TREE, TREE.ball.lx, TREE.ball.ly, TREE.ball.lz);
const duckAt = toWorld(TABLE, TABLE.duck.lx, TB.h, TABLE.duck.lz);
const bearAt = toWorld(SHELF, SHELF.bear.lx, SH.h, SHELF.bear.lz);

/**
 * Os três empurráveis (createShoveTarget). Ponto de apoio: tronco a TS.paws m (patas na casca, face redonda: w = 0);
 * mesinha e estante com as patas em cima do tampo, na beirada da frente (over).
 * @type {Record<string, import('../../types').ShoveTargetCfg>}
 */
export const SHOVE_TARGETS = {
  arvorezinha: {
    ...toWorld(TREE, 0, TS.paws, treeTrunkRadius(TS.paws)), nx: TREE.nx, nz: TREE.nz, y: TS.paws, w: 0, over: 0, kind: 'tree',
    item: {
      from: ballAt, r: 0.072, roll: true,
      land: [{ x: 0.9, z: -1.2 }, { x: 0.98, z: -1.55 }, { x: 0.62, z: -0.92 }, { x: 1.05, z: -0.95 }],
    },
  },
  mesinha: {
    ...toWorld(TABLE, 0, TB.h, TB.d / 2), nx: TABLE.nx, nz: TABLE.nz, y: TB.h, w: 0.22, over: 0.05, kind: 'table',
    item: {
      from: duckAt, edge: toWorld(TABLE, TABLE.duck.lx, TB.h, -TB.d / 2 - 0.03), r: 0.07, restY: 0.065, center: 0.065, rB: 0.095,
      land: [{ x: -1.86, z: 1.48 }, { x: -1.84, z: 1.12 }, { x: -1.92, z: 1.78 }],
    },
  },
  estante: {
    ...toWorld(SHELF, 0, SH.h, SH.d / 2 + 0.006), nx: SHELF.nx, nz: SHELF.nz, y: SH.h, w: 0.28, over: 0.04, kind: 'shelf',
    item: {
      from: bearAt, edge: toWorld(SHELF, SHELF.bear.lx, SH.h, -SH.d / 2 - 0.035), r: 0.085, restY: 0.09, center: 0.09, rB: 0.13,
      land: [{ x: 3.22, z: 1.34 }, { x: 3.25, z: 1.0 }, { x: 3.18, z: 1.7 }],
    },
  },
};

/** Caminha de casa (entrega da bolinha). */
export const BED = { x: -3.75, z: -2.85, r: 0.42 };

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'limite-norte', shape: 'box', x: 0, z: -4.5, hx: 6, hz: 0.5 },
  { id: 'limite-sul', shape: 'box', x: 0, z: 4.5, hx: 6, hz: 0.5 },
  { id: 'limite-oeste', shape: 'box', x: -5.5, z: 0, hx: 0.5, hz: 5 },
  { id: 'limite-leste', shape: 'box', x: 5.5, z: 0, hx: 0.5, hz: 5 },
  { id: 'arvorezinha', shape: 'circle', x: TREE.x, z: TREE.z, r: 0.09, height: 1.75 },
  // mesinha e estante: a planta inteira (ninguém passa por baixo da mesinha)
  { id: 'mesinha', shape: 'box', x: TABLE.x, z: TABLE.z, hx: TB.d / 2 + 0.01, hz: TB.w / 2 + 0.01, height: TB.h },
  { id: 'estante', shape: 'box', x: SHELF.x, z: SHELF.z, hx: SH.d / 2 + 0.016, hz: SH.w / 2 + 0.02, height: SH.h },
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'osso-nordeste', x: 3.9, z: -2.9 },
  { id: 'osso-sul', x: -0.6, z: 3.0 },
  { id: 'osso-atras-da-estante', x: 3.9, z: 2.8 },
];
export const COLLECTIBLE_PICKUP_R = 0.42;

export const NAV_NODES = {
  W_home: { x: -3.1, z: -1.5 },
  W_south: { x: -2.6, z: 0.6 },
  W_table: { x: -2.0, z: 1.3 },
  S_table: { x: -1.2, z: 2.4 },
  mid: { x: -0.3, z: -0.3 },
  W_tree: { x: -0.5, z: -1.8 },
  E_tree: { x: 1.2, z: -1.6 },
  east: { x: 2.0, z: -0.4 },
  NE: { x: 3.8, z: -2.6 },
  south: { x: 0.4, z: 2.8 },
  S_shelf: { x: 2.6, z: 2.3 },
  E_shelf: { x: 3.4, z: 0.9 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['W_home', 'W_south'],
  ['W_home', 'mid'],
  ['W_home', 'W_tree'],
  ['W_tree', 'mid'],
  ['W_south', 'W_table'],
  ['W_south', 'S_table'],
  ['S_table', 'south'],
  ['mid', 'E_tree'],
  ['mid', 'east'],
  ['mid', 'south'],
  ['E_tree', 'east'],
  ['E_tree', 'NE'],
  ['east', 'NE'],
  ['east', 'E_shelf'],
  ['south', 'S_shelf'],
  ['S_shelf', 'E_shelf'],
];

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: BED.x, z: BED.z, r: 0.9,
  celebrate: { radhija: { x: -3.3, z: -2.5 }, rhaenyra: { x: -4.1, z: -2.4 } },
  entryPoints: [{ x: -4.5, z: 0.8 }, { x: -1.6, z: -3.5 }],
};

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -3.5, maxX: 3.6, minZ: -3.35, maxZ: 2.6 },
  title: { center: { x: 0.2, z: -1.4 }, radius: 4.6, angle: 0.4, height: 2.0, look: { x: 0.2, y: 0.8, z: -1.6 } },
  celebrate: { pos: [-3.3, 1.3, 0.2], look: [-3.7, 0.34, -2.8] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  WORLD, DOGS, TREE, TABLE, SHELF, SHOVE_TARGETS, BED,
  STATIC_COLLIDERS, COLLECTIBLES, COLLECTIBLE_PICKUP_R, NAV_NODES, NAV_EDGES, GOAL, CAMERA,
};
export default LAYOUT;
