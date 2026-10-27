// PANDORÓPOLIS — os lugares das fases no condomínio, cada um com as peças que fazem a fase:
//   fase 2 (área de serviço, crepúsculo): a lavanderia com a luz da porta, o varal, a mureta com o portão de ferro
//     aberto, a tábua de pressão e a roldana, o gramado com o irrigador de três jatos girando, o registro, o caixote, o
//     canal com o vão do meio-fio, a bolinha de tênis e a caminha;
//   fase 3 (jardim do lago, noite): o prédio com a porta de vidro acesa, a cerca-viva com o portão de treliça e as duas
//     lanternas, as duas pedras, a mesinha com o lampião, os cordões de luz em volta do lago, a ponte para a ilha, a
//     Dona Gansa e a pantufa;
//   fase 4 (terraço do prédio, manhã): a casa da escada, as espreguiçadeiras, a fileira de floreiras com um vão só, o
//     ventilador no trilho, os aparelhos de ar e o duto, a mureta com o portão e o cantinho dos pombos (bacia com o
//     patinho, poleiros, caixa d'água);
//   fase 6 (oficina de brinquedos): a brinquedoteca em corte, o trilho de madeira no feltro com o trenzinho, a estação,
//     a cancela, o pórtico com a lua e o foguete de dois berços no tapete;
//   fase 7 (pracinha depois da chuva): a cerca de lápis de cor, o piso emborrachado, o escorregador com casinha e o
//     frisbee, o balanço, a gangorra, a caixa de areia, a joaninha de mola, o morrinho com a manilha, as poças e a
//     toalha do piquenique com a cesta.
// API: buildCondominio(kit, root, L) → { signs, trackPoint, update(dt, t) }
import * as THREE from 'three';
import { foliageCluster } from '../../../world/util.js';
import { boxwood } from '../../../world/plants.js';
import { rb, cyl, rod, sphere, slab, gableRoof, windowAt, doorAt, textPlate, tiles } from './kit.js';
import { openHouse, stringLights, pencilFence, lantern, waterMat, flowerBush, puddle } from './pecas.js';

const tone = (hex, step = 0.16) => {
  const base = new THREE.Color(hex), c = new THREE.Color();
  return (p) => c.copy(base).offsetHSL(0, 0, Math.floor(p.y / step) % 2 ? -0.02 : 0.015);
};

/**
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../types').LevelLayout} L
 */
export function buildCondominio(kit, root, L) {
  const signs = [];
  const anim = [];
  const water = waterMat();

  // ====================================================== fase 2: área de serviço
  const S = L.SERVICE;
  const Ld = S.laundry;
  kit.add(rb(Ld.w, Ld.h, Ld.d, 0.06, 2), { color: '#f1e3cb', x: Ld.x, z: Ld.z });
  kit.add(rb(Ld.w + 0.2, 0.18, Ld.d + 0.2, 0.04, 1), { color: '#d6c3a5', x: Ld.x, y: Ld.h, z: Ld.z });
  doorAt(kit, { x: Ld.x + 0.9, z: Ld.z + Ld.d / 2, w: 0.9, h: 1.9, color: '#6ec3e8' });
  windowAt(kit, { x: Ld.x - 1.0, y: 1.75, z: Ld.z + Ld.d / 2, w: 1.1, h: 0.7, lit: true });
  kit.add(rb(0.22, 0.14, 0.14, 0.03, 1), { color: '#ffd36a', slot: 'lit', x: Ld.x + 0.9, y: 2.05, z: Ld.z + Ld.d / 2 + 0.1, ao: false });
  const line = (ln, cols) => {
    for (const x of [ln.x0, ln.x1]) kit.add(cyl(0.06, 0.07, 2.1, 8), { color: '#8e5a33', x, z: ln.z });
    kit.add(rod(0.012, ln.x1 - ln.x0, 4).rotateZ(Math.PI / 2), { color: '#4a3426', x: (ln.x0 + ln.x1) / 2, y: 2.0, z: ln.z, ao: false });
    cols.forEach((c, i) => {
      const x = ln.x0 + ((i + 0.5) / cols.length) * (ln.x1 - ln.x0);
      kit.add(rb(0.58, 0.7, 0.04, 0.02, 1), { color: c, x, y: 1.28, z: ln.z, rz: (i % 2 ? 0.05 : -0.04) });
      kit.add(rb(0.05, 0.08, 0.06, 0.01, 1), { color: '#d9dde0', x: x - 0.2, y: 1.98, z: ln.z, ao: false });
    });
  };
  line(S.line, ['#6ec3e8', '#fffaf0', '#ffd15c', '#f28ca2', '#7fa36b', '#fffaf0']);
  // a mureta com o portão de ferro aberto
  const W = S.wall;
  for (const [a, b] of [[W.x0, W.gate.x0], [W.gate.x1, W.x1]]) {
    kit.add(rb(b - a, W.h, 0.3, 0.04, 1), { color: tone('#e2d3ba'), x: (a + b) / 2, z: W.z });
    kit.add(rb(b - a + 0.06, 0.07, 0.38, 0.02, 1), { color: '#c9b597', x: (a + b) / 2, y: W.h, z: W.z });
  }
  const gx = W.gate.x1, gz = W.z;
  const leaf = { dx: -0.55, dz: -1.2 };
  const ll = Math.hypot(leaf.dx, leaf.dz), lry = -Math.atan2(leaf.dz, leaf.dx);
  for (const y of [0.1, 0.62]) kit.add(rb(ll, 0.05, 0.05, 0.01, 1), { color: '#3a3a40', x: gx + leaf.dx / 2, y, z: gz + leaf.dz / 2, ry: lry });
  for (let k = 0; k <= 5; k++) kit.add(rb(0.035, 0.6, 0.035, 0.01, 1), { color: '#3a3a40', x: gx + leaf.dx * (k / 5), y: 0.08, z: gz + leaf.dz * (k / 5) });
  // a tábua de pressão e a roldana que puxa o portão
  const Pk = S.plank;
  kit.add(rb(Pk.w, 0.07, Pk.d, 0.02, 1), { color: '#b77a48', x: Pk.x, z: Pk.z });
  kit.add(cyl(0.05, 0.06, 1.4, 8), { color: '#6b4a34', x: Pk.x + 0.8, z: Pk.z + 0.5 });
  kit.add(new THREE.TorusGeometry(0.12, 0.035, 6, 14), { color: '#9a8f86', x: Pk.x + 0.8, y: 1.42, z: Pk.z + 0.5, ao: false });
  kit.add(rod(0.008, 1.3, 3).rotateZ(1.15), { color: '#c98a55', x: Pk.x + 1.3, y: 1.0, z: Pk.z + 0.35, ao: false });
  // o irrigador de três jatos (gira) e o registro
  const sp = S.sprinkler;
  kit.add(cyl(0.14, 0.18, 0.22, 12), { color: '#2f6fb8', x: sp.x, z: sp.z });
  const sprk = new THREE.Group();
  sprk.position.set(sp.x, 0.26, sp.z);
  const sprMat = new THREE.MeshStandardMaterial({ color: '#d8f2ff', emissive: '#9fd6ef', emissiveIntensity: 0.25, roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false });
  const armMat = new THREE.MeshStandardMaterial({ color: '#d9dde0', roughness: 0.5 });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 6).rotateZ(Math.PI / 2).translate(0.18, 0, 0), armMat);
    arm.rotation.y = a;
    sprk.add(arm);
    // o arco d'água de cada jato
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.36, 0, 0), new THREE.Vector3(1.4, 0.9, 0), new THREE.Vector3(2.4, -0.25, 0));
    const jet = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.06, 6, false), sprMat);
    jet.rotation.y = a;
    sprk.add(jet);
  }
  root.add(sprk);
  anim.push((dt) => { sprk.rotation.y += dt * 1.6; });
  const vl = S.valve;
  kit.add(cyl(0.05, 0.05, 0.45, 8), { color: '#9a8f86', x: vl.x, z: vl.z });
  kit.add(new THREE.TorusGeometry(0.13, 0.03, 6, 14).rotateX(Math.PI / 2), { color: '#d93a3a', x: vl.x, y: 0.47, z: vl.z, ao: false });
  for (const r of [0, Math.PI / 2]) kit.add(rb(0.26, 0.025, 0.025, 0.01, 1), { color: '#d93a3a', x: vl.x, y: 0.46, z: vl.z, ry: r, ao: false });
  // o canal com o vão do meio-fio, o caixote, a bolinha, a caminha, o cesto
  const cn = S.canal;
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(cn.maxX - cn.minX - 0.3, cn.maxZ - cn.minZ - 0.3).rotateX(-Math.PI / 2), water);
  canal.position.set((cn.minX + cn.maxX) / 2, 0.025, (cn.minZ + cn.maxZ) / 2);
  canal.receiveShadow = true;
  root.add(canal);
  kit.add(rb(cn.maxX - cn.minX, 0.12, 0.16, 0.03, 1), { color: '#b7afa6', x: (cn.minX + cn.maxX) / 2, z: cn.maxZ - 0.07 });
  for (const [a, b] of [[cn.minX, cn.slot - 0.45], [cn.slot + 0.45, cn.maxX]]) kit.add(rb(b - a, 0.12, 0.16, 0.03, 1), { color: '#b7afa6', x: (a + b) / 2, z: cn.minZ + 0.07 });
  const cr = S.crate;
  kit.add(rb(cr.s, cr.s * 0.8, cr.s, 0.04, 1), { color: '#c98a55', x: cr.x, z: cr.z });
  for (const y of [0.18, 0.42, 0.66]) kit.add(rb(cr.s + 0.02, 0.05, cr.s + 0.02, 0.015, 1), { color: '#a8703f', x: cr.x, y: y * cr.s, z: cr.z, ao: false });
  kit.add(sphere(0.2, 14, 10), { color: '#d8f065', x: S.ball.x, y: 0.2, z: S.ball.z });
  kit.add(new THREE.TorusGeometry(0.2, 0.012, 4, 20).rotateX(0.6), { color: '#fffaf0', x: S.ball.x, y: 0.2, z: S.ball.z, ao: false });
  const bd = S.bed;
  kit.add(rb(bd.w, 0.16, bd.d, 0.07, 2), { color: '#e8577a', x: bd.x, z: bd.z });
  kit.add(rb(bd.w - 0.16, 0.08, bd.d - 0.16, 0.04, 2), { color: '#f7c3d0', x: bd.x, y: 0.12, z: bd.z });
  kit.add(rb(bd.w, 0.3, 0.12, 0.05, 2), { color: '#e8577a', x: bd.x, z: bd.z - bd.d / 2 + 0.06 });
  const bk = S.basket;
  kit.add(rb(bk.w, 0.4, bk.d, 0.12, 2), { color: '#fffaf0', x: bk.x, z: bk.z });
  kit.add(rb(bk.w * 0.8, 0.14, bk.d * 0.7, 0.06, 2), { color: '#6ec3e8', x: bk.x, y: 0.34, z: bk.z });

  // ====================================================== fase 3: o jardim do lago
  const Y = L.LAKE_YARD;
  const Bd = Y.building;
  const bx0 = Bd.x - Bd.w / 2, bz1 = Bd.z + Bd.d / 2;
  kit.add(rb(Bd.w, Bd.h, Bd.d, 0.08, 2), { color: tone('#f2d9c9', 0.3), x: Bd.x, z: Bd.z });
  kit.add(rb(Bd.w + 0.3, 0.22, Bd.d + 0.3, 0.05, 1), { color: '#c9a48d', x: Bd.x, y: Bd.h, z: Bd.z });
  kit.add(rb(Bd.w + 0.06, 0.12, Bd.d + 0.06, 0.03, 1), { color: '#fffaf0', x: Bd.x, y: 2.3, z: Bd.z, ao: false });
  for (let i = 0; i < 6; i++) {
    const wx = bx0 + 1.0 + i * 2.0;
    if (Math.abs(wx - Y.door.x) > 1.2) windowAt(kit, { x: wx, y: 1.75, z: bz1, w: 0.9, h: 0.8, lit: i % 2 === 0 });
    windowAt(kit, { x: wx, y: 3.85, z: bz1, w: 0.9, h: 0.8, lit: i % 3 === 1 });
  }
  // a porta de vidro de correr, com a luz quente saindo
  kit.add(rb(Y.door.w + 0.2, 2.2, 0.08, 0.02, 1), { color: '#fffaf0', x: Y.door.x, z: bz1 + 0.02 });
  kit.add(slab(Y.door.w, 2.0, 0.03), { color: '#ffe2a0', slot: 'lit', x: Y.door.x, y: 0.05, z: bz1 + 0.07, ao: false });
  kit.add(slab(0.05, 2.0, 0.05), { color: '#fffaf0', x: Y.door.x, y: 0.05, z: bz1 + 0.09, ao: false });
  kit.add(new THREE.CircleGeometry(1.0, 20, 0, Math.PI).rotateX(-Math.PI / 2), { color: '#f7d58a', slot: 'ground', x: Y.door.x, y: 0.012, z: bz1 + 0.05, sz: 0.8 });
  // a cerca-viva com o portão de treliça e as duas lanternas
  const hg = Y.hedge;
  for (const [a, b] of [[hg.x0, hg.gate.x0], [hg.gate.x1, hg.x1]]) {
    const n = Math.max(1, Math.round((b - a - 1.2) / 0.9));
    for (let i = 0; i <= n; i++) {
      const x = a + 0.6 + ((b - a - 1.2) * i) / n;
      kit.add(foliageCluster([{ x: 0, y: 0.45, z: 0, r: 0.55, sx: 1.0, sy: 0.95, sz: 0.55 }], { detail: 1, amp: 0.12, seed: x, dark: '#2f5a28', mid: '#4f8a3e', light: '#79b05a' }), { color: null, slot: 'foliage', x, z: hg.z });
    }
  }
  for (const x of [hg.gate.x0, hg.gate.x1]) {
    kit.add(rb(0.12, 1.7, 0.12, 0.02, 1), { color: '#fffaf0', x: x + (x < hg.gate.x1 ? -0.06 : 0.06), z: hg.z });
    lantern(kit, { x: x + (x < hg.gate.x1 ? -0.18 : 0.18), y: 1.15, z: hg.z + 0.18, post: false });
  }
  const arch = new THREE.TorusGeometry((hg.gate.x1 - hg.gate.x0) / 2, 0.05, 6, 16, Math.PI);
  kit.add(arch, { color: '#fffaf0', x: (hg.gate.x0 + hg.gate.x1) / 2, y: 1.7, z: hg.z });
  // as duas pedras (a pesada e a leve), a mesinha com o lampião
  for (const [i, p] of Y.plates.entries()) {
    kit.add(cyl(p.r, p.r + 0.04, 0.06, 12), { color: i ? '#b7afa6' : '#9a928a', x: p.x, z: p.z });
    kit.add(sphere(p.r * 0.5, 8, 6), { color: '#6f9a4a', x: p.x - p.r * 0.4, y: 0.02, z: p.z + p.r * 0.3, sy: 0.3, ao: false });
  }
  const tb = Y.table;
  kit.add(cyl(tb.r, tb.r, 0.05, 18), { color: '#fffaf0', x: tb.x, y: 0.7, z: tb.z });
  kit.add(cyl(0.05, 0.08, 0.7, 8), { color: '#3a3a40', x: tb.x, z: tb.z });
  lantern(kit, { x: tb.x, y: 0.75, z: tb.z, post: false });
  for (const s of [-1, 1]) {
    kit.add(rb(0.36, 0.05, 0.36, 0.02, 1), { color: '#3a3a40', x: tb.x + s * 0.72, y: 0.42, z: tb.z });
    kit.add(rb(0.05, 0.4, 0.36, 0.02, 1), { color: '#3a3a40', x: tb.x + s * 0.9, y: 0.45, z: tb.z });
  }
  // o lago, as pedras da beira, a ilha da Dona Gansa com a pantufa, a ponte e os aguapés
  const Lk = L.LAKE;
  const lake = new THREE.Mesh(new THREE.CircleGeometry(Lk.r, 40).rotateX(-Math.PI / 2), water);
  lake.position.set(Lk.x, 0.02, Lk.z);
  lake.receiveShadow = true;
  root.add(lake);
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + (i % 3) * 0.02;
    kit.add(new THREE.IcosahedronGeometry(1, 0), { color: i % 3 ? '#b7afa6' : '#a39a90', x: Lk.x + Math.cos(a) * (Lk.r + 0.12), y: 0.02, z: Lk.z + Math.sin(a) * (Lk.r + 0.12), sx: 0.32, sy: 0.18, sz: 0.28, ry: a, ao: false });
  }
  const I = Lk.island;
  kit.add(sphere(I.r, 20, 10), { color: '#8cc65a', x: I.x, y: -0.55, z: I.z, sy: 0.45, ao: false });
  kit.add(boxwood(0.4, 9), { color: null, slot: 'foliage', x: I.x - 0.5, y: 0.08, z: I.z - 0.5 });
  kit.add(sphere(0.32, 14, 10), { color: '#fffdf8', x: I.x + 0.2, y: 0.42, z: I.z + 0.2, sx: 1.3, sz: 0.9 });
  kit.add(cyl(0.07, 0.09, 0.42, 8), { color: '#fffdf8', x: I.x + 0.55, y: 0.5, z: I.z + 0.2, rz: -0.3 });
  kit.add(sphere(0.13, 12, 8), { color: '#fffdf8', x: I.x + 0.66, y: 0.95, z: I.z + 0.2 });
  kit.add(new THREE.ConeGeometry(0.06, 0.18, 8).rotateZ(-Math.PI / 2), { color: '#f08a3c', x: I.x + 0.84, y: 0.93, z: I.z + 0.2, ao: false });
  kit.add(rb(0.34, 0.1, 0.16, 0.05, 2), { color: '#f5a9c4', x: I.x - 0.3, y: 0.28, z: I.z + 0.6, ry: 0.5 });
  kit.add(sphere(0.07, 8, 6), { color: '#fffaf0', x: I.x - 0.18, y: 0.35, z: I.z + 0.66, ao: false });
  const pk = Lk.plank;
  const span = pk.x1 - pk.x0;
  for (let x = pk.x0; x < pk.x1; x += 0.3) {
    const t = (x + 0.13 - pk.x0) / span;
    kit.add(rb(0.26, 0.08, pk.w, 0.02, 1), { color: Math.round(x * 10) % 6 < 3 ? '#c98a55' : '#b77a48', x: x + 0.13, y: 0.12 + Math.sin(t * Math.PI) * 0.22, z: pk.z, ao: false });
  }
  for (const s of [-1, 1]) {
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      kit.add(cyl(0.03, 0.03, 0.45, 6), { color: '#8e5a33', x: pk.x0 + span * t, y: 0.12 + Math.sin(t * Math.PI) * 0.22, z: pk.z + s * (pk.w / 2 - 0.04) });
    }
    const rail = new THREE.QuadraticBezierCurve3(new THREE.Vector3(pk.x0, 0.57, 0), new THREE.Vector3((pk.x0 + pk.x1) / 2, 1.0, 0), new THREE.Vector3(pk.x1, 0.57, 0));
    kit.add(new THREE.TubeGeometry(rail, 10, 0.03, 4, false), { color: '#8e5a33', z: pk.z + s * (pk.w / 2 - 0.04), ao: false });
  }
  for (const [dx, dz] of [[-2.8, 2.6], [2.6, -2.9], [-3.6, -1.4], [1.4, 3.3], [3.2, 1.6]]) {
    kit.add(new THREE.CircleGeometry(0.32, 12, 0.3, Math.PI * 1.8).rotateX(-Math.PI / 2), { color: '#5e9a4a', slot: 'ground', x: Lk.x + dx, y: 0.03, z: Lk.z + dz });
  }
  // os postes do jardim e os cordões de luz em volta do lago
  const G = L.GARDEN_LAMPS;
  for (const [x, z] of G) {
    kit.add(cyl(0.05, 0.06, 2.4, 8), { color: '#3f5a4a', x, z });
    kit.add(sphere(0.18, 12, 10), { color: '#ffd77a', slot: 'lit', x, y: 2.5, z, ao: false });
  }
  const top = (i) => [G[i][0], 2.35, G[i][1]];
  stringLights(kit, [top(0), top(1), top(3), top(2), top(0)], { sag: 0.55, every: 0.55 });
  stringLights(kit, [[hg.gate.x0, 1.7, hg.z], [G[2][0], 2.35, G[2][1]]], { sag: 0.25 });
  stringLights(kit, [[hg.gate.x1, 1.7, hg.z], [G[3][0], 2.35, G[3][1]]], { sag: 0.25 });

  // ====================================================== fase 4: o terraço da torre
  const T = L.TOWER;
  const tg = 'torre';
  const y0 = T.h;
  const tx0 = T.x - T.w / 2, tx1 = T.x + T.w / 2, tz0 = T.z - T.d / 2, tz1 = T.z + T.d / 2;
  const lajota = [new THREE.Color('#d9cbb3'), new THREE.Color('#cfc0a6')];
  kit.add(tiles(T.w - 0.3, T.d - 0.3, 0.6, 0.6, (p) => lajota[Math.abs(Math.floor((p.x + 20) / 0.6) + Math.floor((p.z + 20) / 0.6)) % 2]), { color: null, x: T.x, y: y0 + 0.02, z: T.z, group: tg, ao: false });
  for (const [w, d, x, z] of [[T.w, 0.2, T.x, tz0 + 0.1], [T.w, 0.2, T.x, tz1 - 0.1], [0.2, T.d, tx0 + 0.1, T.z], [0.2, T.d, tx1 - 0.1, T.z]]) {
    kit.add(rb(w, 0.55, d, 0.04, 1), { color: '#e2d3ba', x, y: y0, z, group: tg });
  }
  // a casa da escada (noroeste), as espreguiçadeiras
  kit.add(rb(1.5, 1.8, 1.3, 0.06, 2), { color: '#efe2cc', x: tx0 + 1.0, y: y0, z: tz0 + 0.9, group: tg });
  kit.add(rb(1.7, 0.12, 1.5, 0.03, 1), { color: '#c98a55', x: tx0 + 1.0, y: y0 + 1.8, z: tz0 + 0.9, group: tg });
  doorAt(kit, { x: tx0 + 1.0, z: tz0 + 1.55, w: 0.7, h: 1.5, color: '#a0603a', group: tg });
  for (const [k, c] of /** @type {[number, string][]} */ ([[0, '#6ec3e8'], [1, '#ffd15c']])) {
    const cx = tx0 + 0.75 + k * 0.85, cz = tz0 + 3.3;
    kit.add(rb(0.55, 0.06, 1.3, 0.02, 1), { color: (p) => new THREE.Color(Math.floor((p.z + 9) / 0.22) % 2 ? c : '#fffaf0'), x: cx, y: y0 + 0.25, z: cz, group: tg });
    kit.add(rb(0.55, 0.06, 0.5, 0.02, 1).translate(0, 0, -0.25), { color: c, x: cx, y: y0 + 0.3, z: cz - 0.6, rx: 0.9, group: tg });
    for (const t of [-0.5, 0.5]) kit.add(rb(0.5, 0.25, 0.04, 0.01, 1), { color: '#fffaf0', x: cx, y: y0, z: cz + t, group: tg });
  }
  // a fileira de floreiras com um vão só (onde o pombo cochila)
  const fx = T.x - 0.9;
  const ger = flowerBush({ r: 0.17, seed: 7, flower: '#ff6a55' });
  for (const [a, b] of [[tz0 + 0.25, T.z - 0.25], [T.z + 0.45, tz1 - 0.25]]) {
    kit.add(rb(0.38, 0.4, b - a, 0.04, 1), { color: '#a0603a', x: fx, y: y0, z: (a + b) / 2, group: tg });
    for (let z = a + 0.25; z < b - 0.1; z += 0.45) kit.add(ger, { color: null, slot: 'foliage', x: fx, y: y0 + 0.36, z, group: tg });
  }
  kit.add(sphere(0.14, 10, 8), { color: '#a7a9b5', x: fx, y: y0 + 0.15, z: T.z + 0.1, sx: 1.3, group: tg });
  // o ventilador industrial no trilho, os aparelhos de ar e o duto por cima da mureta
  for (const s of [-0.18, 0.18]) kit.add(rb(0.04, 0.04, 2.2, 0.01, 1), { color: '#9a8f86', x: T.x + 0.4 + s, y: y0, z: T.z - 1.6, group: tg, ao: false });
  kit.add(rb(0.5, 0.5, 0.4, 0.04, 1), { color: '#3a3a40', x: T.x + 0.4, y: y0 + 0.02, z: T.z - 2.0, group: tg });
  kit.add(new THREE.TorusGeometry(0.42, 0.05, 8, 20).rotateY(Math.PI / 2), { color: '#3a3a40', x: T.x + 0.4, y: y0 + 0.95, z: T.z - 2.0, group: tg });
  for (let k = 0; k < 4; k++) kit.add(rb(0.03, 0.34, 0.12, 0.01, 1), { color: '#d9dde0', x: T.x + 0.42, y: y0 + 0.95, z: T.z - 2.0, rx: (k / 4) * Math.PI * 2, group: tg, ao: false });
  for (const [dz, k] of [[-1.0, 0], [0.2, 1]]) {
    kit.add(rb(0.9, 0.55, 0.6, 0.06, 1), { color: '#d9dde0', x: T.x + 1.5, y: y0, z: T.z + dz, group: tg });
    kit.add(cyl(0.18, 0.18, 0.03, 14).rotateZ(Math.PI / 2), { color: '#9a8f86', x: T.x + 1.96, y: y0 + 0.28, z: T.z + dz, group: tg, ao: false });
    void k;
  }
  const duct = new THREE.CatmullRomCurve3([new THREE.Vector3(T.x + 0.4, y0 + 1.0, T.z - 1.5), new THREE.Vector3(T.x + 1.0, y0 + 1.3, T.z - 1.2), new THREE.Vector3(T.x + 2.3, y0 + 1.3, T.z - 1.0), new THREE.Vector3(T.x + 2.6, y0 + 0.9, T.z - 0.6)]);
  kit.add(new THREE.TubeGeometry(duct, 16, 0.1, 8, false), { color: '#c9d2dc', group: tg, ao: false });
  // a mureta com o portão e o cantinho dos pombos: a bacia com o patinho, os poleiros, a caixa d'água
  const mx = tx1 - 1.1;
  for (const [a, b] of [[tz0 + 0.2, T.z + 0.1], [T.z + 0.9, tz1 - 0.2]]) kit.add(rb(0.16, 0.9, b - a, 0.03, 1), { color: '#e2d3ba', x: mx, y: y0, z: (a + b) / 2, group: tg });
  kit.add(rb(0.04, 0.7, 0.7, 0.01, 1), { color: '#3a3a40', x: mx + 0.35, y: y0 + 0.05, z: T.z + 0.85, ry: 1.2, group: tg, ao: false });
  kit.add(cyl(0.38, 0.3, 0.16, 16), { color: '#9fb6c2', x: tx1 - 0.55, y: y0, z: T.z + 1.9, group: tg });
  kit.add(cyl(0.32, 0.32, 0.02, 16), { color: '#8ec9ea', slot: 'glass', x: tx1 - 0.55, y: y0 + 0.15, z: T.z + 1.9, group: tg, ao: false });
  kit.add(sphere(0.12, 12, 10), { color: '#ffd33f', x: tx1 - 0.55, y: y0 + 0.24, z: T.z + 1.9, group: tg });
  kit.add(sphere(0.07, 10, 8), { color: '#ffd33f', x: tx1 - 0.48, y: y0 + 0.36, z: T.z + 1.85, group: tg });
  for (const [pz, sign] of [[T.z - 0.6, false], [T.z + 0.6, true]]) {
    kit.add(cyl(0.035, 0.035, 1.0, 6), { color: '#8e5a33', x: tx1 - 0.5, y: y0, z: pz, group: tg });
    kit.add(rod(0.025, 0.6, 6).rotateX(Math.PI / 2), { color: '#8e5a33', x: tx1 - 0.5, y: y0 + 1.0, z: pz, group: tg });
    if (sign) kit.add(rb(0.04, 0.22, 0.32, 0.01, 1), { color: '#ffd15c', x: tx1 - 0.44, y: y0 + 0.55, z: pz, group: tg, ao: false });
  }
  for (const [x, y, z, ry] of [[tx1 - 0.5, y0 + 1.1, T.z - 0.75, 0.4], [tx1 - 0.5, y0 + 1.1, T.z + 0.45, -0.8], [T.x + 0.2, y0 + 0.62, tz1 - 0.1, 2.2]]) {
    kit.add(sphere(0.15, 10, 8), { color: '#a7a9b5', x, y, z, sx: 1.4, group: tg });
    kit.add(sphere(0.085, 10, 8), { color: '#8d90a0', x: x + Math.cos(ry) * 0.18, y: y + 0.11, z: z - Math.sin(ry) * 0.18, group: tg });
  }
  kit.add(cyl(0.7, 0.7, 1.2, 18), { color: '#9fb6c2', x: tx1 - 0.85, y: y0 + 0.3, z: tz0 + 0.85, group: tg });
  kit.add(cyl(0.76, 0.76, 0.1, 18), { color: '#7f98a6', x: tx1 - 0.85, y: y0 + 1.5, z: tz0 + 0.85, group: tg });
  for (const s of [-1, 1]) kit.add(cyl(0.05, 0.05, 0.4, 6), { color: '#7f98a6', x: tx1 - 0.85 + s * 0.45, y: y0, z: tz0 + 0.85, group: tg });

  // ====================================================== fase 6: a oficina de brinquedos
  const B = L.TOYHOUSE;
  const tz1h = B.z + B.d / 2;
  // o feltro verde dentro do trilho
  kit.add(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), { color: '#4f8a5e', slot: 'ground', x: B.x, y: 0.009, z: B.z, sx: B.track.rx + 0.55, sz: B.track.rz + 0.55 });
  const roofStripes = (p, n) => new THREE.Color(n.y < -0.5 ? '#fff3dc' : Math.floor((p.x + 10) / 0.62) % 2 ? '#f08a3c' : '#ffd15c');
  openHouse(kit, {
    x: B.x, z: B.z, w: B.w, d: B.d, h: B.h, low: 0.85, wall: '#fff3dc', inside: '#e6f2f8', floor: (p) => new THREE.Color((Math.floor((p.x + 20) / 0.5) + Math.floor((p.z + 20) / 0.5)) % 2 ? '#d9b98a' : '#cfa978'),
    floorCell: [0.5, 0.5], door: { x: B.x, w: 1.1 }, windows: [B.x - 1.4, B.x + 1.4], roof: { kind: 'gable', h: 1.2, color: roofStripes, open: 0.8, over: 0.35 },
  });
  // dentro: a bancada com ferramentas, a estante de brinquedos, o baú
  const bz0 = B.z - B.d / 2;
  kit.add(rb(2.2, 0.8, 0.6, 0.03, 1), { color: '#c98a55', x: B.x - 1.1, y: 0.06, z: bz0 + 0.48 });
  kit.add(rb(0.3, 0.06, 0.08, 0.01, 1), { color: '#d93a3a', x: B.x - 1.5, y: 0.87, z: bz0 + 0.5, ry: 0.4, ao: false });
  kit.add(cyl(0.05, 0.05, 0.12, 8), { color: '#ffd15c', x: B.x - 0.8, y: 0.86, z: bz0 + 0.45, ao: false });
  kit.add(rb(1.4, 1.6, 0.4, 0.03, 1), { color: '#fffaf0', x: B.x + 1.5, y: 0.06, z: bz0 + 0.36 });
  ['#e8577a', '#6ec3e8', '#ffd15c', '#7fd36b', '#9677c6', '#f08a3c'].forEach((c, i) => kit.add(rb(0.3, 0.3, 0.3, 0.05, 1), { color: c, x: B.x + 1.0 + (i % 3) * 0.48, y: 0.5 + Math.floor(i / 3) * 0.55, z: bz0 + 0.42, ry: i * 0.2, ao: false }));
  kit.add(rb(0.9, 0.5, 0.55, 0.06, 2), { color: '#7fa36b', x: B.x + 1.6, y: 0.06, z: B.z + 0.9 });
  // a placa na parede do fundo, entre as janelas (vista por cima da parede cortada)
  const sign = textPlate('BRINQUEDOTECA', 1.7, 0.34, { bg: '#e8577a' });
  sign.mesh.position.set(B.x, B.h - 0.42, bz0 + 0.19);
  root.add(sign.mesh);
  signs.push(sign);
  // o trilho em elipse: dormentes e dois trilhos
  const trackPoint = (t) => {
    const x = B.x + Math.cos(t) * B.track.rx, z = B.z + Math.sin(t) * B.track.rz;
    const dx = -Math.sin(t) * B.track.rx, dz = Math.cos(t) * B.track.rz;
    return { x, z, yaw: Math.atan2(dx, dz) };
  };
  const N = 56;
  for (let i = 0; i < N; i++) {
    const p = trackPoint((i / N) * Math.PI * 2);
    kit.add(slab(0.62, 0.05, 0.14), { color: '#8e5a33', x: p.x, y: 0.012, z: p.z, ry: p.yaw + Math.PI / 2, ao: false });
  }
  for (const s of [-0.22, 0.22]) {
    const ell = new THREE.EllipseCurve(0, 0, B.track.rx + s, B.track.rz + s, 0, Math.PI * 2);
    const pts = ell.getPoints(72).map((p) => new THREE.Vector3(p.x, 0, p.y));
    kit.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.03, 5, true), { color: '#c98a55', x: B.x, y: 0.09, z: B.z, ao: false });
  }
  // a estação (na frente), a cancela (oeste) e o pórtico com a lua (leste)
  const st = B.station;
  kit.add(rb(st.w, 0.14, st.d, 0.02, 1), { color: '#d9cfc2', x: st.x, z: st.z });
  for (const s of [-1, 1]) kit.add(cyl(0.03, 0.03, 0.8, 6), { color: '#e8577a', x: st.x + s * (st.w / 2 - 0.1), y: 0.14, z: st.z });
  kit.add(gableRoof(st.w + 0.2, st.d + 0.2, 0.22), { color: '#e8577a', x: st.x, y: 0.94, z: st.z });
  const wP = trackPoint(Math.PI);
  // a cancela levantada, do lado de fora do trilho (dentro do colisor do trilho)
  kit.add(rb(0.12, 0.5, 0.12, 0.02, 1), { color: '#fffaf0', x: wP.x - 0.31, z: wP.z + 0.4 });
  kit.add(rb(0.04, 0.95, 0.06, 0.01, 1), { color: (p) => new THREE.Color(Math.floor((p.y + 10) / 0.16) % 2 ? '#d93a3a' : '#fffaf0'), x: wP.x - 0.31, y: 0.46, z: wP.z + 0.4, rx: -0.35, ao: false });
  const eP = trackPoint(0);
  for (const s of [-1, 1]) kit.add(rb(0.08, 1.5, 0.1, 0.02, 1), { color: '#9677c6', x: eP.x + s * 0.33, z: eP.z });
  kit.add(rb(0.84, 0.12, 0.14, 0.02, 1), { color: '#9677c6', x: eP.x, y: 1.5, z: eP.z });
  kit.add(cyl(0.006, 0.006, 0.35, 3), { color: '#4a3426', x: eP.x, y: 1.15, z: eP.z, ao: false });
  kit.add(new THREE.TorusGeometry(0.22, 0.07, 8, 16, Math.PI * 1.25).rotateZ(-0.6), { color: '#ffd15c', x: eP.x, y: 0.98, z: eP.z, ao: false });
  // o foguete de dois berços no tapete
  const rk = B.rocket;
  kit.add(cyl(0.75, 0.75, 0.02, 24), { color: '#f08a3c', slot: 'ground', x: rk.x, y: 0.01, z: rk.z });
  kit.add(cyl(0.28, 0.32, 1.3, 16), { color: '#fffaf0', x: rk.x, y: 0.12, z: rk.z });
  for (const y of [0.35, 0.95]) kit.add(cyl(0.3, 0.3, 0.1, 16), { color: '#d93a3a', x: rk.x, y, z: rk.z, ao: false });
  kit.add(new THREE.ConeGeometry(0.28, 0.5, 16), { color: '#d93a3a', x: rk.x, y: 1.67, z: rk.z });
  kit.add(cyl(0.1, 0.1, 0.03, 12).rotateX(Math.PI / 2), { color: '#9fd6ef', slot: 'glass', x: rk.x, y: 1.1, z: rk.z + 0.3, ao: false });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    kit.add(rb(0.04, 0.42, 0.3, 0.01, 1), { color: '#d93a3a', x: rk.x + Math.cos(a) * 0.32, y: 0.12, z: rk.z + Math.sin(a) * 0.32, ry: -a });
  }
  for (const [a, c] of /** @type {[number, string][]} */ ([[2.6, '#6ec3e8'], [3.7, '#f7c3d0']])) {
    kit.add(cyl(0.13, 0.1, 0.12, 12), { color: c, x: rk.x + Math.cos(a) * 0.5, y: 0.62, z: rk.z + Math.sin(a) * 0.5, ao: false });
  }

  // ====================================================== fase 7: a pracinha depois da chuva
  const P = L.PLAYGROUND;
  const Yd = P.yard;
  // o piso emborrachado (placas em três cores suaves)
  const rub = ['#d98b73', '#8fbf8a', '#86b9d6'].map((c) => new THREE.Color(c));
  kit.add(tiles(Yd.maxX - Yd.minX, Yd.maxZ - Yd.minZ, 1.0, 1.0, (p) => rub[Math.abs(Math.floor((p.x + 50) / 1.0) + 2 * Math.floor((p.z + 50) / 1.0)) % 3]), { color: null, slot: 'ground', x: (Yd.minX + Yd.maxX) / 2, y: 0.022, z: (Yd.minZ + Yd.maxZ) / 2 });
  // a cerca de lápis de cor, com o portão (ao sul, aberto)
  pencilFence(kit, { x0: Yd.minX, z0: Yd.minZ, x1: Yd.maxX, z1: Yd.minZ, seed: 0 });
  pencilFence(kit, { x0: Yd.maxX, z0: Yd.minZ, x1: Yd.maxX, z1: Yd.maxZ, seed: 2 });
  pencilFence(kit, { x0: Yd.minX, z0: Yd.maxZ, x1: P.gate.x0 - 0.08, z1: Yd.maxZ, seed: 4 });
  pencilFence(kit, { x0: P.gate.x1 + 0.08, z0: Yd.maxZ, x1: Yd.maxX, z1: Yd.maxZ, seed: 1 });
  pencilFence(kit, { x0: Yd.minX, z0: Yd.minZ, x1: Yd.minX, z1: Yd.maxZ, seed: 3 });
  pencilFence(kit, { x0: P.gate.x0, z0: Yd.maxZ, x1: P.gate.x0 + 0.45, z1: Yd.maxZ + 1.25, h: 0.75, seed: 2 });
  // o morrinho com a manilha (o túnel, com lama no fundo)
  const hl = P.hill;
  kit.add(sphere(1, 20, 12), { color: '#7db356', x: hl.x, y: -0.1, z: hl.z, sx: hl.r * 0.96, sy: 1.2, sz: 1.35 });
  kit.add(new THREE.CylinderGeometry(0.42, 0.42, 3.2, 16, 1, true).rotateX(Math.PI / 2), { color: '#b7afa6', x: hl.x, y: 0.42, z: hl.z });
  for (const s of [-1, 1]) {
    kit.add(new THREE.TorusGeometry(0.42, 0.06, 6, 18), { color: '#a39a90', x: hl.x, y: 0.42, z: hl.z + s * 1.6, ao: false });
    // o escuro de dentro do túnel e a lama na saída
    kit.add(new THREE.CircleGeometry(0.4, 18).rotateY(s > 0 ? 0 : Math.PI), { color: '#3a3330', x: hl.x, y: 0.42, z: hl.z + s * 1.4, ao: false });
    kit.add(new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2), { color: '#7a5434', slot: 'ground', x: hl.x, y: 0.03, z: hl.z + s * 2.0, sz: 0.75 });
  }
  // o escorregador com casinha (e o frisbee lá em cima), o balanço
  const sl = P.slide;
  kit.add(rb(1.0, 1.7, 1.0, 0.06, 1), { color: '#6ec3e8', x: sl.x, z: sl.z });
  kit.add(rb(1.2, 0.12, 1.2, 0.04, 1), { color: '#e8577a', x: sl.x, y: 1.7, z: sl.z });
  kit.add(new THREE.ConeGeometry(0.85, 0.7, 4).rotateY(Math.PI / 4), { color: '#ffd15c', x: sl.x, y: 2.75, z: sl.z });
  for (const s of [-0.45, 0.45]) kit.add(cyl(0.04, 0.04, 1.3, 6), { color: '#fffaf0', x: sl.x + s, y: 1.82, z: sl.z });
  // a prancha do escorregador desce para o sul, com os corrimãos
  kit.add(rb(0.62, 0.05, 2.4, 0.02, 1), { color: '#e8577a', x: sl.x, y: 0.93, z: sl.z + 1.4, rx: 0.62 });
  for (const s of [-1, 1]) kit.add(rb(0.05, 0.14, 2.4, 0.02, 1), { color: '#f28ca2', x: sl.x + s * 0.31, y: 0.97, z: sl.z + 1.4, rx: 0.62, ao: false });
  kit.add(cyl(0.2, 0.2, 0.04, 16), { color: '#f28ca2', x: sl.x + 0.2, y: 1.86, z: sl.z - 0.1, ao: false });
  for (let k = 0; k < 5; k++) kit.add(rb(0.7, 0.05, 0.1, 0.015, 1), { color: '#fffaf0', x: sl.x, y: 0.3 + k * 0.32, z: sl.z - 0.6 - k * 0.04, rx: -0.2, ao: false });
  const sw = P.swing;
  // o cavalete em A: as pernas de cada lado se encontram na trave
  for (const s of [-1, 1]) for (const t of [-1, 1]) kit.add(cyl(0.05, 0.05, 2.25, 8), { color: '#8e5a33', x: sw.x + s * 1.0, z: sw.z + t * 0.45, rx: -t * 0.2 });
  kit.add(rod(0.06, 2.2, 10).rotateZ(Math.PI / 2), { color: '#8e5a33', x: sw.x, y: 2.2, z: sw.z });
  for (const k of [-0.45, 0.45]) {
    for (const t of [-0.18, 0.18]) kit.add(cyl(0.01, 0.01, 1.7, 4), { color: '#4a3426', x: sw.x + k + t, y: 0.48, z: sw.z, ao: false });
    kit.add(rb(0.44, 0.05, 0.22, 0.02, 1), { color: k < 0 ? '#ffd15c' : '#6ec3e8', x: sw.x + k, y: 0.46, z: sw.z, ao: false });
  }
  // a gangorra, a caixa de areia com o baldinho e a pazinha, a joaninha de mola, a bolinha
  const ss = P.seesaw;
  kit.add(rb(0.3, 0.4, 0.3, 0.04, 1), { color: '#9677c6', x: ss.x, z: ss.z });
  const tilt = 0.22;
  kit.add(rb(ss.len, 0.08, 0.3, 0.03, 1).translate(0, -0.04, 0), { color: '#ffd15c', x: ss.x, y: 0.44, z: ss.z, rz: tilt });
  // as alças presas na prancha (acompanham a inclinação)
  for (const s of [-1, 1]) {
    const d = s * (ss.len / 2 - 0.32);
    kit.add(new THREE.TorusGeometry(0.1, 0.02, 4, 10, Math.PI).rotateY(Math.PI / 2), { color: '#d93a3a', x: ss.x + d * Math.cos(tilt), y: 0.48 + d * Math.sin(tilt), z: ss.z, ao: false });
  }
  const sb = P.sandbox;
  for (const [dx, dz, w, d] of [[0, -sb.s / 2, sb.s, 0.12], [0, sb.s / 2, sb.s, 0.12], [-sb.s / 2, 0, 0.12, sb.s], [sb.s / 2, 0, 0.12, sb.s]]) kit.add(rb(w, 0.25, d, 0.03, 1), { color: '#c98a55', x: sb.x + dx, z: sb.z + dz });
  kit.add(slab(sb.s - 0.12, 0.16, sb.s - 0.12), { color: '#f0d9a6', slot: 'ground', x: sb.x, z: sb.z });
  kit.add(cyl(0.12, 0.1, 0.18, 10), { color: '#6ec3e8', x: P.bucket.x, y: 0.16, z: P.bucket.z });
  kit.add(rb(0.05, 0.28, 0.1, 0.02, 1), { color: '#ffd15c', x: P.bucket.x + 0.15, y: 0.16, z: P.bucket.z + 0.12, rz: 0.5, ao: false });
  const lb = P.ladybug;
  for (let k = 0; k < 4; k++) kit.add(new THREE.TorusGeometry(0.08, 0.025, 4, 10).rotateX(Math.PI / 2), { color: '#9a8f86', x: lb.x, y: 0.08 + k * 0.07, z: lb.z, ao: false });
  kit.add(sphere(0.34, 16, 12), { color: '#d93a3a', x: lb.x, y: 0.55, z: lb.z, sy: 0.7 });
  kit.add(sphere(0.18, 12, 10), { color: '#2b2b30', x: lb.x + 0.34, y: 0.6, z: lb.z });
  for (const [dx, dz] of [[-0.12, 0.18], [0.1, -0.2], [-0.05, -0.08], [0.12, 0.12]]) kit.add(sphere(0.06, 8, 6), { color: '#2b2b30', x: lb.x + dx, y: 0.77, z: lb.z + dz, sy: 0.4, ao: false });
  kit.add(sphere(0.14, 14, 10), { color: '#d8f065', x: P.ball.x, y: 0.15, z: P.ball.z, ao: false });
  // as poças (e a lama) no gramado, a toalha do piquenique com a cesta
  // as poças: dentro do parquinho em cima do piso emborrachado (0,022 m), fora dele na grama
  P.puddles.forEach((pd, i) => {
    const inYard = pd.x > Yd.minX && pd.x < Yd.maxX && pd.z > Yd.minZ && pd.z < Yd.maxZ;
    puddle(kit, { x: pd.x, z: pd.z, r: pd.r, y: inYard ? 0.024 : 0, seed: i * 2.7 + 1 });
  });
  const tw = P.towel;
  const xad = [new THREE.Color('#e8577a'), new THREE.Color('#fffaf0')];
  kit.add(tiles(1.8, 1.3, 0.2, 0.2, (p) => xad[Math.abs(Math.floor((p.x + 5) / 0.2) + Math.floor((p.z + 5) / 0.2)) % 2]), { color: null, slot: 'ground', x: tw.x, y: 0.03, z: tw.z });
  const bs = P.basket;
  kit.add(cyl(0.24, 0.2, 0.3, 14), { color: '#c99a5e', x: bs.x, z: bs.z });
  kit.add(new THREE.TorusGeometry(0.2, 0.025, 4, 14, Math.PI), { color: '#a87a52', x: bs.x, y: 0.3, z: bs.z, ao: false });
  kit.add(sphere(0.07, 8, 6), { color: '#d93a3a', x: bs.x + 0.05, y: 0.34, z: bs.z, ao: false });
  kit.add(cyl(0.16, 0.16, 0.02, 14), { color: '#f28ca2', x: tw.x - 0.5, y: 0.03, z: tw.z + 0.25, ao: false });

  return {
    signs, trackPoint,
    update(dt, t) {
      for (const f of anim) f(dt, t);
    },
  };
}
