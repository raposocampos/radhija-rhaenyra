// =====================================================================
//  FASE 4 · Operação Patinho — LAYOUT (fonte única de verdade para coordenadas).
//  Terraço do prédio numa manhã de sol: casa da escada e espreguiçadeiras (zona A, oeste), a fileira de
//  floreiras com uma passagem só, o ventilador industrial no trilho e o corredor dos aparelhos de
//  ar-condicionado (zona B, centro) e, depois da mureta com portão, o cantinho dos pombos (zona C, leste).
//  Mesmas convenções das outras fases: metros, Y para cima, Norte = -Z (mureta do fundo), câmera ao sul.
//
//  Beats do puzzle (superbafo da Radhija):
//   1. O POMBO DA PASSAGEM cochila no único vão das floreiras. Latido não adianta; um superbafo direto
//      (segure R e solte) e ele voa para a caixa d'água. Ensina a mira e o sopro.
//   2. "O pombo e o portão": a Rhaenyra empurra o VENTILADOR pelo trilho até a marca (o vento entra pela
//      GRADE do corredor); a Radhija passa por baixo dos canos entre os aparelhos (a Rhaenyra não cabe)
//      e sopra no vento; o DUTO leva o cheiro por cima da mureta e solta ao lado do POLEIRO A; o pombo
//      voa para o POLEIRO B, que tem a placa: o PORTÃO abre e trava.
//   3. O PATINHO está na bacia d'água dos pombos. Levem-no até o capacho da casa da escada (GOAL).
// =====================================================================
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -6.4, maxX: 6.4, minZ: -4.2, maxZ: 3.8 } };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -4.4, z: -1.7, yaw: 1.4 }),
  rhaenyra: withStart('rhaenyra', { x: -5.2, z: -1.85, yaw: 1.3 }),
};

// Casa da escada (canto noroeste): a porta dá para o sul; o capacho na frente é a "casa" (GOAL).
export const STAIR_HOUSE = { x0: -6.4, x1: -3.9, z0: -4.2, z1: -2.95, height: 2.5, door: { x: -5.0, width: 0.9, height: 2.05 } };

// Fileira de floreiras (x = -2,85) de mureta a mureta, com um único vão (PASS) — onde o pombo cochila.
export const PLANTERS = { x: -2.85, half: 0.28, height: 0.5 };
export const PASS = { z0: -0.05, z1: 0.95 };
export const NAP_PIGEON = {
  x: PLANTERS.x, z: (PASS.z0 + PASS.z1) / 2, smellR: 0.5,
  // para onde ele voa (borda da caixa d'água, em cima da casa da escada)
  flyTo: { x: -4.6, y: 3.42, z: -3.45 },
  flyTime: 1.5,
};

// Mureta alta entre as zonas B e C (x = 2,4), com o portão no meio (abre para o leste).
export const WALL = { x: 2.4, half: 0.1, gapZ: 0.6, height: 1.05 };
export const GATE = { hinge: { x: 2.4, z: 0.6 }, latchPost: { x: 2.4, z: -0.6 }, length: 1.2, closedYaw: 0, openYaw: -1.6, openTime: 0.9 };

// Corredor dos aparelhos de ar-condicionado: de x -0,6 a 2,25 em z = 2,3. Ao norte, a fileira de
// aparelhos (altos, atrás da Radhija para a câmera) com um vão estreito sob os canos (só a Radhija passa);
// ao sul, uma mureta baixa (0,3 m) para a câmera enxergar lá dentro. Grade no oeste (o vento passa).
export const CORRIDOR = { x0: -0.6, x1: 2.25, z: 2.3, half: 0.32, door: { x0: 0.45, x1: 0.95 } };
export const AC_UNITS = { depth: 0.34, height: 0.72 }; // aparelhos: de z - half - depth até z - half
// Poleiros (altos: as dogs não alcançam). O pombo do portão começa no A; o B tem a placa (corda até a trava).
export const PERCH_A = { x: 3.5, z: 2.3, y: 1.25, smellR: 0.55 };
export const PERCH_B = { x: 3.5, z: -2.2, y: 1.25 };
// Duto de exaustão: boca no fundo do corredor, sobe, passa por cima da mureta e sai ao lado do poleiro A, na altura do
// pombo: a caixa da saída fica num pé, com o centro da boca (y) no peito dele.
export const DUCT = {
  inlet: { x: 2.0, z: 2.3, r: 0.32 },
  // exit: a nuvem sai pela boca da caixa (a face leste fica a 0,13 m do centro dela), não de dentro dela
  outlet: { x: 2.85, y: PERCH_A.y + 0.15, z: 2.3, dirX: 1, dirZ: 0, speed: 1.3, exit: 0.2 },
  travel: 1.0,
};
// Ventilador industrial num trilho norte–sul; sopra para o leste. Encaixa (marca amarela) em z = CORRIDOR.z.
export const FAN = {
  start: { x: -1.4, z: 0.4 }, half: 0.3, minX: -1.4, maxX: -1.4, minZ: 0.0, maxZ: 3.0, pushSpeed: 0.8,
  alignZ: 2.3, snap: 0.22,
  wind: { offset: 0.32, length: 3.4, halfWidth: 0.26, strength: 2.4 },
};
// Bacia d'água dos pombos com o patinho boiando.
export const BASIN = { x: 5.0, z: 1.0, r: 0.36 };
export const DUCK = { x: BASIN.x, z: BASIN.z, pickupR: 0.58 };
// Pombal (decoração com colisão) no canto nordeste.
export const COOP = { x: 5.4, z: -3.55, hx: 0.9, hz: 0.6 };

/** Parede fina ao longo de X, de x0 a x1 (extra: blocks, height…). @returns {import('../../types').BoxCollider} */
const wallSeg = (id, x0, x1, z, hz = 0.05, extra = {}) => ({ id, shape: 'box', x: (x0 + x1) / 2, z, hx: (x1 - x0) / 2, hz, ...extra });
const acZ = CORRIDOR.z - CORRIDOR.half - AC_UNITS.depth / 2;

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  // muretas do terraço
  { id: 'mureta-norte', shape: 'box', x: 0, z: -4.45, hx: 6.9, hz: 0.25 },
  { id: 'mureta-sul', shape: 'box', x: 0, z: 4.05, hx: 6.9, hz: 0.25 },
  { id: 'mureta-oeste', shape: 'box', x: -6.65, z: 0, hx: 0.25, hz: 4.5 },
  { id: 'mureta-leste', shape: 'box', x: 6.65, z: 0, hx: 0.25, hz: 4.5 },
  // casa da escada (e o batente da porta e o cano que saem 7 cm da fachada)
  { id: 'casa-da-escada', shape: 'box', x: (STAIR_HOUSE.x0 + STAIR_HOUSE.x1) / 2, z: (STAIR_HOUSE.z0 + STAIR_HOUSE.z1) / 2, hx: (STAIR_HOUSE.x1 - STAIR_HOUSE.x0) / 2, hz: (STAIR_HOUSE.z1 - STAIR_HOUSE.z0) / 2 },
  { id: 'casa-da-escada-frente', shape: 'box', x: (STAIR_HOUSE.x0 + STAIR_HOUSE.x1) / 2, z: STAIR_HOUSE.z1 + 0.04, hx: (STAIR_HOUSE.x1 - STAIR_HOUSE.x0) / 2, hz: 0.04 },
  // floreiras (dois trechos; o vão do meio é a passagem do pombo)
  { id: 'floreiras-norte', shape: 'box', x: PLANTERS.x, z: (-4.2 + PASS.z0) / 2, hx: PLANTERS.half, hz: (PASS.z0 + 4.2) / 2 },
  { id: 'floreiras-sul', shape: 'box', x: PLANTERS.x, z: (PASS.z1 + 3.8) / 2, hx: PLANTERS.half, hz: (3.8 - PASS.z1) / 2 },
  // mureta B|C (o portão fecha o meio)
  { id: 'mureta-portao-norte', shape: 'box', x: WALL.x, z: (-4.2 - WALL.gapZ) / 2, hx: WALL.half, hz: (4.2 - WALL.gapZ) / 2 },
  { id: 'mureta-portao-sul', shape: 'box', x: WALL.x, z: (3.8 + WALL.gapZ) / 2, hx: WALL.half, hz: (3.8 - WALL.gapZ) / 2 },
  // corredor: aparelhos ao norte (com o vão sob os canos), mureta baixa ao sul, grade no oeste
  wallSeg('aparelhos-oeste', CORRIDOR.x0, CORRIDOR.door.x0, acZ, AC_UNITS.depth / 2),
  wallSeg('aparelhos-leste', CORRIDOR.door.x1, CORRIDOR.x1, acZ, AC_UNITS.depth / 2),
  wallSeg('canos-vao-grande', CORRIDOR.door.x0, CORRIDOR.door.x1, acZ, AC_UNITS.depth / 2, { blocks: 'large' }),
  wallSeg('corredor-sul', CORRIDOR.x0, CORRIDOR.x1, CORRIDOR.z + CORRIDOR.half, 0.06, { height: 0.3 }),
  { id: 'grade', shape: 'box', x: CORRIDOR.x0 - 0.02, z: CORRIDOR.z, hx: 0.04, hz: CORRIDOR.half + 0.06 },
  // duto: a caixa da boca no fundo do corredor e o pé da caixa da saída (ela fica lá em cima, na altura do pombo,
  // do outro lado da mureta) (world/props.js)
  { id: 'duto-boca', shape: 'box', x: 2.095, z: DUCT.inlet.z, hx: 0.155, hz: 0.24 },
  { id: 'duto-saida', shape: 'circle', x: DUCT.outlet.x, z: DUCT.outlet.z, r: 0.06 },
  // zona A: mesa com guarda-sol, espreguiçadeiras, limoeiro no vaso
  { id: 'mesa-guarda-sol', shape: 'circle', x: -4.5, z: 1.2, r: 0.46 },
  // as duas cadeiras da mesa (assento a 0,45 m: ninguém passa por baixo) (world/props.js, buildDecor)
  { id: 'cadeira-oeste', shape: 'circle', x: -5.12, z: 1.35, r: 0.26 },
  { id: 'cadeira-leste', shape: 'circle', x: -3.95, z: 1.62, r: 0.26 },
  { id: 'espreguicadeira-1', shape: 'box', x: -5.75, z: 2.45, hx: 0.3, hz: 0.82 },
  { id: 'espreguicadeira-2', shape: 'box', x: -4.85, z: 2.75, hx: 0.3, hz: 0.82 },
  { id: 'limoeiro', shape: 'circle', x: -3.45, z: -3.65, r: 0.3 },
  // zona B: banco junto à mureta norte e vasos
  { id: 'banco', shape: 'box', x: 0.3, z: -3.75, hx: 0.75, hz: 0.24 },
  { id: 'vaso-b1', shape: 'circle', x: -1.9, z: -3.75, r: 0.28 },
  { id: 'vaso-b2', shape: 'circle', x: 1.75, z: -3.8, r: 0.24 },
  // zona C: poleiros, bacia, pombal
  { id: 'poleiro-a', shape: 'circle', x: PERCH_A.x, z: PERCH_A.z, r: 0.14 },
  { id: 'poleiro-b', shape: 'circle', x: PERCH_B.x, z: PERCH_B.z, r: 0.14 },
  { id: 'bacia', shape: 'circle', x: BASIN.x, z: BASIN.z, r: BASIN.r },
  { id: 'pombal', shape: 'box', x: COOP.x, z: COOP.z, hx: COOP.hx, hz: COOP.hz },
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'osso-espreguicadeira', x: -5.3, z: 3.35, hint: 'entre as espreguiçadeiras' },
  { id: 'osso-corredor', x: 1.55, z: CORRIDOR.z, hint: 'no corredor dos aparelhos' },
  { id: 'osso-pombal', x: 6.0, z: -2.5, hint: 'ao lado do pombal' },
];
export const COLLECTIBLE_PICKUP_R = 0.42;

export const NAV_NODES = {
  A_home: { x: -4.6, z: -1.6 },
  A_mid: { x: -4.0, z: 0.0 },
  A_pass: { x: -3.5, z: 0.45 },
  A_south: { x: -3.38, z: 2.2 }, // entre a cadeira leste e as floreiras
  B_pass: { x: -2.2, z: 0.45 },
  B_nw: { x: -2.05, z: -0.75 },
  B_mid: { x: -0.3, z: -0.5 },
  B_door: { x: 0.7, z: 1.32 },
  C_in: { x: 0.7, z: CORRIDOR.z },
  B_gate: { x: 1.75, z: 0.0 },
  E_gate: { x: 3.1, z: 0.0 },
  E_duck: { x: 4.35, z: 0.55 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['A_home', 'A_mid'],
  ['A_mid', 'A_pass'],
  ['A_south', 'A_pass'],
  ['A_pass', 'B_pass', { requires: 'passOpen' }],
  ['B_pass', 'B_nw'],
  ['B_nw', 'B_mid'],
  ['B_mid', 'B_door'],
  ['B_door', 'C_in', { requires: 'small' }],
  ['B_mid', 'B_gate'],
  ['B_door', 'B_gate'],
  ['B_gate', 'E_gate', { requires: 'gateOpen' }],
  ['E_gate', 'E_duck'],
];

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: STAIR_HOUSE.door.x, z: -2.4, r: 0.9,
  celebrate: { radhija: { x: -4.6, z: -2.2 }, rhaenyra: { x: -5.4, z: -2.2 } },
  entryPoints: [{ x: -6.0, z: -0.6 }, { x: -3.4, z: -1.9 }, { x: -5.6, z: 1.2 }],
};

/** Sol da manhã a leste-sudeste (luz quente baixa; sombras longas para o noroeste, longe da câmera). */
export const SUN = { direction: [0.62, 0.48, 0.42], color: '#ffe2b4', intensity: 3.0 };

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -4.3, maxX: 4.6, minZ: -3.3, maxZ: 2.4 },
  title: { center: { x: -4.4, z: -2.0 }, radius: 5.4, angle: 0.55, height: 2.0, look: { x: -5.0, y: 0.9, z: -2.7 } },
  celebrate: { pos: [GOAL.x + 0.35, 1.3, GOAL.z + 3.1], look: [GOAL.x, 0.34, GOAL.z + 0.05] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  WORLD, DOGS, STAIR_HOUSE, PLANTERS, PASS, NAP_PIGEON, WALL, GATE, CORRIDOR, AC_UNITS, DUCT, FAN, PERCH_A, PERCH_B,
  BASIN, DUCK, COOP, STATIC_COLLIDERS, COLLECTIBLES, COLLECTIBLE_PICKUP_R, NAV_NODES, NAV_EDGES, GOAL, SUN, CAMERA,
};
export default LAYOUT;
