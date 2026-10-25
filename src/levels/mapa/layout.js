// =====================================================================
//  PANDORÓPOLIS — o mapa das fases. LAYOUT (fonte única das coordenadas).
//  Uma cidadezinha em maquete, vista em câmera isométrica (a sudeste, olhando para noroeste): o Condomínio Recanto
//  das Patinhas (ruas internas em grade, a casa das dogs no quarteirão sul do meio), o centro da cidade na Avenida
//  Pandora e, depois do rio, a chácara do vovô. Cada fase é uma bandeirinha na frente do lugar onde ela acontece.
//  Escala: as dogs são do tamanho de sempre (~0,7 m); carro ~2,3 m, casa ~8 m, torre ~11 m de altura (maquete:
//  um pouco menor que o real, para a cidade caber num passeio curto). Metros, Y para cima, Norte = −Z.
//  O desenho aprovado pelo usuário é a maquete do conceito (docs/CONTEXTO.md, "Pandorópolis").
// =====================================================================
import { withStart } from '../../dogs/config.js';

/** Largura das ruas (asfalto) e da calçada em volta dos quarteirões. */
export const ROAD_W = 3;
export const WALK_W = 0.9;

/** Platôs (a maquete flutua no mar): a cidade e, depois do rio, a chácara. */
export const CITY = { minX: -52.2, maxX: 25.8, minZ: -36, maxZ: 36 };
export const FARM = { minX: 31.8, maxX: 52.8, minZ: -28.8, maxZ: 28.8 };
export const RIVER = { minX: 25.8, maxX: 31.8 };
export const WORLD = { bounds: { minX: CITY.minX, maxX: FARM.maxX, minZ: CITY.minZ, maxZ: CITY.maxZ } };

/** Muro do condomínio (baixo) com a portaria a leste, na rua do meio. */
export const CONDO = {
  minX: -49.2, maxX: 7.2, minZ: -28.8, maxZ: 28.8, wallT: 0.32, wallH: 0.62, gate: { z: 0, half: 1.95 },
  /** Guarita, logo depois da portaria, entre a rua e o muro. */
  booth: { x: 5.6, z: -3.6, w: 1.4, d: 1.3 },
};

/** Linhas centrais das ruas: o condomínio é uma grade fechada (4 × 3); a rua do meio sai pela portaria. */
export const STREET_X = [-45.6, -29.4, -13.2, 3];
export const STREET_Z = [-25.2, 0, 25.2];
export const AVENUE_X = 13.2;
export const RIVERSIDE_X = 24;
export const TOWN_Z = [-22.8, 22.8];
/** Segmentos de rua [x1, z1, x2, z2] (eixo central). */
export const ROADS = [
  ...STREET_X.map((x) => [x, STREET_Z[0], x, STREET_Z[2]]),
  [STREET_X[0], STREET_Z[0], STREET_X[3], STREET_Z[0]],
  [STREET_X[0], STREET_Z[2], STREET_X[3], STREET_Z[2]],
  [STREET_X[0], 0, RIVERSIDE_X, 0],
  // Avenida Pandora: ao norte segue para as nuvens (o caminho do Modo História)
  [AVENUE_X, -34, AVENUE_X, TOWN_Z[1]],
  [AVENUE_X, TOWN_Z[0], RIVERSIDE_X, TOWN_Z[0]],
  [AVENUE_X, TOWN_Z[1], RIVERSIDE_X, TOWN_Z[1]],
  [RIVERSIDE_X, TOWN_Z[0], RIVERSIDE_X, TOWN_Z[1]],
];
/** Cruzamentos (as faixas param antes deles). */
export const CROSSINGS = [
  ...STREET_X.flatMap((x) => STREET_Z.map((z) => [x, z])),
  [AVENUE_X, TOWN_Z[0]], [AVENUE_X, 0], [AVENUE_X, TOWN_Z[1]],
  [RIVERSIDE_X, TOWN_Z[0]], [RIVERSIDE_X, 0], [RIVERSIDE_X, TOWN_Z[1]],
];
/** Estrada de terra da chácara (da ponte para leste) e a entrada da casa do vovô. */
export const DIRT = { z: 0, w: 2.2, x0: FARM.minX, x1: 51.2, drive: { x: 39.6, z0: -5.4, z1: -1.1, w: 1.6 } };

const blk = (x0, x1, z0, z1) => ({ minX: x0 + ROAD_W / 2, maxX: x1 - ROAD_W / 2, minZ: z0 + ROAD_W / 2, maxZ: z1 - ROAD_W / 2 });
/** Quarteirões do condomínio (sem a rua em volta). */
export const BLOCKS = {
  lago: blk(STREET_X[0], STREET_X[1], STREET_Z[0], 0),
  torre: blk(STREET_X[1], STREET_X[2], STREET_Z[0], 0),
  brinquedoteca: blk(STREET_X[2], STREET_X[3], STREET_Z[0], 0),
  servico: blk(STREET_X[0], STREET_X[1], 0, STREET_Z[2]),
  casa: blk(STREET_X[1], STREET_X[2], 0, STREET_Z[2]),
  pracinha: blk(STREET_X[2], STREET_X[3], 0, STREET_Z[2]),
};
/** Quarteirões do centro (entre a avenida e a rua da beira do rio). */
export const TOWN_BLOCKS = {
  norte: blk(AVENUE_X, RIVERSIDE_X, TOWN_Z[0], 0),
  sul: blk(AVENUE_X, RIVERSIDE_X, 0, TOWN_Z[1]),
};

// ---------------------------------------------------------------- lugares (as fases e os enfeites)
/** Casa das dogs: corpo, anexo da lavanderia, jardim da frente com a cerca e o portãozinho. */
export const HOUSE = {
  x: -22.2, z: 7.2, w: 9, d: 6, h: 3.1, door: { x: -22.2 },
  annex: { x: -16.5, z: 7.2, w: 2.4, d: 4.2, h: 2.4 },
  garden: { minX: -27.9, maxX: -14.7, minZ: 10.2, maxZ: 21.9 },
  fence: { z: 21.9, gate: { x0: -22.1, x1: -19.9 }, h: 0.62, back: 4.2 },
  line: { x0: -20.2, x1: -16.9, z: 16.8 }, // varal com a meia listrada
  /** Canteiro na frente da casa (oeste da porta) e os soltos do jardim: [x, z, tipo]. */
  bed: { minX: -26.45, maxX: -22.95, minZ: 10.2, maxZ: 10.95 },
  flowers: [[-26.8, 13, 'ger2'], [-26.6, 16.4, 'lav'], [-15.4, 17.6, 'ger'], [-24.8, 20.6, 'flw'], [-17.8, 20.8, 'flw'], [-19.4, 12.3, 'ger2']],
  /** Cenoura de brinquedo esquecida na grama. */
  carrot: { x: -24.5, z: 18.2 },
};
/** Torre do condomínio (o terraço da fase 4). */
export const TOWER = { x: -21.3, z: -12.9, w: 6.6, d: 6.6, h: 11 };
/** Jardim do lago (fase 3). */
export const LAKE = { x: -38, z: -13.2, r: 5.2, island: { x: -38.6, z: -13.6, r: 1.55 }, plank: { x0: -36.9, x1: -32.6, z: -13.6, w: 0.85 } };
/** Área de serviço do condomínio (fase 2): varal comprido, irrigador, o canal e o caixote. */
export const SERVICE = {
  line: { x0: -43, x1: -33.4, z: 4.8 },
  sprinkler: { x: -39.6, z: 10.2 },
  canal: { minX: -44.1, maxX: -31.5, minZ: 17.7, maxZ: 19.5 },
  crate: { x: -36, z: 16.6, s: 0.9 },
  ball: { x: -33.9, z: 21.6 },
  basket: { x: -41.6, z: 7.4, w: 0.7, d: 0.5 },
};
/** Brinquedoteca com o trenzinho em volta (fase 6). */
export const TOYHOUSE = { x: -5.1, z: -14.4, w: 5.2, d: 4.2, h: 2.7, track: { rx: 4.3, rz: 3.4 } };
/** Pracinha (fase 7). */
export const PLAYGROUND = {
  sand: { minX: -10.5, maxX: 0.3, minZ: 3.6, maxZ: 22.2 },
  slide: { x: -3.6, z: 8.6 }, swing: { x: -8.1, z: 16.8 }, towel: { x: -1.6, z: 20.2 },
  puddles: [{ x: -6.6, z: 12.6, r: 0.9 }, { x: -2.1, z: 16.2, r: 0.7 }],
  bucket: { x: -8.6, z: 6.4 },
};
/** Centro: padaria, banca, pet shop, ponto de ônibus, praça com chafariz, sorveteria e o outdoor da Amora. */
export const TOWN = {
  bakery: { x: 18.6, z: -16.2, w: 6, d: 4.2, h: 2.9 },
  newsstand: { x: 16.6, z: -5.6, w: 1.9, d: 1.3, h: 1.7 },
  petshop: { x: 20.6, z: -7.4, w: 3.4, d: 3, h: 2.5 },
  busStop: { x: 11.05, z: -15 },
  bus: { x: 9.2, z: -15, w: 1.7, d: 5.2 },
  /** Vagas de estacionamento na faixa entre o muro e a avenida (os carros não ficam no meio da rua). */
  parking: { minX: 8.1, maxX: 10.2, minZ: 4.6, maxZ: 19.8 },
  fountain: { x: 18.6, z: 12.6, r: 2.1 },
  icecream: { x: 19.2, z: 18.6, w: 4.8, d: 3, h: 2.5 },
  billboard: { x: 18.4, z: 5.4, w: 6.4 },
  arch: { z: -25.6 },
  barrier: { z: -27.6 },
  light: { x: 11.4, z: -1.95 },
  sign: { x: 11.3, z: 3.4 },
};
/** Carros estacionados nas vagas (fora das ruas: o caminho da companheira passa no meio delas): x, z, rumo, cor. */
export const CARS = [
  { x: 9.15, z: 6.6, yaw: Math.PI / 2, color: '#e8577a' },
  { x: 9.15, z: 12.4, yaw: -Math.PI / 2, color: '#6ec3e8' },
  { x: 9.15, z: 18.2, yaw: Math.PI / 2, color: '#7fa36b' },
  { x: 16.3, z: -20.1, yaw: 0, color: '#ffd15c' },
  { x: 20.5, z: -20.1, yaw: Math.PI, color: '#fffaf0' },
];
/** Chácara do vovô: a casa (fase 9) ao norte da estrada, o quintal da festa (fase 10) ao sul. */
export const GRANDPA = {
  house: { x: 39.6, z: -8.4, w: 7.2, d: 6, h: 2.8 },
  garden: { minX: 33.2, maxX: 38.4, minZ: -21.6, maxZ: -16.2 },
  barn: { x: 46.8, z: -18.6, w: 4.2, d: 3.6, h: 2.4 },
  sty: { minX: 44.4, maxX: 50.4, minZ: -13.2, maxZ: -7.6 },
  table: { x: 41, z: 8.6, w: 2.2, d: 1.3 },
  pool: { x: 35.8, z: 14.6, r: 1.15 },
  treehouse: { x: 47.4, z: 17, r: 0.32 },
  bunting: { x0: 37, x1: 45, z: 5.4 },
  /** Varanda da casa (piso e colunas) e o embrulho de presente perto da piscininha. */
  porch: { minX: 36.6, maxX: 42.6, minZ: -5.4, maxZ: -3.8, posts: [-2.6, -0.9, 0.9, 2.6] },
  gift: { x: 44.6, z: 13.6, s: 0.9 },
  hens: [[48.6, 9.8, 0.6], [49.4, 10.6, 2.4], [47.6, 11.2, -1.8]],
};

/** Enfeites de rua: bancos (o assento olha para +Z girado por yaw), hidrantes, lixeiras e os postes do jardim do lago. */
export const BENCHES = [
  { x: 15, z: 11.6, yaw: Math.PI / 2 - 0.3 },
  { x: 22.2, z: 13.6, yaw: -Math.PI / 2 - 0.3 },
  { x: -36, z: -2.0, yaw: 0 },
  { x: -24, z: -6.6, yaw: 0 },
  { x: -1.2, z: 4.4, yaw: 0 },
];
export const HYDRANTS = [[11.0, 9.4], [11.0, -19.6], [-16.4, 1.95], [20.6, -1.95]];
export const BINS = [[16.0, -1.95], [-26.6, -1.95], [20.8, 1.95], [-16.6, 23.25]];
export const GARDEN_LAMPS = [[-43.0, -2.8], [-31.9, -2.7], [-42.9, -21.3], [-31.9, -21.4]];
/** Vasos de flores no piso da praça, ao norte e ao sul do chafariz (os bancos ficam a leste e a oeste). */
export const FOUNTAIN_BEDS = [-115, -90, -65, 65, 90, 115].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return [TOWN.fountain.x + Math.cos(a) * 3.4, TOWN.fountain.z + Math.sin(a) * 3.4];
});

// ---------------------------------------------------------------- as fases
/**
 * Bandeirinhas: a posição do mastro, o lado da rua/calçada onde fica o número pintado (face) e o lugar.
 * `when` é a hora do dia da fase (texto da plaquinha).
 */
export const FLAGS = [
  { level: 'fase1', n: 1, x: -23.3, z: 22.95, face: [0, 1], place: 'Jardim da casa', when: 'fim de tarde' },
  { level: 'fase2', n: 2, x: -32.1, z: 10.8, face: [1, 0], place: 'Área de serviço', when: 'crepúsculo' },
  { level: 'fase3', n: 3, x: -32.1, z: -7.2, face: [1, 0], place: 'Jardim do lago', when: 'noite' },
  { level: 'fase4', n: 4, x: -21.3, z: -5.4, face: [0, 1], place: 'Torre · terraço', when: 'manhã' },
  { level: 'fase5', n: 5, x: -22.2, z: 11.5, face: [0, 1], place: 'Casa das dogs', when: 'tarde de chuva' },
  { level: 'fase6', n: 6, x: -5.1, z: -6.6, face: [0, 1], place: 'Brinquedoteca', when: 'oficina de brinquedos' },
  { level: 'fase7', n: 7, x: 0.75, z: 13.2, face: [1, 0], place: 'Pracinha', when: 'depois da chuva' },
  { level: 'fase8', n: 8, x: -16.5, z: 11.5, face: [0, 1], place: 'Lavanderia da casa', when: 'manhã de sol' },
  { level: 'fase9', n: 9, x: 39.6, z: -3.3, face: [0, 1], place: 'Casa do vovô', when: 'noite de chuva' },
  { level: 'fase10', n: 10, x: 36, z: 3.1, face: [0, -1], place: 'Quintal da chácara', when: 'aniversário' },
];
/** Raio para a plaquinha aparecer e para a fase começar a carregar por baixo. */
export const FLAG_NEAR = 2.6;
export const FLAG_PRELOAD = 6;
/** Onde as duas aparecem na frente de uma bandeirinha (ao abrir o mapa, voltar de uma fase ou no atalho). */
export function flagSpot(f, who = 'lead') {
  const [fx, fz] = f.face;
  const d = who === 'lead' ? 2.2 : 3.0;
  const side = who === 'lead' ? 0.45 : -0.55;
  return { x: f.x + fx * d - fz * side, z: f.z + fz * d + fx * side, yaw: Math.atan2(-fx, -fz) };
}

/**
 * Áreas cobertas de nuvens até a vez delas: o leste do condomínio e o centro (a partir da fase 6), a chácara (fase 9)
 * e a estrada do norte (o Modo História, em breve). Enquanto fechadas, não dá para entrar (bloqueio dinâmico).
 */
export const ZONES = {
  leste: { unlock: 6, box: { minX: STREET_X[2] + ROAD_W / 2 + 0.05, maxX: RIVER.minX + 0.1, minZ: CITY.minZ, maxZ: CITY.maxZ } },
  chacara: { unlock: 9, box: { minX: FARM.minX, maxX: FARM.maxX + 1.5, minZ: FARM.minZ - 1.5, maxZ: FARM.maxZ + 1.5 } },
  breve: { unlock: Infinity, box: { minX: CONDO.maxX + 0.2, maxX: RIVER.minX + 0.1, minZ: CITY.minZ, maxZ: TOWN.barrier.z - 0.2 } },
};
/** Ponte levadiça do rio (desce na vez da chácara). */
export const BRIDGE = { x0: RIVER.minX - 0.3, x1: RIVER.maxX + 0.3, z: 0, w: 2.8 };

// ---------------------------------------------------------------- as dogs, a câmera
/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { ...flagSpot(FLAGS[0], 'lead') }),
  rhaenyra: withStart('rhaenyra', { ...flagSpot(FLAGS[0], 'comp') }),
};

/** Câmera isométrica: alta, a sudeste, lente fechada (a maquete inteira em perspectiva quase paralela). */
/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 28,
  offset: [12.6, 15.4, 12.6],
  lookHeight: 0.35,
  limits: { minX: CITY.minX + 4, maxX: FARM.maxX - 3, minZ: CITY.minZ + 3, maxZ: CITY.maxZ - 5 },
  title: { center: { x: -21, z: 18 }, radius: 13, angle: 0.75, height: 9, look: { x: -21, y: 1, z: 8 }, fov: 32 },
  celebrate: { pos: [-11, 9, 32], look: [-21, 0.5, 16] },
};

// ---------------------------------------------------------------- colisão
const box = (id, minX, minZ, maxX, maxZ, extra = {}) => ({ id, shape: 'box', x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hx: (maxX - minX) / 2, hz: (maxZ - minZ) / 2, ...extra });
const rect = (id, r, pad = 0, extra = {}) => box(id, r.x - r.w / 2 - pad, r.z - r.d / 2 - pad, r.x + r.w / 2 + pad, r.z + r.d / 2 + pad, extra);
const circle = (id, x, z, r) => ({ id, shape: 'circle', x, z, r });
/** Meia-espessura do muro na colisão: a dos pilares (0,5 m), que saem um pouco do muro. */
const W = 0.26;
const seg = (id, ax, az, bx, bz, t = 0.08, extra = {}) => ({ id, shape: 'segment', ax, az, bx, bz, t, ...extra });
const G = CONDO.gate;
/** Árvores das calçadas e jardins (o cenário planta as copas; o tronco colide). */
export const TREES = [
  { x: -26.6, z: 19.8, kind: 'ipe-rosa', s: 0.9 }, { x: -15.6, z: 20.4, kind: 'verde', s: 0.85 },
  { x: -43.2, z: 22.2, kind: 'verde', s: 1 }, { x: -43.2, z: 2.6, kind: 'ipe-amarelo', s: 0.85 },
  { x: -42.8, z: -2.7, kind: 'ipe-rosa', s: 0.95 }, { x: -31.9, z: -22.4, kind: 'verde', s: 0.9 },
  { x: -26.9, z: -22.4, kind: 'verde', s: 0.95 }, { x: -15.6, z: -22.4, kind: 'ipe-roxo', s: 0.9 },
  { x: -10.6, z: -22.4, kind: 'verde', s: 0.9 }, { x: 0.4, z: -22.4, kind: 'ipe-rosa', s: 0.9 },
  { x: -10.7, z: 22.3, kind: 'ipe-amarelo', s: 0.9 }, { x: 0.3, z: 2.6, kind: 'verde', s: 0.8 },
  { x: 5.85, z: -18, kind: 'verde', s: 0.85 }, { x: 5.85, z: 18, kind: 'ipe-rosa', s: 0.85 },
  { x: 9.4, z: -21.6, kind: 'verde', s: 0.9 }, { x: 9.4, z: -8.4, kind: 'ipe-rosa', s: 0.85 },
  { x: 9.4, z: 9.6, kind: 'verde', s: 0.9 }, { x: 9.4, z: 21.6, kind: 'ipe-amarelo', s: 0.85 },
  { x: 16, z: 9.4, kind: 'ipe-roxo', s: 0.75 }, { x: 21.3, z: 15.6, kind: 'ipe-roxo', s: 0.75 },
  { x: 21.9, z: -12.2, kind: 'verde', s: 0.8 },
  { x: 47.4, z: 17, kind: 'casa-na-arvore', s: 1.25 }, { x: 50.4, z: 24, kind: 'ipe-rosa', s: 1 },
  { x: 34.2, z: 25.2, kind: 'verde', s: 1 }, { x: 50.6, z: 3.6, kind: 'ipe-amarelo', s: 0.9 },
  { x: 33.6, z: -11.4, kind: 'verde', s: 0.95 },
];
export const TREE_TRUNK_R = 0.32;

/** Lâmpadas de rua (o poste colide: nada atravessa nada). */
export const LAMPS = [
  [-30.9, 4], [-30.9, 20], [-14.7, 4], [-14.7, -4], [-27.9, -4], [-44.1, -20], [1.5, -20], [1.5, 6],
  [10.2, -10], [10.2, -2.6], [10.2, 4.2], [10.2, 14], [22.5, -4], [22.5, 4],
];

/** Onde ficam os buxinhos de um quarteirão (as quatro esquinas, por dentro da calçada). */
export function cornerSpots(b) {
  return [[b.minX + 0.45, b.minZ + 0.45], [b.maxX - 0.45, b.minZ + 0.45], [b.minX + 0.45, b.maxZ - 0.45], [b.maxX - 0.45, b.maxZ - 0.45]];
}

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  // borda da maquete (mar) e o rio (a ponte é um bloqueio dinâmico, ligado enquanto levantada)
  box('mar-oeste', CITY.minX - 2, CITY.minZ - 2, CITY.minX, CITY.maxZ + 2),
  box('mar-norte', CITY.minX - 2, CITY.minZ - 2, FARM.maxX + 2, CITY.minZ),
  box('mar-sul', CITY.minX - 2, CITY.maxZ, FARM.maxX + 2, CITY.maxZ + 2),
  box('rio-norte', RIVER.minX, CITY.minZ - 2, RIVER.maxX, BRIDGE.z - BRIDGE.w / 2 + 0.25),
  box('rio-sul', RIVER.minX, BRIDGE.z + BRIDGE.w / 2 - 0.25, RIVER.maxX, CITY.maxZ + 2),
  box('chacara-norte', RIVER.maxX, CITY.minZ - 2, FARM.maxX + 2, FARM.minZ),
  box('chacara-sul', RIVER.maxX, FARM.maxZ, FARM.maxX + 2, CITY.maxZ + 2),
  box('mar-leste', FARM.maxX, CITY.minZ - 2, FARM.maxX + 2, CITY.maxZ + 2),
  // muro do condomínio, com a portaria na rua do meio
  box('muro-oeste', CONDO.minX - W, CONDO.minZ - W, CONDO.minX + W, CONDO.maxZ + W),
  box('muro-norte', CONDO.minX - W, CONDO.minZ - W, CONDO.maxX + W, CONDO.minZ + W),
  box('muro-sul', CONDO.minX - W, CONDO.maxZ - W, CONDO.maxX + W, CONDO.maxZ + W),
  box('muro-leste-norte', CONDO.maxX - W, CONDO.minZ - W, CONDO.maxX + W, G.z - G.half),
  box('muro-leste-sul', CONDO.maxX - W, G.z + G.half, CONDO.maxX + W, CONDO.maxZ + W),
  ...[-1, 1].map((s) => box(`pilar-portaria-${s < 0 ? 'norte' : 'sul'}`, CONDO.maxX - 0.35, G.z + s * (G.half + 0.35) - 0.35, CONDO.maxX + 0.35, G.z + s * (G.half + 0.35) + 0.35)),
  rect('guarita', CONDO.booth),
  // casa das dogs
  rect('casa', HOUSE),
  rect('lavanderia', HOUSE.annex),
  box('cerca-oeste', HOUSE.garden.minX, HOUSE.fence.z - 0.08, HOUSE.fence.gate.x0, HOUSE.fence.z + 0.08, { height: HOUSE.fence.h }),
  box('cerca-leste', HOUSE.fence.gate.x1, HOUSE.fence.z - 0.08, HOUSE.garden.maxX, HOUSE.fence.z + 0.08, { height: HOUSE.fence.h }),
  // o jardim é cercado dos lados também: só se entra pelo portãozinho
  box('cerca-lado-oeste', HOUSE.garden.minX - 0.08, HOUSE.fence.back, HOUSE.garden.minX + 0.08, HOUSE.fence.z, { height: HOUSE.fence.h }),
  box('cerca-lado-leste', HOUSE.garden.maxX - 0.08, HOUSE.fence.back, HOUSE.garden.maxX + 0.08, HOUSE.fence.z, { height: HOUSE.fence.h }),
  // e pelos fundos, entre a cerca do lado e a casa
  box('cerca-fundo-oeste', HOUSE.garden.minX - 0.08, HOUSE.fence.back - 0.08, HOUSE.x - HOUSE.w / 2, HOUSE.fence.back + 0.08, { height: HOUSE.fence.h }),
  box('cerca-fundo-leste', HOUSE.x + HOUSE.w / 2, HOUSE.fence.back - 0.08, HOUSE.garden.maxX + 0.08, HOUSE.fence.back + 0.08, { height: HOUSE.fence.h }),
  // os mourões do portãozinho e a folha aberta
  circle('portaozinho-a', HOUSE.fence.gate.x0, HOUSE.fence.z, 0.1), circle('portaozinho-b', HOUSE.fence.gate.x1, HOUSE.fence.z, 0.1),
  seg('portaozinho-folha', HOUSE.fence.gate.x1, HOUSE.fence.z + 0.05, HOUSE.fence.gate.x1 + 0.45, HOUSE.fence.z + 1.0, 0.05),
  // varandinha da porta, canteiros e a cenoura de brinquedo
  circle('varanda-a', HOUSE.door.x - 0.85, HOUSE.z + HOUSE.d / 2 + 0.95, 0.09), circle('varanda-b', HOUSE.door.x + 0.85, HOUSE.z + HOUSE.d / 2 + 0.95, 0.09),
  box('canteiro-casa', HOUSE.bed.minX, HOUSE.bed.minZ, HOUSE.bed.maxX, HOUSE.bed.maxZ, { height: 0.4 }),
  ...HOUSE.flowers.map(([x, z], i) => circle(`canteiro-${i + 1}`, x, z, 0.3)),
  circle('cenoura', HOUSE.carrot.x, HOUSE.carrot.z, 0.18),
  circle('varal-casa-a', HOUSE.line.x0, HOUSE.line.z, 0.08), circle('varal-casa-b', HOUSE.line.x1, HOUSE.line.z, 0.08),
  // torre, lago, área de serviço, brinquedoteca e o trilho, pracinha
  rect('torre', TOWER),
  circle('lago', LAKE.x, LAKE.z, LAKE.r + 0.42),
  ...[-1, 1].map((s) => circle(`marquise-${s < 0 ? 'a' : 'b'}`, TOWER.x + s * 1.35, TOWER.z + TOWER.d / 2 + 1.2, 0.08)),
  ...GARDEN_LAMPS.map(([x, z], i) => circle(`poste-do-lago-${i + 1}`, x, z, 0.1)),
  box('cerca-viva-do-lago', BLOCKS.lago.minX + 0.2, BLOCKS.lago.minZ + 0.1, BLOCKS.lago.maxX - 0.2, BLOCKS.lago.minZ + 1.1, { height: 0.75 }),
  box('canal', SERVICE.canal.minX, SERVICE.canal.minZ, SERVICE.canal.maxX, SERVICE.canal.maxZ),
  box('caixote', SERVICE.crate.x - SERVICE.crate.s / 2, SERVICE.crate.z - SERVICE.crate.s / 2, SERVICE.crate.x + SERVICE.crate.s / 2, SERVICE.crate.z + SERVICE.crate.s / 2, { height: SERVICE.crate.s }),
  circle('varal-servico-a', SERVICE.line.x0, SERVICE.line.z, 0.08), circle('varal-servico-b', SERVICE.line.x1, SERVICE.line.z, 0.08),
  circle('irrigador', SERVICE.sprinkler.x, SERVICE.sprinkler.z, 0.2), circle('bolinha', SERVICE.ball.x, SERVICE.ball.z, 0.2),
  rect('cesto', SERVICE.basket),
  box('brinquedoteca-e-trilho', TOYHOUSE.x - TOYHOUSE.track.rx - 0.35, TOYHOUSE.z - TOYHOUSE.track.rz - 0.35, TOYHOUSE.x + TOYHOUSE.track.rx + 0.35, TOYHOUSE.z + TOYHOUSE.track.rz + 0.35),
  box('escorregador', PLAYGROUND.slide.x - 0.55, PLAYGROUND.slide.z - 0.55, PLAYGROUND.slide.x + 0.55, PLAYGROUND.slide.z + 2.4),
  box('balanco', PLAYGROUND.swing.x - 1.08, PLAYGROUND.swing.z - 0.42, PLAYGROUND.swing.x + 1.08, PLAYGROUND.swing.z + 0.42),
  circle('baldinho', PLAYGROUND.bucket.x, PLAYGROUND.bucket.z, 0.15),
  // centro
  rect('padaria', TOWN.bakery), rect('banca', TOWN.newsstand), rect('pet-shop', TOWN.petshop),
  box('ponto-de-onibus', TOWN.busStop.x - 0.35, TOWN.busStop.z - 1.2, TOWN.busStop.x + 0.45, TOWN.busStop.z + 1.2),
  rect('onibus', TOWN.bus), circle('chafariz', TOWN.fountain.x, TOWN.fountain.z, TOWN.fountain.r + 0.05),
  rect('sorveteria', TOWN.icecream),
  // os postes do outdoor (virado para a câmera, a 45°), um pouco atrás da placa
  circle('outdoor-a', TOWN.billboard.x - 2.21, TOWN.billboard.z + 1.89, 0.2), circle('outdoor-b', TOWN.billboard.x + 1.89, TOWN.billboard.z - 2.21, 0.2),
  ...[-1, 1].map((s) => box(`portal-${s < 0 ? 'a' : 'b'}`, AVENUE_X + s * 2.1 - 0.3, TOWN.arch.z - 0.3, AVENUE_X + s * 2.1 + 0.3, TOWN.arch.z + 0.3)),
  circle('placa-modo-historia', AVENUE_X + 1.6, TOWN.barrier.z + 0.4, 0.08), circle('placa-da-avenida', TOWN.sign.x, TOWN.sign.z, 0.08),
  box('cavaletes', CONDO.maxX + 0.2, TOWN.barrier.z - 0.25, RIVER.minX, TOWN.barrier.z + 0.25),
  circle('semaforo', TOWN.light.x, TOWN.light.z, 0.12),
  ...CARS.map((c, i) => (Math.abs(Math.sin(c.yaw)) > 0.5
    ? box(`carro-${i + 1}`, c.x - 0.8, c.z - 1.2, c.x + 0.8, c.z + 1.2)
    : box(`carro-${i + 1}`, c.x - 1.2, c.z - 0.8, c.x + 1.2, c.z + 0.8))),
  // chácara do vovô
  rect('casa-do-vovo', GRANDPA.house), rect('galpao', GRANDPA.barn),
  box('horta', GRANDPA.garden.minX, GRANDPA.garden.minZ, GRANDPA.garden.maxX, GRANDPA.garden.maxZ, { jumpable: true, height: 0.3 }),
  box('chiqueiro-norte', GRANDPA.sty.minX, GRANDPA.sty.minZ - 0.08, GRANDPA.sty.maxX, GRANDPA.sty.minZ + 0.08),
  box('chiqueiro-sul', GRANDPA.sty.minX, GRANDPA.sty.maxZ - 0.08, GRANDPA.sty.maxX, GRANDPA.sty.maxZ + 0.08),
  box('chiqueiro-leste', GRANDPA.sty.maxX - 0.08, GRANDPA.sty.minZ, GRANDPA.sty.maxX + 0.08, GRANDPA.sty.maxZ),
  box('chiqueiro-oeste', GRANDPA.sty.minX - 0.08, GRANDPA.sty.minZ, GRANDPA.sty.minX + 0.08, GRANDPA.sty.maxZ),
  rect('mesa-do-bolo', GRANDPA.table), circle('piscininha', GRANDPA.pool.x, GRANDPA.pool.z, GRANDPA.pool.r),
  circle('bandeirolas-a', GRANDPA.bunting.x0, GRANDPA.bunting.z, 0.1), circle('bandeirolas-b', GRANDPA.bunting.x1, GRANDPA.bunting.z, 0.1),
  box('varanda-do-vovo', GRANDPA.porch.minX, GRANDPA.porch.minZ, GRANDPA.porch.maxX, GRANDPA.porch.maxZ),
  ...GRANDPA.porch.posts.map((k, i) => circle(`coluna-do-vovo-${i + 1}`, GRANDPA.house.x + k, GRANDPA.porch.maxZ - 0.15, 0.1)),
  circle('presente', GRANDPA.gift.x, GRANDPA.gift.z, GRANDPA.gift.s * 0.66),
  ...GRANDPA.hens.map(([x, z], i) => circle(`galinha-${i + 1}`, x, z, 0.24)),
  box('escada-da-casa-na-arvore', GRANDPA.treehouse.x + 0.62, GRANDPA.treehouse.z + 0.62, GRANDPA.treehouse.x + 1.18, GRANDPA.treehouse.z + 0.8),
  box('cerca-da-chacara', FARM.minX + 0.6, FARM.maxZ - 0.8, FARM.maxX - 0.3, FARM.maxZ - 0.6),
  // enfeites de rua
  ...BENCHES.map((b, i) => seg(`banco-${i + 1}`, b.x - Math.cos(b.yaw) * 0.62, b.z + Math.sin(b.yaw) * 0.62, b.x + Math.cos(b.yaw) * 0.62, b.z - Math.sin(b.yaw) * 0.62, 0.26)),
  ...HYDRANTS.map(([x, z], i) => circle(`hidrante-${i + 1}`, x, z, 0.22)),
  ...BINS.map(([x, z], i) => circle(`lixeira-${i + 1}`, x, z, 0.26)),
  ...FOUNTAIN_BEDS.map(([x, z], i) => circle(`vaso-da-praca-${i + 1}`, x, z, 0.3)),
  // buxinhos nas esquinas dos quarteirões
  ...[...Object.entries(BLOCKS), ...Object.entries(TOWN_BLOCKS)].flatMap(([k, b]) => cornerSpots(b).map(([x, z], i) => circle(`buxinho-${k}-${i + 1}`, x, z, 0.36))),
  // troncos das árvores e os postes
  ...TREES.map((t, i) => circle(`arvore-${i + 1}`, t.x, t.z, TREE_TRUNK_R * (t.s ?? 1))),
  ...LAMPS.map(([x, z], i) => circle(`poste-${i + 1}`, x, z, 0.1)),
  // os mastros das bandeirinhas
  ...FLAGS.map((f) => circle(`bandeirinha-${f.n}`, f.x, f.z, 0.1)),
];


// ---------------------------------------------------------------- navegação da companheira
/** Nós: os cruzamentos, a portaria, a ponte e a frente de cada bandeirinha. */
export const NAV_NODES = {
  ...Object.fromEntries(STREET_X.flatMap((x, i) => STREET_Z.map((z, j) => [`R${i}${j}`, { x, z }]))),
  portaria: { x: CONDO.maxX, z: 0 },
  avNorte: { x: AVENUE_X, z: TOWN_Z[0] }, avMeio: { x: AVENUE_X, z: 0 }, avSul: { x: AVENUE_X, z: TOWN_Z[1] },
  rioNorte: { x: RIVERSIDE_X, z: TOWN_Z[0] }, rioMeio: { x: RIVERSIDE_X, z: 0 }, rioSul: { x: RIVERSIDE_X, z: TOWN_Z[1] },
  ponteOeste: { x: RIVER.minX - 0.7, z: 0 }, ponteLeste: { x: RIVER.maxX + 0.7, z: 0 },
  chacaraMeio: { x: 39.6, z: 0 }, chacaraLeste: { x: 46.5, z: 0 },
  jardim: { x: -21, z: 15 }, portaozinho: { x: -21, z: 23.3 },
  ...Object.fromEntries(FLAGS.map((f) => {
    const s = flagSpot(f, 'lead');
    return [`F${f.n}`, { x: s.x, z: s.z }];
  })),
};
const R = (i, j) => `R${i}${j}`;
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  // grade do condomínio (o leste só com a área aberta)
  ...[0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => /** @type {import('../../types').NavEdge} */ (i === 2 ? [R(i, j), R(i + 1, j), { requires: 'leste' }] : [R(i, j), R(i + 1, j)]))),
  ...[0, 1, 2, 3].flatMap((i) => [0, 1].map((j) => /** @type {import('../../types').NavEdge} */ (i === 3 ? [R(i, j), R(i, j + 1), { requires: 'leste' }] : [R(i, j), R(i, j + 1)]))),
  [R(3, 1), 'portaria', { requires: 'leste' }], ['portaria', 'avMeio', { requires: 'leste' }],
  ['avMeio', 'avNorte', { requires: 'leste' }], ['avMeio', 'avSul', { requires: 'leste' }], ['avMeio', 'rioMeio', { requires: 'leste' }],
  ['avNorte', 'rioNorte', { requires: 'leste' }], ['avSul', 'rioSul', { requires: 'leste' }],
  ['rioNorte', 'rioMeio', { requires: 'leste' }], ['rioMeio', 'rioSul', { requires: 'leste' }],
  ['rioMeio', 'ponteOeste', { requires: 'leste' }], ['ponteOeste', 'ponteLeste', { requires: 'chacara' }],
  ['ponteLeste', 'chacaraMeio', { requires: 'chacara' }], ['chacaraMeio', 'chacaraLeste', { requires: 'chacara' }],
  // a frente de cada bandeirinha liga na rua mais perto
  ['F1', R(1, 2)], ['F1', 'portaozinho'], ['portaozinho', R(2, 2)], ['portaozinho', 'jardim'], ['jardim', 'F5'], ['jardim', 'F8'], ['F5', 'F8'],
  ['F2', R(1, 1)], ['F2', R(1, 2)], ['F3', R(1, 0)], ['F3', R(1, 1)], ['F4', R(1, 1)], ['F4', R(2, 1)],
  ['F6', R(2, 1), { requires: 'leste' }], ['F6', R(3, 1), { requires: 'leste' }],
  ['F7', R(3, 1), { requires: 'leste' }], ['F7', R(3, 2), { requires: 'leste' }],
  ['F9', 'chacaraMeio', { requires: 'chacara' }], ['F10', 'chacaraMeio', { requires: 'chacara' }], ['F10', 'ponteLeste', { requires: 'chacara' }],
];

// Sem entrega nem petiscos no mapa (a fase nunca termina). O GOAL fica longe, fora do caminho.
/** @type {import('../../types').Goal} */
export const GOAL = {
  x: CITY.minX + 1, z: CITY.maxZ - 1, r: 0.01,
  celebrate: { radhija: { x: -20, z: 16 }, rhaenyra: { x: -22, z: 16 } },
  entryPoints: [{ x: -21, z: 18 }],
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  WORLD, DOGS, CITY, FARM, RIVER, CONDO, ROAD_W, WALK_W, STREET_X, STREET_Z, AVENUE_X, RIVERSIDE_X, TOWN_Z, ROADS, CROSSINGS, DIRT,
  BLOCKS, TOWN_BLOCKS, HOUSE, TOWER, LAKE, SERVICE, TOYHOUSE, PLAYGROUND, TOWN, CARS, GRANDPA, FLAGS, FLAG_NEAR, FLAG_PRELOAD,
  ZONES, BRIDGE, TREES, TREE_TRUNK_R, LAMPS, BENCHES, HYDRANTS, BINS, GARDEN_LAMPS, FOUNTAIN_BEDS, STATIC_COLLIDERS, COLLISION_GRID: 4, NAV_NODES, NAV_EDGES, COLLECTIBLES: [], GOAL, CAMERA,
};
export default LAYOUT;
