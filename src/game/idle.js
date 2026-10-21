// Parada por muito tempo (pedido do usuário: "parada muito tempo, coçar, xixi agachada, sentar e deitar"). Sentar já
// vem da animação (5 s parada, dogAnimation.js); aqui, por dog, conta quanto ela está parada e livre (sem o jogador
// mexer nela, sem trava, extra nem cocô, no chão) e manda para a animação o que ela faz (`anim.idle`):
//  • coçar: sentada, uma traseira atrás da orelha, de olhinho fechado, aos SCRATCH.first s e depois de tempos em
//    tempos, enquanto não deita (a pata alterna);
//  • deitar: aos LIE.at s, e fica (a cabeça descansa nas patas depois de um tempo, dogAnimation.js);
//  • xixi agachada (as duas são fêmeas): às vezes (PEE.chance por parada, no máximo uma a cada PEE.every s), em pé,
//    antes de sentar, no chão de verdade e sem nada na boca; na hora, emite dog:pee e o chão ganha uma poça que seca
//    (feedback.js).
// Qualquer movimento ou comando a levanta: a parada recomeça do zero. Nada disso trava a dog (a companheira continua
// seguindo a irmã normalmente: andando, a parada acaba).

/** Tempos (s). */
export const IDLE = Object.freeze({
  scratch: Object.freeze({ first: 8, every: [7, 11], dur: 2.6 }),
  lie: Object.freeze({ at: 24 }),
  pee: Object.freeze({ at: 2.2, dur: 3.0, chance: 0.3, every: 120, drop: 0.32 }),
});

/**
 * @param {{ emit?: (name: string, payload: any) => void, rand?: () => number }} [o]
 */
export function createIdle({ emit = () => {}, rand = Math.random } = {}) {
  /** @type {Record<string, { t: number, next: number, side: number, scr: number, pee: number, peeAt: number, rolled: boolean, dropped: boolean, clock: number }>} */
  let S = {};
  const fresh = () => ({ t: 0, next: IDLE.scratch.first, side: 1, scr: -1, pee: -1, peeAt: -Infinity, rolled: false, dropped: false, clock: 0 });
  const st = (n) => (S[n] ??= fresh());
  const between = ([a, b]) => a + (b - a) * rand();
  /** @type {Record<string, { kind: 'scratch' | 'lie' | 'pee', k: number, t: number, side: number } | null>} */
  const now = {};

  return {
    /**
     * Um quadro da dog `n`: `still` = parada e livre (o núcleo decide); `canPee` = pode fazer xixi agora (chão de
     * verdade, sem nada na boca); `at` = onde fica a poça (o meio da garupa). → o que a animação recebe, ou null.
     * @param {string} n @param {number} dt
     * @param {{ still: boolean, canPee?: boolean, at?: { x: number, z: number } }} o
     */
    step(n, dt, { still, canPee = false, at = null }) {
      const D = st(n);
      D.clock += dt;
      if (!still) {
        // mexeu: levanta (o xixi que começou termina na hora; a próxima parada sorteia de novo)
        D.t = 0;
        D.next = IDLE.scratch.first;
        D.scr = D.pee = -1;
        D.rolled = false;
        now[n] = null;
        return null;
      }
      D.t += dt;
      // xixi: uma vez por parada, sorteado, em pé (antes de sentar) e longe do último
      if (!D.rolled && D.t >= IDLE.pee.at) {
        D.rolled = true;
        if (canPee && D.clock - D.peeAt >= IDLE.pee.every && rand() < IDLE.pee.chance) {
          D.pee = 0;
          D.peeAt = D.clock;
          D.dropped = false;
        }
      }
      if (D.pee >= 0) {
        D.pee += dt;
        const k = Math.min(1, D.pee / IDLE.pee.dur);
        if (!D.dropped && k >= IDLE.pee.drop) {
          D.dropped = true;
          if (at) emit('dog:pee', { name: n, x: at.x, z: at.z });
        }
        if (k >= 1) {
          D.pee = -1;
          // depois do xixi, a parada recomeça (senta 5 s depois, como sempre)
          D.t = IDLE.pee.at;
        } else return (now[n] = { kind: 'pee', k, t: D.pee, side: D.side });
      }
      if (D.t >= IDLE.lie.at) {
        D.scr = -1;
        return (now[n] = { kind: 'lie', k: Math.min(1, (D.t - IDLE.lie.at) / 1.2), t: D.t - IDLE.lie.at, side: D.side });
      }
      // coçar: sentada (a animação senta aos 5 s), de tempos em tempos; a pata alterna
      if (D.scr < 0 && D.t >= D.next && D.t + IDLE.scratch.dur < IDLE.lie.at) {
        D.scr = 0;
        D.side = -D.side;
        emit('dog:scratch', { name: n });
      }
      if (D.scr >= 0) {
        D.scr += dt;
        const k = D.scr / IDLE.scratch.dur;
        if (k >= 1) {
          D.scr = -1;
          D.next = D.t + between(IDLE.scratch.every);
        } else return (now[n] = { kind: 'scratch', k, t: D.scr, side: D.side });
      }
      return (now[n] = null);
    },
    /** O que a dog `n` está fazendo agora (ou null). */
    anim: (n) => now[n] ?? null,
    /** Há quanto tempo a dog `n` está parada (s). */
    stillFor: (n) => S[n]?.t ?? 0,
    /** Troca de fase ou reinício: tudo do zero. */
    reset() {
      S = {};
      for (const k of Object.keys(now)) now[k] = null;
    },
    info: () => Object.fromEntries(Object.entries(S).map(([n, D]) => [n, { t: +D.t.toFixed(2), kind: now[n]?.kind ?? null }])),
  };
}
