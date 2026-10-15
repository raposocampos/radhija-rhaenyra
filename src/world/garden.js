// Jardim: vasos, canteiro, árvore no vaso, banco com regador, luminária, horta elevada, armário,
// bebedouro de pássaros, vasos do canto sudeste, muro leste com trepadeira, sebes oeste e sul.
// Os visuais coincidem com STATIC_COLLIDERS do layout.
import * as THREE from 'three';
import {
  woodMat, stdMat, terracottaMat, glazeMat, brassMat, ironMat, plasterMat, rbox, rng, paint, mergeGeometries,
  foliageCluster, contactShadow, potProfile, soilDisc, shadowAll, speckleTexture, rippleNormalTexture, canvasTexture,
  shared, vnoise3, mat, SUN_DIR, leafSkin,
} from './util.js';
import { plantMat, hedgeMat, crownMat, lavender, geranium, boxwood, lettuce, carrotTops, succulent, smallFlowers, merge } from './plants.js';

const soilMat = () => mat('soil', () => new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 1, map: speckleTexture() }));

function pot({ r, h, material, seed = 1, rim = 0.12, foot = 0.72, belly = 1.0 }) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(potProfile(r, h, { rim, foot, belly }), 32), material);
  const soil = new THREE.Mesh(soilDisc(r * 0.88, seed), soilMat());
  soil.position.y = h * 0.9;
  g.add(body, soil);
  g.userData.top = h * 0.9;
  return g;
}

function collider(layout, id) { return layout.STATIC_COLLIDERS.find((c) => c.id === id); }

export function buildGarden(engine, layout) {
  const { scene } = engine;
  const group = new THREE.Group();
  group.name = 'jardim';
  const shadows = new THREE.Group();
  const occluders = [];
  const animated = [];
  const C = (id) => collider(layout, id);
  const terra = terracottaMat('#c8714a');
  const terraLight = terracottaMat('#d48a5e');
  const teal = glazeMat('#2c6e78');

  // ------------------------------------------------ árvore (limoeiro) no vaso — noroeste
  {
    const c = C('arvore-vaso-noroeste');
    const t = new THREE.Group();
    t.position.set(c.x, 0, c.z);
    const p = pot({ r: 0.46, h: 0.56, material: terra, seed: 3, foot: 0.68 });
    t.add(p);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(0.04, 0.9, -0.12), new THREE.Vector3(-0.03, 1.35, -0.38), new THREE.Vector3(-0.05, 1.6, -0.5),
    ]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.04, 8), woodMat('#7a5a3e', { key: 'bark', vertical: true, rough: 0.95 }));
    t.add(trunk);
    const crown = new THREE.Mesh(foliageCluster([
      { x: -0.05, y: 1.85, z: -0.55, r: 0.5 }, { x: 0.32, y: 1.72, z: -0.45, r: 0.36 }, { x: -0.4, y: 1.75, z: -0.5, r: 0.38 },
      { x: 0.0, y: 2.18, z: -0.6, r: 0.38 }, { x: 0.15, y: 1.95, z: -0.25, r: 0.32 }, { x: -0.25, y: 2.05, z: -0.3, r: 0.3 },
    ], { detail: 3, amp: 0.22, freq: 3.2, seed: 11, dark: '#2b4a1e', mid: '#4f7a2e', light: '#9cbc52' }), crownMat());
    t.add(crown);
    t.add(leafSkin(crown.geometry, { count: 1300, size: 0.075, seed: 9, material: plantMat(), minNormalY: -0.6 }));
    // limões
    const lemonMat = stdMat('#f2c531', { roughness: 0.45 });
    const r = rng(8);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.1 + r() * Math.PI * 1.2;
      const lm = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), lemonMat);
      lm.scale.set(1, 1.25, 1);
      lm.position.set(-0.05 + Math.cos(a) * 0.52, 1.6 + r() * 0.55, -0.45 + Math.sin(a) * 0.4);
      t.add(lm);
    }
    group.add(t);
    occluders.push(crown);
    shadows.add(contactShadow(0.62, 0.62, 0.5).translateX(c.x).translateZ(c.z));
  }

  // ------------------------------------------------ vasos esmaltados da porta (buxinhos)
  for (const id of ['vaso-porta-oeste', 'vaso-porta-leste']) {
    const c = C(id);
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z);
    const p = pot({ r: 0.22, h: 0.46, material: teal, seed: c.x * 10 | 0, foot: 0.62, belly: 1.06 });
    g.add(p);
    const b = new THREE.Mesh(boxwood(0.25, c.x), plantMat());
    b.position.y = 0.46 + 0.2;
    g.add(b);
    const skin = leafSkin(b.geometry, { count: 420, size: 0.05, seed: 7 + (c.x | 0), material: plantMat(), minNormalY: -0.5 });
    skin.position.copy(b.position);
    g.add(skin);
    group.add(g);
    shadows.add(contactShadow(0.34, 0.34, 0.55).translateX(c.x).translateZ(c.z));
  }

  // ------------------------------------------------ canteiro da fachada (lavanda, gerânios, flores brancas)
  {
    const c = C('canteiro-fachada'); // x[-2.0,0.6] z[-4.8,-4.4]
    const g = new THREE.Group();
    const edgeMat = stdMat('#b9a58c', { roughness: 0.9, map: speckleTexture() });
    const r = rng(12);
    // borda de tijolinhos arredondados
    const x0 = c.x - c.hx, x1 = c.x + c.hx, zf = c.z + c.hz;
    for (let x = x0 + 0.1; x < x1; x += 0.2) {
      const b = new THREE.Mesh(rbox(0.19, 0.17 + r() * 0.02, 0.09, 0.025), edgeMat);
      b.position.set(x, 0.085, zf - 0.045);
      b.rotation.y = (r() - 0.5) * 0.05;
      g.add(b);
    }
    for (const x of [x0 + 0.045, x1 - 0.045]) {
      for (let z = c.z - c.hz + 0.08; z < zf - 0.1; z += 0.2) {
        const b = new THREE.Mesh(rbox(0.09, 0.17, 0.19, 0.025), edgeMat);
        b.position.set(x, 0.085, z);
        g.add(b);
      }
    }
    const soil = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2 - 0.16, 0.14, c.hz * 2 - 0.08), soilMat());
    soil.position.set(c.x, 0.07, c.z - 0.02);
    g.add(soil);
    const plants = [
      [lavender({ seed: 21, height: 0.5, spread: 0.16 }), -1.75, -4.62],
      [geranium({ seed: 22, radius: 0.17, height: 0.22 }), -1.3, -4.58],
      [lavender({ seed: 23, height: 0.55, spread: 0.17 }), -0.85, -4.62],
      [smallFlowers({ seed: 24, radius: 0.14, height: 0.14 }), -0.45, -4.55],
      [lavender({ seed: 25, height: 0.5, spread: 0.16 }), -0.05, -4.63],
      [geranium({ seed: 26, radius: 0.16, height: 0.2, flower: '#f25c7a' }), 0.35, -4.58],
    ];
    for (const [geo, x, z] of plants) {
      const m = new THREE.Mesh(geo, plantMat());
      m.position.set(x, 0.14, z);
      g.add(m);
    }
    group.add(g);
  }

  // ------------------------------------------------ banco de madeira (oeste, de frente para leste)
  {
    const c = C('banco'); // x[-6.0,-5.07] z[-0.15,1.35]
    const b = new THREE.Group();
    b.position.set(c.x, 0, c.z);
    const wood = woodMat('#b47b47', { key: 'bench', rough: 0.72 });
    const woodV = woodMat('#a86f3e', { key: 'bench-v', vertical: true, rough: 0.75 });
    const L = c.hz * 2 - 0.12;
    const frontX = c.hx - 0.06, backX = -c.hx + 0.2;
    // assento: 4 ripas
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(rbox(0.1, 0.035, L, 0.012), wood);
      s.position.set(frontX - 0.05 - i * 0.115, 0.44, 0);
      b.add(s);
    }
    // encosto inclinado: 3 ripas
    const back = new THREE.Group();
    back.position.set(backX - 0.04, 0.46, 0);
    back.rotation.z = 0.18;
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(rbox(0.03, 0.09, L, 0.012), wood);
      s.position.set(0, 0.1 + i * 0.13, 0);
      back.add(s);
    }
    b.add(back);
    // pernas e braços
    for (const z of [-L / 2 + 0.04, L / 2 - 0.04]) {
      const fl = new THREE.Mesh(rbox(0.06, 0.64, 0.06, 0.012), woodV);
      fl.position.set(frontX - 0.04, 0.32, z);
      const bl = new THREE.Mesh(rbox(0.06, 0.9, 0.06, 0.012), woodV);
      bl.position.set(backX - 0.02, 0.45, z);
      bl.rotation.z = 0.12;
      const arm = new THREE.Mesh(rbox(c.hx * 2 - 0.22, 0.035, 0.09, 0.015), wood);
      arm.position.set((frontX + backX) / 2, 0.64, z);
      const rail = new THREE.Mesh(rbox(c.hx * 2 - 0.3, 0.05, 0.035, 0.01), woodV);
      rail.position.set((frontX + backX) / 2, 0.16, z);
      b.add(fl, bl, arm, rail);
    }
    const stretcher = new THREE.Mesh(rbox(0.04, 0.05, L - 0.1, 0.01), woodV);
    stretcher.position.set((frontX + backX) / 2, 0.16, 0);
    b.add(stretcher);
    // almofada mostarda
    const cushion = new THREE.Mesh(rbox(0.38, 0.08, 0.4, 0.04, 4), stdMat('#d9a441', { roughness: 0.95 }));
    cushion.position.set(frontX - 0.22, 0.5, 0.3);
    cushion.rotation.set(0.04, 0.12, 0.02);
    b.add(cushion);
    group.add(b);
    shadows.add(contactShadow(c.hx + 0.1, c.hz + 0.12, 0.42).translateX(c.x + 0.05).translateZ(c.z));

    // regador galvanizado ao lado do banco
    const wc = new THREE.Group();
    wc.position.set(-5.83, 0, 1.43);
    wc.rotation.y = -0.6;
    const zinc = stdMat('#a9b2b3', { metalness: 0.85, roughness: 0.38 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.2, 20), zinc);
    body.position.y = 0.1;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), zinc);
    top.scale.y = 0.3; top.position.y = 0.2;
    const spoutC = new THREE.CatmullRomCurve3([new THREE.Vector3(0.07, 0.06, 0), new THREE.Vector3(0.16, 0.14, 0), new THREE.Vector3(0.24, 0.25, 0)]);
    const spout = new THREE.Mesh(new THREE.TubeGeometry(spoutC, 10, 0.012, 8), zinc);
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.016, 0.03, 12), zinc);
    rose.position.set(0.25, 0.26, 0); rose.rotation.z = -0.8;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 16, Math.PI), zinc);
    handle.position.set(-0.02, 0.21, 0); handle.rotation.set(0, 0, 0);
    wc.add(body, top, spout, rose, handle);
    group.add(wc);
    shadows.add(contactShadow(0.13, 0.13, 0.5).translateX(-5.83).translateZ(1.43));

    // vaso junto ao banco (gerânios coral)
    const vc = C('vaso-banco');
    const vg = new THREE.Group();
    vg.position.set(vc.x, 0, vc.z);
    vg.add(pot({ r: 0.21, h: 0.34, material: terra, seed: 5 }));
    const ger = new THREE.Mesh(geranium({ seed: 31, radius: 0.22, height: 0.22 }), plantMat());
    ger.position.y = 0.3;
    vg.add(ger);
    group.add(vg);
    shadows.add(contactShadow(0.32, 0.32, 0.5).translateX(vc.x).translateZ(vc.z));
  }

  // ------------------------------------------------ luminária de jardim (baixa, z > 3.5 → ≤ 0.6 m)
  {
    const c = C('luminaria');
    const l = new THREE.Group();
    l.position.set(c.x, 0, c.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 16), ironMat());
    base.position.y = 0.025;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.36, 12), ironMat());
    post.position.y = 0.2;
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 16), new THREE.MeshStandardMaterial({
      color: '#fff1d6', emissive: '#ffbf73', emissiveIntensity: 1.8, roughness: 0.4,
    }));
    glow.position.y = 0.43;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), ironMat());
    cap.scale.y = 0.45;
    cap.position.y = 0.48;
    l.add(base, post, glow, cap);
    group.add(l);
    shadows.add(contactShadow(0.16, 0.16, 0.5).translateX(c.x).translateZ(c.z));
  }

  // ------------------------------------------------ horta elevada (leste) com alfaces e ramas de cenoura
  {
    const c = C('horta-elevada'); // x[2.6,3.8] z[-4.8,-2.6]
    const h = new THREE.Group();
    h.position.set(c.x, 0, c.z);
    const W = c.hx * 2, D = c.hz * 2, H = 0.48;
    const plank = woodMat('#c08e58', { key: 'planter', rough: 0.8 });
    const postM = woodMat('#a87a48', { key: 'planter-post', vertical: true, rough: 0.85 });
    for (let i = 0; i < 3; i++) {
      const y = 0.08 + i * 0.155;
      for (const s of [-1, 1]) {
        const a = new THREE.Mesh(rbox(0.045, 0.15, D - 0.04, 0.015), plank);
        a.position.set(s * (W / 2 - 0.0225), y, 0);
        const b = new THREE.Mesh(rbox(W - 0.04, 0.15, 0.045, 0.015), plank);
        b.position.set(0, y, s * (D / 2 - 0.0225));
        h.add(a, b);
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(rbox(0.08, H + 0.06, 0.08, 0.02), postM);
      p.position.set(sx * (W / 2 - 0.04), (H + 0.06) / 2, sz * (D / 2 - 0.04));
      h.add(p);
    }
    // terra irregular
    const sg = new THREE.PlaneGeometry(W - 0.09, D - 0.09, 18, 30).rotateX(-Math.PI / 2);
    const sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) sp.setY(i, (vnoise3(sp.getX(i) * 9, 0, sp.getZ(i) * 9) - 0.5) * 0.03);
    sg.computeVertexNormals();
    const soil = new THREE.Mesh(sg, soilMat());
    soil.position.y = H - 0.04;
    h.add(soil);
    // fileiras: ramas de cenoura (sul, perto da câmera) e alfaces
    const r = rng(41);
    const items = [];
    for (let i = 0; i < 5; i++) items.push([carrotTops({ seed: 50 + i, height: 0.24 + r() * 0.08 }), 0.25, 0.85 - i * 0.32]);
    for (let i = 0; i < 4; i++) items.push([lettuce({ r: 0.14, seed: 60 + i }), -0.25, 0.78 - i * 0.4]);
    items.push([carrotTops({ seed: 70, height: 0.28 }), 0.27, -0.75]);
    for (const [geo, x, z] of items) {
      const m = new THREE.Mesh(geo, plantMat());
      m.position.set(x + (r() - 0.5) * 0.05, H - 0.04, z);
      m.rotation.y = r() * 6.28;
      h.add(m);
    }
    // plaquinha com desenho de cenoura
    const signTex = canvasTexture(128, 96, (g, w, hh) => {
      g.fillStyle = '#e8d3ad'; g.fillRect(0, 0, w, hh);
      g.fillStyle = '#f07a22';
      g.beginPath(); g.moveTo(30, 40); g.quadraticCurveTo(70, 30, 104, 50); g.quadraticCurveTo(70, 66, 30, 58); g.closePath(); g.fill();
      g.fillStyle = '#5d9a2c';
      for (const a of [-0.5, 0, 0.5]) { g.save(); g.translate(30, 49); g.rotate(Math.PI + a); g.fillRect(0, -4, 22, 8); g.restore(); }
      g.strokeStyle = 'rgba(120,70,30,0.6)'; g.lineWidth = 2;
      for (const x of [55, 70, 85]) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x - 3, 58); g.stroke(); }
    }, { repeat: false });
    const sign = new THREE.Group();
    sign.position.set(0.32, H - 0.04, D / 2 - 0.1);
    const stake = new THREE.Mesh(rbox(0.025, 0.3, 0.02, 0.006), postM);
    stake.position.y = 0.15;
    const board = new THREE.Mesh(rbox(0.16, 0.12, 0.018, 0.008), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 }));
    board.position.set(0, 0.3, 0.012);
    sign.add(stake, board);
    sign.rotation.y = -0.25;
    h.add(sign);
    group.add(h);
    shadows.add(contactShadow(c.hx + 0.14, c.hz + 0.12, 0.5).translateX(c.x).translateZ(c.z));
  }

  // ------------------------------------------------ armário de jardim baixo (≤ 1.2 m) azul acinzentado
  {
    const c = C('armario-jardim'); // x[5.0,6.8] z[-4.8,-2.6]
    const a = new THREE.Group();
    a.position.set(c.x, 0, c.z);
    const W = c.hx * 2, D = c.hz * 2, H = 1.08;
    const paintM = woodMat('#5a84a6', { key: 'cabinet', rough: 0.6 });
    const paintV = woodMat('#557fa0', { key: 'cabinet-v', vertical: true, rough: 0.6 });
    const trim = woodMat('#eee4d2', { key: 'cabinet-trim', vertical: true, rough: 0.6 });
    const body = new THREE.Mesh(rbox(W - 0.06, H - 0.1, D - 0.06, 0.02), paintM);
    body.position.y = 0.06 + (H - 0.1) / 2;
    a.add(body);
    // tábuas horizontais (relevo) nas faces oeste e sul
    for (let y = 0.16; y < H - 0.1; y += 0.12) {
      const sw = new THREE.Mesh(rbox(0.02, 0.1, D - 0.12, 0.008), paintM);
      sw.position.set(-W / 2 + 0.025, y, 0);
      a.add(sw);
    }
    // portas na face sul
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(rbox(W / 2 - 0.1, H - 0.26, 0.03, 0.015), paintV);
      d.position.set(s * (W / 4 - 0.01), 0.06 + (H - 0.1) / 2, D / 2 - 0.02);
      const inner = new THREE.Mesh(rbox(W / 2 - 0.3, H - 0.5, 0.02, 0.012), paintM);
      inner.position.set(s * (W / 4 - 0.01), 0.06 + (H - 0.1) / 2, D / 2 + 0.0);
      const hnd = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), brassMat());
      hnd.position.set(s * 0.07, 0.62, D / 2 + 0.02);
      a.add(d, inner, hnd);
    }
    // cantoneiras creme, rodapé e tampo
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(rbox(0.06, H - 0.04, 0.06, 0.012), trim);
      p.position.set(sx * (W / 2 - 0.03), (H - 0.04) / 2, sz * (D / 2 - 0.03));
      a.add(p);
    }
    const plinth = new THREE.Mesh(rbox(W - 0.02, 0.07, D - 0.02, 0.015), stdMat('#4c5a63', { roughness: 0.8 }));
    plinth.position.y = 0.035;
    const topB = new THREE.Mesh(rbox(W, 0.05, D, 0.02), woodMat('#c69a64', { key: 'cabinet-top', rough: 0.7 }));
    topB.position.y = H - 0.025;
    a.add(plinth, topB);
    // vasinhos no tampo + luvas
    const r = rng(19);
    const tops = [
      [succulent({ r: 0.07, seed: 81 }), -0.55, 0.75, 0.085],
      [smallFlowers({ seed: 82, radius: 0.08, height: 0.1, color: '#f6a3c0' }), -0.05, 0.85, 0.08],
      [succulent({ r: 0.06, seed: 83, color: '#a7c08a' }), 0.5, 0.8, 0.07],
    ];
    for (const [geo, x, z, pr] of tops) {
      const pg = pot({ r: pr, h: pr * 1.3, material: terraLight, seed: 9, foot: 0.7 });
      pg.position.set(x, H, z);
      const pl = new THREE.Mesh(geo, plantMat());
      pl.position.y = pr * 1.2;
      pg.add(pl);
      a.add(pg);
    }
    const gloveMat = stdMat('#e9b949', { roughness: 0.95 });
    for (let i = 0; i < 2; i++) {
      const gl = new THREE.Mesh(rbox(0.09, 0.02, 0.18, 0.01), gloveMat);
      gl.position.set(0.15 + i * 0.05, H + 0.012 + i * 0.012, 0.35 + i * 0.03);
      gl.rotation.y = 0.5 + i * 0.4;
      a.add(gl);
    }
    group.add(a);
    occluders.push(a);
    shadows.add(contactShadow(c.hx + 0.12, c.hz + 0.12, 0.55).translateX(c.x).translateZ(c.z));
  }

  // ------------------------------------------------ bebedouro de pássaros (pedra + água que reflete)
  let water = null;
  {
    const c = C('bebedouro-passaros');
    const b = new THREE.Group();
    b.position.set(c.x, 0, c.z);
    const prof = [
      [0, 0], [0.24, 0], [0.25, 0.04], [0.2, 0.08], [0.12, 0.13], [0.09, 0.22], [0.085, 0.34], [0.1, 0.43], [0.14, 0.48],
      [0.22, 0.52], [0.3, 0.56], [0.32, 0.6], [0.315, 0.63], [0.29, 0.635], [0.275, 0.61], [0.22, 0.585], [0.1, 0.57], [0, 0.565],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const sg = new THREE.LatheGeometry(prof, 36);
    const stone = new THREE.MeshStandardMaterial({ color: '#c3b8a6', roughness: 0.9, map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 1.5, vertexColors: true });
    paint(sg, (p) => new THREE.Color('#ffffff').lerp(new THREE.Color('#7f8a5a'), Math.max(0, 0.5 - p.y) * 0.9 * vnoise3(p.x * 20, p.y * 20, p.z * 20) + (p.y < 0.06 ? 0.15 : 0)));
    b.add(new THREE.Mesh(sg, stone));
    water = new THREE.Mesh(new THREE.CircleGeometry(0.278, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
      color: '#3f6f78', roughness: 0.04, metalness: 0.0, normalMap: rippleNormalTexture(), normalScale: new THREE.Vector2(0.25, 0.25),
      envMapIntensity: 2.2, transparent: true, opacity: 0.92,
    }));
    water.material.normalMap.repeat.set(2, 2);
    water.position.y = 0.6;
    water.userData.noShadow = true;
    b.add(water);
    group.add(b);
    shadows.add(contactShadow(0.36, 0.36, 0.5).translateX(c.x).translateZ(c.z));
  }

  // ------------------------------------------------ vasos de terracota do canto sudeste (lavanda e gerânios coral)
  {
    const defs = [
      ['vaso-canto-1', 0.26, 0.33, () => lavender({ seed: 91, height: 0.26, spread: 0.24, stems: 56 }), 0.3],
      ['vaso-canto-2', 0.19, 0.26, () => geranium({ seed: 92, radius: 0.2, height: 0.18 }), 0.23],
      ['vaso-canto-3', 0.17, 0.32, () => geranium({ seed: 93, radius: 0.17, height: 0.24, flower: '#ff8a6b' }), 0.29],
    ];
    for (const [id, pr, ph, plant, py] of defs) {
      const c = C(id);
      const g = new THREE.Group();
      g.position.set(c.x, 0, c.z);
      g.add(pot({ r: pr, h: ph, material: id === 'vaso-canto-2' ? terraLight : terra, seed: pr * 100 | 0 }));
      const m = new THREE.Mesh(plant(), plantMat());
      m.position.y = py;
      g.add(m);
      group.add(g);
      shadows.add(contactShadow(c.r + 0.1, c.r + 0.1, 0.5).translateX(c.x).translateZ(c.z));
    }
  }

  // ------------------------------------------------ muro leste do condomínio com trepadeira
  {
    const B = layout.WORLD.bounds;
    const wx = B.maxX; // face oeste do muro
    const wallM = plasterMat('#f0dcc0');
    const capM = stdMat('#c9a789', { roughness: 0.85, map: speckleTexture() });
    const segs = [[B.minZ, 3.0, 1.2], [3.0, 7.0, 0.55]];
    for (const [z0, z1, hh] of segs) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.28, hh, z1 - z0), wallM);
      w.position.set(wx + 0.14, hh / 2, (z0 + z1) / 2);
      const cap = new THREE.Mesh(rbox(0.36, 0.07, z1 - z0 + 0.04, 0.025), capM);
      cap.position.set(wx + 0.14, hh + 0.035, (z0 + z1) / 2);
      const sk = new THREE.Mesh(rbox(0.04, 0.22, z1 - z0, 0.01), stdMat('#a48f7c', { roughness: 0.9 }));
      sk.position.set(wx + 0.01, 0.11, (z0 + z1) / 2);
      group.add(w, cap, sk);
      occluders.push(w);
    }
    // folhas de hera instanciadas
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.03, 0.01, 0.045, 0.04, 0.0, 0.075);
    leafShape.bezierCurveTo(-0.045, 0.04, -0.03, 0.01, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 4);
    const r = rng(55);
    const leaves = [];
    const clusters = [[-3.9, 0.7, 0.9], [-1.2, 0.85, 0.75], [0.6, 0.5, 0.6], [1.9, 0.95, 0.85], [3.4, 0.3, 0.35], [-2.6, 0.3, 0.4]];
    for (const [cz, cy, cr] of clusters) {
      const n = Math.round(cr * 230);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * cr;
        const z = cz + Math.cos(a) * d * 1.3, y = cy + Math.sin(a) * d * 0.75;
        const top = z < 3.0 ? 1.2 : 0.55;
        if (y < 0.05 || y > top + 0.05) continue;
        leaves.push({ z, y, s: 0.8 + r() * 0.7, rot: r() * 6.28, tilt: (r() - 0.5) * 0.9, c: r() });
      }
      // folhas caindo por cima do muro
      for (let i = 0; i < cr * 30; i++) {
        const z = cz + (r() - 0.5) * cr * 2.2;
        if (z > 3.0 || z < B.minZ) continue;
        leaves.push({ z, y: 1.2 + 0.02, s: 0.9 + r() * 0.5, rot: r() * 6.28, tilt: -1.3, c: r(), top: true });
      }
    }
    const im = new THREE.InstancedMesh(leafGeo, plantMat(), leaves.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    const dark = new THREE.Color('#2c4a1f'), light = new THREE.Color('#6f9a3a');
    leaves.forEach((l, i) => {
      e.set(l.tilt, -Math.PI / 2 + (r() - 0.5) * 0.6, l.rot, 'YXZ');
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(wx - 0.012 - r() * 0.03 + (l.top ? 0.14 : 0), l.y, l.z), q, new THREE.Vector3(l.s, l.s, l.s));
      im.setMatrixAt(i, m4);
      col.copy(dark).lerp(light, l.c * 0.8 + (l.top ? 0.2 : 0));
      im.setColorAt(i, col);
    });
    // vertex color branco para o plantMat (usa vertexColors)
    paint(leafGeo, '#ffffff');
    im.castShadow = false; im.receiveShadow = true;
    group.add(im);
  }

  // ------------------------------------------------ sebes (oeste alta, sul baixa ≤ 0.6 m) com florzinhas
  {
    const B = layout.WORLD.bounds;
    const r = rng(66);
    const west = [];
    for (let z = B.minZ + 0.1; z < 6.0; z += 0.42) {
      const tall = z < 2.6;
      const hgt = tall ? 0.95 + r() * 0.12 : 0.42;
      const rr = tall ? 0.45 + r() * 0.15 : 0.34 + r() * 0.05;
      west.push({ x: B.minX - rr * 0.85 - 0.05, y: tall ? hgt - rr * 0.6 : 0.2, z, r: rr, sy: tall ? 1.05 : 0.85 });
      if (tall) west.push({ x: B.minX - rr * 0.9 - 0.1, y: 0.38, z: z + 0.2, r: rr * 0.85, sy: 0.9 });
    }
    const westGeo = foliageCluster(west, { detail: 3, amp: 0.2, freq: 4.5, seed: 4, dark: '#1f3a18', mid: '#365a26', light: '#6f8c42', sunBias: 0.6 });
    const westMesh = new THREE.Mesh(westGeo, hedgeMat());
    westMesh.castShadow = true; westMesh.receiveShadow = true;
    group.add(westMesh);
    group.add(leafSkin(westGeo, { count: 4200, size: 0.085, seed: 3, material: plantMat(), minNormalY: -0.2 }));
    occluders.push(westMesh);

    const south = [];
    for (let x = B.minX - 1.2; x < B.maxX + 0.5; x += 0.3 + r() * 0.25) {
      const rr = 0.26 + r() * 0.12;
      south.push({ x, y: 0.12 + r() * 0.08, z: B.maxZ + 0.32 + (r() - 0.5) * 0.12, r: rr, sy: 0.75 + r() * 0.15, sx: 1 + r() * 0.4 });
      south.push({ x: x + 0.15, y: 0.14, z: B.maxZ + 0.62 + r() * 0.1, r: rr * 1.05, sy: 0.8 });
    }
    const southGeo = foliageCluster(south, { detail: 3, amp: 0.2, freq: 5.5, seed: 7, dark: '#243f17', mid: '#3f6326', light: '#7a9a42', sunBias: 0.6 });
    const southMesh = new THREE.Mesh(southGeo, hedgeMat());
    southMesh.castShadow = true; southMesh.receiveShadow = true;
    group.add(southMesh);
    group.add(leafSkin(southGeo, { count: 3600, size: 0.07, seed: 5, material: plantMat(), minNormalY: -0.1 }));

    // florzinhas brancas e rosadas sobre as sebes
    const fl = [];
    const pos = southGeo.attributes.position, nor = southGeo.attributes.normal;
    for (let i = 0; i < pos.count; i += 7) {
      if (nor.getY(i) > 0.45 && r() < 0.5) fl.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    }
    const wpos = westGeo.attributes.position, wnor = westGeo.attributes.normal;
    for (let i = 0; i < wpos.count; i += 9) {
      if (wnor.getX(i) > 0.5 && r() < 0.25) fl.push([wpos.getX(i), wpos.getY(i), wpos.getZ(i)]);
    }
    const fGeo = new THREE.IcosahedronGeometry(0.02, 0);
    fGeo.scale(1, 0.6, 1);
    paint(fGeo, '#ffffff');
    const fim = new THREE.InstancedMesh(fGeo, plantMat(), fl.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    fl.forEach(([x, y, z], i) => {
      m4.makeTranslation(x, y + 0.01, z);
      fim.setMatrixAt(i, m4);
      col.set(r() < 0.6 ? '#fff4ea' : '#f7a6bf');
      fim.setColorAt(i, col);
    });
    group.add(fim);
  }

  shadowAll(group, true, true);
  // água/folhas finas não projetam
  group.traverse((o) => { if (o.isInstancedMesh) o.castShadow = false; });
  group.add(shadows);
  scene.add(group);

  return {
    group, occluders,
    update(dt, t) {
      if (water) {
        water.material.normalMap.offset.set(t * 0.015, t * 0.011);
      }
    },
  };
}
