// PANDORÓPOLIS — kit de montagem do cenário. As peças fixas (cores por vértice) entram num "balde" por material e
// por região da cidade e viram uma malha só por balde (finish): a cidade inteira sai em poucas dezenas de desenhos,
// e o recorte da câmera ainda funciona por região. Peças que precisam ficar à parte (a torre, que fica transparente
// quando as dogs passam atrás dela) usam um grupo com nome. Também as formas prontas: caixas arredondadas, telhados,
// toldos, janelas, cerquinhas e o texto em canvas (placas, números do chão, outdoor).
import * as THREE from 'three';
import { paint, mat, addFoliageWind, canvasTexture, vnoise2, fbm2, mergeGeometries, RoundedBoxGeometry } from '../../../world/util.js';

/** Tamanho das regiões (m) em que as peças fixas são agrupadas. */
export const CELL = 20;

/** Materiais dos baldes (compartilhados entre visitas ao mapa). */
export const SLOTS = {
  solid: () => mat('mapa-solid', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 })),
  ground: () => mat('mapa-ground', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })),
  glass: () => mat('mapa-glass', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0.2, envMapIntensity: 1.4 })),
  lit: () => mat('mapa-lit', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#ffcf7a', emissiveIntensity: 0.85 })),
  foliage: () => mat('mapa-foliage', () => addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }), { amp: 0.045, freq: 0.9 })),
  /** Plantinhas de folha fina (lavanda, gerânio, ramas): as duas faces. */
  plant: () => mat('mapa-plant', () => addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide }), { amp: 0.018, freq: 1.6 })),
};
/** Baldes que não fazem sombra (o chão). */
const NO_CAST = new Set(['ground']);

const KEEP = ['position', 'normal', 'color'];
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * @param {THREE.Group} root
 */
export function createKit(root) {
  /** @type {Map<string, THREE.BufferGeometry[]>} */
  const buckets = new Map();
  const cellOf = (x, z) => `c${Math.floor(x / CELL)}_${Math.floor(z / CELL)}`;

  /**
   * Põe uma peça no balde. color: cor sólida, função (posição local, normal) → Color, ou null para manter a cor da
   * geometria. Posição/rotação/escala no mundo.
   * @param {THREE.BufferGeometry} geo
   * @param {{ color?: string | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color) | null, slot?: keyof typeof SLOTS,
   *           x?: number, y?: number, z?: number, rx?: number, ry?: number, rz?: number, sx?: number, sy?: number, sz?: number,
   *           group?: string }} [o]
   */
  function add(geo, { color = '#ffffff', slot = 'solid', x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, group = null } = {}) {
    // o que o balde não usa sai antes da cópia (a peça é só do cenário: uv e afins não servem a ninguém)
    for (const k of Object.keys(geo.attributes)) if (!KEEP.includes(k)) geo.deleteAttribute(k);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.boundingBox = null;
    g.boundingSphere = null;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (color !== null || !g.attributes.color) paint(g, color ?? '#ffffff');
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    const key = `${slot}|${group || cellOf(x, z)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(g);
    return g;
  }

  /** Junta cada balde numa malha. → { meshes, groups: { nome: Group } } */
  function finish() {
    /** @type {THREE.Mesh[]} */
    const meshes = [];
    /** @type {Record<string, THREE.Group>} */
    const groups = {};
    for (const [key, list] of buckets) {
      const [slot, group] = key.split('|');
      const geo = mergeGeometries(list);
      for (const g of list) g.dispose();
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, SLOTS[slot]());
      mesh.name = `mapa:${slot}:${group}`;
      mesh.castShadow = !NO_CAST.has(slot);
      mesh.receiveShadow = true;
      if (group.startsWith('c')) root.add(mesh);
      else {
        if (!groups[group]) { groups[group] = new THREE.Group(); groups[group].name = `mapa:${group}`; root.add(groups[group]); }
        groups[group].add(mesh);
      }
      meshes.push(mesh);
    }
    buckets.clear();
    return { meshes, groups };
  }
  return { add, finish };
}

// ---------------------------------------------------------------- formas
/**
 * Modelos de caixa arredondada por número de segmentos: cada vértice guarda o canto (sinal de x, y, z) e a normal. Uma
 * caixa w × h × d de raio r é só canto × (meia medida − r) + normal × r: igual à RoundedBoxGeometry e muito mais rápida
 * (a cidade tem milhares de caixas).
 * @type {Map<number, { sign: Float32Array, normal: Float32Array, count: number }>}
 */
const RB = new Map();
function rbTemplate(seg) {
  let t = RB.get(seg);
  if (t) return t;
  const g0 = new RoundedBoxGeometry(1, 1, 1, seg, 0.25);
  const g = g0.index ? g0.toNonIndexed() : g0;
  const pos = g.attributes.position.array;
  const sign = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i++) sign[i] = pos[i] < 0 ? -1 : 1;
  t = { sign, normal: Float32Array.from(g.attributes.normal.array), count: g.attributes.position.count };
  g0.dispose();
  RB.set(seg, t);
  return t;
}
/** Caixa arredondada com a base em y = 0 (sem uv: o cenário pinta por vértice). */
export function rb(w, h, d, r = 0.06, seg = 2) {
  const t = rbTemplate(seg);
  const rr = Math.max(0, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  const half = [w / 2 - rr, h / 2 - rr, d / 2 - rr];
  const p = new Float32Array(t.count * 3);
  for (let i = 0; i < p.length; i += 3) {
    p[i] = t.sign[i] * half[0] + t.normal[i] * rr;
    p[i + 1] = t.sign[i + 1] * half[1] + t.normal[i + 1] * rr + h / 2;
    p[i + 2] = t.sign[i + 2] * half[2] + t.normal[i + 2] * rr;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(t.normal.slice(), 3));
  return g;
}
/** Cilindro (ou tronco de cone) com a base em y = 0. */
export function cyl(rTop, rBot, h, seg = 14) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  g.translate(0, h / 2, 0);
  return g;
}
export const sphere = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
/** Caixa reta com a base em y = 0 (chão, faixas). */
export function slab(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

/** Monta uma geometria de triângulos (lista de [x,y,z] por triângulo), com normais por face. */
function tris(list) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(list.flat(2), 3));
  g.computeVertexNormals();
  return g;
}
/**
 * Telhado de quatro águas: base w × d (já com o beiral), altura h; a cumeeira corre no lado mais comprido.
 * A base fica em y = 0, centrada.
 */
export function hipRoof(w, d, h) {
  const hx = w / 2, hz = d / 2;
  const along = w >= d;
  const r = along ? Math.max(0, hx - hz) : Math.max(0, hz - hx);
  const A = along ? [-r, h, 0] : [0, h, -r];
  const Bp = along ? [r, h, 0] : [0, h, r];
  const c = [[-hx, 0, -hz], [hx, 0, -hz], [hx, 0, hz], [-hx, 0, hz]];
  const t = [];
  if (along) {
    t.push([c[3], c[2], Bp], [c[3], Bp, A]); // sul
    t.push([c[1], c[0], A], [c[1], A, Bp]); // norte
    t.push([c[2], c[1], Bp]); // leste
    t.push([c[0], c[3], A]); // oeste
  } else {
    t.push([c[2], c[1], A], [c[2], A, Bp]); // leste
    t.push([c[0], c[3], Bp], [c[0], Bp, A]); // oeste
    t.push([c[3], c[2], Bp]); // sul
    t.push([c[1], c[0], A]); // norte
  }
  t.push([c[0], c[1], c[2]], [c[0], c[2], c[3]]); // embaixo
  return tris(t);
}
/** Telhado de duas águas ao longo de x: base w × d, altura h, com as empenas fechadas. */
export function gableRoof(w, d, h) {
  const hx = w / 2, hz = d / 2;
  const a = [-hx, h, 0], b = [hx, h, 0];
  const n0 = [-hx, 0, -hz], n1 = [hx, 0, -hz], s0 = [-hx, 0, hz], s1 = [hx, 0, hz];
  return tris([[s0, s1, b], [s0, b, a], [n1, n0, a], [n1, a, b], [s1, n1, b], [n0, s0, a], [n0, n1, s1], [n0, s1, s0]]);
}

/**
 * Toldo listrado inclinado (frente de loja): `n` listras alternando as cores, com a beirada recortada em ondinhas.
 * Centrado em x, preso na parede em z = 0 e saindo para +z.
 */
export function awning(kit, { x, y, z, w, depth = 0.9, drop = 0.35, colors = ['#f08a3c', '#fff6e6'], n = 8, ry = 0, group = null }) {
  const sw = w / n;
  const tilt = Math.atan2(drop, depth);
  const len = Math.hypot(depth, drop);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < n; i++) {
    const lx = -w / 2 + sw * (i + 0.5);
    const g = rb(sw * 0.985, 0.05, len, 0.015, 1);
    g.translate(0, 0, len / 2);
    g.rotateX(tilt);
    kit.add(g, { color: colors[i % colors.length], x: x + lx * c, y, z: z - lx * s, ry, group });
    // ondinha da beirada
    const b = new THREE.CylinderGeometry(sw / 2, sw / 2, 0.05, 10, 1, false, 0, Math.PI);
    b.rotateX(Math.PI / 2);
    b.rotateY(Math.PI / 2);
    kit.add(b, { color: colors[i % colors.length], x: x + lx * c + depth * s, y: y - drop, z: z - lx * s + depth * c, ry, group });
  }
}

/** Janela com moldura branca, vidro e travessa, na parede de normal (nx, nz). Centro (x, y, z). */
export function windowAt(kit, { x, y, z, w = 0.9, h = 1.0, nx = 0, nz = 1, frame = '#fffaf0', shutters = null, lit = false, group = null }) {
  const ry = Math.atan2(nx, nz);
  const o = 0.03;
  kit.add(rb(w + 0.16, h + 0.16, 0.06, 0.025, 1), { color: frame, x: x + nx * o, y: y - h / 2 - 0.08, z: z + nz * o, ry, group });
  kit.add(slab(w, h, 0.02), { color: lit ? '#ffe2a0' : '#8ec1df', slot: lit ? 'lit' : 'glass', x: x + nx * (o + 0.03), y: y - h / 2, z: z + nz * (o + 0.03), ry, group });
  kit.add(slab(0.05, h, 0.03), { color: frame, x: x + nx * (o + 0.045), y: y - h / 2, z: z + nz * (o + 0.045), ry, group });
  kit.add(slab(w, 0.05, 0.03), { color: frame, x: x + nx * (o + 0.045), y: y - 0.025, z: z + nz * (o + 0.045), ry, group });
  kit.add(rb(w + 0.3, 0.07, 0.16, 0.02, 1), { color: frame, x: x + nx * (o + 0.06), y: y - h / 2 - 0.13, z: z + nz * (o + 0.06), ry, group });
  if (shutters) {
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const side of [-1, 1]) {
      const lx = side * (w / 2 + 0.24);
      kit.add(rb(0.36, h + 0.1, 0.05, 0.02, 1), { color: shutters, x: x + lx * c + nx * o, y: y - h / 2 - 0.05, z: z - lx * s + nz * o, ry, group });
    }
  }
}

/** Porta com batente e degrau, na parede de normal (nx, nz); (x, z) no pé da parede. */
export function doorAt(kit, { x, z, w = 0.95, h = 1.95, nx = 0, nz = 1, color = '#8e5a33', frame = '#fffaf0', group = null }) {
  const ry = Math.atan2(nx, nz);
  kit.add(rb(w + 0.2, h + 0.12, 0.06, 0.02, 1), { color: frame, x: x + nx * 0.03, y: 0, z: z + nz * 0.03, ry, group });
  kit.add(rb(w, h, 0.07, 0.02, 1), { color, x: x + nx * 0.07, y: 0.02, z: z + nz * 0.07, ry, group });
  kit.add(sphere(0.045, 8, 6), { color: '#d9b25a', x: x + nx * 0.13 + Math.cos(ry) * w * 0.32, y: h * 0.48, z: z + nz * 0.13 - Math.sin(ry) * w * 0.32, group });
  kit.add(rb(w + 0.5, 0.04, 0.5, 0.015, 1), { color: '#d9cfc2', x: x + nx * 0.28, y: 0, z: z + nz * 0.28, ry, group });
}

/** Cerquinha de madeira pintada (mourões com ponta e duas réguas) de (x0, z0) a (x1, z1). */
export function picketFence(kit, { x0, z0, x1, z1, h = 0.62, color = '#fffaf0', step = 0.24, group = null }) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = -Math.atan2(z1 - z0, x1 - x0);
  const n = Math.max(1, Math.round(len / step));
  const post = rb(0.08, h - 0.06, 0.035, 0.012, 1);
  const tip = new THREE.ConeGeometry(0.058, 0.09, 4);
  tip.rotateY(Math.PI / 4);
  tip.translate(0, h - 0.06 + 0.045, 0);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k;
    kit.add(post, { color, x, z, ry, group });
    kit.add(tip, { color, x, z, ry, group });
  }
  for (const y of [h * 0.3, h * 0.7]) {
    kit.add(rb(len, 0.06, 0.03, 0.01, 1), { color, x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, ry, group });
  }
}

// ---------------------------------------------------------------- texto e texturas em canvas
const FONT = '"Fredoka", "Nunito", system-ui, sans-serif';
/** Fonte do jogo carregada? (o canvas desenha com a substituta até lá: refaz depois). */
export function whenFontsReady(fn) {
  const doc = globalThis.document;
  if (!doc?.fonts?.load) return;
  Promise.all([doc.fonts.load(`700 64px ${FONT}`), doc.fonts.load(`600 32px ${FONT}`)]).then(fn).catch(() => {});
}

/**
 * Placa de texto (canvas) num plano w × h. bg: cor de fundo (null = transparente).
 * @returns {{ mesh: THREE.Mesh, redraw(): void }}
 */
export function textPlate(text, w, h, { bg = '#4a3426', color = '#fff6e6', stroke = null, weight = 700, px = 1024, pad = 0.12, radius = 0.18 } = {}) {
  const H = Math.round(px * h / w);
  const draw = (g) => {
    g.clearRect(0, 0, px, H);
    if (bg) {
      const r = radius * H;
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect?.(0, 0, px, H, r);
      if (!g.roundRect) g.rect(0, 0, px, H);
      g.fill();
    }
    let size = H * (1 - pad * 2) * 0.86;
    g.font = `${weight} ${size}px ${FONT}`;
    const maxW = px * (1 - pad * 1.2);
    const tw = g.measureText?.(text)?.width || 0;
    if (tw > maxW) { size *= maxW / tw; g.font = `${weight} ${size}px ${FONT}`; }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    if (stroke) { g.lineWidth = size * 0.16; g.strokeStyle = stroke; g.strokeText(text, px / 2, H / 2 + size * 0.04); }
    g.fillStyle = color;
    g.fillText(text, px / 2, H / 2 + size * 0.04);
  };
  const tex = canvasTexture(px, H, draw, { repeat: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: !bg, roughness: 0.7, depthWrite: !!bg }));
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const redraw = () => {
    const cv = tex.image;
    const g = cv?.getContext?.('2d');
    if (!g) return;
    draw(g);
    tex.needsUpdate = true;
  };
  return { mesh, redraw };
}

/**
 * Textura de grama com variação, sem emenda: o ruído de cada ponto mistura o dele com o das cópias deslocadas de uma
 * largura e de uma altura (pesos pela distância às bordas), então a borda da direita continua a da esquerda e a de
 * baixo a de cima (antes, os quadrados de 9 m apareciam no chão).
 */
export function grassTexture() {
  return mat('mapa-grass-tex', () => canvasTexture(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    const N = (x, y) => fbm2(x / 38, y / 38, 4) * 1.25 + (vnoise2(x / 3.1, y / 3.1) - 0.5) * 0.18;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const n = N(x, y) * (1 - u) * (1 - v) + N(x - w, y) * u * (1 - v) + N(x, y - h) * (1 - u) * v + N(x - w, y - h) * u * v;
        // a mistura achata o meio: realça de novo em volta do médio
        const k = (y * w + x) * 4;
        const t = Math.min(1, Math.max(0, (n - 0.62) * 1.5 + 0.5));
        img.data[k] = 108 + t * 44;
        img.data[k + 1] = 160 + t * 40;
        img.data[k + 2] = 60 + t * 18;
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }));
}
