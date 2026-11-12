// A BORBOLETA do Modo História (pedido do usuário em 2026-11-11: "melhore o modelo 3d, gráfico da borboleta"): a do
// fechamento (a Rhaenyra sai atrás dela para o lado errado) e as do cenário, que voam em volta dos canteiros e que a
// Rhaenyra persegue quando se distrai (src/story/scene/lesada.js). Uma borboleta de desenho, bonita de perto e de longe:
//  - ASAS com forma de verdade: a da frente com a ponta (o ápice) para a frente e a borda da frente quase reta; a de trás
//    redonda, com a borda ondulada e um tiquinho por baixo da da frente. O desenho é pintado por vértice: as nervuras, a
//    margem escura com as pintinhas brancas, a mancha do ápice. Três espécies: 'monarca' (laranja e preta), 'azul' (a
//    morfo, azul-elétrico com a borda preta) e 'limao' (amarela, com a pinta laranja e a pontinha marrom);
//  - CORPO peludinho (o tórax, o abdome com anéis e a cabeça com os olhos) e as ANTENAS finas com a pontinha em clava;
//  - BATER DE ASAS rápido (~9 por segundo), com o corpo subindo a cada batida para baixo e balançando o nariz; de vez em
//    quando ela plana um instante de asas abertas; pousada, fica de asas fechadas em pé e abre devagar de vez em quando;
//  - VOO em zigue-zague (duas ondas fora de compasso para os lados e uma para cima e para baixo), com inércia e o corpo
//    virando para onde voa e inclinando na curva. Nada atravessa nada: o passo que entraria num colisor (blocked) desvia
//    para um lado ou espera.
// Barata para o celular: 3 malhas por borboleta (o corpo e uma asa de cada lado, a da frente e a de trás juntas), um
// material só (cor por vértice, as duas faces, sem textura e sem sombra), as geometrias de cada espécie divididas entre
// todas (createButterflyKit) e nada alocado por quadro.
//
// createButterfly({ kit, kind, scale, seed, blocked }) → { object, kind, update(dt), place(p, yaw), wander(c, r, o),
//   flyTo(p, o), perch(p, yaw), drive(), hide(), mode, flying, wing, pos }
//   drive(): quem move é a cena (object.position a cada quadro); ela bate as asas e vira para onde está indo.
// createButterflies({ root, world, layout }) → { hero, flock, visitor, all, update(dt, o), nearest(x, z, r), reset(),
//   dispose() }: a do fechamento (hero, escondida), as do cenário (flock, perto dos canteiros, onde couber) e a que vem
//   de fora para a Rhaenyra perseguir (visitor).
import * as THREE from 'three';
import { mergeGeometries } from '../../world/util.js';

const TAU = Math.PI * 2;
const { clamp, lerp } = THREE.MathUtils;

/** As espécies (a ordem é a das borboletas do cenário). */
export const BUTTERFLY_KINDS = Object.freeze(['monarca', 'azul', 'limao']);
/** A envergadura (m, de ponta a ponta das asas abertas) na escala 1. */
export const BUTTERFLY_SPAN = 0.15;

// ------------------------------------------------------------------------------------------------ as asas
/** Os anéis do leque (fração do raio): mais juntos perto da borda, onde ficam as pintinhas. */
const RINGS = [0, 0.12, 0.26, 0.4, 0.54, 0.66, 0.76, 0.84, 0.9, 0.95, 1];
const RING_DOT = RINGS.indexOf(0.9);
/**
 * As duas asas de um lado (+x), em leque a partir da raiz: θ é o ângulo no plano das asas, de +x (para fora) para +z
 * (para a frente); keys é o raio (× R) ao longo do leque (u de 0 a 1, de a0 a a1); veins são as colunas das nervuras.
 */
const WING = {
  f: { a0: -0.22, a1: 1.06, n: 26, R: 0.081, root: [0.0016, 0.0042], keys: [[0, 0.5], [0.2, 0.66], [0.45, 0.86], [0.66, 0.97], [0.78, 1.0], [0.88, 0.84], [0.95, 0.5], [1, 0.14]], veins: [3, 7, 11, 15, 19, 22], lift: 0.0006 },
  h: { a0: -1.52, a1: -0.06, n: 20, R: 0.062, root: [0.0016, -0.0032], keys: [[0, 0.28], [0.12, 0.6], [0.34, 0.88], [0.55, 0.97], [0.75, 0.93], [0.9, 0.8], [1, 0.62]], veins: [3, 7, 11, 15, 18], lift: -0.0008 },
};
/** Curva suave por quadros-chave [[u, v], ...]. */
function keyed(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) {
      const [x0, y0] = keys[i - 1], [x1, y1] = keys[i];
      const k = (u - x0) / (x1 - x0);
      return y0 + (y1 - y0) * k * k * (3 - 2 * k);
    }
  }
  return keys[keys.length - 1][1];
}

const _c = new THREE.Color(), _d = new THREE.Color();
/** Mistura duas cores (hex) em `out`. */
const mix = (out, a, b, k) => out.set(a).lerp(_d.set(b), clamp(k, 0, 1));
/**
 * O desenho de cada espécie no ponto do leque: wing 'f' (a da frente) ou 'h' (a de trás), u ao longo do leque (0 atrás,
 * 1 na frente), rho do centro à borda, i a coluna e ri o anel (as pintinhas caem em vértices).
 */
function paint(kind, wing, u, rho, i, ri, out) {
  const W = WING[wing];
  const vein = W.veins.includes(i) && rho > 0.1 && rho < 0.86;
  const dot = ri === RING_DOT && i % 2 === 1 && i > 1 && i < W.n - 1;
  if (kind === 'azul') {
    if (rho <= 0.12) return out.set('#0d1a3d');
    if (rho >= 0.84 || (wing === 'f' && u > 0.86 && rho > 0.3)) return dot && !(wing === 'f' && u > 0.86) ? out.set('#f2f7ff') : out.set('#0a0c18');
    if (vein) return out.set('#123b8c');
    // o azul-elétrico, mais claro (quase ciano) no meio da asa
    if (rho < 0.4) return mix(out, '#1748b8', '#1f7cff', (rho - 0.12) / 0.28);
    if (rho < 0.66) return mix(out, '#1f7cff', '#56d8ff', (rho - 0.4) / 0.26);
    return mix(out, '#56d8ff', '#1d63e0', (rho - 0.66) / 0.18);
  }
  if (kind === 'limao') {
    if (rho <= 0.12) return out.set('#b9b44a');
    if (rho >= 0.95) return out.set('#7a5a1c');
    // a pinta laranja no meio de cada asa
    const spot = ri === RINGS.indexOf(0.54) && Math.abs(u - 0.52) < 0.06;
    if (spot) return out.set('#ff7f1c');
    if (wing === 'f' && u > 0.7 && rho >= 0.84) return out.set('#8a6420');
    if (vein) return out.set('#dcb92c');
    return mix(out, '#e4e65a', '#ffe24a', (rho - 0.12) / 0.3);
  }
  // monarca
  if (rho <= 0.12) return out.set('#3a2a1e');
  const apex = wing === 'f' && u >= 0.7 && rho >= 0.58;
  if (rho >= 0.84 || apex) {
    if (dot) return out.set('#fff4dc');
    // as pintas do ápice: duas fileiras, creme e laranja-clara
    if (apex && rho < 0.84 && i % 3 === 1) return out.set(ri === RINGS.indexOf(0.66) ? '#ffd27a' : '#fff1d0');
    return out.set('#17110d');
  }
  if (vein || (wing === 'h' && rho > 0.78)) return out.set('#24170f');
  if (rho < 0.4) return mix(out, '#d9650a', '#f39424', (rho - 0.12) / 0.28);
  if (rho < 0.66) return mix(out, '#f39424', '#f8ac3a', (rho - 0.4) / 0.26);
  return mix(out, '#f8ac3a', '#ee8516', (rho - 0.66) / 0.18);
}

/** As asas de um lado (+x) de uma espécie, numa geometria só (cor por vértice). */
function buildWing(kind) {
  const pos = [], col = [], idx = [];
  let base = 0;
  for (const wing of /** @type {const} */ (['f', 'h'])) {
    const W = WING[wing];
    const [rx, rz] = W.root;
    // o centro do leque e, para cada coluna, os anéis
    pos.push(rx, W.lift, rz);
    paint(kind, wing, 0.5, 0, -1, 0, _c);
    col.push(_c.r, _c.g, _c.b);
    for (let i = 0; i <= W.n; i++) {
      const u = i / W.n;
      const th = W.a0 + (W.a1 - W.a0) * u;
      let r = W.R * keyed(W.keys, u);
      // a borda de trás ondulada (a da frente é lisa)
      if (wing === 'h') r *= 1 - 0.05 * Math.abs(Math.sin(u * Math.PI * 5));
      const cx = Math.cos(th), cz = Math.sin(th);
      for (let ri = 1; ri < RINGS.length; ri++) {
        const rho = RINGS[ri];
        const d = r * rho;
        // a asa encurva um tiquinho para cima na ponta (como de verdade)
        pos.push(rx + cx * d, W.lift + 0.11 * d * d / W.R, rz + cz * d);
        paint(kind, wing, u, rho, i, ri, _c);
        col.push(_c.r, _c.g, _c.b);
      }
    }
    const nr = RINGS.length - 1;
    const at = (i, ri) => base + 1 + i * nr + (ri - 1);
    for (let i = 0; i < W.n; i++) {
      idx.push(base, at(i, 1), at(i + 1, 1));
      for (let ri = 1; ri < nr; ri++) {
        const a = at(i, ri), b = at(i + 1, ri), c = at(i, ri + 1), d = at(i + 1, ri + 1);
        idx.push(a, c, d, a, d, b);
      }
    }
    base += 1 + (W.n + 1) * nr;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.name = `borboleta-asas-${kind}`;
  return g;
}

// ------------------------------------------------------------------------------------------------ o corpo
/** Pinta por vértice (cor fixa ou fn(x, y, z) → Color) e tira o uv (para fundir). */
function tint(geo, color) {
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const P = geo.attributes.position, col = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) {
    const c = typeof color === 'function' ? color(P.getX(i), P.getY(i), P.getZ(i)) : _c.set(color);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
/** O corpo inteiro numa geometria: tórax peludo, abdome com anéis, cabeça, olhos e antenas com a pontinha em clava. */
function buildBody() {
  const ell = (rx, ry, rz, w = 9, h = 7) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
  const parts = [
    // o tórax: escuro, mais claro em cima (o pelinho pegando luz)
    tint(ell(0.0058, 0.0056, 0.0105, 10, 7).translate(0, 0.0004, 0.0016), (x, y) => mix(_c, '#2a2119', '#5a4632', y / 0.006)),
    // o abdome: afina para trás, com anéis claros
    tint(ell(0.0042, 0.0042, 0.0205, 9, 9).translate(0, -0.0006, -0.0196), (x, y, z) => mix(_c, '#241b14', '#8a6a3a', 0.45 * Math.max(0, Math.sin(z * 900)) + 0.15 * (y > 0 ? 1 : 0))),
    tint(ell(0.0047, 0.0045, 0.0045, 8, 6).translate(0, 0.0012, 0.0131), '#2b2219'),
  ];
  for (const s of [-1, 1]) {
    // os olhos grandes e redondos
    parts.push(tint(ell(0.0024, 0.0026, 0.0024, 7, 5).translate(s * 0.0034, 0.0019, 0.0152), '#14100c'));
    // a antena: fininha, para a frente, para cima e para fora, com a pontinha grossa
    const a = new THREE.Vector3(s * 0.0014, 0.0042, 0.0158), b = new THREE.Vector3(s * 0.0098, 0.0152, 0.0372);
    const len = a.distanceTo(b);
    const rod = new THREE.CylinderGeometry(0.00045, 0.00055, len, 4, 1, true);
    rod.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    rod.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(tint(rod, '#1b1510'));
    parts.push(tint(ell(0.0011, 0.0011, 0.0017, 5, 4).translate(b.x, b.y, b.z), '#1b1510'));
  }
  // as perninhas (três de cada lado), dobradas embaixo do tórax
  for (const s of [-1, 1]) {
    for (const z of [0.0055, 0.0015, -0.0025]) {
      const leg = new THREE.CylinderGeometry(0.0003, 0.0003, 0.0072, 3, 1, true).rotateZ(s * 0.9).rotateX(-0.35).translate(s * 0.004, -0.0048, z);
      parts.push(tint(leg, '#1b1510'));
    }
  }
  for (const p of parts) if (!p.index) p.setIndex([...Array(p.attributes.position.count).keys()]);
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  g.computeVertexNormals();
  g.name = 'borboleta-corpo';
  return g;
}

/**
 * As peças divididas por todas as borboletas: o material (um só, cor por vértice e as duas faces), o corpo e as asas de
 * cada espécie (feitas na primeira vez que alguém pede).
 */
export function createButterflyKit() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.58, metalness: 0 });
  material.name = 'borboleta';
  const body = buildBody();
  /** @type {Record<string, THREE.BufferGeometry>} */
  const wings = {};
  return {
    material, body,
    /** As asas de um lado (+x) da espécie. @param {string} kind */
    wing(kind) {
      const k = BUTTERFLY_KINDS.includes(kind) ? kind : 'monarca';
      return (wings[k] ??= buildWing(k));
    },
    dispose() {
      material.dispose();
      body.dispose();
      for (const g of Object.values(wings)) g.dispose();
    },
  };
}

// ------------------------------------------------------------------------------------------------ uma borboleta
/** Um gerador pequeno com semente (as borboletas não andam em compasso, e os testes se repetem). */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** Quanto tempo ela leva encolhendo até sumir (s), quando vai embora. */
const FADE = 0.45;

/**
 * Uma borboleta. blocked(x, y, z): o ponto do voo entra em algum colisor? (sem ele, voa livre.)
 * @param {{ kit: ReturnType<typeof createButterflyKit>, kind?: string, scale?: number, seed?: number,
 *   blocked?: ((x: number, y: number, z: number) => boolean) | null }} o
 */
export function createButterfly({ kit, kind = 'monarca', scale = 1, seed = 1, blocked = null }) {
  const rand = rng(seed);
  const object = new THREE.Group();
  object.name = `borboleta:${kind}`;
  object.rotation.order = 'YXZ';
  // o corpo (sobe e desce a cada batida e inclina) leva as asas
  const body = new THREE.Group();
  body.name = 'borboleta-corpo';
  body.rotation.order = 'YXZ';
  object.add(body);
  const trunk = new THREE.Mesh(kit.body, kit.material);
  trunk.name = 'borboleta-corpo';
  body.add(trunk);
  const wingGeo = kit.wing(kind);
  const wings = [1, -1].map((s) => {
    const g = new THREE.Group();
    g.name = `borboleta-asa-${s > 0 ? 'esquerda' : 'direita'}`;
    g.position.set(s * 0.0012, 0.0016, 0);
    g.scale.x = s; // a da direita é a da esquerda espelhada (a mesma geometria)
    const m = new THREE.Mesh(wingGeo, kit.material);
    m.name = 'borboleta-asas';
    g.add(m);
    body.add(g);
    return g;
  });
  object.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  object.scale.setScalar(scale);
  object.visible = false;

  const S = {
    mode: /** @type {'hidden' | 'drive' | 'wander' | 'to' | 'perch'} */ ('hidden'),
    t: rand() * 20, ph: rand() * TAU, amp: 1, glide: 0, glideIn: 0.8 + rand() * 1.5, wing: 0.4,
    vel: new THREE.Vector3(), yaw: 0, roll: 0, last: new THREE.Vector3(), hasLast: false,
    anchor: new THREE.Vector3(), radius: 0.5, target: new THREE.Vector3(), speed: 0.8, zig: 1,
    then: /** @type {'wander' | 'hover' | 'hide' | 'perch' | 'none'} */ ('wander'), thenR: 0.3, arrived: false,
    openT: 2 + rand() * 2, open: 0, fade: 0,
    p1: rand() * TAU, p2: rand() * TAU, p3: rand() * TAU, p4: rand() * TAU,
  };
  const pos = object.position;
  const _w = new THREE.Vector3();

  /** O passo de voo até (tx, ty, tz) a `speed` m/s, em zigue-zague, sem entrar em nada. */
  function fly(tx, ty, tz, speed, dt) {
    const dx = tx - pos.x, dy = ty - pos.y, dz = tz - pos.z;
    const d = Math.hypot(dx, dy, dz);
    const near = clamp(d / 0.3, 0, 1); // perto do alvo, devagar (e o zigue-zague diminui)
    const hl = Math.hypot(dx, dz) || 1;
    // o lado (perpendicular ao rumo, no chão): duas ondas fora de compasso; e o sobe e desce
    const sx = dz / hl, sz = -dx / hl;
    const zig = (Math.sin(S.t * 4.3 + S.p1) * 0.75 + Math.sin(S.t * 7.7 + S.p2) * 0.35) * S.zig * (0.35 + 0.65 * near);
    const bob = Math.sin(S.t * 2.7 + S.p3) * 0.4 + Math.sin(S.t * 6.1 + S.p4) * 0.15;
    const v = speed * (0.25 + 0.75 * near);
    const inv = d > 1e-4 ? 1 / d : 0;
    _w.set(dx * inv * v + sx * zig * speed * 0.8, dy * inv * v + bob * speed * 0.45, dz * inv * v + sz * zig * speed * 0.8);
    S.vel.lerp(_w, 1 - Math.exp(-dt * 3.2));
    // o passo: entrando em algo, tenta desviar para um lado ou para o outro; sem saída, espera (e recua um pouco)
    let nx = pos.x + S.vel.x * dt, ny = clamp(pos.y + S.vel.y * dt, 0.16, 4.2), nz = pos.z + S.vel.z * dt;
    if (blocked?.(nx, ny, nz)) {
      let ok = false;
      for (const a of [1.1, -1.1, 2.2, -2.2]) {
        const c = Math.cos(a), s = Math.sin(a);
        const vx = S.vel.x * c + S.vel.z * s, vz = -S.vel.x * s + S.vel.z * c;
        const px = pos.x + vx * dt, pz = pos.z + vz * dt;
        if (!blocked(px, ny, pz)) { S.vel.x = vx; S.vel.z = vz; nx = px; nz = pz; ok = true; break; }
      }
      if (!ok) { S.vel.multiplyScalar(-0.3); nx = pos.x; ny = pos.y; nz = pos.z; }
    }
    pos.set(nx, ny, nz);
    return d;
  }

  /** O corpo vira para onde ela voa e inclina na curva. */
  function face(vx, vz, dt) {
    if (Math.hypot(vx, vz) < 0.04) return;
    const want = Math.atan2(vx, vz);
    const turn = wrapA(want - S.yaw);
    S.yaw = wrapA(S.yaw + turn * (1 - Math.exp(-dt * 7)));
    S.roll += (clamp(-turn * 0.8, -0.45, 0.45) - S.roll) * (1 - Math.exp(-dt * 6));
  }

  function update(dt) {
    if (!object.visible || dt <= 0) return;
    S.t += dt;
    const flying = S.mode !== 'perch';
    if (S.mode === 'drive') {
      // a cena move: o rumo vem do quanto ela andou
      if (S.hasLast) face((pos.x - S.last.x) / dt, (pos.z - S.last.z) / dt, dt);
    } else if (S.mode === 'wander') {
      // em volta do lugar dela: um alvo que passeia devagar (as figuras de Lissajous), com o zigue-zague por cima
      const R = S.radius;
      const tx = S.anchor.x + R * Math.sin(S.t * 0.53 + S.p1) * Math.cos(S.t * 0.19 + S.p4);
      const tz = S.anchor.z + R * Math.sin(S.t * 0.41 + S.p2);
      const ty = S.anchor.y + 0.2 * Math.sin(S.t * 0.67 + S.p3);
      fly(tx, ty, tz, S.speed, dt);
      face(S.vel.x, S.vel.z, dt);
    } else if (S.mode === 'to') {
      const d = fly(S.target.x, S.target.y, S.target.z, S.speed, dt);
      face(S.vel.x, S.vel.z, dt);
      if (d < 0.12 && !S.arrived) {
        S.arrived = true;
        if (S.then === 'wander') api.wander(S.target, S.thenR, { speed: Math.min(S.speed, 0.6) });
        else if (S.then === 'hover') api.wander(S.target, 0.06, { speed: 0.35 });
        else if (S.then === 'hide') S.fade = FADE; // some encolhendo, lá longe (nada de sumir de uma vez)
        else if (S.then === 'perch') api.perch(S.target, S.yaw);
      }
    }
    if (S.fade > 0) {
      S.fade -= dt;
      object.scale.setScalar(scale * Math.max(0.001, S.fade / FADE));
      if (S.fade <= 0) { api.hide(); return; }
    }
    S.last.copy(pos);
    S.hasLast = true;
    object.rotation.set(0, S.yaw, 0);

    // as asas: batendo (com o planar de vez em quando) ou, pousada, fechadas em pé e abrindo devagar
    if (flying) {
      S.glideIn -= dt;
      if (S.glide > 0) S.glide -= dt;
      else if (S.glideIn <= 0 && S.mode !== 'drive') { S.glide = 0.16 + 0.22 * rand(); S.glideIn = 1.0 + 1.8 * rand(); }
      S.amp += ((S.glide > 0 ? 0 : 1) - S.amp) * (1 - Math.exp(-dt * 12));
      const freq = 8.6 + 1.4 * Math.sin(S.t * 0.7 + S.p1);
      S.ph += TAU * freq * dt;
      // a batida para baixo é a que levanta: o corpo sobe no meio dela (e o nariz desce um pouco)
      const sn = Math.sin(S.ph);
      S.wing = lerp(0.16, 0.42, S.amp) + S.amp * 0.84 * sn;
      body.position.y = 0.011 * S.amp * -Math.cos(S.ph);
      body.rotation.set(-0.24 + 0.09 * S.amp * Math.sin(S.ph + 0.6), 0, S.roll);
    } else {
      S.openT -= dt;
      if (S.openT <= 0) { S.open = 0.0001; S.openT = 2.4 + 2.6 * rand(); }
      if (S.open > 0) { S.open += dt; if (S.open > 0.9) S.open = 0; }
      const op = S.open > 0 ? Math.sin(Math.PI * S.open / 0.9) : 0;
      S.wing += (1.42 - 1.15 * op - S.wing) * (1 - Math.exp(-dt * 10));
      body.position.y = 0;
      body.rotation.set(-0.05, 0, 0);
    }
    wings[0].rotation.z = S.wing;
    wings[1].rotation.z = -S.wing;
  }

  const api = {
    object, kind,
    update,
    /** Põe no lugar, voando parada ali (rumo yaw). */
    place(p, yaw = S.yaw) {
      pos.set(p.x, p.y, p.z);
      S.yaw = yaw;
      S.vel.set(0, 0, 0);
      S.last.copy(pos);
      S.hasLast = true;
      object.visible = true;
      if (S.mode === 'hidden') {
        S.mode = 'wander';
        S.anchor.copy(pos);
        S.radius = 0.15;
      }
      return api;
    },
    /** Voa em volta de c (raio r), devagar. */
    wander(c, r = 0.5, { speed = 0.55 } = {}) {
      if (!object.visible) api.place(c);
      if (S.fade > 0) { S.fade = 0; object.scale.setScalar(scale); }
      S.mode = 'wander';
      S.anchor.set(c.x, c.y, c.z);
      S.radius = r;
      S.speed = speed;
      S.zig = 1;
      return api;
    },
    /**
     * Voa até p e depois: 'wander' (em volta dele, raio radius), 'hover' (paradinha ali), 'hide' (some) ou 'perch'.
     * @param {{ x: number, y: number, z: number }} p @param {{ speed?: number, then?: 'wander' | 'hover' | 'hide' | 'perch' | 'none', radius?: number, zig?: number }} [o]
     */
    flyTo(p, { speed = 0.9, then = 'wander', radius = 0.3, zig = 1 } = {}) {
      if (!object.visible) api.place(p);
      if (S.fade > 0) { S.fade = 0; object.scale.setScalar(scale); }
      S.mode = 'to';
      S.target.set(p.x, p.y, p.z);
      S.speed = speed;
      S.then = then;
      S.thenR = radius;
      S.zig = zig;
      S.arrived = false;
      return api;
    },
    /** Pousada em p (asas fechadas em pé, abrindo de vez em quando). */
    perch(p, yaw = S.yaw) {
      pos.set(p.x, p.y, p.z);
      S.yaw = yaw;
      S.mode = 'perch';
      S.vel.set(0, 0, 0);
      object.visible = true;
      return api;
    },
    /** A cena move (object.position): ela só bate as asas e vira para onde vai. */
    drive() {
      S.mode = 'drive';
      S.hasLast = false;
      return api;
    },
    hide() {
      object.visible = false;
      S.mode = 'hidden';
      S.vel.set(0, 0, 0);
      S.fade = 0;
      object.scale.setScalar(scale);
      return api;
    },
    get mode() { return S.mode; },
    get flying() { return object.visible && S.mode !== 'perch' && S.mode !== 'hidden'; },
    /** O ângulo das asas agora (rad; 0 abertas no plano, ~1,4 fechadas em pé). */
    get wing() { return S.wing; },
    /** Quanto ela bate as asas agora (0 planando … 1). */
    get flap() { return S.amp; },
    get pos() { return pos; },
    get vel() { return S.vel; },
    /** Chegou ao alvo do flyTo? */
    get arrived() { return S.arrived; },
  };
  return api;
}

// ------------------------------------------------------------------------------------------------ as do cenário
/**
 * As borboletas do Recanto: a do fechamento (hero, a cena move), as do cenário (flock, voando em volta dos canteiros,
 * onde o voo inteiro cabe sem encostar em nada, longe das árvores) e a que vem de fora (visitor) para a Rhaenyra
 * perseguir quando não há uma perto. Sem colisão (world), voam livres.
 * @param {{ root: THREE.Object3D, world?: any, layout?: any, ambient?: number }} o
 */
export function createButterflies({ root, world = null, layout = null, ambient = 2 }) {
  const kit = createButterflyKit();
  const group = new THREE.Group();
  group.name = 'historia:borboletas';
  root.add(group);
  /** O que a borboleta pode atravessar: a água em qualquer altura; os canteiros (baixos), voando por cima deles. */
  const ignoreLow = new Set(), ignoreHigh = new Set();
  let known = -1;
  function learn() {
    const n = (world?.statics?.length ?? 0) + (world?.dynamics?.length ?? 0);
    if (!world || n === known) return;
    known = n;
    for (const c of [...(world.statics || []), ...(world.dynamics || [])]) {
      if (c.kind === 'water') { ignoreLow.add(c.id); ignoreHigh.add(c.id); }
      if (/^canteiro/.test(String(c.id))) ignoreHigh.add(c.id);
    }
  }
  const optsLow = { ignore: ignoreLow }, optsHigh = { ignore: ignoreHigh };
  /** O ponto do voo entra em algum colisor (o desenho dela tem ~8 cm de raio)? */
  const blocked = (x, y, z) => {
    if (!world?.overlaps) return false;
    const o = y > 0.5 ? optsHigh : optsLow;
    return world.overlaps(x, z, 0.08, 'small', o) || world.overlaps(x, z, 0.08, 'large', o);
  };
  const make = (kind, seed) => {
    const b = createButterfly({ kit, kind, seed, blocked });
    group.add(b.object);
    return b;
  };
  const hero = make('monarca', 3).drive();
  hero.object.visible = false;
  hero.object.name = 'historia:borboleta';
  const visitor = make('azul', 11);

  /** Os lugares das do cenário: ao lado dos canteiros, onde a volta inteira cabe (e longe das árvores). */
  function spots() {
    if (!world?.overlaps || !layout) return [];
    learn();
    const beds = [...(layout.YARD_BEDS || []), ...(layout.BEDS || [])];
    const trees = (world.statics || []).filter((c) => c.kind === 'tree');
    const out = [];
    const R = 0.5;
    for (const b of beds) {
      if (out.length >= ambient) break;
      const along = b.hx >= b.hz ? 'x' : 'z';
      const long = along === 'x' ? b.hx : b.hz, short = along === 'x' ? b.hz : b.hx;
      let found = null;
      for (const f of [0, -0.45, 0.45]) {
        for (const side of [1, -1]) {
          const off = (short + 0.35) * side;
          const x = along === 'x' ? b.x + f * long : b.x + off;
          const z = along === 'x' ? b.z + off : b.z + f * long;
          if (world.overlaps(x, z, R + 0.12, 'small', optsHigh) || world.overlaps(x, z, R + 0.12, 'large', optsHigh)) continue;
          if (trees.some((t) => Math.hypot((t.x ?? 0) - x, (t.z ?? 0) - z) < 2.2)) continue;
          if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 3)) continue;
          found = { x, y: 0.78, z };
          break;
        }
        if (found) break;
      }
      if (found) out.push(found);
    }
    return out;
  }
  /** @type {ReturnType<typeof createButterfly>[]} */
  const flock = [];
  /** @type {{ x: number, y: number, z: number }[]} */
  let homes = [];
  let ambientOn = true;
  function settleFlock() {
    homes = spots();
    while (flock.length < homes.length) flock.push(make(BUTTERFLY_KINDS[(flock.length + 1) % BUTTERFLY_KINDS.length], 21 + flock.length * 7));
    flock.forEach((b, i) => {
      const h = homes[i];
      if (!h || !ambientOn) { b.hide(); return; }
      b.place(h).wander(h, 0.5);
    });
  }
  settleFlock();

  return {
    kit, group, hero, visitor, flock,
    get all() { return [hero, visitor, ...flock]; },
    /** Os lugares das do cenário (testes). */
    get homes() { return homes; },
    blocked,
    /**
     * A cada quadro. ambient: as do cenário à vista (na abertura, à noite na garoa, não).
     * @param {number} dt @param {{ ambient?: boolean }} [o]
     */
    update(dt, { ambient: on = true } = {}) {
      learn();
      if (on !== ambientOn) {
        ambientOn = on;
        flock.forEach((b, i) => { if (!on) b.hide(); else if (homes[i]) b.place(homes[i]).wander(homes[i], 0.5); });
      }
      hero.update(dt);
      visitor.update(dt);
      for (const b of flock) b.update(dt);
    },
    /** A do cenário mais perto de (x, z), até r m, voando no lugar dela (não emprestada a uma cena). */
    nearest(x, z, r) {
      let best = null, bd = r;
      flock.forEach((b, i) => {
        if (!b.flying || b.mode !== 'wander' || !homes[i]) return;
        const d = Math.hypot(b.pos.x - x, b.pos.z - z);
        if (d < bd) { bd = d; best = b; }
      });
      return best;
    },
    /** A borboleta do cenário volta para o lugar dela (depois de fugir da Rhaenyra). */
    home(b) {
      const i = flock.indexOf(b);
      if (i >= 0 && homes[i]) b.flyTo(homes[i], { speed: 0.9, then: 'wander', radius: 0.5 });
      else b.flyTo({ x: b.pos.x, y: 3.2, z: b.pos.z }, { speed: 1.2, then: 'hide' });
    },
    reset() {
      hero.hide().drive();
      hero.object.visible = false;
      visitor.hide();
      ambientOn = true;
      settleFlock();
    },
    dispose() {
      group.removeFromParent();
      kit.dispose();
    },
  };
}
