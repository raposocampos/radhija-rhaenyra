// O esqueleto atual guia o novo (etapa 1 da troca dos modelos): a animação de hoje (dogAnimation.js) continua
// resolvendo a pose no esqueleto atual, sem malha, e cada osso novo copia a pose do osso atual correspondente. Os
// gomos novos ficam no meio do caminho: a coluna e o pescoço dividem a curva entre as duas pontas, a escápula
// acompanha o peito e um pouco do braço, e o rabo e as orelhas são mapeados pela fração do comprimento.
// Resultado: o modelo novo faz desde já todas as poses e extras do atual, com as mesmas pisadas e o mesmo contato.
import * as THREE from 'three';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Fração do comprimento acumulado em cada nó de uma cadeia. */
function fractions(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i - 1], pts[i]));
  const total = L[L.length - 1] || 1;
  return L.map((v) => v / total);
}

/**
 * @param {{
 *   rig1: { bones: THREE.Bone[], BI: Record<string, number>, rest: THREE.Vector3[], parentIdx: number[] },
 *   design1: any, design2: any,
 *   skel2: { bones: THREE.Bone[], rest: THREE.Vector3[], parentIdx: number[], index: Record<string, number> },
 * }} opts
 */
export function createRetarget({ rig1, design1, design2, skel2 }) {
  const B1 = rig1.BI;
  const n1 = rig1.bones.length;
  const n2 = skel2.bones.length;
  /** Para cada osso novo: posição presa ao osso atual `src`; rotação entre os ossos atuais `a` e `b` (fração f). */
  const map = new Array(n2);
  const set = (name2, src, a = src, b = a, f = 0) => {
    const j = skel2.index[name2];
    if (j === undefined || B1[src] === undefined || B1[a] === undefined || B1[b] === undefined) {
      throw new Error(`retarget: osso sem par (${name2} ← ${src})`);
    }
    map[j] = { src: B1[src], a: B1[a], b: B1[b], f };
  };
  for (const n of ['body', 'hips', 'chest', 'neck', 'head', 'jaw', 'FLu', 'FLl', 'FRu', 'FRl',
    'HLu', 'HLl', 'HLm', 'HLp', 'HRu', 'HRl', 'HRm', 'HRp']) set(n, n);
  set('spineB', 'body', 'body', 'hips', 0.5);
  set('spineF', 'body', 'body', 'chest', 0.5);
  set('neck1', 'neck', 'neck', 'head', 0.5);
  set('scapL', 'chest', 'chest', 'FLu', 0.25);
  set('scapR', 'chest', 'chest', 'FRu', 0.25);
  // o pulso novo fica onde era a pata do atual; a pata nova vai presa a ela
  for (const s of ['L', 'R']) {
    set(`F${s}c`, `F${s}p`);
    set(`F${s}p`, `F${s}p`);
  }
  /** Cadeia (rabo, orelha): cada junta nova pega o gomo atual na mesma fração do comprimento. */
  const chain = (names2, pts2, names1, pts1) => {
    const U2 = fractions(pts2);
    const U1 = fractions(pts1);
    names2.forEach((n, k) => {
      const u = U2[k];
      let s = 0;
      while (s < names1.length - 1 && U1[s + 1] <= u) s++;
      const last = s + 1 >= names1.length;
      const f = last ? 0 : Math.min(1, Math.max(0, (u - U1[s]) / ((U1[s + 1] - U1[s]) || 1)));
      set(n, names1[s], names1[s], names1[last ? s : s + 1], f);
    });
  };
  const P = design1.pt;
  chain(['tail0', 'tail1', 'tail2', 'tail3', 'tail4'], design2.chains.tail, ['tail0', 'tail1', 'tail2', 'tail3'], [P.T0, P.T1, P.T2, P.T3, P.T4]);
  design1.earGroups.forEach((g, gi) => {
    const s = gi === 0 ? 'L' : 'R';
    const pts1 = [g.prims[0].a, g.prims[0].b, g.prims[1].b];
    chain([`ear${s}0`, `ear${s}1`, `ear${s}2`], design2.chains[`ear${s}`], [`ear${s}0`, `ear${s}1`], pts1);
  });
  for (let j = 0; j < n2; j++) if (!map[j]) throw new Error(`retarget: osso ${skel2.bones[j].name} sem guia`);

  const v3 = () => new THREE.Vector3();
  const q4 = () => new THREE.Quaternion();
  const P1 = Array.from({ length: n1 }, v3), Q1 = Array.from({ length: n1 }, q4);
  const P2 = Array.from({ length: n2 }, v3), Q2 = Array.from({ length: n2 }, q4);
  const _qi = q4();

  /** Copia a pose do esqueleto atual (já resolvida neste quadro) para o novo. */
  function apply() {
    const b1 = rig1.bones;
    for (let i = 0; i < n1; i++) {
      const p = rig1.parentIdx[i];
      if (p < 0) {
        P1[i].copy(b1[i].position);
        Q1[i].copy(b1[i].quaternion);
      } else {
        Q1[i].multiplyQuaternions(Q1[p], b1[i].quaternion);
        P1[i].copy(b1[i].position).applyQuaternion(Q1[p]).add(P1[p]);
      }
    }
    const r1 = rig1.rest, r2 = skel2.rest;
    for (let j = 0; j < n2; j++) {
      const e = map[j];
      P2[j].copy(r2[j]).sub(r1[e.src]).applyQuaternion(Q1[e.src]).add(P1[e.src]);
      if (e.a === e.b || e.f === 0) Q2[j].copy(Q1[e.a]);
      else Q2[j].slerpQuaternions(Q1[e.a], Q1[e.b], e.f);
    }
    const b2 = skel2.bones;
    for (let j = 0; j < n2; j++) {
      const p = skel2.parentIdx[j];
      if (p < 0) {
        b2[j].position.copy(P2[j]);
        b2[j].quaternion.copy(Q2[j]);
      } else {
        _qi.copy(Q2[p]).invert();
        b2[j].quaternion.multiplyQuaternions(_qi, Q2[j]);
        b2[j].position.copy(P2[j]).sub(P2[p]).applyQuaternion(_qi);
      }
    }
  }

  /** Recalcula P2/Q2 a partir das rotações locais atuais dos ossos novos (depois de uma pose própria do modelo novo). */
  function refresh() {
    const b2 = skel2.bones;
    for (let j = 0; j < n2; j++) {
      const p = skel2.parentIdx[j];
      if (p < 0) {
        P2[j].copy(b2[j].position);
        Q2[j].copy(b2[j].quaternion);
      } else {
        Q2[j].multiplyQuaternions(Q2[p], b2[j].quaternion);
        P2[j].copy(b2[j].position).applyQuaternion(Q2[p]).add(P2[p]);
      }
    }
  }

  /** Posições e rotações dos ossos novos no referencial do corpo (inner), do último apply()/refresh(). */
  return { apply, refresh, P2, Q2, map };
}
