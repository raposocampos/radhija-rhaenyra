// FASE 7 · A pracinha em volta: bancos de ripas com pés de ferro verde, postes de luminária clássicos,
// árvores (troncos com terra batida), lixeira, cerca viva baixa nas bordas com canteiros floridos e, ao
// fundo, as casas e prédios do bairro entre árvores (suavizados pela névoa úmida da manhã).
import * as THREE from 'three';
import { woodMat, stdMat, rbox, rng, foliageCluster, contactShadow, leafSkin } from '../../../world/util.js';
import { hedgeMat, plantMat, geranium, smallFlowers } from '../../../world/plants.js';
import { makeTree, makeBuilding } from '../../../world/background.js';

const iron = () => stdMat('#2f4a3a', { roughness: 0.45, metalness: 0.5 });

function bench(group, b) {
  const g = new THREE.Group();
  g.position.set(b.x, 0, b.z);
  g.rotation.y = b.yaw;
  const slat = woodMat('#b9864f', { key: 'f7-bench', rough: 0.55 });
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Mesh(rbox(1.36, 0.035, 0.085, 0.012), slat);
    s.position.set(0, 0.42, -0.14 + k * 0.095);
    g.add(s);
  }
  for (let k = 0; k < 2; k++) {
    const s = new THREE.Mesh(rbox(1.36, 0.08, 0.03, 0.012), slat);
    s.position.set(0, 0.6 + k * 0.12, -0.2 - k * 0.02);
    s.rotation.x = -0.18;
    g.add(s);
  }
  for (const sx of [-0.58, 0.58]) {
    const side = new THREE.Group();
    side.position.x = sx;
    const legF = new THREE.Mesh(rbox(0.05, 0.42, 0.05, 0.01), iron());
    legF.position.set(0, 0.21, 0.13);
    const legB = new THREE.Mesh(rbox(0.05, 0.78, 0.05, 0.01), iron());
    legB.position.set(0, 0.39, -0.2);
    legB.rotation.x = -0.12;
    const arm = new THREE.Mesh(rbox(0.05, 0.04, 0.42, 0.012), iron());
    arm.position.set(0, 0.6, -0.02);
    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI * 1.5), iron());
    scroll.position.set(0, 0.62, 0.17);
    scroll.rotation.y = Math.PI / 2;
    side.add(legF, legB, arm, scroll);
    g.add(side);
  }
  // gotas de chuva no assento
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.55 }));
  const r = rng(Math.round(b.x * 10));
  for (let i = 0; i < 16; i++) {
    const d = drop.clone();
    d.position.set((r() - 0.5) * 1.2, 0.44, -0.15 + r() * 0.3);
    d.scale.y = 0.45;
    g.add(d);
  }
  const sh = contactShadow(0.75, 0.28, 0.38);
  sh.position.y = 0.006;
  g.add(sh);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(g);
}

function lamp(group, l) {
  const g = new THREE.Group();
  g.position.set(l.x, 0, l.z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.18, 8), iron());
  base.position.y = 0.09;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.3, 10), iron());
  pole.position.y = 1.3;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 14), iron());
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2.35;
  // lanterna de quatro vidros com chapéu
  const lantern = new THREE.Group();
  lantern.position.y = 2.5;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.28, 4, 1, true), new THREE.MeshPhysicalMaterial({ color: '#fff6dc', roughness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide, emissive: '#fff1c8', emissiveIntensity: 0.15 }));
  glass.rotation.y = Math.PI / 4;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 4), iron());
  hat.rotation.y = Math.PI / 4;
  hat.position.y = 0.22;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), iron());
  knob.position.y = 0.32;
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.05, 4), iron());
  bottom.rotation.y = Math.PI / 4;
  bottom.position.y = -0.16;
  lantern.add(glass, hat, knob, bottom);
  g.add(base, pole, ring, lantern);
  const sh = contactShadow(0.16, 0.16, 0.4);
  sh.position.y = 0.006;
  g.add(sh);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh && !o.userData.noShadow) o.castShadow = true; });
  group.add(g);
}

function trash(group, t) {
  const g = new THREE.Group();
  g.position.set(t.x, 0, t.z);
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r * 0.86, 0.62, 16, 1, true), stdMat('#3f7a4f', { roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide }));
  bin.position.y = 0.33;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(t.r, 0.014, 6, 20), stdMat('#2f4a3a', { roughness: 0.4, metalness: 0.5 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.64;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), iron());
  post.position.set(0, 0.35, -t.r - 0.02);
  const inside = new THREE.Mesh(new THREE.CircleGeometry(t.r * 0.95, 16).rotateX(-Math.PI / 2), stdMat('#1d1a17', { roughness: 1 }));
  inside.position.y = 0.42;
  g.add(bin, rim, post, inside);
  const sh = contactShadow(0.22, 0.22, 0.4);
  sh.position.y = 0.006;
  g.add(sh);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(g);
}

/** Cerca viva baixa ao longo de uma linha (blobs de folhagem com pele de folhas), com flores na frente. */
function hedgeLine(group, ax, az, bx, bz, seed, flowers = '#ff6a55') {
  const r = rng(seed);
  const len = Math.hypot(bx - ax, bz - az);
  const blobs = [];
  for (let d = 0; d < len; d += 0.32 + r() * 0.14) {
    const t = d / len;
    blobs.push({ x: ax + (bx - ax) * t + (r() - 0.5) * 0.1, y: 0.3 + r() * 0.08, z: az + (bz - az) * t + (r() - 0.5) * 0.1, r: 0.27 + r() * 0.07, sy: 1.0 });
  }
  const geo = foliageCluster(blobs, { detail: 2, amp: 0.2, freq: 3.2, seed, dark: '#22401a', mid: '#3f6628', light: '#86a54c' });
  const hedge = new THREE.Mesh(geo, hedgeMat());
  hedge.castShadow = true;
  hedge.receiveShadow = true;
  group.add(hedge, leafSkin(geo, { count: Math.round(len * 140), size: 0.09, seed: seed + 1, material: plantMat(), minNormalY: -0.1 }));
  const nx = -(bz - az) / len, nz = (bx - ax) / len;
  for (let d = 0.4; d < len - 0.3; d += 0.7 + r() * 0.5) {
    const t = d / len;
    const fl = new THREE.Mesh(r() < 0.5 ? geranium({ radius: 0.16, height: 0.18, seed: seed + d * 10, flower: flowers }) : smallFlowers({ count: 18, radius: 0.13, height: 0.14, color: '#fff3f0', seed: seed + d * 7 }), plantMat());
    fl.position.set(ax + (bx - ax) * t + nx * 0.36, 0, az + (bz - az) * t + nz * 0.36);
    group.add(fl);
  }
}

/** @param {THREE.Group} root @param {import('../../../types').LevelLayout} layout */
export function buildPark(root, layout) {
  const B = layout.WORLD.bounds;
  const group = new THREE.Group();
  group.name = 'praca';
  for (const b of layout.BENCHES) bench(group, b);
  for (const l of layout.LAMPS) lamp(group, l);
  trash(group, layout.TRASH);
  // árvores da praça
  for (const t of layout.TREES) {
    const tr = makeTree({ height: 4.6, crown: 1.45, seed: t.seed });
    tr.position.set(t.x, 0, t.z);
    group.add(tr);
    const sh = contactShadow(0.45, 0.45, 0.35);
    sh.position.set(t.x, 0.006, t.z);
    group.add(sh);
  }
  // cercas vivas baixas nas bordas norte, leste e oeste (por fora dos limites), com canteiros; o sul fica aberto
  // (é de onde a câmera olha, inclusive na comemoração do piquenique)
  hedgeLine(group, B.minX - 0.45, B.minZ - 0.42, B.maxX + 0.45, B.minZ - 0.42, 61, '#ff6a55');
  hedgeLine(group, B.maxX + 0.45, B.minZ - 0.3, B.maxX + 0.45, B.maxZ + 0.2, 67, '#f6a6c1');
  hedgeLine(group, B.minX - 0.45, B.maxZ + 0.2, B.minX - 0.45, B.minZ - 0.3, 71, '#ffd65a');
  // fundo: casas e prédios do bairro entre árvores
  const bg = new THREE.Group();
  bg.name = 'bairro';
  const bdefs = [
    { x: -6.5, z: -12, w: 9, h: 9, d: 7, floors: 3, seed: 21, color: '#f1dcc0', ry: 0 },
    { x: 5.5, z: -13, w: 10, h: 12, d: 8, floors: 4, seed: 22, color: '#e9eef0', ry: -0.08 },
    { x: 15, z: -3, w: 8, h: 8, d: 10, floors: 2, seed: 23, color: '#f3e3cf', ry: -Math.PI / 2 + 0.08 },
    { x: -15, z: -4, w: 9, h: 10, d: 9, floors: 3, seed: 24, color: '#ecd6bd', ry: Math.PI / 2 - 0.1 },
  ];
  for (const b of bdefs) {
    const m = makeBuilding(b);
    m.position.set(b.x, 0, b.z);
    m.rotation.y = b.ry;
    m.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    bg.add(m);
  }
  const r = rng(29);
  for (const [x, z] of [[-9, -7], [-3, -8], [2.5, -8.5], [8.5, -7], [10, 0], [-10.5, 1], [-9.5, 6.5], [9.5, 6]]) {
    const tr = makeTree({ height: 5.5 + r() * 1.5, crown: 1.8 + r() * 0.4, seed: 40 + x });
    tr.position.set(x, 0, z);
    bg.add(tr);
  }
  group.add(bg);
  root.add(group);
  return { group };
}
