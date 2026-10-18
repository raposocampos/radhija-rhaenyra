// Lambe-Lambe na Pracinha · puzzle. Tudo avança por dt (pausa congela subida, descida e lambidas).
//   1. Só a Radhija cabe no túnel de manilha do morrinho, e o fundo dele tem lama: ela entra no parquinho
//      enlameada (anda a metade e fica sem arrancada).
//   2. O trinco do portão fica do lado de dentro: a Radhija destrava (E) e a Rhaenyra pode entrar.
//   3. Lambe-Lambe (R com a Rhaenyra, pertinho da irmã): cada lambida tira uma placa de lama; na última a
//      Radhija sacode as gotinhas, o pelo brilha e a arrancada volta.
//   4. O frisbee está no alto do escorregador: só uma arrancada sobe a rampa. Andando, enlameada ou com a
//      Rhaenyra, a dog escorrega de volta (a dica diz por quê). Lá em cima a Radhija pega o frisbee, vira e
//      desce de barriga.
//   5. A bolinha está no chão do parquinho. Cada dog leva um objeto na boca até a toalha de piquenique; com os
//      dois lá, a fase acaba. Nenhuma ordem trava: dá para pegar a bolinha antes ou depois do frisbee.
import { createCarryItem, createCollectibles, createHints, reach } from '../../game/puzzleKit.js';
import { createDogEffects, createHingedGate, createLockedInteractable, createMud } from '../../game/mechanics/index.js';
import {
  FENCE, TUNNEL, MUD_ZONE, MUD, GATE, LATCH, BALL, SLIDE, SLIDE_ENTRY, SLIDE_TIMES, FRISBEE, PICNIC, PICNIC_SPOTS, PUDDLES,
  GOAL, COLLECTIBLES, COLLECTIBLE_PICKUP_R,
} from './layout.js';

/**
 * @typedef {'start'|'inside'|'muddy'|'clean'|'carrying'|'done'} Stage
 * @typedef {'ball'|'frisbee'} Thing
 * @typedef {'ground'|'top'|'carried'|'picnic'} Place
 * @typedef {'climb'|'slip'} SlideMode
 * @typedef {'up'|'grab'|'turn'|'down'|'runout'|'slipUp'|'slipDown'} SlidePhase
 */
/** @type {Stage[]} */
export const STAGES = ['start', 'inside', 'muddy', 'clean', 'carrying', 'done'];
export const TEXT = {
  objective: {
    tunnel: 'Só a Radhija cabe no túnel do morrinho: entre no parquinho por ele',
    tunnelRh: 'A Rhaenyra não cabe no túnel: troque para a Radhija (Q)',
    latch: 'O trinco do portão fica do lado de dentro: destrave com a Radhija (E)',
    latchRh: 'A Radhija está no parquinho: troque (Q) e destrave o portão por dentro',
    lickRh: 'Chegue pertinho da Radhija e segure R para o Lambe-Lambe',
    comeIn: 'Portão aberto! Entre no parquinho com a Rhaenyra para limpar a Radhija',
    muddyRad: 'Enlameada, a Radhija fica lenta e sem arrancada: troque para a Rhaenyra (Q) e faça o Lambe-Lambe (R)',
    climb: 'Suba o escorregador com uma arrancada (Shift) e pegue o frisbee',
    climbRh: 'Só a arrancada da Radhija sobe o escorregador: troque para ela (Q)',
    climbFull: 'Leve a bolinha ao piquenique antes: com a boca cheia não dá para pegar o frisbee',
    ball: 'Pegue a bolinha no parquinho (E)',
    ballRhOut: 'A bolinha está no parquinho: entre pelo portão e pegue-a (E)',
    carryBall: 'Leve a bolinha até a toalha de piquenique',
    carryFrisbee: 'Leve o frisbee até a toalha de piquenique',
    carryBoth: 'Levem a bolinha e o frisbee juntas até a toalha de piquenique',
    frisbeeFirst: 'Falta o frisbee: ele está no alto do escorregador',
  },
  hint: {
    tooBig: 'A Rhaenyra é grande demais para o túnel… a Radhija cabe!',
    soaked: 'Que lamaçal! A Radhija ficou lenta e sem arrancada.',
    noDash: 'Com tanta lama, nada de arrancada! A Rhaenyra pode limpar a irmã com o Lambe-Lambe (R).',
    latchOutside: 'O trinco do portão fica do lado de dentro…',
    gateOpen: 'Portão destravado! Agora a Rhaenyra pode entrar.',
    licking: 'Isso! Continue lambendo (segure R).',
    clean: 'Limpinha! A arrancada da Radhija voltou.',
    alreadyClean: 'A Radhija já está limpinha! (mas adorou o carinho)',
    lickFar: 'Chegue pertinho da Radhija para o Lambe-Lambe (R).',
    slipMud: 'Com as patas enlameadas ela escorrega! Peça um Lambe-Lambe para a Rhaenyra (R).',
    slipWalk: 'Escorrega! Só com uma arrancada (Shift) dá para subir.',
    slipRh: 'Pesada e sem arrancada, a Rhaenyra escorrega. A Radhija sobe correndo!',
    mouthFull: 'Com a bolinha na boca não deu para pegar o frisbee. Leve a bolinha ao piquenique antes!',
    gotFrisbee: 'Frisbee na boca! Lá vem ela escorregando!',
    emptyTop: 'Lá em cima não tem mais nada… mas escorregar é divertido!',
    delivered: 'Chegou no piquenique!',
    needFrisbee: 'Falta o frisbee: ele está no alto do escorregador!',
    needBall: 'Falta a bolinha: ela está no chão do parquinho!',
    secondMouth: 'A outra irmã está de boca vazia: troque (Q) e pegue o outro objeto para levarem juntas!',
  },
  prompt: { ball: 'Pegar a bolinha', latch: 'Destravar o portão' },
};

const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const SLOPE = Math.atan2(SLIDE.deck, SLIDE.x1 - SLIDE.x0);
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
/** Altura da superfície do escorregador em x (0 no pé da rampa, `deck` no alto). */
export const slideY = (x) => SLIDE.deck * Math.min(1, Math.max(0, (x - SLIDE.x0) / (SLIDE.x1 - SLIDE.x0)));
const inRect = (r, x, z) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
const inTunnel = (c) => c.x >= TUNNEL.x0 && c.x <= TUNNEL.x1 && Math.abs(c.z - TUNNEL.z) <= TUNNEL.r;
/** Dentro do parquinho (fora do túnel). */
const insidePark = (c) => c.x > FENCE.west + 0.02 && c.z < FENCE.south - 0.02 && !inTunnel(c);
const inPuddle = (c) => PUDDLES.some((p) => {
  const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
  const dx = c.x - p.x, dz = c.z - p.z;
  const u = (cs * dx + sn * dz) / p.rx, v = (-sn * dx + cs * dz) / p.rz;
  return u * u + v * v < 1;
});

/** @param {import('../../types').PuzzleContext<import('../../types').Fase7Props>} ctx @returns {import('../../types').Puzzle} */
export function createPuzzle(ctx) {
  const { props, dogs, ctrls, root, emit, cam, place, world } = ctx;
  const hints = createHints(emit, TEXT);
  const cols = createCollectibles({ list: COLLECTIBLES, props, emit, pickupR: COLLECTIBLE_PICKUP_R });
  const effects = createDogEffects({ world, dogs });
  const mud = createMud({ dogs, emit, effects, licksToClean: MUD.licksToClean, slow: MUD.slow });
  const gate = createHingedGate({ id: 'portao', cfg: GATE, world, prop: props.gate });
  // Com o portão aberto, a companheira não volta pelo túnel (não se suja à toa): um batente só para ela.
  // Fechado, o túnel é o único caminho e fica livre. A Radhija controlada pelo jogador passa sempre.
  const tunnelPlug = world.addDynamic({
    id: 'tunel-companheira', shape: 'box', x: (TUNNEL.x0 + TUNNEL.x1) / 2, z: TUNNEL.z, hx: 0.06, hz: TUNNEL.r,
    companionOnly: true, enabled: /** @type {boolean} */ (false),
  });
  const gateMid = { x: (GATE.hinge.x + GATE.latchPost.x) / 2, z: GATE.hinge.z };
  /** @type {Record<Thing, { item: ReturnType<typeof createCarryItem>, prop: import('../../types').ItemProp }>} */
  const items = {
    ball: { item: createCarryItem({ obj: props.ball.object, dogs, scene: root, name: 'ball' }), prop: props.ball },
    frisbee: { item: createCarryItem({ obj: props.frisbee.object, dogs, scene: root, name: 'frisbee' }), prop: props.frisbee },
  };
  /** @type {Thing[]} */
  const THINGS = ['ball', 'frisbee'];
  const fresh = () => ({
    gateOpen: false, done: false, disposed: false, objKey: '', climbs: 0, slips: 0,
    /** @type {Record<Thing, Place>} */
    place: { ball: 'ground', frisbee: 'top' },
    /** @type {null | { who: import('../../types').DogName, mode: SlideMode, phase: SlidePhase, t: number, x0: number, yaw0: number, reason: string, grabbed: boolean, action?: string, slope?: number }} */
    slide: null,
    slideDt: 1 / 60,
    slipCd: 0,
    dashRecent: { radhija: 0, rhaenyra: 0 },
    puddleCd: { radhija: 0, rhaenyra: 0 },
    soakHinted: false,
  });
  const S = fresh();
  /** @type {(stage: string) => void} */
  let onStageChange = () => {};
  let lastStage = /** @type {Stage} */ ('start');
  const at = (x, z, y = 0.7) => ({ x, y, z });
  const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
  const holderOf = (thing) => items[thing].item.holder;
  const carriedBy = (name) => THINGS.find((k) => items[k].item.holder === name) || null;

  const latch = createLockedInteractable({
    id: 'trinco', x: LATCH.x, z: LATCH.z, r: LATCH.r, face: { x: GATE.latchPost.x - 0.12, z: FENCE.south }, duration: LATCH.duration, action: 'tug',
    canUse: (c) => c.z < FENCE.south - 0.05 && !S.gateOpen,
    onStart: (c) => emit('latch:start', { name: c.name, x: LATCH.x, z: LATCH.z }),
    onProgress: (k) => props.latch?.setTurn?.(k),
    onDone: () => openGate(),
  });
  function openGate({ silent = false } = {}) {
    S.gateOpen = true;
    tunnelPlug.enabled = true;
    gate.setTarget(1);
    gate.lock();
    props.latch?.setTurn?.(1);
    if (!silent) {
      emit('gate:open', { x: gateMid.x, z: gateMid.z });
      hints.now('gateOpen', 3.4, 4);
      cam?.focusShot(gateMid.x, gateMid.z - 0.3, { hold: 0.9 });
    }
    notifyStage();
  }

  // ------------------------------------------------------------------ etapa (derivada do estado)
  /** @returns {Stage} */
  function stage() {
    if (S.done) return 'done';
    if (!S.gateOpen) return insidePark(ctrls.radhija) ? 'inside' : 'start';
    if (S.place.frisbee === 'top') return mud.muddy('radhija') ? 'muddy' : 'clean';
    return 'carrying';
  }
  function notifyStage() {
    const st = stage();
    if (st !== lastStage) { lastStage = st; onStageChange(st); }
  }

  // ------------------------------------------------------------------ objetivo
  /** @param {import('../../types').DogName} activeName */
  function objective(activeName) {
    const O = TEXT.objective;
    const st = stage();
    const rad = ctrls.radhija;
    const rh = ctrls.rhaenyra;
    if (st === 'done') return { text: null, target: null, stage: st };
    if (st === 'start') {
      return activeName === 'radhija'
        ? { text: O.tunnel, target: at(TUNNEL.x0 - 0.1, TUNNEL.z, 0.75), stage: st }
        : { text: O.tunnelRh, target: at(TUNNEL.x0 - 0.1, TUNNEL.z, 0.75), stage: st };
    }
    if (st === 'inside') {
      return { text: activeName === 'radhija' ? O.latch : O.latchRh, target: at(LATCH.x, LATCH.z, 0.55), stage: st };
    }
    if (st === 'muddy') {
      if (activeName === 'radhija') return { text: O.muddyRad, target: at(rh.x, rh.z, 0.9), stage: st };
      if (!insidePark(rh) && insidePark(rad)) return { text: O.comeIn, target: at(gateMid.x, gateMid.z, 0.6), stage: st };
      return { text: O.lickRh, target: at(rad.x, rad.z, 0.75), stage: st };
    }
    if (st === 'clean') {
      const full = carriedBy('radhija');
      if (activeName === 'rhaenyra') return { text: O.climbRh, target: at(SLIDE.x0 + 0.3, SLIDE.z, 0.6), stage: st };
      if (full) return { text: O.climbFull, target: at(GOAL.x, GOAL.z, 0.6), stage: st };
      return { text: O.climb, target: at(FRISBEE.x, FRISBEE.z, FRISBEE.y + 0.25), stage: st };
    }
    // carregando (o frisbee já saiu do escorregador): o que falta levar ao piquenique
    const mine = carriedBy(activeName);
    const theirs = carriedBy(other(activeName));
    if (mine && theirs) return { text: O.carryBoth, target: at(GOAL.x, GOAL.z, 0.6), stage: st };
    if (mine) return { text: mine === 'ball' ? O.carryBall : O.carryFrisbee, target: at(GOAL.x, GOAL.z, 0.6), stage: st };
    if (S.place.ball === 'ground') {
      const c = ctrls[activeName];
      const text = insidePark(c) ? O.ball : O.ballRhOut;
      return { text, target: at(BALL.x, BALL.z, 0.35), stage: st };
    }
    if (theirs) return { text: theirs === 'ball' ? O.carryBall : O.carryFrisbee, target: at(GOAL.x, GOAL.z, 0.6), stage: st };
    return { text: O.carryFrisbee, target: at(GOAL.x, GOAL.z, 0.6), stage: st };
  }

  // ------------------------------------------------------------------ escorregador
  /** A dog `c` começa a subir (arrancada) ou escorrega (andando, enlameada ou a Rhaenyra)? */
  function tryClimb(c) {
    if (S.slide || S.slipCd > 0 || c.jumpT > 0 || effects.busy(c.name)) return;
    if (!inRect(SLIDE_ENTRY, c.x, c.z) || Math.abs(wrap(c.yaw - EAST)) > 0.8) return;
    const dashing = S.dashRecent[c.name] > 0;
    const pushing = c.animSpeed > 0.25 || c.hits?.some((h) => h.id === 'escorregador');
    if (!dashing && !pushing) return;
    if (dashing && c.name === 'radhija' && mud.canDash('radhija')) {
      S.slide = { who: c.name, mode: 'climb', phase: 'up', t: 0, x0: c.x, yaw0: c.yaw, reason: '', grabbed: false };
      S.climbs++;
      emit('slide:climb', { name: c.name, x: c.x, z: SLIDE.z });
      return;
    }
    const reason = c.name === 'rhaenyra' ? 'slipRh' : mud.muddy(c.name) ? 'slipMud' : 'slipWalk';
    S.slide = { who: c.name, mode: 'slip', phase: 'slipUp', t: 0, x0: c.x, yaw0: c.yaw, reason, grabbed: false };
    S.slips++;
    emit('slide:slip', { name: c.name, x: c.x, z: SLIDE.z, reason });
  }

  /** Pose roteirizada de quem está no escorregador (a fase move a dog: lockFor devolve drive). */
  function pose(c, x, y, yaw, speed, action, slope) {
    const px = c.x, pz = c.z;
    c.x = x;
    c.z = SLIDE.z;
    c.yaw = yaw;
    c.y = y;
    c.v = 0;
    c.dashT = 0;
    c.animSpeed = speed;
    const idt = 1 / Math.max(1e-4, S.slideDt || 1 / 60);
    c.vx = (c.x - px) * idt;
    c.vz = (c.z - pz) * idt;
    S.slide.action = action;
    S.slide.slope = slope;
  }

  function stepSlide(dt) {
    const sl = S.slide;
    if (!sl) return;
    const c = ctrls[sl.who];
    S.slideDt = dt;
    sl.t += dt;
    const T = SLIDE_TIMES;
    const top = SLIDE.x1 + 0.14;
    const grabX = FRISBEE.x - 0.34;
    if (sl.phase === 'up') {
      const u = Math.min(1, sl.t / T.climb);
      // embalada pela arrancada: quase constante, freando um pouco no alto
      const x = sl.x0 + (top - sl.x0) * (0.4 * u + 0.6 * (1 - (1 - u) * (1 - u)));
      pose(c, x, slideY(x), EAST, 3.2, 'dash', x < SLIDE.x1 ? SLOPE : SLOPE * (1 - smooth((x - SLIDE.x1) / 0.12)));
      if (u >= 1) {
        Object.assign(sl, { phase: 'grab', t: 0 });
        emit('slide:top', { name: c.name, x: c.x, y: SLIDE.deck, z: SLIDE.z });
      }
    } else if (sl.phase === 'grab') {
      const u = Math.min(1, sl.t / T.grab);
      const x = top + (grabX - top) * smooth(u / 0.6);
      pose(c, x, SLIDE.deck, EAST, u < 0.6 ? 0.6 : 0, u > 0.55 ? 'sniff' : 'none', 0);
      if (!sl.grabbed && u >= 0.7) {
        sl.grabbed = true;
        if (S.place.frisbee === 'top' && !carriedBy(c.name)) {
          items.frisbee.item.attach(c.name);
          items.frisbee.prop.setHighlight(false);
          S.place.frisbee = 'carried';
          emit('item:pickup', { name: c.name, item: 'frisbee', x: FRISBEE.x, z: FRISBEE.z });
          hints.now('gotFrisbee', 3, 0);
          notifyStage();
        } else if (S.place.frisbee === 'top') hints.now('mouthFull', 4, 0);
        else hints.now('emptyTop', 3, 6);
      }
      if (u >= 1) Object.assign(sl, { phase: 'turn', t: 0 });
    } else if (sl.phase === 'turn') {
      const u = Math.min(1, sl.t / T.turn);
      // vira pela frente (por cima do deque), de leste para oeste
      const x = grabX + (top - 0.02 - grabX) * smooth(u);
      pose(c, x, SLIDE.deck, wrap(EAST + Math.PI * smooth(u)), 0.7, 'none', 0);
      if (u >= 1) {
        Object.assign(sl, { phase: 'down', t: 0 });
        emit('slide:down', { name: c.name, x: c.x, y: SLIDE.deck, z: SLIDE.z });
      }
    } else if (sl.phase === 'down') {
      const u = Math.min(1, sl.t / T.slide);
      // acelera descendo (quase só o começo suave) e chega no pé da rampa embalada
      const k = u * u * (1.6 - 0.6 * u);
      const x = top - 0.02 + (SLIDE.x0 - 0.04 - (top - 0.02)) * k;
      pose(c, x, slideY(x) + 0.012, WEST, 0, 'slide', x > SLIDE.x1 ? -SLOPE * smooth((top - x) / 0.14) : -SLOPE);
      if (u >= 1) Object.assign(sl, { phase: 'runout', t: 0 });
    } else if (sl.phase === 'runout') {
      const u = Math.min(1, sl.t / T.runout);
      const x = SLIDE.x0 - 0.04 - 0.62 * (1 - (1 - u) * (1 - u));
      pose(c, x, 0, WEST, 0, u < 0.7 ? 'slide' : 'none', -SLOPE * (1 - smooth(u / 0.35)) * 0.6);
      if (u >= 1) finishSlide(c, true);
    } else if (sl.phase === 'slipUp') {
      const u = Math.min(1, sl.t / (T.slip * 0.45));
      const x = sl.x0 + (SLIDE.x0 + 0.42 - sl.x0) * smooth(u);
      pose(c, x, slideY(x), EAST, 1.6, 'strain', x > SLIDE.x0 ? SLOPE : 0);
      if (u >= 1) {
        Object.assign(sl, { phase: 'slipDown', t: 0 });
        emit('slide:slipBack', { name: c.name, x: c.x, z: SLIDE.z, reason: sl.reason });
      }
    } else if (sl.phase === 'slipDown') {
      const u = Math.min(1, sl.t / (T.slip * 0.55));
      const x0 = SLIDE.x0 + 0.42;
      const x = x0 + (SLIDE.x0 - 0.3 - x0) * u * u;
      pose(c, x, slideY(x), EAST, 0, 'slide', x > SLIDE.x0 ? SLOPE : 0);
      if (u >= 1) {
        hints.now(sl.reason, 3.8, 1.5);
        finishSlide(c, false);
      }
    }
  }

  function finishSlide(c, landed) {
    const res = world.resolve(c.x, SLIDE.z, c.r, c.size);
    c.x = res.x;
    c.z = res.z;
    c.y = 0;
    c.vx = c.vz = 0;
    c.v = landed ? c.cfg.walkSpeed * 0.6 : 0;
    c.animSpeed = 0;
    emit(landed ? 'slide:land' : 'slide:slipEnd', { name: c.name, x: c.x, z: c.z });
    S.slide = null;
    S.slipCd = landed ? 0.3 : 0.9;
    notifyStage();
  }

  // ------------------------------------------------------------------ entrega no piquenique
  function deliver(thing) {
    const it = items[thing];
    it.item.returnHome();
    const spot = props.goal.spot(thing);
    spot.add(it.prop.object);
    it.prop.object.position.set(0, 0, 0);
    it.prop.object.rotation.set(0, 0, 0);
    it.prop.setHighlight(false);
    S.place[thing] = 'picnic';
    emit('picnic:deliver', { item: thing, x: PICNIC_SPOTS[thing].x, z: PICNIC_SPOTS[thing].z });
  }

  // ------------------------------------------------------------------ quadro
  function update(dt, { active, ctrls: C }) {
    if (S.disposed) return null;
    hints.frame(dt);
    effects.update(dt, C);
    gate.update(dt, { ctrls: C });
    latch.update(dt);
    S.slipCd = Math.max(0, S.slipCd - dt);
    for (const n of /** @type {import('../../types').DogName[]} */ (['radhija', 'rhaenyra'])) {
      const c = C[n];
      S.dashRecent[n] = c.dashT > 0 ? 0.22 : Math.max(0, S.dashRecent[n] - dt);
      // lama: o fundo do túnel enlameia quem passa (só a Radhija cabe)
      if (inRect(MUD_ZONE, c.x, c.z) && !(S.slide?.who === n)) {
        const first = !mud.muddy(n);
        mud.soak(n, dt, c);
        if (first && n === 'radhija' && !S.soakHinted) {
          S.soakHinted = true;
          hints.now('soaked', 3.6, 0);
        }
      } else mud.leave(n);
      // poças d'água: só respingam
      S.puddleCd[n] = Math.max(0, S.puddleCd[n] - dt);
      if (S.puddleCd[n] <= 0 && c.animSpeed > 0.5 && !(c.jumpT > 0) && inPuddle(c)) {
        S.puddleCd[n] = 0.32;
        emit('puddle:splash', { name: n, x: c.x, z: c.z, speed: c.animSpeed });
      }
    }
    // a Rhaenyra empacando na boca do túnel
    const rh = C.rhaenyra;
    if (rh === active && rh.hits?.some((h) => h.id === 'boca-oeste' || h.id === 'boca-leste')) hints.cond('tooBig', 3.4, 8);
    stepSlide(dt);
    if (!S.slide && active) tryClimb(active);
    // prompts e destaques
    const mouthFree = !carriedBy(active.name);
    const nearBall = mouthFree && S.place.ball === 'ground' && reach(active, BALL.x, BALL.z) < BALL.pickupR;
    hints.setPrompt(latch.near(active) ? 'latch' : nearBall ? 'ball' : null);
    cols.update(active);
    items.ball.prop.setHighlight(S.place.ball === 'ground' && S.gateOpen);
    items.frisbee.prop.setHighlight(S.place.frisbee === 'top' && !mud.muddy('radhija') && S.gateOpen);
    props.goal.setHighlight(S.place.ball === 'carried' || S.place.frisbee === 'carried');
    // piquenique: o objeto na boca fica na toalha
    for (const thing of THINGS) {
      const holder = holderOf(thing);
      if (!holder) continue;
      const hc = C[holder];
      const d = Math.hypot(hc.x - GOAL.x, hc.z - GOAL.z);
      const leaderIn = Math.hypot(active.x - GOAL.x, active.z - GOAL.z) < GOAL.r;
      if (!(d < GOAL.r || (hc !== active && leaderIn && d < GOAL.r + 0.8))) continue;
      deliver(thing);
      const both = S.place.ball === 'picnic' && S.place.frisbee === 'picnic';
      if (!both) hints.now(S.place.frisbee === 'picnic' ? 'needBall' : S.place.frisbee === 'top' ? 'needFrisbee' : 'delivered', 3.6, 0);
    }
    const o = objective(active.name);
    const key = `${o.stage}|${o.text}`;
    if (key !== S.objKey) { S.objKey = key; onStageChange(o.stage); }
    notifyStage();
    if (!S.done && S.place.ball === 'picnic' && S.place.frisbee === 'picnic') {
      S.done = true;
      notifyStage();
      return 'delivered';
    }
    return null;
  }

  // ------------------------------------------------------------------ interação (E)
  function interact(c) {
    if (latch.near(c)) { latch.start(c); return true; }
    if (!S.gateOpen && !insidePark(c) && reach(c, LATCH.x, FENCE.south) < 0.9) { hints.now('latchOutside', 3.2, 3); return true; }
    if (!carriedBy(c.name) && S.place.ball === 'ground' && reach(c, BALL.x, BALL.z) < BALL.pickupR) {
      items.ball.item.attach(c.name);
      items.ball.prop.setHighlight(false);
      S.place.ball = 'carried';
      emit('item:pickup', { name: c.name, item: 'ball', x: BALL.x, z: BALL.z });
      if (S.place.frisbee === 'carried' && !carriedBy(other(c.name))) hints.now('secondMouth', 4.5, 30);
      notifyStage();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ Lambe-Lambe (efeito desta fase)
  /** @param {import('../../types').DogController} c @param {import('../../types').LickInfo} lick */
  function onLick(c, lick) {
    if (lick.target !== 'radhija' || !mud.muddy('radhija')) {
      hints.now('alreadyClean', 2.6, 6);
      return null;
    }
    const res = mud.lick('radhija', lick);
    if (res.cleaned) {
      hints.now('clean', 3.4, 0);
      notifyStage();
      return { stop: true };
    }
    if (lick.stroke === 1) hints.now('licking', 2.4, 8);
    return null;
  }

  // ------------------------------------------------------------------ reinício e etapas de depuração
  function reset() {
    for (const thing of THINGS) {
      items[thing].item.returnHome();
      items[thing].prop.object.visible = true;
    }
    S.slide = null;
    for (const n of /** @type {import('../../types').DogName[]} */ (['radhija', 'rhaenyra'])) ctrls[n].y = 0;
    props.reset();
    hints.reset();
    cols.reset();
    effects.reset();
    mud.reset();
    gate.reset();
    latch.reset();
    tunnelPlug.enabled = false;
    Object.assign(S, fresh());
    lastStage = 'start';
    props.latch?.setTurn?.(0);
    props.ball.setHighlight(false);
    props.frisbee.setHighlight(false);
    props.goal.setHighlight(false);
  }
  /** @param {import('../../types').DogName} who @param {Thing} thing @param {{ x: number, z: number }} near */
  function carry(who, thing, near) {
    place(who, near.x, near.z);
    items[thing].item.attach(who);
    S.place[thing] = 'carried';
  }
  /** @param {string} st @param {{ who?: import('../../types').DogName }} [opts] */
  function jumpToStage(st, { who } = {}) {
    if (!STAGES.includes(/** @type {Stage} */ (st))) return null;
    reset();
    if (st === 'start') return who || 'radhija';
    // dentro do parquinho, logo depois do túnel (enlameada)
    place('radhija', TUNNEL.x1 + 0.45, TUNNEL.z + 0.2, EAST);
    mud.set('radhija', 1);
    S.soakHinted = true;
    if (st === 'inside') return who || 'radhija';
    latch.markUsed();
    openGate({ silent: true });
    place('rhaenyra', 1.2, 0.0, -2.4);
    place('radhija', 0.6, -0.55, 2.6);
    if (st === 'muddy') return who || 'rhaenyra';
    mud.set('radhija', 0);
    place('radhija', SLIDE_ENTRY.minX - 0.6, SLIDE.z, EAST);
    if (st === 'clean') return who || 'radhija';
    carry('radhija', 'frisbee', { x: SLIDE.x0 - 0.7, z: SLIDE.z });
    if (st === 'carrying') return who || 'radhija';
    // done: os dois objetos na boca, já no piquenique
    carry('radhija', 'frisbee', { x: GOAL.x + 0.2, z: GOAL.z - 0.4 });
    carry('rhaenyra', 'ball', { x: GOAL.x - 0.3, z: GOAL.z - 0.45 });
    return who || 'radhija';
  }

  function lockFor(name) {
    const sl = S.slide;
    if (sl && sl.who === name) {
      return { action: sl.action || 'none', faceX: ctrls[name].x + Math.sin(ctrls[name].yaw), faceZ: ctrls[name].z + Math.cos(ctrls[name].yaw), drive: true, slope: sl.slope || 0 };
    }
    return latch.lockFor(name) || effects.lockFor(name);
  }

  return {
    S: hints.S, TEXT, stages: STAGES, objective, update, interact, reset, jumpToStage, lockFor,
    navFlags: () => ({ gateOpen: S.gateOpen, tunnel: !S.gateOpen }),
    lookTarget: (c) => {
      if (latch.near(c)) return at(GATE.latchPost.x - 0.12, FENCE.south, 0.5);
      if (!carriedBy(c.name) && S.place.ball === 'ground' && reach(c, BALL.x, BALL.z) < BALL.pickupR + 0.3) return at(BALL.x, BALL.z, 0.06);
      return null;
    },
    speedScale: (c) => mud.speedScale(c.name),
    canDash: (c) => mud.canDash(c.name),
    onDashBlocked: (c) => { if (mud.muddy(c.name)) hints.now('noDash', 3.6, 5); },
    onLick,
    onLickMiss: () => { if (mud.muddy('radhija')) hints.now('lickFar', 2.8, 4); },
    onBark: (c) => { if (!S.gateOpen && !insidePark(c) && reach(c, LATCH.x, FENCE.south) < 0.9) hints.now('latchOutside'); },
    setPrompt: (kind) => hints.setPrompt(kind),
    endActions() { S.slide = null; },
    dispose() { S.disposed = true; },
    info: () => ({
      lambe: {
        state: stage(), gateOpen: S.gateOpen, gate: gate.info(), latch: latch.info(), place: { ...S.place },
        mud: { radhija: mud.info('radhija'), rhaenyra: mud.info('rhaenyra') },
        slide: S.slide ? { who: S.slide.who, mode: S.slide.mode, phase: S.slide.phase, y: +ctrls[S.slide.who].y.toFixed(3) } : null,
        climbs: S.climbs, slips: S.slips,
        inside: { radhija: insidePark(ctrls.radhija), rhaenyra: insidePark(ctrls.rhaenyra) },
        effects: { radhija: effects.info('radhija'), rhaenyra: effects.info('rhaenyra') },
      },
      ball: { holder: items.ball.item.holder, x: props.ball.object.position.x, z: props.ball.object.position.z },
      frisbee: { holder: items.frisbee.item.holder, x: props.frisbee.object.position.x, z: props.frisbee.object.position.z },
      objective: objective(ctx.activeDog).text,
    }),
    get stage() { return stage(); },
    get carrier() { return items.ball.item.holder || items.frisbee.item.holder; },
    carries: (name) => carriedBy(name) !== null,
    get collected() { return cols.count; }, get total() { return cols.total; },
    set onStageChange(fn) { onStageChange = fn; },
  };
}
