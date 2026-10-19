// FASE 10 · A piñata da estrela no gramado do quintal: a mangueira grande com o galho comprido por cima da roseira,
// a corda e a piñata de estrela (cinco pontas com franjas de papel colorido) que balança como um pêndulo, racha a
// cada batida e, na terceira, se abre em pedaços com balas voando. A roseira florida (com espinhos) fica embaixo.
// API: buildPinata(root, layout) → { group, pinata: { object, setPos(x, y, z, tiltX, tiltZ), setCracks(n), burst(),
//   reset() }, update(dt, t) }
import * as THREE from 'three';
import { rng, rbox, stdMat, woodMat, foliageCluster, leafSkin, contactShadow, mergeGeometries, canvasTexture } from '../../../world/util.js';
import { crownMat, plantMat } from '../../../world/plants.js';

const TAU = Math.PI * 2;
const tube = (curve, segs, radius, radial = 8) => new THREE.TubeGeometry(curve, segs, radius, radial, false);

/** Papel crepom em franjas coloridas (faixas horizontais). */
function fringeTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const cols = ['#f27a8a', '#f6c453', '#7cc4e8', '#9bd57a', '#c9a0f0', '#ff9a3c'];
    for (let j = 0; j < 8; j++) {
      g.fillStyle = cols[j % cols.length];
      g.fillRect(0, j * 16, w, 16);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (let x = 0; x < w; x += 6) g.fillRect(x, j * 16 + 10, 2, 6);
    }
  });
}

/** Estrela de cinco pontas extrudada (plana, gordinha), centrada na origem e de frente para +Z. */
function starGeometry(R, r, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 ? r : R;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: R * 0.08, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildPinata(root, layout) {
  const { ROSE_BUSH, MANGO_TREE, PINATA } = layout;
  const group = new THREE.Group();
  group.name = 'pinata-e-mangueira';
  const r = rng(61);

  // ================================================================ a mangueira grande e o galho da piñata
  const bark = woodMat('#6b4f3a', { key: 'f10-mangueira', vertical: true, rough: 0.95 });
  const tree = new THREE.Group();
  const trunkPts = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    trunkPts.push(new THREE.Vector3(MANGO_TREE.x + Math.sin(t * 2.2) * 0.1, t * 3.4, MANGO_TREE.z + Math.cos(t * 1.6) * 0.08));
  }
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);
  const trunkGeo = tube(trunkCurve, 18, MANGO_TREE.r * 0.85, 12);
  const tp = trunkGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const seg = Math.floor(i / 13) / 18;
    const c = trunkCurve.getPointAt(Math.min(1, seg));
    const k = (1 - seg * 0.5) * (1 + Math.max(0, 0.1 - seg) * 4);
    tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * k, tp.getY(i), c.z + (tp.getZ(i) - c.z) * k);
  }
  trunkGeo.computeVertexNormals();
  tree.add(new THREE.Mesh(trunkGeo, bark));
  // o galho comprido até em cima da roseira (afina na ponta)
  const P = PINATA.pivot;
  const branchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(MANGO_TREE.x - 0.05, 2.05, MANGO_TREE.z - 0.05),
    new THREE.Vector3(MANGO_TREE.x - 0.7, 2.55, MANGO_TREE.z - 0.45),
    new THREE.Vector3(P.x + 0.35, P.y + 0.12, P.z + 0.2),
    new THREE.Vector3(P.x - 0.25, P.y + 0.05, P.z - 0.12),
  ]);
  const brGeo = tube(branchCurve, 24, 0.09, 8);
  const bp = brGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const seg = Math.floor(i / 9) / 24;
    const c = branchCurve.getPointAt(Math.min(1, seg));
    const k = 1 - seg * 0.6;
    bp.setXYZ(i, c.x + (bp.getX(i) - c.x) * k, c.y + (bp.getY(i) - c.y) * k, c.z + (bp.getZ(i) - c.z) * k);
  }
  brGeo.computeVertexNormals();
  tree.add(new THREE.Mesh(brGeo, bark));
  // copa alta com mangas
  const blobs = [];
  for (let k = 0; k < 9; k++) {
    const a = r() * TAU, d = 0.3 + r() * 1.0;
    blobs.push({ x: MANGO_TREE.x + Math.cos(a) * d, y: 3.6 + r() * 0.9, z: MANGO_TREE.z + Math.sin(a) * d * 0.8, r: 0.7 + r() * 0.35 });
  }
  blobs.push({ x: MANGO_TREE.x - 0.4, y: 3.4, z: MANGO_TREE.z - 0.3, r: 0.75 });
  const crownGeo = foliageCluster(blobs, { detail: 3, amp: 0.28, freq: 1.4, seed: 63, dark: '#22401a', mid: '#3f6c2c', light: '#86ad4e' });
  const crown = new THREE.Mesh(crownGeo, crownMat());
  const leaves = leafSkin(crownGeo, { count: 700, size: 0.11, seed: 63, material: crownMat() });
  tree.add(crown, leaves);
  const mangoG = new THREE.SphereGeometry(0.06, 10, 8);
  mangoG.scale(0.85, 1.2, 0.85);
  const mangoMat = stdMat('#f2a03a', { roughness: 0.5 });
  const mangos = [];
  for (let k = 0; k < 9; k++) {
    const a = r() * TAU, d = 0.5 + r() * 0.8;
    const m = mangoG.clone();
    m.translate(MANGO_TREE.x + Math.cos(a) * d, 3.0 + r() * 0.4, MANGO_TREE.z + Math.sin(a) * d * 0.8);
    mangos.push(m);
  }
  tree.add(new THREE.Mesh(mergeGeometries(mangos), mangoMat));
  tree.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(tree);
  const tsh = contactShadow(1.4, 1.2, 0.32);
  tsh.position.set(MANGO_TREE.x, 0.006, MANGO_TREE.z);
  group.add(tsh);

  // ================================================================ a roseira (espinhos: ninguém entra)
  const bush = new THREE.Group();
  const bushBlobs = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + r() * 0.5, d = r() * ROSE_BUSH.r * 0.55;
    bushBlobs.push({ x: Math.cos(a) * d, y: 0.24 + r() * 0.18, z: Math.sin(a) * d, r: 0.26 + r() * 0.1, sy: 0.85 });
  }
  const bushGeo = foliageCluster(bushBlobs, { detail: 2, amp: 0.3, freq: 2.2, seed: 65, dark: '#1f3a18', mid: '#36602a', light: '#6f9a45' });
  bush.add(new THREE.Mesh(bushGeo, plantMat()));
  const roseG = new THREE.SphereGeometry(0.045, 8, 6);
  const roses = [];
  for (let k = 0; k < 22; k++) {
    const a = r() * TAU, d = 0.15 + r() * (ROSE_BUSH.r - 0.15);
    const g = roseG.clone();
    g.translate(Math.cos(a) * d, 0.3 + r() * 0.26, Math.sin(a) * d);
    roses.push(g);
  }
  bush.add(new THREE.Mesh(mergeGeometries(roses), stdMat('#e8406a', { roughness: 0.55 })));
  bush.position.set(ROSE_BUSH.x, 0, ROSE_BUSH.z);
  bush.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(bush);

  // ================================================================ a piñata de estrela, a corda e os pedaços
  const fringe = fringeTexture();
  const pin = new THREE.Group();
  pin.name = 'pinata';
  const S = PINATA.size;
  const body = new THREE.Mesh(starGeometry(S * 0.55, S * 0.27, S * 0.26), new THREE.MeshStandardMaterial({ map: fringe, roughness: 0.85 }));
  body.position.y = -S * 0.55;
  pin.add(body);
  // franjas penduradas nas pontas de baixo e o lacinho em cima
  const tassels = [];
  for (const i of [2, 3, 4, 6, 7, 8]) {
    if (i % 2) continue;
    const a = Math.PI / 2 + (i / 10) * TAU;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 6, 1, true), stdMat(['#f27a8a', '#f6c453', '#7cc4e8'][i % 3], { roughness: 0.9, side: THREE.DoubleSide }));
    t.position.set(Math.cos(a) * S * 0.55, body.position.y + Math.sin(a) * S * 0.55 - 0.08, 0);
    t.rotation.x = Math.PI;
    tassels.push(t);
    pin.add(t);
  }
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 12), stdMat('#5a5650', { metalness: 0.6 }));
  hook.position.y = 0.0;
  pin.add(hook);
  // rachaduras (aparecem a cada batida)
  const crackMat = new THREE.MeshBasicMaterial({ color: '#3a2418', transparent: true, opacity: 0 });
  const cracks = [0, 1, 2].map((k) => {
    const g = new THREE.PlaneGeometry(0.16, 0.012);
    const m = new THREE.Mesh(g, crackMat.clone());
    m.position.set((k - 1) * 0.06, body.position.y + (k - 1) * 0.05, S * 0.26 * 0.5 + 0.012);
    m.rotation.z = (k - 1) * 0.7 + 0.3;
    pin.add(m);
    return m;
  });
  pin.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh && o !== cracks[0] && o !== cracks[1] && o !== cracks[2]) o.castShadow = true; });
  group.add(pin);
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#d8b880', roughness: 0.95 });
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), ropeMat);
  rope.castShadow = true;
  group.add(rope);
  // os pedaços e as balas (escondidos até abrir)
  const pieces = [];
  const pieceMat = new THREE.MeshStandardMaterial({ map: fringe, roughness: 0.85, side: THREE.DoubleSide });
  for (let k = 0; k < 6; k++) {
    const g = new THREE.ConeGeometry(S * 0.18, S * 0.32, 4, 1);
    const m = new THREE.Mesh(g, pieceMat);
    m.visible = false;
    m.castShadow = true;
    group.add(m);
    pieces.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), rest: false });
  }
  const candyCols = ['#f27a8a', '#f6c453', '#7cc4e8', '#9bd57a', '#c9a0f0'];
  const candies = [];
  for (let k = 0; k < 10; k++) {
    const m = new THREE.Mesh(rbox(0.05, 0.025, 0.025, 0.008), stdMat(candyCols[k % candyCols.length], { roughness: 0.4 }));
    m.visible = false;
    group.add(m);
    candies.push({ m, v: new THREE.Vector3(), rest: false });
  }

  const st = { x: P.x, y: P.y - PINATA.L, z: P.z, tx: 0, tz: 0, cracks: 0, burst: false, spin: 0 };
  const top = new THREE.Vector3(), piv = new THREE.Vector3(P.x, P.y, P.z);
  function layoutPin() {
    pin.visible = !st.burst;
    rope.visible = true;
    pin.position.set(st.x, st.y, st.z);
    pin.rotation.set(st.tz, st.spin, -st.tx);
    top.set(st.x, st.y, st.z);
    // a corda: do galho até o gancho (sem a piñata, ela fica pendurada com um pedacinho rasgado)
    const end = st.burst ? top.clone().lerp(piv, 0.65) : top;
    rope.position.copy(piv).add(end).multiplyScalar(0.5);
    rope.scale.y = piv.distanceTo(end);
    rope.lookAt(end);
    rope.rotateX(Math.PI / 2);
  }
  layoutPin();
  root.add(group);
  return {
    group,
    pinata: {
      object: pin,
      /** Onde fica o gancho (fim da corda) e a inclinação do balanço (rad, em X e Z). */
      setPos(x, y, z, tiltX, tiltZ) { st.x = x; st.y = y; st.z = z; st.tx = tiltX; st.tz = tiltZ; },
      setCracks(n) {
        st.cracks = n;
        cracks.forEach((c, i) => { /** @type {THREE.MeshBasicMaterial} */ (c.material).opacity = i < n ? 0.85 : 0; });
        st.spin += 0.9;
      },
      /** Abre: os pedaços e as balas voam a partir de onde ela está. */
      burst() {
        st.burst = true;
        const c = new THREE.Vector3(st.x, st.y - S * 0.55, st.z);
        pieces.forEach((p, k) => {
          const a = (k / pieces.length) * TAU;
          p.m.visible = true;
          p.m.position.copy(c);
          p.v.set(Math.cos(a) * 1.4, 1.2 + (k % 2) * 0.5, Math.sin(a) * 1.4);
          p.w.set(3 + k, 2 - k, 4);
          p.rest = false;
        });
        candies.forEach((cd, k) => {
          const a = (k / candies.length) * TAU + 0.3;
          cd.m.visible = true;
          cd.m.position.copy(c);
          cd.v.set(Math.cos(a) * (0.8 + (k % 3) * 0.4), 1.0 + (k % 2) * 0.6, Math.sin(a) * (0.8 + (k % 3) * 0.4));
          cd.rest = false;
        });
      },
      reset() {
        st.burst = false;
        st.cracks = 0;
        st.spin = 0;
        cracks.forEach((c) => { /** @type {THREE.MeshBasicMaterial} */ (c.material).opacity = 0; });
        for (const p of pieces) p.m.visible = false;
        for (const cd of candies) cd.m.visible = false;
      },
    },
    update(dt, t) {
      layoutPin();
      tassels.forEach((ts, i) => { ts.rotation.z = Math.sin(t * 3 + i) * 0.15; });
      // pedaços e balas caindo (quicam no chão e param; na roseira, ficam por cima dela)
      const floorAt = (x, z) => (Math.hypot(x - ROSE_BUSH.x, z - ROSE_BUSH.z) < ROSE_BUSH.r ? ROSE_BUSH.h : 0.02);
      for (const p of pieces) {
        if (!p.m.visible || p.rest) continue;
        p.v.y -= 9.8 * dt;
        p.m.position.addScaledVector(p.v, dt);
        p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; p.m.rotation.z += p.w.z * dt;
        const fy = floorAt(p.m.position.x, p.m.position.z);
        if (p.m.position.y < fy) { p.m.position.y = fy; p.v.multiplyScalar(0.3); p.v.y = Math.abs(p.v.y); if (p.v.length() < 0.2) { p.rest = true; p.m.rotation.set(Math.PI / 2, p.m.rotation.y, 0); } }
      }
      for (const cd of candies) {
        if (!cd.m.visible || cd.rest) continue;
        cd.v.y -= 9.8 * dt;
        cd.m.position.addScaledVector(cd.v, dt);
        cd.m.rotation.y += 6 * dt;
        const fy = floorAt(cd.m.position.x, cd.m.position.z) + 0.012;
        if (cd.m.position.y < fy) { cd.m.position.y = fy; cd.v.multiplyScalar(0.35); cd.v.y = Math.abs(cd.v.y) * 0.6; if (cd.v.length() < 0.15) cd.rest = true; }
      }
    },
  };
}
