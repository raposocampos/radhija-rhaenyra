// ARENA DOS PORQUINHOS (fase de desenvolvimento) — PUZZLE.
// Pise no botão: a porteira abre e os três porquinhos saem para atrapalhar. A bolinha está no chiqueiro, atrás deles.
// Os legumes (milho, cenoura, aboborinha) estão do outro lado: E pega, E de novo larga (joga no chão à frente). Na
// horta, o porquinho livre mais perto vai comer e fica distraído por um tempo (come, cochila e volta a atrapalhar).
// Pegar o legume de volta tira dele a comida. Comido, o legume volta para o lugar. Quem leva algo na boca é o alvo
// preferido: o esbarrão derruba o legume (que vira comida, se cair na horta) ou a bolinha (que fica no chão até a dog
// pegar de novo). O sininho (E) chama todos de volta ao chiqueiro (a porteira fecha; o botão abre de novo). A
// bolinha na caminha termina a arena.
import { createHints, createCollectibles, createCarryItem, reach, deliveredAt } from '../../game/puzzleKit.js';
import { createDogEffects, createPressurePlate, createPigHerd } from '../../game/mechanics/index.js';
import { createPig } from '../../characters/pig.js';

export const STAGES = ['start', 'pigsOut', 'carrying', 'done'];
/** @type {('corn' | 'carrot' | 'pumpkin')[]} */
export const VEG_KINDS = ['corn', 'carrot', 'pumpkin'];

export const TEXT = {
  objective: {
    startRh: 'Pule a cerca baixa da horta (Espaço) e pise no botão do chiqueiro',
    startRad: 'Entre na horta pelo vão da cerca e pise no botão do chiqueiro',
    closed: 'Pise no botão: a porteira do chiqueiro abre',
    ball: 'Pegue a bolinha no chiqueiro (E)',
    ballBack: 'Pegue a bolinha de volta (E)',
    pigs: 'Os porquinhos não deixam passar! Traga um legume do outro lado (E) e largue perto deles (E)',
    drop: 'Largue o legume perto dos porquinhos (E)',
    carrying: 'Leve a bolinha para a caminha',
  },
  hint: {
    out: 'Oinc! Os porquinhos saíram do chiqueiro!',
    pigs: 'Eles adoram legumes: traga milho, cenoura ou abóbora e largue no chão (E). Um porquinho vai comer.',
    eat: 'Nhac! Esse ficou distraído por um tempo…',
    back: 'Acabou o lanche: ele voltou a atrapalhar!',
    taken: 'Ei! Ele queria aquele legume…',
    home: 'Todos de volta ao chiqueiro.',
    rhGap: 'A Rhaenyra não passa no vão… mas pula a cerca baixa! (Espaço)',
    outside: 'Fora da horta os porquinhos não comem: largue o legume lá dentro.',
    knocked: 'Derrubou! Eles derrubam o que você leva na boca: distraia os porquinhos com legumes antes.',
  },
  prompt: { veg: 'Pegar o legume', drop: 'Largar o legume', ball: 'Pegar a bolinha', bell: 'Tocar o sininho' },
};

/** @import { PuzzleContext, Puzzle, PorcosProps, DogName } from '../../types' */

/**
 * @param {PuzzleContext<PorcosProps>} ctx
 * @returns {Puzzle}
 */
export function createPuzzle(ctx) {
  const { layout, props, world, dogs, emit, root, place } = ctx;
  const { PIGS, BUTTON, BELL, BALL, VEGGIES, GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R } = layout;
  const A = PIGS.area;
  const inArea = (x, z) => x > A.minX && x < A.maxX && z > A.minZ && z < A.maxZ;

  const S = {
    stage: 'start', objKey: '', pestMode: false, pestT: 0, calmT: 0, bumps: 0,
    /** onde a bolinha está no chão (derrubada, fica onde caiu) e o voo dela */ ballAt: { x: BALL.x, z: BALL.z },
    /** @type {any} */ ballToss: null,
  };
  const effects = createDogEffects({ world, dogs });
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const ball = createCarryItem({ obj: props.item?.object || null, dogs, scene: root, name: 'ball' });
  const button = createPressurePlate({ id: 'botao-do-chiqueiro', x: BUTTON.x, z: BUTTON.z, r: BUTTON.r, requires: 'any', emit, prop: props.button });
  /** Os eventos dos porcos vão para o jogo (sons e efeitos) e viram dicas aqui. */
  const pigEmit = (name, p) => {
    emit(name, p);
    if (name === 'pig:eat') hints.now('eat', 3, 6);
    else if (name === 'pig:done' && p?.reason === 'time') hints.now('back', 3, 6);
    else if (name === 'pig:home') hints.now('home');
    else if (name === 'pig:bump') S.bumps++;
  };
  const pigs = createPigHerd({ id: 'porco', cfg: PIGS, world, root, emit: pigEmit, effects, createPig, gateProp: props.penGate, knockItem });

  const veg = VEG_KINDS.map((kind) => {
    const prop = props.veggies?.[kind] || null;
    return {
      kind, prop,
      item: createCarryItem({ obj: prop?.object || null, dogs, scene: root, name: kind === 'pumpkin' ? 'ball' : 'carrot' }),
      home: { x: VEGGIES[kind].x, z: VEGGIES[kind].z },
      groundY: prop?.groundY ?? 0.03,
      /** @type {'home' | 'held' | 'air' | 'ground' | 'eaten'} */ state: 'home',
      x: VEGGIES[kind].x, z: VEGGIES[kind].z,
      /** @type {any} */ food: null,
      /** @type {any} */ toss: null,
      respawnT: 0,
      /** @type {DogName | null} */ holder: null,
    };
  });

  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  function setStage(st) {
    if (S.stage === st) return;
    S.stage = st;
    onStageChange(st);
  }

  const vegOf = (name) => veg.find((v) => v.holder === name) || null;
  const carries = (name) => ball.holder === name || !!vegOf(name);
  const nearBell = (c) => Math.hypot(c.x - BELL.x, c.z - BELL.z) < BELL.reach + c.r;
  const nearVeg = (c) => veg.find((v) => (v.state === 'home' || v.state === 'ground') && reach(c, v.x, v.z) < VEGGIES.pickupR) || null;
  const nearBall = (c) => !ball.holder && !S.ballToss && S.stage !== 'start' && reach(c, S.ballAt.x, S.ballAt.z) < BALL.pickupR;

  function pickVeg(v, c) {
    if (v.food) {
      const eating = v.food.state === 'eating';
      pigs.removeFood(v.food);
      v.food = null;
      if (eating) hints.now('taken', 2.6, 4);
    }
    v.item.attach(c.name);
    v.state = 'held';
    v.holder = c.name;
    emit('item:pickup', { name: c.name, item: v.kind, x: c.x, z: c.z });
  }

  /** Uma dog pequena cabe perto de (x, z)? (os porcos não contam: eles saem do lugar) */
  const pigIds = () => new Set(pigs.pigs.map((P) => P.id));
  function dogFits(x, z, ignore) {
    if (!world.overlaps(x, z, 0.17, 'small', { ignore })) return true;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (!world.overlaps(x + Math.sin(a) * 0.3, z + Math.cos(a) * 0.3, 0.17, 'small', { ignore })) return true;
    }
    return false;
  }
  /**
   * Onde o que a dog largou (ou derrubaram) pode cair sem ir para um limbo: sem atravessar nada alto no caminho (parede
   * do chiqueiro, caixote; por cima da cerca baixa e dos canteiros pode), fora de qualquer colisor e com lugar para uma
   * dog chegar perto. Tenta o ponto pedido, depois mais perto, depois para os lados; no fim, aos pés da própria dog.
   */
  function landingFor(c, ux, uz, dist) {
    const ignore = pigIds();
    const tries = [1, 0.75, 0.5, 0.3].map((k) => [ux, uz, dist * k]);
    for (const a of [0.9, -0.9, 1.8, -1.8, Math.PI]) {
      const ca = Math.cos(a), sa = Math.sin(a);
      tries.push([ux * ca + uz * sa, uz * ca - ux * sa, 0.45]);
    }
    for (const [x, z, d] of tries) {
      const p = world.resolve(c.x + x * d, c.z + z * d, 0.07, 'small', { ignore });
      if (world.segmentClear(c.x, c.z, p.x, p.z, 0.06, 'small', { ignore, airborne: true }) && dogFits(p.x, p.z, ignore)) return p;
    }
    return { x: c.x, z: c.z };
  }

  /** Larga (joga) o legume no chão à frente da dog (ou até `to`): um arco curto; na horta, vira comida dos porcos ao cair. */
  function tossVeg(v, c, to = null) {
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const sx = c.x + fx * (c.r + 0.12), sz = c.z + fz * (c.r + 0.12);
    const land = to || landingFor(c, fx, fz, c.r + VEGGIES.toss);
    v.item.drop(sx, sz, 0.3);
    v.holder = null;
    v.state = 'air';
    v.toss = { t: 0, dur: 0.34, sx, sz, sy: 0.3, tx: land.x, tz: land.z, spin: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 3) };
  }

  function landVeg(v) {
    const T = v.toss;
    v.toss = null;
    v.state = 'ground';
    v.x = T.tx;
    v.z = T.tz;
    const o = v.prop?.object;
    if (o) {
      o.position.set(T.tx, v.groundY, T.tz);
      o.rotation.set(0, o.rotation.y, 0);
    }
    emit('item:land', { x: T.tx, z: T.tz, kind: v.kind });
    if (!inArea(T.tx, T.tz)) {
      if (S.stage !== 'start') hints.now('outside', 3, 8);
      return;
    }
    v.food = pigs.addFood({
      x: T.tx, z: T.tz, kind: v.kind,
      onProgress: (k) => v.prop?.setEaten(k),
      onDone: () => {
        v.state = 'eaten';
        v.food = null;
        v.respawnT = VEGGIES.respawn;
      },
    });
  }

  function updateVeg(dt) {
    for (const v of veg) {
      if (v.state === 'air') {
        const T = v.toss;
        T.t += dt;
        const u = Math.min(1, T.t / T.dur);
        const o = v.prop?.object;
        if (o) {
          const y = T.sy + (v.groundY - T.sy) * u * u + Math.sin(Math.PI * u) * 0.14;
          o.position.set(T.sx + (T.tx - T.sx) * u, y, T.sz + (T.tz - T.sz) * u);
          o.rotation.z = T.spin * T.t * (1 - u * 0.6);
        }
        if (u >= 1) landVeg(v);
      } else if (v.state === 'eaten') {
        v.respawnT -= dt;
        if (v.respawnT <= 0) {
          v.prop?.reset();
          v.item.returnHome();
          v.state = 'home';
          v.x = v.home.x;
          v.z = v.home.z;
        }
      }
    }
  }

  function pickBall(name) {
    const c = ctx.ctrls[name];
    ball.attach(name);
    emit('item:pickup', { name, item: 'ball', x: c.x, z: c.z });
    setStage('carrying');
  }

  /**
   * O porquinho derrubou o que a dog levava (createPigHerd knockItem): o objeto voa para o lado em que ela foi
   * empurrada e cai no chão. → true se ela levava algo.
   */
  function knockItem(name, { dirX, dirZ }) {
    const c = ctx.ctrls[name];
    const side = Math.random() < 0.5 ? -1 : 1, dist = 0.55 + Math.random() * 0.3;
    const ux = dirX * 0.8 - dirZ * side * 0.6, uz = dirZ * 0.8 + dirX * side * 0.6;
    const ul = Math.hypot(ux, uz) || 1;
    const land = landingFor(c, ux / ul, uz / ul, dist);
    const v = vegOf(name);
    let hit = false;
    if (v) { tossVeg(v, c, land); hit = true; }
    else if (ball.holder === name) {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      const sx = c.x + fx * (c.r + 0.12), sz = c.z + fz * (c.r + 0.12);
      ball.drop(sx, sz, 0.3);
      S.ballToss = { t: 0, dur: 0.38, sx, sz, sy: 0.3, tx: land.x, tz: land.z };
      setStage('pigsOut');
      hit = true;
    }
    if (hit) hints.now('knocked', 4, 10);
    return hit;
  }

  function updateBall(dt) {
    const T = S.ballToss;
    if (!T) return;
    T.t += dt;
    const u = Math.min(1, T.t / T.dur);
    const o = props.item?.object;
    if (o) o.position.set(T.sx + (T.tx - T.sx) * u, T.sy + (0.07 - T.sy) * u * u + Math.sin(Math.PI * u) * 0.16, T.sz + (T.tz - T.sz) * u);
    if (u < 1) return;
    S.ballToss = null;
    S.ballAt = { x: T.tx, z: T.tz };
    emit('item:land', { x: T.tx, z: T.tz, kind: 'ball' });
  }

  function ringBell() {
    props.bell?.ring();
    emit('bell:ring', { x: BELL.x, z: BELL.z });
    pigs.recall();
  }

  const pestering = () => pigs.pigs.filter((P) => P.state === 'chase').length;

  function objective(activeName) {
    const O = TEXT.objective;
    const at = (x, z, y = 0.8) => ({ x, y, z });
    const v = vegOf(activeName);
    if (S.stage === 'start') return { text: activeName === 'rhaenyra' ? O.startRh : O.startRad, target: at(BUTTON.x, BUTTON.z, 0.4), stage: S.stage };
    if (S.stage === 'pigsOut') {
      if (v) {
        const c = ctx.ctrls[activeName];
        let best = null, bd = Infinity;
        for (const P of pigs.pigs) {
          if (P.state === 'pen' || P.state === 'eat' || P.state === 'nap') continue;
          const d = Math.hypot(P.x - c.x, P.z - c.z);
          if (d < bd) { bd = d; best = P; }
        }
        return { text: O.drop, target: best ? at(best.x, best.z, 0.75) : at(BALL.x, BALL.z, 0.6), stage: S.stage };
      }
      const moved = Math.hypot(S.ballAt.x - BALL.x, S.ballAt.z - BALL.z) > 0.05; // derrubada fora do lugar
      if (!pigs.open && !moved) return { text: O.closed, target: at(BUTTON.x, BUTTON.z, 0.4), stage: S.stage };
      if (moved) return { text: O.ballBack, target: at(S.ballAt.x, S.ballAt.z, 0.6), stage: S.stage }; // derrubada
      if (S.pestMode) {
        const h = veg.find((x) => x.state === 'home' || x.state === 'ground') || veg[0];
        return { text: O.pigs, target: at(h.x, h.z, 0.55), stage: S.stage };
      }
      return { text: O.ball, target: at(BALL.x, BALL.z, 0.6), stage: S.stage };
    }
    if (S.stage === 'carrying') return { text: O.carrying, target: at(GOAL.x, GOAL.z, 0.9), stage: S.stage };
    return { text: null, target: null, stage: S.stage };
  }

  function update(dt, { active, ctrls }) {
    hints.frame(dt);
    effects.update(dt, ctrls);
    const b = button.update(dt, { ctrls });
    if (b.pressed && !pigs.open) {
      pigs.setOpen(true);
      if (S.stage === 'start') {
        setStage('pigsOut');
        hints.now('out', 3);
      }
    }
    pigs.update(dt, { active, ctrls, carries });
    updateVeg(dt);
    updateBall(dt);

    // dica dos legumes quando os porquinhos estão atrapalhando de verdade (com histerese, para o objetivo não piscar)
    const pest = pestering();
    if (pest > 0) { S.pestT += dt; S.calmT = 0; } else { S.calmT += dt; S.pestT = 0; }
    if (!S.pestMode && (S.pestT > 2.5 || S.bumps > 0) && S.stage === 'pigsOut') {
      S.pestMode = true;
      hints.cond('pigs', 6, 20);
    } else if (S.pestMode && S.calmT > 4) S.pestMode = false;
    S.bumps = 0;
    if (active.name === 'rhaenyra' && active.hits?.some((h) => h.id === 'horta-vao')) hints.cond('rhGap', 3.4, 10);

    if (vegOf(active.name)) hints.setPrompt('drop');
    else if (ball.holder === active.name) hints.setPrompt(null);
    else if (nearBell(active)) hints.setPrompt('bell');
    else if (nearVeg(active)) hints.setPrompt('veg');
    else hints.setPrompt(nearBall(active) ? 'ball' : null);
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
    const v = vegOf(c.name);
    if (v) { tossVeg(v, c); return true; }
    if (ball.holder === c.name) return false;
    if (nearBell(c)) { ringBell(); return true; }
    const g = nearVeg(c);
    if (g) { pickVeg(g, c); return true; }
    if (nearBall(c)) { pickBall(c.name); return true; }
    return false; // nada por perto: a dog late
  }

  function reset() {
    hints.reset();
    cols.reset();
    effects.reset();
    button.reset();
    pigs.reset();
    ball.returnHome();
    for (const v of veg) {
      v.item.returnHome();
      v.prop?.reset();
      Object.assign(v, { state: 'home', x: v.home.x, z: v.home.z, food: null, toss: null, respawnT: 0, holder: null });
    }
    Object.assign(S, { stage: 'start', objKey: '', pestMode: false, pestT: 0, calmT: 0, bumps: 0, ballAt: { x: BALL.x, z: BALL.z }, ballToss: null });
  }

  /** @param {string} st @param {{ who?: DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(st)) return null;
    reset();
    if (st === 'pigsOut' || st === 'carrying') {
      pigs.releaseNow();
      setStage('pigsOut');
      place('rhaenyra', 2.5, -0.5, Math.PI / 2);
      place('radhija', 2.0, 0.5, Math.PI / 2);
    }
    if (st === 'carrying') {
      place('radhija', BALL.x - 0.45, BALL.z + 0.3, Math.PI / 2);
      pickBall('radhija');
    }
    return who || 'radhija';
  }

  return {
    S: hints.S, TEXT, stages: STAGES,
    objective, update, interact, reset, jumpToStage, carries,
    updateAlways(dt) { if (S.stage === 'done') pigs.animate(dt); },
    lockFor: (name) => effects.lockFor(name) || null,
    lookTarget(c) {
      const v = vegOf(c.name) ? null : nearVeg(c);
      if (v) return { x: v.x, y: 0.05, z: v.z };
      if (nearBall(c)) return { x: S.ballAt.x, y: 0.08, z: S.ballAt.z };
      return null;
    },
    navFlags: () => ({ penOpen: pigs.gate.t > 0.9 }),
    onBark: (c) => { pigs.onBark(c); },
    setPrompt: (kind) => hints.setPrompt(kind),
    /** Porcos e legumes para os testes e as capturas. */
    pigs,
    /** Põe um legume na boca de uma dog (testes, capturas). */
    give(kind, name) {
      const v = veg.find((x) => x.kind === kind);
      if (!v || v.holder || v.state === 'air') return false;
      pickVeg(v, ctx.ctrls[name]);
      return true;
    },
    info: () => ({
      porcos: pigs.info(),
      veggies: veg.map((v) => ({ kind: v.kind, state: v.state, x: +v.x.toFixed(2), z: +v.z.toFixed(2), holder: v.holder, eaten: +(v.prop?.eaten ?? 0).toFixed(2), food: v.food?.id ?? null })),
      button: button.info(),
      ball: { holder: ball.holder, x: +S.ballAt.x.toFixed(2), z: +S.ballAt.z.toFixed(2), air: !!S.ballToss },
      objective: objective(ctx.activeDog).text,
    }),
    set onStageChange(fn) { onStageChange = fn; },
    get stage() { return S.stage; },
    get carrier() { return ball.holder; },
    get collected() { return cols.count; },
    get total() { return cols.total; },
  };
}
