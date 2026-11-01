// =====================================================================
//  MODO HISTÓRIA · Capítulo 1 · Cadê a Cenoura? — LAYOUT do Recanto das Patinhas (fonte única de coordenadas).
//  O condomínio ao amanhecer, com orvalho, neblina baixa e galhos e telhas da tempestade da véspera pelo chão.
//  Roteiro em docs/HISTORIA.md (cap. 1); estrutura em docs/MODO-HISTORIA.md. Metros, Y para cima, Norte = -Z (o fundo,
//  onde ficam o muro, a rua e a cidade), câmera ao sul, como nas fases.
//
//  De oeste para leste e de sul para norte:
//   CASA das irmãs (sudoeste), em corte de maquete: o QUARTO (a caminha embaixo do basculante, o pote d'água), a
//     COZINHA (a porta para o quintal tem maçaneta de alavanca: impulso da Rhaenyra) e a SALA, ao sul.
//   QUINTAL, a leste da casa: a PORTA DA ÁREA DE SERVIÇO, no muro norte, está travada por um GALHO da tempestade
//     (a Rhaenyra empurra para o leste); embaixo dele, as telhas. A casinha de cachorro guarda uma meia.
//   PISCINA, no meio: a marca molhada da boia de patinho, a oeste, é onde o Faro mostra a Reconstrução.
//   ÁREA DE SERVIÇO, encostada no muro norte: tanques (o ralo sem a rolha) e o VARAL, onde a cenoura ficou presa num
//     pregador (a arrancada da Radhija no poste do leste solta).
//   TORRE do condomínio, a nordeste da área de serviço: a PORTA DE MOLA (a Rhaenyra segura com o Fica) leva à escada;
//     o terraço é cena (as irmãs quase pegam a cenoura, o vento sul leva os pombos por cima do muro).
//   GUARITA e PORTÃOZINHO, no canto nordeste: o porteiro cochila lá dentro (fora de vista); a meia na antena; a lixeira
//     de rodinhas perto.
//   LAGO, a leste: a ilha com o petisco, o píer da Dona Gansa e o barquinho de pedal na margem sul.
//   GARAGEM, ao sul: a caminhonete (só a Radhija passa por baixo), o balde na prateleira e o depósito travado pela bola.
//   Do lado de fora do muro norte, a RUA e a cidade (o portal e, longe, a torre da Prefeitura parada).
// =====================================================================
import { withStart } from '../../../dogs/config.js';

// ---------------------------------------------------------------- terreno
/** Limites onde as dogs andam (a rua do lado de fora é só cenário: as cenas levam as dogs até lá). */
export const WORLD = { bounds: { minX: -14.0, maxX: 14.0, minZ: -8.8, maxZ: 8.6 } };
/** O muro do condomínio: as linhas de centro e a espessura; a altura (o do norte é mais baixo: a cidade aparece). */
/** O do sul fica cortado baixo, como as paredes de maquete: a câmera olha sempre do sul, por cima dele. */
export const WALL = { minX: -14.2, maxX: 14.2, minZ: -9.0, maxZ: 8.8, t: 0.24, h: 1.85, hNorth: 1.5, hSouth: 0.62 };
/** O portãozinho de pedestres no muro norte (fechado até o porteiro abrir), ao lado da guarita. */
export const GATE = { x0: 12.5, x1: 13.5, z: WALL.minZ, h: 1.45 };
/** A folha do portãozinho: abre para dentro (para o sul), como as outras dobradiças (folha ao longo de −Z local). */
export const GATE_LEAF = {
  hinge: { x: GATE.x0, z: GATE.z }, latchPost: { x: GATE.x1, z: GATE.z }, length: GATE.x1 - GATE.x0,
  closedYaw: -Math.PI / 2, openYaw: -Math.PI / 2 - Math.PI * 0.55, openTime: 1.4, closeTime: 1.2,
};
/** A rua do lado de fora do muro norte (cenário e cena de fechamento). */
export const STREET = { z0: -9.12, sidewalk: -10.2, z1: -13.2, curb: 0.14 };

// ---------------------------------------------------------------- casa (sudoeste)
/** Paredes: espessura, altura e a altura do corte (as paredes do sul e as de dentro ficam baixas, como maquete). */
export const WALLS = { t: 0.16, h: 2.7, low: 0.62 };
/** A casa inteira (centro das paredes de fora). O oeste é o próprio muro do condomínio. */
export const HOUSE = { x0: WALL.minX, x1: -6.8, z0: 1.2, z1: 8.4, floorY: 0.04 };
/** Cômodos (faces de dentro aproximadas pelas linhas de centro). */
export const ROOMS = {
  quarto: { x0: HOUSE.x0, x1: -10.4, z0: HOUSE.z0, z1: 4.8 },
  cozinha: { x0: -10.4, x1: HOUSE.x1, z0: HOUSE.z0, z1: 4.8 },
  sala: { x0: HOUSE.x0, x1: HOUSE.x1, z0: 4.8, z1: HOUSE.z1 },
};
/** A passagem do quarto para a cozinha (na parede x = −10,4) e da cozinha para a sala (na parede z = 4,8). */
export const DOORWAYS = {
  quartoCozinha: { x: ROOMS.quarto.x1, z0: 2.55, z1: 3.5 },
  cozinhaSala: { z: ROOMS.cozinha.z1, x0: -9.4, x1: -8.2 },
};
/** O basculante do quarto, na parede norte: largura, peitoril e alto (a Rhaenyra de pé alcança o vão). */
export const WINDOW = { x0: -12.85, x1: -11.55, z: HOUSE.z0, sill: 0.55, top: 1.42, openAngle: 0.42 };
/** O parapeito de fora (onde os pombos pousam) e o de dentro (a baba, a pista escondida). */
export const SILL = {
  out: { x: (WINDOW.x0 + WINDOW.x1) / 2, z: HOUSE.z0 - 0.17, y: WINDOW.sill, w: WINDOW.x1 - WINDOW.x0 + 0.22, d: 0.2 },
  in: { x: (WINDOW.x0 + WINDOW.x1) / 2, z: HOUSE.z0 + 0.14, y: WINDOW.sill, w: WINDOW.x1 - WINDOW.x0 + 0.1, d: 0.14 },
};
/** A caminha redonda das duas, embaixo do basculante, e o pote d'água ao lado. */
export const BED = { x: -12.2, z: 2.32, r: 0.8, rim: 0.12, h: 0.22 };
export const BOWL = { x: -11.05, z: 2.2, r: 0.16 };
/** Móveis do quarto e da cozinha (colisores e cenário). */
export const WARDROBE = { x: -13.72, z: 4.0, hx: 0.36, hz: 0.6, h: 1.9 };
export const TOY_BASKET = { x: -13.6, z: 1.75, r: 0.26 };
export const COUNTER = { x0: -10.25, x1: -7.0, z0: HOUSE.z0 + WALLS.t / 2, z1: 1.86, h: 0.92 };
export const FRIDGE = { x: -9.95, z: 4.3, hx: 0.36, hz: 0.38, h: 1.75 };
export const KITCHEN_TABLE = { x: -7.75, z: 3.95, hx: 0.45, hz: 0.38, h: 0.74 };
export const SOFA = { x: -11.8, z: 7.7, hx: 1.1, hz: 0.42, h: 0.8 };
export const TV_RACK = { x: -9.0, z: 8.1, hx: 0.8, hz: 0.24, h: 0.5 };
/** A porta da cozinha para o quintal (parede leste da casa): dobradiça ao norte, abre para fora (o quintal). */
export const KITCHEN_DOOR = {
  hinge: { x: HOUSE.x1, z: 2.4 }, latchPost: { x: HOUSE.x1, z: 3.3 }, length: 0.9,
  closedYaw: Math.PI, openYaw: Math.PI + Math.PI * 0.55, openTime: 0.9, closeTime: 1.0, h: 2.05,
};
/** A maçaneta de alavanca, do lado de dentro (impulso na parede da Rhaenyra, de dentro da cozinha). */
export const KITCHEN_HANDLE = { x: HOUSE.x1 - 0.06, z: 3.12, nx: -1, nz: 0, top: 1.02, kind: 'lever', mode: 'once', lat: 0 };

// ---------------------------------------------------------------- quintal (a leste da casa)
export const YARD = { x0: HOUSE.x1, x1: -2.9, z0: HOUSE.z0, z1: WALL.maxZ, wallH: 1.2 };
/** A porta da área de serviço, no muro norte do quintal: abre para dentro do quintal (para o sul). */
export const SERVICE_DOOR = {
  hinge: { x: -5.3, z: YARD.z0 }, latchPost: { x: -4.35, z: YARD.z0 }, length: 0.95,
  closedYaw: -Math.PI / 2, openYaw: -Math.PI / 2 - Math.PI * 0.55, openTime: 1.0, closeTime: 1.0, h: 1.9,
};
/**
 * O galho da tempestade encostado na porta, do lado do quintal (caixa empurrável de meia medida `half`): a Rhaenyra
 * empurra para o leste; depois de `freeX`, a porta abre. Embaixo dele, as telhas quebradas (pista do caso 2).
 */
export const BRANCH = { start: { x: -4.8, z: 1.86 }, half: 0.46, height: 0.55, minX: -4.8, maxX: YARD.x1 - WALLS.t / 2 - 0.48, minZ: 1.86, maxZ: 1.86, pushSpeed: 0.75, freeX: -3.8 };
export const TILES = { x: -4.75, z: 1.95 };
/** A casinha de cachorro do quintal (a porta para o oeste é estreita: só a Radhija entra). */
export const DOGHOUSE = { x: -3.85, z: 6.7, hx: 0.55, hz: 0.6, h: 1.0, door: 0.5 };
export const YARD_BEDS = [{ x: -6.1, z: 7.6, hx: 0.45, hz: 0.9 }, { x: -3.5, z: 4.4, hx: 0.38, hz: 0.75 }];

// ---------------------------------------------------------------- piscina (meio)
export const POOL = { x0: -5.0, x1: 1.0, z0: -4.8, z1: -1.8, deck: { x0: -6.3, x1: 2.3, z0: -6.1, z1: -0.55 }, depth: 0.9 };
/** A marca molhada onde a boia de patinho ficava (o Faro mostra a Reconstrução a partir daqui). */
export const RECON = { x: -5.6, z: -3.3, r: 4.6 };
/** Espreguiçadeiras e o guarda-sol (cenário com colisão; por baixo da do leste só a Radhija passa). */
export const LOUNGERS = [{ x: 1.75, z: -1.5, yaw: 0, hx: 0.34, hz: 0.95 }, { x: 1.75, z: -4.95, yaw: Math.PI, hx: 0.34, hz: 0.95 }];
export const UMBRELLA = { x: 2.0, z: -3.05, r: 0.12 };

// ---------------------------------------------------------------- área de serviço (norte)
export const SERVICE = { x0: -6.3, x1: 2.9, z0: WALL.minZ, z1: -6.4 };
/** Os tanques embaixo do telhadinho; o ralo do da esquerda está sem a rolha (pista escondida do caso 1). */
export const TANKS = { x0: -6.05, x1: -4.05, z0: WALL.minZ + WALL.t / 2, z1: -8.3, h: 0.86 };
export const DRAIN = { x: -5.55, z: -8.62, y: TANKS.h - 0.2 };
/** O varal entre dois postes; a cenoura presa num pregador perto do poste do leste. */
export const LINE = { a: { x: -3.4, z: -7.55 }, b: { x: 2.25, z: -7.55 }, h: 1.32, postR: 0.07 };
export const CARROT_PIN = { x: 1.25, z: LINE.a.z, y: LINE.h - 0.02 };
/** A arrancada da Radhija até este raio do poste do leste sacode o varal e solta o pregador. */
export const DASH_POST = { x: LINE.b.x, z: LINE.b.z, r: 0.62 };
export const BASKET = { x: -2.6, z: -8.58, r: 0.28 };

// ---------------------------------------------------------------- torre do condomínio (nordeste da área de serviço)
export const TOWER = { x0: 3.6, x1: 8.2, z0: WALL.minZ, z1: -4.8, h: 2.6, parapet: 0.55, tank: { x0: 5.9, x1: 8.2, z0: WALL.minZ, z1: -7.0, h: 4.5 } };
/** A porta de mola, na parede oeste da torre: abre para dentro (o leste); a mola fecha quando ninguém está no vão. */
export const TOWER_DOOR = {
  hinge: { x: TOWER.x0, z: -6.62 }, latchPost: { x: TOWER.x0, z: -5.72 }, length: 0.9,
  closedYaw: Math.PI, openYaw: Math.PI + Math.PI * 0.5, openTime: 0.8, closeTime: 0.65, h: 2.0,
};
/** O saguão logo depois da porta: a Radhija entrando aqui começa a cena da escada e do terraço. */
export const TOWER_LOBBY = { x0: TOWER.x0 + 0.1, x1: TOWER.x0 + 1.5, z0: -7.4, z1: -5.0 };
/** O terraço (só em cena): a casinha da escada e os lugares das irmãs e dos pombos. */
export const TERRACE = {
  y: TOWER.h, hut: { x: 4.4, z: -5.6 }, rad: { x: 5.0, z: -6.5 }, rha: { x: 5.6, z: -7.15 },
  pigeons: { x: 7.0, z: -8.0, y: TOWER.tank.h }, view: { x: 6.0, z: -30 },
};

// ---------------------------------------------------------------- guarita e portãozinho (nordeste)
export const BOOTH = { x0: 10.2, x1: 12.2, z0: -8.8, z1: -6.8, h: 2.25, roof: 2.42, awning: { z1: -6.2, y0: 1.56, y1: 1.74 } };
/** A antena no telhado com a meia presa (colecionável) e onde a Radhija fica lá em cima. */
export const ANTENNA = { x: 11.75, z: -8.3, top: 3.3, sock: 2.95 };
/** A lixeira de rodinhas (a Rhaenyra empurra; com o Fica, ela segura e a Radhija sobe por ela e pelo toldo). */
export const BIN = { start: { x: 9.0, z: -4.5 }, half: 0.32, height: 1.0, minX: 6.0, maxX: 13.6, minZ: -6.12, maxZ: 6.0, pushSpeed: 0.8 };
/** Onde a lixeira precisa estar (encostada no toldo da guarita) para servir de degrau. */
export const BIN_SPOT = { x0: 10.45, x1: 11.95, z0: -6.15, z1: -5.6 };
/** A subida da Radhija: em cima da lixeira, no toldo, no telhado e perto da antena. */
export const CLIMB = {
  // o toldo cai para o sul: o alto dele em z −6,45 fica em 1,64 (src/story/areas/recanto/world/leste.js)
  bin: BIN.height, awning: { z: -6.45, y: 1.64 }, roof: { z: -7.15, y: BOOTH.roof }, antenna: { x: ANTENNA.x - 0.35, z: -8.0 },
};

// ---------------------------------------------------------------- lago (leste)
/** O lago: um contorno irregular (pontos no sentido horário) e a ilha. */
export const LAKE = {
  outline: [
    { x: 5.9, z: -1.6 }, { x: 7.6, z: -2.6 }, { x: 10.2, z: -2.75 }, { x: 12.6, z: -2.2 }, { x: 13.7, z: -0.4 },
    { x: 13.8, z: 2.4 }, { x: 13.1, z: 4.4 }, { x: 11.9, z: 4.55 }, { x: 11.35, z: 4.52 }, { x: 10.25, z: 4.47 },
    { x: 9.8, z: 4.45 }, { x: 7.8, z: 4.6 }, { x: 6.1, z: 3.6 }, { x: 5.45, z: 1.95 }, { x: 5.45, z: 1.15 },
  ],
  /** Lados do contorno que ficam abertos: a entrada do píer e a boca do canal (índices do primeiro ponto do lado). */
  gaps: [8, 13],
  waterY: -0.12,
  island: { x: 10.8, z: 1.75, r: 1.5 },
};
/** O píer da Dona Gansa, saindo da margem oeste. */
export const PIER = { x0: 5.5, x1: 7.7, z0: 1.15, z1: 1.95, y: 0.18 };
/**
 * O barquinho de pedal (patinho): começa encostado na margem sul; a Rhaenyra empurra pela margem até a frente do canal
 * e para dentro dele (onLimit), onde ele vira ponte entre a margem e a ilha. Só a Radhija atravessa nele.
 */
export const BOAT = { start: { x: 7.6, z: 5.3 }, half: 0.5, height: 0.6, minX: 7.0, maxX: 10.8, minZ: 5.3, maxZ: 5.3, pushSpeed: 0.7, dock: { x: 10.8, z: 3.92 } };
/** O canal estreito entre a margem sul e a ilha (o barquinho encaixa aqui; antes disso, a boca fica fechada). */
export const CHANNEL = { x0: 10.25, x1: 11.35, z0: 3.2, z1: 4.5 };
/** A Dona Gansa: patrulha o píer e a margem do barquinho; um latido de longe a distrai (createGooseNPC). */
export const GOOSE = {
  home: { x: 7.15, z: 1.55 },
  patrol: [{ x: 7.15, z: 1.55 }, { x: 6.6, z: 5.6 }],
  radius: 0.22, alertR: 1.6, lureR: 8.0, lureStop: 1.9, curiousTime: 8, walkSpeed: 0.8,
  chargeSpeed: 2.6, chargeTime: 0.7, knockback: 0.9, cooldown: 1.6,
};

// ---------------------------------------------------------------- garagem (sul)
export const CARPORT = { x0: -1.8, x1: 4.6, z0: 3.6, z1: WALL.maxZ, h: 2.35 };
/** A caminhonete: por baixo, só a Radhija passa (o vão é baixo para a irmã); as rodas colidem com as duas. */
export const CAR = { x0: -0.8, x1: 1.2, z0: 4.2, z1: 8.3, clearance: 0.49, wheelR: 0.34, wheelW: 0.24 };
export const WHEELS = [{ x: -0.72, z: 4.95 }, { x: 1.12, z: 4.95 }, { x: -0.72, z: 7.55 }, { x: 1.12, z: 7.55 }];
/**
 * O depósito no fundo da garagem (sem telhado, em corte: a câmera vê dentro). A porta na parede oeste abre para dentro
 * (o leste) quando a Rhaenyra empurra, mas a bola de futebol está entalada atrás dela, do lado de dentro. Na prateleira
 * de dentro, ao norte da porta, o balde; a corda dele desce pela parede, sai pela fresta de baixo da porta e corre pelo
 * chão até debaixo da caminhonete. A Radhija puxa: o balde cai em cima da bola e a bola rola para longe da porta.
 */
export const STORAGE = { x0: 2.6, x1: 4.6, z0: 6.0, z1: WALL.maxZ, h: 2.3 };
export const STORAGE_DOOR = {
  hinge: { x: STORAGE.x0, z: 6.7 }, latchPost: { x: STORAGE.x0, z: 7.6 }, length: 0.9,
  closedYaw: Math.PI, openYaw: Math.PI + Math.PI * 0.55, openTime: 1.0, closeTime: 1.0, h: 1.95,
};
/** A bola entalada atrás da porta (dentro do arco da folha) e para onde ela rola; o balde fica fora do arco. */
export const BALL = { x: STORAGE.x0 + 0.34, z: 7.3, r: 0.17, rollTo: { x: 4.0, z: 6.5 } };
export const SHELF = { x: STORAGE.x0 + 0.17, z: 6.42, y: 1.3, landing: { x: 3.05, z: 6.36 } };
export const ROPE = { end: { x: 0.35, z: 6.35 }, gap: { x: STORAGE.x0, z: 7.15, y: 0.03 }, pull: 0.55, grabR: 0.55 };

// ---------------------------------------------------------------- colecionáveis e pistas
/** Petiscos (os de sempre). */
/** @type {import('../../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'ilha', x: 11.25, z: 1.35 }, // na ilha do lago (puzzle A)
  { id: 'espreguicadeira', x: 1.75, z: -4.95 }, // embaixo da espreguiçadeira do norte (só a Radhija)
  { id: 'torre', x: 8.45, z: -4.05 }, // no canto da torre, perto da lixeira
  { id: 'sala', x: -13.55, z: 7.95 }, // no canto da sala, atrás do sofá
];
export const COLLECTIBLE_PICKUP_R = 0.42;
/** Meias perdidas (o colecionável do capítulo). */
export const SOCKS = [
  { id: 'antena', x: ANTENNA.x, z: ANTENNA.z, y: ANTENNA.sock }, // puzzle B (subida pela lixeira e pelo toldo)
  { id: 'deposito', x: 4.0, z: 8.0, y: 0.45 }, // puzzle C (dentro do depósito, em cima de uma caixa)
  { id: 'casinha', x: -3.85, z: 6.75, y: 0.06 }, // dentro da casinha do quintal (só a Radhija entra)
];
export const SOCK_PICKUP_R = 0.45;
/**
 * Onde cada pista está no mundo (as definições, tipos e casos ficam em src/story/clues.js). `r`: até quantos metros
 * da Radhija o pulso do Faro a encontra (as obrigatórias do pulso valem para o quarto todo).
 */
export const CLUE_SPOTS = {
  trilha: { x: -11.9, z: 1.7, r: 8 },
  pote: { x: BOWL.x, z: BOWL.z, r: 8 },
  pena: { x: SILL.out.x + 0.25, z: SILL.out.z, y: SILL.out.y + 0.04, r: 8 },
  baba: { x: SILL.in.x - 0.2, z: SILL.in.z, y: SILL.in.y + 0.02, r: 3.2 },
  telhas: { x: TILES.x, z: TILES.z },
  boia: { x: RECON.x, z: RECON.z, r: RECON.r },
  ralo: { x: DRAIN.x, z: DRAIN.z, y: DRAIN.y, r: 3.6 },
};
/** A trilha laranja da cenoura no quarto (da caminha até o basculante; some na janela: a garoa lavou lá fora). */
export const CARROT_TRAIL = [
  { x: -12.05, z: 2.15 }, { x: -11.9, z: 1.85 }, { x: -11.95, z: 1.6 }, { x: -12.15, z: 1.45 }, { x: -12.25, z: 1.33 },
];

// ---------------------------------------------------------------- cenário solto (com colisão)
export const TREES = [
  { x: -9.0, z: -2.6, kind: 'ipe-amarelo' }, { x: -12.6, z: -6.6, kind: 'verde' }, { x: 3.7, z: 2.3, kind: 'ipe-rosa' },
  { x: 13.45, z: -2.6, kind: 'verde' }, { x: 6.0, z: 7.4, kind: 'verde' }, { x: 13.2, z: 7.6, kind: 'ipe-roxo' },
  { x: -13.0, z: -1.4, kind: 'verde' },
];
export const TREE_TRUNK_R = 0.25;
export const BENCHES = [{ x: -8.6, z: -6.0, yaw: Math.PI / 2 }, { x: 9.0, z: -3.35, yaw: 0 }]; // o segundo de frente para o lago
export const LAMPS = [{ x: -2.55, z: 0.95 }, { x: 3.95, z: -4.35 }, { x: 9.4, z: -6.3 }, { x: 4.8, z: 2.8 }, { x: -7.2, z: -4.6 }];
/** O cartaz da eleição (pictogramas: urna, sino e o relógio marcando uma hora) no muro norte, perto do portãozinho. */
export const ELECTION_POSTER = { x: 9.25, z: WALL.minZ + WALL.t / 2 + 0.01, y: 1.0, w: 0.9, h: 0.62 };
/** Canteiros compridos junto ao muro (com colisão). */
export const BEDS = [
  { x: -10.3, z: WALL.minZ + WALL.t / 2 + 0.24, hx: 3.6, hz: 0.22 }, // ao longo do muro norte, a oeste
  { x: WALL.minX + WALL.t / 2 + 0.22, z: -4.4, hx: 0.22, hz: 3.2 }, // ao longo do muro oeste, ao norte da casa
  { x: 10.4, z: WALL.maxZ - WALL.t / 2 - 0.16, hx: 3.4, hz: 0.16 }, // junto ao muro sul, perto do lago
];

// ---------------------------------------------------------------- colisão
/** @returns {import('../../../types').BoxCollider} */
const box = (id, minX, minZ, maxX, maxZ, extra = {}) => ({ id, shape: 'box', x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hx: (maxX - minX) / 2, hz: (maxZ - minZ) / 2, ...extra });
/** @returns {import('../../../types').CircleCollider} */
const circle = (id, x, z, r, extra = {}) => ({ id, shape: 'circle', x, z, r, ...extra });
/** @returns {import('../../../types').SegmentCollider} */
const seg = (id, ax, az, bx, bz, t = 0.08, extra = {}) => ({ id, shape: 'segment', ax, az, bx, bz, t, ...extra });
const wt = WALLS.t / 2;
const mt = WALL.t / 2;

/** Os lados do lago como segmentos (a margem e a ilha, dois contornos fechados; o píer e o canal ficam abertos). */
function lakeColliders() {
  const P = LAKE.outline;
  const out = [];
  for (let i = 0; i < P.length; i++) {
    if (LAKE.gaps.includes(i)) continue;
    const a = P[i];
    const b = P[(i + 1) % P.length];
    out.push(seg(`lago-${i}`, a.x, a.z, b.x, b.z, 0.12, { kind: 'water' }));
  }
  // a ilha: um contorno de 16 lados, aberto na ponta do canal
  const I = LAKE.island;
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const ax = I.x + Math.sin(a0) * I.r, az = I.z + Math.cos(a0) * I.r;
    const bx = I.x + Math.sin(a1) * I.r, bz = I.z + Math.cos(a1) * I.r;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (mz > I.z && mx > CHANNEL.x0 - 0.05 && mx < CHANNEL.x1 + 0.05) continue; // a ponta do canal
    out.push(seg(`ilha-${i}`, ax, az, bx, bz, 0.1, { kind: 'water' }));
  }
  // as paredes do canal (da margem até a ilha) e as grades do píer
  out.push(seg('canal-oeste', CHANNEL.x0, CHANNEL.z1, CHANNEL.x0, CHANNEL.z0, 0.06, { kind: 'water' }));
  out.push(seg('canal-leste', CHANNEL.x1, CHANNEL.z1, CHANNEL.x1, CHANNEL.z0, 0.06, { kind: 'water' }));
  out.push(seg('pier-norte', PIER.x0 - 0.05, PIER.z0, PIER.x1, PIER.z0, 0.05));
  out.push(seg('pier-sul', PIER.x0 - 0.05, PIER.z1, PIER.x1, PIER.z1, 0.05));
  out.push(seg('pier-ponta', PIER.x1, PIER.z0, PIER.x1, PIER.z1, 0.05));
  return out;
}

/** @type {import('../../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  // muro do condomínio (o portãozinho é dinâmico; o vão dele fica aberto aqui)
  seg('muro-norte-oeste', WALL.minX, WALL.minZ, GATE.x0, WALL.minZ, mt),
  seg('muro-norte-leste', GATE.x1, WALL.minZ, WALL.maxX, WALL.minZ, mt),
  seg('muro-leste', WALL.maxX, WALL.minZ, WALL.maxX, WALL.maxZ, mt),
  seg('muro-sul', WALL.minX, WALL.maxZ, WALL.maxX, WALL.maxZ, mt),
  seg('muro-oeste', WALL.minX, WALL.minZ, WALL.minX, WALL.maxZ, mt),
  // casa: paredes de fora (a porta da cozinha é dinâmica) e as de dentro, com as passagens
  seg('casa-norte', HOUSE.x0, HOUSE.z0, HOUSE.x1, HOUSE.z0, wt),
  seg('casa-leste-norte', HOUSE.x1, HOUSE.z0, HOUSE.x1, KITCHEN_DOOR.hinge.z, wt),
  seg('casa-leste-sul', HOUSE.x1, KITCHEN_DOOR.latchPost.z, HOUSE.x1, HOUSE.z1, wt),
  seg('casa-sul', HOUSE.x0, HOUSE.z1, HOUSE.x1, HOUSE.z1, wt),
  seg('quarto-cozinha-norte', DOORWAYS.quartoCozinha.x, HOUSE.z0, DOORWAYS.quartoCozinha.x, DOORWAYS.quartoCozinha.z0, wt),
  seg('quarto-cozinha-sul', DOORWAYS.quartoCozinha.x, DOORWAYS.quartoCozinha.z1, DOORWAYS.quartoCozinha.x, ROOMS.quarto.z1, wt),
  seg('quarto-sala', HOUSE.x0, ROOMS.quarto.z1, ROOMS.quarto.x1, ROOMS.quarto.z1, wt),
  seg('cozinha-sala-oeste', ROOMS.cozinha.x0, ROOMS.cozinha.z1, DOORWAYS.cozinhaSala.x0, ROOMS.cozinha.z1, wt),
  seg('cozinha-sala-leste', DOORWAYS.cozinhaSala.x1, ROOMS.cozinha.z1, HOUSE.x1, ROOMS.cozinha.z1, wt),
  // móveis
  circle('caminha', BED.x, BED.z, BED.r + 0.02),
  // o pote de pé ou virado (depois da abertura ele fica deitado, um pouco para o leste)
  circle('pote', BOWL.x + 0.07, BOWL.z, BOWL.r + 0.09),
  box('guarda-roupa', WARDROBE.x - WARDROBE.hx, WARDROBE.z - WARDROBE.hz, WARDROBE.x + WARDROBE.hx, WARDROBE.z + WARDROBE.hz),
  circle('cesto-de-brinquedos', TOY_BASKET.x, TOY_BASKET.z, TOY_BASKET.r),
  box('bancada', COUNTER.x0, COUNTER.z0, COUNTER.x1, COUNTER.z1),
  box('geladeira', FRIDGE.x - FRIDGE.hx, FRIDGE.z - FRIDGE.hz, FRIDGE.x + FRIDGE.hx, FRIDGE.z + FRIDGE.hz),
  box('mesa-cozinha', KITCHEN_TABLE.x - KITCHEN_TABLE.hx, KITCHEN_TABLE.z - KITCHEN_TABLE.hz, KITCHEN_TABLE.x + KITCHEN_TABLE.hx, KITCHEN_TABLE.z + KITCHEN_TABLE.hz, { blocks: 'large' }),
  // as pernas da mesa (a Radhija passa por baixo, entre elas)
  ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => circle(`mesa-perna-${i + 1}`, KITCHEN_TABLE.x + sx * 0.4, KITCHEN_TABLE.z + sz * 0.33, 0.04)),
  // a quina de fora da casa (o pilar da esquina do quintal)
  box('casa-quina', HOUSE.x1 - 0.25, HOUSE.z0 - 0.17, HOUSE.x1 + 0.12, HOUSE.z0 + 0.15),
  box('sofa', SOFA.x - SOFA.hx, SOFA.z - SOFA.hz, SOFA.x + SOFA.hx, SOFA.z + SOFA.hz),
  box('rack', TV_RACK.x - TV_RACK.hx, TV_RACK.z - TV_RACK.hz, TV_RACK.x + TV_RACK.hx, TV_RACK.z + TV_RACK.hz),
  // quintal (a porta da área de serviço é dinâmica)
  seg('quintal-norte-oeste', YARD.x0, YARD.z0, SERVICE_DOOR.hinge.x, YARD.z0, wt),
  seg('quintal-norte-leste', SERVICE_DOOR.latchPost.x, YARD.z0, YARD.x1, YARD.z0, wt),
  seg('quintal-leste', YARD.x1, YARD.z0, YARD.x1, YARD.z1, wt),
  seg('casinha-norte', DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.hz, DOGHOUSE.x + DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.hz, 0.05),
  seg('casinha-sul', DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.hz, DOGHOUSE.x + DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.hz, 0.05),
  seg('casinha-leste', DOGHOUSE.x + DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.hz, DOGHOUSE.x + DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.hz, 0.05),
  seg('casinha-oeste-norte', DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.hz, DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.door / 2, 0.05),
  seg('casinha-oeste-sul', DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.door / 2, DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.hz, 0.05),
  ...YARD_BEDS.map((b, i) => box(`canteiro-quintal-${i + 1}`, b.x - b.hx, b.z - b.hz, b.x + b.hx, b.z + b.hz)),
  // piscina: a água bloqueia (a borda é o deque de andar)
  box('piscina', POOL.x0, POOL.z0, POOL.x1, POOL.z1, { kind: 'water' }),
  ...LOUNGERS.map((l, i) => box(`espreguicadeira-${i + 1}`, l.x - l.hx, l.z - l.hz, l.x + l.hx, l.z + l.hz, { blocks: 'large' })),
  // as cabeceiras e os pés baixos das espreguiçadeiras (a Radhija entra por baixo pelos lados compridos)
  ...LOUNGERS.flatMap((l, i) => [-1, 1].map((s) => seg(`espreguicadeira-${i + 1}-ponta-${s < 0 ? 'n' : 's'}`, l.x - l.hx + 0.01, l.z + s * 0.86, l.x + l.hx - 0.01, l.z + s * 0.86, 0.05))),
  circle('guarda-sol', UMBRELLA.x, UMBRELLA.z, UMBRELLA.r),
  // o filtro da piscina, a ducha e os vasos do deque (src/story/areas/recanto/world/comum.js)
  box('filtro-piscina', -4.82, -5.86, -4.18, -5.38),
  circle('ducha', 0.55, -5.6, 0.08),
  circle('vaso-piscina-1', -6.1, -0.75, 0.22),
  circle('vaso-piscina-2', 2.15, -3.65, 0.18),
  // área de serviço
  box('tanques', TANKS.x0, TANKS.z0, TANKS.x1, TANKS.z1),
  circle('poste-varal-oeste', LINE.a.x, LINE.a.z, LINE.postR + 0.03),
  circle('poste-varal-leste', LINE.b.x, LINE.b.z, LINE.postR + 0.03),
  circle('cesto-de-roupa', BASKET.x, BASKET.z, BASKET.r),
  // torre (a porta de mola é dinâmica; o vão dela fica aberto)
  seg('torre-oeste-norte', TOWER.x0, TOWER.z0, TOWER.x0, TOWER_DOOR.hinge.z, wt),
  // os cantos de baixo da torre fecham por inteiro (os segmentos passam meia parede da quina)
  seg('torre-oeste-sul', TOWER.x0, TOWER_DOOR.latchPost.z, TOWER.x0, TOWER.z1 + wt, wt),
  seg('torre-sul', TOWER.x0 - wt, TOWER.z1, TOWER.x1 + wt, TOWER.z1, wt),
  seg('torre-leste', TOWER.x1, TOWER.z0, TOWER.x1, TOWER.z1 + wt, wt),
  box('torre-saguao-fundo', TOWER_LOBBY.x1, TOWER.z0, TOWER.x1, TOWER.z1),
  seg('torre-saguao-norte', TOWER.x0, TOWER_LOBBY.z0, TOWER_LOBBY.x1, TOWER_LOBBY.z0, wt),
  // guarita
  box('guarita', BOOTH.x0, BOOTH.z0, BOOTH.x1, BOOTH.z1),
  // lago, ilha e píer (o píer é de andar; a ilha é terra no meio da água); na ilha, a casinha dos patos e a moita
  ...lakeColliders(),
  circle('ilha-casinha', LAKE.island.x - 0.4, LAKE.island.z - 0.2, 0.32),
  // garagem
  // sem `height`: a cabeça da Rhaenyra também desvia da lataria (v2/head.js pula os colisores mais baixos que ela)
  box('caminhonete', CAR.x0, CAR.z0, CAR.x1, CAR.z1, { blocks: 'large' }),
  ...WHEELS.map((w, i) => box(`roda-${i + 1}`, w.x - CAR.wheelW / 2, w.z - CAR.wheelR, w.x + CAR.wheelW / 2, w.z + CAR.wheelR)),
  seg('deposito-oeste-norte', STORAGE.x0, STORAGE.z0, STORAGE.x0, STORAGE_DOOR.hinge.z, wt),
  seg('deposito-oeste-sul', STORAGE.x0, STORAGE_DOOR.latchPost.z, STORAGE.x0, STORAGE.z1, wt),
  seg('deposito-norte', STORAGE.x0, STORAGE.z0, STORAGE.x1, STORAGE.z0, wt),
  seg('deposito-leste', STORAGE.x1, STORAGE.z0, STORAGE.x1, STORAGE.z1, wt),
  circle('garagem-pilar-1', CARPORT.x0, CARPORT.z0, 0.1), circle('garagem-pilar-2', CARPORT.x1, CARPORT.z0, 0.1),
  circle('garagem-pilar-3', CARPORT.x0, 8.4, 0.1),
  // dentro do depósito (src/story/areas/recanto/world/garagem.js): as latas de tinta, a caixa de brinquedos com o saco
  // de ração (a meia fica em cima dela) e a vassoura com o rastelo
  box('deposito-latas', 2.68, 7.8, 3.25, 8.68),
  box('deposito-caixa', 3.82, 7.82, 4.52, 8.68),
  box('deposito-vassouras', 4.2, 6.08, 4.52, 6.36),
  // árvores, bancos e postes
  ...TREES.map((t, i) => circle(`arvore-${i + 1}`, t.x, t.z, TREE_TRUNK_R)),
  ...BEDS.map((b, i) => box(`canteiro-${i + 1}`, b.x - b.hx, b.z - b.hz, b.x + b.hx, b.z + b.hz)),
  ...BENCHES.map((b, i) => (Math.abs(Math.sin(b.yaw)) > 0.5
    ? box(`banco-${i + 1}`, b.x - 0.25, b.z - 0.7, b.x + 0.25, b.z + 0.7)
    : box(`banco-${i + 1}`, b.x - 0.7, b.z - 0.25, b.x + 0.7, b.z + 0.25))),
  ...LAMPS.map((l, i) => circle(`poste-${i + 1}`, l.x, l.z, 0.08)),
];

// ---------------------------------------------------------------- navegação da companheira
/** @type {Record<string, import('../../../types').XZ>} */
export const NAV_NODES = {
  Q_bed: { x: -12.0, z: 3.5 }, Q_door: { x: -10.4, z: 3.03 }, K_mid: { x: -8.9, z: 2.75 }, K_door: { x: -7.3, z: 2.85 },
  K_sala: { x: -8.8, z: 4.8 }, S_mid: { x: -10.6, z: 6.4 },
  Y_door: { x: -6.2, z: 2.85 }, Y_mid: { x: -5.2, z: 4.6 }, Y_south: { x: -4.6, z: 7.8 }, Y_gate: { x: -4.8, z: 2.4 },
  C_gate: { x: -4.8, z: 0.4 }, C_west: { x: -8.6, z: 0.3 }, C_far: { x: -12.6, z: 0.15 },
  P_west: { x: -6.85, z: -3.2 }, P_nw: { x: -5.6, z: -6.3 }, P_north: { x: -2.0, z: -6.35 }, P_ne: { x: 2.9, z: -6.35 },
  P_east: { x: 2.95, z: -3.2 }, P_south: { x: -2.0, z: 0.1 }, P_se: { x: 2.8, z: 0.1 },
  V_mid: { x: -1.2, z: -8.1 }, V_east: { x: 2.9, z: -8.2 }, V_west: { x: -3.7, z: -8.05 },
  T_door: { x: 2.95, z: -6.17 }, T_in: { x: 4.3, z: -6.17 }, T_south: { x: 3.3, z: -3.9 }, T_se: { x: 8.6, z: -3.9 }, T_east: { x: 9.6, z: -3.95 },
  E_north: { x: 9.0, z: -5.4 }, E_booth: { x: 11.2, z: -5.6 }, E_gate: { x: 13.0, z: -6.4 }, E_corner: { x: 13.4, z: -3.6 },
  L_pier: { x: 5.0, z: 1.55 }, L_tip: { x: 7.1, z: 1.55 }, L_west: { x: 4.6, z: -2.2 }, L_sw: { x: 5.4, z: 5.0 },
  L_south: { x: 8.6, z: 6.25 }, L_slot: { x: 10.8, z: 6.0 },
  L_east: { x: 13.0, z: 6.0 }, I_mid: { x: 10.8, z: 2.0 },
  G_front: { x: 1.6, z: 2.7 }, G_west: { x: -2.6, z: 4.6 }, G_side: { x: 2.0, z: 5.3 }, G_door: { x: 1.85, z: 7.15 },
  G_in: { x: 3.6, z: 7.4 },
};
/** @type {import('../../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['Q_bed', 'Q_door'], ['Q_door', 'K_mid'], ['K_mid', 'K_door'], ['K_mid', 'K_sala'], ['K_sala', 'S_mid'],
  ['K_door', 'Y_door', { requires: 'kitchenOpen' }],
  ['Y_door', 'Y_mid'], ['Y_door', 'Y_gate'], ['Y_mid', 'Y_south'], ['Y_mid', 'Y_gate'],
  ['Y_gate', 'C_gate', { requires: 'serviceOpen' }],
  ['C_gate', 'C_west'], ['C_west', 'C_far'], ['C_gate', 'P_south'], ['C_west', 'P_west'], ['C_gate', 'P_west'],
  ['P_west', 'P_nw'], ['P_nw', 'P_north'], ['P_north', 'P_ne'], ['P_ne', 'P_east'], ['P_east', 'P_se'],
  ['P_se', 'P_south'], ['P_south', 'C_gate'],
  ['P_nw', 'V_west'], ['P_north', 'V_mid'], ['V_west', 'V_mid'], ['V_mid', 'V_east'], ['V_east', 'P_ne'],
  ['P_ne', 'T_door'], ['V_east', 'T_door'], ['T_door', 'T_in', { requires: 'towerOpen' }],
  ['P_east', 'T_south'], ['P_ne', 'T_south'], ['T_south', 'T_se'], ['T_se', 'E_north'], ['T_se', 'T_east'], ['T_east', 'E_north'], ['E_north', 'E_booth'],
  ['E_booth', 'E_gate'], ['E_north', 'E_corner'], ['E_booth', 'E_corner'],
  ['P_east', 'L_west'], ['L_west', 'L_pier'], ['P_se', 'L_pier'], ['L_pier', 'L_tip'], ['L_pier', 'L_sw'],
  ['P_se', 'G_front'], ['G_front', 'L_sw'], ['L_sw', 'L_south'], ['G_front', 'L_south'],
  ['L_south', 'L_slot'], ['L_slot', 'L_east'], ['L_slot', 'I_mid', { requires: ['small', 'boatDocked'] }],
  ['G_front', 'G_west'], ['G_front', 'G_side'], ['G_side', 'G_door'], ['G_door', 'G_in', { requires: 'storageOpen' }],
];

// ---------------------------------------------------------------- objetivo, câmera
/** Sem entrega: o capítulo termina pela cena do portãozinho. O GOAL fica longe, fora do caminho. */
/** @type {import('../../../types').Goal} */
export const GOAL = {
  x: -13.6, z: 8.2, r: 0.01,
  celebrate: { radhija: { x: 12.8, z: -7.6 }, rhaenyra: { x: 13.3, z: -7.2 } },
  entryPoints: [{ x: 12.0, z: -6.0 }],
};

/** O sol baixo da manhã vem do leste, um pouco do sul (sombras compridas para o oeste). */
export const SUN = { direction: [0.62, 0.48, 0.42], color: '#ffd9a8', intensity: 1.15 };

/** @type {import('../../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.3, 4.4, 4.8],
  lookHeight: 0.3,
  limits: { minX: -12.6, maxX: 12.8, minZ: -7.6, maxZ: 6.4 },
  zones: [
    // dentro do quarto e da cozinha: o olhar sobe um pouco (a parede do norte e o basculante entram no quadro)
    { id: 'casa', minX: HOUSE.x0, maxX: HOUSE.x1, minZ: HOUSE.z0, maxZ: ROOMS.quarto.z1, lookY: 0.25, dz: -0.35 },
    // na guarita, enquanto a Radhija sobe pela lixeira e pelo toldo (a fase liga só durante a subida)
    { id: 'telhado', minX: BOOTH.x0 - 2, maxX: BOOTH.x1 + 2, minZ: BOOTH.z0 - 1, maxZ: BIN_SPOT.z1 + 1.5, lookY: 1.9, dz: -0.6 },
    // no varal e na antena, o olhar sobe para o que está no alto
    { id: 'varal', minX: LINE.a.x - 1, maxX: LINE.b.x + 1.2, minZ: SERVICE.z0, maxZ: SERVICE.z1 + 0.6, lookY: 0.55, dz: -0.2 },
  ],
  title: { center: { x: -10.6, z: 3.0 }, radius: 4.6, angle: 0.4, height: 2.6, look: { x: -12.0, y: 0.6, z: 1.8 } },
  celebrate: { pos: [12.4, 1.6, -5.2], look: [13.0, 0.6, -8.4] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

/** @type {import('../../../types').LevelLayout} */
const LAYOUT = {
  WORLD, WALL, GATE, GATE_LEAF, STREET, WALLS, HOUSE, ROOMS, DOORWAYS, WINDOW, SILL, BED, BOWL, WARDROBE, TOY_BASKET,
  COUNTER, FRIDGE, KITCHEN_TABLE, SOFA, TV_RACK, KITCHEN_DOOR, KITCHEN_HANDLE, YARD, SERVICE_DOOR, BRANCH, TILES,
  DOGHOUSE, YARD_BEDS, POOL, RECON, LOUNGERS, UMBRELLA, SERVICE, TANKS, DRAIN, LINE, CARROT_PIN, DASH_POST, BASKET,
  TOWER, TOWER_DOOR, TOWER_LOBBY, TERRACE, BOOTH, ANTENNA, BIN, BIN_SPOT, CLIMB, LAKE, PIER, BOAT, CHANNEL, GOOSE,
  CARPORT, CAR, WHEELS, STORAGE, STORAGE_DOOR, BALL, SHELF, ROPE, COLLECTIBLES, COLLECTIBLE_PICKUP_R, SOCKS,
  SOCK_PICKUP_R, CLUE_SPOTS, CARROT_TRAIL, TREES, TREE_TRUNK_R, BENCHES, LAMPS, ELECTION_POSTER, BEDS,
  DOGS: {
    radhija: withStart('radhija', { x: -11.6, z: 3.15, yaw: 1.9 }),
    rhaenyra: withStart('rhaenyra', { x: -10.95, z: 3.3, yaw: -1.4 }),
  },
  STATIC_COLLIDERS, COLLISION_GRID: 4, NAV_NODES, NAV_EDGES, GOAL, SUN, CAMERA,
};
export default LAYOUT;
