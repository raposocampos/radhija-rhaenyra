// FASE 3 · Jardim: cerca-viva A|B (com jasmim), cantinho com túnel baixo (só a Radhija passa),
// mesa de jardim com cadeiras e lamparina, bordas fora dos limites (sebes, vasos, bancos, postes)
// e balizadores baixos no gramado sul. Tudo que é sólido coincide com um colisor ou fica fora dos limites.
import * as THREE from 'three';
import {
  rng, paint, mergeGeometries, foliageCluster, addFoliageWind, leafSkin, mat, woodMat, stdMat, ironMat, brassMat,
  terracottaMat, glazeMat, rbox, potProfile, soilDisc, contactShadow, speckleTexture,
} from '../../../world/util.js';
import { lavender, geranium, boxwood, smallFlowers } from '../../../world/plants.js';

export const f3HedgeMat = () => mat('f3-hedge', () => addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { amp: 0.006, freq: 1.1 }));
export const f3LeafMat = () => mat('f3-leaf', () => addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), { amp: 0.012, freq: 1.4 }));
export const f3PlantMat = () => mat('f3-plant', () => addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide }), { amp: 0.016, freq: 1.5 }));
const soilMat = () => mat('f3-soil', () => new THREE.MeshStandardMaterial({ color: '#3d2c1e', roughness: 1, map: speckleTexture() }));

const HEDGE_COL = { dark: '#1c3517', mid: '#33552a', light: '#6d8c46', sunBias: 0.55 };

function pot({ r, h, material, seed = 1, foot = 0.72, belly = 1.0 }) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry(potProfile(r, h, { foot, belly }), 28), material));
  const soil = new THREE.Mesh(soilDisc(r * 0.88, seed), soilMat());
  soil.position.y = h * 0.9;
  g.add(soil);
  g.userData.top = h * 0.9;
  return g;
}

/**
 * Faixa de cerca-viva ao longo de um segmento: muitos tufos arredondados de tamanhos variados,
 * espalhados no volume (copa irregular no topo, laterais "estufadas"), como as sebes da fase 1.
 */
/**
 * @param {object[]} list
 * @param {{ ax: number, az: number, bx: number, bz: number, height: number, half: number, r: () => number,
 *           taper?: (x: number, z: number, h: number) => number, spacing?: number }} opts
 */
function hedgeBlobs(list, { ax, az, bx, bz, height, half, r, taper, spacing = 0.1 }) {
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len, uz = (bz - az) / len;
  const px = -uz, pz = ux;
  const n = Math.max(2, Math.round(len / spacing));
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, (i + r()) / n);
    const x0 = ax + (bx - ax) * t, z0 = az + (bz - az) * t;
    const h = (taper ? taper(x0, z0, height) : height) * (0.95 + r() * 0.08);
    const rad = Math.min(half * (0.78 + r() * 0.3), h * 0.42);
    const across = (r() - 0.5) * 2 * Math.max(0, half - rad * 0.88);
    const top = r() < 0.5;
    const y = top ? h - rad * (0.8 + r() * 0.3) : rad * 0.75 + r() * Math.max(0, h - rad * 2.0);
    list.push({ x: x0 + px * across, y, z: z0 + pz * across, r: rad, sy: 0.85 + r() * 0.3, sx: 0.9 + r() * 0.2, sz: 0.9 + r() * 0.2 });
    // raminhos soltos escapando da copa (quebram a silhueta)
    if (r() < 0.12) list.push({ x: x0 + px * (r() - 0.5) * half, y: h - rad * 0.2, z: z0 + pz * (r() - 0.5) * half, r: rad * 0.45, sy: 1.1 });
  }
}

export function buildGarden(layout) {
  const group = new THREE.Group();
  group.name = 'jardim';
  const r = rng(808);
  const { HEDGE_AB, NOOK, GATE } = layout;
  const B = layout.WORLD.bounds;
  const lights = {};

  // ------------------------------------------------ cerca-viva A|B (0.9 m), com jasmim branco
  const hedgeAB = new THREE.Group();
  hedgeAB.name = 'cerca-viva-AB';
  {
    const blobs = [];
    const X = HEDGE_AB.x, hx = HEDGE_AB.hx, H = HEDGE_AB.height;
    hedgeBlobs(blobs, { ax: X, az: HEDGE_AB.segments[0].zMin + 0.05, bx: X, bz: GATE.latchPost.z - 0.04, height: H, half: hx, r });
    // trecho sul do portão: baixa para ≤ 0.6 m no primeiro plano (z > 3.7) e segue até fora dos limites
    hedgeBlobs(blobs, {
      ax: X, az: GATE.hinge.z + 0.04, bx: X, bz: B.maxZ + 0.9, height: H, half: hx, r,
      taper: (x, z) => (z < 3.75 ? H : 0.58),
    });
    const geo = foliageCluster(blobs, { detail: 2, amp: 0.3, freq: 9.0, seed: 21, ...HEDGE_COL });
    const mesh = new THREE.Mesh(geo, f3HedgeMat());
    mesh.castShadow = true; mesh.receiveShadow = true;
    hedgeAB.add(mesh);
    hedgeAB.add(leafSkin(geo, { count: 13000, size: 0.085, seed: 5, material: f3LeafMat(), minNormalY: -0.35 }));
    // jasmim (florzinhas brancas que brilham ao luar)
    const fl = [];
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i += 5) if (nor.getY(i) > 0.1 && r() < 0.3) fl.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    const fGeo = new THREE.IcosahedronGeometry(0.018, 0); fGeo.scale(1, 0.55, 1); paint(fGeo, '#ffffff');
    const fim = new THREE.InstancedMesh(fGeo, mat('f3-jasmine', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#c9d4ff', emissiveIntensity: 0.18 })), fl.length);
    const m4 = new THREE.Matrix4();
    fl.forEach(([x, y, z], i) => { m4.makeTranslation(x, y + 0.008, z); fim.setMatrixAt(i, m4); });
    hedgeAB.add(fim);
  }
  group.add(hedgeAB);

  // ------------------------------------------------ cantinho: cerca-viva baixa (0.7 m) com túnel no vão
  const nook = new THREE.Group();
  nook.name = 'cantinho';
  {
    const blobs = [];
    const t = 0.125, H = NOOK.hedgeHeight;
    const wx = NOOK.minX - t;
    hedgeBlobs(blobs, { ax: wx, az: NOOK.minZ + 0.05, bx: wx, bz: NOOK.gap.z, height: H, half: t * 1.05, r, spacing: 0.08 });
    const sz = NOOK.gap.z;
    // as fileiras das pontas param 0,15 m antes do vão: os tufos (até ~0,2 m do centro) terminam na beira dele, e a
    // Radhija passa pelo vão sem atravessar folhagem (o vão do colisor é o mesmo)
    hedgeBlobs(blobs, { ax: wx, az: sz, bx: NOOK.gap.xMin - 0.15, bz: sz, height: H, half: t * 1.05, r, spacing: 0.08 });
    hedgeBlobs(blobs, { ax: NOOK.gap.xMax + 0.15, az: sz, bx: NOOK.maxX + 0.05, bz: sz, height: H, half: t * 1.05, r, spacing: 0.08 });
    // arco folhoso sobre o vão: folhagem só acima de ~0.42 m (a Rhaenyra não cabe; a Radhija passa por baixo)
    const gx0 = NOOK.gap.xMin, gx1 = NOOK.gap.xMax;
    for (let k = 0; k <= 6; k++) {
      const x = gx0 - 0.02 + (gx1 - gx0 + 0.04) * (k / 6);
      blobs.push({ x, y: 0.56 + r() * 0.06, z: sz + (r() - 0.5) * 0.06, r: 0.1 + r() * 0.04, sy: 0.9 });
    }
    const geo = foliageCluster(blobs, { detail: 2, amp: 0.3, freq: 11.0, seed: 33, ...HEDGE_COL });
    const mesh = new THREE.Mesh(geo, f3HedgeMat());
    mesh.castShadow = true; mesh.receiveShadow = true;
    nook.add(mesh);
    nook.add(leafSkin(geo, { count: 4200, size: 0.07, seed: 8, material: f3LeafMat(), minNormalY: -0.35 }));
  }
  group.add(nook);

  // ------------------------------------------------ mesa de jardim redonda com 3 cadeiras e lamparina
  const table = new THREE.Group();
  table.name = 'mesa-jardim';
  {
    const c = layout.STATIC_COLLIDERS.find((cc) => cc.id === 'mesa-jardim');
    table.position.set(c.x, 0, c.z);
    const iron = stdMat('#2b3836', { roughness: 0.45, metalness: 0.55 });
    const topMat = woodMat('#9a6a45', { key: 'f3-table-top', rough: 0.6 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.035, 40), topMat);
    top.position.y = 0.72;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.012, 6, 40), iron);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.72;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.7, 10), iron);
    stem.position.y = 0.36;
    table.add(top, rim, stem);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(Math.cos(a) * 0.14, 0.12, Math.sin(a) * 0.14), new THREE.Vector3(Math.cos(a) * 0.3, 0.01, Math.sin(a) * 0.3),
      ]), 12, 0.014, 6), iron);
      table.add(leg);
    }
    // cadeiras bistrô (dentro do raio do colisor)
    const seatMat = woodMat('#a87a52', { key: 'f3-chair', rough: 0.65 });
    for (const a of [0.5, 2.55, 4.4]) {
      const ch = new THREE.Group();
      const rr = 0.56;
      ch.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      ch.rotation.y = -a - Math.PI / 2;
      const seat = new THREE.Mesh(rbox(0.36, 0.03, 0.34, 0.012), seatMat);
      seat.position.y = 0.45;
      ch.add(seat);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.45, 6), iron);
        leg.position.set(sx * 0.15, 0.225, sz * 0.14);
        leg.rotation.set(sz * 0.06, 0, -sx * 0.06);
        ch.add(leg);
      }
      // encosto em ripas curvas (atrás = +Z local, longe da mesa)
      for (let k = 0; k < 4; k++) {
        const sl = new THREE.Mesh(rbox(0.34, 0.035, 0.02, 0.008), seatMat);
        sl.position.set(0, 0.56 + k * 0.08, 0.17 + k * 0.012);
        sl.rotation.x = -0.12;
        ch.add(sl);
      }
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.42, 6), iron);
        post.position.set(sx * 0.16, 0.66, 0.18);
        post.rotation.x = -0.12;
        ch.add(post);
      }
      table.add(ch);
    }
    // lamparina (vidro + vela) e xícaras
    const lantern = new THREE.Group();
    lantern.position.set(0.05, 0.74, -0.05);
    const glassMat = new THREE.MeshStandardMaterial({ color: '#fff4e0', emissive: '#ffb35c', emissiveIntensity: 0.7, roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.2, 18, 1, true), glassMat);
    glass.position.y = 0.1;
    const baseL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.02, 18), brassMat());
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.07, 12), stdMat('#f6ead2', { roughness: 0.6, emissive: '#ffb060', emissiveIntensity: 0.4 }));
    candle.position.y = 0.045;
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd38a' });
    flameMat.color.multiplyScalar(4);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), flameMat);
    flame.scale.set(1, 2.1, 1);
    flame.position.y = 0.1;
    lantern.add(glass, baseL, candle, flame);
    table.add(lantern);
    const cupMat = glazeMat('#e8e0d0');
    for (const [x, z] of [[-0.2, 0.12], [0.22, 0.18]]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.06, 14), cupMat);
      cup.position.set(x, 0.77, z);
      const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.008, 18), cupMat);
      saucer.position.set(x, 0.742, z);
      table.add(cup, saucer);
    }
    const vase = pot({ r: 0.05, h: 0.09, material: terracottaMat('#c46f4a'), seed: 3 });
    vase.position.set(-0.12, 0.74, -0.2);
    const fl = new THREE.Mesh(smallFlowers({ seed: 41, radius: 0.07, height: 0.07, color: '#ffffff' }), f3PlantMat());
    fl.position.set(-0.12, 0.82, -0.2);
    table.add(vase, fl);
    const light = new THREE.PointLight('#ffb062', 1.6, 3.6, 1.6);
    light.position.set(c.x + 0.05, 0.98, c.z - 0.05);
    group.add(light);
    lights.table = { light, flame, glassMat, base: 1.6 };
    table.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh && o !== glass) { o.castShadow = true; o.receiveShadow = true; } });
    table.add(contactShadow(0.75, 0.75, 0.5));
  }
  group.add(table);

  // ------------------------------------------------ borda oeste (fora dos limites): sebe alta, vasos, poste
  {
    const blobs = [];
    hedgeBlobs(blobs, { ax: B.minX - 0.42, az: B.minZ + 0.1, bx: B.minX - 0.42, bz: 3.4, height: 1.1, half: 0.38, spacing: 0.15, r });
    hedgeBlobs(blobs, { ax: B.minX - 0.42, az: 3.5, bx: B.minX - 0.42, bz: B.maxZ + 1.0, height: 0.55, half: 0.38, spacing: 0.15, r });
    // sebe baixa sul (≤ 0.55 m), fora dos limites
    hedgeBlobs(blobs, { ax: B.minX - 0.4, az: B.maxZ + 0.42, bx: B.maxX + 0.4, bz: B.maxZ + 0.42, height: 0.5, half: 0.3, spacing: 0.15, r });
    // sebe leste (alta, fora dos limites) com recorte para o banco
    hedgeBlobs(blobs, { ax: B.maxX + 0.75, az: B.minZ + 0.1, bx: B.maxX + 0.75, bz: 3.6, height: 1.15, half: 0.3, spacing: 0.15, r });
    hedgeBlobs(blobs, { ax: B.maxX + 0.75, az: 3.6, bx: B.maxX + 0.75, bz: B.maxZ + 0.6, height: 0.55, half: 0.3, spacing: 0.15, r });
    const geo = foliageCluster(blobs, { detail: 2, amp: 0.28, freq: 6.0, seed: 51, ...HEDGE_COL });
    const mesh = new THREE.Mesh(geo, mat('f3-border-hedge', () => addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { amp: 0.006, freq: 1.1 })));
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    group.add(leafSkin(geo, { count: 15000, size: 0.095, seed: 15, material: mat('f3-border-leaf', () => addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), { amp: 0.012, freq: 1.4 })), minNormalY: -0.2 }));
  }
  // vasos grandes nos cantos (fora dos limites ou contra a fachada fora do alcance)
  {
    const terra = terracottaMat('#b8664a');
    const defs = [
      [B.minX - 0.25, B.minZ + 0.45, 0.3, 0.5, () => lavender({ seed: 61, height: 0.45, spread: 0.24, stems: 50 }), 0.45],
      [B.minX - 0.3, 1.2, 0.26, 0.42, () => geranium({ seed: 62, radius: 0.24, height: 0.22, flower: '#ff6a7a' }), 0.38],
      [B.maxX + 0.35, -4.3, 0.3, 0.55, () => boxwood(0.3, 63), 0.75],
      [B.maxX + 0.35, 2.4, 0.26, 0.42, () => geranium({ seed: 64, radius: 0.22, height: 0.2, flower: '#ffffff' }), 0.38],
    ];
    for (const [x, z, pr, ph, plant, py] of defs) {
      const g = pot({ r: pr, h: ph, material: terra, seed: Math.round(pr * 100) });
      g.position.set(x, 0, z);
      const pl = new THREE.Mesh(plant(), f3PlantMat());
      pl.position.y = py;
      g.add(pl);
      g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      group.add(g);
    }
  }

  // ------------------------------------------------ banco de madeira (borda leste, olhando o lago)
  {
    const bench = new THREE.Group();
    bench.position.set(B.maxX + 0.42, 0, -2.3);
    bench.rotation.y = -Math.PI / 2;
    const wood = woodMat('#8d6544', { key: 'f3-bench', rough: 0.7 });
    const iron = stdMat('#262a2a', { roughness: 0.5, metalness: 0.5 });
    for (let k = 0; k < 4; k++) {
      const sl = new THREE.Mesh(rbox(1.3, 0.03, 0.09, 0.01), wood);
      sl.position.set(0, 0.42, -0.15 + k * 0.1);
      bench.add(sl);
    }
    for (let k = 0; k < 3; k++) {
      const sl = new THREE.Mesh(rbox(1.3, 0.08, 0.025, 0.01), wood);
      sl.position.set(0, 0.55 + k * 0.12, 0.24 + k * 0.02);
      sl.rotation.x = -0.15;
      bench.add(sl);
    }
    for (const sx of [-0.55, 0.55]) {
      const side = new THREE.Mesh(rbox(0.05, 0.42, 0.42, 0.01), iron);
      side.position.set(sx, 0.21, 0.02);
      const back = new THREE.Mesh(rbox(0.05, 0.45, 0.04, 0.01), iron);
      back.position.set(sx, 0.65, 0.27);
      back.rotation.x = -0.15;
      const arm = new THREE.Mesh(rbox(0.06, 0.03, 0.46, 0.01), wood);
      arm.position.set(sx + Math.sign(sx) * 0.02, 0.62, 0.02);
      bench.add(side, back, arm);
    }
    bench.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    bench.add(contactShadow(0.75, 0.3, 0.5));
    group.add(bench);
  }

  // ------------------------------------------------ balizadores baixos (≤ 0.5 m) na borda sul + banquinho baixo
  const bollards = [];
  {
    const iron = stdMat('#2c2a28', { roughness: 0.45, metalness: 0.6 });
    for (const x of [-4.4, -0.9, 2.6, 5.4]) {
      const g = new THREE.Group();
      g.position.set(x, 0, B.maxZ + 0.12);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.36, 12), iron);
      post.position.y = 0.18;
      const glowMat = new THREE.MeshStandardMaterial({ color: '#fff0d0', emissive: '#ffb45e', emissiveIntensity: 2.6, roughness: 0.3 });
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), glowMat);
      glass.position.y = 0.4;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.03, 12), iron);
      cap.position.y = 0.455;
      g.add(post, glass, cap);
      g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) o.castShadow = true; });
      group.add(g);
      bollards.push({ group: g, glowMat, x, z: B.maxZ + 0.12 });
    }
    const light = new THREE.PointLight('#ffb466', 3.2, 4.6, 1.4);
    light.position.set(2.6, 0.95, B.maxZ - 0.15);
    group.add(light);
    lights.south = { light, base: 3.2 };
    // banquinho baixo de pedra na borda sul (≤ 0.45 m)
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#a39a8c', roughness: 0.85, map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 1.2 });
    const benchS = new THREE.Group();
    benchS.position.set(4.0, 0, B.maxZ + 0.55);
    const slab = new THREE.Mesh(rbox(1.1, 0.07, 0.34, 0.025), stoneMat);
    slab.position.y = 0.4;
    benchS.add(slab);
    for (const sx of [-0.4, 0.4]) {
      const leg = new THREE.Mesh(rbox(0.12, 0.38, 0.28, 0.02), stoneMat);
      leg.position.set(sx, 0.19, 0);
      benchS.add(leg);
    }
    benchS.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(benchS);
  }

  // ------------------------------------------------ poste de luz alto (borda oeste, fora dos limites)
  const posts = [];
  for (const [x, z] of [[B.minX - 0.42, -1.6], [B.maxX + 0.45, 0.9]]) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const iron = ironMat();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 2.5, 10), iron);
    pole.position.y = 1.25;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.25, 10), iron);
    base.position.y = 0.12;
    const glowMat = new THREE.MeshStandardMaterial({ color: '#fff0d0', emissive: '#ffb45e', emissiveIntensity: 3.0, roughness: 0.3 });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.24, 6), glowMat);
    glass.position.y = 2.66;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.12, 6), iron);
    cap.position.y = 2.84;
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), iron);
    finial.position.y = 2.92;
    g.add(pole, base, glass, cap, finial);
    g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) o.castShadow = true; });
    group.add(g);
    posts.push({ group: g, glowMat, top: new THREE.Vector3(x, 2.66, z) });
  }

  return { group, hedgeAB, nook, table, lights, bollards, posts };
}
