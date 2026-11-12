// RECANTO DAS PATINHAS — a ALA SUL da casa das irmãs (4ª rodada, pedido do usuário em 2026-11-11: "precisamos de uma casa
// maior, com mais detalhes, pensar em puzzles que se enquadrem melhor na casa"). Da cozinha, a porta leva ao CORREDOR
// (passadeira, aparador, quadros e, no fim, a base do ASPIRADOR ROBÔ); do corredor saem o BANHEIRO (azulejo, vaso, pia
// com espelho, box com o patinho de borracha) e a DESPENSA, a copa de passagem para a sala de jantar, NO ESCURO até
// alguém acender o interruptor (o de dentro dela é uma malha só, escurecida pela cor do material: nada recompila). A SALA
// DE JANTAR (lambri, papel listrado, cristaleira, aparador, a mesa com a TOALHA comprida e a LATA de biscoito) dá, pelo
// arco, na SALA DE ESTAR: o sofá embaixo da janela de parapeito fundo, o PUFE, o rack com painel ripado e TV, poltronas,
// estante, vitrola, ventilador de teto e a PORTA DOS FUNDOS (HOUSE_EXIT), com o TRINCO no alto.
// Peças fixas no kit (o grupo 'casa', como ./casa.js); o que se mexe em malhas próprias, com o lado de animar em `props`:
//   vacuum (o aspirador), pantry (a despensa: a luz e a goteira), pantrySwitch (o interruptor), tablecloth (a toalha),
//   cookieTin (a lata, a tampa, o biscoito e a etiqueta), pouf (o pufe) e exitDoor (a porta dos fundos e o trinco).
// O que colide tem colisor em ../layout.js (STATIC_COLLIDERS); o resto fica rente ao chão (até 8 cm) ou no alto.
// Os quadros são só pictogramas: nada escrito no cenário.
import * as THREE from 'three';
import { rng, foliageCluster } from '../../../../world/util.js';
import { rb, cyl, slab, sphere, rod, tiles, tilesV, wallBox, weathered } from '../../../../levels/mapa/world/kit.js';
import { vary, hash, rodAB, tubeAlong, shapeXY, disc, picto, bushGeo, createBaker, bakedMesh, curtainGeo, clipRect, WING_PAINT } from './casa.js';

const TAU = Math.PI * 2;
const C = (hex) => new THREE.Color(hex);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const TRIM = '#fff8ec';
/** O escuro da despensa: a cor do material de dentro com a luz apagada (multiplica as cores por vértice). */
const DARK = new THREE.Color(0.075, 0.08, 0.11);
const LIT = new THREE.Color(1, 1, 1);

/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildCasaSul(kit, root, L) {
  const H = L.HOUSE, WL = L.WALLS, t = WL.t, ht = t / 2;
  const RM = L.ROOMS, SR = L.SMALL_ROOMS, DW = L.DOORWAYS, WG = L.WING;
  const keep = (o) => { root.add(o); return o; };
  const add = (geo, o) => kit.add(geo, { group: 'casa', ...o });
  // o de dentro da despensa: uma malha só, com o material que escurece (a luz apagada)
  const darkB = createBaker();
  const dark = (geo, o) => darkB.add(geo, o);
  const FL = 0.006, CEIL = WL.h - 0.046, PASS_H = 2.05;
  const XW = H.x0 + ht, XE = H.x1 - ht, ZS = H.z1 - ht;
  const ZK = RM.cozinha.z1, XC = SR.corredor.x0, XB = SR.banheiro.x0, ZB = SR.banheiro.z1, ZE = RM.estar.z0;
  const P = WING_PAINT, plaster = '#f3d9bf';
  const KD = L.KITCHEN_DOOR, ED = L.EXIT_DOOR, EX = L.HOUSE_EXIT, LW = L.LIVING_WINDOW;

  /** Pictograma numa face de normal (nx, nz), centrado em (x, y, z); `put`: quem recebe as peças. */
  const art = (put, kind, s, col, x, y, z, nx = 0, nz = 1, extra = {}) => {
    const ry = Math.atan2(nx, nz);
    for (const [g, c] of picto(kind, s)) put(g, { color: c ?? col, x, y, z, ry, ao: false, ...extra });
  };
  /** O mesmo, deitado (voltado para cima), girado de `ry`. */
  const artFlat = (put, kind, s, col, x, y, z, ry = 0, extra = {}) => {
    for (const [g, c] of picto(kind, s)) put(g.rotateX(-Math.PI / 2), { color: c ?? col, x, y, z, ry, ao: false, ...extra });
  };

  // ---------------------------------------------------------------- os vãos (a…b ao longo da parede, y0…y1)
  const hKD = { a: Math.min(KD.hinge.x, KD.latchPost.x), b: Math.max(KD.hinge.x, KD.latchPost.x), y0: 0, y1: KD.h + 0.04 };
  const hBan = { a: DW.banheiro.z0, b: DW.banheiro.z1, y0: 0, y1: PASS_H };
  const hDesp = { a: DW.despensa.z0, b: DW.despensa.z1, y0: 0, y1: PASS_H };
  const hDJ = { a: DW.despensaJantar.z0, b: DW.despensaJantar.z1, y0: 0, y1: PASS_H };
  const hArco = { a: DW.arco.x0, b: DW.arco.x1, y0: 0, y1: 2.3 };
  const hExit = { a: EX.z0, b: EX.z1, y0: 0, y1: ED.h + 0.04 };
  const CW = WG.corridor.window;
  const winC = { a: CW.z0, b: CW.z1, y0: CW.sill, y1: CW.top };
  const winL = { a: LW.z0, b: LW.z1, y0: LW.sill, y1: LW.top };
  const [s1, s2] = WG.living.windows;
  const winS1 = { a: s1.x0, b: s1.x1, y0: s1.sill, y1: s1.top }, winS2 = { a: s2.x0, b: s2.x1, y0: s2.sill, y1: s2.top };

  // ---------------------------------------------------------------- pisos
  /** Piso: quadrados cw × cd com a cor de fn(i, j) (colunas em x, fiadas em z). */
  const floorOf = (put, x0, x1, z0, z1, cw, cd, fn) => {
    const w = x1 - x0, d = z1 - z0;
    const nx = Math.max(1, Math.round(w / cw)), nz = Math.max(1, Math.round(d / cd));
    put(tiles(w, d, cw, cd, (p) => fn(Math.min(nx - 1, Math.floor(((p.x + w / 2) / w) * nx)), Math.min(nz - 1, Math.floor(((p.z + d / 2) / d) * nz)))), { color: null, slot: 'ground', x: (x0 + x1) / 2, y: FL, z: (z0 + z1) / 2, ao: false });
  };
  /** Tábuas (cada uma ocupa dois quadrados, a emenda desencontrada): fiadas em z (byRow) ou em x. */
  const plankTint = (base, alt, byRow) => {
    const a = C(base), b = C(alt), o = new THREE.Color();
    return (i, j) => { const r = byRow ? j : i, c = Math.floor(((byRow ? i : j) + (r % 2)) / 2); return o.copy(a).lerp(b, hash(r, c) * 0.85); };
  };
  floorOf(add, XW, XB - ht, ZK + ht, ZE - ht, 0.16, 0.45, plankTint('#c08a58', '#9f6d42', false));
  floorOf(add, XW, XE, ZE + ht, ZS, 0.45, 0.16, plankTint('#b98252', '#9a6a40', true));
  {
    const o = new THREE.Color(), ca = C('#efe3cc'), cb = C('#e0cba8'), cr = C('#c98a5a');
    // o corredor: lajota clara com a faixa de terracota nas beiradas
    const ni = Math.round((XE - XC - ht) / 0.38);
    floorOf(add, XC + ht, XE, ZK + ht, ZE - ht, 0.38, 0.38, (i, j) => o.copy(i === 0 || i === ni - 1 ? cr : (i + j) % 2 ? cb : ca).multiplyScalar(0.96 + 0.06 * hash(i, j)));
    // o banheiro: ladrilho xadrez miúdo; no box, mais escuro
    const wa = C('#f4f6f6'), wb = C('#cfdde0'), sa = C('#9fb8bf'), sb = C('#b9ccd0');
    const Sh = WG.bath.shower, bx0 = XB + ht, bz0 = ZK + ht;
    floorOf(add, bx0, XC - ht, bz0, ZB - ht, 0.2, 0.2, (i, j) => {
      const x = bx0 + (i + 0.5) * 0.2, z = bz0 + (j + 0.5) * 0.2;
      const box = x < Sh.x1 && z > Sh.z0;
      return o.copy((i + j) % 2 ? (box ? sa : wb) : (box ? sb : wa)).multiplyScalar(0.97 + 0.04 * hash(i, j));
    });
    // a despensa (no escuro: na malha de dentro dela)
    const ta = C('#c98a5a'), tb = C('#b8774a');
    floorOf(dark, XB + ht, XC - ht, ZB + ht, ZE - ht, 0.3, 0.3, (i, j) => o.copy((i + j) % 2 ? tb : ta).multiplyScalar(0.95 + 0.07 * hash(i, j)));
  }
  // soleiras de madeira nas passagens de dentro e a de pedra na porta dos fundos
  for (const h of [hBan, hDesp]) add(slab(t + 0.02, 0.012, h.b - h.a), { color: '#b08452', x: XC, y: FL, z: (h.a + h.b) / 2, ao: false });
  add(slab(t + 0.02, 0.012, hDJ.b - hDJ.a), { color: '#b08452', x: XB, y: FL, z: (hDJ.a + hDJ.b) / 2, ao: false });
  add(slab(hArco.b - hArco.a, 0.012, t + 0.02), { color: '#b08452', x: (hArco.a + hArco.b) / 2, y: FL, z: ZE, ao: false });
  add(rb(t + 0.14, 0.03, EX.z1 - EX.z0, 0.008, 1), { color: '#cfc6b6', x: H.x1 + 0.04, y: -0.006, z: (EX.z0 + EX.z1) / 2, ao: false });
  /** Tapete: quadradinhos de 10 cm com a cor de fn(u, v) (u, v de −1 a 1), 4 mm acima do piso. */
  const rug = (x, z, hx, hz, fn, ry = 0) => add(tiles(hx * 2, hz * 2, 0.1, 0.1, (p) => fn(p.x / hx, p.z / hz)), { color: null, slot: 'ground', x, y: FL + 0.004, z, ry, ao: false });

  // ---------------------------------------------------------------- paredes (inteiras, com os vãos de verdade)
  /** A cor de um trecho: `inside` na face oposta a (ox, oz), `out` nas outras; a base escurece (sombra de contato). */
  const wallTint = (out, inside, ox, oz, y0) => {
    const a = C(out), b = C(inside), o = new THREE.Color();
    return (p, n) => o.copy(n.x * ox + n.z * oz < -0.5 ? b : a).multiplyScalar(0.84 + 0.16 * clamp01((y0 + p.y) / 0.5));
  };
  /** Parede ao longo de x (em z = c) ou de z (em x = c), de a0 a a1, com vãos; `od` (±1): o lado de fora. */
  const wallRun = (axis, c, a0, a1, out, inside, od, holes = [], ext = false) => {
    const box = (p0, p1, y0, y1) => {
      if (p1 - p0 < 0.005 || y1 - y0 < 0.005) return;
      const len = p1 - p0, mid = (p0 + p1) / 2, ox = axis === 'x' ? 0 : od, oz = axis === 'x' ? od : 0;
      add(ext ? (axis === 'x' ? wallBox(len, y1 - y0, t) : wallBox(t, y1 - y0, len)) : (axis === 'x' ? slab(len, y1 - y0, t) : slab(t, y1 - y0, len)), {
        color: ext ? weathered(out, { h: WL.h, y0, seed: c * 0.61 + mid * 0.07, along: axis === 'x' ? 'x' : 'z', inside, out: [ox, oz], eave: 0.3 }) : wallTint(out, inside, ox, oz, y0),
        x: axis === 'x' ? mid : c, y: y0, z: axis === 'x' ? c : mid, ao: false,
      });
    };
    const piece = (p0, p1, y0, y1) => { box(p0, p1, y0, Math.min(y1, 0.5)); box(p0, p1, Math.max(y0, 0.5), y1); };
    let p = a0;
    for (const h of [...holes].sort((m, n) => m.a - n.a)) {
      piece(p, h.a, 0, WL.h);
      piece(h.a, h.b, 0, h.y0);
      piece(h.a, h.b, h.y1, WL.h);
      p = h.b;
    }
    piece(p, a1, 0, WL.h);
  };
  // de fora: o oeste (o muro do condomínio por fora), o sul (as duas janelas da sala) e o leste (a janela do corredor, a
  // da sala e a porta dos fundos)
  wallRun('z', H.x0, ZK, ZE, '#efe2c8', P.jantar, -1, [], true);
  wallRun('z', H.x0, ZE, ZS, '#efe2c8', P.estar, -1, [], true);
  wallRun('x', H.z1, H.x0 - ht, H.x1 + ht, plaster, P.estar, 1, [winS1, winS2], true);
  wallRun('z', H.x1, ZK, ZE, plaster, P.corredor, 1, [winC], true);
  wallRun('z', H.x1, ZE, ZS, plaster, P.estar, 1, [winL, hExit], true);
  // de dentro: o oeste do corredor (o banheiro e a despensa), o oeste do banheiro e da despensa (a sala de jantar), entre
  // o banheiro e a despensa, e o norte da sala de estar (o arco)
  wallRun('z', XC, ZK + ht, ZB, P.corredor, P.banheiro, 1, [hBan]);
  wallRun('z', XC, ZB, ZE - ht, P.corredor, P.despensa, 1, [hDesp]);
  wallRun('z', XB, ZK + ht, ZB, P.jantar, P.banheiro, -1);
  wallRun('z', XB, ZB, ZE - ht, P.jantar, P.despensa, -1, [hDJ]);
  wallRun('x', ZB, XB + ht, XC - ht, P.despensa, P.banheiro, 1);
  wallRun('x', ZE, XW - 0.02, XB, P.estar, P.jantar, 1, [hArco]);
  wallRun('x', ZE, XB, XC, P.estar, P.despensa, 1);
  wallRun('x', ZE, XC, XE + 0.02, P.estar, P.corredor, 1);

  /** Caixa no referencial de uma parede: `along` no comprimento dela, `off` atravessado a partir de c. */
  const wbox = (axis, c, along, y, off, sa, sy, sc, color, extra = {}, put = add) => put(axis === 'x' ? slab(sa, sy, sc) : slab(sc, sy, sa), { color, x: axis === 'x' ? along : c + off, y, z: axis === 'x' ? c + off : along, ao: false, ...extra });
  /** Uma régua na face de uma parede (rodapé, roda-teto, guarnição), pulando os vãos que a cortam. */
  const strip = (axis, c, a0, a1, dir, y, h, d, color, holes = [], put = add) => {
    const part = (p0, p1) => { if (p1 - p0 > 0.02) wbox(axis, c, (p0 + p1) / 2, y, (dir * d) / 2, p1 - p0, h, d, color, {}, put); };
    let p = a0;
    for (const hh of [...holes].sort((m, n) => m.a - n.a)) {
      if (!(hh.y0 <= y + 1e-3 && hh.y1 >= y + h - 1e-3)) continue;
      part(p, hh.a);
      p = hh.b;
    }
    part(p, a1);
  };
  /** Faixa de quadrados (lambri, azulejo, papel de parede) 4 mm à frente da face de uma parede, pulando os vãos. */
  const skin = (axis, c, a0, a1, dir, y0, y1, cw, ch, fn, holes = [], put = add) => {
    const ry = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const sgn = axis === 'x' ? dir : -dir;
    const part = (p0, p1, q0, q1) => {
      if (p1 - p0 < 0.03 || q1 - q0 < 0.03) return;
      const w = p1 - p0, hgt = q1 - q0, mid = (p0 + p1) / 2, my = (q0 + q1) / 2;
      const nx = Math.max(1, Math.round(w / cw)), ny = Math.max(1, Math.round(hgt / ch));
      const g = tilesV(w, hgt, cw, ch, (p) => fn(mid + sgn * p.x, my + p.y, Math.min(nx - 1, Math.floor(((p.x + w / 2) / w) * nx)), Math.min(ny - 1, Math.floor(((p.y + hgt / 2) / hgt) * ny))));
      put(g, { color: null, x: axis === 'x' ? mid : c + dir * 0.004, y: my, z: axis === 'x' ? c + dir * 0.004 : mid, ry, ao: false });
    };
    let p = a0;
    for (const hh of [...holes].sort((m, n) => m.a - n.a)) {
      if (hh.y0 >= y1 - 0.02) continue;
      if (hh.y1 <= y0 + 0.02) { part(p, hh.a, y0, y1); part(hh.a, hh.b, y0, y1); p = hh.b; continue; }
      part(p, hh.a, y0, y1);
      part(hh.a, hh.b, y0, Math.min(y1, hh.y0));
      part(hh.a, hh.b, Math.max(y0, hh.y1), y1);
      p = hh.b;
    }
    part(p, a1, y0, y1);
  };

  // as faces de dentro de cada cômodo: eixo, face, de onde até onde, para onde olha e os vãos
  const FACES = {
    jantar: [
      { axis: 'x', c: ZK + ht, a0: XW, a1: XB - ht, dir: 1, holes: [] }, { axis: 'z', c: XW, a0: ZK + ht, a1: ZE - ht, dir: 1, holes: [] },
      { axis: 'x', c: ZE - ht, a0: XW, a1: XB - ht, dir: -1, holes: [hArco] }, { axis: 'z', c: XB - ht, a0: ZK + ht, a1: ZE - ht, dir: -1, holes: [hDJ] },
    ],
    corredor: [
      { axis: 'x', c: ZK + ht, a0: XC + ht, a1: XE, dir: 1, holes: [hKD] }, { axis: 'z', c: XE, a0: ZK + ht, a1: ZE - ht, dir: -1, holes: [winC] },
      { axis: 'x', c: ZE - ht, a0: XC + ht, a1: XE, dir: -1, holes: [] }, { axis: 'z', c: XC + ht, a0: ZK + ht, a1: ZE - ht, dir: 1, holes: [hBan, hDesp] },
    ],
    banheiro: [
      { axis: 'x', c: ZK + ht, a0: XB + ht, a1: XC - ht, dir: 1, holes: [] }, { axis: 'z', c: XB + ht, a0: ZK + ht, a1: ZB - ht, dir: 1, holes: [] },
      { axis: 'x', c: ZB - ht, a0: XB + ht, a1: XC - ht, dir: -1, holes: [] }, { axis: 'z', c: XC - ht, a0: ZK + ht, a1: ZB - ht, dir: -1, holes: [hBan] },
    ],
    despensa: [
      { axis: 'x', c: ZB + ht, a0: XB + ht, a1: XC - ht, dir: 1, holes: [] }, { axis: 'z', c: XB + ht, a0: ZB + ht, a1: ZE - ht, dir: 1, holes: [hDJ] },
      { axis: 'x', c: ZE - ht, a0: XB + ht, a1: XC - ht, dir: -1, holes: [] }, { axis: 'z', c: XC - ht, a0: ZB + ht, a1: ZE - ht, dir: -1, holes: [hDesp] },
    ],
    estar: [
      { axis: 'x', c: ZE + ht, a0: XW, a1: XE, dir: 1, holes: [hArco] }, { axis: 'z', c: XW, a0: ZE + ht, a1: ZS, dir: 1, holes: [] },
      { axis: 'x', c: ZS, a0: XW, a1: XE, dir: -1, holes: [winS1, winS2] }, { axis: 'z', c: XE, a0: ZE + ht, a1: ZS, dir: -1, holes: [winL, hExit] },
    ],
  };
  {
    const o = new THREE.Color();
    const base = (y) => 0.86 + 0.14 * clamp01(y / 0.45);
    // sala de jantar: lambri de madeira até 0,9 m e papel listrado em cima; corredor: barrado mais escuro; banheiro:
    // azulejo até 1,5 m com a faixa azul; despensa: tinta lisa (no escuro); sala de estar: a régua dos quadros
    const wa = C('#c9935a'), wb = C('#b8834d');
    const lambri = (u, y, i) => o.copy(i % 2 ? wa : wb).multiplyScalar(base(y) * (0.96 + 0.06 * hash(i, 5)));
    const pa = C('#f1dcc4'), pb = C('#e7cdb1');
    const papel = (u, y, i) => o.copy(i % 2 ? pa : pb);
    const ba = C('#e7dcc8');
    const barrado = (u, y) => o.copy(ba).multiplyScalar(base(y));
    const ta = C('#fbfcfb'), tb = C('#edf3f2'), tc = C('#5aa7c9');
    const azulejo = (u, y, i, j) => o.copy(y > 1.18 && y < 1.3 ? tc : (i + j) % 2 ? ta : tb).multiplyScalar(base(y));
    const da = C(P.despensa);
    const lisa = (u, y) => o.copy(da).multiplyScalar(base(y));
    for (const [room, faces] of Object.entries(FACES)) {
      const put = room === 'despensa' ? dark : add;
      for (const f of faces) {
        // (na despensa, que é outra malha, o rodapé para antes do alisar das portas: nenhuma face no plano das dele)
        const sh = room === 'despensa' ? f.holes.map((h) => ({ ...h, a: h.a - 0.075, b: h.b + 0.075 })) : f.holes;
        strip(f.axis, f.c, f.a0, f.a1, f.dir, FL, room === 'estar' ? 0.13 : 0.09, 0.018, TRIM, sh, put); // rodapé
        strip(f.axis, f.c, f.a0, f.a1, f.dir, CEIL - 0.07, 0.07, 0.045, TRIM, [], put); // roda-teto
        if (room === 'jantar') {
          skin(f.axis, f.c, f.a0, f.a1, f.dir, 0.09, 0.9, 0.12, 0.81, lambri, f.holes);
          strip(f.axis, f.c, f.a0, f.a1, f.dir, 0.9, 0.04, 0.026, '#a87445', f.holes);
          skin(f.axis, f.c, f.a0, f.a1, f.dir, 0.94, CEIL - 0.07, 0.11, CEIL - 1.01, papel, f.holes);
        } else if (room === 'corredor') {
          skin(f.axis, f.c, f.a0, f.a1, f.dir, 0.09, 0.9, 0.5, 0.81, barrado, f.holes);
          strip(f.axis, f.c, f.a0, f.a1, f.dir, 0.9, 0.035, 0.022, TRIM, f.holes);
        } else if (room === 'banheiro') {
          skin(f.axis, f.c, f.a0, f.a1, f.dir, 0.09, 1.5, 0.15, 0.15, azulejo, f.holes);
          strip(f.axis, f.c, f.a0, f.a1, f.dir, 1.5, 0.03, 0.02, TRIM, f.holes);
        } else if (room === 'despensa') {
          skin(f.axis, f.c, f.a0, f.a1, f.dir, 0.09, CEIL - 0.07, 0.6, CEIL - 0.16, lisa, f.holes, dark);
        } else if (room === 'estar') {
          strip(f.axis, f.c, f.a0, f.a1, f.dir, 2.12, 0.03, 0.02, '#e7c98c'); // a régua dos quadros
        }
      }
    }
    // o forro da despensa por dentro (virado para baixo, 4 mm abaixo do forro da casa) com a mancha da goteira
    const dw = XC - XB - t, dd = ZE - ZB - t;
    dark(new THREE.PlaneGeometry(dw, dd).rotateX(Math.PI / 2), { color: '#f2ece0', x: (XB + XC) / 2, y: CEIL - 0.004, z: (ZB + ZE) / 2 });
    const D = L.PANTRY.drip;
    dark(shapeXY(Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * TAU; const r = 0.26 * (1 + 0.18 * Math.sin(3 * a + 1) + 0.1 * Math.sin(5 * a)); return [Math.cos(a) * r, Math.sin(a) * r]; })).rotateX(Math.PI / 2), { color: '#b9a98a', x: D.x, y: CEIL - 0.007, z: D.z });
    dark(shapeXY(Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TAU; const r = 0.12 * (1 + 0.2 * Math.sin(2 * a + 2)); return [Math.cos(a) * r, Math.sin(a) * r]; })).rotateX(Math.PI / 2), { color: '#8f7f62', x: D.x, y: CEIL - 0.01, z: D.z });
  }

  // ---------------------------------------------------------------- janelas, passagens e a luz
  const glassB = createBaker(); // os vidros das janelas numa malha só (transparente)
  /** @type {number[]} */
  const sunPos = [];
  const SUN = new THREE.Vector3(L.SUN.direction[0], L.SUN.direction[1], L.SUN.direction[2]).normalize();
  /** A mancha de sol de uma janela no piso do cômodo (recortada pelas paredes dele). */
  const sunPatch = (axis, face, h, room) => {
    const pts = [[h.a, h.y0], [h.b, h.y0], [h.b, h.y1], [h.a, h.y1]].map(([al, y]) => {
      const k = y / SUN.y;
      return axis === 'x' ? [al - SUN.x * k, face - SUN.z * k] : [face - SUN.x * k, al - SUN.z * k];
    });
    const poly = clipRect(pts, room.x0, room.x1, room.z0, room.z1);
    for (let i = 1; i + 1 < poly.length; i++) {
      const a = poly[0], b = poly[i], cc = poly[i + 1];
      const up = (b[1] - a[1]) * (cc[0] - a[0]) - (b[0] - a[0]) * (cc[1] - a[1]) > 0;
      for (const q of up ? [a, b, cc] : [a, cc, b]) sunPos.push(q[0], FL + 0.012, q[1]);
    }
  };
  /**
   * Janela num vão { a, b, y0, y1 } da parede `axis` em c, com o lado de dentro em `dir`: batente, travessas, peitoris e
   * vidro. curtain: cor da cortina (dentro); shutter: venezianas (fora); flowers: floreira; sill: o peitoril de dentro.
   */
  const windowAt = (axis, c, h, dir, { curtain = null, shutter = null, flowers = false, sill = true } = {}) => {
    const w = h.b - h.a, hh = h.y1 - h.y0, mid = (h.a + h.b) / 2;
    for (const al of [h.a + 0.02, h.b - 0.02]) wbox(axis, c, al, h.y0, 0, 0.04, hh, t + 0.05, TRIM);
    wbox(axis, c, mid, h.y1 - 0.04, 0, w, 0.04, t + 0.05, TRIM);
    wbox(axis, c, mid, h.y0, 0, w, 0.035, t + 0.05, TRIM);
    wbox(axis, c, mid, h.y0, 0, 0.03, hh, 0.036, TRIM);
    wbox(axis, c, mid, h.y0 + hh * 0.56, 0, w, 0.03, 0.036, TRIM);
    if (sill) wbox(axis, c, mid, h.y0 - 0.035, dir * (ht + 0.045), w + 0.12, 0.035, 0.11, '#c79a6a');
    wbox(axis, c, mid, h.y0 - 0.04, -dir * (ht + 0.04), w + 0.14, 0.04, 0.1, '#d6cfc4');
    glassB.add(new THREE.PlaneGeometry(w - 0.06, hh - 0.06), { color: '#bfe3f5', x: axis === 'x' ? mid : c, y: h.y0 + hh / 2, z: axis === 'x' ? c : mid, ry: axis === 'x' ? 0 : Math.PI / 2 });
    if (curtain) {
      const off = dir * (ht + 0.125), top = h.y1 + 0.1, len = top - Math.max(0.52, h.y0 - 0.3);
      wbox(axis, c, mid, top - 0.01, off, w + 0.56, 0.02, 0.02, '#c9b27a');
      for (const al of [h.a - 0.1, h.b + 0.1]) {
        add(curtainGeo(0.34, len), { color: vary(curtain, 0.06, 30), x: axis === 'x' ? al : c + off, y: top - len, z: axis === 'x' ? c + off : al, ry: axis === 'x' ? 0 : Math.PI / 2, ao: false });
      }
    }
    if (shutter) {
      const off = -dir * (ht + 0.02);
      for (const s of [-1, 1]) {
        const al = s < 0 ? h.a - w / 4 - 0.03 : h.b + w / 4 + 0.03;
        wbox(axis, c, al, h.y0 - 0.02, off, w / 2, hh + 0.04, 0.03, shutter);
        for (let i = 0; i < 6; i++) wbox(axis, c, al, h.y0 + 0.06 + (i * (hh - 0.12)) / 5.6, off - dir * 0.017, w / 2 - 0.1, 0.035, 0.008, '#4d958e');
      }
    }
    if (flowers) {
      const off = -dir * (ht + 0.14);
      wbox(axis, c, mid, h.y0 - 0.25, off, w - 0.1, 0.19, 0.2, '#c9764f', { ao: true });
      wbox(axis, c, mid, h.y0 - 0.07, off, w - 0.16, 0.012, 0.14, '#5a4030', { slot: 'ground' });
      const n = Math.max(2, Math.round((w - 0.2) / 0.36));
      for (let i = 0; i < n; i++) {
        const al = h.a + 0.2 + (i * (w - 0.4)) / Math.max(1, n - 1);
        add(bushGeo(0.12, 0.14, 90 + i, ['#ff6a55', '#fff6ee', '#f2c230', '#e8708a'][i % 4], 6), { color: null, slot: 'plant', x: axis === 'x' ? al : c + off, y: h.y0 - 0.06, z: axis === 'x' ? c + off : al, ry: i * 1.3 });
      }
    }
  };
  windowAt('z', H.x1, winC, -1, { shutter: '#5aa7a0', flowers: true });
  windowAt('z', H.x1, winL, -1, { shutter: '#5aa7a0', flowers: true, sill: false });
  windowAt('x', H.z1, winS1, -1, { curtain: '#f6efe0' });
  windowAt('x', H.z1, winS2, -1, { curtain: '#f6efe0' });
  sunPatch('z', XE, winC, { x0: XC + ht, x1: XE, z0: ZK + ht, z1: ZE - ht });
  sunPatch('z', XE, winL, { x0: XW, x1: XE, z0: ZE + ht, z1: ZS });
  sunPatch('x', ZS, winS1, { x0: XW, x1: XE, z0: ZE + ht, z1: ZS });
  sunPatch('x', ZS, winS2, { x0: XW, x1: XE, z0: ZE + ht, z1: ZS });
  {
    // o parapeito fundo da janela da sala (pedra clara; é por ele que a Radhija chega ao trinco: 5 mm acima do topo da
    // parede de baixo, para as faces não ficarem no mesmo plano) e a persiana enrolada lá em cima, no lugar da cortina
    const S = L.LIVING_SILL;
    add(rb(S.x1 - S.x0 + 0.06, 0.04, S.z1 - S.z0, 0.008, 1), { color: vary('#e4ddd0', 0.03, 20), x: (S.x0 + S.x1) / 2 + 0.03, y: S.y - 0.035, z: (S.z0 + S.z1) / 2, ao: false });
    add(rod(0.045, LW.z1 - LW.z0 + 0.1, 14), { color: '#efe6d2', x: XE - 0.07, y: LW.top + 0.06, z: (LW.z0 + LW.z1) / 2, rx: Math.PI / 2, ao: false });
    for (const s of [-1, 1]) add(slab(0.06, 0.12, 0.02), { color: '#c9b27a', x: XE - 0.05, y: LW.top + 0.0, z: (LW.z0 + LW.z1) / 2 + s * ((LW.z1 - LW.z0) / 2 + 0.06), ao: false });
    add(tubeAlong([[XE - 0.08, LW.top + 0.02, (LW.z0 + LW.z1) / 2 + 0.3], [XE - 0.09, LW.top - 0.25, (LW.z0 + LW.z1) / 2 + 0.31], [XE - 0.08, LW.top - 0.5, (LW.z0 + LW.z1) / 2 + 0.3]], 0.004, 4, 8), { color: '#f4ecdc', ao: false });
  }

  /** Guarnição de uma passagem { a, b, y1 } na parede `axis` em c: forras dos lados e de cima e o alisar nas duas faces. */
  const casing = (axis, c, h, lin = 0.02, wide = 0.07) => {
    wbox(axis, c, h.a + lin / 2, 0, 0, lin, h.y1, t + 0.04, TRIM);
    wbox(axis, c, h.b - lin / 2, 0, 0, lin, h.y1, t + 0.04, TRIM);
    wbox(axis, c, (h.a + h.b) / 2, h.y1 - 0.03, 0, h.b - h.a, 0.03, t + 0.04, TRIM);
    for (const s of [-1, 1]) {
      wbox(axis, c, h.a - wide / 2, 0, s * (ht + 0.008), wide, h.y1 + wide, 0.016, TRIM);
      wbox(axis, c, h.b + wide / 2, 0, s * (ht + 0.008), wide, h.y1 + wide, 0.016, TRIM);
      wbox(axis, c, (h.a + h.b) / 2, h.y1, s * (ht + 0.008), h.b - h.a + wide * 2, wide, 0.016, TRIM);
    }
  };
  casing('z', XC, hBan);
  casing('z', XC, hDesp);
  casing('z', XB, hDJ);
  casing('x', ZE, hArco, 0.03, 0.12);
  casing('z', H.x1, hExit, 0.02);

  // as luminárias (sem luz de verdade: o globo é emissivo)
  /** Plafon no forro (o disco aceso embaixo). */
  const plafon = (x, z, r = 0.17) => {
    add(cyl(r, r + 0.02, 0.045, 18), { color: TRIM, x, y: CEIL - 0.045, z, ao: false });
    add(cyl(r - 0.03, r - 0.01, 0.012, 18), { color: '#fff1c2', slot: 'lit', x, y: CEIL - 0.057, z });
  };
  plafon(-12.78, 9.9);
  plafon(-12.78, 12.9);
  plafon((XB + XC) / 2, (ZK + ZB) / 2 + 0.2, 0.15);
  {
    // a luminária da mesa de jantar: a barra no forro e as três cúpulas
    const T = L.DINING_TABLE, drop = 0.9;
    add(rod(0.006, drop - 0.1, 5), { color: '#4a4f57', x: T.x, y: CEIL - (drop - 0.1) / 2, z: T.z, ao: false });
    add(cyl(0.06, 0.06, 0.02, 12), { color: '#c9a24a', x: T.x, y: CEIL - 0.02, z: T.z, ao: false });
    add(rod(0.012, 1.1, 6), { color: '#c9a24a', x: T.x, y: CEIL - drop + 0.1, z: T.z, rz: Math.PI / 2, ao: false });
    for (const dx of [-0.45, 0, 0.45]) {
      add(rod(0.004, 0.12, 4), { color: '#4a4f57', x: T.x + dx, y: CEIL - drop + 0.04, z: T.z, ao: false });
      add(cyl(0.045, 0.13, 0.13, 16), { color: '#f2c25e', x: T.x + dx, y: CEIL - drop - 0.13, z: T.z, ao: false });
      add(sphere(0.045, 10, 8), { color: '#fff1c2', slot: 'lit', x: T.x + dx, y: CEIL - drop - 0.14, z: T.z });
    }
  }
  /** Pendente: o fio do forro, a cúpula e o globo aceso. */
  const pendant = (x, z, drop, shade) => {
    add(rod(0.006, drop, 5), { color: '#4a4f57', x, y: CEIL - drop / 2, z, ao: false });
    add(cyl(0.05, 0.05, 0.02, 12), { color: TRIM, x, y: CEIL - 0.02, z, ao: false });
    add(cyl(0.06, 0.2, 0.15, 16), { color: shade, x, y: CEIL - drop - 0.15, z, ao: false });
    add(sphere(0.06, 12, 8), { color: '#fff1c2', slot: 'lit', x, y: CEIL - drop - 0.165, z });
  };
  pendant(-21.4, 17.6, 0.6, '#8fcdb8');

  // ---------------------------------------------------------------- peças que se repetem
  /** Quadro na parede (o ponto dado fica na face dela; (nx, nz): para onde ela olha): moldura, fundo e um pictograma. */
  const frame = (x, y, z, nx, nz, w, h, wood, bg, kind, col) => {
    const ry = Math.atan2(nx, nz);
    add(rb(w, h, 0.03, 0.012, 1), { color: wood, x: x + nx * 0.015, y: y - h / 2, z: z + nz * 0.015, ry, ao: false });
    add(slab(w - 0.07, h - 0.07, 0.006), { color: bg, x: x + nx * 0.031, y: y - h / 2 + 0.035, z: z + nz * 0.031, ry, ao: false });
    if (kind) art(add, kind, Math.min(w, h) * 0.56, col, x + nx * 0.0385, y, z + nz * 0.0385, nx, nz);
  };
  /** Vaso com planta (o colisor é o círculo do vaso): 'ficus' (copa redonda), 'palma' ou 'costela' (folhas em arco). */
  const potPlant = (x, z, r, kind, seed, a0 = 0, a1 = TAU) => {
    const pr = r - 0.03, ph = 0.34;
    add(cyl(pr, pr * 0.72, ph, 16), { color: vary('#c9764f', 0.06, 14), x, y: FL, z });
    add(new THREE.TorusGeometry(pr, 0.022, 6, 18).rotateX(Math.PI / 2), { color: '#b8653f', x, y: FL + ph - 0.01, z, ao: false });
    add(cyl(pr - 0.02, pr - 0.02, 0.01, 14), { color: '#4a3526', x, y: FL + ph - 0.004, z, ao: false });
    const Rp = rng(seed);
    if (kind === 'ficus') {
      add(rodAB([x, FL + ph, z], [x + 0.03, 1.05, z - 0.02], 0.024, 6), { color: '#8a6a48', ao: false });
      add(foliageCluster([
        { x: 0, y: 1.3, z: 0, r: 0.3 }, { x: 0.2, y: 1.18, z: 0.1, r: 0.22 }, { x: -0.2, y: 1.2, z: -0.08, r: 0.22 }, { x: 0.02, y: 1.52, z: 0.04, r: 0.22 },
        { x: -0.05, y: 1.14, z: 0.2, r: 0.2 },
      ], { detail: 1, amp: 0.22, seed, dark: '#2f5a2a', mid: '#4f8a3a', light: '#8fbf5a' }), { color: null, slot: 'foliage', x, z });
      return;
    }
    const n = kind === 'palma' ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5 * Rp()) / n) * (a1 - a0), len = (kind === 'palma' ? 1.0 : 0.8) + Rp() * 0.35, out = 0.3 + Rp() * 0.25;
      const pts = [], wid = kind === 'palma' ? 0.07 : 0.16;
      for (let k = 0; k <= 6; k++) {
        const u = k / 6, rr = out * u * u * 1.3, yy = FL + ph + len * (u - 0.32 * u * u * u);
        pts.push([x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr]);
      }
      const pos = [], col = [];
      const dk = C('#2f6a34'), lt = C(kind === 'palma' ? '#7fbf5a' : '#5fa648'), cc = new THREE.Color();
      for (let k = 0; k <= 6; k++) {
        const u = k / 6, w2 = wid * Math.sin(Math.min(1, u * 1.15) * Math.PI) * (u < 0.3 ? 0.35 + u * 2.2 : 1) + 0.006;
        const sx = -Math.sin(a) * w2, sz = Math.cos(a) * w2;
        pos.push(pts[k][0] - sx, pts[k][1] - w2 * 0.25, pts[k][2] - sz, pts[k][0] + sx, pts[k][1] - w2 * 0.25, pts[k][2] + sz);
        cc.copy(dk).lerp(lt, u * 0.8 + 0.2 * Rp());
        col.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const idx = [];
      for (let k = 0; k < 6; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
      g.setIndex(idx);
      g.computeVertexNormals();
      add(g, { color: null, slot: 'plant' });
      add(rodAB(pts[0], pts[2], 0.008, 4), { color: '#4f8a3a', ao: false });
    }
  };
  /** Livros em pé numa prateleira, de a0 a a1 ao longo de x (lombadas para dir em z) ou de z (lombadas para dir em x). */
  const books = (put, axis, a0, a1, y, face, dir, seed, depth = 0.17) => {
    const Rb = rng(seed);
    const tones = ['#d9534f', '#3d8fd1', '#f2c230', '#5cb85c', '#8a72c2', '#e8708a', '#f08a3c', '#4aa6a0', '#f4e3c8'];
    let p = a0;
    while (p < a1 - 0.03) {
      const w = Math.min(a1 - p, 0.028 + Rb() * 0.03), hgt = 0.17 + Rb() * 0.09;
      if (Rb() < 0.12) { p += w + 0.02; continue; }
      const mid = p + w / 2, col = tones[Math.floor(Rb() * tones.length)];
      put(axis === 'z' ? slab(depth, hgt, w - 0.004) : slab(w - 0.004, hgt, depth), { color: col, x: axis === 'z' ? face - (dir * depth) / 2 : mid, y, z: axis === 'z' ? mid : face - (dir * depth) / 2, ao: false });
      p += w;
    }
  };
  /**
   * Um móvel montado no referencial dele (de frente para +z, o centro no chão) e posto inteiro no kit, girado de `ry`:
   * build(b) põe as peças no baker b.
   */
  const furniture = (x, z, ry, build, extra = {}) => {
    const b = createBaker();
    build(b);
    add(b.build(), { color: null, x, z, ry, ...extra });
  };

  // ---------------------------------------------------------------- o corredor
  {
    const Cr = WG.corridor;
    // a passadeira (listras e franja), por onde o aspirador anda
    const ra = C('#d98a5a'), rbC = C('#f2d7b0'), rc = C('#8f5a3c');
    rug(L.VACUUM.lane.x, (L.VACUUM.lane.z0 + L.VACUUM.lane.z1) / 2 + 0.05, 0.45, 2.45, (u, v) => (Math.abs(u) > 0.84 ? rc : Math.abs(u) > 0.7 ? rbC : Math.round(v * 9 + 20) % 3 === 0 ? ra : rbC));
    // o aparador estreito na parede leste: tampo, gaveta, pés finos, a fruteira das chaves, o abajur e o porta-retrato
    const A = Cr.console, fx = A.x - A.hx;
    furniture(A.x, A.z, -Math.PI / 2, (b) => {
      const W = A.hz * 2, D = A.hx * 2;
      b.add(rb(W, 0.035, D, 0.01, 1), { color: vary('#c9935a', 0.05, 8), y: A.h - 0.035 });
      b.add(rb(W - 0.04, 0.14, D - 0.03, 0.01, 1), { color: '#a87445', y: A.h - 0.18, z: 0.005 });
      b.add(rb(W * 0.5, 0.1, 0.01, 0.004, 1), { color: '#b8834d', y: A.h - 0.16, z: D / 2 - 0.005 });
      b.add(sphere(0.015, 8, 6), { color: '#c9a24a', y: A.h - 0.11, z: D / 2 + 0.006 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(cyl(0.016, 0.012, A.h - 0.18, 8), { color: '#8a6a48', x: sx * (W / 2 - 0.04), z: sz * (D / 2 - 0.04) });
      b.add(slab(W - 0.1, 0.015, D - 0.06), { color: '#b8834d', y: 0.14 });
    });
    add(cyl(0.09, 0.06, 0.05, 14), { color: '#8fcdb8', x: A.x - 0.02, y: A.h, z: A.z + 0.22, ao: false });
    add(new THREE.TorusGeometry(0.018, 0.005, 5, 10).rotateX(1.2), { color: '#c9a24a', x: A.x - 0.03, y: A.h + 0.05, z: A.z + 0.22, ao: false });
    add(cyl(0.05, 0.06, 0.03, 12), { color: '#8a72c2', x: A.x, y: A.h, z: A.z - 0.25, ao: false });
    add(cyl(0.01, 0.01, 0.2, 6), { color: '#c9a24a', x: A.x, y: A.h + 0.03, z: A.z - 0.25, ao: false });
    add(cyl(0.06, 0.1, 0.14, 16), { color: '#fff1c2', slot: 'lit', x: A.x, y: A.h + 0.2, z: A.z - 0.25 });
    add(rb(0.02, 0.2, 0.16, 0.006, 1), { color: '#8a5a3c', x: A.x + 0.04, y: A.h, z: A.z, ry: 0.15, ao: false });
    art(add, 'pata', 0.09, '#5aa7a0', fx + 0.18, A.h + 0.1, A.z, -1, 0);
    // o vaso no canto nordeste
    potPlant(Cr.plant.x, Cr.plant.z, Cr.plant.r, 'palma', 61, Math.PI * 0.55, Math.PI * 1.45);
    // os quadros: na parede oeste, entre as portas; o grande no fim do corredor; um em cima do aparador
    frame(XC + ht, 1.55, 11.05, 1, 0, 0.36, 0.46, '#8a5a3c', '#fff6e6', 'osso', '#c79a6a');
    frame(XC + ht, 1.5, 11.65, 1, 0, 0.3, 0.3, '#c9a24a', '#e8f3fb', 'sol', '#f2c230');
    frame(XC + ht, 1.62, 12.18, 1, 0, 0.28, 0.36, '#f4b8c8', '#fff6e6', 'coracao', '#e8475f');
    frame(-12.78, 1.62, ZE - ht, 0, -1, 0.9, 0.62, '#8a5a3c', '#bfe3f5', 'pata', '#3d8fd1');
    frame(XE, 1.55, 12.85, -1, 0, 0.44, 0.34, '#c9a24a', '#fde9c9', 'cenoura', '#f07a1a');
    // as arandelas do corredor (a cúpula de vidro acesa)
    for (const z of [9.0, 14.2]) {
      add(rb(0.03, 0.12, 0.08, 0.008, 1), { color: '#c9a24a', x: XC + ht + 0.015, y: 1.78, z, ao: false });
      add(cyl(0.05, 0.035, 0.11, 12), { color: '#fff1c2', slot: 'lit', x: XC + ht + 0.08, y: 1.8, z });
    }
    // a base do aspirador no canto sudeste: a placa de recarga no chão e a torrinha encostada na parede, com a luz
    const V = L.VACUUM, Bs = V.base;
    add(rb(0.02, 0.012, 0.42, 0.004, 1), { color: '#3a3d42', x: Bs.x - 0.2, y: FL, z: Bs.z, ao: false });
    add(rb(0.26, 0.008, 0.42, 0.004, 1), { color: '#4a4f57', x: Bs.x - 0.18, y: FL + 0.001, z: Bs.z, ao: false });
    add(rb(Bs.hx * 2, 0.11, Bs.hz * 2, 0.02, 2), { color: '#e4e6e8', x: Bs.x, y: FL, z: Bs.z });
    add(rb(0.012, 0.05, 0.2, 0.004, 1), { color: '#2a2c2f', x: Bs.x - Bs.hx - 0.004, y: FL + 0.04, z: Bs.z, ao: false });
    add(sphere(0.012, 8, 6), { color: '#7dff9a', slot: 'lit', x: Bs.x - Bs.hx + 0.01, y: FL + 0.095, z: Bs.z - 0.12 });
    for (const s of [-1, 1]) add(slab(0.03, 0.004, 0.04), { color: '#c9a24a', x: Bs.x - Bs.hx - 0.02, y: FL + 0.009, z: Bs.z + s * 0.06, ao: false });
  }

  // ---------------------------------------------------------------- o banheiro
  {
    const B = WG.bath;
    // o vaso sanitário (de frente para o leste): a base, a bacia, a tampa e a caixa acoplada
    furniture(B.toilet.x, B.toilet.z, Math.PI / 2, (b) => {
      const wh = '#fbfcfb', wh2 = '#eef2f2';
      b.add(cyl(0.12, 0.15, 0.36, 18), { color: wh, sz: 1.25, z: 0.05 });
      b.add(new THREE.TorusGeometry(0.17, 0.025, 8, 20).rotateX(Math.PI / 2), { color: wh2, y: 0.38, z: 0.07, sz: 1.2 });
      b.add(cyl(0.18, 0.18, 0.02, 20), { color: '#f4f8f8', y: 0.39, z: 0.06, sz: 1.2, rx: -0.05 });
      b.add(rb(0.38, 0.36, 0.17, 0.03, 2), { color: wh, y: 0.36, z: -0.24 });
      b.add(rb(0.4, 0.03, 0.19, 0.012, 1), { color: wh2, y: 0.72, z: -0.24 });
      b.add(cyl(0.018, 0.018, 0.012, 10), { color: '#c9d3d6', y: 0.75, z: -0.24 });
    });
    // o rolo de papel na parede ao lado
    add(rb(0.02, 0.03, 0.14, 0.006, 1), { color: '#c9d3d6', x: XB + ht + 0.01, y: 0.62, z: B.toilet.z + 0.42, ao: false });
    add(rod(0.05, 0.11, 12), { color: '#fbfcfb', x: XB + ht + 0.07, y: 0.6, z: B.toilet.z + 0.42, rx: Math.PI / 2, ao: false });
    // a pia com o gabinete (de frente para o sul), a torneira, o copo das escovas e o sabonete; o espelho e a arandela
    const Sk = B.sink;
    furniture(Sk.x, Sk.z, 0, (b) => {
      const W = Sk.hx * 2, D = Sk.hz * 2;
      b.add(slab(W - 0.06, 0.08, D - 0.08), { color: '#6a645c', y: 0, z: -0.02 });
      b.add(rb(W, Sk.h - 0.12, D - 0.02, 0.015, 1), { color: vary('#8fcdb8', 0.03, 6), y: 0.08, z: -0.01 });
      for (const s of [-1, 1]) {
        b.add(rb(W / 2 - 0.04, Sk.h - 0.22, 0.016, 0.006, 1), { color: '#a6dccb', x: s * (W / 4), y: 0.12, z: D / 2 - 0.01 });
        b.add(rb(0.016, 0.1, 0.02, 0.006, 1), { color: '#c9a24a', x: s * 0.05, y: Sk.h - 0.3, z: D / 2 + 0.006 });
      }
      b.add(rb(W + 0.02, 0.04, D + 0.02, 0.012, 1), { color: '#f4f1ea', y: Sk.h - 0.04 });
      b.add(cyl(0.16, 0.12, 0.06, 20), { color: '#fbfcfb', y: Sk.h - 0.005, sz: 0.75 });
      b.add(cyl(0.13, 0.13, 0.004, 18), { color: '#cfdde0', y: Sk.h + 0.052, sz: 0.72 });
      b.add(cyl(0.016, 0.016, 0.14, 8), { color: '#d0d4d8', y: Sk.h, z: -D / 2 + 0.06 });
      b.add(rodAB([0, Sk.h + 0.13, -D / 2 + 0.06], [0, Sk.h + 0.12, -D / 2 + 0.2], 0.012, 6), { color: '#d0d4d8' });
      b.add(cyl(0.03, 0.025, 0.09, 10), { color: '#f2c230', x: W / 2 - 0.1, y: Sk.h, z: -0.04 });
      for (const [dx, col] of [[-0.008, '#e8475f'], [0.01, '#3d8fd1']]) b.add(rodAB([W / 2 - 0.1 + dx, Sk.h + 0.08, -0.04], [W / 2 - 0.1 + dx * 3, Sk.h + 0.2, -0.04 + dx], 0.005, 4), { color: col });
      b.add(rb(0.08, 0.025, 0.05, 0.012, 1), { color: '#f4b8c8', x: -W / 2 + 0.11, y: Sk.h, z: 0 });
    });
    add(rb(0.62, 0.72, 0.03, 0.02, 1), { color: '#c9a24a', x: Sk.x, y: 1.12, z: ZK + ht + 0.015, ao: false });
    add(slab(0.56, 0.66, 0.006), { color: '#d5ecf5', slot: 'glass', x: Sk.x, y: 1.15, z: ZK + ht + 0.031 });
    add(rb(0.4, 0.05, 0.06, 0.02, 1), { color: TRIM, x: Sk.x, y: 1.92, z: ZK + ht + 0.03, ao: false });
    add(rb(0.34, 0.02, 0.03, 0.01, 1), { color: '#fff1c2', slot: 'lit', x: Sk.x, y: 1.9, z: ZK + ht + 0.06 });
    // o box: a mureta baixa, o vidro do lado norte (o lado leste fica aberto), o chuveiro e o nicho com o patinho
    const Sh = B.shower, G = B.glass;
    add(slab(0.04, 0.03, Sh.z1 - Sh.z0), { color: '#e4e9ea', x: Sh.x1 + 0.02, y: FL, z: (Sh.z0 + Sh.z1) / 2, ao: false });
    add(slab(G.x1 - G.x0 - 0.008, 2.0, 0.012), { color: '#cfe6ee', slot: 'glass', x: (G.x0 + G.x1) / 2 + 0.004, y: 0.03, z: G.z });
    add(slab(0.03, 2.0, 0.03), { color: '#c9d3d6', x: G.x1 + 0.015, y: 0.03, z: G.z, ao: false });
    add(rodAB([XB + ht, 1.95, (Sh.z0 + Sh.z1) / 2], [XB + ht + 0.3, 1.97, (Sh.z0 + Sh.z1) / 2], 0.014, 6), { color: '#d0d4d8', ao: false });
    add(cyl(0.08, 0.06, 0.04, 16), { color: '#d0d4d8', x: XB + ht + 0.32, y: 1.93, z: (Sh.z0 + Sh.z1) / 2, ao: false });
    add(rb(0.02, 0.1, 0.06, 0.006, 1), { color: '#d0d4d8', x: XB + ht + 0.01, y: 1.05, z: (Sh.z0 + Sh.z1) / 2 + 0.25, ao: false });
    // o nicho na parede do sul: o xampu, o sabonete e o patinho de borracha
    add(rb(0.5, 0.025, 0.12, 0.006, 1), { color: '#e4e9ea', x: (Sh.x0 + Sh.x1) / 2, y: 1.18, z: ZB - ht - 0.06, ao: false });
    add(cyl(0.03, 0.03, 0.16, 10), { color: '#e8708a', x: (Sh.x0 + Sh.x1) / 2 - 0.15, y: 1.205, z: ZB - ht - 0.06, ao: false });
    add(cyl(0.028, 0.028, 0.13, 10), { color: '#5cb85c', x: (Sh.x0 + Sh.x1) / 2 - 0.08, y: 1.205, z: ZB - ht - 0.06, ao: false });
    {
      const dx = (Sh.x0 + Sh.x1) / 2 + 0.12, dz = ZB - ht - 0.065, dy = 1.205;
      add(sphere(0.045, 12, 8), { color: '#f2c230', x: dx, y: dy + 0.035, z: dz, sx: 1.25, ao: false });
      add(sphere(0.03, 10, 8), { color: '#f2c230', x: dx + 0.04, y: dy + 0.085, z: dz, ao: false });
      add(new THREE.ConeGeometry(0.014, 0.03, 8).rotateZ(-Math.PI / 2), { color: '#f08a3c', x: dx + 0.078, y: dy + 0.082, z: dz, ao: false });
      for (const s of [-1, 1]) add(sphere(0.006, 6, 4), { color: '#2a2318', x: dx + 0.06, y: dy + 0.095, z: dz + s * 0.016, ao: false });
    }
    // a toalha no toalheiro (parede do sul, a leste do box) e o tapetinho na frente do box
    add(rod(0.012, 0.6, 8), { color: '#d0d4d8', x: -15.05, y: 1.15, z: ZB - ht - 0.07, rz: Math.PI / 2, ao: false });
    for (const s of [-1, 1]) add(rb(0.03, 0.04, 0.07, 0.006, 1), { color: '#d0d4d8', x: -15.05 + s * 0.28, y: 1.13, z: ZB - ht - 0.035, ao: false });
    add(rb(0.48, 0.62, 0.035, 0.012, 2), { color: vary('#f4b8c8', 0.05, 20), x: -15.05, y: 0.55, z: ZB - ht - 0.08, ao: false });
    add(rb(0.5, 0.012, 0.005, 0.002, 1), { color: '#e8708a', x: -15.05, y: 0.7, z: ZB - ht - 0.1, ao: false });
    {
      const ma = C('#8fcdb8'), mb = C('#fff6e6');
      rug(Sh.x1 + 0.38, (Sh.z0 + Sh.z1) / 2, 0.28, 0.42, (u, v) => (Math.abs(u) > 0.78 || Math.abs(v) > 0.84 ? ma : Math.round(v * 4 + 6) % 2 ? mb : ma));
    }
    // o cesto de roupa (vime, com a tampa) e a folha da porta, aberta, encostada na parede do leste
    const Bk = B.basket;
    {
      const wa2 = C('#c99b5a'), wb2 = C('#b5864a');
      add(cyl(Bk.r - 0.01, Bk.r - 0.04, 0.5, 18), { color: (p) => (Math.floor(p.y * 30) % 2 ? wa2 : wb2), x: Bk.x, y: FL, z: Bk.z });
      add(cyl(Bk.r, Bk.r, 0.04, 18), { color: '#a87840', x: Bk.x, y: FL + 0.5, z: Bk.z, ao: false });
      add(rb(0.12, 0.02, 0.04, 0.008, 1), { color: '#8a6a48', x: Bk.x, y: FL + 0.54, z: Bk.z, ao: false });
    }
    const Dl = B.door;
    add(rb(0.04, PASS_H - 0.04, Dl.z1 - Dl.z0 - 0.02, 0.01, 1), { color: vary('#f4ead8', 0.03, 6), x: Dl.x, y: 0.02, z: (Dl.z0 + Dl.z1) / 2 });
    for (const [py, ph] of [[0.2, 0.7], [1.05, 0.8]]) add(rb(0.012, ph, Dl.z1 - Dl.z0 - 0.2, 0.004, 1), { color: '#e8d9bd', x: Dl.x - 0.024, y: py, z: (Dl.z0 + Dl.z1) / 2, ao: false });
    add(sphere(0.03, 10, 8), { color: '#c9a24a', x: Dl.x - 0.05, y: 1.0, z: Dl.z1 - 0.1, ao: false });
    // o patinho de borracha (de verdade) também aparece no quadrinho da parede
    frame(XB + ht, 1.75, 9.9, 1, 0, 0.3, 0.3, '#5aa7c9', '#fff6e6', 'coracao', '#5aa7c9');
  }

  // ---------------------------------------------------------------- a despensa (no escuro: tudo na malha de dentro)
  const PN = L.PANTRY;
  {
    const Pp = WG.pantry;
    const woodS = vary('#d9b98f', 0.04, 8);
    /** Uma estante de prateleiras (de frente para `dir` em z) com as coisas em cima. */
    const shelfUnit = (S, dir, levels, seed) => {
      const Rs = rng(seed);
      const x0 = S.x - S.hx, x1 = S.x + S.hx, back = S.z - dir * S.hz, front = S.z + dir * S.hz;
      dark(slab(S.hx * 2 - 0.02, S.h - 0.02, 0.015), { color: '#b08452', x: S.x, y: FL, z: back + dir * 0.008 });
      for (const x of [x0 + 0.02, S.x, x1 - 0.02]) dark(rb(0.035, S.h, S.hz * 2 - 0.01, 0.008, 1), { color: woodS, x, y: FL, z: S.z });
      levels.forEach((y, li) => {
        dark(slab(S.hx * 2 - 0.03, 0.025, S.hz * 2 - 0.03), { color: '#c9a77d', x: S.x, y, z: S.z });
        // em cada prateleira: potes de vidro (o conteúdo colorido), latas, caixas e garrafas
        let x = x0 + 0.08;
        while (x < x1 - 0.1) {
          const k = Rs(), zz = S.z + dir * (0.02 - Rs() * 0.06), yy = y + 0.025;
          if (Math.abs(x - S.x) < 0.04) { x += 0.06; continue; }
          if (k < 0.3) {
            const r = 0.045 + Rs() * 0.02, hh = 0.14 + Rs() * 0.08;
            dark(cyl(r, r, hh, 12), { color: ['#f2c230', '#e8a04a', '#c9764f', '#8a5a3c', '#f4e3c8', '#e8475f'][Math.floor(Rs() * 6)], x: x + r, y: yy, z: zz });
            dark(cyl(r + 0.004, r + 0.004, 0.025, 12), { color: ['#e8475f', '#3d8fd1', '#5cb85c', '#c9a24a'][li % 4], x: x + r, y: yy + hh, z: zz });
            x += r * 2 + 0.03;
          } else if (k < 0.55) {
            const r = 0.035, hh = 0.1;
            for (let s = 0; s < 2; s++) dark(cyl(r, r, hh, 12), { color: ['#d0d4d8', '#e8475f', '#f2c230'][(li + s) % 3], x: x + r, y: yy + s * hh, z: zz });
            x += r * 2 + 0.03;
          } else if (k < 0.8) {
            const w = 0.12 + Rs() * 0.06, hh = 0.18 + Rs() * 0.1;
            dark(rb(w, hh, 0.07, 0.008, 1), { color: ['#f08a3c', '#4aa6a0', '#f4e3c8', '#8a72c2', '#5f8fb8'][Math.floor(Rs() * 5)], x: x + w / 2, y: yy, z: zz });
            art(dark, ['osso', 'coracao', 'sol', 'pata'][Math.floor(Rs() * 4)], Math.min(w, hh) * 0.5, '#fff6e6', x + w / 2, yy + hh * 0.55, zz + dir * 0.036, 0, dir);
            x += w + 0.03;
          } else {
            const r = 0.032, hh = 0.24;
            dark(cyl(r, r, hh, 10), { color: ['#5c9a3a', '#c9a24a', '#bfe3f5'][Math.floor(Rs() * 3)], x: x + r, y: yy, z: zz });
            dark(cyl(0.012, r, 0.06, 10), { color: '#e4e6e8', x: x + r, y: yy + hh, z: zz });
            x += r * 2 + 0.03;
          }
        }
      });
    };
    const [Sn, Ss] = Pp.shelves;
    shelfUnit(Sn, 1, [0.08, 0.48, 0.88, 1.28, 1.68], 71);
    shelfUnit(Ss, -1, [0.08, 0.5, 0.92, 1.34], 72);
    // o cesto de batatas no chão (as batatas aparecendo)
    const Bk = Pp.basket;
    {
      const wa2 = C('#c99b5a'), wb2 = C('#b5864a');
      dark(cyl(Bk.r, Bk.r - 0.03, 0.22, 16), { color: (p) => (Math.floor(p.y * 36) % 2 ? wa2 : wb2), x: Bk.x, y: FL, z: Bk.z });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU, rr = i ? 0.08 : 0;
        dark(sphere(0.045, 8, 6), { color: i % 3 ? '#c9a06a' : '#b8895a', x: Bk.x + Math.cos(a) * rr, y: FL + 0.21, z: Bk.z + Math.sin(a) * rr, sx: 1.2, sz: 0.9, ry: a });
      }
    }
    // a vassoura e o rodo encostados no canto (os cabos subindo pela parede)
    const Br = Pp.broom;
    dark(rodAB([Br.x - 0.02, FL + 0.08, Br.z], [Br.x + 0.04, 1.35, Br.z + 0.06], 0.012, 6), { color: '#c9764f' });
    dark(rb(0.24, 0.1, 0.05, 0.015, 1), { color: '#e8475f', x: Br.x - 0.02, y: FL, z: Br.z - 0.02, ry: 0.3 });
    dark(rodAB([Br.x + 0.04, FL + 0.03, Br.z - 0.04], [Br.x + 0.07, 1.25, Br.z + 0.04], 0.011, 6), { color: '#3d8fd1' });
    dark(rb(0.3, 0.03, 0.04, 0.01, 1), { color: '#2a2c2f', x: Br.x + 0.04, y: FL, z: Br.z - 0.04, ry: -0.5 });
    // a panela da goteira no chão, com a água e a poça em volta
    const D = PN.drip;
    dark(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(D.pan - 0.01, 0), new THREE.Vector2(D.pan, 0.01), new THREE.Vector2(D.pan, D.panH), new THREE.Vector2(D.pan - 0.008, D.panH), new THREE.Vector2(D.pan - 0.008, 0.012), new THREE.Vector2(0, 0.012)], 22), { color: '#c9ced3', x: D.x, y: FL, z: D.z });
    for (const s of [-1, 1]) dark(rb(0.05, 0.012, 0.025, 0.006, 1), { color: '#2a2c2f', x: D.x + s * (D.pan + 0.02), y: D.panH - 0.02, z: D.z, ao: false });
    dark(cyl(D.pan - 0.012, D.pan - 0.012, 0.004, 20), { color: '#5f8fb0', x: D.x, y: D.panH - 0.035, z: D.z });
    dark(shapeXY(Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * TAU; const r = 0.32 * (1 + 0.2 * Math.sin(3 * a + 0.5)); return [Math.cos(a) * r, Math.sin(a) * r * 0.7]; })).rotateX(-Math.PI / 2), { color: '#7f9fb0', x: D.x + 0.06, y: FL + 0.004, z: D.z + 0.03 });
    // a lâmpada pendurada (o bocal e o fio; o bulbo aceso é à parte, com a luz)
    dark(rod(0.005, PN.lamp.drop - 0.05, 5), { color: '#2a2c2f', x: PN.lamp.x, y: CEIL - (PN.lamp.drop - 0.05) / 2, z: PN.lamp.z });
    dark(cyl(0.03, 0.03, 0.06, 10), { color: '#e4e6e8', x: PN.lamp.x, y: CEIL - PN.lamp.drop, z: PN.lamp.z });
  }
  const pantryMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  pantryMat.color.copy(DARK);
  const pantryMesh = new THREE.Mesh(darkB.build(), pantryMat);
  pantryMesh.name = 'recanto:despensa-por-dentro';
  pantryMesh.castShadow = false;
  pantryMesh.receiveShadow = true;
  keep(pantryMesh);
  // o bulbo (acende com a luz), a gota que cai da mancha e a onda na panela
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#d9d3c4', emissive: '#ffd77a', emissiveIntensity: 0, roughness: 0.3 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), bulbMat);
  bulb.name = 'despensa:lampada';
  bulb.position.set(PN.lamp.x, CEIL - PN.lamp.drop - 0.05, PN.lamp.z);
  keep(bulb);
  const dropMat = new THREE.MeshStandardMaterial({ color: '#9fd3ff', emissive: '#4f8fc0', emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.1 });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), dropMat);
  drop.name = 'despensa:gota';
  drop.scale.set(1, 1.5, 1);
  drop.position.set(PN.drip.x, CEIL - 0.02, PN.drip.z);
  keep(drop);
  const rippleMat = new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.04, 20).rotateX(-Math.PI / 2), rippleMat);
  ripple.name = 'despensa:onda';
  ripple.position.set(PN.drip.x, PN.drip.panH - 0.03, PN.drip.z);
  keep(ripple);
  // a luz que sai pelas duas portas no chão do corredor e da sala de jantar (decalque, só com a luz acesa)
  const spillMat = new THREE.MeshBasicMaterial({ color: '#ffe7a8', transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  {
    const pos = [];
    const fan = (x, za, zb, dir) => {
      const far = x + dir * 1.2, spread = 0.35, y = FL + 0.013;
      const pts = [[x, za], [x, zb], [far, zb + spread], [far, za - spread]];
      for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
        const tri = [pts[a], pts[b], pts[c]];
        const up = (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]) - (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) > 0;
        for (const q of up ? tri : [tri[0], tri[2], tri[1]]) pos.push(q[0], y, q[1]);
      }
    };
    fan(XC + ht, hDesp.a + 0.05, hDesp.b - 0.05, 1);
    fan(XB - ht, hDJ.a + 0.05, hDJ.b - 0.05, -1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const spill = new THREE.Mesh(g, spillMat);
    spill.name = 'despensa:luz-no-chao';
    spill.renderOrder = 1;
    keep(spill);
  }
  // o interruptor do lado de fora (na parede do corredor), com as patinhas pintadas embaixo: o impulso da Rhaenyra
  const SW = PN.switch;
  const swGroup = new THREE.Group();
  swGroup.name = 'recanto:interruptor-da-despensa';
  swGroup.position.set(SW.x, 0, SW.z);
  swGroup.rotation.y = Math.atan2(SW.nx, SW.nz);
  let rocker;
  {
    const b = createBaker();
    b.add(rb(0.09, 0.13, 0.012, 0.01, 1), { color: '#fbfaf6', y: SW.top - 0.065, z: 0.006 });
    b.add(rb(0.07, 0.11, 0.006, 0.006, 1), { color: '#e9e4d8', y: SW.top - 0.055, z: 0.012 });
    // as patinhas pintadas (onde a Rhaenyra apoia as dianteiras) e a setinha para cima
    for (const [px, py, ps] of [[-0.17, SW.top - 0.33, 0.1], [-0.12, SW.top - 0.62, 0.09], [0.0, SW.top - 0.82, 0.08]]) {
      for (const [g, c] of picto('pata', ps)) b.add(g, { color: c ?? '#fff6e6', x: px, y: py, z: 0.008 });
    }
    b.add(shapeXY([[-0.025, 0], [0.025, 0], [0, 0.045]]), { color: '#fff6e6', x: -0.08, y: SW.top - 0.24, z: 0.008 });
    swGroup.add(bakedMesh(b, 'interruptor:placa', { rough: 0.5, cast: false }));
    rocker = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.012), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }));
    rocker.name = 'interruptor:tecla';
    rocker.position.set(0, SW.top - 0.055, 0.02);
    swGroup.add(rocker);
  }
  keep(swGroup);
  const switchState = { press: 0, on: false };
  const showRocker = () => { rocker.rotation.x = (switchState.on ? -0.32 : 0.32); rocker.position.z = 0.02 - switchState.press * 0.004; };
  const pantrySwitch = {
    object: swGroup,
    setPress(k) { switchState.press = clamp01(k); showRocker(); },
    setOn(on) { switchState.on = !!on; showRocker(); },
    setTimer() {},
  };
  showRocker();
  const pantryState = { lit: 0, t: 0 };
  const setLit = (k) => {
    pantryState.lit = clamp01(k);
    pantryMat.color.copy(DARK).lerp(LIT, pantryState.lit);
    bulbMat.emissiveIntensity = 1.4 * pantryState.lit;
    spillMat.opacity = 0.22 * pantryState.lit;
  };
  setLit(0);
  const updatePantry = (dt) => {
    // a goteira: a gota cai da mancha até a água da panela e faz a onda; o resto do tempo, só a onda sumindo
    pantryState.t = (pantryState.t + dt) % PN.drip.period;
    const fall = 0.5, k = pantryState.t / fall;
    const y0 = CEIL - 0.02, y1 = PN.drip.panH - 0.03;
    if (k < 1) {
      drop.visible = true;
      drop.position.y = y0 - (y0 - y1) * k * k;
      rippleMat.opacity = 0;
    } else {
      drop.visible = false;
      const u = clamp01((pantryState.t - fall) / 0.45);
      ripple.scale.setScalar(1 + u * 2.6);
      rippleMat.opacity = 0.5 * (1 - u) * (0.25 + 0.75 * pantryState.lit);
    }
  };

  // ---------------------------------------------------------------- a sala de jantar
  const DT = L.DINING_TABLE;
  {
    const Dn = WG.dining;
    // o tapete embaixo da mesa (a barra e os losangos)
    {
      const ta = C('#8f3f3a'), tb = C('#f2d7b0'), tc = C('#5f2f2a'), td = C('#c96a4a');
      const Rg = Dn.rug;
      rug(Rg.x, Rg.z, Rg.hx, Rg.hz, (u, v) => {
        const d = Math.min((1 - Math.abs(u)) * Rg.hx, (1 - Math.abs(v)) * Rg.hz);
        if (d < 0.08) return tc;
        if (d < 0.16) return tb;
        if (d < 0.22) return tc;
        const q = Math.abs(((u * Rg.hx * 1.8) % 1 + 1) % 1 - 0.5) + Math.abs(((v * Rg.hz * 1.8) % 1 + 1) % 1 - 0.5);
        return q < 0.2 ? tb : q < 0.34 ? td : ta;
      });
    }
    // a mesa: o tampo, o requadro e os pés torneados (a toalha é à parte e cobre o tampo)
    furniture(DT.x, DT.z, 0, (b) => {
      const W = DT.hx * 2, D = DT.hz * 2;
      b.add(rb(W, 0.045, D, 0.012, 1), { color: vary('#8a5a3c', 0.04, 8), y: DT.h - 0.045 });
      for (const s of [-1, 1]) {
        b.add(slab(W - 0.14, 0.09, 0.025), { color: '#7a4e32', y: DT.h - 0.135, z: s * (D / 2 - 0.06) });
        b.add(slab(0.025, 0.09, D - 0.14), { color: '#7a4e32', x: s * (W / 2 - 0.06), y: DT.h - 0.135 });
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * (W / 2 - 0.07), z = sz * (D / 2 - 0.07);
        b.add(cyl(0.028, 0.022, DT.h - 0.045, 10), { color: '#7a4e32', x, z });
        b.add(sphere(0.036, 10, 8), { color: '#8a5a3c', x, y: 0.42, z, sy: 0.7 });
      }
    });
    // as cadeiras (assento estofado, pés, encosto de ripas)
    for (const c of L.DINING_CHAIRS) {
      furniture(c.x, c.z, c.yaw, (b) => {
        const s = 0.19;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(slab(0.035, sz < 0 ? 0.95 : 0.45, 0.035), { color: '#7a4e32', x: sx * (s - 0.02), z: sz * (s - 0.02) });
        b.add(rb(s * 2, 0.035, s * 2, 0.012, 1), { color: '#8a5a3c', y: 0.43 });
        b.add(rb(s * 2 - 0.04, 0.04, s * 2 - 0.04, 0.016, 1), { color: vary('#c96a4a', 0.04, 20), y: 0.462 });
        for (const y of [0.62, 0.74, 0.86]) b.add(rb(s * 2 - 0.04, 0.05, 0.022, 0.008, 1), { color: '#8a5a3c', y, z: -(s - 0.02) });
      });
    }
    // a cristaleira encostada no norte: o armário de baixo, as portas de vidro e a louça lá dentro
    const Ch = Dn.china;
    furniture(Ch.x, Ch.z, 0, (b) => {
      const W = Ch.hx * 2, D = Ch.hz * 2, wood = vary('#8a5a3c', 0.04, 7);
      b.add(slab(W - 0.06, 0.08, D - 0.06), { color: '#5a3d2a', y: 0 });
      b.add(rb(W, 0.78, D, 0.015, 1), { color: wood, y: 0.08 });
      for (const s of [-1, 1]) {
        b.add(rb(W / 2 - 0.05, 0.62, 0.016, 0.006, 1), { color: '#9a6a46', x: s * (W / 4), y: 0.15, z: D / 2 + 0.004 });
        b.add(sphere(0.016, 8, 6), { color: '#c9a24a', x: s * 0.06, y: 0.62, z: D / 2 + 0.02 });
      }
      b.add(rb(W + 0.02, 0.035, D + 0.02, 0.01, 1), { color: '#7a4e32', y: 0.86 });
      // a parte de cima: as laterais, o fundo claro, as prateleiras e a cornija
      b.add(slab(W - 0.08, 1.0, 0.015), { color: '#f4ead8', y: 0.9, z: -D / 2 + 0.03 });
      for (const s of [-1, 1]) b.add(rb(0.04, 1.06, D - 0.04, 0.008, 1), { color: wood, x: s * (W / 2 - 0.02), y: 0.895 });
      b.add(rb(W + 0.05, 0.06, D + 0.04, 0.012, 1), { color: '#7a4e32', y: Ch.h - 0.06 });
      for (const y of [1.2, 1.52]) b.add(slab(W - 0.08, 0.02, D - 0.08), { color: '#9a6a46', y, z: -0.01 });
      // os pratos em pé, as xícaras e a jarra
      for (const [y, n] of [[0.92, 6], [1.22, 5], [1.54, 4]]) {
        for (let i = 0; i < n; i++) {
          const x = -W / 2 + 0.16 + i * ((W - 0.32) / Math.max(1, n - 1));
          if ((i + Math.round(y * 10)) % 3 === 0) {
            b.add(cyl(0.035, 0.028, 0.06, 12), { color: '#fff6e6', x, y, z: 0.02 });
            b.add(new THREE.TorusGeometry(0.018, 0.005, 5, 10), { color: '#fff6e6', x: x + 0.04, y: y + 0.03, z: 0.02, ry: Math.PI / 2 });
          } else b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 18).rotateX(Math.PI / 2 - 0.25), { color: i % 2 ? '#fff6e6' : '#bfe3f5', x, y: y + 0.105, z: -D / 2 + 0.07 });
        }
      }
      for (const s of [-1, 1]) b.add(slab(W / 2 - 0.04, 0.9, 0.012), { color: '#cfe6ee', x: s * (W / 4), y: 0.92, z: D / 2 - 0.01 });
    }, { slot: 'solid' });
    // o aparador (buffet) no oeste: a fruteira, os castiçais e o quadro grande em cima (uma natureza-morta)
    const Bf = Dn.buffet;
    furniture(Bf.x, Bf.z, Math.PI / 2, (b) => {
      const W = Bf.hz * 2, D = Bf.hx * 2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(cyl(0.025, 0.02, 0.14, 8), { color: '#5a3d2a', x: sx * (W / 2 - 0.08), z: sz * (D / 2 - 0.07) });
      b.add(rb(W, Bf.h - 0.16, D - 0.02, 0.02, 1), { color: vary('#8a5a3c', 0.04, 6), y: 0.14 });
      for (let i = -1; i <= 1; i++) {
        b.add(rb(W * 0.3, Bf.h - 0.28, 0.016, 0.006, 1), { color: '#9a6a46', x: i * W * 0.32, y: 0.19, z: D / 2 - 0.006 });
        b.add(sphere(0.016, 8, 6), { color: '#c9a24a', x: i * W * 0.32, y: Bf.h - 0.2, z: D / 2 + 0.01 });
      }
      b.add(rb(W + 0.04, 0.03, D + 0.02, 0.01, 1), { color: '#7a4e32', y: Bf.h - 0.03 });
    });
    add(cyl(0.16, 0.09, 0.08, 18), { color: '#f4e3c8', x: Bf.x, y: Bf.h, z: Bf.z, ao: false });
    for (const [fx, fz, fc] of [[0.05, 0.03, '#e8475f'], [-0.06, -0.02, '#f2c230'], [0.0, -0.07, '#7fb04f'], [0.02, 0.07, '#f08a3c'], [-0.04, 0.06, '#8a72c2']]) add(sphere(0.045, 10, 8), { color: fc, x: Bf.x + Number(fx), y: Bf.h + 0.1, z: Bf.z + Number(fz), ao: false });
    for (const s of [-1, 1]) {
      add(cyl(0.04, 0.05, 0.03, 12), { color: '#c9a24a', x: Bf.x, y: Bf.h, z: Bf.z + s * 0.55, ao: false });
      add(cyl(0.012, 0.016, 0.2, 8), { color: '#c9a24a', x: Bf.x, y: Bf.h + 0.03, z: Bf.z + s * 0.55, ao: false });
      add(cyl(0.016, 0.016, 0.14, 8), { color: '#fff6e6', x: Bf.x, y: Bf.h + 0.23, z: Bf.z + s * 0.55, ao: false });
    }
    {
      // a natureza-morta: a moldura dourada, o fundo, a fruteira e as frutas (tudo pictograma)
      const fz = Bf.z, fy = 1.72, w = 1.2, h = 0.8, x = XW;
      add(rb(0.04, h, w, 0.012, 1), { color: '#c9a24a', x: x + 0.02, y: fy - h / 2, z: fz, ao: false });
      add(slab(0.006, h - 0.08, w - 0.08), { color: '#3f5f52', x: x + 0.043, y: fy - h / 2 + 0.04, z: fz, ao: false });
      add(disc(0.2, 0, 0, 1.6, 0.45).rotateY(Math.PI / 2), { color: '#c9935a', x: x + 0.05, y: fy - 0.2, z: fz, ao: false });
      for (const [dz, dy, r, col] of [[-0.12, -0.08, 0.09, '#e8475f'], [0.08, -0.06, 0.1, '#f2c230'], [-0.02, 0.06, 0.08, '#7fb04f'], [0.2, 0.0, 0.07, '#8a72c2']]) {
        add(disc(r, 0, 0).rotateY(Math.PI / 2), { color: col, x: x + 0.052, y: fy + dy, z: fz + dz, ao: false });
      }
    }
    potPlant(Dn.plants[0].x, Dn.plants[0].z, Dn.plants[0].r, 'ficus', 63);
    potPlant(Dn.plants[1].x, Dn.plants[1].z, Dn.plants[1].r, 'costela', 64, -Math.PI * 0.6, Math.PI * 0.1);
    // os quadros: o grande no norte, a leste da cristaleira, e o par na parede do leste
    frame(-19.4, 1.7, ZK + ht, 0, 1, 0.7, 0.56, '#8a5a3c', '#e8f3fb', 'sol', '#f2c230');
    frame(XB - ht, 1.6, 9.4, -1, 0, 0.4, 0.5, '#c9a24a', '#fff6e6', 'cenoura', '#f07a1a');
    frame(XB - ht, 1.55, 10.15, -1, 0, 0.32, 0.32, '#8a5a3c', '#fff6e6', 'osso', '#c79a6a');
  }

  // ---------------------------------------------------------------- a sala de estar
  const SF = L.SOFA;
  {
    const Lv = WG.living;
    // os tapetes: o da TV (listras) e o do canto de leitura (losangos)
    {
      const [r1, r2] = Lv.rugs;
      const sa = C('#7fa36b'), sb = C('#f2e6c8'), sc = C('#5f8a56');
      rug(r1.x, r1.z, r1.hx, r1.hz, (u, v) => (Math.abs(u) > 0.92 || Math.abs(v) > 0.92 ? sc : Math.round(v * r1.hz * 5 + 20) % 2 ? sa : sb));
      const ta = C('#d98a5a'), tb = C('#f2d7b0'), tc = C('#8f5a3c'), td = C('#e9b98a');
      rug(r2.x, r2.z, r2.hx, r2.hz, (u, v) => {
        const d = Math.min((1 - Math.abs(u)) * r2.hx, (1 - Math.abs(v)) * r2.hz);
        if (d < 0.1) return tc;
        if (d < 0.2) return tb;
        const q = Math.abs(((u * r2.hx * 1.6) % 1 + 1) % 1 - 0.5) + Math.abs(((v * r2.hz * 1.6) % 1 + 1) % 1 - 0.5);
        return q < 0.22 ? ta : q < 0.36 ? td : tb;
      });
    }
    // o sofá de três lugares (de frente para o oeste), com as almofadas, as almofadinhas e a manta no braço
    furniture(SF.x, SF.z, -Math.PI / 2, (b) => {
      const Wd = SF.hz * 2, D = SF.hx * 2;
      const blue = vary('#5f8fb8', 0.04, 7), blueD = vary('#5583ab', 0.04, 7);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(cyl(0.03, 0.024, 0.08, 8), { color: '#8a6a48', x: sx * (Wd / 2 - 0.1), z: sz * (D / 2 - 0.09) });
      b.add(rb(Wd, 0.3, D, 0.06, 2), { color: blue, y: 0.08 });
      b.add(rb(Wd, 0.46, 0.22, 0.07, 2), { color: blueD, y: 0.36, z: -D / 2 + 0.11 });
      for (const s of [-1, 1]) b.add(rb(0.2, 0.3, D - 0.02, 0.07, 2), { color: blueD, x: s * (Wd / 2 - 0.1), y: 0.36, z: 0.01 });
      for (let i = -1; i <= 1; i++) {
        b.add(rb(Wd / 3 - 0.13, 0.1, D - 0.32, 0.045, 2), { color: '#7aa6cc', x: i * (Wd / 3 - 0.07), y: 0.37, z: 0.07 });
        b.add(rb(Wd / 3 - 0.15, 0.3, 0.12, 0.05, 2), { color: '#6f9cc4', x: i * (Wd / 3 - 0.07), y: 0.47, z: -D / 2 + 0.28, rx: -0.14 });
      }
      b.add(rb(0.34, 0.3, 0.12, 0.08, 2), { color: '#f2c25e', x: -Wd / 2 + 0.42, y: 0.48, z: -D / 2 + 0.38, rz: 0.2, rx: -0.2 });
      b.add(rb(0.3, 0.28, 0.12, 0.08, 2), { color: '#e8708a', x: Wd / 2 - 0.45, y: 0.48, z: -D / 2 + 0.38, rz: -0.15, rx: -0.2 });
      b.add(rb(0.24, 0.04, D + 0.02, 0.018, 1), { color: vary('#f4e3c8', 0.06, 30), x: Wd / 2 - 0.1, y: 0.655, z: 0 });
      b.add(rb(0.24, 0.3, 0.012, 0.004, 1), { color: vary('#f4e3c8', 0.06, 30), x: Wd / 2 - 0.1, y: 0.36, z: D / 2 + 0.006 });
    });
    // a mesinha de centro (tampo, prateleira, quatro pés), com os livros, a caneca, o vasinho e o controle
    const CT = Lv.coffee;
    furniture(CT.x, CT.z, Math.PI / 2, (b) => {
      const W = CT.hz * 2, D = CT.hx * 2;
      b.add(rb(W, 0.04, D, 0.015, 1), { color: vary('#c9935a', 0.05, 8), y: CT.h - 0.04 });
      b.add(slab(W - 0.12, 0.02, D - 0.12), { color: '#b5864a', y: 0.12 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rb(0.045, CT.h - 0.04, 0.045, 0.01, 1), { color: '#a87445', x: sx * (W / 2 - 0.05), z: sz * (D / 2 - 0.05) });
      b.add(rb(0.5, 0.12, 0.2, 0.03, 1), { color: (p) => C(Math.floor(p.y * 50) % 2 ? '#c99b5a' : '#b5864a'), y: 0.14 });
    });
    add(rb(0.19, 0.03, 0.26, 0.006, 1), { color: '#3d8fd1', x: CT.x + 0.04, y: CT.h, z: CT.z - 0.25, ry: 0.2, ao: false });
    add(rb(0.16, 0.025, 0.22, 0.006, 1), { color: '#f2c230', x: CT.x + 0.04, y: CT.h + 0.03, z: CT.z - 0.24, ry: -0.1, ao: false });
    add(cyl(0.04, 0.035, 0.085, 10), { color: '#e8475f', x: CT.x - 0.1, y: CT.h, z: CT.z + 0.08, ao: false });
    add(cyl(0.06, 0.045, 0.11, 12), { color: '#f4e3c8', x: CT.x + 0.08, y: CT.h, z: CT.z + 0.32, ao: false });
    add(bushGeo(0.08, 0.1, 71, '#f4b8c8', 5), { color: null, slot: 'plant', x: CT.x + 0.08, y: CT.h + 0.08, z: CT.z + 0.32 });
    add(rb(0.05, 0.018, 0.15, 0.008, 1), { color: '#2a2c2f', x: CT.x - 0.16, y: CT.h, z: CT.z - 0.02, ry: 0.4, ao: false });
    // o rack com o painel ripado (de frente para o leste), a TV, a caixa de som e o vasinho
    const TVu = Lv.tv;
    furniture(TVu.x, TVu.z, Math.PI / 2, (b) => {
      const W = TVu.hz * 2, D = TVu.hx * 2;
      const back = -D / 2 + 0.03;
      // o painel de ripas, do chão até quase o forro
      b.add(slab(W, TVu.h, 0.04), { color: '#7a4e32', y: 0, z: back });
      for (let i = 0; i < Math.round(W / 0.07); i++) b.add(slab(0.04, TVu.h - 0.02, 0.025), { color: vary(i % 2 ? '#b98252' : '#c99460', 0.04, 9), x: -W / 2 + 0.035 + i * 0.07, y: 0.01, z: back + 0.03 });
      // o rack baixo e as portas
      b.add(slab(W - 0.2, 0.06, D - 0.12), { color: '#5a3d2a', y: 0, z: 0.03 });
      b.add(rb(W - 0.1, 0.38, D - 0.08, 0.02, 1), { color: vary('#e8dcc8', 0.03, 6), y: 0.06, z: 0.04 });
      for (const s of [-1, 1]) {
        b.add(rb(W / 2 - 0.12, 0.3, 0.016, 0.006, 1), { color: '#d9cbb2', x: s * (W / 4 - 0.02), y: 0.1, z: D / 2 - 0.02 });
        b.add(rb(0.12, 0.016, 0.02, 0.006, 1), { color: '#c9a24a', x: s * 0.12, y: 0.37, z: D / 2 - 0.004 });
      }
      // a TV (a tela escura) e a caixa de som; o vasinho e os livros
      b.add(rb(1.16, 0.68, 0.045, 0.012, 1), { color: '#2a2c2f', y: 0.82, z: back + 0.08 });
      b.add(slab(1.08, 0.6, 0.006), { color: '#1d2733', y: 0.86, z: back + 0.105 });
      b.add(rb(0.7, 0.07, 0.09, 0.02, 1), { color: '#3a3d42', y: 0.44, z: 0.0 });
      b.add(cyl(0.06, 0.05, 0.12, 12), { color: '#c9764f', x: W / 2 - 0.22, y: 0.44, z: 0.05 });
      b.add(rb(0.16, 0.05, 0.12, 0.006, 1), { color: '#8a72c2', x: -W / 2 + 0.25, y: 0.44, z: 0.05 });
      b.add(rb(0.14, 0.04, 0.1, 0.006, 1), { color: '#f2c230', x: -W / 2 + 0.25, y: 0.49, z: 0.05, ry: 0.2 });
    });
    add(bushGeo(0.1, 0.12, 73, '#fff6ee', 5), { color: null, slot: 'plant', x: TVu.x + 0.05, y: 0.55, z: TVu.z + TVu.hz - 0.22 });
    // as poltronas (uma de frente para a TV, outra no canto de leitura) e as mantas
    const armchair = (A, col, colD, seed) => furniture(A.x, A.z, A.yaw, (b) => {
      const W = A.hx * 2, D = A.hz * 2, rose = vary(col, 0.04, 7);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(cyl(0.03, 0.022, 0.09, 8), { color: '#8a6a48', x: sx * (W / 2 - 0.09), z: sz * (D / 2 - 0.09) });
      b.add(rb(W, 0.28, D, 0.07, 2), { color: rose, y: 0.08 });
      b.add(rb(W, 0.48, 0.2, 0.08, 2), { color: rose, y: 0.34, z: -D / 2 + 0.1 });
      for (const s of [-1, 1]) b.add(rb(0.18, 0.24, D - 0.1, 0.07, 2), { color: colD, x: s * (W / 2 - 0.09), y: 0.34, z: 0.04 });
      b.add(rb(W - 0.34, 0.11, D - 0.36, 0.05, 2), { color: vary(col, 0.06, 13), y: 0.35, z: 0.08 });
      b.add(rb(0.3, 0.26, 0.1, 0.07, 2), { color: seed % 2 ? '#f2c25e' : '#8fcdb8', y: 0.47, z: -D / 2 + 0.25, rx: -0.2 });
      b.add(rb(0.44, 0.05, 0.36, 0.02, 1), { color: vary('#8fcdb8', 0.08, 40), x: W / 2 - 0.2, y: 0.42, z: -0.02, rz: -0.2 });
    });
    armchair(Lv.armchairs[0], '#e59a8a', '#dc8d7c', 1);
    armchair(Lv.armchairs[1], '#7aa6cc', '#6f9cc4', 2);
    // as luminárias de pé (a cúpula acesa)
    for (const Lp of Lv.lamps) {
      add(cyl(Lp.r - 0.02, Lp.r, 0.03, 16), { color: '#4a4f57', x: Lp.x, y: FL, z: Lp.z, ao: false });
      add(cyl(0.014, 0.014, 1.42, 6), { color: '#c9a24a', x: Lp.x, y: FL + 0.03, z: Lp.z, ao: false });
      add(cyl(0.12, 0.2, 0.26, 18), { color: '#fff1c2', slot: 'lit', x: Lp.x, y: 1.4, z: Lp.z });
    }
    // a estante de livros no oeste (as prateleiras olham para o leste)
    const Bc = Lv.bookcase;
    {
      const z0 = Bc.z - Bc.hz, z1 = Bc.z + Bc.hz, xf = Bc.x + Bc.hx, wood = vary('#c99b6a', 0.04, 6);
      add(slab(0.015, Bc.h - 0.02, Bc.hz * 2 - 0.02), { color: '#b08452', x: Bc.x - Bc.hx + 0.012, y: FL, z: Bc.z, ao: false });
      for (const z of [z0 + 0.02, Bc.z, z1 - 0.02]) add(rb(Bc.hx * 2 - 0.01, Bc.h, 0.04, 0.008, 1), { color: wood, x: Bc.x, y: FL, z });
      add(rb(Bc.hx * 2 + 0.03, 0.05, Bc.hz * 2 + 0.04, 0.012, 1), { color: '#b5864a', x: Bc.x, y: Bc.h, z: Bc.z, ao: false });
      const ys = [0.06, 0.5, 0.9, 1.3, 1.7];
      for (const y of ys) add(slab(Bc.hx * 2 - 0.04, 0.03, Bc.hz * 2 - 0.04), { color: '#d9b98f', x: Bc.x + 0.005, y, z: Bc.z, ao: false });
      for (let r = 1; r < ys.length; r++) for (const s of [-1, 1]) {
        const a0 = s < 0 ? z0 + 0.05 : Bc.z + 0.03, a1 = s < 0 ? Bc.z - 0.03 : z1 - 0.05, yy = ys[r] + 0.03;
        if ((r + (s > 0 ? 1 : 0)) % 3 === 0) {
          add(cyl(0.07, 0.05, 0.2, 12), { color: ['#8fcdb8', '#f0a58a', '#8a72c2'][r % 3], x: Bc.x + 0.02, y: yy, z: a0 + 0.2, ao: false });
          add(rb(0.02, 0.24, 0.2, 0.008, 1), { color: '#8a5a3c', x: Bc.x + 0.06, y: yy, z: a1 - 0.22, ao: false });
          add(slab(0.004, 0.19, 0.15), { color: '#fff6e6', x: Bc.x + 0.072, y: yy + 0.025, z: a1 - 0.22, ao: false });
          art(add, r % 2 ? 'pata' : 'osso', 0.1, '#e8708a', Bc.x + 0.0765, yy + 0.12, a1 - 0.22, 1, 0);
        } else books(add, 'z', a0, a1 - (r % 2) * 0.2, yy, xf - 0.03, 1, 40 + r * 2 + (s > 0 ? 1 : 0), 0.2);
      }
    }
    // a vitrola em cima do móvel baixo (sul), com os discos embaixo
    const Rc = Lv.record;
    furniture(Rc.x, Rc.z, Math.PI, (b) => {
      const W = Rc.hx * 2, D = Rc.hz * 2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(cyl(0.02, 0.016, 0.16, 8), { color: '#3a2a20', x: sx * (W / 2 - 0.06), z: sz * (D / 2 - 0.06) });
      b.add(rb(W, Rc.h - 0.16, D, 0.015, 1), { color: vary('#a87445', 0.04, 7), y: 0.16 });
      b.add(slab(W - 0.06, 0.012, D - 0.04), { color: '#8a5a3c', y: 0.42 });
      for (let i = 0; i < 9; i++) b.add(slab(0.008, 0.24, D - 0.08), { color: ['#e8475f', '#2a2c2f', '#f2c230', '#3d8fd1', '#2a2c2f'][i % 5], x: -W / 2 + 0.08 + i * 0.03, y: 0.18 });
      // a vitrola: a caixa, o prato, o disco e o braço
      b.add(rb(0.42, 0.1, 0.34, 0.02, 1), { color: '#c9935a', x: 0.1, y: Rc.h });
      b.add(cyl(0.14, 0.14, 0.012, 24), { color: '#3a3d42', x: 0.06, y: Rc.h + 0.1, z: 0.0 });
      b.add(cyl(0.13, 0.13, 0.004, 24), { color: '#1d1f22', x: 0.06, y: Rc.h + 0.112, z: 0.0 });
      b.add(cyl(0.04, 0.04, 0.005, 14), { color: '#e8475f', x: 0.06, y: Rc.h + 0.116, z: 0.0 });
      b.add(rodAB([0.26, Rc.h + 0.13, -0.1], [0.12, Rc.h + 0.125, 0.06], 0.006, 5), { color: '#d0d4d8' });
    });
    // as plantas: o canto sudeste (perto da porta dos fundos), o noroeste e a do lado do rack
    potPlant(Lv.plants[0].x, Lv.plants[0].z, Lv.plants[0].r, 'palma', 81, Math.PI * 0.95, Math.PI * 1.6);
    potPlant(Lv.plants[1].x, Lv.plants[1].z, Lv.plants[1].r, 'ficus', 82);
    potPlant(Lv.plants[2].x, Lv.plants[2].z, Lv.plants[2].r, 'costela', 83);
    // a parede de quadros no norte, a leste do arco; o quadro grande em cima da poltrona de leitura
    const gal = [[-16.3, 1.62, 0.5, 0.62, '#8a5a3c', 'pata', '#5f8fb8'], [-15.62, 1.7, 0.56, 0.48, '#c9a24a', 'sol', '#f2c230'], [-14.98, 1.58, 0.4, 0.5, '#f4b8c8', 'coracao', '#e8475f'], [-15.62, 1.18, 0.34, 0.26, '#8a5a3c', 'osso', '#c79a6a']];
    for (const [x, y, w, h, wood, kind, col] of gal) frame(Number(x), Number(y), ZE + ht, 0, 1, Number(w), Number(h), String(wood), '#fff6e6', String(kind), String(col));
    frame(XW, 1.65, 19.4, 1, 0, 0.8, 0.6, '#c9a24a', '#e8f3fb', 'sol', '#f2c230');
    frame(XW, 1.6, 15.6, 1, 0, 0.44, 0.56, '#8a5a3c', '#fff6e6', 'cenoura', '#f07a1a');
    // o capacho de dentro, na frente da porta dos fundos (rente ao chão)
    add(rb(0.5, 0.012, 0.8, 0.005, 1), { color: '#c98a55', slot: 'ground', x: XE - 0.32, y: FL, z: (EX.z0 + EX.z1) / 2, ao: false });
    artFlat(add, 'pata', 0.28, '#8a5a3c', XE - 0.32, FL + 0.0135, (EX.z0 + EX.z1) / 2, Math.PI / 2, { slot: 'ground' });
  }
  // o ventilador de teto da sala (gira devagar: a única peça da ala que se mexe sozinha)
  const fan = new THREE.Group();
  fan.name = 'recanto:ventilador-de-teto';
  fan.position.set(-14.4, CEIL, 16.9);
  {
    const b = createBaker();
    b.add(cyl(0.03, 0.03, 0.22, 8), { color: '#c9a24a', y: -0.22 });
    b.add(cyl(0.11, 0.08, 0.1, 16), { color: '#e8dcc8', y: -0.32 });
    b.add(cyl(0.06, 0.06, 0.04, 14), { color: '#c9a24a', y: -0.27 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      b.add(rb(0.58, 0.012, 0.13, 0.005, 1), { color: vary('#a87445', 0.05, 11), x: Math.cos(a) * 0.38, y: -0.29, z: Math.sin(a) * 0.38, ry: -a, rx: 0.08 });
      b.add(rb(0.12, 0.02, 0.04, 0.005, 1), { color: '#c9a24a', x: Math.cos(a) * 0.12, y: -0.28, z: Math.sin(a) * 0.12, ry: -a });
    }
    fan.add(bakedMesh(b, 'ventilador:pas', { rough: 0.6, cast: false }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#fff1c2', emissive: '#ffcf7a', emissiveIntensity: 0.8, roughness: 0.5 }));
    glow.position.y = -0.37;
    fan.add(glow);
  }
  keep(fan);

  // ---------------------------------------------------------------- o vidro das janelas e as manchas de sol
  const panes = new THREE.Mesh(glassB.build(), new THREE.MeshStandardMaterial({ color: '#bfe3f5', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
  panes.name = 'recanto:vidros-da-ala-sul';
  keep(panes);
  if (sunPos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(sunPos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(sunPos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const sun = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#fff0c4', transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    sun.name = 'recanto:sol-das-janelas-da-ala-sul';
    sun.renderOrder = 1;
    keep(sun);
  }

  // =========================================================================================== as peças que se mexem
  // ---------------------------------------------------------------- o aspirador robô (os olhos de luz e a escovinha)
  const VC = L.VACUUM;
  const vacuum = new THREE.Group();
  vacuum.name = 'recanto:aspirador';
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#d8f2ff', emissive: '#4fb3ff', emissiveIntensity: 1.2, roughness: 0.3 });
  const vBody = new THREE.Group();
  vacuum.add(vBody);
  /** @type {THREE.Mesh[]} */
  const eyes = [];
  const brush = new THREE.Group();
  {
    const b = createBaker();
    const r = VC.r - 0.005, y0 = 0.012, hh = VC.h - 0.02;
    b.add(cyl(r, r, hh, 28), { color: '#e9ecef', y: y0 });
    b.add(cyl(r - 0.012, r - 0.004, 0.012, 28), { color: '#3a3d42', y: y0 + hh });
    b.add(cyl(r - 0.06, r - 0.05, 0.006, 24), { color: '#2a2c2f', y: y0 + hh + 0.012 });
    // a torrinha do laser atrás e o para-choque na frente (+z local)
    b.add(cyl(0.035, 0.038, 0.022, 16), { color: '#4a4f57', y: y0 + hh + 0.012, z: -0.07 });
    b.add(new THREE.TorusGeometry(r + 0.002, 0.012, 6, 24, Math.PI).rotateX(Math.PI / 2), { color: '#4a4f57', y: y0 + hh * 0.5 });
    // a faixa de cor e o botão
    b.add(new THREE.TorusGeometry(r - 0.001, 0.004, 4, 28).rotateX(Math.PI / 2), { color: '#5aa7c9', y: y0 + hh - 0.006 });
    b.add(cyl(0.016, 0.016, 0.004, 12), { color: '#8fcdb8', y: y0 + hh + 0.018, z: 0.05 });
    vBody.add(bakedMesh(b, 'aspirador:corpo', { rough: 0.45, cast: true }));
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), eyeMat);
      e.position.set(s * 0.035, y0 + hh + 0.016, 0.1);
      e.scale.set(1.2, 1, 0.6);
      vBody.add(e);
      eyes.push(e);
    }
    // a escovinha lateral (três cerdas), embaixo da frente, do lado esquerdo
    const bb = createBaker();
    for (let i = 0; i < 3; i++) bb.add(rodAB([0, 0, 0], [Math.cos((i / 3) * TAU) * 0.07, -0.004, Math.sin((i / 3) * TAU) * 0.07], 0.004, 4), { color: '#2a2c2f' });
    brush.add(bakedMesh(bb, 'aspirador:escovinha', { rough: 0.8, cast: false }));
    brush.position.set(-0.1, 0.012, 0.09);
    vacuum.add(brush);
  }
  vacuum.traverse((o) => { if (/** @type {any} */ (o).isMesh) /** @type {any} */ (o).receiveShadow = true; });
  keep(vacuum);
  const vacState = { mode: 'sleep', blink: 2.2, wob: 0, t: 0 };
  const EYE = { sleep: ['#0a3a1a', '#3dff7a', 0.5], patrol: ['#d8f2ff', '#4fb3ff', 1.2], scared: ['#ffd0d0', '#ff4a4a', 1.5], home: ['#fff3c0', '#ffc24a', 1.2] };
  const vacProp = {
    object: vacuum,
    /** Onde ele está e para onde a frente (+z local) aponta. */
    setPose(x, z, yaw) { vacuum.position.set(x, 0, z); vacuum.rotation.y = yaw; },
    /** 'sleep' (na base: olhos fechados e verdes), 'patrol', 'scared' (vermelho, tremendo) ou 'home' (amarelo). */
    setMode(m) {
      vacState.mode = m;
      const [c, e, k] = EYE[m] ?? EYE.patrol;
      eyeMat.color.set(c);
      eyeMat.emissive.set(e);
      eyeMat.emissiveIntensity = k;
    },
    get mode() { return vacState.mode; },
  };
  vacProp.setPose(VC.dock.x, VC.dock.z, VC.dock.yaw);
  vacProp.setMode('sleep');
  const updateVacuum = (dt) => {
    vacState.t += dt;
    const awake = vacState.mode !== 'sleep';
    // a escovinha gira enquanto ele anda; os olhos piscam; assustado, ele treme
    if (awake) brush.rotation.y += dt * 14;
    vacState.blink -= dt;
    let lid = awake ? 1 : 0.18;
    if (vacState.blink < 0.12 && awake) lid = 0.15;
    if (vacState.blink <= 0) vacState.blink = 2.4 + Math.sin(vacState.t * 3.1) * 0.6;
    for (const e of eyes) e.scale.y = lid;
    vBody.rotation.z = vacState.mode === 'scared' ? Math.sin(vacState.t * 40) * 0.05 : 0;
    vBody.position.y = vacState.mode === 'scared' ? Math.abs(Math.sin(vacState.t * 22)) * 0.006 : 0;
  };

  // ---------------------------------------------------------------- a toalha da mesa de jantar (uma grade que drapeia)
  const TC = L.TABLECLOTH;
  const NU = 44, NV = 24;
  const clothLU = DT.hx * 2 + TC.side + TC.end, clothLV = DT.hz * 2 + TC.side * 2;
  const clothU0 = DT.x - DT.hx - TC.side, clothV0 = DT.z - DT.hz - TC.side;
  const cloth = new THREE.BufferGeometry();
  const cPos = new Float32Array(NU * NV * 3), cNor = new Float32Array(NU * NV * 3), cCol = new Float32Array(NU * NV * 3);
  {
    const base = C('#fff6e6'), red = C('#d9534f'), soft = C('#f4d9c8'), o = new THREE.Color();
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const u = (i / (NU - 1)) * clothLU, v = (j / (NV - 1)) * clothLV;
      const de = Math.min(u, clothLU - u, v, clothLV - v);
      // a barra bordada (duas linhas vermelhas) e os pontinhos de cruz no meio
      if (de < 0.035 || (de > 0.075 && de < 0.1)) o.copy(red);
      else if (de < 0.075) o.copy(soft);
      else o.copy(((i + j) % 6 === 0 && de > 0.2) ? soft : base);
      const k = (j * NU + i) * 3;
      cCol[k] = o.r; cCol[k + 1] = o.g; cCol[k + 2] = o.b;
    }
    const idx = [];
    for (let j = 0; j < NV - 1; j++) for (let i = 0; i < NU - 1; i++) {
      const a = j * NU + i, b = a + 1, c = a + NU, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    cloth.setIndex(idx);
    cloth.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
    cloth.setAttribute('normal', new THREE.BufferAttribute(cNor, 3));
    cloth.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
  }
  const clothMesh = new THREE.Mesh(cloth, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }));
  clothMesh.name = 'recanto:toalha-da-mesa';
  clothMesh.castShadow = true;
  clothMesh.receiveShadow = true;
  clothMesh.frustumCulled = false;
  keep(clothMesh);
  const clothSt = { slide: 0, dirty: true, grip: /** @type {null | (() => ({ pos: THREE.Vector3, k: number } | null))} */ (null) };
  const TOP = DT.h + 0.006, OFF = 0.014, FLOOR = 0.008;
  const tx0 = DT.x - DT.hx, tx1 = DT.x + DT.hx, tz0 = DT.z - DT.hz, tz1 = DT.z + DT.hz;
  const _cp = new THREE.Vector3();
  /** Onde fica o ponto (X, Z) da toalha esticada: em cima da mesa, ou pendurado da beirada mais perto (e no chão). */
  function drape(X, Z, out) {
    const ex = clamp(X, tx0, tx1), ez = clamp(Z, tz0, tz1);
    const dx = X - ex, dz = Z - ez, d = Math.hypot(dx, dz);
    if (d < 1e-6) return out.set(X, TOP, Z);
    const nx = dx / d, nz = dz / d;
    const y = TOP - d;
    if (y >= FLOOR) return out.set(ex + nx * OFF, y, ez + nz * OFF);
    const over = FLOOR - y;
    return out.set(ex + nx * (OFF + over), FLOOR, ez + nz * (OFF + over));
  }
  const _M = new THREE.Vector3(), _E = new THREE.Vector3(), _Q = new THREE.Vector3();
  function layoutCloth() {
    const g = clothSt.grip ? clothSt.grip() : null;
    const gk = g && g.k > 0 ? g.k : 0;
    if (gk > 0) _M.copy(g.pos);
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const X = clothU0 + (i / (NU - 1)) * clothLU + clothSt.slide, Z = clothV0 + (j / (NV - 1)) * clothLV;
      drape(X, Z, _cp);
      // a ponta do leste presa na boca de quem puxa: da beirada da mesa até a boca e, o que sobra, pendurado dela
      if (gk > 0 && X > tx1) {
        const lat = Math.abs(Z - _M.z), w = gk * (1 - clamp01((lat - 0.2) / 0.45));
        if (w > 0) {
          const ez = clamp(Z, tz0, tz1);
          _E.set(tx1 + OFF, TOP, ez);
          const s = X - tx1, Lm = _E.distanceTo(_M);
          if (s <= Lm) _Q.copy(_E).lerp(_M, s / Math.max(1e-4, Lm));
          else { _Q.copy(_M); _Q.y = Math.max(FLOOR, _M.y - (s - Lm)); if (_M.y - (s - Lm) < FLOOR) _Q.x += FLOOR - (_M.y - (s - Lm)); }
          _cp.lerp(_Q, w);
        }
      }
      const k = (j * NU + i) * 3;
      cPos[k] = _cp.x; cPos[k + 1] = _cp.y; cPos[k + 2] = _cp.z;
    }
    // as normais pela grade (vizinhos), sem alocar
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(NU - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(NV - 1, j + 1);
      const a = (j * NU + i0) * 3, b = (j * NU + i1) * 3, c = (j0 * NU + i) * 3, d = (j1 * NU + i) * 3;
      const ux = cPos[b] - cPos[a], uy = cPos[b + 1] - cPos[a + 1], uz = cPos[b + 2] - cPos[a + 2];
      const vx = cPos[d] - cPos[c], vy = cPos[d + 1] - cPos[c + 1], vz = cPos[d + 2] - cPos[c + 2];
      let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
      const n = Math.hypot(nx, ny, nz) || 1;
      nx /= n; ny /= n; nz /= n;
      const k = (j * NU + i) * 3;
      cNor[k] = nx; cNor[k + 1] = ny; cNor[k + 2] = nz;
    }
    cloth.attributes.position.needsUpdate = true;
    cloth.attributes.normal.needsUpdate = true;
    clothSt.dirty = false;
  }
  layoutCloth();
  cloth.computeBoundingSphere();
  const tablecloth = {
    object: clothMesh,
    /** Quanto a toalha já escorregou para o leste (m). */
    setSlide(p) { if (p !== clothSt.slide) { clothSt.slide = p; clothSt.dirty = true; } },
    /** Mordendo: src() → { pos (a boca), k } ou null; enquanto morde, a ponta segue a boca. */
    setGrip(src) { clothSt.grip = src || null; clothSt.dirty = true; },
    /** O ponto de morder agora (a ponta do leste pendurada, no meio, com o quanto já escorregou). */
    bitePoint() { return { x: TC.bite.x + clothSt.slide, y: TC.bite.y, z: TC.bite.z }; },
    get slide() { return clothSt.slide; },
  };

  // ---------------------------------------------------------------- a lata de biscoito (a tampa, o biscoito, a etiqueta)
  const CK = L.COOKIE_TIN;
  const tin = new THREE.Group();
  tin.name = 'recanto:lata-de-biscoito';
  const tinBody = new THREE.Group();
  tin.add(tinBody);
  {
    const b = createBaker();
    const r = CK.r, hh = CK.h - 0.022;
    b.add(cyl(r, r, hh, 26), { color: vary('#2f5f9f', 0.03, 30), y: 0 });
    b.add(new THREE.TorusGeometry(r, 0.004, 4, 26).rotateX(Math.PI / 2), { color: '#d9b25a', y: hh * 0.25 });
    b.add(new THREE.TorusGeometry(r, 0.004, 4, 26).rotateX(Math.PI / 2), { color: '#d9b25a', y: hh * 0.75 });
    // por dentro: o fundo, os carretéis de linha e os botões (a lata é de costura, não de biscoito!)
    b.add(cyl(r - 0.006, r - 0.006, 0.004, 22), { color: '#f4e3c8', y: hh - 0.03 });
    for (const [dx, dz, col] of [[-0.04, 0.02, '#e8475f'], [0.03, -0.035, '#5cb85c'], [0.04, 0.04, '#f2c230']]) {
      b.add(cyl(0.016, 0.016, 0.03, 10), { color: col, x: Number(dx), y: hh - 0.03, z: Number(dz) });
      for (const s of [0, 0.03]) b.add(cyl(0.02, 0.02, 0.004, 10), { color: '#e8d9bd', x: Number(dx), y: hh - 0.03 + s, z: Number(dz) });
    }
    for (const [dx, dz, col] of [[0.0, -0.06, '#8a72c2'], [-0.065, -0.02, '#3d8fd1']]) b.add(cyl(0.011, 0.011, 0.004, 10), { color: col, x: Number(dx), y: hh - 0.026, z: Number(dz) });
    tinBody.add(bakedMesh(b, 'lata:corpo', { rough: 0.35, metal: 0.4 }));
  }
  const lid = new THREE.Group();
  lid.name = 'lata:tampa';
  {
    const b = createBaker();
    b.add(cyl(CK.r + 0.003, CK.r + 0.003, 0.022, 26), { color: vary('#2f5f9f', 0.03, 30) });
    b.add(new THREE.TorusGeometry(CK.r - 0.012, 0.004, 4, 26).rotateX(Math.PI / 2), { color: '#d9b25a', y: 0.022 });
    for (const [g, c] of picto('osso', 0.1)) b.add(g.rotateX(-Math.PI / 2), { color: c ?? '#f4e3c8', y: 0.0225 });
    lid.add(bakedMesh(b, 'lata:tampa', { rough: 0.35, metal: 0.4 }));
  }
  tin.add(lid);
  keep(tin);
  // o biscoito que pula de dentro (um ossinho, igual aos petiscos) e a etiqueta da cenoura (papel pardo, a cenoura em
  // cone desenhada, o barbante)
  const biscuit = new THREE.Group();
  biscuit.name = 'lata:biscoito';
  {
    const b = createBaker();
    b.add(slab(0.06, 0.018, 0.024), { color: '#dba04f', y: -0.009 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(sphere(0.017, 8, 6), { color: '#dba04f', x: sx * 0.032, z: sz * 0.011 });
    biscuit.add(bakedMesh(b, 'biscoito', { rough: 0.6 }));
  }
  biscuit.visible = false;
  keep(biscuit);
  const tag = new THREE.Group();
  tag.name = 'lata:etiqueta-da-cenoura';
  {
    const b = createBaker();
    b.add(shapeXY([[-0.035, -0.05], [0.035, -0.05], [0.035, 0.035], [0, 0.055], [-0.035, 0.035]]).rotateX(-Math.PI / 2), { color: '#d9b98f' });
    b.add(disc(0.007, 0, 0.038).rotateX(-Math.PI / 2), { color: '#8a6a48', y: 0.0006 });
    for (const [g, c] of picto('cenoura', 0.07)) b.add(g.rotateX(-Math.PI / 2), { color: c ?? '#f07a1a', y: 0.0008, z: 0.004 });
    b.add(tubeAlong([[0, 0.002, -0.042], [0.03, 0.003, -0.07], [0.01, 0.002, -0.1], [0.045, 0.002, -0.12]], 0.0025, 4, 10), { color: '#f4ead8' });
    tag.add(bakedMesh(b, 'etiqueta', { rough: 0.9, cast: false }));
  }
  tag.visible = false;
  keep(tag);
  const cookieTin = {
    object: tin, body: tinBody, lid, biscuit, tag,
    /** A lata inteira (o corpo, com a tampa por cima enquanto fechada) em (x, y, z) com os giros. */
    setPose(x, y, z, rx = 0, ry = 0, rz = 0) { tin.position.set(x, y, z); tin.rotation.set(rx, ry, rz); },
    /** A tampa no lugar (0) ou solta (1): solta, ela anda sozinha no mundo (setLidPose). */
    closeLid() { tin.add(lid); lid.position.set(0, CK.h - 0.022, 0); lid.rotation.set(0, 0, 0); },
    setLidPose(x, y, z, rx = 0, ry = 0, rz = 0) { root.add(lid); lid.position.set(x, y, z); lid.rotation.set(rx, ry, rz); },
  };
  cookieTin.closeLid();
  cookieTin.setPose(CK.x, TOP, CK.z);

  // ---------------------------------------------------------------- o pufe da sala (caixa de empurrar)
  const PF = L.POUF;
  const pouf = new THREE.Group();
  pouf.name = 'recanto:pufe';
  {
    const b = createBaker();
    const r = PF.half - 0.02, hgt = PF.height - 0.012;
    const mustard = vary('#e8a04a', 0.05, 12);
    b.add(cyl(r - 0.01, r - 0.02, hgt - 0.06, 24), { color: mustard, y: 0.012 });
    b.add(cyl(r, r - 0.01, 0.06, 24), { color: '#f2b866', y: hgt - 0.05 });
    b.add(new THREE.TorusGeometry(r - 0.005, 0.01, 6, 28).rotateX(Math.PI / 2), { color: '#c9802f', y: hgt - 0.05 });
    b.add(new THREE.TorusGeometry(r - 0.018, 0.01, 6, 28).rotateX(Math.PI / 2), { color: '#c9802f', y: 0.02 });
    // os gomos (costuras em pé) e o botão do capitonê
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      b.add(slab(0.008, hgt - 0.1, 0.004), { color: '#c9802f', x: Math.cos(a) * (r - 0.012), y: 0.05, z: Math.sin(a) * (r - 0.012), ry: -a + Math.PI / 2 });
    }
    b.add(sphere(0.022, 10, 6), { color: '#8a5a3c', y: hgt + 0.012, sy: 0.6 });
    pouf.add(bakedMesh(b, 'pufe:corpo', { rough: 0.85 }));
  }
  keep(pouf);
  const setPouf = (x, z) => pouf.position.set(x, 0, z);
  setPouf(PF.start.x, PF.start.z);

  // ---------------------------------------------------------------- a porta dos fundos (a folha na dobradiça e o trinco)
  // a folha ao longo de −Z local a partir da dobradiça; com ela fechada, o +X local é o quintal e o −X, a sala
  const exitDoor = new THREE.Group();
  exitDoor.name = 'recanto:porta-dos-fundos';
  exitDoor.position.set(ED.hinge.x, 0, ED.hinge.z);
  const bolt = new THREE.Group();
  const LT = L.EXIT_LATCH;
  {
    const b = createBaker();
    const Ld = ED.length - 0.024, zc = -0.012 - Ld / 2, T = 0.05, y0 = 0.025, top = ED.h - 0.005, gy0 = 1.05, gy1 = top - 0.12, sw = 0.12;
    const green = vary('#5f9a7a', 0.05, 11), dk = '#4f8468';
    b.add(slab(T, gy0 - y0, Ld), { color: green, y: y0, z: zc });
    b.add(slab(T, top - gy1, Ld), { color: green, y: gy1, z: zc });
    for (const s of [-1, 1]) b.add(slab(T, gy1 - gy0, sw), { color: green, y: gy0, z: zc + s * (Ld / 2 - sw / 2) });
    b.add(slab(T - 0.012, gy1 - gy0, 0.035), { color: dk, y: gy0, z: zc });
    for (const yy of [(gy0 * 2 + gy1) / 3, (gy0 + gy1 * 2) / 3]) b.add(slab(T - 0.012, 0.03, Ld - sw * 2), { color: dk, y: yy - 0.015, z: zc });
    // as almofadas de baixo dos dois lados, a chapa de chute de dentro, a maçaneta de alavanca dos dois lados
    for (const sx of [-1, 1]) for (const [py, ph] of [[0.12, 0.38], [0.58, 0.36]]) b.add(rb(0.012, ph, Ld - 0.24, 0.004, 1), { color: dk, x: sx * (T / 2 + 0.004), y: py, z: zc });
    b.add(slab(0.006, 0.14, Ld - 0.06), { color: '#c9a24a', x: -T / 2 - 0.002, y: 0.035, z: zc });
    for (const sx of [-1, 1]) {
      b.add(rb(0.012, 0.16, 0.05, 0.006, 1), { color: '#d9b25a', x: sx * (T / 2 + 0.006), y: 0.92, z: -Ld + 0.09 });
      b.add(rodAB([sx * (T / 2 + 0.012), 1.0, -Ld + 0.09], [sx * (T / 2 + 0.05), 1.0, -Ld + 0.21], 0.01, 6), { color: '#d9b25a' });
    }
    // a chapa do trinco, do lado de dentro, perto da beirada do trinco (as guias da barra)
    b.add(rb(0.008, 0.07, 0.16, 0.004, 1), { color: '#c9a24a', x: -T / 2 - 0.004, y: LT.y - 0.035, z: -Ld + 0.1 });
    for (const zz of [-Ld + 0.04, -Ld + 0.15]) b.add(rb(0.024, 0.026, 0.016, 0.004, 1), { color: '#b8913f', x: -T / 2 - 0.014, y: LT.y - 0.013, z: zz });
    exitDoor.add(bakedMesh(b, 'porta-fundos:folha', { rough: 0.6 }));
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.012, gy1 - gy0, Ld - sw * 2), new THREE.MeshStandardMaterial({ color: '#a9d2ea', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }));
    pane.position.set(0, (gy0 + gy1) / 2, zc);
    exitDoor.add(pane);
    // a barra do trinco (corre ao longo da folha: trancada, passa da beirada e entra na chapa do batente) e o pino
    const bb = createBaker();
    bb.add(rod(0.008, 0.2, 8).rotateX(Math.PI / 2), { color: '#d0b25a', z: -0.1 });
    bb.add(rodAB([0, 0, -0.09], [-0.035, 0.0, -0.09], 0.007, 6), { color: '#d0b25a' });
    bb.add(sphere(0.012, 8, 6), { color: '#e8554a', x: -0.04, z: -0.09 });
    bolt.add(bakedMesh(bb, 'porta-fundos:trinco', { rough: 0.35, metal: 0.6 }));
    bolt.position.set(-T / 2 - 0.016, LT.y, -Ld + 0.12);
    exitDoor.add(bolt);
  }
  keep(exitDoor);
  // a chapa do trinco no batente (fixa, no lado de dentro)
  add(rb(0.02, 0.06, 0.05, 0.004, 1), { color: '#c9a24a', x: XE - 0.01, y: LT.y - 0.03, z: EX.z0 - 0.035, ao: false });
  const setExit = (k) => { exitDoor.rotation.y = ED.closedYaw + (ED.openYaw - ED.closedYaw) * clamp01(k); };
  /** O trinco: 0 trancado (a barra passa da beirada da folha e entra na chapa), 1 aberto (recolhida). */
  const setLatch = (k) => { bolt.position.z = -(ED.length - 0.024) + 0.12 - 0.075 * (1 - clamp01(k)); };
  setExit(0);
  setLatch(0);

  return {
    props: {
      vacuum: vacProp,
      pantry: {
        object: pantryMesh,
        /** A luz da despensa (0 apagada, 1 acesa). */
        setLit,
        get lit() { return pantryState.lit; },
      },
      pantrySwitch,
      tablecloth,
      cookieTin,
      pouf: { object: pouf, setPos: setPouf },
      exitDoor: { object: exitDoor, setOpen: setExit, setLatch },
      wing: { fan },
    },
    seeThrough: [exitDoor, fan, clothMesh],
    signs: [],
    update(dt) {
      updateVacuum(dt);
      updatePantry(dt);
      fan.rotation.y += dt * 1.6;
      if (clothSt.dirty || clothSt.grip) layoutCloth();
    },
    reset() {
      vacProp.setPose(VC.dock.x, VC.dock.z, VC.dock.yaw);
      vacProp.setMode('sleep');
      setLit(0);
      pantrySwitch.setOn(false);
      pantrySwitch.setPress(0);
      clothSt.grip = null;
      tablecloth.setSlide(0);
      layoutCloth();
      cookieTin.closeLid();
      cookieTin.setPose(CK.x, TOP, CK.z);
      biscuit.visible = false;
      tag.visible = false;
      setPouf(PF.start.x, PF.start.z);
      setExit(0);
      setLatch(0);
    },
    dispose() { clothSt.grip = null; },
  };
}
