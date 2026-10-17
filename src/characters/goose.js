// Dona Gansa — gansa doméstica branca, cômica e mandona. Mesmo pipeline orgânico das dogs:
// SDF (união suave de primitivas) → Surface Nets → SkinnedMesh com pesos automáticos (corpo,
// pescoço em 3 ossos, cabeça, cauda). Asas: malhas SDF próprias presas ao ombro (abrem para bater).
// Penas sugeridas no shader (relevo de escamas de pena + penugem), bico/patas laranja.
// API (docs/ARQUITETURA.md §7, tipo GooseModel em src/types.d.ts): createGoose() → { object, radius, update(dt, {speed, turn, action, lookAt}), triggerHonk() }
import * as THREE from 'three';
import { compileSDF, groupsBounds, surfaceNets, fbm } from '../dogs/sdf.js';
import { shareResource } from '../core/resources.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);

// ---------------------------------------------------------------------------- desenho (metros)
const sph = (c, r, bone) => ({ t: 0, c, r, bone });
const ell = (c, r, bone) => ({ t: 1, c, r, bone });
const cone = (a, ra, b, rb, bone, sx) => ({ t: 2, a, b, ra, rb, bone, sx });
function ellAlong(a, b, rAcross, rAlong, rDepth, at, shift, bone) {
  let dy = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ld = Math.hypot(...dy);
  dy = dy.map((v) => v / ld);
  let ex = [1 - dy[0] * dy[0], -dy[0] * dy[1], -dy[0] * dy[2]];
  const lx = Math.hypot(...ex);
  ex = ex.map((v) => v / lx);
  const ez = [ex[1] * dy[2] - ex[2] * dy[1], ex[2] * dy[0] - ex[0] * dy[2], ex[0] * dy[1] - ex[1] * dy[0]];
  const c = [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * at + ez[k] * shift);
  return { t: 1, c, r: [rAcross, rAlong, rDepth], m: [...ex, ...dy, ...ez], bone };
}

const BONES = ['body', 'tail', 'neck0', 'neck1', 'neck2', 'head'];
const PARENT = { body: -1, tail: 0, neck0: 0, neck1: 2, neck2: 3, head: 4 };
const BONE_POS = {
  body: [0, 0.245, 0.0],
  tail: [0, 0.285, -0.2],
  neck0: [0, 0.305, 0.125],
  neck1: [0, 0.392, 0.17],
  neck2: [0, 0.468, 0.158],
  head: [0, 0.512, 0.168],
};
const SHOULDER = [0.098, 0.318, 0.05];
const CELL_BODY = 0.0122;
const CELL_WING = 0.0105;
const GEO = {}; // geometrias compartilhadas entre instâncias
const HIP = [0.052, 0.17, 0.0];

function design() {
  const torso = {
    k: 0.05,
    prims: [
      ell([0, 0.245, -0.025], [0.118, 0.104, 0.2], 'body'),
      ell([0, 0.256, 0.096], [0.098, 0.104, 0.092], 'body'), // peito
      ell([0, 0.18, -0.035], [0.096, 0.068, 0.14], 'body'), // barriguinha caída (gansa doméstica)
      ell([0, 0.277, -0.17], [0.08, 0.072, 0.1], 'body'), // traseiro subindo para a cauda
      ellAlong([0, 0.282, -0.205], [0, 0.335, -0.305], 0.05, 0.062, 0.02, 0.55, 0, 'tail'), // leque da cauda
    ],
  };
  const neck = {
    k: 0.03, join: 0.045,
    prims: [
      cone([0, 0.29, 0.118], 0.056, BONE_POS.neck1, 0.035, 'neck0'),
      cone(BONE_POS.neck1, 0.035, BONE_POS.neck2, 0.03, 'neck1'),
      cone(BONE_POS.neck2, 0.03, [0, 0.514, 0.172], 0.034, 'neck2'),
    ],
  };
  const head = {
    k: 0.02, join: 0.026,
    prims: [
      ell([0, 0.522, 0.18], [0.039, 0.041, 0.058], 'head'),
      ellAlong([0, 0.548, 0.17], [0, 0.522, 0.232], 0.026, 0.04, 0.02, 0.55, 0, 'head'), // testa inclinada até o bico
      sph([0.017, 0.51, 0.2], 0.026, 'head'),
      sph([-0.017, 0.51, 0.2], 0.026, 'head'),
    ],
  };
  return [torso, neck, head];
}

// asa esquerda dobrada junto ao corpo, em coordenadas do corpo (depois vira local do ombro)
function wingDesign(side) {
  const m = (p) => [p[0] * side, p[1], p[2]];
  return [{
    k: 0.03,
    prims: [
      ellAlong(m([0.108, 0.318, 0.06]), m([0.1, 0.3, -0.16]), 0.024, 0.115, 0.066, 0.42, 0.0, 'w'),
      cone(m([0.1, 0.302, -0.07]), 0.042, m([0.066, 0.336, -0.272]), 0.01, 'w', 2.3), // primárias
      ellAlong(m([0.104, 0.33, 0.04]), m([0.104, 0.31, -0.05]), 0.022, 0.06, 0.04, 0.5, 0.012, 'w'), // ombro
    ],
  }];
}

// ---------------------------------------------------------------------------- materiais
function featherMaterial({ scallop = 0.0, scale = 1 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0,
    sheen: 0.8,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#dfe6f0'),
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRestP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRestP;
        float gh(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float gn(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(gh(i), gh(i + vec3(1,0,0)), f.x), mix(gh(i + vec3(0,1,0)), gh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(gh(i + vec3(0,0,1)), gh(i + vec3(1,0,1)), f.x), mix(gh(i + vec3(0,1,1)), gh(i + vec3(1,1,1)), f.x), f.y), f.z); }
        // escamas de pena: fileiras deslocadas, borda de cada pena apontando para trás (-Z)
        float featherH(vec3 p) {
          vec2 q = vec2(p.y * 34.0 * ${scale.toFixed(3)} + p.x * 20.0, p.z * 30.0 * ${scale.toFixed(3)});
          float row = floor(q.y);
          q.x += mod(row, 2.0) * 0.5;
          vec2 c = fract(q) - vec2(0.5, 0.0);
          float d = length(c * vec2(1.0, 0.8));
          float fy = fract(q.y);
          float sc = smoothstep(0.25, 0.75, d) * smoothstep(0.0, 0.18, fy) * smoothstep(1.0, 0.82, fy) * ${scallop.toFixed(3)};
          float fluff = gn(p * 160.0) * 0.5 + gn(p * 420.0) * 0.5;
          return sc * 0.8 + fluff * 0.35;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float h = featherH(vRestP);
          vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
          float hx = dFdx(h), hy = dFdy(h);
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2);
          normal = normalize(abs(det) * normal - grad * 0.0016);
          diffuseColor.rgb *= 0.93 + 0.07 * (1.0 - h * 0.8);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        // branco legível à noite: um pouco da cor base volta como emissão neutra-fria
        '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.05, 0.055, 0.065);',
      );
  };
  mat.customProgramCacheKey = () => `gooseFeather_${scallop}_${scale}`;
  return mat;
}

let shadowTex = null;
function contactShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.35, 'rgba(0,0,0,0.75)');
  grd.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shareResource(shadowTex);
}

// ---------------------------------------------------------------------------- malhas
const tmpC = new THREE.Color();
const lin = (hex) => { tmpC.set(hex); return [tmpC.r, tmpC.g, tmpC.b]; };

export const GOOSE_TIMING = {};
function meshFromSDF(groups, cell, boneIndexOf, colorFn, tag = 'm') {
  const ta = performance.now();
  const sdf = compileSDF(groups);
  const bb = groupsBounds(groups, 0.02);
  const mesh = surfaceNets(sdf, bb, cell, { smoothIters: 2, project: 1 });
  const tb = performance.now();
  const prims = groups.flatMap((g) => g.prims);
  const nv = mesh.positions.length / 3;
  const col = new Float32Array(nv * 3);
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const d = new Float32Array(prims.length);
  const nb = 8;
  const bw = new Float32Array(nb);
  const tau = 0.016;
  for (let v = 0; v < nv; v++) {
    const x = mesh.positions[v * 3], y = mesh.positions[v * 3 + 1], z = mesh.positions[v * 3 + 2];
    sdf.primDistances(x, y, z, d);
    let dmin = 1e9;
    for (let i = 0; i < d.length; i++) dmin = Math.min(dmin, d[i]);
    bw.fill(0);
    for (let i = 0; i < d.length; i++) bw[boneIndexOf(prims[i].bone)] += Math.exp(-(d[i] - dmin) / tau);
    // top-2 ossos (sem alocação por vértice)
    let b0 = 0, b1 = -1;
    for (let b = 1; b < nb; b++) {
      if (bw[b] > bw[b0]) { b1 = b0; b0 = b; } else if (b1 < 0 || bw[b] > bw[b1]) b1 = b;
    }
    const sum = bw[b0] + (b1 >= 0 ? bw[b1] : 0);
    si[v * 4] = b0; sw[v * 4] = bw[b0] / sum;
    if (b1 >= 0) { si[v * 4 + 1] = b1; sw[v * 4 + 1] = bw[b1] / sum; }
    const c = colorFn(x, y, z, mesh.normals[v * 3 + 1]);
    col.set(c, v * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  GOOSE_TIMING[tag] = { mesh: +(tb - ta).toFixed(1), attr: +(performance.now() - tb).toFixed(1), tris: mesh.indices.length / 3 };
  return g;
}

// bico: esfera deformada (largo na base, afinando, ponta com "unha" mais clara)
function beakGeometry(len, w, h, lower) {
  const g = new THREE.SphereGeometry(1, 22, 14);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const base = lin('#f0841c'), tip = lin(lower ? '#f39a45' : '#f6c48a'), dark = lin('#c9601a');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (z + 1) / 2; // 0 base → 1 ponta
    const taper = 1 - 0.62 * Math.pow(t, 1.2);
    x *= w * taper;
    y *= h * (1 - 0.45 * t);
    if (!lower) y += (1 - t) * h * 0.25 * (y > 0 ? 1 : 0) - t * t * h * 0.35; // dorso convexo, ponta curvando
    else y *= y > 0 ? 0.35 : 1;
    z = t * len;
    p.setXYZ(i, x, y, z);
    const c = t > 0.86 ? tip : y < 0 && !lower ? dark : base;
    const k = t > 0.86 ? 1 : 0;
    col.set([lerp(base[0], c[0], 0.7 + 0.3 * k), lerp(base[1], c[1], 0.7 + 0.3 * k), lerp(base[2], c[2], 0.7 + 0.3 * k)], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// pata palmípede: forma achatada com 3 dedos e membrana recortada
function footGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.01, -0.012);
  s.lineTo(-0.036, 0.05);
  s.quadraticCurveTo(-0.03, 0.062, -0.022, 0.054);
  s.quadraticCurveTo(-0.012, 0.05, -0.006, 0.064);
  s.quadraticCurveTo(0.0, 0.074, 0.006, 0.064);
  s.quadraticCurveTo(0.012, 0.05, 0.022, 0.054);
  s.quadraticCurveTo(0.03, 0.062, 0.036, 0.05);
  s.lineTo(0.01, -0.012);
  s.quadraticCurveTo(0, -0.02, -0.01, -0.012);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(Math.PI / 2); // deitada no chão, dedos para +Z
  g.translate(0, 0.007, 0);
  return g;
}

// ---------------------------------------------------------------------------- criação
export function createGoose() {
  const t0 = performance.now();
  const object = new THREE.Group();
  object.name = 'dona-gansa';
  const inner = new THREE.Group();
  object.add(inner);

  // esqueleto
  const bones = BONES.map((n) => {
    const b = new THREE.Bone();
    b.name = n;
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

  // corpo (SDF → malha → skin), geometria em cache
  const white = lin('#f4f2ec'), warm = lin('#efe9df'), cool = lin('#e6e8ec');
  const bodyGeo = GEO.body || (GEO.body = meshFromSDF(design(), CELL_BODY, (n) => BONES.indexOf(n), (x, y, z, ny) => {
    const n = fbm(x * 22, y * 22, z * 22, 2, 9) * 0.035;
    let c = white;
    if (ny < -0.3) c = warm.map((v, k) => lerp(white[k], v, sstep(-0.3, -0.9, ny))); // barriga mais quente
    if (y > 0.43) c = cool.map((v, k) => lerp(c[k], v, 0.35)); // cabeça um pouco mais fria
    return c.map((v) => v * (1 + n));
  }, 'body'));
  const bodyMat = featherMaterial({ scallop: 0.0, scale: 1 });
  shareResource(bodyGeo);
  const body = new THREE.SkinnedMesh(bodyGeo, bodyMat);
  body.bind(skeleton);
  body.frustumCulled = false;
  body.castShadow = body.receiveShadow = true;
  inner.add(body);

  // asas (malhas rígidas presas ao ombro)
  const wingMat = featherMaterial({ scallop: 1.0, scale: 1.25 });
  const wings = [1, -1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(SHOULDER[0] * side - BONE_POS.body[0], SHOULDER[1] - BONE_POS.body[1], SHOULDER[2] - BONE_POS.body[2]);
    B.body.add(pivot);
    const key = side > 0 ? 'wingL' : 'wingR';
    let geo = GEO[key];
    if (!geo && side < 0 && GEO.wingL) {
      // asa direita = espelho da esquerda (inverte X e a ordem dos triângulos)
      geo = GEO[key] = GEO.wingL.clone();
      geo.scale(-1, 1, 1);
      const I = geo.index.array;
      for (let i = 0; i < I.length; i += 3) { const a = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = a; }
    }
    if (!geo) {
      geo = GEO[key] = meshFromSDF(wingDesign(side), CELL_WING, () => 0, (x, y, z) => {
        const tipK = sstep(-0.12, -0.27, z); // primárias levemente acinzentadas
        return [lerp(0.93, 0.8, tipK), lerp(0.92, 0.81, tipK), lerp(0.9, 0.84, tipK)];
      }, key);
      geo.deleteAttribute('skinIndex');
      geo.deleteAttribute('skinWeight');
      geo.translate(-SHOULDER[0] * side, -SHOULDER[1], -SHOULDER[2]);
    }
    const m = new THREE.Mesh(shareResource(geo), wingMat);
    m.castShadow = m.receiveShadow = true;
    pivot.add(m);
    return { pivot, side };
  });

  // cabeça: bico, olhos, "sobrancelhas" bravas
  const headP = BONE_POS.head;
  const H = (x, y, z) => new THREE.Vector3(x - headP[0], y - headP[1], z - headP[2]);
  const beakMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const beakU = new THREE.Mesh(beakGeometry(0.072, 0.023, 0.018, false), beakMat);
  beakU.position.copy(H(0, 0.519, 0.218));
  beakU.rotation.x = 0.2;
  const jaw = new THREE.Group();
  jaw.position.copy(H(0, 0.509, 0.216));
  jaw.rotation.x = 0.2;
  const beakL = new THREE.Mesh(beakGeometry(0.058, 0.019, 0.009, true), beakMat);
  beakL.position.set(0, -0.002, 0.002);
  jaw.add(beakL);
  const mouthIn = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: '#7a2e2a', roughness: 0.7 }));
  mouthIn.scale.set(0.014, 0.006, 0.03);
  mouthIn.position.set(0, 0.003, 0.03);
  jaw.add(mouthIn);
  B.head.add(beakU, jaw);
  for (const m of [beakU, beakL]) m.castShadow = true;

  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#0b0a0c', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const browMat = new THREE.MeshStandardMaterial({ color: '#5e5b63', roughness: 0.9 });
  const eyes = [];
  const brows = [];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.copy(H(0.0385 * side, 0.53, 0.196));
    g.rotation.y = side * 0.9;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 18, 12), eyeMat);
    const c1 = new THREE.Mesh(new THREE.CircleGeometry(0.0033, 10), catchMat);
    c1.position.set(-0.0025 * side, 0.004, 0.0098);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0106, 0.0017, 6, 20), new THREE.MeshStandardMaterial({ color: '#f1a24a', roughness: 0.5 }));
    g.add(eye, c1, ring);
    B.head.add(g);
    eyes.push(g);
    // sobrancelha: tufo escuro inclinado, ponta da frente mais baixa (cara de brava)
    const bw = new THREE.Group();
    bw.position.copy(H(0.037 * side, 0.5475, 0.193));
    bw.rotation.set(0.5, side * 0.85, side * 0.0);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.024, 4, 8).rotateX(Math.PI / 2), browMat);
    brow.scale.set(1.25, 0.8, 1);
    bw.add(brow);
    B.head.add(bw);
    brows.push(bw);
  }

  // pernas e patas (rígidas, fora do corpo para os pés ficarem plantados)
  const orangeMat = new THREE.MeshPhysicalMaterial({ color: '#f0861f', roughness: 0.5, clearcoat: 0.25 });
  const LEG_L = 0.15;
  const fGeo = footGeometry();
  const legs = [1, -1].map((side) => {
    const leg = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.0135, LEG_L, 10, 1).translate(0, -LEG_L / 2, 0), orangeMat);
    const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 10, 8), orangeMat);
    knuckle.position.y = -LEG_L;
    leg.add(shank, knuckle);
    const foot = new THREE.Mesh(fGeo, orangeMat);
    foot.castShadow = true;
    shank.castShadow = true;
    inner.add(leg, foot);
    return { side, leg, foot, swing: false };
  });

  // sombra de contato
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture(), color: 0x0c1020, transparent: true, opacity: 0.6, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  );
  shadow.position.y = 0.004;
  shadow.renderOrder = -1;
  shadow.scale.set(0.36, 1, 0.5);
  object.add(shadow);

  const genMs = performance.now() - t0;
  const tris = bodyGeo.index.count / 3 + wings.reduce((a, w) => a + /** @type {THREE.Mesh} */ (w.pivot.children[0]).geometry.index.count / 3, 0)
    + (beakU.geometry.index.count / 3) * 2 + (fGeo.index ? fGeo.index.count / 3 : fGeo.attributes.position.count / 3) * 2 + 2000;

  // ---------------------------------------------------------------------------- animação
  const st = {
    t: Math.random() * 10,
    speed: 0,
    move: 0,
    turnS: 0,
    phase: 0,
    w: { alert: 0, honk: 0, charge: 0, curious: 0, flap: 0, walk: 0 },
    honkT: -1,
    preenT: 4 + Math.random() * 3,
    preen: 0,
    glanceT: 1,
    glanceYaw: 0,
    glancePitch: 0,
    lookYaw: 0,
    lookPitch: 0,
    blinkT: 2,
    blink: 0,
    beak: 0,
    flapPh: 0,
  };
  const _e = new THREE.Euler();
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _down = new THREE.Vector3(0, -1, 0);
  const _m = new THREE.Matrix4();
  const _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);
  const setE = (b, x, y, z) => b.quaternion.setFromEuler(_e.set(x, y, z, 'YXZ'));

  function update(dt, A = {}) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    st.t += dt;
    const t = st.t;
    const damp = (cur, target, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
    const action = A.action || 'idle';
    const w = st.w;
    for (const k of ['alert', 'honk', 'charge', 'curious', 'flap']) w[k] = damp(w[k], action === k ? 1 : 0, k === 'charge' ? 9 : 6);
    const speedIn = Math.max(0, A.speed || 0) + (action === 'walk' && !(A.speed > 0) ? 0.25 : 0);
    st.speed = damp(st.speed, speedIn, 10);
    const v = st.speed;
    st.turnS = damp(st.turnS, A.turn || 0, 8);
    st.move = damp(st.move, Math.max(sstep(0.03, 0.25, v), sstep(0.5, 1.6, Math.abs(st.turnS)) * 0.7), 8);
    const calm = (1 - w.alert) * (1 - w.honk) * (1 - w.charge) * (1 - w.flap);

    // grasnado
    let honkEnv = 0;
    if (st.honkT >= 0) {
      st.honkT += dt;
      const u = st.honkT / 0.42;
      if (u >= 1) st.honkT = -1;
      else honkEnv = Math.sin(Math.PI * Math.min(1, u * 1.6)) * (u < 0.62 ? 1 : 1 - (u - 0.62) / 0.38);
    }
    if (action === 'honk' && st.honkT < 0 && fract(t * 0.9) < dt * 0.9) st.honkT = 0; // grasna em série

    // ---------------- marcha gingada
    const f = (2.3 + 2.6 * Math.min(v, 2.5)) * (1 + w.charge * 0.25);
    st.phase = fract(st.phase + f * dt * Math.max(st.move, 0.001));
    const ph = st.phase * TAU;
    const amp = st.move;
    const roll = Math.sin(ph) * 0.13 * amp * (1 - w.charge * 0.4);
    const yawW = Math.sin(ph) * 0.07 * amp;
    const bob = -Math.abs(Math.cos(ph)) * 0.01 * amp;
    const breathe = Math.sin(t * 2.1) * 0.003;
    // pose do corpo
    const bodyPitch = w.charge * 0.24 - w.alert * 0.1 - w.flap * 0.22 + w.honk * 0.12 + Math.min(v, 2) * 0.04;
    const flapHop = w.flap * Math.max(0, Math.sin(st.flapPh)) * 0.02;
    B.body.position.set(0, BONE_POS.body[1] + bob + breathe + flapHop - w.charge * 0.02 + w.alert * 0.012, 0);
    setE(B.body, bodyPitch, yawW - st.turnS * 0.05, roll);
    setE(B.tail, -0.1 * w.alert + Math.sin(t * 9) * 0.05 * w.honk, Math.sin(ph + 1) * 0.18 * amp + Math.sin(t * 13) * 0.15 * st.preen, 0);

    // ---------------- olhar
    let tYaw = 0, tPitch = 0;
    if (A.lookAt) {
      const dx = A.lookAt.x - object.position.x, dz = A.lookAt.z - object.position.z;
      const c = Math.cos(object.rotation.y), sn = Math.sin(object.rotation.y);
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      tYaw = clamp(Math.atan2(lx, lz), -1.7, 1.7);
      tPitch = clamp(-Math.atan2((A.lookAt.y ?? 0.3) - 0.5, Math.max(Math.hypot(lx, lz), 0.3)), -0.6, 0.6);
    } else {
      st.glanceT -= dt;
      if (st.glanceT <= 0) {
        st.glanceT = 1.2 + Math.random() * 2.6;
        st.glanceYaw = (Math.random() * 2 - 1) * 1.1;
        st.glancePitch = Math.random() * 0.3 - 0.15;
      }
      tYaw = st.glanceYaw * calm * (1 - st.move * 0.6);
      tPitch = st.glancePitch * calm;
    }
    // alisando as penas (idle): vira a cabeça para a asa e "belisca"
    st.preenT -= dt;
    const preening = action === 'idle' && !A.lookAt && st.move < 0.2 && st.preenT < 0;
    if (st.preenT < -1.8) st.preenT = 5 + Math.random() * 4;
    st.preen = damp(st.preen, preening ? 1 : 0, 4);
    const pr = st.preen;
    const peck = pr * Math.max(0, Math.sin(t * 11)) * 0.12;
    tYaw = lerp(tYaw, 2.3, pr);
    st.lookYaw = damp(st.lookYaw, tYaw, w.alert > 0.5 ? 9 : 5);
    st.lookPitch = damp(st.lookPitch, tPitch, 5);

    // ---------------- pescoço (S em repouso → esticado no alerta → baixo e à frente na investida)
    const ly = st.lookYaw;
    const curiousTilt = w.curious * (0.5 + Math.sin(t * 1.3) * 0.12);
    const n0 = 0.0 + w.charge * 1.15 + w.honk * 0.55 + w.curious * 0.25 - w.alert * 0.3 - w.flap * 0.2 + pr * 0.35 + Math.sin(ph * 2) * 0.05 * amp;
    const n1 = 0.0 + w.charge * 0.18 + w.honk * 0.1 - w.alert * 0.12 + pr * 0.5;
    const n2 = 0.0 - w.charge * 0.22 + w.honk * 0.05 + w.alert * 0.2 + pr * 0.6;
    const headWorld = 0.18 * calm - w.alert * 0.05 + w.charge * 0.1 + w.honk * 0.05 + st.lookPitch + pr * 0.4 + peck + w.curious * 0.1;
    // bob de pombo ao andar (cabeça vai e volta)
    const headBob = Math.sin(ph * 2) * 0.06 * amp * (1 - w.charge);
    setE(B.neck0, n0, ly * 0.22, -roll * 0.6);
    setE(B.neck1, n1 + headBob, ly * 0.3, 0);
    setE(B.neck2, n2, ly * 0.48, curiousTilt * 0.3);
    const jerk = honkEnv * 0.25;
    setE(B.head, headWorld - (bodyPitch + n0 + n1 + n2 + headBob) - jerk * 0.4, 0, curiousTilt * 0.8 - roll * 0.3);
    B.neck1.position.set(0, BONE_POS.neck1[1] - BONE_POS.neck0[1], BONE_POS.neck1[2] - BONE_POS.neck0[2] + jerk * 0.02);

    // ---------------- bico
    const hiss = w.charge * (0.55 + Math.sin(t * 23) * 0.1);
    const beakT = Math.max(honkEnv * 0.62, hiss, w.honk * 0.12, pr * Math.max(0, Math.sin(t * 11 + 0.6)) * 0.25);
    st.beak = damp(st.beak, beakT, 24);
    jaw.rotation.x = 0.2 + st.beak * 0.62;
    beakU.rotation.x = 0.2 - st.beak * 0.08;

    // ---------------- asas
    st.flapPh += dt * TAU * lerp(4.2, 5.5, w.charge);
    const flapAmt = Math.max(w.flap, w.charge * 0.75);
    const beat = Math.sin(st.flapPh);
    const spread = Math.max(flapAmt * 1.25, w.honk * 0.32 + honkEnv * 0.15, w.alert * 0.08);
    const raise = flapAmt * (0.62 + 0.62 * beat) + w.honk * 0.18 + honkEnv * 0.1 + pr * 0.15 * (wings[0] ? 1 : 0);
    for (const wg of wings) {
      // abre (gira em Y no ombro, a ponta vai para o lado) e levanta (gira em Z)
      _q.setFromAxisAngle(_Y, -wg.side * spread);
      _q2.setFromAxisAngle(_Z, wg.side * raise);
      wg.pivot.quaternion.multiplyQuaternions(_q2, _q);
      const preenSide = wg.side === 1 ? pr : 0; // levanta a asa do lado que está sendo alisado
      if (preenSide > 0.01) wg.pivot.quaternion.premultiply(_q.setFromAxisAngle(_Z, preenSide * 0.25));
    }

    // ---------------- pernas e patas palmípedes (pés plantados)
    inner.updateMatrixWorld(true);
    const L = v / Math.max(f, 0.5);
    const beta = 0.6;
    const stroke = beta * L;
    const lift = 0.03 * Math.min(1, 0.4 + v) * amp;
    for (let i = 0; i < 2; i++) {
      const lg = legs[i];
      const p = fract(st.phase + i * 0.5);
      let fz = 0, fy = 0, curl = 0;
      const swing = p >= beta;
      if (!swing) fz = stroke * (0.5 - p / beta);
      else {
        const u = (p - beta) / (1 - beta);
        fz = stroke * (-0.5 + u * u * (3 - 2 * u));
        fy = lift * Math.sin(Math.PI * u);
        curl = Math.sin(Math.PI * u);
      }
      fz *= amp; fy *= amp; curl *= amp;
      // em curva parada: passinhos de lado
      const turnStep = (1 - sstep(0.03, 0.25, v)) * clamp(st.turnS, -2, 2) * 0.012 * (swing ? 1 : -1);
      const fx = lg.side * (0.06 + w.charge * 0.01) + turnStep;
      const foot = _v.set(fx, fy, 0.03 + fz);
      // quadril acompanha o corpo
      const hip = _v2.set(HIP[0] * lg.side, HIP[1] - BONE_POS.body[1], HIP[2]).applyMatrix4(B.body.matrix);
      lg.leg.position.copy(hip);
      const dir = foot.clone().sub(hip);
      const len = dir.length();
      dir.divideScalar(len);
      lg.leg.quaternion.setFromUnitVectors(_down, dir);
      lg.leg.scale.set(1, clamp((len - 0.006) / LEG_L, 0.7, 1.25), 1);
      lg.foot.position.copy(foot);
      lg.foot.rotation.set(curl * 0.7, -lg.side * 0.12, 0, 'YXZ');
      if (lg.swing && !swing && v > 0.15) /** @type {any} */ (lg).onStep?.();
      lg.swing = swing;
    }

    // ---------------- piscadas (pálpebra = escala) e olhos arregalados no alerta
    st.blinkT -= dt;
    if (st.blinkT <= 0) { st.blink = 1e-4; st.blinkT = 2 + Math.random() * 3.5; }
    let lid = 0;
    if (st.blink > 0) {
      st.blink += dt;
      const u = st.blink / 0.14;
      if (u >= 1) st.blink = 0;
      else lid = Math.sin(Math.PI * u);
    }
    const wide = 1 + w.alert * 0.12 + w.charge * 0.08;
    for (const e of eyes) e.scale.set(wide, wide * Math.max(0.1, 1 - lid), wide);
    // sobrancelhas: mais franzidas quando brava, sobem quando curiosa
    const angry = Math.max(w.charge, w.honk, w.alert * 0.6);
    brows.forEach((bw, i) => {
      const side = i === 0 ? 1 : -1;
      bw.rotation.set(0.5 + angry * 0.25 - w.curious * 0.45, side * 0.85, 0);
      bw.position.y = 0.5475 - headP[1] - angry * 0.002 + w.curious * 0.004;
    });

    // sombra
    shadow.position.set(B.body.position.x, 0.004, 0.0);
    shadow.material.opacity = 0.6 - flapHop * 6;
  }

  update(1 / 60, { action: 'idle' });

  return {
    object,
    radius: 0.22,
    update,
    triggerHonk() {
      st.honkT = 0;
    },
    stats: { ms: genMs, tris: Math.round(tris), timing: GOOSE_TIMING },
    skeleton,
  };
}
