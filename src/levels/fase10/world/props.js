// FASE 10 · Props interativos: os três enfeites do bolo (o chapeuzinho no barquinho, o laço no corrimão da casa na
// árvore e a vela do número 3 na prateleira do galpão), o disjuntor da cozinha e o botão da torneira (patinhas na
// parede), o conduíte de energia (do disjuntor pela parede do fundo até o pergolado, onde começam as luzinhas, e pela
// fachada até a tomada do ventilador), os ossinhos e as luzes (abajur, pendente, lampião da varanda, lanterna da
// casa na árvore e a lâmpada do galpão). O resto vem pronto dos outros módulos do cenário.
// Itens (convenção de createCarryItem): Object3D com a base em y = 0, eixo mais longo em X, `name`/userData.carryKind.
import * as THREE from 'three';
import { buildTreats } from '../../../world/treats.js';
import { buildWallButton, wallButtonYaw } from '../../../world/wallButton.js';
import { canvasTexture, stdMat, rbox } from '../../../world/util.js';
import { makeLink } from '../../../world/links.js';

const TAU = Math.PI * 2;
const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
/** Quanto tempo o quadro fica aceso sozinho (o pulso só segue para a varanda depois), em segundos. */
export const POWER_PAINTING_HOLD = 2.0;

/** Materiais com emissivo de um objeto (para o brilho de destaque). */
function emissiveMats(obj) {
  const list = [];
  obj.traverse((/** @type {THREE.Mesh} */ o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m && 'emissive' in m && !m.transparent) list.push(m);
  });
  return list;
}

/** Chapeuzinho de festa: cone listrado rosa e creme com bolinhas douradas, pompom e o elástico. */
export function createPartyHat() {
  const g = new THREE.Group();
  g.name = 'party-hat';
  g.userData.carryKind = 'hat';
  const tex = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#ff8fc4'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff1d9';
    for (let y = 0; y < h; y += 32) c.fillRect(0, y + 10, w, 12);
    c.fillStyle = '#f5c543';
    for (let k = 0; k < 18; k++) { c.beginPath(); c.arc((k * 41) % w, (k * 23) % h, 3.4, 0, TAU); c.fill(); }
  });
  const H = 0.17, R = 0.072;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(R, H, 28, 1, true), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide, emissive: '#000000' }));
  cone.position.y = H / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.008, 8, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f5c543', roughness: 0.4, metalness: 0.3 }));
  rim.position.y = 0.004;
  const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.028, 2), new THREE.MeshStandardMaterial({ color: '#ffe27a', roughness: 1, emissive: '#000000' }));
  pom.position.y = H + 0.012;
  // franjinhas do pompom
  const fr = [];
  for (let k = 0; k < 10; k++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.03, 4), pom.material);
    const a = (k / 10) * TAU;
    m.position.set(Math.cos(a) * 0.02, H + 0.012 + Math.sin(a * 2) * 0.01, Math.sin(a) * 0.02);
    m.lookAt(m.position.x * 3, H + 0.02, m.position.z * 3);
    m.rotateX(Math.PI / 2);
    fr.push(m);
  }
  const elastic = new THREE.Mesh(new THREE.TorusGeometry(R * 0.9, 0.003, 4, 20, Math.PI), stdMat('#fffaf0'));
  elastic.position.y = 0.002;
  elastic.rotation.x = Math.PI / 2 + 0.6;
  g.add(cone, rim, pom, ...fr, elastic);
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.userData.carryKind = 'hat'; } });
  return g;
}

/** Laço de cetim rosa (alças, nó e pontas), no plano XY e de frente para +Z. Centro do nó na origem. */
export function createBow() {
  const g = new THREE.Group();
  g.name = 'ribbon';
  g.userData.carryKind = 'ribbon';
  const satin = new THREE.MeshPhysicalMaterial({ color: '#f06aa0', roughness: 0.32, sheen: 1, sheenColor: new THREE.Color('#ffd0e3'), clearcoat: 0.4, emissive: '#000000', side: THREE.DoubleSide });
  const dark = new THREE.MeshPhysicalMaterial({ color: '#d0467e', roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#ffc0d8'), emissive: '#000000' });
  for (const s of [-1, 1]) {
    // alça: gota estufada (mais larga na ponta, afinando no nó), com a dobra mais escura por dentro
    const lobeGeo = new THREE.SphereGeometry(0.036, 18, 12);
    const lp = lobeGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const x = lp.getX(i);
      const k = 0.62 + 0.38 * ((x / 0.036) * s * 0.5 + 0.5); // afina perto do nó
      lp.setXYZ(i, x * 1.55, lp.getY(i) * k, lp.getZ(i) * 0.55 * k);
    }
    lobeGeo.computeVertexNormals();
    const lobe = new THREE.Mesh(lobeGeo, satin);
    lobe.position.set(s * 0.052, 0.01, 0);
    lobe.rotation.z = s * 0.28;
    const fold = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), dark);
    fold.scale.set(1.6, 1, 0.8);
    fold.position.set(s * 0.03, 0.006, 0.014);
    g.add(lobe, fold);
    // ponta caída com o corte em V
    const tail = new THREE.Shape();
    tail.moveTo(-0.014, 0); tail.lineTo(0.014, 0); tail.lineTo(0.02, -0.08); tail.lineTo(0, -0.066); tail.lineTo(-0.012, -0.084); tail.closePath();
    const tg = new THREE.ExtrudeGeometry(tail, { depth: 0.006, bevelEnabled: false });
    const t = new THREE.Mesh(tg, dark);
    t.position.set(s * 0.016, -0.006, -0.004);
    t.rotation.z = s * 0.35;
    g.add(t);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), dark);
  knot.scale.set(1, 1.15, 0.7);
  g.add(knot);
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.userData.carryKind = 'ribbon'; } });
  return g;
}

/** Vela do número 3: o 3 rosa com bolinhas, a base, o pavio, a chaminha (acende no fim) e duas estrelinhas. */
export function createNumberCandle() {
  const g = new THREE.Group();
  g.name = 'candle';
  g.userData.carryKind = 'candle';
  const sh = new THREE.Shape();
  // contorno do 3 (duas barrigas abertas à esquerda), em metros
  const S = 0.11;
  /** @type {(x: number, y: number) => [number, number]} */
  const P = (x, y) => [x * S, y * S];
  sh.moveTo(...P(-0.42, 0.62));
  sh.bezierCurveTo(...P(-0.3, 1.02), ...P(0.5, 1.02), ...P(0.5, 0.6));
  sh.bezierCurveTo(...P(0.5, 0.36), ...P(0.3, 0.27), ...P(0.18, 0.24));
  sh.bezierCurveTo(...P(0.4, 0.2), ...P(0.56, 0.02), ...P(0.52, -0.2));
  sh.bezierCurveTo(...P(0.46, -0.68), ...P(-0.36, -0.7), ...P(-0.48, -0.26));
  sh.lineTo(...P(-0.22, -0.18));
  sh.bezierCurveTo(...P(-0.14, -0.42), ...P(0.24, -0.42), ...P(0.25, -0.18));
  sh.bezierCurveTo(...P(0.26, 0.02), ...P(0.06, 0.1), ...P(-0.08, 0.1));
  sh.lineTo(...P(-0.08, 0.36));
  sh.bezierCurveTo(...P(0.08, 0.36), ...P(0.25, 0.42), ...P(0.25, 0.6));
  sh.bezierCurveTo(...P(0.25, 0.8), ...P(-0.1, 0.82), ...P(-0.18, 0.56));
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.028, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 14 });
  geo.translate(0, 0.072, -0.014);
  const wax = new THREE.MeshPhysicalMaterial({ color: '#ff8fc4', roughness: 0.4, clearcoat: 0.5, emissive: '#000000' });
  const three = new THREE.Mesh(geo, wax);
  g.add(three);
  // bolinhas brancas no 3 (frente e verso)
  const dotG = new THREE.SphereGeometry(0.0055, 8, 6);
  const dotM = stdMat('#fff6ea', { roughness: 0.5 });
  for (const [x, y] of [[-0.22, 0.85], [0.28, 0.82], [0.38, 0.45], [0.05, 0.22], [0.38, -0.12], [0.1, -0.5], [-0.3, -0.42]]) {
    for (const z of [0.0225, -0.0225]) {
      const d = new THREE.Mesh(dotG, dotM);
      d.position.set(x * S, 0.072 + y * S, z);
      d.scale.z = 0.4;
      g.add(d);
    }
  }
  // base dourada (o espeto vai no bolo) e o pavio
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.012, 14), new THREE.MeshStandardMaterial({ color: '#f5c543', metalness: 0.6, roughness: 0.3 }));
  base.position.y = 0.006;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 6), base.material);
  stick.position.y = 0.012;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.016, 5), stdMat('#2a1c14'));
  wick.position.set(0.02, 0.072 + 0.98 * S + 0.006, 0);
  g.add(base, stick, wick);
  // chaminha (escondida até o bolo ficar pronto)
  const flame = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb63d', transparent: true, opacity: 0.9, depthWrite: false }));
  outer.scale.set(1, 1.9, 1);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff6c0' }));
  inner.scale.set(1, 1.7, 1);
  inner.position.y = -0.002;
  flame.add(outer, inner);
  flame.position.set(0.02, wick.position.y + 0.022, 0);
  flame.visible = false;
  g.add(flame);
  // estrelinhas (duas varetas com estrela na ponta, uma de cada lado do 3)
  const starShape = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const rr = k % 2 ? 0.006 : 0.014;
    const a = (k / 10) * TAU + Math.PI / 2;
    if (k === 0) starShape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else starShape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.003, bevelEnabled: false });
  const starMat = new THREE.MeshStandardMaterial({ color: '#ffd94d', metalness: 0.5, roughness: 0.3, emissive: '#ffb020', emissiveIntensity: 0.25 });
  const stars = [];
  for (const s of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.13, 5), stdMat('#c8ccd0', { metalness: 0.9, roughness: 0.3 }));
    rod.position.set(s * 0.06, 0.065, 0);
    rod.rotation.z = -s * 0.25;
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(s * 0.076, 0.13, 0);
    g.add(rod, star);
    stars.push(star);
  }
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh && o.parent !== flame) { o.castShadow = true; o.userData.carryKind = 'candle'; } });
  return { object: g, flame, stars, starMat };
}

/** Biscoito de osso com glacê rosa e confeitos (deitado, eixo longo em X). */
export function createCookie() {
  const g = new THREE.Group();
  g.name = 'cookie';
  g.userData.carryKind = 'ribbon';
  // osso: a barra do meio e as quatro bolotas (biscoito dourado) com o glacê rosa por cima
  const dough = stdMat('#d9a05a', { roughness: 0.75 });
  const glaze = new THREE.MeshPhysicalMaterial({ color: '#ff8fc4', roughness: 0.3, clearcoat: 0.6, emissive: '#000000' });
  const bar = new THREE.Mesh(rbox(0.12, 0.016, 0.034, 0.006), dough);
  bar.position.y = 0.008;
  const barIce = new THREE.Mesh(rbox(0.11, 0.006, 0.026, 0.003), glaze);
  barIce.position.y = 0.018;
  g.add(bar, barIce);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lobe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.016, 14), dough);
    lobe.position.set(sx * 0.064, 0.008, sz * 0.017);
    const ice = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 14), glaze);
    ice.position.set(sx * 0.064, 0.0185, sz * 0.017);
    g.add(lobe, ice);
  }
  const sprC = ['#fff6ea', '#7cc4e8', '#f6c453', '#9bd57a'];
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Mesh(new THREE.CapsuleGeometry(0.002, 0.008, 2, 4), stdMat(sprC[i % 4], { roughness: 0.4 }));
    sp.position.set(-0.05 + (i % 5) * 0.025, 0.024, (i % 2 ? 0.006 : -0.008));
    sp.rotation.set(Math.PI / 2, 0, i * 0.9);
    g.add(sp);
  }
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.userData.carryKind = 'ribbon'; } });
  return g;
}

/** Estrela dourada de topo de bolo (cintilante, com a varetinha para espetar), em pé no plano XY. */
export function createStarTopper() {
  const g = new THREE.Group();
  g.name = 'star';
  g.userData.carryKind = 'candle';
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 ? 0.032 : 0.075;
    if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2 });
  geo.translate(0, 0.11, -0.008);
  const gold = new THREE.MeshStandardMaterial({ color: '#ffd24d', metalness: 0.75, roughness: 0.25, emissive: '#ffb020', emissiveIntensity: 0.2 });
  const star = new THREE.Mesh(geo, gold);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 6), stdMat('#c8ccd0', { metalness: 0.9, roughness: 0.3 }));
  rod.position.y = 0.03;
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#ff8fc4', roughness: 0.1, clearcoat: 1, emissive: '#000000' }));
  gem.position.set(0, 0.11, 0.012);
  g.add(star, rod, gem);
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.userData.carryKind = 'candle'; } });
  return { object: g, gold };
}

/**
 * @param {{ root: THREE.Object3D, layout: import('../../../types').LevelLayout, house: any, porch: any, yard: any,
 *   fences: any, treehouse: any, garden: any, pantry: any, farm: any, pinata: any, sty: any, secret: any }} args
 */
export function buildProps({ root, layout, house, porch, yard, fences, treehouse, garden, pantry, farm, pinata, sty, secret }) {
  const { BREAKER, TAP, RIBBON, CANDLE, BOAT, POOL, COLLECTIBLES, WALL_LK, WALLS, HOUSE, PERGOLA_POSTS, SHED_BUTTONS, ROSE_BUSH } = layout;

  // ---- os três enfeites
  const hat = createPartyHat();
  hat.position.set(BOAT.start.x, POOL.water.min + 0.15, BOAT.start.z);
  root.add(hat);
  const hatHome = hat.position.clone();
  const ribbon = createBow();
  ribbon.position.set(RIBBON.x, RIBBON.y, RIBBON.z + 0.012);
  root.add(ribbon);
  const ribbonHome = ribbon.position.clone();
  // a fita amarrando o laço no corrimão
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 14), new THREE.MeshPhysicalMaterial({ color: '#d0467e', roughness: 0.35, sheen: 1 }));
  tie.position.set(RIBBON.x, RIBBON.y + 0.04, RIBBON.z - 0.012);
  tie.rotation.y = Math.PI / 2;
  root.add(tie);
  const candleKit = createNumberCandle();
  const candle = candleKit.object;
  candle.position.set(CANDLE.x, CANDLE.y - 0.018, CANDLE.z); // a base apoiada na prateleira
  candle.rotation.y = -Math.PI / 2 + 0.35; // de frente para quem sobe a rampa (e para a câmera)
  root.add(candle);
  const candleHome = candle.position.clone();
  // o biscoito de osso de glacê (na frente do pote, em cima do armário alto da despensa)
  const cookie = createCookie();
  pantry.cookieSpot.updateWorldMatrix(true, false);
  pantry.cookieSpot.getWorldPosition(cookie.position);
  cookie.rotation.y = 0.4;
  root.add(cookie);
  const cookieHome = cookie.position.clone();
  // a estrela (escondida dentro da piñata até ela abrir; aí cai no gramado do lado de quem bateu)
  const starKit = createStarTopper();
  const star = starKit.object;
  star.position.set(ROSE_BUSH.x, 0.02, ROSE_BUSH.z + ROSE_BUSH.r + 0.4);
  star.visible = false;
  root.add(star);
  const starHome = star.position.clone();
  const mats = {
    hat: emissiveMats(hat), ribbon: emissiveMats(ribbon), candle: emissiveMats(candle).filter((m) => m !== candleKit.starMat),
    cookie: emissiveMats(cookie), star: emissiveMats(star).filter((m) => m !== starKit.gold),
  };

  // ---- alavancas no alto das paredes (patinhas pintadas)
  const place = (prop, cfg) => {
    prop.object.position.set(cfg.x, 0, cfg.z);
    prop.object.rotation.y = wallButtonYaw(cfg.nx, cfg.nz);
    root.add(prop.object);
    return prop;
  };
  const breaker = place(buildWallButton({ kind: 'lever', top: BREAKER.top, color: '#f2c14e', plate: '#d8dcd6', trim: '#2a2624', name: 'disjuntor' }), BREAKER);
  const tap = place(buildWallButton({ kind: 'button', top: TAP.top, color: '#4aa8e0', plate: '#f4ecdc', trim: '#c87a4a', name: 'botao-torneira' }), TAP);
  // os dois botões altos do galpão: iguais (qual abre o quê é sorteado)
  // (bem à vista: botão amarelo em placa branca com borda vermelha, num quadro azul com "?" e uma lampadinha que pisca
  // até alguém apertar)
  const shedButtons = SHED_BUTTONS.map((cfg, i) => place(buildWallButton({ kind: 'button', top: cfg.top, color: '#ffd400', plate: '#fffaf0', trim: '#e23d3d', name: `botao-galpao-${i + 1}` }), cfg));
  const askTex = canvasTexture(128, 96, (g, w, h) => {
    g.fillStyle = '#2f7fd8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fffaf0'; g.lineWidth = 8; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#ffd400'; g.font = 'bold 66px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', w / 2, h / 2 + 4);
  }, { repeat: false });
  const askMat = new THREE.MeshStandardMaterial({ map: askTex, roughness: 0.6 });
  const shedOn = SHED_BUTTONS.map(() => false);
  shedButtons.forEach((b, i) => {
    const setOn = b.setOn.bind(b);
    b.setOn = (on) => { shedOn[i] = !!on; setOn(on); };
  });
  const shedLamps = SHED_BUTTONS.map((cfg) => {
    // a plaquinha "?" logo acima do botão (abaixo do topo da parede; as patinhas pintadas ficam livres embaixo) e a
    // lampadinha do lado dela
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), askMat);
    board.position.set(0, cfg.top + 0.22, 0.006);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 1 }));
    lamp.position.set(0.15, cfg.top + 0.22, 0.032);
    const holder = new THREE.Group();
    holder.add(board, lamp);
    holder.position.set(cfg.x, 0, cfg.z);
    holder.rotation.y = wallButtonYaw(cfg.nx, cfg.nz);
    root.add(holder);
    return lamp;
  });
  const treats = buildTreats(root, COLLECTIBLES, { glow: 0.24 });

  // ---- conduíte da energia: disjuntor → (divisória) → parede do fundo → atravessa a parede leste → pergolado
  const xL = WALL_LK.x + WALLS.t / 2 + 0.018;
  const zN = layout.WORLD.bounds.minZ + 0.02;
  const xE = HOUSE.x1 - WALLS.t / 2 - 0.02;
  const xOut = HOUSE.x1 + WALLS.t / 2 + 0.02;
  const P0 = porch.lights.start;
  // o conduíte sobe do disjuntor até a parede do fundo (J) e ali se divide: um ramal vai para o oeste até as luzinhas
  // do quadro da sala e o outro atravessa a parede leste até o pergolado
  const J = new THREE.Vector3(xL + 0.02, 2.5, zN);
  const conduitUp = makeLink([
    new THREE.Vector3(xL, BREAKER.top + 0.08, BREAKER.z),
    new THREE.Vector3(xL, WALLS.cutH - 0.03, BREAKER.z),
    new THREE.Vector3(xL, WALLS.cutH - 0.03, zN + 0.02),
    J,
  ], { radius: 0.014, color: '#f4f1ea', glow: '#ffd36a', clips: 3 });
  const PS = house.paintingLights.start;
  const conduitPainting = makeLink([
    J,
    new THREE.Vector3(PS.x, 2.5, zN),
    new THREE.Vector3(PS.x, PS.y + 0.06, zN),
    new THREE.Vector3(PS.x, PS.y, PS.z),
  ], { radius: 0.011, color: '#f4f1ea', glow: '#ffd36a', clips: 2 });
  const conduitMain = makeLink([
    J,
    new THREE.Vector3(xE, 2.5, zN),
    new THREE.Vector3(xOut, 2.5, zN + 0.02),
    new THREE.Vector3(PERGOLA_POSTS[0].x - 0.06, 2.5, PERGOLA_POSTS[0].z),
    new THREE.Vector3(P0.x - 0.04, P0.y + 0.02, P0.z),
  ], { radius: 0.014, color: '#f4f1ea', glow: '#ffd36a', clips: 5 });
  root.add(conduitUp.object, conduitPainting.object, conduitMain.object);
  // caixinha de derivação na parede do fundo, onde o conduíte se divide
  const jbox0 = new THREE.Mesh(rbox(0.1, 0.1, 0.05, 0.01), stdMat('#f4f1ea', { roughness: 0.5 }));
  jbox0.position.set(J.x, J.y, layout.WORLD.bounds.minZ + 0.024);
  root.add(jbox0);
  // ramal da fachada: desce por baixo do beiral até a tomada do ventilador
  const outlet = yard.outletPos;
  const conduitOutlet = makeLink([
    new THREE.Vector3(xOut, 2.5, zN + 0.02),
    new THREE.Vector3(xOut, 2.28, zN + 0.3),
    new THREE.Vector3(xOut, 2.28, outlet.z - 0.25),
    new THREE.Vector3(xOut, outlet.y + 0.12, outlet.z - 0.02),
    new THREE.Vector3(outlet.x, outlet.y + 0.06, outlet.z),
  ], { radius: 0.012, color: '#f4f1ea', glow: '#ffd36a', clips: 6 });
  root.add(conduitOutlet.object);
  // caixinha de passagem onde o conduíte atravessa a parede
  const jbox = new THREE.Mesh(rbox(0.05, 0.12, 0.12, 0.01), stdMat('#f4f1ea', { roughness: 0.5 }));
  jbox.position.set(xOut + 0.01, 2.5, zN + 0.06);
  root.add(jbox);

  // ---- luzes (sem sombra): abajur, pendente, lampião (acende com a festa), lanterna, lâmpada do galpão
  const lights = [];
  const addLight = (pos, color, intensity, dist) => {
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.copy(pos);
    root.add(l);
    lights.push(l);
    return l;
  };
  addLight(house.lampPos, '#ffcf8a', 1.5, 4.6);
  addLight(house.pendantPos, '#ffc47a', 1.2, 4.2);
  const porchLight = addLight(porch.lanternPos, '#ffc48a', 0.0, 5.5);
  addLight(treehouse.lanternPos, '#ffd08a', 1.0, 4.0);
  addLight(garden.bulbPos, '#ffe0a8', 1.0, 3.8);

  const st = {
    hlHat: false, hlRibbon: false, hlCandle: false, hlCookie: false, hlStar: false, glow: { hat: 0, ribbon: 0, candle: 0, cookie: 0, star: 0 },
    hatOnBoat: true, power: false, powerT: -1, lightsOn: false, fanWant: false, fanOn: false, tapOn: false,
    lit: false, litT: 0, lampI: 0,
    /** @type {'off' | 'house' | 'painting' | 'porch' | 'on'} */ stage: 'off', stageT: 0,
  };
  const goStage = (sg) => { st.stage = sg; st.stageT = 0; };
  const boatPos = new THREE.Vector3();
  const THING_OBJ = { hat, ribbon, candle, cookie, star };
  /** O chapéu acompanha o barquinho (no convés) enquanto ninguém o pega. */
  function hatOnBoatPose() {
    if (!st.hatOnBoat || hat.parent !== root) return;
    yard.boat.object.updateMatrixWorld(true);
    boatPos.set(0.02, 0.14, 0).applyMatrix4(yard.boat.object.matrixWorld);
    hat.position.copy(boatPos);
    hat.quaternion.copy(yard.boat.object.quaternion);
  }

  /** @satisfies {import('../../../types').Fase10Props} */
  const props = {
    hat: {
      object: hat, home: hatHome,
      setHighlight(on) { st.hlHat = !!on; },
      setOnBoat(on) { st.hatOnBoat = !!on; },
    },
    ribbon: { object: ribbon, home: ribbonHome, setHighlight(on) { st.hlRibbon = !!on; } },
    candle: { object: candle, home: candleHome, setHighlight(on) { st.hlCandle = !!on; } },
    cookie: { object: cookie, home: cookieHome, setHighlight(on) { st.hlCookie = !!on; } },
    star: {
      object: star, home: starHome,
      setHighlight(on) { st.hlStar = !!on; },
      /** Aparece quando a piñata abre. */
      setShown(on) { star.visible = !!on; },
    },
    cake: {
      object: porch.cake.object,
      setHighlight: porch.cake.setHighlight,
      place(thing, tier) {
        const obj = THING_OBJ[thing];
        porch.cake.place(thing, tier, obj);
        if (thing === 'ribbon') tie.visible = false;
        if (thing === 'candle') obj.rotation.y = 0.3;
      },
      reject(thing, tier, k, x, z) {
        const obj = THING_OBJ[thing];
        porch.cake.reject(thing, tier, k, x, z, obj);
      },
      light() {
        porch.cake.light();
        st.lit = true;
        st.litT = 0;
        candleKit.flame.visible = true;
      },
    },
    pool: yard.pool,
    boat: {
      object: yard.boat.object,
      setPos(x, z, y, drifting) { yard.boat.setPos(x, z, y, drifting); },
    },
    crate: yard.crate,
    fan: {
      object: yard.fan.object,
      // o ventilador só liga quando o pulso de energia chega na tomada
      setPower(on) { st.fanWant = !!on; },
    },
    power: {
      /** Onde a energia está: 'house' subindo o conduíte, 'painting' acendendo o quadro, 'porch' indo para a varanda. */
      get stage() { return st.stage; },
      setOn(on) {
        if (on && !st.power) { st.powerT = 0; goStage('house'); conduitUp.pulse(); }
        if (!on) {
          st.powerT = -1; st.lightsOn = false; goStage('off'); porch.lights.setOn(false); house.paintingLights.setOn(false);
          conduitPainting.setOn(false); conduitMain.setOn(false);
        }
        st.power = !!on;
        conduitUp.setOn(!!on);
      },
    },
    gate: fences.gate,
    cord: fences.cord,
    pigeon: treehouse.pigeon,
    bucket: treehouse.bucket,
    rope: treehouse.rope,
    tube: treehouse.tube,
    shedDoor: garden.door,
    shedButtons,
    /** Os cabos da caixinha de força do galpão (pulso até a porta ou até a porteira). */
    shedLinks: sty.links,
    styGate: sty.gate,
    crates: pantry.crates,
    pinata: pinata.pinata,
    farm: { spots: farm.spots, makeVeg: farm.makeVeg },
    secretBoard: secret.board,
    breaker,
    tap: {
      object: tap.object,
      setPress: tap.setPress,
      setOn(on) {
        if (on && !st.tapOn) yard.tapLink.pulse();
        st.tapOn = !!on;
        yard.tapLink.setOn(!!on);
        tap.setOn(on);
      },
      setTimer: tap.setTimer,
    },
    collectibles: treats.list,
    fireflies: true,
    update(dt, t) {
      treats.update(dt, t);
      // a lampadinha de cada botão do galpão pisca até ele ser apertado
      shedLamps.forEach((lamp, i) => {
        const on = shedOn[i];
        /** @type {THREE.MeshStandardMaterial} */ (lamp.material).emissiveIntensity = on ? 0.15 : 0.5 + 0.9 * (0.5 + 0.5 * Math.sin(t * 5 + i * 1.7));
      });
      for (const b of [breaker, tap]) b.update?.(dt, t);
      conduitUp.update(dt);
      conduitPainting.update(dt);
      conduitMain.update(dt);
      conduitOutlet.update(dt);
      // energia: o pulso sobe até a parede do fundo → ramal do quadro (as luzinhas dele acendem primeiro) → depois o
      // pulso segue para o pergolado → luzinhas da varanda em onda; e desce a fachada → a tomada liga o ventilador
      if (st.powerT >= 0) {
        st.powerT += dt;
        st.stageT += dt;
        if (st.stage === 'house' && conduitUp.arrived && st.powerT > 0.2) {
          goStage('painting');
          conduitPainting.pulse();
          conduitPainting.setOn(true);
        } else if (st.stage === 'painting') {
          if (conduitPainting.arrived) house.paintingLights.setOn(true);
          if (st.stageT > POWER_PAINTING_HOLD) {
            goStage('porch');
            conduitMain.pulse();
            conduitMain.setOn(true);
          }
        } else if (st.stage === 'porch' && conduitMain.arrived && st.stageT > 0.1) {
          goStage('on');
          st.lightsOn = true;
          porch.lights.setOn(true);
          conduitOutlet.pulse();
          conduitOutlet.setOn(true);
        }
      }
      const fanReady = st.lightsOn && conduitOutlet.arrived;
      const fanOn = st.fanWant && fanReady;
      if (fanOn !== st.fanOn) { st.fanOn = fanOn; yard.fan.setPower(fanOn); }
      // o lampião acende com a festa; com a vela acesa, uma chaminha tremendo por cima (sem acumular)
      st.lampI = ease(st.lampI, st.lightsOn ? 1.3 : 0.0, dt, 3);
      porchLight.intensity = st.lampI + (st.lit ? 0.25 + 0.12 * Math.sin(t * 13) * Math.sin(t * 7.3) : 0);
      if (st.lit) porchLight.color.set('#ffb070'); else porchLight.color.set('#ffc48a');
      // chapéu no barco
      hatOnBoatPose();
      // brilho de destaque dos enfeites
      for (const [key, on] of /** @type {[('hat'|'ribbon'|'candle'|'cookie'|'star'), boolean][]} */ ([['hat', st.hlHat], ['ribbon', st.hlRibbon], ['candle', st.hlCandle], ['cookie', st.hlCookie], ['star', st.hlStar]])) {
        st.glow[key] = ease(st.glow[key], on ? 1 : 0, dt, 5);
        const k = st.glow[key] * (0.35 + 0.25 * Math.sin(t * 4.5));
        for (const m of mats[key]) { m.emissive.setRGB(1, 0.85, 0.5); m.emissiveIntensity = k; }
      }
      // a vela acesa: chaminha tremendo e as estrelinhas faiscando
      if (st.lit) {
        st.litT += dt;
        candleKit.flame.scale.set(1 + Math.sin(t * 17) * 0.08, 1 + Math.sin(t * 11) * 0.15, 1);
        candleKit.starMat.emissiveIntensity = 0.6 + 0.6 * Math.abs(Math.sin(t * 9));
        candleKit.stars.forEach((s, i) => { s.rotation.z = t * 3 * (i ? 1 : -1); });
      }
    },
    reset() {
      st.hatOnBoat = true;
      st.hlHat = st.hlRibbon = st.hlCandle = false;
      st.power = false; st.powerT = -1; st.lightsOn = false; st.fanWant = false; st.fanOn = false; st.tapOn = false;
      st.lit = false;
      goStage('off');
      house.paintingLights.setOn(false);
      conduitUp.setOn(false);
      conduitPainting.setOn(false);
      candleKit.flame.visible = false;
      candleKit.starMat.emissiveIntensity = 0.25;
      candle.rotation.set(0, -Math.PI / 2 + 0.35, 0);
      ribbon.rotation.set(0, 0, 0);
      hat.rotation.set(0, 0, 0);
      tie.visible = true;
      porch.lights.setOn(false);
      porch.cake.reset();
      conduitMain.setOn(false);
      conduitOutlet.setOn(false);
      yard.tapLink.setOn(false);
      yard.fan.setPower(false);
      yard.pool.setFlow(false, false);
      yard.pool.setLevel(0, POOL.water.min);
      yard.boat.setPos(BOAT.start.x, BOAT.start.z, POOL.water.min, false);
      yard.crate.setHighlight(false);
      fences.gate.setOpen(0);
      fences.cord.reset();
      garden.door.setOpen(0);
      sty.gate.setOpen(0);
      for (const b of shedButtons) b.setOn?.(false);
      layout.PANTRY_CRATES.list.forEach((_, i) => pantry.crates.setCrate(i, layout.PANTRY_CRATES.x0, false));
      pinata.pinata.reset();
      star.visible = false;
      star.rotation.set(0, 0, 0);
      cookie.rotation.set(0, 0.4, 0);
      for (const sp of farm.spots) sp.setReady(true);
      secret.board.setOpen(0);
      secret.board.setLoose(false);
      treehouse.bucket.setY(0);
      treehouse.rope.setPull(0, null);
      treehouse.tube.setPuffs([]);
      treehouse.pigeon.object.visible = true;
      treehouse.pigeon.setPose({ x: layout.PIGEON.x, y: layout.PIGEON.y, z: layout.PIGEON.z, yaw: 0.3, flying: false, asleep: true });
      for (const tr of treats.list) tr.reset();
    },
  };
  return { props, lights };
}
