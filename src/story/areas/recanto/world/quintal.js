// RECANTO DAS PATINHAS — o QUINTAL MAIOR (4ª rodada: "coloque mais puzzles espalhados pelo quintal, lado de fora;
// aumente o quintal após sair de casa"). Saiu de world/casa.js (que agora é só a casa). Coordenadas em ../layout.js
// (YARD, LOT, HOUSE_EXIT e as peças do quintal); a lógica dos puzzles em ../quintalPuzzles.js.
// De sul para norte:
//   O FUNDO (a faixa ao sul da casa e o canto do quintal): a HORTA (o canteiro de alface com o pé grande, o dos legumes
//     e o dos tomates no muro, a composteira), a TORNEIRA DE MOLA no cano com a MANGUEIRA enroscada na alavanca, o
//     BALDÃO com a bolinha no fundo, a casinha, a mesa de jardim com guarda-sol, o varalzinho, brinquedos e vasos;
//   A HORTA DO MEIO: dois canteiros elevados de madeira com temperos, pimenteiras e um cata-vento, a passagem estreita
//     no meio e o JABUTI (o Seu Bento, src/story/scene/jabuti.js) cochilando nela;
//   O JARDIM DE FLORES: o gramadinho entre dois canteiros compridos de tijolo (hortênsias, lavanda, margaridas), os três
//     ASPERSORES de subir (o jato em gotas instanciadas, barato), o programador da irrigação com as três gotas acesas
//     e, ao norte, a caixinha do REGISTRO com a tampa de ferro aberta;
//   O NORTE: a GOIABEIRA com a PIPA presa no alto (a rabiola com as penas e o anel de borracha), e o final de antes: o
//     muro com a passagem baixa, a porta da área de serviço com o FERROLHO por fora e o GALHO da tempestade em cima das
//     telhas quebradas.
// O que colide tem colisor em ../layout.js (STATIC_COLLIDERS: yardColliders); o que se mexe (porta, ferrolho, galho,
// aspersores, jabuti, alface, mangueira, água, bolinha, goiabeira e pipa) fica em malhas próprias, com o lado de animar em
// props.quintal (o resto: props.serviceDoor, props.branch, props.serviceBolt, como antes). Sem luz nova; os materiais
// são feitos na carga; nada é alocado por quadro.
import * as THREE from 'three';
import { rng, foliageCluster, paint, mergeGeometries, leafSkin } from '../../../../world/util.js';
import { lavender, lettuce, carrotTops, boxwood, smallFlowers, geranium } from '../../../../world/plants.js';
import { rb, cyl, slab, sphere, rod, gableRoof, SLOTS, wallBox, weathered, decalLot } from '../../../../levels/mapa/world/kit.js';
import { createJabuti } from '../../../scene/jabuti.js';

const TAU = Math.PI * 2;
const C = (hex) => new THREE.Color(hex);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;
const KEEP = ['position', 'normal', 'color'];
const TRIM = '#fff8ec';
const _up = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _qa = new THREE.Quaternion();
const _va = new THREE.Vector3();
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
// As plantas das fases na versão leve (o quintal tem dezenas delas e a área precisa caber no celular): a espiga da lavanda
// com menos segmentos (de ~2 700 para ~1 000 triângulos), a moita do gerânio e o pé de alface também.
const LAVENDER_LITE = { spikeCap: 1, spikeRadial: 5 };
const GERANIUM_LITE = { detail: 1, florets: 6, clusters: 4 };
const LETTUCE_LITE = { segs: [7, 4] };

// ---------------------------------------------------------------- cores e formas (as mesmas da casa)
/** Variação suave de uma cor (reboco, madeira, tecido). */
function vary(hex, amp = 0.05, f = 7) {
  const c = C(hex), out = new THREE.Color();
  return (p) => {
    const n = Math.sin(p.x * f * 1.7 + p.z * f * 2.3 + p.y * f) * 0.5 + Math.sin(p.x * f * 5.1 - p.z * f * 3.7) * 0.5;
    return out.copy(c).multiplyScalar(1 + n * amp);
  };
}
/** Tábuas na horizontal (fiadas de `h` m), cada uma com o seu tom. */
function boards(base, alt, h = 0.1) {
  const a = C(base), b = C(alt), out = new THREE.Color();
  return (p) => { const k = hash(Math.floor((p.y + 5) / h), 3); return out.copy(a).lerp(b, k * 0.85); };
}
/** Haste entre dois pontos [x, y, z]. */
function rodAB(a, b, r, seg = 6) {
  _va.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(1e-4, _va.length());
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.applyQuaternion(_qa.setFromUnitVectors(_up, _va.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
/** Tronco de cone entre dois pontos (r0 em a, r1 em b): galhos. */
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
/** Caixa centrada só com as laterais (sem a face de cima e a de baixo), subdividida como a BoxGeometry. */
function sidesBox(w, h, d, sw, sh, sd) {
  const g = new THREE.BoxGeometry(w, h, d, sw, sh, sd);
  const idx = g.index.array, keep = [];
  // os grupos da BoxGeometry: +x, −x, +y, −y, +z, −z
  for (const gr of g.groups) if (gr.materialIndex !== 2 && gr.materialIndex !== 3) for (let i = gr.start; i < gr.start + gr.count; i++) keep.push(idx[i]);
  g.setIndex(keep);
  g.clearGroups();
  return g;
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
/** Disco plano no plano XY (voltado para +Z), esticado e deslocado. @returns {THREE.BufferGeometry} */
const disc = (r, x = 0, y = 0, sx = 1, sy = 1, n = 14) => new THREE.CircleGeometry(r, n).scale(sx, sy, 1).translate(x, y, 0);
/** Folha caída: a nervura dobrada em V e a ponta levantada. */
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
 * Pictogramas planos (no plano XY, voltados para +Z, centrados, de lado ~s): patinha e gota.
 * @param {'pata' | 'gota'} kind @param {number} s
 * @returns {THREE.BufferGeometry}
 */
function picto(kind, s) {
  if (kind === 'gota') {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); pts.push([Math.cos(a) * s * 0.3, -s * 0.12 - Math.sin(a) * s * 0.3]); }
    pts.push([0, s * 0.48]);
    return shapeXY(pts);
  }
  return mergeGeometries([
    disc(s * 0.24, 0, -s * 0.13, 1.15, 0.95), disc(s * 0.1, -s * 0.31, s * 0.07, 0.9, 1.15), disc(s * 0.11, -s * 0.12, s * 0.28, 0.9, 1.15),
    disc(s * 0.11, s * 0.12, s * 0.28, 0.9, 1.15), disc(s * 0.1, s * 0.31, s * 0.07, 0.9, 1.15),
  ]);
}
/** Moita florida leve (duas bolhas de folhagem e florzinhas por cima). */
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
/** Hortênsia: uma moita grande com as bolas de flor (azul-lilás ou rosa) por cima (três, das grandes). */
function hydrangeaGeo(r, seed, tone) {
  const R = rng(seed);
  const parts = [foliageCluster([{ x: 0, y: r * 0.55, z: 0, r, sy: 0.72 }, { x: r * 0.4, y: r * 0.6, z: -r * 0.25, r: r * 0.75, sy: 0.7 }], { detail: 1, amp: 0.26, freq: 8, seed, dark: '#27461c', mid: '#46702b', light: '#7aa144' })];
  const base = C(tone);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + R() * 1.2, rr = (0.45 + 0.4 * R()) * r * 0.7;
    const ball = foliageCluster([{ x: Math.cos(a) * rr, y: r * 0.95 + R() * 0.05, z: Math.sin(a) * rr, r: 0.095 + R() * 0.035, sy: 0.85 }], { detail: 1, amp: 0.35, freq: 22, seed: seed + i, dark: '#' + base.clone().multiplyScalar(0.72).getHexString(), mid: '#' + base.getHexString(), light: '#' + base.clone().lerp(C('#ffffff'), 0.35).getHexString(), sunBias: 0.4, bottomDark: 0.3 });
    parts.push(ball);
  }
  return mergeGeometries(parts.map((g) => {
    const q = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(q.attributes)) if (!KEEP.includes(k)) q.deleteAttribute(k);
    return q;
  }));
}

/**
 * As plantas que se repetem saem de poucas variantes (o kit copia a geometria a cada peça: a mesma serve várias vezes),
 * para a montagem do quintal não pesar no celular (make(i) faz a variante i).
 * @param {number} n @param {(i: number) => THREE.BufferGeometry} make
 */
function variants(n, make) {
  /** @type {THREE.BufferGeometry[]} */
  const list = [];
  return (k) => { const i = ((k % n) + n) % n; return (list[i] ||= make(i)); };
}

/** Junta peças pintadas numa geometria só, como o kit, para os objetos que se mexem (uma malha cada). */
function createBaker() {
  const list = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    /**
     * @param {THREE.BufferGeometry} geo
     * @param {{ color?: any, x?: number, y?: number, z?: number, rx?: number, ry?: number, rz?: number, sx?: number, sy?: number, sz?: number }} [o]
     */
    add(geo, { color = '#ffffff', x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
      for (const k of Object.keys(geo.attributes)) if (!KEEP.includes(k)) geo.deleteAttribute(k);
      const g = geo.clone();
      if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
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

/**
 * Tubo atualizável (número fixo de pontos), com as pernas torcidas na cor: a cordinha do ferrolho e o laço da mangueira.
 * `ref`: o eixo de referência do anel (sem torção entre os pontos enquanto o tubo não fica paralelo a ele).
 */
function createCordTube(n, radial, base, ref0 = new THREE.Vector3(1, 0, 0), alt = new THREE.Vector3(0, 0, 1), twist = 1.6) {
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
      c.copy(base).multiplyScalar(0.74 + 0.26 * (0.5 + 0.5 * Math.cos((j / radial) * TAU * 2 + i * twist)));
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
      ref.copy(ref0);
      if (Math.abs(T.dot(ref)) > 0.95) ref.copy(alt);
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
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildQuintal(kit, root, L) {
  const R = rng(57);
  const WL = L.WALLS, t = WL.t, ht = t / 2, W = L.WALL;
  const Y = L.YARD, H = L.HOUSE, SD = L.SERVICE_DOOR, YG = L.YARD_GAP, BR = L.BRANCH, SB = L.SERVICE_BOLT;
  const XW = Y.x0 + ht, XE = Y.x1 - ht; // as faces de dentro: a parede da casa e o muro do quintal
  const ZS = L.LOT.z1 - W.t / 2, XO = L.LOT.x0 + W.t / 2; // o muro do lote, ao sul e a oeste (faces de dentro)
  const keep = (o) => { root.add(o); return o; };
  /** As três zonas do quintal (cada uma com as suas malhas, para o recorte da câmera). */
  const G = { norte: 'quintal', jardim: 'quintal-jardim', fundo: 'quintal-fundo' };
  const zoneOf = (z) => (z < 8.4 ? G.norte : z < 17.2 ? G.jardim : G.fundo);
  const addY = (geo, o) => kit.add(geo, { group: G.norte, ...o });
  const addJ = (geo, o) => kit.add(geo, { group: G.jardim, ...o });
  const addF = (geo, o) => kit.add(geo, { group: G.fundo, ...o });
  /** Põe na zona do ponto (x, z) da peça. */
  const addAt = (geo, o) => kit.add(geo, { group: zoneOf(o.z ?? 0), ...o });
  /** Pictograma numa face de normal (nx, nz), centrado em (x, y, z). */
  const art = (put, kind, s, col, x, y, z, nx = 0, nz = 1, extra = {}) => put(picto(kind, s), { color: col, x, y, z, ry: Math.atan2(nx, nz), ao: false, ...extra });
  /** O mesmo, deitado no chão (voltado para cima), girado de `ry`. */
  const artFlat = (put, kind, s, col, x, y, z, ry = 0, extra = {}) => put(picto(kind, s).rotateX(-Math.PI / 2), { color: col, x, y, z, ry, ao: false, ...extra });
  /** As sombras de contato do quintal (uma geometria por zona, no balde 'contact'). */
  const SH = { [G.norte]: decalLot(), [G.jardim]: decalLot(), [G.fundo]: decalLot() };
  const shade = (z) => SH[zoneOf(z)];

  // ================================================================ o muro do quintal (norte e leste)
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
  // o muro baixo do leste vai até o canto do muro sul do condomínio; dali para o sul, o muro alto do lote (world/base.js)
  yardWall(Y.x1, Y.z0 + ht, Y.x1, W.maxZ - 0.17);
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
    const Ls = SD.length - 0.02, nb = 6, T = 0.045, zc = -Ls / 2 - 0.01;
    for (let i = 0; i < nb; i++) b.add(slab(T, SD.h - 0.045, Ls / nb - 0.006), { color: vary(i % 2 ? '#7fa36b' : '#759a62', 0.05, 9), y: 0.03, z: -(i + 0.5) * (Ls / nb) - 0.01 });
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
    addY(rb(0.335, 0.24, 0.025, 0.006, 1), { color: vary('#a87445', 0.06, 14), x: px0 + 0.1725, y: BOLT_Y - 0.07, z: zF - 0.0125, ao: false });
    addY(slab(0.19, 0.22, 0.03), { color: '#8a6a48', x: px0 + 0.245, y: BOLT_Y - 0.06, z: zF + 0.012, ao: false });
    for (const gx of [px0 + 0.03, px0 + 0.25]) addY(rb(0.022, 0.056, 0.046, 0.006, 1), { color: IRON, x: gx, y: BOLT_Y - 0.028, z: zBar + 0.004, ao: false });
    addY(rodAB([EYE.x, BOLT_Y, zF - 0.02], [EYE.x, BOLT_Y, EYE.z + 0.012], 0.004, 5), { color: IRON, ao: false });
    addY(new THREE.TorusGeometry(0.012, 0.004, 5, 10).rotateY(Math.PI / 2), { color: IRON, x: EYE.x, y: EYE.y, z: EYE.z, ao: false });
    const rootP = [px0 + 0.3, 0.775, zF - 0.03];
    addY(rb(0.06, 0.08, 0.012, 0.004, 1), { color: IRON, x: rootP[0], y: 0.735, z: zF - 0.031, ao: false });
    addY(rodAB(rootP, [TIP.x, TIP.y, TIP.z], 0.011, 6), { color: IRON, ao: false });
    addY(rodAB([px0 + 0.07, 1.08, zF - 0.004], [lerp(rootP[0], TIP.x, 0.82), 0.78, lerp(rootP[2], TIP.z, 0.82)], 0.006, 5), { color: IRON, ao: false });
    addY(rb(0.05, 0.05, 0.012, 0.004, 1), { color: IRON, x: px0 + 0.07, y: 1.055, z: zF - 0.006, ao: false });
    addY(new THREE.TorusGeometry(0.014, 0.004, 5, 10).rotateY(Math.PI / 2), { color: IRON, x: TIP.x, y: TIP.y - 0.014, z: TIP.z, ao: false });
    addY(rodAB([EYE.x, EYE.y, EYE.z], [rootP[0], rootP[1] + 0.014, rootP[2]], 0.005, 5), { color: '#d8c18f', ao: false });
    addY(rodAB([rootP[0], rootP[1] + 0.014, rootP[2]], [TIP.x, TIP.y + 0.014, TIP.z], 0.005, 5), { color: '#d8c18f', ao: false });
  }
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
  const restEnd = () => _re.copy(REST).setZ(REST.z - boltSt.pull * SB.pull);
  function layoutBolt() {
    const g = gripSrc ? gripSrc() : null;
    const gk = g && g.k > 0 ? g.k : 0;
    _end.copy(restEnd());
    if (gk > 0) _end.lerp(g.pos, gk);
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
    ring.position.copy(_end);
    ring.quaternion.setFromUnitVectors(_up, _top.copy(_dir).negate());
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
    branch.add(bakedMesh(b, 'galho:tronco', { rough: 0.92 }));
  }
  const crown = new THREE.Group();
  crown.name = 'galho:copa-de-folhinhas';
  {
    const b = createBaker();
    const barkL = vary('#7d5a3a', 0.1, 31);
    const hb = BR.half, Rc = rng(41);
    /** @type {{ x: number, y: number, z: number, r: number }[]} */
    const blobs = [];
    const SPOTS = [[-0.72, -0.62, 0.17, 0], [-0.05, -0.7, 0.16, 0.02], [0.62, -0.6, 0.15, 0], [-0.7, 0.6, 0.16, 0],
      [0.05, 0.7, 0.15, 0.03], [0.66, 0.62, 0.14, 0], [-0.34, 0.02, 0.16, 0.16], [0.3, -0.08, 0.14, 0.2]];
    for (const [fx, fz, r0, up] of SPOTS) {
      const r = r0 + Rc() * 0.025;
      const lim = hb - r * 1.14 - 0.012;
      const x = Math.max(-lim, Math.min(lim, fx * hb)), z = Math.max(-lim, Math.min(lim, fz * hb));
      const y = Math.min(0.6 - r * 1.14, r * 0.95 + 0.06 + up + Rc() * 0.04);
      blobs.push({ x, y, z, r });
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

  // ================================================================ o chão do quintal: pátio, caminhos, capacho
  const EX = L.HOUSE_EXIT, exZ = (EX.z0 + EX.z1) / 2;
  /** As pedras de pisar (chatas, de beirada chanfrada): de onde a onde, no balde do chão (topo 2,1 cm). */
  const stones = [];
  const stonePath = (pts, gap = 0.58, r0 = 0.21, seed = 0) => {
    let carry = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      for (let s = carry; s < len; s += gap) {
        const k = stones.length;
        const side = (k % 2 ? 1 : -1) * 0.06;
        stones.push({ x: ax + ((bx - ax) * s) / len - ((bz - az) / len) * side, z: az + ((bz - az) * s) / len + ((bx - ax) / len) * side, r: r0 + hash(k, seed) * 0.05 });
        carry = s + gap - len;
      }
    }
  };
  // da porta dos fundos: para o norte (a passagem do jabuti) e para o sul (a horta do fundo, a torneira)
  stonePath([[-9.55, 18.25], [-8.45, 17.55]], 0.56, 0.2, 1);
  stonePath([[-10.3, 20.55], [-10.6, 21.4], [-12.4, 22.1], [-15.9, 22.2]], 0.6, 0.21, 2);
  stonePath([[-10.2, 21.5], [-9.8, 23.4]], 0.6, 0.2, 3);
  // no meio do gramadinho dos aspersores, as pedras ao lado das cabeças (na beirada, fora do caminho do jato)
  stonePath([[-8.62, 14.4], [-8.62, 8.9]], 0.62, 0.17, 4);
  // do registro à porta da área de serviço (a grama em volta da goiabeira fica livre para a pipa cair)
  stonePath([[-8.6, 7.6], [-8.3, 4.2], [(SD.hinge.x + SD.latchPost.x) / 2 + 0.2, Y.z0 + 1.45]], 0.6, 0.21, 5);
  {
    const STONE = ['#cfc6b6', '#c4baa8', '#d8cfbf', '#bfb5a2'];
    // seis contornos de pedra de raio 1 (cada pedra gira e escala o dela: a beirada chanfrada fica proporcional)
    const STONES = variants(6, (v) => {
      const Rs = rng(400 + v), sq = 0.76 + Rs() * 0.2;
      const pts = [];
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, rr = 0.84 + Rs() * 0.3; pts.push(new THREE.Vector2(Math.cos(a) * rr, -Math.sin(a) * rr * sq)); }
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.057, bevelEnabled: true, bevelThickness: 0.028, bevelSize: 0.057, bevelSegments: 1, curveSegments: 1 });
      return g.rotateX(-Math.PI / 2);
    });
    for (let k = 0; k < stones.length; k++) {
      const s = stones[k], Rs = rng(500 + k);
      addAt(STONES(k), { color: C(STONE[k % 4]).multiplyScalar(0.92 + Rs() * 0.14), slot: 'ground', x: s.x, y: 0.003, z: s.z, ry: Rs() * TAU, sx: s.r, sy: 0.21, sz: s.r, ao: false });
      shade(s.z).blob(s.x, s.z, s.r * 1.25, { a: 0.12, color: '#2a2a1c', seed: k });
    }
  }
  // o pátio de lajota da porta dos fundos (ladrilhos de barro, rente ao chão) e o capacho com a patinha
  {
    const x0 = XW + 0.02, x1 = -9.75, z0 = exZ - 1.15, z1 = exZ + 1.45;
    const nx = Math.round((x1 - x0) / 0.3), nz = Math.round((z1 - z0) / 0.3), cw = (x1 - x0) / nx, cd = (z1 - z0) / nz;
    const TER = ['#c9764f', '#bf6a45', '#d08259', '#b8663f'];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = x0 + (i + 0.5) * cw, cz = z0 + (j + 0.5) * cd;
        addF(slab(cw - 0.012, 0.012, cd - 0.012), { color: C(TER[Math.floor(hash(i, j) * 4)]).multiplyScalar(0.94 + 0.12 * hash(j, i)), slot: 'ground', x: cx, y: 0.001, z: cz, ao: false });
      }
    }
    addF(slab(x1 - x0 + 0.02, 0.006, z1 - z0 + 0.02), { color: '#8e7d68', slot: 'ground', x: (x0 + x1) / 2, y: 0.0005, z: (z0 + z1) / 2, ao: false });
    shade(exZ).rrect((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, 0.25, { a: 0.14, fill: false, color: '#3a2a1a' });
    addF(rb(0.5, 0.012, 0.86, 0.006, 1), { color: '#c98a55', slot: 'ground', x: XW + 0.32, y: 0.014, z: exZ, ao: false });
    artFlat(addF, 'pata', 0.3, '#8a5a3c', XW + 0.32, 0.0275, exZ, Math.PI / 2, { slot: 'ground' });
  }

  // ================================================================ a horta do meio (os canteiros elevados e o jabuti)
  const HR = L.HORTA_ROW, PS = HR.pass;
  /** Canteiro elevado de tábuas: a caixa de madeira com o arremate, a terra 3 cm abaixo da beirada. */
  const raisedBed = (put, x0, x1, z0, z1, h, seed = 0) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, th = 0.045;
    const wood = boards('#9a6b42', '#b07d4f', 0.105);
    put(new THREE.BoxGeometry(w, h, th, Math.max(1, Math.round(w / 0.4)), Math.max(1, Math.round(h / 0.105)), 1).translate(0, h / 2, 0), { color: wood, x: cx, z: z0 + th / 2 });
    put(new THREE.BoxGeometry(w, h, th, Math.max(1, Math.round(w / 0.4)), Math.max(1, Math.round(h / 0.105)), 1).translate(0, h / 2, 0), { color: wood, x: cx, z: z1 - th / 2 });
    put(new THREE.BoxGeometry(th, h, d - th * 2, 1, Math.max(1, Math.round(h / 0.105)), 1).translate(0, h / 2, 0), { color: wood, x: x0 + th / 2, z: cz });
    put(new THREE.BoxGeometry(th, h, d - th * 2, 1, Math.max(1, Math.round(h / 0.105)), 1).translate(0, h / 2, 0), { color: wood, x: x1 - th / 2, z: cz });
    // o arremate de cima e os mourõezinhos nos cantos (retos: o arredondado de 1 cm não aparece e eram 9× os triângulos)
    put(slab(w + 0.03, 0.025, 0.07), { color: '#c4935f', x: cx, y: h, z: z0 + 0.03, ao: false });
    put(slab(w + 0.03, 0.025, 0.07), { color: '#c4935f', x: cx, y: h, z: z1 - 0.03, ao: false });
    put(slab(0.07, 0.025, d - 0.12), { color: '#c4935f', x: x0 + 0.03, y: h, z: cz, ao: false });
    put(slab(0.07, 0.025, d - 0.12), { color: '#c4935f', x: x1 - 0.03, y: h, z: cz, ao: false });
    for (const [sx, sz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) put(slab(0.08, h + 0.06, 0.08), { color: '#7d5634', x: sx + (sx === x0 ? 0.035 : -0.035), z: sz + (sz === z0 ? 0.035 : -0.035) });
    put(slab(w - 0.1, 0.012, d - 0.1), { color: vary('#5a4030', 0.12, 13), slot: 'ground', x: cx, y: h - 0.03, z: cz, ao: false });
    shade(cz).rrect(cx, cz, w / 2, d / 2, 0.22, { a: 0.24, fill: false, color: '#2a1e12' });
  };
  raisedBed(addJ, XW, PS.x0 - 0.02, HR.z0, HR.z1, HR.h, 1);
  raisedBed(addJ, PS.x1 + 0.02, XE, HR.z0, HR.z1, HR.h, 2);
  {
    // os temperos e as pimenteiras (tudo dentro do canteiro), as estacas com os barbantes e a plaquinha de pictograma
    const Rh = rng(81);
    const top = HR.h - 0.03;
    const inBed = (x0, x1, n, fn) => { for (let i = 0; i < n; i++) fn(lerp(x0 + 0.24, x1 - 0.24, n > 1 ? i / (n - 1) : 0.5), i); };
    inBed(XW, PS.x0, 5, (x, i) => {
      const z = (HR.z0 + HR.z1) / 2 + (i % 2 ? 0.16 : -0.14);
      if (i % 2) addJ(bushGeo(0.15, 0.24, 300 + i, '#d6452f', 8), { color: null, slot: 'plant', x, y: top, z, ry: Rh() * 6 }); // pimenteira
      else addJ(lavender({ stems: 14, height: 0.34, seed: 70 + i, ...LAVENDER_LITE }), { color: null, slot: 'plant', x, y: top, z, ry: Rh() * 6 }); // alecrim
    });
    inBed(PS.x1, XE, 4, (x, i) => {
      const z = (HR.z0 + HR.z1) / 2 + (i % 2 ? -0.15 : 0.15);
      addJ(i % 2 ? boxwood(0.14, 90 + i) : smallFlowers({ count: 18, radius: 0.16, height: 0.16, color: '#fff6ee', seed: 95 + i }), { color: null, slot: 'plant', x, y: top, z, ry: Rh() * 6 });
    });
    // o cata-vento no canteiro do leste (gira com o vento, prop: catavento)
    addJ(rod(0.008, 0.62, 5), { color: '#e8e2d2', x: XE - 0.3, y: top + 0.31, z: HR.z0 + 0.25, ao: false });
  }
  // o cata-vento (o miolo gira devagar no vento da manhã)
  const pinwheel = new THREE.Group();
  pinwheel.name = 'quintal:cata-vento';
  pinwheel.position.set(XE - 0.3, HR.h - 0.03 + 0.62, HR.z0 + 0.25 - 0.012);
  {
    const b = createBaker();
    const cols = ['#e8475f', '#f2c230', '#3d8fd1', '#5cab63'];
    for (let i = 0; i < 4; i++) b.add(shapeXY([[0, 0], [0.09, 0.02], [0.03, 0.1]]), { color: cols[i], rz: (i / 4) * TAU });
    b.add(sphere(0.012, 8, 6), { color: '#fff8ec', z: 0.006 });
    const m = bakedMesh(b, 'cata-vento:helice', { rough: 0.6, cast: false });
    m.material.side = THREE.DoubleSide;
    pinwheel.add(m);
  }
  keep(pinwheel);
  // o jabuti (o Seu Bento): o modelo é de src/story/scene/jabuti.js; o puzzle move o object (e o colisor dele)
  const jabuti = createJabuti();
  jabuti.object.position.set(L.JABUTI.x, 0, L.JABUTI.z);
  jabuti.object.rotation.y = L.JABUTI.yaw;
  keep(jabuti.object);
  // a folha de alface que a Radhija leva na boca e larga para ele (carryKind: o item da boca)
  const leaf = new THREE.Group();
  leaf.name = 'alface:folha';
  leaf.userData.carryKind = 'carrot';
  /** @type {THREE.Mesh} */
  let leafMesh;
  {
    const s = new THREE.Shape();
    s.moveTo(0, -0.1);
    s.bezierCurveTo(0.09, -0.07, 0.1, 0.06, 0, 0.11);
    s.bezierCurveTo(-0.1, 0.06, -0.09, -0.07, 0, -0.1);
    const g = new THREE.ShapeGeometry(s, 6);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 40) * 0.008 + Math.abs(x) * 0.12 - Math.max(0, y) * 0.05); }
    g.computeVertexNormals();
    paint(g, (q) => C('#a9d36a').lerp(C('#5f9a35'), clamp01(Math.abs(q.x) * 6)).multiplyScalar(Math.abs(q.x) < 0.006 ? 1.15 : 1));
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
    leafMesh = m;
    m.name = 'alface:folha-malha';
    m.castShadow = true;
    m.rotation.x = -Math.PI / 2; // deitada (no chão); na boca, o encaixe gira junto com a cabeça
    leaf.add(m);
  }
  leaf.visible = false;
  keep(leaf);

  // ================================================================ o jardim de flores e a irrigação automática
  const SP = L.SPRINKLERS;
  // os dois canteiros compridos: mureta de tijolo, terra e as flores (tudo dentro do colisor)
  /**
   * As plantas da frente dos canteiros: lavanda, margaridas (brancas e amarelas) e gerânios, duas de cada (a lavanda e o
   * gerânio na versão leve das plantas das fases: a espiga e a moita com menos segmentos, o mesmo desenho).
   */
  const FRONT = variants(6, (v) => {
    const kind = Math.floor(v / 2), alt = v % 2;
    return kind === 0 ? lavender({ stems: 12, height: 0.36, seed: 700 + v, ...LAVENDER_LITE })
      : kind === 1 ? smallFlowers({ count: 16, radius: 0.15, height: 0.18, color: alt ? '#fff6ee' : '#f2c230', seed: 720 + v })
        : geranium({ radius: 0.15, height: 0.2, seed: 740 + v, flower: alt ? '#e8708a' : '#ff6a55', ...GERANIUM_LITE });
  });
  const HYDRANGEA = variants(4, (i) => hydrangeaGeo(0.31 + (i % 2) * 0.03, 600 + i * 7, i < 2 ? '#8ea6e8' : '#e7a3c6'));
  L.YARD_BEDS.forEach((bd, i) => {
    const o = new THREE.Color(), ba = C('#c98a6a'), bb = C('#b9785a');
    const x0 = bd.x - bd.hx + (i === 0 ? ht : 0), x1 = bd.x + bd.hx - (i === 1 ? ht : 0), z0 = bd.z - bd.hz, z1 = bd.z + bd.hz;
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2;
    // (só as laterais: a de cima fica dentro do arremate e a de baixo no chão; eram dois terços dos triângulos)
    const g = sidesBox(w, 0.26, d, Math.max(1, Math.round(w / 0.22)), 3, Math.max(1, Math.round(d / 0.22)));
    g.translate(0, 0.13, 0);
    addJ(g, { color: (p) => o.copy((Math.floor(p.y / 0.08) + Math.floor((p.x + p.z) / 0.22)) % 2 ? ba : bb), x: cx, z: bd.z });
    addJ(rb(w + 0.03, 0.03, d + 0.03, 0.01, 1), { color: '#d8c6a5', x: cx, y: 0.245, z: bd.z, ao: false });
    addJ(slab(w - 0.12, 0.012, d - 0.12), { color: vary('#5a4030', 0.1, 11), slot: 'ground', x: cx, y: 0.27, z: bd.z, ao: false });
    shade(bd.z).rrect(cx, bd.z, w / 2, d / 2, 0.22, { a: 0.22, fill: false, color: '#2a1e12' });
    // as plantas em duas fileiras (as hortênsias atrás, junto da parede; na frente, lavanda, margaridas e gerânios)
    const Rb = rng(500 + i);
    const back = i === 0 ? x0 + 0.48 : x1 - 0.48, front = i === 0 ? x1 - 0.4 : x0 + 0.4;
    const nb = Math.round(d / 0.95), nf = Math.round(d / 0.62);
    for (let k = 0; k < nb; k++) {
      const z = z0 + 0.5 + k * ((d - 1.0) / Math.max(1, nb - 1));
      addJ(HYDRANGEA((k % 2) * 2 + ((k + i) % 2)), { color: null, slot: 'foliage', x: back + (Rb() - 0.5) * 0.08, y: 0.27, z, ry: Rb() * 6 });
    }
    for (let k = 0; k < nf; k++) {
      const z = z0 + 0.3 + k * ((d - 0.6) / Math.max(1, nf - 1));
      const kind = (k + i) % 3;
      const plant = FRONT(kind * 2 + (k % 2));
      addJ(plant, { color: null, slot: 'plant', x: front + (Rb() - 0.5) * 0.12, y: 0.28, z, ry: Rb() * 6 });
    }
  });
  // o gramadinho do meio: um pouco mais verde e viçoso (a irrigação), num decalque macio
  SH[G.jardim].rrect((SP.lane.x0 + SP.lane.x1) / 2, (SP.lane.z0 + SP.lane.z1) / 2, (SP.lane.x1 - SP.lane.x0) / 2 - 0.1, (SP.lane.z1 - SP.lane.z0) / 2 - 0.1, 0.3, { a: 0.16, color: '#2f6a22' });
  // os aspersores de subir: a base verde rente ao chão (cenário) e a cabeça que sobe e desce (uma malha cada)
  const heads = SP.heads.map((hd) => {
    addJ(cyl(0.06, 0.066, 0.016, 14), { color: '#2f5f34', slot: 'ground', x: hd.x, y: 0.0, z: hd.z, ao: false });
    addJ(cyl(0.034, 0.034, 0.004, 12), { color: '#1d2a1f', slot: 'ground', x: hd.x, y: 0.016, z: hd.z, ao: false });
    const grp = new THREE.Group();
    grp.name = `aspersor-${hd.id}`;
    grp.userData.passThrough = true; // rente ao chão: as dogs pisam por cima (a Rhaenyra senta nele)
    grp.position.set(hd.x, 0, hd.z);
    const b = createBaker();
    b.add(cyl(0.022, 0.022, 0.1, 10), { color: '#3a3f44', y: -0.09 });
    b.add(cyl(0.032, 0.034, 0.024, 12), { color: '#2f5f34', y: 0.02 });
    b.add(cyl(0.012, 0.018, 0.012, 8), { color: '#c9a24a', y: 0.044 });
    const m = bakedMesh(b, `aspersor-${hd.id}:cabeca`, { rough: 0.5, metal: 0.2, cast: false });
    grp.add(m);
    keep(grp);
    return { ...hd, grp, up: 0, spray: 0, plugged: false, wet: 0 };
  });
  // o jato: gotas instanciadas (arcos do bocal até o chão), molhado no chão embaixo
  const DROPS = 44;
  const dropMat = new THREE.MeshBasicMaterial({ color: '#dff3ff', transparent: true, opacity: 0.78, depthWrite: false });
  // (cada gota, de 1 a 2 cm e esticada na vertical, é um octaedro: 8 triângulos em vez de 36)
  const drops = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), dropMat, DROPS * heads.length);
  drops.name = 'aspersores:gotas';
  drops.frustumCulled = false;
  drops.castShadow = false;
  keep(drops);
  const dropSeed = Array.from({ length: DROPS * heads.length }, (_, i) => ({ a: (i % DROPS) / DROPS * TAU + hash(i, 1) * 0.2, r: 0.45 + hash(i, 2) * (SP.r - 0.42), h: 0.32 + hash(i, 3) * 0.28, ph: hash(i, 4), s: 0.7 + hash(i, 5) * 0.6 }));
  const wetMat = new THREE.MeshBasicMaterial({ color: '#244a2a', transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const wetDiscs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), wetMat, heads.length);
  wetDiscs.name = 'aspersores:mancha-molhada';
  wetDiscs.frustumCulled = false;
  keep(wetDiscs);
  const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = new THREE.Vector3(), _p4 = new THREE.Vector3();
  let sprayIdle = false;
  function layoutSpray(time) {
    // tudo parado e seco (a irrigação desligada): nada a desenhar nem a atualizar
    let idle = true, anyWet = false;
    for (let i = 0; i < heads.length; i++) {
      const hd = heads[i];
      if (hd.spray > 0.01 || hd.wet > 0.001 || hd.up > 0.001) idle = false;
      if (hd.wet > 0.001) anyWet = true;
    }
    drops.visible = !idle;
    wetDiscs.visible = anyWet;
    if (idle && sprayIdle) { for (let i = 0; i < heads.length; i++) heads[i].grp.position.y = 0; return; }
    sprayIdle = idle;
    let k = 0;
    for (let hi = 0; hi < heads.length; hi++) {
      const hd = heads[hi];
      hd.grp.position.y = hd.up * 0.07;
      const leak = hd.plugged;
      const kk = hd.spray;
      for (let i = 0; i < DROPS; i++, k++) {
        const d = dropSeed[k];
        if (kk <= 0.01) { drops.setMatrixAt(k, _m4.makeScale(0, 0, 0)); continue; }
        const u = (time * (leak ? 2.2 : 1.25) + d.ph) % 1;
        const rr = (leak ? 0.22 + d.r * 0.25 : d.r) * u * (0.6 + 0.4 * kk);
        const hh = (leak ? 0.12 : d.h) * kk;
        const y = 0.1 + 4 * hh * u * (1 - u) - 0.06 * u;
        const sc = 0.012 * d.s * (1 - u * 0.4) * (leak ? 0.8 : 1);
        _p4.set(hd.x + Math.cos(d.a) * rr, Math.max(0.01, y), hd.z + Math.sin(d.a) * rr);
        _s4.set(sc, sc * 1.8, sc);
        drops.setMatrixAt(k, _m4.compose(_p4, _q4.identity(), _s4));
      }
      const wr = 0.25 + hd.wet * (SP.r - 0.1);
      wetDiscs.setMatrixAt(hi, _m4.compose(_p4.set(hd.x, 0.004, hd.z), _q4.identity(), _s4.set(wr, 1, wr)));
    }
    drops.instanceMatrix.needsUpdate = true;
    wetDiscs.instanceMatrix.needsUpdate = true;
  }
  // o programador da irrigação: a caixinha cinza numa estaca no canteiro do oeste, com as três gotas (a do sul embaixo)
  const timerAt = { x: PS.x0 - 0.62, z: HR.z0 + 0.08 };
  addJ(rod(0.014, 0.62, 6), { color: '#8a8f96', x: timerAt.x, y: HR.h + 0.2, z: timerAt.z + 0.05, ao: false });
  addJ(rb(0.24, 0.3, 0.08, 0.02, 2), { color: '#c9cdd2', x: timerAt.x, y: HR.h + 0.42, z: timerAt.z, ao: false });
  // a telinha escura das três gotas, na frente da caixa (as gotas 6 mm à frente dela)
  addJ(slab(0.2, 0.24, 0.012), { color: '#2a2f36', x: timerAt.x, y: HR.h + 0.45, z: timerAt.z - 0.046, ao: false });
  const lampOn = new THREE.MeshBasicMaterial({ color: '#6fd3ff' });
  const lampOff = new THREE.MeshBasicMaterial({ color: '#2b4a63' });
  /** As três gotas do programador (norte em cima, sul embaixo). */
  const lamps = SP.heads.map((hd, i) => {
    const m = new THREE.Mesh(picto('gota', 0.07), lampOff);
    m.name = `programador:gota-${hd.id}`;
    m.position.set(timerAt.x + 0.06 - i * 0.06, HR.h + 0.62 - i * 0.07, timerAt.z - 0.058);
    m.rotation.y = Math.PI;
    keep(m);
    return m;
  });
  // a caixinha do registro, no chão ao norte do jardim: a moldura de concreto, a tampa de ferro aberta em pé e a
  // alavanca vermelha lá dentro (gira quando a Radhija fecha)
  const VV = L.VALVE;
  addY(rb(VV.half * 2, 0.06, VV.half * 2, 0.012, 1), { color: '#b8b1a2', x: VV.x, z: VV.z, ao: false });
  addY(slab(VV.half * 2 - 0.08, 0.004, VV.half * 2 - 0.08), { color: '#3a3226', slot: 'ground', x: VV.x, y: 0.058, z: VV.z, ao: false });
  addY(rb(0.025, 0.36, VV.half * 2 - 0.02, 0.006, 1), { color: '#4d5156', x: VV.x - VV.half + 0.05, y: 0.06, z: VV.z, rz: 0.12, ao: false });
  const valveLever = new THREE.Group();
  valveLever.name = 'registro:alavanca';
  valveLever.userData.passThrough = true;
  valveLever.position.set(VV.x + 0.02, 0.05, VV.z);
  {
    const b = createBaker();
    b.add(cyl(0.02, 0.02, 0.03, 8), { color: '#9aa0a6' });
    b.add(rb(0.14, 0.018, 0.03, 0.008, 1), { color: '#d6453c', x: 0.06, y: 0.025 });
    valveLever.add(bakedMesh(b, 'registro:alavanca-malha', { rough: 0.5, metal: 0.3, cast: false }));
  }
  keep(valveLever);

  // ================================================================ o fundo: a horta, a torneira e o balde, a casinha
  const HT = L.HORTA;
  HT.beds.forEach((bd, i) => raisedBed(addF, bd.x0, bd.x1, bd.z0, bd.z1, bd.h, 10 + i));
  {
    const top = 0.27;
    const Rh = rng(91);
    const LETTUCES = variants(3, (i) => lettuce({ r: 0.115 + i * 0.012, seed: 200 + i * 3, ...LETTUCE_LITE }));
    const CARROTS = variants(3, (i) => carrotTops({ seed: 230 + i, height: 0.22, fronds: 5 }));
    const TOMATOES = variants(3, (i) => foliageCluster([{ x: 0, y: 0.32, z: 0, r: 0.17, sy: 1.4 }, { x: 0.04, y: 0.62, z: 0.02, r: 0.14, sy: 1.2 }], { detail: 1, amp: 0.35, freq: 10, seed: 260 + i, dark: '#25421a', mid: '#3f6a28', light: '#76a143' }));
    // o canteiro da alface: duas fileiras de pés (o grande, na beirada norte, é o prop)
    const A = HT.beds[0], LT = L.LETTUCE;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 2; j++) {
        const x = lerp(A.x0 + 0.32, A.x1 - 0.32, i / 5), z = A.z0 + 0.3 + j * 0.34;
        if (Math.hypot(x - LT.x, z - LT.z) < 0.4) continue;
        addF(LETTUCES(i * 2 + j), { color: null, slot: 'plant', x, y: top, z, ry: Rh() * 6 });
      }
    }
    // os legumes: cenouras (as ramas), couves e cebolinha
    const B2 = HT.beds[1];
    for (let i = 0; i < 9; i++) {
      const x = lerp(B2.x0 + 0.25, B2.x1 - 0.25, i / 8);
      addF(CARROTS(i), { color: null, slot: 'plant', x, y: top, z: B2.z0 + 0.28, ry: Rh() * 6 });
      if (i % 2 === 0) addF(foliageCluster([{ x: 0, y: 0.14, z: 0, r: 0.15, sy: 0.7 }], { detail: 1, amp: 0.4, freq: 9, seed: 240 + i, dark: '#2b4a35', mid: '#3f6b4a', light: '#6d9a74' }), { color: null, slot: 'foliage', x, y: top, z: B2.z1 - 0.3 });
      else addF(lavender({ stems: 10, height: 0.26, seed: 250 + i, ...LAVENDER_LITE }), { color: null, slot: 'plant', x, y: top, z: B2.z1 - 0.3, ry: Rh() * 6 });
    }
    // os tomates no muro: estacas de bambu, as ramas e os tomates (vermelhos e verdes)
    const T3 = HT.beds[2];
    const nt = Math.round((T3.x1 - T3.x0) / 0.7);
    for (let i = 0; i < nt; i++) {
      const x = lerp(T3.x0 + 0.3, T3.x1 - 0.3, i / Math.max(1, nt - 1)), z = (T3.z0 + T3.z1) / 2;
      addF(rod(0.012, 1.05, 5), { color: '#c9b27a', x, y: top + 0.5, z, ao: false });
      addF(TOMATOES(i), { color: null, slot: 'foliage', x, y: top, z, ry: i * 1.9 });
      // (os tomates, de 3 a 4 cm, sem sombra: a das ramas já cobre)
      for (let k = 0; k < 4; k++) {
        const a = Rh() * TAU;
        addF(sphere(0.032 + Rh() * 0.01, 7, 5), { color: k % 3 ? '#d93a2a' : '#7fae3a', slot: 'nocast', x: x + Math.cos(a) * 0.12, y: top + 0.25 + Rh() * 0.5, z: z + Math.sin(a) * 0.12 - 0.04, ao: false });
      }
    }
    // o regador azul em cima da beirada do canteiro dos legumes
    const wx = B2.x1 - 0.2, wz = B2.z0 + 0.12;
    addF(cyl(0.075, 0.09, 0.16, 12), { color: '#3d8fd1', x: wx, y: 0.3, z: wz, ao: false });
    addF(rodAB([wx + 0.06, 0.38, wz], [wx + 0.22, 0.46, wz], 0.012, 6), { color: '#3d8fd1', ao: false });
    addF(new THREE.TorusGeometry(0.055, 0.009, 5, 12, Math.PI).rotateY(Math.PI / 2), { color: '#3d8fd1', x: wx - 0.02, y: 0.44, z: wz, ao: false });
    // a composteira: caixote de ripas com a terra escura e folhas (ripas e mourões retos: 24 ripas)
    const CM = HT.compost;
    for (let k = 0; k < 6; k++) {
      const y = 0.06 + k * 0.15;
      for (const [dx, dz, w, d] of [[0, -CM.hz + 0.02, CM.hx * 2, 0.04], [0, CM.hz - 0.02, CM.hx * 2, 0.04], [-CM.hx + 0.02, 0, 0.04, CM.hz * 2 - 0.08], [CM.hx - 0.02, 0, 0.04, CM.hz * 2 - 0.08]]) {
        addF(slab(w, 0.11, d), { color: k % 2 ? '#8a6240' : '#9a7048', x: CM.x + dx, y, z: CM.z + dz, ao: false });
      }
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addF(slab(0.06, CM.h, 0.06), { color: '#6e4c30', x: CM.x + sx * (CM.hx - 0.03), z: CM.z + sz * (CM.hz - 0.03) });
    addF(foliageCluster([{ x: 0, y: CM.h - 0.18, z: 0, r: 0.3, sy: 0.35 }], { detail: 1, amp: 0.3, freq: 8, seed: 270, dark: '#3a2a1a', mid: '#5a4228', light: '#7d6a3a' }), { color: null, slot: 'foliage', x: CM.x, z: CM.z });
  }
  // o pé de alface grande (o prop): estica quando a Radhija puxa a folha sozinha; a folha de fora sai com a Rhaenyra
  // segurando
  const LT = L.LETTUCE;
  const bigLettuce = new THREE.Group();
  bigLettuce.name = 'alface:pe-grande';
  bigLettuce.position.set(LT.x, 0.27, LT.z);
  bigLettuce.add(new THREE.Mesh(lettuce({ r: 0.2, seed: 33 }), SLOTS.plant()));
  // a folha de fora, pendurada para fora da beirada (é ela que a Radhija morde)
  const outerLeaf = new THREE.Mesh(leafMesh.geometry, leafMesh.material);
  outerLeaf.name = 'alface:folha-de-fora';
  outerLeaf.rotation.set(-0.55, 0, 0);
  outerLeaf.position.set(0, -0.03, LT.bite.z - LT.z + 0.08);
  bigLettuce.add(outerLeaf);
  for (const o of bigLettuce.children) { o.castShadow = true; o.receiveShadow = true; }
  keep(bigLettuce);
  // mordendo, a folha de fora sai do pé e vai até a boca (esticando um pouco): sem isso, a Radhija puxava de longe
  const leafRest = outerLeaf.position.clone(), leafRot = outerLeaf.rotation.clone();
  const _lm = new THREE.Vector3(), _ld = new THREE.Vector3();
  /** @type {null | (() => ({ pos: THREE.Vector3, k: number } | null))} */
  let leafGrip = null;
  function layoutLeaf() {
    const g = leafGrip ? leafGrip() : null;
    const k = g && g.k > 0 ? g.k : 0;
    if (k <= 0 || !outerLeaf.visible) {
      outerLeaf.position.copy(leafRest);
      outerLeaf.rotation.copy(leafRot);
      outerLeaf.scale.setScalar(1);
      return;
    }
    bigLettuce.updateWorldMatrix(true, false);
    _lm.copy(g.pos);
    bigLettuce.worldToLocal(_lm);
    // a ponta da folha na boca: o meio dela entre o pé e a boca, virada para a boca, um pouco mais comprida
    outerLeaf.position.copy(leafRest).lerp(_lm, 0.5 * k);
    _ld.subVectors(_lm, leafRest);
    const len = _ld.length();
    outerLeaf.rotation.set(leafRot.x * (1 - k) - Math.atan2(_ld.y, Math.hypot(_ld.x, _ld.z)) * k, Math.atan2(_ld.x, _ld.z) * k, 0);
    outerLeaf.scale.set(1, 1, 1 + Math.min(0.6, len * 1.4) * k);
  }
  // a torneira de mola no cano (a base de concreto, o cano galvanizado, o corpo e o bico), a alavanca vermelha
  const TP = L.TAP;
  addF(rb(0.26, 0.06, 0.26, 0.015, 1), { color: '#b8b1a2', x: TP.x, z: TP.z });
  addF(cyl(0.026, 0.028, TP.lever.y - 0.04, 10), { color: '#9aa3a8', x: TP.x, y: 0.06, z: TP.z });
  addF(sphere(0.042, 10, 8), { color: '#c9a24a', x: TP.x, y: TP.lever.y - 0.06, z: TP.z, sy: 0.8, ao: false });
  addF(rodAB([TP.x, TP.lever.y - 0.07, TP.z], [TP.x + 0.1, TP.lever.y - 0.1, TP.z], 0.014, 8), { color: '#c9a24a', ao: false });
  addF(cyl(0.022, 0.018, 0.04, 8), { color: '#c9a24a', x: TP.x + 0.11, y: TP.lever.y - 0.14, z: TP.z, ao: false });
  addF(sphere(0.06, 10, 8), { color: '#8a6a48', x: TP.x, y: 0.045, z: TP.z, sy: 0.25, ao: false });
  shade(TP.z).disc(TP.x, TP.z, 0.14, 0.3, { a: 0.3 });
  const tapLever = new THREE.Group();
  tapLever.name = 'torneira:alavanca';
  tapLever.position.set(TP.lever.x, TP.lever.y, TP.lever.z);
  {
    const b = createBaker();
    b.add(cyl(0.016, 0.016, 0.03, 8), { color: '#c9a24a', y: -0.03 });
    b.add(rb(0.03, 0.022, 0.15, 0.008, 1), { color: '#d6453c', z: 0.07 });
    b.add(sphere(0.018, 8, 6), { color: '#d6453c', y: 0.011, z: 0.145 });
    tapLever.add(bakedMesh(b, 'torneira:alavanca-malha', { rough: 0.5, cast: false }));
  }
  keep(tapLever);
  /** A alavanca fechada aponta para o oeste (−x); aberta, gira 70° para o nordeste (para onde a mangueira puxa). */
  const LEVER_SHUT = -Math.PI / 2 - 0.15, LEVER_OPEN = LEVER_SHUT + 1.25;
  tapLever.rotation.y = LEVER_SHUT;
  const _tipW = new THREE.Vector3();
  const leverTip = () => { tapLever.updateWorldMatrix(true, false); return tapLever.localToWorld(_tipW.set(0, 0.011, 0.145)); };
  // o baldão de obra (azul, alto): as paredes de dentro e de fora, a borda, a alça; a água dentro e a bolinha
  const BK = L.BUCKET;
  const rTop = BK.r, rBot = BK.r - 0.05;
  {
    const outer = new THREE.CylinderGeometry(rTop, rBot, BK.h, 24, 3, true).translate(0, BK.h / 2, 0);
    addF(outer, { color: (p) => C('#3f78c2').multiplyScalar(0.82 + 0.18 * clamp01(p.y / BK.h)), x: BK.x, z: BK.z });
    const inner = new THREE.CylinderGeometry(rTop - 0.012, rBot - 0.012, BK.h - 0.02, 24, 1, true).translate(0, BK.h / 2 + 0.01, 0);
    inner.scale(-1, 1, 1); // as faces para dentro
    addF(inner, { color: '#2f5f9a', x: BK.x, z: BK.z, ao: false });
    addF(new THREE.CircleGeometry(rBot - 0.01, 20).rotateX(-Math.PI / 2), { color: '#25496f', x: BK.x, y: 0.02, z: BK.z, ao: false });
    addF(new THREE.TorusGeometry(rTop - 0.004, 0.014, 6, 28).rotateX(Math.PI / 2), { color: '#4d88d0', x: BK.x, y: BK.h, z: BK.z, ao: false });
    for (const y of [0.12, 0.32]) addF(new THREE.TorusGeometry(lerp(rBot, rTop, y / BK.h) + 0.004, 0.008, 5, 28).rotateX(Math.PI / 2), { color: '#3a6eb2', x: BK.x, y, z: BK.z, ao: false });
    addF(new THREE.TorusGeometry(rTop * 0.9, 0.008, 5, 18, Math.PI).rotateY(0.6), { color: '#9aa0a6', x: BK.x, y: BK.h, z: BK.z, ao: false });
    shade(BK.z).disc(BK.x, BK.z, rTop, 0.32, { a: 0.32 });
  }
  const waterMat = new THREE.MeshStandardMaterial({ color: '#6fb3dc', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.86 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), waterMat);
  water.name = 'baldao:agua';
  water.position.set(BK.x, 0.03, BK.z);
  water.visible = false;
  keep(water);
  // a bolinha de tênis (o brinquedo de meia da Rhaenyra): boia com a água
  const ball = new THREE.Group();
  ball.name = 'baldao:bolinha';
  {
    const g = new THREE.SphereGeometry(0.06, 16, 12);
    paint(g, (p) => {
      const seam = Math.abs(p.y - Math.sin(Math.atan2(p.z, p.x) * 2) * 0.03) < 0.006;
      return seam ? C('#f4f2e8') : C('#cfe04a').multiplyScalar(0.92 + 0.08 * Math.sin(p.x * 90) * Math.sin(p.z * 80));
    });
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.name = 'bolinha:malha';
    m.castShadow = true;
    ball.add(m);
  }
  ball.position.set(BK.x + 0.04, 0.08, BK.z - 0.03);
  keep(ball);
  // a mangueira: o trecho parado (do bico da torneira pelo chão até a borda do balde, com o esguicho preso nela)
  const HOSE_G = '#4f9a57';
  {
    const sx = TP.x + 0.11, sy = TP.lever.y - 0.16, nzr = BK.z;
    addF(tubeAlong([[sx, sy, TP.z], [sx + 0.02, 0.25, TP.z + 0.03], [sx + 0.06, 0.03, TP.z + 0.1], [TP.x + 0.6, 0.022, BK.z + 0.32], [BK.x - 0.7, 0.022, BK.z + 0.35],
      [BK.x - rTop - 0.12, 0.022, nzr + 0.18], [BK.x - rTop - 0.02, 0.2, nzr + 0.05], [BK.x - rTop + 0.01, BK.h + 0.04, nzr + 0.02], [BK.x - rTop + 0.08, BK.h + 0.03, nzr]], 0.017, 6, 60), { color: HOSE_G, ao: false });
    // o esguicho (latão) preso na borda, apontado para dentro
    addF(cyl(0.02, 0.014, 0.08, 8), { color: '#c9a24a', x: BK.x - rTop + 0.11, y: BK.h + 0.02, z: nzr, rz: Math.PI / 2 + 0.5, ao: false });
  }
  // o laço da mangueira enroscado na alavanca: da ponta da alavanca até o chão, o laço (onde a Radhija morde) e de volta
  // ao cano; mordido, o meio do laço vai na boca dela
  const hoseLoop = new THREE.Group();
  hoseLoop.name = 'mangueira-laco';
  hoseLoop.userData.passThrough = true;
  const NH = 22;
  const hoseTube = createCordTube(NH, 6, C(HOSE_G), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), 0.5);
  const hoseMesh = new THREE.Mesh(hoseTube.geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
  hoseMesh.name = 'mangueira-laco:tubo';
  hoseMesh.castShadow = true;
  hoseMesh.frustumCulled = false;
  hoseLoop.add(hoseMesh);
  keep(hoseLoop);
  const HS = L.HOSE;
  const hoseSt = { pull: 0, open: 0, dirty: true };
  /** @type {null | (() => ({ pos: THREE.Vector3, k: number } | null))} */
  let hoseGrip = null;
  const HP = Array.from({ length: NH }, () => new THREE.Vector3());
  const _hEnd = new THREE.Vector3(), _hA = new THREE.Vector3(), _hB = new THREE.Vector3(), _hC = new THREE.Vector3();
  const hoseCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  function layoutHose() {
    tapLever.rotation.y = LEVER_SHUT + (LEVER_OPEN - LEVER_SHUT) * hoseSt.open;
    const g = hoseGrip ? hoseGrip() : null;
    const gk = g && g.k > 0 ? g.k : 0;
    // parado: o meio do laço no chão, um pouco puxado para o lado da alavanca quando ela abre
    _hEnd.set(HS.bite.x, 0.03, HS.bite.z);
    if (gk > 0) _hEnd.lerp(g.pos, gk);
    const tip = leverTip();
    const P = hoseCurve.points;
    P[0].copy(tip);
    P[1].set(lerp(tip.x, TP.x + 0.08, 0.6), 0.32, lerp(tip.z, TP.z - 0.08, 0.6));
    _hA.set(TP.x + 0.14, 0.03, TP.z - 0.16);
    P[2].copy(_hA).lerp(_hEnd, gk * 0.3);
    // a volta do laço em U em torno do ponto mordido: uma perna de cada lado, a curva passando por ele
    _hB.copy(_hEnd).sub(_hA).setY(0);
    const dl = _hB.length() || 1;
    _hB.divideScalar(dl);
    _hC.set(-_hB.z, 0, _hB.x);
    P[3].copy(_hEnd).addScaledVector(_hC, 0.075).addScaledVector(_hB, -0.04);
    P[4].copy(_hEnd).addScaledVector(_hC, -0.075).addScaledVector(_hB, -0.04);
    P[3].y = Math.max(0.025, _hEnd.y - 0.01);
    P[4].y = Math.max(0.025, _hEnd.y - 0.03);
    P[5].set(TP.x + 0.2, 0.03, TP.z - 0.05).lerp(_hEnd, gk * 0.25);
    P[6].set(TP.x + 0.035, 0.22, TP.z - 0.01);
    for (let i = 0; i < NH; i++) hoseCurve.getPoint(i / (NH - 1), HP[i]);
    for (const p of HP) p.y = Math.max(0.02, p.y);
    hoseTube.update(HP, 0.017);
    hoseSt.dirty = false;
  }
  // a água: o fio do esguicho até a superfície e as rodinhas na água
  const streamMat = new THREE.MeshBasicMaterial({ color: '#cfeeff', transparent: true, opacity: 0.6, depthWrite: false });
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.016, 1, 8, 1, true).translate(0, -0.5, 0), streamMat);
  stream.name = 'baldao:fio-dagua';
  stream.position.set(BK.x - rTop + 0.15, BK.h, BK.z);
  stream.visible = false;
  keep(stream);
  const rippleMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 20).rotateX(-Math.PI / 2), rippleMat);
  ripple.name = 'baldao:rodinha';
  ripple.visible = false;
  keep(ripple);
  const bucketSt = { level: 0, flow: 0, full: false, t: 0 };
  /** A altura da água (0: vazio, 1: na borda). */
  const waterY = (k) => lerp(0.035, BK.h - 0.045, k);

  // a casinha (do quintal de antes; a porta para o oeste é estreita: só a Radhija entra)
  const DH = L.DOGHOUSE;
  {
    const o = new THREE.Color(), wa = C('#d98a5a'), wb = C('#cf7e50');
    const wallC = (p) => o.copy(Math.floor(p.y / 0.125) % 2 ? wa : wb).multiplyScalar(0.92 + 0.08 * clamp01(p.y / 0.4));
    const th = 0.1, hgt = DH.h - 0.25;
    const plankWall = (w, d) => { const g = new THREE.BoxGeometry(w, hgt, d, 1, 6, 1); g.translate(0, hgt / 2, 0); return g; };
    addF(plankWall(DH.hx * 2, th), { color: wallC, x: DH.x, z: DH.z - DH.hz, ao: false });
    addF(plankWall(DH.hx * 2, th), { color: wallC, x: DH.x, z: DH.z + DH.hz, ao: false });
    addF(plankWall(th, DH.hz * 2), { color: wallC, x: DH.x + DH.hx, z: DH.z, ao: false });
    const side = (DH.hz * 2 - DH.door) / 2;
    addF(plankWall(th, side), { color: wallC, x: DH.x - DH.hx, z: DH.z - DH.hz + side / 2, ao: false });
    addF(plankWall(th, side), { color: wallC, x: DH.x - DH.hx, z: DH.z + DH.hz - side / 2, ao: false });
    addF(rb(th, hgt - 0.62, DH.door + 0.02, 0.02, 1), { color: '#cf7e50', x: DH.x - DH.hx, y: 0.62, z: DH.z, ao: false });
    for (const s of [-1, 1]) addF(slab(0.03, 0.66, 0.05), { color: TRIM, x: DH.x - DH.hx - 0.06, z: DH.z + s * (DH.door / 2 + 0.028), ao: false });
    addF(slab(0.03, 0.05, DH.door + 0.11), { color: TRIM, x: DH.x - DH.hx - 0.06, y: 0.62, z: DH.z, ao: false });
    const roofG = gableRoof(DH.hz * 2 + 0.28, DH.hx * 2 + 0.28, 0.36);
    roofG.rotateY(Math.PI / 2);
    addF(roofG, { color: '#c4643f', x: DH.x, y: hgt, z: DH.z, ao: false });
    addF(rod(0.035, DH.hz * 2 + 0.3, 6), { color: '#a94f33', x: DH.x, y: hgt + 0.36, z: DH.z, rx: Math.PI / 2, ao: false });
    addF(cyl(DH.hx * 0.72, DH.hx * 0.72, 0.035, 20), { color: '#e8475f', x: DH.x + 0.04, y: 0.006, z: DH.z, ao: false });
    addF(rb(0.03, 0.16, 0.26, 0.01, 1), { color: '#fff6e6', x: DH.x - DH.hx - 0.06, y: 0.68, z: DH.z, ao: false });
    art(addF, 'pata', 0.12, '#8a5a3c', DH.x - DH.hx - 0.0785, 0.76, DH.z, -1, 0);
    shade(DH.z).rrect(DH.x, DH.z, DH.hx, DH.hz, 0.3, { a: 0.3 });
    // a tigela d'água e a de ração na frente da casinha (rentes ao chão)
    for (const [dz, col2] of /** @type {[number, string][]} */ ([[-0.46, '#e8475f'], [0.46, '#3d8fd1']])) {
      addF(cyl(0.09, 0.07, 0.05, 14), { color: col2, x: DH.x - DH.hx - 0.42, z: DH.z + dz, ao: false });
      addF(new THREE.CircleGeometry(0.07, 14).rotateX(-Math.PI / 2), { color: dz < 0 ? '#9a6a3a' : '#7fb8d8', slot: dz < 0 ? 'solid' : 'glass', x: DH.x - DH.hx - 0.42, y: 0.047, z: DH.z + dz, ao: false });
    }
  }
  // a mesa de jardim redonda com o guarda-sol listrado e as duas cadeiras de plástico
  const GT = L.GARDEN_TABLE;
  {
    addF(cyl(GT.r, GT.r, 0.03, 28), { color: '#f4efe4', x: GT.x, y: GT.h - 0.03, z: GT.z });
    addF(new THREE.TorusGeometry(GT.r, 0.016, 6, 28).rotateX(Math.PI / 2), { color: '#e2dccd', x: GT.x, y: GT.h - 0.015, z: GT.z, ao: false });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      addF(rodAB([GT.x + Math.cos(a) * 0.08, GT.h - 0.03, GT.z + Math.sin(a) * 0.08], [GT.x + Math.cos(a) * (GT.r - 0.12), 0.0, GT.z + Math.sin(a) * (GT.r - 0.12)], 0.016, 6), { color: '#e8e2d2' });
    }
    addF(rod(0.018, 2.1, 8), { color: '#f2f0ea', x: GT.x, y: 1.05, z: GT.z, ao: false });
    const canopy = new THREE.ConeGeometry(1.15, 0.36, 8, 1, true);
    paint(canopy, (p) => (Math.floor(((Math.atan2(p.z, p.x) / TAU) + 1) * 8) % 2 ? C('#fff6e6') : C('#e8735f')));
    addF(canopy, { color: null, x: GT.x, y: 2.02, z: GT.z, ao: false });
    addF(sphere(0.035, 8, 6), { color: '#f2f0ea', x: GT.x, y: 2.21, z: GT.z, ao: false });
    // o vaso de flor e o copo em cima da mesa
    addF(cyl(0.05, 0.04, 0.09, 10), { color: '#c9764f', x: GT.x + 0.15, y: GT.h, z: GT.z - 0.08, ao: false });
    addF(smallFlowers({ count: 12, radius: 0.07, height: 0.09, color: '#f2c230', seed: 77, leaf: true }), { color: null, slot: 'plant', x: GT.x + 0.15, y: GT.h + 0.09, z: GT.z - 0.08 });
    for (const ch of GT.chairs) {
      const b = (geo, o) => addF(geo, { color: '#fbfaf6', ...o });
      const cs = Math.cos(ch.yaw), sn = Math.sin(ch.yaw);
      const at = (lx, lz) => [ch.x + lx * cs + lz * sn, ch.z - lx * sn + lz * cs];
      const [sx2, sz2] = at(0, 0);
      b(rb(0.42, 0.04, 0.42, 0.03, 2), { x: sx2, y: 0.4, z: sz2, ry: ch.yaw });
      const [bx2, bz2] = at(0, -0.2);
      b(rb(0.42, 0.42, 0.04, 0.03, 2), { x: bx2, y: 0.44, z: bz2, ry: ch.yaw });
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        const [qx, qz] = at(lx, lz);
        b(cyl(0.018, 0.022, 0.4, 6), { x: qx, z: qz });
      }
      shade(ch.z).rrect(ch.x, ch.z, 0.2, 0.2, 0.16, { a: 0.18, ry: ch.yaw });
    }
    shade(GT.z).disc(GT.x, GT.z, GT.r * 0.6, 0.9, { a: 0.22 });
  }
  // o varalzinho do fundo: os dois postes em T e o pano, a toalha e a bandana
  const SL = L.SMALL_LINE;
  {
    for (const p of [SL.a, SL.b]) {
      addF(cyl(SL.postR, SL.postR, SL.h + 0.1, 8), { color: '#9aa0a6', x: p.x, z: p.z });
      addF(rodAB([p.x, SL.h + 0.05, p.z - 0.18], [p.x, SL.h + 0.05, p.z + 0.18], 0.014, 6), { color: '#9aa0a6', ao: false });
      shade(p.z).disc(p.x, p.z, SL.postR, 0.22, { a: 0.3 });
    }
    for (const dz of [-0.14, 0.14]) addF(rodAB([SL.a.x, SL.h + 0.05, SL.a.z + dz], [SL.b.x, SL.h + 0.05, SL.b.z + dz], 0.004, 4), { color: '#e8e2d2', ao: false });
    const cloth = (x, w, h, col1, col2, dz, kind) => {
      const g = new THREE.PlaneGeometry(w, h, 6, 6);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i); p.setZ(i, Math.sin(u * 9 + v * 3) * 0.02 * (0.5 - v / h)); }
      g.translate(0, -h / 2, 0);
      if (kind === 'tri') {
        for (let i = 0; i < p.count; i++) { const v = -p.getY(i) / h; p.setX(i, p.getX(i) * (1 - v)); }
      }
      g.computeVertexNormals();
      paint(g, (q) => (kind === 'faixas' && Math.floor((q.y + 5) / 0.08) % 3 === 0 ? C(col2) : C(col1)));
      addF(g, { color: null, slot: 'plant', x, y: SL.h + 0.045, z: SL.a.z + dz, ao: false });
      // os pregadores
      for (const s of [-1, 1]) addF(rb(0.015, 0.05, 0.012, 0.004, 1), { color: '#e8475f', x: x + s * w * 0.4, y: SL.h + 0.02, z: SL.a.z + dz, ao: false });
    };
    cloth(lerp(SL.a.x, SL.b.x, 0.22), 0.62, 0.42, '#7fc1e8', '#ffffff', -0.14, 'faixas');
    cloth(lerp(SL.a.x, SL.b.x, 0.55), 0.48, 0.32, '#e8475f', '#e8475f', 0.14, 'tri');
    cloth(lerp(SL.a.x, SL.b.x, 0.8), 0.55, 0.38, '#f2c230', '#fff6e6', -0.14, 'faixas');
    art(addF, 'pata', 0.12, '#ffffff', lerp(SL.a.x, SL.b.x, 0.55), SL.h - 0.06, SL.a.z + 0.165, 0, 1);
  }
  // brinquedos pelo gramado do fundo (rentes ao chão): a corda de nó, o ossinho de borracha e o disco
  {
    const toyAt = (x, z) => ({ x, z });
    const rope = toyAt(DH.x - 1.4, DH.z + 0.9);
    addF(tubeAlong([[rope.x - 0.22, 0.022, rope.z], [rope.x - 0.05, 0.022, rope.z + 0.06], [rope.x + 0.12, 0.022, rope.z - 0.03], [rope.x + 0.22, 0.022, rope.z + 0.02]], 0.018, 6, 16), { color: '#e8475f', ao: false });
    for (const dx of [-0.24, 0.24]) addF(sphere(0.032, 8, 6), { color: '#f2c230', x: rope.x + dx, y: 0.03, z: rope.z + (dx < 0 ? 0 : 0.02), ao: false });
    const bone = toyAt(GT.x - 1.3, GT.z + 1.6);
    addF(rb(0.16, 0.035, 0.045, 0.015, 1), { color: '#3d8fd1', x: bone.x, y: 0.0, z: bone.z, ry: 0.7, ao: false });
    for (const s of [-1, 1]) for (const t2 of [-1, 1]) addF(sphere(0.027, 8, 6), { color: '#3d8fd1', x: bone.x + s * 0.075 * Math.cos(0.7) + t2 * 0.02 * Math.sin(0.7), y: 0.027, z: bone.z - s * 0.075 * Math.sin(0.7) + t2 * 0.02 * Math.cos(0.7), ao: false });
    const fr = toyAt(-9.6, 23.9);
    addF(cyl(0.12, 0.12, 0.022, 20), { color: '#f2c230', x: fr.x, y: 0.0, z: fr.z, ao: false });
    addF(new THREE.TorusGeometry(0.115, 0.008, 5, 22).rotateX(Math.PI / 2), { color: '#e0a92a', x: fr.x, y: 0.024, z: fr.z, ao: false });
  }
  // o cantinho de cavar (a terra revirada e o osso meio enterrado), atrás da casinha
  {
    const cxd = DH.x - 0.2, czd = DH.z + DH.hz + 0.7;
    addF(flatBlob(0.5, 33), { color: '#7a5a3c', slot: 'ground', x: cxd, y: 0.006, z: czd });
    addF(flatBlob(0.26, 34), { color: '#5a4030', slot: 'ground', x: cxd + 0.05, y: 0.009, z: czd - 0.04 });
    addF(rb(0.2, 0.04, 0.05, 0.02, 1), { color: '#f4e3c8', x: cxd + 0.06, y: 0.011, z: czd - 0.03, ry: 0.7, rz: 0.12, ao: false });
  }
  // os vasos encostados nos muros (dentro dos canteiros e do colisor deles: os soltos ficam fora do caminho)
  {
    const pot = (put, x, z, s, flower) => {
      put(cyl(0.13 * s, 0.1 * s, 0.24 * s, 14), { color: '#c9764f', x, z });
      put(new THREE.TorusGeometry(0.13 * s, 0.018 * s, 5, 16).rotateX(Math.PI / 2), { color: '#b8663f', x, y: 0.24 * s, z, ao: false });
      put(geranium({ radius: 0.13 * s, height: 0.16 * s, seed: Math.round(x * 13 + z * 7), flower, ...GERANIUM_LITE }), { color: null, slot: 'plant', x, y: 0.22 * s, z });
    };
    // em cima das muretas da horta do meio (em cima do colisor delas)
    pot(addJ, XW + 0.32, HR.z1 - 0.25, 0.8, '#ff6a55');
    pot(addJ, XE - 0.32, HR.z1 - 0.25, 0.8, '#e8708a');
    // nos cantos dos canteiros de flores
    pot(addJ, L.YARD_BEDS[0].x + L.YARD_BEDS[0].hx - 0.25, L.YARD_BEDS[0].z - L.YARD_BEDS[0].hz + 0.25, 0.9, '#b9a3e3');
    pot(addJ, L.YARD_BEDS[1].x - L.YARD_BEDS[1].hx + 0.25, L.YARD_BEDS[1].z + L.YARD_BEDS[1].hz - 0.25, 0.9, '#ff6a55');
  }

  // ================================================================ o norte: a goiabeira com a pipa presa
  const GV = L.GUAVA;
  {
    // o tronco liso e manchado da goiabeira (fino: o colisor), a terra e as raízes rasas em volta
    const bark = (p) => C('#a7835d').lerp(C('#c9a986'), clamp01(0.5 + 0.5 * Math.sin(p.y * 9 + p.x * 40) * Math.sin(p.z * 37))).multiplyScalar(0.85 + 0.15 * clamp01(p.y));
    addY(limbAB([0, 0, 0], [0.04, 1.35, 0.02], GV.r - 0.02, GV.r * 0.6, 9), { color: bark, x: GV.x, z: GV.z });
    addY(flatBlob(0.62, 88), { color: '#5a4030', slot: 'ground', x: GV.x, y: 0.005, z: GV.z });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + 0.3;
      addY(limbAB([0, 0.03, 0], [Math.cos(a) * 0.42, 0.006, Math.sin(a) * 0.42], 0.05, 0.012, 5), { color: '#8f6c4a', x: GV.x, z: GV.z, ao: false });
    }
    shade(GV.z).disc(GV.x, GV.z, 0.2, 1.4, { a: 0.26 });
  }
  // a copa (balança com o empurrão: o pé fica no chão, a copa gira em volta da base) e a pipa presa nela
  const guavaTop = new THREE.Group();
  guavaTop.name = 'goiabeira:copa';
  guavaTop.position.set(GV.x, 0, GV.z);
  {
    const b = createBaker();
    const bark = vary('#9c7a55', 0.08, 17);
    // os galhos abertos (a goiabeira é baixa e esparramada) e as goiabas
    const tips = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.5, up = 1.3 + (k % 2) * 0.25;
      const tip = [Math.cos(a) * 1.05, GV.crown.y + 0.15 + (k % 3) * 0.12, Math.sin(a) * 1.05];
      tips.push(tip);
      b.add(limbAB([0.04, up - 0.05, 0.02], tip, 0.065, 0.025, 7), { color: bark });
    }
    b.add(limbAB([0.03, 1.2, 0.02], [0.05, 1.5, 0.02], GV.r * 0.6, GV.r * 0.5, 8), { color: bark });
    const Rg = rng(311);
    for (let k = 0; k < 14; k++) {
      const a = Rg() * TAU, rr = 0.6 + Rg() * 0.7;
      b.add(sphere(0.045, 7, 5), { color: Rg() < 0.4 ? '#d6c45a' : '#8fb547', x: Math.cos(a) * rr, y: GV.crown.y - 0.25 + Rg() * 0.3, z: Math.sin(a) * rr, sy: 1.2 });
    }
    guavaTop.add(bakedMesh(b, 'goiabeira:galhos', { rough: 0.85 }));
    const blobs = [{ x: 0, y: GV.crown.y + 0.25, z: 0, r: 0.95, sy: 0.6 }];
    for (const tp of tips) blobs.push({ x: tp[0] * 0.85, y: tp[1] + 0.1, z: tp[2] * 0.85, r: 0.62, sy: 0.62 });
    const foliage = foliageCluster(blobs, { detail: 2, amp: 0.22, freq: 2.6, seed: 17, dark: '#2f4d1e', mid: '#557f2f', light: '#94b850' });
    const lv = new THREE.Mesh(foliage, SLOTS.foliage());
    lv.name = 'goiabeira:folhas';
    lv.castShadow = true;
    lv.receiveShadow = true;
    guavaTop.add(lv);
    guavaTop.add(leafSkin(foliage, { count: 520, size: 0.11, seed: 23, material: SLOTS.plant(), minNormalY: -0.3 }));
  }
  keep(guavaTop);
  // a PIPA: o papel de seda em losango (amarelo, vermelho e azul), as varetas, a linha enroscada nos galhos e a rabiola
  // de laços com as penas cinza e o anel de borracha laranja enroscados (a pista)
  const kite = new THREE.Group();
  kite.name = 'pipa';
  const KH = 0.62, KW = 0.48;
  const kiteBody = new THREE.Group();
  kite.add(kiteBody);
  {
    const b = createBaker();
    const quarter = (pts, col) => b.add(shapeXY(pts), { color: col });
    quarter([[0, 0], [0, KH * 0.62], [-KW / 2, KH * 0.12]], '#f2c230');
    quarter([[0, 0], [KW / 2, KH * 0.12], [0, KH * 0.62]], '#e8475f');
    quarter([[0, 0], [-KW / 2, KH * 0.12], [0, -KH * 0.38]], '#3d8fd1');
    quarter([[0, 0], [0, -KH * 0.38], [KW / 2, KH * 0.12]], '#f2c230');
    b.add(disc(0.06, 0, 0.1, 1, 1, 14).translate(0, 0, 0.002), { color: '#fff6e6' });
    b.add(rodAB([0, -KH * 0.38, -0.006], [0, KH * 0.62, -0.006], 0.004, 4), { color: '#c9a974' });
    b.add(rodAB([-KW / 2, KH * 0.12, -0.006], [KW / 2, KH * 0.12, -0.006], 0.004, 4), { color: '#c9a974' });
    const m = bakedMesh(b, 'pipa:papel', { rough: 0.7, cast: true });
    m.material.side = THREE.DoubleSide;
    kiteBody.add(m);
  }
  // a rabiola: laços em fila numa linha (instâncias), com as penas e o anel de borracha no meio dela
  const TAILN = 12;
  const bowGeo = (() => { const g = mergeGeometries([shapeXY([[0, 0], [-0.05, 0.022], [-0.05, -0.022]]), shapeXY([[0, 0], [0.05, -0.022], [0.05, 0.022]])]); g.computeVertexNormals(); return g; })();
  const bows = new THREE.InstancedMesh(bowGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: THREE.DoubleSide }), TAILN);
  bows.name = 'pipa:rabiola';
  bows.frustumCulled = false;
  const bowCols = ['#e8475f', '#f2c230', '#3d8fd1'].map(C);
  for (let i = 0; i < TAILN; i++) bows.setColorAt(i, bowCols[i % 3]);
  kite.add(bows);
  const tailLine = createCordTube(TAILN + 1, 4, C('#f4f0e2'), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), 0);
  const tailMesh = new THREE.Mesh(tailLine.geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  tailMesh.name = 'pipa:linha-da-rabiola';
  tailMesh.frustumCulled = false;
  kite.add(tailMesh);
  const clueBits = new THREE.Group();
  clueBits.name = 'pipa:penas-e-anel';
  {
    const b = createBaker();
    for (const [dx, rz] of [[-0.03, 0.5], [0.025, -0.4]]) {
      const f = new THREE.ConeGeometry(0.018, 0.12, 6).scale(1, 1, 0.25);
      b.add(f, { color: '#a9b2c2', x: dx, y: -0.05, rz });
    }
    b.add(new THREE.TorusGeometry(0.035, 0.009, 6, 16), { color: '#f07a1a', y: 0.0, rx: 0.4 });
    clueBits.add(bakedMesh(b, 'pipa:pista', { rough: 0.6, cast: false }));
  }
  kite.add(clueBits);
  const TP0 = Array.from({ length: TAILN + 1 }, () => new THREE.Vector3());
  /** A rabiola: pendurada da ponta de baixo da pipa (no galho) ou deitada no chão em S (no chão). */
  function layoutTail(hangK) {
    for (let i = 0; i <= TAILN; i++) {
      const u = i / TAILN;
      // pendurada: cai quase reta, com uma barriguinha; no chão: um S comprido atrás da pipa
      const hx = Math.sin(u * 2.2) * 0.12, hy = -KH * 0.38 - u * 1.05, hz = -0.03 * u;
      const gx = Math.sin(u * 5.0) * 0.16, gy = -KH * 0.38 - u * 1.1, gz = 0;
      TP0[i].set(lerp(gx, hx, hangK), lerp(gy, hy, hangK), lerp(gz, hz, hangK));
    }
    tailLine.update(TP0, 0.0025);
    for (let i = 0; i < TAILN; i++) {
      const p = TP0[i + 1];
      // o laço gira no plano do papel (deitado no chão, fica deitado)
      _m4.compose(_p4.copy(p), _q4.setFromAxisAngle(_zAxis, (i % 2 ? 0.5 : -0.4) + Math.sin(i * 1.7) * 0.3), _s4.set(1, 1, 1));
      bows.setMatrixAt(i, _m4);
    }
    bows.instanceMatrix.needsUpdate = true;
    bows.computeBoundingBox();
    bows.computeBoundingSphere();
    clueBits.position.copy(TP0[Math.round(TAILN * 0.55)]);
  }
  layoutTail(1);
  const kiteSt = { phase: 'arvore', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), q0: new THREE.Quaternion(), qLand: new THREE.Quaternion(), dur: 2.4, landYaw: 0, glow: 0 };
  const _qx = new THREE.Quaternion(), _qy = new THREE.Quaternion();
  /** A pipa deitada no chão, de barriga para cima, virada para `yaw`. */
  const landQuat = (yaw, out) => out.copy(_qy.setFromAxisAngle(_up, yaw)).multiply(_qx.setFromAxisAngle(_va.set(1, 0, 0), -Math.PI / 2));
  /** A altura da pipa no chão (acima das pedras, rente à grama). */
  const KITE_Y = 0.024;
  /** Presa no alto da copa (filha dela: balança junto), inclinada como quem enroscou. */
  function kiteHome() {
    guavaTop.add(kite);
    kite.position.set(GV.kite.x - GV.x, GV.kite.y, GV.kite.z - GV.z);
    kite.rotation.set(-0.35, 0.6, 0.5);
    kiteSt.phase = 'arvore';
    kiteSt.t = 0;
    layoutTail(1);
  }
  kiteHome();
  // a linha da pipa enroscada nos galhos (parada, fina)
  addY(tubeAlong([[GV.kite.x, GV.kite.y + 0.3, GV.kite.z], [GV.x + 0.3, GV.crown.y + 0.4, GV.z + 0.2], [GV.x + 0.85, GV.crown.y + 0.15, GV.z - 0.3], [GV.x + 1.2, GV.crown.y - 0.2, GV.z - 0.6]], 0.0025, 3, 16), { color: '#f4f0e2', ao: false });
  // o brilhinho da pista quando a pipa está no chão (duas faíscas que giram devagar, sem luz)
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: 0.8, depthWrite: false });
  const spark = new THREE.Mesh(shapeXY([[0, 0.08], [0.018, 0.018], [0.08, 0], [0.018, -0.018], [0, -0.08], [-0.018, -0.018], [-0.08, 0], [-0.018, 0.018]]), sparkMat);
  spark.name = 'pipa:brilho-da-pista';
  spark.visible = false;
  keep(spark);
  const guavaSt = { a: 0, dx: 1, dz: 0 };

  // ================================================================ borboletas (a vida do jardim)
  // Três borboletas voando em laços por cima dos canteiros (acima das plantas mais altas e longe da copa, do varalzinho e
  // do guarda-sol): uma malha instanciada de asas (duas por borboleta), batendo; nada é alocado por quadro.
  const BUTTERFLIES = [
    { cx: -8.3, cz: 11.8, rx: 2.0, rz: 2.6, y: 1.12, fy: 0.13, sp: 0.42, ph: 0.0, col: '#f2c230' },
    { cx: -17.0, cz: 23.35, rx: 3.6, rz: 0.75, y: 1.08, fy: 0.12, sp: 0.33, ph: 2.1, col: '#ff8a5c' },
    { cx: -9.5, cz: 23.0, rx: 0.9, rz: 1.3, y: 1.02, fy: 0.1, sp: 0.5, ph: 4.0, col: '#ffffff' },
  ];
  const wingGeo = (() => { const g = shapeXY([[0, 0], [0.045, 0.03], [0.05, -0.005], [0.028, -0.032], [0.006, -0.012]]); g.rotateX(-Math.PI / 2); return g; })();
  const wings = new THREE.InstancedMesh(wingGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide }), BUTTERFLIES.length * 2);
  wings.name = 'quintal:borboletas';
  wings.frustumCulled = false;
  wings.castShadow = false;
  BUTTERFLIES.forEach((b, i) => { wings.setColorAt(i * 2, C(b.col)); wings.setColorAt(i * 2 + 1, C(b.col)); });
  keep(wings);
  const _bq = new THREE.Quaternion(), _bw = new THREE.Quaternion(), _be = new THREE.Euler();
  function flyButterflies(time) {
    for (let i = 0; i < BUTTERFLIES.length; i++) {
      const b = BUTTERFLIES[i];
      const a = time * b.sp + b.ph;
      const x = b.cx + Math.sin(a) * b.rx, z = b.cz + Math.sin(a * 2) * b.rz;
      const y = b.y + Math.sin(time * 1.7 + b.ph) * b.fy;
      // o rumo segue o laço (a derivada do caminho) e as asas batem rápido
      const yaw = Math.atan2(Math.cos(a) * b.rx, Math.cos(a * 2) * 2 * b.rz);
      const flap = Math.sin(time * 22 + b.ph * 3) * 0.9;
      _bq.setFromAxisAngle(_up, yaw);
      for (let w = 0; w < 2; w++) {
        const side = w === 0 ? 1 : -1;
        _be.set(0, 0, side * (0.25 + flap));
        _bw.setFromEuler(_be);
        _q4.copy(_bq).multiply(_bw);
        _m4.compose(_p4.set(x, y, z), _q4, _s4.set(side, 1, 1));
        wings.setMatrixAt(i * 2 + w, _m4);
      }
    }
    wings.instanceMatrix.needsUpdate = true;
  }
  flyButterflies(0);

  // ================================================================ capim, florzinhas, folhas, gravetos e poças
  /** Onde não nasce capim: nas pedras e no pátio, nos canteiros, na frente das portas, nas peças dos puzzles. */
  // só os colisores do lote e da beirada dele (o capim e as folhas do quintal nunca saem dele)
  const COLS = L.STATIC_COLLIDERS.filter((/** @type {any} */ c) => {
    const x0 = c.shape === 'segment' ? Math.min(c.ax, c.bx) - c.t : c.x - (c.r ?? c.hx), x1 = c.shape === 'segment' ? Math.max(c.ax, c.bx) + c.t : c.x + (c.r ?? c.hx);
    const z0 = c.shape === 'segment' ? Math.min(c.az, c.bz) - c.t : c.z - (c.r ?? c.hz), z1 = c.shape === 'segment' ? Math.max(c.az, c.bz) + c.t : c.z + (c.r ?? c.hz);
    return x1 > L.LOT.x0 - 0.5 && x0 < L.LOT.x1 + 0.5 && z1 > L.LOT.z0 - 0.5 && z0 < L.LOT.z1 + 0.5;
  });
  const hitsCollider = (x, z, pad) => COLS.some((c) => {
    if (c.shape === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + pad;
    if (c.shape === 'box') return Math.abs(x - c.x) < c.hx + pad && Math.abs(z - c.z) < c.hz + pad;
    const vx = c.bx - c.ax, vz = c.bz - c.az;
    const tt = Math.max(0, Math.min(1, ((x - c.ax) * vx + (z - c.az) * vz) / (vx * vx + vz * vz || 1)));
    return Math.hypot(x - c.ax - vx * tt, z - c.az - vz * tt) < (c.t ?? 0.05) + pad;
  });
  const inYard = (x, z) => (x > XW + 0.1 && x < XE - 0.1 && z > Y.z0 + ht + 0.1 && z < ZS - 0.1) || (x > XO + 0.1 && x <= XW + 0.1 && z > H.z1 + ht + 0.1 && z < ZS - 0.1);
  const keepOut = [
    { x: (SD.hinge.x + SD.latchPost.x) / 2, z: SD.hinge.z + 0.5, r: 1.15 }, { x: L.TILES.x, z: L.TILES.z, r: 0.9 }, { x: BR.start.x - 0.5, z: BR.start.z, r: 0.95 },
    { x: XW + 0.2, z: exZ, r: 1.2 }, { x: L.JABUTI.x, z: L.JABUTI.z + 0.8, r: 0.65 }, { x: L.JABUTI.eat.x, z: L.JABUTI.eat.z, r: 0.75 },
    { x: L.HOSE.bite.x, z: L.HOSE.bite.z, r: 0.75 }, { x: LT.bite.x, z: LT.bite.z - 0.3, r: 0.5 }, ...SP.heads.map((hd) => ({ x: hd.x, z: hd.z, r: 0.22 })),
    ...L.KITE.land.map((p) => ({ x: p.x, z: p.z, r: 0.55 })), { x: L.VALVE.at.x, z: L.VALVE.at.z, r: 0.4 },
  ];
  const onStone = (x, z) => stones.some((s) => Math.hypot(x - s.x, z - s.z) < s.r + 0.05);
  const patio = (x, z) => x < -9.7 && z > exZ - 1.2 && z < exZ + 1.5;
  const blocked = (x, z, pad = 0.06) => !inYard(x, z) || hitsCollider(x, z, pad) || onStone(x, z) || patio(x, z) || keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r);
  {
    const Rg = rng(123);
    const blade = new THREE.BufferGeometry();
    {
      // (quatro folhas por touceira: são 2 000 touceiras)
      const pos = [], col = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4, h = 0.1 + (i % 3) * 0.035, w = 0.014, lx = Math.cos(a) * 0.05, lz = Math.sin(a) * 0.05;
        const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
        pos.push(px, 0, pz, -px, 0, -pz, lx, h, lz);
        col.push(0.55, 0.62, 0.5, 0.55, 0.62, 0.5, 1, 1, 1);
      }
      blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      blade.computeVertexNormals();
    }
    const AREA = { x0: XO, x1: XE, z0: Y.z0, z1: ZS };
    const NG = 2000;
    const grass = new THREE.InstancedMesh(blade, SLOTS.plant(), NG);
    grass.name = 'recanto:capim-do-quintal';
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), cg = new THREE.Color();
    let n = 0;
    for (let i = 0; i < NG * 4 && n < NG; i++) {
      // mais junto dos muros, das paredes e dos canteiros; o resto pelo gramado
      let x = lerp(AREA.x0, AREA.x1, Rg()), z = lerp(AREA.z0, AREA.z1, Rg());
      if (Rg() < 0.4) { if (Rg() < 0.5) x = Rg() < 0.5 ? XE - 0.12 - Rg() * 0.3 : XW + 0.12 + Rg() * 0.3; else z = Rg() < 0.5 ? ZS - 0.12 - Rg() * 0.3 : Y.z0 + 0.25 + Rg() * 0.3; }
      if (blocked(x, z)) continue;
      const s = 0.55 + Rg() * 0.8;
      m4.compose(p.set(x, 0, z), q.setFromAxisAngle(_up, Rg() * TAU), sc.set(s, s * (0.8 + Rg() * 0.5), s));
      grass.setMatrixAt(n, m4);
      grass.setColorAt(n, cg.setRGB(0.4 + Rg() * 0.15, 0.62 + Rg() * 0.18, 0.22 + Rg() * 0.1));
      n++;
    }
    grass.count = n;
    grass.castShadow = false;
    grass.receiveShadow = true;
    keep(grass);
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
    const NF = 170;
    const flowers = new THREE.InstancedMesh(fl, SLOTS.plant(), NF);
    flowers.name = 'recanto:florzinhas-do-quintal';
    const tones = [C('#fff6ee'), C('#f2c230'), C('#f4b8c8'), C('#b9a3e3')];
    n = 0;
    for (let i = 0; i < NF * 5 && n < NF; i++) {
      const x = lerp(AREA.x0, AREA.x1, Rg()), z = lerp(AREA.z0, AREA.z1, Rg());
      if (blocked(x, z, 0.1)) continue;
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
  {
    // as poças da chuva (as do jardim ficam maiores perto dos aspersores) e as folhas e gravetos da tempestade
    const Rl = rng(9);
    for (const [px, pz, pr, ps] of [[-10.6, 7.0, 0.36, 0.7], [-6.0, 3.6, 0.3, 0.8], [-10.9, 22.6, 0.42, 0.65], [-7.6, 23.9, 0.34, 0.75], [-20.4, 24.4, 0.4, 0.6]]) {
      if (blocked(px, pz, pr * 0.5)) continue;
      addAt(flatBlob(pr, Math.round(px * 10)), { color: '#8fb6c9', slot: 'glass', x: px, y: 0.008, z: pz, sz: ps, ry: Rl() * 3 });
    }
    const tones = ['#7c9a3a', '#a2b84a', '#c9a23a', '#8a6a2e', '#5f8a34'];
    const LEAVES = variants(5, (v) => leafGeo(0.1 + v * 0.012, 0.032 + (v % 2) * 0.008));
    for (let i = 0; i < 140; i++) {
      const near = i < 34;
      const x = near ? BR.start.x - 1.6 + (Rl() - 0.5) * 4.2 : lerp(XO + 0.4, XE - 0.4, Rl());
      const z = near ? Y.z0 + 0.4 + Rl() * 2.6 : lerp(Y.z0 + 0.5, ZS - 0.4, Rl());
      if (blocked(x, z, 0.02)) continue;
      addAt(LEAVES(i), { color: tones[i % tones.length], slot: 'plant', x, y: 0.008, z, ry: Rl() * TAU, sx: 0.85 + Rl() * 0.3, sz: 0.85 + Rl() * 0.3 });
    }
    for (let i = 0; i < 9; i++) {
      const x = BR.start.x - 1.2 + (Rl() - 0.5) * 3.6, z = Y.z0 + 0.5 + Rl() * 2.4, a = Rl() * TAU, len = 0.14 + Rl() * 0.16;
      if (blocked(x, z, 0.1)) continue;
      addY(rodAB([x, 0.016, z], [x + Math.cos(a) * len, 0.02, z + Math.sin(a) * len], 0.008, 4), { color: '#6b4a2e', ao: false });
    }
    // as goiabas caídas embaixo da goiabeira
    for (let i = 0; i < 6; i++) {
      const a = Rl() * TAU, rr = 0.5 + Rl() * 0.6, x = GV.x + Math.cos(a) * rr, z = GV.z + Math.sin(a) * rr;
      if (blocked(x, z, 0.04)) continue;
      addY(sphere(0.04, 8, 6), { color: Rl() < 0.5 ? '#c9b450' : '#8fae48', x, y: 0.03, z, sy: 0.8, ao: false });
    }
  }
  // as sombras de contato do quintal (uma geometria por zona)
  for (const [grp, D] of Object.entries(SH)) {
    // o pé dos muros do quintal e da casa (a faixa macia)
    if (grp === G.norte) { D.strip(Y.x0 + ht, Y.z0 + ht, Y.x1 - ht, Y.z0 + ht, 0, 1, 0.35, { a: 0.18, color: '#2a2018' }); D.strip(XE, Y.z0 + 0.2, XE, 8.4, -1, 0, 0.3, { a: 0.16, color: '#2a2018' }); }
    if (grp === G.fundo) { D.strip(XO, ZS, XE, ZS, 0, -1, 0.35, { a: 0.18, color: '#2a2018' }); D.strip(XE, 17.2, XE, ZS, -1, 0, 0.32, { a: 0.18, color: '#2a2018' }); }
    const geo = D.geometry();
    if (geo) kit.add(geo, { color: null, slot: 'contact', group: grp, ao: false });
  }

  // ================================================================ a API dos props (quintalPuzzles.js anima)
  const quintal = {
    /** Os aspersores: a cabeça sobe (up 0..1), o jato (spray 0..1) e, tampado, o vazamento baixo em volta. */
    sprinklers: {
      /** @param {string} id @param {number} up @param {number} spray @param {boolean} plugged */
      set(id, up, spray, plugged) {
        for (let i = 0; i < heads.length; i++) {
          const hd = heads[i];
          if (hd.id !== id) continue;
          hd.up = clamp01(up);
          hd.spray = clamp01(spray);
          hd.plugged = !!plugged;
        }
      },
      /** O programador: a gota de cada um acende enquanto ele está ligado. */
      setLit(id, on) { for (let i = 0; i < SP.heads.length; i++) if (SP.heads[i].id === id) lamps[i].material = on ? lampOn : lampOff; },
      get state() { return heads.map((h) => ({ id: h.id, up: +h.up.toFixed(2), spray: +h.spray.toFixed(2), plugged: h.plugged })); },
    },
    /** A alavanca do registro (0: aberto, a irrigação corre; 1: fechado). */
    valve: { setClosed(k) { valveLever.rotation.y = -clamp01(k) * Math.PI / 2; } },
    jabuti,
    /** A folha de alface (vai na boca da Radhija e, depois, no chão para o jabuti) e o pé grande. */
    lettuce: {
      leaf,
      /** O pé grande esticando para o lado de quem puxa (k 0..1) e a folha de fora (some quando sai). */
      setPull(k, dirX = 0, dirZ = -1) {
        const kk = clamp01(k);
        bigLettuce.rotation.set(dirZ * kk * 0.35, 0, -dirX * kk * 0.35);
        bigLettuce.position.y = 0.27 + kk * 0.02;
      },
      setTorn(on) { outerLeaf.visible = !on; },
      /** Mordendo: src() → { pos (a boca, no mundo), k (0..1) } ou null; enquanto morde, a folha de fora vai até a boca. */
      setGrip(src) { leafGrip = src || null; if (!leafGrip) layoutLeaf(); },
      /** A folha no chão (para o jabuti), deitada, com o tamanho que sobrou (0..1). */
      putLeaf(x, z, size = 1) {
        root.attach(leaf);
        leaf.visible = size > 0.02;
        leaf.position.set(x, 0.012, z);
        leaf.rotation.set(0, 0.4, 0);
        leaf.scale.setScalar(Math.max(0.02, size));
      },
      hideLeaf() { root.attach(leaf); leaf.visible = false; leaf.scale.setScalar(1); },
    },
    /** A mangueira e o balde. */
    hose: {
      /** Mordendo: src() → { pos, k } (a boca, no mundo) ou null. */
      setGrip(src) { hoseGrip = src || null; hoseSt.dirty = true; },
      /** A alavanca da torneira (0: fechada; 1: aberta). */
      setOpen(k) { const v = clamp01(k); if (v !== hoseSt.open) { hoseSt.open = v; hoseSt.dirty = true; } },
      /** Onde o meio do laço está, parado no chão. */
      bitePoint() { return { x: HS.bite.x, y: 0.03, z: HS.bite.z }; },
      /** Onde o laço está desenhado agora (na boca de quem morde; os testes conferem). */
      tip() { return { x: _hEnd.x, y: _hEnd.y, z: _hEnd.z }; },
      /** A ponta da alavanca (de onde a mangueira puxa), no mundo. */
      leverPoint() { const p = leverTip(); return { x: p.x, y: p.y, z: p.z }; },
    },
    bucket: {
      /** A água (0..1 da altura) e se ela está correndo do esguicho. */
      setLevel(k) { bucketSt.level = clamp01(k); },
      setFlow(on) { bucketSt.flow = on ? 1 : 0; },
      /** A bolinha (o brinquedo de meia) no alto da água; `got`: pegaram (some). */
      ball,
      ballY() { return waterY(bucketSt.level) + 0.035; },
    },
    /** A goiabeira balança (a: o ângulo, na direção (dx, dz) do empurrão). */
    guava: { setSway(a, dx = 1, dz = 0) { guavaSt.a = a; const l = Math.hypot(dx, dz) || 1; guavaSt.dx = dx / l; guavaSt.dz = dz / l; } },
    /** A pipa: presa ('arvore'), caindo ('cai', do alto até `to`) e no chão ('chao'); o brilho da pista. */
    kite: {
      object: kite,
      get phase() { return kiteSt.phase; },
      /** Começa a cair até (x, z) (o puzzle escolheu o lugar livre). */
      drop(x, z) {
        if (kiteSt.phase !== 'arvore') return;
        root.attach(kite);
        kiteSt.from.copy(kite.position);
        kiteSt.q0.copy(kite.quaternion);
        kiteSt.to.set(x, KITE_Y, z);
        kiteSt.landYaw = Math.atan2(x - GV.x, z - GV.z);
        landQuat(kiteSt.landYaw, kiteSt.qLand);
        kiteSt.phase = 'cai';
        kiteSt.t = 0;
      },
      /** Já no chão em (x, z) (pular a queda: testes e ?stage=). */
      land(x, z) {
        root.attach(kite);
        kiteSt.to.set(x, KITE_Y, z);
        kiteSt.landYaw = Math.atan2(x - GV.x, z - GV.z);
        landQuat(kiteSt.landYaw, kiteSt.qLand);
        kiteSt.phase = 'chao';
        placeLanded();
      },
      /** O brilhinho da pista (0..1). */
      setGlow(k) { kiteSt.glow = clamp01(k); },
      /** Quanto falta para pousar (0..1 da queda). */
      get fall() { return kiteSt.phase === 'cai' ? Math.min(1, kiteSt.t / kiteSt.dur) : kiteSt.phase === 'chao' ? 1 : 0; },
    },
  };
  /** A pipa deitada no chão, de barriga para cima, com a rabiola em S atrás dela. */
  function placeLanded() {
    kite.position.copy(kiteSt.to);
    kite.quaternion.copy(kiteSt.qLand);
    layoutTail(0);
  }
  function stepKite(dt, time) {
    if (kiteSt.phase === 'cai') {
      kiteSt.t += dt;
      const k = Math.min(1, kiteSt.t / kiteSt.dur);
      // cai bailando: de um lado para o outro, cada vez mais devagar, e assenta deitada
      const e = 1 - (1 - k) * (1 - k);
      const sway = Math.sin(kiteSt.t * 5.2) * 0.3 * (1 - k);
      kite.position.set(lerp(kiteSt.from.x, kiteSt.to.x, e) + sway * Math.cos(kiteSt.landYaw), lerp(kiteSt.from.y, kiteSt.to.y, k * k * 0.4 + e * 0.6), lerp(kiteSt.from.z, kiteSt.to.z, e) - sway * Math.sin(kiteSt.landYaw));
      kite.quaternion.copy(kiteSt.q0);
      kite.rotateX(-k * 1.0 + Math.sin(kiteSt.t * 6) * 0.35 * (1 - k));
      kite.rotateZ(Math.sin(kiteSt.t * 4.4) * 0.4 * (1 - k));
      // no fim, assenta deitada (sem pulo para a pose do chão)
      const land = Math.max(0, (k - 0.62) / 0.38);
      kite.quaternion.slerp(kiteSt.qLand, land * land * (3 - 2 * land));
      layoutTail(1 - k);
      if (k >= 1) { kiteSt.phase = 'chao'; placeLanded(); }
    }
    spark.visible = kiteSt.phase === 'chao' && kiteSt.glow > 0.01;
    if (spark.visible) {
      spark.position.set(kite.position.x, 0.22 + Math.sin(time * 2.4) * 0.03, kite.position.z);
      spark.rotation.set(0, time * 0.8, 0);
      sparkMat.opacity = 0.5 + 0.35 * Math.sin(time * 3.1) * kiteSt.glow;
      spark.scale.setScalar(0.8 + 0.25 * Math.sin(time * 2.0));
    }
  }

  return {
    props: {
      serviceDoor: { object: sdoor, setOpen: setSdoor },
      branch: { object: branch, setPos: setBranch },
      serviceBolt,
      quintal,
    },
    seeThrough: [sdoor, branch, guavaTop],
    signs: [],
    update(dt, time) {
      if (boltSt.dirty || gripSrc) layoutBolt();
      if (hoseSt.dirty || hoseGrip) layoutHose();
      if (leafGrip) layoutLeaf();
      // o cata-vento gira com o vento (rajadas lentas)
      pinwheel.rotation.z -= dt * (2.2 + Math.sin(time * 0.37) * 1.4);
      // os aspersores, o molhado no chão e as gotas
      for (const hd of heads) hd.wet = Math.max(0, Math.min(1, hd.wet + (hd.spray > 0.2 && !hd.plugged ? dt * 0.8 : -dt * 0.05)));
      layoutSpray(time);
      // o balde: a água sobe, a bolinha boia com ela (balançando de leve), o fio d'água e as rodinhas
      water.visible = bucketSt.level > 0.01;
      const wy = waterY(bucketSt.level);
      const wr = lerp(rBot, rTop, wy / BK.h) - 0.014;
      water.position.y = wy;
      water.scale.set(wr, 1, wr);
      stream.visible = bucketSt.flow > 0;
      if (stream.visible) { stream.scale.set(1, Math.max(0.05, BK.h - wy), 1); stream.rotation.z = Math.sin(time * 9) * 0.02; }
      ripple.visible = stream.visible && bucketSt.level > 0.02;
      if (ripple.visible) {
        const u = (time * 1.6) % 1;
        ripple.position.set(stream.position.x, wy + 0.002, stream.position.z);
        ripple.scale.setScalar(0.03 + u * 0.12);
        rippleMat.opacity = 0.45 * (1 - u);
      }
      if (ball.visible) {
        const by = waterY(bucketSt.level) + 0.035 + (bucketSt.level > 0.02 ? Math.sin(time * 2.3) * 0.006 : 0);
        ball.position.y = Math.max(0.08, by);
        ball.rotation.y += dt * 0.3 * bucketSt.level;
      }
      // a goiabeira balança com o empurrão (a copa gira em volta do pé) e a pipa, se ainda está lá, vai junto
      guavaTop.rotation.set(guavaSt.dz * guavaSt.a * 0.6, 0, -guavaSt.dx * guavaSt.a * 0.6);
      stepKite(dt, time);
      flyButterflies(time);
      if (jabuti.object.visible) jabuti.update(dt, time);
    },
    reset() {
      setSdoor(0);
      setBranch(BR.start.x, BR.start.z);
      gripSrc = null;
      serviceBolt.setPull(0);
      serviceBolt.setSlid(0);
      layoutBolt();
      for (const hd of heads) { hd.up = 0; hd.spray = 0; hd.plugged = false; hd.wet = 0; }
      for (const l of lamps) l.material = lampOff;
      valveLever.rotation.y = 0;
      jabuti.object.position.set(L.JABUTI.x, 0, L.JABUTI.z);
      jabuti.object.rotation.y = L.JABUTI.yaw;
      jabuti.object.visible = true;
      jabuti.reset();
      quintal.lettuce.hideLeaf();
      quintal.lettuce.setPull(0);
      quintal.lettuce.setTorn(false);
      hoseGrip = null;
      leafGrip = null;
      layoutLeaf();
      hoseSt.open = 0;
      layoutHose();
      bucketSt.level = 0;
      bucketSt.flow = 0;
      ball.visible = true;
      ball.position.set(BK.x + 0.04, 0.08, BK.z - 0.03);
      guavaSt.a = 0;
      kiteHome();
      kiteSt.glow = 0;
      spark.visible = false;
    },
    // as malhas ficam na árvore: o escopo de recursos da área libera tudo depois deste dispose
    dispose() { gripSrc = null; hoseGrip = null; jabuti.dispose(); },
  };
}
