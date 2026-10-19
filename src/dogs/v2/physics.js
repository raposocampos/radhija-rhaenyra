// Física das orelhas do modelo novo: cada orelha é uma correntinha de três gomos (a base presa na cabeça) com mola,
// amortecimento, um pouco de gravidade e o chão. A pose de cada quadro (a do esqueleto guia, com as orelhas alertas,
// para trás na corrida etc.) é o ponto de descanso da mola; a inércia faz o resto: no pulo as orelhas sobem quando a
// cabeça desce e balançam no pouso, nas curvas abrem para fora, e ao rolar caem sobre o chão sem atravessá-lo.
import * as THREE from 'three';

/** Mola de cada junta (Hz) da base para a ponta, amortecimento (fração do crítico) e gravidade extra (m/s²). */
const FREQ = [4.2, 3.0, 2.3];
const ZETA = 0.32;
const GRAVITY = 1.6;
/** Folga da ponta da orelha acima do chão (m). */
const FLOOR_PAD = 0.012;

/**
 * @param {{ skel2: { bones: THREE.Bone[], rest: THREE.Vector3[], index: Record<string, number> }, design: any }} opts
 */
export function createEarPhysics({ skel2, design }) {
  const I = skel2.index;
  const ears = ['L', 'R'].map((s) => {
    const b = [I[`ear${s}0`], I[`ear${s}1`], I[`ear${s}2`]];
    const tip = new THREE.Vector3(...design.chains[`ear${s}`][3]);
    const rest = [skel2.rest[b[0]], skel2.rest[b[1]], skel2.rest[b[2]], tip];
    return {
      b,
      /** direção de repouso de cada gomo (o osso nasce sem rotação: a direção é a do desenho) */
      dir: [0, 1, 2].map((k) => rest[k + 1].clone().sub(rest[k]).normalize()),
      len: [0, 1, 2].map((k) => rest[k + 1].distanceTo(rest[k])),
      tipOff: tip.clone().sub(rest[2]),
      p: [0, 1, 2, 3].map(() => new THREE.Vector3()),
      v: [0, 1, 2, 3].map(() => new THREE.Vector3()),
      t: [0, 1, 2, 3].map(() => new THREE.Vector3()),
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
   * locais dos ossos das orelhas.
   * @param {number} dt @param {{ P: THREE.Vector3[], Q: THREE.Quaternion[], inner: THREE.Object3D, object: THREE.Object3D, floorY: number }} f
   */
  function update(dt, { P, Q, inner, object, floorY }) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    _qw.multiplyQuaternions(object.quaternion, inner.quaternion);
    _qwi.copy(_qw).invert();
    for (const e of ears) {
      // alvos (a pose do guia) no mundo
      for (let k = 0; k < 3; k++) toWorld(e.t[k], P[e.b[k]], inner, object);
      toWorld(e.t[3], _a.copy(e.tipOff).applyQuaternion(Q[e.b[2]]).add(P[e.b[2]]), inner, object);
      // começo, teleporte ou troca de fase: a orelha vai direto para a pose
      if (!e.ready || e.p[0].distanceToSquared(e.t[0]) > 0.25) {
        for (let k = 0; k < 4; k++) {
          e.p[k].copy(e.t[k]);
          e.v[k].set(0, 0, 0);
        }
        e.ready = true;
      }
      const n = Math.max(1, Math.ceil(dt * 120));
      const h = dt / n;
      for (let s = 0; s < n; s++) {
        // a base acompanha a cabeça no meio do quadro (interpolada)
        e.p[0].lerp(e.t[0], 1 / (n - s));
        for (let k = 1; k < 4; k++) {
          const w = 2 * Math.PI * FREQ[k - 1];
          _a.subVectors(e.t[k], e.p[k]).multiplyScalar(w * w).addScaledVector(e.v[k], -2 * ZETA * w);
          _a.y -= GRAVITY;
          e.v[k].addScaledVector(_a, h);
          _x.copy(e.p[k]);
          e.p[k].addScaledVector(e.v[k], h);
          // comprimento de cada gomo (da base para a ponta) e o chão
          _d.subVectors(e.p[k], e.p[k - 1]);
          const L = _d.length() || 1e-6;
          e.p[k].copy(e.p[k - 1]).addScaledVector(_d, e.len[k - 1] / L);
          if (e.p[k].y < floorY + FLOOR_PAD) e.p[k].y = floorY + FLOOR_PAD;
          e.v[k].subVectors(e.p[k], _x).divideScalar(h);
        }
      }
      // rotações: cada gomo aponta para o ponto simulado seguinte (sem mudar a torção da pose)
      _qp.copy(Q[I.head]);
      for (let k = 0; k < 3; k++) {
        const bone = skel2.bones[e.b[k]];
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
    for (const e of ears) e.ready = false;
  }

  /** Ponta da orelha simulada (mundo), para testes. */
  const tip = (i) => ears[i].p[3];

  return { update, reset, tip };
}
