// RECANTO DAS PATINHAS — a GARAGEM e o DEPÓSITO, no sul do condomínio, para a 3ª pessoa (a câmera fica atrás da dog, a
// ~1 m do chão, e entra na garagem e no depósito), no acabamento das fases 4 e 5:
//   o piso de cimento em placas (juntas, a canaleta da entrada, as faixas amarelas gastas da vaga, a mancha de óleo
//     embaixo do motor, as marcas dos pneus, a frente e o lado oeste molhados pela chuva, poças, folhas e flores de
//     primavera trazidas pela tempestade);
//   a cobertura vista por baixo: pilares de madeira com base de concreto e mãos-francesas, três vigas, caibros, ripas e
//     as telhas onduladas cor de barro (duas faixas translúcidas deixam o sol da manhã entrar), a calha da frente
//     pingando, tábuas guardadas em cima das vigas, o pendente apagado e a primavera subindo pelo pilar;
//   a CAMINHONETE vermelha de capota creme, estacionada de ré (a frente para a entrada): faróis, grade, para-choques,
//     retrovisores, frisos das portas, rodas com calota, lama da tempestade, as patinhas no vidro de trás; na caçamba, a
//     lona, a caixa de ferramentas e o caixote de laranjas; POR BAIXO (só a Radhija passa: nada desce de CAR.clearance
//     além das rodas), o cárter, o câmbio, o cardã, o eixo com o diferencial e os feixes de mola, as longarinas, o
//     tanque, o escapamento com o silencioso e o estepe;
//   na garagem: a bicicleta encostada na parede do depósito (com as prateleiras altas em cima), o carrinho de mão, a
//     bancada com a morsa e o rádio, a pilha de pneus, o carretel e a mangueira pelo chão, o painel de ferramentas;
//   o DEPÓSITO inteiro (paredes de reboco até a laje, a parede do sul própria, a janelinha alta do leste com o raio de
//     sol): a porta de tábuas que abre para dentro, a prateleira do balde (ao norte da porta), as prateleiras de latas e
//     potes, as ferramentas de jardim penduradas, a escada na parede, as latas de tinta com respingos, a caixa de
//     brinquedos das irmãs (a meia fica em cima dela), o saco de ração, a vassoura e o rastelo.
//   O que se mexe: a porta (storageDoor.setOpen), o balde (bucket.setTip: escorrega, vira na quina, cai em cima da bola
//   em hitT, quica e rola até SHELF.landing), a bola de futebol (ball.setPos; rola sozinha pelo deslocamento) e a corda
//   (rope.setPull, setGrip, bitePoint): da alça do balde, parede abaixo, por baixo da porta e pelo chão até debaixo da
//   caminhonete, onde fica a ponta com o nó.
// Coordenadas: tudo sai de ../layout.js (CARPORT, CAR, WHEELS, STORAGE, STORAGE_DOOR, BALL, SHELF, ROPE,
// STORAGE_STUFF e GARAGE_STUFF: os pilares a mais, a bicicleta, o carrinho, a bancada e os pneus).
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

/** A água das poças, 3 mm acima da borda molhada. */
const D3 = FLOOR + 0.009;

/** Faces planas por quatro pontos [x, y, z] (anti-horário visto de fora), com a normal de cada face. */
function quadsGeo(quads) {
  const pos = [];
  for (const [a, b, c, d] of quads) pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
/**
 * Cuba de paredes inclinadas (a caçamba do carrinho de mão): a boca wt × dt em y = h, o fundo wb × db em y = 0, chapa
 * de espessura t (por fora, por dentro e a aba).
 */
function tubGeo(wt, dt, wb, db, h, t = 0.012) {
  const ring = (w, d, y) => [[-w / 2, y, -d / 2], [w / 2, y, -d / 2], [w / 2, y, d / 2], [-w / 2, y, d / 2]];
  const bo = ring(wb, db, 0), to = ring(wt, dt, h), ti = ring(wt - 2 * t, dt - 2 * t, h), bi = ring(wb - 2 * t, db - 2 * t, t);
  const q = [[bo[0], bo[1], bo[2], bo[3]], [bi[3], bi[2], bi[1], bi[0]]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    q.push([bo[j], bo[i], to[i], to[j]], [bi[i], bi[j], ti[j], ti[i]], [to[j], to[i], ti[i], ti[j]]);
  }
  return quadsGeo(q);
}
/** Pneu (torneado em volta de y): raio R, meia largura hw. */
function tireGeo(R, hw, seg = 22) {
  const prof = [[0.603, -0.933], [0.794, -1], [0.929, -0.975], [0.982, -0.817], [1, -0.5], [1, 0.5], [0.982, 0.817], [0.929, 0.975], [0.794, 1], [0.603, 0.933]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * R, y * hw)), seg);
}
/** Cilindro sem as tampas (rótulos, faixas), com a base em y = 0. */
const band = (r, h, seg = 14) => new THREE.CylinderGeometry(r, r, h, seg, 1, true).translate(0, h / 2, 0);
/**
 * Telhado ondulado: uma folha deitada (ondas ao longo de z, de período `pitch` e altura ±amp), cortada nas linhas xs e
 * zs. Sai a face de cima, a de baixo (thick abaixo) e, à parte, os quadros que skip(xm, zm) tira (as telhas
 * translúcidas). Tudo em coordenadas da folha (y = 0 no meio das ondas).
 * @param {number[]} xs @param {number[]} zs
 * @param {(x: number, z: number) => boolean} skip
 */
function corrugated(xs, zs, pitch, amp, thick, skip) {
  const nx = xs.length, nz = zs.length;
  const k = TAU / pitch;
  const mk = (dy, flip) => {
    const pos = [], nor = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const s = amp * k * Math.sin(k * xs[i]), l = Math.hypot(s, 1) * (flip ? -1 : 1);
      pos.push(xs[i], amp * Math.cos(k * xs[i]) + dy, zs[j]);
      nor.push(s / l, 1 / l, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  };
  const solid = [], open = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + nx, c = b + 1, d = a + 1;
    (skip((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2) ? open : solid).push(a, b, d, b, c, d);
  }
  const top = mk(0, false), bottom = mk(-thick, true), holes = mk(-thick / 2, false);
  top.setIndex(solid);
  const rev = [];
  for (let i = 0; i < solid.length; i += 3) rev.push(solid[i], solid[i + 2], solid[i + 1]);
  bottom.setIndex(rev);
  holes.setIndex(open);
  return { top, bottom, holes: open.length ? holes.toNonIndexed() : null };
}
/** n valores de a até b (inclusive). */
const span = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

// ---------------------------------------------------------------- a caminhonete
/**
 * A caminhonete, em coordenadas próprias: x do meio para os lados (±HW), z = 0 no para-choque da frente (o norte) e LEN
 * no de trás, y do chão. Embaixo dela nada desce de CAR.clearance além das rodas (a Radhija passa por baixo).
 * @param {(geo: THREE.BufferGeometry, color: any, o?: any) => any} car põe uma peça no lugar da caminhonete
 * @param {any} CAR
 * @param {{ x: number, z: number }[]} wheels as rodas, nas coordenadas dela
 */
function drawTruck(car, CAR, wheels) {
  const HW = (CAR.x1 - CAR.x0) / 2, LEN = CAR.z1 - CAR.z0;
  const TX = HW - 0.02; // meia largura da lataria
  const R = CAR.wheelR, WY = R + 0.012; // centro das rodas (o pneu amassa 6 mm no piso)
  const WF = Math.min(...wheels.map((w) => w.z)), WR = Math.max(...wheels.map((w) => w.z));
  const UNDER = CAR.clearance; // embaixo da lataria
  const ARCH = R + 0.09; // raio dos arcos das rodas
  const ZF = 0.07; // a grade
  const ZCAB = 2.42; // fundo da cabine
  const ZR = LEN - 0.04; // a tampa da caçamba
  const BELT = 1.08;
  const SIDE = TX - 0.3; // por dentro dos para-lamas: o miolo (motor e câmbio), com o fundo mais alto
  const CABX = TX - 0.08; // meia largura da capota
  const RED = C('#c4553f'), RED_D = C('#9c4030'), CREAM = C('#efe5cf'), DARK = C('#2a2a2e'), LINER = C('#3b3a37');
  const CHROME = C('#d5dade'), IRON = C('#4a4b4f'), STEEL = C('#6d7074'), RUST = C('#6b5a4e');
  const solid = (geo, color, o = {}) => car(geo, color, { ao: true, ...o });
  const glass = (geo, color, o = {}) => car(geo, color, { slot: 'glass', ...o });
  const archDark = (p, n, base) => {
    if (n.y < -0.6) return DARK;
    if (Math.abs(n.x) < 0.7) for (const wz of [WF, WR]) if (Math.hypot(p.z - wz, p.y - WY) < ARCH + 0.045) return DARK;
    return base;
  };
  const paintRed = (p, n) => archDark(p, n, _c.copy(RED).multiplyScalar(1 + (vnoise2(p.x * 3 + p.y * 2, p.z * 3) - 0.5) * 0.05));

  // ---------- a frente: os dois para-lamas (com o arco da roda) e o miolo entre eles (capô, motor, embaixo da cabine)
  const bs = 0.03;
  /** O perfil (z, y): yb embaixo; arch: com o arco da roda; inset: recuo para o chanfro; drop: o miolo fica 6 mm abaixo. */
  const frontProfile = (yb, arch, inset, drop) => (s) => {
    const top = BELT - inset - drop, zf = ZF + inset + drop, zb = ZCAB - inset - drop;
    s.moveTo(zf + 0.05, yb);
    if (arch) {
      const r = ARCH + inset, dz = Math.sqrt(r * r - (yb - WY) ** 2);
      s.lineTo(WF - dz, yb);
      s.absarc(WF, WY, r, Math.atan2(yb - WY, -dz), Math.atan2(yb - WY, dz), true);
    }
    s.lineTo(zb - 0.03, yb);
    s.quadraticCurveTo(zb, yb, zb, yb + 0.03);
    s.lineTo(zb, top - 0.03);
    s.quadraticCurveTo(zb, top, zb - 0.03, top);
    s.lineTo(1.16, top - 0.005);
    s.lineTo(0.42, top - 0.045);
    s.quadraticCurveTo(zf + 0.03, top - 0.05, zf + 0.005, top - 0.12);
    s.lineTo(zf, yb + 0.08);
    s.quadraticCurveTo(zf, yb, zf + 0.05, yb);
  };
  solid(extrudeX(frontProfile(UNDER + bs, true, bs, 0), -TX, -SIDE + 0.04, { bt: 0.035, bs, segs: 2, curve: 12 }), paintRed);
  solid(extrudeX(frontProfile(UNDER + bs, true, bs, 0), SIDE - 0.04, TX, { bt: 0.035, bs, segs: 2, curve: 12 }), paintRed);
  const MID_Y = 0.6; // o fundo do miolo
  solid(extrudeX(frontProfile(MID_Y, false, 0, 0.006), -SIDE, SIDE, { bt: 0, curve: 6 }), (p, n) => (Math.abs(n.x) > 0.7 ? DARK : paintRed(p, n)));
  // a capota creme (para-brisa inclinado, teto, vidro de trás)
  solid(extrudeX((s) => {
    s.moveTo(1.2, 1.1);
    s.lineTo(1.56, 1.7);
    s.quadraticCurveTo(1.59, 1.755, 1.66, 1.76);
    s.lineTo(2.28, 1.76);
    s.quadraticCurveTo(2.355, 1.76, 2.36, 1.7);
    s.lineTo(2.36, 1.1);
    s.lineTo(1.2, 1.1);
  }, -CABX, CABX, { bt: 0.04, bs: 0.04, segs: 2, curve: 6 }), (p) => _c.copy(CREAM).multiplyScalar(1 + (vnoise2(p.x * 4, p.z * 4) - 0.5) * 0.04));
  // vidros: para-brisa, laterais e o de trás (com as patinhas adesivadas)
  const SKY = C('#87aac0'), DEEP = C('#3f5667');
  const GLASS = (p) => _c.copy(SKY).lerp(DEEP, clamp01((1.66 - p.y) / 0.5));
  const wa = [1.2, 1.1], wb = [1.56, 1.7], wl = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);
  const wn = [-(wb[1] - wa[1]) / wl, (wb[0] - wa[0]) / wl]; // a normal de fora do para-brisa (z, y)
  /** Um ponto em cima do para-brisa: t ao longo dele (0 embaixo), off para fora. → [z, y] */
  const onGlass = (t, off) => [wa[0] + (wb[0] - wa[0]) * t + wn[0] * (0.04 + off), wa[1] + (wb[1] - wa[1]) * t + wn[1] * (0.04 + off)];
  glass(panelZY(onGlass(0, 0), onGlass(1, 0), -(TX - 0.17), TX - 0.17, wn, 0.006, 0.006, 0.07), GLASS);
  const sideWin = [[1.31, 1.16], [1.585, 1.62], [1.66, 1.69], [2.26, 1.69], [2.3, 1.16]];
  glass(shapeXY(sideWin).rotateY(-Math.PI / 2).translate(-CABX - 0.004, 0, 0), GLASS);
  glass(shapeXY(sideWin.map(([z, y]) => [-z, y])).rotateY(Math.PI / 2).translate(CABX + 0.004, 0, 0), GLASS);
  glass(rb(1.5, 0.48, 0.006, 0.05, 1).translate(0, 1.2, 2.406), GLASS);
  const paw = (x, y, s) => {
    car(new THREE.CircleGeometry(0.03 * s, 12).scale(1.15, 0.9, 1).translate(x, y, 2.413), C('#f6f2ea'));
    for (let i = 0; i < 4; i++) {
      const a = 0.5 + i * 0.7;
      car(new THREE.CircleGeometry(0.012 * s, 8).translate(x + Math.cos(a) * 0.045 * s, y + Math.sin(a) * 0.045 * s, 2.413), C('#f6f2ea'));
    }
  };
  paw(-0.55, 1.3, 1.25);
  paw(-0.4, 1.27, 0.85);
  // limpadores, a grelha de ar na frente do para-brisa, os vincos do capô e a antena
  for (const [x0, x1] of [[-0.62, -0.1], [0.12, 0.64]]) {
    const a = onGlass(0.1, 0.014), b = onGlass(0.15, 0.014);
    car(rodAB([x0, a[1], a[0]], [x1, b[1], b[0]], 0.006, 4), DARK);
  }
  const hoodY = (z) => BELT - 0.051 + (z - 0.42) * 0.054; // em cima do capô (o miolo)
  car(slab(1.3, 0.006, 0.07).translate(0, hoodY(1.12) - 0.002, 1.12), DARK);
  for (const x of [-0.3, 0.3]) car(slab(0.006, 0.004, 0.66).rotateX(-0.054).translate(x, hoodY(0.76) - 0.0015, 0.76), RED_D);
  car(rodAB([TX - 0.11, BELT - 0.01, 0.6], [TX - 0.11, 1.72, 0.8], 0.004, 4), DARK);
  car(sphere(0.009, 6, 4).translate(TX - 0.11, 1.72, 0.8), DARK);

  // ---------- os lados: frisos e maçanetas das portas, retrovisores, para-lamas de plástico, a tampa do tanque
  for (const sd of [-1, 1]) {
    const x = sd * (TX + 0.002);
    for (const [z0, z1, y0, y1] of [[1.26, 1.267, 0.56, 1.04], [2.33, 2.337, 0.56, 1.04], [1.26, 2.337, 0.56, 0.567]]) {
      car(new THREE.BoxGeometry(0.004, y1 - y0, z1 - z0).translate(x, (y0 + y1) / 2, (z0 + z1) / 2), C('#7e2f22'));
    }
    glass(rb(0.014, 0.028, 0.12, 0.006, 1).translate(sd * (TX + 0.007), 0.94, 2.18), CHROME);
    // retrovisor (acima das dogs)
    const mx = sd * (TX + 0.1);
    car(rodAB([sd * (TX - 0.02), 1.1, 1.3], [mx, 1.16, 1.34], 0.012), DARK);
    car(rb(0.05, 0.13, 0.17, 0.025, 1).translate(mx, 1.1, 1.36), DARK);
    glass(rb(0.03, 0.1, 0.006, 0.01, 1).translate(mx, 1.115, 1.449), C('#9fc0d4'));
    for (const wz of [WF, WR]) {
      car(extrudeX((s) => {
        s.absarc(wz, WY, ARCH + 0.05, 0.36, Math.PI - 0.36, false);
        s.absarc(wz, WY, ARCH - 0.005, Math.PI - 0.36, 0.36, true);
      }, sd < 0 ? -HW - 0.045 : TX - 0.03, sd < 0 ? -TX + 0.03 : HW + 0.045, { bt: 0.008, bs: 0.006, segs: 1, curve: 14 }), C('#3a3a3e'));
    }
  }
  car(cyl(0.035, 0.035, 0.008, 12).rotateZ(Math.PI / 2).translate(-TX - 0.004, 0.92, 2.66), DARK);

  // ---------- a caçamba: as laterais com o arco de trás (vermelhas por fora, revestidas por dentro), o fundo, a frente
  // e a tampa
  const bedSide = (x0, x1, inDir) => solid(extrudeX((s) => {
    const b = 0.012, yb = UNDER + b, r = ARCH + b, dz = Math.sqrt(r * r - (yb - WY) ** 2);
    s.moveTo(ZCAB + 0.04 + b, yb);
    s.lineTo(WR - dz, yb);
    s.absarc(WR, WY, r, Math.atan2(yb - WY, -dz), Math.atan2(yb - WY, dz), true);
    s.lineTo(ZR - b, yb);
    s.lineTo(ZR - b, BELT - b);
    s.lineTo(ZCAB + 0.04 + b, BELT - b);
    s.lineTo(ZCAB + 0.04 + b, yb);
  }, x0, x1, { bt: 0.012, bs: 0.012, segs: 1, curve: 12 }), (p, n) => (n.x * inDir > 0.5 && p.y > 0.7 ? LINER : paintRed(p, n)));
  bedSide(-TX, -TX + 0.06, 1);
  bedSide(TX - 0.06, TX, -1);
  const BED = { x0: -TX + 0.06, x1: TX - 0.06, z0: ZCAB + 0.06, z1: ZR - 0.07, y: 0.74 };
  const bw = BED.x1 - BED.x0, bzc = (BED.z0 + BED.z1) / 2;
  solid(slab(bw, 0.06, BED.z1 - BED.z0).translate(0, BED.y - 0.06, bzc), LINER);
  for (let i = 0; i < 6; i++) car(slab(0.03, 0.004, BED.z1 - BED.z0 - 0.04).translate(BED.x0 + 0.17 + i * 0.3, BED.y + 0.001, bzc), C('#4a4946'));
  solid(slab(bw, BELT - BED.y - 0.01, 0.05).translate(0, BED.y, ZCAB + 0.065), LINER);
  solid(rb(bw, 0.45, 0.07, 0.015, 1).translate(0, 0.62, ZR - 0.035), (p, n) => (n.z < -0.5 ? LINER : paintRed(p, n)));
  car(rb(bw + 0.01, 0.022, 0.09, 0.008, 1).translate(0, 1.068, ZR - 0.035), RED_D);
  for (const x of [-TX + 0.03, TX - 0.03]) car(rb(0.085, 0.025, ZR - ZCAB - 0.02, 0.01, 1).translate(x, BELT - 0.006, (ZCAB + 0.04 + ZR) / 2), RED_D);
  // as caixas de roda dentro da caçamba
  for (const [x0, x1] of [[BED.x0, BED.x0 + 0.22], [BED.x1 - 0.22, BED.x1]]) {
    car(extrudeX((s) => {
      const r = ARCH + 0.09, dz = Math.sqrt(r * r - (BED.y - WY) ** 2);
      s.moveTo(WR - dz, BED.y);
      s.absarc(WR, WY, r, Math.atan2(BED.y - WY, -dz), Math.atan2(BED.y - WY, dz), true);
      s.lineTo(WR - dz, BED.y);
    }, x0, x1, { bt: 0.01, bs: 0.01, segs: 1, curve: 10 }), LINER);
  }
  // a tampa: o vinco, a maçaneta, a placa (sem letras) e as lanternas
  car(slab(1.6, 0.008, 0.004).translate(0, 0.9, ZR + 0.003), RED_D);
  car(rb(0.16, 0.035, 0.015, 0.006, 1).translate(0, 0.97, ZR + 0.006), DARK);
  car(rb(0.34, 0.11, 0.008, 0.004, 1).translate(0, 0.72, ZR + 0.006), C('#f4f2ec'));
  car(slab(0.33, 0.022, 0.003).translate(0, 0.805, ZR + 0.0115), C('#2f5fb8'));
  for (const x of [-TX + 0.035, TX - 0.035]) {
    glass(rb(0.065, 0.2, 0.02, 0.008, 1).translate(x, 0.8, ZR + 0.012), C('#c9362f'));
    glass(rb(0.065, 0.06, 0.02, 0.008, 1).translate(x, 0.73, ZR + 0.012), C('#f2efe6'));
  }

  // ---------- os para-choques cromados (o de trás com o degrau de borracha; o da frente com as garras e a placa)
  glass(rb(2 * TX + 0.02, 0.15, 0.13, 0.04, 1).translate(0, 0.5, 0.065), CHROME);
  for (const x of [-0.42, 0.42]) glass(rb(0.07, 0.2, 0.05, 0.02, 1).translate(x, 0.497, -0.005), CHROME);
  car(rb(0.34, 0.11, 0.008, 0.004, 1).translate(0, 0.52, -0.003), C('#f4f2ec'));
  car(slab(0.33, 0.022, 0.003).translate(0, 0.605, -0.0085), C('#2f5fb8'));
  glass(rb(2 * TX + 0.02, 0.14, 0.13, 0.04, 1).translate(0, 0.54, LEN - 0.065), CHROME);
  car(slab(0.6, 0.004, 0.08).translate(0, 0.681, LEN - 0.065), DARK);
  // a frente: a grade, os faróis redondos e os piscas
  glass(rb(0.9, 0.26, 0.025, 0.02, 1).translate(0, 0.67, ZF - 0.008), CHROME);
  car(rb(0.8, 0.19, 0.012, 0.015, 1).translate(0, 0.705, ZF - 0.026), DARK);
  for (let i = 0; i < 4; i++) glass(slab(0.76, 0.012, 0.008).translate(0, 0.728 + i * 0.04, ZF - 0.034), CHROME);
  for (const x of [-0.74, 0.74]) {
    glass(cyl(0.085, 0.085, 0.03, 16).translate(0, -0.015, 0).rotateX(Math.PI / 2).translate(x, 0.83, ZF - 0.012), C('#f4f0e2'));
    glass(new THREE.TorusGeometry(0.088, 0.011, 6, 18).translate(x, 0.83, ZF - 0.026), CHROME);
    glass(sphere(0.05, 10, 6).scale(1, 1, 0.35).translate(x, 0.83, ZF - 0.03), C('#fffbe8'));
    glass(rb(0.11, 0.04, 0.02, 0.008, 1).translate(x, 0.68, ZF - 0.012), C('#f0a43a'));
  }

  // ---------- a lama da tempestade e o remendo de massa no para-lama da frente
  const MUD = [C('#7b5d43'), C('#5d4532'), C('#8f7255')];
  // (manchas com respingos de até ~1,75 r: ficam dentro dos painéis, longe dos arcos e da borda de baixo)
  const muds = [[1.42, 0.64, 0.05], [1.66, 0.6, 0.035], [0.2, 0.62, 0.035], [2.62, 0.62, 0.05], [2.8, 0.57, 0.03], [3.92, 0.62, 0.04], [1.9, 0.9, 0.025]];
  muds.forEach(([z, y, r], i) => {
    for (const sd of [-1, 1]) car(wallBlob(r * (sd < 0 ? 1 : 0.85), 40 + i * 3 + (sd + 1), sd, 14, 0.3).translate(sd * (TX + 0.003), y, z + (sd < 0 ? 0 : 0.03)), MUD[i % 3]);
  });
  for (const [x, y, r] of [[-0.6, 0.76, 0.04], [0.55, 0.75, 0.045], [0.32, 0.84, 0.025]]) car(wallBlob(r, Math.round(70 + x * 10), 0, 14, 0.3).translate(x, y, ZR + 0.004), MUD[1]);
  car(shapeXY([[0, 0], [0.3, 0], [0.3, 0.13], [0, 0.13]]).rotateY(-Math.PI / 2).translate(-TX - 0.003, 0.86, 0.36), C('#9aa1a4'));

  // ---------- por baixo (tudo acima de UNDER): longarinas e travessas, o cárter, o câmbio, o cardã, o eixo de trás com
  // o diferencial e os feixes de mola, os braços e a barra da frente, o tanque, o escapamento e o estepe
  const LOW = UNDER + 0.006;
  for (const x of [-0.5, 0.5]) {
    car(slab(0.07, MID_Y + 0.01 - LOW, ZCAB - 0.36).translate(x, LOW, (0.36 + ZCAB) / 2), DARK);
    car(slab(0.07, 0.69 - LOW, ZR - 0.13 - ZCAB).translate(x, LOW, (ZCAB + ZR - 0.13) / 2), DARK);
  }
  for (const [z, y] of [[0.3, 0.52], [1.95, 0.53], [2.62, 0.56], [ZR - 0.13, 0.56]]) car(slab(1.0, 0.06, 0.07).translate(0, y, z), DARK);
  car(rb(0.44, MID_Y + 0.01 - LOW, 0.46, 0.035, 1).translate(0, LOW, 0.8), IRON); // cárter
  car(cyl(0.065, 0.1, 0.8, 10).rotateX(Math.PI / 2).translate(0, MID_Y, 1.05), STEEL); // câmbio
  car(rodAB([0, 0.585, 1.85], [0, 0.585, WR - 0.1], 0.028, 8), STEEL); // cardã
  car(sphere(0.1, 12, 8).scale(1.1, 0.84, 0.85).translate(0, 0.581, WR - 0.03), IRON); // diferencial
  car(rodAB([-0.84, 0.537, WR], [0.84, 0.537, WR], 0.04, 8), IRON); // o eixo de trás
  for (const sd of [-1, 1]) {
    const x = sd * 0.62;
    car(rodAB([x, 0.65, WR - 0.5], [x, 0.596, WR], 0.017, 5), RUST);
    car(rodAB([x, 0.596, WR], [x, 0.65, WR + 0.42], 0.017, 5), RUST);
    car(slab(0.1, 0.04, 0.09).translate(x, 0.575, WR), DARK);
    // os braços da suspensão da frente
    for (const dz of [-0.15, 0.15]) car(rodAB([sd * 0.5, 0.535, WF + dz], [sd * 0.82, 0.52, WF], 0.018, 5), IRON);
  }
  car(rodAB([-0.82, 0.552, WF - 0.24], [0.82, 0.552, WF - 0.24], 0.012, 5), STEEL); // a barra de direção
  car(rb(0.3, 0.17, 0.5, 0.04, 1).translate(-0.72, LOW + 0.004, 2.72), C('#3a3a3e')); // o tanque
  // o escapamento: do motor ao silencioso, por cima do eixo e para trás, ao lado do estepe
  const EXH = C('#5e5d5b');
  car(tubeAlong([[0.3, 0.57, 0.92], [0.3, 0.552, 1.4], [0.28, 0.552, 2.0], [0.28, 0.575, 2.56]], 0.022, 6, 14), EXH);
  car(cyl(0.075, 0.075, 0.46, 10).rotateX(Math.PI / 2).translate(0.28, 0.578, 2.55), C('#6f6c68'));
  car(tubeAlong([[0.28, 0.578, 3.0], [0.3, 0.632, WR - 0.14], [0.37, 0.634, WR + 0.14], [0.37, 0.53, ZR - 0.26], [0.37, 0.522, ZR - 0.1]], 0.022, 6, 16), EXH);
  glass(cyl(0.025, 0.025, 0.2, 8).rotateX(Math.PI / 2).translate(0.37, 0.522, ZR - 0.12), CHROME);
  // o estepe embaixo da caçamba, atrás do eixo
  const SPZ = WR + 0.36;
  car(tireGeo(0.27, 0.092, 20), C('#2f2d2f'), { y: 0.59, z: SPZ });
  car(cyl(0.165, 0.165, 0.11, 14).translate(0, 0.535, SPZ), (p, n) => (n.y < -0.5 ? _c.set('#d8d4cb') : _c.set('#8f8c86')));
  car(cyl(0.05, 0.05, 0.012, 8).translate(0, 0.524, SPZ), DARK);

  // ---------- rodas: pneu (com a banda suja de barro), aro creme, a calota cromada e os parafusos
  const k = R / 0.34;
  const tire = tireGeo(R, CAR.wheelW / 2, 24).rotateZ(Math.PI / 2);
  const tireCol = (p) => {
    const rr = Math.hypot(p.y, p.z);
    if (rr < R * 0.97) return _c.set('#2c2b2e');
    const kk = Math.floor(((Math.atan2(p.z, p.y) + Math.PI) / TAU) * 24) % 2;
    return _c.set(kk ? '#3a332c' : '#4a3f33');
  };
  for (const w of wheels) {
    const out = Math.sign(w.x) || 1;
    car(tire, tireCol, { x: w.x, y: WY, z: w.z });
    car(cyl(0.21 * k, 0.21 * k, 0.16, 18).translate(0, -0.08, 0).rotateZ(Math.PI / 2), (p, n) => (n.x * out > 0.5 ? _c.set('#efebe2') : DARK), { x: w.x, y: WY, z: w.z });
    glass(new THREE.TorusGeometry(0.196 * k, 0.012, 5, 18).rotateY(Math.PI / 2), CHROME, { x: w.x + out * 0.082, y: WY, z: w.z });
    glass(sphere(0.095 * k, 12, 8), CHROME, { x: w.x + out * 0.076, y: WY, z: w.z, sx: 0.4 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      car(cyl(0.013, 0.013, 0.012, 6).rotateZ(Math.PI / 2), DARK, { x: w.x + out * 0.086, y: WY + Math.cos(a) * 0.145 * k, z: w.z + Math.sin(a) * 0.145 * k });
    }
  }

  // ---------- na caçamba: a lona azul dobrada, a caixa de ferramentas, o caixote de laranjas, a tábua e uma poça com
  // folhas
  solid(rb(0.5, 0.06, 0.36, 0.03, 2).rotateY(0.08).translate(-0.15, BED.y, BED.z0 + 0.3), C('#3f6fb5'));
  solid(rb(0.46, 0.055, 0.33, 0.03, 2).rotateY(-0.06).translate(-0.13, BED.y + 0.058, BED.z0 + 0.31), C('#4a7cc2'));
  solid(rb(0.48, 0.2, 0.22, 0.02, 1).translate(BED.x1 - 0.34, BED.y, BED.z0 + 0.18), C('#e2a83a'));
  car(new THREE.TorusGeometry(0.06, 0.01, 4, 12, Math.PI).translate(BED.x1 - 0.34, BED.y + 0.2, BED.z0 + 0.18), DARK);
  for (const dx of [-0.17, 0.17]) glass(rb(0.03, 0.04, 0.012, 0.004, 1).translate(BED.x1 - 0.34 + dx, BED.y + 0.14, BED.z0 + 0.29), CHROME);
  solid(rb(0.38, 0.24, 0.32, 0.015, 1).translate(BED.x0 + 0.46, BED.y, BED.z1 - 0.2), C('#c99a5c'));
  for (const y of [0.07, 0.16]) car(slab(0.385, 0.03, 0.325).translate(BED.x0 + 0.46, BED.y + y, BED.z1 - 0.2), C('#a87a44'));
  for (let i = 0; i < 5; i++) car(sphere(0.045, 8, 6).translate(BED.x0 + 0.37 + (i % 3) * 0.09, BED.y + 0.255 + (i > 2 ? 0.03 : 0), BED.z1 - 0.27 + Math.floor(i / 3) * 0.1 + (i % 2) * 0.03), C('#f08a2c'));
  solid(rb(0.16, 0.03, 1.0, 0.008, 1).rotateY(0.1).translate(0.3, BED.y + 0.003, bzc + 0.16), C('#c8a777'));
  glass(shapeXY(blobPts(0.16, 77, 20)).rotateX(-Math.PI / 2).translate(-0.4, BED.y + 0.008, BED.z0 + 0.8), C('#9cc0d4'));
  const LEAF = ['#5d8a3a', '#7d9c3f', '#a7ad46', '#d0a945', '#a86f3d'].map(C);
  [[-0.28, BED.z0 + 0.86, 0.4, 0], [-0.52, BED.z0 + 1.04, 2.1, 3], [0.6, BED.z0 + 0.59, 1.2, 4], [0.05, BED.z0 + 0.62, 2.9, 1]].forEach(([x, z, a, ci]) => {
    car(leafGeo(0.08, 0.028).rotateY(a).translate(x, BED.y + 0.012, z), LEAF[ci]);
  });
}

// ---------------------------------------------------------------- a bicicleta e o carrinho de mão
/**
 * Bicicleta de passeio em coordenadas próprias: x ao longo dela (a frente em +x), y do chão, z para os lados (a
 * coroa e a corrente em +z).
 * @param {(geo: THREE.BufferGeometry, color: any) => any} add
 */
function drawBike(add) {
  const RW = 0.31, AX = 0.51;
  const MINT = C('#6fc6ad'), TIRE = C('#2f2b29'), METAL = C('#c7ced2'), DARK = C('#3a3a3e'), SADDLE = C('#5a3a2a');
  for (const sx of [-1, 1]) {
    const x = sx * AX;
    add(new THREE.TorusGeometry(RW - 0.02, 0.02, 6, 24).translate(x, RW, 0), TIRE);
    add(new THREE.TorusGeometry(RW - 0.046, 0.008, 4, 24).translate(x, RW, 0), METAL);
    for (let i = 0; i < 8; i++) add(rod(0.0025, (RW - 0.05) * 2, 3).rotateZ((i / 8) * Math.PI).translate(x, RW, 0), METAL);
    add(cyl(0.022, 0.022, 0.07, 8).translate(0, -0.035, 0).rotateX(Math.PI / 2).translate(x, RW, 0), METAL);
    // o para-lama (um arco por cima da roda)
    add(new THREE.TorusGeometry(RW + 0.022, 0.011, 3, 12, sx < 0 ? Math.PI * 0.86 : Math.PI * 0.62).scale(1, 1, 2.3).rotateZ(sx < 0 ? Math.PI * 0.24 : Math.PI * 0.2).translate(x, RW, 0), MINT);
  }
  const BB = [-0.08, 0.28, 0], SEAT = [-0.2, 0.78, 0], HT = [0.34, 0.86, 0], HB = [0.385, 0.7, 0];
  const tube = (a, b, r = 0.016, c = MINT) => add(rodAB(a, b, r, 6), c);
  tube(BB, SEAT, 0.017);
  tube(SEAT, HT, 0.016);
  tube(BB, HB, 0.019);
  tube(HT, HB, 0.02);
  for (const sz of [-1, 1]) {
    tube([BB[0], BB[1], sz * 0.03], [-AX, RW, sz * 0.05], 0.011);
    tube([SEAT[0], SEAT[1] - 0.03, sz * 0.02], [-AX, RW, sz * 0.05], 0.009);
    tube([HB[0], HB[1], sz * 0.03], [AX, RW, sz * 0.05], 0.012); // o garfo
    add(cyl(0.016, 0.016, 0.09, 8).translate(0, -0.045, 0).rotateX(Math.PI / 2).translate(0.31, 0.975, sz * 0.19), C('#f4efe2')); // manoplas
  }
  // o canote e o selim, a mesa e o guidão, a campainha
  tube(SEAT, [-0.225, 0.9, 0], 0.012, METAL);
  add(rb(0.24, 0.045, 0.13, 0.02, 1).translate(-0.245, 0.9, 0), SADDLE);
  tube(HT, [0.325, 0.97, 0], 0.012, METAL);
  tube([0.31, 0.975, -0.22], [0.31, 0.975, 0.22], 0.011, METAL);
  add(sphere(0.022, 8, 6).translate(0.31, 1.0, 0.1), METAL);
  // a coroa, a catraca, a corrente, os pedivelas e os pedais (o de baixo do lado da parede)
  add(cyl(0.085, 0.085, 0.008, 16).translate(0, -0.004, 0).rotateX(Math.PI / 2).translate(BB[0], BB[1], 0.055), METAL);
  add(cyl(0.032, 0.032, 0.008, 10).translate(0, -0.004, 0).rotateX(Math.PI / 2).translate(-AX, RW, 0.055), METAL);
  tube([BB[0], BB[1] + 0.083, 0.055], [-AX, RW + 0.03, 0.055], 0.004, DARK);
  tube([BB[0], BB[1] - 0.083, 0.055], [-AX, RW - 0.03, 0.055], 0.004, DARK);
  tube([BB[0], BB[1], 0.07], [BB[0] - 0.11, BB[1] + 0.13, 0.085], 0.009, METAL);
  add(rb(0.09, 0.02, 0.07, 0.006, 1).translate(BB[0] - 0.11, BB[1] + 0.12, 0.125), DARK);
  tube([BB[0], BB[1], -0.07], [BB[0] + 0.11, BB[1] - 0.13, -0.085], 0.009, METAL);
  add(rb(0.09, 0.02, 0.07, 0.006, 1).translate(BB[0] + 0.11, BB[1] - 0.14, -0.125), DARK);
  // a cestinha de vime na frente (com o forro xadrez aparecendo) e o bagageiro
  add(rb(0.26, 0.18, 0.3, 0.03, 1).translate(0.56, 0.84, 0), (p, n) => (n.y > 0.6 ? _c.set('#7d5f3a') : _c.set('#c9a46a').multiplyScalar(0.92 + (Math.floor(p.y * 40) % 2) * 0.1)));
  add(slab(0.2, 0.004, 0.24).translate(0.56, 1.021, 0), C('#e8d9b8'));
  tube([0.45, 0.86, 0], [HT[0], HT[1] - 0.03, 0], 0.007, METAL);
  add(slab(0.3, 0.012, 0.11).translate(-0.53, 0.66, 0), METAL);
  for (const sz of [-1, 1]) tube([-0.6, 0.66, sz * 0.05], [-AX, RW, sz * 0.055], 0.006, METAL);
  tube([-0.4, 0.668, 0], [SEAT[0] - 0.01, SEAT[1] - 0.06, 0], 0.006, METAL);
}

/**
 * Carrinho de mão em coordenadas próprias: x para os lados, z ao longo dele (a roda em +z, os cabos em −z), y do chão.
 * @param {(geo: THREE.BufferGeometry, color: any, o?: any) => any} add
 */
function drawBarrow(add) {
  const GREEN = C('#4f9a63'), GREEN_D = C('#3b7a4d'), IRON = C('#38383c'), WOOD = C('#b98a56'), TIRE = C('#2f2d2f');
  // a roda
  add(new THREE.TorusGeometry(0.15, 0.042, 6, 16).rotateY(Math.PI / 2).translate(0, 0.192, 0.6), TIRE);
  add(cyl(0.11, 0.11, 0.05, 10).translate(0, -0.025, 0).rotateZ(Math.PI / 2).translate(0, 0.192, 0.6), C('#d94f3d'));
  add(rodAB([-0.09, 0.192, 0.6], [0.09, 0.192, 0.6], 0.012, 5), IRON);
  // a caçamba (chapa verde, escura e suja por dentro), com a água da chuva e uma folha no fundo
  const tub = tubGeo(0.62, 0.88, 0.4, 0.52, 0.27, 0.012);
  paint(tub, (p, n) => {
    const inside = n.y > 0.3 || n.x * p.x + n.z * p.z < 0;
    return _c.copy(inside ? GREEN_D : GREEN).multiplyScalar(1 + (vnoise2(p.x * 9, p.z * 9 + p.y * 7) - 0.5) * 0.14 - (inside ? 0.08 : 0));
  });
  add(tub.translate(0, 0.36, 0.02), null);
  add(slab(0.385, 0.004, 0.51).translate(0, 0.384, 0.02), C('#8fb4c6'), { slot: 'glass' });
  add(leafGeo(0.09, 0.03).rotateY(0.8).translate(0.05, 0.392, 0.1), C('#a7ad46'));
  add(leafGeo(0.07, 0.026).rotateY(2.4).translate(-0.1, 0.392, -0.08), C('#a86f3d'));
  for (const sd of [-1, 1]) {
    // os cabos de madeira (da pega até o eixo), a manopla, o pé e o reforço
    add(rodAB([sd * 0.28, 0.56, -0.74], [sd * 0.22, 0.345, -0.2], 0.018, 6), WOOD);
    add(rodAB([sd * 0.22, 0.345, -0.2], [sd * 0.09, 0.2, 0.6], 0.018, 6), WOOD);
    add(rodAB([sd * 0.283, 0.572, -0.77], [sd * 0.27, 0.526, -0.64], 0.023, 6), IRON);
    add(rodAB([sd * 0.22, 0.34, -0.22], [sd * 0.25, 0.012, -0.3], 0.013, 5), IRON);
    add(rodAB([sd * 0.25, 0.02, -0.34], [sd * 0.25, 0.02, -0.24], 0.014, 5), IRON);
    add(rodAB([sd * 0.24, 0.12, -0.275], [sd * 0.2, 0.345, 0.0], 0.009, 4), IRON);
    add(rodAB([sd * 0.16, 0.36, 0.3], [sd * 0.09, 0.2, 0.58], 0.01, 4), IRON);
  }
  add(rodAB([-0.25, 0.12, -0.275], [0.25, 0.12, -0.275], 0.009, 4), IRON);
}

/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildGaragem(kit, root, L) {
  const { CARPORT: CP, CAR, WHEELS, STORAGE: ST, STORAGE_DOOR: SD, BALL, SHELF, ROPE, WALL, STORAGE_STUFF: STUFF } = L;
  const put = (geo, color, o = {}) => kit.add(geo, { group: G, color, ...o });
  /** Enfeites e peças penduradas: sem o sombreado de base do kit. */
  const deco = (geo, color, o = {}) => kit.add(geo, { group: G, color, ao: false, ...o });
  const wt = (L.WALLS?.t ?? 0.16) / 2;
  const wallN = WALL.maxZ - WALL.t / 2; // face norte do muro do condomínio
  // o depósito: faces de fora e de dentro das paredes oeste (com a porta), norte e leste; a do sul é dele mesmo, 5 cm
  // na frente do muro do condomínio (o muro é mais baixo que a laje)
  const X0 = ST.x0 - wt, X0i = ST.x0 + wt, X1i = ST.x1 - wt, X1 = ST.x1 + wt;
  const Z0 = ST.z0 - wt, Z0i = ST.z0 + wt, ZS = wallN - 0.05;
  const H = SD.hinge, LP = SD.latchPost;
  /** Fim da parede ao norte da porta: a folha aberta (99°) passa rente ao batente sem entrar nele. */
  const JAMB = H.z - 0.08;
  const LINTEL = SD.h + 0.07; // embaixo da verga
  const WALL_H = ST.h; // a laje assenta em cima das paredes
  /** A prateleira do balde, na face de dentro da parede oeste, ao norte da porta. */
  const SH = { x0: X0i, x1: X0i + 0.29, z0: Z0i + 0.04, z1: JAMB - 0.05, y: SHELF.y };
  const CX = (CAR.x0 + CAR.x1) / 2;
  /** A linha dos pilares do fundo (colisor 'garagem-pilar-3'). */
  const BACKZ = WALL.maxZ - 0.4;
  /**
   * O que fica no chão da garagem e colide (os colisores saem daqui, no layout). Enquanto o layout não tiver
   * GARAGE_STUFF, valem estes mesmos valores.
   */
  const GS = L.GARAGE_STUFF ?? {
    posts: [{ x: CAR.x1 + 0.66, z: CP.z0 }, { x: CAR.x1 + 0.66, z: BACKZ }, { x: CP.x0, z: ST.z0 }],
    bike: { x0: ST.x0 + 0.85, x1: ST.x0 + 2.65, z0: ST.z0 - 0.66, z1: ST.z0 - 0.08 },
    barrow: { x0: CP.x0 + 0.3, x1: CP.x0 + 1.0, z0: WALL.maxZ - 3.1, z1: WALL.maxZ - 1.5 },
    bench: { x0: ST.x0 - 2.07, x1: ST.x0 - 0.37, z0: WALL.maxZ - 0.82, z1: WALL.maxZ - 0.2 },
    tires: { x: CP.x0 + 0.66, z: WALL.maxZ - 0.62, r: 0.36 },
  };
  const anim = [];
  const seeThrough = [];
  /** Vidros e telhas translúcidas, em coordenadas do mundo (uma malha só, no fim). */
  const clear = [];

  // ======================================================== 1. PISO
  /** A laje passa 30 cm dos pilares da frente e dos lados (as bases deles ficam inteiras em cima dela). */
  const SL = { x0: CP.x0 - 0.3, x1: CP.x1 + 0.3, z0: CP.z0 - 0.3, z1: wallN + 0.02 };
  /** Fica dentro do piso da garagem? (a bola e o balde assentam no topo dele) */
  const onFloor = (x, z) => x > SL.x0 - 0.01 && x < X1 + 0.01 && z > SL.z0 - 0.01 && z < WALL.maxZ;
  // as juntas de dilatação cortam o piso em placas (cada uma com o seu tom)
  const JX = [(CP.x0 + X0) / 2, X0, (X0 + SL.x1) / 2];
  const JZ = [CP.z0 + (wallN - CP.z0) / 3, CP.z0 + ((wallN - CP.z0) * 2) / 3];
  const PLATE_K = [1.0, 0.965, 1.03, 0.98, 1.025, 0.99, 0.96, 1.01, 0.975, 1.02, 1.0, 0.97];
  const plateK = (x, z) => PLATE_K[(x < JX[0] ? 0 : x < JX[1] ? 1 : x < JX[2] ? 2 : 3) + 4 * (z < JZ[0] ? 0 : z < JZ[1] ? 1 : 2)];
  const CONC = C('#c2baad'), WETC = C('#8e897f'), EDGEC = C('#a49d91');
  const concrete = (p, n) => {
    if (n.y < 0.5) return EDGEC;
    const x = p.x, z = p.z;
    let k = plateK(x, z) * (1 + (fbm2(x * 0.75 + 3.1, z * 0.75 - 1.7, 3) - 0.5) * 0.16 + (vnoise2(x * 6.1, z * 6.1) - 0.5) * 0.05);
    // embaixo da caminhonete, a sombra de contato
    const ix = Math.max(CAR.x0 - x, x - CAR.x1), iz = Math.max(CAR.z0 - z, z - CAR.z1);
    const sd = ix > 0 || iz > 0 ? Math.hypot(Math.max(ix, 0), Math.max(iz, 0)) : Math.max(ix, iz);
    k *= 1 - 0.27 * (1 - smoothstep(-0.55, 0.4, sd));
    // rente ao muro e às paredes do depósito
    let dw = wallN - z;
    if (z > Z0) dw = Math.min(dw, Math.max(0, X0 - x));
    else if (x > X0) dw = Math.min(dw, Z0 - z);
    else dw = Math.min(dw, Math.hypot(X0 - x, Z0 - z));
    k *= 1 - 0.12 * (1 - smoothstep(0, 0.4, dw));
    // a frente molhada (a chuva entrou de lado) e a beira do oeste, que é aberta
    const edge = CP.z0 + 0.8 + (fbm2(x * 1.1 + 7, 2.3, 2) - 0.5) * 1.1 + Math.max(0, CP.x0 + 2.4 - x) * 0.5;
    const wetN = 1 - smoothstep(edge - 0.45, edge, z);
    const wetW = 1 - smoothstep(CP.x0 + 0.15, CP.x0 + 0.75 + fbm2(1.7, z * 1.3, 2) * 0.7, x);
    return _c.copy(CONC).multiplyScalar(k).lerp(WETC, Math.max(wetN, wetW) * 0.55);
  };
  /** Laje fina: de −2 cm (dentro do gramado) até o topo do piso, sem a face de baixo. */
  const slabTop = (x0, x1, z0, z1, cell = 0.2) => gridBox(x1 - x0, FLOOR + 0.02, z1 - z0, cell).translate((x0 + x1) / 2, -0.02, (z0 + z1) / 2);
  put(slabTop(SL.x0, X0, SL.z0, SL.z1), concrete, { slot: 'ground' });
  put(slabTop(X0, SL.x1, SL.z0, Z0), concrete, { slot: 'ground' });
  // dentro do depósito, lajotas de barro (cada uma com seu tom) e o rejunte
  const RF = { x0: X0i, x1: X1i, z0: Z0i, z1: ZS + 0.03 };
  {
    const tw = RF.x1 - RF.x0, td = RF.z1 - RF.z0, tnx = Math.round(tw / 0.3), tnz = Math.round(td / 0.3);
    const TILE = [C('#b8674b'), C('#a95c43'), C('#c27556'), C('#b06850')];
    const tileFloor = tiles(tw, td, tw / tnx, td / tnz, (p) => {
      const x = p.x + (RF.x0 + RF.x1) / 2, z = p.z + (RF.z0 + RF.z1) / 2;
      const i = Math.floor((x - RF.x0) / (tw / tnx)), j = Math.floor((z - RF.z0) / (td / tnz));
      const edge = 1 - smoothstep(0, 0.45, Math.min(x - RF.x0, z - RF.z0, RF.x1 - x, RF.z1 - z));
      return _c.copy(TILE[Math.abs(i * 7 + j * 3) % 4]).multiplyScalar(1 + (vnoise2(i * 1.7, j * 2.3) - 0.5) * 0.12 - edge * 0.12);
    });
    put(tileFloor.translate((RF.x0 + RF.x1) / 2, FLOOR, (RF.z0 + RF.z1) / 2), null, { slot: 'ground' });
    const GROUT = C('#7c4838');
    for (let i = 1; i < tnx; i++) put(slab(0.008, 0.002, td).translate(RF.x0 + (tw / tnx) * i, D1 - 0.002, (RF.z0 + RF.z1) / 2), GROUT, { slot: 'ground' });
    for (let j = 1; j < tnz; j++) put(slab(tw, 0.002, 0.008).translate((RF.x0 + RF.x1) / 2, D1 - 0.002, RF.z0 + (td / tnz) * j), GROUT, { slot: 'ground' });
  }
  // a soleira de granito embaixo da porta (rente: a corda passa por cima dela, por baixo da folha); 2 mm abaixo do piso e
  // entrando 5 mm embaixo dele dos dois lados: nenhuma face no plano de outra
  put(slab(X0i - X0 + 0.01, FLOOR + 0.018, LP.z - JAMB + 0.1).translate(ST.x0, -0.02, (JAMB + LP.z) / 2), C('#9b958b'), { slot: 'ground' });
  // juntas de dilatação
  const JOINT = C('#8b8478');
  const joint = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    put(slab(0.012, 0.002, len).rotateY(Math.atan2(x1 - x0, z1 - z0)).translate((x0 + x1) / 2, D1 - 0.002, (z0 + z1) / 2), JOINT, { slot: 'ground' });
  };
  joint(SL.x0 + 0.02, JZ[0], SL.x1 - 0.02, JZ[0]);
  joint(SL.x0 + 0.02, JZ[1], X0 - 0.02, JZ[1]);
  joint(JX[0], CP.z0 - 0.01, JX[0], wallN);
  joint(JX[1], CP.z0 - 0.01, JX[1], Z0 - 0.01);
  joint(JX[2], CP.z0 - 0.01, JX[2], Z0 - 0.02);
  // a canaleta da entrada (a grelha de ferro, rente ao piso)
  {
    const len = CP.x1 - CP.x0 - 0.8;
    const GR = [C('#3f3f43'), C('#232326')];
    const grate = tiles(len, 0.14, 0.045, 0.14, (p) => GR[Math.abs(Math.round(p.x / 0.045)) % 2]);
    put(grate.translate((CP.x0 + CP.x1) / 2, D1, SL.z0 + 0.1), null, { slot: 'ground' });
  }
  // as faixas amarelas da vaga, gastas (interrompidas nas juntas)
  const BAY = [CAR.x0 - 0.55, CAR.x1 + 0.55];
  {
    const YEL = C('#d9b23c');
    const Rp = rng(61);
    for (const x of BAY) {
      let z = CAR.z0 - 1.2;
      const end = BACKZ - 0.32;
      while (z < end - 0.2) {
        let len = Math.min(0.5 + Rp() * 0.9, end - z);
        for (const jz of JZ) if (z < jz + 0.03 && z + len > jz - 0.03) len = jz - 0.03 - z;
        if (len > 0.12) put(slab(0.085 - Rp() * 0.012, 0.002, len).translate(x, D1 - 0.002, z + len / 2), _c.copy(YEL).multiplyScalar(0.86 + Rp() * 0.2).clone(), { slot: 'ground' });
        z += Math.max(len, 0.04) + 0.05 + Rp() * 0.1;
      }
    }
  }
  // as marcas de borracha dos pneus da frente, da entrada até as rodas (ela entrou de ré)
  const WFZ = Math.min(...WHEELS.map((w) => w.z));
  const RUBBER = C('#68625b');
  for (const w of WHEELS) {
    if (w.z > WFZ + 0.1) continue;
    const stop = w.z - CAR.wheelR - 0.08;
    for (const [z0, z1, dx, ry] of [[CP.z0 + 0.25, CP.z0 + 1.1, 0.02, 0.012], [CP.z0 + 1.2, CP.z0 + 1.85, 0.004, -0.01], [CP.z0 + 1.95, stop, -0.006, 0.006]]) {
      if (z1 - z0 < 0.06) continue;
      put(slab(0.13, 0.002, z1 - z0).rotateY(ry).translate(w.x + dx, D2 - 0.002, (z0 + z1) / 2), RUBBER, { slot: 'ground' });
    }
  }
  // a mancha de óleo embaixo do motor, os pingos, e a mancha antiga da vaga vazia
  const ENGINE = { x: CX, z: CAR.z0 + 0.8 };
  const OLD_STAIN = { x: X0 + 1.5, z: CP.z0 + 2.0 };
  const stains = [
    { x: ENGINE.x, z: ENGINE.z, r: 0.32, seed: 3, cols: ['#26221f', '#3e3933', '#7d786f'] },
    { x: ENGINE.x + 0.28, z: ENGINE.z + 0.42, r: 0.07, seed: 5, cols: ['#2b2723', '#3c3732', '#7a756d'] },
    { x: ENGINE.x - 0.24, z: ENGINE.z + 0.34, r: 0.05, seed: 6, cols: ['#2b2723', '#3c3732', '#7c776f'] },
    { x: ENGINE.x + 0.05, z: ENGINE.z + 1.5, r: 0.045, seed: 8, cols: ['#2b2723', '#3c3732', '#7c776f'] },
    { x: OLD_STAIN.x, z: OLD_STAIN.z, r: 0.42, seed: 9, cols: ['#8b857b', '#968f85', '#aca599'] },
    { x: OLD_STAIN.x + 0.5, z: OLD_STAIN.z + 0.75, r: 0.12, seed: 10, cols: ['#7d776e', '#8c867c', '#a8a196'] },
  ];
  for (const s of stains) put(stainGeo(s.r, s.seed, s.cols.map(C)).translate(s.x, D2, s.z), null, { slot: 'ground' });
  // as poças (a borda de concreto molhado e a água refletindo o céu)
  const PUDDLES = [
    { x: CP.x0 + 1.5, z: CP.z0 + 0.8, r: 0.42, seed: 11 },
    { x: CP.x1 - 0.9, z: CP.z0 + 1.7, r: 0.32, seed: 13 },
    { x: CAR.x0 - 0.6, z: wallN - 0.55, r: 0.26, seed: 17 },
  ];
  for (const P of PUDDLES) {
    const pts = blobPts(P.r, P.seed, 26);
    const inner = pts.map(([x, y]) => [x * 0.86, y * 0.86]);
    const outer = pts.map(([x, y]) => [x * 1.16, y * 1.16]);
    // a água 3 mm acima da borda (malhas e materiais diferentes nunca no mesmo plano)
    put(shapeXY(inner).rotateX(-Math.PI / 2).translate(P.x, D3, P.z), C('#9dc1d6'), { slot: 'glass' });
    put(shapeXY(outer, [inner]).rotateX(-Math.PI / 2).translate(P.x, D2, P.z), C('#878177'), { slot: 'ground' });
  }

  // ======================================================== 2. DEPÓSITO
  const WALL_OUT = C('#e8d6b1'), WALL_IN = C('#f2e9d8'), CAPC = C('#efe6d4'), FRAME = C('#f3ecdc');
  const WOODS = C('#b4875a'), IRON = C('#38383c'), STEEL = C('#9aa3a8'), TIN = C('#e7e3da');
  const plaster = (inX, inZ) => (p, n) => {
    if (n.y > 0.5) return CAPC;
    const inner = n.x * inX + n.z * inZ > 0.5;
    const k = 1 + (fbm2((p.x + p.z) * 1.9, p.y * 1.9, 3) - 0.5) * 0.1 + (vnoise2((p.x - p.z) * 7.3, p.y * 7.3) - 0.5) * 0.03;
    // escorridos da chuva embaixo da laje (por fora) e a umidade subindo do chão; por dentro, o alto mais escuro
    const streak = inner ? 0 : (1 - smoothstep(0, 0.6, WALL_H - p.y)) * vnoise2((p.x + p.z) * 9.3, 1.7) * 0.14;
    const damp = (1 - smoothstep(0.2, 0.75, p.y)) * (inner ? 0.05 : 0.09);
    const dim = inner ? 0.07 * (1 - smoothstep(0, 0.6, WALL_H - p.y)) : 0;
    return _c.copy(inner ? WALL_IN : WALL_OUT).multiplyScalar(k * (1 - streak - damp - dim));
  };
  const wallPiece = (x0, x1, z0, z1, y0, y1, inX, inZ) => put(gridBox(x1 - x0, y1 - y0, z1 - z0, 0.26).translate((x0 + x1) / 2, y0, (z0 + z1) / 2), plaster(inX, inZ));
  /** A janelinha alta da parede leste (o sol da manhã entra por ela). */
  const WIN = { z0: ZS - 2.05, z1: ZS - 1.25, y0: 1.5, y1: 2.0 };
  wallPiece(X0, X1, Z0, Z0i, 0, WALL_H, 0, 1); // norte, inteira
  wallPiece(X0, X0i, Z0i, JAMB, 0, WALL_H, 1, 0); // oeste, ao norte da porta
  wallPiece(X0, X0i, JAMB, LP.z, LINTEL, WALL_H, 1, 0); // a verga
  wallPiece(X0, X0i, LP.z, WALL.maxZ, 0, WALL_H, 1, 0); // oeste, ao sul da porta
  wallPiece(X1i, X1, Z0i, WALL.maxZ, 0, WIN.y0, -1, 0); // leste: embaixo da janela
  wallPiece(X1i, X1, Z0i, WIN.z0, WIN.y0, WALL_H, -1, 0);
  wallPiece(X1i, X1, WIN.z1, WALL.maxZ, WIN.y0, WALL_H, -1, 0);
  wallPiece(X1i, X1, WIN.z0, WIN.z1, WIN.y1, WALL_H, -1, 0);
  wallPiece(X0i, X1i, ZS, ZS + 0.08, 0, WALL_H, 0, -1); // sul (na frente do muro)
  // a laje (por baixo, o forro do depósito)
  put(slab(X1 - X0 + 0.08, 0.08, WALL.maxZ - Z0 + 0.06).translate((X0 + X1) / 2, ST.h, (Z0 + WALL.maxZ - 0.02) / 2), (p, n) => (n.y < -0.5 ? _c.set('#e6dfd1') : _c.set('#cfc8ba')), { ao: false });
  // a janela: o marco de madeira (forra o vão), a travessa em cruz, o peitoril de fora e o alizar de dentro
  {
    const zc = (WIN.z0 + WIN.z1) / 2, yc = (WIN.y0 + WIN.y1) / 2, w = WIN.z1 - WIN.z0, h = WIN.y1 - WIN.y0, d = X1 - X1i + 0.04;
    for (const y of [WIN.y0 - 0.004, WIN.y1 - 0.028]) deco(slab(d, 0.032, w + 0.008).translate(ST.x1, y, zc), FRAME);
    for (const z of [WIN.z0 + 0.012, WIN.z1 - 0.012]) deco(slab(d, h - 0.05, 0.032).translate(ST.x1, WIN.y0 + 0.025, z), FRAME);
    deco(slab(0.022, h - 0.05, 0.022).translate(ST.x1, WIN.y0 + 0.025, zc), FRAME);
    deco(slab(0.022, 0.022, w - 0.05).translate(ST.x1, yc - 0.011, zc), FRAME);
    deco(rb(0.07, 0.03, w + 0.14, 0.01, 1).translate(X1 + 0.03, WIN.y0 - 0.03, zc), C('#d9d2c4'));
    for (const [dy, hh, ww] of [[-0.062, 0.05, w + 0.16], [h + 0.012, 0.05, w + 0.16]]) deco(rb(0.014, hh, ww, 0.005, 1).translate(X1i - 0.008, WIN.y0 + dy, zc), FRAME);
    for (const z of [WIN.z0 - 0.045, WIN.z1 + 0.045]) deco(rb(0.014, h + 0.024, 0.05, 0.005, 1).translate(X1i - 0.008, WIN.y0 - 0.012, z), FRAME);
    // o vidro (translúcido: não faz sombra, o sol passa)
    clear.push(new THREE.PlaneGeometry(w - 0.05, h - 0.05).rotateY(Math.PI / 2).translate(ST.x1 - 0.02, yc, zc));
  }
  // batentes (o do lado da dobradiça é o encaixe da folha), a travessa de cima e os alizares
  put(slab(0.055, LINTEL, H.z - JAMB).translate(X0 + 0.0275, 0, (JAMB + H.z) / 2), FRAME);
  put(slab(0.055, LINTEL, 0.04).translate(X0 + 0.0275, 0, LP.z - 0.02), FRAME);
  deco(slab(X0i - X0 - 0.004, 0.03, LP.z - JAMB).translate(ST.x0, LINTEL - 0.011, (JAMB + LP.z) / 2), FRAME);
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
  put(slab(0.006, 0.22, ZS - LP.z - 0.07).translate(X0i + 0.006, 0, (LP.z + 0.07 + ZS) / 2), BARRA_I);
  put(slab(X1i - X0i - 0.018, 0.22, 0.006).translate((X0i + X1i) / 2, 0, Z0i + 0.006), BARRA_I);
  put(slab(0.006, 0.22, ZS - Z0i - 0.009).translate(X1i - 0.006, 0, (Z0i + 0.009 + ZS) / 2), BARRA_I);
  put(slab(X1i - X0i - 0.018, 0.22, 0.006).translate((X0i + X1i) / 2, 0, ZS - 0.006), BARRA_I);
  // reboco caído mostrando os tijolos: por fora, no alto da parede oeste; por dentro, na parede norte
  const brickPatch = (face, u0, u1, y0, y1, seed) => {
    const Rb = rng(seed);
    const cu = (u0 + u1) / 2, cy = (y0 + y1) / 2, hu = (u1 - u0) / 2, hy = (y1 - y0) / 2;
    const at = (u, y, off, w, h, color) => {
      if (face === 'w') deco(slab(0.003, h, w).translate(X0 - off, y - h / 2, u), color);
      else deco(slab(w, h, 0.003).translate(u, y - h / 2, Z0i + off), color);
    };
    const back = shapeXY(blobPts(1, seed, 16)).scale(hu, hy, 1);
    if (face === 'w') deco(back.rotateY(-Math.PI / 2).translate(X0 - 0.003, cy, cu), C('#cbbda5'));
    else deco(back.translate(cu, cy, Z0i + 0.003), C('#cbbda5'));
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
  brickPatch('w', Z0i + 0.06, Z0i + 0.6, 1.52, 1.98, 21);
  brickPatch('n', X0i + 0.08, X0i + 0.48, 0.3, 0.6, 23);
  // uma trinca saindo da quina da verga
  {
    const CRACK = C('#9a8d77');
    let z = LP.z + 0.04, y = LINTEL + 0.08;
    for (const [dz, dy] of [[0.06, 0.03], [0.03, 0.035], [0.07, 0.02], [0.02, 0.025]]) {
      const len = Math.hypot(dz, dy);
      deco(slab(0.003, len, 0.006).rotateX(Math.atan2(dz, dy)).translate(X0 - 0.003, y, z), CRACK);
      z += dz;
      y += dy;
    }
  }
  // a luminária tartaruga em cima da porta, esquecida acesa desde a noite da garoa
  put(rb(0.03, 0.1, 0.19, 0.012, 1).translate(X0 - 0.015, LINTEL + 0.1, (H.z + LP.z) / 2), C('#f4efe2'));
  deco(sphere(0.07, 12, 8).scale(0.45, 0.62, 1.1).translate(X0 - 0.03, LINTEL + 0.15, (H.z + LP.z) / 2), C('#ffe3a6'), { slot: 'lit' });
  for (const dy of [-0.025, 0.025]) deco(slab(0.004, 0.006, 0.17).translate(X0 - 0.062, LINTEL + 0.147 + dy, (H.z + LP.z) / 2), C('#3c3a36'));
  // a plaquinha do depósito ao lado da porta (pictograma: um balde)
  {
    const z = JAMB - 0.21, y = 1.56, x = X0 - 0.004;
    deco(rb(0.012, 0.24, 0.24, 0.004, 1).translate(x - 0.006, y - 0.12, z), C('#3f6fb5'));
    deco(shapeXY([[-0.055, 0.03], [0.055, 0.03], [0.04, -0.07], [-0.04, -0.07]]).rotateY(-Math.PI / 2).translate(x - 0.0155, y, z), C('#fff6e6'));
    deco(new THREE.TorusGeometry(0.052, 0.006, 4, 12, Math.PI).rotateY(-Math.PI / 2).translate(x - 0.017, y + 0.03, z), C('#fff6e6'));
  }

  // ---------- por fora, na parede oeste: o carretel da mangueira (ao norte da porta), a mangueira pelo chão e o painel
  // de ferramentas (ao sul)
  const HOSE = C('#4fae5c');
  /** O rolo de mangueira no chão, a noroeste do depósito (rente: as dogs passam por cima). */
  const COIL = { x: X0 - 0.56, z: Z0 + 0.5, r: 0.27 };
  {
    const zc = JAMB - 0.62, yc = 0.98;
    const GREEN = C('#3f8f4c');
    deco(rb(0.02, 0.36, 0.25, 0.008, 1).translate(X0 - 0.012, yc - 0.18, zc), C('#2f6b45'));
    for (const x of [X0 - 0.05, X0 - 0.2]) deco(cyl(0.17, 0.17, 0.016, 18).translate(0, -0.008, 0).rotateZ(Math.PI / 2).translate(x, yc, zc), GREEN);
    for (let i = 0; i < 4; i++) {
      deco(new THREE.TorusGeometry(0.108 + (i % 2) * 0.012, 0.017, 6, 18).rotateY(Math.PI / 2).translate(X0 - 0.075 - i * 0.034, yc, zc), _c.copy(HOSE).multiplyScalar(i % 2 ? 0.9 : 1.04).clone());
    }
    deco(cyl(0.022, 0.022, 0.2, 10).translate(0, -0.1, 0).rotateZ(Math.PI / 2).translate(X0 - 0.125, yc, zc), C('#2f6b45'));
    deco(rodAB([X0 - 0.21, yc, zc], [X0 - 0.25, yc + 0.11, zc], 0.01), C('#d9d4c8'));
    deco(cyl(0.016, 0.016, 0.06, 8).rotateZ(Math.PI / 2).translate(X0 - 0.27, yc + 0.11, zc), C('#e2a83a'));
    // a torneira de metal e o pedaço de mangueira subindo até o carretel
    deco(rb(0.03, 0.05, 0.05, 0.01, 1).translate(X0 - 0.015, 0.6, zc - 0.13), C('#c99a45'));
    deco(rodAB([X0 - 0.03, 0.63, zc - 0.13], [X0 - 0.09, 0.62, zc - 0.13], 0.012), C('#c99a45'));
    deco(rodAB([X0 - 0.04, 0.67, zc - 0.13], [X0 - 0.04, 0.69, zc - 0.13], 0.006), C('#c99a45'));
    deco(tubeAlong([[X0 - 0.09, 0.62, zc - 0.13], [X0 - 0.11, 0.66, zc - 0.1], [X0 - 0.1, 0.8, zc - 0.06], [X0 - 0.06, yc - 0.03, zc - 0.02]], 0.014, 6, 12), HOSE);
    // a mangueira desce do carretel rente à parede, corre pelo chão e termina enrolada, com o esguicho amarelo
    const hy = FLOOR + 0.014;
    deco(tubeAlong([
      [X0 - 0.1, yc - 0.12, zc + 0.06], [X0 - 0.045, 0.62, zc + 0.11], [X0 - 0.04, 0.2, zc + 0.12], [X0 - 0.045, hy, zc + 0.11],
      [X0 - 0.13, hy, zc + 0.04], [X0 - 0.25, hy, zc - 0.1], [COIL.x + COIL.r + 0.01, hy, COIL.z + 0.14], [COIL.x + COIL.r - 0.014, hy, COIL.z + 0.02],
    ], 0.014, 6, 40), HOSE);
    for (const [r, y, c] of [[COIL.r - 0.014, hy, 1.0], [COIL.r - 0.05, hy, 0.92], [COIL.r - 0.03, hy + 0.026, 1.06]]) {
      deco(new THREE.TorusGeometry(r, 0.014, 6, 22).rotateX(Math.PI / 2).translate(COIL.x, y, COIL.z), _c.copy(HOSE).multiplyScalar(c).clone());
    }
    deco(tubeAlong([[COIL.x - COIL.r + 0.02, hy, COIL.z - 0.04], [COIL.x - 0.36, hy, COIL.z - 0.2], [COIL.x - 0.52, hy, COIL.z - 0.22]], 0.014, 6, 10), HOSE);
    deco(cyl(0.016, 0.022, 0.12, 8).rotateZ(Math.PI / 2).translate(COIL.x - 0.5, hy + 0.004, COIL.z - 0.22), C('#f2c14e'));
  }
  {
    const z0 = LP.z + 0.2, z1 = Math.min(z0 + 1.6, GS.bench.z1 - 0.3), y0 = 0.82, y1 = 1.77, zc = (z0 + z1) / 2, yc = (y0 + y1) / 2;
    const BOARD = C('#c9a777'), HOLE = C('#7c6243');
    const pw = z1 - z0, ph = y1 - y0, nz = Math.round(pw / 0.1), ny = Math.round(ph / 0.1);
    // a chapa perfurada: os furinhos a cada 10 cm (de perto, a 3ª pessoa vê um por um)
    deco(tilesV(pw, ph, pw / 4, ph / 3, (p) => _c.copy(BOARD).multiplyScalar(0.96 + vnoise2(p.x * 3.1, p.y * 3.7) * 0.08)).rotateY(-Math.PI / 2).translate(X0 - 0.012, yc, zc), null);
    const hole = new THREE.PlaneGeometry(0.018, 0.018).rotateY(-Math.PI / 2);
    for (let i = 0; i < nz; i++) for (let j = 0; j < ny; j++) deco(hole, HOLE, { x: X0 - 0.0145, y: y0 + ((j + 0.5) * ph) / ny, z: z0 + ((i + 0.5) * pw) / nz });
    const WOODF = C('#9c7448');
    for (const [dz, dy, w, h] of [[0, ph / 2, pw + 0.04, 0.03], [0, -ph / 2, pw + 0.04, 0.03], [pw / 2, 0, 0.03, ph], [-pw / 2, 0, 0.03, ph]]) {
      deco(rb(0.016, h, w, 0.005, 1).translate(X0 - 0.01, yc + dy - h / 2, zc + dz), WOODF);
    }
    const xT = X0 - 0.03; // as ferramentas, na frente do painel
    const WOODH = C('#b98a56');
    // martelo e marreta
    deco(rb(0.02, 0.27, 0.03, 0.008, 1).translate(xT, 1.24, z0 + 0.12), WOODH);
    deco(rb(0.026, 0.036, 0.12, 0.008, 1).translate(xT, 1.5, z0 + 0.12), STEEL);
    deco(rb(0.022, 0.2, 0.032, 0.008, 1).translate(xT, 0.9, z0 + 0.12), WOODH);
    deco(rb(0.05, 0.06, 0.1, 0.01, 1).translate(xT - 0.01, 1.09, z0 + 0.12), C('#6d7074'));
    // serrote (a lâmina trapezoidal e o cabo)
    deco(shapeXY([[0, 0], [0.4, 0.02], [0.4, 0.075], [0, 0.12]]).rotateY(-Math.PI / 2).translate(xT + 0.005, 1.45, z0 + 0.32), C('#c4ccd0'));
    deco(rb(0.026, 0.11, 0.1, 0.02, 1).translate(xT, 1.44, z0 + 0.3), C('#a5532f'));
    // esquadro, trena e pincéis
    deco(slab(0.006, 0.3, 0.035).translate(xT, 0.9, z0 + 0.86), STEEL);
    deco(slab(0.006, 0.035, 0.2).translate(xT, 0.9, z0 + 0.94), STEEL);
    deco(rb(0.04, 0.07, 0.07, 0.015, 1).translate(xT - 0.01, 1.26, z0 + 0.9), C('#f0b93b'));
    ['#d0453b', '#3f7fbf', '#5ba35a'].forEach((c, i) => {
      deco(cyl(0.01, 0.012, 0.13, 6).translate(xT, 1.02, z0 + 0.34 + i * 0.075), WOODH);
      deco(rb(0.014, 0.07, 0.04, 0.004, 1).translate(xT, 0.955, z0 + 0.34 + i * 0.075), C(c));
    });
    // chave inglesa e alicate
    deco(rb(0.01, 0.2, 0.03, 0.005, 1).translate(xT, 0.98, z1 - 0.12), STEEL);
    deco(new THREE.TorusGeometry(0.022, 0.008, 4, 10).rotateY(Math.PI / 2).translate(xT, 1.2, z1 - 0.12), STEEL);
    for (const s of [-1, 1]) deco(rb(0.012, 0.15, 0.02, 0.006, 1).rotateX(s * 0.12).translate(xT, 0.97, z1 - 0.3 + s * 0.014), C('#d0453b'));
    // chaves de fenda (cabos coloridos, pontas para baixo)
    ['#d0453b', '#f2c14e', '#3f7fbf', '#5ba35a'].forEach((c, i) => {
      deco(cyl(0.013, 0.013, 0.08, 8).translate(xT, 1.3, z0 + 0.62 + i * 0.065), C(c));
      deco(rod(0.003, 0.1, 4).translate(xT, 1.25, z0 + 0.62 + i * 0.065), STEEL);
    });
    // nível de bolha
    deco(rb(0.02, 0.04, 0.5, 0.006, 1).translate(xT, 1.64, zc), C('#f0b93b'));
    deco(rb(0.012, 0.016, 0.05, 0.005, 1).translate(xT - 0.01, 1.652, zc), C('#9fe0a8'), { slot: 'glass' });
    // a extensão laranja enrolada num pino e o rolo de pintura
    deco(new THREE.TorusGeometry(0.085, 0.018, 6, 18).rotateY(Math.PI / 2).translate(xT - 0.01, 1.42, z1 - 0.2), C('#f07c2c'));
    deco(cyl(0.03, 0.03, 0.18, 10).rotateX(Math.PI / 2).translate(xT - 0.01, 1.12, z1 - 0.62), C('#eae5da'));
    deco(rodAB([xT, 1.12, z1 - 0.44], [xT, 1.28, z1 - 0.41], 0.006), STEEL);
  }

  // ---------- por dentro: a prateleira do balde (ao norte da porta), com a lata de pregos, a almotolia, os vasos e a
  // pá de lixo pendurada embaixo
  deco(rb(SH.x1 - SH.x0, 0.03, SH.z1 - SH.z0, 0.008, 1).translate((SH.x0 + SH.x1) / 2, SH.y - 0.03, (SH.z0 + SH.z1) / 2), WOODS);
  for (const z of [SH.z0 + 0.08, (SH.z0 + SH.z1) / 2, SH.z1 - 0.08]) {
    deco(slab(0.02, 0.26, 0.025).translate(SH.x0 + 0.01, SH.y - 0.29, z), IRON);
    deco(slab(SH.x1 - SH.x0 - 0.04, 0.02, 0.025).translate((SH.x0 + SH.x1) / 2 - 0.02, SH.y - 0.05, z), IRON);
    deco(rodAB([SH.x0 + 0.02, SH.y - 0.26, z], [SH.x1 - 0.06, SH.y - 0.05, z], 0.008, 4), IRON);
  }
  deco(cyl(0.045, 0.045, 0.11, 12).translate(SH.x0 + 0.1, SH.y, SH.z0 + 0.08), C('#c9442f'));
  deco(cyl(0.046, 0.046, 0.012, 12).translate(SH.x0 + 0.1, SH.y + 0.11, SH.z0 + 0.08), C('#8d969a'));
  deco(cyl(0.03, 0.035, 0.08, 10).translate(SH.x1 - 0.07, SH.y, SH.z0 + 0.2), C('#3f7fbf'));
  deco(rodAB([SH.x1 - 0.07, SH.y + 0.08, SH.z0 + 0.2], [SH.x1 - 0.07, SH.y + 0.15, SH.z0 + 0.27], 0.004), C('#c99a45'));
  for (let i = 0; i < 3; i++) deco(cyl(0.075 - i * 0.004, 0.055 - i * 0.004, 0.11, 12).translate(SH.x0 + 0.14, SH.y + i * 0.035, SH.z0 + 0.42), _c.set('#c9764f').multiplyScalar(1 - i * 0.05).clone());
  deco(cyl(0.04, 0.04, 0.1, 10).translate(SH.x0 + 0.1, SH.y, SH.z0 + 0.62), C('#b7d4dc'), { slot: 'glass' });
  deco(cyl(0.042, 0.042, 0.018, 10).translate(SH.x0 + 0.1, SH.y + 0.1, SH.z0 + 0.62), C('#f2c14e'));
  {
    const z = SH.z0 + 0.3, x = X0i + 0.02;
    deco(rodAB([x, 1.08, z], [x + 0.02, 1.1, z], 0.006, 4), IRON);
    deco(rb(0.018, 0.2, 0.03, 0.006, 1).translate(x + 0.01, 0.9, z), C('#d0453b'));
    deco(rb(0.02, 0.2, 0.26, 0.008, 1).translate(x + 0.012, 0.7, z), C('#d0453b'));
    deco(rb(0.03, 0.12, 0.05, 0.01, 1).translate(x + 0.01, 0.92, z + 0.21), C('#b98a56'));
    deco(rb(0.04, 0.08, 0.16, 0.012, 1).translate(x + 0.014, 0.84, z + 0.21), C('#e6c879'));
  }

  // ---------- latas, potes e caixas
  /** Lata de tinta: o corpo (a tampa na cor do metal), o rótulo de cor e os escorridos. */
  const paintCan = (x, y, z, r, h, color, { open = false, drips = 2, seed = 1, seg = 14 } = {}) => {
    const col = C(color);
    deco(cyl(r, r, h, seg).translate(x, y, z), (p, n) => (n.y > 0.5 ? (open ? col : _c.set('#9aa3a8')) : TIN));
    deco(band(r + 0.003, h * 0.52, seg).translate(x, y + h * 0.2, z), col);
    if (open) deco(new THREE.TorusGeometry(r * 0.97, 0.007, 4, seg).rotateX(Math.PI / 2).translate(x, y + h, z), STEEL);
    const Rd = rng(seed);
    for (let i = 0; i < drips; i++) {
      const a = Rd() * TAU, len = h * (0.22 + Rd() * 0.4);
      deco(slab(0.016, len, 0.005).translate(0, -len, r + 0.004).rotateY(a).translate(x, y + h + 0.002, z), col);
    }
  };
  const jar = (x, y, z, lid, fill) => {
    deco(cyl(0.045, 0.045, 0.12, 10).translate(x, y, z), C('#b7d4dc'), { slot: 'glass' });
    deco(cyl(0.035, 0.035, 0.05, 8).translate(x, y + 0.005, z), C(fill));
    deco(cyl(0.047, 0.047, 0.02, 10).translate(x, y + 0.12, z), C(lid));
  };
  const carton = (x, y, z, w, h, d, color = '#c69a62', ry = 0) => {
    deco(rb(w, h, d, 0.01, 1).rotateY(ry).translate(x, y, z), C(color));
    deco(slab(w + 0.004, 0.004, Math.min(0.05, d * 0.3)).rotateY(ry).translate(x, y + h, z), C('#d9c9a3'));
  };
  const clayPots = (x, y, z, n = 3, r = 0.07) => {
    for (let i = 0; i < n; i++) deco(cyl(r - i * 0.004, r * 0.72 - i * 0.004, r * 1.5, 12).translate(x, y + i * r * 0.5, z), _c.set('#c9764f').multiplyScalar(1 - i * 0.05).clone());
  };

  // ---------- as prateleiras de latas e potes, na parede oeste ao sul da porta (fora do arco da folha)
  {
    const z0 = LP.z + 0.14, z1 = ZS - 0.06, zc = (z0 + z1) / 2, x0 = X0i, x1 = X0i + 0.22, xc = (x0 + x1) / 2;
    for (const y of [0.95, 1.4, 1.85]) {
      deco(rb(x1 - x0, 0.025, z1 - z0, 0.006, 1).translate(xc, y - 0.025, zc), WOODS);
      for (const z of [z0 + 0.1, zc, z1 - 0.1]) deco(slab(0.018, 0.12, 0.02).translate(x0 + 0.009, y - 0.145, z), IRON);
    }
    paintCan(xc, 0.95, z0 + 0.14, 0.085, 0.2, '#3f7fbf', { seed: 2 });
    paintCan(xc, 0.95, z0 + 0.36, 0.075, 0.17, '#f2c14e', { seed: 3, drips: 3 });
    carton(xc, 0.95, z0 + 0.64, 0.2, 0.15, 0.2);
    jar(xc, 0.95, z0 + 0.9, '#d0453b', '#8d7b62');
    jar(xc, 0.95, z0 + 1.02, '#3f7fbf', '#9aa3a8');
    paintCan(xc, 0.95, z1 - 0.52, 0.085, 0.2, '#5ba35a', { seed: 4 });
    deco(rb(0.19, 0.11, 0.3, 0.012, 1).translate(xc, 0.95, z1 - 0.2), C('#d0453b'));
    deco(rb(0.03, 0.02, 0.1, 0.006, 1).translate(xc, 1.06, z1 - 0.2), IRON);
    for (let i = 0; i < 3; i++) jar(xc, 1.4, z0 + 0.09 + i * 0.11, ['#d0453b', '#3f7fbf', '#f2c14e'][i], ['#8d7b62', '#9aa3a8', '#7f6a52'][i]);
    deco(cyl(0.03, 0.03, 0.17, 10).translate(xc, 1.4, z0 + 0.5), C('#d0453b'));
    deco(cyl(0.012, 0.012, 0.02, 8).translate(xc, 1.57, z0 + 0.5), C('#f4efe2'));
    carton(xc, 1.4, z0 + 0.8, 0.19, 0.11, 0.24, '#b88d58');
    clayPots(xc, 1.4, z0 + 1.14, 3, 0.07);
    paintCan(xc, 1.4, z1 - 0.44, 0.08, 0.18, '#e2674e', { seed: 5 });
    carton(xc, 1.4, z1 - 0.17, 0.2, 0.16, 0.22);
    // em cima: caixas de papelão, o farolete e a lona enrolada
    carton(xc, 1.85, z0 + 0.2, 0.2, 0.22, 0.3);
    carton(xc, 1.85, z0 + 0.56, 0.18, 0.16, 0.22, '#b88d58');
    deco(rb(0.08, 0.1, 0.12, 0.02, 1).translate(xc, 1.85, z0 + 0.92), C('#f2c14e'));
    deco(cyl(0.04, 0.04, 0.012, 12).rotateZ(Math.PI / 2).translate(xc + 0.046, 1.91, z0 + 0.92), C('#fff6d8'), { slot: 'glass' });
    deco(cyl(0.07, 0.07, 0.5, 10).rotateX(Math.PI / 2).translate(xc, 1.92, z1 - 0.8), C('#3f6fb5'));
    carton(xc, 1.85, z1 - 0.14, 0.2, 0.2, 0.2);
  }
  // ---------- as prateleiras da parede norte: regador, vasos, sementes; em cima, caixas, a caixa térmica e latas
  {
    const x0 = X0i + 0.62, x1 = X1i - 0.55, xc = (x0 + x1) / 2, z0 = Z0i, z1 = Z0i + 0.26, zc = (z0 + z1) / 2;
    for (const y of [1.05, 1.55]) {
      deco(rb(x1 - x0, 0.025, z1 - z0, 0.006, 1).translate(xc, y - 0.025, zc), WOODS);
      for (const x of [x0 + 0.12, xc, x1 - 0.12]) {
        deco(slab(0.02, 0.14, 0.018).translate(x, y - 0.165, z0 + 0.009), IRON);
        deco(rodAB([x, y - 0.15, z0 + 0.02], [x, y - 0.03, z1 - 0.05], 0.007, 4), IRON);
      }
    }
    // o regador verde
    deco(cyl(0.085, 0.095, 0.19, 12).translate(x0 + 0.22, 1.05, zc), C('#4f9a63'));
    deco(rodAB([x0 + 0.3, 1.1, zc], [x0 + 0.46, 1.24, zc], 0.014, 6), C('#4f9a63'));
    deco(cyl(0.035, 0.02, 0.03, 8).rotateZ(-0.85).translate(x0 + 0.47, 1.24, zc), C('#3b7a4d'));
    deco(new THREE.TorusGeometry(0.06, 0.009, 4, 10, Math.PI).rotateZ(Math.PI / 2).translate(x0 + 0.14, 1.15, zc), C('#3b7a4d'));
    clayPots(x0 + 0.72, 1.05, zc, 4, 0.075);
    clayPots(x0 + 0.92, 1.05, zc + 0.02, 2, 0.06);
    carton(x0 + 1.2, 1.05, zc, 0.24, 0.1, 0.18, '#d9c9a3');
    for (let i = 0; i < 3; i++) deco(slab(0.06, 0.07, 0.004).translate(x0 + 1.12 + i * 0.08, 1.15, zc - 0.03 + i * 0.02), C(['#e2674e', '#5ba35a', '#f2c14e'][i]));
    jar(x0 + 1.5, 1.05, zc, '#5ba35a', '#6a4a30');
    jar(x0 + 1.62, 1.05, zc + 0.02, '#f2c14e', '#8d7b62');
    // um vasinho com cacto
    deco(cyl(0.07, 0.05, 0.1, 12).translate(x1 - 0.2, 1.05, zc), C('#c9764f'));
    deco(sphere(0.055, 10, 8).scale(1, 1.25, 1).translate(x1 - 0.2, 1.2, zc), C('#5d8a3a'));
    deco(sphere(0.022, 6, 5).translate(x1 - 0.17, 1.27, zc + 0.01), C('#e85aa8'));
    // em cima
    carton(x0 + 0.24, 1.55, zc, 0.36, 0.24, 0.22);
    carton(x0 + 0.62, 1.55, zc, 0.26, 0.16, 0.2, '#b88d58', 0.12);
    deco(rb(0.36, 0.22, 0.22, 0.03, 1).translate(x0 + 1.06, 1.55, zc), C('#3f7fbf'));
    deco(rb(0.37, 0.05, 0.23, 0.02, 1).translate(x0 + 1.06, 1.76, zc), C('#f4efe2'));
    paintCan(x0 + 1.45, 1.55, zc, 0.09, 0.2, '#f08a3c', { seed: 6 });
    paintCan(x0 + 1.66, 1.55, zc + 0.01, 0.075, 0.17, '#7fb2d9', { seed: 7 });
    carton(x1 - 0.2, 1.55, zc, 0.26, 0.2, 0.2);
  }
  // ---------- na parede leste: as ferramentas de jardim penduradas num sarrafo
  {
    const x = X1i - 0.03, z0 = Z0i + 0.62, z1 = WIN.z0 - 0.22, yR = 1.78;
    const HANDLE = C('#c69a62');
    deco(rb(0.022, 0.07, z1 - z0, 0.006, 1).translate(X1i - 0.011, yR - 0.035, (z0 + z1) / 2), WOODS);
    const hang = (z) => deco(rodAB([X1i - 0.02, yR, z], [X1i - 0.06, yR + 0.01, z], 0.006, 4), IRON);
    // a pá
    hang(z0 + 0.2);
    deco(rodAB([x, yR - 0.02, z0 + 0.2], [x, 1.08, z0 + 0.2], 0.014, 6), HANDLE);
    deco(rb(0.012, 0.3, 0.2, 0.006, 1).translate(x, 0.8, z0 + 0.2), STEEL);
    deco(rb(0.03, 0.03, 0.13, 0.008, 1).translate(x, yR - 0.04, z0 + 0.2), HANDLE);
    // a enxada
    hang(z0 + 0.55);
    deco(rodAB([x, yR - 0.02, z0 + 0.55], [x, 0.78, z0 + 0.55], 0.013, 6), HANDLE);
    deco(rb(0.11, 0.012, 0.16, 0.004, 1).translate(x - 0.04, 0.775, z0 + 0.55), STEEL);
    // a tesoura de poda e o serrote de galho
    hang(z0 + 0.86);
    for (const s of [-1, 1]) {
      deco(rb(0.012, 0.16, 0.022, 0.006, 1).rotateX(s * 0.16).translate(x, yR - 0.2, z0 + 0.86 + s * 0.02), C('#e2674e'));
      deco(rb(0.008, 0.2, 0.03, 0.004, 1).rotateX(-s * 0.1).translate(x, yR - 0.4, z0 + 0.86 + s * 0.012), STEEL);
    }
    hang(z0 + 1.18);
    deco(new THREE.TorusGeometry(0.05, 0.012, 4, 10).rotateY(Math.PI / 2).translate(x, yR - 0.07, z0 + 1.18), C('#e2a83a'));
    deco(shapeXY([[0, 0], [0.04, -0.42], [-0.035, -0.42], [-0.05, 0]]).rotateY(-Math.PI / 2).translate(x, yR - 0.11, z0 + 1.18), C('#c4ccd0'));
    // um rolo de arame
    hang(z1 - 0.22);
    deco(new THREE.TorusGeometry(0.11, 0.014, 5, 16).rotateY(Math.PI / 2).translate(x - 0.005, yR - 0.12, z1 - 0.22), C('#7d8589'));
  }
  // ---------- embaixo da janela, a prateleirinha com os vasos de tempero (pegam o sol da manhã) e o chapéu de palha
  {
    const zc = (WIN.z0 + WIN.z1) / 2, y = WIN.y0 - 0.1, x = X1i - 0.085;
    deco(rb(0.17, 0.025, WIN.z1 - WIN.z0 + 0.24, 0.006, 1).translate(x, y - 0.025, zc), WOODS);
    for (const z of [WIN.z0 - 0.02, WIN.z1 + 0.02]) deco(rodAB([X1i - 0.01, y - 0.15, z], [X1i - 0.14, y - 0.03, z], 0.007, 4), IRON);
    for (const h of [{ dz: -0.3, c: '#5d8a3a', r: 0.07 }, { dz: 0, c: '#7d9c3f', r: 0.085 }, { dz: 0.3, c: '#4f8a35', r: 0.065 }]) {
      deco(cyl(0.055, 0.04, 0.08, 10).translate(x, y, zc + h.dz), C('#c9764f'));
      deco(sphere(h.r, 8, 6).scale(1, 1.15, 1).translate(x, y + 0.08 + h.r * 0.8, zc + h.dz), C(h.c));
    }
    const hz = (WIN.z1 + ZS) / 2 + 0.1, hy = 1.6, STRAW = C('#e6c879');
    deco(cyl(0.18, 0.18, 0.012, 16).rotateZ(Math.PI / 2).translate(X1i - 0.016, hy, hz), STRAW);
    deco(sphere(0.095, 12, 8).scale(0.7, 1, 1).translate(X1i - 0.03, hy, hz), STRAW);
    deco(new THREE.TorusGeometry(0.094, 0.012, 4, 14).rotateY(Math.PI / 2).translate(X1i - 0.034, hy, hz), C('#d0453b'));
  }
  // ---------- na parede do sul: a escada de madeira deitada nos ganchos, a mangueira velha enrolada e a guia vermelha
  {
    const z = ZS - 0.035, x0 = STUFF.cans.x1 + 0.18, x1 = STUFF.crate.x0 - 0.02, yl = 1.42, yh = 1.76;
    const LAD = C('#c8a777');
    for (const y of [yl, yh]) deco(rb(x1 - x0, 0.06, 0.03, 0.008, 1).translate((x0 + x1) / 2, y - 0.03, z), LAD);
    const nr = Math.round((x1 - x0) / 0.3);
    for (let i = 1; i < nr; i++) deco(rod(0.012, yh - yl, 6).translate(x0 + ((x1 - x0) * i) / nr, (yl + yh) / 2, z), LAD);
    for (const x of [x0 + 0.25, x1 - 0.25]) {
      deco(slab(0.025, 0.012, 0.06).translate(x, yl - 0.042, ZS - 0.03), IRON);
      deco(slab(0.025, 0.05, 0.01).translate(x, yl - 0.042, ZS - 0.065), IRON);
    }
    for (let i = 0; i < 3; i++) deco(new THREE.TorusGeometry(0.15 + (i % 2) * 0.012, 0.016, 5, 18).translate(x0 + 0.42, 0.98, ZS - 0.028 - i * 0.03), _c.set('#3f8f4c').multiplyScalar(i % 2 ? 0.88 : 1).clone());
    deco(rodAB([x0 + 0.42, 1.14, ZS - 0.01], [x0 + 0.42, 1.15, ZS - 0.11], 0.008, 4), IRON);
    deco(rodAB([x0 + 1.05, 1.2, ZS - 0.01], [x0 + 1.05, 1.21, ZS - 0.06], 0.007, 4), IRON);
    deco(tubeAlong([[x0 + 1.05, 1.2, ZS - 0.04], [x0 + 0.98, 0.95, ZS - 0.03], [x0 + 1.03, 0.72, ZS - 0.03], [x0 + 1.1, 0.95, ZS - 0.035], [x0 + 1.05, 1.2, ZS - 0.045]], 0.01, 5, 20), C('#d0453b'));
    deco(rb(0.03, 0.05, 0.02, 0.006, 1).translate(x0 + 1.03, 0.69, ZS - 0.03), STEEL);
  }
  // ---------- o pendente do depósito (a lâmpada apagada)
  {
    const x = (X0i + X1i) / 2 + 0.2, z = (Z0i + ZS) / 2;
    deco(rod(0.004, 0.3, 4).translate(x, ST.h - 0.15, z), IRON);
    deco(cyl(0.022, 0.03, 0.05, 8).translate(x, ST.h - 0.34, z), C('#f4efe2'));
    deco(sphere(0.045, 10, 8).scale(1, 1.2, 1).translate(x, ST.h - 0.39, z), C('#f7f1dc'), { slot: 'glass' });
  }

  // ---------- as latas de tinta no chão, no canto sudoeste (colisor 'deposito-latas'), com os respingos
  {
    const R0 = STUFF.cans, x0 = R0.x0, z0 = R0.z0;
    paintCan(x0 + 0.15, FLOOR, z0 + 0.16, 0.125, 0.26, '#d65a4a', { seed: 11, drips: 3, seg: 16 });
    paintCan(x0 + 0.15, FLOOR + 0.262, z0 + 0.16, 0.1, 0.2, '#f2c14e', { seed: 12, drips: 3, seg: 16 });
    paintCan(x0 + 0.15, FLOOR, z0 + 0.46, 0.13, 0.27, '#f3efe6', { seed: 13, open: true, drips: 4, seg: 16 });
    paintCan(x0 + 0.16, FLOOR, z0 + 0.77, 0.125, 0.26, '#5ba35a', { seed: 14, drips: 2, seg: 16 });
    paintCan(x0 + 0.16, FLOOR + 0.262, z0 + 0.77, 0.095, 0.19, '#7fb2d9', { seed: 15, drips: 3, seg: 16 });
    paintCan(x0 + 0.42, FLOOR, z0 + 0.2, 0.12, 0.24, '#5f9ad0', { seed: 16, open: true, drips: 4, seg: 16 });
    paintCan(x0 + 0.43, FLOOR, z0 + 0.62, 0.13, 0.27, '#f08a3c', { seed: 17, drips: 3, seg: 16 });
    // o pau de mexer na lata branca e a trincha atravessada na azul
    deco(rodAB([x0 + 0.13, FLOOR + 0.1, z0 + 0.48], [x0 + 0.2, FLOOR + 0.42, z0 + 0.4], 0.008, 5), C('#c8a777'));
    deco(rb(0.03, 0.016, 0.2, 0.006, 1).rotateY(0.5).translate(x0 + 0.42, FLOOR + 0.243, z0 + 0.2), C('#b98a56'));
    deco(rb(0.045, 0.014, 0.07, 0.004, 1).rotateY(0.5).translate(x0 + 0.47, FLOOR + 0.244, z0 + 0.29), C('#5f9ad0'));
    // respingos no chão (em volta das latas) e na parede
    const SPL = ['#5f9ad0', '#d65a4a', '#f2c14e', '#f3efe6', '#5ba35a', '#f08a3c'];
    [[0.5, -0.1, 0.07], [0.68, 0.22, 0.05], [0.3, -0.16, 0.04], [0.72, 0.62, 0.06], [0.64, 0.86, 0.035], [0.86, 0.4, 0.03], [0.08, -0.14, 0.03]].forEach(([dx, dz, r], i) => {
      put(flatBlob(r, 31 + i, 14, 0.4).translate(x0 + dx, D2, z0 + dz), C(SPL[i % 6]), { slot: 'ground' });
    });
    [[0.52, 0.34, 0.035], [0.3, 0.4, 0.025], [0.86, 0.33, 0.03]].forEach(([dz, y, r], i) => deco(wallBlob(r, 51 + i, 1, 12, 0.5).translate(X0i + 0.004, y, z0 + dz), C(SPL[(i * 2 + 1) % 6])));
  }
  // ---------- a caixa de brinquedos das irmãs (a meia fica em cima, SOCKS 'deposito'), o saco de ração e as tigelas
  // (colisor 'deposito-caixa')
  const CR = STUFF.crate;
  const SOCK = L.SOCKS?.find((s) => s.id === 'deposito') ?? { x: (CR.x0 + CR.x1) / 2, z: CR.z0 + 0.2, y: 0.45 };
  {
    const top = Math.max(0.3, SOCK.y - 0.032), hw = Math.min(0.3, SOCK.x - CR.x0 - 0.04, CR.x1 - SOCK.x - 0.04);
    // a meia fica em cima dela, perto da frente; a caixa se estende para o sul
    const cz = SOCK.z + 0.06, hd = Math.min(0.24, cz - CR.z0 - 0.02);
    const h = top - FLOOR;
    put(rb(hw * 2, h - 0.06, hd * 2, 0.012, 1).translate(SOCK.x, FLOOR, cz), (p) => _c.set('#c79b63').multiplyScalar(0.94 + (Math.floor((p.x - SOCK.x + 2) / 0.1) % 2) * 0.08));
    put(rb(hw * 2 + 0.014, 0.06, hd * 2 + 0.014, 0.012, 1).translate(SOCK.x, top - 0.06, cz), C('#d1a76f'));
    for (const sx of [-1, 1]) deco(slab(0.04, h - 0.03, hd * 2 + 0.02).translate(SOCK.x + sx * (hw - 0.07), FLOOR + 0.01, cz), C('#8a6c43'));
    // o ossinho pintado na frente (para quem entra) e a patinha do lado
    const zf = cz - hd - 0.004, yb = FLOOR + h * 0.42;
    deco(shapeXY([[-0.07, -0.012], [0.07, -0.012], [0.07, 0.012], [-0.07, 0.012]]).rotateY(Math.PI).translate(SOCK.x, yb, zf), C('#fff6e6'));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) deco(new THREE.CircleGeometry(0.02, 10).rotateY(Math.PI).translate(SOCK.x + sx * 0.075, yb + sy * 0.014, zf), C('#fff6e6'));
    const xw = SOCK.x - hw - 0.004;
    deco(new THREE.CircleGeometry(0.035, 12).rotateY(-Math.PI / 2).translate(xw, yb, cz), C('#fff6e6'));
    for (let i = 0; i < 4; i++) deco(new THREE.CircleGeometry(0.014, 8).rotateY(-Math.PI / 2).translate(xw, yb + Math.sin(0.7 + i * 0.58) * 0.05, cz + Math.cos(0.7 + i * 0.58) * 0.05), C('#fff6e6'));
    // atrás da caixa: o saco de ração encostado na parede e as duas tigelas empilhadas
    const zb = Math.min(CR.z1 - 0.12, ZS - 0.12);
    put(rb(0.34, 0.52, 0.17, 0.06, 2).translate(CR.x0 + 0.24, FLOOR, zb), C('#d9772f'));
    deco(new THREE.CircleGeometry(0.04, 12).rotateY(Math.PI).translate(CR.x0 + 0.24, FLOOR + 0.3, zb - 0.087), C('#fff6e6'));
    for (let i = 0; i < 4; i++) deco(new THREE.CircleGeometry(0.015, 8).rotateY(Math.PI).translate(CR.x0 + 0.24 + Math.cos(0.7 + i * 0.58) * 0.055, FLOOR + 0.3 + Math.sin(0.7 + i * 0.58) * 0.055, zb - 0.087), C('#fff6e6'));
    for (let i = 0; i < 2; i++) put(cyl(0.11, 0.085, 0.06, 14).translate(CR.x1 - 0.16, FLOOR + i * 0.035, zb - 0.02), C(i ? '#e2674e' : '#5f9ad0'));
  }
  // ---------- a vassoura e o rastelo encostados no canto nordeste (colisor 'deposito-vassouras')
  {
    const B = STUFF.brooms, bx = (B.x0 + B.x1) / 2 + 0.01, bz = B.z1 - 0.08;
    put(rodAB([bx, FLOOR + 0.12, bz], [bx + 0.02, 1.36, Z0i + 0.025], 0.013), C('#d9a441'));
    put(rb(0.28, 0.05, 0.06, 0.02, 1).rotateY(0.12).translate(bx, FLOOR + 0.1, bz), C('#d0453b'));
    put(rb(0.26, 0.1, 0.045, 0.01, 1).rotateY(0.12).translate(bx, FLOOR, bz + 0.004), C('#e6c879'));
    const rx = bx - 0.07, rz = B.z0 + 0.09;
    put(rodAB([rx, FLOOR, rz], [rx - 0.02, 1.3, Z0i + 0.03], 0.012), C('#b98a56'));
    deco(rb(0.3, 0.03, 0.03, 0.008, 1).translate(rx - 0.02, 1.27, Z0i + 0.045), C('#7d8589'));
    for (let i = 0; i < 9; i++) deco(rod(0.004, 0.07, 3).translate(rx - 0.15 + i * 0.033, 1.335, Z0i + 0.05), C('#7d8589'));
  }

  // ======================================================== 3. COBERTURA (vista por baixo: pilares, vigas, caibros, ripas e telhas)
  const WOOD = C('#8b5c3b'), WOOD_L = C('#9c6a45'), CONCB = C('#c9c3b8');
  const bx0 = CP.x0 - 0.22, bx1 = CP.x1 + 0.22, bxc = (bx0 + bx1) / 2;
  /** O telhado sobe da calha da frente até o muro do fundo. */
  const SLOPE = 0.42 / (BACKZ - CP.z0), THETA = Math.atan(SLOPE), COS = Math.cos(THETA);
  /** Embaixo dos caibros, em cima da viga da frente (a viga fica logo acima de CP.h: a câmera não chega nela). */
  const RAF0 = CP.h + 0.27;
  const yRaf = (z) => RAF0 + (z - CP.z0) * SLOPE;
  const RAF_H = 0.15, BAT_H = 0.025, AMP = 0.022, SHEET_T = 0.008;
  const sheetC = (z) => yRaf(z) + (RAF_H + BAT_H) / COS + AMP + SHEET_T + 0.002; // meio das ondas das telhas
  const sheetTop = (z) => sheetC(z) + AMP; // a crista das ondas
  const RZ0 = CP.z0 - 0.45, RZ1 = WALL.maxZ + 0.12, RZC = (RZ0 + RZ1) / 2;
  // três vigas (frente, meio, fundo): os pilares da frente e do oeste nos colisores 'garagem-pilar-N'; no leste, as do
  // meio e do fundo apoiam nas paredes do depósito (pontaletes em cima da laje)
  const BEAMS = [{ z: CP.z0, h: 0.26, w: 0.14 }, { z: ST.z0, h: 0.2, w: 0.12 }, { z: BACKZ, h: 0.2, w: 0.12 }].map((b) => ({ ...b, y0: yRaf(b.z) - b.h }));
  const beamAt = (z) => BEAMS.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a));
  for (const b of BEAMS) deco(rb(bx1 - bx0, b.h, b.w, 0.02, 1).translate(bxc, b.y0, b.z), WOOD);
  for (const b of [BEAMS[1], BEAMS[2]]) for (const x of [ST.x0, ST.x1]) deco(rb(0.12, b.y0 - ST.h - 0.08, 0.12, 0.012, 1).translate(x, ST.h + 0.08, b.z), WOOD);
  const POSTS = [{ x: CP.x0, z: CP.z0 }, { x: CP.x1, z: CP.z0 }, { x: CP.x0, z: BACKZ }, ...GS.posts];
  for (const P of POSTS) {
    const b = beamAt(P.z), x = P.x, z = P.z;
    // a base de concreto (oitavada), a sapata de ferro, o pilar e o capitel
    put(cyl(0.105, 0.13, 0.2, 8).rotateY(Math.PI / 8).translate(x, 0, z), (p, n) => _c.copy(CONCB).multiplyScalar(n.y > 0.5 ? 1.03 : 0.93 + vnoise2(p.x * 31, p.z * 31 + p.y * 17) * 0.1));
    deco(slab(0.16, 0.014, 0.16).translate(x, 0.2, z), IRON);
    for (const s of [-1, 1]) deco(slab(0.01, 0.17, 0.1).translate(x + s * 0.07, 0.214, z), IRON);
    put(rb(0.13, b.y0 - 0.212, 0.13, 0.016, 1).translate(x, 0.212, z), WOOD);
    deco(rb(0.2, 0.05, 0.2, 0.012, 1).translate(x, b.y0 - 0.05, z), WOOD_L);
    // mãos-francesas ao longo da viga
    for (const dir of [-1, 1]) {
      if (x + dir * 0.6 < bx0 || x + dir * 0.6 > bx1) continue;
      deco(rb(0.07, 0.58, 0.07, 0.012, 1).translate(0, -0.29, 0).rotateZ((-dir * Math.PI) / 4).translate(x + dir * 0.26, b.y0 - 0.2, z), WOOD_L);
    }
  }
  // caibros (de norte a sul, em cima das vigas) e ripas (de leste a oeste, em cima dos caibros)
  const rafLen = (RZ1 - RZ0) / COS;
  const NRAF = 12;
  const rafX = (i) => CP.x0 + (i / (NRAF - 1)) * (CP.x1 - CP.x0);
  for (let i = 0; i < NRAF; i++) deco(rb(0.07, RAF_H, rafLen, 0.012, 1), _c.copy(WOOD_L).multiplyScalar(0.93 + (i % 3) * 0.06).clone(), { x: rafX(i), y: yRaf(RZC), z: RZC, rx: -THETA });
  {
    const NB = Math.round((RZ1 - RZ0) / 0.42);
    const BAT = C('#a87a52');
    for (let j = 0; j < NB; j++) {
      const z = RZ0 + 0.05 + (j / (NB - 1)) * (RZ1 - RZ0 - 0.1);
      deco(slab(bx1 - bx0 + 0.06, BAT_H, 0.05), BAT, { x: bxc, y: yRaf(z) + RAF_H / COS, z, rx: -THETA });
    }
  }
  // as telhas onduladas cor de barro (por cima, o limo da chuva; por baixo, o barro claro) e duas faixas translúcidas
  {
    const SX0 = bx0 - 0.05, SX1 = bx1 + 0.05, SZ0 = RZ0 - 0.07, SZ1 = RZ1 + 0.03, SZC = (SZ0 + SZ1) / 2;
    const PITCH = 0.3, W = SX1 - SX0, LEN = (SZ1 - SZ0) / COS;
    const lz = (z) => (z - SZC) / COS;
    /** As telhas translúcidas: uma ao lado da caminhonete (o sol bate nela de manhã) e uma no fundo. */
    const SKYL = [
      { x0: ST.x0 - 1.42, x1: ST.x0 - 0.42, z0: ST.z0 - 0.4, z1: ST.z0 + 3.2 },
      { x0: CX - 0.15, x1: CX + 0.85, z0: WALL.maxZ - 2.2, z1: WALL.maxZ - 0.6 },
    ];
    const zl = [...span(-LEN / 2, LEN / 2, 8), ...SKYL.flatMap((s) => [lz(s.z0), lz(s.z1)])].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 0.06);
    const inSky = (x, z) => SKYL.some((s) => x > s.x0 - bxc && x < s.x1 - bxc && z > lz(s.z0) && z < lz(s.z1));
    const sheet = corrugated(span(-W / 2, W / 2, Math.round(W / (PITCH / 4))), zl, PITCH, AMP, SHEET_T, inSky);
    const TILE = C('#bb6645'), MOSS = C('#7d6a4a'), UNDER = C('#dcae8c');
    const tone = (p) => vnoise2(Math.floor(p.x / PITCH + 0.5) * 1.7, Math.floor((p.z + LEN / 2) / 1.2) * 3.1);
    paint(sheet.top, (p) => {
      const moss = smoothstep(0.52, 0.8, fbm2(p.x * 0.9 + 4, p.z * 0.35, 3)) * 0.45;
      return _c.copy(TILE).multiplyScalar(0.88 + tone(p) * 0.2 + (fbm2(p.x * 0.6, p.z * 0.6, 3) - 0.5) * 0.16).lerp(MOSS, moss);
    });
    paint(sheet.bottom, (p) => _c.copy(UNDER).multiplyScalar(0.9 + tone(p) * 0.16));
    const place = { x: bxc, y: sheetC(SZC), z: SZC, rx: -THETA };
    deco(sheet.top, null, place);
    deco(sheet.bottom, null, place);
    if (sheet.holes) clear.push(sheet.holes.rotateX(-THETA).translate(bxc, sheetC(SZC), SZC));
  }
  // a testeira, a calha (com o canal) e o bico da calha no canto oeste; as tabeiras dos lados
  const FASC = C('#f2ece0');
  deco(rb(bx1 - bx0 + 0.16, 0.2, 0.025, 0.008, 1).translate(bxc, yRaf(RZ0) - 0.03, RZ0 - 0.0125), FASC);
  for (const x of [bx0 - 0.065, bx1 + 0.065]) deco(rb(0.025, 0.22, rafLen + 0.02, 0.008, 1), FASC, { x, y: yRaf(RZC) - 0.04, z: RZC, rx: -THETA });
  const GUT = { z: RZ0 - 0.085, y: yRaf(RZ0) + 0.02 };
  deco(rb(bx1 - bx0 + 0.2, 0.08, 0.12, 0.03, 1).translate(bxc, GUT.y, GUT.z), C('#e9e6df'));
  deco(slab(bx1 - bx0 + 0.16, 0.003, 0.075).translate(bxc, GUT.y + 0.081, GUT.z), C('#8f9599'));
  const SPOUT = { x: bx0 - 0.04, y: GUT.y - 0.14, z: GUT.z };
  deco(cyl(0.024, 0.024, 0.14, 10).translate(SPOUT.x, SPOUT.y, SPOUT.z), C('#d9d6cf'));
  // o pendente esmaltado no corredor (apagado) e as tábuas guardadas em cima das vigas
  {
    const x = (CAR.x1 + ST.x0) / 2, b = BEAMS[1], yb = 2.02;
    deco(rod(0.005, b.y0 - yb - 0.1, 4).translate(x, (b.y0 + yb + 0.1) / 2, b.z), IRON);
    deco(cyl(0.035, 0.17, 0.1, 14).translate(x, yb, b.z), (p, n) => (n.y < -0.5 ? _c.set('#f4efe2') : _c.set('#3f8f6c')));
    deco(sphere(0.04, 10, 8).translate(x, yb + 0.005, b.z), C('#f7f1dc'), { slot: 'glass' });
    const xa = (rafX(1) + rafX(2)) / 2, z0 = ST.z0 - 0.25, z1 = BACKZ + 0.2, zc = (z0 + z1) / 2, len = (z1 - z0) / COS;
    const PL = [C('#d2b98c'), C('#c4a674'), C('#b89561')];
    [[-0.13, 0, 0.24], [0.14, 0, 0.22], [0.02, 0.034, 0.26]].forEach(([dx, dy, w], i) => {
      deco(rb(w, 0.03, len - i * 0.3, 0.006, 1), PL[i], { x: xa + dx, y: yRaf(zc) + dy + 0.002, z: zc + i * 0.08, rx: -THETA });
    });
  }

  // ======================================================== 4. CAMINHONETE (de ré: a frente para a entrada)
  drawTruck((geo, color, o = {}) => kit.add(geo, { group: G, color, ao: false, ...o, x: CX + (o.x ?? 0), z: CAR.z0 + (o.z ?? 0) }), CAR, WHEELS.map((w) => ({ x: w.x - CX, z: w.z - CAR.z0 })));

  // ======================================================== 5. O QUE FICA NA GARAGEM (com colisor no layout: GARAGE_STUFF)
  // ---------- a bicicleta encostada (pelo guidão) na parede norte do depósito e as prateleiras altas em cima dela
  {
    const B = GS.bike, xc = (B.x0 + B.x1) / 2;
    drawBike((geo, color) => deco(geo, color, { x: xc, y: FLOOR, z: B.z1 - 0.42, rx: 0.17, ry: Math.PI }));
    const x0 = B.x0 - 0.3, x1 = B.x1 + 0.2, sc = (x0 + x1) / 2, zc = Z0 - 0.13;
    for (const y of [1.5, 1.95]) {
      deco(rb(x1 - x0, 0.03, 0.26, 0.008, 1).translate(sc, y - 0.03, zc), WOODS);
      for (const x of [x0 + 0.15, sc, x1 - 0.15]) {
        deco(slab(0.02, 0.16, 0.018).translate(x, y - 0.19, Z0 - 0.012), IRON);
        deco(rodAB([x, y - 0.17, Z0 - 0.02], [x, y - 0.03, Z0 - 0.21], 0.007, 4), IRON);
      }
    }
    // embaixo: o capacete, a bomba de ar, latas, a caixa de ferramentas azul e o galão
    deco(new THREE.SphereGeometry(0.12, 12, 6, 0, TAU, 0, Math.PI / 2).scale(1.15, 1, 0.95).translate(x0 + 0.24, 1.5, zc), C('#f2c14e'));
    deco(rb(0.2, 0.02, 0.06, 0.008, 1).translate(x0 + 0.36, 1.5, zc), C('#d9a441'));
    deco(cyl(0.022, 0.022, 0.4, 8).rotateZ(Math.PI / 2).translate(x0 + 0.92, 1.522, zc + 0.04), C('#d0453b'));
    deco(cyl(0.008, 0.008, 0.16, 6).rotateZ(Math.PI / 2).translate(x0 + 0.52, 1.522, zc + 0.04), STEEL);
    paintCan(x0 + 1.12, 1.5, zc, 0.085, 0.19, '#5ba35a', { seed: 21 });
    paintCan(x0 + 1.33, 1.5, zc - 0.01, 0.075, 0.17, '#e2674e', { seed: 22, drips: 3 });
    deco(rb(0.4, 0.17, 0.2, 0.02, 1).translate(x0 + 1.7, 1.5, zc), C('#3f6fb5'));
    deco(new THREE.TorusGeometry(0.05, 0.009, 4, 10, Math.PI).translate(x0 + 1.7, 1.67, zc), IRON);
    deco(rb(0.22, 0.3, 0.16, 0.03, 1).translate(x1 - 0.2, 1.5, zc), C('#d0453b'));
    deco(cyl(0.025, 0.025, 0.03, 8).translate(x1 - 0.14, 1.8, zc), C('#f2c14e'));
    // em cima: caixas, a caixa térmica e o colchonete enrolado
    carton(x0 + 0.28, 1.95, zc, 0.4, 0.26, 0.22);
    carton(x0 + 0.72, 1.95, zc, 0.3, 0.18, 0.2, '#b88d58', -0.1);
    deco(cyl(0.1, 0.1, 0.5, 12).rotateZ(Math.PI / 2).translate(x0 + 1.5, 2.05, zc), (p) => _c.set(Math.floor(p.x * 12) % 2 ? '#e2674e' : '#f4efe2'));
    deco(rb(0.34, 0.22, 0.22, 0.03, 1).translate(x1 - 0.28, 1.95, zc), C('#5f9ad0'));
    deco(rb(0.35, 0.05, 0.23, 0.02, 1).translate(x1 - 0.28, 2.16, zc), C('#f4efe2'));
  }
  // ---------- o carrinho de mão, no lado oeste (a roda para o fundo)
  {
    const B = GS.barrow, bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2;
    drawBarrow((geo, color, o = {}) => deco(geo, color, { ...o, x: bx, y: FLOOR, z: bz }));
  }
  // ---------- a pilha de pneus velhos no canto sudoeste (uma folha caída em cima)
  {
    const T = GS.tires, rr = T.r - 0.035;
    const tg = tireGeo(rr, 0.11, 20);
    const tcol = (p) => (Math.hypot(p.x, p.z) > rr * 0.97 ? _c.set(Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / TAU) * 26) % 2 ? '#35322f' : '#423c35') : _c.set('#2b2a2c'));
    deco(tg, tcol, { x: T.x, y: FLOOR + 0.11, z: T.z });
    deco(tg, tcol, { x: T.x + 0.025, y: FLOOR + 0.333, z: T.z - 0.015, ry: 0.7 });
    deco(leafGeo(0.1, 0.034).rotateY(1.1).translate(T.x + 0.2, FLOOR + 0.446, T.z + 0.12), C('#d0a945'));
  }
  // ---------- a bancada de ferramentas no muro do fundo: o tampo, a prateleira de baixo, o painel de trás com a
  // prateleira alta; em cima, a morsa, a caixa de ferramentas, a lata com o pincel e o rádio
  {
    const B = GS.bench, w = B.x1 - B.x0, d = B.z1 - B.z0, xc = (B.x0 + B.x1) / 2, zc = (B.z0 + B.z1) / 2, TOP = 0.86;
    const BW = C('#a9794d'), BWD = C('#8a5f3a');
    put(rb(w, 0.06, d, 0.012, 1).translate(xc, TOP - 0.06, zc), BW, { ao: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(rb(0.07, TOP - 0.06 - FLOOR, 0.07, 0.01, 1).translate(xc + sx * (w / 2 - 0.06), FLOOR, zc + sz * (d / 2 - 0.06)), BWD);
    deco(slab(w - 0.14, 0.09, 0.02).translate(xc, TOP - 0.15, B.z0 + 0.05), BWD);
    for (const sx of [-1, 1]) deco(slab(0.02, 0.09, d - 0.14).translate(xc + sx * (w / 2 - 0.05), TOP - 0.15, zc), BWD);
    deco(slab(w - 0.1, 0.025, d - 0.1).translate(xc, 0.2, zc), BW);
    put(rb(w, 0.92, 0.025, 0.008, 1).translate(xc, TOP, B.z1 - 0.0125), (p) => _c.copy(BW).multiplyScalar(0.9 + (Math.floor((p.x - B.x0) / 0.17) % 2) * 0.07), { ao: false });
    deco(rb(w, 0.025, 0.2, 0.006, 1).translate(xc, 1.5, B.z1 - 0.125), WOODS);
    for (const x of [B.x0 + 0.12, B.x1 - 0.12]) deco(rodAB([x, 1.36, B.z1 - 0.03], [x, 1.49, B.z1 - 0.2], 0.007, 4), IRON);
    // a morsa
    const vx = B.x0 + 0.24, vz = B.z0 + 0.17, VISE = C('#4f6f8f');
    deco(rb(0.16, 0.04, 0.18, 0.01, 1).translate(vx, TOP, vz), VISE);
    deco(rb(0.09, 0.1, 0.2, 0.015, 1).translate(vx, TOP + 0.04, vz), VISE);
    for (const dz of [-0.11, -0.04]) deco(rb(0.13, 0.07, 0.025, 0.006, 1).translate(vx, TOP + 0.13, vz + dz), C('#6d7074'));
    deco(rodAB([vx, TOP + 0.09, vz - 0.1], [vx, TOP + 0.09, vz - 0.2], 0.012, 6), STEEL);
    deco(rodAB([vx - 0.08, TOP + 0.09, vz - 0.19], [vx + 0.08, TOP + 0.09, vz - 0.19], 0.007, 5), STEEL);
    // a caixa de ferramentas vermelha, a lata com o pincel, a caneca e o rádio
    deco(rb(0.44, 0.17, 0.2, 0.02, 1).translate(xc - 0.08, TOP, zc + 0.04), C('#d0453b'));
    deco(rb(0.45, 0.035, 0.21, 0.012, 1).translate(xc - 0.08, TOP + 0.165, zc + 0.04), C('#b53a31'));
    deco(new THREE.TorusGeometry(0.055, 0.009, 4, 10, Math.PI).translate(xc - 0.08, TOP + 0.2, zc + 0.04), IRON);
    paintCan(B.x1 - 0.66, TOP, zc - 0.1, 0.07, 0.15, '#7fb2d9', { seed: 31, open: true, drips: 3 });
    deco(rodAB([B.x1 - 0.68, TOP + 0.05, zc - 0.1], [B.x1 - 0.6, TOP + 0.27, zc - 0.14], 0.007, 5), C('#b98a56'));
    deco(cyl(0.035, 0.03, 0.08, 10).translate(B.x1 - 0.48, TOP, zc - 0.16), C('#f4efe2'));
    const rx = B.x1 - 0.26, rz = B.z1 - 0.12;
    deco(rb(0.28, 0.17, 0.09, 0.025, 1).translate(rx, TOP, rz), C('#e8dcc0'));
    deco(new THREE.CircleGeometry(0.055, 14).rotateY(Math.PI).translate(rx - 0.055, TOP + 0.085, rz - 0.047), C('#5a4a3a'));
    deco(rb(0.09, 0.03, 0.006, 0.003, 1).translate(rx + 0.07, TOP + 0.1, rz - 0.046), C('#f2c14e'));
    for (const dx of [0.04, 0.1]) deco(cyl(0.012, 0.012, 0.012, 8).rotateX(Math.PI / 2).translate(rx + dx, TOP + 0.055, rz - 0.045), C('#5a4a3a'));
    deco(rodAB([rx + 0.11, TOP + 0.17, rz], [rx + 0.2, TOP + 0.46, rz + 0.02], 0.004, 4), STEEL);
    // as gavetinhas coloridas no painel e, na prateleira alta, potes, latas de spray e uma caixa
    ['#d0453b', '#f2c14e', '#3f7fbf', '#5ba35a', '#f08a3c'].forEach((c, i) => deco(rb(0.15, 0.09, 0.1, 0.012, 1).translate(B.x0 + 0.3 + i * 0.19, 1.1, B.z1 - 0.076), C(c)));
    for (let i = 0; i < 3; i++) jar(B.x0 + 0.16 + i * 0.12, 1.5, B.z1 - 0.12, ['#d0453b', '#3f7fbf', '#f2c14e'][i], ['#8d7b62', '#9aa3a8', '#7f6a52'][i]);
    for (let i = 0; i < 2; i++) {
      deco(cyl(0.03, 0.03, 0.17, 10).translate(B.x0 + 0.62 + i * 0.09, 1.5, B.z1 - 0.12), C(i ? '#3f7fbf' : '#5ba35a'));
      deco(cyl(0.012, 0.012, 0.02, 6).translate(B.x0 + 0.62 + i * 0.09, 1.67, B.z1 - 0.12), C('#f4efe2'));
    }
    carton(xc + 0.22, 1.5, B.z1 - 0.12, 0.26, 0.14, 0.17);
    paintCan(B.x1 - 0.3, 1.5, B.z1 - 0.12, 0.075, 0.17, '#f2c14e', { seed: 33 });
    // embaixo: o galão, a caixa de papelão e os frascos de óleo
    deco(rb(0.2, 0.3, 0.32, 0.04, 1).translate(B.x0 + 0.3, 0.225, zc), C('#c9362f'));
    deco(cyl(0.03, 0.03, 0.04, 8).translate(B.x0 + 0.3, 0.52, zc - 0.1), C('#2a2a2e'));
    carton(xc + 0.05, 0.225, zc, 0.42, 0.28, 0.34, '#c69a62', 0.06);
    for (let i = 0; i < 3; i++) deco(cyl(0.04, 0.045, 0.2, 8).translate(B.x1 - 0.42 + i * 0.11, 0.225, zc - 0.05 + (i % 2) * 0.08), C(['#2f5fb8', '#e2a83a', '#3a3a3e'][i]));
  }

  // ======================================================== 6. PRIMAVERA, FOLHAS E FLORES DA TEMPESTADE
  const FOL = { dark: '#2f5a24', mid: '#4f8a35', light: '#8cb84e' };
  const BRACT = [C('#d63a8e'), C('#e85aa8'), C('#b52f78')];
  {
    // o caule enrolado no pilar da frente (dentro do colisor dele) e correndo pela viga
    const px = CP.x0, pz = CP.z0, by = BEAMS[0].y0, pts = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28, a = u * TAU * 2.2 + 0.8;
      pts.push([px + Math.cos(a) * 0.085, 0.22 + u * (by - 0.24), pz + Math.sin(a) * 0.085]);
    }
    deco(tubeAlong(pts, 0.016, 5, 70), C('#6a4a30'));
    deco(tubeAlong([[px + 0.05, by - 0.02, pz - 0.085], [px + 0.4, by + 0.08, pz - 0.09], [px + 0.8, by + 0.04, pz - 0.085], [px + 1.3, by + 0.11, pz - 0.09], [px + 1.7, by + 0.08, pz - 0.085]], 0.013, 5, 30), C('#6a4a30'));
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
    addBlob(px + 0.05, by - 0.16, pz - 0.1, 0.2);
    // pendurada na frente da viga e espalhada em cima das telhas
    for (const [dx, dy, r] of [[0.25, -0.08, 0.15], [0.7, -0.14, 0.14], [1.15, -0.06, 0.13], [1.55, -0.1, 0.11]]) addBlob(px + dx, by + dy, pz - 0.07 - r * 1.05, r);
    for (const [dx, dz, r] of [[-0.05, 0.1, 0.26], [0.45, 0.02, 0.24], [0.9, 0.2, 0.22], [1.3, 0.05, 0.18], [0.2, 0.55, 0.2]]) {
      const z = pz + dz;
      addBlob(px + dx, sheetTop(z) + r * 0.62, z, r, 0.55);
    }
    deco(foliageCluster(blobs, { detail: 1, amp: 0.2, freq: 3.1, seed: 4, ...FOL }), null, { slot: 'foliage' });
    const fg = new THREE.IcosahedronGeometry(0.028, 0);
    flowers.forEach((f, i) => deco(fg, BRACT[i % 3], { slot: 'foliage', x: f[0], y: f[1], z: f[2], rx: i, ry: i * 1.7 }));
  }
  // folhas, brácteas e um galho em cima das telhas (quem olha do terraço da torre vê o telhado depois da tempestade)
  const LEAF_COLS = ['#5d8a3a', '#7d9c3f', '#a7ad46', '#d0a945', '#a86f3d', '#8a5a34'].map(C);
  const leafGs = [leafGeo(0.09, 0.03), leafGeo(0.07, 0.026), leafGeo(0.11, 0.036)];
  const bractG = bractGeo(0.035);
  {
    const Rl = rng(55);
    for (let i = 0; i < 18; i++) {
      const x = lerp(CP.x0 + 0.3, CP.x1, Rl()), z = lerp(RZ0 + 0.15, RZ1 - 0.3, Rl());
      const g = i % 4 === 3 ? bractG : leafGs[i % 3];
      deco(g, i % 4 === 3 ? BRACT[i % 3] : LEAF_COLS[i % 6], { x, y: sheetTop(z) + 0.004, z, rx: -THETA, ry: Rl() * TAU });
    }
    const gx = CX + 0.7, gz = CP.z0 + 2.0;
    const twig = [[gx - 0.35, gz - 0.2], [gx - 0.1, gz - 0.05], [gx + 0.15, gz + 0.02], [gx + 0.42, gz + 0.16]].map(([x, z]) => [x, sheetTop(z) + 0.012, z]);
    deco(tubeAlong(twig, 0.012, 5, 16), C('#6b4b33'));
    for (const [x, z, a, ci] of [[gx + 0.05, gz - 0.3, 0.6, 0], [gx + 0.23, gz + 0.2, 2.0, 1], [gx - 0.3, gz - 0.24, 1.2, 0], [gx + 0.44, gz + 0.2, 2.6, 2]]) {
      deco(leafGs[2], LEAF_COLS[ci], { x, y: sheetTop(z) + 0.02, z, rx: -THETA, ry: a });
    }
  }
  // no piso: folhas e brácteas fora das manchas, das marcas, das poças, das rodas, dos móveis e do caminho da corda
  {
    const ax = ROPE.gap.x, az = ROPE.gap.z, dirx = ROPE.end.x - ax, dirz = ROPE.end.z - az, dl = Math.hypot(dirx, dirz);
    const vx = dirx + (dirx / dl) * (ROPE.pull + 0.15), vz = dirz + (dirz / dl) * (ROPE.pull + 0.15);
    const nearRope = (x, z) => {
      const t = clamp01(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz));
      return Math.hypot(x - (ax + vx * t), z - (az + vz * t)) < 0.2;
    };
    const inRect = (R, x, z, m) => x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m;
    const blocked = (x, z) => {
      if (stains.some((s) => Math.hypot(x - s.x, z - s.z) < s.r * 1.35 + 0.06)) return true;
      if (PUDDLES.some((P) => Math.hypot(x - P.x, z - P.z) < P.r * 1.3 + 0.06)) return true;
      if (WHEELS.some((w) => Math.abs(x - w.x) < CAR.wheelW / 2 + 0.1 && Math.abs(z - w.z) < CAR.wheelR + 0.1)) return true;
      if (WHEELS.some((w) => Math.abs(x - w.x) < 0.14 && z < w.z && w.z < WFZ + 0.1)) return true;
      if (BAY.some((b) => Math.abs(x - b) < 0.12 && z > CAR.z0 - 1.3)) return true;
      if (POSTS.some((P) => Math.hypot(x - P.x, z - P.z) < 0.22)) return true;
      if (inRect(GS.bike, x, z, 0.08) || inRect(GS.barrow, x, z, 0.08) || inRect(GS.bench, x, z, 0.08)) return true;
      if (Math.hypot(x - GS.tires.x, z - GS.tires.z) < GS.tires.r + 0.08) return true;
      if (Math.hypot(x - COIL.x, z - COIL.z) < COIL.r + 0.3) return true;
      if (x > X0 - 0.35 && z > Z0 - 0.08) return true; // o depósito, a mangueira e a frente da porta
      if (z < SL.z0 + 0.25) return true; // a canaleta
      return nearRope(x, z);
    };
    const Rl = rng(29);
    let n = 0;
    for (let tries = 0; n < 46 && tries < 1400; tries++) {
      // mais na frente e no lado oeste (por onde o vento entrou); o resto espalhado
      const zone = n % 3;
      const x = zone === 1 ? lerp(SL.x0 + 0.1, CP.x0 + 1.6, Math.pow(Rl(), 1.4)) : lerp(SL.x0 + 0.1, SL.x1 - 0.1, Rl());
      const z = zone === 0 ? lerp(SL.z0 + 0.3, CP.z0 + 1.8, Math.pow(Rl(), 1.3)) : lerp(SL.z0 + 0.3, wallN - 0.12, Rl());
      if (blocked(x, z)) continue;
      const bract = x < CP.x0 + 2.6 && z < CP.z0 + 2.4 && n % 2 === 0;
      put(bract ? bractG : leafGs[n % 3], bract ? BRACT[n % 3] : LEAF_COLS[(n * 5) % 6], { slot: 'ground', x, y: D2, z, ry: Rl() * TAU, ao: false });
      n++;
    }
  }

  // ======================================================== 7. A LUZ DA MANHÃ
  // os vidros e as telhas translúcidas (uma malha; não faz sombra: o sol passa)
  {
    const parts = clear.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
      return n;
    });
    const pane = new THREE.Mesh(mergeGeometries(parts), mat('recanto-translucido', () => new THREE.MeshStandardMaterial({ color: '#eaf4fb', transparent: true, opacity: 0.3, roughness: 0.2, metalness: 0, depthWrite: false, side: THREE.DoubleSide })));
    pane.name = 'garagem:translucido';
    pane.castShadow = false;
    pane.receiveShadow = false;
    pane.renderOrder = 2;
    root.add(pane);
  }
  // o raio de sol da janelinha do depósito até o piso (aditivo, sem profundidade: só clareia)
  const sun = L.SUN?.direction;
  if (sun && sun[1] > 0.1 && sun[0] > 0.1) {
    const d = new THREE.Vector3(-sun[0], -sun[1], -sun[2]).normalize();
    const yF = FLOOR + 0.004, m = 0.03;
    const top = [[WIN.z0 + m, WIN.y0 + m], [WIN.z1 - m, WIN.y0 + m], [WIN.z1 - m, WIN.y1 - m], [WIN.z0 + m, WIN.y1 - m]].map(([z, y]) => new THREE.Vector3(X1i, y, z));
    const bot = top.map((p) => p.clone().addScaledVector(d, (p.y - yF) / -d.y));
    const pos = [], col = [];
    const vert = (p, k) => { pos.push(p.x, p.y, p.z); col.push(k, k * 0.9, k * 0.66); };
    const quad = (a, b, c, e, ka, kb) => { vert(a, ka); vert(b, ka); vert(c, kb); vert(a, ka); vert(c, kb); vert(e, kb); };
    for (let i = 0; i < 4; i++) quad(top[i], top[(i + 1) % 4], bot[(i + 1) % 4], bot[i], 0.15, 0.05);
    quad(bot[0], bot[1], bot[2], bot[3], 0.2, 0.2);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const shaft = new THREE.Mesh(sg, mat('recanto-raio-de-sol', () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
    shaft.name = 'deposito:raio-de-sol';
    shaft.castShadow = false;
    shaft.receiveShadow = false;
    shaft.renderOrder = 3;
    root.add(shaft);
  }

  // ======================================================== 8. O QUE SE MEXE
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
  const NI = 18, NO = 46, NP = NI + NO - 1;
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
    const amp = 0.1 * (1 - rope.k) * (1 - 0.85 * gk);
    const lift = Math.max(0, _end.y - (FLOOR + ROPE_R));
    const rise = clamp01(lift / 0.5) * 0.45;
    for (let i = 0; i < NO; i++) {
      const u = i / (NO - 1);
      const w = Math.sin(u * Math.PI * 5 + 0.6) * Math.sin(u * Math.PI) * amp;
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
