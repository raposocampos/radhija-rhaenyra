// =====================================================================
//  MODO HISTÓRIA · Recanto das Patinhas — o LESTE do condomínio (cap. 1), visto de perto e de baixo (3ª pessoa).
//  Coordenadas em ../layout.js.
//   GUARITA (nordeste, 2,4 × 2,4 m): reboco manchado com pilares de canto, rodapé e barrado de pastilhas; o guichê do
//     sul, embaixo do toldo, FECHADO (duas folhas de vidro com caixilho; lá dentro, escuro, o radinho no balcão) até a
//     folha do leste correr para trás da outra (props.booth.setWindow); a GRELHA de ventilação na face oeste, rente ao
//     chão (moldura de alumínio saliente, ripas inclinadas e a plaquinha do vento: o Superbafo entra por ela); a porta
//     fechada e a janelinha de cortina na face leste (o lado do portãozinho); a laje com beiral, cachorros e
//     platibanda, a antena espinha-de-peixe com estais (a meia é de atores.js: o lugar dela no mastro fica livre), a
//     parabólica e o buzinote pingando; o toldo de chapa listrada com mãos-francesas (firme: a Radhija pisa nele), a
//     arandela, a câmera, o interfone, a campainha, o quadro de luz e a floreira.
//   LIXEIRA de rodinhas (verde, tampa, alça, duas rodas que giram quando ela anda e os adesivos de reciclagem).
//   LAGO: a água no contorno do layout (o fundo escuro no meio, o raso claro na beira, brilhos e a neblina da manhã),
//     a margem de areia e grama com a prainha do barquinho ao sul, pedras, taboas e juncos, vitórias-régias e ninfeias,
//     folhas e um galho da tempestade boiando, a pata com os patinhos nadando longe; a ILHA (morrinho de pisar, a
//     casinha dos patos embaixo do salgueiro, a moita, o ninho, as pedras do caminho), o PÍER da Dona Gansa (tábuas,
//     estacas, corrimão com corda, boia, lanterna e, na entrada, os mourões altos com a placa da gansa brava e as
//     bandeirinhas) e o CANAL de pedra com os cabeços de amarrar.
//   BARQUINHO de pedal (patinho amarelo de lenço): convés de tábuas com duas pranchas dobradas em cima, que descem para
//     a margem e para a ilha quando ele encaixa no canal (a ponte cobre o canal inteiro).
//   Em volta: capim, florzinhas, trevos e folhas soltas, rentes ao chão e sem colisão (a zona 'capim-leste').
//   Nada aqui pede colisor novo: o que fica em pé está dentro dos colisores do layout (guarita, píer, canal, casinha
//   da ilha) e o que fica dentro d'água tem o alto a menos de 8 cm do chão.
// API: buildLeste(kit, root, L) → { props: { booth, bin, boat }, seeThrough, update(dt, t), reset(), dispose(), signs }
//   booth: { radio: { setOn(on) }, windowAnchor: { x, y, z }, setWindow(k), vent: { x, y, z }, setVentPuff(k) }
//   bin: { object, setPos(x, z) } · boat: { object, setPos(x, z, y?, tilt?), floatY, deckY }
// Chão de pisar (src/game/ground.js): o convés do píer e a rampa, o morrinho da ilha e o convés do barquinho com as
// pranchas (este só quando ele está no canal). Fora disso, o que fica no chão por onde as dogs andam tem o alto até 3 cm.
// =====================================================================
import * as THREE from 'three';
import { rng, vnoise2, fbm3, mat, smoothstep, radialTexture, foliageCluster, paint, mergeGeometries, mergeVertices, contactShadow } from '../../../../world/util.js';
import { SLOTS, rb, cyl, sphere, slab, tiles, tilesV, gableRoof } from '../../../../levels/mapa/world/kit.js';
import { waterMat, flowerBush } from '../../../../levels/mapa/world/pecas.js';

/** As zonas do kit (uma malha por material em cada uma: o recorte da câmera tira a que está fora de vista). */
const GB = 'guarita';
const GL = 'lago';
/** As plantinhas rentes ao chão em volta do lago e da guarita (o nome isenta de colisor: as dogs passam roçando). */
const GC = 'capim-leste';

const col = (hex) => new THREE.Color(hex);
const _c = new THREE.Color();
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => { const u = clamp01(t); return u * u * (3 - 2 * u); };
/** Sorteio estável (0..1) por célula: pastilhas, tábuas, pedras. */
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- materiais próprios (cache da aplicação)
/** A água do lago: a do mapa um pouco mais funda, com as ondinhas na escala do lago (a textura anda devagar). */
const lakeMat = () => mat('recanto-leste-agua', () => {
  const base = waterMat();
  const m = base.clone();
  m.color.set('#4496bd');
  const n = base.normalMap.clone();
  n.repeat.set(0.7, 0.7);
  n.needsUpdate = true;
  m.normalMap = n;
  m.normalScale = new THREE.Vector2(0.3, 0.3);
  return m;
});
/** O raso na beira (cor com transparência por vértice, em cima da água). */
const shallowMat = () => mat('recanto-leste-raso', () => new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.3, metalness: 0 }));
/** O fundo: manchas escuras no meio do lago (com luz: de noite não aparecem). */
const deepMat = () => mat('recanto-leste-fundo', () => new THREE.MeshLambertMaterial({ map: radialTexture(), color: '#1c4d70', transparent: true, opacity: 0.62, depthWrite: false }));
/** Os brilhos do sol na água (com luz: de noite somem). */
const sparkleMat = () => mat('recanto-leste-brilho', () => new THREE.MeshLambertMaterial({ map: radialTexture(), color: '#fffbe6', transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
/** Vidro das janelas da guarita: dá para ver o escuro de dentro e o radinho. */
const glassMat = () => mat('recanto-leste-vidro', () => new THREE.MeshStandardMaterial({ color: '#a8cbdb', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide }));
/** Chão de pisar invisível (cobre as frestas das tábuas): não pinta nem escreve profundidade. */
const ghostMat = () => mat('recanto-leste-chao', () => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
/** A neblina baixa por cima do lago (com luz: na noite da abertura ela some no escuro, não brilha). */
const mistMat = () => mat('recanto-leste-neblina', () => new THREE.MeshLambertMaterial({ map: radialTexture(), color: '#fff5ec', transparent: true, opacity: 0.2, depthWrite: false }));
/** A espuma em volta do barquinho na água. */
const foamMat = () => mat('recanto-leste-espuma', () => new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
/** O fiapo de cheiro que a grelha da guarita puxa (some quando o sopro acaba). */
const wispMat = () => mat('recanto-leste-fiapo', () => new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#e2f4c0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));

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
/** Parede: caixa com a base em y = 0 e as faces repartidas (~18 cm), para o reboco manchar por vértice. */
function wallBox(w, h, d, cell = 0.18) {
  const n = (v) => Math.max(1, Math.round(v / cell));
  return new THREE.BoxGeometry(w, h, d, n(w), n(h), n(d)).translate(0, h / 2, 0);
}

const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
/** Haste de a até b ([x, y, z]): a geometria já deitada na direção, centrada, e o meio dela (r1: o raio na ponta b). */
function link(a, b, r, seg = 6, r1 = r) {
  _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = _v.length();
  const g = new THREE.CylinderGeometry(r1, r, len, seg);
  g.applyQuaternion(_q.setFromUnitVectors(_up, _v.normalize()));
  return { g, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2 };
}
/** Haste de a até b direto no kit. */
function addLink(kit, a, b, r, opts, seg = 6, r1 = r) {
  const l = link(a, b, r, seg, r1);
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
/** Triângulo chato voltado para +z (a, b, c no sentido anti-horário: [x, y]). */
function tri2(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a[0], a[1], 0, b[0], b[1], 0, c[0], c[1], 0], 3));
  g.computeVertexNormals();
  return g;
}
/** Retângulo voltado para cima entre duas beiradas (x de xa a xb; a beirada A em (ya, za), a B em (yb, zb)). */
function quadUp(xa, xb, ya, za, yb, zb) {
  const g = new THREE.BufferGeometry();
  const P = zb > za ? [xa, ya, za, xb, yb, zb, xb, ya, za, xa, ya, za, xa, yb, zb, xb, yb, zb] : [xa, ya, za, xb, ya, za, xb, yb, zb, xa, ya, za, xb, yb, zb, xa, yb, zb];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- pictogramas (chatos, voltados para +z, centrados)
/** Adesivo de reciclagem: três setas em roda num disco claro de raio r. */
function recycleSticker(r) {
  const GREEN = '#2e8b47';
  const parts = [part(new THREE.CircleGeometry(r, 24), '#f6f2e8')];
  for (let k = 0; k < 3; k++) {
    const a0 = Math.PI / 2 + (k * Math.PI * 2) / 3 + 0.2, len = 1.35;
    parts.push(part(new THREE.RingGeometry(r * 0.4, r * 0.62, 8, 1, a0, len), GREEN, { z: 0.002 }));
    const a1 = a0 + len - 0.02, a2 = a1 + 0.52;
    parts.push(part(tri2([Math.cos(a1) * r * 0.27, Math.sin(a1) * r * 0.27], [Math.cos(a1) * r * 0.76, Math.sin(a1) * r * 0.76], [Math.cos(a2) * r * 0.51, Math.sin(a2) * r * 0.51]), GREEN, { z: 0.002 }));
  }
  return mergeParts(parts);
}
/** A patinha (o símbolo do Recanto) num disco de raio r. */
function pawSticker(r, bg = '#f6f2e8', fg = '#8e5a33') {
  const parts = [part(new THREE.CircleGeometry(r, 24), bg)];
  for (const [dx, dy] of [[-0.42, 0.3], [-0.15, 0.54], [0.15, 0.54], [0.42, 0.3]]) parts.push(part(new THREE.CircleGeometry(r * 0.16, 10), fg, { x: dx * r, y: dy * r, z: 0.002 }));
  parts.push(part(new THREE.CircleGeometry(r * 0.33, 14), fg, { y: -0.16 * r, z: 0.002, sx: 1.15, sy: 0.85 }));
  return mergeParts(parts);
}
/** Plaquinha do vento (três ondas brancas no esmalte azul), w × h. */
function windPlate(w, h) {
  const parts = [part(rb(w, h, 0.008, 0.004, 1).translate(0, -h / 2, 0), '#2f7fb8')];
  const r = w * 0.11;
  for (let k = 0; k < 3; k++) {
    for (let j = 0; j < 3; j++) {
      // meias-voltas para cima e para baixo, alternadas: uma onda
      parts.push(part(new THREE.TorusGeometry(r, 0.0045, 3, 8, Math.PI), '#ffffff', { x: (j - 1) * 2 * r, y: (k - 1) * h * 0.27, z: 0.006, rz: j % 2 ? Math.PI : 0 }));
    }
  }
  return mergeParts(parts);
}
/** A placa da gansa brava (losango amarelo de borda escura, a gansa branca de cara fechada), lado ~0,3 m. */
function gooseSign() {
  const parts = [];
  parts.push(part(rb(0.32, 0.32, 0.012, 0.03, 1).translate(0, -0.16, 0), '#2f2a26', { z: -0.002, rz: Math.PI / 4 }));
  parts.push(part(rb(0.28, 0.28, 0.012, 0.025, 1).translate(0, -0.14, 0), '#f4c430', { z: 0.002, rz: Math.PI / 4 }));
  const Z = 0.0095, WHITE = '#fbf8f0', ORANGE = '#f08a24';
  parts.push(part(new THREE.CircleGeometry(0.058, 16), WHITE, { x: -0.014, y: -0.04, z: Z, sx: 1.2, sy: 0.8 }));
  parts.push(part(new THREE.CircleGeometry(0.03, 10), '#d9d4c8', { x: -0.03, y: -0.036, z: Z + 0.001, sx: 1.25, sy: 0.7, rz: -0.25 }));
  parts.push(part(new THREE.PlaneGeometry(0.024, 0.09), WHITE, { x: 0.04, y: 0.014, z: Z, rz: -0.14 }));
  parts.push(part(new THREE.CircleGeometry(0.025, 12), WHITE, { x: 0.048, y: 0.064, z: Z }));
  parts.push(part(tri2([0.066, 0.05], [0.108, 0.056], [0.066, 0.072]), ORANGE, { z: Z }));
  parts.push(part(new THREE.CircleGeometry(0.0055, 8), '#1f1510', { x: 0.053, y: 0.068, z: Z + 0.001 }));
  parts.push(part(tri2([0.038, 0.084], [0.064, 0.074], [0.064, 0.081]), '#1f1510', { z: Z + 0.001 }));
  for (const x of [-0.026, 0.004]) parts.push(part(new THREE.PlaneGeometry(0.009, 0.032), ORANGE, { x, y: -0.098, z: Z }));
  return mergeParts(parts);
}

// ---------------------------------------------------------------- o contorno do lago
/**
 * O contorno em pontos próximos (a cada ~`step` m), com a normal para DENTRO da água (meia-esquadria nos cantos), o
 * comprimento acumulado e os lados. w2, wg, bk: as larguras da areia e da grama e a prainha (quem monta a margem preenche).
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
    pts.push({ x: e.a.x, z: e.a.z, nx: mx * k, nz: mz * k, s: acc, edge: i, w2: 0, wg: 0, bk: 0 });
    const m = Math.max(1, Math.round(e.len / step));
    for (let j = 1; j < m; j++) {
      const t = j / m;
      pts.push({ x: e.a.x + (e.b.x - e.a.x) * t, z: e.a.z + (e.b.z - e.a.z) * t, nx: e.nx, nz: e.nz, s: acc + e.len * t, edge: i, w2: 0, wg: 0, bk: 0 });
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
/** A distância de (x, z) até uma linha quebrada de pontos { x, z }. */
function polylineDist(line, x, z) {
  let m = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp01(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1));
    m = Math.min(m, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
  }
  return m;
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

// ---------------------------------------------------------------- peças do lago e do gramado
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
/**
 * Touceira de folhas finas curvadas (do verde ao palha): taboa (com as espigas marrons), junco ou capim. Base em y = 0.
 * wide: a largura das lâminas; headLen/headR: a espiga.
 */
function reedClump(seed, { n = 16, h = 0.6, r = 0.12, heads = 3, tip = '#a5bb5e', base = '#4a6630', wide = 1, headLen = 0.09, headR = 0.017 } = {}) {
  const R = rng(seed);
  const pos = [], cols = [], idx = [];
  const cBase = col(base), cTip = col(tip), cDry = col('#c4a862'), c = new THREE.Color();
  let v = 0;
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * r;
    const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
    const hh = h * (0.5 + R() * 0.6), w = h * (0.018 + R() * 0.012) * wide;
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
    const stem = link([bx, 0, bz], [tx, hh, tz], 0.0045 + h * 0.002, 3);
    parts.push(part(stem.g, '#6d8a3e', { x: stem.x, y: stem.y, z: stem.z }));
    parts.push(part(cyl(headR, headR, headLen, 6), '#6a4126', { x: tx, y: hh - headLen - 0.01, z: tz }));
    parts.push(part(cyl(0.003, 0.003, 0.05, 3), '#7d6a45', { x: tx, y: hh - 0.01, z: tz }));
  }
  return mergeParts(parts);
}
/** Folha de ninfeia (disco com o corte), borda um pouco erguida. Raio 1, deitada. */
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
/** Flor de ninfeia (pétalas em dois anéis e o miolo amarelo); `a` e `b`: as cores de fora e de dentro. */
function lilyFlower(seed, a = '#f5afcb', b = '#fbd6e5') {
  const R = rng(seed);
  const parts = [];
  for (const [n, rr, y, s, k] of [[8, 0.024, 0.008, 1, 0], [6, 0.013, 0.018, 0.75, 1]]) {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + R() * 0.25;
      parts.push(part(new THREE.SphereGeometry(1, 4, 2), k ? b : a, { x: Math.cos(ang) * rr, y, z: Math.sin(ang) * rr, sx: 0.011 * s, sy: 0.007 * s, sz: 0.026 * s, ry: Math.PI / 2 - ang }));
    }
  }
  parts.push(part(new THREE.SphereGeometry(0.009, 6, 4), '#f2c230', { y: 0.022 }));
  return mergeParts(parts);
}
/** Vitória-régia: o prato grande com a beirada erguida (raio 1, deitado), gomos claros e escuros e o avesso avermelhado. */
function victoriaPad(seed) {
  const SEG = 22;
  const disc = new THREE.CircleGeometry(1, SEG).rotateX(-Math.PI / 2);
  const cA = col('#4c8c3c'), cB = col('#79b450'), cMid = col('#3f7a36'), c = new THREE.Color();
  let i = 0;
  paint(disc, (p) => {
    const rr = Math.hypot(p.x, p.z);
    if (rr < 0.01) return c.copy(cMid);
    return c.copy(i++ % 2 ? cA : cB).offsetHSL(0, 0, (hash(seed, i) - 0.5) * 0.03);
  });
  const rim = new THREE.CylinderGeometry(1.04, 1.0, 0.075, SEG, 1, true).translate(0, 0.0375, 0);
  const cTop = col('#8fc25c'), cLow = col('#8a4a4f');
  paint(rim, (p) => (p.y > 0.04 ? cTop : cLow));
  return mergeParts([disc, rim]);
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
/** Tufinho de florzinhas do gramado: hastes finas, a flor (um losango achatado), o miolo e folhas na base. Base em y = 0. */
function flowerPatch(seed, petal, center = '#f2c230') {
  const R = rng(seed);
  const parts = [];
  const n = 5 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 0.14;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.06 + R() * 0.07;
    const tx = x + (R() - 0.5) * 0.02, tz = z + (R() - 0.5) * 0.02;
    const st = link([x, 0, z], [tx, h, tz], 0.003, 3);
    parts.push(part(st.g, '#5f8a3a', { x: st.x, y: st.y, z: st.z }));
    parts.push(part(new THREE.OctahedronGeometry(0.021), petal, { x: tx, y: h, z: tz, sy: 0.4, ry: R() * 3 }));
    parts.push(part(new THREE.OctahedronGeometry(0.008), center, { x: tx, y: h + 0.007, z: tz }));
  }
  for (let i = 0; i < 3; i++) {
    const a = R() * Math.PI * 2;
    parts.push(part(leafGeo(), '#5f8f3a', { x: Math.cos(a) * 0.06, y: 0.014, z: Math.sin(a) * 0.06, sx: 0.045, sz: 0.018, ry: -a, rz: 0.35 }));
  }
  return mergeParts(parts);
}
/** Moitinha de trevos (três folhinhas cada; um ou outro de quatro) com duas florzinhas brancas. Rente ao chão. */
function cloverPatch(seed) {
  const R = rng(seed);
  const parts = [];
  for (let i = 0; i < 10; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 0.2;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, y = 0.018 + R() * 0.02, s = 0.013 + R() * 0.006, rot = R() * Math.PI * 2;
    const c = col('#4f8f3a').offsetHSL(0, 0, (R() - 0.5) * 0.08);
    const nl = R() < 0.12 ? 4 : 3;
    for (let k = 0; k < nl; k++) {
      const b = rot + (k / nl) * Math.PI * 2;
      // cada folhinha um pouco erguida para fora (nenhuma fica deitada no plano do chão)
      parts.push(part(new THREE.CircleGeometry(1, 5).rotateX(-Math.PI / 2), c, { x: x + Math.cos(b) * s * 0.9, y, z: z + Math.sin(b) * s * 0.9, sx: s, sz: s, ry: -b, rz: 0.16 + R() * 0.14 }));
    }
  }
  for (let i = 0; i < 2; i++) {
    const x = (R() - 0.5) * 0.2, z = (R() - 0.5) * 0.2;
    const st = link([x, 0, z], [x, 0.05, z], 0.0025, 3);
    parts.push(part(st.g, '#5f8a3a', { x: st.x, y: st.y, z: st.z }));
    parts.push(part(new THREE.OctahedronGeometry(0.013), '#f6f1e6', { x, y: 0.055, z }));
  }
  return mergeParts(parts);
}
/** Patinho de enfeite (branco: a cor vem da instância), a frente para +z, a linha d'água em y = 0. */
function duckGeo() {
  const W = '#ffffff';
  const parts = [];
  parts.push(part(new THREE.SphereGeometry(1, 9, 6), W, { y: 0.018, sx: 0.05, sy: 0.04, sz: 0.075 }));
  parts.push(part(new THREE.ConeGeometry(0.03, 0.06, 6), W, { y: 0.045, z: -0.07, rx: -1.0 }));
  parts.push(part(new THREE.SphereGeometry(0.033, 8, 6), W, { y: 0.082, z: 0.05 }));
  parts.push(part(new THREE.SphereGeometry(1, 6, 4), '#ff8a1e', { y: 0.076, z: 0.088, sx: 0.016, sy: 0.008, sz: 0.022 }));
  for (const s of [-1, 1]) {
    parts.push(part(new THREE.SphereGeometry(0.006, 4, 3), '#1f1510', { x: s * 0.024, y: 0.092, z: 0.067 }));
    parts.push(part(new THREE.SphereGeometry(1, 6, 4), W, { x: s * 0.045, y: 0.03, z: -0.005, sx: 0.012, sy: 0.022, sz: 0.045 }));
  }
  return mergeParts(parts);
}

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
  const shore = buildLake(kit, root, L, live);
  buildGreens(kit, L, shore);
  const bin = buildBin(root, L);
  const boat = buildBoat(root, L, live);
  const reset = () => { bin.reset(); boat.reset(); booth.reset(); };
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
  const B = L.BOOTH, A = B.awning, V = L.BOOTH_VENT;
  const { x0, x1, z0, z1 } = B;
  const H = B.h, RY = B.roof;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const T = 0.12, IN = 0.02, PIL = 0.2; // parede, recuo da parede em relação aos pilares, pilar
  const wx0 = x0 + IN, wx1 = x1 - IN, wz0 = z0 + IN, wz1 = z1 - IN; // faces de fora das paredes
  const o = { group: GB };
  /** O guichê (sul), a porta e a janelinha do leste (o oeste é da grelha). */
  const WIN = { x0: cx - 0.75, x1: cx + 0.75, y0: 0.82, y1: 1.5 };
  const DOOR = { z0: z0 + 0.36, z1: z0 + 1.16, h: 2.0 };
  const WE = { z0: z1 - 1.0, z1: z1 - 0.42, y0: 0.92, y1: 1.5 };
  const ALU = '#c4c9cf', STEEL = '#4a5056', TRIM = '#f4efe6', BRASS = '#c9a24a';
  const put = (g, color, x, y, z, extra = {}) => kit.add(g, { color, x, y, z, ...o, ...extra });

  // ---------- paredes: reboco manchado por fora (o escorrido da chuva embaixo do beiral), escuro por dentro ----------
  // por dentro: o barrado verde-musgo até 1 m e a parede creme em cima (pelo guichê se vê o Sr. Luiz e o fundo)
  const INSIDE = '#6e8a80';
  const PL = col('#f3e4c8'), DAMP = col('#c9bb9c'), CIN = col(INSIDE), CUP = col('#d8cdb2');
  const _pc = new THREE.Color(), _pi = new THREE.Color();
  const inner = (y) => _pi.copy(CIN).lerp(CUP, smoothstep(0.95, 1.08, y)).multiplyScalar(0.8 + 0.2 * smoothstep(0, 0.4, y));
  /** O reboco no ponto (u ao longo da parede, y do chão), no mundo: as peças vizinhas continuam o mesmo desenho. */
  const plasterAt = (u, y, seed) => {
    _pc.copy(PL).offsetHSL(0, 0, (vnoise2(u * 1.6 + seed * 13.1, y * 1.6 + seed * 5.3) - 0.5) * 0.075);
    const streak = smoothstep(0.5, 0.85, vnoise2(u * 8 + seed * 3.7, 0.4 + y * 0.35)) * smoothstep(H - 1.0, H, y);
    return _pc.lerp(DAMP, streak * 0.55);
  };
  /** Trecho de parede ao longo de x ou de z (de a até b, de y0 a y1); (nx, nz): o lado de fora. */
  const wall = (dir, a, b, y0, y1, fixed, nx, nz, seed) => {
    const mid = (a + b) / 2, alongX = dir === 'x';
    const g = alongX ? wallBox(b - a, y1 - y0, T) : wallBox(T, y1 - y0, b - a);
    const fn = (p, n) => (n.x * nx + n.z * nz < -0.5 ? inner(p.y + y0) : plasterAt((alongX ? p.x : p.z) + mid, p.y + y0, seed));
    kit.add(g, { color: fn, x: alongX ? mid : fixed, y: y0, z: alongX ? fixed : mid, ...o, ao: false });
  };
  const ax0 = x0 + 0.05, ax1 = x1 - 0.05, az0 = z0 + 0.05, az1 = z1 - 0.05; // as pontas somem nos pilares
  const zs = wz1 - T / 2, zn = wz0 + T / 2, xe = wx1 - T / 2, xw = wx0 + T / 2;
  // norte (encostada no muro: de fora ninguém vê)
  put(wallBox(ax1 - ax0, H, T), (p, n) => (n.z > 0.5 ? inner(p.y) : _pc.set('#e9dcc2')), cx, 0, zn, { ao: false });
  // sul, com o vão do guichê
  wall('x', ax0, ax1, 0, WIN.y0, zs, 0, 1, 1);
  wall('x', ax0, ax1, WIN.y1, H, zs, 0, 1, 1);
  wall('x', ax0, WIN.x0, WIN.y0, WIN.y1, zs, 0, 1, 1);
  wall('x', WIN.x1, ax1, WIN.y0, WIN.y1, zs, 0, 1, 1);
  // leste, com a porta e a janelinha
  wall('z', az0, DOOR.z0, 0, H, xe, 1, 0, 2);
  wall('z', DOOR.z0, DOOR.z1, DOOR.h, H, xe, 1, 0, 2);
  wall('z', DOOR.z1, WE.z0, 0, H, xe, 1, 0, 2);
  wall('z', WE.z0, WE.z1, 0, WE.y0, xe, 1, 0, 2);
  wall('z', WE.z0, WE.z1, WE.y1, H, xe, 1, 0, 2);
  wall('z', WE.z1, az1, 0, H, xe, 1, 0, 2);
  // oeste, inteira (a grelha fica por cima dela)
  wall('z', az0, az1, 0, H, xw, -1, 0, 3);
  // pilares de canto (terracota) sobre as sapatas de concreto
  const PILC = tone('#c97650', 0.035, 2.2, 5);
  for (const [px, pz] of [[x0 + PIL / 2, z0 + PIL / 2], [x1 - PIL / 2, z0 + PIL / 2], [x0 + PIL / 2, z1 - PIL / 2], [x1 - PIL / 2, z1 - PIL / 2]]) {
    put(rb(PIL, H - 0.065, PIL, 0.03, 1), PILC, px, 0.065, pz);
    put(rb(PIL + 0.02, 0.065, PIL + 0.02, 0.015, 1), '#b8b0a4', px, 0, pz);
  }
  // rodapé de concreto, barrado de pastilhas e o friso branco nas três faces que aparecem (sul, leste e oeste)
  const PAST = ['#5aa8a2', '#4f9c97', '#66b4ad', '#488f8a', '#70bcb4', '#559f9b'].map(col), PAST_W = col('#e6efe9');
  const pastilha = (seed) => (p) => {
    const h = hash(Math.floor((p.x + 50) / 0.06) + seed * 97, Math.floor((p.y + 50) / 0.06));
    return h > 0.965 ? PAST_W : PAST[Math.floor(h * 6) % 6];
  };
  const BASE = tone('#a9a297', 0.04, 6, 4);
  /** Um trecho do barrado: ao longo de x (a face sul) ou de z (sgn +1 a face leste, −1 a oeste). */
  const dado = (dir, a, b, face, sgn, seed) => {
    const len = b - a, mid = (a + b) / 2;
    if (dir === 'x') {
      put(tilesV(len, 0.72, 0.06, 0.06, pastilha(seed)), null, mid, 0.43, face + 0.004, { ao: false });
      put(rb(len, 0.028, 0.03, 0.008, 1), '#f7f1e6', mid, 0.79, face + 0.012, { ao: false });
      put(rb(len, 0.07, 0.03, 0.008, 1), BASE, mid, 0, face + 0.002, { ao: false });
    } else {
      put(tilesV(len, 0.72, 0.06, 0.06, pastilha(seed)), null, face + sgn * 0.004, 0.43, mid, { ry: (sgn * Math.PI) / 2, ao: false });
      put(rb(0.03, 0.028, len, 0.008, 1), '#f7f1e6', face + sgn * 0.012, 0.79, mid, { ao: false });
      put(rb(0.03, 0.07, len, 0.008, 1), BASE, face + sgn * 0.002, 0, mid, { ao: false });
    }
  };
  dado('x', x0 + PIL, x1 - PIL, wz1, 1, 1);
  dado('z', z0 + PIL, DOOR.z0 - 0.035, wx1, 1, 2);
  dado('z', DOOR.z1 + 0.035, z1 - PIL, wx1, 1, 3);
  dado('z', z0 + PIL, z1 - PIL, wx0, -1, 4);
  // o balcão de granito do guichê
  const GRANITE = tone('#b7afa3', 0.05, 9, 7);
  put(rb(WIN.x1 - WIN.x0 + 0.14, 0.035, 0.24, 0.008, 1), GRANITE, cx, 0.79, wz1 + 0.09);

  // ---------- o guichê: marco de alumínio, a folha fixa (oeste) e a folha que corre (leste), vidro com caixilho ----------
  /** @type {THREE.BufferGeometry[]} */
  const glass = [];
  const bar = (w, h, d, x, y, z, extra = {}) => put(slab(w, h, d), ALU, x, y, z, { ao: false, ...extra });
  const fzS = wz1 - 0.015; // o marco fica 1 cm para fora da parede
  bar(WIN.x1 - WIN.x0 + 0.07, 0.04, 0.05, cx, WIN.y1 - 0.005, fzS);
  for (const x of [WIN.x0 - 0.015, WIN.x1 + 0.015]) bar(0.04, WIN.y1 - WIN.y0 + 0.03, 0.05, x, WIN.y0, fzS);
  bar(WIN.x1 - WIN.x0 + 0.07, 0.03, 0.05, cx, 0.81, fzS);
  const LW = (WIN.x1 - WIN.x0) / 2 + 0.03; // a largura de cada folha (as duas se cruzam no meio)
  const pyc = (WIN.y0 + 0.02 + WIN.y1 - 0.01) / 2, ph = WIN.y1 - WIN.y0 - 0.03;
  /** As barras de uma folha (quatro lados e a travessa do meio), centrada na origem, no plano xy. */
  const leafBars = (w, h) => {
    const list = [];
    for (const l of [-w / 2 + 0.015, w / 2 - 0.015]) list.push(part(slab(0.03, h, 0.022), ALU, { x: l, y: -h / 2 }));
    for (const yy of [-h / 2, h / 2 - 0.03]) list.push(part(slab(w - 0.06, 0.03, 0.022), ALU, { y: yy }));
    list.push(part(slab(w - 0.06, 0.016, 0.014), ALU, { y: -0.008 }));
    return list;
  };
  // a folha fixa, no trilho de fora
  const fixX = WIN.x0 + LW / 2, fixZ = wz1 - 0.045;
  for (const g of leafBars(LW, ph)) kit.add(g, { color: null, x: fixX, y: pyc, z: fixZ, ...o, ao: false });
  glass.push(new THREE.PlaneGeometry(LW - 0.05, ph - 0.05).translate(fixX, pyc, fixZ));
  // a folha que corre, no trilho de dentro: fechada no começo; aberta, fica atrás da fixa (não sai da parede)
  const leaf = new THREE.Group();
  leaf.name = 'recanto:guarita-janela';
  const lb = leafBars(LW, ph);
  lb.push(part(rb(0.014, 0.1, 0.014, 0.005, 1), '#2f2a26', { x: -LW / 2 + 0.015, y: -0.05, z: -0.018 })); // o puxador, por dentro
  const leafFrame = new THREE.Mesh(mergeParts(lb), SLOTS.solid());
  leafFrame.name = 'recanto:guarita-janela-caixilho';
  leafFrame.castShadow = false;
  leafFrame.receiveShadow = true;
  const leafGlass = new THREE.Mesh(new THREE.PlaneGeometry(LW - 0.05, ph - 0.05), glassMat());
  leafGlass.name = 'recanto:guarita-janela-vidro';
  leaf.add(leafFrame, leafGlass);
  const leafX = WIN.x1 - LW / 2, TRAVEL = (WIN.x1 - WIN.x0) / 2 - 0.06;
  leaf.position.set(leafX, pyc, wz1 - 0.072);
  root.add(leaf);
  /** 0 fechada … 1 aberta (a folha do leste corre para o oeste, para trás da fixa). */
  const setWindow = (k) => { leaf.position.x = leafX - clamp01(k) * TRAVEL; };
  // a janelinha do leste (fixa, com as travessas em cruz e a cortina fechada por trás)
  const fxE = wx1 - 0.015, emid = (WE.z0 + WE.z1) / 2, ew = WE.z1 - WE.z0, eh = WE.y1 - WE.y0;
  bar(0.05, 0.04, ew + 0.07, fxE, WE.y1 - 0.005, emid);
  for (const z of [WE.z0 - 0.015, WE.z1 + 0.015]) bar(0.05, eh + 0.03, 0.04, fxE, WE.y0, z);
  bar(0.05, 0.03, ew + 0.07, fxE, WE.y0 - 0.01, emid);
  bar(0.02, eh, 0.016, wx1 - 0.04, WE.y0, emid);
  bar(0.02, 0.016, ew, wx1 - 0.04, (WE.y0 + WE.y1) / 2 - 0.008, emid);
  glass.push(new THREE.PlaneGeometry(ew, eh).rotateY(Math.PI / 2).translate(wx1 - 0.05, (WE.y0 + WE.y1) / 2, emid));
  put(rb(0.07, 0.03, ew + 0.12, 0.008, 1), GRANITE, wx1 + 0.025, WE.y0 - 0.03, emid);
  const glassMesh = new THREE.Mesh(mergeGeometries(glass), glassMat());
  glassMesh.name = 'recanto:guarita-vidros';
  root.add(glassMesh);
  for (const g of glass) g.dispose();
  // cortinas (a do leste fechada; a do guichê puxada para o canto do oeste) e os varões
  const CUR = /** @type {[string, string]} */ (['#efcd7c', '#fbf1d6']), ROD = { color: '#8a6a48', ...o };
  put(curtain(ew + 0.08, eh + 0.08, 5, 0.02, CUR), null, wx1 - T - 0.05, (WE.y0 + WE.y1) / 2, emid, { ry: Math.PI / 2, ao: false });
  addLink(kit, [wx1 - T - 0.05, WE.y1 + 0.045, WE.z0 - 0.06], [wx1 - T - 0.05, WE.y1 + 0.045, WE.z1 + 0.06], 0.008, ROD);
  put(curtain(0.36, 0.68, 4, 0.03, CUR), null, WIN.x0 + 0.2, 1.16, wz1 - T - 0.05, { ao: false });
  addLink(kit, [WIN.x0 - 0.04, 1.535, wz1 - T - 0.05], [WIN.x1 + 0.04, 1.535, wz1 - T - 0.05], 0.008, ROD);

  // ---------- lá dentro: o piso de lajotinha vermelha, o balcão com o radinho, a garrafa térmica, a xícara e o livro;
  // no fundo (o que se vê pelo guichê, atrás do Sr. Luiz): o mural de avisos, o quadro de chaves, o relógio, o armário
  // de aço no canto noroeste (atrás da cadeira, longe do caminho até a porta do leste), o boné no cabide e a lâmpada
  put(slab(x1 - x0 - 0.2, 0.046, z1 - z0 - 0.2), tone('#4a3a32', 0.05, 3, 9), cx, 0, cz, { ao: false }); // as lajotas por cima: 0,05
  {
    const ix0 = wx0 + T, ix1 = wx1 - T, iz0 = wz0 + T, iz1 = wz1 - T;
    const RED = ['#a9533b', '#9c4a34', '#b25d42', '#a04e37'].map(col);
    put(tiles(ix1 - ix0, iz1 - iz0, 0.3, 0.3, (p) => _c.copy(RED[Math.floor(hash(Math.round(p.x * 7), Math.round(p.z * 7)) * 4) % 4]).multiplyScalar(0.9 + 0.14 * hash(Math.round(p.z * 7), Math.round(p.x * 7)))),
      null, (ix0 + ix1) / 2, 0.0502, (iz0 + iz1) / 2, { slot: 'ground', ao: false });
    const bz = iz0 + 0.004; // a face de dentro da parede do norte
    // o mural de cortiça com os avisos (papéis coloridos, sem letra: só as listrinhas cinza) e as tachinhas
    const MX = 19.62, MY = 1.42;
    put(rb(0.74, 0.52, 0.03, 0.01, 1), '#7a5534', MX, MY - 0.26, bz + 0.015, { ao: false });
    put(slab(0.68, 0.46, 0.012), tone('#c09060', 0.05, 9, 3), MX, MY - 0.23, bz + 0.03, { ao: false });
    /** @type {[number, number, string, number][]} */
    const NOTES = [[-0.22, 0.08, '#fff6dc', 0.05], [-0.04, 0.1, '#ffd5e0', -0.06], [0.16, 0.06, '#cfe8ff', 0.04], [-0.17, -0.12, '#fff0a0', -0.03], [0.05, -0.1, '#ffffff', 0.07], [0.24, -0.11, '#d7f0c8', -0.05]];
    NOTES.forEach(([dx, dy, c, rz], k) => {
      put(slab(0.13, 0.17, 0.004), c, MX + dx, MY + dy - 0.085, bz + 0.0425 + k * 0.0006, { rz, ao: false });
      for (let l = 0; l < 3; l++) put(slab(0.08 - l * 0.015, 0.008, 0.002), '#9a958c', MX + dx - 0.005, MY + dy + 0.03 - l * 0.03, bz + 0.0455 + k * 0.0006, { rz, ao: false });
      put(sphere(0.008, 6, 4), ['#e8473a', '#3f8fd1', '#f2c230'][k % 3], MX + dx, MY + dy + 0.065, bz + 0.05, { ao: false });
    });
    // o quadro de chaves: a tábua, os ganchos e as chaves com a etiqueta colorida
    const KX = 18.98, KY = 1.36;
    put(rb(0.34, 0.22, 0.02, 0.008, 1), '#8f5f38', KX, KY - 0.11, bz + 0.01, { ao: false });
    for (let k = 0; k < 6; k++) {
      const hx = KX - 0.135 + (k % 3) * 0.135, hy = KY + (k < 3 ? 0.045 : -0.05);
      put(cyl(0.004, 0.004, 0.03, 5), '#c9ced3', hx, hy, bz + 0.02, { rx: Math.PI / 2, ao: false });
      if (k === 4) continue; // uma vaga: a chave do portãozinho está com ele
      put(new THREE.TorusGeometry(0.009, 0.0022, 4, 8), '#c9a24a', hx, hy - 0.012, bz + 0.045, { ao: false });
      put(slab(0.012, 0.03, 0.004), k % 2 ? '#c9a24a' : '#b9bec4', hx, hy - 0.05, bz + 0.045, { ao: false });
      put(slab(0.024, 0.034, 0.004), ['#e8473a', '#3f8fd1', '#f2c230', '#4f9a52', '#e2559a', '#f08a3c'][k], hx + 0.02, hy - 0.06, bz + 0.042, { rz: 0.2, ao: false });
    }
    // o relógio de parede (sem números: as marcas e os ponteiros)
    put(cyl(0.11, 0.11, 0.03, 20), '#3a3f44', 18.98, 1.86, bz, { rx: Math.PI / 2, ao: false });
    put(cyl(0.095, 0.095, 0.004, 20), '#fbf6ea', 18.98, 1.86, bz + 0.03, { rx: Math.PI / 2, ao: false });
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      put(slab(0.006, k % 3 ? 0.012 : 0.02, 0.002), '#3a2719', 18.98 + Math.sin(a) * 0.08, 1.86 + Math.cos(a) * 0.08 - 0.006, bz + 0.035, { rz: -a, ao: false });
    }
    put(slab(0.008, 0.06, 0.002), '#3a2719', 18.98, 1.86, bz + 0.0365, { rz: -2.3, ao: false });
    put(slab(0.006, 0.075, 0.002), '#3a2719', 18.98, 1.86, bz + 0.0385, { rz: -0.5, ao: false });
    // o armário de aço no canto noroeste: as duas portas, as venezianas e os puxadores; a caixa de papelão em cima
    const AX = ix0 + 0.27, AZ = iz0 + 0.2;
    put(rb(0.52, 1.72, 0.38, 0.015, 1), tone('#6d7f8c', 0.03, 4, 12), AX, 0.052, AZ);
    put(slab(0.006, 1.6, 0.004), '#4a5862', AX, 0.11, AZ + 0.191, { ao: false });
    for (const sg of [-1, 1]) {
      for (let k = 0; k < 4; k++) put(slab(0.16, 0.012, 0.004), '#55646e', AX + sg * 0.125, 1.45 + k * 0.035, AZ + 0.191, { ao: false });
      put(rb(0.016, 0.1, 0.016, 0.005, 1), '#c9ced3', AX + sg * 0.025, 0.95, AZ + 0.198, { ao: false });
    }
    put(rb(0.3, 0.12, 0.22, 0.02, 1), '#e9a23b', AX + 0.05, 1.772, AZ, { ry: 0.2 });
    // o cabide na parede do oeste com o boné azul-marinho do uniforme pendurado
    const CXw = ix0 + 0.004, CZ = -14.05;
    put(rb(0.02, 0.06, 0.3, 0.006, 1), '#8f5f38', CXw + 0.01, 1.55, CZ, { ao: false });
    for (const dz of [-0.09, 0.09]) put(cyl(0.006, 0.006, 0.05, 6), '#c9ced3', CXw + 0.035, 1.58, CZ + dz, { rz: -Math.PI / 2, ao: false });
    put(new THREE.SphereGeometry(0.085, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#24324f', CXw + 0.1, 1.46, CZ - 0.09, { rz: Math.PI / 2 - 0.25, ao: false });
    put(cyl(0.07, 0.07, 0.008, 12), '#1d283f', CXw + 0.075, 1.4, CZ - 0.09, { sx: 1.3, rz: Math.PI / 2 - 0.25, ao: false });
    // a lâmpada pendurada no meio (acesa: ainda é cedo), o fio e a cúpula de alumínio
    const LX = cx + 0.1, LZ = -13.95;
    addLink(kit, [LX, H - 0.01, LZ], [LX, 1.95, LZ], 0.004, { color: '#2b2b30', ...o }, 4);
    put(new THREE.ConeGeometry(0.12, 0.09, 14, 1, true), '#d9dde0', LX, 1.9, LZ, { ao: false });
    put(sphere(0.04, 10, 8), '#fff2c8', LX, 1.865, LZ, { slot: 'lit', ao: false });
  }
  const CY = 0.8; // o tampo do balcão de dentro, logo abaixo do vão do guichê (0,82)
  put(rb(wx1 - wx0 - 2 * T - 0.004, 0.035, 0.46, 0.008, 1), tone('#5a3f2b', 0.04, 5, 2), cx, CY - 0.035, wz1 - T - 0.23, { ao: false });
  // o radinho de pilha, atrás da folha que corre (com a janela aberta, fica no vão)
  const R0 = { x: WIN.x1 - 0.3, y: CY, z: wz1 - T - 0.09 };
  const fz = R0.z + 0.0325; // a frente do corpo
  put(rb(0.21, 0.125, 0.065, 0.02, 2), tone('#c8433a', 0.03, 9, 3), R0.x, R0.y, R0.z, { ao: false });
  put(rb(0.19, 0.1, 0.008, 0.004, 1), '#f1e2c2', R0.x, R0.y + 0.0125, fz, { ao: false });
  const dots = (p) => _c.set((Math.floor((p.x + 5) / 0.01) + Math.floor((p.y + 5) / 0.01)) % 2 ? '#3a332e' : '#8b7f71');
  put(tilesV(0.08, 0.075, 0.01, 0.01, dots), null, R0.x - 0.045, R0.y + 0.0625, fz + 0.007, { ao: false });
  put(slab(0.003, 0.026, 0.003), '#d23a2a', R0.x + 0.052, R0.y + 0.063, fz + 0.0125, { ao: false });
  for (const dx of [0.022, 0.068]) put(cyl(0.012, 0.012, 0.012, 12), '#2f2a26', R0.x + dx, R0.y + 0.03, fz + 0.004, { rx: Math.PI / 2, ao: false });
  put(new THREE.TorusGeometry(0.06, 0.008, 6, 12, Math.PI), '#3a2a22', R0.x, R0.y + 0.125, R0.z, { ao: false });
  addLink(kit, [R0.x - 0.08, R0.y + 0.12, R0.z - 0.012], [R0.x - 0.13, R0.y + 0.26, R0.z - 0.03], 0.0045, { color: '#c9ced3', ...o }, 5);
  addLink(kit, [R0.x - 0.13, R0.y + 0.26, R0.z - 0.03], [R0.x - 0.19, R0.y + 0.41, R0.z - 0.05], 0.003, { color: '#c9ced3', ...o }, 5);
  put(sphere(0.007, 6, 4), '#c9ced3', R0.x - 0.19, R0.y + 0.41, R0.z - 0.05, { ao: false });
  // o mostrador e o led acendem com o rádio ligado (malhas próprias: o brilho muda a cada quadro): a única luz lá dentro
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
  // o livro de ocorrências aberto, a caneta, a garrafa térmica e a xícara de café
  const bkx = cx - 0.12, bkz = wz1 - T - 0.17;
  put(rb(0.27, 0.012, 0.19, 0.004, 1), '#2f4f7a', bkx, CY, bkz, { ry: 0.12, ao: false });
  for (const s of [-1, 1]) put(slab(0.125, 0.008, 0.175), '#f5f0e2', bkx + s * 0.066 * Math.cos(0.12), CY + 0.012, bkz - s * 0.066 * Math.sin(0.12), { ry: 0.12, rz: -s * 0.05, ao: false });
  addLink(kit, [bkx + 0.02, CY + 0.026, bkz + 0.04], [bkx + 0.11, CY + 0.026, bkz - 0.02], 0.004, { color: '#1f3a6b', ...o }, 5);
  const tx = cx + 0.2, tz = wz1 - T - 0.33;
  put(cyl(0.042, 0.045, 0.19, 14), '#3d6fa8', tx, CY, tz, { ao: false });
  put(cyl(0.036, 0.042, 0.05, 14), '#f2efe8', tx, CY + 0.19, tz, { ao: false });
  put(cyl(0.012, 0.012, 0.02, 8), '#f2efe8', tx, CY + 0.24, tz, { ao: false });
  put(new THREE.TorusGeometry(0.035, 0.007, 5, 10, Math.PI).rotateZ(-Math.PI / 2), '#2f5a8c', tx + 0.045, CY + 0.1, tz, { ao: false });
  const ux = WIN.x1 - 0.1, uz = wz1 - T - 0.14;
  put(cyl(0.032, 0.027, 0.07, 12), '#f4efe6', ux, CY, uz, { ao: false });
  put(cyl(0.028, 0.028, 0.004, 12), '#4a2c1a', ux, CY + 0.062, uz, { ao: false });
  put(new THREE.TorusGeometry(0.018, 0.005, 5, 10), '#f4efe6', ux + 0.036, CY + 0.035, uz, { ao: false });

  // ---------- a porta do leste (fechada: o porteiro sai por ela para o portãozinho), a soleira e o capacho ----------
  const dzc = (DOOR.z0 + DOOR.z1) / 2, dw = DOOR.z1 - DOOR.z0;
  for (const z of [DOOR.z0 - 0.015, DOOR.z1 + 0.015]) put(slab(0.05, DOOR.h + 0.03, 0.04), TRIM, wx1 - 0.015, 0, z, { ao: false });
  put(slab(0.05, 0.04, dw + 0.07), TRIM, wx1 - 0.015, DOOR.h - 0.005, dzc, { ao: false });
  put(slab(0.04, DOOR.h - 0.02, dw - 0.01), tone('#3f7d8b', 0.025, 3, 6), wx1 - 0.05, 0.01, dzc);
  for (const yy of [0.2, 1.07]) put(rb(0.012, 0.74, dw - 0.2, 0.004, 1), '#4a8b99', wx1 - 0.027, yy, dzc, { ao: false });
  put(rb(0.006, 0.15, dw - 0.05, 0.002, 1), '#a9afb5', wx1 - 0.029, 0.02, dzc, { ao: false }); // a chapa de chute
  for (const yy of [0.25, 1.0, 1.75]) put(cyl(0.009, 0.009, 0.1, 6), '#8f949a', wx1 - 0.026, yy, DOOR.z0 + 0.012, { ao: false });
  const hz = DOOR.z1 - 0.1; // a maçaneta de alavanca, do lado do trinco
  put(cyl(0.026, 0.026, 0.008, 12).rotateZ(-Math.PI / 2), BRASS, wx1 - 0.03, 1.0, hz, { ao: false });
  addLink(kit, [wx1 - 0.03, 1.0, hz], [wx1 + 0.025, 1.0, hz], 0.008, { color: BRASS, ...o });
  addLink(kit, [wx1 + 0.025, 1.0, hz], [wx1 + 0.025, 1.0, hz - 0.12], 0.008, { color: BRASS, ...o });
  put(slab(0.004, 0.03, 0.012), '#2f2a26', wx1 - 0.029, 0.89, hz, { ao: false });
  put(rb(0.16, 0.03, dw + 0.1, 0.008, 1), GRANITE, wx1 + 0.03, 0, dzc, { ao: false });
  const MAT = col('#a4744a'), MATB = col('#6e4b30');
  put(slab(0.42, 0.006, 0.72), '#6e4b30', x1 + 0.34, 0.0127, dzc, { slot: 'ground', ao: false });
  put(tiles(0.4, 0.7, 0.04, 0.04, (p) => (Math.abs(p.x) > 0.16 || Math.abs(p.z) > 0.31 ? MATB : _c.copy(MAT).offsetHSL(0, 0, (hash(p.x * 50, p.z * 50) - 0.5) * 0.05))), null, x1 + 0.34, 0.0228, dzc, { slot: 'ground', ao: false });
  // a patinha do Recanto em cima da porta, o interfone entre a porta e a janelinha
  put(pawSticker(0.065).rotateY(Math.PI / 2), null, wx1 + 0.006, 2.108, dzc, { ao: false });
  const zi = (DOOR.z1 + WE.z0) / 2;
  put(rb(0.035, 0.24, 0.14, 0.012, 1), '#9aa0a6', wx1 + 0.0175, 1.1, zi);
  put(tilesV(0.07, 0.05, 0.01, 0.01, dots), null, wx1 + 0.038, 1.29, zi, { ry: Math.PI / 2, ao: false });
  for (let k = 0; k < 3; k++) put(cyl(0.011, 0.011, 0.012, 10), '#f2efe8', wx1 + 0.035, 1.15 + k * 0.04, zi, { rz: -Math.PI / 2, ao: false });
  // a floreira embaixo da janelinha (acima da cabeça das dogs), com as mãozinhas de ferro
  const fy = WE.y0 - 0.21;
  put(rb(0.15, 0.13, ew + 0.04, 0.02, 1), tone('#b8653f', 0.04, 4, 8), wx1 + 0.085, fy, emid);
  put(slab(0.12, 0.01, ew), '#4d3626', wx1 + 0.085, fy + 0.118, emid, { ao: false });
  const ger = flowerBush({ r: 0.085, seed: 21, flower: '#e8473a', n: 5 });
  for (let k = 0; k < 3; k++) put(ger, null, wx1 + 0.085, fy + 0.122, WE.z0 + 0.1 + k * ((ew - 0.2) / 2), { slot: 'foliage' });
  for (const z of [WE.z0 + 0.06, WE.z1 - 0.06]) addLink(kit, [wx1 + 0.005, fy - 0.1, z], [wx1 + 0.13, fy, z], 0.008, { color: STEEL, ...o });

  // ---------- o toldo: chapa listrada com nervuras, testeira de ondinhas, abas e mãos-francesas ----------
  const depth = A.z1 - z1, drop = A.y1 - A.y0;
  const tilt = Math.atan2(drop, depth), alen = Math.hypot(depth, drop);
  const topAt = (z) => A.y1 - ((z - z1) / depth) * drop; // o alto da chapa em z (CLIMB.awning: 1,64 a 25 cm da beirada)
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
  for (const [lxx, lzz, s, r, c] of [[x0 + 0.42, z1 + 0.22, 0.04, 0.6, 0], [x0 + 1.5, z1 + 0.38, 0.034, 2.1, 1], [x1 - 0.28, z1 + 0.15, 0.038, 4.0, 2]]) {
    kit.add(LEAF, { color: LEAVES[c], slot: 'plant', x: lxx, y: topAt(lzz) + 0.005, z: lzz, sx: s, sz: s * 0.5, rx: tilt, ry: r, ...o, ao: false });
  }

  // ---------- na face sul: a arandela, a câmera de segurança, a campainha e o vasinho no balcão ----------
  put(rb(0.12, 0.2, 0.025, 0.01, 1), '#3d4247', cx, 1.84, wz1 + 0.0125);
  put(rb(0.1, 0.13, 0.08, 0.02, 1), '#ffe3a6', cx, 1.87, wz1 + 0.06, { slot: 'lit', ao: false });
  put(rb(0.13, 0.025, 0.1, 0.008, 1), '#3d4247', cx, 2.0, wz1 + 0.06);
  const camY = 2.02, camA = 0.65, cmx = x1 + 0.0, cmz = z1 + 0.14;
  addLink(kit, [x1 - PIL / 2, 2.1, z1 + 0.005], [cmx, 2.08, cmz - 0.03], 0.012, { color: '#e9e6df', ...o });
  put(rb(0.075, 0.07, 0.17, 0.02, 1), '#ecebe6', cmx, camY, cmz, { ry: camA });
  put(slab(0.1, 0.008, 0.2), '#d9d6cf', cmx, camY + 0.075, cmz, { ry: camA, ao: false });
  put(cyl(0.026, 0.026, 0.02, 12).translate(0, -0.01, 0).rotateX(Math.PI / 2).rotateY(camA), '#1f2328', cmx + Math.sin(camA) * 0.088, camY + 0.035, cmz + Math.cos(camA) * 0.088, { ao: false });
  const bellX = (WIN.x1 + 0.035 + x1 - PIL) / 2;
  put(rb(0.1, 0.16, 0.02, 0.008, 1), '#9aa0a6', bellX, 1.04, wz1 + 0.01);
  put(tilesV(0.07, 0.05, 0.01, 0.01, dots), null, bellX, 1.15, wz1 + 0.023, { ao: false });
  put(cyl(0.016, 0.016, 0.01, 12).rotateX(Math.PI / 2), '#ffd98a', bellX, 1.08, wz1 + 0.02, { slot: 'lit', ao: false });
  put(cyl(0.045, 0.036, 0.07, 12), '#c2683f', WIN.x0 + 0.08, 0.825, wz1 + 0.1);
  put(cyl(0.04, 0.04, 0.004, 12), '#4d3626', WIN.x0 + 0.08, 0.889, wz1 + 0.1, { ao: false });
  put(flowerBush({ r: 0.05, seed: 31, flower: '#f28ca2', n: 3 }), null, WIN.x0 + 0.08, 0.885, wz1 + 0.1, { slot: 'foliage' });

  // ---------- a face oeste: a GRELHA de ventilação (rente ao chão), a plaquinha do vento e o quadro de luz ----------
  const VW = 0.47, VH = 0.28; // a moldura: largura (ao longo de z) e altura
  const vx = x0 - 0.03, vy0 = V.y - VH / 2; // a frente da moldura (3 cm para fora dos pilares) e o pé dela
  const FR = '#d9dee3';
  for (const yy of [vy0, vy0 + VH - 0.032]) put(rb(0.05, 0.032, VW, 0.008, 1), FR, x0 - 0.005, yy, V.z, { ao: false });
  for (const s of [-1, 1]) put(rb(0.05, VH - 0.064, 0.032, 0.008, 1), FR, x0 - 0.005, vy0 + 0.032, V.z + s * (VW / 2 - 0.016), { ao: false });
  for (const s of [-1, 1]) for (const yy of [vy0 + 0.016, vy0 + VH - 0.016]) put(sphere(0.006, 6, 4), '#7c8288', vx - 0.001, yy, V.z + s * (VW / 2 - 0.016), { ao: false });
  put(slab(0.006, VH - 0.06, VW - 0.06), '#141518', wx0 - 0.009, vy0 + 0.03, V.z, { ao: false }); // o fundo escuro
  // as ripas (malha própria: tremem quando o sopro entra): compridas em z, a beirada de fora mais baixa
  const NSL = 5, cSlatTop = col('#e3e7ea'), cSlat = col('#9aa1a8');
  const slatParts = [];
  for (let i = 0; i < NSL; i++) {
    slatParts.push(part(new THREE.BoxGeometry(0.046, 0.005, VW - 0.07), (p, n) => (n.y > 0.3 ? cSlatTop : cSlat), { y: (i - (NSL - 1) / 2) * 0.043, rz: 0.7 }));
  }
  const slats = new THREE.Mesh(mergeParts(slatParts), SLOTS.solid());
  slats.name = 'recanto:guarita-grelha';
  slats.position.set(x0 - 0.011, V.y, V.z);
  slats.castShadow = false;
  slats.receiveShadow = true;
  root.add(slats);
  // os fiapos de cheiro puxados para dentro (só enquanto o sopro entra)
  const wMat = wispMat();
  const wisps = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateY(-Math.PI / 2), wMat);
    m.name = `recanto:guarita-grelha-fiapo-${i + 1}`;
    m.visible = false;
    m.castShadow = false;
    m.renderOrder = 4;
    root.add(m);
    return m;
  });
  let puff = 0;
  /** 0..1: o sopro com cheiro entrando pela grelha (as ripas tremem, os fiapos somem para dentro). */
  const setVentPuff = (k) => {
    puff = clamp01(k);
    if (puff > 0.001) return;
    slats.rotation.z = 0;
    slats.position.y = V.y;
    wMat.opacity = 0;
    for (const w of wisps) w.visible = false;
  };
  live.push((dt, t) => {
    if (puff <= 0.001) return;
    slats.rotation.z = (Math.sin(t * 43) * 0.028 + Math.sin(t * 17.3) * 0.012) * puff;
    slats.position.y = V.y + Math.sin(t * 61) * 0.0012 * puff;
    wMat.opacity = 0.5 * puff;
    wisps.forEach((w, i) => {
      const ph = (t * 0.9 + i / wisps.length) % 1; // 0: longe da grelha … 1: engolido por ela
      const s = 0.17 * (1 - ph * 0.75);
      w.visible = true;
      w.position.set(vx - 0.02 - (1 - ph) * 0.3, V.y + Math.sin(ph * 5 + i * 2.1) * 0.035 * (1 - ph), V.z + (i - 1) * 0.11 * (1 - ph));
      w.scale.set(s, s, s);
    });
  });
  put(windPlate(0.2, 0.15).rotateY(-Math.PI / 2), null, wx0 - 0.008, 0.6, V.z, { ao: false });
  const qz = z1 - 0.62; // o quadro de luz, no alto, com o eletroduto até o beiral
  put(rb(0.09, 0.42, 0.32, 0.015, 1), tone('#b9bec2', 0.03, 6, 4), wx0 - 0.04, 1.08, qz, { ao: false });
  put(slab(0.004, 0.12, 0.16), '#27323a', wx0 - 0.087, 1.3, qz, { slot: 'glass', ao: false });
  put(rb(0.012, 0.05, 0.03, 0.004, 1), '#2f2a26', wx0 - 0.09, 1.16, qz + 0.1, { ao: false });

  // ---------- a laje: beiral com cachorros, platibanda, impermeabilização com poça, folhas, um galho e o buzinote ----------
  const EAVE = 0.24, RT = 0.17;
  const rx0 = x0 - EAVE, rx1 = x1 + EAVE, rz0 = z0 - 0.05, rz1 = z1 + 0.16;
  const rcx = (rx0 + rx1) / 2, rcz = (rz0 + rz1) / 2;
  const cTop = col('#cfc7ba'), cSoffit = col('#f4eee2'), cFascia = col('#3f7d8b');
  put(rb(rx1 - rx0, RT, rz1 - rz0, 0.02, 1), (p, n) => (n.y > 0.5 ? cTop : n.y < -0.5 ? cSoffit : cFascia), rcx, RY - RT, rcz, { ao: false });
  put(rb(x1 - x0 + 0.04, 0.06, z1 - z0 + 0.04, 0.012, 1), '#f7f1e6', cx, RY - RT - 0.06, cz, { ao: false });
  for (let i = 0; i < 5; i++) {
    for (const s of [-1, 1]) put(rb(EAVE - 0.06, 0.075, 0.05, 0.012, 1), '#f7f1e6', (s < 0 ? x0 : x1) + (s * (EAVE - 0.06)) / 2, RY - RT - 0.075, z0 + 0.3 + i * 0.45, { ao: false });
  }
  addLink(kit, [wx0 - 0.03, 1.5, qz], [wx0 - 0.03, RY - RT - 0.005, qz], 0.014, { color: '#8f949a', ...o }, 6);
  const rimH = 0.07, rimT = 0.07, RIM = tone('#cbc2b4', 0.03, 3, 12);
  put(rb(rx1 - rx0 - 0.01, rimH, rimT, 0.015, 1), RIM, rcx, RY, rz1 - 0.005 - rimT / 2, { ao: false });
  put(rb(rx1 - rx0 - 0.01, rimH, rimT, 0.015, 1), RIM, rcx, RY, rz0 + 0.005 + rimT / 2, { ao: false });
  const sideLen = rz1 - rz0 - 0.01 - 2 * rimT;
  put(rb(rimT, rimH - 0.004, sideLen, 0.015, 1), RIM, rx1 - 0.005 - rimT / 2, RY, rcz, { ao: false });
  put(rb(rimT, rimH - 0.004, sideLen, 0.015, 1), RIM, rx0 + 0.005 + rimT / 2, RY, rcz, { ao: false });
  const fx0 = rx0 + 0.005 + rimT, fx1 = rx1 - 0.005 - rimT, fz0 = rz0 + 0.005 + rimT, fz1 = rz1 - 0.005 - rimT;
  const roofFn = (p) => {
    const h = hash(Math.floor((p.x + 50) / 0.29), Math.floor((p.z + 50) / 0.27));
    return _c.set(vnoise2(p.x * 1.3 + 4, p.z * 1.3) > 0.6 ? '#7f7a71' : '#9e988c').offsetHSL(0, 0, (h - 0.5) * 0.06);
  };
  put(tiles(fx1 - fx0, fz1 - fz0, 0.29, 0.27, roofFn), null, (fx0 + fx1) / 2, RY + 0.003, (fz0 + fz1) / 2, { ao: false });
  puddleAt(kit, x0 + 0.62, RY + 0.003, z0 + 1.25, 0.2, 3, GB);
  for (const [lxx, lzz, s, r, c] of [[x0 + 0.25, z0 + 0.2, 0.04, 0.3, 0], [x0 + 1.15, z0 + 0.32, 0.036, 1.7, 4], [x1 - 0.2, z0 + 1.5, 0.042, 2.6, 1], [x0 + 0.1, z1 - 0.3, 0.035, 5.1, 2], [x1 - 0.75, z0 + 0.2, 0.038, 0.9, 3], [x0 + 1.3, z0 + 1.7, 0.033, 3.3, 0]]) {
    kit.add(LEAF, { color: LEAVES[c], slot: 'plant', x: lxx, y: RY + 0.008, z: lzz, sx: s, sz: s * 0.5, ry: r, ...o, ao: false });
  }
  const tw0 = [x0 + 0.12, RY + 0.012, z0 + 0.82], tw1 = [x0 + 0.42, RY + 0.014, z0 + 0.68], tw2 = [x0 + 0.58, RY + 0.012, z0 + 0.73];
  addLink(kit, tw0, tw1, 0.009, { color: '#6b4a2e', ...o }, 5);
  addLink(kit, tw1, tw2, 0.006, { color: '#6b4a2e', ...o }, 5);
  kit.add(LEAF, { color: '#6f8f3e', slot: 'plant', x: tw2[0] + 0.02, y: RY + 0.016, z: tw2[2] - 0.01, sx: 0.035, sz: 0.018, ry: 0.4, ...o, ao: false });
  // o buzinote sai pela platibanda do oeste e pinga no gramado (a poça, ao norte da grelha)
  const bz = z0 + 0.42;
  addLink(kit, [rx0 + 0.06, RY + 0.025, bz], [rx0 - 0.1, RY + 0.005, bz], 0.022, { color: '#8e959b', ...o }, 8);
  puddleAt(kit, rx0 - 0.12, 0.017, bz, 0.17, 7, GB);

  // ---------- a antena espinha-de-peixe com os estais (a meia fica no mastro, abaixo da braçadeira) ----------
  const An = L.ANTENNA, top = An.top;
  put(cyl(0.06, 0.07, 0.025, 12), '#8f949a', An.x, RY, An.z, { ao: false });
  put(cyl(0.019, 0.022, top - RY - 0.02, 8), '#b5bac0', An.x, RY + 0.02, An.z, { ao: false });
  put(cyl(0.03, 0.03, 0.03, 10), '#8f949a', An.x, An.sock + 0.09, An.z, { ao: false });
  const by = top - 0.08, ANT = { color: '#c9ced3', ...o };
  addLink(kit, [An.x - 0.32, by, An.z], [An.x + 0.34, by, An.z], 0.011, { color: '#b5bac0', ...o });
  for (const [dx, len] of [[-0.3, 0.5], [-0.18, 0.44], [-0.06, 0.38], [0.06, 0.33], [0.17, 0.29], [0.27, 0.25]]) {
    addLink(kit, [An.x + dx, by, An.z - len / 2], [An.x + dx, by, An.z + len / 2], 0.0055, ANT, 5);
  }
  for (const s of [-1, 1]) addLink(kit, [An.x - 0.12, by + s * 0.025, An.z - 0.2], [An.x - 0.12, by + s * 0.025, An.z + 0.2], 0.005, ANT, 5);
  put(cyl(0.022, 0.022, 0.02, 8), '#8f949a', An.x, top - 0.02, An.z, { ao: false });
  const collar = [An.x, An.sock + 0.105, An.z];
  for (const [gx, gz] of [[rx1 - 0.1, rz0 + 0.1], [An.x - 1.1, rz0 + 0.1], [rx1 - 0.1, An.z + 1.05]]) {
    addLink(kit, collar, [gx, RY + 0.06, gz], 0.004, { color: '#55595e', ...o }, 4);
    put(sphere(0.014, 6, 4), '#55595e', gx, RY + 0.06, gz, { ao: false });
  }
  // o cabo da antena desce pelo mastro e some pela platibanda do norte
  addLink(kit, [An.x + 0.03, by - 0.02, An.z], [An.x + 0.025, RY + 0.03, An.z + 0.01], 0.005, { color: '#1f2226', ...o }, 4);
  addLink(kit, [An.x + 0.025, RY + 0.012, An.z + 0.01], [An.x + 0.05, RY + 0.012, rz0 + 0.08], 0.005, { color: '#1f2226', ...o }, 4);
  // a parabólica no canto noroeste, virada para o céu do sul
  const dX = x0 + 0.3, dZ = z0 + 0.38;
  put(cyl(0.05, 0.06, 0.02, 10), '#8f949a', dX, RY, dZ, { ao: false });
  put(cyl(0.016, 0.016, 0.3, 8), '#9aa0a6', dX, RY + 0.02, dZ, { ao: false });
  const dish = new THREE.SphereGeometry(0.28, 16, 5, 0, Math.PI * 2, 0, 0.66).translate(0, -0.28, 0).rotateX(Math.PI);
  put(doubleSide(dish), '#e4e2dc', dX, RY + 0.33, dZ, { rx: 0.75, ao: false });
  const ax = [0, Math.cos(0.75), Math.sin(0.75)];
  const focal = [dX, RY + 0.33 + ax[1] * 0.16, dZ + ax[2] * 0.16];
  addLink(kit, [dX, RY + 0.31, dZ + 0.13], focal, 0.006, { color: '#9aa0a6', ...o }, 5);
  put(rb(0.035, 0.05, 0.035, 0.01, 1), '#3d4247', focal[0], focal[1] - 0.025, focal[2], { ao: false });

  return {
    prop: {
      radio,
      // o meio do vão que abre (a metade do leste do guichê), rente à parede: os balões do ronco aparecem aqui
      windowAnchor: { x: WIN.x1 - TRAVEL / 2, y: (WIN.y0 + WIN.y1) / 2, z: z1 + 0.05 },
      setWindow,
      window: { object: leaf },
      // o meio da grelha, na frente da moldura
      vent: { x: vx, y: V.y, z: V.z },
      setVentPuff,
    },
    reset() { radio.setOn(false); setWindow(0); setVentPuff(0); },
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
  const Lk = L.LAKE, I = Lk.island, WY = Lk.waterY, Pr = L.PIER, Ch = L.CHANNEL, Bt = L.BOAT;
  const P = Lk.outline;
  const o = { group: GL };
  const { pts, edges } = outlinePoints(P, 0.2);
  const lake = polygonTests(P);
  const R = rng(91);
  const pcz = (Pr.z0 + Pr.z1) / 2;
  const xMax = L.WALL.maxX - L.WALL.t / 2 - 0.05; // a margem não passa do muro do leste
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const p of P) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); bz0 = Math.min(bz0, p.z); bz1 = Math.max(bz1, p.z); }
  // os lugares que ficam livres: o píer, o canal, o caminho da Dona Gansa
  const nearPier = (x, z, m = 0.3) => x > Pr.x0 - 0.45 - m && x < Pr.x1 + m && z > Pr.z0 - m && z < Pr.z1 + m;
  const nearChannel = (x, z, m = 0.3) => x > Ch.x0 - m && x < Ch.x1 + m && z > Ch.z0 - 0.4 && z < Ch.z1 + 0.6;
  const islandD = (x, z) => Math.hypot(x - I.x, z - I.z);
  const NAV = L.NAV_NODES || {}, GO = L.GOOSE;
  const gooseLine = [GO.patrol[0], NAV.L_pier, NAV.L_sw, GO.patrol[1]].filter(Boolean);
  const nearGoose = (x, z, m = 0.4) => polylineDist(gooseLine, x, z) < m;
  /** Água livre: dentro do lago, a `m` da margem e longe da ilha, do píer e do canal. */
  const openWater = (x, z, m) => lake.inside(x, z) && lake.dist(x, z) > m && islandD(x, z) > I.r + m + 0.25 && !nearPier(x, z, m + 0.25) && !nearChannel(x, z, m);
  /** Um ponto do lado `ei` do contorno (t de 0 a 1), `d` m para dentro d'água. */
  const onEdge = (ei, t, d) => { const e = edges[ei]; return { x: e.a.x + (e.b.x - e.a.x) * t + e.nx * d, z: e.a.z + (e.b.z - e.a.z) * t + e.nz * d }; };

  // ---------- a água (o contorno do layout, a ilha vazada) ----------
  const shape = new THREE.Shape(P.map((p) => new THREE.Vector2(p.x, -p.z)));
  const hole = new THREE.Path();
  const RH = I.r - 0.06;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
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

  // ---------- a margem: a grama emendando no gramado, a areia (a prainha do barquinho ao sul), o barro molhado e o
  // barranco até embaixo d'água (no gramado, o alto fica em 6 mm) ----------
  const beachK = (p) => smoothstep(7.0, 7.5, p.z) * smoothstep(Bt.minX - 1.4, Bt.minX - 0.4, p.x) * smoothstep(Ch.x1 + 1.9, Ch.x1 + 0.9, p.x);
  for (const p of pts) {
    const bk = beachK(p);
    let w2 = 0.22 + vnoise2(p.s * 0.9 + 7, 1.3) * 0.3 + bk * (1.15 + vnoise2(p.s * 0.6, 4.2) * 0.3);
    let wg = w2 + 0.16 + vnoise2(p.s * 2.3, 8.1) * 0.12;
    const ox = -p.nx; // para fora, no x
    if (ox > 0.01) { const lim = (xMax - p.x) / ox; wg = Math.min(wg, lim); w2 = Math.min(w2, Math.max(0.1, lim - 0.12)); }
    p.w2 = w2; p.wg = Math.max(wg, w2 + 0.02); p.bk = bk;
  }
  const SH = { grass: col('#74a43c'), dry: col('#dcc999'), sand: col('#cdb685'), wet: col('#9c8660'), mud: col('#6b5741'), bank: col('#4a3c2e'), deep: col('#2c251f') };
  const jit = (c, s, k, amp = 0.07) => c.clone().offsetHSL(0, 0, (vnoise2(s * 5.3 + k * 3.7, k) - 0.5) * amp);
  const shore = ribbon(pts, (p) => {
    const w1 = Math.min(0.07 + vnoise2(p.s * 1.7, 3.1) * 0.07, p.w2 * 0.5);
    return [
      [-p.wg, 0.0032, jit(SH.grass, p.s, 0, 0.04)],
      [-p.w2, 0.0052, jit(SH.dry, p.s, 1)],
      [-(w1 + (p.w2 - w1) * 0.45), 0.006, jit(SH.sand, p.s, 2)],
      [-w1, 0.006, jit(SH.wet, p.s, 3)],
      [0, 0.004, jit(SH.mud, p.s, 4)],
      [0.035, -0.035, jit(SH.bank, p.s, 5)],
      [0.08, -0.1, jit(SH.bank, p.s, 6)],
      [0.15, -0.3, SH.deep],
    ];
  });
  kit.add(shore, { color: null, slot: 'ground', ...o, ao: false });
  // o raso na beira do lago e em volta da ilha (por cima da água, transparente): do areia-claro ao verde-água
  const S1 = col('#c9cf98'), S2 = col('#8fc7a6'), S3 = col('#62b7c2');
  const shallowA = ribbon(pts, () => [[0.05, WY + 0.004, S1, 0.6], [0.3, WY + 0.004, S2, 0.44], [0.85, WY + 0.004, S3, 0.26], [1.8, WY + 0.004, S3, 0]], true);
  const ipts = [];
  const IR = I.r + 0.1;
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2;
    ipts.push({ x: I.x + Math.cos(a) * IR, z: I.z + Math.sin(a) * IR, nx: Math.cos(a), nz: Math.sin(a), s: a * IR });
  }
  const shallowB = ribbon(ipts, () => [[0, WY + 0.004, S1, 0.55], [0.22, WY + 0.004, S2, 0.4], [0.6, WY + 0.004, S3, 0.22], [1.2, WY + 0.004, S3, 0]], true);
  const shallow = new THREE.Mesh(mergeGeometries([shallowA, shallowB]), shallowMat());
  shallowA.dispose();
  shallowB.dispose();
  shallow.name = 'recanto:lago-raso';
  shallow.renderOrder = 2;
  shallow.receiveShadow = true;
  root.add(shallow);
  // o fundo: manchas escuras nos trechos largos de água (o que passa da margem fica embaixo do gramado)
  const m4 = new THREE.Matrix4(), mq = new THREE.Quaternion(), mp = new THREE.Vector3(), ms = new THREE.Vector3();
  const flat = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const DEEP = [[I.x - 3.2, bz0 + 3.4, 9.5, 5.2], [I.x + 2.9, I.z - 3.6, 5.5, 4.4], [Pr.x1 + 1.9, pcz + 2.4, 4.6, 3.4]];
  const deep = new THREE.InstancedMesh(flat(), deepMat(), DEEP.length);
  deep.name = 'recanto:lago-fundo';
  deep.frustumCulled = false;
  deep.renderOrder = 1;
  deep.castShadow = false;
  DEEP.forEach(([x, z, sx, sz], i) => deep.setMatrixAt(i, m4.compose(mp.set(x, WY + 0.002, z), mq.identity(), ms.set(sx, 1, sz))));
  deep.instanceMatrix.needsUpdate = true;
  root.add(deep);
  // os brilhos do sol: pontinhos que piscam fora de compasso
  const SPK = [];
  for (let tries = 0; SPK.length < 40 && tries < 900; tries++) {
    const x = bx0 + R() * (bx1 - bx0), z = bz0 + R() * (bz1 - bz0);
    if (openWater(x, z, 0.45)) SPK.push([x, z, 0.1 + R() * 0.12, 0.9 + R() * 1.6, R() * 6.28]);
  }
  const sparkle = new THREE.InstancedMesh(flat(), sparkleMat(), SPK.length);
  sparkle.name = 'recanto:lago-brilhos';
  sparkle.frustumCulled = false;
  sparkle.renderOrder = 3;
  sparkle.castShadow = false;
  const placeSparkle = (t) => {
    SPK.forEach(([x, z, s, w, ph], i) => {
      const k = Math.max(0, Math.sin(t * w + ph)) ** 6;
      sparkle.setMatrixAt(i, m4.compose(mp.set(x, WY + 0.012, z), mq.identity(), ms.set(s * k * 2.2 + 1e-4, 1, s * k + 1e-4)));
    });
    sparkle.instanceMatrix.needsUpdate = true;
  };
  placeSparkle(0);
  root.add(sparkle);
  live.push((dt, t) => placeSparkle(t));

  // ---------- pedras: as grandes dentro d'água, as pequenas na margem (no máximo 15 cm do contorno), uns matacões ----------
  const RV = [0, 1, 2, 3, 4, 5].map((k) => rockGeo(k * 7 + 3, 1));
  const PV = [0, 1, 2].map((k) => rockGeo(k * 5 + 11, 0));
  for (const p of pts) {
    if (R() > 0.26) continue;
    if (R() < 0.55) {
      if (p.bk > 0.3 && R() < 0.6) continue; // a prainha fica mais limpa
      const r = 0.07 + R() * 0.12;
      const d = Math.max(r * 1.1 - 0.08, 0.05) + R() * 0.16;
      const x = p.x + p.nx * d, z = p.z + p.nz * d;
      if (nearPier(x, z) || nearChannel(x, z) || nearGoose(x, z, 0.35)) continue;
      kit.add(RV[Math.floor(R() * RV.length)], { color: null, x, y: WY + r * 0.08, z, sx: r * (0.9 + R() * 0.3), sy: Math.min(r * (0.55 + R() * 0.2), 0.13), sz: r * (0.8 + R() * 0.3), ry: R() * 6.28, ...o });
    } else {
      const r = 0.028 + R() * 0.034;
      const d = -(0.012 + R() * 0.06);
      const x = p.x + p.nx * d, z = p.z + p.nz * d;
      if (nearPier(x, z) || nearChannel(x, z)) continue;
      kit.add(R() < 0.5 ? PV[Math.floor(R() * PV.length)] : RV[Math.floor(R() * RV.length)], { color: null, x, y: r * 0.15, z, sx: r, sy: r * 0.6, sz: r * 0.85, ry: R() * 6.28, ...o });
    }
  }
  // a prainha: seixos, uma concha ou outra e os gravetos que a tempestade trouxe (rentes à areia)
  const SHELL = new THREE.SphereGeometry(1, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let k = 0, tries = 0; k < 30 && tries < 500; tries++) {
    const x = Bt.minX - 1.2 + R() * (Ch.x1 + 2.2 - Bt.minX), z = bz1 - 0.4 + R() * 1.9;
    const d = lake.dist(x, z);
    if (lake.inside(x, z) || d < 0.12 || d > 1.3 || nearChannel(x, z, 0.5) || Math.hypot(x - Bt.start.x, z - Bt.start.z) < 0.75) continue;
    const r = 0.016 + R() * 0.022;
    if (k % 5 === 4) kit.add(SHELL, { color: k % 2 ? '#f6e9dc' : '#f3c9c0', x, y: 0.005, z, sx: r * 1.1, sy: r * 0.6, sz: r * 0.9, ry: R() * 6.28, ...o, ao: false });
    else kit.add(PV[k % 3], { color: null, x, y: r * 0.25, z, sx: r * 1.2, sy: r * 0.6, sz: r, ry: R() * 6.28, ...o, ao: false });
    k++;
  }
  for (const [tx, tz, ta] of [[Bt.start.x + 1.7, bz1 + 0.8, 0.4], [Ch.x0 - 1.8, bz1 + 0.55, 2.2], [Ch.x1 + 1.2, bz1 + 0.5, 1.1]]) {
    const c = Math.cos(ta), sn = Math.sin(ta);
    addLink(kit, [tx - c * 0.2, 0.014, tz - sn * 0.2], [tx + c * 0.16, 0.016, tz + sn * 0.16], 0.009, { color: '#6b4a2e', ...o }, 5, 0.006);
    addLink(kit, [tx + c * 0.04, 0.015, tz + sn * 0.04], [tx + c * 0.14 - sn * 0.12, 0.014, tz + sn * 0.14 + c * 0.12], 0.006, { color: '#6b4a2e', ...o }, 5, 0.004);
  }
  /** Lajes de pedra na água, perto da margem (largas e baixas: o alto fica a menos de 8 cm do chão): [lado, posição no lado, raio]. */
  const BOULDERS = [[3, 0.3, 0.36], [3, 0.74, 0.28], [4, 0.52, 0.4], [5, 0.42, 0.32], [0, 0.55, 0.34], [2, 0.5, 0.3], [12, 0.45, 0.28], [6, 0.35, 0.26]];
  BOULDERS.forEach(([ei, t, r], k) => {
    const q = onEdge(ei, t, r * 1.45 + 0.04);
    kit.add(RV[k % RV.length], { color: null, x: q.x, y: WY - 0.02, z: q.z, sx: r * 1.05, sy: Math.min(r * 0.78, 0.16), sz: r * 0.9, ry: hash(k, 31) * 6.28, ...o });
    // uma pedra menor ao lado, mais para dentro
    const q2 = onEdge(ei, t + 0.035, r * 1.45 + 0.36);
    kit.add(RV[(k + 2) % RV.length], { color: null, x: q2.x, y: WY, z: q2.z, sx: r * 0.5, sy: Math.min(r * 0.4, 0.13), sz: r * 0.45, ry: hash(k, 33) * 6.28, ...o });
  });

  // ---------- taboas e juncos na água, em canteiros pela margem (longe do píer, do canal e da prainha do barquinho; o
  // banco do norte fica com a vista livre) ----------
  const taboas = [0, 1, 2].map((k) => reedClump(31 + k * 17, { n: 15 + k * 2, h: 0.95 + k * 0.13, r: 0.15 + k * 0.02, heads: 2 + k, headLen: 0.15, headR: 0.021 }));
  const juncos = [0, 1].map((k) => reedClump(57 + k * 9, { n: 22, h: 0.6 + k * 0.12, r: 0.1, heads: 0, wide: 0.55, tip: '#6f9a45', base: '#2f5226' }));
  /** [lado do contorno, de, até (0..1 no lado), quantas, 0 taboa / 1 junco] */
  const REED_BEDS = [
    [0, 0.12, 0.9, 5, 0], [1, 0.05, 0.4, 3, 0], [1, 0.74, 0.98, 2, 1], [2, 0.1, 0.92, 6, 0], [3, 0.05, 0.95, 6, 0],
    [4, 0.05, 0.95, 7, 0], [5, 0.05, 0.9, 5, 0], [6, 0.12, 0.72, 3, 1], [11, 0.5, 0.95, 3, 1], [12, 0.15, 0.72, 3, 0], [14, 0.28, 0.9, 4, 0],
  ];
  let reedN = 0;
  for (const [ei, t0, t1, count, kind] of REED_BEDS) {
    for (let i = 0; i < count; i++) {
      const t = t0 + ((t1 - t0) * (i + 0.5 + (R() - 0.5) * 0.6)) / count;
      const q = onEdge(ei, t, 0.24 + R() * 0.32);
      const s = 0.85 + R() * 0.4;
      const geo = kind ? juncos[reedN % 2] : taboas[reedN % 3];
      kit.add(geo, { color: null, slot: 'plant', x: q.x, y: WY - 0.02, z: q.z, sx: s, sy: s * (0.9 + R() * 0.25), sz: s, ry: R() * 6.28, ...o, ao: false });
      // nos canteiros compridos, uma touceira de junco mais para dentro (dá fundo)
      if (!kind && count >= 5 && i % 2 === 0) {
        const q2 = onEdge(ei, t + 0.03, 0.75 + R() * 0.3);
        kit.add(juncos[i % 2], { color: null, slot: 'plant', x: q2.x, y: WY - 0.02, z: q2.z, sx: 0.9, sy: 0.85, sz: 0.9, ry: R() * 6.28, ...o, ao: false });
      }
      reedN++;
    }
  }

  // ---------- vitórias-régias (os pratos grandes, em três grupos), ninfeias pequenas com flor, folhas e um galho ----------
  /** A volta dos patinhos (uma elipse ao norte da ilha): as plantas ficam fora dela. */
  const DK = { x: I.x - 2.6, z: bz0 + 2.6, rx: 3.0, rz: 1.05, n: 5 };
  const onDuckPath = (x, z, m = 0.5) => Math.abs(Math.hypot((x - DK.x) / DK.rx, (z - DK.z) / DK.rz) - 1) * DK.rz < m;
  const vics = [victoriaPad(3), victoriaPad(8)];
  const bigFlower = lilyFlower(6, '#fbf6ee', '#f7c9dc');
  /** Os grupos: [x, z do meio, quantas] (ao norte do píer, na enseada do sudoeste e no nordeste) */
  const VICS = [[Pr.x1 - 0.9, Pr.z0 - 1.9, 4], [Pr.x1 + 1.1, Pr.z1 + 2.2, 4], [bx1 - 2.6, I.z - 3.2, 5]];
  const padSpots = [];
  VICS.forEach(([vx, vz, nv], gi) => {
    for (let k = 0, tries = 0; k < nv && tries < 80; tries++) {
      const r = 0.26 + R() * 0.22;
      const x = vx + (R() - 0.5) * 2.0, z = vz + (R() - 0.5) * 1.6;
      if (!openWater(x, z, r + 0.2) || onDuckPath(x, z, r + 0.45) || padSpots.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < r + pr + 0.05)) continue;
      padSpots.push([x, z, r]);
      kit.add(vics[(k + gi) % 2], { color: null, slot: 'plant', x, y: WY + 0.006, z, sx: r, sy: 0.55 + r, sz: r, ry: R() * 6.28, ...o, ao: false });
      if (k % 3 === 0) kit.add(bigFlower, { color: null, slot: 'plant', x: x + r * 1.15, y: WY + 0.012, z: z + r * 0.3, sx: 3.6, sy: 3.6, sz: 3.6, ry: R() * 6.28, ...o, ao: false });
      k++;
    }
  });
  const pads = [lilyPad(5), lilyPad(9), lilyPad(13)];
  const flower = lilyFlower(4);
  for (let k = 0, tries = 0; k < 14 && tries < 500; tries++) {
    const x = bx0 + R() * (bx1 - bx0), z = bz0 + R() * (bz1 - bz0);
    if (!openWater(x, z, 0.3) || lake.dist(x, z) > 1.5 || onDuckPath(x, z) || padSpots.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < pr + 0.45)) continue;
    padSpots.push([x, z, 0.3]);
    const n = 2 + Math.floor(R() * 3);
    for (let j = 0; j < n; j++) {
      const a = R() * Math.PI * 2, d = j ? 0.13 + R() * 0.14 : 0;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, r = 0.07 + R() * 0.07;
      kit.add(pads[(k + j) % 3], { color: null, slot: 'plant', x: px, y: WY + 0.008 + j * 0.003, z: pz, sx: r, sy: r, sz: r, ry: R() * 6.28, ...o, ao: false });
      if (k % 2 === 0 && j === 0) kit.add(flower, { color: null, slot: 'plant', x: px, y: WY + 0.009 + r * 0.05, z: pz, sx: 1.3, sy: 1.3, sz: 1.3, ry: R() * 6.28, ...o, ao: false });
    }
    k++;
  }
  const LEAF = leafGeo();
  for (let k = 0, tries = 0; k < 18 && tries < 500; tries++) {
    const x = bx0 + R() * (bx1 - bx0), z = bz0 + R() * (bz1 - bz0);
    if (!openWater(x, z, 0.25) || padSpots.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < pr + 0.2)) continue; // longe das plantas (nada coplanar)
    const s = 0.028 + R() * 0.02;
    kit.add(LEAF, { color: LEAVES[k % LEAVES.length], slot: 'plant', x, y: WY + 0.007, z, sx: s, sz: s * 0.5, ry: R() * 6.28, ...o, ao: false });
    k++;
  }
  // o galho da tempestade, boiando perto das taboas do nordeste
  const gb = onEdge(2, 0.72, 1.25);
  const gp = (dx, dy, dz) => [gb.x + dx, WY + dy, gb.z + dz];
  addLink(kit, gp(0, 0.012, 0), gp(0.42, 0.018, 0.2), 0.016, { color: '#6b4a2e', ...o }, 5);
  addLink(kit, gp(0.42, 0.018, 0.2), gp(0.7, 0.012, 0.15), 0.01, { color: '#6b4a2e', ...o }, 5);
  addLink(kit, gp(0.42, 0.018, 0.2), gp(0.55, 0.012, 0.42), 0.008, { color: '#6b4a2e', ...o }, 5);
  for (const [dx, dz, r] of [[0.03, 0.06, 0.3], [0.3, 0.26, 1.2], [0.64, 0.1, 2.4], [0.58, 0.47, 4.1], [0.76, 0.2, 5.0]]) {
    kit.add(LEAF, { color: '#6f8f3e', slot: 'plant', x: gb.x + dx, y: WY + 0.022, z: gb.z + dz, sx: 0.045, sz: 0.022, ry: r, ...o, ao: false });
  }

  // ---------- a pata e os patinhos, nadando em fila numa volta larga ao norte da ilha (longe: são só de enfeite) ----------
  const ducks = new THREE.InstancedMesh(duckGeo(), SLOTS.solid(), DK.n);
  ducks.name = 'recanto:lago-patinhos';
  ducks.frustumCulled = false;
  ducks.castShadow = false;
  ducks.receiveShadow = true;
  for (let i = 0; i < DK.n; i++) ducks.setColorAt(i, i ? _c.set('#ffd648') : _c.set('#f8f3e8'));
  if (ducks.instanceColor) ducks.instanceColor.needsUpdate = true;
  const placeDucks = (t) => {
    for (let i = 0; i < DK.n; i++) {
      const a = t * 0.085 - (i ? 0.2 + (i - 1) * 0.14 : 0);
      const wob = i ? Math.sin(t * 1.3 + i * 2.1) * 0.05 : 0;
      const x = DK.x + Math.cos(a) * (DK.rx + wob), z = DK.z + Math.sin(a) * (DK.rz + wob);
      const s = i ? 1 + 0.08 * Math.sin(i * 5.1) : 1.9;
      mq.setFromAxisAngle(_up, Math.atan2(-Math.sin(a) * DK.rx, Math.cos(a) * DK.rz) + Math.sin(t * 2.3 + i) * 0.06);
      ducks.setMatrixAt(i, m4.compose(mp.set(x, WY - 0.004 * s + Math.sin(t * 2.1 + i * 1.7) * 0.004, z), mq, ms.set(s, s, s)));
    }
    ducks.instanceMatrix.needsUpdate = true;
  };
  placeDucks(0);
  root.add(ducks);
  live.push((dt, t) => placeDucks(t));

  // ---------- a ilha: morrinho de grama de pisar, a casinha dos patos com a moita, o salgueiro, o ninho, o caminho ----------
  // a casinha, o tronco do salgueiro e a moita cabem no colisor 'ilha-casinha' do layout (círculo de 0,32 m em C)
  const C = { x: I.x - 0.7, z: I.z - 0.5 };
  const WL = { x: C.x - 0.13, z: C.z - 0.16 }; // o pé do salgueiro, atrás da casinha
  const islandH = (x, z) => {
    const dx = x - I.x, dz = z - I.z;
    const a = Math.atan2(dz, dx);
    const r = Math.hypot(dx, dz) / (1 + 0.02 * Math.sin(3 * a + 1.2) + 0.012 * Math.sin(5 * a - 0.4));
    let h;
    if (r < I.r - 0.5) h = 0.012;
    else if (r < I.r) h = 0.012 - 0.008 * smooth((r - (I.r - 0.5)) / 0.5);
    else if (r < I.r + 0.2) h = 0.004 - 0.15 * smooth((r - I.r) / 0.2);
    else h = -0.146 - 0.2 * clamp01((r - I.r - 0.2) / 0.22);
    h += 0.11 * smoothstep(1.0, 0, Math.hypot(x - C.x, z - C.z));
    if (r < I.r - 0.15) h += (vnoise2(x * 9, z * 9) - 0.5) * 0.006;
    return h;
  };
  const mound = new THREE.Mesh(islandMound(I, islandH), SLOTS.ground());
  mound.name = 'recanto:ilha';
  mound.userData.walkable = true;
  mound.receiveShadow = true;
  root.add(mound);
  // a casinha dos patos (a porta redonda virada para a margem, a rampinha), a moita atrás e as flores
  const hx = C.x + 0.06, hz = C.z + 0.08, hry = 0.35;
  const hc = Math.cos(hry), hs = Math.sin(hry);
  const hat = (lx, lz) => ({ x: hx + lx * hc + lz * hs, z: hz - lx * hs + lz * hc });
  let hy = Infinity;
  for (const [lx, lz] of [[-0.19, -0.16], [0.19, -0.16], [-0.19, 0.16], [0.19, 0.16]]) { const q = hat(lx, lz); hy = Math.min(hy, islandH(q.x, q.z)); }
  hy -= 0.004;
  kit.add(rb(0.38, 0.035, 0.32, 0.01, 1), { color: '#9a7350', ...hat(0, 0), y: hy, ry: hry, ...o });
  kit.add(rb(0.3, 0.22, 0.24, 0.015, 1), { color: tone('#fff4e2', 0.03, 8, 4), ...hat(0, 0), y: hy + 0.035, ry: hry, ...o });
  kit.add(gableRoof(0.4, 0.32, 0.14), { color: tone('#c44b3c', 0.04, 7, 5), ...hat(0, 0), y: hy + 0.255, ry: hry, ...o });
  kit.add(new THREE.CircleGeometry(0.058, 16), { color: '#3a2a22', ...hat(0, 0.123), y: hy + 0.035 + 0.085, ry: hry, ...o, ao: false });
  kit.add(new THREE.CircleGeometry(0.022, 10), { color: '#f2c230', ...hat(0, 0.123), y: hy + 0.035 + 0.18, ry: hry, ...o, ao: false });
  kit.add(rb(0.08, 0.012, 0.13, 0.004, 1), { color: '#a07a52', ...hat(0, 0.178), y: hy + 0.012, rx: 0.3, ry: hry, ...o, ao: false });
  kit.add(cyl(0.006, 0.006, 0.06, 5).rotateZ(Math.PI / 2), { color: '#8a5a33', ...hat(0.03, 0.132), y: hy + 0.07, ry: hry, ...o, ao: false });
  const bush = foliageCluster([{ x: 0, y: 0.11, z: 0, r: 0.1 }, { x: 0.05, y: 0.09, z: 0.03, r: 0.08 }, { x: -0.04, y: 0.08, z: -0.03, r: 0.08 }], { detail: 1, amp: 0.2, freq: 5, seed: 6, dark: '#2f5226', mid: '#4f7f36', light: '#86ad52' });
  kit.add(bush, { color: null, slot: 'foliage', x: C.x + 0.13, y: islandH(C.x + 0.13, C.z - 0.17) - 0.02, z: C.z - 0.17, ...o });
  const yellow = flowerBush({ r: 0.085, seed: 12, flower: '#ffd23f', n: 5 }), white = flowerBush({ r: 0.07, seed: 14, flower: '#fff6ee', n: 4 });
  kit.add(yellow, { color: null, slot: 'foliage', x: C.x - 0.2, y: islandH(C.x - 0.2, C.z + 0.13) - 0.01, z: C.z + 0.13, ...o });
  kit.add(white, { color: null, slot: 'foliage', x: C.x + 0.22, y: islandH(C.x + 0.22, C.z - 0.04) - 0.01, z: C.z - 0.04, ...o });
  addWillow(kit, WL.x, WL.z, islandH(WL.x, WL.z), o);
  // o ninho com três ovos (rente ao chão)
  const nx = I.x + 1.25, nz = I.z + 0.75, ny = islandH(nx, nz);
  kit.add(new THREE.TorusGeometry(0.075, 0.026, 5, 12).rotateX(Math.PI / 2), { color: tone('#b89a5e', 0.06, 30, 2), x: nx, y: ny + 0.018, z: nz, sy: 0.8, ...o, ao: false });
  for (const [dx, dz] of [[-0.022, -0.01], [0.022, -0.008], [0, 0.024]]) kit.add(sphere(0.019, 8, 6), { color: '#f4efe0', x: nx + dx, y: ny + 0.028, z: nz + dz, sy: 1.2, ...o, ao: false });
  // as pedras chatas do caminho, da ponta do canal até o petisco
  const pathX = (z) => { const t = clamp01((I.z + I.r - 0.5 - z) / (I.r - 0.15)); return I.x + 0.62 * smooth(t) + Math.sin(t * Math.PI) * 0.12; };
  for (let k = 0; k < 6; k++) {
    const z = I.z + I.r - 0.5 - (k / 5) * (I.r - 0.15), x = pathX(z), r = 0.11 + hash(k, 5) * 0.03;
    kit.add(cyl(r, r + 0.006, 0.026, 11), { color: tone('#b3ab9e', 0.05, 9, k), x, y: islandH(x, z) - 0.018, z, sx: 1.1 - (k % 3) * 0.05, sz: 0.9, ry: k * 1.3, ...o, ao: false });
  }
  // capim baixinho e florzinhas pela ilha (sem colisão) e as pedras na beira dela (dentro d'água)
  const tuft = reedClump(77, { n: 7, h: 0.075, r: 0.035, heads: 0, tip: '#9cc25a', base: '#4f7a32' });
  const islandFlowers = [flowerPatch(41, '#fff6ee'), flowerPatch(43, '#f3a6c8'), flowerPatch(47, '#ffd23f')];
  const clearOnIsland = (x, z) => Math.hypot(x - C.x, z - C.z) > 0.5 && Math.abs(x - pathX(z)) > 0.28 && Math.hypot(x - nx, z - nz) > 0.2;
  for (let k = 0; k < 46; k++) {
    const a = hash(k, 21) * Math.PI * 2, rr = 0.5 + Math.sqrt(hash(k, 22)) * (I.r - 0.75);
    const x = I.x + Math.cos(a) * rr, z = I.z + Math.sin(a) * rr;
    if (!clearOnIsland(x, z)) continue;
    if (k % 5 === 0) kit.add(islandFlowers[(k / 5) % 3 | 0], { color: null, slot: 'plant', x, y: islandH(x, z) - 0.003, z, ry: a, ...o, ao: false });
    else kit.add(tuft, { color: null, slot: 'plant', x, y: islandH(x, z) - 0.004, z, sx: 1.2, sy: 1 + hash(k, 23) * 0.6, sz: 1.2, ry: a, ...o, ao: false });
  }
  for (let i = 0; i < 38; i++) {
    const a = (i / 38) * Math.PI * 2 + R() * 0.12, rr = I.r + 0.13 + R() * 0.12;
    const x = I.x + Math.cos(a) * rr, z = I.z + Math.sin(a) * rr;
    if (R() < 0.3 || (z > I.z + I.r - 0.9 && x > Ch.x0 - 0.2 && x < Ch.x1 + 0.2)) continue;
    const r = 0.06 + R() * 0.1;
    kit.add(RV[Math.floor(R() * RV.length)], { color: null, x, y: WY + r * 0.1, z, sx: r * (0.9 + R() * 0.3), sy: r * 0.65, sz: r * (0.8 + R() * 0.3), ry: R() * 6.28, ...o });
  }
  for (const a of [3.5, 4.1, 4.7, 5.5, 0.2]) {
    const s = 0.8 + hash(a, 3) * 0.3;
    kit.add(juncos[a > 4.5 ? 1 : 0], { color: null, slot: 'plant', x: I.x + Math.cos(a) * (I.r + 0.3), y: WY - 0.02, z: I.z + Math.sin(a) * (I.r + 0.3), sx: s, sy: s, sz: s, ry: a, ...o, ao: false });
  }

  // ---------- o canal: duas muretas de pedra da margem até a ilha, o cais e os cabeços na margem, a laje na ilha ----------
  const islandZ = (x) => I.z + Math.sqrt(Math.max(0, I.r * I.r - (x - I.x) ** 2));
  for (const [wi, wx] of [[0, Ch.x0 - 0.02], [1, Ch.x1 + 0.02]]) {
    let z = Ch.z1 + 0.03, k = 0;
    const zEnd = islandZ(wx) - 0.04;
    while (z > zEnd + 0.04) {
      const len = Math.min(z - zEnd, 0.2 + hash(k, wi) * 0.12);
      const topY = 0.025 + (hash(k, wi + 3) - 0.5) * 0.012;
      const light = hash(k, wi + 9) > 0.5, kk = k;
      const stone = (p) => {
        const wy = p.y - 0.32;
        const c = _c.set(light ? '#aaa397' : '#9d968a').offsetHSL(0, 0, (vnoise2(p.x * 20 + kk, p.y * 20) - 0.5) * 0.08);
        if (wy < -0.07 && wy > -0.15) c.lerp(col('#5f6e3c'), 0.55); else if (wy <= -0.15) c.lerp(col('#4c463e'), 0.6);
        return c;
      };
      kit.add(rb(0.13, topY + 0.32, len - 0.008, 0.02, 1), { color: stone, x: wx, y: -0.32, z: z - len / 2, ry: (hash(k, wi + 5) - 0.5) * 0.04, ...o });
      z -= len;
      k++;
    }
  }
  // o cais de pedra na boca do canal (o barquinho escorrega por cima dele) e os cabeços de amarrar, com a corda enrolada
  const cw = (Ch.x1 - Ch.x0 + 0.3) / 4;
  for (let i = 0; i < 4; i++) {
    kit.add(rb(cw - 0.012, 0.03, 0.4, 0.008, 1), { color: tone(i % 2 ? '#b8b0a3' : '#aaa296', 0.04, 5, i), x: Ch.x0 - 0.15 + cw * (i + 0.5), y: -0.0115, z: Ch.z1 + 0.2 + (i % 2) * 0.012, ...o, ao: false });
  }
  for (const [px, pz] of [[Ch.x0 - 0.035, Ch.z1 + 0.03], [Ch.x1 + 0.035, Ch.z1 + 0.06]]) {
    kit.add(cyl(0.036, 0.042, 0.3, 8), { color: tone('#7a5c3e', 0.05, 9, px), x: px, z: pz, ...o });
    kit.add(cyl(0.044, 0.044, 0.022, 8), { color: '#5a4630', x: px, y: 0.3, z: pz, ...o, ao: false });
    kit.add(new THREE.TorusGeometry(0.044, 0.011, 5, 12).rotateX(Math.PI / 2), { color: '#d8c59a', x: px, y: 0.19, z: pz, ...o, ao: false });
    kit.add(new THREE.TorusGeometry(0.044, 0.011, 5, 12).rotateX(Math.PI / 2), { color: '#cdb98c', x: px, y: 0.212, z: pz, ...o, ao: false });
  }
  // a laje de pedra na ponta da ilha (a prancha do barquinho apoia nela)
  for (let i = 0; i < 3; i++) {
    kit.add(rb(0.35, 0.03, 0.27, 0.008, 1), { color: tone(i % 2 ? '#aaa296' : '#b8b0a3', 0.04, 5, i + 7), x: I.x + (i - 1) * 0.365, y: -0.012, z: I.z + I.r - 0.17 - (i % 2) * 0.012, ...o, ao: false });
  }

  // ---------- o píer: tábuas e a rampa (chão de pisar), estacas, corrimão com corda, a boia e a lanterna ----------
  const WOODS = ['#b98d5f', '#a98053', '#c39a6b', '#b28659'];
  const Y = Pr.y, pd = Pr.z1 - Pr.z0;
  const n = Math.round((Pr.x1 - Pr.x0) / 0.147), pitch = (Pr.x1 - Pr.x0) / n, plankW = pitch - 0.012;
  const deckParts = [];
  for (let i = 0; i < n; i++) {
    const len = pd - 0.012 + (hash(i, 3) - 0.5) * 0.016;
    deckParts.push(part(rb(plankW, 0.035, len, 0.008, 1), tone(WOODS[i % 4], 0.045, 6, i), { x: Pr.x0 + pitch * (i + 0.5), y: Y - 0.035, z: pcz + (hash(i, 7) - 0.5) * 0.008, ry: (hash(i, 9) - 0.5) * 0.016 }));
  }
  // as longarinas e as travessas embaixo das tábuas (vão junto no chão de pisar: ficam por baixo dele)
  for (const z of [Pr.z0 + 0.09, Pr.z1 - 0.09]) deckParts.push(part(slab(Pr.x1 - Pr.x0 + 0.04, 0.07, 0.07), '#6f5238', { x: (Pr.x0 + Pr.x1) / 2, y: Y - 0.105, z }));
  const PILES = [0.018, 0.27, 0.52, 0.77, 1].map((f) => Pr.x0 + (Pr.x1 - Pr.x0) * f);
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
  const pierFlat = new THREE.Mesh(new THREE.PlaneGeometry(Pr.x1 - Pr.x0, pd).rotateX(-Math.PI / 2), ghostMat());
  pierFlat.name = 'recanto:pier-piso';
  pierFlat.position.set((Pr.x0 + Pr.x1) / 2, Y, pcz);
  const rampFlat = new THREE.Mesh(new THREE.PlaneGeometry(rampLen, pd - 0.06).rotateX(-Math.PI / 2).rotateZ(th), ghostMat());
  rampFlat.name = 'recanto:pier-rampa';
  rampFlat.position.set((rampX0 + Pr.x0) / 2, (0.02 + Y) / 2, pcz);
  pier.add(deck, pierFlat, rampFlat);
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
  // a boia salva-vidas na ponta, virada para o leste, e a lanterna no mourão do sudeste
  const RED = col('#d9433a'), WHITE = col('#f6f1e8');
  const ringCol = (p) => (Math.floor((Math.atan2(p.y, p.z) + Math.PI) / (Math.PI / 2)) % 2 ? RED : WHITE);
  kit.add(new THREE.TorusGeometry(0.11, 0.032, 8, 20).rotateY(Math.PI / 2), { color: ringCol, x: Pr.x1 + 0.065, y: 0.31, z: pcz + 0.05, ...o, ao: false });
  addLink(kit, [Pr.x1 + 0.03, railY - 0.02, pcz + 0.05], [Pr.x1 + 0.065, 0.43, pcz + 0.05], 0.005, { color: '#d8c59a', ...o }, 4);
  const lanY = railY + 0.03;
  kit.add(rb(0.1, 0.02, 0.1, 0.006, 1), { color: '#3a3a40', x: Pr.x1, y: lanY, z: rz1, ...o, ao: false });
  kit.add(rb(0.075, 0.11, 0.075, 0.015, 1), { color: '#ffd36a', slot: 'lit', x: Pr.x1, y: lanY + 0.02, z: rz1, ...o, ao: false });
  kit.add(new THREE.ConeGeometry(0.07, 0.07, 4).rotateY(Math.PI / 4), { color: '#3a3a40', x: Pr.x1, y: lanY + 0.165, z: rz1, ...o, ao: false });
  kit.add(new THREE.TorusGeometry(0.012, 0.003, 4, 8), { color: '#3a3a40', x: Pr.x1, y: lanY + 0.21, z: rz1, ...o, ao: false });

  // ---------- a entrada do píer: os dois mourões da ponta de terra sobem (ficam dentro das grades do píer), com a placa da
  // gansa brava no do norte e um cordão de bandeirinhas de um ao outro, por cima de quem entra ----------
  const gateX = PILES[0], gateTop = 1.26;
  for (const z of [rz0, rz1]) {
    kit.add(cyl(0.034, 0.042, gateTop - railY - 0.02, 8), { color: tone('#8a6845', 0.05, 8, z), x: gateX, y: railY + 0.02, z, ...o, ao: false });
    kit.add(cyl(0.046, 0.046, 0.022, 8), { color: '#5a4630', x: gateX, y: gateTop, z, ...o, ao: false });
  }
  const board = gooseSign();
  kit.add(board, { color: null, x: gateX - 0.05, y: 0.94, z: rz0, ry: -Math.PI / 2, ...o, ao: false });
  kit.add(board, { color: null, x: gateX + 0.05, y: 0.94, z: rz0, ry: Math.PI / 2, ...o, ao: false });
  const sagAt = (t) => gateTop - 0.04 - 0.16 * 4 * t * (1 - t);
  const gA = new THREE.Vector3(gateX, gateTop - 0.04, rz0), gB = new THREE.Vector3(gateX, gateTop - 0.04, rz1);
  kit.add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(gA, new THREE.Vector3(gateX, gateTop - 0.36, pcz), gB), 12, 0.006, 4, false), { color: '#d8c59a', ...o, ao: false });
  const FLAGS = ['#e8475f', '#f2c230', '#3d8fd1', '#5aa86a', '#f08a3c'];
  const pennantGeo = doubleSide(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.05, 0), new THREE.Vector2(0.05, 0), new THREE.Vector2(0, -0.12)])).rotateY(Math.PI / 2));
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    kit.add(pennantGeo, { color: FLAGS[i % FLAGS.length], x: gateX, y: sagAt(t) - 0.004, z: rz0 + (rz1 - rz0) * t, ...o, ao: false });
  }

  // ---------- a neblina baixa da manhã: manchas transparentes deitadas na água, andando devagar ----------
  /** [x, y, z, tamanho] */
  const MIST = [[I.x - 3.7, -0.04, bz0 + 2.1, 4.2], [I.x + 3.0, -0.05, I.z - 4.4, 3.2], [Pr.x1 + 1.7, -0.05, pcz + 2.7, 3.5], [I.x + 3.6, 0.05, I.z, 2.6], [I.x - 2.0, 0.06, I.z - 5.4, 3.5], [Pr.x1 - 0.7, 0.04, Pr.z0 - 3.3, 2.6], [I.x + 0.4, 0.02, I.z - 3.3, 3.0]];
  const mist = new THREE.InstancedMesh(flat(), mistMat(), MIST.length);
  mist.name = 'recanto:neblina';
  mist.frustumCulled = false;
  mist.renderOrder = 4;
  mist.castShadow = false;
  mist.receiveShadow = false;
  const placeMist = (t) => {
    MIST.forEach(([x, y, z, s], i) => {
      const k = 1 + 0.08 * Math.sin(t * 0.21 + i * 1.7);
      mp.set(x + Math.sin(t * 0.05 + i) * 0.5, WY + 0.12 + y, z + Math.cos(t * 0.04 + i * 2) * 0.4);
      ms.set(s * k * 1.25, 1, s * k * 0.8);
      mq.setFromAxisAngle(_up, i * 0.9 + t * 0.01);
      mist.setMatrixAt(i, m4.compose(mp, mq, ms));
    });
    mist.instanceMatrix.needsUpdate = true;
  };
  placeMist(0);
  root.add(mist);
  live.push((dt, t) => placeMist(t));

  return { pts, lake, nearPier, nearGoose };
}

/**
 * O morrinho da ilha: grade polar em volta do centro, alturas por islandH, grama em cima, areia na beira, barro
 * molhado e o fundo escuro embaixo d'água. Faces para cima.
 */
function islandMound(I, islandH) {
  const RINGS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.73, 0.81, 0.875, 0.925, 0.967, 1.0, 1.03, 1.06, 1.09, 1.14, 1.19].map((k) => k * I.r);
  const SEG = 64;
  const grassA = col('#78a84a'), grassB = col('#9cc460'), sand = col('#c2ab7a'), mud = col('#6b5741'), under = col('#3a3128');
  const pos = [], colr = [], c = new THREE.Color();
  const push = (x, z, r) => {
    const h = islandH(x, z);
    pos.push(x, h, z);
    if (h > 0.003 && r < I.r * 0.98) c.copy(grassA).lerp(grassB, vnoise2(x * 3.1, z * 3.1)).offsetHSL(0, 0, (vnoise2(x * 11, z * 11) - 0.5) * 0.05);
    else if (h > -0.03) c.copy(sand).lerp(mud, clamp01(-h / 0.03));
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

/**
 * O salgueiro-chorão da ilha: tronco fino e torto (cabe no colisor da casinha dos patos), quatro galhos mestres, a copa
 * e os ramos pendentes (acabam acima da cabeça das dogs). (x, z): o pé; y0: o chão ali.
 */
function addWillow(kit, x, z, y0, o) {
  const R = rng(311);
  const BARK = tone('#6f563b', 0.05, 7, 3);
  const p0 = [x, y0 - 0.06, z], p1 = [x - 0.03, y0 + 0.62, z - 0.03], p2 = [x + 0.04, y0 + 1.25, z + 0.05];
  addLink(kit, p0, p1, 0.085, { color: BARK, ...o }, 9, 0.068);
  addLink(kit, p1, p2, 0.068, { color: BARK, ...o }, 9, 0.055);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + 0.9 + R() * 0.4, d = 0.45 + R() * 0.2;
    addLink(kit, p2, [x + Math.cos(a) * d, y0 + 1.75 + R() * 0.2, z + Math.sin(a) * d], 0.045, { color: BARK, ...o }, 6, 0.02);
  }
  const crown = foliageCluster([
    { x: 0, y: 2.0, z: 0, r: 0.62 }, { x: 0.52, y: 1.82, z: 0.18, r: 0.5 }, { x: -0.48, y: 1.86, z: -0.2, r: 0.5 },
    { x: 0.08, y: 1.8, z: -0.52, r: 0.46 }, { x: -0.12, y: 1.8, z: 0.52, r: 0.46 },
  ], { detail: 1, amp: 0.22, freq: 2.6, seed: 17, dark: '#5c7f30', mid: '#8fb347', light: '#c6dc78' });
  kit.add(crown, { color: null, slot: 'foliage', x, y: y0, z, ...o });
  // os ramos pendentes: fitas finas em volta da copa
  const pos = [], cols = [], idx = [];
  const cA = col('#b5d065'), cB = col('#7fae3e'), c = new THREE.Color();
  const NS = 54;
  let v = 0;
  for (let i = 0; i < NS; i++) {
    const a = (i / NS) * Math.PI * 2 + R() * 0.2, rr = 0.5 + R() * 0.55;
    const top = 1.55 + R() * 0.25, bottom = Math.max(0.6, top - 0.75 - R() * 0.55);
    const fx = -Math.sin(a), fz = Math.cos(a), w = 0.022 + R() * 0.012;
    for (let s = 0; s <= 4; s++) {
      const t = s / 4, rad = rr + 0.1 * t * t;
      const px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad, py = y0 + top + (bottom - top) * t;
      const ww = w * (1 - 0.7 * t);
      pos.push(px - fx * ww, py, pz - fz * ww, px + fx * ww, py, pz + fz * ww);
      c.copy(cB).lerp(cA, t);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let s = 0; s < 4; s++) { const k = v + s * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    v += 10;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  kit.add(g, { color: null, slot: 'plant', ...o, ao: false });
}

// =====================================================================  O GRAMADO EM VOLTA
/**
 * Capim, florzinhas, trevos e folhas soltas em volta do lago, no gramado do sul, entre o lago e a guarita e ao pé da
 * guarita: tudo rente ao chão e sem colisão (a zona 'capim-leste'). Ficam livres o píer, a prainha e o caminho do
 * barquinho, o canal, o caminho da Dona Gansa, a frente da grelha, a porta da guarita e o lugar da lixeira.
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {any} L
 * @param {any} shore
 */
function buildGreens(kit, L, shore) {
  const { pts, lake, nearPier, nearGoose } = shore;
  const o = { group: GC, ao: false };
  const R = rng(203);
  // os limites do condomínio (WORLD.bounds vai até o terraço da torre, a leste: layout.ROOFTOP)
  const W = L.CONDO_BOUNDS || L.WORLD.bounds, B = L.BOOTH, V = L.BOOTH_VENT, Bt = L.BOAT, Ch = L.CHANNEL, Pr = L.PIER, T = L.TOWER;
  const tufts = [0, 1, 2].map((k) => reedClump(140 + k * 7, { n: 8 + k, h: 0.13 + k * 0.035, r: 0.05 + k * 0.012, heads: 0, wide: 1.3, tip: '#a8c85e', base: '#4f7a32' }));
  const FLOWERS = ['#fff6ee', '#ffd23f', '#f3a6c8', '#c9a6ee', '#ff8a5c'].map((c, k) => flowerPatch(60 + k * 3, c, k === 1 ? '#f08a24' : '#f2c230'));
  const clovers = [cloverPatch(5), cloverPatch(9)];
  const LEAF = leafGeo();
  const inBox = (x, z, x0, z0, x1, z1) => x > x0 && x < x1 && z > z0 && z < z1;
  /** O gramado livre para um enfeite em (x, z), a `m` m da margem do lago. */
  const free = (x, z, m = 0.1) => {
    if (x < 8.3 || x > W.maxX - 0.25 || z < L.WALL.minZ + L.WALL.t / 2 + 0.06 || z > W.maxZ - 0.5) return false;
    if (lake.inside(x, z) || lake.dist(x, z) < m) return false;
    if (T && inBox(x, z, T.x0 - 0.3, T.z0 - 0.3, T.x1 + 0.3, T.z1 + 0.3)) return false;
    // a guarita, o toldo e o lugar da lixeira, a porta e o caminho do portãozinho, a frente da grelha
    if (inBox(x, z, B.x0 - 0.12, B.z0 - 0.3, B.x1 + 0.12, B.awning.z1 + 1.7)) return false;
    if (x > B.x1 - 0.2 && z < B.z1 + 0.6) return false;
    if (inBox(x, z, B.x0 - 2.1, V.z - 0.75, B.x0, V.z + 0.75)) return false;
    // o píer e a entrada dele, a prainha por onde o barquinho é empurrado, a boca do canal, o caminho da gansa
    if (nearPier(x, z, 0.4) || inBox(x, z, Pr.x0 - 2.4, Pr.z0 - 0.5, Pr.x0 + 0.3, Pr.z1 + 0.5)) return false;
    if (inBox(x, z, Bt.minX - Bt.half - 0.9, Bt.minZ - Bt.half - 1.1, Bt.maxX + Bt.half + 0.6, Bt.maxZ + Bt.half + 0.35)) return false;
    if (inBox(x, z, Ch.x0 - 0.7, Ch.z1 - 0.2, Ch.x1 + 0.7, Ch.z1 + 3.3)) return false;
    if (nearGoose(x, z, 0.5)) return false;
    for (const t of L.TREES || []) if (Math.hypot(x - t.x, z - t.z) < 0.78) return false;
    for (const l of L.LAMPS || []) if (Math.hypot(x - l.x, z - l.z) < 0.3) return false;
    for (const b of L.BENCHES || []) if (Math.hypot(x - b.x, z - b.z) < 1.05) return false;
    for (const b of L.BEDS || []) if (inBox(x, z, b.x - b.hx - 0.12, b.z - b.hz - 0.12, b.x + b.hx + 0.12, b.z + b.hz + 0.12)) return false;
    if (Math.hypot(x - L.BIN.start.x, z - L.BIN.start.z) < 0.6) return false;
    return true;
  };
  // o pé de cada tufo fica 6 mm enterrado: a base das hastes não briga com o gramado (z-fighting)
  const SINK = -0.006;
  const addTuft = (x, z, s) => kit.add(tufts[Math.floor(R() * 3)], { color: null, slot: 'plant', x, y: SINK, z, sx: s, sy: s * (0.85 + R() * 0.3), sz: s, ry: R() * 6.28, ...o });
  const addFlower = (x, z) => kit.add(FLOWERS[Math.floor(R() * FLOWERS.length)], { color: null, slot: 'plant', x, y: SINK, z, sx: 1.15, sy: 1 + R() * 0.3, sz: 1.15, ry: R() * 6.28, ...o });
  const addClover = (x, z) => kit.add(clovers[Math.floor(R() * 2)], { color: null, slot: 'plant', x, y: SINK, z, sx: 1.2, sz: 1.2, ry: R() * 6.28, ...o });
  // as folhas ficam um pouco reviradas (nenhuma face deitada no mesmo plano de uma poça ou de um caminho)
  const addLeaf = (x, z) => { const s = 0.03 + R() * 0.022; kit.add(LEAF, { color: LEAVES[Math.floor(R() * LEAVES.length)], slot: 'plant', x, y: 0.031 + R() * 0.004, z, sx: s, sz: s * 0.5, rx: (R() < 0.5 ? -1 : 1) * (0.1 + R() * 0.12), ry: R() * 6.28, rz: (R() < 0.5 ? -1 : 1) * (0.1 + R() * 0.14), ...o }); };
  // a cinta do lago: capim na beirada da areia, florzinhas e trevos um pouco mais para fora
  for (const p of pts) {
    const out = (d) => ({ x: p.x - p.nx * d, z: p.z - p.nz * d });
    if (R() < 0.34) { const q = out(p.wg + 0.02 + R() * 0.3); if (free(q.x, q.z, 0.2)) addTuft(q.x, q.z, 1 + R() * 0.4); }
    if (R() < 0.16) { const q = out(p.wg + 0.4 + R() * 1.1); if (free(q.x, q.z, 0.3)) addTuft(q.x, q.z, 0.8 + R() * 0.5); }
    if (R() < 0.11) { const q = out(p.wg + 0.3 + R() * 1.6); if (free(q.x, q.z, 0.3)) addFlower(q.x, q.z); }
    if (R() < 0.05) { const q = out(p.wg + 0.5 + R() * 1.8); if (free(q.x, q.z, 0.3)) addClover(q.x, q.z); }
    if (R() < 0.07) { const q = out(p.wg + R() * 1.5); if (free(q.x, q.z, 0.15)) addLeaf(q.x, q.z); }
  }
  /** Espalha num retângulo do gramado: [x0, z0, x1, z1, capins, flores, trevos, folhas] */
  const AREAS = [
    [12.6, Bt.maxZ + Bt.half + 0.6, W.maxX - 0.4, W.maxZ - 0.75, 26, 13, 7, 10], // o gramado do sul, entre a prainha e o muro
    [13.2, -8.4, W.maxX - 0.4, -5.6, 12, 8, 5, 8], // entre a guarita e o lago
    [B.x0 - 3.4, B.z0 - 0.05, B.x0 - 0.15, B.z0 + 0.5, 7, 2, 1, 3], // ao pé do muro norte, a oeste da guarita
    [B.x0 - 0.6, B.z1 + 0.1, B.x0 - 0.14, B.z1 + 1.5, 3, 1, 0, 2], // no canto sudoeste da guarita
  ];
  for (const [x0, z0, x1, z1, nt, nf, nc, nl] of AREAS) {
    const spot = (fn, n, m) => {
      for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
        const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
        if (!free(x, z, m)) continue;
        fn(x, z);
        k++;
      }
    };
    spot((x, z) => addTuft(x, z, 0.8 + R() * 0.7), nt, 0.3);
    spot(addFlower, nf, 0.3);
    spot(addClover, nc, 0.3);
    spot(addLeaf, nl, 0.15);
  }
}

// =====================================================================  LIXEIRA DE RODINHAS
/**
 * Lixeira verde de rodinhas: base quadrada de meia medida BIN.half, BIN.height até o alto da tampa (chata: a Radhija
 * sobe nela), origem no chão, no meio. A frente (com o painel) para o leste; a alça, a dobradiça e as rodas atrás
 * (oeste), o eixo ao longo de z. O adesivo de reciclagem na frente e nas duas laterais.
 * @param {THREE.Group} root @param {any} L
 */
function buildBin(root, L) {
  const Bn = L.BIN, H = Bn.height, hf = Bn.half;
  const group = new THREE.Group();
  group.name = 'recanto:lixeira';
  const GREEN = '#3c8a46', GREEN_D = '#2f7039';
  const halfW = (y) => 0.3 * (0.84 + 0.16 * (y / 0.86)); // o corpo afunila para baixo
  const taper = Math.atan((0.3 * 0.16) / 0.86);
  const parts = [];
  const body = rb(0.6, 0.86, 0.6, 0.05, 2);
  const bp = body.attributes.position;
  for (let i = 0; i < bp.count; i++) { const k = halfW(bp.getY(i)) / 0.3; bp.setX(i, bp.getX(i) * k); bp.setZ(i, bp.getZ(i) * k); }
  // o plástico: mais escuro e respingado de barro perto do chão
  parts.push(part(body, (q) => _c.set(GREEN).offsetHSL(0, 0, (q.y < 0.16 ? -0.08 * (1 - q.y / 0.16) : 0) + (vnoise2(q.x * 7 + q.z * 7, q.y * 2.5) - 0.5) * 0.035)));
  parts.push(part(rb(0.63, 0.06, 0.63, 0.02, 1), GREEN_D, { y: 0.84 }));
  parts.push(part(rb(hf * 2, 0.05, hf * 2, 0.02, 2), GREEN_D, { y: 0.9 }));
  parts.push(part(rb(0.58, H - 0.95, 0.58, 0.025, 2), (q) => _c.set(GREEN).offsetHSL(0, 0, (vnoise2(q.x * 9, q.z * 9) - 0.5) * 0.03), { y: 0.95 }));
  parts.push(part(rb(0.03, 0.035, 0.34, 0.01, 1), GREEN_D, { x: hf - 0.015, y: 0.885 })); // a pega da tampa
  parts.push(part(rb(0.05, 0.05, 0.5, 0.015, 1), GREEN_D, { x: -hf + 0.025, y: 0.855 }));
  parts.push(part(cyl(0.018, 0.018, 0.46, 10).translate(0, -0.23, 0), '#2a5c31', { x: -hf + 0.02, y: 0.83, rx: Math.PI / 2 })); // a alça
  for (const s of [-1, 1]) parts.push(part(rb(0.05, 0.08, 0.035, 0.01, 1), GREEN_D, { x: -hf + 0.035, y: 0.79, z: s * 0.2 }));
  // nervuras nas laterais e o painel da frente, seguindo o afunilado
  for (const s of [-1, 1]) for (const x of [-0.2, 0.2]) parts.push(part(rb(0.04, 0.6, 0.014, 0.006, 1), GREEN_D, { x, y: 0.16, z: s * (halfW(0.16) + 0.004), rx: s * taper }));
  parts.push(part(rb(0.014, 0.4, 0.36, 0.01, 1), GREEN_D, { x: halfW(0.3) + 0.004, y: 0.3, rz: -taper }));
  parts.push(part(rb(0.06, 0.05, 0.4, 0.015, 1), '#2a5c31', { x: halfW(0) - 0.02, y: 0 }));
  // os adesivos de reciclagem: nas duas laterais e no painel da frente
  parts.push(part(recycleSticker(0.105), null, { y: 0.52, z: halfW(0.52) + 0.003, rx: taper }));
  parts.push(part(recycleSticker(0.105), null, { y: 0.52, z: -(halfW(0.52) + 0.003), rx: -taper, ry: Math.PI }));
  parts.push(part(recycleSticker(0.1).rotateY(Math.PI / 2), null, { x: halfW(0.5) + 0.0145, y: 0.5, rz: -taper }));
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
 * Pedalinho de patinho amarelo: base quadrada de meia medida BOAT.half; origem no chão (o fundo do casco), no meio. A
 * cabeça para o leste e a cauda (com a caixa da roda de pá) para o oeste: no canal, a Radhija atravessa pelo meio do
 * convés de tábuas, do sul (a margem) para o norte (a ilha). O convés fica a 0,30 m do fundo; boiando (y = floatY), o
 * fundo fica 3 cm dentro d'água e o convés a 0,15 m. Em cima do convés, duas PRANCHAS dobradas: quando o barquinho
 * chega ao canal elas viram para fora e apoiam na margem e na ilha (a ponte cobre o canal inteiro).
 * @param {THREE.Group} root @param {any} L @param {((dt: number, t: number) => void)[]} live
 */
function buildBoat(root, L, live) {
  const Bt = L.BOAT, WY = L.LAKE.waterY;
  const DECK = 0.3, RIMY = 0.29, FLOAT_Y = WY - 0.03;
  const group = new THREE.Group();
  group.name = 'recanto:barquinho';
  const float = new THREE.Group();
  group.add(float);
  const HA = 0.46, HB = 0.48, E = 4.5;
  /** A planta (um quadrado de cantos bem redondos, um pouco mais estreito na popa) no ângulo a, na escala k. */
  const planAt = (a, k) => {
    const c = Math.cos(a), s = Math.sin(a);
    const px = Math.sign(c) * Math.abs(c) ** (2 / E), pz = Math.sign(s) * Math.abs(s) ** (2 / E);
    return [px * HA * k, pz * HB * k * (px < 0 ? 1 - 0.1 * px * px : 1)];
  };
  const zExt = (x, k = 1) => { const u = Math.min(1, Math.abs(x) / (HA * k)); return HB * k * (1 - u ** E) ** (1 / E) * (x < 0 ? 1 - 0.1 * u * u : 1); };
  const parts = [];
  // o casco: anéis da planta subindo (fundo chato, bojo e a borda um pouco para dentro)
  const PROF = [[0, 0.74], [0.025, 0.85], [0.07, 0.94], [0.14, 0.985], [0.21, 1.0], [RIMY, 0.985]];
  const SEG = 48;
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
  // o fundo escuro que aparece nas frestas (no contorno do casco) e o convés de tábuas (de bombordo a boreste)
  const up = [0, DECK - 0.024, 0], ui = [];
  for (let i = 0; i < SEG; i++) { const [x, z] = planAt((i / SEG) * Math.PI * 2, 0.975); up.push(x, DECK - 0.024, z); }
  for (let i = 0; i < SEG; i++) ui.push(0, 1 + ((i + 1) % SEG), 1 + i);
  const under = new THREE.BufferGeometry();
  under.setAttribute('position', new THREE.Float32BufferAttribute(up, 3));
  under.setIndex(ui);
  under.computeVertexNormals();
  parts.push(part(under, '#5a3d26'));
  const NP = 13, PP = 0.066;
  for (let i = 0; i < NP; i++) {
    const x = (i - (NP - 1) / 2) * PP;
    parts.push(part(slab(0.06, 0.012, 2 * zExt(Math.abs(x) + 0.03, 0.955)), tone(['#c68e55', '#b9824b', '#cf9a62'][i % 3], 0.04, 8, i), { x, y: DECK - 0.012 }));
  }
  // a borda de borracha laranja
  const rimPts = [];
  for (let i = 0; i < 64; i++) { const [x, z] = planAt((i / 64) * Math.PI * 2, 0.985); rimPts.push(new THREE.Vector3(x, RIMY, z)); }
  parts.push(part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 80, 0.022, 6, true), '#ff8a1e'));
  // as asas nos flancos (o norte e o sul: as pranchas passam por cima delas)
  for (const s of [-1, 1]) parts.push(part(new THREE.SphereGeometry(1, 14, 10), '#f4b324', { x: -0.05, y: 0.17, z: s * 0.478, sx: 0.2, sy: 0.075, sz: 0.035, rz: 0.15 }));
  // o pescoço com o lenço vermelho, a cabeça (bochechas, olhos com brilho, bico) e o topete
  const NX = 0.35, HX = 0.375, HY = 0.62, HR = 0.15;
  parts.push(part(cyl(0.068, 0.088, 0.26, 14), '#ffcf33', { x: NX, y: DECK - 0.02 }));
  parts.push(part(new THREE.TorusGeometry(0.078, 0.02, 6, 16).rotateX(Math.PI / 2), '#e8463c', { x: NX, y: 0.43 }));
  parts.push(part(new THREE.ConeGeometry(0.03, 0.09, 6), '#d63a31', { x: NX - 0.09, y: 0.4, rz: 2.6 }));
  parts.push(part(new THREE.SphereGeometry(HR, 20, 14), (q) => _c.copy(cTop).offsetHSL(0, 0, q.y * 0.12), { x: HX, y: HY }));
  parts.push(part(new THREE.SphereGeometry(0.06, 12, 8), '#ff8a1e', { x: HX + 0.13, y: HY - 0.012, sx: 1.25, sy: 0.36, sz: 1.0 }));
  parts.push(part(new THREE.SphereGeometry(0.052, 12, 8), '#e9761a', { x: HX + 0.118, y: HY - 0.036, sx: 1.1, sy: 0.3, sz: 0.9 }));
  for (const s of [-1, 1]) {
    parts.push(part(new THREE.SphereGeometry(0.027, 10, 8), '#1f1510', { x: HX + 0.088, y: HY + 0.05, z: s * 0.1 }));
    parts.push(part(new THREE.SphereGeometry(0.008, 6, 4), '#ffffff', { x: HX + 0.104, y: HY + 0.062, z: s * 0.113 }));
    parts.push(part(new THREE.SphereGeometry(0.03, 10, 8), '#f7a6a0', { x: HX + 0.08, y: HY - 0.02, z: s * 0.122, sy: 0.75, sz: 0.35 }));
  }
  for (const [dx, dz, rx] of [[-0.03, -0.016, -0.35], [-0.01, 0, 0], [-0.03, 0.016, 0.35]]) parts.push(part(new THREE.ConeGeometry(0.02, 0.07, 6), '#ffcf33', { x: HX + dx, y: HY + HR - 0.012, z: dz, rx, rz: 0.5 }));
  // a caixa da roda de pá na popa (branca com a faixa vermelha) e a cauda arrebitada em cima dela
  parts.push(part(new THREE.CylinderGeometry(0.1, 0.1, 0.19, 14, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), '#f7f2e8', { x: -0.36, y: DECK }));
  parts.push(part(new THREE.CylinderGeometry(0.103, 0.103, 0.03, 14, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), '#e8463c', { x: -0.36, y: DECK }));
  parts.push(part(new THREE.ConeGeometry(0.075, 0.17, 12), '#ffcf33', { x: -0.435, y: DECK + 0.12, sz: 0.6, rz: 0.9 }));
  // a bandeirinha num canto da popa (fora das pranchas e do corredor por onde a Radhija passa)
  const fl = link([-0.4, DECK, -0.25], [-0.4, 0.62, -0.25], 0.006, 5);
  parts.push(part(fl.g, '#f4efe6', { x: fl.x, y: fl.y, z: fl.z }));
  const pennant = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.13, -0.035), new THREE.Vector2(0, -0.07)]));
  parts.push(part(doubleSide(pennant), '#e8463c', { x: -0.4, y: 0.615, z: -0.25 }));
  // as dobradiças das pranchas
  const HINGE_Z = 0.46, HINGE_Y = DECK + 0.005;
  for (const s of [-1, 1]) for (const x of [-0.2, 0.2]) parts.push(part(cyl(0.008, 0.008, 0.07, 6).translate(0, -0.035, 0), '#55595e', { x, y: HINGE_Y, z: s * HINGE_Z, rz: Math.PI / 2 }));
  const mesh = new THREE.Mesh(mergeParts(parts), SLOTS.solid());
  mesh.name = 'recanto:barquinho-casco';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  float.add(mesh);
  // as pranchas: dobradas em cima do convés (viradas para dentro); estendidas, descem TH rad até a margem e a ilha
  const PL_HALF = 0.31, PL_LEN = 0.36, PL_T = 0.018, TH = 0.32;
  const plankGeo = () => {
    const ps = [];
    const NB = 4, bw = (2 * PL_HALF) / NB;
    for (let i = 0; i < NB; i++) ps.push(part(rb(bw - 0.006, PL_T, PL_LEN, 0.004, 1), tone(['#dcae6e', '#d2a162', '#e3b778', '#d6a868'][i], 0.04, 7, i + 60), { x: -PL_HALF + bw * (i + 0.5), y: -PL_T, z: PL_LEN / 2 }));
    // as travessas de reforço (por baixo quando a prancha está estendida; à mostra quando ela está dobrada)
    for (const z of [0.075, PL_LEN - 0.075]) ps.push(part(rb(2 * PL_HALF - 0.05, 0.012, 0.04, 0.004, 1), '#a9793f', { y: -PL_T - 0.012, z }));
    // a beirada que apoia na margem, pintada de laranja
    ps.push(part(rb(2 * PL_HALF, PL_T + 0.004, 0.03, 0.004, 1), '#ff8a1e', { y: -PL_T - 0.002, z: PL_LEN - 0.015 }));
    return mergeParts(ps);
  };
  const planks = [1, -1].map((s) => {
    const holder = new THREE.Group();
    holder.position.set(0, HINGE_Y, s * HINGE_Z);
    holder.rotation.y = s > 0 ? 0 : Math.PI;
    const m = new THREE.Mesh(plankGeo(), SLOTS.solid());
    m.name = `recanto:barquinho-prancha-${s > 0 ? 'sul' : 'norte'}`;
    m.castShadow = true;
    m.receiveShadow = true;
    holder.add(m);
    float.add(holder);
    return m;
  });
  /** 0 dobradas em cima do convés … 1 estendidas. */
  const setPlanks = (k) => { const a = -Math.PI + (Math.PI + TH) * smooth(k); for (const m of planks) m.rotation.x = a; };
  setPlanks(0);
  // o chão de pisar (invisível): o convés e as duas pranchas estendidas, na largura do canal; só vale com o barquinho
  // encaixado
  const drop = PL_LEN * Math.sin(TH), reach = PL_LEN * Math.cos(TH), WALK = 0.55;
  const walkGeo = mergeGeometries([
    quadUp(-WALK, WALK, DECK, -HINGE_Z, DECK, HINGE_Z),
    quadUp(-WALK, WALK, HINGE_Y, HINGE_Z, HINGE_Y - drop, HINGE_Z + reach),
    quadUp(-WALK, WALK, HINGE_Y, -HINGE_Z, HINGE_Y - drop, -HINGE_Z - reach),
  ]);
  const walk = new THREE.Mesh(walkGeo, ghostMat());
  walk.name = 'recanto:barquinho-convés';
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
    foamGeo.computeVertexNormals();
  }
  const foam = new THREE.Mesh(foamGeo, foamMat());
  foam.name = 'recanto:barquinho-espuma';
  foam.renderOrder = 3;
  const shadow = contactShadow(HA + 0.1, HB + 0.1, 0.32, 0.006);
  shadow.name = 'recanto:barquinho-sombra';
  group.add(foam, shadow);
  root.add(group);
  const dock = Bt.dock;
  let floating = false, deploy = 0, want = 0;
  const setPos = (x, z, y = 0, tilt = 0) => {
    group.position.set(x, y, z);
    group.rotation.x = -tilt; // tilt > 0: o lado norte (o que entra no canal) afunda
    floating = y < -0.02;
    foam.visible = floating;
    foam.position.y = WY + 0.004 - y;
    shadow.visible = !floating;
    walk.visible = Math.hypot(x - dock.x, z - dock.z) < 0.35;
    // as pranchas abrem quando ele chega ao canal (os últimos 30 cm) e voltam dobradas na hora, fora dele
    want = Math.abs(x - dock.x) < 0.2 && z - dock.z < 0.3 ? 1 : 0;
    if (!want && deploy > 0) { deploy = 0; setPlanks(0); }
    if (!floating) { float.position.y = 0; float.rotation.set(0, 0, 0); }
  };
  live.push((dt, t) => {
    if (deploy < want) { deploy = Math.min(1, deploy + dt / 0.8); setPlanks(deploy); }
    if (!floating) return;
    // boiando: sobe e desce de leve e balança (com as pranchas apoiadas, quase nada)
    const k = 1 - 0.7 * deploy;
    float.position.y = Math.sin(t * 1.4) * 0.004 * k;
    float.rotation.set(Math.sin(t * 1.1) * 0.008 * k, 0, Math.sin(t * 0.9 + 0.7) * 0.012 * k);
  });
  return {
    prop: { object: group, setPos, floatY: FLOAT_Y, deckY: DECK },
    see: [mesh, ...planks],
    reset() { setPos(Bt.start.x, Bt.start.z, 0, 0); },
  };
}
