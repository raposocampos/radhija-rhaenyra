// FASE 7 · Chão da pracinha depois da chuva: gramado com manchas molhadas (mapa de cor procedural), tufos de
// grama com vento, piso emborrachado do parquinho em placas coloridas e brilhosas de chuva, calçada de pedra
// portuguesa em ondas do piquenique até o portão, e poças d'água que refletem o céu.
// Medidas do layout (FENCE, PUDDLES, PICNIC, GATE); nada de assets: texturas em canvas.
import * as THREE from 'three';
import { shared, rng, fbm2, vnoise2, smoothstep, canvasTexture, mergeGeometries, rippleNormalTexture, mat } from '../../../world/util.js';

const R = { x0: -15, x1: 15, z0: -12, z1: 11 };
const MW = 360, MH = 276;

/** Linha central da calçada (do piquenique ao portão e para o leste), em pontos [x, z]. */
export const WALK = [[-3.35, 2.45], [-2.4, 2.62], [-1.0, 2.66], [0.6, 2.6], [1.9, 2.5], [3.2, 2.6], [4.6, 2.75], [6.6, 2.8]];
export const WALK_WIDTH = 0.92;

/** Distância de (x, z) até a calçada (polilinha). */
function walkDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < WALK.length - 1; i++) {
    const [ax, az] = WALK[i], [bx, bz] = WALK[i + 1];
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    best = Math.min(best, Math.hypot(x - (ax + vx * t), z - (az + vz * t)));
  }
  return best;
}
const puddleField = (layout, x, z) => {
  let m = 0;
  for (const p of layout.PUDDLES) {
    const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
    const dx = x - p.x, dz = z - p.z;
    const u = (cs * dx + sn * dz) / (p.rx * 1.6), v = (-sn * dx + cs * dz) / (p.rz * 1.8);
    m = Math.max(m, 1 - Math.min(1, Math.sqrt(u * u + v * v)));
  }
  return m;
};

/** Gramado molhado da manhã: verdes variados, manchas encharcadas, terra batida perto das árvores e da calçada. */
const LAWN = { a: new THREE.Color('#5f8f3c'), b: new THREE.Color('#7fab4a'), c: new THREE.Color('#a3c15c'), wet: new THREE.Color('#41682e'), soil: new THREE.Color('#6b5638') };
/** Cor do gramado em (x, z), em espaço linear (a textura e os tufos usam a mesma). */
function lawnColor(layout, x, z, out) {
  const n = fbm2(x * 0.45, z * 0.45, 4);
  const fine = vnoise2(x * 3.1, z * 3.1);
  out.copy(LAWN.a).lerp(LAWN.b, smoothstep(0.3, 0.62, n)).lerp(LAWN.c, smoothstep(0.62, 0.8, n) * 0.55);
  out.multiplyScalar(0.92 + fine * 0.16);
  // encharcado: perto das poças e em manchas baixas do terreno
  const wet = Math.max(puddleField(layout, x, z), smoothstep(0.6, 0.74, fbm2(x * 0.3 + 7, z * 0.3 - 3, 3)) * 0.45);
  out.lerp(LAWN.wet, wet * 0.45);
  // terra batida: em volta das árvores; grama gasta na borda da calçada
  let soil = 0;
  for (const t of layout.TREES) soil = Math.max(soil, 1 - smoothstep(0.25, 0.65, Math.hypot(x - t.x, z - t.z)));
  soil = Math.max(soil, (1 - smoothstep(WALK_WIDTH / 2, WALK_WIDTH / 2 + 0.2, walkDist(x, z))) * 0.3 * (0.6 + 0.4 * fine));
  return out.lerp(LAWN.soil, soil * 0.7);
}

function lawnTexture(layout) {
  const col = new THREE.Color();
  return canvasTexture(MW, MH, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) {
      const z = R.z0 + ((j + 0.5) / h) * (R.z1 - R.z0);
      for (let i = 0; i < w; i++) {
        const x = R.x0 + ((i + 0.5) / w) * (R.x1 - R.x0);
        // a cor é linear e a textura é sRGB: converte antes de gravar (senão o gramado escurece duas vezes)
        lawnColor(layout, x, z, col).convertLinearToSRGB();
        const k = (j * w + i) * 4; // linha 0 do canvas = norte (v = 1 depois do flipY)
        img.data[k] = Math.min(255, col.r * 255);
        img.data[k + 1] = Math.min(255, col.g * 255);
        img.data[k + 2] = Math.min(255, col.b * 255);
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, { repeat: false });
}

/** Piso emborrachado: placas de 0,5 m em cores de parquinho, rejunte e brilho de chuva irregular. */
function rubberTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    // cores de parquinho, mas gastas e molhadas (o vermelho-tijolo domina, verde e azul aparecem salteados)
    const cols = ['#a65a48', '#a65a48', '#6f8a64', '#a65a48', '#5f7d92', '#a65a48', '#b98f52', '#6f8a64'];
    const r = rng(17);
    const n = 4; // 4 x 4 placas por repetição (2 m)
    const s = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.fillStyle = cols[(i * 5 + j * 3 + ((i * j) % 3)) % cols.length];
      g.fillRect(i * s, j * s, s, s);
      // grânulos de borracha
      for (let k = 0; k < 900; k++) {
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
        g.fillRect(i * s + r() * s, j * s + r() * s, 1.5, 1.5);
      }
    }
    g.strokeStyle = 'rgba(40,30,25,0.55)';
    g.lineWidth = 3;
    for (let k = 0; k <= n; k++) {
      g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, k * s); g.lineTo(w, k * s); g.stroke();
    }
  });
}
/** Rugosidade do piso molhado: manchas lisas (água parada) sobre a borracha fosca. */
function wetRoughTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = fbm2(x / 38, y / 38, 4);
      const rough = 0.35 + 0.55 * smoothstep(0.42, 0.62, v);
      const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = rough * 255;
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

/** Pedra portuguesa: pedrinhas brancas e pretas em ondas (como nos calçadões), rejunte escuro. */
function cobbleTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#5b544c';
    g.fillRect(0, 0, w, h);
    const r = rng(23);
    const cell = 9;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const cx = x + cell / 2, cy = y + cell / 2;
        // ondas ao longo da calçada (U = comprimento): duas faixas pretas sinuosas
        const u = cx / w, v = cy / h;
        const wave = Math.sin(u * Math.PI * 4) * 0.22;
        const band = Math.abs(((v - 0.5 - wave) * 2.6) % 1);
        const dark = band < 0.32;
        const shade = 0.88 + r() * 0.16;
        const base = dark ? [52, 50, 48] : [236, 230, 218];
        g.fillStyle = `rgb(${base[0] * shade},${base[1] * shade},${base[2] * shade})`;
        const jx = (r() - 0.5) * 2, jy = (r() - 0.5) * 2;
        const sw = cell - 1.6 - r() * 1.4, sh = cell - 1.6 - r() * 1.4;
        g.beginPath();
        g.moveTo(x + 1 + jx, y + 1 + jy);
        g.lineTo(x + 1 + sw + jx * 0.5, y + 1.3 + jy);
        g.lineTo(x + 0.8 + sw + jx, y + sh + jy * 0.5);
        g.lineTo(x + 1.3 + jx * 0.5, y + 0.9 + sh + jy);
        g.closePath();
        g.fill();
        if (!dark && r() < 0.35) {
          g.fillStyle = 'rgba(255,255,255,0.35)'; // brilho molhado
          g.fillRect(x + 2 + jx, y + 2 + jy, 2, 1);
        }
      }
    }
  });
}

/** Faixa ao longo da polilinha (UV: u = metros ao longo, v = 0..1 na largura). */
function ribbonGeometry(points, width, y) {
  const pos = [], uv = [], idx = [];
  // reamostra a polilinha suavizada (Catmull-Rom)
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const N = 120;
  let len = 0;
  let prev = curve.getPoint(0);
  for (let i = 0; i <= N; i++) {
    const p = curve.getPoint(i / N);
    len += p.distanceTo(prev);
    prev = p;
    const t = curve.getTangent(i / N);
    const nx = -t.z, nz = t.x;
    const wob = (vnoise2(len * 1.7, 3.1) - 0.5) * 0.06;
    for (const side of [-1, 1]) {
      pos.push(p.x + nx * side * (width / 2 + wob), y, p.z + nz * side * (width / 2 + wob));
      uv.push(len / 2.0, side < 0 ? 0 : 1);
    }
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // virado para cima
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Meio-fio de concreto dos dois lados da calçada. */
function curbGeometry(points, width) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const parts = [];
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const p = curve.getPoint(i / 80);
      const t = curve.getTangent(i / 80);
      pts.push(new THREE.Vector3(p.x - t.z * side * (width / 2 + 0.035), 0.012, p.z + t.x * side * (width / 2 + 0.035)));
    }
    const path = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(path, 80, 0.032, 5, false);
    g.scale(1, 0.55, 1);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

/** Material dos tufos: lâminas mais escuras na base, pontas claras e amareladas, vento pela altura (aH). */
const grassMat = () => mat('f7-grass-blades', () => {
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
          float ph = uTime * 1.9 + mvPosition.x * 0.8 + mvPosition.z * 0.55;
          float gust = 0.55 + 0.45 * sin(uTime * 0.45 + mvPosition.x * 0.2 - mvPosition.z * 0.13);
          float w = aH * aH;
          mvPosition.x += (sin(ph) * 0.6 + 0.5) * 0.04 * gust * w * (0.4 + mvPosition.y * 6.0);
          mvPosition.z += cos(ph * 0.8 + 1.1) * 0.018 * gust * w * (0.4 + mvPosition.y * 6.0);
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
  m.customProgramCacheKey = () => 'f7-grass-blades';
  return m;
});

/** Tufo de lâminas curvas achatadas (altura 1, escalado por instância), com o atributo aH (0 na base … 1 na ponta). */
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
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const bend = lean * t * t;
      const cx = ox + Math.cos(a) * bend * 0.05, cz = oz + Math.sin(a) * bend * 0.05;
      const ww = wdt * (1 - t * 0.92);
      pos.push(cx - fx * ww, t * h, cz - fz * ww, cx + fx * ww, t * h, cz + fz * ww);
      hs.push(t, t);
      nor.push(0, 1, 0, 0, 1, 0);
    }
    for (let k = 0; k < segs; k++) {
      const i0 = base + k * 2;
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

/**
 * Tufos de grama instanciados (com vento): { x, y?, z, h (altura), r (0..1, giro e largura), color? }.
 * Sem cor, cada tufo pega a cor do gramado no lugar. tall: tufos altos (mais lâminas).
 * @param {{ x: number, y?: number, z: number, h: number, r: number, color?: THREE.Color }[]} list
 * @param {{ name?: string, tall?: boolean, layout?: import('../../../types').LevelLayout }} [opts]
 */
export function tuftMesh(list, { name = 'grama', tall = false, layout = null } = {}) {
  const geo = tuftGeometry(tall ? 9 : 6, tall ? 5 : 3);
  const im = new THREE.InstancedMesh(geo, grassMat(), list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const c = new THREE.Color();
  const widthScale = tall ? 1.6 : 1.25;
  list.forEach((t, i) => {
    e.set(0, t.r * Math.PI * 2, 0);
    q.setFromEuler(e);
    sc.set(widthScale * (0.8 + t.r * 0.5), t.h, widthScale * (0.8 + t.r * 0.5));
    p.set(t.x, t.y ?? 0, t.z);
    m4.compose(p, q, sc);
    im.setMatrixAt(i, m4);
    if (t.color) c.copy(t.color);
    else if (layout) lawnColor(layout, t.x, t.z, c);
    else c.set('#6f9a3e');
    im.setColorAt(i, c.multiplyScalar(1.12 + (t.r - 0.5) * 0.2));
  });
  im.instanceMatrix.needsUpdate = true;
  im.receiveShadow = true;
  im.castShadow = false;
  im.frustumCulled = false;
  im.name = name;
  return im;
}

/** Gramado denso (como nos jardins das fases 1 a 3): tufos baixos por toda parte, altos junto às bordas. */
function grassTufts(root, layout) {
  const B = layout.WORLD.bounds, F = layout.FENCE, M = layout.MOUND, P = layout.PICNIC;
  const solid = layout.STATIC_COLLIDERS.filter((c) => c.shape === 'circle' || (c.shape === 'box' && c.hx < 0.8 && c.hz < 0.8));
  const near = (x, z, pad) => solid.some((c) => (c.shape === 'circle'
    ? Math.hypot(x - c.x, z - c.z) < c.r + pad
    : Math.abs(x - c.x) < c.hx + pad && Math.abs(z - c.z) < c.hz + pad));
  const r = rng(77);
  const low = [], tall = [];
  const step = 0.12;
  for (let z = B.minZ - 0.9; z < B.maxZ + 1.4; z += step) {
    for (let x = B.minX - 0.9; x < B.maxX + 0.9; x += step) {
      const px = x + (r() - 0.5) * step * 1.3, pz = z + (r() - 0.5) * step * 1.3;
      if (px > F.west - 0.04 && pz < F.south + 0.04) continue; // piso do parquinho
      if (Math.abs(px - M.x) < M.hx + 0.12 && Math.abs(pz - M.z) < M.hz + 0.12) continue; // o morrinho tem os seus
      if (walkDist(px, pz) < WALK_WIDTH / 2 + 0.05 || puddleField(layout, px, pz) > 0.25) continue;
      if (Math.abs(px - P.x) < P.hx + 0.06 && Math.abs(pz - P.z) < P.hz + 0.06) continue;
      if (near(px, pz, 0.02)) continue;
      const edge = near(px, pz, 0.28) || px < B.minX + 0.2 || px > B.maxX - 0.2 || pz < B.minZ + 0.2
        || (px < F.west && px > F.west - 0.22 && pz < F.south) || (pz > F.south && pz < F.south + 0.22 && px > F.west);
      // perto de um petisco a grama fica baixa, para ele não sumir no meio dela
      const treat = layout.COLLECTIBLES.some((c) => Math.hypot(px - c.x, pz - c.z) < 0.4);
      if (edge && r() < 0.85) tall.push({ x: px, z: pz, h: treat ? 0.08 + r() * 0.03 : 0.12 + r() * 0.15, r: r() });
      else if (r() < 0.85) low.push({ x: px, z: pz, h: 0.045 + r() * 0.04, r: r() });
    }
  }
  const lowMesh = tuftMesh(low, { name: 'grama-baixa', layout });
  const tallMesh = tuftMesh(tall, { name: 'grama-alta', tall: true, layout });
  root.add(lowMesh, tallMesh);
  return { lowMesh, tallMesh, count: low.length + tall.length };
}

/** Poças: água rasa que reflete o céu, com ondinhas e a borda escura de terra molhada. */
function buildPuddles(root, layout) {
  const ripple = rippleNormalTexture().clone();
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.repeat.set(2.5, 2.5);
  const water = new THREE.MeshPhysicalMaterial({
    color: '#4b5f6b', roughness: 0.04, metalness: 0.35, transparent: true, opacity: 0.78, envMapIntensity: 1.6,
    normalMap: ripple, normalScale: new THREE.Vector2(0.18, 0.18), clearcoat: 1, clearcoatRoughness: 0.05,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  const rim = new THREE.MeshStandardMaterial({ color: '#2d2a1c', transparent: true, opacity: 0.35, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const group = new THREE.Group();
  group.name = 'pocas';
  for (const [i, p] of layout.PUDDLES.entries()) {
    // contorno irregular
    const shape = new THREE.Shape();
    const N = 28;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const wob = 1 + (vnoise2(Math.cos(a) * 2 + i * 5, Math.sin(a) * 2) - 0.5) * 0.35;
      const x = Math.cos(a) * p.rx * wob, z = Math.sin(a) * p.rz * wob;
      if (k === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
    }
    const geo = new THREE.ShapeGeometry(shape, 2).rotateX(-Math.PI / 2);
    // UV no plano para as ondinhas
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let k = 0; k < pos.count; k++) { uv[k * 2] = pos.getX(k) * 1.4; uv[k * 2 + 1] = pos.getZ(k) * 1.4; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(geo, water);
    m.position.set(p.x, 0.009, p.z);
    m.rotation.y = -p.rot;
    m.receiveShadow = true;
    const ring = new THREE.Mesh(geo.clone().scale(1.22, 1, 1.28), rim);
    ring.position.set(p.x, 0.0075, p.z);
    ring.rotation.y = -p.rot;
    group.add(ring, m);
  }
  root.add(group);
  return {
    group,
    update(t) {
      ripple.offset.set(Math.sin(t * 0.21) * 0.3, t * 0.025);
    },
  };
}

/** @param {THREE.Group} root @param {import('../../../types').LevelLayout} layout */
export function buildGround(root, layout) {
  const group = new THREE.Group();
  group.name = 'chao';
  // gramado
  const lawnMat = new THREE.MeshStandardMaterial({ map: lawnTexture(layout), roughness: 0.92 });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0).rotateX(-Math.PI / 2), lawnMat);
  lawn.position.set((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
  lawn.receiveShadow = true;
  lawn.name = 'gramado';
  group.add(lawn);
  // piso emborrachado do parquinho (de cerca a cerca, até depois dos limites norte e leste)
  const F = layout.FENCE, B = layout.WORLD.bounds;
  const px0 = F.west + 0.02, px1 = B.maxX + 0.9, pz0 = B.minZ - 0.9, pz1 = F.south - 0.02;
  const rubberMap = rubberTexture();
  rubberMap.repeat.set((px1 - px0) / 2, (pz1 - pz0) / 2);
  const rough = wetRoughTexture();
  rough.repeat.set((px1 - px0) / 3.1, (pz1 - pz0) / 3.1);
  const rubber = new THREE.Mesh(
    new THREE.PlaneGeometry(px1 - px0, pz1 - pz0).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: rubberMap, roughness: 1, roughnessMap: rough, envMapIntensity: 1.2 }),
  );
  rubber.position.set((px0 + px1) / 2, 0.004, (pz0 + pz1) / 2);
  rubber.receiveShadow = true;
  rubber.name = 'piso-emborrachado';
  group.add(rubber);
  // calçada de pedra portuguesa com meio-fio
  const cob = cobbleTexture();
  cob.wrapS = THREE.RepeatWrapping;
  const walk = new THREE.Mesh(ribbonGeometry(WALK, WALK_WIDTH, 0.006), new THREE.MeshStandardMaterial({ map: cob, roughness: 0.55, envMapIntensity: 1.1 }));
  walk.receiveShadow = true;
  walk.name = 'calcada';
  const curb = new THREE.Mesh(curbGeometry(WALK, WALK_WIDTH), new THREE.MeshStandardMaterial({ color: '#c9c2b4', roughness: 0.8 }));
  curb.receiveShadow = true;
  curb.castShadow = true;
  group.add(walk, curb);
  const tufts = grassTufts(group, layout);
  const puddles = buildPuddles(group, layout);
  root.add(group);
  return {
    group, tufts,
    update(dt, t) {
      puddles.update(t);
    },
  };
}
