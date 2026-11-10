// RECANTO DAS PATINHAS — o meio do condomínio, visto de perto (3ª pessoa), em três zonas (um grupo do kit por zona,
// para o recorte da câmera). Todas as posições saem de ../layout.js:
//   piscina  o deque de tábuas com a borda atérmica, a água em degradê (clara no raso, a oeste; azul no fundo, a leste)
//            com o brilho do sol no fundo e na superfície, as paredes de pastilha com o barrado da linha d'água, a
//            patinha de mosaico, os refletores, a escada de inox, as espreguiçadeiras com almofada (por baixo delas a
//            Radhija passa), o guarda-sol aberto, a ducha com o estrado, o filtro, a peneira, as toalhas, as boias (a
//            de patinho, não: essa sumiu e fica só a MARCA MOLHADA em RECON), as folhas da tempestade e as poças;
//   servico  o piso de cimento, a parede de azulejo com os dois tanques embaixo do telhadinho de telha colonial — o da
//            esquerda com o RALO SEM A ROLHA (só a correntinha vazia: a pista escondida) —, as torneiras, a prateleira
//            do sabão, o balde, a vassoura, a mangueira, os postes do VARAL com a sapata de concreto e o saquinho de
//            pregadores; os fios e as roupas estão em props.line e o CESTO de roupa, em props.laundry;
//   torre    o prédio de serviço: reboco com barrado e rodapé, cunhais, janelinhas com grade e floreira, a PORTA DE
//            MOLA (props.towerDoor, com a mola aparente por fora e a mola aérea no saguão), o toldinho, os canos, o
//            INTERFONE de três botões com as plaquinhas (props.intercom), o saguão por dentro (piso, barrado, caixas
//            de correio, o começo da escada, o teto) e, em cima, o terraço com a mureta, a casinha da escada, a caixa
//            d'água com a escada de marinheiro e os aparelhos de ar (props.terrace).
// Os pisos de andar têm o alto até 0,02 m (as dogs andam em y = 0). O que fica em pé onde elas andam está dentro de um
// colisor do layout, ou é baixo (≤ 0,08 m) ou alto (≥ 0,5 m). Os móveis a mais (a mesinha e o baú das boias do deque, a
// máquina de lavar e o varal de chão, o abrigo do gás) só são desenhados quando o layout traz a constante (e o colisor)
// de cada um: POOL_TABLE, POOL_TOYBOX, SERVICE_WASHER, SERVICE_RACK, TOWER_GAS.
// API: buildComum(kit, root, L) → { props: { line, laundry, towerDoor, intercom, terrace }, seeThrough, update(dt, t),
//   reset(), dispose(), signs }
import * as THREE from 'three';
import { rng, mat, paint, mergeGeometries, canvasTexture } from '../../../../world/util.js';
import { buildWallButton, wallButtonYaw } from '../../../../world/wallButton.js';
import { rb, cyl, slab, tiles, tilesV, windowAt, SLOTS } from '../../../../levels/mapa/world/kit.js';
import { waterMat, flowerBush } from '../../../../levels/mapa/world/pecas.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (k) => Math.min(1, Math.max(0, k));
const smooth = (k) => { const x = clamp01(k); return x * x * (3 - 2 * x); };

/**
 * Alturas da piscina: o alto das tábuas do deque, o da borda atérmica, a largura da borda e o nível da água. O deque e
 * o cimento da área de serviço (FLOOR) ficam fora das alturas dos caminhos de lajota da base (0,012 a 0,015).
 */
const DECK = 0.018;
const COPE = 0.022;
const CW = 0.3;
const WATER = -0.07;
const FLOOR = 0.009;
const CHROME = '#dfe5ea';

// ---------------------------------------------------------------- ajudantes de cor e de forma
/** Número de 0 a 1 estável por célula (i, j) e semente: a variação das lajotas, tábuas e pastilhas. */
function hash(i, j, s = 0) {
  const n = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
/** Cor com variação leve e estável por posição (reboco, cimento, granito, madeira). */
function speckle(hex, amp = 0.05, seed = 1) {
  const base = new THREE.Color(hex), out = new THREE.Color();
  return (p) => out.copy(base).offsetHSL(0, 0, (hash(Math.floor(p.x * 9), Math.floor(p.y * 9) + Math.floor(p.z * 9) * 57, seed) - 0.5) * amp);
}
/** Uma cor da lista por célula quadrada de `size` (pisos, pastilhas). */
function cells(hexes, size, seed = 0) {
  const cols = hexes.map((h) => new THREE.Color(h));
  return (p) => cols[Math.floor(hash(Math.floor((p.x + 50) / size), Math.floor((p.z + 50) / size), seed) * cols.length)];
}
/** Cor ou função de cor → função de cor. @returns {(p: THREE.Vector3, n?: THREE.Vector3) => THREE.Color} */
function toFn(c) {
  if (typeof c === 'function') return c;
  const col = new THREE.Color(c);
  return () => col;
}
/** Duas cores pela direção da face (normal local): `inside` nas voltadas para (dx, dz), `out` nas outras. */
function twoTone(out, inside, dx, dz) {
  const fo = toFn(out), fi = toFn(inside);
  return (p, n) => (n.x * dx + n.z * dz > 0.5 ? fi(p, n) : fo(p, n));
}
/** Uma cor por triângulo, pelo centro dele (listras e trançados de verdade): devolve a geometria sem índice. */
function faceColors(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    p.set(0, 0, 0);
    n.set(0, 0, 0);
    for (let k = 0; k < 3; k++) {
      p.x += pos.getX(i + k) / 3; p.y += pos.getY(i + k) / 3; p.z += pos.getZ(i + k) / 3;
      n.x += nor.getX(i + k); n.y += nor.getY(i + k); n.z += nor.getZ(i + k);
    }
    const c = fn(p, n.normalize());
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/** Retângulos deitados, voltados para cima, em y = 0: [x0, z0, x1, z1, cor] (mosaico, grelhas, juntas, decalques). */
function flatQuads(list) {
  const pos = [], nor = [], col = [];
  const c = new THREE.Color();
  for (const [x0, z0, x1, z1, hex] of list) {
    c.set(hex);
    for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) {
      pos.push(x, 0, z);
      nor.push(0, 1, 0);
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/** Grelha de ralo deitada (quadrados sem sobreposição): a moldura clara e as fendas escuras. */
function grate(s = 0.2, n = 4, light = '#c9ced2', dark = '#2f3134') {
  const h = s / 2, b = s * 0.12;
  const list = [[-h, -h, h, -h + b, light], [-h, h - b, h, h, light], [-h, -h + b, -h + b, h - b, light], [h - b, -h + b, h, h - b, light]];
  const step = (s - 2 * b) / (2 * n - 1);
  for (let i = 0; i < 2 * n - 1; i++) list.push([-h + b, -h + b + i * step, h - b, -h + b + (i + 1) * step, i % 2 ? light : dark]);
  return flatQuads(list);
}
/** Mancha deitada de contorno irregular (raio r), voltada para cima. */
function blob(r, seed = 1, n = 18, wob = 0.16) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + wob * (0.6 * Math.sin(2 * a + seed) + 0.4 * Math.sin(3 * a + seed * 2.1)));
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ShapeGeometry(s, 1).rotateX(-Math.PI / 2);
}
/** Anel deitado de contorno irregular (a marca da boia): raio de dentro r0, de fora r1. */
function ringBlob(r0, r1, seed = 1, n = 30) {
  const s = new THREE.Shape(), hole = new THREE.Path();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const wo = 1 + 0.07 * Math.sin(3 * a + seed) + 0.05 * Math.sin(5 * a + seed * 1.7);
    const wi = 1 + 0.09 * Math.sin(2 * a - seed) + 0.04 * Math.sin(4 * a + seed);
    if (i === 0) {
      s.moveTo(Math.cos(a) * r1 * wo, Math.sin(a) * r1 * wo);
      hole.moveTo(Math.cos(a) * r0 * wi, Math.sin(a) * r0 * wi);
    } else {
      s.lineTo(Math.cos(a) * r1 * wo, Math.sin(a) * r1 * wo);
      hole.lineTo(Math.cos(a) * r0 * wi, Math.sin(a) * r0 * wi);
    }
  }
  s.holes.push(hole);
  return new THREE.ShapeGeometry(s, 1).rotateX(-Math.PI / 2);
}
/** Estrela deitada de `n` pontas (a flor de ipê boiando, vista de cima). */
function starGeo(n, r1, r0) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * TAU, r = i % 2 ? r0 : r1;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(s, 1).rotateX(-Math.PI / 2);
}
/** Haste (cilindro de raio r) de a até b. */
function stick(a, b, r, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const geo = new THREE.CylinderGeometry(r, r, d.length(), seg);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}
/** Viga (caixa w × h) de a até b (nunca na vertical). */
function beam(a, b, w, h) {
  const d = new THREE.Vector3().subVectors(b, a);
  const geo = new THREE.BoxGeometry(w, h, d.length());
  geo.lookAt(d);
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

const KEEP = ['position', 'normal', 'color'];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/**
 * Peças pintadas numa geometria só, para as malhas que se mexem (porta, roupas, pregador, hélices). Cada peça:
 * [geometria, { color, x, y, z, rx, ry, rz, sx, sy, sz }]; color null mantém a cor da geometria (como no kit).
 */
function bake(list) {
  const parts = [];
  for (const [geo, o = {}] of list) {
    const g = geo.clone();
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (o.color !== null || !g.attributes.color) paint(g, o.color ?? '#ffffff');
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _m4.compose(_p.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e), _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    parts.push(g.applyMatrix4(_m4));
  }
  const out = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return out;
}
/** Malha com sombra (as que se mexem). */
function mesh(geo, material, { cast = true, receive = true, name = '' } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}
/** Tecido pendurado: as duas faces, cor por vértice (as roupas do varal e da cadeira). */
const clothMat = () => mat('recanto-pano', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));

/**
 * Pano pendurado w × h (topo em y = 0, voltado para +z), com dobras que crescem para baixo e uma cor por quadradinho
 * (listras, barras, bolinhas). keep(u, v) recorta a silhueta (camiseta, meia, bandana, bermuda); u, v de 0 a 1.
 */
function clothGeo(w, h, nx, ny, colorAt, { amp = 0.012, waves = 2.5, seed = 0, keep = null } = {}) {
  const Z = (x, y) => amp * Math.sin((x / w) * Math.PI * waves + seed) * (0.25 + 0.75 * Math.min(1, -y / h));
  const nv = new THREE.Vector3();
  const N = (x, y) => {
    const e = 1e-3;
    nv.set(-(Z(x + e, y) - Z(x - e, y)) / (2 * e), -(Z(x, y + e) - Z(x, y - e)) / (2 * e), 1).normalize();
    return [nv.x, nv.y, nv.z];
  };
  const pos = [], nor = [], col = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const u = (i + 0.5) / nx, v = (j + 0.5) / ny;
      if (keep && !keep(u, v)) continue;
      const x0 = -w / 2 + (w * i) / nx, x1 = -w / 2 + (w * (i + 1)) / nx;
      const y0 = -(h * j) / ny, y1 = -(h * (j + 1)) / ny;
      const c = colorAt(u, v, i, j);
      for (const [x, y] of [[x0, y0], [x0, y1], [x1, y0], [x1, y0], [x0, y1], [x1, y1]]) {
        pos.push(x, y, Z(x, y));
        nor.push(...N(x, y));
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Palmeirinha de vaso (ráfis): folhas compridas em leque, cada uma com folíolos (as duas faces: balde 'plant'). */
function palm({ h = 0.85, fronds = 7, seed = 1 } = {}) {
  const R = rng(seed);
  const pos = [], col = [];
  const dark = new THREE.Color('#2f5a24'), light = new THREE.Color('#86b04e'), tmp = new THREE.Color();
  const tri = (a, b, c, k) => {
    pos.push(...a, ...b, ...c);
    tmp.copy(dark).lerp(light, k);
    for (let i = 0; i < 3; i++) col.push(tmp.r, tmp.g, tmp.b);
  };
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * TAU + R() * 0.6;
    const len = h * (0.72 + R() * 0.32), out = 0.3 + R() * 0.32;
    const dx = Math.cos(a), dz = Math.sin(a);
    const pt = (s) => [dx * out * len * s * s, len * (s * 1.05 - 0.38 * s * s), dz * out * len * s * s];
    const N = 7, w = 0.007;
    for (let i = 1; i <= N; i++) {
      const p0 = pt((i - 1) / N), p1 = pt(i / N), s1 = i / N;
      tri([p0[0] - dz * w, p0[1], p0[2] + dx * w], [p1[0] - dz * w, p1[1], p1[2] + dx * w], [p1[0] + dz * w, p1[1], p1[2] - dx * w], 0.15);
      tri([p0[0] - dz * w, p0[1], p0[2] + dx * w], [p1[0] + dz * w, p1[1], p1[2] - dx * w], [p0[0] + dz * w, p0[1], p0[2] - dx * w], 0.15);
      if (i < 2) continue;
      const ll = 0.15 * Math.sin(s1 * Math.PI * 0.9) + 0.04;
      for (const side of [-1, 1]) {
        const sx = -dz * side, sz = dx * side;
        tri(p0, p1, [p1[0] + sx * ll + dx * ll * 0.3, p1[1] - ll * 0.4, p1[2] + sz * ll + dz * ll * 0.3], 0.35 + s1 * 0.55);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/** Espada-de-são-jorge: lâminas em pé, pontudas, com as faixas verdes (balde 'plant'). */
function snakePlant({ h = 0.55, n = 8, seed = 2 } = {}) {
  const R = rng(seed);
  const cs = ['#2f5a2a', '#55833d', '#3a642e', '#6f9a4a'].map((c) => new THREE.Color(c));
  const pos = [], col = [];
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, hh = h * (0.6 + R() * 0.45), w = 0.032 + R() * 0.014, lean = 0.04 + R() * 0.08;
    const dx = Math.cos(a), dz = Math.sin(a), fx = -dz, fz = dx;
    const ox = dx * 0.035 * R(), oz = dz * 0.035 * R();
    const S = 4;
    for (let s = 0; s < S; s++) {
      const t0 = s / S, t1 = (s + 1) / S;
      const w0 = w * (1 - t0 * 0.8), w1 = s === S - 1 ? 0.002 : w * (1 - t1 * 0.8);
      const c0x = ox + dx * lean * t0 * t0, c0z = oz + dz * lean * t0 * t0, c1x = ox + dx * lean * t1 * t1, c1z = oz + dz * lean * t1 * t1;
      const A = [c0x - fx * w0, hh * t0, c0z - fz * w0], B = [c0x + fx * w0, hh * t0, c0z + fz * w0];
      const Cc = [c1x + fx * w1, hh * t1, c1z + fz * w1], Dd = [c1x - fx * w1, hh * t1, c1z - fz * w1];
      const c = cs[(s + i) % cs.length];
      pos.push(...A, ...B, ...Cc, ...A, ...Cc, ...Dd);
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/** Vaso no kit: corpo afunilado (aberto em cima, com a terra aparecendo), a borda e a planta. */
function potAt(add, { x, z, y = 0, r = 0.16, h = 0.34, color = '#c46a43', slot = 'solid', plant = null, plantSlot = 'plant', ry = 0 }) {
  add(new THREE.CylinderGeometry(r, r * 0.74, h, 14, 1, true).translate(0, h / 2, 0), { color: speckle(color, 0.06, x * 3 + z), slot, x, y, z });
  add(new THREE.TorusGeometry(r * 1.0, 0.022, 6, 14).rotateX(Math.PI / 2), { color, slot, x, y: y + h - 0.012, z, ao: false });
  add(cyl(r * 0.97, r * 0.97, 0.01, 14), { color: '#4a3424', slot: 'ground', x, y: y + h - 0.04, z, ao: false });
  if (plant) add(plant, { color: null, slot: plantSlot, x, y: y + h - 0.035, z, ry, ao: false });
}

/**
 * Touceira de capim rente ao chão (lâminas afuniladas; com `flower`, umas florzinhas em hastes curtas). As duas faces:
 * balde 'plant', num grupo de nome isento de colisor (as dogs passam roçando).
 */
function tuftGeo({ seed = 1, h = 0.14, blades = 7, flower = null, flowers = 3 } = {}) {
  const R = rng(seed);
  const pos = [], col = [];
  const dark = new THREE.Color('#4a7a2c'), light = new THREE.Color('#a9c860'), tmp = new THREE.Color();
  const tri = (a, b, c, color) => {
    pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b);
  };
  for (let i = 0; i < blades; i++) {
    const a = R() * TAU, hh = h * (0.55 + R() * 0.6), w = 0.006 + R() * 0.005, lean = 0.03 + R() * 0.07;
    const ox = (R() - 0.5) * 0.06, oz = (R() - 0.5) * 0.06, k = R() * 0.25;
    const dx = Math.cos(a), dz = Math.sin(a), fx = -dz, fz = dx;
    const mx = ox + dx * lean * 0.3, mz = oz + dz * lean * 0.3;
    const b0 = [ox - fx * w, 0, oz - fz * w], b1 = [ox + fx * w, 0, oz + fz * w];
    const m0 = [mx - fx * w * 0.7, hh * 0.55, mz - fz * w * 0.7], m1 = [mx + fx * w * 0.7, hh * 0.55, mz + fz * w * 0.7];
    tri(b0, b1, m1, tmp.copy(dark).lerp(light, 0.1 + k));
    tri(b0, m1, m0, tmp.copy(dark).lerp(light, 0.3 + k));
    tri(m0, m1, [ox + dx * lean, hh, oz + dz * lean], tmp.copy(dark).lerp(light, 0.75 + k));
  }
  if (flower) {
    const fc = new THREE.Color(flower), core = new THREE.Color('#ffd23f'), stem = new THREE.Color('#5f8a34');
    for (let i = 0; i < flowers; i++) {
      const a = R() * TAU, d = 0.02 + R() * 0.05, x = Math.cos(a) * d, z = Math.sin(a) * d;
      const y = h * (0.75 + R() * 0.45), s = 0.016 + R() * 0.008;
      tri([x - 0.003, 0, z], [x + 0.003, 0, z], [x, y, z], stem);
      // a flor: um losango deitado (as pétalas) e o miolo
      tri([x - s, y, z], [x, y + 0.002, z + s], [x + s, y, z], fc);
      tri([x - s, y, z], [x + s, y, z], [x, y + 0.002, z - s], fc);
      tri([x - s * 0.35, y + 0.004, z + s * 0.1], [x + s * 0.1, y + 0.004, z + s * 0.35], [x + s * 0.3, y + 0.004, z - s * 0.3], core);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Mola helicoidal de comprimento 1 ao longo de z, centrada na origem: estica com scale.z. */
function coilGeo(turns = 16, r = 0.016, wire = 0.0034) {
  const pts = [];
  const n = turns * 10;
  for (let i = 0; i <= n; i++) {
    const a = (i / 10) * TAU;
    pts.push(V(Math.cos(a) * r, Math.sin(a) * r, i / n - 0.5));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 5, false);
}

/**
 * Pictograma das plaquinhas do interfone (canvas, sem palavras): o fundo colorido com a moldura clara e o desenho com
 * contorno grosso, para ler de longe. kind: 'osso' | 'nota' | 'sino'.
 */
function pictoTexture(kind, bg) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#fffaf0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = bg;
    g.beginPath();
    if (g.roundRect) g.roundRect(14, 14, w - 28, h - 28, 30); else g.rect(14, 14, w - 28, h - 28);
    g.fill();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    /** As partes de um desenho: primeiro o contorno grosso de todas, depois o miolo de todas (sem riscos por dentro). */
    const draw = (parts, fill) => {
      g.strokeStyle = '#2b1d14';
      g.lineWidth = 26;
      for (const p of parts) { g.beginPath(); p(); g.stroke(); }
      g.fillStyle = fill;
      for (const p of parts) { g.beginPath(); p(); g.fill(); }
    };
    if (kind === 'osso') {
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(-0.6);
      const parts = [() => g.rect(-58, -19, 116, 38)];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(() => g.arc(sx * 62, sy * 23, 29, 0, TAU));
      draw(parts, '#fffaf0');
      g.restore();
    } else if (kind === 'nota') {
      draw([
        () => g.rect(138, 54, 20, 128),
        () => { g.moveTo(156, 54); g.quadraticCurveTo(208, 70, 202, 130); g.quadraticCurveTo(188, 98, 156, 94); g.closePath(); },
        () => g.ellipse(112, 182, 42, 31, -0.35, 0, TAU),
      ], '#fffaf0');
    } else {
      draw([
        () => { g.moveTo(58, 178); g.quadraticCurveTo(84, 152, 84, 116); g.bezierCurveTo(84, 38, 172, 38, 172, 116); g.quadraticCurveTo(172, 152, 198, 178); g.closePath(); },
        () => g.arc(128, 198, 17, 0, TAU),
        () => g.arc(128, 50, 12, 0, TAU),
      ], '#ffd23f');
    }
  }, { repeat: false });
}

/** O brilho do sol na água (canvas): uma teia de curvas claras sobre preto, que se repete sem emenda. */
function causticTexture() {
  return mat('recanto-brilho-da-agua-tex', () => canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    const R = rng(91);
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x = R() * w, y = R() * h, rx = 16 + R() * 30, ry = 12 + R() * 26, rot = R() * Math.PI;
      for (const [lw, a] of [[7, 0.1], [2.4, 0.5]]) {
        g.strokeStyle = `rgba(255,255,255,${a})`;
        g.lineWidth = lw;
        for (const ox of [-w, 0, w]) {
          for (const oy of [-h, 0, h]) {
            g.beginPath();
            g.ellipse(x + ox, y + oy, rx, ry, rot, 0, TAU);
            g.stroke();
          }
        }
      }
    }
  }));
}

/**
 * Toldinho de lona listrada visto de perto: as faixas inclinadas (presas na parede em z = 0 local, saindo para +z) e a
 * sanefa de meias-luas pendurada na beirada, no plano da frente. (x, z): o meio dele na parede; ry: para onde sai.
 */
function awningAt(add, { x, y, z, w, depth, drop, n, colors, ry }) {
  const sw = w / n, tilt = Math.atan2(drop, depth), len = Math.hypot(depth, drop), c = Math.cos(ry), s = Math.sin(ry);
  const tab = new THREE.CylinderGeometry(sw / 2, sw / 2, 0.014, 10, 1, false, Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const lx = -w / 2 + sw * (i + 0.5), color = colors[i % colors.length];
    add(rb(sw * 0.995, 0.03, len, 0.01, 1).translate(0, 0, len / 2).rotateX(tilt), { color, x: x + lx * c, y, z: z - lx * s, ry, ao: false });
    add(tab, { color, x: x + lx * c + (depth - 0.008) * s, y: y - drop + 0.014, z: z - lx * s + (depth - 0.008) * c, ry, ao: false });
  }
  // a barra da frente e os dois lados (triângulos de lona)
  add(new THREE.CylinderGeometry(0.011, 0.011, w, 6).rotateZ(Math.PI / 2), { color: '#c9ced3', x: x + (depth - 0.02) * s, y: y - drop + 0.002, z: z + (depth - 0.02) * c, ry, ao: false });
  for (const side of [-1, 1]) {
    const g = new THREE.BufferGeometry();
    const P = [0, 0, 0, 0, -drop, depth, 0, -drop, 0];
    g.setAttribute('position', new THREE.Float32BufferAttribute(side > 0 ? P : [P[0], P[1], P[2], P[6], P[7], P[8], P[3], P[4], P[5]], 3));
    g.computeVertexNormals();
    add(g, { color: colors[side > 0 ? (n - 1) % colors.length : 0], slot: 'plant', x: x + side * (w / 2 + 0.004) * c, y, z: z - side * (w / 2 + 0.004) * s, ry, ao: false });
  }
}

/** Onde ficam os pilares do muro norte (a mesma conta de base.js): a cada ~3 m, do canto oeste ao portãozinho. */
function northPillars(L) {
  const a = L.WALL.minX, b = L.GATE.x0, n = Math.max(1, Math.round((b - a) / 3));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}
/** O x mais perto de `x` que fica a pelo menos `gap` de todos os pilares de `xs`. */
function clearOf(xs, x, gap) {
  for (const p of xs) if (Math.abs(x - p) < gap) return p + (x >= p ? gap : -gap);
  return x;
}

// ---------------------------------------------------------------- a cena
/**
 * @param {any} kit o kit do mapa das fases (src/levels/mapa/world/kit.js)
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildComum(kit, root, L) {
  /** @type {((dt: number, t: number) => void)[]} */
  const anim = [];
  /** Gotas que pingam (torneira, guarda-sol, ducha, ladrão da caixa d'água): { x, z, y0, y1, period, phase, ripple }. */
  const drips = [];
  const keep = (o) => { root.add(o); return o; };
  const ctx = { kit, L, anim, drips, keep };
  buildPool(ctx);
  buildService(ctx);
  const line = buildLine(ctx);
  const laundry = buildLaundry(ctx);
  const terrace = buildTower(ctx);
  const door = buildTowerDoor(ctx);
  const intercom = buildIntercom(ctx);
  buildGreens(ctx);
  const dripsUpdate = buildDrips(ctx);
  return {
    props: { line: line.prop, laundry: laundry.prop, towerDoor: door.prop, intercom: intercom.prop, terrace },
    // o que fica em pé fora do kit (as malhas do kit, o index.js já entrega)
    seeThrough: [door.prop.object, line.prop.object, laundry.prop.object, intercom.prop.object, terrace.object],
    update(dt, t) {
      for (const f of anim) f(dt, t);
      intercom.prop.update(dt, t);
      dripsUpdate(t);
    },
    reset() {
      line.reset();
      laundry.reset();
      intercom.reset();
      door.prop.setOpen(0);
    },
    // as malhas ficam na árvore da fase: o escopo de recursos libera geometrias e materiais
    dispose() { anim.length = 0; },
    signs: [],
  };
}

// ================================================================ PISCINA
function buildPool({ kit, L, anim, drips, keep }) {
  const g = 'piscina';
  const add = (geo, o) => kit.add(geo, { group: g, ...o });
  const R = rng(41);
  const P = L.POOL, Dk = P.deck, D = P.depth;
  const cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2, W = P.x1 - P.x0, H = P.z1 - P.z0;
  const ox0 = P.x0 - CW, ox1 = P.x1 + CW, oz0 = P.z0 - CW, oz1 = P.z1 + CW; // o contorno de fora da borda
  const F = L.POOL_FILTER, Sh = L.POOL_SHOWER, U = L.UMBRELLA, Rc = L.RECON;

  // ---------- o deque: contrapiso escuro (aparece nas frestas), tábuas de cumaru e o arremate da beirada
  const plane = (x0, z0, x1, z1, y, color) => add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), { color, slot: 'ground', x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, ao: false });
  for (const [x0, z0, x1, z1] of [[Dk.x0, Dk.z0, Dk.x1, oz0], [Dk.x0, oz1, Dk.x1, Dk.z1], [Dk.x0, oz0, ox0, oz1], [ox1, oz0, Dk.x1, oz1]]) plane(x0, z0, x1, z1, 0.005, '#3a2b20');
  // o rejunte claro embaixo da borda atérmica
  for (const [x0, z0, x1, z1] of [[ox0, oz0, ox1, P.z0], [ox0, P.z1, ox1, oz1], [ox0, P.z0, P.x0, P.z1], [P.x1, P.z0, ox1, P.z1]]) plane(x0, z0, x1, z1, 0.008, '#cfc6b6');
  const woods = ['#a8734a', '#9c6a42', '#b47d50', '#a06c45', '#b9845a', '#94633e'].map((c) => new THREE.Color(c));
  /** Uma fileira de tábuas de xa a xb (emendas desencontradas), entre za e zb. */
  const row = (xa, xb, za, zb, seed) => {
    const Rr = rng(seed);
    const cuts = [xa];
    for (let x = xa + 0.35 + Rr() * 1.5; x < xb - 0.35; x += 1.5 + Rr() * 1.3) cuts.push(x);
    cuts.push(xb);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i] + (i ? 0.005 : 0), b = cuts[i + 1] - (i + 2 < cuts.length ? 0.005 : 0);
      const len = b - a;
      if (len < 0.05) continue;
      const tone = woods[Math.floor(Rr() * woods.length)], k = (Rr() - 0.5) * 0.08, l0 = (Rr() - 0.5) * 0.04;
      const c = new THREE.Color();
      add(slab(len, DECK - 0.005, zb - za - 0.012), { color: (p) => c.copy(tone).offsetHSL(0, 0, l0 + (p.x / len) * k), x: (a + b) / 2, y: 0.005, z: (za + zb) / 2, ao: false });
    }
  };
  const strip = (za, zb, runs, seed) => {
    const n = Math.max(1, Math.round((zb - za) / 0.165));
    for (let i = 0; i < n; i++) {
      const z0 = za + ((zb - za) * i) / n, z1 = za + ((zb - za) * (i + 1)) / n;
      for (const [xa, xb] of runs) row(xa, xb, z0, z1, seed + i * 7 + Math.round(xa * 3));
    }
  };
  strip(Dk.z0, oz0, [[Dk.x0, Dk.x1]], 100);
  strip(oz1, Dk.z1, [[Dk.x0, Dk.x1]], 200);
  strip(oz0, oz1, [[Dk.x0, ox0], [ox1, Dk.x1]], 300);
  // arremate da beirada (por dentro do deque: os caminhos de lajota começam na linha dele)
  const trim = '#7a5232';
  add(slab(Dk.x1 - Dk.x0, DECK + 0.004, 0.045), { color: trim, x: (Dk.x0 + Dk.x1) / 2, z: Dk.z0 + 0.0225, ao: false });
  add(slab(Dk.x1 - Dk.x0, DECK + 0.004, 0.045), { color: trim, x: (Dk.x0 + Dk.x1) / 2, z: Dk.z1 - 0.0225, ao: false });
  add(slab(0.045, DECK + 0.004, Dk.z1 - Dk.z0 - 0.09), { color: trim, x: Dk.x0 + 0.0225, z: (Dk.z0 + Dk.z1) / 2, ao: false });
  add(slab(0.045, DECK + 0.004, Dk.z1 - Dk.z0 - 0.09), { color: trim, x: Dk.x1 - 0.0225, z: (Dk.z0 + Dk.z1) / 2, ao: false });

  // ---------- a borda atérmica (pedras creme, rejunte fininho) e o boleado por cima da água
  const stone = ['#efe7d8', '#e9e0cf', '#f3ecdf', '#e4dac8'].map((c) => new THREE.Color(c));
  const copeStone = (x0, z0, x1, z1) => {
    const c = stone[Math.floor(R() * stone.length)].clone().offsetHSL(0, 0, (R() - 0.5) * 0.02);
    add(slab(x1 - x0 - 0.006, COPE - 0.0085, z1 - z0 - 0.006), { color: () => c, x: (x0 + x1) / 2, y: 0.0085, z: (z0 + z1) / 2, ao: false });
  };
  const run = (a, b, n, fn) => { for (let i = 0; i < n; i++) fn(a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n); };
  const nxs = Math.round(W / 0.51), nzs = Math.round(H / 0.51);
  for (const [za, zb] of [[oz0, P.z0], [P.z1, oz1]]) {
    copeStone(ox0, za, P.x0, zb);
    copeStone(P.x1, za, ox1, zb);
    run(P.x0, P.x1, nxs, (a, b) => copeStone(a, za, b, zb));
  }
  for (const [xa, xb] of [[ox0, P.x0], [P.x1, ox1]]) run(P.z0, P.z1, nzs, (a, b) => copeStone(xa, a, xb, b));
  const lip = '#f6f0e4';
  const nose = (len) => new THREE.CylinderGeometry(0.024, 0.024, len, 8);
  add(nose(W).rotateZ(Math.PI / 2), { color: lip, x: cx, y: COPE - 0.026, z: P.z0 + 0.012, ao: false });
  add(nose(W).rotateZ(Math.PI / 2), { color: lip, x: cx, y: COPE - 0.026, z: P.z1 - 0.012, ao: false });
  add(nose(H).rotateX(Math.PI / 2), { color: lip, x: P.x0 + 0.012, y: COPE - 0.026, z: cz, ao: false });
  add(nose(H).rotateX(Math.PI / 2), { color: lip, x: P.x1 - 0.012, y: COPE - 0.026, z: cz, ao: false });

  // ---------- por dentro: paredes de pastilha (o barrado na linha d'água: uma fileira escura e uma de desenho), o
  // fundo em degradê (claro no raso, a oeste; azul no fundo, a leste) e a patinha de mosaico
  const TS = 0.1;
  const aqua = ['#a6e2ec', '#98d9e6', '#b2e8f0', '#8fd2e0'].map((c) => new THREE.Color(c));
  const band = ['#1f6fa3', '#2a7fb4', '#185f90'].map((c) => new THREE.Color(c));
  const pearl = new THREE.Color('#f4f8fa'), gold = new THREE.Color('#f2c94c');
  const rowsV = Math.max(1, Math.round(D / TS));
  const wallTile = (seed) => {
    const out = new THREE.Color();
    return (p) => {
      const i = Math.floor((p.x + 50) / TS), j = Math.floor((D / 2 - p.y) / TS + 1e-6), h = hash(i, j, seed);
      if (j === 0) return out.copy(band[Math.floor(h * band.length)]);
      if (j === 1) return out.copy(i % 4 === 0 ? gold : i % 2 ? pearl : band[1]);
      return out.copy(aqua[Math.floor(h * aqua.length)]).multiplyScalar(1 - (j / rowsV) * 0.3);
    };
  };
  add(tilesV(W, D, TS, TS, wallTile(1)), { color: null, slot: 'ground', x: cx, y: -D / 2, z: P.z0, ao: false });
  add(tilesV(W, D, TS, TS, wallTile(2)), { color: null, slot: 'ground', x: cx, y: -D / 2, z: P.z1, ry: Math.PI, ao: false });
  add(tilesV(H, D, TS, TS, wallTile(3)), { color: null, slot: 'ground', x: P.x0, y: -D / 2, z: cz, ry: Math.PI / 2, ao: false });
  add(tilesV(H, D, TS, TS, wallTile(4)), { color: null, slot: 'ground', x: P.x1, y: -D / 2, z: cz, ry: -Math.PI / 2, ao: false });
  const fl0 = new THREE.Color('#a8e6ef'), fl1 = new THREE.Color('#3f9bd0'), floorOut = new THREE.Color();
  add(tiles(W, H, 0.2, 0.2, (p) => {
    const edge = Math.min(W / 2 - Math.abs(p.x), H / 2 - Math.abs(p.z));
    const h = hash(Math.floor((p.x + 50) / 0.2), Math.floor((p.z + 50) / 0.2), 9);
    return floorOut.copy(fl0).lerp(fl1, smooth((p.x + W / 2) / W)).offsetHSL(0, 0, (h - 0.5) * 0.045).multiplyScalar(edge < 0.2 ? 0.86 : 1);
  }), { color: null, slot: 'ground', x: cx, y: -D, z: cz, ao: false });
  // a patinha de mosaico (o Recanto das Patinhas): pastilhas de 10 cm, os dedos para o norte
  const PAW = [
    '...XX....XX...',
    '..XXXX..XXXX..',
    '..XXXX..XXXX..',
    'XX.XX....XX.XX',
    'XXX........XXX',
    'XXX..XXXX..XXX',
    '.X..XXXXXX..X.',
    '...XXXXXXXX...',
    '..XXXOOOOXXX..',
    '..XXOOOOOOXX..',
    '..XXXOOOOXXX..',
    '...XXX..XXX...',
  ];
  /** @type {Record<string, string>} */
  const PC = { X: '#f7f3e6', O: '#f2c94c' };
  const mx = cx - (PAW[0].length * TS) / 2, mz = cz - (PAW.length * TS) / 2;
  const paw = [];
  PAW.forEach((line, j) => [...line].forEach((ch, i) => {
    if (PC[ch]) paw.push([mx + i * TS + 0.004, mz + j * TS + 0.004, mx + (i + 1) * TS - 0.004, mz + (j + 1) * TS - 0.004, PC[ch]]);
  }));
  add(flatQuads(paw), { color: null, slot: 'ground', y: -D + 0.003, ao: false });
  // o ralo de fundo (no lado fundo, a leste), os refletores ainda acesos, os retornos e o skimmer na parede norte
  add(grate(0.3, 4, '#d9dde0', '#26405a'), { color: null, slot: 'ground', x: P.x1 - 1.4, y: -D + 0.003, z: cz, ao: false });
  for (const k of [0.18, 0.5, 0.82]) {
    const lx = P.x0 + W * k;
    add(new THREE.TorusGeometry(0.085, 0.014, 6, 16), { color: '#e9edf0', x: lx, y: -0.48, z: P.z0 + 0.008, ao: false });
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.014, 16).rotateX(Math.PI / 2), { color: '#fff4d6', slot: 'lit', x: lx, y: -0.48, z: P.z0 + 0.008, ao: false });
  }
  for (const [x, y, z, ry] of [[cx + 1.6, -0.34, P.z0, 0], [P.x0, -0.34, cz - 1.1, Math.PI / 2], [P.x0, -0.34, cz + 1.1, Math.PI / 2]]) {
    const c = Math.cos(ry), s = Math.sin(ry);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 10).rotateX(Math.PI / 2), { color: '#f1f3f4', x: x + s * 0.006, y, z: z + c * 0.006, ry, ao: false });
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8).rotateX(Math.PI / 2), { color: '#3a3f44', x: x + s * 0.01, y, z: z + c * 0.01, ry, ao: false });
  }
  const skx = F.x + 0.75, skz = P.z0 - CW / 2;
  add(rb(0.28, 0.14, 0.006, 0.004, 1), { color: '#f4f5f6', x: skx, y: -0.15, z: P.z0 + 0.003, ao: false });
  add(slab(0.24, 0.1, 0.006), { color: '#1f2a33', x: skx, y: -0.13, z: P.z0 + 0.007, ao: false });
  // a tampa do skimmer tirada (de lado, na borda) e a mangueira do aspirador entrando nele, vinda do filtro
  add(new THREE.CircleGeometry(0.085, 16).rotateX(-Math.PI / 2), { color: '#1c2228', slot: 'ground', x: skx, y: COPE + 0.003, z: skz, ao: false });
  add(cyl(0.1, 0.1, 0.004, 16), { color: '#e6e8e9', x: skx + 0.3, y: COPE, z: skz + 0.02, ao: false });
  const hoseCurve = new THREE.CatmullRomCurve3([
    V(F.x + 0.31, 0.058, F.z + 0.12), V(F.x + 0.42, DECK + 0.024, F.z + 0.22), V(F.x + 0.52, DECK + 0.024, F.z + 0.62),
    V(F.x + 0.6, DECK + 0.026, skz - 0.38), V(skx - 0.04, COPE + 0.024, skz - 0.12), V(skx, COPE - 0.004, skz),
  ]);
  const hoseLight = new THREE.Color('#8fcbe6'), hoseDark = new THREE.Color('#6fb3d6');
  add(faceColors(new THREE.TubeGeometry(hoseCurve, 26, 0.022, 6, false), (p) => (Math.floor((p.x + p.z) * 45) % 2 ? hoseLight : hoseDark)), { color: null, ao: false });

  // ---------- a água: clara e transparente no raso, azul e mais fechada no fundo, a beirada esbranquiçada; as
  // ondinhas andam, e o brilho do sol dança no fundo e na superfície (duas camadas somadas, sem profundidade)
  const waterM = mat('recanto-agua-da-piscina-3p', () => {
    const nm = waterMat().normalMap.clone();
    nm.repeat.set(5, 2.5);
    nm.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.05, metalness: 0.12, transparent: true, depthWrite: false, envMapIntensity: 1.5,
      normalMap: nm, normalScale: new THREE.Vector2(0.28, 0.28),
    });
  });
  const wgeo = new THREE.PlaneGeometry(W, H, 34, 17).rotateX(-Math.PI / 2);
  {
    const pos = wgeo.attributes.position;
    const col = new Float32Array(pos.count * 4);
    const shallow = new THREE.Color('#86e0ee'), deep = new THREE.Color('#1c7cc4'), foam = new THREE.Color('#e4f8fc'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const edge = Math.min(W / 2 - Math.abs(x), H / 2 - Math.abs(z));
      const k = smooth((x + W / 2) / W) * (0.4 + 0.6 * clamp01(edge / 0.9));
      c.copy(shallow).lerp(deep, k);
      let a = 0.5 + 0.36 * k;
      if (edge < 0.01) { c.lerp(foam, 0.75); a = 0.72; }
      col.set([c.r, c.g, c.b, a], i * 4);
    }
    wgeo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  }
  const water = new THREE.Mesh(wgeo, waterM);
  water.name = 'recanto:agua-da-piscina';
  water.position.set(cx, WATER, cz);
  water.receiveShadow = true;
  water.renderOrder = 2;
  keep(water);
  const glow = (name, y, opacity, rx, rz, order) => {
    const tex = causticTexture().clone();
    tex.repeat.set(rx, rz);
    tex.needsUpdate = true;
    const m = new THREE.MeshBasicMaterial({ map: tex, color: '#cff4ff', transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.02, H - 0.02).rotateX(-Math.PI / 2), m);
    o.name = name;
    o.position.set(cx, y, cz);
    o.renderOrder = order;
    keep(o);
    return { tex, m };
  };
  const glowFloor = glow('recanto:piscina:brilho-do-fundo', -D + 0.012, 0.3, 5, 2.5, 1);
  const glowTop = glow('recanto:piscina:brilho-da-agua', WATER + 0.004, 0.1, 3, 1.5, 3);
  anim.push((dt, t) => {
    waterM.normalMap.offset.x += dt * 0.012;
    waterM.normalMap.offset.y += dt * 0.007;
    glowFloor.tex.offset.set(t * 0.021, Math.sin(t * 0.23) * 0.06);
    glowTop.tex.offset.set(-t * 0.013, t * 0.009);
    glowFloor.m.opacity = 0.26 + 0.06 * Math.sin(t * 0.9);
  });

  // ---------- a escada de inox (dentro da caixa da água; o corrimão sobe até 0,8 m e mergulha) e os degraus
  const lx = P.x1 - 1.9;
  const railPts = [[0.025, COPE], [0.025, 0.6], [0.055, 0.76], [0.13, 0.8], [0.2, 0.73], [0.215, 0.55], [0.215, -0.1], [0.215, -0.55], [0.17, -0.68], [0.04, -0.72]].map(([dz, y]) => V(0, y, P.z0 + dz));
  const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts, false, 'catmullrom', 0.25), 30, 0.019, 8, false);
  for (const s of [-0.25, 0.25]) {
    add(railGeo, { color: CHROME, slot: 'glass', x: lx + s, ao: false });
    add(cyl(0.034, 0.034, 0.004, 12), { color: CHROME, slot: 'glass', x: lx + s, y: COPE, z: P.z0 + 0.025, ao: false });
  }
  for (const y of [-0.12, -0.36, -0.6]) add(rb(0.5, 0.025, 0.11, 0.008, 1), { color: '#eef1f3', x: lx, y, z: P.z0 + 0.155, ao: false });
  // o orvalho escorre do corrimão e pinga na água (a ondinha)
  drips.push({ x: lx + 0.25, z: P.z0 + 0.2, y0: 0.7, y1: WATER, period: 2.6, phase: 0.3, ripple: true });

  // ---------- as espreguiçadeiras: quadro de alumínio branco, ripas de madeira, rodinhas na cabeceira e a almofada.
  // O estrado fica a 0,47 m: embaixo dele a Radhija (0,48 m de cabeça) passa; o colisor barra só a irmã.
  const frame = '#f3f0e8', slats = ['#b98451', '#a8733f', '#c48f5a', '#ad7745'];
  // o chão embaixo de um ponto: as tábuas no deque, a grama fora dele
  const floorAt = (p) => (p.x >= Dk.x0 && p.x <= Dk.x1 && p.z >= Dk.z0 && p.z <= Dk.z1 ? DECK : 0);
  const lounger = (lg, idx, cushion) => {
    const c = Math.cos(lg.yaw), s = Math.sin(lg.yaw);
    const at = (lx2, lz) => ({ x: lg.x + lx2 * c + lz * s, z: lg.z - lx2 * s + lz * c });
    const ry = lg.yaw, hx = lg.hx - 0.04, hz = lg.hz - 0.09, BED = 0.47, top = BED + 0.045, hinge = -0.2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const foot = at(sx * hx, sz * hz), fy = floorAt(foot);
        add(cyl(0.018, 0.02, BED - fy, 8), { color: frame, ...foot, y: fy });
        if (sz < 0) add(new THREE.CylinderGeometry(0.045, 0.045, 0.024, 12).rotateZ(Math.PI / 2), { color: '#5d6368', ...at(sx * (hx + 0.022), sz * hz), y: fy + 0.045, ry, ao: false });
      }
      add(rb(0.045, 0.045, hz * 2 + 0.12, 0.012, 1), { color: frame, ...at(sx * hx, 0), y: BED, ry });
    }
    for (const sz of [-1, 1]) add(slab(hx * 2, 0.035, 0.035), { color: frame, ...at(0, sz * hz), y: BED + 0.005, ry, ao: false });
    for (let k = 0; k < 10; k++) {
      const lz = hinge + 0.06 + k * 0.105;
      if (lz > hz + 0.06) break;
      add(slab(hx * 2 - 0.02, 0.022, 0.085), { color: slats[(k + idx) % slats.length], ...at(0, lz), y: top, ry, ao: false });
    }
    // o encosto, levantado (dobra em `hinge` e sobe para a cabeceira), e as duas escoras
    const tilt = 0.62, back = 0.74;
    for (const sx of [-1, 1]) add(rb(0.04, 0.04, back, 0.012, 1).translate(0, 0, -back / 2).rotateX(tilt), { color: frame, ...at(sx * hx, hinge), y: top, ry, ao: false });
    add(slab(hx * 2, 0.035, 0.035).translate(0, 0, -back).rotateX(tilt), { color: frame, ...at(0, hinge), y: top, ry, ao: false });
    for (let k = 0; k < 7; k++) add(slab(hx * 2 - 0.02, 0.022, 0.085).translate(0, 0.04, -(0.07 + k * 0.1)).rotateX(tilt), { color: slats[(k + 2 + idx) % slats.length], ...at(0, hinge), y: top, ry, ao: false });
    for (const sx of [-1, 1]) {
      const d = 0.38, ty = top + Math.sin(tilt) * d;
      add(slab(0.03, ty - BED, 0.03), { color: frame, ...at(sx * (hx - 0.03), hinge - Math.cos(tilt) * d), y: BED, ry, ao: false });
    }
    // a almofada: o assento, o encosto e o rolinho da cabeça
    const s0 = hinge + 0.03, s1 = hz + 0.05;
    add(rb(hx * 2 - 0.05, 0.06, s1 - s0, 0.026, 2), { color: cushion, ...at(0, (s0 + s1) / 2), y: top + 0.025, ry, ao: false });
    add(rb(hx * 2 - 0.05, 0.06, back - 0.06, 0.026, 2).translate(0, 0.066, -back / 2 - 0.01).rotateX(tilt), { color: cushion, ...at(0, hinge), y: top, ry, ao: false });
    add(rb(0.36, 0.085, 0.18, 0.04, 2).translate(0, 0.128, -(back - 0.15)).rotateX(tilt), { color: '#fff4de', ...at(0, hinge), y: top, ry, ao: false });
    return { at, top: top + 0.085, ry };
  };
  const L1 = lounger(L.LOUNGERS[0], 0, speckle('#3fa8a8', 0.03, 51));
  const L2 = lounger(L.LOUNGERS[1], 1, speckle('#ef8b6e', 0.03, 52));
  // a toalha dobrada nos pés da do sul, o livro aberto virado para baixo e os óculos na do norte
  for (let k = 0; k < 3; k++) add(rb(0.36, 0.02, 0.26, 0.008, 1), { color: k % 2 ? '#fff4e2' : '#f2c230', ...L1.at(0, 0.62), y: L1.top + 0.002 + k * 0.02, ry: L1.ry + 0.08, ao: false });
  for (const sx of [-1, 1]) add(slab(0.11, 0.008, 0.16).rotateZ(sx * 0.32), { color: '#c2483a', ...L2.at(0.04 + sx * 0.05, 0.3), y: L2.top + 0.012, ry: L2.ry + 0.3, ao: false });
  // os chinelos esquecidos no deque (amarelo e verde, como os de sempre), ao lado da espreguiçadeira do sul
  const lg0 = L.LOUNGERS[0];
  for (const [dx, dz, ry] of [[-0.74, 0.5, 0.3], [-0.58, 0.62, -0.2]]) {
    const x = lg0.x + dx, z = lg0.z + dz;
    add(rb(0.095, 0.014, 0.24, 0.035, 1), { color: '#ffd23f', x, y: DECK, z, ry, ao: false });
    const c = Math.cos(ry), s = Math.sin(ry);
    const toe = V(x + s * 0.07, DECK + 0.016, z + c * 0.07);
    for (const sx of [-1, 1]) add(stick(toe, V(x + sx * 0.045 * c - s * 0.01, DECK + 0.016, z - sx * 0.045 * s - c * 0.01), 0.007, 4), { color: '#2f9a52', ao: false });
  }

  // ---------- o guarda-sol aberto: base baixa de granito (fora do colisor só o que é chato), haste, manivela, as
  // varetas por baixo da copa listrada (da altura da câmera é o que se vê) e o orvalho pingando
  add(cyl(0.23, 0.25, 0.05, 18), { color: speckle('#8c8a86', 0.05, 2), x: U.x, y: DECK, z: U.z });
  add(cyl(0.05, 0.065, 0.13, 12), { color: '#6f6d69', x: U.x, y: DECK + 0.05, z: U.z });
  add(cyl(0.022, 0.022, 2.55, 8), { color: '#f4f1ea', x: U.x, y: DECK + 0.1, z: U.z });
  add(cyl(0.036, 0.036, 0.08, 10), { color: '#d9d4c8', x: U.x, y: 1.45, z: U.z, ao: false });
  add(rb(0.12, 0.018, 0.018, 0.006, 1), { color: '#d9d4c8', x: U.x + 0.06, y: 1.48, z: U.z, ao: false });
  add(cyl(0.045, 0.035, 0.07, 10), { color: '#f4f1ea', x: U.x, y: 2.02, z: U.z, ao: false });
  const UR = 1.45, rim = 2.25, apex = 2.66;
  add(canopyGeo({ r: UR, apex, rim }), { color: null, x: U.x, z: U.z, ao: false });
  add(new THREE.SphereGeometry(0.035, 10, 8), { color: '#f4f1ea', x: U.x, y: apex + 0.03, z: U.z, ao: false });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU, ux = Math.cos(a), uz = Math.sin(a);
    add(stick(V(U.x, apex - 0.03, U.z), V(U.x + ux * (UR - 0.01), rim - 0.012, U.z + uz * (UR - 0.01)), 0.008, 4), { color: '#e6e1d6', ao: false });
    add(stick(V(U.x + ux * 0.04, 2.06, U.z + uz * 0.04), V(U.x + ux * UR * 0.52, apex - 0.03 + (rim - apex) * 0.52 - 0.01, U.z + uz * UR * 0.52), 0.006, 4), { color: '#d9d4c8', ao: false });
  }
  // as gotas do orvalho caem da ponta de dois gomos, no deque (a tábua fica molhada embaixo)
  const gomo = (k) => { const a = ((k + 0.5) / 8) * TAU; return { x: U.x + Math.cos(a) * UR * 0.965, z: U.z + Math.sin(a) * UR * 0.965 }; };
  [gomo(4), gomo(2)].forEach((gd, i) => {
    drips.push({ x: gd.x, z: gd.z, y0: rim - 0.1, y1: DECK + 0.004, period: 2.9 + i * 0.6, phase: 1.6 * i + 0.4, ripple: false });
    add(blob(0.08, 4 + i), { color: '#5e3f28', slot: 'glass', x: gd.x, y: DECK + 0.0035, z: gd.z, ao: false });
  });

  // ---------- o filtro de areia com a bomba (dentro da caixa do colisor 'filtro-piscina')
  add(rb(F.hx * 2 - 0.02, 0.04, F.hz * 2 - 0.02, 0.012, 1), { color: speckle('#bdb6aa', 0.04, 7), x: F.x, y: 0.005, z: F.z });
  const fx = F.x - 0.14, fz = F.z - 0.04;
  add(cyl(0.16, 0.17, 0.04, 16), { color: '#2f5884', x: fx, y: 0.045, z: fz });
  add(cyl(0.15, 0.15, 0.32, 16), { color: '#3c6e9e', x: fx, y: 0.085, z: fz });
  add(new THREE.SphereGeometry(0.15, 16, 6, 0, TAU, 0, Math.PI / 2), { color: '#3c6e9e', x: fx, y: 0.405, z: fz, ao: false });
  add(cyl(0.065, 0.07, 0.07, 12), { color: '#9aa1a6', x: fx, y: 0.52, z: fz, ao: false });
  add(rb(0.17, 0.022, 0.035, 0.008, 1), { color: '#2b2b30', x: fx, y: 0.59, z: fz, ry: 0.5, ao: false });
  add(new THREE.CylinderGeometry(0.024, 0.024, 0.014, 12).rotateX(Math.PI / 2), { color: '#f2f2f0', x: fx, y: 0.555, z: fz + 0.072, ao: false });
  const pz = F.z + 0.1;
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.075, 12).rotateZ(Math.PI / 2), { color: '#2b2b30', x: F.x + 0.08, y: 0.13, z: pz, ao: false });
  add(new THREE.CylinderGeometry(0.072, 0.072, 0.17, 14).rotateZ(Math.PI / 2), { color: '#dcd9d2', x: F.x + 0.2, y: 0.13, z: pz, ao: false });
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 14).rotateZ(Math.PI / 2), { color: '#9aa1a6', x: F.x + 0.295, y: 0.13, z: pz, ao: false });
  add(cyl(0.05, 0.055, 0.11, 12), { color: '#2b2b30', x: F.x + 0.08, y: 0.045, z: F.z - 0.12, ao: false });
  add(cyl(0.052, 0.052, 0.03, 12), { color: '#bfe3f0', slot: 'glass', x: F.x + 0.08, y: 0.155, z: F.z - 0.12, ao: false });
  const pvc = '#f1efe9';
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(F.x + 0.08, 0.2, pz), V(F.x + 0.06, 0.42, pz - 0.02), V(fx + 0.05, 0.555, fz + 0.03), V(fx + 0.02, 0.555, fz)]), 10, 0.02, 8), { color: pvc, ao: false });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(fx - 0.04, 0.545, fz), V(fx - 0.12, 0.47, fz - 0.06), V(fx - 0.13, 0.2, fz - 0.12), V(fx - 0.13, 0.05, fz - 0.14)]), 10, 0.02, 8), { color: pvc, ao: false });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(F.x + 0.08, 0.09, F.z - 0.17), V(F.x + 0.1, 0.05, F.z - 0.2), V(F.x + 0.16, 0.046, F.z - 0.205)]), 6, 0.02, 8), { color: pvc, ao: false });

  // ---------- a ducha de inox (dentro do colisor 'ducha'), o estrado de ripas e a poça embaixo do chuveiro
  add(cyl(0.05, 0.06, 0.02, 12), { color: CHROME, slot: 'glass', x: Sh.x, y: DECK, z: Sh.z, ao: false });
  add(cyl(0.035, 0.035, 2.06, 12), { color: CHROME, slot: 'glass', x: Sh.x, y: DECK + 0.02, z: Sh.z });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 2.07, 0), V(0, 2.17, 0.04), V(0, 2.19, 0.16), V(0, 2.17, 0.3)]), 10, 0.022, 8), { color: CHROME, slot: 'glass', x: Sh.x, z: Sh.z, ao: false });
  add(cyl(0.05, 0.09, 0.035, 16), { color: CHROME, slot: 'glass', x: Sh.x, y: 2.12, z: Sh.z + 0.3, ao: false });
  add(rb(0.05, 0.05, 0.03, 0.012, 1), { color: '#2b2b30', x: Sh.x, y: 1.08, z: Sh.z + 0.045, ao: false });
  add(new THREE.TorusGeometry(0.03, 0.006, 5, 12), { color: '#d63a32', x: Sh.x, y: 1.105, z: Sh.z + 0.062, ao: false });
  add(blob(0.36, 21), { color: '#5e3f28', slot: 'glass', x: Sh.x + 0.04, y: DECK + 0.0035, z: Sh.z + 0.34, sz: 0.8, ao: false });
  for (let k = 0; k < 6; k++) add(rb(0.56, 0.022, 0.07, 0.008, 1), { color: slats[k % slats.length], x: Sh.x, y: DECK + 0.006, z: Sh.z + 0.1 + k * 0.085, ao: false });
  for (const sx of [-0.22, 0.22]) add(slab(0.04, 0.012, 0.5), { color: '#7a5232', x: Sh.x + sx, y: DECK - 0.004, z: Sh.z + 0.31, ao: false });
  drips.push({ x: Sh.x, z: Sh.z + 0.3, y0: 2.12, y1: DECK + 0.03, period: 3.7, phase: 2.2, ripple: false });
  // a toalha de banho largada no deque, perto da ducha
  add(rb(0.62, 0.02, 0.4, 0.008, 1), { color: speckle('#f28ca2', 0.04, 61), x: Sh.x - 0.75, y: DECK, z: Sh.z + 0.55, ry: 0.35, ao: false });
  add(rb(0.3, 0.018, 0.38, 0.008, 1), { color: '#fff4e2', x: Sh.x - 0.66, y: DECK + 0.02, z: Sh.z + 0.6, ry: 0.5, ao: false });

  // ---------- a peneira de folhas largada no deque (cabo comprido) e as folhas dentro dela
  const nz0 = oz0 - 0.55;
  add(stick(V(cx - 1.9, DECK + 0.016, nz0), V(cx + 0.9, DECK + 0.016, nz0 - 0.12), 0.015, 8), { color: '#c9ced3', ao: false });
  add(new THREE.TorusGeometry(0.17, 0.009, 4, 18).rotateX(Math.PI / 2), { color: '#2f8a6a', x: cx + 1.08, y: DECK + 0.01, z: nz0 - 0.13, ao: false });
  add(new THREE.CircleGeometry(0.165, 16).rotateX(-Math.PI / 2), { color: '#3f5a52', slot: 'ground', x: cx + 1.08, y: DECK + 0.007, z: nz0 - 0.13, ao: false });

  // ---------- os vasos do deque (cada um dentro do colisor 'vaso-piscina-N'): o grande vitrificado com a palmeirinha
  // e o de barro florido, ao lado do guarda-sol
  const pots = L.POOL_POTS;
  potAt(add, { x: pots[0].x, z: pots[0].z, y: DECK, r: pots[0].r - 0.03, h: 0.4, color: '#2f7f86', slot: 'glass', plant: palm({ h: 0.95, fronds: 8, seed: 5 }) });
  potAt(add, { x: pots[1].x, z: pots[1].z, y: DECK, r: pots[1].r - 0.05, h: 0.3, color: '#c46a43', plant: flowerBush({ r: 0.16, seed: 21, flower: '#ff6a55', n: 6 }), plantSlot: 'foliage' });

  // ---------- os brinquedos que ficaram (a boia de patinho, não: essa o pombo levou): a prancha e o espaguete,
  // deitados no deque do sul
  const sz0 = oz1 + 0.75;
  add(rb(0.3, 0.032, 0.45, 0.06, 1), { color: '#f08a3c', x: cx + 1.6, y: DECK, z: sz0, ry: 0.42, ao: false });
  add(rb(0.2, 0.01, 0.28, 0.05, 1), { color: '#3a8fd1', x: cx + 1.6, y: DECK + 0.032, z: sz0, ry: 0.42, ao: false });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(cx - 1.2, DECK + 0.03, sz0 - 0.2), V(cx - 0.6, DECK + 0.03, sz0 + 0.12), V(cx + 0.1, DECK + 0.03, sz0 + 0.02)]), 16, 0.03, 8), { color: '#ff7fae', ao: false });

  // ---------- a marca molhada da boia de patinho (o anel, a cabeça e o bico), gotas em volta e o rastro para o norte
  const wet = '#4a3221', mx0 = Rc.x - 0.06, mz0 = Rc.z;
  add(ringBlob(0.15, 0.33, 3), { color: wet, slot: 'glass', x: mx0, y: DECK + 0.0035, z: mz0, ao: false });
  add(blob(0.11, 5), { color: wet, slot: 'glass', x: mx0 + 0.03, y: DECK + 0.0035, z: mz0 - 0.42, ao: false });
  add(blob(0.045, 7), { color: wet, slot: 'glass', x: mx0 + 0.13, y: DECK + 0.0035, z: mz0 - 0.46, ao: false });
  const dropG = new THREE.SphereGeometry(0.012, 7, 4, 0, TAU, 0, Math.PI / 2);
  const Rd = rng(13);
  for (let i = 0; i < 12; i++) {
    const a = Rd() * TAU, d = 0.38 + Rd() * 0.16;
    add(dropG, { color: '#dcecf2', slot: 'glass', x: mx0 + Math.cos(a) * d, y: DECK, z: mz0 + Math.sin(a) * d, sx: 0.7 + Rd() * 0.6, sz: 0.7 + Rd() * 0.6, sy: 0.45, ao: false });
  }
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    add(dropG, { color: '#dcecf2', slot: 'glass', x: mx0 + 0.05 + t * 0.22 + (Rd() - 0.5) * 0.05, y: DECK, z: mz0 - 0.62 - t * 1.3, sx: 1 - t * 0.5, sz: 1 - t * 0.5, sy: 0.45, ao: false });
  }

  // ---------- as poças da chuva no deque (a madeira escura e brilhante), longe da marca da boia
  for (const [x, z, r, sd] of [[lx + 0.1, oz0 - 0.3, 0.22, 2], [cx - 2.2, oz1 + 0.55, 0.28, 3], [ox1 + 0.5, cz + 1.3, 0.2, 5], [cx + 3.4, oz1 + 1.2, 0.24, 8], [ox0 - 1.2, P.z0 + 0.4, 0.22, 9], [cx - 1.0, oz0 - 1.45, 0.3, 11]]) {
    add(blob(r, sd), { color: '#5e3f28', slot: 'glass', x, y: DECK + 0.0035, z, sz: 0.7, ry: sd, ao: false });
  }

  // ---------- o que a tempestade deixou no deque: um galho, folhas e flores de ipê caídas
  const twig = (len, r) => new THREE.CylinderGeometry(r * 0.7, r, len, 5).rotateZ(Math.PI / 2);
  const tgx = Dk.x0 + 0.85, tgz = Dk.z0 + 1.0;
  add(twig(0.55, 0.017), { color: '#6b4a2e', x: tgx, y: DECK + 0.017, z: tgz, ry: 0.45, ao: false });
  add(twig(0.24, 0.01), { color: '#6b4a2e', x: tgx + 0.12, y: DECK + 0.011, z: tgz + 0.14, ry: -0.5, ao: false });
  const leafG = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.05);
    s.quadraticCurveTo(0.032, -0.012, 0, 0.05);
    s.quadraticCurveTo(-0.032, -0.012, 0, -0.05);
    return new THREE.ShapeGeometry(s, 3).rotateX(-Math.PI / 2);
  })();
  const flowerG = starGeo(5, 0.034, 0.015);
  const leafCols = ['#6f9a3a', '#b8a24a', '#7da040', '#9a6a3a'];
  const Ri = rng(29);
  const onDeck = (x, z) => !(x > ox0 - 0.05 && x < ox1 + 0.05 && z > oz0 - 0.05 && z < oz1 + 0.05) && Math.hypot(x - mx0, z - mz0) > 0.85;
  for (let i = 0; i < 26; i++) {
    const x = Dk.x0 + 0.15 + Ri() * (Dk.x1 - Dk.x0 - 0.3), z = Dk.z0 + 0.15 + Ri() * (Dk.z1 - Dk.z0 - 0.3), ry = Ri() * TAU;
    if (!onDeck(x, z)) continue;
    add(leafG, { color: leafCols[i % leafCols.length], slot: 'ground', x, y: DECK + 0.0065 + (i % 4) * 0.0007, z, ry, ao: false });
  }
  for (let i = 0; i < 22; i++) {
    const x = Dk.x0 + 0.1 + Ri() * 1.9, z = Dk.z0 + 0.2 + Ri() * (Dk.z1 - Dk.z0 - 0.4), ry = Ri() * TAU;
    if (!onDeck(x, z)) continue;
    add(flowerG, { color: Ri() < 0.5 ? '#ffd23f' : '#f2c12e', slot: 'ground', x, y: DECK + 0.0105 + (i % 4) * 0.0007, z, ry, ao: false });
  }
  // um graveto boiando
  add(twig(0.3, 0.012), { color: '#5d4029', x: cx - 1.4, y: WATER + 0.006, z: cz + 1.6, ry: 0.9, ao: false });

  // ---------- a mesinha de apoio (só com o colisor do layout: POOL_TABLE): a jarra, os copos e a toalhinha
  const TB = L.POOL_TABLE;
  if (TB) {
    const tr = TB.r - 0.015;
    add(cyl(tr * 0.7, tr * 0.75, 0.02, 16), { color: '#f3f0e8', x: TB.x, y: DECK, z: TB.z, ao: false });
    add(cyl(0.02, 0.02, 0.48, 8), { color: '#f3f0e8', x: TB.x, y: DECK + 0.02, z: TB.z });
    add(cyl(tr, tr, 0.028, 20), { color: speckle('#b98451', 0.05, 71), x: TB.x, y: 0.5, z: TB.z, ao: false });
    add(cyl(0.05, 0.045, 0.17, 12), { color: '#bfe3f0', slot: 'glass', x: TB.x - 0.05, y: 0.528, z: TB.z - 0.04, ao: false });
    add(cyl(0.044, 0.04, 0.1, 12), { color: '#f2a03d', x: TB.x - 0.05, y: 0.531, z: TB.z - 0.04, ao: false });
    for (const [dx, dz] of [[0.08, 0.05], [0.03, 0.11]]) add(cyl(0.028, 0.024, 0.09, 10), { color: '#d7eef6', slot: 'glass', x: TB.x + dx, y: 0.528, z: TB.z + dz, ao: false });
    add(rb(0.14, 0.022, 0.1, 0.008, 1), { color: '#fff4e2', x: TB.x + 0.06, y: 0.528, z: TB.z - 0.09, ry: 0.4, ao: false });
  }

  // ---------- o baú das boias (só com o colisor do layout: POOL_TOYBOX): caixote de ripas com os espaguetes em pé, as
  // pranchas e a bola (a boia de patinho era daqui: a marca molhada fica bem ao lado)
  const BX = L.POOL_TOYBOX;
  if (BX) {
    const bw = BX.hx * 2 - 0.03, bd = BX.hz * 2 - 0.03, bh = 0.46;
    const woodB = speckle('#b98451', 0.06, 81);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(rb(0.05, bh, 0.05, 0.01, 1), { color: '#8a5a36', x: BX.x + sx * (bw / 2 - 0.025), y: DECK, z: BX.z + sz * (bd / 2 - 0.025) });
    for (let k = 0; k < 3; k++) {
      const y = DECK + 0.05 + k * 0.14;
      for (const sz of [-1, 1]) add(rb(bw - 0.02, 0.11, 0.018, 0.006, 1), { color: woodB, x: BX.x, y, z: BX.z + sz * (bd / 2 - 0.012), ao: false });
      for (const sx of [-1, 1]) add(rb(0.018, 0.11, bd - 0.02, 0.006, 1), { color: woodB, x: BX.x + sx * (bw / 2 - 0.012), y, z: BX.z, ao: false });
    }
    add(slab(bw - 0.06, 0.02, bd - 0.06), { color: '#6b4a2e', x: BX.x, y: DECK + 0.03, z: BX.z, ao: false });
    // os espaguetes em pé na metade do norte (inclinam para fora só acima da cabeça das dogs), a bola no meio e as
    // pranchas de pé na ponta do sul
    const noodles = ['#ff7fae', '#7fd36b', '#3fa1e0', '#f2c230', '#b49ad8'];
    const Rn = rng(83);
    noodles.forEach((c, i) => {
      const x = BX.x + (Rn() - 0.5) * (bw - 0.22), z = BX.z - bd / 2 + 0.1 + (i / (noodles.length - 1)) * (bd / 2 - 0.2);
      add(stick(V(x, DECK + 0.06, z), V(x + (Rn() - 0.5) * 0.16, 1.15 + Rn() * 0.25, z - Rn() * 0.12), 0.032, 8), { color: c, ao: false });
    });
    for (let k = 0; k < 2; k++) add(rb(bw - 0.2, 0.5, 0.04, 0.018, 1).rotateX(-0.1 - k * 0.07), { color: k ? '#3a8fd1' : '#f08a3c', x: BX.x + (k ? 0.03 : -0.03), y: DECK + 0.06, z: BX.z + bd / 2 - 0.07 - k * 0.06, ao: false });
    const ballC = ['#e8473a', '#fffaf0', '#3fa1e0', '#fffaf0', '#f2c230', '#fffaf0'].map((c) => new THREE.Color(c));
    add(faceColors(new THREE.SphereGeometry(0.15, 14, 10), (p) => ballC[Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / TAU) * 6) % 6]), { color: null, x: BX.x - 0.03, y: DECK + bh + 0.06, z: BX.z + 0.12, rz: 0.4, ao: false });
  }

  // ---------- as boias que ficaram na água (balançam e derivam devagar): a de listras, a bola e o colchão
  const red = new THREE.Color('#e8473a'), cream = new THREE.Color('#fff6e6');
  const ringGeo = faceColors(new THREE.TorusGeometry(0.3, 0.095, 10, 28).rotateX(Math.PI / 2), (p) => (Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / TAU) * 8) % 2 ? red : cream));
  const gores = ['#3fa1e0', '#fffaf0', '#f2c230', '#fffaf0', '#7fd36b', '#fffaf0'].map((c) => new THREE.Color(c));
  const ballGeo = faceColors(new THREE.SphereGeometry(0.17, 16, 12), (p) => gores[Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / TAU) * 6) % 6]);
  const matGeo = bake([
    ...[-2, -1, 0, 1, 2].map((k) => [new THREE.CapsuleGeometry(0.062, 1.25, 4, 10).rotateX(Math.PI / 2), { color: k % 2 ? '#fff6e6' : '#3fa8a8', x: k * 0.12 }]),
    [new THREE.CapsuleGeometry(0.075, 0.46, 4, 10).rotateZ(Math.PI / 2), { color: '#3fa8a8', y: 0.03, z: -0.66 }],
  ]);
  const floats = [
    { geo: ringGeo, name: 'boia-listrada', x: P.x0 + 2.4, z: cz + 1.1, y: WATER + 0.035, yaw: 0.4, ph: 0.3 },
    { geo: ballGeo, name: 'bola', x: cx + 1.9, z: cz - 1.3, y: WATER + 0.11, yaw: 1.2, ph: 1.9 },
    { geo: matGeo, name: 'colchao', x: P.x1 - 2.7, z: cz + 0.7, y: WATER + 0.03, yaw: 0.9, ph: 3.4 },
  ].map((f) => {
    const m = mesh(f.geo, SLOTS.solid(), { cast: false, name: `recanto:piscina:${f.name}` });
    m.position.set(f.x, f.y, f.z);
    m.rotation.y = f.yaw;
    keep(m);
    return { ...f, m };
  });
  anim.push((dt, t) => {
    for (const f of floats) {
      f.m.position.set(f.x + 0.16 * Math.sin(t * 0.11 + f.ph), f.y + 0.008 * Math.sin(t * 1.2 + f.ph), f.z + 0.12 * Math.sin(t * 0.085 + f.ph * 1.7));
      f.m.rotation.set(0.03 * Math.sin(t * 1.1 + f.ph), f.yaw + 0.3 * Math.sin(t * 0.07 + f.ph), 0.03 * Math.sin(t * 0.9 + f.ph * 2));
    }
  });

  // ---------- folhas e flores de ipê boiando: derivam devagar e balançam com a água
  const floatMat = mat('recanto-folha-boiando', () => new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }));
  const Rf = rng(77);
  const make = (geo, n, colors) => {
    const im = new THREE.InstancedMesh(geo, floatMat, n);
    im.name = 'recanto:piscina:folhas-soltas';
    im.frustumCulled = false;
    im.castShadow = false;
    im.receiveShadow = true;
    const list = [];
    for (let i = 0; i < n; i++) {
      const u = Math.pow(Rf(), 1.5);
      list.push({ x: P.x0 + 0.25 + u * (W - 0.5), z: P.z0 + 0.25 + Rf() * (H - 0.5), yaw: Rf() * TAU, s: 0.8 + Rf() * 0.5, ph: Rf() * TAU });
      im.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    keep(im);
    return { im, list };
  };
  const floaters = [make(leafG, 22, ['#6f9a3a', '#b8a24a', '#8a6a3a', '#7da040']), make(flowerG, 14, ['#ffd23f', '#f2c12e'])];
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fp = new THREE.Vector3(), fs = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  anim.push((dt, t) => {
    for (const { im, list } of floaters) {
      list.forEach((f, i) => {
        fp.set(f.x + 0.07 * Math.sin(t * 0.13 + f.ph), WATER + 0.008 + 0.0015 * Math.sin(t * 1.3 + f.ph), f.z + 0.05 * Math.sin(t * 0.11 + f.ph * 1.7));
        fq.setFromAxisAngle(up, f.yaw + 0.25 * Math.sin(t * 0.09 + f.ph));
        im.setMatrixAt(i, fm.compose(fp, fq, fs.setScalar(f.s)));
      });
      im.instanceMatrix.needsUpdate = true;
    }
  });
}

/** Copa do guarda-sol: gomos listrados com a beira recortada entre as varetas, a sanefa de pontas e o lado de baixo. */
function canopyGeo({ r = 1.25, apex = 2.6, rim = 2.2, n = 8, flap = 0.1, colors = ['#fff4de', '#2f9aa0'] } = {}) {
  const pos = [], col = [];
  const cs = colors.map((c) => new THREE.Color(c));
  const tri = (a, b, c, color) => {
    pos.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) col.push(color.r, color.g, color.b);
  };
  const A = [0, apex, 0];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU, am = (a0 + a1) / 2;
    const p0 = [Math.cos(a0) * r, rim, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, rim, Math.sin(a1) * r];
    const pm = [Math.cos(am) * r * 0.965, rim + 0.03, Math.sin(am) * r * 0.965];
    const c = cs[i % cs.length], cu = c.clone().multiplyScalar(0.72);
    tri(A, p1, pm, c); tri(A, pm, p0, c);
    tri(A, pm, p1, cu); tri(A, p0, pm, cu);
    const q0 = [p0[0], rim - flap, p0[2]], qm = [pm[0], pm[1] - flap - 0.03, pm[2]], q1 = [p1[0], rim - flap, p1[2]];
    tri(p0, pm, qm, c); tri(p0, qm, q0, c); tri(pm, p1, q1, c); tri(pm, q1, qm, c);
    tri(p0, qm, pm, cu); tri(p0, q0, qm, cu); tri(pm, q1, p1, cu); tri(pm, qm, q1, cu);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ================================================================ ÁREA DE SERVIÇO
function buildService({ kit, L, drips }) {
  const g = 'servico';
  const add = (geo, o) => kit.add(geo, { group: g, ...o });
  const S = L.SERVICE, T = L.TANKS, Dr = L.DRAIN, Ln = L.LINE;
  const WM = L.SERVICE_WASHER || null, RK = L.SERVICE_RACK || null;
  const FL = FLOOR;                              // o piso de cimento
  const wz = L.WALL.minZ + L.WALL.t / 2;         // a face de dentro do muro norte
  const fx0 = S.x0, fx1 = S.x1, fz0 = wz, fz1 = S.z1;
  const pillars = northPillars(L);

  // ---------- o piso: placas de cimento (variação por placa), as juntas, as guias e o ralo de piso
  add(tiles(fx1 - fx0, fz1 - fz0, 0.62, 0.62, cells(['#cbc5ba', '#c4beb2', '#d0cabf', '#c7c0b3'], 0.62, 5)), { color: null, slot: 'ground', x: (fx0 + fx1) / 2, y: FL, z: (fz0 + fz1) / 2, ao: false });
  const joints = [];
  for (let x = fx0 + 1.86; x < fx1 - 0.3; x += 1.86) joints.push([x - 0.006, fz0, x + 0.006, fz1, '#a39d92']);
  for (const k of [1 / 3, 2 / 3]) joints.push([fx0, fz0 + (fz1 - fz0) * k - 0.006, fx1, fz0 + (fz1 - fz0) * k + 0.006, '#a39d92']);
  add(flatQuads(joints), { color: null, slot: 'ground', y: FL + 0.003, ao: false });
  for (const x of [fx0 + 0.03, fx1 - 0.03]) add(slab(0.06, 0.016, fz1 - fz0), { color: '#b7b0a4', x, y: 0.002, z: (fz0 + fz1) / 2, ao: false });
  add(slab(fx1 - fx0 - 0.12, 0.016, 0.06), { color: '#b7b0a4', x: (fx0 + fx1) / 2, y: 0.002, z: fz1 - 0.03, ao: false });
  add(grate(0.22, 4), { color: null, slot: 'ground', x: T.x1 + 1.3, y: FL + 0.003, z: T.z1 + 0.55, ao: false });
  // as manchas molhadas: na frente dos tanques e embaixo das roupas que pingam
  add(blob(0.34, 2), { color: '#8f8a80', slot: 'glass', x: (T.x0 + T.x1) / 2 - 0.2, y: FL + 0.006, z: T.z1 + 0.22, sz: 0.5, ao: false });
  const Rw = rng(57);
  for (let i = 0; i < 9; i++) {
    const x = Ln.a.x + 0.5 + Rw() * (Ln.b.x - Ln.a.x - 1.0), z = Ln.a.z + (Rw() - 0.5) * 0.8;
    add(blob(0.07 + Rw() * 0.08, i * 3 + 1), { color: '#9a958b', slot: 'glass', x, y: FL + 0.006, z, sz: 0.7, ao: false });
  }
  // um caco de telha do telhadinho, caído na tempestade, e duas folhas
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 6, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), { color: '#b85a38', x: T.x1 + 0.9, y: FL + 0.002, z: T.z1 + 0.75, ry: 0.7, ao: false });
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.09, 6, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), { color: '#a9523a', x: T.x1 + 1.15, y: FL + 0.002, z: T.z1 + 0.6, ry: -0.4, ao: false });

  // ---------- a parede de azulejo atrás dos tanques (por cima do muro e do pilar dele; dentro da caixa do colisor)
  const px0 = T.x0 + 0.005, px1 = (WM ? WM.x + WM.hx : T.x1) - 0.005, pxc = (px0 + px1) / 2;
  const PZ = wz + 0.105, PH = 1.74;              // a face da frente e o alto
  add(rb(px1 - px0, PH, 0.145, 0.012, 1), { color: speckle('#efe6d6', 0.03, 9), x: pxc, z: PZ - 0.0725 });
  add(rb(px1 - px0 + 0.04, 0.05, 0.19, 0.012, 1), { color: '#d8c6a5', x: pxc, y: PH, z: PZ - 0.075, ao: false });
  const tileA = new THREE.Color('#f7f4ec'), tileB = new THREE.Color('#bcd9e6'), tileC = new THREE.Color('#2a7fb4'), tileOut = new THREE.Color();
  const tw0 = Math.round((px1 - px0 - 0.06) / 0.15) * 0.15;
  add(tilesV(tw0, 1.05, 0.15, 0.15, (p) => {
    const i = Math.floor((p.x + 50) / 0.15 + 1e-6), j = Math.floor((p.y + 50) / 0.15 + 1e-6);
    if (p.y > 0.37) return tileOut.copy(tileC);
    return tileOut.copy((i + j) % 2 ? tileA : hash(i, j, 3) < 0.25 ? tileB : tileA).offsetHSL(0, 0, (hash(i, j, 7) - 0.5) * 0.02);
  }), { color: null, slot: 'glass', x: pxc, y: 1.165, z: PZ + 0.003, ao: false });

  // ---------- os dois tanques de granito (dentro da caixa do colisor 'tanques'): pilares, bacias, espelho
  const tx0 = T.x0 + 0.08, tx1 = T.x1 - 0.08, tz0 = PZ + 0.005, tz1 = T.z1 - 0.02, tw = (tx1 - tx0) / 2, tzc = (tz0 + tz1) / 2;
  const granite = speckle('#dcd8cf', 0.06, 3), graniteD = speckle('#cbc6bb', 0.06, 4);
  for (const x of [tx0 + 0.06, tx0 + tw, tx1 - 0.06]) add(rb(0.1, Dr.y - 0.05 - FL, 0.34, 0.015, 1), { color: speckle('#b8b1a5', 0.05, 5), x, y: FL, z: tzc - 0.01 });
  // a beira da frente é mais baixa (0,80 m): da câmera dá para ver o fundo da bacia, com o ralo
  const wallH = T.h - (Dr.y - 0.05), lip = 0.06;
  for (let k = 0; k < 2; k++) {
    const x0 = tx0 + k * tw, x1 = x0 + tw, xc = (x0 + x1) / 2;
    add(rb(tw - 0.01, 0.05, tz1 - tz0, 0.012, 1), { color: graniteD, x: xc, y: Dr.y - 0.05, z: tzc });
    add(rb(tw - 0.01, wallH - lip, 0.05, 0.012, 1), { color: granite, x: xc, y: Dr.y - 0.05, z: tz1 - 0.025 });
    add(rb(tw - 0.01, wallH, 0.05, 0.012, 1), { color: granite, x: xc, y: Dr.y - 0.05, z: tz0 + 0.025 });
    for (const sx of [x0 + 0.03, x1 - 0.03]) add(rb(0.05, wallH, tz1 - tz0 - 0.08, 0.012, 1), { color: granite, x: sx, y: Dr.y - 0.05, z: tzc });
    // o cano do ralo descendo até o chão
    add(cyl(0.02, 0.02, Dr.y - 0.05 - FL, 8), { color: '#9a958c', x: xc, y: FL, z: Dr.z, ao: false });
    // a tábua de esfregar (as ondinhas) na beira de trás, do lado oposto ao da correntinha
    for (let r = 0; r < 5; r++) add(new THREE.CylinderGeometry(0.008, 0.008, tw - 0.5, 6).rotateZ(Math.PI / 2), { color: '#cfcabf', x: xc - 0.16, y: T.h - 0.02 - r * 0.028, z: tz0 + 0.062 + r * 0.012, ao: false });
  }
  add(rb(tx1 - tx0 + 0.04, 0.16, 0.04, 0.012, 1), { color: granite, x: (tx0 + tx1) / 2, y: T.h - 0.01, z: tz0 + 0.02 });
  // o tanque da esquerda: o RALO SEM A ROLHA (o furo escuro com o anel de inox) e a correntinha vazia, sem nada na
  // ponta; o pingo da torneira molha o fundo, mas a água vai embora
  add(new THREE.CircleGeometry(0.027, 14).rotateX(-Math.PI / 2), { color: '#111214', slot: 'ground', x: Dr.x, y: Dr.y + 0.003, z: Dr.z, ao: false });
  add(new THREE.TorusGeometry(0.033, 0.006, 6, 16).rotateX(Math.PI / 2), { color: CHROME, slot: 'glass', x: Dr.x, y: Dr.y + 0.004, z: Dr.z, ao: false });
  const chainA = V(Dr.x + 0.13, T.h - 0.016, tz0 + 0.054);
  const chain = new THREE.CatmullRomCurve3([chainA, V(Dr.x + 0.13, T.h - 0.07, tz0 + 0.057), V(Dr.x + 0.125, Dr.y + 0.06, tz0 + 0.06), V(Dr.x + 0.115, Dr.y + 0.007, tz0 + 0.075), V(Dr.x + 0.09, Dr.y + 0.006, tz0 + 0.11), V(Dr.x + 0.055, Dr.y + 0.006, tz0 + 0.14)]);
  const bead = new THREE.SphereGeometry(0.0055, 6, 4);
  for (let i = 0; i <= 15; i++) {
    const p = chain.getPoint(i / 15);
    add(bead, { color: '#c9ced3', slot: 'glass', x: p.x, y: p.y, z: p.z, ao: false });
  }
  const end = chain.getPoint(1);
  add(new THREE.TorusGeometry(0.011, 0.0025, 5, 10).rotateX(Math.PI / 2), { color: '#c9ced3', slot: 'glass', x: end.x - 0.012, y: Dr.y + 0.004, z: end.z + 0.004, ao: false });
  add(new THREE.TorusGeometry(0.008, 0.002, 5, 8), { color: '#c9ced3', slot: 'glass', x: chainA.x, y: chainA.y + 0.004, z: tz0 + 0.052, ao: false });
  const tapX = Dr.x - 0.11;
  add(blob(0.045, 9), { color: '#a9a69f', slot: 'glass', x: tapX, y: Dr.y + 0.0035, z: PZ + 0.2, ao: false });
  // o tanque da direita: água de sabão com espuma, a correntinha entrando na água (a rolha lá no fundo)
  const rx = tx0 + tw * 1.5;
  const waterTop = T.h - lip - 0.03;
  add(new THREE.PlaneGeometry(tw - 0.12, tz1 - tz0 - 0.1).rotateX(-Math.PI / 2), { color: '#b9cfd4', slot: 'glass', x: rx, y: waterTop, z: tzc, ao: false });
  const Rs = rng(19);
  for (let i = 0; i < 9; i++) {
    add(new THREE.SphereGeometry(0.025 + Rs() * 0.02, 8, 5), { color: '#fbfcfd', x: rx + (Rs() - 0.5) * 0.5, y: waterTop, z: tzc + (Rs() - 0.5) * 0.24, sy: 0.4, ao: false });
  }
  for (let i = 0; i < 5; i++) add(bead, { color: '#c9ced3', slot: 'glass', x: rx + 0.13, y: T.h - 0.02 - i * 0.017, z: tz0 + 0.056, ao: false });
  add(new THREE.TorusGeometry(0.008, 0.002, 5, 8), { color: '#c9ced3', slot: 'glass', x: rx + 0.13, y: T.h - 0.012, z: tz0 + 0.052, ao: false });
  // o sabão em barra (na saboneteira) no meio dos tanques e a escova na beira do da direita
  add(rb(0.13, 0.012, 0.09, 0.005, 1), { color: '#f4f4f0', x: tx0 + tw, y: T.h + 0.15, z: tz0 + 0.045, ao: false });
  add(rb(0.09, 0.03, 0.055, 0.014, 1), { color: '#7fc3e6', x: tx0 + tw, y: T.h + 0.163, z: tz0 + 0.045, ry: 0.25, ao: false });
  add(rb(0.15, 0.03, 0.055, 0.01, 1), { color: '#c08a52', x: rx + 0.18, y: T.h - lip + 0.012, z: tz1 - 0.028, ry: -0.15, ao: false });
  add(rb(0.14, 0.014, 0.048, 0.006, 1), { color: '#ead9a2', x: rx + 0.18, y: T.h - lip, z: tz1 - 0.028, ry: -0.15, ao: false });
  // embaixo: o balde emborcado e os galões de sabão e de água sanitária
  add(cyl(0.11, 0.14, 0.24, 14), { color: '#2f8fd8', x: rx + 0.13, y: FL, z: T.z1 - 0.19 });
  add(new THREE.TorusGeometry(0.13, 0.006, 4, 12, Math.PI).rotateY(0.4), { color: '#3a3a3a', x: rx + 0.13, y: FL + 0.12, z: T.z1 - 0.19, ao: false });
  add(rb(0.16, 0.26, 0.11, 0.035, 1), { color: '#f4f4f0', x: tx0 + tw * 0.35, y: FL, z: T.z1 - 0.26 });
  add(cyl(0.022, 0.022, 0.03, 8), { color: '#e8473a', x: tx0 + tw * 0.35 + 0.04, y: FL + 0.26, z: T.z1 - 0.26, ao: false });
  add(rb(0.12, 0.22, 0.09, 0.03, 1), { color: '#3d7fd1', x: tx0 + tw * 0.75, y: FL, z: T.z1 - 0.24 });

  // ---------- as torneiras na parede de azulejo (a da esquerda pinga)
  const tap = (x, drip) => {
    const y = 1.12, z0 = PZ + 0.005;
    add(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 12).rotateX(Math.PI / 2), { color: CHROME, slot: 'glass', x, y, z: z0 + 0.006, ao: false });
    add(stick(V(x, y, z0), V(x, y, z0 + 0.11), 0.014, 8), { color: CHROME, slot: 'glass', ao: false });
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, y, z0 + 0.1), V(x, y - 0.005, z0 + 0.16), V(x, y - 0.05, z0 + 0.19), V(x, y - 0.09, z0 + 0.195)]), 8, 0.012, 8), { color: CHROME, slot: 'glass', ao: false });
    add(cyl(0.012, 0.012, 0.04, 8), { color: CHROME, slot: 'glass', x, y: y + 0.012, z: z0 + 0.07, ao: false });
    add(rb(0.07, 0.012, 0.016, 0.005, 1), { color: CHROME, slot: 'glass', x, y: y + 0.05, z: z0 + 0.07, ao: false });
    if (drip) drips.push({ x, z: z0 + 0.195, y0: y - 0.1, y1: Dr.y + 0.004, period: 2.3, phase: 0.4, ripple: false });
  };
  tap(tapX, true);
  tap(rx - 0.03, false);

  // ---------- a prateleira dos produtos, em cima dos tanques
  const tcx = (T.x0 + T.x1) / 2, shz = PZ + 0.1;
  add(rb(1.7, 0.03, 0.2, 0.008, 1), { color: '#a87a52', x: tcx, y: 1.36, z: shz });
  for (const dx of [-0.7, 0.7]) add(rb(0.03, 0.14, 0.16, 0.006, 1), { color: '#6b4a34', x: tcx + dx, y: 1.22, z: shz - 0.02 });
  add(rb(0.1, 0.22, 0.07, 0.03, 1), { color: '#3d7fd1', x: tcx - 0.67, y: 1.39, z: shz });
  add(cyl(0.018, 0.018, 0.03, 8), { color: '#fffaf0', x: tcx - 0.67, y: 1.61, z: shz, ao: false });
  add(rb(0.12, 0.26, 0.08, 0.035, 1), { color: '#e98fb7', x: tcx - 0.51, y: 1.39, z: shz });
  add(cyl(0.022, 0.022, 0.035, 8), { color: '#9677c6', x: tcx - 0.51, y: 1.65, z: shz, ao: false });
  add(cyl(0.05, 0.055, 0.24, 10), { color: '#f4f4f0', x: tcx + 0.43, y: 1.39, z: shz });
  add(cyl(0.022, 0.022, 0.03, 8), { color: '#e8473a', x: tcx + 0.43, y: 1.63, z: shz, ao: false });
  add(rb(0.1, 0.03, 0.07, 0.01, 1), { color: '#ffd23f', x: tcx + 0.19, y: 1.39, z: shz + 0.02, ry: 0.3, ao: false });
  add(rb(0.1, 0.012, 0.07, 0.005, 1), { color: '#4f9a52', x: tcx + 0.19, y: 1.42, z: shz + 0.02, ry: 0.3, ao: false });
  // a caixinha de sabão em pó (só o desenho de bolhas) e o vasinho
  add(rb(0.16, 0.2, 0.07, 0.012, 1), { color: '#f08a3c', x: tcx - 0.2, y: 1.39, z: shz });
  for (const [dx, dy, r] of [[-0.03, 0.12, 0.022], [0.025, 0.08, 0.016], [0.0, 0.05, 0.011]]) add(new THREE.CircleGeometry(r, 12), { color: '#fffaf0', x: tcx - 0.2 + dx, y: 1.39 + dy, z: shz + 0.039, ao: false });
  potAt(add, { x: tcx + 0.69, z: shz, y: 1.39, r: 0.06, h: 0.09, color: '#c46a43', plant: flowerBush({ r: 0.07, seed: 12, flower: '#ff8fc0', n: 4 }), plantSlot: 'foliage' });

  // ---------- o telhadinho de telha colonial em cima dos tanques (postes no fundo, mãos-francesas, o beiral a 2,2 m)
  const rx0 = px0 - 0.14, rx1 = px1 + 0.14, rzB = wz - 0.02, rzF = T.z1 + 0.46, yB = 2.52, yF = 2.2;
  const slope = Math.atan2(yB - yF, rzF - rzB), len = Math.hypot(rzF - rzB, yB - yF);
  const roofY = (z) => yB + ((z - rzB) * (yF - yB)) / (rzF - rzB);
  const woodC = speckle('#8a5a36', 0.05, 8);
  const postXs = [T.x0 + 0.045, T.x1 - 0.045];
  if (WM) postXs.push(WM.x + WM.hx - 0.045);
  for (const x of postXs) {
    add(rb(0.07, roofY(PZ + 0.04) - 0.06 - FL, 0.07, 0.012, 1), { color: woodC, x, y: FL, z: PZ + 0.04 });
    add(beam(V(x, 1.76, PZ + 0.06), V(x, roofY(rzF - 0.13) - 0.07, rzF - 0.13), 0.05, 0.05), { color: woodC, ao: false });
    add(beam(V(x, yB - 0.03, rzB), V(x, yF - 0.03, rzF), 0.06, 0.09), { color: woodC, ao: false });
  }
  add(rb(rx1 - rx0, 0.08, 0.07, 0.01, 1), { color: woodC, x: (rx0 + rx1) / 2, y: roofY(rzF - 0.1) - 0.115, z: rzF - 0.1, ao: false });
  add(rb(rx1 - rx0, 0.025, len, 0.008, 1).rotateX(slope), { color: '#6e3f2a', x: (rx0 + rx1) / 2, y: (yB + yF) / 2 + 0.025, z: (rzB + rzF) / 2, ao: false });
  // as capas das telhas (três por fileira, uma por cima da outra); uma faltando e uma escorregada
  const terra = ['#c4643f', '#b85a38', '#cf7048', '#a9523a', '#bf6a46'].map((c) => new THREE.Color(c));
  const capa = new THREE.CylinderGeometry(0.05, 0.058, len / 3 + 0.04, 6, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateX(slope);
  const nRows = Math.max(2, Math.round((rx1 - rx0 - 0.08) / 0.11));
  const Rt = rng(23);
  for (let i = 0; i < nRows; i++) {
    const x = rx0 + 0.06 + (i * (rx1 - rx0 - 0.12)) / (nRows - 1);
    for (let k = 0; k < 3; k++) {
      if (i === 13 && k === 1) continue;
      const slid = i === 6 && k === 2;
      const zc = rzB + ((k + 0.5) / 3) * (rzF - rzB) + (slid ? 0.07 : 0);
      const c = terra[Math.floor(Rt() * terra.length)].clone().offsetHSL(0, 0, (Rt() - 0.5) * 0.04);
      add(capa, { color: () => c, x: x + (slid ? 0.015 : 0), y: roofY(zc) + 0.05 - k * 0.004, z: zc, ry: slid ? 0.12 : 0, ao: false });
    }
  }
  // a lâmpada da área de serviço, ainda acesa
  const lmz = (PZ + rzF) / 2;
  add(cyl(0.004, 0.004, roofY(lmz) + 0.03 - 2.02, 4), { color: '#2b2b30', x: tcx, y: 2.02, z: lmz, ao: false });
  add(new THREE.ConeGeometry(0.09, 0.07, 12, 1, true), { color: '#e9e4d6', x: tcx, y: 2.02, z: lmz, ao: false });
  add(new THREE.SphereGeometry(0.035, 10, 8), { color: '#fff2c8', slot: 'lit', x: tcx, y: 1.98, z: lmz, ao: false });
  // a vassoura encostada no poste do leste (dentro da caixa dos tanques)
  const bx = T.x1 - 0.032, bz = T.z1 - 0.2;
  add(rb(0.05, 0.05, 0.26, 0.01, 1), { color: '#d83a3a', x: bx, y: FL + 0.05, z: bz, ao: false });
  add(rb(0.045, 0.055, 0.25, 0.006, 1), { color: '#3a3633', x: bx, y: FL, z: bz, ao: false });
  add(stick(V(bx, FL + 0.1, bz), V(bx, 1.3, PZ + 0.09), 0.012, 6), { color: '#d6a86a', ao: false });

  // ---------- a máquina de lavar (só com o colisor do layout: SERVICE_WASHER), ao lado dos tanques
  if (WM) {
    const mz0 = PZ + 0.012, mz1 = WM.z + WM.hz - 0.03, mzc = (mz0 + mz1) / 2, mw = WM.hx * 2 - 0.05, mh = 0.86;
    add(rb(mw, mh - 0.03, mz1 - mz0, 0.03, 2), { color: speckle('#f4f4f0', 0.02, 31), x: WM.x, y: FL + 0.03, z: mzc });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.025, 0.03, 0.03, 8), { color: '#3a3f44', x: WM.x + sx * (mw / 2 - 0.06), y: FL, z: mzc + sz * ((mz1 - mz0) / 2 - 0.06), ao: false });
    // a porta redonda (aro e vidro), o painel com o botão e as luzinhas, a gaveta do sabão
    add(new THREE.TorusGeometry(0.19, 0.028, 8, 24), { color: '#c9ced3', slot: 'glass', x: WM.x, y: FL + 0.42, z: mz1 + 0.006, ao: false });
    add(new THREE.CircleGeometry(0.175, 24), { color: '#2a4660', slot: 'glass', x: WM.x, y: FL + 0.42, z: mz1 + 0.004, ao: false });
    add(rb(0.05, 0.1, 0.02, 0.008, 1), { color: '#9aa1a6', x: WM.x + 0.2, y: FL + 0.37, z: mz1 + 0.012, ao: false });
    add(slab(mw - 0.04, 0.1, 0.008), { color: '#dfe3e6', x: WM.x, y: FL + mh - 0.14, z: mz1 + 0.003, ao: false });
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16).rotateX(Math.PI / 2), { color: '#f4f4f0', x: WM.x + 0.14, y: FL + mh - 0.09, z: mz1 + 0.018, ao: false });
    add(slab(0.005, 0.03, 0.006).translate(0, 0.004, 0), { color: '#3a3f44', x: WM.x + 0.14, y: FL + mh - 0.09, z: mz1 + 0.034, ao: false });
    add(slab(0.2, 0.06, 0.006), { color: '#c9ced3', x: WM.x - 0.16, y: FL + mh - 0.12, z: mz1 + 0.008, ao: false });
    for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.009, 8, 6), { color: k ? '#9aa1a6' : '#9be05a', slot: k ? 'solid' : 'lit', x: WM.x - 0.02 + k * 0.035, y: FL + mh - 0.09, z: mz1 + 0.01, ao: false });
    // em cima: as toalhas dobradas e a caixa de pregadores
    for (let k = 0; k < 3; k++) add(rb(0.3, 0.035, 0.22, 0.012, 1), { color: ['#f2a03d', '#fff4e2', '#3fa8a8'][k], x: WM.x - 0.1, y: FL + mh + k * 0.035, z: mzc, ry: 0.06 * k, ao: false });
    add(rb(0.14, 0.07, 0.1, 0.01, 1), { color: '#7fbf8a', x: WM.x + 0.18, y: FL + mh, z: mzc + 0.05, ry: -0.2, ao: false });
    // a mangueira de entrada, na parede de azulejo
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(WM.x + 0.2, 1.2, PZ + 0.01), V(WM.x + 0.2, 1.05, PZ + 0.05), V(WM.x + 0.18, 0.92, PZ + 0.04), V(WM.x + 0.16, FL + mh - 0.02, PZ + 0.05)]), 10, 0.012, 6), { color: '#8e959a', ao: false });
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8).rotateX(Math.PI / 2), { color: CHROME, slot: 'glass', x: WM.x + 0.2, y: 1.2, z: PZ + 0.015, ao: false });
  }

  // ---------- no muro, a leste do telhadinho (tudo acima de 0,6 m, fora dos pilares): o enrolador de mangueira com a
  // torneira do jardim, o varal sanfonado com dois panos de prato, as jardineiras de meia-lua e a arandela
  const hx = clearOf(pillars, rx1 + 0.75, 0.42), hy = 0.95, hz = wz + 0.14;
  add(rb(0.08, 0.36, 0.03, 0.01, 1), { color: '#3f6a3a', x: hx, y: hy - 0.18, z: wz + 0.015, ao: false });
  add(stick(V(hx, hy, wz + 0.02), V(hx, hy, wz + 0.25), 0.02, 8), { color: '#3f6a3a', ao: false });
  for (let k = 0; k < 2; k++) add(new THREE.TorusGeometry(0.15 - k * 0.012, 0.017, 6, 16), { color: k ? '#4f9a52' : '#5aa85e', x: hx, y: hy, z: hz + k * 0.04, ao: false });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(hx + 0.12, hy - 0.09, hz + 0.04), V(hx + 0.2, hy - 0.2, hz + 0.06), V(hx + 0.18, 0.72, hz + 0.05)]), 8, 0.016, 6), { color: '#5aa85e', ao: false });
  add(cyl(0.02, 0.016, 0.05, 8), { color: '#f2c230', x: hx + 0.18, y: 0.68, z: hz + 0.05, ao: false });
  add(stick(V(hx, 1.32, wz), V(hx, 1.32, wz + 0.08), 0.013, 8), { color: CHROME, slot: 'glass', ao: false });
  add(rb(0.06, 0.012, 0.016, 0.005, 1), { color: '#d63a32', x: hx, y: 1.345, z: wz + 0.06, ao: false });
  const wr = { x: clearOf(pillars, (Ln.a.x + Ln.b.x) / 2 + 1.2, 0.7), y: 1.4, d: 0.34 };
  for (const sx of [-0.35, 0.35]) {
    add(rb(0.05, 0.16, 0.012, 0.004, 1), { color: '#d9dde0', x: wr.x + sx, y: wr.y - 0.08, z: wz + 0.006, ao: false });
    add(stick(V(wr.x + sx, wr.y - 0.07, wz + 0.01), V(wr.x + sx, wr.y + 0.01, wz + wr.d), 0.007, 4), { color: '#d9dde0', ao: false });
    add(stick(V(wr.x + sx, wr.y + 0.01, wz + 0.01), V(wr.x + sx, wr.y - 0.07, wz + wr.d), 0.007, 4), { color: '#d9dde0', ao: false });
  }
  for (let k = 0; k < 4; k++) add(stick(V(wr.x - 0.4, wr.y, wz + 0.08 + k * 0.085), V(wr.x + 0.4, wr.y, wz + 0.08 + k * 0.085), 0.006, 4), { color: '#eef0f1', ao: false });
  for (const [dx, kz, cA, cB] of /** @type {[number, number, string, string][]} */ ([[-0.17, 1, '#fffaf0', '#e8473a'], [0.18, 3, '#fffaf0', '#3f8fd1']])) {
    add(clothGeo(0.3, 0.38, 4, 8, (u, v) => new THREE.Color(v > 0.88 || (v > 0.6 && v < 0.7) ? cB : cA), { amp: 0.006 }), { color: null, slot: 'plant', x: wr.x + dx, y: wr.y - 0.006, z: wz + 0.08 + kz * 0.085, ao: false });
  }
  const trail = palm({ h: 0.36, fronds: 7, seed: 15 }).rotateX(Math.PI);
  const planters = [clearOf(pillars, Ln.a.x + 0.9, 0.5), clearOf(pillars, Ln.b.x - 0.7, 0.5)];
  planters.forEach((px, i) => {
    const py = 1.06 - i * 0.04;
    add(rb(0.34, 0.16, 0.15, 0.03, 1), { color: speckle('#c46a43', 0.06, px * 5), x: px, y: py, z: wz + 0.085 });
    add(slab(0.3, 0.01, 0.11), { color: '#4a3424', slot: 'ground', x: px, y: py + 0.161, z: wz + 0.085, ao: false });
    add(flowerBush({ r: 0.1, seed: 17 + i, flower: i ? '#f2c230' : '#ff6a55', n: 5 }), { color: null, slot: 'foliage', x: px, y: py + 0.165, z: wz + 0.085, ao: false });
    add(trail, { color: null, slot: 'plant', x: px, y: py + 0.16, z: wz + 0.15, ao: false });
  });
  const lampX = clearOf(pillars, (Ln.a.x + Ln.b.x) / 2 - 1.0, 0.4);
  add(rb(0.1, 0.14, 0.03, 0.01, 1), { color: '#5d6368', x: lampX, y: 1.2, z: wz + 0.015, ao: false });
  add(stick(V(lampX, 1.3, wz + 0.02), V(lampX, 1.36, wz + 0.14), 0.01, 5), { color: '#5d6368', ao: false });
  add(new THREE.ConeGeometry(0.08, 0.07, 10, 1, true), { color: '#5d6368', x: lampX, y: 1.37, z: wz + 0.15, ao: false });
  add(new THREE.SphereGeometry(0.045, 10, 8), { color: '#fff2c8', slot: 'lit', x: lampX, y: 1.32, z: wz + 0.15, ao: false });

  // ---------- os postes do varal, firmes no chão: a sapata de concreto, a luva de ferro, o poste de madeira com a
  // travessa e as mãos-francesas dela (os fios e as roupas estão em props.line); no do oeste, o saquinho de pregadores
  const postC = speckle('#957657', 0.06, 17);
  for (const p of [Ln.a, Ln.b]) {
    add(rb(0.34, 0.06, 0.34, 0.015, 1), { color: speckle('#bdb6aa', 0.05, 19), x: p.x, y: FL, z: p.z });
    add(cyl(Ln.postR + 0.012, Ln.postR + 0.018, 0.24, 14), { color: '#5d6368', x: p.x, y: FL + 0.06, z: p.z });
    for (let k = 0; k < 4; k++) add(new THREE.SphereGeometry(0.012, 6, 4), { color: '#8e959a', x: p.x + Math.cos(k * Math.PI / 2 + 0.8) * (Ln.postR + 0.016), y: FL + 0.2, z: p.z + Math.sin(k * Math.PI / 2 + 0.8) * (Ln.postR + 0.016), ao: false });
    add(cyl(Ln.postR - 0.004, Ln.postR, 1.44 - 0.06, 12), { color: postC, x: p.x, y: FL + 0.06, z: p.z });
    add(new THREE.SphereGeometry(Ln.postR - 0.004, 12, 5, 0, TAU, 0, Math.PI / 2), { color: postC, x: p.x, y: FL + 1.44, z: p.z, ao: false });
    add(rb(0.07, 0.06, 0.66, 0.012, 1), { color: '#7d5a3c', x: p.x, y: 1.37, z: p.z, ao: false });
    for (const s of [-1, 1]) add(beam(V(p.x, 1.14, p.z + s * 0.05), V(p.x, 1.38, p.z + s * 0.27), 0.035, 0.035), { color: '#7d5a3c', ao: false });
    const toward = p.x < (Ln.a.x + Ln.b.x) / 2 ? 1 : -1;
    for (const dz of [-0.25, 0, 0.25]) add(new THREE.TorusGeometry(0.012, 0.003, 4, 8).rotateY(Math.PI / 2), { color: '#9aa1a6', x: p.x + (dz ? 0 : toward * Ln.postR), y: dz ? 1.355 : Ln.h + 0.012, z: p.z + dz, ao: false });
  }
  const bag = { x: Ln.a.x - Ln.postR - 0.035, y: 0.98, z: Ln.a.z };
  add(stick(V(Ln.a.x - Ln.postR + 0.005, bag.y + 0.24, bag.z), V(bag.x - 0.01, bag.y + 0.24, bag.z), 0.006, 4), { color: '#9aa1a6', ao: false });
  add(rb(0.07, 0.2, 0.18, 0.03, 2), { color: speckle('#e8708a', 0.05, 23), x: bag.x, y: bag.y, z: bag.z });
  add(slab(0.074, 0.03, 0.184), { color: '#fffaf0', x: bag.x, y: bag.y + 0.13, z: bag.z, ao: false });
  ['#e8473a', '#3fa1e0', '#f2c230', '#7fd36b'].forEach((c, i) => add(slab(0.012, 0.06, 0.016), { color: c, x: bag.x - 0.005, y: bag.y + 0.17, z: bag.z - 0.06 + i * 0.04, rx: (i - 1.5) * 0.12, ao: false }));
  // um pregador caído no chão, perto do poste do leste
  add(slab(0.012, 0.012, 0.07), { color: '#f2c230', x: Ln.b.x - 0.5, y: FL, z: Ln.b.z + 0.35, ry: 0.7, ao: false });

  // ---------- o varal de chão (só com o colisor do layout: SERVICE_RACK): as asas abertas, as toalhas penduradas
  if (RK) {
    const rw = RK.hx * 2 - 0.06, rd = RK.hz * 2 - 0.06, rh = 0.98, white = '#f2f2ee';
    for (const sx of [-1, 1]) {
      const x = RK.x + sx * rw / 2;
      add(stick(V(x, FL, RK.z - rd / 2), V(x, rh, RK.z + rd / 2), 0.012, 5), { color: white, ao: false });
      add(stick(V(x, FL, RK.z + rd / 2), V(x, rh, RK.z - rd / 2), 0.012, 5), { color: white, ao: false });
      for (const sz of [-1, 1]) add(cyl(0.016, 0.016, 0.02, 6), { color: '#8e959a', x, y: FL, z: RK.z + sz * rd / 2, ao: false });
    }
    for (let k = 0; k < 6; k++) {
      const z = RK.z - rd / 2 + (k * rd) / 5;
      add(stick(V(RK.x - rw / 2, rh, z), V(RK.x + rw / 2, rh, z), k === 0 || k === 5 ? 0.011 : 0.006, 5), { color: white, ao: false });
    }
    const towels = [[-0.27, 1, 0.34, 0.5, '#3fa8a8', '#fffaf0'], [0.1, 2, 0.3, 0.44, '#f2a03d', '#fff3dc'], [0.3, 4, 0.26, 0.36, '#b49ad8', '#fffaf0']];
    for (const [dx, kz, w, h, cA, cB] of /** @type {[number, number, number, number, string, string][]} */ (towels)) {
      const z = RK.z - rd / 2 + (kz * rd) / 5;
      add(clothGeo(w, h, 4, 8, (u, v) => new THREE.Color((v > 0.1 && v < 0.2) || v > 0.9 ? cB : cA), { amp: 0.008, seed: kz }), { color: null, slot: 'plant', x: RK.x + dx * (rw / 0.94), y: rh - 0.008, z, ao: false });
    }
  }
}

// ================================================================ O VARAL (props.line)
function buildLine({ L, anim, keep }) {
  const Ln = L.LINE, CP = L.CARROT_PIN;
  const group = new THREE.Group();
  group.name = 'recanto:varal';
  keep(group);
  const xa = Ln.a.x, xb = Ln.b.x, span = xb - xa;
  // o fio do meio (o da cenoura) é esticado; os de fora, presos nas pontas das travessas, fazem barriga
  const LINES = [
    { z: Ln.a.z, y: Ln.h, sag: 0, k: 1 },
    { z: Ln.a.z - 0.25, y: Ln.h + 0.025, sag: 0.04, k: 0.65 },
    { z: Ln.a.z + 0.25, y: Ln.h + 0.025, sag: 0.04, k: 0.65 },
  ];
  // amp: a força do sacolejo agora; drive: o valor pedido neste quadro (−1: ninguém pediu, ele morre sozinho);
  // pin: a abertura mostrada do pregador; pinTo: a pedida (subindo, ele voa até lá; voltando, vai na hora)
  const S = { amp: 0, drive: -1, pin: 0, pinTo: 0, t: 0 };
  const lineY = (ln, u) => ln.y - ln.sag * 4 * u * (1 - u) - S.amp * ln.k * 0.032 * Math.sin(S.t * 14) * Math.sin(Math.PI * u);

  // os fios: segmentos de uma malha instanciada só (seguem o balanço)
  const SEG = 16;
  const fios = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0055, 0.0055, 1, 5, 1, true), mat('recanto-fio-do-varal', () => new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.55 })), LINES.length * SEG);
  fios.name = 'recanto:varal:fios';
  fios.frustumCulled = false;
  fios.castShadow = true;
  group.add(fios);

  // as roupas, coloridas, de duas em duas num pivô no fio (giram em volta dele: a brisa e o sacolejo), com os
  // pregadores. O fio do meio fica livre em volta da cenoura (os pombos pousam ali) e o do sul, na frente dela; no do
  // norte, bem atrás da cenoura, o lençol claro (a cenoura laranja aparece contra ele).
  const PINS = ['#e8473a', '#3fa1e0', '#f2c230', '#7fd36b', '#f28ca2'];
  const pinGeo = slab(0.012, 0.064, 0.017);
  const m0 = xa + 0.6, m1 = CP.x - 1.6;       // o trecho com roupa do fio do meio
  const s0 = xa + 0.9, s1 = CP.x - 1.65;      // o do fio do sul
  const n0 = xa + 0.55, n1 = CP.x - 1.2;      // o do fio do norte, a oeste do lençol
  const at = (a, b, i, n) => a + ((b - a) * i) / (n - 1);
  const ITEMS = [
    { line: 0, x: at(m0, m1, 0, 6), kind: 'towel', w: 0.5, h: 0.58, c: ['#f2a03d', '#fff3dc', '#e0782a'] },
    { line: 0, x: at(m0, m1, 1, 6), kind: 'shirt', w: 0.4, h: 0.5, c: ['#7fc3e6', '#4f94c0'] },
    { line: 0, x: at(m0, m1, 2, 6), kind: 'bandana', w: 0.38, h: 0.28, c: ['#d8392f', '#fffaf0'] },
    { line: 0, x: at(m0, m1, 3, 6), kind: 'towel', w: 0.34, h: 0.44, c: ['#fffaf0', '#4f8fd1', '#dfe8ef'] },
    { line: 0, x: at(m0, m1, 4, 6), kind: 'pillow', w: 0.46, h: 0.32, c: ['#f7c6d4', '#fffaf0', '#7fbf8a'] },
    { line: 0, x: at(m0, m1, 5, 6), kind: 'dish', w: 0.28, h: 0.4, c: ['#fffaf0', '#d84a3a'] },
    { line: 0, x: (CP.x + 0.95 + xb - 0.25) / 2, kind: 'dish', w: 0.28, h: 0.36, c: ['#ffe9a8', '#e0782a'] },
    { line: 1, x: at(n0, n1, 0, 5), kind: 'towel', w: 0.6, h: 0.6, c: ['#3fa8a8', '#fffaf0', '#2f8a8c'] },
    { line: 1, x: at(n0, n1, 1, 5), kind: 'shorts', w: 0.42, h: 0.42, c: ['#4f6f9f', '#3d5a85'] },
    { line: 1, x: at(n0, n1, 2, 5), kind: 'towel', w: 0.5, h: 0.56, c: ['#b49ad8', '#fffaf0', '#9a7fc4'] },
    { line: 1, x: at(n0, n1, 3, 5), kind: 'shirt', w: 0.4, h: 0.48, c: ['#f28ca2', '#d96a85'] },
    { line: 1, x: at(n0, n1, 4, 5), kind: 'dish', w: 0.28, h: 0.38, c: ['#fffaf0', '#7fbf8a'] },
    { line: 1, x: CP.x - 0.15, kind: 'sheet', w: 1.3, h: 0.72, c: ['#fffaf0', '#cfe6f2'] },
    { line: 1, x: Math.min(xb - 0.45, CP.x + 1.2), kind: 'pillow', w: 0.46, h: 0.34, c: ['#bfe6d0', '#fffaf0', '#f2c230'] },
    { line: 2, x: at(s0, s1, 0, 5), kind: 'shirt', w: 0.42, h: 0.48, c: ['#ffd15c', '#e0a92e'] },
    { line: 2, x: at(s0, s1, 1, 5), kind: 'dish', w: 0.26, h: 0.3, c: ['#bfe6d0', '#fffaf0'] },
    { line: 2, x: at(s0, s1, 2, 5), kind: 'towel', w: 0.46, h: 0.5, c: ['#e8708a', '#fffaf0', '#c9506c'] },
    { line: 2, x: at(s0, s1, 3, 5), kind: 'bandana', w: 0.38, h: 0.28, c: ['#3f8fd1', '#fffaf0'] },
    { line: 2, x: at(s0, s1, 4, 5), kind: 'shorts', w: 0.4, h: 0.4, c: ['#7fbf8a', '#5f9f6c'] },
    { line: 2, x: xb - 0.55, kind: 'dish', w: 0.26, h: 0.32, c: ['#fffaf0', '#3f8fd1'] },
  ];
  /** As partes de uma roupa (panos e pregadores), com o meio dela em x = dx no pivô. */
  const garment = (it, seed, dx) => {
    const Rg = rng(seed);
    const c = it.c.map((h) => new THREE.Color(h));
    const list = [];
    let pins = [-it.w / 2 + 0.035, it.w / 2 - 0.035];
    if (it.kind === 'towel') {
      list.push([clothGeo(it.w, it.h, 5, 12, (u, v) => (v > 0.92 ? c[2] : (v > 0.083 && v < 0.167) || (v > 0.833 && v < 0.917) ? c[1] : c[0]), { seed }), { color: null }]);
    } else if (it.kind === 'sheet') {
      list.push([clothGeo(it.w, it.h, 12, 10, (u, v) => (v > 0.9 ? c[1] : c[0]), { seed, amp: 0.016, waves: 3.5 }), { color: null }]);
      pins = [-it.w / 2 + 0.05, 0, it.w / 2 - 0.05];
    } else if (it.kind === 'shirt') {
      const Wt = it.w + 0.22;
      const keepFn = (u, v) => Math.abs(u - 0.5) * Wt < it.w / 2 || v < 0.3;
      list.push([clothGeo(Wt, it.h, 10, 10, (u, v) => (Math.abs(u - 0.5) * Wt < 0.07 && v < 0.1 ? c[1] : c[0]), { keep: keepFn, seed }), { color: null }]);
      pins = [-it.w / 2 + 0.04, it.w / 2 - 0.04];
    } else if (it.kind === 'bandana') {
      list.push([clothGeo(it.w, it.h, 8, 6, (u, v, i, j) => (hash(i, j, seed) < 0.25 ? c[1] : c[0]), { amp: 0.008, keep: (u, v) => Math.abs(u - 0.5) < 0.5 * (1 - v) + 0.07 }), { color: null }]);
    } else if (it.kind === 'pillow') {
      list.push([clothGeo(it.w, it.h, 6, 5, (u, v, i, j) => { const h = hash(i, j, seed); return h < 0.18 ? c[1] : h < 0.3 ? c[2] : c[0]; }, { seed }), { color: null }]);
    } else if (it.kind === 'dish') {
      list.push([clothGeo(it.w, it.h, 4, 8, (u, v) => (v > 0.9 || (v > 0.62 && v < 0.75) ? c[1] : c[0]), { amp: 0.008, seed }), { color: null }]);
    } else {
      list.push([clothGeo(it.w, it.h, 6, 7, (u, v) => (v < 0.12 ? c[1] : c[0]), { keep: (u, v) => v < 0.55 || Math.abs(u - 0.5) > 0.1, seed }), { color: null }]);
    }
    for (const part of list) { part[1].y = -0.004; part[1].x = dx; }
    for (const x of pins) list.push([pinGeo, { color: PINS[Math.floor(Rg() * PINS.length)], x: dx + x, y: -0.036 }]);
    return list;
  };
  // os pivôs: as roupas do mesmo fio, de duas em duas (vizinhas)
  const clusters = [];
  ITEMS.forEach((it, i) => {
    const last = clusters[clusters.length - 1];
    if (last && last.line === it.line && last.items.length < 2 && it.x - last.items[0].it.x < 1.3) last.items.push({ it, i });
    else clusters.push({ line: it.line, items: [{ it, i }] });
  });
  const items = clusters.map((cl, ci) => {
    const px = cl.items.reduce((s, e) => s + e.it.x, 0) / cl.items.length;
    const pivot = new THREE.Group();
    pivot.name = `recanto:varal:roupas-${ci + 1}`;
    const u = (px - xa) / span, ln = LINES[cl.line];
    pivot.position.set(px, lineY(ln, u), ln.z);
    const parts = cl.items.flatMap((e) => garment(e.it, 31 + e.i * 7, e.it.x - px));
    pivot.add(mesh(bake(parts), clothMat(), { name: `recanto:varal:roupas-${ci + 1}:pano` }));
    group.add(pivot);
    const light = cl.items.every((e) => e.it.kind === 'bandana' || e.it.kind === 'dish');
    return { pivot, u, ln, ph: ci * 1.37, stiff: light ? 1.3 : cl.items.some((e) => e.it.kind === 'sheet') ? 0.7 : 1 };
  });

  // o pregador de madeira do ponto da cenoura (a cenoura é do puzzle, presa em CARROT_PIN): duas pernas que abrem
  // na mola; setPin(1) o faz pular do fio e cair deitado no chão, ao lado do cesto
  const pin = new THREE.Group();
  pin.name = 'recanto:varal:pregador-da-cenoura';
  const prongGeo = bake([[slab(0.011, 0.076, 0.008), { color: '#d9b98f', y: -0.046 }], [slab(0.012, 0.01, 0.009), { color: '#c4a173', y: 0.016 }]]);
  const prongA = mesh(prongGeo, SLOTS.solid(), { name: 'recanto:varal:pregador:perna-a' });
  const prongB = mesh(prongGeo, SLOTS.solid(), { name: 'recanto:varal:pregador:perna-b' });
  prongA.position.z = -0.0055;
  prongB.position.z = 0.0055;
  const spring = mesh(bake([[new THREE.TorusGeometry(0.0078, 0.0021, 5, 10).rotateY(Math.PI / 2), { color: '#c9ced3' }]]), SLOTS.glass(), { name: 'recanto:varal:pregador:mola' });
  const anchor = new THREE.Object3D();
  anchor.name = 'recanto:varal:ponto-da-cenoura';
  anchor.position.set(0, -0.046, 0);
  pin.add(prongA, prongB, spring, anchor);
  group.add(pin);
  const uCP = (CP.x - xa) / span;
  const P1 = V(CP.x + 0.36, FLOOR + 0.011, CP.z + 0.4); // onde ele cai, deitado (fora do cesto)
  function placePin() {
    const o = S.pin, u = clamp01((o - 0.22) / 0.78);
    const jaw = o < 0.22 ? 0.06 + 0.4 * smooth(o / 0.22) : 0.46 * (1 - smooth(u / 0.35));
    prongA.rotation.x = jaw;
    prongB.rotation.x = -jaw;
    const y0 = lineY(LINES[0], uCP) + 0.03;
    if (u <= 0) {
      pin.position.set(CP.x, y0, CP.z);
      pin.rotation.set(0, 0, 0);
    } else {
      pin.position.set(CP.x + (P1.x - CP.x) * u, y0 + (P1.y - y0) * u * u + 0.3 * Math.sin(Math.PI * u) * (1 - u * 0.2), CP.z + (P1.z - CP.z) * u);
      pin.rotation.set(u * (TAU + Math.PI / 2), 0, u * (Math.PI / 2));
    }
  }

  const a = new THREE.Vector3(), b = new THREE.Vector3(), mid = new THREE.Vector3(), dir = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4();
  function place() {
    LINES.forEach((ln, li) => {
      for (let j = 0; j < SEG; j++) {
        const u0 = j / SEG, u1 = (j + 1) / SEG;
        a.set(xa + span * u0, lineY(ln, u0), ln.z);
        b.set(xa + span * u1, lineY(ln, u1), ln.z);
        mid.addVectors(a, b).multiplyScalar(0.5);
        dir.subVectors(b, a);
        const len = dir.length();
        q.setFromUnitVectors(Y, dir.divideScalar(len));
        fios.setMatrixAt(li * SEG + j, m4.compose(mid, q, sc.set(1, len, 1)));
      }
    });
    fios.instanceMatrix.needsUpdate = true;
    const t = S.t;
    for (const it of items) {
      it.pivot.position.y = lineY(it.ln, it.u);
      // a brisa (o vento sul empurra a barra das roupas para o norte) e o sacolejo da arrancada
      const wind = 0.05 + 0.06 * Math.sin(t * 1.1 + it.ph) + 0.025 * Math.sin(t * 2.6 + it.ph * 1.7);
      const shake = S.amp * it.ln.k * 0.5 * Math.sin(t * 9.5 + it.ph);
      it.pivot.rotation.x = (wind + shake) * it.stiff;
      it.pivot.rotation.z = 0.02 * Math.sin(t * 0.8 + it.ph) * it.stiff + S.amp * 0.05 * Math.sin(t * 7 + it.ph * 2);
    }
    placePin();
  }
  place();
  anim.push((dt, t) => {
    S.t = t;
    // quem chama a cada quadro manda na força (a envoltória do puzzle); chamado uma vez, morre sozinho em ~1,5 s
    S.amp = S.drive >= 0 ? S.drive : S.amp * Math.exp(-dt * 2.2);
    S.drive = -1;
    // o pregador voa até a abertura pedida (~0,6 s do fio ao chão)
    if (S.pin < S.pinTo) S.pin = Math.min(S.pinTo, S.pin + dt * 1.6);
    place();
  });
  const prop = {
    object: group,
    /** O pregador da cenoura e o ponto entre as pernas dele (para o puzzle prender a cenoura, se quiser). */
    pin,
    anchor,
    /** k (0..1): a força do sacolejo neste quadro; 0 para na hora; sem chamadas, o balanço morre sozinho. */
    shake(k) {
      S.drive = clamp01(k);
      if (S.drive <= 0) S.amp = 0;
    },
    /**
     * 0: o pregador fechado no fio; 1: abriu, pulou e está deitado no chão, ao lado de CARROT_PIN. Subindo, ele faz o
     * caminho (abre, salta e cai) nos quadros seguintes; voltando (reset), vai na hora.
     */
    setPin(open) {
      S.pinTo = clamp01(open);
      if (S.pinTo < S.pin) S.pin = S.pinTo;
      placePin();
    },
  };
  return {
    prop,
    reset() {
      S.amp = 0;
      S.drive = -1;
      S.pin = 0;
      S.pinTo = 0;
      place();
    },
  };
}

// ================================================================ O CESTO DE ROUPA (props.laundry)
/**
 * O cesto de vime com as roupas dobradas (a caixa de empurrar do puzzle: o colisor é dele). Origem no chão, no centro;
 * cabe na caixa de LAUNDRY (meia medida `half`, altura `height`).
 */
function buildLaundry({ L, keep }) {
  const C = L.LAUNDRY;
  const group = new THREE.Group();
  group.name = 'recanto:cesto-de-roupa';
  keep(group);
  const w = C.half * 2 - 0.02, d = C.half * 2 - 0.1, h = Math.min(0.4, C.height - 0.06), y0 = FLOOR + 0.004;
  // o corpo: uma superelipse (cantos redondos) que abre para cima; o trançado são quadradinhos de dois tons, um sim,
  // um não para fora (o relevo do vime), com o lado de dentro mais escuro
  const N = 36, M = 8;
  const ringAt = (k, push) => {
    const s = 0.84 + 0.16 * k, pts = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const r = 1 / Math.pow(Math.pow(Math.abs(ca), 4) + Math.pow(Math.abs(sa), 4), 0.25);
      pts.push([ca * (r * (w / 2) * s + push), y0 + k * h, sa * (r * (d / 2) * s + push)]);
    }
    return pts;
  };
  const wick = ['#c9965a', '#ad7d44', '#d6a66a'].map((c) => new THREE.Color(c)), inside = new THREE.Color('#7d5a34');
  const pos = [], col = [];
  const quad = (p0, p1, p2, p3, c) => {
    pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const out = (i + j) % 2 ? 0.005 : 0;
      const lo = ringAt(j / M, out), hi = ringAt((j + 1) / M, out);
      quad(lo[i + 1], lo[i], hi[i], hi[i + 1], wick[(i + j) % 2 ? 0 : i % 3 === 0 ? 2 : 1]);
    }
  }
  const lo0 = ringAt(0, -0.004), hi0 = ringAt(1, -0.004);
  for (let i = 0; i < N; i++) quad(lo0[i], lo0[i + 1], hi0[i + 1], hi0[i], inside);
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  body.computeVertexNormals();
  // a borda trançada, a base e as alças
  const top = ringAt(1, 0.004);
  const rimCurve = new THREE.CatmullRomCurve3(top.slice(0, N).map(([x, y, z]) => V(x, y, z)), true);
  const braid = [new THREE.Color('#e0b57a'), new THREE.Color('#b98a4e')];
  const rim = faceColors(new THREE.TubeGeometry(rimCurve, 72, 0.019, 6, true), (p) => braid[Math.floor((Math.atan2(p.z, p.x) + Math.PI) / (TAU / 36)) % 2]);
  const foot = faceColors(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringAt(0.03, 0.006).slice(0, N).map(([x, y, z]) => V(x, y, z)), true), 48, 0.012, 5, true), () => braid[1]);
  const handle = new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI).rotateY(Math.PI / 2);
  // as roupas dobradas lá dentro (a pilha fica abaixo da altura do colisor) e a toalha caindo pela beira do sul
  const Rb = rng(8);
  const folded = ['#f2a7a0', '#5f8fc4', '#f4efe4', '#f2b636', '#7fb069', '#b49ad8'];
  const clothes = folded.map((c, i) => {
    const lw = 0.2 + Rb() * 0.07, ld = 0.17 + Rb() * 0.05, col2 = i % 2 ? -1 : 1, row2 = Math.floor(i / 2);
    return [rb(lw, 0.05, ld, 0.02, 1), { color: c, x: col2 * 0.12 + (Rb() - 0.5) * 0.03, y: y0 + h - 0.1 + row2 * 0.045, z: (row2 - 1) * 0.07 + (Rb() - 0.5) * 0.03, ry: (Rb() - 0.5) * 0.5 }];
  });
  const towelC = [new THREE.Color('#3f9e95'), new THREE.Color('#fffaf0')];
  const geo = bake([
    [body, { color: null }],
    [rim, { color: null }],
    [foot, { color: null }],
    [new THREE.CircleGeometry(Math.min(w, d) * 0.4, 16).rotateX(-Math.PI / 2), { color: '#7d5a34', y: y0 + 0.012, sx: w / d }],
    ...[-1, 1].map((s) => [handle, { color: '#e0b57a', x: s * (w / 2 + 0.004), y: y0 + h - 0.01 }]),
    ...clothes,
    [clothGeo(0.2, 0.2, 4, 5, (u, v) => (v > 0.82 ? towelC[1] : towelC[0]), { amp: 0.008, waves: 1.5 }), { color: null, x: 0.05, y: y0 + h + 0.016, z: d / 2 + 0.024, rx: 0.1 }],
    [rb(0.2, 0.03, 0.1, 0.012, 1), { color: '#3f9e95', x: 0.05, y: y0 + h + 0.004, z: d / 2 - 0.05 }],
  ]);
  group.add(mesh(geo, clothMat(), { name: 'recanto:cesto-de-roupa:vime' }));
  const setPos = (x, z) => { group.position.set(x, 0, z); };
  setPos(C.start.x, C.start.z);
  return {
    prop: { object: group, setPos },
    reset() { setPos(C.start.x, C.start.z); },
  };
}

// ================================================================ TORRE
function buildTower({ kit, L, anim, drips, keep }) {
  const g = 'torre';
  const add = (geo, o) => kit.add(geo, { group: g, ...o });
  const T = L.TOWER, D = L.TOWER_DOOR, TK = T.tank, LB = L.TOWER_LOBBY, HT = L.TERRACE.hut, GAS = L.TOWER_GAS || null;
  const wt = L.WALLS.t;                                  // a espessura dos colisores 'torre-*'
  const wzIn = L.WALL.minZ + L.WALL.t / 2;               // a face de dentro do muro do condomínio
  const x0 = T.x0 - wt / 2, x1 = T.x1 + wt / 2;          // as faces de fora: oeste e leste
  const z1 = T.z1 + wt / 2;                              // a face sul
  const z0 = L.WALL.minZ - L.WALL.t / 2 - 0.01;          // a face norte (por fora do muro do condomínio)
  const zn = wzIn + 0.05;                                // a face de dentro da parede norte
  const xi = x0 + wt, zi = z1 - wt, xe = x1 - wt;        // as faces de dentro: oeste, sul e leste
  const WH = T.h - 0.145, TOP = T.h;                     // as paredes vão até a laje; o piso do terraço
  const DADO = 1.02;                                     // o alto do barrado (cobre as patinhas pintadas)
  const facade = speckle('#f1dfc4', 0.035, 11), dado = speckle('#d9a87c', 0.04, 14);
  const inner = speckle('#f1e9da', 0.03, 12), innerLow = speckle('#8fbcb2', 0.03, 16);
  const trim = '#fbf6ec', teal = '#3f7f86', iron = '#5d6368';
  const dz0 = D.hinge.z, dz1 = D.latchPost.z, dzc = (dz0 + dz1) / 2;

  // ---------- as paredes (em cima dos colisores): o barrado embaixo, o reboco em cima; por dentro, a mesma divisão
  const wall = (ax, bx, az, bz, y0, y1, dx, dz) => {
    const part = (ya, yb, out, ins, ao) => add(rb(bx - ax, yb - ya, bz - az, 0.012, 1), { color: twoTone(out, ins, dx, dz), x: (ax + bx) / 2, y: ya, z: (az + bz) / 2, ao });
    if (y0 < DADO - 0.01 && y1 > DADO + 0.01) {
      part(y0, DADO, dado, innerLow, true);
      part(DADO, y1, facade, inner, false);
    } else part(y0, y1, facade, inner, false);
  };
  wall(x0, x1, z0, zn, 0, WH, 0, 1);
  wall(x0, x1, zi, z1, 0, WH, 0, -1);
  wall(x0, xi, zn, dz0, 0, WH, 1, 0);
  wall(x0, xi, dz1, zi, 0, WH, 1, 0);
  wall(xe, x1, zn, zi, 0, WH, -1, 0);
  wall(x0, xi, dz0, dz1, D.h + 0.05, WH, 1, 0);
  // o rodapé (2 cm para fora) e o friso do barrado; na parede do interfone, ao sul da porta, só o rodapé (as patinhas
  // pintadas ficam rentes ao reboco)
  const base = speckle('#b9946c', 0.04, 13);
  const skirt = (ax, bx, az, bz) => add(rb(bx - ax, 0.18, bz - az, 0.008, 1), { color: base, x: (ax + bx) / 2, z: (az + bz) / 2 });
  const frieze = (ax, bx, az, bz) => add(rb(bx - ax, 0.036, bz - az, 0.006, 1), { color: trim, x: (ax + bx) / 2, y: DADO - 0.018, z: (az + bz) / 2, ao: false });
  skirt(x0 - 0.02, x1 + 0.02, z1 - 0.004, z1 + 0.02);
  skirt(x1 - 0.004, x1 + 0.02, wzIn, z1 - 0.004);
  skirt(x0 - 0.02, x0 + 0.004, wzIn, dz0 - 0.06);
  skirt(x0 - 0.02, x0 + 0.004, dz1 + 0.06, z1 - 0.004);
  skirt(x0 - 0.02, x1 + 0.02, z0 - 0.02, z0 + 0.004);
  frieze(x0 + 0.21, x1 - 0.21, z1 - 0.002, z1 + 0.012);
  frieze(x1 - 0.002, x1 + 0.012, wzIn, z1 - 0.21);
  frieze(x0 - 0.012, x0 + 0.002, wzIn, dz0 - 0.07);
  frieze(x0 + 0.21, x1 - 0.21, z0 - 0.012, z0 + 0.002);
  // os cunhais (as quinas de fora, de reboco claro): cobrem as emendas das paredes
  const quoin = (qx, qz, dirX, outZ, dirZ, outX) => {
    const ax = Math.min(qx + outX * 0.014, qx + dirX * 0.21), bx = Math.max(qx + outX * 0.014, qx + dirX * 0.21);
    const az = Math.min(qz - outZ * 0.004, qz + outZ * 0.014), bz = Math.max(qz - outZ * 0.004, qz + outZ * 0.014);
    add(rb(bx - ax, WH, bz - az, 0.006, 1), { color: trim, x: (ax + bx) / 2, z: (az + bz) / 2 });
    const cx0 = Math.min(qx - outX * 0.004, qx + outX * 0.014), cx1 = Math.max(qx - outX * 0.004, qx + outX * 0.014);
    const cz0 = Math.min(qz + outZ * 0.014, qz + dirZ * 0.21), cz1 = Math.max(qz + outZ * 0.014, qz + dirZ * 0.21);
    add(rb(cx1 - cx0, WH, cz1 - cz0, 0.006, 1), { color: trim, x: (cx0 + cx1) / 2, z: (cz0 + cz1) / 2 });
  };
  quoin(x0, z1, 1, 1, -1, -1);
  quoin(x1, z1, -1, 1, -1, 1);
  quoin(x1, z0, -1, -1, 1, 1);
  quoin(x0, z0, 1, -1, 1, -1);

  // ---------- a porta de mola: o batente (6 mm para dentro do vão, por cima da ponta das paredes), a verga e a soleira
  const jw = wt + 0.05;
  add(rb(jw, D.h + 0.06, 0.06, 0.012, 1), { color: trim, x: T.x0, z: dz0 - 0.024 });
  add(rb(jw, D.h + 0.06, 0.06, 0.012, 1), { color: trim, x: T.x0, z: dz1 + 0.024 });
  add(rb(jw, 0.06, dz1 - dz0 + 0.108, 0.012, 1), { color: trim, x: T.x0, y: D.h, z: dzc, ao: false });
  add(slab(wt + 0.02, 0.016, dz1 - dz0 - 0.014), { color: '#cfc4b2', x: T.x0 + 0.01, y: 0.004, z: dzc, ao: false });
  // a sapata da mola aérea, na verga por dentro (o braço está em props.towerDoor), e o gancho da mola aparente no
  // batente do trinco, por fora
  const shoe = doorShoe(L);
  add(rb(0.03, 0.045, 0.08, 0.008, 1), { color: '#c4c8cb', x: shoe.x + 0.002, y: shoe.y - 0.005, z: shoe.z, ao: false });
  const hook = springHook(L);
  add(new THREE.TorusGeometry(0.012, 0.004, 5, 10).rotateY(Math.PI / 2), { color: '#9aa1a6', x: hook.x, y: hook.y, z: hook.z - 0.008, ao: false });
  // o toldinho listrado com as duas mãos-francesas e a arandela acesa embaixo dele
  awningAt(add, { x: x0, y: 2.36, z: dzc, w: 1.5, depth: 0.62, drop: 0.24, colors: [teal, '#fff6e6'], n: 6, ry: -Math.PI / 2 });
  for (const s of [-0.72, 0.72]) add(stick(V(x0 - 0.005, 2.09, dzc + s), V(x0 - 0.56, 2.135, dzc + s), 0.009, 5), { color: iron, ao: false });
  add(slab(0.02, 0.1, 0.1), { color: iron, x: x0 - 0.01, y: 2.1, z: dzc, ao: false });
  add(new THREE.SphereGeometry(0.05, 10, 8), { color: '#fff2c8', slot: 'lit', x: x0 - 0.07, y: 2.15, z: dzc, ao: false });
  // o capacho de fibra com a patinha (piso baixo, por cima do caminho)
  add(slab(0.5, 0.017, 0.78), { color: speckle('#a87a46', 0.06, 15), x: x0 - 0.32, y: 0.005, z: dzc, ao: false });
  const paw = [[-0.07, -0.06, 0.07, 0.07]];
  for (const [ddx, ddz] of [[-0.11, -0.12], [-0.04, -0.16], [0.04, -0.16], [0.11, -0.12]]) paw.push([ddx - 0.028, ddz - 0.03, ddx + 0.028, ddz + 0.03]);
  add(flatQuads(paw.map(([a0, b0, a1, b1]) => [a0, b0, a1, b1, '#5a3418'])), { color: null, slot: 'ground', x: x0 - 0.32, y: 0.0255, z: dzc + 0.04, ry: -Math.PI / 2, ao: false });

  // ---------- a laje (o teto do saguão por baixo), o piso do terraço e as muretas com a capa
  const slabC = new THREE.Color(trim), ceilC = new THREE.Color('#f4efe4');
  add(rb(x1 - x0 + 0.1, 0.14, z1 - z0 + 0.1, 0.03, 1), { color: (p, n) => (n.y < -0.5 ? ceilC : slabC), x: (x0 + x1) / 2, y: WH, z: (z0 + z1) / 2, ao: false });
  const pt = 0.14, PH = T.parapet;
  const tx0 = x0 + pt, tx1 = x1 - pt, tz0 = z0 + pt, tz1 = z1 - pt;
  add(tiles(tx1 - tx0, tz1 - tz0, 0.45, 0.45, cells(['#d8c3a5', '#cfb796', '#dcc8ab', '#c9b08e'], 0.45, 21)), { color: null, slot: 'ground', x: (tx0 + tx1) / 2, y: TOP, z: (tz0 + tz1) / 2, ao: false });
  const parapet = (ax, bx, az, bz, dx, dz) => add(rb(bx - ax, PH, bz - az, 0.02, 1), { color: twoTone(facade, inner, dx, dz), x: (ax + bx) / 2, y: TOP - 0.005, z: (az + bz) / 2 });
  const capTop = (ax, bx, az, bz) => add(rb(bx - ax, 0.045, bz - az, 0.012, 1), { color: trim, x: (ax + bx) / 2, y: TOP + PH - 0.005, z: (az + bz) / 2, ao: false });
  parapet(x0, x1, tz1, z1, 0, -1);
  parapet(x0, tx0, z0, tz1, 1, 0);
  parapet(tx0, TK.x0, z0, tz0, 0, 1);
  parapet(tx1, x1, TK.z1, tz1, -1, 0);
  capTop(x0 - 0.03, x1 + 0.03, tz1 - 0.03, z1 + 0.03);
  capTop(x0 - 0.03, tx0 + 0.03, z0 - 0.03, tz1 - 0.03);
  capTop(tx0 + 0.03, TK.x0, z0 - 0.03, tz0 + 0.03);
  capTop(tx1 - 0.03, x1 + 0.03, TK.z1, tz1 - 0.03);

  // ---------- a caixa d'água (o alto em TOWER.tank.h fica livre perto de TERRACE.pigeons): a gota de azulejo nas
  // faces do sul e do oeste, o alçapão, o respiro e a ESCADA DE MARINHEIRO com o guarda-corpo
  const kx0 = TK.x0, kz1 = TK.z1, kxc = (kx0 + x1) / 2, kzc = (z0 + kz1) / 2;
  add(rb(x1 - kx0, TK.h - 0.08 - (TOP - 0.005), kz1 - z0, 0.025, 1), { color: facade, x: kxc, y: TOP - 0.005, z: kzc });
  add(rb(x1 - kx0 + 0.06, 0.08, kz1 - z0 + 0.06, 0.015, 1), { color: trim, x: kxc, y: TK.h - 0.08, z: kzc, ao: false });
  add(slab(x1 - kx0 + 0.012, 0.1, kz1 - z0 + 0.012), { color: '#e2cba9', x: kxc, y: TK.h - 0.5, z: kzc, ao: false });
  const dropS = new THREE.Shape();
  dropS.moveTo(0, 0.32);
  dropS.bezierCurveTo(0.05, 0.17, 0.2, 0.04, 0.2, -0.1);
  dropS.absarc(0, -0.1, 0.2, 0, Math.PI, true);
  dropS.bezierCurveTo(-0.2, 0.04, -0.05, 0.17, 0, 0.32);
  const dropGeo = new THREE.ShapeGeometry(dropS, 8), shineGeo = new THREE.CircleGeometry(0.05, 10);
  for (const [x, z, ry] of [[kxc, kz1 + 0.007, 0], [kx0 - 0.007, kzc, -Math.PI / 2]]) {
    const c = Math.cos(ry), s = Math.sin(ry);
    add(dropGeo, { color: '#3f9fd8', x, y: 3.82, z, ry, ao: false });
    add(shineGeo, { color: '#dff3fb', x: x - 0.07 * c + 0.004 * s, y: 3.78, z: z + 0.07 * s + 0.004 * c, ry, sy: 1.5, ao: false });
  }
  const hatch = { x: kx0 + 0.42, z: kz1 - 0.38 };
  add(rb(0.58, 0.05, 0.58, 0.01, 1), { color: '#9aa3a8', x: hatch.x, y: TK.h, z: hatch.z, ao: false });
  add(rb(0.5, 0.025, 0.5, 0.008, 1), { color: '#b8c0c5', x: hatch.x, y: TK.h + 0.05, z: hatch.z, ao: false });
  add(rb(0.12, 0.02, 0.03, 0.006, 1), { color: iron, x: hatch.x, y: TK.h + 0.075, z: hatch.z + 0.2, ao: false });
  add(cyl(0.05, 0.05, 0.16, 10), { color: '#9aa3a8', x: x1 - 0.42, y: TK.h, z: z0 + 0.42, ao: false });
  add(cyl(0.09, 0.07, 0.05, 10), { color: '#b8c0c5', x: x1 - 0.42, y: TK.h + 0.16, z: z0 + 0.42, ao: false });
  const lad = '#8e959a', lz = kz1 + 0.1;
  for (const lxr of [hatch.x - 0.2, hatch.x + 0.2]) {
    add(stick(V(lxr, TOP, lz), V(lxr, TK.h + 0.5, lz), 0.016, 6), { color: lad, ao: false });
    add(stick(V(lxr, TK.h + 0.5, lz), V(lxr, TK.h + 0.5, kz1 - 0.2), 0.014, 5), { color: lad, ao: false });
    add(stick(V(lxr, TK.h + 0.5, kz1 - 0.2), V(lxr, TK.h, kz1 - 0.2), 0.014, 5), { color: lad, ao: false });
    for (const y of [TOP + 0.45, TK.h - 0.2]) add(stick(V(lxr, y, kz1), V(lxr, y, lz), 0.012, 4), { color: lad, ao: false });
  }
  for (let y = TOP + 0.28; y < TK.h + 0.1; y += 0.28) add(stick(V(hatch.x - 0.2, y, lz), V(hatch.x + 0.2, y, lz), 0.012, 5), { color: lad, ao: false });
  // o guarda-corpo (os arcos e as três tiras), do meio da escada para cima
  const hoop = new THREE.TorusGeometry(0.3, 0.009, 4, 12, Math.PI).rotateX(Math.PI / 2);
  for (let y = TOP + 0.95; y < TK.h + 0.45; y += 0.4) add(hoop, { color: lad, x: hatch.x, y, z: lz, ao: false });
  for (const a of [0.5, Math.PI / 2, Math.PI - 0.5]) add(stick(V(hatch.x + Math.cos(a) * 0.3, TOP + 0.95, lz + Math.sin(a) * 0.3), V(hatch.x + Math.cos(a) * 0.3, TK.h + 0.4, lz + Math.sin(a) * 0.3), 0.006, 4), { color: lad, ao: false });
  // o ladrão da caixa pingando no terraço (a mancha na parede e a poça embaixo)
  const ovx = kx0 + 1.7;
  add(stick(V(ovx, 3.25, kz1), V(ovx, 3.25, kz1 + 0.2), 0.022, 8), { color: '#e9e4da', ao: false });
  add(stick(V(ovx, 3.25, kz1 + 0.2), V(ovx, 3.19, kz1 + 0.23), 0.022, 8), { color: '#e9e4da', ao: false });
  add(slab(0.12, 3.22 - TOP, 0.006), { color: '#d2bc9a', x: ovx, y: TOP + 0.01, z: kz1 + 0.001, ao: false });
  add(blob(0.2, 6), { color: '#a99a84', slot: 'glass', x: ovx, y: TOP + 0.0035, z: kz1 + 0.3, sz: 0.7, ao: false });
  drips.push({ x: ovx, z: kz1 + 0.23, y0: 3.17, y1: TOP + 0.004, period: 1.9, phase: 0.9, ripple: false });

  // ---------- a casinha da escada, encostada nas muretas do canto sudoeste. Na cena do terraço as irmãs aparecem do
  // lado de fora da porta dela, a leste (TERRACE.hut + 0,9 m em x): a porta fica na face leste, aberta para dentro
  const hx0 = tx0, hx1 = HT.x + 0.6, hz0 = HT.z - 0.8, hz1 = tz1, HH = 2.15, hw = 0.12;
  const hd0 = HT.z - 0.55, hd1 = HT.z + 0.55, doorH = 1.9;
  const hutWall = (ax, bx, az, bz, y0, y1, dx, dz) => add(rb(bx - ax, y1 - y0, bz - az, 0.015, 1), { color: twoTone(facade, '#4d4844', dx, dz), x: (ax + bx) / 2, y: y0, z: (az + bz) / 2 });
  hutWall(hx0, hx1, hz1 - hw, hz1, TOP, TOP + HH, 0, -1);
  hutWall(hx0, hx1, hz0, hz0 + hw, TOP, TOP + HH, 0, 1);
  hutWall(hx0, hx0 + hw, hz0 + hw, hz1 - hw, TOP, TOP + HH, 1, 0);
  hutWall(hx1 - hw, hx1, hz0 + hw, hd0, TOP, TOP + HH, -1, 0);
  hutWall(hx1 - hw, hx1, hd1, hz1 - hw, TOP, TOP + HH, -1, 0);
  hutWall(hx1 - hw, hx1, hd0, hd1, TOP + doorH, TOP + HH, -1, 0);
  add(rb(hx1 - hx0 + 0.16, 0.1, hz1 - hz0 + 0.16, 0.025, 1), { color: trim, x: (hx0 + hx1) / 2, y: TOP + HH, z: (hz0 + hz1) / 2, ao: false });
  add(new THREE.PlaneGeometry(hx1 - hx0 - 2 * hw, hz1 - hz0 - 2 * hw).rotateX(-Math.PI / 2), { color: '#34302d', slot: 'ground', x: (hx0 + hx1) / 2, y: TOP + 0.005, z: (hz0 + hz1) / 2, ao: false });
  for (const z of [hd0 - 0.03, hd1 + 0.03]) add(slab(0.03, doorH + 0.06, 0.06), { color: trim, x: hx1 + 0.008, y: TOP, z });
  add(slab(0.034, 0.06, hd1 - hd0 + 0.12), { color: trim, x: hx1 + 0.01, y: TOP + doorH, z: (hd0 + hd1) / 2, ao: false });
  const leafW = hd1 - hd0 - 0.04;
  add(rb(leafW, doorH - 0.02, 0.04, 0.01, 1).translate(-leafW / 2, 0, 0), { color: teal, x: hx1 - hw - 0.03, y: TOP + 0.01, z: hd0 + 0.04, ry: 0.1 });
  add(slab(0.02, 0.12, 0.1), { color: iron, x: hx1 + 0.01, y: TOP + doorH + 0.12, z: (hd0 + hd1) / 2, ao: false });
  add(new THREE.SphereGeometry(0.05, 10, 8), { color: '#fff2c8', slot: 'lit', x: hx1 + 0.065, y: TOP + doorH + 0.12, z: (hd0 + hd1) / 2, ao: false });
  // a veneziana do respiro, na face norte, e o corrimão do alto da escada lá dentro
  add(slab(0.3, 0.22, 0.012), { color: '#d6cbb8', x: (hx0 + hx1) / 2, y: TOP + 1.45, z: hz0 - 0.004, ao: false });
  for (let k = 0; k < 4; k++) add(slab(0.26, 0.02, 0.008), { color: '#3a3734', x: (hx0 + hx1) / 2, y: TOP + 1.49 + k * 0.045, z: hz0 - 0.012, ao: false });
  for (const z of [hz0 + hw + 0.5, hz1 - hw - 0.1]) add(stick(V(hx0 + hw + 0.9, TOP, z), V(hx0 + hw + 0.9, TOP + 0.9, z), 0.014, 5), { color: lad, ao: false });
  add(stick(V(hx0 + hw + 0.9, TOP + 0.9, hz0 + hw + 0.5), V(hx0 + hw + 0.9, TOP + 0.9, hz1 - hw - 0.1), 0.014, 5), { color: lad, ao: false });
  // a antena de TV no teto da casinha
  const anx = hx0 + 0.6, anz = hz1 - 0.6, any = TOP + HH + 0.1;
  add(stick(V(anx, any - 0.02, anz), V(anx, any + 1.15, anz), 0.016, 6), { color: lad, ao: false });
  add(stick(V(anx, any + 1.1, anz - 0.42), V(anx, any + 1.1, anz + 0.38), 0.011, 4), { color: lad, ao: false });
  for (let k = 0; k < 6; k++) {
    const zz = anz - 0.36 + k * 0.14, half = 0.28 - k * 0.03;
    add(stick(V(anx - half, any + 1.1, zz), V(anx + half, any + 1.1, zz), 0.006, 4), { color: '#aab1b6', ao: false });
  }

  // ---------- no terraço (longe do caminho das irmãs e dos pontos de câmera da cena): a floreira na mureta oeste, os
  // aparelhos de ar no canto sudeste, o varal de chão, a cadeira de plástico, os vasos, o ralo e as poças da chuva
  const plx0 = tx0, plx1 = tx0 + 0.32, plz0 = tz0 + 0.5, plz1 = hz0 - 0.5, plc = (plz0 + plz1) / 2;
  const plantBox = speckle('#c98d6a', 0.05, 31);
  add(rb(plx1 - plx0, 0.38, plz1 - plz0, 0.03, 1), { color: plantBox, x: (plx0 + plx1) / 2, y: TOP, z: plc });
  add(slab(plx1 - plx0 - 0.06, 0.015, plz1 - plz0 - 0.06), { color: '#4a3424', slot: 'ground', x: (plx0 + plx1) / 2, y: TOP + 0.37, z: plc, ao: false });
  for (const [w, d, x, z] of [[plx1 - plx0, 0.04, (plx0 + plx1) / 2, plz0 + 0.02], [plx1 - plx0, 0.04, (plx0 + plx1) / 2, plz1 - 0.02], [0.04, plz1 - plz0 - 0.08, plx0 + 0.02, plc], [0.04, plz1 - plz0 - 0.08, plx1 - 0.02, plc]]) {
    add(rb(w, 0.08, d, 0.01, 1), { color: '#d9a07d', x, y: TOP + 0.36, z, ao: false });
  }
  const bushes = [flowerBush({ r: 0.15, seed: 31, flower: '#ff6a55', n: 6 }), flowerBush({ r: 0.14, seed: 33, flower: '#ff8fc0', n: 6 }), flowerBush({ r: 0.13, seed: 35, flower: '#fff6ee', n: 5 })];
  const palmS = palm({ h: 0.55, fronds: 6, seed: 9 }), snake = snakePlant({ h: 0.5, n: 7, seed: 4 });
  const nPl = Math.max(4, Math.round((plz1 - plz0) / 0.42));
  for (let k = 0; k < nPl; k++) {
    const z = plz0 + 0.22 + (k * (plz1 - plz0 - 0.44)) / (nPl - 1), x = (plx0 + plx1) / 2;
    if (k % 5 === 2) add(palmS, { color: null, slot: 'plant', x, y: TOP + 0.38, z, ry: k, ao: false });
    else if (k % 5 === 4) add(snake, { color: null, slot: 'plant', x, y: TOP + 0.38, z, ry: k, ao: false });
    else add(bushes[k % 3], { color: null, slot: 'foliage', x, y: TOP + 0.38, z, ry: k * 1.3, ao: false });
  }
  // os aparelhos de ar (descarga para cima: a grelha redonda, as hélices giram em props.terrace)
  const acZ = tz1 - 0.31, acs = [tx1 - 1.9, tx1 - 0.85];
  for (const acx of acs) {
    add(rb(0.62, 0.56, 0.5, 0.03, 1), { color: '#e3e6e8', x: acx, y: TOP + 0.06, z: acZ });
    for (const sx of [-0.25, 0.25]) for (const sz of [-0.18, 0.18]) add(slab(0.06, 0.06, 0.06), { color: lad, x: acx + sx, y: TOP, z: acZ + sz, ao: false });
    for (let k = 0; k < 6; k++) add(slab(0.5, 0.012, 0.006), { color: '#9aa1a6', x: acx, y: TOP + 0.14 + k * 0.06, z: acZ - 0.252, ao: false });
    add(new THREE.CylinderGeometry(0.23, 0.23, 0.07, 18, 1, true), { color: '#c9cdd0', x: acx, y: TOP + 0.655, z: acZ, ao: false });
    add(cyl(0.22, 0.22, 0.004, 18), { color: '#2b2d30', x: acx, y: TOP + 0.62, z: acZ, ao: false });
    for (const rr of [0.11, 0.22]) add(new THREE.TorusGeometry(rr, 0.006, 4, 20).rotateX(Math.PI / 2), { color: '#7d848a', x: acx, y: TOP + 0.69, z: acZ, ao: false });
    for (const ry of [0, Math.PI / 2]) add(slab(0.46, 0.01, 0.012), { color: '#7d848a', x: acx, y: TOP + 0.685, z: acZ, ry, ao: false });
    // a tubulação isolada descendo pela mureta
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(acx - 0.31, TOP + 0.2, acZ), V(acx - 0.4, TOP + 0.1, acZ + 0.08), V(acx - 0.42, TOP + 0.05, acZ + 0.2), V(acx - 0.42, TOP + 0.3, acZ + 0.235)]), 10, 0.018, 6), { color: '#2b2d30', ao: false });
  }
  // o varal de chão encostado na mureta leste, com a toalha (balança em props.terrace) e uma fronha
  const rk = { x: tx1 - 0.35, z: kz1 + 1.35, w: 0.42, d: 1.0, h: 0.95 };
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) add(stick(V(rk.x + sx * (rk.w / 2 + 0.03), TOP, rk.z + sz * (rk.d / 2 + 0.04)), V(rk.x + sx * rk.w / 2, TOP + rk.h, rk.z + sz * rk.d / 2), 0.011, 5), { color: '#f2f2ee', ao: false });
    add(stick(V(rk.x + sx * rk.w / 2, TOP + rk.h, rk.z - rk.d / 2), V(rk.x + sx * rk.w / 2, TOP + rk.h, rk.z + rk.d / 2), 0.011, 5), { color: '#f2f2ee', ao: false });
  }
  for (let k = 1; k < 6; k++) {
    const xx = rk.x - rk.w / 2 + (k * rk.w) / 6;
    add(stick(V(xx, TOP + rk.h, rk.z - rk.d / 2), V(xx, TOP + rk.h, rk.z + rk.d / 2), 0.005, 4), { color: '#e6e6e0', ao: false });
  }
  add(clothGeo(0.36, 0.3, 4, 4, (u, v, i, j) => new THREE.Color(hash(i, j, 3) < 0.2 ? '#fffaf0' : '#f7c6d4'), { amp: 0.008 }), { color: null, slot: 'plant', x: rk.x, y: TOP + rk.h - 0.005, z: rk.z + 0.28, ry: Math.PI / 2, ao: false });
  // a cadeira de plástico branca
  const chair = (cx, cz, ry) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (lx2, lz2) => ({ x: cx + lx2 * c + lz2 * s, z: cz - lx2 * s + lz2 * c });
    const white = '#f4f2ec';
    add(rb(0.44, 0.035, 0.42, 0.04, 1), { color: white, ...at(0, 0.02), y: TOP + 0.42, ry, ao: false });
    add(rb(0.44, 0.42, 0.03, 0.04, 1).rotateX(-0.16), { color: white, ...at(0, -0.19), y: TOP + 0.44, ry, ao: false });
    for (const sx of [-1, 1]) {
      add(rb(0.04, 0.03, 0.36, 0.012, 1), { color: white, ...at(sx * 0.215, 0.0), y: TOP + 0.62, ry, ao: false });
      add(slab(0.03, 0.18, 0.03), { color: white, ...at(sx * 0.215, 0.16), y: TOP + 0.45, ry, ao: false });
      for (const sz of [-1, 1]) {
        const p0 = at(sx * 0.19, sz * 0.18), p1 = at(sx * 0.23, sz * 0.22);
        add(stick(V(p0.x, TOP + 0.43, p0.z), V(p1.x, TOP, p1.z), 0.02, 6), { color: white, ao: false });
      }
    }
  };
  chair(tx1 - 1.4, tz1 - 1.5, 2.4);
  potAt(add, { x: hx1 + 1.25, z: tz1 - 0.17, y: TOP, r: 0.12, h: 0.3, color: '#c46a43', plant: snakePlant({ h: 0.6, n: 9, seed: 7 }) });
  potAt(add, { x: hx1 + 1.65, z: tz1 - 0.16, y: TOP, r: 0.11, h: 0.26, color: '#b5583a', plant: bushes[1], plantSlot: 'foliage' });
  potAt(add, { x: kx0 - 0.45, z: tz0 + 0.35, y: TOP, r: 0.2, h: 0.42, color: '#9a8f86', plant: flowerBush({ r: 0.26, seed: 44, flower: '#f6f0e6', n: 6 }), plantSlot: 'foliage' });
  add(grate(0.16, 3), { color: null, slot: 'ground', x: kx0 + 0.6, y: TOP + 0.003, z: kz1 + 1.9, ao: false });
  add(blob(0.24, 8), { color: '#b9a88e', slot: 'glass', x: kx0 + 0.3, y: TOP + 0.0055, z: kz1 + 1.7, sz: 0.6, ao: false });
  add(blob(0.16, 11), { color: '#b9a88e', slot: 'glass', x: hx1 + 0.9, y: TOP + 0.0035, z: tz0 + 1.3, sz: 0.7, ao: false });

  // ---------- as fachadas: janelinhas com grade (a do saguão acesa), as floreiras, o medidor, os canos e as luzes
  const winY = 1.62, bars = '#3a3f44';
  const southWins = [x0 + 1.3, x0 + 3.95, x0 + 6.45];
  southWins.forEach((wx, i) => {
    const w = i ? 0.9 : 0.8;
    windowAt(kit, { x: wx, y: winY, z: z1, w, h: 0.8, nx: 0, nz: 1, lit: i === 0, group: g });
    for (let k = 0; k < 5; k++) add(stick(V(wx - w / 2 + 0.05 + (k * (w - 0.1)) / 4, winY - 0.42, z1 + 0.1), V(wx - w / 2 + 0.05 + (k * (w - 0.1)) / 4, winY + 0.42, z1 + 0.1), 0.008, 4), { color: bars, ao: false });
    if (!i) return;
    // a floreira embaixo do peitoril (acima da cabeça das dogs)
    add(rb(0.86, 0.15, 0.17, 0.025, 1), { color: speckle('#c46a43', 0.05, 40 + i), x: wx, y: 0.88, z: z1 + 0.2 });
    for (const sx of [-0.3, 0.3]) add(beam(V(wx + sx, 0.8, z1 + 0.01), V(wx + sx, 0.89, z1 + 0.2), 0.02, 0.02), { color: iron, ao: false });
    add(slab(0.8, 0.01, 0.12), { color: '#4a3424', slot: 'ground', x: wx, y: 1.022, z: z1 + 0.2, ao: false });
    for (let k = 0; k < 3; k++) add(flowerBush({ r: 0.11, seed: 50 + i * 3 + k, flower: ['#ff6a55', '#f2c230', '#ff8fc0'][(k + i) % 3], n: 5 }), { color: null, slot: 'foliage', x: wx - 0.26 + k * 0.26, y: 1.025, z: z1 + 0.2, ao: false });
  });
  for (const wz2 of [z1 - 1.6, z1 - 3.4]) {
    windowAt(kit, { x: x1, y: winY, z: wz2, w: 0.8, h: 0.8, nx: 1, nz: 0, group: g });
    for (let k = 0; k < 4; k++) add(stick(V(x1 + 0.1, winY - 0.42, wz2 - 0.3 + k * 0.2), V(x1 + 0.1, winY + 0.42, wz2 - 0.3 + k * 0.2), 0.008, 4), { color: bars, ao: false });
  }
  for (const wx of [x0 + 2.2, x0 + 5.2]) windowAt(kit, { x: wx, y: winY, z: z0, w: 0.8, h: 0.7, nx: 0, nz: -1, group: g });
  // a janelinha alta do quartinho do zelador, na fachada oeste
  const wwz = dz0 - 1.9;
  windowAt(kit, { x: x0, y: 1.86, z: wwz, w: 0.7, h: 0.45, nx: -1, nz: 0, group: g });
  for (let k = 0; k < 4; k++) add(stick(V(x0 - 0.1, 1.62, wwz - 0.27 + k * 0.18), V(x0 - 0.1, 2.1, wwz - 0.27 + k * 0.18), 0.008, 4), { color: bars, ao: false });
  // o condutor da calha na fachada oeste (rente à parede: 5 cm) com o funil, as braçadeiras e a pedra do pé
  const dpz = dz0 - 0.95, dpx = x0 - 0.028;
  add(stick(V(dpx, 0.06, dpz), V(dpx, WH + 0.02, dpz), 0.024, 8), { color: '#e9e4da', ao: false });
  add(cyl(0.05, 0.03, 0.1, 8), { color: '#e9e4da', x: dpx - 0.01, y: WH - 0.02, z: dpz, ao: false });
  for (const y of [0.55, 1.4, 2.2]) add(slab(0.012, 0.03, 0.07), { color: '#9aa1a6', x: dpx - 0.02, y, z: dpz, ao: false });
  add(rb(0.3, 0.03, 0.36, 0.01, 1), { color: speckle('#bdb6aa', 0.05, 33), x: x0 - 0.16, y: 0, z: dpz, ao: false });
  add(blob(0.12, 14), { color: '#8a857c', slot: 'glass', x: x0 - 0.17, y: 0.0335, z: dpz, ao: false });
  // outro condutor no canto da fachada sul
  const dqx = x1 - 0.42, dqz = z1 + 0.028;
  add(stick(V(dqx, 0.06, dqz), V(dqx, WH + 0.02, dqz), 0.024, 8), { color: '#e9e4da', ao: false });
  add(cyl(0.05, 0.03, 0.1, 8), { color: '#e9e4da', x: dqx, y: WH - 0.02, z: dqz + 0.01, ao: false });
  for (const y of [0.55, 1.4, 2.2]) add(slab(0.07, 0.03, 0.012), { color: '#9aa1a6', x: dqx, y, z: dqz + 0.02, ao: false });
  // o buzinote da laje na fachada leste (a água da chuva da noite ainda pinga): a mancha escorrida na parede e a
  // poça na grama, embaixo (nada em pé onde as dogs andam)
  const bz2 = z1 - 2.5;
  add(stick(V(x1 - 0.02, TOP + 0.03, bz2), V(x1 + 0.2, TOP + 0.01, bz2), 0.03, 8), { color: '#9aa1a6', ao: false });
  add(slab(0.006, WH - 0.22, 0.09), { color: '#dcc7a6', x: x1 + 0.0035, y: 0.2, z: bz2, ao: false });
  add(blob(0.22, 12), { color: '#5f7a4a', slot: 'glass', x: x1 + 0.3, y: 0.004, z: bz2, sz: 0.7, ao: false });
  drips.push({ x: x1 + 0.2, z: bz2, y0: TOP - 0.01, y1: 0.004, period: 2.8, phase: 1.1, ripple: false });
  // a subida da caixa d'água pela fachada leste, com o registro vermelho
  const tpz = wzIn + 0.55, tpx = x1 + 0.03;
  add(stick(V(tpx, 0.5, tpz), V(tpx, TK.h - 0.3, tpz), 0.022, 8), { color: '#3f8fd1', ao: false });
  add(stick(V(tpx, 0.5, tpz), V(x1 - 0.01, 0.5, tpz), 0.022, 6), { color: '#3f8fd1', ao: false });
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 8), { color: '#c9a04e', x: tpx, y: 1.2, z: tpz, ao: false });
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 10).rotateZ(Math.PI / 2), { color: '#d63a32', x: tpx + 0.06, y: 1.2, z: tpz, ao: false });
  for (const y of [0.9, 1.9, 2.9, 3.8]) add(slab(0.012, 0.03, 0.07), { color: '#9aa1a6', x: tpx + 0.018, y, z: tpz, ao: false });
  // o medidor de luz na fachada sul, com o eletroduto subindo, e a arandela
  const mtx = x0 + 5.2;
  add(rb(0.3, 0.42, 0.12, 0.015, 1), { color: '#b9bec2', x: mtx, y: 1.08, z: z1 + 0.06 });
  add(slab(0.16, 0.11, 0.008), { color: '#cfe4ee', slot: 'glass', x: mtx, y: 1.3, z: z1 + 0.122, ao: false });
  add(stick(V(mtx, 1.5, z1 + 0.04), V(mtx, WH, z1 + 0.04), 0.015, 6), { color: '#9aa1a6', ao: false });
  const slx = x0 + 2.65;
  add(slab(0.1, 0.16, 0.02), { color: iron, x: slx, y: 2.02, z: z1 + 0.01, ao: false });
  add(stick(V(slx, 2.1, z1 + 0.02), V(slx, 2.14, z1 + 0.1), 0.01, 5), { color: iron, ao: false });
  add(new THREE.SphereGeometry(0.06, 10, 8), { color: '#fff2c8', slot: 'lit', x: slx, y: 2.1, z: z1 + 0.12, ao: false });
  add(new THREE.ConeGeometry(0.08, 0.06, 10), { color: iron, x: slx, y: 2.18, z: z1 + 0.12, ao: false });

  // ---------- o abrigo do gás (só com o colisor do layout: TOWER_GAS), na fachada oeste, ao norte da porta: a
  // sapata, os dois botijões altos presos pela corrente e a cobertura de chapa
  if (GAS) {
    const gw = GAS.hx * 2 - 0.04, gd = GAS.hz * 2 - 0.04;
    add(rb(gw, 0.05, gd, 0.012, 1), { color: speckle('#bdb6aa', 0.05, 37), x: GAS.x, y: 0, z: GAS.z });
    for (const s of [-1, 1]) {
      const cz2 = GAS.z + s * gd * 0.24, cr = Math.min(0.17, gw / 2 - 0.04);
      add(cyl(cr, cr, 1.0, 16), { color: speckle('#aab4ba', 0.03, 41 + s), x: GAS.x + 0.02, y: 0.05, z: cz2 });
      add(new THREE.SphereGeometry(cr, 16, 6, 0, TAU, 0, Math.PI / 2), { color: '#aab4ba', x: GAS.x + 0.02, y: 1.05, z: cz2, sy: 0.6, ao: false });
      add(new THREE.TorusGeometry(cr * 0.62, 0.012, 5, 14).rotateX(Math.PI / 2), { color: '#8e959a', x: GAS.x + 0.02, y: 1.16, z: cz2, ao: false });
      add(cyl(0.025, 0.03, 0.07, 8), { color: '#c9a04e', x: GAS.x + 0.02, y: 1.1, z: cz2, ao: false });
      add(new THREE.TorusGeometry(cr + 0.004, 0.01, 4, 16).rotateX(Math.PI / 2), { color: '#f2c230', x: GAS.x + 0.02, y: 0.75, z: cz2, ao: false });
    }
    for (const sz of [-1, 1]) add(rb(0.04, 1.45, 0.04, 0.008, 1), { color: iron, x: GAS.x - gw / 2 + 0.02, y: 0.05, z: GAS.z + sz * (gd / 2 - 0.02) });
    add(stick(V(GAS.x - gw / 2 + 0.02, 0.62, GAS.z - gd / 2 + 0.02), V(GAS.x - gw / 2 + 0.02, 0.62, GAS.z + gd / 2 - 0.02), 0.008, 5), { color: '#8e959a', ao: false });
    add(rb(gw + 0.1, 0.03, gd + 0.12, 0.008, 1).rotateZ(0.12), { color: '#9aa3a8', x: GAS.x - 0.02, y: 1.5, z: GAS.z, ao: false });
    add(stick(V(GAS.x + 0.02, 1.17, GAS.z), V(x0, 1.3, GAS.z), 0.008, 5), { color: '#c9a04e', ao: false });
  }

  // ---------- o saguão por dentro: o piso de granito em xadrez, as paredes com o barrado e o friso, as caixas de
  // correio, a porta do zelador, o quadro de avisos, a guia pendurada, a luminária, e o começo da escada (o fundo do
  // saguão é colisor: os degraus são só desenho)
  const lx1 = LB.x1, fzN = LB.z0 + wt / 2;            // o fundo (leste) e a face sul da parede norte do saguão
  const sw0 = dzc - 0.6, sw1 = dzc + 0.6;             // a boca da escada, de frente para a porta
  add(new THREE.PlaneGeometry(xe - xi, zi - zn).rotateX(-Math.PI / 2), { color: '#6f6a63', slot: 'ground', x: (xi + xe) / 2, y: 0.006, z: (zn + zi) / 2, ao: false });
  const gr = ['#8b857d', '#b9b2a6', '#6f6a63'].map((c) => new THREE.Color(c)), grOut = new THREE.Color();
  const fw = lx1 - xi, fd = zi - fzN;
  add(tiles(fw, fd, 0.4, 0.4, (p) => {
    const i = Math.floor((p.x + 50) / 0.4 + 1e-6), j = Math.floor((p.z + 50) / 0.4 + 1e-6);
    const edge = Math.min(fw / 2 - Math.abs(p.x), fd / 2 - Math.abs(p.z)) < 0.4;
    return grOut.copy(edge ? gr[2] : gr[(i + j) % 2]).offsetHSL(0, 0, (hash(i, j, 27) - 0.5) * 0.03);
  }), { color: null, slot: 'ground', x: (xi + lx1) / 2, y: 0.012, z: (fzN + zi) / 2, ao: false });
  const lobbyWall = (ax, bx, az, bz) => {
    add(rb(bx - ax, DADO, bz - az, 0.012, 1), { color: innerLow, x: (ax + bx) / 2, z: (az + bz) / 2 });
    add(rb(bx - ax, WH - DADO, bz - az, 0.012, 1), { color: inner, x: (ax + bx) / 2, y: DADO, z: (az + bz) / 2, ao: false });
  };
  lobbyWall(xi, lx1 + 0.14, LB.z0 - wt / 2, fzN);
  lobbyWall(lx1, lx1 + 0.14, fzN, sw0);
  lobbyWall(lx1, lx1 + 0.14, sw1, zi);
  // o friso de madeira no alto do barrado e o rodapé, em volta do saguão
  const rail = '#8a5a36';
  const strips = (y, h, t, color) => {
    const S2 = (ax, bx, az, bz) => add(rb(bx - ax, h, bz - az, 0.005, 1), { color, x: (ax + bx) / 2, y, z: (az + bz) / 2, ao: false });
    S2(xi, lx1, fzN, fzN + t);
    S2(xi, lx1, zi - t, zi);
    S2(lx1 - t, lx1, fzN + t, sw0);
    S2(lx1 - t, lx1, sw1, zi - t);
    S2(xi, xi + t, fzN + t, dz0 - 0.06);
    S2(xi, xi + t, dz1 + 0.06, zi - t);
  };
  strips(DADO - 0.02, 0.045, 0.014, rail);
  strips(0.012, 0.09, 0.012, '#6f6a63');
  // a escada: sete degraus de granito para o leste até o patamar, que vira para o sul; as paredes dos lados, a do
  // fundo com os tijolos de vidro acesos (a luz do dia) e o corrimão
  const sx0 = lx1 + 0.02, RUN = 0.28, RISE = 0.17, NS = 7;
  const lnd0 = sx0 + NS * RUN, lndY = 0.012 + (NS + 1) * RISE, stx1 = lnd0 + 1.25, sw2 = sw1 + 1.32;
  const stairWall = (ax, bx, az, bz) => add(rb(bx - ax, WH, bz - az, 0.012, 1), { color: inner, x: (ax + bx) / 2, z: (az + bz) / 2 });
  stairWall(lx1 + 0.14, stx1 + 0.12, sw0 - 0.12, sw0);
  stairWall(lx1 + 0.14, lnd0, sw1, sw1 + 0.12);
  stairWall(stx1, stx1 + 0.12, sw0, sw2 + 0.12);
  stairWall(lnd0 - 0.12, stx1, sw2, sw2 + 0.12);
  stairWall(lnd0 - 0.12, lnd0, sw1 + 0.12, sw2);
  for (let k = 0; k < NS; k++) {
    const top = 0.012 + RISE * (k + 1), x = sx0 + RUN * (k + 0.5);
    add(slab(RUN, top, sw1 - sw0 - 0.006), { color: speckle('#a9a39a', 0.04, 40 + k), x, z: dzc, ao: false });
    add(slab(0.035, 0.008, sw1 - sw0 - 0.016), { color: '#5f5a54', x: x - RUN / 2 + 0.0175, y: top, z: dzc, ao: false });
  }
  add(slab(stx1 - lnd0, lndY, sw2 - sw0 - 0.006), { color: speckle('#a9a39a', 0.04, 49), x: (lnd0 + stx1) / 2, z: (sw0 + sw2) / 2, ao: false });
  const hr = (x) => V(x, 0.012 + 0.9 + (RISE / RUN) * (x - sx0 + RUN * 0.5), sw0 + 0.045);
  add(stick(hr(sx0 + 0.05), hr(lnd0), 0.02, 8), { color: rail, ao: false });
  add(stick(hr(lnd0), V(stx1 - 0.1, hr(lnd0).y, sw0 + 0.045), 0.02, 8), { color: rail, ao: false });
  for (const x of [sx0 + 0.25, (sx0 + lnd0) / 2, lnd0 - 0.15, stx1 - 0.3]) {
    const p = hr(Math.min(x, lnd0));
    add(stick(V(x, p.y, sw0 + 0.045), V(x, p.y, sw0 + 0.002), 0.008, 4), { color: '#8e959a', ao: false });
  }
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 4; i++) add(slab(0.01, 0.18, 0.18), { color: '#eaf6ff', slot: 'lit', x: stx1 - 0.005, y: lndY + 0.32 + j * 0.2, z: dzc + (i - 1.5) * 0.2, ao: false });
  }
  add(slab(0.01, 0.66, 0.86), { color: '#d9cfbf', x: stx1 - 0.001, y: lndY + 0.29, z: dzc, ao: false });
  // a luminária do teto, o interruptor e o capacho de dentro
  const lcx = (xi + lx1) / 2;
  add(cyl(0.16, 0.13, 0.05, 16), { color: '#f4f2ec', x: lcx, y: WH - 0.05, z: dzc + 0.9, ao: false });
  add(cyl(0.125, 0.125, 0.012, 16), { color: '#fff2d0', slot: 'lit', x: lcx, y: WH - 0.062, z: dzc + 0.9, ao: false });
  add(rb(0.014, 0.11, 0.075, 0.004, 1), { color: '#f4f2ec', x: xi + 0.007, y: 1.1, z: dz1 + 0.26, ao: false });
  add(slab(0.008, 0.04, 0.02), { color: '#c9ced3', x: xi + 0.016, y: 1.135, z: dz1 + 0.26, ao: false });
  add(slab(0.46, 0.012, 0.72), { color: speckle('#7d5a3c', 0.06, 18), x: xi + 0.42, y: 0.0135, z: dzc, ao: false });
  // as caixas de correio (duas fileiras) e a porta do zelador, fechada, na parede do norte
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 4; i++) {
      const mbx = xi + 0.32 + i * 0.22, mby = 1.14 + j * 0.2;
      add(rb(0.2, 0.17, 0.09, 0.01, 1), { color: i === 2 && j === 0 ? '#d98a5a' : '#8fa3b0', x: mbx, y: mby, z: fzN + 0.045, ao: false });
      add(slab(0.12, 0.016, 0.004), { color: '#2f3134', x: mbx, y: mby + 0.11, z: fzN + 0.092, ao: false });
      add(new THREE.SphereGeometry(0.008, 6, 4), { color: '#c9a04e', x: mbx + 0.06, y: mby + 0.05, z: fzN + 0.092, ao: false });
    }
  }
  const sdx = lx1 - 0.62;
  add(rb(0.84, 1.98, 0.025, 0.008, 1), { color: speckle(teal, 0.025, 4), x: sdx, y: 0.012, z: fzN + 0.012 });
  for (const sx of [-0.45, 0.45]) add(slab(0.06, 2.04, 0.032), { color: trim, x: sdx + sx, y: 0.012, z: fzN + 0.016 });
  add(slab(0.96, 0.06, 0.032), { color: trim, x: sdx, y: 2.0, z: fzN + 0.016, ao: false });
  add(new THREE.SphereGeometry(0.03, 10, 8), { color: '#c9a04e', x: sdx - 0.32, y: 1.02, z: fzN + 0.05, ao: false });
  add(slab(0.72, 0.2, 0.004), { color: '#d3d8dc', slot: 'glass', x: sdx, y: 0.05, z: fzN + 0.0275, ao: false });
  // a janela do saguão por dentro (o lado de fora dela está na fachada sul), o quadro de avisos e o extintor
  const iwx = southWins[0];
  add(rb(0.94, 0.94, 0.04, 0.012, 1), { color: trim, x: iwx, y: winY - 0.47, z: zi - 0.02, ao: false });
  add(slab(0.78, 0.78, 0.012), { color: '#eaf6ff', slot: 'lit', x: iwx, y: winY - 0.39, z: zi - 0.043, ao: false });
  add(slab(0.04, 0.8, 0.02), { color: trim, x: iwx, y: winY - 0.4, z: zi - 0.05, ao: false });
  add(slab(0.8, 0.04, 0.02), { color: trim, x: iwx, y: winY - 0.02, z: zi - 0.05, ao: false });
  add(rb(1.04, 0.05, 0.12, 0.012, 1), { color: rail, x: iwx, y: winY - 0.52, z: zi - 0.06, ao: false });
  const nbx = Math.min(lx1 - 0.42, iwx + 0.95);
  add(rb(0.6, 0.5, 0.025, 0.008, 1), { color: rail, x: nbx, y: 1.2, z: zi - 0.0125, ao: false });
  add(slab(0.54, 0.44, 0.006), { color: '#c79b6a', x: nbx, y: 1.23, z: zi - 0.028, ao: false });
  const Rn = rng(63);
  for (const [dx, dy, w, h, c] of /** @type {[number, number, number, number, string][]} */ ([[-0.16, 0.24, 0.16, 0.2, '#fffaf0'], [0.05, 0.2, 0.14, 0.14, '#ffd23f'], [0.17, 0.05, 0.12, 0.16, '#bfe6d0'], [-0.12, 0.03, 0.18, 0.13, '#f7c6d4'], [0.04, 0.03, 0.1, 0.1, '#bcd9e6']])) {
    add(slab(w, h, 0.004).rotateZ((Rn() - 0.5) * 0.2), { color: c, x: nbx + dx, y: 1.23 + dy, z: zi - 0.033, ao: false });
    add(new THREE.SphereGeometry(0.01, 6, 4), { color: '#e8473a', x: nbx + dx, y: 1.23 + dy + h - 0.015, z: zi - 0.038, ao: false });
  }
  const ex = lx1 - 0.075, ez = sw1 + 0.5;
  add(cyl(0.062, 0.062, 0.34, 10), { color: '#d63a32', x: ex, y: 0.98, z: ez });
  add(new THREE.SphereGeometry(0.062, 10, 5, 0, TAU, 0, Math.PI / 2), { color: '#d63a32', x: ex, y: 1.32, z: ez, ao: false });
  add(rb(0.05, 0.05, 0.04, 0.01, 1), { color: '#2b2b30', x: ex, y: 1.37, z: ez, ao: false });
  add(stick(V(ex - 0.02, 1.4, ez), V(ex - 0.06, 1.1, ez + 0.02), 0.008, 4), { color: '#2b2b30', ao: false });
  // o cabideiro com a guia vermelha das irmãs, na parede oeste, ao norte da porta
  const hkz = dz0 - 0.8;
  add(rb(0.02, 0.08, 0.5, 0.006, 1), { color: rail, x: xi + 0.01, y: 1.5, z: hkz, ao: false });
  for (const dz of [-0.17, 0, 0.17]) add(stick(V(xi + 0.02, 1.54, hkz + dz), V(xi + 0.075, 1.56, hkz + dz), 0.008, 5), { color: '#c9a04e', ao: false });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(xi + 0.07, 1.555, hkz), V(xi + 0.055, 1.3, hkz - 0.03), V(xi + 0.05, 1.0, hkz), V(xi + 0.055, 1.25, hkz + 0.035), V(xi + 0.07, 1.555, hkz + 0.004)]), 20, 0.009, 5), { color: '#d63a32', ao: false });
  add(new THREE.TorusGeometry(0.02, 0.005, 5, 10), { color: '#c9ced3', slot: 'glass', x: xi + 0.05, y: 0.985, z: hkz, ao: false });

  // ---------- props.terrace: as hélices dos aparelhos de ar e a toalha do varal de chão (as partes que se mexem)
  const terrace = new THREE.Group();
  terrace.name = 'recanto:terraco';
  keep(terrace);
  const fanGeo = bake([
    [new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), { color: '#4a4f55' }],
    ...[0, 1, 2, 3].map((k) => [slab(0.18, 0.006, 0.055).rotateX(0.25), { color: '#5d6368', x: Math.cos((k * Math.PI) / 2) * 0.1, y: 0.006, z: -Math.sin((k * Math.PI) / 2) * 0.1, ry: (k * Math.PI) / 2 }]),
  ]);
  const fans = acs.map((acx, k) => {
    const f = mesh(fanGeo, SLOTS.solid(), { cast: false, name: `recanto:terraco:helice-${k + 1}` });
    f.position.set(acx, TOP + 0.635, acZ);
    terrace.add(f);
    return f;
  });
  const towel = new THREE.Group();
  towel.name = 'recanto:terraco:toalha';
  towel.position.set(rk.x + 0.07, TOP + rk.h + 0.012, rk.z - 0.18);
  towel.rotation.y = Math.PI / 2;
  towel.add(mesh(clothGeo(0.5, 0.42, 5, 8, (u, v) => new THREE.Color(v > 0.9 ? '#2f8a8c' : (v > 0.12 && v < 0.2) || (v > 0.8 && v < 0.88) ? '#fffaf0' : '#3fa8a8'), { seed: 2 }), clothMat(), { name: 'recanto:terraco:toalha:pano' }));
  terrace.add(towel);
  anim.push((dt, t) => {
    fans[0].rotation.y += dt * 9;
    fans[1].rotation.y += dt * 7.3;
    towel.rotation.z = 0.04 + 0.05 * Math.sin(t * 1.3) + 0.02 * Math.sin(t * 3.1);
  });
  return { object: terrace, fans, towel };
}

/** A sapata da mola aérea: na verga da porta da torre, do lado do saguão. */
function doorShoe(L) {
  const D = L.TOWER_DOOR;
  return V(D.hinge.x + L.WALLS.t / 2 + 0.015, D.h + 0.03, D.hinge.z + 0.46);
}
/** O gancho da mola aparente: no batente do trinco, por fora, perto do alto da porta. */
function springHook(L) {
  const D = L.TOWER_DOOR;
  return V(D.hinge.x - 0.05, D.h - 0.14, D.latchPost.z - 0.01);
}

// ================================================================ A PORTA DE MOLA (props.towerDoor)
function buildTowerDoor({ L, keep }) {
  const D = L.TOWER_DOOR;
  const len = D.length, H = D.h;
  const group = new THREE.Group();
  group.name = 'recanto:porta-da-torre';
  keep(group);
  // a folha gira na dobradiça como o hingeTip do núcleo: yaw = closedYaw + (openYaw − closedYaw)·t, ao longo de −Z
  const pivot = new THREE.Group();
  pivot.name = 'recanto:porta-da-torre:folha';
  pivot.position.set(D.hinge.x, 0, D.hinge.z);
  group.add(pivot);
  const inox = '#d3d8dc', etched = '#8e959a';
  // o olhal da mola aparente na folha (do lado de fora, +x local, perto da dobradiça)
  const eye = V(0.05, H - 0.14, -0.14);
  const leaf = bake([
    [rb(0.05, H - 0.025, len - 0.03, 0.012, 2), { color: speckle('#3f7f86', 0.025, 3), y: 0.02, z: -len / 2 }],
    // as almofadas da folha (duas molduras rasas, dos dois lados)
    ...[-1, 1].flatMap((s) => [[0.34, 0.5, len - 0.26, 0.05], [1.52, 0.36, len - 0.46, 0.15]].map(([y, h, w, dz]) => [rb(0.006, h, w, 0.003, 1), { color: '#356d73', x: s * 0.026, y, z: -len / 2 + dz }])),
    // os chutadores de inox embaixo, dos dois lados
    [slab(0.004, 0.24, len - 0.12), { color: inox, x: 0.0295, y: 0.04, z: -len / 2 }],
    [slab(0.004, 0.24, len - 0.12), { color: inox, x: -0.0295, y: 0.04, z: -len / 2 }],
    // a chapa de empurrar (do lado de fora, +x local), com a patinha gravada, e o puxador (do lado do saguão)
    [rb(0.006, 0.46, 0.2, 0.003, 1), { color: inox, x: 0.0305, y: 0.86, z: -len + 0.17 }],
    [slab(0.002, 0.07, 0.08), { color: etched, x: 0.0345, y: 1.02, z: -len + 0.17 }],
    ...[[-0.045, 1.105], [-0.016, 1.125], [0.016, 1.125], [0.045, 1.105]].map(([dz, y]) => [slab(0.002, 0.03, 0.022), { color: etched, x: 0.0345, y, z: -len + 0.17 + dz }]),
    [stick(V(-0.07, 0.86, -len + 0.15), V(-0.07, 1.22, -len + 0.15), 0.012, 8), { color: inox }],
    [stick(V(-0.026, 0.9, -len + 0.15), V(-0.07, 0.9, -len + 0.15), 0.01, 6), { color: inox }],
    [stick(V(-0.026, 1.18, -len + 0.15), V(-0.07, 1.18, -len + 0.15), 0.01, 6), { color: inox }],
    // a moldura do visor
    [slab(0.056, 0.03, 0.14), { color: '#2f6066', y: 1.47, z: -len + 0.19 }],
    [slab(0.056, 0.03, 0.14), { color: '#2f6066', y: 1.86, z: -len + 0.19 }],
    // as dobradiças (no eixo: não mudam com a abertura)
    ...[0.3, 1.0, 1.7].map((y) => [cyl(0.014, 0.014, 0.11, 8), { color: '#9aa1a6', y, z: -0.012 }]),
    // a caixa da mola aérea, no alto, do lado do saguão, perto da dobradiça, e o eixo do braço em cima dela
    [rb(0.06, 0.055, 0.3, 0.012, 1), { color: '#c4c8cb', x: -0.056, y: H - 0.035, z: -0.24 }],
    [cyl(0.013, 0.013, 0.025, 8), { color: '#8e959a', x: -0.066, y: H + 0.015, z: -0.11 }],
    // o suporte e o olhal da mola aparente
    [slab(0.03, 0.05, 0.05), { color: '#9aa1a6', x: 0.036, y: eye.y - 0.025, z: eye.z }],
    [new THREE.TorusGeometry(0.012, 0.004, 5, 10).rotateY(Math.PI / 2), { color: '#9aa1a6', x: eye.x, y: eye.y, z: eye.z }],
  ]);
  pivot.add(mesh(leaf, SLOTS.solid(), { name: 'recanto:porta-da-torre:folha' }));
  pivot.add(mesh(bake([[slab(0.064, 0.36, 0.11), { color: '#a9d0e2', y: 1.5, z: -len + 0.19 }]]), SLOTS.glass(), { cast: false, name: 'recanto:porta-da-torre:visor' }));
  // o braço da mola aérea: duas hastes no plano do alto da porta, do eixo (gira com a folha) até a sapata da verga
  const spindle = V(-0.066, H + 0.03, -0.11);
  const F = doorShoe(L);
  const A = 0.27, B = 0.29;
  const link1 = mesh(paint(new THREE.BoxGeometry(0.022, 0.012, 1), '#bfc4c8'), SLOTS.solid(), { name: 'recanto:porta-da-torre:braco-1' });
  const link2 = mesh(paint(new THREE.BoxGeometry(0.022, 0.012, 1), '#bfc4c8'), SLOTS.solid(), { name: 'recanto:porta-da-torre:braco-2' });
  const elbow = mesh(paint(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8), '#9aa1a6'), SLOTS.solid(), { name: 'recanto:porta-da-torre:cotovelo' });
  // a mola aparente (helicoidal), por fora: do gancho do batente do trinco ao olhal da folha; estica quando a porta abre
  const coil = mesh(paint(coilGeo(18, 0.015, 0.0034), '#c9ced3'), SLOTS.glass(), { cast: false, name: 'recanto:porta-da-torre:mola' });
  group.add(link1, link2, elbow, coil);
  const HK = springHook(L);
  const S = new THREE.Vector3(), E = new THREE.Vector3(), M = new THREE.Vector3(), P = new THREE.Vector3();
  const aim = (link, p, q) => {
    link.position.addVectors(p, q).multiplyScalar(0.5);
    link.scale.set(1, 1, Math.max(1e-3, p.distanceTo(q)));
    link.lookAt(q);
  };
  function setOpen(t) {
    const yaw = D.closedYaw + (D.openYaw - D.closedYaw) * clamp01(t);
    pivot.rotation.y = yaw;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    S.set(D.hinge.x + spindle.x * c + spindle.z * s, spindle.y, D.hinge.z - spindle.x * s + spindle.z * c);
    const dx = F.x - S.x, dz = F.z - S.z, d0 = Math.hypot(dx, dz) || 1e-3;
    const d = Math.min(A + B - 1e-3, Math.max(Math.abs(A - B) + 1e-3, d0));
    const ux = dx / d0, uz = dz / d0;
    const m = (A * A - B * B + d * d) / (2 * d), h = Math.sqrt(Math.max(0, A * A - m * m));
    // das duas soluções, o cotovelo que fica do lado do saguão (o x maior)
    const ex1 = S.x + ux * m - uz * h, ez1 = S.z + uz * m + ux * h, ex2 = S.x + ux * m + uz * h, ez2 = S.z + uz * m - ux * h;
    E.set(ex1 > ex2 ? ex1 : ex2, (S.y + F.y) / 2, ex1 > ex2 ? ez1 : ez2);
    aim(link1, S, E);
    aim(link2, E, M.copy(F));
    elbow.position.copy(E);
    // a mola: do olhal (gira com a folha) ao gancho do batente
    P.set(D.hinge.x + eye.x * c + eye.z * s, eye.y, D.hinge.z - eye.x * s + eye.z * c);
    aim(coil, P, M.copy(HK));
  }
  setOpen(0);
  return { prop: { object: group, setOpen } };
}

// ================================================================ O INTERFONE (props.intercom)
/**
 * Os três botões da senha na face de fora (oeste) da parede da torre, ao sul da porta: cada um é um botão de parede
 * (src/world/wallButton.js, com as patinhas pintadas) e, em cima, a plaquinha com o pictograma dele. Em volta, o painel:
 * a caixa metálica com a grade do alto-falante e a lâmpada de estado, e as duas colunas que emolduram as plaquinhas.
 */
function buildIntercom({ kit, L, keep }) {
  const IC = L.INTERCOM;
  const add = (geo, o) => kit.add(geo, { group: 'torre', ...o });
  const group = new THREE.Group();
  group.name = 'recanto:interfone';
  keep(group);
  /** @type {Record<string, string>} */
  const COLORS = { osso: '#3f8fd1', nota: '#e2559a', sino: '#2f9e6a' };
  const PY = 1.32, PW = 0.235;                     // o meio e o lado das plaquinhas
  /** @type {Record<string, import('../../../../types').WallButtonProp>} */
  const buttons = {};
  /** @type {Record<string, { mat: THREE.MeshStandardMaterial, lit: boolean }>} */
  const plaques = {};
  for (const b of IC.buttons) {
    const ry = wallButtonYaw(b.nx, b.nz), color = COLORS[b.id] || '#e8554a';
    const prop = buildWallButton({ kind: 'button', top: b.top, color, plate: '#f4ecdc', trim: '#5d6368', markColor: '#fff6e6', markOpacity: 0.86, name: `interfone-${b.id}` });
    prop.object.position.set(b.x, 0, b.z);
    prop.object.rotation.y = ry;
    group.add(prop.object);
    buttons[b.id] = prop;
    // a plaquinha: a moldura de metal (no kit) e o pictograma (malha própria: acende)
    add(rb(PW + 0.035, PW + 0.035, 0.012, 0.005, 1), { color: '#5d6368', x: b.x + b.nx * 0.006, y: b.top + (PY - 1.02) - (PW + 0.035) / 2, z: b.z + b.nz * 0.006, ry, ao: false });
    const tex = pictoTexture(b.id, color);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(PW, PW), m);
    face.name = `recanto:interfone:placa-${b.id}`;
    face.position.set(b.x + b.nx * 0.0155, b.top + (PY - 1.02), b.z + b.nz * 0.0155);
    face.rotation.y = ry;
    face.receiveShadow = true;
    group.add(face);
    plaques[b.id] = { mat: m, lit: false };
  }
  // o painel: fica acima das plaquinhas (as patinhas pintadas e os botões ficam livres embaixo)
  const first = IC.buttons[0], last = IC.buttons[IC.buttons.length - 1];
  const nx = first.nx, nz = first.nz, ry = wallButtonYaw(nx, nz);
  const tx = Math.cos(ry), tz = -Math.sin(ry);       // ao longo da parede (o +x local)
  const mx = (first.x + last.x) / 2, mz = (first.z + last.z) / 2, half = Math.hypot(last.x - first.x, last.z - first.z) / 2;
  const topY = first.top + 0.5;                      // a base da caixa
  /** Ponto do painel: `a` ao longo da parede (do meio), `out` para fora dela. */
  const at = (a, out) => ({ x: mx + tx * a + nx * out, z: mz + tz * a + nz * out });
  const metal = speckle('#aeb6bc', 0.03, 71), dark = '#3a3f44';
  const HW = half * 2 + 0.34;                        // a largura da caixa
  add(rb(HW, 0.34, 0.07, 0.014, 2), { color: metal, ...at(0, 0.035), y: topY, ry });
  add(rb(HW + 0.06, 0.025, 0.12, 0.008, 1), { color: '#8e959a', ...at(0, 0.058), y: topY + 0.34, ry, ao: false });
  for (const s of [-1, 1]) {
    add(rb(0.04, topY - (first.top + 0.14), 0.026, 0.008, 1), { color: metal, ...at(s * (HW / 2 - 0.02), 0.013), y: first.top + 0.14, ry, ao: false });
    for (const y of [topY + 0.045, topY + 0.295]) add(new THREE.SphereGeometry(0.008, 8, 5), { color: '#5d6368', ...at(s * (HW / 2 - 0.035), 0.072), y, ao: false });
  }
  // a grade do alto-falante (as fendas) e o aro da lâmpada de estado
  const gx = -HW / 2 + 0.36;
  add(rb(0.46, 0.22, 0.006, 0.004, 1), { color: dark, ...at(gx, 0.072), y: topY + 0.06, ry, ao: false });
  for (let k = 0; k < 6; k++) add(rb(0.4, 0.014, 0.006, 0.003, 1), { color: '#c9ced3', ...at(gx, 0.077), y: topY + 0.082 + k * 0.032, ry, ao: false });
  const lampA = HW / 2 - 0.3;
  add(new THREE.TorusGeometry(0.052, 0.012, 8, 20), { color: '#e9edf0', slot: 'glass', ...at(lampA, 0.076), y: topY + 0.17, ry, ao: false });
  add(rb(0.2, 0.2, 0.006, 0.004, 1), { color: dark, ...at(lampA, 0.072), y: topY + 0.07, ry, ao: false });
  // o eletroduto que sobe da caixa até a laje
  const cp = at(-HW / 2 + 0.1, 0.02);
  add(stick(V(cp.x, topY + 0.34, cp.z), V(cp.x, L.TOWER.h - 0.14, cp.z), 0.012, 6), { color: '#9aa1a6', ao: false });
  // a lâmpada de estado (malha própria: muda de cor): apagada/âmbar, verde, vermelha piscando
  const lampM = new THREE.MeshStandardMaterial({ color: '#7a5a22', roughness: 0.3, emissive: '#ffb23f', emissiveIntensity: 0.18 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.044, 16, 10), lampM);
  lamp.name = 'recanto:interfone:lampada';
  const lp = at(lampA, 0.08);
  lamp.position.set(lp.x, topY + 0.17, lp.z);
  lamp.scale.set(nx ? 0.55 : 1, 1, nz ? 0.55 : 1);
  group.add(lamp);

  const S = { state: 'idle', t: 0 };
  /** @type {Record<string, { color: string, emissive: string, k: number }>} */
  const LAMP = {
    idle: { color: '#7a5a22', emissive: '#ffb23f', k: 0.18 },
    ok: { color: '#9dffa8', emissive: '#2fe060', k: 1.9 },
    erro: { color: '#ffa59a', emissive: '#ff3020', k: 1.9 },
  };
  function paint2() {
    const c = LAMP[S.state];
    lampM.color.set(c.color);
    lampM.emissive.set(c.emissive);
    lampM.emissiveIntensity = S.state === 'erro' ? c.k * (Math.sin(S.t * 16) > 0 ? 1 : 0.2) : c.k;
    for (const p of Object.values(plaques)) p.mat.emissiveIntensity = p.lit ? 0.85 + 0.1 * Math.sin(S.t * 5) : 0;
  }
  paint2();
  const prop = {
    object: group,
    /** Os botões pelo id do layout (`osso`, `nota`, `sino`): cada um o WallButtonProp de buildWallButton. */
    buttons,
    /** Acende (ou apaga) a plaquinha do botão `id`. */
    setLit(id, on) {
      if (!plaques[id]) return;
      plaques[id].lit = !!on;
      paint2();
    },
    /** 'idle' (a lâmpada apagada, âmbar fraco), 'ok' (verde) ou 'erro' (vermelha, piscando). */
    setState(s) {
      S.state = s === 'ok' || s === 'erro' ? s : 'idle';
      paint2();
    },
    update(dt, t) {
      S.t = t;
      for (const b of Object.values(buttons)) b.update?.(dt, t);
      paint2();
    },
  };
  return {
    prop,
    reset() {
      S.state = 'idle';
      for (const p of Object.values(plaques)) p.lit = false;
      paint2();
    },
  };
}

// ================================================================ O VERDE RENTE AO CHÃO (sem colisor: as dogs roçam)
/**
 * Touceiras de capim e florzinhas ao pé das paredes da torre, nas beiradas do cimento da área de serviço e nas faixas
 * de grama em volta do deque (entre ele e as calçadinhas da base):
 * um grupo só, de nome isento de colisor (test/historia-cenario.test.mjs, SEM_COLISOR), no balde 'plant'.
 */
function buildGreens({ kit, L }) {
  const add = (geo, o) => kit.add(geo, { group: 'comum-capim', slot: 'plant', color: null, ao: false, ...o });
  const R = rng(321);
  const T = L.TOWER, D = L.TOWER_DOOR, S = L.SERVICE, Dk = L.POOL.deck, GAS = L.TOWER_GAS || null;
  const wt = L.WALLS.t, wzIn = L.WALL.minZ + L.WALL.t / 2;
  const x0 = T.x0 - wt / 2, x1 = T.x1 + wt / 2, z1 = T.z1 + wt / 2;
  const tufts = [0, 1, 2, 3, 4].map((i) => tuftGeo({ seed: 100 + i, h: 0.1 + 0.02 * i, blades: 6 + (i % 3) }));
  const blooms = ['#fff6ee', '#ffd23f', '#f28ca2', '#b49ad8'].map((c, i) => tuftGeo({ seed: 200 + i, h: 0.12, blades: 5, flower: c, flowers: 3 }));
  /** `n` touceiras de (ax, az) a (bx, bz), espalhadas até (ox, oz) para o lado; bloom: a fração com florzinhas. */
  const row = (ax, az, bx, bz, n, { ox = 0, oz = 0, bloom = 0.3, skip = null } = {}) => {
    for (let i = 0; i < n; i++) {
      const k = (i + R() * 0.8) / n;
      const x = ax + (bx - ax) * k + ox * R(), z = az + (bz - az) * k + oz * R();
      const geo = R() < bloom ? blooms[Math.floor(R() * blooms.length)] : tufts[Math.floor(R() * tufts.length)];
      const s = 0.8 + R() * 0.6;
      if (skip && skip(x, z)) continue;
      add(geo, { x, z, ry: R() * TAU, sx: s, sy: s, sz: s });
    }
  };
  // ao pé da torre: a fachada sul, a leste e a oeste (ao norte da porta: a frente da porta e do interfone fica limpa)
  row(x0 + 0.3, z1 + 0.06, x1 - 0.3, z1 + 0.06, 30, { oz: 0.2, bloom: 0.4 });
  row(x1 + 0.06, wzIn + 0.3, x1 + 0.06, z1 - 0.2, 26, { ox: 0.22, bloom: 0.35 });
  const inGas = (x, z) => !!GAS && Math.abs(z - GAS.z) < GAS.hz + 0.1;
  row(x0 - 0.06, wzIn + 0.3, x0 - 0.06, D.hinge.z - 1.3, 12, { ox: -0.2, bloom: 0.3, skip: inGas });
  // as beiradas do cimento da área de serviço (a oeste e a leste, longe da porta da torre) e a quina noroeste do deque
  row(S.x0 - 0.07, wzIn + 0.3, S.x0 - 0.07, S.z1, 12, { ox: -0.2, bloom: 0.25 });
  row(S.x1 + 0.07, wzIn + 0.3, S.x1 + 0.07, D.hinge.z - 1.3, 8, { ox: 0.16, bloom: 0.25 });
  // as faixas de grama que sobram entre o deque e as calçadinhas (a oeste, a leste e ao sul, fora das ligações)
  row(Dk.x0 - 0.11, Dk.z0 + 0.3, Dk.x0 - 0.11, Dk.z1 - 0.3, 14, { ox: 0.07, bloom: 0.3 });
  row(Dk.x1 + 0.06, Dk.z0 + 0.3, Dk.x1 + 0.06, Dk.z1 - 0.3, 16, { ox: 0.3, bloom: 0.35 });
  const links = [(L.SERVICE_DOOR.hinge.x + L.SERVICE_DOOR.latchPost.x) / 2, L.NAV_NODES.P_south.x, Dk.x1 - 1.3];
  row(Dk.x0 + 0.3, Dk.z1 + 0.07, Dk.x1 - 0.3, Dk.z1 + 0.07, 22, { oz: 0.34, bloom: 0.35, skip: (x) => links.some((lx) => Math.abs(x - lx) < 0.75) });
}

// ================================================================ AS GOTAS (uma malha instanciada para todas)
function buildDrips({ drips, keep }) {
  if (!drips.length) return (_t) => {};
  const geo = new THREE.SphereGeometry(0.0105, 8, 6);
  geo.scale(1, 1.4, 1);
  const im = new THREE.InstancedMesh(geo, mat('recanto-gota', () => new THREE.MeshStandardMaterial({ color: '#d9f0fb', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.85 })), drips.length);
  im.name = 'recanto:gotas';
  im.frustumCulled = false;
  im.castShadow = false;
  keep(im);
  const rings = drips.filter((d) => d.ripple).map((d) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#eaf8ff', transparent: true, opacity: 0, depthWrite: false }));
    m.name = 'recanto:ondinha';
    m.position.set(d.x, d.y1 + 0.004, d.z);
    m.renderOrder = 3;
    keep(m);
    return { d, m };
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const phase = (d, t) => (((t + d.phase) % d.period) + d.period) % d.period;
  return (t) => {
    drips.forEach((d, i) => {
      const hang = Math.max(0.2, d.period - Math.sqrt((2 * (d.y0 - d.y1)) / 9.8));
      const c = phase(d, t);
      let y, k = 1;
      if (c < hang) {
        k = 0.3 + 0.7 * (c / hang);
        y = d.y0 - 0.011 * k;
      } else {
        const tau = c - hang;
        y = d.y0 - 0.011 - 4.9 * tau * tau;
      }
      if (y <= d.y1) { y = d.y1; k = 0; }
      im.setMatrixAt(i, m4.compose(p.set(d.x, y, d.z), q, s.setScalar(Math.max(k, 1e-4))));
    });
    im.instanceMatrix.needsUpdate = true;
    for (const { d, m } of rings) {
      const k = clamp01(phase(d, t) / 0.9);
      const sc = 0.015 + k * 0.16;
      m.scale.set(sc, 1, sc);
      m.material.opacity = 0.55 * (1 - k);
      m.visible = k < 1;
    }
  };
}
