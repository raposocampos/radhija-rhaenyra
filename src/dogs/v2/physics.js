// Física das correntinhas do modelo novo: as orelhas (três gomos, presas na cabeça) e o rabo (cinco gomos, preso na
// garupa). Cada correntinha tem mola, amortecimento, um pouco de gravidade e o chão. A pose de cada quadro (a do
// esqueleto guia: orelhas alertas, para trás na corrida, o rabo abanando etc.) é o ponto de descanso da mola; a
// inércia faz o resto: no pulo as orelhas sobem quando a cabeça desce e balançam no pouso, nas curvas abrem para fora,
// ao rolar caem sobre o chão sem atravessá-lo; o rabo, bem mais firme, só atrasa um tiquinho nas curvas, no pulo e ao
// parar (retorno do usuário: nada "mole").
import * as THREE from 'three';

/** Orelhas: mola de cada junta (Hz) da base para a ponta, amortecimento (fração do crítico), gravidade extra (m/s²) e
 * folga da ponta acima do chão (m). */
export const EAR_PHYSICS = Object.freeze({ freq: [5.6, 4.3, 3.4], zeta: 0.4, gravity: 1.6, floorPad: 0.012 });
/** Rabo: bem mais firme que as orelhas e quase sem cair (o rabo em pluma fica no alto, como na pose). */
export const TAIL_PHYSICS = Object.freeze({ freq: [9, 7.5, 6.5, 5.8, 5.2], zeta: 0.6, gravity: 0.4, floorPad: 0.015 });

/**
 * Uma correntinha: ossos da base para a ponta, a ponta (repouso) e a física.
 * @typedef {{ name: string, bones: number[], tip: number[], freq: readonly number[], zeta: number, gravity: number,
 *             floorPad: number }} ChainDef
 */

/**
 * As correntinhas do desenho: orelhas e (se `tail`) o rabo.
 * @param {{ bones: THREE.Bone[], rest: THREE.Vector3[], parentIdx: number[], index: Record<string, number> }} skel2
 * @param {any} design @param {{ tail?: boolean }} [opts]
 */
export function designChains(skel2, design, { tail = true } = {}) {
  const I = skel2.index;
  /** @type {ChainDef[]} */
  const chains = ['L', 'R'].map((s) => ({
    name: `ear${s}`, bones: [0, 1, 2].map((k) => I[`ear${s}${k}`]), tip: design.chains[`ear${s}`][3], ...EAR_PHYSICS,
  }));
  if (tail) chains.push({ name: 'tail', bones: [0, 1, 2, 3, 4].map((k) => I[`tail${k}`]), tip: design.chains.tail[5], ...TAIL_PHYSICS });
  return chains;
}

/**
 * @param {{ skel2: { bones: THREE.Bone[], rest: THREE.Vector3[], parentIdx: number[], index: Record<string, number> },
 *           chains: ChainDef[] }} opts
 */
export function createChainPhysics({ skel2, chains: defs }) {
  const chains = defs.map((c) => {
    const n = c.bones.length;
    const tip = new THREE.Vector3(...c.tip);
    const rest = [...c.bones.map((b) => skel2.rest[b]), tip];
    const pts = () => Array.from({ length: n + 1 }, () => new THREE.Vector3());
    return {
      ...c, n,
      parent: skel2.parentIdx[c.bones[0]],
      /** direção de repouso de cada gomo (o osso nasce sem rotação: a direção é a do desenho) */
      dir: c.bones.map((_, k) => rest[k + 1].clone().sub(rest[k]).normalize()),
      len: c.bones.map((_, k) => rest[k + 1].distanceTo(rest[k])),
      tipOff: tip.clone().sub(rest[n - 1]),
      p: pts(), v: pts(), t: pts(),
      ready: false,
    };
  });

  const _qw = new THREE.Quaternion(), _qwi = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qk = new THREE.Quaternion();
  const _qd = new THREE.Quaternion(), _qi = new THREE.Quaternion();
  const _a = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _x = new THREE.Vector3();

  /** Ponto do referencial do corpo (inner) → mundo. */
  const toWorld = (out, pIn, inner, object) => out.copy(pIn).applyQuaternion(inner.quaternion).add(inner.position)
    .applyQuaternion(object.quaternion).add(object.position);

  /**
   * Um quadro: P/Q = ossos no referencial do corpo com a pose de agora (o descanso da mola). Muda só as rotações
   * locais dos ossos das correntinhas.
   * @param {number} dt @param {{ P: THREE.Vector3[], Q: THREE.Quaternion[], inner: THREE.Object3D, object: THREE.Object3D, floorY: number }} f
   */
  function update(dt, { P, Q, inner, object, floorY }) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    _qw.multiplyQuaternions(object.quaternion, inner.quaternion);
    _qwi.copy(_qw).invert();
    for (const e of chains) {
      const { n, bones } = e;
      // alvos (a pose do guia) no mundo
      for (let k = 0; k < n; k++) toWorld(e.t[k], P[bones[k]], inner, object);
      toWorld(e.t[n], _a.copy(e.tipOff).applyQuaternion(Q[bones[n - 1]]).add(P[bones[n - 1]]), inner, object);
      // começo, teleporte ou troca de fase: a correntinha vai direto para a pose
      if (!e.ready || e.p[0].distanceToSquared(e.t[0]) > 0.25) {
        for (let k = 0; k <= n; k++) {
          e.p[k].copy(e.t[k]);
          e.v[k].set(0, 0, 0);
        }
        e.ready = true;
      }
      const steps = Math.max(1, Math.ceil(dt * 120));
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        // a base acompanha o osso de onde ela sai no meio do quadro (interpolada)
        e.p[0].lerp(e.t[0], 1 / (steps - s));
        for (let k = 1; k <= n; k++) {
          const w = 2 * Math.PI * e.freq[k - 1];
          _a.subVectors(e.t[k], e.p[k]).multiplyScalar(w * w).addScaledVector(e.v[k], -2 * e.zeta * w);
          _a.y -= e.gravity;
          e.v[k].addScaledVector(_a, h);
          _x.copy(e.p[k]);
          e.p[k].addScaledVector(e.v[k], h);
          // comprimento de cada gomo (da base para a ponta) e o chão
          _d.subVectors(e.p[k], e.p[k - 1]);
          const L = _d.length() || 1e-6;
          e.p[k].copy(e.p[k - 1]).addScaledVector(_d, e.len[k - 1] / L);
          if (e.p[k].y < floorY + e.floorPad) e.p[k].y = floorY + e.floorPad;
          e.v[k].subVectors(e.p[k], _x).divideScalar(h);
        }
      }
      // rotações: cada gomo aponta para o ponto simulado seguinte (sem mudar a torção da pose)
      _qp.copy(Q[e.parent]);
      for (let k = 0; k < n; k++) {
        const bone = skel2.bones[bones[k]];
        _qk.multiplyQuaternions(_qp, bone.quaternion); // rotação do gomo no corpo, com a pose do guia
        _c.copy(e.dir[k]).applyQuaternion(_qk);
        _d.subVectors(e.p[k + 1], e.p[k]).applyQuaternion(_qwi).normalize();
        if (Number.isFinite(_d.x)) {
          _qd.setFromUnitVectors(_c, _d);
          _qk.premultiply(_qd);
        }
        bone.quaternion.copy(_qi.copy(_qp).invert().multiply(_qk));
        _qp.copy(_qk);
      }
    }
  }

  /** Esquece o estado (troca de modelo de pose, testes). */
  function reset() {
    for (const e of chains) e.ready = false;
  }

  /** Ponta simulada (mundo) da correntinha `name` ('earL', 'earR', 'tail'), para testes. */
  const tip = (name) => chains.find((c) => c.name === name)?.p.at(-1) ?? null;

  return { update, reset, tip };
}

/** Só as orelhas (compatibilidade: o rabo entra com createChainPhysics + designChains). */
export function createEarPhysics({ skel2, design }) {
  return createChainPhysics({ skel2, chains: designChains(skel2, design, { tail: false }) });
}
