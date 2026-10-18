// Expresso do Superbafo · puzzle. A catraca reage ao pouso; o nariz reage à nuvem real. Tudo avança por dt.
// O trem segue o trilho de track.js (o mesmo que o cenário desenha). O foguete do tapete só decola com as
// duas cargas, e as duas estão dentro da maquete, onde só o trem chega:
//   1. A bolinha-planeta já está no vagão; a lua está presa na cestinha do pórtico, no fim da rota da lua.
//      Pulo no pedal escolhe a rota (volta → lua → estrela → volta) e o superbafo frontal da Radhija faz o
//      trem espirrar: o "atchim" dá o tranco de ré e ele parte.
//   2. Na lua, o vagão para embaixo do pórtico, a portinhola abre e a lua cai nele (o planeta abre espaço);
//      o trem espera um pouco e volta sozinho, de frente, para a estação.
//   3. A estrela tem uma cancela que só sobe com alguém na placa do lado de fora (use o Fica). No fim dela,
//      a caçamba bascula e as cargas rolam pela canaleta até a bandeja; o trem volta sozinho.
//   4. Cada carga vai na boca até o foguete. Com as duas nos berços, ele decola.
// Também vale levar o planeta primeiro pela estrela e depois buscar a lua: nenhuma ordem trava a fase.
import { createCarryItem, createCollectibles, createHints, deliveredAt, reach } from '../../game/puzzleKit.js';
import { createPressurePlate } from '../../game/mechanics/index.js';
import { createTrack } from './track.js';
import {
  PEDAL, SWITCH_SIGN, ROUTE_ORDER, TRAIN, TRACK, BARRIER, BARRIER_PLATE, NOSE, BLOW_SPOT, TRAY, CHUTE, BALL, MOON,
  MOON_GANTRY, ROCKET, TRAIN_BODY, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R,
} from './layout.js';

/**
 * @typedef {'waiting'|'sneezing'|'movingLoop'|'movingDelivery'|'movingMoon'|'blocked'|'returning'|'moonLoaded'
 *   |'ready'|'carrying'|'planetDocked'|'moonReady'|'carryingMoon'|'done'} Stage
 * @typedef {import('../../types').Fase6Route} Route
 * @typedef {import('../../types').Fase6Cargo} Cargo
 * @typedef {'wagon'|'gantry'|'loading'|'unloading'|'tray'|'carried'|'rocket'} Place
 * @typedef {'idle'|'sneezing'|'out'|'blocked'|'unloading'|'loading'|'parked'|'home'} TrainMode
 */
/** @type {Stage[]} */
export const STAGES = ['waiting', 'sneezing', 'movingLoop', 'movingDelivery', 'movingMoon', 'blocked', 'returning',
  'moonLoaded', 'ready', 'carrying', 'planetDocked', 'moonReady', 'carryingMoon', 'done'];
export const TEXT = {
  objective: {
    pedal: 'Pule no pedal com a Rhaenyra até a seta da estrela (Espaço)',
    pedalMoon: 'A lua está presa no pórtico da maquete: só o trem chega lá! Pule no pedal com a Rhaenyra até a seta da lua (Espaço)',
    switchJump: 'Troque para a Rhaenyra (Q): o pedal precisa de um pulão!',
    blow: 'Faça a locomotiva espirrar com o superbafo da Radhija (segure R e solte)',
    switchBlow: 'O trilho está pronto! Troque para a Radhija (Q) e use o superbafo (segure R e solte)',
    barrierGo: 'A cancela da estrela está fechada: pare a Rhaenyra na placa ao lado da maquete',
    barrierBring: 'A cancela está fechada: troque para a Rhaenyra (Q) e leve-a até a placa ao lado da maquete',
    barrierSwitch: 'Cancela aberta! Agora troque para a Radhija (Q)',
    barrierStay: 'Peça para a Rhaenyra ficar na placa (F)',
    barrierSwap: 'Quem sopra é a Radhija: deixe a Rhaenyra na placa no lugar dela',
    moving: 'Atchim! Veja por onde o vagão leva a carga',
    fetching: 'Atchim! O trem foi buscar a lua no pórtico',
    moonBack: 'A lua está no vagão! O trem volta sozinho para a estação',
    blocked: 'A cancela estava fechada: o trem vai voltar para a estação',
    waitTrain: 'Espere o trem voltar para a estação',
    airing: 'Espere o cheirinho sair da janela para soprar de novo',
    pickup: 'Pegue a bolinha-planeta na bandeja (E)',
    pickupMoon: 'Pegue a lua na bandeja (E)',
    carrying: 'Leve a bolinha-planeta ao foguete',
    carryingMoon: 'Leve a lua ao foguete',
  },
  hint: {
    jump: 'A mola precisa de um pulão! Pare no pedal e pule com a Rhaenyra (Espaço).',
    busy: 'O trem está andando. Espere ele voltar para mudar o trilho.',
    delivery: 'A seta aponta para a estrela! Agora é a vez do superbafo da Radhija.',
    moon: 'A seta aponta para a lua! O trem vai buscá-la no pórtico.',
    loop: 'A seta circular faz o trem dar uma volta. Pule de novo para mudar.',
    returned: 'O trem voltou para a estação!',
    front: 'Mire pela janela do nariz e solte outro superbafo (segure R e solte).',
    nose: 'Esse nariz de brinquedo espirra com o superbafo da Radhija!',
    early: 'A carga ainda está no trem. Leve o vagão até a bandeja.',
    ready: 'A bolinha chegou! As duas podem pegá-la na bandeja (E).',
    readyBoth: 'Chegaram as duas! Leve uma de cada vez ao foguete (E).',
    moonReady: 'A lua chegou! Pegue-a na bandeja (E).',
    sneeze: 'Atchim! O trem engatou a ré!',
    blocked: 'Fiu-fiu! A cancela está fechada. Alguém precisa ficar na placa ao lado da maquete.',
    stayPlate: 'Use Fica (F) para a companheira segurar a placa da cancela!',
    barrierUp: 'A cancela subiu!',
    loaded: 'A lua caiu no vagão! Agora leve as cargas pela estrela.',
    gantryEmpty: 'A cestinha do pórtico já está vazia.',
    docked: 'Encaixou no foguete!',
    needMoon: 'Agora falta a lua! Ela está presa no pórtico da maquete: mande o trem buscar.',
    launch: '3… 2… 1… o foguete decolou!',
  },
  prompt: { ball: 'Pegar a bolinha-planeta', moon: 'Pegar a lua' },
};

const TR = createTrack();
const LENGTH = { loop: TR.routes.loop.length, delivery: TR.routes.delivery.length, moon: TR.routes.moon.length };
/** A volta conta como "voltando" (stage returning) a partir deste ponto do circuito. */
export const RETURN_FROM = LENGTH.loop - TRACK.returnDistance;
/** Na estrela, o vagão (que vai à frente) para logo antes do braço da cancela fechada. */
export const BARRIER_STOP = BARRIER.s - TRAIN.cargoOffset - TRAIN_BODY.wagon.back - 0.06;
/** @type {Cargo[]} */
const CARGOS = ['planet', 'moon'];
/** As duas cargas cabem lado a lado na bandeja. */
const SLOT = { planet: -0.1, moon: 0.1 };
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const ROUTE_STAGE = { loop: 'movingLoop', delivery: 'movingDelivery', moon: 'movingMoon' };

/** @param {import('../../types').PuzzleContext<import('../../types').Fase6Props>} ctx @returns {import('../../types').Puzzle} */
export function createPuzzle(ctx) {
  const { props, dogs, root, emit, scent, cam, place } = ctx;
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const items = {
    planet: { item: createCarryItem({ obj: props.ball.object, dogs, scene: root, name: 'ball' }), prop: props.ball },
    moon: { item: createCarryItem({ obj: props.moon.object, dogs, scene: root, name: 'ball' }), prop: props.moon },
  };
  const plate = createPressurePlate({ id: BARRIER_PLATE.id, x: BARRIER_PLATE.x, z: BARRIER_PLATE.z, r: BARRIER_PLATE.r, emit, prop: props.barrierPlate, margin: 0.4 });
  const fresh = () => ({
    route: /** @type {Route} */ ('loop'),
    armed: true, pedalT: 0, trips: 0, routeChanges: 0, disposed: false, objKey: '', done: false,
    /** @type {{ mode: TrainMode, route: Route | null, s: number, speed: number, timer: number, burst: boolean, odo: number, nextChuff: number }} */
    train: { mode: 'idle', route: null, s: 0, speed: 0, timer: 0, burst: false, odo: 0, nextChuff: 0 },
    /** @type {Record<Cargo, Place>} */
    place: { planet: 'wagon', moon: 'gantry' },
    barrierK: 0, barrierWanted: false, forceBarrier: false,
    /** @type {{ list: { cargo: Cargo, delay: number, from: { x: number, y: number, z: number } }[], timer: number }} */
    unload: { list: [], timer: 0 },
    load: { timer: 0, landed: false },
    prevPlateBy: /** @type {import('../../types').DogName | null} */ (null),
  });
  const S = fresh();
  const train = { ...TRAIN.start };
  const wagon = { ...TRAIN.start, z: TRAIN.start.z - TRAIN.cargoOffset };
  const camPoint = { x: train.x, y: 0.45, z: train.z };
  /** @type {Set<number>} */
  const blocked = new Set();
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  let lastStage = /** @type {Stage} */ ('waiting');
  const at = (x, z, y = 0.7) => ({ x, y, z });
  const onPedal = (c) => Math.hypot(c.x - PEDAL.x, c.z - PEDAL.z) <= PEDAL.r;
  const atWindow = (c) => reach(c, BLOW_SPOT.x, BLOW_SPOT.z) < 1;
  /** Ponto da locomotiva a `d` m à frente da cara dela (a cara olha para trás do movimento de ida). */
  const ahead = (d) => ({ x: train.x + Math.sin(train.yaw) * d, z: train.z + Math.cos(train.yaw) * d });
  const holderOf = (cargo) => items[cargo].item.holder;
  const carriedBy = (name) => CARGOS.find((k) => items[k].item.holder === name) || null;
  const trayPoint = (cargo) => ({ x: TRAY.x + SLOT[cargo], y: TRAY.y, z: TRAY.z });
  const trainHome = () => S.train.mode === 'idle';
  const inWagon = () => CARGOS.filter((k) => S.place[k] === 'wagon');
  /** Cargas a bordo (no vagão ou descendo pela canaleta): enquanto houver, a viagem é a etapa da fase. */
  const aboard = () => CARGOS.some((k) => S.place[k] === 'wagon' || S.place[k] === 'unloading');
  /** Carga na bandeja ao alcance (a mais próxima da cabeça, se houver as duas). */
  function trayCargoNear(c) {
    let best = null, bestD = Infinity;
    for (const cargo of CARGOS) {
      if (S.place[cargo] !== 'tray') continue;
      const p = trayPoint(cargo);
      const d = reach(c, p.x, p.z);
      if (d < TRAY.pickupR && d < bestD) { best = cargo; bestD = d; }
    }
    return best;
  }

  // ------------------------------------------------------------------ estágio (derivado do estado)
  /** A viagem atual tem propósito (carga a bordo ou a lua para buscar)? Viagem vazia não muda a etapa. */
  function tripMatters() {
    const T = S.train;
    return aboard() || T.mode === 'loading' || (T.route === 'moon' && S.place.moon === 'gantry');
  }
  /** @returns {Stage} */
  function stage() {
    const T = S.train;
    if (S.done) return 'done';
    if (T.mode !== 'idle' && tripMatters()) {
      if (T.mode === 'sneezing') return 'sneezing';
      if (T.mode === 'blocked') return 'blocked';
      if (T.mode === 'home') return 'returning';
      if (T.route === 'loop' && T.s >= RETURN_FROM) return 'returning';
      return /** @type {Stage} */ (ROUTE_STAGE[T.route]);
    }
    if (S.place.planet === 'carried') return 'carrying';
    if (S.place.moon === 'carried') return 'carryingMoon';
    if (S.place.planet === 'tray') return 'ready';
    if (S.place.moon === 'tray') return 'moonReady';
    if (S.place.moon === 'wagon') return 'moonLoaded';
    if (S.place.planet === 'rocket') return 'planetDocked';
    return 'waiting';
  }
  function notifyStage() {
    const st = stage();
    if (st !== lastStage) { lastStage = st; onStageChange(st); }
  }

  // ------------------------------------------------------------------ desenho da composição e das cargas
  /** Deslocamento (m, no sentido da ida) da carga no vagão: sozinha no meio; a lua sempre na frente. */
  function slotOffset(cargo) {
    if (cargo === 'moon') return S.place.planet === 'wagon' ? TRAIN.slot : 0;
    const moonIn = S.place.moon === 'wagon' || S.place.moon === 'loading';
    if (!moonIn) return 0;
    // o planeta rola para trás, abrindo espaço, enquanto a lua cai
    if (S.place.moon === 'loading') return -TRAIN.slot * smooth((S.load.timer / MOON_GANTRY.loadTime - 0.2) / 0.3);
    return -TRAIN.slot;
  }
  /** Centro da carga no vagão. */
  function cargoPoint(cargo) {
    const d = slotOffset(cargo);
    return { x: wagon.x - Math.sin(wagon.yaw) * d, y: TRAIN.cargoY, z: wagon.z - Math.cos(wagon.yaw) * d };
  }
  /** Coloca a composição na distância atual e as cargas do vagão sobre ele. */
  function drawTrain(tip = 0) {
    const c = TR.consist(S.train.route || 'loop', S.train.s);
    Object.assign(train, { x: c.x, z: c.z, yaw: c.yaw });
    Object.assign(wagon, c.wagon);
    camPoint.x = (c.x + c.wagon.x) / 2;
    camPoint.z = (c.z + c.wagon.z) / 2;
    props.train.setPose({ x: c.x, z: c.z, yaw: c.yaw, wagon: c.wagon, tip });
    for (const cargo of CARGOS) {
      if (S.place[cargo] !== 'wagon' || holderOf(cargo)) continue;
      const p = cargoPoint(cargo);
      items[cargo].prop.object.position.set(p.x, p.y, p.z);
    }
  }
  /** Prende a carga no berço do foguete (ela sobe junto na decolagem). */
  function dock(cargo) {
    const it = items[cargo];
    it.item.returnHome();
    const socket = props.goal.socket(cargo);
    socket.add(it.prop.object);
    it.prop.object.position.set(0, 0, 0);
    it.prop.object.rotation.set(0, 0, 0);
    it.prop.setHighlight(false);
    S.place[cargo] = 'rocket';
    emit('expresso:dock', { cargo, x: ROCKET.x, z: ROCKET.z });
  }

  // ------------------------------------------------------------------ nariz
  function enableAfterClear() {
    if (S.armed || !trainHome()) return;
    // A nuvem pode tocar pelo raio mesmo com o centro fora do setor frontal.
    if (scent.clouds.some((c) => c.state === 'free' && Math.hypot(c.x - NOSE.x, c.z - NOSE.z) < NOSE.r + c.r * 0.7)) return;
    blocked.clear();
    for (const cloud of scent.clouds) blocked.add(cloud.id);
    S.armed = true;
    nose.enabled = true;
  }
  const nose = scent.addNose({
    id: NOSE.id, x: NOSE.x, z: NOSE.z, r: NOSE.r, enabled: true,
    onSmell(cloud) {
      if (S.disposed || !S.armed || !trainHome() || blocked.has(cloud.id)) return;
      // scent já marcou esta nuvem: rejeição é definitiva, sem editar smelled.
      if (cloud.z < NOSE.frontZ || Math.abs(cloud.x - NOSE.x) > NOSE.halfWidth) {
        hints.now('front');
        return;
      }
      const T = S.train;
      Object.assign(T, { mode: 'sneezing', route: S.route, s: 0, speed: 0, timer: 0, burst: false, nextChuff: T.odo + TRAIN.chuffEvery * 0.5 });
      S.armed = false;
      nose.enabled = false;
      S.trips++;
      // "ah... ah...": o nariz sente o cheiro; o "atchim" vem em TRAIN.burstAt
      emit('expresso:sneeze', { route: T.route, x: NOSE.x, z: NOSE.z });
    },
  });

  // ------------------------------------------------------------------ objetivo
  /** A cancela está (ou vai ficar) em pé para a próxima viagem? */
  const barrierHeld = () => S.forceBarrier || plate.pressed;
  /** @param {import('../../types').DogName} activeName */
  function objective(activeName) {
    const O = TEXT.objective;
    const st = stage();
    const T = S.train;
    const C = ctx.ctrls;
    if (st === 'done') return { text: null, target: null, stage: st };
    if (st === 'carrying' || st === 'carryingMoon') {
      return { text: st === 'carrying' ? O.carrying : O.carryingMoon, target: at(ROCKET.x, ROCKET.z, 1.0), stage: st };
    }
    if (st === 'ready') return { text: O.pickup, target: at(TRAY.x, TRAY.z, 0.45), stage: st };
    if (st === 'moonReady') return { text: O.pickupMoon, target: at(TRAY.x, TRAY.z, 0.45), stage: st };
    if (st === 'blocked') return { text: O.blocked, target: at(train.x, train.z, 1.05), stage: st };
    if (st === 'sneezing' || st === 'movingLoop' || st === 'movingDelivery' || st === 'movingMoon' || st === 'returning') {
      const back = T.mode === 'parked' || T.mode === 'home';
      const fetching = T.route === 'moon' && (S.place.moon === 'gantry' || S.place.moon === 'loading');
      const text = back ? (T.route === 'moon' && S.place.moon === 'wagon' ? O.moonBack : O.waitTrain) : fetching ? O.fetching : O.moving;
      return { text, target: at(train.x, train.z, 1.05), stage: st };
    }
    // viagem vazia andando: espere voltar
    if (!trainHome()) return { text: O.waitTrain, target: at(train.x, train.z, 1.05), stage: st };
    // trem na estação: buscar a lua (se ainda está no pórtico) ou levar as cargas pela estrela
    if (!S.armed) return { text: O.airing, target: at(NOSE.x, NOSE.z), stage: st };
    const want = S.place.moon === 'gantry' ? 'moon' : 'delivery';
    if (S.route !== want) {
      const text = activeName === 'rhaenyra' ? (want === 'moon' ? O.pedalMoon : O.pedal) : O.switchJump;
      return { text, target: at(PEDAL.x, PEDAL.z, 0.35), stage: st };
    }
    if (want === 'delivery' && !barrierHeld()) {
      const by = plate.pressed ? plate.by : null;
      const stayRh = ctx.isStaying?.('rhaenyra');
      let text;
      let target = at(BARRIER_PLATE.x, BARRIER_PLATE.z, 0.45);
      if (by === 'rhaenyra' && activeName === 'rhaenyra') { text = O.barrierSwitch; target = at(C.radhija.x, C.radhija.z, 0.9); }
      else if (by === 'rhaenyra' && !stayRh) { text = O.barrierStay; target = at(C.rhaenyra.x, C.rhaenyra.z, 1.0); }
      else if (by === 'radhija') text = O.barrierSwap;
      else text = activeName === 'rhaenyra' ? O.barrierGo : O.barrierBring;
      if (by === 'rhaenyra' && stayRh && activeName === 'radhija') text = null;
      if (text) return { text, target, stage: st };
    }
    return { text: activeName === 'radhija' ? O.blow : O.switchBlow, target: at(NOSE.x, NOSE.z, 0.8), stage: st };
  }

  // ------------------------------------------------------------------ trem
  /** Avança até `target` (ida, s cresce) ou volta até 0 (dir = -1): tranco, cruzeiro e freada perto do fim. */
  function stepTrain(dt, target, dir) {
    const T = S.train;
    const remaining = Math.max(0, dir > 0 ? target - T.s : T.s - target);
    const brakeLimit = Math.max(TRAIN.minSpeed, Math.sqrt(2 * TRAIN.brake * remaining));
    T.speed = Math.min(TRAIN.speed, T.speed + TRAIN.accel * dt, brakeLimit);
    const step = Math.min(remaining, T.speed * dt);
    T.s += dir * step;
    T.odo += step;
    drawTrain();
    // baforadas da chaminé no ritmo do trem (som e vapor no feedback)
    while (T.odo >= T.nextChuff && remaining - step > 1e-9) {
      T.nextChuff += TRAIN.chuffEvery;
      const ch = ahead(TRAIN.chimney.z);
      emit('expresso:chuff', { x: ch.x, y: TRAIN.chimney.y, z: ch.z, speed: T.speed });
    }
    return remaining - step <= 1e-9;
  }
  /** Até onde a ida pode ir agora: na estrela, a cancela fechada segura o trem antes do braço. */
  function outTarget() {
    const T = S.train;
    if (T.route === 'delivery' && T.s <= BARRIER_STOP + 1e-9 && S.barrierK < 0.98) return BARRIER_STOP;
    return LENGTH[T.route];
  }
  function stepOut(dt) {
    const T = S.train;
    const target = outTarget();
    if (!stepTrain(dt, target, 1)) return;
    if (T.route === 'loop') {
      // circuito fechado: chegou de novo à estação, alinhado; sem girar no lugar
      T.s = 0;
      arriveHome();
      return;
    }
    if (target === BARRIER_STOP && T.s < LENGTH.delivery) {
      Object.assign(T, { mode: 'blocked', timer: 0, speed: 0 });
      hints.now('blocked', 4);
      emit('expresso:blocked', { x: train.x, z: train.z });
      return;
    }
    T.speed = 0;
    if (T.route === 'moon') {
      // embaixo do pórtico: a portinhola abre e a lua cai no vagão (se ainda estiver lá)
      if (S.place.moon === 'gantry') {
        Object.assign(T, { mode: 'loading', timer: 0 });
        S.place.moon = 'loading';
        S.load = { timer: 0, landed: false };
        emit('expresso:fetch', { x: MOON.x, y: MOON.y, z: MOON.z });
        cam.focusShot(MOON.x, MOON.z, { hold: 1.1 });
      } else {
        Object.assign(T, { mode: 'parked', timer: 0 });
        hints.now('gantryEmpty');
      }
      return;
    }
    // fim da estrela: a caçamba bascula e as cargas descem, a da frente primeiro
    T.mode = 'unloading';
    const list = inWagon().sort((a, b) => slotOffset(b) - slotOffset(a))
      .map((cargo, i) => ({ cargo, delay: i * TRAIN.unloadGap, from: cargoPoint(cargo) }));
    for (const it of list) S.place[it.cargo] = 'unloading';
    S.unload = { list, timer: 0 };
    emit('expresso:unload', { route: T.route, x: CHUTE.x, z: CHUTE.z0 });
  }
  function arriveHome() {
    const T = S.train;
    Object.assign(T, { mode: 'idle', route: null, s: 0, speed: 0, timer: 0 });
    drawTrain();
    hints.now('returned');
    emit('expresso:return', { x: train.x, z: train.z });
  }
  /** Caçamba basculando e as cargas rolando: borda do vagão → canaleta → bandeja. */
  function stepUnload(dt) {
    const T = S.train;
    const U = S.unload;
    U.timer += dt;
    const D = TRAIN.unloadTime;
    const span = D + (U.list.length > 1 ? TRAIN.unloadGap : 0);
    const t = U.timer;
    const holdUntil = span - 0.38 * D;
    const tip = t < 0.3 * D ? smooth(t / (0.3 * D)) : t < holdUntil ? 1 : 1 - smooth((t - holdUntil) / (0.3 * D));
    drawTrain(tip);
    // direção de avanço no fim da rota (para a canaleta)
    const dx = -Math.sin(wagon.yaw), dz = -Math.cos(wagon.yaw);
    const r = BALL.r;
    const top = { x: CHUTE.x, y: CHUTE.y0 + r, z: CHUTE.z0 };
    const bottom = { x: CHUTE.x, y: CHUTE.y1 + r, z: CHUTE.z1 };
    for (const it of U.list) {
      const k = Math.min(1, Math.max(0, (t - it.delay) / D));
      const end = trayPoint(it.cargo);
      const from = it.from;
      const lip = { x: from.x + dx * 0.25, y: from.y + 0.05, z: from.z + dz * 0.25 };
      const o = items[it.cargo].prop.object;
      const before = o.position.clone();
      /** @param {{x:number,y:number,z:number}} a @param {{x:number,y:number,z:number}} b @param {number} u @param {number} [hop] */
      const lerp = (a, b, u, hop = 0) => o.position.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + Math.sin(Math.PI * u) * hop, a.z + (b.z - a.z) * u);
      if (k < 0.08) o.position.set(from.x, from.y, from.z);
      else if (k < 0.3) lerp(from, lip, smooth((k - 0.08) / 0.22));
      else if (k < 0.42) lerp(lip, top, (k - 0.3) / 0.12, 0.05);
      else if (k < 0.8) { const u = (k - 0.42) / 0.38; lerp(top, bottom, u * u * 0.6 + u * 0.4); }
      else if (k < 0.95) lerp(bottom, end, (k - 0.8) / 0.15, 0.035);
      else o.position.set(end.x, end.y, end.z);
      // rola de verdade: gira pela distância percorrida em torno do eixo lateral
      const moved = o.position.distanceTo(before);
      if (moved > 0) o.rotation.x += moved / r;
    }
    if (t < span) return;
    drawTrain(0);
    for (const { cargo } of U.list) {
      const end = trayPoint(cargo);
      items[cargo].prop.object.position.set(end.x, end.y, end.z);
      items[cargo].prop.setHighlight(true);
      S.place[cargo] = 'tray';
      emit('expresso:delivery', { cargo, route: T.route, x: end.x, z: end.z });
    }
    if (U.list.length) {
      hints.now(U.list.length > 1 ? 'readyBoth' : U.list[0].cargo === 'planet' ? 'ready' : 'moonReady');
      cam.focusShot(TRAY.x, TRAY.z, { hold: 1 });
    }
    S.unload = { list: [], timer: 0 };
    Object.assign(T, { mode: 'parked', timer: 0 });
  }
  /** Embaixo do pórtico: a portinhola abre, a lua cai no vagão (o planeta abre espaço) e a portinhola fecha. */
  function stepLoad(dt) {
    const T = S.train;
    const Ld = S.load;
    Ld.timer += dt;
    const k = Math.min(1, Ld.timer / MOON_GANTRY.loadTime);
    props.hopper.setOpen(k < 0.2 ? smooth(k / 0.2) : k < 0.7 ? 1 : 1 - smooth((k - 0.7) / 0.3));
    drawTrain();
    const o = props.moon.object;
    const to = cargoPoint('moon');
    const before = o.position.clone();
    if (k < 0.15) o.position.set(MOON.x, MOON.y, MOON.z);
    else if (k < 0.5) {
      // cai acelerando, com um tiquinho de deriva até o lugar dela no vagão
      const u = (k - 0.15) / 0.35;
      o.position.set(MOON.x + (to.x - MOON.x) * u, MOON.y + (to.y - MOON.y) * u * u, MOON.z + (to.z - MOON.z) * u);
    } else if (k < 0.62) {
      const u = (k - 0.5) / 0.12;
      o.position.set(to.x, to.y + Math.sin(Math.PI * u) * 0.035, to.z);
    } else o.position.set(to.x, to.y, to.z);
    const moved = o.position.distanceTo(before);
    if (moved > 0) o.rotation.z += moved / MOON.r;
    if (k >= 0.5 && !Ld.landed) {
      Ld.landed = true;
      hints.now('loaded', 4);
      emit('expresso:loaded', { x: to.x, z: to.z });
    }
    if (k < 1) return;
    props.hopper.setOpen(0);
    S.place.moon = 'wagon';
    S.load = { timer: 0, landed: false };
    drawTrain();
    Object.assign(T, { mode: 'parked', timer: 0 });
  }

  // ------------------------------------------------------------------ cancela
  function updateBarrier(dt, ctrls, active) {
    const p = plate.update(dt, { ctrls });
    const T = S.train;
    // o trem que já passou do ponto de parada mantém a cancela em pé até sair da estrela
    const trainHolds = T.route === 'delivery' && T.s > BARRIER_STOP + 1e-6 && T.mode !== 'idle';
    const want = p.pressed || S.forceBarrier || trainHolds;
    if (want !== S.barrierWanted) {
      S.barrierWanted = want;
      emit('expresso:barrier', { open: want, x: BARRIER.postX, z: BARRIER.z });
      if (want && p.pressed) hints.now('barrierUp', 2.4);
    }
    const target = want ? 1 : 0;
    const k = S.barrierK + Math.sign(target - S.barrierK) * Math.min(Math.abs(target - S.barrierK), dt * 2.2);
    if (k !== S.barrierK) { S.barrierK = k; props.barrier.setOpen(k); }
    // a companheira saiu da placa seguindo a líder → ensinar o Fica (como nas pedras da fase 3)
    const was = S.prevPlateBy;
    if (was && !p.pressed && was !== active.name && !ctx.isStaying?.(was) && S.route === 'delivery') hints.now('stayPlate', 4, 8);
    S.prevPlateBy = p.pressed ? /** @type {import('../../types').DogName} */ (p.by) : null;
  }

  // ------------------------------------------------------------------ quadro a quadro
  function update(dt, { active, ctrls }) {
    if (S.disposed) return null;
    hints.frame(dt);
    const existing = new Set(scent.clouds.map((c) => c.id));
    for (const id of blocked) if (!existing.has(id)) blocked.delete(id);
    const T = S.train;
    // pedal: um pouso real avança a agulha (só com o trem parado na estação)
    const rh = ctrls.rhaenyra;
    if (rh.landed && onPedal(rh)) {
      S.pedalT = PEDAL.pulseTime;
      if (trainHome() && !S.done) {
        S.route = ROUTE_ORDER[(ROUTE_ORDER.indexOf(S.route) + 1) % ROUTE_ORDER.length];
        S.routeChanges++;
        props.junction.setRoute(S.route);
        hints.now(S.route, 3.2, 0);
        emit('expresso:route', { route: S.route, x: PEDAL.x, z: PEDAL.z, signX: SWITCH_SIGN.x, signZ: SWITCH_SIGN.z });
        // É também um impacto real numa placa; reutiliza seu som/partícula.
        emit('plate:press', { id: 'expresso-pedal', by: 'rhaenyra', x: PEDAL.x, z: PEDAL.z });
        // plano curto na placa da agulha: a seta virando mostra o efeito do pulo
        cam.focusShot(SWITCH_SIGN.x, SWITCH_SIGN.z, { hold: 0.6, inT: 0.45, outT: 0.55, scale: 0.95, y: 0.7 });
        onStageChange(stage());
      } else if (!S.done) hints.now('busy');
    }
    S.pedalT = Math.max(0, S.pedalT - dt);
    const standing = Object.values(ctrls).some((c) => !(c.jumpT > 0) && onPedal(c));
    props.pedal.setPress(S.pedalT > 0 ? Math.sin((S.pedalT / PEDAL.pulseTime) * Math.PI / 2) : standing ? 0.12 : 0);
    const work = inWagon().length > 0 || S.place.moon === 'gantry';
    if (trainHome() && work && S.route === 'loop' && standing && !(rh.jumpT > 0) && S.pedalT === 0) hints.cond('jump');
    updateBarrier(dt, ctrls, active);
    // trem
    if (T.mode === 'sneezing') {
      T.timer += dt;
      props.nose.setSneeze(Math.min(1, T.timer / TRAIN.sneezeTime));
      if (!T.burst && T.timer >= TRAIN.burstAt) {
        // ATCHIM: o espirro empurra o trem de ré (é a partida)
        T.burst = true;
        T.speed = TRAIN.kick;
        const n = ahead(TRAIN.noseZ);
        hints.now('sneeze', 2, 0);
        emit('expresso:atchim', { route: T.route, x: n.x, y: TRAIN.noseY, z: n.z, dirX: Math.sin(train.yaw), dirZ: Math.cos(train.yaw) });
        cam.focusShot(camPoint.x, camPoint.z, { target: camPoint, hold: 2.2, scale: 1.12 });
      }
      if (T.burst) stepOut(dt);
      if (T.timer >= TRAIN.sneezeTime) {
        props.nose.setSneeze(0);
        if (T.mode === 'sneezing') T.mode = 'out';
      }
    } else if (T.mode === 'out') stepOut(dt);
    else if (T.mode === 'blocked') {
      T.timer += dt;
      // se a cancela subir enquanto ele espera, segue viagem; senão, volta de frente
      if (S.barrierK >= 0.98) Object.assign(T, { mode: 'out', timer: 0 });
      else if (T.timer >= TRAIN.blockedPause) Object.assign(T, { mode: 'home', timer: 0 });
    } else if (T.mode === 'unloading') stepUnload(dt);
    else if (T.mode === 'loading') stepLoad(dt);
    else if (T.mode === 'parked') {
      T.timer += dt;
      if (T.timer >= TRAIN.homePause) Object.assign(T, { mode: 'home', timer: 0 });
    } else if (T.mode === 'home') {
      if (stepTrain(dt, 0, -1)) arriveHome();
    }
    enableAfterClear();
    // prompts e destaques
    const anyCarried = !!(items.planet.item.holder || items.moon.item.holder);
    const trayCargo = anyCarried ? null : trayCargoNear(active);
    hints.setPrompt(trayCargo === 'planet' ? 'ball' : trayCargo === 'moon' ? 'moon' : null);
    cols.update(active);
    for (const cargo of CARGOS) {
      const pl = S.place[cargo];
      // na bandeja (pegar) e a lua presa no pórtico (o objetivo dela)
      items[cargo].prop.setHighlight(pl === 'tray' || (cargo === 'moon' && pl === 'gantry'));
    }
    props.goal.setHighlight(S.place.planet === 'carried' || S.place.moon === 'carried');
    // foguete: a carga na boca encaixa no berço; as duas → decola
    for (const cargo of CARGOS) {
      const holder = holderOf(cargo);
      if (!holder || !deliveredAt(GOAL, ctrls[holder], active)) continue;
      dock(cargo);
      const both = S.place.planet === 'rocket' && S.place.moon === 'rocket';
      hints.now(both ? 'launch' : cargo === 'planet' && S.place.moon === 'gantry' ? 'needMoon' : 'docked', 3.6, 0);
    }
    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) { S.objKey = key; onStageChange(o.stage); }
    notifyStage();
    if (!S.done && S.place.planet === 'rocket' && S.place.moon === 'rocket') {
      S.done = true;
      props.goal.launch();
      emit('expresso:launch', { x: ROCKET.x, z: ROCKET.z });
      notifyStage();
      return 'delivered';
    }
    return null;
  }

  // ------------------------------------------------------------------ interação (E)
  function interact(c) {
    // uma carga na boca de cada vez, para as duas (a outra espera na bandeja)
    if (!carriedBy(c.name) && !items.planet.item.holder && !items.moon.item.holder) {
      const cargo = trayCargoNear(c);
      if (cargo) {
        items[cargo].item.attach(c.name);
        items[cargo].prop.setHighlight(false);
        S.place[cargo] = 'carried';
        emit('item:pickup', { name: c.name, item: 'ball', cargo, x: c.x, z: c.z });
        notifyStage();
        return true;
      }
    }
    if (onPedal(c)) { hints.now('jump'); return true; }
    if (atWindow(c)) { hints.now('nose'); return true; }
    if (reach(c, TRAY.x, TRAY.z) < 0.85 && aboard() && S.train.mode !== 'idle') { hints.now('early'); return true; }
    return false;
  }

  // ------------------------------------------------------------------ reinício e estágios de depuração
  function reset() {
    for (const cargo of CARGOS) {
      items[cargo].item.returnHome();
      items[cargo].prop.object.visible = true;
    }
    props.reset();
    hints.reset();
    cols.reset();
    scent.reset();
    plate.reset();
    blocked.clear();
    Object.assign(S, fresh());
    lastStage = 'waiting';
    nose.enabled = true;
    props.junction.setRoute('loop');
    props.nose.setSneeze(0);
    props.pedal.setPress(0);
    props.barrier.setOpen(0);
    props.hopper.setOpen(0);
    props.ball.setHighlight(false);
    props.moon.setHighlight(false);
    props.goal.setHighlight(false);
    drawTrain();
  }
  /** Põe a carga na bandeja (estado canônico de depuração). */
  function putInTray(cargo) {
    const p = trayPoint(cargo);
    items[cargo].prop.object.position.set(p.x, p.y, p.z);
    S.place[cargo] = 'tray';
  }
  /** @param {import('../../types').DogName} who @param {Cargo} cargo @param {{ x: number, z: number }} near */
  function carry(who, cargo, near) {
    place(who, near.x, near.z);
    items[cargo].item.attach(who);
    S.place[cargo] = 'carried';
  }
  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(/** @type {Stage} */ (st))) return null;
    reset();
    if (st === 'waiting') return who || 'rhaenyra';
    const T = S.train;
    const carrier = who || 'radhija';
    const tripStages = ['sneezing', 'movingLoop', 'movingDelivery', 'movingMoon', 'blocked', 'returning'];
    if (tripStages.includes(st)) {
      const route = st === 'movingLoop' || st === 'returning' ? 'loop' : st === 'movingMoon' ? 'moon' : 'delivery';
      S.route = route;
      props.junction.setRoute(route);
      S.armed = false;
      nose.enabled = false;
      // na estrela, ?stage= segura a cancela aberta como se alguém estivesse na placa
      if (route === 'delivery' && st !== 'blocked') { S.forceBarrier = true; S.barrierK = 1; props.barrier.setOpen(1); }
      Object.assign(T, { mode: st === 'sneezing' ? 'sneezing' : st === 'blocked' ? 'blocked' : 'out', route, s: 0, speed: 0, timer: 0 });
      if (st === 'returning') Object.assign(T, { s: RETURN_FROM, speed: TRAIN.speed });
      if (st === 'blocked') T.s = BARRIER_STOP;
      T.nextChuff = T.odo + TRAIN.chuffEvery * 0.5;
      drawTrain();
      return carrier;
    }
    // daqui em diante o trem está parado na estação
    if (st === 'moonLoaded') {
      // de volta do pórtico com as duas cargas: falta a estrela
      S.place.moon = 'wagon';
      S.route = 'moon';
      props.junction.setRoute('moon');
    } else if (st === 'ready') {
      putInTray('planet');
      putInTray('moon');
    } else if (st === 'carrying') {
      putInTray('moon');
      carry(carrier, 'planet', { x: TRAY.x, z: TRAY.z + 0.4 });
    } else {
      dock('planet');
      if (st === 'moonReady') putInTray('moon');
      else if (st === 'carryingMoon') carry(carrier, 'moon', { x: TRAY.x, z: TRAY.z + 0.4 });
      else if (st === 'done') carry(carrier, 'moon', GOAL);
      // planetDocked: a lua continua no pórtico e o vagão volta vazio
    }
    drawTrain();
    lastStage = stage();
    return carrier;
  }
  return {
    S: hints.S, TEXT, stages: STAGES, objective, update, interact, reset, jumpToStage,
    lockFor: () => null, navFlags: () => ({}),
    lookTarget: (c) => {
      const tc = trayCargoNear(c);
      if (tc) return at(TRAY.x, TRAY.z, TRAY.y);
      return atWindow(c) ? at(NOSE.x, NOSE.z, 0.65) : null;
    },
    onBark: (c) => { if (atWindow(c)) hints.now('nose'); else if (onPedal(c)) hints.now('jump'); },
    setPrompt: (kind) => hints.setPrompt(kind),
    dispose() { S.disposed = true; S.armed = false; nose.enabled = false; blocked.clear(); },
    info: () => ({
      expresso: {
        state: stage(), route: S.route, tripRoute: S.train.route, armed: S.armed, mode: S.train.mode,
        blockedCloudIds: [...blocked], blockedCloudIdsCount: blocked.size, train: { ...train }, wagon: { ...wagon },
        distance: S.train.s, speed: S.train.speed, cargo: inWagon(), trips: S.trips, routeChanges: S.routeChanges,
        unloading: S.train.mode === 'unloading', loading: S.train.mode === 'loading', place: { ...S.place },
        barrier: { open: +S.barrierK.toFixed(3), plate: plate.pressed, by: plate.by },
      },
      ball: { holder: items.planet.item.holder, x: props.ball.object.position.x, z: props.ball.object.position.z },
      moon: { holder: items.moon.item.holder, x: props.moon.object.position.x, z: props.moon.object.position.z },
      objective: objective(ctx.activeDog).text,
    }),
    get stage() { return stage(); },
    get carrier() { return items.planet.item.holder || items.moon.item.holder; },
    get collected() { return cols.count; }, get total() { return cols.total; },
    set onStageChange(fn) { onStageChange = fn; },
  };
}
