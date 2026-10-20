// FASE 10 · A casa na árvore no fundo do quintal: a árvore grande (tronco com casca e raízes atravessando o canto de
// trás do deque, galhos e a copa alta), o deque largo sobre seis postes com o corrimão (aberto na frente, onde o balde
// chega, e no lado leste, na boca do escorregador) e as bandeirinhas presas nele, a casinha "Clubinho R & R" nos
// fundos com janela redonda, telhado vermelho, bandeirinha e lanterna, a luneta no canto e o baú de brinquedos, o
// braço da roldana com o balde de lata (sobe e desce na frente do deque), a corda da roldana até a argola no chão e a
// ponta com o pegador de madeira, o cano de brinquedo colorido do funil (no chão) até a boca de trompete do lado do
// pombo (as baforadas de cheiro sobem por dentro), o pombo cochilando no corrimão em cima do laço e o escorregador
// amarelo do deque até o gramado.
// API: buildTreehouse(root, layout) → { group, bucket, rope, tube, pigeon, lanternPos, seeThrough, update(dt, t) }
import * as THREE from 'three';
import { rng, rbox, canvasTexture, stdMat, woodMat, foliageCluster, leafSkin, contactShadow, mergeGeometries, brassMat } from '../../../world/util.js';
import { crownMat } from '../../../world/plants.js';
import { createPigeon } from '../../../world/pigeon.js';

const TAU = Math.PI * 2;

/** Casca de árvore (veios verticais escuros, liquens). */
function barkTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    const r = rng(23);
    g.fillStyle = '#6a4e38'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 70; k++) {
      const x = r() * w;
      g.strokeStyle = `rgba(${30 + r() * 20},${20 + r() * 14},${12},${0.35 + r() * 0.3})`;
      g.lineWidth = 1 + r() * 3;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y < h; y += 16) g.lineTo(x + (r() - 0.5) * 8, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(140,160,110,0.3)';
    for (let k = 0; k < 20; k++) { g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 6, 0, TAU); g.fill(); }
  });
}
/** Placa pintada da casinha. */
function clubSignTexture() {
  return canvasTexture(256, 96, (g, w, h) => {
    g.fillStyle = '#f6e3b0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#c94a5a'; g.font = 'bold 34px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Clubinho R & R', w / 2, h / 2 - 6);
    g.fillStyle = '#8a5a3c';
    for (let k = 0; k < 2; k++) {
      const x = 40 + k * 176, y = 76;
      g.beginPath(); g.ellipse(x, y, 7, 6, 0, 0, TAU); g.fill();
      for (let t = 0; t < 4; t++) { g.beginPath(); g.arc(x - 10 + t * 6.6, y - 9 - (t === 1 || t === 2 ? 3 : 0), 2.6, 0, TAU); g.fill(); }
    }
  }, { repeat: false });
}

/** Tubo por uma curva (cano de brinquedo, galhos). */
const tube = (curve, segs, radius, radial = 10) => new THREE.TubeGeometry(curve, segs, radius, radial, false);

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildTreehouse(root, layout) {
  const { TREE, DECK, DECK_POSTS, DECK_RAIL, HUT, DECK_PROPS, PIGEON, TUBE, BUCKET, ROPE, SLIDE, RIBBON } = layout;
  const group = new THREE.Group();
  group.name = 'casa-na-arvore';
  const seeThrough = [];
  const deckWood = woodMat('#b07a4c', { key: 'f10-deque-arvore' });
  const darkWood = woodMat('#7a5234', { key: 'f10-deque-arvore-escuro', vertical: true });
  const top = DECK.h;

  // ================================================================ árvore
  const tree = new THREE.Group();
  tree.name = 'arvore';
  const barkMap = barkTexture();
  barkMap.repeat.set(2, 2);
  const bark = new THREE.MeshStandardMaterial({ map: barkMap, roughness: 0.95, bumpMap: barkMap, bumpScale: 1.2 });
  const trunkPts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    trunkPts.push(new THREE.Vector3(TREE.x + Math.sin(t * 2.4) * 0.08, t * 4.4, TREE.z + Math.cos(t * 1.9) * 0.06 - t * 0.2));
  }
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);
  const trunkGeo = tube(trunkCurve, 24, TREE.r, 14);
  // afunila para cima e alarga nas raízes
  const tp = trunkGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const seg = Math.floor(i / 15) / 24;
    const c = trunkCurve.getPointAt(Math.min(1, seg));
    const k = (1 - seg * 0.5) * (1 + Math.max(0, 0.12 - seg) * 3.5);
    tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * k, tp.getY(i), c.z + (tp.getZ(i) - c.z) * k);
  }
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, bark);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);
  // raízes saindo pelo chão: afinam do tronco (7 cm) para a ponta (3 cm) e mergulham logo; além do colisor do tronco,
  // que vai a TREE.r + 0,18, ficam abaixo de 8 cm (a pata passa por cima)
  const roots = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + 0.4;
    const c = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(TREE.x + Math.cos(a) * 0.3, 0.3, TREE.z + Math.sin(a) * 0.3),
      new THREE.Vector3(TREE.x + Math.cos(a) * 0.45, 0, TREE.z + Math.sin(a) * 0.45),
      new THREE.Vector3(TREE.x + Math.cos(a) * 0.92, -0.03, TREE.z + Math.sin(a) * 0.92),
    );
    const g = tube(c, 8, 0.07, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / 9) / 8;
      const cc = c.getPointAt(Math.min(1, seg));
      const s = (0.03 + 0.04 * (1 - seg) ** 2) / 0.07;
      p.setXYZ(i, cc.x + (p.getX(i) - cc.x) * s, cc.y + (p.getY(i) - cc.y) * s, cc.z + (p.getZ(i) - cc.z) * s);
    }
    g.computeVertexNormals();
    roots.push(g);
  }
  const rootMesh = new THREE.Mesh(mergeGeometries(roots), bark);
  rootMesh.castShadow = true;
  tree.add(rootMesh);
  // galhos acima do deque, abrindo para a copa
  const branches = [];
  const branchDefs = [[0.6, 3.3, -0.2, 1.0, 4.6, -0.7], [-0.7, 3.5, 0.0, -1.2, 4.5, -0.4], [0.1, 3.8, -0.5, 0.3, 5.0, -1.3], [-0.2, 3.1, 0.3, -0.6, 4.1, 0.6]];
  for (const [mx, my, mz, ex, ey, ez] of branchDefs) {
    const c = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(TREE.x, my - 0.5, TREE.z - 0.1),
      new THREE.Vector3(TREE.x + mx * 0.6, my, TREE.z + mz * 0.6),
      new THREE.Vector3(TREE.x + ex, ey, TREE.z + ez),
    );
    const g = tube(c, 10, 0.1, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / 9) / 10;
      const cc = c.getPoint(Math.min(1, seg));
      const k = 1 - seg * 0.6;
      p.setXYZ(i, cc.x + (p.getX(i) - cc.x) * k, cc.y + (p.getY(i) - cc.y) * k, cc.z + (p.getZ(i) - cc.z) * k);
    }
    g.computeVertexNormals();
    branches.push(g);
  }
  const branchMesh = new THREE.Mesh(mergeGeometries(branches), bark);
  branchMesh.castShadow = true;
  tree.add(branchMesh);
  // copa alta (atrás e acima da casinha, para não esconder o deque da câmera)
  const r = rng(91);
  const blobs = [];
  for (let k = 0; k < 11; k++) {
    const a = r() * TAU, d = 0.4 + r() * 1.3;
    blobs.push({ x: TREE.x + Math.cos(a) * d, y: 4.7 + r() * 1.1, z: TREE.z - 0.5 + Math.sin(a) * d * 0.8 - 0.3, r: 0.75 + r() * 0.45 });
  }
  blobs.push({ x: TREE.x, y: 5.4, z: TREE.z - 0.6, r: 1.3 });
  const crownGeo = foliageCluster(blobs, { detail: 3, amp: 0.3, freq: 1.4, seed: 91, dark: '#24401a', mid: '#3f6c2c', light: '#8db254' });
  const crown = new THREE.Mesh(crownGeo, crownMat());
  crown.castShadow = true;
  crown.receiveShadow = true;
  const leaves = leafSkin(crownGeo, { count: 1400, size: 0.11, seed: 91, material: crownMat() });
  tree.add(crown, leaves);
  group.add(tree);
  const trShadow = contactShadow(1.6, 1.4, 0.35);
  trShadow.position.set(TREE.x, 0.006, TREE.z);
  group.add(trShadow);

  // ================================================================ deque
  const deck = new THREE.Group();
  deck.name = 'deque';
  const dw = DECK.x1 - DECK.x0, dd = DECK.z1 - DECK.z0;
  // tábuas (com o buraco do tronco: cada tábua para no contorno do tronco, na altura do deque) e o colar em volta
  const boards = [];
  const bw = 0.14;
  const tc = trunkCurve.getPoint(top / 4.4);
  const holeR = TREE.r * (1 - 0.5 * (top / 4.4)) + 0.035;
  for (let z = DECK.z0 + bw / 2; z < DECK.z1; z += bw) {
    const dz = Math.max(0, Math.abs(z - tc.z) - bw / 2);
    const half = dz < holeR ? Math.sqrt(holeR * holeR - dz * dz) : 0;
    const segsX = half > 0 ? [[DECK.x0, tc.x - half], [tc.x + half, DECK.x1]] : [[DECK.x0, DECK.x1]];
    for (const [a, b] of segsX) {
      const g = new THREE.BoxGeometry(b - a - 0.01, 0.04, bw - 0.012);
      g.translate((a + b) / 2, top - 0.02, z);
      boards.push(g);
    }
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(holeR + 0.012, 0.032, 8, 32).rotateX(Math.PI / 2), darkWood);
  collar.position.set(tc.x, top + 0.006, tc.z);
  collar.scale.y = 0.55;
  collar.receiveShadow = true;
  deck.add(collar);
  const boardMesh = new THREE.Mesh(mergeGeometries(boards), deckWood);
  boardMesh.castShadow = true;
  boardMesh.receiveShadow = true;
  deck.add(boardMesh);
  // vigas por baixo e o rodapé do deque
  const beams = [];
  for (const z of [DECK.z0 + 0.06, DECK.z1 - 0.06, (DECK.z0 + DECK.z1) / 2]) {
    const g = new THREE.BoxGeometry(dw, 0.12, 0.08);
    g.translate((DECK.x0 + DECK.x1) / 2, top - 0.1, z);
    beams.push(g);
  }
  for (const x of [DECK.x0 + 0.06, DECK.x1 - 0.06]) {
    const g = new THREE.BoxGeometry(0.08, 0.12, dd);
    g.translate(x, top - 0.1, (DECK.z0 + DECK.z1) / 2);
    beams.push(g);
  }
  const beamMesh = new THREE.Mesh(mergeGeometries(beams), darkWood);
  beamMesh.castShadow = true;
  deck.add(beamMesh);
  // postes e mãos-francesas
  for (const p of DECK_POSTS) {
    // o topo do poste fica embaixo das tábuas (sem face no mesmo plano)
    const post = new THREE.Mesh(rbox(0.13, top - 0.03, 0.13, 0.015), darkWood);
    post.position.set(p.x, (top - 0.03) / 2, p.z);
    post.castShadow = true;
    post.receiveShadow = true;
    deck.add(post);
    const sx = p.x < (DECK.x0 + DECK.x1) / 2 ? 1 : -1;
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), darkWood);
    brace.position.set(p.x + sx * 0.18, top - 0.32, p.z);
    brace.rotation.z = -sx * 0.6;
    deck.add(brace);
  }
  // corrimão: frente (sul) aberta onde o balde chega e na boca do escorregador; leste inteiro (a casinha fecha o canto
  // de trás); oeste inteiro; fundo até a casinha
  const railH = DECK_RAIL.h;
  const railMat = woodMat('#c48a58', { key: 'f10-corrimao' });
  const rails = [];
  const balusters = [];
  const railRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(0.06, 0.04, len);
    g.rotateY(ang);
    g.translate((x0 + x1) / 2, top + railH - 0.02, (z0 + z1) / 2);
    rails.push(g);
    const n = Math.max(2, Math.round(len / 0.16));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const b = new THREE.BoxGeometry(0.035, railH - 0.02, 0.035);
      b.translate(x0 + (x1 - x0) * t, top + (railH - 0.02) / 2, z0 + (z1 - z0) * t);
      balusters.push(b);
    }
  };
  const ri = DECK_RAIL.inset;
  const zF = DECK.z1 - ri, xE = DECK.x1 - ri, xW = DECK.x0 + ri, zB = DECK.z0 + ri;
  const gapW = BUCKET.r + 0.03;
  const slideW = SLIDE.halfWidth + 0.04;
  railRun(xW, zF, BUCKET.x - gapW, zF);
  railRun(BUCKET.x + gapW, zF, SLIDE.x - slideW, zF);
  railRun(SLIDE.x + slideW, zF, xE, zF);
  railRun(xW, zB, HUT.x0, zB);
  railRun(xW, zB, xW, zF);
  railRun(xE, HUT.z1, xE, zF);
  const railMesh = new THREE.Mesh(mergeGeometries(rails), railMat);
  const balMesh = new THREE.Mesh(mergeGeometries(balusters), railMat);
  railMesh.castShadow = balMesh.castShadow = true;
  deck.add(railMesh, balMesh);
  // bandeirinhas presas no corrimão da frente (penduradas para fora), menos no laço e na abertura do balde
  const flagShape = new THREE.Shape();
  flagShape.moveTo(-0.055, 0); flagShape.lineTo(0.055, 0); flagShape.lineTo(0, -0.13); flagShape.closePath();
  const flagGeo = new THREE.ShapeGeometry(flagShape);
  const flagXs = [];
  for (let x = xW + 0.12; x < xE - 0.06; x += 0.15) {
    // fora da abertura do balde e do trecho do cano e do laço
    if (Math.abs(x - BUCKET.x) < gapW + 0.07 || Math.abs(x - SLIDE.x) < slideW + 0.07 || (x > TUBE.inlet.x - 0.48 && x < RIBBON.x + 0.2)) continue;
    flagXs.push(x);
  }
  const flags = new THREE.InstancedMesh(flagGeo, stdMat('#ffffff', { roughness: 0.75, side: THREE.DoubleSide }), flagXs.length);
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fs = new THREE.Vector3(1, 1, 1), fp = new THREE.Vector3(), fe = new THREE.Euler();
  const flagCols = ['#f27a8a', '#f6c453', '#7cc4e8', '#9bd57a', '#c9a0f0'].map((c) => new THREE.Color(c));
  flagXs.forEach((x, i) => {
    fp.set(x, top + railH - 0.03, zF + 0.035);
    fe.set(-0.12, 0, (i % 2 ? 1 : -1) * 0.05);
    flags.setMatrixAt(i, fm.compose(fp, fq.setFromEuler(fe), fs));
    flags.setColorAt(i, flagCols[i % flagCols.length]);
  });
  flags.name = 'bandeirinhas-do-deque';
  deck.add(flags);
  group.add(deck);
  seeThrough.push(deck);

  // ================================================================ casinha
  const hut = new THREE.Group();
  hut.name = 'casinha';
  const hx0 = HUT.x0, hx1 = HUT.x1, hz0 = HUT.z0, hz1 = HUT.z1;
  const hw = hx1 - hx0, hd = hz1 - hz0, wallH = HUT.wallH;
  const paintBlue = woodMat('#8fc0d8', { key: 'f10-casinha', vertical: true, rough: 0.7 });
  const trim = stdMat('#fffaf0', { roughness: 0.6 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(hw, wallH, 0.05), paintBlue);
  back.position.set((hx0 + hx1) / 2, top + wallH / 2, hz0);
  hut.add(back);
  for (const x of [hx0, hx1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, wallH, hd), paintBlue);
    side.position.set(x, top + wallH / 2, (hz0 + hz1) / 2);
    hut.add(side);
  }
  // frente com a porta (abertura) e a janela redonda
  const doorW = HUT.door.w, doorX = HUT.door.x;
  for (const [a, b] of [[hx0, doorX - doorW / 2], [doorX + doorW / 2, hx1]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(b - a, wallH, 0.05), paintBlue);
    f.position.set((a + b) / 2, top + wallH / 2, hz1);
    hut.add(f);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorW, wallH - 0.72, 0.05), paintBlue);
  lintel.position.set(doorX, top + 0.72 + (wallH - 0.72) / 2, hz1);
  hut.add(lintel);
  const doorFrame = new THREE.Mesh(new THREE.TorusGeometry(doorW / 2, 0.025, 6, 20, Math.PI), trim);
  doorFrame.position.set(doorX, top + 0.72 - 0.21, hz1 + 0.03);
  hut.add(doorFrame);
  const winX = hx0 + (doorX - doorW / 2 - hx0) * 0.5;
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), new THREE.MeshBasicMaterial({ color: '#ffd38a' }));
  win.position.set(winX, top + 0.58, hz1 + 0.028);
  const winRim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 24), trim);
  winRim.position.set(winX, top + 0.58, hz1 + 0.032);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.018, 0.01), trim);
  cross.position.set(winX, top + 0.58, hz1 + 0.034);
  const cross2 = cross.clone();
  cross2.rotation.z = Math.PI / 2;
  hut.add(win, winRim, cross, cross2);
  // telhado vermelho de duas águas (cumeeira ao longo de X)
  const roofMat = stdMat('#c9483c', { roughness: 0.7 });
  const roofLen = hw + 0.3;
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(rbox(roofLen, 0.04, hd / 2 + 0.28, 0.01), roofMat);
    slab.position.set((hx0 + hx1) / 2, top + wallH + 0.22, (hz0 + hz1) / 2 + s * (hd / 4 + 0.07));
    slab.rotation.x = s * 0.62;
    slab.castShadow = true;
    hut.add(slab);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-hd / 2, 0); gable.lineTo(0, 0.42); gable.lineTo(hd / 2, 0); gable.closePath();
  for (const x of [hx0, hx1]) {
    const g = new THREE.Mesh(new THREE.ShapeGeometry(gable).rotateY(Math.PI / 2), paintBlue);
    g.position.set(x + (x === hx0 ? -0.026 : 0.026), top + wallH, (hz0 + hz1) / 2);
    hut.add(g);
  }
  // bandeirinha no alto e a placa
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), stdMat('#fffaf0'));
  pole.position.set(hx1 - 0.15, top + wallH + 0.62, (hz0 + hz1) / 2);
  const pennantGeo = new THREE.BufferGeometry();
  pennantGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.12, 0, 0.24, -0.06, 0], 3));
  pennantGeo.computeVertexNormals();
  const pennant = new THREE.Mesh(pennantGeo, stdMat('#f6c453', { side: THREE.DoubleSide }));
  pennant.position.set(hx1 - 0.15, top + wallH + 0.86, (hz0 + hz1) / 2);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshStandardMaterial({ map: clubSignTexture(), roughness: 0.8 }));
  sign.position.set((hx0 + hx1) / 2, top + 0.88, hz1 + 0.03);
  sign.rotation.z = -0.04;
  hut.add(pole, pennant, sign);
  // lanterna pendurada no beiral
  const lanternPos = new THREE.Vector3(hx0 - 0.1, top + 0.8, hz1 + 0.16);
  const lantern = new THREE.Group();
  const lGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 10), new THREE.MeshBasicMaterial({ color: '#ffd8a0' }));
  const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 10), stdMat('#2d2a28', { metalness: 0.5 }));
  lCap.position.y = 0.1;
  const lHook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 10), stdMat('#2d2a28', { metalness: 0.5 }));
  lHook.position.y = 0.16;
  lantern.add(lGlass, lCap, lHook);
  lantern.position.copy(lanternPos);
  hut.add(lantern);
  hut.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh && !o.castShadow) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(hut);
  seeThrough.push(hut);

  // ================================================================ no deque: a luneta no canto e o baú de brinquedos
  const extras = new THREE.Group();
  extras.name = 'deque-brinquedos';
  const brass = brassMat();
  const T0 = DECK_PROPS.telescope;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), darkWood);
    leg.position.set(T0.x + Math.cos(a) * 0.1, top + 0.29, T0.z + Math.sin(a) * 0.1);
    leg.rotation.set(-Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    extras.add(leg);
  }
  const scope = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.46, 14).rotateX(Math.PI / 2), brass);
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10).rotateX(Math.PI / 2), stdMat('#2d2a28', { metalness: 0.5 }));
  eye.position.z = 0.27;
  const lensRim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14), brass);
  lensRim.position.z = -0.23;
  scope.add(barrel, eye, lensRim);
  scope.position.set(T0.x, top + 0.62, T0.z);
  scope.rotation.set(0.45, -0.6, 0);
  extras.add(scope);
  const C0 = DECK_PROPS.chest;
  const chestW = 0.46, chestD = 0.34, chestH = 0.3;
  const chestBox = new THREE.Mesh(rbox(chestW, chestH, chestD, 0.02), woodMat('#e8a33c', { key: 'f10-bau' }));
  chestBox.position.set(C0.x, top + chestH / 2, C0.z);
  const lid = new THREE.Mesh(rbox(chestW + 0.02, 0.05, chestD + 0.02, 0.015), woodMat('#c9483c', { key: 'f10-bau-tampa' }));
  lid.position.set(C0.x, top + chestH + 0.06, C0.z - chestD / 2 - 0.02);
  lid.rotation.x = -1.1;
  lid.position.y += 0.1;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), stdMat('#7cc4e8', { roughness: 0.4 }));
  ball.position.set(C0.x - 0.1, top + chestH + 0.02, C0.z + 0.02);
  const bear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), stdMat('#b07a4c', { roughness: 0.9 }));
  bear.position.set(C0.x + 0.1, top + chestH + 0.03, C0.z);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), stdMat('#b07a4c', { roughness: 0.9 }));
    ear.position.set(C0.x + 0.1 + s * 0.05, top + chestH + 0.09, C0.z);
    extras.add(ear);
  }
  extras.add(chestBox, lid, ball, bear);
  extras.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(extras);

  // ================================================================ braço da roldana, a roldana e o balde
  // o poste do braço fica no deque, ao lado da abertura do corrimão; o braço sai por cima do balde
  const armBase = new THREE.Vector3(BUCKET.x + gapW + 0.1, top, DECK.z1 - 0.12);
  const armPost = new THREE.Mesh(rbox(0.1, 1.0, 0.1, 0.012), darkWood);
  armPost.position.set(armBase.x, top + 0.5, armBase.z);
  armPost.castShadow = true;
  const pulleyPos = new THREE.Vector3(BUCKET.x, BUCKET.pulleyY, BUCKET.z);
  const armLen = Math.hypot(pulleyPos.x - armBase.x, pulleyPos.z - armBase.z) + 0.12;
  const arm = new THREE.Mesh(rbox(0.08, 0.08, armLen, 0.01), darkWood);
  arm.position.set((armBase.x + pulleyPos.x) / 2, BUCKET.pulleyY + 0.12, (armBase.z + pulleyPos.z) / 2);
  arm.rotation.y = Math.atan2(pulleyPos.x - armBase.x, pulleyPos.z - armBase.z);
  arm.castShadow = true;
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.62), darkWood);
  strut.position.set(armBase.x + (pulleyPos.x - armBase.x) * 0.3, top + 0.72, armBase.z + (pulleyPos.z - armBase.z) * 0.3);
  strut.rotation.y = arm.rotation.y;
  strut.rotation.x = -0.75;
  group.add(armPost, arm, strut);
  const wheel = new THREE.Group();
  const wheelDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 20).rotateZ(Math.PI / 2), stdMat('#c9483c', { roughness: 0.5 }));
  const wheelGroove = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 20).rotateY(Math.PI / 2), stdMat('#7a2a22'));
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8).rotateZ(Math.PI / 2), brassMat());
  const wheelSpin = new THREE.Group();
  wheelSpin.add(wheelDisc, wheelGroove, axle);
  wheel.add(wheelSpin);
  wheel.position.copy(pulleyPos);
  wheel.rotation.y = arm.rotation.y;
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.12), stdMat('#3a3634', { metalness: 0.7, roughness: 0.4 }));
  fork.position.set(pulleyPos.x, pulleyPos.y + 0.06, pulleyPos.z);
  fork.rotation.y = arm.rotation.y;
  group.add(wheel, fork);
  // balde de lata (abertura em cima) com a alça
  const bucket = new THREE.Group();
  bucket.name = 'balde';
  const tin = new THREE.MeshStandardMaterial({ color: '#b8c4cc', metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });
  const bH = BUCKET.h;
  const pail = new THREE.Mesh(new THREE.CylinderGeometry(BUCKET.r, BUCKET.r * 0.82, bH, 28, 1, true), tin);
  pail.position.y = bH / 2;
  const pailBottom = new THREE.Mesh(new THREE.CircleGeometry(BUCKET.r * 0.82, 28).rotateX(-Math.PI / 2), tin);
  pailBottom.position.y = 0.01;
  const ribs = [0.08, 0.24].map((y) => {
    const rr = BUCKET.r * (0.82 + 0.18 * (y / bH));
    const rib = new THREE.Mesh(new THREE.TorusGeometry(rr + 0.004, 0.006, 6, 28).rotateX(Math.PI / 2), tin);
    rib.position.y = y;
    return rib;
  });
  const lip = new THREE.Mesh(new THREE.TorusGeometry(BUCKET.r, 0.01, 6, 28).rotateX(Math.PI / 2), tin);
  lip.position.y = bH;
  const bail = new THREE.Mesh(new THREE.TorusGeometry(BUCKET.r, 0.008, 6, 24, Math.PI), stdMat('#5a5650', { metalness: 0.8, roughness: 0.3 }));
  bail.position.y = bH;
  // faixa de tinta com a patinha
  const bandTex = canvasTexture(256, 32, (g, w, h) => {
    g.fillStyle = '#f27a8a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fffaf0';
    for (let k = 0; k < 4; k++) {
      const x = 32 + k * 64;
      g.beginPath(); g.ellipse(x, 19, 6, 5, 0, 0, TAU); g.fill();
      for (let t = 0; t < 4; t++) { g.beginPath(); g.arc(x - 9 + t * 6, 11 - (t === 1 || t === 2 ? 2 : 0), 2.2, 0, TAU); g.fill(); }
    }
  });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(BUCKET.r * 0.95 + 0.003, BUCKET.r * 0.9 + 0.003, 0.08, 28, 1, true), new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.5 }));
  band.position.y = 0.17;
  bucket.add(pail, pailBottom, ...ribs, lip, bail, band);
  bucket.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  bucket.position.set(BUCKET.x, 0, BUCKET.z);
  group.add(bucket);
  // a ponta da alça (onde a corda prende), no espaço do balde
  const bailTop = new THREE.Vector3(0, bH + BUCKET.r * 0.95, 0);
  const bucketShadow = contactShadow(BUCKET.r + 0.06, BUCKET.r + 0.06, 0.4);
  bucketShadow.position.set(BUCKET.x, 0.006, BUCKET.z);
  group.add(bucketShadow);

  // ================================================================ corda: roldana → balde (vertical) e roldana → argola → ponta
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#d8b880', roughness: 0.95 });
  const ropeV = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 6), ropeMat);
  const ropeD = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 6), ropeMat);
  const ropeT = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 6), ropeMat);
  ropeV.castShadow = ropeD.castShadow = ropeT.castShadow = true;
  ropeV.name = ropeD.name = ropeT.name = 'corda-da-roldana';
  group.add(ropeV, ropeD, ropeT);
  // a argola no espeto
  const ringPos = new THREE.Vector3(ROPE.ring.x, ROPE.ring.y, ROPE.ring.z);
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.22, 8), woodMat('#7a5234', { key: 'f10-espeto' }));
  stake.position.set(ringPos.x, 0.06, ringPos.z);
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 16), brassMat());
  ringM.position.copy(ringPos);
  group.add(stake, ringM);
  // a ponta (pegador de madeira atravessado: vai na boca da Rhaenyra)
  const handle = new THREE.Group();
  handle.name = 'rope-handle';
  handle.userData.carryKind = 'rope';
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.16, 4, 10).rotateZ(Math.PI / 2), woodMat('#c9483c', { key: 'f10-pegador' }));
  grip.userData.carryKind = 'rope';
  grip.castShadow = true;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), ropeMat);
  knot.position.set(0, 0, -0.03);
  handle.add(grip, knot);
  handle.position.set(ROPE.rest.x, 0.03, ROPE.rest.z);
  handle.rotation.y = 0.4;
  group.add(handle);
  const _hp = new THREE.Vector3();
  // a corda sai da roldana do lado da argola
  const toRing = new THREE.Vector3(ringPos.x - pulleyPos.x, 0, ringPos.z - pulleyPos.z).normalize();
  const pOut = new THREE.Vector3(pulleyPos.x + toRing.x * 0.07, pulleyPos.y - 0.02, pulleyPos.z + toRing.z * 0.07);
  /** Estica um cilindro entre dois pontos. */
  function stretch(m, a, b) {
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.y = Math.max(0.01, a.distanceTo(b));
    m.lookAt(b);
    m.rotateX(Math.PI / 2);
  }

  // ================================================================ cano de brinquedo: funil no chão → boca do lado do pombo
  const tubeGroup = new THREE.Group();
  tubeGroup.name = 'cano-de-brinquedo';
  // o funil deitado, de boca para o sul, na altura do focinho das dogs (é ali que a Radhija sopra)
  const funnelPos = new THREE.Vector3(TUBE.inlet.x, TUBE.funnelY, TUBE.inlet.z);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.05, 0.22, 24, 1, true).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#ff9a3c', roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide }));
  funnel.position.copy(funnelPos);
  const funnelRim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 8, 24), stdMat('#f6c453', { roughness: 0.4 }));
  funnelRim.position.set(funnelPos.x, funnelPos.y, funnelPos.z + 0.11);
  // um pezinho só, embaixo da ponta fina: a argola abraça o funil, a haste desce reta até a base redonda no chão
  // (nada atravessa o funil; tudo fica dentro do colisor dele)
  const legMat = stdMat('#7cc4e8', { roughness: 0.4 });
  const cz = funnelPos.z - 0.06;
  const cr = 0.05 + 0.15 * ((cz - (funnelPos.z - 0.11)) / 0.22) + 0.012;
  const cradle = new THREE.Mesh(new THREE.TorusGeometry(cr, 0.012, 8, 24), legMat);
  cradle.position.set(funnelPos.x, funnelPos.y, cz);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, funnelPos.y - cr, 10), legMat);
  stem.position.set(funnelPos.x, (funnelPos.y - cr) / 2, cz);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.02, 18), legMat);
  foot.position.set(funnelPos.x, 0.01, cz);
  tubeGroup.add(funnel, funnelRim, cradle, stem, foot);
  // o caminho do cano: desce do funil, corre até o poste do deque, sobe e curva até o corrimão
  // o poste do meio da frente (o cano sobe por ele até o corrimão, do lado do pombo)
  const post = DECK_POSTS.reduce((best, p) => (p.z > -4.5 && Math.abs(p.x - TUBE.inlet.x) < Math.abs(best.x - TUBE.inlet.x) ? p : best), DECK_POSTS[2]);
  const mouth = new THREE.Vector3(PIGEON.x - 0.26, PIGEON.y + 0.08, PIGEON.z + 0.12);
  const tubePts = [
    new THREE.Vector3(funnelPos.x, funnelPos.y, funnelPos.z - 0.12),
    new THREE.Vector3(funnelPos.x, 0.16, funnelPos.z - 0.34),
    new THREE.Vector3((funnelPos.x + post.x) / 2, 0.12, (funnelPos.z + post.z) / 2 + 0.1),
    new THREE.Vector3(post.x - 0.1, 0.14, post.z + 0.12),
    new THREE.Vector3(post.x - 0.1, 1.2, post.z + 0.12),
    new THREE.Vector3(post.x - 0.1, top - 0.1, post.z + 0.12),
    new THREE.Vector3(post.x + 0.1, top + 0.12, post.z + 0.22),
    mouth,
  ];
  const tubeCurve = new THREE.CatmullRomCurve3(tubePts, false, 'centripetal', 0.35);
  const segCols = ['#7cc4e8', '#f6c453', '#f27a8a', '#9bd57a'];
  const nSeg = 8;
  for (let i = 0; i < nSeg; i++) {
    const u0 = i / nSeg, u1 = (i + 1) / nSeg;
    const pts = [];
    for (let k = 0; k <= 6; k++) pts.push(tubeCurve.getPointAt(u0 + (u1 - u0) * (k / 6)));
    const seg = new THREE.Mesh(tube(new THREE.CatmullRomCurve3(pts), 10, 0.04, 10), new THREE.MeshPhysicalMaterial({ color: segCols[i % 4], roughness: 0.35, clearcoat: 0.5 }));
    seg.castShadow = true;
    tubeGroup.add(seg);
    // anel de encaixe entre os gomos
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.01, 6, 16), stdMat('#fffaf0', { roughness: 0.4 }));
    ring.position.copy(tubeCurve.getPointAt(u1 * 0.999));
    ring.lookAt(ring.position.clone().add(tubeCurve.getTangentAt(u1 * 0.999)));
    tubeGroup.add(ring);
  }
  // boca de trompete virada para o pombo
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.04, 0.16, 20, 1, true), new THREE.MeshPhysicalMaterial({ color: '#f6c453', roughness: 0.3, clearcoat: 0.7, side: THREE.DoubleSide }));
  const bellDir = new THREE.Vector3(PIGEON.x - mouth.x, -0.02, PIGEON.z - mouth.z).normalize();
  bell.position.copy(mouth).addScaledVector(bellDir, 0.06);
  bell.lookAt(bell.position.clone().add(bellDir));
  bell.rotateX(-Math.PI / 2);
  tubeGroup.add(bell);
  // presilhas no poste
  for (const y of [0.6, 1.3]) {
    const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14).rotateX(Math.PI / 2), stdMat('#3a3634', { metalness: 0.6 }));
    clamp.position.set(post.x - 0.1, y, post.z + 0.12);
    tubeGroup.add(clamp);
  }
  // baforadas verdes subindo por dentro (bolhas translúcidas que aparecem pelo plástico)
  const puffMat = new THREE.MeshBasicMaterial({ color: '#a8e07a', transparent: true, opacity: 0.85, depthWrite: false });
  const puffs = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), puffMat);
    m.visible = false;
    m.renderOrder = 6;
    tubeGroup.add(m);
    return m;
  });
  const tubeGlow = new THREE.Mesh(tube(tubeCurve, 80, 0.043, 10), new THREE.MeshBasicMaterial({ color: '#a8e07a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  tubeGroup.add(tubeGlow);
  // plaquinha do funil: "fale aqui"
  const woodMatTag = stdMat('#c8a070', { roughness: 0.8 });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1), new THREE.MeshStandardMaterial({ map: canvasTexture(96, 56, (g, w, h) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f27a8a'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = '#5a3a2a'; g.font = 'bold 15px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
    g.fillText('FALE', w / 2, 22); g.fillText('AQUI', w / 2, 40);
  }, { repeat: false }), roughness: 0.8 }));
  // num palitinho preso em cima da argola do pezinho, virada para quem chega (por cima do funil)
  const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6), woodMatTag);
  pick.position.set(funnelPos.x, funnelPos.y + cr + 0.12, cz);
  tubeGroup.add(pick);
  tag.position.set(funnelPos.x, funnelPos.y + cr + 0.29, cz + 0.008);
  tubeGroup.add(tag);
  group.add(tubeGroup);

  // ================================================================ o pombo cochilando no corrimão
  const pigeon = createPigeon({ seed: 10, tint: '#9aa0b0', scale: 1.35 });
  pigeon.setPose({ x: PIGEON.x, y: PIGEON.y, z: PIGEON.z, yaw: 0.3, asleep: true });
  group.add(pigeon.object);

  // ================================================================ escorregador amarelo (da frente do deque ao gramado, para o sul)
  // montado ao longo de +X local (0 = boca no deque) e girado para descer para o sul (+Z)
  const slide = new THREE.Group();
  slide.name = 'escorregador';
  const sw = SLIDE.halfWidth * 2;
  const x0 = 0, x1 = SLIDE.z1 - SLIDE.z0, y0 = top, y1 = 0.22;
  const SZ = 0;
  // perfil da calha (U) ao longo do caminho: reta do deque até o fim e a "língua" que aplaina
  /** @type {THREE.CurvePath<THREE.Vector3>} */
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(new THREE.Vector3(x0 - 0.05, y0 + 0.01, SZ), new THREE.Vector3(x1 - 0.12, y1 + 0.05, SZ)));
  path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(x1 - 0.12, y1 + 0.05, SZ), new THREE.Vector3(x1 + 0.04, y1 - 0.04, SZ), new THREE.Vector3(x1 + SLIDE.tongue, y1 - 0.03, SZ)));
  const N = 40;
  const pos = [], idx = [];
  const prof = [];
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI;
    prof.push([Math.cos(a) * (sw / 2), -Math.sin(a) * 0.06 + (k === 0 || k === 10 ? 0.06 : 0)]);
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = path.getPointAt(u);
    const tng = path.getTangentAt(u);
    const side = new THREE.Vector3().crossVectors(tng, up).normalize();
    const nrm = new THREE.Vector3().crossVectors(side, tng).normalize();
    for (const [sx, sy] of prof) pos.push(p.x + side.x * sx + nrm.x * sy, p.y + side.y * sx + nrm.y * sy + 0.06, p.z + side.z * sx + nrm.z * sy);
    if (i < N) {
      const a0 = i * prof.length, a1 = (i + 1) * prof.length;
      for (let k = 0; k < prof.length - 1; k++) idx.push(a0 + k, a1 + k, a0 + k + 1, a0 + k + 1, a1 + k, a1 + k + 1);
    }
  }
  const chuteGeo = new THREE.BufferGeometry();
  chuteGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  chuteGeo.setIndex(idx);
  chuteGeo.computeVertexNormals();
  const plastic = new THREE.MeshPhysicalMaterial({ color: '#ffcf3a', roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide });
  const chute = new THREE.Mesh(chuteGeo, plastic);
  chute.castShadow = true;
  chute.receiveShadow = true;
  slide.add(chute);
  // bordas arredondadas da calha
  for (const s of [-1, 1]) {
    const edgePts = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const p = path.getPointAt(u);
      edgePts.push(new THREE.Vector3(p.x, p.y + 0.12, p.z + s * (sw / 2)));
    }
    const edge = new THREE.Mesh(tube(new THREE.CatmullRomCurve3(edgePts), 30, 0.02, 8), stdMat('#ff9a3c', { roughness: 0.35 }));
    edge.castShadow = true;
    slide.add(edge);
  }
  // pezinhos no fim e a alça no alto
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, y1 + 0.04, 8), stdMat('#7cc4e8', { roughness: 0.4 }));
    leg.position.set(x1 - 0.1, (y1 + 0.04) / 2, SZ + s * (sw / 2 - 0.03));
    slide.add(leg);
    const grab = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 16, Math.PI), stdMat('#ff9a3c', { roughness: 0.35 }));
    grab.position.set(x0 - 0.02, y0 + 0.12, SZ + s * (sw / 2 + 0.02));
    slide.add(grab);
  }
  slide.position.set(SLIDE.x, 0, SLIDE.z0);
  slide.rotation.y = -Math.PI / 2;
  group.add(slide);
  seeThrough.push(slide);

  // ================================================================ estado
  const st = { y: 0, tilt: 1, pull: 0, holder: /** @type {any} */ (null), puffs: /** @type {number[]} */ ([]), glow: 0, outT: -1, peckT: 0, flap: 0 };
  const _bt = new THREE.Vector3();
  function layoutRope() {
    const by = st.y;
    // balde: deitado (tilt 1, boca para o sul, encostado no chão pela lateral) até em pé (tilt 0)
    const th = st.tilt * Math.PI / 2;
    bucket.rotation.x = th;
    bucket.position.set(BUCKET.x, by + BUCKET.r * Math.sin(th), BUCKET.z - (bH / 2) * Math.sin(th));
    bucket.updateMatrixWorld(true);
    bucketShadow.material.opacity = 0.4 * Math.max(0, 1 - by / 1.2);
    bucketShadow.scale.set((BUCKET.r + 0.06) * 2, 1, (BUCKET.r + 0.06) * 2 * (1 + 0.5 * st.tilt));
    const bucketTop = bucket.localToWorld(_bt.copy(bailTop));
    stretch(ropeV, new THREE.Vector3(pulleyPos.x, pulleyPos.y - 0.06, pulleyPos.z), bucketTop);
    // roldana → argola
    stretch(ropeD, pOut, ringPos);
    // argola → ponta (no chão ou na boca)
    handle.getWorldPosition(_hp);
    stretch(ropeT, ringPos, _hp);
    wheelSpin.rotation.x = -st.pull * 6;
  }
  layoutRope();

  root.add(group);
  return {
    group, lanternPos, seeThrough, pigeonModel: pigeon,
    bucket: {
      object: bucket,
      setY(y) { st.y = y; },
      /** 1 = deitado no chão (boca para o sul), 0 = em pé. */
      setTilt(k) { st.tilt = Math.max(0, Math.min(1, k)); },
    },
    rope: {
      handle,
      setPull(pulled, holder) { st.pull = pulled; st.holder = holder; },
    },
    tube: {
      object: tubeGroup,
      /** Progresso (0..1) de cada baforada dentro do cano. */
      setPuffs(list) { st.puffs = list || []; },
      outletPuff() { st.outT = 0; },
    },
    pigeon: {
      object: pigeon.object,
      setPose(p) { pigeon.setPose(p); },
      /** Bica e bate as asas em quem chega perto do laço (sem sair do lugar). */
      peck() { st.peckT = 0.8; },
    },
    ribbonAnchor: new THREE.Vector3(RIBBON.x, RIBBON.y, RIBBON.z),
    update(dt, t) {
      layoutRope();
      // baforadas no cano
      puffs.forEach((m, i) => {
        const u = st.puffs[i];
        m.visible = u != null;
        if (u == null) return;
        m.position.copy(tubeCurve.getPointAt(Math.min(1, Math.max(0, u))));
        m.scale.setScalar(0.9 + 0.2 * Math.sin(t * 10 + i));
      });
      st.glow += ((st.puffs.length ? 0.35 : 0) - st.glow) * (1 - Math.exp(-dt * 6));
      tubeGlow.material.opacity = st.glow;
      // o pombo bicando
      if (st.peckT > 0) {
        st.peckT -= dt;
        pigeon.setPose({ asleep: false, flying: st.peckT > 0.25 });
        if (st.peckT <= 0) pigeon.setPose({ flying: false, asleep: true });
      }
      pigeon.update(dt, t);
      pennant.rotation.y = Math.sin(t * 2.2) * 0.35;
      lantern.rotation.z = Math.sin(t * 0.9) * 0.05;
    },
  };
}
