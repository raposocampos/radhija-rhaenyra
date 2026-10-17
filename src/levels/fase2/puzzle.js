// FASE 2 · Operação Bolinha — puzzle (interface de puzzle: docs/ARQUITETURA.md §4.5).
// Beats (ver cabeçalho de ./layout.js):
//   1. Tábua de pressão (só a Rhaenyra pesa) abre o portão; Fica (F) para ela ficar lá; a Radhija passa
//      e dá uma arrancada (Shift) no calço → o portão fica travado aberto.
//   2. Irrigador giratório: atravessar sem se molhar (arrancada ajuda) e fechar o registro (E).
//   3. Caixote (só a Rhaenyra empurra, eixo X ou Z) até o vão do meio-fio → cai no canal e vira ponte.
//   Bolinha na faixa leste → caminha.
// Mecânicas genéricas: src/game/mechanics/. Props visuais (§6) sempre com ?. (cenário em paralelo).
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt } from '../../game/puzzleKit.js';
import {
  createDogEffects, createPressurePlate, createHingedGate, createPushCrate, createSprinkler, createLockedInteractable,
} from '../../game/mechanics/index.js';

export const STAGES = ['start', 'gateLocked', 'sprinklersOff', 'bridge', 'carrying', 'done'];

export const TEXT = {
  objective: {
    start: 'Encontre um jeito de abrir o portão',
    again: 'Leve a Rhaenyra de volta para a tábua',
    plankRh: 'Portão aberto! Agora troque para a Radhija (Q)',
    askStay: 'Peça para a Rhaenyra ficar na tábua (F)',
    passGate: 'Passe pelo portão com a Radhija',
    lockGate: 'Trave o portão: uma arrancada (Shift) no calço!',
    closedEast: 'O portão fechou! A Rhaenyra precisa voltar para a tábua',
    valve: 'Atravesse o irrigador sem se molhar e feche o registro (E)',
    callRh: 'Chame a Rhaenyra (F) e leve-a até o caixote',
    toCrate: 'Leve a Rhaenyra até o caixote',
    switchCrate: 'Troque para a Rhaenyra (Q) e empurre o caixote',
    pushCrate: 'Empurre o caixote até o vão do meio-fio (segure Shift)',
    ball: 'Atravesse a ponte e pegue a bolinha (E)',
    carrying: 'Leve a bolinha até a caminha',
  },
  hint: {
    light: 'Leve demais! Precisa de alguém mais pesado…',
    gateShut: 'O portão está fechado… deve haver um mecanismo por perto.',
    leftPlank: 'Peça para a Rhaenyra ficar na tábua (F)!',
    stayOk: 'A Rhaenyra vai esperar aqui. Para chamá-la de volta: F.',
    wedgeClosed: 'O calço só trava com o portão aberto!',
    wedgeWalk: 'Precisa de mais força: uma arrancada (Shift)!',
    wedgeRh: 'Esse calço pede uma arrancada da Radhija!',
    locked: 'Portão travado! Agora ele fica aberto.',
    wet: 'Molhou! Espere o jato passar — a arrancada (Shift) ajuda.',
    wetAgain: 'Observe o ritmo dos jatos e passe no intervalo.',
    wetRh: 'A Rhaenyra é devagar para os jatos… a Radhija é mais rápida!',
    off: 'Irrigador desligado! O gramado está livre.',
    heavy: 'Pesado demais para a Radhija. Chame a Rhaenyra (Q)!',
    shift: 'Segure Shift para empurrar',
    bricks: 'Os tijolos estão no caminho… empurre por outro lado.',
    edge: 'O caixote só entra no canal pelo vão do meio-fio!',
    companion: 'Cuidado com a sua companheira!',
    bridge: 'Virou ponte! Dá para atravessar o canal.',
  },
  prompt: { valve: 'Fechar o registro', ball: 'Pegar a bolinha' },
};

const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10));

/** @import { PuzzleContext, Puzzle, Fase2Props } from '../../types' */

/**
 * @param {PuzzleContext<Fase2Props>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props, world, dogs, emit, cam, root, place } = ctx;
  const { GATE, PLANK, WEDGE, SPRINKLER, VALVE, CHANNEL, CRATE, BALL, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R, WALL_AB } = layout;
  const gateMid = { x: GATE.hinge.x, z: (GATE.hinge.z + GATE.latchPost.z) / 2 };

  // ---------- mecânicas ----------
  const effects = createDogEffects({ world, dogs });
  const hints = createHints(emit, TEXT);
  const gate = createHingedGate({ id: 'gate', cfg: GATE, world, prop: props.gate });
  const plank = createPressurePlate({ id: 'plank', x: PLANK.x, z: PLANK.z, hx: PLANK.hx, hz: PLANK.hz, requires: PLANK.requires, emit, prop: props.plank, margin: 0.2 });
  const wedgeCol = world.addDynamic({ id: 'wedge', kind: 'wedge', shape: 'circle', x: WEDGE.x, z: WEDGE.z, r: WEDGE.r });
  const sprinkler = createSprinkler({ cfg: SPRINKLER, world, emit, effects, prop: props.sprinkler });
  const slotWater = world.addDynamic({
    id: 'canal-vao', kind: 'water', shape: 'box',
    x: (CHANNEL.xMin + CHANNEL.xMax) / 2, z: (CHANNEL.slot.zMin + CHANNEL.slot.zMax) / 2,
    hx: (CHANNEL.xMax - CHANNEL.xMin) / 2, hz: (CHANNEL.slot.zMax - CHANNEL.slot.zMin) / 2,
  });
  const crate = createPushCrate({ id: 'crate', cfg: CRATE, world, emit, prop: props.crate, onLimit: crateLimit });
  const valve = createLockedInteractable({
    id: 'valve', x: VALVE.interact.x, z: VALVE.interact.z, r: VALVE.interact.r, face: { x: VALVE.x, z: VALVE.z },
    duration: 1.1, action: 'turn',
    canUse: () => sprinkler.running,
    onStart: (c) => emit('valve:turn', { name: c.name, x: VALVE.x, z: VALVE.z }),
    onProgress: (k) => props.valve?.setTurn?.(k),
    onDone: () => turnOffSprinkler(),
  });
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const ball = createCarryItem({ obj: props.ball?.object || null, dogs, scene: root, carrier: 'any', name: 'ball' });

  const S = {
    stage: 'start',
    openedOnce: false,
    gateWasOpen: false,
    wedgeT: 0, wedgeAnim: -1, wedgeLocked: false, wedgeBumpCd: 0,
    dashRecent: { radhija: 0, rhaenyra: 0 },
    sink: null, bridge: false,
    crateUpdated: false,
    wetCount: 0,
    objKey: '',
    plankBy: null,
  };
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};

  function setStage(st, { silent = false } = {}) {
    if (S.stage === st) return;
    S.stage = st;
    S.objKey = '';
    if (!silent) onStageChange(st);
  }
  const stageIdx = (st) => STAGES.indexOf(st);
  const atLeast = (st) => stageIdx(S.stage) >= stageIdx(st);

  // ---------- objetivo ----------
  const tgt = (x, z, y = 0.8) => ({ x, y, z });
  function objective(activeName) {
    const O = TEXT.objective;
    const st = S.stage;
    const C = ctx.ctrls;
    const stay = ctx.isStaying?.('rhaenyra');
    let text = null;
    let target = null;
    if (st === 'start') {
      const rh = C.rhaenyra;
      const onPlank = plank.pressed && plank.by === 'rhaenyra';
      if (activeName === 'rhaenyra') {
        if (onPlank) { text = O.plankRh; target = tgt(C.radhija.x, C.radhija.z, 0.9); }
        else { text = S.openedOnce ? O.again : O.start; target = tgt(PLANK.x, PLANK.z, 0.55); }
      } else if (onPlank && !stay) { text = O.askStay; target = tgt(rh.x, rh.z, 1.0); }
      else if (onPlank) {
        if (C.radhija.x < WALL_AB.x) { text = O.passGate; target = tgt(gateMid.x + 0.3, gateMid.z, 1.0); }
        else { text = O.lockGate; target = tgt(WEDGE.x, WEDGE.z, 0.55); }
      } else if (C.radhija.x > WALL_AB.x) { text = O.closedEast; target = tgt(PLANK.x, PLANK.z, 0.55); }
      else { text = S.openedOnce ? O.again : O.start; target = tgt(PLANK.x, PLANK.z, 0.55); }
    } else if (st === 'gateLocked') {
      text = O.valve; target = tgt(VALVE.x, VALVE.z + 0.15, VALVE.y + 0.45);
    } else if (st === 'sprinklersOff') {
      if (activeName === 'rhaenyra') { text = O.pushCrate; target = tgt(CHANNEL.xMin - 0.1, CHANNEL.slot.z, 0.6); }
      else if (stay) { text = O.callRh; target = tgt(C.rhaenyra.x, C.rhaenyra.z, 1.0); }
      else if (Math.hypot(C.rhaenyra.x - crate.x, C.rhaenyra.z - crate.z) > 2.6) { text = O.toCrate; target = tgt(crate.x, crate.z, 0.9); }
      else { text = O.switchCrate; target = tgt(crate.x, crate.z, 0.9); }
    } else if (st === 'bridge') {
      text = O.ball; target = tgt(BALL.x, BALL.z, 0.6);
    } else if (st === 'carrying') {
      text = O.carrying; target = tgt(GOAL.x, GOAL.z, 0.9);
    }
    return { text, target, stage: st };
  }

  // ---------- portão + tábua + calço ----------
  function updateGate(dt, ctrls, active) {
    const p = plank.update(dt, { ctrls });
    if (p.light && ctrls[p.light] === active) hints.cond('light', 3.4, 10);
    const prevBy = S.plankBy;
    S.plankBy = p.by;
    if (!S.wedgeLocked) {
      gate.setTarget(p.pressed ? 1 : 0);
      // A Rhaenyra saiu da tábua seguindo a líder → ensinar o Fica.
      if (prevBy === 'rhaenyra' && !p.pressed && active.name === 'radhija' && !ctx.isStaying?.('rhaenyra')) hints.now('leftPlank', 4.2, 6);
    }
    const before = gate.t;
    gate.update(dt, { ctrls });
    if (gate.target === 1 && before < 0.05 && gate.t >= 0.05 && !S.gateWasOpen) {
      S.gateWasOpen = true;
      emit('gate:open', { x: gateMid.x + 0.5, z: gateMid.z });
      if (!S.openedOnce) {
        S.openedOnce = true;
        cam?.focusShot(gateMid.x + 0.4, gateMid.z, { hold: 1.1 });
      }
    }
    if (gate.target === 0 && S.gateWasOpen && gate.t < 0.95 && before >= 0.95) {
      S.gateWasOpen = false;
      emit('gate:close', { x: gateMid.x + 0.5, z: gateMid.z });
    }
    if (gate.t < 0.05) S.gateWasOpen = false;
  }

  function updateWedge(dt, active, ctrls) {
    S.wedgeBumpCd = Math.max(0, S.wedgeBumpCd - dt);
    for (const n of Object.keys(ctrls)) S.dashRecent[n] = ctrls[n].dashT > 0 ? 0.14 : Math.max(0, S.dashRecent[n] - dt);
    if (S.wedgeAnim >= 0) {
      S.wedgeAnim = Math.min(1, S.wedgeAnim + dt / 0.35);
      const k = smoother(S.wedgeAnim);
      S.wedgeT = k;
      wedgeCol.x = WEDGE.x + (WEDGE.lockedAt.x - WEDGE.x) * k;
      wedgeCol.z = WEDGE.z + (WEDGE.lockedAt.z - WEDGE.z) * k;
      props.wedge?.setState?.(k);
      if (S.wedgeAnim >= 1) S.wedgeAnim = -1;
    }
    if (S.wedgeLocked) return;
    const c = active;
    const touching = c.hits?.some((h) => h.id === 'wedge') || Math.hypot(c.x - wedgeCol.x, c.z - wedgeCol.z) < c.r + WEDGE.r + 0.05;
    if (!touching) return;
    if (c.cfg.dashSpeed && S.dashRecent[c.name] > 0) {
      if (gate.t >= WEDGE.needGateT) lockWedge(c);
      else if (S.wedgeBumpCd <= 0) {
        S.wedgeBumpCd = 0.8;
        props.wedge?.bump?.();
        emit('wedge:kick', { locked: false, name: c.name, x: wedgeCol.x, z: wedgeCol.z });
        hints.now('wedgeClosed', 3.4, 4);
      }
    } else if (c.size === 'large') hints.cond('wedgeRh', 3.2, 10);
    else if (gate.t >= WEDGE.needGateT) hints.cond('wedgeWalk', 3.2, 8);
    else hints.cond('wedgeClosed', 3.2, 10);
  }

  function lockWedge(c) {
    S.wedgeLocked = true;
    S.wedgeAnim = 0;
    gate.lock();
    emit('wedge:kick', { locked: true, name: c?.name, x: WEDGE.x, z: WEDGE.z });
    emit('gate:locked', { x: gateMid.x + 0.5, z: gateMid.z });
    cam?.focusShot((gateMid.x + WEDGE.lockedAt.x) / 2 + 0.2, (gateMid.z + WEDGE.lockedAt.z) / 2, { hold: 1.0 });
    hints.now('locked', 3.0, 30);
    setStage('gateLocked');
  }

  // ---------- irrigador + registro ----------
  function turnOffSprinkler() {
    if (!sprinkler.turnOff()) return;
    cam?.focusShot(SPRINKLER.x, SPRINKLER.z, { hold: 1.3 });
    hints.now('off', 3.0, 30);
    if (!atLeast('sprinklersOff')) setStage('sprinklersOff');
  }

  // ---------- caixote → ponte ----------
  function crateLimit({ z, axis, dir, pushing }) {
    if (axis !== 'x' || dir <= 0 || !pushing || S.sink) return false;
    if (Math.abs(z - CHANNEL.slot.z) < CRATE.slotSnap) {
      startSink();
      return true;
    }
    return false;
  }

  function startSink() {
    S.sink = { t: 0, x0: crate.x, z0: crate.z, x1: (CHANNEL.xMin + CHANNEL.xMax) / 2, z1: CHANNEL.slot.z, splash: false };
    crate.disable();
    emit('crate:sink', { x: S.sink.x1, z: S.sink.z1 });
    cam?.focusShot(S.sink.x1, S.sink.z1, { hold: 1.5 });
  }

  function updateSink(dt) {
    const k = S.sink;
    if (!k || k.done) return;
    k.t += dt;
    const slide = Math.min(1, k.t / 0.45);
    const e = smoother(slide);
    const x = k.x0 + (k.x1 - k.x0) * e;
    const z = k.z0 + (k.z1 - k.z0) * e;
    crate.col.x = x;
    crate.col.z = z;
    props.crate?.setPos?.(x, z);
    const sinkT = Math.max(0, Math.min(1, (k.t - 0.3) / 0.65));
    props.crate?.setSink?.(smoother(sinkT));
    if (sinkT >= 1) {
      k.done = true;
      makeBridge();
    }
  }

  function makeBridge({ silent = false } = {}) {
    S.bridge = true;
    slotWater.enabled = false;
    crate.col.enabled = false;
    props.ball?.setHighlight?.(true);
    if (!silent) {
      hints.now('bridge', 3.0, 30);
      emit('item:revealed', { item: 'ball', x: BALL.x, z: BALL.z });
    }
    if (!atLeast('bridge')) setStage('bridge', { silent });
  }

  // ---------- bolinha ----------
  function pickup(name) {
    const c = ctx.ctrls[name];
    ball.attach(name);
    props.ball?.setHighlight?.(false);
    props.bed?.setHighlight?.(true);
    emit('item:pickup', { name, item: 'ball', x: c.x, z: c.z });
    setStage('carrying');
  }

  // ---------- interação ----------
  function interactable(c) {
    if (valve.near(c)) return 'valve';
    if (S.stage === 'bridge' && !ball.holder && ball.canCarry(c) && reach(c, BALL.x, BALL.z) < BALL.pickupR) return 'ball';
    return null;
  }

  function interact(c) {
    const k = interactable(c);
    if (k === 'valve') return valve.start(c);
    if (k === 'ball') {
      pickup(c.name);
      return true;
    }
    if (!S.wedgeLocked && gate.t < 0.05 && c.x < WALL_AB.x && c.x > WALL_AB.x - 0.75 && Math.abs(c.z - gateMid.z) < 0.9) {
      hints.now('gateShut');
    }
    return false;
  }

  function lockFor(name) {
    return effects.lockFor(name) || valve.lockFor(name);
  }

  function lookTarget(c) {
    const k = hints.promptKind;
    if (k === 'valve') return { x: VALVE.x, y: VALVE.y, z: VALVE.z };
    if (k === 'ball') return { x: BALL.x, y: 0.07, z: BALL.z };
    if (valve.dog === c.name) return { x: VALVE.x, y: VALVE.y, z: VALVE.z };
    if (!S.wedgeLocked && Math.hypot(c.x - wedgeCol.x, c.z - wedgeCol.z) < 1.1) return { x: wedgeCol.x, y: 0.05, z: wedgeCol.z };
    if (S.stage === 'gateLocked' && sprinkler.running && Math.hypot(c.x - SPRINKLER.x, c.z - SPRINKLER.z) < SPRINKLER.r + 1.2) {
      return { x: SPRINKLER.x, y: 0.25, z: SPRINKLER.z };
    }
    return null;
  }

  // ---------- empurrar ----------
  function modifyIntent(dt, c, intent, { shift, comp }) {
    if (!crate.enabled) return null;
    const r = crate.modifyIntent(dt, c, intent, { shift });
    if (r.contact === 'needShift') hints.cond('shift', 3.0, 9);
    if (r.contact === 'strain') hints.cond('heavy', 3.4, 9);
    crate.update(dt, { comp });
    S.crateUpdated = true;
    if (crate.pushing) {
      if (crate.blockedBy === 'tijolos') hints.cond('bricks', 3.4, 9);
      else if (crate.blockedBy === 'limit' && crate.x >= CRATE.maxX - 0.01 && r.face?.axis === 'x') hints.cond('edge', 3.4, 9);
      else if (crate.blockedBy === 'companion') hints.cond('companion', 2.6, 9);
    }
    return { intent: r.intent, action: r.action };
  }

  // ---------- quadro ----------
  function update(dt, { active, comp, ctrls }) {
    hints.frame(dt);
    effects.update(dt, ctrls);
    updateGate(dt, ctrls, active);
    updateWedge(dt, active, ctrls);
    const wet = sprinkler.update(dt, ctrls);
    if (wet) {
      S.wetCount++;
      if (wet === 'rhaenyra') hints.now('wetRh', 3.6, 8);
      else hints.now(S.wetCount <= 1 ? 'wet' : 'wetAgain', 3.6, 8);
    }
    valve.update(dt);
    if (!S.crateUpdated && crate.enabled) crate.update(dt, { comp });
    S.crateUpdated = false;
    updateSink(dt);

    // dica do portão fechado (encostando pelo lado oeste)
    if (!S.wedgeLocked && gate.t < 0.05 && active.x < WALL_AB.x && active.hits?.some((h) => h.id === 'gate')) hints.cond('gateShut', 3.2, 12);

    hints.setPrompt(lockFor(active.name) ? null : interactable(active));
    cols.update(active);

    // objetivo dinâmico (quem está ativa, Fica, tábua…)
    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) {
      const first = S.objKey === '';
      S.objKey = key;
      if (!first) onStageChange(S.stage);
    }

    if (S.stage === 'carrying' && ball.holder && deliveredAt(GOAL, ctrls[ball.holder], active)) {
      setStage('done');
      return 'delivered';
    }
    return null;
  }

  function updateAlways(dt) {
    updateSink(dt);
  }

  function setPrompt(kind) { hints.setPrompt(kind); }

  function navFlags() {
    return { gateOpen: gate.isOpen(0.9), sprinklersOff: !sprinkler.running, bridge: S.bridge };
  }

  function reset() {
    props.reset?.();
    effects.reset();
    hints.reset();
    gate.reset();
    plank.reset();
    sprinkler.reset();
    valve.reset();
    crate.reset();
    cols.reset();
    ball.returnHome();
    props.ball?.setHighlight?.(false);
    props.bed?.setHighlight?.(false);
    props.valve?.setTurn?.(0);
    props.crate?.setSink?.(0);
    props.wedge?.setState?.(0);
    wedgeCol.x = WEDGE.x;
    wedgeCol.z = WEDGE.z;
    slotWater.enabled = true;
    Object.assign(S, {
      stage: 'start', openedOnce: false, gateWasOpen: false,
      wedgeT: 0, wedgeAnim: -1, wedgeLocked: false, wedgeBumpCd: 0,
      dashRecent: { radhija: 0, rhaenyra: 0 }, sink: null, bridge: false, crateUpdated: false,
      wetCount: 0, objKey: '', plankBy: null,
    });
  }

  // ---------- ?stage= ----------
  function forceLocked() {
    S.openedOnce = true;
    S.gateWasOpen = true;
    S.wedgeLocked = true;
    gate.lock();
    gate.set(1);
    S.wedgeT = 1;
    wedgeCol.x = WEDGE.lockedAt.x;
    wedgeCol.z = WEDGE.lockedAt.z;
    props.wedge?.setState?.(1);
  }
  function forceBridge() {
    crate.disable();
    const x = (CHANNEL.xMin + CHANNEL.xMax) / 2;
    crate.col.x = x;
    crate.col.z = CHANNEL.slot.z;
    props.crate?.setPos?.(x, CHANNEL.slot.z);
    props.crate?.setSink?.(1);
    S.sink = { done: true };
    makeBridge({ silent: true });
  }

  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    ctx.setStay?.('radhija', false);
    ctx.setStay?.('rhaenyra', false);
    let active = who || 'radhija';
    const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
    switch (st) {
      case 'gateLocked':
        forceLocked();
        place('rhaenyra', PLANK.x, PLANK.z, 1.2);
        place('radhija', -1.3, 1.25, Math.PI);
        active = 'radhija';
        setStage('gateLocked', { silent: true });
        ctx.setStay?.('rhaenyra', true);
        break;
      case 'sprinklersOff':
        forceLocked();
        sprinkler.forceOff();
        valve.markUsed();
        props.valve?.setTurn?.(1);
        place('radhija', 1.1, -3.85, Math.PI / 2);
        place('rhaenyra', 0.3, -3.6, Math.PI / 2);
        setStage('sprinklersOff', { silent: true });
        break;
      case 'bridge':
      case 'carrying':
        forceLocked();
        sprinkler.forceOff();
        valve.markUsed();
        props.valve?.setTurn?.(1);
        setStage('sprinklersOff', { silent: true });
        forceBridge();
        active = who || 'rhaenyra';
        place('rhaenyra', 3.6, 1.4, Math.PI / 2);
        place('radhija', 3.3, 2.3, Math.PI / 2);
        if (st === 'carrying') {
          place(active, 5.8, -2.5, Math.PI);
          place(other(active), 5.75, -1.6, Math.PI);
          pickup(active);
          S.stage = 'carrying';
        }
        break;
      default:
        break;
    }
    S.objKey = '';
    return active;
  }

  function info() {
    return {
      gate: gate.info(),
      plank: plank.info(),
      wedge: { locked: S.wedgeLocked, t: +S.wedgeT.toFixed(2), x: +wedgeCol.x.toFixed(2), z: +wedgeCol.z.toFixed(2) },
      sprinkler: sprinkler.info(),
      valve: valve.info(),
      crate: crate.info(),
      bridge: S.bridge,
      ball: { holder: ball.holder },
      fx: { radhija: effects.info('radhija'), rhaenyra: effects.info('rhaenyra') },
      objective: objective(ctx.activeDog).text,
    };
  }

  function endActions() {
    crate.endPush();
  }

  return {
    S: hints.S, TEXT, stages: STAGES,
    objective, update, updateAlways, interact, lockFor, lookTarget, modifyIntent, navFlags,
    setPrompt, reset, jumpToStage, info, endActions, pickup,
    mech: { gate, plank, sprinkler, crate, valve, effects },
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return ball.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
