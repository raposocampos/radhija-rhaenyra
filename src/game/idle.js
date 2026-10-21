// Parada por muito tempo (pedido do usuário: "parada muito tempo, coçar, xixi agachada, sentar e deitar"). Sentar vem
// da animação (parada uns segundos, dogAnimation.js, cada dog no seu tempo); aqui, por dog, conta quanto ela está
// parada e livre (sem o jogador mexer nela, sem trava, extra nem cocô, no chão) e manda para a animação o que ela faz
// (`anim.idle`):
//  • coçar: sentada, uma traseira no pescoço, de tempos em tempos, enquanto não deita (a pata alterna). DESLIGADO
//    (IDLE.scratch.on): o usuário pediu para deixar de fora por enquanto ("outro dia refinamos isso"); a pose continua
//    em dogAnimation.js e no sandbox (idle=scratch);
//  • deitar: depois de um bom tempo, e fica (a cabeça descansa nas patas depois de um tempo, dogAnimation.js);
//  • xixi agachada (as duas são fêmeas), raro: em pé, antes de sentar, no chão de verdade, sem nada na boca e com
//    espaço para sair dali; emite dog:pee (a poça que seca, feedback.js). Depois (retorno do usuário: "não deixe ela
//    sentar no mijo, faz ela levantar, dar uma cheirada no mijo e então ela senta em outro lugar, tudo andando
//    naturalmente"), ela anda uma voltinha até a poça (o focinho em cima dela), cheira, sai andando numa curva que não
//    passa pela poça e senta no lugar novo (perto da irmã, de frente para ela). Os dois trechos são caminhos andados de
//    verdade (walkPath.js, como a voltinha do cocô): a trava `lockFor` pede `drive` (o núcleo não a desloca) e ela
//    anda o caminho com a velocidade e o giro de verdade para as patas. Algo entrou no caminho: ela para ali.
// Os tempos são sorteados para cada dog a cada parada, e uma irmã não começa o que a outra acabou de começar
// (retorno do usuário: "as duas fazem a mesma ação ao mesmo tempo"). Qualquer movimento ou comando a levanta: a parada
// recomeça do zero. A companheira só fica na sequência do xixi enquanto a irmã não sai andando (o núcleo decide quando
// ela está livre).
import { buildPath, along, lastOf, speedProfile, dubinsPaths } from './walkPath.js';

/** Tempos (s) e distâncias (m): [de, até] é sorteado a cada parada. */
export const IDLE = Object.freeze({
  /** Coçar: ligado? (desligado a pedido do usuário, a refinar), a primeira vez, de quanto em quanto tempo, quanto dura. */
  scratch: Object.freeze({ on: false, first: [6, 14], every: [6, 14], dur: [2.2, 3.2] }),
  lie: Object.freeze({ at: [20, 34] }),
  /** Xixi: quando (s parada), quanto dura, a chance por parada, de quanto em quanto tempo no máximo (s) e a poça. */
  pee: Object.freeze({ at: [1.5, 3.5], dur: 3.0, chance: 0.12, every: 240, drop: 0.32 }),
  /**
   * Depois do xixi: as velocidades (m/s, a passo) da voltinha até a poça e da saída, a cheirada (s), a folga da poça
   * (m: o meio do corpo nunca passa mais perto; × comprimento da dog / 0,6), a folga da irmã no caminho e no lugar novo
   * (m entre os centros), onde parar perto dela (m; perto dela, no máximo `near` m) e de onde a parada continua (s, já
   * sentada).
   */
  after: Object.freeze({ loop: 0.8, away: 0.9, sniff: 1.4, clear: 0.17, pass: 0.62, space: 0.75, stop: [0.9, 1.1], near: 1.25, sit: 5.5 }),
  /** A irmã começou a mesma coisa há menos disto (s): espera mais um pouco (s); xixi, só bem depois do dela (s). */
  apart: Object.freeze({ within: 2.5, wait: [1.5, 3.5], pee: 90 }),
});

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * @param {{ emit?: (name: string, payload: any) => void, rand?: () => number, ctrls?: Record<string, any>,
 *   world?: () => any, rims?: () => { x: number, z: number, r: number, t: number }[] }} [o]
 *   ctrls: os controles das dogs (a sequência depois do xixi as move; sem eles, ela só não senta na poça); world: a
 *   colisão do cenário (overlaps); rims: as bordas de caminha (o caminho não passa por cima delas).
 */
export function createIdle({ emit = () => {}, rand = () => Math.random(), ctrls = {}, world = () => null, rims = () => [] } = {}) {
  /**
   * @typedef {{ phase: 'loop' | 'sniff' | 'away', t: number, path?: any, prof?: any, snd?: boolean }} After
   * @typedef {{ t: number, next: number, side: number, scr: number, scrDur: number, pee: number,
   *   peeRoll: number, lieAt: number, rolled: boolean, dropped: boolean, clock: number, sat: boolean, stand: boolean,
   *   lying: boolean,
   *   last: { scratch: number, lie: number, pee: number }, puddle: { x: number, z: number } | null,
   *   after: After | null }} IdleState
   * @type {Record<string, IdleState>}
   */
  let S = {};
  /** Um tempo sorteado no intervalo [de, até]. @param {readonly number[]} r */
  const between = (r) => r[0] + (r[1] - r[0]) * rand();
  /** Uma parada nova: os tempos dela, sorteados para esta dog. @param {IdleState} D */
  const roll = (D) => {
    D.t = 0;
    D.next = between(IDLE.scratch.first);
    D.lieAt = between(IDLE.lie.at);
    D.peeRoll = between(IDLE.pee.at);
    D.scr = D.pee = -1;
    D.rolled = false;
    D.sat = D.stand = D.lying = false;
  };
  /** @param {string} n @returns {IdleState} */
  const st = (n) => {
    if (!S[n]) {
      const D = /** @type {IdleState} */ ({
        side: rand() < 0.5 ? 1 : -1, clock: 0, dropped: false, puddle: null, after: null, scrDur: 2.6,
        last: { scratch: -Infinity, lie: -Infinity, pee: -Infinity },
      });
      roll(D);
      S[n] = D;
    }
    return S[n];
  };
  /** @type {Record<string, { kind: 'scratch' | 'lie' | 'pee' | 'sit' | 'stand', k: number, t: number, side: number } | null>} */
  const now = {};
  /** O xixi ligado (os testes que medem onde as dogs ficam o desligam: um sorteio não as tira do lugar; setPee). */
  let peeOn = true;
  /** A irmã (o outro controle), ou null. */
  const sisterOf = (n) => {
    for (const m of Object.keys(ctrls)) if (m !== n) return ctrls[m];
    return null;
  };
  /** A irmã começou isto há pouco (o relógio de cada uma anda junto: as duas a cada quadro)? */
  const sisterJust = (n, kind, within) => {
    for (const m of Object.keys(S)) {
      if (m !== n && S[m].clock - S[m].last[kind] < within) return true;
    }
    return false;
  };

  // ------------------------------------------------------------------ depois do xixi: os caminhos
  /** O tamanho da dog (× o da Radhija). */
  const scaleOf = (c) => (c.cfg?.visual?.length ?? 0.6) / 0.6;
  /**
   * O corpo cabe em (x, z): sem colisor, fora das bordas de caminha e longe da irmã (os corpos são compridos: no
   * caminho planejado, IDLE.after.pass entre os centros). Andando, só para se algo chegou perto de verdade (mais que a
   * separação das duas, game.js: ela para antes de a irmã ser empurrada).
   */
  function roomy(c, x, z, o, walking = false) {
    const W = world();
    if (W?.overlaps && W.overlaps(x, z, (c.r ?? 0.2) * (walking ? 0.97 : 1), c.size)) return false;
    for (const g of rims()) if (Math.hypot(x - g.x, z - g.z) < g.r + g.t + (c.r ?? 0.2) + (walking ? 0 : 0.03)) return false;
    const gap = (c.r ?? 0.2) + (o?.r ?? 0.2) + 0.06;
    return !o || Math.hypot(x - o.x, z - o.z) > (walking ? gap : Math.max(gap + 0.03, IDLE.after.pass));
  }
  /** O caminho inteiro cabe e o meio do corpo não passa a menos de `clear` m da poça. */
  function fits(c, path, o, P, clear) {
    for (let i = 2; i < path.s.length; i += 2) {
      if (!roomy(c, path.x[i], path.z[i], o)) return false;
      if (Math.hypot(path.x[i] - P.x, path.z[i] - P.z) < clear) return false;
    }
    const j = path.s.length - 1;
    return roomy(c, path.x[j], path.z[j], o);
  }
  /**
   * O caminho mais curto que cabe (de `from` até uma das poses `ends`, em curva-reta-curva de raio `radii`, o maior
   * primeiro: mais suave), até `max` m. → caminho ou null.
   */
  function shortest(from, ends, radii, max, ok) {
    for (const r of radii) {
      let best = null;
      for (const e of ends) {
        for (const d of dubinsPaths(from.x, from.z, from.yaw, e.x, e.z, e.yaw, r)) {
          if (d.len > max || (best && d.len >= best.len)) continue;
          const path = buildPath(from.x, from.z, from.yaw, d.segs);
          if (ok(path)) best = { len: d.len, path };
        }
      }
      if (best) return best.path;
    }
    return null;
  }
  /**
   * Até a poça (atrás dela), andando (curva, reta, curva: nada de girar parada): termina de frente para a poça, com o
   * focinho em cima dela, do lado em que couber (sem passar por cima dela nem encostar na irmã). → caminho ou null.
   */
  function planLoop(c, P, o) {
    const L = c.cfg?.visual?.length ?? 0.6;
    const n = 0.55 * L; // do meio do corpo ao focinho, cheirando
    const b = Math.hypot(P.x - c.x, P.z - c.z);
    /** @type {{ x: number, z: number, yaw: number }[]} */
    const ends = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ends.push({ x: P.x + Math.sin(a) * n, z: P.z + Math.cos(a) * n, yaw: a + Math.PI });
    }
    return shortest(c, ends, [0.32 * L, 0.25 * L], 2.6 * L, (path) => fits(c, path, o, P, Math.min(b, n) * 0.85));
  }
  /**
   * Saindo da poça (de onde ela está, `from`), andando: com a irmã por perto, até perto dela (sem encostar), de frente
   * para ela; senão (ou sem caminho até lá), para um lugar livre em volta da poça. O caminho não passa por cima da poça e
   * o lugar novo fica longe dela (a garupa também). → caminho ou null.
   */
  function planAway(c, P, o, from) {
    const L = c.cfg?.visual?.length ?? 0.6;
    const k = scaleOf(c);
    const back = (c.cfg?.body?.back ?? 0.25) * 0.7;
    // com a irmã por perto, o lugar novo continua perto dela (a companheira não é chamada de volta pela IA, que segue a
    // líder a até ~1,3 m; a líder não faz a irmã levantar)
    const keepNear = !!o && Math.hypot(o.x - from.x, o.z - from.z) < 1.6;
    const ok = (path) => {
      const e = lastOf(path);
      if (Math.hypot(e.x - P.x, e.z - P.z) < 0.55 * k) return false;
      if (Math.hypot(e.x - Math.sin(e.yaw) * back - P.x, e.z - Math.cos(e.yaw) * back - P.z) < 0.35 * k) return false;
      if (o && Math.hypot(e.x - o.x, e.z - o.z) < IDLE.after.space) return false;
      if (keepNear && Math.hypot(e.x - o.x, e.z - o.z) > IDLE.after.near) return false;
      return fits(c, path, o, P, IDLE.after.clear * k);
    };
    const radii = [0.32 * L, 0.25 * L];
    if (o && Math.hypot(o.x - from.x, o.z - from.z) < 2.4) {
      const stop = between(IDLE.after.stop);
      const near = [];
      for (let i = 0; i < 12; i++) {
        const a = ((i + rand() * 0.5) / 12) * Math.PI * 2;
        near.push({ x: o.x + Math.sin(a) * stop, z: o.z + Math.cos(a) * stop, yaw: a + Math.PI });
      }
      const path = shortest(from, near, radii, 3.2 * L, ok);
      if (path) return path;
    }
    const spots = [];
    for (let i = 0; i < 10; i++) {
      const a = rand() * Math.PI * 2;
      const d = (0.7 + 0.35 * rand()) * k;
      const x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d;
      // com a irmã por perto, termina de frente para ela (a IA da companheira, parada, vira para a líder: virando ali,
      // ela giraria parada e levantaria)
      spots.push({ x, z, yaw: keepNear ? Math.atan2(o.x - x, o.z - z) : a + (rand() - 0.5) * 1.2 });
    }
    return shortest(from, spots, radii, 3.2 * L, ok);
  }
  /** Há espaço para sair da poça depois (a voltinha até ela ou, sem isso, sair andando)? */
  function canLeave(n, at) {
    const c = ctrls[n];
    if (!c || !at) return true;
    const o = sisterOf(n);
    return !!(planLoop(c, at, o) || planAway(c, at, o, { x: c.x, z: c.z, yaw: c.yaw }));
  }
  const _o = { x: 0, z: 0, yaw: 0, k: 0, d: 0, v: 0 };
  /** Um quadro andando o caminho (ela se põe no ponto; as patas acompanham). → 'walk' | 'done' | 'blocked' */
  function walk(c, o, A, dt) {
    A.t += dt;
    const T = A.prof.T;
    A.prof.at(Math.min(A.t, T), _o);
    along(A.path, _o.d, _o);
    // algo que se mexe entrou no caminho (a irmã, um bicho): ela para onde está
    if (A.t < T && !roomy(c, _o.x, _o.z, o, true)) return 'blocked';
    c.x = _o.x;
    c.z = _o.z;
    c.yaw = wrap(_o.yaw);
    c.v = 0;
    c.vx = c.vz = 0;
    c.animSpeed = A.t < T ? _o.v : 0;
    c.yawRate = c.animSpeed * _o.k;
    return A.t >= T ? 'done' : 'walk';
  }
  const stopWalk = (c) => {
    c.animSpeed = 0;
    c.yawRate = 0;
  };
  /** Sai da poça andando (de onde está); sem caminho, fica ali (senta só longe da poça). */
  function startAway(n, D) {
    const c = ctrls[n];
    const path = planAway(c, D.puddle, sisterOf(n), { x: c.x, z: c.z, yaw: c.yaw });
    if (path) {
      D.after = { phase: 'away', t: 0, path, prof: speedProfile(path.len, IDLE.after.away * Math.sqrt(scaleOf(c)), 0.25, 0.35) };
      return;
    }
    stopWalk(c);
    settle(n, D);
  }
  /** A sequência acabou onde ela está: senta (longe da poça) ou fica em pé (ainda em cima dela). */
  function settle(n, D) {
    const c = ctrls[n];
    D.after = null;
    const back = (c.cfg?.body?.back ?? 0.25) * 0.7;
    const rx = c.x - Math.sin(c.yaw) * back, rz = c.z - Math.cos(c.yaw) * back;
    if (D.puddle && Math.hypot(rx - D.puddle.x, rz - D.puddle.z) < 0.3 * scaleOf(c)) D.stand = true;
    else D.sat = true;
    D.t = IDLE.after.sit;
    D.next = D.t + between(IDLE.scratch.every);
    D.lieAt = Math.max(D.lieAt, D.t + 8); // sentada um tempo antes de deitar
    D.rolled = true;
  }

  /** A sequência depois do xixi (um quadro): a voltinha até a poça, a cheirada e a saída até o lugar novo. */
  function stepAfter(n, D, dt) {
    const A = D.after;
    const c = ctrls[n];
    if (!A || !c || !D.puddle) {
      D.after = null;
      return;
    }
    if (A.phase === 'sniff') {
      A.t += dt;
      if (!A.snd && A.t > 0.15) {
        A.snd = true;
        emit('dog:sniff', { name: n, x: c.x, z: c.z });
      }
      if (A.t >= IDLE.after.sniff) startAway(n, D);
      return;
    }
    const r = walk(c, sisterOf(n), A, dt);
    if (r === 'walk') return;
    stopWalk(c);
    if (A.phase === 'loop') {
      // chegou de frente para a poça: cheira (algo no caminho: sai dali sem cheirar)
      if (r === 'done') D.after = { phase: 'sniff', t: 0, snd: false };
      else startAway(n, D);
      return;
    }
    settle(n, D);
  }
  /** Começa a sequência depois do xixi: a voltinha até a poça ou, sem espaço para ela, já sai dali. */
  function startAfter(n, D) {
    const c = ctrls[n];
    const path = planLoop(c, D.puddle, sisterOf(n));
    if (path) D.after = { phase: 'loop', t: 0, path, prof: speedProfile(path.len, IDLE.after.loop * Math.sqrt(scaleOf(c)), 0.25, 0.3) };
    else startAway(n, D);
  }

  return {
    /**
     * Um quadro da dog `n`: `still` = parada e livre (o núcleo decide; na sequência depois do xixi, só "ninguém mexeu
     * nela"); `canPee` = pode fazer xixi agora (chão de verdade, sem nada na boca); `at` = onde fica a poça (o meio da
     * garupa). → o que a animação recebe, ou null.
     * @param {string} n @param {number} dt
     * @param {{ still: boolean, canPee?: boolean, at?: { x: number, z: number } | null }} o
     */
    step(n, dt, { still, canPee = false, at = null }) {
      const D = st(n);
      D.clock += dt;
      if (!still) {
        // mexeu: levanta (o xixi ou a sequência depois dele termina na hora; a próxima parada sorteia de novo)
        if (D.after && ctrls[n]) stopWalk(ctrls[n]);
        if (D.t > 0 || D.after || D.pee >= 0 || D.sat || D.stand) roll(D);
        D.after = null;
        return (now[n] = null);
      }
      if (D.after) {
        stepAfter(n, D, dt);
        if (D.after) return (now[n] = null);
        // acabou agora: segue daqui (no lugar novo)
      } else D.t += dt;
      // xixi: raro, uma vez por parada, sorteado, em pé (antes de sentar), longe do último (e do da irmã) e com espaço
      // para sair dali
      if (!D.rolled && D.t >= D.peeRoll) {
        D.rolled = true;
        if (peeOn && canPee && D.clock - D.last.pee >= IDLE.pee.every && !sisterJust(n, 'pee', IDLE.apart.pee) && rand() < IDLE.pee.chance && canLeave(n, at)) {
          D.pee = 0;
          D.last.pee = D.clock;
          D.dropped = false;
          D.puddle = null;
        }
      }
      if (D.pee >= 0) {
        D.pee += dt;
        const k = Math.min(1, D.pee / IDLE.pee.dur);
        if (!D.dropped && k >= IDLE.pee.drop) {
          D.dropped = true;
          if (at) {
            D.puddle = { x: at.x, z: at.z };
            emit('dog:pee', { name: n, x: at.x, z: at.z });
          }
        }
        if (k < 1) return (now[n] = { kind: 'pee', k, t: D.pee, side: D.side });
        D.pee = -1;
        // levanta, cheira a poça e vai sentar em outro lugar (sem os controles, a parada só continua)
        if (D.puddle && ctrls[n]) startAfter(n, D);
        else D.t = D.peeRoll;
        return (now[n] = null);
      }
      // em pé perto da poça (não deu para sair dali): nada de sentar, coçar ou deitar
      if (D.stand) return (now[n] = { kind: 'stand', k: 1, t: D.t, side: D.side });
      if (D.t >= D.lieAt) {
        if (!D.lying && sisterJust(n, 'lie', IDLE.apart.within)) {
          // a irmã acabou de deitar: espera um pouco
          D.lieAt = D.t + between(IDLE.apart.wait);
        } else {
          if (!D.lying) {
            D.lying = true;
            D.last.lie = D.clock;
          }
          D.scr = -1;
          return (now[n] = { kind: 'lie', k: Math.min(1, (D.t - D.lieAt) / 1.2), t: D.t - D.lieAt, side: D.side });
        }
      }
      // coçar: sentada (a animação senta sozinha), de tempos em tempos; a pata alterna
      if (IDLE.scratch.on && D.scr < 0 && D.t >= D.next && D.t + IDLE.scratch.dur[1] < D.lieAt) {
        if (sisterJust(n, 'scratch', IDLE.apart.within)) D.next = D.t + between(IDLE.apart.wait);
        else {
          D.scr = 0;
          D.scrDur = between(IDLE.scratch.dur);
          D.side = -D.side;
          D.last.scratch = D.clock;
          emit('dog:scratch', { name: n });
        }
      }
      if (D.scr >= 0) {
        D.scr += dt;
        const k = D.scr / D.scrDur;
        if (k < 1) return (now[n] = { kind: 'scratch', k, t: D.scr, side: D.side });
        D.scr = -1;
        D.next = D.t + between(IDLE.scratch.every);
      }
      // sentou num lugar novo (depois do xixi): continua sentada
      return (now[n] = D.sat ? { kind: 'sit', k: 1, t: D.t, side: D.side } : null);
    },
    /** A dog `n` está na sequência depois do xixi (andando, cheirando)? */
    driving: (n) => !!S[n]?.after,
    /**
     * A trava da sequência depois do xixi: andando um caminho (drive: ela mesma se põe em cada ponto; no fim da
     * voltinha, já farejando) ou cheirando a poça. A menor das travas (o núcleo pergunta depois dos extras e do
     * puzzle); `idle` a marca.
     */
    lockFor(n) {
      const D = S[n];
      const A = D?.after;
      const c = ctrls[n];
      if (!A || !c || !D.puddle) return null;
      const P = D.puddle;
      if (A.phase === 'sniff') return { action: 'sniff', faceX: P.x, faceZ: P.z, idle: true };
      const sniffing = A.phase === 'loop' && A.t > A.prof.T * 0.62;
      return { action: sniffing ? 'sniff' : 'none', faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), drive: true, idle: true };
    },
    /** O que a dog `n` está fazendo agora (ou null). */
    anim: (n) => now[n] ?? null,
    /** Liga ou desliga o xixi (os testes e as partidas automáticas que medem onde as dogs ficam o desligam). */
    setPee(on) {
      peeOn = !!on;
    },
    /** Há quanto tempo a dog `n` está parada (s). */
    stillFor: (n) => S[n]?.t ?? 0,
    /** Troca de fase ou reinício: tudo do zero. */
    reset() {
      S = {};
      for (const k of Object.keys(now)) now[k] = null;
    },
    info: () => Object.fromEntries(Object.entries(S).map(([n, D]) => [n, {
      t: +D.t.toFixed(2), kind: now[n]?.kind ?? null, after: D.after?.phase ?? null,
      puddle: D.puddle ? { x: +D.puddle.x.toFixed(2), z: +D.puddle.z.toFixed(2) } : null,
    }])),
  };
}
