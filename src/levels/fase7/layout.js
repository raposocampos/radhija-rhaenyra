// Lambe-Lambe na Pracinha — fase de desenvolvimento. Metros, chão XZ, norte = -Z.
// Uma pracinha numa manhã depois da chuva. O parquinho cercado ocupa o norte e o leste; o gramado contorna
// pelo oeste e pelo sul, onde fica a toalha de piquenique (a entrega). Só se entra no parquinho:
//   - pelo túnel de manilha que atravessa o morrinho da cerca oeste: só a Radhija cabe, e o fundo tem lama;
//   - pelo portão da cerca sul, que tem o trinco do lado de dentro (a Radhija destrava depois de entrar).
// A bolinha caiu dentro do parquinho; o frisbee ficou no alto do escorregador, que só se sobe correndo
// (arrancada). Enlameada, a Radhija fica lenta, sem arrancada, e escorrega: a Rhaenyra limpa com o Lambe-Lambe.
import { withStart } from '../../dogs/config.js';

export const WORLD = { bounds: { minX: -6, maxX: 6, minZ: -4.4, maxZ: 3.6 } };
/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -3.3, z: 1.95, yaw: 2.5 }),
  rhaenyra: withStart('rhaenyra', { x: -4.05, z: 1.75, yaw: 2.4 }),
};

/** Cerca do parquinho (ripas de 0,8 m: ninguém pula). Lado oeste em x = west, lado sul em z = south. */
export const FENCE = { west: -1.6, south: 1.6, height: 0.8, t: 0.05 };
/**
 * Morrinho de grama na cerca oeste (retângulo de cantos bem arredondados, topo em `height`), com a manilha
 * atravessando de oeste para leste. A cerca encosta nos lados norte e sul dele.
 */
export const MOUND = { x: -1.6, z: -1.1, hx: 0.95, hz: 1.2, corner: 0.42, height: 0.78 };
/**
 * Túnel de manilha: eixo leste-oeste em z, da boca oeste (x0, no gramado) à boca leste (x1, no parquinho).
 * r = raio interno (0,58 m de diâmetro: a Radhija passa abaixada; a Rhaenyra, maior, não entra) e wall =
 * espessura do concreto. Nas duas bocas há um "batente" que só barra a Rhaenyra (blocks: 'large').
 */
export const TUNNEL = { z: -1.1, x0: -2.78, x1: -0.42, r: 0.29, wall: 0.055 };
/** Fundo do túnel com lama: quem passa sai enlameada (só a Radhija chega aqui). */
export const MUD_ZONE = { minX: TUNNEL.x0 + 0.1, maxX: TUNNEL.x1 - 0.06, minZ: TUNNEL.z - 0.26, maxZ: TUNNEL.z + 0.26 };
/** A lama: 5 lambidas tiram tudo; enlameada anda a metade da velocidade. */
export const MUD = { licksToClean: 5, slow: 0.5 };

/**
 * Portão do parquinho na cerca sul: dobradiça a oeste, abre para dentro (norte) até ficar paralelo à cerca
 * oeste. O trinco fica do lado de dentro, perto do batente.
 */
export const GATE = {
  hinge: { x: 1.4, z: FENCE.south }, latchPost: { x: 2.4, z: FENCE.south }, length: 1.0,
  closedYaw: -Math.PI / 2, openYaw: 0, openTime: 1.0,
};
export const LATCH = { x: 2.22, z: FENCE.south - 0.32, r: 0.55, duration: 0.8 };

/** A bolinha de tênis caída dentro do parquinho, longe da cerca (de fora ninguém alcança). */
export const BALL = { x: 0.35, z: 0.45, r: 0.068, pickupR: 0.5 };

/**
 * Escorregador leste-oeste: a rampa (`chute`) sobe do chão em x0 até a casinha em x1, onde fica o deque
 * (altura `deck`). Só uma arrancada sobe: quem chega andando (ou enlameada) escorrega de volta. Lá em cima a
 * dog pega o frisbee, vira e desce de barriga. `entry` é a área ao pé da rampa onde a subida começa.
 */
export const SLIDE = { z: -2.75, x0: 1.55, x1: 3.55, halfWidth: 0.27, deck: 1.05 };
export const TOWER = { x: 4.08, z: SLIDE.z, hx: 0.53, hz: 0.52, deck: SLIDE.deck, roof: 2.05 };
export const SLIDE_ENTRY = { minX: 0.98, maxX: 1.78, minZ: SLIDE.z - 0.38, maxZ: SLIDE.z + 0.38 };
/** Tempos (s) da subida correndo, da pegada lá em cima, do giro e da descida de barriga. */
export const SLIDE_TIMES = { climb: 0.8, grab: 0.4, turn: 0.4, slide: 0.95, runout: 0.38, slip: 0.95 };
/** Frisbee no deque da casinha (centro do disco; base em y). */
export const FRISBEE = { x: TOWER.x + 0.02, y: SLIDE.deck + 0.004, z: SLIDE.z, size: 0.2 };

/** Toalha de piquenique no gramado sudoeste: a entrega dos dois objetos. */
export const PICNIC = { x: -4.25, z: 2.62, hx: 0.78, hz: 0.55, yaw: 0.12 };
export const BASKET = { x: -4.82, z: 2.88, r: 0.2 };
/** Garrafa térmica na toalha, ao lado da cesta (longe dos lugares da comemoração). */
export const THERMOS = { x: PICNIC.x - 0.66, z: PICNIC.z - 0.3 };
/** Onde cada objeto fica na toalha (perto da cesta). */
export const PICNIC_SPOTS = { ball: { x: -4.38, z: 2.95 }, frisbee: { x: -3.95, z: 2.55 } };

// Brinquedos e enfeites (os colisores abaixo seguem estas medidas)
export const SWINGS = { x: 0.0, z: -3.72, halfSpan: 1.0, height: 1.75, seats: [-0.42, 0.42] };
export const SEESAW = { x: 4.95, z: -0.95, halfLength: 0.85 };
export const SANDBOX = { x: 3.35, z: 0.35, hx: 0.62, hz: 0.5 };
export const SPRING_RIDER = { x: -0.75, z: -2.95, r: 0.22 };
export const BENCHES = [{ x: -5.35, z: -1.9, yaw: Math.PI / 2 }, { x: 4.15, z: 3.12, yaw: Math.PI }];
export const LAMPS = [{ x: -2.3, z: -2.75 }, { x: 5.55, z: 1.95 }, { x: -5.55, z: -3.95 }];
export const TREES = [{ x: -5.15, z: -3.55, r: 0.17, seed: 3 }, { x: 5.45, z: -3.9, r: 0.16, seed: 7 }, { x: -5.45, z: 0.35, r: 0.15, seed: 11 }];
export const TRASH = { x: -5.35, z: -0.95, r: 0.18 };
/** Poças d'água (só respingam, não sujam): { x, z, rx, rz, rot }. */
export const PUDDLES = [
  { x: -2.75, z: 0.75, rx: 0.42, rz: 0.26, rot: 0.3 },
  { x: 0.45, z: 2.55, rx: 0.55, rz: 0.27, rot: -0.15 },
  { x: 1.85, z: -1.35, rx: 0.36, rz: 0.24, rot: 0.6 },
  { x: -3.85, z: -2.65, rx: 0.32, rz: 0.2, rot: -0.4 },
];

const seg = (id, ax, az, bx, bz, extra = {}) => ({ id, shape: /** @type {const} */ ('segment'), ax, az, bx, bz, t: FENCE.t, ...extra });
const tunnelLen = TUNNEL.x1 - TUNNEL.x0;
const tunnelMid = (TUNNEL.x0 + TUNNEL.x1) / 2;
const outerR = TUNNEL.r + TUNNEL.wall;
// o pé da encosta do morrinho passa de MOUND.hx/hz com mais de 8 cm de altura (no leste, a aresta TE-SW passa rente)
const moundFoot = { x: 0.07, z: 0.1 };

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  // cerca do parquinho (o portão é dinâmico, registrado pelo puzzle)
  seg('cerca-oeste-norte', FENCE.west, -4.7, FENCE.west, MOUND.z - MOUND.hz + 0.1),
  seg('cerca-oeste-sul', FENCE.west, MOUND.z + MOUND.hz - 0.1, FENCE.west, FENCE.south),
  seg('cerca-sul-oeste', FENCE.west, FENCE.south, GATE.hinge.x - 0.06, FENCE.south),
  seg('cerca-sul-leste', GATE.latchPost.x + 0.06, FENCE.south, 6.3, FENCE.south),
  // morrinho: as duas metades, deixando o corredor da manilha (com o pé da encosta)
  { id: 'morrinho-norte', shape: 'box', x: MOUND.x, z: (MOUND.z - MOUND.hz - moundFoot.z + TUNNEL.z - outerR) / 2, hx: MOUND.hx + moundFoot.x, hz: (MOUND.hz + moundFoot.z - outerR) / 2 },
  { id: 'morrinho-sul', shape: 'box', x: MOUND.x, z: (MOUND.z + MOUND.hz + moundFoot.z + TUNNEL.z + outerR) / 2, hx: MOUND.hx + moundFoot.x, hz: (MOUND.hz + moundFoot.z - outerR) / 2 },
  // paredes da manilha (o corredor tem o diâmetro interno) e os batentes das bocas, que só barram a Rhaenyra
  { id: 'manilha-norte', shape: 'box', x: tunnelMid, z: TUNNEL.z - TUNNEL.r - TUNNEL.wall / 2, hx: tunnelLen / 2, hz: TUNNEL.wall / 2 },
  { id: 'manilha-sul', shape: 'box', x: tunnelMid, z: TUNNEL.z + TUNNEL.r + TUNNEL.wall / 2, hx: tunnelLen / 2, hz: TUNNEL.wall / 2 },
  { id: 'boca-oeste', shape: 'box', x: TUNNEL.x0 + 0.06, z: TUNNEL.z, hx: 0.05, hz: TUNNEL.r, blocks: 'large' },
  { id: 'boca-leste', shape: 'box', x: TUNNEL.x1 - 0.06, z: TUNNEL.z, hx: 0.05, hz: TUNNEL.r, blocks: 'large' },
  // escorregador: a rampa e a casinha (com a escadinha do lado leste)
  { id: 'escorregador', shape: 'box', x: (SLIDE.x0 + 0.16 + SLIDE.x1) / 2, z: SLIDE.z, hx: (SLIDE.x1 - SLIDE.x0 - 0.16) / 2, hz: SLIDE.halfWidth + 0.04 },
  // as bordas da rampa no pé dela (entre elas a subida fica livre: a Radhija sobe pelo meio)
  ...[-1, 1].map((s) => /** @type {import('../../types').BoxCollider} */ ({
    id: `escorregador-pe-${s < 0 ? 'norte' : 'sul'}`, shape: 'box', x: SLIDE.x0 + 0.06, z: SLIDE.z + s * (SLIDE.halfWidth - 0.02), hx: 0.11, hz: 0.03,
  })),
  { id: 'casinha', shape: 'box', x: TOWER.x + 0.09, z: TOWER.z, hx: TOWER.hx + 0.09, hz: TOWER.hz }, // com a escadinha
  // brinquedos
  { id: 'balanco-oeste', shape: 'box', x: SWINGS.x - SWINGS.halfSpan, z: SWINGS.z, hx: 0.08, hz: 0.42 },
  { id: 'balanco-leste', shape: 'box', x: SWINGS.x + SWINGS.halfSpan, z: SWINGS.z, hx: 0.08, hz: 0.42 },
  { id: 'balanco-assentos', shape: 'box', x: SWINGS.x, z: SWINGS.z, hx: 0.68, hz: 0.18 },
  { id: 'gangorra', shape: 'box', x: SEESAW.x, z: SEESAW.z, hx: SEESAW.halfLength, hz: 0.17 },
  { id: 'caixa-de-areia', shape: 'box', x: SANDBOX.x, z: SANDBOX.z, hx: SANDBOX.hx, hz: SANDBOX.hz },
  // a joaninha de mola: o corpo (0,4 m de comprido, virado a 0,6 rad) e a cabeça passam da base
  { id: 'cavalinho', shape: 'circle', x: SPRING_RIDER.x + 0.03, z: SPRING_RIDER.z + 0.04, r: 0.3 },
  // gramado
  { id: 'cesta', shape: 'circle', x: BASKET.x, z: BASKET.z, r: BASKET.r },
  { id: 'garrafa-termica', shape: 'circle', x: THERMOS.x, z: THERMOS.z, r: 0.06 },
  { id: 'banco-oeste', shape: 'box', x: BENCHES[0].x, z: BENCHES[0].z, hx: 0.25, hz: 0.72 },
  { id: 'banco-sul', shape: 'box', x: BENCHES[1].x, z: BENCHES[1].z, hx: 0.72, hz: 0.25 },
  { id: 'lixeira', shape: 'circle', x: TRASH.x, z: TRASH.z, r: TRASH.r },
  ...LAMPS.map((l, i) => ({ id: `poste-${i}`, shape: /** @type {const} */ ('circle'), x: l.x, z: l.z, r: 0.09 })),
  // (o pé do tronco abre 6 cm além de r)
  ...TREES.map((t, i) => ({ id: `arvore-${i}`, shape: /** @type {const} */ ('circle'), x: t.x, z: t.z, r: t.r + 0.06 })),
];

export const NAV_NODES = {
  // gramado (fora do parquinho)
  PIC: { x: -3.45, z: 1.6 }, LW: { x: -3.55, z: -1.1 }, TW: { x: -3.12, z: -1.1 }, NWL: { x: -3.55, z: -3.55 },
  SL1: { x: -0.4, z: 2.62 }, GO: { x: 1.9, z: 2.45 }, SL2: { x: 4.4, z: 2.4 },
  // parquinho
  TE: { x: -0.02, z: -1.1 }, GI: { x: 1.95, z: 0.95 }, C: { x: 0.95, z: -0.95 }, SB: { x: 0.72, z: -2.72 },
  N: { x: 2.25, z: -3.8 }, NE: { x: 5.1, z: -2.0 }, SW: { x: -0.55, z: 1.0 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['PIC', 'LW'], ['LW', 'TW'], ['LW', 'NWL'], ['PIC', 'SL1'], ['SL1', 'GO'], ['GO', 'SL2'],
  // o túnel: só a Radhija cabe; com o portão aberto, a companheira prefere o portão (não se suja à toa)
  ['TW', 'TE', { requires: ['small', 'tunnel'] }],
  ['GO', 'GI', { requires: 'gateOpen' }],
  // o portão aberto fica paralelo à cerca oeste (x = 1,4): o caminho até GI contorna a ponta dele
  ['TE', 'C'], ['TE', 'SW'], ['SW', 'C'], ['GI', 'C'], ['C', 'SB'], ['SB', 'N'], ['C', 'NE'],
];
/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'arvore', x: -5.5, z: -2.95 }, { id: 'balanco', x: 0.42, z: -3.22 }, { id: 'canto', x: 5.45, z: 3.0 },
];
export const COLLECTIBLE_PICKUP_R = 0.42;
/** @type {import('../../types').Goal} */
export const GOAL = {
  x: PICNIC.x, z: PICNIC.z, r: 0.9,
  celebrate: { radhija: { x: -3.65, z: 2.7 }, rhaenyra: { x: -4.45, z: 2.25 } },
  entryPoints: [{ x: -5.5, z: -1.4 }, { x: 0.6, z: 3.3 }],
};
/** Sol da manhã, ainda baixo, entrando do leste-sudeste entre as nuvens que vão embora. */
export const SUN = { direction: [0.62, 0.68, 0.38], color: '#fff0d8', intensity: 2.3 };
/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38, offset: [1.4, 4.3, 4.7], lookHeight: 0.3,
  limits: { minX: -4.1, maxX: 4.3, minZ: -3.1, maxZ: 2.1 },
  title: { center: { x: 0.2, z: -0.5 }, radius: 7.4, angle: 0.4, height: 4.6, look: { x: 0.3, y: 0.35, z: -0.9 } },
  // baixa, de frente para a toalha: as duas e os dois objetos no piquenique
  celebrate: { pos: [-2.75, 1.25, 5.35], look: [-4.15, 0.45, 2.55] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, -0.25, 0] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  WORLD, DOGS, FENCE, MOUND, TUNNEL, MUD_ZONE, MUD, GATE, LATCH, BALL, SLIDE, TOWER, SLIDE_ENTRY, SLIDE_TIMES, FRISBEE,
  PICNIC, BASKET, THERMOS, PICNIC_SPOTS, SWINGS, SEESAW, SANDBOX, SPRING_RIDER, BENCHES, LAMPS, TREES, TRASH, PUDDLES,
  STATIC_COLLIDERS, NAV_NODES, NAV_EDGES, COLLECTIBLES, COLLECTIBLE_PICKUP_R, GOAL, SUN, CAMERA,
};
export default LAYOUT;
