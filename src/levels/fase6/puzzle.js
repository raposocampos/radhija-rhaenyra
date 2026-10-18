// Expresso do Superbafo · puzzle. A catraca reage ao pouso; o nariz reage à nuvem real. Tudo avança por dt.
// O trem segue o trilho de track.js (o mesmo que o cenário desenha). O foguete do tapete só decola com as
// duas cargas, e as duas precisam chegar de trem:
//   1. A bolinha-planeta já está no vagão. Pulo no pedal escolhe a rota (volta → estrela → lua → volta) e o
//      superbafo frontal da Radhija faz o trem espirrar: o "atchim" dá o tranco de ré e ele parte.
//      A estrela tem uma cancela que só sobe com alguém na placa do lado de fora (use o Fica).
//   2. No fim da estrela ou da lua, a caçamba bascula e a carga rola pela canaleta até a bandeja; o trem
//      espera um pouco e volta sozinho, de frente, para a estação. A carga vai na boca até o foguete.
//   3. A lua está na cestinha ao lado da bancada: na boca até o funil da maquete, que a leva (pelo elevador da estação) ao vagão
//      vazio. Depois, a rota da lua e outro superbafo. Com as duas cargas no foguete, ele decola.
import { createCarryItem, createCollectibles, createHints, deliveredAt, reach } from '../../game/puzzleKit.js';
import { createPressurePlate } from '../../game/mechanics/index.js';
import { createTrack } from './track.js';
import {
  PEDAL, SWITCH_SIGN, ROUTE_ORDER, TRAIN, TRACK, BARRIER, BARRIER_PLATE, NOSE, BLOW_SPOT, TRAY, MOON_TRAY, CHUTE,
  MOON_CHUTE, BALL, MOON, FUNNEL, LOADER, ROCKET, TRAIN_BODY, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R,
} from './layout.js';

/**
 * @typedef {'waiting'|'sneezing'|'movingLoop'|'movingDelivery'|'movingMoon'|'blocked'|'returning'|'ready'|'carrying'
 *   |'planetDocked'|'loading'|'moonLoaded'|'moonReady'|'carryingMoon'|'done'} Stage
 * @typedef {import('../../types').Fase6Route} Route
 * @typedef {import('../../types').Fase6Cargo} Cargo
 * @typedef {'wagon'|'unloading'|'tray-delivery'|'tray-moon'|'carried'|'loading'|'rocket'|'shelf'} Place
 * @typedef {'idle'|'sneezing'|'out'|'blocked'|'unloading'|'parked'|'home'} TrainMode
 */
/** @type {Stage[]} */
export const STAGES = ['waiting', 'sneezing', 'movingLoop', 'movingDelivery', 'movingMoon', 'blocked', 'returning', 'ready',
  'carrying', 'planetDocked', 'loading', 'moonLoaded', 'moonReady', 'carryingMoon', 'done'];
export const TEXT = {
  objective: {
    pedal: 'Pule no pedal com a Rhaenyra para apontar o trilho para a estrela (Espaço)',
    pedalMoon: 'Pule no pedal com a Rhaenyra até a seta da lua (Espaço)',
    switchJump: 'Troque para a Rhaenyra (Q): o pedal precisa de um pulão!',
    blow: 'Faça a locomotiva espirrar com o superbafo da Radhija (segure R e solte)',
    switchBlow: 'O trilho está pronto! Troque para a Radhija (Q) e use o superbafo (segure R e solte)',
    barrierGo: 'A cancela da estrela está fechada: pare a Rhaenyra na placa ao lado da maquete',
    barrierBring: 'A cancela está fechada: troque para a Rhaenyra (Q) e leve-a até a placa ao lado da maquete',
    barrierSwitch: 'Cancela aberta! Agora troque para a Radhija (Q)',
    barrierStay: 'Peça para a Rhaenyra ficar na placa (F)',
    barrierSwap: 'Quem sopra é a Radhija: deixe a Rhaenyra na placa no lugar dela',
    moving: 'Atchim! Veja por onde o vagão leva a carga',
    blocked: 'A cancela estava fechada: o trem vai voltar para a estação',
    airing: 'Espere o cheirinho sair da janela para soprar de novo',
    pickup: 'Pegue a bolinha-planeta na bandeja (E)',
    pickupMoon: 'Pegue a lua na bandeja (E)',
    carrying: 'Leve a bolinha-planeta ao foguete',
    carryingMoon: 'Leve a lua ao foguete',
    fetchMoon: 'O foguete precisa da lua também! Busque a lua na cestinha ao lado da bancada (E)',
    toFunnel: 'Leve a lua até o funil da maquete e solte com E',
    waitTrain: 'Espere o trem voltar para a estação para carregar a lua',
    loading: 'A lua está descendo pelo funil até o vagão…',
  },
  hint: {
    jump: 'A mola precisa de um pulão! Pare no pedal e pule com a Rhaenyra (Espaço).',
    busy: 'O trem está andando. Espere ele voltar para mudar o trilho.',
    delivery: 'A seta aponta para a estrela! Agora é a vez do superbafo da Radhija.',
    moon: 'A seta aponta para a lua!',
    loop: 'A seta circular faz o trem dar uma volta. Pule de novo para mudar.',
    returned: 'O trem voltou para a estação!',
    front: 'Mire pela janela do nariz e solte outro superbafo (segure R e solte).',
    nose: 'Esse nariz de brinquedo espirra com o superbafo da Radhija!',
    early: 'A carga ainda está no trem. Leve o vagão até a bandeja.',
    ready: 'A bolinha chegou! As duas podem pegá-la na bandeja (E).',
    moonReady: 'A lua chegou! Pegue-a na bandeja (E).',
    sneeze: 'Atchim! O trem engatou a ré!',
    blocked: 'Fiu-fiu! A cancela está fechada. Alguém precisa ficar na placa ao lado da maquete.',
    stayPlate: 'Use Fica (F) para a companheira segurar a placa da cancela!',
    barrierUp: 'A cancela subiu!',
    docked: 'Encaixou no foguete!',
    needMoon: 'Agora falta a lua! Ela está na cestinha ao lado da bancada.',
    byTrain: 'A carga precisa chegar de trem! Solte-a no funil da maquete.',
    funnelBusy: 'O vagão precisa estar vazio, na estação, para receber a lua.',
    funnelEmpty: 'Esse funil leva a lua até o vagão. Traga a lua da cestinha ao lado da bancada!',
    loaded: 'A lua está no vagão! Pule no pedal até a seta da lua.',
    launch: '3… 2… 1… o foguete decolou!',
  },
  prompt: { ball: 'Pegar a bolinha-planeta', moon: 'Pegar a lua', funnel: 'Soltar no funil' },
};

const TR = createTrack();
const LENGTH = { loop: TR.routes.loop.length, delivery: TR.routes.delivery.length, moon: TR.routes.moon.length };
/** A volta conta como "voltando" (stage returning) a partir deste ponto do circuito. */
export const RETURN_FROM = LENGTH.loop - TRACK.returnDistance;
/** Na estrela, o vagão (que vai à frente) para logo antes do braço da cancela fechada. */
export const BARRIER_STOP = BARRIER.s - TRAIN.cargoOffset - TRAIN_BODY.wagon.back - 0.06;
const DESTINATION = {
  delivery: { tray: TRAY, chute: CHUTE, place: /** @type {Place} */ ('tray-delivery') },
  moon: { tray: MOON_TRAY, chute: MOON_CHUTE, place: /** @type {Place} */ ('tray-moon') },
};
/** Duas cargas cabem lado a lado na mesma bandeja. */
const SLOT = { planet: -0.1, moon: 0.1 };
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const ROUTE_STAGE = { loop: 'movingLoop', delivery: 'movingDelivery', moon: 'movingMoon' };

/** @param {import('../../types').PuzzleContext<import('../../types').Fase6Props>} ctx @returns {import('../../types').Puzzle} */
export function createPuzzle(ctx) {
  const { props, dogs, root, emit, scent, cam, place } = ctx;
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const items = {
    planet: { item: createCarryItem({ obj: props.ball.object, dogs, scene: root, name: 'ball' }), prop: props.ball, home: BALL },
    moon: { item: createCarryItem({ obj: props.moon.object, dogs, scene: root, name: 'ball' }), prop: props.moon, home: MOON },
  };
  const plate = createPressurePlate({ id: BARRIER_PLATE.id, x: BARRIER_PLATE.x, z: BARRIER_PLATE.z, r: BARRIER_PLATE.r, emit, prop: props.barrierPlate, margin: 0.4 });
  const fresh = () => ({
    route: /** @type {Route} */ ('loop'),
    armed: true, pedalT: 0, trips: 0, routeChanges: 0, disposed: false, objKey: '', done: false,
    /** @type {{ mode: TrainMode, route: Route | null, s: number, speed: number, timer: number, burst: boolean, odo: number, nextChuff: number, cargo: Cargo | null }} */
    train: { mode: 'idle', route: null, s: 0, speed: 0, timer: 0, burst: false, odo: 0, nextChuff: 0, cargo: 'planet' },
    /** @type {Record<Cargo, Place>} */
    place: { planet: 'wagon', moon: 'shelf' },
    /** As duas só entram no foguete depois de chegar de trem a uma bandeja. */
    traveled: { planet: false, moon: false },
    barrierK: 0, barrierWanted: false, forceBarrier: false,
    unload: { cargo: /** @type {Cargo | null} */ (null), timer: 0, from: { x: 0, y: 0, z: 0 } },
    load: { cargo: /** @type {Cargo | null} */ (null), timer: 0 },
    loaderK: 0, prevPlateBy: /** @type {string | null} */ (null),
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
  const atFunnel = (c) => reach(c, FUNNEL.x, FUNNEL.z) < FUNNEL.reach;
  /** Ponto da locomotiva a `d` m à frente da cara dela (a cara olha para trás do movimento de ida). */
  const ahead = (d) => ({ x: train.x + Math.sin(train.yaw) * d, z: train.z + Math.cos(train.yaw) * d });
  const holderOf = (cargo) => items[cargo].item.holder;
  const carriedBy = (name) => /** @type {Cargo | null} */ (['planet', 'moon'].find((k) => items[k].item.holder === name) || null);
  const trayPoint = (cargo, route) => ({ x: DESTINATION[route].tray.x + SLOT[cargo], y: DESTINATION[route].tray.y, z: DESTINATION[route].tray.z });
  /** Carga numa bandeja (a mais próxima da dog, se houver duas). */
  function trayCargoNear(c) {
    let best = null, bestD = Infinity;
    for (const cargo of /** @type {Cargo[]} */ (['planet', 'moon'])) {
      const pl = S.place[cargo];
      if (pl !== 'tray-delivery' && pl !== 'tray-moon') continue;
      const tray = pl === 'tray-delivery' ? TRAY : MOON_TRAY;
      const d = reach(c, tray.x, tray.z);
      if (d < tray.pickupR && d < bestD) { best = cargo; bestD = d; }
    }
    return best;
  }
  const nearShelfMoon = (c) => S.place.moon === 'shelf' && reach(c, MOON.x, MOON.z) < MOON.pickupR;
  const trainHome = () => S.train.mode === 'idle';
  const wagonEmpty = () => S.train.cargo === null && S.place.planet !== 'wagon' && S.place.moon !== 'wagon' && !S.load.cargo;

  // ------------------------------------------------------------------ estágio (derivado do estado)
  /** @returns {Stage} */
  function stage() {
    const T = S.train;
    if (S.done) return 'done';
    // viagem com carga a bordo: é ela que conta (viagem vazia não muda a etapa das cargas)
    if (T.cargo && T.mode !== 'idle') {
      if (T.mode === 'sneezing') return 'sneezing';
      if (T.mode === 'blocked') return 'blocked';
      if (T.mode === 'home') return 'returning';
      if (T.route === 'loop' && T.s >= RETURN_FROM) return 'returning';
      return /** @type {Stage} */ (ROUTE_STAGE[T.route]);
    }
    if (S.place.planet === 'carried') return 'carrying';
    if (S.place.moon === 'carried') return 'carryingMoon';
    if (S.load.cargo) return 'loading';
    if (S.place.planet.startsWith('tray')) return 'ready';
    if (S.place.moon.startsWith('tray')) return 'moonReady';
    if (S.place.moon === 'wagon' && S.place.planet === 'rocket') return 'moonLoaded';
    if (S.place.planet === 'rocket') return 'planetDocked';
    return 'waiting';
  }
  function notifyStage() {
    const st = stage();
    if (st !== lastStage) { lastStage = st; onStageChange(st); }
  }

  // ------------------------------------------------------------------ desenho da composição e das cargas
  /** Coloca a composição na distância atual e a carga do vagão sobre ele. */
  function drawTrain(tip = 0) {
    const c = TR.consist(S.train.route || 'loop', S.train.s);
    Object.assign(train, { x: c.x, z: c.z, yaw: c.yaw });
    Object.assign(wagon, c.wagon);
    camPoint.x = (c.x + c.wagon.x) / 2;
    camPoint.z = (c.z + c.wagon.z) / 2;
    props.train.setPose({ x: c.x, z: c.z, yaw: c.yaw, wagon: c.wagon, tip });
    for (const cargo of /** @type {Cargo[]} */ (['planet', 'moon'])) {
      if (S.place[cargo] === 'wagon' && !holderOf(cargo)) items[cargo].prop.object.position.set(wagon.x, TRAIN.cargoY, wagon.z);
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
      if (S.disposed || !S.armed || !trainHome() || S.load.cargo || blocked.has(cloud.id)) return;
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
  /** @param {import('../../types').DogName} activeName */
  function objective(activeName) {
    const O = TEXT.objective;
    const st = stage();
    const T = S.train;
    const C = ctx.ctrls;
    const tray = (cargo) => (S.place[cargo] === 'tray-moon' ? MOON_TRAY : TRAY);
    if (st === 'done') return { text: null, target: null, stage: st };
    if (st === 'carrying' || st === 'carryingMoon') {
      const cargo = st === 'carrying' ? 'planet' : 'moon';
      if (!S.traveled[cargo]) return { text: O.toFunnel, target: at(FUNNEL.x, FUNNEL.z, 0.9), stage: st };
      return { text: cargo === 'planet' ? O.carrying : O.carryingMoon, target: at(ROCKET.x, ROCKET.z, 1.0), stage: st };
    }
    if (st === 'loading') return { text: O.loading, target: at(LOADER.x, LOADER.z, LOADER.top + 0.1), stage: st };
    if (st === 'ready') return { text: O.pickup, target: at(tray('planet').x, tray('planet').z, 0.45), stage: st };
    if (st === 'moonReady') return { text: O.pickupMoon, target: at(tray('moon').x, tray('moon').z, 0.45), stage: st };
    if (st === 'blocked') return { text: O.blocked, target: at(train.x, train.z, 1.05), stage: st };
    if (st !== 'waiting' && st !== 'planetDocked' && st !== 'moonLoaded') return { text: O.moving, target: at(train.x, train.z, 1.05), stage: st };
    if (st === 'planetDocked') {
      if (!trainHome()) return { text: O.waitTrain, target: at(train.x, train.z, 1.05), stage: st };
      return { text: O.fetchMoon, target: at(MOON.x, MOON.z, 0.55), stage: st };
    }
    // trem na estação com carga: escolher a rota, abrir a cancela (estrela) e soprar
    if (!S.armed) return { text: O.airing, target: at(NOSE.x, NOSE.z), stage: st };
    const want = T.cargo === 'moon' ? 'moon' : 'delivery';
    if (S.route !== want) {
      const text = activeName === 'rhaenyra' ? (want === 'moon' ? O.pedalMoon : O.pedal) : O.switchJump;
      return { text, target: at(PEDAL.x, PEDAL.z, 0.35), stage: st };
    }
    if (S.route === 'delivery' && !barrierHeld()) {
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
  /** A cancela está (ou vai ficar) em pé para a próxima viagem? */
  const barrierHeld = () => S.forceBarrier || plate.pressed;

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
    // fim da estrela ou da lua: a caçamba bascula
    T.mode = 'unloading';
    T.speed = 0;
    S.unload = { cargo: T.cargo, timer: 0, from: { x: wagon.x, y: TRAIN.cargoY, z: wagon.z } };
    if (T.cargo) S.place[T.cargo] = 'unloading';
    const ch = DESTINATION[T.route].chute;
    emit('expresso:unload', { route: T.route, x: ch.x, z: ch.z0 });
  }
  function arriveHome() {
    const T = S.train;
    Object.assign(T, { mode: 'idle', route: null, s: 0, speed: 0, timer: 0 });
    drawTrain();
    hints.now('returned');
    emit('expresso:return', { x: train.x, z: train.z });
  }
  /** Caçamba basculando e a carga rolando: borda do vagão → canaleta → bandeja. */
  function stepUnload(dt) {
    const T = S.train;
    const U = S.unload;
    U.timer += dt;
    const k = Math.min(1, U.timer / TRAIN.unloadTime);
    const tip = k < 0.3 ? smooth(k / 0.3) : k < 0.62 ? 1 : 1 - smooth((k - 0.62) / 0.3);
    drawTrain(tip);
    if (U.cargo) {
      const D = DESTINATION[T.route];
      const end = trayPoint(U.cargo, T.route);
      // direção de avanço no fim da rota (para a canaleta)
      const dx = -Math.sin(wagon.yaw), dz = -Math.cos(wagon.yaw);
      const r = BALL.r;
      const lip = { x: U.from.x + dx * 0.25, y: U.from.y + 0.05, z: U.from.z + dz * 0.25 };
      const top = { x: D.chute.x, y: D.chute.y0 + r, z: D.chute.z0 };
      const bottom = { x: D.chute.x, y: D.chute.y1 + r, z: D.chute.z1 };
      const o = items[U.cargo].prop.object;
      const before = o.position.clone();
      /** @param {{x:number,y:number,z:number}} a @param {{x:number,y:number,z:number}} b @param {number} u @param {number} [hop] */
      const lerp = (a, b, u, hop = 0) => o.position.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + Math.sin(Math.PI * u) * hop, a.z + (b.z - a.z) * u);
      if (k < 0.08) o.position.set(U.from.x, U.from.y, U.from.z);
      else if (k < 0.3) lerp(U.from, lip, smooth((k - 0.08) / 0.22));
      else if (k < 0.42) lerp(lip, top, (k - 0.3) / 0.12, 0.05);
      else if (k < 0.8) { const u = (k - 0.42) / 0.38; lerp(top, bottom, u * u * 0.6 + u * 0.4); }
      else if (k < 0.95) lerp(bottom, end, (k - 0.8) / 0.15, 0.035);
      else o.position.set(end.x, end.y, end.z);
      // rola de verdade: gira pela distância percorrida em torno do eixo lateral
      const moved = o.position.distanceTo(before);
      if (moved > 0) o.rotation.x += moved / r;
    }
    if (k < 1) return;
    drawTrain(0);
    if (U.cargo) {
      const cargo = U.cargo;
      const end = trayPoint(cargo, T.route);
      items[cargo].prop.object.position.set(end.x, end.y, end.z);
      items[cargo].prop.setHighlight(true);
      S.place[cargo] = DESTINATION[T.route].place;
      S.traveled[cargo] = true;
      hints.now(cargo === 'planet' ? 'ready' : 'moonReady');
      emit('expresso:delivery', { cargo, route: T.route, x: end.x, z: end.z });
      cam.focusShot(end.x, end.z, { hold: 1 });
    }
    T.cargo = null;
    S.unload = { cargo: null, timer: 0, from: { x: 0, y: 0, z: 0 } };
    Object.assign(T, { mode: 'parked', timer: 0 });
  }

  // ------------------------------------------------------------------ cancela, funil e elevador
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
    S.prevPlateBy = p.pressed ? p.by : null;
  }
  /** Lua (ou planeta) no funil: some na base, sobe no elevador e cai no vagão. */
  function stepLoad(dt) {
    const L = S.load;
    if (!L.cargo) {
      S.loaderK = Math.max(0, S.loaderK - dt * 2.5);
      props.loader.setSpout(smooth(S.loaderK));
      return;
    }
    L.timer += dt;
    const k = Math.min(1, L.timer / LOADER.loadTime);
    const o = items[L.cargo].prop.object;
    const tube = { x: LOADER.x, z: LOADER.z };
    if (k < 0.18) {
      // desce pelo funil até sumir no tubo da base
      const u = k / 0.18;
      o.visible = true;
      o.position.set(FUNNEL.x, FUNNEL.mouthY - u * (FUNNEL.mouthY - 0.06), FUNNEL.z);
    } else if (k < 0.4) {
      o.visible = false; // correndo pelo tubo por dentro da base
    } else if (k < 0.72) {
      // sobe pelo elevador de vidro da estação
      const u = (k - 0.4) / 0.32;
      o.visible = true;
      o.position.set(tube.x, 0.2 + u * (LOADER.top - 0.2), tube.z);
    } else {
      // a bica vira sobre o vagão e a carga cai dentro dele
      const u = (k - 0.72) / 0.28;
      S.loaderK = Math.min(1, u * 2.2);
      const spoutEnd = { x: wagon.x + 0.08, y: TRAIN.cargoY + 0.16, z: wagon.z };
      const a = Math.min(1, u * 1.6);
      o.position.set(tube.x + (spoutEnd.x - tube.x) * a, LOADER.top + (spoutEnd.y - LOADER.top) * a, tube.z + (spoutEnd.z - tube.z) * a);
      if (u > 0.6) o.position.set(wagon.x, TRAIN.cargoY + (1 - (u - 0.6) / 0.4) * 0.16, wagon.z);
    }
    props.loader.setSpout(smooth(S.loaderK));
    if (k < 1) return;
    o.visible = true;
    S.place[L.cargo] = 'wagon';
    S.train.cargo = L.cargo;
    S.load = { cargo: null, timer: 0 };
    drawTrain();
    hints.now('loaded', 4);
    emit('expresso:loaded', { x: wagon.x, z: wagon.z });
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
    if (trainHome() && T.cargo && S.route === 'loop' && standing && !(rh.jumpT > 0) && S.pedalT === 0) hints.cond('jump');
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
    else if (T.mode === 'parked') {
      T.timer += dt;
      if (T.timer >= TRAIN.homePause) Object.assign(T, { mode: 'home', timer: 0 });
    } else if (T.mode === 'home') {
      if (stepTrain(dt, 0, -1)) arriveHome();
    }
    stepLoad(dt);
    enableAfterClear();
    // prompts e destaques
    const carrying = carriedBy(active.name);
    const anyCarried = !!(items.planet.item.holder || items.moon.item.holder);
    const trayCargo = anyCarried ? null : trayCargoNear(active);
    const prompt = trayCargo === 'planet' ? 'ball' : trayCargo === 'moon' ? 'moon'
      : !anyCarried && nearShelfMoon(active) ? 'moon'
        : carrying && atFunnel(active) && !S.traveled[carrying] ? 'funnel' : null;
    hints.setPrompt(prompt);
    cols.update(active);
    for (const cargo of /** @type {Cargo[]} */ (['planet', 'moon'])) {
      const pl = S.place[cargo];
      items[cargo].prop.setHighlight(pl === 'tray-delivery' || pl === 'tray-moon' || (cargo === 'moon' && pl === 'shelf' && S.place.planet === 'rocket'));
    }
    props.goal.setHighlight(S.place.planet === 'carried' || S.place.moon === 'carried');
    // foguete: a carga que chegou de trem encaixa no berço; as duas → decola
    for (const cargo of /** @type {Cargo[]} */ (['planet', 'moon'])) {
      const holder = holderOf(cargo);
      if (!holder || !deliveredAt(GOAL, ctrls[holder], active)) continue;
      if (!S.traveled[cargo]) { hints.cond('byTrain', 3.6, 6); continue; }
      dock(cargo);
      hints.now(S.place.planet === 'rocket' && S.place.moon === 'rocket' ? 'launch' : cargo === 'planet' ? 'needMoon' : 'docked', 3.6, 0);
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
    const carrying = carriedBy(c.name);
    // uma carga na boca de cada vez, para as duas (a outra espera na bandeja ou na bancada)
    if (!carrying && !items.planet.item.holder && !items.moon.item.holder) {
      const trayCargo = trayCargoNear(c);
      const cargo = trayCargo || (nearShelfMoon(c) ? 'moon' : null);
      if (cargo) {
        items[cargo].item.attach(c.name);
        items[cargo].prop.setHighlight(false);
        S.place[cargo] = 'carried';
        emit('item:pickup', { name: c.name, item: 'ball', cargo, x: c.x, z: c.z });
        notifyStage();
        return true;
      }
    }
    if (atFunnel(c)) {
      if (!carrying) { hints.now('funnelEmpty'); return true; }
      if (S.traveled[carrying]) { hints.now('byTrain'); return true; }
      if (!trainHome() || !wagonEmpty()) { hints.now('funnelBusy'); return true; }
      // solta no funil: a carga sai da boca e começa a descer
      const it = items[carrying];
      it.item.returnHome();
      it.prop.object.position.set(FUNNEL.x, FUNNEL.mouthY, FUNNEL.z);
      S.place[carrying] = 'loading';
      S.load = { cargo: carrying, timer: 0 };
      emit('expresso:funnel', { cargo: carrying, x: FUNNEL.x, z: FUNNEL.z });
      notifyStage();
      return true;
    }
    if (onPedal(c)) { hints.now('jump'); return true; }
    if (atWindow(c)) { hints.now('nose'); return true; }
    for (const tray of [TRAY, MOON_TRAY]) {
      if (reach(c, tray.x, tray.z) < 0.85 && S.train.cargo && S.train.mode !== 'idle') { hints.now('early'); return true; }
    }
    return false;
  }

  // ------------------------------------------------------------------ reinício e estágios de depuração
  function reset() {
    for (const cargo of /** @type {Cargo[]} */ (['planet', 'moon'])) {
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
    props.loader.setSpout(0);
    props.ball.setHighlight(false);
    props.moon.setHighlight(false);
    props.goal.setHighlight(false);
    drawTrain();
  }
  /** Põe a carga numa bandeja (estado canônico de depuração). */
  function putInTray(cargo, route) {
    const p = trayPoint(cargo, route);
    items[cargo].prop.object.position.set(p.x, p.y, p.z);
    S.place[cargo] = DESTINATION[route].place;
    S.traveled[cargo] = true;
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
    // daqui em diante o trem está parado na estação e o planeta já viajou
    T.cargo = null;
    S.traveled.planet = true;
    if (st === 'ready') putInTray('planet', 'delivery');
    else if (st === 'carrying') {
      place(carrier, TRAY.x, TRAY.z + 0.4);
      items.planet.item.attach(carrier);
      S.place.planet = 'carried';
    } else {
      dock('planet');
      if (st === 'loading') { S.place.moon = 'loading'; S.load = { cargo: 'moon', timer: 0 }; }
      else if (st === 'moonLoaded') { S.place.moon = 'wagon'; T.cargo = 'moon'; S.route = 'moon'; props.junction.setRoute('moon'); }
      else if (st === 'moonReady') putInTray('moon', 'moon');
      else if (st === 'carryingMoon' || st === 'done') {
        S.traveled.moon = true;
        place(carrier, st === 'done' ? GOAL.x : MOON_TRAY.x, st === 'done' ? GOAL.z : MOON_TRAY.z + 0.4);
        items.moon.item.attach(carrier);
        S.place.moon = 'carried';
      }
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
      if (tc) { const t = S.place[tc] === 'tray-moon' ? MOON_TRAY : TRAY; return at(t.x, t.z, t.y); }
      if (nearShelfMoon(c)) return at(MOON.x, MOON.z, MOON.y);
      return atWindow(c) ? at(NOSE.x, NOSE.z, 0.65) : null;
    },
    onBark: (c) => { if (atWindow(c)) hints.now('nose'); else if (onPedal(c)) hints.now('jump'); },
    setPrompt: (kind) => hints.setPrompt(kind),
    dispose() { S.disposed = true; S.armed = false; nose.enabled = false; blocked.clear(); },
    info: () => ({
      expresso: {
        state: stage(), route: S.route, tripRoute: S.train.route, armed: S.armed, mode: S.train.mode,
        blockedCloudIds: [...blocked], blockedCloudIdsCount: blocked.size, train: { ...train }, wagon: { ...wagon },
        distance: S.train.s, speed: S.train.speed, cargo: S.train.cargo, trips: S.trips, routeChanges: S.routeChanges,
        unloading: S.train.mode === 'unloading', place: { ...S.place }, traveled: { ...S.traveled },
        barrier: { open: +S.barrierK.toFixed(3), plate: plate.pressed, by: plate.by }, loading: S.load.cargo,
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
