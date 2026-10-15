// Cerca de madeira (x = 1.0): ripas de topo arredondado, postes com chapéu e travessas.
// Na abertura (z -2.35 a -1.85) faltam ripas: uma quebrada pendurada e um pedaço caído no chão.
import * as THREE from 'three';
import { woodMat, rbox, rng, mergeGeometries } from './util.js';

export function picketGeometry(w = 0.085, h = 0.9, t = 0.024) {
  // perfil de ripa com topo arredondado, extrudado com chanfro suave
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -t / 2);
  // uv: veio vertical
  const uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getY(i) / h, p.getX(i) / w * 0.2 + 0.5);
  return g;
}

export function buildFence(engine, layout) {
  const { scene } = engine;
  const F = layout.FENCE, X = F.x;
  const group = new THREE.Group();
  group.name = 'cerca';
  const r = rng(21);
  const pMat = woodMat('#c99a64', { key: 'fence-picket', rough: 0.8 });
  const postMat = woodMat('#b98a56', { key: 'fence-post', vertical: true, rough: 0.82 });
  const railMat = woodMat('#b48552', { key: 'fence-rail', rough: 0.82 });

  // ripas (instanciadas), na face LESTE (x ≈ 1.045); travessas na face oeste
  const picketGeo = picketGeometry();
  const pickets = [];
  const spacing = 0.125;
  const posts = [];
  const gapPosts = [F.gap.zMin - 0.05, F.gap.zMax + 0.05];
  for (const seg of F.segments) {
    const isGateNorth = Math.abs(seg.zMax - F.gate.latchPost.z) < 1e-3;
    const isGateSouth = Math.abs(seg.zMin - F.gate.hinge.z) < 1e-3;
    const z0 = seg.zMin + 0.07, z1 = seg.zMax - 0.07;
    const n = Math.max(1, Math.round((z1 - z0) / spacing));
    for (let i = 0; i <= n; i++) pickets.push({ z: z0 + (i / n) * (z1 - z0) });
    // postes: extremos + a cada ~1.25 m
    const pz0 = seg.zMin + (isGateSouth ? 0.1 : 0.05), pz1 = seg.zMax - (isGateNorth ? 0.1 : 0.05);
    const np = Math.max(1, Math.round((pz1 - pz0) / 1.25));
    for (let i = 0; i <= np; i++) posts.push(pz0 + (i / np) * (pz1 - pz0));
    // travessas
    for (const y of [0.24, 0.68]) {
      const rail = new THREE.Mesh(rbox(0.04, 0.07, seg.zMax - seg.zMin - 0.02, 0.012), railMat);
      rail.position.set(X - 0.035, y, (seg.zMin + seg.zMax) / 2);
      group.add(rail);
    }
  }
  const im = new THREE.InstancedMesh(picketGeo, pMat, pickets.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const c = new THREE.Color();
  pickets.forEach((pk, i) => {
    // ripa: largura em Z → gira 90° em Y; leve imperfeição artesanal
    e.set((r() - 0.5) * 0.025, Math.PI / 2 + (r() - 0.5) * 0.04, (r() - 0.5) * 0.02);
    q.setFromEuler(e);
    sc.set(1, 0.97 + r() * 0.05, 1);
    p.set(X + 0.01, 0.02, pk.z);
    m4.compose(p, q, sc);
    im.setMatrixAt(i, m4);
    c.setHSL(0.08 + (r() - 0.5) * 0.015, 0.45 + (r() - 0.5) * 0.12, 0.88 + (r() - 0.5) * 0.14);
    im.setColorAt(i, c);
  });
  im.castShadow = true; im.receiveShadow = true;
  group.add(im);

  // postes com chapéu
  const allPosts = [...posts];
  for (const z of allPosts) {
    const post = new THREE.Mesh(rbox(0.1, 1.0, 0.1, 0.015), postMat);
    post.position.set(X, 0.5, z);
    const cap = new THREE.Mesh(rbox(0.135, 0.035, 0.135, 0.012), railMat);
    cap.position.set(X, 1.015, z);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), railMat);
    knob.scale.y = 0.7;
    knob.position.set(X, 1.04, z);
    group.add(post, cap, knob);
  }

  // abertura: travessa de cima continua (a Radhija passa por baixo), ripa quebrada pendurada
  {
    const zc = F.gap.center, len = F.gap.zMax - F.gap.zMin + 0.12;
    const topRail = new THREE.Mesh(rbox(0.04, 0.07, len, 0.012), railMat);
    topRail.position.set(X - 0.035, 0.68, zc);
    topRail.rotation.x = 0.03;
    group.add(topRail);
    // ripa quebrada: só a parte de cima, pendurada torta por um prego
    const broken = new THREE.Mesh(picketGeometry(0.085, 0.36), pMat);
    broken.geometry.translate(0, -0.03, 0);
    broken.position.set(X + 0.01, 0.6, F.gap.zMax - 0.06);
    broken.rotation.set(0, Math.PI / 2, 0.28);
    // borda lascada embaixo
    const splGeo = new THREE.ConeGeometry(0.04, 0.07, 4);
    const spl = new THREE.Mesh(splGeo, pMat);
    spl.position.set(0.012, -0.05, 0);
    spl.rotation.set(Math.PI, 0, 0.3);
    spl.scale.set(1, 1, 0.3);
    broken.add(spl);
    group.add(broken);
    // toco quebrado no chão junto ao poste sul da abertura
    const stub = new THREE.Mesh(picketGeometry(0.085, 0.16), pMat);
    stub.position.set(X + 0.01, 0.0, F.gap.zMin + 0.03);
    stub.rotation.set(0, Math.PI / 2, -0.05);
    group.add(stub);
    // pedaço caído de lado na grama (lado leste), rasteiro
    // pedaço caído deitado na grama, do lado oeste (de onde a Radhija chega)
    const fg = picketGeometry(0.085, 0.58);
    fg.rotateX(-Math.PI / 2); // deitado: comprimento ao longo de -Z, espessura em Y
    const fallen = new THREE.Mesh(fg, pMat);
    fallen.position.set(X - 0.42, 0.016, F.gap.zMin - 0.05);
    fallen.rotation.y = 0.9;
    group.add(fallen);
  }

  // postes do portão (dobradiça e trinco) — o trinco tem a face leste em x ≈ 1.06
  for (const z of [F.gate.latchPost.z - 0.1, F.gate.hinge.z + 0.07]) {
    const post = new THREE.Mesh(rbox(0.12, 1.08, 0.12, 0.018), postMat);
    post.position.set(X, 0.54, z);
    const cap = new THREE.Mesh(rbox(0.16, 0.04, 0.16, 0.012), railMat);
    cap.position.set(X, 1.1, z);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), railMat);
    ball.position.set(X, 1.15, z);
    group.add(post, cap, ball);
  }

  group.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(group);
  return { group };
}
