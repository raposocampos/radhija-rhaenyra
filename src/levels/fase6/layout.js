// Expresso do Superbafo — protótipo de desenvolvimento. Metros, chão XZ, norte = -Z.
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -5.5, maxX: 5.5, minZ: -4, maxZ: 4 } };
/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.5, z: 2.55, yaw: 0.7 }),
  rhaenyra: withStart('rhaenyra', { x: -4.25, z: 2.4, yaw: 0.7 }),
};
export const RAIL_YARD = { x: 0, z: -1.05, hx: 2.65, hz: 1.65, height: 0.16 };
export const PEDAL = { x: -3.75, z: 0.35, r: 0.8, pulseTime: 0.5 };
export const JUNCTION = { x: 0, z: -1.5 };
export const TRAIN = {
  start: { x: 0, z: -0.3, yaw: 0 }, speed: 1.35, sneezeTime: 0.9,
  returnTime: 0.8, unloadTime: 0.85, cargoOffset: 0.8, cargoY: 0.5,
};
export const NOSE = { id: 'expresso-nariz', x: 0, z: 0.38, r: 0.45, frontZ: 0.65, halfWidth: 0.58 };
export const BLOW_SPOT = { x: 0, z: 1.65, yaw: Math.PI };
export const TRAY = { x: 1.8, z: 1.3, y: 0.16, pickupR: 0.6 };
export const BALL = { x: TRAIN.start.x, z: TRAIN.start.z - TRAIN.cargoOffset, y: TRAIN.cargoY, pickupR: TRAY.pickupR };
/** @type {Record<import('../../types').Fase6Route, import('../../types').XZ[]>} */
export const ROUTES = {
  loop: [{ x: 0, z: -0.3 }, { x: 0, z: -1.5 }, { x: -1.6, z: -1.5 }, { x: -1.6, z: -0.3 }, { x: 0, z: -0.3 }],
  delivery: [{ x: 0, z: -0.3 }, { x: 0, z: -1.5 }, { x: 1.8, z: -1.5 }, { x: 1.8, z: -0.3 }],
};
/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'parede-norte', shape: 'box', x: 0, z: -4.2, hx: 5.9, hz: 0.2 },
  { id: 'parede-sul', shape: 'box', x: 0, z: 4.2, hx: 5.9, hz: 0.2 },
  { id: 'parede-oeste', shape: 'box', x: -5.7, z: 0, hx: 0.2, hz: 4.2 },
  { id: 'parede-leste', shape: 'box', x: 5.7, z: 0, hx: 0.2, hz: 4.2 },
  // Área inteira inacessível, inclusive durante saltos; trem nunca colide com dogs.
  { id: 'ferrovia', shape: 'box', x: RAIL_YARD.x, z: RAIL_YARD.z, hx: RAIL_YARD.hx, hz: RAIL_YARD.hz },
];
export const NAV_NODES = {
  SW: { x: -3.7, z: 2.5 }, S: { x: 0, z: 2.5 }, SE: { x: 3.6, z: 2.5 },
  W: { x: -3.7, z: -1.2 }, NW: { x: -3.7, z: -3.3 }, N: { x: 0, z: -3.3 },
  NE: { x: 3.6, z: -3.3 }, E: { x: 3.6, z: -1.2 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [['SW', 'S'], ['S', 'SE'], ['SE', 'E'], ['E', 'NE'], ['NE', 'N'], ['N', 'NW'], ['NW', 'W'], ['W', 'SW']];
/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'lapis', x: -4.7, z: -2.6 }, { id: 'planetas', x: 0.6, z: -3.35 }, { id: 'caixinha', x: 4.5, z: 2.4 },
];
export const COLLECTIBLE_PICKUP_R = 0.42;
/** @type {import('../../types').Goal} */
export const GOAL = {
  x: -3.85, z: 2.9, r: 0.85,
  celebrate: { radhija: { x: -3.5, z: 2.85 }, rhaenyra: { x: -4.2, z: 2.85 } },
  entryPoints: [{ x: -4.5, z: -1 }, { x: 3.8, z: 2.5 }],
};
/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38, offset: [1.4, 4.3, 4.7], lookHeight: 0.3,
  limits: { minX: -3.8, maxX: 3.8, minZ: -2.7, maxZ: 2.5 },
  title: { center: { x: 0, z: -0.1 }, radius: 7, angle: 0.35, height: 4.4, look: { x: 0, y: 0.2, z: -0.4 } },
  celebrate: { pos: [-2.8, 1.6, 5.1], look: [-3.85, 0.3, 2.85] },
};
/** @type {import('../../types').LevelLayout} */
const LAYOUT = { WORLD, DOGS, RAIL_YARD, PEDAL, JUNCTION, TRAIN, NOSE, BLOW_SPOT, TRAY, BALL, ROUTES,
  STATIC_COLLIDERS, NAV_NODES, NAV_EDGES, COLLECTIBLES, COLLECTIBLE_PICKUP_R, GOAL, CAMERA };
export default LAYOUT;
