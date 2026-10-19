// FASE 10 · Chão do quintal no fim de tarde: gramado aparado com o tom quente do pôr do sol (mapa de cor procedural:
// verdes variados, grama mais alta e escura nas bordas, terra batida no pé da árvore e no portãozinho), a trilha de
// pedras da varanda até o portão e do portão até a casa na árvore e a horta, a terra fofa da horta com sulcos, a
// lama brilhante do canteiro, o piso de cimento do galpão e tufos de grama instanciados que balançam com o vento.
// Medidas do layout (HOUSE, PORCH, POOL, HORTA, MUD, SHED, BACK_FENCE, TREE…); nada de assets: texturas em canvas.
import * as THREE from 'three';
import { shared, rng, fbm2, vnoise2, smoothstep, canvasTexture, mergeGeometries, rippleNormalTexture, mat } from '../../../world/util.js';

/** Área do gramado (passa dos limites para a câmera não ver a borda). */
const R = { x0: -16, x1: 16, z0: -9, z1: 8.5 };
const MW = 384, MH = 208;

/** Trilha de pedras: da escadinha da varanda até o portão e, do outro lado, até a casa na árvore e a horta. */
export const STONES = [
  [-2.3, -2.25], [-1.85, -1.7], [-0.95, -1.35], [-0.05, -1.05], [0.85, -0.7], [1.75, -0.45], [2.65, -0.2], [3.5, 0.0],
  [4.35, 0.12], [4.95, 0.18],
  [5.85, 0.16], [6.45, -0.25], [6.95, -0.85], [7.35, -1.5], [7.8, -2.1], [8.35, -2.6],
  [6.5, 0.55], [6.2, 1.2],
];
const stoneField = (x, z) => {
  let m = 0;
  for (const [sx, sz] of STONES) m = Math.max(m, 1 - Math.min(1, Math.hypot(x - sx, z - sz) / 0.42));
  return m;
};

/** Cores do gramado (linear): o verde fica dourado no lado do sol e azulado na sombra que chega. */
const LAWN = {
  a: new THREE.Color('#58873a'), b: new THREE.Color('#79a447'), c: new THREE.Color('#a4be5a'),
  dry: new THREE.Color('#9a9a52'), deep: new THREE.Color('#3f6a2c'), soil: new THREE.Color('#6e5638'),
};

function inside(layout, x, z) {
  const { HOUSE, PORCH, HORTA, SHED } = layout;
  if (x < HOUSE.x1 + 0.12 && z < HOUSE.zS + 0.12) return 'house';
  if (x > PORCH.x0 - 0.05 && x < PORCH.x1 + 0.05 && z < PORCH.z1 + 0.05) return 'porch';
  if (x > SHED.x0 - 0.05 && x < SHED.x1 + 0.05 && z > SHED.z0 - 0.05 && z < SHED.z1 + 0.05) return 'shed';
  if (x > HORTA.x0 && x < HORTA.x1 && z > HORTA.z0 && z < HORTA.z1) return 'horta';
  return null;
}

/** Cor do gramado em (x, z), em espaço linear (a textura e os tufos usam a mesma). */
function lawnColor(layout, x, z, out) {
  const n = fbm2(x * 0.42, z * 0.42, 4);
  const fine = vnoise2(x * 3.3, z * 3.3);
  out.copy(LAWN.a).lerp(LAWN.b, smoothstep(0.32, 0.62, n)).lerp(LAWN.c, smoothstep(0.62, 0.82, n) * 0.5);
  out.multiplyScalar(0.92 + fine * 0.16);
  // manchas secas (o verão) e as bordas mais escuras, onde ninguém pisa
  out.lerp(LAWN.dry, smoothstep(0.62, 0.78, fbm2(x * 0.25 + 9, z * 0.25 - 4, 3)) * 0.35);
  const B = layout.WORLD.bounds;
  const edge = Math.min(x - B.minX, B.maxX - x, z - B.minZ, B.maxZ - z);
  out.lerp(LAWN.deep, (1 - smoothstep(0, 1.2, edge)) * 0.45);
  // terra batida: no pé da árvore, no portãozinho (todo mundo passa) e em volta da piscininha
  const { TREE, BACK_FENCE, POOL } = layout;
  let soil = 1 - smoothstep(0.35, 1.15, Math.hypot(x - TREE.x, z - TREE.z));
  const gz = (BACK_FENCE.gate.z0 + BACK_FENCE.gate.z1) / 2;
  soil = Math.max(soil, (1 - smoothstep(0.2, 0.9, Math.hypot(x - BACK_FENCE.x, z - gz))) * 0.75);
  const pr = Math.hypot(x - POOL.x, z - POOL.z);
  soil = Math.max(soil, (smoothstep(POOL.r - 0.05, POOL.r + 0.12, pr) * (1 - smoothstep(POOL.r + 0.12, POOL.r + 0.5, pr))) * 0.35);
  soil = Math.max(soil, stoneField(x, z) * 0.5 * (0.6 + 0.4 * fine));
  return out.lerp(LAWN.soil, soil * 0.75);
}

function lawnTexture(layout) {
  const col = new THREE.Color();
  return canvasTexture(MW, MH, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) {
      const z = R.z0 + ((j + 0.5) / h) * (R.z1 - R.z0);
      for (let i = 0; i < w; i++) {
        const x = R.x0 + ((i + 0.5) / w) * (R.x1 - R.x0);
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

/** Pedra chata de jardim (seixo largo, beirada arredondada), achatada e com relevo leve. */
function stoneGeometry(seed) {
  const r = rng(seed);
  const g = new THREE.CylinderGeometry(1, 1, 1, 18, 1);
  const p = g.attributes.position;
  const sx = 0.22 + r() * 0.08, sz = 0.17 + r() * 0.07;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const wob = 1 + (vnoise2(Math.cos(a) * 1.8 + seed, Math.sin(a) * 1.8) - 0.5) * 0.35;
    const top = y > 0;
    const k = top ? 0.88 : 1;
    p.setXYZ(i, x * sx * wob * k, top ? 0.032 + (vnoise2(x * 4 + seed, z * 4) - 0.5) * 0.008 : -0.01, z * sz * wob * k);
  }
  g.computeVertexNormals();
  return g;
}
function stoneTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(81);
    g.fillStyle = '#b7aa98'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) {
      const v = 150 + r() * 70;
      g.fillStyle = `rgba(${v},${v * 0.95},${v * 0.86},0.35)`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    g.fillStyle = 'rgba(90,110,60,0.18)'; // limo
    for (let k = 0; k < 30; k++) { g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 6, 0, Math.PI * 2); g.fill(); }
  });
}

/** Terra fofa da horta: sulcos escuros ao longo de X, torrões e palhinha. */
function soilTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(61);
    g.fillStyle = '#5d4128'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const furrow = 0.5 + 0.5 * Math.sin((y / h) * Math.PI * 8);
      g.fillStyle = `rgba(30,18,8,${0.32 * furrow})`;
      g.fillRect(0, y, w, 1);
    }
    for (let k = 0; k < 1400; k++) {
      const v = r();
      g.fillStyle = v < 0.5 ? 'rgba(120,88,58,0.5)' : 'rgba(40,26,14,0.45)';
      const s = 1 + r() * 3;
      g.fillRect(r() * w, r() * h, s, s);
    }
    g.strokeStyle = 'rgba(214,190,120,0.55)'; // palhinha
    g.lineWidth = 1;
    for (let k = 0; k < 70; k++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); g.stroke();
    }
  });
}

/** Lama do canteiro: marrom escuro brilhante com poças rasas e marcas de patinha. */
function mudTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(19);
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm2(x / 40, y / 40, 4);
      const wet = smoothstep(0.5, 0.62, n);
      const k = (y * w + x) * 4;
      img.data[k] = 78 - wet * 26 + n * 18;
      img.data[k + 1] = 52 - wet * 16 + n * 12;
      img.data[k + 2] = 30 - wet * 6 + n * 8;
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // patinhas (quem já passou por ali)
    g.fillStyle = 'rgba(28,16,8,0.55)';
    for (let k = 0; k < 7; k++) {
      const cx = 30 + r() * 196, cy = 30 + r() * 196;
      g.beginPath(); g.ellipse(cx, cy, 6, 7, 0, 0, Math.PI * 2); g.fill();
      for (let t = 0; t < 4; t++) {
        const a = -Math.PI / 2 + (t - 1.5) * 0.55;
        g.beginPath(); g.ellipse(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 2.6, 3.2, a, 0, Math.PI * 2); g.fill();
      }
    }
  }, { repeat: false });
}
function mudRoughTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm2(x / 20, y / 20, 4);
      const v = 0.15 + 0.7 * (1 - smoothstep(0.48, 0.62, n));
      const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v * 255;
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false, repeat: false });
}

/** Cimento queimado do galpão: manchas de óleo, poeira e a junta de dilatação. */
function concreteTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(29);
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm2(x / 50, y / 50, 4);
      const v = 150 + n * 40 + (r() - 0.5) * 10;
      const k = (y * w + x) * 4;
      img.data[k] = v; img.data[k + 1] = v * 0.97; img.data[k + 2] = v * 0.92; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = 'rgba(40,36,30,0.22)';
    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 22, 6 + r() * 12, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(60,54,46,0.5)';
    g.fillRect(0, h / 2 - 1, w, 2);
    g.fillRect(w / 2 - 1, 0, 2, h);
  });
}

/** Material dos tufos: lâminas mais escuras na base, pontas douradas pelo sol baixo, vento pela altura (aH). */
const grassMat = () => mat('f10-grass-blades', () => {
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
          float ph = uTime * 1.7 + mvPosition.x * 0.8 + mvPosition.z * 0.55;
          float gust = 0.55 + 0.45 * sin(uTime * 0.4 + mvPosition.x * 0.2 - mvPosition.z * 0.13);
          float w = aH * aH;
          mvPosition.x += (sin(ph) * 0.6 + 0.5) * 0.035 * gust * w * (0.4 + mvPosition.y * 6.0);
          mvPosition.z += cos(ph * 0.8 + 1.1) * 0.016 * gust * w * (0.4 + mvPosition.y * 6.0);
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.74, 1.2, vH);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.2, 1.06, 0.7), smoothstep(0.55, 1.0, vH) * 0.55);`);
  };
  m.customProgramCacheKey = () => 'f10-grass-blades';
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
 * Tufos de grama instanciados (com vento): { x, y?, z, h, r (0..1), color? }. Sem cor, pega a cor do gramado.
 * @param {{ x: number, y?: number, z: number, h: number, r: number, color?: THREE.Color }[]} list
 * @param {{ name?: string, tall?: boolean, layout?: import('../../../types').LevelLayout }} [opts]
 */
export function tuftMesh(list, { name = 'grama', tall = false, layout = null } = {}) {
  const geo = tuftGeometry(tall ? 8 : 5, tall ? 5 : 3);
  const im = new THREE.InstancedMesh(geo, grassMat(), Math.max(1, list.length));
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
  im.count = list.length;
  im.instanceMatrix.needsUpdate = true;
  im.receiveShadow = true;
  im.castShadow = false;
  im.frustumCulled = false;
  im.name = name;
  return im;
}

/**
 * Gramado: tufos baixos por toda parte, altos junto às cercas, aos troncos e às bordas. O quintal é grande (24 × 10 m):
 * a malha é mais aberta que a da pracinha e só cobre a área de jogo com uma margem curta, para caber no celular.
 */
function grassTufts(root, layout) {
  const B = layout.WORLD.bounds;
  const { POOL, HOSE, BACK_FENCE, HORTA } = layout;
  const solid = layout.STATIC_COLLIDERS.filter((c) => c.shape === 'circle' || (c.shape === 'box' && c.hx < 1.0 && c.hz < 1.0));
  const near = (x, z, pad) => solid.some((c) => (c.shape === 'circle'
    ? Math.hypot(x - c.x, z - c.z) < c.r + pad
    : Math.abs(x - c.x) < c.hx + pad && Math.abs(z - c.z) < c.hz + pad));
  const hoseD = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < HOSE.length - 1; i++) {
      const a = HOSE[i], b = HOSE[i + 1];
      const vx = b.x - a.x, vz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
      best = Math.min(best, Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t)));
    }
    return best;
  };
  const r = rng(101);
  const low = [], tall = [];
  const step = 0.155;
  for (let z = B.minZ - 0.3; z < B.maxZ + 1.0; z += step) {
    for (let x = B.minX - 0.4; x < B.maxX + 0.4; x += step) {
      const px = x + (r() - 0.5) * step * 1.3, pz = z + (r() - 0.5) * step * 1.3;
      if (inside(layout, px, pz)) continue;
      if (Math.hypot(px - POOL.x, pz - POOL.z) < POOL.r + 0.12) continue;
      if (stoneField(px, pz) > 0.35 || hoseD(px, pz) < 0.05) continue;
      if (near(px, pz, 0.02)) continue;
      const fence = Math.abs(px - BACK_FENCE.x) < 0.2 || Math.abs(px - HORTA.x0) < 0.16 && pz > HORTA.z0 || Math.abs(pz - HORTA.z0) < 0.16 && px > HORTA.x0 && px < HORTA.x1;
      const edge = fence || near(px, pz, 0.26) || px < B.minX + 0.25 || px > B.maxX - 0.25 || pz < B.minZ + 0.3 || pz > B.maxZ - 0.1;
      // perto de um petisco ou de um ponto de ação a grama fica baixa
      const treat = layout.COLLECTIBLES.some((c) => Math.hypot(px - c.x, pz - c.z) < 0.4);
      if (edge && r() < 0.85) tall.push({ x: px, z: pz, h: treat ? 0.08 + r() * 0.03 : 0.12 + r() * 0.15, r: r() });
      else if (r() < 0.8) low.push({ x: px, z: pz, h: 0.045 + r() * 0.035, r: r() });
    }
  }
  const lowMesh = tuftMesh(low, { name: 'grama-baixa', layout });
  const tallMesh = tuftMesh(tall, { name: 'grama-alta', tall: true, layout });
  root.add(lowMesh, tallMesh);
  return { lowMesh, tallMesh, count: low.length + tall.length };
}

/** @param {THREE.Group} root @param {import('../../../types').LevelLayout} layout */
export function buildGround(root, layout) {
  const group = new THREE.Group();
  group.name = 'chao';
  const { HORTA, MUD, SHED } = layout;
  // gramado
  const lawnMat = new THREE.MeshStandardMaterial({ map: lawnTexture(layout), roughness: 0.94 });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0).rotateX(-Math.PI / 2), lawnMat);
  lawn.position.set((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
  lawn.receiveShadow = true;
  lawn.name = 'gramado';
  group.add(lawn);

  // pedras da trilha (algumas giradas, meio afundadas na grama)
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#d6cbb8', map: stoneTexture(), roughness: 0.86 });
  const geos = [];
  STONES.forEach(([x, z], i) => {
    const g = stoneGeometry(i * 7 + 3);
    g.rotateY(i * 1.37);
    g.translate(x, 0, z);
    geos.push(g);
  });
  const stones = new THREE.Mesh(mergeGeometries(geos), stoneMat);
  stones.receiveShadow = true;
  stones.name = 'trilha-de-pedras';
  group.add(stones);

  // terra da horta (com sulcos) e a lama do canteiro, um pouco acima para não brigar com o gramado
  const soil = new THREE.Mesh(
    new THREE.PlaneGeometry(HORTA.x1 - HORTA.x0, HORTA.z1 - HORTA.z0 + 0.2).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: soilTexture(), roughness: 0.96 }),
  );
  soil.material.map.repeat.set((HORTA.x1 - HORTA.x0) / 1.2, (HORTA.z1 - HORTA.z0) / 1.2);
  soil.position.set((HORTA.x0 + HORTA.x1) / 2, 0.006, (HORTA.z0 + HORTA.z1 + 0.2) / 2);
  soil.receiveShadow = true;
  soil.name = 'terra-da-horta';
  group.add(soil);

  const mudShape = new THREE.Shape();
  const mw = MUD.x1 - MUD.x0, mh = MUD.z1 - MUD.z0;
  for (let k = 0; k <= 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    const wob = 1 + (vnoise2(Math.cos(a) * 2.2 + 4, Math.sin(a) * 2.2) - 0.5) * 0.22;
    const x = Math.cos(a) * mw * 0.56 * wob, z = Math.sin(a) * mh * 0.56 * wob;
    if (k === 0) mudShape.moveTo(x, z); else mudShape.lineTo(x, z);
  }
  const mudGeo = new THREE.ShapeGeometry(mudShape, 3).rotateX(-Math.PI / 2);
  const mp = mudGeo.attributes.position;
  const muv = new Float32Array(mp.count * 2);
  for (let k = 0; k < mp.count; k++) {
    muv[k * 2] = mp.getX(k) / (mw * 1.15) + 0.5;
    muv[k * 2 + 1] = mp.getZ(k) / (mh * 1.15) + 0.5;
    // a lama sobe um pouquinho no meio (lombada molhada)
    const d = Math.hypot(mp.getX(k) / (mw * 0.56), mp.getZ(k) / (mh * 0.56));
    mp.setY(k, 0.012 * (1 - Math.min(1, d)));
  }
  mudGeo.setAttribute('uv', new THREE.BufferAttribute(muv, 2));
  mudGeo.computeVertexNormals();
  const ripple = rippleNormalTexture().clone();
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.repeat.set(1.5, 1.5);
  const mud = new THREE.Mesh(mudGeo, new THREE.MeshPhysicalMaterial({
    map: mudTexture(), roughnessMap: mudRoughTexture(), roughness: 1, normalMap: ripple, normalScale: new THREE.Vector2(0.15, 0.15),
    clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 1.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  mud.position.set((MUD.x0 + MUD.x1) / 2, 0.01, (MUD.z0 + MUD.z1) / 2);
  mud.receiveShadow = true;
  mud.name = 'lama';
  group.add(mud);

  // piso do galpão (cimento) com a soleira de madeira na porta
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(SHED.x1 - SHED.x0, 0.04, SHED.z1 - SHED.z0),
    new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.82 }),
  );
  floor.material.map.repeat.set(1.4, 1.6);
  floor.position.set((SHED.x0 + SHED.x1) / 2, 0.0, (SHED.z0 + SHED.z1) / 2);
  floor.receiveShadow = true;
  floor.name = 'piso-do-galpao';
  group.add(floor);

  const tufts = grassTufts(group, layout);
  root.add(group);
  return {
    group, tufts, lawnColor: (x, z, out) => lawnColor(layout, x, z, out),
    update(dt, t) {
      ripple.offset.set(Math.sin(t * 0.15) * 0.2, t * 0.01);
    },
  };
}
