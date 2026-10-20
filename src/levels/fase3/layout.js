// =====================================================================
//  FASE 3 · Operação Pantufa — LAYOUT (fonte única de verdade para coordenadas).
//  Jardim comum do condomínio à noite: quintal de casa com porta de vidro (zona A), cerca-viva com
//  portão de treliça, lago com ilha e ponte (zona B), cordões de luz, lanternas e vagalumes.
//  Mesmas convenções da fase 1: metros, Y para cima, Norte = -Z (fachada), câmera ao sul.
//
//  Beats do puzzle:
//   1. DUAS PEDRAS: o portão só abre com as duas pedras pressionadas AO MESMO TEMPO.
//      Pedra pesada (PLATE_H) só afunda com a Rhaenyra (large). Pedra leve (PLATE_L) fica num
//      cantinho da cerca-viva onde só a Radhija cabe (NOOK.gap). Cada pedra acende uma LANTERNA
//      no portão; as duas acesas → o portão abre e trava aberto. (Fica/F para deixar a Rhaenyra.)
//   2. DONA GANSA: patrulha a cabeceira da PONTE para a ilha. Se a dog ATIVA chega a menos de
//      alertR, ela grasna e avança → empurra a dog para trás (sem punição maior). Um LATIDO (E sem
//      nada perto) a menos de lureR atrai a gansa até perto de quem latiu; ela fica curiosa
//      curiousTime s e depois volta devagar. A PANTUFA na ilha é pesada: só a Rhaenyra carrega.
//      Solução: Rhaenyra espera perto da ponte (fora do alerta) → Radhija late do gramado sul →
//      troca → Rhaenyra atravessa, pega a pantufa e volta.
//   Pantufa → porta de vidro (GOAL).
// =====================================================================
import { withStart } from '../../dogs/config.js';

export const WORLD = {
  bounds: { minX: -6.6, maxX: 6.6, minZ: -4.8, maxZ: 4.4 },
  houseWallZ: -4.8, // fachada térrea do prédio
};

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -4.6, z: -3.4, yaw: 2.4 }),
  rhaenyra: withStart('rhaenyra', { x: -5.4, z: -3.5, yaw: 2.7 }),
};

// Porta de vidro de correr do apartamento (luz quente saindo) = objetivo final.
export const GLASS_DOOR = { x: -5.0, width: 1.6, height: 2.2 };

// Cerca-viva que separa A de B (alta 0.9 m, grossa), com portão de treliça ao sul.
// Portão: mesma convenção da fase 1 (folha ao longo de -Z local; abre para o LESTE).
export const HEDGE_AB = { x: -2.0, hx: 0.25, height: 0.9, segments: [{ zMin: -4.8, zMax: 2.4 }, { zMin: 3.6, zMax: 4.4 }] };
export const GATE = {
  hinge: { x: -2.0, z: 3.6 },
  latchPost: { x: -2.0, z: 2.4 },
  length: 1.2,
  closedYaw: 0,
  openYaw: -1.75, // ponta aberta ≈ (-0.82, 3.81)
  openTime: 1.0,
};
// Lanternas nos postes do portão: H (pedra pesada) e L (pedra leve).
export const LANTERNS = { H: { x: -2.0, z: 2.3, y: 1.15 }, L: { x: -2.0, z: 3.7, y: 1.15 } };

// Pedras de pressão.
export const PLATE_H = { x: -5.0, z: 2.9, r: 0.42, requires: 'large' };
export const PLATE_L = { x: -2.95, z: -3.85, r: 0.3, requires: 'any' };

// Cantinho da cerca-viva (onde fica a pedra leve). Fechado por cerca-viva baixa a oeste e ao sul;
// a leste é a cerca-viva principal; ao norte, a fachada. Vão de 0.46 m: só a Radhija passa.
export const NOOK = {
  minX: -3.6, maxX: -2.25, minZ: -4.8, maxZ: -3.1,
  hedgeHeight: 0.7,
  gap: { xMin: -3.27, xMax: -2.81, z: -2.975 },
};

// Lago: anel de círculos de água em volta da ilha (a margem visual deve seguir a união desses
// círculos, suavizada). Ilha = terra no centro. Ponte de madeira da margem oeste até a ilha,
// com guarda-corpos (colisores) dos dois lados; sobre a ponte a água é ignorada (exceptRect).
export const ISLAND = { x: 3.2, z: -0.6, r: 0.95 };
const RING_D = 1.8;
const RING_R = 0.88;
export const BRIDGE = {
  x0: 0.4, x1: 2.3, zMin: -1.05, zMax: -0.15,
  exceptRect: { minX: -0.25, maxX: 2.75, minZ: -1.05, maxZ: -0.15 },
};
export const POND = {
  island: ISLAND,
  ring: Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4;
    return { x: +(ISLAND.x + Math.cos(a) * RING_D).toFixed(3), z: +(ISLAND.z + Math.sin(a) * RING_D).toFixed(3), r: RING_R };
  }),
  waterY: -0.08, // superfície da água um pouco abaixo do gramado
};

// Ninho da gansa e a pantufa (item da fase) na ilha.
export const NEST = { x: 3.6, z: -0.85, r: 0.26 };
export const SLIPPER = { x: 3.3, z: -0.3, pickupR: 0.55, carrier: 'large' };

// Dona Gansa (NPC). Patrulha em linha na margem oeste, guardando a cabeceira da ponte.
export const GOOSE = {
  home: { x: -0.1, z: -0.6 },
  patrol: [{ x: -0.1, z: -1.9 }, { x: -0.1, z: 0.7 }],
  radius: 0.22,
  alertR: 1.6, // dog ATIVA mais perto que isso → grasna e avança
  lureR: 7.5, // latido até essa distância → ela vai ver
  lureStop: 1.9, // para a essa distância de quem latiu
  curiousTime: 9, // s parada, curiosa
  walkSpeed: 0.8,
  chargeSpeed: 2.6,
  chargeTime: 1.4,
  knockback: 1.3,
  cooldown: 1.6,
};
// Sugestões para objetivo/dicas (não são obrigatórias para a mecânica).
export const LURE_SPOT = { x: 2.8, z: 3.5 };
export const WAIT_SPOT = { x: -1.2, z: 2.0 };

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'osso-mesa', x: -5.8, z: -0.5, hint: 'perto da mesa do jardim' },
  { id: 'osso-ilha', x: 3.55, z: -1.0, hint: 'na ilha da gansa' },
  { id: 'osso-canto', x: 6.1, z: -4.1, hint: 'atrás do lago' },
];
export const COLLECTIBLE_PICKUP_R = 0.42;

// Objetivo final: levar a pantufa até a porta de vidro.
/** @type {import('../../types').Goal} */
export const GOAL = {
  x: -5.0, z: -3.95, r: 0.9,
  celebrate: { radhija: { x: -4.6, z: -3.6 }, rhaenyra: { x: -5.4, z: -3.6 } },
  entryPoints: [{ x: -6.1, z: -1.4 }, { x: -3.2, z: -1.8 }, { x: -5.6, z: 1.0 }],
};

// ---------------------------------------------------------------------
//  Colisores estáticos. Água: kind 'water'. except: retângulo onde o colisor é ignorado
//  (centro da dog dentro dele) — usado para a ponte sobre a água.
// ---------------------------------------------------------------------
const nookHedge = 0.125;
/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'fachada', shape: 'box', x: 0, z: -5.3, hx: 9, hz: 0.5 },
  { id: 'limite-oeste', shape: 'box', x: -7.1, z: 0, hx: 0.5, hz: 6 },
  { id: 'limite-leste', shape: 'box', x: 7.1, z: 0, hx: 0.5, hz: 6 },
  { id: 'limite-sul', shape: 'box', x: 0, z: 4.9, hx: 9, hz: 0.5 },

  // Cerca-viva A|B
  // (a folhagem passa ~7 cm de cada lado de HEDGE_AB.hx)
  ...HEDGE_AB.segments.map((s, i) => /** @type {import('../../types').BoxCollider} */ ({ id: `cerca-viva-${i}`, shape: 'box', x: HEDGE_AB.x, z: (s.zMin + s.zMax) / 2, hx: HEDGE_AB.hx + 0.04, hz: (s.zMax - s.zMin) / 2 })),

  // Cantinho da pedra leve
  { id: 'cantinho-oeste', shape: 'box', x: NOOK.minX - nookHedge, z: (NOOK.minZ + NOOK.maxZ) / 2 + nookHedge / 2, hx: nookHedge, hz: (NOOK.maxZ - NOOK.minZ) / 2 + nookHedge },
  { id: 'cantinho-sul-a', shape: 'box', x: (NOOK.minX - 2 * nookHedge + NOOK.gap.xMin) / 2, z: NOOK.gap.z, hx: (NOOK.gap.xMin - (NOOK.minX - 2 * nookHedge)) / 2, hz: nookHedge },
  { id: 'cantinho-sul-b', shape: 'box', x: (NOOK.gap.xMax + NOOK.maxX) / 2, z: NOOK.gap.z, hx: (NOOK.maxX - NOOK.gap.xMax) / 2, hz: nookHedge },
  { id: 'cantinho-vao-grande', shape: 'box', x: (NOOK.gap.xMin + NOOK.gap.xMax) / 2, z: NOOK.gap.z, hx: (NOOK.gap.xMax - NOOK.gap.xMin) / 2, hz: nookHedge, blocks: 'large' },

  // Quintal
  { id: 'mesa-jardim', shape: 'circle', x: -4.6, z: -0.6, r: 0.75 },

  // Lago (anel de água) + guarda-corpos da ponte + ninho
  ...POND.ring.map((c, i) => /** @type {import('../../types').CircleCollider} */ ({
    id: `lago-${i}`, shape: 'circle', x: c.x, z: c.z, r: c.r, kind: 'water',
    // os círculos que a ponte cruza (135°, 180°, 225°) ignoram a dog sobre a ponte
    ...(i >= 3 && i <= 5 ? { except: BRIDGE.exceptRect } : {}),
  })),
  { id: 'ponte-guarda-norte', shape: 'segment', ax: BRIDGE.x0, az: BRIDGE.zMin, bx: BRIDGE.x1, bz: BRIDGE.zMin, t: 0.04 },
  { id: 'ponte-guarda-sul', shape: 'segment', ax: BRIDGE.x0, az: BRIDGE.zMax, bx: BRIDGE.x1, bz: BRIDGE.zMax, t: 0.04 },
  { id: 'ninho', shape: 'circle', x: NEST.x, z: NEST.z, r: NEST.r + 0.07 }, // com a palha solta em volta (até ~0,4 m)
];

export const KEEP_CLEAR = [
  { id: 'porta→cantinho', from: [-4.8, -3.4], to: [-3.04, -2.4], width: 1.0 },
  { id: 'porta→pedra pesada', from: [-4.8, -3.4], to: [-5.0, 2.9], width: 1.2 },
  { id: 'pedra pesada→portão', from: [-5.0, 2.9], to: [-2.9, 3.0], width: 1.2 },
  { id: 'portão→gramado sul', from: [-1.1, 3.0], to: [2.8, 3.5], width: 1.2 },
  { id: 'margem oeste (gansa)', rect: { minX: -1.7, maxX: 0.45, minZ: -2.4, maxZ: 1.4 } },
  { id: 'ilha', circle: { x: ISLAND.x, z: ISLAND.z, r: ISLAND.r } },
];
export const TALL_PROP_RULE = { allowedIfZLessThan: -4.0, orOutsideBounds: true };

// ---------------------------------------------------------------------
//  Navegação da companheira (flags desta fase: gateOpen). A gansa não entra no grafo.
// ---------------------------------------------------------------------
export const NAV_NODES = {
  A_door: { x: -4.7, z: -3.0 },
  A_mid: { x: -3.2, z: -1.6 },
  A_nookOut: { x: -3.04, z: -2.3 },
  A_nookIn: { x: -2.95, z: -3.7 },
  A_south: { x: -3.4, z: 1.6 },
  A_plateH: { x: -4.6, z: 2.4 },
  A_gate: { x: -2.9, z: 3.0 },
  B_gate: { x: -1.1, z: 3.0 },
  B_south: { x: 1.0, z: 3.4 },
  B_lure: { x: 2.8, z: 3.5 },
  B_se: { x: 5.2, z: 3.0 },
  B_east: { x: 6.25, z: -0.6 },
  B_ne: { x: 5.6, z: -4.0 },
  B_north: { x: 2.0, z: -4.0 },
  B_nw: { x: -0.9, z: -3.4 },
  B_west: { x: -0.9, z: 0.2 },
  Br_W: { x: 0.15, z: -0.6 },
  Br_E: { x: 2.55, z: -0.6 },
  I_nest: { x: 3.1, z: -0.45 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['A_door', 'A_mid'],
  ['A_door', 'A_nookOut'],
  ['A_mid', 'A_nookOut'],
  ['A_nookOut', 'A_nookIn', { requires: 'small' }],
  ['A_mid', 'A_south'],
  ['A_south', 'A_plateH'],
  ['A_south', 'A_gate'],
  ['A_plateH', 'A_gate'],
  ['A_gate', 'B_gate', { requires: 'gateOpen' }],
  ['B_gate', 'B_south'],
  ['B_gate', 'B_west'],
  ['B_south', 'B_west'],
  ['B_south', 'B_lure'],
  ['B_lure', 'B_se'],
  ['B_se', 'B_east'],
  ['B_east', 'B_ne'],
  ['B_ne', 'B_north'],
  ['B_north', 'B_nw'],
  ['B_nw', 'B_west'],
  ['B_west', 'Br_W'],
  ['Br_W', 'Br_E'],
  ['Br_E', 'I_nest'],
];

// Noite: lua alta a nordeste (luz fria e suave) + luzes práticas quentes (lanternas, cordões, porta).
export const SUN = { direction: [0.42, 0.72, -0.55], color: '#a9bfff', intensity: 1.0 };

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -4.1, maxX: 4.6, minZ: -3.75, maxZ: 2.7 },
  title: { center: { x: -4.2, z: -3.3 }, radius: 5.4, angle: 0.55, height: 2.0, look: { x: -5.0, y: 0.85, z: -3.7 } },
  celebrate: { pos: [GOAL.x + 0.35, 1.3, GOAL.z + 3.1], look: [GOAL.x, 0.34, GOAL.z + 0.05] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

export const LAYOUT = {
  WORLD, DOGS, GLASS_DOOR, HEDGE_AB, GATE, LANTERNS, PLATE_H, PLATE_L, NOOK, ISLAND, BRIDGE, POND, NEST, SLIPPER, GOOSE,
  LURE_SPOT, WAIT_SPOT, COLLECTIBLES, COLLECTIBLE_PICKUP_R, GOAL, STATIC_COLLIDERS, KEEP_CLEAR, TALL_PROP_RULE,
  NAV_NODES, NAV_EDGES, SUN, CAMERA,
};
export default LAYOUT;
