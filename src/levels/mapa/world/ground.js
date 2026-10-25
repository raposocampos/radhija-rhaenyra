// PANDORÓPOLIS — o chão: os dois platôs da maquete (grama com textura, barranco de terra e pedra), o mar com
// ondinhas, as ruas (asfalto, faixas que param nos cruzamentos, faixas de pedestre), calçadas em volta dos
// quarteirões, vagas, pisos (área de serviço, praça, frente da torre), areia da pracinha, jardim da casa e a estrada
// de terra da chácara. Alturas em camadas (grama 0, asfalto 0,012, faixas 0,016, calçada 0,03): nada no mesmo plano.
import * as THREE from 'three';
import { rippleNormalTexture, vnoise2, fbm2, mat } from '../../../world/util.js';
import { rb, slab, grassTexture } from './kit.js';

const Y = { road: 0.012, mark: 0.0165, walk: 0.03, pave: 0.022, lawn: 0.007, sand: 0.02, dirt: 0.011 };

/** Cor com ruído suave (posição do mundo = local + deslocamento). */
const noisy = (hex, amp = 0.06, freq = 0.35, ox = 0, oz = 0) => {
  const base = new THREE.Color(hex);
  const c = new THREE.Color();
  return (p) => {
    const n = (vnoise2((p.x + ox) * freq, (p.z + oz) * freq) - 0.5) * 2 * amp;
    return c.copy(base).offsetHSL(0, 0, n);
  };
};

/** Retângulo de cantos arredondados como pontos do contorno: leste → sul → oeste → norte (ângulo crescente em x, z). */
function roundedRect(b, r, seg = 6) {
  const pts = [];
  const corners = [[b.maxX - r, b.maxZ - r, 0], [b.minX + r, b.maxZ - r, Math.PI / 2], [b.minX + r, b.minZ + r, Math.PI], [b.maxX - r, b.minZ + r, Math.PI * 1.5]];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

/** Barranco em volta de um contorno: faixas com ruído para fora (terra em camadas e pedra embaixo). */
function cliff(pts, { depth = 3.5, seed = 1 } = {}) {
  const rows = [0, -0.18, -0.9, -1.9, -2.8, -depth];
  const out = [0, 0.08, 0.16, 0.2, 0.26, 0.3];
  const cols = ['#7fae4c', '#8a6a3e', '#9a6a44', '#86583a', '#7a6a5c', '#6f655c'];
  // perímetro reamostrado (~0,7 m)
  const ring = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / 0.7));
    for (let k = 0; k < n; k++) ring.push([a[0] + (b[0] - a[0]) * (k / n), a[1] + (b[1] - a[1]) * (k / n)]);
  }
  const N = ring.length;
  const normals = ring.map((p, i) => {
    const a = ring[(i - 1 + N) % N], b = ring[(i + 1) % N];
    const tx = b[0] - a[0], tz = b[1] - a[1];
    const L = Math.hypot(tx, tz) || 1;
    return [tz / L, -tx / L];
  });
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    for (let r = 0; r < rows.length; r++) {
      const [x, z] = ring[i];
      const [nx, nz] = normals[i];
      const w = r === 0 ? 0 : (fbm2(i * 0.31 + seed, r * 0.9) - 0.5) * 0.55 + out[r];
      pos.push(x + nx * w, rows[r] + (r > 0 && r < rows.length - 1 ? (vnoise2(i * 0.5, r + seed) - 0.5) * 0.25 : 0), z + nz * w);
      c.set(cols[r]).offsetHSL(0, 0, (vnoise2(i * 0.7 + seed, r * 1.3) - 0.5) * 0.08);
      col.push(c.r, c.g, c.b);
    }
  }
  const idx = [];
  const R = rows.length;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let r = 0; r < R - 1; r++) {
      const a = i * R + r, b = j * R + r, a2 = i * R + r + 1, b2 = j * R + r + 1;
      // virado para fora (a normal da face é a do contorno)
      idx.push(a, b, a2, b, b2, a2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/** Topo de grama de um platô (malha própria, com textura de grama em metros). */
function plateauTop(root, pts) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape, 4);
  g.rotateX(-Math.PI / 2);
  const tex = grassTexture();
  tex.repeat.set(1 / 9, 1 / 9);
  const m = new THREE.Mesh(g, mat('mapa-grass', () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, color: '#ffffff' })));
  m.name = 'mapa:grama';
  m.receiveShadow = true;
  root.add(m);
  return m;
}

/**
 * @param {ReturnType<import('./kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../types').LevelLayout} L
 */
export function buildGround(kit, root, L) {
  // ---------- mar ----------
  // cópia da textura de ondinhas (a original é das outras fases: a repetição daqui não pode mudar a delas)
  const waterMat = mat('mapa-water', () => new THREE.MeshStandardMaterial({
    color: '#3e9ad6', roughness: 0.2, metalness: 0.05, normalMap: rippleNormalTexture().clone(), normalScale: new THREE.Vector2(0.35, 0.35),
  }));
  const tex = /** @type {THREE.Texture} */ (waterMat.normalMap);
  tex.repeat.set(36, 36);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2), waterMat);
  water.position.set(0, -3.1, 0);
  water.receiveShadow = true;
  water.name = 'mapa:mar';
  root.add(water);

  // ---------- platôs ----------
  const city = roundedRect(L.CITY, 3.2);
  const farm = roundedRect(L.FARM, 3.2);
  plateauTop(root, city);
  plateauTop(root, farm);
  kit.add(cliff(city, { seed: 1 }), { color: null, slot: 'ground', group: 'terreno' });
  kit.add(cliff(farm, { seed: 7 }), { color: null, slot: 'ground', group: 'terreno' });
  // espuma na beira d'água e pedras soltas
  const foam = (b) => {
    const w = b.maxX - b.minX + 1.4, d = b.maxZ - b.minZ + 1.4;
    for (const [x, z, sx, sz] of [[(b.minX + b.maxX) / 2, b.minZ - 0.55, w, 0.5], [(b.minX + b.maxX) / 2, b.maxZ + 0.55, w, 0.5], [b.minX - 0.55, (b.minZ + b.maxZ) / 2, 0.5, d], [b.maxX + 0.55, (b.minZ + b.maxZ) / 2, 0.5, d]]) {
      kit.add(slab(sx, 0.02, sz), { color: '#d8eef8', slot: 'ground', x, y: -3.09, z, group: 'terreno' });
    }
  };
  foam(L.CITY);
  foam(L.FARM);
  const rock = new THREE.IcosahedronGeometry(1, 1);
  for (const [x, z, r] of [[-53, -20, 1.1], [-53.2, 14, 0.8], [-30, -36.9, 0.9], [4, 36.8, 1.0], [26.4, -18, 0.7], [31.2, 12, 0.8], [53.6, -6, 0.9], [44, 29.6, 0.8], [-8, -36.8, 0.7], [18, 36.7, 0.9]]) {
    kit.add(rock, { color: '#8d877e', slot: 'solid', x, y: -3.2, z, sx: r, sy: r * 0.7, sz: r, group: 'terreno' });
  }

  // ---------- ruas ----------
  const W = L.ROAD_W;
  const isCross = (x, z) => L.CROSSINGS.some(([a, b]) => Math.abs(a - x) < 0.01 && Math.abs(b - z) < 0.01);
  for (const [x1, z1, x2, z2] of L.ROADS) {
    const horiz = z1 === z2;
    const a = horiz ? Math.min(x1, x2) : Math.min(z1, z2);
    const b = horiz ? Math.max(x1, x2) : Math.max(z1, z2);
    const fixed = horiz ? z1 : x1;
    const pt = (u) => (horiz ? [u, fixed] : [fixed, u]);
    const ea = isCross(...pt(a)) ? W / 2 : 0;
    const eb = isCross(...pt(b)) ? W / 2 : 0;
    const len = b - a + ea + eb;
    const mid = (a - ea + b + eb) / 2;
    const cx = horiz ? mid : fixed, cz = horiz ? fixed : mid;
    kit.add(slab(horiz ? len : W, Y.road, horiz ? W : len), { color: noisy('#5d5c66', 0.035, 0.25, cx, cz), slot: 'ground', x: cx, z: cz });
    // faixas entre os cruzamentos
    const inner = L.CROSSINGS.filter(([nx, nz]) => (horiz ? Math.abs(nz - fixed) < 0.01 && nx > a && nx < b : Math.abs(nx - fixed) < 0.01 && nz > a && nz < b)).map(([nx, nz]) => (horiz ? nx : nz));
    const stops = [a, ...inner, b].sort((p, q) => p - q);
    for (let i = 0; i < stops.length - 1; i++) {
      const s0 = stops[i] + (isCross(...pt(stops[i])) ? W / 2 + 0.5 : 0.3);
      const s1 = stops[i + 1] - (isCross(...pt(stops[i + 1])) ? W / 2 + 0.5 : 0.3);
      if (s1 - s0 < 1.2) continue;
      const m = (s0 + s1) / 2, l = s1 - s0;
      for (const off of [-W / 2 + 0.22, W / 2 - 0.22]) {
        kit.add(slab(horiz ? l : 0.1, 0.004, horiz ? 0.1 : l), { color: '#f2ede2', slot: 'ground', x: horiz ? m : fixed + off, y: Y.road, z: horiz ? fixed + off : m });
      }
      for (let u = s0 + 0.4; u < s1 - 1.0; u += 1.9) {
        kit.add(slab(horiz ? 0.9 : 0.12, 0.004, horiz ? 0.12 : 0.9), { color: '#ffd36a', slot: 'ground', x: horiz ? u + 0.45 : fixed, y: Y.road, z: horiz ? fixed : u + 0.45 });
      }
    }
  }
  // faixas de pedestre (portaria e cruzamentos da avenida)
  const zebra = (x, z, alongX) => {
    for (let i = 0; i < 6; i++) {
      kit.add(slab(alongX ? 0.36 : W * 0.86, 0.004, alongX ? W * 0.86 : 0.36), { color: '#f7f3ea', slot: 'ground', x: alongX ? x + i * 0.62 : x, y: Y.road, z: alongX ? z : z + i * 0.62 });
    }
  };
  zebra(L.CONDO.maxX + 0.6, 0, true);
  zebra(L.AVENUE_X, L.ROAD_W / 2 + 0.5, false);
  zebra(L.AVENUE_X, -L.ROAD_W / 2 - 0.5 - 5 * 0.62, false);
  for (const x of L.STREET_X.slice(1, 3)) zebra(x - 1.55, L.STREET_Z[2], true);

  // vagas na faixa entre o muro e a avenida e a baia do ônibus
  const P = L.TOWN.parking;
  kit.add(slab(P.maxX - P.minX, Y.road, P.maxZ - P.minZ), { color: '#62616b', slot: 'ground', x: (P.minX + P.maxX) / 2, z: (P.minZ + P.maxZ) / 2 });
  for (let z = P.minZ + 0.1; z <= P.maxZ; z += 2.9) kit.add(slab(P.maxX - P.minX - 0.2, 0.004, 0.08), { color: '#f2ede2', slot: 'ground', x: (P.minX + P.maxX) / 2 + 0.1, y: Y.road, z });
  const bus = L.TOWN.bus;
  kit.add(slab(bus.w + 0.6, Y.road, bus.d + 1.2), { color: '#62616b', slot: 'ground', x: bus.x, z: bus.z });
  kit.add(slab(bus.w + 0.4, 0.004, 0.1), { color: '#ffd36a', slot: 'ground', x: bus.x, y: Y.road, z: bus.z - bus.d / 2 - 0.4 });
  kit.add(slab(bus.w + 0.4, 0.004, 0.1), { color: '#ffd36a', slot: 'ground', x: bus.x, y: Y.road, z: bus.z + bus.d / 2 + 0.4 });

  // ---------- calçadas em volta dos quarteirões ----------
  const walkRing = (b, w = L.WALK_W) => {
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const sx = b.maxX - b.minX, sz = b.maxZ - b.minZ;
    const col = noisy('#ddd6ca', 0.03, 1.4, cx, cz);
    kit.add(rb(sx, Y.walk, w, 0.012, 1), { color: col, slot: 'ground', x: cx, z: b.minZ + w / 2 });
    kit.add(rb(sx, Y.walk, w, 0.012, 1), { color: col, slot: 'ground', x: cx, z: b.maxZ - w / 2 });
    kit.add(rb(w, Y.walk, sz - 2 * w + 0.02, 0.012, 1), { color: col, slot: 'ground', x: b.minX + w / 2, z: cz });
    kit.add(rb(w, Y.walk, sz - 2 * w + 0.02, 0.012, 1), { color: col, slot: 'ground', x: b.maxX - w / 2, z: cz });
  };
  for (const b of Object.values(L.BLOCKS)) walkRing(b);
  for (const b of Object.values(L.TOWN_BLOCKS)) walkRing(b);
  // calçada larga da avenida (lado do muro) e da beira do rio
  kit.add(rb(1.1, Y.walk, 49, 0.012, 1), { color: noisy('#ddd6ca', 0.03, 1.4, 11.2, -2), slot: 'ground', x: L.AVENUE_X - L.ROAD_W / 2 - 0.55, z: -2.3 });
  kit.add(rb(0.6, Y.walk, 45.6, 0.012, 1), { color: noisy('#ddd6ca', 0.03, 1.4, 25.6, 0), slot: 'ground', x: L.RIVERSIDE_X + L.ROAD_W / 2 + 0.3, z: 0 });

  // ---------- pisos ----------
  const tiles = (b, a = '#e7ddcc', c2 = '#d8ccb8', size = 0.9, y = Y.pave) => {
    const ca = new THREE.Color(a), cb = new THREE.Color(c2);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const g = slab(b.maxX - b.minX, y, b.maxZ - b.minZ);
    kit.add(g, { color: (p) => ((Math.floor((p.x + cx) / size) + Math.floor((p.z + cz) / size)) % 2 ? ca : cb), slot: 'ground', x: cx, z: cz });
  };
  const S = L.BLOCKS.servico;
  tiles({ minX: S.minX + L.WALK_W, maxX: S.maxX - L.WALK_W, minZ: S.minZ + L.WALK_W, maxZ: S.maxZ - L.WALK_W });
  const T = L.BLOCKS.torre;
  tiles({ minX: T.minX + L.WALK_W, maxX: T.maxX - L.WALK_W, minZ: L.TOWER.z + L.TOWER.d / 2, maxZ: T.maxZ - L.WALK_W }, '#e9dfcf', '#dccfbb', 1.2);
  const N = L.TOWN_BLOCKS.norte;
  tiles({ minX: N.minX + L.WALK_W, maxX: N.maxX - L.WALK_W, minZ: N.minZ + L.WALK_W, maxZ: N.maxZ - L.WALK_W }, '#eadfce', '#dfd2be', 1.1);
  // praça do chafariz: piso em anéis
  const F = L.TOWN.fountain;
  const ring = new THREE.RingGeometry(F.r + 0.2, F.r + 1.6, 40, 3).rotateX(-Math.PI / 2);
  kit.add(ring, { color: (p) => (Math.floor(Math.hypot(p.x, p.z) / 0.55) % 2 ? new THREE.Color('#e3d6c1') : new THREE.Color('#d2c2a8')), slot: 'ground', x: F.x, y: Y.pave, z: F.z });

  // ---------- areia da pracinha, jardim da casa, horta e estrada de terra ----------
  const sand = L.PLAYGROUND.sand;
  kit.add(rb(sand.maxX - sand.minX, Y.sand, sand.maxZ - sand.minZ, 0.012, 1), { color: noisy('#f0d9a6', 0.05, 1.8, -5, 13), slot: 'ground', x: (sand.minX + sand.maxX) / 2, z: (sand.minZ + sand.maxZ) / 2 });
  for (const p of L.PLAYGROUND.puddles) {
    kit.add(new THREE.CircleGeometry(p.r, 22).rotateX(-Math.PI / 2), { color: '#7a5434', slot: 'ground', x: p.x, y: Y.sand + 0.004, z: p.z, sz: 0.7 });
  }
  const gd = L.HOUSE.garden;
  kit.add(slab(gd.maxX - gd.minX - 0.1, Y.lawn, gd.maxZ - gd.minZ - 0.1), { color: noisy('#92c45a', 0.05, 0.9, -21, 16), slot: 'ground', x: (gd.minX + gd.maxX) / 2, z: (gd.minZ + gd.maxZ) / 2 });
  const H = L.GRANDPA.garden;
  kit.add(slab(H.maxX - H.minX, Y.dirt, H.maxZ - H.minZ), { color: (p) => (Math.floor((p.z + 100) / 0.9) % 2 ? new THREE.Color('#8a5e3c') : new THREE.Color('#9d6c46')), slot: 'ground', x: (H.minX + H.maxX) / 2, z: (H.minZ + H.maxZ) / 2 });
  const D = L.DIRT;
  kit.add(rb(D.x1 - D.x0, Y.dirt, D.w, 0.01, 1), { color: noisy('#c9a172', 0.06, 0.8, 41, 0), slot: 'ground', x: (D.x0 + D.x1) / 2, z: D.z });
  kit.add(rb(D.drive.w, Y.dirt, D.drive.z1 - D.drive.z0, 0.01, 1), { color: noisy('#c9a172', 0.06, 0.8, 39, -3), slot: 'ground', x: D.drive.x, y: 0.0005, z: (D.drive.z0 + D.drive.z1) / 2 });
  // lama do chiqueiro
  const sty = L.GRANDPA.sty;
  kit.add(new THREE.CircleGeometry(1.6, 20).rotateX(-Math.PI / 2), { color: '#6f4a2c', slot: 'ground', x: (sty.minX + sty.maxX) / 2 + 0.5, y: 0.009, z: (sty.minZ + sty.maxZ) / 2 + 0.4, sx: 1.4 });

  return {
    update(dt) {
      tex.offset.x = (tex.offset.x + dt * 0.012) % 1;
      tex.offset.y = (tex.offset.y + dt * 0.007) % 1;
    },
  };
}
