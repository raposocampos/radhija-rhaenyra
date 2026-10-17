// FASE 4 · Operação Patinho — puzzle (ver o cabeçalho de ./layout.js).
// Cadeia: superbafo no pombo da passagem → vão das floreiras livre → ventilador alinhado → vento no
// corredor → duto → cheiro no poleiro A → pombo voa para o B → placa → portão abre e trava → patinho → casa.
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt } from '../../game/puzzleKit.js';
import { createPushCrate, createHingedGate } from '../../game/mechanics/index.js';

export const STAGES = ['start', 'passOpen', 'gateOpen', 'carrying', 'done'];
const FLY_TIME = 1.3; // s do voo do pombo entre os poleiros

export const TEXT = {
  objective: {
    napRad: 'Acorde o pombo da passagem com um superbafo (segure R e solte)',
    napRh: 'Só a Radhija tem o superbafo: troque para ela (Q)',
    fanRh: 'Empurre o ventilador pelo trilho até a marca amarela (segure Shift)',
    fanRad: 'O ventilador é pesado: troque para a Rhaenyra (Q)',
    corridor: 'Passe por baixo dos canos e entre no corredor com a Radhija',
    blow: 'Solte o superbafo no vento (segure R e solte)',
    radNow: 'Agora a Radhija (Q): só ela passa por baixo dos canos',
    duck: 'O portão abriu! Pegue o patinho na bacia (E)',
    carrying: 'Leve o patinho para o capacho da escada',
  },
  hint: {
    napBlock: 'Um pombo cochila bem no meio da passagem…',
    napBark: 'O pombo nem liga para latido. Mas para um bafo…',
    napGone: 'Ninguém resiste ao superbafo da Radhija!',
    heavy: 'Pesado demais para a Radhija. Chame a Rhaenyra (Q)!',
    shift: 'Segure Shift para empurrar',
    aligned: 'Encaixou! O ventilador sopra direto na grade do corredor.',
    narrow: 'A Rhaenyra não passa por baixo dos canos… a Radhija sim! (Q)',
    noWind: 'Sem vento, o cheiro não vai longe…',
    duct: 'O vento levou o cheiro pelo duto!',
    flee: 'Que cheirinho! O pombo voou para o outro poleiro…',
    opened: '…e pousou na placa: o portão abriu!',
    gateBark: 'O pombo do portão está alto demais. Talvez o duto ajude…',
  },
  prompt: { duck: 'Pegar o patinho' },
};

/** @import { PuzzleContext, Puzzle } from '../../types' */

/**
 * @param {PuzzleContext} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props = {}, world, scent, dogs, emit, cam, root, place } = ctx;
  const { FAN, CORRIDOR, DUCT, PERCH_A, PERCH_B, DUCK, GOAL, GATE, NAP_PIGEON, PLANTERS, PASS, COLLECTIBLES, COLLECTIBLE_PICKUP_R } = layout;
  const gateMid = { x: GATE.hinge.x, z: (GATE.hinge.z + GATE.latchPost.z) / 2 };

  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const duck = createCarryItem({ obj: props.duck?.object || null, dogs, scene: root, name: 'duck' });
  const fan = createPushCrate({ id: 'ventilador', cfg: FAN, world, emit, prop: props.fan });
  const gate = createHingedGate({ id: 'gate', cfg: GATE, world, prop: props.gate });

  const S = { stage: 'start', objKey: '', nap: 'asleep', napT: 0, aligned: false, pigeon: 'A', flyT: 0, lingerT: 0, ductHint: false };

  // ---------- beat 1: o pombo cochilando no vão das floreiras ----------
  const napBlock = world.addDynamic({
    id: 'pombo-passagem', kind: 'npc', shape: 'box',
    x: PLANTERS.x, z: (PASS.z0 + PASS.z1) / 2, hx: PLANTERS.half, hz: (PASS.z1 - PASS.z0) / 2,
  });
  const napNose = scent.addNose({
    id: 'pombo-passagem', x: NAP_PIGEON.x, z: NAP_PIGEON.z, r: NAP_PIGEON.smellR,
    onSmell: () => {
      if (S.nap !== 'asleep') return;
      S.nap = 'flying';
      S.napT = 0;
      napNose.enabled = false;
      napBlock.enabled = false;
      emit('pigeon:flee', { x: NAP_PIGEON.x, z: NAP_PIGEON.z, y: 0.25, id: 'passagem' });
      hints.now('napGone', 3.2, 4);
      cam?.focusShot(NAP_PIGEON.x - 0.4, NAP_PIGEON.z - 1.2, { hold: 1.2 });
      setStage('passOpen');
    },
  });
  function updateNap(dt) {
    if (S.nap !== 'flying') return;
    S.napT = Math.min(1, S.napT + dt / NAP_PIGEON.flyTime);
    const k = S.napT;
    const e = k * k * (3 - 2 * k);
    const T = NAP_PIGEON.flyTo;
    props.napPigeon?.setPose?.({
      x: NAP_PIGEON.x + (T.x - NAP_PIGEON.x) * e,
      y: (T.y - 0) * e + Math.sin(Math.PI * k) * 0.7,
      z: NAP_PIGEON.z + (T.z - NAP_PIGEON.z) * e,
      yaw: Math.atan2(T.x - NAP_PIGEON.x, T.z - NAP_PIGEON.z),
      flying: k < 1, flightProgress: k, asleep: false,
    });
    if (k >= 1) napLanded();
  }
  function napLanded({ silent = false } = {}) {
    S.nap = 'roof';
    const T = NAP_PIGEON.flyTo;
    props.napPigeon?.setPose?.({ x: T.x, y: T.y, z: T.z, yaw: 0.3, flying: false, asleep: false });
    if (!silent) emit('pigeon:land', { x: T.x, z: T.z, id: 'passagem' });
  }

  // ---------- beat 2: vento do ventilador, duto e o nariz do pombo do portão ----------
  const wind = scent.addWind({ id: 'ventilador', x: FAN.start.x + FAN.wind.offset, z: FAN.start.z, dirX: 1, dirZ: 0, ...FAN.wind });
  scent.addDuct({ id: 'duto', inlet: DUCT.inlet, outlet: DUCT.outlet, travel: DUCT.travel, active: () => S.aligned });
  const nose = scent.addNose({
    id: 'pombo', x: PERCH_A.x, z: PERCH_A.z, r: PERCH_A.smellR,
    onSmell: () => {
      if (S.pigeon !== 'A') return;
      S.pigeon = 'flying';
      S.flyT = 0;
      nose.enabled = false;
      emit('pigeon:flee', { x: PERCH_A.x, z: PERCH_A.z, id: 'portao' });
      hints.now('flee', 3.4, 4);
      cam?.focusShot((PERCH_A.x + PERCH_B.x) / 2, (PERCH_A.z + PERCH_B.z) / 2, { hold: 1.6 });
    },
  });

  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  function setStage(st) {
    if (S.stage === st) return;
    S.stage = st;
    S.objKey = '';
    onStageChange(st);
  }

  const inCorridor = (c) => c.x > CORRIDOR.x0 && c.x < CORRIDOR.x1 && Math.abs(c.z - CORRIDOR.z) < CORRIDOR.half;
  const at = (x, z, y = 0.8) => ({ x, y, z });
  function objective(activeName) {
    const O = TEXT.objective;
    const C = ctx.ctrls;
    let text = null;
    let target = null;
    if (S.stage === 'start') {
      if (activeName === 'radhija') { text = O.napRad; target = at(NAP_PIGEON.x, NAP_PIGEON.z, 0.55); }
      else { text = O.napRh; target = at(C.radhija.x, C.radhija.z, 0.9); }
    } else if (S.stage === 'passOpen') {
      if (!S.aligned) {
        if (activeName === 'rhaenyra') { text = O.fanRh; target = at(fan.x, fan.z, 0.95); }
        else { text = O.fanRad; target = at(C.rhaenyra.x, C.rhaenyra.z, 1.0); }
      } else if (activeName === 'radhija') {
        if (inCorridor(C.radhija)) { text = O.blow; target = at(DUCT.inlet.x, DUCT.inlet.z, 0.6); }
        else { text = O.corridor; target = at((CORRIDOR.door.x0 + CORRIDOR.door.x1) / 2, CORRIDOR.z - CORRIDOR.half - 0.2, 0.6); }
      } else { text = O.radNow; target = at(C.radhija.x, C.radhija.z, 0.9); }
    } else if (S.stage === 'gateOpen') { text = O.duck; target = at(DUCK.x, DUCK.z, 0.6); }
    else if (S.stage === 'carrying') { text = O.carrying; target = at(GOAL.x, GOAL.z, 0.9); }
    return { text, target, stage: S.stage };
  }

  // ---------- ventilador no trilho (encaixe na marca) ----------
  function updateFan() {
    const near = Math.abs(fan.z - FAN.alignZ) < FAN.snap;
    if (!fan.pushing && near && !S.aligned) {
      fan.setPos(FAN.start.x, FAN.alignZ);
      S.aligned = true;
      props.fan?.setAligned?.(true);
      emit('fan:aligned', { x: fan.x, z: fan.z });
      hints.now('aligned', 3.2, 6);
      cam?.focusShot((fan.x + DUCT.inlet.x) / 2, CORRIDOR.z, { hold: 1.0 });
    } else if (S.aligned && Math.abs(fan.z - FAN.alignZ) > 0.01) {
      S.aligned = false;
      props.fan?.setAligned?.(false);
    }
    wind.x = fan.x + FAN.wind.offset;
    wind.z = fan.z;
  }

  // ---------- pombo do portão ----------
  function updatePigeon(dt) {
    if (S.pigeon !== 'flying') return;
    S.flyT = Math.min(1, S.flyT + dt / FLY_TIME);
    const k = S.flyT;
    const e = k * k * (3 - 2 * k);
    props.pigeon?.setPose?.({
      x: PERCH_A.x + (PERCH_B.x - PERCH_A.x) * e,
      y: PERCH_A.y + 0.02 + Math.sin(Math.PI * k) * 0.9,
      z: PERCH_A.z + (PERCH_B.z - PERCH_A.z) * e,
      yaw: Math.atan2(PERCH_B.x - PERCH_A.x, PERCH_B.z - PERCH_A.z),
      flying: k < 1, flightProgress: k,
    });
    if (k >= 1) landOnPlate();
  }
  function landOnPlate({ silent = false } = {}) {
    S.pigeon = 'B';
    props.pigeon?.setPose?.({ x: PERCH_B.x, y: PERCH_B.y + 0.02, z: PERCH_B.z, yaw: -Math.PI / 2, flying: false });
    props.plate?.setPress?.(1);
    gate.setTarget(1);
    gate.lock();
    if (!silent) {
      emit('pigeon:land', { x: PERCH_B.x, z: PERCH_B.z, id: 'portao' });
      emit('plate:press', { id: 'placa-poleiro', by: 'pombo', x: PERCH_B.x, z: PERCH_B.z });
      emit('gate:open', { x: gateMid.x + 0.5, z: gateMid.z });
      emit('gate:locked', { x: gateMid.x + 0.5, z: gateMid.z });
      emit('item:revealed', { item: 'duck', x: DUCK.x, z: DUCK.z });
      hints.now('opened', 3.4, 4);
      cam?.focusShot(gateMid.x + 0.3, gateMid.z, { hold: 1.2 });
    }
    setStage('gateOpen');
  }

  // ---------- patinho ----------
  const nearDuck = (c) => S.stage === 'gateOpen' && !duck.holder && reach(c, DUCK.x, DUCK.z) < DUCK.pickupR;
  function pickup(name) {
    const c = ctx.ctrls[name];
    duck.attach(name);
    props.basin?.setRipple?.(1);
    props.goal?.setHighlight?.(true);
    emit('item:pickup', { name, item: 'duck', x: c.x, z: c.z });
    setStage('carrying');
  }

  // ---------- quadro ----------
  function modifyIntent(dt, c, intent, { shift, comp }) {
    const r = fan.modifyIntent(dt, c, intent, { shift });
    if (r.contact === 'needShift') hints.cond('shift', 3.0, 9);
    if (r.contact === 'strain') hints.cond('heavy', 3.4, 9);
    fan.update(dt, { comp });
    S.fanUpdated = true;
    return r;
  }

  function update(dt, { active, comp, ctrls }) {
    hints.frame(dt);
    if (!S.fanUpdated) fan.update(dt, { comp });
    S.fanUpdated = false;
    updateFan();
    gate.update(dt, { ctrls });
    updateNap(dt);
    updatePigeon(dt);

    if (S.nap === 'asleep' && active.hits?.some((h) => h.id === 'pombo-passagem')) hints.cond('napBlock', 3.2, 10);
    if (active.size === 'large' && active.hits?.some((h) => h.id === 'canos-vao-grande')) hints.cond('narrow', 3.4, 10);
    // cheiro parado no corredor sem vento: dica
    const stuck = scent.clouds.some((c) => c.state === 'free' && inCorridor(c));
    S.lingerT = stuck && !S.aligned ? S.lingerT + dt : 0;
    if (S.lingerT > 1.2) hints.cond('noWind', 3.4, 10);
    if (!S.ductHint && scent.clouds.some((c) => c.state === 'duct')) { S.ductHint = true; hints.now('duct', 2.8, 4); }

    hints.setPrompt(nearDuck(active) ? 'duck' : null);
    cols.update(active);

    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) {
      const first = S.objKey === '';
      S.objKey = key;
      if (!first) onStageChange(S.stage);
    }
    if (S.stage === 'carrying' && deliveredAt(GOAL, ctrls[duck.holder], active)) {
      setStage('done');
      return 'delivered';
    }
    return null;
  }

  function interact(c) {
    if (nearDuck(c)) { pickup(c.name); return true; }
    return false;
  }

  function onBark(c) {
    if (S.nap === 'asleep' && Math.hypot(c.x - NAP_PIGEON.x, c.z - NAP_PIGEON.z) < 2.6) {
      emit('pigeon:shrug', { x: NAP_PIGEON.x, z: NAP_PIGEON.z });
      props.napPigeon?.peek?.();
      hints.now('napBark', 3.4, 5);
    } else if (S.pigeon === 'A' && Math.hypot(c.x - PERCH_A.x, c.z - PERCH_A.z) < 2.4) {
      emit('pigeon:shrug', { x: PERCH_A.x, z: PERCH_A.z });
      hints.now('gateBark', 3.4, 6);
    }
  }

  function resetNap() {
    S.nap = 'asleep';
    S.napT = 0;
    napNose.enabled = true;
    napBlock.enabled = true;
    props.napPigeon?.setPose?.({ x: NAP_PIGEON.x, y: 0, z: NAP_PIGEON.z, yaw: -0.4, flying: false, asleep: true });
  }

  function reset() {
    props.reset?.();
    hints.reset();
    cols.reset();
    fan.reset();
    gate.reset();
    duck.returnHome();
    nose.enabled = true;
    Object.assign(S, { stage: 'start', objKey: '', aligned: false, pigeon: 'A', flyT: 0, lingerT: 0, ductHint: false });
    resetNap();
    props.fan?.setPos?.(FAN.start.x, FAN.start.z);
    updateFan();
  }

  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    if (st !== 'start') {
      napNose.enabled = false;
      napBlock.enabled = false;
      napLanded({ silent: true });
      S.stage = 'passOpen';
      place('radhija', -1.9, 0.2, Math.PI / 2);
      place('rhaenyra', -2.0, -0.6, Math.PI / 2);
    }
    if (st === 'gateOpen' || st === 'carrying') {
      fan.setPos(FAN.start.x, FAN.alignZ);
      updateFan();
      nose.enabled = false;
      gate.set(1);
      landOnPlate({ silent: true });
      place('radhija', 3.2, 0.3, Math.PI / 2);
      place('rhaenyra', 1.6, -0.3, Math.PI / 2);
    }
    if (st === 'carrying') {
      place('radhija', DUCK.x - 0.62, DUCK.z - 0.1, Math.PI / 2);
      pickup('radhija');
    }
    S.objKey = '';
    return who || 'radhija';
  }

  return {
    S: hints.S, TEXT, stages: STAGES,
    objective, update, interact, reset, jumpToStage, modifyIntent, onBark,
    lockFor: () => null,
    lookTarget: (c) => {
      if (nearDuck(c)) return { x: DUCK.x, y: 0.12, z: DUCK.z };
      if (S.nap === 'asleep' && Math.hypot(c.x - NAP_PIGEON.x, c.z - NAP_PIGEON.z) < 1.6) return { x: NAP_PIGEON.x, y: 0.12, z: NAP_PIGEON.z };
      return null;
    },
    navFlags: () => ({ passOpen: S.nap !== 'asleep', gateOpen: gate.isOpen(0.9) }),
    setPrompt: (kind) => hints.setPrompt(kind),
    endActions: () => fan.endPush(),
    info: () => ({
      nap: S.nap,
      fan: { ...fan.info(), aligned: S.aligned }, gate: gate.info(), pigeon: S.pigeon,
      duck: { holder: duck.holder }, objective: objective(ctx.activeDog).text,
    }),
    mech: { fan, gate, wind, nose, napNose, napBlock },
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return duck.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
