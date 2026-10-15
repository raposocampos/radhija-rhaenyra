// Núcleo do jogo: gerenciador de fases + estados, entrada → controle das dogs, companheira, câmera e depuração.
// Tudo o que é específico de uma fase (layout, cenário, props, puzzle) vem da definição da fase
// (src/levels/<fase>/index.js). Ver docs/ARQUITETURA.md §3.
import * as THREE from 'three';
import { events } from '../core/events.js';
import { createInput } from './input.js';
import { createCollisionWorld } from './collision.js';
import { createNavigator } from './navigation.js';
import { createController, placeController, steer, integrate, startDash, canDash, startJump, canJump } from './dogController.js';
import { createBrain, resetBrain, companionIntent, gotoIntent, stayIntent } from './companion.js';
import { createCameraRig } from './cameraRig.js';
import { createDebugDraw } from './debugDraw.js';
import { applySeeThroughTo } from '../world/seeThrough.js';

const NAMES = ['radhija', 'rhaenyra'];
const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
const CELEBRATE_DUR = 3.1;
const PUSH_STANCE_SPEED = 1.2;
const FADE_MS = 420; // tempo para a UI cobrir a tela antes de montar a próxima fase
const nextPaint = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const FOLLOW_HOLD = 0.6; // s que a nova companheira espera (olhando) antes de seguir, após uma troca
const STAY_SOFT_PEN = 0.1; // penetração máxima da líder numa companheira em "Fica" (obstáculo macio)

// Vibração do controle por evento: [forte, fraca, ms] (curta e suave), calculada a partir do payload.
const RUMBLE = {
  'dog:bump': (p) => [0.18 + 0.3 * (p.strength || 0.3), 0.35, 90],
  'dog:dash': () => [0.05, 0.28, 70],
  'gate:open': () => [0.22, 0.18, 240],
  'sprinkler:hit': () => [0.15, 0.45, 200],
  'goose:hit': () => [0.5, 0.35, 220],
  'wedge:kick': (p) => (p.locked ? [0.35, 0.3, 160] : [0.2, 0.2, 80]),
  'crate:sink': () => [0.4, 0.2, 260],
  'plate:press': () => [0.08, 0.2, 60],
  'dog:land': () => [0.18, 0.22, 70],
};

/** Libera geometrias/texturas próprias de uma fase (materiais em cache são compartilhados). */
function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.();
  });
}

/**
 * @param {{ engine: import('../types').Engine, dogs: Record<import('../types').DogName, import('../types').DogModel>,
 *           levels: import('../types').LevelDef[], params?: URLSearchParams }} opts
 */
export function createGame({ engine, dogs, levels, params }) {
  params = params || new URLSearchParams(location.search);

  // ---------- eventos (com registro para testes) ----------
  const log = [];
  let input = null;
  const emit = (name, payload = {}) => {
    log.push({ t: Math.round(performance.now()), name, payload });
    if (log.length > 500) log.shift();
    events.emit(name, payload);
    const r = RUMBLE[name];
    if (r && input && (state === 'playing' || state === 'celebrating')) input.rumble(...r(payload));
  };

  input = createInput({ onDevice: (type) => emit('input:device', { type }) });
  const dogParam = params.get('dog');
  const initialDog = dogParam === 'rhaenyra' ? 'rhaenyra' : 'radhija';

  // ---------- estado da fase atual (recriado em loadLevel) ----------
  let levelIndex = -1;
  /** @type {import('../types').LevelDef} */
  let def = null; // definição da fase
  /** @type {import('../types').LevelLayout} */
  let L = null; // layout da fase
  let root = null; // Group com tudo o que é da fase
  let built = null; // { env, props, update, seeThrough }
  let world = null;
  let nav = null;
  let puzzle = null;
  let dbg = null;
  let cam = null;
  let ctrls = null;
  const brains = { radhija: createBrain(), rhaenyra: createBrain() };
  const anims = {};
  const lookVecs = {};
  for (const n of NAMES) {
    anims[n] = { speed: 0, turn: 0, action: 'none', lookAt: null, carrying: false, jump: 0, airK: -1 };
    lookVecs[n] = new THREE.Vector3();
  }

  let state = 'loading';
  /** @type {import('../types').DogName} */
  let activeDog = initialDog;
  const stay = { radhija: false, rhaenyra: false }; // comando Fica/Vem (só vale para a companheira)
  let playTime = 0;
  let celebrateT = 0;
  let victoryT = 0;
  let barkCd = 0;
  let loadingPromise = null;
  const cel = { radhija: {}, rhaenyra: {} };

  // ---------- passos ----------
  const steps = { radhija: { seen: false, acc: 0 }, rhaenyra: { seen: false, acc: 0 } };
  for (const n of NAMES) {
    dogs[n].onFootstep = (i) => {
      steps[n].seen = true;
      if (state !== 'playing' && state !== 'celebrating') return;
      const c = ctrls?.[n];
      if (c) emit('dog:step', { name: n, x: c.x, z: c.z, speed: c.animSpeed, foot: i });
    };
  }

  // ---------- visibilidade na tela ----------
  const ndc = new THREE.Vector3();
  function isVisible(x, z, camera = engine.camera) {
    ndc.set(x, 0.25, z).project(camera);
    return ndc.z < 1 && Math.abs(ndc.x) < 1.05 && Math.abs(ndc.y) < 1.05;
  }
  const navCtx = () => ({ nav, world, isVisible, flags: puzzle.navFlags?.() || {} });

  // ---------- info pública da fase ----------
  function levelInfo() {
    return {
      index: levelIndex,
      count: levels.length,
      id: def.id,
      number: def.number ?? levelIndex + 1,
      name: def.name,
      subtitle: def.subtitle,
      intro: def.intro,
      item: def.item,
      texts: def.texts || {},
      total: puzzle?.total ?? 0,
      hasNext: levelIndex < levels.length - 1,
    };
  }

  // ---------- estados ----------
  function emitObjective() {
    emit('objective', puzzle.objective(activeDog));
  }
  function emitSwitch() {
    emit('dog:switch', { name: activeDog, displayName: L.DOGS[activeDog].displayName });
  }

  function setState(s, { force = false } = {}) {
    if (s === state && !force) return;
    const prev = state;
    state = s;
    emit('game:state', { state, prev, level: levelIndex });
    if (s === 'playing') {
      input.latchPad(); // botões segurados no menu não vazam para o jogo
      if (prev === 'title' || prev === 'intro') cam.setMode('follow', { dur: 1.7 });
      emitObjective();
      emitSwitch();
    }
    if (s === 'title' || s === 'intro') cam.setMode('title', { dur: prev === 'loading' ? 0.01 : 1.2 });
    if (s !== 'playing') puzzle?.setPrompt?.(null);
  }

  function setStay(name, on, { silent = false } = {}) {
    on = !!on;
    if (stay[name] === on) return;
    stay[name] = on;
    resetBrain(brains[name]);
    const c = ctrls?.[name];
    if (!silent) emit('companion:stay', { name, stay: on, x: c?.x, z: c?.z });
  }

  function switchDog() {
    activeDog = other(activeDog);
    setStay(activeDog, false); // quem vira ativa perde o "fica"
    const comp = other(activeDog);
    if (!stay[comp]) {
      resetBrain(brains[comp]);
      brains[comp].holdT = FOLLOW_HOLD;
    }
    cam.onSwitch();
    emitSwitch();
    emitObjective();
  }

  /** A companheira cede: separação suave, nunca empurra a líder. */
  function separate(comp, lead, dt) {
    const dx = comp.x - lead.x;
    const dz = comp.z - lead.z;
    const d = Math.hypot(dx, dz);
    const minD = comp.r + lead.r + 0.05;
    if (d >= minD) return;
    let nx;
    let nz;
    if (d < 1e-4) {
      nx = Math.cos(lead.yaw);
      nz = -Math.sin(lead.yaw);
    } else {
      nx = dx / d;
      nz = dz / d;
    }
    const over = minD - d;
    let push = over * (1 - Math.exp(-dt * 14));
    if (over - push > minD * 0.45) push = over - minD * 0.45;
    const res = world.resolve(comp.x + nx * push, comp.z + nz * push, comp.r, comp.size);
    comp.x = res.x;
    comp.z = res.z;
  }

  function setLook(name, p) {
    if (!p) {
      anims[name].lookAt = null;
      return;
    }
    anims[name].lookAt = lookVecs[name].set(p.x, p.y ?? 0.3, p.z);
  }

  function bark(c) {
    if (barkCd > 0) return;
    barkCd = 0.35;
    dogs[c.name].triggerBark?.();
    emit('dog:bark', { name: c.name, x: c.x, z: c.z });
    puzzle.onBark?.(c);
  }

  /** A líder esbarra na companheira em "Fica" como num obstáculo macio (nunca a atravessa). */
  function softBlock(A, C, dt) {
    const dx = A.x - C.x;
    const dz = A.z - C.z;
    const d = Math.hypot(dx, dz);
    const minD = A.r + C.r + 0.02;
    if (d >= minD) return;
    let nx;
    let nz;
    if (d < 1e-4) {
      nx = -Math.sin(A.yaw);
      nz = -Math.cos(A.yaw);
    } else {
      nx = dx / d;
      nz = dz / d;
    }
    const over = minD - d;
    let push = over * (1 - Math.exp(-dt * 18));
    if (over - push > STAY_SOFT_PEN) push = over - STAY_SOFT_PEN;
    const res = world.resolve(A.x + nx * push, A.z + nz * push, A.r, A.size);
    A.x = res.x;
    A.z = res.z;
  }

  // ---------- jogo ----------
  function updatePlaying(dt) {
    playTime += dt;
    barkCd = Math.max(0, barkCd - dt);
    if (input.consume('KeyQ') && !puzzle.lockFor(activeDog)) switchDog();
    const A = ctrls[activeDog];
    const compName = other(activeDog);
    const C = ctrls[compName];
    if (input.consume('KeyF')) setStay(compName, !stay[compName]);

    // Entrada relativa à câmera (analógico: velocidade proporcional à inclinação)
    const ax = input.axis();
    const mag = Math.min(1, ax.m ?? Math.hypot(ax.x, ax.y));
    const B = cam.basis();
    let dx = B.fx * ax.y + B.rx * ax.x;
    let dz = B.fz * ax.y + B.rz * ax.x;
    const Lm = Math.hypot(dx, dz);
    if (Lm > 1e-4) {
      dx /= Lm;
      dz /= Lm;
    }
    const shift = input.shift();
    let action = 'none';
    let intent;
    const lock = puzzle.lockFor(activeDog);
    if (lock) {
      intent = { dx: 0, dz: 0, speed: 0, faceX: lock.faceX, faceZ: lock.faceZ };
      action = lock.action;
      input.consumeShift();
    } else {
      let speed = Lm > 1e-4 ? A.cfg.walkSpeed * mag : 0;
      if (A.size === 'large' && shift) {
        action = 'push';
        speed = Math.min(speed, PUSH_STANCE_SPEED);
      }
      if (A.cfg.dashSpeed && input.consumeShift() && canDash(A)) {
        startDash(A, Lm > 1e-4 ? dx : 0, Lm > 1e-4 ? dz : 0);
        emit('dog:dash', { name: A.name, x: A.x, z: A.z, dirX: A.dashDx, dirZ: A.dashDz });
      }
      // Pulo (Espaço / LT): só quem tem pulo, fora da postura de empurrar.
      if (input.consume('Space', 'Jump') && action !== 'push' && canJump(A)) {
        startJump(A, Lm > 1e-4 ? dx : 0, Lm > 1e-4 ? dz : 0);
        emit('dog:jump', { name: A.name, x: A.x, z: A.z, dirX: A.jumpDx, dirZ: A.jumpDz });
      }
      if (puzzle.carrier === A.name) speed *= 0.94;
      intent = { dx, dz, speed, turnScale: action === 'push' ? 0.7 : 1 };
      const pr = puzzle.modifyIntent?.(dt, A, intent, { shift, comp: C }) || {};
      if (pr.intent) intent = pr.intent;
      if (pr.action) action = pr.action;
    }
    if (A.dashT > 0) action = 'dash';
    if (A.jumpT > 0) action = 'jump';

    puzzle.assist?.(A, intent, dt);
    steer(A, dt, intent);
    const ra = integrate(A, dt, world);
    if (ra.bump) emit('dog:bump', { name: A.name, x: A.x, z: A.z, strength: ra.bump.strength });
    if (stay[compName]) softBlock(A, C, dt);
    anims[activeDog].action = action;

    // Companheira (modo companheira: colisores companionOnly valem só para ela)
    world.setCompanionMode?.(true);
    const compLock = puzzle.lockFor(compName);
    let ci;
    if (compLock) {
      ci = { dx: 0, dz: 0, speed: 0, faceX: compLock.faceX, faceZ: compLock.faceZ, action: compLock.action, lookAt: null };
      resetBrain(brains[compName]);
    } else if (stay[compName]) {
      ci = stayIntent(brains[compName], C, A, dt);
    } else {
      ci = companionIntent(brains[compName], C, A, navCtx(), dt);
      if (ci.teleport) {
        placeController(C, ci.teleport.x, ci.teleport.z, C.yaw);
        resetBrain(brains[compName]);
      }
      puzzle.assist?.(C, ci, dt);
    }
    steer(C, dt, ci);
    integrate(C, dt, world);
    world.setCompanionMode?.(false);
    if (!stay[compName] && !compLock) separate(C, A, dt);
    anims[compName].action = ci.action;
    setLook(compName, ci.lookAt);

    // Interações (E: interagir ou latir · X do controle: latir sempre)
    if (input.consume('KeyE') && !lock) {
      if (!puzzle.interact(A)) bark(A);
    }
    if (input.consume('Bark') && !lock) bark(A);
    const ev = puzzle.update(dt, { active: A, comp: C, ctrls, stay });
    setLook(activeDog, puzzle.lookTarget(A));
    if (ev === 'delivered') startCelebration();
  }

  // ---------- comemoração ----------
  const celebCam = engine.camera.clone();
  function startCelebration() {
    for (const n of NAMES) setStay(n, false);
    setState('celebrating');
    celebrateT = 0;
    const G = L.GOAL;
    emit('celebrate:start', { x: G.x, z: G.z, level: levelIndex });
    emit('objective', { text: null, target: null, stage: 'done' });
    cam.setMode('celebrate', { dur: 1.5 });
    puzzle.endActions?.();
    for (const n of NAMES) {
      cel[n] = { arrived: false, moved: false };
      resetBrain(brains[n]);
    }
    // Câmera virtual na pose final (para aproximar dogs distantes fora do quadro)
    celebCam.position.set(...L.CAMERA.celebrate.pos);
    celebCam.lookAt(...L.CAMERA.celebrate.look);
    celebCam.updateMatrixWorld(true);
    celebCam.updateProjectionMatrix();
  }

  function updateCelebrating(dt) {
    celebrateT += dt;
    const G = L.GOAL;
    for (const n of NAMES) {
      const c = ctrls[n];
      const st = cel[n];
      const spot = G.celebrate[n];
      const dist = Math.hypot(c.x - spot.x, c.z - spot.z);
      // Aproximação discreta: longe e fora do quadro → reaparece fora de cena, perto do objetivo.
      if (!st.moved && !st.arrived && celebrateT > 0.35 && dist > 3.2 && !isVisible(c.x, c.z)) {
        const cand = (G.entryPoints || [])
          .filter((p) => !isVisible(p.x, p.z, celebCam) && !isVisible(p.x, p.z) && !world.overlaps(p.x, p.z, c.r, c.size))
          .sort((p, q) => Math.hypot(p.x - spot.x, p.z - spot.z) - Math.hypot(q.x - spot.x, q.z - spot.z))[0];
        if (cand) {
          placeController(c, cand.x, cand.z, Math.atan2(spot.x - cand.x, spot.z - cand.z));
          resetBrain(brains[n]);
          st.moved = true;
        }
      }
      let intent;
      if (!st.arrived) {
        const gi = gotoIntent(brains[n], c, spot, navCtx(), dt, 0.12);
        // Perto o bastante depois de 2,4 s também conta; quem está longe segue andando (até na vitória).
        if (gi.arrived || (celebrateT > 2.4 && dist < 0.6)) st.arrived = true;
        intent = gi;
      }
      if (st.arrived) {
        const cp = celebCam.position;
        intent = { dx: 0, dz: 0, speed: 0, faceX: cp.x + (n === 'radhija' ? -0.6 : 0.6), faceZ: cp.z };
      }
      steer(c, dt, intent);
      integrate(c, dt, world);
      anims[n].action = st.arrived ? 'celebrate' : 'none';
      setLook(n, st.arrived ? { x: celebCam.position.x, y: 1.0, z: celebCam.position.z } : null);
    }
    if (celebrateT >= CELEBRATE_DUR) {
      setState('victory');
      victoryT = 0;
      cam.setMode('victory', { dur: 1.8 });
      emit('victory', {
        timeSec: Math.round(playTime * 10) / 10,
        collected: puzzle.collected,
        total: puzzle.total,
        level: levelIndex,
        levelId: def.id,
        hasNext: levelIndex < levels.length - 1,
        texts: def.texts || {},
      });
    }
  }

  function updateIdle(dt) {
    // title / intro / victory: dogs paradas (respirando), sem entrada.
    // Na vitória, uma dog que ainda não chegou ao seu lugar da comemoração termina o trajeto trotando.
    for (const n of NAMES) {
      const c = ctrls[n];
      const late = state === 'victory' && cel[n]?.arrived === false && L?.GOAL?.celebrate?.[n];
      if (late) {
        const gi = gotoIntent(brains[n], c, L.GOAL.celebrate[n], navCtx(), dt, 0.12);
        if (gi.arrived || victoryT > 8) cel[n].arrived = true;
        steer(c, dt, gi);
      } else steer(c, dt, { dx: 0, dz: 0, speed: 0 });
      integrate(c, dt, world);
    }
    if (state === 'title' || state === 'intro') {
      anims.radhija.action = 'none';
      anims.rhaenyra.action = 'sit';
      setLook('radhija', null);
      setLook('rhaenyra', { x: ctrls.radhija.x, y: 0.3, z: ctrls.radhija.z });
    } else if (state === 'victory') {
      victoryT += dt;
      const act = victoryT < 2.5 ? 'celebrate' : 'sit';
      for (const n of NAMES) anims[n].action = cel[n]?.arrived === false ? 'none' : act;
    }
  }

  // ---------- aplicar às dogs ----------
  function applyDogs(dt) {
    for (const n of NAMES) {
      const c = ctrls[n];
      const d = dogs[n];
      const an = anims[n];
      d.object.position.set(c.x, 0, c.z);
      d.object.rotation.y = c.yaw;
      an.speed = c.animSpeed;
      an.turn = c.yawRate;
      an.carrying = puzzle.carrier === n;
      an.jump = c.y;
      an.airK = c.jumpT > 0 ? 1 - c.jumpT / c.jumpDur : -1;
      if (c.landed) {
        // Pouso (ativa ou companheira, até depois de trocar de dog no ar).
        c.landed = false;
        if (state === 'playing' || state === 'celebrating') emit('dog:land', { name: n, x: c.x, z: c.z });
      }
      d.update?.(dt, an);
      // Plano B dos passos: cadência pela distância se a dog nunca chamou onFootstep.
      if (!steps[n].seen && (state === 'playing' || state === 'celebrating')) {
        const stride = n === 'radhija' ? 0.27 : 0.33;
        steps[n].acc += c.animSpeed * dt;
        if (c.animSpeed < 0.1) steps[n].acc = Math.min(steps[n].acc, stride * 0.6);
        if (steps[n].acc >= stride) {
          steps[n].acc -= stride;
          emit('dog:step', { name: n, x: c.x, z: c.z, speed: c.animSpeed, foot: -1 });
        }
      }
    }
  }

  /** Remove qualquer item preso no mouthSocket das duas dogs (troca de fase). */
  function emptyMouths() {
    for (const n of NAMES) {
      const sock = dogs[n]?.mouthSocket;
      if (!sock) continue;
      for (const ch of [...sock.children]) sock.remove(ch);
    }
  }

  // ---------- reset / etapas ----------
  function place(name, x, z, yaw) {
    placeController(ctrls[name], x, z, yaw ?? ctrls[name].yaw);
    resetBrain(brains[name]);
  }

  function placeStart() {
    for (const n of NAMES) {
      const s = L.DOGS[n].start;
      place(n, s.x, s.z, s.yaw);
      anims[n].action = 'none';
      anims[n].lookAt = null;
    }
  }

  function reset() {
    for (const n of NAMES) setStay(n, false, { silent: true });
    puzzle.reset();
    activeDog = initialDog;
    placeStart();
    playTime = 0;
    celebrateT = 0;
    victoryT = 0;
    const a = ctrls[activeDog];
    cam.snapFollow(a.x, a.z);
    emit('game:reset', { level: levelIndex });
  }

  /** Pula para uma etapa da fase atual (depuração/testes). */
  function setStage(st, dogName) {
    const who = puzzle.jumpToStage?.(st, { who: dogName || (dogParam === 'radhija' || dogParam === 'rhaenyra' ? dogParam : undefined) });
    if (!who) return false;
    activeDog = who;
    if (state === 'playing') {
      cam.snapFollow(ctrls[activeDog].x, ctrls[activeDog].z);
      emitObjective();
      emitSwitch();
    }
    return true;
  }

  // ---------- carregamento de fase ----------
  /**
   * Carrega a fase `index`. mode: 'title' (tela inicial sobre a fase), 'intro' (cartão da fase) ou 'play'.
   * A UI cobre a tela no 'level:loading' e revela no 'level:loaded'.
   */
  async function loadLevel(index, { mode = 'intro', initial = false } = {}) {
    if (loadingPromise) return loadingPromise;
    index = Math.max(0, Math.min(levels.length - 1, index | 0));
    loadingPromise = (async () => {
      const nextDef = levels[index];
      const prevState = state;
      state = 'loading';
      emit('game:state', { state: 'loading', prev: prevState, level: index });
      emit('level:loading', { index, count: levels.length, id: nextDef.id, number: nextDef.number ?? index + 1, name: nextDef.name, subtitle: nextDef.subtitle, initial });
      if (!initial) await sleep(FADE_MS);
      await nextPaint();

      // Devolve o item carregado à fase velha e esvazia as bocas (as dogs sobrevivem entre fases).
      try { puzzle?.reset?.(); } catch (err) { console.warn('[game] reset da fase anterior falhou', err); }
      emptyMouths();
      // Descarta a fase anterior
      if (root) {
        engine.scene.remove(root);
        disposeTree(root);
        built?.dispose?.();
        dbg?.group && engine.scene.remove(dbg.group);
      }
      puzzle?.dispose?.();
      emptyMouths();

      levelIndex = index;
      def = nextDef;
      L = def.layout;
      engine.applyLighting(def.lighting, L.WORLD.bounds);
      root = new THREE.Group();
      root.name = `fase:${def.id}`;
      engine.scene.add(root);
      built = def.build({ engine, root, layout: L, params });
      applySeeThroughTo(...(built.seeThrough || []).filter(Boolean));

      world = createCollisionWorld(L);
      nav = createNavigator(L, world);
      if (!cam) cam = createCameraRig(engine.camera, L);
      else cam.configure(L);
      if (!ctrls) ctrls = { radhija: createController('radhija', L.DOGS.radhija), rhaenyra: createController('rhaenyra', L.DOGS.rhaenyra) };
      for (const n of NAMES) setStay(n, false, { silent: true });
      puzzle = def.createPuzzle({
        layout: L, props: built.props, world, nav, dogs, ctrls, emit, cam, root, place, params, engine,
        get activeDog() { return activeDog; },
        isStaying: (n) => stay[n],
        setStay: (n, on) => setStay(n, on),
        brains,
      });
      puzzle.onStageChange = () => {
        if (state === 'playing') emitObjective();
      };
      dbg = params.has('debug') ? createDebugDraw(engine.scene, L, world, nav) : null;

      // Estado inicial da fase
      puzzle.reset();
      activeDog = initialDog;
      placeStart();
      playTime = 0;
      celebrateT = 0;
      victoryT = 0;
      const stageParam = initial ? params.get('stage') : null;
      if (stageParam && stageParam !== 'start') setStage(stageParam);
      const a = ctrls[activeDog];
      cam.snapFollow(a.x, a.z);
      applyDogs(0.016);
      engine.renderer.compile?.(engine.scene, engine.camera);

      const target = mode === 'play' ? 'playing' : mode === 'title' ? 'title' : 'intro';
      state = 'loading';
      setState(target === 'playing' ? 'intro' : target, { force: true });
      if (target === 'title' || target === 'intro') cam.setMode('title', { instant: true });
      emit('level:loaded', levelInfo());
      if (target === 'playing') setState('playing');
    })();
    try {
      await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  // ---------- eventos da UI ----------
  events.on('ui:play', () => {
    if (state === 'title' || state === 'intro') setState('playing');
  });
  events.on('ui:pause', () => {
    if (state === 'playing') setState('paused');
  });
  events.on('ui:resume', () => {
    if (state === 'paused') setState('playing');
  });
  events.on('ui:restart', () => {
    if (state === 'loading') return;
    reset();
    setState('playing', { force: true });
  });
  events.on('ui:nextLevel', () => {
    if (state === 'loading') return;
    if (levelIndex < levels.length - 1) loadLevel(levelIndex + 1, { mode: 'intro' });
    else loadLevel(0, { mode: 'title' });
  });
  events.on('ui:selectLevel', (/** @type {{ index?: number }} */ { index } = {}) => {
    if (state === 'loading' || !Number.isFinite(index)) return;
    loadLevel(index, { mode: 'intro' });
  });
  events.on('ui:menu', () => {
    if (state === 'loading') return;
    reset();
    setState('title');
  });

  // ---------- quadro ----------
  function update(dt, t) {
    input.poll();
    if (!(dt > 0) || !puzzle) {
      input.endFrame();
      return;
    }
    if (state === 'loading') {
      input.endFrame();
      return;
    }
    if (input.consume('Escape')) {
      if (state === 'playing') setState('paused');
      else if (state === 'paused') setState('playing');
    }
    if (state === 'paused') {
      input.endFrame();
      return;
    }
    if (state === 'playing') updatePlaying(dt);
    else if (state === 'celebrating') updateCelebrating(dt);
    else updateIdle(dt);
    if (state === 'playing' || state === 'celebrating') puzzle.updateAlways?.(dt);
    applyDogs(dt);
    built?.update?.(dt, t);
    const a = ctrls[activeDog];
    cam.update(dt, { t, target: { x: a.x, z: a.z, vx: a.vx, vz: a.vz } });
    dbg?.update(ctrls, brains, activeDog);
    input.endFrame();
  }

  function info() {
    const dogInfo = (n) => {
      const c = ctrls[n];
      return {
        x: +c.x.toFixed(3), z: +c.z.toFixed(3), yaw: +c.yaw.toFixed(3), v: +c.v.toFixed(3),
        speed: +c.animSpeed.toFixed(3), action: anims[n].action, carrying: puzzle.carrier === n,
        dashing: c.dashT > 0, mode: n === activeDog ? 'active' : brains[n].mode,
        path: brains[n].path.map((w) => w.id), reachable: brains[n].reachable,
        stuck: +brains[n].stuckAccum.toFixed(2), sitting: anims[n].action === 'sit',
        visible: isVisible(c.x, c.z), stay: stay[n],
        y: +c.y.toFixed(3), jumping: c.jumpT > 0,
      };
    };
    const p = engine.camera.position;
    return {
      state, stage: puzzle.stage, activeDog, level: levelIndex, levelId: def?.id,
      dogs: { radhija: dogInfo('radhija'), rhaenyra: dogInfo('rhaenyra') },
      ...(puzzle.info?.() || {}),
      carrier: puzzle.carrier, collected: puzzle.collected, total: puzzle.total,
      timeSec: +playTime.toFixed(2), prompt: puzzle.S?.prompt ?? null,
      stay: { ...stay }, input: { device: input.device, pad: input.padConnected },
      camera: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), mode: cam.mode, shot: cam.shotActive },
    };
  }

  const game = {
    get state() { return state; },
    get activeDog() { return activeDog; },
    get stage() { return puzzle?.stage; },
    get level() { return levelIndex; },
    get levelDef() { return def; },
    get levels() { return levels; },
    get puzzle() { return puzzle; },
    get built() { return built; },
    get input() { return input; },
    get stay() { return { ...stay }; },
    setStay(name, on) { if (ctrls?.[name] && name !== activeDog) setStay(name, on); },
    update,
    reset,
    loadLevel,
    debug: {
      teleport(name, x, z) {
        const c = ctrls[name];
        if (!c || !Number.isFinite(x) || !Number.isFinite(z)) return false;
        const res = world.resolve(x, z, c.r, c.size);
        placeController(c, res.x, res.z, c.yaw);
        resetBrain(brains[name]);
        return { x: res.x, z: res.z };
      },
      setStage,
      info,
      log,
      events: (name) => log.filter((e) => !name || e.name === name),
      clearLog: () => { log.length = 0; },
      get world() { return world; },
      get nav() { return nav; },
      get ctrls() { return ctrls; },
      get puzzle() { return puzzle; },
      brains,
      get cam() { return cam; },
    },
  };
  return game;
}
