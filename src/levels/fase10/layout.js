// =====================================================================
//  FASE 10 · Festa no Quintal — LAYOUT (fonte única de verdade para coordenadas).
//  O aniversário de 3 anos da Radhija e da Rhaenyra, num fim de tarde que vira noite. Três cenários ligados, de
//  oeste para leste: a CASA em corte (sala, onde as dogs começam, com o quadro "Festa do ano passado"; cozinha, com o
//  disjuntor das luzes da festa; e a despensa), a VARANDA com o bolo de três andares e o QUINTAL (piscininha, gramado,
//  o campinho de milho e legumes, a piñata na roseira e a Dona Gansa guardando o portãozinho) e, atrás da cerca, o
//  FUNDO DO QUINTAL (casa na árvore com o elevador de balde, a horta cercada com lama, o galpão e o chiqueiro).
//  Convenções das outras fases: metros, Y para cima, Norte = -Z (fundo), câmera ao sul.
//
//  O bolo espera cinco enfeites, de baixo para cima, na ordem do quadro da sala: o LAÇO, o BISCOITO DE OSSO, a VELA
//  do número 3, o CHAPEUZINHO e a ESTRELA. Fora de ordem, o enfeite balança e cai ao lado da mesa (pega de novo).
//   CHAPEUZINHO (num barquinho no meio da piscininha vazia): o caixote esmaga a mangueira (a Rhaenyra empurra); a
//     torneira no alto da parede (impulso) enche a piscininha; o disjuntor da cozinha (impulso) acende as luzinhas do
//     quadro e depois as da festa e liga o ventilador, que leva o barquinho até a borda.
//   LAÇO (no corrimão da casa na árvore, com o pombo dormindo em cima): latido de longe distrai a Dona Gansa e a outra
//     puxa a cordinha do portão; o superbafo pelo cano de brinquedo espanta o pombo; o balde deitado: a Radhija entra,
//     a Rhaenyra puxa a corda; lá em cima a Radhija anda pelo deque, desamarra o laço e escorrega (ou volta no balde).
//   BISCOITO DE OSSO (no pote em cima do armário alto da despensa): a Rhaenyra puxa três caixotes pela alça (E e
//     andando para trás) até as marcas do chão, onde eles travam sozinhos (a marca fica verde); em fila, do mais alto ao
//     mais baixo, eles viram a escadinha, e a Radhija sobe por eles (E) e pega o biscoito.
//   VELA DO 3 (na prateleira alta do galpão): a Rhaenyra pula a cerca baixa da horta; a Radhija passa pelo vão e cai na
//     lama (Lambe-Lambe). Na parede do galpão há dois botões altos (impulso): um, sorteado a cada partida, abre a porta
//     do galpão e o outro solta os três porcos do chiqueiro, que atrapalham; legumes do campinho, largados perto deles,
//     os distraem por um tempo. Lá dentro, a Radhija sobe a rampa com uma arrancada.
//   ESTRELA (dentro da piñata pendurada sobre a roseira): o superbafo faz a piñata balançar para fora da roseira; a
//     Rhaenyra pula e bate nela quando ela passa por cima; três batidas e ela abre.
// =====================================================================
import { withStart } from '../../dogs/config.js';
import { pigPenLayout } from '../../game/mechanics/pigHerd.js';

/** O terreno: o leste passa do muro (um cantinho escondido do outro lado) e o sul cresce para a horta e o chiqueiro. */
export const WORLD = { bounds: { minX: -12.0, maxX: 13.4, minZ: -6.0, maxZ: 6.6 } };
/** O muro de madeira alto do leste (centro em x, espessura): limita o quintal do fundo. */
export const EAST_WALL = { x: 12.3, t: 0.08 };

/** @type {Record<import('../../types').DogName, import('../../types').DogStats>} */
export const DOGS = {
  radhija: withStart('radhija', { x: -9.6, z: -3.1, yaw: 2.6 }),
  rhaenyra: withStart('rhaenyra', { x: -10.4, z: -3.5, yaw: 2.4 }),
};

// ---------------------------------------------------------------------------------------------- casa
/** Paredes: a do fundo (norte) inteira e alta; divisórias e a parede da frente cortadas. */
export const WALLS = { northH: 3.0, cutH: 1.3, frontH: 0.7, t: 0.2 };
/** A casa: da borda oeste até a parede leste (x1, centro), do fundo até a parede da frente (zS, centro). */
export const HOUSE = { x0: -12.0, x1: -4.5, zS: -0.3 };
/** Divisória sala | cozinha (x fixo) com o arco largo. */
export const WALL_LK = { x: -8.3, gap: { z0: -3.4, z1: -1.6 } };
/** Porta de vidro da cozinha para a varanda (na parede leste, aberta). */
export const PORCH_DOOR = { z0: -4.75, z1: -3.7 };

// sala
/**
 * O sofá (com saia até o chão: ninguém passa por baixo), encosto para o sul. Entre o encosto e a parede da frente fica
 * um vão de 42 cm (como entre os vasos grandes): só a Radhija cabe, e é lá que caiu um ossinho.
 */
export const SOFA = { x: -10.0, z: -1.2, hx: 0.95, hz: 0.38, h: 0.42, legs: 0.16 };
export const COFFEE_TABLE = { x: -10.0, z: -2.35, hx: 0.48, hz: 0.28, h: 0.36 };
export const SIDEBOARD = { x: -10.3, z: -5.78, hx: 0.85, hz: 0.22, h: 0.62 };
/** O quadro da festa do ano passado: na parede do fundo, em cima do aparador (centro, altura e tamanho). */
export const PAINTING = { x: -10.3, y: 1.62, z: -6.0, w: 1.15, h: 0.82 };
export const BOOKSHELF = { x: -11.575, z: -5.7, hx: 0.42, hz: 0.3, h: 2.0 };
export const ARMCHAIR = { x: -11.2, z: -2.6, r: 0.42, hx: 0.43, hz: 0.44 };
/** As caminhas das duas, no canto perto da estante (raio da almofada; a borda passa 7 cm dele). */
export const DOG_BEDS = [{ x: -11.45, z: -3.75, r: 0.3, name: 'Radhija', color: '#e8a0a8' }, { x: -11.35, z: -4.55, r: 0.36, name: 'Rhaenyra', color: '#8fc0d8' }];
export const FLOOR_LAMP = { x: -11.55, z: -1.0, r: 0.14 };
export const RUG = { x: -10.0, z: -2.4, rx: 1.45, rz: 1.0 };
// cozinha
export const COUNTER = { x0: -8.15, x1: -5.45, z: -5.72, hz: 0.3, h: 0.92 };
export const FRIDGE = { x: -4.98, z: -5.6, hx: 0.34, hz: 0.34, h: 1.85 };
export const KITCHEN_TABLE = { x: -6.4, z: -2.25, hx: 0.62, hz: 0.45, h: 0.76 };
export const KITCHEN_CHAIRS = [{ x: -7.2, z: -2.25, r: 0.2 }, { x: -5.6, z: -2.25, r: 0.2 }, { x: -6.4, z: -1.5, r: 0.2 }];
/** Os potes de ração e de água (com os nomes), na frente da bancada da cozinha, à vista da câmera. */
export const DOG_BOWLS = { x: -6.4, z: -5.05 };
/**
 * Disjuntor das luzes da festa: na divisória, do lado da cozinha (impulso na parede). Liga de vez as luzinhas da
 * varanda e do quintal e a tomada do ventilador.
 * @type {import('../../types').WallButtonCfg}
 */
export const BREAKER = { x: WALL_LK.x + WALLS.t / 2, z: -4.55, nx: 1, nz: 0, top: 1.1, kind: 'lever', mode: 'once' };
// despensa (cômodo novo, ao sul da cozinha, com a porta na parede da frente da cozinha)
/** A despensa: do muro da divisória até a parede leste, da frente da cozinha até a sua própria parede da frente. */
export const PANTRY = { x0: WALL_LK.x, x1: HOUSE.x1, zN: HOUSE.zS, zS: 2.2, door: { x0: -7.75, x1: -6.95 } };
/**
 * O armário alto encostado na parede da cozinha (de frente para o sul), com o pote de biscoitos em cima (top), e os três
 * caixotes de mantimentos de alturas diferentes que a Rhaenyra puxa pela alça (no lado leste) ao longo de um trilho
 * reto, do oeste (x0) até a marca no chão (x1), onde travam sozinhos: em fila na frente do armário, do mais alto (junto
 * dele) ao mais baixo, eles viram a escadinha da Radhija.
 */
export const CUPBOARD = { x: -5.5, z: HOUSE.zS + WALLS.t / 2 + 0.23, hx: 0.45, hz: 0.23, top: 1.0 };
const CUP_FRONT = CUPBOARD.z + CUPBOARD.hz;
export const PANTRY_CRATES = {
  hx: 0.26, hz: 0.18, x0: -6.5, x1: CUPBOARD.x, pullSpeed: 0.85, grabR: 0.55,
  list: [
    { id: 'alto', label: 'Ração', h: 0.76, z: CUP_FRONT + 0.19 },
    { id: 'medio', label: 'Batatas', h: 0.52, z: CUP_FRONT + 0.61 },
    { id: 'baixo', label: 'Maçãs', h: 0.28, z: CUP_FRONT + 1.03 },
  ],
};
/** As prateleiras da despensa (latas, potes e sacos) na parede oeste. */
export const PANTRY_SHELF = { x: PANTRY.x0 + WALLS.t / 2 + 0.2, z: 0.62, hx: 0.2, hz: 0.6, h: 1.6 };

// ---------------------------------------------------------------------------------------------- varanda
export const PORCH = { x0: HOUSE.x1 + WALLS.t / 2, x1: -0.35, z0: WORLD.bounds.minZ, z1: -2.6 };
export const PERGOLA_POSTS = [{ x: -4.2, z: -5.8 }, { x: -0.55, z: -5.8 }, { x: -0.55, z: -2.75 }, { x: -4.2, z: -2.75 }];
/** A mesa do bolo (entrega) e o bolo de três andares em cima dela. */
export const CAKE_TABLE = { x: -2.4, z: -4.45, hx: 0.75, hz: 0.46, h: 0.78 };
export const CAKE = { x: CAKE_TABLE.x, z: CAKE_TABLE.z - 0.05, base: CAKE_TABLE.h, tiers: [{ r: 0.3, h: 0.18 }, { r: 0.22, h: 0.15 }, { r: 0.15, h: 0.13 }] };
/** A ordem certa dos enfeites (de baixo para cima), como no quadro da sala. */
export const CAKE_ORDER = /** @type {const} */ (['ribbon', 'cookie', 'candle', 'hat', 'star']);
/** Onde um enfeite fora de ordem cai (no chão da varanda, ao lado da mesa). */
export const CAKE_REJECT = { x: CAKE_TABLE.x + 1.25, z: CAKE_TABLE.z + 1.15 };
export const GIFTS = { x: -1.15, z: -5.35, hx: 0.42, hz: 0.32 };
export const PORCH_BENCH = { x: -3.55, z: -5.72, hx: 0.6, hz: 0.2, h: 0.44 };
/** Vasos de samambaia nos cantos da varanda (s = semente da planta). */
export const PORCH_POTS = [{ x: PORCH.x0 + 0.3, z: PORCH.z1 - 0.3, s: 3 }, { x: PORCH.x1 - 0.25, z: PORCH.z0 + 0.35, s: 5 }];

// ---------------------------------------------------------------------------------------------- quintal
/** A piscininha de plástico (borda inflável alta) e a água que sobe quando a mangueira corre. */
export const POOL = { x: -1.6, z: 1.1, r: 0.95, rim: 0.32, water: { min: 0.03, max: 0.26, fillTime: 7.0 } };
/** O barquinho com o chapéu: no meio da piscininha; com vento e água alta, ele vai até a borda leste. */
export const BOAT = { start: { x: POOL.x, z: POOL.z }, dock: { x: POOL.x + 0.6, z: POOL.z }, drift: 0.35, floatAt: 0.16, grabR: 0.95 };
/**
 * Torneira no alto da parede leste da casa (impulso na parede): abre de vez.
 * @type {import('../../types').WallButtonCfg}
 */
export const TAP = { x: HOUSE.x1 + WALLS.t / 2, z: -1.15, nx: 1, nz: 0, top: 1.1, kind: 'button', mode: 'once' };
/** A mangueira: da torneira até a borda norte da piscininha (polilinha no chão). */
export const HOSE = [{ x: -4.32, z: -1.15 }, { x: -3.75, z: -0.9 }, { x: -3.05, z: -0.6 }, { x: -2.4, z: -0.24 }, { x: -1.85, z: 0.14 }];
/** Caixote de brinquedos em cima da mangueira (empurrável em X e Z): a menos de `blockR` da mangueira, a água não passa. */
export const CRATE = { start: { x: -3.05, z: -0.6 }, half: 0.3, height: 0.5, minX: -4.05, maxX: 2.6, minZ: -2.3, maxZ: 3.3, pushSpeed: 0.75, blockR: 0.34 };
/** Ventilador do quintal (fixo, a oeste da piscininha, soprando para o leste) e a tomada na parede da casa. */
export const FAN = { x: -3.05, z: POOL.z, r: 0.28, height: 0.95 };
export const OUTLET = { x: HOUSE.x1 + WALLS.t / 2 + 0.02, y: 0.48, z: -0.62 };
/** Vasos grandes perto da varanda: entre eles só a Radhija passa (um ossinho atrás). */
export const PLANTERS = [{ x: 1.7, z: -5.42, r: 0.3 }, { x: 2.72, z: -5.42, r: 0.3 }];
export const LITTLE_TREE = { x: 3.4, z: -3.6, r: 0.22 };
export const FLOWER_BED = { x: 0.9, z: -2.05, hx: 0.75, hz: 0.28 };
export const PICNIC = { x: -6.3, z: 4.6, hx: 0.85, hz: 0.6 };
/**
 * O campinho de milho e legumes (no canto sudoeste do quintal): fileiras de milho (corredores de 42 cm: só a Radhija
 * passa entre elas), o canteiro de cenouras e as abóboras. E perto de um pé pega um legume (para distrair os porcos);
 * cada pé volta a dar depois de `regrow` segundos.
 */
export const PLANTATION = {
  x0: -11.7, x1: -8.3, z0: 2.9, z1: 6.2,
  corn: [{ x: -11.3, z0: 3.3, z1: 5.9 }, { x: -10.52, z0: 3.3, z1: 5.9 }, { x: -9.74, z0: 3.3, z1: 5.9 }], cornHx: 0.18,
  carrots: { x: -8.95, z: 3.55, hx: 0.42, hz: 0.24 }, pumpkins: [{ x: -8.85, z: 4.75 }, { x: -9.0, z: 5.55 }],
  regrow: 6, pickR: 0.6,
};
/** A roseira (com espinhos: ninguém entra) e a mangueira grande, de cujo galho pende a piñata da estrela. */
export const ROSE_BUSH = { x: 1.6, z: 4.4, r: 0.6, h: 0.55 };
export const MANGO_TREE = { x: 3.5, z: 5.7, r: 0.38 };
/**
 * A piñata: presa no galho (pivot) por uma corda de comprimento L, parada em cima da roseira. O superbafo dá
 * impulso; ela balança como um pêndulo. A Rhaenyra, no ar (pulo), acerta quando passa por baixo dela e o fundo da
 * piñata está ao alcance (reach). hits batidas abrem a piñata.
 */
export const PINATA = { pivot: { x: ROSE_BUSH.x, y: 2.75, z: ROSE_BUSH.z }, L: 1.62, size: 0.42, damp: 0.25, kick: 1.6, hitR: 0.42, reach: 1.1, hits: 3 };
/**
 * No começo a piñata está enroscada no galho, perto da copa (fora de alcance; o superbafo nem chega lá). A Rhaenyra
 * fica de pé e empurra o tronco da mangueira (empurrão em pé, pelo norte): no 3º empurrão ela escorrega pelo galho
 * (slide s) e desce na corda até em cima da roseira (drop s).
 * @type {import('../../types').ShoveTargetCfg & { tangled: { x: number, y: number, z: number }, slide: number, drop: number }}
 */
export const MANGO_SHOVE = {
  x: MANGO_TREE.x + 0.02, z: MANGO_TREE.z + 0.06 - 0.33, nx: 0, nz: -1, y: 0.55, w: 0, over: 0, kind: 'tree', pushes: 3,
  tangled: { x: MANGO_TREE.x - 0.85, y: 2.45, z: MANGO_TREE.z - 0.62 }, slide: 0.55, drop: 0.65,
};

// ---------------------------------------------------------------------------------------------- cerca e gansa
/** Cerca de ripas entre o quintal e o fundo (x fixo) com o portãozinho. */
export const BACK_FENCE = { x: 5.4, h: 0.95, gate: { z0: -0.4, z1: 0.8 } };
/**
 * O portãozinho fica pendurado na face de trás dos mourões (dobradiça 10 cm a leste da linha da cerca) e abre para o
 * fundo quase até encostar na cerca (162°): aberto, não forma bolsão com a cerca da horta.
 */
export const GATE = {
  hinge: { x: BACK_FENCE.x + 0.1, z: BACK_FENCE.gate.z1 }, latchPost: { x: BACK_FENCE.x + 0.1, z: BACK_FENCE.gate.z0 },
  length: BACK_FENCE.gate.z1 - BACK_FENCE.gate.z0, closedYaw: 0, openYaw: -Math.PI * 0.9, openTime: 1.2, closeTime: 1.0,
};
/** A cordinha da trava, pendurada no mourão do lado do quintal (E puxa). */
export const CORD = { x: BACK_FENCE.x - 0.12, z: BACK_FENCE.gate.z0 - 0.16, top: 1.0, reach: 0.62 };
/** Dona Gansa guardando o portãozinho (mesma mecânica da fase 3). */
export const GOOSE = {
  home: { x: 4.1, z: -0.4 },
  patrol: [{ x: 4.1, z: -1.2 }, { x: 4.1, z: 0.4 }],
  radius: 0.22,
  alertR: 1.7,
  lureR: 8.5,
  lureStop: 1.9,
  curiousTime: 7,
  walkSpeed: 0.8,
  chargeSpeed: 2.5,
  chargeTime: 1.2,
  knockback: 1.2,
  cooldown: 1.6,
};

// ---------------------------------------------------------------------------------------------- fundo: casa na árvore
/** A árvore grande: o tronco atravessa o canto de trás do deque (lá em cima também é obstáculo). */
export const TREE = { x: 7.55, z: -4.95, r: 0.42 };
/** Deque da casa na árvore (altura h): a Radhija anda nele livre, entre o corrimão, o tronco e a casinha. */
export const DECK = { x0: 6.5, x1: 9.9, z0: -5.95, z1: -3.6, h: 2.05 };
export const DECK_POSTS = [{ x: 6.6, z: -5.85 }, { x: 9.8, z: -5.85 }, { x: 6.6, z: -3.7 }, { x: 9.8, z: -3.7 }, { x: 8.05, z: -3.7 }, { x: 8.3, z: -5.85 }];
/** Corrimão do deque (altura e recuo da borda): a Radhija não passa dele, só pelas aberturas do balde e do escorregador. */
export const DECK_RAIL = { h: 0.42, inset: 0.03 };
/** A casinha (Clubinho R & R) nos fundos do deque, à direita, com a porta virada para a frente. */
export const HUT = { x0: 8.55, x1: 9.85, z0: -5.92, z1: -4.85, wallH: 1.0, door: { x: 9.3, w: 0.42 } };
/** Coisas em cima do deque (só valem lá em cima): a luneta no canto e o baú de brinquedos ao lado da casinha. */
export const DECK_PROPS = { telescope: { x: 6.85, z: -5.6, r: 0.2 }, chest: { x: 8.22, z: -5.62, r: 0.26 } };
/** O laço amarrado no corrimão da frente e o pombo cochilando em cima dele, no corrimão. */
export const RIBBON = { x: 8.6, y: DECK.h + 0.34, z: DECK.z1 + 0.02 };
export const PIGEON = { x: RIBBON.x, y: DECK.h + DECK_RAIL.h + 0.01, z: DECK.z1 - DECK_RAIL.inset, smellR: 0.55 };
/** Cano de brinquedo: funil no chão (entrada do cheiro), sobe pelo poste do meio e a boca fica do lado do pombo. */
export const TUBE = { inlet: { x: 8.3, z: -2.75, r: 0.42 }, funnelY: 0.3, outlet: { x: PIGEON.x, z: PIGEON.z, dirX: 0, dirZ: 1, speed: 0.4 }, travel: 1.4 };
/**
 * Elevador de balde na frente do deque (a câmera vê subir), com a roldana em cima. O balde de lata grande fica
 * DEITADO no chão, com a boca para o sul: a Radhija entra andando e se deita lá dentro; a corda primeiro levanta o
 * balde (os `lie` metros iniciais do puxão o deixam em pé, com ela sentada) e depois o sobe até o deque.
 */
export const BUCKET = { x: 6.95, z: -3.1, r: 0.28, h: 0.4, lie: 0.35, top: DECK.h, pulleyY: 2.85, rise: 1.0, fall: 0.9, enterR: 0.6 };
/**
 * A corda desce da roldana (em cima do balde) até a argola num espeto no chão, ao lado; a ponta solta fica no chão
 * (rest). Quem segura a ponta e se afasta da argola mais que `slack` levanta o balde (andando para o portão).
 */
export const ROPE = { ring: { x: 6.12, y: 0.12, z: -2.95 }, rest: { x: 5.98, z: -2.55 }, slack: 0.55, maxPull: DECK.h + BUCKET.lie, grabR: 0.55 };
/**
 * O escorregador sai da frente do deque, à direita, e desce para o sul, de frente para o gramado aberto (longe do
 * muro). `tongue` é a língua que aplaina no fim; ela pousa depois dela (`land`).
 */
export const SLIDE = { x: 9.4, z0: DECK.z1, z1: -1.95, top: DECK.h, halfWidth: 0.24, tongue: 0.28, land: { x: 9.4, z: -1.2 } };
/** Lá em cima: onde a Radhija chega do balde (e volta para ele), onde ela desamarra o laço e a boca do escorregador. */
export const DECK_PATH = { arrive: { x: BUCKET.x, z: DECK.z1 - 0.3 }, ribbon: { x: RIBBON.x, z: DECK.z1 - 0.3 }, slideTop: { x: SLIDE.x, z: DECK.z1 - 0.23 } };

// ---------------------------------------------------------------------------------------------- fundo: horta, galpão e chiqueiro
/** Horta cercada (cerca baixa: a Rhaenyra pula) com o vão da tábua quebrada (só a Radhija) e a lama do canteiro. */
export const HORTA = { x0: 6.8, x1: 9.6, z0: 0.4, z1: WORLD.bounds.maxZ, fenceH: 0.42, gap: { z0: 1.35, z1: 1.75 } };
export const MUD = { x0: 6.86, x1: 7.9, z0: 1.0, z1: 2.3, licksToClean: 5, slow: 0.5 };
export const VEG_BEDS = [
  { x: 8.2, z: 0.78, hx: 0.4, hz: 0.18 }, { x: 7.85, z: 6.05, hx: 0.6, hz: 0.28 },
  { x: 7.55, z: 3.55, hx: 0.5, hz: 0.2 }, { x: 7.55, z: 4.75, hx: 0.5, hz: 0.2 },
];
/** O pé de tomate no tutor (perto da cerca norte) e o regador encostado no canteiro, dentro da horta. */
export const TOMATO = { x: 7.35, z: 0.62, r: 0.22 };
export const WATERING_CAN = { x: 8.75, z: 5.75, r: 0.17 };
/** Galpão de ferramentas (paredes cortadas, sem telhado) com a porta basculante no oeste. */
export const SHED = { x0: 9.6, x1: 12.05, z0: 0.6, z1: 3.6, wallH: 1.45, t: 0.15, door: { z0: 1.7, z1: 2.6, h: 1.25 } };
/**
 * O painel de madeira dos botões, na horta, encostado no canto sudoeste do galpão e virado para o sul (de frente
 * para a câmera); entre ele e a parede do galpão fica uma frestinha por onde passam os fios.
 */
export const BUTTON_BOARD = { x0: 8.72, x1: SHED.x0 - SHED.t / 2 - 0.06, z: 3.1, t: 0.06, h: 1.4 };
/**
 * Os dois botões altos no painel (impulso da Rhaenyra): um abre a porta do galpão e o outro a porteira do chiqueiro.
 * Qual é qual é sorteado a cada partida (os fios vão juntos para a caixinha de força na parede do galpão).
 * @type {import('../../types').WallButtonCfg[]}
 */
export const SHED_BUTTONS = [
  { x: 8.96, z: BUTTON_BOARD.z + BUTTON_BOARD.t / 2, nx: 0, nz: 1, top: 1.05, kind: 'button', mode: 'once' },
  { x: 9.3, z: BUTTON_BOARD.z + BUTTON_BOARD.t / 2, nx: 0, nz: 1, top: 1.05, kind: 'button', mode: 'once' },
];
export const WORKBENCH = { x: 10.85, z: 0.92, hx: 0.9, hz: 0.25, h: 0.9 };
/** Rampa de tábua ao longo da parede sul do galpão, subindo para o leste até a prateleira alta com a vela. */
export const RAMP = { z: 3.25, x0: 10.15, x1: 11.45, top: 1.0, halfWidth: 0.2 };
export const RAMP_ENTRY = { minX: 9.8, maxX: 10.45, minZ: RAMP.z - 0.36, maxZ: RAMP.z + 0.36 };
export const RAMP_TIMES = { climb: 0.85, grab: 0.5, turn: 0.4, down: 0.6, slip: 0.9 };
export const CANDLE = { x: 11.75, y: RAMP.top + 0.02, z: RAMP.z };
/**
 * O chiqueiro ao sul do galpão: cerca de tábuas (os porcos não pulam), a casinha deles, o cocho e a lama; a porteira
 * abre para a horta (oeste). Os porcos soltos andam pela horta.
 */
export const STY = { x0: 9.6, x1: 12.05, z0: 3.95, z1: 6.45, fenceH: 0.62, gate: { z0: 4.75, z1: 5.55 }, swing: 1.6, home: { x: 11.0, z: 5.3 } };
/** O chiqueiro no formato do createPigHerd: miolo, porteira (dobradiça no norte da abertura, abre para a horta). */
export const STY_PEN = pigPenLayout({ x0: STY.x0 + 0.04, x1: STY.x1 - 0.04, z0: STY.z0 + 0.04, z1: STY.z1 - 0.04, t: 0.08, h: STY.fenceH, door: { side: 'w', a: STY.gate.z0, b: STY.gate.z1 }, swing: STY.swing }, 'chiqueiro');
/** Onde os porcos podem andar soltos (a horta) e de onde eles saem (na frente da porteira). */
/**
 * Duas galinhas ciscando no campinho, entre o milho e os legumes (ambientação, inofensivas): fogem de quem chega de
 * frente (seeR m, dentro de seeAngle rad do bico); latido a menos de scareR m as faz sair num voo curto.
 */
export const CHICKENS = {
  r: 0.12, area: { minX: -11.85, maxX: -7.85, minZ: 2.55, maxZ: 6.45 },
  start: [{ x: -10.13, z: 4.2, yaw: 2.4 }, { x: -8.4, z: 4.4, yaw: -1.2 }],
  seeR: 1.4, seeAngle: 1.3, scareR: 3.2, walk: 0.3, run: 1.7, calm: 2.5, glideDist: 2.0, glideTime: 1.0, glideHeight: 0.45,
};
/** Os três porquinhos (cfg do createPigHerd; o resto vem de PIG_DEFAULTS): soltos, ficam na horta. */
export const PIGS = {
  count: 3,
  pen: STY_PEN.pen, door: STY_PEN.door, gate: STY_PEN.gate,
  area: { minX: HORTA.x0 + 0.25, maxX: HORTA.x1 - 0.25, minZ: HORTA.z0 + 0.3, maxZ: HORTA.z1 - 0.25 },
  homes: [{ x: 10.2, z: 4.7, yaw: 0.6 }, { x: 10.55, z: 5.7, yaw: -2.5 }, { x: 11.05, z: 5.0, yaw: 2.2 }],
};

// ---------------------------------------------------------------------------------------------- o cantinho escondido
/**
 * Atrás da casa na árvore, uma tábua do muro leste está solta (só cede depois de tudo achado na fase): do outro lado,
 * o cantinho com o quadro. Fica fora da vista da câmera.
 */
export const SECRET = { board: { z0: -5.15, z1: -4.55 }, nook: { x0: EAST_WALL.x + EAST_WALL.t / 2, x1: 13.35, z0: -5.15, z1: -4.55 }, photo: { x: 13.338, y: 0.95, z: -4.85, w: 0.42, h: 0.52 } };

// ---------------------------------------------------------------------------------------------- colisores
const T = WALLS.t;
const B = WORLD.bounds;
/** Parede ao longo de Z (x fixo). @returns {import('../../types').BoxCollider} */
const wallZ = (id, x, z0, z1, extra = {}) => ({ id, shape: 'box', x, z: (z0 + z1) / 2, hx: T / 2, hz: (z1 - z0) / 2, ...extra });
/** Parede ao longo de X (z fixo). @returns {import('../../types').BoxCollider} */
const wallX = (id, z, x0, x1, extra = {}) => ({ id, shape: 'box', x: (x0 + x1) / 2, z, hx: (x1 - x0) / 2, hz: T / 2, ...extra });
const thin = 0.06;

/** @type {import('../../types').Collider[]} */
export const STATIC_COLLIDERS = [
  // casa
  wallX('casa-frente', HOUSE.zS, HOUSE.x0, WALL_LK.x),
  wallZ('casa-leste-norte', HOUSE.x1, B.minZ, PORCH_DOOR.z0),
  wallZ('casa-leste-sul', HOUSE.x1, PORCH_DOOR.z1, HOUSE.zS),
  // despensa (a frente da cozinha vira a parede de dentro, com a porta)
  wallX('despensa-porta-oeste', HOUSE.zS, WALL_LK.x, PANTRY.door.x0),
  wallX('despensa-porta-leste', HOUSE.zS, PANTRY.door.x1, HOUSE.x1 + T / 2),
  wallZ('despensa-oeste', PANTRY.x0, HOUSE.zS, PANTRY.zS + T / 2),
  wallZ('despensa-leste', PANTRY.x1, HOUSE.zS, PANTRY.zS + T / 2),
  wallX('despensa-frente', PANTRY.zS, PANTRY.x0 - T / 2, PANTRY.x1 + T / 2),
  { id: 'armario-da-despensa', shape: 'box', x: CUPBOARD.x, z: CUPBOARD.z, hx: CUPBOARD.hx, hz: CUPBOARD.hz },
  { id: 'prateleiras-da-despensa', shape: 'box', x: PANTRY_SHELF.x, z: PANTRY_SHELF.z, hx: PANTRY_SHELF.hx, hz: PANTRY_SHELF.hz },
  wallZ('divisoria-norte', WALL_LK.x, B.minZ, WALL_LK.gap.z0),
  wallZ('divisoria-sul', WALL_LK.x, WALL_LK.gap.z1, HOUSE.zS),
  // sala (atrás do sofá, no vão até a parede da frente, só a Radhija passa)
  { id: 'sofa', shape: 'box', x: SOFA.x, z: SOFA.z, hx: SOFA.hx, hz: SOFA.hz },
  { id: 'mesa-de-centro', shape: 'box', x: COFFEE_TABLE.x, z: COFFEE_TABLE.z, hx: COFFEE_TABLE.hx, hz: COFFEE_TABLE.hz, jumpable: true, height: COFFEE_TABLE.h },
  { id: 'aparador', shape: 'box', x: SIDEBOARD.x, z: SIDEBOARD.z, hx: SIDEBOARD.hx, hz: SIDEBOARD.hz },
  { id: 'estante', shape: 'box', x: BOOKSHELF.x, z: BOOKSHELF.z, hx: BOOKSHELF.hx, hz: BOOKSHELF.hz },
  { id: 'poltrona', shape: 'box', x: ARMCHAIR.x, z: ARMCHAIR.z, hx: ARMCHAIR.hx, hz: ARMCHAIR.hz },
  ...DOG_BEDS.map((b, i) => /** @type {import('../../types').CircleCollider} */ ({ id: `caminha-${i + 1}`, shape: 'circle', x: b.x, z: b.z, r: b.r + 0.07 })),
  { id: 'abajur', shape: 'circle', x: FLOOR_LAMP.x, z: FLOOR_LAMP.z, r: FLOOR_LAMP.r },
  // cozinha
  { id: 'bancada', shape: 'box', x: (COUNTER.x0 + COUNTER.x1) / 2, z: COUNTER.z, hx: (COUNTER.x1 - COUNTER.x0) / 2, hz: COUNTER.hz },
  { id: 'geladeira', shape: 'box', x: FRIDGE.x, z: FRIDGE.z, hx: FRIDGE.hx, hz: FRIDGE.hz },
  { id: 'mesa-da-cozinha', shape: 'box', x: KITCHEN_TABLE.x, z: KITCHEN_TABLE.z, hx: KITCHEN_TABLE.hx, hz: KITCHEN_TABLE.hz, blocks: 'large' },
  ...KITCHEN_CHAIRS.map((c, i) => /** @type {import('../../types').CircleCollider} */ ({ id: `cadeira-${i + 1}`, shape: 'circle', x: c.x, z: c.z, r: c.r })),
  // varanda
  ...PERGOLA_POSTS.map((p, i) => /** @type {import('../../types').CircleCollider} */ ({ id: `poste-pergolado-${i + 1}`, shape: 'circle', x: p.x, z: p.z, r: 0.08 })),
  { id: 'mesa-do-bolo', shape: 'box', x: CAKE_TABLE.x, z: CAKE_TABLE.z, hx: CAKE_TABLE.hx, hz: CAKE_TABLE.hz },
  { id: 'presentes', shape: 'box', x: GIFTS.x, z: GIFTS.z, hx: GIFTS.hx, hz: GIFTS.hz },
  { id: 'banco-da-varanda', shape: 'box', x: PORCH_BENCH.x, z: PORCH_BENCH.z, hx: PORCH_BENCH.hx, hz: PORCH_BENCH.hz },
  ...PORCH_POTS.map((p, i) => /** @type {import('../../types').CircleCollider} */ ({ id: `vaso-da-varanda-${i + 1}`, shape: 'circle', x: p.x, z: p.z, r: 0.21 })),
  // quintal
  { id: 'piscininha', shape: 'circle', x: POOL.x, z: POOL.z, r: POOL.r + 0.02 },
  { id: 'cesta-do-piquenique', shape: 'circle', x: PICNIC.x - 0.45, z: PICNIC.z - 0.15, r: 0.2 },
  // campinho: fileiras de milho (corredores só para a Radhija) e as abóboras
  ...PLANTATION.corn.map((c, i) => /** @type {import('../../types').BoxCollider} */ ({ id: `milho-${i + 1}`, shape: 'box', x: c.x, z: (c.z0 + c.z1) / 2, hx: PLANTATION.cornHx, hz: (c.z1 - c.z0) / 2 })),
  ...PLANTATION.pumpkins.map((p, i) => /** @type {import('../../types').CircleCollider} */ ({ id: `abobora-${i + 1}`, shape: 'circle', x: p.x, z: p.z, r: 0.22 })),
  // a piñata: a roseira embaixo e a mangueira
  { id: 'roseira', shape: 'circle', x: ROSE_BUSH.x, z: ROSE_BUSH.z, r: ROSE_BUSH.r },
  { id: 'mangueira-grande', shape: 'circle', x: MANGO_TREE.x + 0.02, z: MANGO_TREE.z + 0.06, r: 0.33 },
  { id: 'ventilador', shape: 'circle', x: FAN.x, z: FAN.z, r: FAN.r },
  ...PLANTERS.map((p, i) => /** @type {import('../../types').CircleCollider} */ ({ id: `vaso-${i + 1}`, shape: 'circle', x: p.x, z: p.z, r: p.r })),
  { id: 'arvorezinha', shape: 'circle', x: LITTLE_TREE.x, z: LITTLE_TREE.z, r: LITTLE_TREE.r },
  { id: 'canteiro-de-flores', shape: 'box', x: FLOWER_BED.x, z: FLOWER_BED.z, hx: FLOWER_BED.hx, hz: FLOWER_BED.hz, jumpable: true, height: 0.22 },
  // cerca do fundo (o portãozinho é dinâmico)
  wallZ('cerca-fundo-norte', BACK_FENCE.x, B.minZ, BACK_FENCE.gate.z0, { hx: thin }),
  wallZ('cerca-fundo-sul', BACK_FENCE.x, BACK_FENCE.gate.z1, B.maxZ, { hx: thin }),
  // casa na árvore
  { id: 'tronco', shape: 'circle', x: TREE.x, z: TREE.z, r: TREE.r },
  ...DECK_POSTS.map((p, i) => /** @type {import('../../types').CircleCollider} */ ({ id: `poste-deque-${i + 1}`, shape: 'circle', x: p.x, z: p.z, r: 0.08 })),
  { id: 'funil', shape: 'box', x: TUBE.inlet.x, z: TUBE.inlet.z - 0.03, hx: 0.21, hz: 0.15 },
  // o muro leste e o cantinho do outro lado (a tábua solta é dinâmica)
  wallZ('muro-leste-norte', EAST_WALL.x, B.minZ, SECRET.board.z0, { hx: 0.07 }),
  wallZ('muro-leste-sul', EAST_WALL.x, SECRET.board.z1, B.maxZ, { hx: 0.07 }),
  { id: 'atras-do-muro-norte', shape: 'box', x: (SECRET.nook.x0 + B.maxX) / 2, z: (B.minZ + SECRET.nook.z0) / 2, hx: (B.maxX - SECRET.nook.x0) / 2, hz: (SECRET.nook.z0 - B.minZ) / 2 },
  { id: 'atras-do-muro-sul', shape: 'box', x: (SECRET.nook.x0 + B.maxX) / 2, z: (SECRET.nook.z1 + B.maxZ) / 2, hx: (B.maxX - SECRET.nook.x0) / 2, hz: (B.maxZ - SECRET.nook.z1) / 2 },
  { id: 'escorregador', shape: 'box', x: SLIDE.x, z: (SLIDE.z0 + SLIDE.z1 + SLIDE.tongue) / 2, hx: SLIDE.halfWidth + 0.03, hz: (SLIDE.z1 + SLIDE.tongue - SLIDE.z0) / 2 },
  // horta (cerca baixa: pula; o vão da tábua quebrada só deixa a Radhija)
  wallX('horta-norte', HORTA.z0, HORTA.x0, HORTA.x1, { hz: thin, jumpable: true, height: HORTA.fenceH }),
  wallZ('horta-oeste-norte', HORTA.x0, HORTA.z0, HORTA.gap.z0, { hx: thin, jumpable: true, height: HORTA.fenceH }),
  wallZ('horta-vao', HORTA.x0, HORTA.gap.z0, HORTA.gap.z1, { hx: thin, blocks: 'large' }),
  wallZ('horta-oeste-sul', HORTA.x0, HORTA.gap.z1, HORTA.z1, { hx: thin, jumpable: true, height: HORTA.fenceH }),
  wallZ('horta-leste-norte', HORTA.x1, HORTA.z0, SHED.z0, { hx: thin, jumpable: true, height: HORTA.fenceH }),
  wallZ('horta-leste-meio', HORTA.x1, SHED.z1, STY.z0, { hx: thin, jumpable: true, height: HORTA.fenceH }),
  ...VEG_BEDS.map((b, i) => /** @type {import('../../types').BoxCollider} */ ({ id: `canteiro-${i + 1}`, shape: 'box', x: b.x, z: b.z, hx: b.hx, hz: b.hz })),
  { id: 'tomateiro', shape: 'circle', x: TOMATO.x, z: TOMATO.z, r: TOMATO.r },
  { id: 'regador', shape: 'circle', x: WATERING_CAN.x, z: WATERING_CAN.z, r: WATERING_CAN.r },
  // galpão (a porta é dinâmica)
  wallX('galpao-norte', SHED.z0, SHED.x0, SHED.x1, { hz: SHED.t / 2 }),
  wallX('galpao-sul', SHED.z1, SHED.x0, SHED.x1, { hz: SHED.t / 2 }),
  wallZ('galpao-leste', SHED.x1, SHED.z0, SHED.z1, { hx: SHED.t / 2 }),
  wallZ('galpao-oeste-norte', SHED.x0, SHED.z0, SHED.door.z0, { hx: SHED.t / 2 }),
  wallZ('galpao-oeste-sul', SHED.x0, SHED.door.z1, SHED.z1, { hx: SHED.t / 2 }),
  { id: 'bancada-de-ferramentas', shape: 'box', x: WORKBENCH.x, z: WORKBENCH.z, hx: WORKBENCH.hx, hz: WORKBENCH.hz },
  { id: 'vassoura', shape: 'circle', x: SHED.x1 - 0.16, z: SHED.z0 + 0.95, r: 0.12 },
  { id: 'rampa', shape: 'box', x: (RAMP.x0 + 0.22 + RAMP.x1) / 2, z: RAMP.z, hx: (RAMP.x1 - RAMP.x0 - 0.22) / 2, hz: RAMP.halfWidth },
  { id: 'prateleira-da-vela', shape: 'box', x: (RAMP.x1 + SHED.x1) / 2, z: RAMP.z, hx: (SHED.x1 - RAMP.x1) / 2, hz: 0.24 },
  // chiqueiro (a porteira é dinâmica; a casinha dos porcos no canto)
  wallX('chiqueiro-norte', STY.z0, STY.x0, STY.x1, { hz: thin }),
  wallX('chiqueiro-sul', STY.z1, STY.x0, STY.x1, { hz: thin }),
  wallZ('chiqueiro-oeste-norte', STY.x0, STY.z0, STY.gate.z0, { hx: thin }),
  wallZ('chiqueiro-oeste-sul', STY.x0, STY.gate.z1, STY.z1, { hx: thin }),
  wallZ('chiqueiro-leste', STY.x1, STY.z0, STY.z1, { hx: thin }),
  { id: 'casinha-dos-porcos', shape: 'box', x: STY.x1 - 0.45, z: STY.z1 - 0.45, hx: 0.38, hz: 0.38 },
  { id: 'painel-dos-botoes', shape: 'box', x: (BUTTON_BOARD.x0 + BUTTON_BOARD.x1) / 2, z: BUTTON_BOARD.z - 0.035, hx: (BUTTON_BOARD.x1 - BUTTON_BOARD.x0) / 2, hz: BUTTON_BOARD.t / 2 + 0.035 },
];

export const NAV_NODES = {
  L_mid: { x: -10.0, z: -3.3 }, L_arch: { x: -8.3, z: -2.5 }, K_mid: { x: -6.6, z: -3.7 }, K_door: { x: -4.5, z: -4.22 },
  K_south: { x: -7.35, z: -1.0 }, D_mid: { x: -7.35, z: 0.9 },
  P_mid: { x: -2.4, z: -3.3 }, P_east: { x: -0.2, z: -3.4 }, Y_north: { x: -1.5, z: -1.6 }, Y_west: { x: -6.5, z: 3.0 },
  Y_mid: { x: 0.6, z: 0.4 }, Y_south: { x: -1.2, z: 3.1 }, Y_east: { x: 3.4, z: 2.6 }, Y_gate: { x: 4.7, z: 0.2 },
  Y_farm: { x: -8.0, z: 4.6 }, Y_pinata: { x: 0.3, z: 5.3 },
  B_gate: { x: 6.1, z: 0.2 }, B_tree: { x: 8.4, z: -1.6 }, B_north: { x: 6.1, z: -2.25 }, B_east: { x: 10.8, z: -0.4 },
  B_land: { x: 11.2, z: -3.2 },
  B_gap: { x: 6.35, z: 1.55 }, H_mud: { x: 7.4, z: 1.6 }, H_mid: { x: 8.4, z: 2.4 }, H_south: { x: 8.6, z: 4.6 }, S_in: { x: 10.6, z: 2.15 },
};
/** @type {import('../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['L_mid', 'L_arch'], ['L_arch', 'K_mid'], ['K_mid', 'K_door'], ['K_door', 'P_mid'], ['P_mid', 'P_east'],
  ['L_arch', 'K_south'], ['K_south', 'D_mid'],
  ['P_mid', 'Y_north'], ['Y_north', 'Y_mid'], ['Y_west', 'Y_south'], ['Y_west', 'Y_farm'],
  ['Y_mid', 'Y_south'], ['Y_mid', 'Y_east'], ['Y_mid', 'Y_gate'], ['Y_east', 'Y_gate'], ['Y_south', 'Y_pinata'],
  ['Y_gate', 'B_gate', { requires: 'gateOpen' }],
  ['B_gate', 'B_north'], ['B_gate', 'B_tree'], ['B_north', 'B_tree'], ['B_tree', 'B_east'], ['B_gate', 'B_east'],
  ['B_east', 'B_land'],
  // a horta: a Radhija pelo vão da tábua quebrada; a Rhaenyra só pulando a cerca (a companheira não pula: espera fora)
  ['B_gate', 'B_gap'], ['B_gap', 'H_mud', { requires: 'small' }], ['H_mud', 'H_mid'], ['H_mid', 'H_south'], ['B_gate', 'H_mid', { requires: 'jump' }],
  ['H_mid', 'S_in', { requires: 'shedOpen' }],
];

/** @type {import('../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'sofa', x: SOFA.x - 0.3, z: (SOFA.z + SOFA.hz + HOUSE.zS - WALLS.t / 2) / 2 }, // atrás do sofá (só a Radhija)
  { id: 'vasos', x: (PLANTERS[0].x + PLANTERS[1].x) / 2, z: -5.78 }, // atrás dos vasos grandes (só a Radhija)
  { id: 'horta', x: 9.2, z: 6.3 }, // no canto sul da horta, atrás do canteiro (pelo vão ou pulando a cerca)
  { id: 'deque', x: 7.05, z: -5.3, y: DECK.h }, // lá em cima, entre a luneta e o tronco (só pelo balde)
  { id: 'milharal', x: (PLANTATION.corn[0].x + PLANTATION.corn[1].x) / 2, z: 4.95 }, // num corredor do milho (só a Radhija)
];
export const COLLECTIBLE_PICKUP_R = 0.42;

/** @type {import('../../types').Goal} */
export const GOAL = {
  x: CAKE_TABLE.x, z: CAKE_TABLE.z, r: 1.15,
  celebrate: { radhija: { x: -2.75, z: -3.35 }, rhaenyra: { x: -1.95, z: -3.25 } },
  entryPoints: [{ x: -2.4, z: -3.2 }, { x: -1.0, z: -3.6 }],
};

/** Fim de tarde virando noite: o sol baixo e alaranjado vem do oeste, bem de lado. */
export const SUN = { direction: [-0.62, 0.42, 0.34], color: '#ffb27a', intensity: 1.15 };

/** @type {import('../../types').CameraConfig} */
export const CAMERA = {
  fov: 38,
  offset: [1.3, 4.4, 4.8],
  lookHeight: 0.3,
  limits: { minX: -10.6, maxX: 10.6, minZ: -4.4, maxZ: 5.0 },
  zones: [
    // a Radhija andando no deque (a fase liga só enquanto ela está lá em cima): o olhar sobe até o deque
    { id: 'deque', minX: DECK.x0 - 0.4, maxX: DECK.x1 + 0.4, minZ: -6.0, maxZ: DECK.z1 + 0.5, lookY: 1.75, dz: -0.3 },
    // o balde subindo (a fase liga só durante a subida): a câmera recua e olha alto, quem puxa a corda e quem sobe
    // ficam no quadro
    { id: 'balde', minX: 5.6, maxX: 12.4, minZ: -6.0, maxZ: 2.4, lookY: 1.0, dz: -1.2 },
    // perto da árvore o olhar sobe para a casa na árvore
    { id: 'casa-na-arvore', minX: 6.0, maxX: 11.5, minZ: -6.0, maxZ: -1.6, lookY: 1.2, dz: -0.8 },
  ],
  title: { center: { x: -1.6, z: -2.2 }, radius: 6.2, angle: 0.5, height: 2.6, look: { x: -2.4, y: 0.95, z: -4.4 } },
  celebrate: { pos: [GOAL.x + 1.05, 1.45, GOAL.z + 2.3], look: [GOAL.x, 0.75, GOAL.z] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

/** @type {import('../../types').LevelLayout} */
const LAYOUT = {
  WORLD, EAST_WALL, DOGS, WALLS, HOUSE, WALL_LK, PORCH_DOOR, SOFA, COFFEE_TABLE, SIDEBOARD, PAINTING, BOOKSHELF, ARMCHAIR,
  FLOOR_LAMP, RUG, DOG_BEDS, COUNTER, FRIDGE, KITCHEN_TABLE, KITCHEN_CHAIRS, DOG_BOWLS, BREAKER, PANTRY, CUPBOARD, PANTRY_CRATES, PANTRY_SHELF,
  PORCH, PERGOLA_POSTS, CAKE_TABLE, CAKE, CAKE_ORDER, CAKE_REJECT, GIFTS, PORCH_BENCH, PORCH_POTS, POOL, BOAT, TAP, HOSE,
  CRATE, FAN, OUTLET, PLANTERS, LITTLE_TREE, FLOWER_BED, PICNIC, PLANTATION, ROSE_BUSH, MANGO_TREE, MANGO_SHOVE, PINATA,
  BACK_FENCE, GATE, CORD, GOOSE, TREE, DECK, DECK_POSTS, DECK_RAIL, HUT, DECK_PROPS, RIBBON, PIGEON, TUBE, BUCKET, ROPE,
  DECK_PATH, SLIDE, HORTA, MUD,
  VEG_BEDS, TOMATO, WATERING_CAN, SHED, BUTTON_BOARD, SHED_BUTTONS, WORKBENCH, RAMP, RAMP_ENTRY, RAMP_TIMES, CANDLE, STY, STY_PEN, PIGS, CHICKENS, SECRET,
  STATIC_COLLIDERS, NAV_NODES, NAV_EDGES,
  COLLECTIBLES, COLLECTIBLE_PICKUP_R, GOAL, SUN, CAMERA,
};
export default LAYOUT;
