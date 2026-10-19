// Desenho do modelo novo das cachorrinhas (src/dogs/v2/): os ossos do esqueleto novo (skeleton.js) e as primitivas
// SDF presas a eles, na mesma base procedural do modelo atual (dogModel.js → buildDesign). As juntas que já existiam
// ficam no mesmo lugar (o esqueleto atual guia o novo, retarget.js); muda o que as fotos pediram:
//   · focinho um pouco mais comprido e afinando (no atual ele quase some no pelo da cabeça);
//   · orelhas da Rhaenyra mais compridas e largas, com franja (descem até a linha do queixo), e mais grossas nas duas;
//   · cabeça da Rhaenyra quase do tamanho da da Radhija (ela é maior, a cabeça não), com o cabelo menos volumoso;
//   · pescoço um pouco mais grosso e a barriga mais recolhida perto da garupa (corpo tosado, peito fundo);
//   · gomos novos: coluna e pescoço em dois, escápula, pulso separado da pata, orelha em três e rabo em cinco.
import * as THREE from 'three';
import { DOG_PARAMS } from '../dogModel.js';

/**
 * Ajustes do modelo novo sobre os parâmetros do atual (DOG_PARAMS). hs = escala da cabeça: a Rhaenyra é maior, mas a
 * cabeça dela (com o cabelo) é quase do tamanho da da Radhija (retorno do usuário, 2026-10-19). earSx = quanto a
 * orelha é achatada (menos = mais grossa: a malha não fura nem deixa ver o outro lado).
 */
export const V2_TWEAKS = Object.freeze({
  radhija: Object.freeze({ hs: 1.0, muzzle: 1.15, muzzleW: 0.94, earLen: 1.06, earW: 1.0, earSx: 1.9, mane: 1.0, headFur: 0.022, neck: 1.06, tuck: 1, earFur: 0.034 }),
  rhaenyra: Object.freeze({ hs: 0.9, muzzle: 1.3, muzzleW: 0.94, earLen: 1.3, earW: 1.1, earSx: 1.9, mane: 1.0, headFur: 0.023, neck: 1.06, tuck: 1, earFur: 0.042 }),
});

/** Parâmetros do modelo novo: os do atual com os ajustes de V2_TWEAKS (em `v2`); hsBone = escala da cabeça do atual. */
export function paramsV2(kind) {
  const base = DOG_PARAMS[kind];
  const t = V2_TWEAKS[kind];
  return {
    ...base, hs: t.hs, hsBone: base.hs, muzzle: t.muzzle, earLen: t.earLen, mane: t.mane,
    fur: { ...base.fur, head: t.headFur, ear: t.earFur }, v2: t,
  };
}

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const mir = (p) => [-p[0], p[1], p[2]];

/**
 * Pontos ao longo de uma curva suave (Catmull-Rom) pelos nós `knots`, igualmente espaçados no comprimento, e o
 * raio em cada um (interpolado de `radii`, um por nó, pela fração do comprimento do polígono).
 */
function resample(knots, radii, n) {
  const curve = new THREE.CatmullRomCurve3(knots.map((k) => new THREE.Vector3(...k)), false, 'centripetal');
  const L = [0];
  for (let i = 1; i < knots.length; i++) {
    L.push(L[i - 1] + Math.hypot(knots[i][0] - knots[i - 1][0], knots[i][1] - knots[i - 1][1], knots[i][2] - knots[i - 1][2]));
  }
  const total = L[L.length - 1];
  const radiusAt = (u) => {
    const t = u * total;
    let i = 1;
    while (i < L.length - 1 && L[i] < t) i++;
    const f = Math.min(1, Math.max(0, (t - L[i - 1]) / (L[i] - L[i - 1] || 1)));
    return radii[i - 1] + (radii[i] - radii[i - 1]) * f;
  };
  const pts = [];
  const rs = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    pts.push(curve.getPointAt(u).toArray());
    rs.push(radiusAt(u));
  }
  return { pts, rs };
}

/**
 * Ossos + primitivas do modelo novo, a partir de paramsV2(kind). Mesmo formato de buildDesign (dogModel.js), mais
 * `earMidY` (altura do meio da orelha, para a cor da ponta) e `chains` (juntas do rabo e das orelhas, com a ponta).
 */
export function buildDesignV2(P) {
  const T = P.v2;
  const s = P.s, dz = P.dz;
  const F = (x, y, z) => [x * s, y * s, (z + dz / 2) * s];
  const B = (x, y, z) => [x * s, y * s, (z - dz / 2) * s];
  const M = (x, y, z) => [x * s, y * s, z * s];
  const hs = P.hs;
  const Hc = F(0, 0.388, 0.248);
  const H = (x, y, z) => [Hc[0] + x * hs * s, Hc[1] + y * hs * s, Hc[2] + z * hs * s];
  // as juntas da cabeça e da mandíbula ficam onde estão no modelo atual (o esqueleto atual guia o novo)
  const hsB = P.hsBone ?? hs;
  const HB = (x, y, z) => [Hc[0] + x * hsB * s, Hc[1] + y * hsB * s, Hc[2] + z * hsB * s];
  const ml = P.muzzle;
  const S = (v) => v * s;
  const SH = (v) => v * s * hs;

  const sph = (c, r, bone, reg, fur) => ({ t: 0, c, r, bone, reg, fur });
  const ell = (c, r, bone, reg, fur, m) => ({ t: 1, c, r, bone, reg, fur, m });
  const cone = (a, ra, b, rb, bone, reg, fur, sx) => ({ t: 2, a, b, ra, rb, bone, reg, fur, sx });
  // elipsoide alinhado a um segmento a→b (músculo), como em dogModel.js
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

  // --- pontos-chave (os do modelo atual, mais o alto da escápula e a pata da frente) ---
  const pt = {
    shoulderL: F(0.042, 0.235, 0.135), elbowL: F(0.047, 0.15, 0.112), wristL: F(0.047, 0.04, 0.132), toeL: F(0.047, 0.012, 0.158),
    pawFL: F(0.047, 0.02, 0.142), scapTopL: F(0.034, 0.302, 0.104),
    hipL: B(0.046, 0.245, -0.15), stifleL: B(0.053, 0.16, -0.098), hockL: B(0.05, 0.078, -0.198), pawJL: B(0.05, 0.024, -0.184), htoeL: B(0.05, 0.01, -0.152),
    T0: B(0, 0.29, -0.2), T1: B(0, 0.35, -0.226), T2: B(0.006, 0.398, -0.198), T3: B(0.014, 0.418, -0.145), T4: B(0.024, 0.405, -0.088),
  };
  const eL = H(0.031, 0.0, 0.0615);
  const eyeR = SH(0.0148);
  const nose = H(0, -0.022, 0.07 + 0.044 * ml);
  const noseR = SH(0.0135);
  const mouth = H(0, -0.05, 0.058 + 0.038 * ml);
  const earLen = P.earLen;

  // rabo em cinco gomos ao longo de uma curva suave pelos pontos do atual
  const tail = resample([pt.T0, pt.T1, pt.T2, pt.T3, pt.T4], [0.013, 0.0175, 0.024, 0.0235, 0.014].map(S), 5);
  // orelha em três gomos (a esquerda; a direita é espelhada)
  const earKnots = [H(0.05, 0.04, -0.008), H(0.083, -0.03 * earLen, -0.008), H(0.088 + 0.004 * (T.earW - 1), -0.098 * earLen, -0.014)];
  const ear = resample(earKnots, [0.019, 0.03 * T.earW, 0.026 * T.earW].map(SH), 3);

  const bones = {
    body: M(0, 0.245, 0),
    hips: B(0, 0.25, -0.12),
    chest: F(0, 0.25, 0.1),
    neck: F(0, 0.285, 0.17),
    head: HB(0, -0.028, -0.018),
    jaw: HB(0, -0.04, 0.03),
    scapL: pt.scapTopL, FLu: pt.shoulderL, FLl: pt.elbowL, FLc: pt.wristL, FLp: pt.pawFL,
    HLu: pt.hipL, HLl: pt.stifleL, HLm: pt.hockL, HLp: pt.pawJL,
  };
  bones.spineB = mid(bones.body, bones.hips);
  bones.spineF = mid(bones.body, bones.chest);
  bones.neck1 = mid(bones.neck, bones.head);
  for (let k = 0; k < 5; k++) bones[`tail${k}`] = tail.pts[k];
  for (let k = 0; k < 3; k++) bones[`earL${k}`] = ear.pts[k];
  for (const l of ['earL0', 'earL1', 'earL2', 'scapL', 'FLu', 'FLl', 'FLc', 'FLp', 'HLu', 'HLl', 'HLm', 'HLp']) {
    bones[l.replace('L', 'R')] = mir(bones[l]);
  }

  // --- grupos do corpo ---
  // Tronco: o meio vira dois cones arredondados (um por gomo da coluna) no lugar do elipsoide único do atual; a
  // ponta de trás sobe um pouco (barriga recolhida perto da garupa).
  const sxMid = 0.064 / 0.057;
  const torso = {
    k: S(0.06),
    prims: [
      ell(F(0, 0.226, 0.11), [S(0.063), S(0.08), S(0.088)], 'chest', 'body'),
      cone(M(0, 0.246 + 0.002 * T.tuck, -0.105 - dz / 2), S(0.048), M(0, 0.241, -0.002), S(0.0625), 'spineB', 'body', null, sxMid),
      cone(M(0, 0.241, -0.002), S(0.0625), M(0, 0.24, 0.098 + dz / 2), S(0.05), 'spineF', 'body', null, sxMid),
      { ...ell(B(0, 0.243, -0.142), [S(0.05), S(0.06), S(0.08)], 'hips', 'body'), tw: 2.2 },
    ],
  };
  const nk = T.neck;
  const nA = F(0, 0.255, 0.15), nB = F(0, 0.345, 0.222);
  const nM = mid(nA, nB);
  const maneFur = P.fur.mane > 0 ? 'mane' : null;
  const neck = {
    k: S(0.01), join: S(0.035),
    prims: [
      cone(nA, S(0.049 * nk), nM, S(0.043 * nk), 'neck', 'neck', maneFur),
      cone(nM, S(0.043 * nk), nB, S(0.037 * nk), 'neck1', 'neck', maneFur),
    ],
  };
  const mane = P.mane;
  const mw = T.muzzleW;
  const head = {
    k: SH(0.03), join: S(0.03),
    disp: { amp: P.curl.amp * s, freq: P.curl.freq.map((f) => f / s), oct: P.curl.oct, seed: 3, band: S(0.03) },
    prims: [
      ell(H(0, 0, 0), [SH(0.07), SH(0.066), SH(0.066)], 'head', 'head', 'head'),
      ell(H(0, 0.032, -0.012), [SH(0.058 * (0.9 + 0.1 * mane)), SH(0.042 * mane), SH(0.056 * mane)], 'head', 'head', 'head'),
      ell(H(0, -0.012, -0.04), [SH(0.064 * (0.85 + 0.15 * mane)), SH(0.064 * (0.85 + 0.15 * mane)), SH(0.058 * mane)], 'head', 'head', 'head'),
      sph(H(0.036, -0.03, 0.034), SH(0.042), 'head', 'head', 'head'),
      sph(H(-0.036, -0.03, 0.034), SH(0.042), 'head', 'head', 'head'),
      // focinho: mais comprido e afinando para a ponta (o nariz vai junto, design.face)
      ell(H(0, -0.031, 0.03 + 0.042 * ml), [SH(0.033 * mw), SH(0.028), SH(0.042 * ml)], 'head', 'muzzle', 'muzzle'),
      // queixo na mandíbula (gomo novo, pronto para a boca abrir de verdade nas próximas etapas)
      ell(H(0, -0.05, 0.052 * (ml / 0.95)), [SH(0.026 * mw), SH(0.02), SH(0.03 * (ml / 0.95))], 'jaw', 'muzzle', 'muzzle'),
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
        // escápula: lâmina fina por dentro do peito, só para os pesos (a pele do ombro desliza com ela)
        { ...ellAlong(m(pt.scapTopL), m(pt.shoulderL), S(0.012), S(0.042), S(0.026), 0.5, 0, `scap${n}`, 'body'), tw: 1.6 },
        cone(m(pt.shoulderL), S(0.03), m(pt.elbowL), S(0.0185), `F${n}u`, 'body'),
        cone(m(pt.elbowL), S(0.0168), m(pt.wristL), S(0.0133), `F${n}l`, 'leg'),
        ell(m(F(0.047, 0.014, 0.146)), [S(0.0165), S(0.0135), S(0.024)], `F${n}p`, 'paw', 'boot'),
        ell(m(F(0.047, 0.03, 0.138)), [S(0.0165), S(0.02), S(0.019)], `F${n}c`, 'paw', 'boot'),
      ],
    };
  };
  const legH = (side) => {
    const m = side > 0 ? (p) => p : mir;
    const n = side > 0 ? 'L' : 'R';
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
  const tailGroup = {
    k: S(0.014), join: S(0.014),
    disp: { amp: S(0.006), freq: [70 / s, 70 / s, 70 / s], oct: 2, seed: 11, band: S(0.02) },
    prims: tail.pts.slice(0, 5).map((a, k) => cone(a, tail.rs[k], tail.pts[k + 1], tail.rs[k + 1], `tail${k}`, 'tail', 'tail')),
  };
  const bodyGroups = [torso, neck, head, legF(1), legF(-1), legH(1), legH(-1), tailGroup];

  // --- orelhas (malha separada, presa aos ossos das orelhas) ---
  const earGroup = (side) => {
    const m = side > 0 ? (p) => p : mir;
    const n = side > 0 ? 'L' : 'R';
    return {
      k: SH(0.02), join: 0,
      disp: { amp: SH(0.0055), freq: [95 / s, 26 / s, 95 / s], oct: 2, seed: 5 + side, band: S(0.02) },
      prims: [0, 1, 2].map((k) => cone(m(ear.pts[k]), ear.rs[k], m(ear.pts[k + 1]), ear.rs[k + 1], `ear${n}${k}`, 'ear', 'ear', T.earSx)),
    };
  };
  const earGroups = [earGroup(1), earGroup(-1)];

  return {
    bones, bodyGroups, earGroups,
    face: { eyeL: eL, eyeR, nose, noseR, mouth, Hc },
    pt,
    // a cor da ponta da orelha começa no mesmo lugar do modelo atual (o nó do meio)
    earMidY: earKnots[1][1],
    chains: {
      tail: [...tail.pts],
      earL: [...ear.pts],
      earR: ear.pts.map(mir),
    },
  };
}
