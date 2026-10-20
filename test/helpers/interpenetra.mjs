// Duas peças do cenário uma dentro da outra (ex.: o calço da fase 2 e a folha do portão): pontos da superfície de uma
// que caem dentro de uma malha fechada da outra. "Dentro" pela paridade de um raio (quantas faces ele cruza), no espaço
// local da malha. Para malhas fechadas (caixa, cilindro, extrusão, toro); tubos abertos não servem.
//
//   const achados = interpenetration(calco, portao, { step: 0.005 });   // [{ ponto, de, em }]
import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _hit = new THREE.Vector3();
// levemente inclinado: um raio reto passaria por arestas e vértices das grades alinhadas
const DIR = new THREE.Vector3(0.0131, 1, 0.0297).normalize();

/** Malhas visíveis sob `obj` (o próprio obj incluso). */
function meshesOf(obj) {
  /** @type {THREE.Mesh[]} */
  const out = [];
  obj.traverse((/** @type {any} */ o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (p.visible === false) return;
    out.push(o);
  });
  return out;
}

/** Triângulos da malha no espaço local: [[a, b, c], ...]. */
function trianglesOf(mesh) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const index = geo.index;
  const n = Math.floor((index ? index.count : pos.count) / 3);
  const tris = [];
  for (let t = 0; t < n; t++) {
    const i = index ? [index.getX(3 * t), index.getX(3 * t + 1), index.getX(3 * t + 2)] : [3 * t, 3 * t + 1, 3 * t + 2];
    tris.push(i.map((k) => new THREE.Vector3().fromBufferAttribute(pos, k)));
  }
  return tris;
}

/** Pontos da superfície da malha (no mundo), a cada ~step m. */
export function surfacePoints(mesh, step) {
  const out = [];
  for (const [a0, b0, c0] of trianglesOf(mesh)) {
    _a.copy(a0).applyMatrix4(mesh.matrixWorld);
    _b.copy(b0).applyMatrix4(mesh.matrixWorld);
    _c.copy(c0).applyMatrix4(mesh.matrixWorld);
    // grade com a densidade de cada lado (triângulo comprido e fino não vira milhares de pontos repetidos)
    const nu = Math.max(1, Math.ceil(_a.distanceTo(_b) / step)), nv = Math.max(1, Math.ceil(_a.distanceTo(_c) / step));
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv * (1 - i / nu) + 1e-9; j++) {
        const u = i / nu, v = j / nv;
        out.push(new THREE.Vector3(
          _a.x + (_b.x - _a.x) * u + (_c.x - _a.x) * v,
          _a.y + (_b.y - _a.y) * u + (_c.y - _a.y) * v,
          _a.z + (_b.z - _a.z) * u + (_c.z - _a.z) * v,
        ));
      }
    }
  }
  return out;
}

/** O ponto do mundo `p` está dentro da malha fechada? (com a lista de triângulos locais já pronta) */
function inside(mesh, tris, p, margin) {
  const local = p.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  if (!mesh.geometry.boundingBox.clone().expandByScalar(-margin).containsPoint(local)) return false;
  const ray = new THREE.Ray(local, DIR);
  let n = 0;
  for (const [a, b, c] of tris) if (ray.intersectTriangle(a, b, c, false, _hit)) n++;
  return n % 2 === 1;
}

/**
 * Pontos de `a` dentro de malhas de `b` e de `b` dentro de `a`. margin: o quanto o ponto precisa estar para dentro da
 * caixa da malha para contar (encostar não é atravessar).
 * @param {THREE.Object3D} a @param {THREE.Object3D} b
 * @param {{ step?: number, margin?: number, maxY?: number }} [opts] maxY: só as malhas de b que descem abaixo disto
 */
export function interpenetration(a, b, { step = 0.005, margin = 0.0005, maxY = Infinity } = {}) {
  a.updateMatrixWorld(true);
  b.updateMatrixWorld(true);
  const box = (m) => new THREE.Box3().setFromObject(m);
  const A = meshesOf(a).map((m) => ({ m, box: box(m) }));
  const B = meshesOf(b).map((m) => ({ m, box: box(m) })).filter((x) => x.box.min.y < maxY);
  const out = [];
  for (const [P, Q, from, to] of [[A, B, a, b], [B, A, b, a]]) {
    for (const p of P) {
      const near = Q.filter((q) => q.box.intersectsBox(p.box));
      if (!near.length) continue;
      const pts = surfacePoints(p.m, step);
      for (const q of near) {
        const tris = trianglesOf(q.m);
        const qb = q.box.clone().expandByScalar(-margin);
        for (const pt of pts) {
          if (!qb.containsPoint(pt) || !inside(q.m, tris, pt, margin)) continue;
          out.push({ ponto: pt.toArray().map((v) => +v.toFixed(3)), de: `${from.name || 'a'}:${p.m.geometry.type}`, em: `${to.name || 'b'}:${q.m.geometry.type}` });
          if (out.length > 20) return out;
        }
      }
    }
  }
  return out;
}
