// PANDORÓPOLIS — a lógica do mapa das fases (um "puzzle" que nunca termina).
// Lê o progresso salvo (ctx.hub.progress()) e põe cada bandeirinha no estado dela: trancada (cinza, com cadeado),
// a próxima (laranja, brilhando) ou concluída (verde; dourada com os três biscoitos). As áreas embaixo das nuvens
// (o leste e o centro a partir da fase 6, a chácara na 9) ficam bloqueadas até a vez delas, e a ponte do rio desce na
// vez da chácara. Perto de uma bandeirinha: a plaquinha (evento map:sign), o prompt "Entrar" (E · ✕ · Agir) e a carga
// por baixo da fase (ctx.hub.preload). O atalho (travel) leva as duas direto a outra bandeirinha liberada.
// Eventos: map:sign { n, id, name, place, when, state, treats, total, best } | { n: null } · map:travel { from, to,
// x, z } · map:unlock { zone, n } · hint.
import { FLAGS, FLAG_NEAR, FLAG_PRELOAD, ZONES, BRIDGE, RIVER, flagSpot } from './layout.js';

export const STAGES = ['explorar'];
export const TEXT = {
  objective: {
    next: (n, name) => `Vá até a bandeirinha da fase ${n}: ${name}.`,
    all: 'Todas as fases concluídas! Passeie por Pandorópolis.',
  },
  hint: {
    locked: (n) => `Trancada: termine a fase ${n - 1} antes.`,
    lockedTravel: (n) => `A fase ${n} ainda está trancada.`,
    clouds: 'Essa parte da cidade abre mais adiante.',
  },
  prompt: { enter: 'Entrar' },
};
/** Velocidade de andar no mapa (a cidade é maior que uma fase). */
export const MAP_SPEED = 1.6;

/**
 * Memória da sessão (o puzzle é recriado a cada visita ao mapa): o que estava aberto na visita anterior, para a
 * abertura das nuvens e da ponte ser animada só quando acabou de acontecer.
 * @type {{ open: Record<string, boolean>, next: number } | null}
 */
let lastVisit = null;
/** Só para os testes: esquecer a visita anterior. */
export function forgetLastVisit() { lastVisit = null; }

/** @param {import('../../types').PuzzleContext<import('../../types').MapaProps>} ctx */
export function createPuzzle(ctx) {
  const { emit, props, world, cam } = ctx;
  /** @type {import('../../types').HubContext} */
  const hub = ctx.hub || { levels: [], progress: () => ({ levels: {} }), from: null, enter() {}, unlockAll: false };
  const S = { time: 0, prompt: undefined, sign: null, near: null, preloading: null, nextHint: 0 };
  /** Índice no catálogo de cada bandeirinha (fases que não estão no catálogo ficam de fora). */
  const flags = FLAGS.map((f) => ({ ...f, index: hub.levels.findIndex((l) => l.id === f.level) }))
    .filter((f) => f.index >= 0);
  const metaOf = (f) => hub.levels[f.index];

  // ---------- progresso → estado das bandeirinhas, nuvens e ponte ----------
  /** @type {{ levels?: Record<string, any> }} */
  let prog = { levels: {} };
  const rec = (f) => (Object.hasOwn(prog.levels || {}, f.level) ? prog.levels[f.level] : null);
  const isDone = (f) => !!rec(f)?.done;
  const prevOf = (f) => flags.find((g) => g.index === f.index - 1);
  const isOpen = (f) => !!hub.unlockAll || f.index === 0 || isDone(f) || (prevOf(f) ? isDone(prevOf(f)) : false);
  /** @returns {'done' | 'next' | 'locked'} */
  const stateOf = (f) => (isDone(f) ? 'done' : isOpen(f) ? 'next' : 'locked');
  const nextFlag = () => flags.find((f) => !isDone(f) && isOpen(f)) || null;
  /** Uma área abre quando a fase dela é liberada (a 6 abre o leste; a 9, a chácara). */
  const zoneOpen = (key) => {
    const z = ZONES[key];
    if (!Number.isFinite(z.unlock)) return false;
    const f = flags.find((g) => g.n === z.unlock);
    return !!hub.unlockAll || (f ? isOpen(f) : false);
  };
  const zones = Object.fromEntries(Object.keys(ZONES).map((k) => [k, false]));

  // bloqueios dinâmicos: as áreas fechadas e o rio embaixo da ponte levantada
  const blockers = Object.fromEntries(Object.entries(ZONES).map(([k, z]) => {
    const b = z.box;
    return [k, world.addDynamic({ id: `nuvens-${k}`, shape: 'box', x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, hx: (b.maxX - b.minX) / 2, hz: (b.maxZ - b.minZ) / 2 })];
  }));
  const bridgeBlock = world.addDynamic({ id: 'ponte-levantada', shape: 'box', x: (RIVER.minX + RIVER.maxX) / 2, z: BRIDGE.z, hx: (RIVER.maxX - RIVER.minX) / 2, hz: BRIDGE.w / 2 });

  function applyProgress({ animate = false } = {}) {
    prog = hub.progress?.() || { levels: {} };
    for (const f of flags) {
      const r = rec(f);
      props?.flags?.setState?.(f.n, stateOf(f), r?.treats ?? 0, r?.total ?? metaOf(f)?.total ?? 3);
    }
    for (const k of Object.keys(ZONES)) {
      zones[k] = zoneOpen(k);
      blockers[k].enabled = !zones[k];
      props?.clouds?.setOpen?.(k, zones[k], { instant: !animate });
    }
    bridgeBlock.enabled = !zones.chacara;
    props?.bridge?.setDown?.(zones.chacara, { instant: !animate });
  }

  // ---------- perto de uma bandeirinha ----------
  const nearest = (c) => {
    let best = null;
    let bd = Infinity;
    for (const f of flags) {
      const d = Math.hypot(c.x - f.x, c.z - f.z);
      if (d < bd) { bd = d; best = f; }
    }
    return { f: best, d: bd };
  };
  function signOf(f) {
    if (!f) return { n: null };
    const r = rec(f);
    const m = metaOf(f);
    return {
      n: f.n, index: f.index, id: f.level, name: m?.name ?? `Fase ${f.n}`, item: m?.item, place: f.place, when: f.when,
      state: stateOf(f), treats: r?.treats ?? 0, total: r?.total ?? m?.total ?? 3, best: r?.best ?? null,
    };
  }
  function setPrompt(kind) {
    const text = kind ? TEXT.prompt[kind] : null;
    if (text === S.prompt) return;
    S.prompt = text;
    emit('interact:prompt', text ? { text, key: 'E' } : { text: null });
  }

  // ---------- atalho: as duas direto para outra bandeirinha ----------
  function place(f) {
    const a = ctx.activeDog;
    const c = a === 'radhija' ? 'rhaenyra' : 'radhija';
    const L = flagSpot(f, 'lead');
    const C = flagSpot(f, 'comp');
    ctx.place(a, L.x, L.z, L.yaw);
    ctx.place(c, C.x, C.z, C.yaw);
    cam?.snapFollow?.(L.x, L.z);
  }
  /**
   * Vai direto para a bandeirinha `n` (número da fase) ou, com dir ±1, para a anterior/próxima liberada a partir da
   * mais perto. Só bandeirinhas liberadas. → true se foi.
   * @param {{ n?: number, dir?: number }} to
   */
  function travel({ n, dir } = {}) {
    const open = flags.filter((f) => stateOf(f) !== 'locked');
    if (!open.length) return false;
    let f = null;
    if (Number.isFinite(n)) {
      f = flags.find((g) => g.n === n) || null;
      if (!f) return false;
      if (stateOf(f) === 'locked') {
        emit('hint', { text: TEXT.hint.lockedTravel(f.n), duration: 2.4 });
        return false;
      }
    } else {
      const here = nearest(ctx.ctrls[ctx.activeDog]).f;
      let i = open.indexOf(here);
      i = i < 0 ? (dir > 0 ? 0 : open.length - 1) : (i + (dir > 0 ? 1 : -1) + open.length) % open.length;
      f = open[i];
    }
    const A = ctx.ctrls[ctx.activeDog];
    const from = nearest(A).f;
    emit('map:travel', { from: from?.n ?? null, to: f.n, x: A.x, z: A.z, toX: f.x, toZ: f.z });
    place(f);
    S.sign = undefined; // reavalia a plaquinha no próximo quadro
    return true;
  }

  // ---------- partida ----------
  function objective() {
    const f = nextFlag();
    if (!f) return { text: TEXT.objective.all, target: null, stage: 'explorar' };
    return { text: TEXT.objective.next(f.n, metaOf(f)?.name ?? ''), target: { x: f.x, z: f.z, y: 2.6 }, stage: 'explorar' };
  }

  function update(dt, { active }) {
    S.time += dt;
    const { f, d } = nearest(active);
    const near = f && d < FLAG_NEAR ? f : null;
    if (near !== S.sign) {
      S.sign = near;
      emit('map:sign', signOf(near));
    }
    S.near = near;
    setPrompt(near && stateOf(near) !== 'locked' ? 'enter' : null);
    // o código da fase da bandeirinha liberada mais perto, a até FLAG_PRELOAD m, vai sendo baixado por baixo
    const want = f && d < FLAG_PRELOAD && stateOf(f) !== 'locked' ? f.index : null;
    if (want !== S.preloading) {
      S.preloading = want;
      hub.preload?.(want);
    }
    // encostou nas nuvens (área fechada): uma dica de vez em quando
    if (S.time > S.nextHint) {
      for (const [k, z] of Object.entries(ZONES)) {
        if (zones[k] || k === 'breve') continue;
        const b = z.box;
        const pad = 1.2;
        if (active.x > b.minX - pad && active.x < b.maxX + pad && active.z > b.minZ - pad && active.z < b.maxZ + pad) {
          emit('hint', { text: TEXT.hint.clouds, duration: 2.4 });
          S.nextHint = S.time + 8;
          break;
        }
      }
    }
    return null;
  }

  function interact() {
    const f = S.near;
    if (!f) return false;
    if (stateOf(f) === 'locked') {
      emit('hint', { text: TEXT.hint.locked(f.n), duration: 2.6 });
      emit('map:denied', { n: f.n });
      return true;
    }
    emit('map:enter', { n: f.n, index: f.index, id: f.level });
    hub.enter(f.index);
    return true;
  }

  function reset() {
    S.time = 0;
    S.sign = undefined;
    S.near = null;
    S.preloading = undefined;
    S.prompt = undefined;
    const before = lastVisit;
    applyProgress({ animate: false });
    // de onde as duas aparecem: a bandeirinha da fase que acabou de jogar, ou a próxima (abrindo pelo menu)
    const from = Number.isFinite(hub.from) ? flags.find((f) => f.index === hub.from) : null;
    place(from || nextFlag() || flags[0]);
    const next = nextFlag();
    // abriu algo desde a última visita (nesta sessão): nuvens e ponte animadas e uma olhadinha na novidade
    if (before) {
      const opened = Object.keys(ZONES).filter((k) => zones[k] && !before.open[k]);
      for (const k of opened) {
        props?.clouds?.setOpen?.(k, false, { instant: true });
        props?.clouds?.setOpen?.(k, true, { instant: false, delay: 0.6 });
        if (k === 'chacara') {
          props?.bridge?.setDown?.(false, { instant: true });
          props?.bridge?.setDown?.(true, { instant: false, delay: 1.2 });
        }
        emit('map:unlock', { zone: k, n: ZONES[k].unlock });
      }
      if (next && next.n !== before.next) {
        emit('map:newFlag', { n: next.n });
        cam?.focusShot?.(next.x, next.z, { hold: 1.1 });
      }
    }
    lastVisit = { open: { ...zones }, next: next?.n ?? 0 };
  }

  return {
    stages: STAGES,
    get stage() { return 'explorar'; },
    get carrier() { return null; },
    get collected() { return 0; },
    get total() { return 0; },
    S,
    onStageChange: () => {},
    hub: true,
    objective,
    update,
    interact,
    travel,
    /** Fases liberadas e o estado de cada bandeirinha (UI e testes). */
    flagStates: () => flags.map((f) => ({ n: f.n, id: f.level, index: f.index, state: stateOf(f), treats: rec(f)?.treats ?? 0 })),
    refresh: () => applyProgress({ animate: true }),
    lockFor: () => null,
    lookTarget: (c) => (S.near && Math.hypot(c.x - S.near.x, c.z - S.near.z) < FLAG_NEAR + 0.6 ? { x: S.near.x, y: 1.2, z: S.near.z } : null),
    navFlags: () => ({ leste: zones.leste, chacara: zones.chacara }),
    setPrompt: (k) => setPrompt(k ? 'enter' : null),
    speedScale: () => MAP_SPEED,
    reset,
    jumpToStage: () => null,
    info: () => ({ hub: true, near: S.near?.n ?? null, next: nextFlag()?.n ?? null, zones: { ...zones }, preloading: S.preloading ?? null }),
  };
}
