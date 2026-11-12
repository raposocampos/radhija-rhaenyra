// Sequenciador de cenas do Modo História (kit de cenas, src/story/scene/).
// Uma cena é uma lista de beats tocados em ordem; cada beat dura `dur` segundos ou espera `until` (com um teto `max`)
// e mexe no que quiser a cada quadro (câmera, dogs, gestos, balões, sons) por tick(S, t, k, dt).
// A regra que garante "o mesmo estado pulando ou não": o que a cena deixa de PERMANENTE (pistas, posição final das
// dogs, etapa da missão, portas abertas) fica em commit(S); os efeitos do caminho (balões, planos de câmera, faixas)
// ficam nos beats e são desfeitos em cleanup(S). No fim normal e no pulo acontecem os mesmos cleanup e commit, nessa
// ordem; pular só deixa de tocar o resto dos beats. Um beat pode marcar `noSkip` (o pulo espera ele acabar: ex. o
// preto da troca de luz já começou).
// Eventos: story:cinema { on, id } (o HUD põe as faixas e some com o resto; o núcleo bloqueia a entrada) e
// story:scene { id, beat, state: 'start' | 'beat' | 'end' | 'skipped' }.

/**
 * @typedef {{ id: string, dur?: number, until?: (S: any, t: number) => boolean, max?: number, noSkip?: boolean,
 *   enter?: (S: any) => void, tick?: (S: any, t: number, k: number, dt: number) => void, leave?: (S: any) => void }} Beat
 */

/**
 * @param {{ id: string, beats: Beat[], emit?: (name: string, payload?: object) => void,
 *   setup?: (S: any) => void, cleanup?: (S: any) => void, commit?: (S: any, how: 'end' | 'skipped') => void }} def
 */
export function createScene(def) {
  const emit = def.emit || (() => {});
  const R = { active: false, i: -1, t: 0, total: 0, done: false, skipped: false, wantSkip: false, S: null };

  function enterBeat(i) {
    R.i = i;
    R.t = 0;
    const b = def.beats[i];
    if (!b) return;
    b.enter?.(R.S);
    emit('story:scene', { id: def.id, beat: b.id, state: 'beat' });
  }

  function finish(how) {
    if (!R.active) return;
    const b = def.beats[R.i];
    if (b && how === 'skipped') b.leave?.(R.S);
    R.active = false;
    R.done = true;
    R.skipped = how === 'skipped';
    def.cleanup?.(R.S);
    def.commit?.(R.S, how);
    emit('story:cinema', { on: false, id: def.id });
    emit('story:scene', { id: def.id, beat: null, state: how });
  }

  /** Pula agora (ou assim que o beat sem pulo acabar). */
  function skip() {
    if (!R.active) return false;
    const b = def.beats[R.i];
    if (b?.noSkip) {
      R.wantSkip = true;
      return true;
    }
    finish('skipped');
    return true;
  }

  return {
    id: def.id,
    /** Começa a cena com o contexto S (o mesmo objeto chega em todos os ganchos). */
    start(S = {}) {
      R.S = S;
      R.active = true;
      R.done = false;
      R.skipped = false;
      R.wantSkip = false;
      R.total = 0;
      def.setup?.(S);
      emit('story:cinema', { on: true, id: def.id });
      emit('story:scene', { id: def.id, beat: def.beats[0]?.id ?? null, state: 'start' });
      enterBeat(0);
    },
    update(dt) {
      if (!R.active) return;
      R.t += dt;
      R.total += dt;
      const b = def.beats[R.i];
      if (!b) {
        finish('end');
        return;
      }
      const k = b.dur ? Math.min(1, R.t / b.dur) : 0;
      b.tick?.(R.S, R.t, k, dt);
      if (!R.active) return; // o tick pode ter pulado
      const over = b.until ? b.until(R.S, R.t) || R.t >= (b.max ?? Infinity) : R.t >= (b.dur ?? 0);
      if (!over) return;
      b.leave?.(R.S);
      if (R.wantSkip) {
        R.wantSkip = false;
        R.i++; // o beat sem pulo acabou: o resto não toca
        finish('skipped');
        return;
      }
      if (R.i + 1 >= def.beats.length) {
        R.i++;
        finish('end');
        return;
      }
      enterBeat(R.i + 1);
    },
    skip,
    /** Termina sem tocar nada (troca de fase, reinício): limpa, sem commit. */
    abort() {
      if (!R.active) return;
      R.active = false;
      def.cleanup?.(R.S);
      emit('story:cinema', { on: false, id: def.id });
    },
    get active() { return R.active; },
    get done() { return R.done; },
    get skipped() { return R.skipped; },
    get beat() { return R.active ? def.beats[R.i]?.id ?? null : null; },
    /** Tempo no beat atual e desde o começo (s). */
    get t() { return R.t; },
    get total() { return R.total; },
    get skippable() { return R.active && !def.beats[R.i]?.noSkip; },
  };
}

// ---------------------------------------------------------------- utilidades das cenas
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const smoother = (x) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const lerp = (a, b, k) => a + (b - a) * k;
/** Ângulo de a até b no plano (yaw 0 olha para +Z, como o controlador das dogs). */
export const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
/** Interpola ângulos pelo caminho mais curto. */
export function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
/** Fração do intervalo [a, b] em que t está (0 antes, 1 depois). */
export const span = (t, a, b) => clamp01((t - a) / Math.max(1e-6, b - a));
