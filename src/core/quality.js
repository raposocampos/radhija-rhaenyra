// Qualidade gráfica por aparelho. Só lógica (perfis, detecção, governador de FPS): o engine aplica.
// O PC fica no perfil 'alta', exatamente o de sempre: pixel ratio até 1,5, sombras PCFSoft 2048, MSAA 4 e bloom.
// Celular e tablet (o dedo como ponteiro principal: pointer coarse, sem hover) começam no 'media' e, no modo
// automático, descem sozinhos se o FPS cair. O menu de pausa permite forçar um perfil (salvo por aparelho).
// Ver docs/ARQUITETURA.md §9 (Qualidade gráfica por aparelho).
import * as THREE from 'three';
import { storageKey } from '../game/storageKey.js';

/**
 * @typedef {{ name: QualityLevel, pixelRatio: number, pixelBudget: number, shadows: boolean, shadowSize: number,
 *             softShadows: boolean, msaa: number, bloom: boolean }} QualityProfile
 * @typedef {'alta' | 'media' | 'baixa' | 'minima'} QualityLevel
 * @typedef {'auto' | 'alta' | 'media' | 'baixa'} QualityMode
 * @typedef {'desktop' | 'phone' | 'tablet'} DeviceKind
 */

/**
 * pixelRatio: teto do devicePixelRatio. pixelBudget: teto de pixels desenhados (0 = sem teto), para a tela grande de
 * um tablet não sair mais cara que a do PC. 'minima' só o modo automático alcança (último recurso).
 * @type {Record<QualityLevel, QualityProfile>}
 */
export const QUALITY_PROFILES = {
  alta: { name: 'alta', pixelRatio: 1.5, pixelBudget: 0, shadows: true, shadowSize: 2048, softShadows: true, msaa: 4, bloom: true },
  media: { name: 'media', pixelRatio: 1.25, pixelBudget: 1200000, shadows: true, shadowSize: 1024, softShadows: false, msaa: 2, bloom: true },
  baixa: { name: 'baixa', pixelRatio: 1, pixelBudget: 800000, shadows: true, shadowSize: 1024, softShadows: false, msaa: 0, bloom: false },
  minima: { name: 'minima', pixelRatio: 0.75, pixelBudget: 500000, shadows: false, shadowSize: 512, softShadows: false, msaa: 0, bloom: false },
};
/** Opções do menu, nesta ordem. @type {QualityMode[]} */
export const QUALITY_MODES = ['auto', 'alta', 'media', 'baixa'];
/** Degraus do modo automático no celular/tablet. @type {QualityLevel[]} */
export const MOBILE_LADDER = ['media', 'baixa', 'minima'];

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

/** Modo válido do menu ('auto' para qualquer outra coisa). @param {unknown} mode @returns {QualityMode} */
export const normalizeMode = (mode) => (QUALITY_MODES.includes(/** @type {QualityMode} */ (mode)) ? /** @type {QualityMode} */ (mode) : 'auto');

/**
 * Perfil inicial: o forçado no menu ou, no automático, 'alta' no PC e 'media' no celular/tablet.
 * @param {unknown} mode @param {DeviceKind} device @returns {QualityLevel}
 */
export function initialLevel(mode, device) {
  const m = normalizeMode(mode);
  if (m !== 'auto') return m;
  return device === 'desktop' ? 'alta' : 'media';
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

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Governador de FPS do modo automático. sample(ms, active) a cada quadro: ms = intervalo real entre quadros;
 * active = partida rodando (menus, pausa, cortina e carregamento não contam e reiniciam a medição).
 * - FPS pela mediana de janelas de `windowMs` ativos (soluços isolados não contam); `warmupMs` ignorados no começo
 *   e a cada volta à partida (shaders compilando) e `settleMs` depois de cada troca ou travada longa.
 * - `badWindows` janelas seguidas abaixo de `minFps` → desce um degrau ({ action: 'down', level }).
 * - Se a janela seguinte à descida não melhorar pelo menos `minGain`× (aparelho preso a 30 Hz, economia de bateria
 *   ou limite de CPU), volta ao degrau anterior e para de ajustar ({ action: 'revert' }).
 * - No último degrau, para de ajustar. Nunca sobe sozinho (sem vaivém); escolher no menu recomeça do zero.
 * @param {{ level?: QualityLevel, ladder?: QualityLevel[], minFps?: number, windowMs?: number, warmupMs?: number,
 *           settleMs?: number, minGain?: number, badWindows?: number }} [opts]
 */
export function createFpsGovernor({
  level = 'media', ladder = MOBILE_LADDER, minFps = 45, windowMs = 3000, warmupMs = 2500, settleMs = 1500,
  minGain = 1.1, badWindows = 2,
} = {}) {
  let idx = Math.max(0, ladder.indexOf(level));
  let warm = warmupMs;
  let win = [];
  let winMs = 0;
  let strikes = 0;
  /** @type {{ from: QualityLevel, fps: number } | null} */
  let trial = null;
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
    const fps = 1000 / median(win);
    win = [];
    winMs = 0;
    if (trial) {
      const t = trial;
      trial = null;
      if (fps < t.fps * minGain) {
        locked = true;
        idx = ladder.indexOf(t.from);
        return { action: 'revert', level: t.from, fps };
      }
    }
    if (fps >= minFps) { strikes = 0; return null; }
    if (++strikes < badWindows) return null;
    strikes = 0;
    if (idx >= ladder.length - 1) { locked = true; return null; }
    const from = ladder[idx];
    idx++;
    trial = { from, fps };
    restart(settleMs);
    return { action: 'down', level: ladder[idx], from, fps };
  }
  return {
    sample,
    get level() { return ladder[idx]; },
    get locked() { return locked; },
  };
}

/**
 * Aplica um perfil a um engine já criado (troca pelo menu ou pelo governador). Só mexe no que mudou.
 * target: { renderer, composer, sun, bloom, scene, castShadow (a fase quer sombra do sol?), dpr, width, height }
 * Trocar o tipo de sombra (PCFSoft ↔ PCF) exige recompilar os materiais; o tamanho só recria o mapa.
 * @param {any} target @param {QualityProfile} next @param {QualityProfile} [prev]
 * @returns {number} o pixel ratio aplicado
 */
export function applyQualityProfile(target, next, prev) {
  const { renderer, composer, sun, bloom, scene } = target;
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
  if (!prev || prev.msaa !== next.msaa) {
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
      if (rt.samples === next.msaa) continue;
      rt.samples = next.msaa;
      rt.dispose();
    }
  }
  bloom.enabled = next.bloom;
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
 * apply(profile, reason) troca o perfil no engine; onChange(state) avisa a UI.
 * @param {{ device: DeviceKind, mode?: QualityMode, apply?: (p: QualityProfile, reason: string) => void,
 *           onChange?: (s: object) => void, save?: (m: QualityMode) => void }} opts
 */
export function createQualityControl({ device, mode: mode0 = 'auto', apply = () => {}, onChange = () => {}, save = saveQualityMode }) {
  let mode = normalizeMode(mode0);
  /** @type {QualityLevel} */
  let level = initialLevel(mode, device);
  let gov = isAdaptive(mode, device) ? createFpsGovernor({ level }) : null;
  let last = 0;
  let changes = 0;
  const state = () => ({ device, mode, level, adaptive: !!gov && !gov.locked, changes });
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
    state,
    /** Escolha do menu ('auto' | 'alta' | 'media' | 'baixa'): salva e recomeça o governador. @param {string} m */
    setMode(m) {
      if (normalizeMode(m) !== m) return false;
      mode = normalizeMode(m);
      save(mode);
      const next = initialLevel(mode, device);
      gov = isAdaptive(mode, device) ? createFpsGovernor({ level: next }) : null;
      if (next === level) onChange({ ...state(), reason: 'menu', fps: null });
      else set(next, 'menu');
      return true;
    },
    /** Um quadro: now = performance.now(); active = partida rodando. @param {number} now @param {boolean} active */
    frame(now, active) {
      const ms = last ? now - last : 0;
      last = now;
      if (!gov) return;
      const r = gov.sample(ms, active);
      if (r) set(r.level, r.action, r.fps);
    },
  };
}
