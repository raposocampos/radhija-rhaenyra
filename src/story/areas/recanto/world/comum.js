// RECANTO DAS PATINHAS — o meio do condomínio, em três zonas (um grupo do kit por zona, para o recorte da câmera):
//   piscina  o deque de tábuas com a borda atérmica, a água transparente por cima das paredes de pastilha e do patinho
//            de mosaico no fundo, os refletores ainda acesos, a escada cromada, as duas espreguiçadeiras de ripas (por
//            baixo delas a Radhija passa), o guarda-sol listrado pingando o orvalho, a ducha, o filtro com a bomba, a
//            peneira de folhas largada no deque, os vasos, o chinelo esquecido, a MARCA MOLHADA da boia de patinho (o
//            Faro mostra a Reconstrução a partir dela) e as folhas e flores de ipê que a tempestade jogou na água;
//   servico  o piso de cimento, o telhadinho de telha colonial (uma telha escorregou na tempestade), os dois tanques — o
//            da esquerda com o RALO SEM A ROLHA (só a correntinha vazia: a pista escondida) e a torneira pingando, o da
//            direita com a água de sabão e a rolha no lugar —, a prateleira dos produtos, o enrolador de mangueira, a
//            vassoura, o balde, o VARAL de três fios com as roupas (props.line) e o cesto de vime;
//   torre    o prédio de um andar com o terraço: a PORTA DE MOLA (props.towerDoor, com a mola aérea do lado do saguão),
//            o saguão à meia-luz com as caixas de correio e o começo da escada, as janelas com grade, o buzinote
//            pingando, a placa lisa, o interfone e o capacho; em cima, a casinha da escada (as irmãs saem pela porta
//            larga dela na cena) com a antena, a caixa d'água (o alto dela fica livre para os pombos), os aparelhos de
//            ar com as hélices girando (props.terrace), o varal de chão, a cadeira de plástico, a floreira e os vasos.
// Os pisos de andar têm o alto até 0,02 m (as dogs andam em y = 0). O que fica em pé onde elas andam está dentro de um
// colisor do layout, ou é baixo (≤ 0,08 m) ou alto (≥ 0,65 m); o filtro, a ducha e os dois vasos do deque pedem
// colisores próprios no layout.
// API: buildComum(kit, root, L) → { props: { line, towerDoor, terrace }, seeThrough, update(dt, t), reset(), dispose(), signs }
import * as THREE from 'three';
import { rng, mat, paint, mergeGeometries } from '../../../../world/util.js';
import { rb, cyl, slab, tiles, tilesV, windowAt, SLOTS } from '../../../../levels/mapa/world/kit.js';
import { waterMat, flowerBush } from '../../../../levels/mapa/world/pecas.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (k) => Math.min(1, Math.max(0, k));
const smooth = (k) => { const x = clamp01(k); return x * x * (3 - 2 * x); };

/** Alturas da piscina: o alto das tábuas do deque, o da borda atérmica, a largura da borda e o nível da água. */
const DECK = 0.015;
const COPE = 0.018;
const CW = 0.26;
const WATER = -0.08;
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
  const terrace = buildTower(ctx);
  const door = buildTowerDoor(ctx);
  const dripsUpdate = buildDrips(ctx);
  return {
    props: { line: line.prop, towerDoor: door.prop, terrace },
    // o que fica em pé fora do kit (as malhas do kit, o index.js já entrega)
    seeThrough: [door.prop.object, line.prop.object, terrace.object],
    update(dt, t) {
      for (const f of anim) f(dt, t);
      dripsUpdate(t);
    },
    reset() {
      line.reset();
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

  // ---------- o deque: contrapiso escuro (aparece nas frestas), tábuas de cumaru e o arremate da beirada
  const plane = (x0, z0, x1, z1, y, color) => add(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), { color, slot: 'ground', x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, ao: false });
  for (const [x0, z0, x1, z1] of [[Dk.x0, Dk.z0, Dk.x1, P.z0], [Dk.x0, P.z1, Dk.x1, Dk.z1], [Dk.x0, P.z0, P.x0, P.z1], [P.x1, P.z0, Dk.x1, P.z1]]) plane(x0, z0, x1, z1, 0.005, '#3a2b20');
  // o rejunte claro embaixo da borda atérmica
  for (const [x0, z0, x1, z1] of [[ox0, oz0, ox1, P.z0], [ox0, P.z1, ox1, oz1], [ox0, P.z0, P.x0, P.z1], [P.x1, P.z0, ox1, P.z1]]) plane(x0, z0, x1, z1, 0.008, '#cfc6b6');
  const woods = ['#a8734a', '#9c6a42', '#b47d50', '#a06c45', '#b9845a', '#94633e'].map((c) => new THREE.Color(c));
  /** Uma fileira de tábuas de xa a xb (emendas desencontradas), entre za e zb. */
  const row = (xa, xb, za, zb, seed) => {
    const Rr = rng(seed);
    const cuts = [xa];
    for (let x = xa + 0.35 + Rr() * 1.3; x < xb - 0.35; x += 1.3 + Rr() * 1.1) cuts.push(x);
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
  const strip = (za, zb, n, runs, seed) => {
    for (let i = 0; i < n; i++) {
      const z0 = za + ((zb - za) * i) / n, z1 = za + ((zb - za) * (i + 1)) / n;
      for (const [xa, xb] of runs) row(xa, xb, z0, z1, seed + i * 7 + Math.round(xa * 3));
    }
  };
  strip(Dk.z0, oz0, 7, [[Dk.x0, Dk.x1]], 100);
  strip(oz1, Dk.z1, 7, [[Dk.x0, Dk.x1]], 200);
  strip(oz0, oz1, 23, [[Dk.x0, ox0], [ox1, Dk.x1]], 300);
  // arremate da beirada (por dentro do deque: os caminhos de lajota começam na linha dele)
  const trim = '#7a5232';
  add(slab(Dk.x1 - Dk.x0, 0.019, 0.035), { color: trim, x: (Dk.x0 + Dk.x1) / 2, z: Dk.z0 + 0.0175, ao: false });
  add(slab(Dk.x1 - Dk.x0, 0.019, 0.035), { color: trim, x: (Dk.x0 + Dk.x1) / 2, z: Dk.z1 - 0.0175, ao: false });
  add(slab(0.035, 0.019, Dk.z1 - Dk.z0 - 0.07), { color: trim, x: Dk.x0 + 0.0175, z: (Dk.z0 + Dk.z1) / 2, ao: false });
  add(slab(0.035, 0.019, Dk.z1 - Dk.z0 - 0.07), { color: trim, x: Dk.x1 - 0.0175, z: (Dk.z0 + Dk.z1) / 2, ao: false });

  // ---------- a borda atérmica (pedras creme, rejunte fininho) e o boleado por cima da água
  const stone = ['#efe7d8', '#e9e0cf', '#f3ecdf', '#e4dac8'].map((c) => new THREE.Color(c));
  const copeStone = (x0, z0, x1, z1) => {
    const c = stone[Math.floor(R() * stone.length)].clone().offsetHSL(0, 0, (R() - 0.5) * 0.02);
    add(slab(x1 - x0 - 0.006, COPE - 0.004, z1 - z0 - 0.006), { color: () => c, x: (x0 + x1) / 2, y: 0.004, z: (z0 + z1) / 2, ao: false });
  };
  const run = (a, b, n, fn) => { for (let i = 0; i < n; i++) fn(a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n); };
  for (const [za, zb] of [[oz0, P.z0], [P.z1, oz1]]) {
    copeStone(ox0, za, P.x0, zb);
    copeStone(P.x1, za, ox1, zb);
    run(P.x0, P.x1, 12, (a, b) => copeStone(a, za, b, zb));
  }
  for (const [xa, xb] of [[ox0, P.x0], [P.x1, ox1]]) run(P.z0, P.z1, 6, (a, b) => copeStone(xa, a, xb, b));
  const lip = '#f6f0e4';
  const nose = (len) => new THREE.CylinderGeometry(0.024, 0.024, len, 8);
  add(nose(W).rotateZ(Math.PI / 2), { color: lip, x: cx, y: COPE - 0.026, z: P.z0 + 0.012, ao: false });
  add(nose(W).rotateZ(Math.PI / 2), { color: lip, x: cx, y: COPE - 0.026, z: P.z1 - 0.012, ao: false });
  add(nose(H).rotateX(Math.PI / 2), { color: lip, x: P.x0 + 0.012, y: COPE - 0.026, z: cz, ao: false });
  add(nose(H).rotateX(Math.PI / 2), { color: lip, x: P.x1 - 0.012, y: COPE - 0.026, z: cz, ao: false });

  // ---------- por dentro: paredes de pastilha (a faixa escura na linha d'água) e o fundo com o patinho de mosaico
  const aqua = ['#9fd9e6', '#93d2e2', '#a9dfea', '#8ccbdc'].map((c) => new THREE.Color(c));
  const band = ['#2f86ad', '#3a95bb', '#2a7aa0'].map((c) => new THREE.Color(c));
  const wallTile = (seed) => {
    const out = new THREE.Color();
    return (p) => {
      const i = Math.floor((p.x + 50) / 0.15), j = Math.floor((p.y + 50) / 0.15), h = hash(i, j, seed);
      if (p.y > D / 2 - 0.15) return out.copy(band[Math.floor(h * band.length)]);
      return out.copy(aqua[Math.floor(h * aqua.length)]).multiplyScalar(1 - ((D / 2 - p.y) / D) * 0.3);
    };
  };
  add(tilesV(W, D, 0.15, 0.15, wallTile(1)), { color: null, slot: 'ground', x: cx, y: -D / 2, z: P.z0, ao: false });
  add(tilesV(W, D, 0.15, 0.15, wallTile(2)), { color: null, slot: 'ground', x: cx, y: -D / 2, z: P.z1, ry: Math.PI, ao: false });
  add(tilesV(H, D, 0.15, 0.15, wallTile(3)), { color: null, slot: 'ground', x: P.x0, y: -D / 2, z: cz, ry: Math.PI / 2, ao: false });
  add(tilesV(H, D, 0.15, 0.15, wallTile(4)), { color: null, slot: 'ground', x: P.x1, y: -D / 2, z: cz, ry: -Math.PI / 2, ao: false });
  const blue = ['#5fb7d8', '#58afd2', '#66bddc', '#52a8cc'].map((c) => new THREE.Color(c));
  const floorOut = new THREE.Color();
  add(tiles(W, H, 0.25, 0.25, (p) => {
    const edge = Math.min(W / 2 - Math.abs(p.x), H / 2 - Math.abs(p.z));
    return floorOut.copy(blue[Math.floor(hash(Math.floor((p.x + 50) / 0.25), Math.floor((p.z + 50) / 0.25), 9) * blue.length)]).multiplyScalar(edge < 0.25 ? 0.86 : 1);
  }), { color: null, slot: 'ground', x: cx, y: -D, z: cz, ao: false });
  // o patinho de mosaico (o Recanto das Patinhas): pastilhas de 7,5 cm, de bico para o leste
  const DUCK = [
    '..........YYYY......',
    '.........YYYYYY.....',
    '........YYYYYEYY....',
    '........YYYYYYYOOO..',
    '........YYYYYYYOO...',
    '.........YYYYYY.....',
    '..........YYYY......',
    'Y........YYYYYY.....',
    'YY.....YYYYYYYYYY...',
    'YYY..YYYYYYYYYYYYY..',
    '.YYYYYYYDDDDYYYYYY..',
    '.YYYYYYDDDDDDYYYYY..',
    '..YYYYYYDDDDYYYYY...',
    '...YYYYYYYYYYYYYY...',
    '.....YYYYYYYYYYY....',
  ];
  /** @type {Record<string, string>} */
  const DC = { Y: '#f6cf45', D: '#e2a92a', O: '#f08a3c', E: '#2b2b30' };
  const px = 0.075, mx = cx - 0.6 - (20 * px) / 2, mz = cz - (DUCK.length * px) / 2;
  const duck = [];
  DUCK.forEach((line, j) => [...line].forEach((ch, i) => {
    if (DC[ch]) duck.push([mx + i * px + 0.003, mz + j * px + 0.003, mx + (i + 1) * px - 0.003, mz + (j + 1) * px - 0.003, DC[ch]]);
  }));
  add(flatQuads(duck), { color: null, slot: 'ground', y: -D + 0.003, ao: false });
  // o ralo de fundo (no lado fundo, a leste), os refletores ainda acesos, os retornos e o skimmer na parede norte
  add(grate(0.3, 4, '#d9dde0', '#26405a'), { color: null, slot: 'ground', x: P.x1 - 1.2, y: -D + 0.003, z: cz, ao: false });
  for (const lx of [-3.5, -0.4]) {
    add(new THREE.TorusGeometry(0.085, 0.014, 6, 16), { color: '#e9edf0', x: lx, y: -0.45, z: P.z0 + 0.008, ao: false });
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.014, 16).rotateX(Math.PI / 2), { color: '#fff4d6', slot: 'lit', x: lx, y: -0.45, z: P.z0 + 0.008, ao: false });
  }
  for (const [x, y, z, ry] of [[-2.1, -0.3, P.z0, 0], [P.x0, -0.3, -3.8, Math.PI / 2], [P.x0, -0.3, -2.7, Math.PI / 2]]) {
    const c = Math.cos(ry), s = Math.sin(ry);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 10).rotateX(Math.PI / 2), { color: '#f1f3f4', x: x + s * 0.006, y, z: z + c * 0.006, ry, ao: false });
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8).rotateX(Math.PI / 2), { color: '#3a3f44', x: x + s * 0.01, y, z: z + c * 0.01, ry, ao: false });
  }
  const skx = -3.9, skz = P.z0 - CW / 2;
  add(rb(0.28, 0.14, 0.006, 0.004, 1), { color: '#f4f5f6', x: skx, y: -0.14, z: P.z0 + 0.003, ao: false });
  add(slab(0.24, 0.1, 0.006), { color: '#1f2a33', x: skx, y: -0.12, z: P.z0 + 0.007, ao: false });
  // a tampa do skimmer tirada (de lado, na borda) e a mangueira do aspirador entrando nele, vinda do filtro
  add(new THREE.CircleGeometry(0.085, 16).rotateX(-Math.PI / 2), { color: '#1c2228', slot: 'ground', x: skx, y: COPE + 0.003, z: skz, ao: false });
  add(cyl(0.1, 0.1, 0.004, 16), { color: '#e6e8e9', x: skx + 0.3, y: COPE, z: skz + 0.02, ao: false });
  const hoseCurve = new THREE.CatmullRomCurve3([V(-4.19, 0.06, -5.5), V(-4.1, 0.024, -5.42), V(-4.02, 0.024, -5.2), V(-3.93, 0.03, -5.02), V(skx, 0.012, skz)]);
  const hoseLight = new THREE.Color('#8fcbe6'), hoseDark = new THREE.Color('#6fb3d6');
  add(faceColors(new THREE.TubeGeometry(hoseCurve, 18, 0.022, 6, false), (p) => (Math.floor((p.x + p.z) * 45) % 2 ? hoseLight : hoseDark)), { color: null, ao: false });

  // ---------- a água: transparente (o fundo e o patinho aparecem), com as ondinhas andando
  const waterM = mat('recanto-agua-da-piscina', () => {
    const nm = waterMat().normalMap.clone();
    nm.repeat.set(3, 1.5);
    nm.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      color: '#46acd8', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.66, depthWrite: false,
      normalMap: nm, normalScale: new THREE.Vector2(0.25, 0.25),
    });
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), waterM);
  water.name = 'recanto:agua-da-piscina';
  water.position.set(cx, WATER, cz);
  water.receiveShadow = true;
  water.renderOrder = 2;
  keep(water);
  anim.push((dt) => {
    waterM.normalMap.offset.x += dt * 0.012;
    waterM.normalMap.offset.y += dt * 0.007;
  });

  // ---------- a escada cromada (dentro da caixa da água; o corrimão sobe até 0,8 m e mergulha)
  const lx = -0.8;
  const railPts = [[0.025, COPE], [0.025, 0.6], [0.055, 0.76], [0.13, 0.8], [0.2, 0.73], [0.215, 0.55], [0.215, -0.1], [0.215, -0.55], [0.17, -0.68], [0.04, -0.72]].map(([dz, y]) => V(0, y, P.z0 + dz));
  const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts, false, 'catmullrom', 0.25), 28, 0.019, 8, false);
  for (const s of [-0.25, 0.25]) {
    add(railGeo, { color: CHROME, slot: 'glass', x: lx + s, ao: false });
    add(cyl(0.034, 0.034, 0.004, 12), { color: CHROME, slot: 'glass', x: lx + s, y: COPE, z: P.z0 + 0.025, ao: false });
  }
  for (const y of [-0.12, -0.36, -0.6]) add(rb(0.5, 0.025, 0.11, 0.008, 1), { color: '#eef1f3', x: lx, y, z: P.z0 + 0.155, ao: false });

  // ---------- as espreguiçadeiras: quadro de alumínio branco, ripas de madeira, rodinhas na cabeceira.
  // O estrado fica a 0,47 m: embaixo dele a Radhija (0,48 m de cabeça) passa; o colisor barra só a irmã.
  const frame = '#f3f0e8', slats = ['#b98451', '#a8733f', '#c48f5a', '#ad7745'];
  // o chão embaixo de um ponto: as tábuas no deque, a grama fora dele (a do sul passa um pouco da beirada)
  const floorAt = (p) => (p.x >= Dk.x0 && p.x <= Dk.x1 && p.z >= Dk.z0 && p.z <= Dk.z1 ? DECK : 0);
  const lounger = (lg, idx) => {
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
    return { at, top, ry };
  };
  const L1 = lounger(L.LOUNGERS[0], 0);
  const L2 = lounger(L.LOUNGERS[1], 1);
  // a toalha dobrada nos pés da do sul, o livro aberto virado para baixo na do norte
  for (let k = 0; k < 3; k++) add(rb(0.36, 0.02, 0.26, 0.008, 1), { color: k % 2 ? '#fff4e2' : '#ef8b6e', ...L1.at(0, 0.6), y: L1.top + 0.022 + k * 0.02, ry: L1.ry + 0.08, ao: false });
  for (const sx of [-1, 1]) add(slab(0.11, 0.008, 0.16).rotateZ(sx * 0.32), { color: '#c2483a', ...L2.at(0.04 + sx * 0.05, 0.3), y: L2.top + 0.03, ry: L2.ry + 0.3, ao: false });
  // os brinquedos que ficaram (a boia de patinho, não: essa o pombo levou): a prancha e o espaguete, deitados
  add(rb(0.3, 0.032, 0.45, 0.06, 1), { color: '#f08a3c', x: -2.3, y: DECK, z: -1.05, ry: 0.42, ao: false });
  add(rb(0.2, 0.01, 0.28, 0.05, 1), { color: '#3a8fd1', x: -2.3, y: DECK + 0.032, z: -1.05, ry: 0.42, ao: false });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-4.15, DECK + 0.03, -1.22), V(-3.62, DECK + 0.03, -0.92), V(-3.02, DECK + 0.03, -1.02)]), 16, 0.03, 8), { color: '#ff7fae', ao: false });
  // os chinelos esquecidos no deque (amarelo e verde, como os de sempre)
  for (const [x, z, ry] of [[1.08, -0.92, 0.3], [1.27, -0.8, -0.2]]) {
    add(rb(0.095, 0.014, 0.24, 0.035, 1), { color: '#ffd23f', x, y: DECK, z, ry, ao: false });
    const c = Math.cos(ry), s = Math.sin(ry);
    const toe = V(x + s * 0.07, DECK + 0.016, z + c * 0.07);
    for (const sx of [-1, 1]) add(stick(toe, V(x + sx * 0.045 * c - s * 0.01, DECK + 0.016, z - sx * 0.045 * s - c * 0.01), 0.007, 4), { color: '#2f9a52', ao: false });
  }

  // ---------- o guarda-sol: base baixa de granito (fora do colisor só o que é chato), haste, copa listrada pingando
  const U = L.UMBRELLA;
  add(cyl(0.23, 0.25, 0.05, 18), { color: speckle('#8c8a86', 0.05, 2), x: U.x, y: DECK, z: U.z });
  add(cyl(0.05, 0.065, 0.13, 12), { color: '#6f6d69', x: U.x, y: DECK + 0.05, z: U.z });
  add(cyl(0.022, 0.022, 2.5, 8), { color: '#f4f1ea', x: U.x, y: DECK + 0.1, z: U.z });
  add(cyl(0.036, 0.036, 0.08, 10), { color: '#d9d4c8', x: U.x, y: 1.45, z: U.z, ao: false });
  add(rb(0.12, 0.018, 0.018, 0.006, 1), { color: '#d9d4c8', x: U.x + 0.06, y: 1.48, z: U.z, ao: false });
  add(cyl(0.04, 0.03, 0.07, 10), { color: '#f4f1ea', x: U.x, y: 2.05, z: U.z, ao: false });
  const UR = 1.25, rim = 2.2;
  add(canopyGeo({ r: UR, apex: 2.6, rim }), { color: null, x: U.x, z: U.z, ao: false });
  add(new THREE.SphereGeometry(0.035, 10, 8), { color: '#f4f1ea', x: U.x, y: 2.63, z: U.z, ao: false });
  // as gotas do orvalho: uma cai na água (com a ondinha), outra no caminho do leste
  const gomo = (k) => { const a = ((k + 0.5) / 8) * TAU; return { x: U.x + Math.cos(a) * UR * 0.965, z: U.z + Math.sin(a) * UR * 0.965 }; };
  const gw = gomo(4), gd = gomo(6);
  drips.push({ x: gw.x, z: gw.z, y0: rim - 0.1, y1: WATER, period: 2.6, phase: 0.3, ripple: true });
  drips.push({ x: gd.x, z: gd.z, y0: rim - 0.1, y1: 0.012, period: 3.1, phase: 1.6, ripple: false });
  add(blob(0.07, 4), { color: '#8a8478', slot: 'glass', x: gd.x, y: 0.0165, z: gd.z, ao: false });

  // ---------- o filtro de areia com a bomba (pede o colisor 'filtro-piscina': caixa x −4,82..−4,18, z −5,86..−5,38)
  const F = { x: -4.5, z: -5.62 };
  add(rb(0.62, 0.04, 0.46, 0.012, 1), { color: speckle('#bdb6aa', 0.04, 7), x: F.x, y: 0.005, z: F.z });
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
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(F.x + 0.08, 0.09, F.z - 0.17), V(F.x + 0.1, 0.05, F.z - 0.21), V(F.x + 0.16, 0.046, F.z - 0.22)]), 6, 0.02, 8), { color: pvc, ao: false });

  // ---------- a ducha de inox (pede o colisor 'ducha': círculo de raio 0,08) e a grelha embaixo do chuveiro
  const Sh = { x: 0.55, z: -5.6 };
  add(cyl(0.05, 0.06, 0.02, 12), { color: CHROME, slot: 'glass', x: Sh.x, y: DECK, z: Sh.z, ao: false });
  add(cyl(0.035, 0.035, 2.06, 12), { color: CHROME, slot: 'glass', x: Sh.x, y: DECK + 0.02, z: Sh.z });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 2.07, 0), V(0, 2.17, 0.04), V(0, 2.19, 0.16), V(0, 2.17, 0.3)]), 10, 0.022, 8), { color: CHROME, slot: 'glass', x: Sh.x, z: Sh.z, ao: false });
  add(cyl(0.05, 0.09, 0.035, 16), { color: CHROME, slot: 'glass', x: Sh.x, y: 2.12, z: Sh.z + 0.3, ao: false });
  add(rb(0.05, 0.05, 0.03, 0.012, 1), { color: '#2b2b30', x: Sh.x, y: 1.08, z: Sh.z + 0.045, ao: false });
  add(grate(0.3, 5), { color: null, slot: 'ground', x: Sh.x, y: DECK + 0.0035, z: Sh.z + 0.3, ao: false });
  drips.push({ x: Sh.x, z: Sh.z + 0.3, y0: 2.12, y1: DECK + 0.004, period: 3.7, phase: 2.2, ripple: false });

  // ---------- a peneira de folhas largada no deque (cabo comprido) e as folhas dentro dela
  add(stick(V(-2.95, DECK + 0.016, -5.32), V(-0.47, DECK + 0.016, -5.4), 0.015, 8), { color: '#c9ced3', ao: false });
  add(new THREE.TorusGeometry(0.17, 0.009, 4, 18).rotateX(Math.PI / 2), { color: '#2f8a6a', x: -0.28, y: DECK + 0.01, z: -5.41, ao: false });
  add(new THREE.CircleGeometry(0.165, 16).rotateX(-Math.PI / 2), { color: '#3f5a52', slot: 'ground', x: -0.28, y: DECK + 0.004, z: -5.41, ao: false });

  // ---------- os vasos: o grande vitrificado no canto sudoeste (pede 'vaso-piscina-1', raio 0,22) e o de barro ao
  // lado do guarda-sol (pede 'vaso-piscina-2', raio 0,18)
  potAt(add, { x: -6.1, z: -0.75, y: DECK, r: 0.19, h: 0.4, color: '#2f7f86', slot: 'glass', plant: palm({ h: 0.95, fronds: 8, seed: 5 }) });
  potAt(add, { x: 2.15, z: -3.65, y: DECK, r: 0.12, h: 0.28, color: '#c46a43', plant: flowerBush({ r: 0.15, seed: 21, flower: '#ff6a55', n: 6 }), plantSlot: 'foliage' });

  // ---------- a marca molhada da boia de patinho (o anel, a cabeça e o bico), gotas em volta e o rastro para o norte
  const Rc = L.RECON;
  const wet = '#4a3221', mx0 = Rc.x - 0.06, mz0 = Rc.z;
  add(ringBlob(0.15, 0.33, 3), { color: wet, slot: 'glass', x: mx0, y: DECK + 0.0035, z: mz0, ao: false });
  add(blob(0.11, 5), { color: wet, slot: 'glass', x: mx0 + 0.03, y: DECK + 0.0035, z: mz0 - 0.42, ao: false });
  add(blob(0.045, 7), { color: wet, slot: 'glass', x: mx0 + 0.13, y: DECK + 0.0035, z: mz0 - 0.46, ao: false });
  const dropG = new THREE.SphereGeometry(0.012, 7, 4, 0, TAU, 0, Math.PI / 2);
  const Rd = rng(13);
  for (let i = 0; i < 12; i++) {
    const a = Rd() * TAU, d = 0.38 + Rd() * 0.16;
    if (mx0 + Math.cos(a) * d > P.x0 - CW - 0.03) continue; // nada de gota em cima da borda
    add(dropG, { color: '#dcecf2', slot: 'glass', x: mx0 + Math.cos(a) * d, y: DECK, z: mz0 + Math.sin(a) * d, sx: 0.7 + Rd() * 0.6, sz: 0.7 + Rd() * 0.6, sy: 0.45, ao: false });
  }
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    add(dropG, { color: '#dcecf2', slot: 'glass', x: mx0 + 0.05 + t * 0.18 + (Rd() - 0.5) * 0.05, y: DECK, z: mz0 - 0.62 - t * 0.85, sx: 1 - t * 0.5, sz: 1 - t * 0.5, sy: 0.45, ao: false });
  }

  // ---------- o que a tempestade deixou no deque: um galho com folhas e flores de ipê caídas (longe da marca)
  const twig = (len, r) => new THREE.CylinderGeometry(r * 0.7, r, len, 5).rotateZ(Math.PI / 2);
  add(twig(0.55, 0.017), { color: '#6b4a2e', x: -5.92, y: DECK + 0.017, z: -4.5, ry: 0.45, ao: false });
  add(twig(0.24, 0.01), { color: '#6b4a2e', x: -5.8, y: DECK + 0.011, z: -4.36, ry: -0.5, ao: false });
  const leafG = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.05);
    s.quadraticCurveTo(0.032, -0.012, 0, 0.05);
    s.quadraticCurveTo(-0.032, -0.012, 0, -0.05);
    return new THREE.ShapeGeometry(s, 3).rotateX(-Math.PI / 2);
  })();
  const flowerG = starGeo(5, 0.034, 0.015);
  for (const [x, z, ry, c] of /** @type {[number, number, number, string][]} */ ([[-6.12, -4.62, 0.4, '#6f9a3a'], [-5.72, -4.45, 2.1, '#b8a24a'], [-5.98, -4.33, 1.2, '#7da040']])) {
    add(leafG, { color: c, slot: 'ground', x, y: DECK + 0.007, z, ry, ao: false });
  }
  const Ri = rng(29);
  for (let i = 0; i < 16; i++) {
    let x = -6.2 + Ri() * 0.9, z = -5.9 + Ri() * 4.9;
    if (Math.hypot(x - mx0, z - mz0) < 0.7 || (z < -5.05 && x > -6.0)) { x = -6.18 + Ri() * 0.25; z = -2.5 + Ri() * 1.6; }
    add(flowerG, { color: Ri() < 0.5 ? '#ffd23f' : '#f2c12e', slot: 'ground', x, y: DECK + 0.0035 + (i % 4) * 0.0006, z, ry: Ri() * TAU, ao: false });
  }
  // um graveto boiando
  add(twig(0.3, 0.012), { color: '#5d4029', x: -3.6, y: WATER + 0.006, z: -2.35, ry: 0.9, ao: false });

  // ---------- folhas e flores de ipê boiando: derivam devagar e balançam com a água
  const floatMat = mat('recanto-folha-boiando', () => new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }));
  const Rf = rng(77);
  const make = (geo, n, colors) => {
    const im = new THREE.InstancedMesh(geo, floatMat, n);
    im.name = 'recanto:piscina:folhas';
    im.frustumCulled = false;
    im.castShadow = false;
    im.receiveShadow = true;
    const list = [];
    for (let i = 0; i < n; i++) {
      const u = Math.pow(Rf(), 1.5);
      list.push({ x: P.x0 + 0.2 + u * (W - 0.4), z: P.z0 + 0.22 + Rf() * (H - 0.44), yaw: Rf() * TAU, s: 0.8 + Rf() * 0.5, ph: Rf() * TAU });
      im.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    keep(im);
    return { im, list };
  };
  const floaters = [make(leafG, 12, ['#6f9a3a', '#b8a24a', '#8a6a3a', '#7da040']), make(flowerG, 9, ['#ffd23f', '#f2c12e'])];
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fp = new THREE.Vector3(), fs = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  anim.push((dt, t) => {
    for (const { im, list } of floaters) {
      list.forEach((f, i) => {
        fp.set(f.x + 0.07 * Math.sin(t * 0.13 + f.ph), WATER + 0.004 + 0.0015 * Math.sin(t * 1.3 + f.ph), f.z + 0.05 * Math.sin(t * 0.11 + f.ph * 1.7));
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
  const S = L.SERVICE, T = L.TANKS, Dr = L.DRAIN, Ln = L.LINE, B = L.BASKET;
  const FL = 0.012;                              // o piso de cimento
  const wz = L.WALL.minZ + L.WALL.t / 2;         // a face de dentro do muro norte (−8,88)
  const fx0 = S.x0, fx1 = S.x1, fz0 = wz, fz1 = S.z1;

  // ---------- o piso: placas de cimento (variação por placa), as juntas, as guias e o ralo de piso
  add(tiles(fx1 - fx0, fz1 - fz0, 0.62, 0.62, cells(['#cbc5ba', '#c4beb2', '#d0cabf', '#c7c0b3'], 0.62, 5)), { color: null, slot: 'ground', x: (fx0 + fx1) / 2, y: FL, z: (fz0 + fz1) / 2, ao: false });
  const joints = [];
  for (let x = fx0 + 1.84; x < fx1 - 0.3; x += 1.84) joints.push([x - 0.006, fz0, x + 0.006, fz1, '#a39d92']);
  joints.push([fx0, -7.64 - 0.006, fx1, -7.64 + 0.006, '#a39d92']);
  add(flatQuads(joints), { color: null, slot: 'ground', y: FL + 0.003, ao: false });
  for (const x of [fx0 + 0.025, fx1 - 0.025]) add(slab(0.05, 0.013, fz1 - fz0), { color: '#b7b0a4', x, y: 0.004, z: (fz0 + fz1) / 2, ao: false });
  add(grate(0.22, 4), { color: null, slot: 'ground', x: -4.75, y: FL + 0.003, z: -8.05, ao: false });
  // as manchas molhadas: na frente dos tanques e embaixo das roupas que pingam
  add(blob(0.3, 2), { color: '#8f8a80', slot: 'glass', x: -5.3, y: FL + 0.003, z: -8.1, sz: 0.5, ao: false });
  for (const [x, z, r] of [[-2.85, -7.5, 0.12], [-2.45, -7.84, 0.13], [0.45, -7.84, 0.11], [-1.0, -7.52, 0.08], [1.86, -7.5, 0.07]]) {
    add(blob(r, x * 3), { color: '#9a958b', slot: 'glass', x, y: FL + 0.003, z, sz: 0.7, ao: false });
  }
  // um caco de telha do telhadinho, caído na tempestade
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 6, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), { color: '#b85a38', x: -3.75, y: FL + 0.002, z: -7.95, ry: 0.7, ao: false });

  // ---------- os dois tanques de granito (dentro da caixa do colisor 'tanques'): pilares, bacias, espelho
  const tx0 = T.x0 + 0.08, tx1 = T.x1 - 0.08, tz0 = -8.8, tz1 = T.z1 - 0.02, tw = (tx1 - tx0) / 2, tzc = (tz0 + tz1) / 2;
  const granite = speckle('#dcd8cf', 0.06, 3), graniteD = speckle('#cbc6bb', 0.06, 4);
  for (const x of [tx0 + 0.06, tx0 + tw, tx1 - 0.06]) add(rb(0.1, Dr.y - 0.05 - FL, 0.36, 0.015, 1), { color: speckle('#b8b1a5', 0.05, 5), x, y: FL, z: tzc - 0.02 });
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
  }
  add(rb(tx1 - tx0 + 0.04, 0.16, 0.04, 0.012, 1), { color: granite, x: (tx0 + tx1) / 2, y: T.h - 0.01, z: tz0 + 0.02 });
  // o tanque da esquerda: o RALO SEM A ROLHA (o furo escuro com o anel de inox) e a correntinha vazia, sem nada na
  // ponta; o pingo da torneira molha o fundo, mas a água vai embora
  add(new THREE.CircleGeometry(0.027, 14).rotateX(-Math.PI / 2), { color: '#111214', slot: 'ground', x: Dr.x, y: Dr.y + 0.002, z: Dr.z, ao: false });
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
  add(blob(0.045, 9), { color: '#a9a69f', slot: 'glass', x: -5.66, y: Dr.y + 0.003, z: -8.68, ao: false });
  // o tanque da direita: água de sabão com espuma, a correntinha entrando na água (a rolha lá no fundo)
  const rx = tx0 + tw * 1.5;
  const waterTop = T.h - lip - 0.03;
  add(new THREE.PlaneGeometry(tw - 0.12, tz1 - tz0 - 0.1).rotateX(-Math.PI / 2), { color: '#b9cfd4', slot: 'glass', x: rx, y: waterTop, z: tzc, ao: false });
  const Rs = rng(19);
  for (let i = 0; i < 7; i++) {
    add(new THREE.SphereGeometry(0.025 + Rs() * 0.02, 8, 5), { color: '#fbfcfd', x: rx + (Rs() - 0.5) * 0.5, y: waterTop, z: tzc + (Rs() - 0.5) * 0.24, sy: 0.4, ao: false });
  }
  for (let i = 0; i < 5; i++) add(bead, { color: '#c9ced3', slot: 'glass', x: rx + 0.13, y: T.h - 0.02 - i * 0.017, z: tz0 + 0.056, ao: false });
  add(new THREE.TorusGeometry(0.008, 0.002, 5, 8), { color: '#c9ced3', slot: 'glass', x: rx + 0.13, y: T.h - 0.012, z: tz0 + 0.052, ao: false });
  // o sabão em barra no meio dos tanques e a escova na beira do da direita
  add(rb(0.09, 0.03, 0.055, 0.014, 1), { color: '#7fc3e6', x: tx0 + tw, y: T.h, z: tzc, ry: 0.25, ao: false });
  add(rb(0.15, 0.03, 0.055, 0.01, 1), { color: '#c08a52', x: rx + 0.18, y: T.h - lip + 0.012, z: tz1 - 0.028, ry: -0.15, ao: false });
  add(rb(0.14, 0.014, 0.048, 0.006, 1), { color: '#ead9a2', x: rx + 0.18, y: T.h - lip, z: tz1 - 0.028, ry: -0.15, ao: false });
  // embaixo: o balde emborcado e os galões de sabão e de água sanitária
  add(cyl(0.11, 0.14, 0.24, 14), { color: '#2f8fd8', x: rx + 0.13, y: FL, z: -8.48 });
  add(new THREE.TorusGeometry(0.13, 0.006, 4, 12, Math.PI).rotateY(0.4), { color: '#3a3a3a', x: rx + 0.13, y: FL + 0.12, z: -8.48, ao: false });
  add(rb(0.16, 0.26, 0.11, 0.035, 1), { color: '#f4f4f0', x: tx0 + tw * 0.35, y: FL, z: -8.6 });
  add(cyl(0.022, 0.022, 0.03, 8), { color: '#e8473a', x: tx0 + tw * 0.35 + 0.04, y: FL + 0.26, z: -8.6, ao: false });
  add(rb(0.12, 0.22, 0.09, 0.03, 1), { color: '#3d7fd1', x: tx0 + tw * 0.75, y: FL, z: -8.58 });

  // ---------- as torneiras na parede (a da esquerda pinga)
  const tap = (x, drip) => {
    const y = 1.12, z0 = wz + 0.005;
    add(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 12).rotateX(Math.PI / 2), { color: CHROME, slot: 'glass', x, y, z: z0 + 0.006, ao: false });
    add(stick(V(x, y, z0), V(x, y, z0 + 0.11), 0.014, 8), { color: CHROME, slot: 'glass', ao: false });
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, y, z0 + 0.1), V(x, y - 0.005, z0 + 0.16), V(x, y - 0.05, z0 + 0.19), V(x, y - 0.09, z0 + 0.195)]), 8, 0.012, 8), { color: CHROME, slot: 'glass', ao: false });
    add(cyl(0.012, 0.012, 0.04, 8), { color: CHROME, slot: 'glass', x, y: y + 0.012, z: z0 + 0.07, ao: false });
    add(rb(0.07, 0.012, 0.016, 0.005, 1), { color: CHROME, slot: 'glass', x, y: y + 0.05, z: z0 + 0.07, ao: false });
    if (drip) drips.push({ x, z: z0 + 0.195, y0: y - 0.1, y1: Dr.y + 0.004, period: 2.3, phase: 0.4, ripple: false });
  };
  tap(-5.66, true);
  tap(rx - 0.03, false);

  // ---------- a prateleira dos produtos (em cima dos tanques, na frente do pilar do muro)
  add(rb(1.7, 0.03, 0.2, 0.008, 1), { color: '#a87a52', x: -5.05, y: 1.36, z: -8.7 });
  for (const x of [-5.75, -4.35]) add(rb(0.03, 0.14, 0.16, 0.006, 1), { color: '#6b4a34', x, y: 1.22, z: -8.72 });
  add(rb(0.1, 0.22, 0.07, 0.03, 1), { color: '#3d7fd1', x: -5.72, y: 1.39, z: -8.7 });
  add(cyl(0.018, 0.018, 0.03, 8), { color: '#fffaf0', x: -5.72, y: 1.61, z: -8.7, ao: false });
  add(rb(0.12, 0.26, 0.08, 0.035, 1), { color: '#e98fb7', x: -5.56, y: 1.39, z: -8.7 });
  add(cyl(0.022, 0.022, 0.035, 8), { color: '#9677c6', x: -5.56, y: 1.65, z: -8.7, ao: false });
  add(cyl(0.05, 0.055, 0.24, 10), { color: '#f4f4f0', x: -4.62, y: 1.39, z: -8.7 });
  add(cyl(0.022, 0.022, 0.03, 8), { color: '#e8473a', x: -4.62, y: 1.63, z: -8.7, ao: false });
  add(rb(0.1, 0.03, 0.07, 0.01, 1), { color: '#ffd23f', x: -4.86, y: 1.39, z: -8.68, ry: 0.3, ao: false });
  add(rb(0.1, 0.012, 0.07, 0.005, 1), { color: '#4f9a52', x: -4.86, y: 1.42, z: -8.68, ry: 0.3, ao: false });
  potAt(add, { x: -4.36, z: -8.7, y: 1.39, r: 0.06, h: 0.09, color: '#c46a43', plant: flowerBush({ r: 0.07, seed: 12, flower: '#ff8fc0', n: 4 }), plantSlot: 'foliage' });

  // ---------- o telhadinho de telha colonial em cima dos tanques (postes no fundo, mãos-francesas, o beiral a 2,15 m)
  const rx0 = T.x0 - 0.1, rx1 = T.x1 + 0.1, rzB = -8.86, rzF = -7.82, yB = 2.49, yF = 2.19;
  const slope = Math.atan2(yB - yF, rzF - rzB), len = Math.hypot(rzF - rzB, yB - yF);
  const roofY = (z) => yB + ((z - rzB) * (yF - yB)) / (rzF - rzB);
  const woodC = speckle('#8a5a36', 0.05, 8);
  for (const x of [T.x0 + 0.04, T.x1 - 0.04]) {
    add(rb(0.07, yB - 0.06 - FL, 0.07, 0.012, 1), { color: woodC, x, y: FL, z: -8.8 });
    add(beam(V(x, 1.72, -8.78), V(x, roofY(-7.95) - 0.06, -7.95), 0.05, 0.05), { color: woodC, ao: false });
    add(beam(V(x, yB - 0.02, rzB), V(x, yF - 0.02, rzF), 0.06, 0.09), { color: woodC, ao: false });
  }
  add(rb(rx1 - rx0, 0.08, 0.07, 0.01, 1), { color: woodC, x: (rx0 + rx1) / 2, y: roofY(-7.92) - 0.1, z: -7.92, ao: false });
  add(rb(rx1 - rx0, 0.025, len, 0.008, 1).rotateX(slope), { color: '#6e3f2a', x: (rx0 + rx1) / 2, y: (yB + yF) / 2 + 0.025, z: (rzB + rzF) / 2, ao: false });
  // as capas das telhas (três por fileira, uma por cima da outra); uma faltando e uma escorregada
  const terra = ['#c4643f', '#b85a38', '#cf7048', '#a9523a', '#bf6a46'].map((c) => new THREE.Color(c));
  const capa = new THREE.CylinderGeometry(0.05, 0.058, len / 3 + 0.04, 6, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateX(slope);
  const nRows = Math.round((rx1 - rx0 - 0.08) / 0.11);
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
  add(cyl(0.004, 0.004, roofY(-8.35) + 0.03 - 2.1, 4), { color: '#2b2b30', x: -5.05, y: 2.1, z: -8.35, ao: false });
  add(new THREE.ConeGeometry(0.09, 0.07, 12, 1, true), { color: '#e9e4d6', x: -5.05, y: 2.1, z: -8.35, ao: false });
  add(new THREE.SphereGeometry(0.035, 10, 8), { color: '#fff2c8', slot: 'lit', x: -5.05, y: 2.06, z: -8.35, ao: false });
  // a vassoura encostada no poste do leste (dentro da caixa dos tanques)
  const bx = T.x1 - 0.04;
  add(rb(0.05, 0.05, 0.26, 0.01, 1), { color: '#d83a3a', x: bx, y: FL + 0.05, z: -8.5, ao: false });
  add(rb(0.045, 0.055, 0.25, 0.006, 1), { color: '#3a3633', x: bx, y: FL, z: -8.5, ao: false });
  add(stick(V(bx, FL + 0.1, -8.5), V(bx, 1.3, -8.73), 0.012, 6), { color: '#d6a86a', ao: false });

  // ---------- o enrolador de mangueira na parede (tudo acima de 0,65 m) e a torneira do jardim
  const hx = -3.75, hy = 0.92, hz = wz + 0.14;
  add(rb(0.08, 0.36, 0.03, 0.01, 1), { color: '#3f6a3a', x: hx, y: hy - 0.18, z: wz + 0.015, ao: false });
  add(stick(V(hx, hy, wz + 0.02), V(hx, hy, wz + 0.25), 0.02, 8), { color: '#3f6a3a', ao: false });
  for (let k = 0; k < 2; k++) add(new THREE.TorusGeometry(0.15 - k * 0.012, 0.017, 6, 16), { color: k ? '#4f9a52' : '#5aa85e', x: hx, y: hy, z: hz + k * 0.04, ao: false });
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(hx + 0.12, hy - 0.09, hz + 0.04), V(hx + 0.2, hy - 0.2, hz + 0.06), V(hx + 0.18, 0.72, hz + 0.05)]), 8, 0.016, 6), { color: '#5aa85e', ao: false });
  add(cyl(0.02, 0.016, 0.05, 8), { color: '#f2c230', x: hx + 0.18, y: 0.68, z: hz + 0.05, ao: false });
  add(stick(V(hx, 1.3, wz), V(hx, 1.3, wz + 0.08), 0.013, 8), { color: CHROME, slot: 'glass', ao: false });

  // ---------- os postes do varal (madeira, com a travessa em cima) — os fios e as roupas estão em props.line
  const postC = speckle('#957657', 0.06, 17);
  for (const p of [Ln.a, Ln.b]) {
    add(cyl(0.16, 0.17, 0.008, 16), { color: '#bdb6aa', x: p.x, y: FL, z: p.z, ao: false });
    add(cyl(Ln.postR - 0.004, Ln.postR, 1.44, 12), { color: postC, x: p.x, y: FL, z: p.z });
    add(new THREE.SphereGeometry(Ln.postR - 0.004, 12, 5, 0, TAU, 0, Math.PI / 2), { color: postC, x: p.x, y: FL + 1.44, z: p.z, ao: false });
    add(rb(0.07, 0.06, 0.66, 0.012, 1), { color: '#7d5a3c', x: p.x, y: 1.37, z: p.z, ao: false });
    const toward = p.x < (Ln.a.x + Ln.b.x) / 2 ? 1 : -1;
    for (const dz of [-0.25, 0, 0.25]) add(new THREE.TorusGeometry(0.012, 0.003, 4, 8).rotateY(Math.PI / 2), { color: '#9aa1a6', x: p.x + (dz ? 0 : toward * Ln.postR), y: dz ? 1.355 : Ln.h + 0.012, z: p.z + dz, ao: false });
  }

  // ---------- o cesto de vime (dentro do raio do colisor, longe do pilar do muro), com as roupas e uma toalha caindo
  const wick = ['#c9965a', '#ad7d44'].map((c) => new THREE.Color(c));
  const bkx = B.x - 0.06, bkz = B.z + 0.04, bkr = 0.2;
  const basket = new THREE.CylinderGeometry(bkr, bkr * 0.8, 0.36, 16, 6, true).translate(0, 0.18, 0);
  add(faceColors(basket, (p) => wick[(Math.floor((Math.atan2(p.z, p.x) + Math.PI) / (TAU / 16)) + Math.floor(p.y / 0.06)) % 2]), { color: null, x: bkx, y: FL, z: bkz });
  add(new THREE.TorusGeometry(bkr, 0.018, 6, 20).rotateX(Math.PI / 2), { color: '#d9ab6e', x: bkx, y: FL + 0.36, z: bkz, ao: false });
  for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.042, 0.01, 5, 10, Math.PI), { color: '#d9ab6e', x: bkx + s * 0.185, y: FL + 0.3, z: bkz, ao: false });
  const Rb = rng(8);
  ['#f2a7a0', '#5f8fc4', '#f4efe4', '#f2b636', '#7fb069'].forEach((c, i) => {
    const a = Rb() * TAU, d = Rb() * 0.08;
    add(new THREE.SphereGeometry(0.09, 10, 6), { color: c, x: bkx + Math.cos(a) * d, y: FL + 0.33 + (i % 2) * 0.03, z: bkz + Math.sin(a) * d, sx: 1.1 + Rb() * 0.3, sy: 0.42, sz: 0.85 + Rb() * 0.3, ry: Rb() * 3, ao: false });
  });
  add(clothGeo(0.16, 0.2, 3, 4, () => new THREE.Color('#3f9e95'), { amp: 0.008, waves: 1.5 }), { color: null, x: bkx + 0.03, y: FL + 0.37, z: bkz + bkr - 0.005, rx: 0.12, ao: false });

  // ---------- na parede, atrás do varal (tudo acima de 0,65 m): o varal sanfonado de parede com dois panos de prato e
  // as duas jardineiras de meia-lua com as plantas pendentes
  const wr = { x: 1.5, y: 1.42, d: 0.34 };
  for (const sx of [-0.35, 0.35]) {
    add(rb(0.05, 0.16, 0.012, 0.004, 1), { color: '#d9dde0', x: wr.x + sx, y: wr.y - 0.08, z: wz + 0.006, ao: false });
    add(stick(V(wr.x + sx, wr.y - 0.07, wz + 0.01), V(wr.x + sx, wr.y + 0.01, wz + wr.d), 0.007, 4), { color: '#d9dde0', ao: false });
    add(stick(V(wr.x + sx, wr.y + 0.01, wz + 0.01), V(wr.x + sx, wr.y - 0.07, wz + wr.d), 0.007, 4), { color: '#d9dde0', ao: false });
  }
  for (let k = 0; k < 4; k++) add(stick(V(wr.x - 0.4, wr.y, wz + 0.08 + k * 0.085), V(wr.x + 0.4, wr.y, wz + 0.08 + k * 0.085), 0.006, 4), { color: '#eef0f1', ao: false });
  for (const [dx, kz, cA, cB] of /** @type {[number, number, string, string][]} */ ([[-0.17, 1, '#fffaf0', '#e8473a'], [0.18, 3, '#fffaf0', '#3f8fd1']])) {
    add(clothGeo(0.3, 0.38, 4, 8, (u, v) => new THREE.Color(v > 0.88 || (v > 0.6 && v < 0.7) ? cB : cA), { amp: 0.006 }), { color: null, x: wr.x + dx, y: wr.y - 0.006, z: wz + 0.08 + kz * 0.085, ao: false });
  }
  const trail = palm({ h: 0.36, fronds: 7, seed: 15 }).rotateX(Math.PI);
  for (const [px, py] of [[-1.2, 1.1], [2.35, 1.05]]) {
    add(rb(0.34, 0.16, 0.15, 0.03, 1), { color: speckle('#c46a43', 0.06, px * 5), x: px, y: py, z: wz + 0.085 });
    add(slab(0.3, 0.01, 0.11), { color: '#4a3424', slot: 'ground', x: px, y: py + 0.161, z: wz + 0.085, ao: false });
    add(flowerBush({ r: 0.1, seed: 17, flower: '#ff6a55', n: 5 }), { color: null, slot: 'foliage', x: px, y: py + 0.165, z: wz + 0.085, ao: false });
    add(trail, { color: null, slot: 'plant', x: px, y: py + 0.16, z: wz + 0.15, ao: false });
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
    { z: Ln.a.z - 0.25, y: Ln.h + 0.025, sag: 0.03, k: 0.65 },
    { z: Ln.a.z + 0.25, y: Ln.h + 0.025, sag: 0.03, k: 0.65 },
  ];
  // amp: a força do sacolejo agora; drive: o valor pedido neste quadro (−1: ninguém pediu, ele morre sozinho);
  // pin: a abertura mostrada do pregador; pinTo: a pedida (subindo, ele voa até lá; voltando, vai na hora)
  const S = { amp: 0, drive: -1, pin: 0, pinTo: 0, t: 0 };
  const lineY = (ln, u) => ln.y - ln.sag * 4 * u * (1 - u) - S.amp * ln.k * 0.032 * Math.sin(S.t * 14) * Math.sin(Math.PI * u);

  // os fios: segmentos de uma malha instanciada só (seguem o balanço)
  const SEG = 12;
  const fios = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0055, 0.0055, 1, 5, 1, true), mat('recanto-fio-do-varal', () => new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.55 })), LINES.length * SEG);
  fios.name = 'recanto:varal:fios';
  fios.frustumCulled = false;
  fios.castShadow = true;
  group.add(fios);

  // as roupas: cada peça num pivô no fio (gira em volta do fio: a brisa e o sacolejo), com os pregadores
  const PINS = ['#e8473a', '#3fa1e0', '#f2c230', '#7fd36b', '#f28ca2'];
  const pinGeo = slab(0.012, 0.064, 0.017);
  const ITEMS = [
    { line: 0, x: -2.85, kind: 'towel', w: 0.5, h: 0.58, c: ['#f2a03d', '#fff3dc', '#e0782a'] },
    { line: 0, x: -2.18, kind: 'shirt', w: 0.4, h: 0.5, c: ['#7fc3e6', '#4f94c0'] },
    { line: 0, x: -1.58, kind: 'socks', w: 0.3, h: 0.22, c: ['#f4a9c0', '#fffaf0'] },
    { line: 0, x: -1.0, kind: 'towel', w: 0.32, h: 0.42, c: ['#fffaf0', '#4f8fd1', '#dfe8ef'] },
    { line: 0, x: -0.4, kind: 'bandana', w: 0.38, h: 0.28, c: ['#d8392f', '#fffaf0'] },
    { line: 0, x: 0.28, kind: 'pillow', w: 0.46, h: 0.32, c: ['#f7c6d4', '#fffaf0', '#7fbf8a'] },
    { line: 0, x: 1.86, kind: 'dish', w: 0.28, h: 0.4, c: ['#fffaf0', '#d84a3a'] },
    { line: 1, x: -2.45, kind: 'towel', w: 0.6, h: 0.58, c: ['#3fa8a8', '#fffaf0', '#2f8a8c'] },
    { line: 1, x: -1.25, kind: 'shorts', w: 0.42, h: 0.42, c: ['#4f6f9f', '#3d5a85'] },
    { line: 1, x: 0.45, kind: 'towel', w: 0.5, h: 0.56, c: ['#b49ad8', '#fffaf0', '#9a7fc4'] },
    { line: 2, x: -2.0, kind: 'socks', w: 0.3, h: 0.22, c: ['#ffd15c', '#7fd36b'] },
    { line: 2, x: -0.95, kind: 'shirt', w: 0.42, h: 0.48, c: ['#ffd15c', '#e0a92e'] },
    { line: 2, x: 0.55, kind: 'dish', w: 0.26, h: 0.3, c: ['#bfe6d0', '#fffaf0'] },
  ];
  const garment = (it, seed) => {
    const Rg = rng(seed);
    const c = it.c.map((h) => new THREE.Color(h));
    const list = [];
    let pins = [-it.w / 2 + 0.035, it.w / 2 - 0.035];
    if (it.kind === 'towel') {
      list.push([clothGeo(it.w, it.h, 5, 12, (u, v) => (v > 0.92 ? c[2] : (v > 0.083 && v < 0.167) || (v > 0.833 && v < 0.917) ? c[1] : c[0]), { seed }), { color: null }]);
    } else if (it.kind === 'shirt') {
      const Wt = it.w + 0.22;
      const keepFn = (u, v) => Math.abs(u - 0.5) * Wt < it.w / 2 || v < 0.3;
      list.push([clothGeo(Wt, it.h, 10, 10, (u, v) => (Math.abs(u - 0.5) * Wt < 0.07 && v < 0.1 ? c[1] : c[0]), { keep: keepFn, seed }), { color: null }]);
      pins = [-it.w / 2 + 0.04, it.w / 2 - 0.04];
    } else if (it.kind === 'socks') {
      const sock = clothGeo(0.12, it.h, 3, 5, (u, v) => (v > 0.8 || v < 0.2 ? c[1] : c[0]), { amp: 0.006, waves: 1, keep: (u, v) => v > 0.78 || u < 0.6 });
      list.push([sock, { color: null, x: -0.075 }], [sock, { color: null, x: 0.075, ry: 0.15 }]);
      pins = [-0.1, 0.05];
    } else if (it.kind === 'bandana') {
      list.push([clothGeo(it.w, it.h, 8, 6, (u, v, i, j) => (hash(i, j, seed) < 0.25 ? c[1] : c[0]), { amp: 0.008, keep: (u, v) => Math.abs(u - 0.5) < 0.5 * (1 - v) + 0.07 }), { color: null }]);
    } else if (it.kind === 'pillow') {
      list.push([clothGeo(it.w, it.h, 6, 5, (u, v, i, j) => { const h = hash(i, j, seed); return h < 0.18 ? c[1] : h < 0.3 ? c[2] : c[0]; }, { seed }), { color: null }]);
    } else if (it.kind === 'dish') {
      list.push([clothGeo(it.w, it.h, 4, 8, (u, v) => (v > 0.9 || (v > 0.62 && v < 0.75) ? c[1] : c[0]), { amp: 0.008, seed }), { color: null }]);
    } else {
      list.push([clothGeo(it.w, it.h, 6, 7, (u, v) => (v < 0.12 ? c[1] : c[0]), { keep: (u, v) => v < 0.55 || Math.abs(u - 0.5) > 0.1, seed }), { color: null }]);
    }
    for (const g of list) g[1].y = -0.004;
    for (const x of pins) list.push([pinGeo, { color: PINS[Math.floor(Rg() * PINS.length)], x, y: -0.036 }]);
    return bake(list);
  };
  const items = ITEMS.map((it, i) => {
    const pivot = new THREE.Group();
    pivot.name = `recanto:varal:${it.kind}`;
    const u = (it.x - xa) / span;
    pivot.position.set(it.x, lineY(LINES[it.line], u), LINES[it.line].z);
    pivot.add(mesh(garment(it, 31 + i * 7), clothMat(), { name: `recanto:varal:${it.kind}:pano` }));
    group.add(pivot);
    return { pivot, u, ln: LINES[it.line], ph: i * 1.37, stiff: it.kind === 'socks' || it.kind === 'bandana' ? 1.35 : 1 };
  });

  // o pregador de madeira do ponto da cenoura (a cenoura é do puzzle, presa em CARROT_PIN): duas pernas que abrem
  // na mola; setPin(1) o faz pular do fio e cair deitado no chão, embaixo
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
  const P1 = V(CP.x + 0.34, 0.012 + 0.011, CP.z + 0.24); // onde ele cai, deitado
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
      it.pivot.rotation.z = 0.035 * Math.sin(t * 0.8 + it.ph) * it.stiff + S.amp * 0.08 * Math.sin(t * 7 + it.ph * 2);
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
     * 0: o pregador fechado no fio; 1: abriu, pulou e está deitado no chão, embaixo de CARROT_PIN. Subindo, ele faz o
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

// ================================================================ TORRE
function buildTower({ kit, L, anim, drips, keep }) {
  const g = 'torre';
  const add = (geo, o) => kit.add(geo, { group: g, ...o });
  const T = L.TOWER, D = L.TOWER_DOOR, TK = T.tank;
  const wt = L.WALLS.t;                                  // a espessura dos colisores 'torre-*'
  const x0 = T.x0 - wt / 2, x1 = T.x1 + wt / 2;          // as faces de fora: oeste e leste
  const z1 = T.z1 + wt / 2;                              // a face sul
  const z0 = L.WALL.minZ - L.WALL.t / 2 - 0.01;          // a face norte (por fora do muro do condomínio)
  const zn = L.WALL.minZ + L.WALL.t / 2 + 0.03;          // a face de dentro da parede norte
  const xi = x0 + wt, zi = z1 - wt;                      // as faces de dentro das paredes oeste e sul
  const WH = T.h - 0.145, TOP = T.h;                     // as paredes vão até a laje; o piso do terraço
  const facade = speckle('#efdcc1', 0.035, 11), inner = speckle('#ebe3d5', 0.03, 12), trim = '#fbf6ec', teal = '#3f7f86';
  const dz0 = D.hinge.z, dz1 = D.latchPost.z, dzc = (dz0 + dz1) / 2;

  // ---------- as paredes (em cima dos colisores), a verga da porta, o rodapé, o batente e a soleira
  const wall = (ax, bx, az, bz, y0, y1, dx, dz) => add(rb(bx - ax, y1 - y0, bz - az, 0.02, 1), { color: twoTone(facade, inner, dx, dz), x: (ax + bx) / 2, y: y0, z: (az + bz) / 2 });
  wall(x0, x1, z0, zn, 0, WH, 0, 1);
  wall(x0, x1, zi, z1, 0, WH, 0, -1);
  wall(x0, xi, zn, dz0, 0, WH, 1, 0);
  wall(x0, xi, dz1, zi, 0, WH, 1, 0);
  wall(x1 - wt, x1, zn, zi, 0, WH, -1, 0);
  wall(x0, xi, dz0, dz1, D.h + 0.05, WH, 1, 0);
  const base = speckle('#c7ab89', 0.04, 13);
  add(slab(x1 - x0 + 0.024, 0.3, 0.012), { color: base, x: (x0 + x1) / 2, z: z1 + 0.004 });
  add(slab(0.012, 0.3, z1 - 0.002 - zn), { color: base, x: x1 + 0.004, z: (zn + z1 - 0.002) / 2 });
  add(slab(0.012, 0.3, dz0 - zn), { color: base, x: x0 - 0.004, z: (zn + dz0) / 2 });
  add(slab(0.012, 0.3, z1 - 0.002 - dz1), { color: base, x: x0 - 0.004, z: (dz1 + z1 - 0.002) / 2 });
  for (const z of [dz0 - 0.035, dz1 + 0.035]) add(slab(0.03, D.h + 0.09, 0.07), { color: trim, x: x0 - 0.012, z });
  add(slab(0.034, 0.07, dz1 - dz0 + 0.14), { color: trim, x: x0 - 0.014, y: D.h + 0.05, z: dzc, ao: false });
  add(slab(wt + 0.06, 0.012, dz1 - dz0), { color: '#cfc4b2', x: T.x0, y: 0.004, z: dzc, ao: false });
  // a sapata da mola aérea, no batente por dentro (o braço está em props.towerDoor)
  const shoe = doorShoe(L);
  add(rb(0.03, 0.045, 0.08, 0.008, 1), { color: '#c4c8cb', x: shoe.x + 0.002, y: shoe.y - 0.005, z: shoe.z, ao: false });

  // ---------- a laje com a pingadeira, o piso do terraço e as muretas com a capa
  add(rb(x1 - x0 + 0.1, 0.14, z1 - z0 + 0.1, 0.03, 1), { color: trim, x: (x0 + x1) / 2, y: WH, z: (z0 + z1) / 2 });
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

  // ---------- a caixa d'água (o alto em TOWER.tank.h fica livre perto de TERRACE.pigeons), a escadinha, o alçapão
  const kx0 = TK.x0, kz1 = TK.z1, kxc = (kx0 + x1) / 2, kzc = (z0 + kz1) / 2;
  add(rb(x1 - kx0, TK.h - 0.08 - (TOP - 0.005), kz1 - z0, 0.025, 1), { color: facade, x: kxc, y: TOP - 0.005, z: kzc });
  add(rb(x1 - kx0 + 0.06, 0.08, kz1 - z0 + 0.06, 0.015, 1), { color: trim, x: kxc, y: TK.h - 0.08, z: kzc });
  add(slab(x1 - kx0 + 0.012, 0.1, kz1 - z0 + 0.012), { color: '#e2cba9', x: kxc, y: TK.h - 0.5, z: kzc, ao: false });
  const hatch = { x: kx0 + 0.42, z: kz1 - 0.38 };
  add(rb(0.58, 0.05, 0.58, 0.01, 1), { color: '#9aa3a8', x: hatch.x, y: TK.h, z: hatch.z, ao: false });
  add(rb(0.5, 0.025, 0.5, 0.008, 1), { color: '#b8c0c5', x: hatch.x, y: TK.h + 0.05, z: hatch.z, ao: false });
  add(rb(0.12, 0.02, 0.03, 0.006, 1), { color: '#5d6368', x: hatch.x, y: TK.h + 0.075, z: hatch.z + 0.2, ao: false });
  add(cyl(0.05, 0.05, 0.16, 10), { color: '#9aa3a8', x: x1 - 0.42, y: TK.h, z: z0 + 0.42, ao: false });
  add(cyl(0.09, 0.07, 0.05, 10), { color: '#b8c0c5', x: x1 - 0.42, y: TK.h + 0.16, z: z0 + 0.42, ao: false });
  const lad = '#8e959a', lz = kz1 + 0.1;
  for (const lxr of [hatch.x - 0.2, hatch.x + 0.2]) {
    add(stick(V(lxr, TOP, lz), V(lxr, TK.h + 0.42, lz), 0.016, 6), { color: lad, ao: false });
    for (const y of [TOP + 0.45, TK.h - 0.2]) add(stick(V(lxr, y, kz1), V(lxr, y, lz), 0.012, 4), { color: lad, ao: false });
  }
  for (let y = TOP + 0.28; y < TK.h + 0.1; y += 0.28) add(stick(V(hatch.x - 0.2, y, lz), V(hatch.x + 0.2, y, lz), 0.012, 5), { color: lad, ao: false });
  // o ladrão da caixa pingando no terraço (a mancha na parede e a poça embaixo)
  const ox = kx0 + 1.3;
  add(stick(V(ox, 3.25, kz1), V(ox, 3.25, kz1 + 0.2), 0.022, 8), { color: '#e9e4da', ao: false });
  add(stick(V(ox, 3.25, kz1 + 0.2), V(ox, 3.19, kz1 + 0.23), 0.022, 8), { color: '#e9e4da', ao: false });
  add(slab(0.12, 3.22 - TOP, 0.006), { color: '#d2bc9a', x: ox, y: TOP + 0.01, z: kz1 + 0.001, ao: false });
  add(blob(0.2, 6), { color: '#a99a84', slot: 'glass', x: ox, y: TOP + 0.003, z: kz1 + 0.3, sz: 0.7, ao: false });
  drips.push({ x: ox, z: kz1 + 0.23, y0: 3.17, y1: TOP + 0.004, period: 1.9, phase: 0.9, ripple: false });

  // ---------- a casinha da escada (canto sudoeste do terraço, encostada nas muretas), a porta aberta e a antena
  // Na cena do terraço as irmãs aparecem DENTRO da casinha (TERRACE.hut + deslocamentos) e saem pela porta do norte
  // em linha reta até TERRACE.rha e TERRACE.rad: a porta é larga (1 m), vai até perto da quina nordeste, e a folha
  // fica aberta para dentro, encostada na parede do leste (fora do caminho das duas); a quina não encosta em rad.
  const hx0 = tx0, hx1 = 5.2, hz0 = -6.2, hz1 = tz1, HH = 2.15, hw = 0.12;
  const doorX0 = 4.0, doorX1 = 5.0, doorH = 1.9;
  const hutWall = (ax, bx, az, bz, y0, y1, dx, dz) => add(rb(bx - ax, y1 - y0, bz - az, 0.015, 1), { color: twoTone(facade, '#4d4844', dx, dz), x: (ax + bx) / 2, y: y0, z: (az + bz) / 2 });
  hutWall(hx0, hx1, hz1 - hw, hz1, TOP, TOP + HH, 0, -1);
  hutWall(hx0, hx0 + hw, hz0 + hw, hz1 - hw, TOP, TOP + HH, 1, 0);
  hutWall(hx1 - hw, hx1, hz0 + hw, hz1 - hw, TOP, TOP + HH, -1, 0);
  hutWall(hx0, doorX0, hz0, hz0 + hw, TOP, TOP + HH, 0, 1);
  hutWall(doorX1, hx1, hz0, hz0 + hw, TOP, TOP + HH, 0, 1);
  hutWall(doorX0, doorX1, hz0, hz0 + hw, TOP + doorH, TOP + HH, 0, 1);
  add(rb(hx1 - hx0 + 0.16, 0.1, hz1 - hz0 + 0.16, 0.025, 1), { color: trim, x: (hx0 + hx1) / 2, y: TOP + HH, z: (hz0 + hz1) / 2 });
  add(new THREE.PlaneGeometry(hx1 - hx0 - 2 * hw, hz1 - hz0 - 2 * hw).rotateX(-Math.PI / 2), { color: '#34302d', slot: 'ground', x: (hx0 + hx1) / 2, y: TOP + 0.005, z: (hz0 + hz1) / 2, ao: false });
  for (const x of [doorX0 - 0.03, doorX1 + 0.03]) add(slab(0.06, doorH + 0.06, 0.03), { color: trim, x, y: TOP, z: hz0 - 0.008 });
  add(slab(doorX1 - doorX0 + 0.12, 0.06, 0.034), { color: trim, x: (doorX0 + doorX1) / 2, y: TOP + doorH, z: hz0 - 0.01, ao: false });
  add(rb(doorX1 - doorX0 - 0.02, doorH - 0.02, 0.04, 0.01, 1).translate(-(doorX1 - doorX0 - 0.02) / 2, 0, 0), { color: teal, x: doorX1 - 0.02, y: TOP + 0.01, z: hz0 + hw / 2, ry: 1.45 });
  add(slab(0.1, 0.12, 0.02), { color: '#5d6368', x: (doorX0 + doorX1) / 2, y: TOP + doorH + 0.12, z: hz0 - 0.01, ao: false });
  add(new THREE.SphereGeometry(0.05, 10, 8), { color: '#fff2c8', slot: 'lit', x: (doorX0 + doorX1) / 2, y: TOP + doorH + 0.12, z: hz0 - 0.065, ao: false });
  add(slab(0.012, 0.22, 0.3), { color: '#d6cbb8', x: hx1 + 0.004, y: TOP + 1.45, z: -5.55, ao: false });
  for (let k = 0; k < 4; k++) add(slab(0.008, 0.02, 0.26), { color: '#3a3734', x: hx1 + 0.012, y: TOP + 1.49 + k * 0.045, z: -5.55, ao: false });
  // a antena de TV no teto da casinha
  const ax = 4.75, az = -5.35, ay = TOP + HH + 0.1;
  add(stick(V(ax, ay - 0.02, az), V(ax, ay + 1.15, az), 0.016, 6), { color: '#8e959a', ao: false });
  add(stick(V(ax, ay + 1.1, az - 0.42), V(ax, ay + 1.1, az + 0.38), 0.011, 4), { color: '#8e959a', ao: false });
  for (let k = 0; k < 6; k++) {
    const zz = az - 0.36 + k * 0.14, half = 0.28 - k * 0.03;
    add(stick(V(ax - half, ay + 1.1, zz), V(ax + half, ay + 1.1, zz), 0.006, 4), { color: '#aab1b6', ao: false });
  }

  // ---------- no terraço: a floreira na mureta oeste (longe de onde as irmãs param), os aparelhos de ar, o varal de
  // chão, a cadeira de plástico, os vasos, o ralo e as poças da chuva
  const plx0 = tx0, plx1 = tx0 + 0.32, plz0 = tz0, plz1 = -6.65, plc = (plz0 + plz1) / 2;
  const plantBox = speckle('#c98d6a', 0.05, 31);
  add(rb(plx1 - plx0, 0.38, plz1 - plz0, 0.03, 1), { color: plantBox, x: (plx0 + plx1) / 2, y: TOP, z: plc });
  add(slab(plx1 - plx0 - 0.06, 0.015, plz1 - plz0 - 0.06), { color: '#4a3424', slot: 'ground', x: (plx0 + plx1) / 2, y: TOP + 0.37, z: plc, ao: false });
  for (const [w, d, x, z] of [[plx1 - plx0, 0.04, (plx0 + plx1) / 2, plz0 + 0.02], [plx1 - plx0, 0.04, (plx0 + plx1) / 2, plz1 - 0.02], [0.04, plz1 - plz0 - 0.08, plx0 + 0.02, plc], [0.04, plz1 - plz0 - 0.08, plx1 - 0.02, plc]]) {
    add(rb(w, 0.08, d, 0.01, 1), { color: '#d9a07d', x, y: TOP + 0.36, z, ao: false });
  }
  const bushes = [flowerBush({ r: 0.15, seed: 31, flower: '#ff6a55', n: 6 }), flowerBush({ r: 0.14, seed: 33, flower: '#ff8fc0', n: 6 }), flowerBush({ r: 0.13, seed: 35, flower: '#fff6ee', n: 5 })];
  const palmS = palm({ h: 0.55, fronds: 6, seed: 9 }), snake = snakePlant({ h: 0.5, n: 7, seed: 4 });
  [0, 1, 2, 3, 4, 5].forEach((k) => {
    const z = plz0 + 0.22 + (k * (plz1 - plz0 - 0.44)) / 5, x = (plx0 + plx1) / 2;
    if (k === 2) add(palmS, { color: null, slot: 'plant', x, y: TOP + 0.38, z, ry: k, ao: false });
    else if (k === 4) add(snake, { color: null, slot: 'plant', x, y: TOP + 0.38, z, ry: k, ao: false });
    else add(bushes[k % 3], { color: null, slot: 'foliage', x, y: TOP + 0.38, z, ry: k * 1.3, ao: false });
  });
  // os aparelhos de ar (descarga para cima: a grelha redonda, as hélices giram em props.terrace)
  const acZ = tz1 - 0.31, acs = [6.3, 7.35];
  for (const acx of acs) {
    add(rb(0.62, 0.56, 0.5, 0.03, 1), { color: '#e3e6e8', x: acx, y: TOP + 0.06, z: acZ });
    for (const sx of [-0.25, 0.25]) for (const sz of [-0.18, 0.18]) add(slab(0.06, 0.06, 0.06), { color: '#8e959a', x: acx + sx, y: TOP, z: acZ + sz, ao: false });
    for (let k = 0; k < 6; k++) add(slab(0.5, 0.012, 0.006), { color: '#9aa1a6', x: acx, y: TOP + 0.14 + k * 0.06, z: acZ - 0.252, ao: false });
    add(new THREE.CylinderGeometry(0.23, 0.23, 0.07, 18, 1, true), { color: '#c9cdd0', x: acx, y: TOP + 0.655, z: acZ, ao: false });
    add(cyl(0.22, 0.22, 0.004, 18), { color: '#2b2d30', x: acx, y: TOP + 0.62, z: acZ, ao: false });
    for (const rr of [0.11, 0.22]) add(new THREE.TorusGeometry(rr, 0.006, 4, 20).rotateX(Math.PI / 2), { color: '#7d848a', x: acx, y: TOP + 0.69, z: acZ, ao: false });
    for (const ry of [0, Math.PI / 2]) add(slab(0.46, 0.01, 0.012), { color: '#7d848a', x: acx, y: TOP + 0.685, z: acZ, ry, ao: false });
    // a tubulação isolada saindo para a casinha
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(acx - 0.31, TOP + 0.2, acZ), V(acx - 0.42, TOP + 0.05, acZ - 0.05), V(acx - 0.7, TOP + 0.025, acZ - 0.14), V(hx1 + 0.02, TOP + 0.025, acZ - 0.22 - (acx - 6.3) * 0.1)]), 12, 0.018, 6), { color: '#2b2d30', ao: false });
  }
  // o varal de chão encostado na mureta leste, com a toalha (balança em props.terrace) e uma fronha
  const rk = { x: tx1 - 0.3, z: -6.42, w: 0.42, d: 1.0, h: 0.95 };
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) add(stick(V(rk.x + sx * (rk.w / 2 + 0.03), TOP, rk.z + sz * (rk.d / 2 + 0.04)), V(rk.x + sx * rk.w / 2, TOP + rk.h, rk.z + sz * rk.d / 2), 0.011, 5), { color: '#f2f2ee', ao: false });
    add(stick(V(rk.x + sx * rk.w / 2, TOP + rk.h, rk.z - rk.d / 2), V(rk.x + sx * rk.w / 2, TOP + rk.h, rk.z + rk.d / 2), 0.011, 5), { color: '#f2f2ee', ao: false });
  }
  for (let k = 1; k < 6; k++) {
    const xx = rk.x - rk.w / 2 + (k * rk.w) / 6;
    add(stick(V(xx, TOP + rk.h, rk.z - rk.d / 2), V(xx, TOP + rk.h, rk.z + rk.d / 2), 0.005, 4), { color: '#e6e6e0', ao: false });
  }
  add(clothGeo(0.36, 0.3, 4, 4, (u, v, i, j) => new THREE.Color(hash(i, j, 3) < 0.2 ? '#fffaf0' : '#f7c6d4'), { amp: 0.008 }), { color: null, x: rk.x, y: TOP + rk.h - 0.005, z: rk.z + 0.28, ry: Math.PI / 2, ao: false });
  // a cadeira de plástico branca
  const chair = (cx, cz, ry) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (lx2, lz2) => ({ x: cx + lx2 * c + lz2 * s, z: cz - lx2 * s + lz2 * c });
    const white = '#f4f2ec';
    add(rb(0.44, 0.035, 0.42, 0.04, 1), { color: white, ...at(0, 0.02), y: TOP + 0.42, ry });
    add(rb(0.44, 0.42, 0.03, 0.04, 1).rotateX(-0.16), { color: white, ...at(0, -0.19), y: TOP + 0.44, ry });
    for (const sx of [-1, 1]) {
      add(rb(0.04, 0.03, 0.36, 0.012, 1), { color: white, ...at(sx * 0.215, 0.0), y: TOP + 0.62, ry, ao: false });
      add(slab(0.03, 0.18, 0.03), { color: white, ...at(sx * 0.215, 0.16), y: TOP + 0.45, ry, ao: false });
      for (const sz of [-1, 1]) {
        const p0 = at(sx * 0.19, sz * 0.18), p1 = at(sx * 0.23, sz * 0.22);
        add(stick(V(p0.x, TOP + 0.43, p0.z), V(p1.x, TOP, p1.z), 0.02, 6), { color: white, ao: false });
      }
    }
  };
  chair(5.72, -5.82, 2.4);
  potAt(add, { x: 5.42, z: tz1 - 0.16, y: TOP, r: 0.12, h: 0.3, color: '#c46a43', plant: snakePlant({ h: 0.6, n: 9, seed: 7 }) });
  potAt(add, { x: 5.8, z: tz1 - 0.16, y: TOP, r: 0.11, h: 0.26, color: '#b5583a', plant: bushes[1], plantSlot: 'foliage' });
  potAt(add, { x: tx0 + 0.6, z: tz0 + 0.3, y: TOP, r: 0.2, h: 0.42, color: '#9a8f86', plant: flowerBush({ r: 0.26, seed: 44, flower: '#f6f0e6', n: 6 }), plantSlot: 'foliage' });
  add(grate(0.16, 3), { color: null, slot: 'ground', x: 6.8, y: TOP + 0.003, z: -5.95, ao: false });
  add(blob(0.24, 8), { color: '#b9a88e', slot: 'glass', x: 6.55, y: TOP + 0.0055, z: -6.12, sz: 0.6, ao: false });
  add(blob(0.16, 11), { color: '#b9a88e', slot: 'glass', x: 4.6, y: TOP + 0.003, z: -8.2, sz: 0.7, ao: false });

  // ---------- as fachadas: janelas (a do saguão acesa) com grade, o buzinote, o medidor, a placa, o interfone, a luminária
  windowAt(kit, { x: 4.35, y: 1.5, z: z1, w: 0.8, h: 0.9, nx: 0, nz: 1, lit: true, group: g });
  for (const wx of [5.75, 7.4]) windowAt(kit, { x: wx, y: 1.5, z: z1, w: 0.9, h: 0.9, nx: 0, nz: 1, group: g });
  for (const wz2 of [-6.95, -8.1]) windowAt(kit, { x: x1, y: 1.5, z: wz2, w: 0.8, h: 0.9, nx: 1, nz: 0, group: g });
  const bars = '#3a3f44';
  for (const wx of [5.75, 7.4]) for (let k = 0; k < 5; k++) add(stick(V(wx - 0.36 + k * 0.18, 1.06, z1 + 0.1), V(wx - 0.36 + k * 0.18, 1.95, z1 + 0.1), 0.008, 4), { color: bars, ao: false });
  for (const wz2 of [-6.95, -8.1]) for (let k = 0; k < 4; k++) add(stick(V(x1 + 0.1, 1.06, wz2 - 0.3 + k * 0.2), V(x1 + 0.1, 1.95, wz2 - 0.3 + k * 0.2), 0.008, 4), { color: bars, ao: false });
  // o buzinote da laje na fachada leste (a água da chuva da noite ainda pinga): a mancha escorrida na parede e a
  // poça na grama, embaixo (nada em pé onde as dogs andam)
  const bz2 = -8.45;
  add(stick(V(x1 - 0.02, TOP + 0.03, bz2), V(x1 + 0.2, TOP + 0.01, bz2), 0.03, 8), { color: '#9aa1a6', ao: false });
  add(slab(0.006, WH - 0.32, 0.09), { color: '#dcc7a6', x: x1 + 0.0035, y: 0.31, z: bz2, ao: false });
  add(blob(0.22, 12), { color: '#5f7a4a', slot: 'glass', x: x1 + 0.3, y: 0.004, z: bz2, sz: 0.7, ao: false });
  drips.push({ x: x1 + 0.2, z: bz2, y0: TOP - 0.01, y1: 0.004, period: 2.8, phase: 1.1, ripple: false });
  // o medidor de luz na fachada sul, com o eletroduto subindo
  add(rb(0.3, 0.42, 0.12, 0.015, 1), { color: '#b9bec2', x: 6.57, y: 1.08, z: z1 + 0.06 });
  add(slab(0.16, 0.11, 0.008), { color: '#cfe4ee', slot: 'glass', x: 6.57, y: 1.3, z: z1 + 0.122, ao: false });
  add(stick(V(6.57, 1.5, z1 + 0.04), V(6.57, WH, z1 + 0.04), 0.015, 6), { color: '#9aa1a6', ao: false });
  // ao lado da porta (fachada oeste): a placa lisa de latão, o interfone e a luminária acesa
  add(rb(0.016, 0.22, 0.32, 0.006, 1), { color: '#c9a04e', x: x0 - 0.008, y: 1.3, z: -5.3, ao: false });
  add(slab(0.008, 0.16, 0.26), { color: '#efe6d2', x: x0 - 0.018, y: 1.33, z: -5.3, ao: false });
  add(rb(0.02, 0.2, 0.11, 0.008, 1), { color: '#8e959a', x: x0 - 0.01, y: 1.2, z: dz0 - 0.2, ao: false });
  for (let k = 0; k < 3; k++) add(cyl(0.008, 0.008, 0.01, 6).rotateZ(Math.PI / 2), { color: '#f2f2ee', x: x0 - 0.022, y: 1.26 + k * 0.035, z: dz0 - 0.2, ao: false });
  add(slab(0.02, 0.16, 0.1), { color: '#5d6368', x: x0 - 0.01, y: 2.18, z: dzc, ao: false });
  add(stick(V(x0 - 0.02, 2.26, dzc), V(x0 - 0.1, 2.3, dzc), 0.01, 5), { color: '#5d6368', ao: false });
  add(new THREE.SphereGeometry(0.06, 10, 8), { color: '#fff2c8', slot: 'lit', x: x0 - 0.12, y: 2.26, z: dzc, ao: false });
  add(new THREE.ConeGeometry(0.08, 0.06, 10), { color: '#5d6368', x: x0 - 0.12, y: 2.34, z: dzc, ao: false });
  // o capacho de fibra com a patinha (piso baixo, por cima do caminho)
  add(slab(0.5, 0.014, 0.78), { color: speckle('#a87a46', 0.06, 15), x: x0 - 0.3, y: 0.005, z: dzc, ao: false });
  const paw = [[-0.07, -0.06, 0.07, 0.07]];
  for (const [ddx, ddz] of [[-0.11, -0.12], [-0.04, -0.16], [0.04, -0.16], [0.11, -0.12]]) paw.push([ddx - 0.028, ddz - 0.03, ddx + 0.028, ddz + 0.03]);
  add(flatQuads(paw.map(([a0, b0, a1, b1]) => [a0, b0, a1, b1, '#5a3418'])), { color: null, slot: 'ground', x: x0 - 0.3, y: 0.0225, z: dzc + 0.04, ry: -Math.PI / 2, ao: false });

  // ---------- o saguão à meia-luz: o piso de granito, as paredes de dentro, o começo da escada, a luz, as caixas de
  // correio e o extintor (tudo alto ou fora de onde as dogs andam)
  const lbx1 = T.x0 + 1.5, lbz0 = L.TOWER_LOBBY.z0;
  // o contrapiso do prédio todo (por baixo, a grama da base não aparece por dentro) e o granito do saguão por cima
  add(new THREE.PlaneGeometry(x1 - wt - xi, zi - zn).rotateX(-Math.PI / 2), { color: '#6f6a63', slot: 'ground', x: (xi + x1 - wt) / 2, y: 0.006, z: (zn + zi) / 2, ao: false });
  add(tiles(lbx1 - xi, zi - lbz0, 0.4, 0.4, cells(['#8b857d', '#938d84', '#837d75'], 0.4, 27)), { color: null, slot: 'ground', x: (xi + lbx1) / 2, y: 0.012, z: (lbz0 + zi) / 2, ao: false });
  const lobbyWall = (ax, bx, az, bz) => add(rb(bx - ax, WH, bz - az, 0.015, 1), { color: inner, x: (ax + bx) / 2, z: (az + bz) / 2 });
  const sw0 = -6.62, sw1 = -5.5, stx1 = 7.1;
  lobbyWall(xi, lbx1 + 0.12, lbz0 - 0.06, lbz0 + 0.06);
  lobbyWall(lbx1, lbx1 + 0.12, lbz0 + 0.06, sw0 - 0.12);
  lobbyWall(lbx1, lbx1 + 0.12, sw1 + 0.12, zi);
  lobbyWall(lbx1, stx1, sw0 - 0.12, sw0);
  lobbyWall(lbx1, stx1, sw1, sw1 + 0.12);
  lobbyWall(stx1, stx1 + 0.12, sw0, sw1);
  for (let k = 0; k < 7; k++) {
    const sx0 = lbx1 + k * 0.28, stepTop = 0.012 + 0.17 * (k + 1), w = k === 6 ? stx1 - sx0 : 0.28;
    add(slab(w, stepTop, sw1 - sw0 - 0.01), { color: speckle('#a9a39a', 0.04, 40 + k), x: sx0 + w / 2, z: (sw0 + sw1) / 2, ao: false });
    add(slab(0.035, 0.008, sw1 - sw0 - 0.02), { color: '#6f6a64', x: sx0 + 0.0175, y: stepTop, z: (sw0 + sw1) / 2, ao: false });
  }
  const hr = (x) => V(x, 0.012 + 0.17 * 0.5 + 0.9 + (0.17 / 0.28) * (x - lbx1), sw1 - 0.035);
  add(stick(hr(lbx1 + 0.05), hr(stx1 - 0.08), 0.02, 8), { color: '#6b4a34', ao: false });
  for (const x of [lbx1 + 0.2, (lbx1 + stx1) / 2, stx1 - 0.25]) add(stick(hr(x), V(x, hr(x).y, sw1 - 0.002), 0.008, 4), { color: '#8e959a', ao: false });
  add(cyl(0.15, 0.13, 0.05, 16), { color: '#f4f2ec', x: (xi + lbx1) / 2, y: WH - 0.05, z: dzc, ao: false });
  add(cyl(0.12, 0.12, 0.012, 16), { color: '#fff2d0', slot: 'lit', x: (xi + lbx1) / 2, y: WH - 0.062, z: dzc, ao: false });
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 3; i++) {
      const mbx = xi + 0.3 + i * 0.29, mby = 1.15 + j * 0.2;
      add(slab(0.27, 0.17, 0.1), { color: '#8fa3b0', x: mbx, y: mby, z: lbz0 + 0.06 + 0.05, ao: false });
      add(slab(0.16, 0.018, 0.004), { color: '#2f3134', x: mbx, y: mby + 0.11, z: lbz0 + 0.06 + 0.102, ao: false });
    }
  }
  const ex = lbx1 - 0.25, ez = zi - 0.075;
  add(cyl(0.062, 0.062, 0.34, 10), { color: '#d63a32', x: ex, y: 0.98, z: ez });
  add(new THREE.SphereGeometry(0.062, 10, 5, 0, TAU, 0, Math.PI / 2), { color: '#d63a32', x: ex, y: 1.32, z: ez, ao: false });
  add(rb(0.05, 0.05, 0.04, 0.01, 1), { color: '#2b2b30', x: ex, y: 1.37, z: ez, ao: false });
  add(stick(V(ex + 0.02, 1.4, ez), V(ex + 0.07, 1.1, ez - 0.02), 0.008, 4), { color: '#2b2b30', ao: false });
  for (const [ax0, az0, ax1, az1] of [[xi, lbz0 + 0.06, xi + 0.004, dz0], [xi, dz1, xi + 0.004, zi], [xi, zi - 0.004, lbx1, zi], [xi, lbz0 + 0.06, lbx1, lbz0 + 0.064]]) {
    add(slab(ax1 - ax0, 1.0, az1 - az0), { color: '#d9cfbf', x: (ax0 + ax1) / 2, z: (az0 + az1) / 2, ao: false });
  }

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

/** A sapata da mola aérea: no batente da porta da torre, do lado do saguão, logo abaixo da verga. */
function doorShoe(L) {
  const D = L.TOWER_DOOR;
  return V(D.hinge.x + L.WALLS.t / 2 + 0.015, D.h + 0.03, D.hinge.z + 0.46);
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
  const inox = '#d3d8dc';
  const leaf = bake([
    [rb(0.05, H - 0.025, len - 0.03, 0.012, 2), { color: speckle('#3f7f86', 0.025, 3), y: 0.02, z: -len / 2 }],
    // os chutadores de inox embaixo, dos dois lados
    [slab(0.004, 0.22, len - 0.12), { color: inox, x: 0.027, y: 0.04, z: -len / 2 }],
    [slab(0.004, 0.22, len - 0.12), { color: inox, x: -0.027, y: 0.04, z: -len / 2 }],
    // a chapa de empurrar (do lado de fora, +x local) e o puxador (do lado do saguão, −x local)
    [rb(0.006, 0.34, 0.11, 0.003, 1), { color: inox, x: 0.029, y: 0.92, z: -len + 0.16 }],
    [stick(V(-0.07, 0.86, -len + 0.15), V(-0.07, 1.22, -len + 0.15), 0.012, 8), { color: inox }],
    [stick(V(-0.026, 0.9, -len + 0.15), V(-0.07, 0.9, -len + 0.15), 0.01, 6), { color: inox }],
    [stick(V(-0.026, 1.18, -len + 0.15), V(-0.07, 1.18, -len + 0.15), 0.01, 6), { color: inox }],
    // a moldura do visor
    [slab(0.056, 0.03, 0.14), { color: '#2f6066', y: 0.97, z: -len + 0.19 }],
    [slab(0.056, 0.03, 0.14), { color: '#2f6066', y: 1.5, z: -len + 0.19 }],
    // as dobradiças (no eixo: não mudam com a abertura)
    ...[0.3, 1.0, 1.7].map((y) => [cyl(0.014, 0.014, 0.11, 8), { color: '#9aa1a6', y, z: -0.012 }]),
    // a caixa da mola aérea, no alto, do lado do saguão, perto da dobradiça, e o eixo do braço em cima dela
    [rb(0.06, 0.055, 0.3, 0.012, 1), { color: '#c4c8cb', x: -0.056, y: H - 0.035, z: -0.24 }],
    [cyl(0.013, 0.013, 0.025, 8), { color: '#8e959a', x: -0.066, y: H + 0.015, z: -0.11 }],
  ]);
  pivot.add(mesh(leaf, SLOTS.solid(), { name: 'recanto:porta-da-torre:folha' }));
  pivot.add(mesh(bake([[slab(0.058, 0.5, 0.11), { color: '#a9d0e2', y: 1.0, z: -len + 0.19 }]]), SLOTS.glass(), { cast: false, name: 'recanto:porta-da-torre:visor' }));
  // o braço da mola: duas hastes no plano do alto da porta, do eixo (gira com a folha) até a sapata do batente
  const spindle = V(-0.066, H + 0.03, -0.11);
  const F = doorShoe(L);
  const A = 0.27, B = 0.29;
  const link1 = mesh(paint(new THREE.BoxGeometry(0.022, 0.012, 1), '#bfc4c8'), SLOTS.solid(), { name: 'recanto:porta-da-torre:braco-1' });
  const link2 = mesh(paint(new THREE.BoxGeometry(0.022, 0.012, 1), '#bfc4c8'), SLOTS.solid(), { name: 'recanto:porta-da-torre:braco-2' });
  const elbow = mesh(paint(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8), '#9aa1a6'), SLOTS.solid(), { name: 'recanto:porta-da-torre:cotovelo' });
  group.add(link1, link2, elbow);
  const S = new THREE.Vector3(), E = new THREE.Vector3(), M = new THREE.Vector3();
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
  }
  setOpen(0);
  return { prop: { object: group, setOpen } };
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
