// Roda o jogo DE VERDADE (src/game/game.js + puzzles + mecânicas) no Node, sem navegador nem GPU.
// O que é visual vira dublê: engine (cena e câmera do Three, sem renderer), dogs (Object3D com
// mouthSocket) e props explícitos das fases (métodos desconhecidos reprovam). Teclado e controle são simulados
// com eventos no `globalThis` e `navigator.getGamepads`. Cada quadro é `game.update(dt)` com dt fixo,
// então os testes são determinísticos e rodam em milissegundos.
//
//   const h = await createHeadlessGame({ level: 1, mode: 'play' });
//   h.tap('KeyQ'); h.run(1.5); await h.walkTo(1.7, -2.05); h.info().stage;
import * as THREE from 'three';
import { stubProps } from './props.mjs';

// ---------------------------------------------------------------------------------------------
// Dublês do navegador (instalados uma vez por processo)
// ---------------------------------------------------------------------------------------------
let keyTarget = null;
const fakePads = [];

/** Contexto 2D falso: aceita qualquer chamada (texturas procedurais em canvas viram no-op). */
function fake2d() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      if (k === 'getImageData' || k === 'createImageData') return (x, y, w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'measureText') return () => ({ width: 0 });
      if (k.startsWith('create')) return () => ({ addColorStop() {} });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function fakeCanvas() {
  return { width: 1, height: 1, style: {}, getContext: () => fake2d(), toDataURL: () => '', addEventListener() {} };
}

export function installBrowserStubs() {
  // Um alvo novo por jogo: os ouvintes de teclado de um jogo anterior não recebem as teclas do próximo.
  keyTarget = new EventTarget();
  globalThis.addEventListener = keyTarget.addEventListener.bind(keyTarget);
  globalThis.removeEventListener = keyTarget.removeEventListener.bind(keyTarget);
  globalThis.dispatchEvent = keyTarget.dispatchEvent.bind(keyTarget);
  if (!globalThis.document) {
    globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: () => fakeCanvas() };
  }
  if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
  if (!globalThis.location) globalThis.location = { search: '' };
  Object.defineProperty(globalThis.navigator, 'getGamepads', { configurable: true, value: () => fakePads });
}

// ---------------------------------------------------------------------------------------------
// Dublês do jogo
// ---------------------------------------------------------------------------------------------
/** Dog sem modelo: guarda a última animação pedida e os latidos. */
export function stubDog(name) {
  const object = new THREE.Group();
  object.name = name;
  const mouthSocket = new THREE.Group();
  mouthSocket.name = `${name}:boca`;
  // na frente do focinho, como nos modelos (a corda na boca mede a distância dela até o que ela morde)
  mouthSocket.position.set(0, 0.32, 0.32);
  object.add(mouthSocket);
  return {
    object,
    mouthSocket,
    markerAnchor: new THREE.Object3D(),
    onFootstep: null,
    carryKind: null,
    wet: 0,
    barks: 0,
    anim: null,
    update(dt, anim) { this.anim = { ...anim }; },
    triggerBark() { this.barks++; },
    setCarryPose(kind) { this.carryKind = kind; },
    setWet(k) { this.wet = k; },
  };
}

/**
 * Troca o `build` de cada fase por um que só cria dublês (sem cenário, sem canvas) e tira o `load`
 * (o import dinâmico do cenário): os módulos de world/ nem chegam a ser carregados.
 */
export function headlessLevels(levels) {
  return levels.map((def) => ({
    ...def,
    load: undefined,
    build({ root }) {
      return { props: stubProps(def.id, root, def.layout), seeThrough: [], update() {} };
    },
  }));
}

function stubEngine() {
  return {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200),
    renderer: { compile() {} },
    applyLighting() {},
  };
}

// ---------------------------------------------------------------------------------------------
// Jogo headless
// ---------------------------------------------------------------------------------------------
/**
 * Cria um jogo headless já carregado.
 * opts: { level (1-based, padrão 1; 0 = o mapa das fases), mode 'play'|'intro'|'title', query (ex.: 'dog=rhaenyra&stage=east'),
 *         levels (definições; padrão: src/levels/index.js),
 *         configure({ game, levels, engine, dogs }) (injeção controlada antes da primeira carga),
 *         progress (o save que o mapa lê: { levels: { fase1: { done, treats, ... } } }) }
 */
export async function createHeadlessGame({ level = 1, mode = 'play', query = '', levels = null, configure = null, makeDog = null, pee = false, progress = null } = {}) {
  installBrowserStubs();
  const [{ createGame, HUB }, { events }, LV, MAPA] = await Promise.all([
    import('../../src/game/game.js'),
    import('../../src/core/events.js'),
    levels ? Promise.resolve(null) : import('../../src/levels/index.js'),
    import('../../src/levels/mapa/index.js'),
  ]);
  const defs = headlessLevels(levels || LV.LEVELS);
  const [hub] = headlessLevels([MAPA.default]);
  const engine = stubEngine();
  // makeDog(nome): as dogs de verdade (modelo atual ou novo), para conferir o que depende do desenho (a boca, as patas)
  const dogs = { radhija: (makeDog || stubDog)('radhija'), rhaenyra: (makeDog || stubDog)('rhaenyra') };
  engine.scene.add(dogs.radhija.object, dogs.rhaenyra.object);
  const params = new URLSearchParams(query);
  const game = createGame({ engine, dogs, levels: defs, params, hub });
  // o progresso que o mapa lê (no jogo, o da UI)
  const save = { levels: {}, ...(progress || {}) };
  game.setProgressSource(() => save);
  configure?.({ game, levels: defs, engine, dogs });
  await game.loadLevel(level === 0 ? HUB : level - 1, { mode, initial: true });
  // o xixi (parada por muito tempo) é sorteado e tira a dog do lugar: desligado, a não ser no teste dele (pee: true)
  game.debug.idle?.setPee(pee);

  const DT = 1 / 60;
  let t = 0;
  const target = keyTarget;
  const held = new Set();
  const key = (type, code) => {
    const e = new Event(type);
    e.code = code;
    e.repeat = false;
    target.dispatchEvent(e);
  };

  const h = {
    game, events, engine, dogs, levels: defs, save,
    get ctrls() { return game.debug.ctrls; },
    get world() { return game.debug.world; },
    get nav() { return game.debug.nav; },
    get puzzle() { return game.puzzle; },
    get props() { return game.built?.props; },
    get layout() { return game.levelDef.layout; },
    get time() { return t; },
    info: () => game.debug.info(),
    log: (name) => game.debug.events(name).map((e) => e.payload),
    clearLog: () => game.debug.clearLog(),
    /** Um quadro. */
    step(dt = DT) {
      t += dt;
      game.update(dt, t);
    },
    /** Avança `sec` segundos (quadros de dt). Para antes se `until(info)` ficar verdadeiro. */
    run(sec, { dt = DT, until = null } = {}) {
      const n = Math.max(1, Math.round(sec / dt));
      for (let i = 0; i < n; i++) {
        h.step(dt);
        if (until && until(h.info())) return true;
      }
      return !until;
    },
    keyDown(code) { if (!held.has(code)) { held.add(code); key('keydown', code); } },
    keyUp(code) { if (held.delete(code)) key('keyup', code); },
    releaseAll() { for (const c of [...held]) h.keyUp(c); },
    /** Toque: aperta, roda um quadro, solta e roda mais um quadro. */
    tap(code, after = 1) {
      h.keyDown(code);
      h.step();
      h.keyUp(code);
      for (let i = 0; i < after; i++) h.step();
    },
    /** Controle falso (mapeamento standard). Passe null para desconectar. */
    setPad(pad) {
      fakePads.length = 0;
      if (pad) fakePads.push({ connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0], buttons: [], ...pad });
    },
    /** Monta um estado de controle: botões apertados (índices de PAD) e analógico. */
    pad({ down = [], axes = [0, 0, 0, 0] } = {}) {
      const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 }));
      return { buttons, axes };
    },
    teleport(name, x, z, yaw) {
      const r = game.debug.teleport(name, x, z);
      if (yaw !== undefined) game.debug.ctrls[name].yaw = yaw;
      return r;
    },
    /** Teclas (8 direções relativas à câmera) para andar na direção (dx, dz) do mundo. */
    keysFor(dx, dz) {
      const B = game.debug.cam.basis();
      const fwd = dx * B.fx + dz * B.fz;
      const rgt = dx * B.rx + dz * B.rz;
      const s = ((Math.round(Math.atan2(rgt, fwd) / (Math.PI / 4)) % 8) + 8) % 8;
      return [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyW', 'KeyA']][s];
    },
    /** Segura as teclas de movimento para (dx, dz) (ou solta, com null). */
    hold(dir, extra = []) {
      const want = new Set([...(dir ? h.keysFor(dir[0], dir[1]) : []), ...extra]);
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) {
        if (want.has(k)) h.keyDown(k); else h.keyUp(k);
      }
    },
    /** Anda com a dog ativa até (x, z) em malha fechada, como as partidas Playwright. Para antes se `until(info)`. */
    walkTo(x, z, { tol = 0.2, timeout = 15, extra = [], until = null } = {}) {
      const n = Math.round(timeout / DT);
      for (let i = 0; i < n; i++) {
        const inf = h.info();
        if (inf.state !== 'playing') break;
        if (until && until(inf)) break;
        const c = game.debug.ctrls[inf.activeDog];
        const dx = x - c.x;
        const dz = z - c.z;
        const d = Math.hypot(dx, dz);
        if (d < tol) break;
        // Perto do alvo, pulsa as teclas para não passar do ponto.
        if (d < 0.5 && i % 3 === 2) h.hold(null, extra); else h.hold([dx, dz], extra);
        h.step();
      }
      h.hold(null);
      h.run(0.15);
      const c = game.debug.ctrls[game.activeDog];
      return { x: c.x, z: c.z };
    },
    walkPath(points, opts) {
      let p = null;
      for (const [x, z, o] of points) p = h.walkTo(x, z, { ...opts, ...(o || {}) });
      return p;
    },
  };
  return h;
}
