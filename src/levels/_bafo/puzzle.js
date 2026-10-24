// ARENA DO BAFO — puzzle "o pombo e o portão" (ver o cabeçalho de ./layout.js).
// Cadeia: ventilador alinhado → vento no corredor → duto → cheiro no poleiro A → pombo voa para o B →
// placa → portão abre e trava → cenoura → casa.
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt } from '../../game/puzzleKit.js';
import { createPushCrate, createHingedGate } from '../../game/mechanics/index.js';

export const STAGES = ['start', 'gateOpen', 'carrying', 'done'];
const FLY_TIME = 1.3; // s do voo do pombo entre os poleiros

export const TEXT = {
  objective: {
    fanRh: 'Empurre o ventilador pelo trilho até a marca amarela (segure Shift)',
    fanRad: 'O ventilador é pesado: troque para a Rhaenyra (Q)',
    corridor: 'Entre no corredor estreito com a Radhija',
    blow: 'Solte o superbafo no vento (segure R e solte)',
    radNow: 'Agora a Radhija (Q): só ela cabe no corredor',
    carrot: 'O portão abriu! Pegue a cenoura (E)',
    carrying: 'Leve a cenoura para casa',
  },
  hint: {
    heavy: 'Pesado demais para a Radhija. Chame a Rhaenyra (Q)!',
    shift: 'Segure Shift para empurrar',
    aligned: 'Encaixou! O ventilador sopra direto na grade do corredor.',
    narrow: 'A Rhaenyra não cabe no corredor… a Radhija sim! (Q)',
    noWind: 'Sem vento, o cheiro não vai longe…',
    duct: 'O vento levou o cheiro pelo duto!',
    flee: 'Que cheirinho! O pombo voou para o outro poleiro…',
    opened: '…e pousou na placa: o portão abriu!',
  },
  prompt: { carrot: 'Pegar a cenoura' },
};

/** @import { PuzzleContext, Puzzle, BafoProps } from '../../types' */

/**
 * @param {PuzzleContext<BafoProps>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props, world, scent, dogs, emit, cam, root, place } = ctx;
  const { FAN, CORRIDOR, DUCT, PERCH_A, PERCH_B, CARROT, GOAL, GATE, COLLECTIBLES, COLLECTIBLE_PICKUP_R } = layout;
  const gateMid = { x: GATE.hinge.x, z: (GATE.hinge.z + GATE.latchPost.z) / 2 };

  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const carrot = createCarryItem({ obj: props.carrot?.object || null, dogs, scene: root, name: 'carrot' });
  const fan = createPushCrate({ id: 'ventilador', cfg: FAN, world, emit, prop: props.fan });
  const gate = createHingedGate({ id: 'gate', cfg: GATE, world, prop: props.gate });

  // ---------- cheiro: vento do ventilador, duto e o nariz do pombo ----------
  const S = { stage: 'start', objKey: '', aligned: false, pigeon: 'A', flyT: 0, lingerT: 0, ductHint: false };
  const wind = scent.addWind({ id: 'ventilador', x: FAN.start.x + FAN.wind.offset, z: FAN.start.z, dirX: 1, dirZ: 0, ...FAN.wind });
  const duct = scent.addDuct({ id: 'duto', inlet: DUCT.inlet, outlet: DUCT.outlet, travel: DUCT.travel, active: () => S.aligned });
  // só o cheiro que veio pelo duto conta (como na fase 4): uma nuvem do chão perto do poleiro, não
  const nose = scent.addNose({
    id: 'pombo', x: PERCH_A.x, z: PERCH_A.z, r: PERCH_A.smellR,
    onSmell: (cloud) => {
      if (S.pigeon !== 'A' || /** @type {any} */ (cloud).duct !== duct) return;
      S.pigeon = 'flying';
      S.flyT = 0;
      nose.enabled = false;
      emit('pigeon:flee', { x: PERCH_A.x, z: PERCH_A.z });
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
      if (!S.aligned) {
        if (activeName === 'rhaenyra') { text = O.fanRh; target = at(fan.x, fan.z, 0.9); }
        else { text = O.fanRad; target = at(C.rhaenyra.x, C.rhaenyra.z, 1.0); }
      } else if (activeName === 'radhija') {
        if (inCorridor(C.radhija)) { text = O.blow; target = at(DUCT.inlet.x, DUCT.inlet.z, 0.6); }
        else { text = O.corridor; target = at((CORRIDOR.door.x0 + CORRIDOR.door.x1) / 2, CORRIDOR.z - CORRIDOR.half, 0.6); }
      } else { text = O.radNow; target = at(C.radhija.x, C.radhija.z, 0.9); }
    } else if (S.stage === 'gateOpen') { text = O.carrot; target = at(CARROT.x, CARROT.z, 0.6); }
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

  // ---------- pombo e portão ----------
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
      flying: k < 1,
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
      emit('pigeon:land', { x: PERCH_B.x, z: PERCH_B.z });
      emit('plate:press', { id: 'placa-poleiro', by: 'pombo', x: PERCH_B.x, z: PERCH_B.z });
      emit('gate:open', { x: gateMid.x + 0.5, z: gateMid.z });
      emit('gate:locked', { x: gateMid.x + 0.5, z: gateMid.z });
      emit('item:revealed', { item: 'carrot', x: CARROT.x, z: CARROT.z });
      hints.now('opened', 3.4, 4);
      cam?.focusShot(gateMid.x + 0.3, gateMid.z, { hold: 1.2 });
    }
    setStage('gateOpen');
  }

  // ---------- cenoura ----------
  const nearCarrot = (c) => S.stage === 'gateOpen' && !carrot.holder && reach(c, CARROT.x, CARROT.z) < CARROT.pickupR;
  function pickup(name) {
    const c = ctx.ctrls[name];
    carrot.attach(name);
    emit('item:pickup', { name, item: 'carrot', x: c.x, z: c.z });
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
    updatePigeon(dt);

    if (active.size === 'large' && active.hits?.some((h) => h.id === 'corredor-vao-grande')) hints.cond('narrow', 3.4, 10);
    // cheiro parado no corredor sem vento: dica
    const stuck = scent.clouds.some((c) => c.state === 'free' && inCorridor(c));
    S.lingerT = stuck && !S.aligned ? S.lingerT + dt : 0;
    if (S.lingerT > 1.2) hints.cond('noWind', 3.4, 10);
    if (!S.ductHint && scent.clouds.some((c) => c.state === 'duct')) { S.ductHint = true; hints.now('duct', 2.8, 4); }

    hints.setPrompt(nearCarrot(active) ? 'carrot' : null);
    cols.update(active);

    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) {
      const first = S.objKey === '';
      S.objKey = key;
      if (!first) onStageChange(S.stage);
    }
    if (S.stage === 'carrying' && deliveredAt(GOAL, ctrls[carrot.holder], active)) {
      setStage('done');
      return 'delivered';
    }
    return null;
  }

  function interact(c) {
    if (nearCarrot(c)) { pickup(c.name); return true; }
    return false;
  }

  function reset() {
    props.reset?.();
    hints.reset();
    cols.reset();
    fan.reset();
    gate.reset();
    carrot.returnHome();
    nose.enabled = true;
    Object.assign(S, { stage: 'start', objKey: '', aligned: false, pigeon: 'A', flyT: 0, lingerT: 0, ductHint: false });
    props.fan?.setPos?.(FAN.start.x, FAN.start.z);
    updateFan();
  }

  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    if (st === 'gateOpen' || st === 'carrying') {
      fan.setPos(FAN.start.x, FAN.alignZ);
      updateFan();
      nose.enabled = false;
      gate.set(1);
      landOnPlate({ silent: true });
      place('radhija', 2.1, 0.3, Math.PI / 2);
      place('rhaenyra', 0.3, -0.3, Math.PI / 2);
    }
    if (st === 'carrying') {
      place('radhija', CARROT.x - 0.5, CARROT.z, Math.PI / 2);
      pickup('radhija');
    }
    S.objKey = '';
    return who || 'radhija';
  }

  return {
    S: hints.S, TEXT, stages: STAGES,
    objective, update, interact, reset, jumpToStage, modifyIntent,
    lockFor: () => null,
    lookTarget: (c) => (nearCarrot(c) ? { x: CARROT.x, y: 0.08, z: CARROT.z } : null),
    navFlags: () => ({ gateOpen: gate.isOpen(0.9) }),
    setPrompt: (kind) => hints.setPrompt(kind),
    endActions: () => fan.endPush(),
    info: () => ({
      fan: { ...fan.info(), aligned: S.aligned }, gate: gate.info(), pigeon: S.pigeon,
      carrot: { holder: carrot.holder }, objective: objective(ctx.activeDog).text,
    }),
    mech: { fan, gate, wind, nose },
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return carrot.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
