// =====================================================================
//  MODO HISTÓRIA · Capítulo 1 · Cadê a Cenoura? — LAYOUT do Recanto das Patinhas (fonte única de coordenadas).
//  O condomínio ao amanhecer, com orvalho, neblina baixa e galhos e telhas da tempestade da véspera pelo chão.
//  Roteiro em docs/HISTORIA.md (cap. 1); estrutura em docs/MODO-HISTORIA.md. Metros, Y para cima, Norte = -Z (o fundo,
//  onde ficam o muro, a rua e a cidade).
//
//  ESCALA (3ª pessoa, 2026-11-09): o desenho nasceu para a câmera de cima, num terreno de 28 × 18 m. Com a câmera atrás
//  da dog, os cômodos de 3,7 m empurravam a câmera para cima o tempo todo. As POSIÇÕES foram ampliadas 1,7× (u()), e os
//  objetos (portas, móveis, carro, dogs) continuam do tamanho real: os cômodos da casa têm ~6 m e o condomínio, 48 × 30 m.
//
//  De oeste para leste e de sul para norte:
//   CASA das irmãs (sudoeste): o QUARTO (a caminha embaixo do basculante, o pote d'água), a COZINHA e, na ala sul, o
//     CORREDOR, o BANHEIRO, a COPA (a despensa de passagem), a SALA DE JANTAR e a SALA DE ESTAR com a porta dos fundos.
//     Entre o quarto e a cozinha, a GRADE de proteção: só a Radhija passa pela portinha de gato; do lado da cozinha, o
//     PEDAL solta a grade. Na porta da cozinha para o corredor, o SACO DE RAÇÃO está na frente da maçaneta (a Rhaenyra
//     empurra e alcança a alavanca com o impulso). No corredor, o ASPIRADOR ROBÔ (a Radhija tem medo: o latido da
//     Rhaenyra, ou ela no caminho com o Fica, manda o aspirador de volta para a base). A copa está no escuro (o
//     INTERRUPTOR é alto: o impulso da Rhaenyra). Na sala de jantar, a TOALHA (a Radhija puxa com a boca) e a LATA de
//     biscoito. Na sala, o PUFE (a Rhaenyra empurra até o sofá), a Radhija sobe pelo pufe, pelo sofá e pelo parapeito
//     da janela até o TRINCO alto da porta dos fundos; a Rhaenyra empurra a porta, e o quintal começa ali.
//   QUINTAL, a leste da casa: a PORTA DA ÁREA DE SERVIÇO, no muro norte, tem o ferrolho do outro lado e está travada
//     (a argola fica do lado de fora). Um GALHO da tempestade caiu na frente da PASSAGEM baixa do muro (a Rhaenyra
//     empurra para o oeste; embaixo, as telhas): a Radhija passa por ela e puxa a argola do ferrolho pelo outro lado.
//   PISCINA, no meio: a marca molhada da boia de patinho, a oeste, é onde o Faro mostra a Reconstrução.
//   ÁREA DE SERVIÇO, encostada no muro norte: tanques (o ralo sem a rolha) e o VARAL, onde a cenoura ficou presa num
//     pregador. A Rhaenyra empurra o CESTO de roupa para baixo dela e a arrancada da Radhija no poste do leste solta.
//   TORRE do condomínio: o INTERFONE de três botões destrava a porta (o Faro mostra o Farelo apertando a senha); a
//     PORTA DE MOLA (a Rhaenyra segura com o Fica) leva à escada; o terraço é cena.
//   GUARITA e PORTÃOZINHO, no canto nordeste: o porteiro cochila lá dentro, de janela fechada. O Superbafo da Radhija
//     entra pela GRELHA de ventilação, a mão dele abre a janela, e aí o latido grosso da Rhaenyra o acorda. A meia na
//     antena; a lixeira de rodinhas perto.
//   LAGO, a leste: a ilha com o petisco, o píer da Dona Gansa e o barquinho de pedal na margem sul.
//   GARAGEM, ao sul: a caminhonete (só a Radhija passa por baixo), o balde na prateleira e o depósito travado pela bola.
//   Do lado de fora do muro norte, a RUA e a cidade (o portal e, longe, a torre da Prefeitura parada).
// =====================================================================
import { withStart } from '../../../dogs/config.js';

/** Quanto as posições do desenho original foram ampliadas para a 3ª pessoa. */
export const SCALE = 1.7;
/** Posição do desenho original (m) → posição no mundo de agora (arredondada ao centímetro). */
const u = (v) => Math.round(v * SCALE * 100) / 100;
/** Um ponto do desenho original ampliado. */
const P = (x, z, extra = {}) => ({ x: u(x), z: u(z), ...extra });

// ---------------------------------------------------------------- terreno
/** O muro do condomínio: as linhas de centro e a espessura; a altura (o do norte é mais baixo: a cidade aparece). */
export const WALL = { minX: u(-14.2), maxX: u(14.2), minZ: u(-9.0), maxZ: u(8.8), t: 0.24, h: 1.85, hNorth: 1.5 };
/**
 * O TERRAÇO DA TORRE jogável (pedido do usuário em 2026-11-11: "quando se abre a porta não tem nada pra fazer"). O núcleo
 * só anda no chão (y = 0) e a colisão é 2D: o terraço é um cenário à parte, NO CHÃO, longe do condomínio (a leste, depois
 * dos vizinhos). Em volta dele, a "queda": a fachada do prédio desce até `fall` e, lá embaixo, a rua, as copas e os
 * telhados baixos; ao norte, a cidade com o relógio. De `cut` em diante (x) o chão de fora do condomínio (world/base.js)
 * dá lugar ao do cenário do telhado (world/telhado.js). Entrar no saguão da torre leva as duas para lá num corte no preto;
 * no fim, outro corte as devolve para a porta da torre (rooftop.js, scenesTelhado.js). `t`: a espessura da mureta.
 */
export const ROOFTOP = { x0: 63.5, x1: 76.5, z0: -12.0, z1: -1.0, t: 0.2, parapet: 0.55, fall: -9.0, cut: 50 };
/** Os limites do condomínio: 20 cm para dentro do muro (o cenário de dentro usa estes). */
export const CONDO_BOUNDS = { minX: WALL.minX + 0.2, maxX: WALL.maxX - 0.2, minZ: WALL.minZ + 0.2, maxZ: WALL.maxZ - 0.2 };
/**
 * Limites onde as dogs andam: o condomínio e, a leste, o terraço da torre (o muro e os colisores 'telhado-vazio-*' fecham
 * o que fica entre os dois; a rua do lado de fora é só cenário: as cenas levam as dogs até lá).
 */
/**
 * O LOTE DA CASA (4ª rodada, pedido do usuário em 2026-11-11: "uma casa maior, com mais detalhes" e "aumente o quintal
 * após sair de casa"): o lote cresce 11 m para o sul, além da linha do muro sul do condomínio, e o resto do condomínio
 * não muda. A casa ganha uma ala sul (até HOUSE.z1) e o quintal cresce junto: a leste da casa (até LOT.z1) e numa faixa
 * ao sul dela. O muro sul do condomínio continua só de LOT.x1 para o leste; o lote tem muro próprio a oeste, ao sul e a
 * leste (em x = LOT.x1, de WALL.maxZ até LOT.z1).
 */
export const LOT = { x0: WALL.minX, x1: u(-2.9), z0: u(1.2), z1: WALL.maxZ + 11 };
export const WORLD = { bounds: { ...CONDO_BOUNDS, maxX: ROOFTOP.x1 + 0.2, maxZ: LOT.z1 - 0.2 } };
/** O portãozinho de pedestres no muro norte (fechado até o porteiro abrir), ao lado da guarita. */
export const GATE = { x0: 21.25, x1: 22.45, z: WALL.minZ, h: 1.45 };
/** A folha do portãozinho: abre para dentro (para o sul), como as outras dobradiças (folha ao longo de −Z local). */
export const GATE_LEAF = {
  hinge: { x: GATE.x0, z: GATE.z }, latchPost: { x: GATE.x1, z: GATE.z }, length: GATE.x1 - GATE.x0,
  closedYaw: -Math.PI / 2, openYaw: -Math.PI / 2 - Math.PI * 0.55, openTime: 1.4, closeTime: 1.2,
};
/** A rua do lado de fora do muro norte (cenário e cena de fechamento). */
export const STREET = { z0: WALL.minZ - 0.12, sidewalk: WALL.minZ - 1.6, z1: WALL.minZ - 5.6, curb: 0.14 };

// ---------------------------------------------------------------- casa (sudoeste)
/** Paredes: espessura e altura (a casa é inteira: paredes até o forro, telhado por cima). */
export const WALLS = { t: 0.16, h: 2.7, low: 0.62 };
/** A casa inteira (centro das paredes de fora). O oeste é o próprio muro do condomínio. */
export const HOUSE = { x0: WALL.minX, x1: u(-6.8), z0: u(1.2), z1: LOT.z1 - 5.5, floorY: 0.04 };
/**
 * As divisas da ala sul (4ª rodada, pedido do usuário em 2026-11-11: "uma casa maior, com mais detalhes"), nas linhas de
 * centro das paredes de dentro: ZK é o sul do quarto e da cozinha; XC, o oeste do corredor; XB, o oeste do banheiro e da
 * despensa (o leste da sala de jantar); ZB, entre o banheiro e a despensa; ZE, o norte da sala de estar.
 */
const ZK = u(4.8), XC = -14.0, XB = -16.7, ZB = 11.9, ZE = 14.6;
/**
 * Os cômodos grandes (faces de dentro aproximadas pelas linhas de centro): o quarto e a cozinha (como eram) e, na ala sul,
 * a sala de jantar e a sala de estar (com a porta dos fundos).
 */
export const ROOMS = {
  quarto: { x0: HOUSE.x0, x1: u(-10.4), z0: HOUSE.z0, z1: ZK },
  cozinha: { x0: u(-10.4), x1: HOUSE.x1, z0: HOUSE.z0, z1: ZK },
  jantar: { x0: HOUSE.x0, x1: XB, z0: ZK, z1: ZE },
  estar: { x0: HOUSE.x0, x1: HOUSE.x1, z0: ZE, z1: HOUSE.z1 },
};
/**
 * Os cômodos pequenos da ala sul: o corredor (da cozinha até o fim, com o aspirador robô), o banheiro e a despensa (a copa
 * de passagem entre o corredor e a sala de jantar). No corredor e na despensa a câmera fica por cima do ombro.
 */
export const SMALL_ROOMS = {
  corredor: { x0: XC, x1: HOUSE.x1, z0: ZK, z1: ZE },
  banheiro: { x0: XB, x1: XC, z0: ZK, z1: ZB },
  despensa: { x0: XB, x1: XC, z0: ZB, z1: ZE },
};
/**
 * As passagens: a do quarto para a cozinha (na parede x = ROOMS.quarto.x1, com a grade de proteção); no oeste do
 * corredor, a do banheiro e a da despensa (o interruptor fica ao norte dela); a da despensa para a sala de jantar e o arco
 * largo entre a sala de jantar e a de estar.
 */
export const DOORWAYS = {
  quartoCozinha: { x: ROOMS.quarto.x1, z0: 4.0, z1: 6.0 },
  banheiro: { x: XC, z0: 9.45, z1: 10.3 },
  despensa: { x: XC, z0: 12.95, z1: 13.85 },
  despensaJantar: { x: XB, z0: 12.95, z1: 13.85 },
  arco: { z: ZE, x0: -22.9, x1: -19.1 },
};
/**
 * A grade de proteção na passagem do quarto (como as de casa com cachorro): a folha gira para dentro da cozinha
 * (dobradiça ao sul) e a parte fixa, ao norte, tem a portinha de gato, por onde só a Radhija passa.
 */
export const PET_GATE = {
  hinge: { x: DOORWAYS.quartoCozinha.x, z: DOORWAYS.quartoCozinha.z1 }, latchPost: { x: DOORWAYS.quartoCozinha.x, z: 4.8 }, length: 1.2,
  closedYaw: 0, openYaw: -Math.PI * 0.52, openTime: 0.9, closeTime: 0.9, h: 0.86,
};
/** A parte fixa da grade com a portinha de gato (só barra a Rhaenyra). */
export const PET_FLAP = { x: DOORWAYS.quartoCozinha.x, z0: DOORWAYS.quartoCozinha.z0, z1: PET_GATE.latchPost.z, h: PET_GATE.h };
/** O pedal que solta a grade, no chão da cozinha, ao sul da dobradiça (fora do arco da folha). */
export const PET_PEDAL = { x: DOORWAYS.quartoCozinha.x + 0.6, z: DOORWAYS.quartoCozinha.z1 + 0.5, r: 0.24 };
/** O basculante do quarto, na parede norte: largura, peitoril e alto (a Rhaenyra de pé alcança o vão). */
export const WINDOW = { x0: u(-12.2) - 0.65, x1: u(-12.2) + 0.65, z: HOUSE.z0, sill: 0.55, top: 1.42, openAngle: 0.42 };
/** O parapeito de fora (onde os pombos pousam) e o de dentro (a baba, a pista escondida). */
export const SILL = {
  out: { x: (WINDOW.x0 + WINDOW.x1) / 2, z: HOUSE.z0 - 0.17, y: WINDOW.sill, w: WINDOW.x1 - WINDOW.x0 + 0.22, d: 0.2 },
  in: { x: (WINDOW.x0 + WINDOW.x1) / 2, z: HOUSE.z0 + 0.14, y: WINDOW.sill, w: WINDOW.x1 - WINDOW.x0 + 0.1, d: 0.14 },
};
/** A caminha redonda das duas, embaixo do basculante, e o pote d'água ao lado. */
export const BED = { x: u(-12.2), z: HOUSE.z0 + 1.12, r: 0.8, rim: 0.12, h: 0.22 };
export const BOWL = { x: BED.x + 1.15, z: BED.z - 0.12, r: 0.16 };
/** Móveis da casa (colisores e cenário). */
export const WARDROBE = { x: HOUSE.x0 + 0.48, z: 6.4, hx: 0.36, hz: 0.6, h: 1.9 };
export const TOY_BASKET = { x: HOUSE.x0 + 0.6, z: HOUSE.z0 + 0.55, r: 0.26 };
/** O tapete do quarto (cenário, sem colisão) e a cômoda baixa encostada na parede do sul. */
export const RUG = { x: -20.4, z: 5.6, hx: 1.5, hz: 1.05 };
export const DRESSER = { x: -21.6, z: ROOMS.quarto.z1 - 0.34, hx: 0.7, hz: 0.24, h: 0.82 };
export const COUNTER = { x0: ROOMS.cozinha.x0 + 0.15, x1: HOUSE.x1 - 0.2, z0: HOUSE.z0 + WALLS.t / 2, z1: HOUSE.z0 + 0.66, h: 0.92 };
export const FRIDGE = { x: ROOMS.cozinha.x0 + 0.46, z: ROOMS.cozinha.z1 - 0.5, hx: 0.36, hz: 0.38, h: 1.75 };
/** A mesa da cozinha, embaixo da janela que era a porta do quintal (a Radhija passa por baixo). */
export const KITCHEN_TABLE = { x: -12.95, z: 4.95, hx: 0.6, hz: 0.42, h: 0.74 };
/** A antiga porta da cozinha para o quintal virou janela (a saída da casa agora é a porta dos fundos, HOUSE_EXIT). */
export const KITCHEN_WINDOW = { x: HOUSE.x1, z0: 4.34, z1: 5.34, sill: 1.0, top: 1.92 };
/**
 * A porta da cozinha para o corredor, na parede do sul da cozinha: a dobradiça a leste, abre para o corredor (o sul).
 * A maçaneta de alavanca fica do lado da cozinha (o impulso na parede da Rhaenyra).
 */
export const KITCHEN_DOOR = {
  hinge: { x: -12.28, z: ZK }, latchPost: { x: -13.28, z: ZK }, length: 1.0,
  closedYaw: Math.PI / 2, openYaw: Math.PI, openTime: 0.9, closeTime: 1.0, h: 2.05,
};
/** A maçaneta de alavanca, do lado da cozinha (impulso na parede da Rhaenyra, de frente para o sul). */
export const KITCHEN_HANDLE = { x: KITCHEN_DOOR.latchPost.x + 0.16, z: ZK - 0.06, nx: 0, nz: -1, top: 1.02, kind: 'lever', mode: 'once', lat: 0 };
/**
 * O saco de ração encostado na porta, do lado da cozinha (caixa empurrável): fica bem onde a Rhaenyra apoiaria as patas
 * para alcançar a maçaneta. Ela empurra para o leste, ao longo da parede; de `freeX` em diante, a alavanca fica livre.
 */
export const FOOD_SACK = {
  start: { x: KITCHEN_HANDLE.x, z: ZK - 0.5 }, half: 0.34, height: 0.62,
  minX: KITCHEN_HANDLE.x, maxX: HOUSE.x1 - WALLS.t / 2 - 0.36, minZ: ZK - 0.5, maxZ: ZK - 0.5, pushSpeed: 0.75, freeX: HOUSE.x1 - WALLS.t / 2 - 0.42,
};

// ---------------------------------------------------------------- quintal (a leste da casa)
export const YARD = { x0: HOUSE.x1, x1: LOT.x1, z0: HOUSE.z0, z1: LOT.z1, wallH: 1.2 };
/**
 * A porta dos fundos (4ª rodada): a saída da casa para o quintal, na parede leste da ala sul (x = HOUSE.x1). O puzzle que
 * a abre é da casa; o quintal começa aqui e as duas atravessam o quintal até a porta da área de serviço, ao norte.
 */
export const HOUSE_EXIT = { x: HOUSE.x1, z0: 18.3, z1: 19.3 };
/** A porta da área de serviço, no muro norte do quintal: abre para dentro do quintal (para o sul). */
export const SERVICE_DOOR = {
  hinge: { x: -8.7, z: YARD.z0 }, latchPost: { x: -7.7, z: YARD.z0 }, length: 1.0,
  closedYaw: -Math.PI / 2, openYaw: -Math.PI / 2 - Math.PI * 0.55, openTime: 1.0, closeTime: 1.0, h: 1.9,
};
/**
 * A passagem baixa no muro norte do quintal (um arco de escoar água, rente ao chão): só a Radhija cabe. Fica a oeste
 * da porta, fora do arco da folha.
 */
export const YARD_GAP = { x0: -10.4, x1: -9.5, z: YARD.z0, h: 0.42 };
/**
 * O galho da tempestade caído na frente da passagem do muro, do lado do quintal (caixa empurrável de meia medida
 * `half`; a tora e as folhas cabem todas nela, então ninguém atravessa nada): a Rhaenyra empurra para o oeste, até
 * perto da parede da casa; de `freeX` em diante, a passagem fica livre. Embaixo dele, as telhas quebradas (pista do
 * caso 2). O galho nunca entra no arco da porta.
 */
export const BRANCH = {
  start: { x: (YARD_GAP.x0 + YARD_GAP.x1) / 2, z: YARD.z0 + 0.66 }, half: 0.46, height: 0.55,
  minX: HOUSE.x1 + WALLS.t / 2 + 0.16 + 0.46, maxX: (YARD_GAP.x0 + YARD_GAP.x1) / 2, minZ: YARD.z0 + 0.66, maxZ: YARD.z0 + 0.66,
  pushSpeed: 0.75, freeX: -10.7,
};
export const TILES = { x: BRANCH.start.x + 0.05, z: YARD.z0 + 0.75 };
/**
 * O ferrolho da porta da área de serviço fica do lado de fora (o norte), com uma argola numa cordinha: a Radhija morde
 * e puxa para o norte; depois de `pull` m, o ferrolho corre e a porta abre. A argola pende ao lado do batente leste,
 * fora do vão (ninguém passa por dentro dela ao atravessar a porta).
 */
export const SERVICE_BOLT = {
  ring: { x: SERVICE_DOOR.latchPost.x + 0.3, z: YARD.z0 - 0.3, y: 0.34 }, anchor: { x: SERVICE_DOOR.latchPost.x + 0.3, z: YARD.z0 - 0.06, y: 0.5 },
  pull: 0.45, grabR: 0.6,
};
/** A casinha de cachorro do quintal (a porta para o oeste é estreita: só a Radhija entra). */
export const DOGHOUSE = { x: u(-3.85), z: u(6.7), hx: 0.55, hz: 0.6, h: 1.0, door: 0.5 };
export const YARD_BEDS = [{ x: u(-6.1), z: u(7.6), hx: 0.45, hz: 1.5 }, { x: u(-3.5) + 0.35, z: u(4.4), hx: 0.38, hz: 1.3 }];

// ---------------------------------------------------------------- piscina (meio)
export const POOL = { x0: u(-5.0), x1: u(1.0), z0: u(-4.8), z1: u(-1.8), deck: { x0: u(-6.3), x1: u(2.3), z0: u(-6.1), z1: u(-0.55) }, depth: 0.9 };
/** A marca molhada onde a boia de patinho ficava (o Faro mostra a Reconstrução a partir daqui). */
export const RECON = { x: u(-5.6), z: u(-3.3), r: 6.5 };
/** Espreguiçadeiras e o guarda-sol (cenário com colisão; por baixo da do leste só a Radhija passa). */
export const LOUNGERS = [{ x: u(1.75), z: u(-1.5), yaw: 0, hx: 0.34, hz: 0.95 }, { x: u(1.75), z: u(-4.95), yaw: Math.PI, hx: 0.34, hz: 0.95 }];
export const UMBRELLA = { x: u(2.0), z: u(-3.05), r: 0.12 };
/** O filtro da piscina, a ducha e os vasos do deque (cenário com colisão; src/story/areas/recanto/world/comum.js). */
export const POOL_FILTER = { x: u(-4.5), z: u(-5.62), hx: 0.32, hz: 0.24 };
export const POOL_SHOWER = { x: u(0.55), z: u(-5.6), r: 0.08 };
export const POOL_POTS = [{ x: u(-6.1), z: u(-0.75), r: 0.22 }, { x: u(2.15), z: u(-3.65), r: 0.18 }];

// ---------------------------------------------------------------- área de serviço (norte)
export const SERVICE = { x0: u(-6.3), x1: u(2.9), z0: WALL.minZ, z1: u(-6.4) };
/** Os tanques embaixo do telhadinho; o ralo do da esquerda está sem a rolha (pista escondida do caso 1). */
export const TANKS = { x0: u(-6.05), x1: u(-6.05) + 2.0, z0: WALL.minZ + WALL.t / 2, z1: WALL.minZ + WALL.t / 2 + 0.58, h: 0.86 };
export const DRAIN = { x: TANKS.x0 + 0.5, z: TANKS.z0 + 0.26, y: TANKS.h - 0.2 };
/** O varal entre dois postes; a cenoura presa num pregador, a 2 m do poste do leste. */
export const LINE = { a: { x: -4.4, z: u(-7.55) }, b: { x: u(2.25), z: u(-7.55) }, h: 1.32, postR: 0.07 };
export const CARROT_PIN = { x: LINE.b.x - 2.0, z: LINE.a.z, y: LINE.h - 0.02 };
/** O poste do leste do varal (DASH_POST: o nome antigo, de quando a arrancada da Radhija sacudia o varal). */
export const DASH_POST = { x: LINE.b.x, z: LINE.b.z, r: 0.62 };
/**
 * O empurra-empurra da Rhaenyra no poste do leste (empurrão em pé, segurando Shift / R1: src/game/mechanics/
 * shoveTarget.js): ela apoia as patas da frente do lado sul. A cada empurrão o varal balança; com o cesto embaixo da
 * cenoura, no terceiro o pregador solta (pedido do usuário em 2026-11-11, no lugar da arrancada da Radhija).
 */
export const POLE_SHOVE = { x: LINE.b.x, z: LINE.b.z + LINE.postR + 0.03, nx: 0, nz: 1, y: 0.55, w: 0, over: 0, kind: 'tree', pushes: 3 };
/**
 * O cesto de roupa (caixa empurrável, só ao longo do varal): a Rhaenyra empurra para o leste até parar embaixo da
 * cenoura (`under`: até quanto do pregador conta). Sem o cesto embaixo, sacudir o varal não adianta.
 */
export const LAUNDRY = { start: { x: -2.4, z: LINE.a.z }, half: 0.3, height: 0.46, minX: -3.6, maxX: CARROT_PIN.x + 0.12, minZ: LINE.a.z, maxZ: LINE.a.z, pushSpeed: 0.8, under: 0.42 };

// ---------------------------------------------------------------- torre do condomínio (nordeste da área de serviço)
export const TOWER = { x0: u(3.6), x1: u(8.2), z0: WALL.minZ, z1: u(-4.8), h: 2.6, parapet: 0.55, tank: { x0: u(5.9), x1: u(8.2), z0: WALL.minZ, z1: u(-7.0), h: 4.5 } };
/** A porta de mola, na parede oeste da torre: abre para dentro (o leste); a mola fecha quando ninguém está no vão. */
export const TOWER_DOOR = {
  hinge: { x: TOWER.x0, z: -10.99 }, latchPost: { x: TOWER.x0, z: -9.99 }, length: 1.0,
  closedYaw: Math.PI, openYaw: Math.PI + Math.PI * 0.5, openTime: 0.8, closeTime: 0.65, h: 2.0,
};
/**
 * O interfone da torre, na parede oeste, ao sul da porta: quatro botões no alto (o impulso da Rhaenyra), cada um com
 * um desenho. A senha são três deles, na ordem de `code`: o Faro mostra a Reconstrução do Farelo apertando os dois
 * primeiros (`recon`), e o espirro do Soneca esconde o terceiro (a árvore de pistas: o depoimento da Dona Gansa).
 */
export const INTERCOM = {
  buttons: [
    { id: 'osso', x: TOWER.x0 - WALLS.t / 2, z: -9.68, nx: -1, nz: 0, top: 1.02, kind: 'button', mode: 'once' },
    { id: 'nota', x: TOWER.x0 - WALLS.t / 2, z: -9.228, nx: -1, nz: 0, top: 1.02, kind: 'button', mode: 'once' },
    { id: 'peixe', x: TOWER.x0 - WALLS.t / 2, z: -8.776, nx: -1, nz: 0, top: 1.02, kind: 'button', mode: 'once' },
    { id: 'sino', x: TOWER.x0 - WALLS.t / 2, z: -8.324, nx: -1, nz: 0, top: 1.02, kind: 'button', mode: 'once' },
  ],
  code: ['sino', 'osso', 'nota'],
  recon: { x: TOWER.x0 - 1.1, z: -9.0, r: 5.5 },
};
/** O saguão logo depois da porta: a Radhija entrando aqui começa a cena da escada e do terraço. */
export const TOWER_LOBBY = { x0: TOWER.x0 + 0.1, x1: TOWER.x0 + 2.5, z0: u(-7.4), z1: u(-5.0) };
/** Móveis a mais do quarto e da cozinha (cenário com colisão; world/casa.js). */
export const HOUSE_EXTRAS = {
  chairs: [
    { x: KITCHEN_TABLE.x - 0.3, z: KITCHEN_TABLE.z - KITCHEN_TABLE.hz - 0.23, half: 0.2, face: 1 },
    { x: KITCHEN_TABLE.x + 0.3, z: KITCHEN_TABLE.z + KITCHEN_TABLE.hz + 0.23, half: 0.2, face: -1 },
  ],
  bin: { x: -17.36, z: 3.0, r: 0.17 },
  bedroomShelf: { x: -17.93, z: 3.1, hx: 0.17, hz: 0.6, h: 1.05 },
  bedroomPlant: { x: -23.74, z: 7.76, r: 0.24 },
};

// ---------------------------------------------------------------- a ala sul da casa (world/casaSul.js, casaPuzzles.js)
const wt2 = WALLS.t / 2;
/**
 * O ASPIRADOR ROBÔ do corredor. Começa dormindo na base (no canto sudeste do corredor); a porta da cozinha abrindo o
 * acorda e ele anda em zigue-zague pelo corredor (`lane`), de ponta a ponta. A Radhija tem medo: enquanto ele anda, ela
 * não entra no corredor (`fear`: a faixa da entrada que barra só a pequena). O latido da Rhaenyra (até `barkR` m) ou ela
 * no caminho dele com o Fica o mandam de volta para a base (sem o Fica, ele desvia e, depois de `bumps` trombadas,
 * desiste), e lá ele fica. `gap`: o quanto ele para antes de encostar numa dog (ele nunca atravessa ninguém).
 */
export const VACUUM = {
  r: 0.17, h: 0.09, speed: 0.36, turnTime: 0.7, barkR: 3.2, gap: 0.04, bumps: 3,
  dock: { x: HOUSE.x1 - wt2 - 0.26, z: ZE - wt2 - 0.36, yaw: -Math.PI / 2 },
  base: { x: HOUSE.x1 - wt2 - 0.06, z: ZE - wt2 - 0.36, hx: 0.06, hz: 0.25 },
  lane: { x: -12.85, z0: 9.45, z1: 13.7, zig: 0.3, wave: 2.4 },
  start: { z: 11.0, dir: -1 },
  fear: { x0: XC + wt2, x1: HOUSE.x1 - wt2, z0: ZK + 0.14, z1: ZK + 0.6 },
};
/**
 * A DESPENSA (a copa de passagem entre o corredor e a sala de jantar) está no escuro. O interruptor fica do lado de fora,
 * na parede do corredor, ao norte da porta, alto (o impulso na parede da Rhaenyra: createWallButton). No escuro, a
 * Radhija não entra (`fear`: o vão da porta, só para a pequena). Lá dentro, a GOTEIRA (a pista): pinga do forro numa
 * panela no chão, a cada `period` s.
 */
export const PANTRY = {
  switch: { x: XC + wt2, z: 12.45, nx: 1, nz: 0, top: 1.05, kind: 'button', mode: 'once' },
  fear: { x0: XC - 0.16, x1: XC + 0.16, z0: DOORWAYS.despensa.z0, z1: DOORWAYS.despensa.z1 },
  drip: { x: -15.6, z: 12.72, pan: 0.15, panH: 0.1, period: 1.35 },
  lamp: { x: (XB + XC) / 2, z: 13.25, drop: 0.32 },
};
/** A mesa de jantar (a toalha cobre e pende: o colisor inclui as abas) e as cadeiras, nenhuma na cabeceira do leste. */
export const DINING_TABLE = { x: -20.5, z: 11.2, hx: 0.85, hz: 0.48, h: 0.76 };
export const DINING_CHAIRS = [
  { x: -21.0, z: 10.39, yaw: 0 }, { x: -20.0, z: 10.39, yaw: 0 }, { x: -21.0, z: 12.01, yaw: Math.PI }, { x: -20.0, z: 12.01, yaw: Math.PI },
  { x: -21.69, z: 11.2, yaw: Math.PI / 2 },
];
/**
 * A TOALHA da mesa de jantar: pende `side` m nos lados e `end` m na cabeceira do leste (a ponta comprida, quase no chão,
 * que a Radhija morde em `bite`). Puxando para o leste, ela escorrega por cima da mesa; com `pull` m, a LATA de biscoito
 * (perto da ponta) já passou da beirada e caiu.
 */
export const TABLECLOTH = {
  side: 0.22, end: 0.46, pull: 0.52, grabR: 0.6,
  bite: { x: DINING_TABLE.x + DINING_TABLE.hx + 0.03, y: 0.3, z: DINING_TABLE.z },
};
/**
 * A LATA de biscoito em cima da toalha, perto da ponta do leste: vai junto com a toalha; passou da beirada, cai (em
 * `land`), a tampa salta (até `lid`) e ela corre pelo chão até `rest`. De dentro saem o biscoito (o petisco 'lata', em
 * `treat`) e a etiqueta da cenoura (a pista, em `tag`). Tudo fora do caminho de quem puxa a toalha.
 */
export const COOKIE_TIN = {
  x: DINING_TABLE.x + DINING_TABLE.hx - 0.5, z: DINING_TABLE.z - 0.12, r: 0.11, h: 0.09,
  land: { x: -19.43, z: 11.12 }, rest: { x: -19.4, z: 12.15 }, lid: { x: -18.65, z: 10.75 },
  treat: { x: -18.95, z: 11.8 }, tag: { x: -19.25, z: 10.55 },
};
/** O sofá encostado na parede leste da sala de estar, embaixo da janela, de frente para o oeste (`seat`: o assento). */
export const SOFA = { x: HOUSE.x1 - wt2 - 0.44, z: 16.75, hx: 0.44, hz: 1.1, h: 0.82, seat: 0.46 };
/** A janela da sala em cima do sofá e o parapeito de dentro, fundo, de pedra: é por ele que a Radhija chega ao trinco. */
export const LIVING_WINDOW = { x: HOUSE.x1, z0: 16.55, z1: 17.95, sill: 0.92, top: 2.02 };
export const LIVING_SILL = { x0: HOUSE.x1 - wt2 - 0.2, x1: HOUSE.x1 - wt2, z0: 16.45, z1: 18.08, y: 0.92 };
/**
 * A PORTA DOS FUNDOS (o vão HOUSE_EXIT, na parede leste da sala): a dobradiça ao sul, abre para fora (o quintal). O
 * TRINCO fica no alto, do lado do trinco da folha (o norte), ao lado da janela: do chão ninguém alcança; do parapeito, a
 * Radhija sim. Destrancada, a Rhaenyra empurra (Shift).
 */
export const EXIT_DOOR = {
  hinge: { x: HOUSE_EXIT.x, z: HOUSE_EXIT.z1 }, latchPost: { x: HOUSE_EXIT.x, z: HOUSE_EXIT.z0 }, length: HOUSE_EXIT.z1 - HOUSE_EXIT.z0,
  closedYaw: 0, openYaw: -Math.PI * 0.55, openTime: 1.0, closeTime: 1.0, h: 2.05,
};
export const EXIT_LATCH = { x: HOUSE_EXIT.x - wt2 - 0.035, y: 1.3, z: HOUSE_EXIT.z0 + 0.09 };
/**
 * O PUFE da sala (caixa empurrável, nos dois eixos, dentro de um retângulo sem parede nem móvel: nunca fica preso): a
 * Rhaenyra empurra até encostar na frente do sofá, embaixo da janela (POUF_SPOT). Aí a Radhija sobe: pufe, assento,
 * encosto, parapeito.
 */
export const POUF = {
  start: { x: -15.3, z: 18.45 }, half: 0.27, height: 0.4,
  minX: -15.3, maxX: SOFA.x - SOFA.hx - 0.275, minZ: 17.45, maxZ: 18.45, pushSpeed: 0.75,
};
export const POUF_SPOT = { x: POUF.maxX, z0: POUF.minZ - 0.01, z1: 17.86 };
/**
 * A ala sul: o que fica em cada cômodo (cenário com colisão; world/casaSul.js desenha dentro destes lugares).
 *  - corredor: o aparador estreito na parede leste, o vaso no canto nordeste e a janela (a passadeira não colide);
 *  - banheiro: o vaso sanitário, a pia com o gabinete, o box (o vidro), o cesto de roupa e a folha da porta, aberta;
 *  - despensa: as prateleiras (norte e sul), o cesto de batatas e a vassoura;
 *  - sala de jantar: a cristaleira, o aparador, as plantas e o tapete;
 *  - sala de estar: a mesinha, o rack com o painel e a TV, as poltronas, as luminárias, a estante, a vitrola, as plantas,
 *    as janelas do sul e os tapetes.
 */
export const WING = {
  corridor: {
    console: { x: HOUSE.x1 - wt2 - 0.16, z: 12.85, hx: 0.16, hz: 0.42, h: 0.82 },
    plant: { x: HOUSE.x1 - wt2 - 0.26, z: ZK + wt2 + 0.3, r: 0.2 },
    window: { z0: 10.85, z1: 11.95, sill: 1.0, top: 1.9 },
  },
  bath: {
    toilet: { x: XB + wt2 + 0.33, z: 9.05, hx: 0.33, hz: 0.2 },
    sink: { x: -15.35, z: ZK + wt2 + 0.24, hx: 0.42, hz: 0.24, h: 0.84 },
    shower: { x0: XB + wt2, x1: -15.5, z0: 10.75, z1: ZB - wt2 },
    glass: { x0: XB + wt2, x1: -15.95, z: 10.75 },
    basket: { x: XC - wt2 - 0.26, z: 11.5, r: 0.19 },
    door: { x: XC - wt2 - 0.035, z0: DOORWAYS.banheiro.z1, z1: DOORWAYS.banheiro.z1 + 0.82 },
  },
  pantry: {
    shelves: [
      { x: (XB + XC) / 2, z: ZB + wt2 + 0.2, hx: 1.2, hz: 0.2, h: 1.95 },
      { x: (XB + XC) / 2 - 0.1, z: ZE - wt2 - 0.17, hx: 0.95, hz: 0.17, h: 1.6 },
    ],
    basket: { x: XB + wt2 + 0.24, z: ZB + wt2 + 0.62, r: 0.18 },
    broom: { x: XC - wt2 - 0.12, z: ZE - wt2 - 0.12, r: 0.1 },
  },
  dining: {
    china: { x: -21.4, z: ZK + wt2 + 0.23, hx: 0.8, hz: 0.23, h: 1.95 },
    buffet: { x: HOUSE.x0 + wt2 + 0.24, z: 11.2, hx: 0.24, hz: 0.85, h: 0.86 },
    plants: [{ x: XB - wt2 - 0.3, z: ZK + wt2 + 0.3, r: 0.24 }, { x: HOUSE.x0 + wt2 + 0.3, z: ZE - wt2 - 0.32, r: 0.22 }],
    rug: { x: DINING_TABLE.x, z: DINING_TABLE.z, hx: 1.55, hz: 1.15 },
  },
  living: {
    coffee: { x: -13.65, z: 16.35, hx: 0.34, hz: 0.55, h: 0.4 },
    tv: { x: -16.98, z: 16.7, hx: 0.25, hz: 1.05, h: 2.05 },
    armchairs: [{ x: -14.6, z: 19.55, hx: 0.44, hz: 0.44, yaw: Math.PI }, { x: -22.85, z: 19.45, hx: 0.42, hz: 0.42, yaw: Math.PI }],
    lamps: [{ x: -11.98, z: 15.25, r: 0.15 }, { x: -23.62, z: 19.95, r: 0.15 }],
    bookcase: { x: HOUSE.x0 + wt2 + 0.19, z: 17.3, hx: 0.19, hz: 0.95, h: 2.1 },
    record: { x: -20.2, z: HOUSE.z1 - wt2 - 0.22, hx: 0.7, hz: 0.22, h: 0.74 },
    plants: [
      { x: HOUSE.x1 - wt2 - 0.3, z: HOUSE.z1 - wt2 - 0.32, r: 0.25 }, { x: HOUSE.x0 + wt2 + 0.32, z: ZE + wt2 + 0.34, r: 0.25 },
      { x: -17.0, z: 18.2, r: 0.2 },
    ],
    windows: [{ x0: -21.7, x1: -20.3, sill: 0.95, top: 2.0 }, { x0: -15.5, x1: -14.1, sill: 0.95, top: 2.0 }],
    rugs: [{ x: -14.1, z: 16.7, hx: 1.35, hz: 1.2 }, { x: -21.3, z: 17.6, hx: 1.5, hz: 1.2 }],
  },
};
/** Móveis a mais do deque, da área de serviço e da torre (cenário com colisão; world/comum.js). */
export const POOL_TABLE = { x: LOUNGERS[0].x + 0.62, z: LOUNGERS[0].z - 0.35, r: 0.2 };
export const POOL_TOYBOX = { x: -2.0, z: POOL.deck.z0 + 0.62, hx: 0.32, hz: 0.45 }; // no lado norte do deque, longe da marca da boia
export const SERVICE_WASHER = { x: TANKS.x1 + 0.34, z: TANKS.z0 + 0.31, hx: 0.34, hz: 0.31 };
export const SERVICE_RACK = { x: 2.3, z: WALL.minZ + WALL.t / 2 + 0.34, hx: 0.5, hz: 0.26 };
export const TOWER_GAS = { x: TOWER.x0 - WALLS.t / 2 - 0.24, z: -14.2, hx: 0.24, hz: 0.5 };
/** O terraço (só em cena): a casinha da escada e os lugares das irmãs e dos pombos. */
export const TERRACE = {
  y: TOWER.h, hut: { x: 7.4, z: -9.6 }, rad: { x: 8.6, z: -11.2 }, rha: { x: 9.6, z: -12.2 },
  pigeons: { x: u(7.0), z: u(-8.0), y: TOWER.tank.h }, view: { x: u(6.0), z: -52 },
};

// ---------------------------------------------------------------- o terraço jogável (cenário à parte: ROOFTOP)
/** A casinha da escada, no canto sudoeste: as duas saem pela porta da face leste (o vão em z0..z1 da porta). */
export const ROOF_HUT = { x0: ROOFTOP.x0, x1: ROOFTOP.x0 + 2.4, z0: ROOFTOP.z1 - 2.8, z1: ROOFTOP.z1, h: 2.3, door: { z0: -2.95, z1: -1.95, h: 1.95 } };
/** Onde as duas aparecem, na frente da porta da casinha (o corte da chegada). */
export const ROOF_ARRIVE = { rad: { x: 66.85, z: -2.0, yaw: Math.PI / 2 }, rha: { x: 67.05, z: -3.15, yaw: Math.PI / 2 } };
/**
 * A caixa d'água grande, no canto nordeste (encostada nas muretas do norte e do leste), com o alçapão no alto (a TAMPA de
 * borracha dele some com os pombos: a pista 'tampa') e a escada de marinheiro na face sul.
 */
export const ROOF_TANK = { x0: 72.6, x1: ROOFTOP.x1, z0: ROOFTOP.z0, z1: -8.4, h: 2.7, hatch: { x: 74.55, z: -10.25, r: 0.3 } };
/**
 * A escada de marinheiro: os trilhos encostados na face sul (z), de `low` até o alto; o lance de baixo fica recolhido e
 * travado lá em cima. Destravado, ele desce `drop` m e apoia no caixote.
 */
export const ROOF_LADDER = { x: 74.4, z: ROOF_TANK.z1 + 0.08, w: 0.42, low: 1.3, drop: 0.8 };
/**
 * O caixote de feira (caixa empurrável): a Rhaenyra leva até embaixo da escada (o fim do curso: x = maxX e z = minZ, a 10
 * cm da caixa d'água). Dá para empurrar para o leste e para o norte, em qualquer ordem.
 */
export const ROOF_CRATE = { start: { x: 70.6, z: -3.4 }, half: 0.3, height: 0.5, minX: 70.6, maxX: ROOF_LADDER.x, minZ: ROOF_TANK.z1 + 0.4, maxZ: -3.4, pushSpeed: 0.8 };
/**
 * A trava da escada: um puxador vermelho que pende na frente dos trilhos, alto demais para o pulo do chão. Com o caixote
 * embaixo da escada, a face sul dele vira a "parede" do impulso da Rhaenyra (createWallButton: o impulso sobe o
 * quanto um caixote sobe) e a pata alcança o puxador.
 */
export const ROOF_LATCH = { x: ROOF_LADDER.x, z: ROOF_CRATE.minZ + ROOF_CRATE.half, nx: 0, nz: 1, top: 1.45, kind: 'lever', mode: 'once', lat: 0 };
/**
 * Os poleiros dos pombos: três baixos (a antena, o varal e o ar-condicionado) e o alto da caixa d'água (o único alto
 * demais: é para lá que eles vão quando não sobra poleiro). (x, z): o ponto do chão que conta para espantar e guardar;
 * y: onde os pés pousam; `axis`/`step`: os três lugares lado a lado (o Farelo, com a cenoura, no meio).
 */
export const ROOF_PERCHES = {
  antena: { x: 65.6, z: -10.4, y: 2.27, axis: 'x', step: 0.33 },
  varal: { x: 69.4, z: -6.0, y: 1.46, axis: 'x', step: 0.55 },
  ar: { x: 75.8, z: -4.2, y: 0.84, axis: 'z', step: 0.27 },
  caixa: { x: 74.55, z: -9.75, y: ROOF_TANK.h + 0.02, axis: 'x', step: 0.5, high: true },
};
/** A antena de TV (o mastro com a base de concreto), o varal de terraço e o ar-condicionado velho com o ventilador. */
export const ROOF_ANTENNA = { x: ROOF_PERCHES.antena.x, z: ROOF_PERCHES.antena.z, base: 0.22, top: 2.9, bar: 2.25 };
export const ROOF_LINE = { a: { x: 67.6, z: -6.0 }, b: { x: 71.2, z: -6.0 }, h: 1.45, postR: 0.05 };
export const ROOF_AC = { x0: 75.3, x1: ROOFTOP.x1 - ROOFTOP.t / 2 - 0.02, z0: -4.7, z1: -3.7, h: 0.82 };
/** O carrinho de mão esquecido (as alças para o sul), a pilha de caixas e os vasos (cenário com colisão). */
export const ROOF_BARROW = { x: 68.6, z: -2.1, hx: 0.36, hz: 0.7 };
export const ROOF_BOXES = { x: 64.3, z: -7.6, hx: 0.55, hz: 0.45 };
export const ROOF_POTS = [{ x: 67.7, z: -11.55, r: 0.22 }, { x: 72.15, z: -11.5, r: 0.2 }, { x: 63.95, z: -5.0, r: 0.2 }, { x: 76.05, z: -6.6, r: 0.2 }];
/**
 * O mirante: a mureta norte de frente para a cidade, aonde as penas levam (o fim do terraço). Junto dela, o DEGRAU de
 * concreto (com colisor): na cena, as duas sobem nele para olhar por cima da mureta (a Radhija é mais baixa que ela).
 */
export const ROOF_STEP = { x0: 68.9, x1: 71.1, z0: ROOFTOP.z0 + ROOFTOP.t / 2, z1: -11.3, h: 0.2 };
export const ROOF_LOOKOUT = { x: 70.0, z: ROOF_STEP.z1 + 0.35, r: 1.0 };
/** As penas que caem na fuga, do pé da caixa d'água até o mirante (o Faro mostra a direção da cidade). */
export const ROOF_FEATHERS = [{ x: 72.2, z: -9.0, yaw: -0.8 }, { x: 71.4, z: -9.85, yaw: -0.6 }, { x: 70.6, z: -10.6, yaw: -0.4 }];

// ---------------------------------------------------------------- guarita e portãozinho (nordeste)
export const BOOTH = { x0: 17.84, x1: 20.24, z0: WALL.minZ + 0.2, z1: -12.7, h: 2.25, roof: 2.42, awning: { z1: -12.1, y0: 1.56, y1: 1.74 } };
/** A antena no telhado com a meia presa (colecionável) e onde a Radhija fica lá em cima. */
export const ANTENNA = { x: BOOTH.x1 - 0.45, z: BOOTH.z0 + 0.5, top: 3.3, sock: 2.95 };
/**
 * A grelha de ventilação da guarita, rente ao chão, na parede oeste: o Superbafo da Radhija entra por ela (a boca olha
 * para o oeste) e sai lá dentro, perto do porteiro. A janela (na parede sul, embaixo do toldo) começa fechada.
 */
export const BOOTH_VENT = { x: BOOTH.x0, z: -13.9, y: 0.22, r: 0.42, inside: { x: BOOTH.x0 + 1.2, z: -13.9 } };
/** A lixeira de rodinhas (a Rhaenyra empurra; com o Fica, ela segura e a Radhija sobe por ela e pelo toldo). */
export const BIN = { start: { x: 15.9, z: -8.4 }, half: 0.32, height: 1.0, minX: 14.7, maxX: 23.0, minZ: BOOTH.awning.z1 + 0.08, maxZ: -4.6, pushSpeed: 0.8 };
/** Onde a lixeira precisa estar (encostada no toldo da guarita) para servir de degrau. */
export const BIN_SPOT = { x0: BOOTH.x0 + 0.25, x1: BOOTH.x1 - 0.25, z0: BOOTH.awning.z1 + 0.05, z1: BOOTH.awning.z1 + 0.6 };
/** A subida da Radhija: em cima da lixeira, no toldo, no telhado e perto da antena. */
export const CLIMB = {
  // o toldo cai para o sul: o alto dele a 0,25 m da beirada fica em 1,64 (src/story/areas/recanto/world/leste.js)
  bin: BIN.height, awning: { z: BOOTH.awning.z1 - 0.25, y: 1.64 }, roof: { z: BOOTH.z1 - 0.35, y: BOOTH.roof }, antenna: { x: ANTENNA.x - 0.35, z: ANTENNA.z + 0.3 },
};

// ---------------------------------------------------------------- lago (leste)
/** O canal estreito entre a margem sul e a ilha (o barquinho encaixa aqui; antes disso, a boca fica fechada). */
export const CHANNEL = { x0: 17.81, x1: 18.91, z0: 6.1, z1: 7.6 };
/** O lago: um contorno irregular (pontos no sentido horário) e a ilha. */
export const LAKE = {
  outline: [
    P(5.9, -1.6), P(7.6, -2.6), P(10.2, -2.75), P(12.6, -2.2), P(13.7, -0.4),
    P(13.8, 2.4), P(13.1, 4.4), { x: 20.6, z: 7.75 }, { x: CHANNEL.x1, z: CHANNEL.z1 + 0.08 }, { x: CHANNEL.x0, z: CHANNEL.z1 },
    { x: 16.66, z: 7.57 }, P(7.8, 4.6), P(6.1, 3.6), P(5.45, 1.95), P(5.45, 1.15),
  ],
  /** Lados do contorno que ficam abertos: a boca do canal e a entrada do píer (índices do primeiro ponto do lado). */
  gaps: [8, 13],
  waterY: -0.12,
  island: { x: (CHANNEL.x0 + CHANNEL.x1) / 2, z: 3.7, r: 2.4 },
};
/** O píer da Dona Gansa, saindo da margem oeste. */
export const PIER = { x0: u(5.5), x1: 12.6, z0: u(1.15), z1: u(1.95), y: 0.18 };
/**
 * O barquinho de pedal (patinho): começa encostado na margem sul; a Rhaenyra empurra pela margem até a frente do canal
 * e para dentro dele (onLimit), onde ele vira ponte entre a margem e a ilha. Só a Radhija atravessa nele.
 */
export const BOAT = { start: { x: 13.0, z: 8.55 }, half: 0.5, height: 0.6, minX: 12.0, maxX: LAKE.island.x, minZ: 8.55, maxZ: 8.55, pushSpeed: 0.7, dock: { x: LAKE.island.x, z: (CHANNEL.z0 + CHANNEL.z1) / 2 } };
/** A Dona Gansa: patrulha o píer e a margem do barquinho; um latido de longe a distrai (createGooseNPC). */
export const GOOSE = {
  home: { x: PIER.x1 - 0.55, z: (PIER.z0 + PIER.z1) / 2 },
  patrol: [{ x: PIER.x1 - 0.55, z: (PIER.z0 + PIER.z1) / 2 }, { x: 11.3, z: 9.3 }],
  radius: 0.27, alertR: 1.6, lureR: 11.0, lureStop: 1.9, curiousTime: 9, walkSpeed: 0.95,
  chargeSpeed: 2.6, chargeTime: 0.7, knockback: 0.9, cooldown: 1.6,
};

// ---------------------------------------------------------------- garagem (sul)
export const CARPORT = { x0: u(-1.8), x1: u(4.6), z0: u(3.6), z1: WALL.maxZ, h: 2.35 };
/** A caminhonete: por baixo, só a Radhija passa (o vão é baixo para a irmã); as rodas colidem com as duas. */
export const CAR = { x0: -0.66, x1: 1.34, z0: 8.55, z1: 12.65, clearance: 0.49, wheelR: 0.34, wheelW: 0.24 };
export const WHEELS = [{ x: CAR.x0 + 0.08, z: CAR.z0 + 0.75 }, { x: CAR.x1 - 0.08, z: CAR.z0 + 0.75 }, { x: CAR.x0 + 0.08, z: CAR.z1 - 0.75 }, { x: CAR.x1 - 0.08, z: CAR.z1 - 0.75 }];
/**
 * O depósito no fundo da garagem. A porta na parede oeste abre para dentro (o leste) quando a Rhaenyra empurra, mas a
 * bola de futebol está entalada atrás dela, do lado de dentro. Na prateleira de dentro, ao norte da porta, o balde; a
 * corda dele desce pela parede, sai pela fresta de baixo da porta e corre pelo chão até debaixo da caminhonete. A
 * Radhija puxa: o balde cai em cima da bola e a bola rola para longe da porta.
 */
export const STORAGE = { x0: u(2.6), x1: CARPORT.x1, z0: u(6.0), z1: WALL.maxZ, h: 2.3 };
export const STORAGE_DOOR = {
  hinge: { x: STORAGE.x0, z: 11.65 }, latchPost: { x: STORAGE.x0, z: 12.65 }, length: 1.0,
  closedYaw: Math.PI, openYaw: Math.PI + Math.PI * 0.55, openTime: 1.0, closeTime: 1.0, h: 1.95,
};
/** A bola entalada atrás da porta (dentro do arco da folha) e para onde ela rola; o balde fica fora do arco. */
export const BALL = { x: STORAGE.x0 + 0.34, z: 12.3, r: 0.17, rollTo: { x: STORAGE.x0 + 2.2, z: 11.0 } };
export const SHELF = { x: STORAGE.x0 + 0.17, z: 11.37, y: 1.3, landing: { x: STORAGE.x0 + 0.45, z: 11.31 } };
export const ROPE = { end: { x: (CAR.x0 + CAR.x1) / 2, z: CAR.z0 + 2.15 }, gap: { x: STORAGE.x0, z: 12.15, y: 0.03 }, pull: 0.55, grabR: 0.55 };
/** O que fica dentro do depósito (cenário com colisão; src/story/areas/recanto/world/garagem.js). */
export const STORAGE_STUFF = {
  cans: { x0: STORAGE.x0 + 0.08, x1: STORAGE.x0 + 0.65, z0: WALL.maxZ - 1.2, z1: WALL.maxZ - 0.28 },
  crate: { x0: STORAGE.x1 - 0.82, x1: STORAGE.x1 - 0.1, z0: WALL.maxZ - 1.16, z1: WALL.maxZ - 0.28 },
  brooms: { x0: STORAGE.x1 - 0.42, x1: STORAGE.x1 - 0.1, z0: STORAGE.z0 + 0.08, z1: STORAGE.z0 + 0.36 },
};
/** O que fica no chão da garagem e colide (src/story/areas/recanto/world/garagem.js desenha dentro destes lugares). */
export const GARAGE_STUFF = {
  // pilares a mais da cobertura: meio da frente, meio do fundo e meio do lado oeste
  posts: [{ x: CAR.x1 + 0.66, z: CARPORT.z0 }, { x: CAR.x1 + 0.66, z: WALL.maxZ - 0.4 }, { x: CARPORT.x0, z: STORAGE.z0 }],
  // a bicicleta encostada na parede norte do depósito, por fora
  bike: { x0: STORAGE.x0 + 0.85, x1: STORAGE.x0 + 2.65, z0: STORAGE.z0 - 0.66, z1: STORAGE.z0 - 0.08 },
  // o carrinho de mão, no lado oeste
  barrow: { x0: CARPORT.x0 + 0.3, x1: CARPORT.x0 + 1.0, z0: WALL.maxZ - 3.1, z1: WALL.maxZ - 1.5 },
  // a bancada de ferramentas no muro do fundo, entre o pilar do meio e o depósito
  bench: { x0: STORAGE.x0 - 2.07, x1: STORAGE.x0 - 0.37, z0: WALL.maxZ - 0.82, z1: WALL.maxZ - 0.2 },
  // a pilha de pneus velhos no canto sudoeste
  tires: { x: CARPORT.x0 + 0.66, z: WALL.maxZ - 0.62, r: 0.36 },
};

// ---------------------------------------------------------------- colecionáveis e pistas
/** Petiscos (os de sempre). */
/** @type {import('../../../types').Collectible[]} */
export const COLLECTIBLES = [
  { id: 'ilha', x: LAKE.island.x + 0.7, z: LAKE.island.z - 0.6 }, // na ilha do lago (puzzle A)
  { id: 'espreguicadeira', x: LOUNGERS[1].x, z: LOUNGERS[1].z }, // embaixo da espreguiçadeira do norte (só a Radhija)
  { id: 'torre', x: TOWER.x1 + 0.5, z: TOWER.z1 + 0.6 }, // no canto da torre, perto da lixeira
  { id: 'lata', x: COOKIE_TIN.treat.x, z: COOKIE_TIN.treat.z }, // sai da lata de biscoito que cai da mesa de jantar (a toalha)
  { id: 'mesa', x: KITCHEN_TABLE.x, z: KITCHEN_TABLE.z }, // embaixo da mesa da cozinha (só a Radhija)
];
export const COLLECTIBLE_PICKUP_R = 0.42;
/**
 * As testemunhas (pedido do usuário em 2026-11-11: dar propósito aos personagens e aos puzzles paralelos):
 *  - a Dona Gansa perdeu o broche de campanha (os pombos deixaram cair na ilha): devolvido, ela conta o que viu;
 *  - o Bichano, na garagem, quer a bolinha presa atrás da porta do depósito: com ela solta, ele conta o que ouviu.
 * `talk`: a que distância o E conversa.
 */
export const WITNESSES = {
  broche: { x: LAKE.island.x + 0.35, z: LAKE.island.z + 0.15, y: 0.1, pickR: 0.5 },
  gansa: { talk: 1.9 },
  bichano: { talk: 1.7 },
};
/** Meias perdidas (o colecionável do capítulo). */
export const SOCKS = [
  { id: 'antena', x: ANTENNA.x, z: ANTENNA.z, y: ANTENNA.sock }, // puzzle B (subida pela lixeira e pelo toldo)
  { id: 'deposito', x: STORAGE_STUFF.crate.x0 + 0.18, z: STORAGE_STUFF.crate.z0 + 0.18, y: 0.45 }, // puzzle C (dentro do depósito, na quina de uma caixa)
  { id: 'casinha', x: DOGHOUSE.x, z: DOGHOUSE.z + 0.05, y: 0.06 }, // dentro da casinha do quintal (só a Radhija entra)
];
export const SOCK_PICKUP_R = 0.45;
/**
 * Onde cada pista está no mundo (as definições, tipos e casos ficam em src/story/clues.js). `r`: até quantos metros
 * de quem fareja o pulso do Faro a revela (as do quarto valem para o quarto todo). `at`: onde a dog para para
 * examinar (E), quando não é o próprio lugar da pista.
 */
export const CLUE_SPOTS = {
  // a trilha fica em cima da caminha, indo para a janela: quem examina para ao sul da caminha
  trilha: { x: BED.x + 0.3, z: BED.z - 0.62, r: 9, at: { x: BED.x - 0.1, z: BED.z + BED.r + 0.32 } },
  pote: { x: BOWL.x, z: BOWL.z, r: 9, at: { x: BOWL.x + 0.25, z: BOWL.z + 0.62 } },
  // a pena e a baba ficam no parapeito: quem examina para embaixo da janela, ao lado da caminha (o mesmo canto: a
  // baba só aparece farejando dali de perto)
  pena: { x: SILL.out.x + 0.25, z: SILL.out.z, y: SILL.out.y + 0.04, r: 9, at: { x: BED.x + 1.05, z: HOUSE.z0 + 0.45 } },
  baba: { x: SILL.in.x - 0.2, z: SILL.in.z, y: SILL.in.y + 0.02, r: 3.6, at: { x: BED.x + 0.98, z: HOUSE.z0 + 0.6 } },
  telhas: { x: TILES.x, z: TILES.z, r: 6 },
  boia: { x: RECON.x, z: RECON.z, r: RECON.r },
  senha: { x: INTERCOM.recon.x, z: INTERCOM.recon.z, r: INTERCOM.recon.r },
  ralo: { x: DRAIN.x, z: DRAIN.z, y: DRAIN.y, r: 4.2, at: { x: DRAIN.x, z: TANKS.z1 + 0.4 } },
  // a ala sul da casa: a goteira na panela da despensa (aparece com a luz acesa) e a etiqueta da cenoura, que sai da
  // lata de biscoito (casaPuzzles.js)
  goteira: { x: PANTRY.drip.x, z: PANTRY.drip.z, y: 0.12, r: 3.2, at: { x: PANTRY.drip.x + 0.1, z: PANTRY.drip.z + 0.62 } },
  etiqueta: { x: COOKIE_TIN.tag.x, z: COOKIE_TIN.tag.z, y: 0.02, r: 3.2, at: { x: COOKIE_TIN.tag.x + 0.35, z: COOKIE_TIN.tag.z - 0.2 } },
};
/** A trilha laranja da cenoura no quarto (da caminha até o basculante; some na janela: a garoa lavou lá fora). */
export const CARROT_TRAIL = [
  { x: BED.x + 0.15, z: BED.z - 0.17 }, { x: BED.x + 0.3, z: BED.z - 0.47 }, { x: BED.x + 0.25, z: BED.z - 0.72 },
  { x: BED.x + 0.05, z: BED.z - 0.87 }, { x: BED.x - 0.05, z: BED.z - 0.99 },
];

// ---------------------------------------------------------------- cenário solto (com colisão)
export const TREES = [
  P(-9.0, -2.6, { kind: 'ipe-amarelo' }), P(-12.6, -6.6, { kind: 'verde' }), P(3.7, 2.3, { kind: 'ipe-rosa' }),
  P(13.45, -2.6, { kind: 'verde' }), P(6.0, 7.4, { kind: 'verde' }), P(13.2, 7.6, { kind: 'ipe-roxo' }),
  P(-13.0, -1.4, { kind: 'verde' }),
  // a mais, para o terreno maior
  { x: -15.2, z: -9.6, kind: 'verde' }, { x: -18.6, z: -2.2, kind: 'ipe-rosa' }, { x: -2.6, z: 2.4, kind: 'verde' },
  { x: 9.6, z: -3.4, kind: 'ipe-amarelo' }, { x: 15.6, z: 12.4, kind: 'verde' }, { x: 2.6, z: -2.0, kind: 'ipe-roxo' },
];
export const TREE_TRUNK_R = 0.25;
export const BENCHES = [
  { x: u(-8.6), z: u(-6.0), yaw: Math.PI / 2 }, { x: 15.3, z: -5.2, yaw: 0 }, // o segundo de frente para o lago
  { x: -17.2, z: -5.6, yaw: Math.PI / 2 }, { x: 11.6, z: 11.2, yaw: Math.PI },
];
export const LAMPS = [
  P(-2.55, 0.95), P(3.95, -4.35), { x: 14.5, z: -14.5 }, P(4.8, 2.8), P(-7.2, -4.6),
  { x: -19.0, z: -11.0 }, { x: 22.6, z: 9.6 }, { x: 8.4, z: 5.4 },
];
/** O cartaz da eleição (pictogramas: urna, sino e o relógio marcando uma hora) no muro norte, perto do portãozinho. */
export const ELECTION_POSTER = { x: 15.8, z: WALL.minZ + WALL.t / 2 + 0.01, y: 1.0, w: 0.9, h: 0.62 };
/** Canteiros compridos junto ao muro (com colisão). */
export const BEDS = [
  { x: u(-10.3), z: WALL.minZ + WALL.t / 2 + 0.24, hx: 6.1, hz: 0.22 }, // ao longo do muro norte, a oeste
  { x: WALL.minX + WALL.t / 2 + 0.22, z: u(-4.4), hx: 0.22, hz: 5.4 }, // ao longo do muro oeste, ao norte da casa
  { x: u(10.4), z: WALL.maxZ - WALL.t / 2 - 0.16, hx: 5.8, hz: 0.16 }, // junto ao muro sul, perto do lago
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
/** Uma caixa pelo centro e pelas meias medidas. */
const boxAt = (id, o, extra = {}) => box(id, o.x - o.hx, o.z - o.hz, o.x + o.hx, o.z + o.hz, extra);

/** Os lados do lago como segmentos (a margem e a ilha, dois contornos fechados; o píer e o canal ficam abertos). */
function lakeColliders() {
  const O = LAKE.outline;
  const out = [];
  for (let i = 0; i < O.length; i++) {
    if (LAKE.gaps.includes(i)) continue;
    const a = O[i];
    const b = O[(i + 1) % O.length];
    out.push(seg(`lago-${i}`, a.x, a.z, b.x, b.z, 0.12, { kind: 'water' }));
  }
  // a ilha: um contorno de 20 lados, aberto na ponta do canal
  const I = LAKE.island;
  const n = 20;
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
  // o muro sul do condomínio só a leste do lote da casa; o lote tem muro próprio (oeste, sul e leste)
  seg('muro-sul', LOT.x1, WALL.maxZ, WALL.maxX, WALL.maxZ, mt),
  seg('muro-oeste', WALL.minX, WALL.minZ, WALL.minX, LOT.z1, mt),
  seg('muro-lote-sul', LOT.x0, LOT.z1, LOT.x1, LOT.z1, mt),
  // casa: paredes de fora (a porta dos fundos é dinâmica: o vão HOUSE_EXIT fica aberto aqui) e as de dentro, com as
  // passagens (a porta da cozinha para o corredor também é dinâmica)
  seg('casa-norte', HOUSE.x0, HOUSE.z0, HOUSE.x1, HOUSE.z0, wt),
  seg('casa-leste-norte', HOUSE.x1, HOUSE.z0, HOUSE.x1, HOUSE_EXIT.z0, wt),
  seg('casa-leste-sul', HOUSE.x1, HOUSE_EXIT.z1, HOUSE.x1, HOUSE.z1, wt),
  seg('casa-sul', HOUSE.x0, HOUSE.z1, HOUSE.x1, HOUSE.z1, wt),
  seg('quarto-cozinha-norte', DOORWAYS.quartoCozinha.x, HOUSE.z0, DOORWAYS.quartoCozinha.x, DOORWAYS.quartoCozinha.z0, wt),
  seg('quarto-cozinha-sul', DOORWAYS.quartoCozinha.x, DOORWAYS.quartoCozinha.z1, DOORWAYS.quartoCozinha.x, ROOMS.quarto.z1, wt),
  // a parte fixa da grade (a portinha de gato): só a Rhaenyra não passa
  box('grade-portinha', PET_FLAP.x - 0.04, PET_FLAP.z0, PET_FLAP.x + 0.04, PET_FLAP.z1, { blocks: 'large' }),
  seg('quarto-sala', HOUSE.x0, ZK, ROOMS.quarto.x1, ZK, wt),
  seg('cozinha-sul-oeste', ROOMS.cozinha.x0, ZK, KITCHEN_DOOR.latchPost.x, ZK, wt),
  seg('cozinha-sul-leste', KITCHEN_DOOR.hinge.x, ZK, HOUSE.x1, ZK, wt),
  // a ala sul: o corredor (com as portas do banheiro e da despensa), o banheiro, a despensa e o arco da sala de estar
  seg('casa-corredor-oeste-1', XC, ZK, XC, DOORWAYS.banheiro.z0, wt),
  seg('casa-corredor-oeste-2', XC, DOORWAYS.banheiro.z1, XC, DOORWAYS.despensa.z0, wt),
  seg('casa-corredor-oeste-3', XC, DOORWAYS.despensa.z1, XC, ZE, wt),
  seg('casa-banheiro-oeste', XB, ZK, XB, ZB, wt),
  seg('casa-banheiro-despensa', XB, ZB, XC, ZB, wt),
  seg('casa-despensa-oeste-1', XB, ZB, XB, DOORWAYS.despensaJantar.z0, wt),
  seg('casa-despensa-oeste-2', XB, DOORWAYS.despensaJantar.z1, XB, ZE, wt),
  seg('casa-sala-norte-oeste', HOUSE.x0, ZE, DOORWAYS.arco.x0, ZE, wt),
  seg('casa-sala-norte-leste', DOORWAYS.arco.x1, ZE, HOUSE.x1, ZE, wt),
  // móveis
  circle('caminha', BED.x, BED.z, BED.r + 0.02),
  // o pote de pé ou virado (depois da abertura ele fica deitado, um pouco para o leste)
  circle('pote', BOWL.x + 0.07, BOWL.z, BOWL.r + 0.09),
  boxAt('guarda-roupa', WARDROBE),
  circle('cesto-de-brinquedos', TOY_BASKET.x, TOY_BASKET.z, TOY_BASKET.r),
  boxAt('comoda', DRESSER),
  box('bancada', COUNTER.x0, COUNTER.z0, COUNTER.x1, COUNTER.z1),
  boxAt('geladeira', FRIDGE),
  boxAt('mesa-cozinha', KITCHEN_TABLE, { blocks: 'large' }),
  // as pernas da mesa (a Radhija passa por baixo, entre elas)
  ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => circle(`mesa-perna-${i + 1}`, KITCHEN_TABLE.x + sx * (KITCHEN_TABLE.hx - 0.05), KITCHEN_TABLE.z + sz * (KITCHEN_TABLE.hz - 0.05), 0.04)),
  // a quina de fora da casa (o pilar da esquina do quintal)
  box('casa-quina', HOUSE.x1 - 0.25, HOUSE.z0 - 0.17, HOUSE.x1 + 0.12, HOUSE.z0 + 0.15),
  // casa: móveis a mais (world/casa.js)
  ...HOUSE_EXTRAS.chairs.map((c, i) => box(`cadeira-cozinha-${i + 1}`, c.x - c.half, c.z - c.half, c.x + c.half, c.z + c.half)),
  circle('lixeira-cozinha', HOUSE_EXTRAS.bin.x, HOUSE_EXTRAS.bin.z, HOUSE_EXTRAS.bin.r),
  boxAt('estante-quarto', HOUSE_EXTRAS.bedroomShelf),
  circle('vaso-quarto', HOUSE_EXTRAS.bedroomPlant.x, HOUSE_EXTRAS.bedroomPlant.z, HOUSE_EXTRAS.bedroomPlant.r),
  // a ala sul (world/casaSul.js; o aspirador, o pufe, a lata e a porta dos fundos são dinâmicos): o corredor
  boxAt('aparador-corredor', WING.corridor.console),
  circle('vaso-corredor', WING.corridor.plant.x, WING.corridor.plant.z, WING.corridor.plant.r),
  boxAt('base-do-aspirador', VACUUM.base),
  // o banheiro
  boxAt('vaso-sanitario', WING.bath.toilet),
  boxAt('pia-do-banheiro', WING.bath.sink),
  box('box-vidro', WING.bath.glass.x0, WING.bath.glass.z - 0.03, WING.bath.glass.x1, WING.bath.glass.z + 0.03),
  circle('cesto-do-banheiro', WING.bath.basket.x, WING.bath.basket.z, WING.bath.basket.r),
  box('folha-da-porta-do-banheiro', WING.bath.door.x - 0.03, WING.bath.door.z0, WING.bath.door.x + 0.03, WING.bath.door.z1),
  // a despensa (as prateleiras, a panela da goteira, o cesto de batatas e a vassoura)
  ...WING.pantry.shelves.map((s, i) => boxAt(`prateleira-despensa-${i + 1}`, s)),
  circle('panela-da-goteira', PANTRY.drip.x, PANTRY.drip.z, PANTRY.drip.pan + 0.02),
  circle('cesto-de-batatas', WING.pantry.basket.x, WING.pantry.basket.z, WING.pantry.basket.r),
  circle('vassoura-da-despensa', WING.pantry.broom.x, WING.pantry.broom.z, WING.pantry.broom.r),
  // a sala de jantar (a mesa com a toalha: o colisor inclui as abas que pendem)
  box('mesa-de-jantar', DINING_TABLE.x - DINING_TABLE.hx - 0.05, DINING_TABLE.z - DINING_TABLE.hz - 0.05, DINING_TABLE.x + DINING_TABLE.hx + 0.05, DINING_TABLE.z + DINING_TABLE.hz + 0.05),
  ...DINING_CHAIRS.map((c, i) => box(`cadeira-de-jantar-${i + 1}`, c.x - 0.21, c.z - 0.21, c.x + 0.21, c.z + 0.21)),
  boxAt('cristaleira', WING.dining.china),
  boxAt('aparador-de-jantar', WING.dining.buffet),
  ...WING.dining.plants.map((p, i) => circle(`vaso-jantar-${i + 1}`, p.x, p.z, p.r)),
  // a sala de estar
  boxAt('sofa', SOFA),
  boxAt('mesinha-sala', WING.living.coffee),
  boxAt('rack-da-tv', WING.living.tv),
  ...WING.living.armchairs.map((a, i) => boxAt(`poltrona-${i + 1}`, a)),
  ...WING.living.lamps.map((l, i) => circle(`luminaria-sala-${i + 1}`, l.x, l.z, l.r)),
  boxAt('estante-sala', WING.living.bookcase),
  boxAt('vitrola', WING.living.record),
  ...WING.living.plants.map((p, i) => circle(`vaso-sala-${i + 1}`, p.x, p.z, p.r)),
  // quintal (a porta da área de serviço é dinâmica; a passagem baixa só barra a Rhaenyra)
  seg('quintal-norte-oeste', YARD.x0, YARD.z0, YARD_GAP.x0, YARD.z0, wt),
  box('quintal-passagem', YARD_GAP.x0, YARD.z0 - wt, YARD_GAP.x1, YARD.z0 + wt, { blocks: 'large' }),
  // a mão-francesa, a cordinha e a argola do ferrolho, do lado de fora do muro
  box('ferrolho-argola', SERVICE_BOLT.ring.x - 0.06, SERVICE_BOLT.ring.z - 0.06, SERVICE_BOLT.ring.x + 0.06, YARD.z0 - wt),
  seg('quintal-norte-meio', YARD_GAP.x1, YARD.z0, SERVICE_DOOR.hinge.x, YARD.z0, wt),
  seg('quintal-norte-leste', SERVICE_DOOR.latchPost.x, YARD.z0, YARD.x1, YARD.z0, wt),
  seg('quintal-leste', YARD.x1, YARD.z0, YARD.x1, YARD.z1, wt),
  seg('casinha-norte', DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.hz, DOGHOUSE.x + DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.hz, 0.05),
  seg('casinha-sul', DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.hz, DOGHOUSE.x + DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.hz, 0.05),
  seg('casinha-leste', DOGHOUSE.x + DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.hz, DOGHOUSE.x + DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.hz, 0.05),
  seg('casinha-oeste-norte', DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.hz, DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z - DOGHOUSE.door / 2, 0.05),
  seg('casinha-oeste-sul', DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.door / 2, DOGHOUSE.x - DOGHOUSE.hx, DOGHOUSE.z + DOGHOUSE.hz, 0.05),
  ...YARD_BEDS.map((b, i) => boxAt(`canteiro-quintal-${i + 1}`, b)),
  // piscina: a água bloqueia (a borda é o deque de andar)
  box('piscina', POOL.x0, POOL.z0, POOL.x1, POOL.z1, { kind: 'water' }),
  ...LOUNGERS.map((l, i) => boxAt(`espreguicadeira-${i + 1}`, l, { blocks: 'large' })),
  // as cabeceiras e os pés baixos das espreguiçadeiras (a Radhija entra por baixo pelos lados compridos)
  ...LOUNGERS.flatMap((l, i) => [-1, 1].map((s) => seg(`espreguicadeira-${i + 1}-ponta-${s < 0 ? 'n' : 's'}`, l.x - l.hx + 0.01, l.z + s * 0.86, l.x + l.hx - 0.01, l.z + s * 0.86, 0.05))),
  circle('guarda-sol', UMBRELLA.x, UMBRELLA.z, UMBRELLA.r),
  boxAt('filtro-piscina', POOL_FILTER),
  circle('ducha', POOL_SHOWER.x, POOL_SHOWER.z, POOL_SHOWER.r),
  ...POOL_POTS.map((p, i) => circle(`vaso-piscina-${i + 1}`, p.x, p.z, p.r)),
  circle('mesinha-piscina', POOL_TABLE.x, POOL_TABLE.z, POOL_TABLE.r),
  // vida nos cantos (world/base.js): a bicicletinha no muro sul e os caixotes no canto nordeste
  box('vida-bicicleta', 8.95, 14.42, 10.25, 14.84),
  box('vida-caixotes', 23.15, -15.15, 24.0, -14.35),
  boxAt('bau-das-boias', POOL_TOYBOX),
  boxAt('maquina-de-lavar', SERVICE_WASHER),
  boxAt('varal-de-chao', SERVICE_RACK),
  boxAt('abrigo-do-gas', TOWER_GAS),
  // área de serviço (o cesto de roupa é dinâmico)
  box('tanques', TANKS.x0, TANKS.z0, TANKS.x1, TANKS.z1),
  circle('poste-varal-oeste', LINE.a.x, LINE.a.z, LINE.postR + 0.03),
  circle('poste-varal-leste', LINE.b.x, LINE.b.z, LINE.postR + 0.03),
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
  circle('ilha-casinha', LAKE.island.x - 0.7, LAKE.island.z - 0.5, 0.32),
  // garagem
  // sem `height`: a cabeça da Rhaenyra também desvia da lataria (v2/head.js pula os colisores mais baixos que ela)
  box('caminhonete', CAR.x0, CAR.z0, CAR.x1, CAR.z1, { blocks: 'large' }),
  ...WHEELS.map((w, i) => box(`roda-${i + 1}`, w.x - CAR.wheelW / 2, w.z - CAR.wheelR, w.x + CAR.wheelW / 2, w.z + CAR.wheelR)),
  seg('deposito-oeste-norte', STORAGE.x0, STORAGE.z0, STORAGE.x0, STORAGE_DOOR.hinge.z, wt),
  seg('deposito-oeste-sul', STORAGE.x0, STORAGE_DOOR.latchPost.z, STORAGE.x0, STORAGE.z1, wt),
  seg('deposito-norte', STORAGE.x0, STORAGE.z0, STORAGE.x1, STORAGE.z0, wt),
  seg('deposito-leste', STORAGE.x1, STORAGE.z0, STORAGE.x1, STORAGE.z1, wt),
  circle('garagem-pilar-1', CARPORT.x0, CARPORT.z0, 0.1), circle('garagem-pilar-2', CARPORT.x1, CARPORT.z0, 0.1),
  circle('garagem-pilar-3', CARPORT.x0, WALL.maxZ - 0.4, 0.1),
  ...GARAGE_STUFF.posts.map((p, i) => circle(`garagem-pilar-${i + 4}`, p.x, p.z, 0.1)),
  box('garagem-bicicleta', GARAGE_STUFF.bike.x0, GARAGE_STUFF.bike.z0, GARAGE_STUFF.bike.x1, GARAGE_STUFF.bike.z1),
  box('garagem-carrinho-de-mao', GARAGE_STUFF.barrow.x0, GARAGE_STUFF.barrow.z0, GARAGE_STUFF.barrow.x1, GARAGE_STUFF.barrow.z1),
  box('garagem-bancada', GARAGE_STUFF.bench.x0, GARAGE_STUFF.bench.z0, GARAGE_STUFF.bench.x1, GARAGE_STUFF.bench.z1),
  circle('garagem-pneus', GARAGE_STUFF.tires.x, GARAGE_STUFF.tires.z, GARAGE_STUFF.tires.r),
  // dentro do depósito: as latas de tinta, a caixa de brinquedos com o saco de ração (a meia fica em cima dela) e a
  // vassoura com o rastelo
  box('deposito-latas', STORAGE_STUFF.cans.x0, STORAGE_STUFF.cans.z0, STORAGE_STUFF.cans.x1, STORAGE_STUFF.cans.z1),
  box('deposito-caixa', STORAGE_STUFF.crate.x0, STORAGE_STUFF.crate.z0, STORAGE_STUFF.crate.x1, STORAGE_STUFF.crate.z1),
  box('deposito-vassouras', STORAGE_STUFF.brooms.x0, STORAGE_STUFF.brooms.z0, STORAGE_STUFF.brooms.x1, STORAGE_STUFF.brooms.z1),
  // árvores, bancos e postes
  ...TREES.map((t, i) => circle(`arvore-${i + 1}`, t.x, t.z, TREE_TRUNK_R)),
  ...BEDS.map((b, i) => boxAt(`canteiro-${i + 1}`, b)),
  ...BENCHES.map((b, i) => (Math.abs(Math.sin(b.yaw)) > 0.5
    ? box(`banco-${i + 1}`, b.x - 0.25, b.z - 0.7, b.x + 0.25, b.z + 0.7)
    : box(`banco-${i + 1}`, b.x - 0.7, b.z - 0.25, b.x + 0.7, b.z + 0.25))),
  ...LAMPS.map((l, i) => circle(`poste-${i + 1}`, l.x, l.z, 0.08)),
  // o terraço da torre (cenário à parte, a leste): roofColliders
  ...roofColliders(),
];

/**
 * Os colisores do terraço jogável ('telhado-*'): as muretas, a casinha da escada (com a porta fechada atrás das duas), a
 * caixa d'água, a antena, os postes do varal, o ar-condicionado, o carrinho de mão, as caixas e os vasos. Em volta, o
 * "vazio" ('telhado-vazio-*'): tudo o que fica dentro dos limites e fora do condomínio e do terraço (ninguém anda lá).
 */
function roofColliders() {
  const R = ROOFTOP, rt = R.t / 2, B = WORLD.bounds;
  const out = R.x0 - rt - 0.02, outE = R.x1 + rt + 0.02, outN = R.z0 - rt - 0.02, outS = R.z1 + rt + 0.02;
  const H = ROOF_HUT, T = ROOF_TANK, AC = ROOF_AC;
  return [
    // as muretas (a casinha e a caixa d'água ficam por cima delas nos cantos)
    seg('telhado-mureta-norte', R.x0, R.z0, R.x1, R.z0, rt),
    seg('telhado-mureta-sul', R.x0, R.z1, R.x1, R.z1, rt),
    seg('telhado-mureta-oeste', R.x0, R.z0, R.x0, R.z1, rt),
    seg('telhado-mureta-leste', R.x1, R.z0, R.x1, R.z1, rt),
    box('telhado-casinha', H.x0, H.z0, H.x1, H.z1),
    box('telhado-caixa', T.x0, T.z0, T.x1, T.z1),
    box('telhado-antena', ROOF_ANTENNA.x - ROOF_ANTENNA.base, ROOF_ANTENNA.z - ROOF_ANTENNA.base, ROOF_ANTENNA.x + ROOF_ANTENNA.base, ROOF_ANTENNA.z + ROOF_ANTENNA.base),
    circle('telhado-varal-oeste', ROOF_LINE.a.x, ROOF_LINE.a.z, ROOF_LINE.postR + 0.03),
    circle('telhado-varal-leste', ROOF_LINE.b.x, ROOF_LINE.b.z, ROOF_LINE.postR + 0.03),
    box('telhado-ar', AC.x0, AC.z0, AC.x1, AC.z1),
    boxAt('telhado-carrinho', ROOF_BARROW),
    boxAt('telhado-pilha', ROOF_BOXES),
    box('telhado-degrau', ROOF_STEP.x0, ROOF_STEP.z0, ROOF_STEP.x1, ROOF_STEP.z1),
    ...ROOF_POTS.map((p, i) => circle(`telhado-vaso-${i + 1}`, p.x, p.z, p.r)),
    // o vazio em volta: entre o muro leste do condomínio e o terraço, ao norte, ao sul e a leste dele
    box('telhado-vazio-oeste', WALL.maxX + mt + 0.04, B.minZ - 1, out, B.maxZ + 1),
    box('telhado-vazio-norte', out, B.minZ - 1, B.maxX + 1, outN),
    box('telhado-vazio-sul', out, outS, B.maxX + 1, B.maxZ + 1),
    box('telhado-vazio-leste', outE, outN, B.maxX + 1, outS),
  ];
}

// ---------------------------------------------------------------- navegação da companheira
/** @type {Record<string, import('../../../types').XZ>} */
export const NAV_NODES = {
  Q_bed: P(-12.0, 3.5), Q_mid: { x: -20.4, z: 5.9 }, Q_door: { x: -18.5, z: 5.4 }, Q_flap: { x: -18.3, z: 4.4 },
  K_flap: { x: -17.0, z: 4.4 }, K_gate: { x: -16.6, z: 5.4 }, K_pedal: { x: PET_PEDAL.x + 0.1, z: PET_PEDAL.z + 0.2 },
  K_mid: P(-8.9, 2.75), K_south: { x: -15.3, z: 7.35 }, K_hall: { x: -12.95, z: 7.3 },
  // a ala sul: o corredor, o banheiro, a despensa, a sala de jantar, a de estar e a porta dos fundos
  C_n: { x: -12.95, z: 8.95 }, C_ban: { x: -13.35, z: 9.88 }, C_mid: { x: -12.95, z: 11.6 }, C_copa: { x: -13.35, z: 13.4 },
  B_in: { x: -15.05, z: 9.9 }, D_in: { x: -15.35, z: 13.4 },
  J_copa: { x: -17.25, z: 13.4 }, J_e: { x: -18.6, z: 11.2 }, J_n: { x: -19.3, z: 9.45 }, J_nw: { x: -22.4, z: 9.6 },
  J_s: { x: -19.5, z: 13.3 }, J_sw: { x: -22.3, z: 13.1 }, J_arco: { x: -21.0, z: 14.0 },
  E_arco: { x: -21.0, z: 15.3 }, E_w: { x: -21.4, z: 17.7 }, E_sw: { x: -18.6, z: 19.25 }, E_tvn: { x: -18.3, z: 15.25 },
  E_n: { x: -15.0, z: 15.25 }, E_mid: { x: -14.6, z: 17.95 }, E_s: { x: -16.2, z: 19.3 }, E_porta: { x: -12.4, z: 18.85 },
  Y_fundos: { x: -10.35, z: 18.6 },
  Y_door: { x: -10.5, z: 4.84 }, Y_mid: P(-5.2, 4.6), Y_south: P(-4.6, 7.8), Y_gate: { x: -8.2, z: 4.0 },
  Y_gap: { x: -9.9, z: 3.45 }, C_gap: { x: -9.95, z: 1.2 }, C_bolt: { x: SERVICE_BOLT.ring.x, z: 1.2 },
  C_gate: { x: -8.2, z: 0.7 }, C_west: P(-8.6, 0.3), C_far: P(-12.6, 0.15),
  P_west: P(-6.85, -3.2), P_nw: P(-5.6, -6.3), P_north: P(-2.0, -6.35), P_ne: P(2.9, -6.35),
  P_east: P(2.95, -3.2), P_south: P(-2.0, 0.1), P_se: P(2.8, 0.1),
  V_mid: { x: -2.0, z: -14.0 }, V_east: { x: 4.9, z: -14.0 }, V_west: { x: -6.3, z: -13.9 },
  V_front: { x: -2.0, z: -11.9 },
  T_door: { x: 5.0, z: -10.49 }, T_in: { x: 7.3, z: -10.49 }, T_pad: { x: 5.2, z: -8.95 }, T_south: P(3.3, -3.9), T_se: P(8.6, -3.9), T_east: P(9.6, -3.95),
  E_north: { x: 15.6, z: -9.6 }, E_booth: { x: 19.0, z: -10.8 }, E_gate: { x: 21.85, z: -12.6 }, E_corner: P(13.4, -3.6),
  E_vent: { x: 16.6, z: -13.9 },
  L_pier: P(5.0, 1.55), L_tip: { x: PIER.x1 - 0.6, z: (PIER.z0 + PIER.z1) / 2 }, L_west: P(4.6, -2.2), L_sw: { x: 9.4, z: 9.0 },
  L_south: { x: 14.6, z: 10.4 }, L_slot: { x: LAKE.island.x, z: 10.0 },
  L_east: { x: 22.4, z: 10.2 }, I_mid: { x: LAKE.island.x, z: LAKE.island.z + 0.3 },
  G_front: P(1.6, 2.7), G_west: P(-2.6, 4.6), G_side: { x: 2.9, z: 9.4 }, G_door: { x: 3.2, z: 12.15 },
  G_in: { x: 6.1, z: 12.4 },
  // o terraço da torre (cenário à parte: ligado só entre si)
  R_porta: { x: 67.2, z: -2.45 }, R_meio: { x: 69.4, z: -4.5 }, R_sul: { x: 72.4, z: -2.2 }, R_se: { x: 74.6, z: -2.2 },
  R_leste: { x: 74.3, z: -5.8 }, R_tanque: { x: 73.4, z: -7.2 }, R_centro: { x: 70.3, z: -8.6 }, R_no: { x: 67.4, z: -9.2 },
  R_oeste: { x: 65.0, z: -5.6 }, R_mirante: { x: ROOF_LOOKOUT.x, z: ROOF_LOOKOUT.z },
};
/** @type {import('../../../types').NavEdge[]} */
export const NAV_EDGES = [
  ['Q_bed', 'Q_mid'], ['Q_mid', 'Q_door'], ['Q_mid', 'Q_flap'], ['Q_door', 'Q_flap'],
  ['Q_flap', 'K_flap', { requires: 'small' }], ['Q_door', 'K_gate', { requires: 'petGateOpen' }],
  ['K_flap', 'K_gate'], ['K_gate', 'K_pedal'], ['K_flap', 'K_mid'], ['K_gate', 'K_mid'],
  ['K_gate', 'K_south'], ['K_pedal', 'K_south'], ['K_south', 'K_hall'], ['K_mid', 'K_hall'],
  // a ala sul: a porta da cozinha e o corredor (com o aspirador andando, a Radhija não entra), a despensa (no escuro, ela
  // também não), a sala de jantar, o arco, a sala de estar e a porta dos fundos (o quintal começa ali)
  ['K_hall', 'C_n', { requires: ['kitchenOpen', 'vacuumAway'] }],
  ['C_n', 'C_ban'], ['C_n', 'C_mid'], ['C_ban', 'C_mid'], ['C_ban', 'B_in'], ['C_mid', 'C_copa'],
  ['C_copa', 'D_in', { requires: 'pantryLit' }], ['D_in', 'J_copa'],
  ['J_copa', 'J_e'], ['J_copa', 'J_s'], ['J_e', 'J_n'], ['J_e', 'J_s'], ['J_n', 'J_nw'], ['J_nw', 'J_sw'], ['J_s', 'J_sw'],
  ['J_s', 'J_arco'], ['J_sw', 'J_arco'], ['J_arco', 'E_arco'],
  ['E_arco', 'E_w'], ['E_arco', 'E_tvn'], ['E_w', 'E_sw'], ['E_tvn', 'E_n'], ['E_sw', 'E_s'], ['E_n', 'E_mid'], ['E_s', 'E_mid'],
  ['E_mid', 'E_porta'], ['E_porta', 'Y_fundos', { requires: 'exitOpen' }], ['Y_fundos', 'Y_south'],
  ['Y_door', 'Y_mid'], ['Y_door', 'Y_gate'], ['Y_mid', 'Y_south'], ['Y_mid', 'Y_gate'], ['Y_door', 'Y_gap'], ['Y_gate', 'Y_gap'],
  ['Y_gap', 'C_gap', { requires: ['small', 'gapOpen'] }], ['C_gap', 'C_bolt'], ['C_gap', 'C_west'], ['C_bolt', 'C_gate'],
  ['Y_gate', 'C_gate', { requires: 'serviceOpen' }],
  ['C_gate', 'C_west'], ['C_west', 'C_far'], ['C_gate', 'P_south'], ['C_west', 'P_west'], ['C_gate', 'P_west'],
  ['P_west', 'P_nw'], ['P_nw', 'P_north'], ['P_north', 'P_ne'], ['P_ne', 'P_east'], ['P_east', 'P_se'],
  ['P_se', 'P_south'], ['P_south', 'C_gate'],
  ['P_nw', 'V_west'], ['P_north', 'V_front'], ['V_front', 'V_east'], ['V_front', 'P_ne'],
  ['V_west', 'V_mid'], ['V_mid', 'V_east'], ['V_east', 'P_ne'],
  ['P_ne', 'T_door'], ['V_east', 'T_door'], ['T_door', 'T_pad'], ['P_ne', 'T_pad'], ['T_door', 'T_in', { requires: 'towerOpen' }],
  ['P_east', 'T_south'], ['P_ne', 'T_south'], ['T_pad', 'T_south'], ['T_south', 'T_se'], ['T_se', 'E_north'], ['T_se', 'T_east'], ['T_east', 'E_north'], ['E_north', 'E_booth'],
  ['E_north', 'E_vent'], ['E_vent', 'E_booth'],
  ['E_booth', 'E_gate'], ['E_north', 'E_corner'], ['E_booth', 'E_corner'],
  ['P_east', 'L_west'], ['L_west', 'L_pier'], ['P_se', 'L_pier'], ['L_pier', 'L_tip'], ['L_pier', 'L_sw'],
  ['P_se', 'G_front'], ['G_front', 'L_sw'], ['L_sw', 'L_south'], ['G_front', 'L_south'],
  ['L_south', 'L_slot'], ['L_slot', 'L_east'], ['L_slot', 'I_mid', { requires: ['small', 'boatDocked'] }],
  ['G_front', 'G_west'], ['G_front', 'G_side'], ['G_side', 'G_door'], ['G_door', 'G_in', { requires: 'storageOpen' }],
  // o terraço da torre
  ['R_porta', 'R_meio'], ['R_porta', 'R_oeste'], ['R_meio', 'R_oeste'], ['R_meio', 'R_sul'], ['R_meio', 'R_centro'],
  ['R_sul', 'R_se'], ['R_se', 'R_leste'], ['R_leste', 'R_tanque'], ['R_tanque', 'R_centro'], ['R_centro', 'R_no'],
  ['R_centro', 'R_mirante'], ['R_no', 'R_mirante'], ['R_no', 'R_oeste'],
];

// ---------------------------------------------------------------- objetivo, câmera
/** Sem entrega: o capítulo termina pela cena do portãozinho. O GOAL fica longe, fora do caminho. */
/** @type {import('../../../types').Goal} */
export const GOAL = {
  x: HOUSE.x0 + 0.6, z: HOUSE.z1 - 0.2, r: 0.01,
  celebrate: { radhija: { x: GATE.x0 + 0.4, z: WALL.minZ + 1.6 }, rhaenyra: { x: GATE.x1 - 0.2, z: WALL.minZ + 2.1 } },
  entryPoints: [{ x: 20.4, z: -10.6 }],
};

/** O sol baixo da manhã vem do leste, um pouco do sul (sombras compridas para o oeste). */
export const SUN = { direction: [0.62, 0.48, 0.42], color: '#ffd9a8', intensity: 1.15 };

/** @type {import('../../../types').CameraConfig} */
export const CAMERA = {
  // Modo História em 3ª pessoa (src/story/camera/thirdPerson.js): atrás da dog, girando livre. offset fica para a
  // base das teclas dos testes e para os planos que não dizem de onde olham.
  rig: 'third',
  third: {
    distance: 2.8, pitch: 0.3, fov: 56, pivotY: 0.5, lookY: 0.44,
    // dentro de casa (embaixo de um teto), a câmera chega mais perto e fica mais baixa
    indoor: { distance: 2.1, pitch: 0.22 },
    heading: Math.atan2(-1.3, -4.8), // começa olhando para o norte, um pouco a oeste
    // as paredes que encurtam o braço (a lista de src/story/camera/thirdPerson.js e, no terraço da torre, a casinha da
    // escada e a caixa d'água; as muretas não: a câmera pode sair por cima delas e mostrar a queda)
    occluders: ['muro', 'casa', 'quarto', 'cozinha', 'quintal', 'torre', 'guarita', 'deposito', 'porta', 'portaozinho', 'telhado-casinha', 'telhado-caixa'],
    // tetos: dentro deles a câmera não sobe além (casa, depósito, saguão da torre, guarita, garagem)
    ceilings: [
      { minX: HOUSE.x0, maxX: HOUSE.x1, minZ: HOUSE.z0, maxZ: HOUSE.z1, y: WALLS.h },
      { minX: STORAGE.x0, maxX: STORAGE.x1, minZ: STORAGE.z0, maxZ: STORAGE.z1, y: STORAGE.h },
      { minX: TOWER.x0, maxX: TOWER.x1, minZ: TOWER.z0, maxZ: TOWER.z1, y: TOWER.h },
      { minX: BOOTH.x0, maxX: BOOTH.x1, minZ: BOOTH.z0, maxZ: BOOTH.z1, y: BOOTH.h },
      { minX: CARPORT.x0, maxX: CARPORT.x1, minZ: CARPORT.z0, maxZ: CARPORT.z1, y: CARPORT.h },
    ],
  },
  fov: 38,
  offset: [1.3, 4.4, 4.8],
  lookHeight: 0.3,
  limits: { minX: WALL.minX + 1.6, maxX: WALL.maxX - 1.4, minZ: WALL.minZ + 1.4, maxZ: LOT.z1 - 2.4 },
  zones: [],
  // (a área não tem tela de título: fica dentro do quarto, para o caso de alguma transição passar por ele)
  title: { center: { x: BED.x + 1.0, z: BED.z + 1.6 }, radius: 1.9, radiusAmp: 0.1, angle: 0.4, height: 1.3, look: { x: BED.x, y: 0.5, z: BED.z - 0.2 } },
  celebrate: { pos: [GATE.x0 - 0.2, 1.6, WALL.minZ + 4.6], look: [(GATE.x0 + GATE.x1) / 2, 0.6, WALL.minZ + 0.6] },
  victoryOffset: { pos: [1.1, 0.25, 0.7], look: [1.22, 0.14, 0] },
};

/** @type {import('../../../types').LevelLayout} */
const LAYOUT = {
  SCALE, WORLD, WALL, GATE, GATE_LEAF, STREET, WALLS, HOUSE, ROOMS, SMALL_ROOMS, DOORWAYS, PET_GATE, PET_FLAP, PET_PEDAL, WINDOW, SILL,
  BED, BOWL, WARDROBE, TOY_BASKET, RUG, DRESSER, COUNTER, FRIDGE, KITCHEN_TABLE, KITCHEN_WINDOW,
  HOUSE_EXTRAS, VACUUM, PANTRY, DINING_TABLE, DINING_CHAIRS, TABLECLOTH, COOKIE_TIN, SOFA, LIVING_WINDOW, LIVING_SILL,
  EXIT_DOOR, EXIT_LATCH, POUF, POUF_SPOT, WING,
  KITCHEN_DOOR, KITCHEN_HANDLE, FOOD_SACK, YARD, SERVICE_DOOR, BRANCH, TILES, YARD_GAP, SERVICE_BOLT, DOGHOUSE, YARD_BEDS,
  POOL, RECON, LOUNGERS, UMBRELLA, POOL_FILTER, POOL_SHOWER, POOL_POTS, SERVICE, TANKS, DRAIN, LINE, CARROT_PIN, POLE_SHOVE, DASH_POST,
  LAUNDRY, TOWER, TOWER_DOOR, INTERCOM, TOWER_LOBBY, POOL_TABLE, POOL_TOYBOX, SERVICE_WASHER, SERVICE_RACK, TOWER_GAS, TERRACE, BOOTH, ANTENNA, BOOTH_VENT, BIN, BIN_SPOT, CLIMB, LAKE, PIER,
  BOAT, CHANNEL, GOOSE, CARPORT, CAR, WHEELS, STORAGE, STORAGE_DOOR, BALL, SHELF, ROPE, STORAGE_STUFF, GARAGE_STUFF, COLLECTIBLES,
  COLLECTIBLE_PICKUP_R, WITNESSES, SOCKS, SOCK_PICKUP_R, CLUE_SPOTS, CARROT_TRAIL, TREES, TREE_TRUNK_R, BENCHES, LAMPS,
  ELECTION_POSTER, BEDS,
  ROOFTOP, CONDO_BOUNDS, LOT, HOUSE_EXIT, ROOF_HUT, ROOF_ARRIVE, ROOF_TANK, ROOF_LADDER, ROOF_CRATE, ROOF_LATCH, ROOF_PERCHES, ROOF_ANTENNA, ROOF_LINE,
  ROOF_AC, ROOF_BARROW, ROOF_BOXES, ROOF_POTS, ROOF_STEP, ROOF_LOOKOUT, ROOF_FEATHERS,
  DOGS: {
    radhija: withStart('radhija', { x: BED.x + 1.0, z: BED.z + 1.4, yaw: 1.9 }),
    rhaenyra: withStart('rhaenyra', { x: BED.x + 1.9, z: BED.z + 1.75, yaw: -1.4 }),
  },
  STATIC_COLLIDERS, COLLISION_GRID: 4, NAV_NODES, NAV_EDGES, GOAL, SUN, CAMERA,
};
export default LAYOUT;
