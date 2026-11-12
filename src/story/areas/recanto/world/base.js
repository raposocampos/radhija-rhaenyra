// RECANTO DAS PATINHAS — a base do cenário, vista em 3ª pessoa (da altura das dogs): o gramado com manchas, capim,
// florzinhas, trevo e orvalho; as calçadinhas de bloquete e as trilhas de pedra ligando os lugares; o muro do
// condomínio (rodapé de pedra, reboco manchado, chapim com telhas de capa, trepadeiras) com o portãozinho; a rua, o
// casario de Pandorópolis do outro lado, o portal da cidade e, longe, a torre da Prefeitura com o relógio parado a um
// minuto da uma; os vizinhos por cima do muro (copas e telhados); as árvores, os postes, os bancos, os canteiros, a
// placa do condomínio (só desenho), o cartaz da eleição (urna, sino e o relógio marcando uma hora) e o da Amora
// ("1313"); e o que a tempestade deixou pelo chão: poças, folhas, pétalas, gravetos, galhos e telhas quebradas.
// Coordenadas em ../layout.js. O que é miúdo e repetido (bloquetes, capim, folhas, muro) entra em LOTES: triângulos
// escritos direto no lugar, uma geometria por material e por zona (batch), em vez de milhares de peças no kit.
import * as THREE from 'three';
import { rng, foliageCluster, canvasTexture, fbm2, vnoise2, smoothstep, mat, paint, mergeGeometries, mergeVertices } from '../../../../world/util.js';
import { createKit, rb, cyl, slab, sphere, hipRoof, decalLot } from '../../../../levels/mapa/world/kit.js';
import { flowerBush } from '../../../../levels/mapa/world/pecas.js';

const TAU = Math.PI * 2;
const col = (hex) => new THREE.Color(hex);
const UP = [0, 1, 0], DOWN = [0, -1, 0], SOUTH = [0, 0, 1], NORTH = [0, 0, -1], EAST = [1, 0, 0], WEST = [-1, 0, 0];
/** A cor da neblina da manhã: o que fica longe já nasce desbotado para ela (camadas mais claras ao fundo). */
const HAZE = col('#efd5cb');
const far = (hex, k) => col(hex).lerp(HAZE, k);
/** Sorteio fixo por posição (0..1). */
const h01 = (a, b = 0) => { const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return n - Math.floor(n); };
const _c = new THREE.Color();
const _q = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
const _u = new THREE.Vector3(), _v = new THREE.Vector3(), _n = new THREE.Vector3();

// ---------------------------------------------------------------- lotes de triângulos
/**
 * Lote de triângulos soltos (posição, normal, cor por vértice) que vira UMA geometria. Pontos são [x, y, z]. `f` diz
 * para onde a face olha: a ordem dos vértices se acerta sozinha (sem `f`, fica como veio: peças de duas faces).
 */
function batch() {
  /** @type {number[]} */
  const pos = [];
  /** @type {number[]} */
  const nor = [];
  /** @type {number[]} */
  const rgb = [];
  function tri(a, b, c, ca, cb = ca, cc = ca, f = null, na = null, nb = null, nc = null) {
    _u.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    _v.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    _n.crossVectors(_u, _v);
    const len = _n.length();
    if (len < 1e-10) return;
    _n.divideScalar(len);
    if (f && _n.x * f[0] + _n.y * f[1] + _n.z * f[2] < 0) {
      let t = b; b = c; c = t;
      t = cb; cb = cc; cc = t;
      t = nb; nb = nc; nc = t;
      _n.negate();
    }
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    if (na) nor.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
    else nor.push(_n.x, _n.y, _n.z, _n.x, _n.y, _n.z, _n.x, _n.y, _n.z);
    rgb.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }
  /** Quadrilátero a-b-c-d (em volta); `c4`: uma cor ou as quatro; `n4`: as quatro normais (peças curvas). */
  function quad(a, b, c, d, c4, f = null, n4 = null) {
    const k = Array.isArray(c4) ? c4 : [c4, c4, c4, c4];
    tri(a, b, c, k[0], k[1], k[2], f, n4 && n4[0], n4 && n4[1], n4 && n4[2]);
    tri(a, c, d, k[0], k[2], k[3], f, n4 && n4[0], n4 && n4[2], n4 && n4[3]);
  }
  /** Retângulo deitado, virado para cima. */
  function rect(x0, z0, x1, z1, y, c4) {
    quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], c4, UP);
  }
  /** Caixa reta (sem a face de baixo, a não ser com `bottom`). */
  function box(x0, y0, z0, x1, y1, z1, c, bottom = false) {
    quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], c, UP);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], c, SOUTH);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], c, NORTH);
    quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], c, EAST);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], c, WEST);
    if (bottom) quad([x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0], c, DOWN);
  }
  /** Polígono em leque em volta de um centro (os pontos em volta, em ordem). */
  function fan(center, pts, c, f, cCenter = c) {
    for (let i = 0; i < pts.length; i++) tri(center, pts[i], pts[(i + 1) % pts.length], cCenter, c, c, f);
  }
  /** @returns {THREE.BufferGeometry | null} */
  function geometry() {
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
    return g;
  }
  return { tri, quad, rect, box, fan, geometry };
}

/**
 * Os lotes de um kit, por material e por grupo: `lot('ground', 'caminhos')`. `flush()` entrega cada um ao kit.
 * @param {ReturnType<typeof createKit>} kit
 */
function lotsFor(kit) {
  /** @type {Record<string, ReturnType<typeof batch>>} */
  const map = {};
  return {
    lot: (slot, group) => map[`${slot}|${group}`] || (map[`${slot}|${group}`] = batch()),
    flush() {
      for (const key of Object.keys(map)) {
        const [slot, group] = key.split('|');
        const g = map[key].geometry();
        if (g) kit.add(g, { color: null, slot: /** @type {any} */ (slot), group, ao: false });
      }
    },
  };
}

// ---------------------------------------------------------------- copas, troncos e plantas (feitos uma vez)
const CROWNS = {
  verde: { dark: '#3d5a24', mid: '#6b8f35', light: '#a2c056' },
  'ipe-rosa': { dark: '#a24479', mid: '#dc74ab', light: '#f8bcd9' },
  'ipe-amarelo': { dark: '#b2861c', mid: '#e8b62f', light: '#ffe58a' },
  'ipe-roxo': { dark: '#62428c', mid: '#9677c6', light: '#cdb9ef' },
};
const crowns = new Map();
/**
 * Copa larga, de ver por baixo, em três andares: quatro bolhas grandes no meio, uma saia de bolhas menores em volta
 * (em alturas diferentes: a copa não fica com a barra reta) e um coroamento de três no alto. Depois, a luz de maquete
 * (shadeCrown): as dobras entre as bolhas e o miolo escuros e azulados, o alto voltado para o céu claro e quente.
 */
function crown(kind, variant) {
  const key = `${kind}:${variant}`;
  if (crowns.has(key)) return crowns.get(key);
  const R = rng(23 + variant * 11 + kind.length);
  const big = [{ x: 0, y: 3.3, z: 0, r: 1.3 }], small = [], top = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + R() * 0.8;
    big.push({ x: Math.cos(a) * 0.95, y: 2.9 + R() * 0.42, z: Math.sin(a) * 0.95, r: 0.9 + R() * 0.2 });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.6 + R() * 0.6, d = 1.32 + R() * 0.3;
    small.push({ x: Math.cos(a) * d, y: 2.55 + R() * 0.5, z: Math.sin(a) * d, r: 0.5 + R() * 0.22 });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 1.1 + R() * 0.8;
    top.push({ x: Math.cos(a) * 0.55, y: 3.95 + R() * 0.3, z: Math.sin(a) * 0.55, r: 0.5 + R() * 0.16 });
  }
  const o = { amp: 0.2, freq: 2.0, seed: variant + 3, ...CROWNS[kind] };
  const g = mergeGeometries([foliageCluster(big, { detail: 2, ...o }), foliageCluster(small, { detail: 1, ...o, amp: 0.24 }), foliageCluster(top, { detail: 1, ...o, amp: 0.22 })]);
  shadeCrown(g, CROWNS[kind]);
  crowns.set(key, g);
  return g;
}
/**
 * A luz de maquete na copa (por cima das cores do foliageCluster): o que olha para dentro (as dobras entre as bolhas)
 * e o miolo de baixo escurecem e puxam para o azul do céu; o alto voltado para cima clareia e esquenta.
 * @param {THREE.BufferGeometry} g
 * @param {{ dark: string, mid: string, light: string }} pal
 */
function shadeCrown(g, pal) {
  const pos = g.attributes.position, nor = g.attributes.normal, colA = g.attributes.color;
  const deep = col(pal.dark).multiply(col('#b8c4e6')), sunny = col(pal.light).lerp(col('#fff2c4'), 0.35);
  const c = new THREE.Color(), d = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.set(pos.getX(i), pos.getY(i) - 3.15, pos.getZ(i));
    const rad = d.length();
    d.divideScalar(rad || 1);
    n.fromBufferAttribute(nor, i);
    c.fromBufferAttribute(colA, i);
    const inward = 1 - smoothstep(-0.35, 0.45, n.dot(d)); // dobra: a face olha para o miolo
    const core = 1 - smoothstep(0.9, 1.9, rad); // o miolo (perto do eixo e do meio da copa)
    const under = 1 - smoothstep(2.3, 3.1, pos.getY(i)); // a barra de baixo
    c.lerp(deep, Math.min(0.75, inward * 0.55 + core * 0.3 + under * 0.25));
    c.lerp(sunny, smoothstep(0.35, 0.95, n.y) * smoothstep(3.2, 4.3, pos.getY(i)) * 0.45);
    colA.setXYZ(i, c.r, c.g, c.b);
  }
}
/** Copa leve (três bolhas), para o que só aparece de longe: as árvores da rua e as dos vizinhos. */
function lightCrown(variant, colors) {
  const key = `leve:${variant}:${colors.mid.getHexString ? colors.mid.getHexString() : colors.mid}`;
  if (crowns.has(key)) return crowns.get(key);
  const R = rng(71 + variant * 5);
  const blobs = [{ x: 0, y: 3.0, z: 0, r: 1.25 }, { x: 0.8, y: 2.55 + R() * 0.3, z: 0.3, r: 0.9 }, { x: -0.7, y: 2.6 + R() * 0.3, z: -0.4, r: 0.95 }];
  const g = foliageCluster(blobs, { detail: 1, amp: 0.24, freq: 1.8, seed: variant + 9, ...colors });
  crowns.set(key, g);
  return g;
}
const BARK = col('#7a5234');
let _trunk = null, _bough = null;
/** Tronco com a base alargada (as raízes saem dela), dentro do colisor da árvore. */
function trunkGeo() {
  if (_trunk) return _trunk;
  const pts = [[0.34, 0], [0.275, 0.08], [0.215, 0.32], [0.18, 0.9], [0.16, 1.6], [0.145, 2.4]].map(([r, y]) => new THREE.Vector2(r, y));
  _trunk = new THREE.LatheGeometry(pts, 14);
  return _trunk;
}
/** Galho grosso que sobe do tronco para dentro da copa (inclinado para +x). */
function boughGeo() {
  if (_bough) return _bough;
  _bough = cyl(0.04, 0.078, 1.3, 5);
  _bough.rotateZ(-0.78);
  return _bough;
}
const MOSSY = col('#5f7438');
/**
 * A casca: sulcos verticais (cada coluna do torno com o seu tom), escura no pé e, no lado norte, o musgo subindo da
 * raiz (a umidade da garoa fica na sombra).
 * @param {THREE.Vector3} p @param {THREE.Vector3} [n]
 */
let _lowBough = null;
/** Galho baixo, mais deitado (sai a 1,55 m e entra na saia da copa a ~1 m do tronco). */
function lowBoughGeo() {
  if (_lowBough) return _lowBough;
  _lowBough = cyl(0.028, 0.06, 1.3, 5);
  _lowBough.rotateZ(-0.98);
  return _lowBough;
}
const barkTone = (p, n) => {
  const a = Math.atan2(p.z, p.x);
  _c.copy(BARK).multiplyScalar((0.72 + 0.42 * h01(Math.round(a * 14 / TAU * 2), 2) * (0.7 + 0.3 * h01(Math.round(p.y * 3), Math.round(a * 3)))) * (0.7 + 0.3 * smoothstep(0, 0.6, p.y)));
  if (n) _c.lerp(MOSSY, (1 - smoothstep(0.15, 0.85, p.y)) * smoothstep(0.1, 0.7, -n.z) * 0.6);
  return _c;
};

/** Lâmina de capim (três triângulos): base → meio → ponta, caindo para `ang`. */
function bladeInto(B, x, y, z, ang, h, w, lean, cb, ct) {
  const dx = Math.cos(ang), dz = Math.sin(ang);
  const px = -dz * w, pz = dx * w;
  const mx = x + dx * lean * 0.35, mz = z + dz * lean * 0.35, my = y + h * 0.55;
  const cm = _q[3].copy(cb).lerp(ct, 0.55);
  const c = [mx + px * 0.7, my, mz + pz * 0.7], d = [mx - px * 0.7, my, mz - pz * 0.7];
  B.quad([x - px, y, z - pz], [x + px, y, z + pz], c, d, [cb, cb, cm, cm]);
  B.tri(d, c, [x + dx * lean, y + h, z + dz * lean], cm, cm, ct);
}

let _bedPlants = null;
/** As plantas dos canteiros: leves (70 a 320 triângulos cada), em vez dos ~2 000 do gerânio e da lavanda das fases. */
function bedPlants() {
  if (_bedPlants) return _bedPlants;
  const out = [];
  const LEAF = { dark: '#2c4a22', mid: '#47752f', light: '#7da348' };
  ['#ff6a55', '#f2c230', '#e8708a', '#fff3e6'].forEach((flower, i) => out.push(flowerBush({ r: 0.17, seed: 3 + i, flower, n: 7 })));
  // hortênsia: a moita e três bolas de flor
  for (const [seed, flower] of [[11, '#7fa8e8'], [12, '#e79ac4']]) {
    const R = rng(Number(seed));
    const parts = [foliageCluster([{ x: 0, y: 0.12, z: 0, r: 0.17, sy: 0.8 }], { detail: 1, amp: 0.2, freq: 6, seed: Number(seed), ...LEAF })];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + R() * 1.2;
      const ico = new THREE.IcosahedronGeometry(0.072, 1);
      ico.deleteAttribute('normal');
      ico.deleteAttribute('uv');
      const f = mergeVertices(ico.translate(Math.cos(a) * 0.09, 0.22 + R() * 0.05, Math.sin(a) * 0.09), 1e-5);
      f.computeVertexNormals();
      const base = col(String(flower)).offsetHSL((R() - 0.5) * 0.04, 0, (R() - 0.5) * 0.08);
      parts.push(paint(f, (p) => _c.copy(base).multiplyScalar(0.82 + 0.3 * h01(p.x * 90, p.y * 70 + p.z * 50))));
    }
    out.push(mergeGeometries(parts));
  }
  // capim de enfeite (touceira com pendões) e espigas lilases
  {
    const B = batch(), R = rng(21), cb = col('#4d7d36'), ct = col('#b9cf74'), plume = col('#f0e2b8');
    for (let k = 0; k < 16; k++) {
      const a = R() * TAU, r0 = R() * 0.04;
      bladeInto(B, Math.cos(a) * r0, 0, Math.sin(a) * r0, a, 0.26 + R() * 0.2, 0.012, 0.1 + R() * 0.1, cb, ct);
    }
    for (let k = 0; k < 3; k++) {
      const a = R() * TAU, x = Math.cos(a) * 0.05, z = Math.sin(a) * 0.05, y = 0.42 + R() * 0.1;
      B.tri([0, 0, 0], [x - 0.004, y, z], [x + 0.004, y, z], cb, ct, ct);
      B.quad([x, y - 0.02, z], [x + 0.02, y + 0.06, z + 0.012], [x, y + 0.15, z], [x - 0.02, y + 0.06, z - 0.012], plume);
    }
    out.push(B.geometry());
  }
  {
    const B = batch(), R = rng(22), cb = col('#55703f'), ct = col('#86a05c');
    for (let k = 0; k < 9; k++) bladeInto(B, 0, 0, 0, R() * TAU, 0.1 + R() * 0.05, 0.014, 0.1, cb, ct);
    for (let k = 0; k < 10; k++) {
      const a = R() * TAU, r0 = 0.02 + R() * 0.09, x = Math.cos(a) * r0, z = Math.sin(a) * r0, h = 0.22 + R() * 0.14;
      const lilac = _q[0].setHSL(0.74 + (R() - 0.5) * 0.04, 0.5, 0.6 + R() * 0.1);
      B.tri([x * 0.4, 0.02, z * 0.4], [x - 0.004, h, z], [x + 0.004, h, z], cb, ct, ct);
      // a espiga: um losango comprido em cruz
      for (const [ox, oz] of [[0.013, 0], [0, 0.013]]) B.quad([x, h - 0.01, z], [x + ox, h + 0.045, z + oz], [x, h + 0.1, z], [x - ox, h + 0.045, z - oz], lilac);
    }
    out.push(B.geometry());
  }
  out.push(foliageCluster([{ x: 0, y: 0.15, z: 0, r: 0.165, sy: 0.92 }], { detail: 2, amp: 0.12, freq: 7, seed: 31, dark: '#284a22', mid: '#3f6f2c', light: '#6f9a42' }));
  _bedPlants = out;
  return out;
}

const VINES = {
  hera: { dark: '#24431f', mid: '#3c6a2b', light: '#6e9a45' },
  jasmim: { dark: '#2f5226', mid: '#4f7d34', light: '#8eb65a' },
  primavera: { dark: '#2c4c24', mid: '#48772f', light: '#7ea84a' },
};
const vines = new Map();
/** Trepadeira no muro (ao longo de x, a face do muro em z = 0, para dentro = +z): folhas de 0,56 m para cima e a franja por cima do chapim. */
function vineGeo(kind, variant, h) {
  const key = `${kind}:${variant}:${h}`;
  if (vines.has(key)) return vines.get(key);
  const R = rng(60 + variant * 7 + Math.round(h * 10));
  const blobs = [];
  for (let i = 0; i < 5 + variant; i++) {
    const r = 0.24 + R() * 0.15;
    blobs.push({ x: (R() - 0.5) * 1.7, y: Math.min(h + 0.1, Math.max(0.58 + r * 1.2, h * (0.45 + R() * 0.62))), z: 0.07, r, sz: 0.34, sy: 0.85 });
  }
  for (let i = 0; i < 2; i++) blobs.push({ x: (R() - 0.5) * 1.4, y: h + 0.15, z: -0.05, r: 0.27 + R() * 0.1, sz: 0.78, sy: 0.6 });
  const parts = [foliageCluster(blobs, { detail: 1, amp: 0.2, freq: 3.2, seed: variant + 5, ...VINES[kind] })];
  if (kind !== 'hera') {
    // as flores: cachos de primavera (magenta) ou jasmim (branco) por cima das folhas
    const flowers = [];
    for (let i = 0; i < 4; i++) {
      const b = blobs[Math.floor(R() * blobs.length)];
      flowers.push({ x: b.x + (R() - 0.5) * 0.3, y: Math.max(0.8, b.y + (R() - 0.3) * 0.2), z: b.z + 0.07, r: kind === 'primavera' ? 0.2 : 0.12, sz: 0.45, sy: 0.8 });
    }
    const fc = kind === 'primavera' ? { dark: '#a3246e', mid: '#d6408f', light: '#f48cc0' } : { dark: '#cfc9b0', mid: '#f1ecd9', light: '#ffffff' };
    parts.push(foliageCluster(flowers, { detail: 1, amp: 0.26, freq: 5, seed: variant + 2, ...fc }));
  }
  const g = mergeGeometries(parts);
  vines.set(key, g);
  return g;
}

// ---------------------------------------------------------------- miudezas (a vida nos cantos), feitas uma vez
/** Junta peças já pintadas numa geometria (sem uv). @param {[THREE.BufferGeometry, string | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)][]} list */
function painted(list) {
  const parts = list.map(([g, c]) => {
    g.deleteAttribute('uv');
    return paint(g, c);
  });
  const out = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  for (const g of parts) g.dispose();
  return out;
}
const birds = new Map();
/**
 * Passarinho pousado, de bico para +x e os pés em y = 0 (11 cm de altura): pardal (marrom, peito claro), bem-te-vi
 * (peito amarelo, cabeça preta com a listra branca) ou sabiá (peito cor de laranja).
 * @param {'pardal' | 'bentevi' | 'sabia'} kind
 */
function birdGeo(kind) {
  if (birds.has(kind)) return birds.get(kind);
  const P = {
    pardal: { back: '#8a6a4a', belly: '#d9c8a8', head: '#7c6650', cap: '#8f8a84' },
    bentevi: { back: '#7a6040', belly: '#f2c230', head: '#2a2420', cap: '#fbf7ee' },
    sabia: { back: '#7d6a55', belly: '#d9893f', head: '#7d6a55', cap: '#6f5d4a' },
  }[kind];
  const back = col(P.back), belly = col(P.belly);
  const body = new THREE.SphereGeometry(1, 9, 6).scale(0.055, 0.04, 0.038).rotateZ(0.28).translate(0, 0.052, 0);
  const head = new THREE.SphereGeometry(0.027, 8, 6).translate(0.044, 0.088, 0);
  const cap = new THREE.SphereGeometry(0.0275, 8, 4, 0, TAU, 0, 0.9).translate(0.044, 0.0885, 0);
  const beak = new THREE.ConeGeometry(0.008, 0.024, 5).rotateZ(-Math.PI / 2).translate(0.079, 0.086, 0);
  const tail = new THREE.BoxGeometry(0.055, 0.007, 0.03).rotateZ(0.42).translate(-0.066, 0.034, 0);
  const wing = new THREE.SphereGeometry(1, 7, 4).scale(0.042, 0.022, 0.012);
  const legs = [-0.012, 0.012].map((z) => new THREE.CylinderGeometry(0.003, 0.003, 0.022, 4).translate(0.004, 0.011, z));
  const eyes = [-1, 1].map((s) => new THREE.SphereGeometry(0.0045, 5, 4).translate(0.058, 0.094, s * 0.022));
  const g = painted([
    [body, (p) => _c.copy(back).lerp(belly, 1 - smoothstep(0.035, 0.06, p.y + p.x * 0.3))],
    [head, P.head], [cap, P.cap], [beak, '#3a2a1a'], [tail, P.back],
    [wing.clone().rotateZ(0.25).translate(-0.006, 0.058, 0.034), P.back], [wing.rotateZ(0.25).translate(-0.006, 0.058, -0.034), P.back],
    ...legs.map((l) => /** @type {[THREE.BufferGeometry, string]} */ ([l, '#c08a5a'])), ...eyes.map((e) => /** @type {[THREE.BufferGeometry, string]} */ ([e, '#141210'])),
  ]);
  birds.set(kind, g);
  return g;
}
let _can = null;
/** Regador de lata verde (base em y = 0, bico para +x): o corpo, a borda, o bico com o crivo e a alça. */
function wateringCan() {
  if (_can) return _can;
  const spout = cyl(0.01, 0.014, 0.19, 6).rotateZ(-0.85).translate(0.055, 0.04, 0);
  _can = painted([
    [cyl(0.072, 0.078, 0.15, 14), '#3f8f5a'], [cyl(0.074, 0.074, 0.012, 14).translate(0, 0.145, 0), '#357a4c'],
    [spout, '#3f8f5a'], [new THREE.ConeGeometry(0.03, 0.035, 8, 1, true).rotateZ(Math.PI / 2 + 0.85).translate(0.2, 0.165, 0), '#357a4c'],
    [new THREE.TorusGeometry(0.06, 0.009, 5, 10, Math.PI).translate(-0.01, 0.15, 0), '#2f6a42'],
  ]);
  return _can;
}
let _sack = null;
/** Saco de adubo de pé (base em y = 0): o corpo estufado, a boca dobrada e a etiqueta lisa (sem letra). */
function sackGeo() {
  if (_sack) return _sack;
  _sack = painted([
    [rb(0.3, 0.36, 0.13, 0.05, 2), (p) => _c.set('#5d6b3a').multiplyScalar(0.85 + 0.2 * smoothstep(0, 0.3, p.y))],
    [rb(0.28, 0.05, 0.06, 0.02, 1).translate(0, 0.355, 0), '#4f5c30'],
    [new THREE.BoxGeometry(0.16, 0.12, 0.004).translate(0, 0.19, 0.066), '#e8dcb8'],
    [new THREE.CircleGeometry(0.03, 10).translate(0, 0.2, 0.069), '#d0582f'],
  ]);
  return _sack;
}
let _marker = null;
/** Plaquinha de canteiro (sem letra): a estaca e a plaquinha com uma florzinha pintada. */
function markerGeo(color) {
  const key = `m:${color}`;
  if (birds.has(key)) return birds.get(key);
  const g = painted([
    [slab(0.016, 0.26, 0.01), '#8f5f38'],
    [rb(0.11, 0.075, 0.008, 0.008, 1).translate(0, 0.2, 0.008), color],
    [new THREE.CircleGeometry(0.014, 8).translate(0, 0.238, 0.0125), '#e8473a'],
    [new THREE.CircleGeometry(0.006, 6).translate(0, 0.238, 0.0128), '#f2c230'],
  ]);
  birds.set(key, g);
  return g;
}
/** Casinha de passarinho de madeira, presa no tronco (as costas em z = 0, a frente para +z, a base em y = 0). */
function birdhouseGeo() {
  if (_marker) return _marker;
  _marker = painted([
    [rb(0.15, 0.17, 0.14, 0.01, 1).translate(0, 0, 0.075), '#c98d5a'],
    [rb(0.12, 0.012, 0.19, 0.004, 1).rotateZ(0.6).translate(-0.045, 0.2, 0.075), '#b85a36'],
    [rb(0.12, 0.012, 0.19, 0.004, 1).rotateZ(-0.6).translate(0.045, 0.2, 0.075), '#c4643f'],
    [new THREE.CircleGeometry(0.03, 12).translate(0, 0.1, 0.1455), '#2a2018'],
    [cyl(0.005, 0.005, 0.05, 5).rotateX(Math.PI / 2).translate(0, 0.045, 0.165), '#6b4a2e'],
    [slab(0.03, 0.22, 0.02).translate(0, -0.03, 0.002), '#6b4a2e'],
  ]);
  return _marker;
}

// ---------------------------------------------------------------- texturas em canvas
/** Os fiapos do gramado (sem emenda): a cor vem dos vértices; a textura só dá o grão de grama de perto. */
const lawnDetail = () => mat('recanto-gramado-fiapos', () => canvasTexture(256, 256, (g, w, h) => {
  const R = rng(77);
  g.fillStyle = '#e9eedb';
  g.fillRect(0, 0, w, h);
  const wrap = (x, y, rad, fn) => {
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        if (x + ox < -rad || x + ox > w + rad || y + oy < -rad || y + oy > h + rad) continue;
        fn(x + ox, y + oy);
      }
    }
  };
  for (let i = 0; i < 240; i++) {
    const x = R() * w, y = R() * h, rad = 5 + R() * 15;
    g.fillStyle = R() < 0.55 ? 'rgba(120,150,84,0.13)' : 'rgba(255,255,230,0.14)';
    wrap(x, y, rad, (px, py) => { g.beginPath(); g.arc(px, py, rad, 0, TAU); g.fill(); });
  }
  g.lineCap = 'round';
  for (let i = 0; i < 2400; i++) {
    const x = R() * w, y = R() * h, a = -Math.PI / 2 + (R() - 0.5) * 2.2, len = 3 + R() * 6;
    g.strokeStyle = R() < 0.6 ? `rgba(84,120,58,${(0.22 + R() * 0.25).toFixed(2)})` : `rgba(250,255,214,${(0.25 + R() * 0.3).toFixed(2)})`;
    g.lineWidth = 0.8 + R() * 0.8;
    wrap(x, y, len, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke(); });
  }
}));

/** Relógio desenhado (sem números): mostrador branco, doze marcas e os ponteiros parados a um minuto da uma. */
function clockFace() {
  return canvasTexture(256, 256, (g, w) => {
    g.fillStyle = '#fbf6ea';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.47, 0, Math.PI * 2); g.fill();
    g.lineWidth = w * 0.035; g.strokeStyle = '#3a2719';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.47, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r0 = i % 3 === 0 ? 0.33 : 0.37;
      g.lineWidth = i % 3 === 0 ? w * 0.03 : w * 0.018;
      g.beginPath();
      g.moveTo(w / 2 + Math.sin(a) * w * r0, w / 2 - Math.cos(a) * w * r0);
      g.lineTo(w / 2 + Math.sin(a) * w * 0.43, w / 2 - Math.cos(a) * w * 0.43);
      g.stroke();
    }
    // a uma hora menos um minuto: o ponteiro das horas quase na uma, o dos minutos quase no doze
    const hand = (a, len, width) => {
      g.lineWidth = width; g.lineCap = 'round';
      g.beginPath(); g.moveTo(w / 2, w / 2); g.lineTo(w / 2 + Math.sin(a) * w * len, w / 2 - Math.cos(a) * w * len); g.stroke();
    };
    hand((Math.PI * 2 * (0 + 59 / 60)) / 12, 0.24, w * 0.045);
    hand((Math.PI * 2 * 59) / 60, 0.36, w * 0.03);
    g.fillStyle = '#3a2719';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.03, 0, Math.PI * 2); g.fill();
  }, { repeat: false });
}

/** O cartaz da eleição: urna com patinha, sino e o relógio marcando uma hora (pictogramas, sem letras). */
function electionPoster() {
  return canvasTexture(512, 360, (g, w, h) => {
    g.fillStyle = '#fff3d6'; g.fillRect(0, 0, w, h);
    g.lineWidth = 10; g.strokeStyle = '#3a2719'; g.strokeRect(8, 8, w - 16, h - 16);
    // faixa de cima: bandeirinhas
    for (let i = 0; i < 9; i++) {
      g.fillStyle = ['#e8475f', '#f2c230', '#3d8fd1'][i % 3];
      g.beginPath(); g.moveTo(24 + i * 54, 24); g.lineTo(76 + i * 54, 24); g.lineTo(50 + i * 54, 66); g.closePath(); g.fill();
    }
    // urna com a patinha
    g.fillStyle = '#4f8f6a'; g.fillRect(40, 140, 130, 150);
    g.fillStyle = '#2f5f45'; g.fillRect(60, 150, 90, 14);
    g.fillStyle = '#fff3d6';
    g.beginPath(); g.arc(105, 235, 22, 0, Math.PI * 2); g.fill();
    for (const [dx, dy] of [[-24, -26], [-8, -38], [10, -38], [26, -26]]) { g.beginPath(); g.arc(105 + dx, 235 + dy, 9, 0, Math.PI * 2); g.fill(); }
    // seta → sino → seta → relógio
    const arrow = (x) => { g.strokeStyle = '#3a2719'; g.lineWidth = 9; g.beginPath(); g.moveTo(x, 215); g.lineTo(x + 38, 215); g.moveTo(x + 24, 200); g.lineTo(x + 40, 215); g.lineTo(x + 24, 230); g.stroke(); };
    arrow(184);
    g.fillStyle = '#e8b93a';
    g.beginPath(); g.moveTo(242, 270); g.quadraticCurveTo(246, 150, 292, 150); g.quadraticCurveTo(338, 150, 342, 270); g.closePath(); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#3a2719'; g.stroke();
    g.fillStyle = '#3a2719'; g.beginPath(); g.arc(292, 280, 12, 0, Math.PI * 2); g.fill();
    arrow(354);
    // relógio marcando uma hora
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(440, 215, 52, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#3a2719'; g.stroke();
    g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(440, 215); g.lineTo(440, 172); g.stroke();
    g.beginPath(); g.moveTo(440, 215); g.lineTo(440 + Math.sin(Math.PI / 6) * 30, 215 - Math.cos(Math.PI / 6) * 30); g.stroke();
  }, { repeat: false });
}

/** O cartaz da Amora (a golden de faixa, candidata): o único lugar com o "1313". */
function amoraPoster() {
  return canvasTexture(360, 480, (g, w, h) => {
    g.fillStyle = '#2f6fb1'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c230'; g.fillRect(0, h - 120, w, 120);
    // a cabeça da golden, de frente
    g.fillStyle = '#da9c42';
    g.beginPath(); g.ellipse(w / 2, 175, 92, 100, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a86c24';
    g.beginPath(); g.ellipse(w / 2 - 92, 190, 34, 70, 0.25, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(w / 2 + 92, 190, 34, 70, -0.25, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f6d39a';
    g.beginPath(); g.ellipse(w / 2, 225, 52, 40, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2420';
    g.beginPath(); g.ellipse(w / 2, 205, 18, 13, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w / 2 - 38, 150, 10, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w / 2 + 38, 150, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8708a';
    g.beginPath(); g.ellipse(w / 2, 250, 14, 20, 0, 0, Math.PI); g.fill();
    // faixa de campanha
    g.strokeStyle = '#e8475f'; g.lineWidth = 26;
    g.beginPath(); g.moveTo(60, 290); g.lineTo(300, 330); g.stroke();
    g.fillStyle = '#2a2420';
    g.font = '800 92px "Fredoka", "Nunito", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('1313', w / 2, h - 60);
  }, { repeat: false });
}

/** A placa do condomínio, só com desenhos: um patinho e duas patinhas. */
function condoSign() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#7a4e2e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff3d6'; g.fillRect(14, 14, w - 28, h - 28);
    // patinho
    g.fillStyle = '#f2c230';
    g.beginPath(); g.ellipse(190, 160, 70, 46, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(240, 100, 36, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f08a3c';
    g.beginPath(); g.moveTo(272, 96); g.lineTo(306, 106); g.lineTo(272, 116); g.closePath(); g.fill();
    g.fillStyle = '#2a2420'; g.beginPath(); g.arc(250, 92, 6, 0, Math.PI * 2); g.fill();
    // duas patinhas
    const paw = (x, y, s) => {
      g.fillStyle = '#8a5a3c';
      g.beginPath(); g.ellipse(x, y, 18 * s, 15 * s, 0, 0, Math.PI * 2); g.fill();
      for (const [dx, dy] of [[-18, -18], [-6, -26], [6, -26], [18, -18]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, 6.5 * s, 0, Math.PI * 2); g.fill(); }
    };
    paw(360, 150, 1.1);
    paw(430, 110, 0.9);
  }, { repeat: false });
}

// ---------------------------------------------------------------- paletas
const PLASTER = col('#efe2c8'), DAMP = col('#b2ab84'), STREAK = col('#ab9c80'), PLINTH = col('#b9a98e'), JOINT = col('#77695a');
const PAINT2 = col('#f6ead3'), SPLASH = col('#a99579'), MOSS = col('#7d8c4c'), GRIME = col('#8a7a62'), LIMO = col('#8c9a6a');
const CAPC = col('#e3d8c4'), CAPD = col('#bfb39d');
const TILES = ['#c9683f', '#b95a36', '#d27747', '#c06040'].map(col);
const PAVERS = ['#d9ccb3', '#cfc0a4', '#e0d5bf', '#c9b99b', '#d3c2a6'].map(col);
const EDGE = ['#b98e6a', '#ad8260', '#c29873'].map(col);
const SAND = col('#8f8571'), WET = col('#8f9aa6');
const STONE = ['#bdb4a4', '#aaa293', '#c8bfae', '#b3a995'].map(col);
const LEAVES = ['#7a9a3a', '#b8a24a', '#9a6a3a', '#5f8a34', '#c98d3c', '#8a5a34'].map(col);
const SOIL = col('#5a3f28'), MUD = col('#8a6c4c'), MUDD = col('#6a5038');
const IRON = '#2b3a36', WOOD = '#b9814e', WOODD = '#8f5f38';
const HOUSES = ['#f2c14e', '#e8847a', '#7fb7d9', '#9ccf8a', '#f0a35c', '#c9a6e0', '#f6e3b4', '#e9737f', '#6fc1b5'];
const ROOFS = ['#c8643c', '#b85a36', '#d07446', '#a9523a'];
const FLAGS = ['#e8475f', '#f2c230', '#3d8fd1', '#4f8f6a'].map(col);
/** As alturas dos caminhos (rentes ao chão: 1 a 2 cm): a areia das juntas e o topo dos bloquetes. */
const Y0 = 0.010, Y1 = 0.0165;

/**
 * @param {ReturnType<typeof createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildBase(kit, root, L) {
  /** Até onde vai o chão de fora a leste: o terraço da torre (layout.ROOFTOP) tem o chão dele de ROOFTOP.cut em diante. */
  const XE = L.ROOFTOP?.cut ?? 95;
  const R = rng(5);
  const W = L.WALL, S = L.STREET, G = L.GATE, Pl = L.POOL, Dk = Pl.deck, Sv = L.SERVICE, Tw = L.TOWER, Bo = L.BOOTH, Cp = L.CARPORT, Yd = L.YARD, Hs = L.HOUSE, Pi = L.PIER;
  const mt = W.t / 2;
  const gx = (G.x0 + G.x1) / 2;
  const keep = (m) => { root.add(m); return m; };
  const { lot, flush } = lotsFor(kit);
  /** As quatro zonas do condomínio (norte/sul × oeste/leste): cada uma tem as suas malhas, para o recorte da câmera. */
  const zona = (x, z) => (z < 0 ? 'n' : 's') + (x < 0 ? 'o' : 'l');
  /** @type {any[]} */
  const COLS = L.STATIC_COLLIDERS;

  // ---------------------------------------------------------------- onde há o quê (para espalhar sem atravessar nada)
  const O = L.LAKE.outline;
  /** Distância até a margem do lago (negativa dentro d'água). */
  const lakeD = (x, z) => {
    let d = Infinity, inside = false;
    for (let i = 0, j = O.length - 1; i < O.length; j = i++) {
      const a = O[j], b = O[i];
      if ((a.z > z) !== (b.z > z) && x < a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z)) inside = !inside;
      const vx = b.x - a.x, vz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
      d = Math.min(d, Math.hypot(x - a.x - vx * t, z - a.z - vz * t));
    }
    return inside ? -d : d;
  };
  const inR = (r, x, z, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
  /** Os lugares construídos (cada um é de outra peça do cenário): nada da base é espalhado por cima deles. */
  // o quintal (e a faixa do lote ao sul da casa) é de world/quintal.js: a base só faz o gramado de baixo dele
  const LT = L.LOT;
  const BUILT = [Hs, Dk, Sv, Tw, { x0: Bo.x0, x1: Bo.x1, z0: Bo.z0, z1: Bo.awning.z1 }, Cp, Yd, { x0: LT.x0, x1: LT.x1, z0: Hs.z1, z1: LT.z1 }];
  const built = (x, z, pad = 0.08) => BUILT.some((r) => inR(r, x, z, pad));

  // ---------- o traçado: calçadinhas de bloquete (retângulos que só se encostam) e trilhas de pedra
  const zw0 = Dk.z1 + 0.5, zw1 = zw0 + 1.5; // o passeio entre a casa e a piscina
  const sdx = (L.SERVICE_DOOR.hinge.x + L.SERVICE_DOOR.latchPost.x) / 2;
  const carX = (L.CAR.x0 + L.CAR.x1) / 2;
  const plaza = { x0: Bo.x0 - 1.54, x1: G.x1 + 0.75, z0: Bo.awning.z1 + 0.05, z1: Bo.awning.z1 + 1.75 };
  const W1 = { x0: W.minX + 1.5, x1: Pi.x0 - 0.4, z0: zw0, z1: zw1, dir: 'x', endA: true };
  const W2 = { x0: Dk.x0 - 1.35, x1: Dk.x0 - 0.15, z0: Sv.z1, z1: zw0, dir: 'z' };
  const W3 = { x0: Dk.x1 + 0.45, x1: Tw.x0 - 0.36, z0: Sv.z1, z1: zw0, dir: 'z' };
  const W4 = { x0: W3.x1, x1: plaza.x0 + 1.3, z0: Tw.z1 + 0.95, z1: Tw.z1 + 2.25, dir: 'x' };
  /** @type {{ x0: number, x1: number, z0: number, z1: number, dir: string, border?: boolean, endA?: boolean, basket?: boolean }[]} */
  const PATHS = [
    W1, W2, W3, W4,
    { x0: W2.x1, x1: W3.x0, z0: Sv.z1 + 0.06, z1: Dk.z0 - 0.06, dir: 'x', border: false }, // entre o deque e a área de serviço
    { x0: W3.x1, x1: Tw.x0 - 0.09, z0: Math.max(Sv.z1, L.TOWER_DOOR.hinge.z - 0.1), z1: L.TOWER_DOOR.latchPost.z + 0.1, dir: 'z', border: false }, // a soleira da torre
    { x0: plaza.x0, x1: plaza.x0 + 1.3, z0: plaza.z1, z1: W4.z0, dir: 'z' }, // da torre à guarita
    { ...plaza, dir: 'x', basket: true }, // a frente da guarita
    { x0: G.x0 - 0.2, x1: G.x1 + 0.2, z0: W.minZ + 0.17, z1: plaza.z0, dir: 'z', basket: true }, // até o portãozinho
    { x0: Pi.x0 - 1.6, x1: Pi.x0 - 0.4, z0: zw1, z1: Pi.z1 + 0.13, dir: 'z' }, // até o píer
    { x0: Pi.x0 - 0.4, x1: Pi.x0 - 0.1, z0: Pi.z0, z1: Pi.z1, dir: 'z', border: false },
    { x0: carX + 1.6, x1: carX + 2.8, z0: zw1, z1: Cp.z0 - 0.02, dir: 'z' }, // a calçada ao lado da entrada da garagem
    { x0: sdx - 0.6, x1: sdx + 0.6, z0: zw1, z1: Yd.z0 - 0.1, dir: 'z' }, // da porta da área de serviço ao passeio
    ...[sdx, L.NAV_NODES.P_south.x, Dk.x1 - 1.3].map((x) => ({ x0: x - 0.6, x1: x + 0.6, z0: Dk.z1 + 0.04, z1: zw0, dir: 'z' })), // do passeio ao deque
  ];
  /** A entrada da garagem: pisograma (concreto vazado com grama). */
  const APRON = { x0: carX - 1.6, x1: carX + 1.6, z0: zw1, z1: Cp.z0 - 0.02 };
  /** A pracinha do jardim, com o mosaico da patinha. */
  const MOSAIC = { x: -18.6, z: -8.2, r: 1.45 };
  /** As trilhas de pedra (os pontos por onde passam). */
  const TRAILS = [
    [[W2.x0 - 0.3, -6.7], [-13.8, -6.9], [-15.4, -7.2], [MOSAIC.x + 1.75, MOSAIC.z + 0.45]],
    [[MOSAIC.x - 0.45, MOSAIC.z + 1.75], [-19.8, -5.2], [-20.3, -3.6], [-20.4, -2.0], [-20.2, zw0 - 0.3]],
    [[Pi.x0 - 1.0, Pi.z1 + 0.5], [Pi.x0 - 0.35, 4.7], [Pi.x0 - 0.2, 5.6], [9.3, 6.6], [9.6, 7.6], [10.2, 8.6], [11.0, 9.5], [12.0, 10.0], [13.2, 10.2], [14.6, 10.3], [16.0, 10.2], [17.4, 10.1], [18.6, 10.05], [19.8, 10.1], [21.0, 10.2], [22.0, 10.2]],
    [[W4.x1 + 0.35, W4.z0 + 0.7], [18.6, -6.3], [19.8, -6.2], [21.0, -6.15], [22.2, -6.1]],
  ];
  /** @type {{ x: number, z: number, r: number }[]} */
  const stones = [];
  TRAILS.forEach((pts, ti) => {
    let carry = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      for (let s = carry; s < len; s += 0.62) {
        const k = stones.length;
        const side = (k % 2 ? 1 : -1) * 0.07;
        stones.push({ x: ax + ((bx - ax) * s) / len - ((bz - az) / len) * side, z: az + ((bz - az) * s) / len + ((bx - ax) / len) * side, r: 0.23 + h01(k, ti) * 0.07 });
        carry = s + 0.62 - len;
      }
    }
  });
  /** Poças: na grama (com a lama em volta) e em cima do bloquete (só a água e o molhado). */
  const PUDDLES = [
    { x: -17.5, z: -1.0, r: 0.42 }, { x: -13.2, z: -12.6, r: 0.46 }, { x: -21.0, z: -6.6, r: 0.36 }, { x: -6.3, z: 1.5, r: 0.26 },
    { x: 7.2, z: -2.6, r: 0.4 }, { x: 19.8, z: -8.6, r: 0.38 }, { x: 14.9, z: -12.2, r: 0.34 }, { x: 4.9, z: 3.3, r: 0.36 },
    { x: 20.0, z: 12.2, r: 0.44 }, { x: -3.5, z: 4.0, r: 0.3 },
    { x: -15.5, z: zw0 + 0.7, r: 0.34, paved: true }, { x: 10.8, z: W4.z0 + 0.6, r: 0.3, paved: true }, { x: W3.x0 + 0.7, z: -4.6, r: 0.28, paved: true }, { x: 19.4, z: plaza.z0 + 0.8, r: 0.32, paved: true },
  ];
  const paved = (x, z, pad = 0) => PATHS.some((r) => inR(r, x, z, pad)) || inR(APRON, x, z, pad) || Math.hypot(x - MOSAIC.x, z - MOSAIC.z) < MOSAIC.r + pad;
  /** O que não é do capim: portas que giram, peças de empurrar no lugar de começo, pistas e petiscos. */
  const KEEP_OUT = [
    { x: L.BIN.start.x, z: L.BIN.start.z, r: 0.55 }, { x: L.BOAT.start.x, z: L.BOAT.start.z, r: 0.75 },
    { x: L.GATE_LEAF.hinge.x, z: L.GATE_LEAF.hinge.z, r: 1.35 }, { x: L.KITCHEN_DOOR.hinge.x, z: L.KITCHEN_DOOR.hinge.z, r: 1.2 },
    { x: L.SERVICE_DOOR.hinge.x, z: L.SERVICE_DOOR.hinge.z, r: 1.2 }, { x: L.SERVICE_BOLT.ring.x, z: L.SERVICE_BOLT.ring.z, r: 0.45 },
    { x: (L.YARD_GAP.x0 + L.YARD_GAP.x1) / 2, z: L.YARD_GAP.z, r: 0.7 }, { x: L.DOGHOUSE.x - L.DOGHOUSE.hx - 0.4, z: L.DOGHOUSE.z, r: 0.55 },
    { x: L.TILES.x, z: L.TILES.z, r: 0.6 }, { x: L.BOOTH_VENT.x - 0.5, z: L.BOOTH_VENT.z, r: 0.5 },
    ...L.COLLECTIBLES.map((c) => ({ x: c.x, z: c.z, r: 0.4 })),
  ];
  const BRANCH_LANE = { x0: L.BRANCH.minX - L.BRANCH.half - 0.1, x1: L.BRANCH.maxX + L.BRANCH.half, z0: L.BRANCH.minZ - L.BRANCH.half - 0.1, z1: L.BRANCH.maxZ + L.BRANCH.half + 0.1 };
  const hitsCollider = (x, z, pad) => COLS.some((c) => {
    if (c.shape === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + pad;
    if (c.shape === 'box') return Math.abs(x - c.x) < c.hx + pad && Math.abs(z - c.z) < c.hz + pad;
    const vx = c.bx - c.ax, vz = c.bz - c.az;
    const t = Math.max(0, Math.min(1, ((x - c.ax) * vx + (z - c.az) * vz) / (vx * vx + vz * vz || 1)));
    return Math.hypot(x - c.ax - vx * t, z - c.az - vz * t) < (c.t ?? 0.05) + pad;
  });
  /** O ponto serve para espalhar capim, folhas e afins? (grama livre, dentro do muro) */
  const free = (x, z, pad = 0.05) => x > W.minX + mt + 0.03 && x < W.maxX - mt - 0.03 && z > W.minZ + mt + 0.03 && z < W.maxZ - mt - 0.03
    && !built(x, z, pad + 0.05) && lakeD(x, z) > 0.5 + pad && !paved(x, z, pad) && !inR(BRANCH_LANE, x, z, pad)
    && !KEEP_OUT.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + pad) && !hitsCollider(x, z, pad);
  const onStone = (x, z, pad = 0) => stones.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + pad);
  const inPuddle = (x, z, pad = 0) => PUDDLES.some((p) => Math.hypot(x - p.x, z - p.z) < p.r * 1.25 + pad);

  // ---------------------------------------------------------------- o gramado
  // A cor (manchas largas, mais escuro e viçoso junto ao muro, embaixo das copas e na beira do lago) vai nos vértices
  // de uma grade de 0,7 m; a textura dá só os fiapos. Dois buracos: a água da piscina e o lago (a ilha é do lago).
  const LG = { a: col('#7fae48'), b: col('#9cc65a'), c: col('#5f9440'), dry: col('#b3b565'), lush: col('#4d8538'), shade: col('#4a7d3c') };
  const tint = (x, z, out) => {
    const n = fbm2(x * 0.15 + 3.1, z * 0.15 - 7.4, 3);
    out.copy(LG.a).lerp(LG.b, smoothstep(0.5, 0.72, n)).lerp(LG.c, 1 - smoothstep(0.3, 0.5, n));
    out.lerp(LG.dry, smoothstep(0.6, 0.8, fbm2(x * 0.22 + 40, z * 0.22 - 13, 2)) * 0.4);
    out.multiplyScalar(0.86 + fbm2(x * 0.5 - 11, z * 0.5 + 5, 2) * 0.28);
    // até o muro mais perto: o do condomínio e, no lote da casa (a oeste de LOT.x1), os muros do lote
    const inLot = x < LT.x1;
    const edge = Math.min(x - W.minX - mt, (inLot && z > W.maxZ ? LT.x1 - 0.08 : W.maxX - mt) - x, z - W.minZ - mt, (inLot ? LT.z1 - mt : W.maxZ - mt) - z);
    out.lerp(LG.lush, (1 - smoothstep(0.1, 2.2, edge)) * 0.55);
    for (const t of L.TREES) {
      const d = Math.hypot(x - t.x, z - t.z);
      if (d < 2.6) out.lerp(LG.shade, (1 - smoothstep(0.6, 2.6, d)) * 0.4);
    }
    const ld = lakeD(x, z);
    if (ld < 1.6) out.lerp(LG.lush, (1 - smoothstep(0.2, 1.6, ld)) * 0.5);
    return out;
  };
  {
    const lines = (a, b, snaps) => {
      const n = Math.round((b - a) / 0.7);
      const out = [];
      for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
      for (const s of snaps) {
        let k = 1;
        for (let i = 1; i < n; i++) if (Math.abs(out[i] - s) < Math.abs(out[k] - s)) k = i;
        out[k] = s;
      }
      return out;
    };
    // passa por baixo do muro (no vão do portãozinho não sobra fresta até a calçada)
    // e passa por baixo dos muros do lote da casa, que cresceu para o sul (LOT): as células ao sul do muro sul do
    // condomínio e a leste do lote ficam de fora
    const xs = lines(W.minX - mt - 0.01, W.maxX + mt + 0.01, [Pl.x0, Pl.x1, LT.x1 + 0.09]);
    const zs = lines(W.minZ - mt - 0.01, LT.z1 + mt + 0.01, [Pl.z0, Pl.z1, W.maxZ + mt + 0.01]);
    const nx = xs.length - 1, nz = zs.length - 1;
    // as células em volta do lago saem da grade: ali o chão é recortado no contorno dele
    const cut = new Uint8Array(nx * nz);
    const isCut = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && cut[j * nx + i] === 1;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const half = Math.hypot(xs[i + 1] - xs[i], zs[j + 1] - zs[j]) / 2;
        if (lakeD((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2) < half + 0.3) cut[j * nx + i] = 1;
      }
    }
    for (let again = true; again;) {
      again = false; // nada de duas células só encostadas pelo canto (o contorno passaria duas vezes no mesmo nó)
      for (let j = 0; j + 1 < nz; j++) {
        for (let i = 0; i + 1 < nx; i++) {
          const a = isCut(i, j), b = isCut(i + 1, j), c = isCut(i, j + 1), d = isCut(i + 1, j + 1);
          if ((a && d && !b && !c) || (b && c && !a && !d)) { cut[j * nx + i] = cut[j * nx + i + 1] = cut[(j + 1) * nx + i] = cut[(j + 1) * nx + i + 1] = 1; again = true; }
        }
      }
    }
    const node = (i, j) => j * (nx + 1) + i;
    const trace = () => {
      const next = new Map();
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          if (!isCut(i, j)) continue;
          if (!isCut(i, j - 1)) next.set(node(i, j), node(i + 1, j));
          if (!isCut(i + 1, j)) next.set(node(i + 1, j), node(i + 1, j + 1));
          if (!isCut(i, j + 1)) next.set(node(i + 1, j + 1), node(i, j + 1));
          if (!isCut(i - 1, j)) next.set(node(i, j + 1), node(i, j));
        }
      }
      const loop = [];
      const start = next.keys().next().value;
      for (let n = start, guard = 0; guard <= next.size; guard++) {
        loop.push(n);
        n = next.get(n);
        if (n === start || n === undefined) break;
      }
      return loop.length === next.size ? loop : null;
    };
    let loop = trace();
    if (!loop) {
      // contorno esquisito: recorta o retângulo inteiro em volta do lago
      let i0 = nx, i1 = 0, j0 = nz, j1 = 0;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (isCut(i, j)) { i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cut[j * nx + i] = 1;
      loop = trace() || [];
    }
    const pos = [], rgb = [], uv = [];
    const c = new THREE.Color();
    const vert = (x, z) => { tint(x, z, c); pos.push(x, 0, z); rgb.push(c.r, c.g, c.b); uv.push(x / 2.6, z / 2.6); };
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        if (isCut(i, j)) continue;
        const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
        if (cx > Pl.x0 && cx < Pl.x1 && cz > Pl.z0 && cz < Pl.z1) continue;
        if (cz > W.maxZ + mt && cx > LT.x1 + 0.09) continue;
        vert(xs[i], zs[j]); vert(xs[i], zs[j + 1]); vert(xs[i + 1], zs[j + 1]);
        vert(xs[i], zs[j]); vert(xs[i + 1], zs[j + 1]); vert(xs[i + 1], zs[j]);
      }
    }
    if (loop.length > 3) {
      const shape = new THREE.Shape(loop.map((n) => new THREE.Vector2(xs[n % (nx + 1)], -zs[Math.floor(n / (nx + 1))])));
      const hole = [];
      for (let i = 0; i < O.length; i++) {
        const a = O[i], b = O[(i + 1) % O.length];
        const m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.8));
        for (let k = 0; k < m; k++) hole.push(new THREE.Vector2(a.x + ((b.x - a.x) * k) / m, -(a.z + ((b.z - a.z) * k) / m)));
      }
      shape.holes.push(new THREE.Path(hole.reverse()));
      const sg = new THREE.ShapeGeometry(shape);
      const sp = sg.attributes.position, si = sg.index;
      for (let k = 0; k < si.count; k++) vert(sp.getX(si.getX(k)), -sp.getY(si.getX(k)));
      sg.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    const lawn = keep(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: lawnDetail(), vertexColors: true, roughness: 0.93 })));
    lawn.name = 'recanto:gramado';
    lawn.receiveShadow = true;
  }
  // fora do muro: o chão dos vizinhos (leste, oeste e sul) e o calçamento da cidade (norte), até a neblina
  {
    const B = batch();
    const green = col('#a4b784'), city = col('#d2c5ae');
    B.rect(-95, -95, W.minX - mt, 70, -0.02, green);
    // a leste, até onde começa o cenário do terraço da torre (layout.ROOFTOP.cut: lá o chão é o de world/telhado.js)
    B.rect(W.maxX + mt, -95, XE, 70, -0.02, green);
    // ao sul: em volta do lote da casa (a leste dele, até o muro sul do condomínio) e depois dele
    B.rect(LT.x1 + 0.09, W.maxZ + mt, W.maxX + mt, LT.z1 + mt, -0.02, green);
    B.rect(W.minX - mt, LT.z1 + mt, W.maxX + mt, 70, -0.02, green);
    B.rect(W.minX - mt, -95, W.maxX + mt, S.z1 - 2.2, -0.02, city);
    const m = keep(new THREE.Mesh(B.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
    m.name = 'recanto:chao-de-fora';
    m.receiveShadow = true;
  }

  // ---------------------------------------------------------------- calçadinhas, trilhas e a pracinha
  {
    const B = lot('ground', 'caminhos');
    /** A cor de um bloquete: o tom dele e as manchas ainda molhadas da chuva. */
    const tone = (pal, x, z, out) => {
      out.copy(pal[Math.floor(h01(Math.round(x * 31), Math.round(z * 17)) * pal.length) % pal.length]).multiplyScalar(0.93 + 0.14 * h01(x * 7.3, z * 5.1));
      return out.lerp(WET, smoothstep(0.52, 0.66, fbm2(x * 0.45 + 9, z * 0.45 - 3, 3)) * 0.42);
    };
    for (const r of PATHS) {
      const alongX = r.dir === 'x';
      const Ls = alongX ? r.x1 - r.x0 : r.z1 - r.z0, Wt = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
      if (Ls < 0.1 || Wt < 0.1) continue;
      /** Um bloquete de s0 a s1 (ao longo) e de t0 a t1 (de través). */
      const put = (s0, s1, t0, t1, pal) => {
        if (s1 - s0 < 0.04 || t1 - t0 < 0.04) return;
        const x0 = alongX ? r.x0 + s0 : r.x0 + t0, x1 = alongX ? r.x0 + s1 : r.x0 + t1;
        const z0 = alongX ? r.z0 + t0 : r.z0 + s0, z1 = alongX ? r.z0 + t1 : r.z0 + s1;
        // as beiradas encardidas (a terra que a chuva joga da grama) e um bloquete ou outro manchado de limo
        const c = tone(pal, (x0 + x1) / 2, (z0 + z1) / 2, _q[0]);
        c.lerp(GRIME, (1 - smoothstep(0, 0.32, Math.min(t0, Wt - t1))) * 0.3);
        if (h01(Math.round((x0 + x1) * 13), Math.round((z0 + z1) * 11)) > 0.94) c.lerp(LIMO, 0.35);
        B.rect(x0, z0, x1, z1, Y1, c);
      };
      B.rect(r.x0, r.z0, r.x1, r.z1, Y0, SAND);
      const g = 0.007;
      const bw = r.border === false ? 0 : 0.13;
      const sa = r.endA ? bw : 0;
      if (bw) {
        // a fiada de arremate, nas duas beiradas (e na ponta, onde o passeio acaba)
        const n = Math.max(1, Math.round(Ls / 0.26));
        for (let i = 0; i < n; i++) {
          put((Ls * i) / n + g, (Ls * (i + 1)) / n - g, g, bw - g, EDGE);
          put((Ls * i) / n + g, (Ls * (i + 1)) / n - g, Wt - bw + g, Wt - g, EDGE);
        }
        if (sa) {
          const m = Math.max(1, Math.round((Wt - 2 * bw) / 0.26));
          for (let i = 0; i < m; i++) put(g, bw - g, bw + ((Wt - 2 * bw) * i) / m + g, bw + ((Wt - 2 * bw) * (i + 1)) / m - g, EDGE);
        }
      }
      const rows = Math.max(1, Math.round((Wt - 2 * bw) / 0.2)), rh = (Wt - 2 * bw) / rows;
      if (r.basket) {
        // trama de cesto: pares de bloquetes, ora deitados, ora em pé
        const cs = rh * 2;
        for (let j = 0; j * 2 < rows; j++) {
          for (let i = 0; sa + i * cs < Ls - 0.02; i++) {
            const s0 = sa + i * cs, s1 = Math.min(Ls, s0 + cs), t0 = bw + j * cs, t1 = Math.min(Wt - bw, t0 + cs);
            if ((i + j) % 2) { put(s0 + g, s1 - g, t0 + g, (t0 + t1) / 2 - g, PAVERS); put(s0 + g, s1 - g, (t0 + t1) / 2 + g, t1 - g, PAVERS); } else { put(s0 + g, (s0 + s1) / 2 - g, t0 + g, t1 - g, PAVERS); put((s0 + s1) / 2 + g, s1 - g, t0 + g, t1 - g, PAVERS); }
          }
        }
      } else {
        for (let j = 0; j < rows; j++) {
          for (let s = sa - (j % 2) * 0.2; s < Ls; s += 0.4) put(Math.max(sa, s) + g, Math.min(Ls, s + 0.4) - g, bw + j * rh + g, bw + (j + 1) * rh - g, PAVERS);
        }
      }
    }
    // a entrada da garagem: concreto vazado, com a grama nos furos
    {
      const conc = col('#b9b3a6'), grass = col('#6f9d44');
      B.rect(APRON.x0, APRON.z0, APRON.x1, APRON.z1, Y1 - 0.003, conc);
      const nxc = Math.round((APRON.x1 - APRON.x0) / 0.4), nzc = Math.round((APRON.z1 - APRON.z0) / 0.4);
      const cw = (APRON.x1 - APRON.x0) / nxc, cd = (APRON.z1 - APRON.z0) / nzc;
      for (let i = 0; i < nxc; i++) {
        for (let j = 0; j < nzc; j++) {
          const x = APRON.x0 + (i + 0.5) * cw, z = APRON.z0 + (j + 0.5) * cd;
          B.rect(x - cw * 0.3, z - cd * 0.3, x + cw * 0.3, z + cd * 0.3, Y1 + 0.001, _q[0].copy(grass).multiplyScalar(0.8 + 0.4 * h01(i * 3.1, j * 7.7)));
        }
      }
    }
    // a pracinha redonda: anéis de bloquete e, no meio, a patinha de mosaico
    {
      const ringAt = (r0, r1, n, pal, phase) => {
        for (let i = 0; i < n; i++) {
          const a0 = ((i + 0.04) / n) * TAU + phase, a1 = ((i + 0.96) / n) * TAU + phase;
          const p = (r, a) => [MOSAIC.x + Math.cos(a) * r, Y1, MOSAIC.z + Math.sin(a) * r];
          B.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1), tone(pal, MOSAIC.x + Math.cos(a0) * r1, MOSAIC.z + Math.sin(a0) * r1, _q[0]), UP);
        }
      };
      const disc = (x, z, r, y, c, n = 14) => {
        const pts = [];
        for (let i = 0; i < n; i++) pts.push([x + Math.cos((i / n) * TAU) * r, y, z + Math.sin((i / n) * TAU) * r]);
        B.fan([x, y, z], pts, c, UP);
      };
      disc(MOSAIC.x, MOSAIC.z, MOSAIC.r, Y0, SAND, 28);
      disc(MOSAIC.x, MOSAIC.z, 0.5, Y1, col('#f1e6cf'), 20);
      ringAt(0.52, 0.76, 12, EDGE, 0.1);
      ringAt(0.78, 1.08, 18, PAVERS, 0.3);
      ringAt(1.1, 1.3, 26, PAVERS, 0.0);
      ringAt(1.32, MOSAIC.r, 30, EDGE, 0.2);
      const paw = col('#8a5a3c');
      disc(MOSAIC.x, MOSAIC.z + 0.09, 0.17, Y1 + 0.003, paw, 12);
      for (const [dx, dz] of [[-0.2, -0.07], [-0.07, -0.19], [0.07, -0.19], [0.2, -0.07]]) disc(MOSAIC.x + dx, MOSAIC.z + dz, 0.065, Y1 + 0.003, paw, 9);
    }
    // as pedras das trilhas: chatas, de beirada chanfrada, cada uma com o seu contorno
    stones.forEach((s, k) => {
      if (paved(s.x, s.z, s.r * 0.6) || built(s.x, s.z, s.r) || lakeD(s.x, s.z) < 0.45 + s.r) { s.r = 0; return; }
      const Rs = rng(300 + k), rot = Rs() * TAU, sq = 0.74 + Rs() * 0.22;
      const cTop = _q[1].copy(STONE[k % STONE.length]).multiplyScalar(0.92 + Rs() * 0.16);
      const cRim = _q[2].copy(cTop).multiplyScalar(0.72);
      const out = [], top = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU, rr = s.r * (0.84 + Rs() * 0.3);
        const lx = Math.cos(a) * rr, lz = Math.sin(a) * rr * sq;
        const wx = lx * Math.cos(rot) - lz * Math.sin(rot), wz = lx * Math.sin(rot) + lz * Math.cos(rot);
        out.push([s.x + wx, 0.004, s.z + wz]);
        top.push([s.x + wx * 0.84, 0.021, s.z + wz * 0.84]);
      }
      for (let i = 0; i < 8; i++) B.quad(out[i], out[(i + 1) % 8], top[(i + 1) % 8], top[i], cRim, UP);
      B.fan([s.x, 0.023, s.z], top, cTop, UP);
    });
    // a soleira de pedra do portãozinho (entre o caminho e a calçada da rua)
    B.box(G.x0 - 0.06, 0, W.minZ - mt, G.x1 + 0.06, 0.022, W.minZ + 0.17, col('#bcb3a2'));
  }

  // ---------------------------------------------------------------- muro
  // Rodapé de pedra em blocos, reboco manchado (umidade subindo do chão, escorridos embaixo do chapim), o chapim de
  // pedra com as telhas de capa por cima e os pilares chanfrados. O do norte é mais baixo: por cima dele, a cidade.
  // A cor do reboco num ponto (u: ao longo do trecho, y: altura, dp: distância até o pilar mais perto).
  const plaster = (u, y, h, seed, out, dp = 9) => {
    // a tinta creme: o grão do reboco e manchas largas de repintura (um creme mais novo, mais claro)
    out.copy(PLASTER).multiplyScalar(0.87 + fbm2(u * 0.8 + seed * 17.3, y * 1.3 + seed, 3) * 0.24);
    out.lerp(PAINT2, smoothstep(0.56, 0.64, fbm2(u * 0.22 + seed * 5.1, y * 0.45 - seed, 2)) * 0.55);
    // o barrado da chuva: os respingos de terra até uns 35 cm, mais escuros embaixo
    out.lerp(SPLASH, (1 - smoothstep(0.2, 0.44, y)) * (0.42 + 0.3 * vnoise2(u * 3.1 + seed, 1.7)));
    // a umidade subindo do chão em manchas (até quase 1 m) e o musgo no pé dos pilares
    out.lerp(DAMP, (1 - smoothstep(0.25, 0.95, y - 0.25 * fbm2(u * 0.9, seed, 2))) * smoothstep(0.35, 0.68, fbm2(u * 0.45 + seed * 3.1, 2.7, 2)) * 0.7);
    out.lerp(MOSS, (1 - smoothstep(0.05, 0.7, dp)) * (1 - smoothstep(0.2, 0.62, y)) * smoothstep(0.38, 0.62, fbm2(u * 1.3 + seed, 4.1, 2)) * 0.6);
    // os escorridos embaixo do chapim e a sombra da pingadeira logo abaixo dela
    out.lerp(STREAK, smoothstep(h - 0.8, h - 0.12, y) * smoothstep(0.42, 0.78, vnoise2(u * 3.4 + seed * 9.1, 0.5)) * 0.6);
    return out.multiplyScalar(1 - smoothstep(h - 0.17, h - 0.02, y) * 0.24);
  };
  const pillars = new Set();
  /** Pilar do muro (dentro do colisor do muro: 36 cm), com a capa de pedra em bico e, em alguns, a lanterninha acesa. */
  const pillarAt = (x, z, h, side, lamp, a = 0.18) => {
    const key = `${Math.round(x * 100)},${Math.round(z * 100)}`;
    if (pillars.has(key)) return;
    pillars.add(key);
    const B = lot('solid', `muro-${side}`);
    const ch = 0.045, top = h + 0.14;
    const ring = [[-a + ch, -a], [a - ch, -a], [a, -a + ch], [a, a - ch], [a - ch, a], [-a + ch, a], [-a, a - ch], [-a, -a + ch]];
    const cp = _q[2].copy(PLINTH).multiplyScalar(0.9);
    // o fuste em quatro faixas: os respingos embaixo, o reboco, e a sombra do capitel logo abaixo dele
    const ys = [0.2, 0.42, top - 0.2, top - 0.075];
    const tones = [_c.copy(PLASTER).lerp(SPLASH, 0.55).clone(), _c.copy(PLASTER).multiplyScalar(0.97).clone(), _c.copy(PLASTER).multiplyScalar(1.03).clone(), _c.copy(PLASTER).multiplyScalar(0.8).clone()];
    for (let i = 0; i < 8; i++) {
      const p = ring[i], q = ring[(i + 1) % 8], f = [p[0] + q[0], 0, p[1] + q[1]];
      B.quad([x + p[0], 0, z + p[1]], [x + q[0], 0, z + q[1]], [x + q[0], 0.2, z + q[1]], [x + p[0], 0.2, z + p[1]], cp, f);
      for (let k = 0; k + 1 < ys.length; k++) B.quad([x + p[0], ys[k], z + p[1]], [x + q[0], ys[k], z + q[1]], [x + q[0], ys[k + 1], z + q[1]], [x + p[0], ys[k + 1], z + p[1]], [tones[k], tones[k], tones[k + 1], tones[k + 1]], f);
    }
    // o capitel: uma moldura de pedra 2 cm para fora, logo abaixo da capa
    B.box(x - 0.2, top - 0.075, z - 0.2, x + 0.2, top, z + 0.2, CAPD, true);
    B.box(x - 0.225, top, z - 0.225, x + 0.225, top + 0.05, z + 0.225, CAPC, true);
    const b = 0.19, yb = top + 0.05;
    B.fan([x, yb + 0.14, z], [[x - b, yb, z - b], [x - b, yb, z + b], [x + b, yb, z + b], [x + b, yb, z - b]], CAPC, UP);
    if (lamp) {
      B.box(x - 0.05, yb + 0.1, z - 0.05, x + 0.05, yb + 0.17, z + 0.05, col(IRON));
      lot('lit', `muro-${side}`).box(x - 0.075, yb + 0.17, z - 0.075, x + 0.075, yb + 0.33, z + 0.075, col('#ffe7b0'));
      B.fan([x, yb + 0.44, z], [[x - 0.11, yb + 0.33, z - 0.11], [x - 0.11, yb + 0.33, z + 0.11], [x + 0.11, yb + 0.33, z + 0.11], [x + 0.11, yb + 0.33, z - 0.11]], col(IRON), UP);
    }
  };
  /**
   * Um trecho de muro de a até b (nx, nz: para dentro do condomínio). `outer`: o lado de fora também com reboco fino;
   * `half`: a meia espessura (o muro do lote a leste, que é o mesmo colisor do muro do quintal, é mais fino).
   */
  const wallRun = (ax, az, bx, bz, h, nx, nz, side, o = {}) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) return;
    const mt = o.half ?? W.t / 2;
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    const B = lot('solid', `muro-${side}`);
    const at = (s, off, y) => [ax + dx * s + nx * off, y, az + dz * s + nz * off];
    const IN = [nx, 0, nz], OUT = [-nx, 0, -nz];
    const n = Math.max(1, Math.round(len / 4));
    const seed = side.charCodeAt(0) * 0.37 + ax * 0.011;
    // as fiadas da cor: mais juntas embaixo (o barrado, a umidade) e logo abaixo do chapim (a sombra da pingadeira)
    const ys = [0.2, 0.3, 0.42, 0.6, 0.85, ...[0.35, 0.6].map((k) => 0.85 + (h - 1.05) * k), h - 0.2, h - 0.12, h];
    for (let k = 0; k < n; k++) {
      const s0 = (len * k) / n, s1 = (len * (k + 1)) / n, pl = s1 - s0;
      const cols = Math.max(1, Math.ceil(pl / 0.3));
      const dp = (u) => Math.min(u - s0, s1 - u);
      for (const dir of [1, -1]) {
        const fine = dir > 0 || o.outer;
        const off = dir * mt, F = dir > 0 ? IN : OUT, cn = fine ? cols : 1, rn = fine ? ys.length - 1 : 1;
        for (let c = 0; c < cn; c++) {
          const u0 = s0 + (pl * c) / cn, u1 = s0 + (pl * (c + 1)) / cn;
          for (let r = 0; r < rn; r++) {
            const y0 = fine ? ys[r] : 0.2, y1 = fine ? ys[r + 1] : h;
            B.quad(at(u0, off, y0), at(u1, off, y0), at(u1, off, y1), at(u0, off, y1),
              [plaster(u0, y0, h, seed + dir, _q[0], dp(u0)), plaster(u1, y0, h, seed + dir, _q[1], dp(u1)), plaster(u1, y1, h, seed + dir, _q[2], dp(u1)), plaster(u0, y1, h, seed + dir, _q[3], dp(u0))], F);
          }
        }
        // o rodapé: a junta escura por trás e os blocos de pedra na frente (do lado de dentro, um a um)
        const po = dir * (mt + 0.025), pj = dir * (mt + 0.019);
        B.quad(at(s0, pj, 0), at(s1, pj, 0), at(s1, pj, 0.19), at(s0, pj, 0.19), JOINT, F);
        const bn = fine ? Math.max(1, Math.round(pl / 0.5)) : 1, g = fine ? 0.006 : 0;
        for (let b = 0; b < bn; b++) {
          const u0 = s0 + (pl * b) / bn + g, u1 = s0 + (pl * (b + 1)) / bn - g;
          const c = _q[0].copy(PLINTH).multiplyScalar(0.86 + 0.22 * h01(Math.round(u0 * 7) + seed * 31, k));
          B.quad(at(u0, po, 0), at(u1, po, 0), at(u1, po, 0.17), at(u0, po, 0.17), c, F);
          B.quad(at(u0, po, 0.17), at(u1, po, 0.17), at(u1, off, 0.2), at(u0, off, 0.2), c, [F[0], 0.7, F[2]]);
        }
      }
      // o chapim (a capa de pedra, com a pingadeira) e as telhas de capa em cima dele, entre um pilar e outro
      const a0 = s0 + (k === 0 && o.noA ? 0 : 0.17), a1 = s1 - (k === n - 1 && o.noB ? 0 : 0.17), hw = mt + 0.055, yt = h + 0.05;
      B.quad(at(a0, hw, h), at(a1, hw, h), at(a1, hw, yt), at(a0, hw, yt), CAPC, IN);
      B.quad(at(a0, -hw, h), at(a1, -hw, h), at(a1, -hw, yt), at(a0, -hw, yt), CAPC, OUT);
      B.quad(at(a0, mt, h), at(a1, mt, h), at(a1, hw, h), at(a0, hw, h), CAPD, DOWN);
      B.quad(at(a0, -mt, h), at(a1, -mt, h), at(a1, -hw, h), at(a0, -hw, h), CAPD, DOWN);
      B.quad(at(a0, -hw, yt), at(a1, -hw, yt), at(a1, hw, yt), at(a0, hw, yt), CAPC, UP);
      const tn = Math.max(1, Math.round((a1 - a0) / 0.46));
      for (let t = 0; t < tn; t++) {
        const u0 = a0 + ((a1 - a0) * t) / tn, u1 = a0 + ((a1 - a0) * (t + 1)) / tn;
        const tc = _q[0].copy(TILES[Math.floor(h01(t * 3.7 + k, seed) * TILES.length) % TILES.length]).multiplyScalar(0.88 + 0.24 * h01(t, k + seed));
        const p = (u, r, th) => at(u, Math.cos(th) * r, yt + Math.sin(th) * r * 0.8);
        const nr = (th) => [nx * Math.cos(th), Math.sin(th), nz * Math.cos(th)];
        for (let j = 0; j < 4; j++) {
          const t0 = (j / 4) * Math.PI, t1 = ((j + 1) / 4) * Math.PI;
          B.quad(p(u0, 0.12, t0), p(u1, 0.1, t0), p(u1, 0.1, t1), p(u0, 0.12, t1), tc, nr((t0 + t1) / 2), [nr(t0), nr(t0), nr(t1), nr(t1)]);
        }
      }
    }
    for (let k = 0; k <= n; k++) {
      if ((k === 0 && o.noA) || (k === n && o.noB)) continue;
      const px = ax + dx * (len * k) / n, pz = az + dz * (len * k) / n;
      pillarAt(px, pz, Math.max(h, o.corner && (k === 0 || k === n) ? W.h : h), side, k % 3 === 1 && !built(px + nx * 0.4, pz + nz * 0.4, 0.3), mt < 0.1 ? mt + 0.05 : 0.18);
    }
  };
  // os trechos do norte acabam dentro dos pilares do portãozinho; o do oeste vai do canto até a casa (ela faz o resto)
  wallRun(W.minX, W.minZ, G.x0 - 0.2, W.minZ, W.hNorth, 0, 1, 'n', { outer: true, corner: true, noB: true });
  wallRun(G.x1 + 0.2, W.minZ, W.maxX, W.minZ, W.hNorth, 0, 1, 'n', { outer: true, corner: true, noA: true });
  wallRun(W.maxX, W.minZ, W.maxX, W.maxZ, W.h, -1, 0, 'l');
  // o muro sul do condomínio só a leste do lote da casa (4ª rodada: o lote cresceu 11 m para o sul) e os muros do
  // lote: a oeste, depois da casa; ao sul; e a leste (o mesmo colisor do muro do quintal, quintal-leste)
  wallRun(LT.x1, W.maxZ, W.maxX, W.maxZ, W.h, 0, -1, 's');
  wallRun(W.minX, Hs.z1, W.minX, LT.z1, W.h, 1, 0, 'lote', { noA: true });
  wallRun(LT.x0, LT.z1, LT.x1, LT.z1, W.h, 0, -1, 'lote');
  wallRun(LT.x1, W.maxZ, LT.x1, LT.z1, W.h, -1, 0, 'lote', { half: L.WALLS.t / 2, noA: true, noB: true });
  wallRun(W.minX, W.minZ, W.minX, Hs.z0, W.h, 1, 0, 'o', { noB: true });

  // as trepadeiras: os ramos finos colados no muro e as folhas do meio para cima (a franja passa por cima do chapim)
  const VINE_SPOTS = [
    { side: 'n', x: -20.4, z: W.minZ + mt, ry: 0, kind: 'hera', h: W.hNorth }, { side: 'n', x: -14.2, z: W.minZ + mt, ry: 0, kind: 'primavera', h: W.hNorth },
    { side: 'o', x: W.minX + mt, z: -9.6, ry: Math.PI / 2, kind: 'jasmim', h: W.h }, { side: 'o', x: W.minX + mt, z: -0.6, ry: Math.PI / 2, kind: 'primavera', h: W.h },
    { side: 'l', x: W.maxX - mt, z: -9.4, ry: -Math.PI / 2, kind: 'primavera', h: W.h }, { side: 'l', x: W.maxX - mt, z: 1.6, ry: -Math.PI / 2, kind: 'hera', h: W.h },
    { side: 'l', x: W.maxX - mt, z: 5.4, ry: -Math.PI / 2, kind: 'primavera', h: W.h }, { side: 'l', x: W.maxX - mt, z: 11.4, ry: -Math.PI / 2, kind: 'jasmim', h: W.h },
    { side: 's', x: 10.0, z: W.maxZ - mt, ry: Math.PI, kind: 'hera', h: W.h }, { side: 's', x: 14.4, z: W.maxZ - mt, ry: Math.PI, kind: 'primavera', h: W.h },
    { side: 's', x: 20.6, z: W.maxZ - mt, ry: Math.PI, kind: 'jasmim', h: W.h },
  ];
  VINE_SPOTS.forEach((v, i) => {
    const c = Math.cos(v.ry), s = Math.sin(v.ry);
    if (built(v.x + s * 0.4, v.z + c * 0.4, 0.4)) return;
    kit.add(vineGeo(v.kind, i % 3, v.h), { color: null, slot: 'plant', x: v.x, z: v.z, ry: v.ry, group: `muro-${v.side}`, ao: false });
    // os ramos: fitas finas, 3 cm à frente do muro (dentro do colisor)
    const B = lot('solid', `muro-${v.side}`), wood = col('#6a4a30');
    const P = (lx, y) => [v.x + lx * c + 0.031 * s, y, v.z - lx * s + 0.031 * c];
    for (let k = 0; k < 3; k++) {
      let lx = (k - 1) * 0.42 + (h01(i, k) - 0.5) * 0.2;
      for (let j = 0; j < 4; j++) {
        const y0 = (v.h * 0.85 * j) / 4, y1 = (v.h * 0.85 * (j + 1)) / 4, nx2 = lx + (h01(i * 7 + k, j) - 0.5) * 0.34;
        B.quad(P(lx - 0.014, y0), P(lx + 0.014, y0), P(nx2 + 0.011, y1), P(nx2 - 0.011, y1), wood, [s, 0, c]);
        lx = nx2;
      }
    }
  });

  // ---------------------------------------------------------------- o portãozinho
  // Os pilares ficam do lado de fora do vão (rentes ao colisor do muro); a folha gira na dobradiça do layout.
  for (const px of [G.x0 - 0.23, G.x1 + 0.23]) {
    kit.add(rb(0.34, 2.0, 0.32, 0.045, 1), { color: (p) => (p.y < 0.2 ? _c.copy(PLINTH).multiplyScalar(0.9) : _c.copy(PLASTER).multiplyScalar(0.98)), x: px, z: G.z, group: 'muro-n' });
    kit.add(rb(0.44, 0.07, 0.42, 0.02, 1), { color: '#e3d8c4', x: px, y: 2.0, z: G.z, group: 'muro-n', ao: false });
    kit.add(cyl(0.035, 0.05, 0.08, 8), { color: IRON, x: px, y: 2.07, z: G.z, group: 'muro-n', ao: false });
    kit.add(sphere(0.12, 12, 8), { color: '#ffe7b0', slot: 'lit', x: px, y: 2.25, z: G.z, group: 'muro-n' });
  }
  const GL = L.GATE_LEAF;
  const leafPivot = new THREE.Group();
  leafPivot.name = 'recanto:portaozinho';
  leafPivot.position.set(GL.hinge.x, 0, GL.hinge.z);
  {
    // a folha vai ao longo de −z local, com 4 cm de grossura (o colisor dela tem 5 de meia espessura)
    const B = batch(), c = col('#ffffff');
    const len = GL.length - 0.03, h = G.h;
    B.box(-0.02, 0.06, -0.05, 0.02, h - 0.06, -0.01, c, true);
    B.box(-0.02, 0.06, -len, 0.02, h - 0.06, -len + 0.04, c, true);
    for (const y of [0.08, 0.72, h - 0.14]) B.box(-0.0175, y, -len + 0.04, 0.0175, y + 0.04, -0.05, c, true);
    const nb = 8;
    for (let i = 1; i < nb; i++) {
      const z = -0.03 - ((len - 0.04) * i) / nb;
      B.box(-0.009, 0.12, z - 0.009, 0.009, h - 0.035, z + 0.009, c);
      B.fan([0, h + 0.03, z], [[-0.016, h - 0.035, z - 0.016], [-0.016, h - 0.035, z + 0.016], [0.016, h - 0.035, z + 0.016], [0.016, h - 0.035, z - 0.016]], c, UP);
    }
    // a patinha de ferro no meio (dos dois lados) e o trinco, na ponta
    for (const sx of [-1, 1]) {
      const disc = (y, z, r) => {
        const pts = [];
        for (let k = 0; k < 10; k++) pts.push([sx * 0.021, y + Math.sin((k / 10) * TAU) * r, z + Math.cos((k / 10) * TAU) * r]);
        B.fan([sx * 0.021, y, z], pts, c, [sx, 0, 0]);
      };
      disc(1.0, -len / 2, 0.085);
      for (const [dy, dz] of [[0.08, -0.11], [0.14, -0.04], [0.14, 0.04], [0.08, 0.11]]) disc(1.0 + dy, -len / 2 + dz, 0.034);
    }
    B.box(0.02, 0.99, -len - 0.02, 0.05, 1.04, -len + 0.1, c, true);
    for (const y of [0.3, 1.15]) B.box(-0.028, y, -0.035, 0.028, y + 0.09, 0.012, c, true);
    const leaf = new THREE.Mesh(B.geometry(), new THREE.MeshStandardMaterial({ color: '#2f5f45', roughness: 0.45, metalness: 0.35 }));
    leaf.name = 'grade';
    leaf.castShadow = true;
    leafPivot.add(leaf);
  }
  keep(leafPivot);
  const setGate = (t) => { leafPivot.rotation.y = GL.closedYaw + (GL.openYaw - GL.closedYaw) * t; };
  setGate(0);

  // ---------------------------------------------------------------- a rua
  // A calçada de cá, a guia (rebaixada na travessia em frente ao portãozinho), o asfalto molhado, a faixa e a calçada
  // de lá. As cenas do fechamento andam por aqui: nada no caminho das dogs.
  const cross0 = gx - 1.6, cross1 = gx + 3.6; // a guia rebaixada
  const av0 = gx + 1.05, av1 = gx + 4.45; // o asfalto da avenida do portal, do outro lado da rua
  {
    const B = lot('ground', 'rua');
    const side = (z0, z1, rows, skip0, skip1) => {
      const rw = (z1 - z0) / rows;
      for (let x = -30; x < 34; x += 0.74) {
        for (let j = 0; j < rows; j++) {
          if (x + 0.74 > skip0 && x < skip1) continue;
          B.rect(x + 0.005, z0 + j * rw + 0.005, x + 0.735, z0 + (j + 1) * rw - 0.005, 0.03, _q[0].set('#cfc6b6').multiplyScalar(0.9 + 0.16 * h01(x * 3.3, j + z0)));
        }
      }
      B.rect(-95, z0, XE, z1, 0.026, _q[0].set('#a8a092'));
    };
    side(S.sidewalk + 0.08, S.z0, 2, 1e9, 1e9);
    side(S.z1 - 2.2, S.z1 - 0.08, 3, av0, av1);
    // o asfalto (com as manchas molhadas) e a avenida que sobe para o portal
    const za = S.z1 + 0.08, zb = S.sidewalk - 0.08;
    const asph = (x, z, out) => out.set('#5d5f66').multiplyScalar(0.88 + 0.2 * h01(x * 1.7, z * 2.3)).lerp(_q[3].set('#3c4048'), smoothstep(0.5, 0.68, fbm2(x * 0.3 + 5, z * 0.5, 3)) * 0.6);
    for (let x = -30; x < 34; x += 1) for (let j = 0; j < 4; j++) B.rect(x, za + ((zb - za) * j) / 4, x + 1, za + ((zb - za) * (j + 1)) / 4, 0.02, asph(x, j * 1.1, _q[0]));
    B.rect(-95, za, -30, zb, 0.02, _q[0].set('#585a61'));
    B.rect(34, za, XE, zb, 0.02, _q[0].set('#585a61'));
    B.rect(av0, -70, av1, za, 0.02, _q[0].set('#5a5c63'));
    // as guias rebaixadas (a travessia e a boca da avenida), a faixa de pedestres, os traços e o bueiro
    B.rect(cross0, S.sidewalk - 0.08, cross1, S.sidewalk + 0.08, 0.034, _q[0].set('#b9b2a6'));
    B.rect(av0, S.z1 - 0.08, av1, S.z1 + 0.08, 0.024, _q[0].set('#5a5c63'));
    const white = col('#f2ead8');
    for (let x = gx - 0.9; x < gx + 1.7; x += 0.72) B.rect(x, za + 0.3, x + 0.4, zb - 0.3, 0.024, white);
    for (let x = -29; x < 33; x += 2.4) if (x + 1.2 < gx - 1.4 || x > gx + 2.2) B.rect(x, (za + zb) / 2 - 0.05, x + 1.2, (za + zb) / 2 + 0.05, 0.024, white);
    for (let z = S.z1 - 3; z > -60; z -= 2.6) B.rect((av0 + av1) / 2 - 0.05, z - 1.2, (av0 + av1) / 2 + 0.05, z, 0.024, white);
    const hole = [];
    for (let k = 0; k < 12; k++) hole.push([gx - 5.8 + Math.cos((k / 12) * TAU) * 0.32, 0.024, (za + zb) / 2 - 0.5 + Math.sin((k / 12) * TAU) * 0.32]);
    B.fan([gx - 5.8, 0.024, (za + zb) / 2 - 0.5], hole, col('#3a3c42'), UP);
    // a água parada na sarjeta, refletindo o céu
    const Bw = lot('glass', 'rua');
    for (const [x, r] of [[-22, 0.7], [-7.5, 0.9], [5.2, 0.6], [15.4, 0.8], [29, 0.7]]) {
      const pts = [];
      for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU, rr = r * (0.85 + 0.25 * h01(x, k)); pts.push([x + Math.cos(a) * rr, 0.029, zb - 0.3 + Math.sin(a) * rr * 0.28]); }
      Bw.fan([x, 0.029, zb - 0.3], pts, col('#93bfd9'), UP);
    }
    // as guias: inteiras fora da travessia e da boca da avenida
    const curb = (xa, xb, z) => kit.add(slab(xb - xa, S.curb, 0.16), { color: '#b9b2a6', x: (xa + xb) / 2, z, group: 'rua' });
    curb(-95, cross0, S.sidewalk); curb(cross1, XE, S.sidewalk);
    curb(-95, av0, S.z1); curb(av1, XE, S.z1);
    // o hidrante da calçada de cá (fora do caminho das cenas)
    const hx = gx - 2.65, hz = S.sidewalk + 0.5;
    kit.add(cyl(0.085, 0.105, 0.44, 10), { color: '#d8403a', x: hx, y: 0.03, z: hz, group: 'rua' });
    kit.add(sphere(0.088, 10, 6), { color: '#d8403a', x: hx, y: 0.47, z: hz, group: 'rua', ao: false });
    kit.add(cyl(0.03, 0.03, 0.05, 6), { color: '#f2c230', x: hx, y: 0.54, z: hz, group: 'rua', ao: false });
    kit.add(cyl(0.04, 0.04, 0.28, 8).rotateZ(Math.PI / 2).translate(0.14, 0, 0), { color: '#f2c230', x: hx, y: 0.3, z: hz, group: 'rua', ao: false });
    kit.add(cyl(0.11, 0.12, 0.035, 10), { color: '#b9342f', x: hx, y: 0.03, z: hz, group: 'rua', ao: false });
    // os postes da calçada de lá e as árvores de calçada, cada uma no seu canteirinho
    for (const x of [-26, -13.5, -1, 11.5, av0 - 1.6, av1 + 1.6]) {
      kit.add(cyl(0.05, 0.075, 3.4, 8), { color: '#3f4a52', x, y: 0.03, z: S.z1 - 0.5, group: 'rua' });
      kit.add(cyl(0.03, 0.03, 0.7, 6).rotateX(Math.PI / 2).translate(0, 0, 0.35), { color: '#3f4a52', x, y: 3.38, z: S.z1 - 0.5, group: 'rua', ao: false });
      kit.add(sphere(0.15, 10, 6), { color: '#ffe7b0', slot: 'lit', x, y: 3.3, z: S.z1 + 0.2, group: 'rua' });
    }
    [-20.5, -7.2, 5.4, 16.8, 30.4].forEach((x, i) => {
      const z = S.z1 - 1.25;
      B.rect(x - 0.42, z - 0.42, x + 0.42, z + 0.42, 0.034, SOIL);
      kit.add(cyl(0.07, 0.1, 2.3, 6), { color: '#6f4a2e', x, y: 0.03, z, group: 'rua' });
      kit.add(lightCrown(i % 3, i === 2 ? CROWNS['ipe-amarelo'] : CROWNS.verde), { color: null, slot: 'foliage', x, y: 0.1, z, ry: i * 1.9, sx: 0.78, sy: 0.82, sz: 0.78, group: 'rua' });
    });
  }

  // ---------------------------------------------------------------- a cidade ao fundo (Pandorópolis)
  // Três camadas, cada uma mais clara: o casario colorido do outro lado da rua (baixo na frente da Prefeitura, para o
  // relógio aparecer por cima), os sobrados de trás e as silhuetas do fundo. A avenida sobe do portãozinho até o portal.
  const city = new THREE.Group();
  city.name = 'recanto:cidade';
  const ck = createKit(city);
  const CL = lotsFor(ck);
  const portal = new THREE.Group();
  portal.name = 'portal-da-cidade';
  portal.position.set((av0 + av1) / 2, 0, S.z1 - 17);
  const tower = new THREE.Group();
  tower.name = 'torre-da-prefeitura';
  tower.position.set(L.TERRACE.view.x - 3.3, 0, L.TERRACE.view.z + 3);
  const CLOCK = { y: 10.7, z: 1.76, r: 1.3 };
  {
    const Rc = rng(91);
    const zf = S.z1 - 2.3, depth = 4.6, zb = zf - depth, zm = zf - depth / 2;
    const Bs = CL.lot('solid', 'perto'), Bg = CL.lot('glass', 'perto'), Bl = CL.lot('lit', 'perto'), Bp = CL.lot('plant', 'perto');
    const trim = col('#fff8ec'), woodC = col('#7a5234');
    /** Um disco em pé, virado para a rua. */
    const disc = (x, y, z, r, c, n = 10, sy = 1) => {
      const pts = [];
      for (let k = 0; k < n; k++) pts.push([x + Math.cos((k / n) * TAU) * r, y + Math.sin((k / n) * TAU) * r * sy, z]);
      Bs.fan([x, y, z], pts, c, SOUTH);
    };
    let last = -1, count = 0;
    const house = (x0, x1) => {
      const cx = (x0 + x1) / 2, w = x1 - x0;
      // em frente à torre da Prefeitura as casas são térreas; os sobrados ficam nas pontas e na esquina da avenida
      const two = (cx < tower.position.x - 21 || cx > tower.position.x + 11) && Rc() < 0.85;
      const h = two ? 5.5 + Rc() * 0.6 : 3.05 + Rc() * 0.4, rise = 0.95 + Rc() * 0.3;
      let ci = Math.floor(Rc() * HOUSES.length);
      if (ci === last) ci = (ci + 1) % HOUSES.length;
      last = ci;
      const c = col(HOUSES[ci]), c1 = c.clone().multiplyScalar(0.86), cd = c.clone().multiplyScalar(0.62), cs = c.clone().multiplyScalar(0.8);
      const door = col(HOUSES[(ci + 3) % HOUSES.length]).multiplyScalar(0.7);
      Bs.quad([x0, 0, zf], [x1, 0, zf], [x1, 0.5, zf], [x0, 0.5, zf], cd, SOUTH);
      Bs.quad([x0, 0.5, zf], [x1, 0.5, zf], [x1, h, zf], [x0, h, zf], [c1, c1, c, c], SOUTH);
      Bs.quad([x0, 0, zb], [x0, 0, zf], [x0, h, zf], [x0, h, zb], cs, WEST);
      Bs.quad([x1, 0, zf], [x1, 0, zb], [x1, h, zb], [x1, h, zf], cs, EAST);
      Bs.box(x0 - 0.04, h - 0.22, zf, x1 + 0.04, h - 0.07, zf + 0.07, trim, true);
      // o telhado de duas águas, com o beiral para a rua
      const ov = 0.3, ye = h - ov * (rise / (depth / 2)) + 0.02, t0 = col(ROOFS[count % ROOFS.length]), t1 = t0.clone().multiplyScalar(1.15);
      Bs.quad([x0 - 0.08, ye, zf + ov], [x1 + 0.08, ye, zf + ov], [x1 + 0.08, h + rise, zm], [x0 - 0.08, h + rise, zm], [t0, t0, t1, t1], UP);
      Bs.quad([x0 - 0.08, h + rise, zm], [x1 + 0.08, h + rise, zm], [x1 + 0.08, h, zb], [x0 - 0.08, h, zb], t0, UP);
      Bs.quad([x0 - 0.08, ye, zf + ov], [x1 + 0.08, ye, zf + ov], [x1 + 0.08, h, zf], [x0 - 0.08, h, zf], woodC, DOWN);
      Bs.tri([x0, h, zf], [x0, h, zb], [x0, h + rise, zm], cs, cs, cs, WEST);
      Bs.tri([x1, h, zf], [x1, h, zb], [x1, h + rise, zm], cs, cs, cs, EAST);
      const win = (xc, y0, ww, wh) => {
        Bs.box(xc - ww / 2 - 0.07, y0 - 0.07, zf, xc + ww / 2 + 0.07, y0 + wh + 0.07, zf + 0.05, trim);
        (Rc() < 0.25 ? Bl : Bg).quad([xc - ww / 2, y0, zf + 0.056], [xc + ww / 2, y0, zf + 0.056], [xc + ww / 2, y0 + wh, zf + 0.056], [xc - ww / 2, y0 + wh, zf + 0.056], Rc() < 0.5 ? col('#8ec1df') : col('#a9d2e6'), SOUTH);
        Bs.box(xc - 0.02, y0, zf + 0.05, xc + 0.02, y0 + wh, zf + 0.07, trim);
        Bs.box(xc - ww / 2 - 0.12, y0 - 0.13, zf, xc + ww / 2 + 0.12, y0 - 0.07, zf + 0.11, trim);
      };
      const shop = two && count % 2 === 0;
      const dx = x0 + w * (shop ? 0.5 : 0.28);
      Bs.box(dx - 0.57, 0, zf, dx + 0.57, 2.22, zf + 0.05, trim);
      Bs.box(dx - 0.47, 0.08, zf + 0.05, dx + 0.47, 2.12, zf + 0.075, door);
      Bs.box(dx - 0.7, 0, zf, dx + 0.7, 0.08, zf + 0.32, col('#bcb3a2'));
      if (shop) {
        // loja: as vitrines acesas, o toldo listrado e a tabuleta com um desenho (osso, peixe ou patinha)
        for (const sx of [-1, 1]) {
          const xc = dx + sx * (w * 0.5 - 0.5 - (w * 0.5 - 1.2) / 2), ww = w * 0.5 - 1.2;
          Bs.box(xc - ww / 2 - 0.06, 0.6, zf, xc + ww / 2 + 0.06, 2.18, zf + 0.05, trim);
          Bl.quad([xc - ww / 2, 0.66, zf + 0.056], [xc + ww / 2, 0.66, zf + 0.056], [xc + ww / 2, 2.12, zf + 0.056], [xc - ww / 2, 2.12, zf + 0.056], col('#ffe2a0'), SOUTH);
        }
        const ns = 7, aw = w - 0.5, ca = FLAGS[count % 3], cw2 = col('#fff6e6');
        for (let i = 0; i < ns; i++) {
          const xa = cx - aw / 2 + (aw * i) / ns, xb = xa + aw / ns;
          Bp.quad([xa, 2.85, zf + 0.02], [xb, 2.85, zf + 0.02], [xb, 2.42, zf + 1.0], [xa, 2.42, zf + 1.0], i % 2 ? cw2 : ca);
          Bp.quad([xa, 2.42, zf + 1.0], [xb, 2.42, zf + 1.0], [xb, 2.26, zf + 1.0], [xa, 2.26, zf + 1.0], i % 2 ? cw2 : ca);
        }
        const sy = 3.5, sz = zf + 0.09, ink = col('#5a3418');
        disc(cx, sy, sz, 0.46, woodC, 12);
        disc(cx, sy, sz + 0.012, 0.4, col('#fff3d6'), 12);
        const kind = (count / 2) % 3;
        if (kind === 0) {
          Bs.box(cx - 0.2, sy - 0.045, sz + 0.012, cx + 0.2, sy + 0.045, sz + 0.03, ink);
          for (const [ox, oy] of [[-0.21, 0.06], [-0.21, -0.06], [0.21, 0.06], [0.21, -0.06]]) disc(cx + ox, sy + oy, sz + 0.03, 0.075, ink, 8);
        } else if (kind === 1) {
          disc(cx - 0.05, sy, sz + 0.03, 0.2, col('#3d8fd1'), 10, 0.6);
          Bs.tri([cx + 0.1, sy, sz + 0.03], [cx + 0.28, sy + 0.13, sz + 0.03], [cx + 0.28, sy - 0.13, sz + 0.03], col('#3d8fd1'), undefined, undefined, SOUTH);
        } else {
          disc(cx, sy - 0.07, sz + 0.03, 0.14, ink, 9);
          for (const [ox, oy] of [[-0.17, 0.06], [-0.06, 0.17], [0.06, 0.17], [0.17, 0.06]]) disc(cx + ox, sy + oy, sz + 0.03, 0.055, ink, 7);
        }
      } else {
        win(x0 + w * 0.7, 1.0, 0.95, 1.15);
        if (w > 5) win(x0 + w * 0.5, 1.0, 0.8, 1.15);
      }
      if (two) {
        // o andar de cima: janelas e, em algumas, a sacadinha
        const nwin = w > 5 ? 3 : 2;
        for (let i = 0; i < nwin; i++) {
          const xc = x0 + (w * (i + 0.5)) / nwin;
          win(xc, 3.35, 0.85, 1.25);
          if ((count + i) % 2 === 0) {
            Bs.box(xc - 0.7, 3.1, zf, xc + 0.7, 3.18, zf + 0.42, trim, true);
            Bs.box(xc - 0.7, 3.62, zf + 0.38, xc + 0.7, 3.66, zf + 0.42, col(IRON), true);
            for (let b = 0; b < 6; b++) Bs.box(xc - 0.69 + b * 0.272, 3.18, zf + 0.39, xc - 0.67 + b * 0.272, 3.62, zf + 0.41, col(IRON));
          }
        }
      } else if (count % 3 === 1) {
        // a caixa d'água azul em cima do telhado
        Bs.box(cx - 0.4, h + rise * 0.5, zm - 1.3, cx + 0.4, h + rise * 0.5 + 0.75, zm - 0.5, col('#4f8fd0'), true);
      }
      count++;
    };
    const row = (xa, xb) => {
      for (let x = xa; x < xb - 2.6;) {
        let w = 4.2 + Rc() * 1.4;
        if (xb - (x + w) < 2.9) w = xb - x;
        house(x, x + w);
        x += w;
      }
    };
    row(-36, av0 - 1.0);
    row(av1 + 1.0, 38);
    // as bandeirinhas da eleição, de um lado ao outro da avenida
    for (const z of [zf - 1.2, zf - 6.2]) {
      for (let i = 0; i < 12; i++) {
        const k0 = i / 12, k1 = (i + 1) / 12, sag = (k) => 4.9 - 1.5 * k * (1 - k);
        const xa = av0 - 1.0 + (av1 - av0 + 2.0) * k0, xb = av0 - 1.0 + (av1 - av0 + 2.0) * k1;
        Bp.tri([xa + 0.04, sag(k0), z], [xb - 0.04, sag(k1), z], [(xa + xb) / 2, sag((k0 + k1) / 2) - 0.34, z], FLAGS[i % FLAGS.length]);
      }
    }

    // a segunda camada (sobrados de trás) e a terceira (silhuetas), cada vez mais claras
    const Bf = CL.lot('solid', 'longe');
    const block = (x0, x1, z0, z1, h, hex, k, roofHex) => {
      const c = far(hex, k), cs = c.clone().multiplyScalar(0.9), rc = far(roofHex, k), xm = (x0 + x1) / 2, zc = (z0 + z1) / 2, top = h + Math.min(1.6, (z1 - z0) * 0.3);
      Bf.quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], c, SOUTH);
      Bf.quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], cs, WEST);
      Bf.quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], cs, EAST);
      // telhado de quatro águas
      const rx = Math.min((x1 - x0) / 2 - 0.2, (z1 - z0) / 2);
      const A = [x0 + rx, top, zc], Bq = [x1 - rx, top, zc];
      Bf.quad([x0 - 0.2, h, z1 + 0.2], [x1 + 0.2, h, z1 + 0.2], Bq, A, rc, UP);
      Bf.quad([x1 + 0.2, h, z0 - 0.2], [x0 - 0.2, h, z0 - 0.2], A, Bq, rc, UP);
      Bf.tri([x0 - 0.2, h, z0 - 0.2], [x0 - 0.2, h, z1 + 0.2], A, rc, rc, rc, UP);
      Bf.tri([x1 + 0.2, h, z1 + 0.2], [x1 + 0.2, h, z0 - 0.2], Bq, rc, rc, rc, UP);
      // janelas (só as do alto aparecem por cima da frente)
      const wc = far('#5f7f9a', k), cols = Math.max(1, Math.floor((x1 - x0) / 1.5));
      for (let r = 0; r * 1.6 + 2.6 < h; r++) {
        for (let i = 0; i < cols; i++) {
          const wx = x0 + ((x1 - x0) * (i + 0.5)) / cols, wy = 1.5 + r * 1.6;
          Bf.quad([wx - 0.35, wy, z1 + 0.02], [wx + 0.35, wy, z1 + 0.02], [wx + 0.35, wy + 0.9, z1 + 0.02], [wx - 0.35, wy + 0.9, z1 + 0.02], wc, SOUTH);
        }
      }
      void xm;
    };
    const tx = tower.position.x;
    for (let x = -38, i = 0; x < 40; i++) {
      const w = 5 + Rc() * 3;
      const low = x + w > tx - 14 && x < tx + 8; // na frente da Prefeitura, baixos
      if (!(x + w > av0 - 2.5 && x < av1 + 2.5)) block(x, x + w - 0.4, zb - 9 - Rc() * 2, zb - 3.2, low ? 3.6 + Rc() * 1.2 : 6.2 + Rc() * 2.4, HOUSES[(i * 2 + 1) % HOUSES.length], 0.26, ROOFS[i % ROOFS.length]);
      x += w;
    }
    for (let x = -44, i = 0; x < 46; i++) {
      const w = 6 + Rc() * 4;
      if (!(x + w > tx - 9 && x < tx + 9) && !(x + w > av0 - 4 && x < av1 + 4)) block(x, x + w - 0.6, zb - 24 - Rc() * 3, zb - 17, 7 + Rc() * 4, HOUSES[(i * 3 + 2) % HOUSES.length], 0.5, ROOFS[(i + 1) % ROOFS.length]);
      x += w;
    }
    // as árvores da praça da Prefeitura e as do fundo
    const hazy = (k) => ({ dark: far('#3d5a24', k), mid: far('#6b8f35', k), light: far('#a2c056', k) });
    [[tx - 9.5, zb - 12, 0.3], [tx - 5.5, zb - 13.5, 0.34], [tx + 6.0, zb - 12.5, 0.32], [tx + 10.5, zb - 14, 0.36], [av0 - 4.5, zb - 9, 0.26], [av1 + 5, zb - 10, 0.28], [-30, zb - 15, 0.4], [-18, zb - 19, 0.46], [30, zb - 16, 0.42], [38, zb - 12, 0.4]].forEach(([x, z, k], i) => {
      ck.add(lightCrown(i % 3, hazy(k)), { color: null, slot: 'foliage', x, z, ry: i * 2.1, sx: 1.5, sy: 1.5, sz: 1.5, group: 'longe' });
    });

    // ---------- o portal da cidade, no fim da avenida (em coordenadas dele: props.city.portal.position é o lugar)
    const pk = createKit(portal);
    for (const sx of [-1, 1]) {
      pk.add(rb(1.25, 0.55, 1.25, 0.05, 1), { color: '#c96a30', x: sx * 2.9 });
      pk.add(rb(0.9, 4.6, 0.9, 0.07, 1), { color: '#e07b39', x: sx * 2.9, y: 0.55, ao: false });
      pk.add(rb(1.15, 0.28, 1.15, 0.05, 1), { color: '#f4e7cf', x: sx * 2.9, y: 5.15, ao: false });
      pk.add(sphere(0.34, 12, 8), { color: '#ffd36a', x: sx * 2.9, y: 5.75, ao: false });
    }
    pk.add(new THREE.TorusGeometry(2.9, 0.36, 6, 16, Math.PI), { color: '#f4e7cf', y: 5.2, ao: false });
    // a patinha dourada no alto do arco (um desenho, sem letras)
    {
      const B = batch(), gold = col('#ffd36a'), ink = col('#8a5a3c');
      const d = (x, y, z, r, c, n = 12) => {
        const pts = [];
        for (let k = 0; k < n; k++) pts.push([x + Math.cos((k / n) * TAU) * r, y + Math.sin((k / n) * TAU) * r, z]);
        B.fan([x, y, z], pts, c, SOUTH);
      };
      d(0, 8.1, 0.38, 0.72, gold, 16);
      d(0, 7.98, 0.4, 0.26, ink);
      for (const [ox, oy] of [[-0.3, 0.2], [-0.11, 0.4], [0.11, 0.4], [0.3, 0.2]]) d(ox, 8.1 + oy, 0.4, 0.1, ink, 8);
      pk.add(B.geometry(), { color: null, ao: false });
    }
    pk.finish();

    // ---------- a Prefeitura e a torre do relógio (em coordenadas dela), parado a um minuto da uma
    const tk = createKit(tower);
    {
      const B = batch();
      const cream = far('#f4e7cf', 0.1), creamD = far('#dccdb0', 0.1), roof = far('#b5523b', 0.1), dark = far('#3d4766', 0.1), stone = far('#cfc2aa', 0.1);
      // o prédio da Prefeitura, com as janelas em arco e a porta
      B.box(-6.5, 0, -4.2, 6.5, 6.4, 1.2, cream);
      B.box(-6.8, 6.4, -4.5, 6.8, 6.75, 1.5, stone);
      B.fan([0, 8.6, -1.5], [[-6.8, 6.75, -4.5], [-6.8, 6.75, 1.5], [6.8, 6.75, 1.5], [6.8, 6.75, -4.5]], roof, UP);
      for (let i = 0; i < 6; i++) {
        const x = -5.4 + i * 2.16 + (i > 2 ? 0 : 0);
        if (Math.abs(x) < 1.9) continue;
        B.quad([x - 0.5, 1.2, 1.22], [x + 0.5, 1.2, 1.22], [x + 0.5, 3.0, 1.22], [x - 0.5, 3.0, 1.22], dark, SOUTH);
        B.quad([x - 0.5, 4.0, 1.22], [x + 0.5, 4.0, 1.22], [x + 0.5, 5.5, 1.22], [x - 0.5, 5.5, 1.22], dark, SOUTH);
      }
      // a torre, um pouco à frente do prédio: fuste, sacadinha, cornija, o campanário aberto e o telhado em bico
      B.box(-1.7, 0, -1.7, 1.7, 12.9, 1.7, [cream, cream, cream, cream]);
      for (const sx of [-1.7, 1.52]) B.box(sx, 0, 1.7, sx + 0.18, 12.9, 1.78, creamD);
      B.box(-0.9, 0, 1.7, 0.9, 3.1, 1.74, far('#7a4e2e', 0.1));
      B.box(-2.0, 8.75, 1.7, 2.0, 8.9, 2.2, stone, true);
      B.box(-2.0, 9.3, 2.15, 2.0, 9.36, 2.2, stone, true);
      for (let i = 0; i < 9; i++) B.box(-1.96 + i * 0.485, 8.9, 2.16, -1.9 + i * 0.485, 9.3, 2.19, stone);
      B.box(-2.0, 12.9, -2.0, 2.0, 13.25, 2.0, stone, true);
      B.box(-1.45, 13.25, -1.45, 1.45, 15.1, 1.45, cream);
      for (const [f, ax, az] of [[SOUTH, 1, 0], [EAST, 0, 1], [WEST, 0, 1]]) {
        const o = f === SOUTH ? [0, 1.47] : f === EAST ? [1.47, 0] : [-1.47, 0];
        B.quad([o[0] - Number(ax) * 0.6, 13.5, o[1] - Number(az) * 0.6], [o[0] + Number(ax) * 0.6, 13.5, o[1] + Number(az) * 0.6], [o[0] + Number(ax) * 0.6, 14.8, o[1] + Number(az) * 0.6], [o[0] - Number(ax) * 0.6, 14.8, o[1] - Number(az) * 0.6], dark, f);
      }
      B.box(-1.75, 15.1, -1.75, 1.75, 15.3, 1.75, stone, true);
      B.fan([0, 18.6, 0], [[-1.75, 15.3, -1.75], [-1.75, 15.3, 1.75], [1.75, 15.3, 1.75], [1.75, 15.3, -1.75]], roof, UP);
      B.box(-0.03, 18.5, -0.03, 0.03, 19.9, 0.03, dark);
      // a moldura do mostrador (o mostrador é uma malha à parte, com a textura dos ponteiros)
      const ring = [];
      for (let k = 0; k < 20; k++) ring.push([Math.cos((k / 20) * TAU) * (CLOCK.r + 0.2), CLOCK.y + Math.sin((k / 20) * TAU) * (CLOCK.r + 0.2), CLOCK.z - 0.03]);
      B.fan([0, CLOCK.y, CLOCK.z - 0.03], ring, far('#7a4e2e', 0.05), SOUTH);
      tk.add(B.geometry(), { color: null, ao: false });
      const Bfl = batch();
      Bfl.tri([0.03, 19.85, 0], [0.03, 19.35, 0], [0.9, 19.6, 0], FLAGS[0]);
      tk.add(Bfl.geometry(), { color: null, slot: 'plant', ao: false });
      tk.add(sphere(0.42, 10, 8), { color: '#e8b93a', y: 14.2, ao: false });
    }
    tk.finish();
    const face = new THREE.Mesh(new THREE.CircleGeometry(CLOCK.r, 32), new THREE.MeshStandardMaterial({ map: clockFace(), roughness: 0.6 }));
    face.name = 'relogio';
    face.position.set(0, CLOCK.y, CLOCK.z);
    tower.add(face);
    CL.flush();
    ck.finish();
    city.add(portal, tower);
  }
  keep(city);

  // ---------------------------------------------------------------- os vizinhos, por cima do muro (leste, oeste e sul)
  // Copas de árvore logo atrás do muro, telhados de casas um pouco mais longe e a linha de árvores do fundo.
  const around = new THREE.Group();
  around.name = 'recanto:vizinhos';
  {
    const nk = createKit(around);
    const NL = lotsFor(nk);
    const B = NL.lot('solid', 'vizinhos'), Bg = NL.lot('glass', 'vizinhos');
    const Rn = rng(133);
    /** Casa de vizinho: paredes, telhado de quatro águas e uma janela virada para o condomínio (f: para onde ela olha). */
    const neighbour = (x, z, w, d, h, ci, f) => {
      const c = far(HOUSES[ci % HOUSES.length], 0.1);
      B.box(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, c);
      nk.add(hipRoof(w + 0.7, d + 0.7, 1.3), { color: () => far(ROOFS[ci % ROOFS.length], 0.1), x, y: h, z, group: 'vizinhos', ao: false });
      const px = x + f[0] * (w / 2 + 0.02), pz = z + f[2] * (d / 2 + 0.02), ux = Math.abs(f[2]), uz = Math.abs(f[0]);
      for (const s of [-1, 1]) {
        const wx = px + ux * s * w * 0.24, wz = pz + uz * s * d * 0.24;
        Bg.quad([wx - ux * 0.4, h - 1.5, wz - uz * 0.4], [wx + ux * 0.4, h - 1.5, wz + uz * 0.4], [wx + ux * 0.4, h - 0.5, wz + uz * 0.4], [wx - ux * 0.4, h - 0.5, wz - uz * 0.4], col('#8ec1df'), f);
      }
      if (ci % 2) B.box(x - 0.4, h + 0.55, z - 0.4, x + 0.4, h + 1.3, z + 0.4, far('#4f8fd0', 0.1), true);
    };
    const kinds = [CROWNS.verde, CROWNS.verde, CROWNS['ipe-rosa'], CROWNS.verde, CROWNS['ipe-amarelo'], CROWNS.verde, CROWNS['ipe-roxo']];
    const tree = (x, z, i) => nk.add(lightCrown(i % 3, kinds[i % kinds.length]), { color: null, slot: 'foliage', x, y: -0.3 + Rn() * 0.5, z, ry: Rn() * TAU, sx: 1.25 + Rn() * 0.4, sy: 1.2 + Rn() * 0.45, sz: 1.25 + Rn() * 0.4, group: 'vizinhos' });
    const hazy = { dark: far('#3d5a24', 0.38), mid: far('#6b8f35', 0.38), light: far('#a2c056', 0.38) };
    const back = (x, z, i) => nk.add(lightCrown(i % 3, hazy), { color: null, slot: 'foliage', x, y: 0.4, z, ry: i * 1.3, sx: 2.3, sy: 2.0 + (i % 3) * 0.25, sz: 2.3, group: 'vizinhos' });
    let n = 0;
    for (let z = W.minZ + 1.5; z < W.maxZ; z += 4.3) tree(W.maxX + 1.7 + Rn() * 1.2, z + (Rn() - 0.5) * 1.5, n++);
    // ao sul: a leste do lote da casa, logo atrás do muro do condomínio; no lote, depois do muro dele (4ª rodada)
    for (let x = W.minX + 2; x < W.maxX; x += 6.2) { const tx = x + (Rn() - 0.5) * 2, dz = 1.7 + Rn() * 1.2; tree(tx, (tx < LT.x1 + 1.8 ? LT.z1 : W.maxZ) + dz, n++); }
    for (let z = W.minZ + 1.8; z < LT.z1; z += 4.6) tree(W.minX - 1.7 - Rn() * 1.2, z + (Rn() - 0.5) * 1.5, n++);
    // a leste do lote, os quintais dos vizinhos (as copas aparecem por cima do muro do lote)
    for (const [tx, tz] of [[LT.x1 + 1.1, 16.4], [LT.x1 + 1.3, 24.8], [LT.x1 + 8.6, 25.6]]) tree(tx, tz, n++);
    [[W.maxX + 6.2, -10.5, 6, 7], [W.maxX + 6.8, 1.2, 5.5, 8], [W.maxX + 6.0, 10.8, 6.5, 6.5]].forEach(([x, z, w, d], i) => neighbour(x, z, w, d, 3.3 + (i % 2) * 2.3, i + 1, WEST));
    // ao sul: as casas que ficavam onde agora é o lote da casa foram para depois do muro dele; a leste do lote, a casa do
    // vizinho de muro (o telhado aparece por cima dele)
    [[-18, LT.z1 + 5.4, 8, 6], [-6.0, LT.z1 + 6.0, 7, 5.5], [7, W.maxZ + 6.0, 8.5, 6], [19, W.maxZ + 6.4, 7, 6], [LT.x1 + 5.2, 20.6, 4.6, 6.0]].forEach(([x, z, w, d], i) => neighbour(x, z, w, d, 3.2 + ((i + 1) % 2) * 2.4, i + 4, i === 4 ? WEST : NORTH));
    [[W.minX - 6.2, -9.5, 6, 7.5], [W.minX - 6.6, 2.0, 5.5, 7], [W.minX - 6.0, 11.5, 6.5, 6.5], [W.minX - 6.4, 21.6, 6, 7]].forEach(([x, z, w, d], i) => neighbour(x, z, w, d, 3.4 + (i % 2) * 2.2, i + 8, EAST));
    for (let z = W.minZ - 2, i = 0; z < W.maxZ + 10; z += 6.5, i++) { back(W.maxX + 15 + (i % 2) * 3, z, i); back(W.minX - 15 - (i % 2) * 3, z + 3, i + 1); }
    for (let x = W.minX - 8, i = 0; x < W.maxX + 10; x += 7.2, i++) back(x, (x < LT.x1 + 4 ? LT.z1 + 11 : W.maxZ + 15) + (i % 2) * 3, i + 2);
    NL.flush();
    nk.finish();
  }
  keep(around);
  for (const g of [city, around]) g.traverse((o) => { if (/** @type {any} */ (o).isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // ---------------------------------------------------------------- árvores
  L.TREES.forEach((t, i) => {
    const grp = `jardim-${zona(t.x, t.z)}`;
    const s = 1.02 + (i % 3) * 0.07;
    kit.add(trunkGeo(), { color: barkTone, x: t.x, z: t.z, ry: R() * TAU, group: grp, ao: false });
    const a0 = R() * TAU;
    for (let k = 0; k < 3; k++) kit.add(boughGeo(), { color: '#6f4a2e', x: t.x, y: 1.85, z: t.z, ry: a0 + (k / 3) * TAU + (R() - 0.5) * 0.5, group: grp, ao: false });
    // dois galhos mais baixos e abertos, entre os de cima: aparecem por baixo da copa, entrando na saia de folhas
    for (let k = 0; k < 2; k++) kit.add(lowBoughGeo(), { color: '#664329', x: t.x, y: 1.55 + k * 0.12, z: t.z, ry: a0 + ((k + 0.5) / 3) * TAU * 1.5 + (R() - 0.5) * 0.4, group: grp, ao: false });
    kit.add(crown(t.kind, i % 3), { color: null, slot: 'foliage', x: t.x, z: t.z, ry: R() * TAU, sx: s, sy: s * (0.94 + R() * 0.12), sz: s, group: grp });
    if (inR(Dk, t.x, t.z, 0.3)) return; // no deque não tem terra nem raiz
    const B = lot('ground', grp);
    // a terra em volta do tronco e as raízes que saem dela (baixas: 7 cm no máximo, fora do colisor)
    const soil = [];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU, rr = 0.68 + 0.26 * h01(i * 3.1, k); soil.push([t.x + Math.cos(a) * rr, 0.004, t.z + Math.sin(a) * rr]); }
    B.fan([t.x, 0.006, t.z], soil, _q[1].copy(SOIL).multiplyScalar(1.25), UP, SOIL);
    const bark = _q[2].copy(BARK).multiplyScalar(0.8), barkD = _q[1].copy(BARK).multiplyScalar(0.58);
    for (let k = 0; k < 5; k++) {
      let a = (k / 5) * TAU + R() * 0.7;
      const rs = [0.2, 0.42, 0.63, 0.84], pts = [];
      for (const r of rs) {
        const hgt = 0.074 * (1 - (r - 0.2) / 0.64), wd = 0.075 * (1 - (r - 0.2) / 0.74), cx = t.x + Math.cos(a) * r, cz = t.z + Math.sin(a) * r;
        pts.push({ l: [cx - Math.sin(a) * wd, 0.004, cz + Math.cos(a) * wd], r: [cx + Math.sin(a) * wd, 0.004, cz - Math.cos(a) * wd], t: [cx, 0.004 + hgt, cz] });
        a += (R() - 0.5) * 0.5;
      }
      for (let j = 0; j + 1 < pts.length; j++) {
        B.quad(pts[j].l, pts[j + 1].l, pts[j + 1].t, pts[j].t, [barkD, barkD, bark, bark], UP);
        B.quad(pts[j].r, pts[j + 1].r, pts[j + 1].t, pts[j].t, [barkD, barkD, bark, bark], UP);
      }
    }
  });

  // ---------------------------------------------------------------- postes de jardim (acesos: ainda é cedo)
  {
    /** @type {any[]} */
    const parts = [];
    const add = (g, y, c, slot = 'solid') => parts.push({ g: g.translate(0, y, 0), c, slot });
    add(cyl(0.075, 0.115, 0.32, 8), 0, IRON);
    add(cyl(0.09, 0.09, 0.035, 8), 0.32, '#3d524c');
    add(cyl(0.036, 0.05, 2.2, 8), 0.355, IRON);
    add(cyl(0.058, 0.04, 0.07, 8), 2.2, '#3d524c');
    add(slab(0.46, 0.022, 0.022), 2.33, IRON);
    add(cyl(0.115, 0.06, 0.05, 6), 2.555, IRON);
    add(cyl(0.15, 0.105, 0.3, 6), 2.605, '#ffe7b0', 'lit');
    add(new THREE.ConeGeometry(0.2, 0.15, 6), 2.98, IRON);
    add(sphere(0.035, 6, 4), 3.08, '#3d524c');
    for (const l of L.LAMPS) for (const p of parts) kit.add(p.g, { color: p.c, slot: p.slot, x: l.x, z: l.z, group: `jardim-${zona(l.x, l.z)}`, ao: p.slot === 'solid' && p.g === parts[0].g });
  }

  // ---------------------------------------------------------------- bancos de praça (ferro e ripas de madeira)
  {
    /** @type {any[]} */
    const parts = [];
    const add = (g, c) => parts.push({ g, c });
    for (const sx of [-0.6, 0.6]) {
      add(slab(0.05, 0.6, 0.05).translate(sx, 0, 0.17), IRON); // o pé da frente sobe até o braço
      add(slab(0.05, 0.88, 0.045).rotateX(-0.09).translate(sx, 0, -0.16), IRON); // o de trás segura o encosto
      add(rb(0.06, 0.035, 0.46, 0.012, 1).translate(sx, 0.6, -0.02), WOODD);
      add(slab(0.035, 0.035, 0.34).translate(sx, 0.16, 0), IRON);
    }
    for (let i = 0; i < 4; i++) add(rb(1.32, 0.03, 0.085, 0.012, 1).translate(0, 0.42, -0.115 + i * 0.1), i % 2 ? WOOD : '#c28a56');
    for (let i = 0; i < 3; i++) {
      const y = 0.55 + i * 0.115;
      add(rb(1.32, 0.085, 0.028, 0.012, 1).rotateX(-0.09).translate(0, y, -0.122 - 0.09 * y), i % 2 ? '#c28a56' : WOOD);
    }
    add(slab(1.2, 0.04, 0.03).translate(0, 0.375, 0.17), IRON);
    for (const b of L.BENCHES) for (const p of parts) kit.add(p.g, { color: p.c, x: b.x, z: b.z, ry: b.yaw, group: `jardim-${zona(b.x, b.z)}`, ao: false });
  }

  // ---------------------------------------------------------------- canteiros compridos junto ao muro (com colisão: BEDS)
  (L.BEDS || []).forEach((bd, i) => {
    const grp = `jardim-${zona(bd.x, bd.z)}`;
    const B = lot('solid', grp);
    const x0 = bd.x - bd.hx, x1 = bd.x + bd.hx, z0 = bd.z - bd.hz, z1 = bd.z + bd.hz, hgt = 0.22, rim = 0.05;
    // a mureta de pedra em blocos (cada um com o seu tom) e a terra, 3 cm abaixo da beirada
    const block = (k) => _q[0].copy(PLINTH).multiplyScalar(0.92 + 0.2 * h01(k, i));
    for (let x = x0, k = 0; x < x1 - 0.01; k++) {
      const xe = Math.min(x1, x + 0.45);
      for (const [z, f] of [[z1, SOUTH], [z0, NORTH]]) B.quad([x, 0, Number(z)], [xe, 0, Number(z)], [xe, hgt, Number(z)], [x, hgt, Number(z)], block(k), f);
      B.rect(x, z0, xe, z0 + rim, hgt, block(k + 3)); B.rect(x, z1 - rim, xe, z1, hgt, block(k + 5));
      x = xe;
    }
    for (let z = z0, k = 0; z < z1 - 0.01; k++) {
      const ze = Math.min(z1, z + 0.45);
      for (const [x, f] of [[x1, EAST], [x0, WEST]]) B.quad([Number(x), 0, z], [Number(x), 0, ze], [Number(x), hgt, ze], [Number(x), hgt, z], block(k + 7), f);
      if (ze - z > 0.02) { B.rect(x0, Math.max(z, z0 + rim), x0 + rim, Math.min(ze, z1 - rim), hgt, block(k + 9)); B.rect(x1 - rim, Math.max(z, z0 + rim), x1, Math.min(ze, z1 - rim), hgt, block(k + 11)); }
      z = ze;
    }
    B.quad([x0 + rim, hgt - 0.03, z0 + rim], [x1 - rim, hgt - 0.03, z0 + rim], [x1 - rim, hgt, z0 + rim], [x0 + rim, hgt, z0 + rim], JOINT, SOUTH);
    B.quad([x0 + rim, hgt - 0.03, z1 - rim], [x1 - rim, hgt - 0.03, z1 - rim], [x1 - rim, hgt, z1 - rim], [x0 + rim, hgt, z1 - rim], JOINT, NORTH);
    lot('ground', grp).rect(x0 + rim, z0 + rim, x1 - rim, z1 - rim, hgt - 0.03, SOIL);
    // as plantas: uma fila cheia, cada espécie repetida em grupos de duas ou três
    const plants = bedPlants();
    const long = bd.hx > bd.hz, len = (long ? bd.hx : bd.hz) * 2 - 0.3, half = Math.min(bd.hx, bd.hz);
    const n = Math.max(2, Math.round(len / 0.33)), sc = Math.min(1, (half + 0.03) / 0.23);
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + (k + 0.5) * (len / n), off = (h01(k, i + 4) - 0.5) * Math.max(0, half - 0.19) * 2;
      const kind = Math.floor(h01(Math.floor((k + i) / 2.5), i * 9 + 1) * plants.length) % plants.length;
      const s = sc * (0.88 + 0.24 * h01(k * 1.7, i));
      kit.add(plants[kind], { color: null, slot: 'plant', x: bd.x + (long ? u : off), y: hgt - 0.035, z: bd.z + (long ? off : u), ry: R() * TAU, sx: s, sy: s * (0.95 + R() * 0.25), sz: s, group: grp, ao: false });
    }
  });

  // ---------------------------------------------------------------- placas e cartazes
  const sign = keep(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.475), new THREE.MeshStandardMaterial({ map: condoSign(), roughness: 0.75 })));
  sign.name = 'recanto:placa';
  sign.position.set(G.x1 + 0.95, 0.98, W.minZ - mt - 0.012); // do lado de fora, entre o portãozinho e o canto do muro
  sign.rotation.y = Math.PI;
  const EP = L.ELECTION_POSTER;
  const poster = keep(new THREE.Mesh(new THREE.PlaneGeometry(EP.w, EP.h), new THREE.MeshStandardMaterial({ map: electionPoster(), roughness: 0.8 })));
  poster.name = 'recanto:cartaz-da-eleicao';
  poster.position.set(EP.x, EP.y, EP.z + 0.003);
  {
    // a moldura de madeira do cartaz e o telhadinho dele
    const B = lot('solid', 'muro-n'), wood = col(WOODD), zf = W.minZ + mt;
    B.box(EP.x - EP.w / 2 - 0.05, EP.y - EP.h / 2 - 0.05, zf, EP.x + EP.w / 2 + 0.05, EP.y - EP.h / 2, zf + 0.03, wood, true);
    B.box(EP.x - EP.w / 2 - 0.05, EP.y + EP.h / 2, zf, EP.x + EP.w / 2 + 0.05, EP.y + EP.h / 2 + 0.05, zf + 0.03, wood, true);
    B.box(EP.x - EP.w / 2 - 0.05, EP.y - EP.h / 2, zf, EP.x - EP.w / 2, EP.y + EP.h / 2, zf + 0.03, wood);
    B.box(EP.x + EP.w / 2, EP.y - EP.h / 2, zf, EP.x + EP.w / 2 + 0.05, EP.y + EP.h / 2, zf + 0.03, wood);
    B.quad([EP.x - EP.w / 2 - 0.1, EP.y + EP.h / 2 + 0.12, zf], [EP.x + EP.w / 2 + 0.1, EP.y + EP.h / 2 + 0.12, zf], [EP.x + EP.w / 2 + 0.1, EP.y + EP.h / 2 + 0.06, zf + 0.12], [EP.x - EP.w / 2 - 0.1, EP.y + EP.h / 2 + 0.06, zf + 0.12], TILES[1], UP);
  }
  const amora = keep(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.82), new THREE.MeshStandardMaterial({ map: amoraPoster(), roughness: 0.8 })));
  amora.name = 'recanto:cartaz-da-amora';
  amora.position.set(G.x0 - 1.4, 0.98, W.minZ - mt - 0.012); // do lado da rua, a oeste do portãozinho
  amora.rotation.y = Math.PI;

  // ---------------------------------------------------------------- capim, florzinhas e trevo
  // Tudo em lotes por zona, no material das plantinhas do kit (duas faces, com o vento). Mais cheio junto ao muro,
  // às calçadinhas e aos troncos; ralo no meio do gramado. As dogs passam roçando (grupos "grama-…", sem colisor).
  /** @type {number[][]} */
  const dew = [];
  const GB = col('#4f8a36'), GT = col('#a6cc5c'), GDRY = col('#c6cc72');
  let tufts = 0;
  const tuft = (x, z, tall) => {
    if (onStone(x, z, 0.02) || inPuddle(x, z)) return;
    const B = lot('plant', `grama-${zona(x, z)}`);
    const Rt = rng(1000 + tufts++);
    const t = tint(x, z, _q[2]);
    const cb = _q[0].copy(GB).lerp(t, 0.45).multiplyScalar(0.8), ct = _q[1].copy(tall ? GDRY : GT).lerp(t, 0.35).multiplyScalar(1.12);
    const n = tall ? 6 : 4;
    for (let k = 0; k < n; k++) {
      const a = Rt() * TAU, r0 = Rt() * (tall ? 0.05 : 0.035);
      const h = tall ? 0.24 + Rt() * 0.2 : 0.09 + Rt() * 0.1;
      bladeInto(B, x + Math.cos(a) * r0, 0, z + Math.sin(a) * r0, a + (Rt() - 0.5), h, tall ? 0.011 : 0.009, h * (0.25 + Rt() * 0.35), cb, ct);
      if (k === 0 && tufts % 7 === 0) dew.push([x + Math.cos(a) * (r0 + h * 0.2), h * 0.72, z + Math.sin(a) * (r0 + h * 0.2), 0.007 + Rt() * 0.006]);
    }
  };
  // junto ao muro (menos onde há prédio encostado nele)
  for (const [ax, az, bx, bz, nx, nz] of [[W.minX, W.minZ, W.maxX, W.minZ, 0, 1], [W.maxX, W.minZ, W.maxX, W.maxZ, -1, 0], [W.minX, W.maxZ, W.maxX, W.maxZ, 0, -1], [W.minX, W.minZ, W.minX, Hs.z0, 1, 0]]) {
    const len = Math.hypot(bx - ax, bz - az);
    // (o pé do muro é onde o cortador não chega: o capim cresce mais cheio e mais alto)
    for (let s = 0.3; s < len - 0.3; s += 0.16) {
      if (R() < 0.15) continue;
      const d = mt + 0.05 + R() * R() * 0.6, x = ax + ((bx - ax) * s) / len + nx * d, z = az + ((bz - az) * s) / len + nz * d;
      if (free(x, z, 0.02)) tuft(x, z, R() < 0.5);
    }
  }
  // nas beiradas das calçadinhas, da entrada da garagem e da pracinha
  for (const r of [...PATHS, APRON]) {
    const per = [[r.x0, r.z0, r.x1, r.z0, 0, -1], [r.x1, r.z0, r.x1, r.z1, 1, 0], [r.x1, r.z1, r.x0, r.z1, 0, 1], [r.x0, r.z1, r.x0, r.z0, -1, 0]];
    for (const [ax, az, bx, bz, nx, nz] of per) {
      const len = Math.hypot(bx - ax, bz - az);
      for (let s = R() * 0.3; s < len; s += 0.3 + R() * 0.12) {
        const d = 0.03 + R() * 0.12, x = ax + ((bx - ax) * s) / len + nx * d, z = az + ((bz - az) * s) / len + nz * d;
        if (free(x, z, 0.01)) tuft(x, z, R() < 0.08);
      }
    }
  }
  for (let k = 0; k < 34; k++) {
    const a = (k / 34) * TAU, d = MOSAIC.r + 0.04 + R() * 0.12, x = MOSAIC.x + Math.cos(a) * d, z = MOSAIC.z + Math.sin(a) * d;
    if (free(x, z, 0.01)) tuft(x, z, false);
  }
  // em volta dos troncos, dos postes, das pedras das trilhas e na beira do lago (capim alto)
  for (const t of L.TREES) for (let k = 0; k < 11; k++) { const a = R() * TAU, d = 0.36 + R() * 0.6, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d; if (free(x, z, 0.02)) tuft(x, z, R() < 0.3); }
  for (const l of L.LAMPS) for (let k = 0; k < 5; k++) { const a = R() * TAU, d = 0.17 + R() * 0.16, x = l.x + Math.cos(a) * d, z = l.z + Math.sin(a) * d; if (free(x, z, 0.02)) tuft(x, z, false); }
  for (const s of stones) { if (!s.r) continue; for (let k = 0; k < 2; k++) { const a = R() * TAU, d = s.r * 1.22 + R() * 0.1, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d; if (free(x, z, 0.02)) tuft(x, z, false); } }
  for (let i = 0; i < O.length; i++) {
    const a = O[i], b = O[(i + 1) % O.length], len = Math.hypot(b.x - a.x, b.z - a.z);
    for (let s = 0; s < len; s += 0.5) {
      const d = 0.58 + R() * 0.4, x = a.x + ((b.x - a.x) * s) / len - ((b.z - a.z) / len) * d, z = a.z + ((b.z - a.z) * s) / len + ((b.x - a.x) / len) * d;
      if (lakeD(x, z) > 0.5 && free(x, z, 0.02)) tuft(x, z, R() < 0.7);
    }
  }
  // e solto pelo gramado, em manchas
  for (let z = W.minZ + 0.6; z < W.maxZ - 0.4; z += 0.95) {
    for (let x = W.minX + 0.6; x < W.maxX - 0.4; x += 0.95) {
      const px = x + (R() - 0.5) * 0.9, pz = z + (R() - 0.5) * 0.9;
      if (R() > 0.2 + 0.62 * smoothstep(0.42, 0.68, fbm2(px * 0.3 + 2, pz * 0.3 - 6, 2))) continue;
      if (free(px, pz, 0.04)) tuft(px, pz, R() < 0.06);
    }
  }
  // florzinhas em grupos (uma estrela de cinco pétalas num cabinho) e trevo rente ao chão
  {
    const FL = ['#ffffff', '#fff3a8', '#f6b3d2', '#c9b3f2', '#ffd96a'].map(col), mid = col('#f2c230'), stem = col('#5a8f3a');
    const Rf = rng(417);
    const spots = [];
    for (let k = 0; spots.length < 74 && k < 900; k++) {
      const x = W.minX + 0.6 + Rf() * (W.maxX - W.minX - 1.2), z = W.minZ + 0.6 + Rf() * (W.maxZ - W.minZ - 1.2);
      if (free(x, z, 0.25) && !inPuddle(x, z, 0.3)) spots.push([x, z]);
    }
    spots.forEach(([cx, cz], si) => {
      const c = FL[si % FL.length], m = 4 + Math.floor(Rf() * 5);
      for (let k = 0; k < m; k++) {
        const a = Rf() * TAU, d = Rf() * 0.5, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!free(x, z, 0.03) || onStone(x, z, 0.03)) continue;
        const B = lot('plant', `grama-${zona(x, z)}`);
        const h = 0.06 + Rf() * 0.08, r = 0.03 + Rf() * 0.018, tx = (Rf() - 0.5) * 0.5, tz = (Rf() - 0.5) * 0.5, ph = Rf() * TAU;
        B.tri([x - 0.004, 0, z], [x + 0.004, 0, z], [x, h, z], stem);
        const pts = [];
        for (let j = 0; j < 10; j++) {
          const aa = ph + (j / 10) * TAU, rr = j % 2 ? r * 0.42 : r, ox = Math.cos(aa) * rr, oz = Math.sin(aa) * rr;
          pts.push([x + ox, h + 0.012 + ox * tx + oz * tz + (j % 2 ? 0 : 0.006), z + oz]);
        }
        B.fan([x, h + 0.014, z], pts, c, null, mid);
        if (k === 0) dew.push([x + r * 0.5, h + 0.022, z, 0.006]);
      }
    });
    const CLV = [col('#3f7a36'), col('#4f8f3e'), col('#35692f')];
    for (let k = 0, made = 0; made < 46 && k < 600; k++) {
      const cx = W.minX + 0.6 + Rf() * (W.maxX - W.minX - 1.2), cz = W.minZ + 0.6 + Rf() * (W.maxZ - W.minZ - 1.2);
      if (!free(cx, cz, 0.2) || inPuddle(cx, cz, 0.2)) continue;
      made++;
      for (let j = 0; j < 7; j++) {
        const a = Rf() * TAU, d = Rf() * 0.3, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!free(x, z, 0.03) || onStone(x, z, 0.03)) continue;
        const B = lot('plant', `grama-${zona(x, z)}`), c = CLV[j % 3], ph = Rf() * TAU, y = 0.024 + Rf() * 0.012;
        for (let l = 0; l < 3; l++) {
          const aa = ph + (l / 3) * TAU, ux = Math.cos(aa), uz = Math.sin(aa);
          B.quad([x, y, z], [x + ux * 0.022 - uz * 0.017, y + 0.006, z + uz * 0.022 + ux * 0.017], [x + ux * 0.042, y + 0.01, z + uz * 0.042], [x + ux * 0.022 + uz * 0.017, y + 0.006, z + uz * 0.022 - ux * 0.017], c);
        }
      }
    }
  }

  // ---------------------------------------------------------------- o que a tempestade deixou pelo chão
  // Folhas e pétalas (dos ipês), gravetos, galhos caídos, telhas quebradas e poças: tudo rente ao chão (até 6 cm).
  {
    const Rd = rng(733);
    let li = 0;
    /** Uma folha (ou pétala) deitada: um losango, cada uma numa altura (nenhuma no mesmo plano da outra). */
    const leaf = (x, z, c, len = 0.075) => {
      if (inPuddle(x, z, 0.02)) return;
      const B = lot('ground', `grama-${zona(x, z)}`);
      const base = paved(x, z) ? Y1 + 0.009 : onStone(x, z) ? 0.031 : 0.018;
      const y = base + (li++ % 9) * 0.0007, a = Rd() * TAU, ux = Math.cos(a) * len, uz = Math.sin(a) * len, wx = -uz * 0.34, wz = ux * 0.34;
      B.quad([x - ux * 0.5, y, z - uz * 0.5], [x + wx, y + 0.003, z + wz], [x + ux * 0.5, y + 0.002, z + uz * 0.5], [x - wx, y + 0.003, z - wz], _q[0].copy(c).multiplyScalar(0.85 + Rd() * 0.3), UP);
    };
    const okLeaf = (x, z) => x > W.minX + 0.3 && x < W.maxX - 0.3 && z > W.minZ + 0.3 && z < W.maxZ - 0.3 && !built(x, z, 0.12) && lakeD(x, z) > 0.55 && !hitsCollider(x, z, 0.04) && !inR(BRANCH_LANE, x, z, 0.1);
    L.TREES.forEach((t, i) => {
      if (inR(Dk, t.x, t.z, 0.3)) return;
      const ipe = t.kind !== 'verde', pal = ipe ? [CROWNS[t.kind].mid, CROWNS[t.kind].light].map(col) : LEAVES;
      for (let k = 0; k < (ipe ? 80 : 20); k++) {
        const a = Rd() * TAU, d = 0.4 + Rd() * Rd() * 2.4, x = t.x + Math.cos(a) * d + 0.5, z = t.z + Math.sin(a) * d - 0.2; // o vento empurrou para o leste
        if (okLeaf(x, z)) leaf(x, z, pal[(k + i) % pal.length], ipe ? 0.05 : 0.078);
      }
    });
    for (let k = 0; k < 260; k++) {
      // o vento juntou folhas no pé do muro e nas quinas; o resto ficou solto pelo gramado e pelas calçadinhas
      const edge = k < 110;
      let x = W.minX + 0.4 + Rd() * (W.maxX - W.minX - 0.8), z = W.minZ + 0.4 + Rd() * (W.maxZ - W.minZ - 0.8);
      if (edge) { if (k % 2) x = k % 4 === 1 ? W.minX + mt + 0.1 + Rd() * 0.5 : W.maxX - mt - 0.1 - Rd() * 0.5; else z = k % 4 === 0 ? W.minZ + mt + 0.1 + Rd() * 0.5 : W.maxZ - mt - 0.1 - Rd() * 0.5; }
      if (okLeaf(x, z)) leaf(x, z, LEAVES[k % LEAVES.length]);
    }
    // gravetos (prismas finos, com uma forquilha) e galhos caídos, com as folhas ainda presas
    const stick = (x, z, a, len, r, c) => {
      const B = lot('ground', `grama-${zona(x, z)}`);
      const ux = Math.cos(a), uz = Math.sin(a), y = paved(x, z) ? Y1 : 0.004;
      const p = (s, side, up) => [x + ux * s - uz * side, y + up, z + uz * s + ux * side];
      B.quad(p(0, -r, 0), p(len, -r * 0.6, 0), p(len, 0, r * 1.5), p(0, 0, r * 2), c, UP);
      B.quad(p(0, r, 0), p(len, r * 0.6, 0), p(len, 0, r * 1.5), p(0, 0, r * 2), c, UP);
    };
    const twigC = col('#6b4a2e');
    for (let k = 0, made = 0; made < 40 && k < 500; k++) {
      const x = W.minX + 0.5 + Rd() * (W.maxX - W.minX - 1), z = W.minZ + 0.5 + Rd() * (W.maxZ - W.minZ - 1);
      if (!okLeaf(x, z) || inPuddle(x, z, 0.1)) continue;
      made++;
      const a = Rd() * TAU, len = 0.22 + Rd() * 0.3;
      stick(x, z, a, len, 0.011, twigC);
      stick(x + Math.cos(a) * len * 0.55, z + Math.sin(a) * len * 0.55, a + 0.7, len * 0.4, 0.008, twigC);
    }
    for (const [bx, bz, ba] of [[-13.6, -2.8, 0.5], [19.6, -7.6, 2.4], [16.8, 11.8, -0.6], [-21.2, -13.2, 1.9], [6.2, 1.9, 1.1]]) {
      if (!free(bx, bz, 0.5)) continue;
      stick(bx, bz, ba, 1.25, 0.024, twigC);
      for (let k = 0; k < 4; k++) {
        const s = 0.25 + k * 0.26, aa = ba + (k % 2 ? 0.8 : -0.8), x = bx + Math.cos(ba) * s, z = bz + Math.sin(ba) * s;
        stick(x, z, aa, 0.42, 0.012, twigC);
        for (let j = 0; j < 4; j++) leaf(x + Math.cos(aa) * (0.15 + j * 0.09) + (Rd() - 0.5) * 0.1, z + Math.sin(aa) * (0.15 + j * 0.09) + (Rd() - 0.5) * 0.1, LEAVES[j % 2 ? 0 : 3], 0.085);
      }
    }
    // cacos de telha: perto da casa (o telhado dela) e no pé do muro (as telhas de capa)
    const shard = (x, z) => {
      if (!okLeaf(x, z) || paved(x, z, 0.05) || inPuddle(x, z, 0.1)) return;
      const B = lot('ground', `grama-${zona(x, z)}`), c = _q[1].copy(TILES[Math.floor(Rd() * TILES.length)]).multiplyScalar(0.9 + Rd() * 0.2), cd = _q[2].copy(c).multiplyScalar(0.7);
      const n = 4 + Math.floor(Rd() * 2), r = 0.05 + Rd() * 0.05, ph = Rd() * TAU, lo = [], hi = [];
      for (let k = 0; k < n; k++) {
        const a = ph + (k / n) * TAU, rr = r * (0.7 + Rd() * 0.5);
        lo.push([x + Math.cos(a) * rr, 0.004, z + Math.sin(a) * rr]);
        hi.push([x + Math.cos(a) * rr * 0.9, 0.018 + (k % 2) * 0.012, z + Math.sin(a) * rr * 0.9]);
      }
      for (let k = 0; k < n; k++) B.quad(lo[k], lo[(k + 1) % n], hi[(k + 1) % n], hi[k], cd, UP);
      B.fan([x, 0.03, z], hi, c, UP);
    };
    for (let k = 0; k < 12; k++) shard(Hs.x0 + 1.2 + Rd() * (Hs.x1 - Hs.x0 - 1.4), Hs.z0 - 0.25 - Rd() * 0.6);
    for (let k = 0; k < 8; k++) shard(W.minX + mt + 0.15 + Rd() * 0.5, W.minZ + 2 + Rd() * 12);
    for (let k = 0; k < 8; k++) shard(W.maxX - mt - 0.15 - Rd() * 0.5, W.minZ + 2 + Rd() * 9);
    for (let k = 0; k < 6; k++) shard(14 + Rd() * 3.4, W.minZ + mt + 0.15 + Rd() * 0.5);
    // poças: a lama em volta (na grama), a beirada escura e a água, que reflete o céu
    PUDDLES.forEach((p, i) => {
      if (p.paved ? !paved(p.x, p.z, -p.r * 0.5) : !free(p.x, p.z, p.r * 0.7)) { p.r = 0; return; }
      const grp = `grama-${zona(p.x, p.z)}`, B = lot('ground', grp), Bw = lot('glass', grp);
      const y = p.paved ? Y1 : 0, sz = 0.7 + h01(i, 3) * 0.2, rot = h01(i, 5) * TAU;
      const ringPts = (k, yy) => {
        const pts = [];
        for (let j = 0; j < 20; j++) {
          const a = (j / 20) * TAU, rr = p.r * k * (1 + 0.1 * Math.sin(2 * a + i) + 0.06 * Math.sin(3 * a + i * 2.3));
          const lx = Math.cos(a) * rr, lz = Math.sin(a) * rr * sz;
          pts.push([p.x + lx * Math.cos(rot) - lz * Math.sin(rot), yy, p.z + lx * Math.sin(rot) + lz * Math.cos(rot)]);
        }
        return pts;
      };
      if (!p.paved) B.fan([p.x, 0.008, p.z], ringPts(1.18, 0.008), MUD, UP);
      B.fan([p.x, y + 0.011, p.z], ringPts(1.02, y + 0.011), p.paved ? col('#7d7868') : MUDD, UP);
      Bw.fan([p.x, y + 0.0145, p.z], ringPts(0.93, y + 0.0145), col('#93bfd9'), UP);
    });
  }

  // o orvalho: gotinhas nas pontas do capim e nas flores (uma malha instanciada, que brilha com o céu)
  if (dew.length) {
    const drops = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#f4fbff', roughness: 0.05, metalness: 0, envMapIntensity: 2.2 }), dew.length);
    const m4 = new THREE.Matrix4();
    dew.forEach(([x, y, z, r], i) => drops.setMatrixAt(i, m4.makeScale(r, r, r).setPosition(x, y, z)));
    drops.instanceMatrix.needsUpdate = true;
    drops.name = 'grama:orvalho';
    drops.castShadow = false;
    drops.frustumCulled = false;
    keep(drops);
  }

  // ---------------------------------------------------------------- a vida nos cantos
  // Só onde não atrapalha: no alto (passarinhos no chapim do muro, no encosto de um banco, no braço dos postes; as
  // casinhas de passarinho nos troncos), dentro dos canteiros (o colisor deles: regador, plaquinhas, o saco de adubo,
  // a pazinha) ou rente ao chão (a mangueira enrolada no gramado). As peças maiores no chão (a bicicletinha, os
  // caixotes) só aparecem quando o layout trouxer o colisor delas (ids 'vida-…').
  {
    const hasCol = (id) => COLS.some((c) => c.id === id);
    /** @type {('pardal' | 'bentevi' | 'sabia')[]} */
    const KINDS = ['pardal', 'bentevi', 'pardal', 'sabia'];
    /** Passarinho no chapim de um trecho de muro (nx, nz: para dentro; olha para dentro ou de lado). */
    const onWall = (x, z, h, side, k, look = 0) => kit.add(birdGeo(KINDS[k % KINDS.length]), { color: null, x, y: h + 0.05 + 0.085, z, ry: look, group: `muro-${side}`, ao: false });
    // norte (ry −π/2: de bico para o sul, para dentro), longe da torre, da guarita e do telhadinho dos tanques
    onWall(-20.1, W.minZ - 0.02, W.hNorth, 'n', 0, -Math.PI / 2);
    onWall(-19.86, W.minZ + 0.02, W.hNorth, 'n', 2, -Math.PI / 2 + 0.6);
    onWall(-4.2, W.minZ, W.hNorth, 'n', 1, -Math.PI / 2 - 0.3);
    onWall(0.8, W.minZ, W.hNorth, 'n', 3, 0);
    onWall(1.06, W.minZ + 0.01, W.hNorth, 'n', 0, Math.PI);
    onWall(16.0, W.minZ, W.hNorth, 'n', 1, -Math.PI / 2);
    // leste (ry π: de bico para o oeste) e sul (ry π/2: para o norte)
    onWall(W.maxX, -3.0, W.h, 'l', 2, Math.PI);
    onWall(W.maxX, 6.9, W.h, 'l', 1, Math.PI + 0.4);
    onWall(9.4, W.maxZ, W.h, 's', 3, Math.PI / 2);
    onWall(9.66, W.maxZ, W.h, 's', 0, Math.PI / 2 - 0.5);
    // um sabiá no encosto do banco do lago e um pardal no braço de dois postes
    {
      const b = L.BENCHES[1], c = Math.cos(b.yaw), sn = Math.sin(b.yaw), lx = 0.36, lz = -0.2;
      kit.add(birdGeo('sabia'), { color: null, x: b.x + lx * c + lz * sn, y: 0.865, z: b.z - lx * sn + lz * c, ry: b.yaw + 0.5, group: `jardim-${zona(b.x, b.z)}`, ao: false });
    }
    for (const [i, dx, ry] of [[1, 0.17, 0.4], [4, -0.16, 2.6]]) {
      const l = L.LAMPS[i];
      if (l) kit.add(birdGeo(i === 1 ? 'pardal' : 'bentevi'), { color: null, x: l.x + dx, y: 2.352, z: l.z, ry, group: `jardim-${zona(l.x, l.z)}`, ao: false });
    }
    // as casinhas de passarinho nos troncos (a 1,6 m, viradas para o sul), com um pardal na porta de uma delas
    L.TREES.forEach((t, i) => {
      if (t.kind !== 'verde' || i % 2) return;
      const grp = `jardim-${zona(t.x, t.z)}`;
      kit.add(birdhouseGeo(), { color: null, x: t.x, y: 1.6, z: t.z + 0.15, group: grp, ao: false });
      if (i % 4 === 0) kit.add(birdGeo('pardal'), { color: null, x: t.x + 0.02, y: 1.6 + 0.045 - 0.003, z: t.z + 0.15 + 0.175, ry: -Math.PI / 2 + 0.3, sx: 0.85, sy: 0.85, sz: 0.85, group: grp, ao: false });
    });
    // nos canteiros do muro (em cima da terra, dentro do colisor): regadores, plaquinhas, o saco de adubo e a pazinha
    const soil = 0.22 - 0.03;
    const inBed = (x, z) => (L.BEDS || []).find((bd) => Math.abs(x - bd.x) < bd.hx - 0.06 && Math.abs(z - bd.z) < bd.hz - 0.04);
    const bedPut = (geo, x, z, o = {}) => { if (inBed(x, z)) kit.add(geo, { color: null, x, y: soil, z, group: `jardim-${zona(x, z)}`, ao: false, ...o }); };
    bedPut(wateringCan(), -12.25, W.minZ + mt + 0.24, { ry: 2.6 });
    bedPut(wateringCan(), W.minX + mt + 0.22, -3.0, { ry: -0.6, sx: 0.9, sy: 0.9, sz: 0.9 });
    bedPut(sackGeo(), -22.95, W.minZ + mt + 0.09, { rx: -0.12, ry: 0.05 });
    for (const [x, z, c, ry] of [[-20.6, W.minZ + mt + 0.3, '#fff6dc', 0.15], [-15.4, W.minZ + mt + 0.3, '#fff0a0', -0.1], [W.minX + mt + 0.3, -10.6, '#ffffff', Math.PI / 2 + 0.1], [13.4, W.maxZ - mt - 0.2, '#d7f0c8', Math.PI - 0.12], [21.2, W.maxZ - mt - 0.2, '#ffd5e0', Math.PI + 0.1]]) {
      bedPut(markerGeo(String(c)), Number(x), Number(z), { ry: Number(ry), rx: 0.08 });
    }
    {
      const x = -14.1, z = W.minZ + mt + 0.26;
      if (inBed(x, z)) {
        const B = lot('solid', `jardim-${zona(x, z)}`), wood = col('#c08a52'), steel = col('#9aa1a6');
        B.box(x - 0.012, soil + 0.05, z - 0.012, x + 0.012, soil + 0.2, z + 0.012, wood, true);
        B.quad([x - 0.04, soil - 0.02, z], [x + 0.04, soil - 0.02, z], [x + 0.03, soil + 0.05, z + 0.004], [x - 0.03, soil + 0.05, z + 0.004], steel, SOUTH);
      }
    }
    // a mangueira enrolada no gramado, perto do canteiro do oeste, e a torneira dela no muro (rente ao chão: 6 cm)
    {
      const hx = W.minX + mt + 1.0, hz = -1.62, wallX = W.minX + mt;
      if (free(hx, hz, 0.3)) {
        const grp = `grama-${zona(hx, hz)}`, green = '#4f9a52';
        for (let k = 0; k < 3; k++) kit.add(new THREE.TorusGeometry(0.21 + k * 0.03, 0.015, 6, 22).rotateX(Math.PI / 2), { color: k % 2 ? '#5aa85e' : green, slot: 'solid', x: hx + k * 0.012, y: 0.016 + (k === 2 ? 0.026 : 0), z: hz - k * 0.01, group: grp, ao: false });
        const run = new THREE.CatmullRomCurve3([[hx - 0.26, 0.016, hz], [hx - 0.6, 0.016, hz - 0.05], [wallX + 0.06, 0.016, hz - 0.1], [wallX + 0.018, 0.08, hz - 0.1], [wallX + 0.018, 0.5, hz - 0.1], [wallX + 0.03, 0.6, hz - 0.1]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        kit.add(new THREE.TubeGeometry(run, 24, 0.014, 5), { color: green, slot: 'solid', group: grp, ao: false });
        kit.add(cyl(0.022, 0.016, 0.07, 8).rotateZ(Math.PI / 2), { color: '#f2c230', x: hx + 0.28, y: 0.022, z: hz + 0.05, ry: 0.4, group: grp, ao: false });
        kit.add(cyl(0.014, 0.014, 0.1, 8).rotateZ(Math.PI / 2), { color: '#c9ced3', slot: 'glass', x: wallX + 0.05, y: 0.62, z: hz - 0.1, group: 'muro-o', ao: false });
        kit.add(rb(0.016, 0.012, 0.06, 0.005, 1), { color: '#d63a32', x: wallX + 0.06, y: 0.67, z: hz - 0.1, group: 'muro-o', ao: false });
      }
    }
    // a bicicletinha encostada no muro do sul (colisor 'vida-bicicleta': x 8,95…10,25, z 14,42…14,84)
    if (hasCol('vida-bicicleta')) {
      const grp = `jardim-${zona(9.6, 14.6)}`, bx = 9.6, bz = W.maxZ - mt - 0.2, frame = '#e8475f';
      const wheel = (x) => {
        kit.add(new THREE.TorusGeometry(0.2, 0.022, 6, 22), { color: '#2b2b30', x, y: 0.22, z: bz, ry: 0.03, group: grp, ao: false });
        kit.add(new THREE.TorusGeometry(0.17, 0.006, 4, 18), { color: '#c9ced3', x, y: 0.22, z: bz, ry: 0.03, group: grp, ao: false });
        kit.add(cyl(0.03, 0.03, 0.05, 8).rotateX(Math.PI / 2), { color: '#9aa1a6', x, y: 0.22, z: bz, group: grp, ao: false });
      };
      wheel(bx - 0.42);
      wheel(bx + 0.42);
      const tube = (a, b, r = 0.016) => {
        const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], 0), len = d.length();
        kit.add(cyl(r, r, len, 6).rotateZ(-Math.atan2(d.x, d.y)), { color: frame, x: a[0], y: a[1], z: bz, group: grp, ao: false });
      };
      tube([bx - 0.42, 0.22], [bx - 0.05, 0.24]); tube([bx - 0.05, 0.24], [bx + 0.3, 0.5]); tube([bx - 0.42, 0.22], [bx - 0.12, 0.52]);
      tube([bx - 0.12, 0.52], [bx + 0.3, 0.5]); tube([bx + 0.42, 0.22], [bx + 0.3, 0.5]); tube([bx + 0.3, 0.5], [bx + 0.27, 0.64], 0.013);
      tube([bx - 0.05, 0.24], [bx - 0.14, 0.58], 0.013);
      kit.add(rb(0.2, 0.04, 0.09, 0.02, 1), { color: '#2b2b30', x: bx - 0.15, y: 0.58, z: bz, group: grp, ao: false });
      kit.add(cyl(0.012, 0.012, 0.4, 6).rotateX(Math.PI / 2), { color: '#3a3f44', x: bx + 0.27, y: 0.64, z: bz, group: grp, ao: false });
      kit.add(new THREE.ConeGeometry(0.07, 0.06, 10, 1, true).rotateZ(Math.PI / 2), { color: '#f2c230', x: bx + 0.36, y: 0.6, z: bz, group: grp, ao: false });
    }
    // os caixotes de feira e um saco no canto nordeste, perto do portãozinho (colisor 'vida-caixotes': x 23,15…24,0, z −15,15…−14,35)
    if (hasCol('vida-caixotes')) {
      const grp = `jardim-${zona(23.6, -14.8)}`, B = lot('solid', grp);
      const crate = (cx, cz, y, ry, tint) => {
        const c = Math.cos(ry), sn = Math.sin(ry), w = 0.25, d = 0.18, h = 0.3;
        const P = (lx, ly, lz) => [cx + lx * c + lz * sn, y + ly, cz - lx * sn + lz * c];
        const wood = _q[0].copy(col('#c9995e')).multiplyScalar(tint), dark = _q[1].copy(col('#8f6a40')).multiplyScalar(tint);
        /** @type {[number, number[]][]} */
        const SIDES_X = [[1, [c, 0, -sn]], [-1, [-c, 0, sn]]], SIDES_Z = [[1, [sn, 0, c]], [-1, [-sn, 0, -c]]];
        for (const [sx, F] of SIDES_X) {
          for (let k = 0; k < 3; k++) B.quad(P(sx * w, 0.02 + k * 0.1, -d), P(sx * w, 0.02 + k * 0.1, d), P(sx * w, 0.09 + k * 0.1, d), P(sx * w, 0.09 + k * 0.1, -d), wood, F);
          B.quad(P(sx * (w - 0.02), 0, -d), P(sx * (w - 0.02), 0, d), P(sx * (w - 0.02), h, d), P(sx * (w - 0.02), h, -d), dark, F);
        }
        for (const [sz, F] of /** @type {[number, number[]][]} */ (SIDES_Z)) {
          for (let k = 0; k < 3; k++) B.quad(P(-w, 0.02 + k * 0.1, sz * d), P(w, 0.02 + k * 0.1, sz * d), P(w, 0.09 + k * 0.1, sz * d), P(-w, 0.09 + k * 0.1, sz * d), wood, F);
          B.quad(P(-w, 0, sz * (d - 0.02)), P(w, 0, sz * (d - 0.02)), P(w, h, sz * (d - 0.02)), P(-w, h, sz * (d - 0.02)), dark, F);
        }
        B.quad(P(-w + 0.02, 0.02, -d + 0.02), P(w - 0.02, 0.02, -d + 0.02), P(w - 0.02, 0.02, d - 0.02), P(-w + 0.02, 0.02, d - 0.02), dark, UP);
      };
      crate(23.5, -14.95, 0, 0.05, 1);
      crate(23.52, -14.6, 0, -0.08, 0.92);
      crate(23.5, -14.93, 0.3, 0.2, 1.06);
      kit.add(sackGeo(), { color: null, x: 23.82, z: -14.48, ry: -1.2, rx: -0.1, sx: 0.8, sy: 0.8, sz: 0.8, group: grp, ao: false });
    }
  }

  // ---------------------------------------------------------------- sombras de contato (oclusão no pé das coisas)
  // Um decalque macio, azulado, em volta de tudo o que fica em pé no chão: o pé dos muros e das paredes (as quinas
  // ficam mais escuras, onde duas faixas se cruzam), dos móveis, dos postes, dos troncos, dos vasos, da caminhonete e da
  // guarita, e por baixo do que tem pés (mesas, bancos, espreguiçadeiras). Sai dos colisores do layout: tudo o que tem
  // colisor fica no chão. Um lote por zona (balde 'contact': sem luz, sem sombra, por cima dos pisos).
  {
    /** @type {Record<string, ReturnType<typeof decalLot>>} */
    const lots = {};
    const inWater = (x, z) => (x > Pl.x0 - 0.02 && x < Pl.x1 + 0.02 && z > Pl.z0 - 0.02 && z < Pl.z1 + 0.02) || lakeD(x, z) < 0.12;
    const lotAt = (x, z) => lots[zona(x, z)] || (lots[zona(x, z)] = decalLot(0.027, inWater));
    const cx = (W.minX + W.maxX) / 2, cz = (W.minZ + W.maxZ) / 2;
    // o terraço da torre (cenário à parte, 'telhado-*', com o vazio em volta) fica de fora: world/telhado.js cuida dele
    const SKIP = /^(lago-|ilha-|canal-|pier-|piscina$|espreguicadeira-\d+-ponta|telhado-)/;
    /** Os móveis de pés (por baixo deles a sombra é mais fechada). */
    const LEGS = /^(espreguicadeira|mesa|banco|cadeira|caminhonete|garagem-bicicleta|garagem-carrinho|garagem-bancada|varal-de-chao|mesinha|namoradeira|poltrona|sofa|aparador|rack|comoda|bau)/;
    for (const c of COLS) {
      if (!c.id || SKIP.test(c.id) || c.kind === 'water') continue;
      if (c.shape === 'segment') {
        const len = Math.hypot(c.bx - c.ax, c.bz - c.az);
        if (len < 0.05) continue;
        const ux = (c.bx - c.ax) / len, uz = (c.bz - c.az) / len, t = c.t ?? 0.05;
        const mx = (c.ax + c.bx) / 2, mz = (c.az + c.bz) / 2;
        const D = lotAt(mx, mz);
        const muro = /^muro-/.test(c.id);
        // o muro do condomínio: só do lado de dentro (largo); as paredes de casa, de torre e de depósito: dos dois lados
        const sides = muro ? [(cx - mx) * -uz + (cz - mz) * ux > 0 ? 1 : -1] : [1, -1];
        for (const s of sides) {
          const nx = -uz * s, nz = ux * s;
          D.strip(c.ax + nx * t, c.az + nz * t, c.bx + nx * t, c.bz + nz * t, nx, nz, muro ? 0.62 : 0.42, { a: muro ? 0.34 : 0.3 });
        }
      } else if (c.shape === 'box') {
        const legs = LEGS.test(c.id) || c.blocks === 'large';
        const w = Math.min(0.5, 0.22 + 0.16 * Math.min(c.hx, c.hz));
        lotAt(c.x, c.z).rrect(c.x, c.z, c.hx, c.hz, w, { a: legs ? 0.4 : 0.32 });
      } else if (c.shape === 'circle') {
        const w = Math.min(0.5, 0.16 + c.r * 0.9);
        lotAt(c.x, c.z).disc(c.x, c.z, c.r, /^arvore-/.test(c.id) ? 0.62 : w, { a: /^arvore-/.test(c.id) ? 0.36 : 0.3 });
      }
    }
    for (const [key, D] of Object.entries(lots)) {
      const g = D.geometry();
      if (g) kit.add(g, { color: null, slot: 'contact', group: `sombra-${key}`, ao: false });
    }
  }

  flush();

  return {
    props: {
      gateLeaf: { object: leafPivot, setOpen: setGate },
      city: {
        object: city, portal, tower,
        clockAt: { x: tower.position.x, y: CLOCK.y, z: tower.position.z + CLOCK.z },
        portalAt: { x: portal.position.x, y: 6.4, z: portal.position.z },
      },
    },
    seeThrough: [leafPivot],
    signs: [],
    reset() { setGate(0); },
    // as malhas ficam na árvore: o escopo de recursos da área (src/core/resources.js) libera tudo depois deste dispose
    dispose() {},
  };
}
