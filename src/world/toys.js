// Brinquedos das fases 4 e 5, todos procedurais: o patinho de borracha e o ursinho de pelúcia.
// Convenção dos itens carregáveis (createCarryItem): Object3D centrado, eixo mais longo em X local,
// "em pé" com a base em y = 0 do grupo. O nome e userData.carryKind dizem à boca qual pose usar
// (src/dogs/carryPose.js).
import * as THREE from 'three';
import { mergeGeometries, canvasTexture, rng } from './util.js';

/** Remove uv e índice para juntar geometrias de tipos diferentes. */
const prep = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  if (n.attributes.uv) n.deleteAttribute('uv');
  return n;
};

/**
 * Patinho de borracha amarelo (≈ size de comprimento, bico para +X).
 * @param {number} [size]
 */
export function createRubberDuck(size = 0.2) {
  const s = size / 0.2;
  const g = new THREE.Group();
  g.name = 'patinho';
  g.userData.carryKind = 'duck';
  const yellow = new THREE.MeshPhysicalMaterial({ color: '#ffcf2e', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.2 });
  const orange = new THREE.MeshPhysicalMaterial({ color: '#ff8a1e', roughness: 0.38, clearcoat: 0.5 });
  const ink = new THREE.MeshStandardMaterial({ color: '#1f1510', roughness: 0.2 });
  const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });

  // corpo: gota achatada com o rabinho arrebitado (-X)
  const bodyGeo = new THREE.SphereGeometry(0.07, 28, 18);
  const p = bodyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    y *= y < 0 ? 0.62 : 0.78; // base achatada (boia)
    x *= 1.32;
    if (x < 0) y += Math.max(0, -x - 0.03) * 0.9 * Math.max(0, y + 0.02) * 9; // rabinho para cima
    z *= 1.0 - Math.max(0, -x) * 1.6;
    p.setXYZ(i, x, y, z);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, yellow);
  body.position.y = 0.045;
  // cabeça
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), yellow);
  head.position.set(0.045, 0.125, 0);
  // bico: duas metades achatadas
  const beakGeo = new THREE.SphereGeometry(0.026, 16, 10);
  beakGeo.scale(1.2, 0.42, 0.9);
  const beak = new THREE.Mesh(beakGeo, orange);
  beak.position.set(0.087, 0.112, 0);
  // olhos com brilho
  for (const sz of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), ink);
    e.position.set(0.073, 0.138, sz * 0.026);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 4), white);
    hl.position.set(0.079, 0.142, sz * 0.026);
    g.add(e, hl);
  }
  // asinhas
  for (const sz of [-1, 1]) {
    const wGeo = new THREE.SphereGeometry(0.035, 14, 10);
    wGeo.scale(1.25, 0.55, 0.38);
    const w = new THREE.Mesh(wGeo, yellow);
    w.position.set(-0.015, 0.06, sz * 0.058);
    w.rotation.set(sz * 0.25, 0, -0.35);
    g.add(w);
  }
  g.add(body, head, beak);
  g.scale.setScalar(s);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.carryKind = 'duck'; } });
  return g;
}

/** Textura de pelúcia (fios curtos sobre a cor base). */
function plushTexture(base = '#b9875a', seed = 5) {
  return canvasTexture(128, 128, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI * 2, L = 1.5 + r() * 2.5;
      const k = r();
      c.strokeStyle = k < 0.5 ? 'rgba(255,236,205,0.16)' : 'rgba(70,40,20,0.14)';
      c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke();
    }
  });
}

/**
 * Ursinho de pelúcia sentado (≈ size de altura). Para carregar, fica deitado de lado: a cabeça para +X
 * (createTeddyBear devolve o ursinho deitado; `sitting` o coloca sentado, para o cenário).
 * @param {number} [size]
 * @returns {THREE.Group & { userData: { sit: () => void, lie: () => void } }}
 */
export function createTeddyBear(size = 0.26) {
  const outer = /** @type {any} */ (new THREE.Group());
  outer.name = 'ursinho';
  outer.userData.carryKind = 'bear';
  const g = new THREE.Group();
  outer.add(g);
  const fur = new THREE.MeshStandardMaterial({ color: '#ffffff', map: plushTexture('#b9875a', 5), roughness: 0.95 });
  const light = new THREE.MeshStandardMaterial({ color: '#ffffff', map: plushTexture('#ecd2ad', 9), roughness: 0.95 });
  const ink = new THREE.MeshStandardMaterial({ color: '#1d130e', roughness: 0.25 });
  const bow = new THREE.MeshStandardMaterial({ color: '#d9475f', roughness: 0.6 });

  const S = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
  // corpo e barriguinha
  const bodyGeo = S(0.07);
  bodyGeo.scale(1, 1.15, 0.9);
  const body = new THREE.Mesh(bodyGeo, fur);
  body.position.y = 0.085;
  const bellyGeo = S(0.05);
  bellyGeo.scale(0.95, 1.1, 0.45);
  const belly = new THREE.Mesh(bellyGeo, light);
  belly.position.set(0, 0.08, 0.042);
  // cabeça, focinho, orelhas
  const head = new THREE.Mesh(S(0.058, 24, 16), fur);
  head.position.y = 0.2;
  const snoutGeo = S(0.026);
  snoutGeo.scale(1.1, 0.8, 0.8);
  const snout = new THREE.Mesh(snoutGeo, light);
  snout.position.set(0, 0.188, 0.05);
  const nose = new THREE.Mesh(S(0.009, 10, 8), ink);
  nose.position.set(0, 0.197, 0.07);
  g.add(body, belly, head, snout, nose);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(S(0.022), fur);
    ear.position.set(sx * 0.045, 0.248, -0.005);
    ear.scale.set(1, 1, 0.6);
    const inner = new THREE.Mesh(S(0.013), light);
    inner.position.set(sx * 0.045, 0.248, 0.006);
    inner.scale.set(1, 1, 0.4);
    const eye = new THREE.Mesh(S(0.0075, 10, 8), ink);
    eye.position.set(sx * 0.022, 0.215, 0.05);
    // braços e pernas
    const armGeo = new THREE.CapsuleGeometry(0.019, 0.05, 4, 10);
    const arm = new THREE.Mesh(armGeo, fur);
    arm.position.set(sx * 0.072, 0.105, 0.012);
    arm.rotation.set(0.35, 0, sx * 0.55);
    const legGeo = new THREE.CapsuleGeometry(0.023, 0.045, 4, 10);
    const leg = new THREE.Mesh(legGeo, fur);
    leg.position.set(sx * 0.04, 0.03, 0.04);
    leg.rotation.x = Math.PI / 2 - 0.15;
    const padGeo = new THREE.CircleGeometry(0.017, 14);
    const pad = new THREE.Mesh(padGeo, light);
    pad.position.set(sx * 0.04, 0.026, 0.078);
    g.add(ear, inner, eye, arm, leg, pad);
  }
  // lacinho no pescoço
  for (const sx of [-1, 1]) {
    const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.034, 10).rotateZ(sx * Math.PI / 2), bow);
    lobe.position.set(sx * 0.018, 0.148, 0.056);
    g.add(lobe);
  }
  const knot = new THREE.Mesh(S(0.009, 10, 8), bow);
  knot.position.set(0, 0.148, 0.06);
  g.add(knot);

  const k = size / 0.26;
  g.scale.setScalar(k);
  // sentado: em pé; deitado (para carregar): cabeça em +X, deitado de costas
  outer.userData.sit = () => { g.rotation.set(0, 0, 0); g.position.set(0, 0, 0); };
  outer.userData.lie = () => { g.rotation.set(0, 0, -Math.PI / 2); g.position.set(-0.13 * k, 0.06 * k, 0); };
  outer.userData.lie();
  outer.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.carryKind = 'bear'; } });
  return outer;
}

/** Geometria única (sem materiais) do ossinho dourado, igual ao das outras fases. */
export function boneGeometry() {
  /** @type {THREE.BufferGeometry[]} */
  const parts = [new THREE.CapsuleGeometry(0.021, 0.1, 4, 10).rotateZ(Math.PI / 2)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(new THREE.SphereGeometry(0.03, 12, 10).translate(sx * 0.068, 0, sz * 0.022));
  const merged = mergeGeometries(parts.map(prep));
  merged.scale(1, 0.62, 1);
  return merged;
}

/**
 * Meia listrada de algodão (≈ len de comprimento do punho à ponta), em pé: o punho canelado em cima (y = 0, onde o
 * pregador e a boca seguram), o cano listrado descendo e o pé dobrado para a frente (+Z), com calcanhar e ponta
 * creme. Malha macia: tubo por um caminho com curva (TubeGeometry), listras numa textura de canvas.
 * @param {number} [len]
 */
export function createSock(len = 0.26) {
  const g = new THREE.Group();
  g.name = 'meia';
  g.userData.carryKind = 'sock';
  const stripes = canvasTexture(64, 128, (c, w, h) => {
    c.fillStyle = '#fff4e2';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8554a';
    for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 16);
    // fiozinhos da malha
    c.fillStyle = 'rgba(80,40,30,0.08)';
    for (let x = 0; x < w; x += 4) c.fillRect(x, 0, 1, h);
  });
  stripes.repeat.set(1, 1);
  const knit = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.95 });
  const cream = new THREE.MeshStandardMaterial({ color: '#fff1dd', roughness: 0.95 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.9 });
  const r = len * 0.17;
  // cano: do punho para baixo, curva no calcanhar e o pé para a frente
  const leg = len * 0.62;
  const foot = len * 0.5;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.01, 0), new THREE.Vector3(0, -leg * 0.5, 0), new THREE.Vector3(0, -leg, -r * 0.2),
    new THREE.Vector3(0, -leg - r * 0.9, foot * 0.3), new THREE.Vector3(0, -leg - r * 0.7, foot * 0.75), new THREE.Vector3(0, -leg - r * 0.3, foot),
  ]);
  const tube = new THREE.TubeGeometry(curve, 28, r, 14, false);
  // achata o pé e afina a ponta
  const pos = tube.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ft = Math.max(0, Math.min(1, (v.z + r) / (foot + r)));
    v.x *= 1 - 0.18 * ft;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  tube.computeVertexNormals();
  const body = new THREE.Mesh(tube, knit);
  // ponta e calcanhar creme (tampas suaves), punho canelado
  const toe = new THREE.Mesh(new THREE.SphereGeometry(r * 0.86, 14, 10), cream);
  toe.scale.set(0.82, 0.8, 0.7);
  toe.position.copy(curve.getPoint(1));
  const heel = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 12, 8), cream);
  heel.position.set(0, -leg - r * 0.35, -r * 0.35);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.04, len * 0.12, 16, 1, true), cuffMat);
  cuff.position.y = -len * 0.06;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, r * 0.18, 6, 18).rotateX(Math.PI / 2), cuffMat);
  rim.position.y = -0.002;
  g.add(body, toe, heel, cuff, rim);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.carryKind = 'sock'; } });
  return g;
}

/**
 * Frisbee de plástico (≈ size de diâmetro), deitado com a base em y = 0: disco levemente abaulado, borda
 * enrolada por baixo, anel branco e uma estrelinha no meio. A boca morde pela borda (carryPose 'frisbee').
 * @param {number} [size]
 */
export function createFrisbee(size = 0.2) {
  const R = size / 2;
  const g = new THREE.Group();
  g.name = 'frisbee';
  g.userData.carryKind = 'frisbee';
  const plastic = new THREE.MeshPhysicalMaterial({ color: '#f26b5b', roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.15 });
  const white = new THREE.MeshPhysicalMaterial({ color: '#fff4e2', roughness: 0.4, clearcoat: 0.4 });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#ffc94d', roughness: 0.35, clearcoat: 0.5 });
  // perfil (raio, altura) do centro de cima, pela borda enrolada, até o centro de baixo
  const prof = [[0, 0.15], [0.35, 0.145], [0.62, 0.13], [0.84, 0.105], [0.95, 0.08], [1.0, 0.05], [0.99, 0.015], [0.95, 0.0], [0.9, 0.012], [0.88, 0.05], [0.84, 0.085], [0.6, 0.11], [0.3, 0.12], [0, 0.122]];
  const disc = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r * R), y * R)), 48), plastic);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.66, R * 0.035, 8, 48).rotateX(Math.PI / 2), white);
  ring.scale.y = 0.4;
  ring.position.y = R * 0.13;
  // estrelinha de cinco pontas no centro
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = (i % 2 ? 0.11 : 0.26) * R;
    if (i) star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const starMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: R * 0.02, bevelEnabled: false }).rotateX(-Math.PI / 2), gold);
  starMesh.position.y = R * 0.148;
  g.add(disc, ring, starMesh);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.carryKind = 'frisbee'; } });
  return g;
}
