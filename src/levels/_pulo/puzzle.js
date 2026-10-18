// ARENA DO PULO (fase de desenvolvimento) — PUZZLE.
// A Rhaenyra pula a cerca de troncos, pega a bolinha, pula de volta e leva para casa.
// Extra (parede de treino): de frente para as patinhas pintadas, o pulo vira impulso na parede. O botão abre a
// portinhola do armarinho por alguns segundos (o ossinho de dentro) e a alavanca liga e desliga as luzinhas.
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt } from '../../game/puzzleKit.js';
import { createWallButton } from '../../game/mechanics/wallButton.js';
import { airborne, wallKick } from '../../game/dogController.js';

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
    wallRadhija: 'Alto demais para a Radhija! A Rhaenyra pega impulso na parede das patinhas (Q).',
    wallHow: 'De frente para as patinhas pintadas, aperte Espaço: a Rhaenyra pega impulso na parede.',
  },
  prompt: { ball: 'Pegar a bolinha', wall: 'Impulso na parede' },
};

/** @import { PuzzleContext, Puzzle, PuloProps } from '../../types' */

/**
 * @param {PuzzleContext<PuloProps>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props, world, dogs, emit, root, place } = ctx;
  const { BALL, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R, WALL_BUTTON, WALL_LEVER, CUBBY, LIGHTS } = layout;
  const jumpable = new Set(world.statics.filter((c) => c.jumpable).map((c) => c.id));

  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const ball = createCarryItem({ obj: props.ball?.object || props.item?.object || null, dogs, scene: root, name: 'ball' });

  // parede de treino: botão (portinhola do armarinho) e alavanca (luzinhas)
  const button = createWallButton({ id: 'botao-treino', cfg: WALL_BUTTON, emit, prop: props.wallButton });
  const lever = createWallButton({ id: 'alavanca-treino', cfg: WALL_LEVER, emit, prop: props.wallLever });
  const buttons = [button, lever];
  const hatchCol = world.addDynamic({ id: 'portinhola', shape: 'segment', ax: CUBBY.x0, az: CUBBY.zFront, bx: CUBBY.x1, bz: CUBBY.zFront, t: 0.025 });
  const hatchAt = { x: (CUBBY.x0 + CUBBY.x1) / 2, z: CUBBY.zFront };
  const lightsAt = { x: (LIGHTS.x0 + LIGHTS.x1) / 2, y: LIGHTS.y, z: LIGHTS.z + 0.1 };
  /**
   * Alguma dog dentro do armarinho ou na soleira (o círculo dela passa da linha da portinhola)? A portinhola espera
   * ela sair para fechar. Quem só encosta na portinhola fechada fica fora da linha (o colisor tem 2,5 cm).
   */
  const inCubby = (ctrls) => Object.values(ctrls).some((c) => c.x > CUBBY.x0 - c.r && c.x < CUBBY.x1 + c.r && c.z - c.r < CUBBY.zFront + 0.015);

  const S = { stage: 'start', objKey: '', pushT: 0, hatchOpen: false, hatchT: 0, wallPushT: 0 };
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

    // parede de treino: a portinhola fica aberta enquanto o botão conta o tempo ou há alguém na porta
    for (const b of buttons) b.update(dt);
    const open = button.on || inCubby(ctrls);
    if (open !== S.hatchOpen) {
      S.hatchOpen = open;
      emit(open ? 'hatch:open' : 'hatch:close', { id: 'portinhola', ...hatchAt });
    }
    hatchCol.enabled = !open;
    S.hatchT = Math.max(0, Math.min(1, S.hatchT + (open ? dt * 5 : -dt * 3.5)));
    props.hatch?.setOpen(S.hatchT);
    const nearSpot = buttons.some((b) => {
      const K = wallKick(b.spot, active.r);
      return Math.hypot(active.x - K.x, active.z - K.z) < 1.1;
    });
    if (nearSpot && active.name === 'radhija') hints.cond('wallRadhija', 3.6, 10);
    const pushingWall = nearSpot && active.name === 'rhaenyra' && !airborne(active) && active.hits?.some((h) => h.id === 'limite-norte' || h.id === 'bounds');
    S.wallPushT = pushingWall ? S.wallPushT + dt : 0;
    if (S.wallPushT > 0.9) hints.cond('wallHow', 3.6, 10);

    const wallReady = active.name === 'rhaenyra' && !airborne(active) && buttons.some((b) => b.inReach(active, world));
    if (nearBall(active)) hints.setPrompt('ball');
    else hints.setPrompt(wallReady ? 'wall' : null, 'Espaço');
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

  /** O impulso alcançou o alto: o botão abre a portinhola; a alavanca liga e desliga as luzinhas. */
  function onWallTouch(c, spot) {
    if (spot.id === button.id) button.touch();
    if (spot.id === lever.id) {
      lever.touch();
      props.lights?.setOn(lever.on);
      emit(lever.on ? 'lantern:on' : 'lantern:off', { id: 'luzinhas', ...lightsAt });
    }
  }

  function reset() {
    hints.reset();
    cols.reset();
    ball.returnHome();
    for (const b of buttons) b.reset();
    props.lights?.setOn(false);
    props.hatch?.setOpen(0);
    hatchCol.enabled = true;
    Object.assign(S, { stage: 'start', objKey: '', pushT: 0, hatchOpen: false, hatchT: 0, wallPushT: 0 });
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
    wallSpots: () => buttons.map((b) => b.spot),
    onWallTouch,
    setPrompt: (kind) => hints.setPrompt(kind),
    info: () => ({
      ball: { holder: ball.holder }, objective: objective(ctx.activeDog).text,
      wall: { button: button.info(), lever: lever.info(), hatch: S.hatchOpen, hatchT: +S.hatchT.toFixed(2) },
    }),
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return ball.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
