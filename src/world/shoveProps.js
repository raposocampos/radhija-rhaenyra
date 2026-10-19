// Coisas que a Rhaenyra derruba no empurrão em pé (src/game/mechanics/shoveTarget.js): uma arvorezinha com frutinhas,
// uma mesinha de canto e uma estante baixa. Cada uma devolve { object, setSway(a, va), socket(lx, ly, lz), update? }:
// o objeto fica na origem com a face empurrada para +Z local (quem monta gira com rotation.y = atan2(nx, nz));
// setSway inclina para longe da dog (a = rad; a árvore balança pelo pé, com a copa atrasada; a mesa e a estante
// tombam pela aresta de trás e voltam aos pés); socket(…) é um ponto que balança junto, para o item lá em cima.
import * as THREE from 'three';
import {
  woodMat, stdMat, rbox, rng, foliageCluster, leafSkin, contactShadow, shadowAll, canvasTexture, speckleTexture, mat,
  vnoise3,
} from './util.js';
import { crownMat, plantMat, succulent } from './plants.js';

const TAU = Math.PI * 2;

/** Medidas que a fase usa para o ponto de apoio (patas) e o item (m). */
export const SHOVE_PROP_SIZE = Object.freeze({
  tree: Object.freeze({ trunkR: 0.068, fork: 0.92, paws: 0.44 }),
  table: Object.freeze({ w: 0.74, d: 0.46, h: 0.5 }),
  shelf: Object.freeze({ w: 0.9, d: 0.3, h: 0.62 }),
});

/** Raio do tronco da arvorezinha na altura y (m), sem a casca: onde as patas encostam. */
export function treeTrunkRadius(y) {
  const T = SHOVE_PROP_SIZE.tree;
  const h = T.fork + 0.06;
  return T.trunkR + (T.trunkR * 0.72 - T.trunkR) * Math.min(1, Math.max(0, y / h));
}

/** Ponto que acompanha o balanço: um Object3D filho de `parent` em (lx, ly, lz) do objeto. */
function makeSocket(parent, origin) {
  return (lx, ly, lz) => {
    const s = new THREE.Object3D();
    s.position.set(lx - origin.x, ly - origin.y, lz - origin.z);
    parent.add(s);
    return s;
  };
}

// ------------------------------------------------------------------------------------------------ arvorezinha

/** Tronco afunilado e um pouco torto, com casca (ruído nos vértices). */
function trunkGeometry(h, r0, r1, seed) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 12, 10, true);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y / h;
    const a = Math.atan2(z, x);
    // casca: sulcos verticais e nós
    const bark = 1 + (vnoise3(Math.cos(a) * 2 + seed, y * 7, Math.sin(a) * 2) - 0.5) * 0.16 + Math.sin(a * 7 + y * 3) * 0.025;
    // pé alargado (raízes)
    const flare = 1 + Math.max(0, 0.12 - y) / 0.12 * 0.55 * (0.75 + 0.25 * Math.sin(a * 4 + seed));
    // curva suave no alto do tronco (embaixo, onde as patas apoiam, ele é reto)
    const bend = Math.max(0, (t - 0.55) / 0.45) ** 2 * 0.03;
    p.setXYZ(i, x * bark * flare + bend, y, z * bark * flare);
  }
  g.computeVertexNormals();
  return g;
}

/** Galho: tubo que afina do ponto a até b (curva com um meio levantado). */
function branchGeometry(a, b, r0, r1, lift = 0.06) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y += lift;
  const curve = new THREE.CatmullRomCurve3([a, mid, b]);
  const g = new THREE.TubeGeometry(curve, 10, 1, 7, false);
  // afina: o raio vai de r0 a r1 ao longo do tubo (o TubeGeometry tem raio 1: escala cada anel)
  const p = g.attributes.position;
  const tmp = new THREE.Vector3();
  const rings = 11;
  const perRing = p.count / rings;
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / perRing);
    const t = ring / (rings - 1);
    const c = curve.getPointAt(t);
    tmp.fromBufferAttribute(p, i).sub(c).multiplyScalar(r0 + (r1 - r0) * t).add(c);
    p.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Arvorezinha (pé de tangerina novo) com terra fofa em volta. Pé na origem; empurrada pelo tronco a SHOVE_PROP_SIZE.tree.paws m.
 * @param {{ seed?: number, height?: number, fruits?: number, leaves?: number }} [o]
 */
export function buildLittleTree({ seed = 4, height = 1.75, fruits = 9, leaves = 900 } = {}) {
  const T = SHOVE_PROP_SIZE.tree;
  const object = new THREE.Group();
  object.name = 'arvorezinha';
  const bark = woodMat('#6e5038', { key: 'shove-bark', vertical: true, rough: 0.95 });
  // balanço: o tronco inclina pelo pé; a copa, pela forquilha, com atraso
  const trunkSway = new THREE.Group();
  const crownSway = new THREE.Group();
  crownSway.position.y = T.fork;
  trunkSway.add(crownSway);
  object.add(trunkSway);

  const trunk = new THREE.Mesh(trunkGeometry(T.fork + 0.06, T.trunkR, T.trunkR * 0.72, seed), bark);
  trunk.name = 'tronco';
  const cap = new THREE.Mesh(new THREE.SphereGeometry(T.trunkR * 0.74, 10, 8), bark);
  cap.position.set(0.008, T.fork + 0.05, 0);
  trunkSway.add(trunk, cap);
  // galhos da forquilha até a copa (no referencial da copa: a forquilha em y = 0)
  const r = rng(seed);
  const crownC = new THREE.Vector3(0, height - T.fork - 0.42, 0);
  const tips = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + r() * 0.8;
    const tip = new THREE.Vector3(Math.cos(a) * (0.22 + r() * 0.12), crownC.y + (r() - 0.2) * 0.2, Math.sin(a) * (0.22 + r() * 0.12));
    tips.push(tip);
    const br = new THREE.Mesh(branchGeometry(new THREE.Vector3(0, 0.02, 0), tip, T.trunkR * 0.55, 0.012, 0.03), bark);
    crownSway.add(br);
  }
  const blobs = [
    { x: 0, y: crownC.y + 0.05, z: 0, r: 0.44 },
    { x: 0.26, y: crownC.y - 0.06, z: 0.08, r: 0.3 },
    { x: -0.25, y: crownC.y - 0.04, z: -0.06, r: 0.31 },
    { x: 0.04, y: crownC.y + 0.3, z: -0.05, r: 0.3 },
    { x: -0.06, y: crownC.y - 0.02, z: 0.26, r: 0.28 },
    { x: 0.08, y: crownC.y, z: -0.27, r: 0.28 },
  ];
  const crownGeo = foliageCluster(blobs, { detail: 3, amp: 0.2, freq: 3.4, seed: seed + 7, dark: '#2a4a1c', mid: '#4d7a2b', light: '#a3c45a' });
  const crown = new THREE.Mesh(crownGeo, crownMat());
  crown.name = 'copa';
  crown.castShadow = true;
  crown.receiveShadow = true;
  crownSway.add(crown);
  const skin = leafSkin(crownGeo, { count: leaves, size: 0.07, seed: seed + 3, material: plantMat(), minNormalY: -0.55 });
  crownSway.add(skin);
  // tangerinas na superfície da copa (sem atravessar a bolinha: a fase pede o ninho antes, em socket)
  const fruitMat = stdMat('#f08a1f', { roughness: 0.5 });
  const leafMat = stdMat('#3f6b24', { roughness: 0.7 });
  const fruitGeo = new THREE.SphereGeometry(0.036, 12, 9).scale(1, 0.86, 1);
  const pos = crownGeo.attributes.position;
  const nor = crownGeo.attributes.normal;
  const n = new THREE.Vector3();
  let placed = 0;
  for (let k = 0; placed < fruits && k < 400; k++) {
    const i = Math.floor(r() * pos.count);
    n.fromBufferAttribute(nor, i);
    if (n.y > 0.55 || n.y < -0.6) continue;
    const f = new THREE.Mesh(fruitGeo, fruitMat);
    f.position.fromBufferAttribute(pos, i).addScaledVector(n, 0.02);
    f.castShadow = true;
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4).scale(1.6, 0.3, 0.8), leafMat);
    lf.position.set(0.01, 0.03, 0);
    f.add(lf);
    crownSway.add(f);
    placed++;
  }
  shadowAll(trunk);

  // canteiro: terra fofa com folhinhas secas, um pouco acima do chão (sem coincidir com o gramado)
  const soilMat = mat('shove-soil', () => new THREE.MeshStandardMaterial({ color: '#5a3f2a', roughness: 1, map: speckleTexture() }));
  const soilGeo = new THREE.CylinderGeometry(0.34, 0.37, 0.03, 28, 1);
  const sp = soilGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    if (sp.getY(i) > 0) sp.setY(i, 0.015 + (vnoise3(sp.getX(i) * 9 + seed, 0, sp.getZ(i) * 9) - 0.5) * 0.012);
  }
  soilGeo.computeVertexNormals();
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = 0.013;
  soil.receiveShadow = true;
  object.add(soil);
  // pedrinhas na borda
  const stoneMat = stdMat('#b8ad9c', { roughness: 0.9 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + r() * 0.2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035 + r() * 0.012, 0), stoneMat);
    st.scale.set(1.2, 0.55, 1);
    st.position.set(Math.cos(a) * 0.37, 0.012, Math.sin(a) * 0.37);
    st.rotation.y = r() * TAU;
    st.castShadow = true;
    object.add(st);
  }
  const sh = contactShadow(0.7, 0.7, 0.42);
  object.add(sh);

  return {
    object,
    occluders: [crown],
    /** @param {number} a rad (+ = para longe da dog) @param {number} va rad/s */
    setSway(a, va) {
      trunkSway.rotation.x = -a * 0.45;
      crownSway.rotation.x = -(a * 0.7 + va * 0.012);
      crownSway.rotation.z = va * 0.004;
    },
    /** Ponto na copa (referencial do objeto, sem balanço), para o item preso nos galhos. */
    socket: (lx, ly, lz) => {
      const s = new THREE.Object3D();
      s.position.set(lx, ly - T.fork, lz);
      crownSway.add(s);
      // ninho: dois raminhos segurando o item
      for (const side of [-1, 1]) {
        const tw = new THREE.Mesh(branchGeometry(new THREE.Vector3(0, -T.fork * 0.02, 0), new THREE.Vector3(lx + side * 0.06, ly - T.fork - 0.07, lz), 0.014, 0.006, 0.02), bark);
        crownSway.add(tw);
      }
      return s;
    },
  };
}

// ------------------------------------------------------------------------------------------------ mesinha

/** Toalhinha de crochê (decalque circular, transparente). */
function doilyTexture() {
  return canvasTexture(256, 256, (g, w) => {
    g.clearRect(0, 0, w, w);
    g.translate(w / 2, w / 2);
    g.fillStyle = 'rgba(250,246,236,0.95)';
    for (let i = 0; i < 24; i++) {
      g.save();
      g.rotate((i / 24) * TAU);
      g.beginPath();
      g.arc(0, w * 0.4, w * 0.07, 0, TAU);
      g.fill();
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, w * 0.4, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let ring = 1; ring <= 3; ring++) {
      const n = 8 * ring;
      for (let i = 0; i < n; i++) {
        g.beginPath();
        const a = (i / n) * TAU;
        g.arc(Math.cos(a) * w * 0.11 * ring, Math.sin(a) * w * 0.11 * ring, w * 0.022, 0, TAU);
        g.fill();
      }
    }
  }, { repeat: false });
}

/**
 * Mesinha de canto de madeira com toalhinha e um vasinho. Pés na origem, tampo a SHOVE_PROP_SIZE.table.h m; a face
 * empurrada (+Z) e o item na beirada de trás (−Z).
 */
export function buildSideTable() {
  const { w, d, h } = SHOVE_PROP_SIZE.table;
  const object = new THREE.Group();
  object.name = 'mesinha';
  // tomba pela aresta de baixo de trás
  const tilt = new THREE.Group();
  tilt.position.set(0, 0, -d / 2);
  object.add(tilt);
  const body = new THREE.Group();
  body.position.set(0, 0, d / 2);
  tilt.add(body);
  const wood = woodMat('#a8693c', { key: 'shove-table', rough: 0.6 });
  const woodDark = woodMat('#86502c', { key: 'shove-table-dark', rough: 0.65 });
  const top = new THREE.Mesh(rbox(w, 0.034, d, 0.012), wood);
  top.name = 'tampo';
  top.position.y = h - 0.017;
  body.add(top);
  // saia (avental) sob o tampo, recuada
  const apronH = 0.07;
  for (const [x, z, ww, dd] of [[0, d / 2 - 0.045, w - 0.12, 0.02], [0, -d / 2 + 0.045, w - 0.12, 0.02], [w / 2 - 0.045, 0, 0.02, d - 0.12], [-w / 2 + 0.045, 0, 0.02, d - 0.12]]) {
    const ap = new THREE.Mesh(rbox(ww, apronH, dd, 0.006), woodDark);
    ap.position.set(x, h - 0.034 - apronH / 2 - 0.002, z);
    body.add(ap);
  }
  // gavetinha com puxador na frente
  const drawer = new THREE.Mesh(rbox(w * 0.42, apronH - 0.016, 0.012, 0.004), wood);
  drawer.position.set(0, h - 0.034 - apronH / 2 - 0.002, d / 2 - 0.03);
  body.add(drawer);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), stdMat('#c9a35a', { metalness: 0.8, roughness: 0.3 }));
  knob.position.set(0, h - 0.034 - apronH / 2 - 0.002, d / 2 - 0.018);
  body.add(knob);
  // pés torneados afinando
  const legGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 0), new THREE.Vector2(0.016, 0), new THREE.Vector2(0.019, 0.03), new THREE.Vector2(0.015, 0.06),
    new THREE.Vector2(0.018, 0.2), new THREE.Vector2(0.022, h - 0.12), new THREE.Vector2(0.026, h - 0.1), new THREE.Vector2(0.026, h - 0.036),
    new THREE.Vector2(0.001, h - 0.036),
  ], 12);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, woodDark);
      leg.position.set(sx * (w / 2 - 0.045), 0, sz * (d / 2 - 0.045));
      body.add(leg);
    }
  }
  // toalhinha (decalque) e vasinho com suculenta num canto
  const doily = new THREE.Mesh(
    new THREE.CircleGeometry(0.15, 32).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: doilyTexture(), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  doily.position.set(w * 0.22, h + 0.001, 0.02);
  body.add(doily);
  const potMat = stdMat('#e9e2d2', { roughness: 0.5 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.07, 18), potMat);
  pot.position.set(w * 0.22, h + 0.036, 0.02);
  body.add(pot);
  const plant = new THREE.Mesh(succulent({ r: 0.05, seed: 11, color: '#8fb3a0' }), plantMat());
  plant.position.set(w * 0.22, h + 0.068, 0.02);
  body.add(plant);
  shadowAll(body);
  const sh = contactShadow(w * 0.62, d * 0.62, 0.38);
  object.add(sh);
  return {
    object,
    occluders: [],
    /** @param {number} a rad (+ = tomba para longe da dog) */
    setSway(a) { tilt.rotation.x = -Math.max(0, a); },
    socket: makeSocket(body, new THREE.Vector3(0, 0, 0)),
  };
}

// ------------------------------------------------------------------------------------------------ estante baixa

/**
 * Estante baixa de madeira clara com livros, um vasinho e uma caixinha. Pés na origem, tampo a
 * SHOVE_PROP_SIZE.shelf.h m; a face empurrada (+Z) e o item no tampo, rente à beirada de trás (−Z).
 */
export function buildLowShelf({ seed = 7 } = {}) {
  const { w, d, h } = SHOVE_PROP_SIZE.shelf;
  const object = new THREE.Group();
  object.name = 'estante-baixa';
  const tilt = new THREE.Group();
  tilt.position.set(0, 0, -d / 2);
  object.add(tilt);
  const body = new THREE.Group();
  body.position.set(0, 0, d / 2);
  tilt.add(body);
  const wood = woodMat('#d2a878', { key: 'shove-shelf', rough: 0.7 });
  const side = 0.024;
  for (const sx of [-1, 1]) {
    const s = new THREE.Mesh(rbox(side, h - 0.013, d, 0.006), wood);
    s.position.set(sx * (w / 2 - side / 2), (h - 0.013) / 2, 0);
    body.add(s);
  }
  const top = new THREE.Mesh(rbox(w + 0.02, 0.026, d + 0.012, 0.008), wood);
  top.name = 'tampo';
  top.position.y = h - 0.013;
  body.add(top);
  const boards = [0.05, 0.34];
  for (const y of boards) {
    const b = new THREE.Mesh(rbox(w - side * 2 + 0.004, 0.02, d - 0.02, 0.004), wood);
    b.position.set(0, y, 0.004);
    body.add(b);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(w - side * 2 + 0.004, h - 0.05, 0.008), woodMat('#bf9466', { key: 'shove-shelf-back', rough: 0.8 }));
  back.position.set(0, (h - 0.03) / 2 + 0.012, -d / 2 + 0.006);
  body.add(back);
  // rodapé
  const kick = new THREE.Mesh(rbox(w - side * 2 + 0.004, 0.04, 0.016, 0.004), wood);
  kick.position.set(0, 0.022, d / 2 - 0.014);
  body.add(kick);
  // livros nas duas prateleiras
  const r = rng(seed);
  const colors = ['#c0543f', '#3f6f8f', '#e0b04f', '#5c8a4f', '#8a5a9a', '#d9d0bf', '#2f4f5f'];
  // (na de cima, a direita fica para o vasinho)
  for (const [y0, y1, xMax] of [[0.06, 0.33, w / 2 - side - 0.05], [0.35, h - 0.03, w * 0.3 - 0.09]]) {
    let x = -w / 2 + side + 0.02;
    while (x < xMax) {
      if (r() < 0.12) { x += 0.05; continue; }
      const bw = 0.022 + r() * 0.025;
      const bh = Math.min(y1 - y0 - 0.01, 0.16 + r() * 0.09);
      const bd = d * (0.6 + r() * 0.2);
      const lean = x > xMax - 0.07 && r() < 0.5 ? 0.18 : 0;
      const book = new THREE.Mesh(rbox(bw, bh, bd, 0.004), stdMat(colors[Math.floor(r() * colors.length)], { roughness: 0.7 }));
      book.position.set(x + bw / 2, y0 + 0.001 + bh / 2, -d / 2 + 0.015 + bd / 2);
      book.rotation.z = -lean;
      if (lean) book.position.y -= bh * 0.02;
      body.add(book);
      x += bw + 0.002 + (lean ? 0.04 : 0);
    }
  }
  // um vasinho no meio da prateleira de cima e uma caixinha na de baixo (por cima dos livros não)
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.065, 16), stdMat('#c86b4a', { roughness: 0.8 }));
  pot.position.set(w * 0.3, 0.35 + 0.01 + 0.0325, 0.03);
  body.add(pot);
  const plant = new THREE.Mesh(succulent({ r: 0.045, seed: seed + 2, color: '#7fa58d' }), plantMat());
  plant.position.set(w * 0.3, 0.35 + 0.01 + 0.062, 0.03);
  body.add(plant);
  shadowAll(body);
  const sh = contactShadow(w * 0.62, d * 0.75, 0.4);
  object.add(sh);
  return {
    object,
    occluders: [],
    /** @param {number} a rad (+ = tomba para longe da dog) */
    setSway(a) { tilt.rotation.x = -Math.max(0, a); },
    socket: makeSocket(body, new THREE.Vector3(0, 0, 0)),
  };
}
