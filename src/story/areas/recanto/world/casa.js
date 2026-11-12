// RECANTO DAS PATINHAS — a casa das irmãs e o quintal, para a câmera em 3ª pessoa (de perto e de baixo).
// A casa é inteira (paredes até o forro, telhado de duas águas, janelas de verdade com a luz da manhã): o QUARTO lilás
// (a caminha redonda embaixo do basculante, o pote d'água que vira, guarda-roupa, cômoda com abajur, estante, tapete e
// brinquedos), a COZINHA de azulejo (bancada com pia e fogão, armários, geladeira com ímãs, mesa e cadeiras, os potes
// de ração) e a SALA (sofá, poltrona, mesinha, rack com TV, estante alta, plantas). Peças dos puzzles: a GRADE do
// quarto (a folha na dobradiça e a parte fixa com a portinha de gato), o PEDAL que a solta (o cabinho vermelho liga um
// ao outro), o SACO DE RAÇÃO na frente da maçaneta e a porta da cozinha com a alavanca do lado de dentro.
// O QUINTAL: o muro com a passagem baixa (o arco de escoar água, com a calhinha), a porta da área de serviço com o
// FERROLHO do lado de fora (a argola na cordinha, pendurada na mão-francesa do pilar), o GALHO da tempestade (a tora e
// as folhas dentro do colisor, na frente da passagem) em cima das telhas, a casinha, canteiros, capim e flores, poças.
// O que colide tem colisor em ../layout.js (STATIC_COLLIDERS); o resto fica rente ao chão (até 8 cm) ou no alto.
import * as THREE from 'three';
import { rng, foliageCluster, paint, mergeGeometries, mergeVertices, leafSkin } from '../../../../world/util.js';
import { lavender } from '../../../../world/plants.js';
import { buildWallButton } from '../../../../world/wallButton.js';
import { rb, cyl, slab, sphere, rod, tiles, tilesV, gableRoof, SLOTS, wallBox, weathered } from '../../../../levels/mapa/world/kit.js';

const TAU = Math.PI * 2;
const C = (hex) => new THREE.Color(hex);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;
const KEEP = ['position', 'normal', 'color'];
const TRIM = '#fff8ec';
const _up = new THREE.Vector3(0, 1, 0);
const _qa = new THREE.Quaternion();
const _va = new THREE.Vector3();

// ---------------------------------------------------------------- cores
/** Variação suave de uma cor (reboco, madeira, tecido). */
function vary(hex, amp = 0.05, f = 7) {
  const c = C(hex), out = new THREE.Color();
  return (p) => {
    const n = Math.sin(p.x * f * 1.7 + p.z * f * 2.3 + p.y * f) * 0.5 + Math.sin(p.x * f * 5.1 - p.z * f * 3.7) * 0.5;
    return out.copy(c).multiplyScalar(1 + n * amp);
  };
}
/** Tábuas: cor por tábua (fiadas de 16 cm, emendas a cada 90 cm), ao longo de x ou de z. */
function planks(base, alt, alongZ = false) {
  const a = C(base), b = C(alt), out = new THREE.Color();
  return (p) => {
    const u = alongZ ? p.x : p.z, v = alongZ ? p.z : p.x;
    const row = Math.floor(u / 0.16);
    const col = Math.floor((v + (Math.abs(row) % 2) * 0.45) / 0.9);
    const k = Math.abs(Math.sin(row * 12.9898 + col * 78.233)) % 1;
    return out.copy(a).lerp(b, k * 0.8);
  };
}
/** Ladrilho xadrez de lado s. */
function checker(a, b, s = 0.3) {
  const ca = C(a), cb = C(b);
  return (p) => ((Math.floor(p.x / s) + Math.floor(p.z / s)) % 2 === 0 ? ca : cb);
}
/** Número pseudoaleatório fixo de dois inteiros (0..1). */
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- formas
/** Haste entre dois pontos [x, y, z]. */
function rodAB(a, b, r, seg = 6) {
  _va.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(1e-4, _va.length());
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.applyQuaternion(_qa.setFromUnitVectors(_up, _va.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
/** Tronco de cone entre dois pontos [x, y, z] (r0 em a, r1 em b): galhos. */
function limbAB(a, b, r0, r1, seg = 7) {
  _va.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(1e-4, _va.length());
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.applyQuaternion(_qa.setFromUnitVectors(_up, _va.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
/** Tubo por pontos [x, y, z] (mangueira, cabo, caule, alça). */
function tubeAlong(pts, r, radial = 5, segs = 24) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))), segs, r, radial, false);
}
/** Forma plana no plano XY (voltada para +Z). */
function shapeXY(pts) {
  const s = new THREE.Shape();
  pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  return new THREE.ShapeGeometry(s, 1);
}
/** Contorno irregular de raio r (poças, manchas). */
function blobPts(r, seed, n = 18) {
  const R = rng(seed);
  const ph = [R() * TAU, R() * TAU, R() * TAU];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + 0.16 * Math.sin(2 * a + ph[0]) + 0.09 * Math.sin(3 * a + ph[1]) + 0.05 * Math.sin(5 * a + ph[2]));
    out.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return out;
}
/** Decalque irregular deitado no chão (voltado para cima). */
const flatBlob = (r, seed, n = 18) => shapeXY(blobPts(r, seed, n)).rotateX(-Math.PI / 2);
/**
 * Disco plano no plano XY (voltado para +Z), esticado e deslocado.
 * @returns {THREE.BufferGeometry}
 */
const disc = (r, x = 0, y = 0, sx = 1, sy = 1, n = 14) => new THREE.CircleGeometry(r, n).scale(sx, sy, 1).translate(x, y, 0);
/** Folha caída: a nervura dobrada em V e a ponta levantada (nunca rente a outra coisa). */
function leafGeo(len, w) {
  const s = new THREE.Shape();
  s.moveTo(0, -len / 2);
  s.quadraticCurveTo(w, -len * 0.1, 0, len / 2);
  s.quadraticCurveTo(-w, -len * 0.1, 0, -len / 2);
  const g = new THREE.ShapeGeometry(s, 3).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(p.getX(i)) * 0.22 + Math.max(0, -p.getZ(i) - len * 0.15) * 0.1);
  g.computeVertexNormals();
  return g;
}
/**
 * Pictogramas planos (no plano XY, voltados para +Z, centrados, de lado ~s): osso, patinha, coração, cenoura, sol.
 * → [[geometria, cor | null], …] (null: a cor de quem pede).
 * @param {string} kind @param {number} s
 * @returns {[THREE.BufferGeometry, string | null][]}
 */
function picto(kind, s) {
  if (kind === 'osso') {
    /** @type {THREE.BufferGeometry[]} */
    const parts = [new THREE.PlaneGeometry(s * 0.6, s * 0.2)];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) parts.push(disc(s * 0.14, sx * s * 0.31, sy * s * 0.1));
    return [[mergeGeometries(parts), null]];
  }
  if (kind === 'pata') {
    return [[mergeGeometries([
      disc(s * 0.24, 0, -s * 0.13, 1.15, 0.95), disc(s * 0.1, -s * 0.31, s * 0.07, 0.9, 1.15), disc(s * 0.11, -s * 0.12, s * 0.28, 0.9, 1.15),
      disc(s * 0.11, s * 0.12, s * 0.28, 0.9, 1.15), disc(s * 0.1, s * 0.31, s * 0.07, 0.9, 1.15),
    ]), null]];
  }
  if (kind === 'coracao') {
    return [[mergeGeometries([disc(s * 0.2, -s * 0.17, s * 0.12), disc(s * 0.2, s * 0.17, s * 0.12), shapeXY([[-s * 0.355, s * 0.03], [s * 0.355, s * 0.03], [0, -s * 0.4]])]), null]];
  }
  if (kind === 'cenoura') {
    const body = shapeXY([[-s * 0.15, s * 0.16], [s * 0.15, s * 0.16], [s * 0.03, -s * 0.46], [-s * 0.03, -s * 0.46]]);
    const top = mergeGeometries([disc(s * 0.07, -s * 0.1, s * 0.33, 0.7, 1.6), disc(s * 0.07, 0, s * 0.38, 0.7, 1.7), disc(s * 0.07, s * 0.1, s * 0.33, 0.7, 1.6)]);
    return [[mergeGeometries([body, disc(s * 0.15, 0, s * 0.16, 1, 0.5)]), '#f07a1a'], [top, '#5c9a3a']];
  }
  // sol
  /** @type {THREE.BufferGeometry[]} */
  const parts = [disc(s * 0.22, 0, 0, 1, 1, 18)];
  for (let i = 0; i < 8; i++) parts.push(new THREE.PlaneGeometry(s * 0.06, s * 0.16).translate(0, s * 0.36, 0).rotateZ((i / 8) * TAU));
  return [[mergeGeometries(parts), null]];
}

/** Moita florida leve (duas bolhas de folhagem e florzinhas por cima): para floreiras, vasos e canteiros. */
function bushGeo(r, h, seed, flower, n = 7) {
  const R = rng(seed);
  /** @type {THREE.BufferGeometry[]} */
  const parts = [foliageCluster([{ x: 0, y: h * 0.5, z: 0, r, sy: 0.7 }, { x: r * 0.45, y: h * 0.62, z: r * 0.2, r: r * 0.7, sy: 0.75 }], { detail: 1, amp: 0.3, freq: 9, seed, dark: '#2f4d1f', mid: '#4f7a2e', light: '#86a94a' })];
  const fc = new THREE.Color(flower);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, rr = Math.sqrt(R()) * r * 0.8;
    const g = new THREE.IcosahedronGeometry(0.024 + R() * 0.01, 0);
    g.translate(Math.cos(a) * rr, h * 0.5 + r * 0.62 * Math.sqrt(Math.max(0, 1 - (rr / r) ** 2)) + 0.012, Math.sin(a) * rr);
    parts.push(paint(g, fc.clone().offsetHSL(0, 0, (R() - 0.5) * 0.1)));
  }
  return mergeGeometries(parts.map((g) => {
    const q = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(q.attributes)) if (!KEEP.includes(k)) q.deleteAttribute(k);
    return q;
  }));
}

/** Junta peças pintadas numa geometria só, como o kit, para os objetos que se mexem (uma malha cada). */
function createBaker() {
  const list = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    /**
     * color: cor (string ou THREE.Color), função (posição local, normal) → Color, ou null para manter a da geometria.
     * @param {THREE.BufferGeometry} geo
     * @param {{ color?: any, x?: number, y?: number, z?: number, rx?: number, ry?: number, rz?: number, sx?: number, sy?: number, sz?: number }} [o]
     */
    add(geo, { color = '#ffffff', x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
      for (const k of Object.keys(geo.attributes)) if (!KEEP.includes(k)) geo.deleteAttribute(k);
      const g = geo.clone();
      if (!g.index) {
        const n = g.attributes.position.count;
        g.setIndex(Array.from({ length: n }, (_, i) => i));
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (color !== null || !g.attributes.color) paint(g, color ?? '#ffffff');
      e.set(rx, ry, rz);
      q.setFromEuler(e);
      m.compose(p.set(x, y, z), q, s.set(sx, sy, sz));
      g.applyMatrix4(m);
      list.push(g);
      return g;
    },
    build() {
      const g = mergeGeometries(list);
      for (const x of list) x.dispose();
      list.length = 0;
      g.computeBoundingSphere();
      return g;
    },
  };
}
/** Uma malha de cor por vértice com as peças de um baker. */
function bakedMesh(baker, name, { rough = 0.75, metal = 0, cast = true } = {}) {
  const m = new THREE.Mesh(baker.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal }));
  m.name = name;
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

/** Tubo de cordinha atualizável (número fixo de pontos), com as pernas torcidas na cor. */
function createCordTube(n, radial, base) {
  const g = new THREE.BufferGeometry();
  const vc = n * (radial + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
  const col = new Float32Array(vc * 3);
  const idx = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      c.copy(base).multiplyScalar(0.74 + 0.26 * (0.5 + 0.5 * Math.cos((j / radial) * TAU * 2 + i * 1.6)));
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
      if (i < n - 1 && j < radial) {
        const b = k + radial + 1;
        idx.push(k, k + 1, b, b, k + 1, b + 1);
      }
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), ref = new THREE.Vector3();
  /** @param {THREE.Vector3[]} P @param {number} r */
  function update(P, r) {
    const pos = g.attributes.position.array, nor = g.attributes.normal.array;
    for (let i = 0; i < n; i++) {
      T.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]);
      if (T.lengthSq() < 1e-12) T.set(0, -1, 0);
      T.normalize();
      // a cordinha corre no plano norte–sul: o leste serve de referência fixa (sem torção entre os pontos)
      ref.set(1, 0, 0);
      if (Math.abs(T.dot(ref)) > 0.95) ref.set(0, 0, 1);
      N.crossVectors(T, ref).normalize();
      B.crossVectors(T, N);
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const nx = N.x * ca + B.x * sa, ny = N.y * ca + B.y * sa, nz = N.z * ca + B.z * sa;
        const k = (i * (radial + 1) + j) * 3;
        pos[k] = P[i].x + nx * r;
        pos[k + 1] = P[i].y + ny * r;
        pos[k + 2] = P[i].z + nz * r;
        nor[k] = nx;
        nor[k + 1] = ny;
        nor[k + 2] = nz;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
  }
  return { geometry: g, update };
}

/**
 * Telhado de duas águas (cumeeira ao longo de x): as águas em fiadas de telha (cor por telha), as empenas na cor do
 * reboco e o forro do beiral por baixo. Base w × d (já com o beiral) em y = 0, centrada.
 */
function tiledRoof(w, d, h, { tile = 0.34, gable = '#f3d9bf', under = '#e9dcc6' } = {}) {
  const pos = [], col = [];
  const hx = w / 2, hz = d / 2;
  const cols = Math.max(1, Math.round(w / tile)), rows = Math.max(1, Math.round(Math.hypot(hz, h) / tile));
  const tones = [C('#c4643f'), C('#b8573a'), C('#cf7248')], c = new THREE.Color();
  const tri = (a, b, cc, color) => { for (const v of [a, b, cc]) { pos.push(v[0], v[1], v[2]); col.push(color.r, color.g, color.b); } };
  for (const side of [1, -1]) { // 1: a água do sul (+z); −1: a do norte
    for (let r = 0; r < rows; r++) {
      const k0 = r / rows, k1 = (r + 1) / rows; // 0 no beiral, 1 na cumeeira
      const z0 = side * hz * (1 - k0), z1 = side * hz * (1 - k1), y0 = h * k0, y1 = h * k1;
      const off = (r % 2) * 0.5;
      for (let i = 0; i <= cols; i++) {
        const x0 = Math.max(-hx, -hx + (i - off) * (w / cols)), x1 = Math.min(hx, -hx + (i + 1 - off) * (w / cols));
        if (x1 - x0 < 1e-4) continue;
        c.copy(tones[Math.floor(hash(r * 3 + (side > 0 ? 0 : 50), i) * 3) % 3]).multiplyScalar(0.94 + 0.1 * hash(i, r + 7) - 0.1 * (1 - k1) * (r % 2));
        const A = [x0, y0, z0], B = [x1, y0, z0], Cc = [x1, y1, z1], D = [x0, y1, z1];
        if (side > 0) { tri(A, B, Cc, c); tri(A, Cc, D, c); } else { tri(A, Cc, B, c); tri(A, D, Cc, c); }
      }
    }
  }
  // empenas (leste e oeste) e o forro do beiral
  const cg = C(gable), cu = C(under);
  tri([hx, 0, hz], [hx, 0, -hz], [hx, h, 0], cg);
  tri([-hx, 0, -hz], [-hx, 0, hz], [-hx, h, 0], cg);
  tri([-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], cu);
  tri([-hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz], cu);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Recorta um polígono [[x, z], …] por um retângulo (Sutherland–Hodgman). */
function clipRect(poly, x0, x1, z0, z1) {
  const cut = (pts, inside, cross) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cross(a, b));
    }
    return out;
  };
  const atX = (x) => (a, b) => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
  const atZ = (z) => (a, b) => [a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]), z];
  let p = poly;
  p = cut(p, (q) => q[0] >= x0, atX(x0));
  p = cut(p, (q) => q[0] <= x1, atX(x1));
  p = cut(p, (q) => q[1] >= z0, atZ(z0));
  p = cut(p, (q) => q[1] <= z1, atZ(z1));
  return p;
}

/** Cortina: um pano em pregas (ondas ao longo da largura), com a base em y = 0. */
function curtainGeo(w, h, d = 0.035) {
  const g = new THREE.BoxGeometry(w, h, d, 8, 1, 1);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.sin((p.getX(i) / w) * TAU * 2.5) * 0.018 * (0.5 + 0.5 * (1 - p.getY(i) / h)));
  g.computeVertexNormals();
  return g;
}

/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildCasa(kit, root, L) {
  const R = rng(31);
  const H = L.HOUSE, WL = L.WALLS, RM = L.ROOMS, t = WL.t, ht = t / 2;
  const keep = (o) => { root.add(o); return o; };
  const add = (geo, o) => kit.add(geo, { group: 'casa', ...o });
  const addY = (geo, o) => kit.add(geo, { group: 'quintal', ...o });
  /** Pictograma numa face de normal (nx, nz), centrado em (x, y, z); `put`: quem recebe as peças (add, addY, baker). */
  const art = (put, kind, s, col, x, y, z, nx = 0, nz = 1, extra = {}) => {
    const ry = Math.atan2(nx, nz);
    for (const [g, c] of picto(kind, s)) put(g, { color: c ?? col, x, y, z, ry, ao: false, ...extra });
  };
  /** O mesmo, deitado no chão (voltado para cima), girado de `ry`. */
  const artFlat = (put, kind, s, col, x, y, z, ry = 0, extra = {}) => {
    for (const [g, c] of picto(kind, s)) put(g.rotateX(-Math.PI / 2), { color: c ?? col, x, y, z, ry, ao: false, ...extra });
  };

  const FL = 0.006; // o piso (logo acima do gramado: as patas ficam no chão)
  const XW = H.x0 + ht, XE = H.x1 - ht, ZN = H.z0 + ht, ZS = H.z1 - ht; // faces de dentro das paredes de fora
  const XM = RM.quarto.x1, ZM = RM.quarto.z1; // os centros das paredes de dentro
  const W = L.WINDOW, KD = L.KITCHEN_DOOR, DQ = L.DOORWAYS.quartoCozinha, DS = L.DOORWAYS.cozinhaSala;
  const K = L.COUNTER, F = L.FRIDGE, KT = L.KITCHEN_TABLE, SF = L.SOFA, TV = L.TV_RACK, CT = L.COFFEE_TABLE, AC = L.ARMCHAIR;
  const PASS_H = 2.05;
  const CEIL = WL.h - 0.046; // a face de baixo do forro
  const lilac = '#e7dcf2', mint = '#e5f1e1', yellow = '#f6e8c4', plaster = '#f3d9bf';
  const SINK_X = (K.x0 + K.x1) / 2, STOVE_X = K.x1 - 1.15;

  // móveis a mais, com colisão: as medidas vêm do layout (HOUSE_EXTRAS) quando ele as tiver; até lá, valem estas
  // (as mesmas pedidas para os colisores)
  const EX = L.HOUSE_EXTRAS ?? {
    chairs: [{ x: KT.x - 0.3, z: KT.z - KT.hz - 0.18, half: 0.2, face: 1 }, { x: KT.x + 0.3, z: KT.z + KT.hz + 0.18, half: 0.2, face: -1 }],
    bin: { x: XM + ht + 0.24, z: K.z1 + 0.3, r: 0.17 },
    bedroomShelf: { x: XM - ht - 0.17, z: H.z0 + 1.06, hx: 0.17, hz: 0.6, h: 1.05 },
    bedroomPlant: { x: XW + 0.32, z: ZM - ht - 0.32, r: 0.24 },
    bookcase: { x: SF.x, z: ZM + ht + 0.19, hx: 0.9, hz: 0.19, h: 2.1 },
    sideboard: { x: DS.x1 + 1.1, z: ZM + ht + 0.2, hx: 0.75, hz: 0.2, h: 0.8 },
    loveseat: { x: TV.x, z: TV.z - 2.4, hx: 0.75, hz: 0.4, h: 0.78 },
    pouf: { x: TV.x + 1.35, z: TV.z - 1.6, r: 0.26 },
    floorLamp: { x: AC.x - 0.55, z: AC.z - 0.75, r: 0.14 },
    plants: [{ x: XE - 0.34, z: ZS - 0.34, r: 0.26 }, { x: XE - 0.34, z: ZM + ht + 0.34, r: 0.24 }, { x: SF.x + 1.4, z: ZM + ht + 0.44, r: 0.22 }],
  };

  // janelas de verdade (vão na parede): a…b ao longo da parede, y0…y1 do peitoril ao alto
  const WIN = {
    pia: { a: SINK_X - 0.5, b: SINK_X + 0.5, y0: 1.08, y1: 1.78 }, // cozinha, norte, em cima da pia
    cozinha: { a: ZM - 1.86, b: ZM - 0.66, y0: 1.0, y1: 1.9 }, // cozinha, leste (o quintal)
    sala1: { a: ZM + 0.9, b: ZM + 2.3, y0: 0.85, y1: 1.95 }, // sala, leste
    sala2: { a: ZS - 2.2, b: ZS - 0.8, y0: 0.85, y1: 1.95 },
    salaSul: { a: SF.x + SF.hx + 0.5, b: TV.x - TV.hx - 0.6, y0: 0.95, y1: 1.95 }, // sala, sul, entre o sofá e o rack
  };
  const hBasc = { a: W.x0, b: W.x1, y0: W.sill, y1: W.top };
  const hDQ = { a: DQ.z0, b: DQ.z1, y0: 0, y1: PASS_H }, hDS = { a: DS.x0, b: DS.x1, y0: 0, y1: PASS_H };
  const hKD = { a: KD.hinge.z, b: KD.latchPost.z, y0: 0, y1: KD.h + 0.04 };

  // ---------------------------------------------------------------- pisos
  /** Piso de um cômodo: quadrados cw × cd, cada um com a cor de fn(i, j) (colunas em x, fiadas em z). */
  const floorOf = (x0, x1, z0, z1, cw, cd, fn) => {
    const w = x1 - x0, d = z1 - z0;
    const nx = Math.max(1, Math.round(w / cw)), nz = Math.max(1, Math.round(d / cd));
    add(tiles(w, d, cw, cd, (p) => fn(Math.min(nx - 1, Math.floor(((p.x + w / 2) / w) * nx)), Math.min(nz - 1, Math.floor(((p.z + d / 2) / d) * nz)))), { color: null, slot: 'ground', x: (x0 + x1) / 2, y: FL, z: (z0 + z1) / 2, ao: false });
  };
  /** Tábuas (cada uma ocupa dois quadrados, com a emenda desencontrada): fiadas em z (byRow) ou em x. */
  const plankTint = (base, alt, byRow) => {
    const a = C(base), b = C(alt), o = new THREE.Color();
    return (i, j) => { const r = byRow ? j : i, c = Math.floor(((byRow ? i : j) + (r % 2)) / 2); return o.copy(a).lerp(b, hash(r, c) * 0.85); };
  };
  floorOf(XW, XM - ht, ZN, ZM - ht, 0.45, 0.16, plankTint('#c8955f', '#a87445', true));
  {
    const ca = C('#f3e8d4'), cb = C('#dfa07c'), o = new THREE.Color();
    floorOf(XM + ht, XE, ZN, ZM - ht, 0.3, 0.3, (i, j) => o.copy((i + j) % 2 ? cb : ca).multiplyScalar(0.96 + 0.06 * hash(i, j)));
  }
  floorOf(XW, XE, ZM + ht, ZS, 0.16, 0.45, plankTint('#b98252', '#9a6a40', false));
  // soleiras: das passagens de dentro (madeira) e da porta da cozinha (pedra)
  add(slab(t + 0.02, 0.012, DQ.z1 - DQ.z0), { color: '#b08452', x: XM, y: FL, z: (DQ.z0 + DQ.z1) / 2, ao: false });
  add(slab(DS.x1 - DS.x0, 0.012, t + 0.02), { color: '#b08452', x: (DS.x0 + DS.x1) / 2, y: FL, z: ZM, ao: false });
  add(rb(t + 0.14, 0.03, KD.latchPost.z - KD.hinge.z, 0.008, 1), { color: '#cfc6b6', x: H.x1 + 0.04, y: -0.006, z: (KD.hinge.z + KD.latchPost.z) / 2, ao: false });
  /** Tapete: quadradinhos de 10 cm com a cor de fn(u, v) (u, v de −1 a 1), 4 mm acima do piso. */
  const rug = (x, z, hx, hz, fn) => add(tiles(hx * 2, hz * 2, 0.1, 0.1, (p) => fn(p.x / hx, p.z / hz)), { color: null, slot: 'ground', x, y: FL + 0.004, z, ao: false });

  // ---------------------------------------------------------------- paredes (inteiras, com os vãos de verdade)
  /** A cor de um trecho: `inside` na face oposta a (ox, oz), `out` nas outras; a base escurece (sombra de contato). */
  const wallTint = (out, inside, ox, oz, y0) => {
    const a = C(out), b = C(inside), o = new THREE.Color();
    return (p, n) => o.copy(n.x * ox + n.z * oz < -0.5 ? b : a).multiplyScalar(0.84 + 0.16 * clamp01((y0 + p.y) / 0.5));
  };
  /**
   * Parede ao longo de x (em z = c) ou de z (em x = c), de a0 a a1, com vãos { a, b, y0, y1 }. `od` (±1): o lado de
   * fora no eixo atravessado; a face oposta leva a cor de dentro.
   */
  const wallRun = (axis, c, a0, a1, out, inside, od, holes = [], ext = false) => {
    const box = (p0, p1, y0, y1) => {
      if (p1 - p0 < 0.005 || y1 - y0 < 0.005) return;
      const len = p1 - p0, mid = (p0 + p1) / 2, ox = axis === 'x' ? 0 : od, oz = axis === 'x' ? od : 0;
      // as de fora: o reboco gasto (respingos no barrado, umidade, escorridos embaixo do beiral); as de dentro, lisas
      add(ext ? (axis === 'x' ? wallBox(len, y1 - y0, t) : wallBox(t, y1 - y0, len)) : (axis === 'x' ? slab(len, y1 - y0, t) : slab(t, y1 - y0, len)), {
        color: ext ? weathered(out, { h: WL.h, y0, seed: c * 0.61 + mid * 0.07, along: axis === 'x' ? 'x' : 'z', inside, out: [ox, oz], eave: 0.3 }) : wallTint(out, inside, ox, oz, y0),
        x: axis === 'x' ? mid : c, y: y0, z: axis === 'x' ? c : mid, ao: false,
      });
    };
    // a faixa de baixo (até 0,5 m) à parte: o escurecido da base sai igual em todos os trechos
    const piece = (p0, p1, y0, y1) => { box(p0, p1, y0, Math.min(y1, 0.5)); box(p0, p1, Math.max(y0, 0.5), y1); };
    let p = a0;
    for (const h of [...holes].sort((m, n) => m.a - n.a)) {
      piece(p, h.a, 0, WL.h);
      piece(h.a, h.b, 0, h.y0);
      piece(h.a, h.b, h.y1, WL.h);
      p = h.b;
    }
    piece(p, a1, 0, WL.h);
  };
  // norte (o basculante do quarto e a janela da pia), oeste (o muro do condomínio por fora), sul e leste
  wallRun('x', H.z0, H.x0 - ht, XM, plaster, lilac, -1, [hBasc], true);
  wallRun('x', H.z0, XM, H.x1 + ht, plaster, mint, -1, [WIN.pia], true);
  wallRun('z', H.x0, ZN, ZM, '#efe2c8', lilac, -1, [], true);
  wallRun('z', H.x0, ZM, ZS, '#efe2c8', yellow, -1, [], true);
  wallRun('x', H.z1, H.x0 - ht, H.x1 + ht, plaster, yellow, 1, [WIN.salaSul], true);
  wallRun('z', H.x1, ZN, ZM, plaster, mint, 1, [hKD, WIN.cozinha], true);
  wallRun('z', H.x1, ZM, ZS, plaster, yellow, 1, [WIN.sala1, WIN.sala2], true);
  // de dentro: quarto | cozinha (a passagem da grade) e a parede da sala (a passagem da cozinha)
  wallRun('z', XM, ZN, ZM - ht, mint, lilac, 1, [hDQ]);
  // (as pontas entram 2 cm nas paredes de fora: nenhuma face delas fica no plano das beiradas do forro)
  wallRun('x', ZM, XW - 0.02, XM, yellow, lilac, 1);
  wallRun('x', ZM, XM, XE + 0.02, yellow, mint, 1, [hDS]);

  /** Caixa no referencial de uma parede: `along` no comprimento dela, `off` atravessado a partir de c. */
  const wbox = (axis, c, along, y, off, sa, sy, sc, color, extra = {}) => add(axis === 'x' ? slab(sa, sy, sc) : slab(sc, sy, sa), { color, x: axis === 'x' ? along : c + off, y, z: axis === 'x' ? c + off : along, ao: false, ...extra });
  /** Uma régua na face de uma parede (rodapé, roda-teto), pulando os vãos que a cortam. `c`: a face; `dir`: para onde ela olha. */
  const strip = (axis, c, a0, a1, dir, y, h, d, color, holes = []) => {
    const part = (p0, p1) => { if (p1 - p0 > 0.02) wbox(axis, c, (p0 + p1) / 2, y, (dir * d) / 2, p1 - p0, h, d, color); };
    let p = a0;
    for (const hh of [...holes].sort((m, n) => m.a - n.a)) {
      if (!(hh.y0 <= y + 1e-3 && hh.y1 >= y + h - 1e-3)) continue;
      part(p, hh.a);
      p = hh.b;
    }
    part(p, a1);
  };
  /** Faixa de quadrados (lambri, azulejo) 4 mm à frente da face de uma parede, pulando os vãos. fn(u, y, i, j) → cor. */
  const skin = (axis, c, a0, a1, dir, y0, y1, cw, ch, fn, holes = []) => {
    const ry = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const sgn = axis === 'x' ? dir : -dir; // o +X do plano no mundo
    const part = (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.03 || q1 - q0 < 0.03) return;
      const w = p1 - p0, hgt = q1 - q0, mid = (p0 + p1) / 2, my = (q0 + q1) / 2;
      const nx = Math.max(1, Math.round(w / cw)), ny = Math.max(1, Math.round(hgt / ch));
      const g = tilesV(w, hgt, cw, ch, (p) => fn(mid + sgn * p.x, my + p.y, Math.min(nx - 1, Math.floor(((p.x + w / 2) / w) * nx)), Math.min(ny - 1, Math.floor(((p.y + hgt / 2) / hgt) * ny))));
      add(g, { color: null, x: axis === 'x' ? mid : c + dir * 0.004, y: my, z: axis === 'x' ? c + dir * 0.004 : mid, ry, ao: false });
    };
    let p = a0;
    for (const hh of [...holes].sort((m, n) => m.a - n.a)) {
      if (hh.y0 >= y1 - 0.02) continue; // o vão começa acima da faixa
      part(p, hh.a, y0, y1);
      part(hh.a, hh.b, y0, Math.min(y1, hh.y0));
      p = hh.b;
    }
    part(p, a1, y0, y1);
  };

  // as faces de dentro de cada cômodo: eixo, face, de onde até onde, para onde olha e os vãos
  const FACES = {
    quarto: [
      { axis: 'x', c: ZN, a0: XW, a1: XM - ht, dir: 1, holes: [hBasc] }, { axis: 'z', c: XW, a0: ZN, a1: ZM - ht, dir: 1, holes: [] },
      { axis: 'x', c: ZM - ht, a0: XW, a1: XM - ht, dir: -1, holes: [] }, { axis: 'z', c: XM - ht, a0: ZN, a1: ZM - ht, dir: -1, holes: [hDQ] },
    ],
    cozinha: [
      { axis: 'x', c: ZN, a0: XM + ht, a1: XE, dir: 1, holes: [WIN.pia] }, { axis: 'z', c: XM + ht, a0: ZN, a1: ZM - ht, dir: 1, holes: [hDQ] },
      { axis: 'x', c: ZM - ht, a0: XM + ht, a1: XE, dir: -1, holes: [hDS] }, { axis: 'z', c: XE, a0: ZN, a1: ZM - ht, dir: -1, holes: [hKD, WIN.cozinha] },
    ],
    sala: [
      { axis: 'x', c: ZM + ht, a0: XW, a1: XE, dir: 1, holes: [hDS] }, { axis: 'z', c: XW, a0: ZM + ht, a1: ZS, dir: 1, holes: [] },
      { axis: 'x', c: ZS, a0: XW, a1: XE, dir: -1, holes: [WIN.salaSul] }, { axis: 'z', c: XE, a0: ZM + ht, a1: ZS, dir: -1, holes: [WIN.sala1, WIN.sala2] },
    ],
  };
  {
    const o = new THREE.Color();
    const base = (y) => 0.86 + 0.14 * clamp01(y / 0.45);
    // quarto: lambri de tábuas até 0,9 m; cozinha: azulejo até 1 m, com a fiada de cima colorida
    const boardA = C('#f6eefb'), boardB = C('#e9def4');
    const lambri = (u, y, i) => o.copy(i % 2 ? boardA : boardB).multiplyScalar(base(y) * (0.97 + 0.05 * hash(i, 3)));
    const tileA = C('#fbf7ee'), tileB = C('#f1ebdd'), tileC = C('#8fcdb8'), tileD = C('#f0a58a');
    const azulejo = (u, y, i, j) => o.copy(y > 0.82 ? (i % 3 ? tileC : tileD) : (hash(Math.round(u * 5), j) > 0.5 ? tileA : tileB)).multiplyScalar(base(y));
    for (const [room, faces] of Object.entries(FACES)) {
      for (const f of faces) {
        strip(f.axis, f.c, f.a0, f.a1, f.dir, FL, room === 'sala' ? 0.13 : 0.09, 0.018, TRIM, f.holes); // rodapé
        strip(f.axis, f.c, f.a0, f.a1, f.dir, CEIL - 0.07, 0.07, 0.045, TRIM); // roda-teto
        if (room === 'quarto') {
          skin(f.axis, f.c, f.a0, f.a1, f.dir, 0.09, 0.9, 0.15, 0.4, lambri, f.holes);
          strip(f.axis, f.c, f.a0, f.a1, f.dir, 0.9, 0.035, 0.022, TRIM, f.holes);
        } else if (room === 'cozinha' && f.c !== ZN) {
          skin(f.axis, f.c, f.a0, f.a1, f.dir, 0.09, 1.0, 0.2, 0.182, azulejo, f.holes);
        } else if (room === 'sala') {
          strip(f.axis, f.c, f.a0, f.a1, f.dir, 2.12, 0.03, 0.02, '#e7c98c'); // a régua dos quadros
        }
      }
    }
  }

  // ---------------------------------------------------------------- forro, telhado, vigas e luminárias
  const hw = H.x1 - H.x0, hd = H.z1 - H.z0, hcx = (H.x0 + H.x1) / 2, hcz = (H.z0 + H.z1) / 2;
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(hw - t, 0.04, hd - t), new THREE.MeshStandardMaterial({ color: '#f6efe4', roughness: 0.9 }));
  ceiling.name = 'recanto:forro';
  // o topo 6 mm abaixo do alto das paredes (no mesmo plano, brigaria com elas: z-fighting)
  ceiling.position.set(hcx, WL.h - 0.026, hcz);
  ceiling.receiveShadow = true;
  keep(ceiling);
  // o telhado de duas águas, sem sombra própria: o sol das cenas continua entrando nos cômodos
  const roof = new THREE.Mesh(tiledRoof(hw + 0.6, hd + 0.6, 1.35), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
  roof.name = 'recanto:telhado';
  roof.position.set(hcx, WL.h, hcz);
  roof.receiveShadow = true;
  keep(roof);
  // a cumeeira, a chaminé e os óculos das empenas
  add(rod(0.07, hw + 0.64, 8), { color: '#a94f33', x: hcx, y: WL.h + 1.35, z: hcz, rz: Math.PI / 2, ao: false });
  add(rb(0.5, 1.0, 0.5, 0.03, 1), { color: vary('#d9a184', 0.06, 9), x: H.x1 - 2.2, y: WL.h + 0.55, z: hcz + 2.4 });
  add(rb(0.6, 0.08, 0.6, 0.02, 1), { color: '#b98a6e', x: H.x1 - 2.2, y: WL.h + 1.55, z: hcz + 2.4, ao: false });
  for (const s of [-1, 1]) {
    add(rod(0.3, 0.03, 20), { color: TRIM, x: hcx + s * (hw / 2 + 0.3 + 0.004), y: WL.h + 0.5, z: hcz, rz: Math.PI / 2, ao: false });
    add(rod(0.23, 0.03, 20), { color: '#9cc4dc', slot: 'glass', x: hcx + s * (hw / 2 + 0.3 + 0.012), y: WL.h + 0.5, z: hcz, rz: Math.PI / 2 });
  }
  // calhas nos dois beirais e o cano de descida na quina nordeste (o pilar da quina tem colisor: 'casa-quina')
  for (const s of [-1, 1]) add(rb(hw + 0.6, 0.07, 0.09, 0.02, 1), { color: '#d8d0c4', x: hcx, y: WL.h - 0.075, z: hcz + s * (hd / 2 + 0.3 + 0.03), ao: false });
  add(rb(0.2, WL.h, 0.28, 0.02, 1), { color: vary(plaster, 0.03, 5), x: H.x1 + 0.02, z: H.z0 - 0.03 });
  add(cyl(0.03, 0.03, WL.h - 0.1, 8), { color: '#d8d0c4', x: H.x1 + 0.03, z: H.z0 - 0.175, ao: false });
  // por fora, a barra da base nas paredes do norte, do sul e do leste
  add(rb(hw + t + 0.04, 0.26, 0.03, 0.01, 1), { color: '#d8bfa0', x: hcx, z: H.z0 - ht - 0.012, ao: false });
  add(rb(hw + t + 0.04, 0.26, 0.03, 0.01, 1), { color: '#d8bfa0', x: hcx, z: H.z1 + ht + 0.012, ao: false });
  strip('z', H.x1 + ht, H.z0 + 0.16, H.z1 + ht, 1, 0, 0.26, 0.024, '#d8bfa0', [hKD]);
  // vigas de madeira no forro da sala e as luminárias pendentes (sem luz de verdade: o globo é emissivo)
  for (let i = 0; i < 4; i++) add(slab(0.14, 0.13, ZS - ZM - ht + 0.04), { color: vary('#9a6a40', 0.06, 5), x: lerp(XW + 1.5, XE - 1.5, i / 3), y: CEIL - 0.125, z: (ZM + ht + ZS) / 2, ao: false });
  /** Pendente: o fio do forro, a cúpula e o globo aceso. */
  const pendant = (x, z, drop, shade) => {
    add(rod(0.006, drop, 5), { color: '#4a4f57', x, y: CEIL - drop / 2, z, ao: false });
    add(cyl(0.05, 0.05, 0.02, 12), { color: TRIM, x, y: CEIL - 0.02, z, ao: false });
    add(cyl(0.06, 0.2, 0.15, 16), { color: shade, x, y: CEIL - drop - 0.15, z, ao: false });
    add(sphere(0.06, 12, 8), { color: '#fff1c2', slot: 'lit', x, y: CEIL - drop - 0.165, z });
  };
  pendant((XW + XM) / 2 + 0.4, (ZN + ZM) / 2 + 0.6, 0.5, '#cbb6e8');
  pendant(KT.x, KT.z, 0.75, '#f0a58a');
  pendant((XM + XE) / 2 - 0.8, ZN + 1.9, 0.5, '#8fcdb8');
  pendant(CT.x, CT.z - 0.2, 0.6, '#f2c25e');
  pendant(EX.loveseat.x, EX.loveseat.z + 0.9, 0.6, '#f2c25e');

  // ---------------------------------------------------------------- janelas e passagens
  const glassB = createBaker(); // os vidros de todas as janelas numa malha só (transparente)
  /** @type {number[]} */
  const sunPos = []; // as manchas de sol no piso (triângulos)
  const SUN = new THREE.Vector3(L.SUN.direction[0], L.SUN.direction[1], L.SUN.direction[2]).normalize();
  /** A mancha de sol de uma janela no piso do cômodo (recortada pelas paredes dele). */
  const sunPatch = (axis, face, h, room) => {
    const pts = [[h.a, h.y0], [h.b, h.y0], [h.b, h.y1], [h.a, h.y1]].map(([al, y]) => {
      const k = y / SUN.y;
      return axis === 'x' ? [al - SUN.x * k, face - SUN.z * k] : [face - SUN.x * k, al - SUN.z * k];
    });
    const poly = clipRect(pts, room.x0, room.x1, room.z0, room.z1);
    for (let i = 1; i + 1 < poly.length; i++) {
      const a = poly[0], b = poly[i], cc = poly[i + 1];
      // a volta que deixa a normal para cima
      const up = (b[1] - a[1]) * (cc[0] - a[0]) - (b[0] - a[0]) * (cc[1] - a[1]) > 0;
      for (const q of up ? [a, b, cc] : [a, cc, b]) sunPos.push(q[0], FL + 0.012, q[1]);
    }
  };
  /**
   * Janela num vão { a, b, y0, y1 } da parede `axis` em c (centro), com o lado de dentro em `dir` (±1): batente dos
   * quatro lados, travessas em cruz, peitoril dos dois lados e vidro. curtain: cor da cortina (dentro); shutter: cor das
   * venezianas (fora); flowers: floreira no peitoril de fora.
   */
  const windowAt = (axis, c, h, dir, { curtain = null, shutter = null, flowers = false, bars = true } = {}) => {
    const w = h.b - h.a, hh = h.y1 - h.y0, mid = (h.a + h.b) / 2;
    for (const al of [h.a + 0.02, h.b - 0.02]) wbox(axis, c, al, h.y0, 0, 0.04, hh, t + 0.05, TRIM);
    wbox(axis, c, mid, h.y1 - 0.04, 0, w, 0.04, t + 0.05, TRIM);
    wbox(axis, c, mid, h.y0, 0, w, 0.035, t + 0.05, TRIM);
    if (bars) {
      wbox(axis, c, mid, h.y0, 0, 0.03, hh, 0.036, TRIM);
      wbox(axis, c, mid, h.y0 + hh * 0.56, 0, w, 0.03, 0.036, TRIM);
    }
    wbox(axis, c, mid, h.y0 - 0.035, dir * (ht + 0.045), w + 0.12, 0.035, 0.11, '#c79a6a');
    wbox(axis, c, mid, h.y0 - 0.04, -dir * (ht + 0.04), w + 0.14, 0.04, 0.1, '#d6cfc4');
    glassB.add(new THREE.PlaneGeometry(w - 0.06, hh - 0.06), { color: '#bfe3f5', x: axis === 'x' ? mid : c, y: h.y0 + hh / 2, z: axis === 'x' ? c : mid, ry: axis === 'x' ? 0 : Math.PI / 2 });
    if (curtain) {
      const off = dir * (ht + 0.125), top = h.y1 + 0.1, len = top - Math.max(0.52, h.y0 - 0.3);
      wbox(axis, c, mid, top - 0.01, off, w + 0.56, 0.02, 0.02, '#c9b27a');
      for (const al of [h.a - 0.1, h.b + 0.1]) {
        add(curtainGeo(0.34, len), { color: vary(curtain, 0.06, 30), x: axis === 'x' ? al : c + off, y: top - len, z: axis === 'x' ? c + off : al, ry: axis === 'x' ? 0 : Math.PI / 2, ao: false });
      }
    }
    if (shutter) {
      const off = -dir * (ht + 0.02);
      for (const s of [-1, 1]) {
        const al = s < 0 ? h.a - w / 4 - 0.03 : h.b + w / 4 + 0.03;
        wbox(axis, c, al, h.y0 - 0.02, off, w / 2, hh + 0.04, 0.03, shutter);
        for (let i = 0; i < 6; i++) wbox(axis, c, al, h.y0 + 0.06 + (i * (hh - 0.12)) / 5.6, off - dir * 0.017, w / 2 - 0.1, 0.035, 0.008, '#4d958e');
      }
    }
    if (flowers) {
      const off = -dir * (ht + 0.14);
      wbox(axis, c, mid, h.y0 - 0.25, off, w - 0.1, 0.19, 0.2, '#c9764f', { ao: true });
      wbox(axis, c, mid, h.y0 - 0.07, off, w - 0.16, 0.012, 0.14, '#5a4030', { slot: 'ground' });
      const n = Math.max(2, Math.round((w - 0.2) / 0.36));
      for (let i = 0; i < n; i++) {
        const al = h.a + 0.2 + (i * (w - 0.4)) / Math.max(1, n - 1);
        const g = bushGeo(0.12, 0.14, 80 + i, ['#ff6a55', '#fff6ee', '#f2c230', '#e8708a'][i % 4], 6);
        add(g, { color: null, slot: 'plant', x: axis === 'x' ? al : c + off, y: h.y0 - 0.06, z: axis === 'x' ? c + off : al, ry: i * 1.3 });
      }
    }
  };
  windowAt('x', H.z0, WIN.pia, 1, { curtain: '#f4d98a' });
  windowAt('z', H.x1, WIN.cozinha, -1, { curtain: '#f0a58a', shutter: '#5aa7a0' });
  windowAt('z', H.x1, WIN.sala1, -1, { curtain: '#f6efe0', shutter: '#5aa7a0', flowers: true });
  windowAt('z', H.x1, WIN.sala2, -1, { curtain: '#f6efe0', shutter: '#5aa7a0', flowers: true });
  windowAt('x', H.z1, WIN.salaSul, -1, { curtain: '#f6efe0' });
  sunPatch('z', XE, WIN.cozinha, { x0: XM + ht, x1: XE, z0: ZN, z1: ZM - ht });
  sunPatch('z', XE, WIN.sala1, { x0: XW, x1: XE, z0: ZM + ht, z1: ZS });
  sunPatch('z', XE, WIN.sala2, { x0: XW, x1: XE, z0: ZM + ht, z1: ZS });
  sunPatch('x', ZS, WIN.salaSul, { x0: XW, x1: XE, z0: ZM + ht, z1: ZS });

  /** Guarnição de uma passagem { a, b, y1 } na parede `axis` em c: forras dos lados e de cima e o alisar nas duas faces. */
  const casing = (axis, c, h, lin = 0.02) => {
    wbox(axis, c, h.a + lin / 2, 0, 0, lin, h.y1, t + 0.04, TRIM);
    wbox(axis, c, h.b - lin / 2, 0, 0, lin, h.y1, t + 0.04, TRIM);
    wbox(axis, c, (h.a + h.b) / 2, h.y1 - 0.03, 0, h.b - h.a, 0.03, t + 0.04, TRIM);
    for (const s of [-1, 1]) {
      wbox(axis, c, h.a - 0.035, 0, s * (ht + 0.008), 0.07, h.y1 + 0.07, 0.016, TRIM);
      wbox(axis, c, h.b + 0.035, 0, s * (ht + 0.008), 0.07, h.y1 + 0.07, 0.016, TRIM);
      wbox(axis, c, (h.a + h.b) / 2, h.y1, s * (ht + 0.008), h.b - h.a + 0.14, 0.07, 0.016, TRIM);
    }
  };
  casing('z', XM, hDQ);
  casing('x', ZM, hDS);
  casing('z', H.x1, hKD, 0.01);

  // ---------------------------------------------------------------- o basculante do quarto
  const cx = (W.x0 + W.x1) / 2, ww = W.x1 - W.x0, wh = W.top - W.sill;
  // batentes brancos e os dois parapeitos (o de fora, onde os pombos pousam; o de dentro, onde ficou a baba)
  add(rb(0.06, wh + 0.08, t + 0.04, 0.012, 1), { color: TRIM, x: W.x0 + 0.03, y: W.sill - 0.04, z: H.z0, ao: false });
  add(rb(0.06, wh + 0.08, t + 0.04, 0.012, 1), { color: TRIM, x: W.x1 - 0.03, y: W.sill - 0.04, z: H.z0, ao: false });
  add(rb(ww, 0.06, t + 0.04, 0.012, 1), { color: TRIM, x: cx, y: W.top - 0.03, z: H.z0, ao: false });
  const SO = L.SILL.out, SI = L.SILL.in;
  add(rb(SO.w, 0.04, SO.d, 0.01, 1), { color: '#d6cfc4', x: SO.x, y: SO.y - 0.04, z: SO.z, ao: false });
  add(rb(SI.w, 0.035, SI.d, 0.01, 1), { color: '#c79a6a', x: SI.x, y: SI.y - 0.035, z: SI.z, ao: false });
  const leaf = new THREE.Group();
  leaf.name = 'recanto:basculante';
  leaf.position.set(cx, W.sill, H.z0);
  // vidro limpo: as cenas filmam através dele (os pombos no parapeito, o voo com a cenoura)
  const glassMat = new THREE.MeshStandardMaterial({ color: '#d9eef8', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false });
  const frameMat = new THREE.MeshStandardMaterial({ color: TRIM, roughness: 0.55 });
  /** @type {THREE.Group[]} */
  const slats = [];
  const nSlats = 3, sh = (wh - 0.06) / nSlats;
  for (let i = 0; i < nSlats; i++) {
    const g = new THREE.Group();
    g.position.y = 0.03 + sh * (i + 0.5);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(ww - 0.12, sh - 0.025, 0.012), glassMat);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(ww - 0.1, 0.022, 0.03), frameMat);
    fr.position.y = -(sh - 0.025) / 2;
    g.add(glass, fr);
    leaf.add(g);
    slats.push(g);
  }
  // a alavanca do basculante, do lado de dentro, à direita (a mão da tutora puxa)
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.03), new THREE.MeshStandardMaterial({ color: '#c9b27a', roughness: 0.35, metalness: 0.6 }));
  lever.name = 'alavanca';
  lever.position.set(ww / 2 - 0.1, 0.18, 0.05);
  leaf.add(lever);
  leaf.traverse((o) => { if (/** @type {any} */ (o).isMesh) o.castShadow = true; });
  keep(leaf);
  const setWindow = (k) => {
    const a = clamp01(k) * W.openAngle;
    for (const s of slats) s.rotation.x = -a;
    lever.rotation.x = -a * 0.6;
  };
  setWindow(1);
  // a cortina (o varão nos suportes e os dois panos abertos para os lados)
  add(rod(0.012, ww + 0.62), { color: '#c9b27a', x: cx, y: W.top + 0.12, z: ZN + 0.06, rz: Math.PI / 2, ao: false });
  for (const s of [-1, 1]) {
    add(sphere(0.022, 8, 6), { color: '#c9b27a', x: cx + s * (ww / 2 + 0.33), y: W.top + 0.12, z: ZN + 0.06, ao: false });
    add(slab(0.02, 0.02, 0.06), { color: '#c9b27a', x: cx + s * (ww / 2 + 0.28), y: W.top + 0.11, z: ZN + 0.03, ao: false });
    add(curtainGeo(0.3, 0.9), { color: vary('#f4b8c8', 0.06, 30), x: cx + s * (ww / 2 + 0.14), y: W.top + 0.12 - 0.9, z: ZN + 0.05, ao: false });
  }

  // ---------------------------------------------------------------- móveis: peças que se repetem
  /** Quadro na parede (o ponto dado fica na face dela; (nx, nz): para onde ela olha): moldura, fundo e um pictograma. */
  const frame = (x, y, z, nx, nz, w, h, wood, bg, kind, col) => {
    const ry = Math.atan2(nx, nz);
    add(rb(w, h, 0.03, 0.012, 1), { color: wood, x: x + nx * 0.015, y: y - h / 2, z: z + nz * 0.015, ry, ao: false });
    add(slab(w - 0.07, h - 0.07, 0.006), { color: bg, x: x + nx * 0.031, y: y - h / 2 + 0.035, z: z + nz * 0.031, ry, ao: false });
    if (kind) art(add, kind, Math.min(w, h) * 0.56, col, x + nx * 0.0385, y, z + nz * 0.0385, nx, nz);
  };
  /**
   * Vaso com planta (o colisor é o círculo do vaso): o vaso de barro, a terra, o caule e a copa acima das dogs.
   * kind: 'ficus' (tronco e copa redonda), 'palma' (folhas em arco) ou 'costela' (folhas largas).
   */
  const potPlant = (x, z, r, kind, seed, a0 = 0, a1 = TAU) => {
    const pr = r - 0.03, ph = 0.34;
    add(cyl(pr, pr * 0.72, ph, 16), { color: vary('#c9764f', 0.06, 14), x, y: FL, z });
    add(new THREE.TorusGeometry(pr, 0.022, 6, 18).rotateX(Math.PI / 2), { color: '#b8653f', x, y: FL + ph - 0.01, z, ao: false });
    add(cyl(pr - 0.02, pr - 0.02, 0.01, 14), { color: '#4a3526', x, y: FL + ph - 0.004, z, ao: false });
    const Rp = rng(seed);
    if (kind === 'ficus') {
      add(limbAB([x, FL + ph, z], [x + 0.03, 1.05, z - 0.02], 0.028, 0.02, 6), { color: '#8a6a48', ao: false });
      add(foliageCluster([
        { x: 0, y: 1.3, z: 0, r: 0.3 }, { x: 0.2, y: 1.18, z: 0.1, r: 0.22 }, { x: -0.2, y: 1.2, z: -0.08, r: 0.22 }, { x: 0.02, y: 1.52, z: 0.04, r: 0.22 },
        { x: -0.05, y: 1.14, z: 0.2, r: 0.2 },
      ], { detail: 1, amp: 0.22, seed, dark: '#2f5a2a', mid: '#4f8a3a', light: '#8fbf5a' }), { color: null, slot: 'foliage', x, z });
    } else {
      // folhas em arco saindo do vaso: nascem a pino (dentro do círculo do vaso) e só abrem acima das dogs
      const n = kind === 'palma' ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const a = a0 + ((i + 0.5 * Rp()) / n) * (a1 - a0), len = (kind === 'palma' ? 1.0 : 0.8) + Rp() * 0.35, out = 0.3 + Rp() * 0.25;
        const pts = [], wid = kind === 'palma' ? 0.07 : 0.16;
        for (let k = 0; k <= 6; k++) {
          const u = k / 6, rr = out * u * u * 1.3, yy = FL + ph + len * (u - 0.32 * u * u * u);
          pts.push([x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr]);
        }
        // a lâmina: uma fita que alarga no meio e afina na ponta
        const pos = [], col = [];
        const dark = C('#2f6a34'), light = C(kind === 'palma' ? '#7fbf5a' : '#5fa648'), cc = new THREE.Color();
        for (let k = 0; k <= 6; k++) {
          const u = k / 6, w2 = wid * Math.sin(Math.min(1, u * 1.15) * Math.PI) * (u < 0.3 ? 0.35 + u * 2.2 : 1) + 0.006;
          const sx = -Math.sin(a) * w2, sz = Math.cos(a) * w2;
          pos.push(pts[k][0] - sx, pts[k][1] - w2 * 0.25, pts[k][2] - sz, pts[k][0] + sx, pts[k][1] - w2 * 0.25, pts[k][2] + sz);
          cc.copy(dark).lerp(light, u * 0.8 + 0.2 * Rp());
          col.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        const idx = [];
        for (let k = 0; k < 6; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
        g.setIndex(idx);
        g.computeVertexNormals();
        add(g, { color: null, slot: 'plant' });
        add(rodAB(pts[0], pts[2], 0.008, 4), { color: '#4f8a3a', ao: false });
      }
    }
  };
  /** Livros em pé numa prateleira: de a0 a a1 ao longo de z (lombadas para −x se dir < 0) ou de x (lombadas para dir em z). */
  const books = (axis, a0, a1, y, face, dir, seed, depth = 0.17) => {
    const Rb = rng(seed);
    const tones = ['#d9534f', '#3d8fd1', '#f2c230', '#5cb85c', '#8a72c2', '#e8708a', '#f08a3c', '#4aa6a0', '#f4e3c8'];
    let p = a0;
    while (p < a1 - 0.03) {
      const w = Math.min(a1 - p, 0.028 + Rb() * 0.03), hgt = 0.17 + Rb() * 0.09;
      if (Rb() < 0.12) { p += w + 0.02; continue; }
      const mid = p + w / 2, col = tones[Math.floor(Rb() * tones.length)];
      add(axis === 'z' ? slab(depth, hgt, w - 0.004) : slab(w - 0.004, hgt, depth), { color: col, x: axis === 'z' ? face - (dir * depth) / 2 : mid, y, z: axis === 'z' ? mid : face - (dir * depth) / 2, ao: false });
      p += w;
    }
  };

  // ---------------------------------------------------------------- quarto
  const B = L.BED;
  {
    // a caminha redonda das duas (as cenas deitam as irmãs nela: as medidas são as do layout)
    const rim = new THREE.TorusGeometry(B.r - B.rim, B.rim, 10, 36).rotateX(Math.PI / 2);
    add(rim, { color: vary('#8a72c2', 0.04, 9), x: B.x, y: B.rim + 0.01, z: B.z });
    add(cyl(B.r - B.rim, B.r - B.rim, 0.1, 36), { color: '#b9a6e3', x: B.x, y: FL, z: B.z });
    add(cyl(B.r - B.rim - 0.06, B.r - B.rim - 0.05, 0.03, 30), { color: '#d9ccf2', x: B.x, y: 0.106, z: B.z, ao: false });
    // o debrum costurado no alto da borda e a mantinha dobrada na beirada
    add(new THREE.TorusGeometry(B.r - B.rim, 0.011, 5, 40).rotateX(Math.PI / 2), { color: '#f4e9ff', x: B.x, y: B.rim * 2 + 0.006, z: B.z, ao: false });
    add(rb(0.5, 0.05, 0.28, 0.025, 2), { color: vary('#f2c25e', 0.05, 25), x: B.x - 0.28, y: 0.13, z: B.z + 0.32, ry: 0.4 });
  }
  // o pote d'água (vira de manhã: setTipped)
  const BW = L.BOWL;
  const bowl = new THREE.Group();
  bowl.name = 'recanto:pote';
  bowl.position.set(BW.x, FL, BW.z);
  const bowlPivot = new THREE.Group();
  bowlPivot.position.x = BW.r; // gira na beirada do leste
  bowl.add(bowlPivot);
  const bowlBody = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.11, 0), new THREE.Vector2(0.15, 0.075), new THREE.Vector2(0.135, 0.08), new THREE.Vector2(0.1, 0.022), new THREE.Vector2(0, 0.022)], 24), new THREE.MeshStandardMaterial({ color: '#d9534f', roughness: 0.35 }));
  bowlBody.position.x = -BW.r;
  bowlBody.castShadow = true;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.115, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7cc3ea', roughness: 0.08, transparent: true, opacity: 0.85 }));
  water.position.set(-BW.r, 0.062, 0);
  bowlPivot.add(bowlBody, water);
  const puddleMat = new THREE.MeshStandardMaterial({ color: '#7cc3ea', roughness: 0.05, transparent: true, opacity: 0.6, depthWrite: false });
  const spill = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), puddleMat);
  spill.name = 'poca-do-pote';
  spill.position.set(0.28, 0.004, 0.04);
  spill.scale.set(0.001, 1, 0.001);
  spill.renderOrder = 2;
  bowl.add(spill);
  keep(bowl);
  const setTipped = (k) => {
    const u = clamp01(k);
    bowlPivot.rotation.z = -u * 1.75;
    water.visible = u < 0.15;
    spill.scale.set(0.001 + u * 0.36, 1, 0.001 + u * 0.24);
  };
  setTipped(0);
  // o guarda-roupa encostado no oeste, com as portas para o leste
  const WR = L.WARDROBE;
  {
    const fx = WR.x + WR.hx;
    add(slab(WR.hx * 2 - 0.06, 0.08, WR.hz * 2 - 0.05), { color: '#8a6a48', x: WR.x - 0.02, y: FL, z: WR.z, ao: false });
    add(rb(WR.hx * 2, WR.h - 0.08, WR.hz * 2, 0.02, 1), { color: vary('#d9b98f', 0.04, 6), x: WR.x, y: 0.08, z: WR.z });
    add(rb(WR.hx * 2 + 0.05, 0.05, WR.hz * 2 + 0.06, 0.012, 1), { color: '#c9a77d', x: WR.x, y: WR.h, z: WR.z, ao: false });
    for (const s of [-1, 1]) {
      add(rb(0.018, WR.h - 0.56, WR.hz - 0.03, 0.006, 1), { color: '#e8cfa8', x: fx + 0.008, y: 0.5, z: WR.z + (s * WR.hz) / 2, ao: false });
      add(rb(0.01, WR.h - 0.8, WR.hz - 0.2, 0.004, 1), { color: '#dcc095', x: fx + 0.02, y: 0.62, z: WR.z + (s * WR.hz) / 2, ao: false });
      add(cyl(0.011, 0.011, 0.14, 8), { color: '#c9a24a', x: fx + 0.034, y: 1.0, z: WR.z + s * 0.05, ao: false });
      add(sphere(0.02, 8, 6), { color: '#c9a24a', x: fx + 0.03, y: 0.29, z: WR.z + s * 0.3, ao: false });
    }
    add(rb(0.018, 0.34, WR.hz * 2 - 0.06, 0.006, 1), { color: '#e8cfa8', x: fx + 0.008, y: 0.12, z: WR.z, ao: false }); // o gavetão
    // em cima: a mala de viagem e a caixa de chapéu
    add(rb(0.5, 0.2, 0.72, 0.04, 2), { color: vary('#b9684a', 0.05, 9), x: WR.x, y: WR.h + 0.05, z: WR.z - 0.16, ao: false });
    for (const s of [-1, 1]) add(slab(0.51, 0.03, 0.04), { color: '#7a4630', x: WR.x, y: WR.h + 0.135, z: WR.z - 0.16 + s * 0.2, ao: false });
    add(cyl(0.17, 0.17, 0.16, 18), { color: '#f4b8c8', x: WR.x - 0.02, y: WR.h + 0.05, z: WR.z + 0.4, ao: false });
    add(cyl(0.178, 0.178, 0.04, 18), { color: '#e88aa6', x: WR.x - 0.02, y: WR.h + 0.2, z: WR.z + 0.4, ao: false });
  }
  // o cesto de brinquedos (vime, com a bolinha, a corda e o ossinho de pelúcia saindo)
  const TB = L.TOY_BASKET;
  {
    const wa = C('#c99b5a'), wb2 = C('#b5864a');
    add(cyl(TB.r - 0.01, TB.r - 0.05, 0.3, 18), { color: (p) => (Math.floor(p.y * 34) % 2 ? wa : wb2), x: TB.x, y: FL, z: TB.z });
    add(new THREE.TorusGeometry(TB.r - 0.012, 0.02, 6, 20).rotateX(Math.PI / 2), { color: '#a87840', x: TB.x, y: FL + 0.3, z: TB.z, ao: false });
    add(sphere(0.07, 12, 8), { color: '#5cb85c', x: TB.x + 0.07, y: 0.34, z: TB.z - 0.05, ao: false });
    add(sphere(0.055, 10, 8), { color: '#f2c230', x: TB.x - 0.07, y: 0.33, z: TB.z + 0.09, ao: false });
    add(tubeAlong([[TB.x - 0.12, 0.3, TB.z - 0.06], [TB.x - 0.08, 0.4, TB.z - 0.1], [TB.x + 0.0, 0.43, TB.z - 0.12], [TB.x + 0.06, 0.36, TB.z - 0.16]], 0.02, 5, 10), { color: '#e8475f', ao: false });
    add(rb(0.16, 0.05, 0.05, 0.02, 1), { color: '#f4e3c8', x: TB.x + 0.02, y: 0.34, z: TB.z + 0.1, ry: 0.6, rz: 0.5, ao: false });
  }
  // o tapete (borda em faixas e o osso no meio) e os brinquedos pelo chão (rentes: as dogs passam por cima)
  const RG = L.RUG;
  {
    const ca = C('#8a72c2'), cb = C('#f4e9ff'), cc = C('#cbb6e8'), cd = C('#e8ddf6'), ce = C('#ddd0f0');
    rug(RG.x, RG.z, RG.hx, RG.hz, (u, v) => {
      const d = Math.min((1 - Math.abs(u)) * RG.hx, (1 - Math.abs(v)) * RG.hz);
      if (d < 0.1) return ca;
      if (d < 0.2) return cb;
      if (d < 0.3) return cc;
      return (Math.round(u * RG.hx * 10) + Math.round(v * RG.hz * 10)) % 4 === 0 ? ce : cd;
    });
    artFlat(add, 'osso', 1.15, '#8a72c2', RG.x, FL + 0.007, RG.z, 0.25, { slot: 'ground' });
    // a corda de nós, o ossinho de borracha e a bolinha
    const tx = RG.x + RG.hx - 0.5, tz = RG.z - RG.hz - 0.3;
    add(tubeAlong([[tx - 0.16, 0.024, tz], [tx - 0.05, 0.024, tz + 0.05], [tx + 0.06, 0.024, tz - 0.03], [tx + 0.17, 0.024, tz + 0.02]], 0.017, 5, 12), { color: '#3d8fd1', ao: false });
    for (const s of [-1, 1]) add(sphere(0.028, 8, 6), { color: '#f4e3c8', x: tx + s * 0.17, y: 0.034, z: tz + (s > 0 ? 0.02 : 0), ao: false });
    const ox = RG.x - RG.hx + 0.2, oz = RG.z + RG.hz + 0.25;
    add(rb(0.17, 0.04, 0.045, 0.018, 1), { color: '#f07a8a', x: ox, y: FL + 0.004, z: oz, ry: 0.5, ao: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(sphere(0.027, 8, 6), { color: '#f07a8a', x: ox + sx * 0.085 * Math.cos(0.5) + sz * 0.022 * Math.sin(0.5), y: FL + 0.03, z: oz - sx * 0.085 * Math.sin(0.5) + sz * 0.022 * Math.cos(0.5), ao: false });
    add(sphere(0.034, 12, 8), { color: '#f2c230', x: TB.x + 0.62, y: FL + 0.035, z: TB.z + 0.42, ao: false });
  }
  // a cômoda encostada no sul (as gavetas olham para o norte), com o abajur, o porta-retrato e o pote de biscoitos
  const DR = L.DRESSER;
  {
    const fz = DR.z - DR.hz, top = DR.h;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.028, 0.022, 0.09, 8), { color: '#8a6a48', x: DR.x + sx * (DR.hx - 0.07), y: FL, z: DR.z + sz * (DR.hz - 0.07), ao: false });
    add(rb(DR.hx * 2, top - 0.12, DR.hz * 2 - 0.02, 0.02, 1), { color: vary('#f4ead8', 0.03, 6), x: DR.x, y: 0.09, z: DR.z + 0.01 });
    add(rb(DR.hx * 2 + 0.04, 0.035, DR.hz * 2 + 0.02, 0.012, 1), { color: vary('#c9935a', 0.05, 8), x: DR.x, y: top - 0.035, z: DR.z, ao: false });
    for (let r = 0; r < 3; r++) for (const s of [-1, 1]) {
      add(rb(DR.hx - 0.07, 0.19, 0.016, 0.006, 1), { color: ['#cbb6e8', '#f4b8c8', '#b9e0d2'][r], x: DR.x + s * (DR.hx / 2 - 0.01), y: 0.12 + r * 0.215, z: fz + 0.016, ao: false });
      add(sphere(0.018, 8, 6), { color: '#c9a24a', x: DR.x + s * (DR.hx / 2 - 0.01), y: 0.215 + r * 0.215, z: fz - 0.004, ao: false });
    }
    // o abajur (a cúpula acesa, sem luz de verdade)
    add(cyl(0.07, 0.085, 0.03, 14), { color: '#8a72c2', x: DR.x - 0.44, y: top, z: DR.z, ao: false });
    add(cyl(0.014, 0.014, 0.2, 6), { color: '#c9a24a', x: DR.x - 0.44, y: top + 0.03, z: DR.z, ao: false });
    add(cyl(0.085, 0.15, 0.2, 18), { color: '#fff1c2', slot: 'lit', x: DR.x - 0.44, y: top + 0.2, z: DR.z });
    // o porta-retrato (a patinha), o pote de biscoitos e a escova
    add(rb(0.2, 0.25, 0.02, 0.008, 1), { color: '#8a5a3c', x: DR.x + 0.08, y: top, z: DR.z + 0.1, ao: false });
    add(slab(0.15, 0.2, 0.004), { color: '#fff6e6', x: DR.x + 0.08, y: top + 0.025, z: DR.z + 0.088, ao: false });
    art(add, 'pata', 0.11, '#e8708a', DR.x + 0.08, top + 0.125, DR.z + 0.0835, 0, -1);
    add(cyl(0.075, 0.065, 0.16, 14), { color: '#bfe3f5', slot: 'glass', x: DR.x + 0.46, y: top, z: DR.z + 0.02 });
    add(cyl(0.08, 0.08, 0.03, 14), { color: '#e8475f', x: DR.x + 0.46, y: top + 0.16, z: DR.z + 0.02, ao: false });
    add(sphere(0.02, 8, 6), { color: '#e8475f', x: DR.x + 0.46, y: top + 0.2, z: DR.z + 0.02, ao: false });
    add(rb(0.16, 0.03, 0.05, 0.012, 1), { color: '#5aa7a0', x: DR.x - 0.14, y: top, z: DR.z - 0.08, ry: 0.4, ao: false });
    // o espelho redondo na parede, em cima da cômoda
    add(rod(0.36, 0.024, 28), { color: '#c9935a', x: DR.x + 0.1, y: 1.5, z: ZM - ht - 0.012, rx: Math.PI / 2, ao: false });
    add(rod(0.31, 0.01, 28), { color: '#d5ecf5', slot: 'glass', x: DR.x + 0.1, y: 1.5, z: ZM - ht - 0.027, rx: Math.PI / 2 });
  }
  // a estante baixa de livros e brinquedos, encostada na parede da cozinha (as prateleiras olham para o oeste)
  {
    const S = EX.bedroomShelf, x1 = S.x + S.hx, x0 = S.x - S.hx, z0 = S.z - S.hz, z1 = S.z + S.hz;
    const wood = vary('#f4ead8', 0.03, 6);
    add(slab(0.015, S.h - 0.04, S.hz * 2 - 0.02), { color: '#e2d2b6', x: x1 - 0.012, y: FL, z: S.z, ao: false });
    for (const z of [z0 + 0.015, z1 - 0.015]) add(rb(S.hx * 2 - 0.01, S.h - 0.03, 0.03, 0.008, 1), { color: wood, x: S.x, y: FL, z });
    add(rb(S.hx * 2, 0.03, S.hz * 2, 0.01, 1), { color: vary('#c9935a', 0.05, 8), x: S.x, y: S.h - 0.03, z: S.z, ao: false });
    for (const y of [0.05, 0.38, 0.7]) add(slab(S.hx * 2 - 0.02, 0.022, S.hz * 2 - 0.05), { color: '#efe2c8', x: S.x - 0.004, y, z: S.z, ao: false });
    books('z', z0 + 0.04, z1 - 0.3, 0.402, x0 + 0.02, -1, 11, 0.2);
    books('z', z0 + 0.3, z1 - 0.04, 0.722, x0 + 0.02, -1, 12, 0.2);
    // embaixo, os cestos; no meio e em cima, a bola e o bichinho de pelúcia
    for (const s of [-1, 1]) add(rb(0.26, 0.24, 0.48, 0.03, 1), { color: s < 0 ? '#cbb6e8' : '#b9e0d2', x: S.x - 0.01, y: 0.075, z: S.z + s * 0.27 });
    add(sphere(0.09, 12, 8), { color: '#e8475f', x: S.x - 0.02, y: 0.49, z: z1 - 0.16, ao: false });
    add(sphere(0.075, 10, 8), { color: '#f2d7b0', x: S.x - 0.02, y: 0.795, z: z0 + 0.16, ao: false });
    add(sphere(0.055, 10, 8), { color: '#f2d7b0', x: S.x - 0.03, y: 0.9, z: z0 + 0.16, ao: false });
    for (const s of [-1, 1]) add(sphere(0.022, 6, 5), { color: '#c79a6a', x: S.x - 0.03, y: 0.95, z: z0 + 0.16 + s * 0.04, ao: false });
    // em cima: a plantinha e o troféu com a patinha
    add(cyl(0.07, 0.055, 0.1, 12), { color: '#c9764f', x: S.x, y: S.h, z: z0 + 0.22, ao: false });
    add(foliageCluster([{ x: 0, y: 0.17, z: 0, r: 0.11 }, { x: 0.05, y: 0.24, z: 0.03, r: 0.08 }], { detail: 1, seed: 4 }), { color: null, slot: 'foliage', x: S.x, y: S.h, z: z0 + 0.22 });
    add(cyl(0.05, 0.06, 0.03, 10), { color: '#8a5a3c', x: S.x, y: S.h, z: z1 - 0.25, ao: false });
    add(cyl(0.012, 0.012, 0.08, 6), { color: '#d9b25a', x: S.x, y: S.h + 0.03, z: z1 - 0.25, ao: false });
    add(cyl(0.06, 0.035, 0.09, 12), { color: '#d9b25a', x: S.x, y: S.h + 0.11, z: z1 - 0.25, ao: false });
  }
  potPlant(EX.bedroomPlant.x, EX.bedroomPlant.z, EX.bedroomPlant.r, 'costela', 21, Math.PI * 1.45, Math.PI * 2.05);
  // nas paredes do quarto: os quadros (osso, patinha, cenoura, coração), o cabide das guias, as bandeirinhas e a luzinha
  frame(W.x1 + 0.75, 1.5, ZN, 0, 1, 0.42, 0.34, '#8a5a3c', '#fff6e6', 'osso', '#c79a6a');
  frame(W.x1 + 1.3, 1.62, ZN, 0, 1, 0.3, 0.34, '#f4b8c8', '#fff6e6', 'pata', '#8a72c2');
  frame(W.x1 + 1.72, 1.42, ZN, 0, 1, 0.26, 0.26, '#c9a24a', '#fff6e6', 'coracao', '#e8475f');
  frame(W.x0 - 0.95, 1.55, ZN, 0, 1, 0.36, 0.44, '#8a5a3c', '#fff6e6', 'cenoura', '#f07a1a');
  frame(XW, 1.6, TB.z + 0.5, 1, 0, 0.5, 0.4, '#c9a24a', '#e8f3fb', 'sol', '#f2c230');
  {
    // o cabide das guias: a régua com três pinos, a guia rosa e a azul penduradas e uma coleira
    const hz0 = (TB.z + WR.z - WR.hz) / 2 + 0.3, hy = 1.3;
    add(rb(0.03, 0.1, 0.7, 0.01, 1), { color: '#c9935a', x: XW + 0.015, y: hy - 0.05, z: hz0, ao: false });
    for (let i = -1; i <= 1; i++) add(rod(0.012, 0.07, 6), { color: '#c9a24a', x: XW + 0.06, y: hy, z: hz0 + i * 0.24, rz: Math.PI / 2, ao: false });
    for (const [i, col] of [[-1, '#e8708a'], [0, '#3d8fd1']]) {
      const z = hz0 + Number(i) * 0.24;
      add(tubeAlong([[XW + 0.07, hy, z - 0.02], [XW + 0.075, hy - 0.3, z - 0.05], [XW + 0.07, hy - 0.56, z], [XW + 0.075, hy - 0.3, z + 0.05], [XW + 0.07, hy, z + 0.02]], 0.011, 5, 20), { color: col, ao: false });
    }
    add(new THREE.TorusGeometry(0.07, 0.012, 6, 16).rotateY(Math.PI / 2), { color: '#f2c230', x: XW + 0.075, y: hy - 0.08, z: hz0 + 0.24, ao: false });
    // a luzinha de noite (acesa) e as bandeirinhas na parede do sul
    add(sphere(0.055, 12, 8), { color: '#fff1c2', slot: 'lit', x: XW + 0.045, y: 0.8, z: B.z + 0.4 });
    const n = 15, x0 = XW + 0.5, x1 = XM - ht - 0.5, zb = ZM - ht - 0.012;
    const tones = ['#e8475f', '#f2c230', '#5cb85c', '#3d8fd1', '#8a72c2'];
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, y = 2.34 - Math.sin(u * Math.PI) * 0.16;
      add(shapeXY([[-0.11, 0], [0.11, 0], [0, -0.2]]).rotateY(Math.PI), { color: tones[i % tones.length], x: lerp(x0, x1, u), y, z: zb, ao: false });
    }
    add(tubeAlong(Array.from({ length: 9 }, (_, i) => [lerp(x0, x1, i / 8), 2.345 - Math.sin((i / 8) * Math.PI) * 0.16, zb + 0.004]), 0.005, 4, 24), { color: '#fff6e6', ao: false });
  }

  // ---------------------------------------------------------------- a grade do quarto, a portinha de gato e o pedal
  const PG = L.PET_GATE, PF = L.PET_FLAP, PP = L.PET_PEDAL;
  const RED = '#d6453c';
  // a folha (−Z local a partir da dobradiça; o +X é a cozinha, para onde ela abre)
  const gate = new THREE.Group();
  gate.name = 'recanto:grade-do-quarto';
  gate.position.set(PG.hinge.x, 0, PG.hinge.z);
  {
    const b = createBaker();
    const white = vary('#fbf6ec', 0.03, 30), wood = '#d9b98f';
    const z0 = -0.034, z1 = -(PG.length - 0.03), len = z0 - z1, zc = (z0 + z1) / 2, top = PG.h, bot = 0.045;
    b.add(rb(0.034, top - bot, 0.034, 0.008, 1), { color: white, y: bot, z: z0 - 0.017 });
    b.add(rb(0.034, top - bot, 0.034, 0.008, 1), { color: white, y: bot, z: z1 + 0.017 });
    b.add(rb(0.03, 0.036, len, 0.008, 1), { color: wood, y: top - 0.036, z: zc });
    b.add(rb(0.03, 0.036, len, 0.008, 1), { color: white, y: bot, z: zc });
    const n = 15;
    for (let i = 1; i <= n; i++) b.add(cyl(0.009, 0.009, top - bot - 0.06, 6), { color: white, y: bot + 0.03, z: z0 - 0.034 - ((len - 0.068) * i) / (n + 1) });
    // as dobradiças e o trinco na ponta (vermelho, como o pedal e o cabinho)
    for (const y of [0.2, 0.7]) b.add(cyl(0.011, 0.011, 0.07, 8), { color: '#9aa0a6', y, z: -0.027 });
    b.add(rb(0.03, 0.05, 0.1, 0.01, 1), { color: RED, x: 0.03, y: top - 0.15, z: z1 + 0.035 });
    b.add(sphere(0.02, 8, 6), { color: RED, x: 0.052, y: top - 0.125, z: z1 + 0.06 });
    gate.add(bakedMesh(b, 'grade:folha', { rough: 0.6 }));
  }
  keep(gate);
  const setGate = (k) => { gate.rotation.y = PG.closedYaw + (PG.openYaw - PG.closedYaw) * k; };
  setGate(0);
  {
    // a parte fixa: os postes, o painel com a portinha de gato (o vão rente ao chão, só a Radhija passa) e a abinha levantada
    const x = PF.x, zA = PF.z0 + 0.024, zB = PF.z1;
    const white = vary('#fbf6ec', 0.03, 30);
    add(rb(0.04, PF.h + 0.03, 0.04, 0.008, 1), { color: white, x, z: zA + 0.02 });
    add(rb(0.044, PF.h + 0.05, 0.044, 0.008, 1), { color: white, x, z: zB });
    add(sphere(0.026, 10, 8), { color: '#d9b98f', x, y: PF.h + 0.06, z: zB, ao: false });
    const i0 = zA + 0.04, i1 = zB - 0.022, mid = (i0 + i1) / 2, o2 = (i1 - i0) / 2 - 0.037, oh = 0.56, rc = 0.08, hwid = (i1 - i0) / 2 + 0.004, ptop = PF.h - 0.03;
    const s = new THREE.Shape();
    s.moveTo(-hwid, 0.03);
    s.lineTo(-o2, 0.03);
    s.lineTo(-o2, oh - rc);
    s.absarc(-o2 + rc, oh - rc, rc, Math.PI, Math.PI / 2, true);
    s.lineTo(o2 - rc, oh);
    s.absarc(o2 - rc, oh - rc, rc, Math.PI / 2, 0, true);
    s.lineTo(o2, 0.03);
    s.lineTo(hwid, 0.03);
    s.lineTo(hwid, ptop);
    s.lineTo(-hwid, ptop);
    s.closePath();
    const panel = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false, curveSegments: 6 });
    panel.translate(0, 0, -0.011).rotateY(-Math.PI / 2); // o x do perfil vira o z do mundo
    add(panel, { color: white, x, z: mid, ao: false });
    add(rb(0.034, 0.036, i1 - i0 + 0.01, 0.008, 1), { color: '#d9b98f', x, y: ptop - 0.004, z: mid, ao: false });
    // a moldura arredondada do vão
    const e = o2 + 0.012, pts = [[x, 0.02, mid - e], [x, 0.28, mid - e], [x, oh - rc, mid - e]];
    for (const a of [0.75, 0.5, 0.25]) pts.push([x, oh - rc + (rc + 0.012) * Math.cos((a * Math.PI) / 2), mid - (o2 - rc) - (rc + 0.012) * Math.sin((a * Math.PI) / 2)]);
    pts.push([x, oh + 0.012, mid]);
    for (const a of [0.25, 0.5, 0.75]) pts.push([x, oh - rc + (rc + 0.012) * Math.cos((a * Math.PI) / 2), mid + (o2 - rc) + (rc + 0.012) * Math.sin((a * Math.PI) / 2)]);
    pts.push([x, oh - rc, mid + e], [x, 0.28, mid + e], [x, 0.02, mid + e]);
    add(tubeAlong(pts, 0.02, 6, 40), { color: '#5fb7a6', ao: false });
    // a abinha, virada para cima e presa no alto por uma presilha
    add(rodAB([x + 0.02, oh + 0.045, mid - o2 + 0.03], [x + 0.02, oh + 0.045, mid + o2 - 0.03], 0.01, 6), { color: '#9aa0a6', ao: false });
    add(slab(0.008, 0.46, o2 * 2 - 0.07), { color: '#cfe6ee', slot: 'glass', x: x + 0.022, y: oh + 0.05, z: mid, rz: -0.16 });
    add(rb(0.05, 0.03, 0.06, 0.008, 1), { color: RED, x: x + 0.05, y: ptop + 0.02, z: mid, ao: false });
    art(add, 'pata', 0.12, '#5fb7a6', x - 0.014, (oh + ptop) / 2 + 0.012, mid, -1, 0);
  }
  // o pedal: a base de borracha fixa e a tampa vermelha com a patinha, que desce
  const pedal = new THREE.Group();
  pedal.name = 'recanto:pedal-da-grade';
  pedal.position.set(PP.x, 0, PP.z);
  add(new THREE.LatheGeometry([new THREE.Vector2(PP.r + 0.005, FL), new THREE.Vector2(PP.r, 0.02), new THREE.Vector2(PP.r - 0.025, 0.024), new THREE.Vector2(PP.r - 0.035, 0.02), new THREE.Vector2(PP.r - 0.035, FL)], 28), { color: '#3a3d42', x: PP.x, z: PP.z, ao: false });
  let pedalCap;
  {
    const b = createBaker();
    const rr = PP.r - 0.04;
    b.add(new THREE.LatheGeometry([new THREE.Vector2(rr, 0.0), new THREE.Vector2(rr, 0.042), new THREE.Vector2(rr - 0.014, 0.05), new THREE.Vector2(0, 0.05)], 28), { color: RED });
    for (const [g, c] of picto('pata', 0.26)) b.add(g.rotateX(-Math.PI / 2), { color: c ?? '#fff6e6', y: 0.0515, ry: Math.PI / 2 });
    pedalCap = bakedMesh(b, 'pedal:tampa', { rough: 0.45, cast: false });
    pedal.add(pedalCap);
  }
  keep(pedal);
  const setPedal = (k) => { pedalCap.position.y = -0.03 * clamp01(k); };
  setPedal(0);
  {
    // o cabinho vermelho: do pedal ao pé do rodapé, rente a ele até a passagem, por baixo da folha e poste do trinco acima
    const xf = XM + ht + 0.026, yf = FL + 0.007, xp = PF.x + 0.03, zL = PG.latchPost.z, yL = PG.h - 0.12;
    const path = [[PP.x - PP.r + 0.01, yf, PP.z], [xf, yf, PP.z], [xf, yf, zL + 0.0], [xp, yf, zL], [xp, yL, zL]];
    for (let i = 0; i + 1 < path.length; i++) add(rodAB(path[i], path[i + 1], 0.006, 5), { color: RED, ao: false });
    for (const p of path.slice(1, 4)) add(sphere(0.007, 6, 4), { color: RED, x: p[0], y: p[1], z: p[2], ao: false });
    for (const z of [PP.z - 0.25, DQ.z1 - 0.3, DQ.z1 - 0.9]) add(slab(0.03, 0.006, 0.02), { color: '#f4ecdc', x: xf, y: yf + 0.003, z, ao: false });
    add(rb(0.03, 0.06, 0.05, 0.01, 1), { color: RED, x: xp + 0.004, y: yL, z: zL, ao: false }); // a caixinha do trinco no poste
  }

  // ---------------------------------------------------------------- cozinha
  {
    const kd = K.z1 - K.z0, kz = (K.z0 + K.z1) / 2, klen = K.x1 - K.x0, kc = (K.x0 + K.x1) / 2, fz = K.z1 - 0.03;
    const cream = vary('#f6efe0', 0.03, 6);
    // a bancada: o rodapé recuado, os armários e o tampo de pedra
    add(slab(klen - 0.02, 0.1, kd - 0.1), { color: '#6a645c', x: kc, y: FL, z: kz - 0.05, ao: false });
    add(rb(klen, K.h - 0.14, kd - 0.03, 0.015, 1), { color: cream, x: kc, y: 0.1, z: kz - 0.015 });
    add(rb(klen + 0.02, 0.045, kd + 0.02, 0.012, 1), { color: '#6f6961', x: kc, y: K.h - 0.045, z: kz, ao: false });
    const n = Math.round(klen / 0.64), mw = klen / n;
    for (let i = 0; i < n; i++) {
      const mx = K.x0 + mw * (i + 0.5);
      if (Math.abs(mx - STOVE_X) < mw * 0.5) continue; // o forno fica aqui
      add(rb(mw - 0.04, 0.15, 0.016, 0.006, 1), { color: '#dfe9d9', x: mx, y: K.h - 0.22, z: fz + 0.008, ao: false });
      add(rb(mw - 0.04, 0.5, 0.016, 0.006, 1), { color: '#dfe9d9', x: mx, y: 0.14, z: fz + 0.008, ao: false });
      add(rb(0.14, 0.018, 0.02, 0.006, 1), { color: '#c9a24a', x: mx, y: K.h - 0.155, z: fz + 0.024, ao: false });
      add(rb(0.018, 0.14, 0.02, 0.006, 1), { color: '#c9a24a', x: mx + (i % 2 ? -1 : 1) * (mw / 2 - 0.07), y: 0.44, z: fz + 0.024, ao: false });
    }
    // a pia (a cuba de aço, a torneira em arco) e o escorredor com os pratos
    add(rb(0.66, 0.014, 0.42, 0.02, 1), { color: '#b9bdc2', x: SINK_X, y: K.h - 0.004, z: kz, ao: false });
    add(slab(0.52, 0.004, 0.3), { color: '#7c8288', x: SINK_X, y: K.h + 0.01, z: kz + 0.02, ao: false });
    add(tubeAlong([[SINK_X, K.h, K.z0 + 0.08], [SINK_X, K.h + 0.22, K.z0 + 0.08], [SINK_X, K.h + 0.27, K.z0 + 0.16], [SINK_X, K.h + 0.2, K.z0 + 0.24]], 0.013, 6, 14), { color: '#d0d4d8', ao: false });
    for (const s of [-1, 1]) add(cyl(0.016, 0.016, 0.05, 8), { color: s < 0 ? '#e8475f' : '#3d8fd1', x: SINK_X + s * 0.1, y: K.h, z: K.z0 + 0.08, ao: false });
    add(rb(0.36, 0.03, 0.3, 0.01, 1), { color: '#d8d0c4', x: SINK_X + 0.62, y: K.h, z: kz, ao: false });
    for (let i = 0; i < 4; i++) add(rod(0.085, 0.008, 14), { color: i % 2 ? '#fff6e6' : '#bfe0d6', x: SINK_X + 0.5 + i * 0.075, y: K.h + 0.115, z: kz, rz: Math.PI / 2 - 0.18, ao: false });
    // o fogão: o tampo preto com as quatro bocas, o forno, a frigideira e a chaleira
    add(rb(0.62, 0.014, 0.5, 0.012, 1), { color: '#2f3134', x: STOVE_X, y: K.h - 0.002, z: kz, ao: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.TorusGeometry(0.06, 0.012, 5, 14).rotateX(Math.PI / 2), { color: '#55585c', x: STOVE_X + sx * 0.15, y: K.h + 0.02, z: kz + sz * 0.115, ao: false });
    add(rb(mw - 0.04, 0.56, 0.018, 0.008, 1), { color: '#3a3d42', x: STOVE_X, y: 0.14, z: fz + 0.008, ao: false });
    add(slab(mw - 0.2, 0.3, 0.006), { color: '#22262c', slot: 'glass', x: STOVE_X, y: 0.26, z: fz + 0.018 });
    add(rod(0.012, mw - 0.14, 6), { color: '#d0d4d8', x: STOVE_X, y: 0.64, z: fz + 0.045, rz: Math.PI / 2, ao: false });
    for (let i = 0; i < 4; i++) add(rod(0.02, 0.02, 10), { color: '#e4e6e8', x: STOVE_X - 0.2 + i * 0.133, y: K.h - 0.12, z: fz + 0.026, rx: Math.PI / 2, ao: false });
    add(cyl(0.1, 0.085, 0.045, 16), { color: '#3a3d42', x: STOVE_X + 0.15, y: K.h + 0.03, z: kz + 0.115, ao: false });
    add(rodAB([STOVE_X + 0.24, K.h + 0.065, kz + 0.14], [STOVE_X + 0.42, K.h + 0.08, kz + 0.2], 0.011, 6), { color: '#2a2c2f', ao: false });
    add(cyl(0.07, 0.09, 0.13, 14), { color: '#e8475f', x: STOVE_X - 0.15, y: K.h + 0.03, z: kz - 0.115, ao: false });
    add(new THREE.TorusGeometry(0.055, 0.009, 5, 12, Math.PI), { color: '#2a2c2f', x: STOVE_X - 0.15, y: K.h + 0.155, z: kz - 0.115, ao: false });
    add(rodAB([STOVE_X - 0.08, K.h + 0.11, kz - 0.115], [STOVE_X - 0.01, K.h + 0.15, kz - 0.115], 0.012, 6), { color: '#e8475f', ao: false });
    // em cima da bancada: o pote de biscoitos com o osso, a fruteira, a torradeira, a tábua e o vasinho de tempero
    const jx = K.x0 + 0.45;
    add(cyl(0.085, 0.075, 0.2, 14), { color: '#f4e3c8', x: jx, y: K.h, z: kz - 0.04, ao: false });
    add(cyl(0.09, 0.09, 0.03, 14), { color: '#c9935a', x: jx, y: K.h + 0.2, z: kz - 0.04, ao: false });
    art(add, 'osso', 0.11, '#8a5a3c', jx, K.h + 0.1, kz - 0.04 + 0.084, 0, 1);
    add(rb(0.26, 0.17, 0.15, 0.04, 2), { color: '#e4e6e8', x: K.x0 + 1.25, y: K.h, z: kz - 0.06, ao: false });
    for (const s of [-1, 1]) add(slab(0.09, 0.012, 0.02), { color: '#3a3d42', x: K.x0 + 1.25 + s * 0.06, y: K.h + 0.166, z: kz - 0.06, ao: false });
    add(rb(0.34, 0.02, 0.22, 0.008, 1), { color: vary('#c9935a', 0.06, 12), x: SINK_X - 0.75, y: K.h, z: kz + 0.03, ry: 0.15, ao: false });
    add(cyl(0.13, 0.08, 0.07, 14), { color: '#f4e3c8', x: K.x1 - 0.5, y: K.h, z: kz, ao: false });
    for (const [fx, fzz, fc] of [[0.04, 0.02, '#e8475f'], [-0.05, -0.01, '#f2c230'], [0.0, -0.06, '#7fb04f'], [0.01, 0.05, '#f08a3c']]) add(sphere(0.04, 10, 8), { color: fc, x: K.x1 - 0.5 + Number(fx), y: K.h + 0.085, z: kz + Number(fzz), ao: false });
    add(cyl(0.06, 0.05, 0.09, 12), { color: '#c9764f', x: SINK_X - 0.36, y: K.h, z: K.z0 + 0.1, ao: false });
    add(foliageCluster([{ x: 0, y: 0.15, z: 0, r: 0.09 }, { x: 0.04, y: 0.21, z: 0.02, r: 0.07 }], { detail: 1, seed: 6 }), { color: null, slot: 'foliage', x: SINK_X - 0.36, y: K.h, z: K.z0 + 0.1 });
    // o azulejo entre a bancada e os armários (com a janela da pia no meio)
    {
      const o = new THREE.Color(), ta = C('#fbf7ee'), tb = C('#eef4ec'), tc = C('#8fcdb8'), td = C('#f0a58a');
      skin('x', ZN, K.x0, K.x1, 1, K.h, 1.45, 0.14, 0.132, (u, y, i, j) => o.copy(hash(i, j) > 0.9 ? (hash(j, i) > 0.5 ? tc : td) : (i + j) % 2 ? ta : tb), [WIN.pia]);
    }
    // os armários de cima (acima de 1,45 m) e a coifa em cima do fogão
    const uy = 1.47, uh = 0.68, ud = 0.32;
    for (const [x0, x1] of [[K.x0, WIN.pia.a - 0.2], [WIN.pia.b + 0.2, STOVE_X - 0.48], [STOVE_X + 0.48, K.x1]]) {
      const w = x1 - x0, m = Math.max(1, Math.round(w / 0.56));
      add(rb(w, uh, ud, 0.015, 1), { color: cream, x: (x0 + x1) / 2, y: uy, z: ZN + ud / 2, ao: false });
      for (let i = 0; i < m; i++) {
        const mx = x0 + (w / m) * (i + 0.5);
        add(rb(w / m - 0.03, uh - 0.04, 0.016, 0.006, 1), { color: '#dfe9d9', x: mx, y: uy + 0.02, z: ZN + ud + 0.006, ao: false });
        add(rb(0.018, 0.12, 0.02, 0.006, 1), { color: '#c9a24a', x: mx + (i % 2 ? -1 : 1) * ((w / m) / 2 - 0.06), y: uy + 0.06, z: ZN + ud + 0.022, ao: false });
      }
    }
    add(rb(0.9, 0.16, 0.46, 0.02, 1), { color: '#c9ced3', x: STOVE_X, y: uy + 0.08, z: ZN + 0.23, ao: false });
    add(rb(0.34, CEIL - uy - 0.24, 0.3, 0.015, 1), { color: '#d5dade', x: STOVE_X, y: uy + 0.24, z: ZN + 0.15, ao: false });

    // a geladeira (a porta olha para o norte): o puxador, a divisa do congelador, os ímãs e o desenho da cenoura
    const gz = F.z - F.hz;
    add(rb(F.hx * 2, F.h - 0.03, F.hz * 2, 0.07, 2), { color: vary('#a8dcc8', 0.03, 4), x: F.x, y: 0.03, z: F.z });
    add(slab(F.hx * 2 - 0.12, 0.04, F.hz * 2 - 0.12), { color: '#5a6a64', x: F.x, y: FL, z: F.z, ao: false });
    add(slab(F.hx * 2 - 0.16, 0.012, 0.012), { color: '#7fb8a4', x: F.x, y: 1.2, z: gz - 0.004, ao: false });
    for (const [y, h] of [[1.26, 0.3], [0.72, 0.4]]) add(rb(0.03, h, 0.04, 0.012, 1), { color: '#e4e6e8', x: F.x + F.hx - 0.11, y, z: gz - 0.022, ao: false });
    for (const [mx, my, mc] of [[-0.14, 1.36, '#e8475f'], [0.02, 1.52, '#f2c230'], [-0.2, 0.98, '#3d8fd1'], [-0.02, 0.62, '#8a72c2']]) add(rod(0.026, 0.012, 10), { color: mc, x: F.x + Number(mx), y: my, z: gz - 0.006, rx: Math.PI / 2, ao: false });
    add(slab(0.2, 0.26, 0.004), { color: '#fff6e6', x: F.x - 0.1, y: 0.68, z: gz - 0.003, ao: false });
    art(add, 'cenoura', 0.19, '#f07a1a', F.x - 0.1, 0.8, gz - 0.0075, 0, -1);
    art(add, 'pata', 0.07, '#fff6e6', F.x - 0.2, 0.98, gz - 0.0135, 0, -1);
    add(rb(0.44, 0.16, 0.4, 0.03, 1), { color: (p) => C(Math.floor(p.y * 40) % 2 ? '#c99b5a' : '#b5864a'), x: F.x, y: F.h, z: F.z + 0.05, ao: false });

    // a mesa (a Radhija passa por baixo: tampo alto, pés finos nos cantos), a toalha e a fruteira
    add(rb(KT.hx * 2, 0.045, KT.hz * 2, 0.015, 1), { color: vary('#c9935a', 0.05, 8), x: KT.x, y: KT.h - 0.045, z: KT.z, ao: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(rb(0.045, KT.h - 0.045, 0.045, 0.01, 1), { color: '#a87445', x: KT.x + sx * (KT.hx - 0.05), y: FL, z: KT.z + sz * (KT.hz - 0.05) });
    for (const sz of [-1, 1]) add(slab(KT.hx * 2 - 0.14, 0.07, 0.02), { color: '#a87445', x: KT.x, y: KT.h - 0.115, z: KT.z + sz * (KT.hz - 0.05), ao: false });
    for (const sx of [-1, 1]) add(slab(0.02, 0.07, KT.hz * 2 - 0.14), { color: '#a87445', x: KT.x + sx * (KT.hx - 0.05), y: KT.h - 0.115, z: KT.z, ao: false });
    {
      const ra = C('#e8475f'), rw = C('#fff6e6');
      add(tiles(KT.hx * 2 - 0.3, KT.hz * 2 + 0.04, 0.09, 0.09, (p) => ((Math.round(p.x / 0.09) + Math.round(p.z / 0.09)) % 2 ? ra : rw)), { color: null, slot: 'ground', x: KT.x, y: KT.h + 0.004, z: KT.z, ao: false });
    }
    add(cyl(0.13, 0.08, 0.07, 14), { color: '#f4e3c8', x: KT.x, y: KT.h + 0.004, z: KT.z, ao: false });
    for (const [fx, fzz, fc] of [[0.04, 0.02, '#e8475f'], [-0.05, -0.01, '#f2c230'], [0.0, -0.055, '#7fb04f']]) add(sphere(0.04, 10, 8), { color: fc, x: KT.x + Number(fx), y: KT.h + 0.09, z: KT.z + Number(fzz), ao: false });
    for (const s of [-1, 1]) add(cyl(0.04, 0.035, 0.085, 10), { color: s < 0 ? '#8fcdb8' : '#f0a58a', x: KT.x + s * 0.36, y: KT.h + 0.004, z: KT.z - s * 0.18, ao: false });
    // as cadeiras (assento, almofada, encosto de duas réguas)
    EX.chairs.forEach((c, i) => {
      const s = c.half - 0.015, f = c.face;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(slab(0.035, sz === -f ? 0.92 : 0.44, 0.035), { color: '#a87445', x: c.x + sx * (s - 0.02), y: FL, z: c.z + sz * (s - 0.02), ao: false });
      add(rb(s * 2, 0.035, s * 2, 0.012, 1), { color: vary('#c9935a', 0.05, 8), x: c.x, y: 0.43, z: c.z, ao: false });
      add(rb(s * 2 - 0.05, 0.03, s * 2 - 0.05, 0.014, 1), { color: i ? '#f0a58a' : '#8fcdb8', x: c.x, y: 0.462, z: c.z, ao: false });
      for (const y of [0.62, 0.79]) add(rb(s * 2 - 0.04, 0.09, 0.022, 0.008, 1), { color: '#c9935a', x: c.x, y, z: c.z - f * (s - 0.02), ao: false });
    });
    // a lixeira de pedal
    {
      const bn = EX.bin;
      add(cyl(bn.r - 0.03, bn.r - 0.045, 0.34, 16), { color: vary('#8fcdb8', 0.04, 9), x: bn.x, y: FL, z: bn.z });
      add(cyl(bn.r - 0.02, bn.r - 0.02, 0.03, 16), { color: '#e4e6e8', x: bn.x, y: FL + 0.34, z: bn.z, ao: false });
      add(sphere(0.025, 8, 6), { color: '#3a3d42', x: bn.x, y: FL + 0.385, z: bn.z, ao: false });
      add(slab(0.07, 0.014, 0.05), { color: '#3a3d42', x: bn.x + bn.r - 0.03, y: FL + 0.01, z: bn.z, ao: false });
    }
    // os potes de ração das duas no capacho, ao lado da geladeira
    {
      const mxm = F.x + F.hx + 0.62, mz = ZM - ht - 0.24;
      add(rb(0.96, 0.008, 0.38, 0.003, 1), { color: '#8fcdb8', slot: 'ground', x: mxm, y: FL, z: mz, ao: false });
      artFlat(add, 'osso', 0.2, '#fff6e6', mxm, FL + 0.011, mz + 0.09, 0, { slot: 'ground' });
      for (const [s, r, col] of [[-1, 0.1, '#e8708a'], [1, 0.125, '#3d8fd1']]) {
        const rr = Number(r), bx = mxm + Number(s) * 0.25;
        add(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(rr * 0.8, 0), new THREE.Vector2(rr, 0.055), new THREE.Vector2(rr - 0.012, 0.06), new THREE.Vector2(rr - 0.03, 0.02), new THREE.Vector2(0, 0.02)], 18), { color: col, x: bx, y: FL + 0.008, z: mz - 0.03, ao: false });
        add(cyl(rr - 0.028, rr - 0.03, 0.022, 14), { color: '#9a6a40', x: bx, y: FL + 0.028, z: mz - 0.03, ao: false });
      }
    }
    // o tapete da pia (listras) e, nas paredes: o quadro-negro com os desenhos, a prateleira de potes e os quadrinhos
    {
      const sa = C('#f4d98a'), sb = C('#fff6e6'), sc = C('#e8a04a');
      rug(SINK_X, K.z1 + 0.5, 0.85, 0.32, (u, v) => (Math.abs(u) > 0.9 ? sc : Math.round(v * 3.2 + 4) % 2 ? sa : sb));
    }
    const bz = (K.z1 + KD.hinge.z) / 2 + 0.05;
    frame(XE, 1.42, bz, -1, 0, 1.0, 0.66, '#8a5a3c', '#3f5f52', 'osso', '#fff6e6');
    art(add, 'pata', 0.2, '#f4d98a', XE - 0.0385, 1.56, bz - 0.32, -1, 0);
    art(add, 'coracao', 0.16, '#f4b8c8', XE - 0.0385, 1.26, bz + 0.33, -1, 0);
    {
      const sz0 = K.z1 + 0.25, sz1 = DQ.z0 - 0.35, sy = 1.42;
      add(rb(0.16, 0.025, sz1 - sz0, 0.008, 1), { color: vary('#c9935a', 0.05, 8), x: XM + ht + 0.08, y: sy, z: (sz0 + sz1) / 2, ao: false });
      for (const z of [sz0 + 0.12, sz1 - 0.12]) add(slab(0.14, 0.1, 0.02), { color: '#a87445', x: XM + ht + 0.07, y: sy - 0.1, z, ao: false });
      const cols = ['#f4e3c8', '#bfe3f5', '#f0a58a', '#8fcdb8'];
      for (let i = 0; i < 4; i++) {
        const z = lerp(sz0 + 0.14, sz1 - 0.14, i / 3), hj = 0.14 + (i % 2) * 0.05;
        add(cyl(0.055, 0.05, hj, 12), { color: cols[i], slot: i === 1 ? 'glass' : 'solid', x: XM + ht + 0.085, y: sy + 0.025, z, ao: false });
        add(cyl(0.058, 0.058, 0.02, 12), { color: '#c9935a', x: XM + ht + 0.085, y: sy + 0.025 + hj, z, ao: false });
      }
    }
    for (let i = 0; i < 3; i++) frame(DS.x1 + 0.7 + i * 0.5, 1.5 + (i % 2) * 0.12, ZM - ht, 0, -1, 0.34, 0.34, ['#8a5a3c', '#c9a24a', '#f4b8c8'][i], '#fff6e6', ['pata', 'cenoura', 'coracao'][i], ['#3d8fd1', '#f07a1a', '#e8475f'][i]);
  }

  // a porta da cozinha: a folha na dobradiça (−Z local; com ela fechada, o +X local é o lado de dentro)
  const door = new THREE.Group();
  door.name = 'recanto:porta-da-cozinha';
  door.position.set(KD.hinge.x, 0, KD.hinge.z);
  {
    const b = createBaker();
    const Ld = KD.length - 0.024, zc = -0.012 - Ld / 2, T = 0.05, y0 = 0.025, top = KD.h - 0.005, gy0 = 1.3, gy1 = top - 0.14, sw = 0.13;
    const wood = vary('#b97a46', 0.06, 11), dark = '#a3683a';
    b.add(slab(T, gy0 - y0, Ld), { color: wood, y: y0, z: zc });
    b.add(slab(T, top - gy1, Ld), { color: wood, y: gy1, z: zc });
    for (const s of [-1, 1]) b.add(slab(T, gy1 - gy0, sw), { color: wood, y: gy0, z: zc + s * (Ld / 2 - sw / 2) });
    b.add(slab(T - 0.012, gy1 - gy0, 0.04), { color: dark, y: gy0, z: zc });
    b.add(slab(T - 0.012, 0.035, Ld - sw * 2), { color: dark, y: (gy0 + gy1) / 2 - 0.0175, z: zc });
    // por fora (−X): as duas almofadas e a maçaneta de bola; por dentro, só a chapa de baixo (as patinhas ficam na folha lisa)
    for (const [py, ph] of [[0.16, 0.48], [0.74, 0.44]]) b.add(rb(0.014, ph, Ld - 0.26, 0.006, 1), { color: dark, x: -T / 2 - 0.004, y: py, z: zc });
    b.add(sphere(0.036, 12, 8), { color: '#d9b25a', x: -T / 2 - 0.04, y: 1.0, z: -0.012 - Ld + 0.1 });
    b.add(cyl(0.012, 0.012, 0.04, 8), { color: '#d9b25a', x: -T / 2, y: 1.0, z: -0.012 - Ld + 0.1, rz: Math.PI / 2 });
    b.add(slab(0.006, 0.13, Ld - 0.06), { color: '#c9a24a', x: T / 2 + 0.001, y: 0.04, z: zc });
    const m = bakedMesh(b, 'porta:folha', { rough: 0.6 });
    door.add(m);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.012, gy1 - gy0, Ld - sw * 2), new THREE.MeshStandardMaterial({ color: '#a9d2ea', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }));
    pane.position.set(0, (gy0 + gy1) / 2, zc);
    door.add(pane);
  }
  // a alavanca do lado de dentro: o +Z dela aponta para dentro da cozinha (o −x do mundo com a porta fechada)
  const KH = L.KITCHEN_HANDLE;
  const handle = buildWallButton({ kind: 'lever', top: KH.top, color: '#e8554a', plate: '#f4ecdc', trim: '#7a4e2e', name: 'macaneta-de-alavanca' });
  handle.object.position.set(0.026, 0, -(KH.z - KD.hinge.z));
  handle.object.rotation.y = Math.PI / 2;
  door.add(handle.object);
  keep(door);
  const setDoor = (k) => { door.rotation.y = KD.closedYaw + (KD.openYaw - KD.closedYaw) * k; };
  setDoor(0);

  // o saco de ração na frente da maçaneta (caixa de empurrar: o colisor é do puzzle; origem no chão, no centro)
  const FS = L.FOOD_SACK;
  const sack = new THREE.Group();
  sack.name = 'recanto:saco-de-racao';
  {
    const b = createBaker();
    const w = FS.half * 2 - 0.05, hgt = FS.height - 0.012, hwd = w / 2;
    let g = /** @type {THREE.BufferGeometry} */ (new THREE.BoxGeometry(w, hgt, w, 10, 10, 10));
    g.translate(0, hgt / 2, 0);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-4);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = y / hgt, u = x / hwd, v = z / hwd;
      // cantos arredondados, a barriga estufada, o fundo assentado e a boca costurada (afina em z; a costura corre em x)
      const round = 1 - 0.08 * u * u * v * v;
      const belly = 1 - 0.07 * Math.pow(Math.abs(k - 0.38) / 0.62, 2);
      const pinch = k > 0.74 ? 1 - 0.82 * Math.pow((k - 0.74) / 0.26, 1.4) : 1;
      const wr = 0.006 * Math.sin(y * 31 + x * 17) * Math.sin(z * 23 + y * 13) * (0.4 + k);
      pos.setXYZ(i, x * round * belly * (k > 0.74 ? 1 - 0.06 * (k - 0.74) / 0.26 : 1) + wr * Math.sign(u), y - (k > 0.9 ? 0.02 * Math.abs(u) : 0), z * round * belly * pinch + wr * Math.sign(v) * pinch);
    }
    g.computeVertexNormals();
    const orange = C('#e08a3a'), band = C('#fff3dc'), dk = C('#c9702a'), o = new THREE.Color();
    b.add(g, { color: (p) => { const k = p.y / hgt; return o.copy(k > 0.2 && k < 0.7 ? band : k >= 0.7 && k < 0.74 ? dk : orange).multiplyScalar(0.9 + 0.1 * clamp01(k * 3)); }, y: 0.012 });
    // a costura da boca e, na faixa clara, o osso e a patinha (nas quatro faces)
    b.add(rb(w * 0.9, 0.03, 0.03, 0.01, 1), { color: '#c9702a', y: hgt - 0.022 });
    for (let i = 0; i < 9; i++) b.add(slab(0.012, 0.034, 0.034), { color: '#fff3dc', x: -w * 0.4 + i * w * 0.1, y: hgt - 0.024 });
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2, nx = Math.sin(a), nz = Math.cos(a), d = hwd + 0.009;
      for (const [g2, c] of picto('osso', 0.26)) b.add(g2, { color: c ?? '#8a5a3c', x: nx * d, y: 0.012 + hgt * 0.58, z: nz * d, ry: a });
      for (const [g2, c] of picto('pata', 0.14)) b.add(g2, { color: c ?? '#e08a3a', x: nx * d, y: 0.012 + hgt * 0.34, z: nz * d, ry: a });
    }
    sack.add(bakedMesh(b, 'saco:corpo', { rough: 0.85 }));
  }
  keep(sack);
  const setSack = (x, z) => sack.position.set(x, 0, z);
  setSack(FS.start.x, FS.start.z);

  // ---------------------------------------------------------------- sala
  {
    // o sofá (de costas para a parede do sul, olhando para o norte): pés, base, encosto, braços, almofadas e a manta
    const blue = vary('#5f8fb8', 0.04, 7), blueD = vary('#5583ab', 0.04, 7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.03, 0.025, 0.07, 8), { color: '#8a6a48', x: SF.x + sx * (SF.hx - 0.1), y: FL, z: SF.z + sz * (SF.hz - 0.08), ao: false });
    add(rb(SF.hx * 2, 0.3, SF.hz * 2, 0.06, 2), { color: blue, x: SF.x, y: 0.07, z: SF.z });
    add(rb(SF.hx * 2, 0.44, 0.2, 0.07, 2), { color: blueD, x: SF.x, y: 0.36, z: SF.z + SF.hz - 0.1, ao: false });
    for (const s of [-1, 1]) add(rb(0.2, 0.28, SF.hz * 2, 0.07, 2), { color: blueD, x: SF.x + s * (SF.hx - 0.1), y: 0.34, z: SF.z, ao: false });
    for (const s of [-0.5, 0.5]) {
      add(rb(SF.hx - 0.24, 0.12, SF.hz * 2 - 0.28, 0.05, 2), { color: '#7aa6cc', x: SF.x + s * (SF.hx - 0.2), y: 0.35, z: SF.z - 0.07, ao: false });
      add(rb(SF.hx - 0.3, 0.3, 0.12, 0.05, 2), { color: '#6f9cc4', x: SF.x + s * (SF.hx - 0.2), y: 0.46, z: SF.z + SF.hz - 0.24, rx: -0.12, ao: false });
    }
    add(rb(0.34, 0.3, 0.12, 0.08, 2), { color: '#f2c25e', x: SF.x - 0.55, y: 0.47, z: SF.z + 0.1, rz: 0.2, rx: -0.2, ao: false });
    add(rb(0.3, 0.28, 0.12, 0.08, 2), { color: '#e8708a', x: SF.x + 0.6, y: 0.47, z: SF.z + 0.08, rz: -0.15, rx: -0.2, ao: false });
    add(rb(0.24, 0.04, SF.hz * 2 + 0.02, 0.018, 1), { color: vary('#f4e3c8', 0.06, 30), x: SF.x + SF.hx - 0.1, y: 0.62, z: SF.z, ao: false });
    // a mesinha de centro (tampo, prateleira, quatro pés), com os livros, a caneca e o vasinho
    add(rb(CT.hx * 2, 0.04, CT.hz * 2, 0.015, 1), { color: vary('#c9935a', 0.05, 8), x: CT.x, y: CT.h - 0.04, z: CT.z, ao: false });
    add(slab(CT.hx * 2 - 0.12, 0.02, CT.hz * 2 - 0.12), { color: '#b5864a', x: CT.x, y: 0.12, z: CT.z, ao: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(rb(0.045, CT.h - 0.04, 0.045, 0.01, 1), { color: '#a87445', x: CT.x + sx * (CT.hx - 0.05), y: FL, z: CT.z + sz * (CT.hz - 0.05) });
    add(rb(0.26, 0.03, 0.19, 0.006, 1), { color: '#3d8fd1', x: CT.x - 0.25, y: CT.h, z: CT.z + 0.04, ry: 0.2, ao: false });
    add(rb(0.22, 0.025, 0.16, 0.006, 1), { color: '#f2c230', x: CT.x - 0.24, y: CT.h + 0.03, z: CT.z + 0.04, ry: -0.1, ao: false });
    add(cyl(0.04, 0.035, 0.085, 10), { color: '#e8475f', x: CT.x + 0.08, y: CT.h, z: CT.z - 0.1, ao: false });
    add(cyl(0.06, 0.045, 0.11, 12), { color: '#f4e3c8', x: CT.x + 0.32, y: CT.h, z: CT.z + 0.08, ao: false });
    add(bushGeo(0.08, 0.1, 71, '#f4b8c8', 5), { color: null, slot: 'plant', x: CT.x + 0.32, y: CT.h + 0.08, z: CT.z + 0.08 });
    add(rb(0.5, 0.12, 0.2, 0.03, 1), { color: (p) => C(Math.floor(p.y * 50) % 2 ? '#c99b5a' : '#b5864a'), x: CT.x, y: 0.14, z: CT.z, ao: false });
    // a poltrona (olha para o leste) com a manta de tricô
    const rose = vary('#e59a8a', 0.04, 7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.03, 0.025, 0.08, 8), { color: '#8a6a48', x: AC.x + sx * (AC.hx - 0.09), y: FL, z: AC.z + sz * (AC.hz - 0.09), ao: false });
    add(rb(AC.hx * 2, 0.28, AC.hz * 2, 0.07, 2), { color: rose, x: AC.x, y: 0.08, z: AC.z });
    add(rb(0.2, AC.h - 0.36, AC.hz * 2, 0.08, 2), { color: rose, x: AC.x - AC.hx + 0.1, y: 0.36, z: AC.z, ao: false });
    for (const s of [-1, 1]) add(rb(AC.hx * 2 - 0.1, 0.24, 0.18, 0.07, 2), { color: '#dc8d7c', x: AC.x + 0.05, y: 0.34, z: AC.z + s * (AC.hz - 0.09), ao: false });
    add(rb(AC.hx * 2 - 0.34, 0.11, AC.hz * 2 - 0.4, 0.05, 2), { color: '#f0b3a4', x: AC.x + 0.1, y: 0.35, z: AC.z, ao: false });
    add(rb(0.05, 0.36, 0.44, 0.02, 1), { color: vary('#8fcdb8', 0.08, 40), x: AC.x - AC.hx + 0.215, y: 0.42, z: AC.z + 0.05, rz: -0.08, ao: false });
    // o tapete grande (losangos) embaixo da mesinha
    {
      const ta = C('#d98a5a'), tb = C('#f2d7b0'), tc = C('#8f5a3c'), td = C('#e9b98a');
      const hx = 1.8, hz = 1.3;
      rug(CT.x - 0.5, CT.z - 0.05, hx, hz, (u, v) => {
        const d = Math.min((1 - Math.abs(u)) * hx, (1 - Math.abs(v)) * hz);
        if (d < 0.1) return tc;
        if (d < 0.2) return tb;
        const q = Math.abs(((u * hx * 1.6) % 1 + 1) % 1 - 0.5) + Math.abs(((v * hz * 1.6) % 1 + 1) % 1 - 0.5);
        return q < 0.22 ? ta : q < 0.36 ? td : tb;
      });
    }
    // o tapete da TV (listras) e a caminha de sol embaixo da janela (rente ao chão: as dogs passam por cima)
    {
      const S = EX.loveseat, sa = C('#7fa36b'), sb = C('#f2e6c8'), sc = C('#5f8a56');
      add(tiles(2.6, 1.9, 0.2, 0.19, (p) => (Math.abs(p.x) > 1.1 ? sc : Math.round(p.z / 0.19 + 20) % 2 ? sa : sb)), { color: null, slot: 'ground', x: S.x, y: FL + 0.004, z: S.z + 0.95, ao: false });
      const mx = XE - 1.6, mz = (WIN.sala1.a + WIN.sala1.b) / 2;
      add(rb(0.9, 0.05, 0.7, 0.022, 2), { color: vary('#e8a04a', 0.05, 12), x: mx, y: FL, z: mz, ao: false });
      add(rb(0.62, 0.016, 0.44, 0.007, 1), { color: '#f2c98a', x: mx, y: FL + 0.044, z: mz, ao: false });
      artFlat(add, 'pata', 0.26, '#c9702a', mx, FL + 0.0625, mz, Math.PI / 2);
    }
    // o rack com a TV (olha para o norte), a caixa de som e o vasinho
    const tz = TV.z - TV.hz;
    add(slab(TV.hx * 2 - 0.1, 0.06, TV.hz * 2 - 0.1), { color: '#8a6a48', x: TV.x, y: FL, z: TV.z, ao: false });
    add(rb(TV.hx * 2, TV.h - 0.06, TV.hz * 2 - 0.02, 0.02, 1), { color: vary('#c99b6a', 0.04, 6), x: TV.x, y: 0.06, z: TV.z + 0.01 });
    for (const s of [-1, 1]) {
      add(rb(TV.hx * 0.62, TV.h - 0.14, 0.016, 0.006, 1), { color: '#dcc095', x: TV.x + s * TV.hx * 0.64, y: 0.1, z: tz + 0.016, ao: false });
      add(sphere(0.017, 8, 6), { color: '#c9a24a', x: TV.x + s * TV.hx * 0.4, y: 0.3, z: tz - 0.002, ao: false });
    }
    add(slab(TV.hx * 0.52, TV.h - 0.2, 0.01), { color: '#5a4030', x: TV.x, y: 0.13, z: tz + 0.016, ao: false });
    add(rb(0.34, 0.05, 0.2, 0.012, 1), { color: '#3a3d42', x: TV.x - 0.1, y: TV.h, z: TV.z + 0.02, ao: false });
    add(rb(1.16, 0.68, 0.04, 0.012, 1), { color: '#2a2c2f', x: TV.x - 0.1, y: TV.h + 0.07, z: TV.z + 0.04, ao: false });
    add(slab(1.08, 0.6, 0.006), { color: '#1d2733', slot: 'glass', x: TV.x - 0.1, y: TV.h + 0.11, z: TV.z + 0.018 });
    add(rb(0.14, 0.24, 0.14, 0.02, 1), { color: '#4a4f57', x: TV.x + 0.64, y: TV.h, z: TV.z + 0.02, ao: false });
    add(rod(0.045, 0.012, 12), { color: '#2a2c2f', x: TV.x + 0.64, y: TV.h + 0.15, z: TV.z - 0.052, rx: Math.PI / 2, ao: false });
    // a estante alta de frente para o sofá (livros, vasos, o troféu e os cestos embaixo)
    {
      const S = EX.bookcase, x0 = S.x - S.hx, x1 = S.x + S.hx, zf = S.z + S.hz, wood = vary('#c99b6a', 0.04, 6);
      add(slab(S.hx * 2 - 0.02, S.h - 0.02, 0.015), { color: '#b08452', x: S.x, y: FL, z: S.z - S.hz + 0.012, ao: false });
      for (const x of [x0 + 0.02, S.x, x1 - 0.02]) add(rb(0.04, S.h, S.hz * 2 - 0.01, 0.008, 1), { color: wood, x, y: FL, z: S.z });
      add(rb(S.hx * 2 + 0.04, 0.05, S.hz * 2 + 0.03, 0.012, 1), { color: '#b5864a', x: S.x, y: S.h, z: S.z, ao: false });
      const ys = [0.06, 0.5, 0.9, 1.3, 1.7];
      for (const y of ys) add(slab(S.hx * 2 - 0.04, 0.03, S.hz * 2 - 0.04), { color: '#d9b98f', x: S.x, y, z: S.z + 0.005, ao: false });
      for (let r = 1; r < ys.length; r++) for (const s of [-1, 1]) {
        const a0 = s < 0 ? x0 + 0.05 : S.x + 0.03, a1 = s < 0 ? S.x - 0.03 : x1 - 0.05, yy = ys[r] + 0.03;
        if ((r + (s > 0 ? 1 : 0)) % 3 === 0) {
          // um vaso e um porta-retrato no lugar dos livros
          add(cyl(0.07, 0.05, 0.2, 12), { color: ['#8fcdb8', '#f0a58a', '#8a72c2'][r % 3], x: a0 + 0.2, y: yy, z: S.z + 0.04, ao: false });
          add(rb(0.2, 0.24, 0.02, 0.008, 1), { color: '#8a5a3c', x: a1 - 0.22, y: yy, z: S.z + 0.08, ao: false });
          add(slab(0.15, 0.19, 0.004), { color: '#fff6e6', x: a1 - 0.22, y: yy + 0.025, z: S.z + 0.092, ao: false });
          art(add, r % 2 ? 'pata' : 'osso', 0.1, '#e8708a', a1 - 0.22, yy + 0.12, S.z + 0.0965, 0, 1);
        } else books('x', a0, a1 - (r % 2) * 0.2, yy, zf - 0.03, 1, 30 + r * 2 + (s > 0 ? 1 : 0), 0.2);
      }
      for (const s of [-1, 1]) add(rb(S.hx - 0.12, 0.34, S.hz * 2 - 0.08, 0.03, 1), { color: (p) => C(Math.floor(p.y * 36) % 2 ? '#c99b5a' : '#b5864a'), x: S.x + s * S.hx / 2, y: 0.095, z: S.z + 0.01, ao: false });
    }
    // o aparador (com o vaso de flores e os porta-retratos) e a paisagem na parede em cima dele
    {
      const S = EX.sideboard, fzz = S.z + S.hz;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.028, 0.02, 0.14, 8), { color: '#8a6a48', x: S.x + sx * (S.hx - 0.08), y: FL, z: S.z + sz * (S.hz - 0.07), ao: false });
      add(rb(S.hx * 2, S.h - 0.16, S.hz * 2 - 0.02, 0.02, 1), { color: vary('#5aa7a0', 0.04, 6), x: S.x, y: 0.14, z: S.z - 0.01 });
      add(rb(S.hx * 2 + 0.04, 0.03, S.hz * 2 + 0.02, 0.01, 1), { color: vary('#c9935a', 0.05, 8), x: S.x, y: S.h - 0.03, z: S.z, ao: false });
      for (let i = -1; i <= 1; i++) {
        add(rb(S.hx * 0.62, S.h - 0.26, 0.016, 0.006, 1), { color: '#6fb7b0', x: S.x + i * S.hx * 0.64, y: 0.18, z: fzz - 0.014, ao: false });
        add(sphere(0.017, 8, 6), { color: '#c9a24a', x: S.x + i * S.hx * 0.64, y: 0.62, z: fzz + 0.004, ao: false });
      }
      add(cyl(0.07, 0.05, 0.22, 12), { color: '#f4e3c8', x: S.x - 0.4, y: S.h, z: S.z, ao: false });
      add(bushGeo(0.13, 0.16, 77, '#e8708a', 8), { color: null, slot: 'plant', x: S.x - 0.4, y: S.h + 0.2, z: S.z });
      add(rb(0.22, 0.26, 0.02, 0.008, 1), { color: '#c9a24a', x: S.x + 0.3, y: S.h, z: S.z - 0.06, ao: false });
      add(slab(0.17, 0.21, 0.004), { color: '#fff6e6', x: S.x + 0.3, y: S.h + 0.025, z: S.z - 0.048, ao: false });
      art(add, 'coracao', 0.11, '#e8475f', S.x + 0.3, S.h + 0.13, S.z - 0.0435, 0, 1);
      // a paisagem: o céu, o sol, dois morros
      const px = S.x, py = 1.55, zf = ZM + ht;
      add(rb(1.1, 0.7, 0.03, 0.012, 1), { color: '#8a5a3c', x: px, y: py - 0.35, z: zf + 0.015, ao: false });
      add(slab(1.02, 0.62, 0.006), { color: '#bfe3f5', x: px, y: py - 0.31, z: zf + 0.031, ao: false });
      add(disc(0.09, 0.26, 0.14), { color: '#f2c230', x: px, y: py, z: zf + 0.0385, ao: false });
      const hill = (y0, amp, ph, k) => { const pts = [[-0.51, -0.31]]; for (let i = 0; i <= 14; i++) pts.push([-0.51 + (1.02 * i) / 14, y0 + amp * Math.sin((i / 14) * Math.PI * k + ph)]); pts.push([0.51, -0.31]); return shapeXY(pts); };
      add(hill(-0.16, 0.11, 0.3, 1.3), { color: '#7fb04f', x: px, y: py, z: zf + 0.04, ao: false });
      add(hill(-0.24, 0.07, 2.4, 1.1), { color: '#5c9a3a', x: px, y: py, z: zf + 0.042, ao: false });
    }
    // a namoradeira de frente para a TV e o pufe
    {
      const S = EX.loveseat, green = vary('#7fa36b', 0.04, 7);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cyl(0.03, 0.025, 0.07, 8), { color: '#8a6a48', x: S.x + sx * (S.hx - 0.1), y: FL, z: S.z + sz * (S.hz - 0.08), ao: false });
      add(rb(S.hx * 2, 0.3, S.hz * 2, 0.06, 2), { color: green, x: S.x, y: 0.07, z: S.z });
      add(rb(S.hx * 2, 0.42, 0.2, 0.07, 2), { color: '#759a62', x: S.x, y: 0.36, z: S.z - S.hz + 0.1, ao: false });
      for (const s of [-1, 1]) add(rb(0.18, 0.26, S.hz * 2, 0.07, 2), { color: '#759a62', x: S.x + s * (S.hx - 0.09), y: 0.34, z: S.z, ao: false });
      add(rb(S.hx * 2 - 0.4, 0.11, S.hz * 2 - 0.28, 0.05, 2), { color: '#93b57f', x: S.x, y: 0.35, z: S.z + 0.07, ao: false });
      add(rb(0.3, 0.28, 0.12, 0.08, 2), { color: '#f2c25e', x: S.x + 0.3, y: 0.46, z: S.z - 0.08, rx: 0.2, ao: false });
      const P = EX.pouf;
      add(cyl(P.r - 0.03, P.r - 0.05, 0.3, 18), { color: vary('#e8a04a', 0.05, 12), x: P.x, y: FL, z: P.z });
      add(cyl(P.r - 0.08, P.r - 0.03, 0.05, 18), { color: '#f2b866', x: P.x, y: FL + 0.3, z: P.z, ao: false });
      add(sphere(0.022, 8, 6), { color: '#8a5a3c', x: P.x, y: FL + 0.355, z: P.z, ao: false });
    }
    // a luminária de piso ao lado da poltrona e os vasos de planta
    {
      const P = EX.floorLamp;
      add(cyl(P.r - 0.02, P.r, 0.03, 16), { color: '#4a4f57', x: P.x, y: FL, z: P.z, ao: false });
      add(cyl(0.014, 0.014, 1.42, 6), { color: '#c9a24a', x: P.x, y: FL + 0.03, z: P.z, ao: false });
      add(cyl(0.12, 0.2, 0.26, 18), { color: '#fff1c2', slot: 'lit', x: P.x, y: 1.4, z: P.z });
    }
    potPlant(EX.plants[0].x, EX.plants[0].z, EX.plants[0].r, 'palma', 41, Math.PI * 0.95, Math.PI * 1.55);
    potPlant(EX.plants[1].x, EX.plants[1].z, EX.plants[1].r, 'costela', 42, Math.PI * 0.45, Math.PI * 1.05);
    potPlant(EX.plants[2].x, EX.plants[2].z, EX.plants[2].r, 'ficus', 43);
    // os quadros em cima do sofá e na parede do oeste
    const fy = 1.62, zf = ZS;
    frame(SF.x - 0.62, fy, zf, 0, -1, 0.5, 0.62, '#8a5a3c', '#fff6e6', 'pata', '#5f8fb8');
    frame(SF.x, fy + 0.06, zf, 0, -1, 0.56, 0.5, '#c9a24a', '#fde9c9', 'osso', '#c79a6a');
    frame(SF.x + 0.62, fy, zf, 0, -1, 0.5, 0.62, '#8a5a3c', '#fff6e6', 'pata', '#e8708a');
    frame(XW, 1.6, AC.z, 1, 0, 0.8, 0.6, '#c9a24a', '#e8f3fb', 'sol', '#f2c230');
    frame(XW, 1.55, AC.z + 1.9, 1, 0, 0.44, 0.56, '#8a5a3c', '#fff6e6', 'cenoura', '#f07a1a');
  }

  // ---------------------------------------------------------------- quintal: o muro, a passagem baixa e a porta
  const Y = L.YARD, SD = L.SERVICE_DOOR, YG = L.YARD_GAP, BR = L.BRANCH, SB = L.SERVICE_BOLT;
  const wallY = '#f0e0c6';
  /** A cor do muro do quintal, mais escura na base (igual em todos os trechos: linear na altura). */
  const yardTint = (() => { const c = C(wallY), o = new THREE.Color(); return (p) => o.copy(c).multiplyScalar((0.84 + 0.16 * clamp01(p.y / Y.wallH)) * (1 + 0.03 * Math.sin(p.x * 3.1 + p.z * 2.3))); })();
  const yardWall = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.02) return;
    const ry = -Math.atan2(bz - az, bx - ax);
    // o reboco gasto, com o musgo nas pontas (o pé do pilar, o canto do muro do condomínio)
    addY(wallBox(len, Y.wallH, t), { color: weathered(wallY, { h: Y.wallH, half: len / 2, seed: ax * 0.37 + az * 0.11, eave: 0.16 }), x: (ax + bx) / 2, z: (az + bz) / 2, ry, ao: false });
    addY(rb(len + 0.02, 0.05, t + 0.06, 0.015, 1), { color: '#c9b693', x: (ax + bx) / 2, y: Y.wallH, z: (az + bz) / 2, ry, ao: false });
  };
  const GM = 0.24; // o trecho do arco passa disto para cada lado da passagem
  const PIL = 0.14; // largura dos pilares da porta
  yardWall(Y.x0 + ht, Y.z0, YG.x0 - GM, Y.z0);
  yardWall(YG.x1 + GM, Y.z0, SD.hinge.x - PIL, Y.z0);
  yardWall(SD.latchPost.x + PIL, Y.z0, Y.x1 + ht, Y.z0);
  yardWall(Y.x1, Y.z0 + ht, Y.x1, Y.z1 - 0.12);
  {
    // a passagem baixa: um arco de escoar água, rente ao chão, com as pedras em volta dos dois lados e a calhinha
    const gc = (YG.x0 + YG.x1) / 2, gw = (YG.x1 - YG.x0) / 2, ys = YG.h - 0.06, yc = YG.h + 0.02, hwid = gw + GM;
    const s = new THREE.Shape();
    s.moveTo(-hwid, 0);
    s.lineTo(-gw, 0);
    s.lineTo(-gw, ys);
    for (let i = 1; i <= 12; i++) { const a = Math.PI - (i / 12) * Math.PI; s.lineTo(Math.cos(a) * gw, ys + Math.sin(a) * (yc - ys)); }
    s.lineTo(gw, 0);
    s.lineTo(hwid, 0);
    s.lineTo(hwid, Y.wallH);
    s.lineTo(-hwid, Y.wallH);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
    g.translate(0, 0, -ht);
    addY(g, { color: yardTint, x: gc, z: Y.z0, ao: false });
    addY(rb(hwid * 2 + 0.02, 0.05, t + 0.06, 0.015, 1), { color: '#c9b693', x: gc, y: Y.wallH, z: Y.z0, ao: false });
    // as pedras do arco (uma fiada em leque, com a pedra do fecho no meio) e as das ombreiras, dos dois lados do muro
    const stone = (i) => ['#b9ad98', '#a99d88', '#c6baa4'][i % 3];
    const NS = 9, sw = (gw * 2 + 0.2) / NS;
    for (const sgn of [-1, 1]) {
      const zf = Y.z0 + sgn * (ht + 0.006);
      for (let i = 0; i < NS; i++) {
        const dx = (i - (NS - 1) / 2) * sw, key = i === (NS - 1) / 2;
        const ya = Math.abs(dx) < gw ? ys + (yc - ys) * Math.sqrt(1 - (dx / gw) ** 2) : ys;
        addY(new THREE.BoxGeometry(sw - 0.008, key ? 0.13 : 0.105, 0.014), { color: key ? '#d3c8b2' : stone(i), x: gc + dx, y: ya + (key ? 0.072 : 0.06), z: zf, rz: -dx * 0.5, ao: false });
      }
      for (const sx of [-1, 1]) for (let j = 0; j < 2; j++) addY(new THREE.BoxGeometry(0.1, 0.165, 0.014), { color: stone(j + (sx > 0 ? 1 : 0)), x: gc + sx * (gw + 0.052), y: 0.087 + j * 0.172, z: zf, ao: false });
    }
    // a calhinha: o canal de concreto por baixo do arco, com o fio de água da chuva
    addY(slab(0.3, 0.022, 2.0), { color: '#bdb5a6', x: gc, z: Y.z0 - 0.05, ao: false });
    addY(slab(0.1, 0.004, 2.0), { color: '#6f9fb5', slot: 'glass', x: gc, y: 0.022, z: Y.z0 - 0.05 });
    addY(flatBlob(0.3, 61), { color: '#8fb6c9', slot: 'glass', x: gc + 0.06, y: 0.019, z: Y.z0 - 1.25, sz: 0.7 });
  }
  // os pilares da porta da área de serviço (fora do vão da folha), o telhadinho em cima e a soleira
  for (const px of [SD.hinge.x - PIL / 2, SD.latchPost.x + PIL / 2]) {
    addY(rb(PIL, SD.h + 0.12, 0.2, 0.02, 1), { color: '#e6d3b4', x: px, z: Y.z0 });
    addY(rb(PIL + 0.05, 0.05, 0.25, 0.015, 1), { color: '#c9b693', x: px, y: SD.h + 0.07, z: Y.z0, ao: false });
  }
  addY(gableRoof(SD.latchPost.x - SD.hinge.x + 0.56, 0.5, 0.18), { color: '#c4643f', x: (SD.hinge.x + SD.latchPost.x) / 2, y: SD.h + 0.12, z: Y.z0, ao: false });
  addY(rb(SD.latchPost.x - SD.hinge.x, 0.03, 0.34, 0.008, 1), { color: '#cfc6b6', x: (SD.hinge.x + SD.latchPost.x) / 2, y: -0.008, z: Y.z0, ao: false });
  // a folha: tábuas verdes, as travessas e o Z por dentro (o +X local é o quintal); por fora (−X), a travessa do ferrolho
  const sdoor = new THREE.Group();
  sdoor.name = 'recanto:porta-da-area-de-servico';
  sdoor.position.set(SD.hinge.x, 0, SD.hinge.z);
  const BOLT_Y = 0.66; // a altura do ferrolho (acima da cabeça das duas)
  const BOLT_Z = 0.146; // quanto o eixo dele fica ao norte do centro do muro
  {
    const b = createBaker();
    const Ls = SD.length - 0.02, boards = 6, T = 0.045, zc = -Ls / 2 - 0.01;
    for (let i = 0; i < boards; i++) b.add(slab(T, SD.h - 0.045, Ls / boards - 0.006), { color: vary(i % 2 ? '#7fa36b' : '#759a62', 0.05, 9), y: 0.03, z: -(i + 0.5) * (Ls / boards) - 0.01 });
    for (const y of [0.3, SD.h - 0.4]) b.add(rb(0.024, 0.11, Ls - 0.04, 0.008, 1), { color: '#6a8f58', x: T / 2 + 0.01, y, z: zc });
    {
      const y0 = 0.41, y1 = SD.h - 0.4, len = Math.hypot(y1 - y0, Ls - 0.08);
      b.add(new THREE.BoxGeometry(0.022, len, 0.1), { color: '#6a8f58', x: T / 2 + 0.009, y: (y0 + y1) / 2, z: zc, rx: Math.atan2(Ls - 0.08, y1 - y0) });
    }
    b.add(new THREE.TorusGeometry(0.045, 0.009, 6, 14).rotateY(Math.PI / 2), { color: '#3a3d42', x: T / 2 + 0.03, y: 0.98, z: -Ls + 0.11 });
    for (const y of [0.36, SD.h - 0.34]) b.add(rb(0.012, 0.05, 0.22, 0.004, 1), { color: '#3a3d42', x: T / 2 + 0.028, y, z: -0.12 }); // as dobradiças
    // por fora: a travessa, o calço e a argola de ferro onde o ferrolho entra
    b.add(rb(0.024, 0.1, Ls - 0.04, 0.008, 1), { color: '#6a8f58', x: -T / 2 - 0.01, y: BOLT_Y - 0.05, z: zc });
    b.add(rb(BOLT_Z - T / 2 - 0.016, 0.07, 0.08, 0.008, 1), { color: '#8a6a48', x: -(T / 2 + (BOLT_Z - T / 2 - 0.016) / 2), y: BOLT_Y - 0.035, z: -0.915 });
    b.add(new THREE.TorusGeometry(0.02, 0.0065, 6, 12), { color: '#3a3d42', x: -BOLT_Z, y: BOLT_Y, z: -0.915 });
    sdoor.add(bakedMesh(b, 'porta-servico:folha', { rough: 0.7 }));
  }
  keep(sdoor);
  const setSdoor = (k) => { sdoor.rotation.y = SD.closedYaw + (SD.openYaw - SD.closedYaw) * k; };
  setSdoor(0);

  // ---------------------------------------------------------------- o ferrolho, do lado de fora (o norte)
  // Fica todo no pilar do batente (a porta abre para o sul: nada dele se mexe nem atravessa nada quando ela abre). A
  // barra corre para o leste e sai da argola da porta; a cordinha vai do pino dela até a mão-francesa e desce até a
  // argola de morder, parada em SERVICE_BOLT.ring.
  const bolt = new THREE.Group();
  bolt.name = 'recanto:ferrolho';
  const px0 = SD.latchPost.x, zF = Y.z0 - 0.1, zBar = Y.z0 - BOLT_Z, TRAVEL = 0.14;
  const IRON = '#3a3d42';
  const TIP = new THREE.Vector3(SB.ring.x, 0.775, SB.ring.z); // a ponta da mão-francesa, em cima da argola
  const EYE = new THREE.Vector3(px0 + 0.3, BOLT_Y, zBar - 0.056); // o olhal por onde a cordinha puxa o pino
  {
    // a tábua de apoio (no pilar, passando sobre o muro), as duas guias, o olhal e a mão-francesa com o tirante
    addY(rb(0.335, 0.24, 0.025, 0.006, 1), { color: vary('#a87445', 0.06, 14), x: px0 + 0.1725, y: BOLT_Y - 0.07, z: zF - 0.0125, ao: false });
    addY(slab(0.19, 0.22, 0.03), { color: '#8a6a48', x: px0 + 0.245, y: BOLT_Y - 0.06, z: zF + 0.012, ao: false });
    for (const gx of [px0 + 0.03, px0 + 0.25]) addY(rb(0.022, 0.056, 0.046, 0.006, 1), { color: IRON, x: gx, y: BOLT_Y - 0.028, z: zBar + 0.004, ao: false });
    addY(rodAB([EYE.x, BOLT_Y, zF - 0.02], [EYE.x, BOLT_Y, EYE.z + 0.012], 0.004, 5), { color: IRON, ao: false });
    addY(new THREE.TorusGeometry(0.012, 0.004, 5, 10).rotateY(Math.PI / 2), { color: IRON, x: EYE.x, y: EYE.y, z: EYE.z, ao: false });
    const root = [px0 + 0.3, 0.775, zF - 0.03];
    addY(rb(0.06, 0.08, 0.012, 0.004, 1), { color: IRON, x: root[0], y: 0.735, z: zF - 0.031, ao: false });
    addY(rodAB(root, [TIP.x, TIP.y, TIP.z], 0.011, 6), { color: IRON, ao: false });
    addY(rodAB([px0 + 0.07, 1.08, zF - 0.004], [lerp(root[0], TIP.x, 0.82), 0.78, lerp(root[2], TIP.z, 0.82)], 0.006, 5), { color: IRON, ao: false });
    addY(rb(0.05, 0.05, 0.012, 0.004, 1), { color: IRON, x: px0 + 0.07, y: 1.055, z: zF - 0.006, ao: false });
    addY(new THREE.TorusGeometry(0.014, 0.004, 5, 10).rotateY(Math.PI / 2), { color: IRON, x: TIP.x, y: TIP.y - 0.014, z: TIP.z, ao: false });
    // a cordinha parada: do olhal até a raiz da mão-francesa e por cima dela até a ponta
    addY(rodAB([EYE.x, EYE.y, EYE.z], [root[0], root[1] + 0.014, root[2]], 0.005, 5), { color: '#d8c18f', ao: false });
    addY(rodAB([root[0], root[1] + 0.014, root[2]], [TIP.x, TIP.y + 0.014, TIP.z], 0.005, 5), { color: '#d8c18f', ao: false });
  }
  // a barra com o pino (corre TRAVEL para o leste) e o trecho da cordinha entre o pino e o olhal
  const boltBar = new THREE.Group();
  {
    const b = createBaker();
    b.add(rod(0.013, 0.3, 8), { color: '#9aa0a6', x: px0 + 0.02, y: BOLT_Y, z: zBar, rz: Math.PI / 2 });
    b.add(rod(0.008, 0.05, 6), { color: IRON, x: px0 + 0.09, y: BOLT_Y, z: zBar - 0.03, rx: Math.PI / 2 });
    b.add(sphere(0.014, 8, 6), { color: '#d6453c', x: px0 + 0.09, y: BOLT_Y, z: zBar - 0.056 });
    boltBar.add(bakedMesh(b, 'ferrolho:barra', { rough: 0.4, metal: 0.5 }));
  }
  bolt.add(boltBar);
  const cordMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const CORD = C('#d8c18f');
  const pinCord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 5).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: CORD, roughness: 0.92 }));
  pinCord.name = 'ferrolho:cordinha-do-pino';
  bolt.add(pinCord);
  // a cordinha pendurada e a argola de morder: as dogs passam roçando (a Radhija morde e puxa)
  const hang = new THREE.Group();
  hang.name = 'corda-do-ferrolho';
  hang.userData.passThrough = true;
  const NC = 12;
  const cordTube = createCordTube(NC, 5, CORD);
  const cordMesh = new THREE.Mesh(cordTube.geometry, cordMat);
  cordMesh.castShadow = true;
  cordMesh.frustumCulled = false;
  const RING_R = 0.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.01, 8, 18), new THREE.MeshStandardMaterial({ color: '#d9b25a', roughness: 0.35, metalness: 0.7 }));
  ring.castShadow = true;
  hang.add(cordMesh, ring);
  bolt.add(hang);
  keep(bolt);
  const boltSt = { pull: 0, slid: 0, dirty: true };
  /** @type {null | (() => ({ pos: THREE.Vector3, k: number } | null))} */
  let gripSrc = null;
  const REST = new THREE.Vector3(SB.ring.x, SB.ring.y, SB.ring.z);
  const _re = new THREE.Vector3(), _end = new THREE.Vector3(), _dir = new THREE.Vector3(), _top = new THREE.Vector3();
  const CP = Array.from({ length: NC }, () => new THREE.Vector3());
  /** Onde a argola fica parada com o puxão de agora (o norte é −z). */
  const restEnd = () => _re.copy(REST).setZ(REST.z - boltSt.pull * SB.pull);
  function layoutBolt() {
    const g = gripSrc ? gripSrc() : null;
    const gk = g && g.k > 0 ? g.k : 0;
    _end.copy(restEnd());
    if (gk > 0) _end.lerp(g.pos, gk);
    // da ponta da mão-francesa até a argola: reta quando esticada, com uma barriguinha quando frouxa
    _top.set(TIP.x, TIP.y - 0.028, TIP.z);
    _dir.subVectors(_end, _top);
    const len = Math.max(1e-4, _dir.length());
    _dir.divideScalar(len);
    const tipEnd = Math.max(0, len - RING_R);
    const slack = 0.02 * (1 - Math.max(boltSt.pull, gk));
    for (let i = 0; i < NC; i++) {
      const u = i / (NC - 1);
      CP[i].copy(_top).addScaledVector(_dir, tipEnd * u);
      CP[i].x += Math.sin(u * Math.PI) * slack;
    }
    cordTube.update(CP, 0.0075);
    // a argola pendurada na ponta, no plano da cordinha
    ring.position.copy(_end);
    ring.quaternion.setFromUnitVectors(_up, _top.copy(_dir).negate());
    // a barra corre e a cordinha do pino encurta
    const sx = boltSt.slid * TRAVEL;
    boltBar.position.x = sx;
    const x0 = px0 + 0.09 + sx, x1 = EYE.x, wl = Math.max(0.005, x1 - x0);
    pinCord.scale.set(wl, 1, 1);
    pinCord.position.set((x0 + x1) / 2, BOLT_Y, EYE.z);
    boltSt.dirty = false;
  }
  const serviceBolt = {
    object: bolt,
    /** Quanto ela já puxou (0..1): a argola vem até SERVICE_BOLT.pull m para o norte. */
    setPull(k) { boltSt.pull = clamp01(k); boltSt.dirty = true; },
    /** Mordendo: src() → { pos (a boca, no mundo), k (0..1) } ou null; enquanto morde, a argola segue a boca. */
    setGrip(src) { gripSrc = src || null; boltSt.dirty = true; },
    /** Onde está a argola parada (sem ninguém mordendo), com o puxão de agora. */
    bitePoint() { const e = restEnd(); return { x: e.x, y: e.y, z: e.z }; },
    /** Onde a argola está desenhada agora (na boca de quem morde; os testes conferem). */
    tip() { return { x: ring.position.x, y: ring.position.y, z: ring.position.z }; },
    /** O ferrolho corre (0: trancado; 1: aberto). */
    setSlid(k) { boltSt.slid = clamp01(k); boltSt.dirty = true; },
  };
  layoutBolt();

  // ---------------------------------------------------------------- o galho da tempestade (a tora e as folhas)
  // Tudo cabe no colisor (BRANCH.half; as folhas até ~0,6 m): o galho começa na frente da passagem do muro e tapa a
  // passagem; a Rhaenyra empurra para o oeste. Tudo anda junto.
  const branch = new THREE.Group();
  branch.name = 'recanto:galho';
  {
    const b = createBaker();
    const bark = vary('#6b4a2e', 0.12, 23), barkL = vary('#7d5a3a', 0.1, 31), cut = '#d9b98f';
    const hb = BR.half, R2 = rng(77);
    // a tora grossa atravessada (leste–oeste), a ponta quebrada com lascas e os tocos
    b.add(limbAB([hb - 0.06, 0.17, 0.04], [-hb + 0.02, 0.15, 0.12], 0.16, 0.12, 10), { color: bark });
    b.add(disc(0.15, 0, 0, 1, 1, 10).rotateY(Math.PI / 2), { color: cut, x: hb - 0.058, y: 0.17, z: 0.04, ry: -0.09 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      b.add(new THREE.ConeGeometry(0.03, 0.1 + R2() * 0.06, 4).rotateZ(-Math.PI / 2), { color: cut, x: hb - 0.02, y: 0.17 + Math.sin(a) * 0.09, z: 0.04 + Math.cos(a) * 0.09 });
    }
    b.add(limbAB([0.08, 0.22, 0.02], [0.2, BR.height - 0.03, -0.22], 0.085, 0.05, 8), { color: barkL });
    b.add(disc(0.05, 0, 0, 1, 1, 8).rotateX(-Math.PI / 2), { color: cut, x: 0.2, y: BR.height - 0.028, z: -0.22 });
    b.add(limbAB([-0.12, 0.2, 0.1], [-0.3, 0.4, 0.34], 0.07, 0.035, 7), { color: barkL });
    b.add(limbAB([0.2, 0.18, 0.08], [0.32, 0.3, 0.36], 0.06, 0.03, 7), { color: bark });
    for (const s of [-1, 1]) b.add(new THREE.TorusGeometry(0.135, 0.012, 4, 10).rotateY(Math.PI / 2), { color: '#5a3d26', x: s * 0.16 - 0.02, y: 0.163, z: 0.08 - s * 0.012 });
    const m = bakedMesh(b, 'galho:tronco', { rough: 0.92 });
    branch.add(m);
  }
  // as folhas: touceiras em volta da tora, todas DENTRO do colisor (a dog empurra o galho, nunca entra na folhagem)
  const crown = new THREE.Group();
  crown.name = 'galho:copa-de-folhinhas';
  {
    const b = createBaker();
    const barkL = vary('#7d5a3a', 0.1, 31);
    const hb = BR.half, Rc = rng(41);
    /** @type {{ x: number, y: number, z: number, r: number }[]} */
    const blobs = [];
    // [x, z] em frações da meia medida, o raio e quanto sobem: as dos cantos mais baixas, as do meio em cima da tora
    const SPOTS = [[-0.72, -0.62, 0.17, 0], [-0.05, -0.7, 0.16, 0.02], [0.62, -0.6, 0.15, 0], [-0.7, 0.6, 0.16, 0],
      [0.05, 0.7, 0.15, 0.03], [0.66, 0.62, 0.14, 0], [-0.34, 0.02, 0.16, 0.16], [0.3, -0.08, 0.14, 0.2]];
    for (const [fx, fz, r0, up] of SPOTS) {
      const r = r0 + Rc() * 0.025;
      const lim = hb - r * 1.14 - 0.012;
      const x = Math.max(-lim, Math.min(lim, fx * hb)), z = Math.max(-lim, Math.min(lim, fz * hb));
      const y = Math.min(0.6 - r * 1.14, r * 0.95 + 0.06 + up + Rc() * 0.04);
      blobs.push({ x, y, z, r });
      // o raminho que leva da tora até a touceira
      b.add(limbAB([x * 0.45, 0.2, 0.08], [x, y - r * 0.2, z], 0.028, 0.012, 6), { color: barkL });
    }
    crown.add(bakedMesh(b, 'galho:ramos', { rough: 0.92 }));
    const leavesGeo = foliageCluster(blobs.map((q) => ({ ...q, sy: 0.82 })), { detail: 1, amp: 0.26, seed: 9, dark: '#3d5a24', mid: '#6b8f35', light: '#a2c056' });
    const leaves = new THREE.Mesh(leavesGeo, SLOTS.foliage());
    leaves.name = 'galho:folhinhas';
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    crown.add(leaves);
    crown.add(leafSkin(leavesGeo, { count: 320, size: 0.09, seed: 5, material: SLOTS.plant(), minNormalY: -0.5 }));
  }
  branch.add(crown);
  keep(branch);
  const setBranch = (x, z) => branch.position.set(x, 0, z);
  setBranch(BR.start.x, BR.start.z);
  // as telhas quebradas embaixo do galho (aparecem quando ele sai): cacos de telha canal, rentes ao chão
  for (const [ox, oz, ry, sc] of [[-0.14, 0.05, 0.4, 1], [0.15, -0.1, 2.1, 0.8], [0.02, 0.2, 1.2, 0.9], [0.26, 0.16, 2.9, 0.6], [-0.3, -0.16, 0.9, 0.55], [0.06, -0.26, 1.7, 0.45]]) {
    const g = new THREE.CylinderGeometry(0.12, 0.12, 0.26 * sc, 10, 1, true, 0, Math.PI * 0.8);
    g.rotateZ(Math.PI / 2);
    g.scale(1, 0.3, 1);
    addY(g, { color: ['#c4643f', '#b8573a', '#cf7248'][Math.round(ry * 10) % 3], x: L.TILES.x + ox, y: 0.012, z: L.TILES.z + oz, ry, ao: false });
  }

  // ---------------------------------------------------------------- a casinha, os canteiros e o gramado
  const DH = L.DOGHOUSE;
  {
    const o = new THREE.Color(), wa = C('#d98a5a'), wb = C('#cf7e50');
    const wallC = (p) => o.copy(Math.floor(p.y / 0.125) % 2 ? wa : wb).multiplyScalar(0.92 + 0.08 * clamp01(p.y / 0.4));
    const th = 0.1, hgt = DH.h - 0.25;
    const plankWall = (w, d) => { const g = new THREE.BoxGeometry(w, hgt, d, 1, 6, 1); g.translate(0, hgt / 2, 0); return g; };
    addY(plankWall(DH.hx * 2, th), { color: wallC, x: DH.x, z: DH.z - DH.hz, ao: false });
    addY(plankWall(DH.hx * 2, th), { color: wallC, x: DH.x, z: DH.z + DH.hz, ao: false });
    addY(plankWall(th, DH.hz * 2), { color: wallC, x: DH.x + DH.hx, z: DH.z, ao: false });
    const side = (DH.hz * 2 - DH.door) / 2;
    addY(plankWall(th, side), { color: wallC, x: DH.x - DH.hx, z: DH.z - DH.hz + side / 2, ao: false });
    addY(plankWall(th, side), { color: wallC, x: DH.x - DH.hx, z: DH.z + DH.hz - side / 2, ao: false });
    addY(rb(th, hgt - 0.62, DH.door + 0.02, 0.02, 1), { color: '#cf7e50', x: DH.x - DH.hx, y: 0.62, z: DH.z, ao: false });
    // o arco da porta, o telhado de duas águas com a cumeeira e o piso almofadado
    for (const s of [-1, 1]) addY(slab(0.03, 0.66, 0.05), { color: TRIM, x: DH.x - DH.hx - 0.06, z: DH.z + s * (DH.door / 2 + 0.028), ao: false });
    addY(slab(0.03, 0.05, DH.door + 0.11), { color: TRIM, x: DH.x - DH.hx - 0.06, y: 0.62, z: DH.z, ao: false });
    const roofG = gableRoof(DH.hz * 2 + 0.28, DH.hx * 2 + 0.28, 0.36);
    roofG.rotateY(Math.PI / 2);
    addY(roofG, { color: '#c4643f', x: DH.x, y: hgt, z: DH.z, ao: false });
    addY(rod(0.035, DH.hz * 2 + 0.3, 6), { color: '#a94f33', x: DH.x, y: hgt + 0.36, z: DH.z, rx: Math.PI / 2, ao: false });
    addY(cyl(DH.hx * 0.72, DH.hx * 0.72, 0.035, 20), { color: '#e8475f', x: DH.x + 0.04, y: 0.006, z: DH.z, ao: false });
    // a plaquinha com a patinha em cima da porta
    addY(rb(0.03, 0.16, 0.26, 0.01, 1), { color: '#fff6e6', x: DH.x - DH.hx - 0.06, y: 0.68, z: DH.z, ao: false });
    art(addY, 'pata', 0.12, '#8a5a3c', DH.x - DH.hx - 0.0785, 0.76, DH.z, -1, 0);
  }
  // os canteiros (mureta de tijolo, terra, flores) e o regador em cima da mureta
  L.YARD_BEDS.forEach((bd, i) => {
    const o = new THREE.Color(), ba = C('#c98a6a'), bb = C('#b9785a');
    const g = new THREE.BoxGeometry(bd.hx * 2, 0.24, bd.hz * 2, Math.max(1, Math.round(bd.hx * 2 / 0.22)), 3, Math.max(1, Math.round(bd.hz * 2 / 0.22)));
    g.translate(0, 0.12, 0);
    addY(g, { color: (p) => o.copy((Math.floor(p.y / 0.08) + Math.floor((p.x + p.z) / 0.22)) % 2 ? ba : bb), x: bd.x, z: bd.z });
    addY(rb(bd.hx * 2 + 0.03, 0.03, bd.hz * 2 + 0.03, 0.01, 1), { color: '#d8c6a5', x: bd.x, y: 0.225, z: bd.z, ao: false });
    addY(slab(bd.hx * 2 - 0.12, 0.012, bd.hz * 2 - 0.12), { color: '#5a4030', slot: 'ground', x: bd.x, y: 0.25, z: bd.z, ao: false });
    const m = Math.max(2, Math.round((bd.hz * 2) / 0.6));
    for (let k = 0; k < m; k++) {
      const pz = bd.z - bd.hz + 0.28 + k * ((bd.hz * 2 - 0.56) / Math.max(1, m - 1));
      const plant = (k + i) % 3 === 1 ? lavender({ stems: 12, height: 0.34, seed: 50 + k }) : bushGeo(0.17, 0.2, 40 + i * 5 + k, ['#ff6a55', '#fff6ee', '#f2c230', '#e8708a', '#b9a3e3'][(k * 2 + i) % 5], 9);
      addY(plant, { color: null, slot: 'plant', x: bd.x + ((k % 2) - 0.5) * 0.16, y: 0.26, z: pz, ry: R() * 6 });
    }
  });
  {
    const b2 = L.YARD_BEDS[1], wx = b2.x - b2.hx + 0.12, wz = b2.z + b2.hz - 0.2;
    addY(cyl(0.085, 0.1, 0.17, 12), { color: '#3d8fd1', x: wx, y: 0.255, z: wz, ao: false });
    addY(rodAB([wx, 0.36, wz - 0.07], [wx, 0.44, wz - 0.26], 0.014, 6), { color: '#3d8fd1', ao: false });
    addY(cyl(0.035, 0.02, 0.03, 8), { color: '#3d8fd1', x: wx, y: 0.43, z: wz - 0.27, rx: -1.1, ao: false });
    addY(new THREE.TorusGeometry(0.06, 0.01, 5, 12, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI / 2), { color: '#3d8fd1', x: wx, y: 0.34, z: wz + 0.09, ao: false });
  }
  // o caminho de pedras: da porta da cozinha à porta da área de serviço e, para o sul, até a casinha
  {
    const kx = H.x1 + 0.75, kz = (KD.hinge.z + KD.latchPost.z) / 2;
    const stoneAt = (x, z, r, i) => addY(flatBlob(r, 100 + i, 10), { color: ['#cfc6b6', '#c4baa8', '#d8cfbf'][i % 3], slot: 'ground', x, y: 0.008, z, ry: i * 1.7 });
    const pA = [[kx, kz], [kx + 0.7, kz - 0.5], [kx + 1.4, kz - 1.05], [kx + 2.1, kz - 1.5], [SD.hinge.x + 0.5, Y.z0 + 1.4]];
    pA.forEach(([x, z], i) => stoneAt(x, z, 0.24 + (i % 2) * 0.04, i));
    const dx = DH.x - DH.hx - 0.6, dz = DH.z;
    for (let i = 1; i <= 8; i++) { const u = i / 9; stoneAt(lerp(kx, dx, u) + Math.sin(u * Math.PI) * 0.5, lerp(kz, dz, u), 0.22 + (i % 3) * 0.03, 10 + i); }
    // o capacho da porta da cozinha
    addY(rb(0.55, 0.014, 0.82, 0.006, 1), { color: '#c98a55', slot: 'ground', x: H.x1 + 0.4, y: 0.006, z: kz, ao: false });
    artFlat(addY, 'pata', 0.3, '#8a5a3c', H.x1 + 0.4, 0.0235, kz, Math.PI / 2, { slot: 'ground' });
  }
  // a torneira do quintal na parede da casa, a mangueira enrolada no suporte e a ponta dela pelo chão
  {
    const hx = H.x1 + ht, hz = KD.hinge.z - 1.0;
    add(rb(0.03, 0.14, 0.14, 0.01, 1), { color: '#d8d0c4', x: hx + 0.015, y: 0.6, z: hz - 0.5, ao: false });
    add(rodAB([hx + 0.03, 0.67, hz - 0.5], [hx + 0.13, 0.67, hz - 0.5], 0.014, 6), { color: '#c9a24a', ao: false });
    add(rodAB([hx + 0.13, 0.67, hz - 0.5], [hx + 0.13, 0.61, hz - 0.5], 0.012, 6), { color: '#c9a24a', ao: false });
    add(rodAB([hx + 0.09, 0.7, hz - 0.55], [hx + 0.09, 0.7, hz - 0.45], 0.008, 5), { color: '#e8475f', ao: false });
    add(rod(0.05, 0.09, 10), { color: '#4a4f57', x: hx + 0.045, y: 0.86, z: hz, rz: Math.PI / 2, ao: false });
    add(rod(0.075, 0.012, 12), { color: '#5a6068', x: hx + 0.096, y: 0.86, z: hz, rz: Math.PI / 2, ao: false });
    for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.2 - i * 0.046, 0.022, 6, 22).rotateY(Math.PI / 2), { color: i % 2 ? '#4f9a57' : '#5cab63', x: hx + 0.05 + (i % 2) * 0.014, y: 0.86, z: hz, ao: false });
    addY(tubeAlong([[hx + 0.034, 0.66, hz], [hx + 0.034, 0.3, hz + 0.01], [hx + 0.05, 0.04, hz + 0.05], [hx + 0.25, 0.022, hz + 0.3], [hx + 0.55, 0.022, hz + 0.2], [hx + 0.72, 0.022, hz + 0.5], [hx + 0.5, 0.022, hz + 0.74]], 0.017, 6, 40), { color: '#5cab63', ao: false });
    addY(cyl(0.02, 0.014, 0.07, 8), { color: '#c9a24a', x: hx + 0.5, y: 0.006, z: hz + 0.74, rx: Math.PI / 2, ry: -0.7, ao: false });
  }
  // poças, folhas e gravetos da tempestade (rentes ao chão)
  {
    const Rl = rng(9);
    for (const [px, pz, pr, ps] of [[Y.x0 + 2.3, Y.z0 + 3.1, 0.42, 0.7], [Y.x1 - 1.4, Y.z0 + 5.6, 0.34, 0.8], [Y.x0 + 3.4, Y.z1 - 3.2, 0.5, 0.6], [DH.x - 1.5, DH.z + 1.3, 0.3, 0.75]]) {
      addY(flatBlob(pr, Math.round(px * 10)), { color: '#8fb6c9', slot: 'glass', x: px, y: 0.006, z: pz, sz: ps, ry: Rl() * 3 });
    }
    const tones = ['#7c9a3a', '#a2b84a', '#c9a23a', '#8a6a2e', '#5f8a34'];
    for (let i = 0; i < 70; i++) {
      // mais folhas perto do galho e ao longo dos muros
      const near = i < 34;
      const x = near ? BR.start.x - 1.6 + (Rl() - 0.5) * 4.2 : lerp(Y.x0 + 0.4, Y.x1 - 0.4, Rl());
      const z = near ? Y.z0 + 0.4 + Rl() * 2.6 : lerp(Y.z0 + 0.5, Y.z1 - 0.8, Rl());
      addY(leafGeo(0.09 + Rl() * 0.06, 0.03 + Rl() * 0.015), { color: tones[i % tones.length], slot: 'plant', x, y: 0.008, z, ry: Rl() * TAU });
    }
    for (let i = 0; i < 9; i++) {
      const x = BR.start.x - 1.2 + (Rl() - 0.5) * 3.6, z = Y.z0 + 0.5 + Rl() * 2.4, a = Rl() * TAU, len = 0.14 + Rl() * 0.16;
      addY(rodAB([x, 0.016, z], [x + Math.cos(a) * len, 0.02, z + Math.sin(a) * len], 0.008, 4), { color: '#6b4a2e', ao: false });
    }
    // o cantinho de cavar: a terra revirada e o osso meio enterrado
    const cxd = Y.x1 - 1.0, czd = Y.z0 + 3.6;
    addY(flatBlob(0.5, 33), { color: '#7a5a3c', slot: 'ground', x: cxd, y: 0.007, z: czd });
    addY(flatBlob(0.26, 34), { color: '#5a4030', slot: 'ground', x: cxd + 0.05, y: 0.01, z: czd - 0.04 });
    addY(rb(0.2, 0.04, 0.05, 0.02, 1), { color: '#f4e3c8', x: cxd + 0.06, y: 0.012, z: czd - 0.03, ry: 0.7, rz: 0.12, ao: false });
    for (const s of [-1, 1]) addY(sphere(0.03, 8, 6), { color: '#f4e3c8', x: cxd + 0.06 + 0.1 * Math.cos(0.7) + s * 0.022 * Math.sin(0.7), y: 0.047, z: czd - 0.03 - 0.1 * Math.sin(0.7) + s * 0.022 * Math.cos(0.7), ao: false });
  }
  // capim e florzinhas do gramado (instâncias: as dogs passam roçando)
  {
    const Rg = rng(123);
    const blade = new THREE.BufferGeometry();
    {
      // um tufo: cinco lâminas em leque
      const pos = [], col = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.4, h = 0.1 + (i % 3) * 0.035, w = 0.014, lx = Math.cos(a) * 0.05, lz = Math.sin(a) * 0.05;
        const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
        pos.push(px, 0, pz, -px, 0, -pz, lx, h, lz);
        col.push(0.55, 0.62, 0.5, 0.55, 0.62, 0.5, 1, 1, 1);
      }
      blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      blade.computeVertexNormals();
    }
    // onde não nasce capim: na frente das portas, nos canteiros, na casinha e no caminho do galho
    const kz = (KD.hinge.z + KD.latchPost.z) / 2;
    const blocked = (x, z) => (
      (x < H.x1 + 1.3 && Math.abs(z - kz) < 0.9) || (z < Y.z0 + 1.35 && x > YG.x0 - 0.5) || (Math.abs(x - DH.x) < DH.hx + 0.25 && Math.abs(z - DH.z) < DH.hz + 0.25)
      || L.YARD_BEDS.some((bd) => Math.abs(x - bd.x) < bd.hx + 0.06 && Math.abs(z - bd.z) < bd.hz + 0.06)
    );
    const NG = 1300;
    const grass = new THREE.InstancedMesh(blade, SLOTS.plant(), NG);
    grass.name = 'recanto:capim-do-quintal';
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), cg = new THREE.Color();
    let n = 0;
    for (let i = 0; i < NG * 3 && n < NG; i++) {
      // metade junto dos muros e da casa, metade pelo gramado
      const edge = Rg() < 0.5;
      let x = lerp(Y.x0 + 0.16, Y.x1 - 0.16, Rg()), z = lerp(Y.z0 + 0.16, Y.z1 - 0.3, Rg());
      if (edge) { if (Rg() < 0.5) x = Rg() < 0.5 ? Y.x0 + 0.12 + Rg() * 0.3 : Y.x1 - 0.12 - Rg() * 0.3; else z = Rg() < 0.5 ? Y.z0 + 0.12 + Rg() * 0.3 : Y.z1 - 0.3 - Rg() * 0.3; }
      if (blocked(x, z)) continue;
      const s = 0.55 + Rg() * 0.75 + (edge ? 0.35 : 0);
      m4.compose(p.set(x, 0, z), q.setFromAxisAngle(_up, Rg() * TAU), sc.set(s, s * (0.8 + Rg() * 0.5), s));
      grass.setMatrixAt(n, m4);
      grass.setColorAt(n, cg.setRGB(0.4 + Rg() * 0.15, 0.62 + Rg() * 0.18, 0.22 + Rg() * 0.1));
      n++;
    }
    grass.count = n;
    grass.castShadow = false;
    grass.receiveShadow = true;
    keep(grass);
    // florzinhas: o cabinho e cinco pétalas
    const fl = new THREE.BufferGeometry();
    {
      const pos = [], col = [];
      const tri = (a, b, c, r, g, bl) => { pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); for (let k = 0; k < 3; k++) col.push(r, g, bl); };
      tri([-0.006, 0, 0], [0.006, 0, 0], [0, 0.11, 0], 0.35, 0.6, 0.25);
      for (let i = 0; i < 5; i++) {
        const a0 = (i / 5) * TAU, a1 = a0 + 0.8;
        tri([0, 0.112, 0], [Math.cos(a0) * 0.035, 0.118, Math.sin(a0) * 0.035], [Math.cos(a1) * 0.035, 0.118, Math.sin(a1) * 0.035], 1, 1, 1);
      }
      fl.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      fl.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      fl.computeVertexNormals();
    }
    const NF = 90;
    const flowers = new THREE.InstancedMesh(fl, SLOTS.plant(), NF);
    flowers.name = 'recanto:florzinhas-do-quintal';
    const tones = [C('#fff6ee'), C('#f2c230'), C('#f4b8c8'), C('#b9a3e3')];
    n = 0;
    for (let i = 0; i < NF * 4 && n < NF; i++) {
      const x = lerp(Y.x0 + 0.25, Y.x1 - 0.25, Rg()), z = lerp(Y.z0 + 0.3, Y.z1 - 0.5, Rg());
      if (blocked(x, z)) continue;
      const s = 0.8 + Rg() * 0.6;
      m4.compose(p.set(x, 0, z), q.setFromAxisAngle(_up, Rg() * TAU), sc.set(s, s, s));
      flowers.setMatrixAt(n, m4);
      flowers.setColorAt(n, tones[Math.floor(Rg() * tones.length)]);
      n++;
    }
    flowers.count = n;
    flowers.castShadow = false;
    keep(flowers);
  }

  // ---------------------------------------------------------------- vidros e manchas de sol (uma malha cada)
  const panes = new THREE.Mesh(glassB.build(), new THREE.MeshStandardMaterial({ color: '#bfe3f5', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
  panes.name = 'recanto:vidros';
  keep(panes);
  if (sunPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(sunPos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(sunPos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const sun = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#fff0c4', transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    sun.name = 'recanto:sol-das-janelas';
    sun.renderOrder = 1;
    keep(sun);
  }

  return {
    props: {
      kitchenDoor: { object: door, setOpen: setDoor },
      kitchenHandle: handle,
      serviceDoor: { object: sdoor, setOpen: setSdoor },
      branch: { object: branch, setPos: setBranch },
      windowLeaf: { object: leaf, setOpen: setWindow },
      bowl: { object: bowl, setTipped },
      petGate: { object: gate, setOpen: setGate },
      petPedal: { object: pedal, setPress: setPedal },
      foodSack: { object: sack, setPos: setSack },
      serviceBolt,
      house: {
        windowIn: { x: cx, y: (W.sill + W.top) / 2, z: H.z0 + 0.3 },
        windowOut: { x: cx, y: (W.sill + W.top) / 2, z: H.z0 - 0.3 },
        lever: () => lever.getWorldPosition(new THREE.Vector3()),
      },
    },
    seeThrough: [door, sdoor, branch, ceiling, roof, gate, sack],
    signs: [],
    update(dt, tt) {
      handle.update?.(dt, tt);
      if (boltSt.dirty || gripSrc) layoutBolt();
    },
    reset() {
      setDoor(0); setSdoor(0); setGate(0); setPedal(0); setWindow(1); setTipped(0);
      setBranch(BR.start.x, BR.start.z);
      setSack(FS.start.x, FS.start.z);
      handle.setOn(false); handle.setPress(0);
      gripSrc = null;
      serviceBolt.setPull(0);
      serviceBolt.setSlid(0);
      layoutBolt();
    },
    // as malhas ficam na árvore: o escopo de recursos da área libera tudo depois deste dispose
    dispose() { gripSrc = null; },
  };
}
