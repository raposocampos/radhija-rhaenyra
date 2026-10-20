// =====================================================================
//  FASE 8 · Lavanderia de Domingo — LAYOUT (fonte única de verdade para coordenadas).
//  A área de serviço da casa numa manhã de domingo, em corte de maquete (sem teto; laterais cortadas a meia
//  altura): na parede do fundo (norte) o armário de limpeza, a janela com sol, a secadora, a máquina de lavar
//  e o tanque; no meio, o varal elétrico de teto e a tábua de passar; a caminha fica no canto sudeste.
//  Mesmas convenções das outras fases: metros, Y para cima, Norte = -Z (parede do fundo), câmera ao sul.
//
//  Beats do puzzle (apresenta o impulso na parede da Rhaenyra):
//   MEIA (vai na boca da Radhija): presa com um pregador no varal de teto, lá no alto. A Rhaenyra pega impulso
//     nas patinhas da parede e aperta o botão do varal: ele desce por RACK_BUTTON.holdTime s. O pregador
//     segura firme: só o tranco de uma arrancada (Radhija, Shift) solta a meia. Leve-a até a caminha.
//   MANTINHA (vai no cesto): dobrada em cima da máquina de lavar, alta e grande demais para a boca. A Rhaenyra
//     empurra o cesto de rodinhas até a frente da máquina e aperta o botão de centrifugar (impulso): a máquina
//     chacoalha e a mantinha escorrega para dentro do cesto (sem o cesto, cai no chão e dá para pôr no cesto
//     encostando-o nela, E). Depois a Rhaenyra empurra o cesto até a caminha.
// =====================================================================
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -5.2, maxX: 5.2, minZ: -3.2, maxZ: 2.8 } };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.55, z: -0.55, yaw: 2.0 }),
  rhaenyra: withStart('rhaenyra', { x: -4.2, z: -0.15, yaw: 1.9 }),
};

// Paredes: a do fundo (norte) é inteira, com a janela; as laterais são cortadas a meia altura e a do sul é só o
// rodapé do corte. As faces internas ficam nos limites de WORLD.bounds.
export const WALLS = { northH: 2.7, cutH: 1.25, t: 0.2 };
/** Janela da parede do fundo (o sol da manhã entra por ela). */
export const WINDOW = { cx: -3.55, w: 1.4, sill: 1.05, h: 1.15 };

// Móveis encostados na parede do fundo (caixas: centro, meias medidas e altura).
export const CABINET = { x: -4.75, z: -2.93, hx: 0.42, hz: 0.27, h: 1.85 }; // armário de limpeza
export const DRYER = { x: -2.45, z: -2.89, hx: 0.31, hz: 0.31, h: 0.88 }; // secadora
export const WASHER = { x: -1.75, z: -2.89, hx: 0.31, hz: 0.31, h: 0.88 }; // máquina de lavar (a mantinha em cima)
export const TANK = { x: 3.85, z: -2.9, hx: 0.5, hz: 0.3, h: 0.86 }; // tanque com gabinete

/**
 * Botão de centrifugar, na parede ao lado da máquina (impulso na parede). Liga a centrífuga por holdTime s; a
 * mantinha escorrega da tampa SPIN.dropAt s depois do começo.
 * @type {import('../../types').WallButtonCfg}
 */
export const SPIN_BUTTON = { x: -0.95, z: -3.2, nx: 0, nz: 1, top: 1.08, kind: 'button', mode: 'timed', holdTime: 4 };
export const SPIN = { dropAt: 1.3, slideTime: 0.45, fallTime: 0.5 };
/** Onde a mantinha cai da máquina: no cesto, se ele estiver aqui (até r do centro); senão, no chão. */
export const CATCH = { x: WASHER.x, z: WASHER.z + WASHER.hz + 0.31, r: 0.32 };

/**
 * Botão do varal (impulso na parede): o varal elétrico desce por holdTime s e sobe sozinho.
 * @type {import('../../types').WallButtonCfg}
 */
export const RACK_BUTTON = { x: 0.35, z: -3.2, nx: 0, nz: 1, top: 1.1, kind: 'button', mode: 'timed', holdTime: 6 };
/**
 * Varal de teto: varetas leste-oeste de x0 a x1, centradas em z, com halfDepth de cada lado; em cima a `up`
 * de altura, embaixo a `down` (as dogs passam por baixo). Desce em lowerTime s e sobe em raiseTime s.
 */
export const RACK = { x0: 1.35, x1: 3.25, z: -1.25, halfDepth: 0.26, up: 1.85, down: 0.74, lowerTime: 1.1, raiseTime: 1.3 };
/**
 * A meia listrada, presa na vareta sul do varal (pendura `hang` m abaixo dela). Com o varal embaixo, a arrancada
 * da Radhija que passar com a cabeça a até grabR do ponto (x, z) dá o tranco e solta o pregador.
 */
export const SOCK = { x: 2.6, z: RACK.z + RACK.halfDepth, hang: 0.3, grabR: 0.4, nearR: 0.7 };

/**
 * Tábua de passar: a Rhaenyra e o cesto não chegam perto (colisor 'tabua'); a Radhija chega até as pernas em X (um
 * par de cada lado, legs: em z ± legZ, de pé a pé) e pega o ossinho de debaixo da tábua esticando o focinho.
 */
export const BOARD = { x: 0.2, z: 0.75, hx: 0.62, hz: 0.22, h: 0.82, legZ: 0.12, legX: 0.38 };

/**
 * Cesto de roupa com rodinhas (empurrável pela Rhaenyra, segurando Shift). Os limites deixam sempre uma dog
 * passar entre o cesto e as paredes; na frente das máquinas ele encosta (minZ) e sai pelos lados.
 */
export const BASKET = {
  start: { x: -3.9, z: 1.5 }, half: 0.27, height: 0.42,
  minX: -4.4, maxX: 4.4, minZ: CATCH.z, maxZ: 2.0, pushSpeed: 0.8,
};

/** Caminha das dogs (GOAL) no canto sudeste; com o cesto a até basketR dela, a mantinha vai para a caminha. */
export const DOG_BED = { x: 4.3, z: 1.75, r: 0.62, basketR: 0.95 };
/** Onde cada objeto fica na caminha. */
export const BED_SPOTS = { sock: { x: 4.12, z: 1.62 }, blanket: { x: 4.42, z: 1.85 } };

/** Decoração com colisor: pilha de roupa no canto sudoeste e balde com rodo perto do armário. */
export const PILE = { x: -4.55, z: 2.05, r: 0.32 };
export const BUCKET = { x: -3.95, z: -2.5, r: 0.18 };
/** Tapete redondo na frente das máquinas (só visual). */
export const RUG = { x: -2.1, z: -1.95, rx: 0.95, rz: 0.55 };

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'armario', shape: 'box', x: CABINET.x, z: CABINET.z, hx: CABINET.hx, hz: CABINET.hz },
  // (a porta redonda das duas sai 3 cm da frente)
  { id: 'secadora', shape: 'box', x: DRYER.x, z: DRYER.z + 0.015, hx: DRYER.hx, hz: DRYER.hz + 0.015 },
  { id: 'maquina', shape: 'box', x: WASHER.x, z: WASHER.z + 0.015, hx: WASHER.hx, hz: WASHER.hz + 0.015 },
  { id: 'tanque', shape: 'box', x: TANK.x, z: TANK.z, hx: TANK.hx, hz: TANK.hz },
  { id: 'tabua', shape: 'box', x: BOARD.x, z: BOARD.z, hx: BOARD.hx, hz: BOARD.hz, blocks: 'large' },
  // as pernas em X de cada lado, de pé a pé (só valem para a Radhija: a Rhaenyra e o cesto param na 'tabua')
  ...[-1, 1].map((s) => /** @type {import('../../types').SegmentCollider} */ ({
    id: `tabua-pernas-${s < 0 ? 'norte' : 'sul'}`, shape: 'segment', blocks: 'small', t: 0.03,
    ax: BOARD.x - BOARD.legX, az: BOARD.z + s * BOARD.legZ, bx: BOARD.x + BOARD.legX, bz: BOARD.z + s * BOARD.legZ,
  })),
  { id: 'pilha-de-roupa', shape: 'circle', x: PILE.x, z: PILE.z, r: PILE.r },
  { id: 'balde', shape: 'circle', x: BUCKET.x, z: BUCKET.z, r: BUCKET.r },
];

export const NAV_NODES = {
  W: { x: -3.6, z: -0.4 }, NW: { x: -3.3, z: -2.0 }, C: { x: -1.2, z: -0.45 }, NM: { x: -0.35, z: -2.25 },
  NE: { x: 2.2, z: -2.2 }, E: { x: 3.2, z: -0.6 }, SE: { x: 3.4, z: 1.45 }, S: { x: 1.55, z: 1.95 },
  SW: { x: -2.4, z: 1.95 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['W', 'NW'], ['W', 'C'], ['NW', 'C'], ['C', 'NM'], ['NM', 'NE'], ['C', 'E'], ['NE', 'E'],
  ['E', 'SE'], ['SE', 'S'], ['S', 'SW'], ['SW', 'W'], ['SW', 'C'],
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'tabua', x: BOARD.x, z: BOARD.z }, // debaixo da tábua de passar: só a Radhija alcança
  { id: 'tanque', x: 4.85, z: -2.85 }, // no cantinho atrás do tanque
  { id: 'roupas', x: -4.88, z: 2.48 }, // atrás da pilha de roupa
];
export const COLLECTIBLE_PICKUP_R = 0.42;

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: DOG_BED.x, z: DOG_BED.z, r: 0.9,
  celebrate: { radhija: { x: 3.95, z: 1.5 }, rhaenyra: { x: 4.6, z: 2.0 } }, // dentro da caminha
  celebrateRim: { x: DOG_BED.x, z: DOG_BED.z, r: DOG_BED.r - 0.1, tube: 0.11 }, // a borda (world/props.js buildDogBed)
  entryPoints: [{ x: 4.95, z: -0.6 }, { x: 2.4, z: 2.55 }],
};

/** Sol da manhã de domingo vindo do norte (pela janela): a parede do fundo faz sombra e a janela, um retângulo de sol. */
export const SUN = { direction: [-0.3, 0.78, -0.55], color: '#ffeccc', intensity: 1.6 };

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.4, 4.3, 4.7],
  lookHeight: 0.3,
  limits: { minX: -3.7, maxX: 3.8, minZ: -2.25, maxZ: 1.75 },
  title: { center: { x: -3.6, z: -0.4 }, radius: 5.2, angle: 0.45, height: 2.1, look: { x: -3.6, y: 0.6, z: -0.6 } },
  celebrate: { pos: [GOAL.x - 0.7, 1.3, GOAL.z + 2.15], look: [GOAL.x + 0.02, 0.3, GOAL.z - 0.05] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  WORLD, DOGS, WALLS, WINDOW, CABINET, DRYER, WASHER, TANK, SPIN_BUTTON, SPIN, CATCH, RACK_BUTTON, RACK, SOCK, BOARD,
  BASKET, DOG_BED, BED_SPOTS, PILE, BUCKET, RUG, STATIC_COLLIDERS, NAV_NODES, NAV_EDGES, COLLECTIBLES,
  COLLECTIBLE_PICKUP_R, GOAL, SUN, CAMERA,
};
export default LAYOUT;
