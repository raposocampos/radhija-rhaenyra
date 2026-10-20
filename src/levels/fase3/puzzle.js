// FASE 3 · Operação Pantufa — puzzle (interface de puzzle: docs/ARQUITETURA.md §4.5).
// Beats (ver cabeçalho de ./layout.js):
//   1. Duas pedras de pressão AO MESMO TEMPO: a pesada (só a Rhaenyra) e a leve no cantinho (só a
//      Radhija cabe). Cada pedra acende uma lanterna; as duas → o portão de treliça abre e trava.
//   2. Dona Gansa guarda a ponte: chegar perto com a dog ATIVA → grasna e avança (knockback suave).
//      Um latido atrai a gansa (curiosa por um tempo, depois volta). A pantufa é pesada: só a Rhaenyra.
//   Pantufa → porta de vidro. E larga a pantufa no chão (E perto pega de volta); largada na porta, entrega.
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt, inZones, mouthPoint } from '../../game/puzzleKit.js';
import { createDogEffects, createPressurePlate, createHingedGate, createGooseNPC } from '../../game/mechanics/index.js';
import { createGoose } from '../../characters/goose.js';

export const STAGES = ['start', 'gateOpen', 'carrying', 'done'];

export const TEXT = {
  objective: {
    start: 'Descubra como abrir o portão de treliça',
    lanterns: 'Acenda as duas lanternas: as duas pedras ao mesmo tempo',
    hRh: 'Lanterna acesa! Agora troque para a Radhija (Q)',
    hAskStay: 'Peça para a Rhaenyra ficar na pedra (F)',
    hThenL: 'Agora a pedrinha do cantinho, com a Radhija',
    lRad: 'Lanterna acesa! Agora troque para a Rhaenyra (Q)',
    lAskStay: 'Peça para a Radhija ficar na pedrinha (F)',
    lThenH: 'Agora leve a Rhaenyra até a pedra grande',
    island: 'Chegue à ilha e pegue a pantufa',
    lureRad: 'Distraia a Dona Gansa com um latido (E)',
    lureRh: 'A Radhija pode distrair a gansa: troque (Q) e lata (E)',
    goRh: 'Ela foi ver! Troque para a Rhaenyra (Q) e corra para a ilha',
    goNow: 'Rápido! Atravesse a ponte e pegue a pantufa (E)',
    carrying: 'Leve a pantufa até a porta de vidro',
    pickAgain: 'Pegue a pantufa de volta (E)',
    pickAgainRad: 'A pantufa ficou no chão: só a Rhaenyra carrega (Q)',
  },
  hint: {
    lightH: 'Leve demais para a pedra grande… precisa da Rhaenyra!',
    nookBig: 'A Rhaenyra não cabe no cantinho… mas a Radhija cabe!',
    onePlate: 'Uma lanterna só não basta: as duas pedras precisam estar pressionadas juntas.',
    stayPlate: 'Use Fica (F) para a companheira esperar na pedra!',
    opened: 'As duas lanternas acesas! O portão abriu.',
    goose: 'A Dona Gansa não deixa ninguém passar! Que tal distraí-la com um latido (E)?',
    gooseRh: 'Opa! Melhor distrair a gansa primeiro…',
    lured: 'Ela foi ver o latido! Aproveite a janela!',
    back: 'A Dona Gansa está voltando para a ponte!',
    heavy: 'A pantufa é pesada demais para a Radhija!',
    got: 'Pantufa resgatada! Agora é só voltar para casa.',
  },
  prompt: { slipper: 'Pegar a pantufa', drop: 'Largar a pantufa' },
};

/** @import { PuzzleContext, Puzzle, Fase3Props } from '../../types' */

/**
 * @param {PuzzleContext<Fase3Props>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props, world, dogs, emit, cam, root, place } = ctx;
  const { GATE, LANTERNS, PLATE_H, PLATE_L, NOOK, SLIPPER, GOOSE, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R, HEDGE_AB, LURE_SPOT } = layout;
  const gateMid = { x: GATE.hinge.x, z: (GATE.hinge.z + GATE.latchPost.z) / 2 };

  const effects = createDogEffects({ world, dogs });
  const hints = createHints(emit, TEXT);
  const gate = createHingedGate({ id: 'gate', cfg: GATE, world, prop: props.gate });
  const plateH = createPressurePlate({ id: 'plateH', x: PLATE_H.x, z: PLATE_H.z, r: PLATE_H.r, requires: PLATE_H.requires, emit, prop: props.plateH, margin: 0.4 });
  const plateL = createPressurePlate({ id: 'plateL', x: PLATE_L.x, z: PLATE_L.z, r: PLATE_L.r, requires: PLATE_L.requires, emit, prop: props.plateL, margin: 0.4 });
  const goose = createGooseNPC({ cfg: GOOSE, world, nav: ctx.nav, root, emit, effects, createGoose });
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const slipper = createCarryItem({ obj: props.slipper?.object || null, dogs, scene: root, carrier: SLIPPER.carrier || 'large', name: 'slipper', emit, world });
  /** Largada, a pantufa não fica na porta de vidro (lá ela é entregue) nem nas pedras de pressão. */
  const dropAvoid = inZones([GOAL, PLATE_H, PLATE_L], 0.08);

  const S = {
    stage: 'start',
    lantH: 0, lantL: 0, litH: false, litL: false,
    metGoose: false, sawGate: false, oneT: 0,
    prevBy: { H: null, L: null },
    gooseState: 'patrol',
    objKey: '',
    luredShot: false,
    /** E com a pantufa na boca, de frente para a porta: entrega neste quadro (no update). */
    dropDeliver: false,
  };
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};

  function setStage(st, { silent = false } = {}) {
    if (S.stage === st) return;
    S.stage = st;
    S.objKey = '';
    if (!silent) onStageChange(st);
  }

  // ---------- objetivo ----------
  const tgt = (x, z, y = 0.8) => ({ x, y, z });
  function objective(activeName) {
    const O = TEXT.objective;
    const C = ctx.ctrls;
    const st = S.stage;
    let text = null;
    let target = null;
    if (st === 'start') {
      const hBy = plateH.pressed ? plateH.by : null;
      const lBy = plateL.pressed ? plateL.by : null;
      const stayRh = ctx.isStaying?.('rhaenyra');
      const stayRad = ctx.isStaying?.('radhija');
      if (hBy === 'rhaenyra' && activeName === 'rhaenyra' && !lBy) { text = O.hRh; target = tgt(C.radhija.x, C.radhija.z, 0.9); }
      else if (hBy === 'rhaenyra' && activeName === 'radhija' && !stayRh) { text = O.hAskStay; target = tgt(C.rhaenyra.x, C.rhaenyra.z, 1.0); }
      else if (hBy === 'rhaenyra' && activeName === 'radhija') { text = O.hThenL; target = tgt(PLATE_L.x, PLATE_L.z, 0.5); }
      else if (lBy === 'radhija' && activeName === 'radhija') { text = O.lRad; target = tgt(C.rhaenyra.x, C.rhaenyra.z, 1.0); }
      else if (lBy === 'radhija' && activeName === 'rhaenyra' && !stayRad) { text = O.lAskStay; target = tgt(C.radhija.x, C.radhija.z, 0.9); }
      else if (lBy === 'radhija' && activeName === 'rhaenyra') { text = O.lThenH; target = tgt(PLATE_H.x, PLATE_H.z, 0.5); }
      else if (S.sawGate) {
        text = O.lanterns;
        const p = activeName === 'radhija' ? PLATE_L : PLATE_H;
        target = tgt(p.x, p.z, 0.5);
      } else { text = O.start; target = tgt(gateMid.x, gateMid.z, 1.2); }
    } else if (st === 'gateOpen') {
      const away = goose.state === 'lured' || goose.state === 'curious' || goose.isAway();
      if (away) {
        if (activeName === 'rhaenyra') { text = O.goNow; target = tgt(SLIPPER.x, SLIPPER.z, 0.6); }
        else { text = O.goRh; target = tgt(C.rhaenyra.x, C.rhaenyra.z, 1.0); }
      } else if (S.metGoose) {
        if (activeName === 'radhija') { text = O.lureRad; target = tgt(goose.x, goose.z, 0.95); }
        else { text = O.lureRh; target = tgt(C.radhija.x, C.radhija.z, 0.9); }
      } else { text = O.island; target = tgt(SLIPPER.x, SLIPPER.z, 0.6); }
    } else if (st === 'carrying') {
      const f = !slipper.holder && slipper.floor;
      if (f) { text = activeName === 'rhaenyra' ? O.pickAgain : O.pickAgainRad; target = tgt(f.x, f.z, 0.55); }
      else { text = O.carrying; target = tgt(GOAL.x, GOAL.z, 0.9); }
    }
    return { text, target, stage: st };
  }

  // ---------- pedras + lanternas + portão ----------
  function lanternStep(id, cur, on, dt) {
    const target = on ? 1 : 0;
    const nv = cur + Math.sign(target - cur) * Math.min(Math.abs(target - cur), dt * (on ? 3.5 : 2.2));
    if (nv !== cur) props[id === 'H' ? 'lanternH' : 'lanternL']?.setOn?.(nv);
    return nv;
  }

  function updatePlates(dt, ctrls, active) {
    const h = plateH.update(dt, { ctrls });
    const l = plateL.update(dt, { ctrls });
    const locked = gate.locked;
    const litH = locked || h.pressed;
    const litL = locked || l.pressed;
    if (litH !== S.litH) {
      S.litH = litH;
      emit(litH ? 'lantern:on' : 'lantern:off', { id: 'H', x: LANTERNS.H.x, z: LANTERNS.H.z });
    }
    if (litL !== S.litL) {
      S.litL = litL;
      emit(litL ? 'lantern:on' : 'lantern:off', { id: 'L', x: LANTERNS.L.x, z: LANTERNS.L.z });
    }
    S.lantH = lanternStep('H', S.lantH, litH, dt);
    S.lantL = lanternStep('L', S.lantL, litL, dt);
    if (h.light && ctrls[h.light] === active) hints.cond('lightH', 3.4, 10);
    // A companheira saiu da pedra seguindo a líder → ensinar o Fica.
    for (const [k, plate] of /** @type {[string, typeof plateH][]} */ ([['H', plateH], ['L', plateL]])) {
      const was = S.prevBy[k];
      if (was && !plate.pressed && was !== active.name && !ctx.isStaying?.(was) && !locked) hints.now('stayPlate', 4.0, 8);
      S.prevBy[k] = plate.pressed ? plate.by : null;
    }
    if (!locked) {
      if (h.pressed !== l.pressed) {
        S.oneT += dt;
        if (S.oneT > 3.0) hints.cond('onePlate', 4.0, 14);
      } else S.oneT = 0;
      if (h.pressed && l.pressed) openGate();
    }
    gate.update(dt, { ctrls });
  }

  function openGate({ silent = false } = {}) {
    gate.lock();
    S.litH = true;
    S.litL = true;
    if (!silent) {
      emit('gate:open', { x: gateMid.x + 0.5, z: gateMid.z });
      emit('gate:locked', { x: gateMid.x + 0.5, z: gateMid.z });
      emit('item:revealed', { item: 'slipper', x: SLIPPER.x, z: SLIPPER.z });
      cam?.focusShot(gateMid.x + 0.3, gateMid.z, { hold: 1.5 });
      hints.now('opened', 3.0, 30);
    }
    props.slipper?.setHighlight?.(true);
    setStage('gateOpen', { silent });
  }

  // ---------- gansa ----------
  function onBark(c) {
    if (S.stage === 'start') return;
    const was = goose.state;
    if (goose.onBark(c) && was !== 'lured' && was !== 'curious') {
      hints.now('lured', 3.0, 6);
      if (!S.luredShot) {
        S.luredShot = true;
        cam?.focusShot((goose.x + c.x) / 2, (goose.z + c.z) / 2, { hold: 0.7, inT: 0.4, outT: 0.5 });
      }
    }
  }

  function updateGoose(dt, active, ctrls) {
    const before = goose.hits;
    goose.update(dt, { active, ctrls });
    if (goose.hits > before) {
      S.metGoose = true;
      hints.now(active.name === 'rhaenyra' && goose.lures > 0 ? 'gooseRh' : 'goose', 4.2, 6);
    }
    if (goose.state === 'alert') S.metGoose = true;
    if (goose.state === 'return' && S.gooseState !== 'return' && S.stage === 'gateOpen') hints.now('back', 2.8, 6);
    S.gooseState = goose.state;
  }

  // ---------- pantufa ----------
  function pickup(name) {
    const c = ctx.ctrls[name];
    const again = S.stage === 'carrying'; // pegando de volta do chão: sem a comemoração da primeira vez
    slipper.attach(name);
    props.slipper?.setHighlight?.(false);
    props.door?.setHighlight?.(true);
    emit('item:pickup', { name, item: 'slipper', x: c.x, z: c.z });
    if (!again) hints.now('got', 3.0, 30);
    setStage('carrying');
  }
  /** Na ilha, ainda no lugar dela; ou largada no chão depois (E perto pega de volta). */
  const nearSlipper = (c) => (S.stage === 'gateOpen' && !slipper.holder && reach(c, SLIPPER.x, SLIPPER.z) < SLIPPER.pickupR)
    || (S.stage === 'carrying' && !slipper.holder && slipper.nearFloor(c));

  /** E com a pantufa na boca: de frente para a porta, entrega; senão ela cai no chão à frente (E perto pega de volta). */
  function dropSlipper(c) {
    const m = mouthPoint(c);
    if (Math.hypot(m.x - GOAL.x, m.z - GOAL.z) < GOAL.r) {
      S.dropDeliver = true;
      return;
    }
    slipper.dropBy(c, { avoid: dropAvoid });
    props.slipper?.setHighlight?.(true);
    props.door?.setHighlight?.(false);
  }

  function interactable(c) {
    if (nearSlipper(c) && slipper.canCarry(c)) return 'slipper';
    if (S.stage === 'carrying' && slipper.holder === c.name) return 'drop';
    return null;
  }

  function interact(c) {
    const k = interactable(c);
    if (k === 'slipper') {
      pickup(c.name);
      return true;
    }
    if (k === 'drop') {
      dropSlipper(c);
      return true;
    }
    if (nearSlipper(c) && !slipper.canCarry(c)) {
      hints.now('heavy', 3.4, 3);
      return true;
    }
    return false;
  }

  function lockFor(name) {
    return effects.lockFor(name);
  }

  function lookTarget(c) {
    if (hints.promptKind === 'slipper' || nearSlipper(c)) {
      const f = slipper.floor;
      return f ? { x: f.x, y: 0.06, z: f.z } : { x: SLIPPER.x, y: 0.08, z: SLIPPER.z };
    }
    if (S.stage !== 'start' && Math.hypot(c.x - goose.x, c.z - goose.z) < 3) return { x: goose.x, y: 0.45, z: goose.z };
    return null;
  }

  // ---------- quadro ----------
  function update(dt, { active, ctrls }) {
    hints.frame(dt);
    effects.update(dt, ctrls);
    slipper.update(dt);
    updatePlates(dt, ctrls, active);
    updateGoose(dt, active, ctrls);

    if (!S.sawGate && Math.hypot(active.x - gateMid.x, active.z - gateMid.z) < 2.4) {
      S.sawGate = true;
    }
    if (active.size === 'large' && active.hits?.some((h) => h.id === 'cantinho-vao-grande')) hints.cond('nookBig', 3.4, 10);
    if (nearSlipper(active) && !slipper.canCarry(active)) hints.cond('heavy', 3.4, 9);

    hints.setPrompt(lockFor(active.name) ? null : interactable(active));
    cols.update(active);

    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) {
      const first = S.objKey === '';
      S.objKey = key;
      if (!first) onStageChange(S.stage);
    }

    const dropped = S.dropDeliver;
    S.dropDeliver = false;
    if (S.stage === 'carrying' && slipper.holder && (dropped || deliveredAt(GOAL, ctrls[slipper.holder], active))) {
      setStage('done');
      return 'delivered';
    }
    return null;
  }

  function updateAlways(dt) {
    if (S.stage === 'done') goose.animate(dt);
  }

  function setPrompt(kind) { hints.setPrompt(kind); }
  function navFlags() { return { gateOpen: gate.isOpen(0.9) }; }

  function reset() {
    props.reset?.();
    effects.reset();
    hints.reset();
    gate.reset();
    plateH.reset();
    plateL.reset();
    goose.reset();
    cols.reset();
    slipper.returnHome();
    props.lanternH?.setOn?.(0);
    props.lanternL?.setOn?.(0);
    props.slipper?.setHighlight?.(false);
    props.door?.setHighlight?.(false);
    Object.assign(S, {
      stage: 'start', lantH: 0, lantL: 0, litH: false, litL: false, metGoose: false, sawGate: false, oneT: 0,
      prevBy: { H: null, L: null }, gooseState: 'patrol', objKey: '', luredShot: false, dropDeliver: false,
    });
  }

  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    ctx.setStay?.('radhija', false);
    ctx.setStay?.('rhaenyra', false);
    let active = who || 'radhija';
    const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
    if (st === 'gateOpen' || st === 'carrying') {
      gate.set(1);
      openGate({ silent: true });
      S.lantH = 1;
      S.lantL = 1;
      props.lanternH?.setOn?.(1);
      props.lanternL?.setOn?.(1);
      place('radhija', -0.9, 3.1, Math.PI / 2);
      place('rhaenyra', -1.45, 2.75, Math.PI / 2);
      if (st === 'carrying') {
        active = who || 'rhaenyra';
        place(active, 1.0, 3.3, -Math.PI / 2);
        place(other(active), 1.6, 3.6, -Math.PI / 2);
        pickup(active);
      }
    }
    S.objKey = '';
    return active;
  }

  function info() {
    return {
      gate: gate.info(),
      plateH: plateH.info(),
      plateL: plateL.info(),
      lanterns: { H: +S.lantH.toFixed(2), L: +S.lantL.toFixed(2) },
      goose: goose.info(),
      slipper: { holder: slipper.holder, floor: slipper.floor ? { x: +slipper.floor.x.toFixed(3), z: +slipper.floor.z.toFixed(3) } : null, falling: slipper.falling },
      fx: { radhija: effects.info('radhija'), rhaenyra: effects.info('rhaenyra') },
      objective: objective(ctx.activeDog).text,
      lureSpot: LURE_SPOT,
      nook: { gap: NOOK.gap },
      hedgeX: HEDGE_AB.x,
    };
  }

  return {
    S: hints.S, TEXT, stages: STAGES,
    objective, update, updateAlways, interact, lockFor, lookTarget, navFlags, onBark,
    setPrompt, reset, jumpToStage, info, pickup,
    mech: { gate, plateH, plateL, goose, effects },
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return slipper.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
