// Biblioteca do Vovô · puzzle. Tudo avança por dt (pausa congela a porta, o gato, a subida e o duto).
//   ÓCULOS: na prateleira alta da estante leste. A Rhaenyra puxa a alavanca do freio da escadinha (impulso na
//     parede; um cabo leva até a trava da roda), empurra o globo para a frente da lareira e a escadinha pelo trilho
//     até debaixo dos óculos. Destravada, a escada rola com peso em cima: a Rhaenyra segura o pé dela (E no pé da
//     escada, ou o Fica) e continua segurando quando o jogador troca; a Radhija sobe (E), pega os óculos e desce.
//     Sem ninguém segurando, a escada rola e a Radhija desce de novo.
//   LIVRO: no alto do armário do escritório, com o Bichano dormindo em cima. No jardim de inverno, a Rhaenyra liga
//     o disjuntor (impulso: energia para a lanterna, as luzinhas e a tomada), liga o ventilador no botão da base (E),
//     empurra o ventilador até a grade de baixo do duto e o vaso de rodinhas até o botão do chão (o peso abre o
//     registro da grade). O superbafo da
//     Radhija no vento entra no duto e sai pela grade alta do escritório: o Bichano pula, derruba o livro e sai pela
//     portinha de gato.
//     A porta do escritório abre com o impulso na maçaneta e a mola fecha de novo; com alguém no vão, ela espera.
//     Com o livro (pesado, só a Rhaenyra carrega) na boca não dá impulso: presa lá dentro, ela larga o livro (E).
//   Entrega: os dois objetos na mesinha ao lado da poltrona. Nenhuma ordem trava e tudo se refaz. Com algo na boca,
//   E larga no chão (E perto pega de volta; o livro, só a Rhaenyra); largado de frente para a mesinha, fica nela.
import { createCarryItem, createCollectibles, createHints, reach, deliveredAt, inZones, mouthPoint } from '../../game/puzzleKit.js';
import { createPushCrate, createWallButton, createHingedGate, createPressurePlate } from '../../game/mechanics/index.js';
import { airborne, wallKick } from '../../game/dogController.js';
import { planStep, driveStep } from '../../game/mechanics/mouthTug.js';
import {
  WALL_EH, DOOR, DOOR_HANDLE, DOOR_HANDLE_IN, WARDROBE, BOOK_FALL, CAT, LADDER, GLOBE, GLASSES, LADDER_HOLD, CLIMB,
  BRAKE_LEVER, TABLE_SPOTS, DUCT, BREAKER, PLANTER, DAMPER_PLATE, FAN, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R, WALL_HL,
  WALL_LJ,
} from './layout.js';

/**
 * @typedef {'start'|'glasses'|'book'|'carrying'|'done'} Stage
 * @typedef {'shelf'|'carried'|'floor'|'table'} GlassesPlace
 * @typedef {'wardrobe'|'falling'|'floor'|'carried'|'table'} BookPlace
 * @typedef {'asleep'|'waking'|'jumping'|'walking'|'bed'} CatState
 */
/** @type {Stage[]} */
export const STAGES = ['start', 'glasses', 'book', 'carrying', 'done'];
export const TEXT = {
  objective: {
    brakeRh: 'A escadinha está travada: pegue impulso nas patinhas e puxe a alavanca do freio (Espaço)',
    brakeRad: 'Os óculos estão no alto da estante: a Rhaenyra solta o freio da escadinha (Q)',
    globe: 'O globo está no trilho: empurre-o até a frente da lareira (segure Shift)',
    ladder: 'Empurre a escadinha pelo trilho até debaixo dos óculos (segure Shift)',
    pushRad: 'Só a Rhaenyra empurra: troque (Q)',
    holdRh: 'Segure o pé da escadinha (E no pé dela) e troque para a Radhija (Q)',
    holdNow: 'A Rhaenyra segura a escadinha! Troque para a Radhija (Q) e suba',
    climbRad: 'A escadinha está firme: suba (E) e pegue os óculos',
    holdRad: 'A escadinha rola com peso em cima: a Rhaenyra precisa segurar o pé dela (Q)',
    carryGlasses: 'Leve os óculos até a mesinha da poltrona',
    pickGlasses: 'Pegue os óculos de volta (E)',
    powerRh: 'O Bichano dorme em cima do livro. O jardim de inverno está sem luz: ligue o disjuntor no alto da parede (Espaço)',
    powerRad: 'O Bichano dorme em cima do livro. A Rhaenyra liga o disjuntor do jardim de inverno (Q)',
    fanOn: 'Luz! Agora ligue o ventilador: o botão vermelho fica na base dele (E)',
    fanRh: 'Empurre o ventilador até a grade de baixo do duto (segure Shift)',
    fanRad: 'O ventilador é pesado: a Rhaenyra empurra até a grade do duto (Q)',
    planterRh: 'O registro da grade abre com peso no botão do chão: empurre o vaso de rodinhas até lá (segure Shift)',
    planterRad: 'O vaso de rodinhas é pesado: a Rhaenyra empurra até o botão do registro (Q)',
    blowRad: 'Solte o superbafo na frente do ventilador, no vento (segure R e solte)',
    blowRh: 'Vento no duto! Agora o superbafo da Radhija (Q)',
    cat: 'O Bichano acordou!',
    doorRh: 'O livro caiu! Abra a porta do escritório: impulso na maçaneta (Espaço)',
    doorRad: 'O livro caiu no escritório: a Rhaenyra abre a porta com o impulso (Q)',
    holdDoorRad: 'Fique no vão da porta para ela não fechar (F) e troque para a Rhaenyra (Q)',
    holdDoorRh: 'A porta fecha sozinha: a Radhija segura o vão (Q, depois F)',
    bookRh: 'Pegue o livro (E) e leve até a mesinha da poltrona',
    bookRad: 'O livro é pesado: só a Rhaenyra carrega (Q)',
    carryBook: 'Leve o livro até a mesinha da poltrona',
    dropBook: 'Com o livro na boca não dá impulso: largue o livro (E) e abra a porta',
  },
  hint: {
    braked: 'A escadinha está travada! A alavanca do freio fica no alto da parede.',
    released: 'Soltou o freio! Agora a escadinha anda no trilho.',
    globeWay: 'O globo está no caminho da escadinha: empurre-o para a frente da lareira.',
    shift: 'Segure Shift para empurrar.',
    heavy: 'Pesado demais para a Radhija: a Rhaenyra empurra (Q, segure Shift).',
    roll: 'A escadinha rolou! Alguém pesado precisa segurar o pé dela (a Rhaenyra: E no pé da escada).',
    climbRh: 'A escadinha é estreita para a Rhaenyra: ela segura, a Radhija sobe.',
    farGlasses: 'Daqui de cima não alcança: a escadinha precisa ficar debaixo dos óculos.',
    gotGlasses: 'Pegou os óculos do vovô!',
    wallRadhija: 'Alto demais para a Radhija! A Rhaenyra pega impulso nas patinhas da parede (Q).',
    catBark: 'O Bichano nem abriu o olho. Um latido não resolve…',
    catHigh: 'Daqui de baixo o cheiro não chega lá em cima. A grade do aquecedor sopra bem em cima do armário…',
    catSleep: 'Psiu! O Bichano dorme lá no alto, em cima do livro.',
    powerOn: 'Luz! O disjuntor ligou a energia do jardim de inverno: o ventilador já gira.',
    noPower: 'Sem energia o ventilador não liga. O disjuntor fica no alto da parede de tijolos.',
    fanOff: 'O ventilador está desligado: o botão vermelho fica na base dele (E).',
    fanStarted: 'O ventilador ligou!',
    fanStopped: 'Desligou o ventilador.',
    damperOpen: 'O peso do vaso abriu o registro: a grade do duto está aberta até o escritório.',
    damperClosed: 'O registro da grade está fechado: o botão do chão precisa do vaso de rodinhas em cima.',
    plateLight: 'O botão do registro é duro: só o vaso de terra pesa o bastante. Empurre o vaso até aqui.',
    noWind: 'Sem vento, o cheiro não entra na grade. Traga o ventilador!',
    holdTip: 'A Rhaenyra segura a escadinha. Troque para a Radhija (Q) e suba!',
    letGo: 'A Rhaenyra soltou a escadinha.',
    aligned: 'O ventilador sopra direto na grade do duto!',
    duct: 'O cheiro foi pelo duto!',
    catWake: 'O Bichano acordou ofendido! Lá vai o livro…',
    bookFell: 'O livro caiu no chão do escritório!',
    doorLocked: 'A porta está fechada. A maçaneta fica no alto: a Rhaenyra alcança com o impulso.',
    doorClosing: 'A mola fecha a porta! Alguém precisa ficar no vão (Fica).',
    bookHeavy: 'O livro é pesado demais para a Radhija. A Rhaenyra carrega!',
    bookNoJump: 'Com o livro na boca não dá impulso. Largue o livro (E) e abra a porta.',
    dropped: 'Largou o livro.',
    gotBook: 'Pegou o livro de histórias!',
    mouthFull: 'A boca já está ocupada!',
    glassesHome: 'Os óculos estão na mesinha!',
    bookHome: 'O livro está na mesinha!',
    needBook: 'Falta o livro: o Bichano dorme em cima dele, no alto do armário do escritório.',
    needGlasses: 'Falta os óculos: estão no alto da estante, perto da escadinha.',
  },
  prompt: {
    climb: 'Subir a escadinha', book: 'Pegar o livro', drop: 'Largar o livro', wall: 'Impulso na parede',
    hold: 'Segurar a escadinha', letGo: 'Soltar a escadinha', fan: 'Ligar o ventilador', fanOff: 'Desligar o ventilador',
    glasses: 'Pegar os óculos', dropGlasses: 'Largar os óculos',
  },
};

const clamp01 = (k) => Math.min(1, Math.max(0, k));
const smooth = (k) => { const x = clamp01(k); return x * x * (3 - 2 * x); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const NORTH = Math.PI;
const SOUTH = 0;
const LADDER_SPOT = LADDER.minX; // a escada debaixo dos óculos
const GLOBE_CLEAR = LADDER_SPOT - LADDER.half - GLOBE.half + 0.01; // globo a oeste disto não atrapalha
const STEP_RISE = LADDER.top / LADDER.steps;

/** @param {import('../../types').PuzzleContext<import('../../types').Fase9Props>} ctx @returns {import('../../types').Puzzle} */
export function createPuzzle(ctx) {
  const { props, dogs, ctrls, root, emit, world, place, scent, cam } = ctx;
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const brake = createWallButton({ id: 'alavanca-freio', cfg: BRAKE_LEVER, emit, prop: props.brakeLever });
  const breaker = createWallButton({ id: 'disjuntor', cfg: BREAKER, emit, prop: props.breaker });
  const handle = createWallButton({ id: 'macaneta', cfg: DOOR_HANDLE, emit, prop: props.doorHandle });
  const handleIn = createWallButton({ id: 'macaneta-dentro', cfg: DOOR_HANDLE_IN, emit, prop: props.doorHandleIn });
  const levers = [brake, breaker, handle, handleIn];
  const ladder = createPushCrate({ id: 'escadinha', cfg: LADDER, world, emit, prop: props.ladder });
  const globe = createPushCrate({ id: 'globo', cfg: GLOBE, world, emit, prop: props.globe });
  const fan = createPushCrate({ id: 'ventilador', cfg: FAN, world, emit, prop: props.fan });
  const planter = createPushCrate({ id: 'vaso', cfg: PLANTER, world, emit, prop: props.planter });
  const crates = [ladder, globe, fan, planter];
  // botão do registro no chão: só o vaso pesa o bastante (as dogs não contam)
  const plate = createPressurePlate({ id: 'botao-registro', x: DAMPER_PLATE.x, z: DAMPER_PLATE.z, hx: DAMPER_PLATE.hx, hz: DAMPER_PLATE.hz, emit, prop: props.plate });
  const door = createHingedGate({ id: 'porta-escritorio', cfg: DOOR, world, prop: props.door, thickness: 0.05 });
  const glasses = createCarryItem({ obj: props.glasses.object, dogs, scene: root, name: 'glasses', emit, world });
  const book = createCarryItem({ obj: props.book.object, dogs, scene: root, name: 'book', carrier: 'large', emit, world });
  /**
   * Largado, nada fica na mesinha da poltrona (lá é a entrega), no botão do registro, na almofada do Bichano, no vão da
   * porta do escritório (por onde a folha passa) nem na portinha de gato.
   */
  const dropAvoid = inZones([
    GOAL, DAMPER_PLATE, { x: CAT.bed.x, z: CAT.bed.z, r: 0.35 },
    { minX: WALL_EH.x - 1.05, maxX: WALL_EH.x + 0.3, minZ: DOOR.latchPost.z - 0.25, maxZ: DOOR.hinge.z + 0.15 },
    { minX: WALL_EH.x - 0.3, maxX: WALL_EH.x + 0.3, minZ: WALL_EH.catFlap.z0 - 0.1, maxZ: WALL_EH.catFlap.z1 + 0.1 },
  ], 0.06);
  // o gato deitado na almofada do hall é sólido (as dogs não passam por cima dele)
  const catCol = world.addDynamic({ id: 'gato', kind: 'npc', shape: 'circle', x: CAT.bed.x, z: CAT.bed.z, r: 0.2, enabled: /** @type {boolean} */ (false) });

  const fresh = () => ({
    done: false, disposed: false, objKey: '',
    /** @type {GlassesPlace} */ glasses: /** @type {GlassesPlace} */ ('shelf'),
    /** @type {BookPlace} */ book: /** @type {BookPlace} */ ('wardrobe'),
    bookX: BOOK_FALL.x, bookZ: BOOK_FALL.z, fallT: -1,
    /** @type {CatState} */ cat: /** @type {CatState} */ ('asleep'),
    catT: 0, catD: 0, catX: CAT.top.x, catZ: CAT.top.z,
    /** @type {null | { phase: string, t: number, x0: number, z0: number, yaw0: number, grabbed: boolean, lx: number, action?: string, slope?: number, fx?: number, fy?: number, fz?: number, fyaw?: number }} */
    climb: null,
    climbDt: 1 / 60, rollFrom: 0, rollTo: 0,
    aligned: false, wasDoorOpen: false, doorHintT: 0, ductHint: false, wasAligned: false,
    holdLadder: false, wasDamper: false, introT: 0, fanOn: false,
    /** Apertando o botão do ventilador com a pata (quem e há quanto tempo); null = ninguém. */
    press: /** @type {null | { who: string, t: number, done: boolean, step: import('../../game/mechanics/mouthTug.js').Step | null }} */ (null),
    /** E com o objeto na boca, de frente para a mesinha: ele fica nela neste quadro (no update). */
    dropDeliver: /** @type {'glasses' | 'book' | null} */ (null),
  });
  const S = fresh();
  let introDone = false; // a apresentação (óculos e o Bichano) só uma vez por carregamento da fase
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  let lastStage = /** @type {Stage} */ ('start');
  const at = (x, z, y = 0.7) => ({ x, y, z });
  const inOffice = (c) => c.x < WALL_EH.x;
  const inConservatory = (c) => c.x > WALL_LJ.x;
  const westSide = (c) => c.x < WALL_HL.x;
  const ladderAtGlasses = () => Math.abs(ladder.x - LADDER_SPOT) < 0.06;
  const globeClear = () => globe.x <= GLOBE_CLEAR;
  const doorOpen = () => door.t > 0.85;
  const inDoorway = (c) => Math.abs(c.x - WALL_EH.x) < 0.42 && c.z > DOOR.latchPost.z - 0.05 && c.z < DOOR.hinge.z + 0.05;
  const bookInOffice = () => S.book === 'wardrobe' || S.book === 'falling' || (S.book === 'floor' && S.bookX < WALL_EH.x);

  // ------------------------------------------------------------------ etapa (derivada do estado)
  /** @returns {Stage} */
  function stage() {
    if (S.done) return 'done';
    const gOut = S.glasses !== 'shelf';
    const bOut = S.book === 'floor' || S.book === 'carried' || S.book === 'table';
    if (gOut && bOut) return 'carrying';
    if (gOut) return 'glasses';
    if (bOut) return 'book';
    return 'start';
  }
  function notifyStage() {
    const st = stage();
    if (st !== lastStage) { lastStage = st; onStageChange(st); }
  }

  // ------------------------------------------------------------------ segurar a escada
  /** Onde a Rhaenyra segura (o lado mais perto dela). */
  function holdSpot(c = ctrls.rhaenyra) {
    const side = c.x < ladder.x ? -1 : 1;
    return { x: ladder.x + side * LADDER_HOLD.side, z: LADDER_HOLD.z };
  }
  const inHoldZone = (c) => [-1, 1].some((s) => Math.hypot(c.x - (ladder.x + s * LADDER_HOLD.side), c.z - LADDER_HOLD.z) < LADDER_HOLD.r);
  /** A escada está firme: travada no freio ou segura pela Rhaenyra no pé dela (E para segurar, ou o Fica). */
  const held = () => inHoldZone(ctrls.rhaenyra) && (S.holdLadder || ctx.isStaying('rhaenyra'));
  const damperOpen = () => plate.pressed;
  const power = () => breaker.on;
  function holdLadder(on) {
    if (S.holdLadder === on) return;
    S.holdLadder = on;
    ctx.setStay?.('rhaenyra', on);
    const c = ctrls.rhaenyra;
    emit(on ? 'ladder:hold' : 'ladder:letGo', { name: 'rhaenyra', x: c.x, z: c.z });
  }
  const steady = () => !brake.on || held();

  // ------------------------------------------------------------------ objetivo
  /** O que falta dos óculos para quem está ativa. */
  function glassesStep(name) {
    const O = TEXT.objective;
    // largados no chão: pegar de volta (qualquer uma leva)
    const gf = S.glasses === 'floor' ? glasses.floor : null;
    if (gf) return { text: O.pickGlasses, target: at(gf.x, gf.z, 0.3) };
    if (!brake.on) return name === 'rhaenyra' ? { text: O.brakeRh, target: brake.target(0.3) } : { text: O.brakeRad, target: brake.target(0.3) };
    if (!globeClear()) return { text: name === 'rhaenyra' ? O.globe : O.pushRad, target: at(globe.x, globe.z, 0.95) };
    if (!ladderAtGlasses()) return { text: name === 'rhaenyra' ? O.ladder : O.pushRad, target: at(ladder.x, ladder.z, 1.5) };
    if (name === 'rhaenyra') {
      const h = holdSpot();
      return held() ? { text: O.holdNow, target: at(ladder.x, ladder.z + LADDER.half + CLIMB.front, 0.6) } : { text: O.holdRh, target: at(h.x, h.z, 0.4) };
    }
    return held() ? { text: O.climbRad, target: at(GLASSES.x, GLASSES.z, GLASSES.y + 0.3) } : { text: O.holdRad, target: at(holdSpot().x, LADDER_HOLD.z, 0.5) };
  }
  /** O que falta do livro para quem está ativa. */
  function bookStep(name) {
    const O = TEXT.objective;
    if (S.cat === 'asleep') {
      if (!power()) return { text: name === 'rhaenyra' ? O.powerRh : O.powerRad, target: breaker.target(0.3) };
      if (!S.fanOn) return { text: O.fanOn, target: at(fan.x, fan.z + 0.12, 0.25) };
      if (!S.aligned) return { text: name === 'rhaenyra' ? O.fanRh : O.fanRad, target: at(fan.x, fan.z, 1.1) };
      if (!damperOpen()) return { text: name === 'rhaenyra' ? O.planterRh : O.planterRad, target: at(planter.x, planter.z, 1.0) };
      return { text: name === 'radhija' ? O.blowRad : O.blowRh, target: at(fan.x, fan.z - FAN.half - 0.55, 0.5) };
    }
    if (S.cat === 'waking' || S.cat === 'jumping' || S.book === 'falling') return { text: O.cat, target: at(CAT.top.x, CAT.top.z, CAT.top.y + 0.4) };
    if (S.book === 'carried') return { text: O.carryBook, target: at(GOAL.x, GOAL.z, 0.6) };
    const rh = ctrls.rhaenyra;
    const rad = ctrls.radhija;
    const bookAt = at(S.bookX, S.bookZ, 0.45);
    if (bookInOffice() && !inOffice(rh)) {
      if (!doorOpen()) return { text: name === 'rhaenyra' ? O.doorRh : O.doorRad, target: handle.target(0.3) };
      if (!inDoorway(rad)) return { text: name === 'radhija' ? O.holdDoorRad : O.holdDoorRh, target: at(WALL_EH.x, (DOOR.hinge.z + DOOR.latchPost.z) / 2, 0.5) };
    }
    return { text: name === 'rhaenyra' ? O.bookRh : O.bookRad, target: bookAt };
  }
  /** @param {import('../../types').DogName} activeName */
  function objective(activeName) {
    const O = TEXT.objective;
    const st = stage();
    if (st === 'done') return { text: null, target: null, stage: st };
    const goal = at(GOAL.x, GOAL.z, 0.9);
    if (glasses.holder === activeName) return { text: O.carryGlasses, target: goal, stage: st };
    if (book.holder === activeName) {
      if (inOffice(ctrls[activeName]) && !doorOpen() && !inDoorway(ctrls.radhija)) return { text: O.dropBook, target: handleIn.target(0.3), stage: st };
      return { text: O.carryBook, target: goal, stage: st };
    }
    const gPending = S.glasses === 'shelf' || S.glasses === 'floor';
    const bPending = S.book !== 'table' && !book.holder;
    const c = ctrls[activeName];
    // o que tem pressa primeiro: a porta aberta com o livro lá dentro, a escada segura esperando a Radhija
    const urgentBook = bPending && S.cat !== 'asleep' && bookInOffice() && doorOpen();
    const preferBook = bPending && (urgentBook || inConservatory(c) || (westSide(c) && S.cat !== 'asleep') || inOffice(c) || !gPending);
    const step = preferBook ? bookStep(activeName) : gPending ? glassesStep(activeName) : null;
    if (step) return { ...step, stage: st };
    return { text: glasses.holder ? O.carryGlasses : O.carryBook, target: goal, stage: st };
  }

  // ------------------------------------------------------------------ óculos e escadinha
  function grabGlasses(c) {
    glasses.attach(c.name);
    props.glasses.setHighlight(false);
    S.glasses = 'carried';
    emit('item:pickup', { name: c.name, item: 'glasses', x: GLASSES.x, z: GLASSES.z });
    hints.now('gotGlasses', 3, 0);
    notifyStage();
  }
  /** A Radhija começa a subir (escada firme) ou sobe um degrau e a escada rola (ninguém segurando). */
  function startClimb(c) {
    const ok = steady();
    S.climb = { phase: ok ? 'up' : 'slipUp', t: 0, x0: c.x, z0: c.z, yaw0: c.yaw, grabbed: false, lx: ladder.x };
    if (!ok) {
      S.rollFrom = ladder.x;
      S.rollTo = Math.min(LADDER.maxX, ladder.x + LADDER.rollBack);
    }
    emit(ok ? 'ladder:climb' : 'ladder:slip', { name: c.name, x: ladder.x, z: ladder.z });
  }
  /** Pose roteirizada de quem está na escada (lockFor devolve drive). */
  function pose(c, x, y, z, yaw, speed, action, slope = 0) {
    const px = c.x;
    const pz = c.z;
    c.x = x;
    c.z = z;
    c.y = y;
    c.yaw = yaw;
    c.v = 0;
    c.dashT = 0;
    c.animSpeed = speed;
    const idt = 1 / Math.max(1e-4, S.climbDt);
    c.vx = (c.x - px) * idt;
    c.vz = (c.z - pz) * idt;
    S.climb.action = action;
    S.climb.slope = slope;
  }
  /** Ponto do degrau i (0 = chão na frente, 1..steps-1 = degraus, steps = patamar) para a escada em lx. */
  function stepPoint(i, lx) {
    const front = LADDER.start.z + LADDER.half;
    const z0 = front + 0.18;
    const zTop = LADDER.start.z - LADDER.half + 0.2;
    const k = i / LADDER.steps;
    return { x: lx, y: i === 0 ? 0 : i * STEP_RISE, z: i === 0 ? z0 : front - 0.08 + (zTop - (front - 0.08)) * ((i - 1) / (LADDER.steps - 1)) * (i < LADDER.steps ? 1 : 1) + (i === LADDER.steps ? 0 : 0) * k };
  }
  /** Interpolação com pulinho entre os degraus a e b (u 0..1). */
  function hop(a, b, u) {
    const e = smooth(u);
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e + Math.sin(Math.PI * u) * 0.09, z: a.z + (b.z - a.z) * e };
  }
  function stepClimb(dt) {
    const cl = S.climb;
    if (!cl) return;
    const c = ctrls.radhija;
    S.climbDt = dt;
    cl.t += dt;
    const n = LADDER.steps;
    const slope = Math.atan2(LADDER.top, 0.66) * 0.55;
    // a Rhaenyra soltou no meio da subida (desligou o Fica ou saiu do pé da escada): a escada rola e a Radhija desce
    if ((cl.phase === 'up' || (cl.phase === 'grab' && !cl.grabbed)) && !steady()) {
      S.rollFrom = cl.lx;
      S.rollTo = Math.min(LADDER.maxX, cl.lx + LADDER.rollBack);
      Object.assign(cl, { phase: 'fall', t: 0, fx: c.x, fy: c.y, fz: c.z, fyaw: c.yaw });
      emit('ladder:slip', { name: c.name, x: cl.lx, z: ladder.z });
    }
    if (cl.phase === 'up') {
      const u = clamp01(cl.t / CLIMB.upTime);
      const f = u * n;
      const i = Math.min(n - 1, Math.floor(f));
      const p = hop(i === 0 ? { x: cl.x0, y: 0, z: cl.z0 } : stepPoint(i, cl.lx), stepPoint(i + 1, cl.lx), f - i);
      const k = smooth(cl.t / 0.2);
      pose(c, p.x, p.y, p.z, cl.yaw0 + wrap(NORTH - cl.yaw0) * k, 1.4, 'jump', slope * (u < 0.95 ? 1 : 0));
      if (u >= 1) Object.assign(cl, { phase: 'grab', t: 0 });
    } else if (cl.phase === 'grab') {
      const u = clamp01(cl.t / CLIMB.grabTime);
      const top = stepPoint(n, cl.lx);
      pose(c, top.x, top.y, top.z - 0.04 * smooth(u / 0.5), NORTH, 0, u > 0.25 ? 'sniff' : 'none', u > 0.25 && u < 0.85 ? 0.35 : 0);
      if (!cl.grabbed && u >= 0.6) {
        cl.grabbed = true;
        if (S.glasses === 'shelf' && Math.abs(cl.lx - GLASSES.x) < 0.08 && !glasses.holder) grabGlasses(c);
        else if (S.glasses === 'shelf') hints.now('farGlasses', 3.6, 2);
      }
      if (u >= 1) Object.assign(cl, { phase: 'turn', t: 0 });
    } else if (cl.phase === 'turn') {
      const u = clamp01(cl.t / 0.45);
      const top = stepPoint(n, cl.lx);
      pose(c, top.x, top.y, top.z, wrap(NORTH + Math.PI * smooth(u)), 0.6, 'none', 0);
      if (u >= 1) Object.assign(cl, { phase: 'down', t: 0 });
    } else if (cl.phase === 'down') {
      const u = clamp01(cl.t / CLIMB.downTime);
      const f = u * n;
      const i = Math.min(n - 1, Math.floor(f));
      const from = stepPoint(n - i, cl.lx);
      const to = n - i - 1 === 0 ? { x: cl.lx, y: 0, z: stepPoint(0, cl.lx).z + 0.12 } : stepPoint(n - i - 1, cl.lx);
      const p = hop(from, to, f - i);
      pose(c, p.x, p.y, p.z, SOUTH, 1.4, 'jump', -slope * (u < 0.95 ? 1 : 0));
      if (u >= 1) finishClimb(c);
    } else if (cl.phase === 'slipUp') {
      // um degrau e a escada rola para o leste com ela em cima
      const u = clamp01(cl.t / (CLIMB.slipTime * 0.55));
      const lx = S.rollFrom + (S.rollTo - S.rollFrom) * smooth((u - 0.35) / 0.65);
      ladder.setPos(lx, ladder.z);
      // stepPoint já acompanha a escada rolando (lx)
      const p = hop({ x: cl.x0, y: 0, z: cl.z0 }, stepPoint(1, lx), Math.min(1, u * 1.6));
      const k = smooth(cl.t / 0.2);
      pose(c, p.x, p.y, p.z, cl.yaw0 + wrap(NORTH - cl.yaw0) * k, 0.8, u > 0.5 ? 'startled' : 'jump', 0);
      if (u >= 1) {
        Object.assign(cl, { phase: 'slipDown', t: 0, lx });
        emit('ladder:roll', { x: lx, z: ladder.z });
      }
    } else if (cl.phase === 'fall') {
      // a escada rola para o leste e ela pula de onde estava para o chão, na frente dos degraus
      const u = clamp01(cl.t / (CLIMB.slipTime * 0.75));
      const lx = S.rollFrom + (S.rollTo - S.rollFrom) * smooth(u / 0.6);
      ladder.setPos(lx, ladder.z);
      const p = hop({ x: cl.fx, y: cl.fy, z: cl.fz }, { x: cl.fx, y: 0, z: stepPoint(0, S.rollFrom).z + 0.16 }, u);
      pose(c, p.x, p.y, p.z, cl.fyaw, 0, 'startled', 0);
      if (u >= 1) {
        emit('ladder:roll', { x: lx, z: ladder.z });
        hints.now('roll', 4.2, 2);
        finishClimb(c);
      }
    } else if (cl.phase === 'slipDown') {
      const u = clamp01(cl.t / (CLIMB.slipTime * 0.45));
      const from = stepPoint(1, cl.lx);
      const p = hop(from, { x: cl.lx, y: 0, z: stepPoint(0, cl.lx).z + 0.16 }, u);
      pose(c, p.x, p.y, p.z, NORTH, 0, 'startled', 0);
      if (u >= 1) {
        hints.now('roll', 4.2, 2);
        finishClimb(c);
      }
    }
  }
  function finishClimb(c) {
    const res = world.resolve(c.x, c.z, c.r, c.size);
    c.x = res.x;
    c.z = res.z;
    c.y = 0;
    c.vx = c.vz = 0;
    c.v = 0;
    c.animSpeed = 0;
    emit('ladder:down', { name: c.name, x: c.x, z: c.z });
    S.climb = null;
    notifyStage();
  }

  // ------------------------------------------------------------------ duto, ventilador e o Bichano
  const wind = scent.addWind({ id: 'ventilador', x: FAN.start.x, z: FAN.start.z - FAN.wind.offset, dirX: 0, dirZ: -1, ...FAN.wind });
  const duct = scent.addDuct({ id: 'duto', inlet: DUCT.inlet, outlet: DUCT.outlet, travel: DUCT.travel, active: () => damperOpen() && S.aligned && power() && S.fanOn });
  scent.addNose({
    id: 'bichano', x: CAT.top.x, z: CAT.top.z, r: CAT.smellR,
    onSmell: (cloud) => {
      if (S.cat !== 'asleep') return;
      if (/** @type {any} */ (cloud).duct === duct) {
        cloud.age = cloud.life; // a grade solta o cheiro bem em cima dele (o cenário desenha a baforada)
        props.duct.outletPuff();
        wakeCat();
      } else hints.now('catHigh', 4.4, 6);
    },
  });
  function wakeCat() {
    S.cat = 'waking';
    S.catT = 0;
    emit('cat:wake', { x: CAT.top.x, z: CAT.top.z, y: CAT.top.y });
    hints.now('catWake', 3.4, 0);
    cam?.focusShot(CAT.top.x + 0.6, CAT.top.z + 1.4, { hold: 2.6, y: 1.4, target: { x: CAT.top.x, y: CAT.top.y - 0.6, z: CAT.top.z + 0.4 } });
  }
  /** Ponto do caminho do gato a uma distância d (desde o pé do armário). */
  function catPathAt(d) {
    const pts = CAT.path;
    let left = d;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const L = Math.hypot(b.x - a.x, b.z - a.z);
      if (left <= L) {
        const k = left / Math.max(1e-6, L);
        return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: Math.atan2(b.x - a.x, b.z - a.z), end: false };
      }
      left -= L;
    }
    const z = pts[pts.length - 1];
    const y = pts[pts.length - 2];
    return { x: z.x, z: z.z, yaw: Math.atan2(z.x - y.x, z.z - y.z), end: true };
  }
  function stepCat(dt) {
    if (S.cat === 'asleep' || S.cat === 'bed') return;
    S.catT += dt;
    const T = CAT.top;
    if (S.cat === 'waking') {
      props.cat.setPose({ x: T.x, y: T.y, z: T.z, yaw: 0.4, mode: 'wake', k: clamp01(S.catT / 1.1) });
      if (S.catT >= 1.1) {
        S.cat = 'jumping';
        S.catT = 0;
        S.book = 'falling';
        S.fallT = 0;
        props.book.setFall(0);
        emit('cat:jump', { x: T.x, z: T.z, y: T.y });
        emit('book:fall', { x: BOOK_FALL.x, z: BOOK_FALL.z });
      }
    } else if (S.cat === 'jumping') {
      const u = clamp01(S.catT / 0.7);
      const p0 = CAT.path[0];
      const e = smooth(u);
      props.cat.setPose({
        x: T.x + (p0.x - T.x) * e, y: T.y * (1 - u * u) + Math.sin(Math.PI * u) * 0.25, z: T.z + (p0.z - T.z) * e,
        yaw: Math.atan2(p0.x - T.x, p0.z - T.z), mode: 'jump', k: u,
      });
      if (u >= 1) {
        S.cat = 'walking';
        S.catT = 0;
        S.catD = 0;
        emit('cat:land', { x: p0.x, z: p0.z });
      }
    } else if (S.cat === 'walking') {
      S.catD += CAT.walkSpeed * dt;
      const p = catPathAt(S.catD);
      S.catX = p.x;
      S.catZ = p.z;
      props.cat.setPose({ x: p.x, y: 0, z: p.z, yaw: p.yaw, mode: 'walk', k: S.catD });
      if (Math.abs(p.x - WALL_EH.x) < 0.05 && !S.flapT) {
        S.flapT = 1;
        emit('cat:flap', { x: WALL_EH.x, z: p.z });
      }
      if (p.end) catToBed(true);
    }
  }
  function catToBed(animate) {
    S.cat = 'bed';
    S.catX = CAT.bed.x;
    S.catZ = CAT.bed.z;
    props.cat.setPose({ x: CAT.bed.x, y: 0, z: CAT.bed.z, yaw: CAT.bed.yaw, mode: 'sit', k: animate ? 0 : 1 });
    catCol.enabled = true;
    if (animate) emit('cat:bed', { x: CAT.bed.x, z: CAT.bed.z });
  }
  function stepBookFall(dt) {
    if (S.book !== 'falling') return;
    S.fallT += dt;
    const u = clamp01(S.fallT / 0.6);
    props.book.setFall(u);
    if (u >= 1) {
      S.book = 'floor';
      S.bookX = BOOK_FALL.x;
      S.bookZ = BOOK_FALL.z;
      S.fallT = -1;
      emit('book:land', { x: BOOK_FALL.x, z: BOOK_FALL.z });
      hints.now('bookFell', 3.4, 0);
      notifyStage();
    }
  }

  // ------------------------------------------------------------------ entregas
  function deliver(thing) {
    const it = thing === 'glasses' ? glasses : book;
    it.returnHome();
    const obj = thing === 'glasses' ? props.glasses : props.book;
    const spot = props.table.spot(thing);
    spot.add(obj.object);
    obj.object.position.set(0, 0, 0);
    obj.object.rotation.set(0, 0, 0);
    if (thing === 'book') props.book.setLying(true);
    obj.setHighlight(false);
    if (thing === 'glasses') S.glasses = 'table';
    else S.book = 'table';
    emit('table:deliver', { item: thing, x: TABLE_SPOTS[thing].x, z: TABLE_SPOTS[thing].z });
    const other = thing === 'glasses' ? S.book === 'table' : S.glasses === 'table';
    hints.now(other ? (thing === 'glasses' ? 'glassesHome' : 'bookHome') : (thing === 'glasses' ? 'needBook' : 'needGlasses'), 3.8, 0);
    notifyStage();
  }
  /** O objeto na boca de `c` fica na mesinha se ela o largar de frente para ela (a boca dentro da entrega). */
  const facesTable = (c) => {
    const m = mouthPoint(c);
    return Math.hypot(m.x - GOAL.x, m.z - GOAL.z) < GOAL.r;
  };
  /** Larga o livro à frente (nada no meio: nunca do outro lado da porta); ele cai deitado, com um baque. */
  function dropBook(c) {
    const spot = book.dropBy(c, { avoid: dropAvoid, land: 'book:drop' });
    S.book = 'floor';
    S.bookX = spot.x;
    S.bookZ = spot.z;
    hints.now('dropped', 2.4, 0);
    notifyStage();
  }
  /** Os óculos que ficaram no chão: E perto pega de volta (qualquer uma, de boca vazia). */
  const nearFloorGlasses = (c) => S.glasses === 'floor' && glasses.nearFloor(c);
  function pickGlasses(c) {
    glasses.attach(c.name);
    props.glasses.setHighlight(false);
    S.glasses = 'carried';
    emit('item:pickup', { name: c.name, item: 'glasses', x: c.x, z: c.z });
    notifyStage();
  }
  function dropGlasses(c) {
    glasses.dropBy(c, { avoid: dropAvoid });
    S.glasses = 'floor';
    notifyStage();
  }
  function takeBook(c) {
    props.book.setLying(false);
    book.attach(c.name);
    props.book.setHighlight(false);
    S.book = 'carried';
    emit('item:pickup', { name: c.name, item: 'book', x: S.bookX, z: S.bookZ });
    hints.now('gotBook', 3, 0);
    notifyStage();
  }

  // ------------------------------------------------------------------ quadro
  function update(dt, { active, comp, ctrls: C, stay }) {
    if (S.disposed) return null;
    hints.frame(dt);
    for (const b of levers) b.update(dt);

    // escada, globo e ventilador (empurrados no modifyIntent); a escada travada ou com a Radhija em cima não anda
    stepPress(dt);
    ladder.update(dt, { comp, pushSpeed: !brake.on || S.climb ? 0 : undefined });
    globe.update(dt, { comp });
    fan.update(dt, { comp });
    planter.update(dt, { comp });
    stepClimb(dt);
    // a Rhaenyra segura enquanto fica no pé da escada (se ela sair dali, soltou)
    if (S.holdLadder && !inHoldZone(C.rhaenyra)) holdLadder(false);

    // apresentação: os óculos lá no alto e o Bichano dormindo em cima do livro
    if (!introDone && stage() === 'start') {
      S.introT += dt;
      if (S.introT >= 0.7 && S.introT - dt < 0.7) cam?.focusShot(GLASSES.x, GLASSES.z + 1.0, { hold: 1.5, inT: 0.7, outT: 0.6, target: { x: GLASSES.x, y: GLASSES.y - 0.2, z: GLASSES.z + 0.4 } });
      if (S.introT >= 3.3 && S.introT - dt < 3.3) {
        cam?.focusShot(CAT.top.x + 0.6, CAT.top.z + 1.4, { hold: 2.0, inT: 0.8, outT: 0.8, target: { x: CAT.top.x + 0.1, y: CAT.top.y - 0.5, z: CAT.top.z + 0.5 } });
        introDone = true;
      }
    }

    // energia do jardim de inverno: lanterna, luzinhas e o ventilador (sem energia ele não gira nem sopra)
    props.power.setOn(power());
    props.fan.setPower(power());
    props.fan.setRunning(S.fanOn);
    wind.enabled = power() && S.fanOn;
    props.ladderBrake.setReleased(brake.on);
    // a aba da portinha de gato balança quando alguém (dog ou gato) passa por ela
    let swing = 0;
    const fz0 = WALL_EH.catFlap.z0, fz1 = WALL_EH.catFlap.z1;
    for (const p of [C.radhija, C.rhaenyra, { x: S.catX, z: S.catZ, vx: 1 }]) {
      const dx = p.x - WALL_EH.x;
      if (Math.abs(dx) < 0.32 && p.z > fz0 - 0.05 && p.z < fz1 + 0.05) {
        const dir = Math.abs(p.vx || 0) > 0.05 ? Math.sign(p.vx) : -Math.sign(dx);
        swing = dir * (1 - Math.abs(dx) / 0.32) * 0.9 + dir * 0.1;
      }
    }
    props.flap.setSwing(swing);
    // botão do registro: só o vaso de rodinhas pesa o bastante
    plate.update(dt, { ctrls: {}, boxes: [{ id: 'vaso', x: planter.x, z: planter.z }] });
    const onPlate = ['rhaenyra', 'radhija'].some((n) => Math.abs(C[n].x - DAMPER_PLATE.x) < DAMPER_PLATE.hx && Math.abs(C[n].z - DAMPER_PLATE.z) < DAMPER_PLATE.hz);
    if (onPlate && !damperOpen()) hints.cond('plateLight', 3.8, 10);
    if (damperOpen() !== S.wasDamper) {
      S.wasDamper = damperOpen();
      emit(S.wasDamper ? 'duct:open' : 'duct:close', { x: DUCT.inlet.x, z: DUCT.inlet.z });
      if (S.wasDamper) hints.now('damperOpen', 3.4, 0);
    }

    // vento do ventilador (sempre para o norte) e o encaixe na grade
    wind.x = fan.x;
    wind.z = fan.z - FAN.wind.offset;
    S.aligned = Math.abs(fan.x - DUCT.inlet.x) < FAN.alignTol && fan.z <= FAN.alignZ;
    if (S.aligned && !S.wasAligned) {
      emit('fan:aligned', { x: fan.x, z: fan.z });
      hints.now('aligned', 3.2, 4);
    }
    S.wasAligned = S.aligned;
    props.fan.setAligned(S.aligned);
    props.duct.setDamper(damperOpen());
    // baforadas viajando no duto (o cenário desenha um brilho correndo pelo cano)
    const puffs = [];
    for (const cl of /** @type {any[]} */ (scent.clouds)) if (cl.state === 'duct' && cl.duct === duct) puffs.push(clamp01(cl.ductT / DUCT.travel));
    props.duct.setPuffs(puffs);
    if (puffs.length && !S.ductHint) { S.ductHint = true; hints.now('duct', 2.8, 0); }
    if (S.cat === 'asleep') {
      const nearInlet = scent.near(DUCT.inlet.x, DUCT.inlet.z, DUCT.inlet.r * 0.4);
      if (nearInlet && !duct.active()) hints.cond(!damperOpen() ? 'damperClosed' : !power() ? 'noPower' : !S.fanOn ? 'fanOff' : 'noWind', 3.8, 6);
    }

    stepCat(dt);
    stepBookFall(dt);
    // a câmera do escritório olha para o alto do armário só enquanto o Bichano está lá em cima
    cam?.setZone?.('gato-no-armario', S.cat === 'asleep' || S.cat === 'waking' || S.cat === 'jumping');

    // porta do escritório: a maçaneta (de fora ou de dentro) abre; a mola fecha e espera quem estiver no vão
    // a Radhija no vão é o calço: com a porta aberta, a mola só fecha depois que ela sai (senão a folha encostava nela e
    // o vão ficava estreito demais para a Rhaenyra)
    const radHolds = door.t > 0.7 && inDoorway(C.radhija);
    door.setTarget(handle.on || handleIn.on || radHolds ? 1 : 0);
    door.update(dt, { ctrls: C });
    const open = doorOpen();
    if (open !== S.wasDoorOpen) emit(open ? 'door:open' : 'door:close', { x: WALL_EH.x, z: (DOOR.hinge.z + DOOR.latchPost.z) / 2 });
    S.wasDoorOpen = open;
    if (door.blocked && bookInOffice()) hints.cond('doorClosing', 3, 10);

    // entregas na mesinha (chegando nela, ou largando de frente para ela); a queda de quem foi largado
    glasses.update(dt);
    book.update(dt);
    // o livro largado que a folha da porta (ou algo que passe) empurrou: o lugar dele acompanha
    if (S.book === 'floor' && book.floor) { S.bookX = book.floor.x; S.bookZ = book.floor.z; }
    for (const it of [glasses, book]) {
      if (!it.holder) continue;
      const thing = it === glasses ? 'glasses' : 'book';
      if (S.dropDeliver === thing || deliveredAt(GOAL, C[it.holder], active)) deliver(thing);
    }
    S.dropDeliver = null;

    // dicas, prompts e destaques
    const nearLever = levers.some((b) => {
      const K = wallKick(b.spot, active.r);
      return Math.hypot(active.x - K.x, active.z - K.z) < 1.1;
    });
    if (nearLever && active.name === 'radhija') hints.cond('wallRadhija', 3.6, 10);
    if (book.holder === 'rhaenyra' && active.name === 'rhaenyra' && inOffice(active) && !open) {
      const K = wallKick(handleIn.spot, active.r);
      if (Math.hypot(active.x - K.x, active.z - K.z) < 0.9) hints.cond('bookNoJump', 4, 8);
    }
    const wallReady = active.name === 'rhaenyra' && !airborne(active) && !book.holder && levers.some((b) => b.inReach(active, world));
    const canClimb = !S.climb && active.name === 'radhija' && nearClimb(active);
    const canBook = S.book === 'floor' && reach(active, S.bookX, S.bookZ) < 0.55 && active.name === 'rhaenyra' && glasses.holder !== 'rhaenyra';
    const canHold = active.name === 'rhaenyra' && !book.holder && !S.climb && inHoldZone(active) && brake.on;
    const canFan = nearFanSwitch(active) && !book.holder && !S.press;
    const canGlasses = nearFloorGlasses(active) && !book.holder && !glasses.holder;
    if (canClimb) hints.setPrompt('climb');
    else if (canHold) hints.setPrompt(S.holdLadder ? 'letGo' : 'hold');
    else if (canFan) hints.setPrompt(S.fanOn ? 'fanOff' : 'fan');
    else if (canBook) hints.setPrompt('book');
    else if (canGlasses) hints.setPrompt('glasses');
    else if (book.holder === active.name && inOffice(active) && !open) hints.setPrompt('drop');
    else if (wallReady) hints.setPrompt('wall', 'Espaço');
    else hints.setPrompt(book.holder === active.name ? 'drop' : glasses.holder === active.name && !S.climb ? 'dropGlasses' : null);
    props.ladder.setHighlight(brake.on && globeClear() && !ladderAtGlasses() && active.name === 'rhaenyra');
    props.planter.setHighlight(power() && S.aligned && !damperOpen() && active.name === 'rhaenyra' && S.cat === 'asleep');
    const introGlasses = !introDone && S.introT > 0.6 && S.introT < 3.3;
    props.glasses.setHighlight((S.glasses === 'shelf' && ((ladderAtGlasses() && brake.on) || introGlasses)) || S.glasses === 'floor');
    props.book.setHighlight(S.book === 'floor');
    props.table.setHighlight(!!glasses.holder || !!book.holder);
    cols.update(active);
    void stay;

    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) { S.objKey = key; onStageChange(o.stage); }
    notifyStage();
    if (!S.done && S.glasses === 'table' && S.book === 'table') {
      S.done = true;
      notifyStage();
      return 'delivered';
    }
    return null;
  }

  /** Perto do botão de liga do ventilador (na base, lado sul)? */
  /** Perto do botão, pelo lado dele (o sul da base): de trás do ventilador a pata não chega nele. */
  function nearFanSwitch(c) {
    return c.z > fan.z - 0.05 && Math.hypot(c.x - fan.x, c.z - (fan.z + 0.12)) < 0.62;
  }
  /** O alto do botão de liga do ventilador (na base, 12 cm ao sul do meio; world/conservatory.js buildFan). */
  const fanButton = () => ({ x: fan.x, y: 0.08, z: fan.z + 0.12 });
  /** O gesto de apertar o botão: a pata chega nele em PRESS.hit (fração de PRESS.dur) e volta. */
  const PRESS = { dur: 0.7, hit: 0.45 };
  /** De onde ela aperta: na frente do botão, o meio do corpo a esta distância dele (a pata alcança; m). */
  const pressFrom = (c) => (c.cfg?.body?.front ?? 0.22) + 0.17;
  function stepPress(dt) {
    const P = S.press;
    if (!P) return;
    // primeiro ela anda até a frente do botão e vira para ele (a trava pede o passo ao núcleo)
    if (P.step) {
      if (driveStep(ctrls[P.who], P.step, dt)) P.step = null;
      return;
    }
    P.t += dt;
    if (!P.done && P.t >= PRESS.dur * PRESS.hit) {
      P.done = true;
      if (!power()) hints.now('noPower', 3.4, 2);
      else {
        S.fanOn = !S.fanOn;
        emit('fan:switch', { on: S.fanOn, x: fan.x, z: fan.z });
        hints.now(S.fanOn ? 'fanStarted' : 'fanStopped', 2.2, 0);
      }
    }
    if (P.t >= PRESS.dur) S.press = null;
  }
  /** A Radhija está na frente dos degraus, de frente para a estante? */
  function nearClimb(c) {
    const fx = ladder.x;
    const fz = ladder.z + LADDER.half + CLIMB.front * 0.55;
    return Math.hypot(c.x - fx, c.z - fz) < CLIMB.r + 0.12 && Math.abs(wrap(c.yaw - NORTH)) < CLIMB.faceTol;
  }

  /** Empurrar a escada, o globo e o ventilador (Shift encostada); a Radhija só faz força. */
  function modifyIntent(dt, c, intent, opts) {
    if (S.holdLadder && c.name === 'rhaenyra') {
      if (Math.hypot(intent.dx || 0, intent.dz || 0) * (intent.speed ?? 1) > 0.35) {
        holdLadder(false);
        hints.now('letGo', 2.2, 0);
      } else return { intent: { dx: 0, dz: 0, speed: 0, faceX: ladder.x, faceZ: ladder.z }, action: 'push' };
    }
    let out = null;
    for (const cr of crates) {
      const r = cr.modifyIntent(dt, c, intent, opts);
      if (!out && r.contact) out = { r, cr };
    }
    if (!out) return null;
    const { r, cr } = out;
    if (r.contact === 'needShift') hints.cond('shift', 3, 8);
    if (r.contact === 'strain') hints.cond('heavy', 3.4, 8);
    if (r.contact === 'push' && cr === ladder && !brake.on) hints.cond('braked', 3.6, 6);
    if (r.contact === 'push' && cr === ladder && brake.on && ladder.blockedBy === 'globo') hints.cond('globeWay', 3.6, 6);
    return r;
  }

  // ------------------------------------------------------------------ interação (E)
  function interact(c) {
    if (book.holder === c.name) {
      if (facesTable(c)) S.dropDeliver = 'book';
      else if (!deliveredAt(GOAL, c, c)) dropBook(c);
      return true;
    }
    if (S.book === 'floor' && reach(c, S.bookX, S.bookZ) < 0.55) {
      if (c.name !== 'rhaenyra') hints.now('bookHeavy', 3.4, 2);
      else if (glasses.holder === c.name) hints.now('mouthFull', 2.6, 2);
      else takeBook(c);
      return true;
    }
    if (c.name === 'rhaenyra' && !S.climb && brake.on && inHoldZone(c)) {
      holdLadder(!S.holdLadder);
      hints.now(S.holdLadder ? 'holdTip' : 'letGo', S.holdLadder ? 3.6 : 2.2, 0);
      return true;
    }
    if (!S.climb && nearClimb(c)) {
      if (c.name === 'rhaenyra') hints.now('climbRh', 3.6, 2);
      else startClimb(c);
      return true;
    }
    if (nearFanSwitch(c) && !book.holder) {
      // ela vai até a frente do botão e aperta com a pata: o ventilador liga (ou desliga) no aperto (stepPress)
      if (!S.press) S.press = { who: c.name, t: 0, done: false, step: planStep(c, fanButton(), pressFrom(c), world, { yaw: Math.PI }) };
      return true;
    }
    // os óculos: pegar de volta do chão (boca vazia) ou largar os que estão na boca (de frente para a mesinha, ficam nela)
    if (nearFloorGlasses(c) && !glasses.holder) { pickGlasses(c); return true; }
    if (glasses.holder === c.name) {
      if (facesTable(c)) S.dropDeliver = 'glasses';
      else dropGlasses(c);
      return true;
    }
    if (S.cat === 'asleep' && inOffice(c) && reach(c, WARDROBE.x, WARDROBE.z + WARDROBE.hz) < 0.9) {
      hints.now('catSleep', 3.4, 3);
      return true;
    }
    if (!bookInOffice() || inOffice(c)) return false;
    if (!doorOpen() && Math.abs(c.x - WALL_EH.x) < 0.9 && c.z > DOOR.latchPost.z - 0.6 && c.z < DOOR.hinge.z + 0.3) {
      hints.now('doorLocked', 3.6, 3);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ impulso na parede
  function onWallTouch(c, spot) {
    if (spot.id === brake.id && !brake.on) {
      brake.touch();
      hints.now('released', 3, 0);
    }
    if (spot.id === breaker.id && !breaker.on) {
      breaker.touch();
      emit('power:on', { x: BREAKER.x, z: BREAKER.z });
      hints.now('powerOn', 3.4, 0);
    }
    if (spot.id === handle.id) handle.touch();
    if (spot.id === handleIn.id) handleIn.touch();
  }

  // ------------------------------------------------------------------ reinício e etapas de depuração
  function reset() {
    glasses.returnHome();
    book.returnHome();
    props.reset();
    hints.reset();
    cols.reset();
    for (const b of levers) b.reset();
    for (const cr of crates) cr.reset();
    door.reset();
    plate.reset();
    catCol.enabled = false;
    if (S.holdLadder) ctx.setStay?.('rhaenyra', false);
    Object.assign(S, fresh());
    S.flapT = 0;
    lastStage = 'start';
  }
  /** Óculos com a Radhija, escada no lugar (freio solto, globo na lareira). */
  function setupGlasses(x = LADDER_SPOT + 0.15, z = LADDER.start.z + 1.3) {
    brake.setOn(true);
    globe.setPos(GLOBE.minX, GLOBE.start.z);
    ladder.setPos(LADDER_SPOT, LADDER.start.z);
    place('radhija', x, z, Math.PI);
    grabGlasses(ctrls.radhija);
  }
  /** Livro com a Rhaenyra, no hall (o gato já na almofada, registro aberto, ventilador na grade). */
  function setupBook(x = WALL_EH.x + 0.9, z = 0.35) {
    breaker.setOn(true);
    S.fanOn = true;
    fan.setPos(DUCT.inlet.x, FAN.alignZ - 0.3);
    planter.setPos(DAMPER_PLATE.x, DAMPER_PLATE.z);
    catToBed(false);
    props.book.setFall(1);
    place('rhaenyra', x, z, Math.PI / 2);
    takeBook(ctrls.rhaenyra);
  }
  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(/** @type {Stage} */ (st))) return null;
    reset();
    if (st === 'start') return who || 'radhija';
    if (st === 'glasses' || st === 'carrying') setupGlasses();
    if (st === 'book' || st === 'carrying') setupBook();
    if (st === 'done') {
      setupGlasses(GOAL.x + 0.35, GOAL.z + 0.55);
      setupBook(GOAL.x - 0.5, GOAL.z + 0.45);
    }
    notifyStage();
    return who || (st === 'book' ? 'rhaenyra' : 'radhija');
  }

  function lockFor(name) {
    const cl = S.climb;
    const c = ctrls[name];
    if (S.press && S.press.who === name) {
      const b = fanButton();
      // indo até o botão (andando, com o controle de sempre) e apertando: de propósito (a cabeça não desvia do ventilador)
      if (S.press.step) return { action: 'none', faceX: b.x, faceZ: b.z, move: S.press.step.move, reach: !S.press.step.back };
      return { action: 'press', faceX: b.x, faceZ: b.z, press: { ...b, k: Math.min(1, S.press.t / PRESS.dur) }, reach: true };
    }
    if (cl && name === 'radhija') {
      return { action: cl.action || 'none', faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), drive: true, slope: cl.slope || 0 };
    }
    // a Rhaenyra firme no pé da escada (segurando com o E, ou enquanto a irmã sobe)
    if (name === 'rhaenyra' && ctx.activeDog !== 'rhaenyra' && (S.holdLadder || (cl && held()))) return { action: 'push', faceX: ladder.x, faceZ: ladder.z };
    return null;
  }

  return {
    S: hints.S, TEXT, stages: STAGES, objective, update, interact, reset, jumpToStage, modifyIntent, lockFor,
    navFlags: () => ({ doorOpen: doorOpen() }),
    wallSpots: () => (book.holder ? [] : levers.map((b) => b.spot)),
    onWallTouch,
    onBark: (c) => { if (S.cat === 'asleep' && (inOffice(c) || Math.abs(c.x - WALL_EH.x) < 1.2)) hints.now('catBark', 3.4, 5); },
    lookTarget: (c) => {
      if (S.glasses === 'shelf' && Math.hypot(c.x - ladder.x, c.z - ladder.z) < 1.4 && ladderAtGlasses()) return at(GLASSES.x, GLASSES.z, GLASSES.y);
      if (S.book === 'floor' && reach(c, S.bookX, S.bookZ) < 1.0) return at(S.bookX, S.bookZ, 0.05);
      if (nearFloorGlasses(c)) return at(glasses.floor.x, glasses.floor.z, 0.03);
      if (S.cat === 'asleep' && inOffice(c) && reach(c, WARDROBE.x, WARDROBE.z) < 1.8) return at(CAT.top.x, CAT.top.z, CAT.top.y + 0.1);
      return null;
    },
    setPrompt: (kind) => hints.setPrompt(kind),
    endActions() { S.climb = null; },
    /** Testes e capturas: põe a escada, o globo ou o ventilador num ponto (dentro dos limites), sem empurrão. */
    placeCrate(id, x, z) {
      const cr = { escadinha: ladder, globo: globe, ventilador: fan, vaso: planter }[id];
      if (!cr) return;
      const cfg = cr === ladder ? LADDER : cr === globe ? GLOBE : cr === planter ? PLANTER : FAN;
      cr.setPos(Math.min(cfg.maxX, Math.max(cfg.minX, x)), Math.min(cfg.maxZ, Math.max(cfg.minZ, z ?? cr.z)));
    },
    dispose() { S.disposed = true; },
    info: () => ({
      biblioteca: {
        state: stage(), glasses: S.glasses, book: S.book, bookAt: { x: +S.bookX.toFixed(2), z: +S.bookZ.toFixed(2) }, cat: S.cat,
        catAt: { x: +S.catX.toFixed(2), z: +S.catZ.toFixed(2) },
        braked: !brake.on, power: power(), fanOn: S.fanOn, damper: damperOpen(), aligned: S.aligned, held: held(), holding: S.holdLadder,
        atGlasses: ladderAtGlasses(), globeClear: globeClear(), planter: planter.info(),
        climb: S.climb ? { phase: S.climb.phase, y: +ctrls.radhija.y.toFixed(3) } : null,
        ladder: ladder.info(), globe: globe.info(), fan: fan.info(), door: { ...door.info(), open: doorOpen() },
        levers: { brake: brake.info(), breaker: breaker.info(), handle: handle.info(), handleIn: handleIn.info() },
      },
      glasses: { holder: glasses.holder, floor: S.glasses === 'floor' ? glasses.floor : null, falling: glasses.falling },
      book: { holder: book.holder, falling: book.falling },
      objective: objective(ctx.activeDog).text,
    }),
    get stage() { return stage(); },
    get carrier() { return glasses.holder || book.holder; },
    carries: (name) => glasses.holder === name || book.holder === name,
    get collected() { return cols.count; }, get total() { return cols.total; },
    set onStageChange(fn) { onStageChange = fn; },
  };
}
