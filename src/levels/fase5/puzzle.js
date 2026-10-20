// FASE 5 · Operação Ursinho — puzzle (ver o cabeçalho de ./layout.js).
// Cadeia: Rhaenyra pula o portãozinho → abre a trava do lado do corredor → pula a barricada de caixas
// → empurra a caixa de almofadas de dentro da cozinha (desmonta) → Radhija entra debaixo da mesa →
// ursinho → caminha. E larga o ursinho no chão (E perto pega de volta); largado na caminha, entrega.
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt, inZones, mouthPoint } from '../../game/puzzleKit.js';
import { createPushCrate, createHingedGate, createLockedInteractable } from '../../game/mechanics/index.js';

export const STAGES = ['start', 'gateOpen', 'boxClear', 'carrying', 'done'];
const COLLAPSE_TIME = 0.55; // s da caixa de almofadas desmontando

export const TEXT = {
  objective: {
    jumpGate: 'Pule o portãozinho com a Rhaenyra (Espaço)',
    jumpRad: 'Só a Rhaenyra pula: troque para ela (Q)',
    latch: 'Abra a trava do portãozinho para a Radhija (E)',
    jumpBoxes: 'Uma barricada de caixas! Pule por cima com a Rhaenyra (Espaço)',
    pushBox: 'Empurre a caixa de almofadas para o corredor (segure Shift)',
    boxRad: 'A Rhaenyra precisa abrir a porta da cozinha: troque (Q)',
    bear: 'Só a Radhija cabe debaixo da mesa: pegue o ursinho (E)',
    bearRh: 'A Rhaenyra é grande demais para a mesa: troque para a Radhija (Q)',
    carrying: 'Leve o ursinho para a caminha',
    pickAgain: 'Pegue o ursinho de volta (E)',
  },
  hint: {
    gateRad: 'A Radhija não alcança a trava. A Rhaenyra pula! (Q)',
    gateJump: 'Aperte Espaço para pular o portãozinho!',
    latchSide: 'A trava fica do outro lado do portãozinho…',
    gateOpen: 'Portãozinho aberto! Agora a Radhija passa também.',
    threshold: 'Do lado de cá a caixa encalha na soleira… Pule para dentro da cozinha e empurre de lá!',
    books: 'Essa é a caixa de livros: pesada demais! A de almofadas é mais leve.',
    boxClear: 'A caixa de almofadas desmontou: a porta da cozinha está livre!',
    boxRad: 'Pesada demais para a Radhija. Chame a Rhaenyra (Q)!',
    shift: 'Segure Shift para empurrar',
    tableBig: 'A Rhaenyra é grande demais para entrar debaixo da mesa…',
    found: 'Achou o ursinho!',
  },
  prompt: { latch: 'Abrir a trava', bear: 'Pegar o ursinho', drop: 'Largar o ursinho' },
};

/** @import { PuzzleContext, Puzzle, Fase5Props } from '../../types' */

/**
 * @param {PuzzleContext<Fase5Props>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props, world, dogs, emit, cam, root, place } = ctx;
  const { PET_GATE, LATCH, BOX_PILLOWS, WALL_SH, WALL_HK, TABLE, BEAR, GOAL, NAV_NODES: N, COLLECTIBLES, COLLECTIBLE_PICKUP_R } = layout;
  const gateMid = { x: PET_GATE.hinge.x, z: (PET_GATE.hinge.z + PET_GATE.latchPost.z) / 2 };

  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const bear = createCarryItem({ obj: props.bear?.object || null, dogs, scene: root, name: 'bear', emit, world });
  const gate = createHingedGate({ id: 'portaozinho', cfg: PET_GATE, world, prop: props.petGate });
  gate.col.jumpable = true; // baixinho: a Rhaenyra passa por cima
  /** Largado, o ursinho não fica na caminha (lá ele é entregue). */
  const dropAvoid = inZones([GOAL]);
  const S = { stage: 'start', objKey: '', collapseT: -1, boxClear: false, crateUpdated: false, dropDeliver: false };

  // ---------- caixa de almofadas: só anda para o oeste; em minX desmonta ----------
  const box = createPushCrate({
    id: 'caixa-almofadas', cfg: BOX_PILLOWS, world, emit, prop: props.pillowBox,
    onLimit: ({ axis, dir }) => {
      if (axis !== 'x' || dir >= 0 || S.collapseT >= 0) return false;
      collapseBox();
      return true;
    },
  });
  box.col.jumpable = true;
  function collapseBox({ silent = false } = {}) {
    S.collapseT = silent ? COLLAPSE_TIME : 0;
    box.disable();
    props.pillowBox?.setCollapse?.(silent ? 1 : 0);
    if (!silent) {
      emit('box:collapse', { x: box.x, z: box.z });
      hints.now('boxClear', 3.4, 4);
      cam?.focusShot(WALL_HK.x, BOX_PILLOWS.start.z, { hold: 1.0 });
    }
    S.boxClear = true;
    refreshStage();
  }

  // ---------- trava do portãozinho (lado do corredor) ----------
  const latch = createLockedInteractable({
    id: 'trava', x: LATCH.x, z: LATCH.z, r: LATCH.r, face: { x: PET_GATE.latchPost.x, z: PET_GATE.latchPost.z + 0.1 },
    duration: LATCH.duration, action: 'tug',
    canUse: (c) => c.x > WALL_SH.x + 0.05 && !gate.isOpen(0.5),
    onStart: (c) => emit('latch:start', { name: c.name, x: LATCH.x, z: LATCH.z }),
    onProgress: (k) => props.latch?.setTurn?.(k),
    onDone: () => openGate(),
  });
  function openGate({ silent = false } = {}) {
    gate.setTarget(1);
    gate.lock();
    props.latch?.setTurn?.(1);
    if (!silent) {
      emit('gate:open', { x: gateMid.x + 0.4, z: gateMid.z });
      hints.now('gateOpen', 3.2, 4);
      cam?.focusShot(gateMid.x, gateMid.z, { hold: 0.9 });
    }
    refreshStage();
  }

  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  function setStage(st) {
    if (STAGES.indexOf(st) <= STAGES.indexOf(S.stage)) return;
    S.stage = st;
    S.objKey = '';
    onStageChange(st);
  }
  /**
   * A etapa vem do estado, não da ordem em que as coisas aconteceram: a primeira condição que falta.
   * A Rhaenyra pode pular o portãozinho e desmontar a caixa antes de abrir a trava; aí a fase continua
   * em 'start' (falta abrir a trava para a Radhija) e vai direto para 'boxClear' quando ela abrir.
   */
  function refreshStage() {
    if (S.stage === 'carrying' || S.stage === 'done') return;
    setStage(!gate.locked ? 'start' : !S.boxClear ? 'gateOpen' : 'boxClear');
  }

  const inHall = (c) => c.x > WALL_SH.x && c.x < WALL_HK.x;
  const inKitchen = (c) => c.x > WALL_HK.x + 0.3;
  const at = (x, z, y = 0.8) => ({ x, y, z });
  function objective(activeName) {
    const O = TEXT.objective;
    const C = ctx.ctrls;
    let text = null;
    let target = null;
    if (S.stage === 'start') {
      if (activeName !== 'rhaenyra') { text = O.jumpRad; target = at(C.rhaenyra.x, C.rhaenyra.z, 1.0); }
      else if (C.rhaenyra.x > WALL_SH.x) { text = O.latch; target = at(LATCH.x, LATCH.z, 0.7); }
      else { text = O.jumpGate; target = at(gateMid.x, gateMid.z, 0.75); }
    } else if (S.stage === 'gateOpen') {
      if (activeName !== 'rhaenyra') { text = O.boxRad; target = at(C.rhaenyra.x, C.rhaenyra.z, 1.0); }
      else if (inKitchen(C.rhaenyra)) { text = O.pushBox; target = at(box.x, box.z, 0.8); }
      else { text = O.jumpBoxes; target = at(WALL_HK.x, 0, 0.8); }
    } else if (S.stage === 'boxClear') {
      if (activeName === 'radhija') { text = O.bear; target = at(BEAR.x, BEAR.z, 0.45); }
      else { text = O.bearRh; target = at(C.radhija.x, C.radhija.z, 0.9); }
    } else if (S.stage === 'carrying') {
      const f = !bear.holder && bear.floor;
      if (f) { text = O.pickAgain; target = at(f.x, f.z, 0.5); }
      else { text = O.carrying; target = at(GOAL.x, GOAL.z, 0.7); }
    }
    return { text, target, stage: S.stage };
  }

  // ---------- ursinho ----------
  /** Debaixo da mesa (só a Radhija cabe lá); ou largado no chão depois (E perto pega de volta, qualquer uma). */
  const nearBear = (c) => (S.stage === 'boxClear' && !bear.holder && c.size === 'small' && reach(c, BEAR.x, BEAR.z) < BEAR.pickupR)
    || (S.stage === 'carrying' && !bear.holder && bear.nearFloor(c));
  function pickup(name) {
    const c = ctx.ctrls[name];
    const again = S.stage === 'carrying';
    props.bear?.setCarried?.(true);
    bear.attach(name);
    props.bed?.setHighlight?.(true);
    emit('item:pickup', { name, item: 'bear', x: c.x, z: c.z });
    if (!again) hints.now('found', 2.6, 4);
    setStage('carrying');
  }
  /** E com o ursinho na boca: de frente para a caminha, entrega; senão ele cai no chão à frente (E perto pega de volta). */
  function dropBear(c) {
    const m = mouthPoint(c);
    if (Math.hypot(m.x - GOAL.x, m.z - GOAL.z) < GOAL.r) {
      S.dropDeliver = true;
      return;
    }
    bear.dropBy(c, { avoid: dropAvoid });
    props.bed?.setHighlight?.(false);
  }
  const canDrop = (c) => S.stage === 'carrying' && bear.holder === c.name;

  // ---------- quadro ----------
  function modifyIntent(dt, c, intent, { shift, comp }) {
    const r = box.modifyIntent(dt, c, intent, { shift });
    if (r.contact === 'needShift') hints.cond('shift', 3.0, 9);
    if (r.contact === 'strain') hints.cond('boxRad', 3.4, 9);
    box.update(dt, { comp });
    S.crateUpdated = true;
    if (r.contact === 'push' && box.blockedBy === 'limit' && c.x < box.x) hints.cond('threshold', 4.2, 8);
    if (shift && c.size === 'large' && c.hits?.some((h) => h.id === 'caixa-livros')) hints.cond('books', 3.6, 10);
    return r;
  }

  function update(dt, { active, comp, ctrls }) {
    hints.frame(dt);
    bear.update(dt);
    if (!S.crateUpdated) box.update(dt, { comp });
    S.crateUpdated = false;
    gate.update(dt, { ctrls });
    latch.update(dt);
    if (S.collapseT >= 0 && S.collapseT < COLLAPSE_TIME) {
      S.collapseT = Math.min(COLLAPSE_TIME, S.collapseT + dt);
      props.pillowBox?.setCollapse?.(S.collapseT / COLLAPSE_TIME);
    }

    // dicas de contato
    if (!gate.locked && active.hits?.some((h) => h.id === 'portaozinho')) {
      hints.cond(active.size === 'large' ? 'gateJump' : 'gateRad', 3.4, 9);
    }
    if (active.size === 'large' && active.hits?.some((h) => h.id === 'mesa-toalha')) hints.cond('tableBig', 3.4, 10);

    // a trava vale enquanto o portãozinho estiver fechado, em qualquer etapa
    const prompt = !gate.locked && latch.near(active) ? 'latch' : nearBear(active) ? 'bear' : canDrop(active) ? 'drop' : null;
    hints.setPrompt(prompt);
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
    if (S.stage === 'carrying' && bear.holder && (dropped || deliveredAt(GOAL, ctrls[bear.holder], active))) {
      setStage('done');
      return 'delivered';
    }
    return null;
  }

  function interact(c) {
    if (!gate.locked && latch.near(c)) { latch.start(c); return true; }
    if (nearBear(c)) { pickup(c.name); return true; }
    if (canDrop(c)) { dropBear(c); return true; }
    // do lado da sala, a trava não alcança
    if (!gate.locked && c.x < WALL_SH.x && Math.hypot(c.x - gateMid.x, c.z - gateMid.z) < 1.0) {
      hints.now('latchSide', 3.2, 4);
      return true;
    }
    return false;
  }

  function reset() {
    props.reset?.();
    hints.reset();
    cols.reset();
    gate.reset();
    latch.reset();
    box.reset();
    bear.returnHome();
    props.bear?.setCarried?.(false);
    Object.assign(S, { stage: 'start', objKey: '', collapseT: -1, boxClear: false, crateUpdated: false, dropDeliver: false });
  }

  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    if (st !== 'start') {
      latch.markUsed();
      gate.set(1);
      openGate({ silent: true });
      place('rhaenyra', N.H_mid.x, N.H_mid.z, Math.PI / 2);
      place('radhija', N.H_gate.x, N.H_gate.z, Math.PI / 2);
    }
    if (st === 'boxClear' || st === 'carrying') {
      box.setPos(BOX_PILLOWS.minX, BOX_PILLOWS.start.z);
      collapseBox({ silent: true });
      place('rhaenyra', N.K_mid.x, N.K_mid.z, Math.PI / 2);
      place('radhija', N.K_table.x, N.K_table.z, Math.PI);
    }
    if (st === 'carrying') {
      place('radhija', BEAR.x, BEAR.z + 0.3, Math.PI);
      pickup('radhija');
    }
    S.objKey = '';
    return who || (st === 'start' || st === 'gateOpen' ? 'rhaenyra' : 'radhija');
  }

  return {
    S: hints.S, TEXT, stages: STAGES,
    objective, update, interact, reset, jumpToStage, modifyIntent,
    lockFor: (name) => latch.lockFor(name),
    lookTarget: (c) => {
      if (nearBear(c)) {
        const f = bear.floor;
        return f ? { x: f.x, y: 0.06, z: f.z } : { x: BEAR.x, y: 0.1, z: BEAR.z };
      }
      if (!gate.locked && latch.near(c)) return { x: PET_GATE.latchPost.x, y: 0.4, z: PET_GATE.latchPost.z };
      return null;
    },
    navFlags: () => ({ petGate: gate.isOpen(0.9), boxClear: S.boxClear }),
    setPrompt: (kind) => hints.setPrompt(kind),
    endActions: () => box.endPush(),
    info: () => ({
      gate: gate.info(), latch: latch.info(), box: { ...box.info(), collapsed: S.collapseT >= 0 },
      bear: { holder: bear.holder, floor: bear.floor ? { x: +bear.floor.x.toFixed(3), z: +bear.floor.z.toFixed(3) } : null, falling: bear.falling },
      objective: objective(ctx.activeDog).text,
      rooms: { rhaenyra: inHall(ctx.ctrls.rhaenyra) ? 'corredor' : inKitchen(ctx.ctrls.rhaenyra) ? 'cozinha' : 'sala' },
    }),
    mech: { gate, latch, box },
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return bear.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
