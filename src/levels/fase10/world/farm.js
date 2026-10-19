// FASE 10 · O campinho no canto sudoeste do quintal: fileiras de milho altas (com espigas), o canteiro de cenouras, as
// abóboras e o espantalho de chapéu de palha. De cada pé sai um legume para levar na boca (para distrair os porcos);
// quando um pé é colhido, o legume volta a aparecer depois de um tempo.
// API: buildFarm(root, layout) → { group, spots: FarmSpot[], makeVeg(kind) → Object3D, update(dt, t) }
//   FarmSpot = { id, kind: 'corn'|'carrot'|'pumpkin', x, z, setReady(on) }
import * as THREE from 'three';
import { rng, rbox, stdMat, woodMat, foliageCluster, mergeGeometries } from '../../../world/util.js';
import { plantMat, carrotTops } from '../../../world/plants.js';

const TAU = Math.PI * 2;

/** Espiga de milho (palha verde aberta e os grãos amarelos), eixo longo em X, centrada. */
export function createCorn() {
  const g = new THREE.Group();
  g.name = 'corn';
  g.userData.carryKind = 'carrot';
  const cob = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.11, 4, 10).rotateZ(Math.PI / 2), stdMat('#f6cf3a', { roughness: 0.6 }));
  g.add(cob);
  for (const s of [-1, 1]) {
    const husk = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), stdMat('#8ab84e', { roughness: 0.8 }));
    husk.scale.set(2.6, 0.5, 1.1);
    husk.position.set(-0.025, s * 0.018, s * 0.008);
    husk.rotation.z = s * 0.25;
    g.add(husk);
  }
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.userData.carryKind = 'carrot'; } });
  return g;
}
/** Cenoura com as folhinhas, eixo longo em X. */
export function createCarrot() {
  const g = new THREE.Group();
  g.name = 'carrot';
  g.userData.carryKind = 'carrot';
  const root = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.15, 10).rotateZ(Math.PI / 2), stdMat('#f07a2a', { roughness: 0.6 }));
  root.position.x = 0.02;
  const tops = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 6).rotateZ(-Math.PI / 2), stdMat('#5d9a35', { roughness: 0.8 }));
  tops.position.x = -0.085;
  g.add(root, tops);
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.userData.carryKind = 'carrot'; } });
  return g;
}
/** Abóbora pequena (gomos e o cabinho). */
export function createPumpkin() {
  const g = new THREE.Group();
  g.name = 'pumpkin';
  g.userData.carryKind = 'ball';
  const geo = new THREE.SphereGeometry(0.075, 16, 10);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.08 * Math.cos(a * 8);
    p.setXYZ(i, x * k, y * 0.78, z * k);
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, stdMat('#f28c28', { roughness: 0.55 }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.04, 6), stdMat('#6a5a2a'));
  stem.position.y = 0.065;
  g.add(body, stem);
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.userData.carryKind = 'ball'; } });
  return g;
}

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildFarm(root, layout) {
  const { PLANTATION: F } = layout;
  const group = new THREE.Group();
  group.name = 'campinho';
  const r = rng(71);

  // ---------------- terra arada (faixas escuras) por baixo das fileiras
  const soilMat = stdMat('#5a4128', { roughness: 1 });
  const soils = [];
  for (const c of F.corn) {
    const g = new THREE.BoxGeometry(F.cornHx * 2 + 0.1, 0.03, c.z1 - c.z0 + 0.2);
    g.translate(c.x, 0.012, (c.z0 + c.z1) / 2);
    soils.push(g);
  }
  const cb = F.carrots;
  const cg = new THREE.BoxGeometry(cb.hx * 2, 0.04, cb.hz * 2);
  cg.translate(cb.x, 0.018, cb.z);
  soils.push(cg);
  const soil = new THREE.Mesh(mergeGeometries(soils), soilMat);
  soil.receiveShadow = true;
  group.add(soil);

  // ---------------- milho: pés altos com folhas compridas e espigas (instanciados por fileira)
  const stalkG = new THREE.CylinderGeometry(0.014, 0.02, 1.25, 6);
  stalkG.translate(0, 0.625, 0);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.2, 0.06, 0.42, -0.04); leafShape.quadraticCurveTo(0.2, 0.01, 0, 0.025);
  const leafG = new THREE.ShapeGeometry(leafShape);
  const leaves = [];
  for (let k = 0; k < 6; k++) {
    const g = leafG.clone();
    g.rotateY((k / 6) * TAU + 0.4);
    g.rotateZ(0);
    g.translate(0, 0.35 + k * 0.14, 0);
    leaves.push(g);
  }
  const stalkLeaves = mergeGeometries(leaves);
  const tassel = new THREE.ConeGeometry(0.05, 0.16, 6);
  tassel.translate(0, 1.33, 0);
  const cornPlant = mergeGeometries([stalkG.toNonIndexed(), stalkLeaves.index ? stalkLeaves.toNonIndexed() : stalkLeaves, tassel.toNonIndexed()]);
  const stalkPos = [];
  for (const c of F.corn) for (let z = c.z0 + 0.12; z <= c.z1 - 0.1; z += 0.26) stalkPos.push([c.x + (r() - 0.5) * 0.06, z + (r() - 0.5) * 0.05, r()]);
  const cornMesh = new THREE.InstancedMesh(cornPlant, stdMat('#6f9a3a', { roughness: 0.8, side: THREE.DoubleSide }), stalkPos.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), e = new THREE.Euler();
  stalkPos.forEach(([x, z, k], i) => {
    e.set((k - 0.5) * 0.06, k * TAU, (k - 0.5) * 0.08);
    sc.setScalar(0.85 + k * 0.3);
    cornMesh.setMatrixAt(i, m4.compose(pv.set(x, 0, z), q.setFromEuler(e), sc));
  });
  cornMesh.castShadow = true;
  cornMesh.name = 'milharal';
  group.add(cornMesh);

  // ---------------- os pontos de colheita: na ponta de cada fileira (espiga), no canteiro (cenoura) e as abóboras
  /** @type {{ id: string, kind: 'corn'|'carrot'|'pumpkin', x: number, z: number, setReady(on: boolean): void }[]} */
  const spots = [];
  F.corn.forEach((c, i) => {
    const ear = createCorn();
    ear.scale.setScalar(1.15);
    ear.position.set(c.x + 0.05, 0.75, c.z1 + 0.04);
    ear.rotation.set(0, Math.PI / 2, 0.9);
    group.add(ear);
    spots.push({ id: `milho-${i + 1}`, kind: 'corn', x: c.x, z: c.z1 + 0.32, setReady(on) { ear.visible = on; } });
  });
  // canteiro de cenouras (bordas de madeira e as folhinhas)
  const bedWood = woodMat('#7a5234', { key: 'f10-canteiro-campinho' });
  const bed = new THREE.Group();
  for (const [x, z, w, d] of [[0, -cb.hz, cb.hx * 2 + 0.05, 0.05], [0, cb.hz, cb.hx * 2 + 0.05, 0.05], [-cb.hx, 0, 0.05, cb.hz * 2 - 0.06], [cb.hx, 0, 0.05, cb.hz * 2 - 0.06]]) {
    const ed = new THREE.Mesh(rbox(w, 0.14, d, 0.008), bedWood);
    ed.position.set(x, 0.07, z);
    bed.add(ed);
  }
  const carrotTopsMeshes = [];
  for (let k = 0; k < 6; k++) {
    const t = new THREE.Mesh(carrotTops({ seed: 120 + k, height: 0.18 }), plantMat());
    t.position.set(-cb.hx + 0.1 + k * ((cb.hx * 2 - 0.2) / 5), 0.04, (k % 2 ? 0.07 : -0.07));
    bed.add(t);
    carrotTopsMeshes.push(t);
  }
  bed.position.set(cb.x, 0, cb.z);
  group.add(bed);
  spots.push({ id: 'cenouras', kind: 'carrot', x: cb.x, z: cb.z + cb.hz + 0.3, setReady(on) { carrotTopsMeshes[2].visible = on; carrotTopsMeshes[3].visible = on; } });
  // abóboras com a rama
  F.pumpkins.forEach((p, i) => {
    const pk = createPumpkin();
    pk.scale.setScalar(2.4);
    pk.position.set(p.x, 0.13, p.z);
    group.add(pk);
    const vine = new THREE.Mesh(foliageCluster([{ x: p.x - 0.25, y: 0.06, z: p.z + 0.1, r: 0.16, sy: 0.4 }, { x: p.x + 0.2, y: 0.05, z: p.z - 0.15, r: 0.13, sy: 0.4 }], { seed: 130 + i, dark: '#2c5226', mid: '#4a7f36', light: '#86b850', amp: 0.4 }), plantMat());
    group.add(vine);
    spots.push({ id: `abobora-${i + 1}`, kind: 'pumpkin', x: p.x, z: p.z, setReady(on) { pk.visible = on; } });
  });

  // ---------------- o espantalho (chapéu de palha e camisa xadrez)
  const crow = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.5, 6), woodMat('#8a6a42', { key: 'f10-espantalho', vertical: true }));
  pole.position.y = 0.75;
  const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6).rotateZ(Math.PI / 2), pole.material);
  arms.position.y = 1.15;
  const shirt = new THREE.Mesh(rbox(0.36, 0.42, 0.16, 0.04), stdMat('#c94a5a', { roughness: 0.9 }));
  shirt.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), stdMat('#e8d2a8', { roughness: 0.9 }));
  head.position.y = 1.42;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.1, 14), stdMat('#d8b060', { roughness: 0.9 }));
  hat.position.y = 1.55;
  crow.add(pole, arms, shirt, head, hat);
  crow.position.set(F.x0 + 0.15, 0, F.z1 - 0.1);
  crow.rotation.y = 0.5;
  crow.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(crow);

  root.add(group);
  return {
    group, spots,
    /** Um legume novo para levar na boca. @param {'corn'|'carrot'|'pumpkin'} kind */
    makeVeg(kind) { return kind === 'corn' ? createCorn() : kind === 'carrot' ? createCarrot() : createPumpkin(); },
    update(dt, t) {
      crow.rotation.z = Math.sin(t * 0.7) * 0.02;
    },
  };
}
