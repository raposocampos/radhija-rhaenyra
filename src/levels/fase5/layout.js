// =====================================================================
//  FASE 5 · Operação Ursinho — LAYOUT (fonte única de verdade para coordenadas).
//  Dentro de casa numa tarde de chuva, em corte de maquete (sem teto; paredes internas cortadas a
//  meia altura): SALA a oeste (caminha, sofá, cercadinho), CORREDOR no meio (escada, cabideiro) e
//  COZINHA a leste (bancada, geladeira, mesa com toalha comprida).
//  Mesmas convenções das outras fases: metros, Y para cima, Norte = -Z (parede das janelas), câmera ao sul.
//
//  Beats do puzzle (o pulo da Rhaenyra):
//   1. PORTÃOZINHO entre a sala e o corredor: baixo, a Rhaenyra pula (Espaço); a trava fica do lado do
//      corredor — ela abre (E) e o portão fica aberto para a Radhija.
//   2. BARRICADA de caixas da mudança na porta da cozinha: a caixa de LIVROS não sai do lugar e a de
//      ALMOFADAS encalha na soleira se empurrada pelo corredor. A Rhaenyra pula para a cozinha e empurra a
//      caixa de almofadas de lá para o corredor: ela desmonta e libera a passagem.
//   3. O URSINHO está debaixo da mesa da cozinha, atrás da toalha comprida: só a Radhija cabe.
//      Levem-no para a caminha na sala (GOAL).
// =====================================================================
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -6.4, maxX: 6.4, minZ: -3.8, maxZ: 3.4 } };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -4.5, z: 1.15, yaw: 1.7 }),
  rhaenyra: withStart('rhaenyra', { x: -5.1, z: 0.95, yaw: 1.6 }),
};

// Paredes: a do fundo (norte) é inteira, com as janelas; as internas e as laterais são cortadas a meia
// altura (corte de maquete), e a do sul é só o rodapé do corte.
export const WALLS = { northH: 2.7, cutH: 1.25, t: 0.12 };
// Divisória sala | corredor (x = -1,8) com a passagem do portãozinho (z de -0,2 a 1,0).
export const WALL_SH = { x: -1.8, gap: { z0: -0.2, z1: 1.0 } };
// Divisória corredor | cozinha (x = 2,0) com a porta da cozinha (z de -0,6 a 0,6).
export const WALL_HK = { x: 2.0, gap: { z0: -0.6, z1: 0.6 } };

// Portãozinho de bebê (pulável): dobradiça no sul, abre para o leste (folha ao longo de -Z local).
export const PET_GATE = {
  hinge: { x: WALL_SH.x, z: WALL_SH.gap.z1 }, latchPost: { x: WALL_SH.x, z: WALL_SH.gap.z0 },
  length: WALL_SH.gap.z1 - WALL_SH.gap.z0, closedYaw: 0, openYaw: -1.6, openTime: 0.8, height: 0.42,
};
// Trava do portãozinho: só alcança quem está do lado do corredor (leste).
export const LATCH = { x: WALL_SH.x + 0.24, z: WALL_SH.gap.z0 + 0.12, r: 0.6, duration: 0.7 };

// Barricada na porta da cozinha: caixa de LIVROS (fixa, pulável) e caixa de ALMOFADAS (empurrável,
// pulável). A de almofadas só anda para o oeste (encalha na soleira para o leste) e desmonta em minX.
export const BOX_BOOKS = { x: WALL_HK.x, z: -0.3, half: 0.3, height: 0.42 };
export const BOX_PILLOWS = {
  start: { x: WALL_HK.x, z: 0.3 }, half: 0.3, height: 0.42,
  minX: 1.25, maxX: WALL_HK.x, minZ: 0.3, maxZ: 0.3, pushSpeed: 0.75,
};
export const THRESHOLD = { x: WALL_HK.x + 0.32, z0: WALL_HK.gap.z0, z1: WALL_HK.gap.z1 }; // soleira (visual)

// Mesa da cozinha com toalha comprida: a Rhaenyra não cabe embaixo; a Radhija sim.
export const TABLE = { x: 4.7, z: 1.3, hx: 0.62, hz: 0.42, height: 0.76, drop: 0.36 };
export const BEAR = { x: TABLE.x + 0.1, z: TABLE.z + 0.2, pickupR: 0.55 }; // perto da borda sul: as patinhas aparecem

// Cercadinho de brinquedos na sala (cerca baixa, pulável): o ossinho de lá é da Rhaenyra.
export const PEN = { x0: -3.6, x1: -2.4, z0: 1.6, z1: 2.8, height: 0.38 };
// Caminha das dogs (GOAL) e outros pontos do cenário.
export const DOG_BED = { x: -5.25, z: 2.4, r: 0.55 };
export const SOFA = { x: -4.6, z: -3.25, hx: 1.1, hz: 0.42 };
export const COFFEE_TABLE = { x: -4.6, z: -1.75, hx: 0.5, hz: 0.28, height: 0.38 };
export const STAIRS = { x0: -1.3, x1: 1.3, z0: -3.8, z1: -2.6 };
export const COUNTER = { x0: 2.1, x1: 5.1, z0: -3.8, z1: -3.2, height: 0.9 };
export const FRIDGE = { x: 5.75, z: -3.45, hx: 0.4, hz: 0.35, height: 1.85 };

/** Parede fina ao longo de Z (x fixo), de z0 a z1. @returns {import('../../types').BoxCollider} */
const wallZ = (id, x, z0, z1, extra = {}) => ({ id, shape: 'box', x, z: (z0 + z1) / 2, hx: WALLS.t / 2, hz: (z1 - z0) / 2, ...extra });
/** Parede fina ao longo de X (z fixo), de x0 a x1. @returns {import('../../types').BoxCollider} */
const wallX = (id, z, x0, x1, extra = {}) => ({ id, shape: 'box', x: (x0 + x1) / 2, z, hx: (x1 - x0) / 2, hz: WALLS.t / 2, ...extra });

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  // paredes externas
  { id: 'parede-norte', shape: 'box', x: 0, z: -4.0, hx: 6.9, hz: 0.2 },
  { id: 'parede-sul', shape: 'box', x: 0, z: 3.6, hx: 6.9, hz: 0.2 },
  { id: 'parede-oeste', shape: 'box', x: -6.6, z: 0, hx: 0.2, hz: 4.2 },
  { id: 'parede-leste', shape: 'box', x: 6.6, z: 0, hx: 0.2, hz: 4.2 },
  // divisórias (as passagens ficam no meio)
  wallZ('divisoria-sala-norte', WALL_SH.x, -3.8, WALL_SH.gap.z0),
  wallZ('divisoria-sala-sul', WALL_SH.x, WALL_SH.gap.z1, 3.4),
  wallZ('divisoria-cozinha-norte', WALL_HK.x, -3.8, WALL_HK.gap.z0),
  wallZ('divisoria-cozinha-sul', WALL_HK.x, WALL_HK.gap.z1, 3.4),
  // barricada: caixa de livros (pulável)
  { id: 'caixa-livros', shape: 'box', x: BOX_BOOKS.x, z: BOX_BOOKS.z, hx: BOX_BOOKS.half, hz: BOX_BOOKS.half, jumpable: true, height: BOX_BOOKS.height },
  { id: 'pilha-caixas', shape: 'box', x: 2.42, z: -1.2, hx: 0.3, hz: 0.36 },
  // sala
  { id: 'sofa', shape: 'box', x: SOFA.x, z: SOFA.z, hx: SOFA.hx, hz: SOFA.hz },
  { id: 'mesa-de-centro', shape: 'box', x: COFFEE_TABLE.x, z: COFFEE_TABLE.z, hx: COFFEE_TABLE.hx, hz: COFFEE_TABLE.hz, jumpable: true, height: COFFEE_TABLE.height },
  { id: 'poltrona', shape: 'box', x: -2.75, z: -2.95, hx: 0.42, hz: 0.42 },
  { id: 'estante', shape: 'box', x: -6.15, z: -0.9, hx: 0.25, hz: 0.9 },
  { id: 'abajur', shape: 'circle', x: -6.0, z: -3.35, r: 0.18 },
  { id: 'vaso-sala', shape: 'circle', x: -6.05, z: 0.75, r: 0.22 },
  // cercadinho (quatro cercas baixas, puláveis)
  wallX('cercadinho-norte', PEN.z0, PEN.x0, PEN.x1, { jumpable: true, height: PEN.height }),
  wallX('cercadinho-sul', PEN.z1, PEN.x0, PEN.x1, { jumpable: true, height: PEN.height }),
  wallZ('cercadinho-oeste', PEN.x0, PEN.z0, PEN.z1, { jumpable: true, height: PEN.height }),
  wallZ('cercadinho-leste', PEN.x1, PEN.z0, PEN.z1, { jumpable: true, height: PEN.height }),
  // corredor
  { id: 'escada', shape: 'box', x: (STAIRS.x0 + STAIRS.x1) / 2, z: (STAIRS.z0 + STAIRS.z1) / 2, hx: (STAIRS.x1 - STAIRS.x0) / 2, hz: (STAIRS.z1 - STAIRS.z0) / 2 },
  { id: 'cabideiro', shape: 'circle', x: -1.35, z: -2.25, r: 0.2 },
  { id: 'aparador', shape: 'box', x: 1.55, z: -1.95, hx: 0.3, hz: 0.2 },
  { id: 'porta-guarda-chuva', shape: 'circle', x: -1.4, z: 2.9, r: 0.16 },
  { id: 'sapateira', shape: 'box', x: 0.3, z: 3.15, hx: 0.5, hz: 0.17 },
  // cozinha
  { id: 'bancada', shape: 'box', x: (COUNTER.x0 + COUNTER.x1) / 2, z: (COUNTER.z0 + COUNTER.z1) / 2, hx: (COUNTER.x1 - COUNTER.x0) / 2, hz: (COUNTER.z1 - COUNTER.z0) / 2 },
  { id: 'geladeira', shape: 'box', x: FRIDGE.x, z: FRIDGE.z, hx: FRIDGE.hx, hz: FRIDGE.hz },
  { id: 'saco-de-racao', shape: 'box', x: 2.5, z: -2.75, hx: 0.22, hz: 0.18 },
  { id: 'caixas-cozinha', shape: 'box', x: 5.75, z: 2.8, hx: 0.36, hz: 0.32 },
  // mesa: só os pés para a Radhija; o tampo + toalha inteiro para a Rhaenyra
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => /** @type {import('../../types').CircleCollider} */ ({
    id: `pe-da-mesa-${i + 1}`, shape: 'circle', x: TABLE.x + sx * (TABLE.hx - 0.07), z: TABLE.z + sz * (TABLE.hz - 0.07), r: 0.035,
  })),
  { id: 'mesa-toalha', shape: 'box', x: TABLE.x, z: TABLE.z, hx: TABLE.hx, hz: TABLE.hz, blocks: 'large' },
  { id: 'cadeira-1', shape: 'box', x: TABLE.x - 0.3, z: TABLE.z - TABLE.hz - 0.12, hx: 0.2, hz: 0.18 },
  { id: 'cadeira-2', shape: 'box', x: TABLE.x + 0.3, z: TABLE.z - TABLE.hz - 0.12, hx: 0.2, hz: 0.18 },
  { id: 'cadeira-3', shape: 'box', x: TABLE.x + TABLE.hx + 0.42, z: TABLE.z + 0.15, hx: 0.2, hz: 0.2 },
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'osso-cercadinho', x: (PEN.x0 + PEN.x1) / 2, z: (PEN.z0 + PEN.z1) / 2, hint: 'dentro do cercadinho (só pulando)' },
  { id: 'osso-escada', x: 1.0, z: -2.25, hint: 'no pé da escada' },
  { id: 'osso-geladeira', x: 6.05, z: -2.65, hint: 'ao lado da geladeira' },
];
export const COLLECTIBLE_PICKUP_R = 0.42;

export const NAV_NODES = {
  S_bed: { x: -4.6, z: 1.45 },
  S_mid: { x: -4.2, z: -0.5 },
  S_gate: { x: -2.35, z: 0.4 },
  H_gate: { x: -1.15, z: 0.2 },
  H_mid: { x: 0.1, z: -0.6 },
  H_box: { x: 1.1, z: 0.3 },
  K_door: { x: 2.75, z: 0.3 },
  K_mid: { x: 3.4, z: 1.9 },
  K_table: { x: TABLE.x, z: 2.3 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['S_bed', 'S_mid'],
  ['S_bed', 'S_gate'],
  ['S_mid', 'S_gate'],
  ['S_gate', 'H_gate', { requires: 'petGate' }],
  ['H_gate', 'H_mid'],
  ['H_gate', 'H_box'],
  ['H_mid', 'H_box'],
  ['H_box', 'K_door', { requires: 'boxClear' }],
  ['K_door', 'K_mid'],
  ['K_mid', 'K_table'],
];

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: DOG_BED.x, z: DOG_BED.z, r: 0.85,
  celebrate: { radhija: { x: -4.98, z: 2.32 }, rhaenyra: { x: -5.5, z: 2.48 } }, // as duas dentro da caminha
  entryPoints: [{ x: -3.9, z: 0.4 }, { x: -5.8, z: -0.4 }, { x: -2.6, z: 0.5 }],
};

/** "Sol" desta fase: claridade fria e difusa de um dia de chuva, quase de cima (sem teto na maquete). */
export const SUN = { direction: [0.22, 0.92, 0.32], color: '#d6defa', intensity: 1.15 };

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -4.3, maxX: 4.6, minZ: -2.5, maxZ: 2.3 },
  title: { center: { x: -4.6, z: 1.4 }, radius: 5.0, angle: 0.5, height: 2.0, look: { x: -5.1, y: 0.6, z: 2.0 } },
  celebrate: { pos: [GOAL.x + 0.75, 1.3, GOAL.z + 2.1], look: [GOAL.x + 0.05, 0.28, GOAL.z - 0.05] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  // GATE: o portão principal da fase (o feedback desenha o brilho de "abriu" ao longo dele)
  GATE: PET_GATE,
  WORLD, DOGS, WALLS, WALL_SH, WALL_HK, PET_GATE, LATCH, BOX_BOOKS, BOX_PILLOWS, THRESHOLD, TABLE, BEAR, PEN, DOG_BED,
  SOFA, COFFEE_TABLE, STAIRS, COUNTER, FRIDGE, STATIC_COLLIDERS, COLLECTIBLES, COLLECTIBLE_PICKUP_R, NAV_NODES, NAV_EDGES,
  GOAL, SUN, CAMERA,
};
export default LAYOUT;
