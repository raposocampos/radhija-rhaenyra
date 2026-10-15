// Esqueleto da dog: ossos a partir do design (dogModel.js), cinemática direta (FK) com quaternions de
// mundo/locais e IK analítica de 2 ossos para as pernas. Usado por dog.js (montagem) e
// dogAnimation.js (pose a cada quadro).
import * as THREE from 'three';
import { BONE_NAMES, BONE_INDEX, boneParent } from './dogModel.js';

/** Base ortonormal (transposta) de um osso: e1 ao longo de `dir`, e3 no plano da perna (normal `n`). */
function makeBasisT(dir, n) {
  const e1 = dir.clone().normalize();
  const e3 = n.clone().addScaledVector(e1, -n.dot(e1)).normalize();
  const e2 = new THREE.Vector3().crossVectors(e3, e1);
  return new THREE.Matrix4().makeBasis(e1, e2, e3).transpose();
}

/**
 * Cria os ossos (filhos de `parent`), o Skeleton e as estruturas de FK/IK.
 * → { bones, skeleton, BI, nB, parentIdx, rest, restOff, Lq, Wq, Wp, posOff, legs, fk, setWorld, basisQuat, solve2 }
 */
export function createDogRig(design, parent) {
  // ------------------------------------------------------------------ esqueleto
  const nB = BONE_NAMES.length;
  const parentIdx = BONE_NAMES.map((n) => (boneParent(n) ? BONE_INDEX[boneParent(n)] : -1));
  const rest = BONE_NAMES.map((n) => new THREE.Vector3(...design.bones[n]));
  const restOff = rest.map((r, i) => (parentIdx[i] < 0 ? r.clone() : r.clone().sub(rest[parentIdx[i]])));
  const bones = BONE_NAMES.map((n, i) => {
    const b = new THREE.Bone();
    b.name = n;
    b.position.copy(restOff[i]);
    return b;
  });
  bones.forEach((b, i) => (parentIdx[i] < 0 ? parent.add(b) : bones[parentIdx[i]].add(b)));
  parent.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const BI = BONE_INDEX;

  // ------------------------------------------------------------------ dados da IK
  const v3 = () => new THREE.Vector3();
  const q4 = () => new THREE.Quaternion();
  const Lq = bones.map(() => q4()); // rotação local de cada osso
  const Wq = bones.map(() => q4()); // rotação no referencial da dog
  const Wp = bones.map(() => v3()); // posição no referencial da dog
  const posOff = bones.map(() => v3()); // deslocamento extra da posição de repouso

  const legs = [
    { u: 'FLu', l: 'FLl', p: 'FLp', front: true, side: 1 },
    { u: 'FRu', l: 'FRl', p: 'FRp', front: true, side: -1 },
    { u: 'HLu', l: 'HLl', m: 'HLm', p: 'HLp', front: false, side: 1 },
    { u: 'HRu', l: 'HRl', m: 'HRm', p: 'HRp', front: false, side: -1 },
  ].map((L) => {
    const iu = BI[L.u], il = BI[L.l], ip = BI[L.p], im = L.m ? BI[L.m] : -1;
    const Pp = rest[iu], K = rest[il];
    const T = L.front ? rest[ip] : rest[im]; // alvo da IK de 2 ossos: punho (dianteira) ou jarrete (traseira)
    const u0 = K.clone().sub(Pp), l0 = T.clone().sub(K);
    const n0 = new THREE.Vector3().crossVectors(u0, l0).normalize();
    const leg = {
      ...L, iu, il, ip, im,
      a: u0.length(), b: l0.length(),
      n0,
      Bu: makeBasisT(u0, n0),
      Bl: makeBasisT(l0, n0),
      foot0: rest[ip].clone(), // posição neutra do apoio (punho / articulação da pata)
      swing: false,
      prevP: 0,
      // só nas traseiras (metatarso): preenchidos abaixo
      m0: null, c: 0, Bm: null,
    };
    if (im >= 0) {
      const m0 = rest[ip].clone().sub(rest[im]);
      leg.m0 = m0;
      leg.c = m0.length();
      leg.Bm = makeBasisT(m0, n0);
    }
    return leg;
  });

  // temporários do solver
  const _m = new THREE.Matrix4();
  const _v = v3(), _v2 = v3(), _v3 = v3(), _d = v3(), _dir = v3(), _pl = v3();

  /** FK de um osso a partir do pai. */
  function fk(i) {
    const p = parentIdx[i];
    if (p < 0) return;
    Wq[i].multiplyQuaternions(Wq[p], Lq[i]);
    Wp[i].copy(restOff[i]).add(posOff[i]).applyQuaternion(Wq[p]).add(Wp[p]);
  }
  /** Fixa a rotação de mundo `q` do osso i (deriva a local) e atualiza a posição. */
  function setWorld(i, q) {
    const p = parentIdx[i];
    Lq[i].copy(Wq[p]).invert().multiply(q);
    Wq[i].copy(q);
    Wp[i].copy(restOff[i]).add(posOff[i]).applyQuaternion(Wq[p]).add(Wp[p]);
  }
  /** Quaternion que leva a base de repouso BT para a direção `dir` com normal `n`. */
  function basisQuat(out, dir, n, BT) {
    const e1 = _v.copy(dir).normalize();
    const e3 = _v2.copy(n).addScaledVector(e1, -n.dot(e1)).normalize();
    const e2 = _v3.crossVectors(e3, e1);
    _m.makeBasis(e1, e2, e3).multiply(BT);
    return out.setFromRotationMatrix(_m);
  }
  /** IK de 2 ossos (comprimentos a, b) de Pp até T (ajustado ao alcance); joelho em outK, dobrando para `pole`. */
  function solve2(Pp, T, a, b, pole, outK) {
    _d.subVectors(T, Pp);
    let d = _d.length();
    const maxD = (a + b) * 0.998, minD = Math.abs(a - b) + 1e-4;
    if (d > maxD) { _d.multiplyScalar(maxD / d); d = maxD; T.copy(Pp).add(_d); }
    if (d < minD) { _d.multiplyScalar(minD / Math.max(d, 1e-6)); d = minD; T.copy(Pp).add(_d); }
    _dir.copy(_d).divideScalar(d);
    _pl.copy(pole).addScaledVector(_dir, -pole.dot(_dir)).normalize();
    const x = (a * a - b * b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    outK.copy(Pp).addScaledVector(_dir, x).addScaledVector(_pl, h);
  }

  return { bones, skeleton, BI, nB, parentIdx, rest, restOff, Lq, Wq, Wp, posOff, legs, fk, setWorld, basisQuat, solve2 };
}
