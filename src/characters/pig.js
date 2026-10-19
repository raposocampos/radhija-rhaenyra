// Porquinhos (fase 10 e a arena ?level=porcos): rosados com manchinhas, procedurais, no mesmo pipeline orgânico das
// dogs e da Dona Gansa: SDF (união suave de primitivas) → Surface Nets → SkinnedMesh com pesos automáticos. Tronco,
// cabeça com bochechas e as quatro patinhas com cascos formam UMA malha com esqueleto (tronco, cabeça e coxa + canela
// de cada pata); orelhas caídas, focinho com narinas, rabinho enrolado e olhos são peças rígidas presas aos ossos.
// Dois materiais para todos os porcos (pele com cor por vértice e olhos), sete malhas por porco; a geometria do corpo
// é gerada uma vez e cada variante só troca o atributo de cor (as manchinhas).
//
// API (docs/ARQUITETURA.md §7, tipo PigModel em src/types.d.ts):
//   createPig({ variant = 0 }) → { object, radius, update(dt, anim), oink(), bump(), shake(), lowestY(), stats }
//   anim = { speed (m/s; a marcha passa do passo ao trote sozinha), turn (rad/s; girando parado ele dá passinhos),
//            action, lookAt (Vector3 | {x,y,z} | null) }
//   action: 'idle' | 'walk' | 'sniff' (fuça o chão) | 'eat' (come no chão, mastigando) | 'alert' (cabeça e orelhas
//           em pé) | 'lie' (deitado de barriga, patinhas dobradas) | 'sleep' (tomba de lado e dorme, Zzz)
//   oink() / bump() / shake(): gestos de uma vez (o "oinc" mexe o corpo todo; esbarrão de cabeça; a sacudida de quem
//   acordou). Pés plantados por IK de duas partes; uma trava de chão segura a cabeça e ergue o corpo se alguma pose
//   encostar abaixo do chão (nada atravessa o chão). lowestY(): ponto mais baixo (m, relativo ao chão) no último quadro.
import * as THREE from 'three';
import { compileSDF, groupsBounds, surfaceNets, fbm } from '../dogs/sdf.js';
import { shareResource } from '../core/resources.js';
import { canvasTexture, radialTexture, mergeGeometries } from '../world/util.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);

// ---------------------------------------------------------------------------- desenho (metros, +Z = frente)
const sph = (c, r, bone) => ({ t: 0, c, r, bone });
const ell = (c, r, bone) => ({ t: 1, c, r, bone });
const cone = (a, ra, b, rb, bone) => ({ t: 2, a, b, ra, rb, bone });

const BONES = ['body', 'head', 'flU', 'flL', 'frU', 'frL', 'hlU', 'hlL', 'hrU', 'hrL'];
/** @type {Record<string, number>} */
const PARENT = { body: -1, head: 0, flU: 0, flL: 2, frU: 0, frL: 4, hlU: 0, hlL: 6, hrU: 0, hrL: 8 };
/** Coxa e canela (m): do quadril (HIP_Y) à sola do casco (y = 0) com a pata esticada. */
const L1 = 0.1, L2 = 0.1, HIP_Y = 0.2;
/** Patas: +X é a esquerda do porco (ele olha para +Z). Ordem: dianteira esq./dir., traseira esq./dir. */
const LEGS = [
  { key: 'fl', side: 1, front: true, x: 0.078, z: 0.13 },
  { key: 'fr', side: -1, front: true, x: -0.078, z: 0.13 },
  { key: 'hl', side: 1, front: false, x: 0.08, z: -0.155 },
  { key: 'hr', side: -1, front: false, x: -0.08, z: -0.155 },
];
/** @type {Record<string, number[]>} */
const BONE_POS = {
  body: [0, 0.235, 0],
  head: [0, 0.272, 0.19],
};
for (const l of LEGS) {
  BONE_POS[`${l.key}U`] = [l.x, HIP_Y, l.z];
  BONE_POS[`${l.key}L`] = [l.x, HIP_Y - L1, l.z];
}
const HEAD_C = [0, 0.29, 0.255]; // centro do crânio (para achar a superfície dos olhos)
const CELL = 0.0125;
const GEO = {}; // geometrias e materiais compartilhados por todos os porcos (vivem com a aplicação)

function design() {
  const torso = {
    k: 0.06,
    prims: [
      ell([0, 0.235, -0.01], [0.148, 0.128, 0.235], 'body'), // barril
      ell([0, 0.232, 0.105], [0.132, 0.122, 0.12], 'body'), // peito e ombros
      ell([0, 0.24, -0.15], [0.138, 0.128, 0.135], 'body'), // garupa redonda
      ell([0, 0.19, -0.02], [0.128, 0.095, 0.2], 'body'), // barriguinha
    ],
  };
  const head = {
    k: 0.035, join: 0.05,
    prims: [
      ell(HEAD_C, [0.098, 0.092, 0.098], 'head'), // cabeça
      sph([0.048, 0.252, 0.282], 0.058, 'head'), // bochechas
      sph([-0.048, 0.252, 0.282], 0.058, 'head'),
      cone([0, 0.283, 0.3], 0.058, [0, 0.265, 0.342], 0.046, 'head'), // ponte do focinho
    ],
  };
  const legs = {
    k: 0.02, join: 0.045,
    prims: LEGS.flatMap((l) => {
      const U = `${l.key}U`, Lo = `${l.key}L`;
      return [
        cone([l.x, HIP_Y + 0.02, l.z], l.front ? 0.045 : 0.056, [l.x, HIP_Y - L1, l.z], 0.03, U), // coxa (pernil atrás)
        cone([l.x, HIP_Y - L1, l.z], 0.03, [l.x, 0.034, l.z + 0.006], 0.024, Lo), // canela
        cone([l.x, 0.036, l.z + 0.006], 0.025, [l.x, 0.017, l.z], 0.017, Lo), // casco (sola no fim da canela)
      ];
    }),
  };
  return [torso, head, legs];
}

// ---------------------------------------------------------------------------- cores
const tmpC = new THREE.Color();
const lin = (hex) => { tmpC.set(hex); return [tmpC.r, tmpC.g, tmpC.b]; };
const PINK = lin('#f2b3ae');
const BELLY = lin('#f8d2ca');
const BACK = lin('#eda5a3');
const NOSE = lin('#f0a3a6');
const LEG = lin('#e9a4a2');
const HOOF = lin('#5e463f');
const SPOT = lin('#a8726b');
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** Manchinhas de cada variante: [x, y, z, raio] (esferas que cortam a superfície). */
const VARIANTS = [
  // manchas nas costas e no flanco
  { spots: [[0.06, 0.34, -0.11, 0.075], [-0.12, 0.27, 0.02, 0.06], [0.13, 0.25, 0.13, 0.042]], tint: 1 },
  // a da mancha no olho esquerdo e na garupa
  { spots: [[0.07, 0.315, 0.33, 0.045], [-0.03, 0.34, -0.18, 0.085]], tint: 0.985 },
  // sardinhas pelas costas (mais clarinha)
  {
    spots: [[0.05, 0.36, 0.06, 0.026], [-0.06, 0.35, -0.04, 0.03], [0.09, 0.33, -0.15, 0.028], [-0.02, 0.37, -0.2, 0.024],
      [-0.1, 0.32, 0.12, 0.022], [0.11, 0.3, 0.03, 0.022], [-0.11, 0.3, -0.16, 0.026], [0.02, 0.36, 0.17, 0.02]],
    tint: 1.025,
  },
];

function skinColor(variant, x, y, z, ny) {
  const V = VARIANTS[variant % VARIANTS.length];
  let c = PINK;
  if (ny < -0.3) c = mix3(c, BELLY, sstep(-0.3, -0.85, ny)); // barriga mais clarinha
  if (ny > 0.5) c = mix3(c, BACK, sstep(0.5, 0.95, ny) * 0.7); // dorso um tom mais quente
  if (z > 0.3) c = mix3(c, NOSE, sstep(0.3, 0.36, z) * 0.8); // ponte do focinho rosada
  if (y < 0.12) c = mix3(c, LEG, sstep(0.12, 0.06, y));
  const n = fbm(x * 30, y * 30, z * 30, 2, 3 + variant) * 0.012;
  let spot = 0;
  for (const s of V.spots) {
    const d = Math.hypot(x - s[0], y - s[1], z - s[2]) + n;
    spot = Math.max(spot, 1 - sstep(s[3] * 0.72, s[3], d));
  }
  if (y > 0.06) c = mix3(c, SPOT, spot * 0.85);
  c = mix3(c, HOOF, sstep(0.044, 0.034, y)); // casquinho escuro
  const v = (1 + fbm(x * 18, y * 18, z * 18, 2, 11) * 0.03) * V.tint;
  return [c[0] * v, c[1] * v, c[2] * v];
}

// ---------------------------------------------------------------------------- malhas
/** Corpo: malha da SDF com pesos dos ossos (2 por vértice) e as cores de cada variante (mesmos atributos). */
function bodyBase() {
  if (GEO.base) return GEO.base;
  const t0 = performance.now();
  const groups = design();
  const sdf = compileSDF(groups);
  const mesh = surfaceNets(sdf, groupsBounds(groups, 0.02), CELL, { smoothIters: 2, project: 1 });
  const prims = groups.flatMap((g) => g.prims);
  const nv = mesh.positions.length / 3;
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const d = new Float32Array(prims.length);
  const bw = new Float32Array(BONES.length);
  const tau = 0.014;
  for (let v = 0; v < nv; v++) {
    sdf.primDistances(mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2], d);
    let dmin = 1e9;
    for (let i = 0; i < d.length; i++) dmin = Math.min(dmin, d[i]);
    bw.fill(0);
    for (let i = 0; i < d.length; i++) bw[BONES.indexOf(prims[i].bone)] += Math.exp(-(d[i] - dmin) / tau);
    let b0 = 0, b1 = -1;
    for (let b = 1; b < BONES.length; b++) {
      if (bw[b] > bw[b0]) { b1 = b0; b0 = b; } else if (b1 < 0 || bw[b] > bw[b1]) b1 = b;
    }
    const sum = bw[b0] + (b1 >= 0 ? bw[b1] : 0);
    si[v * 4] = b0; sw[v * 4] = bw[b0] / sum;
    if (b1 >= 0) { si[v * 4 + 1] = b1; sw[v * 4 + 1] = bw[b1] / sum; }
  }
  GEO.base = {
    sdf, nv,
    position: new THREE.BufferAttribute(mesh.positions, 3),
    normal: new THREE.BufferAttribute(mesh.normals, 3),
    skinIndex: new THREE.Uint16BufferAttribute(si, 4),
    skinWeight: new THREE.BufferAttribute(sw, 4),
    index: new THREE.BufferAttribute(mesh.indices, 1),
    ms: +(performance.now() - t0).toFixed(1),
    tris: mesh.indices.length / 3,
  };
  return GEO.base;
}

function bodyGeometry(variant) {
  const key = `body${variant % VARIANTS.length}`;
  if (GEO[key]) return GEO[key];
  const B = bodyBase();
  const col = new Float32Array(B.nv * 3);
  const P = B.position.array, N = B.normal.array;
  for (let v = 0; v < B.nv; v++) col.set(skinColor(variant, P[v * 3], P[v * 3 + 1], P[v * 3 + 2], N[v * 3 + 1]), v * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', B.position);
  g.setAttribute('normal', B.normal);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', B.skinIndex);
  g.setAttribute('skinWeight', B.skinWeight);
  g.setIndex(B.index);
  g.computeBoundingSphere();
  return (GEO[key] = shareResource(g));
}

/** Cor sólida por vértice (para as peças rígidas usarem o mesmo material da pele). */
function tint(g, c) {
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** Orelha caída: folha larga na base e pontuda, em concha (bordas para o lado de dentro, -Y). +Z = comprimento. */
const EAR = { w: 0.05, th: 0.011, len: 0.095, cup: 0.32, curl: 0.014 };
function earGeometry() {
  if (GEO.ear) return GEO.ear;
  const g = new THREE.SphereGeometry(1, 16, 10);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const outer = lin('#eeaaa7'), inner = lin('#e48d96'), edge = lin('#df9a9a');
  for (let i = 0; i < p.count; i++) {
    const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
    const t = (uz + 1) / 2; // 0 na base … 1 na ponta
    const w = EAR.w * Math.pow(Math.sin(Math.PI * (0.5 + 0.5 * t)), 0.75) + 0.003;
    const th = EAR.th * (1 - 0.6 * t);
    const x = ux * w;
    const y = uy * th - EAR.cup * ux * ux * w - EAR.curl * t * t;
    p.setXYZ(i, x, y, t * EAR.len);
    const c = uy < 0 ? mix3(inner, edge, Math.abs(ux) * 0.7) : outer;
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return (GEO.ear = shareResource(g));
}

/** Focinho: disco de bordas redondas (eixo +Z), um pouco oval, com as duas narinas. */
function snoutGeometry() {
  if (GEO.snout) return GEO.snout;
  const prof = [
    [0, 0], [0.043, 0], [0.049, 0.008], [0.05, 0.026], [0.048, 0.034], [0.043, 0.039], [0.034, 0.0415], [0.022, 0.0425], [0.01, 0.043], [0, 0.043],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const disc = new THREE.LatheGeometry(prof, 26);
  disc.rotateX(Math.PI / 2); // eixo do torno (Y) vira +Z
  disc.scale(1, 0.86, 1);
  const pa = disc.attributes.position;
  const col = new Float32Array(pa.count * 3);
  const rim = lin('#ee9ea4'), face = lin('#f6b9bd');
  for (let i = 0; i < pa.count; i++) col.set(mix3(rim, face, sstep(0.036, 0.042, pa.getZ(i))), i * 3);
  disc.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const nostrils = [1, -1].map((s) => {
    const n = new THREE.SphereGeometry(1, 10, 8);
    n.scale(0.0075, 0.0115, 0.0055);
    n.rotateZ(s * 0.25);
    n.translate(s * 0.0165, 0.001, 0.0425);
    return tint(n, lin('#7d434a'));
  });
  const parts = [disc.toNonIndexed(), ...nostrils.map((n) => n.toNonIndexed())];
  for (const q of parts) q.deleteAttribute('uv');
  const g = mergeGeometries(parts);
  for (const q of [disc, ...nostrils, ...parts]) q.dispose();
  g.computeVertexNormals();
  return (GEO.snout = shareResource(g));
}

/** Rabinho em saca-rolha (1,7 volta), afinando na ponta. Eixo do saca-rolha = +Y local. */
function tailGeometry() {
  if (GEO.tail) return GEO.tail;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const R = 0.018 * (1 - 0.35 * t);
    const a = t * 1.7 * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * R - 0.018, t * 0.05, Math.sin(a) * R));
  }
  const path = new THREE.CatmullRomCurve3(pts);
  const segs = 30, radial = 7;
  const g = new THREE.TubeGeometry(path, segs, 0.0068, radial, false);
  const p = g.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    path.getPointAt(u, c);
    const k = 1 - 0.82 * Math.pow(u, 1.5);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(k).add(c);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  tint(g, lin('#eda6a4'));
  return (GEO.tail = shareResource(g));
}

/** Olho: bolinha preta brilhante com dois brilhinhos brancos (cor por vértice; o material faz o branco brilhar). */
function eyeGeometry() {
  if (GEO.eye) return GEO.eye;
  const ball = tint(new THREE.SphereGeometry(0.0165, 14, 10), lin('#140d10'));
  const c1 = tint(new THREE.SphereGeometry(0.0048, 8, 6).translate(0.0042, 0.0062, 0.0138), [1, 1, 1]);
  const c2 = tint(new THREE.SphereGeometry(0.0022, 6, 4).translate(-0.0052, -0.0042, 0.0152), [1, 1, 1]);
  const parts = [ball, c1, c2].map((q) => { const n = q.toNonIndexed(); n.deleteAttribute('uv'); q.dispose(); return n; });
  const g = mergeGeometries(parts);
  for (const q of parts) q.dispose();
  return (GEO.eye = shareResource(g));
}

function skinMaterial() {
  if (GEO.skin) return GEO.skin;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      // "pelúcia" barata: brilho suave nas bordas (contra a luz) e um calorzinho para não ficar cinza na sombra
      `#include <emissivemap_fragment>
      {
        float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += diffuseColor.rgb * (rim * 0.32 + 0.045);
      }`,
    );
  };
  m.customProgramCacheKey = () => 'pigSkin';
  return (GEO.skin = shareResource(m));
}
function eyeMaterial() {
  if (GEO.eyeMat) return GEO.eyeMat;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.14, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * step(0.6, vColor.r) * 0.9;',
    );
  };
  m.customProgramCacheKey = () => 'pigEye';
  return (GEO.eyeMat = shareResource(m));
}
function shadowMaterial() {
  return GEO.shadow || (GEO.shadow = shareResource(new THREE.MeshBasicMaterial({
    map: radialTexture(), color: '#1b1206', transparent: true, opacity: 0.5, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false,
  })));
}
function zzzTexture() {
  return GEO.zzz || (GEO.zzz = shareResource(canvasTexture(64, 64, (g, w, h) => {
    g.font = '700 40px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(74,52,38,0.9)';
    g.strokeText('z', w / 2, h / 2 + 2);
    g.fillStyle = '#fff8ec';
    g.fillText('z', w / 2, h / 2 + 2);
  }, { repeat: false })));
}

/**
 * Pontos para a trava de chão, escolhidos uma vez: da pele (rest pose + 2 ossos), separados pelo osso principal
 * (cabeça densa: é ela que chega perto do chão fuçando; tronco; canelas), e das peças rígidas (focinho e orelhas).
 */
function groundSamples() {
  if (GEO.samples) return GEO.samples;
  const B = bodyBase();
  const P = B.position.array, SI = B.skinIndex.array, SW = B.skinWeight.array;
  const head = BONES.indexOf('head');
  const shins = new Set(['flL', 'frL', 'hlL', 'hrL'].map((n) => BONES.indexOf(n)));
  const out = { head: [], body: [], shin: [], snout: [], ear: [] };
  for (let v = 0; v < B.nv; v++) {
    const main = SW[v * 4] >= SW[v * 4 + 1] ? SI[v * 4] : SI[v * 4 + 1];
    const y = P[v * 3 + 1];
    const list = main === head ? out.head : shins.has(main) ? out.shin : out.body;
    const stride = main === head ? 3 : shins.has(main) ? 5 : y < 0.13 ? 4 : 12;
    if (v % stride !== 0) continue;
    list.push({ x: P[v * 3], y, z: P[v * 3 + 2], b0: SI[v * 4], w0: SW[v * 4], b1: SI[v * 4 + 1], w1: SW[v * 4 + 1] });
  }
  // focinho: a borda do disco (sem repetir os vértices da malha não indexada)
  const seen = new Set();
  const sp = snoutGeometry().attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
    if (Math.hypot(x, y) < 0.028) continue;
    const key = Math.round(x * 1000) + ',' + Math.round(y * 1000) + ',' + Math.round(z * 1000);
    if (seen.has(key)) continue;
    seen.add(key);
    out.snout.push(new THREE.Vector3(x, y, z));
  }
  const ep = earGeometry().attributes.position;
  for (let i = 0; i < ep.count; i += 2) out.ear.push(new THREE.Vector3(ep.getX(i), ep.getY(i), ep.getZ(i)));
  return (GEO.samples = out);
}

/** Ponto da superfície da SDF saindo do centro `c` na direção `dir` (bissecção). */
function surfacePoint(sdf, c, dir) {
  let lo = 0, hi = 0.25;
  for (let i = 0; i < 28; i++) {
    const m = (lo + hi) / 2;
    if (sdf(c[0] + dir.x * m, c[1] + dir.y * m, c[2] + dir.z * m) < 0) lo = m; else hi = m;
  }
  return new THREE.Vector3(c[0] + dir.x * lo, c[1] + dir.y * lo, c[2] + dir.z * lo);
}

// ---------------------------------------------------------------------------- criação
/** @param {{ variant?: number }} [opts] */
export function createPig({ variant = 0 } = {}) {
  const t0 = performance.now();
  const object = new THREE.Group();
  object.name = `porquinho-${variant}`;
  const inner = new THREE.Group(); // a trava de chão ergue este grupo
  object.add(inner);

  // esqueleto (na origem, para os inversos e o bindMatrix ficarem no espaço do porco)
  const bones = BONES.map((n) => {
    const b = new THREE.Bone();
    b.name = `pig-${n}`;
    return b;
  });
  BONES.forEach((n, i) => {
    const p = BONE_POS[n];
    const pp = PARENT[n] >= 0 ? BONE_POS[BONES[PARENT[n]]] : [0, 0, 0];
    bones[i].position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    if (PARENT[n] >= 0) bones[PARENT[n]].add(bones[i]);
  });
  inner.add(bones[0]);
  inner.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const B = Object.fromEntries(BONES.map((n, i) => [n, bones[i]]));
  const restPos = Object.fromEntries(BONES.map((n, i) => [n, bones[i].position.clone()]));

  const skin = skinMaterial();
  const body = new THREE.SkinnedMesh(bodyGeometry(variant), skin);
  body.name = 'porquinho-corpo';
  body.bind(skeleton);
  body.frustumCulled = false;
  body.castShadow = body.receiveShadow = true;
  inner.add(body);

  // peças rígidas na cabeça (posições no espaço do osso da cabeça)
  const hp = BONE_POS.head;
  const H = (x, y, z) => new THREE.Vector3(x - hp[0], y - hp[1], z - hp[2]);
  const snout = new THREE.Mesh(snoutGeometry(), skin);
  snout.name = 'porquinho-focinho';
  snout.position.copy(H(0, 0.265, 0.358));
  snout.castShadow = true;
  B.head.add(snout);

  const sdf = bodyBase().sdf;
  const eyeMat = eyeMaterial();
  const eyes = [1, -1].map((side) => {
    const dir = new THREE.Vector3(side * 0.5, 0.22, 0.84).normalize();
    const s = surfacePoint(sdf, HEAD_C, dir);
    const g = new THREE.Group();
    g.position.copy(H(s.x, s.y, s.z)).addScaledVector(dir, -0.0165 * 0.42);
    g.lookAt(g.position.clone().add(dir)); // +Z do olho para fora
    const m = new THREE.Mesh(eyeGeometry(), eyeMat);
    g.add(m);
    B.head.add(g);
    return g;
  });

  const ears = [1, -1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.copy(H(side * 0.058, 0.364, 0.236));
    const m = new THREE.Mesh(earGeometry(), skin);
    if (side < 0) m.scale.x = -1; // espelho (a concha continua para dentro)
    m.castShadow = true;
    pivot.add(m);
    B.head.add(pivot);
    return { side, pivot, a: 0, v: 0 };
  });

  // rabinho (no osso do tronco): base com o abano e o saca-rolha inclinado para trás e para cima
  const tailBase = new THREE.Group();
  tailBase.position.set(0, 0.302 - BONE_POS.body[1], -0.272);
  const tail = new THREE.Mesh(tailGeometry(), skin);
  tail.rotation.x = -1.0;
  tailBase.add(tail);
  B.body.add(tailBase);

  // sombra de contato e os "Zzz"
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMaterial());
  shadow.position.y = 0.004;
  shadow.renderOrder = 1;
  shadow.userData.noShadow = true;
  object.add(shadow);
  const zzz = [0, 1, 2].map((i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false;
    sp.userData.phase = i / 3;
    object.add(sp);
    return sp;
  });

  // ---------------------------------------------------------------------------- animação
  const ACTIONS = ['sniff', 'eat', 'alert', 'lie', 'sleep'];
  const RATE = { sniff: 5, eat: 5, alert: 7, lie: 2.6, sleep: 1.5 };
  const st = {
    t: Math.random() * 10,
    speed: 0, move: 0, turnS: 0, phase: Math.random(),
    w: { sniff: 0, eat: 0, alert: 0, lie: 0, sleep: 0 },
    oinkT: -1, bumpT: -1, shakeT: -1,
    glanceT: 1, glanceYaw: 0, glancePitch: 0, lookYaw: 0, lookPitch: 0,
    blinkT: 2 + Math.random() * 2, blink: 0,
    sleepSide: Math.random() < 0.5 ? 1 : -1,
    hy1: NaN, hvy: 0,
    lift: 0, minY: 0, headFix: 0, zVis: 0,
  };
  // fases das patas: passo (sequência lateral) e trote (diagonais juntas)
  const OFF_WALK = [0.25, 0.75, 0, 0.5];
  const OFF_TROT = [0, 0.5, 0.5, 0];
  const samples = groundSamples();
  const BM = bones.map(() => new THREE.Matrix4());
  const _e = new THREE.Euler();
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _k = new THREE.Vector3(), _p = new THREE.Vector3();
  const tG = new THREE.Vector3(), tL = new THREE.Vector3(), tR = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _m = new THREE.Matrix4();
  const _down = new THREE.Vector3(0, -1, 0);
  const TAIL_TIP = new THREE.Vector3(-0.018, 0.05, 0);
  const setE = (b, x, y, z) => b.quaternion.setFromEuler(_e.set(x, y, z, 'YXZ'));
  /** Envelope de um gesto: avança o tempo e devolve u (0..1) ou -1 se acabou.
   * @param {'oinkT' | 'bumpT' | 'shakeT'} key @param {number} dur @param {number} dt */
  function gesture(key, dur, dt) {
    if (st[key] < 0) return -1;
    st[key] += dt;
    if (st[key] >= dur) { st[key] = -1; return -1; }
    return st[key] / dur;
  }

  /** IK de duas partes no espaço do tronco: a coxa e a canela levam a sola até `T` (vetor no espaço do tronco). */
  function solveLeg(lg, T) {
    const U = B[`${lg.key}U`], Lo = B[`${lg.key}L`];
    const hip = restPos[`${lg.key}U`];
    const D = _v.copy(T).sub(hip);
    const len = D.length();
    const d = clamp(len, 0.03, L1 + L2 - 1e-4);
    D.divideScalar(Math.max(len, 1e-6));
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    // joelho para a frente nas dianteiras e para trás nas traseiras
    const pole = _v2.set(0, 0, lg.front ? 1 : -1);
    pole.addScaledVector(D, -pole.dot(D));
    if (pole.lengthSq() < 1e-8) pole.set(0, 1, 0).addScaledVector(D, -D.y);
    pole.normalize();
    const knee = _k.copy(hip).addScaledVector(D, a).addScaledVector(pole, h);
    const foot = _p.copy(hip).addScaledVector(D, d);
    U.quaternion.setFromUnitVectors(_down, _v3.copy(knee).sub(hip).normalize());
    _q.copy(U.quaternion).invert();
    Lo.quaternion.setFromUnitVectors(_down, _v3.copy(foot).sub(knee).normalize().applyQuaternion(_q));
  }

  /** y do mundo mais baixo de uma lista de pontos da pele (BM já calculadas). */
  function lowestSkin(list) {
    let m = Infinity;
    for (const s of list) {
      const e0 = BM[s.b0].elements, e1 = BM[s.b1].elements;
      const y = s.w0 * (e0[1] * s.x + e0[5] * s.y + e0[9] * s.z + e0[13]) + s.w1 * (e1[1] * s.x + e1[5] * s.y + e1[9] * s.z + e1[13]);
      if (y < m) m = y;
    }
    return m;
  }
  /** y do mundo mais baixo de pontos de uma peça rígida. */
  function lowestRigid(list, mw) {
    const e = mw.elements;
    let m = Infinity;
    for (const p of list) {
      const y = e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13];
      if (y < m) m = y;
    }
    return m;
  }
  /** Mais baixo (y do mundo): só a cabeça (pele, focinho e orelhas) ou tudo (as canelas só deitado: em pé, plantadas). */
  function lowest(headOnly, shins) {
    for (let b = 0; b < bones.length; b++) BM[b].multiplyMatrices(bones[b].matrixWorld, skeleton.boneInverses[b]);
    let m = Math.min(lowestSkin(samples.head), lowestRigid(samples.snout, snout.matrixWorld));
    for (const e of ears) m = Math.min(m, lowestRigid(samples.ear, /** @type {THREE.Mesh} */ (e.pivot.children[0]).matrixWorld));
    if (headOnly) return m;
    m = Math.min(m, lowestSkin(samples.body), _v.copy(TAIL_TIP).applyMatrix4(tail.matrixWorld).y);
    if (shins) m = Math.min(m, lowestSkin(samples.shin));
    return m;
  }

  function update(dt, A = {}) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    st.t += dt;
    const t = st.t;
    const damp = (cur, target, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
    const action = A.action || 'idle';
    const w = st.w;
    if (action === 'sleep' && w.sleep < 0.02) st.sleepSide = Math.random() < 0.5 ? 1 : -1;
    for (const k of ACTIONS) w[k] = damp(w[k], action === k || (k === 'lie' && action === 'sleep') ? 1 : 0, RATE[k]);
    const down = Math.max(w.lie, w.sleep); // 0 em pé … 1 deitado
    const up = 1 - down;
    st.speed = damp(st.speed, Math.max(0, A.speed || 0) * up, 10);
    const v = st.speed;
    st.turnS = damp(st.turnS, (A.turn || 0) * up, 8);
    st.move = damp(st.move, up * Math.max(sstep(0.03, 0.22, v), sstep(0.4, 1.4, Math.abs(st.turnS)) * 0.75), 8);
    const nose = Math.max(w.sniff, w.eat) * up; // focinho no chão

    // gestos de uma vez
    const uo = gesture('oinkT', 0.5, dt);
    const ub = gesture('bumpT', 0.6, dt);
    const us = gesture('shakeT', 1.0, dt);
    const oink = uo >= 0 ? Math.sin(Math.PI * uo) : 0;
    const hic = uo >= 0 ? Math.abs(Math.sin(TAU * uo)) * (1 - uo) : 0; // "oinc-oinc": dois trancos
    let bumpPitch = 0, bumpZ = 0;
    if (ub >= 0) {
      const wind = sstep(0, 0.3, ub) * (1 - sstep(0.32, 0.45, ub));
      const thrust = sstep(0.32, 0.45, ub) * (1 - sstep(0.55, 1, ub));
      bumpPitch = wind * 0.32 - thrust * 0.12;
      bumpZ = -wind * 0.018 + thrust * 0.05;
    }
    const shakeEnv = us >= 0 ? Math.pow(Math.sin(Math.PI * us), 0.6) : 0;
    const shk = Math.sin(t * 31) * shakeEnv;

    // ---------------- marcha: passo → trote
    const trot = sstep(0.75, 1.35, v);
    const f = lerp(1.7 + 2.4 * v, 2.2 + 1.9 * v, trot);
    st.phase = fract(st.phase + f * dt * st.move);
    const ph = st.phase * TAU;
    const amp = st.move;
    const beta = lerp(0.66, 0.52, trot);
    const stroke = beta * v / Math.max(f, 0.5);
    const lift = lerp(0.03, 0.045, trot) * Math.min(1, 0.45 + v);

    // ---------------- tronco
    const bob = -0.006 * amp * (0.5 - 0.5 * Math.cos(2 * ph));
    const breathe = Math.sin(t * lerp(2.4, 1.5, down)) * (0.0022 + 0.0025 * down);
    const roll = Math.sin(ph) * 0.05 * amp * (1 - trot * 0.5) + st.sleepSide * 1.32 * w.sleep + shk * 0.26 + breathe * 2 * w.sleep;
    const bodyPitch = nose * 0.16 - oink * 0.06 + bumpPitch * 0.2 + w.alert * -0.03 + Math.min(v, 2) * 0.02;
    B.body.position.set(0, BONE_POS.body[1] + bob + breathe - 0.09 * down - 0.02 * nose + oink * 0.006 + hic * 0.004, bumpZ);
    setE(B.body, bodyPitch, Math.sin(ph) * 0.04 * amp, roll);

    // ---------------- olhar
    let tYaw = 0, tPitch = 0;
    if (A.lookAt && down < 0.5) {
      const dx = A.lookAt.x - object.position.x, dz = A.lookAt.z - object.position.z;
      const c = Math.cos(object.rotation.y), s = Math.sin(object.rotation.y);
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      tYaw = clamp(Math.atan2(lx, lz), -0.8, 0.8);
      tPitch = clamp(-Math.atan2((A.lookAt.y ?? 0.3) - 0.3, Math.max(Math.hypot(lx, lz), 0.3)), -0.45, 0.45);
    } else {
      st.glanceT -= dt;
      if (st.glanceT <= 0) {
        st.glanceT = 1.4 + Math.random() * 2.8;
        st.glanceYaw = (Math.random() * 2 - 1) * 0.6;
        st.glancePitch = Math.random() * 0.24 - 0.12;
      }
      tYaw = st.glanceYaw * up * (1 - amp * 0.7) * (1 - nose);
      tPitch = st.glancePitch * up * (1 - nose);
    }
    st.lookYaw = damp(st.lookYaw, tYaw * (1 - nose * 0.7), 5);
    st.lookPitch = damp(st.lookPitch, tPitch, 5);

    // ---------------- cabeça: fuçar (varre e empurra o focinho), comer (mastiga), oinc, esbarrão, sacudida
    const sweep = w.sniff * up * Math.sin(t * 2.1) * 0.32;
    const nod = w.sniff * up * Math.max(0, Math.sin(t * 7.5)) * 0.09 + w.eat * up * Math.sin(t * 10.5) * 0.06;
    const gaitNod = Math.sin(ph * 2) * 0.035 * amp;
    let headPitch = st.lookPitch + nose * 0.95 + nod + gaitNod + down * 0.14 - w.alert * 0.2 - oink * 0.26 - hic * 0.08 + bumpPitch;
    const headYaw = st.lookYaw + sweep + Math.sin(t * 31 + 0.7) * shakeEnv * 0.18;
    const headRoll = Math.sin(t * 31 + 0.5) * shakeEnv * 0.45 - roll * 0.25 * up;
    B.head.position.copy(restPos.head).add(_v.set(0, -0.012 * nose + oink * 0.004, 0.012 * nose + bumpZ * 0.3));
    headPitch -= st.headFix;
    setE(B.head, headPitch, headYaw, headRoll);
    // focinho que mexe: fuçando, mastigando, no oinc (aumenta) e respirando
    const wig = nose * Math.sin(t * 17) * 0.06 + oink * 0.12 + Math.sin(t * 2.4) * 0.015;
    snout.scale.set(1 + wig, 1 + wig * 0.6, 1 - wig * 0.4);

    // ---------------- patas
    B.body.updateMatrix();
    _m.copy(B.body.matrix).invert();
    for (let i = 0; i < 4; i++) {
      const lg = LEGS[i];
      const off = lerp(OFF_WALK[i], OFF_TROT[i], trot);
      const p = fract(st.phase + off);
      let fz = 0, fy = 0;
      const swing = p >= beta;
      if (!swing) fz = stroke * (0.5 - p / beta);
      else {
        const u = (p - beta) / (1 - beta);
        fz = stroke * (-0.5 + u * u * (3 - 2 * u));
        fy = lift * Math.sin(Math.PI * u);
      }
      fz *= amp;
      fy *= amp;
      // girando parado: dianteiras para um lado, traseiras para o outro (passinhos, nada de girar como pião)
      const ts = (1 - sstep(0.03, 0.22, v)) * clamp(st.turnS, -2.5, 2.5) * 0.022 * (swing ? 1 : -1) * (lg.front ? 1 : -1) * amp;
      // alvo no chão (espaço do porco, menos a trava) → espaço do tronco
      tG.set(lg.x * (1 + 0.04 * nose) + ts, fy + 0.0015 - st.lift, lg.z + fz).applyMatrix4(_m);
      const hip = restPos[`${lg.key}U`];
      // deitado de bruços: dianteiras dobradas à frente, traseiras esticadas para trás; dormindo: soltas de lado
      tL.set(hip.x * 1.05, hip.y + (lg.front ? -0.09 : -0.085), hip.z + (lg.front ? 0.07 : -0.17));
      tR.set(hip.x + lg.side * 0.012, hip.y - 0.163, hip.z + (lg.front ? 0.06 : -0.07));
      solveLeg(lg, tG.lerp(tL, down).lerp(tR, w.sleep));
    }

    // ---------------- orelhas (mola: ficam para trás quando a cabeça sobe/desce) e rabinho
    object.updateMatrixWorld(true);
    const headY = B.head.matrixWorld.elements[13];
    if (Number.isNaN(st.hy1)) st.hy1 = headY;
    const vy = (headY - st.hy1) / Math.max(dt, 1e-3);
    const ay = clamp((vy - st.hvy) / Math.max(dt, 1e-3), -30, 30);
    st.hy1 = headY;
    st.hvy = vy;
    const droop = lerp(0.38, 0.12, w.alert) + down * 0.12 + nose * 0.1;
    for (const e of ears) {
      const force = ay * 0.9 + shk * e.side * 70 + hic * 30 - oink * 8;
      e.v += (-140 * e.a - 9 * e.v + force) * dt;
      e.a = clamp(e.a + e.v * dt, -0.5, 0.75);
      e.pivot.rotation.set(droop + e.a, e.side * 0.55, -e.side * 0.4, 'YXZ');
    }
    const wagF = lerp(lerp(4, 7, amp), 9.5, Math.max(w.eat, oink));
    const wagA = (0.2 + 0.3 * w.eat + 0.15 * amp) * (1 - w.sleep * 0.85);
    tailBase.rotation.set(-0.2 + down * 0.35, Math.sin(t * wagF) * wagA + shk * 0.5, Math.sin(t * wagF * 0.5) * wagA * 0.3);

    // ---------------- olhos: piscadas; fechados dormindo; apertadinhos comendo
    st.blinkT -= dt;
    if (st.blinkT <= 0) { st.blink = 1e-4; st.blinkT = 2 + Math.random() * 3.5; }
    let lid = 0;
    if (st.blink > 0) {
      st.blink += dt;
      const u = st.blink / 0.13;
      if (u >= 1) st.blink = 0;
      else lid = Math.sin(Math.PI * u);
    }
    const open = Math.min(1 - lid, 1 - w.sleep * 0.92, 1 - w.eat * 0.45, 1 - shakeEnv * 0.6);
    const wide = 1 + w.alert * 0.1;
    for (const e of eyes) e.scale.set(wide, wide * Math.max(0.08, open), wide);

    // ---------------- trava de chão: em pé, a cabeça não entra no chão (levanta o focinho); o resto ergue o corpo.
    // Só quando alguma parte pode chegar perto do chão (fuçando, comendo, deitando, nos gestos): andando, nada desce.
    const guard = down > 0.01 || nose > 0.01 || st.headFix > 0 || st.lift > 0 || shakeEnv > 0 || ub >= 0 || uo >= 0;
    if (!guard) {
      st.minY = 0;
      inner.position.y = 0;
    }
    object.updateMatrixWorld(true);
    const ground = object.matrixWorld.elements[13];
    let fix = 0;
    for (let it = 0; it < 2 && up > 0.5 && guard; it++) {
      const mh = lowest(true, false) - ground;
      if (mh >= 0.004) break;
      fix += (0.004 - mh) / 0.17;
      setE(B.head, headPitch - fix, headYaw, headRoll);
      B.head.updateMatrixWorld(true);
    }
    if (guard) {
      st.headFix = clamp(st.headFix + fix - st.headFix * Math.min(1, dt * (up > 0.5 ? 3 : 8)), 0, 1.2);
      if (st.headFix < 1e-4) st.headFix = 0;
      const m = lowest(false, down > 0.5) - ground;
      const was = st.lift;
      st.lift = Math.max(0, was - m);
      if (st.lift < 1e-4) st.lift = 0;
      inner.position.y = st.lift;
      st.minY = m + (st.lift - was); // depois da trava: o ponto mais baixo no chão ou acima dele
    }

    // sombra e "Zzz" subindo da cabeça de quem dorme
    shadow.position.set(B.body.position.x, 0.004, B.body.position.z - 0.02);
    shadow.scale.set(lerp(0.42, 0.56, down), 1, lerp(0.66, 0.76, down));
    st.zVis = damp(st.zVis, w.sleep > 0.75 ? 1 : 0, 2);
    if (st.zVis > 0.01) {
      B.head.getWorldPosition(_v);
      object.worldToLocal(_v);
    }
    for (const z of zzz) {
      z.visible = st.zVis > 0.01;
      if (!z.visible) continue;
      const k = fract(t * 0.32 + z.userData.phase);
      z.position.set(_v.x + 0.04 + k * 0.08, _v.y + 0.12 + k * 0.3, _v.z - 0.03);
      const s = 0.05 + k * 0.06;
      z.scale.set(s, s, s);
      z.material.opacity = Math.sin(Math.PI * k) * 0.9 * st.zVis;
    }
  }

  update(1 / 60, { action: 'idle' });
  const tris = bodyBase().tris + (earGeometry().index.count / 3) * 2 + snoutGeometry().attributes.position.count / 3
    + tailGeometry().index.count / 3 + (eyeGeometry().attributes.position.count / 3) * 2;

  return {
    object,
    radius: 0.23,
    update,
    /** "Oinc": o corpo dá dois trancos, a cabeça sobe, o focinho abre e as orelhas pulam. */
    oink() { st.oinkT = 0; },
    /** Esbarrão: abaixa a cabeça e empurra para a frente (o empurrão na dog é da mecânica). */
    bump() { st.bumpT = 0; },
    /** Sacudida de quem acordou ou se molhou: o corpo chacoalha, orelhas e rabinho voam. */
    shake() { st.shakeT = 0; },
    /** Ponto mais baixo (m acima do chão) depois da trava de chão no último update. */
    lowestY: () => st.minY,
    get lift() { return st.lift; },
    get busy() { return st.oinkT >= 0 || st.bumpT >= 0 || st.shakeT >= 0; },
    /** Marcha (testes): move 0..1 (as patas dando passos) e a fase do ciclo. */
    get gait() { return { move: st.move, phase: st.phase, trot: sstep(0.75, 1.35, st.speed) }; },
    stats: { ms: +(performance.now() - t0).toFixed(1), meshMs: bodyBase().ms, tris: Math.round(tris) },
    skeleton,
    body,
  };
}
