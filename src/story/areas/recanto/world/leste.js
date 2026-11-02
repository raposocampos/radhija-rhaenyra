// =====================================================================
//  MODO HISTÓRIA · Recanto das Patinhas — o LESTE do condomínio (cap. 1). Coordenadas em ../layout.js.
//   GUARITA (nordeste): reboco com pilares de canto e barrado de pastilhas; o guichê do sul com uma folha de correr
//     aberta (o radinho no balcão de dentro, a luminária acesa, a cortina puxada: o porteiro cochila fora de vista), a
//     janela do leste com a cortina fechada, o toldo de chapa listrada com mãos-francesas (firme: a Radhija pisa nele),
//     a laje com platibanda, a antena espinha-de-peixe com estais (a meia é de atores.js: o lugar dela no mastro fica
//     livre), a parabólica, a câmera de segurança, a arandela, o interfone, a floreira e o buzinote pingando.
//   LIXEIRA de rodinhas (verde, tampa, alça e duas rodas que giram quando ela anda).
//   LAGO: a água no contorno do layout com a ilha vazada, a margem de barro (a faixa pisada na grama e o barranco até a
//     água), o raso, pedras, taboas, aguapés, folhas e um galho da tempestade boiando e a neblina baixa da manhã; a ILHA
//     (morrinho de grama de pisar, casinha de pato, moita, pedras do caminho e o trapiche), o PÍER da Dona Gansa
//     (tábuas, estacas, corrimão com corda, boia salva-vidas, lanterna e a rampa de subida) e o CANAL de pedra.
//   BARQUINHO de pedal (patinho amarelo): convés de tábuas que vira ponte quando encaixa no canal.
// API: buildLeste(kit, root, L) → { props: { booth, bin, boat }, seeThrough, update(dt, t), reset(), dispose(), signs }
// Chão de pisar (src/game/ground.js): o convés do píer e a rampa, o morrinho da ilha e o convés do barquinho (este só
// quando ele está no canal). Fora disso, o que fica no chão por onde as dogs andam tem o alto até 2 cm.
// =====================================================================
import * as THREE from 'three';
import { rng, vnoise2, fbm3, mat, smoothstep, radialTexture, foliageCluster, paint, mergeGeometries, mergeVertices, contactShadow } from '../../../../world/util.js';
import { SLOTS, rb, cyl, sphere, slab, tiles, tilesV, gableRoof } from '../../../../levels/mapa/world/kit.js';
import { waterMat, flowerBush } from '../../../../levels/mapa/world/pecas.js';

/** As zonas do kit (uma malha por material em cada uma: o recorte da câmera tira a que está fora de vista). */
const GB = 'guarita';
const GL = 'lago';

const col = (hex) => new THREE.Color(hex);
const _c = new THREE.Color();
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => { const u = clamp01(t); return u * u * (3 - 2 * u); };
/** Sorteio estável (0..1) por célula: pastilhas, tábuas, pedras. */
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- materiais próprios (cache da aplicação)
/** A água do lago: a do mapa um pouco mais verde, com as ondinhas na escala do lago (a textura anda devagar). */
const lakeMat = () => mat('recanto-leste-agua', () => {
  const base = waterMat();
  const m = base.clone();
  m.color.set('#4a97bb');
  const n = base.normalMap.clone();
  n.repeat.set(0.7, 0.7);
  n.needsUpdate = true;
  m.normalMap = n;
  m.normalScale = new THREE.Vector2(0.28, 0.28);
  return m;
});
/** O raso na beira (cor com transparência por vértice, em cima da água). */
const shallowMat = () => mat('recanto-leste-raso', () => new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.3, metalness: 0 }));
/** Vidro das janelas da guarita: dá para ver o escuro de dentro, o radinho e a luminária. */
const glassMat = () => mat('recanto-leste-vidro', () => new THREE.MeshStandardMaterial({ color: '#b2d4e4', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide }));
/** Chão de pisar invisível (cobre as frestas das tábuas): não pinta nem escreve profundidade. */
const ghostMat = () => mat('recanto-leste-chao', () => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
/** A neblina baixa por cima do lago (com luz: na noite da abertura ela some no escuro, não brilha). */
const mistMat = () => mat('recanto-leste-neblina', () => new THREE.MeshLambertMaterial({ map: radialTexture(), color: '#fff5ec', transparent: true, opacity: 0.2, depthWrite: false }));
/** A poça de luz da luminária no balcão (aditiva). */
const glowMat = () => mat('recanto-leste-luz', () => new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffc27a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
/** A espuma em volta do barquinho na água. */
const foamMat = () => mat('recanto-leste-espuma', () => new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false }));

// ---------------------------------------------------------------- ajudantes de forma e cor
/** Cor com ruído suave (reboco, pedra, madeira); seed varia o desenho entre peças iguais. */
function tone(hex, amp = 0.035, freq = 2.0, seed = 0) {
  const base = col(hex), c = new THREE.Color();
  return (p) => c.copy(base).offsetHSL(0, 0, (vnoise2(p.x * freq + p.y * 0.7 + seed * 13.1, p.z * freq - p.y * 0.5 + seed * 5.3) - 0.5) * 2 * amp);
}
/** Cor por lado da parede: `inside` na face de dentro (normal · (dx, dz) < −0,5), `out` (cor ou função) no resto. */
function inOut(out, inside, dx, dz) {
  const ci = col(inside), co = typeof out === 'string' ? col(out) : null;
  return (p, n) => (n.x * dx + n.z * dz < -0.5 ? ci : co || out(p, n));
}

const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
/** Haste de a até b ([x, y, z]): a geometria já deitada na direção, centrada, e o meio dela. */
function link(a, b, r, seg = 6) {
  _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _v.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.applyQuaternion(_q.setFromUnitVectors(_up, _v.normalize()));
  return { g, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2 };
}
/** Haste de a até b direto no kit. */
function addLink(kit, a, b, r, opts, seg = 6) {
  const l = link(a, b, r, seg);
  kit.add(l.g, { ao: false, ...opts, x: l.x, y: l.y, z: l.z });
}
/** Peça pintada (cor, função ou null para manter) e posta no lugar: para as malhas próprias (lixeira, barquinho, píer). */
function part(g, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  if (color !== null) paint(g, color);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  return g;
}
/** Junta peças com cor por vértice numa geometria só (sem índice; só posição, normal e cor). */
function mergeParts(parts) {
  const list = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.normal) n.computeVertexNormals();
    return n;
  });
  const out = mergeGeometries(list);
  for (const g of list) g.dispose();
  return out;
}
/** A mesma superfície vista dos dois lados com material de um lado só (prato da parabólica, bandeirinha). */
function doubleSide(g) {
  const a = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(a.attributes)) if (!['position', 'normal', 'color'].includes(k)) a.deleteAttribute(k);
  if (!a.attributes.normal) a.computeVertexNormals();
  const b = a.clone();
  const attrs = [b.attributes.position, b.attributes.normal, b.attributes.color].filter(Boolean);
  for (let i = 0; i < b.attributes.position.count; i += 3) {
    for (const at of attrs) {
      const s = at.itemSize, arr = at.array;
      for (let k = 0; k < s; k++) { const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t; }
    }
  }
  const n = b.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return mergeGeometries([a, b]);
}

// ---------------------------------------------------------------- o contorno do lago
/**
 * O contorno em pontos próximos (a cada ~`step` m), com a normal para DENTRO da água (meia-esquadria nos cantos), o
 * comprimento acumulado e os lados.
 */
function outlinePoints(P, step) {
  const n = P.length;
  let a2 = 0;
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; a2 += a.x * b.z - b.x * a.z; }
  const s = a2 > 0 ? 1 : -1;
  const edges = P.map((a, i) => {
    const b = P[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
    return { a, b, len, dx, dz, nx: -dz * s, nz: dx * s };
  });
  const pts = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const e = edges[i], pr = edges[(i - 1 + n) % n];
    let mx = e.nx + pr.nx, mz = e.nz + pr.nz;
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const k = 1 / Math.max(0.65, mx * e.nx + mz * e.nz);
    pts.push({ x: e.a.x, z: e.a.z, nx: mx * k, nz: mz * k, s: acc });
    const m = Math.max(1, Math.round(e.len / step));
    for (let j = 1; j < m; j++) {
      const t = j / m;
      pts.push({ x: e.a.x + (e.b.x - e.a.x) * t, z: e.a.z + (e.b.z - e.a.z) * t, nx: e.nx, nz: e.nz, s: acc + e.len * t });
    }
    acc += e.len;
  }
  return { pts, edges, perimeter: acc };
}
/** Dentro do polígono? E a distância até o contorno. */
function polygonTests(P) {
  const inside = (x, z) => {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i], b = P[j];
      if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
    }
    return c;
  };
  const dist = (x, z) => {
    let m = Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = clamp01(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz));
      m = Math.min(m, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
    }
    return m;
  };
  return { inside, dist };
}
/**
 * Faixa ao longo de um contorno fechado: rows(p) dá, de fora para dentro, [deslocamento para dentro, altura, cor,
 * alfa?] de cada ponto. → geometria com índice, normais (para cima) e cor RGB ou RGBA.
 */
function ribbon(pts, rows, alpha = false) {
  const N = pts.length;
  const first = rows(pts[0]);
  const R = first.length, k = alpha ? 4 : 3;
  const pos = new Float32Array(N * R * 3), colr = new Float32Array(N * R * k);
  pts.forEach((p, i) => {
    (i ? rows(p) : first).forEach(([d, y, c, a], r) => {
      const v = i * R + r;
      pos.set([p.x + p.nx * d, y, p.z + p.nz * d], v * 3);
      colr.set(alpha ? [c.r, c.g, c.b, a] : [c.r, c.g, c.b], v * k);
    });
  });
  const idx = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let r = 0; r < R - 1; r++) {
      const a = i * R + r, b = j * R + r, c = j * R + r + 1, d = i * R + r + 1;
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colr, k));
  g.setIndex(idx);
  g.computeVertexNormals();
  // as faces viradas para cima (a ordem dos pontos depende do sentido do contorno)
  if (g.attributes.normal.getY(0) < 0) {
    const ia = g.index.array;
    for (let t = 0; t < ia.length; t += 3) { const tmp = ia[t + 1]; ia[t + 1] = ia[t + 2]; ia[t + 2] = tmp; }
    g.computeVertexNormals();
  }
  return g;
}

// ---------------------------------------------------------------- peças do lago
/** Pedra irregular (raio ~1, base achatada) com musgo em cima e a parte de baixo molhada. */
function rockGeo(seed, detail = 1) {
  let g = /** @type {THREE.BufferGeometry} */ (new THREE.IcosahedronGeometry(1, detail));
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.multiplyScalar(1 + (fbm3(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6 - seed, 3) - 0.5) * 0.55);
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.25;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const base = col(['#a39d93', '#99917f', '#ada596', '#8f8a82'][seed % 4]), moss = col('#6e8a46'), wet = col('#5c554c');
  const c = new THREE.Color();
  paint(g, (p, n) => {
    c.copy(base).offsetHSL(0, 0, (vnoise2(p.x * 4 + seed, p.z * 4 + p.y * 3) - 0.5) * 0.1);
    if (n.y > 0.5) c.lerp(moss, clamp01((n.y - 0.5) * 1.4) * (0.2 + 0.5 * vnoise2(p.x * 3 - seed, p.z * 3)));
    if (p.y < -0.1) c.lerp(wet, clamp01((-p.y - 0.1) * 2.5));
    return c;
  });
  return g;
}
/** Touceira de taboa: lâminas finas curvadas (do verde ao palha) e as espigas marrons. Base em y = 0. */
function reedClump(seed, { n = 16, h = 0.6, r = 0.12, heads = 3, tip = '#a5bb5e', base = '#4a6630' } = {}) {
  const R = rng(seed);
  const pos = [], cols = [], idx = [];
  const cBase = col(base), cTip = col(tip), cDry = col('#c4a862'), c = new THREE.Color();
  let v = 0;
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * r;
    const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
    const hh = h * (0.5 + R() * 0.6), w = h * (0.018 + R() * 0.012);
    const dir = a + (R() - 0.5) * 1.2; // inclinam para fora da touceira
    const lean = h * (0.08 + R() * 0.28);
    const ct = R() < 0.22 ? cDry : cTip;
    const fx = -Math.sin(dir), fz = Math.cos(dir);
    for (let s = 0; s <= 3; s++) {
      const t = s / 3, b = lean * t * t;
      const px = bx + Math.cos(dir) * b, pz = bz + Math.sin(dir) * b, py = hh * t * (1 - 0.15 * t);
      const ww = w * (1 - t * 0.92);
      pos.push(px - fx * ww, py, pz - fz * ww, px + fx * ww, py, pz + fz * ww);
      c.copy(cBase).lerp(ct, t);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let s = 0; s < 3; s++) { const k = v + s * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    v += 8;
  }
  const blades = new THREE.BufferGeometry();
  blades.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blades.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  blades.setIndex(idx);
  blades.computeVertexNormals();
  const parts = [blades];
  for (let k = 0; k < heads; k++) {
    const a = R() * Math.PI * 2, rr = R() * r * 0.7;
    const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr, hh = h * (0.85 + R() * 0.3);
    const tx = bx + (R() - 0.5) * 0.06, tz = bz + (R() - 0.5) * 0.06;
    const stem = link([bx, 0, bz], [tx, hh, tz], 0.0045, 4);
    parts.push(part(stem.g, '#6d8a3e', { x: stem.x, y: stem.y, z: stem.z }));
    parts.push(part(cyl(0.017, 0.017, 0.09, 7), '#6a4126', { x: tx, y: hh - 0.1, z: tz }));
    parts.push(part(cyl(0.003, 0.003, 0.05, 3), '#7d6a45', { x: tx, y: hh - 0.01, z: tz }));
  }
  return mergeParts(parts);
}
/** Folha de aguapé (disco com o corte), borda um pouco erguida. Raio 1, deitada. */
function lilyPad(seed) {
  const R = rng(seed);
  const notch = 0.35 + R() * 0.3;
  const g = new THREE.CircleGeometry(1, 16, notch / 2, Math.PI * 2 - notch).rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const rr = Math.hypot(pos.getX(i), pos.getZ(i)); pos.setY(i, rr * rr * 0.05); }
  g.computeVertexNormals();
  const inner = col('#3f7034'), rim = col('#80ae55'), c = new THREE.Color();
  paint(g, (p) => c.copy(inner).lerp(rim, Math.min(1, Math.hypot(p.x, p.z) ** 2)).offsetHSL(0, 0, (R() - 0.5) * 0.02));
  return g;
}
/** Flor de aguapé (pétalas rosadas em dois anéis e o miolo amarelo). */
function lilyFlower(seed) {
  const R = rng(seed);
  const parts = [];
  for (const [n, rr, y, s, c] of /** @type {[number, number, number, number, string][]} */ ([[8, 0.024, 0.008, 1, '#f5afcb'], [6, 0.013, 0.018, 0.75, '#fbd6e5']])) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.25;
      parts.push(part(new THREE.SphereGeometry(1, 5, 3), c, { x: Math.cos(a) * rr, y, z: Math.sin(a) * rr, sx: 0.011 * s, sy: 0.007 * s, sz: 0.026 * s, ry: Math.PI / 2 - a }));
    }
  }
  parts.push(part(new THREE.SphereGeometry(0.009, 6, 4), '#f2c230', { y: 0.022 }));
  return mergeParts(parts);
}
/** Contorno de poça (macio), deitado. */
function blobGeo(r, seed, n = 28) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + 0.1 * Math.sin(2 * a + seed) + 0.06 * Math.sin(3 * a + seed * 2.3));
    if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ShapeGeometry(s, 1).rotateX(-Math.PI / 2);
}
/** Poça da tempestade: a beirada molhada e a água refletindo o céu. y: o alto da superfície embaixo dela. */
function puddleAt(kit, x, y, z, r, seed, group) {
  kit.add(blobGeo(r * 1.15, seed), { color: '#76624d', slot: 'ground', x, y: y + 0.003, z, sz: 0.75, group, ao: false });
  kit.add(blobGeo(r, seed), { color: '#8db3c8', slot: 'glass', x, y: y + 0.006, z, sz: 0.75, group, ao: false });
}
/** Cortina franzida (listras de xadrezinho), voltada para +z; as dobras escurecem. */
function curtain(w, h, folds, amp, [ca, cb]) {
  const g = new THREE.PlaneGeometry(w, h, folds * 4, 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin((x / w + 0.5) * folds * Math.PI * 2) * amp * (0.75 + 0.25 * (0.5 - y / h)));
  }
  g.computeVertexNormals();
  const a = col(ca), b = col(cb), c = new THREE.Color();
  paint(g, (p, n) => c.copy(Math.floor((p.y + 5) / 0.07) % 2 ? a : b).multiplyScalar(0.74 + 0.26 * clamp01(n.z * 0.9 + 0.25)));
  return g;
}
/** Folhinha solta (elipse deitada, raio 1). */
const leafGeo = () => new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2);
const LEAVES = ['#d4ae4a', '#a96c3a', '#7d9f48', '#c98a3a', '#8a5a33'];

// =====================================================================
/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildLeste(kit, root, L) {
  /** @type {((dt: number, t: number) => void)[]} */
  const live = [];
  const booth = buildBooth(kit, root, L, live);
  buildLake(kit, root, L, live);
  const bin = buildBin(root, L);
  const boat = buildBoat(root, L, live);
  const reset = () => { bin.reset(); boat.reset(); booth.radio.setOn(false); };
  reset();
  return {
    props: { booth: booth.prop, bin: bin.prop, boat: boat.prop },
    seeThrough: [...bin.see, ...boat.see],
    update(dt, t) { for (const f of live) f(dt, t); },
    reset,
    dispose() { live.length = 0; },
    signs: [],
  };
}

// =====================================================================  GUARITA
/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {any} L
 * @param {((dt: number, t: number) => void)[]} live
 */
function buildBooth(kit, root, L, live) {
  const B = L.BOOTH, A = B.awning;
  const { x0, x1, z0, z1 } = B;
  const H = B.h, RY = B.roof;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const T = 0.12, IN = 0.02, PIL = 0.18; // parede, recuo da parede em relação aos pilares, pilar
  const wx0 = x0 + IN, wx1 = x1 - IN, wz0 = z0 + IN, wz1 = z1 - IN; // faces de fora das paredes
  const o = { group: GB };
  /** O guichê (sul), a janela do leste (mesma altura) e a porta do oeste. */
  const WIN = { x0: x0 + 0.25, x1: x1 - 0.25, y0: 0.82, y1: 1.5 };
  const WE = { z0: z0 + 0.55, z1: z1 - 0.45 };
  const DOOR = { z0: cz - 0.15, z1: cz + 0.65, h: 2.0 };
  const ALU = '#c4c9cf', STEEL = '#4a5056';
  const put = (g, color, x, y, z, extra = {}) => kit.add(g, { color, x, y, z, ...o, ...extra });

  // ---------- paredes: reboco por fora, cinza-escuro por dentro (lá dentro é sombra) ----------
  const WALL = tone('#f1e2c6', 0.03, 1.4, 2), INSIDE = '#57525a';
  const wS = inOut(WALL, INSIDE, 0, 1), wN = inOut(WALL, INSIDE, 0, -1), wE = inOut(WALL, INSIDE, 1, 0), wW = inOut(WALL, INSIDE, -1, 0);
  const ax0 = x0 + 0.05, ax1 = x1 - 0.05, az0 = z0 + 0.05, az1 = z1 - 0.05; // as pontas somem nos pilares
  const zs = wz1 - T / 2, zn = wz0 + T / 2, xe = wx1 - T / 2, xw = wx0 + T / 2;
  put(slab(ax1 - ax0, H, T), wN, cx, 0, zn);
  put(slab(ax1 - ax0, WIN.y0, T), wS, cx, 0, zs);
  put(slab(ax1 - ax0, H - WIN.y1, T), wS, cx, WIN.y1, zs);
  put(slab(WIN.x0 - ax0, WIN.y1 - WIN.y0, T), wS, (ax0 + WIN.x0) / 2, WIN.y0, zs);
  put(slab(ax1 - WIN.x1, WIN.y1 - WIN.y0, T), wS, (WIN.x1 + ax1) / 2, WIN.y0, zs);
  put(slab(T, WIN.y0, az1 - az0), wE, xe, 0, cz);
  put(slab(T, H - WIN.y1, az1 - az0), wE, xe, WIN.y1, cz);
  put(slab(T, WIN.y1 - WIN.y0, WE.z0 - az0), wE, xe, WIN.y0, (az0 + WE.z0) / 2);
  put(slab(T, WIN.y1 - WIN.y0, az1 - WE.z1), wE, xe, WIN.y0, (WE.z1 + az1) / 2);
  put(slab(T, H, DOOR.z0 - az0), wW, xw, 0, (az0 + DOOR.z0) / 2);
  put(slab(T, H, az1 - DOOR.z1), wW, xw, 0, (DOOR.z1 + az1) / 2);
  put(slab(T, H - DOOR.h, DOOR.z1 - DOOR.z0), wW, xw, DOOR.h, (DOOR.z0 + DOOR.z1) / 2);
  // pilares de canto (terracota) sobre as sapatas de concreto
  const PILC = tone('#c97650', 0.035, 2.2, 5);
  for (const [px, pz] of [[x0 + PIL / 2, z0 + PIL / 2], [x1 - PIL / 2, z0 + PIL / 2], [x0 + PIL / 2, z1 - PIL / 2], [x1 - PIL / 2, z1 - PIL / 2]]) {
    put(rb(PIL, H - 0.065, PIL, 0.03, 1), PILC, px, 0.065, pz);
    put(rb(PIL + 0.02, 0.065, PIL + 0.02, 0.015, 1), '#b8b0a4', px, 0, pz);
  }
  // barrado de pastilhas (sul e leste, os lados que a câmera vê), com o friso branco no leste
  const PAST = ['#5aa8a2', '#4f9c97', '#66b4ad', '#488f8a', '#70bcb4', '#559f9b'].map(col), PAST_W = col('#e6efe9');
  const pastilha = (seed) => (p) => {
    const h = hash(Math.floor((p.x + 50) / 0.055) + seed * 97, Math.floor((p.y + 50) / 0.055));
    return h > 0.965 ? PAST_W : PAST[Math.floor(h * 6) % 6];
  };
  put(tilesV((x1 - PIL) - (x0 + PIL), 0.72, 0.055, 0.055, pastilha(1)), null, cx, 0.43, wz1 + 0.004);
  put(tilesV((z1 - PIL) - (z0 + PIL), 0.72, 0.055, 0.055, pastilha(2)), null, wx1 + 0.004, 0.43, cz, { ry: Math.PI / 2 });
  put(rb(0.025, 0.025, (z1 - PIL) - (z0 + PIL), 0.008, 1), '#f7f1e6', wx1 + 0.0125, 0.775, cz, { ao: false });
  // o balcão de granito do guichê e o peitoril do leste
  const GRANITE = tone('#b7afa3', 0.05, 9, 7);
  put(rb(WIN.x1 - WIN.x0 + 0.12, 0.035, 0.24, 0.008, 1), GRANITE, cx, 0.79, wz1 + 0.09);
  put(rb(0.07, 0.03, WE.z1 - WE.z0 + 0.12, 0.008, 1), GRANITE, wx1 + 0.025, 0.8, (WE.z0 + WE.z1) / 2);

  // ---------- janelas: marcos de alumínio, folhas de correr e o vidro (malha própria, transparente) ----------
  /** @type {THREE.BufferGeometry[]} */
  const glass = [];
  const bar = (w, h, d, x, y, z, extra = {}) => put(slab(w, h, d), ALU, x, y, z, { ao: false, ...extra });
  /** Folha de correr: quatro barras e o vidro; (x, y, z) no meio dela, ry 0 (sul) ou π/2 (leste). */
  const pane = (x, y, z, w, h, ry) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (l) => ({ x: x + l * c, z: z - l * s });
    for (const l of [-w / 2 + 0.015, w / 2 - 0.015]) kit.add(slab(0.03, h, 0.022), { color: ALU, ...at(l), y: y - h / 2, ry, ...o, ao: false });
    for (const yy of [y - h / 2, y + h / 2 - 0.03]) kit.add(slab(w - 0.06, 0.03, 0.022), { color: ALU, ...at(0), y: yy, ry, ...o, ao: false });
    glass.push(new THREE.PlaneGeometry(w - 0.05, h - 0.05).rotateY(ry).translate(x, y, z));
  };
  const pyc = (WIN.y0 + 0.02 + WIN.y1 - 0.01) / 2, ph = WIN.y1 - WIN.y0 - 0.03;
  // guichê (sul): marco 1 cm para fora da parede; a folha do leste correu para trás da outra (o vão fica aberto)
  const fzS = wz1 - 0.015;
  bar(WIN.x1 - WIN.x0 + 0.07, 0.04, 0.05, cx, WIN.y1 - 0.005, fzS);
  for (const x of [WIN.x0 - 0.015, WIN.x1 + 0.015]) bar(0.04, WIN.y1 - WIN.y0 + 0.03, 0.05, x, WIN.y0, fzS);
  bar(WIN.x1 - WIN.x0 + 0.07, 0.03, 0.05, cx, 0.81, fzS);
  pane((WIN.x0 + 0.015 + cx + 0.02) / 2, pyc, wz1 - 0.045, cx + 0.02 - WIN.x0 - 0.015, ph, 0);
  pane((WIN.x0 + 0.075 + cx + 0.08) / 2, pyc, wz1 - 0.072, cx + 0.08 - WIN.x0 - 0.075, ph, 0);
  // janela do leste (as duas folhas fechadas, a cortina puxada por trás)
  const fxE = wx1 - 0.015, emid = (WE.z0 + WE.z1) / 2;
  bar(0.05, 0.04, WE.z1 - WE.z0 + 0.07, fxE, WIN.y1 - 0.005, emid);
  for (const z of [WE.z0 - 0.015, WE.z1 + 0.015]) bar(0.05, WIN.y1 - WIN.y0 + 0.03, 0.04, fxE, WIN.y0, z);
  bar(0.05, 0.03, WE.z1 - WE.z0 + 0.07, fxE, 0.81, emid);
  pane(wx1 - 0.045, pyc, (WE.z0 + 0.015 + emid + 0.02) / 2, emid + 0.02 - WE.z0 - 0.015, ph, Math.PI / 2);
  pane(wx1 - 0.072, pyc, (emid - 0.02 + WE.z1 - 0.015) / 2, WE.z1 - 0.015 - emid + 0.02, ph, Math.PI / 2);
  const glassMesh = new THREE.Mesh(mergeGeometries(glass), glassMat());
  glassMesh.name = 'recanto:guarita-vidros';
  root.add(glassMesh);
  for (const g of glass) g.dispose();
  // cortinas (a do leste fechada; a do guichê puxada para o canto) e os varões
  const CUR = /** @type {[string, string]} */ (['#efcd7c', '#fbf1d6']), ROD = { color: '#8a6a48', ...o };
  put(curtain(WE.z1 - WE.z0 + 0.06, 0.72, 5, 0.022, CUR), null, wx1 - T - 0.05, 1.17, emid, { ry: Math.PI / 2, ao: false });
  addLink(kit, [wx1 - T - 0.05, 1.545, WE.z0 - 0.06], [wx1 - T - 0.05, 1.545, WE.z1 + 0.06], 0.008, ROD);
  put(curtain(0.34, 0.68, 4, 0.03, CUR), null, WIN.x0 + 0.18, 1.16, wz1 - T - 0.05, { ao: false });
  addLink(kit, [WIN.x0 - 0.04, 1.535, wz1 - T - 0.05], [WIN.x1 + 0.04, 1.535, wz1 - T - 0.05], 0.008, ROD);

  // ---------- lá dentro: piso, o balcão com o radinho, a luminária acesa, a garrafa térmica, a xícara e o livro ----------
  put(slab(x1 - x0 - 0.2, 0.05, z1 - z0 - 0.2), tone('#4b443e', 0.05, 3, 9), cx, 0, cz);
  const CY = 0.8; // o tampo do balcão de dentro, logo abaixo do vão do guichê (0,82)
  put(rb(wx1 - wx0 - 2 * T - 0.004, 0.035, 0.46, 0.008, 1), tone('#5a3f2b', 0.04, 5, 2), cx, CY - 0.035, wz1 - T - 0.23);
  // o radinho de pilha, atrás da folha aberta (a câmera o vê pelo vão)
  const R0 = { x: WIN.x1 - 0.33, y: CY, z: wz1 - T - 0.09 };
  const fz = R0.z + 0.0325; // a frente do corpo
  put(rb(0.21, 0.125, 0.065, 0.02, 2), tone('#c8433a', 0.03, 9, 3), R0.x, R0.y, R0.z);
  put(rb(0.19, 0.1, 0.008, 0.004, 1), '#f1e2c2', R0.x, R0.y + 0.0125, fz, { ao: false });
  const dots = (p) => _c.set((Math.floor((p.x + 5) / 0.01) + Math.floor((p.y + 5) / 0.01)) % 2 ? '#3a332e' : '#8b7f71');
  put(tilesV(0.08, 0.075, 0.01, 0.01, dots), null, R0.x - 0.045, R0.y + 0.0625, fz + 0.007, { ao: false });
  put(slab(0.003, 0.026, 0.003), '#d23a2a', R0.x + 0.052, R0.y + 0.063, fz + 0.0125, { ao: false });
  for (const dx of [0.022, 0.068]) put(cyl(0.012, 0.012, 0.012, 12), '#2f2a26', R0.x + dx, R0.y + 0.03, fz + 0.004, { rx: Math.PI / 2, ao: false });
  put(new THREE.TorusGeometry(0.06, 0.008, 6, 12, Math.PI), '#3a2a22', R0.x, R0.y + 0.125, R0.z, { ao: false });
  addLink(kit, [R0.x - 0.08, R0.y + 0.12, R0.z - 0.012], [R0.x - 0.13, R0.y + 0.26, R0.z - 0.03], 0.0045, { color: '#c9ced3', ...o }, 5);
  addLink(kit, [R0.x - 0.13, R0.y + 0.26, R0.z - 0.03], [R0.x - 0.19, R0.y + 0.41, R0.z - 0.05], 0.003, { color: '#c9ced3', ...o }, 5);
  put(sphere(0.007, 6, 4), '#c9ced3', R0.x - 0.19, R0.y + 0.41, R0.z - 0.05, { ao: false });
  // o mostrador e o led acendem com o rádio ligado (malhas próprias: o brilho muda a cada quadro)
  const dialMat = new THREE.MeshStandardMaterial({ color: '#3a2a18', emissive: '#ffbe5c', emissiveIntensity: 0.05, roughness: 0.35 });
  const dial = new THREE.Mesh(rb(0.075, 0.032, 0.006, 0.003, 1), dialMat);
  dial.name = 'recanto:radinho-mostrador';
  dial.position.set(R0.x + 0.045, R0.y + 0.047, fz + 0.0075);
  const ledMat = new THREE.MeshStandardMaterial({ color: '#401010', emissive: '#ff3b2e', emissiveIntensity: 0.05, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), ledMat);
  led.name = 'recanto:radinho-led';
  led.position.set(R0.x + 0.088, R0.y + 0.03, fz + 0.006);
  root.add(dial, led);
  let radioOn = false;
  const radio = { setOn(on) { radioOn = !!on; } };
  live.push((dt, t) => {
    if (radioOn) {
      // o mostrador pulsa com a música; o led pisca
      const beat = Math.abs(Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1.3));
      dialMat.emissiveIntensity = 1.0 + beat * 0.7 + 0.12 * Math.sin(t * 13.7);
      ledMat.emissiveIntensity = (t * 2.4) % 1 < 0.55 ? 2.2 : 0.2;
    } else {
      dialMat.emissiveIntensity = 0.05;
      ledMat.emissiveIntensity = 0.05;
    }
  });
  // a luminária de mesa (a boca da cúpula acesa) e a poça de luz no balcão
  const LG = '#2f5d4a', lx = cx - 0.2, lz = wz1 - T - 0.3;
  put(cyl(0.055, 0.065, 0.02, 14), LG, lx, CY, lz);
  addLink(kit, [lx, CY + 0.02, lz], [lx - 0.02, CY + 0.2, lz - 0.04], 0.008, { color: LG, ...o });
  addLink(kit, [lx - 0.02, CY + 0.2, lz - 0.04], [lx + 0.03, CY + 0.27, lz + 0.05], 0.008, { color: LG, ...o });
  const shx = lx + 0.04, shy = CY + 0.235, shz = lz + 0.08;
  put(new THREE.ConeGeometry(0.075, 0.1, 14), LG, shx, shy, shz, { rx: -0.55 });
  put(new THREE.CircleGeometry(0.07, 14).rotateX(Math.PI / 2).translate(0, -0.052, 0), '#fff1c8', shx, shy, shz, { slot: 'lit', rx: -0.55, ao: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.32).rotateX(-Math.PI / 2), glowMat());
  pool.name = 'recanto:luminaria-luz';
  pool.position.set(shx + 0.02, CY + 0.003, lz + 0.12);
  pool.renderOrder = 3;
  root.add(pool);
  // o livro de ocorrências aberto, a caneta, a garrafa térmica e a xícara de café
  const bkx = cx + 0.05, bkz = wz1 - T - 0.15;
  put(rb(0.27, 0.012, 0.19, 0.004, 1), '#2f4f7a', bkx, CY, bkz, { ry: 0.12 });
  for (const s of [-1, 1]) put(slab(0.125, 0.008, 0.175), '#f5f0e2', bkx + s * 0.066 * Math.cos(0.12), CY + 0.012, bkz - s * 0.066 * Math.sin(0.12), { ry: 0.12, rz: -s * 0.05, ao: false });
  addLink(kit, [bkx + 0.02, CY + 0.026, bkz + 0.04], [bkx + 0.11, CY + 0.026, bkz - 0.02], 0.004, { color: '#1f3a6b', ...o }, 5);
  const tx = cx + 0.24, tz = wz1 - T - 0.33;
  put(cyl(0.042, 0.045, 0.19, 14), '#3d6fa8', tx, CY, tz);
  put(cyl(0.036, 0.042, 0.05, 14), '#f2efe8', tx, CY + 0.19, tz, { ao: false });
  put(cyl(0.012, 0.012, 0.02, 8), '#f2efe8', tx, CY + 0.24, tz, { ao: false });
  put(new THREE.TorusGeometry(0.035, 0.007, 5, 10, Math.PI).rotateZ(-Math.PI / 2), '#2f5a8c', tx + 0.045, CY + 0.1, tz, { ao: false });
  const ux = WIN.x1 - 0.1, uz = wz1 - T - 0.12;
  put(cyl(0.032, 0.027, 0.07, 12), '#f4efe6', ux, CY, uz);
  put(cyl(0.028, 0.028, 0.004, 12), '#4a2c1a', ux, CY + 0.062, uz, { ao: false });
  put(new THREE.TorusGeometry(0.018, 0.005, 5, 10), '#f4efe6', ux + 0.036, CY + 0.035, uz, { ao: false });

  // ---------- a porta do oeste (fechada), o capacho ----------
  const dz = (DOOR.z0 + DOOR.z1) / 2, dw = DOOR.z1 - DOOR.z0;
  for (const z of [DOOR.z0 - 0.015, DOOR.z1 + 0.015]) put(slab(0.05, DOOR.h + 0.03, 0.04), '#f4efe6', wx0 + 0.015, 0, z, { ao: false });
  put(slab(0.05, 0.04, dw + 0.07), '#f4efe6', wx0 + 0.015, DOOR.h - 0.005, dz, { ao: false });
  put(slab(0.04, DOOR.h - 0.02, dw - 0.01), tone('#3f7d8b', 0.025, 3, 6), wx0 + 0.05, 0.01, dz);
  for (const yy of [0.18, 1.05]) put(rb(0.012, 0.75, dw - 0.2, 0.004, 1), '#4a8b99', wx0 + 0.027, yy, dz, { ao: false });
  addLink(kit, [wx0 + 0.03, 1.0, dz + dw / 2 - 0.1], [wx0 - 0.02, 1.0, dz + dw / 2 - 0.1], 0.008, { color: '#c9a24a', ...o });
  addLink(kit, [wx0 - 0.02, 1.0, dz + dw / 2 - 0.1], [wx0 - 0.02, 1.0, dz + dw / 2 - 0.22], 0.008, { color: '#c9a24a', ...o });
  const MAT = col('#a4744a'), MATB = col('#6e4b30');
  put(slab(0.4, 0.008, 0.72), '#6e4b30', wx0 - 0.23, 0.002, dz, { slot: 'ground', ao: false });
  put(tiles(0.38, 0.7, 0.04, 0.04, (p) => (Math.abs(p.x) > 0.15 || Math.abs(p.z) > 0.31 ? MATB : _c.copy(MAT).offsetHSL(0, 0, (hash(p.x * 50, p.z * 50) - 0.5) * 0.05))), null, wx0 - 0.23, 0.0135, dz, { slot: 'ground', ao: false });

  // ---------- o toldo: chapa listrada com nervuras, testeira de ondinhas, abas, testeira e mãos-francesas ----------
  const depth = A.z1 - z1, drop = A.y1 - A.y0;
  const tilt = Math.atan2(drop, depth), alen = Math.hypot(depth, drop);
  const topAt = (z) => A.y1 - ((z - z1) / depth) * drop; // o alto da chapa em z
  const NS = 8, sw = (x1 - x0) / NS;
  const STR = ['#d65a40', '#fff1dd'];
  for (let i = 0; i < NS; i++) {
    const g = rb(sw, 0.03, alen, 0.008, 1).translate(0, -0.03, alen / 2).rotateX(tilt);
    put(g, tone(STR[i % 2], 0.025, 3, i), x0 + sw * (i + 0.5), A.y1, z1, { ao: false });
  }
  for (let i = 0; i <= NS; i++) addLink(kit, [x0 + sw * i, topAt(z1 + 0.01) + 0.003, z1 + 0.01], [x0 + sw * i, topAt(A.z1 - 0.01) + 0.003, A.z1 - 0.01], 0.008, { color: '#f3ebdf', ...o });
  put(rb(x1 - x0 + 0.02, 0.05, 0.035, 0.01, 1), STEEL, cx, A.y1 - 0.035, z1 - 0.0025); // rufo na parede
  put(rb(x1 - x0 + 0.02, 0.045, 0.04, 0.01, 1), STEEL, cx, A.y0 - 0.075, A.z1 - 0.015); // testeira
  const nsc = 16, sr = (x1 - x0) / nsc / 2;
  for (let k = 0; k < nsc; k++) {
    const g = new THREE.CylinderGeometry(sr, sr, 0.012, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
    put(g, STR[Math.floor(k / 2) % 2], x0 + sr * (2 * k + 1), A.y0 - 0.075, A.z1 - 0.015, { ao: false });
  }
  for (const x of [x0 + 0.02, x1 - 0.02]) addLink(kit, [x, A.y1 - 0.045, z1 + 0.005], [x, A.y0 - 0.05, A.z1 - 0.03], 0.016, { color: STEEL, ...o });
  const cheek = new THREE.Shape([new THREE.Vector2(0, A.y1 - 0.03), new THREE.Vector2(depth - 0.02, A.y0 - 0.035), new THREE.Vector2(0, A.y1 - 0.2)]);
  const cheekGeo = new THREE.ExtrudeGeometry(cheek, { depth: 0.012, bevelEnabled: false }).rotateY(-Math.PI / 2);
  for (const x of [x0 + 0.012, x1]) put(cheekGeo, STR[0], x, 0, z1, { ao: false });
  // mãos-francesas: as das pontas nos pilares (inteiras), a do meio curta, presa acima do guichê
  for (const [x, low, reach] of [[x0 + PIL / 2, 1.25, 0.42], [x1 - PIL / 2, 1.25, 0.42], [cx, 1.58, 0.3]]) {
    const zw = x === cx ? wz1 : z1;
    put(rb(0.06, A.y1 - 0.02 - (low - 0.04), 0.012, 0.004, 1), STEEL, x, low - 0.04, zw + 0.006);
    addLink(kit, [x, low, zw + 0.012], [x, topAt(z1 + reach) - 0.04, z1 + reach], 0.011, { color: STEEL, ...o });
    addLink(kit, [x, A.y1 - 0.04, zw + 0.012], [x, topAt(z1 + reach + 0.1) - 0.04, z1 + reach + 0.1], 0.011, { color: STEEL, ...o });
  }
  // folhas da tempestade em cima do toldo
  const LEAF = leafGeo();
  for (const [lxx, lzz, s, r, c] of [[x0 + 0.42, z1 + 0.22, 0.04, 0.6, 0], [x0 + 1.3, z1 + 0.38, 0.034, 2.1, 1], [x1 - 0.28, z1 + 0.15, 0.038, 4.0, 2]]) {
    kit.add(LEAF, { color: LEAVES[c], slot: 'plant', x: lxx, y: topAt(lzz) + 0.005, z: lzz, sx: s, sz: s * 0.5, rx: tilt, ry: r, ...o, ao: false });
  }

  // ---------- arandela, câmera de segurança, interfone, floreira e o vasinho no balcão ----------
  put(rb(0.12, 0.2, 0.025, 0.01, 1), '#3d4247', cx, 1.84, wz1 + 0.0125);
  put(rb(0.1, 0.13, 0.08, 0.02, 1), '#ffe3a6', cx, 1.87, wz1 + 0.06, { slot: 'lit', ao: false });
  put(rb(0.13, 0.025, 0.1, 0.008, 1), '#3d4247', cx, 2.0, wz1 + 0.06);
  const camY = 2.02, camA = 0.65, cmx = x1 + 0.0, cmz = z1 + 0.14;
  addLink(kit, [x1 - PIL / 2, 2.1, z1 + 0.005], [cmx, 2.08, cmz - 0.03], 0.012, { color: '#e9e6df', ...o });
  put(rb(0.075, 0.07, 0.17, 0.02, 1), '#ecebe6', cmx, camY, cmz, { ry: camA });
  put(slab(0.1, 0.008, 0.2), '#d9d6cf', cmx, camY + 0.075, cmz, { ry: camA, ao: false });
  put(cyl(0.026, 0.026, 0.02, 12).translate(0, -0.01, 0).rotateX(Math.PI / 2).rotateY(camA), '#1f2328', cmx + Math.sin(camA) * 0.088, camY + 0.035, cmz + Math.cos(camA) * 0.088, { ao: false });
  put(rb(0.035, 0.24, 0.15, 0.012, 1), '#9aa0a6', wx1 + 0.0175, 1.1, z0 + 0.35);
  put(tilesV(0.07, 0.05, 0.01, 0.01, dots), null, wx1 + 0.038, 1.29, z0 + 0.35, { ry: Math.PI / 2, ao: false });
  for (let k = 0; k < 3; k++) put(cyl(0.011, 0.011, 0.012, 10), '#f2efe8', wx1 + 0.035, 1.15 + k * 0.04, z0 + 0.35, { rz: -Math.PI / 2, ao: false });
  // floreira embaixo da janela do leste (acima da cabeça das dogs; longe da folha aberta do portãozinho)
  const fb0 = WE.z1 - 0.62, fb1 = WE.z1 - 0.02;
  put(rb(0.15, 0.13, fb1 - fb0, 0.02, 1), tone('#b8653f', 0.04, 4, 8), wx1 + 0.075, 0.61, (fb0 + fb1) / 2);
  put(slab(0.12, 0.01, fb1 - fb0 - 0.04), '#4d3626', wx1 + 0.075, 0.728, (fb0 + fb1) / 2, { ao: false });
  const ger = flowerBush({ r: 0.085, seed: 21, flower: '#e8473a', n: 5 });
  for (let k = 0; k < 3; k++) put(ger, null, wx1 + 0.075, 0.732, fb0 + 0.1 + k * 0.2, { slot: 'foliage' });
  put(cyl(0.045, 0.036, 0.07, 12), '#c2683f', WIN.x0 + 0.08, 0.825, wz1 + 0.1);
  put(cyl(0.04, 0.04, 0.004, 12), '#4d3626', WIN.x0 + 0.08, 0.889, wz1 + 0.1, { ao: false });
  put(flowerBush({ r: 0.05, seed: 31, flower: '#f28ca2', n: 3 }), null, WIN.x0 + 0.08, 0.885, wz1 + 0.1, { slot: 'foliage' });

  // ---------- a laje: beiral, platibanda, impermeabilização com poça, folhas, um galho e o buzinote ----------
  const rx0 = x0 - 0.1, rx1 = x1 + 0.1, rz0 = z0 - 0.05, rz1 = z1 + 0.1, RT = 0.17;
  const rcx = (rx0 + rx1) / 2, rcz = (rz0 + rz1) / 2;
  put(rb(rx1 - rx0, RT, rz1 - rz0, 0.025, 1), tone('#d6cec1', 0.03, 2, 11), rcx, RY - RT, rcz);
  put(rb(x1 - x0 + 0.04, 0.06, z1 - z0 + 0.04, 0.012, 1), '#f7f1e6', cx, RY - RT - 0.06, cz);
  const rimH = 0.07, rimT = 0.07, RIM = tone('#cbc2b4', 0.03, 3, 12);
  put(rb(rx1 - rx0 - 0.01, rimH, rimT, 0.015, 1), RIM, rcx, RY, rz1 - 0.005 - rimT / 2);
  put(rb(rx1 - rx0 - 0.01, rimH, rimT, 0.015, 1), RIM, rcx, RY, rz0 + 0.005 + rimT / 2);
  const sideLen = rz1 - rz0 - 0.01 - 2 * rimT;
  put(rb(rimT, rimH - 0.004, sideLen, 0.015, 1), RIM, rx1 - 0.005 - rimT / 2, RY, rcz);
  put(rb(rimT, rimH - 0.004, sideLen, 0.015, 1), RIM, rx0 + 0.005 + rimT / 2, RY, rcz);
  const fx0 = rx0 + 0.005 + rimT, fx1 = rx1 - 0.005 - rimT, fz0 = rz0 + 0.005 + rimT, fz1 = rz1 - 0.005 - rimT;
  const roofFn = (p) => {
    const h = hash(Math.floor((p.x + 50) / 0.27), Math.floor((p.z + 50) / 0.25));
    return _c.set(vnoise2(p.x * 1.3 + 4, p.z * 1.3) > 0.6 ? '#7f7a71' : '#9e988c').offsetHSL(0, 0, (h - 0.5) * 0.06);
  };
  put(tiles(fx1 - fx0, fz1 - fz0, 0.27, 0.25, roofFn), null, (fx0 + fx1) / 2, RY + 0.003, (fz0 + fz1) / 2, { ao: false });
  puddleAt(kit, x0 + 0.52, RY + 0.003, z0 + 0.62, 0.2, 3, GB);
  for (const [lxx, lzz, s, r, c] of [[x0 + 0.25, z0 + 0.2, 0.04, 0.3, 0], [x0 + 0.95, z0 + 0.32, 0.036, 1.7, 4], [x1 - 0.2, z0 + 1.3, 0.042, 2.6, 1], [x0 + 0.3, z1 - 0.3, 0.035, 5.1, 2], [x1 - 0.55, z0 + 0.2, 0.038, 0.9, 3], [x0 + 0.62, z0 + 1.05, 0.033, 3.3, 0]]) {
    kit.add(LEAF, { color: LEAVES[c], slot: 'plant', x: lxx, y: RY + 0.008, z: lzz, sx: s, sz: s * 0.5, ry: r, ...o, ao: false });
  }
  const tw0 = [x0 + 0.12, RY + 0.012, z0 + 0.42], tw1 = [x0 + 0.42, RY + 0.014, z0 + 0.28], tw2 = [x0 + 0.58, RY + 0.012, z0 + 0.33];
  addLink(kit, tw0, tw1, 0.009, { color: '#6b4a2e', ...o }, 5);
  addLink(kit, tw1, tw2, 0.006, { color: '#6b4a2e', ...o }, 5);
  kit.add(LEAF, { color: '#6f8f3e', slot: 'plant', x: tw2[0] + 0.02, y: RY + 0.016, z: tw2[2] - 0.01, sx: 0.035, sz: 0.018, ry: 0.4, ...o, ao: false });
  addLink(kit, [rx1 - 0.06, RY + 0.025, z0 + 0.35], [rx1 + 0.12, RY + 0.005, z0 + 0.35], 0.022, { color: '#8e959b', ...o }, 8);
  puddleAt(kit, rx1 + 0.17, 0.012, z0 + 0.35, 0.15, 7, GB);

  // ---------- a antena espinha-de-peixe com os estais (a meia fica no mastro, abaixo da braçadeira) ----------
  const An = L.ANTENNA, top = An.top;
  put(cyl(0.06, 0.07, 0.025, 12), '#8f949a', An.x, RY, An.z);
  put(cyl(0.019, 0.022, top - RY - 0.02, 8), '#b5bac0', An.x, RY + 0.02, An.z);
  put(cyl(0.03, 0.03, 0.03, 10), '#8f949a', An.x, An.sock + 0.09, An.z, { ao: false });
  const by = top - 0.08, ANT = { color: '#c9ced3', ...o };
  addLink(kit, [An.x - 0.32, by, An.z], [An.x + 0.34, by, An.z], 0.011, { color: '#b5bac0', ...o });
  for (const [dx, len] of [[-0.3, 0.5], [-0.18, 0.44], [-0.06, 0.38], [0.06, 0.33], [0.17, 0.29], [0.27, 0.25]]) {
    addLink(kit, [An.x + dx, by, An.z - len / 2], [An.x + dx, by, An.z + len / 2], 0.0055, ANT, 5);
  }
  for (const s of [-1, 1]) addLink(kit, [An.x - 0.12, by + s * 0.025, An.z - 0.2], [An.x - 0.12, by + s * 0.025, An.z + 0.2], 0.005, ANT, 5);
  put(cyl(0.022, 0.022, 0.02, 8), '#8f949a', An.x, top - 0.02, An.z, { ao: false });
  const collar = [An.x, An.sock + 0.105, An.z];
  for (const [gx, gz] of [[rx1 - 0.08, rz0 + 0.1], [x0 + 0.85, rz0 + 0.1], [rx1 - 0.08, z0 + 1.1]]) {
    addLink(kit, collar, [gx, RY + 0.06, gz], 0.004, { color: '#55595e', ...o }, 4);
    put(sphere(0.014, 6, 4), '#55595e', gx, RY + 0.06, gz, { ao: false });
  }
  // o cabo da antena desce pelo mastro e some pela platibanda do norte
  addLink(kit, [An.x + 0.03, by - 0.02, An.z], [An.x + 0.025, RY + 0.03, An.z + 0.01], 0.005, { color: '#1f2226', ...o }, 4);
  addLink(kit, [An.x + 0.025, RY + 0.012, An.z + 0.01], [An.x + 0.05, RY + 0.012, rz0 + 0.08], 0.005, { color: '#1f2226', ...o }, 4);
  // a parabólica no canto noroeste, virada para o céu do sul
  const dX = x0 + 0.3, dZ = z0 + 0.38;
  put(cyl(0.05, 0.06, 0.02, 10), '#8f949a', dX, RY, dZ);
  put(cyl(0.016, 0.016, 0.3, 8), '#9aa0a6', dX, RY + 0.02, dZ);
  const dish = new THREE.SphereGeometry(0.28, 16, 5, 0, Math.PI * 2, 0, 0.66).translate(0, -0.28, 0).rotateX(Math.PI);
  put(doubleSide(dish), '#e4e2dc', dX, RY + 0.33, dZ, { rx: 0.75 });
  const ax = [0, Math.cos(0.75), Math.sin(0.75)];
  const focal = [dX, RY + 0.33 + ax[1] * 0.16, dZ + ax[2] * 0.16];
  addLink(kit, [dX, RY + 0.31, dZ + 0.13], focal, 0.006, { color: '#9aa0a6', ...o }, 5);
  put(rb(0.035, 0.05, 0.035, 0.01, 1), '#3d4247', focal[0], focal[1] - 0.025, focal[2]);

  return {
    radio,
    prop: {
      radio,
      // logo na frente do toldo (z do toldo + 12 cm): embaixo dele, o balão ficaria escondido pela chapa
      windowAnchor: { x: (cx + 0.08 + WIN.x1) / 2, y: 1.3, z: A.z1 + 0.12 },
    },
  };
}

// =====================================================================  LAGO
/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {any} L
 * @param {((dt: number, t: number) => void)[]} live
 */
function buildLake(kit, root, L, live) {
  const Lk = L.LAKE, I = Lk.island, WY = Lk.waterY, Pr = L.PIER, Ch = L.CHANNEL;
  const P = Lk.outline;
  const o = { group: GL };
  const { pts, edges } = outlinePoints(P, 0.16);
  const lake = polygonTests(P);
  const R = rng(91);

  // ---------- a água (o contorno do layout, a ilha vazada) ----------
  const shape = new THREE.Shape(P.map((p) => new THREE.Vector2(p.x, -p.z)));
  const hole = new THREE.Path();
  const RH = I.r - 0.12;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const hx = I.x + Math.cos(a) * RH, hz = -(I.z + Math.sin(a) * RH);
    if (i) hole.lineTo(hx, hz); else hole.moveTo(hx, hz);
  }
  shape.holes.push(hole);
  const waterMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2), lakeMat());
  waterMesh.name = 'recanto:lago-agua';
  waterMesh.position.y = WY;
  waterMesh.receiveShadow = true;
  root.add(waterMesh);
  const wm = /** @type {THREE.MeshStandardMaterial} */ (waterMesh.material);
  live.push((dt, t) => { wm.normalMap?.offset.set(t * 0.011, t * 0.007); });

  // ---------- a margem: faixa pisada na grama (2 cm no máximo), o barro molhado e o barranco até embaixo d'água ----------
  const SH = { dry: col('#a08d66'), mid: col('#86704f'), wet: col('#5e4b37'), bank: col('#4a3c2e'), deep: col('#2c251f') };
  const jit = (c, s, k) => c.clone().offsetHSL(0, 0, (vnoise2(s * 5.3 + k * 3.7, k) - 0.5) * 0.08);
  const shore = ribbon(pts, (p) => {
    let w2 = 0.16 + vnoise2(p.s * 0.9 + 7, 1.3) * 0.26;
    const ox = -p.nx; // para fora, no x: não passa do muro do leste
    if (ox > 0.01) w2 = Math.min(w2, (13.98 - p.x) / ox);
    const w1 = Math.min(0.05 + vnoise2(p.s * 1.7, 3.1) * 0.06, w2 * 0.6);
    return [
      [-w2, 0.005, jit(SH.dry, p.s, 1)],
      [-w1, 0.006, jit(SH.mid, p.s, 2)],
      [0, 0.004, jit(SH.wet, p.s, 3)],
      [0.035, -0.035, jit(SH.bank, p.s, 4)],
      [0.08, -0.1, jit(SH.bank, p.s, 5)],
      [0.15, -0.3, SH.deep],
    ];
  });
  kit.add(shore, { color: null, slot: 'ground', ...o, ao: false });
  // o raso na beira do lago e em volta da ilha (por cima da água, transparente)
  const SHAL = col('#93a26c');
  const shallowA = ribbon(pts, () => [[0.06, WY + 0.004, SHAL, 0.55], [0.18, WY + 0.004, SHAL, 0.3], [0.5, WY + 0.004, SHAL, 0]], true);
  const ipts = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ipts.push({ x: I.x + Math.cos(a) * 1.55, z: I.z + Math.sin(a) * 1.55, nx: Math.cos(a), nz: Math.sin(a), s: a * 1.55 });
  }
  const shallowB = ribbon(ipts, () => [[0, WY + 0.004, SHAL, 0.5], [0.12, WY + 0.004, SHAL, 0.28], [0.45, WY + 0.004, SHAL, 0]], true);
  const shallow = new THREE.Mesh(mergeGeometries([shallowA, shallowB]), shallowMat());
  shallowA.dispose();
  shallowB.dispose();
  shallow.name = 'recanto:lago-raso';
  shallow.renderOrder = 1;
  shallow.receiveShadow = true;
  root.add(shallow);

  // ---------- pedras: as grandes dentro d'água, as pequenas na margem (no máximo 15 cm do contorno) ----------
  const RV = [0, 1, 2, 3, 4, 5].map((k) => rockGeo(k * 7 + 3, 1));
  const PV = [0, 1, 2].map((k) => rockGeo(k * 5 + 11, 0));
  const gooseA = L.GOOSE.patrol[0], gooseB = L.GOOSE.patrol[1];
  const nearPier = (x, z) => x > Pr.x0 - 0.35 && x < Pr.x1 + 0.25 && z > Pr.z0 - 0.3 && z < Pr.z1 + 0.3;
  const nearChannel = (x, z) => x > Ch.x0 - 0.3 && x < Ch.x1 + 0.3 && z > Ch.z1 - 0.65;
  const nearGoose = (x, z) => {
    const dx = gooseB.x - gooseA.x, dz = gooseB.z - gooseA.z;
    const t = clamp01(((x - gooseA.x) * dx + (z - gooseA.z) * dz) / (dx * dx + dz * dz));
    return Math.hypot(x - gooseA.x - dx * t, z - gooseA.z - dz * t) < 0.35;
  };
  for (const p of pts) {
    if (R() > 0.3) continue;
    if (R() < 0.6) {
      const r = 0.07 + R() * 0.12;
      const d = Math.max(r - 0.09, 0.05) + R() * 0.16;
      const x = p.x + p.nx * d, z = p.z + p.nz * d;
      if (nearPier(x, z) || nearChannel(x, z) || nearGoose(x, z)) continue;
      kit.add(RV[Math.floor(R() * RV.length)], { color: null, x, y: WY + r * 0.08, z, sx: r * (0.9 + R() * 0.3), sy: r * (0.55 + R() * 0.2), sz: r * (0.8 + R() * 0.3), ry: R() * 6.28, ...o });
    } else {
      const r = 0.028 + R() * 0.034;
      const d = -(0.012 + R() * 0.06);
      const x = p.x + p.nx * d, z = p.z + p.nz * d;
      if (nearPier(x, z) || nearChannel(x, z)) continue;
      kit.add(R() < 0.5 ? PV[Math.floor(R() * PV.length)] : RV[Math.floor(R() * RV.length)], { color: null, x, y: r * 0.15, z, sx: r, sy: r * 0.6, sz: r * 0.85, ry: R() * 6.28, ...o });
    }
  }

  // ---------- taboas na água (nos cantos e longe do canal, da frente da câmera e do caminho da Dona Gansa) ----------
  const clumps = [0, 1, 2].map((k) => reedClump(31 + k * 17, { n: 16 + k * 3, h: 0.58 + k * 0.06, r: 0.12 + k * 0.015, heads: 2 + k }));
  /** [lado do contorno, posição nele (0..1), quanto para dentro d'água, escala] */
  const REEDS = [[0, 0.25, 0.28, 1.0], [1, 0.45, 0.27, 1.1], [1, 0.86, 0.23, 0.8], [2, 0.6, 0.26, 1.0], [3, 0.5, 0.25, 1.15], [4, 0.55, 0.27, 1.0], [5, 0.5, 0.27, 0.9], [11, 0.85, 0.28, 0.85], [12, 0.4, 0.26, 0.9], [14, 0.5, 0.26, 0.95]];
  REEDS.forEach(([ei, t, d, s], k) => {
    const e = edges[ei];
    if (!e) return;
    const x = e.a.x + (e.b.x - e.a.x) * t + e.nx * d, z = e.a.z + (e.b.z - e.a.z) * t + e.nz * d;
    kit.add(clumps[k % 3], { color: null, slot: 'plant', x, y: WY - 0.02, z, sx: s, sy: s * (0.9 + hash(k, 2) * 0.25), sz: s, ry: hash(k, 4) * 6.28, ...o, ao: false });
  });
  for (const [a, s] of [[3.6, 0.7], [4.3, 0.6]]) {
    kit.add(clumps[(s * 10) % 3 | 0], { color: null, slot: 'plant', x: I.x + Math.cos(a) * 1.68, y: WY - 0.02, z: I.z + Math.sin(a) * 1.68, sx: s, sy: s, sz: s, ry: a, ...o, ao: false });
  }

  // ---------- aguapés (alguns com flor), folhas e um galho da tempestade boiando ----------
  const pads = [lilyPad(5), lilyPad(9), lilyPad(13)];
  const flower = lilyFlower(4);
  const PADS = [[6.6, -1.3, 1], [9.6, -2.1, 0], [13.0, 0.6, 1], [12.35, 1.0, 0], [7.6, 3.9, 1], [8.6, 3.95, 0], [12.4, 3.6, 0], [9.0, -0.9, 0]];
  PADS.forEach(([px, pz, withFlower], k) => {
    const n = 2 + Math.floor(hash(k, 1) * 2);
    for (let j = 0; j < n; j++) {
      const a = hash(k, j + 3) * Math.PI * 2, d = j ? 0.12 + hash(k, j + 7) * 0.12 : 0;
      const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, r = 0.07 + hash(k, j + 11) * 0.07;
      kit.add(pads[(k + j) % 3], { color: null, slot: 'plant', x, y: WY + 0.008 + j * 0.003, z, sx: r, sy: r, sz: r, ry: hash(k, j + 13) * 6.28, ...o, ao: false });
      if (withFlower && j === 0) kit.add(flower, { color: null, slot: 'plant', x, y: WY + 0.009 + r * 0.05, z, ry: hash(k, 17) * 6.28, ...o, ao: false });
    }
  });
  const LEAF = leafGeo();
  for (let k = 0, tries = 0; k < 14 && tries < 400; tries++) {
    const x = 6.0 + R() * 7.6, z = -2.5 + R() * 6.9;
    if (!lake.inside(x, z) || lake.dist(x, z) < 0.25 || Math.hypot(x - I.x, z - I.z) < I.r + 0.15 || nearPier(x, z) || nearChannel(x, z)) continue;
    if (PADS.some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.45)) continue; // longe dos aguapés (nada coplanar)
    const s = 0.028 + R() * 0.02;
    kit.add(LEAF, { color: LEAVES[k % LEAVES.length], slot: 'plant', x, y: WY + 0.007, z, sx: s, sz: s * 0.5, ry: R() * 6.28, ...o, ao: false });
    k++;
  }
  const g0 = [12.0, WY + 0.012, -1.55], g1 = [12.32, WY + 0.016, -1.38], g2 = [12.55, WY + 0.012, -1.42], g3 = [12.42, WY + 0.012, -1.22];
  addLink(kit, g0, g1, 0.014, { color: '#6b4a2e', ...o }, 5);
  addLink(kit, g1, g2, 0.009, { color: '#6b4a2e', ...o }, 5);
  addLink(kit, g1, g3, 0.007, { color: '#6b4a2e', ...o }, 5);
  for (const [x, z, r] of [[12.02, -1.5, 0.3], [12.24, -1.33, 1.2], [12.5, -1.47, 2.4], [12.44, -1.18, 4.1], [12.6, -1.38, 5.0]]) {
    kit.add(LEAF, { color: '#6f8f3e', slot: 'plant', x, y: WY + 0.016, z, sx: 0.045, sz: 0.022, ry: r, ...o, ao: false });
  }

  // ---------- a ilha: morrinho de grama de pisar, a casinha de pato com a moita, as pedras do caminho ----------
  const C = { x: 10.4, z: 1.55 }; // o canto da casinha e da moita (colisor pedido: círculo de 0,32 m)
  const islandH = (x, z) => {
    const dx = x - I.x, dz = z - I.z;
    const a = Math.atan2(dz, dx);
    const r = Math.hypot(dx, dz) / (1 + 0.03 * Math.sin(3 * a + 1.2) + 0.02 * Math.sin(5 * a - 0.4));
    let h;
    if (r < 1.18) h = 0.012;
    else if (r < 1.42) h = 0.012 - 0.008 * smooth((r - 1.18) / 0.24);
    else if (r < 1.62) h = 0.004 - 0.15 * smooth((r - 1.42) / 0.2);
    else h = -0.146 - 0.18 * clamp01((r - 1.62) / 0.2);
    h += 0.098 * smoothstep(0.7, 0, Math.hypot(x - C.x, z - C.z));
    if (r < 1.3) h += (vnoise2(x * 9, z * 9) - 0.5) * 0.006;
    return h;
  };
  const mound = new THREE.Mesh(islandMound(I, islandH), SLOTS.ground());
  mound.name = 'recanto:ilha';
  mound.userData.walkable = true;
  mound.receiveShadow = true;
  root.add(mound);
  // a casinha de pato (porta redonda virada para a câmera, rampinha), a moita atrás e as flores
  const hx = C.x + 0.06, hz = C.z + 0.08, hry = 0.35;
  const hc = Math.cos(hry), hs = Math.sin(hry);
  const hat = (lx, lz) => ({ x: hx + lx * hc + lz * hs, z: hz - lx * hs + lz * hc });
  let hy = Infinity;
  for (const [lx, lz] of [[-0.16, -0.135], [0.16, -0.135], [-0.16, 0.135], [0.16, 0.135]]) { const q = hat(lx, lz); hy = Math.min(hy, islandH(q.x, q.z)); }
  hy -= 0.004;
  kit.add(rb(0.32, 0.035, 0.27, 0.01, 1), { color: '#9a7350', ...hat(0, 0), y: hy, ry: hry, ...o });
  kit.add(rb(0.25, 0.19, 0.2, 0.015, 1), { color: tone('#fff4e2', 0.03, 8, 4), ...hat(0, 0), y: hy + 0.035, ry: hry, ...o });
  kit.add(gableRoof(0.34, 0.27, 0.12), { color: tone('#c44b3c', 0.04, 7, 5), ...hat(0, 0), y: hy + 0.225, ry: hry, ...o });
  kit.add(new THREE.CircleGeometry(0.05, 16), { color: '#3a2a22', ...hat(0, 0.103), y: hy + 0.035 + 0.075, ry: hry, ...o, ao: false });
  kit.add(rb(0.07, 0.012, 0.18, 0.004, 1), { color: '#a07a52', ...hat(0, 0.18), y: hy + 0.02, rx: 0.32, ry: hry, ...o, ao: false });
  kit.add(cyl(0.006, 0.006, 0.06, 5).rotateZ(Math.PI / 2), { color: '#8a5a33', ...hat(0, 0.112), y: hy + 0.07, ry: hry, ...o, ao: false });
  const bush = foliageCluster([{ x: 0, y: 0.17, z: 0, r: 0.17 }, { x: 0.1, y: 0.13, z: 0.06, r: 0.13 }, { x: -0.09, y: 0.12, z: -0.05, r: 0.14 }], { detail: 1, amp: 0.2, freq: 5, seed: 6, dark: '#2f5226', mid: '#4f7f36', light: '#86ad52' });
  kit.add(bush, { color: null, slot: 'foliage', x: C.x - 0.1, y: islandH(C.x - 0.1, C.z - 0.08) - 0.02, z: C.z - 0.08, ...o });
  const yellow = flowerBush({ r: 0.09, seed: 12, flower: '#ffd23f', n: 5 }), white = flowerBush({ r: 0.075, seed: 14, flower: '#fff6ee', n: 4 });
  kit.add(yellow, { color: null, slot: 'foliage', x: C.x + 0.16, y: islandH(C.x + 0.16, C.z - 0.12) - 0.01, z: C.z - 0.12, ...o });
  kit.add(white, { color: null, slot: 'foliage', x: C.x - 0.17, y: islandH(C.x - 0.17, C.z + 0.12) - 0.01, z: C.z + 0.12, ...o });
  // as pedras chatas do caminho, do trapiche até o petisco
  [[10.86, 2.95, 0.1], [10.97, 2.62, 0.095], [11.08, 2.3, 0.1]].forEach(([x, z, r], k) => {
    kit.add(cyl(r, r + 0.006, 0.026, 11), { color: tone('#b3ab9e', 0.05, 9, k), x, y: islandH(x, z) - 0.019, z, sx: 1.1 - k * 0.05, sz: 0.9, ry: k * 1.3, ...o, ao: false });
  });
  // tufos de capim baixinhos (menos de 7 cm) e as pedras na beira da ilha (dentro d'água)
  const tuft = reedClump(77, { n: 7, h: 0.065, r: 0.035, heads: 0, tip: '#9cc25a', base: '#4f7a32' });
  for (let k = 0; k < 18; k++) {
    const a = hash(k, 21) * Math.PI * 2, rr = 0.75 + hash(k, 22) * 0.55;
    const x = I.x + Math.cos(a) * rr, z = I.z + Math.sin(a) * rr;
    if (Math.hypot(x - C.x, z - C.z) < 0.36 || (z > I.z + 0.9 && Math.abs(x - 10.95) < 0.3)) continue;
    kit.add(tuft, { color: null, slot: 'plant', x, y: islandH(x, z) - 0.004, z, ry: a, ...o, ao: false });
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + R() * 0.15, rr = 1.57 + R() * 0.1;
    const x = I.x + Math.cos(a) * rr, z = I.z + Math.sin(a) * rr;
    if (R() < 0.3 || (z > I.z + 1.0 && x > Ch.x0 - 0.15 && x < Ch.x1 + 0.15)) continue;
    const r = 0.06 + R() * 0.09;
    kit.add(RV[Math.floor(R() * RV.length)], { color: null, x, y: WY + r * 0.1, z, sx: r * (0.9 + R() * 0.3), sy: r * 0.65, sz: r * (0.8 + R() * 0.3), ry: R() * 6.28, ...o });
  }

  // ---------- o canal: duas muretas de pedra da margem até a ilha, o cais na margem e o trapiche na ilha ----------
  const islandZ = (x) => I.z + Math.sqrt(Math.max(0, I.r * I.r - (x - I.x) ** 2));
  for (const [wi, wx] of [[0, Ch.x0], [1, Ch.x1]]) {
    let z = Ch.z1 + 0.03, k = 0;
    const zEnd = islandZ(wx) - 0.04;
    while (z > zEnd + 0.04) {
      const len = Math.min(z - zEnd, 0.2 + hash(k, wi) * 0.12);
      const topY = 0.025 + (hash(k, wi + 3) - 0.5) * 0.012;
      const stone = (p) => {
        const wy = p.y - 0.32;
        const c = _c.set(hash(k, wi + 9) > 0.5 ? '#aaa397' : '#9d968a').offsetHSL(0, 0, (vnoise2(p.x * 20 + k, p.y * 20) - 0.5) * 0.08);
        if (wy < -0.07 && wy > -0.15) c.lerp(col('#5f6e3c'), 0.55); else if (wy <= -0.15) c.lerp(col('#4c463e'), 0.6);
        return c;
      };
      kit.add(rb(0.13, topY + 0.32, len - 0.008, 0.02, 1), { color: stone, x: wx, y: -0.32, z: z - len / 2, ry: (hash(k, wi + 5) - 0.5) * 0.04, ...o });
      z -= len;
      k++;
    }
  }
  const cw = (Ch.x1 - Ch.x0 + 0.14) / 4;
  for (let i = 0; i < 4; i++) {
    kit.add(rb(cw - 0.012, 0.03, 0.35, 0.008, 1), { color: tone(i % 2 ? '#b8b0a3' : '#aaa296', 0.04, 5, i), x: Ch.x0 - 0.07 + cw * (i + 0.5), y: -0.018, z: Ch.z1 + 0.105, ...o });
  }
  const WOODS = ['#b98d5f', '#a98053', '#c39a6b', '#b28659'];
  for (let i = 0; i < 3; i++) {
    kit.add(rb(Ch.x1 - Ch.x0 - 0.16, 0.03, 0.08, 0.008, 1), { color: tone(WOODS[i], 0.04, 6, i + 20), x: (Ch.x0 + Ch.x1) / 2, y: -0.015, z: Ch.z0 + 0.005 + i * 0.085, ...o });
  }
  for (const x of [Ch.x0 + 0.11, Ch.x1 - 0.11]) kit.add(cyl(0.028, 0.03, 0.34, 7), { color: '#5a4632', x, y: -0.35, z: Ch.z0 + 0.175, ...o });

  // ---------- o píer: tábuas e a rampa (chão de pisar), estacas, corrimão com corda, a boia e a lanterna ----------
  const Y = Pr.y, pcz = (Pr.z0 + Pr.z1) / 2, pd = Pr.z1 - Pr.z0;
  const n = Math.round((Pr.x1 - Pr.x0) / 0.147), pitch = (Pr.x1 - Pr.x0) / n, plankW = pitch - 0.012;
  const deckParts = [];
  for (let i = 0; i < n; i++) {
    const len = pd - 0.012 + (hash(i, 3) - 0.5) * 0.016;
    deckParts.push(part(rb(plankW, 0.035, len, 0.008, 1), tone(WOODS[i % 4], 0.045, 6, i), { x: Pr.x0 + pitch * (i + 0.5), y: Y - 0.035, z: pcz + (hash(i, 7) - 0.5) * 0.008, ry: (hash(i, 9) - 0.5) * 0.016 }));
  }
  // as longarinas e as travessas embaixo das tábuas (vão junto no chão de pisar: ficam por baixo dele)
  for (const z of [Pr.z0 + 0.09, Pr.z1 - 0.09]) deckParts.push(part(slab(Pr.x1 - Pr.x0 + 0.04, 0.07, 0.07), '#6f5238', { x: (Pr.x0 + Pr.x1) / 2, y: Y - 0.105, z }));
  const PILES = [Pr.x0 + 0.06, Pr.x0 + (Pr.x1 - Pr.x0) * 0.35, Pr.x0 + (Pr.x1 - Pr.x0) * 0.68, Pr.x1];
  for (const x of PILES) deckParts.push(part(slab(0.07, 0.07, pd + 0.06), '#64492f', { x, y: Y - 0.12, z: pcz }));
  // a rampa de subida, na margem (de 2 cm no chão até o convés)
  const rampX0 = Pr.x0 - 0.38, rampLen = Math.hypot(Pr.x0 - rampX0, Y - 0.02), th = Math.atan2(Y - 0.02, Pr.x0 - rampX0);
  for (let i = 0; i < 3; i++) {
    const s = 0.07 + 0.135 * i, xc = rampX0 + s * Math.cos(th), yt = 0.02 + s * Math.sin(th);
    deckParts.push(part(rb(0.12, 0.025, pd - 0.08, 0.008, 1), tone(WOODS[(i + 1) % 4], 0.045, 6, i + 40), { x: xc + 0.025 * Math.sin(th), y: yt - 0.025 * Math.cos(th), z: pcz, rz: th }));
  }
  for (const z of [Pr.z0 + 0.1, Pr.z1 - 0.1]) {
    const xm = rampX0 + (rampLen / 2) * Math.cos(th), ym = 0.02 + (rampLen / 2) * Math.sin(th) - 0.025;
    deckParts.push(part(rb(rampLen, 0.04, 0.05, 0.008, 1), '#6f5238', { x: xm + 0.04 * Math.sin(th), y: ym - 0.04 * Math.cos(th), z, rz: th }));
  }
  const pier = new THREE.Group();
  pier.name = 'recanto:pier-chao';
  pier.userData.walkable = true;
  const deck = new THREE.Mesh(mergeParts(deckParts), SLOTS.solid());
  deck.name = 'recanto:pier-tabuas';
  deck.castShadow = true;
  deck.receiveShadow = true;
  // o chão invisível exatamente no alto das tábuas (cobre as frestas: o raio do chão não cai entre elas)
  const flat = new THREE.Mesh(new THREE.PlaneGeometry(Pr.x1 - Pr.x0, pd).rotateX(-Math.PI / 2), ghostMat());
  flat.name = 'recanto:pier-piso';
  flat.position.set((Pr.x0 + Pr.x1) / 2, Y, pcz);
  const rampFlat = new THREE.Mesh(new THREE.PlaneGeometry(rampLen, pd - 0.06).rotateX(-Math.PI / 2).rotateZ(th), ghostMat());
  rampFlat.name = 'recanto:pier-rampa';
  rampFlat.position.set((rampX0 + Pr.x0) / 2, (0.02 + Y) / 2, pcz);
  pier.add(deck, flat, rampFlat);
  root.add(pier);
  // as estacas (madeira molhada e o limo na linha d'água) e o corrimão em cima delas, por fora do convés
  const cWet = col('#4f3e2d'), cAlgae = col('#5d6a39'), cWood = col('#8a6845');
  const pileCol = (p) => {
    const wy = p.y - 0.4;
    if (wy < -0.1) return cWet;
    if (wy < -0.045) return cAlgae;
    return _c.copy(cWood).offsetHSL(0, 0, (vnoise2(p.y * 9, p.x * 30 + p.z * 30) - 0.5) * 0.07);
  };
  const railY = 0.5, rz0 = Pr.z0 - 0.03, rz1 = Pr.z1 + 0.03;
  // as estacas passam 3 cm acima do corrimão (o topo delas não fica no mesmo plano do topo dele)
  for (const x of PILES) for (const z of [rz0, rz1]) kit.add(cyl(0.042, 0.048, railY + 0.43, 8), { color: pileCol, x, y: -0.4, z, ...o });
  for (const z of [rz0, rz1]) kit.add(rb(Pr.x1 - Pr.x0 + 0.03, 0.045, 0.06, 0.012, 1), { color: tone('#a07650', 0.04, 5, z), x: (Pr.x0 + Pr.x1) / 2 + 0.015, y: railY - 0.045, z, ...o });
  kit.add(rb(0.06, 0.04, rz1 - rz0, 0.012, 1), { color: tone('#a07650', 0.04, 5, 9), x: Pr.x1, y: railY - 0.043, z: pcz, ...o });
  const rope = (a, b) => {
    const mid = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.045, (a.z + b.z) / 2);
    kit.add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 8, 0.011, 5, false), { color: '#d8c59a', ...o, ao: false });
  };
  for (const z of [rz0, rz1]) for (let i = 0; i < PILES.length - 1; i++) rope(new THREE.Vector3(PILES[i], 0.33, z), new THREE.Vector3(PILES[i + 1], 0.33, z));
  rope(new THREE.Vector3(Pr.x1, 0.33, rz0), new THREE.Vector3(Pr.x1, 0.33, rz1));
  // a boia salva-vidas na ponta, virada para o leste (a câmera a vê), e a lanterna no mourão do sudeste
  const ring = new THREE.TorusGeometry(0.11, 0.032, 8, 20).rotateY(Math.PI / 2);
  const RED = col('#d9433a'), WHITE = col('#f6f1e8');
  kit.add(ring, { color: (p) => (Math.floor((Math.atan2(p.y, p.z) + Math.PI) / (Math.PI / 2)) % 2 ? RED : WHITE), x: Pr.x1 + 0.065, y: 0.31, z: pcz + 0.05, ...o, ao: false });
  addLink(kit, [Pr.x1 + 0.03, railY - 0.02, pcz + 0.05], [Pr.x1 + 0.065, 0.43, pcz + 0.05], 0.005, { color: '#d8c59a', ...o }, 4);
  const lanY = railY + 0.03;
  kit.add(rb(0.1, 0.02, 0.1, 0.006, 1), { color: '#3a3a40', x: Pr.x1, y: lanY, z: rz1, ...o, ao: false });
  kit.add(rb(0.075, 0.11, 0.075, 0.015, 1), { color: '#ffd36a', slot: 'lit', x: Pr.x1, y: lanY + 0.02, z: rz1, ...o, ao: false });
  kit.add(new THREE.ConeGeometry(0.07, 0.07, 4).rotateY(Math.PI / 4), { color: '#3a3a40', x: Pr.x1, y: lanY + 0.165, z: rz1, ...o, ao: false });
  kit.add(new THREE.TorusGeometry(0.012, 0.003, 4, 8), { color: '#3a3a40', x: Pr.x1, y: lanY + 0.21, z: rz1, ...o, ao: false });

  // ---------- a neblina baixa da manhã: manchas transparentes deitadas na água, andando devagar ----------
  /** [x, y, z, tamanho] */
  const MIST = [[8.6, -0.04, -1.5, 2.6], [12.55, -0.05, -0.4, 2.0], [8.4, -0.05, 3.15, 2.2], [12.9, 0.05, 2.2, 1.6], [9.6, 0.06, -1.0, 2.2], [7.0, 0.04, -0.4, 1.6]];
  const mist = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mistMat(), MIST.length);
  mist.name = 'recanto:neblina';
  mist.frustumCulled = false;
  mist.renderOrder = 2;
  mist.castShadow = false;
  mist.receiveShadow = false;
  const m4 = new THREE.Matrix4(), mq = new THREE.Quaternion(), mp = new THREE.Vector3(), ms = new THREE.Vector3();
  const placeMist = (t) => {
    MIST.forEach(([x, y, z, s], i) => {
      const k = 1 + 0.08 * Math.sin(t * 0.21 + i * 1.7);
      mp.set(x + Math.sin(t * 0.05 + i) * 0.4, WY + 0.12 + y, z + Math.cos(t * 0.04 + i * 2) * 0.3);
      ms.set(s * k * 1.25, 1, s * k * 0.8);
      mq.setFromAxisAngle(_up, i * 0.9 + t * 0.01);
      mist.setMatrixAt(i, m4.compose(mp, mq, ms));
    });
    mist.instanceMatrix.needsUpdate = true;
  };
  placeMist(0);
  root.add(mist);
  live.push((dt, t) => placeMist(t));
}

/**
 * O morrinho da ilha: grade polar em volta do centro, alturas por islandH, grama em cima, terra na beira, barro
 * molhado e o fundo escuro embaixo d'água. Faces para cima.
 */
function islandMound(I, islandH) {
  const RINGS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.18, 1.3, 1.42, 1.5, 1.57, 1.64, 1.75, 1.86];
  const SEG = 56;
  const grassA = col('#78a84a'), grassB = col('#9cc460'), dirt = col('#8a7652'), mud = col('#5b4835'), under = col('#3a3128');
  const pos = [], colr = [], c = new THREE.Color();
  const push = (x, z, r) => {
    const h = islandH(x, z);
    pos.push(x, h, z);
    if (h > 0.003 && r < 1.36) c.copy(grassA).lerp(grassB, vnoise2(x * 3.1, z * 3.1)).offsetHSL(0, 0, (vnoise2(x * 11, z * 11) - 0.5) * 0.05);
    else if (h > -0.03) c.copy(dirt).lerp(mud, clamp01(-h / 0.03));
    else c.copy(mud).lerp(under, clamp01((-h - 0.03) / 0.1));
    colr.push(c.r, c.g, c.b);
  };
  push(I.x, I.z, 0);
  for (let k = 1; k < RINGS.length; k++) {
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      push(I.x + Math.cos(a) * RINGS[k], I.z + Math.sin(a) * RINGS[k], RINGS[k]);
    }
  }
  const idx = [];
  for (let i = 0; i < SEG; i++) idx.push(0, 1 + ((i + 1) % SEG), 1 + i);
  for (let k = 1; k < RINGS.length - 1; k++) {
    for (let i = 0; i < SEG; i++) {
      const a = 1 + (k - 1) * SEG + i, b = 1 + (k - 1) * SEG + ((i + 1) % SEG);
      idx.push(a, b, b + SEG, a, b + SEG, a + SEG);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) {
    const ia = g.index.array;
    for (let t = 0; t < ia.length; t += 3) { const tmp = ia[t + 1]; ia[t + 1] = ia[t + 2]; ia[t + 2] = tmp; }
    g.computeVertexNormals();
  }
  return g;
}

// =====================================================================  LIXEIRA DE RODINHAS
/**
 * Lixeira verde de rodinhas: base quadrada de meia medida BIN.half, BIN.height até o alto da tampa, origem no chão,
 * no meio. A frente (com o painel) para o leste; a alça, a dobradiça e as rodas atrás (oeste), o eixo ao longo de z.
 * @param {THREE.Group} root @param {any} L
 */
function buildBin(root, L) {
  const Bn = L.BIN, H = Bn.height, hf = Bn.half;
  const group = new THREE.Group();
  group.name = 'recanto:lixeira';
  const GREEN = '#3c8a46', GREEN_D = '#2f7039';
  const halfW = (y) => 0.3 * (0.84 + 0.16 * (y / 0.86)); // o corpo afunila para baixo
  const taper = Math.atan(0.3 * 0.16 / 0.86);
  const parts = [];
  const body = rb(0.6, 0.86, 0.6, 0.05, 2);
  const bp = body.attributes.position;
  for (let i = 0; i < bp.count; i++) { const k = halfW(bp.getY(i)) / 0.3; bp.setX(i, bp.getX(i) * k); bp.setZ(i, bp.getZ(i) * k); }
  parts.push(part(body, (q) => _c.set(GREEN).offsetHSL(0, 0, (q.y < 0.14 ? -0.07 * (1 - q.y / 0.14) : 0) + (vnoise2(q.x * 7 + q.z * 7, q.y * 2.5) - 0.5) * 0.035)));
  parts.push(part(rb(0.63, 0.06, 0.63, 0.02, 1), GREEN_D, { y: 0.84 }));
  parts.push(part(rb(hf * 2, 0.05, hf * 2, 0.02, 2), GREEN_D, { y: 0.9 }));
  parts.push(part(rb(0.58, H - 0.95, 0.58, 0.025, 2), (q) => _c.set(GREEN).offsetHSL(0, 0, (vnoise2(q.x * 9, q.z * 9) - 0.5) * 0.03), { y: 0.95 }));
  parts.push(part(rb(0.03, 0.035, 0.34, 0.01, 1), GREEN_D, { x: hf - 0.015, y: 0.885 }));
  parts.push(part(rb(0.05, 0.05, 0.5, 0.015, 1), GREEN_D, { x: -hf + 0.025, y: 0.855 }));
  parts.push(part(cyl(0.018, 0.018, 0.46, 10).translate(0, -0.23, 0), '#2a5c31', { x: -hf + 0.02, y: 0.83, rx: Math.PI / 2 }));
  for (const s of [-1, 1]) parts.push(part(rb(0.05, 0.08, 0.035, 0.01, 1), GREEN_D, { x: -hf + 0.035, y: 0.79, z: s * 0.2 }));
  // nervuras nas laterais e o painel da frente, seguindo o afunilado
  for (const s of [-1, 1]) for (const x of [-0.13, 0.11]) parts.push(part(rb(0.04, 0.6, 0.014, 0.006, 1), GREEN_D, { x, y: 0.16, z: s * (halfW(0.16) + 0.004), rx: s * taper }));
  parts.push(part(rb(0.014, 0.4, 0.36, 0.01, 1), GREEN_D, { x: halfW(0.3) + 0.004, y: 0.3, rz: -taper }));
  parts.push(part(rb(0.06, 0.05, 0.4, 0.015, 1), '#2a5c31', { x: halfW(0) - 0.02, y: 0 }));
  // o adesivo de patinha (o símbolo do Recanto) na lateral do sul, que a câmera vê
  const zs = halfW(0.5) + 0.009;
  parts.push(part(new THREE.CircleGeometry(0.075, 20), '#f6f2e8', { x: 0.06, y: 0.5, z: zs, rx: taper }));
  for (const [dx, dy, r] of [[-0.03, 0.03, 0.013], [-0.01, 0.045, 0.013], [0.012, 0.045, 0.013], [0.032, 0.03, 0.013]]) parts.push(part(new THREE.CircleGeometry(r, 10), '#8e5a33', { x: 0.06 + dx, y: 0.5 + dy, z: zs + 0.004, rx: taper }));
  parts.push(part(new THREE.CircleGeometry(0.026, 14), '#8e5a33', { x: 0.06, y: 0.485, z: zs + 0.004, rx: taper, sx: 1.15, sy: 0.85 }));
  // uma folha da tempestade grudada na tampa
  parts.push(part(leafGeo(), '#c98a3a', { x: 0.07, y: H + 0.003, z: -0.06, sx: 0.04, sz: 0.02, ry: 0.7 }));
  const mesh = new THREE.Mesh(mergeParts(parts), SLOTS.solid());
  mesh.name = 'recanto:lixeira-corpo';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // as rodas (pneu, cubo) e o eixo: uma malha que gira em volta do eixo (z) quando a lixeira anda no x
  const WR = 0.09, wz = halfW(0.09) + 0.03;
  const wparts = [];
  for (const s of [-1, 1]) {
    wparts.push(part(cyl(WR, WR, 0.045, 16).translate(0, -0.0225, 0), '#2b2b2e', { z: s * wz, rx: Math.PI / 2 }));
    wparts.push(part(cyl(0.045, 0.045, 0.05, 10).translate(0, -0.025, 0), '#a2a8ae', { z: s * wz, rx: Math.PI / 2 }));
    wparts.push(part(cyl(0.016, 0.016, 0.056, 8).translate(0, -0.028, 0), '#6c7278', { z: s * wz, rx: Math.PI / 2 }));
  }
  wparts.push(part(cyl(0.012, 0.012, 2 * wz + 0.04, 6).translate(0, -wz - 0.02, 0), '#55595e', { rx: Math.PI / 2 }));
  const wheels = new THREE.Mesh(mergeParts(wparts), SLOTS.solid());
  wheels.name = 'recanto:lixeira-rodas';
  wheels.position.set(-hf + WR + 0.005, WR, 0);
  wheels.castShadow = true;
  const shadow = contactShadow(hf + 0.06, hf + 0.06, 0.38, 0.006);
  shadow.name = 'recanto:lixeira-sombra';
  group.add(mesh, wheels, shadow);
  root.add(group);
  let lastX = null, spin = 0;
  const setPos = (x, z) => {
    if (lastX !== null) { spin -= (x - lastX) / WR; wheels.rotation.z = spin; }
    lastX = x;
    group.position.set(x, 0, z);
  };
  return {
    prop: { object: group, setPos },
    see: [mesh, wheels],
    reset() { lastX = null; spin = 0; wheels.rotation.z = 0; setPos(Bn.start.x, Bn.start.z); },
  };
}

// =====================================================================  BARQUINHO DE PEDAL (patinho)
/**
 * Pedalinho de patinho amarelo: base quadrada de meia medida BOAT.half, BOAT.height até o topete; origem no chão (o
 * fundo do casco), no meio. A cabeça para o leste e a cauda para o oeste: no canal, a Radhija atravessa pelo meio do
 * convés de tábuas, do sul (margem) para o norte (ilha). O convés fica a 0,30 m do fundo; boiando (y = floatY), o
 * fundo fica 3 cm dentro d'água e o convés a 0,15 m.
 * @param {THREE.Group} root @param {any} L @param {((dt: number, t: number) => void)[]} live
 */
function buildBoat(root, L, live) {
  const Bt = L.BOAT, WY = L.LAKE.waterY;
  const DECK = 0.3, RIMY = 0.29, FLOAT_Y = WY - 0.03;
  const group = new THREE.Group();
  group.name = 'recanto:barquinho';
  const float = new THREE.Group();
  group.add(float);
  const HA = 0.46, HB = 0.47, E = 2.6;
  /** A planta (superelipse um pouco mais estreita na popa) no ângulo a, na escala k. */
  const planAt = (a, k) => {
    const c = Math.cos(a), s = Math.sin(a);
    const px = Math.sign(c) * Math.abs(c) ** (2 / E), pz = Math.sign(s) * Math.abs(s) ** (2 / E);
    return [px * HA * k, pz * HB * k * (px < 0 ? 1 - 0.12 * px * px : 1)];
  };
  const zExt = (x, k = 1) => { const u = Math.min(1, Math.abs(x) / (HA * k)); return HB * k * (1 - u ** E) ** (1 / E) * (x < 0 ? 1 - 0.12 * u * u : 1); };
  const parts = [];
  // o casco: anéis da planta subindo (fundo chato, bojo e a borda um pouco para dentro)
  const PROF = [[0, 0.72], [0.025, 0.84], [0.07, 0.93], [0.14, 0.985], [0.21, 1.0], [RIMY, 0.985]];
  const SEG = 44;
  const hp = [0, 0, 0], hc = [];
  const cTop = col('#ffcf33'), cBot = col('#e2a21c'), cc = new THREE.Color();
  hc.push(cBot.r, cBot.g, cBot.b);
  for (const [y, k] of PROF) {
    for (let i = 0; i < SEG; i++) {
      const [x, z] = planAt((i / SEG) * Math.PI * 2, k);
      hp.push(x, y, z);
      cc.copy(cBot).lerp(cTop, smooth(y / 0.2));
      hc.push(cc.r, cc.g, cc.b);
    }
  }
  const hi = [];
  for (let i = 0; i < SEG; i++) hi.push(0, 1 + i, 1 + ((i + 1) % SEG));
  for (let j = 0; j < PROF.length - 1; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = 1 + j * SEG + i, b = 1 + j * SEG + ((i + 1) % SEG);
      hi.push(a, b + SEG, b, a, a + SEG, b + SEG);
    }
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
  hull.setAttribute('color', new THREE.Float32BufferAttribute(hc, 3));
  hull.setIndex(hi);
  hull.computeVertexNormals();
  parts.push(hull);
  // o convés de tábuas (de bombordo a boreste) e o fundo escuro que aparece nas frestas
  parts.push(part(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), '#5a3d26', { y: DECK - 0.024, sx: HA * 0.96, sz: HB * 0.96 }));
  const NP = 13, PP = 0.064;
  for (let i = 0; i < NP; i++) {
    const x = (i - (NP - 1) / 2) * PP;
    parts.push(part(slab(0.058, 0.012, 2 * zExt(x, 0.955)), tone(['#c68e55', '#b9824b', '#cf9a62'][i % 3], 0.04, 8, i), { x, y: DECK - 0.012 }));
  }
  // a borda de borracha laranja
  const rimPts = [];
  for (let i = 0; i < 56; i++) { const [x, z] = planAt((i / 56) * Math.PI * 2, 0.985); rimPts.push(new THREE.Vector3(x, RIMY, z)); }
  parts.push(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 72, 0.022, 6, true), '#ff8a1e'));
  // as asas nas laterais
  for (const s of [-1, 1]) parts.push(part(new THREE.SphereGeometry(1, 14, 10), '#f4b324', { x: -0.05, y: 0.19, z: s * 0.46, sx: 0.2, sy: 0.085, sz: 0.035, rz: 0.15 }));
  // a cabeça (pescoço, bochechas, olhos com brilho, bico) e o topete
  const HX = 0.33, HY = 0.45, HR = 0.125;
  parts.push(part(cyl(0.075, 0.09, 0.15, 14), '#ffcf33', { x: HX, y: DECK - 0.02 }));
  parts.push(part(new THREE.SphereGeometry(HR, 18, 14), (q) => _c.copy(cTop).offsetHSL(0, 0, q.y * 0.15), { x: HX, y: HY }));
  parts.push(part(new THREE.SphereGeometry(0.05, 12, 8), '#ff8a1e', { x: HX + 0.08, y: HY - 0.005, sx: 1.25, sy: 0.38, sz: 0.95 }));
  parts.push(part(new THREE.SphereGeometry(0.045, 12, 8), '#e9761a', { x: HX + 0.075, y: HY - 0.025, sx: 1.1, sy: 0.3, sz: 0.85 }));
  for (const s of [-1, 1]) {
    parts.push(part(new THREE.SphereGeometry(0.02, 10, 8), '#1f1510', { x: HX + 0.0775, y: HY + 0.0525, z: s * 0.0825 }));
    parts.push(part(new THREE.SphereGeometry(0.006, 6, 4), '#ffffff', { x: HX + 0.09, y: HY + 0.062, z: s * 0.094 }));
    parts.push(part(new THREE.SphereGeometry(0.026, 10, 8), '#f7a6a0', { x: HX + 0.069, y: HY - 0.006, z: s * 0.104, sy: 0.75, sz: 0.35 }));
  }
  for (const [dz, rx] of [[-0.012, -0.3], [0.012, 0.3]]) parts.push(part(new THREE.ConeGeometry(0.018, 0.06, 6), '#ffcf33', { x: HX - 0.03, y: HY + HR - 0.012, z: dz, rx, rz: 0.5 }));
  // a caixa da roda de pá na popa (branca com a faixa vermelha) e a cauda arrebitada em cima dela
  parts.push(part(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 14, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), '#f7f2e8', { x: -0.33, y: DECK }));
  parts.push(part(new THREE.CylinderGeometry(0.103, 0.103, 0.03, 14, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), '#e8463c', { x: -0.33, y: DECK }));
  parts.push(part(new THREE.ConeGeometry(0.075, 0.17, 12), '#ffcf33', { x: -0.4, y: DECK + 0.12, sz: 0.6, rz: 0.9 }));
  // a bandeirinha no canto de trás (fora do corredor por onde a Radhija passa)
  const fl = link([-0.3, DECK, -0.33], [-0.3, 0.58, -0.33], 0.006, 5);
  parts.push(part(fl.g, '#f4efe6', { x: fl.x, y: fl.y, z: fl.z }));
  const pennant = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.13, -0.035), new THREE.Vector2(0, -0.07)]));
  parts.push(part(doubleSide(pennant), '#e8463c', { x: -0.3, y: 0.575, z: -0.33 }));
  const mesh = new THREE.Mesh(mergeParts(parts), SLOTS.solid());
  mesh.name = 'recanto:barquinho-casco';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  float.add(mesh);
  // o chão de pisar do convés (invisível, no alto das tábuas): só vale com o barquinho no canal
  const walk = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), ghostMat());
  walk.name = 'recanto:barquinho-convés';
  walk.scale.set(HA * 0.95, 1, HB * 0.97);
  walk.position.y = DECK;
  walk.userData.walkable = true;
  walk.userData.moving = true;
  float.add(walk);
  // a espuma em volta do casco na linha d'água (só boiando) e a sombra de contato (só na grama)
  const fp = [], fc = [], fi = [];
  const FS = 40;
  for (let i = 0; i < FS; i++) {
    const a = (i / FS) * Math.PI * 2;
    const [ix, iz] = planAt(a, 0.8), [ox, oz] = planAt(a, 1.2);
    fp.push(ix, 0, iz, ox, 0, oz);
    fc.push(1, 1, 1, 0.55, 1, 1, 1, 0);
    const j = (i + 1) % FS;
    fi.push(2 * i, 2 * j, 2 * j + 1, 2 * i, 2 * j + 1, 2 * i + 1);
  }
  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  foamGeo.setAttribute('color', new THREE.Float32BufferAttribute(fc, 4));
  foamGeo.setIndex(fi);
  foamGeo.computeVertexNormals();
  if (foamGeo.attributes.normal.getY(0) < 0) {
    const ia = foamGeo.index.array;
    for (let t = 0; t < ia.length; t += 3) { const tmp = ia[t + 1]; ia[t + 1] = ia[t + 2]; ia[t + 2] = tmp; }
  }
  const foam = new THREE.Mesh(foamGeo, foamMat());
  foam.name = 'recanto:barquinho-espuma';
  foam.renderOrder = 2;
  const shadow = contactShadow(HA + 0.1, HB + 0.1, 0.32, 0.006);
  shadow.name = 'recanto:barquinho-sombra';
  group.add(foam, shadow);
  root.add(group);
  const dock = Bt.dock;
  let floating = false;
  const setPos = (x, z, y = 0, tilt = 0) => {
    group.position.set(x, y, z);
    group.rotation.x = -tilt; // tilt > 0: o lado norte (o que entra no canal) afunda
    floating = y < -0.02;
    foam.visible = floating;
    foam.position.y = WY + 0.004 - y;
    shadow.visible = !floating;
    walk.visible = Math.hypot(x - dock.x, z - dock.z) < 0.35;
    if (!floating) { float.position.y = 0; float.rotation.set(0, 0, 0); }
  };
  live.push((dt, t) => {
    if (!floating) return;
    // boiando: sobe e desce de leve e balança
    float.position.y = Math.sin(t * 1.4) * 0.004;
    float.rotation.set(Math.sin(t * 1.1) * 0.008, 0, Math.sin(t * 0.9 + 0.7) * 0.012);
  });
  return {
    prop: { object: group, setPos, floatY: FLOAT_Y, deckY: DECK },
    see: [mesh],
    reset() { setPos(Bt.start.x, Bt.start.z, 0, 0); },
  };
}
