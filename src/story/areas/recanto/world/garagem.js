// RECANTO DAS PATINHAS — a GARAGEM, no sul do condomínio, no acabamento das fases 4 e 5:
//   o piso de concreto (placas com juntas, a mancha de óleo embaixo do motor, as marcas dos pneus, a frente molhada
//     pela chuva que entrou de lado, a poça, folhas e flores de primavera trazidas pela tempestade);
//   a cobertura leve: pilares de madeira com mãos-francesas, vigas, caibros e telhas de policarbonato translúcido (a
//     câmera vê tudo embaixo; em cima, folhas, flores e um galho da tempestade), a calha da frente pingando e a
//     primavera subindo pelo pilar e espalhando pela viga e pelo telhado;
//   a CAMINHONETE vermelha de capota creme, estacionada de ré (a caçamba virada para a câmera): por baixo, o vão alto
//     onde só a Radhija passa (nada abaixo de 0,49 m além das rodas); faróis, grade, retrovisores, para-choques
//     cromados, frisos das portas, lama da tempestade nas laterais, um remendo de massa no para-lama e as patinhas
//     adesivadas no vidro de trás; na caçamba, a lona, a caixa de ferramentas, o estepe, o caixote de laranjas e uma
//     poça com folhas;
//   o DEPÓSITO em corte (sem telhado: a câmera vê dentro por cima; paredes inteiras no norte, oeste e leste, o cobogó no
//     leste; o sul é o muro do condomínio): a porta de tábuas que abre para dentro,
//     a luminária tartaruga acesa desde a noite, o carretel da mangueira e o painel de ferramentas por fora; por dentro,
//     a prateleira do balde (ao norte da porta), as prateleiras de latas e potes, a bicicleta pendurada no alto, a
//     vassoura e o rastelo no canto, as latas de tinta no chão, a caixa de brinquedos das irmãs (a meia fica em cima
//     dela) e o saco de ração.
//   O que se mexe: a porta (storageDoor.setOpen), o balde (bucket.setTip: escorrega, vira na quina, cai em cima da bola
//   em hitT, quica e rola até o canto do norte), a bola de futebol (ball.setPos; rola sozinha pelo deslocamento) e a
//   corda (rope.setPull, setGrip, bitePoint): da alça do balde, parede abaixo, por baixo da porta e pelo chão até
//   debaixo da caminhonete, onde fica a ponta com o nó.
// API: buildGaragem(kit, root, L) → { props, seeThrough, signs: [], update(dt, t), reset(), dispose() }
import * as THREE from 'three';
import { rng, fbm2, vnoise2, smoothstep, mat, paint, mergeGeometries, foliageCluster } from '../../../../world/util.js';
import { rb, cyl, sphere, rod, slab, tiles, tilesV, SLOTS } from '../../../../levels/mapa/world/kit.js';

const TAU = Math.PI * 2;
const G = 'garagem';
/** Topo do piso: as dogs andam em y = 0, o piso fica rente (de −2 cm, dentro do gramado, até 1,8 cm). */
const FLOOR = 0.018;
/** Decalques do piso: as juntas 3 mm acima dele; manchas, marcas, poça e folhas mais 3 mm (nunca uma sobre a outra). */
const D1 = FLOOR + 0.003;
const D2 = FLOOR + 0.006;
/** Raio da corda. */
const ROPE_R = 0.011;
const _c = new THREE.Color();
const C = (hex) => new THREE.Color(hex);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (u) => u * u * (3 - 2 * u);
const KEEP = ['position', 'normal', 'color'];

// ---------------------------------------------------------------- formas
/** Caixa sem a face de baixo, com o topo e os lados subdivididos (a cor por vértice varia): paredes e pisos. */
function gridBox(w, h, d, cell = 0.3) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / cell)), Math.max(1, Math.round(h / cell)), Math.max(1, Math.round(d / cell)));
  g.translate(0, h / 2, 0);
  const idx = g.index.array, keep = [];
  for (const gr of g.groups) if (gr.materialIndex !== 3) for (let i = gr.start; i < gr.start + gr.count; i++) keep.push(idx[i]);
  g.setIndex(keep);
  g.clearGroups();
  return g;
}
/** Contorno irregular de raio r (ondulações largas; spiky: respingos alternados). → [[x, y], …] */
function blobPts(r, seed, n = 18, spiky = 0) {
  const R = rng(seed);
  const ph = [R() * TAU, R() * TAU, R() * TAU];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    let rr = r * (1 + 0.15 * Math.sin(2 * a + ph[0]) + 0.08 * Math.sin(3 * a + ph[1]) + 0.05 * Math.sin(5 * a + ph[2]));
    if (spiky && i % 2) rr *= 1 + spiky * (0.3 + R() * 0.9);
    out.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return out;
}
/** Forma plana no plano XY (voltada para +Z), com furos. */
function shapeXY(pts, holes = []) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  for (const h of holes) {
    const p = new THREE.Path();
    h.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    s.holes.push(p);
  }
  return new THREE.ShapeGeometry(s, 1);
}
/** Decalque irregular deitado no chão (voltado para cima). */
const flatBlob = (r, seed, n = 18, spiky = 0) => shapeXY(blobPts(r, seed, n, spiky)).rotateX(-Math.PI / 2);
/** Decalque irregular em pé numa face de normal ±x (side −1: oeste, +1: leste) ou +z (side 0). */
function wallBlob(r, seed, side, n = 16, spiky = 0) {
  const g = shapeXY(blobPts(r, seed, n, spiky));
  if (side < 0) g.rotateY(-Math.PI / 2);
  else if (side > 0) g.rotateY(Math.PI / 2);
  return g;
}
/** Folha caída: a nervura dobrada em V e a ponta levantada (nunca rente a outra coisa). */
function leafGeo(len, w) {
  const s = new THREE.Shape();
  s.moveTo(0, -len / 2);
  s.quadraticCurveTo(w, -len * 0.1, 0, len / 2);
  s.quadraticCurveTo(-w, -len * 0.1, 0, -len / 2);
  const g = new THREE.ShapeGeometry(s, 3).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(p.getX(i)) * 0.22 + Math.max(0, -p.getZ(i) - len * 0.15) * 0.1);
  g.computeVertexNormals();
  return g;
}
/** Bráctea de primavera (três pétalas de papel). */
function bractGeo(r) {
  const pts = [];
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * TAU;
    pts.push([Math.cos(a) * r * (0.55 + 0.45 * Math.abs(Math.cos(a * 1.5))), Math.sin(a) * r * (0.55 + 0.45 * Math.abs(Math.cos(a * 1.5)))]);
  }
  const g = shapeXY(pts).rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.hypot(p.getX(i), p.getZ(i)) * 0.18);
  g.computeVertexNormals();
  return g;
}
/** Mancha deitada com a cor do centro para a borda (óleo). */
function stainGeo(r, seed, cols) {
  const pts = blobPts(r, seed, 22);
  const n = pts.length;
  const pos = [0, 0, 0];
  const col = [cols[0].r, cols[0].g, cols[0].b];
  for (const k of [0.55, 1]) {
    const c = k < 1 ? cols[1] : cols[2];
    for (const [x, y] of pts) { pos.push(x * k, 0, -y * k); col.push(c.r, c.g, c.b); }
  }
  const idx = [];
  for (let i = 0; i < n; i++) {
    const a = 1 + i, b = 1 + ((i + 1) % n), c = 1 + n + i, d = 1 + n + ((i + 1) % n);
    idx.push(0, a, b, a, c, d, a, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
const _up = new THREE.Vector3(0, 1, 0);
const _qa = new THREE.Quaternion();
const _va = new THREE.Vector3();
/** Haste entre dois pontos [x, y, z]. */
function rodAB(a, b, r, seg = 6) {
  _va.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(1e-4, _va.length());
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.applyQuaternion(_qa.setFromUnitVectors(_up, _va.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
/** Tubo por pontos [x, y, z] (galhos, mangueira, caule). */
const tubeAlong = (pts, r, radial = 5, segs = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), segs, r, radial, false);
/**
 * Perfil (z, y) do mundo extrudado ao longo de x, de x0 a x1 (o bevel arredonda as quinas e aumenta o contorno em bs:
 * o desenho já entra recuado). A geometria sai no lugar (coordenadas do mundo).
 */
function extrudeX(build, x0, x1, { bt = 0.03, bs = 0.03, segs = 2, curve = 12 } = {}) {
  const shape = new THREE.Shape();
  build(shape);
  const depth = Math.max(0.002, x1 - x0 - 2 * bt);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bs, bevelSegments: segs, curveSegments: curve, steps: 1 });
  g.rotateY(-Math.PI / 2); // (x, y, z) → (−z, y, x): o x do perfil vira o z do mundo, a extrusão vira −x
  g.translate(x1 - bt, 0, 0);
  return g;
}
/** Painel fino entre dois pontos (z, y) de um perfil, de x0 a x1, afastado `off` pela normal de fora (n = (nz, ny)). */
function panelZY(a, b, x0, x1, n, off, thick = 0.006, inset = 0) {
  const dz = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dz, dy);
  const g = new THREE.BoxGeometry(x1 - x0, len * (1 - 2 * inset), thick);
  g.rotateX(Math.atan2(dz, dy));
  g.translate((x0 + x1) / 2, (a[1] + b[1]) / 2 + n[1] * off, (a[0] + b[0]) / 2 + n[0] * off);
  return g;
}

/** Junta peças pintadas numa geometria só, como o kit, para os objetos que se mexem (uma malha cada). */
function createBaker() {
  const list = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    /**
     * color: cor (string ou THREE.Color), função (posição local, normal) → Color, ou null para manter a da geometria.
     * @param {THREE.BufferGeometry} geo
     * @param {{ color?: any, x?: number, y?: number, z?: number, rx?: number, ry?: number, rz?: number, sx?: number, sy?: number, sz?: number }} [o]
     */
    add(geo, { color = '#ffffff', x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
      for (const k of Object.keys(geo.attributes)) if (!KEEP.includes(k)) geo.deleteAttribute(k);
      const g = geo.clone();
      if (!g.index) {
        const n = g.attributes.position.count;
        g.setIndex(Array.from({ length: n }, (_, i) => i));
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (color !== null || !g.attributes.color) paint(g, color ?? '#ffffff');
      e.set(rx, ry, rz);
      q.setFromEuler(e);
      m.compose(p.set(x, y, z), q, s.set(sx, sy, sz));
      g.applyMatrix4(m);
      list.push(g);
      return g;
    },
    build() {
      const g = mergeGeometries(list);
      for (const x of list) x.dispose();
      list.length = 0;
      g.computeBoundingSphere();
      return g;
    },
  };
}

/** Tubo de corda atualizável (número fixo de pontos, transporte paralelo), com as três pernas torcidas na cor. */
function createRopeTube(n, radial, base) {
  const g = new THREE.BufferGeometry();
  const vc = n * (radial + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vc * 3), 3));
  const col = new Float32Array(vc * 3);
  const idx = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      c.copy(base).multiplyScalar(0.74 + 0.26 * (0.5 + 0.5 * Math.cos((j / radial) * TAU * 3 + i * 1.25)));
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
      if (i < n - 1 && j < radial) {
        const b = k + radial + 1;
        idx.push(k, k + 1, b, b, k + 1, b + 1);
      }
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), pT = new THREE.Vector3(0, 0, 1), tmp = new THREE.Vector3();
  function update(P, r) {
    const pos = g.attributes.position.array, nor = g.attributes.normal.array;
    for (let i = 0; i < n; i++) {
      T.subVectors(P[Math.min(n - 1, i + 1)], P[Math.max(0, i - 1)]);
      if (T.lengthSq() < 1e-12) T.copy(pT);
      T.normalize();
      if (i === 0) {
        N.set(0, 1, 0);
        if (Math.abs(T.dot(N)) > 0.9) N.set(1, 0, 0);
        N.sub(tmp.copy(T).multiplyScalar(N.dot(T))).normalize();
      } else {
        const ax = tmp.crossVectors(pT, T);
        const l = ax.length();
        if (l > 1e-6) N.applyAxisAngle(ax.divideScalar(l), Math.asin(Math.min(1, l)) * (pT.dot(T) < 0 ? -1 : 1));
        N.sub(tmp.copy(T).multiplyScalar(N.dot(T))).normalize();
      }
      B.crossVectors(T, N);
      pT.copy(T);
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const nx = N.x * ca + B.x * sa, ny = N.y * ca + B.y * sa, nz = N.z * ca + B.z * sa;
        const k = (i * (radial + 1) + j) * 3;
        pos[k] = P[i].x + nx * r;
        pos[k + 1] = P[i].y + ny * r;
        pos[k + 2] = P[i].z + nz * r;
        nor[k] = nx;
        nor[k + 1] = ny;
        nor[k + 2] = nz;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
  }
  return { geometry: g, update };
}

/**
 * Reamostra uma linha de controle em `n` pontos, guardando os vértices (as quinas: a borda do balde, a quina da
 * prateleira, a fresta da porta). out: n Vector3 reaproveitados.
 * @param {THREE.Vector3[]} ctrl @param {number} n @param {THREE.Vector3[]} out
 */
function resample(ctrl, n, out) {
  const m = ctrl.length - 1;
  const lens = [];
  let total = 0;
  for (let i = 0; i < m; i++) { const l = ctrl[i].distanceTo(ctrl[i + 1]); lens.push(l); total += l; }
  const cnt = lens.map((l) => Math.max(1, Math.round((l / (total || 1)) * (n - 1))));
  let sum = cnt.reduce((a, b) => a + b, 0);
  while (sum > n - 1) { const i = cnt.indexOf(Math.max(...cnt)); if (cnt[i] <= 1) break; cnt[i]--; sum--; }
  while (sum < n - 1) { let best = 0; for (let i = 1; i < m; i++) if (lens[i] / cnt[i] > lens[best] / cnt[best]) best = i; cnt[best]++; sum++; }
  let k = 0;
  out[k++].copy(ctrl[0]);
  for (let i = 0; i < m; i++) for (let j = 1; j <= cnt[i]; j++) out[k++].lerpVectors(ctrl[i], ctrl[i + 1], j / cnt[i]);
  return out;
}

/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildGaragem(kit, root, L) {
  const { CARPORT: CP, CAR, WHEELS, STORAGE: ST, STORAGE_DOOR: SD, BALL, SHELF, ROPE, WALL } = L;
  const put = (geo, color, o = {}) => kit.add(geo, { group: G, color, ...o });
  const wt = (L.WALLS?.t ?? 0.16) / 2;
  const wallN = WALL.maxZ - WALL.t / 2; // face norte do muro do condomínio
  // o depósito: faces de fora e de dentro das paredes oeste (com a porta), norte e leste
  const X0 = ST.x0 - wt, X0i = ST.x0 + wt, X1i = ST.x1 - wt, X1 = ST.x1 + wt;
  const Z0 = ST.z0 - wt, Z0i = ST.z0 + wt;
  const H = SD.hinge, LP = SD.latchPost;
  /** Fim da parede ao norte da porta: a folha aberta (99°) passa rente ao batente sem entrar nele. */
  const JAMB = H.z - 0.08;
  const LINTEL = SD.h + 0.07; // embaixo da verga
  const WALL_H = ST.h - 0.04; // a alvenaria; o arremate completa ST.h
  /** A prateleira do balde, na face de dentro da parede oeste, ao norte da porta. */
  const SH = { x0: X0i, x1: X0i + 0.29, z0: Z0i + 0.04, z1: JAMB - 0.05, y: SHELF.y };
  const anim = [];
  const seeThrough = [];
  /** Fica dentro do piso da garagem? (a bola e o balde assentam no topo dele) */
  const onFloor = (x, z) => x > CP.x0 - 0.01 && x < X1 + 0.01 && z > CP.z0 - 0.01 && z < WALL.maxZ;

  // ======================================================== 1. PISO
  const CONC = C('#c0b8ab'), WETC = C('#8e897f'), EDGEC = C('#a49d91');
  const concrete = (p, n) => {
    if (n.y < 0.5) return EDGEC;
    const x = p.x, z = p.z;
    let k = 1 + (fbm2(x * 0.75 + 3.1, z * 0.75 - 1.7, 3) - 0.5) * 0.15 + (vnoise2(x * 6.1, z * 6.1) - 0.5) * 0.05;
    // embaixo da caminhonete, a sombra de contato
    const ix = Math.max(CAR.x0 - x, x - CAR.x1), iz = Math.max(CAR.z0 - z, z - CAR.z1);
    const sd = ix > 0 || iz > 0 ? Math.hypot(Math.max(ix, 0), Math.max(iz, 0)) : Math.max(ix, iz);
    k *= 1 - 0.27 * (1 - smoothstep(-0.55, 0.4, sd));
    // rente às paredes
    let dw = wallN - z;
    if (z > Z0 && x < X0) dw = Math.min(dw, X0 - x);
    if (x > X0 && z < Z0) dw = Math.min(dw, Z0 - z);
    k *= 1 - 0.12 * (1 - smoothstep(0, 0.4, dw));
    // a trilha dos pneus da frente (ela entrou de ré): o concreto mais escuro e liso
    for (const w of WHEELS) if (w.z < 6) k *= 1 - 0.07 * (1 - smoothstep(0.05, 0.16, Math.abs(x - w.x))) * (1 - smoothstep(4.7, 5.1, z));
    // a frente molhada (a chuva entrou de lado), mais funda do lado oeste
    const edge = 4.2 + (fbm2(x * 1.1 + 7, 2.3, 2) - 0.5) * 0.9 + Math.max(0, -0.4 - x) * 0.5;
    const wet = 1 - smoothstep(edge - 0.4, edge, z);
    return _c.copy(CONC).multiplyScalar(k).lerp(WETC, wet * 0.55);
  };
  /** Laje fina: de −2 cm (dentro do gramado) até o topo do piso, sem a face de baixo. */
  const slabTop = (x0, x1, z0, z1, cell = 0.18) => gridBox(x1 - x0, FLOOR + 0.02, z1 - z0, cell).translate((x0 + x1) / 2, -0.02, (z0 + z1) / 2);
  put(slabTop(CP.x0, X0, CP.z0, wallN + 0.02), concrete, { slot: 'ground' });
  put(slabTop(X0, X1, CP.z0, Z0), concrete, { slot: 'ground' });
  // dentro do depósito, lajotas de barro (cada uma com seu tom) e o rejunte
  const RF = { x0: X0i, x1: X1i, z0: Z0i, z1: wallN + 0.02 };
  const tw = RF.x1 - RF.x0, td = RF.z1 - RF.z0, tnx = Math.round(tw / 0.3), tnz = Math.round(td / 0.3);
  const TILE = [C('#b8674b'), C('#a95c43'), C('#c27556'), C('#b06850')];
  const tileFloor = tiles(tw, td, tw / tnx, td / tnz, (p) => {
    const x = p.x + (RF.x0 + RF.x1) / 2, z = p.z + (RF.z0 + RF.z1) / 2;
    const i = Math.floor((x - RF.x0) / (tw / tnx)), j = Math.floor((z - RF.z0) / (td / tnz));
    const edge = 1 - smoothstep(0, 0.45, Math.min(x - RF.x0, z - RF.z0, RF.x1 - x));
    return _c.copy(TILE[Math.abs(i * 7 + j * 3) % 4]).multiplyScalar(1 + (vnoise2(i * 1.7, j * 2.3) - 0.5) * 0.12 - edge * 0.12);
  });
  put(tileFloor.translate((RF.x0 + RF.x1) / 2, FLOOR, (RF.z0 + RF.z1) / 2), null, { slot: 'ground' });
  const GROUT = C('#7c4838');
  for (let i = 1; i < tnx; i++) put(slab(0.008, 0.002, td).translate(RF.x0 + (tw / tnx) * i, D1 - 0.002, (RF.z0 + RF.z1) / 2), GROUT, { slot: 'ground' });
  for (let j = 1; j < tnz; j++) put(slab(tw, 0.002, 0.008).translate((RF.x0 + RF.x1) / 2, D1 - 0.002, RF.z0 + (td / tnz) * j), GROUT, { slot: 'ground' });
  // a soleira de granito embaixo da porta (rente: a corda passa por cima dela, por baixo da folha); 2 mm abaixo do piso e
  // entrando 5 mm embaixo dele dos dois lados: nenhuma face no plano de outra
  put(slab(X0i - X0 + 0.01, FLOOR + 0.018, LP.z - JAMB + 0.1).translate(ST.x0, -0.02, (JAMB + LP.z) / 2), C('#9b958b'), { slot: 'ground' });
  // juntas de dilatação
  const JOINT = C('#8b8478');
  const joint = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    put(slab(0.012, 0.002, len).rotateY(Math.atan2(x1 - x0, z1 - z0)).translate((x0 + x1) / 2, D1 - 0.002, (z0 + z1) / 2), JOINT, { slot: 'ground' });
  };
  joint(CP.x0 + 0.02, 5.25, X1 - 0.02, 5.25);
  joint(CP.x0 + 0.02, 6.95, X0 - 0.02, 6.95);
  joint((CAR.x0 + CAR.x1) / 2 + 0.15, CP.z0 + 0.02, (CAR.x0 + CAR.x1) / 2 + 0.15, wallN);
  // as marcas de borracha dos pneus da frente, da entrada até as rodas
  const RUBBER = C('#68625b');
  for (const w of WHEELS) {
    if (w.z > 6) continue;
    const stop = w.z - CAR.wheelR - 0.08;
    for (const [z0, z1, dx, ry] of [[CP.z0 + 0.06, 3.98, 0.025, 0.03], [4.07, 4.36, 0.004, -0.015], [4.44, stop, -0.008, 0.01]]) {
      if (z1 - z0 < 0.06) continue;
      put(slab(0.13, 0.002, z1 - z0).rotateY(ry).translate(w.x + dx, D2 - 0.002, (z0 + z1) / 2), RUBBER, { slot: 'ground' });
    }
  }
  // a mancha de óleo embaixo do motor, os pingos e uma mancha antiga, quase sumida
  const ENGINE = { x: (CAR.x0 + CAR.x1) / 2, z: CAR.z0 + 0.52 };
  const stains = [
    { x: ENGINE.x, z: ENGINE.z, r: 0.32, seed: 3, cols: ['#26221f', '#3e3933', '#7d786f'] },
    { x: ENGINE.x + 0.28, z: ENGINE.z + 0.42, r: 0.07, seed: 5, cols: ['#2b2723', '#3c3732', '#7a756d'] },
    { x: ENGINE.x - 0.24, z: ENGINE.z + 0.34, r: 0.05, seed: 6, cols: ['#2b2723', '#3c3732', '#7c776f'] },
    { x: -1.15, z: 6.05, r: 0.34, seed: 9, cols: ['#8b857b', '#968f85', '#aca599'] },
  ];
  for (const s of stains) put(stainGeo(s.r, s.seed, s.cols.map(C)).translate(s.x, D2, s.z), null, { slot: 'ground' });
  // a poça da frente (a borda de concreto molhado e a água refletindo o céu)
  const PUDDLE = { x: -1.28, z: 4.1, r: 0.3 };
  {
    const pts = blobPts(PUDDLE.r, 11, 26);
    const inner = pts.map(([x, y]) => [x * 0.86, y * 0.86]);
    const outer = pts.map(([x, y]) => [x * 1.16, y * 1.16]);
    // a água 3 mm acima da borda (malhas e materiais diferentes nunca no mesmo plano)
    put(shapeXY(inner).rotateX(-Math.PI / 2).translate(PUDDLE.x, D2 + 0.003, PUDDLE.z), C('#9dc1d6'), { slot: 'glass' });
    put(shapeXY(outer, [inner]).rotateX(-Math.PI / 2).translate(PUDDLE.x, D2, PUDDLE.z), C('#878177'), { slot: 'ground' });
  }

  // ======================================================== 2. DEPÓSITO
  const WALL_OUT = C('#e8d6b1'), WALL_IN = C('#f2e9d8'), CAPC = C('#efe6d4'), FRAME = C('#f3ecdc');
  const plaster = (inX, inZ) => (p, n) => {
    if (n.y > 0.5) return CAPC;
    const inner = n.x * inX + n.z * inZ > 0.5;
    const k = 1 + (fbm2((p.x + p.z) * 1.9, p.y * 1.9, 3) - 0.5) * 0.09;
    // escorridos da chuva embaixo do arremate (por fora) e a umidade subindo do chão
    const streak = inner ? 0 : (1 - smoothstep(0, 0.6, WALL_H - p.y)) * vnoise2((p.x + p.z) * 9.3, 1.7) * 0.14;
    const damp = (1 - smoothstep(0.2, 0.75, p.y)) * (inner ? 0.05 : 0.09);
    return _c.copy(inner ? WALL_IN : WALL_OUT).multiplyScalar(k * (1 - streak - damp));
  };
  const wallPiece = (x0, x1, z0, z1, y0, y1, inX, inZ) => put(gridBox(x1 - x0, y1 - y0, z1 - z0, 0.28).translate((x0 + x1) / 2, y0, (z0 + z1) / 2), plaster(inX, inZ));
  wallPiece(X0, X1, Z0, Z0i, 0, WALL_H, 0, 1); // norte, inteira
  wallPiece(X0, X0i, Z0i, JAMB, 0, WALL_H, 1, 0); // oeste, ao norte da porta
  wallPiece(X0, X0i, JAMB, LP.z, LINTEL, WALL_H, 1, 0); // a verga
  wallPiece(X0, X0i, LP.z, WALL.maxZ, 0, WALL_H, 1, 0); // oeste, ao sul da porta
  wallPiece(X1i, X1, Z0i, WALL.maxZ, 0, WALL_H, -1, 0); // leste, inteira (colisor 'deposito-leste')
  // a laje do depósito (3ª pessoa: a câmera fica atrás da dog, de dentro ele precisa de teto)
  {
    const slabGeo = new THREE.BoxGeometry(ST.x1 - ST.x0 + 0.16, 0.08, WALL.maxZ - ST.z0 + 0.16);
    const lid = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.9 }));
    lid.name = 'recanto:laje-deposito';
    lid.position.set((ST.x0 + ST.x1) / 2, ST.h + 0.04, (ST.z0 + WALL.maxZ) / 2);
    lid.receiveShadow = true;
    root.add(lid);
  }
  // arremates no topo das três paredes (chegam a ST.h)
  put(rb(X1 - X0 + 0.04, 0.04, 0.2, 0.012, 1).translate(ST.x0 / 2 + ST.x1 / 2, WALL_H, ST.z0), CAPC);
  for (const x of [ST.x0, ST.x1]) put(rb(0.2, 0.04, WALL.maxZ - Z0i - 0.02, 0.012, 1).translate(x, WALL_H, (Z0i + 0.02 + WALL.maxZ) / 2), CAPC);
  // o cobogó no alto da parede leste (ventila o depósito), visto dos dois lados
  {
    const zc = (Z0i + WALL.maxZ) / 2, n = 4, s = 0.15, y0 = 1.72;
    for (const [x, d] of [[X1, 1], [X1i, -1]]) {
      put(slab(0.006, s * 2 + 0.04, s * n + 0.04).translate(x + d * 0.004, y0 - 0.02, zc), C('#d9d2c4'), { ao: false });
      for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
        const z = zc + (i - (n - 1) / 2) * s, y = y0 + j * s;
        put(slab(0.006, s * 0.56, s * 0.56).translate(x + d * 0.009, y + s * 0.22, z), C('#4b4740'), { ao: false });
        put(slab(0.006, s * 0.2, s * 0.2).translate(x + d * 0.014, y + s * 0.4, z), C('#d9d2c4'), { ao: false });
      }
    }
  }
  // batentes (o do lado da dobradiça é o encaixe da folha) e os alizares
  put(slab(0.055, LINTEL, H.z - JAMB).translate(X0 + 0.0275, 0, (JAMB + H.z) / 2), FRAME);
  put(slab(0.055, LINTEL, 0.04).translate(X0 + 0.0275, 0, LP.z - 0.02), FRAME);
  const trimV = (x, z0, z1, y1) => put(rb(0.02, y1, z1 - z0, 0.006, 1).translate(x, 0, (z0 + z1) / 2), FRAME);
  // (os alizares ficam 3 mm afastados da parede: nenhuma face no plano da borda do piso)
  trimV(X0 - 0.013, JAMB + 0.01, H.z + 0.01, LINTEL + 0.07);
  trimV(X0 - 0.013, LP.z - 0.05, LP.z + 0.03, LINTEL + 0.07);
  put(rb(0.02, 0.07, LP.z - JAMB + 0.02, 0.006, 1).translate(X0 - 0.013, LINTEL, (JAMB + LP.z + 0.02) / 2), FRAME);
  trimV(X0i + 0.013, LP.z, LP.z + 0.06, LINTEL + 0.07);
  put(rb(0.02, 0.07, LP.z + 0.06 - (H.z - 0.04), 0.006, 1).translate(X0i + 0.013, LINTEL, (H.z - 0.04 + LP.z + 0.06) / 2), FRAME);
  // as barras de cimento (por fora) e de tinta verde-acinzentada (por dentro), de 3 a 9 mm da parede
  const BARRA_O = C('#b3a58b'), BARRA_I = C('#a8b3a0');
  put(slab(0.006, 0.3, JAMB - Z0 + 0.009).translate(X0 - 0.006, 0, (Z0 - 0.009 + JAMB) / 2), BARRA_O);
  put(slab(0.006, 0.3, WALL.maxZ - LP.z - 0.04).translate(X0 - 0.006, 0, (LP.z + 0.04 + WALL.maxZ) / 2), BARRA_O);
  put(slab(X1 - X0 + 0.006, 0.3, 0.006).translate((X0 + X1) / 2, 0, Z0 - 0.006), BARRA_O);
  put(slab(0.006, 0.3, WALL.maxZ - Z0 + 0.009).translate(X1 + 0.006, 0, (Z0 - 0.009 + WALL.maxZ) / 2), BARRA_O);
  put(slab(0.006, 0.22, JAMB - Z0i - 0.009).translate(X0i + 0.006, 0, (Z0i + 0.009 + JAMB) / 2), BARRA_I);
  put(slab(0.006, 0.22, wallN - LP.z - 0.07).translate(X0i + 0.006, 0, (LP.z + 0.07 + wallN) / 2), BARRA_I);
  put(slab(X1i - X0i - 0.018, 0.22, 0.006).translate((X0i + X1i) / 2, 0, Z0i + 0.006), BARRA_I);
  put(slab(0.006, 0.22, wallN - Z0i - 0.009).translate(X1i - 0.006, 0, (Z0i + 0.009 + wallN) / 2), BARRA_I);
  // reboco caído mostrando os tijolos: por fora, em cima do carretel; por dentro, na parede norte
  const brickPatch = (face, u0, u1, y0, y1, seed) => {
    const Rb = rng(seed);
    const cu = (u0 + u1) / 2, cy = (y0 + y1) / 2, hu = (u1 - u0) / 2, hy = (y1 - y0) / 2;
    const at = (u, y, off, w, h, color) => {
      if (face === 'w') put(slab(0.003, h, w).translate(X0 - off, y - h / 2, u), color, { ao: false });
      else put(slab(w, h, 0.003).translate(u, y - h / 2, Z0i + off), color, { ao: false });
    };
    const back = shapeXY(blobPts(1, seed, 16)).scale(hu, hy, 1);
    if (face === 'w') put(back.rotateY(-Math.PI / 2).translate(X0 - 0.003, cy, cu), C('#cbbda5'), { ao: false });
    else put(back.translate(cu, cy, Z0i + 0.003), C('#cbbda5'), { ao: false });
    for (let row = 0, y = y0 + 0.04; y < y1 - 0.03; row++, y += 0.077) {
      for (let u = u0 - (row % 2) * 0.1; u < u1; u += 0.202) {
        const uc = u + 0.095;
        if (((uc - cu) / hu) ** 2 + ((y - cy) / hy) ** 2 > 0.62 || uc < u0 + 0.05 || uc > u1 - 0.05) continue;
        const w = Math.min(0.19, (u1 - 0.02) - u, u + 0.19 - (u0 + 0.02));
        if (w < 0.06) continue;
        at(Math.max(u, u0 + 0.02) + w / 2, y, 0.008, w, 0.062, _c.set('#b4573a').multiplyScalar(0.86 + Rb() * 0.26).clone());
      }
    }
  };
  brickPatch('w', Z0i + 0.08, JAMB - 0.1, 1.5, 1.92, 21);
  brickPatch('n', X0i + 0.1, X0i + 0.5, 0.3, 0.6, 23);
  // uma trinca saindo da quina da verga
  {
    const CRACK = C('#9a8d77');
    let z = LP.z + 0.04, y = LINTEL + 0.08;
    for (const [dz, dy] of [[0.06, 0.03], [0.03, 0.035], [0.07, 0.02], [0.02, 0.025]]) {
      const len = Math.hypot(dz, dy);
      put(slab(0.003, len, 0.006).rotateX(Math.atan2(dz, dy)).translate(X0 - 0.003, y, z), CRACK, { ao: false });
      z += dz;
      y += dy;
    }
  }
  // a luminária tartaruga em cima da porta, esquecida acesa desde a noite da garoa
  put(rb(0.03, 0.1, 0.19, 0.012, 1).translate(X0 - 0.015, LINTEL + 0.1, (H.z + LP.z) / 2), C('#f4efe2'));
  put(sphere(0.07, 12, 8).scale(0.45, 0.62, 1.1).translate(X0 - 0.03, LINTEL + 0.15, (H.z + LP.z) / 2), C('#ffe3a6'), { slot: 'lit', ao: false });
  for (const dy of [-0.025, 0.025]) put(slab(0.004, 0.006, 0.17).translate(X0 - 0.062, LINTEL + 0.147 + dy, (H.z + LP.z) / 2), C('#3c3a36'), { ao: false });

  // ---------- por fora: o carretel da mangueira (ao norte da porta) e o painel de ferramentas (ao sul)
  {
    const zc = (Z0i + JAMB) / 2 - 0.02, yc = 0.98;
    const GREEN = C('#3f8f4c'), HOSE = C('#4fae5c');
    put(rb(0.02, 0.36, 0.25, 0.008, 1).translate(X0 - 0.012, yc - 0.18, zc), C('#2f6b45'), { ao: false });
    for (const x of [X0 - 0.05, X0 - 0.2]) put(cyl(0.17, 0.17, 0.016, 18).translate(0, -0.008, 0).rotateZ(Math.PI / 2).translate(x, yc, zc), GREEN, { ao: false });
    for (let i = 0; i < 4; i++) {
      put(new THREE.TorusGeometry(0.108 + (i % 2) * 0.012, 0.017, 6, 18).rotateY(Math.PI / 2).translate(X0 - 0.075 - i * 0.034, yc, zc), _c.copy(HOSE).multiplyScalar(i % 2 ? 0.9 : 1.04).clone(), { ao: false });
    }
    put(cyl(0.022, 0.022, 0.2, 10).translate(0, -0.1, 0).rotateZ(Math.PI / 2).translate(X0 - 0.125, yc, zc), C('#2f6b45'), { ao: false });
    put(rodAB([X0 - 0.21, yc, zc], [X0 - 0.25, yc + 0.11, zc], 0.01), C('#d9d4c8'), { ao: false });
    put(cyl(0.016, 0.016, 0.06, 8).rotateZ(Math.PI / 2).translate(X0 - 0.27, yc + 0.11, zc), C('#e2a83a'), { ao: false });
    // a ponta da mangueira pendurada numa volta e presa no carretel, com o esguicho amarelo
    put(tubeAlong([[X0 - 0.12, yc - 0.12, zc + 0.1], [X0 - 0.15, yc - 0.27, zc + 0.15], [X0 - 0.16, 0.7, zc + 0.07], [X0 - 0.15, yc - 0.25, zc - 0.06], [X0 - 0.13, yc - 0.13, zc - 0.11]], 0.016, 6, 22), HOSE, { ao: false });
    put(cyl(0.022, 0.016, 0.1, 10).translate(X0 - 0.13, yc - 0.16, zc - 0.13), C('#f2c14e'), { ao: false });
    // a torneira de metal e o pedaço de mangueira subindo até o carretel
    put(rb(0.03, 0.05, 0.05, 0.01, 1).translate(X0 - 0.015, 0.6, zc - 0.13), C('#c99a45'), { ao: false });
    put(rodAB([X0 - 0.03, 0.63, zc - 0.13], [X0 - 0.09, 0.62, zc - 0.13], 0.012), C('#c99a45'), { ao: false });
    put(rodAB([X0 - 0.04, 0.67, zc - 0.13], [X0 - 0.04, 0.69, zc - 0.13], 0.006), C('#c99a45'), { ao: false });
    put(tubeAlong([[X0 - 0.09, 0.62, zc - 0.13], [X0 - 0.11, 0.66, zc - 0.1], [X0 - 0.1, 0.8, zc - 0.06], [X0 - 0.06, yc - 0.03, zc - 0.02]], 0.014, 6, 12), HOSE, { ao: false });
  }
  {
    const z0 = LP.z + 0.12, z1 = WALL.maxZ - 0.2, y0 = 0.82, y1 = 1.77, zc = (z0 + z1) / 2, yc = (y0 + y1) / 2;
    const BOARD = C('#c9a777'), HOLE = C('#7c6243');
    const pw = z1 - z0, ph = y1 - y0, cw = pw / Math.round(pw / 0.05), ch = ph / Math.round(ph / 0.05);
    const board = tilesV(pw, ph, cw, ch, (p) => {
      const i = Math.round((p.x + pw / 2) / cw - 0.5), j = Math.round((p.y + ph / 2) / ch - 0.5);
      return i % 2 && j % 2 ? HOLE : BOARD;
    });
    put(board.rotateY(-Math.PI / 2).translate(X0 - 0.012, yc, zc), null, { ao: false });
    const WOODF = C('#9c7448');
    for (const [dz, dy, w, h] of [[0, ph / 2, pw + 0.04, 0.03], [0, -ph / 2, pw + 0.04, 0.03], [pw / 2, 0, 0.03, ph], [-pw / 2, 0, 0.03, ph]]) {
      put(rb(0.016, h, w, 0.005, 1).translate(X0 - 0.01, yc + dy - h / 2, zc + dz), WOODF, { ao: false });
    }
    const xT = X0 - 0.03; // as ferramentas, na frente do painel
    const STEEL = C('#9aa3a8'), WOODH = C('#b98a56');
    // martelo
    put(rb(0.02, 0.27, 0.03, 0.008, 1).translate(xT, 1.24, z0 + 0.12), WOODH, { ao: false });
    put(rb(0.026, 0.036, 0.12, 0.008, 1).translate(xT, 1.5, z0 + 0.12), STEEL, { ao: false });
    // serrote (a lâmina trapezoidal e o cabo)
    put(shapeXY([[0, 0], [0.4, 0.02], [0.4, 0.075], [0, 0.12]]).rotateY(-Math.PI / 2).translate(xT + 0.005, 1.45, z0 + 0.3), C('#c4ccd0'), { ao: false });
    put(rb(0.026, 0.11, 0.1, 0.02, 1).translate(xT, 1.44, z0 + 0.28), C('#a5532f'), { ao: false });
    // chave inglesa e alicate
    put(rb(0.01, 0.2, 0.03, 0.005, 1).translate(xT, 0.98, z1 - 0.12), STEEL, { ao: false });
    put(new THREE.TorusGeometry(0.022, 0.008, 4, 10).rotateY(Math.PI / 2).translate(xT, 1.2, z1 - 0.12), STEEL, { ao: false });
    for (const s of [-1, 1]) put(rb(0.012, 0.15, 0.02, 0.006, 1).rotateX(s * 0.12).translate(xT, 0.97, z1 - 0.27 + s * 0.014), C('#d0453b'), { ao: false });
    // chaves de fenda (cabos coloridos, pontas para baixo)
    ['#d0453b', '#f2c14e', '#3f7fbf'].forEach((c, i) => {
      put(cyl(0.013, 0.013, 0.08, 8).translate(xT, 1.07, z0 + 0.06 + i * 0.06), C(c), { ao: false });
      put(rod(0.003, 0.1, 4).translate(xT, 1.02, z0 + 0.06 + i * 0.06), STEEL, { ao: false });
    });
    // nível de bolha
    put(rb(0.02, 0.04, 0.4, 0.006, 1).translate(xT, 1.64, zc), C('#f0b93b'), { ao: false });
    put(rb(0.012, 0.016, 0.05, 0.005, 1).translate(xT - 0.01, 1.652, zc), C('#9fe0a8'), { slot: 'glass', ao: false });
    // a extensão laranja enrolada num pino e o rolo de pintura
    put(new THREE.TorusGeometry(0.085, 0.018, 6, 18).rotateY(Math.PI / 2).translate(xT - 0.01, 1.3, z1 - 0.16), C('#f07c2c'), { ao: false });
    put(cyl(0.03, 0.03, 0.18, 10).rotateX(Math.PI / 2).translate(xT - 0.01, 0.92, z0 + 0.38), C('#eae5da'), { ao: false });
    put(rodAB([xT, 0.92, z0 + 0.47], [xT, 1.08, z0 + 0.5], 0.006), STEEL, { ao: false });
  }

  // ---------- por dentro: a prateleira do balde (ao norte da porta), com uma lata de pregos e a almotolia
  const WOODS = C('#b4875a'), IRON = C('#38383c');
  put(rb(SH.x1 - SH.x0, 0.03, SH.z1 - SH.z0, 0.008, 1).translate((SH.x0 + SH.x1) / 2, SH.y - 0.03, (SH.z0 + SH.z1) / 2), WOODS, { ao: false });
  for (const z of [SH.z0 + 0.08, SH.z1 - 0.08]) {
    put(slab(0.02, 0.26, 0.025).translate(SH.x0 + 0.01, SH.y - 0.29, z), IRON, { ao: false });
    put(slab(SH.x1 - SH.x0 - 0.04, 0.02, 0.025).translate((SH.x0 + SH.x1) / 2 - 0.02, SH.y - 0.05, z), IRON, { ao: false });
    put(rodAB([SH.x0 + 0.02, SH.y - 0.26, z], [SH.x1 - 0.06, SH.y - 0.05, z], 0.008, 4), IRON, { ao: false });
  }
  put(cyl(0.045, 0.045, 0.11, 12).translate(SH.x0 + 0.1, SH.y, SH.z0 + 0.07), C('#c9442f'), { ao: false });
  put(cyl(0.046, 0.046, 0.012, 12).translate(SH.x0 + 0.1, SH.y + 0.11, SH.z0 + 0.07), C('#8d969a'), { ao: false });
  put(cyl(0.03, 0.035, 0.08, 10).translate(SH.x1 - 0.06, SH.y, SH.z0 + 0.06), C('#3f7fbf'), { ao: false });
  put(rodAB([SH.x1 - 0.06, SH.y + 0.08, SH.z0 + 0.06], [SH.x1 - 0.06, SH.y + 0.15, SH.z0 + 0.13], 0.004), C('#c99a45'), { ao: false });

  // ---------- as prateleiras de latas e potes, na parede oeste ao sul da porta (fora do arco da folha)
  {
    const z0 = LP.z + 0.14, z1 = wallN - 0.06, zc = (z0 + z1) / 2, x0 = X0i, x1 = X0i + 0.22, xc = (x0 + x1) / 2;
    for (const y of [0.95, 1.4, 1.85]) {
      put(rb(x1 - x0, 0.025, z1 - z0, 0.006, 1).translate(xc, y - 0.025, zc), WOODS, { ao: false });
      for (const z of [z0 + 0.1, z1 - 0.1]) put(slab(0.018, 0.12, 0.02).translate(x0 + 0.009, y - 0.145, z), IRON, { ao: false });
    }
    const can = (z, y, r, h, label, lid = '#9aa3a8') => {
      put(cyl(r, r, h, 14).translate(xc, y, z), C('#e9e6df'));
      put(cyl(r + 0.003, r + 0.003, h * 0.5, 14).translate(xc, y + h * 0.22, z), C(label), { ao: false });
      put(cyl(r * 0.96, r * 0.96, 0.008, 14).translate(xc, y + h, z), C(lid), { ao: false });
      put(rb(0.012, 0.03, 0.008, 0.003, 1).translate(xc + r * 0.6, y + h + 0.006, z), C(label), { ao: false }); // o escorrido de tinta na beira
    };
    can(z0 + 0.12, 0.95, 0.085, 0.2, '#3f7fbf');
    can(z0 + 0.32, 0.95, 0.075, 0.17, '#f2c14e');
    can(z1 - 0.13, 0.95, 0.085, 0.2, '#5ba35a');
    put(rb(0.2, 0.15, 0.2, 0.01, 1).translate(xc, 0.95, z0 + 0.55), C('#c69a62'));
    put(slab(0.205, 0.004, 0.04).translate(xc, 1.1, z0 + 0.55), C('#d9c9a3'), { ao: false });
    // potes de vidro com parafusos e uma lata de spray
    for (let i = 0; i < 3; i++) {
      put(cyl(0.045, 0.045, 0.12, 12).translate(xc, 1.4, z0 + 0.08 + i * 0.11), C('#b7d4dc'), { slot: 'glass', ao: false });
      put(cyl(0.035, 0.035, 0.05, 10).translate(xc, 1.405, z0 + 0.08 + i * 0.11), C(['#8d7b62', '#9aa3a8', '#7f6a52'][i]), { ao: false });
      put(cyl(0.047, 0.047, 0.02, 12).translate(xc, 1.52, z0 + 0.08 + i * 0.11), C(['#d0453b', '#3f7fbf', '#f2c14e'][i]), { ao: false });
    }
    put(cyl(0.03, 0.03, 0.17, 10).translate(xc, 1.4, z1 - 0.32), C('#d0453b'));
    put(cyl(0.012, 0.012, 0.02, 8).translate(xc, 1.57, z1 - 0.32), C('#f4efe2'), { ao: false });
    put(rb(0.19, 0.11, 0.24, 0.01, 1).translate(xc, 1.4, z1 - 0.14), C('#b88d58'));
    // em cima: caixas de papelão e um farolete
    put(rb(0.2, 0.22, 0.3, 0.012, 1).translate(xc, 1.85, z0 + 0.2), C('#c69a62'));
    put(slab(0.205, 0.004, 0.05).translate(xc, 2.07, z0 + 0.2), C('#d9c9a3'), { ao: false });
    put(rb(0.18, 0.16, 0.22, 0.012, 1).translate(xc, 1.85, z0 + 0.52), C('#b88d58'));
    put(rb(0.08, 0.1, 0.12, 0.02, 1).translate(xc, 1.85, z1 - 0.1), C('#f2c14e'));
    put(cyl(0.04, 0.04, 0.012, 12).rotateZ(Math.PI / 2).translate(xc + 0.046, 1.91, z1 - 0.1), C('#fff6d8'), { slot: 'glass', ao: false });
  }

  // ---------- latas de tinta no chão, no canto sudoeste (colisor 'deposito-latas'), e um pingo de tinta azul
  const PAINT_CORNER = { x0: X0i, x1: X0i + 0.57, z0: LP.z + 0.2, z1: wallN };
  {
    const floorCan = (x, z, r, h, y0, label) => {
      put(cyl(r, r, h, 16).translate(x, y0, z), C('#e7e3da'));
      put(cyl(r + 0.003, r + 0.003, h * 0.55, 16).translate(x, y0 + h * 0.2, z), C(label), { ao: false });
      put(cyl(r * 0.97, r * 0.97, 0.01, 16).translate(x, y0 + h, z), C('#9aa3a8'), { ao: false });
      put(new THREE.TorusGeometry(r * 0.85, 0.004, 4, 16, Math.PI).rotateY(0.7).translate(x, y0 + h + 0.01, z), C('#5f666a'), { ao: false });
    };
    floorCan(X0i + 0.16, PAINT_CORNER.z0 + 0.2, 0.13, 0.26, FLOOR, '#d65a4a');
    floorCan(X0i + 0.16, PAINT_CORNER.z0 + 0.2, 0.11, 0.22, FLOOR + 0.27, '#f2c14e');
    floorCan(X0i + 0.42, PAINT_CORNER.z0 + 0.3, 0.12, 0.25, FLOOR, '#5f9ad0');
    floorCan(X0i + 0.17, wallN - 0.2, 0.14, 0.28, FLOOR, '#f3efe6');
    put(flatBlob(0.06, 31, 16, 0.35).translate(PAINT_CORNER.x1 - 0.06, D2, PAINT_CORNER.z0 - 0.09), C('#5f9ad0'), { slot: 'ground' });
  }

  // ---------- a caixa de brinquedos das irmãs (a meia fica em cima, SOCKS 'deposito') e o saco de ração ('deposito-caixa')
  const SOCK = L.SOCKS?.find((s) => s.id === 'deposito') ?? { x: 4.0, z: 8.0, y: 0.45 };
  const TOYBOX = { x: SOCK.x, z: SOCK.z, h: Math.max(0.3, SOCK.y - 0.032) - FLOOR, half: 0.18 };
  {
    const top = FLOOR + TOYBOX.h;
    put(rb(TOYBOX.half * 2, TOYBOX.h - 0.06, TOYBOX.half * 2, 0.012, 1).translate(TOYBOX.x, FLOOR, TOYBOX.z), C('#c79b63'));
    put(rb(TOYBOX.half * 2 + 0.012, 0.06, TOYBOX.half * 2 + 0.012, 0.012, 1).translate(TOYBOX.x, top - 0.06, TOYBOX.z), C('#d1a76f'));
    put(slab(0.06, 0.003, TOYBOX.half * 2 + 0.014).translate(TOYBOX.x, top, TOYBOX.z), C('#e3d6b5'), { ao: false });
    // o ossinho desenhado na face de frente (para a câmera)
    const bone = [[-0.07, -0.012], [0.07, -0.012], [0.07, 0.012], [-0.07, 0.012]];
    put(shapeXY(bone).translate(TOYBOX.x, top - 0.18, TOYBOX.z + TOYBOX.half + 0.004), C('#fff6e6'), { ao: false });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) put(new THREE.CircleGeometry(0.02, 10).translate(TOYBOX.x + sx * 0.075, top - 0.18 + sy * 0.014, TOYBOX.z + TOYBOX.half + 0.004), C('#fff6e6'), { ao: false });
    // o saco de ração encostado no canto (a patinha na frente)
    const bag = rb(0.32, 0.55, 0.16, 0.06, 2);
    put(bag.rotateY(-0.25).translate(TOYBOX.x + 0.2, FLOOR, TOYBOX.z + 0.42), C('#d9772f'));
    put(new THREE.CircleGeometry(0.035, 12).rotateY(-0.25).translate(TOYBOX.x + 0.18, FLOOR + 0.27, TOYBOX.z + 0.505), C('#fff6e6'), { ao: false });
    for (let i = 0; i < 4; i++) put(new THREE.CircleGeometry(0.014, 8).rotateY(-0.25).translate(TOYBOX.x + 0.18 + Math.cos(0.7 + i * 0.58) * 0.05, FLOOR + 0.27 + Math.sin(0.7 + i * 0.58) * 0.05, TOYBOX.z + 0.505), C('#fff6e6'), { ao: false });
  }
  // ---------- a vassoura e o rastelo encostados no canto nordeste (colisor 'deposito-vassouras')
  {
    const bx = X1i - 0.17, bz = Z0i + 0.2;
    put(rodAB([bx, FLOOR + 0.12, bz], [bx + 0.02, 1.36, Z0i + 0.025], 0.013), C('#d9a441'));
    put(rb(0.3, 0.05, 0.06, 0.02, 1).rotateY(0.15).translate(bx, FLOOR + 0.1, bz), C('#d0453b'));
    put(rb(0.28, 0.1, 0.045, 0.01, 1).rotateY(0.15).translate(bx, FLOOR, bz + 0.005), C('#e6c879'));
    const rx = X1i - 0.24, rz = Z0i + 0.13;
    put(rodAB([rx, FLOOR, rz], [rx - 0.02, 1.3, Z0i + 0.03], 0.012), C('#b98a56'));
    put(rb(0.3, 0.03, 0.03, 0.008, 1).translate(rx - 0.02, 1.27, Z0i + 0.045), C('#7d8589'), { ao: false });
    for (let i = 0; i < 9; i++) put(rod(0.004, 0.07, 3).translate(rx - 0.15 + i * 0.033, 1.335, Z0i + 0.05), C('#7d8589'), { ao: false });
  }
  // ---------- a bicicleta pendurada no alto da parede norte, por dentro (fora do arco da porta)
  {
    const z = Z0i + 0.16, wy = 1.72, rw = 0.24, xr = X0i + 0.8, xf = xr + 0.7;
    const MINT = C('#6fc6ad'), TIRE = C('#2f2b29'), METAL = C('#c7ced2');
    for (const x of [xr, xf]) {
      put(new THREE.TorusGeometry(rw - 0.012, 0.018, 6, 22).translate(x, wy, z), TIRE, { ao: false });
      put(new THREE.TorusGeometry(rw - 0.034, 0.006, 4, 22).translate(x, wy, z), METAL, { ao: false });
      for (let i = 0; i < 6; i++) put(rod(0.0022, (rw - 0.03) * 2, 3).rotateZ((i / 6) * Math.PI).translate(x, wy, z), METAL, { ao: false });
      put(cyl(0.02, 0.02, 0.05, 8).rotateX(Math.PI / 2).translate(x, wy, z), METAL, { ao: false });
    }
    const bb = [xr + 0.33, wy - 0.06, z], seat = [xr + 0.24, wy + 0.28, z], head = [xf - 0.08, wy + 0.3, z], headB = [xf - 0.05, wy + 0.17, z];
    for (const [a, b] of [[bb, seat], [bb, headB], [seat, head], [bb, [xr, wy, z]], [seat, [xr, wy, z]], [headB, [xf, wy, z]], [head, headB]]) put(rodAB(a, b, 0.014), MINT, { ao: false });
    put(rodAB([seat[0] - 0.02, seat[1], z], [seat[0] - 0.04, seat[1] + 0.07, z], 0.01), METAL, { ao: false });
    put(rb(0.17, 0.035, 0.08, 0.015, 1).translate(seat[0] - 0.05, seat[1] + 0.07, z), C('#5a3a2a'), { ao: false });
    put(rodAB(head, [head[0] + 0.01, head[1] + 0.07, z], 0.01), METAL, { ao: false });
    put(rodAB([head[0] - 0.04, head[1] + 0.07, z - 0.1], [head[0] + 0.05, head[1] + 0.07, z + 0.1], 0.009), METAL, { ao: false });
    for (const s of [-1, 1]) put(cyl(0.014, 0.014, 0.06, 8).rotateX(Math.PI / 2).rotateY(-0.42).translate(head[0] + s * 0.05, head[1] + 0.07, z + s * 0.11), C('#f4efe2'), { ao: false });
    put(cyl(0.065, 0.065, 0.01, 14).rotateX(Math.PI / 2).translate(bb[0], bb[1], z + 0.025), C('#8d969a'), { ao: false });
    // a cestinha de vime na frente e os ganchos da parede
    put(rb(0.2, 0.12, 0.16, 0.02, 1).translate(xf + 0.03, wy + rw + 0.03, z), C('#c9a46a'), { ao: false });
    put(slab(0.19, 0.004, 0.15).translate(xf + 0.03, wy + rw + 0.151, z), C('#8a6c43'), { ao: false });
    for (const x of [xr + 0.15, xf - 0.2]) put(new THREE.TorusGeometry(0.03, 0.006, 4, 10, Math.PI).rotateX(-Math.PI / 2).translate(x, wy + 0.3, Z0i + 0.04), C('#4a4a4e'), { ao: false });
  }

  // ======================================================== 3. COBERTURA
  const WOOD = C('#8b5c3b'), WOOD_L = C('#9c6a45'), CONCB = C('#c9c3b8');
  const BEAM_F = { y0: 2.36, h: 0.24, z: CP.z0 };
  /**
   * A viga de trás fica perto da câmera: perfil baixo (cruza a vista como uma faixa fina). E 28 cm antes do muro: os
   * pilares do muro (base.js) ficam sempre fora do pilar dela; os caibros passam por cima e chegam ao muro.
   */
  const BEAM_B = { y0: 2.7, h: 0.14, z: wallN - 0.28 };
  const RAF0 = BEAM_F.y0 + BEAM_F.h;
  const SLOPE = (BEAM_B.y0 + BEAM_B.h - RAF0) / (BEAM_B.z - BEAM_F.z);
  const THETA = Math.atan(SLOPE);
  const yRaf = (z) => RAF0 + (z - BEAM_F.z) * SLOPE; // embaixo dos caibros
  const sheetC = (z) => yRaf(z) + 0.135; // meio das ondas do policarbonato
  const sheetTop = (z) => sheetC(z) + 0.012; // a crista das ondas
  // pilares: os da frente nos colisores 'garagem-pilar-1/2'; o de trás, no oeste, contra o muro ('garagem-pilar-3');
  // no leste, a viga de trás apoia nas paredes do depósito (pontaletes em cima delas)
  const BACK_POST = { x: CP.x0, z: BEAM_B.z };
  const post = (x, z, top) => {
    put(cyl(0.095, 0.095, 0.1, 14).translate(x, 0, z), CONCB);
    put(slab(0.14, 0.012, 0.14).translate(x, 0.1, z), C('#4a4a4e'));
    put(rb(0.12, top - 0.112, 0.12, 0.015, 1).translate(x, 0.112, z), WOOD);
  };
  post(CP.x0, CP.z0, BEAM_F.y0);
  post(CP.x1, CP.z0, BEAM_F.y0);
  post(BACK_POST.x, BACK_POST.z, BEAM_B.y0);
  for (const x of [ST.x0, ST.x1]) put(rb(0.12, BEAM_B.y0 - ST.h, 0.12, 0.012, 1).translate(x, ST.h, BEAM_B.z), WOOD); // pontaletes
  // mãos-francesas
  const brace = (x, z, dir, yTop) => put(rb(0.07, 0.58, 0.07, 0.012, 1).translate(0, -0.29, 0).rotateZ(-dir * Math.PI / 4).translate(x + dir * 0.26, yTop - 0.2, z), WOOD_L);
  brace(CP.x0, CP.z0, 1, BEAM_F.y0);
  brace(CP.x1, CP.z0, -1, BEAM_F.y0);
  brace(BACK_POST.x, BACK_POST.z, 1, BEAM_B.y0);
  // vigas
  const bx0 = CP.x0 - 0.17, bx1 = CP.x1 + 0.17;
  put(rb(bx1 - bx0, BEAM_F.h, 0.12, 0.02, 1).translate((bx0 + bx1) / 2, BEAM_F.y0, BEAM_F.z), WOOD);
  put(rb(bx1 - bx0 - 0.08, BEAM_B.h, 0.08, 0.015, 1).translate((bx0 + bx1) / 2 - 0.02, BEAM_B.y0, BEAM_B.z), WOOD);
  // caibros (ao longo de z: de frente para a câmera, quase não tapam nada)
  const RZ0 = CP.z0 - 0.3, RZ1 = wallN - 0.02, RZC = (RZ0 + RZ1) / 2;
  const rafLen = (RZ1 - RZ0) / Math.cos(THETA);
  const NRAF = 10;
  for (let i = 0; i < NRAF; i++) {
    const x = CP.x0 - 0.05 + (i / (NRAF - 1)) * (CP.x1 - CP.x0 + 0.1);
    put(rb(0.06, 0.12, rafLen, 0.012, 1), WOOD_L, { x, y: yRaf(RZC), z: RZC, rx: -THETA });
  }
  // testeira, calha (com o canal) e o bico da calha no canto oeste
  put(rb(bx1 - bx0 + 0.06, 0.16, 0.025, 0.008, 1).translate((bx0 + bx1) / 2, yRaf(RZ0) - 0.03, RZ0 - 0.012), C('#f2ece0'));
  const GUT = { z: RZ0 - 0.09, y: 2.56 };
  put(rb(bx1 - bx0 + 0.08, 0.075, 0.1, 0.03, 1).translate((bx0 + bx1) / 2, GUT.y, GUT.z), C('#e9e6df'));
  put(slab(bx1 - bx0 + 0.04, 0.003, 0.06).translate((bx0 + bx1) / 2, GUT.y + 0.076, GUT.z), C('#8f9599'), { ao: false });
  const SPOUT = { x: bx0 + 0.04, y: GUT.y - 0.14, z: GUT.z };
  put(cyl(0.024, 0.024, 0.14, 10).translate(SPOUT.x, SPOUT.y, SPOUT.z), C('#d9d6cf'));
  // as telhas de policarbonato (translúcidas: a câmera vê a garagem por baixo delas)
  const sheetW = bx1 - bx0 + 0.04, sheetL = (RZ1 + 0.04 - (RZ0 - 0.02)) / Math.cos(THETA);
  const sheetGeo = new THREE.PlaneGeometry(sheetW, sheetL, Math.round(sheetW / 0.15) * 4, 2).rotateX(-Math.PI / 2);
  {
    const p = sheetGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, 0.012 * Math.sin((p.getX(i) / 0.15) * TAU));
    sheetGeo.computeVertexNormals();
    sheetGeo.rotateX(-THETA);
    const zc = (RZ1 + 0.04 + RZ0 - 0.02) / 2;
    sheetGeo.translate((bx0 + bx1) / 2, sheetC(zc), zc);
  }
  const sheetMat = mat('recanto-policarbonato', () => new THREE.MeshStandardMaterial({ color: '#eef6ff', transparent: true, opacity: 0.16, roughness: 0.16, metalness: 0, depthWrite: false }));
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  sheet.name = 'garagem:policarbonato';
  sheet.castShadow = false;
  sheet.receiveShadow = true;
  sheet.renderOrder = 2;
  root.add(sheet);

  // ======================================================== 4. CAMINHONETE (de ré: a caçamba para a câmera)
  const CX = (CAR.x0 + CAR.x1) / 2;
  const TX0 = CAR.x0 + 0.02, TX1 = CAR.x1 - 0.02; // a lataria
  const WY = CAR.wheelR + 0.012; // centro das rodas (o pneu amassa 6 mm no piso)
  const WF = Math.min(...WHEELS.map((w) => w.z)), WR = Math.max(...WHEELS.map((w) => w.z));
  const UNDER = 0.49; // embaixo da lataria: a Radhija (0,48 m) passa
  const ARCH = 0.43; // raio dos arcos das rodas
  const ZF = CAR.z0 + 0.07; // a grade
  const ZCAB = 6.3; // fundo da cabine
  const ZR = CAR.z1 - 0.04; // a tampa da caçamba
  const BELT = 1.08;
  const RED = C('#c4553f'), CREAM = C('#efe5cf'), DARK = C('#2a2a2e'), LINER = C('#3b3a37'), CHROME = C('#d5dade');
  const archDark = (p, n, base) => {
    if (n.y < -0.6) return DARK;
    if (Math.abs(n.x) < 0.7) for (const wz of [WF, WR]) if (Math.hypot(p.z - wz, p.y - WY) < ARCH + 0.045) return DARK;
    return base;
  };
  const paintRed = (p, n) => archDark(p, n, _c.copy(RED).multiplyScalar(1 + (vnoise2(p.x * 3 + p.y * 2, p.z * 3) - 0.5) * 0.05));
  {
    // a frente (capô, para-lamas e a parte de baixo da cabine), com o arco da roda da frente
    const bs = 0.03;
    put(extrudeX((s) => {
      const yb = UNDER + bs, r = ARCH + bs, dz = Math.sqrt(r * r - (yb - WY) ** 2);
      s.moveTo(ZF + 0.07, yb);
      s.lineTo(WF - dz, yb);
      s.absarc(WF, WY, r, Math.atan2(yb - WY, -dz), Math.atan2(yb - WY, dz), true);
      s.lineTo(ZCAB - bs - 0.03, yb);
      s.quadraticCurveTo(ZCAB - bs, yb, ZCAB - bs, yb + 0.03);
      s.lineTo(ZCAB - bs, BELT - bs - 0.03);
      s.quadraticCurveTo(ZCAB - bs, BELT - bs, ZCAB - bs - 0.03, BELT - bs);
      s.lineTo(5.42, BELT - bs - 0.005);
      s.lineTo(4.62, BELT - bs - 0.045);
      s.quadraticCurveTo(ZF + bs + 0.03, BELT - bs - 0.05, ZF + bs + 0.005, BELT - bs - 0.12);
      s.lineTo(ZF + bs, yb + 0.08);
      s.quadraticCurveTo(ZF + bs, yb, ZF + 0.07, yb);
    }, TX0, TX1, { bt: 0.035, bs, segs: 2, curve: 12 }), paintRed);
    // a capota creme (para-brisa inclinado, teto, vidro de trás)
    put(extrudeX((s) => {
      s.moveTo(5.48, 1.1);
      s.lineTo(5.82, 1.7);
      s.quadraticCurveTo(5.85, 1.755, 5.92, 1.76);
      s.lineTo(6.18, 1.76);
      s.quadraticCurveTo(6.235, 1.755, 6.24, 1.7);
      s.lineTo(6.245, 1.1);
      s.lineTo(5.48, 1.1);
    }, TX0 + 0.08, TX1 - 0.08, { bt: 0.04, bs: 0.04, segs: 2, curve: 6 }), (p) => _c.copy(CREAM).multiplyScalar(1 + (vnoise2(p.x * 4, p.z * 4) - 0.5) * 0.04));
    // vidros: para-brisa, laterais e o de trás (com as patinhas adesivadas)
    const SKY = C('#87aac0'), DEEP = C('#3f5667');
    const GLASS = (p) => _c.copy(SKY).lerp(DEEP, clamp01((1.62 - p.y) / 0.5));
    const nW = [-0.87, 0.493]; // normal de fora do para-brisa (z, y)
    put(panelZY([5.445 + 0.0, 1.1197], [5.785, 1.7197], TX0 + 0.16, TX1 - 0.16, nW, 0.006, 0.006, 0.08), GLASS, { slot: 'glass', ao: false });
    const side = [[5.57, 1.16], [5.83, 1.62], [5.9, 1.69], [6.16, 1.69], [6.18, 1.16]];
    put(shapeXY(side.map(([z, y]) => [z, y])).rotateY(-Math.PI / 2).translate(TX0 + 0.08 - 0.004, 0, 0), GLASS, { slot: 'glass', ao: false });
    put(shapeXY(side.map(([z, y]) => [-z, y])).rotateY(Math.PI / 2).translate(TX1 - 0.08 + 0.004, 0, 0), GLASS, { slot: 'glass', ao: false });
    put(rb(1.5, 0.5, 0.006, 0.05, 1).translate(CX, 1.18, 6.291), GLASS, { slot: 'glass', ao: false });
    const paw = (x, y, s) => {
      put(new THREE.CircleGeometry(0.03 * s, 12).scale(1.15, 0.9, 1).translate(x, y, 6.298), C('#f6f2ea'), { ao: false });
      for (let i = 0; i < 4; i++) {
        const a = 0.5 + i * 0.7;
        put(new THREE.CircleGeometry(0.012 * s, 8).translate(x + Math.cos(a) * 0.045 * s, y + Math.sin(a) * 0.045 * s, 6.298), C('#f6f2ea'), { ao: false });
      }
    };
    paw(CX - 0.55, 1.28, 1.25);
    paw(CX - 0.4, 1.25, 0.85);
    // frisos e maçanetas das portas, nos dois lados
    for (const sd of [-1, 1]) {
      const x = sd < 0 ? TX0 - 0.003 : TX1 + 0.003;
      for (const [z0, z1, y0, y1] of [[5.46, 5.467, 0.56, 1.04], [6.215, 6.222, 0.56, 1.04], [5.46, 6.222, 0.56, 0.567]]) {
        put(new THREE.BoxGeometry(0.004, y1 - y0, z1 - z0).translate(x + sd * 0.002, (y0 + y1) / 2, (z0 + z1) / 2), C('#7e2f22'), { ao: false });
      }
      put(rb(0.014, 0.028, 0.12, 0.006, 1).translate(x + sd * 0.007, 0.96, 6.1), CHROME, { slot: 'glass', ao: false });
      // retrovisor (acima das dogs)
      const mx = sd < 0 ? TX0 - 0.07 : TX1 + 0.07;
      put(rodAB([sd < 0 ? TX0 + 0.04 : TX1 - 0.04, 1.11, 5.52], [mx, 1.17, 5.57], 0.012), DARK, { ao: false });
      put(rb(0.04, 0.11, 0.15, 0.02, 1).translate(mx, 1.12, 5.6), DARK, { ao: false });
      put(rb(0.03, 0.09, 0.006, 0.01, 1).translate(mx, 1.13, 5.677), C('#9fc0d4'), { slot: 'glass', ao: false });
      // para-lamas de plástico sobre as rodas
      for (const wz of [WF, WR]) {
        put(extrudeX((s) => {
          s.absarc(wz, WY, ARCH + 0.05, 0.36, Math.PI - 0.36, false);
          s.absarc(wz, WY, ARCH - 0.005, Math.PI - 0.36, 0.36, true);
        }, sd < 0 ? CAR.x0 : TX1 - 0.03, sd < 0 ? TX0 + 0.03 : CAR.x1, { bt: 0.008, bs: 0.006, segs: 1, curve: 14 }), C('#3a3a3e'), { ao: false });
      }
    }
    // a caçamba: as laterais com o arco de trás (vermelhas por fora, revestidas por dentro), o fundo, a frente e a tampa
    const bedSide = (x0, x1, inDir) => put(extrudeX((s) => {
      const b = 0.012, yb = UNDER + b, r = ARCH + b, dz = Math.sqrt(r * r - (yb - WY) ** 2);
      s.moveTo(ZCAB + 0.04 + b, yb);
      s.lineTo(WR - dz, yb);
      s.absarc(WR, WY, r, Math.atan2(yb - WY, -dz), Math.atan2(yb - WY, dz), true);
      s.lineTo(ZR - b, yb);
      s.lineTo(ZR - b, BELT - b);
      s.lineTo(ZCAB + 0.04 + b, BELT - b);
      s.lineTo(ZCAB + 0.04 + b, yb);
    }, x0, x1, { bt: 0.012, bs: 0.012, segs: 1, curve: 12 }), (p, n) => (n.x * inDir > 0.5 && p.y > 0.7 ? LINER : paintRed(p, n)));
    bedSide(TX0, TX0 + 0.06, 1);
    bedSide(TX1 - 0.06, TX1, -1);
    const BED = { x0: TX0 + 0.06, x1: TX1 - 0.06, z0: ZCAB + 0.06, z1: ZR - 0.07, y: 0.74 };
    put(slab(BED.x1 - BED.x0, 0.06, BED.z1 - BED.z0).translate(CX, BED.y - 0.06, (BED.z0 + BED.z1) / 2), LINER);
    for (let i = 0; i < 6; i++) put(slab(0.03, 0.004, BED.z1 - BED.z0 - 0.04).translate(BED.x0 + 0.15 + i * 0.3, BED.y + 0.001, (BED.z0 + BED.z1) / 2), C('#4a4946'), { ao: false });
    put(slab(BED.x1 - BED.x0, BELT - BED.y - 0.01, 0.05).translate(CX, BED.y, ZCAB + 0.06), LINER);
    put(rb(BED.x1 - BED.x0, 0.45, 0.07, 0.015, 1).translate(CX, 0.62, ZR - 0.035), (p, n) => (n.z < -0.5 ? LINER : paintRed(p, n)));
    put(rb(BED.x1 - BED.x0 + 0.01, 0.022, 0.09, 0.008, 1).translate(CX, 1.068, ZR - 0.035), _c.copy(RED).multiplyScalar(0.86).clone());
    for (const x of [TX0 + 0.03, TX1 - 0.03]) put(rb(0.085, 0.025, ZR - ZCAB - 0.02, 0.01, 1).translate(x, BELT - 0.006, (ZCAB + 0.04 + ZR) / 2), _c.copy(RED).multiplyScalar(0.86).clone());
    // as caixas de roda dentro da caçamba
    for (const [x0, x1] of [[BED.x0, BED.x0 + 0.22], [BED.x1 - 0.22, BED.x1]]) {
      put(extrudeX((s) => {
        const r = 0.52, dz = Math.sqrt(r * r - (BED.y - WY) ** 2);
        s.moveTo(WR - dz, BED.y);
        s.absarc(WR, WY, r, Math.atan2(BED.y - WY, -dz), Math.atan2(BED.y - WY, dz), true);
        s.lineTo(WR - dz, BED.y);
      }, x0, x1, { bt: 0.01, bs: 0.01, segs: 1, curve: 10 }), LINER, { ao: false });
    }
    // a tampa: o vinco, a maçaneta, a placa (sem letras) e as lanternas
    put(slab(1.6, 0.008, 0.004).translate(CX, 0.9, ZR + 0.003), _c.copy(RED).multiplyScalar(0.8).clone(), { ao: false });
    put(rb(0.16, 0.035, 0.015, 0.006, 1).translate(CX, 0.97, ZR + 0.006), DARK, { ao: false });
    put(rb(0.34, 0.11, 0.008, 0.004, 1).translate(CX, 0.7, ZR + 0.006), C('#f4f2ec'), { ao: false });
    put(slab(0.33, 0.022, 0.003).translate(CX, 0.785, ZR + 0.0115), C('#2f5fb8'), { ao: false });
    for (const x of [TX0 + 0.035, TX1 - 0.035]) {
      put(rb(0.065, 0.2, 0.02, 0.008, 1).translate(x, 0.8, ZR + 0.012), C('#c9362f'), { slot: 'glass', ao: false });
      put(rb(0.065, 0.06, 0.02, 0.008, 1).translate(x, 0.73, ZR + 0.012), C('#f2efe6'), { slot: 'glass', ao: false });
    }
    // para-choques cromados (o de trás com o degrau de borracha)
    put(rb(TX1 - TX0 + 0.02, 0.15, 0.13, 0.04, 1).translate(CX, 0.5, CAR.z0 + 0.065), CHROME, { slot: 'glass' });
    put(rb(TX1 - TX0 + 0.02, 0.14, 0.13, 0.04, 1).translate(CX, 0.5, CAR.z1 - 0.065), CHROME, { slot: 'glass' });
    put(slab(0.6, 0.004, 0.08).translate(CX, 0.641, CAR.z1 - 0.065), DARK, { ao: false });
    // a frente: a grade, os faróis redondos e os piscas
    put(rb(0.86, 0.24, 0.025, 0.02, 1).translate(CX, 0.66, ZF - 0.008), CHROME, { slot: 'glass', ao: false });
    put(rb(0.78, 0.18, 0.012, 0.015, 1).translate(CX, 0.69, ZF - 0.026), DARK, { ao: false });
    for (const x of [CX - 0.7, CX + 0.7]) {
      put(cyl(0.075, 0.075, 0.03, 16).translate(0, -0.015, 0).rotateX(Math.PI / 2).translate(x, 0.86, ZF - 0.012), C('#f4f0e2'), { slot: 'glass', ao: false });
      put(new THREE.TorusGeometry(0.078, 0.01, 6, 16).translate(x, 0.86, ZF - 0.026), CHROME, { slot: 'glass', ao: false });
      put(rb(0.1, 0.04, 0.02, 0.008, 1).translate(x, 0.71, ZF - 0.012), C('#f0a43a'), { slot: 'glass', ao: false });
    }
    // capô: os vincos, a grelha de ar na frente do para-brisa, os limpadores e a antena
    const hoodY = (z) => BELT - 0.045 + (z - 4.62) * 0.05;
    for (const x of [TX0 + 0.16, TX1 - 0.16]) put(slab(0.006, 0.004, 0.94).rotateX(-0.05).translate(x, hoodY(4.9) + 0.004, 4.9), _c.copy(RED).multiplyScalar(0.78).clone(), { ao: false });
    put(slab(1.6, 0.006, 0.06).translate(CX, BELT - 0.002, 5.39), DARK, { ao: false });
    for (const [a, b] of [[CX - 0.62, CX - 0.12], [CX + 0.1, CX + 0.6]]) put(rodAB([a, 1.152, 5.452], [b, 1.162, 5.448], 0.006, 4), DARK, { ao: false });
    put(rodAB([TX1 - 0.09, BELT, 4.78], [TX1 - 0.09, 1.72, 4.98], 0.004, 4), DARK, { ao: false });
    put(sphere(0.009, 6, 4).translate(TX1 - 0.09, 1.72, 4.98), DARK, { ao: false });
    // a tampa do tanque, a lama da tempestade e o remendo de massa no para-lama da frente
    put(cyl(0.035, 0.035, 0.008, 12).rotateZ(Math.PI / 2).translate(TX0 - 0.004, 0.92, 6.86), DARK, { ao: false });
    const MUD = [C('#7b5d43'), C('#5d4532'), C('#8f7255')];
    // (manchas com respingos de até ~1,75 r: ficam dentro dos painéis, longe dos arcos e da borda de baixo)
    const muds = [[5.62, 0.64, 0.05], [5.86, 0.6, 0.035], [4.4, 0.62, 0.035], [6.7, 0.62, 0.05], [6.95, 0.57, 0.03], [8.1, 0.62, 0.04], [6.45, 0.95, 0.025]];
    muds.forEach(([z, y, r], i) => {
      for (const sd of [-1, 1]) put(wallBlob(r * (sd < 0 ? 1 : 0.85), 40 + i * 3 + (sd + 1), sd, 14, 0.3).translate(sd < 0 ? TX0 - 0.003 : TX1 + 0.003, y, z + (sd < 0 ? 0 : 0.04)), MUD[i % 3], { ao: false });
    });
    for (const [x, y, r] of [[CX - 0.6, 0.72, 0.04], [CX + 0.55, 0.71, 0.045], [CX + 0.32, 0.69, 0.025]]) put(wallBlob(r, Math.round(70 + x * 10), 0, 14, 0.3).translate(x, y, ZR + 0.004), MUD[1], { ao: false });
    put(shapeXY([[0, 0], [0.3, 0], [0.3, 0.13], [0, 0.13]]).rotateY(-Math.PI / 2).translate(TX0 - 0.003, 0.84, 4.55), C('#9aa1a4'), { ao: false });
    // embaixo: as longarinas, o tanque e o escapamento (tudo acima de 0,49 m: a Radhija passa)
    for (const x of [CX - 0.5, CX + 0.5]) put(slab(0.07, 0.09, ZR - ZCAB - 0.12).translate(x, 0.5, (ZCAB + 0.06 + ZR - 0.06) / 2), DARK, { ao: false });
    put(rb(0.62, 0.15, 0.48, 0.03, 1).translate(CX, 0.505, 6.86), C('#3a3a3e'), { ao: false });
    put(rodAB([CX + 0.75, 0.535, 6.4], [CX + 0.75, 0.535, ZR], 0.026, 8), C('#5e5d5b'), { ao: false });
    // rodas: pneu (com a banda suja de barro), aro branco e a calota
    const tire = new THREE.LatheGeometry([[0.205, -0.112], [0.27, -0.12], [0.316, -0.117], [0.334, -0.098], [0.34, -0.06], [0.34, 0.06], [0.334, 0.098], [0.316, 0.117], [0.27, 0.12], [0.205, 0.112]].map(([r, y]) => new THREE.Vector2(r, y)), 22).rotateZ(Math.PI / 2);
    const tireCol = (p) => {
      const rr = Math.hypot(p.y, p.z);
      if (rr < 0.33) return _c.set('#2c2b2e');
      const k = Math.floor(((Math.atan2(p.z, p.y) + Math.PI) / TAU) * 22) % 2;
      return _c.set(k ? '#3a332c' : '#4a3f33');
    };
    for (const w of WHEELS) {
      const out = Math.sign(w.x - CX) || 1;
      put(tire, tireCol, { x: w.x, y: WY, z: w.z, ao: false });
      put(cyl(0.21, 0.21, 0.16, 18).translate(0, -0.08, 0).rotateZ(Math.PI / 2), (p, n) => (n.x * out > 0.5 ? _c.set('#efebe2') : DARK), { x: w.x, y: WY, z: w.z, ao: false });
      put(sphere(0.085, 12, 8), CHROME, { slot: 'glass', x: w.x + out * 0.07, y: WY, z: w.z, sx: 0.35, ao: false });
    }
    // na caçamba: a lona azul dobrada, a caixa de ferramentas, o estepe, o caixote de laranjas e uma poça com folhas
    put(rb(0.5, 0.06, 0.36, 0.03, 2).rotateY(0.08).translate(CX - 0.15, BED.y, BED.z0 + 0.3), C('#3f6fb5'));
    put(rb(0.46, 0.055, 0.33, 0.03, 2).rotateY(-0.06).translate(CX - 0.13, BED.y + 0.058, BED.z0 + 0.31), C('#4a7cc2'));
    put(rb(0.48, 0.2, 0.22, 0.02, 1).translate(BED.x1 - 0.32, BED.y, BED.z0 + 0.18), C('#e2a83a'));
    put(new THREE.TorusGeometry(0.06, 0.01, 4, 12, Math.PI).translate(BED.x1 - 0.32, BED.y + 0.2, BED.z0 + 0.18), DARK, { ao: false });
    for (const dx of [-0.17, 0.17]) put(rb(0.03, 0.04, 0.012, 0.004, 1).translate(BED.x1 - 0.32 + dx, BED.y + 0.14, BED.z0 + 0.29), CHROME, { slot: 'glass', ao: false });
    const spare = new THREE.LatheGeometry([[0.18, -0.1], [0.23, -0.11], [0.275, -0.1], [0.29, -0.05], [0.29, 0.05], [0.275, 0.1], [0.23, 0.11], [0.18, 0.1]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
    put(spare, C('#2f2d2f'), { x: CX + 0.2, y: BED.y + 0.111, z: BED.z1 - 0.42, ao: false });
    put(cyl(0.18, 0.18, 0.12, 16), C('#e9e5dc'), { x: CX + 0.2, y: BED.y + 0.051, z: BED.z1 - 0.42, ao: false });
    put(rb(0.38, 0.24, 0.32, 0.015, 1).translate(BED.x0 + 0.42, BED.y, BED.z1 - 0.26), C('#c99a5c'));
    for (const y of [0.07, 0.16]) put(slab(0.385, 0.03, 0.325).translate(BED.x0 + 0.42, BED.y + y, BED.z1 - 0.26), C('#a87a44'), { ao: false });
    for (let i = 0; i < 5; i++) put(sphere(0.045, 8, 6).translate(BED.x0 + 0.33 + (i % 3) * 0.09, BED.y + 0.255 + (i > 2 ? 0.03 : 0), BED.z1 - 0.33 + Math.floor(i / 3) * 0.1 + (i % 2) * 0.03), C('#f08a2c'), { ao: false });
    const bp = blobPts(0.16, 77, 20);
    put(shapeXY(bp).rotateX(-Math.PI / 2).translate(BED.x0 + 0.25, BED.y + 0.008, BED.z0 + 0.6), C('#9cc0d4'), { slot: 'glass', ao: false });
    for (const [x, z, a, ci] of [[BED.x0 + 0.62, BED.z0 + 0.86, 0.4, 0], [BED.x0 + 0.37, BED.z0 + 1.04, 2.1, 3], [BED.x1 - 0.37, BED.z0 + 0.59, 1.2, 4], [CX + 0.15, BED.z0 + 0.62, 2.9, 1]]) {
      put(leafGeo(0.08, 0.028).rotateY(a).translate(x, BED.y + 0.008, z), C(['#5d8a3a', '#7d9c3f', '#a7ad46', '#d0a945', '#a86f3d'][ci]), { ao: false });
    }
  }

  // ======================================================== 5. PRIMAVERA, FOLHAS E FLORES DA TEMPESTADE
  const FOL = { dark: '#2f5a24', mid: '#4f8a35', light: '#8cb84e' };
  const BRACT = [C('#d63a8e'), C('#e85aa8'), C('#b52f78')];
  {
    // o caule enrolado no pilar da frente (dentro do colisor dele) e correndo pela viga
    const px = CP.x0, pz = CP.z0, pts = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28, a = u * TAU * 2.2 + 0.8;
      pts.push([px + Math.cos(a) * 0.075, 0.1 + u * 2.24, pz + Math.sin(a) * 0.075]);
    }
    put(tubeAlong(pts, 0.016, 5, 70), C('#6a4a30'), { ao: false });
    put(tubeAlong([[px + 0.05, 2.34, pz - 0.07], [px + 0.4, 2.44, pz - 0.08], [px + 0.8, 2.4, pz - 0.075], [px + 1.3, 2.47, pz - 0.08], [px + 1.7, 2.44, pz - 0.07]], 0.013, 5, 30), C('#6a4a30'), { ao: false });
    const blobs = [];
    const flowers = [];
    const Rf = rng(91);
    const addBlob = (x, y, z, r, sy = 0.85) => {
      blobs.push({ x, y, z, r, sy });
      for (let k = 0; k < Math.round(r * 40); k++) {
        const a = Rf() * TAU, el = 0.15 + Rf() * 1.1;
        flowers.push([x + Math.cos(a) * Math.cos(el) * r * 1.02, y + Math.sin(el) * r * sy * 1.02, z + Math.sin(a) * Math.cos(el) * r * 1.02]);
      }
    };
    // no pilar (as de baixo começam acima de 0,65 m: a cabeça da Rhaenyra não entra nelas)
    addBlob(px - 0.05, 1.05, pz - 0.1, 0.16);
    addBlob(px + 0.06, 1.45, pz + 0.04, 0.17);
    addBlob(px - 0.08, 1.85, pz - 0.05, 0.19);
    addBlob(px + 0.05, 2.2, pz - 0.1, 0.2);
    // pendurada na frente da viga e espalhada em cima das telhas
    for (const [dx, dy, r] of [[0.25, 2.28, 0.15], [0.7, 2.22, 0.14], [1.15, 2.3, 0.13], [1.55, 2.26, 0.11]]) addBlob(px + dx, dy, BEAM_F.z - 0.06 - r * 1.05, r);
    for (const [dx, dz, r] of [[-0.05, 0.1, 0.26], [0.45, 0.02, 0.24], [0.9, 0.2, 0.22], [1.3, 0.05, 0.18], [0.2, 0.55, 0.2]]) {
      const z = pz + dz;
      addBlob(px + dx, sheetTop(z) + r * 0.62, z, r, 0.55);
    }
    put(foliageCluster(blobs, { detail: 1, amp: 0.2, freq: 3.1, seed: 4, ...FOL }), null, { slot: 'foliage', ao: false });
    const fg = new THREE.IcosahedronGeometry(0.028, 0);
    flowers.forEach((f, i) => put(fg, BRACT[i % 3], { slot: 'foliage', x: f[0], y: f[1], z: f[2], rx: i, ry: i * 1.7, ao: false }));
  }
  // folhas, brácteas e um galho em cima das telhas (opacos sobre o translúcido: dá para ver que há telhado)
  const LEAF_COLS = ['#5d8a3a', '#7d9c3f', '#a7ad46', '#d0a945', '#a86f3d', '#8a5a34'].map(C);
  const leafGs = [leafGeo(0.09, 0.03), leafGeo(0.07, 0.026), leafGeo(0.11, 0.036)];
  const bractG = bractGeo(0.035);
  {
    const Rl = rng(55);
    for (let i = 0; i < 26; i++) {
      const x = lerp(CP.x0 + 0.3, CP.x1, Rl()), z = lerp(RZ0 + 0.15, RZ1 - 0.2, Rl());
      const g = i % 4 === 3 ? bractG : leafGs[i % 3];
      put(g, i % 4 === 3 ? BRACT[i % 3] : LEAF_COLS[i % 6], { x, y: sheetTop(z) + 0.004, z, rx: -THETA, ry: Rl() * TAU, ao: false });
    }
    const gx = 1.05, gz = 5.6;
    const twig = [[gx - 0.35, 0, gz - 0.2], [gx - 0.1, 0, gz - 0.05], [gx + 0.15, 0, gz + 0.02], [gx + 0.42, 0, gz + 0.16]].map(([x, , z]) => [x, sheetTop(z) + 0.012, z]);
    put(tubeAlong(twig, 0.012, 5, 16), C('#6b4b33'), { ao: false });
    put(tubeAlong([[gx - 0.1, sheetTop(gz - 0.05) + 0.012, gz - 0.05], [gx - 0.02, sheetTop(gz - 0.2) + 0.01, gz - 0.2], [gx + 0.05, sheetTop(gz - 0.28) + 0.008, gz - 0.28]], 0.007, 4, 8), C('#6b4b33'), { ao: false });
    put(tubeAlong([[gx + 0.15, sheetTop(gz + 0.02) + 0.012, gz + 0.02], [gx + 0.22, sheetTop(gz + 0.17) + 0.01, gz + 0.17]], 0.006, 4, 6), C('#6b4b33'), { ao: false });
    for (const [x, z, a, ci] of [[gx + 0.05, gz - 0.3, 0.6, 0], [gx + 0.23, gz + 0.2, 2.0, 1], [gx - 0.3, gz - 0.24, 1.2, 0], [gx + 0.44, gz + 0.2, 2.6, 2], [gx - 0.02, gz - 0.21, 3.6, 1]]) {
      put(leafGs[2], LEAF_COLS[ci], { x, y: sheetTop(z) + 0.02, z, rx: -THETA, ry: a, ao: false });
    }
  }
  // no piso: folhas e brácteas fora das manchas, das marcas, da poça, das rodas e do caminho da corda
  const ROPE_OUT = { ax: ROPE.gap.x, az: ROPE.gap.z, bx: ROPE.end.x, bz: ROPE.end.z };
  {
    const dirx = ROPE_OUT.bx - ROPE_OUT.ax, dirz = ROPE_OUT.bz - ROPE_OUT.az, dl = Math.hypot(dirx, dirz);
    const exb = ROPE_OUT.bx + (dirx / dl) * (ROPE.pull + 0.15), ezb = ROPE_OUT.bz + (dirz / dl) * (ROPE.pull + 0.15);
    const nearRope = (x, z) => {
      const vx = exb - ROPE_OUT.ax, vz = ezb - ROPE_OUT.az;
      const t = clamp01(((x - ROPE_OUT.ax) * vx + (z - ROPE_OUT.az) * vz) / (vx * vx + vz * vz));
      return Math.hypot(x - (ROPE_OUT.ax + vx * t), z - (ROPE_OUT.az + vz * t)) < 0.16;
    };
    const blocked = (x, z) => {
      if (stains.some((s) => Math.hypot(x - s.x, z - s.z) < s.r * 1.35 + 0.06)) return true;
      if (Math.hypot(x - PUDDLE.x, z - PUDDLE.z) < PUDDLE.r * 1.5 + 0.06) return true;
      if (WHEELS.some((w) => Math.abs(x - w.x) < CAR.wheelW / 2 + 0.1 && Math.abs(z - w.z) < CAR.wheelR + 0.1)) return true;
      if (WHEELS.some((w) => w.z < 6 && Math.abs(x - w.x) < 0.14 && z < w.z)) return true;
      if ([[CP.x0, CP.z0], [CP.x1, CP.z0], [BACK_POST.x, BACK_POST.z]].some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.18)) return true;
      if (x > X0 - 0.06 && z > Z0 - 0.06) return true;
      return nearRope(x, z);
    };
    const Rl = rng(29);
    let n = 0;
    for (let tries = 0; n < 34 && tries < 900; tries++) {
      const front = n < 22;
      const x = front ? lerp(CP.x0 + 0.08, X1 - 0.1, Rl()) : lerp(CP.x0 + 0.08, X0 - 0.1, Rl());
      const z = front ? lerp(CP.z0 + 0.06, 5.1, Math.pow(Rl(), 1.3)) : lerp(5.1, wallN - 0.1, Rl());
      if (z > Z0 - 0.06 && x > X0 - 0.06) continue;
      if (blocked(x, z)) continue;
      const bract = x < -0.6 && z < 4.6 && n % 2 === 0;
      put(bract ? bractG : leafGs[n % 3], bract ? BRACT[n % 3] : LEAF_COLS[(n * 5) % 6], { slot: 'ground', x, y: D2, z, ry: Rl() * TAU, ao: false });
      n++;
    }
  }

  // ======================================================== 6. O QUE SE MEXE
  // ---------- a porta do depósito: folha de tábuas na dobradiça (como hingeTip), abre para dentro (o leste)
  const door = new THREE.Group();
  door.name = 'porta-do-deposito';
  door.position.set(H.x, 0, H.z);
  {
    const b = createBaker();
    const LEN = SD.length, Y0 = 0.05, HGT = SD.h;
    const TEAL = C('#5b9a95'), TEAL_D = C('#4c8682'), IRN = C('#2f2f33'), BRASS = C('#c99a45');
    const n = 5, gap = 0.004, pw = (LEN - 0.006 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const tone = 0.94 + rng(i + 7)() * 0.12;
      b.add(rb(0.032, HGT, pw, 0.006, 1), { color: (p) => _c.copy(TEAL).multiplyScalar(tone * (p.y < 0.24 ? 0.8 + p.y * 0.83 : 1)), y: Y0, z: -(0.003 + pw / 2 + i * (pw + gap)) });
    }
    // as travessas e a mão-francesa do lado de dentro (−x local)
    for (const y of [0.26, 1.56]) b.add(rb(0.024, 0.11, LEN - 0.08, 0.008, 1), { color: TEAL_D, x: -0.028, y: Y0 + y, z: -LEN / 2 });
    {
      const a = [Y0 + 0.37, -0.12], c = [Y0 + 1.56, -(LEN - 0.12)];
      const dy = c[0] - a[0], dz = c[1] - a[1], bl = Math.hypot(dy, dz);
      b.add(rb(0.024, bl, 0.1, 0.008, 1).translate(0, -bl / 2, 0).rotateX(Math.atan2(dz, dy)), { color: TEAL_D, x: -0.028, y: (a[0] + c[0]) / 2, z: (a[1] + c[1]) / 2 });
    }
    // as dobradiças de ferro (por fora), o trinco, o ferrolho com o cadeado aberto e a argola de dentro
    for (const y of [0.28, 1.6]) {
      b.add(rb(0.006, 0.05, 0.4, 0.003, 1), { color: IRN, x: 0.02, y: Y0 + y, z: -0.2 });
      b.add(cyl(0.013, 0.013, 0.1, 8), { color: IRN, x: 0.012, y: Y0 + y - 0.025, z: -0.004 });
    }
    b.add(rb(0.02, 0.15, 0.03, 0.008, 1), { color: IRN, x: 0.03, y: Y0 + 0.85, z: -LEN + 0.1 });
    b.add(rb(0.006, 0.11, 0.04, 0.003, 1), { color: IRN, x: 0.02, y: Y0 + 1.05, z: -LEN + 0.05 });
    b.add(rb(0.014, 0.05, 0.04, 0.008, 1), { color: BRASS, x: 0.034, y: Y0 + 0.97, z: -LEN + 0.05 });
    b.add(new THREE.TorusGeometry(0.014, 0.004, 4, 10, Math.PI).rotateY(Math.PI / 2).rotateX(0.5), { color: C('#9aa3a8'), x: 0.034, y: Y0 + 1.03, z: -LEN + 0.06 });
    b.add(new THREE.TorusGeometry(0.03, 0.005, 5, 12).rotateY(Math.PI / 2), { color: IRN, x: -0.024, y: Y0 + 0.95, z: -LEN + 0.1 });
    // tinta descascada mostrando a madeira (por fora)
    for (const [z, y, r, s] of [[-0.24, 0.42, 0.04, 81], [-0.62, 1.22, 0.05, 83], [-0.15, 1.75, 0.03, 85], [-0.78, 0.2, 0.035, 87]]) {
      b.add(wallBlob(r, s, 1, 12, 0.3), { color: C('#a5805a'), x: 0.016 + 0.003, y: Y0 + y, z });
    }
    const leaf = new THREE.Mesh(b.build(), SLOTS.solid());
    leaf.name = 'porta-do-deposito:folha';
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    door.add(leaf);
  }
  root.add(door);
  seeThrough.push(door);
  const storageDoor = {
    object: door,
    t: 0,
    /** 0 fechada … 1 aberta (para dentro); o mesmo yaw de hingeTip. */
    setOpen(t) {
      this.t = clamp01(t);
      door.rotation.y = SD.closedYaw + (SD.openYaw - SD.closedYaw) * this.t;
    },
  };
  storageDoor.setOpen(0);

  // ---------- a bola de futebol entalada atrás da porta (gomos pretos e brancos de verdade, com a costura funda)
  const ballHolder = new THREE.Group();
  ballHolder.name = 'bola-de-futebol';
  const ballMesh = new THREE.Mesh(soccerBall(BALL.r), mat('recanto-bola', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 })));
  ballMesh.name = 'bola-de-futebol:gomos';
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  ballHolder.add(ballMesh);
  root.add(ballHolder);
  const ballSt = { x: BALL.x, z: BALL.z };
  const _ax = new THREE.Vector3(), _bq = new THREE.Quaternion();
  const ball = {
    object: ballHolder,
    /**
     * Põe a bola em (x, z), com o centro `y` acima de onde as dogs andam (o piso da garagem é somado). Rola sozinha pelo
     * deslocamento (sem escorregar); `spin` ≠ 0: o giro total (rad) em volta do eixo de rolar, no lugar do automático.
     */
    setPos(x, z, y = BALL.r, spin = 0) {
      const dx = x - ballSt.x, dz = z - ballSt.z, d = Math.hypot(dx, dz);
      if (d > 1e-5 && d < 0.8) {
        _ax.set(dz, 0, -dx).normalize();
        if (spin) ballMesh.quaternion.setFromAxisAngle(_ax, spin);
        else ballMesh.quaternion.premultiply(_bq.setFromAxisAngle(_ax, d / BALL.r));
      }
      ballSt.x = x;
      ballSt.z = z;
      ballHolder.position.set(x, y + (onFloor(x, z) ? FLOOR : 0), z);
    },
  };
  ballMesh.quaternion.setFromEuler(new THREE.Euler(0.4, 0.9, 0.2));
  ball.setPos(BALL.x, BALL.z);

  // ---------- o balde de zinco na prateleira
  const HB = 0.27, HALF = HB / 2;
  const XB = Math.max(SHELF.x, X0i + 0.155); // a boca (0,137 m de raio) não encosta na parede
  const T_SLIDE = 0.2, T_TIP = 0.5, T_HIT = 0.72, T_LAND = 0.85;
  const R_MID = 0.1145; // raio no meio da altura
  const bucket3 = new THREE.Group();
  bucket3.name = 'balde';
  const bailPivot = new THREE.Group();
  const BAIL_R = 0.135, EAR_Y = 0.235 - HALF;
  /** @type {THREE.Mesh} */
  let bucketBody;
  /** @type {THREE.Mesh} */
  let bailMesh;
  {
    const ZINC = C('#b4bcbe'), ZINC_IN = C('#8e979a'), RUST = C('#8b6a4f');
    const prof = [[0.0005, 0], [0.094, 0], [0.1, 0.004], [0.101, 0.012], [0.128, 0.252], [0.134, 0.258], [0.137, 0.264], [0.133, 0.27], [0.126, 0.268], [0.123, 0.258], [0.096, 0.016], [0.09, 0.012], [0.0005, 0.012]];
    const pail = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y - HALF)), 28);
    const pailCol = (p, n) => {
      const rr = Math.hypot(p.x, p.z) || 1;
      const y = p.y + HALF;
      const k = 1 + (vnoise2(Math.atan2(p.z, p.x) * 6, y * 30) - 0.5) * 0.12;
      if ((n.x * p.x + n.z * p.z) / rr < -0.2 && y > 0.008) return _c.copy(ZINC_IN).multiplyScalar(k);
      _c.copy(ZINC).multiplyScalar(k);
      if (y < 0.05) _c.lerp(RUST, (1 - y / 0.05) * 0.45);
      return _c;
    };
    const b = createBaker();
    b.add(pail, { color: pailCol });
    for (const y of [0.07, 0.17]) b.add(new THREE.TorusGeometry(0.101 + (0.027 * (y - 0.012)) / 0.24 + 0.002, 0.0045, 4, 28).rotateX(Math.PI / 2), { color: ZINC, y: y - HALF });
    for (const s of [-1, 1]) b.add(cyl(0.013, 0.013, 0.012, 10).translate(0, -0.006, 0).rotateZ(Math.PI / 2), { color: C('#8d969a'), x: s * 0.13, y: EAR_Y });
    bucketBody = new THREE.Mesh(b.build(), mat('recanto-zinco', () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.42 })));
    bucketBody.name = 'balde:corpo';
    bucketBody.castShadow = true;
    bucketBody.receiveShadow = true;
    bucket3.add(bucketBody);
    const bb = createBaker();
    bb.add(new THREE.TorusGeometry(BAIL_R, 0.004, 4, 18, Math.PI), { color: C('#5f666a') });
    bb.add(cyl(0.013, 0.013, 0.09, 8).translate(0, -0.045, 0).rotateZ(Math.PI / 2), { color: C('#2f2f33'), y: BAIL_R });
    bailMesh = new THREE.Mesh(bb.build(), mat('recanto-zinco', () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.42 })));
    bailMesh.name = 'balde:alca';
    bailMesh.castShadow = true;
    bailPivot.add(bailMesh);
    bailPivot.position.y = EAR_Y;
    bucket3.add(bailPivot);
  }
  root.add(bucket3);
  /** A pose do balde em t: centro e orientação (a origem dele é o meio do eixo). */
  const _bp = new THREE.Vector3(), _bqt = new THREE.Quaternion(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0);
  const EDGE = { y: SH.y + 0.001, z: SH.z1 };
  const ALPHA_B = 1.0, ALPHA_I = 1.7;
  const CB = { x: XB, y: EDGE.y + HALF * Math.cos(ALPHA_B) + 0.1 * Math.sin(ALPHA_B), z: EDGE.z + HALF * Math.sin(ALPHA_B) - 0.1 * Math.cos(ALPHA_B) };
  const BALL_C = { x: BALL.x, y: FLOOR + BALL.r, z: BALL.z };
  const bodyPos = bucketBody.geometry.attributes.position;
  const _bv = new THREE.Vector3();
  /** A altura do centro em que o balde (orientação q, em x e z) encosta por cima da bola sem entrar nela. */
  const contactY = (q, x, zc) => {
    let y = -Infinity;
    const R2 = (BALL.r + 0.003) ** 2;
    for (let i = 0; i < bodyPos.count; i++) {
      _bv.fromBufferAttribute(bodyPos, i).applyQuaternion(q);
      const dx = x + _bv.x - BALL_C.x, dz = zc + _bv.z - BALL_C.z, rad = R2 - dx * dx - dz * dz;
      if (rad > 0) y = Math.max(y, BALL_C.y - _bv.y + Math.sqrt(rad));
    }
    return y;
  };
  const CI = { x: XB - 0.005, z: BALL_C.z, y: 0 };
  CI.y = contactY(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.7), CI.x, CI.z);
  if (!Number.isFinite(CI.y)) CI.y = BALL_C.y + BALL.r + R_MID;
  const LAND = SHELF.landing ?? { x: XB + 0.22, z: SH.z0 + 0.24 };
  let Y_LIE = FLOOR + 0.12;
  const C1 = { x: LAND.x - 0.08, z: LAND.z + 0.44 };
  const ROLL_D = Math.hypot(LAND.x - C1.x, LAND.z - C1.z);
  const DELTA = Math.atan((0.137 - 0.101) / 0.252); // deitado, o eixo sobe para a boca
  const lieAxis = new THREE.Vector3();
  {
    const mx = LAND.x - C1.x, mz = LAND.z - C1.z, ml = Math.hypot(mx, mz) || 1;
    let ax = -mz / ml, az = mx / ml; // perpendicular ao rolar
    if (ax < 0) { ax = -ax; az = -az; } // a boca para o leste: a câmera vê dentro
    lieAxis.set(ax * Math.cos(DELTA), Math.sin(DELTA), az * Math.cos(DELTA)).normalize();
  }
  const qLie = (phi, out) => out.setFromUnitVectors(_up, lieAxis).multiply(_q2.setFromAxisAngle(_up, phi));
  {
    // deitado, o ponto mais baixo (aba, frisos, orelhas) em qualquer giro fica rente ao piso
    let low = Infinity;
    for (let k = 0; k < 24; k++) {
      qLie((k / 24) * TAU, _q1);
      for (let i = 0; i < bodyPos.count; i++) low = Math.min(low, _bv.fromBufferAttribute(bodyPos, i).applyQuaternion(_q1).y);
    }
    Y_LIE = FLOOR + 0.0008 - low;
  }
  function bucketPose(t, pos, quat) {
    if (t <= T_SLIDE) {
      // escorrega até a quina, balançando no canto sul do fundo (a corda puxa a alça)
      const u = ease(t / T_SLIDE), a = 0.05 * Math.sin(u * Math.PI);
      const zs = SHELF.z + (EDGE.z - 0.1 - SHELF.z) * u;
      pos.set(XB, EDGE.y + HALF * Math.cos(a) + 0.1 * Math.sin(a), zs + 0.1 + HALF * Math.sin(a) - 0.1 * Math.cos(a));
      quat.setFromAxisAngle(AX, a);
    } else if (t <= T_TIP) {
      // vira na quina da prateleira: gira em volta dela (o fundo apoiado na beirada)
      const u = (t - T_SLIDE) / (T_TIP - T_SLIDE), a = ALPHA_B * u * u;
      pos.set(XB, EDGE.y + HALF * Math.cos(a) + 0.1 * Math.sin(a), EDGE.z + HALF * Math.sin(a) - 0.1 * Math.cos(a));
      quat.setFromAxisAngle(AX, a);
    } else if (t <= T_HIT) {
      // cai puxado pela corda para o lado da porta, girando, e bate em cima da bola
      const u = (t - T_TIP) / (T_HIT - T_TIP);
      pos.set(lerp(CB.x, CI.x, u), lerp(CB.y, CI.y, u * u), lerp(CB.z, CI.z, Math.pow(u, 1.25)));
      quat.setFromAxisAngle(AX, lerp(ALPHA_B, ALPHA_I, u));
    } else if (t <= T_LAND) {
      // quica para trás (a bola é elástica), vira de lado no ar e cai deitado
      const u = (t - T_HIT) / (T_LAND - T_HIT);
      pos.set(lerp(CI.x, C1.x, u), lerp(CI.y, Y_LIE, u) + 0.17 * 4 * u * (1 - u), lerp(CI.z, C1.z, u));
      quat.slerpQuaternions(_q1.setFromAxisAngle(AX, ALPHA_I), qLie(0, new THREE.Quaternion()), ease(u));
    } else {
      // rola deitado até o canto do norte, perdendo força, e para
      const u = clamp01((t - T_LAND) / (1 - T_LAND)), k = 1 - (1 - u) * (1 - u), wob = Math.sin(u * 9) * (1 - u) * 0.025;
      pos.set(lerp(C1.x, LAND.x, k), Y_LIE + Math.abs(wob) * 0.3, lerp(C1.z, LAND.z, k));
      qLie(-(ROLL_D * k) / R_MID + wob, quat);
    }
  }
  const _bt = new THREE.Vector3(), _bl = new THREE.Vector3();
  /** A alça (o arame e a pegada, vértice a vértice) no giro b fica acima do piso e fora da bola? */
  const bailPos = bailMesh.geometry.attributes.position;
  const bailClear = (b) => {
    const M = bucket3.matrixWorld, bc = ballHolder.position, rr = (BALL.r + 0.004) ** 2, cb = Math.cos(b), sb = Math.sin(b);
    for (let i = 0; i < bailPos.count; i++) {
      const y = bailPos.getY(i), z = bailPos.getZ(i);
      _bt.set(bailPos.getX(i), EAR_Y + y * cb - z * sb, y * sb + z * cb).applyMatrix4(M);
      if (_bt.y < FLOOR + 0.002 || _bt.distanceToSquared(bc) < rr) return false;
    }
    return true;
  };
  /**
   * Gira a alça para o lado de onde a corda puxa (target, no mundo), no giro mais perto disso que não entra no piso nem
   * na bola, e devolve a ponta dela (onde a corda amarra).
   */
  function aimBail(target, out) {
    bucket3.updateMatrixWorld(true);
    _bl.copy(target);
    bucket3.worldToLocal(_bl);
    const want = Math.max(-1.8, Math.min(1.8, Math.atan2(_bl.z, _bl.y - EAR_Y)));
    let beta = want;
    if (!bailClear(want)) {
      let best = null;
      for (let k = 0; k <= 90; k++) {
        const b = -1.8 + (k / 90) * 3.6;
        if ((best === null || Math.abs(b - want) < Math.abs(best - want)) && bailClear(b)) best = b;
      }
      if (best !== null) beta = best;
    }
    bailPivot.rotation.x = beta;
    bailPivot.updateMatrixWorld(true);
    return out.set(0, EAR_Y + BAIL_R * Math.cos(beta), BAIL_R * Math.sin(beta)).applyMatrix4(bucket3.matrixWorld);
  }

  // ---------- a corda: da alça do balde, parede abaixo, por baixo da porta e pelo chão até debaixo da caminhonete
  const NI = 18, NO = 34, NP = NI + NO - 1;
  const ropeGroup = new THREE.Group();
  ropeGroup.name = 'corda-do-balde';
  root.add(ropeGroup);
  const ROPE_COL = C('#d8c18f');
  const tube = createRopeTube(NP, 6, ROPE_COL);
  const ropeMat = mat('recanto-corda', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
  const ropeMesh = new THREE.Mesh(tube.geometry, ropeMat);
  ropeMesh.castShadow = true;
  ropeMesh.frustumCulled = false;
  ropeGroup.add(ropeMesh);
  // o nó da ponta (o que a Radhija morde) e as fibras desfiadas
  const KNOT_R = 0.024;
  const knot = new THREE.Group();
  {
    const b = createBaker();
    b.add(sphere(KNOT_R, 12, 8), { color: ROPE_COL, sx: 1.25 });
    b.add(new THREE.TorusGeometry(KNOT_R * 0.8, 0.007, 5, 12), { color: _c.copy(ROPE_COL).multiplyScalar(0.85).clone(), ry: Math.PI / 2, rx: 0.5 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      b.add(new THREE.ConeGeometry(0.005, 0.05, 4).rotateZ(-Math.PI / 2), { color: _c.copy(ROPE_COL).multiplyScalar(0.9 + (i % 3) * 0.06).clone(), x: KNOT_R + 0.022, y: Math.cos(a) * 0.005 - 0.008, z: Math.sin(a) * 0.007, ry: Math.sin(a * 3) * 0.35, rz: -0.32 + Math.cos(a * 2) * 0.12 });
    }
    const km = new THREE.Mesh(b.build(), ropeMat);
    km.name = 'corda-do-balde:no';
    km.castShadow = true;
    knot.add(km);
  }
  ropeGroup.add(knot);
  const P = Array.from({ length: NP }, () => new THREE.Vector3());
  const PI_ = Array.from({ length: NI }, () => new THREE.Vector3());
  const PI2 = Array.from({ length: NI }, () => new THREE.Vector3());
  const GAP = new THREE.Vector3(ROPE.gap.x, Math.max(ROPE.gap.y, FLOOR + ROPE_R), ROPE.gap.z);
  const PIN = new THREE.Vector3(X0i + 0.03, FLOOR + ROPE_R, GAP.z - 0.03); // logo depois da fresta, por dentro
  const PEDGE = new THREE.Vector3(XB, EDGE.y + ROPE_R + 0.002, EDGE.z + ROPE_R + 0.002); // a quina da prateleira
  const PFL = new THREE.Vector3(XB - 0.02, FLOOR + ROPE_R, EDGE.z + 0.09); // onde a corda pendurada encosta no chão
  const END0 = new THREE.Vector3(ROPE.end.x, FLOOR + KNOT_R, ROPE.end.z);
  const OUT_DIR = new THREE.Vector3(END0.x - GAP.x, 0, END0.z - GAP.z).normalize();
  const OUT_N = new THREE.Vector3(-OUT_DIR.z, 0, OUT_DIR.x);
  const rope = {
    object: ropeGroup,
    k: 0,
    /** Quanto ela já puxou (0..1): a ponta vem até ROPE.pull m para longe da fresta; a corda estica. */
    setPull(k) { this.k = clamp01(k); dirty = true; },
    /** Mordendo: src() → { pos (a boca, no mundo), k (0..1) } ou null; enquanto morde, a ponta segue a boca. */
    setGrip(src) { gripSrc = src || null; dirty = true; },
    /** Onde está o nó parado (sem ninguém mordendo): a ponta em repouso, com o puxão de agora. */
    bitePoint() { const e = restEnd(); return { x: e.x, y: e.y, z: e.z }; },
  };
  /** @type {null | (() => ({ pos: THREE.Vector3, k: number } | null))} */
  let gripSrc = null;
  let dirty = true;
  const _end = new THREE.Vector3(), _re = new THREE.Vector3(), _bail = new THREE.Vector3(), _tmp = new THREE.Vector3();
  const restEnd = () => _re.copy(END0).addScaledVector(OUT_DIR, rope.k * ROPE.pull);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  /** O trecho de dentro (NI pontos, da alça até a fresta), conforme o balde. */
  function insidePath() {
    const t = bucketState.t, k = rope.k;
    if (t <= 0) {
      // parado na prateleira: a corda passa na quina, desce pendurada e faz um S no chão até a fresta; o puxão estica
      aimBail(PEDGE, _bail);
      const slack = [_bail.clone(), PEDGE.clone()];
      for (let i = 1; i <= 4; i++) {
        const u = i / 5;
        slack.push(V(lerp(PEDGE.x, PFL.x, u) + Math.sin(u * Math.PI) * 0.012, lerp(PEDGE.y, PFL.y + 0.04, u), lerp(PEDGE.z, PFL.z, u * u) + Math.sin(u * Math.PI) * 0.02));
      }
      slack.push(PFL.clone());
      for (let i = 1; i <= 6; i++) {
        const u = i / 7;
        slack.push(V(lerp(PFL.x, PIN.x, u) + Math.sin(u * TAU) * 0.07, FLOOR + ROPE_R, lerp(PFL.z, PIN.z, u)));
      }
      slack.push(PIN.clone(), GAP.clone());
      resample(slack, NI, PI_);
      resample([_bail.clone(), PEDGE.clone(), PIN.clone(), GAP.clone()], NI, PI2);
      const tau = smoothstep(0.1, 0.85, k);
      for (let i = 0; i < NI; i++) PI_[i].lerp(PI2[i], tau);
    } else if (t <= T_HIT) {
      aimBail(PIN, _bail);
      const ctrl = [_bail.clone()];
      if (_bail.z < PEDGE.z + 0.01 && _bail.y > PEDGE.y - 0.01) ctrl.push(PEDGE.clone());
      ctrl.push(PIN.clone(), GAP.clone());
      resample(ctrl, NI, PI_);
    } else {
      // no chão, folgada: da alça (no ar, quicando, ou deitada no canto) até a fresta
      aimBail(GAP, _bail);
      const fl = V(lerp(_bail.x, PIN.x, 0.12), FLOOR + ROPE_R, lerp(_bail.z, PIN.z, 0.12));
      const ctrl = [_bail.clone(), fl];
      for (let i = 1; i <= 5; i++) {
        const u = i / 6;
        ctrl.push(V(lerp(fl.x, PIN.x, u) + Math.sin(u * Math.PI) * 0.06, FLOOR + ROPE_R, lerp(fl.z, PIN.z, u)));
      }
      ctrl.push(PIN.clone(), GAP.clone());
      resample(ctrl, NI, PI_);
    }
    for (const p of PI_) if (p.y < FLOOR + ROPE_R) p.y = FLOOR + ROPE_R;
  }
  /** O trecho de fora (NO pontos, da fresta até o nó): rente ao chão, em S quando folgado; na boca, sobe até ela. */
  function outsidePath(out, off) {
    const g = gripSrc ? gripSrc() : null;
    const gk = g && g.k > 0 ? g.k : 0;
    restEnd();
    _end.copy(_re);
    if (gk > 0) _end.lerp(g.pos, gk);
    const amp = 0.085 * (1 - rope.k) * (1 - 0.85 * gk);
    const lift = Math.max(0, _end.y - (FLOOR + ROPE_R));
    const rise = clamp01(lift / 0.5) * 0.45;
    for (let i = 0; i < NO; i++) {
      const u = i / (NO - 1);
      const w = Math.sin(u * Math.PI * 3 + 0.6) * Math.sin(u * Math.PI) * amp;
      const p = out[off + i];
      p.set(lerp(GAP.x, _end.x, u) + OUT_N.x * w, FLOOR + ROPE_R, lerp(GAP.z, _end.z, u) + OUT_N.z * w);
      if (rise > 0 && u > 1 - rise) p.y += lift * ease((u - (1 - rise)) / rise);
    }
    out[off + NO - 1].copy(_end);
    // o fim da corda entra no nó (a ponta desce um pouquinho até o chão quando está solta)
    if (gk === 0) out[off + NO - 1].y = END0.y;
  }
  const _rb = new THREE.Vector3();
  function layoutRope() {
    insidePath();
    for (let i = 0; i < NI; i++) P[i].copy(PI_[i]);
    outsidePath(P, NI - 1);
    // a corda passa por fora da bola (encosta nela, não atravessa)
    const bc = ballHolder.position, rr = BALL.r + ROPE_R + 0.006;
    for (let i = 1; i < NP - 1; i++) {
      _rb.subVectors(P[i], bc);
      const d = _rb.length();
      if (d < rr && d > 1e-6) {
        P[i].copy(bc).addScaledVector(_rb, rr / d);
        if (P[i].y < FLOOR + ROPE_R) P[i].y = FLOOR + ROPE_R;
      }
    }
    tube.update(P, ROPE_R);
    // o nó: na ponta, deitado na direção da corda
    const a = P[NP - 2], e = P[NP - 1];
    knot.position.copy(e);
    _tmp.subVectors(e, a);
    knot.rotation.set(0, Math.atan2(-_tmp.z, _tmp.x), Math.atan2(_tmp.y, Math.hypot(_tmp.x, _tmp.z)));
    dirty = false;
  }
  const bucketState = { t: 0 };
  const bucket = {
    object: bucket3,
    t: 0,
    /** O t em que o balde bate na bola (a bola começa a rolar daqui para ROLL_TO). */
    hitT: T_HIT,
    /**
     * 0: na prateleira; 0..0,5: escorrega até a quina e vira; 0,5..hitT: cai em cima da bola; hitT..1: quica, deita e
     * rola até SHELF.landing (fora do arco da porta).
     */
    setTip(t) {
      this.t = bucketState.t = clamp01(t);
      bucketPose(this.t, _bp, _bqt);
      bucket3.position.copy(_bp);
      bucket3.quaternion.copy(_bqt);
      dirty = true;
    },
  };
  bucket.setTip(0);
  layoutRope();

  // ---------- a gota pingando do bico da calha
  const drop = new THREE.Mesh(sphere(0.011, 8, 6), mat('recanto-gota', () => new THREE.MeshStandardMaterial({ color: '#cfe8f5', roughness: 0.05, transparent: true, opacity: 0.85 })));
  drop.name = 'gota-de-chuva-da-calha';
  drop.userData.passThrough = true; // água caindo: as dogs passam por ela
  drop.scale.set(1, 1.5, 1);
  drop.position.set(SPOUT.x, SPOUT.y - 0.012, SPOUT.z);
  drop.castShadow = false;
  root.add(drop);
  anim.push((dt, t) => {
    const cyc = (t % 2.3) / 2.3, form = 0.7;
    if (cyc < form) {
      const s = 0.3 + 0.7 * (cyc / form);
      drop.visible = true;
      drop.scale.set(s, s * 1.4, s);
      drop.position.set(SPOUT.x, SPOUT.y - 0.012 * s, SPOUT.z);
    } else {
      const tf = (cyc - form) * 2.3;
      const y = SPOUT.y - 0.012 - 4.9 * tf * tf;
      drop.visible = y > 0.02;
      drop.scale.set(0.9, 1.7, 0.9);
      drop.position.set(SPOUT.x, y, SPOUT.z);
    }
  });

  return {
    props: { storageDoor, bucket, ball, rope },
    seeThrough,
    signs: [],
    update(dt, t) {
      if (dirty || gripSrc) layoutRope();
      for (const f of anim) f(dt, t);
    },
    reset() {
      storageDoor.setOpen(0);
      bucket.setTip(0);
      ballMesh.quaternion.setFromEuler(new THREE.Euler(0.4, 0.9, 0.2));
      ballSt.x = BALL.x;
      ballSt.z = BALL.z;
      ball.setPos(BALL.x, BALL.z);
      gripSrc = null;
      rope.setPull(0);
      layoutRope();
    },
    dispose() {
      gripSrc = null;
      anim.length = 0;
    },
  };
}

/**
 * Bola de futebol: o icosaedro truncado (12 gomos pretos, 20 brancos) com cada gomo subdividido e levado à esfera; a
 * costura fica funda (os vértices da borda dos gomos um pouco para dentro) e a cor muda exatamente na costura.
 */
function soccerBall(r, sub = 3) {
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pa = ico.attributes.position;
  const verts = [];
  const key = (v) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  const map = new Map();
  const faces = [];
  for (let i = 0; i < pa.count; i += 3) {
    const f = [];
    for (let k = 0; k < 3; k++) {
      const v = new THREE.Vector3().fromBufferAttribute(pa, i + k);
      const kk = key(v);
      if (!map.has(kk)) { map.set(kk, verts.length); verts.push(v); }
      f.push(map.get(kk));
    }
    faces.push(f);
  }
  const tp = (a, b, k) => new THREE.Vector3().lerpVectors(verts[a], verts[b], k);
  const polys = [];
  // os hexágonos (um por face do icosaedro)
  for (const [a, b, c] of faces) polys.push({ pts: [tp(a, b, 1 / 3), tp(a, b, 2 / 3), tp(b, c, 1 / 3), tp(b, c, 2 / 3), tp(c, a, 1 / 3), tp(c, a, 2 / 3)], black: false });
  // os pentágonos (um por vértice: os pontos a 1/3 das cinco arestas, em volta)
  for (let v = 0; v < verts.length; v++) {
    const nb = [];
    for (const f of faces) if (f.includes(v)) for (const u of f) if (u !== v && !nb.includes(u)) nb.push(u);
    const n = verts[v].clone().normalize();
    const t1 = new THREE.Vector3().subVectors(verts[nb[0]], verts[v]).projectOnPlane(n).normalize();
    const t2 = new THREE.Vector3().crossVectors(n, t1);
    nb.sort((p, q) => {
      const dp = new THREE.Vector3().subVectors(verts[p], verts[v]), dq = new THREE.Vector3().subVectors(verts[q], verts[v]);
      return Math.atan2(dp.dot(t2), dp.dot(t1)) - Math.atan2(dq.dot(t2), dq.dot(t1));
    });
    polys.push({ pts: nb.map((u) => tp(v, u, 1 / 3)), black: true });
  }
  const pos = [], nor = [], col = [];
  const white = new THREE.Color('#f6f4ee'), black = new THREE.Color('#1f2327'), tmpc = new THREE.Color();
  const R = rng(5);
  const place = (v, edge) => {
    const n = v.clone().normalize();
    const rr = r * (edge ? 0.982 : 1);
    pos.push(n.x * rr, n.y * rr, n.z * rr);
    nor.push(n.x, n.y, n.z);
  };
  for (const poly of polys) {
    const c = poly.pts.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / poly.pts.length);
    // garante a volta para fora (anti-horária vista de fora)
    const nrm = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(poly.pts[1], poly.pts[0]), new THREE.Vector3().subVectors(poly.pts[2], poly.pts[0]));
    const pts = nrm.dot(c) < 0 ? [...poly.pts].reverse() : poly.pts;
    tmpc.copy(poly.black ? black : white).multiplyScalar(poly.black ? 1 : 0.93 + R() * 0.07);
    const m = pts.length;
    for (let i = 0; i < m; i++) {
      const A = pts[i], B = pts[(i + 1) % m];
      // o setor (centro, A, B) em linhas: a linha `row` tem pontos de (c → A) a (c → B)
      const P = (row, j) => {
        const u = row / sub;
        const pa2 = new THREE.Vector3().lerpVectors(c, A, u), pb2 = new THREE.Vector3().lerpVectors(c, B, u);
        return row === 0 ? c.clone() : new THREE.Vector3().lerpVectors(pa2, pb2, j / row);
      };
      for (let row = 0; row < sub; row++) {
        for (let j = 0; j <= row; j++) {
          const tri = [[row, j], [row + 1, j], [row + 1, j + 1]];
          for (const [rr2, jj] of tri) { place(P(rr2, jj), rr2 === sub); col.push(tmpc.r, tmpc.g, tmpc.b); }
          if (j < row) {
            const tri2 = [[row, j], [row + 1, j + 1], [row, j + 1]];
            for (const [rr2, jj] of tri2) { place(P(rr2, jj), rr2 === sub); col.push(tmpc.r, tmpc.g, tmpc.b); }
          }
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
