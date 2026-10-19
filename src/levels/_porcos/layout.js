// ARENA DOS PORQUINHOS (fase de desenvolvimento, fora do menu: ?level=porcos&play) — LAYOUT.
// Quintal de teste dos porcos da fase 10. A leste, a horta cercada (cerca baixa: a Rhaenyra pula; o vão da tábua
// quebrada só deixa passar a Radhija; os porcos não saem dela) com o chiqueiro no canto nordeste. A bolinha está lá
// dentro, atrás dos três porquinhos. O botão de pisar na frente do chiqueiro abre a porteira: os porcos saem e vão
// atrapalhar quem chegar perto. Do outro lado (oeste), o milho, a cenoura e a aboborinha: E pega, E de novo larga no
// chão; um legume largado na horta distrai um porquinho por um tempo (ele come, cochila e volta a atrapalhar). O
// sininho chama todos de volta para o chiqueiro. Metros, Y para cima, Norte = −Z, câmera ao sul.
import { withStart } from '../../dogs/config.js';
import { pigPenLayout } from '../../game/mechanics/pigHerd.js';

export const WORLD = { bounds: { minX: -6, maxX: 6, minZ: -4.5, maxZ: 4.5 } };
const B = WORLD.bounds;

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.4, z: 1.5, yaw: 1.45 }),
  rhaenyra: withStart('rhaenyra', { x: -4.2, z: 1.1, yaw: 1.45 }),
};

/** Cerca baixa da horta ao longo de x (a Rhaenyra pula) com o vão da tábua quebrada (só a Radhija). */
export const HORTA = { x: 0.6, t: 0.12, fenceH: 0.34, gap: { z0: 0.85, z1: 1.3 } };
/** Chiqueiro no canto nordeste: miolo, porteira na cerca sul e o cocho encostado na cerca norte. */
export const PEN = {
  x0: 3.7, x1: 5.9, z0: -4.4, z1: -2.4, t: 0.08, h: 0.72,
  door: { side: 's', a: 4.35, b: 5.2 },
  trough: { x: 4.75, z: -4.25, hx: 0.38, hz: 0.11 },
  mud: { x: 4.05, z: -3.0, rx: 0.36, rz: 0.26 },
};
export const PEN_LAYOUT = pigPenLayout(PEN);
/** Os porquinhos (cfg do createPigHerd; o resto vem de PIG_DEFAULTS). */
export const PIGS = {
  count: 3,
  pen: PEN_LAYOUT.pen,
  door: PEN_LAYOUT.door,
  gate: PEN_LAYOUT.gate,
  area: { minX: HORTA.x + HORTA.t / 2, maxX: B.maxX, minZ: B.minZ, maxZ: B.maxZ },
  homes: [{ x: 4.3, z: -3.5, yaw: 0.6 }, { x: 5.0, z: -2.95, yaw: -2.5 }, { x: 5.35, z: -3.75, yaw: 2.2 }],
};
/** Botão de pisar (qualquer dog) que abre a porteira. */
export const BUTTON = { x: 3.15, z: -1.7, r: 0.3 };
/** Sininho num poste: E toca e chama os porquinhos de volta. */
export const BELL = { x: 3.05, z: -3.95, reach: 0.7 };
export const BALL = { x: 5.55, z: -4.0, pickupR: 0.55 };

/** Os legumes, do outro lado (oeste), na frente do caixote. Comido, cada um volta para o lugar depois de respawn s. */
export const VEGGIES = {
  corn: { x: -4.9, z: -2.75 },
  carrot: { x: -4.15, z: -2.6 },
  pumpkin: { x: -3.35, z: -2.8 },
  pickupR: 0.5,
  respawn: 3.5,
  /** De quanto à frente da dog o legume cai quando ela larga. */
  toss: 0.42,
};
export const CRATE = { x: -4.15, z: -3.6, hx: 0.42, hz: 0.24, h: 0.34 };
/** Canteiros de alface na horta (baixos: a Rhaenyra pula; dogs e porcos contornam). */
export const BEDS = [
  { x: 2.25, z: 1.9, hx: 0.55, hz: 0.28 },
  { x: 4.3, z: 2.7, hx: 0.5, hz: 0.3 },
  { x: 1.95, z: -0.75, hx: 0.42, hz: 0.24 },
];
export const BED_H = 0.22;
/** Caminha das dogs (o objetivo). */
export const DOG_BED = { x: -4.75, z: 3.35, r: 0.42 };

/** @returns {import('../../types').BoxCollider} */
const box = (id, x, z, hx, hz, extra = {}) => ({ id, shape: 'box', x, z, hx, hz, ...extra });
const H = HORTA;
/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  box('limite-norte', 0, B.minZ - 0.5, 7, 0.5),
  box('limite-sul', 0, B.maxZ + 0.5, 7, 0.5),
  box('limite-oeste', B.minX - 0.5, 0, 0.5, 6),
  box('limite-leste', B.maxX + 0.5, 0, 0.5, 6),
  box('horta-cerca-norte', H.x, (B.minZ + H.gap.z0) / 2, H.t / 2, (H.gap.z0 - B.minZ) / 2, { jumpable: true, height: H.fenceH }),
  box('horta-vao', H.x, (H.gap.z0 + H.gap.z1) / 2, H.t / 2, (H.gap.z1 - H.gap.z0) / 2, { blocks: 'large', jumpable: true, height: H.fenceH }),
  box('horta-cerca-sul', H.x, (H.gap.z1 + B.maxZ) / 2, H.t / 2, (B.maxZ - H.gap.z1) / 2, { jumpable: true, height: H.fenceH }),
  ...PEN_LAYOUT.colliders,
  { id: 'sininho', shape: 'circle', x: BELL.x, z: BELL.z, r: 0.07 },
  box('caixote-de-legumes', CRATE.x, CRATE.z, CRATE.hx, CRATE.hz, { height: CRATE.h }),
  ...BEDS.map((b, i) => box(`canteiro-${i + 1}`, b.x, b.z, b.hx, b.hz, { jumpable: true, height: BED_H })),
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'osso-da-horta', x: 3.3, z: 3.65 },
  { id: 'osso-do-chiqueiro', x: 3.95, z: -4.1 },
  { id: 'osso-dos-legumes', x: -5.45, z: -3.9 },
];
export const COLLECTIBLE_PICKUP_R = 0.42;

export const NAV_NODES = {
  W_home: { x: -3.9, z: 1.7 },
  W_mid: { x: -2.0, z: 0.5 },
  W_veg: { x: -3.6, z: -1.8 },
  W_north: { x: -0.4, z: -2.2 },
  W_gap: { x: 0.05, z: 1.07 },
  E_gap: { x: 1.15, z: 1.07 },
  E_mid: { x: 2.95, z: 0.35 },
  E_button: { x: 3.0, z: -1.25 },
  E_pen: { x: 4.78, z: -1.85 },
  E_in: { x: 4.78, z: -2.95 },
  E_north: { x: 1.3, z: -2.2 },
  E_south: { x: 3.35, z: 3.7 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['W_home', 'W_mid'], ['W_mid', 'W_veg'], ['W_veg', 'W_north'], ['W_mid', 'W_north'], ['W_mid', 'W_gap'],
  // a companheira: a Radhija passa no vão; a Rhaenyra não pula sozinha (espera do lado de fora)
  ['W_gap', 'E_gap', { requires: 'small' }],
  ['W_north', 'E_north', { requires: 'jump' }],
  ['E_gap', 'E_mid'], ['E_mid', 'E_button'], ['E_button', 'E_north'], ['E_button', 'E_pen'], ['E_mid', 'E_south'],
  ['E_pen', 'E_in', { requires: 'penOpen' }],
];

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: DOG_BED.x, z: DOG_BED.z, r: 0.9,
  celebrate: { radhija: { x: -4.3, z: 3.0 }, rhaenyra: { x: -5.15, z: 3.0 } },
  celebrateRim: { x: DOG_BED.x, z: DOG_BED.z, r: DOG_BED.r, tube: 0.09 }, // a borda da caminha (world.js dogBed)
  entryPoints: [{ x: -3.6, z: 3.4 }, { x: -4.7, z: 2.2 }],
};

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.4, 4.9],
  lookHeight: 0.3,
  limits: { minX: -4.6, maxX: 4.7, minZ: -3.5, maxZ: 3.1 },
  title: { center: { x: 3.4, z: -2.6 }, radius: 4.6, angle: 0.4, height: 2.0, look: { x: 4.6, y: 0.4, z: -3.3 } },
  celebrate: { pos: [-4.4, 1.3, 6.2], look: [-4.7, 0.34, 3.3] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  WORLD, DOGS, HORTA, PEN, PEN_LAYOUT, PIGS, BUTTON, BELL, BALL, VEGGIES, CRATE, BEDS, BED_H, DOG_BED,
  STATIC_COLLIDERS, COLLECTIBLES, COLLECTIBLE_PICKUP_R, NAV_NODES, NAV_EDGES, GOAL, CAMERA,
};
export default LAYOUT;
