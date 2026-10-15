// Plantas estilizadas (geometrias com vertex color): lavanda, gerânios, buxinho, alface, ramas de cenoura, suculentas.
import * as THREE from 'three';
import { rng, paint, mergeGeometries, foliageCluster, addFoliageWind, mat, vnoise3 } from './util.js';

export const plantMat = () => mat('plant', () => addFoliageWind(new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.78, side: THREE.DoubleSide,
}), { amp: 0.018, freq: 1.6 }));
export const hedgeMat = () => mat('hedge', () => addFoliageWind(new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.9,
}), { amp: 0.006, freq: 1.1 }));
export const crownMat = () => mat('crown', () => addFoliageWind(new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.85,
}), { amp: 0.035, freq: 0.9 }));

function prep(g) {
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
export function merge(list) { return mergeGeometries(list.map(prep)); }

// Lâmina/folha afunilada e curvada (para ramas, lavanda, gramíneas)
function blade(h, w, lean, dirA, color, segs = 4, tipColor) {
  const pos = [], col = [], idx = [];
  const c0 = new THREE.Color(color), c1 = new THREE.Color(tipColor || color);
  const fx = Math.cos(dirA + Math.PI / 2), fz = Math.sin(dirA + Math.PI / 2);
  for (let s = 0; s <= segs; s++) {
    const t = s / segs, b = lean * t * t;
    const cx = Math.cos(dirA) * b, cz = Math.sin(dirA) * b, y = h * t * (1 - lean * 0.25 * t);
    const ww = w * (1 - t * 0.9) * (t < 0.15 ? 0.6 + t * 2.6 : 1);
    pos.push(cx - fx * ww, y, cz - fz * ww, cx + fx * ww, y, cz + fz * ww);
    const c = c0.clone().lerp(c1, t);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  for (let s = 0; s < segs; s++) { const i = s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function lavender({ stems = 34, height = 0.42, spread = 0.13, seed = 1 } = {}) {
  const r = rng(seed);
  const parts = [];
  // base de folhas cinza-esverdeadas
  // folhinhas estreitas cinza-esverdeadas na base (em vez de um volume sólido)
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const lf = blade(0.07 + r() * 0.05, 0.006, 0.05 + r() * 0.05, a, '#3f4d33', 3, '#7d8f66');
    lf.translate(Math.cos(a) * spread * 0.15, 0.0, Math.sin(a) * spread * 0.15);
    parts.push(lf);
  }
  for (let i = 0; i < stems; i++) {
    const a = r() * Math.PI * 2, rr = r() * spread * 0.6;
    const h = height * (0.7 + r() * 0.35), lean = 0.08 + r() * 0.12;
    const st = blade(h, 0.004, lean, a, '#5f7346', 3);
    st.translate(Math.cos(a) * rr, 0.03, Math.sin(a) * rr);
    parts.push(st);
    // espiga de flores
    const tx = Math.cos(a) * (rr + lean * 0.95), tz = Math.sin(a) * (rr + lean * 0.95), ty = 0.03 + h * (1 - lean * 0.25);
    const spike = new THREE.CapsuleGeometry(0.012, 0.075, 3, 6);
    spike.translate(0, 0.03, 0);
    spike.rotateZ(-Math.cos(a) * lean * 1.6); spike.rotateX(Math.sin(a) * lean * 1.6);
    spike.translate(tx, ty, tz);
    const lc = new THREE.Color().setHSL(0.74 + (r() - 0.5) * 0.03, 0.42 + r() * 0.15, 0.55 + r() * 0.1);
    paint(spike, (p) => lc.clone().multiplyScalar(0.8 + 0.3 * vnoise3(p.x * 80, p.y * 80, p.z * 80)));
    parts.push(spike);
  }
  return merge(parts);
}

export function geranium({ radius = 0.2, height = 0.2, seed = 2, flower = '#ff6a55', clusters = 5 } = {}) {
  const r = rng(seed);
  const blobs = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    blobs.push({ x: Math.cos(a) * radius * 0.45, y: height * 0.45, z: Math.sin(a) * radius * 0.45, r: radius * 0.55, sy: 0.7 });
  }
  blobs.push({ x: 0, y: height * 0.6, z: 0, r: radius * 0.6, sy: 0.75 });
  const parts = [foliageCluster(blobs, { detail: 2, amp: 0.3, freq: 10, seed, dark: '#2f4d1f', mid: '#4f7a2e', light: '#86a94a' })];
  const fc = new THREE.Color(flower);
  for (let k = 0; k < clusters; k++) {
    const a = r() * Math.PI * 2, rr = r() * radius * 0.6;
    const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr, cy = height * 0.95 + r() * 0.06;
    for (let j = 0; j < 9; j++) {
      const b = new THREE.IcosahedronGeometry(0.018 + r() * 0.008, 0);
      const u = r() * Math.PI * 2, v = r() * 0.8;
      b.translate(cx + Math.cos(u) * v * 0.035, cy + r() * 0.02, cz + Math.sin(u) * v * 0.035);
      const c = fc.clone().offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.1);
      paint(b, c);
      parts.push(b);
    }
  }
  return merge(parts);
}

export function boxwood(r = 0.26, seed = 3) {
  return foliageCluster([{ x: 0, y: 0, z: 0, r, sy: 0.95 }, { x: 0.05, y: 0.06, z: -0.03, r: r * 0.8 }], {
    detail: 3, amp: 0.12, freq: 7, seed, dark: '#253f1a', mid: '#3f6427', light: '#7a9d45',
  });
}

export function lettuce({ r = 0.12, seed = 4 } = {}) {
  const rr = rng(seed);
  const parts = [];
  const leaves = 11;
  for (let i = 0; i < leaves; i++) {
    const layer = i / leaves;
    const a = i * 2.4;
    const g = new THREE.SphereGeometry(r * (0.75 - layer * 0.35), 10, 6, 0, Math.PI * 0.9, 0, Math.PI * 0.42);
    g.rotateY(a);
    g.rotateX((rr() - 0.5) * 0.3);
    g.scale(1, 0.9 + layer * 0.5, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const f = Math.sin(Math.atan2(z, x) * 9) * 0.008;
      p.setXYZ(k, x + x * f * 8, y * 0.8 + f, z + z * f * 8);
    }
    g.computeVertexNormals();
    const c = new THREE.Color('#9fca5a').lerp(new THREE.Color('#5e8f2f'), 1 - layer).offsetHSL(0, 0, (rr() - 0.5) * 0.05);
    paint(g, (pp) => c.clone().multiplyScalar(0.75 + Math.min(0.4, pp.y * 3)));
    parts.push(g);
  }
  return merge(parts);
}

export function carrotTops({ seed = 5, fronds = 7, height = 0.24 } = {}) {
  const r = rng(seed);
  const parts = [];
  // ombro laranja aparecendo na terra
  const sh = new THREE.SphereGeometry(0.028, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  sh.scale(1, 0.7, 1);
  paint(sh, '#f07a22');
  parts.push(sh);
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + r() * 0.5;
    const h = height * (0.7 + r() * 0.4), lean = 0.06 + r() * 0.08;
    const st = blade(h, 0.004, lean, a, '#5d8a2a', 4, '#7fb03a');
    parts.push(st);
    // folíolos rendados ao longo da haste
    for (let k = 2; k <= 6; k++) {
      const t = k / 7;
      const px = Math.cos(a) * lean * t * t, py = h * t * (1 - lean * 0.25 * t), pz = Math.sin(a) * lean * t * t;
      for (const s of [-1, 1]) {
        const lf = blade(0.045 * (1.1 - t * 0.6), 0.008, 0.02, a + s * 1.2, '#6c9c30', 2, '#9cc84d');
        lf.rotateZ(s * 0.5);
        lf.translate(px, py, pz);
        parts.push(lf);
      }
    }
  }
  return merge(parts);
}

export function succulent({ r = 0.06, seed = 6, color = '#8fb3a0' } = {}) {
  const rr = rng(seed);
  const parts = [];
  for (let i = 0; i < 14; i++) {
    const layer = i / 14;
    const a = i * 2.39996;
    const g = new THREE.SphereGeometry(r * 0.35, 8, 6);
    g.scale(0.6, 0.35, 1.4);
    g.translate(0, 0, r * 0.45 * (1 - layer * 0.7));
    g.rotateX(-0.3 - layer * 0.9);
    g.rotateY(a);
    g.translate(0, layer * r * 0.3, 0);
    const c = new THREE.Color(color).offsetHSL(0, 0, layer * 0.08 - 0.04 + (rr() - 0.5) * 0.03);
    paint(g, c);
    parts.push(g);
  }
  return merge(parts);
}

export function smallFlowers({ count = 30, radius = 0.15, height = 0.12, color = '#fff6ee', seed = 7, leaf = true } = {}) {
  const r = rng(seed);
  const parts = [];
  if (leaf) parts.push(foliageCluster([{ x: 0, y: height * 0.4, z: 0, r: radius, sy: 0.6 }], { detail: 2, amp: 0.3, freq: 12, seed, dark: '#2f4a1d', mid: '#557b2f', light: '#8aac4c' }));
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * radius * 0.85;
    const b = new THREE.IcosahedronGeometry(0.012 + r() * 0.006, 0);
    b.scale(1, 0.6, 1);
    b.translate(Math.cos(a) * rr, height * (0.55 + 0.45 * (1 - rr / radius)) + r() * 0.02, Math.sin(a) * rr);
    paint(b, new THREE.Color(color).offsetHSL(0, 0, (r() - 0.5) * 0.08));
    parts.push(b);
  }
  return merge(parts);
}
