// PANDORÓPOLIS — as construções: muro e portaria do condomínio, a casa das dogs (jardim, cerquinha, varal), a torre,
// a brinquedoteca com o trilho do trenzinho, as lojas do centro (padaria, banca, pet shop, sorveteria, ponto de
// ônibus), o portal de Pandorópolis, os cavaletes do Modo História e a chácara do vovô (casa, galpão, chiqueiro).
// Fachadas viradas para a câmera (sul e leste). As placas de texto são malhas à parte (canvas): redesenhadas quando
// a fonte do jogo termina de carregar.
import * as THREE from 'three';
import { vnoise2 } from '../../../world/util.js';
import { rb, cyl, slab, sphere, hipRoof, gableRoof, awning, windowAt, doorAt, picketFence, textPlate } from './kit.js';

const tone = (hex, amp = 0.05, freq = 1.2) => {
  const base = new THREE.Color(hex);
  const c = new THREE.Color();
  return (p) => c.copy(base).offsetHSL(0, 0, (vnoise2(p.x * freq + p.y * 0.7, p.z * freq - p.y * 0.4) - 0.5) * 2 * amp);
};
/** Telhado de telha: faixas um pouco mais escuras a cada fiada. */
const tiles = (hex) => {
  const base = new THREE.Color(hex);
  const c = new THREE.Color();
  return (p) => c.copy(base).offsetHSL(0, 0, (Math.floor(p.y / 0.16) % 2 ? -0.035 : 0.02) + (vnoise2(p.x * 2.1, p.z * 2.1) - 0.5) * 0.05);
};

/**
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../types').LevelLayout} L
 * @returns {{ signs: { redraw(): void }[], seeThrough: THREE.Object3D[], trackPoint(t: number): { x: number, z: number, yaw: number } }}
 */
export function buildBuildings(kit, root, L) {
  const signs = [];
  /** Placa de texto voltada para (nx, nz), com o centro em (x, y, z). */
  const plate = (text, w, h, x, y, z, ry, opts) => {
    const p = textPlate(text, w, h, opts);
    p.mesh.position.set(x, y, z);
    p.mesh.rotation.y = ry;
    root.add(p.mesh);
    signs.push(p);
    return p;
  };

  // ---------- muro do condomínio e portaria ----------
  const C = L.CONDO;
  const WALL = '#efe2cc', CAP = '#d6c3a5';
  const wall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = -Math.atan2(z1 - z0, x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    kit.add(rb(len, C.wallH, C.wallT, 0.04, 1), { color: tone(WALL, 0.03), x: cx, z: cz, ry });
    kit.add(rb(len + 0.04, 0.08, C.wallT + 0.1, 0.03, 1), { color: CAP, x: cx, y: C.wallH, z: cz, ry });
    const n = Math.floor(len / 6);
    for (let i = 0; i <= n; i++) {
      const k = n ? i / n : 0.5;
      kit.add(rb(0.5, C.wallH + 0.22, 0.5, 0.05, 1), { color: tone(WALL, 0.03), x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, ry });
      kit.add(rb(0.6, 0.08, 0.6, 0.03, 1), { color: CAP, x: x0 + (x1 - x0) * k, y: C.wallH + 0.22, z: z0 + (z1 - z0) * k, ry });
    }
  };
  wall(C.minX, C.minZ, C.maxX, C.minZ);
  wall(C.minX, C.maxZ, C.maxX, C.maxZ);
  wall(C.minX, C.minZ, C.minX, C.maxZ);
  wall(C.maxX, C.minZ, C.maxX, C.gate.z - C.gate.half - 0.35);
  wall(C.maxX, C.gate.z + C.gate.half + 0.35, C.maxX, C.maxZ);
  for (const s of [-1, 1]) {
    const z = C.gate.z + s * (C.gate.half + 0.35);
    kit.add(rb(0.7, 2.6, 0.7, 0.08, 2), { color: '#e07b39', x: C.maxX, z });
    kit.add(rb(0.86, 0.14, 0.86, 0.04, 1), { color: '#fff6e6', x: C.maxX, y: 2.6, z });
    kit.add(sphere(0.2, 12, 8), { color: '#ffd36a', x: C.maxX, y: 2.86, z });
  }
  kit.add(rb(0.28, 0.6, C.gate.half * 2 + 1.5, 0.05, 1), { color: '#c98a55', x: C.maxX, y: 2.0, z: C.gate.z });
  plate('Recanto das Patinhas', C.gate.half * 2 + 1.1, 0.46, C.maxX + 0.15, 2.3, C.gate.z, Math.PI / 2, { bg: '#8e5a33', color: '#fff6e6' });
  // guarita
  const Bo = C.booth;
  kit.add(rb(Bo.w, 2.1, Bo.d, 0.06, 2), { color: tone('#fff0d6'), x: Bo.x, z: Bo.z });
  kit.add(hipRoof(Bo.w + 0.5, Bo.d + 0.5, 0.55), { color: tiles('#d9733a'), x: Bo.x, y: 2.1, z: Bo.z });
  windowAt(kit, { x: Bo.x + Bo.w / 2, y: 1.65, z: Bo.z, w: 0.7, h: 0.55, nx: 1, nz: 0 });
  windowAt(kit, { x: Bo.x, y: 1.65, z: Bo.z + Bo.d / 2, w: 0.7, h: 0.55 });

  // ---------- casa das dogs ----------
  const Hs = L.HOUSE;
  const hx0 = Hs.x - Hs.w / 2, hz1 = Hs.z + Hs.d / 2;
  kit.add(rb(Hs.w, Hs.h, Hs.d, 0.08, 2), { color: tone('#f6e6cb', 0.025), x: Hs.x, z: Hs.z });
  kit.add(rb(Hs.w + 0.08, 0.32, Hs.d + 0.08, 0.04, 1), { color: '#d9c4a6', x: Hs.x, z: Hs.z });
  kit.add(rb(Hs.w + 0.1, 0.12, Hs.d + 0.1, 0.03, 1), { color: '#fffaf0', x: Hs.x, y: Hs.h - 0.12, z: Hs.z });
  kit.add(hipRoof(Hs.w + 1.0, Hs.d + 1.0, 2.0), { color: tiles('#d9733a'), x: Hs.x, y: Hs.h, z: Hs.z });
  kit.add(rb(0.7, 1.5, 0.7, 0.05, 1), { color: tone('#c6714a'), x: Hs.x - 2.4, y: Hs.h + 0.6, z: Hs.z - 0.6 });
  kit.add(rb(0.86, 0.12, 0.86, 0.03, 1), { color: '#8a5a3a', x: Hs.x - 2.4, y: Hs.h + 2.1, z: Hs.z - 0.6 });
  for (const wx of [hx0 + 1.4, hx0 + 3.0, Hs.x + 2.2, Hs.x + 3.6]) {
    if (Math.abs(wx - Hs.door.x) < 0.9) continue;
    windowAt(kit, { x: wx, y: 2.15, z: hz1, w: 0.9, h: 0.95, shutters: '#7fa36b' });
  }
  windowAt(kit, { x: Hs.x + Hs.w / 2, y: 2.15, z: Hs.z + 0.4, w: 0.9, h: 0.95, nx: 1, nz: 0, shutters: '#7fa36b' });
  doorAt(kit, { x: Hs.door.x, z: hz1, color: '#a0603a' });
  // varandinha da porta
  for (const s of [-1, 1]) kit.add(cyl(0.06, 0.07, 2.35, 10), { color: '#fffaf0', x: Hs.door.x + s * 0.85, z: hz1 + 0.95 });
  kit.add(gableRoof(2.3, 1.25, 0.42), { color: tiles('#d9733a'), x: Hs.door.x, y: 2.35, z: hz1 + 0.55 });
  // anexo da lavanderia (fase 8): telhado plano, janelinha e porta para o jardim
  const A = Hs.annex;
  kit.add(rb(A.w, A.h, A.d, 0.06, 2), { color: tone('#fff0d6'), x: A.x, z: A.z });
  kit.add(rb(A.w + 0.4, 0.16, A.d + 0.4, 0.04, 1), { color: '#c98a55', x: A.x, y: A.h, z: A.z });
  windowAt(kit, { x: A.x + A.w / 2, y: 1.75, z: A.z - 0.6, w: 0.7, h: 0.6, nx: 1, nz: 0 });
  doorAt(kit, { x: A.x, z: A.z + A.d / 2, w: 0.8, h: 1.8, color: '#6ec3e8' });
  // cerquinha do jardim (com o portãozinho aberto) e as laterais
  const gd = Hs.garden, F = Hs.fence;
  picketFence(kit, { x0: gd.minX + 0.05, z0: F.z, x1: F.gate.x0, z1: F.z });
  picketFence(kit, { x0: F.gate.x1, z0: F.z, x1: gd.maxX - 0.05, z1: F.z });
  picketFence(kit, { x0: gd.minX + 0.05, z0: F.back, x1: gd.minX + 0.05, z1: F.z });
  picketFence(kit, { x0: gd.maxX - 0.05, z0: F.back, x1: gd.maxX - 0.05, z1: F.z });
  picketFence(kit, { x0: gd.minX + 0.05, z0: F.back, x1: Hs.x - Hs.w / 2, z1: F.back });
  picketFence(kit, { x0: Hs.x + Hs.w / 2, z0: F.back, x1: gd.maxX - 0.05, z1: F.back });
  for (const x of [F.gate.x0, F.gate.x1]) {
    kit.add(rb(0.16, 0.86, 0.16, 0.03, 1), { color: '#fffaf0', x, z: F.z });
    kit.add(sphere(0.08, 10, 8), { color: '#fffaf0', x, y: 0.92, z: F.z });
  }
  picketFence(kit, { x0: F.gate.x1 - 0.05, z0: F.z + 0.05, x1: F.gate.x1 + 0.45, z1: F.z + 1.0, h: 0.55 });

  // ---------- torre (o terraço da fase 4) ----------
  const T = L.TOWER;
  const tg = 'torre';
  kit.add(rb(T.w, T.h, T.d, 0.12, 2), { color: tone('#ece0cc', 0.02), x: T.x, z: T.z, group: tg });
  kit.add(rb(T.w + 0.1, 0.5, T.d + 0.1, 0.05, 1), { color: '#c9b597', x: T.x, z: T.z, group: tg });
  for (let f = 0; f < 4; f++) {
    const y = 2.4 + f * 2.3;
    kit.add(rb(T.w + 0.06, 0.14, T.d + 0.06, 0.03, 1), { color: '#fffaf0', x: T.x, y: y - 1.0, z: T.z, group: tg });
    for (const k of [-1.9, 0, 1.9]) {
      windowAt(kit, { x: T.x + k, y, z: T.z + T.d / 2, w: 1.2, h: 1.1, group: tg });
      windowAt(kit, { x: T.x + T.w / 2, y, z: T.z + k, w: 1.2, h: 1.1, nx: 1, nz: 0, group: tg });
    }
  }
  // terraço: mureta, caixa d'água, ar-condicionado, pombos e o patinho
  const top = T.h;
  for (const [w, d, x, z] of [[T.w, 0.2, T.x, T.z - T.d / 2 + 0.1], [T.w, 0.2, T.x, T.z + T.d / 2 - 0.1], [0.2, T.d, T.x - T.w / 2 + 0.1, T.z], [0.2, T.d, T.x + T.w / 2 - 0.1, T.z]]) {
    kit.add(rb(w, 0.55, d, 0.04, 1), { color: '#e2d3ba', x, y: top, z, group: tg });
  }
  kit.add(cyl(0.95, 0.95, 1.4, 18), { color: '#9fb6c2', x: T.x - 1.5, y: top + 0.3, z: T.z - 1.4, group: tg });
  kit.add(cyl(1.02, 1.02, 0.12, 18), { color: '#7f98a6', x: T.x - 1.5, y: top + 1.7, z: T.z - 1.4, group: tg });
  for (const [dx, dz] of [[0, -1.6], [1.6, -1.4]]) for (const k of [0, 1]) {
    kit.add(rb(0.9, 0.55, 0.6, 0.06, 1), { color: '#d9dde0', x: T.x + 1.2 + dx * 0.4 + k * 0.05, y: top + 0.05 + k * 0.6, z: T.z + dz * 0.6, group: tg });
  }
  for (const [x, z, ry] of [[T.x + 0.8, T.z + 2.3, 0.4], [T.x + 1.5, T.z + 2.0, -0.8], [T.x - 0.4, T.z + 2.5, 2.2]]) {
    kit.add(sphere(0.16, 10, 8), { color: '#a7a9b5', x, y: top + 0.18, z, sx: 1.4, group: tg });
    kit.add(sphere(0.09, 10, 8), { color: '#8d90a0', x: x + Math.cos(ry) * 0.2, y: top + 0.3, z: z - Math.sin(ry) * 0.2, group: tg });
  }
  kit.add(sphere(0.16, 12, 10), { color: '#ffd33f', x: T.x + 2.4, y: top + 0.16, z: T.z + 1.0, group: tg });
  kit.add(sphere(0.1, 10, 8), { color: '#ffd33f', x: T.x + 2.5, y: top + 0.34, z: T.z + 0.9, group: tg });
  // marquise da entrada
  kit.add(rb(3, 0.16, 1.4, 0.04, 1), { color: '#e07b39', x: T.x, y: 2.6, z: T.z + T.d / 2 + 0.6, group: tg });
  for (const s of [-1, 1]) kit.add(cyl(0.05, 0.05, 2.6, 8), { color: '#4a3426', x: T.x + s * 1.35, z: T.z + T.d / 2 + 1.2, group: tg });
  doorAt(kit, { x: T.x, z: T.z + T.d / 2, w: 1.4, h: 2.1, color: '#9fd6ef', group: tg });

  // ---------- brinquedoteca (fase 6) e o trilho do trenzinho ----------
  const B = L.TOYHOUSE;
  kit.add(rb(B.w, B.h, B.d, 0.1, 2), { color: tone('#fff3dc'), x: B.x, z: B.z });
  kit.add(gableRoof(B.w + 0.7, B.d + 0.8, 1.3), { color: (p) => new THREE.Color(Math.floor((p.x + 10) / 0.62) % 2 ? '#f08a3c' : '#ffd15c'), x: B.x, y: B.h, z: B.z });
  for (const k of [-1.4, 1.4]) {
    kit.add(cyl(0.48, 0.48, 0.06, 20).rotateX(Math.PI / 2), { color: '#fffaf0', x: B.x + k, y: 1.55, z: B.z + B.d / 2 + 0.02 });
    kit.add(cyl(0.38, 0.38, 0.05, 20).rotateX(Math.PI / 2), { color: '#8ec1df', slot: 'glass', x: B.x + k, y: 1.55, z: B.z + B.d / 2 + 0.05 });
  }
  doorAt(kit, { x: B.x, z: B.z + B.d / 2, w: 1.0, h: 1.9, color: '#e8577a' });
  const blockCols = ['#e8577a', '#6ec3e8', '#ffd15c', '#7fd36b'];
  [[B.x - B.w / 2 - 0.5, B.z + 1.2], [B.x + B.w / 2 + 0.4, B.z - 1.4]].forEach(([x, z], i) => {
    for (let k = 0; k < 3; k++) kit.add(rb(0.5, 0.5, 0.5, 0.06, 1), { color: blockCols[(i + k) % 4], x: x + (k === 2 ? 0.1 : (k - 0.5) * 0.52), y: k === 2 ? 0.5 : 0, z, ry: k * 0.3 });
  });
  plate('BRINQUEDOTECA', 3.4, 0.5, B.x, B.h - 0.45, B.z + B.d / 2 + 0.06, 0, { bg: '#e8577a' });
  // trilho em elipse: dormentes e dois trilhos
  const trackPoint = (t) => {
    const x = B.x + Math.cos(t) * B.track.rx, z = B.z + Math.sin(t) * B.track.rz;
    const dx = -Math.sin(t) * B.track.rx, dz = Math.cos(t) * B.track.rz;
    return { x, z, yaw: Math.atan2(dx, dz) };
  };
  const N = 56;
  for (let i = 0; i < N; i++) {
    const p = trackPoint((i / N) * Math.PI * 2);
    kit.add(rb(0.62, 0.05, 0.14, 0.015, 1), { color: '#8e5a33', x: p.x, y: 0.012, z: p.z, ry: p.yaw + Math.PI / 2 });
  }
  for (const s of [-0.22, 0.22]) {
    const ell = new THREE.EllipseCurve(0, 0, B.track.rx + s, B.track.rz + s, 0, Math.PI * 2);
    const pts = ell.getPoints(72).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.03, 5, true);
    kit.add(tube, { color: '#9aa0a6', x: B.x, y: 0.09, z: B.z });
  }

  // ---------- lojas do centro ----------
  const shop = (s, wallHex, name, awn, { roof = '#8e5a33', sign = '#4a3426' } = {}) => {
    kit.add(rb(s.w, s.h, s.d, 0.07, 2), { color: tone(wallHex, 0.025), x: s.x, z: s.z });
    kit.add(rb(s.w + 0.3, 0.3, s.d + 0.3, 0.05, 1), { color: roof, x: s.x, y: s.h, z: s.z });
    kit.add(rb(s.w + 0.06, 0.24, s.d + 0.06, 0.03, 1), { color: '#d9c4a6', x: s.x, z: s.z });
    const fz = s.z + s.d / 2;
    doorAt(kit, { x: s.x - s.w * 0.22, z: fz, w: 0.85, h: 1.85, color: '#8e5a33' });
    windowAt(kit, { x: s.x + s.w * 0.2, y: 1.45, z: fz, w: Math.min(1.8, s.w * 0.4), h: 0.95 });
    if (awn) awning(kit, { x: s.x, y: 2.05, z: fz + 0.05, w: s.w - 0.2, depth: 0.85, drop: 0.32, colors: [awn, '#fff6e6'], n: Math.round(s.w / 0.45) });
    plate(name, Math.min(s.w - 0.3, 4.6), 0.5, s.x, s.h - 0.3, fz + 0.07, 0, { bg: sign });
  };
  const Tn = L.TOWN;
  shop(Tn.bakery, '#f6d9a8', 'PADARIA', '#e07b39');
  kit.add(sphere(1.0, 18, 12), { color: '#d99a4e', x: Tn.bakery.x - 0.8, y: Tn.bakery.h + 0.55, z: Tn.bakery.z, sx: 1.4, sy: 0.55, sz: 0.8 });
  for (const k of [-0.5, 0, 0.5]) kit.add(rb(0.12, 0.05, 0.6, 0.02, 1), { color: '#f2c98a', x: Tn.bakery.x - 0.8 + k, y: Tn.bakery.h + 1.05, z: Tn.bakery.z, ry: 0.3 });
  kit.add(sphere(0.6, 14, 10), { color: '#e9b064', x: Tn.bakery.x + 1.4, y: Tn.bakery.h + 0.4, z: Tn.bakery.z - 0.4, sx: 1.3, sy: 0.6 });
  shop(Tn.petshop, '#bfe3f2', 'BANHO & TOSA', '#6ec3e8', { sign: '#2f6fb8' });
  for (const dx of [-0.42, 0.42]) for (const dz of [-0.13, 0.13]) kit.add(sphere(0.2, 12, 8), { color: '#fffaf0', x: Tn.petshop.x + dx, y: Tn.petshop.h + 0.55, z: Tn.petshop.z + dz });
  kit.add(rb(0.84, 0.22, 0.24, 0.08, 2), { color: '#fffaf0', x: Tn.petshop.x, y: Tn.petshop.h + 0.44, z: Tn.petshop.z });
  shop(Tn.icecream, '#f7c3d0', 'SORVETES', '#e8577a', { sign: '#c9506e' });
  kit.add(new THREE.ConeGeometry(0.45, 1.1, 14).rotateX(Math.PI), { color: '#e9b064', x: Tn.icecream.x + 1.2, y: Tn.icecream.h + 0.9, z: Tn.icecream.z });
  kit.add(sphere(0.5, 16, 12), { color: '#f28ca2', x: Tn.icecream.x + 1.2, y: Tn.icecream.h + 1.55, z: Tn.icecream.z });
  kit.add(sphere(0.12, 8, 6), { color: '#d93a3a', x: Tn.icecream.x + 1.2, y: Tn.icecream.h + 2.08, z: Tn.icecream.z });
  // banca de jornal
  const Nw = Tn.newsstand;
  kit.add(rb(Nw.w, Nw.h, Nw.d, 0.05, 1), { color: '#4f8a3e', x: Nw.x, z: Nw.z });
  kit.add(rb(Nw.w + 0.5, 0.12, Nw.d + 0.6, 0.04, 1), { color: '#3f7a35', x: Nw.x, y: Nw.h, z: Nw.z + 0.1 });
  ['#e8577a', '#ffd15c', '#6ec3e8', '#fffaf0', '#b39ddb'].forEach((c, i) => kit.add(rb(0.3, 0.42, 0.04, 0.01, 1), { color: c, x: Nw.x - 0.72 + i * 0.36, y: 0.75, z: Nw.z + Nw.d / 2 + 0.03, rx: -0.15 }));
  // ponto de ônibus
  const Bs = Tn.busStop;
  kit.add(rb(0.12, 2.1, 2.2, 0.03, 1), { color: '#9fd6ef', slot: 'glass', x: Bs.x + 0.3, z: Bs.z });
  kit.add(rb(1.0, 0.1, 2.5, 0.03, 1), { color: '#4a3426', x: Bs.x, y: 2.15, z: Bs.z });
  for (const dz of [-1.05, 1.05]) kit.add(cyl(0.04, 0.04, 2.15, 8), { color: '#4a3426', x: Bs.x - 0.35, z: Bs.z + dz });
  kit.add(rb(0.42, 0.08, 1.6, 0.02, 1), { color: '#c98a55', x: Bs.x + 0.1, y: 0.45, z: Bs.z });
  // portal de boas-vindas na avenida e os cavaletes do Modo História
  for (const s of [-1, 1]) {
    kit.add(rb(0.55, 3.6, 0.55, 0.06, 2), { color: '#e07b39', x: L.AVENUE_X + s * 2.1, z: Tn.arch.z });
    kit.add(sphere(0.22, 12, 8), { color: '#ffd36a', x: L.AVENUE_X + s * 2.1, y: 3.8, z: Tn.arch.z });
  }
  kit.add(rb(5.0, 0.95, 0.3, 0.06, 1), { color: '#c98a55', x: L.AVENUE_X, y: 2.85, z: Tn.arch.z });
  plate('Bem-vindos a Pandorópolis', 4.6, 0.62, L.AVENUE_X, 3.32, Tn.arch.z + 0.16, 0, { bg: '#8e5a33', color: '#fff6e6' });
  for (let i = 0; i < 6; i++) {
    const x = L.CONDO.maxX + 1.2 + i * 3.05;
    for (const s of [-1, 1]) kit.add(rb(0.08, 0.8, 0.08, 0.02, 1), { color: '#4a3426', x: x + s * 0.6, z: Tn.barrier.z, rz: s * 0.18 });
    kit.add(rb(1.5, 0.22, 0.08, 0.02, 1), { color: (p) => new THREE.Color(Math.floor((p.x + 2) / 0.3) % 2 ? '#fffaf0' : '#d93a3a'), x, y: 0.6, z: Tn.barrier.z });
  }
  kit.add(cyl(0.05, 0.05, 1.8, 8), { color: '#4a3426', x: L.AVENUE_X + 1.6, z: Tn.barrier.z + 0.4 });
  const soon = plate('Modo História · em breve', 2.4, 0.48, L.AVENUE_X + 1.6, 1.95, Tn.barrier.z + 0.42, Math.PI / 4, { bg: '#4a3426' });
  /** @type {THREE.Material} */ (soon.mesh.material).side = THREE.DoubleSide;
  // placa da avenida e semáforo
  kit.add(cyl(0.04, 0.04, 2.3, 8), { color: '#4a3426', x: Tn.sign.x, z: Tn.sign.z });
  plate('Av. Pandora', 1.5, 0.36, Tn.sign.x, 2.3, Tn.sign.z, Math.PI / 4, { bg: '#2f6b3a' });
  const Lt = Tn.light;
  kit.add(cyl(0.06, 0.07, 3, 10), { color: '#3a3a40', x: Lt.x, z: Lt.z });
  kit.add(rb(0.34, 0.95, 0.3, 0.06, 1), { color: '#2b2b30', x: Lt.x, y: 2.55, z: Lt.z + 0.12 });
  ['#e8577a', '#ffd15c', '#7fd36b'].forEach((c, i) => kit.add(sphere(0.09, 10, 8), { color: c, slot: 'lit', x: Lt.x, y: 3.3 - i * 0.28, z: Lt.z + 0.28 }));

  // ---------- chácara do vovô ----------
  const Gp = L.GRANDPA;
  const Hh = Gp.house;
  kit.add(rb(Hh.w, Hh.h, Hh.d, 0.08, 2), { color: tone('#b8704f', 0.03), x: Hh.x, z: Hh.z });
  kit.add(rb(Hh.w + 0.08, 0.3, Hh.d + 0.08, 0.03, 1), { color: '#8a4a30', x: Hh.x, z: Hh.z });
  kit.add(hipRoof(Hh.w + 0.9, Hh.d + 0.9, 1.7), { color: tiles('#6b3b2a'), x: Hh.x, y: Hh.h, z: Hh.z });
  kit.add(rb(0.7, 1.6, 0.7, 0.05, 1), { color: tone('#9a5a3a'), x: Hh.x + 1.9, y: Hh.h + 0.5, z: Hh.z - 0.8 });
  for (const wx of [Hh.x - 2.2, Hh.x + 2.2]) windowAt(kit, { x: wx, y: 1.75, z: Hh.z + Hh.d / 2, w: 1.0, h: 0.9, lit: true, shutters: '#4a6a3a' });
  windowAt(kit, { x: Hh.x + Hh.w / 2, y: 1.75, z: Hh.z, w: 1.0, h: 0.9, nx: 1, nz: 0, lit: true, shutters: '#4a6a3a' });
  doorAt(kit, { x: Hh.x, z: Hh.z + Hh.d / 2, color: '#6b3b2a' });
  const Po = Gp.porch;
  kit.add(rb(Po.maxX - Po.minX, 0.16, Po.maxZ - Po.minZ, 0.03, 1), { color: '#a87a52', x: (Po.minX + Po.maxX) / 2, z: (Po.minZ + Po.maxZ) / 2 });
  for (const k of Po.posts) kit.add(cyl(0.07, 0.08, 2.2, 10), { color: '#e8d6b8', x: Hh.x + k, y: 0.16, z: Po.maxZ - 0.15 });
  kit.add(rb(Hh.w - 0.8, 0.12, 1.9, 0.04, 1), { color: '#7a4a32', x: Hh.x, y: 2.36, z: Hh.z + Hh.d / 2 + 0.85, rx: 0.12 });
  // galpão vermelho
  const Br = Gp.barn;
  kit.add(rb(Br.w, Br.h, Br.d, 0.06, 2), { color: tone('#c2483a', 0.03), x: Br.x, z: Br.z });
  kit.add(gableRoof(Br.w + 0.6, Br.d + 0.6, 1.4), { color: tiles('#8e2e24'), x: Br.x, y: Br.h, z: Br.z });
  kit.add(rb(1.8, 1.9, 0.06, 0.02, 1), { color: '#fffaf0', x: Br.x, z: Br.z + Br.d / 2 + 0.02 });
  kit.add(rb(1.6, 1.7, 0.07, 0.02, 1), { color: '#c2483a', x: Br.x, y: 0.1, z: Br.z + Br.d / 2 + 0.05 });
  for (const s of [-1, 1]) kit.add(rb(2.2, 0.1, 0.04, 0.02, 1), { color: '#fffaf0', x: Br.x, y: 0.95, z: Br.z + Br.d / 2 + 0.1, rz: s * 0.83 });
  // chiqueiro: tábuas e o cocho
  const St = Gp.sty;
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0);
    for (const y of [0.25, 0.55]) kit.add(rb(len, 0.12, 0.06, 0.02, 1), { color: '#a87a52', x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, ry });
    const n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) kit.add(rb(0.12, 0.8, 0.12, 0.02, 1), { color: '#8a5a3a', x: x0 + (x1 - x0) * i / n, z: z0 + (z1 - z0) * i / n, ry });
  };
  rail(St.minX, St.minZ, St.maxX, St.minZ);
  rail(St.minX, St.maxZ, St.maxX, St.maxZ);
  rail(St.maxX, St.minZ, St.maxX, St.maxZ);
  rail(St.minX, St.minZ, St.minX, St.maxZ);
  kit.add(rb(1.4, 0.3, 0.45, 0.04, 1), { color: '#8a5a3a', x: St.minX + 1.2, z: St.minZ + 0.6 });

  return { signs, seeThrough: [], trackPoint };
}
