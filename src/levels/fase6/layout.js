// Expresso do Superbafo — fase de desenvolvimento. Metros, chão XZ, norte = -Z.
// Uma oficina de brinquedos em corte de maquete: a maquete do trem fica no meio (área isolada, ninguém
// entra nem pulando), o passeio contorna tudo e os móveis encostam nas paredes, longe do passeio.
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -5.5, maxX: 5.5, minZ: -4, maxZ: 4 } };
/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.5, z: 2.55, yaw: 0.7 }),
  rhaenyra: withStart('rhaenyra', { x: -4.25, z: 2.4, yaw: 0.7 }),
};
/**
 * Maquete do trem: base de madeira com feltro verde (topo em `height`) e cerquinha em volta (até `fenceTop`).
 * Vai de z = -2,7 a 0,67: a borda sul dá folga para a locomotiva fazer a última curva da volta sem passar
 * da cerca (conferido no teste, com o corpo inteiro e não só o eixo do trilho).
 */
export const RAIL_YARD = { x: 0, z: -1.015, hx: 2.65, hz: 1.685, height: 0.16, fenceTop: 0.5 };
export const PEDAL = { x: -3.75, z: 0.35, r: 0.8, pulseTime: 0.5 };
/** Agulha do trilho: onde a volta, a estrela e a lua se separam (fim do tronco de TRACK). */
export const JUNCTION = { x: 0, z: -1.5 };
/**
 * Ordem das posições da agulha: cada pouso no pedal avança uma (a volta, a lua, a estrela e de novo a volta).
 * A lua vem antes: o caminho mais curto é buscar a lua na torre e depois levar as duas cargas pela estrela.
 */
export const ROUTE_ORDER = /** @type {import('../../types').Fase6Route[]} */ (['loop', 'moon', 'delivery']);
/**
 * Placa da agulha (prisma de três faces) e alavanca que repete a seta perto do pedal: as duas dentro da
 * maquete (na área isolada, fora do caminho do trem), ligadas ao pedal por uma haste que entra na base.
 */
export const SWITCH_SIGN = { x: 0.48, z: -1.38 };
export const SWITCH_LEVER = { x: -2.36, z: 0.38, hx: 0.1, hz: 0.12 };
/**
 * Trem: locomotiva de brinquedo (centro em `start`, cara para o sul) e um vagão `cargoOffset` à frente no
 * trilho. O espirro dura `sneezeTime`; no "atchim" (`burstAt`) o trem leva um tranco de ré (`kick`, m/s),
 * acelera até `speed` e freia perto do fim (`brake`, m/s²), nunca abaixo de `minSpeed`.
 * Alturas: `railY` = fundo do sulco do trilho (onde as rodas apoiam); `cargoY` = centro da bolinha no vagão;
 * `noseY`/`chimney` = de onde saem o espirro e o vapor (locais da locomotiva).
 */
export const TRAIN = {
  start: { x: 0, z: -0.3, yaw: 0 }, speed: 1.35, accel: 2.4, kick: 0.85, brake: 1.6, minSpeed: 0.22,
  sneezeTime: 0.9, burstAt: 0.55, unloadTime: 1.25, cargoOffset: 0.8, cargoY: 0.5,
  /** Com as duas cargas no vagão, a de trás desce `unloadGap` s depois da da frente. */
  unloadGap: 0.3,
  /** Com as duas cargas a bordo, cada uma fica `slot` m à frente/atrás do centro do vagão. */
  slot: 0.09,
  railY: 0.18, noseY: 0.6, noseZ: 0.58, chimney: { z: 0.3, y: 0.95 }, chuffEvery: 0.42,
  /** Depois de descarregar, o trem espera `homePause` e volta sozinho para a estação (andando de frente). */
  homePause: 0.8,
  /** Parado diante da cancela fechada: apita, espera `blockedPause` e volta de frente para a estação. */
  blockedPause: 0.9,
};
/**
 * Trilho de madeira (o mesmo desenho move o trem e desenha os trilhos: ver track.js). O trem sai de
 * TRAIN.start andando de ré para o norte. Trechos: ['line', m] ou ['arc', raio, graus], + = curva à
 * esquerda. `stem` vai da estação à agulha; `loop` fecha o circuito chegando de novo na estação pelo sul,
 * já alinhado (sem girar parado); `delivery` (a estrela) termina antes da canaleta do sul e `moon` (a lua)
 * logo depois da agulha, com o vagão embaixo da bica da torre da lua. `tail` é o trilho depois do fim de cada
 * rota, onde o vagão para diante do para-choque. `width` = largura da peça; `gauge` = distância entre os sulcos.
 * @type {import('../../types').Fase6TrackSpec}
 */
export const TRACK = {
  width: 0.5, gauge: 0.34,
  stem: [['line', 1.2]],
  loop: [['arc', 0.6, 90], ['line', 0.4], ['arc', 0.6, 90], ['line', 1.15], ['arc', 0.5, 90], ['line', 0.65], ['arc', 0.45, 90]],
  delivery: [['arc', 0.6, -90], ['line', 0.6], ['arc', 0.6, -90], ['line', 0.97]],
  moon: [['line', 0.01]],
  tail: { delivery: 1.08, moon: 1.07 },
  /** A volta passa a contar como "voltando" nos últimos metros (reta do sul + curva final). */
  returnDistance: 1.36,
};
/**
 * Cancela de brinquedo na reta leste da estrela (`s` = ponto da rota onde fica o braço). Só sobe com alguém
 * em cima da placa do lado de fora (BARRIER_PLATE); com ela fechada, o trem para antes, apita e volta.
 * Depois que o trem passou do ponto de parada, ela fica aberta até ele sair (não desce em cima do trem).
 */
export const BARRIER = { s: 4.13, x: 1.8, z: -1.05, postX: 2.16 };
export const BARRIER_PLATE = { id: 'expresso-cancela', x: 3.15, z: -1.05, r: 0.3 };
export const NOSE = { id: 'expresso-nariz', x: 0, z: 0.38, r: 0.45, frontZ: 0.65, halfWidth: 0.58 };
export const BLOW_SPOT = { x: 0, z: 1.65, yaw: Math.PI };
/** Bandeja da estrela: as duas cargas assentam lado a lado (centro em `y`). */
export const TRAY = { x: 1.8, z: 1.3, y: 0.16, pickupR: 0.6 };
/** Canaleta da descarga: rampa de madeira da borda da maquete até a bandeja (superfície de y0 a y1). */
export const CHUTE = { x: TRAY.x, z0: RAIL_YARD.z + RAIL_YARD.hz, z1: 1.06, y0: 0.37, y1: 0.12, halfWidth: 0.17 };
export const BALL = { x: TRAIN.start.x, z: TRAIN.start.z - TRAIN.cargoOffset, y: TRAIN.cargoY, r: 0.09, pickupR: TRAY.pickupR };
/**
 * Pórtico da lua: dentro da maquete (do lado de fora da cerca ninguém alcança), sobre o fim da rota da lua.
 * Dois postes finos (em ±`legX`, `z`) ladeiam o trilho e a viga (no alto, `top`) segura uma cestinha bem em
 * cima do lugar da carga da frente do vagão (`hopperZ`). Quando o vagão para embaixo, a portinhola abre e a
 * lua cai nele (`loadTime` s). Os postes ficam entre as curvas da volta e da estrela, longe do trem.
 */
export const MOON_GANTRY = { x: 0, z: -2.61, legX: 0.32, legR: 0.025, top: 0.95, hopperZ: -2.4, hopperR: 0.1, loadTime: 1.4 };
/** Lua de brinquedo: começa na cestinha do pórtico (só o trem chega até ela) e viaja como a bolinha. */
export const MOON = { x: MOON_GANTRY.x, z: MOON_GANTRY.hopperZ, y: MOON_GANTRY.top - 0.1, r: 0.085 };
/**
 * Foguete no tapete: decola quando os dois berços (planeta e lua) estiverem ocupados. Os berços ficam dos
 * dois lados do foguete (locais ao foguete).
 */
export const ROCKET = { x: -4.65, z: 3.15, r: 0.24, sockets: { planet: { x: 0.2, y: 0.2, z: 0.06 }, moon: { x: -0.2, y: 0.2, z: 0.06 } } };
/**
 * Corpo da composição visto de cima, a partir do centro de cada carro (frente = cara da locomotiva):
 * a parte baixa (até a altura da cerca) e o teto da cabine. O teste varre as duas rotas com estes retângulos
 * contra a cerca e os enfeites da maquete.
 */
export const TRAIN_BODY = {
  loco: { front: 0.5, back: 0.49, halfWidth: 0.24 },
  roof: { front: -0.07, back: 0.47, halfWidth: 0.27 },
  wagon: { front: 0.32, back: 0.27, halfWidth: 0.22 },
};
/**
 * Enfeites dentro da maquete (estação, placa da agulha, laguinho, árvores de feltro, caixa d'água): círculos
 * { x, z, r } ou retângulos { x, z, hx, hz }. O cenário é montado com estas posições e o teste confere que o
 * trem passa longe de todos, nas duas rotas.
 */
export const YARD_DECOR = {
  station: { x: 1.18, z: -0.85, hx: 0.21, hz: 0.25 },
  platform: { x: 0.7, z: -0.8, hx: 0.24, hz: 0.24 },
  lampPost: { x: 0.5, z: -0.64, r: 0.05 },
  bench: { x: 0.84, z: -0.7, r: 0.1 },
  sign: { x: SWITCH_SIGN.x, z: SWITCH_SIGN.z, r: 0.08 },
  lever: { x: SWITCH_LEVER.x, z: SWITCH_LEVER.z, hx: SWITCH_LEVER.hx, hz: SWITCH_LEVER.hz },
  gantryW: { x: MOON_GANTRY.x - MOON_GANTRY.legX, z: MOON_GANTRY.z, r: MOON_GANTRY.legR },
  gantryE: { x: MOON_GANTRY.x + MOON_GANTRY.legX, z: MOON_GANTRY.z, r: MOON_GANTRY.legR },
  barrierPost: { x: BARRIER.postX, z: BARRIER.z, r: 0.05 },
  pond: { x: -0.8, z: -1.05, hx: 0.26, hz: 0.38 },
  tower: { x: -2.22, z: -1.62, r: 0.16 },
  treeA: { x: -1.0, z: -1.6, r: 0.12 }, treeB: { x: -0.75, z: -0.55, r: 0.1 }, treeC: { x: -2.25, z: -0.2, r: 0.13 },
  treeD: { x: -2.3, z: -2.3, r: 0.11 }, treeE: { x: 2.3, z: -2.3, r: 0.12 }, treeF: { x: 2.32, z: -0.7, r: 0.1 },
  bushA: { x: -1.15, z: -0.85, r: 0.07 }, bushB: { x: -2.35, z: -1.05, r: 0.09 }, bushC: { x: 2.35, z: -1.6, r: 0.08 },
};

// Móveis da oficina (encostados nas paredes; o passeio do grafo fica livre)
export const BENCH = { x: 4.95, z: -1.9, hx: 0.43, hz: 1.05, height: 0.9 };
export const TOY_CHEST = { x: 4.95, z: 0.95, hx: 0.42, hz: 0.32, height: 0.5 };
export const TOY_SHELF = { x: -5.2, z: -1.25, hx: 0.27, hz: 0.75, height: 0.95 };
export const LOW_CABINET = { x: 0, z: -3.84, hx: 1.6, hz: 0.16, height: 0.55 };
export const BLOCK_CRATES = { x: 3.55, z: -3.8, hx: 0.55, hz: 0.2, height: 0.42 };
export const PLANT = { x: -5.05, z: 1.4, r: 0.26 };
/** Tapete de retalhos no meio do lado sul (sem colisão) e cantinho de brinquedos perto da borda sudeste. */
export const RAG_RUG = { x: 1.1, z: 3.05, r: 0.85 };
export const TOY_PILE = { x: 3.9, z: 3.3, r: 0.36 };
export const FLOOR_LAMP = { x: -5.12, z: -3.62, r: 0.2 };

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  { id: 'parede-norte', shape: 'box', x: 0, z: -4.2, hx: 5.9, hz: 0.2 },
  { id: 'parede-sul', shape: 'box', x: 0, z: 4.2, hx: 5.9, hz: 0.2 },
  { id: 'parede-oeste', shape: 'box', x: -5.7, z: 0, hx: 0.2, hz: 4.2 },
  { id: 'parede-leste', shape: 'box', x: 5.7, z: 0, hx: 0.2, hz: 4.2 },
  // Área inteira inacessível, inclusive durante saltos; trem nunca colide com dogs.
  { id: 'ferrovia', shape: 'box', x: RAIL_YARD.x, z: RAIL_YARD.z, hx: RAIL_YARD.hx, hz: RAIL_YARD.hz },
  // A canaleta sai da maquete e desce até a bandeja da estrela. A bandeja (r 0,32 m, borda a 10,6 cm do chão) tem
  // colisor (retorno do usuário na prévia do PR #48): as dogs pegam a carga da beira, de frente para ela (a cabeça
  // alcança: TRAY.pickupR).
  { id: 'canaleta', shape: 'box', x: CHUTE.x, z: (CHUTE.z0 + CHUTE.z1) / 2, hx: CHUTE.halfWidth + 0.03, hz: (CHUTE.z1 - CHUTE.z0) / 2 },
  { id: 'bandeja', shape: 'circle', x: TRAY.x, z: TRAY.z, r: 0.295 }, // (a beirada vai a 0,32 m: 2,5 cm de folga)
  { id: 'foguete', shape: 'circle', x: ROCKET.x, z: ROCKET.z, r: ROCKET.r },
  { id: 'bancada', shape: 'box', x: BENCH.x, z: BENCH.z, hx: BENCH.hx + 0.02, hz: BENCH.hz + 0.02 },
  { id: 'bau', shape: 'box', x: TOY_CHEST.x, z: TOY_CHEST.z, hx: TOY_CHEST.hx + 0.02, hz: TOY_CHEST.hz + 0.02 },
  { id: 'estante', shape: 'box', x: TOY_SHELF.x, z: TOY_SHELF.z, hx: TOY_SHELF.hx, hz: TOY_SHELF.hz + 0.02 },
  { id: 'armario-baixo', shape: 'box', x: LOW_CABINET.x, z: LOW_CABINET.z, hx: LOW_CABINET.hx + 0.02, hz: LOW_CABINET.hz },
  { id: 'caixotes', shape: 'box', x: BLOCK_CRATES.x, z: BLOCK_CRATES.z, hx: BLOCK_CRATES.hx, hz: BLOCK_CRATES.hz },
  { id: 'planta', shape: 'circle', x: PLANT.x, z: PLANT.z, r: PLANT.r },
  { id: 'brinquedos', shape: 'circle', x: TOY_PILE.x, z: TOY_PILE.z, r: TOY_PILE.r },
  { id: 'luminaria', shape: 'circle', x: FLOOR_LAMP.x, z: FLOOR_LAMP.z, r: FLOOR_LAMP.r },
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
  { id: 'lapis', x: -4.7, z: -2.6 }, { id: 'planetas', x: -1.4, z: -3.4 }, { id: 'caixinha', x: 4.5, z: 2.4 },
];
export const COLLECTIBLE_PICKUP_R = 0.42;
/** @type {import('../../types').Goal} */
export const GOAL = {
  x: -3.85, z: 2.9, r: 0.85,
  celebrate: { radhija: { x: -3.5, z: 2.85 }, rhaenyra: { x: -4.2, z: 2.85 } },
  entryPoints: [{ x: -4.5, z: -1 }, { x: 3.8, z: 2.5 }],
};
/** Sol de fim de tarde entrando de cima e do sudoeste (a maquete não tem teto). */
export const SUN = { direction: [-0.45, 0.8, 0.42], color: '#ffe1b8', intensity: 2.15 };
/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38, offset: [1.4, 4.3, 4.7], lookHeight: 0.3,
  limits: { minX: -3.8, maxX: 3.8, minZ: -2.7, maxZ: 2.5 },
  title: { center: { x: 0, z: -0.1 }, radius: 7, angle: 0.35, height: 4.4, look: { x: 0, y: 0.2, z: -0.4 } },
  // mais baixa e olhando um pouco para cima: as duas no tapete e o foguete subindo até sair do quadro
  celebrate: { pos: [-2.7, 1.25, 5.6], look: [-3.95, 0.72, 2.95] },
  // na vitória o olhar volta a descer: as duas no terço esquerdo, na mesma altura das outras fases
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, -0.25, 0] },
};
/** @type {import('../../types').LevelLayout} */
const LAYOUT = { WORLD, DOGS, RAIL_YARD, PEDAL, JUNCTION, ROUTE_ORDER, SWITCH_SIGN, SWITCH_LEVER, TRAIN, TRACK, BARRIER,
  BARRIER_PLATE, NOSE, BLOW_SPOT, TRAY, CHUTE, BALL, MOON_GANTRY, MOON, ROCKET, TRAIN_BODY, YARD_DECOR, BENCH, TOY_CHEST, TOY_SHELF, LOW_CABINET, BLOCK_CRATES, PLANT, RAG_RUG, TOY_PILE,
  FLOOR_LAMP, STATIC_COLLIDERS, NAV_NODES,
  NAV_EDGES, COLLECTIBLES, COLLECTIBLE_PICKUP_R, GOAL, SUN, CAMERA };
export default LAYOUT;
