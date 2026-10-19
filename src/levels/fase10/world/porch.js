// FASE 10 · A varanda da festa: deque de madeira com a borda e o degrauzinho, o pergolado com a trepadeira, a faixa de
// bandeirinhas "FELIZ 3 ANOS" balançando, o lampião de papel, a mesa com a toalha de babado, os pratinhos e os
// copinhos, a pilha de presentes, o banco com almofadas, os buquês de balões e, no meio da mesa, o BOLO de três
// andares (rosa, baunilha e rosa), com cobertura escorrendo, perolinhas, granulado e os lugares dos três enfeites.
// O varal de luzinhas (pergolado → arvorezinha → portão) acende em onda quando o disjuntor liga.
// API: buildPorch(root, layout) → { group, cake, lights: { setOn, bulbsAt }, lanternPos, update(dt, t) }
//   cake.place(enfeite, andar), cake.reject(enfeite, andar, k, x, z), cake.light(), cake.setHighlight(on), cake.reset()
import * as THREE from 'three';
import { rng, rbox, canvasTexture, stdMat, woodMat, mergeGeometries, paint, contactShadow, foliageCluster, leafSkin, brassMat } from '../../../world/util.js';
import { plantMat } from '../../../world/plants.js';

const TAU = Math.PI * 2;
const DECK_Y = 0.016;
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const PARTY = ['#f27a8a', '#f6c453', '#7cc4e8', '#9bd57a', '#c79af0', '#ff9ed2'];

/** Tábuas do deque ao longo de X (repetição de 1 m). */
function deckTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(52);
    const rows = 8;
    for (let j = 0; j < rows; j++) {
      let x = -r() * 100;
      while (x < w) {
        const len = 120 + r() * 140;
        const tone = 0.82 + r() * 0.26;
        g.fillStyle = `rgb(${(168 * tone) | 0},${(112 * tone) | 0},${(70 * tone) | 0})`;
        g.fillRect(x, (j * h) / rows + 1, len - 3, h / rows - 3);
        g.fillStyle = 'rgba(70,40,20,0.14)';
        for (let k = 0; k < 4; k++) g.fillRect(x + r() * len, (j * h) / rows + 3 + r() * (h / rows - 8), 30 + r() * 40, 1);
        g.fillStyle = 'rgba(40,26,14,0.6)';
        for (const yy of [5, h / rows - 7]) { g.fillRect(x + 6, (j * h) / rows + yy, 2, 2); g.fillRect(x + len - 10, (j * h) / rows + yy, 2, 2); }
        x += len;
      }
    }
  });
}
/** Bandeirinha triangular com a letra (fundo colorido, letra creme com contorno). */
function flagTexture(letter, color) {
  return canvasTexture(96, 112, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color;
    g.beginPath(); g.moveTo(2, 2); g.lineTo(w - 2, 2); g.lineTo(w / 2, h - 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(10, 12); g.lineTo(w - 10, 12); g.stroke();
    if (letter.trim()) {
      g.font = 'bold 50px "Trebuchet MS", "Fredoka", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = 'rgba(80,40,30,0.45)';
      g.strokeText(letter, w / 2, 44);
      g.fillStyle = '#fffaf0';
      g.fillText(letter, w / 2, 44);
    } else {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(24 + (k % 3) * 24, 30 + Math.floor(k / 3) * 22, 4, 0, TAU); g.fill(); }
    }
  }, { repeat: false });
}
/** Cobertura do bolo: listras verticais suaves e pontinhos de açúcar. */
function frostingTexture(base, accent) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    for (let x = 0; x < w; x += 32) { g.globalAlpha = 0.18; g.fillRect(x, 0, 12, h); }
    g.globalAlpha = 1;
    const r = rng(base.length * 7);
    for (let k = 0; k < 140; k++) {
      g.fillStyle = PARTY[k % PARTY.length];
      g.save(); g.translate(r() * w, 12 + r() * (h - 18)); g.rotate(r() * Math.PI);
      g.fillRect(-3, -1, 6, 2.2);
      g.restore();
    }
  });
}
/** Papel de presente: listras, bolinhas ou estrelinhas. */
function wrapTexture(kind, a, b) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    if (kind === 0) for (let x = -h; x < w; x += 24) { g.save(); g.translate(x, 0); g.transform(1, 0, 0.6, 1, 0, 0); g.fillRect(0, 0, 10, h); g.restore(); }
    else if (kind === 1) for (let y = 8; y < h; y += 22) for (let x = 8 + ((y / 22) % 2) * 11; x < w; x += 22) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
    else {
      for (let k = 0; k < 10; k++) {
        const x = (k * 37) % w, y = (k * 53) % h;
        g.beginPath();
        for (let t = 0; t < 10; t++) { const rr = t % 2 ? 4 : 9; const an = (t / 10) * TAU - Math.PI / 2; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
        g.fill();
      }
    }
  });
}

/** Balão de festa (gota brilhante com o nozinho). */
function balloonGeometry() {
  // de baixo para cima: o nozinho e a gota (mais estreita embaixo)
  const pts = [new THREE.Vector2(0.002, -0.205), new THREE.Vector2(0.018, -0.2), new THREE.Vector2(0.012, -0.186)];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const a = t * Math.PI;
    const rr = Math.sin(a) * (1 - 0.18 * (1 - t)) * 0.13;
    pts.push(new THREE.Vector2(Math.max(0.004, rr), -Math.cos(a) * 0.16 - 0.02 * (1 - t)));
  }
  return new THREE.LatheGeometry(pts, 20);
}

/**
 * Cabo com lâmpadas penduradas em catenária entre pontos (luzinhas da festa). Devolve as posições das lâmpadas na
 * ordem da onda (de onde a energia chega para longe).
 */
function catenary(a, b, sag, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t), a.z + (b.z - a.z) * t));
  }
  return pts;
}

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildPorch(root, layout) {
  const { PORCH, PERGOLA_POSTS, CAKE_TABLE, CAKE, GIFTS, PORCH_BENCH, LITTLE_TREE, BACK_FENCE } = layout;
  const group = new THREE.Group();
  group.name = 'varanda';

  // ---------------- deque
  // o deque começa um pouco dentro da parede da casa (a borda oeste não fica no plano do rodapé de pedra)
  const px0 = PORCH.x0 - 0.05;
  const pw = PORCH.x1 - px0, pd = PORCH.z1 - PORCH.z0 + 0.2;
  const dTex = deckTexture();
  dTex.repeat.set(pw / 1.0, pd / 1.0);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.05, pd), [
    woodMat('#8a5a36', { key: 'f10-deque-borda' }), woodMat('#8a5a36', { key: 'f10-deque-borda' }),
    new THREE.MeshStandardMaterial({ map: dTex, roughness: 0.7 }), stdMat('#3b2a20'),
    woodMat('#8a5a36', { key: 'f10-deque-borda' }), woodMat('#8a5a36', { key: 'f10-deque-borda' }),
  ]);
  deck.position.set((px0 + PORCH.x1) / 2, DECK_Y - 0.025, (PORCH.z0 - 0.2 + PORCH.z1) / 2);
  deck.receiveShadow = true;
  group.add(deck);
  // vasos com samambaias nos cantos do deque
  for (const [x, z, s] of [[PORCH.x0 + 0.3, PORCH.z1 - 0.3, 3], [PORCH.x1 - 0.25, PORCH.z0 + 0.35, 5]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.3, 16), stdMat('#c96b5a', { roughness: 0.8 }));
    pot.position.set(x, DECK_Y + 0.15, z);
    pot.castShadow = true;
    const fern = new THREE.Mesh(foliageCluster([{ x: 0, y: 0.1, z: 0, r: 0.22, sy: 0.7 }, { x: 0.1, y: 0.2, z: 0.05, r: 0.15 }], { seed: s, dark: '#2f5a2a', mid: '#4f8a3a', light: '#8fc25a', amp: 0.35 }), plantMat());
    fern.position.set(x, DECK_Y + 0.3, z);
    fern.castShadow = true;
    group.add(pot, fern);
  }

  // ---------------- pergolado
  const beamWood = woodMat('#a0704a', { key: 'f10-pergolado' });
  const postH = 2.4;
  for (const p of PERGOLA_POSTS) {
    // o topo do poste fica dentro da viga (sem face no mesmo plano)
    const post = new THREE.Mesh(rbox(0.12, postH - 0.03, 0.12, 0.015), woodMat('#a0704a', { vertical: true, key: 'f10-pergolado-poste' }));
    post.position.set(p.x, (postH - 0.03) / 2, p.z);
    post.castShadow = true;
    post.receiveShadow = true;
    const foot = new THREE.Mesh(rbox(0.18, 0.08, 0.18, 0.01), stdMat('#5a4a3a', { metalness: 0.4, roughness: 0.6 }));
    foot.position.set(p.x, 0.04, p.z);
    group.add(post, foot);
  }
  const xs = [PERGOLA_POSTS[0].x, PERGOLA_POSTS[1].x];
  const zs = [PERGOLA_POSTS[0].z, PERGOLA_POSTS[2].z];
  for (const z of zs) {
    // a viga encosta na fachada (não passa por cima da parede: o topo dela fica no mesmo plano)
    const bx0 = PORCH.x0 + 0.02, bx1 = xs[1] + 0.25;
    const beam = new THREE.Mesh(rbox(bx1 - bx0, 0.16, 0.08, 0.012), beamWood);
    beam.position.set((bx0 + bx1) / 2, postH - 0.08, z);
    beam.castShadow = true;
    group.add(beam);
  }
  const rafters = [];
  for (let x = xs[0] - 0.1; x <= xs[1] + 0.12; x += 0.42) {
    const g = rbox(0.06, 0.12, zs[1] - zs[0] + 0.5, 0.01);
    g.translate(x, postH + 0.06, (zs[0] + zs[1]) / 2);
    rafters.push(g);
  }
  const rafterMesh = new THREE.Mesh(mergeGeometries(rafters), beamWood);
  rafterMesh.castShadow = true;
  group.add(rafterMesh);
  // trepadeira sobre a viga do fundo, com florzinhas
  const vineGeo = foliageCluster(
    Array.from({ length: 9 }, (_, i) => ({ x: xs[0] + 0.2 + i * ((xs[1] - xs[0] - 0.4) / 8), y: postH + 0.1 + (i % 2) * 0.05, z: zs[0] + 0.05, r: 0.22 + (i % 3) * 0.05, sy: 0.6 })),
    { seed: 8, dark: '#2c5226', mid: '#4a7f36', light: '#86b850', amp: 0.35 },
  );
  const vine = new THREE.Mesh(vineGeo, plantMat());
  vine.castShadow = true;
  group.add(vine);
  const flowerSkin = leafSkin(vineGeo, { count: 140, size: 0.05, seed: 3, material: stdMat('#ffffff', { roughness: 0.7, side: THREE.DoubleSide }), tint: 1 });
  flowerSkin.instanceColor = null;
  const fc = new THREE.Color();
  for (let i = 0; i < flowerSkin.count; i++) flowerSkin.setColorAt(i, fc.set(i % 3 ? '#ff9ed2' : '#fff1f6'));
  group.add(flowerSkin);
  // gavinhas pendendo do pergolado no poste noroeste
  const hang = new THREE.Mesh(foliageCluster([{ x: 0, y: 0, z: 0, r: 0.16, sy: 1.6 }, { x: 0.04, y: -0.3, z: 0, r: 0.1, sy: 1.8 }], { seed: 13, dark: '#2c5226', mid: '#4a7f36', light: '#86b850', amp: 0.3 }), plantMat());
  hang.position.set(xs[0] + 0.12, postH - 0.35, zs[0] + 0.1);
  group.add(hang);

  // ---------------- faixa de bandeirinhas "FELIZ 3 ANOS" na viga da frente (virada para a câmera)
  const letters = 'FELIZ 3 ANOS';
  const flags = [];
  const fx0 = xs[0] + 0.12, fx1 = xs[1] - 0.12, fy = postH - 0.2, fz = zs[1] + 0.06;
  const bunting = new THREE.Group();
  bunting.name = 'faixa-feliz-3-anos';
  const cordPts = catenary(new THREE.Vector3(fx0, fy, fz), new THREE.Vector3(fx1, fy, fz), 0.18, 24);
  const cordMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 48, 0.006, 5), stdMat('#f4f1ea'));
  bunting.add(cordMesh);
  for (let i = 0; i < letters.length; i++) {
    const t = (i + 0.5) / letters.length;
    const x = fx0 + (fx1 - fx0) * t;
    const y = fy - 0.18 * 4 * t * (1 - t);
    const color = letters[i] === '3' ? '#f6c453' : PARTY[i % PARTY.length];
    const geo = new THREE.PlaneGeometry(0.24, 0.28);
    geo.translate(0, -0.14, 0);
    const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTexture(letters[i], color), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 }));
    flag.position.set(x, y, fz);
    flag.castShadow = true;
    bunting.add(flag);
    flags.push({ flag, ph: i * 0.7 });
  }
  group.add(bunting);

  // ---------------- lampião de papel (acende com as luzinhas) no meio do pergolado
  const lanternPos = new THREE.Vector3((xs[0] + xs[1]) / 2 - 0.4, postH - 0.55, (zs[0] + zs[1]) / 2 + 0.2);
  const paperMat = new THREE.MeshStandardMaterial({ color: '#ffe8c8', emissive: '#ffb86a', emissiveIntensity: 0.05, roughness: 0.9, side: THREE.DoubleSide });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), paperMat);
  lantern.scale.y = 0.85;
  lantern.position.copy(lanternPos);
  const ribs = new THREE.Mesh(new THREE.SphereGeometry(0.202, 12, 6), new THREE.MeshBasicMaterial({ color: '#c96b5a', wireframe: true, transparent: true, opacity: 0.25 }));
  ribs.scale.y = 0.85;
  ribs.position.copy(lanternPos);
  const lanternCord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, postH + 0.06 - lanternPos.y - 0.17, 4), stdMat('#2d2a28'));
  lanternCord.position.set(lanternPos.x, (postH + 0.06 + lanternPos.y + 0.17) / 2, lanternPos.z);
  group.add(lantern, ribs, lanternCord);

  // ---------------- mesa do bolo com toalha de babado, pratinhos, copinhos e guardanapos
  const table = new THREE.Group();
  table.name = 'mesa-do-bolo';
  const clothTex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#fffaf2'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(242,122,138,0.55)';
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.arc(x + 16, h, 16, Math.PI, 0); g.fill(); }
    g.fillStyle = 'rgba(246,196,83,0.6)';
    for (let x = 8; x < w; x += 32) { g.beginPath(); g.arc(x + 8, 18, 4, 0, TAU); g.fill(); }
  });
  clothTex.repeat.set(4, 1);
  const top = new THREE.Mesh(new THREE.BoxGeometry(CAKE_TABLE.hx * 2 + 0.08, 0.03, CAKE_TABLE.hz * 2 + 0.08), stdMat('#fffaf2', { roughness: 0.95 }));
  top.position.y = CAKE_TABLE.h - 0.015;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.04, 0.36, 4, 1, true).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.95, side: THREE.DoubleSide }));
  skirt.scale.set((CAKE_TABLE.hx + 0.045) * Math.SQRT2, 1, (CAKE_TABLE.hz + 0.045) * Math.SQRT2);
  skirt.position.y = CAKE_TABLE.h - 0.19;
  table.add(top, skirt);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, CAKE_TABLE.h - 0.35, 8), woodMat('#e8d8c0', { key: 'f10-mesa-bolo' }));
    leg.position.set(sx * (CAKE_TABLE.hx - 0.06), (CAKE_TABLE.h - 0.35) / 2, sz * (CAKE_TABLE.hz - 0.06));
    table.add(leg);
  }
  const plateG = new THREE.CylinderGeometry(0.075, 0.062, 0.01, 20);
  const cupG = new THREE.CylinderGeometry(0.03, 0.022, 0.08, 14, 1, true);
  const strawG = new THREE.CylinderGeometry(0.004, 0.004, 0.12, 5);
  const placements = [[-0.55, 0.22], [-0.55, -0.22], [0.55, 0.22], [0.55, -0.22]];
  placements.forEach(([x, z], i) => {
    const pl = new THREE.Mesh(plateG, stdMat(PARTY[(i + 2) % 6], { roughness: 0.5 }));
    pl.position.set(x, CAKE_TABLE.h + 0.006, z);
    const cup = new THREE.Mesh(cupG, stdMat(PARTY[i], { roughness: 0.6, side: THREE.DoubleSide }));
    cup.position.set(x + (x < 0 ? 0.12 : -0.12), CAKE_TABLE.h + 0.04, z * 0.5);
    const straw = new THREE.Mesh(strawG, stdMat('#fffaf0'));
    straw.position.set(cup.position.x + 0.01, CAKE_TABLE.h + 0.1, cup.position.z);
    straw.rotation.z = 0.25;
    table.add(pl, cup, straw);
  });
  const napkins = new THREE.Mesh(rbox(0.12, 0.04, 0.12, 0.01), stdMat('#ff9ed2', { roughness: 1 }));
  napkins.position.set(0.34, CAKE_TABLE.h + 0.02, -0.3);
  napkins.rotation.y = 0.4;
  table.add(napkins);
  table.position.set(CAKE_TABLE.x, DECK_Y, CAKE_TABLE.z);
  table.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(table);
  const tShadow = contactShadow(CAKE_TABLE.hx + 0.15, CAKE_TABLE.hz + 0.15, 0.4, DECK_Y + 0.004);
  tShadow.position.x = CAKE_TABLE.x; tShadow.position.z = CAKE_TABLE.z;
  group.add(tShadow);

  // ---------------- o BOLO
  const cakeGroup = new THREE.Group();
  cakeGroup.name = 'bolo';
  const board = new THREE.Mesh(new THREE.CylinderGeometry(CAKE.tiers[0].r + 0.06, CAKE.tiers[0].r + 0.06, 0.02, 40), new THREE.MeshStandardMaterial({ color: '#e6c25a', metalness: 0.75, roughness: 0.3 }));
  board.position.y = 0.01;
  cakeGroup.add(board);
  const tierCols = [['#f6b2c4', '#ffd6e2'], ['#fbe3a8', '#fff2d0'], ['#f6b2c4', '#ffd6e2']];
  const tierY = [];
  let y = 0.02;
  const pearlG = new THREE.SphereGeometry(0.012, 8, 6);
  const pearlPts = [];
  CAKE.tiers.forEach((t, i) => {
    tierY.push(y);
    const tex = frostingTexture(tierCols[i][0], tierCols[i][1]);
    tex.repeat.set(2, 1);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, t.h, 48, 1), [
      new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.55, clearcoat: 0.3, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }),
      new THREE.MeshPhysicalMaterial({ color: '#fffaf2', roughness: 0.5, clearcoat: 0.4 }),
      new THREE.MeshPhysicalMaterial({ color: '#fffaf2', roughness: 0.5 }),
    ]);
    body.position.y = y + t.h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    cakeGroup.add(body);
    // cobertura escorrendo no alto (gotas de comprimentos variados)
    const r = rng(i * 13 + 5);
    const drips = [];
    const nd = Math.round(t.r * 60);
    for (let k = 0; k < nd; k++) {
      const a = (k / nd) * TAU + r() * 0.05;
      const len = 0.02 + r() * 0.05;
      const g = new THREE.CapsuleGeometry(0.012 + r() * 0.004, len, 3, 6);
      g.translate(Math.cos(a) * (t.r + 0.002), y + t.h - len / 2 - 0.004, Math.sin(a) * (t.r + 0.002));
      drips.push(g);
    }
    const lip = new THREE.TorusGeometry(t.r - 0.004, 0.012, 6, 48).rotateX(Math.PI / 2);
    lip.translate(0, y + t.h, 0);
    drips.push(lip);
    const icing = new THREE.Mesh(mergeGeometries(drips.map((g) => g.index ? g.toNonIndexed() : g)), new THREE.MeshPhysicalMaterial({ color: '#fffaf2', roughness: 0.35, clearcoat: 0.6 }));
    icing.castShadow = true;
    cakeGroup.add(icing);
    // perolinhas na base do andar
    const np = Math.round(t.r * 2 * Math.PI / 0.026);
    for (let k = 0; k < np; k++) {
      const a = (k / np) * TAU;
      pearlPts.push(new THREE.Vector3(Math.cos(a) * (t.r + 0.006), y + 0.01, Math.sin(a) * (t.r + 0.006)));
    }
    y += t.h;
  });
  const pearls = new THREE.InstancedMesh(pearlG, new THREE.MeshPhysicalMaterial({ color: '#fff6e6', roughness: 0.2, clearcoat: 1, sheen: 1 }), pearlPts.length);
  const m4 = new THREE.Matrix4();
  pearlPts.forEach((p, i) => pearls.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  cakeGroup.add(pearls);
  // granulado no alto de cada andar (no anel que aparece)
  const sprG = new THREE.CapsuleGeometry(0.0035, 0.012, 2, 4).rotateZ(Math.PI / 2);
  const spr = [];
  const rs = rng(71);
  CAKE.tiers.forEach((t, i) => {
    const inner = i < 2 ? CAKE.tiers[i + 1].r : 0;
    const topY = tierY[i] + t.h + 0.003;
    for (let k = 0; k < 90 * t.r; k++) {
      const a = rs() * TAU, rr = inner + 0.01 + rs() * (t.r - inner - 0.025);
      spr.push({ x: Math.cos(a) * rr, y: topY, z: Math.sin(a) * rr, a: rs() * TAU, c: PARTY[k % 6] });
    }
  });
  const sprMesh = new THREE.InstancedMesh(sprG, new THREE.MeshStandardMaterial({ roughness: 0.5 }), spr.length);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3(), cc = new THREE.Color();
  spr.forEach((s, i) => {
    q.setFromEuler(e.set(0, s.a, 0));
    sprMesh.setMatrixAt(i, m4.compose(pv.set(s.x, s.y, s.z), q, one));
    sprMesh.setColorAt(i, cc.set(s.c));
  });
  cakeGroup.add(sprMesh);
  // a faixa de cetim que aparece no andar de baixo quando o laço chega
  const band = new THREE.Mesh(new THREE.CylinderGeometry(CAKE.tiers[0].r + 0.004, CAKE.tiers[0].r + 0.004, 0.035, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: '#e0568e', roughness: 0.3, sheen: 1, sheenColor: new THREE.Color('#ffd0e3'), side: THREE.DoubleSide }));
  band.position.y = tierY[0] + CAKE.tiers[0].h * 0.45;
  band.visible = false;
  cakeGroup.add(band);
  // lugares dos enfeites: o laço na frente do andar de baixo, a vela no anel do meio e o chapéu no topo
  const spots = [0, 1, 2].map((i) => {
    const o = new THREE.Object3D();
    cakeGroup.add(o);
    return o;
  });
  spots[0].position.set(0, tierY[0] + CAKE.tiers[0].h * 0.5, CAKE.tiers[0].r + 0.012);
  spots[1].position.set(0.05, tierY[1] + CAKE.tiers[1].h + 0.002, (CAKE.tiers[1].r + CAKE.tiers[2].r) / 2);
  spots[2].position.set(0, tierY[2] + CAKE.tiers[2].h + 0.002, 0);
  /** Ponto de tentativa num andar (de onde o enfeite errado balança e cai). */
  const trySpot = (tier) => {
    const i = Math.min(2, tier);
    const t = CAKE.tiers[i];
    const inner = i < 2 ? CAKE.tiers[i + 1].r : 0;
    return new THREE.Vector3(0, tierY[i] + t.h + 0.002, i < 2 ? (t.r + inner) / 2 : 0);
  };
  cakeGroup.position.set(CAKE.x, CAKE.base + DECK_Y, CAKE.z);
  group.add(cakeGroup);
  // anel de destaque na mesa (quem traz um enfeite vê onde entregar)
  const ringMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.5);
      gr.addColorStop(0, 'rgba(255,230,160,0)'); gr.addColorStop(0.6, 'rgba(255,230,160,0.9)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, { repeat: false }),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  });
  const hlRing = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2), ringMat);
  hlRing.position.set(CAKE.x, CAKE_TABLE.h + DECK_Y + 0.004, CAKE.z);
  hlRing.renderOrder = 3;
  group.add(hlRing);

  // ---------------- presentes
  const gifts = new THREE.Group();
  const giftDefs = [
    { x: -0.18, z: 0.05, w: 0.34, h: 0.28, d: 0.3, k: 0, a: '#7cc4e8', b: '#fffaf0', rb: '#f27a8a', ry: 0.2 },
    { x: 0.2, z: -0.04, w: 0.28, h: 0.22, d: 0.26, k: 1, a: '#f27a8a', b: '#fff1d9', rb: '#f6c453', ry: -0.3 },
    { x: -0.12, z: 0.0, w: 0.22, h: 0.18, d: 0.2, k: 2, a: '#c79af0', b: '#fff6c0', rb: '#9bd57a', ry: 0.6, y: 0.28 },
    { x: 0.28, z: 0.2, w: 0.18, h: 0.16, d: 0.18, k: 1, a: '#9bd57a', b: '#ffffff', rb: '#c79af0', ry: 0.1 },
  ];
  for (const d of giftDefs) {
    const gm = new THREE.Group();
    const bx = new THREE.Mesh(rbox(d.w, d.h, d.d, 0.012), new THREE.MeshStandardMaterial({ map: wrapTexture(d.k, d.a, d.b), roughness: 0.6 }));
    bx.position.y = d.h / 2;
    gm.add(bx);
    const rMat = new THREE.MeshPhysicalMaterial({ color: d.rb, roughness: 0.3, sheen: 1 });
    for (const [w, dd] of [[d.w + 0.004, 0.035], [0.035, d.d + 0.004]]) {
      const rb = new THREE.Mesh(new THREE.BoxGeometry(w, d.h + 0.004, dd), rMat);
      rb.position.y = d.h / 2;
      gm.add(rb);
    }
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 14), rMat);
      loop.position.set(s * 0.03, d.h + 0.025, 0);
      loop.rotation.set(0, Math.PI / 2, s * 0.6);
      gm.add(loop);
    }
    gm.position.set(GIFTS.x + d.x, DECK_Y + (d.y || 0), GIFTS.z + d.z);
    gm.rotation.y = d.ry;
    gifts.add(gm);
  }
  gifts.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(gifts);

  // ---------------- banco com almofadas e a sacolinha de lembrancinhas
  const bench = new THREE.Group();
  const bWood = woodMat('#7a4a2a', { key: 'f10-banco' });
  const bSeat = new THREE.Mesh(rbox(PORCH_BENCH.hx * 2, 0.05, PORCH_BENCH.hz * 2 + 0.06, 0.012), bWood);
  bSeat.position.y = PORCH_BENCH.h;
  const bBack = new THREE.Mesh(rbox(PORCH_BENCH.hx * 2, 0.36, 0.04, 0.012), bWood);
  bBack.position.set(0, PORCH_BENCH.h + 0.24, -PORCH_BENCH.hz);
  bench.add(bSeat, bBack);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(rbox(0.05, PORCH_BENCH.h, PORCH_BENCH.hz * 2, 0.01), bWood);
    leg.position.set(sx * (PORCH_BENCH.hx - 0.06), PORCH_BENCH.h / 2, 0);
    bench.add(leg);
  }
  for (const [x, c] of /** @type {[number, string][]} */ ([[-0.3, '#9bd57a'], [0.22, '#f6c453']])) {
    const pil = new THREE.Mesh(rbox(0.3, 0.26, 0.1, 0.05), stdMat(c, { roughness: 1 }));
    pil.position.set(x, PORCH_BENCH.h + 0.17, -PORCH_BENCH.hz + 0.08);
    pil.rotation.set(-0.25, x * 0.4, x * 0.3);
    bench.add(pil);
  }
  const bag = new THREE.Mesh(rbox(0.16, 0.2, 0.08, 0.01), new THREE.MeshStandardMaterial({ map: wrapTexture(1, '#ff9ed2', '#ffffff'), roughness: 0.8 }));
  bag.position.set(0.42, PORCH_BENCH.h + 0.125, 0.02);
  const bagH = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 14, Math.PI), stdMat('#fffaf0'));
  bagH.position.set(0.42, PORCH_BENCH.h + 0.225, 0.02);
  bench.add(bag, bagH);
  bench.position.set(PORCH_BENCH.x, DECK_Y, PORCH_BENCH.z);
  bench.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(bench);

  // ---------------- buquês de balões amarrados nos postes da frente e na mesa
  const balloonG = balloonGeometry();
  const balloons = [];
  const bouquet = (ax, ay, az, cols, seed) => {
    const r = rng(seed);
    cols.forEach((c, i) => {
      const b = new THREE.Mesh(balloonG, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.3 }));
      const off = new THREE.Vector3((r() - 0.5) * 0.36, 0.55 + r() * 0.35, (r() - 0.5) * 0.24);
      b.castShadow = true;
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 1, 4), stdMat('#f4f1ea'));
      group.add(b, str);
      balloons.push({ b, str, anchor: new THREE.Vector3(ax, ay, az), off, ph: r() * TAU });
    });
  };
  bouquet(PERGOLA_POSTS[3].x + 0.08, 1.0, PERGOLA_POSTS[3].z + 0.08, ['#f27a8a', '#f6c453', '#ff9ed2'], 3);
  bouquet(PERGOLA_POSTS[2].x - 0.08, 1.0, PERGOLA_POSTS[2].z + 0.08, ['#7cc4e8', '#c79af0', '#9bd57a'], 7);
  bouquet(CAKE_TABLE.x - CAKE_TABLE.hx + 0.05, CAKE_TABLE.h + 0.02, CAKE_TABLE.z - CAKE_TABLE.hz + 0.05, ['#f6c453', '#ff9ed2'], 11);

  // ---------------- varal de luzinhas: pergolado (zigue-zague) → arvorezinha → mourão do portão
  const strands = [];
  const P0 = new THREE.Vector3(xs[0] + 0.05, postH - 0.02, zs[0] + 0.05);
  const zz = [
    [new THREE.Vector3(xs[0] + 0.05, postH - 0.02, zs[0] + 0.05), new THREE.Vector3(xs[1] - 0.05, postH - 0.02, zs[0] + 0.9)],
    [new THREE.Vector3(xs[1] - 0.05, postH - 0.02, zs[0] + 0.9), new THREE.Vector3(xs[0] + 0.05, postH - 0.02, zs[0] + 1.75)],
    [new THREE.Vector3(xs[0] + 0.05, postH - 0.02, zs[0] + 1.75), new THREE.Vector3(xs[1] - 0.05, postH - 0.02, zs[1] - 0.25)],
    [new THREE.Vector3(xs[1] - 0.05, postH - 0.02, zs[1] - 0.25), new THREE.Vector3(LITTLE_TREE.x - 0.1, 1.85, LITTLE_TREE.z + 0.15)],
    [new THREE.Vector3(LITTLE_TREE.x - 0.1, 1.85, LITTLE_TREE.z + 0.15), new THREE.Vector3(BACK_FENCE.x - 0.05, BACK_FENCE.h + 0.32, BACK_FENCE.gate.z0 - 0.1)],
  ];
  const bulbPts = [];
  let dist = 0;
  for (const [a, b] of zz) {
    const len = a.distanceTo(b);
    const sag = Math.min(0.5, len * 0.09);
    const pts = catenary(a, b, sag, 30);
    strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.005, 4));
    const n = Math.max(4, Math.round(len / 0.32));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      bulbPts.push({ p: new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t) - 0.05, a.z + (b.z - a.z) * t), d: dist + t * len });
    }
    dist += len;
  }
  const wire = new THREE.Mesh(mergeGeometries(strands), stdMat('#2d2a28', { roughness: 0.6 }));
  group.add(wire);
  const bulbG = new THREE.SphereGeometry(0.032, 12, 8);
  bulbG.scale(1, 1.25, 1);
  // lâmpadas sem luz (a cor por instância é o brilho: acima de 1 o bloom pega)
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const bulbs = new THREE.InstancedMesh(bulbG, bulbMat, bulbPts.length);
  const capG = new THREE.CylinderGeometry(0.012, 0.012, 0.025, 6);
  const caps = new THREE.InstancedMesh(capG, stdMat('#2d2a28'), bulbPts.length);
  const bulbCols = ['#ffd38a', '#ff9ed2', '#9be0ff', '#fff1b0', '#c4f59a'];
  bulbPts.forEach((b, i) => {
    bulbs.setMatrixAt(i, m4.makeTranslation(b.p.x, b.p.y, b.p.z));
    caps.setMatrixAt(i, m4.makeTranslation(b.p.x, b.p.y + 0.04, b.p.z));
    bulbs.setColorAt(i, cc.set('#8a8478'));
  });
  bulbs.castShadow = false;
  group.add(bulbs, caps);
  // halo de cada lâmpada (sprite aditivo, só quando acesas)
  const haloTex = canvasTexture(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: false });
  // as auréolas: um só desenho (pontos aditivos; a cor de cada um é o brilho, preto = apagado)
  const haloGeo = new THREE.BufferGeometry().setFromPoints(bulbPts.map((b) => b.p));
  const haloCol = new Float32Array(bulbPts.length * 3);
  haloGeo.setAttribute('color', new THREE.BufferAttribute(haloCol, 3));
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({
    map: haloTex, size: 0.24, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halos.frustumCulled = false;
  halos.renderOrder = 4;
  group.add(halos);
  const haloTint = bulbPts.map((_, i) => new THREE.Color(bulbCols[i % bulbCols.length]));

  const st = { on: false, onT: -1, hl: false, hlK: 0, lit: false, litT: 0, rejectT: 0 };
  const total = dist;
  const lights = {
    /** Liga (onda a partir do pergolado) ou apaga as luzinhas da festa. */
    setOn(on) {
      if (on && !st.on) st.onT = 0;
      if (!on) st.onT = -1;
      st.on = !!on;
    },
    get on() { return st.on; },
    bulbs: bulbPts.map((b) => b.p),
    start: P0,
  };

  const cake = {
    object: cakeGroup,
    spots,
    /** Prende o enfeite no lugar do andar (sem animação: chegou pela boca da dog). */
    place(thing, tier, obj) {
      const spot = spots[Math.min(2, tier)];
      if (!obj) return;
      spot.add(obj);
      obj.position.set(0, 0, 0);
      obj.rotation.set(0, 0, 0);
      if (thing === 'ribbon') band.visible = true;
    },
    /** Enfeite fora de ordem: k 0..0.45 balança no andar; 0.45..1 cai num arco até (x, z) no chão. */
    reject(thing, tier, k, x, z, obj) {
      if (!obj) return;
      const s = trySpot(tier);
      const w = new THREE.Vector3().copy(s).applyMatrix4(cakeGroup.matrixWorld);
      root.add(obj);
      if (k < 0.45) {
        const u = k / 0.45;
        obj.position.copy(w);
        obj.rotation.set(Math.sin(u * TAU * 2.2) * 0.35 * (1 - u * 0.3), 0, Math.sin(u * TAU * 2.2 + 1) * 0.3);
      } else {
        const u = (k - 0.45) / 0.55;
        const e2 = smooth(u);
        obj.position.set(w.x + (x - w.x) * e2, w.y * (1 - u * u) + Math.sin(Math.PI * u) * 0.18 + 0.01 * u, w.z + (z - w.z) * e2);
        obj.rotation.set(u * 2.4, u * 1.3, u * 1.1);
      }
    },
    light() { st.lit = true; st.litT = 0; },
    setHighlight(on) { st.hl = !!on; },
    reset() {
      band.visible = false;
      st.lit = false;
      st.hl = false;
    },
    get lit() { return st.lit; },
  };

  root.add(group);
  return {
    group, cake, lights, lanternPos, paperMat,
    update(dt, t) {
      // bandeirinhas balançando
      for (const f of flags) f.flag.rotation.x = Math.sin(t * 1.6 + f.ph) * 0.18 + 0.05;
      // balões
      for (const b of balloons) {
        const p = b.b.position;
        p.set(b.anchor.x + b.off.x + Math.sin(t * 0.9 + b.ph) * 0.03, b.anchor.y + b.off.y + Math.sin(t * 1.3 + b.ph) * 0.025, b.anchor.z + b.off.z + Math.cos(t * 0.7 + b.ph) * 0.03);
        b.b.rotation.z = Math.sin(t * 0.8 + b.ph) * 0.12;
        const knot = p.clone();
        knot.y -= 0.2;
        b.str.position.copy(knot).add(b.anchor).multiplyScalar(0.5);
        b.str.scale.y = Math.max(0.05, knot.distanceTo(b.anchor));
        b.str.lookAt(knot);
        b.str.rotateX(Math.PI / 2);
      }
      // luzinhas: onda acendendo (cada lâmpada pisca forte quando a onda passa e fica acesa, tremulando de leve)
      if (st.onT >= 0) st.onT += dt;
      const front = st.onT >= 0 ? st.onT * 5.5 : -1;
      bulbPts.forEach((b, i) => {
        let k = 0;
        if (st.on && front >= b.d) {
          const since = (front - b.d) / 5.5;
          k = 0.85 + 0.15 * Math.sin(t * 3 + i * 1.7) + Math.max(0, 1 - since * 3) * 0.8;
        }
        cc.set(k > 0 ? bulbCols[i % bulbCols.length] : '#8a8478');
        if (k > 0) cc.multiplyScalar(1 + k * 1.6);
        bulbs.setColorAt(i, cc);
        const a = Math.min(1, k * 0.75);
        haloCol[i * 3] = haloTint[i].r * a;
        haloCol[i * 3 + 1] = haloTint[i].g * a;
        haloCol[i * 3 + 2] = haloTint[i].b * a;
      });
      bulbs.instanceColor.needsUpdate = true;
      haloGeo.attributes.color.needsUpdate = true;
      paperMat.emissiveIntensity += ((st.on ? 0.9 : 0.05) - paperMat.emissiveIntensity) * (1 - Math.exp(-dt * 3));
      // destaque do bolo
      st.hlK += ((st.hl ? 1 : 0) - st.hlK) * (1 - Math.exp(-dt * 5));
      ringMat.opacity = st.hlK * (0.55 + 0.25 * Math.sin(t * 4));
      hlRing.scale.setScalar(1 + 0.06 * Math.sin(t * 4));
    },
  };
}
