// ARENA DO EMPURRÃO (fase de desenvolvimento) — PUZZLE.
// A Rhaenyra segura o empurrar (Shift · R1) de frente para a arvorezinha, fica de pé e empurra: no terceiro empurrão a
// bolinha cai dos galhos; ela pega e leva para a caminha. A mesinha (patinho) e a estante (ursinho) são para treinar:
// o brinquedo que cai pode ser levado na boca (E pega; E de novo larga). A irmã também pode ser empurrada.
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt } from '../../game/puzzleKit.js';
import { createShoveTarget } from '../../game/mechanics/shoveTarget.js';
import { pickShoveSpot, shoveStance, shoving } from '../../game/dogController.js';

export const STAGES = ['start', 'ball', 'carrying', 'done'];

export const TEXT = {
  objective: {
    switch: 'Troque para a Rhaenyra (Q): só ela fica de pé e empurra',
    shove: 'De frente para a arvorezinha, segure Shift: a Rhaenyra fica de pé e empurra',
    ball: 'A bolinha caiu! Pegue a bolinha (E)',
    carrying: 'Leve a bolinha para a caminha',
  },
  hint: {
    radhija: 'Só a Rhaenyra fica de pé e empurra! (Q)',
    how: 'Segure Shift de frente para a arvorezinha: a Rhaenyra fica de pé e empurra.',
    more: 'Continue segurando: mais um empurrão!',
    sister: 'Empurrar a irmã? Ela não gostou nada…',
    mouthFull: 'Ela já está com algo na boca: aperte E para largar.',
  },
  prompt: { shove: 'Empurrar', ball: 'Pegar a bolinha', duck: 'Pegar o patinho', bear: 'Pegar o ursinho', drop: 'Largar' },
};

/** @import { PuzzleContext, Puzzle, EmpurraProps, DogName } from '../../types' */

/**
 * @param {PuzzleContext<EmpurraProps>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props, world, dogs, emit, root } = ctx;
  const { GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R, SHOVE_TARGETS } = layout;
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });

  // os três empurráveis e o que está em cima de cada um
  const ballObj = props.ball?.object || null;
  const duckObj = props.duck?.object || null;
  const bearObj = props.bear?.object || null;
  const targets = {
    tree: createShoveTarget({ id: 'arvorezinha', cfg: SHOVE_TARGETS.arvorezinha, emit, world, root, prop: props.tree, item: ballObj }),
    table: createShoveTarget({ id: 'mesinha', cfg: SHOVE_TARGETS.mesinha, emit, world, root, prop: props.table, item: duckObj }),
    shelf: createShoveTarget({ id: 'estante', cfg: SHOVE_TARGETS.estante, emit, world, root, prop: props.shelf, item: bearObj }),
  };
  const list = Object.values(targets);
  const byId = Object.fromEntries(list.map((t) => [t.id, t]));
  // itens que vão na boca (createCarryItem guarda o pai de origem: o galho/tampo, para voltar no reset)
  const items = {
    ball: { obj: ballObj, carry: createCarryItem({ obj: ballObj, dogs, scene: root, name: 'ball' }), target: targets.tree },
    duck: { obj: duckObj, carry: createCarryItem({ obj: duckObj, dogs, scene: root, name: 'duck' }), target: targets.table },
    bear: { obj: bearObj, carry: createCarryItem({ obj: bearObj, dogs, scene: root, name: 'bear' }), target: targets.shelf },
  };
  const bearPose = (lie) => (lie ? bearObj?.userData?.lie?.() : bearObj?.userData?.sit?.());

  const S = { stage: 'start', objKey: '', bumpT: 0, shoves: 0, droppedAt: /** @type {Record<string, {x:number,z:number}>} */ ({}) };
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  function setStage(st) {
    if (S.stage === st) return;
    S.stage = st;
    onStageChange(st);
  }

  /** Item que está no chão (caiu ou foi largado) ao alcance da dog c → chave ou null. */
  function itemNear(c) {
    let best = null;
    let bestD = Infinity;
    for (const [k, it] of Object.entries(items)) {
      if (it.carry.holder) continue;
      const p = S.droppedAt[k] || it.target.itemAt;
      if (!p) continue;
      const d = reach(c, p.x, p.z);
      if (d < 0.5 && d < bestD) { best = k; bestD = d; }
    }
    return best;
  }
  /** O que a dog leva na boca (chave) ou null. */
  const holding = (name) => Object.keys(items).find((k) => items[k].carry.holder === name) || null;

  function objective(activeName) {
    const at = (x, z, y = 0.8) => ({ x, y, z });
    const O = TEXT.objective;
    const T = SHOVE_TARGETS.arvorezinha;
    if (S.stage === 'start') {
      if (activeName === 'radhija') return { text: O.switch, target: at(ctx.ctrls.rhaenyra.x, ctx.ctrls.rhaenyra.z, 1.0), stage: S.stage };
      return { text: O.shove, target: at(T.x, T.z, 1.25), stage: S.stage };
    }
    if (S.stage === 'ball') {
      const p = S.droppedAt.ball || targets.tree.itemAt || T.item.from;
      return { text: O.ball, target: at(p.x, p.z, 0.5), stage: S.stage };
    }
    if (S.stage === 'carrying') return { text: O.carrying, target: at(GOAL.x, GOAL.z, 0.9), stage: S.stage };
    return { text: null, target: null, stage: S.stage };
  }

  function pickup(name, key) {
    const c = ctx.ctrls[name];
    if (key === 'bear') bearPose(true);
    items[key].carry.attach(name);
    delete S.droppedAt[key];
    emit('item:pickup', { name, item: key, x: c.x, z: c.z });
    if (key === 'ball') setStage('carrying');
  }

  function drop(name, key) {
    const c = ctx.ctrls[name];
    const x = c.x + Math.sin(c.yaw) * (c.r + 0.12);
    const z = c.z + Math.cos(c.yaw) * (c.r + 0.12);
    if (key === 'bear') bearPose(false);
    // drop() devolve o item ao pai de origem (o galho/tampo): no chão ele mora na raiz da cena
    items[key].carry.drop(x, z);
    const obj = items[key].obj;
    if (obj) {
      root.add(obj);
      obj.position.set(x, key === 'ball' ? 0.072 : 0, z);
      obj.rotation.set(0, ctx.ctrls[name].yaw, 0);
    }
    S.droppedAt[key] = { x, z };
    emit('item:drop', { name, item: key, x, z });
    if (key === 'ball') setStage('ball');
  }

  function update(dt, { active, ctrls }) {
    hints.frame(dt);
    for (const t of list) t.update(dt);
    if (S.stage === 'start' && targets.tree.landed) setStage('ball');

    // dicas: a Radhija esbarrando num empurrável; a Rhaenyra encostada sem segurar o empurrar
    const touching = active.hits?.some((h) => byId[h.id]);
    S.bumpT = touching && !shoving(active) ? S.bumpT + dt : 0;
    if (touching && active.name === 'radhija') hints.cond('radhija', 3.4, 8);
    else if (S.bumpT > 0.8 && active.name === 'rhaenyra') hints.cond('how', 3.6, 10);
    if (active.shove && active.shove.kind === 'sister' && active.shoveN >= 1) hints.cond('sister', 2.8, 20);

    // prompt: empurrar quando dá; pegar/largar perto de um item
    const near = !holding(active.name) ? itemNear(active) : null;
    const canShove = active.size === 'large' && !shoving(active) && !!pickShoveSpot(active, spots(), 0, 0, world);
    if (near) hints.setPrompt(near);
    else hints.setPrompt(canShove ? 'shove' : null, 'Shift');
    cols.update(active);

    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) {
      const first = S.objKey === '';
      S.objKey = key;
      if (!first) onStageChange(S.stage);
    }

    const ballHolder = items.ball.carry.holder;
    if (S.stage === 'carrying' && ballHolder && deliveredAt(GOAL, ctrls[ballHolder], active)) {
      setStage('done');
      return 'delivered';
    }
    return null;
  }

  function interact(c) {
    if (shoving(c)) return false;
    const has = holding(c.name);
    const near = itemNear(c);
    if (near && !has) { pickup(c.name, near); return true; }
    if (near && has) { hints.now('mouthFull'); return true; }
    if (has) { drop(c.name, has); return true; }
    return false;
  }

  /** Os pontos de empurrão que valem agora (os três, sempre: depois que o item cai, empurrar só balança). */
  function spots() { return list.map((t) => t.spot); }

  /** Um empurrão chegou: balança o alvo; a partir do segundo, a dica para continuar segurando (só no primeiro alvo). */
  function onShove(c, spot, ctrls) {
    const t = byId[spot.id];
    if (!t) return;
    const n = t.shove(c, ctrls);
    S.shoves++;
    if (n === 1 && !t.dropped) hints.cond('more', 2.4, 30);
  }

  function reset() {
    hints.reset();
    cols.reset();
    for (const it of Object.values(items)) it.carry.returnHome();
    for (const t of list) t.reset();
    bearPose(false);
    props.reset?.();
    Object.assign(S, { stage: 'start', objKey: '', bumpT: 0, shoves: 0, droppedAt: {} });
  }

  /** @param {string} st @param {{ who?: DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    if (st === 'ball' || st === 'carrying') {
      // derruba a bolinha na hora: três empurrões e a queda inteira
      for (let i = 0; i < 3; i++) targets.tree.shove(null, ctx.ctrls);
      for (let i = 0; i < 240 && !targets.tree.landed; i++) targets.tree.update(1 / 60);
      setStage('ball');
      if (st === 'carrying') {
        const p = targets.tree.itemAt;
        ctx.place('rhaenyra', p.x - 0.35, p.z, Math.PI / 2);
        pickup('rhaenyra', 'ball');
      }
    }
    return who || 'rhaenyra';
  }

  return {
    S: hints.S, TEXT, stages: STAGES,
    objective, update, interact, reset, jumpToStage,
    lockFor: () => null,
    lookTarget: (c) => {
      const k = itemNear(c);
      const p = k ? S.droppedAt[k] || items[k].target.itemAt : null;
      return p ? { x: p.x, y: 0.08, z: p.z } : null;
    },
    navFlags: () => ({}),
    shoveSpots: spots,
    onShove,
    carries: (name) => !!holding(name),
    setPrompt: (kind) => hints.setPrompt(kind),
    info: () => ({
      objective: objective(ctx.activeDog).text,
      empurra: {
        tree: targets.tree.info(), table: targets.table.info(), shelf: targets.shelf.info(),
        holder: Object.fromEntries(Object.entries(items).map(([k, it]) => [k, it.carry.holder])),
        stance: shoveStance(SHOVE_TARGETS.arvorezinha, ctx.ctrls.rhaenyra.r),
      },
    }),
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return items.ball.carry.holder || holding('rhaenyra') || holding('radhija') || null; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
