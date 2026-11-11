// PANDORÓPOLIS — kit de montagem do cenário. As peças fixas (cores por vértice) entram num "balde" por material e
// por região da cidade e viram uma malha só por balde (finish): a cidade inteira sai em poucas dezenas de desenhos,
// e o recorte da câmera ainda funciona por região. Peças que precisam ficar à parte (a torre, que fica transparente
// quando as dogs passam atrás dela) usam um grupo com nome. Também as formas prontas: caixas arredondadas, telhados,
// toldos, janelas, cerquinhas e o texto em canvas (placas, números do chão, outdoor).
// As peças ficam com índice (vértices compartilhados: a cidade tem centenas de milhares de triângulos e, sem índice, o
// triplo de vértices para a GPU) e as sólidas ganham o "sombreado de maquete": a base um pouco mais escura, como a
// sombra de contato do chão.
import * as THREE from 'three';
import { paint, mat, addFoliageWind, canvasTexture, vnoise2, fbm2, mergeGeometries, mergeVertices, RoundedBoxGeometry } from '../../../world/util.js';

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
  /**
   * Decalques no chão (sombra de contato, umidade, sujeira, musgo): cor E opacidade por vértice (a cor com quatro
   * componentes, ver decalLot), sem luz, por cima do piso (sem profundidade, puxado para a câmera) e sem sombra.
   */
  contact: () => mat('mapa-contact', () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })),
};
/** Baldes que não fazem sombra (o chão e as plantinhas baixas: a sombra delas mal aparece e custa uma passada). */
const NO_CAST = new Set(['ground', 'plant', 'contact']);
/** Baldes com o sombreado de maquete (base mais escura). */
const AO_SLOTS = new Set(['solid']);

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
   *           group?: string, ao?: boolean }} [o]
   */
  function add(geo, { color = '#ffffff', slot = 'solid', x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, group = null, ao = AO_SLOTS.has(slot) } = {}) {
    // o que o balde não usa sai antes da cópia (a peça é só do cenário: uv e afins não servem a ninguém)
    for (const k of Object.keys(geo.attributes)) if (!KEEP.includes(k)) geo.deleteAttribute(k);
    const g = geo.clone();
    if (!g.index) g.setIndex(trivialIndex(g.attributes.position.count));
    g.boundingBox = null;
    g.boundingSphere = null;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (color !== null || !g.attributes.color) paint(g, color ?? '#ffffff');
    if (ao) shadeBase(g, sy);
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

/**
 * Lote de decalques deitados para o balde 'contact': manchas macias de cor e opacidade por vértice, que caem a zero
 * na borda (sombra de contato no pé das coisas, umidade, sujeira, musgo, terra). Tudo numa geometria só:
 *   const D = decalLot(); D.blob(...); D.rrect(...); D.strip(...);
 *   kit.add(D.geometry(), { color: null, slot: 'contact', group, ao: false });
 * `y`: a altura do lote (acima dos pisos de andar e dos decalques opacos deles; o material ainda puxa para a câmera).
 * `clip(x, z)`: onde não pode haver decalque (água): o triângulo com um ponto ali fica de fora.
 * @param {number} [y]
 * @param {((x: number, z: number) => boolean) | null} [clip]
 */
export function decalLot(y = 0.027, clip = null) {
  /** @type {number[]} */
  const pos = [];
  /** @type {number[]} */
  const rgba = [];
  const c = new THREE.Color();
  /** Um triângulo [x, z, opacidade] × 3, sempre virado para cima. */
  const tri = (p, q, r) => {
    const cy = (q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]);
    if (Math.abs(cy) < 1e-9 || (p[2] <= 0 && q[2] <= 0 && r[2] <= 0)) return;
    if (clip && (clip(p[0], p[1]) || clip(q[0], q[1]) || clip(r[0], r[1]))) return;
    if (cy < 0) { const t = q; q = r; r = t; }
    for (const v of [p, q, r]) { pos.push(v[0], y, v[1]); rgba.push(c.r, c.g, c.b, v[2]); }
  };
  /** Anéis de pontos (mesma contagem) ligados em faixas; `center`: o miolo em leque. */
  const rings = (list, center = null) => {
    for (let k = 0; k + 1 < list.length; k++) {
      const A = list[k], B = list[k + 1], n = A.length;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(A[i], A[j], B[j]); tri(A[i], B[j], B[i]); }
    }
    if (center) { const A = list[0]; for (let i = 0; i < A.length; i++) tri(center, A[i], A[(i + 1) % A.length]); }
  };
  /** Ruído leve e fixo por ângulo (contorno irregular). */
  const wobble = (t, seed) => 0.6 * Math.sin(2 * t + seed) + 0.4 * Math.sin(3 * t + seed * 2.3);
  return {
    /**
     * Mancha redonda (ou oval: sx, sz; girada: rot), opaca no meio e sumindo até o raio r.
     * @param {number} x @param {number} z @param {number} r
     * @param {{ a?: number, color?: THREE.ColorRepresentation, sx?: number, sz?: number, rot?: number, seed?: number, wob?: number, n?: number, core?: number }} [o]
     */
    blob(x, z, r, { a = 0.4, color = '#10162a', sx = 1, sz = 1, rot = 0, seed = 0, wob = 0.12, n = 14, core = 0.45 } = {}) {
      c.set(color);
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const ring = (k, al) => Array.from({ length: n }, (_, i) => {
        const t = (i / n) * Math.PI * 2, rr = r * k * (1 + wob * wobble(t, seed));
        const lx = Math.cos(t) * rr * sx, lz = Math.sin(t) * rr * sz;
        return [x + lx * cs - lz * sn, z + lx * sn + lz * cs, al];
      });
      rings([ring(core, a * 0.88), ring(0.74, a * 0.38), ring(1, 0)], [x, z, a]);
    },
    /**
     * Sombra de um poste ou vaso redondo (raio r0): `a` junto dele, sumindo em w para fora, e por baixo dele.
     * @param {number} x @param {number} z @param {number} r0 @param {number} w
     * @param {{ a?: number, color?: THREE.ColorRepresentation, n?: number }} [o]
     */
    disc(x, z, r0, w, { a = 0.35, color = '#10162a', n = 14 } = {}) {
      c.set(color);
      const ring = (r, al) => Array.from({ length: n }, (_, i) => {
        const t = (i / n) * Math.PI * 2;
        return [x + Math.cos(t) * r, z + Math.sin(t) * r, al];
      });
      rings([ring(r0, a), ring(r0 + w * 0.32, a * 0.52), ring(r0 + w, 0)], [x, z, a]);
    },
    /**
     * Sombra de uma caixa no chão (centro x, z, meias medidas hx, hz, girada ry): `a` junto da caixa, sumindo em w
     * para fora, com os cantos arredondados; `fill`: também por baixo dela (móveis de pés: mesa, banco, carro).
     * @param {number} x @param {number} z @param {number} hx @param {number} hz @param {number} w
     * @param {{ a?: number, ry?: number, fill?: boolean, color?: THREE.ColorRepresentation, k?: number }} [o]
     */
    rrect(x, z, hx, hz, w, { a = 0.35, ry = 0, fill = true, color = '#10162a', k = 3 } = {}) {
      c.set(color);
      const cs = Math.cos(ry), sn = Math.sin(ry);
      const ring = (d, al) => {
        const out = [];
        for (const [sx, sz, t0] of [[1, 1, 0], [-1, 1, 0.5], [-1, -1, 1], [1, -1, 1.5]]) {
          for (let i = 0; i <= k; i++) {
            const t = (t0 + (i / k) * 0.5) * Math.PI;
            const lx = sx * hx + Math.cos(t) * d, lz = sz * hz + Math.sin(t) * d;
            out.push([x + lx * cs - lz * sn, z + lx * sn + lz * cs, al]);
          }
        }
        return out;
      };
      rings([ring(0.001, a), ring(w * 0.32, a * 0.52), ring(w, 0)], fill ? [x, z, a] : null);
    },
    /**
     * Faixa ao longo de um segmento (pé de parede, de mureta, de degrau): `a` na linha, sumindo em w para o lado
     * (nx, nz); as pontas afinam em `taper` m.
     * @param {number} ax @param {number} az @param {number} bx @param {number} bz @param {number} nx @param {number} nz @param {number} w
     * @param {{ a?: number, color?: THREE.ColorRepresentation, taper?: number }} [o]
     */
    strip(ax, az, bx, bz, nx, nz, w, { a = 0.32, color = '#10162a', taper = 0 } = {}) {
      c.set(color);
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1e-3) return;
      const n = Math.max(1, Math.ceil(len / 1.5));
      const at = (s, d, al) => [ax + ((bx - ax) * s) / len + nx * d, az + ((bz - az) * s) / len + nz * d, al];
      for (let i = 0; i < n; i++) {
        const s0 = (len * i) / n, s1 = (len * (i + 1)) / n;
        const f = (s) => (taper > 0 ? Math.min(1, s / taper, (len - s) / taper) : 1);
        const k0 = f(s0), k1 = f(s1);
        const A = [at(s0, 0, a * k0), at(s0, w * 0.3, a * 0.5 * k0), at(s0, w, 0)];
        const B = [at(s1, 0, a * k1), at(s1, w * 0.3, a * 0.5 * k1), at(s1, w, 0)];
        for (let j = 0; j < 2; j++) { tri(A[j], B[j], B[j + 1]); tri(A[j], B[j + 1], A[j + 1]); }
      }
    },
    /** Quantos triângulos já tem. */
    get count() { return pos.length / 9; },
    /** @returns {THREE.BufferGeometry | null} */
    geometry() {
      if (!pos.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(rgba, 4));
      return g;
    },
  };
}

/**
 * Caixa reta com a base em y = 0 e as faces cortadas a cada `step` m (largura e altura): a cor por vértice de uma
 * parede (weathered) precisa dos vértices no meio dela para as manchas aparecerem.
 */
export function wallBox(w, h, d, step = 0.3) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.ceil(w / step)), Math.max(1, Math.ceil(h / step)), Math.max(1, Math.ceil(d / step)));
  g.translate(0, h / 2, 0);
  return g;
}

const _wc = new THREE.Color();
/**
 * Reboco pintado e gasto pelo tempo (cor por vértice, no referencial da peça): o grão do reboco, manchas de repintura,
 * o barrado de respingos de terra embaixo, a umidade subindo do chão em manchas, o musgo perto das pontas e os
 * escorridos embaixo do beiral ou do chapim, com a sombra da pingadeira logo abaixo dele. Use numa peça subdividida
 * (wallBox) ao longo de x (along 'x') ou de z.
 * @param {THREE.ColorRepresentation} base a cor da tinta
 * @param {{ h?: number, y0?: number, seed?: number, along?: 'x' | 'z', half?: number, moss?: number, splash?: number,
 *           damp?: number, streak?: number, eave?: number, inside?: THREE.ColorRepresentation | null, out?: [number, number] }} [o]
 *   h: o alto da parede (a pingadeira); y0: onde a peça começa (no mundo); half: meio comprimento (o musgo nas pontas);
 *   inside/out: a face voltada para o lado oposto de (out[0], out[1]) fica com a cor `inside`, lisa (o lado de dentro
 *   das paredes de casa); as outras levam o desgaste.
 * @returns {(p: THREE.Vector3, n: THREE.Vector3) => THREE.Color}
 */
export function weathered(base, { h = 2.5, y0 = 0, seed = 0, along = 'x', half = 0, moss = 0.55, splash = 1, damp = 1, streak = 1, eave = 0.22, inside = null, out = null } = {}) {
  const c0 = new THREE.Color(base), c1 = c0.clone().offsetHSL(0, -0.03, 0.04);
  const splashC = c0.clone().multiply(new THREE.Color(0.66, 0.6, 0.5)), dampC = c0.clone().multiply(new THREE.Color(0.74, 0.76, 0.66));
  const streakC = c0.clone().multiply(new THREE.Color(0.74, 0.7, 0.62)), mossC = new THREE.Color('#6f8446');
  const inC = inside == null ? null : new THREE.Color(inside);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return (p, n) => {
    if (inC && out && n.x * out[0] + n.z * out[1] < -0.5) return _wc.copy(inC).multiplyScalar(0.86 + 0.14 * Math.min(1, Math.max(0, (p.y + y0) / 0.45)));
    const a = along === 'x' ? p.x : p.z, u = a + seed * 7.31, y = p.y + y0;
    _wc.copy(c0).multiplyScalar(0.88 + fbm2(u * 0.8 + seed, y * 1.3 - seed, 3) * 0.22);
    _wc.lerp(c1, sm(0.56, 0.64, fbm2(u * 0.22 + seed * 5.1, y * 0.45 - seed, 2)) * 0.5);
    _wc.lerp(splashC, (1 - sm(0.06, 0.36, y)) * (0.4 + 0.3 * vnoise2(u * 3.1 + seed, 1.7)) * splash);
    _wc.lerp(dampC, (1 - sm(0.2, 0.95, y - 0.25 * fbm2(u * 0.9, seed, 2))) * sm(0.35, 0.68, fbm2(u * 0.45 + seed * 3.1, 2.7, 2)) * 0.65 * damp);
    if (half > 0) _wc.lerp(mossC, (1 - sm(0.05, 0.6, half - Math.abs(a))) * (1 - sm(0.12, 0.55, y)) * sm(0.38, 0.62, fbm2(u * 1.3 + seed, 4.1, 2)) * moss);
    _wc.lerp(streakC, sm(h - 0.85, h - 0.1, y) * sm(0.42, 0.78, vnoise2(u * 3.4 + seed * 9.1, 0.5)) * 0.55 * streak);
    return _wc.multiplyScalar(1 - sm(h - eave, h - 0.02, y) * 0.22);
  };
}

/** Índice 0, 1, 2… (peças sem índice entram no balde junto com as indexadas). */
function trivialIndex(n) {
  const a = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  return new THREE.BufferAttribute(a, 1);
}
/**
 * Sombreado de maquete: escurece a base da peça (até 20 %, nos primeiros ~0,9 m ou na metade dela, o que for menor),
 * como a sombra de contato do chão; as peças baixas quase não mudam. Antes da escala/posição (sy: a escala em y).
 */
function shadeBase(g, sy = 1) {
  const pos = g.attributes.position, col = g.attributes.color;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const h = (maxY - minY) * Math.abs(sy);
  if (!(h > 0.12)) return;
  const reach = Math.min(0.9, h * 0.5) / Math.abs(sy);
  const depth = Math.min(0.2, 0.06 + h * 0.08);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, (pos.getY(i) - minY) / reach);
    const k = 1 - depth * (1 - t * t * (3 - 2 * t));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
}

// ---------------------------------------------------------------- formas
/**
 * Modelos de caixa arredondada por número de segmentos: cada vértice guarda o canto (sinal de x, y, z) e a normal. Uma
 * caixa w × h × d de raio r é só canto × (meia medida − r) + normal × r: igual à RoundedBoxGeometry e muito mais rápida
 * (a cidade tem milhares de caixas).
 * Com índice: os vértices iguais (mesma posição e normal) viram um só.
 * @type {Map<number, { sign: Float32Array, normal: Float32Array, count: number, index: Uint16Array | Uint32Array }>}
 */
const RB = new Map();
function rbTemplate(seg) {
  let t = RB.get(seg);
  if (t) return t;
  const g0 = new RoundedBoxGeometry(1, 1, 1, seg, 0.25);
  g0.deleteAttribute('uv');
  const g = mergeVertices(g0.index ? g0.toNonIndexed() : g0, 1e-5);
  const pos = g.attributes.position.array;
  const sign = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i++) sign[i] = pos[i] < 0 ? -1 : 1;
  const idx = g.index.array;
  t = { sign, normal: Float32Array.from(g.attributes.normal.array), count: g.attributes.position.count, index: idx.length > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx) };
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
  g.setIndex(new THREE.BufferAttribute(t.index.slice(), 1));
  return g;
}
/** Cilindro (ou tronco de cone) com a base em y = 0. */
export function cyl(rTop, rBot, h, seg = 14) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  g.translate(0, h / 2, 0);
  return g;
}
export const sphere = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
/** Haste centrada na origem (ao longo de y): para deitar com rotate e pôr pelo meio (varais, traves, cordões). */
export const rod = (r, len, seg = 8) => new THREE.CylinderGeometry(r, r, len, seg);
/** Caixa reta com a base em y = 0 (chão, faixas). */
export function slab(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

/**
 * Ladrilhos: um plano deitado w × d (centrado, voltado para cima) cortado em quadrados de cw × cd, cada um com a cor que
 * fn dá para o centro dele (pisos de tábua, xadrez, emborrachado, toalhas). A cor por vértice de uma caixa só tem os
 * cantos: um desenho nela vira degradê; aqui cada quadrado tem os seus vértices.
 * @param {number} w @param {number} d @param {number} cw @param {number} cd
 * @param {(p: THREE.Vector3, n: THREE.Vector3) => THREE.Color} fn
 */
export function tiles(w, d, cw, cd, fn) {
  const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / cw)), Math.max(1, Math.round(d / cd))).rotateX(-Math.PI / 2);
  return paintQuads(g, fn, true);
}
/**
 * O mesmo, em pé (plano w × h voltado para +z, centrado): lombadas de livros, listras.
 * @param {number} w @param {number} h @param {number} cw @param {number} ch
 * @param {(p: THREE.Vector3, n: THREE.Vector3) => THREE.Color} fn
 */
export function tilesV(w, h, cw, ch, fn) {
  return paintQuads(new THREE.PlaneGeometry(w, h, Math.max(1, Math.round(w / cw)), Math.max(1, Math.round(h / ch))), fn, false);
}
/**
 * @param {THREE.BufferGeometry} g0
 * @param {(p: THREE.Vector3, n: THREE.Vector3) => THREE.Color} fn
 * @param {boolean} flat
 */
function paintQuads(g0, fn, flat) {
  const g = g0.toNonIndexed();
  g0.dispose();
  g.deleteAttribute('uv');
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3(), n = flat ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  // cada quadrado são dois triângulos seguidos (6 vértices): a cor sai do centro dele
  for (let i = 0; i < pos.count; i += 6) {
    p.set(0, 0, 0);
    for (let k = 0; k < 6; k++) p.set(p.x + pos.getX(i + k) / 6, p.y + pos.getY(i + k) / 6, p.z + pos.getZ(i + k) / 6);
    const c = fn(p, n);
    for (let k = 0; k < 6; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
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
  // o vidro fica 3 mm para dentro da moldura: nenhuma face dele no mesmo plano das pontas das travessas
  kit.add(slab(w - 0.006, h - 0.006, 0.02), { color: lit ? '#ffe2a0' : '#8ec1df', slot: lit ? 'lit' : 'glass', x: x + nx * (o + 0.03), y: y - h / 2 + 0.003, z: z + nz * (o + 0.03), ry, group });
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
  const post = slab(0.08, h - 0.06, 0.035); // reta: de longe não se vê o arredondado (e são centenas)
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
