// PANDORÓPOLIS — peças que vários lugares usam: a casa em corte de maquete (como nas fases 5, 6, 8 e 9: as paredes do
// lado da câmera cortadas baixas e o telhado aberto para trás, como a tampa de uma casinha de bonecas), os cordões de
// luz, a cerca de lápis de cor, a lanterna, a água (lago, canal, piscininha) e a nuvem de chuva com as gotas numa malha
// só (instâncias).
import * as THREE from 'three';
import { mat, rng, foliageCluster, rippleNormalTexture, paint, mergeGeometries, mergeVertices } from '../../../world/util.js';
import { rb, cyl, sphere, slab, gableRoof, hipRoof, windowAt } from './kit.js';

/** Água dos lagos e piscinas (compartilhada). */
export const waterMat = () => mat('mapa-lake', () => {
  const n = rippleNormalTexture().clone();
  n.repeat.set(5, 5);
  return new THREE.MeshStandardMaterial({ color: '#4fa6d8', roughness: 0.14, metalness: 0.05, normalMap: n, normalScale: new THREE.Vector2(0.3, 0.3) });
});

/**
 * Cor que muda pela direção da face: `inside` na face de dentro (normal · dir < −0,5), `out` no resto (cor ou função,
 * como os tijolos da casa do vovô).
 * @param {string | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)} out
 * @param {string} inside
 */
function twoTone(out, inside, dx, dz) {
  const a0 = typeof out === 'function' ? null : new THREE.Color(out), b = new THREE.Color(inside);
  return (p, n) => (n.x * dx + n.z * dz < -0.5 ? b : a0 ?? /** @type {Function} */ (out)(p, n));
}

/**
 * Casa em corte de maquete. x, z: centro; w (x), d (z), h: medidas; low: altura das paredes cortadas (sul e leste, as do
 * lado da câmera); door: { x, w } na parede sul; wall/inside: cores de fora e de dentro; floor: cor ou função do piso;
 * roof: { kind: 'gable' | 'hip' | 'flat', h, color, open (rad), over }; windows: posições x na parede do fundo (norte).
 * O telhado gira na beirada do fundo (dobradiça) e fica aberto para trás.
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 */
export function openHouse(kit, { x, z, w, d, h, low = 1.0, t = 0.16, wall = '#f6e6cb', inside = '#fff8ec', trim = '#fffaf0', floor = '#c9a27a',
  door = null, roof = { kind: 'gable', h: 1.6, color: '#d9733a', open: 1.05, over: 0.35 }, windows = [], cut = ['s', 'e'], group = null }) {
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  // piso (um pouco acima do chão) e a barra da base por fora
  kit.add(slab(w - 0.02, 0.06, d - 0.02), { color: floor, x, z, group });
  kit.add(rb(w + 0.1, 0.22, d + 0.1, 0.03, 1), { color: '#d9c4a6', x, z, group });
  const full = (side) => !cut.includes(side);
  // norte e oeste inteiras; sul e leste cortadas (com o arremate claro no topo do corte)
  const wallN = full('n') ? h : low, wallW = full('w') ? h : low, wallS = full('s') ? h : low, wallE = full('e') ? h : low;
  kit.add(rb(w, wallN, t, 0.03, 1), { color: twoTone(wall, inside, 0, -1), x, z: z0 + t / 2, group });
  kit.add(rb(t, wallW, d - 2 * t, 0.03, 1), { color: twoTone(wall, inside, -1, 0), x: x0 + t / 2, z, group });
  kit.add(rb(t, wallE, d - 2 * t, 0.03, 1), { color: twoTone(wall, inside, 1, 0), x: x1 - t / 2, z, group });
  // parede sul com o vão da porta
  if (door) {
    const a = door.x - door.w / 2, b = door.x + door.w / 2;
    if (a > x0) kit.add(rb(a - x0, wallS, t, 0.03, 1), { color: twoTone(wall, inside, 0, 1), x: (x0 + a) / 2, z: z1 - t / 2, group });
    if (x1 > b) kit.add(rb(x1 - b, wallS, t, 0.03, 1), { color: twoTone(wall, inside, 0, 1), x: (b + x1) / 2, z: z1 - t / 2, group });
    kit.add(rb(door.w + 0.4, 0.04, 0.6, 0.015, 1), { color: '#c98a55', x: door.x, z: z1 + 0.3, group }); // capacho
  } else kit.add(rb(w, wallS, t, 0.03, 1), { color: twoTone(wall, inside, 0, 1), x, z: z1 - t / 2, group });
  for (const [cx, cz, cw, cd, ch] of [[x, z1 - t / 2, w + 0.04, t + 0.06, wallS], [x1 - t / 2, z, t + 0.06, d + 0.04, wallE]]) {
    if (ch < h) kit.add(rb(cw, 0.06, cd, 0.02, 1), { color: trim, x: cx, y: ch, z: cz, group });
  }
  // janelas na parede do fundo, vistas de dentro (de frente para a câmera)
  for (const wx of windows) windowAt(kit, { x: wx, y: Math.min(h - 0.5, 2.05), z: z0 + t, w: 0.9, h: 0.9, nx: 0, nz: 1, group });
  // telhado aberto para trás (a dobradiça na beirada do fundo)
  if (roof) {
    const over = roof.over ?? 0.35;
    const W = w + 2 * over, D = d + 2 * over;
    let g;
    if (roof.kind === 'flat') g = rb(W, 0.16, D, 0.04, 1);
    else if (roof.kind === 'hip') g = hipRoof(W, D, roof.h);
    else g = gableRoof(W, D, roof.h);
    g.translate(0, 0, D / 2);
    g.rotateX(-(roof.open ?? 1.0));
    kit.add(g, { color: roof.color, x, y: wallN, z: z0 - over, group });
  }
  return { x0, x1, z0, z1, floorY: 0.06 };
}

/**
 * Cordões de luz entre pontos [x, y, z] (em sequência), com a barriga do fio (sag) e lampadinhas acesas.
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 */
export function stringLights(kit, pts, { sag = 0.35, every = 0.45, colors = ['#fff1c2', '#ffd36a', '#ffb3c8'] } = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.round(len / every));
    let px = ax, py = ay, pz = az;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const qx = ax + (bx - ax) * t, qz = az + (bz - az) * t, qy = ay + (by - ay) * t - sag * 4 * t * (1 - t);
      const sl = Math.hypot(qx - px, qy - py, qz - pz);
      // o fio de p a q: um cilindro fino (centrado) deitado na direção do trecho, no meio dele
      const g = new THREE.CylinderGeometry(0.008, 0.008, sl, 3);
      const dir = new THREE.Vector3(qx - px, qy - py, qz - pz).normalize();
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      kit.add(g, { color: '#3a2a22', x: (px + qx) / 2, y: (py + qy) / 2, z: (pz + qz) / 2, ao: false });
      if (k < n) kit.add(sphere(0.045, 6, 4), { color: colors[k % colors.length], slot: 'lit', x: qx, y: qy - 0.05, z: qz, ao: false });
      px = qx; py = qy; pz = qz;
    }
  }
}

const PENCILS = ['#e8577a', '#f08a3c', '#ffd15c', '#7fd36b', '#6ec3e8', '#9677c6'];
/**
 * Cerca de lápis de cor (a da pracinha da fase 7) de (x0, z0) a (x1, z1): lápis de ponta para cima, presos num trilho.
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 */
export function pencilFence(kit, { x0, z0, x1, z1, h = 0.9, step = 0.2, seed = 1 }) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / step));
  const body = new THREE.CylinderGeometry(0.075, 0.075, h - 0.18, 6);
  body.translate(0, (h - 0.18) / 2, 0);
  const wood = new THREE.ConeGeometry(0.075, 0.13, 6);
  wood.translate(0, h - 0.18 + 0.065, 0);
  const lead = new THREE.ConeGeometry(0.025, 0.05, 6);
  lead.translate(0, h - 0.025, 0);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k;
    const c = PENCILS[(i + seed) % PENCILS.length];
    kit.add(body, { color: c, x, z });
    kit.add(wood, { color: '#f4d9a8', x, z, ao: false });
    kit.add(lead, { color: c, x, z, ao: false });
  }
  const ry = -Math.atan2(z1 - z0, x1 - x0);
  kit.add(rb(len, 0.07, 0.05, 0.02, 1), { color: '#fffaf0', x: (x0 + x1) / 2, y: h * 0.42, z: (z0 + z1) / 2, ry });
}

/**
 * Lanterna acesa num poste (ou pendurada: post = false).
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 */
export function lantern(kit, { x, y = 0, z, post = true, h = 1.2 }) {
  if (post) kit.add(cyl(0.035, 0.05, h, 8), { color: '#3a3a40', x, y, z });
  const top = post ? y + h : y;
  kit.add(rb(0.2, 0.04, 0.2, 0.015, 1), { color: '#3a3a40', x, y: top, z, ao: false });
  kit.add(rb(0.15, 0.22, 0.15, 0.03, 1), { color: '#ffd36a', slot: 'lit', x, y: top + 0.04, z, ao: false });
  kit.add(new THREE.ConeGeometry(0.14, 0.12, 4).rotateY(Math.PI / 4), { color: '#3a3a40', x, y: top + 0.32, z, ao: false });
}

/**
 * Nuvem de chuva: a nuvem e as gotas (uma malha instanciada), que caem até a altura `floor`. → { update(dt) }
 * @param {THREE.Group} root
 */
export function rainCloud(root, { x, y, z, w = 2.6, d = 1.6, drops = 26, seed = 3, floor = 0.03 }) {
  const R = rng(seed);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const puff = foliageCluster([{ x: 0, y: 0, z: 0, r: 1.0, sy: 0.6 }, { x: 0.9, y: -0.1, z: 0.2, r: 0.75, sy: 0.6 }, { x: -0.9, y: -0.05, z: -0.1, r: 0.8, sy: 0.6 }, { x: 0.1, y: 0.25, z: -0.5, r: 0.7, sy: 0.6 }], { detail: 2, amp: 0.12, dark: '#a9b4c0', mid: '#c9d2dc', light: '#eef2f6', sunBias: 0.3 });
  const cm = new THREE.Mesh(puff, mat('mapa-raincloud-vc', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  cm.castShadow = true;
  g.add(cm);
  const rainMat = mat('mapa-rain', () => new THREE.MeshStandardMaterial({ color: '#8ec9ea', roughness: 0.3, transparent: true, opacity: 0.7 }));
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 4), rainMat, drops);
  im.frustumCulled = false;
  const st = Array.from({ length: drops }, () => ({ x: (R() - 0.5) * w, y: -0.5 - R() * 3.5, z: (R() - 0.5) * d }));
  const m4 = new THREE.Matrix4();
  g.add(im);
  root.add(g);
  const fall = y - floor; // até onde as gotas caem (o chão, ou o telhado de vidro)
  return {
    group: g,
    update(dt, t) {
      g.position.x = x + Math.sin(t * 0.3) * 0.25;
      for (let i = 0; i < drops; i++) {
        const s = st[i];
        s.y -= dt * 6;
        if (s.y < -fall) s.y = -0.5;
        m4.makeTranslation(s.x, s.y, s.z);
        im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
    },
  };
}

const BUSHES = new Map();
/**
 * Moitinha florida leve (para vasos, floreiras e a roseira vistos de longe): uma bolha de folhas e algumas flores,
 * com índice (~200 triângulos, contra ~2 000 do gerânio das fases). Feita uma vez por combinação. Balde 'foliage'.
 */
export function flowerBush({ r = 0.2, seed = 1, flower = '#ff6a55', n = 6 } = {}) {
  const key = `${r}|${seed}|${flower}|${n}`;
  if (BUSHES.has(key)) return BUSHES.get(key);
  const R = rng(seed);
  const leaf = foliageCluster([{ x: 0, y: r * 0.6, z: 0, r, sy: 0.75 }], { detail: 1, amp: 0.22, freq: 6, seed, dark: '#2f4d1f', mid: '#4f7a2e', light: '#86a94a' });
  const parts = [leaf];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R(), d = r * (0.35 + R() * 0.5);
    const ico = new THREE.IcosahedronGeometry(r * 0.2, 0);
    ico.deleteAttribute('normal');
    ico.deleteAttribute('uv');
    const f = mergeVertices(ico.translate(Math.cos(a) * d, r * (0.95 + R() * 0.25), Math.sin(a) * d), 1e-5);
    f.computeVertexNormals();
    parts.push(paint(f, flower));
  }
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'color'].includes(k)) p.deleteAttribute(k);
  const g = mergeGeometries(parts);
  BUSHES.set(key, g);
  return g;
}

/** Cor das lombadas de livro (faixas verticais de cores) para estantes. */
export function bookSpines(seed = 1) {
  const cols = ['#c2483a', '#2f6fb8', '#e9b064', '#5d8350', '#8e5a33', '#9677c6', '#fffaf0'].map((c) => new THREE.Color(c));
  const out = new THREE.Color();
  return (p) => {
    const i = Math.abs(Math.floor(p.x / 0.07 + seed * 7 + Math.floor(p.y / 0.32) * 3)) % cols.length;
    return out.copy(cols[i]);
  };
}
