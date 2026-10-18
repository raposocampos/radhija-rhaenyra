// =====================================================================
//  FASE 9 · Biblioteca do Vovô — LAYOUT (fonte única de verdade para coordenadas).
//  A casa do vovô numa noite de chuva, em corte de maquete (sem teto; divisórias e laterais cortadas a meia
//  altura). Quatro cômodos lado a lado, de oeste para leste: ESCRITÓRIO (porta fechada e portinha de gato),
//  HALL de entrada (onde as dogs começam), BIBLIOTECA (estantes altas, lareira e a poltrona do vovô) e JARDIM DE
//  INVERNO (vidraças com chuva, plantas e o ventilador). Um duto do aquecedor corre no alto da parede do fundo, do
//  jardim de inverno até a grade em cima do armário do escritório.
//  Mesmas convenções das outras fases: metros, Y para cima, Norte = -Z (parede do fundo), câmera ao sul.
//
//  Beats do puzzle (a fase maior da demo antes da 10; entrega na mesinha ao lado da poltrona):
//   ÓCULOS DO VOVÔ (na boca de quem pegar; a Radhija sobe): esquecidos na prateleira alta da estante leste.
//     1. A escadinha de rodinhas está travada: a alavanca do freio fica no alto da divisória (impulso na parede).
//     2. O globo terrestre está no trilho, entre a escada e os óculos: a Rhaenyra o empurra para a frente da
//        lareira e depois leva a escada pelo trilho até debaixo dos óculos (Shift).
//     3. Destravada, a escada rola com peso em cima: só o peso da Rhaenyra parada no pé dela a segura (Fica). A
//        Radhija sobe os degraus largos (E), pega os óculos e desce. Sem ninguém segurando, a escada rola e ela
//        desce de novo.
//   LIVRO DE HISTÓRIAS (pesado: só a Rhaenyra carrega): no alto do armário do escritório, com o gato Bichano
//     dormindo em cima. Latido não adianta e o superbafo daqui de baixo não chega lá em cima; a grade do aquecedor
//     sopra bem ali.
//     1. No jardim de inverno, o registro do duto fica no alto da parede (impulso na parede: abre).
//     2. O ventilador está virado para as plantas: a Rhaenyra o empurra até a grade de baixo do duto.
//     3. A Radhija solta o superbafo no vento: o duto leva o cheiro até a grade do escritório, o Bichano pula
//        ofendido, derruba o livro e sai pela portinha de gato.
//     4. A porta do escritório: impulso na maçaneta (do hall ou de dentro) destrava e ela abre, mas a mola fecha
//        de novo em DOOR_HANDLE.holdTime s. Com alguém no vão (a Radhija com o Fica), ela espera. Com o livro na
//        boca não dá impulso: presa lá dentro, a Rhaenyra larga o livro (E) e abre a porta.
// =====================================================================
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -8.0, maxX: 8.0, minZ: -3.6, maxZ: 3.0 } };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.2, z: 1.15, yaw: 2.3 }),
  rhaenyra: withStart('rhaenyra', { x: -3.85, z: 1.55, yaw: 2.1 }),
};

// Paredes: a do fundo (norte) é inteira e alta (estantes e o duto); divisórias e laterais cortadas a meia altura;
// a do sul é só o rodapé do corte. As faces internas ficam nos limites de WORLD.bounds.
export const WALLS = { northH: 3.0, cutH: 1.3, t: 0.2 };
/** Divisória escritório | hall (x fixo): o vão da porta e a portinha de gato (só a Radhija e o gato passam). */
export const WALL_EH = { x: -4.4, door: { z0: -0.15, z1: 0.8 }, catFlap: { z0: 1.85, z1: 2.25 } };
/** Divisória hall | biblioteca: arco largo. */
export const WALL_HL = { x: -1.6, gap: { z0: -1.25, z1: 1.55 } };
/** Divisória biblioteca | jardim de inverno: portas de vidro abertas. */
export const WALL_LJ = { x: 4.4, gap: { z0: -0.95, z1: 1.45 } };
/** Vidraças do jardim de inverno na parede do fundo; o trecho de alvenaria (com o duto) fica de x0 a x1. */
export const CONSERVATORY = { x0: WALL_LJ.x, x1: WORLD.bounds.maxX, brick: { x0: 5.45, x1: 6.85 } };
/** Porta da frente da casa (na parede do fundo do hall; fechada, só cenário). */
export const FRONT_DOOR = { x: -3.0, w: 1.0, h: 2.15 };

/**
 * Porta do escritório: folha com dobradiça no lado sul do vão, abre para dentro do escritório (oeste). A mola
 * fecha de novo depois de DOOR_HANDLE.holdTime s; ao fechar, espera quem estiver no caminho da folha.
 */
export const DOOR = {
  hinge: { x: WALL_EH.x, z: WALL_EH.door.z1 }, latchPost: { x: WALL_EH.x, z: WALL_EH.door.z0 },
  length: WALL_EH.door.z1 - WALL_EH.door.z0, closedYaw: 0, openYaw: Math.PI / 2 * 0.94, openTime: 0.9, closeTime: 1.1,
  height: 2.0,
};
/**
 * Maçaneta (alavanca alta) dos dois lados da porta, perto do batente: impulso na parede destrava e abre.
 * @type {import('../../types').WallButtonCfg}
 */
export const DOOR_HANDLE = { x: WALL_EH.x + WALLS.t / 2, z: WALL_EH.door.z0 - 0.32, nx: 1, nz: 0, top: 1.1, kind: 'lever', mode: 'timed', holdTime: 3.5 };
/** @type {import('../../types').WallButtonCfg} */
export const DOOR_HANDLE_IN = { ...DOOR_HANDLE, x: WALL_EH.x - WALLS.t / 2, nx: -1 };

// ---- escritório
/** Armário alto encostado no fundo: o Bichano dorme lá em cima, deitado no livro. */
export const WARDROBE = { x: -6.95, z: -3.28, hx: 0.5, hz: 0.32, h: 2.05 };
/** Escrivaninha na parede oeste (a Radhija passa por baixo; a Rhaenyra não) e a cadeira. */
export const DESK = { x: -7.55, z: -0.75, hx: 0.36, hz: 0.72, h: 0.76 };
export const DESK_CHAIR = { x: -6.95, z: -0.55, r: 0.24 };
/** Onde o livro cai quando o Bichano pula, e o caminho do gato até a portinha e a almofada dele no hall. */
export const BOOK_FALL = { x: -6.55, z: -2.45 };
export const CAT = {
  top: { x: WARDROBE.x - 0.1, y: WARDROBE.h, z: WARDROBE.z + 0.05 },
  smellR: 0.55,
  path: [
    { x: -6.3, z: -2.2 }, { x: -5.6, z: -0.9 }, { x: -5.15, z: 1.45 }, { x: -4.75, z: 2.05 },
    { x: WALL_EH.x, z: 2.05 }, { x: -3.95, z: 2.25 }, { x: -2.6, z: 2.45 },
  ],
  bed: { x: -2.35, z: 2.5, yaw: -2.4 },
  walkSpeed: 1.25,
};

// ---- hall
export const HALL_BENCH = { x: -3.55, z: -3.33, hx: 0.55, hz: 0.2, h: 0.46 }; // banco com sapatos
export const UMBRELLA_STAND = { x: -2.05, z: -3.25, r: 0.16 }; // guarda-chuva molhado pingando
export const COAT_RACK = { x: -4.0, z: -2.5, r: 0.2 };
export const CONSOLE = { x: -1.95, z: -1.8, hx: 0.2, hz: 0.42, h: 0.82 }; // aparador com a tigela de chaves

// ---- biblioteca
/** Estantes encostadas no fundo (oeste e leste) e a lareira entre elas. */
export const SHELF_W = { x0: -1.5, x1: 0.45, z: -3.42, depth: 0.36, h: 2.4 };
export const FIREPLACE = { x0: 0.45, x1: 1.95, z: -3.6, depth: 0.42, h: 1.35, hearth: 0.38 };
export const SHELF_E = { x0: 1.95, x1: WALL_LJ.x - WALLS.t / 2, z: -3.42, depth: 0.36, h: 2.4 };
/** Trilho da escada ao longo da estante leste (z do centro da escada) e o vão dela (meia largura = meia fundura). */
const LANE_Z = SHELF_E.z + SHELF_E.depth / 2 + 0.45;
/**
 * Escadinha de biblioteca com rodinhas (empurrável só no trilho, pela Rhaenyra). Começa travada no fim leste;
 * em minX ela fica debaixo dos óculos. Degraus largos de sul para norte, até o patamar `top`.
 */
export const LADDER = {
  start: { x: 3.35, z: LANE_Z }, half: 0.45, height: 1.1, minX: 2.4, maxX: 3.35, minZ: LANE_Z, maxZ: LANE_Z,
  pushSpeed: 0.7, steps: 4, top: 1.1, rollBack: 0.32,
};
/**
 * Globo terrestre de rodinhas no trilho, entre a escada e os óculos (só anda no trilho, até a frente da lareira).
 * Entre ele e a escada sobra o lugar da Rhaenyra para empurrá-lo para o oeste.
 */
export const GLOBE = { start: { x: 2.15, z: LANE_Z }, half: 0.24, minX: 1.2, maxX: 2.2, minZ: LANE_Z, maxZ: LANE_Z, pushSpeed: 0.8 };
/** Óculos do vovô na prateleira alta, acima de onde a escada para (y = altura da prateleira). */
export const GLASSES = { x: LADDER.minX, y: 1.72, z: SHELF_E.z + 0.04 };
/** Onde a Rhaenyra segura a escada: pé da escada, de um lado ou do outro (centro ± side). */
export const LADDER_HOLD = { side: 0.62, z: LANE_Z + 0.22, r: 0.36 };
/** De onde a Radhija sobe (na frente dos degraus) e quanto tempo leva. */
export const CLIMB = { front: 0.62, r: 0.36, faceTol: 1.0, upTime: 1.5, grabTime: 0.7, downTime: 1.2, slipTime: 0.9 };
/**
 * Alavanca do freio da escada, no alto da divisória leste (impulso na parede): solta o freio de vez.
 * @type {import('../../types').WallButtonCfg}
 */
export const BRAKE_LEVER = { x: WALL_LJ.x - WALLS.t / 2, z: -1.55, nx: -1, nz: 0, top: 1.1, kind: 'lever', mode: 'once' };

/** Poltrona do vovô, a mesinha (entrega) e o resto da sala de leitura. */
export const ARMCHAIR = { x: 0.15, z: -1.45, hx: 0.42, hz: 0.42, yaw: 0.55 };
export const SIDE_TABLE = { x: 0.95, z: -1.05, r: 0.26, h: 0.58 };
export const FOOTSTOOL = { x: 0.85, z: -2.05, hx: 0.22, hz: 0.22, h: 0.36 };
export const FLOOR_LAMP = { x: -0.6, z: -2.3, r: 0.16 };
export const RUG = { x: 1.2, z: -1.4, rx: 1.45, rz: 0.95 };
/** Onde cada objeto fica na mesinha. */
export const TABLE_SPOTS = { glasses: { x: 0.88, y: SIDE_TABLE.h + 0.02, z: -1.12 }, book: { x: 1.02, y: SIDE_TABLE.h + 0.02, z: -0.98 } };

// ---- jardim de inverno
/** Duto: a grade de baixo no jardim de inverno (entrada) e a grade alta do escritório (saída, sobre o armário). */
export const DUCT = {
  inlet: { x: 6.05, z: WORLD.bounds.minZ + 0.32, r: 0.42 },
  outlet: { x: CAT.top.x, z: WORLD.bounds.minZ + 0.28, dirX: 0, dirZ: 1, speed: 0.7 },
  travel: 2.4,
  y: 2.62, // altura do cano no alto da parede do fundo
};
/**
 * Registro do duto, no alto da alvenaria do jardim de inverno (impulso na parede): abre de vez.
 * @type {import('../../types').WallButtonCfg}
 */
export const DAMPER_LEVER = { x: 6.55, z: WORLD.bounds.minZ, nx: 0, nz: 1, top: 1.1, kind: 'lever', mode: 'once' };
/**
 * Ventilador de chão (empurrável em X e Z) soprando sempre para o norte. Alinhado: |x − grade| < alignTol e a
 * grade dentro do alcance do vento.
 */
export const FAN = {
  start: { x: 6.75, z: 0.7 }, half: 0.3, height: 0.95, minX: 5.3, maxX: 6.75, minZ: -2.75, maxZ: 1.0, pushSpeed: 0.8,
  wind: { offset: 0.34, length: 2.9, halfWidth: 0.36, strength: 2.6 }, alignTol: 0.2, alignZ: -0.4,
};
/**
 * Vasos grandes encostados na parede leste do jardim de inverno: entre eles (0,40 m) só a Radhija passa e o ossinho
 * fica atrás. Os limites do ventilador nunca o deixam encostar neles (sempre sobra um lado para empurrar).
 */
export const POTS = [{ x: 7.45, z: -1.0, r: 0.34 }, { x: 7.45, z: -2.08, r: 0.34 }];
export const WICKER_CHAIR = { x: 5.2, z: 2.05, r: 0.38 };
export const PLANT_TABLE = { x: 7.35, z: 2.35, hx: 0.4, hz: 0.24, h: 0.62 };

/** Parede fina ao longo de Z (x fixo), de z0 a z1. @returns {import('../../types').BoxCollider} */
const wallZ = (id, x, z0, z1, extra = {}) => ({ id, shape: 'box', x, z: (z0 + z1) / 2, hx: WALLS.t / 2, hz: (z1 - z0) / 2, ...extra });
const B = WORLD.bounds;

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  // divisórias (vãos de porta, portinha e arcos no meio)
  wallZ('divisoria-escritorio-norte', WALL_EH.x, B.minZ, WALL_EH.door.z0),
  wallZ('divisoria-escritorio-meio', WALL_EH.x, WALL_EH.door.z1, WALL_EH.catFlap.z0),
  wallZ('portinha-de-gato', WALL_EH.x, WALL_EH.catFlap.z0, WALL_EH.catFlap.z1, { blocks: 'large' }),
  wallZ('divisoria-escritorio-sul', WALL_EH.x, WALL_EH.catFlap.z1, B.maxZ),
  wallZ('divisoria-hall-norte', WALL_HL.x, B.minZ, WALL_HL.gap.z0),
  wallZ('divisoria-hall-sul', WALL_HL.x, WALL_HL.gap.z1, B.maxZ),
  wallZ('divisoria-jardim-norte', WALL_LJ.x, B.minZ, WALL_LJ.gap.z0),
  wallZ('divisoria-jardim-sul', WALL_LJ.x, WALL_LJ.gap.z1, B.maxZ),
  // escritório
  { id: 'armario', shape: 'box', x: WARDROBE.x, z: WARDROBE.z, hx: WARDROBE.hx, hz: WARDROBE.hz },
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => /** @type {import('../../types').CircleCollider} */ ({
    id: `pe-da-escrivaninha-${i + 1}`, shape: 'circle', x: DESK.x + sx * (DESK.hx - 0.05), z: DESK.z + sz * (DESK.hz - 0.05), r: 0.035,
  })),
  { id: 'escrivaninha', shape: 'box', x: DESK.x, z: DESK.z, hx: DESK.hx, hz: DESK.hz, blocks: 'large' },
  { id: 'cadeira', shape: 'circle', x: DESK_CHAIR.x, z: DESK_CHAIR.z, r: DESK_CHAIR.r },
  { id: 'cesto-de-papel', shape: 'circle', x: -7.6, z: 0.45, r: 0.14 },
  { id: 'arquivo', shape: 'box', x: -5.15, z: -3.35, hx: 0.3, hz: 0.25 },
  // hall
  { id: 'banco', shape: 'box', x: HALL_BENCH.x, z: HALL_BENCH.z, hx: HALL_BENCH.hx, hz: HALL_BENCH.hz },
  { id: 'porta-guarda-chuva', shape: 'circle', x: UMBRELLA_STAND.x, z: UMBRELLA_STAND.z, r: UMBRELLA_STAND.r },
  { id: 'cabideiro', shape: 'circle', x: COAT_RACK.x, z: COAT_RACK.z, r: COAT_RACK.r },
  { id: 'aparador', shape: 'box', x: CONSOLE.x, z: CONSOLE.z, hx: CONSOLE.hx, hz: CONSOLE.hz },
  // biblioteca
  { id: 'estante-oeste', shape: 'box', x: (SHELF_W.x0 + SHELF_W.x1) / 2, z: SHELF_W.z, hx: (SHELF_W.x1 - SHELF_W.x0) / 2, hz: SHELF_W.depth / 2 },
  { id: 'lareira', shape: 'box', x: (FIREPLACE.x0 + FIREPLACE.x1) / 2, z: B.minZ + FIREPLACE.depth / 2, hx: (FIREPLACE.x1 - FIREPLACE.x0) / 2, hz: FIREPLACE.depth / 2 },
  { id: 'estante-leste', shape: 'box', x: (SHELF_E.x0 + SHELF_E.x1) / 2, z: SHELF_E.z, hx: (SHELF_E.x1 - SHELF_E.x0) / 2, hz: SHELF_E.depth / 2 },
  { id: 'poltrona', shape: 'box', x: ARMCHAIR.x, z: ARMCHAIR.z, hx: ARMCHAIR.hx, hz: ARMCHAIR.hz },
  { id: 'mesinha', shape: 'circle', x: SIDE_TABLE.x, z: SIDE_TABLE.z, r: SIDE_TABLE.r },
  { id: 'pufe', shape: 'box', x: FOOTSTOOL.x, z: FOOTSTOOL.z, hx: FOOTSTOOL.hx, hz: FOOTSTOOL.hz, jumpable: true, height: FOOTSTOOL.h },
  { id: 'abajur', shape: 'circle', x: FLOOR_LAMP.x, z: FLOOR_LAMP.z, r: FLOOR_LAMP.r },
  // jardim de inverno
  ...POTS.map((p, i) => /** @type {import('../../types').CircleCollider} */ ({ id: `vaso-${i + 1}`, shape: 'circle', x: p.x, z: p.z, r: p.r })),
  { id: 'poltrona-de-vime', shape: 'circle', x: WICKER_CHAIR.x, z: WICKER_CHAIR.z, r: WICKER_CHAIR.r },
  { id: 'mesa-das-plantas', shape: 'box', x: PLANT_TABLE.x, z: PLANT_TABLE.z, hx: PLANT_TABLE.hx, hz: PLANT_TABLE.hz },
];

export const NAV_NODES = {
  O_mid: { x: -5.9, z: 0.4 }, O_north: { x: -6.0, z: -1.95 }, O_door: { x: -4.95, z: 0.32 }, O_flap: { x: -4.85, z: 2.05 },
  H_door: { x: -3.85, z: 0.32 }, H_mid: { x: -3.0, z: 0.9 }, H_north: { x: -3.0, z: -1.95 }, H_flap: { x: -3.95, z: 2.05 },
  L_arch: { x: -0.9, z: 0.15 }, L_mid: { x: 1.4, z: 0.35 }, L_north: { x: 2.9, z: -1.9 }, L_east: { x: 3.7, z: 0.25 },
  J_door: { x: 5.1, z: 0.25 }, J_mid: { x: 6.1, z: -0.5 }, J_north: { x: 6.0, z: -2.5 }, J_south: { x: 6.4, z: 1.9 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['O_mid', 'O_north'], ['O_mid', 'O_door'], ['O_mid', 'O_flap'], ['O_north', 'O_door'],
  ['O_door', 'H_door', { requires: 'doorOpen' }],
  ['O_flap', 'H_flap', { requires: 'small' }],
  ['H_door', 'H_mid'], ['H_mid', 'H_north'], ['H_mid', 'H_flap'], ['H_door', 'H_north'],
  ['H_mid', 'L_arch'], ['H_north', 'L_arch'],
  ['L_arch', 'L_mid'], ['L_mid', 'L_north'], ['L_mid', 'L_east'], ['L_north', 'L_east'],
  ['L_east', 'J_door'], ['J_door', 'J_mid'], ['J_mid', 'J_north'], ['J_mid', 'J_south'], ['J_door', 'J_south'],
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'escrivaninha', x: DESK.x + 0.02, z: DESK.z + 0.25 }, // debaixo da escrivaninha (só a Radhija; pela portinha também dá)
  { id: 'vasos', x: 7.68, z: -1.54 }, // entre os vasos grandes do jardim de inverno (só a Radhija)
  { id: 'lareira', x: -1.15, z: -2.75 }, // no cantinho ao lado da estante oeste
];
export const COLLECTIBLE_PICKUP_R = 0.42;

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: SIDE_TABLE.x, z: SIDE_TABLE.z, r: 0.85,
  celebrate: { radhija: { x: 1.35, z: -1.75 }, rhaenyra: { x: 1.85, z: -1.35 } }, // no tapete, na frente da lareira
  entryPoints: [{ x: 1.4, z: 0.2 }, { x: -0.6, z: -0.4 }],
};

/** Luar frio e azulado entrando de cima (sem teto na maquete), quase sem sombra dura; o calor vem das luzes da casa. */
export const SUN = { direction: [0.35, 0.86, 0.38], color: '#a9b9e6', intensity: 0.55 };

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.3, 4.4, 4.8],
  lookHeight: 0.3,
  limits: { minX: -6.6, maxX: 6.6, minZ: -2.3, maxZ: 1.9 },
  title: { center: { x: 1.1, z: -1.2 }, radius: 5.4, angle: 0.4, height: 2.3, look: { x: 1.0, y: 0.8, z: -1.9 } },
  celebrate: { pos: [GOAL.x + 0.9, 1.35, GOAL.z + 2.0], look: [GOAL.x + 0.25, 0.35, GOAL.z - 0.45] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  // GATE: a porta principal da fase (o feedback desenha o brilho de "abriu" ao longo dela)
  GATE: DOOR,
  WORLD, DOGS, WALLS, WALL_EH, WALL_HL, WALL_LJ, CONSERVATORY, FRONT_DOOR, DOOR, DOOR_HANDLE, DOOR_HANDLE_IN,
  WARDROBE, DESK, DESK_CHAIR, BOOK_FALL, CAT, HALL_BENCH, UMBRELLA_STAND, COAT_RACK, CONSOLE, SHELF_W, FIREPLACE,
  SHELF_E, LADDER, GLOBE, GLASSES, LADDER_HOLD, CLIMB, BRAKE_LEVER, ARMCHAIR, SIDE_TABLE, FOOTSTOOL, FLOOR_LAMP, RUG,
  TABLE_SPOTS, DUCT, DAMPER_LEVER, FAN, POTS, WICKER_CHAIR, PLANT_TABLE, STATIC_COLLIDERS, NAV_NODES, NAV_EDGES,
  COLLECTIBLES, COLLECTIBLE_PICKUP_R, GOAL, SUN, CAMERA,
};
export default LAYOUT;
