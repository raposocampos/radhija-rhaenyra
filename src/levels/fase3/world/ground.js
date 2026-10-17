// FASE 3 · Chão noturno: malha com resolução fina na área jogável (afunda no lago seguindo o SDF),
// mapa de cor procedural (grama, margem úmida, caminho de cascalho, pedras de pisar), tufos de grama
// instanciados com vento e florzinhas claras que pegam o luar.
import * as THREE from 'three';
import { ownResource } from '../../../core/resources.js';
import { shared, rng, fbm2, vnoise2, smoothstep, lerp, mergeGeometries, mergeVertices, paint, speckleTexture, mat } from '../../../world/util.js';

const R = { x0: -15, x1: 15, z0: -12, z1: 11 };
const MW = 560, MH = 430;

function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  const ex = px - (ax + vx * t), ez = pz - (az + vz * t);
  return Math.sqrt(ex * ex + ez * ez);
}
function polyDist(px, pz, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}
function sdBox(x, z, c) {
  const dx = Math.abs(x - c.x) - c.hx, dz = Math.abs(z - c.z) - c.hz;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}
function sdCollider(c, x, z) {
  if (c.shape === 'circle') return Math.hypot(x - c.x, z - c.z) - c.r;
  if (c.shape === 'box') return sdBox(x, z, c);
  if (c.shape === 'segment') return segDist(x, z, c.ax, c.az, c.bx, c.bz) - (c.t || 0.04);
  return 1e9;
}

export function inKeepClear(layout, x, z, pad = 0) {
  for (const k of layout.KEEP_CLEAR) {
    if (k.rect) {
      if (x >= k.rect.minX - pad && x <= k.rect.maxX + pad && z >= k.rect.minZ - pad && z <= k.rect.maxZ + pad) return true;
    } else if (k.circle) {
      if (Math.hypot(x - k.circle.x, z - k.circle.z) <= k.circle.r + pad) return true;
    } else if (segDist(x, z, k.from[0], k.from[1], k.to[0], k.to[1]) <= k.width / 2 + pad) return true;
  }
  return false;
}

// Caminho de cascalho em volta do lago (segue o grafo de navegação) e ramal até a ponte.
export const GRAVEL = [
  [[-1.75, 3.0], [-0.95, 2.75], [-0.55, 1.7], [-0.45, 0.5], [-0.1, -0.6], [0.45, -0.6]],
  [[-0.95, 2.75], [0.6, 3.35], [2.8, 3.62], [4.5, 3.3], [5.75, 2.25], [6.2, 0.6], [6.2, -1.6], [5.8, -3.45], [4.2, -4.15], [2.0, -4.15], [0.2, -3.75], [-0.5, -3.0], [-0.55, -1.8], [-0.1, -0.6]],
];
// Pedras de pisar do quintal (deck → pedra pesada, contornando a mesa pelo oeste; deck → cantinho)
export function steppingStones() {
  const r = rng(17);
  const pts = [[-5.35, -2.75], [-5.75, -1.95], [-6.0, -1.15], [-6.05, -0.35], [-5.95, 0.45], [-5.75, 1.25], [-5.45, 2.0],
    [-4.55, -2.75], [-4.05, -2.45], [-3.55, -2.25]];
  return pts.map(([x, z], i) => ({ x: x + (r() - 0.5) * 0.06, z: z + (r() - 0.5) * 0.06, rx: 0.17 + r() * 0.05, rz: 0.13 + r() * 0.04, rot: r() * Math.PI, seed: i * 7.3 }));
}
export const DECK = { x0: -6.6, x1: -3.75, z0: -4.8, z1: -3.05 };

// grade com espaçamento variável (fina na área jogável)
function axisCoords(a0, a1, f0, f1, fine, coarse) {
  const out = [];
  for (let v = a0; v < f0; v += coarse) out.push(v);
  for (let v = f0; v < f1; v += fine) out.push(v);
  for (let v = f1; v <= a1 + 1e-6; v += coarse) out.push(v);
  return out;
}

export function buildGround(layout, field, root = null) {
  const group = new THREE.Group();
  group.name = 'chao';
  root?.add(group);
  const B = layout.WORLD.bounds;
  const stones = steppingStones();
  const solid = layout.STATIC_COLLIDERS.filter((c) => !c.id.startsWith('limite') && c.id !== 'fachada' && c.kind !== 'water' && c.blocks !== 'large');

  // ------------------------------------------------ mapa de cor
  const data = new Uint8Array(MW * MH * 4);
  const moistArr = new Float32Array(MW * MH);
  const cOlive = new THREE.Color('#5f7d36'), cGreen = new THREE.Color('#6f9a3f'), cYellow = new THREE.Color('#9aa64e');
  const cDeep = new THREE.Color('#3f6127'), cMud = new THREE.Color('#3b2f22'), cWetMud = new THREE.Color('#2a231b');
  const cGravel = new THREE.Color('#b9ad97'), cGravel2 = new THREE.Color('#8f8574'), cSoil = new THREE.Color('#4d3d2b');
  const col = new THREE.Color(), tmp = new THREE.Color();
  for (let j = 0; j < MH; j++) {
    const z = R.z0 + (j + 0.5) / MH * (R.z1 - R.z0);
    for (let i = 0; i < MW; i++) {
      const x = R.x0 + (i + 0.5) / MW * (R.x1 - R.x0);
      const n1 = fbm2(x * 0.11 + 3, z * 0.11, 3), n2 = fbm2(x * 0.42, z * 0.42 + 8, 3), n3 = vnoise2(x * 1.7, z * 1.7);
      col.copy(cOlive).lerp(cGreen, smoothstep(0.3, 0.62, n1));
      col.lerp(cYellow, smoothstep(0.55, 0.85, n2) * 0.4 + (n3 - 0.5) * 0.1);
      const near = x > B.minX - 1.5 && x < B.maxX + 1.5 && z > B.minZ - 1 && z < B.maxZ + 1.5;
      let m = 0;
      if (near) for (const c of solid) { const d = sdCollider(c, x, z); if (d < 0.8) m = Math.max(m, Math.exp(-Math.max(d, 0) / 0.25)); }
      m = Math.max(m, Math.exp(-Math.max(0, z - B.minZ) / 0.4) * 0.9);
      m = Math.min(1, m) * (0.8 + 0.4 * n3);
      // margem do lago: terra úmida escura
      const s = near ? field.sdf(x, z) : 9;
      const bank = smoothstep(0.24, 0.02, s);
      m = Math.max(m, bank);
      moistArr[j * MW + i] = m;
      col.lerp(tmp.copy(cDeep), m * 0.5);
      col.lerp(cMud, bank * (0.55 + 0.3 * vnoise2(x * 6, z * 6)));
      col.lerp(cWetMud, smoothstep(0.06, -0.05, s));
      // cascalho
      if (near) {
        let gd = Infinity;
        for (const p of GRAVEL) gd = Math.min(gd, polyDist(x, z, p));
        const edgeN = (vnoise2(x * 5.3, z * 5.3) - 0.5) * 0.12;
        const gk = smoothstep(0.34 + edgeN, 0.2 + edgeN, gd) * (1 - smoothstep(0.1, 0.0, s));
        if (gk > 0) {
          const sp = vnoise2(x * 40, z * 40);
          tmp.copy(cGravel).lerp(cGravel2, sp * 0.8).multiplyScalar(0.85 + vnoise2(x * 9, z * 9) * 0.25);
          col.lerp(tmp, gk * 0.92);
        }
        // terra em volta das pedras de pisar
        for (const st of stones) {
          const d = Math.hypot((x - st.x) / (st.rx + 0.06), (z - st.z) / (st.rz + 0.06));
          if (d < 1.25) col.lerp(cSoil, smoothstep(1.25, 0.95, d) * 0.6);
        }
      }
      const k = (j * MW + i) * 4;
      data[k] = Math.round(Math.min(1, col.r) * 255);
      data[k + 1] = Math.round(Math.min(1, col.g) * 255);
      data[k + 2] = Math.round(Math.min(1, col.b) * 255);
      data[k + 3] = 255;
    }
  }
  const mapTex = new THREE.DataTexture(data, MW, MH, THREE.RGBAFormat);
  ownResource(root || group, mapTex);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.magFilter = THREE.LinearFilter;
  mapTex.minFilter = THREE.LinearMipmapLinearFilter;
  mapTex.generateMipmaps = true;
  mapTex.anisotropy = 8;
  mapTex.needsUpdate = true;
  const sample = (x, z) => {
    const i = Math.max(0, Math.min(MW - 1, Math.floor((x - R.x0) / (R.x1 - R.x0) * MW)));
    const j = Math.max(0, Math.min(MH - 1, Math.floor((z - R.z0) / (R.z1 - R.z0) * MH)));
    const k = (j * MW + i) * 4;
    return { color: new THREE.Color().setRGB(data[k] / 255, data[k + 1] / 255, data[k + 2] / 255, THREE.SRGBColorSpace), moist: moistArr[j * MW + i] };
  };

  // ------------------------------------------------ malha (espaçamento variável)
  const xs = axisCoords(R.x0, R.x1, -7.8, 7.8, 0.065, 0.8);
  const zs = axisCoords(R.z0, R.z1, -5.0, 5.6, 0.065, 0.8);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zs[j];
    const out = Math.max(0, x - B.maxX - 1.2, B.minX - 1.2 - x, z - B.maxZ - 1.2, B.minZ - 0.5 - z);
    let y = field.height(x, z);
    y += Math.min(out, 3) * 0.05 * (fbm2(x * 0.3, z * 0.3, 2) - 0.3);
    const k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const groundGeo = new THREE.BufferGeometry();
  groundGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  groundGeo.setIndex(idx);
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 });
  groundMat.onBeforeCompile = (sh) => {
    sh.uniforms.uMap = { value: mapTex };
    sh.uniforms.uRegion = { value: new THREE.Vector4(R.x0, R.z0, R.x1 - R.x0, R.z1 - R.z0) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform sampler2D uMap; uniform vec4 uRegion;
        float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(gh(i), gh(i+vec2(1,0)), f.x), mix(gh(i+vec2(0,1)), gh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 uvm = (vWPos.xz - uRegion.xy) / uRegion.zw;
          vec3 base = texture2D(uMap, uvm).rgb;
          float d1 = gn(vWPos.xz * 3.3), d2 = gn(vWPos.xz * 11.0 + 4.0), d3 = gn(vWPos.xz * 37.0);
          vec3 g = base * (0.86 + d1 * 0.12 + d2 * 0.1 + d3 * 0.08);
          diffuseColor.rgb *= g;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.45, smoothstep(-0.02, -0.075, vWPos.y));`);
  };
  groundMat.customProgramCacheKey = () => 'f3-ground';
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.name = 'chao-noite';
  group.add(ground);

  // ------------------------------------------------ pedras de pisar
  {
    const geos = [];
    const r = rng(9);
    for (const s of stones) {
      const g = new THREE.SphereGeometry(1, 18, 8);
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const m = mergeVertices(g);
      const p = m.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const a = Math.atan2(z, x);
        const rr = 1 + (vnoise2(Math.cos(a) * 1.6 + s.seed, Math.sin(a) * 1.6) - 0.5) * 0.38;
        x *= rr; z *= rr;
        y = y > 0 ? Math.pow(y, 0.55) * 0.04 + (vnoise2(x * 4 + s.seed, z * 4) - 0.5) * 0.01 : y * 0.06;
        p.setXYZ(i, x * s.rx, y, z * s.rz);
      }
      m.rotateY(s.rot);
      m.translate(s.x, -0.012, s.z);
      m.computeVertexNormals();
      const tint = new THREE.Color('#7f786d').offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08);
      paint(m, (pp) => tint.clone().multiplyScalar(0.9 + 0.2 * vnoise2(pp.x * 9, pp.z * 9)));
      const uv = new Float32Array(m.attributes.position.count * 2);
      for (let i = 0; i < m.attributes.position.count; i++) { uv[i * 2] = m.attributes.position.getX(i) * 2; uv[i * 2 + 1] = m.attributes.position.getZ(i) * 2; }
      m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geos.push(m);
    }
    const st = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.8, map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 1.5,
    }));
    st.receiveShadow = true;
    st.name = 'pedras-de-pisar';
    group.add(st);
  }

  // ------------------------------------------------ tufos de grama
  const grassMat = mat('f3-grass', () => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = shared.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aH; varying float vH; uniform float uTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = aH;')
        .replace('#include <project_vertex>', `
          vec4 mvPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
          #endif
          {
            float ph = uTime * 1.5 + mvPosition.x * 0.8 + mvPosition.z * 0.55;
            float gust = 0.55 + 0.45 * sin(uTime * 0.4 + mvPosition.x * 0.2 - mvPosition.z * 0.13);
            float w = aH * aH;
            mvPosition.x += (sin(ph) * 0.6 + 0.5) * 0.03 * gust * w * (0.4 + max(mvPosition.y, 0.0) * 6.0);
            mvPosition.z += cos(ph * 0.8 + 1.1) * 0.015 * gust * w * (0.4 + max(mvPosition.y, 0.0) * 6.0);
          }
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= mix(0.72, 1.25, vH);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.1, 0.85), smoothstep(0.6, 1.0, vH) * 0.5);`);
    };
    m.customProgramCacheKey = () => 'f3-grass-tuft';
    return m;
  });
  function tuftGeometry(blades, seed) {
    const r = rng(seed);
    const p = [], hs = [], nor = [], idx = [];
    let base = 0;
    for (let b = 0; b < blades; b++) {
      const a = r() * Math.PI * 2;
      const ox = Math.cos(a) * r() * 0.035, oz = Math.sin(a) * r() * 0.035;
      const lean = 0.25 + r() * 0.5, h = 0.6 + r() * 0.4, wdt = 0.014 + r() * 0.01;
      const fa = a + (r() - 0.5) * 1.2;
      const fx = Math.cos(fa + Math.PI / 2), fz = Math.sin(fa + Math.PI / 2);
      for (let s = 0; s <= 3; s++) {
        const t = s / 3, bend = lean * t * t;
        const cx = ox + Math.cos(a) * bend * 0.05, cz = oz + Math.sin(a) * bend * 0.05, y = t * h, ww = wdt * (1 - t * 0.92);
        p.push(cx - fx * ww, y, cz - fz * ww, cx + fx * ww, y, cz + fz * ww);
        hs.push(t, t); nor.push(0, 1, 0, 0, 1, 0);
      }
      for (let s = 0; s < 3; s++) { const i0 = base + s * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
      base += 8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
    g.setIndex(idx);
    return g;
  }
  const inSolid = (x, z, pad) => solid.some((c) => sdCollider(c, x, z) < pad);
  const onStone = (x, z) => stones.some((s) => Math.hypot((x - s.x) / (s.rx + 0.03), (z - s.z) / (s.rz + 0.03)) < 1);
  const onDeck = (x, z) => x > DECK.x0 - 0.1 && x < DECK.x1 + 0.04 && z < DECK.z1 + 0.04;
  const BR = layout.BRIDGE;
  const onBridge = (x, z) => x > BR.x0 - 0.15 && x < BR.x1 + 0.1 && z > BR.zMin - 0.08 && z < BR.zMax + 0.08;
  const plates = [layout.PLATE_H, layout.PLATE_L];
  const onPlate = (x, z) => plates.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 0.12);
  const gravelD = (x, z) => { let d = Infinity; for (const p of GRAVEL) d = Math.min(d, polyDist(x, z, p)); return d; };
  const low = [], tall = [];
  {
    const r = rng(77);
    const step = 0.115;
    for (let z = B.minZ - 0.1; z < B.maxZ + 1.0; z += step) {
      for (let x = B.minX - 0.9; x < B.maxX + 0.9; x += step) {
        const px = x + (r() - 0.5) * step * 1.3, pz = z + (r() - 0.5) * step * 1.3;
        if (pz < B.minZ + 0.03) continue;
        const s = field.sdf(px, pz);
        if (s < 0.08) continue;
        if (inSolid(px, pz, 0.0) || onStone(px, pz) || onDeck(px, pz) || onBridge(px, pz) || onPlate(px, pz)) continue;
        const gd = gravelD(px, pz);
        if (gd < 0.2 && r() < 0.92) continue;
        const sm = sample(px, pz);
        const nearObj = inSolid(px, pz, 0.2) || s < 0.3 || pz < B.minZ + 0.25 || px > B.maxX - 0.15 || px < B.minX + 0.15 || pz > B.maxZ - 0.1;
        const south = pz > 3.5;
        if (nearObj && r() < 0.85) {
          const cap = inKeepClear(layout, px, pz, 0.1) || south ? 0.13 : 0.26;
          tall.push({ x: px, z: pz, y: field.height(px, pz), h: Math.min(cap, 0.12 + r() * 0.16), color: sm.color, r: r() });
        } else if (r() < 0.84) {
          low.push({ x: px, z: pz, y: field.height(px, pz), h: 0.045 + r() * 0.035, color: sm.color, r: r() });
        }
      }
    }
  }
  function makeTufts(list, geo, widthScale) {
    const im = new THREE.InstancedMesh(geo, grassMat, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const c = new THREE.Color();
    list.forEach((t, i) => {
      e.set(0, t.r * Math.PI * 2, 0); q.setFromEuler(e);
      sc.set(widthScale * (0.8 + t.r * 0.5), t.h, widthScale * (0.8 + t.r * 0.5));
      p.set(t.x, t.y, t.z);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
      c.copy(t.color).multiplyScalar(1.1 + (t.r - 0.5) * 0.2);
      im.setColorAt(i, c);
    });
    im.receiveShadow = true;
    im.castShadow = false;
    im.frustumCulled = false;
    return im;
  }
  const lowMesh = makeTufts(low, tuftGeometry(6, 3), 1.25);
  const tallMesh = makeTufts(tall, tuftGeometry(9, 5), 1.6);
  lowMesh.name = 'grama-baixa'; tallMesh.name = 'grama-alta';
  group.add(lowMesh, tallMesh);

  // ------------------------------------------------ florzinhas claras (pegam o luar) em grupinhos
  {
    const r = rng(31);
    const petals = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const g = new THREE.CircleGeometry(0.012, 6).rotateX(-Math.PI / 2);
      g.scale(1.6, 1, 0.8); g.rotateY(-a); g.translate(Math.cos(a) * 0.016, 0, Math.sin(a) * 0.016);
      paint(g, '#ffffff'); petals.push(g);
    }
    const center = new THREE.CircleGeometry(0.009, 8).rotateX(-Math.PI / 2).translate(0, 0.002, 0);
    paint(center, '#f2c230');
    petals.push(center);
    const stem = new THREE.CylinderGeometry(0.002, 0.002, 1, 3).translate(0, -0.5, 0);
    paint(stem, '#3f5a22');
    const flower = mergeGeometries([...petals, stem].map((g) => { g.deleteAttribute('uv'); return g; }));
    const list = [];
    const palette = ['#f6f1ff', '#f6f1ff', '#dfe4ff', '#c7b6ff', '#ffd9ea'];
    for (let i = 0; i < 600 && list.length < 140; i++) {
      const cx = lerp(B.minX - 0.5, B.maxX + 0.5, r()), cz = lerp(B.minZ + 0.4, B.maxZ + 0.7, r());
      if (field.sdf(cx, cz) < 0.25) continue;
      if (inKeepClear(layout, cx, cz, -0.1) && r() < 0.6) continue;
      const tint = palette[Math.floor(r() * palette.length)];
      for (let k = 0; k < 3 + r() * 5; k++) {
        const x = cx + (r() - 0.5) * 0.5, z = cz + (r() - 0.5) * 0.5;
        if (inSolid(x, z, 0.05) || onStone(x, z) || onDeck(x, z) || field.sdf(x, z) < 0.15 || gravelD(x, z) < 0.3) continue;
        list.push({ x, z, h: 0.05 + r() * 0.05, r: r(), c: tint });
      }
    }
    const im = new THREE.InstancedMesh(flower, mat('f3-flower', () => new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, emissive: '#9aa6ff', emissiveIntensity: 0.05,
    })), list.length);
    const m4 = new THREE.Matrix4(), cc = new THREE.Color();
    list.forEach((f, i) => {
      m4.makeRotationY(f.r * 6.28);
      m4.setPosition(f.x, f.h, f.z);
      m4.multiply(new THREE.Matrix4().makeScale(0.8 + f.r * 0.5, f.h, 0.8 + f.r * 0.5));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, cc.set(f.c));
    });
    im.receiveShadow = true;
    im.name = 'florzinhas';
    group.add(im);
  }

  return { group, ground, sample, stones, mapTex };
}
