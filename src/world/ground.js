// Chão do jardim: mapa de cor procedural (várias escalas + umidade junto aos objetos + trilha gasta),
// caminho de pedras, tufos de grama instanciados com vento e florzinhas rasteiras.
import * as THREE from 'three';
import { ownResource } from '../core/resources.js';
import {
  shared, rng, fbm2, vnoise2, smoothstep, lerp, mergeGeometries, mergeVertices, paint, speckleTexture,
} from './util.js';

// Região coberta pelo mapa de cor (metros)
const R = { x0: -16, x1: 18, z0: -14, z1: 13 };
const MW = 448, MH = 352;

// distância com sinal a um colisor (negativo dentro)
function sdCollider(c, x, z) {
  if (c.shape === 'circle') { const dx = x - c.x, dz = z - c.z; return Math.sqrt(dx * dx + dz * dz) - c.r; }
  const dx = Math.abs(x - c.x) - c.hx, dz = Math.abs(z - c.z) - c.hz;
  const ox = Math.max(dx, 0), oz = Math.max(dz, 0);
  return Math.sqrt(ox * ox + oz * oz) + Math.min(Math.max(dx, dz), 0);
}
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  const ex = px - (ax + vx * t), ez = pz - (az + vz * t);
  return Math.sqrt(ex * ex + ez * ez);
}

export function inKeepClear(layout, x, z, pad = 0) {
  for (const k of layout.KEEP_CLEAR) {
    if (k.rect) {
      if (x >= k.rect.minX - pad && x <= k.rect.maxX + pad && z >= k.rect.minZ - pad && z <= k.rect.maxZ + pad) return true;
    } else if (segDist(x, z, k.from[0], k.from[1], k.to[0], k.to[1]) <= k.width / 2 + pad) return true;
  }
  return false;
}

// Pontos do caminho de pedras (capacho → portão), curva suave dentro do corredor.
export function pathStones(layout) {
  const r = rng(42);
  const A = new THREE.Vector2(-3.55, -3.9), B = new THREE.Vector2(0.42, 1.78);
  const len = A.distanceTo(B);
  const dir = B.clone().sub(A).normalize();
  const perp = new THREE.Vector2(-dir.y, dir.x);
  const stones = [];
  const n = Math.round(len / 0.5);
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const side = (i % 2 ? 1 : -1) * (0.07 + r() * 0.06);
    const curve = Math.sin(s * Math.PI) * 0.32 - Math.sin(s * Math.PI * 2) * 0.08;
    const p = A.clone().lerp(B, s).addScaledVector(perp, curve + side);
    const big = 0.17 + r() * 0.06;
    stones.push({ x: p.x, z: p.y, rx: big * (1.1 + r() * 0.25), rz: big * (0.8 + r() * 0.2), rot: r() * Math.PI, seed: i * 13.7 });
  }
  return stones;
}

export function buildGround(engine, layout) {
  const { scene } = engine;
  const colliders = layout.STATIC_COLLIDERS.filter((c) => !c.id.startsWith('limite') && c.id !== 'casa' && c.blocks !== 'large');
  const stones = pathStones(layout);
  const B = layout.WORLD.bounds;

  // ------------------------------------------------ mapa de cor do chão (CPU) — também usado pelos tufos
  const data = new Uint8Array(MW * MH * 4);
  const moistArr = new Float32Array(MW * MH);
  const cOlive = new THREE.Color('#7f9a3c'), cGreen = new THREE.Color('#8fb247'), cYellow = new THREE.Color('#c3c561');
  const cDeep = new THREE.Color('#557a2c'), cWorn = new THREE.Color('#b9a46a'), cSoil = new THREE.Color('#6b5236');
  const col = new THREE.Color(), tmp = new THREE.Color();
  for (let j = 0; j < MH; j++) {
    const z = R.z0 + (j + 0.5) / MH * (R.z1 - R.z0);
    for (let i = 0; i < MW; i++) {
      const x = R.x0 + (i + 0.5) / MW * (R.x1 - R.x0);
      const n1 = fbm2(x * 0.11 + 3, z * 0.11, 3);
      const n2 = fbm2(x * 0.42, z * 0.42 + 8, 3);
      const n3 = vnoise2(x * 1.7, z * 1.7);
      col.copy(cOlive).lerp(cGreen, smoothstep(0.3, 0.62, n1));
      col.lerp(cYellow, smoothstep(0.5, 0.8, n2) * 0.55 + (n3 - 0.5) * 0.12);
      // umidade/sombra junto aos objetos e paredes
      let m = 0;
      const near = x > B.minX - 1 && x < B.maxX + 1 && z > B.minZ - 1 && z < B.maxZ + 1;
      if (near) for (const c of colliders) {
        const d = sdCollider(c, x, z);
        if (d < 0.9) m = Math.max(m, Math.exp(-Math.max(d, 0) / 0.28));
      }
      const fenceD = Math.abs(x - layout.FENCE.x);
      if (z > B.minZ && z < B.maxZ + 0.3) m = Math.max(m, Math.exp(-fenceD / 0.16) * 0.7);
      m = Math.max(m, Math.exp(-Math.max(0, z - B.minZ) / 0.45));          // casa
      m = Math.max(m, Math.exp(-Math.max(0, B.maxX - x) / 0.4) * 0.9);     // muro leste
      m = Math.max(m, Math.exp(-Math.max(0, x - B.minX) / 0.5) * 0.9);     // sebe oeste
      m = Math.max(m, Math.exp(-Math.max(0, B.maxZ - z) / 0.4) * 0.8);     // sebe sul
      if (x > B.maxX || x < B.minX || z > B.maxZ || z < B.minZ) m = 1;
      m = Math.min(1, m) * (0.8 + 0.4 * n3);
      moistArr[j * MW + i] = m;
      col.lerp(tmp.copy(cDeep), m * 0.55);
      col.multiplyScalar(1 - m * 0.12);
      // trilha gasta ao longo das pedras e no centro dos percursos
      let w = 0, wearMain = 0;
      if (near) {
        for (const s of stones) {
          const dx = x - s.x, dz = z - s.z, d2 = dx * dx + dz * dz;
          if (d2 < 0.36) w = Math.max(w, smoothstep(0.55, 0.12, Math.sqrt(d2)));
        }
        wearMain = smoothstep(0.7, 0.0, segDist(x, z, -3.6, -3.9, 0.45, -2.1)) * 0.45;
      }
      w = Math.max(w * 0.85, wearMain) * (0.55 + 0.6 * vnoise2(x * 3.1, z * 3.1));
      col.lerp(cWorn, Math.min(1, w) * 0.45);
      // terra leve junto à base da cerca e da casa
      col.lerp(cSoil, smoothstep(0.75, 1.0, m) * 0.25);
      const k = (j * MW + i) * 4;
      data[k] = Math.round(Math.min(1, col.r) * 255);
      data[k + 1] = Math.round(Math.min(1, col.g) * 255);
      data[k + 2] = Math.round(Math.min(1, col.b) * 255);
      data[k + 3] = 255;
    }
  }
  const mapTex = new THREE.DataTexture(data, MW, MH, THREE.RGBAFormat);
  ownResource(engine.scene, mapTex);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.magFilter = THREE.LinearFilter;
  mapTex.minFilter = THREE.LinearMipmapLinearFilter;
  mapTex.generateMipmaps = true;
  mapTex.wrapS = mapTex.wrapT = THREE.ClampToEdgeWrapping;
  mapTex.anisotropy = 8;
  mapTex.flipY = false;
  mapTex.needsUpdate = true;

  function sample(x, z) {
    const i = Math.max(0, Math.min(MW - 1, Math.floor((x - R.x0) / (R.x1 - R.x0) * MW)));
    const j = Math.max(0, Math.min(MH - 1, Math.floor((z - R.z0) / (R.z1 - R.z0) * MH)));
    const k = (j * MW + i) * 4;
    return {
      color: new THREE.Color().setRGB(data[k] / 255, data[k + 1] / 255, data[k + 2] / 255, THREE.SRGBColorSpace),
      moist: moistArr[j * MW + i],
    };
  }

  // ------------------------------------------------ malha do chão
  const groundGeo = new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0, 68, 54).rotateX(-Math.PI / 2);
  groundGeo.translate((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
  {
    // micro-relevo suave só fora da área jogável
    const p = groundGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const out = Math.max(0, x - B.maxX - 0.6, B.minX - 0.6 - x, z - B.maxZ - 0.6, B.minZ - 0.6 - z);
      p.setY(i, Math.min(out, 3) * 0.04 * (fbm2(x * 0.3, z * 0.3, 2) - 0.3));
    }
    groundGeo.computeVertexNormals();
  }
  const groundMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, metalness: 0 });
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
          float d1 = gn(vWPos.xz * 3.3);
          float d2 = gn(vWPos.xz * 11.0 + 4.0);
          float d3 = gn(vWPos.xz * 37.0);
          float v = 0.86 + d1 * 0.12 + d2 * 0.1 + d3 * 0.08;
          vec3 g = base * v;
          // fiapos de grama seca
          g = mix(g, g * vec3(1.18, 1.1, 0.82), smoothstep(0.7, 0.95, d3) * 0.4);
          diffuseColor.rgb *= g;
        }`);
  };
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.name = 'chao';
  scene.add(ground);

  // ------------------------------------------------ pedras do caminho
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
        y = y > 0 ? Math.pow(y, 0.55) * 0.055 + (vnoise2(x * 4 + s.seed, z * 4) - 0.5) * 0.012 : y * 0.06;
        p.setXYZ(i, x * s.rx, y, z * s.rz);
      }
      m.rotateY(s.rot);
      m.translate(s.x, 0.0, s.z);
      m.computeVertexNormals();
      const tint = new THREE.Color('#b9ad98').offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08);
      paint(m, (pp) => tint.clone().multiplyScalar(0.9 + 0.2 * vnoise2(pp.x * 9, pp.z * 9)));
      // uv planar para o speckle
      const uv = new Float32Array(m.attributes.position.count * 2);
      for (let i = 0; i < m.attributes.position.count; i++) { uv[i * 2] = m.attributes.position.getX(i) * 2; uv[i * 2 + 1] = m.attributes.position.getZ(i) * 2; }
      m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geos.push(m);
    }
    const stonesMesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.82, map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 1.5,
    }));
    stonesMesh.position.y = -0.012;
    stonesMesh.receiveShadow = true;
    stonesMesh.name = 'pedras';
    scene.add(stonesMesh);
  }

  // ------------------------------------------------ tufos de grama
  const grassMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = (sh) => {
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
          float ph = uTime * 1.9 + mvPosition.x * 0.8 + mvPosition.z * 0.55;
          float gust = 0.55 + 0.45 * sin(uTime * 0.45 + mvPosition.x * 0.2 - mvPosition.z * 0.13);
          float w = aH * aH;
          mvPosition.x += (sin(ph) * 0.6 + 0.5) * 0.045 * gust * w * (0.4 + mvPosition.y * 6.0);
          mvPosition.z += cos(ph * 0.8 + 1.1) * 0.02 * gust * w * (0.4 + mvPosition.y * 6.0);
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.78, 1.22, vH);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.08, 0.78), smoothstep(0.6, 1.0, vH) * 0.5);`);
  };
  grassMat.customProgramCacheKey = () => 'grass-tuft';

  function tuftGeometry(blades, seed) {
    const r = rng(seed);
    const pos = [], hs = [], nor = [], idx = [];
    let base = 0;
    for (let b = 0; b < blades; b++) {
      const a = r() * Math.PI * 2;
      const ox = Math.cos(a) * r() * 0.035, oz = Math.sin(a) * r() * 0.035;
      const lean = 0.25 + r() * 0.5, h = 0.6 + r() * 0.4, wdt = 0.014 + r() * 0.01;
      const fa = a + (r() - 0.5) * 1.2; // direção da face
      const fx = Math.cos(fa + Math.PI / 2), fz = Math.sin(fa + Math.PI / 2);
      const segs = 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const bend = lean * t * t;
        const cx = ox + Math.cos(a) * bend * 0.05, cz = oz + Math.sin(a) * bend * 0.05;
        const y = t * h;
        const ww = wdt * (1 - t * 0.92);
        pos.push(cx - fx * ww, y, cz - fz * ww, cx + fx * ww, y, cz + fz * ww);
        hs.push(t, t);
        nor.push(0, 1, 0, 0, 1, 0);
      }
      for (let s = 0; s < segs; s++) {
        const i0 = base + s * 2;
        idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
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
  const onStone = (x, z) => stones.some((s) => Math.hypot((x - s.x) / (s.rx + 0.02), (z - s.z) / (s.rz + 0.02)) < 1);
  const mat = layout.DOOR.mat;
  const onMat = (x, z) => Math.abs(x - mat.x) < mat.w / 2 + 0.05 && Math.abs(z - mat.z) < mat.d / 2 + 0.05;

  const low = [], tall = [];
  {
    const r = rng(77);
    const step = 0.12;
    for (let z = B.minZ - 0.1; z < B.maxZ + 0.6; z += step) {
      for (let x = B.minX - 0.3; x < B.maxX + 0.25; x += step) {
        const px = x + (r() - 0.5) * step * 1.3, pz = z + (r() - 0.5) * step * 1.3;
        if (inside(px, pz, 0.01) || onStone(px, pz) || onMat(px, pz)) continue;
        if (pz < B.minZ + 0.03) continue;
        const s = sample(px, pz);
        const nearObj = colliders.some((c) => sdCollider(c, px, pz) < 0.22) || Math.abs(px - 1.0) < 0.14
          || pz < B.minZ + 0.25 || px > B.maxX - 0.2 || px < B.minX + 0.2 || pz > B.maxZ - 0.15;
        const wantTall = nearObj && r() < 0.85;
        if (wantTall) {
          const cap = inKeepClear(layout, px, pz, 0.1) ? 0.12 : 0.26;
          tall.push({ x: px, z: pz, h: Math.min(cap, 0.12 + r() * 0.16), color: s.color, r: r() });
        } else if (r() < 0.82) {
          low.push({ x: px, z: pz, h: 0.045 + r() * 0.035, color: s.color, r: r() });
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
      p.set(t.x, 0, t.z);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
      c.copy(t.color).multiplyScalar(1.12 + (t.r - 0.5) * 0.2);
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
  scene.add(lowMesh, tallMesh);

  // ------------------------------------------------ florzinhas rasteiras (margaridinhas / trevos)
  {
    const r = rng(31);
    const petals = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const g = new THREE.CircleGeometry(0.012, 6).rotateX(-Math.PI / 2);
      g.scale(1.6, 1, 0.8); g.rotateY(-a); g.translate(Math.cos(a) * 0.016, 0, Math.sin(a) * 0.016);
      paint(g, '#fbf4e6'); petals.push(g);
    }
    const center = new THREE.CircleGeometry(0.009, 8).rotateX(-Math.PI / 2).translate(0, 0.002, 0);
    paint(center, '#f2c230');
    petals.push(center);
    const stem = new THREE.CylinderGeometry(0.002, 0.002, 1, 3).translate(0, -0.5, 0);
    paint(stem, '#5b7a2c');
    const flower = mergeGeometries([...petals.map((g) => { g.deleteAttribute('uv'); return g; }), (() => { stem.deleteAttribute('uv'); return stem; })()]);
    const list = [];
    for (let i = 0; i < 400 && list.length < 70; i++) {
      // em pequenos grupos
      const cx = lerp(B.minX + 0.4, B.maxX - 0.4, r()), cz = lerp(B.minZ + 0.6, B.maxZ - 0.3, r());
      if (inKeepClear(layout, cx, cz, -0.1) && r() < 0.7) continue;
      for (let k = 0; k < 3 + r() * 4; k++) {
        const x = cx + (r() - 0.5) * 0.5, z = cz + (r() - 0.5) * 0.5;
        if (inside(x, z, 0.05) || onStone(x, z) || onMat(x, z)) continue;
        list.push({ x, z, h: 0.05 + r() * 0.04, r: r() });
      }
    }
    const im = new THREE.InstancedMesh(flower, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), list.length);
    const m4 = new THREE.Matrix4();
    list.forEach((f, i) => {
      m4.makeRotationY(f.r * 6.28);
      m4.setPosition(f.x, f.h, f.z);
      const s = new THREE.Matrix4().makeScale(0.8 + f.r * 0.5, 1, 0.8 + f.r * 0.5);
      m4.multiply(s);
      // haste: escala Y da haste = altura (a haste vai de 0 a -1)
      const st = new THREE.Matrix4().makeScale(1, f.h, 1);
      im.setMatrixAt(i, m4.multiply(st));
    });
    im.receiveShadow = true;
    im.name = 'florzinhas';
    scene.add(im);
  }

  return { ground, sample, stones, update() {} };
}
