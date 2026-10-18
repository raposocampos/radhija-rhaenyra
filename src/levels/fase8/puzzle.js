// Lavanderia de Domingo · puzzle. Tudo avança por dt (pausa congela o varal, a centrífuga e as quedas).
//   MEIA: no varal de teto, lá no alto. A Rhaenyra pega impulso nas patinhas da parede e aperta o botão do varal,
//     que desce por RACK_BUTTON.holdTime s (o anel de luzes conta). O pregador segura firme: só o tranco da
//     arrancada da Radhija solta a meia (andando, ela só puxa e a dica explica). Ela leva a meia à caminha.
//   MANTINHA: dobrada em cima da máquina de lavar. A Rhaenyra empurra o cesto de rodinhas até a frente da
//     máquina e aperta o botão de centrifugar (impulso): a máquina chacoalha e a mantinha escorrega para o cesto.
//     Sem o cesto, ela cai no chão e vai para o cesto quando ele encosta (E). O cesto empurrado até a caminha
//     entrega a mantinha. Nenhuma ordem trava: as duas cadeias são independentes e tudo se refaz.
import { createCarryItem, createCollectibles, createHints, reach } from '../../game/puzzleKit.js';
import { createPushCrate, createWallButton } from '../../game/mechanics/index.js';
import { airborne, wallKick } from '../../game/dogController.js';
import {
  RACK, SOCK, SPIN, CATCH, BASKET, DOG_BED, BED_SPOTS, WASHER, GOAL, SPIN_BUTTON, RACK_BUTTON,
  COLLECTIBLES, COLLECTIBLE_PICKUP_R,
} from './layout.js';

/**
 * @typedef {'start'|'sock'|'basket'|'carrying'|'done'} Stage
 * @typedef {'rack'|'carried'|'bed'} SockPlace
 * @typedef {'machine'|'falling'|'basket'|'floor'|'bed'} BlanketPlace
 */
/** @type {Stage[]} */
export const STAGES = ['start', 'sock', 'basket', 'carrying', 'done'];
export const TEXT = {
  objective: {
    rackRh: 'A meia está no varal, lá no alto: pegue impulso nas patinhas e aperte o botão do varal (Espaço)',
    rackRad: 'A meia está no varal, lá no alto: a Rhaenyra alcança o botão do varal (Q)',
    dashRad: 'O varal desceu! Dê a arrancada até a meia (Shift) para soltar o pregador',
    dashRh: 'O varal desceu! Troque para a Radhija (Q) e dê a arrancada até a meia',
    carrySock: 'Leve a meia até a caminha',
    toMachine: 'Empurre o cesto até a frente da máquina de lavar (segure Shift)',
    spin: 'Cesto no lugar! Pegue impulso nas patinhas e aperte o botão de centrifugar (Espaço)',
    spinRad: 'A mantinha está em cima da máquina: a Rhaenyra empurra o cesto e alcança o botão (Q)',
    falling: 'Centrifugando! Olha a mantinha escorregando…',
    loadFloor: 'A mantinha caiu no chão: encoste o cesto nela e ponha dentro (E)',
    pushHome: 'Empurre o cesto com a mantinha até a caminha (segure Shift)',
    pushHomeRad: 'Só a Rhaenyra empurra o cesto: troque (Q)',
  },
  hint: {
    clip: 'O pregador segura firme! Só o tranco de uma arrancada (Shift) solta a meia.',
    clipRh: 'O pregador não solta… o tranco da arrancada da Radhija solta! (Q)',
    high: 'A meia está lá no alto. O botão do varal fica na parede: a Rhaenyra alcança com o impulso.',
    rackUp: 'O varal subiu de novo! Aperte o botão outra vez.',
    gotSock: 'Puxou! A meia saiu do pregador.',
    tooBig: 'A mantinha é grande demais para levar na boca. Vai no cesto: a Rhaenyra empurra!',
    needBasket: 'Traga o cesto até a mantinha e ponha ela dentro (E).',
    onMachine: 'A mantinha está em cima da máquina. Centrifugando, ela cai: ponha o cesto na frente antes!',
    floor: 'Caiu no chão! Encoste o cesto nela e ponha dentro (E).',
    inBasket: 'Caiu direitinho no cesto!',
    loaded: 'Mantinha no cesto!',
    board: 'O cesto não passa debaixo da tábua de passar: dê a volta.',
    heavy: 'O cesto é pesado para a Radhija: a Rhaenyra empurra (Q, segure Shift).',
    shift: 'Segure Shift para empurrar o cesto.',
    wallRadhija: 'Alto demais para a Radhija! A Rhaenyra pega impulso nas patinhas da parede (Q).',
    sockHome: 'A meia chegou na caminha!',
    blanketHome: 'A mantinha está na caminha!',
    needBlanket: 'Falta a mantinha: ela está em cima da máquina de lavar.',
    needSock: 'Falta a meia: ela está no varal.',
  },
  prompt: { load: 'Pôr a mantinha no cesto', wall: 'Impulso na parede' },
};

const clamp01 = (k) => Math.min(1, Math.max(0, k));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** @param {import('../../types').PuzzleContext<import('../../types').Fase8Props>} ctx @returns {import('../../types').Puzzle} */
export function createPuzzle(ctx) {
  const { props, dogs, ctrls, root, emit, world, place } = ctx;
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const spinBtn = createWallButton({ id: 'botao-centrifugar', cfg: SPIN_BUTTON, emit, prop: props.spinButton });
  const rackBtn = createWallButton({ id: 'botao-varal', cfg: RACK_BUTTON, emit, prop: props.rackButton });
  const buttons = [spinBtn, rackBtn];
  const basket = createPushCrate({ id: 'cesto', cfg: BASKET, world, emit, prop: props.basket });
  const sock = createCarryItem({ obj: props.sock.object, dogs, scene: root, name: 'sock' });
  const fresh = () => ({
    done: false, disposed: false, objKey: '',
    /** @type {SockPlace} */ sock: /** @type {SockPlace} */ ('rack'),
    /** @type {BlanketPlace} */ blanket: /** @type {BlanketPlace} */ ('machine'),
    lowerK: 0, lowerDir: 0, spinK: 0, spinElapsed: -1, fallT: -1, fallToBasket: false,
    nearT: 0, wasDown: false,
  });
  const S = fresh();
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  let lastStage = /** @type {Stage} */ ('start');
  const at = (x, z, y = 0.7) => ({ x, y, z });
  const rackDown = () => S.lowerK > 0.85;
  const basketAtCatch = () => dist(basket, CATCH) < CATCH.r;
  const basketNearBlanket = () => dist(basket, CATCH) < CATCH.r + 0.4;
  /** Cabeça da dog (onde ela abocanha). */
  const head = (c) => ({ x: c.x + Math.sin(c.yaw) * 0.26, z: c.z + Math.cos(c.yaw) * 0.26 });

  // ------------------------------------------------------------------ etapa (derivada do estado)
  /** @returns {Stage} */
  function stage() {
    if (S.done) return 'done';
    const sockOut = S.sock !== 'rack';
    const blanketIn = S.blanket === 'basket' || S.blanket === 'bed';
    if (sockOut && blanketIn) return 'carrying';
    if (sockOut) return 'sock';
    if (blanketIn) return 'basket';
    return 'start';
  }
  function notifyStage() {
    const st = stage();
    if (st !== lastStage) { lastStage = st; onStageChange(st); }
  }

  // ------------------------------------------------------------------ objetivo
  const rackTarget = () => ({ ...rackBtn.target(0.3) });
  const sockTarget = () => at(SOCK.x, SOCK.z, RACK.up + (RACK.down - RACK.up) * S.lowerK - SOCK.hang + 0.25);
  /** O que falta da mantinha, para a Rhaenyra. */
  function blanketObjective(st) {
    const O = TEXT.objective;
    if (S.blanket === 'machine') {
      return basketAtCatch()
        ? { text: O.spin, target: spinBtn.target(0.3), stage: st }
        : { text: O.toMachine, target: at(basket.x, basket.z, 0.75), stage: st };
    }
    if (S.blanket === 'falling') return { text: O.falling, target: at(CATCH.x, CATCH.z, 0.6), stage: st };
    if (S.blanket === 'floor') return { text: O.loadFloor, target: at(CATCH.x, CATCH.z, 0.4), stage: st };
    return { text: O.pushHome, target: at(basket.x, basket.z, 0.75), stage: st };
  }
  /** @param {import('../../types').DogName} activeName */
  function objective(activeName) {
    const O = TEXT.objective;
    const st = stage();
    if (st === 'done') return { text: null, target: null, stage: st };
    if (sock.holder === activeName) return { text: O.carrySock, target: at(GOAL.x, GOAL.z, 0.6), stage: st };
    const sockPending = S.sock === 'rack';
    const blanketPending = S.blanket !== 'bed';
    if (activeName === 'radhija') {
      if (sockPending) return rackDown() ? { text: O.dashRad, target: sockTarget(), stage: st } : { text: O.rackRad, target: rackTarget(), stage: st };
      if (blanketPending) {
        if (S.blanket === 'basket') return { text: O.pushHomeRad, target: at(basket.x, basket.z, 0.75), stage: st };
        if (S.blanket === 'floor') return { text: O.loadFloor, target: at(CATCH.x, CATCH.z, 0.4), stage: st };
        return { text: O.spinRad, target: at(WASHER.x, WASHER.z, 1.25), stage: st };
      }
      return { text: O.carrySock, target: at(GOAL.x, GOAL.z, 0.6), stage: st };
    }
    // Rhaenyra: o varal embaixo é urgente; depois a mantinha; por fim o varal
    if (sockPending && rackDown()) return { text: O.dashRh, target: sockTarget(), stage: st };
    if (blanketPending) return blanketObjective(st);
    if (sockPending) return { text: O.rackRh, target: rackTarget(), stage: st };
    return { text: O.carrySock, target: at(GOAL.x, GOAL.z, 0.6), stage: st };
  }

  // ------------------------------------------------------------------ meia
  function yankSock() {
    sock.attach('radhija');
    props.sock.setHighlight(false);
    S.sock = 'carried';
    S.nearT = 0;
    emit('sock:yank', { name: 'radhija', x: SOCK.x, z: SOCK.z, y: RACK.down - SOCK.hang + 0.1 });
    emit('item:pickup', { name: 'radhija', item: 'sock', x: SOCK.x, z: SOCK.z });
    hints.now('gotSock', 3, 0);
    notifyStage();
  }
  function deliverSock() {
    sock.returnHome();
    const spot = props.bed.spot('sock');
    spot.add(props.sock.object);
    props.sock.object.position.set(0, 0, 0);
    props.sock.object.rotation.set(0, 0, 0);
    props.sock.setHighlight(false);
    S.sock = 'bed';
    emit('bed:deliver', { item: 'sock', x: BED_SPOTS.sock.x, z: BED_SPOTS.sock.z });
    hints.now(S.blanket === 'bed' ? 'sockHome' : 'needBlanket', 3.6, 0);
    notifyStage();
  }

  // ------------------------------------------------------------------ mantinha
  function startFall() {
    S.fallToBasket = basketAtCatch();
    S.blanket = 'falling';
    S.fallT = 0;
    props.blanket.place(S.fallToBasket ? 'basket' : 'floor', true);
    emit('blanket:fall', { x: CATCH.x, z: CATCH.z, inBasket: S.fallToBasket });
  }
  function landFall() {
    S.blanket = S.fallToBasket ? 'basket' : 'floor';
    S.fallT = -1;
    emit('blanket:land', { x: CATCH.x, z: CATCH.z, inBasket: S.fallToBasket });
    hints.now(S.fallToBasket ? 'inBasket' : 'floor', 3.4, 0);
    notifyStage();
  }
  function loadBlanket() {
    props.blanket.place('basket', true);
    S.blanket = 'basket';
    emit('blanket:load', { x: basket.x, z: basket.z });
    hints.now('loaded', 2.6, 0);
    notifyStage();
  }
  function blanketHome() {
    basket.freeze(); // estacionado ao lado da caminha (não entra nela)
    props.blanket.place('bed', true);
    S.blanket = 'bed';
    emit('bed:deliver', { item: 'blanket', x: BED_SPOTS.blanket.x, z: BED_SPOTS.blanket.z });
    hints.now(S.sock === 'bed' ? 'blanketHome' : 'needSock', 3.6, 0);
    notifyStage();
  }

  // ------------------------------------------------------------------ quadro
  function update(dt, { active, comp, ctrls: C }) {
    if (S.disposed) return null;
    hints.frame(dt);
    for (const b of buttons) b.update(dt);

    // varal: desce com o botão ligado e sobe sozinho quando o tempo acaba
    const want = rackBtn.on ? 1 : 0;
    const dir = want > S.lowerK ? 1 : want < S.lowerK ? -1 : 0;
    if (dir !== S.lowerDir) {
      if (dir !== 0) emit('rack:move', { dir: dir > 0 ? 'down' : 'up', x: (RACK.x0 + RACK.x1) / 2, z: RACK.z });
      S.lowerDir = dir;
    }
    S.lowerK = dir > 0 ? Math.min(1, S.lowerK + dt / RACK.lowerTime) : dir < 0 ? Math.max(0, S.lowerK - dt / RACK.raiseTime) : S.lowerK;
    props.rack.setLower(S.lowerK);
    if (S.wasDown && !rackDown() && S.sock === 'rack') hints.now('rackUp', 3, 4);
    S.wasDown = rackDown();

    // centrífuga: chacoalha a máquina; a mantinha escorrega e cai SPIN.dropAt s depois de começar
    const spinning = spinBtn.on;
    S.spinK = spinning ? Math.min(1, S.spinK + dt * 2.5) : Math.max(0, S.spinK - dt * 1.4);
    props.washer.setSpin(S.spinK);
    if (spinning) {
      if (S.spinElapsed < 0) {
        S.spinElapsed = 0;
        emit('washer:spin', { x: WASHER.x, z: WASHER.z, time: SPIN_BUTTON.holdTime });
      } else S.spinElapsed += dt;
    } else S.spinElapsed = -1;
    if (S.blanket === 'machine') {
      const k = S.spinElapsed < 0 ? 0 : clamp01((S.spinElapsed - (SPIN.dropAt - SPIN.slideTime)) / SPIN.slideTime);
      props.blanket.wobble(k);
      if (S.spinElapsed >= SPIN.dropAt) startFall();
    } else if (S.blanket === 'falling') {
      S.fallT += dt;
      if (S.fallT >= SPIN.fallTime) landFall();
    }

    // cesto (empurrado no modifyIntent) e entrega da mantinha na caminha
    basket.update(dt, { comp });
    if (S.blanket === 'basket' && Math.hypot(basket.x - DOG_BED.x, basket.z - DOG_BED.z) < DOG_BED.basketR) blanketHome();
    if (basket.pushing && basket.blockedBy === 'tabua') hints.cond('board', 3.2, 8);

    // meia: o tranco da arrancada da Radhija com o varal embaixo
    const rad = C.radhija;
    if (S.sock === 'rack' && rackDown()) {
      const d = dist(head(rad), SOCK);
      if (rad.dashT > 0 && d < SOCK.grabR && !sock.holder) yankSock();
      else if (rad === active && d < SOCK.nearR && rad.dashT <= 0) {
        S.nearT += dt;
        if (S.nearT > 0.9) hints.cond('clip', 3.8, 7);
      } else S.nearT = 0;
    } else S.nearT = 0;
    if (sock.holder) {
      const hc = C[sock.holder];
      const d = Math.hypot(hc.x - GOAL.x, hc.z - GOAL.z);
      const leaderIn = Math.hypot(active.x - GOAL.x, active.z - GOAL.z) < GOAL.r;
      if (d < GOAL.r || (hc !== active && leaderIn && d < GOAL.r + 0.8)) deliverSock();
    }

    // dicas de quem não alcança, prompts e destaques
    const nearSpot = buttons.some((b) => {
      const K = wallKick(b.spot, active.r);
      return Math.hypot(active.x - K.x, active.z - K.z) < 1.1;
    });
    if (nearSpot && active.name === 'radhija') hints.cond('wallRadhija', 3.6, 10);
    const canLoad = S.blanket === 'floor' && reach(active, CATCH.x, CATCH.z) < 0.7 && basketNearBlanket();
    const wallReady = active.name === 'rhaenyra' && !airborne(active) && buttons.some((b) => b.inReach(active, world));
    if (canLoad) hints.setPrompt('load');
    else hints.setPrompt(wallReady ? 'wall' : null, 'Espaço');
    props.sock.setHighlight(S.sock === 'rack' && rackDown());
    props.basket.setHighlight(S.blanket === 'floor' || (S.blanket === 'machine' && !basketAtCatch() && active.name === 'rhaenyra'));
    props.bed.setHighlight(!!sock.holder || S.blanket === 'basket');
    cols.update(active);

    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) { S.objKey = key; onStageChange(o.stage); }
    notifyStage();
    if (!S.done && S.sock === 'bed' && S.blanket === 'bed') {
      S.done = true;
      notifyStage();
      return 'delivered';
    }
    return null;
  }

  /** Empurrar o cesto (Shift encostada nele); a Radhija só faz força. */
  function modifyIntent(dt, c, intent, opts) {
    const r = basket.modifyIntent(dt, c, intent, opts);
    if (r.contact === 'needShift') hints.cond('shift', 3, 8);
    if (r.contact === 'strain') hints.cond('heavy', 3.4, 8);
    return r;
  }

  // ------------------------------------------------------------------ interação (E)
  function interact(c) {
    if (S.blanket === 'floor' && reach(c, CATCH.x, CATCH.z) < 0.7) {
      if (basketNearBlanket()) loadBlanket();
      else hints.now(c.name === 'radhija' ? 'tooBig' : 'needBasket', 3.4, 2);
      return true;
    }
    if (S.blanket === 'machine' && reach(c, WASHER.x, WASHER.z + WASHER.hz) < 0.65) {
      hints.now('onMachine', 4, 3);
      return true;
    }
    if (S.sock === 'rack' && reach(c, SOCK.x, SOCK.z) < SOCK.nearR) {
      if (rackDown()) hints.now(c.name === 'radhija' ? 'clip' : 'clipRh', 3.6, 2);
      else hints.now('high', 3.8, 3);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ impulso na parede
  function onWallTouch(c, spot) {
    if (spot.id === spinBtn.id) spinBtn.touch();
    if (spot.id === rackBtn.id) rackBtn.touch();
  }

  // ------------------------------------------------------------------ reinício e etapas de depuração
  function reset() {
    sock.returnHome();
    props.sock.object.visible = true;
    props.reset();
    hints.reset();
    cols.reset();
    for (const b of buttons) b.reset();
    basket.reset();
    Object.assign(S, fresh());
    lastStage = 'start';
  }
  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(/** @type {Stage} */ (st))) return null;
    reset();
    if (st === 'start') return who || 'radhija';
    const withSock = st === 'sock' || st === 'carrying' || st === 'done';
    const withBlanket = st === 'basket' || st === 'carrying' || st === 'done';
    if (withBlanket) {
      basket.setPos(CATCH.x, CATCH.z);
      props.blanket.place('basket', false);
      S.blanket = 'basket';
      place('rhaenyra', CATCH.x + 0.1, CATCH.z + 0.62, Math.PI);
    }
    if (withSock) {
      place('radhija', SOCK.x, SOCK.z + 0.6, Math.PI);
      sock.attach('radhija');
      S.sock = 'carried';
    }
    if (st === 'done') {
      basket.setPos(DOG_BED.x - 0.5, DOG_BED.z - 0.25);
      place('rhaenyra', DOG_BED.x - 1.1, DOG_BED.z - 0.25, Math.PI / 2);
      place('radhija', GOAL.x - 0.2, GOAL.z - 0.35, Math.PI / 2);
    }
    notifyStage();
    return who || (st === 'basket' ? 'rhaenyra' : 'radhija');
  }

  return {
    S: hints.S, TEXT, stages: STAGES, objective, update, interact, reset, jumpToStage, modifyIntent,
    lockFor: () => null,
    navFlags: () => ({}),
    wallSpots: () => buttons.map((b) => b.spot),
    onWallTouch,
    lookTarget: (c) => {
      if (S.sock === 'rack' && rackDown() && reach(c, SOCK.x, SOCK.z) < SOCK.nearR + 0.4) return sockTarget();
      if (S.blanket === 'floor' && reach(c, CATCH.x, CATCH.z) < 1.0) return at(CATCH.x, CATCH.z, 0.08);
      return null;
    },
    setPrompt: (kind) => hints.setPrompt(kind),
    /** Testes e capturas: põe o cesto em (x, z) (dentro dos limites dele), sem empurrão. */
    placeBasket(x, z) { basket.setPos(Math.min(BASKET.maxX, Math.max(BASKET.minX, x)), Math.min(BASKET.maxZ, Math.max(BASKET.minZ, z))); },
    dispose() { S.disposed = true; },
    info: () => ({
      lavanderia: {
        state: stage(), sock: S.sock, blanket: S.blanket, lower: +S.lowerK.toFixed(3), rackDown: rackDown(),
        spinning: spinBtn.on, basket: basket.info(), atCatch: basketAtCatch(),
        buttons: { spin: spinBtn.info(), rack: rackBtn.info() },
      },
      sock: { holder: sock.holder },
      objective: objective(ctx.activeDog).text,
    }),
    get stage() { return stage(); },
    get carrier() { return sock.holder; },
    carries: (name) => sock.holder === name,
    get collected() { return cols.count; }, get total() { return cols.total; },
    set onStageChange(fn) { onStageChange = fn; },
  };
}
