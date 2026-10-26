// PANDORÓPOLIS — os detalhes da cidade: árvores (verdes, ipês rosa, amarelo e roxo e a mangueira, com vento nas
// copas), os buxinhos das esquinas, os canteiros da casa e os vasos da praça, postes, carros e o ônibus, bancos,
// hidrantes, lixeiras e o chafariz (os jatos numa malha só, instanciada). Os lugares das fases moram em casa.js,
// condominio.js e chacara.js.
import * as THREE from 'three';
import { foliageCluster, rng, mat } from '../../../world/util.js';
import { lavender, boxwood, smallFlowers } from '../../../world/plants.js';
import { rb, cyl, slab, sphere } from './kit.js';
import { waterMat, flowerBush } from './pecas.js';

const CROWNS = {
  verde: { dark: '#3d5a24', mid: '#6b8f35', light: '#a2c056' },
  'ipe-rosa': { dark: '#a24479', mid: '#dc74ab', light: '#f8bcd9' },
  'ipe-amarelo': { dark: '#b2861c', mid: '#e8b62f', light: '#ffe58a' },
  'ipe-roxo': { dark: '#62428c', mid: '#9677c6', light: '#cdb9ef' },
  'casa-na-arvore': { dark: '#3d5a24', mid: '#6b8f35', light: '#a2c056' },
  mangueira: { dark: '#24411a', mid: '#3f6a26', light: '#7a9d3f' },
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
  const bw = boxwood(0.34, 3);
  for (const b of [...Object.values(L.BLOCKS), ...Object.values(L.TOWN_BLOCKS)]) {
    for (const [x, z] of [[b.minX + 0.45, b.minZ + 0.45], [b.maxX - 0.45, b.minZ + 0.45], [b.minX + 0.45, b.maxZ - 0.45], [b.maxX - 0.45, b.maxZ - 0.45]]) {
      kit.add(bw, { color: null, slot: 'foliage', x, y: 0.03, z, sx: 1.04, sy: 1.15, sz: 1.04 });
    }
  }
  // canteiros da casa e os vasos da praça
  const plants = {
    lav: lavender({ stems: 22, height: 0.4, seed: 2 }),
    ger: flowerBush({ r: 0.24, seed: 3, flower: '#ff6a55', n: 7 }),
    ger2: flowerBush({ r: 0.24, seed: 5, flower: '#ff8fc0', n: 7 }),
    flw: smallFlowers({ count: 26, radius: 0.26, color: '#fff6ee', seed: 4 }),
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

  // ---------- o que se mexe ----------
  /** Jatos do chafariz (bolinhas d'água que sobem e caem). */
  kit.add(cyl(F.r, F.r + 0.1, 0.55, 28), { color: '#d9cfc2', x: F.x, z: F.z });
  kit.add(cyl(0.3, 0.38, 1.2, 12), { color: '#d9cfc2', x: F.x, y: 0.55, z: F.z });
  kit.add(cyl(0.7, 0.4, 0.25, 18), { color: '#d9cfc2', x: F.x, y: 1.75, z: F.z });
  const fw = new THREE.Mesh(new THREE.CircleGeometry(F.r - 0.12, 28).rotateX(-Math.PI / 2), waterMat());
  fw.position.set(F.x, 0.57, F.z); // acima do tampo da bacia (0,55 m)
  root.add(fw);
  const jetMat = mat('mapa-jet', () => new THREE.MeshStandardMaterial({ color: '#cfeefc', roughness: 0.1, transparent: true, opacity: 0.85 }));
  const JETS = 10;
  const jets = new THREE.InstancedMesh(sphere(0.07, 8, 6), jetMat, JETS);
  jets.frustumCulled = false;
  root.add(jets);
  const m4 = new THREE.Matrix4();

  return {
    update(dt, t) {
      for (let i = 0; i < JETS; i++) {
        const a = (i / JETS) * Math.PI * 2, k = (t * 0.9 + i / JETS) % 1, r = 0.2 + k * 0.9;
        m4.makeTranslation(F.x + Math.cos(a) * r, 2.0 + Math.sin(k * Math.PI) * 0.75 - k * 0.6, F.z + Math.sin(a) * r);
        jets.setMatrixAt(i, m4);
      }
      jets.instanceMatrix.needsUpdate = true;
    },
  };
}
