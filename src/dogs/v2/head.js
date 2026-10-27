// Cabeça que desvia (etapa 4 da troca dos modelos, docs/ARQUITETURA.md §7). O corpo da dog é mais comprido que o
// círculo de colisão do jogo: o peito e a garupa já ficam fora das paredes e dos móveis (collision.js resolveBody),
// mas a cabeça vai uns 18 cm à frente do peito e entrava neles (retorno do usuário na fase 10). O jogo não muda (a dog
// para onde parava e alcança o que alcançava); o desenho é que se ajeita:
//   · chegando de frente, o corpo desenhado freia antes do centro do jogo, aos poucos, até o focinho encostar (prevê
//     onde o peito vai parar e começa a frear a tempo de chegar parado: nunca para de um quadro para o outro);
//   · encostada, a cabeça vira um pouco para o lado livre, como quem fareja a parede (pescoço e cabeça juntos);
//   · raspando de lado (andando rente, virando), a cabeça gira para fora;
//   · indo embora, tudo volta devagar (só se o que voltar não entrar em nada).
// Contam os colisores que seguram a dog (porte, portões, bichos, caixotes), mais altos que a cabeça; água, áreas da IA e
// a coisa em que ela está de propósito (subindo o escorregador, no balde) não. Desligada nas poses em que a cabeça vai
// de propósito até a coisa (empurrão em pé, parede, empurrando de pé, extras, Lambe-Lambe, rolando, indo morder a
// corda ou apertar o botão: anim.reach).
import * as THREE from 'three';
import { penCollider } from '../../game/collision.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/**
 * Limites (na escala da dog): quanto o desenho recua (m), quanto a cabeça vira farejando e raspando (rad, pescoço e
 * cabeça somados) e as velocidades de ir (rápido, para nada entrar) e de voltar (devagar).
 */
export const HEAD_AVOID = Object.freeze({ back: 0.24, sniff: 0.45, yaw: 0.85, backUp: 2.6, backDown: 0.7, yawUp: 5, yawDown: 1.4 });
/** Quanto do giro cada gomo faz (pescoço, meio do pescoço, cabeça). */
const SHARE = [0.35, 0.3, 0.35];
const UP = new THREE.Vector3(0, 1, 0);

/**
 * @param {{ skel2: { bones: THREE.Bone[], rest: THREE.Vector3[], parentIdx: number[], index: Record<string, number> },
 *           retarget: { P2: THREE.Vector3[], Q2: THREE.Quaternion[] }, design: any, s: number, hs: number,
 *           cfg: { size: 'small' | 'large', radius: number, body: { front: number, back: number, r: number } } }} opts
 */
export function createHeadAvoid({ skel2, retarget, design, s, hs, cfg }) {
  const { bones, rest, parentIdx, index: I } = skel2;
  const { P2, Q2 } = retarget;
  const chain = [I.neck, I.neck1, I.head];
  const headRest = rest[I.head];
  const nose = new THREE.Vector3(...design.face.nose);
  const Hc = new THREE.Vector3(...design.face.Hc);
  /** Pontos de contato presos à cabeça: a ponta do nariz, o meio do focinho e o meio da cabeça (raio com o pelo). */
  const probes = [
    { off: nose.clone().sub(headRest), r: design.face.noseR + 0.008 * s },
    { off: nose.clone().lerp(Hc, 0.5).sub(headRest), r: 0.034 * s * hs },
    { off: Hc.clone().sub(headRest), r: 0.062 * s * hs },
  ];
  const B = cfg.body;
  const bodyOff = { chest: B.front - B.r, rump: B.r - B.back };
  const LIM = { back: HEAD_AVOID.back * s, sniff: HEAD_AVOID.sniff, yaw: HEAD_AVOID.yaw };

  const st = { back: 0, yaw: 0, lat: 0, side: 1, w: 0, px: NaN, pz: NaN };
  const info = { back: 0, yaw: 0, need: 0, ahead: 0, contacts: 0 };
  /** @type {any[]} */ let near = [];
  /** @type {any[]} */ let nearBody = [];

  const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qa = new THREE.Quaternion();
  const piv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const pts = probes.map(() => new THREE.Vector3());

  /** Os colisores perto (uma vez por quadro): os da cabeça (altos, que seguram a dog) e os do corpo (os do jogo). */
  function gather(world, ox, oz, airborne) {
    near = [];
    nearBody = [];
    const reach = 0.75 * s + 0.3;
    for (const list of [world.staticsNear ? world.staticsNear(ox, oz, reach) : world.statics, world.dynamics]) {
      for (const c of list) {
        if (c.enabled === false || c.companionOnly || !(c.blocks === 'all' || c.blocks === cfg.size)) continue;
        if (c.except && ox >= c.except.minX && ox <= c.except.maxX && oz >= c.except.minZ && oz <= c.except.maxZ) continue;
        if (airborne && c.jumpable) continue;
        if (!penCollider(ox, oz, reach, c)) continue;
        nearBody.push(c);
        // a cabeça: nem água, nem áreas, nem a coisa em que ela está de propósito (o centro dela está dentro)
        if (c.kind === 'water' || c.kind === 'zone') continue;
        const inside = penCollider(ox, oz, cfg.radius * 0.9, c);
        if (inside && inside.depth > 0.02) continue;
        near.push(c);
      }
    }
  }
  /** O corpo do jogo (círculo do meio e peito) cabe com o centro em (x, z)? */
  function bodyFree(x, z, fx, fz, world) {
    const b = world.bounds;
    const cx = x + fx * bodyOff.chest, cz = z + fz * bodyOff.chest;
    if (x < b.minX + cfg.radius || x > b.maxX - cfg.radius || z < b.minZ + cfg.radius || z > b.maxZ - cfg.radius) return false;
    for (const c of nearBody) {
      const p = penCollider(x, z, cfg.radius, c) || penCollider(cx, cz, B.r, c);
      if (p && p.depth > 1e-4) return false;
    }
    return true;
  }
  /** A garupa desenhada cabe recuada `d` (atrás dela)? */
  function rumpFree(x, z, fx, fz, d) {
    const rx = x + fx * (bodyOff.rump - d), rz = z + fz * (bodyOff.rump - d);
    for (const c of near) {
      const p = penCollider(rx, rz, B.r, c);
      if (p && p.depth > 0.004) return false;
    }
    return true;
  }

  /**
   * Os pontos de contato da cabeça no mundo, com a cabeça virada `yaw` e o desenho recuado `back` (e o centro
   * adiantado `shift`, para prever), e o que eles invadem: quanto recuar ainda (need) e quanto virar (lat).
   */
  function probe(yaw, back, shift, inner, object, fx, fz, ex, ez) {
    for (let k = 0; k < 3; k++) piv[k].copy(P2[chain[k]]);
    let need = 0, lat = 0, n = 0;
    for (let i = 0; i < probes.length; i++) {
      const P = probes[i];
      const p = pts[i].copy(P.off).applyQuaternion(Q2[I.head]).add(P2[I.head]);
      // o giro de cada gomo em volta do vertical do corpo, de dentro para fora (cabeça, meio do pescoço, pescoço)
      for (let k = 2; k >= 0; k--) {
        if (!yaw) break;
        _qa.setFromAxisAngle(UP, yaw * SHARE[k]);
        p.sub(piv[k]).applyQuaternion(_qa).add(piv[k]);
      }
      const lever = Math.max(0.05 * s, Math.hypot(p.x - piv[0].x, p.z - piv[0].z));
      p.applyQuaternion(inner.quaternion).add(inner.position);
      p.z -= back;
      p.applyQuaternion(object.quaternion).add(object.position);
      p.x += fx * shift;
      p.z += fz * shift;
      for (const c of near) {
        if (c.height != null && p.y - P.r > c.height) continue; // a cabeça passa por cima do que é baixo
        const pen = penCollider(p.x, p.z, P.r, c);
        if (!pen || pen.depth < 1e-4) continue;
        n++;
        const front = -(pen.nx * fx + pen.nz * fz); // de frente: recuar resolve
        if (front > 0.5) need = Math.max(need, pen.depth / front);
        // de lado: virar a cabeça para fora resolve (o giro + leva o focinho para o lado ex/ez)
        else lat += (pen.depth * (pen.nx * ex + pen.nz * ez)) / lever;
      }
    }
    return { need, lat, n };
  }

  /**
   * Um quadro, depois do retarget.apply (inner já com a pose do guia). Mexe no recuo do desenho (inner.position.z) e
   * no giro do pescoço e da cabeça; devolve o peso (0 = nada).
   * @param {number} dt @param {import('../../types').DogAnim} A @param {THREE.Object3D} inner @param {THREE.Object3D} object
   * @param {import('../../types').CollisionWorld | null} world
   */
  function apply(dt, A, inner, object, world) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    const ox = object.position.x, oz = object.position.z;
    // posta em outro lugar (troca de fase, recomeço): começa do zero
    if (!(Math.hypot(ox - st.px, oz - st.pz) < 0.5)) {
      st.back = st.yaw = st.lat = 0;
      st.w = 0;
    }
    st.px = ox;
    st.pz = oz;
    const off = !world || (A.shoveK || 0) > 0 || (A.wallK ?? -1) >= 0 || (A.pushGap || 0) > 0 || !!A.extra || !!A.reach
      || A.action === 'lick' || A.action === 'licked' || A.action === 'shove' || A.action === 'wallJump';
    st.w += ((off ? 0 : 1) - st.w) * (1 - Math.exp(-(off ? 10 : 6) * dt));
    if (off && st.w < 0.01) st.w = 0;
    const yawO = object.rotation.y;
    const fx = Math.sin(yawO), fz = Math.cos(yawO);
    const ex = Math.cos(yawO), ez = -Math.sin(yawO); // para onde o giro + leva o focinho (a esquerda dela)
    let need = 0, lat = 0, n = 0, ahead = 0;
    if (world && !off) {
      gather(world, ox, oz, (A.jump || 0) > 0.02);
      if (near.length) {
        // quanto o corpo do jogo ainda anda para a frente até o peito encostar (até onde dá para frear a tempo)
        const L = 2 * LIM.back + 0.06 * s, step = 0.02 * s;
        ahead = L;
        for (let t = 0; t <= L; t += step) {
          if (bodyFree(ox + fx * t, oz + fz * t, fx, fz, world)) continue;
          // refina entre o último livre e o primeiro que encosta (degraus de 2 cm davam trancos na freada)
          let a = Math.max(0, t - step), b = t;
          for (let k = 0; k < 5; k++) {
            const m = (a + b) / 2;
            if (bodyFree(ox + fx * m, oz + fz * m, fx, fz, world)) a = m;
            else b = m;
          }
          ahead = a;
          break;
        }
        // onde ele vai parar, quanto o desenho terá de recuar; freia aos poucos nos últimos 2× isso (chega parado)
        let pred = 0;
        if (ahead < L) {
          const stop = probe(st.yaw, 0, ahead, inner, object, fx, fz, ex, ez).need;
          const Bs = Math.min(stop, LIM.back);
          if (Bs > 1e-3 && ahead < 2 * Bs) pred = Bs * (1 - ahead / (2 * Bs)) ** 2;
        }
        const now = probe(st.yaw, st.back, 0, inner, object, fx, fz, ex, ez);
        need = now.need;
        lat = now.lat;
        n = now.n;
        // recuo: sobe rápido (nada entra), desce devagar e só se o que voltar não entrar em nada
        const want = Math.max(pred, st.back + need);
        let back = st.back;
        if (want > back) back = Math.min(want, back + HEAD_AVOID.backUp * s * dt);
        else {
          const b2 = Math.max(pred, back - HEAD_AVOID.backDown * s * dt);
          if (b2 < back && probe(st.yaw, b2, 0, inner, object, fx, fz, ex, ez).need <= 1e-4) back = b2;
        }
        // nunca para dentro do que está atrás dela
        let room = Math.min(back, LIM.back);
        while (room > 0 && !rumpFree(ox, oz, fx, fz, room)) room = Math.max(0, room - 0.01 * s);
        st.back = room;
        // lado para onde ela vira farejando: o que tira o focinho da coisa; de frente, para onde ela estava virando
        // (ou o de antes)
        if (Math.abs(lat) > 0.02) st.side = lat > 0 ? 1 : -1;
        else if (st.back < 0.005 * s && Math.abs(A.turn || 0) > 0.3) st.side = Math.sign(A.turn);
        st.lat = clamp(st.lat + clamp(lat, -HEAD_AVOID.yawUp * dt, HEAD_AVOID.yawUp * dt), -LIM.yaw, LIM.yaw);
      }
    }
    if (!near.length || off) {
      // longe de tudo (ou numa pose do guia): volta devagar
      st.back = Math.max(0, st.back - HEAD_AVOID.backDown * s * dt);
    }
    if (n === 0) {
      // sem nada encostando de lado: o giro de raspar volta devagar (se voltar não fizer entrar)
      const l2 = st.lat - Math.sign(st.lat) * Math.min(Math.abs(st.lat), HEAD_AVOID.yawDown * dt);
      if (off || !world || !near.length || probe(st.yaw - st.lat + l2, st.back, 0, inner, object, fx, fz, ex, ez).n === 0) st.lat = l2;
    }
    // farejando: com o focinho encostado (recuada), a cabeça vira um pouco para o lado livre
    const sniff = st.side * LIM.sniff * clamp(st.back / (0.12 * s), 0, 1);
    const yawT = clamp(sniff + st.lat, -LIM.yaw, LIM.yaw) * st.w;
    st.yaw += clamp(yawT - st.yaw, -HEAD_AVOID.yawUp * dt, HEAD_AVOID.yawUp * dt);
    const back = st.back * st.w;
    info.back = back;
    info.yaw = st.yaw;
    info.need = need;
    info.ahead = ahead;
    info.contacts = n;
    if (back < 1e-5 && Math.abs(st.yaw) < 1e-5) return 0;
    // o desenho inteiro recua (as patas plantadas da locomoção dão os passos) e o pescoço e a cabeça viram
    inner.position.z -= back;
    if (Math.abs(st.yaw) > 1e-5) {
      for (let k = 0; k < 3; k++) {
        const j = chain[k];
        _q.setFromAxisAngle(UP, st.yaw * SHARE[k]).multiply(Q2[j]);
        bones[j].quaternion.copy(_qi.copy(Q2[parentIdx[j]]).invert().multiply(_q));
      }
    }
    return Math.max(st.w, back > 0 ? 1 : 0);
  }

  return {
    apply,
    /** Esquece o estado (troca de fase, testes). */
    reset() {
      st.back = st.yaw = st.lat = st.w = 0;
      st.px = st.pz = NaN;
    },
    /** Recuo do desenho (m), giro da cabeça (rad), o que falta recuar, quanto o corpo ainda anda e contatos. */
    info,
    /** Pontos de contato presos ao osso da cabeça (no referencial dele) e o raio de cada um (testes). */
    offsets: probes.map((p) => ({ off: p.off.clone(), r: p.r })),
  };
}
