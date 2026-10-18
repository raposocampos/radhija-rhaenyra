// FASE 8 · A lavanderia em corte de maquete: laje com a borda do corte à mostra, piso cerâmico, parede do fundo
// inteira com azulejo branco até 1 m (faixa de cerâmica azul no topo) e a janela de sol com cortininha xadrez,
// laterais cortadas a meia altura com o "poché" escuro, rodapés, plaquinhas com o desenho do que cada botão faz,
// relógio, calendário e os raios de sol que entram pela janela.
import * as THREE from 'three';
import { rng, rbox, canvasTexture, plasterMat, stdMat, mergeGeometries } from '../../../world/util.js';

const POCHE = '#4a3426'; // cor do corte (topo das paredes cortadas e borda da laje)
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ texturas
/** Piso cerâmico 30 × 30 cm areia com rejunte claro e manchinhas (repetição de 1,2 m = 4 × 4). */
function floorTileTexture() {
  const N = 4, px = 128, S = N * px;
  return canvasTexture(S, S, (g) => {
    const r = rng(81);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const tone = 0.93 + r() * 0.1;
      g.fillStyle = `rgb(${(226 * tone) | 0},${(206 * tone) | 0},${(178 * tone) | 0})`;
      g.fillRect(i * px, j * px, px, px);
      for (let s = 0; s < 60; s++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '120,90,60'},${0.03 + r() * 0.05})`;
        g.beginPath();
        g.arc(i * px + r() * px, j * px + r() * px, 1 + r() * 3, 0, TAU);
        g.fill();
      }
      // brilho suave na diagonal de cada placa
      const grd = g.createLinearGradient(i * px, j * px, i * px + px, j * px + px);
      grd.addColorStop(0, 'rgba(255,255,255,0.06)');
      grd.addColorStop(1, 'rgba(0,0,0,0.04)');
      g.fillStyle = grd;
      g.fillRect(i * px, j * px, px, px);
    }
    g.fillStyle = 'rgba(245,238,226,0.95)';
    for (let i = 0; i <= N; i++) {
      g.fillRect(i * px - 2, 0, 4, S);
      g.fillRect(0, i * px - 2, S, 4);
    }
  });
}

/** Azulejo branco 15 × 15 cm (repetição de 0,6 m = 4 × 4), com reflexo e rejunte. */
function wallTileTexture() {
  const N = 4, px = 64, S = N * px;
  return canvasTexture(S, S, (g) => {
    const r = rng(17);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const grd = g.createLinearGradient(i * px, j * px, i * px, j * px + px);
      const t = 0.97 + r() * 0.03;
      grd.addColorStop(0, `rgb(${(252 * t) | 0},${(251 * t) | 0},${(247 * t) | 0})`);
      grd.addColorStop(1, `rgb(${(236 * t) | 0},${(234 * t) | 0},${(228 * t) | 0})`);
      g.fillStyle = grd;
      g.fillRect(i * px, j * px, px, px);
    }
    g.fillStyle = 'rgba(190,184,172,0.9)';
    for (let i = 0; i <= N; i++) {
      g.fillRect(i * px - 1, 0, 2, S);
      g.fillRect(0, i * px - 1, S, 2);
    }
  });
}

/** Lá fora pela janela: céu de manhã, o muro com trepadeira, a copa de uma árvore e o varal do quintal. */
function yardTexture() {
  return canvasTexture(256, 224, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#79b4e6'); sky.addColorStop(0.62, '#cfe6f6'); sky.addColorStop(0.63, '#d9cdb8'); sky.addColorStop(1, '#b8a98f');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const r = rng(5);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 3; i++) {
      const cx = 30 + r() * 200, cy = 20 + r() * 40;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + k * 14 - 20, cy + (k % 2) * 4, 18, 9, 0, 0, TAU); g.fill(); }
    }
    // muro com trepadeira
    g.fillStyle = '#e8dcc6';
    g.fillRect(0, h * 0.6, w, h * 0.12);
    g.fillStyle = '#6f9a58';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * w, h * (0.6 + r() * 0.08), 4 + r() * 6, 0, TAU); g.fill(); }
    // copa de árvore à direita
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(${70 + r() * 30},${120 + r() * 40},${60 + r() * 20},0.95)`;
      g.beginPath(); g.arc(200 + r() * 60, 40 + r() * 90, 18 + r() * 16, 0, TAU); g.fill();
    }
    g.fillStyle = '#7a5a3c';
    g.fillRect(222, 120, 9, 26);
    // varal do quintal com roupinhas
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(10, 92); g.quadraticCurveTo(110, 104, 200, 90); g.stroke();
    const clothes = ['#e8554a', '#7fb0c8', '#f2c14e', '#ffffff', '#7f9c8a'];
    clothes.forEach((c, i) => { g.fillStyle = c; g.fillRect(28 + i * 34, 95 + (i % 2), 18, 20 + (i % 3) * 4); });
  }, { repeat: false });
}

/** Cortininha xadrez (vichy) amarelo e branco. */
function ginghamTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(242,193,78,0.5)';
    for (let i = 0; i < w; i += 16) { g.fillRect(i, 0, 8, h); g.fillRect(0, i, w, 8); }
    g.fillStyle = 'rgba(232,160,40,0.35)';
    for (let i = 0; i < w; i += 16) for (let j = 0; j < h; j += 16) g.fillRect(i, j, 8, 8);
  });
}

/** Plaquinha com o desenho do que o botão faz: máquina girando ou varal descendo. */
function plaqueTexture(kind) {
  return canvasTexture(128, 96, (g, w, h) => {
    g.fillStyle = '#fbf6ec'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4a3426'; g.lineWidth = 4; g.lineJoin = 'round'; g.lineCap = 'round';
    if (kind === 'spin') {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.roundRect(34, 14, 60, 68, 8); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(34, 30); g.lineTo(94, 30); g.stroke();
      g.fillStyle = '#9fd0e6';
      g.beginPath(); g.arc(64, 56, 17, 0, TAU); g.fill(); g.stroke();
      // setas girando
      g.strokeStyle = '#e8554a'; g.lineWidth = 4;
      g.beginPath(); g.arc(64, 56, 26, -2.4, -0.6); g.stroke();
      g.beginPath(); g.moveTo(84, 36); g.lineTo(80, 44); g.lineTo(89, 44); g.closePath(); g.fillStyle = '#e8554a'; g.fill();
    } else {
      // varal com a meia e a seta para baixo
      g.beginPath(); g.moveTo(16, 22); g.lineTo(112, 22); g.stroke();
      g.beginPath(); g.moveTo(16, 12); g.lineTo(16, 22); g.moveTo(112, 12); g.lineTo(112, 22); g.stroke();
      g.fillStyle = '#e8554a';
      g.beginPath(); g.moveTo(40, 22); g.lineTo(52, 22); g.lineTo(52, 50); g.lineTo(64, 58); g.lineTo(58, 66); g.lineTo(40, 54); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#3f6f78'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(88, 34); g.lineTo(88, 74); g.stroke();
      g.fillStyle = '#3f6f78';
      g.beginPath(); g.moveTo(76, 66); g.lineTo(100, 66); g.lineTo(88, 84); g.closePath(); g.fill();
    }
  }, { repeat: false });
}

/** Calendário de parede: mês com o domingo circulado e um desenho de patinha. */
function calendarTexture() {
  return canvasTexture(96, 128, (g, w, h) => {
    g.fillStyle = '#fffdf7'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7f9c8a'; g.fillRect(0, 0, w, 44);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(48, 24, 12, 9, 0, 0, TAU); g.fill();
    for (const [dx, dy] of [[-12, -12], [-4, -17], [4, -17], [12, -12]]) { g.beginPath(); g.ellipse(48 + dx, 24 + dy * 0.6, 4, 5, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(74,52,38,0.6)';
    for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) g.fillRect(8 + i * 12, 54 + j * 14, 7, 6);
    g.strokeStyle = '#e8554a'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(11.5, 85, 7, 0, TAU); g.stroke();
  }, { repeat: false });
}

/** Faixa de luz (raio de sol): gradiente de cima para baixo, aditivo. */
function shaftTexture() {
  return canvasTexture(32, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(255,240,205,0.0)');
    grd.addColorStop(0.15, 'rgba(255,240,205,0.55)');
    grd.addColorStop(1, 'rgba(255,240,205,0.0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.25, 'rgba(0,0,0,0)'); side.addColorStop(0.75, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = side;
    g.fillRect(0, 0, w, h);
  }, { srgb: false, repeat: false });
}

// ------------------------------------------------------------------ peças
/** Parede (caixa) com a faixa escura do corte no topo. */
function cutWall(grp, x, z, w, d, h, wallMat, poche = true) {
  const m = new THREE.Mesh(rbox(w, h, d, 0.012), wallMat);
  m.position.set(x, h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  grp.add(m);
  if (poche) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 0.02, d + 0.004), stdMat(POCHE, { roughness: 0.95 }));
    p.position.set(x, h + 0.01, z);
    grp.add(p);
  }
  return m;
}

function buildFloor(layout) {
  const grp = new THREE.Group();
  grp.name = 'piso';
  const B = layout.WORLD.bounds;
  const W = B.maxX - B.minX, D = B.maxZ - B.minZ;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.32, D + 0.6), stdMat(POCHE, { roughness: 0.95 }));
  slab.position.set((B.minX + B.maxX) / 2, -0.161, (B.minZ + B.maxZ) / 2 + 0.1);
  const tex = floorTileTexture();
  tex.repeat.set(W / 1.2, D / 1.2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42 }));
  floor.position.set((B.minX + B.maxX) / 2, 0.001, (B.minZ + B.maxZ) / 2);
  floor.receiveShadow = true;
  grp.add(slab, floor);
  return grp;
}

function buildWalls(layout, updaters) {
  const grp = new THREE.Group();
  grp.name = 'paredes';
  const { WALLS, WINDOW: wi, WORLD, SPIN_BUTTON, RACK_BUTTON } = layout;
  const B = WORLD.bounds;
  const H = WALLS.northH, C = WALLS.cutH, T = WALLS.t;
  const zN = B.minZ - T / 2; // centro da parede do fundo (face em B.minZ)
  const paint = plasterMat('#f4e7c6');
  const sideMat = plasterMat('#efe2c2');
  // a parede do fundo termina 2 cm dentro das laterais (as pontas não ficam no plano da face de fora delas)
  const x0 = B.minX - T + 0.02, x1 = B.maxX + T - 0.02;

  // ---- parede do fundo com a janela
  const a = wi.cx - wi.w / 2, b = wi.cx + wi.w / 2;
  cutWall(grp, (x0 + a) / 2, zN, a - x0, T, H, paint);
  cutWall(grp, (b + x1) / 2, zN, x1 - b, T, H, paint);
  cutWall(grp, wi.cx, zN, wi.w, T, wi.sill, paint, false);
  const top = H - (wi.sill + wi.h);
  const lintel = new THREE.Mesh(rbox(wi.w, top, T, 0.012), paint);
  lintel.position.set(wi.cx, wi.sill + wi.h + top / 2, zN);
  lintel.castShadow = lintel.receiveShadow = true;
  const lp = new THREE.Mesh(new THREE.BoxGeometry(wi.w + 0.004, 0.02, T + 0.004), stdMat(POCHE, { roughness: 0.95 }));
  lp.position.set(wi.cx, H + 0.01, zN);
  grp.add(lintel, lp);
  // vidro: o quintal lá fora + reflexo
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(wi.w, wi.h), new THREE.MeshBasicMaterial({ map: yardTexture(), fog: false }));
  yard.position.set(wi.cx, wi.sill + wi.h / 2, zN - 0.06);
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(wi.w, wi.h), new THREE.MeshStandardMaterial({ color: '#dfeaf5', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.14, depthWrite: false }));
  sheen.position.set(wi.cx, wi.sill + wi.h / 2, zN - 0.04);
  grp.add(yard, sheen);
  // caixilho em cruz + peitoril
  const frameMat = stdMat('#ffffff', { roughness: 0.45 });
  const t = 0.05;
  for (const [w, h, x, y] of [[wi.w + 0.08, t, wi.cx, wi.sill + wi.h], [wi.w + 0.08, t, wi.cx, wi.sill], [t, wi.h, a, wi.sill + wi.h / 2], [t, wi.h, b, wi.sill + wi.h / 2], [t * 0.6, wi.h, wi.cx, wi.sill + wi.h / 2], [wi.w, t * 0.6, wi.cx, wi.sill + wi.h * 0.55]]) {
    const fm = new THREE.Mesh(rbox(w, h, 0.07, 0.01), frameMat);
    fm.position.set(x, y, zN + 0.1);
    grp.add(fm);
  }
  const sill = new THREE.Mesh(rbox(wi.w + 0.22, 0.04, 0.2, 0.01), stdMat('#f1ebe0', { roughness: 0.55 }));
  sill.position.set(wi.cx, wi.sill - 0.01, zN + 0.18);
  grp.add(sill);
  // vasinho de temperos no peitoril
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.11, 14), stdMat('#c9764f', { roughness: 0.85 }));
  pot.position.set(wi.cx + 0.38, wi.sill + 0.065, zN + 0.2);
  grp.add(pot);
  const leafMat = stdMat('#6f9a58', { roughness: 0.8 });
  const r = rng(9);
  for (let i = 0; i < 9; i++) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.035 + r() * 0.02, 8, 6), leafMat);
    lf.position.set(wi.cx + 0.38 + (r() - 0.5) * 0.1, wi.sill + 0.15 + r() * 0.1, zN + 0.2 + (r() - 0.5) * 0.08);
    lf.scale.set(1, 0.7, 1);
    grp.add(lf);
  }
  // cortininha de café (meia janela) num varãozinho, com uma pregueada leve
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, wi.w + 0.12, 8).rotateZ(Math.PI / 2), stdMat('#c99a45', { roughness: 0.3, metalness: 0.7 }));
  rod.position.set(wi.cx, wi.sill + wi.h * 0.55 + 0.04, zN + 0.16);
  grp.add(rod);
  const curtH = wi.h * 0.5;
  const cg = new THREE.PlaneGeometry(wi.w / 2 - 0.02, curtH, 24, 1);
  const cp = cg.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 52) * 0.012);
  cg.computeVertexNormals();
  const curtMat = new THREE.MeshStandardMaterial({ map: ginghamTexture(), roughness: 0.95, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const cm = new THREE.Mesh(cg, curtMat);
    cm.position.set(wi.cx + s * (wi.w / 4 + 0.005), wi.sill + wi.h * 0.55 + 0.04 - curtH / 2, zN + 0.155);
    grp.add(cm);
  }

  // ---- azulejo até 1 m na parede do fundo (um plano 2 mm à frente) e a faixa de cerâmica azul no topo
  const tileTop = 1.0;
  const tileTex = wallTileTexture();
  tileTex.repeat.set((x1 - x0) / 0.6, (tileTop - 0.11) / 0.6);
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.4, tileTop - 0.11), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.18, metalness: 0.02 }));
  tiles.position.set((B.minX + B.maxX) / 2, 0.11 + (tileTop - 0.11) / 2, B.minZ + 0.002);
  tiles.receiveShadow = true;
  const band = new THREE.Mesh(rbox(B.maxX - B.minX, 0.045, 0.014, 0.004), stdMat('#3f8fb0', { roughness: 0.2 }));
  band.position.set((B.minX + B.maxX) / 2, tileTop + 0.022, B.minZ + 0.004);
  grp.add(tiles, band);

  // ---- laterais (cortadas) e sul (só o rodapé do corte)
  const zMid = (B.minZ + B.maxZ) / 2 + 0.05;
  const sideLen = B.maxZ - B.minZ + 0.3;
  cutWall(grp, B.minX - T / 2, zMid - 0.15, T, sideLen + 0.2, C, sideMat);
  cutWall(grp, B.maxX + T / 2, zMid - 0.15, T, sideLen + 0.2, C, sideMat);
  cutWall(grp, (B.minX + B.maxX) / 2, B.maxZ + T / 2, B.maxX - B.minX + 2 * T + 0.008, T, 0.22, stdMat('#efe6d6', { roughness: 0.8 }));

  // ---- rodapés brancos
  const sk = [];
  sk.push(new THREE.BoxGeometry(B.maxX - B.minX - 0.01, 0.1, 0.02).translate((B.minX + B.maxX) / 2, 0.05, B.minZ + 0.012));
  sk.push(new THREE.BoxGeometry(0.02, 0.1, B.maxZ - B.minZ - 0.01).translate(B.minX + 0.012, 0.05, (B.minZ + B.maxZ) / 2));
  sk.push(new THREE.BoxGeometry(0.02, 0.1, B.maxZ - B.minZ - 0.01).translate(B.maxX - 0.012, 0.05, (B.minZ + B.maxZ) / 2));
  const skMesh = new THREE.Mesh(mergeGeometries(sk), stdMat('#f7f3ea', { roughness: 0.6 }));
  skMesh.receiveShadow = true;
  grp.add(skMesh);

  // ---- plaquinhas sobre os botões (o que cada um faz)
  const plaqueFrame = stdMat('#6b4a33', { roughness: 0.6 });
  for (const [cfg, kind] of /** @type {[any, string][]} */ ([[SPIN_BUTTON, 'spin'], [RACK_BUTTON, 'rack']])) {
    const y = cfg.top + 0.27;
    const f = new THREE.Mesh(rbox(0.25, 0.2, 0.02, 0.008), plaqueFrame);
    f.position.set(cfg.x, y, B.minZ + 0.012);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.165), new THREE.MeshStandardMaterial({ map: plaqueTexture(kind), roughness: 0.7 }));
    pic.position.set(cfg.x, y, B.minZ + 0.0245); // 2,5 mm à frente da moldura
    grp.add(f, pic);
  }

  // ---- relógio (acima do tanque) e calendário (entre o botão do varal e o relógio)
  const clock = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshStandardMaterial({ color: '#fbf6ec', roughness: 0.5 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.017, 8, 32), stdMat('#3f8fb0', { roughness: 0.4 }));
  const hourH = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.075, 0.004).translate(0, 0.037, 0), stdMat('#2a1c14'));
  const minH = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.11, 0.004).translate(0, 0.055, 0), stdMat('#2a1c14'));
  const secH = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.12, 0.003).translate(0, 0.045, 0), stdMat('#d94a3a'));
  hourH.position.z = 0.006;
  minH.position.z = 0.009;
  secH.position.z = 0.012;
  clock.add(face, rim, hourH, minH, secH);
  clock.position.set(3.85, 2.05, B.minZ + 0.02);
  hourH.rotation.z = -0.4; // 10 da manhã
  minH.rotation.z = -1.0;
  grp.add(clock);
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), new THREE.MeshStandardMaterial({ map: calendarTexture(), roughness: 0.8 }));
  cal.position.set(2.1, 1.8, B.minZ + 0.003);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), stdMat('#e8554a', { roughness: 0.4 }));
  pin.position.set(2.1, 1.95, B.minZ + 0.01);
  grp.add(cal, pin);

  // ---- raios de sol entrando pela janela (planos aditivos inclinados no sentido do sol)
  const sun = new THREE.Vector3(...layout.SUN.direction).normalize();
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const shafts = new THREE.Group();
  shafts.name = 'raios-de-sol';
  const len = 2.6;
  for (const [dx, w] of [[-0.35, 0.34], [0.05, 0.42], [0.42, 0.3]]) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(w, len), shaftMat);
    // centro a meio caminho entre a janela e o chão, no sentido em que a luz anda (−sun)
    const start = new THREE.Vector3(wi.cx + dx, wi.sill + wi.h * 0.5, B.minZ + 0.05);
    const mid = start.clone().addScaledVector(sun, -len / 2);
    sh.position.copy(mid);
    sh.lookAt(mid.clone().add(new THREE.Vector3(0, 0, 1)));
    sh.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sun));
    shafts.add(sh);
  }
  grp.add(shafts);
  updaters.push((dt, tt) => { shaftMat.opacity = 0.18 + 0.05 * Math.sin(tt * 0.7); secH.rotation.z = -Math.floor(tt) * (Math.PI / 30); });
  return grp;
}

export function buildRoom(layout) {
  const updaters = [];
  const floor = buildFloor(layout);
  const walls = buildWalls(layout, updaters);
  const group = new THREE.Group();
  group.name = 'lavanderia';
  group.add(floor, walls);
  return { group, walls, update: (dt, t) => { for (const f of updaters) f(dt, t); } };
}
