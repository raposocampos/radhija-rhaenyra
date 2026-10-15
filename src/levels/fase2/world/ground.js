// FASE 2 · Chão da área de serviço: ladrilho hidráulico (zona A), gramado com mancha molhada do
// irrigador (zona B), cimento queimado com juntas (zona C), canal recortado, tufos de grama com vento.
import * as THREE from 'three';
import { shared, rng, fbm2, vnoise2, smoothstep } from '../../../world/util.js';

const R = { x0: -18, x1: 20, z0: -16, z1: 14 };
const MW = 380, MH = 300;

function sdBox(x, z, cx, cz, hx, hz) {
  const dx = Math.abs(x - cx) - hx, dz = Math.abs(z - cz) - hz;
  const ox = Math.max(dx, 0), oz = Math.max(dz, 0);
  return Math.sqrt(ox * ox + oz * oz) + Math.min(Math.max(dx, dz), 0);
}
export function sdCollider(c, x, z) {
  if (c.shape === 'circle') return Math.hypot(x - c.x, z - c.z) - c.r;
  if (c.shape === 'box') return sdBox(x, z, c.x, c.z, c.hx, c.hz);
  return 9;
}
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
export function inKeepClear(layout, x, z, pad = 0) {
  for (const k of layout.KEEP_CLEAR) {
    if (k.rect) {
      if (x >= k.rect.minX - pad && x <= k.rect.maxX + pad && z >= k.rect.minZ - pad && z <= k.rect.maxZ + pad) return true;
    } else if (segDist(x, z, k.from[0], k.from[1], k.to[0], k.to[1]) <= k.width / 2 + pad) return true;
  }
  return false;
}

/** Zonas pavimentadas (retângulos com borda irregular). */
export function pavingZones(layout) {
  const W = layout.WALL_AB, CH = layout.CHANNEL;
  return {
    tiles: { minX: -6.3, maxX: W.x - 0.02, minZ: -4.8, maxZ: 3.35 }, // ladrilho hidráulico (zona A)
    walk: { minX: W.x, maxX: CH.xMin, minZ: -4.8, maxZ: -4.32 }, // calçada junto à parede (B/C)
    cement: { minX: layout.HEDGE_BC.x + 0.3, maxX: CH.xMin, minZ: -4.8, maxZ: 4.4 }, // cimento (zona C)
  };
}

export function buildGround({ root, layout }) {
  const B = layout.WORLD.bounds;
  const S = layout.SPRINKLER, CH = layout.CHANNEL;
  const Z = pavingZones(layout);
  const colliders = layout.STATIC_COLLIDERS.filter((c) => !c.id.startsWith('limite') && c.id !== 'casa' && c.kind !== 'water');

  // ------------------------------------------------ mapa CPU: cor da grama (rgb) + máscara de piso (a)
  const data = new Uint8Array(MW * MH * 4);
  const pave = new Float32Array(MW * MH);
  const cA = new THREE.Color('#5d7d3a'), cB = new THREE.Color('#7a9a45'), cC = new THREE.Color('#9fa65a');
  const cDeep = new THREE.Color('#3b5a2c'), cSoil = new THREE.Color('#5b4634');
  const col = new THREE.Color();
  const pavedAt = (x, z) => {
    let p = 0;
    const edge = (vnoise2(x * 2.3, z * 2.3) - 0.5) * 0.16;
    for (const k of ['tiles', 'walk', 'cement']) {
      const r = Z[k];
      const d = sdBox(x, z, (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, (r.maxX - r.minX) / 2, (r.maxZ - r.minZ) / 2);
      p = Math.max(p, smoothstep(0.06, -0.06, d + (k === 'tiles' ? 0 : edge)));
    }
    return p;
  };
  for (let j = 0; j < MH; j++) {
    const z = R.z0 + (j + 0.5) / MH * (R.z1 - R.z0);
    for (let i = 0; i < MW; i++) {
      const x = R.x0 + (i + 0.5) / MW * (R.x1 - R.x0);
      const n1 = fbm2(x * 0.13 + 3, z * 0.13, 3), n2 = fbm2(x * 0.5, z * 0.5 + 8, 3), n3 = vnoise2(x * 1.9, z * 1.9);
      col.copy(cA).lerp(cB, smoothstep(0.3, 0.65, n1));
      col.lerp(cC, smoothstep(0.55, 0.85, n2) * 0.45 + (n3 - 0.5) * 0.1);
      // umidade / oclusão junto a objetos e paredes
      let m = 0;
      const near = x > B.minX - 1 && x < B.maxX + 1 && z > B.minZ - 1 && z < B.maxZ + 1;
      if (near) for (const c of colliders) {
        const d = sdCollider(c, x, z);
        if (d < 0.8) m = Math.max(m, Math.exp(-Math.max(d, 0) / 0.25) * 0.85);
      }
      m = Math.max(m, Math.exp(-Math.max(0, z - B.minZ) / 0.4));
      m = Math.max(m, Math.exp(-Math.max(0, B.maxX - x) / 0.35) * 0.9);
      m = Math.max(m, Math.exp(-Math.max(0, x - B.minX) / 0.35) * 0.9);
      const dw = Math.abs(x - layout.WALL_AB.x);
      m = Math.max(m, Math.exp(-dw / 0.18) * 0.7);
      m = Math.min(1, m) * (0.8 + 0.4 * n3);
      col.lerp(cDeep, m * 0.5);
      col.lerp(cSoil, smoothstep(0.7, 1.0, m) * 0.22);
      // irrigador: grama encharcada, mais escura e saturada
      const ds = Math.hypot(x - S.x, z - S.z);
      const wet = smoothstep(S.r + 0.35, S.r - 0.25, ds + (n3 - 0.5) * 0.3);
      col.multiplyScalar(1 - wet * 0.36);
      col.g *= 1 + wet * 0.06; col.b *= 1 + wet * 0.12;
      const k = (j * MW + i) * 4;
      data[k] = Math.round(Math.min(1, col.r) * 255);
      data[k + 1] = Math.round(Math.min(1, col.g) * 255);
      data[k + 2] = Math.round(Math.min(1, col.b) * 255);
      const p = pavedAt(x, z);
      pave[j * MW + i] = p;
      data[k + 3] = Math.round(Math.min(1, m) * 255); // a = oclusão (o piso usa)
    }
  }
  const mapTex = new THREE.DataTexture(data, MW, MH, THREE.RGBAFormat);
  mapTex.colorSpace = THREE.NoColorSpace;
  mapTex.magFilter = THREE.LinearFilter;
  mapTex.minFilter = THREE.LinearMipmapLinearFilter;
  mapTex.generateMipmaps = true;
  mapTex.anisotropy = 8;
  mapTex.needsUpdate = true;
  const sample = (x, z) => {
    const i = Math.max(0, Math.min(MW - 1, Math.floor((x - R.x0) / (R.x1 - R.x0) * MW)));
    const j = Math.max(0, Math.min(MH - 1, Math.floor((z - R.z0) / (R.z1 - R.z0) * MH)));
    const k = (j * MW + i) * 4;
    return { color: new THREE.Color().setRGB(data[k] / 255, data[k + 1] / 255, data[k + 2] / 255), pave: pave[j * MW + i] };
  };

  // ------------------------------------------------ malha do chão (shader com ladrilho, cimento e grama)
  const geo = new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0, 76, 60).rotateX(-Math.PI / 2);
  geo.translate((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
  {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const out = Math.max(0, x - B.maxX - 1.0, B.minX - 1.0 - x, z - B.maxZ - 1.2, B.minZ - 1.0 - z);
      p.setY(i, Math.min(out, 3) * 0.05 * (fbm2(x * 0.3, z * 0.3, 2) - 0.3));
    }
    geo.computeVertexNormals();
  }
  const T = Z.tiles, Wk = Z.walk, Cm = Z.cement;
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0 });
  const U = {
    uMap: { value: mapTex },
    uRegion: { value: new THREE.Vector4(R.x0, R.z0, R.x1 - R.x0, R.z1 - R.z0) },
    uTiles: { value: new THREE.Vector4(T.minX, T.minZ, T.maxX, T.maxZ) },
    uWalk: { value: new THREE.Vector4(Wk.minX, Wk.minZ, Wk.maxX, Wk.maxZ) },
    uCement: { value: new THREE.Vector4(Cm.minX, Cm.minZ, Cm.maxX, Cm.maxZ) },
    uChan: { value: new THREE.Vector4(CH.xMin, CH.zMin, CH.xMax, 40) },
    uSpr: { value: new THREE.Vector3(S.x, S.z, S.r) },
    uTime: shared.time,
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        uniform sampler2D uMap; uniform vec4 uRegion, uTiles, uWalk, uCement, uChan; uniform vec3 uSpr; uniform float uTime;
        float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(gh(i), gh(i+vec2(1,0)), f.x), mix(gh(i+vec2(0,1)), gh(i+vec2(1,1)), f.x), f.y); }
        float sdRect(vec2 p, vec4 r){ vec2 c = (r.xy + r.zw) * 0.5, h = (r.zw - r.xy) * 0.5; vec2 d = abs(p - c) - h;
          return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
        float gWet = 0.0; float gPave = 0.0; float gPolish = 0.0; float gD3 = 0.0;
        // ladrilho hidráulico 20 cm: círculos nos cantos (terracota), losango central (azul-ardósia), fundo creme
        vec3 tilePattern(vec2 p, float edgeD){
          float S = 0.3;
          vec2 id = floor(p / S); vec2 uv = fract(p / S); vec2 q = uv - 0.5;
          float h = gh(id);
          vec3 cream = vec3(0.40, 0.33, 0.25), terra = vec3(0.30, 0.12, 0.07), slate = vec3(0.13, 0.17, 0.19), ochre = vec3(0.40, 0.26, 0.11);
          vec3 c = cream;
          float dc = length(abs(q) - 0.5);
          c = mix(c, terra, 1.0 - smoothstep(0.30, 0.315, dc));
          c = mix(c, cream, 1.0 - smoothstep(0.17, 0.185, dc));
          c = mix(c, ochre, 1.0 - smoothstep(0.10, 0.115, dc));
          float dd = abs(q.x) + abs(q.y);
          c = mix(c, slate, 1.0 - smoothstep(0.21, 0.225, dd));
          c = mix(c, cream, 1.0 - smoothstep(0.12, 0.135, dd));
          c = mix(c, terra, 1.0 - smoothstep(0.05, 0.065, dd));
          // faixa de borda: ladrilhos lisos terracota
          if (edgeD > -0.31) c = terra * 0.95;
          // variação por peça, desgaste e rejunte
          c *= 0.9 + h * 0.16;
          float wear = gn(p * 3.0) * gn(p * 11.0);
          c = mix(c, vec3(0.40, 0.36, 0.31), smoothstep(0.35, 0.75, wear) * 0.3);
          float g = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
          c = mix(vec3(0.2, 0.18, 0.16), c, smoothstep(0.01, 0.025, g));
          gPolish = 0.35 + h * 0.25;
          return c;
        }
        vec3 cementPattern(vec2 p, float joint){
          float n = gn(p * 1.3) * 0.5 + gn(p * 4.7) * 0.3 + gn(p * 19.0) * 0.2;
          vec3 c = mix(vec3(0.24, 0.23, 0.21), vec3(0.33, 0.31, 0.28), n);
          c = mix(c, vec3(0.18, 0.18, 0.17), smoothstep(0.62, 0.8, gn(p * 0.8 + 3.0)) * 0.4);
          vec2 f = abs(fract(p / joint) - 0.5) * joint;
          float jd = joint * 0.5 - max(f.x, f.y);
          c *= mix(0.55, 1.0, smoothstep(0.004, 0.016, jd));
          gPolish = 0.55;
          return c;
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vWPos.x > uChan.x + 0.005 && vWPos.x < uChan.z - 0.005 && vWPos.z > uChan.y - 0.4) discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 uvm = (vWPos.xz - uRegion.xy) / uRegion.zw;
          vec4 M = texture2D(uMap, uvm);
          vec3 base = M.rgb;
          float occ = M.a;
          float d1 = gn(vWPos.xz * 3.3), d2 = gn(vWPos.xz * 11.0 + 4.0), d3 = gn(vWPos.xz * 37.0); gD3 = d3;
          vec3 grass = base * (0.84 + d1 * 0.14 + d2 * 0.1 + d3 * 0.08);
          grass = mix(grass, grass * vec3(1.12, 1.08, 0.85), smoothstep(0.72, 0.95, d3) * 0.35);
          vec2 p = vWPos.xz;
          float wn = (gn(p * 2.3) - 0.5) * 0.16;
          float dT = sdRect(p, uTiles);
          float dW = sdRect(p, uWalk) + wn;
          float dC = sdRect(p, uCement) + wn;
          vec3 col = grass;
          float aT = 1.0 - smoothstep(-0.005, 0.005, dT);
          float aC = 1.0 - smoothstep(-0.03, 0.03, min(dW, dC));
          if (aC > 0.0) {
            vec3 cc = cementPattern(p - vec2(0.05, 0.2), 1.0);
            col = mix(col, cc * (1.0 - occ * 0.35), aC);
            gPave = max(gPave, aC);
          }
          if (aT > 0.0) {
            vec3 tc = tilePattern(p - uTiles.xy, dT);
            col = mix(col, tc * (1.0 - occ * 0.4), aT);
            gPave = max(gPave, aT);
          }
          // tufinhos escuros onde a grama invade a borda do piso
          float edgeG = (1.0 - smoothstep(0.0, 0.1, abs(min(dT, min(dW, dC))))) * step(0.6, gn(p * 9.0));
          col = mix(col, grass * 0.8, edgeG * 0.5);
          // irrigador: grama molhada (escura, brilhante) + piso salpicado
          float ds = length(p - uSpr.xy);
          gWet = (1.0 - smoothstep(uSpr.z - 0.25, uSpr.z + 0.35, ds + (d1 - 0.5) * 0.3));
          col *= 1.0 - gWet * 0.12 * (1.0 - gPave);
          diffuseColor.rgb *= col;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.62 - gPolish * 0.18, gPave);
        roughnessFactor = mix(roughnessFactor, 0.32 + gD3 * 0.25, gWet * (1.0 - gPave) * 0.9);`);
  };
  mat.customProgramCacheKey = () => 'f2-ground';
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  ground.name = 'chao-f2';
  root.add(ground);

  // ------------------------------------------------ tufos de grama (instanciados, vento)
  const grassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.uniforms.uSpr = U.uSpr;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aH; varying float vH; varying float vWet; uniform float uTime; uniform vec3 uSpr;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = aH;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        {
          float ph = uTime * 1.9 + mvPosition.x * 0.8 + mvPosition.z * 0.55;
          float gust = 0.55 + 0.45 * sin(uTime * 0.45 + mvPosition.x * 0.2 - mvPosition.z * 0.13);
          float w = aH * aH;
          float ds = length(mvPosition.xz - uSpr.xy);
          vWet = 1.0 - smoothstep(uSpr.z - 0.2, uSpr.z + 0.3, ds);
          float droop = 1.0 - vWet * 0.45;
          mvPosition.y *= droop;
          mvPosition.x += (sin(ph) * 0.6 + 0.5) * 0.04 * gust * w * (0.4 + mvPosition.y * 6.0);
          mvPosition.z += cos(ph * 0.8 + 1.1) * 0.02 * gust * w * (0.4 + mvPosition.y * 6.0);
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH; varying float vWet;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.7, 1.2, vH);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.08, 0.82), smoothstep(0.6, 1.0, vH) * 0.4);
        diffuseColor.rgb *= 1.0 - vWet * 0.2;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.35, vWet);');
  };
  grassMat.customProgramCacheKey = () => 'f2-grass-tuft';

  function tuftGeometry(blades, seed) {
    const r = rng(seed);
    const pos = [], hs = [], nor = [], idx = [];
    let base = 0;
    for (let b = 0; b < blades; b++) {
      const a = r() * Math.PI * 2;
      const ox = Math.cos(a) * r() * 0.035, oz = Math.sin(a) * r() * 0.035;
      const lean = 0.25 + r() * 0.5, h = 0.6 + r() * 0.4, wdt = 0.014 + r() * 0.01;
      const fa = a + (r() - 0.5) * 1.2;
      const fx = Math.cos(fa + Math.PI / 2), fz = Math.sin(fa + Math.PI / 2);
      const segs = 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs, bend = lean * t * t;
        const cx = ox + Math.cos(a) * bend * 0.05, cz = oz + Math.sin(a) * bend * 0.05, y = t * h, ww = wdt * (1 - t * 0.92);
        pos.push(cx - fx * ww, y, cz - fz * ww, cx + fx * ww, y, cz + fz * ww);
        hs.push(t, t); nor.push(0, 1, 0, 0, 1, 0);
      }
      for (let s = 0; s < segs; s++) { const i0 = base + s * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
      base += (segs + 1) * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
    g.setIndex(idx);
    return g;
  }

  const inside = (x, z, pad) => colliders.some((c) => sdCollider(c, x, z) < pad);
  const chanPad = (x, z) => x > CH.xMin - 0.04 && x < CH.xMax + 0.04 && z > CH.zMin - 0.5;
  const plank = layout.PLANK;
  const onPlank = (x, z) => Math.abs(x - plank.x) < plank.hx + 0.08 && Math.abs(z - plank.z) < plank.hz + 0.08;
  const bed = layout.DOG_BED;
  const low = [], tall = [];
  {
    const r = rng(77);
    const step = 0.12;
    for (let z = B.minZ - 0.1; z < B.maxZ + 1.6; z += step) {
      for (let x = B.minX - 0.6; x < B.maxX + 0.5; x += step) {
        const px = x + (r() - 0.5) * step * 1.3, pz = z + (r() - 0.5) * step * 1.3;
        const s = sample(px, pz);
        if (s.pave > 0.35) {
          // um tufinho ou outro nas juntas da borda do piso
          if (s.pave < 0.7 && r() < 0.25) low.push({ x: px, z: pz, h: 0.03 + r() * 0.03, color: s.color, r: r() });
          continue;
        }
        if (inside(px, pz, 0.01) || chanPad(px, pz) || onPlank(px, pz)) continue;
        if (pz < B.minZ + 0.03) continue;
        if (Math.hypot(px - bed.x, pz - bed.z) < 0.5) continue;
        const nearObj = colliders.some((c) => sdCollider(c, px, pz) < 0.2) || pz > B.maxZ - 0.1 || px > B.maxX - 0.2 || px < B.minX + 0.15
          || Math.abs(px - CH.xMax) < 0.16 || Math.abs(px - CH.xMin + 0.05) < 0.1 || s.pave > 0.1;
        if (nearObj && r() < 0.85) {
          const cap = inKeepClear(layout, px, pz, 0.1) ? 0.11 : 0.24;
          tall.push({ x: px, z: pz, h: Math.min(cap, 0.11 + r() * 0.15), color: s.color, r: r() });
        } else if (r() < 0.84) {
          low.push({ x: px, z: pz, h: 0.04 + r() * 0.035, color: s.color, r: r() });
        }
      }
    }
  }
  function makeTufts(list, g, widthScale) {
    const im = new THREE.InstancedMesh(g, grassMat, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const c = new THREE.Color();
    list.forEach((t, i) => {
      e.set(0, t.r * Math.PI * 2, 0); q.setFromEuler(e);
      sc.set(widthScale * (0.8 + t.r * 0.5), t.h, widthScale * (0.8 + t.r * 0.5));
      p.set(t.x, 0, t.z);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
      c.copy(t.color).multiplyScalar(1.1 + (t.r - 0.5) * 0.2);
      im.setColorAt(i, c);
    });
    im.instanceMatrix.needsUpdate = true;
    im.receiveShadow = true;
    im.castShadow = false;
    im.frustumCulled = false;
    return im;
  }
  const lowMesh = makeTufts(low, tuftGeometry(6, 3), 1.25);
  const tallMesh = makeTufts(tall, tuftGeometry(9, 5), 1.6);
  lowMesh.name = 'grama-baixa'; tallMesh.name = 'grama-alta';
  root.add(lowMesh, tallMesh);

  return { ground, sample, uniforms: U };
}
