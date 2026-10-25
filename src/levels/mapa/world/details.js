// PANDORÓPOLIS — os detalhes: árvores (verdes e ipês rosa, amarelo e roxo, com vento nas copas), cerca-viva,
// canteiros, postes, carros e o ônibus, bancos, hidrantes e lixeiras, a pracinha, o lago com a ilha da Dona Gansa,
// a área de serviço (varal, irrigador, canal, caixote, bolinha), o varal da casa com a meia listrada e a festa no
// quintal da chácara (mesa do bolo, bandeirolas, piscininha, casa na árvore, galinhas e porquinhos).
// O que se mexe (balões, jatos do chafariz, chuvinha, água do lago e do canal) volta em `update`.
import * as THREE from 'three';
import { foliageCluster, rng, mat, rippleNormalTexture } from '../../../world/util.js';
import { lavender, geranium, boxwood, lettuce, carrotTops, smallFlowers } from '../../../world/plants.js';
import { rb, cyl, slab, sphere } from './kit.js';

const CROWNS = {
  verde: { dark: '#3d5a24', mid: '#6b8f35', light: '#a2c056' },
  'ipe-rosa': { dark: '#a24479', mid: '#dc74ab', light: '#f8bcd9' },
  'ipe-amarelo': { dark: '#b2861c', mid: '#e8b62f', light: '#ffe58a' },
  'ipe-roxo': { dark: '#62428c', mid: '#9677c6', light: '#cdb9ef' },
  'casa-na-arvore': { dark: '#3d5a24', mid: '#6b8f35', light: '#a2c056' },
};
/** Copas geradas uma vez por tipo e variante (o ruído da folhagem custa: as árvores repetem com giro e escala). */
const crownCache = new Map();
function crown(kind, variant) {
  const key = `${kind}:${variant}`;
  if (crownCache.has(key)) return crownCache.get(key);
  const R = rng(17 + variant * 13 + kind.length);
  const blobs = [{ x: 0, y: 2.25, z: 0, r: 1.05 }];
  const n = 3 + Math.floor(R() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.6;
    blobs.push({ x: Math.cos(a) * 0.62, y: 1.95 + R() * 0.55, z: Math.sin(a) * 0.62, r: 0.62 + R() * 0.22 });
  }
  const g = foliageCluster(blobs, { detail: 2, amp: 0.2, freq: 2.0, seed: variant + 1, ...CROWNS[kind] });
  crownCache.set(key, g);
  return g;
}

/**
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../types').LevelLayout} L
 */
export function buildDetails(kit, root, L) {
  const R = rng(7);
  // ---------- árvores ----------
  L.TREES.forEach((t, i) => {
    const s = t.s ?? 1;
    kit.add(cyl(0.11 * s, 0.19 * s, 1.75 * s, 8), { color: '#7a4e2e', x: t.x, z: t.z });
    kit.add(crown(t.kind, i % 3), { color: null, slot: 'foliage', x: t.x, z: t.z, ry: R() * Math.PI * 2, sx: s, sy: s * (0.92 + R() * 0.16), sz: s });
  });
  // casa na árvore (a do quintal da fase 10)
  const th = L.TREES.find((t) => t.kind === 'casa-na-arvore');
  if (th) {
    kit.add(rb(1.6, 0.12, 1.6, 0.03, 1), { color: '#a87a52', x: th.x, y: 1.5, z: th.z + 0.2 });
    kit.add(rb(1.1, 0.8, 1.0, 0.05, 1), { color: '#d9a46b', x: th.x - 0.1, y: 1.62, z: th.z });
    kit.add(new THREE.ConeGeometry(0.9, 0.6, 4).rotateY(Math.PI / 4), { color: '#c2483a', x: th.x - 0.1, y: 2.72, z: th.z });
    for (const s of [-0.24, 0.24]) kit.add(rb(0.06, 1.62, 0.06, 0.015, 1), { color: '#8a5a3a', x: th.x + 0.9 + s, z: th.z + 0.71 });
    for (let k = 0; k < 5; k++) kit.add(rb(0.5, 0.05, 0.08, 0.015, 1), { color: '#a87a52', x: th.x + 0.9, y: 0.25 + k * 0.3, z: th.z + 0.72 });
  }
  // cerca-viva do jardim do lago e buxinhos nas esquinas
  const lb = L.BLOCKS.lago;
  for (let x = lb.minX + 0.9; x < lb.maxX - 0.4; x += 1.25) {
    kit.add(foliageCluster([{ x: 0, y: 0.42, z: 0, r: 0.62, sx: 1.25, sy: 0.85, sz: 0.8 }], { detail: 1, amp: 0.12, seed: x, dark: '#2f5a28', mid: '#4f8a3e', light: '#79b05a' }), { color: null, slot: 'foliage', x, z: lb.minZ + 0.6 });
  }
  const bw = boxwood(0.34, 3);
  for (const b of [...Object.values(L.BLOCKS), ...Object.values(L.TOWN_BLOCKS)]) {
    for (const [x, z] of [[b.minX + 0.45, b.minZ + 0.45], [b.maxX - 0.45, b.minZ + 0.45], [b.minX + 0.45, b.maxZ - 0.45], [b.maxX - 0.45, b.maxZ - 0.45]]) {
      kit.add(bw, { color: null, slot: 'foliage', x, y: 0.03, z, sx: 1.2, sy: 1.2, sz: 1.2 });
    }
  }
  // canteiros da casa e os vasos da praça
  const plants = {
    lav: lavender({ stems: 22, height: 0.4, seed: 2 }),
    ger: geranium({ radius: 0.24, seed: 3, flower: '#ff6a55' }),
    ger2: geranium({ radius: 0.24, seed: 5, flower: '#ff8fc0' }),
    flw: smallFlowers({ count: 26, radius: 0.32, color: '#fff6ee', seed: 4 }),
  };
  const Hs = L.HOUSE;
  const bd = Hs.bed;
  kit.add(rb(bd.maxX - bd.minX, 0.14, bd.maxZ - bd.minZ, 0.03, 1), { color: '#b9845a', x: (bd.minX + bd.maxX) / 2, z: (bd.minZ + bd.maxZ) / 2 });
  kit.add(slab(bd.maxX - bd.minX - 0.12, 0.02, bd.maxZ - bd.minZ - 0.12), { color: '#6f4a2c', slot: 'ground', x: (bd.minX + bd.maxX) / 2, y: 0.13, z: (bd.minZ + bd.maxZ) / 2 });
  for (let x = bd.minX + 0.35, i = 0; x < bd.maxX - 0.2; x += 0.7, i++) {
    kit.add(i % 2 ? plants.ger : plants.lav, { color: null, slot: 'plant', x, y: 0.14, z: (bd.minZ + bd.maxZ) / 2 });
  }
  for (const [x, z, k] of Hs.flowers) {
    kit.add(cyl(0.3, 0.3, 0.05, 16), { color: '#6f4a2c', slot: 'ground', x, z });
    kit.add(plants[k], { color: null, slot: 'plant', x, y: 0.04, z });
  }
  const F = L.TOWN.fountain;
  L.FOUNTAIN_BEDS.forEach(([x, z], i) => {
    kit.add(cyl(0.3, 0.24, 0.42, 14), { color: '#c9764f', x, z });
    kit.add(cyl(0.26, 0.26, 0.02, 14), { color: '#6f4a2c', x, y: 0.4, z });
    kit.add(i % 2 ? plants.ger : plants.ger2, { color: null, slot: 'plant', x, y: 0.41, z });
  });

  // ---------- postes ----------
  for (const [x, z] of L.LAMPS) {
    kit.add(cyl(0.05, 0.075, 2.7, 10), { color: '#3f5a4a', x, z });
    kit.add(rb(0.34, 0.08, 0.34, 0.02, 1), { color: '#3f5a4a', x, y: 2.7, z });
    kit.add(sphere(0.17, 12, 10), { color: '#fff1c2', slot: 'lit', x, y: 2.95, z });
    kit.add(new THREE.ConeGeometry(0.26, 0.2, 10), { color: '#3f5a4a', x, y: 3.18, z });
  }

  // ---------- carros e ônibus ----------
  /** Roda centrada (eixo em x local). */
  const wheel = (r, w, seg = 14) => new THREE.CylinderGeometry(r, r, w, seg).rotateZ(Math.PI / 2);
  const car = (x, z, yaw, color) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c });
    kit.add(rb(2.3, 0.6, 1.2, 0.2, 2), { color, x, y: 0.2, z, ry: yaw });
    kit.add(rb(1.3, 0.5, 1.04, 0.16, 2), { color, ...at(-0.15, 0), y: 0.76, ry: yaw });
    kit.add(rb(1.34, 0.36, 1.07, 0.12, 2), { color: '#9fd6ef', slot: 'glass', ...at(-0.15, 0), y: 0.82, ry: yaw });
    for (const [lx, lz] of [[0.72, 0.6], [-0.72, 0.6], [0.72, -0.6], [-0.72, -0.6]]) {
      kit.add(wheel(0.22, 0.16).rotateY(Math.PI / 2), { color: '#2b2b30', ...at(lx, lz), y: 0.22, ry: yaw });
      kit.add(wheel(0.1, 0.17, 10).rotateY(Math.PI / 2), { color: '#d9dde0', ...at(lx, lz), y: 0.22, ry: yaw });
    }
    for (const lz of [-0.4, 0.4]) kit.add(sphere(0.07, 8, 6), { color: '#fff6d0', slot: 'lit', ...at(1.16, lz), y: 0.55 });
    kit.add(rb(0.12, 0.14, 1.1, 0.04, 1), { color: '#c9ccd0', ...at(1.17, 0), y: 0.25, ry: yaw });
    kit.add(rb(0.12, 0.14, 1.1, 0.04, 1), { color: '#c9ccd0', ...at(-1.17, 0), y: 0.25, ry: yaw });
  };
  for (const c of L.CARS) car(c.x, c.z, c.yaw, c.color);
  const bus = L.TOWN.bus;
  kit.add(rb(bus.w, 1.75, bus.d, 0.22, 2), { color: '#f2b24c', x: bus.x, y: 0.25, z: bus.z });
  kit.add(rb(bus.w + 0.04, 0.55, bus.d - 0.7, 0.12, 2), { color: '#9fd6ef', slot: 'glass', x: bus.x, y: 1.05, z: bus.z + 0.1 });
  kit.add(rb(bus.w + 0.04, 0.16, bus.d + 0.02, 0.05, 1), { color: '#e07b39', x: bus.x, y: 0.62, z: bus.z });
  for (const dz of [-1.7, 1.6]) for (const dx of [-0.82, 0.82]) {
    kit.add(wheel(0.3, 0.18), { color: '#2b2b30', x: bus.x + dx, y: 0.3, z: bus.z + dz });
  }

  // ---------- bancos, hidrantes, lixeiras ----------
  const bench = (x, z, ry) => {
    kit.add(rb(1.4, 0.08, 0.42, 0.03, 1), { color: '#c98a55', x, y: 0.42, z, ry });
    kit.add(rb(1.4, 0.36, 0.08, 0.03, 1), { color: '#c98a55', x: x - Math.sin(ry) * 0.2, y: 0.55, z: z - Math.cos(ry) * 0.2, ry });
    for (const k of [-0.58, 0.58]) kit.add(rb(0.08, 0.42, 0.38, 0.02, 1), { color: '#3f5a4a', x: x + Math.cos(ry) * k, z: z - Math.sin(ry) * k, ry });
  };
  for (const b of L.BENCHES) bench(b.x, b.z, b.yaw);
  for (const [x, z] of L.HYDRANTS) {
    kit.add(cyl(0.16, 0.18, 0.62, 12), { color: '#d93a3a', x, z });
    kit.add(sphere(0.17, 12, 8), { color: '#d93a3a', x, y: 0.64, z });
    kit.add(wheel(0.07, 0.48, 8), { color: '#b82e2e', x, y: 0.42, z });
  }
  for (const [x, z] of L.BINS) {
    kit.add(cyl(0.24, 0.2, 0.75, 12), { color: '#5e9a4a', x, z });
    kit.add(cyl(0.27, 0.27, 0.06, 12), { color: '#3f7a35', x, y: 0.75, z });
  }

  // ---------- pracinha ----------
  const P = L.PLAYGROUND;
  const sl = P.slide;
  kit.add(rb(1.0, 1.7, 1.0, 0.06, 1), { color: '#6ec3e8', x: sl.x, z: sl.z });
  kit.add(rb(1.2, 0.12, 1.2, 0.04, 1), { color: '#e8577a', x: sl.x, y: 1.7, z: sl.z });
  kit.add(new THREE.ConeGeometry(0.85, 0.7, 4).rotateY(Math.PI / 4), { color: '#ffd15c', x: sl.x, y: 2.75, z: sl.z });
  for (const s of [-0.45, 0.45]) kit.add(cyl(0.04, 0.04, 1.3, 6), { color: '#fffaf0', x: sl.x + s, y: 1.82, z: sl.z });
  const chute = new THREE.CylinderGeometry(0.42, 0.42, 2.4, 14, 1, true, Math.PI / 2, Math.PI);
  chute.rotateX(Math.PI / 2 - 0.62);
  kit.add(chute, { color: '#e8577a', x: sl.x, y: 0.95, z: sl.z + 1.4 });
  kit.add(cyl(0.3, 0.3, 0.04, 18), { color: '#f28ca2', x: sl.x, y: 1.84, z: sl.z });
  for (let k = 0; k < 5; k++) kit.add(rb(0.7, 0.05, 0.1, 0.015, 1), { color: '#fffaf0', x: sl.x, y: 0.3 + k * 0.32, z: sl.z - 0.6 - k * 0.04, rx: -0.2 });
  const sw = P.swing;
  for (const s of [-1, 1]) {
    for (const t of [-0.35, 0.35]) kit.add(cyl(0.05, 0.05, 2.3, 8), { color: '#8e5a33', x: sw.x + s * 1.0, z: sw.z + t, rx: t * 0.5 });
  }
  kit.add(cyl(0.05, 0.05, 2.1, 8).rotateZ(Math.PI / 2), { color: '#8e5a33', x: sw.x, y: 2.18, z: sw.z });
  for (const k of [-0.45, 0.45]) {
    for (const t of [-0.18, 0.18]) kit.add(cyl(0.01, 0.01, 1.7, 4), { color: '#4a3426', x: sw.x + k + t, y: 0.48, z: sw.z });
    kit.add(rb(0.44, 0.05, 0.22, 0.02, 1), { color: k < 0 ? '#ffd15c' : '#6ec3e8', x: sw.x + k, y: 0.46, z: sw.z });
  }
  const tw = P.towel;
  kit.add(slab(1.6, 0.012, 1.2), { color: (p) => new THREE.Color((Math.floor((p.x + 5) / 0.2) + Math.floor((p.z + 5) / 0.2)) % 2 ? '#e8577a' : '#fffaf0'), slot: 'ground', x: tw.x, y: 0.022, z: tw.z });
  kit.add(cyl(0.2, 0.2, 0.04, 16), { color: '#f28ca2', x: sl.x + 0.2, y: 1.86, z: sl.z - 0.1 });
  kit.add(cyl(0.12, 0.1, 0.18, 10), { color: '#6ec3e8', x: P.bucket.x, y: 0.02, z: P.bucket.z });
  kit.add(rb(0.05, 0.28, 0.1, 0.02, 1), { color: '#ffd15c', x: P.bucket.x + 0.25, y: 0.02, z: P.bucket.z + 0.1, rz: 0.5 });

  // ---------- lago (fase 3) ----------
  const Lk = L.LAKE;
  const lakeMat = mat('mapa-lake', () => {
    const n = rippleNormalTexture().clone();
    n.repeat.set(5, 5);
    return new THREE.MeshStandardMaterial({ color: '#4fa6d8', roughness: 0.14, metalness: 0.05, normalMap: n, normalScale: new THREE.Vector2(0.3, 0.3) });
  });
  const lake = new THREE.Mesh(new THREE.CircleGeometry(Lk.r, 40).rotateX(-Math.PI / 2), lakeMat);
  lake.position.set(Lk.x, 0.02, Lk.z);
  lake.receiveShadow = true;
  root.add(lake);
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + R() * 0.05;
    kit.add(new THREE.IcosahedronGeometry(1, 0), { color: i % 3 ? '#b7afa6' : '#a39a90', x: Lk.x + Math.cos(a) * (Lk.r + 0.12), y: 0.02, z: Lk.z + Math.sin(a) * (Lk.r + 0.12), sx: 0.32, sy: 0.18, sz: 0.28, ry: a });
  }
  const I = Lk.island;
  kit.add(sphere(I.r, 20, 10), { color: '#8cc65a', x: I.x, y: -0.55, z: I.z, sy: 0.45 });
  kit.add(boxwood(0.4, 9), { color: null, slot: 'foliage', x: I.x - 0.5, y: 0.08, z: I.z - 0.5 });
  // Dona Gansa e a pantufa
  kit.add(sphere(0.32, 14, 10), { color: '#fffdf8', x: I.x + 0.2, y: 0.42, z: I.z + 0.2, sx: 1.3, sz: 0.9 });
  kit.add(cyl(0.07, 0.09, 0.42, 8), { color: '#fffdf8', x: I.x + 0.55, y: 0.5, z: I.z + 0.2, rz: -0.3 });
  kit.add(sphere(0.13, 12, 8), { color: '#fffdf8', x: I.x + 0.66, y: 0.95, z: I.z + 0.2 });
  kit.add(new THREE.ConeGeometry(0.06, 0.18, 8).rotateZ(-Math.PI / 2), { color: '#f08a3c', x: I.x + 0.84, y: 0.93, z: I.z + 0.2 });
  kit.add(rb(0.34, 0.1, 0.16, 0.05, 2), { color: '#f5a9c4', x: I.x - 0.3, y: 0.28, z: I.z + 0.6, ry: 0.5 });
  const pk = Lk.plank;
  for (let x = pk.x0; x < pk.x1; x += 0.3) kit.add(rb(0.26, 0.08, pk.w, 0.02, 1), { color: x % 0.6 < 0.3 ? '#c98a55' : '#b77a48', x: x + 0.13, y: 0.12, z: pk.z });
  for (const x of [pk.x0 + 0.4, pk.x1 - 0.2]) for (const s of [-1, 1]) kit.add(cyl(0.05, 0.05, 0.6, 8), { color: '#8e5a33', x, y: 0.0, z: pk.z + s * pk.w / 2 });
  for (const [dx, dz] of [[-2.8, 2.6], [2.6, -2.9], [-3.6, -1.4], [1.4, 3.3]]) {
    kit.add(new THREE.CircleGeometry(0.32, 12, 0.3, Math.PI * 1.8).rotateX(-Math.PI / 2), { color: '#5e9a4a', slot: 'ground', x: Lk.x + dx, y: 0.03, z: Lk.z + dz });
  }
  for (const [x, z] of L.GARDEN_LAMPS) {
    kit.add(cyl(0.05, 0.06, 1.5, 8), { color: '#3f5a4a', x, z });
    kit.add(sphere(0.2, 12, 10), { color: '#ffd77a', slot: 'lit', x, y: 1.65, z });
  }

  // ---------- área de serviço (fase 2) ----------
  const Sv = L.SERVICE;
  const line = (ln, cols) => {
    for (const x of [ln.x0, ln.x1]) kit.add(cyl(0.06, 0.07, 2.1, 8), { color: '#8e5a33', x, z: ln.z });
    kit.add(cyl(0.012, 0.012, ln.x1 - ln.x0, 4).rotateZ(Math.PI / 2), { color: '#4a3426', x: (ln.x0 + ln.x1) / 2, y: 2.0, z: ln.z });
    const n = cols.length;
    cols.forEach((c, i) => {
      const x = ln.x0 + ((i + 0.5) / n) * (ln.x1 - ln.x0);
      kit.add(rb(0.62, 0.72, 0.04, 0.02, 1), { color: c, x, y: 1.28, z: ln.z, rz: (R() - 0.5) * 0.12 });
      kit.add(rb(0.05, 0.08, 0.06, 0.01, 1), { color: '#d9dde0', x: x - 0.2, y: 1.98, z: ln.z });
    });
  };
  line(Sv.line, ['#6ec3e8', '#fffaf0', '#ffd15c', '#f28ca2', '#7fa36b', '#fffaf0', '#b39ddb']);
  const sp = Sv.sprinkler;
  kit.add(cyl(0.14, 0.18, 0.22, 12), { color: '#2f6fb8', x: sp.x, z: sp.z });
  kit.add(cyl(0.04, 0.04, 0.3, 8), { color: '#d9dde0', x: sp.x, y: 0.22, z: sp.z });
  const cn = Sv.canal;
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(cn.maxX - cn.minX - 0.3, cn.maxZ - cn.minZ - 0.3).rotateX(-Math.PI / 2), lakeMat);
  canal.position.set((cn.minX + cn.maxX) / 2, 0.025, (cn.minZ + cn.maxZ) / 2);
  canal.receiveShadow = true;
  root.add(canal);
  for (const z of [cn.minZ + 0.07, cn.maxZ - 0.07]) kit.add(rb(cn.maxX - cn.minX, 0.12, 0.16, 0.03, 1), { color: '#b7afa6', x: (cn.minX + cn.maxX) / 2, z });
  const cr = Sv.crate;
  kit.add(rb(cr.s, cr.s * 0.8, cr.s, 0.04, 1), { color: '#c98a55', x: cr.x, z: cr.z });
  for (const y of [0.18, 0.42, 0.66]) kit.add(rb(cr.s + 0.02, 0.05, cr.s + 0.02, 0.015, 1), { color: '#a8703f', x: cr.x, y: y * cr.s, z: cr.z });
  kit.add(sphere(0.2, 14, 10), { color: '#d8f065', x: Sv.ball.x, y: 0.2, z: Sv.ball.z });
  const bk = Sv.basket;
  kit.add(rb(bk.w, 0.4, bk.d, 0.12, 2), { color: '#fffaf0', x: bk.x, z: bk.z });
  kit.add(rb(bk.w * 0.8, 0.14, bk.d * 0.7, 0.06, 2), { color: '#6ec3e8', x: bk.x, y: 0.34, z: bk.z });

  // ---------- jardim da casa: varal com a meia listrada, a cenoura de brinquedo ----------
  const hl = L.HOUSE.line;
  line(hl, ['#fffaf0', '#e8577a', '#6ec3e8']);
  for (let k = 0; k < 5; k++) kit.add(rb(0.14, 0.09, 0.08, 0.02, 1), { color: k % 2 ? '#e8577a' : '#fffaf0', x: hl.x1 - 0.42, y: 1.6 - k * 0.09, z: hl.z + 0.06 });
  kit.add(rb(0.24, 0.12, 0.08, 0.04, 1), { color: '#e8577a', x: hl.x1 - 0.32, y: 1.1, z: hl.z + 0.06 });
  const cr0 = Hs.carrot;
  kit.add(new THREE.ConeGeometry(0.11, 0.42, 10).rotateZ(Math.PI / 2 + 0.2), { color: '#f08a3c', x: cr0.x - 0.1, y: 0.12, z: cr0.z, ry: 0.4 });
  kit.add(carrotTops({ height: 0.18, seed: 3 }), { color: null, slot: 'plant', x: cr0.x + 0.15, y: 0.1, z: cr0.z - 0.1, rz: -1.2 });
  // caminho de pedrinhas do portão até a porta
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    kit.add(cyl(0.34, 0.36, 0.05, 9), { color: '#e3d9c9', x: -21 + (L.HOUSE.door.x + 21) * t + (k % 2 ? 0.12 : -0.12), y: 0.006, z: 21.1 - t * 8.6 });
  }

  // ---------- chácara: horta, galinhas, porquinhos, festa ----------
  const Gp = L.GRANDPA;
  const let1 = lettuce({ r: 0.18, seed: 4 });
  const ct = carrotTops({ seed: 6 });
  for (let x = Gp.garden.minX + 0.5; x < Gp.garden.maxX - 0.3; x += 0.95) {
    for (let z = Gp.garden.minZ + 0.6; z < Gp.garden.maxZ - 0.3; z += 1.05) kit.add((Math.round(x * 4) + Math.round(z)) % 2 ? let1 : ct, { color: null, slot: 'plant', x, y: 0.02, z });
  }
  const pig = (x, z, ry) => {
    kit.add(sphere(0.34, 14, 10), { color: '#f5a9b8', x, y: 0.36, z, sx: 1.35, sz: 0.95, ry });
    kit.add(sphere(0.22, 12, 10), { color: '#f5a9b8', x: x + Math.cos(ry) * 0.46, y: 0.48, z: z - Math.sin(ry) * 0.46 });
    kit.add(cyl(0.09, 0.09, 0.08, 10).rotateZ(Math.PI / 2), { color: '#f08aa0', x: x + Math.cos(ry) * 0.68, y: 0.46, z: z - Math.sin(ry) * 0.68, ry });
    for (const s of [-1, 1]) kit.add(new THREE.ConeGeometry(0.07, 0.14, 6), { color: '#f08aa0', x: x + Math.cos(ry) * 0.42 + Math.sin(ry) * s * 0.12, y: 0.7, z: z - Math.sin(ry) * 0.42 + Math.cos(ry) * s * 0.12 });
    for (const [a, b] of [[0.25, 0.18], [0.25, -0.18], [-0.25, 0.18], [-0.25, -0.18]]) kit.add(cyl(0.06, 0.06, 0.2, 6), { color: '#f08aa0', x: x + Math.cos(ry) * a + Math.sin(ry) * b, z: z - Math.sin(ry) * a + Math.cos(ry) * b });
  };
  const St = Gp.sty;
  pig(St.minX + 2.0, St.minZ + 2.2, 0.4);
  pig(St.minX + 3.8, St.minZ + 3.6, 2.6);
  pig(St.minX + 4.6, St.minZ + 1.6, -1.2);
  const hen = (x, z, ry) => {
    kit.add(sphere(0.2, 12, 10), { color: '#fffaf0', x, y: 0.26, z, sx: 1.25, ry });
    kit.add(sphere(0.12, 10, 8), { color: '#fffaf0', x: x + Math.cos(ry) * 0.2, y: 0.46, z: z - Math.sin(ry) * 0.2 });
    kit.add(rb(0.06, 0.08, 0.1, 0.02, 1), { color: '#e8577a', x: x + Math.cos(ry) * 0.21, y: 0.55, z: z - Math.sin(ry) * 0.21, ry });
    kit.add(new THREE.ConeGeometry(0.04, 0.09, 6).rotateZ(-Math.PI / 2), { color: '#f2b24c', x: x + Math.cos(ry) * 0.33, y: 0.45, z: z - Math.sin(ry) * 0.33, ry });
  };
  for (const [x, z, ry] of Gp.hens) hen(x, z, ry);
  // festa: mesa, bolo de três andares com a vela do 3, bandeirolas, piscininha
  const Tb = Gp.table;
  kit.add(rb(Tb.w, 0.08, Tb.d, 0.03, 1), { color: '#fffaf0', x: Tb.x, y: 0.72, z: Tb.z });
  kit.add(rb(Tb.w + 0.05, 0.42, Tb.d + 0.05, 0.03, 1), { color: (p) => new THREE.Color(Math.floor((p.x + 9) / 0.22) % 2 ? '#f7c3d0' : '#fffaf0'), x: Tb.x, y: 0.36, z: Tb.z });
  for (const [dx, dz] of [[-0.95, -0.5], [0.95, -0.5], [-0.95, 0.5], [0.95, 0.5]]) kit.add(cyl(0.04, 0.04, 0.72, 6), { color: '#c98a55', x: Tb.x + dx, z: Tb.z + dz });
  /** @type {[number, number, string][]} */ ([[0.42, 0.26, '#f7c3d0'], [0.31, 0.24, '#fff0d6'], [0.2, 0.22, '#f7c3d0']]).reduce((y, [r, h, c]) => {
    kit.add(cyl(r, r, h, 20), { color: c, x: Tb.x, y, z: Tb.z });
    return y + h;
  }, 0.8);
  kit.add(cyl(0.03, 0.03, 0.18, 6), { color: '#6ec3e8', x: Tb.x, y: 1.52, z: Tb.z });
  kit.add(sphere(0.04, 8, 6), { color: '#ffd77a', slot: 'lit', x: Tb.x, y: 1.74, z: Tb.z });
  const bt = Gp.bunting;
  for (const x of [bt.x0, bt.x1]) kit.add(cyl(0.05, 0.06, 2.4, 8), { color: '#8e5a33', x, z: bt.z });
  const flagCols = ['#e8577a', '#ffd15c', '#6ec3e8', '#7fd36b'];
  const nB = 14;
  for (let i = 0; i < nB; i++) {
    const t = (i + 0.5) / nB;
    const x = bt.x0 + (bt.x1 - bt.x0) * t;
    const y = 2.3 - Math.sin(t * Math.PI) * 0.45;
    kit.add(new THREE.ConeGeometry(0.16, 0.3, 3).rotateX(Math.PI), { color: flagCols[i % 4], x, y: y - 0.15, z: bt.z, sz: 0.25 });
  }
  const Pl = Gp.pool;
  kit.add(new THREE.TorusGeometry(Pl.r, 0.2, 10, 28).rotateX(Math.PI / 2), { color: '#6ec3e8', x: Pl.x, y: 0.2, z: Pl.z });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(Pl.r - 0.05, 28).rotateX(-Math.PI / 2), lakeMat);
  pool.position.set(Pl.x, 0.3, Pl.z);
  root.add(pool);
  const gf = Gp.gift;
  kit.add(rb(gf.s, gf.s * 0.6, gf.s, 0.06, 1), { color: '#6ec3e8', x: gf.x, z: gf.z, ry: 0.3 });
  kit.add(rb(gf.s + 0.02, gf.s * 0.62, 0.14, 0.02, 1), { color: '#e8577a', x: gf.x, z: gf.z, ry: 0.3 });
  kit.add(rb(0.14, gf.s * 0.62, gf.s + 0.02, 0.02, 1), { color: '#e8577a', x: gf.x, z: gf.z, ry: 0.3 });
  for (const s of [-1, 1]) kit.add(sphere(0.14, 10, 8), { color: '#e8577a', x: gf.x + s * 0.12, y: gf.s * 0.66, z: gf.z, sx: 1.4, sy: 0.7 });
  // cerquinha de madeira da chácara (fundo e leste)
  for (let x = L.FARM.minX + 1; x < L.FARM.maxX - 0.5; x += 1.6) {
    kit.add(rb(0.12, 0.8, 0.12, 0.02, 1), { color: '#8a5a3a', x, z: L.FARM.maxZ - 0.7 });
  }
  kit.add(rb(L.FARM.maxX - L.FARM.minX - 1.4, 0.1, 0.06, 0.02, 1), { color: '#a87a52', x: (L.FARM.minX + L.FARM.maxX) / 2, y: 0.55, z: L.FARM.maxZ - 0.7 });

  // ---------- o que se mexe ----------
  /** Balões da festa. */
  const balloonMat = mat('mapa-balloon', () => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 }));
  const balloons = [];
  [['#e8577a', -0.8, -0.5], ['#ffd15c', -0.4, -0.7], ['#6ec3e8', 0.6, -0.6], ['#7fd36b', 0.9, -0.3]].forEach(([c, dx, dz], i) => {
    const m = new THREE.Mesh(sphere(0.28, 14, 12), balloonMat.clone());
    m.material.color.set(/** @type {string} */ (c));
    m.scale.set(1, 1.18, 1);
    m.position.set(Tb.x + dx, 2.4, Tb.z + dz);
    m.castShadow = true;
    m.userData.y0 = 2.3 + i * 0.12;
    root.add(m);
    balloons.push(m);
    kit.add(cyl(0.006, 0.006, 1.5, 3), { color: '#4a3426', x: Tb.x + dx, y: 0.8, z: Tb.z + dz });
  });
  /** Jatos do chafariz (bolinhas d'água que sobem e caem). */
  kit.add(cyl(F.r, F.r + 0.1, 0.55, 28), { color: '#d9cfc2', x: F.x, z: F.z });
  kit.add(cyl(0.3, 0.38, 1.2, 12), { color: '#d9cfc2', x: F.x, y: 0.55, z: F.z });
  kit.add(cyl(0.7, 0.4, 0.25, 18), { color: '#d9cfc2', x: F.x, y: 1.75, z: F.z });
  const fw = new THREE.Mesh(new THREE.CircleGeometry(F.r - 0.12, 28).rotateX(-Math.PI / 2), lakeMat);
  fw.position.set(F.x, 0.57, F.z); // acima do tampo da bacia (0,55 m)
  root.add(fw);
  const jetMat = mat('mapa-jet', () => new THREE.MeshStandardMaterial({ color: '#cfeefc', roughness: 0.1, transparent: true, opacity: 0.85 }));
  const jets = Array.from({ length: 10 }, (_, i) => {
    const m = new THREE.Mesh(sphere(0.07, 8, 6), jetMat);
    m.userData.a = (i / 10) * Math.PI * 2;
    m.userData.ph = i / 10;
    root.add(m);
    return m;
  });
  /** Chuvinha em cima da casa das dogs (fase 5) e da casa do vovô (fase 9). */
  const rainMat = mat('mapa-rain', () => new THREE.MeshStandardMaterial({ color: '#8ec9ea', roughness: 0.3, transparent: true, opacity: 0.7 }));
  const rainy = [];
  for (const [x, z, y] of [[L.HOUSE.x + 1.2, L.HOUSE.z + 0.4, 7.4], [Gp.house.x - 0.5, Gp.house.z, 6.8]]) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const puff = foliageCluster([{ x: 0, y: 0, z: 0, r: 1.0, sy: 0.6 }, { x: 0.9, y: -0.1, z: 0.2, r: 0.75, sy: 0.6 }, { x: -0.9, y: -0.05, z: -0.1, r: 0.8, sy: 0.6 }, { x: 0.1, y: 0.25, z: -0.5, r: 0.7, sy: 0.6 }], { detail: 2, amp: 0.12, dark: '#a9b4c0', mid: '#c9d2dc', light: '#eef2f6', sunBias: 0.3 });
    const cm = new THREE.Mesh(puff, mat('mapa-raincloud-vc', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
    cm.castShadow = true;
    g.add(cm);
    const drops = [];
    const dropGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.36, 4);
    for (let i = 0; i < 18; i++) {
      const d = new THREE.Mesh(dropGeo, rainMat);
      d.position.set((R() - 0.5) * 2.6, -0.5 - R() * 3.5, (R() - 0.5) * 1.6);
      g.add(d);
      drops.push(d);
    }
    root.add(g);
    rainy.push({ g, drops, y0: y });
  }

  return {
    update(dt, t) {
      for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(t * 1.5 + b.position.x * 2) * 0.12;
      for (const j of jets) {
        const k = (t * 0.9 + j.userData.ph) % 1;
        const r = 0.2 + k * 0.9;
        j.position.set(F.x + Math.cos(j.userData.a) * r, 2.0 + Math.sin(k * Math.PI) * 0.75 - k * 0.6, F.z + Math.sin(j.userData.a) * r);
      }
      for (const r of rainy) {
        r.g.position.x += Math.sin(t * 0.3) * 0.002;
        for (const d of r.drops) {
          d.position.y -= dt * 6;
          if (d.position.y < -r.y0 + 2.6) d.position.y = -0.5;
        }
      }
    },
  };
}
