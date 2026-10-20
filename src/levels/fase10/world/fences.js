// FASE 10 · Cercas e o entorno: a cerca de ripas brancas entre o quintal e o fundo, com o portãozinho de dobradiça,
// a trava de ferrolho e a cordinha que sobe pelo mourão até ela (o cabo é a ligação visível: ao puxar, um pulso corre
// até o ferrolho, que salta, e o portão abre); o muro de madeira alto do terreno (norte e leste) com trepadeira e
// arandelas, a cerca viva baixa ao sul e a oeste, as árvores dos vizinhos e os telhados com janelas acesas ao fundo.
// API: buildFences(root, layout) → { group, gate: GateProp, cord: { setTug(k) }, seeThrough, update(dt, t) }
import * as THREE from 'three';
import { picketGeometry } from '../../../world/fence.js';
import { makeTree } from '../../../world/background.js';
import { rng, rbox, woodMat, stdMat, canvasTexture, foliageCluster, leafSkin, plasterMat, mergeGeometries, brassMat } from '../../../world/util.js';
import { hedgeMat, plantMat } from '../../../world/plants.js';
import { makeLink } from '../../../world/links.js';

const TAU = Math.PI * 2;

/** Ripas instanciadas ao longo de Z (x fixo) de z0 a z1, viradas para −X (o lado do quintal). */
function picketRun(geo, mat, x, z0, z1, spacing, h) {
  const n = Math.max(1, Math.floor((z1 - z0) / spacing));
  const im = new THREE.InstancedMesh(geo, mat, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  const r = rng(Math.round(z0 * 100));
  for (let i = 0; i < n; i++) {
    const z = z0 + (i + 0.5) * ((z1 - z0) / n);
    const sc = new THREE.Vector3(1, (h / 0.9) * (0.97 + r() * 0.05), 1);
    const qq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (r() - 0.5) * 0.03));
    m4.compose(new THREE.Vector3(x, 0, z), qq, sc);
    im.setMatrixAt(i, m4);
  }
  im.castShadow = true;
  im.receiveShadow = true;
  return im;
}

/** Janelinha acesa (textura de fachada de vizinho). */
function neighborTexture(seed, base) {
  return canvasTexture(128, 96, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
    for (let i = 0; i < 3; i++) {
      const lit = r() < 0.7;
      g.fillStyle = lit ? '#ffc56a' : '#3a3440';
      g.fillRect(14 + i * 40, 30, 24, 30);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(13 + i * 40, 29, 26, 2); g.fillRect(25 + i * 40, 30, 2, 30);
    }
  }, { repeat: false });
}
/** Casa do vizinho: paredes, telhado de duas águas e chaminé (frente para +Z). */
function neighborHouse({ w, h, d, color, roof, seed }) {
  const g = new THREE.Group();
  const map = neighborTexture(seed, color);
  const front = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#ffb860', emissiveIntensity: 0.35, roughness: 0.9 });
  const side = plasterMat(color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, front, side]);
  body.position.y = h / 2;
  g.add(body);
  const rh = d * 0.45;
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.2, 0); shape.lineTo(0, rh); shape.lineTo(d / 2 + 0.2, 0); shape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: w + 0.4, bevelEnabled: false });
  roofGeo.translate(0, 0, -(w + 0.4) / 2);
  roofGeo.rotateY(Math.PI / 2);
  const rf = new THREE.Mesh(roofGeo, stdMat(roof, { roughness: 0.85 }));
  rf.position.y = h;
  g.add(rf);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), stdMat('#8a5a46', { roughness: 0.9 }));
  ch.position.set(w * 0.25, h + rh * 0.7, -d * 0.15);
  g.add(ch);
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return g;
}

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildFences(root, layout) {
  const { BACK_FENCE, GATE, CORD, WORLD, HOUSE } = layout;
  const B = WORLD.bounds;
  const group = new THREE.Group();
  group.name = 'cercas';
  const seeThrough = [];

  // ================================================================ cerca de ripas do fundo
  const fx = BACK_FENCE.x;
  const ph = BACK_FENCE.h;
  const white = woodMat('#f4efe4', { key: 'f10-ripa-branca', rough: 0.7 });
  const postMat = woodMat('#ece5d6', { key: 'f10-mourao', vertical: true, rough: 0.75 });
  const pk = picketGeometry(0.085, 0.9, 0.022);
  const fence = new THREE.Group();
  fence.name = 'cerca-do-fundo';
  const runs = [[B.minZ, BACK_FENCE.gate.z0 - 0.06], [BACK_FENCE.gate.z1 + 0.06, B.maxZ + 0.2]];
  for (const [z0, z1] of runs) fence.add(picketRun(pk, white, fx - 0.02, z0, z1, 0.13, ph));
  // travessas (do lado do fundo) e mourões com chapéu
  const rails = [];
  for (const [z0, z1] of runs) for (const y of [0.25, ph - 0.22]) {
    const g = new THREE.BoxGeometry(0.03, 0.06, z1 - z0);
    g.translate(fx + 0.02, y, (z0 + z1) / 2);
    rails.push(g);
  }
  const railMesh = new THREE.Mesh(mergeGeometries(rails), postMat);
  railMesh.castShadow = true;
  fence.add(railMesh);
  const postZs = [];
  for (let z = B.minZ + 0.05; z < B.maxZ; z += 1.6) if (z < BACK_FENCE.gate.z0 - 0.3 || z > BACK_FENCE.gate.z1 + 0.3) postZs.push(z);
  postZs.push(BACK_FENCE.gate.z0 - 0.05, BACK_FENCE.gate.z1 + 0.05);
  for (const z of postZs) {
    const big = Math.abs(z - BACK_FENCE.gate.z0 + 0.05) < 0.01 || Math.abs(z - BACK_FENCE.gate.z1 - 0.05) < 0.01;
    const post = new THREE.Mesh(rbox(0.09, ph + (big ? 0.2 : 0.1), 0.09, 0.01), postMat);
    post.position.set(fx, (ph + (big ? 0.2 : 0.1)) / 2, z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.08, 4).rotateY(Math.PI / 4), postMat);
    cap.position.set(fx, ph + (big ? 0.24 : 0.14), z);
    post.castShadow = cap.castShadow = true;
    fence.add(post, cap);
  }
  // flores de trepadeira na cerca (pontinhos rosa e brancos), perto do portão
  const vineGeo = foliageCluster([
    { x: fx - 0.05, y: 0.6, z: -2.4, r: 0.25, sx: 0.4, sy: 1.1 }, { x: fx - 0.05, y: 0.75, z: -1.9, r: 0.2, sx: 0.4 },
    { x: fx - 0.05, y: 0.55, z: 2.2, r: 0.26, sx: 0.4, sy: 1.1 }, { x: fx - 0.05, y: 0.8, z: 2.7, r: 0.18, sx: 0.4 },
  ], { seed: 33, dark: '#2c5226', mid: '#4a7f36', light: '#86b850', amp: 0.35 });
  const vine = new THREE.Mesh(vineGeo, plantMat());
  vine.castShadow = true;
  fence.add(vine);
  const blossoms = leafSkin(vineGeo, { count: 90, size: 0.045, seed: 7, material: stdMat('#ffffff', { roughness: 0.7, side: THREE.DoubleSide }) });
  const bc = new THREE.Color();
  for (let i = 0; i < blossoms.count; i++) blossoms.setColorAt(i, bc.set(i % 2 ? '#ff9ed2' : '#fff1f6'));
  fence.add(blossoms);
  group.add(fence);
  seeThrough.push(fence);

  // ================================================================ portãozinho (folha ao longo de −Z local a partir da dobradiça)
  const gate = new THREE.Group();
  gate.name = 'portaozinho';
  const leaf = new THREE.Group();
  const gl = GATE.length;
  const n = Math.round(gl / 0.13);
  for (let i = 0; i < n; i++) {
    const z = -(i + 0.5) * (gl / n);
    const p = new THREE.Mesh(pk, white);
    p.rotation.y = -Math.PI / 2;
    // topo em arco (as do meio mais altas)
    const u = (i + 0.5) / n;
    p.scale.y = (ph / 0.9) * (0.92 + 0.12 * Math.sin(Math.PI * u));
    p.position.set(-0.02, 0.04, z);
    p.castShadow = true;
    leaf.add(p);
  }
  for (const y of [0.28, ph - 0.24]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, gl - 0.06), postMat);
    rail.position.set(0.02, y, -gl / 2);
    rail.castShadow = true;
    leaf.add(rail);
  }
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.055, Math.hypot(gl - 0.1, ph - 0.52)), postMat);
  brace.position.set(0.022, ph / 2, -gl / 2);
  brace.rotation.x = Math.atan2(ph - 0.52, gl - 0.1);
  leaf.add(brace);
  // dobradiças e o ferrolho (a lingueta corre para dentro do mourão da trava)
  const iron = stdMat('#3a3634', { metalness: 0.7, roughness: 0.45 });
  for (const y of [0.3, ph - 0.25]) {
    const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8), iron);
    hg.position.set(0.0, y, -0.02);
    leaf.add(hg);
  }
  // o ferrolho fica do lado do quintal e a lingueta entra no mourão da trava (a folha pende na face de trás dele)
  const boltX = BACK_FENCE.x + 0.042 - GATE.hinge.x;
  const boltBody = new THREE.Mesh(rbox(0.04, 0.05, 0.16, 0.006), iron);
  boltBody.position.set(-0.052, ph - 0.36, -gl + 0.12);
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 8).rotateX(Math.PI / 2), brassMat());
  bolt.position.set(boltX, ph - 0.36, -gl + 0.02);
  leaf.add(boltBody, bolt);
  gate.add(leaf);
  gate.position.set(GATE.hinge.x, 0, GATE.hinge.z);
  gate.rotation.y = GATE.closedYaw;
  group.add(gate);
  seeThrough.push(gate);
  // as chapas das dobradiças: do mourão até o pino da folha
  for (const y of [0.3, ph - 0.25]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(GATE.hinge.x - fx - 0.03, 0.035, 0.02), iron);
    strap.position.set((fx + 0.045 + GATE.hinge.x) / 2, y, GATE.hinge.z + 0.005);
    group.add(strap);
  }

  // ================================================================ a cordinha: do puxador (no lado do quintal) sobe pelo mourão até o ferrolho
  const postTop = new THREE.Vector3(fx - 0.05, ph + 0.15, BACK_FENCE.gate.z0 - 0.05);
  const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 16), brassMat());
  pulley.position.copy(postTop);
  pulley.rotation.y = Math.PI / 2;
  group.add(pulley);
  const boltWorld = new THREE.Vector3(fx + 0.042, ph - 0.36, BACK_FENCE.gate.z0 + 0.02);
  const cordUpper = makeLink([
    new THREE.Vector3(postTop.x, postTop.y + 0.02, postTop.z),
    new THREE.Vector3(postTop.x, postTop.y, postTop.z + 0.05),
    new THREE.Vector3(boltWorld.x, boltWorld.y + 0.04, boltWorld.z + 0.02),
  ], { radius: 0.006, color: '#e8d0a0', glow: '#ffd36a' });
  group.add(cordUpper.object);
  // a parte que desce até o puxador (anima com o puxão)
  const cordMat = stdMat('#e8d0a0', { roughness: 0.9 });
  const cordDown = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 6), cordMat);
  cordDown.name = 'puxador';
  group.add(cordDown);
  const pullHandle = new THREE.Group();
  pullHandle.name = 'puxador';
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), woodMat('#e8554a', { key: 'f10-puxador' }));
  knob.scale.y = 1.25;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 10, 1, true), stdMat('#f6c453', { roughness: 0.9, side: THREE.DoubleSide }));
  tassel.position.y = -0.08;
  pullHandle.add(knob, tassel);
  pullHandle.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(pullHandle);
  // plaquinha "puxe" com a patinha, no mourão
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ map: canvasTexture(96, 64, (g, w, h) => {
    g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#8a5a3c'; g.font = 'bold 22px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
    g.fillText('PUXE', w / 2, 30);
    g.beginPath(); g.ellipse(w / 2, 46, 6, 5, 0, 0, TAU); g.fill();
    for (let t = 0; t < 4; t++) { g.beginPath(); g.arc(w / 2 - 9 + t * 6, 38 - (t === 1 || t === 2 ? 3 : 0), 2.4, 0, TAU); g.fill(); }
  }, { repeat: false }) }));
  plaque.position.set(fx - 0.055, 0.66, BACK_FENCE.gate.z0 - 0.05);
  plaque.rotation.y = -Math.PI / 2;
  group.add(plaque);

  // ================================================================ muro de madeira alto (norte e leste) com arandelas
  const tall = new THREE.Group();
  tall.name = 'muro-do-terreno';
  const boardTex = canvasTexture(256, 128, (g, w, h) => {
    const r = rng(17);
    for (let x = 0; x < w; x += 16) {
      const t = 0.85 + r() * 0.2;
      g.fillStyle = `rgb(${(146 * t) | 0},${(98 * t) | 0},${(66 * t) | 0})`;
      g.fillRect(x, 0, 15, h);
      g.fillStyle = 'rgba(40,24,12,0.35)'; g.fillRect(x + 15, 0, 1, h);
    }
    g.fillStyle = 'rgba(30,20,10,0.12)';
    for (let k = 0; k < 60; k++) g.fillRect(r() * w, r() * h, 1, 10 + r() * 20);
  });
  const wallH = 1.9;
  const northLen = 12.26 - (HOUSE.x1 + 0.1); // termina na face do muro leste (sem topo sobreposto na quina)
  const tN = boardTex.clone(); tN.needsUpdate = true; tN.repeat.set(northLen / 1.6, 1);
  const north = new THREE.Mesh(new THREE.BoxGeometry(northLen, wallH, 0.08), new THREE.MeshStandardMaterial({ map: tN, roughness: 0.9 }));
  north.position.set(HOUSE.x1 + 0.1 + northLen / 2, wallH / 2, B.minZ - 0.12);
  north.receiveShadow = true;
  // muro leste em dois trechos: a fresta da tábua solta fica entre eles (a tábua é do cantinho, secret.js)
  const EW = layout.EAST_WALL, SB = layout.SECRET.board;
  const eastParts = [[B.minZ - 0.12, SB.z0 - 0.006], [SB.z1 + 0.006, B.maxZ + 0.88]].map(([z0, z1]) => {
    const len = z1 - z0;
    const tE = boardTex.clone(); tE.needsUpdate = true; tE.repeat.set(len / 1.6, 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(EW.t, wallH, len), new THREE.MeshStandardMaterial({ map: tE, roughness: 0.9 }));
    m.position.set(EW.x, wallH / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    return m;
  });
  tall.add(north, ...eastParts);
  // o muro leste deixa ver a dog lá dentro do cantinho (e quem anda colada nele)
  seeThrough.push(...eastParts);
  const capGeo = [];
  for (const [x, z, w, d] of [[north.position.x, north.position.z, northLen + 0.1, 0.14], ...eastParts.map((m) => [m.position.x, m.position.z, 0.14, /** @type {THREE.BoxGeometry} */ (m.geometry).parameters.depth])]) {
    const g = new THREE.BoxGeometry(w, 0.05, d);
    g.translate(x, wallH + 0.025, z);
    capGeo.push(g);
  }
  tall.add(new THREE.Mesh(mergeGeometries(capGeo), woodMat('#6a4a32', { key: 'f10-muro-chapeu' })));
  // trepadeira no muro norte (atrás da horta e do galpão de um lado; atrás da varanda do outro)
  for (const [x0, len, seed] of [[0.6, 3.2, 41], [9.6, 2.4, 43]]) {
    const blobs = Array.from({ length: 6 }, (_, i) => ({ x: x0 + (i / 5) * len, y: 1.0 + ((i * 7) % 3) * 0.25, z: B.minZ - 0.04, r: 0.38, sz: 0.35, sy: 1.2 }));
    const cg = foliageCluster(blobs, { seed, dark: '#264a20', mid: '#3f7030', light: '#7aa84a', amp: 0.4 });
    const m = new THREE.Mesh(cg, plantMat());
    m.castShadow = true;
    tall.add(m);
  }
  // arandelas no muro (brilho quente, sem luz de verdade)
  const sconceGlow = new THREE.MeshBasicMaterial({ color: '#ffd8a0' });
  for (const x of [2.2, 7.0]) {
    const sc = new THREE.Group();
    const back = new THREE.Mesh(rbox(0.1, 0.16, 0.03, 0.01), stdMat('#2d2a28', { metalness: 0.5 }));
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 12), sconceGlow);
    glass.position.set(0, 0, 0.07);
    const roofC = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.06, 12), stdMat('#2d2a28', { metalness: 0.5 }));
    roofC.position.set(0, 0.1, 0.07);
    sc.add(back, glass, roofC);
    sc.position.set(x, 1.55, B.minZ - 0.07);
    tall.add(sc);
  }
  group.add(tall);

  // ================================================================ cerca viva baixa ao sul e a oeste (o limite perto da câmera)
  const hedges = [];
  const hedgeAlong = (x0, z0, x1, z1, seed) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n2 = Math.max(2, Math.round(len / 0.55));
    const blobs = [];
    const r = rng(seed);
    for (let i = 0; i <= n2; i++) {
      const t = i / n2;
      blobs.push({ x: x0 + (x1 - x0) * t + (r() - 0.5) * 0.1, y: 0.32 + r() * 0.08, z: z0 + (z1 - z0) * t + (r() - 0.5) * 0.1, r: 0.36 + r() * 0.08, sy: 0.85 });
    }
    hedges.push(foliageCluster(blobs, { detail: 2, seed, dark: '#264a20', mid: '#3f7030', light: '#7aa84a', amp: 0.25 }));
  };
  hedgeAlong(-12.2, B.maxZ + 0.55, 12.2, B.maxZ + 0.55, 51);
  hedgeAlong(-12.55, HOUSE.zS + 0.2, -12.55, B.maxZ + 0.5, 53);
  const hedge = new THREE.Mesh(mergeGeometries(hedges), hedgeMat());
  hedge.castShadow = true;
  hedge.receiveShadow = true;
  group.add(hedge);

  // ================================================================ vizinhança: árvores atrás do muro e telhados ao longe
  const far = new THREE.Group();
  far.name = 'vizinhanca';
  const trees = [[-2.5, -8.2, 5.5, 1.8, 3], [1.8, -8.6, 6.5, 2.2, 5], [5.6, -8.0, 5.0, 1.7, 7], [9.4, -8.4, 6.2, 2.1, 9], [14.0, -4.0, 6.0, 2.0, 11], [14.4, 1.5, 5.4, 1.9, 13], [-14.0, 2.2, 5.6, 1.8, 15]];
  for (const [x, z, height, crown, seed] of trees) {
    const t = makeTree({ height, crown, seed });
    t.position.set(x, 0, z);
    far.add(t);
  }
  const houses = [
    { x: -1.0, z: -13.5, w: 6, h: 3.6, d: 5, color: '#e9d2b4', roof: '#9a4a3a', seed: 1 },
    { x: 7.0, z: -14.0, w: 7, h: 4.2, d: 5, color: '#cfd8e2', roof: '#5a4a5a', seed: 2 },
    { x: 16.5, z: -9.0, w: 6, h: 3.8, d: 6, color: '#f0c8b0', roof: '#8a3a32', seed: 3 },
    { x: -9.5, z: -12.5, w: 7, h: 4.0, d: 5, color: '#e2e6c8', roof: '#6a4a3a', seed: 4 },
  ];
  for (const hh of houses) {
    const m = neighborHouse(hh);
    m.position.set(hh.x, 0, hh.z);
    far.add(m);
  }
  group.add(far);

  // ================================================================ estado
  const st = { tug: 0, open: 0, boltOut: 0, pulsed: false };
  const handleRest = new THREE.Vector3(CORD.x, 0.42, CORD.z);
  function layoutCord() {
    const hy = handleRest.y - st.tug * 0.1;
    pullHandle.position.set(handleRest.x, hy, handleRest.z);
    pullHandle.rotation.z = st.tug * 0.2;
    const a = new THREE.Vector3(handleRest.x, hy + 0.05, handleRest.z);
    const b = new THREE.Vector3(postTop.x, postTop.y - 0.02, postTop.z);
    cordDown.position.copy(a).add(b).multiplyScalar(0.5);
    cordDown.scale.y = a.distanceTo(b);
    cordDown.lookAt(b);
    cordDown.rotateX(Math.PI / 2);
  }
  layoutCord();
  const gateProp = {
    object: gate,
    setOpen(t) {
      st.open = t;
      gate.rotation.y = GATE.closedYaw + (GATE.openYaw - GATE.closedYaw) * t;
    },
  };
  const cord = {
    setTug(k) {
      if (k > 0.5 && !st.pulsed) { cordUpper.pulse(); st.pulsed = true; }
      st.tug = k;
      layoutCord();
    },
    reset() { st.pulsed = false; st.tug = 0; layoutCord(); cordUpper.setOn(false); },
  };

  root.add(group);
  return {
    group, gate: gateProp, cord, seeThrough,
    update(dt) {
      cordUpper.update(dt);
      // a lingueta do ferrolho recolhe quando o portão abre
      const target = st.open > 0.02 || st.pulsed ? 1 : 0;
      st.boltOut += (target - st.boltOut) * (1 - Math.exp(-dt * 10));
      bolt.position.z = -gl + 0.02 + st.boltOut * 0.09;
      cordUpper.setOn(st.pulsed);
      void boltWorld;
    },
  };
}
