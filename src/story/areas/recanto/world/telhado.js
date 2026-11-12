// RECANTO DAS PATINHAS — o TERRAÇO DA TORRE jogável (pedido do usuário em 2026-11-11: o depois da porta da torre era só
// uma animação). O núcleo só anda no chão (y = 0) e a colisão é 2D: o terraço é um cenário à parte, montado NO CHÃO,
// longe do condomínio, a leste (layout.ROOFTOP), e a "queda" em volta dele é cenário:
//   telhado   o piso de lajotas com as manchas da chuva, as muretas com a capa, a casinha da escada (a porta aberta, de
//             onde as duas saem), a CAIXA D'ÁGUA grande com o alçapão (a TAMPA de borracha: props.rooftop.lid) e a
//             ESCADA DE MARINHEIRO (o lance de baixo recolhido e travado no alto: props.rooftop.ladder, com o puxador da
//             trava: props.rooftop.latch), a antena de TV, o varal de terraço com as roupas, o ar-condicionado velho com
//             o ventilador girando, o carrinho de mão esquecido, a pilha de caixas, os vasos, o ralo e as poças;
//   predio    a fachada do prédio descendo até ROOFTOP.fall, com as janelas dos andares e a cornija;
//   baixo-*   lá embaixo: a calçada em volta, as ruas, as copas das árvores, os telhados baixos, os prédios vizinhos (os
//             do oeste tapam o caminho até o condomínio) e, ao norte, a cidade com a torre do relógio parado.
// O que se mexe: o CAIXOTE de feira (props.rooftop.crate, caixa empurrável), o lance da escada, o puxador, a tampa, as
// PENAS da fuga (props.rooftop.feathers) e a hélice do ar-condicionado.
// Os pisos de andar têm o alto até 0,02 m (as dogs andam em y = 0). O que fica em pé onde elas andam está dentro de um
// colisor 'telhado-*' do layout (o "vazio" em volta também é colisor: ninguém anda lá).
// Sem luz nova (o sol e o céu do jogo). Orçamento: ~70 mil triângulos (tri() conta).
// API: buildTelhado(kit, root, L) → { props: { rooftop }, update(dt, t), reset(), tris }
import * as THREE from 'three';
import { paint, mergeGeometries, fbm2, rng } from '../../../../world/util.js';
import { rb, cyl, slab, tiles, hipRoof, SLOTS } from '../../../../levels/mapa/world/kit.js';
import { flowerBush } from '../../../../levels/mapa/world/pecas.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const col = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------- ajudantes de cor e de forma
function hash(i, j, s = 0) {
  const n = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
/** Cor com variação leve e estável por posição (reboco, concreto, madeira). */
function speckle(hex, amp = 0.05, seed = 1) {
  const base = new THREE.Color(hex), out = new THREE.Color();
  return (p) => out.copy(base).offsetHSL(0, 0, (hash(Math.floor(p.x * 9), Math.floor(p.y * 9) + Math.floor(p.z * 9) * 57, seed) - 0.5) * amp);
}
/** Duas cores pela direção da face: `inside` nas voltadas para (dx, dz). */
function twoTone(out, inside, dx, dz) {
  const fo = typeof out === 'function' ? out : (() => { const c = col(out); return () => c; })();
  const fi = typeof inside === 'function' ? inside : (() => { const c = col(inside); return () => c; })();
  return (p, n) => (n.x * dx + n.z * dz > 0.5 ? fi(p, n) : fo(p, n));
}
/** Haste (cilindro de raio r) de a até b. */
function stick(a, b, r, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const geo = new THREE.CylinderGeometry(r, r, d.length(), seg);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}
/** Mancha deitada de contorno irregular (raio r), voltada para cima. */
function blob(r, seed = 1, n = 16, wob = 0.18) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + wob * (0.6 * Math.sin(2 * a + seed) + 0.4 * Math.sin(3 * a + seed * 2.1)));
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ShapeGeometry(s, 1).rotateX(-Math.PI / 2);
}
/** Retângulos deitados, voltados para cima, em y = 0: [x0, z0, x1, z1, cor]. */
function flatQuads(list) {
  const pos = [], nor = [], colr = [];
  const c = new THREE.Color();
  for (const [x0, z0, x1, z1, hex] of list) {
    c.set(hex);
    for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) {
      pos.push(x, 0, z);
      nor.push(0, 1, 0);
      colr.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return g;
}
/**
 * Retângulos em pé, no plano z = 0 voltados para +z: [x0, y0, x1, y1, cor] (as janelas de uma fachada numa geometria só).
 */
function wallQuads(list) {
  const pos = [], nor = [], colr = [];
  const c = new THREE.Color();
  for (const [x0, y0, x1, y1, hex] of list) {
    c.set(hex);
    for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y0], [x1, y1], [x0, y1]]) {
      pos.push(x, y, 0);
      nor.push(0, 0, 1);
      colr.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  return g;
}

const KEEP = ['position', 'normal', 'color'];
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** Peças pintadas numa geometria só, para o que se mexe: [geometria, { color, x, y, z, rx, ry, rz, sx, sy, sz }]. */
function bake(list) {
  const parts = [];
  for (const [geo, o = {}] of list) {
    const g = geo.clone();
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (o.color !== null || !g.attributes.color) paint(g, o.color ?? '#ffffff');
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _m4.compose(_p.set(o.x || 0, o.y || 0, o.z || 0), _q.setFromEuler(_e), _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    parts.push(g.applyMatrix4(_m4));
  }
  const out = mergeGeometries(parts);
  for (const g of parts) g.dispose();
  return out;
}
function mesh(geo, material, { cast = true, receive = true, name = '' } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}
/** Contagem de triângulos de uma geometria (o orçamento). */
const triCount = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

/** Copa de árvore vista de cima (três bolhas, a de cima mais clara). */
function crownGeo(seed, colors) {
  const R = rng(seed);
  const parts = [];
  const blobs = [{ x: 0, y: 0, z: 0, r: 1.5 }, { x: 0.9, y: -0.35, z: 0.4, r: 1.05 }, { x: -0.8, y: -0.25, z: -0.5, r: 1.1 }];
  const dark = col(colors[0]), mid = col(colors[1]), light = col(colors[2]), c = new THREE.Color();
  for (const b of blobs) {
    const g = new THREE.IcosahedronGeometry(b.r * (0.9 + R() * 0.2), 1);
    g.scale(1, 0.82, 1);
    g.translate(b.x, b.y, b.z);
    paint(g, (p, n) => c.copy(dark).lerp(mid, THREE.MathUtils.clamp(n.y * 0.5 + 0.5, 0, 1)).lerp(light, Math.max(0, n.y) * 0.45 * (0.6 + 0.4 * hash(Math.round(p.x * 3), Math.round(p.z * 3), seed))));
    parts.push(g);
  }
  const out = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  for (const g of parts) g.dispose();
  return out;
}

// ================================================================ o cenário
/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Object3D} root
 * @param {any} L o layout do Recanto
 */
export function buildTelhado(kit, root, L) {
  const R = L.ROOFTOP;
  if (!R) return { props: {}, tris: 0 };
  let tris = 0;
  /** Põe no balde e conta os triângulos. */
  const put = (geo, o) => { tris += triCount(geo); kit.add(geo, o); };
  const g = 'telhado';
  const add = (geo, o) => put(geo, { group: g, ...o });
  const FALL = R.fall;
  const rt = R.t / 2;
  const H = L.ROOF_HUT, T = L.ROOF_TANK, LD = L.ROOF_LADDER, AC = L.ROOF_AC, AN = L.ROOF_ANTENNA, LN = L.ROOF_LINE;
  const trim = '#fbf6ec', iron = '#5d6368', metal = '#8e959a';
  const facade = speckle('#efd9bd', 0.035, 61), inner = speckle('#ecdcc4', 0.03, 62);
  const ox0 = R.x0 - rt, ox1 = R.x1 + rt, oz0 = R.z0 - rt, oz1 = R.z1 + rt; // as faces de fora das muretas
  const ix0 = R.x0 + rt, ix1 = R.x1 - rt, iz0 = R.z0 + rt, iz1 = R.z1 - rt; // as faces de dentro

  // ---------------------------------------------------------------- o piso: lajotas com as manchas da chuva
  {
    const dry = ['#d9c2a2', '#cfb592', '#dcc6a7', '#c9ad8a'].map(col), wet = col('#9f8b72'), out = new THREE.Color();
    const floorRect = (x0, x1, z0, z1, seed) => {
      if (x1 - x0 < 0.2 || z1 - z0 < 0.2) return;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const fn = (p) => {
        const wx = p.x + cx, wz = p.z + cz;
        out.copy(dry[Math.floor(hash(Math.floor(wx / 0.5 + 200), Math.floor(wz / 0.5 + 200), seed) * dry.length)]);
        // as manchas da chuva: escuras onde a água empoçou de noite, mais perto das muretas e dos ralos
        const damp = THREE.MathUtils.smoothstep(fbm2(wx * 0.32 + 4, wz * 0.32 - 7, 3), 0.5, 0.68);
        return out.lerp(wet, damp * 0.55);
      };
      add(tiles(x1 - x0, z1 - z0, 0.5, 0.5, fn), { color: null, slot: 'ground', x: cx, y: 0.004, z: cz, ao: false });
    };
    // três retângulos: fora da casinha e fora da caixa d'água (embaixo delas não se vê piso)
    floorRect(ix0, H.x1, iz0, H.z0, 1);
    floorRect(H.x1, T.x0, iz0, iz1, 2);
    floorRect(T.x0, ix1, T.z1, iz1, 3);
    // as poças da noite e o ralo
    for (const [x, z, r, s] of [[67.4, -7.6, 0.42, 2], [71.8, -4.6, 0.3, 5], [65.1, -9.3, 0.26, 8], [73.4, -2.2, 0.22, 11]]) {
      add(blob(r, s), { color: '#a6957c', slot: 'glass', x, y: 0.0075, z, sz: 0.7, ao: false });
    }
    const gr = 0.09, gb = 0.02, list = [[-gr, -gr, gr, -gr + gb, '#c9ced2'], [-gr, gr - gb, gr, gr, '#c9ced2'], [-gr, -gr + gb, -gr + gb, gr - gb, '#c9ced2'], [gr - gb, -gr + gb, gr, gr - gb, '#c9ced2']];
    for (let i = 0; i < 5; i++) list.push([-gr + gb, -gr + gb + (i * (2 * gr - 2 * gb)) / 5, gr - gb, -gr + gb + ((i + 1) * (2 * gr - 2 * gb)) / 5, i % 2 ? '#c9ced2' : '#2f3134']);
    add(flatQuads(list), { color: null, slot: 'ground', x: 70.9, y: 0.0065, z: -1.6, ao: false });
  }

  // ---------------------------------------------------------------- as muretas com a capa (fora dos cantos da casinha e da caixa)
  {
    const PH = R.parapet;
    // a capa sai 3 cm para cada lado; nas do oeste e do leste, ela para onde começa a do norte ou a do sul (nada de
    // duas capas uma em cima da outra nos cantos)
    const wall = (ax, bx, az, bz, dx, dz, cap) => {
      add(rb(bx - ax, PH, bz - az, 0.02, 1), { color: twoTone(facade, inner, dx, dz), x: (ax + bx) / 2, y: -0.002, z: (az + bz) / 2 });
      const [cx0, cx1, cz0, cz1] = cap;
      add(rb(cx1 - cx0, 0.045, cz1 - cz0, 0.012, 1), { color: trim, x: (cx0 + cx1) / 2, y: PH - 0.004, z: (cz0 + cz1) / 2, ao: false });
    };
    const c = 0.03;
    wall(ox0, T.x0, oz0, iz0, 0, 1, [ox0 - c, T.x0 + c, oz0 - c, iz0 + c]); // norte, até a caixa d'água
    wall(H.x1, ox1, iz1, oz1, 0, -1, [H.x1 - c, ox1 + c, iz1 - c, oz1 + c]); // sul, da casinha para o leste
    wall(ox0, ix0, iz0, H.z0, 1, 0, [ox0 - c, ix0 + c, iz0 + c, H.z0 + c]); // oeste, até a casinha
    wall(ix1, ox1, T.z1, iz1, -1, 0, [ix1 - c, ox1 + c, T.z1 - c, iz1 - c]); // leste, da caixa d'água para o sul
    // o degrau de concreto do mirante, encostado na mureta do norte (com o colisor 'telhado-degrau')
    const ST = L.ROOF_STEP;
    if (ST) {
      add(rb(ST.x1 - ST.x0, ST.h + 0.002, ST.z1 - ST.z0 - 0.005, 0.015, 1), { color: speckle('#c9c1b3', 0.05, 66), x: (ST.x0 + ST.x1) / 2, y: -0.002, z: (ST.z0 + ST.z1 + 0.005) / 2 });
      add(blob(0.18, 13), { color: '#8a857c', slot: 'glass', x: ST.x0 + 0.4, y: ST.h + 0.0035, z: (ST.z0 + ST.z1) / 2, sz: 0.6, ao: false });
    }
    // os buzinotes das muretas (a chuva escorreu por eles)
    for (const [x, z, dx, dz] of [[68.4, oz0, 0, -1], [71.4, oz1, 0, 1], [ox1, -6.2, 1, 0], [ox0, -6.4, -1, 0]]) {
      add(stick(V(x - dx * 0.12, 0.05, z - dz * 0.12), V(x + dx * 0.16, 0.03, z + dz * 0.16), 0.03, 8), { color: '#9aa1a6', ao: false });
    }
  }

  // ---------------------------------------------------------------- a fachada do prédio (a queda)
  {
    const gb = 'telhado';
    const fx0 = ox0 - 0.02, fx1 = ox1 + 0.02, fz0 = oz0 - 0.02, fz1 = oz1 + 0.02;
    const body = speckle('#e9cfae', 0.03, 63), base = speckle('#b98f6a', 0.04, 64);
    put(rb(fx1 - fx0, -FALL - 3.0 - 0.002, fz1 - fz0, 0.03, 1), { color: body, x: (fx0 + fx1) / 2, y: FALL + 3.0, z: (fz0 + fz1) / 2, group: gb });
    put(rb(fx1 - fx0 + 0.04, 3.0, fz1 - fz0 + 0.04, 0.03, 1), { color: base, x: (fx0 + fx1) / 2, y: FALL, z: (fz0 + fz1) / 2, group: gb });
    // a cornija logo abaixo da mureta e os frisos entre os andares
    put(rb(fx1 - fx0 + 0.16, 0.18, fz1 - fz0 + 0.16, 0.03, 1), { color: trim, x: (fx0 + fx1) / 2, y: -0.34, z: (fz0 + fz1) / 2, group: gb, ao: false });
    for (const y of [FALL + 3.0, FALL + 6.0]) put(rb(fx1 - fx0 + 0.08, 0.1, fz1 - fz0 + 0.08, 0.02, 1), { color: trim, x: (fx0 + fx1) / 2, y, z: (fz0 + fz1) / 2, group: gb, ao: false });
    // as janelas: moldura clara, o vidro (ora a cortina, ora o reflexo do céu) e o peitoril; a porta e o toldo no térreo
    const faces = [
      { cx: (fx0 + fx1) / 2, cz: fz1 + 0.025, w: fx1 - fx0, ry: 0 },
      { cx: (fx0 + fx1) / 2, cz: fz0 - 0.025, w: fx1 - fx0, ry: Math.PI },
      { cx: fx1 + 0.025, cz: (fz0 + fz1) / 2, w: fz1 - fz0, ry: Math.PI / 2 },
      { cx: fx0 - 0.025, cz: (fz0 + fz1) / 2, w: fz1 - fz0, ry: -Math.PI / 2 },
    ];
    const glass = ['#8fb6d3', '#9cc3dc', '#f1e3c8', '#e8b9a6', '#7fa4c4'];
    faces.forEach((f, fi) => {
      const frames = [], panes = [];
      const cols = Math.max(3, Math.floor(f.w / 2.1));
      for (let r = 0; r < 3; r++) {
        const y0 = FALL + 1.0 + r * 3.0;
        for (let i = 0; i < cols; i++) {
          const x = -f.w / 2 + (f.w * (i + 0.5)) / cols;
          if (r === 0 && fi === 0 && i === Math.floor(cols / 2)) continue; // a porta do prédio
          frames.push([x - 0.52, y0 - 0.08, x + 0.52, y0 + 1.48, '#f8f1e3']);
          const gi = Math.floor(hash(i, r, fi) * glass.length);
          panes.push([x - 0.44, y0, x - 0.02, y0 + 1.4, glass[gi]], [x + 0.02, y0, x + 0.44, y0 + 1.4, glass[(gi + 1) % glass.length]]);
        }
      }
      put(wallQuads(frames), { color: null, x: f.cx, y: 0, z: f.cz, ry: f.ry, group: gb, ao: false });
      const pz = 0.012;
      const s = Math.sin(f.ry), c = Math.cos(f.ry);
      put(wallQuads(panes), { color: null, slot: 'glass', x: f.cx + s * pz, y: 0, z: f.cz + c * pz, ry: f.ry, group: gb, ao: false });
      // os peitoris (uma barra por janela, para fora)
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < cols; i++) {
          if (r === 0 && fi === 0 && i === Math.floor(cols / 2)) continue;
          const x = -f.w / 2 + (f.w * (i + 0.5)) / cols;
          put(slab(1.14, 0.06, 0.12), { color: trim, x: f.cx + c * x + s * 0.05, y: FALL + 0.86 + r * 3.0, z: f.cz - s * x + c * 0.05, ry: f.ry, group: gb, ao: false });
        }
      }
    });
    // a porta do prédio (face sul) com o toldinho
    const dcx = (fx0 + fx1) / 2;
    put(wallQuads([[-0.7, 0, 0.7, 2.3, '#6f4a2e'], [-0.05, 0.1, 0.05, 2.2, '#4a3220']]), { color: null, x: dcx, y: FALL + 0.01, z: fz1 + 0.03, group: gb, ao: false });
    put(rb(2.0, 0.08, 1.0, 0.02, 1).rotateX(0.18), { color: '#3f7f86', x: dcx, y: FALL + 2.62, z: fz1 + 0.5, group: gb, ao: false });
  }

  // ---------------------------------------------------------------- a casinha da escada (canto sudoeste), a porta aberta a leste
  {
    const HH = H.h, hw = 0.12, D = H.door;
    const hutWall = (ax, bx, az, bz, y0, y1, dx, dz) => add(rb(bx - ax, y1 - y0, bz - az, 0.015, 1), { color: twoTone(facade, '#4d4844', dx, dz), x: (ax + bx) / 2, y: y0, z: (az + bz) / 2 });
    const hx0 = H.x0 - rt, hx1 = H.x1, hz0 = H.z0, hz1 = H.z1 + rt;
    hutWall(hx0, hx1, hz1 - hw - rt, hz1, -0.002, HH, 0, -1);
    hutWall(hx0, hx1, hz0, hz0 + hw, -0.002, HH, 0, 1);
    hutWall(hx0, hx0 + hw + rt, hz0 + hw, hz1 - hw - rt, -0.002, HH, 1, 0);
    hutWall(hx1 - hw, hx1, hz0 + hw, D.z0, -0.002, HH, -1, 0);
    hutWall(hx1 - hw, hx1, D.z1, hz1 - hw - rt, -0.002, HH, -1, 0);
    hutWall(hx1 - hw, hx1, D.z0, D.z1, D.h, HH, -1, 0);
    add(rb(hx1 - hx0 + 0.2, 0.12, hz1 - hz0 + 0.2, 0.03, 1), { color: trim, x: (hx0 + hx1) / 2, y: HH, z: (hz0 + hz1) / 2, ao: false });
    // lá dentro: o escuro e o corrimão do alto da escada
    add(new THREE.PlaneGeometry(hx1 - hx0 - 2 * hw - rt, hz1 - hz0 - 2 * hw - rt).rotateX(-Math.PI / 2), { color: '#2e2a27', slot: 'ground', x: (hx0 + hw + rt + hx1 - hw) / 2, y: 0.006, z: (hz0 + hw + hz1 - hw - rt) / 2, ao: false });
    add(stick(V(hx0 + 0.9, 0.006, hz0 + 0.5), V(hx0 + 0.9, 0.9, hz0 + 0.5), 0.014, 5), { color: metal, ao: false });
    add(stick(V(hx0 + 0.9, 0.9, hz0 + 0.5), V(hx0 + 0.9, 0.9, hz1 - 0.6), 0.014, 5), { color: metal, ao: false });
    // o batente, a folha aberta para dentro (encostada na parede norte de dentro) e a arandela acesa
    for (const z of [D.z0 - 0.03, D.z1 + 0.03]) add(slab(0.04, D.h + 0.06, 0.06), { color: trim, x: hx1 + 0.012, y: 0, z, ao: false });
    add(slab(0.044, 0.06, D.z1 - D.z0 + 0.12), { color: trim, x: hx1 + 0.014, y: D.h, z: (D.z0 + D.z1) / 2, ao: false });
    const leafW = D.z1 - D.z0 - 0.04;
    add(rb(0.04, D.h - 0.03, leafW, 0.01, 1), { color: '#3f7f86', x: hx1 - hw - 0.04 - leafW * 0.5 * Math.sin(1.35), y: 0.012, z: D.z0 + 0.02 + leafW * 0.5 * Math.cos(1.35), ry: 1.35 });
    add(slab(0.03, 0.12, 0.1), { color: iron, x: hx1 + 0.015, y: D.h + 0.14, z: (D.z0 + D.z1) / 2, ao: false });
    add(new THREE.SphereGeometry(0.05, 10, 8), { color: '#fff2c8', slot: 'lit', x: hx1 + 0.07, y: D.h + 0.15, z: (D.z0 + D.z1) / 2, ao: false });
    // a veneziana do respiro, na face norte
    add(slab(0.34, 0.24, 0.012), { color: '#d6cbb8', x: (hx0 + hx1) / 2, y: 1.5, z: hz0 - 0.004, ao: false });
    for (let k = 0; k < 4; k++) add(slab(0.3, 0.02, 0.008), { color: '#3a3734', x: (hx0 + hx1) / 2, y: 1.54 + k * 0.046, z: hz0 - 0.012, ao: false });
    // no teto: a antena parabólica e o cano do respiro
    const dx = hx0 + 0.7, dz = hz1 - 0.8, dy = HH + 0.12;
    add(stick(V(dx, dy, dz), V(dx, dy + 0.5, dz), 0.02, 6), { color: metal, ao: false });
    const dish = new THREE.SphereGeometry(0.34, 14, 6, 0, TAU, 0, 0.75);
    dish.rotateX(-Math.PI / 2 + 0.5);
    add(dish, { color: '#e9ebec', x: dx, y: dy + 0.62, z: dz - 0.05, ry: 0.6, ao: false });
    add(stick(V(dx, dy + 0.62, dz - 0.05), V(dx + 0.18, dy + 0.78, dz - 0.38), 0.008, 4), { color: metal, ao: false });
    add(cyl(0.05, 0.05, 0.35, 10), { color: '#9aa3a8', x: hx1 - 0.5, y: HH + 0.12, z: hz0 + 0.5, ao: false });
    add(cyl(0.09, 0.07, 0.05, 10), { color: '#b8c0c5', x: hx1 - 0.5, y: HH + 0.47, z: hz0 + 0.5, ao: false });
  }

  // ---------------------------------------------------------------- a caixa d'água grande (canto nordeste)
  const tk = { x0: T.x0, x1: ox1 + 0.02, z0: oz0 - 0.02, z1: T.z1 };
  {
    const tkc = speckle('#f1e3cd', 0.035, 71);
    const kxc = (tk.x0 + tk.x1) / 2, kzc = (tk.z0 + tk.z1) / 2, kw = tk.x1 - tk.x0, kd = tk.z1 - tk.z0;
    add(rb(kw, T.h - 0.1, kd, 0.03, 1), { color: tkc, x: kxc, y: -0.002, z: kzc });
    add(rb(kw + 0.08, 0.1, kd + 0.08, 0.02, 1), { color: trim, x: kxc, y: T.h - 0.1, z: kzc, ao: false });
    add(slab(kw + 0.012, 0.12, kd + 0.012), { color: '#e2cba9', x: kxc, y: 0.3, z: kzc, ao: false });
    // a gota azul pintada nas faces sul e oeste
    const dropS = new THREE.Shape();
    dropS.moveTo(0, 0.34);
    dropS.bezierCurveTo(0.05, 0.18, 0.21, 0.04, 0.21, -0.1);
    dropS.absarc(0, -0.1, 0.21, 0, Math.PI, true);
    dropS.bezierCurveTo(-0.21, 0.04, -0.05, 0.18, 0, 0.34);
    const dropGeo = new THREE.ShapeGeometry(dropS, 8);
    add(dropGeo, { color: '#3f9fd8', x: tk.x0 + 0.75, y: 1.9, z: tk.z1 + 0.007, ao: false });
    add(dropGeo, { color: '#3f9fd8', x: tk.x0 - 0.007, y: 1.9, z: kzc + 0.4, ry: -Math.PI / 2, ao: false });
    // o alçapão: o aro, o buraco escuro (embaixo da tampa: props.rooftop.lid) e o respiro
    const hc = T.hatch;
    add(new THREE.TorusGeometry(hc.r + 0.04, 0.035, 6, 20).rotateX(Math.PI / 2), { color: '#9aa3a8', x: hc.x, y: T.h + 0.03, z: hc.z, ao: false });
    add(new THREE.CircleGeometry(hc.r + 0.01, 20).rotateX(-Math.PI / 2), { color: '#141619', x: hc.x, y: T.h + 0.004, z: hc.z, ao: false });
    add(cyl(0.05, 0.05, 0.22, 10), { color: '#9aa3a8', x: tk.x1 - 0.45, y: T.h, z: tk.z0 + 0.45, ao: false });
    add(cyl(0.1, 0.07, 0.05, 10), { color: '#b8c0c5', x: tk.x1 - 0.45, y: T.h + 0.22, z: tk.z0 + 0.45, ao: false });
    // o ladrão escorrido na face oeste e a poça embaixo
    add(stick(V(tk.x0, 2.3, -10.8), V(tk.x0 - 0.2, 2.3, -10.8), 0.022, 8), { color: '#e9e4da', ao: false });
    add(slab(0.004, 2.25, 0.12), { color: '#d8c3a2', x: tk.x0 - 0.009, y: 0.02, z: -10.8, ao: false });
    add(blob(0.24, 6), { color: '#a6957c', slot: 'glass', x: tk.x0 - 0.36, y: 0.0075, z: -10.8, sz: 0.7, ao: false });
    // a escada de marinheiro (a parte fixa): os trilhos de LD.low até o alto, passando por cima da borda, e os degraus
    const lz = LD.z, lx = LD.x, hw2 = LD.w / 2;
    for (const sx of [-hw2, hw2]) {
      add(stick(V(lx + sx, LD.low, lz), V(lx + sx, T.h + 0.45, lz), 0.016, 6), { color: metal, ao: false });
      add(stick(V(lx + sx, T.h + 0.45, lz), V(lx + sx, T.h + 0.45, tk.z1 - 0.25), 0.014, 5), { color: metal, ao: false });
      add(stick(V(lx + sx, T.h + 0.45, tk.z1 - 0.25), V(lx + sx, T.h, tk.z1 - 0.25), 0.014, 5), { color: metal, ao: false });
      for (const y of [LD.low + 0.2, T.h - 0.25]) add(stick(V(lx + sx, y, tk.z1 + 0.004), V(lx + sx, y, lz), 0.011, 4), { color: metal, ao: false });
    }
    for (let y = LD.low + 0.36; y < T.h + 0.1; y += 0.3) add(stick(V(lx - hw2, y, lz), V(lx + hw2, y, lz), 0.012, 5), { color: metal, ao: false });
  }

  // ---------------------------------------------------------------- a antena de TV (o mastro com a base de concreto)
  {
    add(rb(AN.base * 2 - 0.02, 0.22, AN.base * 2 - 0.02, 0.02, 1), { color: speckle('#bdb6aa', 0.05, 73), x: AN.x, y: -0.002, z: AN.z });
    add(stick(V(AN.x, 0.2, AN.z), V(AN.x, AN.top, AN.z), 0.026, 8), { color: metal, ao: false });
    // a travessa onde os pombos pousam e as hastes da antena lá em cima
    add(stick(V(AN.x - 0.5, AN.bar, AN.z), V(AN.x + 0.5, AN.bar, AN.z), 0.016, 6), { color: '#9aa1a6', ao: false });
    add(stick(V(AN.x, AN.top - 0.12, AN.z - 0.55), V(AN.x, AN.top - 0.12, AN.z + 0.5), 0.012, 5), { color: metal, ao: false });
    for (let k = 0; k < 7; k++) {
      const zz = AN.z - 0.48 + k * 0.15, half = 0.36 - k * 0.035;
      add(stick(V(AN.x - half, AN.top - 0.12, zz), V(AN.x + half, AN.top - 0.12, zz), 0.006, 4), { color: '#aab1b6', ao: false });
    }
    // os estais (os cabos de aço até a mureta) e o cabo da TV descendo
    for (const [ax, az] of [[ix0 + 0.02, AN.z - 0.6], [AN.x + 1.1, iz0 + 0.02]]) add(stick(V(AN.x, AN.bar - 0.3, AN.z), V(ax, R.parapet - 0.02, az), 0.004, 3), { color: '#c9ced2', ao: false });
    add(stick(V(AN.x + 0.03, AN.top - 0.2, AN.z + 0.02), V(AN.x + 0.03, 0.22, AN.z + 0.02), 0.007, 4), { color: '#2b2d30', ao: false });
  }

  // ---------------------------------------------------------------- o varal de terraço: dois postes em T com dois fios
  const clothes = new THREE.Group();
  clothes.name = 'telhado:roupas';
  {
    const lzA = LN.a.z, lzB = LN.a.z + 0.16;
    for (const P of [LN.a, LN.b]) {
      add(cyl(0.07, 0.08, 0.04, 12), { color: '#8a8f94', x: P.x, y: -0.002, z: P.z, ao: false });
      add(stick(V(P.x, 0.02, P.z), V(P.x, LN.h + 0.06, P.z), LN.postR - 0.012, 8), { color: '#e8e8e2', ao: false });
      add(stick(V(P.x, LN.h + 0.04, lzA - 0.05), V(P.x, LN.h + 0.04, lzB + 0.05), 0.016, 6), { color: '#e8e8e2', ao: false });
    }
    // o fio dos pombos (o de cima, z = LN.a.z) e o das roupas
    add(stick(V(LN.a.x, LN.h, lzA), V(LN.b.x, LN.h, lzA), 0.006, 4), { color: '#f2f2ee', ao: false });
    add(stick(V(LN.a.x, LN.h - 0.01, lzB), V(LN.b.x, LN.h - 0.01, lzB), 0.006, 4), { color: '#f2f2ee', ao: false });
    // as roupas no fio de trás, longe de onde os pombos pousam: a toalha listrada, a camiseta, as meias
    const cloth = (w, h, colorAt) => {
      const nx = Math.max(2, Math.round(w / 0.08)), ny = Math.max(2, Math.round(h / 0.08));
      const geo = new THREE.PlaneGeometry(w, h, nx, ny).toNonIndexed();
      geo.translate(0, -h / 2, 0);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.012 * Math.sin((pos.getX(i) / w) * Math.PI * 2.5) * Math.min(1, -pos.getY(i) / h + 0.25));
      geo.computeVertexNormals();
      paint(geo, (p) => colorAt((p.x + w / 2) / w, -p.y / h));
      return geo;
    };
    const towel = cloth(0.62, 0.46, (u) => col(Math.floor(u * 8) % 2 ? '#f2c230' : '#3f9fd8'));
    const shirt = cloth(0.42, 0.4, () => col('#e45b5b'));
    const sockA = cloth(0.09, 0.22, (u, v) => col(v < 0.2 ? '#fffaf0' : '#7fbf6a'));
    /** @type {[THREE.BufferGeometry, number][]} */
    const parts = [[towel, 68.25], [shirt, 70.75], [sockA, 71.0]];
    const clothMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
    for (const [geo, x] of parts) {
      const m = mesh(geo, clothMat, { name: 'telhado:roupa' });
      m.position.set(x, LN.h - 0.012, lzB);
      clothes.add(m);
      tris += triCount(geo);
    }
    // os pregadores
    for (const x of [67.98, 68.52, 70.58, 70.92, 71.0]) add(slab(0.018, 0.05, 0.012), { color: '#4fa3d9', x, y: LN.h - 0.03, z: lzB, ao: false });
    root.add(clothes);
  }

  // ---------------------------------------------------------------- o ar-condicionado velho (a hélice gira)
  const fan = new THREE.Group();
  fan.name = 'telhado:ventilador';
  {
    const w = AC.x1 - AC.x0, d = AC.z1 - AC.z0, cx = (AC.x0 + AC.x1) / 2, cz = (AC.z0 + AC.z1) / 2;
    const rusty = (p) => { const c = col('#d9dcd8'); return c.lerp(col('#a46a3c'), THREE.MathUtils.smoothstep(fbm2(p.x * 3 + 9, p.y * 5 + p.z * 3, 3), 0.62, 0.8) * 0.6); };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(slab(0.07, 0.08, 0.07), { color: '#5d6368', x: cx + sx * (w / 2 - 0.08), y: -0.002, z: cz + sz * (d / 2 - 0.08), ao: false });
    add(rb(w - 0.02, AC.h - 0.08, d - 0.02, 0.03, 1), { color: rusty, x: cx, y: 0.078, z: cz });
    // a grade redonda na face oeste (de frente para o terraço) e as aletas
    const gx = AC.x0 - 0.002, gy = 0.46, gr = 0.3;
    for (const rr of [gr, gr * 0.66, gr * 0.33]) add(new THREE.TorusGeometry(rr, 0.008, 4, 22).rotateY(Math.PI / 2), { color: '#5d6368', x: gx - 0.012, y: gy, z: cz, ao: false });
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.008, gr * 2, 0.012), { color: '#5d6368', x: gx - 0.012, y: gy, z: cz, rx: (k * Math.PI) / 4, ao: false });
    add(new THREE.CircleGeometry(gr - 0.01, 20).rotateY(-Math.PI / 2), { color: '#1f2124', x: gx - 0.003, y: gy, z: cz, ao: false });
    for (let k = 0; k < 6; k++) add(slab(0.006, 0.012, d - 0.12), { color: '#9aa1a6', x: AC.x1 - 0.004, y: 0.18 + k * 0.09, z: cz, ao: false });
    // a tubulação de cobre entrando na mureta
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(AC.x1 - 0.1, 0.62, cz + 0.3), V(AC.x1 - 0.04, 0.7, cz + 0.42), V(AC.x1 + 0.0, 0.66, cz + 0.55), V(AC.x1 + 0.0, 0.4, cz + 0.6)]), 10, 0.016, 6), { color: '#b87333', ao: false });
    // a hélice (atrás da grade)
    const blades = [];
    for (let k = 0; k < 4; k++) {
      const b = new THREE.BoxGeometry(0.012, 0.2, 0.08);
      b.translate(0, 0.13, 0);
      b.rotateY(0.35);
      b.rotateX((k * TAU) / 4);
      blades.push([b, { color: '#3a3d42' }]);
    }
    blades.push([new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10).rotateZ(Math.PI / 2), { color: '#5d6368' }]);
    const fanGeo = bake(blades);
    tris += triCount(fanGeo);
    fan.add(mesh(fanGeo, SLOTS.solid(), { cast: false, name: 'telhado:helice' }));
    fan.position.set(gx + 0.05, gy, cz);
    root.add(fan);
  }

  // ---------------------------------------------------------------- o carrinho de mão esquecido (alças para o sul)
  {
    const B = L.ROOF_BARROW;
    const parts = [];
    // a caçamba (um tronco de pirâmide aberto) com o resto de cimento
    const tray = new THREE.CylinderGeometry(0.42, 0.3, 0.26, 4, 1, true);
    tray.rotateY(Math.PI / 4);
    tray.scale(0.82, 1, 1.45);
    parts.push([tray, { color: '#2f7f5a', y: 0.42, z: -0.12 }]);
    parts.push([new THREE.CylinderGeometry(0.3, 0.3, 0.02, 4).rotateY(Math.PI / 4).scale(0.82, 1, 1.45), { color: '#2a6f4f', y: 0.3, z: -0.12 }]);
    parts.push([new THREE.CylinderGeometry(0.28, 0.28, 0.012, 4).rotateY(Math.PI / 4).scale(0.76, 1, 1.35), { color: '#b7b1a6', y: 0.33, z: -0.12 }]);
    // a roda e o garfo na frente (norte), as alças e os pés atrás
    parts.push([new THREE.TorusGeometry(0.14, 0.045, 8, 18).rotateY(Math.PI / 2), { color: '#26272a', y: 0.15, z: -0.52 }]);
    parts.push([new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10).rotateZ(Math.PI / 2), { color: '#c9ced2', y: 0.15, z: -0.52 }]);
    for (const sx of [-0.2, 0.2]) {
      parts.push([stick(V(sx * 0.4, 0.15, -0.52), V(sx, 0.32, -0.2), 0.016, 5), { color: '#3b3f44' }]);
      parts.push([stick(V(sx, 0.32, -0.28), V(sx * 1.25, 0.46, 0.66), 0.018, 6), { color: '#3b3f44' }]);
      parts.push([stick(V(sx * 1.25, 0.46, 0.5), V(sx * 1.25, 0.46, 0.68), 0.026, 8), { color: '#c43d32' }]);
      parts.push([stick(V(sx, 0.3, 0.1), V(sx * 1.1, 0.0, 0.18), 0.016, 5), { color: '#3b3f44' }]);
    }
    const geo = bake(parts);
    add(geo, { color: null, x: B.x, y: 0, z: B.z, ao: false });
  }

  // ---------------------------------------------------------------- a pilha de caixas (com a lona dobrada) e os vasos
  {
    const B = L.ROOF_BOXES;
    const wood = speckle('#b98a55', 0.06, 81);
    add(rb(B.hx * 2 - 0.04, 0.42, B.hz * 2 - 0.04, 0.015, 1), { color: wood, x: B.x, y: -0.002, z: B.z });
    add(rb(B.hx * 1.3, 0.34, B.hz * 1.4, 0.015, 1), { color: speckle('#a97b48', 0.06, 82), x: B.x - 0.05, y: 0.418, z: B.z + 0.04, ry: 0.12 });
    add(rb(0.5, 0.08, 0.42, 0.03, 1), { color: '#3c6fa8', x: B.x + 0.1, y: 0.758, z: B.z - 0.02, ry: -0.2, ao: false });
    // vasos de barro com plantas (dentro dos colisores 'telhado-vaso-*')
    const bushes = [flowerBush({ r: 0.15, seed: 91, flower: '#ff6a55', n: 6 }), flowerBush({ r: 0.14, seed: 93, flower: '#f6f0e6', n: 6 }), flowerBush({ r: 0.13, seed: 95, flower: '#ff8fc0', n: 5 })];
    L.ROOF_POTS.forEach((p, i) => {
      const r = p.r - 0.05;
      add(cyl(r, r * 0.74, 0.32, 14), { color: ['#c46a43', '#b5583a', '#9a8f86', '#c98d6a'][i % 4], x: p.x, y: -0.002, z: p.z });
      add(cyl(r * 0.92, r * 0.92, 0.012, 14), { color: '#4a3424', x: p.x, y: 0.3, z: p.z, ao: false });
      add(bushes[i % 3], { color: null, slot: 'foliage', x: p.x, y: 0.31, z: p.z, ry: i * 1.7, sx: 0.9, sz: 0.9, ao: false });
    });
  }

  // ---------------------------------------------------------------- lá embaixo: a calçada, as ruas, as árvores e os vizinhos
  buildBelow(put, L, { tris: () => tris });

  // ---------------------------------------------------------------- o que se mexe
  // o caixote de feira (a caixa empurrável: o desenho cabe na meia medida do colisor)
  const CR = L.ROOF_CRATE;
  const crate = new THREE.Group();
  crate.name = 'telhado:caixote';
  {
    const h = CR.half - 0.01, H2 = CR.height, wood = '#c99a62', dark = '#9a6b3c';
    const parts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push([slab(0.05, H2, 0.05), { color: dark, x: sx * (h - 0.025), z: sz * (h - 0.025) }]);
    for (const y of [0.04, 0.2, 0.36]) {
      for (const s of [-1, 1]) {
        parts.push([slab(2 * h - 0.1, 0.09, 0.016), { color: wood, y, z: s * (h - 0.008) }]);
        parts.push([slab(0.016, 0.09, 2 * h - 0.1), { color: wood, y, x: s * (h - 0.008) }]);
      }
    }
    parts.push([slab(2 * h - 0.06, 0.016, 2 * h - 0.06), { color: '#b98a55', y: 0.012 }]);
    // o carimbo da feira (um desenho de pera) na face sul e as alças recortadas
    parts.push([new THREE.CircleGeometry(0.05, 10), { color: '#2f7f5a', y: 0.27, z: h + 0.002 }]);
    const geo = bake(parts);
    tris += triCount(geo);
    crate.add(mesh(geo, SLOTS.solid(), { name: 'telhado:caixote' }));
    root.add(crate);
  }
  const setCrate = (x, z) => crate.position.set(x, 0, z);
  setCrate(CR.start.x, CR.start.z);

  // o lance de baixo da escada (recolhido no alto; destravado, desce até o caixote) com o puxador da trava
  const ladder = new THREE.Group();
  ladder.name = 'telhado:escada-lance';
  const latchArm = new THREE.Group();
  latchArm.name = 'telhado:trava';
  {
    const hw2 = LD.w / 2 - 0.03, len = 1.25, lz = LD.z + 0.035;
    const parts = [];
    for (const sx of [-hw2, hw2]) parts.push([stick(V(sx, 0, 0), V(sx, len, 0), 0.014, 6), { color: '#a7aeb3' }]);
    for (let y = 0.12; y < len; y += 0.3) parts.push([stick(V(-hw2, y, 0), V(hw2, y, 0), 0.011, 5), { color: '#a7aeb3' }]);
    parts.push([new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6), { color: '#26272a', x: -hw2, y: 0.02 }], [new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6), { color: '#26272a', x: hw2, y: 0.02 }]);
    const geo = bake(parts);
    tris += triCount(geo);
    ladder.add(mesh(geo, SLOTS.solid(), { name: 'telhado:escada-lance' }));
    ladder.position.set(LD.x, LD.low, lz);
    // a trava: o braço que sai do lance para a frente (sul) até em cima do caixote, com o puxador vermelho pendurado
    const LT = L.ROOF_LATCH;
    const reach = LT.z + 0.08 - lz;
    const arm = bake([
      [stick(V(0, 0.2, 0), V(0, 0.2, reach), 0.012, 5), { color: '#5d6368' }],
      [stick(V(0, 0.2, reach), V(0, LT.top - LD.low + 0.06, reach), 0.008, 4), { color: '#8e959a' }],
    ]);
    const grip = bake([
      [new THREE.SphereGeometry(0.035, 10, 8), { color: '#d63a32' }],
      [new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), { color: '#d63a32', y: 0.05 }],
    ]);
    tris += triCount(arm) + triCount(grip);
    ladder.add(mesh(arm, SLOTS.solid(), { name: 'telhado:trava-braco' }));
    latchArm.add(mesh(grip, SLOTS.solid(), { name: 'telhado:trava-puxador' }));
    latchArm.position.set(0, LT.top - LD.low, reach);
    ladder.add(latchArm);
    root.add(ladder);
  }
  const L_ST = { drop: 0, press: 0, on: false };
  const setDrop = (k) => {
    L_ST.drop = THREE.MathUtils.clamp(k, 0, 1);
    ladder.position.y = LD.low - LD.drop * L_ST.drop;
  };

  // a tampa de borracha do alçapão (some com os pombos)
  const lid = new THREE.Group();
  lid.name = 'telhado:tampa';
  {
    const geo = bake([
      [cyl(T.hatch.r + 0.06, T.hatch.r + 0.06, 0.035, 22), { color: '#2b2d31' }],
      [cyl(0.08, 0.08, 0.02, 14), { color: '#3a3d42', y: 0.035 }],
      [new THREE.TorusGeometry(0.06, 0.012, 5, 12).rotateX(Math.PI / 2), { color: '#3a3d42', y: 0.06 }],
    ]);
    tris += triCount(geo);
    lid.add(mesh(geo, SLOTS.solid(), { name: 'telhado:tampa' }));
    lid.position.set(T.hatch.x, T.h + 0.008, T.hatch.z);
    root.add(lid);
  }

  // as penas que caem na fuga (do pé da caixa d'água até o mirante)
  const feathers = new THREE.Group();
  feathers.name = 'telhado:penas';
  {
    const feather = new THREE.ConeGeometry(0.026, 0.15, 6);
    feather.scale(1, 1, 0.22);
    feather.rotateX(-Math.PI / 2);
    feather.rotateZ(Math.PI / 2);
    const quill = new THREE.CylinderGeometry(0.0025, 0.0025, 0.16, 4).rotateZ(Math.PI / 2);
    const down = new THREE.SphereGeometry(0.015, 6, 4);
    const parts = [];
    L.ROOF_FEATHERS.forEach((f, i) => {
      const y = 0.014;
      parts.push([feather, { color: i % 2 ? '#aeb5c4' : '#8e98aa', x: f.x, y, z: f.z, ry: f.yaw + Math.PI / 2 }]);
      parts.push([quill, { color: '#e8e4dc', x: f.x, y: y + 0.004, z: f.z, ry: f.yaw + Math.PI / 2 }]);
      parts.push([down, { color: '#d9dde5', x: f.x + 0.12, y: 0.012, z: f.z + 0.06, sy: 0.5 }]);
    });
    const geo = bake(parts);
    tris += triCount(geo);
    feathers.add(mesh(geo, SLOTS.solid(), { cast: false, name: 'telhado:penas' }));
    feathers.visible = false;
    root.add(feathers);
  }

  const reset = () => {
    setCrate(CR.start.x, CR.start.z);
    setDrop(0);
    L_ST.press = 0;
    L_ST.on = false;
    latchArm.rotation.x = 0;
    lid.visible = true;
    lid.position.set(T.hatch.x, T.h + 0.008, T.hatch.z);
    feathers.visible = false;
  };

  return {
    tris,
    props: {
      rooftop: {
        /** O caixote empurrável (createPushCrate: prop). */
        crate: { object: crate, setPos: setCrate },
        /** O lance de baixo da escada: 0 recolhido, 1 apoiado no caixote. */
        ladder: { object: ladder, setDrop, get drop() { return L_ST.drop; } },
        /** O puxador da trava (createWallButton: prop). */
        latch: {
          object: latchArm,
          setPress(k) { L_ST.press = k; latchArm.rotation.x = -0.9 * k - (L_ST.on ? 0.5 : 0); },
          setOn(on) { L_ST.on = !!on; latchArm.rotation.x = -0.9 * L_ST.press - (L_ST.on ? 0.5 : 0); },
          setTimer() {},
        },
        /** A tampa de borracha do alçapão. */
        lid: { object: lid, setVisible(on) { lid.visible = !!on; } },
        /** As penas da fuga, no chão. */
        feathers: { object: feathers, setVisible(on) { feathers.visible = !!on; } },
        /** Onde fica o ponto do mirante e o relógio da cidade (para as cenas). */
        clockAt: { x: CITY_CLOCK.x, y: CITY_CLOCK.y, z: CITY_CLOCK.z },
      },
    },
    update(dt, t) {
      fan.rotation.x = (t * 9) % TAU;
      // as roupas balançam com a brisa
      clothes.children.forEach((m, i) => { m.rotation.x = 0.06 * Math.sin(t * 1.7 + i * 1.3) + 0.03 * Math.sin(t * 3.1 + i); });
    },
    reset,
  };
}

// ================================================================ lá embaixo (a "queda")
/** A torre do relógio da cidade (o mesmo relógio parado da Prefeitura, visto do terraço): onde fica o mostrador. */
const CITY_CLOCK = { x: 70.5, y: 9.2, z: -55.5 };

/**
 * A calçada em volta do prédio, as ruas, as copas das árvores, os telhados baixos, os prédios vizinhos e a cidade ao
 * norte com a torre do relógio. Tudo de FALL para cima; os prédios do oeste tapam o caminho até o condomínio.
 * @param {(geo: THREE.BufferGeometry, o: any) => void} put
 */
function buildBelow(put, L, _opts) {
  const R = L.ROOFTOP, FALL = R.fall, CUT = R.cut;
  const rt = R.t / 2;
  const fx0 = R.x0 - rt - 0.02, fx1 = R.x1 + rt + 0.02, fz0 = R.z0 - rt - 0.02, fz1 = R.z1 + rt + 0.02;
  const grp = (x, z) => `telhado-baixo-${x < 62 ? 'o' : x > 80 ? 'l' : z < -14 ? 'n' : 's'}`;
  const X1 = 150, Z0 = -95, Z1 = 75;
  // o chão de tudo (a grama dos terrenos) e as ruas por cima
  const grass = col('#93a873'), grass2 = col('#7f9862'), gOut = new THREE.Color();
  const ground = new THREE.PlaneGeometry(X1 - CUT, Z1 - Z0, 24, 24).rotateX(-Math.PI / 2);
  const gcx = (CUT + X1) / 2, gcz = (Z0 + Z1) / 2;
  put(ground, { color: (p) => gOut.copy(grass).lerp(grass2, fbm2((p.x + gcx) * 0.05, (p.z + gcz) * 0.05, 2)), slot: 'ground', x: gcx, y: FALL - 0.03, z: gcz, group: 'telhado-baixo-chao', ao: false });
  // as ruas: oeste (x 57,5–61), leste (82–85,5), norte (z −19,5 a −16) e sul (3,5–7)
  const asphalt = col('#5d5f66'), asphalt2 = col('#4b4e55'), aOut = new THREE.Color();
  const street = (x0, z0, x1, z1) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.max(1, Math.round((x1 - x0) / 6)), Math.max(1, Math.round((z1 - z0) / 6))).rotateX(-Math.PI / 2);
    put(geo, { color: (p) => aOut.copy(asphalt).lerp(asphalt2, fbm2((p.x + cx) * 0.2, (p.z + cz) * 0.2, 2) * 0.7), slot: 'ground', x: cx, y: FALL - 0.01, z: cz, group: grp(cx, cz), ao: false });
  };
  street(57.5, Z0, 61.0, Z1);
  street(82.0, Z0, 85.5, Z1);
  street(CUT, -19.5, 57.5, -16.0); street(61.0, -19.5, 82.0, -16.0); street(85.5, -19.5, X1, -16.0);
  street(CUT, 3.5, 57.5, 7.0); street(61.0, 3.5, 82.0, 7.0); street(85.5, 3.5, X1, 7.0);
  // as faixas no meio das ruas
  const dash = [];
  for (let z = Z0 + 1; z < Z1; z += 3) { dash.push([59.2, z, 59.3, z + 1.4, '#efe6d2']); dash.push([83.7, z, 83.8, z + 1.4, '#efe6d2']); }
  put(flatQuads(dash), { color: null, slot: 'ground', x: 0, y: FALL - 0.005, z: 0, group: 'telhado-baixo-chao', ao: false });
  // a calçada em volta do prédio (de 61 a 82 em x, de −16 a 3,5 em z) e a guia
  const walk = speckle('#cfc6b6', 0.06, 101);
  put(rb(82.0 - 61.0, 0.14, 3.5 + 16.0, 0.02, 1), { color: walk, x: (61 + 82) / 2, y: FALL - 0.01, z: (-16 + 3.5) / 2, group: 'telhado-baixo-s' });
  // o canteiro com as árvores da calçada (as copas que se vê por cima da mureta) e os postes
  const crowns = [crownGeo(3, ['#3d5a24', '#5f8a35', '#a2c056']), crownGeo(7, ['#40602a', '#6b9440', '#b5cf6a']), crownGeo(11, ['#5b3f5f', '#a0619a', '#e4a2d6'])];
  const trunk = cyl(0.12, 0.16, 3.6, 7);
  const trees = [[62.2, -14.6, 0], [67.5, -14.8, 1], [73.5, -14.7, 0], [79.6, -14.6, 1], [80.6, -9.2, 0], [80.7, -3.0, 2], [62.0, -6.5, 1],
    [62.2, 1.8, 0], [68.0, 2.2, 2], [75.0, 2.2, 1], [80.6, 2.0, 0], [62.0, -11.0, 2]];
  trees.forEach(([x, z, k], i) => {
    put(trunk, { color: '#6f4a2e', x, y: FALL + 0.12, z, group: grp(x, z) });
    put(crowns[k], { color: null, slot: 'foliage', x, y: FALL + 4.4 + (i % 3) * 0.3, z, ry: i * 1.1, sx: 1.05, sy: 1.0, sz: 1.05, group: grp(x, z), ao: false });
  });
  for (const [x, z] of [[61.6, -10.5], [61.6, -2.0], [81.4, -12.0], [81.4, -4.5], [70.0, 3.0], [70.0, -15.6]]) {
    put(cyl(0.06, 0.08, 5.2, 8), { color: '#4d5257', x, y: FALL + 0.12, z, group: grp(x, z), ao: false });
    put(new THREE.SphereGeometry(0.2, 10, 8), { color: '#fff4d6', x, y: FALL + 5.4, z, group: grp(x, z), ao: false });
  }
  // os carros parados (caixas arredondadas) nas ruas do oeste e do sul
  const car = (x, z, ry, c) => {
    put(rb(1.7, 0.7, 3.9, 0.18, 2), { color: c, x, y: FALL + 0.28, z, ry, group: grp(x, z) });
    put(rb(1.5, 0.55, 2.0, 0.16, 2), { color: '#cfe0ec', x: x - Math.sin(ry) * 0.2, y: FALL + 0.95, z: z - Math.cos(ry) * 0.2, ry, group: grp(x, z), ao: false });
    for (const s of [-1, 1]) for (const f of [-1, 1]) put(cyl(0.3, 0.3, 0.22, 10).rotateZ(Math.PI / 2), { color: '#26272a', x: x + Math.cos(ry) * s * 0.78 + Math.sin(ry) * f * 1.25, y: FALL + 0.29, z: z - Math.sin(ry) * s * 0.78 + Math.cos(ry) * f * 1.25, ry, group: grp(x, z), ao: false });
  };
  car(60.4, -8.0, 0, '#d8403a'); car(60.4, 12.0, 0, '#3f7fd1'); car(72.0, 6.2, Math.PI / 2, '#f2c230'); car(84.6, -24.0, 0, '#e9e4da');

  // os vizinhos: um prédio por lote (corpo, janelas, platibanda com a caixa d'água ou telhado de quatro águas)
  const HOUSES = ['#e9c9a0', '#cfe0d2', '#f0d2c2', '#d9d1ef', '#f4e3b5', '#c9dbe8', '#efc7b0'];
  const ROOFS = ['#c8643c', '#b85a36', '#d07446', '#a9523a'];
  const R0 = rng(77);
  const building = (x0, z0, x1, z1, top, ci, low = false) => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, gname = grp(cx, cz);
    const body = speckle(HOUSES[ci % HOUSES.length], 0.04, 200 + ci);
    put(rb(w, top - FALL, d, 0.04, 1), { color: body, x: cx, y: FALL, z: cz, group: gname });
    if (low) put(hipRoof(w + 0.6, d + 0.6, Math.min(2.2, Math.min(w, d) * 0.35)), { color: ROOFS[ci % ROOFS.length], x: cx, y: top, z: cz, group: gname, ao: false });
    else {
      put(rb(w + 0.1, 0.4, d + 0.1, 0.03, 1), { color: '#f4ecdc', x: cx, y: top, z: cz, group: gname, ao: false });
      if (ci % 2) put(rb(1.4, 1.2, 1.4, 0.05, 1), { color: '#4f8fd0', x: cx + w * 0.2, y: top + 0.38, z: cz - d * 0.15, group: gname });
    }
    // as janelas nas quatro faces (quadros num plano 2 cm à frente da parede)
    const floors = Math.max(1, Math.floor((top - FALL - 0.8) / 3));
    for (const [fw, ry, ox, oz] of [[w, 0, cx, z1 + 0.02], [w, Math.PI, cx, z0 - 0.02], [d, Math.PI / 2, x1 + 0.02, cz], [d, -Math.PI / 2, x0 - 0.02, cz]]) {
      const cols = Math.max(1, Math.floor(fw / 2.2));
      const q = [];
      for (let r = 0; r < floors; r++) {
        for (let i = 0; i < cols; i++) {
          const x = -fw / 2 + (fw * (i + 0.5)) / cols, y = FALL + 1.1 + r * 3;
          q.push([x - 0.5, y, x + 0.5, y + 1.3, R0() < 0.25 ? '#f1e3c8' : R0() < 0.5 ? '#8fb6d3' : '#6f93b3']);
        }
      }
      put(wallQuads(q), { color: null, slot: 'glass', x: ox, y: 0, z: oz, ry, group: gname, ao: false });
    }
  };
  // a oeste (tapam o caminho até o condomínio): uma fileira alta e contínua
  let ci = 0;
  for (let z = Z0; z < Z1; ci++) {
    const d = 9 + R0() * 6;
    building(CUT + 0.4, z, 56.5, z + d - 0.6, 4 + R0() * 7 + (Math.abs(z + 50) < 12 ? 6 : 0), ci);
    z += d;
  }
  // ao norte, do outro lado da rua: telhados baixos (a cidade aparece por cima) e, mais longe, os prédios da cidade
  for (let x = 61.5; x < 82; ci++) {
    const w = 5 + R0() * 2.5;
    building(x, -27.5, Math.min(81.5, x + w - 0.6), -20.5, FALL + 3.2 + R0() * 1.6, ci, true);
    x += w;
  }
  for (const [x0, x1, z0, z1, top] of [[58, 66, -46, -36, 4], [76, 86, -44, -34, 6], [86, 96, -48, -38, 9], [52, 60, -60, -50, 12], [90, 100, -62, -52, 13], [60, 64, -70, -62, 7], [80, 90, -72, -62, 11]]) {
    building(x0, z0, x1, z1, top, ci++);
  }
  // a leste e ao sul: um pouco de tudo
  for (let z = -30; z < 60; ci++) {
    const d = 8 + R0() * 5;
    building(86.5, z, 95 + R0() * 4, z + d - 0.8, R0() < 0.4 ? FALL + 3.4 : 1 + R0() * 6, ci, R0() < 0.4);
    z += d;
  }
  for (let x = 61.5; x < 82; ci++) {
    const w = 6 + R0() * 3;
    building(x, 8.5, Math.min(81.5, x + w - 0.8), 16 + R0() * 4, R0() < 0.5 ? FALL + 3.3 : FALL + 6.5 + R0() * 4, ci, R0() < 0.5);
    x += w;
  }
  for (const [x0, x1, z0, z1, top] of [[61, 72, 24, 34, 3], [74, 84, 22, 32, 6], [88, 100, 64, 74, 8]]) building(x0, z0, x1, z1, top, ci++);
  // as copas dos quintais dos vizinhos (entre os telhados baixos)
  [[64.0, -31.0, 0], [72.5, -31.5, 1], [79.0, -30.5, 2], [66.0, 19.5, 1], [78.5, 20.0, 0], [89.0, -14.0, 1], [90.0, 6.0, 0]].forEach(([x, z, k], i) => {
    put(trunk, { color: '#6f4a2e', x, y: FALL + 0.02, z, group: grp(x, z) });
    put(crowns[k], { color: null, slot: 'foliage', x, y: FALL + 4.3, z, ry: i * 0.7, sx: 1.3, sy: 1.2, sz: 1.3, group: grp(x, z), ao: false });
  });

  // a torre do relógio da cidade (o relógio parado a um minuto da uma), ao norte, por cima de tudo
  {
    const C = CITY_CLOCK, gname = 'telhado-baixo-n';
    const cream = speckle('#f4e7cf', 0.03, 301), stone = '#cfc2aa', roof = '#b5523b';
    put(rb(12, 6.4 - FALL, 6, 0.06, 1), { color: cream, x: C.x, y: FALL, z: C.z - 4.0, group: gname });
    put(rb(3.4, 12.9 - FALL, 3.4, 0.05, 1), { color: cream, x: C.x, y: FALL, z: C.z - 1.75, group: gname });
    put(rb(4.0, 0.35, 4.0, 0.04, 1), { color: stone, x: C.x, y: 12.9, z: C.z - 1.75, group: gname, ao: false });
    put(rb(2.9, 1.9, 2.9, 0.04, 1), { color: cream, x: C.x, y: 13.25, z: C.z - 1.75, group: gname });
    put(new THREE.ConeGeometry(2.5, 3.3, 4, 1).rotateY(Math.PI / 4).translate(0, 1.65, 0), { color: roof, x: C.x, y: 15.15, z: C.z - 1.75, group: gname, ao: false });
    // o mostrador (virado para o sul, para o terraço), os traços das horas e os ponteiros: 12h59
    put(new THREE.CircleGeometry(1.5, 24), { color: '#7a4e2e', x: C.x, y: C.y, z: C.z - 0.03, group: gname, ao: false });
    put(new THREE.CircleGeometry(1.3, 24), { color: '#fff8ec', x: C.x, y: C.y, z: C.z - 0.01, group: gname, ao: false });
    const marks = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU, r0 = 1.08, r1 = 1.24;
      const s = k % 3 ? 0.03 : 0.05;
      const cx = Math.sin(a) * (r0 + r1) / 2, cy = Math.cos(a) * (r0 + r1) / 2;
      marks.push([cx - s, cy - s, cx + s, cy + s, '#2a2318']);
    }
    put(wallQuads(marks), { color: null, x: C.x, y: C.y, z: C.z + 0.005, group: gname, ao: false });
    const hand = (len, w, a) => put(slab(w, len, 0.02).translate(0, 0, 0), { color: '#2a2318', x: C.x, y: C.y, z: C.z + 0.02, rz: -a, group: gname, ao: false });
    hand(0.62, 0.09, (TAU * (12 + 59 / 60)) / 12); // a das horas, quase na uma
    hand(1.0, 0.06, (TAU * 59) / 60); // a dos minutos, um antes do 12
  }
}
