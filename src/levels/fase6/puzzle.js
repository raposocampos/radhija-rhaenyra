// A catraca reage ao pouso; o nariz reage à nuvem real. Tudo avança por dt.
// O trem segue o trilho de track.js (o mesmo que o cenário desenha): o "atchim" dá o tranco de ré, o trem
// acelera, freia perto do fim e chega alinhado; na entrega, a caçamba bascula e a bolinha desce a canaleta.
import { createCarryItem, createCollectibles, createHints, deliveredAt, reach } from '../../game/puzzleKit.js';
import { createTrack } from './track.js';
import { PEDAL, SWITCH_SIGN, TRAIN, TRACK, NOSE, BLOW_SPOT, TRAY, CHUTE, BALL, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R } from './layout.js';

/** @typedef {'waiting'|'sneezing'|'movingLoop'|'movingDelivery'|'returning'|'ready'|'carrying'|'done'} Stage */
/** @type {Stage[]} */
export const STAGES = ['waiting', 'sneezing', 'movingLoop', 'movingDelivery', 'returning', 'ready', 'carrying', 'done'];
export const TEXT = {
  objective: {
    pedal: 'Pule no pedal com a Rhaenyra para apontar o trilho para a estrela (Espaço)',
    switchJump: 'Troque para a Rhaenyra (Q): o pedal precisa de um pulão!',
    blow: 'Faça a locomotiva espirrar com o superbafo da Radhija (segure R e solte)',
    switchBlow: 'O trilho está pronto! Troque para a Radhija (Q) e use o superbafo (segure R e solte)',
    moving: 'Atchim! Veja por onde o vagão leva a bolinha',
    airing: 'Espere o cheirinho sair da janela para soprar de novo',
    pickup: 'Pegue a bolinha-planeta na bandeja (E)',
    carrying: 'Leve a bolinha-planeta ao tapete de foguete',
  },
  hint: {
    jump: 'A mola precisa de um pulão! Pare no pedal e pule com a Rhaenyra (Espaço).',
    busy: 'O trem está passando. Espere ele voltar para mudar o trilho.',
    delivery: 'A seta aponta para a estrela! Agora é a vez do superbafo da Radhija.',
    loop: 'A seta circular faz o trem dar uma volta. Outro pulo aponta para a estrela.',
    returned: 'Ele deu a volta! Pule no pedal para mudar o caminho até a estrela.',
    front: 'Mire pela janela do nariz e solte outro superbafo (segure R e solte).',
    nose: 'Esse nariz de brinquedo espirra com o superbafo da Radhija!',
    early: 'A bolinha ainda está no trem. Leve o vagão até a bandeja com a estrela.',
    ready: 'A bolinha chegou! As duas podem pegá-la na bandeja (E).',
    sneeze: 'Atchim! O trem engatou a ré!',
  },
  prompt: { ball: 'Pegar a bolinha-planeta' },
};

const TR = createTrack();
const LOOP_LENGTH = TR.routes.loop.length;
const DELIVERY_LENGTH = TR.routes.delivery.length;
/** A volta conta como "voltando" (stage returning) a partir deste ponto do circuito. */
export const RETURN_FROM = LOOP_LENGTH - TRACK.returnDistance;
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };

/** @param {import('../../types').PuzzleContext<import('../../types').Fase6Props>} ctx @returns {import('../../types').Puzzle} */
export function createPuzzle(ctx) {
  const { props, dogs, root, emit, scent, cam, place } = ctx;
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const ball = createCarryItem({ obj: props.ball.object, dogs, scene: root, name: 'ball' });
  /** @type {{ stage: Stage, route: import('../../types').Fase6Route, tripRoute: import('../../types').Fase6Route | null,
   * timer: number, distance: number, speed: number, burst: boolean, nextChuff: number, armed: boolean, pedalT: number,
   * trips: number, routeChanges: number, unloading: boolean, disposed: boolean, objKey: string }} */
  const S = { stage: 'waiting', route: 'loop', tripRoute: null, timer: 0, distance: 0, speed: 0, burst: false, nextChuff: 0,
    armed: true, pedalT: 0, trips: 0, routeChanges: 0, unloading: false, disposed: false, objKey: '' };
  /** Pose atual (locomotiva) e do vagão, para info/objetivo e para a câmera acompanhar a viagem. */
  const train = { ...TRAIN.start };
  const wagon = { ...TRAIN.start, z: TRAIN.start.z - TRAIN.cargoOffset };
  const camPoint = { x: train.x, y: 0.45, z: train.z };
  const unloadFrom = { x: BALL.x, y: BALL.y, z: BALL.z };
  /** @type {Set<number>} */
  const blocked = new Set();
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  const at = (x, z, y = 0.7) => ({ x, y, z });
  const onPedal = (c) => Math.hypot(c.x - PEDAL.x, c.z - PEDAL.z) <= PEDAL.r;
  const atWindow = (c) => reach(c, BLOW_SPOT.x, BLOW_SPOT.z) < 1;
  const nearBall = (c) => S.stage === 'ready' && !ball.holder && reach(c, TRAY.x, TRAY.z) < TRAY.pickupR;
  /** Ponto da locomotiva a `d` m à frente da cara dela (a cara olha para trás do movimento). */
  const ahead = (d) => ({ x: train.x + Math.sin(train.yaw) * d, z: train.z + Math.cos(train.yaw) * d });
  /** @param {Stage} stage */
  function setStage(stage) {
    if (S.stage === stage) return;
    S.stage = stage;
    onStageChange(stage);
  }
  /** Coloca a composição na distância atual da viagem (parada: no início do tronco) e a bolinha no vagão. */
  function drawTrain(withCargo = true, tip = 0) {
    const c = TR.consist(S.tripRoute || 'loop', S.distance);
    Object.assign(train, { x: c.x, z: c.z, yaw: c.yaw });
    Object.assign(wagon, c.wagon);
    camPoint.x = (c.x + c.wagon.x) / 2;
    camPoint.z = (c.z + c.wagon.z) / 2;
    props.train.setPose({ x: c.x, z: c.z, yaw: c.yaw, wagon: c.wagon, tip });
    if (withCargo && !ball.holder) props.ball.object.position.set(wagon.x, TRAIN.cargoY, wagon.z);
  }
  function enableAfterClear() {
    if (S.stage !== 'waiting' || S.armed) return;
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
      if (S.disposed || !S.armed || S.stage !== 'waiting' || blocked.has(cloud.id)) return;
      // scent já marcou esta nuvem: rejeição é definitiva, sem editar smelled.
      if (cloud.z < NOSE.frontZ || Math.abs(cloud.x - NOSE.x) > NOSE.halfWidth) {
        hints.now('front');
        return;
      }
      S.tripRoute = S.route;
      S.armed = false;
      nose.enabled = false;
      S.timer = S.distance = S.speed = 0;
      S.burst = false;
      S.nextChuff = TRAIN.chuffEvery * 0.5;
      S.trips++;
      setStage('sneezing');
      // "ah... ah...": o nariz sente o cheiro; o "atchim" vem em TRAIN.burstAt
      emit('expresso:sneeze', { route: S.tripRoute, x: NOSE.x, z: NOSE.z });
    },
  });

  /** @param {import('../../types').DogName} activeName */
  function objective(activeName) {
    const O = TEXT.objective;
    if (S.stage === 'done') return { text: null, target: null, stage: S.stage };
    if (S.stage === 'carrying') return { text: O.carrying, target: at(GOAL.x, GOAL.z), stage: S.stage };
    if (S.stage === 'ready') return { text: O.pickup, target: at(TRAY.x, TRAY.z, 0.45), stage: S.stage };
    if (S.stage !== 'waiting') return { text: O.moving, target: at(train.x, train.z, 1.05), stage: S.stage };
    if (!S.armed) return { text: O.airing, target: at(NOSE.x, NOSE.z), stage: S.stage };
    if (S.route === 'loop') return { text: activeName === 'rhaenyra' ? O.pedal : O.switchJump, target: at(PEDAL.x, PEDAL.z, 0.35), stage: S.stage };
    return { text: activeName === 'radhija' ? O.blow : O.switchBlow, target: at(NOSE.x, NOSE.z, 0.8), stage: S.stage };
  }
  /** Avança a viagem: tranco do espirro, aceleração até a velocidade de cruzeiro e freada perto do fim. */
  function stepTrip(dt) {
    const length = S.tripRoute === 'loop' ? LOOP_LENGTH : DELIVERY_LENGTH;
    const remaining = Math.max(0, length - S.distance);
    const brakeLimit = Math.max(TRAIN.minSpeed, Math.sqrt(2 * TRAIN.brake * remaining));
    S.speed = Math.min(TRAIN.speed, S.speed + TRAIN.accel * dt, brakeLimit);
    S.distance = Math.min(length, S.distance + S.speed * dt);
    drawTrain();
    // baforadas da chaminé no ritmo do trem (som e vapor no feedback)
    while (S.distance >= S.nextChuff && S.distance < length) {
      S.nextChuff += TRAIN.chuffEvery;
      const ch = ahead(TRAIN.chimney.z);
      emit('expresso:chuff', { x: ch.x, y: TRAIN.chimney.y, z: ch.z, speed: S.speed });
    }
    return S.distance >= length;
  }
  function arrive() {
    S.speed = 0;
    if (S.tripRoute === 'loop') {
      // circuito fechado: chegou de novo à estação, alinhado; sem girar no lugar
      S.distance = 0;
      S.tripRoute = null;
      drawTrain();
      setStage('waiting');
      hints.now('returned');
      emit('expresso:return', { x: train.x, z: train.z });
      return;
    }
    S.unloading = true;
    S.timer = 0;
    Object.assign(unloadFrom, { x: wagon.x, y: TRAIN.cargoY, z: wagon.z });
    emit('expresso:unload', { x: CHUTE.x, z: CHUTE.z0 });
  }
  /** Caçamba basculando e a bolinha rolando: borda do vagão → canaleta → bandeja. */
  function stepUnload(dt) {
    S.timer += dt;
    const k = Math.min(1, S.timer / TRAIN.unloadTime);
    const tip = k < 0.3 ? smooth(k / 0.3) : k < 0.62 ? 1 : 1 - smooth((k - 0.62) / 0.3);
    drawTrain(false, tip);
    // direção de avanço no fim da entrega (para a canaleta)
    const dx = -Math.sin(wagon.yaw), dz = -Math.cos(wagon.yaw);
    const r = BALL.r;
    const lip = { x: unloadFrom.x + dx * 0.25, y: unloadFrom.y + 0.05, z: unloadFrom.z + dz * 0.25 };
    const top = { x: CHUTE.x, y: CHUTE.y0 + r, z: CHUTE.z0 };
    const bottom = { x: CHUTE.x, y: CHUTE.y1 + r, z: CHUTE.z1 };
    const o = props.ball.object;
    const before = o.position.clone();
    /** @param {{x:number,y:number,z:number}} a @param {{x:number,y:number,z:number}} b @param {number} u @param {number} [hop] */
    const lerp = (a, b, u, hop = 0) => o.position.set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u + Math.sin(Math.PI * u) * hop, a.z + (b.z - a.z) * u);
    if (k < 0.08) o.position.set(unloadFrom.x, unloadFrom.y, unloadFrom.z);
    else if (k < 0.3) lerp(unloadFrom, lip, smooth((k - 0.08) / 0.22));
    else if (k < 0.42) lerp(lip, top, (k - 0.3) / 0.12, 0.05);
    else if (k < 0.8) { const u = (k - 0.42) / 0.38; lerp(top, bottom, u * u * 0.6 + u * 0.4); }
    else if (k < 0.95) lerp(bottom, { x: TRAY.x, y: TRAY.y, z: TRAY.z }, (k - 0.8) / 0.15, 0.035);
    else o.position.set(TRAY.x, TRAY.y, TRAY.z);
    // rola de verdade: gira pela distância percorrida em torno do eixo lateral
    const moved = o.position.distanceTo(before);
    if (moved > 0) o.rotation.x += moved / r;
    if (k === 1) finishDelivery();
  }
  function finishDelivery() {
    S.unloading = false;
    drawTrain(false, 0);
    props.ball.object.position.set(TRAY.x, TRAY.y, TRAY.z);
    props.ball.setHighlight(true);
    setStage('ready');
    hints.now('ready');
    emit('expresso:delivery', { x: TRAY.x, z: TRAY.z });
    cam.focusShot(TRAY.x, TRAY.z, { hold: 1 });
  }
  function update(dt, { active, ctrls }) {
    if (S.disposed) return null;
    hints.frame(dt);
    const existing = new Set(scent.clouds.map((c) => c.id));
    for (const id of blocked) if (!existing.has(id)) blocked.delete(id);
    const rh = ctrls.rhaenyra;
    if (rh.landed && onPedal(rh)) {
      S.pedalT = PEDAL.pulseTime;
      if (S.stage === 'waiting') {
        S.route = S.route === 'loop' ? 'delivery' : 'loop';
        S.routeChanges++;
        props.junction.setRoute(S.route);
        hints.now(S.route, 3.2, 0);
        emit('expresso:route', { route: S.route, x: PEDAL.x, z: PEDAL.z, signX: SWITCH_SIGN.x, signZ: SWITCH_SIGN.z });
        // É também um impacto real numa placa; reutiliza seu som/partícula.
        emit('plate:press', { id: 'expresso-pedal', by: 'rhaenyra', x: PEDAL.x, z: PEDAL.z });
        // plano curto na placa da agulha: a seta virando mostra o efeito do pulo
        cam.focusShot(SWITCH_SIGN.x, SWITCH_SIGN.z, { hold: 0.6, inT: 0.45, outT: 0.55, scale: 0.95, y: 0.7 });
        onStageChange(S.stage);
      } else if (!['ready', 'carrying', 'done'].includes(S.stage)) hints.now('busy');
    }
    S.pedalT = Math.max(0, S.pedalT - dt);
    const standing = Object.values(ctrls).some((c) => !(c.jumpT > 0) && onPedal(c));
    props.pedal.setPress(S.pedalT > 0 ? Math.sin((S.pedalT / PEDAL.pulseTime) * Math.PI / 2) : standing ? 0.12 : 0);
    if (S.stage === 'waiting' && S.route === 'loop' && standing && !(rh.jumpT > 0) && S.pedalT === 0) hints.cond('jump');
    if (S.stage === 'sneezing') {
      S.timer += dt;
      props.nose.setSneeze(Math.min(1, S.timer / TRAIN.sneezeTime));
      if (!S.burst && S.timer >= TRAIN.burstAt) {
        // ATCHIM: o espirro empurra o trem de ré (é a partida)
        S.burst = true;
        S.speed = TRAIN.kick;
        const n = ahead(TRAIN.noseZ);
        hints.now('sneeze', 2, 0);
        emit('expresso:atchim', { route: S.tripRoute, x: n.x, y: TRAIN.noseY, z: n.z, dirX: Math.sin(train.yaw), dirZ: Math.cos(train.yaw) });
        cam.focusShot(camPoint.x, camPoint.z, { target: camPoint, hold: 2.2, scale: 1.12 });
      }
      if (S.burst) stepTrip(dt);
      if (S.timer >= TRAIN.sneezeTime) {
        props.nose.setSneeze(0);
        S.timer = 0;
        setStage(S.tripRoute === 'loop' ? 'movingLoop' : 'movingDelivery');
      }
    } else if (S.stage === 'movingLoop' || S.stage === 'movingDelivery' || S.stage === 'returning') {
      if (S.unloading) stepUnload(dt);
      else if (stepTrip(dt)) arrive();
      else if (S.stage === 'movingLoop' && S.distance >= RETURN_FROM) setStage('returning');
    }
    enableAfterClear();
    hints.setPrompt(nearBall(active) ? 'ball' : null);
    cols.update(active);
    props.ball.setHighlight(S.stage === 'ready');
    props.goal.setHighlight(S.stage === 'carrying');
    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) { S.objKey = key; onStageChange(S.stage); }
    if (S.stage === 'carrying' && deliveredAt(GOAL, ctrls[ball.holder], active)) {
      setStage('done');
      return 'delivered';
    }
    return null;
  }
  function interact(c) {
    if (nearBall(c)) {
      ball.attach(c.name);
      props.ball.setHighlight(false);
      setStage('carrying');
      emit('item:pickup', { name: c.name, item: 'ball', x: c.x, z: c.z });
      return true;
    }
    if (onPedal(c)) { hints.now('jump'); return true; }
    if (atWindow(c)) { hints.now('nose'); return true; }
    if (reach(c, TRAY.x, TRAY.z) < 0.85 && !['ready', 'carrying', 'done'].includes(S.stage)) { hints.now('early'); return true; }
    return false;
  }
  function reset() {
    ball.returnHome();
    props.reset();
    hints.reset();
    cols.reset();
    scent.reset();
    blocked.clear();
    Object.assign(S, { stage: 'waiting', route: 'loop', tripRoute: null, timer: 0, distance: 0, speed: 0, burst: false,
      nextChuff: 0, armed: true, pedalT: 0, trips: 0, routeChanges: 0, unloading: false, disposed: false, objKey: '' });
    nose.enabled = true;
    props.junction.setRoute('loop');
    props.nose.setSneeze(0);
    props.pedal.setPress(0);
    props.ball.setHighlight(false);
    props.goal.setHighlight(false);
    drawTrain();
  }
  /** @param {string} stage @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(stage, { who } = {}) {
    if (!STAGES.includes(/** @type {Stage} */ (stage))) return null;
    reset();
    if (stage === 'waiting') return who || 'rhaenyra';
    S.route = stage === 'movingLoop' || stage === 'returning' ? 'loop' : 'delivery';
    S.tripRoute = S.route;
    S.armed = false;
    nose.enabled = false;
    props.junction.setRoute(S.route);
    S.stage = /** @type {Stage} */ (stage);
    if (stage === 'returning') { S.distance = RETURN_FROM; S.speed = TRAIN.speed; }
    S.nextChuff = S.distance + TRAIN.chuffEvery * 0.5;
    if (['ready', 'carrying', 'done'].includes(stage)) {
      S.distance = DELIVERY_LENGTH;
      drawTrain(false);
      props.ball.object.position.set(TRAY.x, TRAY.y, TRAY.z);
      props.ball.setHighlight(stage === 'ready');
      if (stage === 'carrying' || stage === 'done') {
        const carrier = who || 'radhija';
        place(carrier, stage === 'done' ? GOAL.x : TRAY.x, stage === 'done' ? GOAL.z : TRAY.z + 0.4);
        ball.attach(carrier);
      }
    } else drawTrain();
    return who || 'radhija';
  }
  return {
    S: hints.S, TEXT, stages: STAGES, objective, update, interact, reset, jumpToStage,
    lockFor: () => null, navFlags: () => ({}),
    lookTarget: (c) => nearBall(c) ? at(TRAY.x, TRAY.z, TRAY.y) : atWindow(c) ? at(NOSE.x, NOSE.z, 0.65) : null,
    onBark: (c) => { if (atWindow(c)) hints.now('nose'); else if (onPedal(c)) hints.now('jump'); },
    setPrompt: (kind) => hints.setPrompt(kind),
    dispose() { S.disposed = true; S.armed = false; nose.enabled = false; blocked.clear(); },
    info: () => ({ expresso: { state: S.stage, route: S.route, tripRoute: S.tripRoute, armed: S.armed,
      blockedCloudIds: [...blocked], blockedCloudIdsCount: blocked.size, train: { ...train }, wagon: { ...wagon },
      distance: S.distance, speed: S.speed, trips: S.trips, routeChanges: S.routeChanges, unloading: S.unloading },
      ball: { holder: ball.holder, x: props.ball.object.position.x, z: props.ball.object.position.z },
      objective: objective(ctx.activeDog).text }),
    get stage() { return S.stage; }, get carrier() { return ball.holder; },
    get collected() { return cols.count; }, get total() { return cols.total; },
    set onStageChange(fn) { onStageChange = fn; },
  };
}
