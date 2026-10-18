// A catraca reage ao pouso; o nariz reage à nuvem real. Tudo avança por dt.
import { createCarryItem, createCollectibles, createHints, deliveredAt, reach } from '../../game/puzzleKit.js';
import { PEDAL, JUNCTION, TRAIN, NOSE, BLOW_SPOT, TRAY, BALL, ROUTES, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R } from './layout.js';

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

/** @param {import('../../types').PuzzleContext<import('../../types').Fase6Props>} ctx @returns {import('../../types').Puzzle} */
export function createPuzzle(ctx) {
  const { props, dogs, root, emit, scent, cam, place } = ctx;
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const ball = createCarryItem({ obj: props.ball.object, dogs, scene: root, name: 'ball' });
  /** @type {{ stage: Stage, route: import('../../types').Fase6Route, tripRoute: import('../../types').Fase6Route | null,
   * timer: number, distance: number, armed: boolean, pedalT: number, trips: number, routeChanges: number,
   * unloading: boolean, disposed: boolean, objKey: string }} */
  const S = { stage: 'waiting', route: 'loop', tripRoute: null, timer: 0, distance: 0, armed: true,
    pedalT: 0, trips: 0, routeChanges: 0, unloading: false, disposed: false, objKey: '' };
  const train = { ...TRAIN.start };
  const unloadFrom = { x: BALL.x, y: BALL.y, z: BALL.z };
  /** @type {Set<number>} */
  const blocked = new Set();
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  const at = (x, z, y = 0.7) => ({ x, y, z });
  const onPedal = (c) => Math.hypot(c.x - PEDAL.x, c.z - PEDAL.z) <= PEDAL.r;
  const atWindow = (c) => reach(c, BLOW_SPOT.x, BLOW_SPOT.z) < 1;
  const nearBall = (c) => S.stage === 'ready' && !ball.holder && reach(c, TRAY.x, TRAY.z) < TRAY.pickupR;
  /** @param {Stage} stage */
  function setStage(stage) {
    if (S.stage === stage) return;
    S.stage = stage;
    onStageChange(stage);
  }
  function cargoPosition() {
    return { x: train.x - Math.sin(train.yaw) * TRAIN.cargoOffset,
      y: TRAIN.cargoY, z: train.z - Math.cos(train.yaw) * TRAIN.cargoOffset };
  }
  function drawTrain(withCargo = true) {
    props.train.setPose(train);
    if (withCargo && !ball.holder) {
      const p = cargoPosition();
      props.ball.object.position.set(p.x, p.y, p.z);
    }
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
      S.timer = S.distance = 0;
      S.trips++;
      setStage('sneezing');
      hints.now('sneeze', 2, 0);
      emit('expresso:sneeze', { route: S.tripRoute, x: NOSE.x, z: NOSE.z });
      cam.focusShot(JUNCTION.x, JUNCTION.z, { hold: 1.3, scale: 1.1 });
    },
  });

  /** @param {import('../../types').DogName} activeName */
  function objective(activeName) {
    const O = TEXT.objective;
    if (S.stage === 'done') return { text: null, target: null, stage: S.stage };
    if (S.stage === 'carrying') return { text: O.carrying, target: at(GOAL.x, GOAL.z), stage: S.stage };
    if (S.stage === 'ready') return { text: O.pickup, target: at(TRAY.x, TRAY.z, 0.45), stage: S.stage };
    if (S.stage !== 'waiting') return { text: O.moving, target: at(train.x, train.z, 0.9), stage: S.stage };
    if (!S.armed) return { text: O.airing, target: at(NOSE.x, NOSE.z), stage: S.stage };
    if (S.route === 'loop') return { text: activeName === 'rhaenyra' ? O.pedal : O.switchJump, target: at(PEDAL.x, PEDAL.z, 0.35), stage: S.stage };
    return { text: activeName === 'radhija' ? O.blow : O.switchBlow, target: at(NOSE.x, NOSE.z, 0.8), stage: S.stage };
  }
  function stepTrain(dt) {
    const path = ROUTES[S.tripRoute];
    S.distance += TRAIN.speed * dt;
    let remaining = S.distance;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const dx = b.x - a.x, dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (remaining <= length || i === path.length - 1) {
        const k = Math.min(1, remaining / length);
        train.x = a.x + dx * k;
        train.z = a.z + dz * k;
        train.yaw = Math.atan2(-dx, -dz); // a locomotiva anda de ré, vagão na frente
        drawTrain();
        return i === path.length - 1 && remaining >= length;
      }
      remaining -= length;
    }
    return true;
  }
  function finishDelivery() {
    S.unloading = false;
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
        emit('expresso:route', { route: S.route, x: PEDAL.x, z: PEDAL.z });
        // É também um impacto real numa placa; reutiliza seu som/partícula.
        emit('plate:press', { id: 'expresso-pedal', by: 'rhaenyra', x: PEDAL.x, z: PEDAL.z });
        onStageChange(S.stage);
      } else if (!['ready', 'carrying', 'done'].includes(S.stage)) hints.now('busy');
    }
    S.pedalT = Math.max(0, S.pedalT - dt);
    const standing = Object.values(ctrls).some((c) => !(c.jumpT > 0) && onPedal(c));
    props.pedal.setPress(S.pedalT > 0 ? Math.sin((S.pedalT / PEDAL.pulseTime) * Math.PI / 2) : standing ? 0.12 : 0);
    if (S.stage === 'waiting' && S.route === 'loop' && standing && !(rh.jumpT > 0) && S.pedalT === 0) hints.cond('jump');
    if (S.stage === 'sneezing') {
      S.timer += dt;
      props.nose.setSneeze(Math.sin(Math.min(1, S.timer / TRAIN.sneezeTime) * Math.PI));
      if (S.timer >= TRAIN.sneezeTime) {
        props.nose.setSneeze(0);
        S.timer = 0;
        setStage(S.tripRoute === 'loop' ? 'movingLoop' : 'movingDelivery');
      }
    } else if (S.stage === 'movingLoop' || S.stage === 'movingDelivery') {
      if (S.unloading) {
        S.timer += dt;
        const k = Math.min(1, S.timer / TRAIN.unloadTime);
        props.ball.object.position.set(unloadFrom.x + (TRAY.x - unloadFrom.x) * k,
          unloadFrom.y + (TRAY.y - unloadFrom.y) * k + Math.sin(Math.PI * k) * 0.08,
          unloadFrom.z + (TRAY.z - unloadFrom.z) * k);
        if (k === 1) finishDelivery();
      } else if (stepTrain(dt)) {
        S.timer = 0;
        if (S.tripRoute === 'loop') setStage('returning');
        else { S.unloading = true; Object.assign(unloadFrom, cargoPosition()); }
      }
    } else if (S.stage === 'returning') {
      S.timer += dt;
      train.yaw = -Math.PI / 2 * (1 - Math.min(1, S.timer / TRAIN.returnTime));
      drawTrain();
      if (S.timer >= TRAIN.returnTime) {
        Object.assign(train, TRAIN.start);
        drawTrain();
        S.tripRoute = null;
        setStage('waiting');
        hints.now('returned');
        emit('expresso:return', { x: train.x, z: train.z });
      }
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
    Object.assign(S, { stage: 'waiting', route: 'loop', tripRoute: null, timer: 0, distance: 0,
      armed: true, pedalT: 0, trips: 0, routeChanges: 0, unloading: false, disposed: false, objKey: '' });
    Object.assign(train, TRAIN.start);
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
    if (stage === 'returning') train.yaw = -Math.PI / 2;
    if (['ready', 'carrying', 'done'].includes(stage)) {
      const end = ROUTES.delivery.at(-1);
      Object.assign(train, { x: end.x, z: end.z, yaw: Math.PI });
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
      blockedCloudIds: [...blocked], blockedCloudIdsCount: blocked.size, train: { ...train },
      trips: S.trips, routeChanges: S.routeChanges, unloading: S.unloading },
      ball: { holder: ball.holder, x: props.ball.object.position.x, z: props.ball.object.position.z },
      objective: objective(ctx.activeDog).text }),
    get stage() { return S.stage; }, get carrier() { return ball.holder; },
    get collected() { return cols.count; }, get total() { return cols.total; },
    set onStageChange(fn) { onStageChange = fn; },
  };
}
