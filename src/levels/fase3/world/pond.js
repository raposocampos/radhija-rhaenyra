// FASE 3 · Lago do jardim: campo de distância (SDF 2D) a partir do anel de círculos POND.ring
// (união suave), relevo da margem, água escura espelhada (reflexo falso do céu, da lua e das luzes
// práticas, ondinhas procedurais), pedras e juncos da margem, vitórias-régias e ponte de madeira.
import * as THREE from 'three';
import {
  rng, vnoise2, vnoise3, smoothstep, paint, mergeGeometries, mergeVertices, speckleTexture, woodMat, ironMat,
  rbox, mat, SUN_DIR, shared,
} from '../../../world/util.js';

// ------------------------------------------------------------------ campo do lago
/** sdf(x,z) < 0 = água (visual). A margem visual fica ~7 cm para dentro dos colisores. */
export function pondField(layout) {
  const ring = layout.POND.ring;
  const K = 0.42, OFF = 0.07;
  const sdf = (x, z) => {
    let d = 1e9;
    for (let i = 0; i < ring.length; i++) {
      const c = ring[i];
      const di = Math.hypot(x - c.x, z - c.z) - c.r;
      const h = Math.max(K - Math.abs(d - di), 0) / K;
      d = Math.min(d, di) - h * h * K * 0.25;
    }
    return d + OFF + (vnoise2(x * 2.1 + 3.7, z * 2.1) - 0.5) * 0.07;
  };
  // relevo: beirada suave até a linha d'água (-0.08) e fundo mais escuro e fundo
  const height = (x, z) => {
    const s = sdf(x, z);
    if (s > 0.17) return 0;
    return -0.1 * smoothstep(0.17, 0.0, s) - 0.34 * smoothstep(0.0, -0.5, s);
  };
  return { sdf, height, waterY: layout.POND.waterY };
}

// ------------------------------------------------------------------ água
function waterMaterial(lightsCount) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uMoonDir: { value: new THREE.Vector3(0.4, 0.7, -0.55).normalize() },
      uMoonCol: { value: new THREE.Color('#dfe8ff') },
      uDeep: { value: new THREE.Color('#02050a') },
      uShallow: { value: new THREE.Color('#0a1820') },
      uSkyZen: { value: new THREE.Color('#0a1434') },
      uSkyHor: { value: new THREE.Color('#2c3d6c') },
      uLights: { value: Array.from({ length: lightsCount }, () => new THREE.Vector4(0, -50, 0, 0)) },
      uLightCol: { value: Array.from({ length: lightsCount }, () => new THREE.Color('#ffb060')) },
    },
  ]);
  uniforms.uTime = shared.time;
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      attribute float aSdf;
      varying vec3 vW; varying float vSdf;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vSdf = aSdf;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #define NL ${lightsCount}
      uniform float uTime;
      uniform vec3 uMoonDir, uMoonCol, uDeep, uShallow, uSkyZen, uSkyHor;
      uniform vec4 uLights[NL];
      uniform vec3 uLightCol[NL];
      varying vec3 vW; varying float vSdf;
      #include <fog_pars_fragment>
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      // altura das ondinhas (para o gradiente)
      float wave(vec2 p, float t) {
        float v = 0.0;
        v += sin(dot(p, vec2(5.1, 2.3)) + t * 1.1) * 0.5;
        v += sin(dot(p, vec2(-3.7, 6.2)) + t * 1.4) * 0.35;
        v += sin(dot(p, vec2(9.3, -7.1)) - t * 1.9) * 0.18;
        v += (n2(p * 6.0 + vec2(t * 0.35, -t * 0.22)) - 0.5) * 0.9;
        v += (n2(p * 13.0 - vec2(t * 0.5, t * 0.35)) - 0.5) * 0.18;
        return v;
      }
      void main() {
        float t = uTime;
        vec2 p = vW.xz;
        float e = 0.02;
        float w0 = wave(p, t);
        vec2 g = vec2(wave(p + vec2(e, 0.0), t) - w0, wave(p + vec2(0.0, e), t) - w0) / e;
        vec3 N = normalize(vec3(-g.x * 0.016, 1.0, -g.y * 0.016));
        vec3 V = normalize(cameraPosition - vW);
        vec3 R = reflect(-V, N);
        float ndv = max(dot(N, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        fres = clamp(fres, 0.1, 1.0);
        // céu refletido: gradiente + estrelas estáveis (reflexo pela normal lisa, levemente ondulado)
        vec3 R0 = reflect(-V, normalize(vec3(-g.x * 0.004, 1.0, -g.y * 0.004)));
        float ry = max(R.y, 0.0);
        vec3 sky = mix(uSkyHor, uSkyZen, smoothstep(0.0, 0.7, ry));
        vec2 sp = R0.xz / (R0.y + 0.2) * 55.0;
        vec2 cell = floor(sp);
        float rnd = h21(cell);
        float star = step(0.988, rnd) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5));
        sky += vec3(0.7, 0.78, 1.0) * star * (0.5 + 0.5 * sin(t * 2.0 + rnd * 50.0)) * 0.35;
        // lua
        float md = max(dot(R, uMoonDir), 0.0);
        vec3 refl = sky + uMoonCol * (pow(md, 1600.0) * 6.0 + pow(md, 120.0) * 0.2);
        // corpo da água: escuro, um pouco mais claro na beirada
        float depth = smoothstep(0.02, -0.55, vSdf);
        vec3 body = mix(uShallow, uDeep, depth);
        vec3 col = body * (1.0 - fres) + refl * fres;
        // luzes práticas: reflexo em faixa (as ondinhas esticam o brilho) + brilho difuso na água turva
        for (int i = 0; i < NL; i++) {
          vec4 L = uLights[i];
          if (L.w <= 0.0) continue;
          vec3 toL = L.xyz - vW;
          float dl = length(toL);
          vec3 Ld = toL / dl;
          float s = max(dot(R, Ld), 0.0);
          float glint = pow(s, 900.0) * 2.2 + pow(s, 160.0) * 0.12;
          float near = 1.0 / (1.0 + dl * dl * 2.5);
          col += uLightCol[i] * L.w * (glint + near * 0.035);
        }
        // fio claro e úmido na linha d'água
        col += vec3(0.05, 0.07, 0.08) * smoothstep(-0.07, 0.03, vSdf);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

function buildWater(layout, field) {
  // grade cobrindo o lago; entram as células que tocam a água (o chão encobre o excesso)
  const ring = layout.POND.ring;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const c of ring) { x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); z0 = Math.min(z0, c.z - c.r); z1 = Math.max(z1, c.z + c.r); }
  x0 -= 0.3; x1 += 0.3; z0 -= 0.3; z1 += 0.3;
  const step = 0.07;
  const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
  const S = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) S[j * (nx + 1) + i] = field.sdf(x0 + i * step, z0 + j * step);
  const pos = [], sdf = [], idx = [];
  const map = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const vid = (i, j) => {
    const k = j * (nx + 1) + i;
    if (map[k] < 0) {
      map[k] = pos.length / 3;
      pos.push(x0 + i * step, 0, z0 + j * step);
      sdf.push(S[k]);
    }
    return map[k];
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = S[j * (nx + 1) + i], b = S[j * (nx + 1) + i + 1], c = S[(j + 1) * (nx + 1) + i], d = S[(j + 1) * (nx + 1) + i + 1];
    if (Math.min(a, b, c, d) > 0.06) continue;
    const va = vid(i, j), vb = vid(i + 1, j), vc = vid(i, j + 1), vd = vid(i + 1, j + 1);
    idx.push(va, vc, vb, vb, vc, vd);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSdf', new THREE.Float32BufferAttribute(sdf, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const NL = 16;
  const m = new THREE.Mesh(g, waterMaterial(NL));
  m.position.y = field.waterY;
  m.name = 'agua-lago';
  m.userData.noShadow = true;
  m.receiveShadow = false;
  return m;
}

// ------------------------------------------------------------------ pedras da margem
function rockGeometry(seed, rx, ry, rz) {
  /** @type {THREE.BufferGeometry} */
  let g = new THREE.IcosahedronGeometry(1, 2);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = vnoise3(x * 1.7 + seed, y * 1.7, z * 1.7 - seed) - 0.5;
    const k = 1 + n * 0.45;
    p.setXYZ(i, x * rx * k, (y > 0 ? y : y * 0.6) * ry * k, z * rz * k);
  }
  g.computeVertexNormals();
  return g;
}

export function buildPond(layout, field) {
  const group = new THREE.Group();
  group.name = 'lago';
  const r = rng(303);
  const water = buildWater(layout, field);
  group.add(water);
  const { BRIDGE, ISLAND, NEST, SLIPPER } = layout;
  const onBridge = (x, z, pad = 0.15) => x > BRIDGE.x0 - 0.3 - pad && x < BRIDGE.x1 + 0.2 + pad && z > BRIDGE.zMin - pad && z < BRIDGE.zMax + pad;
  const gooseBank = (x, z) => x < 0.75 && z > -2.5 && z < 1.5;

  // contorno da margem (amostrado ao longo da linha d'água): ângulo em volta do centro do lago
  const C = { x: ISLAND.x, z: ISLAND.z };
  const findEdge = (ang, rMin, rMax) => {
    // procura de fora para dentro (margem externa) ou de dentro para fora (ilha)
    let prev = field.sdf(C.x + Math.cos(ang) * rMin, C.z + Math.sin(ang) * rMin);
    for (let k = 1; k <= 80; k++) {
      const rr = rMin + (rMax - rMin) * (k / 80);
      const s = field.sdf(C.x + Math.cos(ang) * rr, C.z + Math.sin(ang) * rr);
      if (Math.sign(s) !== Math.sign(prev)) return rr;
      prev = s;
    }
    return null;
  };

  // ---------------- pedras arredondadas na margem (meio submersas)
  {
    const geos = [];
    const place = (x, z, size, seed) => {
      const g = rockGeometry(seed, size * (1 + r() * 0.4), size * (0.45 + r() * 0.25), size * (0.8 + r() * 0.3));
      g.rotateY(r() * Math.PI);
      g.translate(x, field.height(x, z) - size * 0.08, z);
      const base = new THREE.Color().setHSL(0.08 + r() * 0.05, 0.07 + r() * 0.05, 0.28 + r() * 0.1);
      const moss = new THREE.Color('#4f6a33');
      paint(g, (pp, n) => base.clone().lerp(moss, Math.max(0, n.y) * 0.45 * vnoise3(pp.x * 9, pp.y * 9, pp.z * 9) * 1.4)
        .multiplyScalar(pp.y < field.waterY + 0.02 ? 0.55 : 1));
      geos.push(g);
    };
    // margem externa
    for (let a = 0; a < Math.PI * 2; a += 0.075 + r() * 0.05) {
      const re = findEdge(a, 3.2, 1.6);
      if (re == null) continue;
      const x = C.x + Math.cos(a) * (re + 0.02), z = C.z + Math.sin(a) * (re + 0.02);
      if (onBridge(x, z)) continue;
      const size = gooseBank(x, z) ? 0.06 + r() * 0.04 : 0.07 + r() * 0.09;
      place(x, z, size, a * 13.1);
      if (r() < 0.45 && !gooseBank(x, z)) place(x + (r() - 0.5) * 0.18, z + (r() - 0.5) * 0.18, size * 0.6, a * 7.7);
    }
    // ilha
    for (let a = 0; a < Math.PI * 2; a += 0.16 + r() * 0.08) {
      const re = findEdge(a, 0.5, 1.6);
      if (re == null) continue;
      const x = C.x + Math.cos(a) * (re - 0.01), z = C.z + Math.sin(a) * (re - 0.01);
      if (onBridge(x, z, 0.1)) continue;
      place(x, z, 0.06 + r() * 0.07, a * 31.3);
    }
    const rocks = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.78, map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 1.2,
    }));
    rocks.name = 'pedras-margem';
    rocks.castShadow = true; rocks.receiveShadow = true;
    group.add(rocks);
  }

  // ---------------- juncos e taboas (dentro da água, junto à margem: coincidem com os colisores de água)
  {
    const blades = [];
    const tops = [];
    const addClump = (x, z, n, hMax) => {
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = r() * 0.12;
        blades.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, h: hMax * (0.55 + r() * 0.45), lean: (r() - 0.5) * 0.35, rot: r() * Math.PI * 2, c: r() });
      }
      const nt = 1 + Math.floor(r() * 3);
      for (let i = 0; i < nt; i++) {
        const a = r() * Math.PI * 2, d = r() * 0.08;
        tops.push({ x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, h: hMax * (0.8 + r() * 0.3) });
      }
    };
    for (let a = 0; a < Math.PI * 2; a += 0.2 + r() * 0.25) {
      const re = findEdge(a, 3.2, 1.6);
      if (re == null) continue;
      const x = C.x + Math.cos(a) * (re - 0.1), z = C.z + Math.sin(a) * (re - 0.1);
      if (onBridge(x, z, 0.35) || gooseBank(x, z)) continue;
      // mais altos ao norte/leste (fundo), baixos ao sul (primeiro plano)
      const south = z > 1.2;
      if (r() < 0.25) continue;
      addClump(x, z, south ? 6 : 10, south ? 0.42 : 0.62 + r() * 0.2);
    }
    // um tufo na ilha (lado norte, longe do ninho e da pantufa)
    addClump(ISLAND.x - 0.45, ISLAND.z - 0.95, 7, 0.45);

    // lâmina de junco (fita afunilada curvada)
    const bladeGeo = (() => {
      const segs = 5, pos = [], hs = [], idx = [];
      for (let s = 0; s <= segs; s++) {
        const t = s / segs, w = 0.012 * (1 - t * 0.85);
        pos.push(-w, t, 0, w, t, 0); hs.push(t, t);
      }
      for (let s = 0; s < segs; s++) { const i = s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    })();
    const reedMat = mat('f3-reed', () => {
      const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide });
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
            { float ph = uTime * 1.3 + mvPosition.x * 1.7 + mvPosition.z * 1.1;
              float k = aH * aH * 0.05;
              mvPosition.x += sin(ph) * k; mvPosition.z += cos(ph * 0.8) * k * 0.6; }
            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vH;')
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.45, 1.15, vH);');
      };
      m.customProgramCacheKey = () => 'f3-reed';
      return m;
    });
    const im = new THREE.InstancedMesh(bladeGeo, reedMat, blades.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    const cA = new THREE.Color('#4d6b2c'), cB = new THREE.Color('#9aa457');
    blades.forEach((b, i) => {
      e.set(b.lean, b.rot, b.lean * 0.5);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(b.x, field.waterY - 0.02, b.z), q, new THREE.Vector3(1 + b.c * 0.6, b.h, 1));
      im.setMatrixAt(i, m4);
      col.copy(cA).lerp(cB, b.c * 0.7);
      im.setColorAt(i, col);
    });
    im.castShadow = false; im.receiveShadow = true;
    im.name = 'juncos';
    group.add(im);
    // taboas (espigas marrons)
    const stemGeo = new THREE.CylinderGeometry(0.004, 0.005, 1, 4).translate(0, 0.5, 0);
    const headGeo = new THREE.CapsuleGeometry(0.016, 0.07, 3, 6);
    const stems = new THREE.InstancedMesh(stemGeo, mat('f3-cattail-stem', () => new THREE.MeshStandardMaterial({ color: '#5f6e33', roughness: 0.85 })), tops.length);
    const heads = new THREE.InstancedMesh(headGeo, mat('f3-cattail', () => new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.95 })), tops.length);
    tops.forEach((tp, i) => {
      m4.compose(new THREE.Vector3(tp.x, field.waterY, tp.z), q.identity(), new THREE.Vector3(1, tp.h, 1));
      stems.setMatrixAt(i, m4);
      m4.makeTranslation(tp.x, field.waterY + tp.h - 0.02, tp.z);
      heads.setMatrixAt(i, m4);
    });
    group.add(stems, heads);
  }

  // ---------------- vitórias-régias (folhas com fenda) e algumas flores de lótus
  const lilyPads = [];
  {
    const shape = new THREE.Shape();
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const a = 0.32 + (i / N) * (Math.PI * 2 - 0.64);
      const rr = 1 + Math.sin(a * 5) * 0.03;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i === 0 ? shape.moveTo(0, 0) : null;
      shape.lineTo(x, y);
    }
    shape.lineTo(0, 0);
    const padGeo = new THREE.ShapeGeometry(shape, 1).rotateX(-Math.PI / 2);
    paint(padGeo, (p) => new THREE.Color('#3f6b2a').lerp(new THREE.Color('#78a043'), Math.min(1, Math.hypot(p.x, p.z) * 0.9)));
    const pads = [];
    const tryPad = (x, z, s) => {
      if (field.sdf(x, z) > -0.12 - s || onBridge(x, z, 0.2)) return false;
      for (const p of pads) if (Math.hypot(p.x - x, p.z - z) < (p.s + s) * 1.1) return false;
      pads.push({ x, z, s, rot: r() * Math.PI * 2 });
      return true;
    };
    // grupinhos espalhados (sem cobrir o reflexo da ponte)
    const centers = [[4.6, -2.2], [5.2, 0.3], [2.4, 1.3], [3.9, 1.5], [2.0, -2.3], [4.3, -2.8], [1.0, 0.6]];
    for (const [cx, cz] of centers) {
      for (let k = 0; k < 9; k++) tryPad(cx + (r() - 0.5) * 0.7, cz + (r() - 0.5) * 0.7, 0.07 + r() * 0.07);
    }
    const im = new THREE.InstancedMesh(padGeo, mat('f3-lily', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide })), pads.length);
    const m4 = new THREE.Matrix4();
    pads.forEach((p, i) => {
      m4.makeRotationY(p.rot);
      m4.scale(new THREE.Vector3(p.s, 1, p.s));
      m4.setPosition(p.x, field.waterY + 0.004, p.z);
      im.setMatrixAt(i, m4);
    });
    im.receiveShadow = true;
    im.name = 'vitorias-regias';
    group.add(im);
    lilyPads.push(...pads);
    // flores (pétalas em taça, levemente emissivas: brilham ao luar)
    const petal = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
    petal.scale(0.016, 0.03, 0.04);
    petal.translate(0, 0, 0.03);
    const flowerParts = [];
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 6 : 8;
      for (let k = 0; k < n; k++) {
        const g = petal.clone();
        g.rotateX(ring ? -0.5 : -1.05);
        g.rotateY((k / n) * Math.PI * 2 + ring * 0.3);
        if (ring) g.scale(0.75, 0.9, 0.75);
        flowerParts.push(g);
      }
    }
    const center = new THREE.SphereGeometry(0.012, 8, 6);
    center.translate(0, 0.012, 0);
    paint(center, '#f4cf48');
    flowerParts.forEach((g) => paint(g, (p) => new THREE.Color('#fff2f6').lerp(new THREE.Color('#f28db1'), Math.min(1, p.y * 30))));
    const fgeo = mergeGeometries([...flowerParts.map((g) => { g.deleteAttribute('uv'); return g; }), (() => { center.deleteAttribute('uv'); return center; })()]);
    const flowers = pads.filter((_, i) => i % 3 === 0).slice(0, 9);
    const fim = new THREE.InstancedMesh(fgeo, mat('f3-lotus', () => new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.6, emissive: '#ffb3cf', emissiveIntensity: 0.12,
    })), flowers.length);
    flowers.forEach((p, i) => {
      m4.makeRotationY(p.rot);
      m4.setPosition(p.x + Math.cos(p.rot) * p.s * 0.35, field.waterY + 0.006, p.z + Math.sin(p.rot) * p.s * 0.35);
      fim.setMatrixAt(i, m4);
    });
    group.add(fim);
  }

  return { group, water, lilyPads };
}

// ------------------------------------------------------------------ ponte de madeira em arco suave
export function buildBridge(layout, field) {
  const B = layout.BRIDGE;
  const g = new THREE.Group();
  g.name = 'ponte';
  const zc = (B.zMin + B.zMax) / 2, W = B.zMax - B.zMin;
  const xa = B.x0 - 0.06, xb = B.x1 + 0.06, xm = (xa + xb) / 2, L = xb - xa;
  const deckMat = woodMat('#a77c52', { key: 'f3-bridge-deck', rough: 0.72 });
  const beamMat = woodMat('#7a5636', { key: 'f3-bridge-beam', rough: 0.8 });
  const railMat = woodMat('#94693f', { key: 'f3-bridge-rail', rough: 0.7 });
  const camber = (x) => 0.026 * Math.sin(Math.PI * THREE.MathUtils.clamp((x - xa) / L, 0, 1));
  // tábuas (largura ao longo de X, comprimento ao longo de Z)
  const r = rng(77);
  const nPl = Math.round(L / 0.13);
  for (let i = 0; i < nPl; i++) {
    const x = xa + (i + 0.5) * (L / nPl);
    const pl = new THREE.Mesh(rbox(L / nPl - 0.012, 0.03, W + 0.08 + (r() - 0.5) * 0.04, 0.008), deckMat);
    pl.position.set(x, 0.012 + camber(x), zc + (r() - 0.5) * 0.02);
    pl.rotation.set((r() - 0.5) * 0.02, (r() - 0.5) * 0.03, Math.atan(0.026 * Math.PI / L * Math.cos(Math.PI * (x - xa) / L)));
    g.add(pl);
  }
  // vigas em arco por baixo das bordas (aparecem sobre a água)
  const arcPts = (zz, sag, y0) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const x = xa - 0.12 + t * (L + 0.24);
      pts.push(new THREE.Vector3(x, y0 + Math.sin(Math.PI * t) * sag, zz));
    }
    return pts;
  };
  for (const zz of [B.zMin + 0.06, B.zMax - 0.06]) {
    const beam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts(zz, 0.11, -0.12)), 24, 0.035, 6), beamMat);
    g.add(beam);
  }
  // travessas sob o deck
  for (let i = 0; i <= 4; i++) {
    const x = xa + 0.1 + (i / 4) * (L - 0.2);
    const cross = new THREE.Mesh(rbox(0.05, 0.05, W + 0.02, 0.01), beamMat);
    cross.position.set(x, -0.03 + camber(x) * 0.5, zc);
    g.add(cross);
  }
  // estacas na água (meio) e nas cabeceiras
  for (const x of [xm - 0.05]) for (const zz of [B.zMin + 0.04, B.zMax - 0.04]) {
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.42, 8), beamMat);
    pile.position.set(x, -0.2, zz);
    g.add(pile);
  }
  // postes e corrimão em arco (coincidem com ponte-guarda-norte/sul)
  const railTopY = (x) => 0.5 + 0.09 * Math.sin(Math.PI * THREE.MathUtils.clamp((x - B.x0) / (B.x1 - B.x0), 0, 1));
  const posts = [B.x0, B.x0 + (B.x1 - B.x0) * 0.5, B.x1];
  const railCurves = [];
  for (const zz of [B.zMin, B.zMax]) {
    for (const x of posts) {
      const h = railTopY(x) + 0.02;
      const post = new THREE.Mesh(rbox(0.075, h + 0.05, 0.075, 0.012), beamMat);
      post.position.set(x, h / 2 - 0.02, zz);
      g.add(post);
      const cap = new THREE.Mesh(rbox(0.1, 0.03, 0.1, 0.01), railMat);
      cap.position.set(x, h + 0.02, zz);
      g.add(cap);
    }
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const x = B.x0 + (i / 20) * (B.x1 - B.x0);
      pts.push(new THREE.Vector3(x, railTopY(x), zz));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    railCurves.push(curve);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.026, 6), railMat);
    g.add(rail);
    // travessa do meio e balaústres
    const mid = [];
    for (let i = 0; i <= 20; i++) {
      const x = B.x0 + (i / 20) * (B.x1 - B.x0);
      mid.push(new THREE.Vector3(x, 0.24 + camber(x), zz));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mid), 24, 0.016, 5), railMat));
    for (let i = 1; i < 12; i++) {
      const x = B.x0 + (i / 12) * (B.x1 - B.x0);
      if (Math.abs(x - posts[1]) < 0.06) continue;
      const top = railTopY(x), bot = 0.03 + camber(x);
      const bal = new THREE.Mesh(rbox(0.022, top - bot, 0.022, 0.006), railMat);
      bal.position.set(x, (top + bot) / 2, zz);
      g.add(bal);
    }
  }
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, railCurves, railTopY };
}
