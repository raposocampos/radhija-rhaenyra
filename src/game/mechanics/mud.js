// Lama nas dogs: uma área da fase enlameia (soak), a dog fica lenta e sem arrancada e a lama sai com o
// Lambe-Lambe da irmã (lick), em placas: cada lambida tira uma parte (1 / licksToClean) e limpa o lugar
// lambido. Na última, a dog sacode as gotinhas (effects.act 'shake') e o pelo brilha (mud:clean).
// O núcleo pergunta ao puzzle speedScale(ctrl) e canDash(ctrl); o puzzle repassa para cá.
// Eventos: mud:soak (entrou na lama, uma vez por mergulho), mud:splash (pisando na lama),
// mud:lick (uma placa saiu: x, y, z, k) e mud:clean (limpinha).
// O visual fica no modelo da dog (dog.setMud(k, pontos limpos), quando existe).

/**
 * @param {{ dogs?: Record<string, { setMud?(k: number, clean?: object[]): void }>,
 *   emit: import('../../types').GameEmit, effects?: { act(name: string, action: string, dur: number): void } | null,
 *   licksToClean?: number, slow?: number, soakRate?: number }} opts
 */
export function createMud({ dogs, emit, effects = null, licksToClean = 5, slow = 0.5, soakRate = 2.2 }) {
  /** @type {Record<string, { k: number, spots: { x: number, y: number, z: number, r: number }[], licks: number, inMud: boolean, splashT: number }>} */
  const st = {};
  const get = (n) => (st[n] ||= { k: 0, spots: [], licks: 0, inMud: false, splashT: 0 });
  const show = (n) => dogs?.[n]?.setMud?.(st[n].k, st[n].spots);

  /**
   * A dog está pisando na lama neste quadro (chame a cada quadro enquanto ela estiver na área). Enlameia
   * depressa e apaga as partes já lambidas. at: { x, z } para os respingos.
   */
  function soak(name, dt, at) {
    const s = get(name);
    if (!s.inMud) {
      s.inMud = true;
      s.splashT = 0;
      emit('mud:soak', { name, x: at?.x, z: at?.z, first: s.k <= 0 });
    }
    s.k = Math.min(1, s.k + dt * soakRate);
    s.spots = [];
    s.licks = 0;
    s.splashT -= dt;
    if (s.splashT <= 0) {
      s.splashT = 0.28;
      emit('mud:splash', { name, x: at?.x, z: at?.z });
    }
    show(name);
  }

  /** Saiu da área de lama (chame quando a dog não está mais nela). */
  function leave(name) {
    if (st[name]) st[name].inMud = false;
  }

  /**
   * Uma lambida da irmã em `name` (puzzle.onLick). Tira uma placa e limpa em volta do ponto lambido.
   * @param {string} name @param {import('../../types').LickInfo} lick
   * @returns {{ cleaned: boolean, k: number, wasMuddy: boolean }}
   */
  function lick(name, lick) {
    const s = get(name);
    if (s.k <= 0) return { cleaned: false, k: 0, wasMuddy: false };
    s.licks++;
    s.k = Math.max(0, s.k - 1 / licksToClean - 1e-9);
    if (s.k < 0.02) s.k = 0;
    const L = lick.local;
    s.spots.push({ x: L.x, y: L.y, z: L.z, r: 0.085 + 0.016 * Math.min(4, s.licks) });
    emit('mud:lick', { name, x: lick.point.x, y: lick.point.y, z: lick.point.z, k: +s.k.toFixed(3), licks: s.licks });
    if (s.k <= 0) {
      s.spots = [];
      s.licks = 0;
      effects?.act(name, 'shake', 0.9);
      emit('mud:clean', { name, x: lick.point.x, z: lick.point.z });
    }
    show(name);
    return { cleaned: s.k <= 0, k: s.k, wasMuddy: true };
  }

  const level = (name) => st[name]?.k || 0;
  return {
    soak, leave, lick, level,
    muddy: (name) => level(name) > 0,
    /** Enlameada anda a `slow` da velocidade; quase limpa, um pouco mais rápido. */
    speedScale: (name) => (level(name) > 0 ? 1 - (1 - slow) * Math.min(1, 0.4 + level(name)) : 1),
    canDash: (name) => level(name) <= 0,
    /** Enlameia de uma vez, sem eventos (?stage= e testes). */
    set(name, k) {
      const s = get(name);
      s.k = Math.max(0, Math.min(1, k));
      s.spots = [];
      s.licks = 0;
      show(name);
    },
    reset() {
      for (const n of Object.keys(st)) {
        st[n] = { k: 0, spots: [], licks: 0, inMud: false, splashT: 0 };
        show(n);
      }
    },
    info: (name) => ({ k: +level(name).toFixed(3), licks: st[name]?.licks || 0, spots: st[name]?.spots.length || 0 }),
  };
}
