// Utilitários do Cenário: ruído, texturas procedurais, materiais e helpers de geometria.
// Tudo é gerado em código (sem assets externos).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { shareResource } from '../core/resources.js';

export { mergeGeometries, mergeVertices, RoundedBoxGeometry };

// Uniform de tempo compartilhado (vento, água, brilhos). Atualizado por environment.update.
export const shared = { time: { value: 0 } };

// Direção PARA o sol (normalizada) — preenchida pelo engine.
export const SUN_DIR = new THREE.Vector3(-0.62, 0.42, 0.38).normalize();

// ---------------------------------------------------------------- RNG / ruído
export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash2(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hash3(ix, iy, iz) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm2(x, y, oct = 4) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise2(x * f + i * 17.3, y * f - i * 9.1);
    n += a; a *= 0.5; f *= 2.03;
  }
  return v / n;
}
export function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c000 = hash3(ix, iy, iz), c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz), c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1), c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1), c111 = hash3(ix + 1, iy + 1, iz + 1);
  return l(l(l(c000, c100, ux), l(c010, c110, ux), uy), l(l(c001, c101, ux), l(c011, c111, ux), uy), uz);
}
export function fbm3(x, y, z, oct = 3) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise3(x * f + i * 7.1, y * f - i * 3.3, z * f + i * 5.7);
    n += a; a *= 0.5; f *= 2.07;
  }
  return v / n;
}
export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- texturas (canvas)
export function canvasTexture(w, h, draw, { srgb = true, repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// ruído de valor periódico (tileável): a grade se repete a cada `per` células
function pnoise2(x, y, per) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const m = (v) => ((v % per) + per) % per;
  const a = hash2(m(ix), m(iy)), b = hash2(m(ix + 1), m(iy)), c = hash2(m(ix), m(iy + 1)), d = hash2(m(ix + 1), m(iy + 1));
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function noiseFill(g, w, h, { base = 230, amp = 25, per = 8, oct = 4, seed = 0 } = {}) {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0, a = 0.5, n = 0, p = per;
    for (let o = 0; o < oct; o++) {
      v += a * pnoise2((x / w) * p + seed * 31, (y / h) * p, p);
      n += a; a *= 0.5; p *= 2;
    }
    const val = base + (v / n - 0.5) * 2 * amp;
    const i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = val; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

const _tex = {};
// Veio de madeira claro (tingido pela cor do material). Veio ao longo de U.
export function woodTexture() {
  if (_tex.wood) return _tex.wood;
  _tex.wood = canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#e9e2d6'; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 70; i++) {
      const y0 = r() * h, amp = 1 + r() * 3, fr = 0.004 + r() * 0.01;
      const shade = 150 + r() * 70;
      g.strokeStyle = `rgba(${shade * 0.86 | 0},${shade * 0.74 | 0},${shade * 0.6 | 0},${0.12 + r() * 0.25})`;
      g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = y0 + Math.sin(x * fr + i) * amp + (vnoise2(x * 0.02, i) - 0.5) * 4;
        x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    // nós
    for (let i = 0; i < 3; i++) {
      const x = r() * w, y = r() * h;
      const grd = g.createRadialGradient(x, y, 0, x, y, 6 + r() * 6);
      grd.addColorStop(0, 'rgba(110,80,50,0.45)'); grd.addColorStop(1, 'rgba(110,80,50,0)');
      g.fillStyle = grd; g.fillRect(x - 14, y - 14, 28, 28);
    }
  });
  return shareResource(_tex.wood);
}
export function woodTextureV() {
  if (_tex.woodV) return _tex.woodV;
  const t = woodTexture().clone();
  t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.needsUpdate = true;
  _tex.woodV = t;
  return shareResource(t);
}
export function plasterTexture() {
  if (_tex.plaster) return _tex.plaster;
  _tex.plaster = canvasTexture(256, 256, (g, w, h) => {
    noiseFill(g, w, h, { base: 236, amp: 16, per: 6, oct: 5, seed: 3 });
    const r = rng(11);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '120,100,80'},${0.05 + r() * 0.06})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
    }
  });
  return shareResource(_tex.plaster);
}
export function speckleTexture() {
  if (_tex.speckle) return _tex.speckle;
  _tex.speckle = canvasTexture(128, 128, (g, w, h) => {
    noiseFill(g, w, h, { base: 228, amp: 22, per: 8, oct: 4, seed: 9 });
    const r = rng(5);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(${r() < 0.6 ? '90,80,70' : '255,250,240'},${0.1 + r() * 0.2})`;
      g.fillRect(r() * w, r() * h, 1, 1);
    }
  });
  return shareResource(_tex.speckle);
}
// Gradiente radial suave (sombra de contato / halo).
export function radialTexture() {
  if (_tex.radial) return _tex.radial;
  _tex.radial = canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { srgb: false, repeat: false });
  return shareResource(_tex.radial);
}
// Normal map de ondulações (água).
export function rippleNormalTexture() {
  if (_tex.ripple) return _tex.ripple;
  const s = 128;
  const hgt = new Float32Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = x / s, v = y / s;
    let hv = 0;
    for (let k = 1; k <= 4; k++) {
      hv += Math.sin((u * 3 * k + v * 2 * (5 - k)) * Math.PI * 2 + k) / k;
      hv += Math.cos((u * 2 * (k + 1) - v * 3 * k) * Math.PI * 2 + k * 2.1) / (k + 1);
    }
    hgt[y * s + x] = hv;
  }
  _tex.ripple = canvasTexture(s, s, (g) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const hx = hgt[y * s + ((x + 1) % s)] - hgt[y * s + ((x - 1 + s) % s)];
      const hy = hgt[((y + 1) % s) * s + x] - hgt[((y - 1 + s) % s) * s + x];
      const n = new THREE.Vector3(-hx * 0.5, -hy * 0.5, 1).normalize();
      const i = (y * s + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
  return shareResource(_tex.ripple);
}

/** Lona listrada (guarda-sol, almofadas). */
export function stripeTexture(a = '#f2efe6', b = '#e2674e', n = 8) {
  return canvasTexture(256, 64, (g, w, h) => {
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * w) / n, 0, w / n + 1, h); }
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  });
}

// ---------------------------------------------------------------- materiais
const _mats = new Map();
export function mat(key, factory) {
  if (!_mats.has(key)) _mats.set(key, shareResource(factory()));
  return _mats.get(key);
}
/** @param {string} color @param {{ vertical?: boolean, rough?: number, key?: string }} [opts] */
export function woodMat(color, { vertical = false, rough = 0.78, key } = {}) {
  return mat(key || `wood-${color}-${vertical}`, () => new THREE.MeshStandardMaterial({
    color, map: vertical ? woodTextureV() : woodTexture(), roughness: rough,
    bumpMap: vertical ? woodTextureV() : woodTexture(), bumpScale: 0.6,
  }));
}
export function plasterMat(color) {
  return mat(`plaster-${color}`, () => new THREE.MeshStandardMaterial({
    color, map: plasterTexture(), bumpMap: plasterTexture(), bumpScale: 1.2, roughness: 0.92,
  }));
}
export function stdMat(color, opts = {}) {
  return mat(`std-${color}-${JSON.stringify(opts)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts }));
}
export function terracottaMat(color = '#c9764f') {
  return mat(`terra-${color}`, () => new THREE.MeshStandardMaterial({
    color, map: speckleTexture(), roughness: 0.88, bumpMap: speckleTexture(), bumpScale: 0.8,
  }));
}
export function glazeMat(color) {
  return mat(`glaze-${color}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, map: speckleTexture(),
  }));
}
export const brassMat = () => mat('brass', () => new THREE.MeshStandardMaterial({ color: '#c99a45', metalness: 1, roughness: 0.32 }));
export const ironMat = () => mat('iron', () => new THREE.MeshStandardMaterial({ color: '#2d2a28', metalness: 0.6, roughness: 0.5 }));

// Shader de vento para folhagem (sway proporcional à altura local / posição).
export function addFoliageWind(material, { amp = 0.04, freq = 1.3 } = {}) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          float ph = uTime * ${freq.toFixed(2)} + wp.x * 0.9 + wp.z * 0.6 + wp.y * 1.7;
          float gust = 0.6 + 0.4 * sin(uTime * 0.37 + wp.x * 0.11);
          float k = ${amp.toFixed(3)} * gust * clamp(wp.y * 0.6, 0.15, 1.6);
          transformed.x += sin(ph) * k;
          transformed.z += cos(ph * 0.83 + 1.3) * k * 0.6;
          transformed.y += sin(ph * 1.7) * k * 0.25;
        }`);
  };
  material.customProgramCacheKey = () => `foliage-${amp}-${freq}`;
  return material;
}

// ---------------------------------------------------------------- geometria
export function rbox(w, h, d, r = 0.02, seg = 2) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
}

// Pinta vertex colors numa geometria (cor sólida ou função(pos, normal) → THREE.Color)
export function paint(geo, colorOrFn) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const arr = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    if (typeof colorOrFn === 'function') {
      p.fromBufferAttribute(pos, i);
      if (nor) n.fromBufferAttribute(nor, i);
      c.copy(colorOrFn(p, n, i));
    } else c.set(colorOrFn);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Aglomerado orgânico de "bolhas" de folhagem: esferas deslocadas por ruído, fundidas, com vertex color.
export function foliageCluster(blobs, {
  detail = 2, amp = 0.22, freq = 2.2, seed = 1,
  dark = '#3d5a24', light = '#9dbb4f', mid = '#6b8f35', sunBias = 0.55, bottomDark = 0.5,
} = {}) {
  // cada bolha é deslocada (radialmente ao próprio centro) antes da fusão; o cache por posição
  // garante deslocamento idêntico para vértices duplicados da mesma esfera.
  const geos = [];
  const v = new THREE.Vector3(), d = new THREE.Vector3();
  for (const best of blobs) {
    /** @type {THREE.BufferGeometry} */
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g, 1e-5);
    g.scale(best.r * (best.sx || 1), best.r * (best.sy || 0.9), best.r * (best.sz || 1));
    g.translate(best.x, best.y, best.z);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      d.set(v.x - best.x, v.y - best.y, v.z - best.z).normalize();
      const n = fbm3(v.x * freq + seed, v.y * freq, v.z * freq - seed, 3) - 0.5;
      const n2 = vnoise3(v.x * freq * 3.1, v.y * freq * 3.1 + seed, v.z * freq * 3.1) - 0.5;
      v.addScaledVector(d, (n * 2 * amp + n2 * amp * 0.45) * best.r);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    geos.push(g);
  }
  const geo = mergeGeometries(geos);
  const pos = geo.attributes.position;
  // cor: escuro embaixo/dentro, claro em cima voltado ao sol
  const cd = new THREE.Color(dark), cl = new THREE.Color(light), cm = new THREE.Color(mid);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i)); }
  const out = new THREE.Color();
  paint(geo, (p, n) => {
    const hN = (p.y - minY) / Math.max(1e-3, maxY - minY);
    const sun = Math.max(0, n.dot(SUN_DIR)) * sunBias + Math.max(0, n.y) * (1 - sunBias);
    const nz = vnoise3(p.x * 4 + seed, p.y * 4, p.z * 4);
    let t = THREE.MathUtils.clamp(sun * 0.85 + hN * 0.35 - 0.1 + (nz - 0.5) * 0.35, 0, 1);
    if (t < 0.5) out.copy(cd).lerp(cm, t * 2); else out.copy(cm).lerp(cl, (t - 0.5) * 2);
    out.multiplyScalar(1 - bottomDark * (1 - Math.min(1, hN * 1.6)) * 0.6);
    return out;
  });
  return geo;
}

// Sombra de contato (blob) no chão.
export function contactShadow(rx, rz, opacity = 0.45, y = 0.006) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: radialTexture(), color: '#1b1206', transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false,
    }),
  );
  m.scale.set(rx * 2, 1, rz * 2);
  m.position.y = y;
  m.renderOrder = 1;
  m.userData.noShadow = true;
  return m;
}

// Perfil de vaso para LatheGeometry. r = raio da boca, h = altura.
export function potProfile(r, h, { rim = 0.12, foot = 0.72, belly = 1.0, lip = 0.06 } = {}) {
  const pts = [];
  const rb = r * foot;
  pts.push(new THREE.Vector2(0, 0.0));
  pts.push(new THREE.Vector2(rb * 0.96, 0.0));
  pts.push(new THREE.Vector2(rb, h * 0.03));
  const N = 10;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const y = h * (0.03 + t * (1 - rim - 0.03));
    const rr = rb + (r * belly - rb) * Math.sin(t * Math.PI * 0.5) ** 0.9;
    pts.push(new THREE.Vector2(rr * 0.97, y));
  }
  // aba (lábio enrolado)
  pts.push(new THREE.Vector2(r * belly * 0.97 + lip * r * 0.5, h * (1 - rim)));
  pts.push(new THREE.Vector2(r * (1 + lip), h * (1 - rim * 0.7)));
  pts.push(new THREE.Vector2(r * (1 + lip), h * (1 - rim * 0.15)));
  pts.push(new THREE.Vector2(r * (1 + lip * 0.6), h));
  pts.push(new THREE.Vector2(r * 0.9, h));
  pts.push(new THREE.Vector2(r * 0.86, h * 0.9));
  return pts;
}

// Terra (disco irregular) para topo de vasos/canteiros.
export function soilDisc(r, seed = 1) {
  const g = new THREE.CircleGeometry(r, 24, 0, Math.PI * 2);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, (vnoise2(x * 18 + seed, z * 18) - 0.5) * 0.02 + 0.006 * (1 - Math.hypot(x, z) / r));
  }
  g.computeVertexNormals();
  return g;
}

export function shadowAll(obj, cast = true, receive = true) {
  obj.traverse((/** @type {THREE.Mesh} */ o) => {
    if (o.isMesh && !o.userData.noShadow) { o.castShadow = cast; o.receiveShadow = receive; }
  });
  return obj;
}

// "Pele" de folhas: folhinhas instanciadas sobre a superfície de uma folhagem (dá textura de folhas às bolhas).
let _leafGeo = null;
/**
 * @param {THREE.BufferGeometry} foliageGeo
 * @param {{ count?: number, size?: number, seed?: number, material?: THREE.Material, minNormalY?: number, tint?: number }} [opts]
 */
export function leafSkin(foliageGeo, { count = 1000, size = 0.07, seed = 1, material, minNormalY = -0.3, tint = 1.0 } = {}) {
  if (!_leafGeo) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5);
    s.quadraticCurveTo(0.42, -0.15, 0, 0.5);
    s.quadraticCurveTo(-0.42, -0.15, 0, -0.5);
    _leafGeo = shareResource(new THREE.ShapeGeometry(s, 3));
    _leafGeo.deleteAttribute('uv');
    paint(_leafGeo, '#ffffff');
  }
  const pos = foliageGeo.attributes.position, nor = foliageGeo.attributes.normal, col = foliageGeo.attributes.color;
  const r = rng(seed);
  const im = new THREE.InstancedMesh(_leafGeo, material, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const p = new THREE.Vector3(), n = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1), sc = new THREE.Vector3();
  const c = new THREE.Color();
  let k = 0, guard = 0;
  while (k < count && guard++ < count * 8) {
    const i = Math.floor(r() * pos.count);
    n.fromBufferAttribute(nor, i);
    if (n.y < minNormalY) continue;
    p.fromBufferAttribute(pos, i).addScaledVector(n, size * 0.15);
    // folha voltada para fora, inclinada para cima, giro aleatório
    n.y += 0.35; n.normalize();
    q.setFromUnitVectors(z, n);
    q2.setFromAxisAngle(z, r() * Math.PI * 2);
    q.multiply(q2);
    const s = size * (0.7 + r() * 0.6);
    sc.set(s, s, s);
    m4.compose(p, q, sc);
    im.setMatrixAt(k, m4);
    if (col) c.fromBufferAttribute(col, i); else c.set('#4f7a2e');
    c.multiplyScalar(tint * (0.85 + r() * 0.35));
    im.setColorAt(k, c);
    k++;
  }
  im.count = k;
  im.name = 'folhinhas'; // pele de folhas soltas: a forma (e o colisor) é a da folhagem por baixo
  im.castShadow = false;
  im.receiveShadow = true;
  return im;
}
