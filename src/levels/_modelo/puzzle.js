// MODELO DE FASE (não registrado no jogo) — PUZZLE. Ver docs/COMO-CRIAR-UMA-FASE.md.
// A Rhaenyra fica na placa (Fica) → o portão abre → a Radhija busca a bolinha → volta ao objetivo.
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt } from '../../game/puzzleKit.js';
import { createPressurePlate, createHingedGate } from '../../game/mechanics/index.js';

export const STAGES = ['start', 'gateOpen', 'carrying', 'done'];

export const TEXT = {
  objective: {
    start: 'Alguém pesado precisa pisar na placa',
    stay: 'Peça para a Rhaenyra ficar na placa (F)',
    ball: 'Passe pelo portão e pegue a bolinha (E)',
    carrying: 'Leve a bolinha para casa',
  },
  hint: {
    light: 'Leve demais! Precisa de alguém mais pesado…',
    opened: 'O portão abriu!',
  },
  prompt: { ball: 'Pegar a bolinha' },
};

/** @import { PuzzleContext, Puzzle } from '../../types' */

/**
 * @param {PuzzleContext} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props = {}, world, dogs, emit, root, place } = ctx;
  const { GATE, PLATE, BALL, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R } = layout;

  // Peças prontas: dicas/prompts, petiscos, item na boca, placa e portão.
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const ball = createCarryItem({ obj: props.ball?.object || props.item?.object || null, dogs, scene: root, name: 'ball' });
  const plate = createPressurePlate({ id: 'plate', x: PLATE.x, z: PLATE.z, r: PLATE.r, requires: PLATE.requires, emit, prop: props.plate });
  const gate = createHingedGate({ id: 'gate', cfg: GATE, world, prop: props.gate });

  const S = { stage: 'start', objKey: '' };
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  function setStage(st) {
    if (S.stage === st) return;
    S.stage = st;
    onStageChange(st);
  }

  function objective(activeName) {
    const O = TEXT.objective;
    const at = (x, z, y = 0.8) => ({ x, y, z });
    if (S.stage === 'start') {
      if (plate.pressed && !ctx.isStaying('rhaenyra') && activeName === 'radhija') return { text: O.stay, target: at(PLATE.x, PLATE.z, 1.0), stage: S.stage };
      return { text: O.start, target: at(PLATE.x, PLATE.z, 0.5), stage: S.stage };
    }
    if (S.stage === 'gateOpen') return { text: O.ball, target: at(BALL.x, BALL.z, 0.6), stage: S.stage };
    if (S.stage === 'carrying') return { text: O.carrying, target: at(GOAL.x, GOAL.z, 0.9), stage: S.stage };
    return { text: null, target: null, stage: S.stage };
  }

  const nearBall = (c) => !ball.holder && S.stage !== 'start' && reach(c, BALL.x, BALL.z) < BALL.pickupR;

  function pickup(name) {
    const c = ctx.ctrls[name];
    ball.attach(name);
    emit('item:pickup', { name, item: 'ball', x: c.x, z: c.z });
    setStage('carrying');
  }

  function update(dt, { active, ctrls }) {
    hints.frame(dt);
    const p = plate.update(dt, { ctrls });
    if (p.light && ctrls[p.light] === active) hints.cond('light');
    gate.setTarget(p.pressed ? 1 : 0);
    const before = gate.t;
    gate.update(dt, { ctrls });
    if (before < 0.05 && gate.t >= 0.05) emit('gate:open', { x: GATE.hinge.x, z: (GATE.hinge.z + GATE.latchPost.z) / 2 });
    if (S.stage === 'start' && gate.isOpen(0.9)) { setStage('gateOpen'); hints.now('opened'); }

    hints.setPrompt(nearBall(active) ? 'ball' : null);
    cols.update(active);

    // Reemite o objetivo quando o texto muda (ex.: pedir o Fica).
    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) {
      const first = S.objKey === '';
      S.objKey = key;
      if (!first) onStageChange(S.stage);
    }

    if (S.stage === 'carrying' && deliveredAt(GOAL, ctrls[ball.holder], active)) {
      setStage('done');
      return 'delivered';
    }
    return null;
  }

  function interact(c) {
    if (nearBall(c)) { pickup(c.name); return true; }
    return false; // nada por perto: a dog late
  }

  function reset() {
    hints.reset();
    cols.reset();
    plate.reset();
    gate.reset();
    ball.returnHome();
    Object.assign(S, { stage: 'start', objKey: '' });
  }

  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    if (st === 'gateOpen' || st === 'carrying') {
      place('rhaenyra', PLATE.x, PLATE.z, 0);
      ctx.setStay('rhaenyra', true);
      gate.set(1);
      setStage('gateOpen');
      place('radhija', 1.2, 0.9, Math.PI / 2);
    }
    if (st === 'carrying') pickup('radhija');
    return who || 'radhija';
  }

  return {
    S: hints.S, TEXT, stages: STAGES,
    objective, update, interact, reset, jumpToStage,
    lockFor: () => null,
    lookTarget: (c) => (nearBall(c) ? { x: BALL.x, y: 0.08, z: BALL.z } : null),
    navFlags: () => ({ gateOpen: gate.isOpen(0.9) }),
    setPrompt: (kind) => hints.setPrompt(kind),
    info: () => ({ gate: gate.info(), plate: plate.info(), ball: { holder: ball.holder }, objective: objective(ctx.activeDog).text }),
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return ball.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
