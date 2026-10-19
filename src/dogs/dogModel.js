// Modelo procedural das cachorrinhas: SDF (união suave de primitivas) → Surface Nets →
// SkinnedMesh com pesos automáticos (softmax das distâncias às primitivas de cada osso).
// Mesma base para as duas, variando parâmetros (tamanho, cor, corpo, juba, cachos).
import * as THREE from 'three';
import { compileSDF, groupsBounds, surfaceNets, fbm } from './sdf.js';

// ---------------------------------------------------------------------------
// Parâmetros por cachorrinha (unidades de "projeto" = metros da Radhija; s escala tudo)
// ---------------------------------------------------------------------------
export const DOG_PARAMS = {
  radhija: {
    s: 1.0,
    dz: 0.0, // alongamento extra do tronco (antes da escala)
    hs: 1.0, // escala da cabeça
    mane: 1.0, // volume do topo/nuca
    muzzle: 0.95, // comprimento do focinho
    earLen: 1.0,
    curl: { amp: 0.0062, freq: [72, 72, 72], oct: 2 }, // cabeça mais cacheada
    tailCurl: 1.0,
    colors: {
      body: '#EBCFA2',
      back: '#E2BE8A',
      belly: '#EBD3B4',
      head: '#F0D6A8',
      muzzle: '#F4E2C0',
      ear: '#E2BA80',
      earTip: '#D7A766',
      tail: '#E3BE86',
      paw: '#EEDBB9',
      tear: '#BE9470',
    },
    fur: { head: 0.022, muzzle: 0.011, ear: 0.032, tail: 0.044, boot: 0.01, mane: 0.0 },
    strandFreq: 430,
  },
  rhaenyra: {
    s: 1.133,
    dz: 0.04,
    hs: 1.05,
    mane: 1.28,
    muzzle: 1.1,
    earLen: 1.08,
    curl: { amp: 0.0075, freq: [48, 24, 48], oct: 2 }, // juba mais lisa, em mechas
    tailCurl: 1.0,
    colors: {
      body: '#F2EEE6',
      back: '#EFE9DF',
      belly: '#F0DED6',
      head: '#F5F1EA',
      muzzle: '#F7F4EE',
      ear: '#F0EAE0',
      earTip: '#E9E1D3',
      tail: '#F2ECE2',
      paw: '#F1ECE3',
      tear: '#D8BC9A',
    },
    fur: { head: 0.026, muzzle: 0.011, ear: 0.036, tail: 0.046, boot: 0.011, mane: 0.018 },
    strandFreq: 380,
  },
};

// Lista de ossos (nome, pai). Posições de repouso calculadas em buildDesign().
export const BONE_NAMES = [
  'body', 'hips', 'chest', 'neck', 'head', 'jaw',
  'earL0', 'earL1', 'earR0', 'earR1',
  'tail0', 'tail1', 'tail2', 'tail3',
  'FLu', 'FLl', 'FLp', 'FRu', 'FRl', 'FRp',
  'HLu', 'HLl', 'HLm', 'HLp', 'HRu', 'HRl', 'HRm', 'HRp',
];
const PARENT = {
  body: null, hips: 'body', chest: 'body', neck: 'chest', head: 'neck', jaw: 'head',
  earL0: 'head', earL1: 'earL0', earR0: 'head', earR1: 'earR0',
  tail0: 'hips', tail1: 'tail0', tail2: 'tail1', tail3: 'tail2',
  FLu: 'chest', FLl: 'FLu', FLp: 'FLl', FRu: 'chest', FRl: 'FRu', FRp: 'FRl',
  HLu: 'hips', HLl: 'HLu', HLm: 'HLl', HLp: 'HLm', HRu: 'hips', HRl: 'HRu', HRm: 'HRl', HRp: 'HRm',
};
export const BONE_INDEX = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i]));

// ---------------------------------------------------------------------------
// Desenho: ossos + primitivas em espaço da dog (metros), a partir dos parâmetros
// ---------------------------------------------------------------------------
export function buildDesign(P) {
  const s = P.s, dz = P.dz;
  const F = (x, y, z) => [x * s, y * s, (z + dz / 2) * s]; // parte dianteira
  const B = (x, y, z) => [x * s, y * s, (z - dz / 2) * s]; // parte traseira
  const M = (x, y, z) => [x * s, y * s, z * s];
  const hs = P.hs;
  const Hc = F(0, 0.388, 0.248); // centro da cabeça
  const H = (x, y, z) => [Hc[0] + x * hs * s, Hc[1] + y * hs * s, Hc[2] + z * hs * s];
  const ml = P.muzzle;
  const S = (v) => v * s;
  const SH = (v) => v * s * hs;

  const sph = (c, r, bone, reg, fur) => ({ t: 0, c, r, bone, reg, fur });
  const ell = (c, r, bone, reg, fur, m) => ({ t: 1, c, r, bone, reg, fur, m });
  const cone = (a, ra, b, rb, bone, reg, fur, sx) => ({ t: 2, a, b, ra, rb, bone, reg, fur, sx });
  // elipsoide alinhado a um segmento a→b (músculo): eixo local y = a→b, x ≈ lateral (mundo X),
  // z = x × y (para trás do osso, no caso da coxa). `at` = posição ao longo do segmento,
  // `shift` = deslocamento ao longo de z local (massa muscular atrás do osso).
  const ellAlong = (a, b, rAcross, rAlong, rDepth, at, shift, bone, reg, fur) => {
    let dy = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ld = Math.hypot(...dy);
    dy = dy.map((v) => v / ld);
    let ex = [1 - dy[0] * dy[0], -dy[0] * dy[1], -dy[0] * dy[2]];
    const lx = Math.hypot(...ex);
    ex = ex.map((v) => v / lx);
    const ez = [ex[1] * dy[2] - ex[2] * dy[1], ex[2] * dy[0] - ex[0] * dy[2], ex[0] * dy[1] - ex[1] * dy[0]];
    const c = [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * at + ez[k] * shift);
    return { t: 1, c, r: [rAcross, rAlong, rDepth], m: [...ex, ...dy, ...ez], bone, reg, fur };
  };

  // --- pontos-chave ---
  const pt = {
    shoulderL: F(0.042, 0.235, 0.135), elbowL: F(0.047, 0.15, 0.112), wristL: F(0.047, 0.04, 0.132), toeL: F(0.047, 0.012, 0.158),
    hipL: B(0.046, 0.245, -0.15), stifleL: B(0.053, 0.16, -0.098), hockL: B(0.05, 0.078, -0.198), pawJL: B(0.05, 0.024, -0.184), htoeL: B(0.05, 0.01, -0.152),
    T0: B(0, 0.29, -0.2), T1: B(0, 0.35, -0.226), T2: B(0.006, 0.398, -0.198), T3: B(0.014, 0.418, -0.145), T4: B(0.024, 0.405, -0.088),
  };
  const mir = (p) => [-p[0], p[1], p[2]];
  const eL = H(0.031, 0.0, 0.0615);
  const eyeR = SH(0.0148);
  const nose = H(0, -0.022, 0.07 + 0.044 * ml);
  const noseR = SH(0.0135);
  const mouth = H(0, -0.05, 0.058 + 0.038 * ml);
  const earLen = P.earLen;

  const bones = {
    body: M(0, 0.245, 0),
    hips: B(0, 0.25, -0.12),
    chest: F(0, 0.25, 0.1),
    neck: F(0, 0.285, 0.17),
    head: H(0, -0.028, -0.018),
    jaw: H(0, -0.04, 0.03),
    earL0: H(0.05, 0.04, -0.008),
    earL1: H(0.083, -0.03 * earLen, -0.008),
    tail0: pt.T0, tail1: pt.T1, tail2: pt.T2, tail3: pt.T3,
    FLu: pt.shoulderL, FLl: pt.elbowL, FLp: pt.wristL,
    HLu: pt.hipL, HLl: pt.stifleL, HLm: pt.hockL, HLp: pt.pawJL,
  };
  for (const [l, r] of [['earL0', 'earR0'], ['earL1', 'earR1'], ['FLu', 'FRu'], ['FLl', 'FRl'], ['FLp', 'FRp'], ['HLu', 'HRu'], ['HLl', 'HRl'], ['HLm', 'HRm'], ['HLp', 'HRp']]) {
    bones[r] = mir(bones[l]);
  }

  // --- grupos do corpo ---
  const torso = {
    k: S(0.06),
    prims: [
      ell(F(0, 0.226, 0.11), [S(0.063), S(0.08), S(0.088)], 'chest', 'body'),
      ell(M(0, 0.24, -0.01), [S(0.057), S(0.064), S(0.125 + dz / 2)], 'body', 'body'),
      // garupa: mais estreita e caída para a cauda (a largura vem das coxas, não de uma "bola")
      { ...ell(B(0, 0.243, -0.142), [S(0.05), S(0.06), S(0.08)], 'hips', 'body'), tw: 2.2 },
    ],
  };
  const neck = {
    k: 0, join: S(0.035),
    prims: [cone(F(0, 0.255, 0.15), S(0.049), F(0, 0.345, 0.222), S(0.037), 'neck', 'neck', P.fur.mane > 0 ? 'mane' : null)],
  };
  const mane = P.mane;
  const head = {
    k: SH(0.03), join: S(0.03),
    disp: { amp: P.curl.amp * s, freq: P.curl.freq.map((f) => f / s), oct: P.curl.oct, seed: 3, band: S(0.03) },
    prims: [
      ell(H(0, 0, 0), [SH(0.07), SH(0.066), SH(0.066)], 'head', 'head', 'head'),
      ell(H(0, 0.032, -0.012), [SH(0.058 * (0.9 + 0.1 * mane)), SH(0.042 * mane), SH(0.056 * mane)], 'head', 'head', 'head'),
      ell(H(0, -0.012, -0.04), [SH(0.064 * (0.85 + 0.15 * mane)), SH(0.064 * (0.85 + 0.15 * mane)), SH(0.058 * mane)], 'head', 'head', 'head'),
      sph(H(0.036, -0.03, 0.034), SH(0.042), 'head', 'head', 'head'),
      sph(H(-0.036, -0.03, 0.034), SH(0.042), 'head', 'head', 'head'),
      ell(H(0, -0.031, 0.03 + 0.042 * ml), [SH(0.033), SH(0.028), SH(0.042 * ml)], 'head', 'muzzle', 'muzzle'),
      ell(H(0, -0.05, 0.052), [SH(0.027), SH(0.02), SH(0.03)], 'head', 'muzzle', 'muzzle'),
    ],
    sub: [
      { c: eL, r: eyeR * 1.12, k: SH(0.008) },
      { c: mir(eL), r: eyeR * 1.12, k: SH(0.008) },
    ],
  };
  const legF = (side) => {
    const m = side > 0 ? (p) => p : mir;
    const n = side > 0 ? 'L' : 'R';
    return {
      k: S(0.012), join: S(0.028),
      prims: [
        cone(m(pt.shoulderL), S(0.03), m(pt.elbowL), S(0.0185), `F${n}u`, 'body'),
        cone(m(pt.elbowL), S(0.0168), m(pt.wristL), S(0.0133), `F${n}l`, 'leg'),
        ell(m(F(0.047, 0.014, 0.146)), [S(0.0165), S(0.0135), S(0.024)], `F${n}p`, 'paw', 'boot'),
        ell(m(F(0.047, 0.03, 0.138)), [S(0.0165), S(0.02), S(0.019)], `F${n}p`, 'paw', 'boot'),
      ],
    };
  };
  const legH = (side) => {
    const m = side > 0 ? (p) => p : mir;
    const n = side > 0 ? 'L' : 'R';
    // coxa musculosa achatada lateralmente (funda de frente para trás) que afina até a soldra;
    // "segunda coxa" (gastrocnêmio) atrás da tíbia que afina até o jarrete.
    const hipIn = B(0.041, 0.25, -0.152);
    return {
      k: S(0.016), join: S(0.046),
      prims: [
        { ...ellAlong(m(hipIn), m(pt.stifleL), S(0.03), S(0.072), S(0.046), 0.42, S(0.01), `H${n}u`, 'body'), tw: 2.4 },
        { ...cone(m(hipIn), S(0.03), m(pt.stifleL), S(0.021), `H${n}u`, 'body'), tw: 1.6 },
        cone(m(pt.stifleL), S(0.02), m(pt.hockL), S(0.0135), `H${n}l`, 'leg'),
        ellAlong(m(pt.stifleL), m(pt.hockL), S(0.0175), S(0.042), S(0.022), 0.36, S(0.008), `H${n}l`, 'leg'),
        cone(m(pt.hockL), S(0.014), m(pt.pawJL), S(0.0135), `H${n}m`, 'leg'),
        ell(m(B(0.05, 0.014, -0.169)), [S(0.0165), S(0.0135), S(0.024)], `H${n}p`, 'paw', 'boot'),
        ell(m(B(0.05, 0.03, -0.177)), [S(0.0165), S(0.02), S(0.019)], `H${n}p`, 'paw', 'boot'),
      ],
    };
  };
  const tail = {
    k: S(0.014), join: S(0.014),
    disp: { amp: S(0.006), freq: [70 / s, 70 / s, 70 / s], oct: 2, seed: 11, band: S(0.02) },
    prims: [
      cone(pt.T0, S(0.013), pt.T1, S(0.017), 'tail0', 'tail', 'tail'),
      cone(pt.T1, S(0.018), pt.T2, S(0.024), 'tail1', 'tail', 'tail'),
      cone(pt.T2, S(0.024), pt.T3, S(0.024), 'tail2', 'tail', 'tail'),
      cone(pt.T3, S(0.023), pt.T4, S(0.014), 'tail3', 'tail', 'tail'),
    ],
  };
  const bodyGroups = [torso, neck, head, legF(1), legF(-1), legH(1), legH(-1), tail];

  // --- orelhas (malha separada, presa aos ossos das orelhas) ---
  const earGroup = (side) => {
    const m = side > 0 ? (p) => p : mir;
    const n = side > 0 ? 'L' : 'R';
    return {
      k: SH(0.02), join: 0,
      disp: { amp: SH(0.0055), freq: [95 / s, 26 / s, 95 / s], oct: 2, seed: 5 + side, band: S(0.02) },
      prims: [
        cone(m(H(0.05, 0.04, -0.008)), SH(0.019), m(H(0.083, -0.03 * earLen, -0.008)), SH(0.03), `ear${n}0`, 'ear', 'ear', 2.4),
        cone(m(H(0.083, -0.03 * earLen, -0.008)), SH(0.03), m(H(0.088, -0.098 * earLen, -0.014)), SH(0.026), `ear${n}1`, 'ear', 'ear', 2.4),
      ],
    };
  };
  const earGroups = [earGroup(1), earGroup(-1)];

  return {
    bones, bodyGroups, earGroups,
    face: { eyeL: eL, eyeR, nose, noseR, mouth, Hc },
    pt,
  };
}

// ---------------------------------------------------------------------------
// Construção das malhas
// ---------------------------------------------------------------------------
const tmpC = new THREE.Color();
function lin(hex) {
  tmpC.set(hex);
  return [tmpC.r, tmpC.g, tmpC.b];
}
function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function sstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// atributos por vértice: skin (4 ossos), cor, comprimento do pelo. boneIndex: nome do osso → índice (o modelo novo,
// src/dogs/v2/, passa o próprio esqueleto).
function vertexAttributes(mesh, groups, design, P, sdfFn, boneIndex = BONE_INDEX) {
  const prims = groups.flatMap((g) => g.prims);
  const nv = mesh.positions.length / 3;
  const skinIndex = new Uint16Array(nv * 4);
  const skinWeight = new Float32Array(nv * 4);
  const colors = new Float32Array(nv * 3);
  const furLen = new Float32Array(nv);
  const grav = new Float32Array(nv);
  const gravOf = { head: 0.3, muzzle: 0.15, ear: 0.75, tail: 0.85, boot: 0.1, mane: 0.6 };
  const s = P.s;
  const tau = 0.009 * s;
  const tauC = 0.007 * s;
  const C = Object.fromEntries(Object.entries(P.colors).map(([k, v]) => [k, lin(v)]));
  const regColor = { body: C.body, neck: C.body, head: C.head, muzzle: C.muzzle, ear: C.ear, tail: C.tail, paw: C.paw, leg: C.body };
  const furOf = { head: P.fur.head, muzzle: P.fur.muzzle, ear: P.fur.ear, tail: P.fur.tail, boot: P.fur.boot, mane: P.fur.mane };
  const { eyeL, eyeR, nose, noseR, mouth } = design.face;
  const eyeRgt = [-eyeL[0], eyeL[1], eyeL[2]];
  const boneW = new Float32Array(Object.keys(boneIndex).length);
  const d = new Float32Array(prims.length);

  for (let v = 0; v < nv; v++) {
    const x = mesh.positions[v * 3], y = mesh.positions[v * 3 + 1], z = mesh.positions[v * 3 + 2];
    let dmin = 1e9;
    sdfFn.primDistances(x, y, z, d);
    for (let i = 0; i < prims.length; i++) if (d[i] < dmin) dmin = d[i];
    boneW.fill(0);
    let col = [0, 0, 0], cw = 0, fur = 0, gr = 0;
    for (let i = 0; i < prims.length; i++) {
      const p = prims[i];
      // tw: transição mais macia (garupa ↔ coxa) — evita o vinco quando a perna dobra
      const w = Math.exp(-(d[i] - dmin) / (tau * (p.tw || 1)));
      boneW[boneIndex[p.bone]] += w;
      const wc = Math.exp(-(d[i] - dmin) / tauC);
      const rc = regColor[p.reg] || C.body;
      col[0] += rc[0] * wc; col[1] += rc[1] * wc; col[2] += rc[2] * wc;
      fur += (p.fur ? furOf[p.fur] || 0 : 0) * wc;
      gr += (p.fur ? gravOf[p.fur] || 0 : 0) * wc;
      cw += wc;
    }
    col = [col[0] / cw, col[1] / cw, col[2] / cw];
    fur /= cw;
    grav[v] = gr / cw;

    // top-4 ossos
    const order = [];
    for (let b = 0; b < boneW.length; b++) if (boneW[b] > 1e-4) order.push(b);
    order.sort((a, b) => boneW[b] - boneW[a]);
    let sum = 0;
    for (let k = 0; k < 4 && k < order.length; k++) sum += boneW[order[k]];
    for (let k = 0; k < 4; k++) {
      if (k < order.length) {
        skinIndex[v * 4 + k] = order[k];
        skinWeight[v * 4 + k] = boneW[order[k]] / sum;
      }
    }

    // ajustes de cor
    const ys = y / s;
    // dorso um pouco mais quente/escuro, barriga mais clara/rosada
    const ny = mesh.normals[v * 3 + 1];
    const reg = regionAt(d, prims);
    if (reg === 'body' || reg === 'neck' || reg === 'leg') {
      col = mix3(col, C.back, sstep(0.3, 0.9, ny) * 0.6);
      col = mix3(col, C.belly, sstep(-0.2, -0.8, ny) * 0.8);
    }
    if (reg === 'ear') {
      const t = sstep(0.2, -0.6, (y - (design.earMidY ?? design.bones.earL1[1])) / (0.06 * s));
      col = mix3(col, C.earTip, t * 0.8);
    }
    // manchinha de lágrima sob os olhos
    for (const e of [eyeL, eyeRgt]) {
      const sx = e[0] * 0.9, sy = e[1] - eyeR * 1.15, sz = e[2] + eyeR * 0.2;
      const dd = ((x - sx) ** 2 + ((y - sy) * 0.8) ** 2 + (z - sz) ** 2) / (eyeR * eyeR * 1.4);
      col = mix3(col, C.tear, Math.exp(-dd) * 0.75);
    }
    // variação suave de cor
    const n = fbm(x * 30 / s, y * 30 / s, z * 30 / s, 2, 21) * 0.05;
    col = [col[0] * (1 + n), col[1] * (1 + n), col[2] * (1 + n * 0.8)];
    colors[v * 3] = col[0]; colors[v * 3 + 1] = col[1]; colors[v * 3 + 2] = col[2];

    // máscara do pelo em volta de olhos, nariz e boca
    const dist = (a) => Math.sqrt((x - a[0]) ** 2 + (y - a[1]) ** 2 + (z - a[2]) ** 2);
    fur *= sstep(eyeR * 1.0, eyeR * 1.75, Math.min(dist(eyeL), dist(eyeRgt)));
    fur *= sstep(noseR * 1.0, noseR * 2.4, dist(nose));
    fur *= 0.35 + 0.65 * sstep(noseR * 0.6, noseR * 2.2, dist(mouth));
    furLen[v] = fur;
    void ys;
  }
  return { skinIndex, skinWeight, colors, furLen, grav };
}

function regionAt(d, prims) {
  let best = 0;
  for (let i = 1; i < d.length; i++) if (d[i] < d[best]) best = i;
  return prims[best].reg;
}

function toGeometry(mesh, attr) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(attr.colors, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(attr.skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(attr.skinWeight, 4));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  return g;
}

// Cascas de pelo: replica os triângulos peludos N vezes (de dentro para fora) num só draw.
function shellGeometry(parts, shells) {
  // parts: [{mesh, attr}]
  let nvTot = 0, ntTot = 0;
  const kept = parts.map(({ mesh, attr }) => {
    const I = mesh.indices;
    const tris = [];
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      if (Math.max(attr.furLen[a], attr.furLen[b], attr.furLen[c]) > 0.0025) tris.push(a, b, c);
    }
    // remapeia vértices usados
    const map = new Map();
    const verts = [];
    for (const v of tris) if (!map.has(v)) { map.set(v, verts.length); verts.push(v); }
    nvTot += verts.length;
    ntTot += tris.length;
    return { mesh, attr, tris: tris.map((v) => map.get(v)), verts };
  });
  const nv = nvTot * shells, ni = ntTot * shells;
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), fur = new Float32Array(nv), sh = new Float32Array(nv), gv = new Float32Array(nv);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (let k = 0; k < shells; k++) {
    const h = (k + 1) / shells;
    for (const part of kept) {
      const { mesh, attr, tris, verts } = part;
      const base = vo;
      for (let i = 0; i < verts.length; i++, vo++) {
        const v = verts[i];
        pos.set(mesh.positions.subarray(v * 3, v * 3 + 3), vo * 3);
        nrm.set(mesh.normals.subarray(v * 3, v * 3 + 3), vo * 3);
        col.set(attr.colors.subarray(v * 3, v * 3 + 3), vo * 3);
        si.set(attr.skinIndex.subarray(v * 4, v * 4 + 4), vo * 4);
        sw.set(attr.skinWeight.subarray(v * 4, v * 4 + 4), vo * 4);
        fur[vo] = attr.furLen[v];
        gv[vo] = attr.grav[v];
        sh[vo] = h;
      }
      for (let t = 0; t < tris.length; t++) idx[io++] = base + tris[t];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('aFur', new THREE.BufferAttribute(fur, 1));
  g.setAttribute('aShell', new THREE.BufferAttribute(sh, 1));
  g.setAttribute('aGrav', new THREE.BufferAttribute(gv, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const cache = new Map();

export function buildDogGeometry(kind, { shells = 10 } = {}) {
  if (cache.has(kind)) return cache.get(kind);
  const P = DOG_PARAMS[kind];
  const result = buildGeometryFromDesign(buildDesign(P), P, { shells });
  cache.set(kind, result);
  return result;
}

/**
 * Malhas de um desenho (corpo, orelhas e cascas de pelo) com os pesos do esqueleto `boneIndex` (nome → índice).
 * Usado pelo modelo atual (buildDogGeometry) e pelo modelo novo (src/dogs/v2/).
 */
export function buildGeometryFromDesign(design, P, { shells = 10, boneIndex = BONE_INDEX, exactBounds = false } = {}) {
  const t0 = performance.now();
  const s = P.s;

  const bodySDF = compileSDF(design.bodyGroups);
  const earSDF = compileSDF(design.earGroups);
  // exactBounds (modelo novo): a grade cobre a orelha achatada inteira (sdf.js, groupsBounds)
  const bb = groupsBounds(design.bodyGroups, 0.03 * s, { exact: exactBounds });
  const eb = groupsBounds(design.earGroups, 0.02 * s, { exact: exactBounds });

  const cell = 0.0098 * s;
  const body = surfaceNets(bodySDF, bb, cell, { smoothIters: 2, project: 1 });
  const ears = surfaceNets(earSDF, eb, cell * 0.85, { smoothIters: 2, project: 1 });
  const bodyA = vertexAttributes(body, design.bodyGroups, design, P, bodySDF, boneIndex);
  const earA = vertexAttributes(ears, design.earGroups, design, P, earSDF, boneIndex);

  // malha grossa para as cascas de pelo
  const cCell = cell * 1.9;
  const bodyC = surfaceNets(bodySDF, bb, cCell, { smoothIters: 1, project: 1 });
  const earC = surfaceNets(earSDF, eb, cell * 1.35, { smoothIters: 1, project: 1 });
  const bodyCA = vertexAttributes(bodyC, design.bodyGroups, design, P, bodySDF, boneIndex);
  const earCA = vertexAttributes(earC, design.earGroups, design, P, earSDF, boneIndex);

  const result = {
    P,
    design,
    bodyGeo: toGeometry(body, bodyA),
    earGeo: toGeometry(ears, earA),
    furGeo: shellGeometry([{ mesh: bodyC, attr: bodyCA }, { mesh: earC, attr: earCA }], shells),
    sdf: bodySDF,
    stats: {},
  };
  result.stats.ms = performance.now() - t0;
  result.stats.tris = {
    body: body.indices.length / 3,
    ears: ears.indices.length / 3,
    fur: result.furGeo.index.count / 3,
  };
  return result;
}

export function boneParent(name) {
  return PARENT[name];
}
