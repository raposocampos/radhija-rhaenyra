// PANDORÓPOLIS — a chácara do vovô, com as duas fases de lá:
//   fase 9 (casa do vovô, noite de chuva): a casa em corte com a biblioteca (estantes de livros), a lareira acesa com
//     a fumaça saindo da chaminé, a poltrona e o abajur, o hall com o banco e o guarda-chuva, o escritório com o
//     armário (o gato Bichano dormindo em cima), a escrivaninha e o globo; o jardim de inverno de vidro com as plantas,
//     a poltrona de vime e as luzinhas; a nuvem de chuva em cima;
//   fase 10 (o aniversário no quintal): o deque com o pergolado, as luzinhas e a faixa "FELIZ 3 ANOS", a mesa do bolo
//     com os balões, as bandeirolas, a piscininha com o barquinho, o presente, a mangueira com as mangas e a piñata de
//     estrela, a roseira, o milharal com as abóboras e o espantalho, os girassóis do galpão e a casa na árvore com o
//     elevador de balde e o escorregador.
// E o resto da chácara: a varanda, a horta, os porquinhos, as galinhas e a cerquinha do fundo.
// API: buildChacara(kit, root, L) → { signs, update(dt, t) }
import * as THREE from 'three';
import { mat, mergeGeometries, foliageCluster, paint } from '../../../world/util.js';
import { lettuce, carrotTops, succulent } from '../../../world/plants.js';
import { rb, cyl, sphere, slab, textPlate, tiles as tilesTop, tilesV } from './kit.js';
import { openHouse, stringLights, rainCloud, bookSpines, waterMat, flowerBush } from './pecas.js';

const tiles = (hex, under = '#efe1c8') => {
  const base = new THREE.Color(hex), ceil = new THREE.Color(under), c = new THREE.Color();
  return (p, n) => (n.y < -0.5 ? ceil : c.copy(base).offsetHSL(0, 0, Math.floor(p.y / 0.16) % 2 ? -0.035 : 0.02));
};
const planks = (a, b, w = 0.2) => {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return (p) => (Math.floor((p.x + 80) / w) % 2 ? ca : cb);
};
const bricks = (a, b) => {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return (p) => ((Math.floor((p.y + 10) / 0.14) + Math.floor((p.x + p.z + 80) / 0.36)) % 5 ? ca : cb);
};

/** Pé de milho (feito uma vez): o caule, duas folhas, a espiga e o pendão. */
function cornStalk() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.018, 0.028, 1.35, 5).translate(0, 0.675, 0);
  parts.push(paint(stem, '#7fa64a'));
  for (const [y, a] of [[0.55, 0.3], [0.85, 3.4]]) {
    const leaf = new THREE.PlaneGeometry(0.06, 0.55).translate(0, 0.27, 0).rotateZ(-0.9).rotateY(a).translate(0, y, 0);
    parts.push(paint(leaf, '#6f9a3e'));
  }
  const cob = new THREE.SphereGeometry(0.05, 6, 5).scale(1, 2.2, 1).rotateZ(0.35).translate(0.06, 0.8, 0);
  parts.push(paint(cob, '#f2cf5c'));
  const tassel = new THREE.ConeGeometry(0.05, 0.22, 5).translate(0, 1.45, 0);
  parts.push(paint(tassel, '#d9b25a'));
  for (const g of parts) { g.deleteAttribute('uv'); if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]); }
  return mergeGeometries(parts);
}

/**
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../types').LevelLayout} L
 */
export function buildChacara(kit, root, L) {
  const Gp = L.GRANDPA;
  const signs = [];
  const anim = [];
  const water = waterMat();

  // ====================================================== fase 9: a casa do vovô em corte
  const Hh = Gp.house;
  const H = openHouse(kit, {
    x: Hh.x, z: Hh.z, w: Hh.w, d: Hh.d, h: Hh.h, low: 1.0, wall: bricks('#b8704f', '#a8613f'), inside: '#f3e3c8',
    floor: planks('#a87a52', '#9a6c46', 0.22), floorCell: [0.22, Hh.d], door: { x: Hh.x, w: 1.1 }, windows: [39.7, 42.6],
    roof: { kind: 'hip', h: 1.7, color: tiles('#6b3b2a'), open: 0.82, over: 0.4 },
  });
  // divisórias baixas: sala | hall | escritório (com a passagem no meio)
  for (const x of [38.9, 40.5]) {
    kit.add(rb(0.12, 0.95, -8.7 - (H.z0 + 0.16), 0.03, 1), { color: '#f3e3c8', x, z: (H.z0 + 0.16 - 8.7) / 2 });
    kit.add(rb(0.12, 0.95, H.z1 - 0.16 + 7.3, 0.03, 1), { color: '#f3e3c8', x, z: (-7.3 + H.z1 - 0.16) / 2 });
  }
  // a biblioteca: estantes cheias na parede do fundo
  kit.add(rb(2.3, 2.1, 0.36, 0.03, 1), { color: '#6b3b2a', x: 37.6, y: 0.06, z: H.z0 + 0.36 });
  for (let k = 0; k < 4; k++) {
    kit.add(rb(2.1, 0.36, 0.26, 0.01, 1), { color: '#5a3a26', x: 37.6, y: 0.18 + k * 0.48, z: H.z0 + 0.42, ao: false });
    kit.add(tilesV(2.06, 0.34, 0.07, 0.34, bookSpines(k + 2)), { color: null, x: 37.6, y: 0.36 + k * 0.48, z: H.z0 + 0.556, ao: false });
  }
  // a lareira acesa (parede oeste) e a chaminé
  kit.add(rb(0.5, 1.15, 1.6, 0.04, 1), { color: bricks('#c9b5a0', '#b39e88'), x: H.x0 + 0.4, z: Hh.z });
  kit.add(rb(0.62, 0.08, 1.8, 0.02, 1), { color: '#6b3b2a', x: H.x0 + 0.43, y: 1.15, z: Hh.z });
  kit.add(rb(0.06, 0.55, 0.8, 0.02, 1), { color: '#2b2422', x: H.x0 + 0.66, y: 0.12, z: Hh.z, ao: false });
  kit.add(rb(0.05, 0.36, 0.6, 0.06, 2), { color: '#ff9a3c', slot: 'lit', x: H.x0 + 0.69, y: 0.14, z: Hh.z, ao: false });
  kit.add(new THREE.ConeGeometry(0.12, 0.3, 6), { color: '#ffd36a', slot: 'lit', x: H.x0 + 0.62, y: 0.16, z: Hh.z - 0.12, ao: false });
  kit.add(new THREE.ConeGeometry(0.1, 0.24, 6), { color: '#ffb347', slot: 'lit', x: H.x0 + 0.62, y: 0.16, z: Hh.z + 0.14, ao: false });
  const chim = { x: H.x0 + 0.2, z: Hh.z, top: Hh.h + 1.9 };
  kit.add(rb(0.62, chim.top - 1.1, 0.72, 0.04, 1), { color: bricks('#a8613f', '#8e4f33'), x: chim.x, y: 1.1, z: chim.z });
  kit.add(rb(0.74, 0.1, 0.84, 0.02, 1), { color: '#6b3b2a', x: chim.x, y: chim.top, z: chim.z });
  // a poltrona do vovô, o tapete, a mesinha com o abajur
  kit.add(cyl(0.95, 0.95, 0.02, 24), { color: '#c2483a', x: 37.6, y: 0.06, z: -8.2, sx: 1.2, ao: false });
  kit.add(cyl(0.7, 0.7, 0.025, 24), { color: '#e9b064', x: 37.6, y: 0.06, z: -8.2, sx: 1.2, ao: false });
  kit.add(rb(0.8, 0.42, 0.75, 0.1, 2), { color: '#5d8350', x: 37.9, y: 0.06, z: -7.4 });
  kit.add(rb(0.8, 0.6, 0.18, 0.08, 2), { color: '#4f7444', x: 37.9, y: 0.4, z: -7.08, rx: -0.12 });
  for (const s of [-1, 1]) kit.add(rb(0.16, 0.52, 0.75, 0.07, 2), { color: '#4f7444', x: 37.9 + s * 0.42, y: 0.06, z: -7.4 });
  kit.add(cyl(0.22, 0.22, 0.04, 14), { color: '#6b3b2a', x: 38.55, y: 0.6, z: -8.6 });
  kit.add(cyl(0.03, 0.05, 0.56, 8), { color: '#6b3b2a', x: 38.55, y: 0.06, z: -8.6 });
  kit.add(cyl(0.02, 0.02, 0.3, 6), { color: '#d9b25a', x: 38.55, y: 0.64, z: -8.6, ao: false });
  kit.add(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 12, 1, true), { color: '#ffe2a0', slot: 'lit', x: 38.55, y: 1.02, z: -8.6, ao: false });
  // o hall: o banco, o cabideiro e o guarda-chuva
  kit.add(rb(0.95, 0.08, 0.36, 0.02, 1), { color: '#8e5a33', x: 39.7, y: 0.42, z: H.z0 + 0.4 });
  for (const s of [-1, 1]) kit.add(rb(0.08, 0.42, 0.34, 0.02, 1), { color: '#6b3b2a', x: 39.7 + s * 0.4, y: 0.06, z: H.z0 + 0.4 });
  kit.add(cyl(0.12, 0.1, 0.42, 10), { color: '#2f6fb8', x: 40.15, y: 0.06, z: -6.0 });
  kit.add(cyl(0.012, 0.012, 0.75, 4), { color: '#3a3a40', x: 40.15, y: 0.4, z: -6.0, rz: 0.12, ao: false });
  kit.add(new THREE.ConeGeometry(0.09, 0.4, 8), { color: '#c2483a', x: 40.1, y: 0.95, z: -6.0, rx: Math.PI, ao: false });
  // o escritório: o armário com o Bichano dormindo em cima, a escrivaninha com o livro, o globo
  kit.add(rb(1.0, 1.5, 0.42, 0.03, 1), { color: '#8e5a33', x: 41.5, y: 0.06, z: H.z0 + 0.4 });
  kit.add(rb(0.02, 1.2, 0.02, 0.005, 1), { color: '#6b3b2a', x: 41.5, y: 0.2, z: H.z0 + 0.62, ao: false });
  kit.add(sphere(0.2, 12, 10), { color: '#f2a65a', x: 41.4, y: 1.7, z: H.z0 + 0.42, sx: 1.6, sy: 0.75 });
  kit.add(sphere(0.12, 12, 10), { color: '#f2a65a', x: 41.72, y: 1.76, z: H.z0 + 0.48 });
  for (const s of [-1, 1]) kit.add(new THREE.ConeGeometry(0.045, 0.09, 4), { color: '#e08a40', x: 41.74 + 0.02 * s, y: 1.88, z: H.z0 + 0.48 + s * 0.06, ao: false });
  kit.add(new THREE.TorusGeometry(0.14, 0.035, 6, 12, Math.PI * 1.2).rotateX(Math.PI / 2), { color: '#e08a40', x: 41.15, y: 1.63, z: H.z0 + 0.5, ao: false });
  kit.add(rb(0.24, 0.05, 0.18, 0.01, 1), { color: '#c2483a', x: 41.85, y: 1.56, z: H.z0 + 0.38, ry: 0.3, ao: false });
  kit.add(rb(1.2, 0.06, 0.6, 0.02, 1), { color: '#8e5a33', x: 42.3, y: 0.72, z: -9.4 });
  for (const [dx, dz] of [[-0.52, -0.24], [0.52, -0.24], [-0.52, 0.24], [0.52, 0.24]]) kit.add(rb(0.06, 0.7, 0.06, 0.01, 1), { color: '#6b3b2a', x: 42.3 + dx, y: 0.04, z: -9.4 + dz });
  kit.add(rb(0.32, 0.05, 0.24, 0.01, 1), { color: '#fffaf0', x: 42.1, y: 0.78, z: -9.35, ry: -0.2, ao: false });
  kit.add(rb(0.34, 0.03, 0.26, 0.01, 1), { color: '#2f6fb8', x: 42.1, y: 0.76, z: -9.35, ry: -0.2, ao: false });
  kit.add(cyl(0.02, 0.02, 0.32, 6), { color: '#d9b25a', x: 42.7, y: 0.78, z: -9.55, ao: false });
  kit.add(sphere(0.07, 8, 6), { color: '#ffe2a0', slot: 'lit', x: 42.7, y: 1.12, z: -9.55, ao: false });
  kit.add(cyl(0.05, 0.12, 0.62, 8), { color: '#6b3b2a', x: 42.5, y: 0.06, z: -7.3 });
  kit.add(sphere(0.24, 18, 12), { color: (p) => new THREE.Color(Math.sin(p.x * 18) + Math.cos(p.z * 15 + p.y * 9) > 0.6 ? '#7fa36b' : '#4f8fc6'), x: 42.5, y: 0.95, z: -7.3, ao: false });
  kit.add(new THREE.TorusGeometry(0.28, 0.015, 4, 20, Math.PI).rotateZ(0.4), { color: '#d9b25a', x: 42.5, y: 0.95, z: -7.3, ao: false });
  // a varanda (o piso de tábuas e o degrau)
  const Po = Gp.porch;
  kit.add(rb(Po.maxX - Po.minX, 0.16, Po.maxZ - Po.minZ, 0.03, 1), { color: planks('#a87a52', '#9a6c46'), x: (Po.minX + Po.maxX) / 2, z: (Po.minZ + Po.maxZ) / 2 });
  kit.add(rb(1.6, 0.08, 0.4, 0.02, 1), { color: '#9a6c46', x: Hh.x, z: Po.maxZ + 0.2 });
  // a fumaça da chaminé (bolinhas que sobem e somem) e a nuvem de chuva
  const smokeMat = mat('mapa-smoke', () => new THREE.MeshStandardMaterial({ color: '#d9dde0', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }));
  const smoke = Array.from({ length: 4 }, (_, i) => {
    const m = new THREE.Mesh(sphere(0.22, 10, 8), smokeMat);
    m.userData.ph = i / 4;
    root.add(m);
    return m;
  });
  anim.push((dt, t) => {
    for (const m of smoke) {
      const k = (t * 0.35 + m.userData.ph) % 1;
      m.position.set(chim.x - k * 0.5, chim.top + 0.25 + k * 1.6, chim.z + Math.sin(k * 5 + m.userData.ph * 6) * 0.12);
      m.scale.setScalar(0.6 + k * 1.1);
    }
  });

  // ---------- o jardim de inverno (vidro): plantas, a poltrona de vime, as luzinhas
  const Cv = Gp.conservatory;
  const cx0 = Cv.x - Cv.w / 2, cx1 = Cv.x + Cv.w / 2, cz0 = Cv.z - Cv.d / 2, cz1 = Cv.z + Cv.d / 2;
  kit.add(rb(Cv.w, 0.3, Cv.d, 0.03, 1), { color: bricks('#b8704f', '#a8613f'), x: Cv.x, z: Cv.z });
  const ladrilho = [new THREE.Color('#e9dcc4'), new THREE.Color('#c9764f')];
  kit.add(tilesTop(Cv.w - 0.12, Cv.d - 0.12, 0.3, 0.3, (p) => ladrilho[Math.abs(Math.floor((p.x + 50) / 0.3) + Math.floor((p.z + 50) / 0.3)) % 2]), { color: null, x: Cv.x, y: 0.31, z: Cv.z, ao: false });
  const frame = '#fffaf0', ridge = Cv.h + 0.75;
  for (const x of [cx0, Cv.x, cx1]) for (const z of [cz0, cz0 + Cv.d / 3, cz1 - Cv.d / 3, cz1]) {
    if (x === Cv.x && z !== cz0 && z !== cz1) continue;
    kit.add(rb(0.06, Cv.h - 0.3, 0.06, 0.01, 1), { color: frame, x, y: 0.3, z, ao: false });
  }
  for (const z of [cz0, cz1]) kit.add(rb(Cv.w, 0.07, 0.07, 0.01, 1), { color: frame, x: Cv.x, y: Cv.h, z, ao: false });
  for (const x of [cx0, cx1]) kit.add(rb(0.07, 0.07, Cv.d, 0.01, 1), { color: frame, x, y: Cv.h, z: Cv.z, ao: false });
  kit.add(rb(0.08, 0.08, Cv.d + 0.1, 0.01, 1), { color: frame, x: Cv.x, y: ridge, z: Cv.z, ao: false });
  const slope = Math.atan2(ridge - Cv.h, Cv.w / 2), rl = Math.hypot(ridge - Cv.h, Cv.w / 2);
  for (let k = 0; k <= 4; k++) {
    const z = cz0 + (Cv.d * k) / 4;
    for (const s of [-1, 1]) kit.add(rb(rl, 0.05, 0.05, 0.01, 1), { color: frame, x: Cv.x + (s * Cv.w) / 4, y: (Cv.h + ridge) / 2 - 0.03, z, rz: -s * slope, ao: false });
  }
  // o vidro (uma malha à parte, transparente)
  const panes = [];
  const pane = (w, h, x, y, z, ry = 0, rz = 0) => panes.push(new THREE.PlaneGeometry(w, h).rotateZ(rz).rotateY(ry).translate(x, y, z));
  const wy = 0.3 + (Cv.h - 0.3) / 2, wh = Cv.h - 0.3;
  pane(Cv.w, wh, Cv.x, wy, cz1);
  pane(Cv.w, wh, Cv.x, wy, cz0);
  pane(Cv.d, wh, cx1, wy, Cv.z, Math.PI / 2);
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(rl, Cv.d).rotateX(-Math.PI / 2).rotateZ(-s * slope).translate(Cv.x + (s * Cv.w) / 4, (Cv.h + ridge) / 2, Cv.z);
    panes.push(g);
  }
  const glass = new THREE.Mesh(mergeGeometries(panes), mat('mapa-conservatory', () => new THREE.MeshStandardMaterial({ color: '#d8f0f8', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide })));
  glass.name = 'mapa:jardim-de-inverno';
  root.add(glass);
  const potted = [
    [cx0 + 0.35, cz0 + 0.4, flowerBush({ r: 0.22, seed: 11, flower: '#e8577a' }), 'foliage'],
    [cx0 + 0.35, cz0 + 1.2, flowerBush({ r: 0.24, seed: 12, flower: '#fffaf0', n: 4 }), 'foliage'],
    [cx1 - 0.35, cz0 + 0.4, succulent({ r: 0.1, seed: 13 }), 'plant'],
    [cx0 + 0.35, cz1 - 0.45, flowerBush({ r: 0.22, seed: 14, flower: '#ffd15c' }), 'foliage'],
  ];
  for (const [x, z, g, slot] of potted) {
    kit.add(cyl(0.2, 0.15, 0.28, 12), { color: '#c9764f', x: /** @type {number} */ (x), y: 0.32, z: /** @type {number} */ (z) });
    kit.add(/** @type {THREE.BufferGeometry} */ (g), { color: null, slot: /** @type {'plant' | 'foliage'} */ (slot), x: /** @type {number} */ (x), y: 0.56, z: /** @type {number} */ (z) });
  }
  kit.add(foliageCluster([{ x: 0, y: 0.9, z: 0, r: 0.45, sy: 1.4 }, { x: 0.15, y: 1.35, z: 0.1, r: 0.32 }], { detail: 2, amp: 0.2, seed: 15, dark: '#2c4a1c', mid: '#4f7a2a', light: '#86a845' }), { color: null, slot: 'foliage', x: cx1 - 0.4, y: 0.32, z: cz0 + 0.45 });
  kit.add(cyl(0.24, 0.2, 0.4, 12), { color: '#e9dcc4', x: cx1 - 0.4, y: 0.32, z: cz0 + 0.45 });
  // a poltrona de vime e a mesinha com a xícara
  const wc = { x: Cv.x + 0.3, z: cz1 - 0.9 };
  kit.add(cyl(0.34, 0.26, 0.36, 14), { color: '#c99a5e', x: wc.x, y: 0.32, z: wc.z });
  kit.add(new THREE.TorusGeometry(0.34, 0.08, 8, 16, Math.PI).rotateX(-0.2), { color: '#b8874a', x: wc.x, y: 0.72, z: wc.z - 0.1, ry: Math.PI });
  kit.add(cyl(0.27, 0.27, 0.08, 14), { color: '#f7c3d0', x: wc.x, y: 0.68, z: wc.z, ao: false });
  kit.add(cyl(0.16, 0.16, 0.03, 12), { color: '#c99a5e', x: wc.x - 0.55, y: 0.72, z: wc.z + 0.3 });
  kit.add(cyl(0.025, 0.03, 0.4, 6), { color: '#b8874a', x: wc.x - 0.55, y: 0.32, z: wc.z + 0.3 });
  kit.add(cyl(0.04, 0.035, 0.07, 10), { color: '#fffaf0', x: wc.x - 0.55, y: 0.75, z: wc.z + 0.3, ao: false });
  stringLights(kit, [[Cv.x, ridge - 0.08, cz0 + 0.05], [Cv.x, ridge - 0.08, cz1 - 0.05]], { sag: 0.2, every: 0.35 });
  // a chuva da noite batendo no telhado de vidro
  const rain = rainCloud(root, { x: Cv.x, y: 7.0, z: Cv.z, w: 2.0, d: 3.2, drops: 24, seed: 9, floor: ridge - 0.25 });
  anim.push((dt, t) => rain.update(dt, t));

  // ====================================================== fase 10: o quintal da festa
  // o deque e o pergolado com as luzinhas e a faixa
  const Dk = Gp.deck;
  const dy = 0.07; // baixinho: as dogs sobem andando
  kit.add(rb(Dk.w, dy, Dk.d, 0.02, 1), { color: '#b98a5e', slot: 'ground', x: Dk.x, z: Dk.z });
  kit.add(tilesTop(Dk.w - 0.04, Dk.d - 0.04, 0.24, Dk.d, planks('#c99a6c', '#b98a5e', 0.24)), { color: null, slot: 'ground', x: Dk.x, y: dy + 0.001, z: Dk.z });
  const Pg = Gp.pergola;
  const pxs = Pg.posts.map((p) => p[0]), pzs = Pg.posts.map((p) => p[1]);
  const px0 = Math.min(...pxs), px1 = Math.max(...pxs), pz0 = Math.min(...pzs), pz1 = Math.max(...pzs);
  for (const [x, z] of Pg.posts) kit.add(rb(0.16, Pg.h, 0.16, 0.03, 1), { color: '#fffaf0', x, y: dy, z });
  for (const z of [pz0, pz1]) kit.add(rb(px1 - px0 + 0.6, 0.16, 0.12, 0.02, 1), { color: '#fffaf0', x: (px0 + px1) / 2, y: dy + Pg.h, z });
  for (let x = px0 - 0.15; x <= px1 + 0.16; x += 0.5) kit.add(rb(0.08, 0.1, pz1 - pz0 + 0.5, 0.02, 1), { color: '#efe2cc', x, y: dy + Pg.h + 0.16, z: (pz0 + pz1) / 2, ao: false });
  const ly = dy + Pg.h - 0.06;
  const zig = [];
  for (let k = 0; k <= 4; k++) zig.push([px0 + ((px1 - px0) * k) / 4, ly, k % 2 ? pz0 : pz1]);
  stringLights(kit, zig, { sag: 0.3 });
  const banner = textPlate('FELIZ 3 ANOS', 3.0, 0.5, { bg: '#e8577a' });
  banner.mesh.position.set((px0 + px1) / 2, dy + Pg.h - 0.42, pz0 + 0.08); // na viga do fundo: o bolo fica na frente
  root.add(banner.mesh);
  signs.push(banner);
  for (const s of [-1, 1]) kit.add(cyl(0.008, 0.008, 0.18, 3), { color: '#4a3426', x: (px0 + px1) / 2 + s * 1.3, y: dy + Pg.h - 0.17, z: pz0 + 0.08, ao: false });
  // a mesa do bolo (bolo de três andares com a vela do 3), os pratinhos
  const Tb = Gp.table;
  kit.add(rb(Tb.w, 0.08, Tb.d, 0.03, 1), { color: '#fffaf0', x: Tb.x, y: dy + 0.72, z: Tb.z });
  kit.add(rb(Tb.w + 0.05, 0.42, Tb.d + 0.05, 0.03, 1), { color: (p) => new THREE.Color(Math.floor((p.x + 9) / 0.22) % 2 ? '#f7c3d0' : '#fffaf0'), x: Tb.x, y: dy + 0.36, z: Tb.z });
  for (const [ddx, ddz] of [[-0.95, -0.5], [0.95, -0.5], [-0.95, 0.5], [0.95, 0.5]]) kit.add(cyl(0.04, 0.04, 0.72, 6), { color: '#c98a55', x: Tb.x + ddx, y: dy, z: Tb.z + ddz });
  /** @type {[number, number, string][]} */ ([[0.42, 0.26, '#f7c3d0'], [0.31, 0.24, '#fff0d6'], [0.2, 0.22, '#f7c3d0']]).reduce((y, [r, h, c]) => {
    kit.add(cyl(r, r, h, 20), { color: c, x: Tb.x, y, z: Tb.z });
    kit.add(new THREE.TorusGeometry(r, 0.025, 4, 20).rotateX(Math.PI / 2), { color: '#e8577a', x: Tb.x, y: y + h, z: Tb.z, ao: false });
    return y + h;
  }, dy + 0.8);
  kit.add(cyl(0.03, 0.03, 0.18, 6), { color: '#6ec3e8', x: Tb.x, y: dy + 1.52, z: Tb.z });
  kit.add(sphere(0.04, 8, 6), { color: '#ffd77a', slot: 'lit', x: Tb.x, y: dy + 1.74, z: Tb.z });
  for (const [ddx, c] of /** @type {[number, string][]} */ ([[-0.75, '#6ec3e8'], [0.75, '#ffd15c'], [-0.5, '#7fd36b'], [0.55, '#e8577a']])) kit.add(cyl(0.12, 0.1, 0.02, 12), { color: c, x: Tb.x + ddx, y: dy + 0.8, z: Tb.z + (ddx > 0 ? 0.35 : -0.3), ao: false });
  // as bandeirolas
  const bt = Gp.bunting;
  for (const x of [bt.x0, bt.x1]) kit.add(cyl(0.05, 0.06, 2.4, 8), { color: '#8e5a33', x, z: bt.z });
  const flagCols = ['#e8577a', '#ffd15c', '#6ec3e8', '#7fd36b'];
  for (let i = 0, n = 14; i < n; i++) {
    const t = (i + 0.5) / n;
    const y = 2.3 - Math.sin(t * Math.PI) * 0.45;
    kit.add(new THREE.ConeGeometry(0.16, 0.3, 3).rotateX(Math.PI), { color: flagCols[i % 4], x: bt.x0 + (bt.x1 - bt.x0) * t, y: y - 0.15, z: bt.z, sz: 0.25, ao: false });
  }
  kit.add(cyl(0.008, 0.008, bt.x1 - bt.x0, 3).rotateZ(Math.PI / 2), { color: '#4a3426', x: (bt.x0 + bt.x1) / 2, y: 2.12, z: bt.z, ao: false });
  // a piscininha com o barquinho, o presente
  const Pl = Gp.pool;
  kit.add(new THREE.TorusGeometry(Pl.r, 0.2, 10, 28).rotateX(Math.PI / 2), { color: (p) => new THREE.Color(Math.floor(Math.atan2(p.y, p.x) * 3) % 2 ? '#6ec3e8' : '#fffaf0'), x: Pl.x, y: 0.2, z: Pl.z });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(Pl.r - 0.05, 28).rotateX(-Math.PI / 2), water);
  pool.position.set(Pl.x, 0.3, Pl.z);
  root.add(pool);
  const boat = new THREE.Group();
  const boatMat = mat('mapa-boat', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  const hull = paint(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.4, 0.5, 0.7), '#e8577a');
  const sail = paint(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0.05, 0, 0, 0.42, 0, 0.22, 0.05, 0], 3)), '#fffaf0');
  sail.computeVertexNormals();
  for (const g of [hull, sail]) { const m = new THREE.Mesh(g, boatMat); m.castShadow = true; boat.add(m); }
  root.add(boat);
  anim.push((dt, t) => {
    const a = t * 0.35;
    boat.position.set(Pl.x + Math.cos(a) * 0.5, 0.33 + Math.sin(t * 2.1) * 0.015, Pl.z + Math.sin(a) * 0.5);
    boat.rotation.y = -a;
  });
  const gf = Gp.gift;
  kit.add(rb(gf.s, gf.s * 0.6, gf.s, 0.06, 1), { color: '#6ec3e8', x: gf.x, z: gf.z, ry: 0.3 });
  kit.add(rb(gf.s + 0.02, gf.s * 0.62, 0.14, 0.02, 1), { color: '#e8577a', x: gf.x, z: gf.z, ry: 0.3 });
  kit.add(rb(0.14, gf.s * 0.62, gf.s + 0.02, 0.02, 1), { color: '#e8577a', x: gf.x, z: gf.z, ry: 0.3 });
  for (const s of [-1, 1]) kit.add(sphere(0.14, 10, 8), { color: '#e8577a', x: gf.x + s * 0.12, y: gf.s * 0.66, z: gf.z, sx: 1.4, sy: 0.7 });
  // a mangueira: as mangas, a piñata de estrela pendurada, a roseira
  const Mg = Gp.mango;
  for (const [a, r, y] of [[0.3, 1.15, 2.05], [1.4, 1.05, 2.2], [2.5, 1.2, 1.95], [3.6, 1.1, 2.15], [4.7, 1.15, 2.0], [5.6, 0.95, 2.3]]) {
    kit.add(sphere(0.08, 8, 6), { color: a > 3 ? '#f2b24c' : '#e9c24a', x: Mg.x + Math.cos(a) * r, y, z: Mg.z + Math.sin(a) * r, sy: 1.3, ao: false });
  }
  const pn = { x: Mg.x + 0.95, y: 1.45, z: Mg.z + 0.75 };
  kit.add(cyl(0.008, 0.008, 0.85, 3), { color: '#4a3426', x: pn.x, y: pn.y + 0.2, z: pn.z, ao: false });
  kit.add(sphere(0.2, 12, 10), { color: '#ffd15c', x: pn.x, y: pn.y, z: pn.z, sz: 0.6 });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + Math.PI / 2;
    kit.add(new THREE.ConeGeometry(0.1, 0.32, 6).translate(0, 0.3, 0).rotateZ(a - Math.PI / 2), { color: ['#e8577a', '#6ec3e8', '#7fd36b', '#9677c6', '#f08a3c'][k], x: pn.x, y: pn.y, z: pn.z, ao: false });
  }
  for (const s of [-1, 0, 1]) kit.add(cyl(0.015, 0.015, 0.3, 3), { color: ['#e8577a', '#ffd15c', '#6ec3e8'][s + 1], x: pn.x + s * 0.06, y: pn.y - 0.48, z: pn.z, ao: false });
  const Rs = Gp.rosebush;
  kit.add(flowerBush({ r: Rs.r, seed: 21, flower: '#e8577a', n: 9 }), { color: null, slot: 'foliage', x: Rs.x, z: Rs.z, sx: 0.95, sy: 1.2, sz: 0.95 });
  // o milharal (com as abóboras na beirada) e o espantalho
  const Cn = Gp.corn;
  const stalk = cornStalk();
  let ci = 0;
  for (let x = Cn.minX + 0.3; x < Cn.maxX - 0.1; x += 0.55) {
    for (let z = Cn.minZ + 0.6; z < Cn.maxZ - 0.1; z += 0.48) {
      if (Math.hypot(x - Gp.scarecrow.x, z - Gp.scarecrow.z) < 0.7) continue;
      const k = (ci++ * 7919) % 97 / 97;
      kit.add(stalk, { color: null, slot: 'plant', x: x + (k - 0.5) * 0.12, z, ry: k * 6.28, sy: 0.9 + k * 0.25 });
    }
  }
  for (let x = Cn.minX + 0.4; x < Cn.maxX; x += 0.7) kit.add(slab(0.18, 0.02, Cn.maxZ - Cn.minZ - 0.2), { color: '#7a5434', slot: 'ground', x, z: (Cn.minZ + Cn.maxZ) / 2 });
  for (const [x, s] of [[Cn.minX + 0.5, 1], [Cn.minX + 2.1, 0.8], [Cn.maxX - 1.4, 1.1]]) {
    kit.add(sphere(0.26, 14, 10), { color: (p) => new THREE.Color(Math.floor((Math.atan2(p.z, p.x) + 4) * 1.6) % 2 ? '#f08a3c' : '#e07b39'), x, y: 0.2 * s, z: Cn.minZ + 0.25, sx: s * 1.1, sy: s * 0.8, sz: s });
    kit.add(cyl(0.03, 0.04, 0.12, 6), { color: '#5d8350', x, y: 0.38 * s, z: Cn.minZ + 0.25, ao: false });
  }
  const Sc = Gp.scarecrow;
  kit.add(cyl(0.04, 0.05, 1.9, 8), { color: '#8e5a33', x: Sc.x, z: Sc.z });
  kit.add(cyl(0.035, 0.035, 1.3, 8).rotateZ(Math.PI / 2), { color: '#8e5a33', x: Sc.x, y: 1.35, z: Sc.z });
  kit.add(rb(0.5, 0.6, 0.26, 0.08, 2), { color: (p) => new THREE.Color(Math.floor((p.x + 5) / 0.1) % 2 ? '#c2483a' : '#a83a30'), x: Sc.x, y: 0.9, z: Sc.z });
  for (const s of [-1, 1]) kit.add(rb(0.42, 0.16, 0.16, 0.05, 2), { color: '#c2483a', x: Sc.x + s * 0.42, y: 1.28, z: Sc.z });
  kit.add(sphere(0.2, 14, 10), { color: '#e9cf9a', x: Sc.x, y: 1.72, z: Sc.z });
  kit.add(cyl(0.34, 0.34, 0.03, 18), { color: '#e9b064', x: Sc.x, y: 1.86, z: Sc.z, ao: false });
  kit.add(new THREE.ConeGeometry(0.18, 0.24, 14), { color: '#e9b064', x: Sc.x, y: 2.0, z: Sc.z, ao: false });
  for (const s of [-1, 1]) kit.add(sphere(0.025, 6, 4), { color: '#2b2b30', x: Sc.x + s * 0.07, y: 1.76, z: Sc.z + 0.18, ao: false });
  kit.add(sphere(0.06, 8, 6), { color: '#3a3a40', x: Sc.x - 0.42, y: 1.48, z: Sc.z, sx: 1.5, ao: false });
  // os girassóis na frente do galpão (as carinhas para o sol da tarde)
  const Sf = Gp.sunflowers;
  for (let x = Sf.x0 + 0.25, i = 0; x < Sf.x1; x += 0.52, i++) {
    const h = 1.25 + ((i * 37) % 7) * 0.05;
    kit.add(cyl(0.025, 0.032, h, 6), { color: '#6f9a3e', x, z: Sf.z });
    for (const s of [-1, 1]) kit.add(sphere(0.12, 8, 6), { color: '#6f9a3e', x: x + s * 0.12, y: h * 0.5 + s * 0.08, z: Sf.z, sx: 1.4, sy: 0.25, ao: false });
    kit.add(cyl(0.24, 0.24, 0.04, 14).rotateX(Math.PI / 2 - 0.25), { color: (p) => new THREE.Color(Math.hypot(p.x, p.z) < 0.12 ? '#6b3b2a' : '#ffd15c'), x, y: h + 0.1, z: Sf.z + 0.03 });
  }
  // a casa na árvore: a plataforma, a casinha, a escada, o elevador de balde e o escorregador
  const th = Gp.treehouse;
  kit.add(rb(1.6, 0.12, 1.6, 0.03, 1), { color: '#a87a52', x: th.x, y: 1.5, z: th.z + 0.2 });
  kit.add(rb(1.1, 0.8, 1.0, 0.05, 1), { color: '#d9a46b', x: th.x - 0.1, y: 1.62, z: th.z });
  kit.add(slab(0.4, 0.5, 0.02), { color: '#5a3a26', x: th.x - 0.1, y: 1.66, z: th.z + 0.51, ao: false });
  kit.add(new THREE.ConeGeometry(0.9, 0.6, 4).rotateY(Math.PI / 4), { color: '#c2483a', x: th.x - 0.1, y: 2.72, z: th.z });
  for (const s of [-0.24, 0.24]) kit.add(rb(0.06, 1.62, 0.06, 0.015, 1), { color: '#8a5a3a', x: th.x + 0.9 + s, z: th.z + 0.71 });
  for (let k = 0; k < 5; k++) kit.add(rb(0.5, 0.05, 0.08, 0.015, 1), { color: '#a87a52', x: th.x + 0.9, y: 0.25 + k * 0.3, z: th.z + 0.72, ao: false });
  for (const [x, z] of [[th.x - 0.75, th.z + 0.95], [th.x + 0.75, th.z + 0.95], [th.x - 0.75, th.z - 0.55]]) kit.add(rb(0.06, 0.5, 0.06, 0.01, 1), { color: '#8a5a3a', x, y: 1.62, z });
  kit.add(rb(1.5, 0.05, 0.05, 0.01, 1), { color: '#8a5a3a', x: th.x, y: 2.05, z: th.z + 0.95, ao: false });
  // elevador de balde: o braço com a roldana, a corda e o baldinho lá em cima
  kit.add(rb(0.07, 0.95, 0.07, 0.01, 1), { color: '#8a5a3a', x: th.x - 0.75, y: 1.62, z: th.z + 0.4 });
  kit.add(rb(0.75, 0.07, 0.07, 0.01, 1), { color: '#8a5a3a', x: th.x - 1.05, y: 2.5, z: th.z + 0.4, ao: false });
  kit.add(new THREE.TorusGeometry(0.08, 0.025, 6, 12), { color: '#9a8f86', x: th.x - 1.38, y: 2.44, z: th.z + 0.4, ao: false });
  kit.add(cyl(0.008, 0.008, 1.1, 3), { color: '#c98a55', x: th.x - 1.46, y: 1.35, z: th.z + 0.4, ao: false });
  kit.add(cyl(0.15, 0.12, 0.24, 12), { color: '#6ec3e8', x: th.x - 1.46, y: 1.12, z: th.z + 0.4 });
  kit.add(new THREE.TorusGeometry(0.14, 0.012, 4, 12, Math.PI), { color: '#9a8f86', x: th.x - 1.46, y: 1.36, z: th.z + 0.4, ao: false });
  // o escorregador desce para o leste
  const Ts = Gp.treeSlide;
  const sdx = Ts.x1 - Ts.x0, sdy = 1.5 - 0.1, slen = Math.hypot(sdx, sdy), sang = Math.atan2(sdy, sdx);
  kit.add(rb(slen, 0.05, 0.5, 0.02, 1), { color: '#ffd15c', x: (Ts.x0 + Ts.x1) / 2, y: 0.1 + sdy / 2 - 0.02, z: Ts.z, rz: -sang });
  for (const s of [-1, 1]) kit.add(rb(slen, 0.12, 0.05, 0.02, 1), { color: '#f2b24c', x: (Ts.x0 + Ts.x1) / 2, y: 0.1 + sdy / 2 + 0.02, z: Ts.z + s * 0.25, rz: -sang, ao: false });
  kit.add(rb(0.35, 0.05, 0.5, 0.02, 1), { color: '#ffd15c', x: Ts.x1 + 0.12, y: 0.06, z: Ts.z, ao: false });

  // ---------- a horta, os porquinhos, as galinhas, a cerquinha
  const Gd = Gp.garden;
  kit.add(rb(Gd.maxX - Gd.minX, 0.16, Gd.maxZ - Gd.minZ, 0.03, 1), { color: '#a87a52', x: (Gd.minX + Gd.maxX) / 2, z: (Gd.minZ + Gd.maxZ) / 2 });
  kit.add(slab(Gd.maxX - Gd.minX - 0.2, 0.02, Gd.maxZ - Gd.minZ - 0.2), { color: '#6f4a2c', slot: 'ground', x: (Gd.minX + Gd.maxX) / 2, y: 0.15, z: (Gd.minZ + Gd.maxZ) / 2 });
  const let1 = lettuce({ r: 0.18, seed: 4 });
  const ct = carrotTops({ seed: 6 });
  for (let x = Gd.minX + 0.5; x < Gd.maxX - 0.3; x += 0.95) {
    for (let z = Gd.minZ + 0.6; z < Gd.maxZ - 0.3; z += 1.05) kit.add((Math.round(x * 4) + Math.round(z)) % 2 ? let1 : ct, { color: null, slot: 'plant', x, y: 0.16, z });
  }
  const pig = (x, z, ry) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    kit.add(sphere(0.34, 14, 10), { color: '#f5a9b8', x, y: 0.36, z, sx: 1.35, sz: 0.95, ry });
    kit.add(sphere(0.22, 12, 10), { color: '#f5a9b8', x: x + c * 0.46, y: 0.48, z: z - s * 0.46 });
    kit.add(cyl(0.09, 0.09, 0.08, 10).rotateZ(Math.PI / 2), { color: '#f08aa0', x: x + c * 0.68, y: 0.46, z: z - s * 0.68, ry });
    for (const k of [-1, 1]) kit.add(new THREE.ConeGeometry(0.07, 0.14, 6), { color: '#f08aa0', x: x + c * 0.42 + s * k * 0.12, y: 0.7, z: z - s * 0.42 + c * k * 0.12 });
    for (const [a, b] of [[0.25, 0.18], [0.25, -0.18], [-0.25, 0.18], [-0.25, -0.18]]) kit.add(cyl(0.06, 0.06, 0.2, 6), { color: '#f08aa0', x: x + c * a + s * b, z: z - s * a + c * b });
    kit.add(new THREE.TorusGeometry(0.05, 0.015, 4, 10, Math.PI * 1.5), { color: '#f08aa0', x: x - c * 0.48, y: 0.45, z: z + s * 0.48, ry, ao: false });
  };
  const St = Gp.sty;
  pig(St.minX + 2.0, St.minZ + 2.2, 0.4);
  pig(St.minX + 3.8, St.minZ + 3.6, 2.6);
  pig(St.minX + 4.6, St.minZ + 1.6, -1.2);
  const hen = (x, z, ry) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    kit.add(sphere(0.2, 12, 10), { color: '#fffaf0', x, y: 0.26, z, sx: 1.25, ry });
    kit.add(sphere(0.12, 10, 8), { color: '#fffaf0', x: x + c * 0.2, y: 0.46, z: z - s * 0.2 });
    kit.add(rb(0.06, 0.08, 0.1, 0.02, 1), { color: '#e8577a', x: x + c * 0.21, y: 0.55, z: z - s * 0.21, ry });
    kit.add(new THREE.ConeGeometry(0.04, 0.09, 6).rotateZ(-Math.PI / 2), { color: '#f2b24c', x: x + c * 0.33, y: 0.45, z: z - s * 0.33, ry });
    for (const k of [-1, 1]) kit.add(cyl(0.012, 0.012, 0.1, 4), { color: '#f2b24c', x: x + s * k * 0.06, z: z + c * k * 0.06, ao: false });
  };
  for (const [x, z, ry] of Gp.hens) hen(x, z, ry);
  for (let x = L.FARM.minX + 1; x < L.FARM.maxX - 0.5; x += 1.6) kit.add(rb(0.12, 0.8, 0.12, 0.02, 1), { color: '#8a5a3a', x, z: L.FARM.maxZ - 0.7 });
  for (const y of [0.3, 0.6]) kit.add(rb(L.FARM.maxX - L.FARM.minX - 1.4, 0.1, 0.06, 0.02, 1), { color: '#a87a52', x: (L.FARM.minX + L.FARM.maxX) / 2, y, z: L.FARM.maxZ - 0.7 });

  // ---------- os balões da festa (sobem e descem)
  const balloonMat = mat('mapa-balloon', () => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 }));
  const balloons = [['#e8577a', -0.8, -0.5], ['#ffd15c', -0.4, -0.7], ['#6ec3e8', 0.6, -0.6], ['#7fd36b', 0.9, -0.3]].map(([c, ddx, ddz], i) => {
    const m = new THREE.Mesh(sphere(0.28, 14, 12), balloonMat.clone());
    /** @type {THREE.MeshStandardMaterial} */ (m.material).color.set(/** @type {string} */ (c));
    m.scale.set(1, 1.18, 1);
    m.position.set(Tb.x + /** @type {number} */ (ddx), 2.4, Tb.z + /** @type {number} */ (ddz));
    m.castShadow = true;
    m.userData.y0 = 2.3 + i * 0.12;
    root.add(m);
    kit.add(cyl(0.006, 0.006, 1.5, 3), { color: '#4a3426', x: Tb.x + /** @type {number} */ (ddx), y: dy + 0.8, z: Tb.z + /** @type {number} */ (ddz), ao: false });
    return m;
  });
  anim.push((dt, t) => {
    for (const b of balloons) b.position.y = b.userData.y0 + Math.sin(t * 1.5 + b.position.x * 2) * 0.12;
  });

  return {
    signs,
    update(dt, t) {
      for (const f of anim) f(dt, t);
    },
  };
}
