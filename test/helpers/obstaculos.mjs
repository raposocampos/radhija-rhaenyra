// Objetos do cenário que as dogs atravessam: pedaços de desenho na altura do corpo delas (acima do chão, até perto do
// alto da cabeça) onde o círculo de colisão de uma dog, num lugar livre, entra mais que `tol`. É o vaso, a perna da
// tábua de passar, a pilha de sabonetes sem colisor (retorno do usuário na prévia do PR #48). Funciona com a cena de
// verdade (test/helpers/worldBuild.mjs) e o mundo de colisão do jogo (estáticos do layout e dinâmicos do puzzle).
//
//   const achados = findLooseObstacles(root, world, { dogs });   // [{ center, box, y, depth, sizes, meshes, suggest }]
//
// Como: a superfície de cada malha vira pontos a cada `step` m (só os da faixa de altura), agrupados numa grade de
// `cell` m. Um ponto conta se existe um centro LIVRE para a dog (sem encostar em colisor nem nos limites, fora de
// buraco sem entrada) a menos de r − tol dele: ela consegue ficar com o corpo por cima do desenho. Pontos encostados
// viram um achado (um objeto), com a caixa no chão e um colisor sugerido (círculo ou caixa que cobre o desenho por perto).
//
// Fica de fora: malhas invisíveis, instanciadas com 0 instâncias, com esqueleto (bichos), linhas, pontos e sprites;
// materiais que não desenham; e o que estiver marcado num pai com `userData.walkable` (coisas baixas de pisar,
// src/game/ground.js), `userData.passThrough` (atravessável de propósito) ou `userData.carryKind` (item que vai na
// boca: a fase cuida dele).
import * as THREE from 'three';
import { penCollider } from '../../src/game/collision.js';

/** O objeto e todos os pais estão visíveis? */
function visibleChain(o) {
  for (let p = o; p; p = p.parent) if (p.visible === false) return false;
  return true;
}

/** O objeto ou um pai tem a marca `key` em userData? */
export function markedUp(o, key) {
  for (let p = o; p; p = p.parent) if (p.userData?.[key]) return true;
  return false;
}

/** O material desenha alguma coisa sólida? Efeitos (raio de sol, brilho: transparentes sem profundidade) não contam. */
function drawn(m) {
  if (!m || m.visible === false || m.colorWrite === false) return false;
  if (m.transparent && (m.opacity <= 0.02 || m.depthWrite === false)) return false;
  return m.blending !== THREE.AdditiveBlending;
}

/** Nome legível: caminho de nomes até a raiz, tipo da geometria e cor do material. */
const _box = new THREE.Box3();
export function meshLabel(mesh) {
  const names = [];
  for (let p = mesh; p && names.length < 4; p = p.parent) if (p.name) names.push(p.name);
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const col = mat?.color ? ` #${mat.color.getHexString()}` : '';
  _box.setFromObject(mesh);
  const f = (v) => v.toArray().map((x) => +x.toFixed(2)).join(', ');
  return `${names.reverse().join('>') || 'malha'} ${mesh.geometry?.type || ''}${col} [centro ${f(_box.getCenter(new THREE.Vector3()))} · tamanho ${f(_box.getSize(new THREE.Vector3()))}]`;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _m = new THREE.Matrix4();

/**
 * Pontos da superfície de `mesh` (no mundo) com y em [yMin, yMax] e (x, z) dentro de `region`, a cada ~step m.
 * @param {THREE.Mesh} mesh @param {(x: number, y: number, z: number) => void} visit
 */
function sampleSurface(mesh, { yMin, yMax, step, region }, visit) {
  const geo = mesh.geometry;
  const pos = geo?.attributes?.position;
  if (!pos) return;
  const index = geo.index;
  const tris = Math.floor((index ? index.count : pos.count) / 3);
  /** @type {THREE.Matrix4[]} */
  const mats = [];
  const im = /** @type {THREE.InstancedMesh} */ (/** @type {unknown} */ (mesh));
  if (im.isInstancedMesh) {
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, _m);
      mats.push(_m.clone().premultiply(mesh.matrixWorld));
    }
  } else mats.push(mesh.matrixWorld);
  for (const m4 of mats) {
    for (let t = 0; t < tris; t++) {
      const ia = index ? index.getX(3 * t) : 3 * t;
      const ib = index ? index.getX(3 * t + 1) : 3 * t + 1;
      const ic = index ? index.getX(3 * t + 2) : 3 * t + 2;
      _a.fromBufferAttribute(pos, ia).applyMatrix4(m4);
      _b.fromBufferAttribute(pos, ib).applyMatrix4(m4);
      _c.fromBufferAttribute(pos, ic).applyMatrix4(m4);
      if (Math.max(_a.y, _b.y, _c.y) < yMin || Math.min(_a.y, _b.y, _c.y) > yMax) continue;
      if (Math.max(_a.x, _b.x, _c.x) < region.minX || Math.min(_a.x, _b.x, _c.x) > region.maxX) continue;
      if (Math.max(_a.z, _b.z, _c.z) < region.minZ || Math.min(_a.z, _b.z, _c.z) > region.maxZ) continue;
      // grade com a densidade de cada lado (triângulo comprido e fino não vira milhares de pontos repetidos)
      const nu = Math.max(1, Math.ceil(_a.distanceTo(_b) / step)), nv = Math.max(1, Math.ceil(_a.distanceTo(_c) / step));
      for (let i = 0; i <= nu; i++) {
        for (let j = 0; j <= nv * (1 - i / nu) + 1e-9; j++) {
          const u = i / nu, v = j / nv;
          const y = _a.y + (_b.y - _a.y) * u + (_c.y - _a.y) * v;
          if (y < yMin || y > yMax) continue;
          const x = _a.x + (_b.x - _a.x) * u + (_c.x - _a.x) * v;
          const z = _a.z + (_b.z - _a.z) * u + (_c.z - _a.z) * v;
          if (x < region.minX || x > region.maxX || z < region.minZ || z > region.maxZ) continue;
          visit(x, y, z);
        }
      }
    }
  }
}

/** O colisor vale para a dog de tamanho `size` (mesma regra do mundo de colisão, sem o modo da companheira)? */
const applies = (c, size) => c.enabled !== false && (c.blocks === 'all' || c.blocks === size) && !c.companionOnly;

const inRect = (e, x, z) => x >= e.minX && x <= e.maxX && z >= e.minZ && z <= e.maxZ;

/**
 * Buracos sem entrada: o `except` de um colisor que fica todo dentro da forma dele (o miolo da bandeja da fase 6, onde
 * as cargas assentam). Andando, a dog nunca chega lá; um centro "livre" ali não conta. (O da ponte da fase 3 passa da
 * água dos dois lados: ali a dog anda.)
 */
function enclosedHoles(world) {
  const out = [];
  for (const list of [world.statics, world.dynamics]) {
    for (const c of list) {
      const e = c.except;
      if (!e) continue;
      const corners = [[e.minX, e.minZ], [e.minX, e.maxZ], [e.maxX, e.minZ], [e.maxX, e.maxZ]];
      if (corners.every(([x, z]) => penCollider(x, z, 0, c))) out.push(c);
    }
  }
  return out;
}

/**
 * Até onde o círculo de uma dog (num centro livre) entra no ponto (x, z): r − distância do centro livre mais perto
 * achado; 0 se nenhum centro livre fica a menos de r − tol. Procura em anéis em volta do ponto.
 */
function reachDepth(world, x, z, dog, tol, holes) {
  const reach = dog.r - tol;
  if (reach <= 0) return 0;
  // fundo dentro de um colisor: nenhum centro livre chega perto o bastante (atalho)
  for (const list of [world.statics, world.dynamics]) {
    for (const c of list) {
      if (!applies(c, dog.size) || c.except) continue;
      const p = penCollider(x, z, 0, c);
      if (p && p.depth >= reach) return 0;
    }
  }
  // o anel de fora fica um pouco antes de r − tol: encostar só até a tolerância não conta
  for (const k of [0, 0.2, 0.4, 0.6, 0.8, 0.92]) {
    const d = reach * k;
    const n = k === 0 ? 1 : 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (holes.some((c) => applies(c, dog.size) && inRect(c.except, px, pz))) continue;
      if (!world.overlaps(px, pz, dog.r, dog.size)) return dog.r - d;
    }
  }
  return 0;
}

/**
 * @param {THREE.Object3D} root cena montada da fase
 * @param {ReturnType<typeof import('../../src/game/collision.js').createCollisionWorld>} world
 * @param {{ dogs: { name: string, size: 'small' | 'large', r: number, yMax: number }[], yMin?: number, tol?: number,
 *   step?: number, cell?: number, link?: number, skip?: (mesh: THREE.Mesh) => boolean }} opts
 *   dogs: raio de colisão e altura até onde o corpo dela vai (yMax); yMin: até aqui a pata passa por cima (tapete,
 *   degrau, mangueira, chinelo);
 *   tol: quanto a dog pode encostar sem contar (pelo, ponta de folha); step: distância entre pontos da superfície;
 *   cell: grade dos pontos; link: distância que junta pontos num mesmo achado; skip: malhas a ignorar.
 */
export function findLooseObstacles(root, world, { dogs, yMin = 0.08, tol = 0.06, step = 0.035, cell = 0.02, link = 0.07, skip = null }) {
  const yMax = Math.max(...dogs.map((d) => d.yMax));
  const holes = enclosedHoles(world);
  const B = world.bounds;
  const pad = Math.max(...dogs.map((d) => d.r));
  const region = { minX: B.minX - pad, maxX: B.maxX + pad, minZ: B.minZ - pad, maxZ: B.maxZ + pad };
  root.updateMatrixWorld(true);
  /** @type {THREE.Mesh[]} */
  const meshes = [];
  root.traverse((/** @type {any} */ o) => {
    if (!o.isMesh || o.isSkinnedMesh || !visibleChain(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some(drawn)) return;
    if (o.isInstancedMesh && o.count === 0) return;
    if (markedUp(o, 'walkable') || markedUp(o, 'passThrough') || markedUp(o, 'carryKind')) return;
    if (skip?.(o)) return;
    meshes.push(o);
  });

  // grade de pontos: chave → { x, z, y0, y1, meshes: Map<índice, nº de pontos> }
  /** @type {Map<string, { i: number, j: number, y0: number, y1: number, meshes: Map<number, number> }>} */
  const cells = new Map();
  meshes.forEach((mesh, mi) => {
    sampleSurface(mesh, { yMin, yMax, step, region }, (x, y, z) => {
      const i = Math.round(x / cell), j = Math.round(z / cell);
      const key = `${i},${j}`;
      let c = cells.get(key);
      if (!c) cells.set(key, (c = { i, j, y0: y, y1: y, meshes: new Map() }));
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      c.meshes.set(mi, (c.meshes.get(mi) || 0) + 1);
    });
  });

  // quais pontos uma dog alcança (e quanto entra)
  /** @type {{ i: number, j: number, x: number, z: number, y0: number, y1: number, depth: number, sizes: Set<string>, meshes: Map<number, number> }[]} */
  const hit = [];
  for (const c of cells.values()) {
    const x = c.i * cell, z = c.j * cell;
    let depth = 0;
    const sizes = new Set();
    for (const dog of dogs) {
      if (c.y0 > dog.yMax) continue;
      const d = reachDepth(world, x, z, dog, tol, holes);
      if (d >= tol) {
        sizes.add(dog.name);
        depth = Math.max(depth, d);
      }
    }
    if (sizes.size) hit.push({ i: c.i, j: c.j, x, z, y0: c.y0, y1: c.y1, depth, sizes, meshes: c.meshes });
  }

  // pontos encostados (a menos de `link`) viram um achado só
  const parent = hit.map((_, k) => k);
  const find = (k) => (parent[k] === k ? k : (parent[k] = find(parent[k])));
  const bucket = new Map();
  const bk = (x, z) => `${Math.floor(x / link)},${Math.floor(z / link)}`;
  hit.forEach((h, k) => {
    const key = bk(h.x, h.z);
    if (!bucket.has(key)) bucket.set(key, []);
    bucket.get(key).push(k);
  });
  hit.forEach((h, k) => {
    const bx = Math.floor(h.x / link), bz = Math.floor(h.z / link);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const o of bucket.get(`${bx + dx},${bz + dz}`) || []) {
          if (o <= k) continue;
          if (Math.hypot(hit[o].x - h.x, hit[o].z - h.z) <= link) parent[find(o)] = find(k);
        }
      }
    }
  });
  /** @type {Map<number, typeof hit>} */
  const groups = new Map();
  hit.forEach((h, k) => {
    const g = find(k);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(h);
  });

  const r3 = (v) => Math.round(v * 1000) / 1000;
  const out = [];
  for (const pts of groups.values()) {
    const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    let y0 = Infinity, y1 = -Infinity, depth = 0;
    const sizes = new Set();
    /** @type {Map<number, number>} */
    const count = new Map();
    for (const p of pts) {
      box.minX = Math.min(box.minX, p.x); box.maxX = Math.max(box.maxX, p.x);
      box.minZ = Math.min(box.minZ, p.z); box.maxZ = Math.max(box.maxZ, p.z);
      y0 = Math.min(y0, p.y0); y1 = Math.max(y1, p.y1);
      depth = Math.max(depth, p.depth);
      for (const s of p.sizes) sizes.add(s);
      for (const [mi, n] of p.meshes) count.set(mi, (count.get(mi) || 0) + n);
    }
    const top = [...count.entries()].sort((a, b) => b[1] - a[1]);
    // o desenho todo dessas malhas por perto (não só a parte alcançada): é o que o colisor precisa cobrir
    const near = 0.3;
    const foot = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    const ids = new Set(top.map(([mi]) => mi));
    const footPts = [];
    for (const c of cells.values()) {
      const x = c.i * cell, z = c.j * cell;
      if (x < box.minX - near || x > box.maxX + near || z < box.minZ - near || z > box.maxZ + near) continue;
      if (![...c.meshes.keys()].some((mi) => ids.has(mi))) continue;
      foot.minX = Math.min(foot.minX, x); foot.maxX = Math.max(foot.maxX, x);
      foot.minZ = Math.min(foot.minZ, z); foot.maxZ = Math.max(foot.maxZ, z);
      footPts.push([x, z]);
    }
    const cx = (foot.minX + foot.maxX) / 2, cz = (foot.minZ + foot.maxZ) / 2;
    const rad = Math.max(...footPts.map(([x, z]) => Math.hypot(x - cx, z - cz))) + cell / 2;
    const hx = (foot.maxX - foot.minX) / 2 + cell / 2, hz = (foot.maxZ - foot.minZ) / 2 + cell / 2;
    const suggest = Math.PI * rad * rad <= 4 * hx * hz * 1.15
      ? { shape: 'circle', x: r3(cx), z: r3(cz), r: r3(rad) }
      : { shape: 'box', x: r3(cx), z: r3(cz), hx: r3(hx), hz: r3(hz) };
    out.push({
      center: { x: r3((box.minX + box.maxX) / 2), z: r3((box.minZ + box.maxZ) / 2) },
      box: { minX: r3(box.minX), maxX: r3(box.maxX), minZ: r3(box.minZ), maxZ: r3(box.maxZ) },
      foot: { minX: r3(foot.minX), maxX: r3(foot.maxX), minZ: r3(foot.minZ), maxZ: r3(foot.maxZ) },
      y: [r3(y0), r3(y1)],
      depth: r3(depth),
      points: pts.length,
      sizes: [...sizes],
      meshes: top.slice(0, 4).map(([mi]) => meshLabel(meshes[mi])),
      suggest,
    });
  }
  return out.sort((a, b) => b.points - a.points);
}
