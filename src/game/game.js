// Núcleo do jogo: gerenciador de fases + estados, entrada → controle das dogs, companheira, câmera e depuração.
// Tudo o que é específico de uma fase (layout, cenário, props, puzzle) vem da definição da fase
// (src/levels/<fase>/index.js). Ver docs/ARQUITETURA.md §3.
import * as THREE from 'three';
import { events } from '../core/events.js';
import { createResourceScope } from '../core/resources.js';
import { createInput } from './input.js';
import { createGameEvents } from './gameEvents.js';
import { createCollisionWorld } from './collision.js';
import { createNavigator } from './navigation.js';
import { createController, placeController, steer, integrate, startDash, canDash, startJump, canJump, airborne, pickWallSpot, startWallJump, SHOVE_GAP } from './dogController.js';
import { createBrain, resetBrain, companionIntent, gotoIntent, stayIntent } from './companion.js';
import { createCameraRig } from './cameraRig.js';
import { createDebugDraw } from './debugDraw.js';
import { applySeeThroughTo } from '../world/seeThrough.js';
import { createScentField } from './mechanics/scent.js';
import { createScentView } from '../fx/scentView.js';
import { createExtras } from './extras.js';
import { createShove } from './shove.js';
import { planCelebrateLoop } from './celebrateLoop.js';
import { DOG_PARAMS } from '../dogs/dogModel.js';

const NAMES = ['radhija', 'rhaenyra'];
const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
const CELEBRATE_DUR = 3.1;
const PUSH_STANCE_SPEED = 1.2;
const FADE_MS = 420; // tempo para a UI cobrir a tela antes de montar a próxima fase
const nextPaint = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
/** Marco de desempenho do carregamento de fase (rr:level:*; ver os marcos do boot em src/main.js). */
const markLoad = (name) => globalThis.performance?.mark?.(`rr:level:${name}`);
const FOLLOW_HOLD = 0.6; // s que a nova companheira espera (olhando) antes de seguir, após uma troca
const STAY_SOFT_PEN = 0.1; // penetração máxima da líder numa companheira em "Fica" (obstáculo macio)
// Lambe-Lambe (as duas dogs): quem lambe para a LICK_DIST m do ponto lambido (a cabeça encosta na irmã; a medida é
// a da Rhaenyra e diminui com o comprimento de quem lambe, ver lickDist), chega lá em até LICK_APPROACH s e
// desiste se a irmã ficar a mais de LICK_GIVEUP m desse lugar.
const LICK_DIST = 0.56;
const LICK_APPROACH = 0.8;
const LICK_GIVEUP = 0.7;
const LICK_SOLO = 0.3; // cada lambidinha no próprio focinho (ninguém por perto)
const LICK_LOS_R = 0.05; // linha entre as duas: cerca, portão fechado ou parede no meio impedem a lambida
const LICK_HINT = 'Lambe-Lambe: chegue pertinho da irmã e segure (L).';
/** Distância de quem lambe até o ponto lambido: a Radhija, mais curta, chega mais perto. */
const lickDist = (c) => LICK_DIST * Math.min(1, (c.cfg.visual?.length ?? 0.72) / 0.72);
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * @param {{ engine: import('../types').Engine, dogs: Record<import('../types').DogName, import('../types').DogModel>,
 *           levels: import('../types').LevelDef[], params?: URLSearchParams }} opts
 */
export function createGame({ engine, dogs, levels, params }) {
  params = params || new URLSearchParams(location.search);

  // ---------- eventos (com registro para testes) ----------
  let input = null;
  const gameEvents = createGameEvents({
    dispatch: (name, ...args) => events.emit(name, ...args),
    now: () => performance.now(),
    rumble: (pattern) => {
      if (input && (state === 'playing' || state === 'celebrating')) input.rumble(...pattern());
    },
  });
  const { emit } = gameEvents;

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
  let resources = null; // escopo criado antes de build, inclusive para montagem parcial
  /** @type {import('../types').LevelBuild} */
  let built = null; // { env, props, update, seeThrough }
  let world = null;
  let nav = null;
  let puzzle = null;
  let dbg = null;
  let cam = null;
  let scent = null; // cheiro do superbafo (recriado por fase)
  let ctrls = null;
  const brains = { radhija: createBrain(), rhaenyra: createBrain() };
  const anims = {};
  const lookVecs = {};
  for (const n of NAMES) {
    anims[n] = { speed: 0, turn: 0, action: 'none', lookAt: null, carrying: false, jump: 0, airK: -1, lickPhase: -1, lickSide: 1, lickSolo: false, celebrateSide: 1, celebrateLoop: 1, lickY: -1, slope: 0, wallK: -1, wallGap: 0, wallTop: 0, wallOut: 0, wallPaws: 0, wallSide: 0, wallLat: 0, shoveK: 0, shoveCycle: -1, shoveN: 0, shoveGap: 0, shoveY: 0, shoveOver: 0, poopK: -1, poopPre: -1, party: null, cheer: -1, extra: null };
    lookVecs[n] = new THREE.Vector3();
  }
  /** Travas do quadro (puzzle.lockFor) — applyDogs usa a inclinação de uma pose roteirizada. */
  const locks = { radhija: null, rhaenyra: null };
  /** Extras (src/game/extras.js): criados com os controladores, refeitos a cada fase. */
  let extras = null;

  /** @type {import('../types').GameState} */
  let state = 'loading';
  /** @type {import('../types').DogName} */
  let activeDog = initialDog;
  const stay = { radhija: false, rhaenyra: false }; // comando Fica/Vem (só vale para a companheira)
  let playTime = 0;
  let simTime = 0; // segundos simulados desde o início (todo quadro com dt > 0; só para testes: debug.info().simSec)
  let celebrateT = 0;
  let victoryT = 0;
  let barkCd = 0;
  let jumpHintCd = 0; // dica "só a Rhaenyra pula"
  let loadingPromise = null;
  let loadFailure = null;
  const cel = { radhija: {}, rhaenyra: {} };
  // Superbafo (só quem tem cfg.bafoSpeed, a Radhija; R / R2): segurar mira, soltar sopra.
  const bafo = { held: false, aiming: false, cd: 0, blowT: 0, proudT: 0, hintCd: 0 };
  // Lambe-Lambe (quem tem cfg.lickStroke: as duas; L / L2): perto da irmã, segurar lambe em ritmo.
  // stage 'approach' (encosta) → 'licking' (phase 0..1 por lambida; o contato é em 0,5).
  const lick = {
    on: false, held: false, stage: 'approach', t: 0, phase: 0, strokes: 0, release: false, stop: false, solo: false, by: null, target: null,
    hintCd: 0, dist: LICK_DIST, spot: { x: 0, z: 0 }, point: { x: 0, y: 0.3, z: 0 }, local: { x: 0, y: 0.3, z: 0 },
  };
  const yuck = { radhija: { t: 0, cd: 0 }, rhaenyra: { t: 0, cd: 0 } }; // "eca!" perto de uma nuvem
  // Empurrão em pé (só a Rhaenyra, Shift · R1 seguro de frente para algo empurrável no alto): escolha do alvo e cada
  // empurrão (src/game/shove.js); o roteiro é do controlador.
  const shove = createShove({ emit });

  // ---------- passos ----------
  const steps = { radhija: { seen: false, acc: 0 }, rhaenyra: { seen: false, acc: 0 } };
  for (const n of NAMES) {
    dogs[n].onFootstep = (i, v = 0) => {
      steps[n].seen = true;
      if (state !== 'playing' && state !== 'celebrating') return;
      const c = ctrls?.[n];
      // na voltinha da comemoração ela anda com o controle parado no lugar: vale a passada da animação
      const speed = state === 'celebrating' ? Math.max(c?.animSpeed || 0, v) : c?.animSpeed;
      if (c) emit('dog:step', { name: n, x: c.x, z: c.z, speed, foot: i });
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
  /** @returns {import('../types').LevelInfo} */
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
      ambience: def.ambience,
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

  /** @param {import('../types').GameState} s */
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
    if (s !== 'playing') cancelBafo();
    // A pausa congela a lambida (nada avança); as outras telas a encerram.
    if (s !== 'playing' && s !== 'paused') cancelLick();
    // Fora da partida (comemoração, vitória…), quem está de pé termina o empurrão em curso e desce.
    if (s !== 'playing' && s !== 'paused') for (const n of NAMES) if (ctrls?.[n]) ctrls[n].shoveHeld = false;
  }

  function cancelBafo() {
    bafo.aiming = false;
    bafo.blowT = 0;
    bafo.proudT = 0;
    scent?.hidePreview();
  }

  function cancelLick() {
    if (lick.on && !lick.solo) emit('lick:end', { name: lick.by, target: lick.target, strokes: lick.strokes });
    lick.on = false;
    lick.solo = false;
    lick.target = null;
    for (const n of NAMES) {
      anims[n].lickPhase = -1;
      anims[n].lickY = -1;
    }
  }

  /**
   * Onde a dog A lambe a irmã C: o ponto do corpo de C mais perto de A (da garupa à bochecha, ou o focinho se A
   * estiver bem na frente), no referencial de C (local) e no mundo (point), e o lugar onde A para (spot), a `dist` m
   * desse ponto, do lado em que ela já está. As medidas seguem o tamanho de C (a Radhija é a referência).
   */
  function lickContact(A, C, dist) {
    const cs = Math.cos(C.yaw);
    const sn = Math.sin(C.yaw);
    const ox = A.x - C.x;
    const oz = A.z - C.z;
    let lx = cs * ox - sn * oz;
    const lz = sn * ox + cs * oz;
    if (Math.abs(lx) < 1e-3) lx = 1e-3;
    const len = C.cfg.visual?.length ?? 0.6;
    const k = len / 0.6; // a Radhija é a referência das medidas do modelo
    const front = lz > len * 0.5 && Math.abs(lx) < len * 0.35;
    const z = front ? len * 0.55 : Math.max(-len * 0.33, Math.min(len * 0.37, lz));
    const side = Math.sign(lx);
    const head = sstep(len * 0.18, len * 0.38, z);
    // a irmã menor (a Radhija na Rhaenyra) lambe a cabeça mais embaixo: queixo, canto da boca, bochecha baixa
    const low = (A.cfg.visual?.headTop ?? 0.5) < (C.cfg.visual?.headTop ?? 0.5) - 0.02;
    // flanco (0,1 m do eixo, na altura do dorso) → bochecha (0,06 m, perto do centro da cabeça) → focinho
    const local = front
      ? { x: 0, y: (low ? 0.32 : 0.38) * k, z }
      : { x: side * (0.1 - 0.04 * head) * k, y: (C.cfg.visual?.shoulder ?? 0.3) * (0.95 + (low ? 0.18 : 0.33) * head), z };
    const point = { x: C.x + cs * local.x + sn * local.z, y: local.y, z: C.z - sn * local.x + cs * local.z };
    let nx = A.x - point.x;
    let nz = A.z - point.z;
    let d = Math.hypot(nx, nz);
    if (d < 1e-3) {
      nx = cs * side;
      nz = -sn * side;
      d = 1;
    }
    const spot = world.resolve(point.x + (nx / d) * dist, point.z + (nz / d) * dist, A.r, A.size);
    return { local, point, spot: { x: spot.x, z: spot.z } };
  }

  /** Nada entre as duas (cerca, portão fechado, parede): uma linha fina de uma à outra está livre. */
  const lickClear = (A, C) => world.segmentClear(A.x, A.z, C.x, C.z, LICK_LOS_R, A.size);

  /** L / L2 (as duas dogs): começa o Lambe-Lambe (ou a lambidinha no focinho, sem ninguém por perto). */
  function startLick(A, C) {
    const declared = typeof puzzle.onLick === 'function';
    const reach = A.cfg.lickReach ?? 1.5;
    const mouthFull = carries(A.name);
    const near = !mouthFull && Math.hypot(C.x - A.x, C.z - A.z) <= reach;
    const blocked = near && !lickClear(A, C);
    const canLick = near && !blocked && !puzzle.lockFor(C.name) && !airborne(C);
    if (mouthFull) {
      if (lick.hintCd <= 0) {
        lick.hintCd = 4;
        emit('hint', { text: 'Com a boca ocupada não dá para lamber!', duration: 2.6 });
      }
      return;
    }
    if (!canLick) {
      // fases sem efeito de lambida: a dica do núcleo ensina o alcance; as outras dão a própria (onLickMiss)
      if (declared) puzzle.onLickMiss?.(A, { blocked });
      else if (lick.hintCd <= 0) {
        lick.hintCd = 6;
        emit('hint', { text: LICK_HINT, duration: 3.2 });
      }
      Object.assign(lick, { on: true, solo: true, stage: 'licking', t: 0, phase: 0, strokes: 0, release: true, stop: false, by: A.name, target: null });
      return;
    }
    lick.dist = lickDist(A);
    const c = lickContact(A, C, lick.dist);
    Object.assign(lick, { on: true, solo: false, stage: 'approach', t: 0, phase: 0, strokes: 0, release: false, stop: false, by: A.name, target: C.name });
    lick.local = c.local;
    lick.point = c.point;
    lick.spot = c.spot;
    emit('lick:start', { name: A.name, target: C.name, x: c.point.x, y: c.point.y, z: c.point.z });
  }

  /**
   * Um quadro do Lambe-Lambe (A, a dog ativa, lambe C). Devolve a intenção de A, ou null se acabou.
   * Cada lambida chega à irmã no meio do ciclo: emite dog:lick e avisa a fase (puzzle.onLick).
   */
  function stepLick(A, C, dt, held) {
    if (!held) lick.release = true;
    lick.t += dt;
    if (lick.solo) {
      const before = lick.phase;
      lick.phase += dt / LICK_SOLO;
      const nose = Math.min(0.45, (A.cfg.visual?.headTop ?? 0.56) * 0.82);
      if (before < 0.5 && lick.phase >= 0.5) emit('dog:lick', { name: A.name, target: null, x: A.x, y: nose, z: A.z, stroke: lick.strokes + 1 });
      if (lick.phase >= 1) {
        lick.strokes++;
        lick.phase -= 1;
        if (lick.strokes >= 2) {
          cancelLick();
          return null;
        }
      }
      return { dx: 0, dz: 0, speed: 0 };
    }
    // A irmã ocupada (sacudindo, empurrada…), longe demais, ou a boca ficou ocupada (pegou um objeto): encerra.
    if (puzzle.lockFor(C.name) || Math.hypot(C.x - lick.spot.x, C.z - lick.spot.z) > lick.dist + LICK_GIVEUP || carries(A.name)) {
      cancelLick();
      return null;
    }
    // O ponto lambido acompanha a irmã (ela fica parada, mas pode ter sido empurrada um pouco).
    const cs = Math.cos(C.yaw);
    const sn = Math.sin(C.yaw);
    lick.point.x = C.x + cs * lick.local.x + sn * lick.local.z;
    lick.point.z = C.z - sn * lick.local.x + cs * lick.local.z;
    if (lick.stage === 'approach') {
      const dx = lick.spot.x - A.x;
      const dz = lick.spot.z - A.z;
      const d = Math.hypot(dx, dz);
      // já na distância certa do ponto (qualquer ângulo), só vira e lambe; senão vai até o lugar dela
      const radial = Math.abs(Math.hypot(A.x - lick.point.x, A.z - lick.point.z) - lick.dist);
      if (d > 0.05 && radial > 0.06 && lick.t < LICK_APPROACH) {
        return { dx: dx / d, dz: dz / d, speed: Math.min(A.cfg.walkSpeed * 0.8, Math.max(0.35, d * 5)) };
      }
      if (Math.hypot(A.x - lick.point.x, A.z - lick.point.z) > lick.dist + 0.35) {
        cancelLick();
        return null;
      }
      lick.stage = 'licking';
      lick.phase = 0;
    }
    const before = lick.phase;
    lick.phase += dt / (A.cfg.lickStroke ?? 0.44);
    if (before < 0.5 && lick.phase >= 0.5) {
      lick.strokes++;
      emit('dog:lick', { name: A.name, target: C.name, x: lick.point.x, y: lick.point.y, z: lick.point.z, stroke: lick.strokes });
      const res = puzzle.onLick?.(A, { target: C.name, stroke: lick.strokes, point: { ...lick.point }, local: { ...lick.local } });
      if (res && res.stop) lick.stop = true;
    }
    if (lick.phase >= 1) {
      lick.phase -= 1;
      if (lick.release || lick.stop) {
        cancelLick();
        return null;
      }
    }
    return { dx: 0, dz: 0, speed: 0, faceX: lick.point.x, faceZ: lick.point.z };
  }

  /** Boca da dog (onde nasce a nuvem do bafo). */
  const mouthOf = (c) => ({ x: c.x + Math.sin(c.yaw) * 0.36, z: c.z + Math.cos(c.yaw) * 0.36 });
  const bafoShot = (c) => {
    const m = mouthOf(c);
    return { x: m.x, z: m.z, dirX: Math.sin(c.yaw), dirZ: Math.cos(c.yaw), speed: c.cfg.bafoSpeed, life: c.cfg.bafoLife ?? 5 };
  };

  function blow(c) {
    bafo.aiming = false;
    scent.hidePreview();
    const shot = bafoShot(c);
    scent.spawn(shot);
    emit('dog:bafo', { name: c.name, x: shot.x, z: shot.z, dirX: shot.dirX, dirZ: shot.dirZ });
    bafo.cd = c.cfg.bafoCooldown ?? 0.8;
    bafo.blowT = 0.45;
    bafo.proudT = 1.9;
  }

  /** Rhaenyra perto de uma nuvem: vira a cara e abana o focinho ("eca!"); só enquanto não está andando. */
  function reactToScent(n, dt) {
    const c = ctrls[n];
    const Y = yuck[n];
    Y.cd = Math.max(0, Y.cd - dt);
    const cloud = n === 'rhaenyra' ? scent.near(c.x, c.z, 0.45) : null;
    if (cloud) {
      if (Y.t <= 0 && Y.cd <= 0) {
        Y.cd = 2.5;
        emit('dog:yuck', { name: n, x: c.x, z: c.z });
      }
      Y.t = 1.0;
      Y.fromX = cloud.x;
      Y.fromZ = cloud.z;
    }
    if (Y.t <= 0) return;
    Y.t -= dt;
    if (c.animSpeed > 0.4 || (anims[n].action && anims[n].action !== 'none' && anims[n].action !== 'sit')) return;
    anims[n].action = 'yuck';
    const ax = c.x - Y.fromX;
    const az = c.z - Y.fromZ;
    const L = Math.hypot(ax, az) || 1;
    setLook(n, { x: c.x + (ax / L) * 1.5, y: 0.45, z: c.z + (az / L) * 1.5 });
  }

  /** A dog leva algo na boca? Fases com dois itens respondem por dog (puzzle.carries). */
  function carries(name) {
    return puzzle?.carries ? puzzle.carries(name) : puzzle?.carrier === name;
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
    cancelBafo();
    cancelLick();
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
    jumpHintCd = Math.max(0, jumpHintCd - dt);
    if (input.consume('KeyQ') && !puzzle.lockFor(activeDog) && !extras.busy(activeDog)) switchDog();
    const A = ctrls[activeDog];
    const compName = other(activeDog);
    const C = ctrls[compName];
    if (input.consume('KeyF')) setStay(compName, !stay[compName]);
    if (input.consume('KeyC')) {
      extras.tryPoop(A, {
        allTreats: puzzle.total > 0 && puzzle.collected >= puzzle.total,
        free: !puzzle.lockFor(activeDog) && !lick.on && !bafo.aiming && !(bafo.blowT > 0) && !A.shove,
      });
    }

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
    const lock = extras.lockFor(activeDog) || puzzle.lockFor(activeDog);
    locks[activeDog] = lock;
    let standing = false;
    if (lock) {
      intent = { dx: 0, dz: 0, speed: 0, faceX: lock.faceX, faceZ: lock.faceZ };
      action = lock.action;
      input.consumeShift();
      standing = shove.frame(A, C, { held: false });
    } else {
      // Uma fase pode deixar a dog mais lenta (lama: puzzle.speedScale) ou sem arrancada (puzzle.canDash).
      let speed = Lm > 1e-4 ? A.cfg.walkSpeed * mag * (puzzle.speedScale?.(A) ?? 1) : 0;
      if (A.size === 'large' && shift) {
        action = 'push';
        speed = Math.min(speed, PUSH_STANCE_SPEED);
      }
      // lambendo, a arrancada não sai (o toque é consumido)
      if (A.cfg.dashSpeed && input.consumeShift() && !lick.on) {
        if (puzzle.canDash?.(A) === false) {
          emit('dog:dashBlocked', { name: A.name, x: A.x, z: A.z });
          puzzle.onDashBlocked?.(A);
        } else if (canDash(A)) {
          startDash(A, Lm > 1e-4 ? dx : 0, Lm > 1e-4 ? dz : 0);
          emit('dog:dash', { name: A.name, x: A.x, z: A.z, dirX: A.dashDx, dirZ: A.dashDz });
        }
      }
      // Empurrão em pé: segurando o empurrar de frente para algo empurrável no alto (puzzle.shoveSpots), a Rhaenyra
      // fica de pé e empurra no ritmo enquanto o botão estiver seguro (lambendo, não começa).
      standing = shove.frame(A, C, {
        held: shift && !lick.on, dx: Lm > 1e-4 ? dx : 0, dz: Lm > 1e-4 ? dz : 0, spots: puzzle.shoveSpots?.(), world,
      });
      // Pulo (Espaço / ✕): só quem tem pulo, fora da postura de empurrar. Quem não pula ganha a dica.
      // De frente para uma parede marcada que a fase oferece (puzzle.wallSpots), vira impulso na parede.
      const jumpPressed = input.consume('Space', 'Jump');
      if (jumpPressed && action !== 'push' && !lick.on && canJump(A)) {
        const spot = pickWallSpot(A, puzzle.wallSpots?.(), Lm > 1e-4 ? dx : 0, Lm > 1e-4 ? dz : 0, world);
        if (spot) {
          startWallJump(A, spot);
          emit('dog:wallJump', { name: A.name, id: spot.id, x: A.x, z: A.z, top: spot.top });
        } else {
          startJump(A, Lm > 1e-4 ? dx : 0, Lm > 1e-4 ? dz : 0);
          emit('dog:jump', { name: A.name, x: A.x, z: A.z, dirX: A.jumpDx, dirZ: A.jumpDz });
        }
      } else if (jumpPressed && !A.cfg.jumpHeight && jumpHintCd <= 0) {
        jumpHintCd = 6;
        emit('hint', { text: 'Só a Rhaenyra pula! (Q)', duration: 2.6 });
      }
      if (carries(A.name)) speed *= 0.94;
      if (standing) {
        intent = { dx: 0, dz: 0, speed: 0 };
        action = 'shove';
      } else {
        intent = { dx, dz, speed, turnScale: action === 'push' ? 0.7 : 1 };
        const pr = puzzle.modifyIntent?.(dt, A, intent, { shift, comp: C }) || {};
        if (pr.intent) intent = pr.intent;
        if (pr.action) action = pr.action;
      }
    }
    // Superbafo (R / R2): segurando, a Radhija para e mira (gira com o analógico, prévia no chão); soltou, sopra.
    // Lambendo, o bafo não começa (e mirando ou soprando, a lambida também não).
    const bafoHeld = input.bafo();
    const lickHeld = input.lick();
    bafo.cd = Math.max(0, bafo.cd - dt);
    bafo.hintCd = Math.max(0, bafo.hintCd - dt);
    if (A.cfg.bafoSpeed && !lock) {
      if (bafoHeld && !bafo.held && !bafo.aiming && bafo.cd <= 0 && !(A.jumpT > 0) && A.dashT <= 0 && !lick.on) {
        bafo.aiming = true;
        bafo.proudT = 0;
        emit('bafo:aim', { name: A.name, x: A.x, z: A.z });
      }
      if (bafo.aiming) {
        const fx = Lm > 1e-4 ? dx : Math.sin(A.yaw);
        const fz = Lm > 1e-4 ? dz : Math.cos(A.yaw);
        intent = { dx: 0, dz: 0, speed: 0, faceX: A.x + fx, faceZ: A.z + fz };
        action = 'bafoAim';
        scent.showPreview(scent.preview(bafoShot(A)));
        if (!bafoHeld) blow(A);
      }
    } else if (bafoHeld && !bafo.held && !A.cfg.bafoSpeed && bafo.hintCd <= 0) {
      bafo.hintCd = 6;
      emit('hint', { text: 'Só a Radhija tem o superbafo! (Q)', duration: 2.6 });
    }
    // Lambe-Lambe (L / L2, as duas dogs): pertinho da irmã, segurar lambe em ritmo.
    lick.hintCd = Math.max(0, lick.hintCd - dt);
    if (A.cfg.lickStroke && !lock) {
      if (lickHeld && !lick.held && !lick.on && !airborne(A) && !A.shove && A.dashT <= 0 && !bafo.aiming && !(bafo.blowT > 0)) startLick(A, C);
      if (lick.on) {
        const li = stepLick(A, C, dt, lickHeld);
        if (li) {
          intent = li;
          action = 'lick';
        }
      }
    } else if (lick.on) cancelLick();
    bafo.held = bafoHeld;
    lick.held = lickHeld;
    if (bafo.blowT > 0) {
      bafo.blowT -= dt;
      intent = { dx: 0, dz: 0, speed: 0 };
      action = 'bafo';
    } else if (bafo.proudT > 0) {
      bafo.proudT -= dt;
      if (action === 'none' && A.animSpeed < 0.3 && Lm < 1e-4) action = 'proud';
    }
    if (A.dashT > 0) action = 'dash';
    if (A.jumpT > 0) action = 'jump';
    if (A.wallDur > 0) action = 'wallJump';
    if (A.shove) action = 'shove';

    puzzle.assist?.(A, intent, dt);
    // Pose roteirizada (lock.drive): a fase move a dog (subir o escorregador…); o núcleo não a desloca.
    if (!lock?.drive) {
      steer(A, dt, intent);
      const ra = integrate(A, dt, world);
      if (ra.bump) emit('dog:bump', { name: A.name, x: A.x, z: A.z, strength: ra.bump.strength });
    }
    if (stay[compName] && lick.target !== compName) softBlock(A, C, dt);
    anims[activeDog].action = action;

    // Companheira (modo companheira: colisores companionOnly valem só para ela)
    world.setCompanionMode?.(true);
    const compLock = extras.lockFor(compName) || puzzle.lockFor(compName);
    locks[compName] = compLock;
    const licked = lick.on && lick.target === compName;
    let ci;
    if (compLock) {
      // uma trava pode pedir um passo (compLock.move: a irmã dando espaço no cocô), com colisão normal
      const mv = compLock.move;
      ci = { dx: mv?.dx ?? 0, dz: mv?.dz ?? 0, speed: mv?.speed ?? 0, faceX: compLock.faceX, faceZ: compLock.faceZ, action: compLock.action, lookAt: null };
      resetBrain(brains[compName]);
    } else if (licked) {
      // Recebendo o Lambe-Lambe: para onde está, vira a cabeça um pouco para a irmã (sem esconder o lugar
      // lambido) e fecha os olhos a cada lambida. Lambida pela irmã menor, a Rhaenyra abaixa a cabeça para ela.
      const hx = A.x + Math.sin(A.yaw) * 0.4;
      const hz = A.z + Math.cos(A.yaw) * 0.4;
      const fx = C.x + Math.sin(C.yaw) * 0.7;
      const fz = C.z + Math.cos(C.yaw) * 0.7;
      const lookY = A.size === 'small' && C.size !== 'small' ? 0.3 : 0.4;
      ci = { dx: 0, dz: 0, speed: 0, action: lick.stage === 'licking' ? 'licked' : 'none', lookAt: { x: fx + (hx - fx) * 0.4, y: lookY, z: fz + (hz - fz) * 0.4 } };
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
    if (!compLock && !licked && ci.speed) ci.speed *= puzzle.speedScale?.(C) ?? 1;
    if (!compLock?.drive) {
      steer(C, dt, ci);
      integrate(C, dt, world);
    }
    world.setCompanionMode?.(false);
    if (!stay[compName] && !compLock && !licked) separate(C, A, dt);
    anims[compName].action = ci.action;
    setLook(compName, ci.lookAt);
    // Fase da lambida para as duas animações (a língua e o "ai, que bom" ficam no mesmo ritmo).
    const lp = lick.on && lick.stage === 'licking' ? Math.min(lick.phase, 0.999) : -1;
    anims[activeDog].lickPhase = lick.on ? lp : -1;
    anims[compName].lickPhase = licked ? lp : -1;
    anims[activeDog].lickSide = anims[compName].lickSide = lick.strokes % 2 ? 1 : -1;
    anims[activeDog].lickSolo = lick.on && lick.solo;
    anims[compName].lickSolo = false;
    // altura do ponto lambido (a Radhija estica o pescoço para a bochecha da irmã maior)
    anims[activeDog].lickY = lick.on && !lick.solo ? lick.point.y : -1;
    anims[compName].lickY = -1;

    // Interações (E: interagir ou latir · X do controle: latir sempre)
    if (input.consume('KeyE') && !lock && !A.shove) {
      if (!puzzle.interact(A) && !extras.interact(A, puzzle.navFlags?.() || {}, !bafo.aiming && !(bafo.blowT > 0) && !lick.on)) bark(A);
    }
    if (input.consume('Bark') && !lock) bark(A);
    const ev = puzzle.update(dt, { active: A, comp: C, ctrls, stay });
    extras.update(dt);
    setLook(activeDog, lick.on && !lick.solo ? lick.point : A.shove?.look || puzzle.lookTarget(A));
    for (const n of NAMES) reactToScent(n, dt);
    if (ev === 'delivered') startCelebration();
  }

  // ---------- comemoração ----------
  const celebCam = engine.camera.clone();
  function startCelebration() {
    extras?.cancel();
    for (const n of NAMES) setStay(n, false);
    setState('celebrating');
    celebrateT = 0;
    const G = L.GOAL;
    emit('celebrate:start', { x: G.x, z: G.z, level: levelIndex });
    emit('objective', { text: null, target: null, stage: 'done' });
    cam.setMode('celebrate', { dur: 1.5 });
    puzzle.endActions?.();
    for (const n of NAMES) {
      cel[n] = { arrived: false, moved: false, loop: null };
      resetBrain(brains[n]);
    }
    // Câmera virtual na pose final (para aproximar dogs distantes fora do quadro)
    celebCam.position.set(...L.CAMERA.celebrate.pos);
    celebCam.lookAt(...L.CAMERA.celebrate.look);
    celebCam.updateMatrixWorld(true);
    celebCam.updateProjectionMatrix();
  }

  /** A voltinha da comemoração do lado e do tamanho que cabem ali, com a dog olhando para yaw (celebrateLoop.js). */
  function setCelebrateLoop(n, yaw) {
    if (!cel[n].loop) {
      const c = ctrls[n];
      const o = n === 'radhija' ? 'rhaenyra' : 'radhija';
      cel[n].loop = planCelebrateLoop({
        x: c.x, z: c.z, r: c.r, size: c.size, s: DOG_PARAMS[n]?.s ?? 1, yaw,
        sister: { ...L.GOAL.celebrate[o], r: ctrls[o].r }, rim: L.GOAL.celebrateRim, overlaps: world.overlaps,
      });
    }
    anims[n].celebrateSide = cel[n].loop.side;
    anims[n].celebrateLoop = cel[n].loop.loop;
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
        // a voltinha (do lado longe da irmã e do tamanho que cabe), já virada para onde ela vai olhar
        setCelebrateLoop(n, Math.atan2(intent.faceX - c.x, intent.faceZ - c.z));
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
        if (gi.arrived || victoryT > 8) {
          cel[n].arrived = true;
          setCelebrateLoop(n, c.yaw);
        }
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
      an.carrying = carries(n);
      an.poopK = extras ? extras.poopK(n) : -1;
      an.poopPre = extras ? extras.poopPre(n) : -1;
      an.party = extras ? extras.party(n) : null;
      an.cheer = extras ? extras.cheer(n) : -1;
      an.extra = extras ? extras.extraAnim(n) : null;
      const W = c.wallDur > 0 ? c.wall : null;
      an.jump = W ? 0 : c.y;
      an.airK = c.jumpT > 0 ? 1 - c.jumpT / c.jumpDur : locks[n]?.airK ?? -1;
      an.crouch = locks[n]?.crouch ?? 0;
      an.wallK = W ? Math.min(1, c.wallT / c.wallDur) : -1;
      an.wallGap = W ? (c.x - W.x) * W.nx + (c.z - W.z) * W.nz : 0;
      an.wallTop = W ? W.top : 0;
      an.wallOut = W ? W.out ?? 0.05 : 0;
      an.wallPaws = W ? W.paws ?? W.top - 0.07 : 0;
      an.wallSide = W ? W.side ?? 0.165 : 0;
      an.wallLat = W ? W.lat ?? 0 : 0;
      if (W) an.action = 'wallJump'; // também como companheira (trocou de dog no meio do impulso)
      // Empurrão em pé: de pé (0..1), o ciclo de empurrão e onde as patas apoiam (o último ponto fica para a descida)
      const SV = c.shove;
      an.shoveK = SV ? c.shoveK : 0;
      an.shoveCycle = SV && c.shoveStage === 'push' ? c.shoveCycle : -1;
      an.shoveN = c.shoveN;
      if (SV) {
        // a pose é a do lugar onde ela fica encostada (enquanto chega, o corpo vem junto com o centro)
        an.shoveGap = c.r + SHOVE_GAP;
        an.shoveY = SV.y;
        an.shoveOver = SV.over ?? 0;
        an.action = 'shove'; // também como companheira (trocou de dog no meio do empurrão)
      }
      if (c.shoveHit) {
        // As patas empurraram (um por ciclo; ativa ou companheira): o tum, a rosnadinha e o puzzle.
        shove.hit(c, { puzzle, ctrls, playing: state === 'playing' });
      }
      an.slope = state === 'playing' || state === 'paused' ? locks[n]?.slope ?? 0 : 0;
      if (c.wallHit) {
        // Impulso na parede: as patas alcançaram o alto (uma vez por impulso; ativa ou companheira).
        const spot = c.wallHit;
        c.wallHit = null;
        if (state === 'playing' || state === 'celebrating') {
          emit('wall:touch', { name: n, id: spot.id, x: spot.x + spot.nx * 0.08, y: spot.top, z: spot.z + spot.nz * 0.08 });
          if (state === 'playing') puzzle.onWallTouch?.(c, spot);
        }
      }
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
  function emptyMouths(destination = null) {
    for (const n of NAMES) {
      const sock = dogs[n]?.mouthSocket;
      if (!sock) continue;
      for (const ch of [...sock.children]) {
        // Se reset falhou, o item ainda pertence à fase e precisa ser liberado.
        if (destination) destination.add(ch);
        else sock.remove(ch);
      }
    }
  }

  /** Encerra a montagem atual. Hooks limpam estado; o scope libera recursos
   * da árvore e extras declarados. Uma falha não impede a limpeza restante.
   */
  function disposeLevel({ resetPuzzle = true } = {}) {
    const errors = [];
    const attempt = (fn) => { try { fn(); } catch (error) { errors.push(error); } };
    if (resetPuzzle) attempt(() => puzzle?.reset?.());
    attempt(() => emptyMouths(root));
    attempt(() => puzzle?.dispose?.());
    attempt(() => scent?.dispose());
    attempt(() => built?.dispose?.());
    attempt(() => resources?.dispose(dbg?.group));
    // Nenhum getter/closure do núcleo deve manter a montagem descartada viva.
    root = built = puzzle = scent = world = nav = dbg = resources = null;
    if (errors.length) throw new AggregateError(errors, 'Falha ao encerrar a fase');
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
    extras?.reset();
    puzzle.reset();
    scent.reset();
    cancelBafo();
    cancelLick();
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
    extras?.cancel();
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
   * A UI cobre a tela no 'level:loading', revela no 'level:loaded' e recupera no 'level:error'.
   * Resolve true ao concluir ou false em falha; chamadas da UI não deixam rejeições soltas.
   */
  async function loadLevel(index, { mode = 'intro', initial = false } = {}) {
    if (loadingPromise) return loadingPromise;
    // Após uma montagem parcial só a recarga da página é segura. Para uma
    // falha anterior ao descarte, a UI primeiro retorna à fase intacta.
    if (state === 'load-error') return false;
    index = Math.max(0, Math.min(levels.length - 1, index | 0));
    loadingPromise = (async () => {
      const baseDef = levels[index];
      const prevState = state;
      const hadLevel = !!root && !!puzzle;
      let previousUntouched = true;
      try {
        state = 'loading';
        emit('game:state', { state: 'loading', prev: prevState, level: index });
        emit('level:loading', { index, count: levels.length, id: baseDef.id, number: baseDef.number ?? index + 1, name: baseDef.name, subtitle: baseDef.subtitle, initial });
        // Promise.all observa a rejeição imediatamente, inclusive antes dos 420 ms
        // da cortina. Promise.resolve().then também captura um load() síncrono.
        const [lazy] = await Promise.all([
          Promise.resolve().then(() => baseDef.load?.()),
          initial ? Promise.resolve() : sleep(FADE_MS),
        ]);
        /** @type {import('../types').LevelDef} */
        const nextDef = { ...baseDef, ...lazy };
        await nextPaint();
        markLoad('code');

        // Devolve o item carregado à fase velha e esvazia as bocas (as dogs sobrevivem entre fases).
        previousUntouched = false;
        disposeLevel();

        levelIndex = index;
        def = nextDef;
        L = def.layout;
        engine.applyLighting(def.lighting, L.WORLD.bounds);
        root = new THREE.Group();
        root.name = `fase:${def.id}`;
        resources = createResourceScope(root);
        engine.scene.add(root);
        built = def.build({ engine, root, layout: L, params });
        markLoad('build');
        applySeeThroughTo(...(built.seeThrough || []).filter(Boolean));

        world = createCollisionWorld(L);
        nav = createNavigator(L, world);
        scent = createScentField({ world, emit, view: createScentView(root) });
        cancelBafo();
        cancelLick();
        locks.radhija = locks.rhaenyra = null;
        if (!cam) {
          cam = createCameraRig(engine.camera, L);
          // Planos de foco duram ~2 s: os testes conferem no log de depuração (não passa pelo barramento).
          const focusShot = cam.focusShot;
          cam.focusShot = (x, z, opts) => {
            gameEvents.recordCameraShot(x, z);
            focusShot(x, z, opts);
          };
        } else cam.configure(L);
        if (!ctrls) ctrls = { radhija: createController('radhija', L.DOGS.radhija), rhaenyra: createController('rhaenyra', L.DOGS.rhaenyra) };
        if (!extras) {
          extras = createExtras({
            emit, ctrls, carries, camera: engine.camera,
            resolve: (x, z, r, size) => world.resolve(x, z, r, size),
            overlaps: (x, z, r, size) => world.overlaps(x, z, r, size),
            locked: (n) => !!puzzle?.lockFor(n),
            staying: (n) => !!stay[n],
            focus: (x, z, opts) => cam.focusShot(x, z, opts),
          });
        }
        extras.setLevel({ spots: def.extras || [], root, hooks: built.extras || {} });
        for (const n of NAMES) setStay(n, false, { silent: true });
        puzzle = def.createPuzzle({
          layout: L, props: built.props, world, nav, scent, dogs, ctrls, emit, cam, root, place, params, engine,
          get activeDog() { return activeDog; },
          isStaying: (n) => stay[n],
          setStay: (n, on) => setStay(n, on),
          brains,
          // a animação escondida desta fase já aconteceu? (as fases podem guardar algo para depois dela)
          extrasUsed: () => !!extras?.info().used,
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
        markLoad('setup');
        engine.renderer.compile?.(engine.scene, engine.camera);
        markLoad('compile');

        const target = mode === 'play' ? 'playing' : mode === 'title' ? 'title' : 'intro';
        state = 'loading';
        setState(target === 'playing' ? 'intro' : target, { force: true });
        if (target === 'title' || target === 'intro') cam.setMode('title', { instant: true });
        emit('level:loaded', levelInfo());
        if (target === 'playing') setState('playing');
        markLoad('loaded');
        return true;
      } catch (error) {
        const canReturn = hadLevel && previousUntouched;
        if (!previousUntouched) {
          // Depois do ponto irreversível só há recarga, mas a montagem parcial
          // também deve ser liberada. Não repetir o reset que pode ter falhado.
          try { disposeLevel({ resetPuzzle: false }); }
          catch (cleanupError) { console.warn('[game] falha na limpeza da fase', cleanupError); }
        }
        loadFailure = { prevState, canReturn };
        // Não chamar setState aqui: o puzzle/cenário pode estar incompleto.
        state = 'load-error';
        emit('game:state', { state, prev: 'loading', level: levelIndex });
        emit('level:error', {
          index, id: baseDef?.id, name: baseDef?.name, initial, canReturn,
          message: canReturn
            ? 'Não foi possível abrir esta fase. Você pode voltar à fase atual ou recarregar o jogo.'
            : 'Não foi possível preparar a fase. Recarregue o jogo para tentar novamente.',
        });
        console.warn('[game] falha no carregamento da fase', baseDef?.id, error);
        return false;
      }
    })();
    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  // ---------- eventos da UI ----------
  function cancelLoad() {
    if (state !== 'load-error' || !loadFailure?.canReturn) return;
    const previous = loadFailure.prevState;
    loadFailure = null;
    setState(previous, { force: true });
  }
  events.on('ui:cancelLoad', cancelLoad);
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
    if (state === 'loading' || state === 'load-error') return;
    reset();
    setState('playing', { force: true });
  });
  events.on('ui:nextLevel', () => {
    if (state === 'loading' || state === 'load-error') return;
    if (levelIndex < levels.length - 1) loadLevel(levelIndex + 1, { mode: 'intro' });
    else loadLevel(0, { mode: 'title' });
  });
  events.on('ui:selectLevel', (/** @type {{ index?: number }} */ { index } = {}) => {
    if (state === 'loading' || state === 'load-error' || !Number.isFinite(index)) return;
    // A fase da tela inicial já está montada e zerada (boot, ui:menu): abre o cartão dela sem recarregar.
    if (state === 'title' && index === levelIndex) {
      setState('intro');
      return;
    }
    loadLevel(index, { mode: 'intro' });
  });
  events.on('ui:menu', () => {
    if (state === 'loading' || state === 'load-error') return;
    reset();
    setState('title');
  });

  // ---------- quadro ----------
  function update(dt, t) {
    input.poll();
    if (!(dt > 0) || !puzzle || state === 'load-error') {
      input.endFrame();
      return;
    }
    simTime += dt;
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
    if (state === 'playing' || state === 'celebrating') {
      puzzle.updateAlways?.(dt);
      scent.update(dt);
    }
    applyDogs(dt);
    built?.update?.(dt, t);
    const a = ctrls[activeDog];
    cam.update(dt, { t, target: { x: a.x, z: a.z, vx: a.vx, vz: a.vz } });
    dbg?.update(ctrls, brains, activeDog);
    input.endFrame();
  }

  function info() {
    const dogInfo = (n) => {
      const c = ctrls?.[n];
      if (!c) return null;
      return {
        x: +c.x.toFixed(3), z: +c.z.toFixed(3), yaw: +c.yaw.toFixed(3), v: +c.v.toFixed(3),
        speed: +c.animSpeed.toFixed(3), action: anims[n].action, carrying: carries(n),
        dashing: c.dashT > 0, mode: n === activeDog ? 'active' : brains[n].mode,
        path: brains[n].path.map((w) => w.id), reachable: brains[n].reachable,
        stuck: +brains[n].stuckAccum.toFixed(2), sitting: anims[n].action === 'sit',
        visible: isVisible(c.x, c.z), stay: stay[n],
        y: +c.y.toFixed(3), jumping: c.jumpT > 0,
        wall: c.wallDur > 0 ? { id: c.wall.id, k: +(c.wallT / c.wallDur).toFixed(3) } : null,
        shove: c.shove ? { id: c.shove.id, kind: c.shove.kind ?? null, stage: c.shoveStage, n: c.shoveN, k: +c.shoveK.toFixed(3), cycle: +c.shoveCycle.toFixed(3) } : null,
      };
    };
    const p = engine.camera.position;
    return {
      state, stage: puzzle?.stage ?? null, activeDog, level: levelIndex, levelId: def?.id,
      dogs: { radhija: dogInfo('radhija'), rhaenyra: dogInfo('rhaenyra') },
      ...(puzzle?.info?.() || {}),
      carrier: puzzle?.carrier ?? null, collected: puzzle?.collected ?? null, total: puzzle?.total ?? null,
      timeSec: +playTime.toFixed(2), simSec: +simTime.toFixed(3), prompt: puzzle?.S?.prompt ?? null,
      stay: { ...stay }, input: { device: input.device, pad: input.padConnected },
      bafo: { aiming: bafo.aiming, cd: +bafo.cd.toFixed(2) }, scent: scent?.info() ?? null,
      lick: { on: lick.on, by: lick.on ? lick.by : null, stage: lick.on ? lick.stage : null, solo: lick.solo, target: lick.target, strokes: lick.strokes, phase: lick.on ? +lick.phase.toFixed(3) : null },
      extras: extras?.info() ?? null,
      camera: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), mode: cam?.mode ?? null, shot: cam?.shotActive ?? false },
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
    /** Piso sob a dog (o deque do escorregador; no pulo, o chão) e se ela está numa rampa: para os anéis. */
    floorOf(name) {
      const c = ctrls?.[name];
      if (!c) return { y: 0, ramp: false };
      return { y: airborne(c) ? 0 : Math.max(0, c.y || 0), ramp: Math.abs(anims[name]?.slope || 0) > 0.05 };
    },
    update,
    reset,
    loadLevel,
    cancelLoad,
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
      log: gameEvents.log,
      events: gameEvents.events,
      clearLog: gameEvents.clearLog,
      get world() { return world; },
      get nav() { return nav; },
      get scent() { return scent; },
      get ctrls() { return ctrls; },
      get puzzle() { return puzzle; },
      brains,
      get cam() { return cam; },
    },
  };
  return game;
}
