// Extras escondidos. Nada no jogo os anuncia (nenhuma dica, menu, tela de controles, conquista ou texto); a nota
// técnica fica em docs/ARQUITETURA.md ("Extras") para ninguém remover por engano.
//  • Cocô: código 'KeyC' (tecla C; R3 no controle). Só depois de pegar todos os ossinhos da fase e uma vez por
//    tentativa (reiniciar libera de novo). A dog ativa, parada no chão e sem nada na boca, agacha, faz força, solta
//    um cocozinho de desenho (src/world/poop.js) e cava com as traseiras; a irmã por perto vira a cara.
//  • Animações do cenário: E perto de um ponto da fase (EXTRAS na definição da fase), quando a fase não usou o E:
//    beber, comer, cavar, cheirar e espirrar, focinhar a bola, rolar, balançar, levar um esguicho. Valem sempre.
// Tudo avança por dt (pausa congela). O núcleo pergunta lockFor(nome) antes do puzzle e passa poopK/extra para a
// animação (src/dogs/dogAnimation.js). Eventos: extra:start {kind}, extra:strain, extra:plop, extra:relief,
// extra:scratch, extra:end, extra:lap, extra:crunch, extra:dig, extra:sneeze, extra:nudge, extra:roll, extra:swing,
// extra:hop, extra:spurt (sempre com x, z) e dog:yuck (a irmã).
import { createPoop } from '../world/poop.js';
import { POOP_DROP, POOP_KICKS, SNEEZE_AT, NUDGE_AT, DIG_RATE } from '../dogs/dogAnimation.js';

/** Duração da sequência do cocô (s). */
export const POOP_TIME = 4.8;
/** Duração de cada animação do cenário (s). */
export const EXTRA_TIME = Object.freeze({ drink: 3.0, eat: 3.0, dig: 2.6, sneeze: 2.4, nudge: 1.7, roll: 3.8, swing: 6.0, spurt: 2.4 });
const STRAIN_AT = [0.2, 0.31, 0.42];
const RELIEF_AT = 0.57;
const YUCK = { from: 0.45, to: 0.78, r: 4 };
const ALIGN_T = 0.25; // s para chegar ao ponto e virar para o objeto
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** @typedef {import('../types').ExtraSpot} ExtraSpot */

/**
 * @param {{ emit: import('../types').GameEmit, ctrls: Record<import('../types').DogName, import('../types').DogController>,
 *   carries: (name: import('../types').DogName) => boolean, camera?: { position: { x: number, z: number } } | null,
 *   resolve?: (x: number, z: number, r: number, size: import('../types').DogSize) => { x: number, z: number } }} opts
 */
export function createExtras({ emit, ctrls, carries, camera = null, resolve = (x, z) => ({ x, z }) }) {
  /** @type {ExtraSpot[]} */
  let spots = [];
  /** @type {import('three').Object3D | null} */
  let root = null;
  /** @type {any} */
  let hooks = {};
  const fresh = () => ({
    used: false,
    /** @type {null | { who: import('../types').DogName, t: number, x: number, z: number, yaw: number, marks: Set<string>, kick: number }} */
    poop: null,
    /** @type {null | { who: import('../types').DogName, spot: ExtraSpot, t: number, dur: number, x0: number, z0: number, yaw0: number, x: number, z: number, yaw: number, y: number, marks: Set<string>, n: number, slope: number, action: string }} */
    act: null,
    /** @type {ReturnType<typeof createPoop>[]} */
    poops: [],
  });
  let S = fresh();

  const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
  const grounded = (c) => !(c.jumpT > 0) && !(c.wallDur > 0) && (c.y || 0) < 0.02 && !(c.dashT > 0);
  const busy = (n) => S.poop?.who === n || S.act?.who === n;
  /** Marca um momento da sequência (uma vez). */
  const once = (set, key, cond) => {
    if (!cond || set.has(key)) return false;
    set.add(key);
    return true;
  };

  // ------------------------------------------------------------------ cocô
  /**
   * Tenta começar o cocô com a dog ativa c. allTreats: pegou todos os ossinhos da fase. free: nada travando a dog
   * (puzzle, Lambe-Lambe, superbafo). → true se começou.
   */
  function tryPoop(c, { allTreats, free = true }) {
    if (S.used || S.poop || S.act || !allTreats || !free) return false;
    if (!grounded(c) || carries(c.name)) return false;
    S.used = true;
    S.poop = { who: c.name, t: 0, x: c.x, z: c.z, yaw: c.yaw, marks: new Set(), kick: 0 };
    c.v = 0;
    c.vx = c.vz = 0;
    c.animSpeed = 0;
    emit('extra:start', { kind: 'poop', name: c.name, x: c.x, z: c.z });
    return true;
  }
  function stepPoop(dt) {
    const P = S.poop;
    if (!P) return;
    const c = ctrls[P.who];
    P.t += dt;
    const p = Math.min(1, P.t / POOP_TIME);
    c.x = P.x;
    c.z = P.z;
    c.yaw = P.yaw;
    c.v = 0;
    c.vx = c.vz = 0;
    c.animSpeed = 0;
    const fx = Math.sin(P.yaw);
    const fz = Math.cos(P.yaw);
    const back = c.r * 1.7;
    STRAIN_AT.forEach((k, i) => { if (once(P.marks, `s${i}`, p >= k)) emit('extra:strain', { name: P.who, x: c.x, z: c.z, n: i }); });
    if (once(P.marks, 'plop', p >= POOP_DROP)) {
      const x = c.x - fx * back;
      const z = c.z - fz * back;
      dropPoop(x, z, c.name);
      emit('extra:plop', { name: P.who, x, z });
    }
    if (once(P.marks, 'relief', p >= RELIEF_AT)) emit('extra:relief', { name: P.who, x: c.x, y: c.cfg?.visual?.headTop ?? 0.5, z: c.z });
    // patadas de cavar: terrinha voando para trás, do lado de cada pata
    const kf = (p - POOP_KICKS.from) / (POOP_KICKS.to - POOP_KICKS.from) * POOP_KICKS.n;
    const ki = Math.floor(kf + 0.72); // a terrinha sai no meio da patada
    if (kf > -0.7 && ki > P.kick && ki <= POOP_KICKS.n) {
      P.kick = ki;
      const side = (ki - 1) % 2 === 0 ? 1 : -1;
      const sx = -fz * side * c.r * 0.45;
      const sz = fx * side * c.r * 0.45;
      emit('extra:scratch', { name: P.who, x: c.x - fx * back * 0.9 + sx, z: c.z - fz * back * 0.9 + sz, dirX: -fx, dirZ: -fz });
    }
    if (p >= 1) {
      emit('extra:end', { kind: 'poop', name: P.who, x: c.x, z: c.z });
      S.poop = null;
    }
  }
  function dropPoop(x, z) {
    const poop = createPoop({ scale: 1 });
    poop.object.position.set(x, 0, z);
    // a carinha olha para a câmera
    const cx = camera?.position.x ?? x;
    const cz = camera?.position.z ?? z + 5;
    poop.object.rotation.y = Math.atan2(cx - x, cz - z);
    root?.add(poop.object);
    poop.appear();
    S.poops.push(poop);
  }

  // ------------------------------------------------------------------ animações do cenário
  /** O ponto mais perto que a dog c alcança (de frente e dentro do raio), ou null. */
  function spotFor(c, flags) {
    let best = null;
    let bd = Infinity;
    for (const sp of spots) {
      if (sp.size && sp.size !== c.size) continue;
      if (sp.when && !flags?.[sp.when]) continue;
      const pos = spotPos(sp);
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d > (sp.r ?? 0.6) || d >= bd) continue;
      const face = sp.face ?? pos;
      const want = Math.atan2(face.x - c.x, face.z - c.z);
      if (d > 0.08 && Math.abs(wrap(want - c.yaw)) > 1.35) continue; // de costas não vale
      best = sp;
      bd = d;
    }
    return best;
  }
  /** Posição atual do ponto (a bola anda). */
  function spotPos(sp) {
    if (sp.kind === 'nudge' && hooks.ball) return { x: hooks.ball.x, z: hooks.ball.z };
    return { x: sp.x, z: sp.z };
  }
  /** E perto de um ponto do cenário (a fase não usou o E). flags: navFlags do puzzle. → true se começou. */
  function interact(c, flags = {}) {
    if (S.poop || S.act || !grounded(c) || carries(c.name)) return false;
    const sp = spotFor(c, flags);
    if (!sp) return false;
    const pos = spotPos(sp);
    const stand = sp.stand ?? { x: c.x, z: c.z };
    const face = sp.face ?? pos;
    const yaw = Math.atan2(face.x - stand.x, face.z - stand.z);
    S.act = {
      who: c.name, spot: sp, t: 0, dur: EXTRA_TIME[sp.kind] ?? 2.5, x0: c.x, z0: c.z, yaw0: c.yaw,
      x: stand.x, z: stand.z, yaw, y: 0, marks: new Set(), n: 0, slope: 0, action: 'none',
    };
    c.v = 0;
    c.vx = c.vz = 0;
    emit('extra:start', { kind: sp.kind, id: sp.id, name: c.name, x: pos.x, z: pos.z });
    return true;
  }
  function stepAct(dt) {
    const A = S.act;
    if (!A) return;
    const c = ctrls[A.who];
    A.t += dt;
    const k = Math.min(1, A.t / A.dur);
    const sp = A.spot;
    A.action = 'none';
    A.slope = 0;
    let x = A.x;
    let z = A.z;
    let y = 0;
    let yaw = A.yaw;
    // chega ao ponto e vira para o objeto
    const a = smooth(A.t / ALIGN_T);
    if (sp.kind !== 'swing') {
      x = A.x0 + (A.x - A.x0) * a;
      z = A.z0 + (A.z - A.z0) * a;
      yaw = A.yaw0 + wrap(A.yaw - A.yaw0) * a;
    }
    const pos = spotPos(sp);
    if (sp.kind === 'drink' || sp.kind === 'eat') {
      const rate = sp.kind === 'drink' ? 3.6 : 2.6;
      const n = Math.floor(Math.max(0, A.t - 0.4) * rate);
      if (k < 0.86 && n > A.n) {
        A.n = n;
        emit(sp.kind === 'drink' ? 'extra:lap' : 'extra:crunch', { name: A.who, x: pos.x, z: pos.z, color: sp.color });
      }
    } else if (sp.kind === 'dig') {
      const n = Math.floor(Math.max(0, A.t - 0.3) * DIG_RATE);
      if (k < 0.86 && n > A.n) {
        A.n = n;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        emit('extra:dig', { name: A.who, x: x + fx * c.r * 1.2, z: z + fz * c.r * 1.2, dirX: -fx, dirZ: -fz, color: sp.color });
      }
    } else if (sp.kind === 'sneeze') {
      if (once(A.marks, 'sniff', k >= 0.08)) emit('extra:sniff', { name: A.who, x: pos.x, z: pos.z });
      if (once(A.marks, 'sneeze', k >= SNEEZE_AT)) emit('extra:sneeze', { name: A.who, x: x + Math.sin(yaw) * 0.3, y: 0.35, z: z + Math.cos(yaw) * 0.3, particles: sp.particles, color: sp.color });
    } else if (sp.kind === 'nudge') {
      if (once(A.marks, 'nudge', k >= NUDGE_AT)) {
        emit('extra:nudge', { name: A.who, x: pos.x, z: pos.z });
        hooks.ball?.roll(Math.sin(yaw), Math.cos(yaw));
      }
    } else if (sp.kind === 'roll') {
      // sobe na pilha, rola e desce
      const up = smooth(A.t / 0.35) * (1 - smooth((k - 0.88) / 0.12));
      y = (sp.y ?? 0) * up;
      const n = Math.floor(A.t * 2.2);
      if (k > 0.2 && k < 0.8 && n > A.n) {
        A.n = n;
        emit('extra:roll', { name: A.who, x, z, color: sp.color });
      }
    } else if (sp.kind === 'swing') {
      const r = rideSwing(A, c, k);
      x = r.x; z = r.z; y = r.y; yaw = r.yaw;
    } else if (sp.kind === 'spurt') {
      // fareja o irrigador, leva um esguicho no focinho, se assusta e se sacode
      A.action = k < 0.38 ? 'sniff' : k < 0.5 ? 'startled' : k < 0.9 ? 'shake' : 'none';
      if (once(A.marks, 'spurt', k >= 0.38)) emit('extra:spurt', { name: A.who, x: pos.x, y: 0.3, z: pos.z, dirX: Math.sin(yaw + Math.PI), dirZ: Math.cos(yaw + Math.PI) });
      if (once(A.marks, 'shake', k >= 0.5)) emit('extra:shake', { name: A.who, x, y: 0.35, z });
    }
    c.x = x;
    c.z = z;
    c.y = y;
    c.yaw = yaw;
    c.v = 0;
    c.vx = c.vz = 0;
    c.animSpeed = 0;
    A.y = y;
    if (k >= 1) finishAct(c);
  }
  /** Balanço: pula no assento, balança indo e voltando e desce na frente. */
  function rideSwing(A, c, k) {
    const sw = hooks.swing;
    const sp = A.spot;
    const seat = sp.seat ?? 0;
    const T = A.t;
    const D = A.dur;
    const hopIn = 0.55;
    const hopOut = 0.6;
    // ângulo do balanço: cresce, balança e acalma
    const ride = Math.max(0, Math.min(T - hopIn, D - hopOut - hopIn));
    const amp = 0.42 * smooth(ride / 1.4) * (1 - smooth((ride - (D - hopIn - hopOut - 1.3)) / 1.3));
    const ang = T > hopIn && T < D - hopOut ? amp * Math.sin(ride * 2.6) : 0;
    sw?.setAngle(seat, T < D - 0.05 ? ang : null);
    const P = sw ? sw.seatAt(seat, ang) : { x: sp.x, y: 0.4, z: sp.z, faceYaw: 0 };
    const yawSeat = P.faceYaw;
    if (once(A.marks, 'in', T > 0.02)) emit('extra:hop', { name: A.who, x: A.x0, z: A.z0 });
    let x, z, y, yaw;
    if (T < hopIn) {
      const u = smooth(T / hopIn);
      x = A.x0 + (P.x - A.x0) * u;
      z = A.z0 + (P.z - A.z0) * u;
      y = P.y * u + Math.sin(Math.PI * Math.min(1, T / hopIn)) * 0.18;
      yaw = A.yaw0 + wrap(yawSeat - A.yaw0) * u;
      A.action = 'none';
    } else if (T < D - hopOut) {
      x = P.x; z = P.z; y = P.y; yaw = yawSeat;
      A.action = 'sit';
      A.slope = -ang * 0.55;
      const n = Math.round((ride * 2.6) / Math.PI);
      if (amp > 0.12 && n > A.n) {
        A.n = n;
        emit('extra:swing', { name: A.who, x, z });
      }
    } else {
      const u = smooth((T - (D - hopOut)) / hopOut);
      const fx = Math.sin(yawSeat);
      const fz = Math.cos(yawSeat);
      const lx = P.x + fx * 0.7;
      const lz = P.z + fz * 0.7;
      x = P.x + (lx - P.x) * u;
      z = P.z + (lz - P.z) * u;
      y = P.y * (1 - u) + Math.sin(Math.PI * u) * 0.12;
      yaw = yawSeat;
      A.action = 'none';
      if (once(A.marks, 'out', u > 0.92)) emit('dog:land', { name: A.who, x, z });
    }
    void k;
    return { x, z, y, yaw };
  }
  function finishAct(c) {
    const A = S.act;
    if (A.spot.kind === 'swing') hooks.swing?.setAngle(A.spot.seat ?? 0, null);
    c.y = 0;
    // desceu da pilha ou do balanço: fora de qualquer colisor
    const res = resolve(c.x, c.z, c.r, c.size);
    c.x = res.x;
    c.z = res.z;
    emit('extra:end', { kind: A.spot.kind, name: A.who, x: c.x, z: c.z });
    S.act = null;
  }

  // ------------------------------------------------------------------ API
  return {
    /** Fase nova: pontos do cenário, raiz da cena (o cocô vai nela) e ganchos do cenário (balanço, bola). */
    setLevel({ spots: list = [], root: r = null, hooks: h = {} } = {}) {
      spots = list;
      root = r;
      hooks = h || {};
      S = fresh();
    },
    tryPoop,
    interact,
    busy,
    /** Por quadro, depois do puzzle (só jogando). */
    update(dt) {
      stepPoop(dt);
      stepAct(dt);
      // a irmã por perto vira a cara para o cocô
      for (const p of S.poops) p.update(dt);
    },
    /** Trava da dog (o núcleo pergunta antes do puzzle). */
    lockFor(name) {
      const c = ctrls[name];
      if (S.poop?.who === name) return { action: 'none', faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), drive: true };
      if (S.act?.who === name) return { action: S.act.action, faceX: c.x + Math.sin(c.yaw), faceZ: c.z + Math.cos(c.yaw), drive: true, slope: S.act.slope };
      const P = S.poop;
      if (P && name === other(P.who)) {
        const p = P.t / POOP_TIME;
        const d = Math.hypot(c.x - P.x, c.z - P.z);
        if (p > YUCK.from && p < YUCK.to && d < YUCK.r) {
          if (!P.marks.has('yuck')) {
            P.marks.add('yuck');
            emit('dog:yuck', { name, x: c.x, z: c.z });
          }
          const ax = c.x - P.x;
          const az = c.z - P.z;
          const L = Math.hypot(ax, az) || 1;
          return { action: 'yuck', faceX: c.x + (ax / L) * 2, faceZ: c.z + (az / L) * 2 };
        }
      }
      return null;
    },
    /** Progresso do cocô da dog (0..1) ou −1. */
    poopK(name) { return S.poop?.who === name ? Math.min(1, S.poop.t / POOP_TIME) : -1; },
    /** Animação do cenário da dog ({ kind, k, t }) ou null (o balanço e o esguicho usam ações que já existem). */
    extraAnim(name) {
      const A = S.act;
      if (!A || A.who !== name || A.spot.kind === 'swing' || A.spot.kind === 'spurt') return null;
      return { kind: A.spot.kind, k: Math.min(1, A.t / A.dur), t: A.t, h: A.spot.h ?? 0 };
    },
    /** Interrompe o que estiver acontecendo (comemoração, troca de fase); o cocô no chão fica. */
    cancel() {
      if (S.act) {
        const c = ctrls[S.act.who];
        if (S.act.spot.kind === 'swing') hooks.swing?.setAngle(S.act.spot.seat ?? 0, null);
        c.y = 0;
        const res = resolve(c.x, c.z, c.r, c.size);
        c.x = res.x;
        c.z = res.z;
      }
      S.poop = null;
      S.act = null;
    },
    /** Reinício da tentativa: libera o cocô de novo e tira os do chão. */
    reset() {
      this.cancel();
      for (const p of S.poops) p.object.removeFromParent();
      hooks.ball?.reset?.();
      S = fresh();
    },
    info: () => ({
      used: S.used, poop: S.poop ? { who: S.poop.who, k: +(S.poop.t / POOP_TIME).toFixed(3) } : null,
      act: S.act ? { who: S.act.who, kind: S.act.spot.kind, id: S.act.spot.id, k: +(S.act.t / S.act.dur).toFixed(3) } : null,
      poops: S.poops.length, spots: spots.map((s) => s.id),
    }),
  };
}
