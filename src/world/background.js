// Fundo fora dos limites: prédios do condomínio (janelas, varandas) suavizados pela névoa e árvores de copa orgânica.
import * as THREE from 'three';
import { foliageCluster, woodMat, plasterMat, stdMat, canvasTexture, rng, rbox, mat, leafSkin } from './util.js';
import { plantMat } from './plants.js';
import { crownMat } from './plants.js';

function facadeTexture(cols, rows, seed, base = '#f1dcc0') {
  return canvasTexture(64 * cols, 80 * rows, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++) {
      // faixa de laje
      g.fillStyle = 'rgba(120,90,60,0.18)'; g.fillRect(0, j * 80 + 74, w, 6);
      for (let i = 0; i < cols; i++) {
        const x = i * 64 + 14, y = j * 80 + 18;
        const lit = r() < 0.28;
        g.fillStyle = lit ? '#ffcf8a' : (r() < 0.5 ? '#6d7f8e' : '#8494a0');
        g.fillRect(x, y, 36, 42);
        if (!lit) { g.fillStyle = 'rgba(255,230,200,0.35)'; g.fillRect(x, y, 36, 10); }
        g.fillStyle = '#efe6d8'; g.fillRect(x - 3, y - 3, 42, 3); g.fillRect(x - 3, y + 42, 42, 4); g.fillRect(x + 17, y, 2, 42);
      }
    }
  }, { repeat: false });
}
function emissiveFacade(cols, rows, seed) {
  // só as janelas acesas brilham
  return canvasTexture(64 * cols, 80 * rows, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const lit = r() < 0.28;
      r();
      if (lit) { g.fillStyle = '#c98a40'; g.fillRect(i * 64 + 14, j * 80 + 18, 36, 42); }
    }
  }, { repeat: false });
}

export function makeBuilding({ w, h, d, floors, seed, color = '#f1dcc0', balconies = true }) {
  const g = new THREE.Group();
  const cols = Math.max(2, Math.round(w / 2.2));
  const map = facadeTexture(cols, floors, seed, color);
  const em = emissiveFacade(cols, floors, seed);
  const front = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.9 });
  const side = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, front, side]);
  body.position.y = h / 2;
  g.add(body);
  // platibanda
  const par = new THREE.Mesh(rbox(w + 0.3, 0.5, d + 0.3, 0.05), stdMat('#e2cfb2'));
  par.position.y = h + 0.2;
  g.add(par);
  if (balconies) {
    const balMat = stdMat('#efe6d8', { roughness: 0.8 });
    const railMat = stdMat('#5b5248', { roughness: 0.6, metalness: 0.3 });
    const fh = h / floors;
    for (let f = 1; f < floors; f++) {
      for (let i = 0; i < cols; i += 2) {
        const x = -w / 2 + (i + 0.5) * (w / cols);
        const slab = new THREE.Mesh(rbox(w / cols * 1.4, 0.12, 0.9, 0.03), balMat);
        slab.position.set(x, f * fh, d / 2 + 0.45);
        const rail = new THREE.Mesh(rbox(w / cols * 1.4, 0.9, 0.05, 0.02), railMat);
        rail.position.set(x, f * fh + 0.5, d / 2 + 0.88);
        g.add(slab, rail);
        // vaso com planta na varanda
        if ((i + f) % 3 === 0) {
          const pl = new THREE.Mesh(foliageCluster([{ x: 0, y: 0, z: 0, r: 0.35 }], { detail: 1, amp: 0.2, freq: 3, seed: f * 7 + i }), crownMat());
          pl.position.set(x - 0.4, f * fh + 0.45, d / 2 + 0.55);
          g.add(pl);
        }
      }
    }
  }
  return g;
}

export function makeTree({ height = 5, crown = 1.6, seed = 1, lean = 0 } = {}) {
  const g = new THREE.Group();
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    pts.push(new THREE.Vector3(Math.sin(t * 2 + seed) * 0.12 + lean * t, t * height * 0.62, Math.cos(t * 1.7 + seed) * 0.1));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunkGeo = new THREE.TubeGeometry(curve, 16, height * 0.03, 8);
  // afunila
  const p = trunkGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.floor(i / 9) / 16;
    const c = curve.getPointAt(Math.min(1, t));
    const k = 1 - t * 0.55;
    p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, p.getY(i), c.z + (p.getZ(i) - c.z) * k);
  }
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, woodMat('#6b4f3a', { key: 'tree-bark', vertical: true, rough: 0.95 }));
  g.add(trunk);
  const top = curve.getPointAt(1);
  const blobs = [];
  const n = 7 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = r() * crown * 0.6;
    blobs.push({ x: top.x + Math.cos(a) * d, y: top.y + crown * 0.35 + (r() - 0.3) * crown * 0.7, z: top.z + Math.sin(a) * d, r: crown * (0.45 + r() * 0.3) });
  }
  blobs.push({ x: top.x, y: top.y + crown * 0.5, z: top.z, r: crown * 0.75 });
  const cg = foliageCluster(blobs, { detail: 3, amp: 0.3, freq: 1.6 / crown * 2.4, seed, dark: '#243d17', mid: '#45692a', light: '#8fa64e' });
  const crownMesh = new THREE.Mesh(cg, crownMat());
  g.add(crownMesh);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildBackground(engine, layout) {
  const { scene } = engine;
  const group = new THREE.Group();
  group.name = 'fundo';

  // prédios (fora dos limites)
  const bdefs = [
    { x: -6, z: -17, w: 12, h: 13, d: 8, floors: 4, seed: 1, color: '#f3dcc0', ry: 0 },
    { x: 9, z: -20, w: 13, h: 16, d: 9, floors: 5, seed: 2, color: '#efd2b6', ry: -0.12 },
    { x: 19, z: -3, w: 9, h: 11, d: 12, floors: 3, seed: 3, color: '#f2e3cf', ry: -Math.PI / 2 + 0.1 },
    { x: -20, z: -6, w: 10, h: 12, d: 10, floors: 4, seed: 4, color: '#ecd6bd', ry: Math.PI / 2 - 0.15 },
  ];
  for (const b of bdefs) {
    const m = makeBuilding(b);
    m.position.set(b.x, 0, b.z);
    m.rotation.y = b.ry;
    m.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    group.add(m);
  }

  // árvores
  const tdefs = [
    { x: -10.2, z: 8.6, height: 6.0, crown: 1.9, seed: 3 },   // sombra longa e salpicada no sudoeste do gramado
    { x: -9.2, z: -2.0, height: 6.5, crown: 2.0, seed: 5 },
    { x: -7.6, z: -8.0, height: 7.0, crown: 2.2, seed: 7 },
    { x: 3.5, z: -9.5, height: 7.5, crown: 2.4, seed: 9 },
    { x: 10.4, z: -4.0, height: 6.5, crown: 2.0, seed: 11 },
    { x: 11.0, z: 2.0, height: 5.5, crown: 1.8, seed: 13 },
    { x: 10.0, z: 7.0, height: 5.0, crown: 1.7, seed: 15 },
    { x: -2.5, z: -10.5, height: 6.0, crown: 2.0, seed: 17 },
  ];
  for (const t of tdefs) {
    const tr = makeTree(t);
    tr.position.set(t.x, 0, t.z);
    group.add(tr);
  }
  // arbustos baixos entre muro e prédios (preenchem o vazio)
  const bushes = [];
  const r = rng(3);
  for (let i = 0; i < 18; i++) bushes.push({ x: 9 + r() * 3, y: 0.4, z: -6 + i * 0.8, r: 0.7 + r() * 0.4 });
  // arbustos logo atrás do muro leste: as copas aparecem acima do muro (1.2 m)
  for (let z = -4.6; z < 3.2; z += 0.55 + r() * 0.3) {
    const low = z > 1.2;
    bushes.push({ x: 8.0 + r() * 0.4, y: low ? 0.7 : 0.95 + r() * 0.2, z, r: low ? 0.55 : 0.65 + r() * 0.2, sy: 1.1 });
  }
  const bushMesh = new THREE.Mesh(foliageCluster(bushes, { detail: 2, amp: 0.25, freq: 2.2, seed: 2, dark: '#22401a', mid: '#3d6328', light: '#86a24c' }), crownMat());
  bushMesh.castShadow = true; bushMesh.receiveShadow = true;
  group.add(bushMesh);
  group.add(leafSkin(bushMesh.geometry, { count: 3500, size: 0.12, seed: 4, material: plantMat(), minNormalY: -0.2 }));

  scene.add(group);
  return { group };
}
