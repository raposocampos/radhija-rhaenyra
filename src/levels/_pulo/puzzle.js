// ARENA DO PULO (fase de desenvolvimento) — PUZZLE.
// A Rhaenyra pula a cerca de troncos, pega a bolinha, pula de volta e leva para casa.
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt } from '../../game/puzzleKit.js';

export const STAGES = ['start', 'carrying', 'done'];

export const TEXT = {
  objective: {
    switch: 'Troque para a Rhaenyra (Q): só ela pula',
    jump: 'Pule a cerca de troncos (Espaço) e pegue a bolinha (E)',
    carrying: 'Pule de volta e leve a bolinha para casa',
  },
  hint: {
    radhija: 'A Radhija não pula… a Rhaenyra sim! (Q)',
    tall: 'Alto demais para pular!',
    jump: 'Corra na direção do tronco e aperte Espaço.',
  },
  prompt: { ball: 'Pegar a bolinha' },
};

/** @import { PuzzleContext, Puzzle, PlaceholderProps } from '../../types' */

/**
 * @param {PuzzleContext<PlaceholderProps>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props, world, dogs, emit, root, place } = ctx;
  const { BALL, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R } = layout;
  const jumpable = new Set(world.statics.filter((c) => c.jumpable).map((c) => c.id));

  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const ball = createCarryItem({ obj: props.ball?.object || props.item?.object || null, dogs, scene: root, name: 'ball' });

  const S = { stage: 'start', objKey: '', pushT: 0 };
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  function setStage(st) {
    if (S.stage === st) return;
    S.stage = st;
    onStageChange(st);
  }

  function objective(activeName) {
    const at = (x, z, y = 0.8) => ({ x, y, z });
    const O = TEXT.objective;
    if (S.stage === 'start') {
      if (activeName === 'radhija') return { text: O.switch, target: at(ctx.ctrls.rhaenyra.x, ctx.ctrls.rhaenyra.z, 1.0), stage: S.stage };
      return { text: O.jump, target: at(BALL.x, BALL.z, 0.6), stage: S.stage };
    }
    if (S.stage === 'carrying') return { text: O.carrying, target: at(GOAL.x, GOAL.z, 0.9), stage: S.stage };
    return { text: null, target: null, stage: S.stage };
  }

  const nearBall = (c) => !ball.holder && reach(c, BALL.x, BALL.z) < BALL.pickupR;

  function pickup(name) {
    const c = ctx.ctrls[name];
    ball.attach(name);
    emit('item:pickup', { name, item: 'ball', x: c.x, z: c.z });
    setStage('carrying');
  }

  function update(dt, { active, ctrls }) {
    hints.frame(dt);
    // Dicas: a Radhija esbarrando num tronco; a Rhaenyra empurrando um tronco sem pular; a mureta alta.
    const onLog = !(active.jumpT > 0) && active.hits?.some((h) => jumpable.has(h.id));
    S.pushT = onLog ? S.pushT + dt : 0;
    if (onLog && active.name === 'radhija') hints.cond('radhija', 3.4, 8);
    else if (S.pushT > 0.8) hints.cond('jump', 3.4, 10);
    if (active.name === 'rhaenyra' && active.hits?.some((h) => h.id === 'mureta-alta')) hints.cond('tall', 3.0, 8);

    hints.setPrompt(nearBall(active) ? 'ball' : null);
    cols.update(active);

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
    return false;
  }

  function reset() {
    hints.reset();
    cols.reset();
    ball.returnHome();
    Object.assign(S, { stage: 'start', objKey: '', pushT: 0 });
  }

  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    if (st === 'carrying') {
      place('rhaenyra', BALL.x - 0.4, BALL.z + 0.3, -Math.PI / 2);
      pickup('rhaenyra');
    }
    return who || 'rhaenyra';
  }

  return {
    S: hints.S, TEXT, stages: STAGES,
    objective, update, interact, reset, jumpToStage,
    lockFor: () => null,
    lookTarget: (c) => (nearBall(c) ? { x: BALL.x, y: 0.08, z: BALL.z } : null),
    navFlags: () => ({}),
    setPrompt: (kind) => hints.setPrompt(kind),
    info: () => ({ ball: { holder: ball.holder }, objective: objective(ctx.activeDog).text }),
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return ball.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
