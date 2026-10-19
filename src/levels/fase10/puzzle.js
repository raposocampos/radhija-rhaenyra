// Festa no Quintal · puzzle. Tudo avança por dt (pausa congela a água, o balde, o pombo, a gansa, a piñata e as subidas).
//   BOLO: cinco enfeites, de baixo para cima, na ordem do quadro da sala (CAKE_ORDER: laço, biscoito de osso, vela do 3,
//     chapéu e estrela). Quem chega na mesa com um enfeite na boca o põe no próximo lugar; fora de ordem, ele balança e
//     cai ao lado da mesa.
//   CHAPÉU: barquinho no meio da piscininha vazia. Caixote fora da mangueira + torneira aberta (impulso) = a água sobe
//     e o barquinho boia; com energia (disjuntor da cozinha, impulso) o ventilador o leva até a borda.
//   LAÇO: portãozinho (latido distrai a Dona Gansa, a outra puxa a cordinha); pombo dormindo em cima do laço (superbafo
//     pelo cano); balde deitado (a Radhija entra, a Rhaenyra puxa a corda); no deque a Radhija desamarra e escorrega.
//   BISCOITO: no pote em cima do gaveteiro da despensa. A Rhaenyra puxa as gavetas (E, andando para trás) até virarem
//     degraus; puxada demais, a gaveta cai (E encaixa de volta). A Radhija sobe por elas (E) e pega o biscoito.
//   VELA DO 3: horta (a Rhaenyra pula a cerca; a Radhija pelo vão e na lama: Lambe-Lambe); dois botões altos no galpão
//     (impulso): um abre a porta e o outro o chiqueiro (sorteado); os porcos soltos atrapalham e os legumes do campinho
//     os distraem por um tempo; lá dentro, a rampa só com arrancada.
//   ESTRELA: dentro da piñata, em cima da roseira. O superbafo a faz balançar para fora; a Rhaenyra pula e bate quando
//     ela passa por cima; três batidas e ela abre.
//   Nada trava: o enfeite errado volta para o chão, o balde desce sozinho, a gaveta caída volta, o legume rebrota.
import { createCarryItem, createCollectibles, createHints, reach, deliveredAt } from '../../game/puzzleKit.js';
import {
  createDogEffects, createPushCrate, createWallButton, createHingedGate, createGooseNPC, createMud,
} from '../../game/mechanics/index.js';
import { createGoose } from '../../characters/goose.js';
import { airborne, wallKick } from '../../game/dogController.js';
import {
  WALL_LK, HOUSE, BREAKER, PAINTING, CAKE, CAKE_ORDER, CAKE_REJECT, GOAL, POOL, BOAT, TAP, HOSE, CRATE, BACK_FENCE, GATE,
  CORD, GOOSE, PIGEON, TUBE, BUCKET, ROPE, TREE, DECK, DECK_RAIL, HUT, DECK_PROPS, DECK_PATH, SLIDE, HORTA, MUD, SHED,
  RAMP, RAMP_ENTRY, RAMP_TIMES, CANDLE, RIBBON, COLLECTIBLES, COLLECTIBLE_PICKUP_R, PANTRY, DRAWERS, PLANTATION, ROSE_BUSH,
  PINATA, SHED_BUTTONS, STY, SECRET, EAST_WALL,
} from './layout.js';

/**
 * @typedef {'start'|'cake1'|'cake2'|'cake3'|'cake4'|'done'} Stage
 * @typedef {'hat'|'ribbon'|'candle'|'cookie'|'star'} Thing
 * @typedef {'home'|'carried'|'floor'|'cake'} Place
 */
/** @type {Stage[]} */
export const STAGES = ['start', 'cake1', 'cake2', 'cake3', 'cake4', 'done'];
/** @type {Thing[]} */
const THINGS = ['hat', 'ribbon', 'candle', 'cookie', 'star'];
const NOUN = { hat: 'o chapeuzinho', ribbon: 'o laço', candle: 'a vela do 3', cookie: 'o biscoito de osso', star: 'a estrela' };

export const TEXT = {
  objective: {
    // bolo
    carryNext: 'Leve {item} até o bolo da varanda',
    carryCheck: 'Leve {item} até o bolo (a ordem certa está no quadro da sala)',
    lookPainting: 'O bolo tem de ficar igual ao do ano passado: olhe o quadro da sala (E na frente dele)',
    otherCarry: 'A irmã está com {item}: troque (Q) e leve até o bolo',
    pickFloor: 'Pegue {item} no chão (E)',
    // chapéu
    crateRh: 'O caixote de brinquedos esmaga a mangueira: empurre o caixote (segure Shift)',
    crateRad: 'O caixote esmaga a mangueira da piscininha: a Rhaenyra empurra (Q)',
    tapRh: 'Abra a torneira no alto da parede da casa: impulso nas patinhas (Espaço)',
    tapRad: 'A torneira fica no alto da parede: a Rhaenyra alcança com o impulso (Q)',
    filling: 'A água corre: a piscininha está enchendo e o barquinho vai boiar…',
    powerRh: 'O barquinho está no meio da piscininha: ligue o disjuntor da cozinha para o ventilador soprar (Espaço)',
    powerRad: 'O ventilador está sem energia: a Rhaenyra liga o disjuntor da cozinha (Q)',
    drifting: 'O vento leva o barquinho até a borda…',
    grabHat: 'Pegue o chapeuzinho na borda da piscininha (E)',
    // laço
    gateLure: 'A Dona Gansa guarda o portãozinho: lata de longe (E) para ela ir ver e puxe a cordinha',
    gateCord: 'A gansa saiu de perto: puxe a cordinha do portãozinho (E)',
    pigeonRad: 'O pombo cochila em cima do laço: solte o superbafo no funil do cano de brinquedo (segure R e solte)',
    pigeonRh: 'O pombo só sai com o superbafo da Radhija no funil do cano (Q)',
    bucketRad: 'Entre no balde do elevador (E)',
    bucketRh: 'A Radhija entra no balde (Q); depois você puxa a corda',
    ropeRh: 'Pegue a ponta da corda, do lado do balde (E), e puxe andando para o portão',
    ropeRad: 'A Rhaenyra puxa a corda do balde (Q)',
    pullRh: 'Puxe até o balde chegar lá em cima (ande para longe do balde, para o portão)',
    untieRad: 'No deque: ande até o laço no corrimão e desamarre (E)',
    slideRad: 'Desça com o laço: o escorregador fica do lado da casinha (E na boca dele)',
    upRh: 'A Radhija está no deque: troque (Q) e desamarre o laço',
    // vela
    hortaRh: 'A vela está no galpão, atrás da horta: pule a cerca baixa (Espaço)',
    hortaRad: 'A vela está no galpão: entre na horta pelo vão da tábua quebrada',
    lickRh: 'A Radhija está enlameada: faça o Lambe-Lambe nela (R pertinho dela)',
    muddyRad: 'Enlameada, sem arrancada: a Rhaenyra limpa você com o Lambe-Lambe (Q)',
    buttonsRh: 'A porta do galpão abre com um dos botões altos da parede dele: impulso nas patinhas (Espaço)',
    buttonsRad: 'Os botões do galpão são altos: a Rhaenyra alcança com o impulso (Q)',
    pigsRh: 'Os porcos fugiram e atrapalham: traga legumes do campinho e largue perto deles (E)',
    pigsRad: 'Os porcos fugiram e atrapalham: traga legumes do campinho e largue perto deles (E)',
    // biscoito
    cookieRh: 'O biscoito de osso está em cima do gaveteiro da despensa: puxe as gavetas (E e ande para trás) até virarem degraus',
    cookieRad: 'O biscoito está em cima do gaveteiro da despensa: a Rhaenyra puxa as gavetas (Q) e você sobe por elas',
    climbRad: 'As gavetas viraram degraus: suba por elas até o pote (E na frente do gaveteiro)',
    climbRh: 'As gavetas viraram degraus: troque para a Radhija (Q), ela sobe por elas',
    drawerFallenRh: 'Uma gaveta caiu: encaixe de volta (E nela)',
    // estrela
    starRad: 'A estrela está na piñata, em cima da roseira: solte o superbafo nela para ela balançar (segure R e solte)',
    starRh: 'A estrela está na piñata, em cima da roseira: quando ela balançar para fora, pule e bata nela (Espaço)',
    starSwingRh: 'A piñata está balançando: pule e bata nela quando ela passar por cima de você (Espaço)',
    rampRad: 'A vela está no alto: suba a rampa de tábua com uma arrancada (segure Shift)',
    rampRh: 'A Radhija sobe a rampa com uma arrancada (Q)',
  },
  hint: {
    painting: 'A festa do ano passado! Repare em como o bolo estava enfeitado, de baixo para cima.',
    wrongOrder: 'Opa, caiu! No ano passado o bolo não era assim… o quadro da sala mostra a ordem.',
    wrongOrder2: 'Ainda não. Olhe o quadro de perto (E na frente dele): cada enfeite tem o seu andar.',
    rightOrder: 'Isso! Igualzinho ao do ano passado.',
    cakeDone: 'O bolo está pronto!',
    hoseBlocked: 'A torneira está aberta, mas a água não passa: o caixote esmaga a mangueira.',
    tapOpen: 'A água corre pela mangueira!',
    poolFull: 'A piscininha encheu: o barquinho está boiando!',
    boatFar: 'O barquinho está no meio, longe da borda. Um vento ajudava…',
    noPower: 'O ventilador está sem energia: o disjuntor fica na cozinha, no alto da divisória.',
    powerOn: 'Luz! As luzinhas da festa acenderam e o ventilador ligou.',
    docked: 'O barquinho chegou na borda!',
    poolDeep: 'A piscininha está vazia e funda: o barquinho está no meio, fora de alcance.',
    gooseCharge: 'Ai! A Dona Gansa não deixa ninguém chegar perto do portão. Um latido de longe distrai ela.',
    gooseGuard: 'A Dona Gansa não sai de perto da cordinha! Um latido de longe distrai ela.',
    gooseAway: 'A gansa foi ver o latido! Agora a outra dog puxa a cordinha.',
    gateOpen: 'Destravou: o portãozinho do fundo abriu!',
    pigeonBark: 'O pombo nem se mexe com latido…',
    pigeonHigh: 'O cheiro fica aqui embaixo e não chega no pombo. O funil do cano de brinquedo leva até ele…',
    pigeonGone: 'O pombo voou embora!',
    pigeonDeck: 'O pombo acordou e não deixa ninguém subir: bate as asas em cima do laço! Primeiro espante ele com o superbafo pelo cano.',
    pigeonSeen: 'Olha lá em cima: o laço está no corrimão da casa na árvore… e tem um pombo dormindo em cima dele!',
    deckArrive: 'No deque! Desamarre o laço (E). Para descer: o escorregador ou o balde.',
    deckHold: 'Daqui de cima não dá para largar o laço: desça pelo escorregador (E na boca dele).',
    bucketHeavy: 'A Rhaenyra é pesada demais para o balde: ela puxa a corda.',
    ropeLight: 'A Radhija é leve demais para puxar o balde: ela vai dentro dele.',
    ropeTip: 'Ande para longe do balde com a corda na boca: ele sobe. Ela continua segurando quando você trocar.',
    ropeEnd: 'A corda acabou: o balde está lá em cima.',
    ropeDrop: 'Soltou a corda: o balde desce devagar.',
    inBucket: 'Dentro do balde! Agora a Rhaenyra puxa a corda (Q).',
    gotRibbon: 'Desamarrou o laço!',
    gotHat: 'Pegou o chapeuzinho!',
    gotCandle: 'Pegou a vela do 3!',
    mouthFull: 'A boca já está ocupada!',
    mud: 'Lama! Agora a Radhija está lenta e sem arrancada.',
    clean: 'Limpinha de novo!',
    licking: 'Lambe-Lambe! Mais um pouco…',
    alreadyClean: 'Ela já está limpinha.',
    lickFar: 'Chegue pertinho da Radhija para o Lambe-Lambe.',
    noDash: 'Enlameada, a Radhija não consegue dar arrancada.',
    doorOpen: 'A porta do galpão subiu!',
    doorButton: 'Esse botão abriu a porta do galpão!',
    styButton: 'Ops! Esse botão abriu o chiqueiro: os porcos fugiram!',
    pigsBlock: 'Os porcos não deixam passar! Legumes do campinho distraem eles por um tempo.',
    pigsEat: 'Os porcos foram comer: aproveita!',
    pigsBack: 'Acabou a comida: os porcos voltaram a atrapalhar.',
    vegPick: 'Pegou um legume: leve até os porcos e largue perto deles (E).',
    drawerPull: 'Ande para trás com o puxador na boca: a gaveta desliza. E de novo solta.',
    drawerFall: 'Puxou demais: a gaveta caiu! Encaixe de volta (E nela).',
    drawerHeavy: 'As gavetas aguentam só a Radhija: a Rhaenyra puxa e a irmã sobe.',
    step0: 'A gaveta de baixo precisa sair bem para fora: ela é o primeiro degrau.',
    step1Low: 'A gaveta do meio precisa sair um pouco para virar degrau.',
    step1High: 'A gaveta do meio saiu demais: tem que ficar mais para dentro que a de baixo, como uma escada.',
    step2Low: 'A gaveta de cima precisa sair só um pouquinho.',
    step2High: 'A gaveta de cima saiu demais: tem que ficar mais para dentro que a do meio.',
    gotCookie: 'Pegou o biscoito de osso!',
    gotStar: 'Pegou a estrela!',
    pinataSwing: 'A piñata balançou! A Rhaenyra bate quando ela passar por cima dela.',
    pinataHit: 'Pá! Mais uma…',
    pinataOpen: 'A piñata abriu: caíram balas e a estrela!',
    pinataThorns: 'A roseira tem espinhos, e a piñata está bem em cima dela. Um vento forte a faria balançar…',
    pinataJumpRad: 'Alto demais para a Radhija: a Rhaenyra pula e bate na piñata (Q).',
    rampSlip: 'Andando, a tábua é íngreme demais: a Radhija escorrega. Uma arrancada leva lá em cima!',
    rampMud: 'Enlameada, sem arrancada, a Radhija escorrega na tábua. Primeiro o Lambe-Lambe!',
    rampRh: 'A tábua é estreita demais para a Rhaenyra.',
    fenceRad: 'A cerca é alta para a Radhija pular: tem um vão na tábua quebrada.',
    gapRh: 'O vão da tábua quebrada é estreito demais para a Rhaenyra: ela pula a cerca baixa (Espaço).',
    shift: 'Segure Shift para empurrar.',
    heavy: 'Pesado demais para a Radhija: a Rhaenyra empurra (Q, segure Shift).',
    wallRadhija: 'Alto demais para a Radhija! A Rhaenyra pega impulso nas patinhas da parede (Q).',
  },
  prompt: {
    hat: 'Pegar o chapeuzinho', pick: 'Pegar', drop: 'Largar', cord: 'Puxar a cordinha', rope: 'Pegar a corda',
    ropeDrop: 'Soltar a corda', bucket: 'Entrar no balde', bucketOut: 'Sair do balde', painting: 'Olhar o quadro',
    wall: 'Impulso na parede', untie: 'Desamarrar o laço', slide: 'Escorregar', bucketBack: 'Voltar para o balde',
    drawerGrab: 'Puxar a gaveta', drawerRelease: 'Soltar a gaveta', drawerFix: 'Encaixar a gaveta', climb: 'Subir pelas gavetas',
    pickVeg: 'Colher', dropVeg: 'Largar', board: 'Empurrar a tábua',
  },
};

const clamp01 = (k) => Math.min(1, Math.max(0, k));
const smooth = (k) => { const x = clamp01(k); return x * x * (3 - 2 * x); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const EAST = Math.PI / 2;
const NORTH = Math.PI;
const fill = (s, item) => s.replace('{item}', NOUN[item]);
/** @param {import('../../types').DogName} n @returns {import('../../types').DogName} */
const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');

/** Distância de (x, z) até a polilinha. */
function distToPolyline(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const abx = b.x - a.x, abz = b.z - a.z;
    const t = clamp01(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1));
    best = Math.min(best, Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)));
  }
  return best;
}

/** @param {import('../../types').PuzzleContext<import('../../types').Fase10Props>} ctx @returns {import('../../types').Puzzle} */
export function createPuzzle(ctx) {
  const { props, dogs, ctrls, root, emit, world, place, scent, cam } = ctx;
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const effects = createDogEffects({ world, dogs });
  const mud = createMud({ dogs, emit, effects, licksToClean: MUD.licksToClean, slow: MUD.slow });
  const breaker = createWallButton({ id: 'disjuntor', cfg: BREAKER, emit, prop: props.breaker });
  const tap = createWallButton({ id: 'torneira', cfg: TAP, emit, prop: props.tap });
  const shedButtons = SHED_BUTTONS.map((cfg, i) => createWallButton({ id: `botao-galpao-${i + 1}`, cfg, emit, prop: props.shedButtons[i] }));
  const levers = [breaker, tap, ...shedButtons];
  const crate = createPushCrate({ id: 'caixote', cfg: CRATE, world, emit, prop: props.crate });
  const gate = createHingedGate({ id: 'portaozinho', cfg: GATE, world, prop: props.gate, thickness: 0.06 });
  const goose = createGooseNPC({ cfg: GOOSE, world, nav: ctx.nav, root, emit, effects, createGoose });
  const items = {
    hat: createCarryItem({ obj: props.hat.object, dogs, scene: root, name: 'hat' }),
    ribbon: createCarryItem({ obj: props.ribbon.object, dogs, scene: root, name: 'ribbon' }),
    candle: createCarryItem({ obj: props.candle.object, dogs, scene: root, name: 'candle' }),
    cookie: createCarryItem({ obj: props.cookie.object, dogs, scene: root, name: 'cookie' }),
    star: createCarryItem({ obj: props.star.object, dogs, scene: root, name: 'star' }),
  };
  const handle = createCarryItem({ obj: props.rope.handle, dogs, scene: root, name: 'rope', carrier: 'large' });
  // a porta basculante fechada é uma parede; o balde no chão é sólido para a Rhaenyra
  const doorCol = world.addDynamic({ id: 'porta-do-galpao', kind: 'gate', shape: 'box', x: SHED.x0, z: (SHED.door.z0 + SHED.door.z1) / 2, hx: SHED.t / 2, hz: (SHED.door.z1 - SHED.door.z0) / 2 });
  const bucketCol = world.addDynamic({ id: 'balde', kind: 'prop', shape: 'circle', x: BUCKET.x, z: BUCKET.z, r: BUCKET.r, blocks: 'large' });
  // as gavetas para fora (e as caídas) ocupam a frente do gaveteiro; a porteira fechada; a tábua do muro
  const D_FRONT = DRAWERS.z + DRAWERS.hz;
  const drawersCol = world.addDynamic({ id: 'gavetas', kind: 'prop', shape: 'box', x: DRAWERS.x, z: D_FRONT + 0.1, hx: DRAWERS.hx - 0.05, hz: 0.1 });
  const styGateCol = world.addDynamic({ id: 'porteira', kind: 'gate', shape: 'box', x: STY.x0, z: (STY.gate.z0 + STY.gate.z1) / 2, hx: 0.05, hz: (STY.gate.z1 - STY.gate.z0) / 2 });
  const boardCol = world.addDynamic({ id: 'tabua-solta', kind: 'gate', shape: 'box', x: EAST_WALL.x, z: (SECRET.board.z0 + SECRET.board.z1) / 2, hx: 0.07, hz: (SECRET.board.z1 - SECRET.board.z0) / 2 });
  /** Os porcos (o personagem e o comportamento chegam no PR dos porcos): por enquanto, nenhum sai do chiqueiro. */
  const pigs = { release() {}, addFood(f) { void f; return null; }, update(dt, C) { void dt; void C; }, reset() {}, info: () => ({ out: false }), get pestering() { return false; } };
  /** Qual botão do galpão abre a porta (o outro abre o chiqueiro): ?botao=1|2 fixa; sem isso, sorteia a cada partida. */
  const pickDoorButton = () => {
    const q = ctx.params?.get?.('botao');
    if (q === '1' || q === '2') return Number(q) - 1;
    return Math.random() < 0.5 ? 0 : 1;
  };
  const fresh = () => ({
    done: false, disposed: false, objKey: '',
    /** @type {Record<Thing, Place>} */ place: { hat: /** @type {Place} */ ('home'), ribbon: /** @type {Place} */ ('home'), candle: /** @type {Place} */ ('home'), cookie: /** @type {Place} */ ('home'), star: /** @type {Place} */ ('home') },
    /** @type {Record<Thing, { x: number, z: number }>} */ floor: { hat: { x: 0, z: 0 }, ribbon: { x: 0, z: 0 }, candle: { x: 0, z: 0 }, cookie: { x: 0, z: 0 }, star: { x: 0, z: 0 } },
    /** @type {Thing[]} */ cake: [],
    wrong: 0, lookedPainting: false,
    /** quem pegou o enfeite perto da mesa só entrega depois de se afastar */
    /** @type {Record<Thing, boolean>} */ rearm: { hat: false, ribbon: false, candle: false, cookie: false, star: false },
    /** @type {null | { thing: Thing, t: number, tier: number, x: number, z: number }} */ reject: null,
    water: 0, flowing: false, wasFlowing: false, full: false, flowT: 0, boatX: BOAT.start.x, boatZ: BOAT.start.z, docked: false,
    cordT: -1, /** @type {string | null} */ cordWho: null, gateOpen: false,
    /** @type {'asleep'|'flying'|'gone'} */ pigeon: /** @type {'asleep'|'flying'|'gone'} */ ('asleep'), pigeonT: 0,
    pulled: 0, bucketY: 0, riding: false, ropeEnd: false, topUsed: false, topBlocked: false, peckT: 0,
    /** a Radhija lá em cima, andando livre pelo deque */
    onDeck: false, sawPigeon: false,
    /** pulinho para dentro ou para fora do balde */
    /** @type {null | { t: number, dur: number, a: { x: number, y: number, z: number }, b: { x: number, y: number, z: number }, then: 'ride' | 'free', via?: { x: number, y: number, z: number }, lift?: number, yaw?: number | null, speed?: number, act?: string, action?: string, slope?: number }} */
    hop: null, bucketTilt: 1,
    /** @type {null | { phase: string, t: number, x0: number, z0: number, y0: number, yaw0: number, grabbed: boolean, action?: string, slope?: number }} */
    deck: null, // pose roteirizada no deque (subir do balde, desamarrar, escorregar, voltar para o balde)
    /** @type {null | { phase: string, t: number, x0: number, z0: number, yaw0: number, grabbed: boolean, reason?: string, action?: string, slope?: number }} */
    ramp: null,
    doorT: 0, wasDoor: false, dashRecent: { radhija: 0, rhaenyra: 0 }, slipCd: 0,
    introT: 0, /** @type {import('../../types').DogName} */ prevActive: /** @type {import('../../types').DogName} */ ('radhija'),
    scriptDt: 1 / 60, wasPower: false, /** @type {string} */ powerStage: 'off',
    // galpão: qual botão abre a porta, a porta e o chiqueiro abertos
    doorBtn: pickDoorButton(), shedOpen: false, styOpen: false, styT: 0,
    // gaveteiro: quanto cada gaveta está para fora, a que a Rhaenyra segura e a subida da Radhija
    drawers: DRAWERS.y.map(() => ({ ext: 0, fallen: false })),
    /** @type {null | { i: number, who: import('../../types').DogName, g: number }} */ drawerHold: null,
    /** @type {null | { path: { x: number, y: number, z: number }[], i: number, t: number, phase: string, reason: string | null, grabbed: boolean, action?: string, slope?: number }} */ climb: null,
    // piñata: ângulos e velocidades do balanço, batidas
    pin: { ax: 0, az: 0, vx: 0, vz: 0, hits: 0, broken: false, cd: 0, swingHint: false, /** @type {Set<number>} */ used: new Set() },
    // legumes: o que cada uma carrega, os largados no chão e os pés esperando rebrotar
    veg: { /** @type {Record<string, any>} */ held: { radhija: null, rhaenyra: null }, /** @type {any[]} */ floor: [], /** @type {Record<string, number>} */ regrow: {}, n: 0 },
    // o cantinho atrás do muro
    secretReady: false, secretOpen: false, secretSeen: false, boardT: 0,
  });
  const S = fresh();
  let introDone = false;
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  let lastStage = /** @type {Stage} */ ('start');
  const at = (x, z, y = 0.7) => ({ x, y, z });
  const power = () => breaker.on;
  const crateOnHose = () => distToPolyline(HOSE, crate.x, crate.z) < CRATE.blockR;
  const inRect = (r, x, z) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
  const inHorta = (c) => c.x > HORTA.x0 && c.x < HORTA.x1 && c.z > HORTA.z0 && c.z < HORTA.z1;
  const inShed = (c) => c.x > SHED.x0 + 0.05 && c.x < SHED.x1 && c.z > SHED.z0 && c.z < SHED.z1;
  const inBack = (c) => c.x > BACK_FENCE.x;
  const inHouse = (c) => c.x < HOUSE.x1 && c.z < HOUSE.zS;
  const inPantry = (c) => c.x > PANTRY.x0 && c.x < PANTRY.x1 && c.z > PANTRY.zN && c.z < PANTRY.zS;
  const nearPinata = (c) => Math.hypot(c.x - ROSE_BUSH.x, c.z - ROSE_BUSH.z) < 3.2;
  const inDoorway = (c) => Math.abs(c.x - SHED.x0) < 0.4 && c.z > SHED.door.z0 - 0.05 && c.z < SHED.door.z1 + 0.05;
  const doorOpen = () => S.doorT > 0.7;
  const nextThing = () => /** @type {Thing | undefined} */ (CAKE_ORDER[S.cake.length]);
  const carriedBy = (name) => THINGS.find((t) => items[t].holder === name) || null;
  const mouthFree = (name) => !carriedBy(name) && handle.holder !== name && !S.veg.held[name] && S.drawerHold?.who !== name;
  const pigeonAround = () => S.pigeon === 'asleep';
  /** A gansa de guarda: perto da cordinha e sem nada que a distraia (latido). */
  const guarding = () => !S.gateOpen && goose.state !== 'lured' && goose.state !== 'curious' && Math.hypot(goose.x - CORD.x, goose.z - CORD.z) < 2.3;

  // ------------------------------------------------------------------ etapa
  /** @returns {Stage} */
  function stage() {
    if (S.done || S.cake.length >= CAKE_ORDER.length) return 'done';
    return S.cake.length ? /** @type {Stage} */ (`cake${S.cake.length}`) : 'start';
  }
  function notifyStage() {
    const st = stage();
    if (st !== lastStage) { lastStage = st; onStageChange(st); }
  }

  // ------------------------------------------------------------------ objetivo
  function hatStep(name) {
    const O = TEXT.objective;
    const rh = name === 'rhaenyra';
    if (S.place.hat === 'floor') return { text: fill(O.pickFloor, 'hat'), target: at(S.floor.hat.x, S.floor.hat.z, 0.3) };
    if (!S.full) {
      if (crateOnHose()) return { text: rh ? O.crateRh : O.crateRad, target: at(crate.x, crate.z, 0.8) };
      if (!tap.on) return { text: rh ? O.tapRh : O.tapRad, target: tap.target(0.3) };
      return { text: O.filling, target: at(POOL.x, POOL.z, 0.6) };
    }
    if (!S.docked) {
      if (!power()) return { text: rh ? O.powerRh : O.powerRad, target: breaker.target(0.3) };
      return { text: O.drifting, target: at(S.boatX, S.boatZ, 0.6) };
    }
    return { text: O.grabHat, target: at(BOAT.dock.x, BOAT.dock.z, 0.6) };
  }
  function ribbonStep(name) {
    const O = TEXT.objective;
    const rad = name === 'radhija';
    if (S.place.ribbon === 'floor') return { text: fill(O.pickFloor, 'ribbon'), target: at(S.floor.ribbon.x, S.floor.ribbon.z, 0.3) };
    if (!S.gateOpen) {
      const away = goose.state === 'lured' || goose.state === 'curious' || goose.isAway();
      return away ? { text: O.gateCord, target: at(CORD.x, CORD.z, CORD.top) } : { text: O.gateLure, target: at(goose.x, goose.z, 0.9) };
    }
    if (pigeonAround()) return rad ? { text: O.pigeonRad, target: at(TUBE.inlet.x, TUBE.inlet.z, TUBE.funnelY + 0.2) } : { text: O.pigeonRh, target: at(PIGEON.x, PIGEON.z, PIGEON.y + 0.3) };
    if (S.onDeck || (S.deck && S.deck.phase !== 'slide' && S.deck.phase !== 'runout')) return { text: rad ? O.untieRad : O.upRh, target: at(RIBBON.x, RIBBON.z, RIBBON.y + 0.3) };
    if (!S.riding) return rad ? { text: O.bucketRad, target: at(BUCKET.x, BUCKET.z, S.bucketY + 0.5) } : { text: O.bucketRh, target: at(BUCKET.x, BUCKET.z, S.bucketY + 0.5) };
    if (handle.holder !== 'rhaenyra') return rad ? { text: O.ropeRad, target: at(ROPE.rest.x, ROPE.rest.z, 0.3) } : { text: O.ropeRh, target: at(ROPE.rest.x, ROPE.rest.z, 0.3) };
    return { text: rad ? O.ropeRad : O.pullRh, target: at(BUCKET.x, BUCKET.z, S.bucketY + 0.6) };
  }
  function candleStep(name) {
    const O = TEXT.objective;
    const rh = ctrls.rhaenyra;
    const rad = ctrls.radhija;
    if (S.place.candle === 'floor') return { text: fill(O.pickFloor, 'candle'), target: at(S.floor.candle.x, S.floor.candle.z, 0.3) };
    if (!S.gateOpen) return ribbonStep(name);
    if (!inHorta(rad) && !inShed(rad)) return name === 'radhija' ? { text: O.hortaRad, target: at(HORTA.x0, (HORTA.gap.z0 + HORTA.gap.z1) / 2, 0.3) } : { text: O.hortaRh, target: at((HORTA.x0 + HORTA.x1) / 2, HORTA.z0, 0.5) };
    if (mud.muddy('radhija')) return name === 'rhaenyra' ? { text: inHorta(rh) ? O.lickRh : O.hortaRh, target: inHorta(rh) ? at(rad.x, rad.z, 0.6) : at((HORTA.x0 + HORTA.x1) / 2, HORTA.z0, 0.5) } : { text: O.muddyRad, target: at(rh.x, rh.z, 0.9) };
    if (!S.shedOpen) {
      const btn = shedButtons.find((b) => !b.on) || shedButtons[0];
      return name === 'rhaenyra' ? { text: inHorta(rh) ? O.buttonsRh : O.hortaRh, target: btn.target(0.3) } : { text: O.buttonsRad, target: btn.target(0.3) };
    }
    if (pigs.pestering) return { text: name === 'rhaenyra' ? O.pigsRh : O.pigsRad, target: at((PLANTATION.x0 + PLANTATION.x1) / 2, PLANTATION.z0, 0.6) };
    if (name === 'rhaenyra') return { text: O.rampRh, target: at(CANDLE.x, CANDLE.z, CANDLE.y + 0.3) };
    return { text: O.rampRad, target: at(RAMP.x0, RAMP.z, 0.3) };
  }
  function cookieStep(name) {
    const O = TEXT.objective;
    if (S.place.cookie === 'floor') return { text: fill(O.pickFloor, 'cookie'), target: at(S.floor.cookie.x, S.floor.cookie.z, 0.3) };
    const cab = at(DRAWERS.x, D_FRONT + 0.2, DRAWERS.top + 0.3);
    const fallen = S.drawers.findIndex((d) => d.fallen);
    if (fallen >= 0) return { text: name === 'rhaenyra' ? O.drawerFallenRh : O.cookieRad, target: at(DRAWERS.x, D_FRONT + 0.45, 0.4) };
    if (stairsReady()) return { text: name === 'radhija' ? O.climbRad : O.climbRh, target: cab };
    const next = nextDrawer();
    return name === 'rhaenyra' ? { text: O.cookieRh, target: at(DRAWERS.x, D_FRONT + S.drawers[next].ext + 0.05, DRAWERS.y[next] - 0.1) } : { text: O.cookieRad, target: cab };
  }
  function starStep(name) {
    const O = TEXT.objective;
    if (S.place.star === 'floor') return { text: fill(O.pickFloor, 'star'), target: at(S.floor.star.x, S.floor.star.z, 0.3) };
    const p = pinataPos();
    const swinging = Math.hypot(S.pin.ax, S.pin.az) > 0.12;
    if (name === 'radhija') return { text: O.starRad, target: at(p.x, p.z, p.y + 0.2) };
    return { text: swinging ? O.starSwingRh : O.starRh, target: at(p.x, p.z, p.y + 0.2) };
  }
  /** @param {import('../../types').DogName} activeName */
  function objective(activeName) {
    const O = TEXT.objective;
    const st = stage();
    if (st === 'done') return { text: null, target: null, stage: st };
    const cakeAt = at(CAKE.x, CAKE.z, CAKE.base + 0.5);
    const mine = carriedBy(activeName);
    // lá no deque com o enfeite: descer pelo escorregador
    if (mine && activeName === 'radhija' && S.onDeck) return { text: O.slideRad, target: at(SLIDE.x, SLIDE.z0, DECK.h + 0.4), stage: st };
    // o mesmo texto para qualquer enfeite (o objetivo não entrega a ordem: ela está no quadro)
    if (mine) return { text: fill(S.lookedPainting ? O.carryNext : O.carryCheck, mine), target: cakeAt, stage: st };
    const c = ctrls[activeName];
    // depois de errar a ordem, o quadro da sala vem primeiro (até alguém olhar de perto)
    if (S.wrong > 0 && !S.lookedPainting) return { text: O.lookPainting, target: at(PAINTING.x, PAINTING.z + 0.1, PAINTING.y), stage: st };
    const pending = THINGS.filter((t) => S.place[t] !== 'cake');
    const homeLeft = pending.filter((t) => S.place[t] === 'home');
    const floorLeft = pending.filter((t) => S.place[t] === 'floor' && !(S.reject && S.reject.thing === t));
    const otherHas = pending.find((t) => S.place[t] === 'carried');
    if (!homeLeft.length) {
      if (floorLeft.length) {
        const t = floorLeft[0];
        return { text: fill(O.pickFloor, t), target: at(S.floor[t].x, S.floor[t].z, 0.3), stage: st };
      }
      if (otherHas) return { text: fill(O.otherCarry, otherHas), target: at(ctrls[other(activeName)].x, ctrls[other(activeName)].z, 0.9), stage: st };
      return { text: null, target: cakeAt, stage: st };
    }
    // pelo lugar: no fundo, o laço (ao norte) ou a vela (ao sul); no resto, o chapéu
    let pick = homeLeft[0];
    if (inBack(c)) pick = homeLeft.includes('candle') && (c.z > -0.6 || !homeLeft.includes('ribbon')) ? 'candle' : homeLeft.includes('ribbon') ? 'ribbon' : homeLeft[0];
    else if ((inHouse(c) || inPantry(c)) && homeLeft.includes('cookie')) pick = 'cookie';
    else if (nearPinata(c) && homeLeft.includes('star')) pick = 'star';
    else if (homeLeft.includes('hat')) pick = 'hat';
    // a Radhija no balde ou lá no deque: o objetivo continua sendo o laço (para as duas)
    if ((S.riding || S.onDeck || S.deck) && homeLeft.includes('ribbon')) pick = 'ribbon';
    const step = pick === 'hat' ? hatStep(activeName) : pick === 'ribbon' ? ribbonStep(activeName) : pick === 'cookie' ? cookieStep(activeName) : pick === 'star' ? starStep(activeName) : candleStep(activeName);
    return { ...step, stage: st };
  }

  // ------------------------------------------------------------------ itens e bolo
  function take(thing, c) {
    if (thing === 'hat') props.hat.setOnBoat(false);
    items[thing].attach(c.name);
    props[thing].setHighlight(false);
    S.place[thing] = 'carried';
    S.rearm[thing] = Math.hypot(c.x - GOAL.x, c.z - GOAL.z) < GOAL.r + 0.25;
    emit('item:pickup', { name: c.name, item: thing, x: c.x, z: c.z });
    hints.now({ hat: 'gotHat', ribbon: 'gotRibbon', candle: 'gotCandle', cookie: 'gotCookie', star: 'gotStar' }[thing], 2.8, 0);
    notifyStage();
  }
  function dropThing(thing, c) {
    const x = c.x + Math.sin(c.yaw) * 0.32;
    const z = c.z + Math.cos(c.yaw) * 0.32;
    const res = world.resolve(x, z, 0.1, 'small');
    items[thing].drop(res.x, res.z, 0);
    S.place[thing] = 'floor';
    S.floor[thing] = { x: res.x, z: res.z };
    emit('item:drop', { name: c.name, item: thing, x: res.x, z: res.z });
    notifyStage();
  }
  /** O enfeite chega no bolo: no andar certo ele fica; fora de ordem, balança e cai ao lado da mesa. */
  function deliver(thing, who) {
    const tier = S.cake.length;
    const ok = thing === CAKE_ORDER[tier];
    items[thing].returnHome();
    if (ok) {
      props.cake.place(thing, tier);
      S.cake.push(thing);
      S.place[thing] = 'cake';
      emit('cake:place', { item: thing, tier, x: CAKE.x, z: CAKE.z });
      hints.now(S.cake.length >= CAKE_ORDER.length ? 'cakeDone' : 'rightOrder', 3.2, 0);
      notifyStage();
      return;
    }
    // fora de ordem: no andar errado, balança e cai na grama ao lado da mesa
    const k = THINGS.indexOf(thing);
    const x = CAKE_REJECT.x + (k - 1) * 0.28;
    const z = CAKE_REJECT.z + (k % 2) * 0.18;
    S.reject = { thing, t: 0, tier, x, z };
    S.place[thing] = 'floor';
    S.floor[thing] = { x, z };
    S.wrong++;
    props.cake.reject(thing, tier, 0, x, z);
    emit('cake:wrong', { item: thing, tier, x: CAKE.x, z: CAKE.z, name: who });
    hints.now(S.wrong >= 2 ? 'wrongOrder2' : 'wrongOrder', 4.4, 0);
    notifyStage();
  }
  function stepReject(dt) {
    const r = S.reject;
    if (!r) return;
    r.t += dt;
    const k = clamp01(r.t / 1.1);
    props.cake.reject(r.thing, r.tier, k, r.x, r.z);
    if (k >= 1) {
      // no chão: vira um item comum (E pega de novo)
      items[r.thing].drop(r.x, r.z, 0);
      emit('cake:fall', { item: r.thing, x: r.x, z: r.z });
      S.reject = null;
    }
  }

  // ------------------------------------------------------------------ chapéu: água, barquinho e vento
  function stepPool(dt) {
    S.flowing = tap.on && !crateOnHose() && S.water < 1;
    if (S.flowing !== S.wasFlowing) {
      if (S.flowing) { emit('water:start', { x: HOSE[0].x, z: HOSE[0].z }); hints.now('tapOpen', 2.8, 0); }
      else if (tap.on && S.water < 1) emit('water:stop', { x: HOSE[0].x, z: HOSE[0].z });
      S.wasFlowing = S.flowing;
    }
    if (S.flowing) {
      S.water = Math.min(1, S.water + dt / POOL.water.fillTime);
      // golfadas de água (som e respingos onde o jato cai), no ritmo do jogo
      S.flowT -= dt;
      if (S.flowT <= 0) {
        S.flowT = 0.85;
        const lv = POOL.water.min + (POOL.water.max - POOL.water.min) * S.water;
        emit('water:flow', { x: POOL.x, z: POOL.z, lx: POOL.x - 0.12, lz: POOL.z - 0.55, y: lv });
      }
    } else S.flowT = 0;
    if (!S.full && S.water >= 1) {
      S.full = true;
      emit('water:full', { x: POOL.x, z: POOL.z });
      hints.now('poolFull', 3.2, 0);
    }
    const level = POOL.water.min + (POOL.water.max - POOL.water.min) * S.water;
    const floating = S.water >= BOAT.floatAt / POOL.water.max;
    // com energia e água alta, o vento do ventilador leva o barquinho até a borda leste
    if (floating && power() && S.place.hat === 'home' && !S.docked) {
      const dx = BOAT.dock.x - S.boatX, dz = BOAT.dock.z - S.boatZ;
      const d = Math.hypot(dx, dz);
      const step = Math.min(d, BOAT.drift * dt);
      S.boatX += (dx / (d || 1)) * step;
      S.boatZ += (dz / (d || 1)) * step;
      if (d - step < 0.01) {
        S.docked = true;
        emit('boat:dock', { x: BOAT.dock.x, z: BOAT.dock.z });
        hints.now('docked', 2.6, 0);
      }
    }
    props.pool.setLevel(S.water, level);
    props.pool.setFlow(S.flowing, tap.on && crateOnHose());
    props.boat.setPos(S.boatX, S.boatZ, floating ? level : POOL.water.min, floating && power() && !S.docked);
    props.fan.setPower(power());
    props.power.setOn(power());
  }

  // ------------------------------------------------------------------ laço: portão, pombo, balde e deque
  function startCord(c) {
    S.cordT = 0;
    S.cordWho = c.name;
    emit('rope:tug', { x: CORD.x, z: CORD.z });
  }
  function stepCord(dt) {
    if (S.cordT < 0) return;
    S.cordT += dt;
    props.cord.setTug(S.cordT < 0.7 ? Math.sin((Math.PI * S.cordT) / 0.7) : 0);
    if (!S.gateOpen && S.cordT >= 0.35) {
      S.gateOpen = true;
      gate.lock();
      emit('gate:open', { x: BACK_FENCE.x, z: (BACK_FENCE.gate.z0 + BACK_FENCE.gate.z1) / 2 });
      hints.now('gateOpen', 3.2, 0);
      cam?.focusShot(BACK_FENCE.x + 0.3, (BACK_FENCE.gate.z0 + BACK_FENCE.gate.z1) / 2, { hold: 0.9 });
    }
    if (S.cordT >= 0.75) { S.cordT = -1; S.cordWho = null; }
  }
  const tube = scent.addDuct({ id: 'cano-de-brinquedo', inlet: TUBE.inlet, outlet: TUBE.outlet, travel: TUBE.travel, active: () => true });
  scent.addNose({
    id: 'pombo', x: PIGEON.x, z: PIGEON.z, r: PIGEON.smellR,
    onSmell: (cloud) => {
      if (!pigeonAround()) return;
      if (/** @type {any} */ (cloud).duct === tube) {
        cloud.age = cloud.life;
        S.pigeon = 'flying';
        S.pigeonT = 0;
        emit('pigeon:flee', { x: PIGEON.x, z: PIGEON.z, y: PIGEON.y, id: 'casa-na-arvore' });
        hints.now('pigeonGone', 3, 0);
      } else hints.now('pigeonHigh', 4.2, 6);
    },
  });
  function stepPigeon(dt) {
    if (S.pigeon !== 'flying') return;
    S.pigeonT += dt;
    const k = clamp01(S.pigeonT / 2.4);
    props.pigeon.setPose({ x: PIGEON.x + k * 4.5, y: PIGEON.y + k * k * 4 + Math.sin(k * Math.PI) * 0.6, z: PIGEON.z - k * 3, yaw: 2.2, flying: true, flightProgress: k });
    if (k >= 1) { S.pigeon = 'gone'; props.pigeon.object.visible = false; }
  }
  /** Pose roteirizada (a fase move a dog; lockFor devolve drive). */
  function pose(seq, c, x, y, z, yaw, speed, action, slope = 0) {
    const px = c.x, pz = c.z;
    c.x = x;
    c.z = z;
    c.y = y;
    c.yaw = yaw;
    c.v = 0;
    c.dashT = 0;
    c.animSpeed = speed;
    const idt = 1 / Math.max(1e-4, S.scriptDt);
    c.vx = (c.x - px) * idt;
    c.vz = (c.z - pz) * idt;
    seq.action = action;
    seq.slope = slope;
  }
  const hopArc = (a, b, u, lift = 0.25) => {
    const e = smooth(u);
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e + Math.sin(Math.PI * u) * lift, z: a.z + (b.z - a.z) * e };
  };
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  /** @type {{ action?: string, slope?: number }} */
  const rideSeq = {};
  /** Onde a Radhija fica dentro do balde: deitada lá dentro (balde deitado) ou sentada (em pé), na altura dele. */
  function ridePos() {
    const k = 1 - (S.bucketTilt ?? 1);
    return { x: BUCKET.x, y: 0.03 + (S.bucketY + 0.14 - 0.03) * k, z: BUCKET.z + 0.06 * (1 - k) };
  }
  /** A boca do balde deitado (de onde ela entra e por onde sai). */
  const BUCKET_MOUTH = { x: BUCKET.x, y: 0, z: BUCKET.z + BUCKET.h / 2 + 0.38 };
  function stepBucket(dt) {
    const rh = ctrls.rhaenyra;
    if (handle.holder === 'rhaenyra') {
      const d = Math.hypot(rh.x - ROPE.ring.x, rh.z - ROPE.ring.z);
      S.pulled = Math.min(ROPE.maxPull, Math.max(0, d - ROPE.slack));
      const atEnd = S.pulled >= ROPE.maxPull - 0.01;
      if (atEnd && !S.ropeEnd) hints.now('ropeEnd', 2.4, 0);
      S.ropeEnd = atEnd;
    } else {
      S.pulled = Math.max(0, S.pulled - BUCKET.fall * dt);
      S.ropeEnd = false;
    }
    // os primeiros `lie` metros do puxão levantam o balde deitado; o resto o sobe
    const tiltK = clamp01(S.pulled / BUCKET.lie);
    S.bucketTilt = 1 - tiltK;
    props.bucket.setTilt?.(S.bucketTilt);
    const y = Math.min(BUCKET.top, Math.max(0, S.pulled - BUCKET.lie) * BUCKET.rise);
    if (Math.abs(y - S.bucketY) > 1e-4 && !S.riding && Math.abs(y - S.bucketY) > 0.2 * dt) emit('bucket:move', { x: BUCKET.x, z: BUCKET.z, up: y > S.bucketY });
    S.bucketY = y;
    bucketCol.enabled = S.bucketY < 0.25;
    props.bucket.setY(S.bucketY);
    props.rope.setPull(S.pulled, handle.holder ? dogs[handle.holder] : null);
    if (S.bucketY < BUCKET.top - 0.3) { S.topUsed = false; S.topBlocked = false; }
    S.peckT = Math.max(0, S.peckT - dt);
    if (S.riding) {
      const c = ctrls.radhija;
      const rp = ridePos();
      pose(rideSeq, c, rp.x, rp.y, rp.z, NORTH, 0, S.peckT > 0 ? 'startled' : S.bucketTilt > 0.5 ? 'slide' : 'sit');
      if (S.bucketY >= BUCKET.top - 0.02 && !S.deck && !S.topUsed && !S.topBlocked) {
        if (pigeonAround()) {
          // o pombo acorda, bate as asas em cima do laço e não deixa ela pular para o deque
          S.topBlocked = true;
          S.peckT = 0.9;
          emit('pigeon:peck', { x: PIGEON.x, z: PIGEON.z });
          props.pigeon.peck?.();
          hints.now('pigeonDeck', 4.6, 0);
        } else {
          S.riding = false;
          S.deck = { phase: 'hop', t: 0, x0: c.x, z0: c.z, y0: c.y, yaw0: c.yaw, grabbed: false };
          emit('deck:arrive', { x: c.x, z: c.z });
        }
      }
    }
  }
  function stepHop(dt) {
    const h = S.hop;
    if (!h) return;
    const c = ctrls.radhija;
    h.t += dt;
    const u = clamp01(h.t / h.dur);
    const b = h.then === 'ride' ? ridePos() : h.b;
    // com um ponto de passagem (a boca do balde deitado): primeiro até ele, depois para dentro
    const a = h.via && u > 0.5 ? h.via : h.a;
    const to = h.via && u <= 0.5 ? h.via : b;
    const uu = h.via ? (u <= 0.5 ? u * 2 : (u - 0.5) * 2) : u;
    const p = hopArc(a, to, uu, h.lift ?? 0.2);
    pose(h, c, p.x, p.y, p.z, h.yaw ?? yawTo(a, to), h.speed ?? 1.2, h.act || 'jump');
    if (u < 1) return;
    S.hop = null;
    if (h.then === 'ride') {
      S.riding = true;
      emit('bucket:in', { x: BUCKET.x, z: BUCKET.z });
      hints.now('inBucket', 3.4, 0);
    } else finishScript(c);
  }
  /** As partes roteirizadas do deque: subir do balde, desamarrar o laço, escorregar e voltar para o balde. */
  function stepDeck(dt) {
    const sq = S.deck;
    if (!sq) return;
    const c = ctrls.radhija;
    sq.t += dt;
    const top = DECK.h;
    const A = { x: DECK_PATH.arrive.x, y: top, z: DECK_PATH.arrive.z };
    if (sq.phase === 'hop') {
      // do balde para o deque, por cima da abertura do corrimão
      const u = clamp01(sq.t / 0.5);
      const p = hopArc({ x: sq.x0, y: sq.y0, z: sq.z0 }, A, u, 0.22);
      pose(sq, c, p.x, p.y, p.z, yawTo({ x: sq.x0, z: sq.z0 }, A), 1.2, 'jump');
      if (u >= 1) {
        S.deck = null;
        S.onDeck = true;
        c.yaw = NORTH;
        c.vx = c.vz = 0;
        c.animSpeed = 0;
        hints.now('deckArrive', 4.2, 0);
        emit('deck:land', { x: c.x, z: c.z });
      }
    } else if (sq.phase === 'untie') {
      // de frente para o corrimão: puxa a ponta do laço com a boca e desamarra
      const u = clamp01(sq.t / 0.8);
      const R = DECK_PATH.ribbon;
      const k = smooth(sq.t / 0.2);
      pose(sq, c, sq.x0 + (R.x - sq.x0) * k, top, sq.z0 + (R.z - sq.z0) * k, sq.yaw0 + wrap(0 - sq.yaw0) * k, 0.4, u > 0.25 ? 'tug' : 'sniff');
      if (!sq.grabbed && u >= 0.55) {
        sq.grabbed = true;
        if (S.place.ribbon === 'home') take('ribbon', c);
      }
      if (u >= 1) {
        S.deck = null;
        c.vx = c.vz = 0;
        c.animSpeed = 0;
      }
    } else if (sq.phase === 'toSlide') {
      // ajeita na boca do escorregador, virada para o sul (para o gramado)
      const T = DECK_PATH.slideTop;
      const u = clamp01(sq.t / 0.3);
      const k = smooth(u);
      pose(sq, c, sq.x0 + (T.x - sq.x0) * k, top, sq.z0 + (T.z - sq.z0) * k, sq.yaw0 + wrap(0 - sq.yaw0) * k, 0.8, 'none');
      if (u >= 1) {
        S.onDeck = false;
        Object.assign(sq, { phase: 'slide', t: 0 });
      }
    } else if (sq.phase === 'slide') {
      // de barriga pelo escorregador até o chão
      const u = clamp01(sq.t / 1.05);
      const e = u * u * (2 - u);
      const z = SLIDE.z0 + (SLIDE.z1 - SLIDE.z0) * e;
      const y = SLIDE.top * (1 - e) + 0.22 * e;
      pose(sq, c, SLIDE.x, y, z, 0, 2.6, 'slide', -Math.atan2(SLIDE.top, SLIDE.z1 - SLIDE.z0) * 0.8);
      if (sq.t < dt * 1.5) emit('slide:down', { x: SLIDE.x, z: SLIDE.z0 });
      if (u >= 1) Object.assign(sq, { phase: 'runout', t: 0 });
    } else if (sq.phase === 'runout') {
      const u = clamp01(sq.t / 0.35);
      // a língua aplaina e ela sai andando para fora dela (sem ficar em cima do plástico)
      const z = SLIDE.z1 + (SLIDE.land.z - SLIDE.z1) * smooth(u);
      pose(sq, c, SLIDE.x, 0.22 * (1 - smooth(u * 1.6)), z, 0, 1.4 * (1 - u), 'none');
      if (u >= 1) finishScript(c);
    } else if (sq.phase === 'rehop') {
      // de volta para o balde (lá em cima, com a Rhaenyra segurando a corda)
      const u = clamp01(sq.t / 0.5);
      const rp = ridePos();
      const p = hopArc({ x: sq.x0, y: top, z: sq.z0 }, rp, u, 0.2);
      pose(sq, c, p.x, p.y, p.z, yawTo({ x: sq.x0, z: sq.z0 }, { x: BUCKET.x, z: BUCKET.z }), 1.2, 'jump');
      if (u >= 1) {
        S.deck = null;
        S.onDeck = false;
        S.riding = true;
        S.topUsed = true;
        emit('bucket:in', { x: BUCKET.x, z: BUCKET.z });
      }
    }
  }
  /** Lá em cima, andando livre: o corrimão, a casinha, o tronco, a luneta e o baú seguram a Radhija no deque. */
  function confineDeck(c) {
    const m = DECK_RAIL.inset + 0.03 + c.r;
    let x = Math.min(DECK.x1 - m, Math.max(DECK.x0 + m, c.x));
    let z = Math.min(DECK.z1 - m, Math.max(DECK.z0 + m, c.z));
    const hx0 = HUT.x0 - c.r, hx1 = HUT.x1 + c.r, hz0 = HUT.z0 - c.r, hz1 = HUT.z1 + c.r;
    if (x > hx0 && x < hx1 && z > hz0 && z < hz1) {
      // sai pelo lado mais perto (oeste ou frente da casinha)
      if (x - hx0 < hz1 - z) x = hx0;
      else z = hz1;
    }
    for (const o of [TREE, DECK_PROPS.telescope, DECK_PROPS.chest]) {
      const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), R = o.r + c.r;
      if (d >= R) continue;
      if (d < 1e-4) { z = o.z + R; continue; }
      x = o.x + (dx / d) * R;
      z = o.z + (dz / d) * R;
    }
    c.x = x;
    c.z = z;
    c.y = DECK.h;
  }
  /** O que a Radhija alcança lá em cima (E): o laço, a boca do escorregador ou o balde (lá em cima). */
  function deckAction(c) {
    if (!S.onDeck || S.deck) return null;
    if (S.place.ribbon === 'home' && mouthFree(c.name) && reach(c, DECK_PATH.ribbon.x, DECK_PATH.ribbon.z) < 0.5) return 'untie';
    if (reach(c, DECK_PATH.slideTop.x, DECK_PATH.slideTop.z) < 0.5) return 'slide';
    if (S.bucketY >= BUCKET.top - 0.02 && reach(c, DECK_PATH.arrive.x, DECK_PATH.arrive.z) < 0.45) return 'bucketBack';
    return null;
  }
  function finishScript(c) {
    const res = world.resolve(c.x, c.z, c.r, c.size);
    c.x = res.x;
    c.z = res.z;
    c.y = 0;
    c.vx = c.vz = 0;
    c.v = 0;
    c.animSpeed = 0;
    S.deck = null;
    S.ramp = null;
    S.hop = null;
    S.onDeck = false;
    S.climb = null;
    emit('script:end', { name: c.name, x: c.x, z: c.z });
    notifyStage();
  }

  // ------------------------------------------------------------------ vela: galpão, porta e rampa
  function tryRamp(c) {
    if (S.ramp || S.slipCd > 0 || c.jumpT > 0 || effects.busy(c.name)) return;
    if (!inRect(RAMP_ENTRY, c.x, c.z) || Math.abs(wrap(c.yaw - EAST)) > 0.8) return;
    const dashing = S.dashRecent[c.name] > 0;
    // andando, só escorrega quem encosta na tábua (chegar perto e dar a arrancada vale)
    const pushing = !!c.hits?.some((hit) => hit.id === 'rampa');
    if (!dashing && !pushing) return;
    if (c.name === 'rhaenyra') {
      if (pushing) hints.cond('rampRh', 3, 8);
      return;
    }
    if (dashing && mud.canDash('radhija')) {
      S.ramp = { phase: 'up', t: 0, x0: c.x, z0: c.z, yaw0: c.yaw, grabbed: false };
      emit('slide:climb', { name: c.name, x: c.x, z: RAMP.z });
      return;
    }
    S.ramp = { phase: 'slipUp', t: 0, x0: c.x, z0: c.z, yaw0: c.yaw, grabbed: false, reason: mud.muddy('radhija') ? 'rampMud' : 'rampSlip' };
    emit('slide:slip', { name: c.name, x: c.x, z: RAMP.z });
  }
  const rampY = (x) => RAMP.top * clamp01((x - RAMP.x0) / (RAMP.x1 - RAMP.x0));
  const SLOPE = Math.atan2(RAMP.top, RAMP.x1 - RAMP.x0);
  /** Inclinação do corpo na tábua (+ = focinho para cima, subindo para o leste), suave na entrada e no alto. */
  const rampSlope = (x) => SLOPE * smooth((x - RAMP.x0) / 0.12) * (1 - smooth((x - RAMP.x1) / 0.12));
  function stepRamp(dt) {
    const sq = S.ramp;
    if (!sq) return;
    const c = ctrls.radhija;
    sq.t += dt;
    const T = RAMP_TIMES;
    const topX = RAMP.x1 + 0.12;
    if (sq.phase === 'up') {
      const u = clamp01(sq.t / T.climb);
      const x = sq.x0 + (topX - sq.x0) * (0.4 * u + 0.6 * (1 - (1 - u) * (1 - u)));
      const k = smooth(sq.t / 0.15);
      pose(sq, c, x, rampY(x), sq.z0 + (RAMP.z - sq.z0) * k, sq.yaw0 + wrap(EAST - sq.yaw0) * k, 3.0, 'dash', rampSlope(x));
      if (u >= 1) Object.assign(sq, { phase: 'grab', t: 0 });
    } else if (sq.phase === 'grab') {
      const u = clamp01(sq.t / T.grab);
      pose(sq, c, topX, RAMP.top, RAMP.z, EAST, 0, 'sniff');
      if (!sq.grabbed && u >= 0.5) {
        sq.grabbed = true;
        if (S.place.candle === 'home') take('candle', c);
      }
      if (u >= 1) Object.assign(sq, { phase: 'turn', t: 0 });
    } else if (sq.phase === 'turn') {
      const u = clamp01(sq.t / T.turn);
      pose(sq, c, topX, RAMP.top, RAMP.z, EAST - Math.PI * 0.75 * smooth(u), 0.6, 'none');
      if (u >= 1) Object.assign(sq, { phase: 'down', t: 0 });
    } else if (sq.phase === 'down') {
      // pula da prateleira para o chão, ao norte da rampa
      const u = clamp01(sq.t / T.down);
      const p = hopArc({ x: topX, y: RAMP.top, z: RAMP.z }, { x: topX - 0.45, y: 0, z: RAMP.z - 0.55 }, u, 0.25);
      pose(sq, c, p.x, p.y, p.z, NORTH - 0.6, 1.3, 'jump');
      if (u >= 1) finishScript(c);
    } else if (sq.phase === 'slipUp') {
      const u = clamp01(sq.t / (T.slip * 0.55));
      const x = sq.x0 + 0.5 * Math.sin(Math.PI * 0.5 * u);
      pose(sq, c, x, rampY(x), RAMP.z, EAST, 0.8, u > 0.5 ? 'startled' : 'none', rampSlope(x));
      if (u >= 1) Object.assign(sq, { phase: 'slipDown', t: 0, x0: x });
    } else if (sq.phase === 'slipDown') {
      const u = clamp01(sq.t / (T.slip * 0.45));
      const x = sq.x0 + (RAMP.x0 - 0.2 - sq.x0) * smooth(u);
      pose(sq, c, x, rampY(x), RAMP.z, EAST, 0, 'startled', rampSlope(x));
      if (u >= 1) {
        hints.now(sq.reason || 'rampSlip', 4, 0);
        S.slipCd = 0.8;
        finishScript(c);
      }
    }
  }
  function stepShed(dt, C) {
    void C;
    // a porta sobe de vez quando o botão certo é apertado
    const target = S.shedOpen ? 1 : 0;
    S.doorT += Math.sign(target - S.doorT) * Math.min(Math.abs(target - S.doorT), dt / 0.85);
    doorCol.enabled = S.doorT < 0.6;
    props.shedDoor.setOpen(S.doorT);
    // a porteira do chiqueiro gira para fora quando o botão dela é apertado
    const sty = S.styOpen ? 1 : 0;
    S.styT += Math.sign(sty - S.styT) * Math.min(Math.abs(sty - S.styT), dt / 0.9);
    props.styGate.setOpen(smooth(S.styT));
    const open = doorOpen();
    if (open !== S.wasDoor) {
      emit(open ? 'shed:open' : 'shed:close', { x: SHED.x0, z: (SHED.door.z0 + SHED.door.z1) / 2 });
      if (open) hints.now('doorOpen', 2.6, 0);
      S.wasDoor = open;
    }
  }

  // ------------------------------------------------------------------ galpão: os dois botões (porta | chiqueiro)
  function openShed() {
    if (S.shedOpen) return;
    S.shedOpen = true;
    props.shedLinks.door.pulse();
    props.shedLinks.door.setOn(true);
    emit('shed:button', { x: SHED.x0, z: (SHED.door.z0 + SHED.door.z1) / 2, door: true });
    hints.now('doorButton', 3, 0);
  }
  function openSty() {
    if (S.styOpen) return;
    S.styOpen = true;
    props.shedLinks.gate.pulse();
    props.shedLinks.gate.setOn(true);
    styGateCol.enabled = false;
    pigs.release();
    emit('shed:button', { x: STY.x0, z: (STY.gate.z0 + STY.gate.z1) / 2, door: false });
    emit('sty:open', { x: STY.x0, z: (STY.gate.z0 + STY.gate.z1) / 2 });
    hints.now('styButton', 4, 0);
    cam?.focusShot(STY.x0 - 0.6, (STY.gate.z0 + STY.gate.z1) / 2, { hold: 1.6, inT: 0.6, outT: 0.6, scale: 0.6, target: { x: STY.x0, y: 0.4, z: (STY.gate.z0 + STY.gate.z1) / 2 } });
  }

  // ------------------------------------------------------------------ biscoito: o gaveteiro (gavetas viram degraus)
  /** A gaveta i forma o degrau certo (a de baixo bem para fora, cada uma mais para dentro que a de baixo dela)? */
  function stepOk(i) {
    const d = S.drawers, St = DRAWERS.steps[i];
    if (d[i].fallen) return false;
    if (i === 0) return d[0].ext >= St.min && d[0].ext <= St.max;
    return d[i].ext >= St.min && d[i].ext <= d[i - 1].ext - St.below;
  }
  const stairsReady = () => DRAWERS.y.every((_, i) => stepOk(i));
  /** A gaveta que a Rhaenyra pega: a primeira (de baixo) que ainda não é degrau; tudo certo, a de cima. */
  const nextDrawer = () => {
    const i = DRAWERS.y.findIndex((_, k) => !stepOk(k));
    return i < 0 ? DRAWERS.y.length - 1 : i;
  };
  /** O que a dog faz no gaveteiro com E (ou null). */
  function drawerAction(c) {
    if (S.place.cookie !== 'home' && !S.drawerHold) return null;
    if (S.drawerHold?.who === c.name) return 'drawerRelease';
    if (S.climb || S.hop || S.riding || S.onDeck || S.deck) return null;
    // na frente do gaveteiro: a Rhaenyra de qualquer ponto da despensa (ela recua puxando); a Radhija mais perto
    const far = c.name === 'rhaenyra' ? PANTRY.zS - D_FRONT : 1.0;
    const front = c.z > D_FRONT && c.z < D_FRONT + far && Math.abs(c.x - DRAWERS.x) < DRAWERS.hx + 0.25;
    if (!front) return null;
    if (c.name === 'rhaenyra') {
      if (!mouthFree(c.name)) return null;
      return S.drawers.some((d) => d.fallen) ? 'drawerFix' : 'drawerGrab';
    }
    return mouthFree(c.name) && S.place.cookie === 'home' ? 'climb' : null;
  }
  function doDrawer(c, act) {
    if (act === 'drawerRelease') {
      S.drawerHold = null;
      emit('drawer:release', { x: c.x, z: c.z });
      return true;
    }
    if (act === 'drawerFix') {
      const i = S.drawers.findIndex((d) => d.fallen);
      S.drawers[i] = { ext: 0, fallen: false };
      emit('drawer:fix', { x: DRAWERS.x, z: D_FRONT });
      return true;
    }
    if (act === 'drawerGrab') {
      const i = nextDrawer();
      // ela fica onde está (a gaveta começa a vir com ela): g é a distância do puxador até ela
      S.drawerHold = { i, who: c.name, g: Math.max(0.3, c.z - D_FRONT - S.drawers[i].ext) };
      emit('drawer:grab', { x: DRAWERS.x, z: D_FRONT, i });
      hints.now('drawerPull', 3.6, 6);
      return true;
    }
    // a Radhija sobe: o caminho é o dos degraus certos, de baixo para cima, até o tampo
    const path = [];
    let reason = null;
    for (let i = 0; i < DRAWERS.y.length; i++) {
      if (!stepOk(i)) {
        const d = S.drawers[i];
        reason = i === 0 ? 'step0' : d.ext < DRAWERS.steps[i].min ? `step${i}Low` : `step${i}High`;
        break;
      }
      path.push({ x: DRAWERS.x, y: DRAWERS.y[i], z: D_FRONT + S.drawers[i].ext * 0.55 });
    }
    if (!reason) path.push({ x: DRAWERS.x + 0.12, y: DRAWERS.top, z: DRAWERS.z + 0.08 });
    if (c.size === 'large') { hints.now('drawerHeavy', 3.4, 4); return true; }
    S.climb = { path: [{ x: c.x, y: 0, z: c.z }, ...path], i: 0, t: 0, phase: path.length ? 'up' : 'fail', reason, grabbed: false };
    emit('drawer:climb', { x: DRAWERS.x, z: D_FRONT });
    return true;
  }
  function stepDrawers(dt) {
    void dt;
    const h = S.drawerHold;
    if (h) {
      const c = ctrls[h.who];
      const ext = Math.max(0, c.z - D_FRONT - h.g);
      const d = S.drawers[h.i];
      if (ext > DRAWERS.fall) {
        // puxou demais: a gaveta escapa e cai no chão
        d.ext = 0;
        d.fallen = true;
        S.drawerHold = null;
        emit('drawer:fall', { x: DRAWERS.x, z: D_FRONT + 0.4, i: h.i });
        hints.now('drawerFall', 3.6, 0);
      } else d.ext = Math.min(DRAWERS.max + 0.05, ext);
    }
    // colisor da frente: o quanto as gavetas avançam (e as caídas no chão)
    const maxExt = Math.max(0, ...S.drawers.map((d) => (d.fallen ? 0.62 : d.ext)));
    drawersCol.enabled = maxExt > 0.04;
    drawersCol.z = D_FRONT + maxExt / 2;
    drawersCol.hz = Math.max(0.02, maxExt / 2);
    S.drawers.forEach((d, i) => props.drawers.setDrawer(i, d.ext, d.fallen));
  }
  /** A subida (e a descida) da Radhija pelas gavetas. */
  function stepClimb(dt) {
    const cl = S.climb;
    if (!cl) return;
    const c = ctrls.radhija;
    cl.t += dt;
    const HOP = 0.36;
    if (cl.phase === 'up') {
      const a = cl.path[cl.i], b = cl.path[cl.i + 1];
      const u = clamp01(cl.t / HOP);
      const p = hopArc(a, b, u, 0.12);
      pose(cl, c, p.x, p.y, p.z, NORTH, 1.2, 'jump');
      if (u >= 1) {
        cl.i++;
        cl.t = 0;
        if (cl.i >= cl.path.length - 1) cl.phase = cl.reason ? 'fail' : 'grab';
      }
    } else if (cl.phase === 'grab') {
      const last = cl.path[cl.path.length - 1];
      const u = clamp01(cl.t / 0.6);
      pose(cl, c, last.x, last.y, last.z, NORTH, 0, 'sniff');
      if (!cl.grabbed && u >= 0.5) {
        cl.grabbed = true;
        if (S.place.cookie === 'home') take('cookie', c);
      }
      if (u >= 1) Object.assign(cl, { phase: 'down', t: 0 });
    } else if (cl.phase === 'fail') {
      const last = cl.path[cl.path.length - 1];
      const u = clamp01(cl.t / 0.5);
      pose(cl, c, last.x, last.y, last.z, NORTH, 0, 'startled');
      if (cl.t < dt * 1.5 && cl.reason) hints.now(cl.reason, 4.2, 0);
      if (u >= 1) Object.assign(cl, { phase: 'down', t: 0 });
    } else if (cl.phase === 'down') {
      // um pulo só, de volta para o chão na frente do gaveteiro
      const last = cl.path[cl.path.length - 1];
      const floor = { x: DRAWERS.x + 0.1, y: 0, z: D_FRONT + Math.max(0.55, S.drawers[0].ext + 0.45) };
      const u = clamp01(cl.t / 0.55);
      const p = hopArc(last, floor, u, 0.18);
      pose(cl, c, p.x, p.y, p.z, 0, 1.2, 'jump');
      if (u >= 1) finishScript(c);
    }
  }

  // ------------------------------------------------------------------ estrela: a piñata (pêndulo)
  const OMEGA2 = 9.8 / PINATA.L;
  /** Onde está o gancho (fim da corda) da piñata. */
  function pinataPos() {
    const P = PINATA.pivot;
    return { x: P.x + PINATA.L * Math.sin(S.pin.ax), y: P.y - PINATA.L * Math.cos(S.pin.ax) * Math.cos(S.pin.az), z: P.z + PINATA.L * Math.sin(S.pin.az) };
  }
  function stepPinata(dt, C) {
    const pn = S.pin;
    pn.cd = Math.max(0, pn.cd - dt);
    if (!pn.broken) {
      // pêndulo amortecido nos dois eixos
      pn.vx += (-OMEGA2 * Math.sin(pn.ax) - PINATA.damp * pn.vx) * dt;
      pn.vz += (-OMEGA2 * Math.sin(pn.az) - PINATA.damp * pn.vz) * dt;
      pn.ax = Math.max(-1.1, Math.min(1.1, pn.ax + pn.vx * dt));
      pn.az = Math.max(-1.1, Math.min(1.1, pn.az + pn.vz * dt));
      const p = pinataPos();
      // o superbafo empurra (cada nuvem uma vez)
      /** @type {any[]} */
      const clouds = scent.clouds;
      for (const cl of clouds) {
        if (cl.state === 'duct' || pn.used.has(cl.id)) continue;
        if (Math.hypot(cl.x - p.x, cl.z - p.z) > 0.95) continue;
        pn.used.add(cl.id);
        const L = Math.hypot(cl.vx, cl.vz) || 1;
        pn.vx += (cl.vx / L) * PINATA.kick;
        pn.vz += (cl.vz / L) * PINATA.kick;
        emit('pinata:swing', { x: p.x, z: p.z });
        if (!pn.swingHint) { pn.swingHint = true; hints.now('pinataSwing', 3.4, 0); }
      }
      // a Rhaenyra no ar, embaixo dela e no alcance: bate
      const rh = C.rhaenyra;
      const bottom = p.y - PINATA.size * 1.05;
      if (rh.jumpT > 0 && pn.cd <= 0 && Math.hypot(rh.x - p.x, rh.z - p.z) < PINATA.hitR && bottom <= PINATA.reach) {
        pn.cd = 0.6;
        pn.hits++;
        const dx = p.x - rh.x, dz = p.z - rh.z, L = Math.hypot(dx, dz) || 1;
        pn.vx += (dx / L) * 1.0;
        pn.vz += (dz / L) * 1.0;
        props.pinata.setCracks(pn.hits);
        emit('pinata:hit', { x: p.x, z: p.z, hits: pn.hits });
        if (pn.hits >= PINATA.hits) {
          pn.broken = true;
          props.pinata.burst();
          // a estrela cai no gramado do lado de quem bateu (fora da roseira)
          const ox = rh.x - ROSE_BUSH.x, oz = rh.z - ROSE_BUSH.z, oL = Math.hypot(ox, oz) || 1;
          const sx = ROSE_BUSH.x + (ox / oL) * (ROSE_BUSH.r + 0.4), sz = ROSE_BUSH.z + (oz / oL) * (ROSE_BUSH.r + 0.4);
          const res = world.resolve(sx, sz, 0.1, 'small');
          props.star.setShown?.(true);
          items.star.drop(res.x, res.z, 0);
          S.place.star = 'floor';
          S.floor.star = { x: res.x, z: res.z };
          emit('pinata:burst', { x: p.x, z: p.z });
          hints.now('pinataOpen', 3.6, 0);
          notifyStage();
        } else hints.now('pinataHit', 1.6, 0);
      }
    }
    const p = pinataPos();
    props.pinata.setPos(p.x, p.y, p.z, pn.ax, pn.az);
  }

  // ------------------------------------------------------------------ legumes do campinho (para os porcos)
  /** O pé de legume pronto mais perto (ou null). */
  function vegSpot(c) {
    let best = null, bd = PLANTATION.pickR;
    for (const sp of props.farm.spots) {
      if ((S.veg.regrow[sp.id] ?? 0) > 0) continue;
      const d = reach(c, sp.x, sp.z);
      if (d < bd) { bd = d; best = sp; }
    }
    return best;
  }
  /** Um legume largado no chão, perto (ou null). */
  function vegNear(c) {
    return S.veg.floor.find((v) => !v.eaten && reach(c, v.x, v.z) < 0.5) || null;
  }
  function vegAction(c) {
    if (S.veg.held[c.name]) return 'dropVeg';
    if (!mouthFree(c.name) || S.climb || S.hop || S.riding || S.onDeck) return null;
    if (vegNear(c)) return 'pickVeg';
    return vegSpot(c) ? 'pickVeg' : null;
  }
  function doVeg(c, act) {
    if (act === 'dropVeg') { dropVeg(c); return true; }
    const near = vegNear(c);
    if (near) {
      S.veg.floor = S.veg.floor.filter((v) => v !== near);
      near.it.attach(c.name);
      S.veg.held[c.name] = near;
      return true;
    }
    const sp = vegSpot(c);
    if (!sp) return false;
    const obj = props.farm.makeVeg(sp.kind);
    obj.position.set(sp.x, 0.05, sp.z);
    root.add(obj);
    const it = createCarryItem({ obj, dogs, scene: root, name: 'veg' });
    it.attach(c.name);
    S.veg.held[c.name] = { it, obj, kind: sp.kind, id: ++S.veg.n, x: 0, z: 0, eaten: false };
    sp.setReady(false);
    S.veg.regrow[sp.id] = PLANTATION.regrow;
    emit('veg:pick', { name: c.name, kind: sp.kind, x: c.x, z: c.z });
    hints.now('vegPick', 3.4, 8);
    return true;
  }
  function dropVeg(c) {
    const v = S.veg.held[c.name];
    if (!v) return;
    const x = c.x + Math.sin(c.yaw) * 0.32, z = c.z + Math.cos(c.yaw) * 0.32;
    const res = world.resolve(x, z, 0.1, 'small');
    v.it.drop(res.x, res.z, 0);
    v.x = res.x;
    v.z = res.z;
    S.veg.held[c.name] = null;
    S.veg.floor.push(v);
    emit('veg:drop', { name: c.name, kind: v.kind, x: res.x, z: res.z });
    // os porcos (se estiverem soltos) vêm comer
    pigs.addFood({ x: res.x, z: res.z, kind: v.kind, onDone: () => { v.eaten = true; v.obj.parent?.remove(v.obj); S.veg.floor = S.veg.floor.filter((f) => f !== v); } });
  }
  function stepVeg(dt, C) {
    void C;
    for (const sp of props.farm.spots) {
      const left = S.veg.regrow[sp.id] ?? 0;
      if (left <= 0) continue;
      S.veg.regrow[sp.id] = left - dt;
      if (left - dt <= 0) sp.setReady(true);
    }
  }

  // ------------------------------------------------------------------ o cantinho atrás do muro
  const BOARD_AT = { x: EAST_WALL.x - 0.35, z: (SECRET.board.z0 + SECRET.board.z1) / 2 };
  function boardAction(c) {
    return S.secretReady && !S.secretOpen && reach(c, BOARD_AT.x, BOARD_AT.z) < 0.5;
  }
  function openBoard() {
    S.secretOpen = true;
    boardCol.enabled = false;
    emit('secret:board', { x: EAST_WALL.x, z: BOARD_AT.z });
  }
  function stepSecret(dt, active) {
    const ready = cols.count >= cols.total && !!ctx.extrasUsed?.();
    if (ready && !S.secretReady) { S.secretReady = true; props.secretBoard.setLoose(true); }
    if (S.secretOpen) S.boardT = Math.min(1, S.boardT + dt / 0.8);
    props.secretBoard.setOpen(S.boardT);
    if (S.secretOpen && !S.secretSeen && active.x > EAST_WALL.x + 0.3) {
      S.secretSeen = true;
      const P = SECRET.photo;
      // de fora, pela fresta da tábua aberta: o quadro inteiro, as luzinhas e a plaquinha (a dog lá dentro fica embaixo)
      cam?.focusShot(P.x, P.z, { hold: 5, inT: 1.0, outT: 0.8, target: { x: P.x, y: P.y - 0.06, z: P.z }, from: { x: EAST_WALL.x - 0.25, y: P.y + 0.16, z: P.z } });
      emit('secret:photo', { x: P.x - 0.4, z: P.z });
    }
  }

  // ------------------------------------------------------------------ quadro
  function update(dt, { active, comp, ctrls: C }) {
    if (S.disposed) return null;
    S.scriptDt = dt;
    hints.frame(dt);
    for (const b of levers) b.update(dt);
    crate.update(dt, { comp });
    effects.update(dt, C);
    S.slipCd = Math.max(0, S.slipCd - dt);
    for (const n of /** @type {import('../../types').DogName[]} */ (['radhija', 'rhaenyra'])) {
      S.dashRecent[n] = C[n].dashT > 0 ? 0.22 : Math.max(0, S.dashRecent[n] - dt);
    }

    // apresentação: o bolo vazio (o quadro fica para quem chegar perto e olhar: E na frente dele)
    if (!introDone && stage() === 'start') {
      S.introT += dt;
      if (S.introT >= 0.7) {
        cam?.focusShot(CAKE.x + 0.3, CAKE.z + 1.1, { hold: 1.6, inT: 0.8, outT: 0.6, target: { x: CAKE.x, y: CAKE.base + 0.3, z: CAKE.z } });
        introDone = true;
      }
    }

    // a Rhaenyra que estava na placa fica lá quando o jogador troca para a irmã
    const activeName = /** @type {import('../../types').DogName} */ (active.name);
    if (activeName !== S.prevActive) {
      // trocando, quem segurava a gaveta solta
      if (S.drawerHold && S.drawerHold.who !== activeName) S.drawerHold = null;
      S.prevActive = activeName;
    }

    stepPool(dt);
    stepCord(dt);
    stepPigeon(dt);
    stepHop(dt);
    stepBucket(dt);
    stepDeck(dt);
    if (S.onDeck && !S.deck) confineDeck(C.radhija);
    stepRamp(dt);
    stepReject(dt);
    stepDrawers(dt);
    stepClimb(dt);
    stepPinata(dt, C);
    stepVeg(dt, C);
    stepSecret(dt, active);
    pigs.update(dt, C);
    gate.update(dt, { ctrls: C });
    stepShed(dt, C);
    if (!S.ramp && active.name === 'radhija' && inShed(active)) tryRamp(active);
    if (!S.ramp && active.name === 'rhaenyra' && inShed(active)) tryRamp(active);

    // gansa guardando o portão (só enquanto ele está fechado; depois ela só passeia)
    const before = goose.hits;
    goose.update(dt, { active: S.gateOpen ? null : active, ctrls: C });
    if (goose.hits > before) hints.now('gooseCharge', 4, 6);
    if ((goose.state === 'lured' || goose.state === 'curious') && !S.gateOpen) hints.cond('gooseAway', 3, 8);

    // a primeira vez no fundo do quintal: a câmera mostra o laço no corrimão com o pombo dormindo em cima
    if (!S.sawPigeon && pigeonAround() && S.place.ribbon === 'home' && active.x > BACK_FENCE.x + 0.45 && S.cordT < 0) {
      S.sawPigeon = true;
      cam?.focusShot(PIGEON.x - 0.15, PIGEON.z + 2.1, { hold: 2.4, inT: 0.8, outT: 0.7, scale: 0.55, target: { x: PIGEON.x, y: PIGEON.y - 0.05, z: PIGEON.z } });
      hints.now('pigeonSeen', 4.6, 0);
      emit('pigeon:seen', { x: PIGEON.x, z: PIGEON.z });
    }

    // lama no canteiro da horta (só a Radhija entra nela)
    const rad = C.radhija;
    if (rad.x > MUD.x0 && rad.x < MUD.x1 && rad.z > MUD.z0 && rad.z < MUD.z1 && !rad.jumpT) {
      const first = !mud.muddy('radhija');
      mud.soak('radhija', dt, rad);
      if (first && mud.muddy('radhija')) hints.now('mud', 3.2, 0);
    } else mud.leave('radhija');

    // entregas no bolo
    for (const t of THINGS) {
      const h = items[t].holder;
      if (!h || S.reject) continue;
      if (S.rearm[t]) {
        if (Math.hypot(C[h].x - GOAL.x, C[h].z - GOAL.z) > GOAL.r + 0.2) S.rearm[t] = false;
        continue;
      }
      if (deliveredAt(GOAL, C[h], active)) deliver(t, h);
    }

    // prompts e destaques
    const k = activeName;
    const free = mouthFree(k);
    const up = k === 'radhija' && (S.onDeck || !!S.deck);
    const deckDo = k === 'radhija' ? deckAction(active) : null;
    const nearFloor = !up && THINGS.find((t) => S.place[t] === 'floor' && !S.reject && reach(active, S.floor[t].x, S.floor[t].z) < 0.55);
    const canHat = !up && free && S.place.hat === 'home' && S.docked && Math.hypot(active.x - BOAT.dock.x, active.z - BOAT.dock.z) < BOAT.grabR;
    const canCord = !S.gateOpen && S.cordT < 0 && reach(active, CORD.x, CORD.z) < CORD.reach;
    const canRope = k === 'rhaenyra' && free && !handle.holder && reach(active, ROPE.rest.x, ROPE.rest.z) < ROPE.grabR && S.bucketY < 0.05;
    const canBucket = k === 'radhija' && free && !S.riding && !S.deck && !S.hop && S.pulled < 0.05 && reach(active, BUCKET.x, BUCKET.z) < BUCKET.enterR + 0.25;
    const nearPainting = inHouse(active) && Math.hypot(active.x - PAINTING.x, active.z - (PAINTING.z + 0.95)) < 1.0;
    const drawerDo = !up ? drawerAction(active) : null;
    const vegDo = !up && !drawerDo ? vegAction(active) : null;
    if (handle.holder === k) hints.setPrompt('ropeDrop');
    else if (up) hints.setPrompt(deckDo);
    else if (drawerDo) hints.setPrompt(drawerDo);
    else if (vegDo) hints.setPrompt(vegDo);
    else if (boardAction(active)) hints.setPrompt('board');
    else if (S.riding && k === 'radhija' && S.pulled < 0.05) hints.setPrompt('bucketOut');
    else if (canHat) hints.setPrompt('hat');
    else if (nearFloor && free) hints.setPrompt('pick');
    else if (canCord) hints.setPrompt('cord');
    else if (canRope) hints.setPrompt('rope');
    else if (canBucket) hints.setPrompt('bucket');
    else if (nearPainting) hints.setPrompt('painting');
    else {
      const wallReady = k === 'rhaenyra' && !airborne(active) && free && levers.some((b) => b.inReach(active, world));
      hints.setPrompt(wallReady ? 'wall' : null, 'Espaço');
    }
    const nearLever = levers.some((b) => !b.on && Math.hypot(active.x - wallKick(b.spot, active.r).x, active.z - wallKick(b.spot, active.r).z) < 1.0);
    if (nearLever && k === 'radhija') hints.cond('wallRadhija', 3.4, 10);
    if (!S.full && Math.hypot(active.x - POOL.x, active.z - POOL.z) < POOL.r + 0.7) hints.cond(tap.on && crateOnHose() ? 'hoseBlocked' : 'poolDeep', 3.6, 12);
    if (S.full && !power() && !S.docked && Math.hypot(active.x - POOL.x, active.z - POOL.z) < POOL.r + 0.8) hints.cond('boatFar', 3.6, 10);
    // a piñata em cima da roseira: parada, os espinhos não deixam chegar; balançando, quem bate é a Rhaenyra
    if (!S.pin.broken && Math.hypot(active.x - ROSE_BUSH.x, active.z - ROSE_BUSH.z) < ROSE_BUSH.r + 0.9) {
      const swinging = Math.hypot(S.pin.ax, S.pin.az) > 0.12;
      if (swinging && k === 'radhija') hints.cond('pinataJumpRad', 3.4, 10);
      else if (!swinging) hints.cond('pinataThorns', 3.6, 12);
    }
    if (S.place.hat === 'home' && S.docked) props.hat.setHighlight(true);
    props.crate.setHighlight?.(crateOnHose() && k === 'rhaenyra');
    props.ribbon.setHighlight(S.place.ribbon === 'home' && !pigeonAround());
    props.candle.setHighlight(S.place.candle === 'home' && (inShed(ctrls.radhija) || doorOpen()));
    props.cookie.setHighlight(S.place.cookie === 'home' && stairsReady());
    props.star.setHighlight(S.place.star === 'floor');
    props.cake.setHighlight(THINGS.some((t) => items[t].holder));
    if (!S.wasPower && power()) emit('power:on', { x: BREAKER.x, z: BREAKER.z });
    S.wasPower = power();
    // a energia chegando: primeiro as luzinhas em volta do quadro da sala, depois as da festa na varanda
    const pstage = props.power.stage ?? 'off';
    if (pstage !== S.powerStage) {
      if (pstage === 'painting') {
        cam?.focusShot(PAINTING.x + 0.25, PAINTING.z + 2.0, { hold: 2.1, inT: 0.7, outT: 0.6, scale: 0.5, target: { x: PAINTING.x, y: PAINTING.y + 0.05, z: PAINTING.z + 0.05 } });
      } else if (pstage === 'porch') {
        // do quintal, baixinho (por baixo das vigas do pergolado): a varanda, o bolo e as luzinhas acendendo
        cam?.focusShot(-2.0, -3.6, { hold: 2.0, inT: 0.9, outT: 0.8, target: { x: -2.0, y: 1.6, z: -3.6 }, from: { x: 0.6, y: 3.2, z: 1.2 } });
      } else if (pstage === 'on') hints.now('powerOn', 3, 0);
      S.powerStage = pstage;
    }
    cols.update(active);
    if (k === 'radhija' && active.hits?.some((h) => typeof h.id === 'string' && h.id.startsWith('horta-') && h.id !== 'horta-vao')) hints.cond('fenceRad', 3.4, 10);
    if (k === 'rhaenyra' && active.hits?.some((h) => h.id === 'horta-vao')) hints.cond('gapRh', 3.4, 10);
    // as baforadas de cheiro subindo pelo cano de brinquedo
    /** @type {any[]} */
    const clouds = scent.clouds;
    props.tube?.setPuffs(clouds.filter((cl) => cl.state === 'duct' && cl.duct === tube).map((cl) => cl.ductT / cl.duct.travel));
    // o balde subindo: a câmera recua e olha mais alto (quem puxa e quem sobe ficam à vista); no deque, o olhar sobe
    const deckView = k === 'radhija' && (S.onDeck || (!!S.deck && S.deck.phase !== 'slide' && S.deck.phase !== 'runout'));
    cam?.setZone?.('deque', deckView);
    cam?.setZone?.('balde', !deckView && ((S.riding && S.bucketY > 0.05) || !!S.deck));

    const o = objective(k);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) { S.objKey = key; onStageChange(o.stage); }
    notifyStage();
    if (!S.done && S.cake.length >= CAKE_ORDER.length && !S.reject) {
      S.done = true;
      props.cake.light();
      emit('cake:lit', { x: CAKE.x, z: CAKE.z });
      notifyStage();
      return 'delivered';
    }
    return null;
  }

  // ------------------------------------------------------------------ entrada
  function modifyIntent(dt, c, intent, opts) {
    // a Rhaenyra com o puxador da gaveta na boca: anda só para a frente e para trás, de frente para o gaveteiro
    if (S.drawerHold && S.drawerHold.who === c.name) {
      const want = intent.speed > 1e-3 ? (intent.dz || 0) : 0;
      const v = Math.max(-1, Math.min(1, want)) * DRAWERS.pullSpeed;
      const minZ = D_FRONT + S.drawerHold.g;
      c.z = Math.max(minZ, Math.min(PANTRY.zS - 0.35, c.z + v * dt));
      c.x += (DRAWERS.x - c.x) * Math.min(1, dt * 6);
      return { intent: { dx: 0, dz: 0, speed: 0, faceX: c.x, faceZ: c.z - 1 }, action: Math.abs(v) > 0.05 ? 'tug' : null };
    }
    // dentro do balde (a Radhija ativa): fica sentada; a câmera e a troca continuam valendo
    if (S.riding && c.name === 'radhija') return { intent: { dx: 0, dz: 0, speed: 0, faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw) }, action: 'sit' };
    // a Rhaenyra com a corda na boca: anda normalmente (as patas continuam) e não passa do comprimento da corda;
    // no fim da corda, insistindo, ela faz força
    if (handle.holder === c.name) {
      const dx = c.x - ROPE.ring.x, dz = c.z - ROPE.ring.z;
      const d = Math.hypot(dx, dz) || 1;
      const ux = dx / d, uz = dz / d;
      const out = (intent.dx || 0) * ux + (intent.dz || 0) * uz;
      if (d >= ROPE.slack + ROPE.maxPull - 0.01 && out > 0) {
        const rest = { ...intent, dx: (intent.dx || 0) - out * ux, dz: (intent.dz || 0) - out * uz };
        const sideways = Math.hypot(rest.dx, rest.dz) > 0.25;
        return { intent: sideways ? rest : { ...rest, speed: 0, faceX: c.x + ux, faceZ: c.z + uz }, action: sideways ? null : 'strain' };
      }
      return { intent, action: null };
    }
    const r = crate.modifyIntent(dt, c, intent, opts);
    if (!r.contact) return null;
    if (r.contact === 'needShift') hints.cond('shift', 3, 8);
    if (r.contact === 'strain') hints.cond('heavy', 3.4, 8);
    return r;
  }

  // ------------------------------------------------------------------ interação (E)
  function interact(c) {
    const carried = carriedBy(c.name);
    if (handle.holder === c.name) {
      handle.returnHome();
      emit('rope:drop', { x: c.x, z: c.z });
      hints.now('ropeDrop', 2.6, 0);
      return true;
    }
    if (S.hop) return true;
    // lá em cima: desamarrar, escorregar ou voltar para o balde (com o laço na boca não dá para largar)
    if (c.name === 'radhija' && (S.onDeck || S.deck)) {
      if (S.deck) return true;
      const act = deckAction(c);
      const base = { t: 0, x0: c.x, z0: c.z, y0: c.y, yaw0: c.yaw, grabbed: false };
      if (act === 'untie') S.deck = { phase: 'untie', ...base };
      else if (act === 'slide') S.deck = { phase: 'toSlide', ...base };
      else if (act === 'bucketBack') S.deck = { phase: 'rehop', ...base };
      else if (carried) hints.now('deckHold', 3.4, 4);
      else return false;
      return true;
    }
    if (S.riding && c.name === 'radhija') {
      if (S.pulled < 0.05) {
        S.riding = false;
        // sai de ré pela boca do balde deitado
        S.hop = { t: 0, dur: 0.6, a: ridePos(), b: { ...BUCKET_MOUTH }, then: 'free', lift: 0.02, yaw: NORTH, speed: 0.7, act: 'none' };
        emit('bucket:out', { x: BUCKET.x, z: BUCKET.z });
      }
      return true;
    }
    // gaveteiro: a Rhaenyra puxa, solta e encaixa; a Radhija sobe pelos degraus
    const dr = drawerAction(c);
    if (dr) return doDrawer(c, dr);
    // legumes: colher e largar
    const vg = vegAction(c);
    if (vg) return doVeg(c, vg);
    if (S.veg.held[c.name]) { dropVeg(c); return true; }
    if (carried) {
      if (!deliveredAt(GOAL, c, c)) dropThing(carried, c);
      return true;
    }
    if (boardAction(c)) { openBoard(); return true; }
    const nearFloor = THINGS.find((t) => S.place[t] === 'floor' && !S.reject && reach(c, S.floor[t].x, S.floor[t].z) < 0.55);
    if (nearFloor) { take(nearFloor, c); return true; }
    if (S.place.hat === 'home' && S.docked && Math.hypot(c.x - BOAT.dock.x, c.z - BOAT.dock.z) < BOAT.grabR) { take('hat', c); return true; }
    if (!S.gateOpen && S.cordT < 0 && reach(c, CORD.x, CORD.z) < CORD.reach) {
      if (guarding()) { hints.now('gooseGuard', 3.6, 1.5); return true; }
      startCord(c);
      return true;
    }
    // o balde e a ponta da corda ficam lado a lado: para a Radhija vale o balde, para a Rhaenyra a corda
    const atBucket = !S.riding && !S.deck && !S.hop && S.pulled < 0.05 && reach(c, BUCKET.x, BUCKET.z) < BUCKET.enterR + 0.25;
    if (atBucket && c.name === 'radhija') {
      // vai até a boca do balde deitado e entra andando, de cabeça
      S.hop = { t: 0, dur: 0.9, a: { x: c.x, y: 0, z: c.z }, via: { ...BUCKET_MOUTH }, b: ridePos(), then: 'ride', lift: 0.02, yaw: null, speed: 0.9, act: 'none' };
      return true;
    }
    if (!handle.holder && reach(c, ROPE.rest.x, ROPE.rest.z) < ROPE.grabR && S.bucketY < 0.05) {
      if (c.name !== 'rhaenyra') { hints.now('ropeLight', 3.4, 2); return true; }
      handle.attach('rhaenyra');
      emit('rope:grab', { x: c.x, z: c.z });
      hints.now('ropeTip', 4.2, 0);
      return true;
    }
    if (atBucket) { hints.now('bucketHeavy', 3.4, 2); return true; }
    if (inHouse(c) && Math.hypot(c.x - PAINTING.x, c.z - (PAINTING.z + 0.95)) < 1.0) {
      S.lookedPainting = true;
      cam?.focusShot(PAINTING.x, PAINTING.z + 1.4, { hold: 3.2, inT: 0.6, outT: 0.7, scale: 0.42, target: { x: PAINTING.x, y: PAINTING.y, z: PAINTING.z + 0.05 } });
      hints.now('painting', 4, 0);
      emit('painting:look', { x: PAINTING.x, z: PAINTING.z });
      return true;
    }
    if (inHorta(c) || (c.name === 'radhija' && Math.abs(c.x - HORTA.x0) < 0.6 && c.z > HORTA.z0 && c.z < HORTA.z1)) return false;
    return false;
  }

  // ------------------------------------------------------------------ impulso na parede
  function onWallTouch(c, spot) {
    if (spot.id === breaker.id && !breaker.on) breaker.touch();
    if (spot.id === tap.id && !tap.on) tap.touch();
    shedButtons.forEach((b, i) => {
      if (spot.id !== b.id || b.on) return;
      b.touch();
      if (i === S.doorBtn) openShed(); else openSty();
    });
  }

  // ------------------------------------------------------------------ Lambe-Lambe
  /** @param {import('../../types').DogController} c @param {import('../../types').LickInfo} lick */
  function onLick(c, lick) {
    if (lick.target !== 'radhija' || !mud.muddy('radhija')) {
      hints.now('alreadyClean', 2.6, 6);
      return null;
    }
    const res = mud.lick('radhija', lick);
    if (res.cleaned) {
      hints.now('clean', 3.2, 0);
      notifyStage();
      return { stop: true };
    }
    if (lick.stroke === 1) hints.now('licking', 2.4, 8);
    return null;
  }

  // ------------------------------------------------------------------ travas
  function lockFor(name) {
    const fx = effects.lockFor(name);
    if (fx) return fx;
    const c = ctrls[name];
    if (name === 'radhija' && (S.deck || S.ramp || S.hop || S.climb)) {
      const sq = /** @type {any} */ (S.deck || S.ramp || S.hop || S.climb);
      return { action: sq.action || 'none', faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), drive: true, slope: sq.slope || 0 };
    }
    // no balde, como companheira: sentada (a Radhija ativa usa o modifyIntent, para a troca continuar valendo)
    if (name === 'radhija' && S.riding && ctx.activeDog !== 'radhija') return { action: 'sit', faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), drive: true };
    // no deque, como companheira: espera lá em cima (sem seguir a irmã)
    if (name === 'radhija' && S.onDeck && ctx.activeDog !== 'radhija') return { action: 'none', faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), drive: true };
    // a Rhaenyra segurando a corda enquanto o jogador está com a irmã
    if (name === 'rhaenyra' && handle.holder === 'rhaenyra' && ctx.activeDog !== 'rhaenyra') return { action: 'tug', faceX: ROPE.ring.x, faceZ: ROPE.ring.z };
    if (S.cordT >= 0 && S.cordWho === name) return { action: 'tug', faceX: CORD.x, faceZ: CORD.z };
    return null;
  }

  // ------------------------------------------------------------------ reinício e etapas de depuração
  function reset() {
    for (const t of THINGS) items[t].returnHome();
    handle.returnHome();
    props.reset();
    hints.reset();
    cols.reset();
    effects.reset();
    mud.reset();
    for (const b of levers) b.reset();
    crate.reset();
    gate.reset();
    goose.reset();
    pigs.reset();
    for (const v of S.veg.floor) v.obj.parent?.remove(v.obj);
    for (const n of /** @type {import('../../types').DogName[]} */ (['radhija', 'rhaenyra'])) { const h = S.veg.held[n]; if (h) { h.it.returnHome(); h.obj.parent?.remove(h.obj); } }
    for (const n of /** @type {import('../../types').DogName[]} */ (['radhija', 'rhaenyra'])) ctrls[n].y = 0;
    Object.assign(S, fresh());
    doorCol.enabled = true;
    bucketCol.enabled = true;
    styGateCol.enabled = true;
    boardCol.enabled = true;
    drawersCol.enabled = false;
    props.pigeon.object.visible = true;
    lastStage = 'start';
  }
  /** Põe um enfeite no bolo (depuração e testes). @param {Thing} thing */
  function forceOnCake(thing) {
    const tier = S.cake.length;
    if (thing === 'star') props.star.setShown?.(true);
    props.cake.place(thing, tier);
    S.cake.push(thing);
    S.place[thing] = 'cake';
  }
  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(/** @type {Stage} */ (st))) return null;
    reset();
    const order = STAGES.indexOf(/** @type {Stage} */ (st));
    for (let i = 0; i < order; i++) forceOnCake(CAKE_ORDER[i]);
    const placed = (t) => S.cake.includes(t);
    if (placed('ribbon')) { S.gateOpen = true; gate.lock(); S.pigeon = 'gone'; props.pigeon.object.visible = false; }
    if (placed('candle')) { S.shedOpen = true; S.doorT = 1; }
    if (placed('hat')) { breaker.setOn(true); tap.setOn(true); S.water = 1; S.full = true; }
    if (placed('star')) { S.pin.broken = true; props.pinata.burst(); }
    place('radhija', GOAL.celebrate.radhija.x, GOAL.celebrate.radhija.z + 0.6, NORTH);
    place('rhaenyra', GOAL.celebrate.rhaenyra.x, GOAL.celebrate.rhaenyra.z + 0.6, NORTH);
    notifyStage();
    return who || 'radhija';
  }

  return {
    S: hints.S, TEXT, stages: STAGES, objective, update, interact, reset, jumpToStage, modifyIntent, lockFor, onWallTouch,
    navFlags: () => ({ gateOpen: S.gateOpen, shedOpen: doorOpen() }),
    wallSpots: () => levers.map((b) => b.spot),
    onBark: (c) => {
      if (!S.gateOpen) goose.onBark(c);
      if (pigeonAround() && Math.hypot(c.x - PIGEON.x, c.z - PIGEON.z) < 3.4) hints.now('pigeonBark', 3, 5);
    },
    lookTarget: (c) => {
      if (inHouse(c) && Math.hypot(c.x - PAINTING.x, c.z - PAINTING.z) < 2.4) return at(PAINTING.x, PAINTING.z, PAINTING.y);
      if (pigeonAround() && Math.hypot(c.x - PIGEON.x, c.z - PIGEON.z) < 2.6) return at(PIGEON.x, PIGEON.z, PIGEON.y);
      if (S.place.hat === 'home' && Math.hypot(c.x - POOL.x, c.z - POOL.z) < POOL.r + 0.9) return at(S.boatX, S.boatZ, 0.3);
      if (Math.hypot(c.x - goose.x, c.z - goose.z) < 2.5) return at(goose.x, goose.z, 0.45);
      return null;
    },
    setPrompt: (kind) => hints.setPrompt(kind),
    endActions() {
      if (S.deck || S.ramp || S.hop || S.riding || S.onDeck || S.climb) { S.riding = false; finishScript(ctrls.radhija); }
    },
    speedScale: (c) => mud.speedScale(c.name),
    canDash: (c) => mud.canDash(c.name),
    onDashBlocked: (c) => { if (mud.muddy(c.name)) hints.now('noDash', 3.4, 5); },
    onLick,
    onLickMiss: (c, miss) => { if (mud.muddy('radhija')) hints.now('lickFar', 2.8, 4); void miss; },
    /** Testes e capturas: põe o caixote num ponto (dentro dos limites), sem empurrão. */
    placeCrate(id, x, z) {
      if (id !== 'caixote') return;
      crate.setPos(Math.min(CRATE.maxX, Math.max(CRATE.minX, x)), Math.min(CRATE.maxZ, Math.max(CRATE.minZ, z ?? crate.z)));
    },
    /** Testes e capturas: atalhos de estado (água cheia, energia, portão, pombo, porta). */
    debugSet(key, value = true) {
      if (key === 'water') { S.water = value ? 1 : 0; S.full = !!value; }
      if (key === 'power') breaker.setOn(!!value);
      if (key === 'tap') tap.setOn(!!value);
      if (key === 'gate') { S.gateOpen = !!value; if (value) gate.lock(); }
      if (key === 'pigeon') { S.pigeon = value ? 'gone' : 'asleep'; props.pigeon.object.visible = !value; }
      if (key === 'clean') mud.set('radhija', value ? 0 : 1);
      if (key === 'doorButton') S.doorBtn = value ? 1 : 0;
      if (key === 'shed') { if (value) openShed(); }
      if (key === 'stairs') { S.drawers.forEach((d, i) => { d.ext = [0.42, 0.28, 0.14][i]; d.fallen = false; }); }
      if (key === 'secret') { S.secretReady = !!value; props.secretBoard.setLoose(!!value); }
    },
    dispose() { S.disposed = true; },
    info: () => ({
      quintal: {
        stage: stage(), cake: [...S.cake], place: { ...S.place }, floor: JSON.parse(JSON.stringify(S.floor)), wrong: S.wrong,
        lookedPainting: S.lookedPainting, rejecting: !!S.reject,
        water: +S.water.toFixed(3), flowing: S.flowing, full: S.full, power: power(), powerStage: S.powerStage, tap: tap.on, crateOnHose: crateOnHose(),
        crate: crate.info(), boat: { x: +S.boatX.toFixed(3), z: +S.boatZ.toFixed(3), docked: S.docked },
        gateOpen: S.gateOpen, gate: gate.info(), goose: goose.info(), pigeon: S.pigeon,
        rope: { holder: handle.holder, pulled: +S.pulled.toFixed(3) }, bucket: { y: +S.bucketY.toFixed(3), riding: S.riding, tilt: +S.bucketTilt.toFixed(3) },
        deck: S.deck ? S.deck.phase : S.onDeck ? 'free' : null, onDeck: S.onDeck, deckAction: deckAction(ctrls.radhija),
        sawPigeon: S.sawPigeon, ramp: S.ramp ? S.ramp.phase : null, door: +S.doorT.toFixed(3), doorOpen: doorOpen(),
        mud: mud.info('radhija'), inHorta: { radhija: inHorta(ctrls.radhija), rhaenyra: inHorta(ctrls.rhaenyra) },
        shed: { doorBtn: S.doorBtn, open: S.shedOpen, sty: S.styOpen }, pigs: pigs.info(),
        drawers: S.drawers.map((d) => ({ ext: +d.ext.toFixed(3), fallen: d.fallen })), drawerHold: S.drawerHold ? S.drawerHold.i : null,
        climb: S.climb ? S.climb.phase : null, stairs: stairsReady(),
        pinata: { ax: +S.pin.ax.toFixed(3), az: +S.pin.az.toFixed(3), hits: S.pin.hits, broken: S.pin.broken, ...(() => { const p = pinataPos(); return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) }; })() },
        veg: { held: { radhija: S.veg.held.radhija?.kind ?? null, rhaenyra: S.veg.held.rhaenyra?.kind ?? null }, floor: S.veg.floor.length },
        secret: { ready: S.secretReady, open: S.secretOpen, seen: S.secretSeen },
        levers: { breaker: breaker.info(), tap: tap.info() },
      },
      hat: { holder: items.hat.holder }, ribbon: { holder: items.ribbon.holder }, candle: { holder: items.candle.holder },
      cookie: { holder: items.cookie.holder }, star: { holder: items.star.holder },
      objective: objective(ctx.activeDog).text,
    }),
    get stage() { return stage(); },
    get carrier() { return THINGS.map((t) => items[t].holder).find(Boolean) || null; },
    carries: (name) => !!carriedBy(name) || handle.holder === name || !!S.veg.held[name] || S.drawerHold?.who === name,
    get collected() { return cols.count; }, get total() { return cols.total; },
    set onStageChange(fn) { onStageChange = fn; },
  };
}
