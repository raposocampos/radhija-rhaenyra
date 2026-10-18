// Qualidade gráfica por aparelho. Só lógica (perfis, detecção, governador de FPS): o engine aplica.
// O PC fica no perfil 'alta', exatamente o de sempre: pixel ratio até 1,5, sombras PCFSoft 2048, MSAA 4 e bloom.
// Celular e tablet (o dedo como ponteiro principal: pointer coarse, sem hover) começam no 'media' (ou no 'baixa',
// com uma GPU de entrada conhecida) e, no modo automático, descem sozinhos se o FPS cair. O menu de pausa permite
// forçar um perfil (salvo por aparelho). Ver docs/ARQUITETURA.md §9 (Qualidade gráfica por aparelho).
import * as THREE from 'three';
import { storageKey } from '../game/storageKey.js';

/**
 * @typedef {{ name: QualityLevel, pixelRatio: number, pixelBudget: number, shadows: boolean, shadowSize: number,
 *             softShadows: boolean, shadowEvery: number, msaa: number, bloom: boolean, post: boolean,
 *             skyLast: boolean }} QualityProfile
 * @typedef {'alta' | 'media' | 'baixa' | 'minima'} QualityLevel
 * @typedef {'auto' | 'alta' | 'media' | 'baixa'} QualityMode
 * @typedef {'desktop' | 'phone' | 'tablet'} DeviceKind
 */

/**
 * pixelRatio: teto do devicePixelRatio. pixelBudget: teto de pixels desenhados (0 = sem teto).
 * shadowEvery: o mapa de sombra é redesenhado a cada N quadros (a passada de sombra repete o cenário inteiro).
 * post: compositor (gradação de cor e vinheta); sem ele, desenha direto na tela (tone mapping nos materiais).
 * skyLast: o céu procedural (nuvens por ruído) é desenhado depois do cenário, só nos pixels que sobram.
 * 'minima' só o modo automático alcança (último recurso).
 * @type {Record<QualityLevel, QualityProfile>}
 */
export const QUALITY_PROFILES = {
  alta: {
    name: 'alta', pixelRatio: 1.5, pixelBudget: 0, shadows: true, shadowSize: 2048, softShadows: true, shadowEvery: 1,
    msaa: 4, bloom: true, post: true, skyLast: false,
  },
  media: {
    name: 'media', pixelRatio: 1, pixelBudget: 600000, shadows: true, shadowSize: 1024, softShadows: false, shadowEvery: 1,
    msaa: 0, bloom: false, post: true, skyLast: true,
  },
  baixa: {
    name: 'baixa', pixelRatio: 0.85, pixelBudget: 420000, shadows: true, shadowSize: 1024, softShadows: false, shadowEvery: 2,
    msaa: 0, bloom: false, post: true, skyLast: true,
  },
  minima: {
    name: 'minima', pixelRatio: 0.7, pixelBudget: 300000, shadows: false, shadowSize: 1024, softShadows: false, shadowEvery: 1,
    msaa: 0, bloom: false, post: false, skyLast: true,
  },
};
/** Opções do menu, nesta ordem. @type {QualityMode[]} */
export const QUALITY_MODES = ['auto', 'alta', 'media', 'baixa'];
/** Degraus do modo automático no celular/tablet. @type {QualityLevel[]} */
export const MOBILE_LADDER = ['media', 'baixa', 'minima'];
/** Teto de quadros por segundo no celular/tablet (telas de 90/120 Hz desenhariam o dobro e esquentariam). */
export const MOBILE_FPS_CAP = 60;

/**
 * Aparelho a partir das mídias do navegador. Notebook com tela de toque continua 'desktop' (o ponteiro principal é o
 * mouse/touchpad); celular é o aparelho de toque com o lado menor da tela até 600 px.
 * @param {{ coarse?: boolean, hover?: boolean, screenW?: number, screenH?: number }} [env]
 * @returns {DeviceKind}
 */
export function detectDevice({ coarse = false, hover = true, screenW = 0, screenH = 0 } = {}) {
  if (!coarse || hover) return 'desktop';
  return Math.min(screenW || Infinity, screenH || Infinity) <= 600 ? 'phone' : 'tablet';
}

/** Lê o ambiente para detectDevice (no navegador). */
export function readDeviceEnv(win = globalThis) {
  const mm = (q) => {
    try { return !!win.matchMedia?.(q).matches; } catch { return false; }
  };
  return {
    coarse: mm('(pointer: coarse)'),
    hover: mm('(hover: hover)'),
    screenW: win.screen?.width || win.innerWidth || 0,
    screenH: win.screen?.height || win.innerHeight || 0,
  };
}

/**
 * GPU de entrada de celular (pelo nome que o WebGL informa): Mali T/G31–G72 e G57/G68 (ex.: Infinix Note 30 5G,
 * Dimensity 6080 com Mali-G57 MC2), Adreno 3xx–5xx e 60x–61x, PowerVR. Essas começam no perfil 'baixa'.
 * O iPhone informa só "Apple GPU" e começa no 'media'.
 * @param {string} [name]
 */
export function isLowEndGpu(name = '') {
  return /Mali-T\d|Mali-G(31|51|52|57|68|71|72)\b|Adreno \(TM\) ([3-5]\d\d|6[01]\d)\b|PowerVR|IMG BXM/i.test(String(name));
}

/** Nome da GPU (só no celular/tablet: no PC nem se consulta). @param {WebGLRenderingContext | WebGL2RenderingContext} gl */
export function readGpuName(gl) {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  } catch {
    return '';
  }
}

/** Modo válido do menu ('auto' para qualquer outra coisa). @param {unknown} mode @returns {QualityMode} */
export const normalizeMode = (mode) => (QUALITY_MODES.includes(/** @type {QualityMode} */ (mode)) ? /** @type {QualityMode} */ (mode) : 'auto');

/**
 * Perfil inicial: o forçado no menu ou, no automático, 'alta' no PC, 'media' no celular/tablet e 'baixa' no
 * celular/tablet com GPU de entrada.
 * @param {unknown} mode @param {DeviceKind} device @param {{ lowGpu?: boolean }} [opts] @returns {QualityLevel}
 */
export function initialLevel(mode, device, { lowGpu = false } = {}) {
  const m = normalizeMode(mode);
  if (m !== 'auto') return m;
  if (device === 'desktop') return 'alta';
  return lowGpu ? 'baixa' : 'media';
}

/** O governador de FPS só age no automático e fora do PC (no PC nada muda sozinho). @param {unknown} mode @param {DeviceKind} device */
export const isAdaptive = (mode, device) => normalizeMode(mode) === 'auto' && device !== 'desktop';

/**
 * Pixel ratio do perfil: o do aparelho limitado pelo teto e pelo orçamento de pixels. No 'alta' (sem orçamento) é o
 * mesmo cálculo de sempre do PC, min(devicePixelRatio, 1,5).
 * @param {QualityProfile} profile
 * @param {{ dpr?: number, width?: number, height?: number }} [screen]
 */
export function pixelRatioFor(profile, { dpr = 1, width = 1, height = 1 } = {}) {
  let pr = Math.min(dpr || 1, profile.pixelRatio);
  if (profile.pixelBudget > 0) pr = Math.min(pr, Math.max(0.5, Math.sqrt(profile.pixelBudget / Math.max(1, width * height))));
  return pr;
}

/** Percentil q (0..1) de uma lista de números. */
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};

/**
 * Teto de quadros por segundo: decide, a cada requestAnimationFrame, se este quadro roda (true) ou espera (false).
 * Acumula o tempo e libera um quadro a cada 1/fps s em média: 60 Hz roda todos, 120 Hz um sim um não, 90 Hz dois de três.
 * @param {number} [fps]
 */
export function createFrameCap(fps = MOBILE_FPS_CAP) {
  const step = 1000 / fps;
  let budget = 0;
  let prev = -1;
  /** @param {number} now */
  return (now) => {
    budget += prev >= 0 ? Math.min(250, Math.max(0, now - prev)) : step;
    prev = now;
    if (budget < step - 2) return false;
    // sobra no máximo meio quadro: depois de uma travada não sai uma rajada de quadros
    budget = Math.min(Math.max(0, budget - step), step / 2);
    return true;
  };
}

/**
 * Governador de FPS do modo automático. sample(ms, active) a cada quadro desenhado: ms = intervalo real entre
 * quadros; active = partida rodando (menus, pausa, cortina e carregamento não contam e reiniciam a medição).
 * - FPS pela mediana de janelas de `windowMs` ativos (soluços isolados não contam); `warmupMs` ignorados no começo
 *   e a cada volta à partida (shaders compilando) e `settleMs` depois de cada troca ou travada longa.
 * - `badWindows` janelas seguidas abaixo de `minFps` → desce um degrau ({ action: 'down', level }); abaixo de
 *   `severeFps`, basta uma janela.
 * - Aparelho preso a 30 Hz (economia de bateria: quase todos os quadros em ~33 ms) só desce abaixo de `cappedFps`.
 * - Se descer não melhorou pelo menos `minGain`× (o gargalo é outro), para de descer onde está. No último degrau,
 *   para. Nunca sobe sozinho (sem vaivém); escolher no menu recomeça do zero.
 * @param {{ level?: QualityLevel, ladder?: QualityLevel[], minFps?: number, severeFps?: number, cappedFps?: number,
 *           windowMs?: number, warmupMs?: number, settleMs?: number, badWindows?: number, minGain?: number }} [opts]
 */
export function createFpsGovernor({
  level = 'media', ladder = MOBILE_LADDER, minFps = 45, severeFps = 30, cappedFps = 27,
  windowMs = 1500, warmupMs = 2000, settleMs = 1000, badWindows = 2, minGain = 1.05,
} = {}) {
  let idx = Math.max(0, ladder.indexOf(level));
  let warm = warmupMs;
  let win = [];
  let winMs = 0;
  let strikes = 0;
  /** FPS da janela antes da última descida (para ver se ajudou). */
  let before = 0;
  let locked = false;
  let wasActive = false;
  const restart = (ms) => {
    warm = ms;
    win = [];
    winMs = 0;
  };
  /** @param {number} ms @param {boolean} active */
  function sample(ms, active) {
    if (locked) return null;
    if (!active || !(ms > 0)) {
      // pausa, menu, troca de fase: recomeça do aquecimento e esquece as janelas ruins
      if (wasActive) { restart(warmupMs); strikes = 0; }
      wasActive = false;
      return null;
    }
    wasActive = true;
    // aba escondida ou travada longa (troca de fase): não é o ritmo dos quadros
    if (ms > 250) { restart(settleMs); return null; }
    if (warm > 0) { warm -= ms; return null; }
    win.push(ms);
    winMs += ms;
    if (winMs < windowMs) return null;
    const fps = 1000 / quantile(win, 0.5);
    const capped = quantile(win, 0.2) >= 31 && quantile(win, 0.8) <= 36;
    win = [];
    winMs = 0;
    if (before) {
      const gain = fps / before;
      before = 0;
      if (gain < minGain) { locked = true; return null; }
    }
    if (fps >= (capped ? cappedFps : minFps)) { strikes = 0; return null; }
    strikes++;
    if (strikes < badWindows && (capped || fps >= severeFps)) return null;
    strikes = 0;
    if (idx >= ladder.length - 1) { locked = true; return null; }
    const from = ladder[idx];
    idx++;
    before = fps;
    restart(settleMs);
    return { action: 'down', level: ladder[idx], from, fps };
  }
  return {
    sample,
    get level() { return ladder[idx]; },
    get locked() { return locked; },
  };
}

/** Ordem de desenho do céu: primeiro (o de sempre, no PC) ou depois do cenário opaco (só nos pixels que sobram). */
export const SKY_FIRST = -10;
export const SKY_LAST = 1000;

/**
 * Aplica um perfil a um engine já criado (troca pelo menu ou pelo governador). Só mexe no que mudou.
 * target: { renderer, composer, sun, bloom, scene, sky, castShadow (a fase quer sombra do sol?), dpr, width, height }
 * Trocar o tipo de sombra (PCFSoft ↔ PCF) ou ligar/desligar a sombra recompila os materiais; o tamanho só recria o
 * mapa. O compositor ligado/desligado (post) e o redesenho da sombra a cada N quadros ficam com o render do engine.
 * @param {any} target @param {QualityProfile} next @param {QualityProfile} [prev]
 * @returns {number} o pixel ratio aplicado
 */
export function applyQualityProfile(target, next, prev) {
  const { renderer, composer, sun, bloom, scene, sky } = target;
  const pr = pixelRatioFor(next, target);
  if (renderer.getPixelRatio() !== pr) {
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
  }
  const type = next.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.type !== type) {
    renderer.shadowMap.type = type;
    scene.traverse((o) => {
      const m = o.material;
      if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true;
    });
  }
  if (sun.shadow.mapSize.x !== next.shadowSize) {
    sun.shadow.mapSize.set(next.shadowSize, next.shadowSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  sun.castShadow = target.castShadow !== false && next.shadows;
  renderer.shadowMap.autoUpdate = next.shadowEvery <= 1;
  renderer.shadowMap.needsUpdate = true;
  if (!prev || prev.msaa !== next.msaa) {
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
      if (rt.samples === next.msaa) continue;
      rt.samples = next.msaa;
      rt.dispose();
    }
  }
  bloom.enabled = next.bloom;
  if (sky) sky.renderOrder = next.skyLast ? SKY_LAST : SKY_FIRST;
  return pr;
}
const MODE_KEY = storageKey('rr-quality');
/** Modo salvo neste navegador ('auto' se nada válido). @returns {QualityMode} */
export function loadQualityMode(storage = globalThis.localStorage) {
  try {
    return normalizeMode(storage?.getItem(MODE_KEY));
  } catch {
    return 'auto';
  }
}
/** @param {QualityMode} mode */
export function saveQualityMode(mode, storage = globalThis.localStorage) {
  try {
    if (mode === 'auto') storage?.removeItem(MODE_KEY);
    else storage?.setItem(MODE_KEY, mode);
  } catch { /* armazenamento indisponível */ }
}

/**
 * Controle da qualidade (o engine cria um): perfil atual, modo escolhido e governador.
 * apply(profile, reason) troca o perfil no engine; onChange(state) avisa a UI. gpu: nome da GPU (celular/tablet).
 * @param {{ device: DeviceKind, mode?: QualityMode, gpu?: string, apply?: (p: QualityProfile, reason: string) => void,
 *           onChange?: (s: object) => void, save?: (m: QualityMode) => void }} opts
 */
export function createQualityControl({ device, mode: mode0 = 'auto', gpu = '', apply = () => {}, onChange = () => {}, save = saveQualityMode }) {
  let mode = normalizeMode(mode0);
  const lowGpu = device !== 'desktop' && isLowEndGpu(gpu);
  /** @type {QualityLevel} */
  let level = initialLevel(mode, device, { lowGpu });
  let gov = isAdaptive(mode, device) ? createFpsGovernor({ level }) : null;
  let last = 0;
  let changes = 0;
  const state = () => ({ device, mode, level, adaptive: !!gov && !gov.locked, lowGpu, gpu, changes });
  function set(next, reason, fps) {
    if (next === level) return;
    level = next;
    changes++;
    apply(QUALITY_PROFILES[level], reason);
    onChange({ ...state(), reason, fps: fps == null ? null : Math.round(fps) });
  }
  return {
    get device() { return device; },
    get mode() { return mode; },
    get level() { return level; },
    get profile() { return QUALITY_PROFILES[level]; },
    get adaptive() { return !!gov && !gov.locked; },
    get lowGpu() { return lowGpu; },
    /** Celular/tablet: teto de 60 quadros por segundo (createFrameCap). */
    get capFps() { return device !== 'desktop'; },
    state,
    /** Escolha do menu ('auto' | 'alta' | 'media' | 'baixa'): salva e recomeça o governador. @param {string} m */
    setMode(m) {
      if (normalizeMode(m) !== m) return false;
      mode = normalizeMode(m);
      save(mode);
      const next = initialLevel(mode, device, { lowGpu });
      gov = isAdaptive(mode, device) ? createFpsGovernor({ level: next }) : null;
      if (next === level) onChange({ ...state(), reason: 'menu', fps: null });
      else set(next, 'menu');
      return true;
    },
    /** Diagnóstico (capturas e testes): aplica um nível, inclusive 'minima', sem mudar o modo nem salvar. @param {string} lv */
    forceLevel(lv) {
      if (!QUALITY_PROFILES[lv]) return false;
      gov = null;
      set(lv, 'forcado');
      return true;
    },
    /** Um quadro desenhado: now = performance.now(); active = partida rodando. @param {number} now @param {boolean} active */
    frame(now, active) {
      const ms = last ? now - last : 0;
      last = now;
      if (!gov) return;
      const r = gov.sample(ms, active);
      if (r) set(r.level, r.action, r.fps);
    },
  };
}
