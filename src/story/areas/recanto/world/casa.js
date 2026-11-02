// RECANTO DAS PATINHAS — a casa das irmãs em corte de maquete e o quintal.
// O QUARTO (lilás): a caminha redonda embaixo do basculante, o pote d'água (vira de manhã), o guarda-roupa, o cesto
// de brinquedos, cortininhas e a luzinha de noite. A COZINHA: bancada com pia e fogão, armários, a geladeira retrô e a
// mesa (a Radhija passa por baixo); a porta para o quintal tem a maçaneta de alavanca do lado de dentro (impulso da
// Rhaenyra, com as patinhas pintadas). A SALA, ao sul: sofá, aparador e tapete. As paredes do norte e do oeste e a da
// cozinha a leste são inteiras; as do lado da câmera e as de dentro ficam cortadas baixas, com o corte escuro no topo.
// O QUINTAL: muro baixo com a porta da área de serviço (abre para dentro, travada pelo galho da tempestade; embaixo
// dele, as telhas quebradas), a casinha de cachorro (só a Radhija entra), canteiros e pedrinhas no gramado.
import * as THREE from 'three';
import { rng, foliageCluster } from '../../../../world/util.js';
import { geranium, lavender, smallFlowers } from '../../../../world/plants.js';
import { buildWallButton } from '../../../../world/wallButton.js';
import { rb, cyl, slab, sphere, tiles, gableRoof } from '../../../../levels/mapa/world/kit.js';

const C = (hex) => new THREE.Color(hex);
const CUT = '#5a3d2b'; // o corte das paredes (topo escuro da maquete)
const TRIM = '#fff8ec';

/** Cor por face: `inside` na face de dentro (normal · dir < −0,5), `out` nas outras. */
function twoTone(out, inside, dx, dz) {
  const a = C(out), b = typeof inside === 'function' ? null : C(inside);
  return (p, n) => (n.x * dx + n.z * dz < -0.5 ? (b ?? inside(p, n)) : a);
}
/** Variação suave de uma cor (reboco, madeira). */
function vary(hex, amp = 0.05, f = 7) {
  const c = C(hex), out = new THREE.Color();
  return (p) => {
    const n = Math.sin(p.x * f * 1.7 + p.z * f * 2.3 + p.y * f) * 0.5 + Math.sin(p.x * f * 5.1 - p.z * f * 3.7) * 0.5;
    return out.copy(c).multiplyScalar(1 + n * amp);
  };
}
/** Tábuas: cor por tábua (linha e coluna), com o veio mais escuro nas juntas. */
function planks(base, alt) {
  const a = C(base), b = C(alt), out = new THREE.Color();
  return (p) => {
    const row = Math.floor(p.z / 0.16);
    const col = Math.floor((p.x + (row % 2) * 0.45) / 0.9);
    const k = Math.abs(Math.sin(row * 12.9898 + col * 78.233)) % 1;
    return out.copy(a).lerp(b, k * 0.8);
  };
}
/** Ladrilho xadrez. */
function checker(a, b) {
  const ca = C(a), cb = C(b);
  return (p) => ((Math.floor(p.x / 0.3) + Math.floor(p.z / 0.3)) % 2 === 0 ? ca : cb);
}

/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildCasa(kit, root, L) {
  const R = rng(31);
  const H = L.HOUSE, WL = L.WALLS, RM = L.ROOMS, t = WL.t;
  const own = [];
  const keep = (o) => { own.push(o); root.add(o); return o; };
  const add = (geo, o) => kit.add(geo, { group: 'casa', ...o });
  const addY = (geo, o) => kit.add(geo, { group: 'quintal', ...o });

  // ---------------------------------------------------------------- pisos (logo acima do gramado: as patas ficam no chão)
  const floor = (r, fn, cw, cd) => {
    const w = r.x1 - r.x0 - t, d = r.z1 - r.z0 - t;
    add(tiles(w, d, cw, cd, (p) => fn({ x: p.x + (r.x0 + r.x1) / 2, z: p.z + (r.z0 + r.z1) / 2 })), { color: null, slot: 'ground', x: (r.x0 + r.x1) / 2, y: 0.006, z: (r.z0 + r.z1) / 2, ao: false });
  };
  floor(RM.quarto, planks('#c8955f', '#a87445'), 0.45, 0.16);
  floor(RM.cozinha, checker('#f3e6cf', '#d9876a'), 0.3, 0.3);
  floor(RM.sala, planks('#b98252', '#9a6a40'), 0.45, 0.16);

  // ---------------------------------------------------------------- paredes
  const lilac = '#e7dcf2', mint = '#e5f1e1', yellow = '#f6e8c4', plaster = '#f3d9bf';
  /** Parede ao longo de x (de x0 a x1, em z), da altura y0 até y1: `out` no lado `dir` (±1 em z) e `inside` no outro. */
  // em 3ª pessoa a casa é inteira (paredes até o forro, telhado por cima): o corte escuro de maquete só aparece numa
  // parede que não chega ao alto
  const wallX = (x0, x1, z, y0, y1, out, inside, insideDir, cut = false) => {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
    add(rb(x1 - x0, y1 - y0, t, 0.025, 1), { color: twoTone(out, inside, 0, insideDir), x: (x0 + x1) / 2, y: y0, z });
    if (cut && y1 < WL.h - 0.01) add(rb(x1 - x0 + 0.01, 0.035, t + 0.012, 0.01, 1), { color: CUT, x: (x0 + x1) / 2, y: y1, z });
  };
  const wallZ = (z0, z1, x, y0, y1, out, inside, insideDir, cut = false) => {
    if (z1 - z0 < 0.01 || y1 - y0 < 0.01) return;
    add(rb(t, y1 - y0, z1 - z0, 0.025, 1), { color: twoTone(out, inside, insideDir, 0), x, y: y0, z: (z0 + z1) / 2 });
    if (cut && y1 < WL.h - 0.01) add(rb(t + 0.012, 0.035, z1 - z0 + 0.01, 0.01, 1), { color: CUT, x, y: y1, z: (z0 + z1) / 2 });
  };
  const W = L.WINDOW;
  // norte (inteira; o lado de fora é o −z): o vão do basculante no quarto
  wallX(H.x0, W.x0, H.z0, 0, WL.h, plaster, lilac, -1, true);
  wallX(W.x1, RM.quarto.x1, H.z0, 0, WL.h, plaster, lilac, -1, true);
  wallX(RM.quarto.x1, H.x1, H.z0, 0, WL.h, plaster, mint, -1, true);
  wallX(W.x0, W.x1, H.z0, 0, W.sill, plaster, lilac, -1);
  wallX(W.x0, W.x1, H.z0, W.top, WL.h, plaster, lilac, -1, true);
  // oeste (inteira, é o muro do condomínio do lado de fora)
  wallZ(H.z0, RM.quarto.z1, H.x0, 0, WL.h, '#efe2c8', lilac, -1, true);
  wallZ(RM.quarto.z1, H.z1, H.x0, 0, WL.h, '#efe2c8', yellow, -1, true);
  // leste: a cozinha inteira, com o vão da porta (verga em cima); a sala cortada
  const KD = L.KITCHEN_DOOR;
  wallZ(H.z0, KD.hinge.z, H.x1, 0, WL.h, plaster, mint, 1, true);
  wallZ(KD.latchPost.z, RM.cozinha.z1, H.x1, 0, WL.h, plaster, mint, 1, true);
  wallZ(KD.hinge.z, KD.latchPost.z, H.x1, KD.h + 0.04, WL.h, plaster, mint, 1, true);
  wallZ(RM.cozinha.z1, H.z1, H.x1, 0, WL.h, plaster, yellow, 1, true);
  // sul (inteira)
  wallX(H.x0, H.x1, H.z1, 0, WL.h, plaster, yellow, 1, true);
  // de dentro (inteiras), com as passagens e a verga em cima de cada uma
  const DQ = L.DOORWAYS.quartoCozinha, DS = L.DOORWAYS.cozinhaSala;
  const PASS_H = 2.05;
  wallZ(H.z0, DQ.z0, DQ.x, 0, WL.h, mint, lilac, 1, true);
  wallZ(DQ.z1, RM.quarto.z1, DQ.x, 0, WL.h, mint, lilac, 1, true);
  wallZ(DQ.z0, DQ.z1, DQ.x, PASS_H, WL.h, mint, lilac, 1, true);
  wallX(H.x0, RM.quarto.x1, RM.quarto.z1, 0, WL.h, yellow, lilac, 1, true);
  wallX(RM.cozinha.x0, DS.x0, RM.cozinha.z1, 0, WL.h, yellow, mint, 1, true);
  wallX(DS.x1, H.x1, RM.cozinha.z1, 0, WL.h, yellow, mint, 1, true);
  wallX(DS.x0, DS.x1, RM.cozinha.z1, PASS_H, WL.h, yellow, mint, 1, true);
  // o forro (de dentro) e o telhado de duas águas (por fora): sem sombra própria, para o sol da cena continuar
  // entrando nos cômodos (as cenas do quarto foram compostas assim)
  const hw = H.x1 - H.x0, hd = H.z1 - H.z0;
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(hw - t, 0.04, hd - t), new THREE.MeshStandardMaterial({ color: '#f6efe4', roughness: 0.9 }));
  ceiling.name = 'recanto:forro';
  // o topo 6 mm abaixo do alto das paredes (no mesmo plano, brigaria com elas: z-fighting)
  ceiling.position.set((H.x0 + H.x1) / 2, WL.h - 0.026, (H.z0 + H.z1) / 2);
  ceiling.receiveShadow = true;
  keep(ceiling);
  const roofGeo = gableRoof(hw + 0.6, hd + 0.6, 1.35);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: '#c4643f', roughness: 0.82 }));
  roof.name = 'recanto:telhado';
  roof.position.set((H.x0 + H.x1) / 2, WL.h, (H.z0 + H.z1) / 2);
  roof.receiveShadow = true;
  keep(roof);
  // rodapés de dentro (encostados nas paredes: dentro da colisão delas)
  const base = (x0, x1, z0, z1) => add(slab(Math.max(0.02, x1 - x0), 0.07, Math.max(0.02, z1 - z0)), { color: TRIM, x: (x0 + x1) / 2, y: 0.006, z: (z0 + z1) / 2 });
  base(H.x0 + t / 2, W.x0, H.z0 + t / 2, H.z0 + t / 2 + 0.018);
  base(W.x1, H.x1 - t / 2, H.z0 + t / 2, H.z0 + t / 2 + 0.018);
  base(H.x0 + t / 2, H.x0 + t / 2 + 0.018, H.z0 + t / 2, RM.quarto.z1 - t / 2);
  // por fora, a barra da base e o rufo no alto da parede norte
  add(rb(H.x1 - H.x0 + 0.04, 0.24, 0.05, 0.015, 1), { color: '#d8bfa0', x: (H.x0 + H.x1) / 2, z: H.z0 - t / 2 - 0.02 });
  add(rb(H.x1 - H.x0 + 0.06, 0.08, 0.1, 0.02, 1), { color: TRIM, x: (H.x0 + H.x1) / 2, y: WL.h - 0.08, z: H.z0 - t / 2 - 0.04 });
  // a calha e o cano de descida na quina nordeste (colado na parede)
  add(cyl(0.035, 0.035, WL.h - 0.1, 8), { color: '#d8d0c4', x: H.x1 + 0.06, z: H.z0 - t / 2 - 0.05 });

  // ---------------------------------------------------------------- o basculante
  const cx = (W.x0 + W.x1) / 2, ww = W.x1 - W.x0, wh = W.top - W.sill;
  // batentes brancos e os dois parapeitos (o de fora, onde os pombos pousam; o de dentro, onde ficou a baba)
  add(rb(0.06, wh + 0.08, t + 0.04, 0.012, 1), { color: TRIM, x: W.x0 + 0.03, y: W.sill - 0.04, z: H.z0 });
  add(rb(0.06, wh + 0.08, t + 0.04, 0.012, 1), { color: TRIM, x: W.x1 - 0.03, y: W.sill - 0.04, z: H.z0 });
  add(rb(ww, 0.06, t + 0.04, 0.012, 1), { color: TRIM, x: cx, y: W.top - 0.03, z: H.z0 });
  const SO = L.SILL.out, SI = L.SILL.in;
  add(rb(SO.w, 0.04, SO.d, 0.01, 1), { color: '#d6cfc4', x: SO.x, y: SO.y - 0.04, z: SO.z });
  add(rb(SI.w, 0.035, SI.d, 0.01, 1), { color: '#c79a6a', x: SI.x, y: SI.y - 0.035, z: SI.z });
  const leaf = new THREE.Group();
  leaf.name = 'recanto:basculante';
  leaf.position.set(cx, W.sill, H.z0);
  const glassMat = new THREE.MeshStandardMaterial({ color: '#a9d2ea', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.55, depthWrite: false });
  const frameMat = new THREE.MeshStandardMaterial({ color: TRIM, roughness: 0.55 });
  const slats = [];
  const n = 3, sh = (wh - 0.06) / n;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    g.position.y = 0.03 + sh * (i + 0.5);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(ww - 0.12, sh - 0.025, 0.012), glassMat);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(ww - 0.1, 0.022, 0.03), frameMat);
    fr.position.y = -(sh - 0.025) / 2;
    g.add(glass, fr);
    leaf.add(g);
    slats.push(g);
  }
  // a alavanca do basculante, do lado de dentro, à direita (a mão da tutora puxa)
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.03), new THREE.MeshStandardMaterial({ color: '#c9b27a', roughness: 0.35, metalness: 0.6 }));
  lever.name = 'alavanca';
  lever.position.set(ww / 2 - 0.1, 0.18, 0.05);
  leaf.add(lever);
  leaf.traverse((o) => { if (/** @type {any} */ (o).isMesh) o.castShadow = true; });
  keep(leaf);
  const setWindow = (k) => {
    const a = Math.max(0, Math.min(1, k)) * W.openAngle;
    for (const s of slats) s.rotation.x = -a;
    lever.rotation.x = -a * 0.6;
  };
  setWindow(1);
  // cortininhas e o varão
  add(rod(0.012, ww + 0.5), { color: '#c9b27a', x: cx, y: W.top + 0.12, z: H.z0 + t / 2 + 0.05, rz: Math.PI / 2 });
  for (const side of [-1, 1]) {
    add(rb(0.26, 0.92, 0.03, 0.012, 1), { color: vary('#f4b8c8', 0.05, 30), x: cx + side * (ww / 2 + 0.12), y: W.top + 0.12 - 0.92, z: H.z0 + t / 2 + 0.035 });
  }

  // ---------------------------------------------------------------- quarto
  const B = L.BED;
  {
    const rim = new THREE.TorusGeometry(B.r - B.rim, B.rim, 10, 36).rotateX(Math.PI / 2);
    add(rim, { color: vary('#8a72c2', 0.04, 9), x: B.x, y: B.rim + 0.01, z: B.z });
    add(cyl(B.r - B.rim, B.r - B.rim, 0.1, 36), { color: '#b9a6e3', x: B.x, y: 0.006, z: B.z });
    add(cyl(B.r - B.rim - 0.06, B.r - B.rim - 0.05, 0.03, 30), { color: '#d9ccf2', x: B.x, y: 0.106, z: B.z, ao: false });
    // a mantinha dobrada na beirada da caminha
    add(rb(0.5, 0.05, 0.28, 0.025, 2), { color: vary('#f2c25e', 0.05, 25), x: B.x - 0.28, y: 0.13, z: B.z + 0.32, ry: 0.4 });
  }
  // o pote d'água (vira de manhã: setTipped)
  const BW = L.BOWL;
  const bowl = new THREE.Group();
  bowl.name = 'recanto:pote';
  bowl.position.set(BW.x, 0.006, BW.z);
  const bowlPivot = new THREE.Group();
  bowlPivot.position.x = BW.r; // gira na beirada do leste
  bowl.add(bowlPivot);
  const bowlBody = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.11, 0), new THREE.Vector2(0.15, 0.075), new THREE.Vector2(0.135, 0.08), new THREE.Vector2(0.1, 0.022), new THREE.Vector2(0, 0.022)], 24), new THREE.MeshStandardMaterial({ color: '#d9534f', roughness: 0.35 }));
  bowlBody.position.x = -BW.r;
  bowlBody.castShadow = true;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.115, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7cc3ea', roughness: 0.08, transparent: true, opacity: 0.85 }));
  water.position.set(-BW.r, 0.062, 0);
  bowlPivot.add(bowlBody, water);
  const puddleMat = new THREE.MeshStandardMaterial({ color: '#7cc3ea', roughness: 0.05, transparent: true, opacity: 0.6, depthWrite: false });
  const spill = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), puddleMat);
  spill.position.set(0.28, 0.004, 0.04);
  spill.scale.set(0.001, 1, 0.001);
  spill.renderOrder = 2;
  bowl.add(spill);
  keep(bowl);
  const setTipped = (k) => {
    const u = Math.max(0, Math.min(1, k));
    bowlPivot.rotation.z = -u * 1.75;
    water.visible = u < 0.15;
    spill.scale.set(0.001 + u * 0.36, 1, 0.001 + u * 0.24);
  };
  setTipped(0);
  // guarda-roupa encostado no oeste, com as portas para o leste
  const WR = L.WARDROBE;
  add(rb(WR.hx * 2, WR.h, WR.hz * 2, 0.03, 1), { color: vary('#d9b98f', 0.04, 6), x: WR.x, z: WR.z });
  for (const s of [-1, 1]) {
    add(rb(0.02, WR.h - 0.14, WR.hz - 0.04, 0.008, 1), { color: '#e8cfa8', x: WR.x + WR.hx + 0.004, y: 0.08, z: WR.z + s * WR.hz / 2 });
    add(sphere(0.022, 8, 6), { color: '#c9a24a', x: WR.x + WR.hx + 0.03, y: 1.0, z: WR.z + s * 0.06 });
  }
  add(rb(WR.hx * 2 + 0.04, 0.04, WR.hz * 2 + 0.04, 0.01, 1), { color: '#c9a77d', x: WR.x, y: WR.h, z: WR.z });
  // o cesto de brinquedos (vime, com a bolinha e a corda saindo)
  const TB = L.TOY_BASKET;
  add(cyl(TB.r - 0.01, TB.r - 0.04, 0.3, 14), { color: (p) => C(Math.floor(p.y * 30) % 2 ? '#c99b5a' : '#b5864a'), x: TB.x, z: TB.z });
  add(sphere(0.07, 12, 8), { color: '#5cb85c', x: TB.x + 0.06, y: 0.33, z: TB.z - 0.04 });
  add(cyl(0.025, 0.025, 0.3, 8), { color: '#e8475f', x: TB.x - 0.08, y: 0.18, z: TB.z + 0.05, rz: 0.5 });
  add(sphere(0.055, 10, 8), { color: '#f2c230', x: TB.x - 0.06, y: 0.32, z: TB.z + 0.08 });
  // tapete redondo e a luzinha de noite na parede
  add(cyl(0.95, 0.95, 0.008, 32), { color: (p) => C(Math.hypot(p.x, p.z) > 0.7 ? '#cbb6e8' : '#e8ddf6'), slot: 'ground', x: -12.1, y: 0.009, z: 3.75, ao: false });
  add(sphere(0.06, 12, 8), { color: '#fff1c2', slot: 'lit', x: H.x0 + t / 2 + 0.05, y: 0.8, z: 2.0 });
  // quadrinhos desenhados (nada de foto): um osso e uma cenoura
  const frame = (x, y, z, ry, inner) => {
    add(rb(0.34, 0.28, 0.025, 0.01, 1), { color: '#8a5a3c', x, y, z, ry });
    add(slab(0.28, 0.22, 0.01), { color: '#fff6e6', x: x + Math.sin(ry) * 0.016, y: y + 0.03, z: z + Math.cos(ry) * 0.016, ry });
    inner(x + Math.sin(ry) * 0.024, y + 0.14, z + Math.cos(ry) * 0.024, ry);
  };
  frame(-13.25, 1.55, H.z0 + t / 2 + 0.013, 0, (x, y, z, ry) => {
    add(rb(0.16, 0.035, 0.008, 0.015, 1), { color: '#f4e3c8', x, y: y - 0.02, z, ry });
    for (const s of [-1, 1]) add(sphere(0.026, 8, 6), { color: '#f4e3c8', x: x + s * 0.085, y, z, ry });
  });
  frame(H.x0 + t / 2 + 0.013, 1.5, 3.1, Math.PI / 2, (x, y, z, ry) => {
    const g = new THREE.ConeGeometry(0.03, 0.15, 10);
    g.rotateZ(Math.PI / 2);
    add(g, { color: '#f07a1a', x, y, z, ry });
  });

  // ---------------------------------------------------------------- cozinha
  const K = L.COUNTER;
  const kc = (K.x0 + K.x1) / 2, kd = K.z1 - K.z0, kz = (K.z0 + K.z1) / 2;
  add(rb(K.x1 - K.x0, K.h - 0.05, kd - 0.04, 0.02, 1), { color: vary('#f6efe0', 0.03, 6), x: kc, z: kz - 0.02 });
  add(rb(K.x1 - K.x0 + 0.03, 0.05, kd + 0.02, 0.012, 1), { color: (p) => C(Math.sin(p.x * 91) * Math.sin(p.z * 77) > 0.6 ? '#4f4a44' : '#6a645c'), x: kc, y: K.h - 0.05, z: kz });
  for (let i = 0; i < 5; i++) {
    const dx = K.x0 + 0.34 + i * ((K.x1 - K.x0 - 0.68) / 4);
    add(rb(0.58, 0.68, 0.02, 0.01, 1), { color: '#dfe9d9', x: dx, y: 0.1, z: K.z1 - 0.03 });
    add(rb(0.12, 0.02, 0.025, 0.008, 1), { color: '#c9a24a', x: dx, y: 0.7, z: K.z1 - 0.008 });
  }
  // pia e torneira
  add(rb(0.62, 0.03, 0.4, 0.04, 1), { color: '#b9bdc2', x: -8.65, y: K.h - 0.012, z: kz });
  add(rb(0.5, 0.02, 0.3, 0.05, 1), { color: '#7c8288', x: -8.65, y: K.h - 0.005, z: kz });
  {
    const tap = new THREE.TorusGeometry(0.09, 0.012, 6, 14, Math.PI);
    tap.rotateY(Math.PI / 2);
    add(tap, { color: '#d0d4d8', x: -8.65, y: K.h + 0.02, z: K.z0 + 0.12 });
  }
  // fogão com quatro bocas
  add(rb(0.62, 0.02, 0.5, 0.02, 1), { color: '#2f3134', x: -7.5, y: K.h - 0.004, z: kz });
  for (const [ox, oz] of [[-0.15, -0.11], [0.15, -0.11], [-0.15, 0.12], [0.15, 0.12]]) add(cyl(0.065, 0.065, 0.012, 14), { color: '#45484c', x: -7.5 + ox, y: K.h + 0.012, z: kz + oz });
  add(cyl(0.07, 0.085, 0.14, 12), { color: '#e8475f', x: -7.65, y: K.h + 0.02, z: kz - 0.1 }); // chaleira
  // armários altos e a janelinha de enfeite em cima da pia
  add(rb(K.x1 - K.x0, 0.62, 0.34, 0.02, 1), { color: vary('#f6efe0', 0.03, 6), x: kc, y: 1.55, z: H.z0 + t / 2 + 0.17 });
  for (let i = 0; i < 5; i++) add(rb(0.12, 0.02, 0.025, 0.008, 1), { color: '#c9a24a', x: K.x0 + 0.34 + i * ((K.x1 - K.x0 - 0.68) / 4), y: 1.62, z: H.z0 + t / 2 + 0.35 });
  add(rb(0.7, 0.5, 0.03, 0.012, 1), { color: TRIM, x: -8.65, y: 1.0 + 0.02, z: H.z0 + t / 2 + 0.015 });
  add(slab(0.6, 0.4, 0.012), { color: '#9fd0ec', slot: 'glass', x: -8.65, y: 1.07, z: H.z0 + t / 2 + 0.03 });
  add(rb(0.7, 0.5, 0.03, 0.012, 1), { color: TRIM, x: -8.65, y: 1.02, z: H.z0 - t / 2 - 0.015 });
  add(slab(0.6, 0.4, 0.012), { color: '#9fd0ec', slot: 'glass', x: -8.65, y: 1.07, z: H.z0 - t / 2 - 0.03 });
  // a geladeira retrô
  const F = L.FRIDGE;
  add(rb(F.hx * 2, F.h, F.hz * 2, 0.09, 2), { color: '#a8dcc8', x: F.x, z: F.z });
  add(rb(0.035, 0.42, 0.04, 0.015, 1), { color: '#e4e6e8', x: F.x + F.hx - 0.08, y: 1.05, z: F.z + F.hz + 0.02 });
  add(rb(F.hx * 2 - 0.04, 0.012, 0.012, 0.004, 1), { color: '#7fb8a4', x: F.x, y: 1.0, z: F.z + F.hz + 0.004 });
  for (const [mx, my, mc] of [[-0.1, 1.3, '#e8475f'], [0.06, 1.45, '#f2c230'], [-0.04, 1.2, '#3d8fd1']]) add(cyl(0.025, 0.025, 0.012, 10), { color: mc, x: F.x + mx, y: my, z: F.z + F.hz + 0.006, rx: Math.PI / 2 });
  // a mesa (a Radhija passa por baixo: tampo alto, pés finos nos cantos)
  const KT = L.KITCHEN_TABLE;
  add(rb(KT.hx * 2, 0.045, KT.hz * 2, 0.015, 1), { color: vary('#c9935a', 0.05, 8), x: KT.x, y: KT.h - 0.045, z: KT.z });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(rb(0.045, KT.h - 0.045, 0.045, 0.01, 1), { color: '#a87445', x: KT.x + sx * (KT.hx - 0.05), z: KT.z + sz * (KT.hz - 0.05) });
  add(rb(KT.hx * 1.6, 0.006, KT.hz * 2 + 0.06, 0.003, 1), { color: (p) => C((Math.floor(p.x * 12) + Math.floor(p.z * 12)) % 2 ? '#e8475f' : '#fff6e6'), x: KT.x, y: KT.h, z: KT.z, ao: false });
  add(cyl(0.12, 0.08, 0.06, 14), { color: '#f4e3c8', x: KT.x, y: KT.h + 0.006, z: KT.z });
  for (const [fx, fz, fc] of [[0.03, 0.02, '#e8475f'], [-0.04, -0.01, '#f2c230'], [0.0, -0.05, '#7fb04f']]) add(sphere(0.035, 10, 8), { color: fc, x: KT.x + fx, y: KT.h + 0.08, z: KT.z + fz });

  // a porta da cozinha (folha na dobradiça, com a maçaneta de alavanca do lado de dentro)
  const doorWood = new THREE.MeshStandardMaterial({ color: '#b97a46', roughness: 0.6 });
  const door = new THREE.Group();
  door.name = 'recanto:porta-da-cozinha';
  door.position.set(KD.hinge.x, 0, KD.hinge.z);
  {
    const Ld = KD.length - 0.02;
    const leafM = new THREE.Mesh(new THREE.BoxGeometry(0.05, KD.h, Ld), doorWood);
    leafM.position.set(0, KD.h / 2, -Ld / 2 - 0.01);
    leafM.castShadow = true;
    door.add(leafM);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.42, Ld - 0.3), glassMat);
    pane.position.set(0, KD.h - 0.42, -Ld / 2 - 0.01);
    door.add(pane);
    for (const y of [0.35, 1.05]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.5, Ld - 0.24), new THREE.MeshStandardMaterial({ color: '#a86a3a', roughness: 0.6 }));
      p.position.set(0, y + 0.25, -Ld / 2 - 0.01);
      door.add(p);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: '#d9b25a', roughness: 0.3, metalness: 0.6 }));
    knob.position.set(-0.05, 1.0, -(KD.latchPost.z - KD.hinge.z) + 0.12);
    door.add(knob);
  }
  // a alavanca do lado de dentro: o +Z dela aponta para dentro da cozinha (o −x do mundo com a porta fechada)
  const KH = L.KITCHEN_HANDLE;
  const handle = buildWallButton({ kind: 'lever', top: KH.top, color: '#e8554a', plate: '#f4ecdc', trim: '#7a4e2e', name: 'macaneta-de-alavanca' });
  handle.object.position.set(0.026, 0, -(KH.z - KD.hinge.z));
  handle.object.rotation.y = Math.PI / 2;
  door.add(handle.object);
  keep(door);
  const setDoor = (k) => { door.rotation.y = KD.closedYaw + (KD.openYaw - KD.closedYaw) * k; };
  setDoor(0);
  // o batente da porta da cozinha (dos dois lados) e o tapetinho do quintal
  add(rb(t + 0.06, KD.h + 0.06, 0.06, 0.012, 1), { color: TRIM, x: H.x1, z: KD.hinge.z - 0.03 });
  add(rb(t + 0.06, KD.h + 0.06, 0.06, 0.012, 1), { color: TRIM, x: H.x1, z: KD.latchPost.z + 0.03 });
  add(rb(t + 0.06, 0.06, KD.latchPost.z - KD.hinge.z + 0.12, 0.012, 1), { color: TRIM, x: H.x1, y: KD.h, z: (KD.hinge.z + KD.latchPost.z) / 2 });

  // ---------------------------------------------------------------- sala
  const SF = L.SOFA;
  add(rb(SF.hx * 2, 0.36, SF.hz * 2, 0.06, 2), { color: vary('#5f8fb8', 0.04, 7), x: SF.x, z: SF.z });
  add(rb(SF.hx * 2, 0.42, 0.18, 0.07, 2), { color: vary('#5583ab', 0.04, 7), x: SF.x, y: 0.36, z: SF.z + SF.hz - 0.09 });
  for (const s of [-1, 1]) add(rb(0.18, 0.3, SF.hz * 2, 0.07, 2), { color: '#5583ab', x: SF.x + s * (SF.hx - 0.09), y: 0.36, z: SF.z });
  for (const s of [-0.5, 0.5]) add(rb(SF.hx - 0.22, 0.1, SF.hz * 2 - 0.26, 0.05, 2), { color: '#7aa6cc', x: SF.x + s * (SF.hx - 0.18), y: 0.36, z: SF.z - 0.06 });
  add(rb(0.34, 0.3, 0.12, 0.08, 2), { color: '#f2c25e', x: SF.x - 0.5, y: 0.46, z: SF.z + 0.12, rz: 0.2 });
  const TV = L.TV_RACK;
  add(rb(TV.hx * 2, TV.h, TV.hz * 2, 0.02, 1), { color: vary('#c99b6a', 0.04, 6), x: TV.x, z: TV.z });
  add(rb(0.5, 0.32, 0.06, 0.02, 1), { color: '#3a3d42', x: TV.x - 0.3, y: TV.h, z: TV.z + 0.05 });
  add(cyl(0.08, 0.06, 0.16, 12), { color: '#d98a5a', x: TV.x + 0.45, y: TV.h, z: TV.z });
  add(foliageCluster([{ x: 0, y: 0.12, z: 0, r: 0.14 }, { x: 0.08, y: 0.2, z: 0.03, r: 0.1 }], { detail: 1, seed: 4 }), { color: null, slot: 'foliage', x: TV.x + 0.45, y: TV.h + 0.14, z: TV.z });
  add(cyl(1.1, 1.1, 0.008, 32), { color: (p) => C(Math.hypot(p.x, p.z) > 0.85 ? '#d98a5a' : '#f2d7b0'), slot: 'ground', x: -11.0, y: 0.009, z: 6.4, ao: false });

  // ---------------------------------------------------------------- quintal
  const Y = L.YARD, SD = L.SERVICE_DOOR;
  const wallY = '#f0e0c6';
  const yardWall = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    const ry = -Math.atan2(bz - az, bx - ax);
    addY(rb(len, Y.wallH, t, 0.025, 1), { color: vary(wallY, 0.04, 5), x: (ax + bx) / 2, z: (az + bz) / 2, ry });
    addY(rb(len + 0.02, 0.05, t + 0.06, 0.015, 1), { color: '#c9b693', x: (ax + bx) / 2, y: Y.wallH, z: (az + bz) / 2, ry });
  };
  yardWall(Y.x0 + t / 2, Y.z0, SD.hinge.x - 0.07, Y.z0);
  yardWall(SD.latchPost.x + 0.07, Y.z0, Y.x1, Y.z0);
  yardWall(Y.x1, Y.z0, Y.x1, Y.z1 - 0.12);
  // os pilares da porta da área de serviço (fora do vão da folha) e o telhadinho em cima
  for (const px of [SD.hinge.x - 0.07, SD.latchPost.x + 0.07]) {
    addY(rb(0.14, SD.h + 0.12, 0.2, 0.02, 1), { color: '#e6d3b4', x: px, z: Y.z0 });
  }
  {
    const cap = gableRoof(SD.latchPost.x - SD.hinge.x + 0.5, 0.42, 0.16);
    addY(cap, { color: '#c4643f', x: (SD.hinge.x + SD.latchPost.x) / 2, y: SD.h + 0.12, z: Y.z0 });
  }
  const sdoor = new THREE.Group();
  sdoor.name = 'recanto:porta-da-area-de-servico';
  sdoor.position.set(SD.hinge.x, 0, SD.hinge.z);
  {
    const Ls = SD.length - 0.02;
    const boards = 6;
    for (let i = 0; i < boards; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.045, SD.h - 0.04, Ls / boards - 0.008), new THREE.MeshStandardMaterial({ color: i % 2 ? '#7fa36b' : '#759a62', roughness: 0.7 }));
      m.position.set(0, SD.h / 2 + 0.02, -(i + 0.5) * (Ls / boards) - 0.01);
      m.castShadow = true;
      sdoor.add(m);
    }
    for (const y of [0.35, SD.h - 0.35]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, Ls - 0.04), new THREE.MeshStandardMaterial({ color: '#6a8f58', roughness: 0.7 }));
      bar.position.set(0.035, y, -Ls / 2 - 0.01);
      sdoor.add(bar);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 14), new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.4, metalness: 0.6 }));
    ring.position.set(0.05, 1.0, -Ls + 0.12);
    ring.rotation.y = Math.PI / 2;
    sdoor.add(ring);
  }
  keep(sdoor);
  const setSdoor = (k) => { sdoor.rotation.y = SD.closedYaw + (SD.openYaw - SD.closedYaw) * k; };
  setSdoor(0);
  // o galho da tempestade (uma touceira caída, dentro do quadrado de empurrar)
  const BR = L.BRANCH;
  const branch = new THREE.Group();
  branch.name = 'recanto:galho';
  {
    const bark = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.9 });
    const bough = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 1.12, 8), bark);
    bough.rotation.set(0, 0.7, Math.PI / 2);
    bough.position.y = 0.09;
    bough.castShadow = true;
    branch.add(bough);
    for (const [ox, oz, len, ry, rz] of [[0.18, 0.12, 0.5, 1.9, 1.2], [-0.2, -0.06, 0.45, -0.4, 1.0], [0.05, -0.2, 0.42, 2.8, 1.25], [-0.1, 0.22, 0.38, 0.9, 1.1]]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, len, 6), bark);
      tw.rotation.set(0, ry, rz);
      tw.position.set(ox, 0.16, oz);
      tw.castShadow = true;
      branch.add(tw);
    }
    const leaves = new THREE.Mesh(foliageCluster([
      { x: 0.22, y: 0.3, z: 0.13, r: 0.17 }, { x: -0.23, y: 0.26, z: -0.11, r: 0.16 }, { x: 0.02, y: 0.35, z: -0.2, r: 0.14 },
      { x: -0.11, y: 0.32, z: 0.21, r: 0.13 },
    ], { detail: 1, amp: 0.25, seed: 9, dark: '#3d5a24', mid: '#6b8f35', light: '#a2c056' }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    leaves.castShadow = true;
    branch.add(leaves);
  }
  keep(branch);
  const setBranch = (x, z) => branch.position.set(x, 0, z);
  setBranch(BR.start.x, BR.start.z);
  // as telhas quebradas embaixo do galho (aparecem quando ele sai)
  for (const [ox, oz, ry] of [[-0.12, 0.05, 0.4], [0.15, -0.08, 2.1], [0.02, 0.18, 1.2], [0.24, 0.16, 2.9]]) {
    const g = new THREE.CylinderGeometry(0.12, 0.12, 0.24, 10, 1, true, 0, Math.PI * 0.8);
    g.rotateZ(Math.PI / 2);
    g.scale(1, 0.25, 1);
    addY(g, { color: '#c4643f', x: L.TILES.x + ox, y: 0.012, z: L.TILES.z + oz, ry, ao: false });
  }
  // a casinha de cachorro (a porta para o oeste; só a Radhija passa)
  const DH = L.DOGHOUSE;
  {
    const wallC = vary('#d98a5a', 0.04, 8);
    const th = 0.1, hgt = DH.h - 0.25;
    addY(rb(DH.hx * 2, hgt, th, 0.02, 1), { color: wallC, x: DH.x, z: DH.z - DH.hz });
    addY(rb(DH.hx * 2, hgt, th, 0.02, 1), { color: wallC, x: DH.x, z: DH.z + DH.hz });
    addY(rb(th, hgt, DH.hz * 2, 0.02, 1), { color: wallC, x: DH.x + DH.hx, z: DH.z });
    const side = (DH.hz * 2 - DH.door) / 2;
    addY(rb(th, hgt, side, 0.02, 1), { color: wallC, x: DH.x - DH.hx, z: DH.z - DH.hz + side / 2 });
    addY(rb(th, hgt, side, 0.02, 1), { color: wallC, x: DH.x - DH.hx, z: DH.z + DH.hz - side / 2 });
    addY(rb(th, hgt - 0.62, DH.door + 0.02, 0.02, 1), { color: wallC, x: DH.x - DH.hx, y: 0.62, z: DH.z });
    const roof = gableRoof(DH.hz * 2 + 0.24, DH.hx * 2 + 0.24, 0.32);
    roof.rotateY(Math.PI / 2);
    addY(roof, { color: '#c4643f', x: DH.x, y: hgt, z: DH.z });
    addY(cyl(DH.hx * 0.7, DH.hx * 0.7, 0.04, 20), { color: '#e8475f', x: DH.x + 0.05, y: 0.006, z: DH.z, ao: false });
    // a plaquinha com uma patinha em cima da porta (desenho)
    addY(rb(0.03, 0.12, 0.2, 0.01, 1), { color: '#fff6e6', x: DH.x - DH.hx - 0.05, y: 0.7, z: DH.z });
    addY(sphere(0.03, 8, 6), { color: '#8a5a3c', x: DH.x - DH.hx - 0.07, y: 0.75, z: DH.z });
  }
  // canteiros do quintal, com flores e um regador
  L.YARD_BEDS.forEach((bd, i) => {
    addY(rb(bd.hx * 2, 0.24, bd.hz * 2, 0.03, 1), { color: '#c9b693', x: bd.x, z: bd.z });
    addY(slab(bd.hx * 2 - 0.08, 0.02, bd.hz * 2 - 0.08), { color: '#6a4a2e', slot: 'ground', x: bd.x, y: 0.24, z: bd.z, ao: false });
    const m = Math.max(2, Math.round((bd.hz * 2) / 0.4));
    for (let k = 0; k < m; k++) {
      const pz = bd.z - bd.hz + 0.2 + k * ((bd.hz * 2 - 0.4) / Math.max(1, m - 1));
      const plant = [geranium({ radius: 0.15, height: 0.2, seed: 40 + i * 5 + k, flower: ['#ff6a55', '#f2c230', '#e8708a', '#b9a3e3'][(k + i) % 4] }), lavender({ stems: 16, height: 0.32, seed: 50 + k }), smallFlowers({ count: 18, radius: 0.13, seed: 60 + k })][(k + i) % 3];
      addY(plant, { color: null, slot: 'plant', x: bd.x, y: 0.25, z: pz, ry: R() * 6 });
    }
  });
  addY(cyl(0.09, 0.11, 0.18, 12), { color: '#3d8fd1', x: L.YARD_BEDS[1].x + 0.1, y: 0.25, z: L.YARD_BEDS[1].z + 0.5 });
  // pedrinhas do gramado (da porta da cozinha à porta da área de serviço) e o tapete da cozinha
  for (let i = 0; i < 5; i++) {
    const k = i / 4;
    const x = -6.35 + (-4.8 + 6.35) * k, z = 2.85 + (2.0 - 2.85) * k;
    addY(cyl(0.2 + (i % 2) * 0.04, 0.21 + (i % 2) * 0.04, 0.012, 12), { color: '#cfc6b6', slot: 'ground', x: x + (R() - 0.5) * 0.1, y: 0.004, z: z + 0.5, ao: false });
  }
  addY(rb(0.55, 0.012, 0.8, 0.008, 1), { color: '#c98a55', slot: 'ground', x: H.x1 + 0.36, y: 0.004, z: (KD.hinge.z + KD.latchPost.z) / 2, ao: false });

  return {
    props: {
      kitchenDoor: { object: door, setOpen: setDoor },
      kitchenHandle: handle,
      serviceDoor: { object: sdoor, setOpen: setSdoor },
      branch: { object: branch, setPos: setBranch },
      windowLeaf: { object: leaf, setOpen: setWindow },
      bowl: { object: bowl, setTipped },
      house: {
        windowIn: { x: cx, y: (W.sill + W.top) / 2, z: H.z0 + 0.3 },
        windowOut: { x: cx, y: (W.sill + W.top) / 2, z: H.z0 - 0.3 },
        lever: () => lever.getWorldPosition(new THREE.Vector3()),
      },
    },
    seeThrough: [door, sdoor, branch, ceiling, roof],
    signs: [],
    update(dt, tt) { handle.update?.(dt, tt); },
    reset() {
      setDoor(0); setSdoor(0); setBranch(BR.start.x, BR.start.z); setWindow(1); setTipped(0);
      handle.setOn(false); handle.setPress(0);
    },
    // as malhas ficam na árvore: o escopo de recursos da área libera tudo depois deste dispose
    dispose() {},
  };
}

function rod(r, len, seg = 8) { return new THREE.CylinderGeometry(r, r, len, seg); }
