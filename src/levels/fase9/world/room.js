// FASE 9 · A casa do vovô em corte de maquete: laje com a borda do corte à mostra, quatro pisos (taco em espinha no
// escritório, ladrilho xadrez no hall, assoalho escuro na biblioteca, lajota de barro no jardim de inverno), a parede
// do fundo inteira (papel de parede de cada cômodo, lambri, a porta da frente com vitral de chuva, a alvenaria e as
// vidraças do jardim de inverno com a chuva escorrendo), divisórias cortadas com a porta do escritório, a portinha de
// gato, o arco e as portas de vidro abertas, rodapés e o duto do aquecedor que corre no alto da parede do fundo.
// O duto: pipePath = os pontos do cano (da grade de baixo no jardim de inverno até a grade alta do escritório);
// pointAt(u 0..1) dá a posição ao longo dele (as baforadas andam por ali).
import * as THREE from 'three';
import { rng, rbox, canvasTexture, plasterMat, stdMat, woodMat, mergeGeometries } from '../../../world/util.js';

const POCHE = '#3b2a20';
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ texturas
/** Taco de madeira em espinha de peixe (repetição de 0,8 m). */
function herringboneTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(12);
    g.fillStyle = '#6b4428'; g.fillRect(0, 0, w, h);
    const L = 64, Wd = 16;
    for (let y = -L; y < h + L; y += Wd * 2) {
      for (let x = -L; x < w + L; x += L) {
        for (const flip of [0, 1]) {
          const tone = 0.82 + r() * 0.3;
          g.fillStyle = `rgb(${(150 * tone) | 0},${(98 * tone) | 0},${(58 * tone) | 0})`;
          g.save();
          g.translate(x + (flip ? Wd : 0), y + (flip ? Wd : 0));
          g.rotate(flip ? -Math.PI / 4 : Math.PI / 4);
          g.fillRect(0, 0, L * 0.7, Wd - 1.5);
          g.restore();
        }
      }
    }
  });
}
/** Ladrilho hidráulico xadrez creme e verde-escuro com florzinha (repetição de 0,6 m = 3 × 3). */
function checkerTexture() {
  return canvasTexture(192, 192, (g) => {
    const px = 64;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const dark = (i + j) % 2 === 1;
      g.fillStyle = dark ? '#2f4a3e' : '#eadfc8';
      g.fillRect(i * px, j * px, px, px);
      g.fillStyle = dark ? 'rgba(234,223,200,0.35)' : 'rgba(47,74,62,0.3)';
      g.beginPath(); g.arc(i * px + px / 2, j * px + px / 2, 7, 0, TAU); g.fill();
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + Math.PI / 4;
        g.beginPath(); g.ellipse(i * px + px / 2 + Math.cos(a) * 14, j * px + px / 2 + Math.sin(a) * 14, 6, 3, a, 0, TAU); g.fill();
      }
    }
    g.fillStyle = 'rgba(200,190,170,0.6)';
    for (let i = 0; i <= 3; i++) { g.fillRect(i * px - 1, 0, 2, 192); g.fillRect(0, i * px - 1, 192, 2); }
  });
}
/** Assoalho de tábuas escuras e compridas (repetição de 1,2 m). */
function plankTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(33);
    const rows = 8;
    for (let j = 0; j < rows; j++) {
      let x = -r() * 120;
      while (x < w) {
        const len = 90 + r() * 110;
        const tone = 0.8 + r() * 0.3;
        g.fillStyle = `rgb(${(96 * tone) | 0},${(58 * tone) | 0},${(34 * tone) | 0})`;
        g.fillRect(x, (j * h) / rows, len - 2, h / rows - 2);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        for (let k = 0; k < 4; k++) g.fillRect(x + r() * len, (j * h) / rows + r() * (h / rows - 4), 18 + r() * 30, 1);
        x += len;
      }
    }
  });
}
/** Lajota de barro sextavada simplificada (quadrada com chanfro) (repetição de 0,9 m = 3 × 3). */
function terracottaTexture() {
  return canvasTexture(192, 192, (g) => {
    const r = rng(51);
    const px = 64;
    g.fillStyle = '#a89a86'; g.fillRect(0, 0, 192, 192);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const tone = 0.85 + r() * 0.25;
      g.fillStyle = `rgb(${(190 * tone) | 0},${(102 * tone) | 0},${(66 * tone) | 0})`;
      g.beginPath(); g.roundRect(i * px + 3, j * px + 3, px - 6, px - 6, 6); g.fill();
      g.fillStyle = 'rgba(255,230,200,0.08)';
      g.fillRect(i * px + 6, j * px + 6, px - 12, 10);
    }
  });
}
/** Papel de parede: listras e florzinha. */
function wallpaperTexture(base, stripe, motif) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = stripe;
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 10, h);
    g.fillStyle = motif;
    for (let y = 16; y < h; y += 32) for (let x = 21; x < w; x += 32) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        g.beginPath(); g.ellipse(x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 2.6, 1.6, a, 0, TAU); g.fill();
      }
    }
  });
}
/** Chuva escorrendo no vidro e o jardim escuro lá fora (animada pela textura de cima). */
function nightGardenTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1a2338'); sky.addColorStop(0.55, '#26324a'); sky.addColorStop(0.56, '#18241c'); sky.addColorStop(1, '#0f1712');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const r = rng(77);
    // copas escuras e um poste com luz quente lá longe
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `rgba(${16 + r() * 10},${30 + r() * 14},${22 + r() * 10},0.95)`;
      g.beginPath(); g.arc(r() * w, h * (0.5 + r() * 0.08), 26 + r() * 24, 0, TAU); g.fill();
    }
    const glow = g.createRadialGradient(200, 120, 2, 200, 120, 30);
    glow.addColorStop(0, 'rgba(255,214,150,0.9)'); glow.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = glow; g.fillRect(160, 80, 80, 80);
  }, { repeat: false });
}
function rainTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, len = 6 + r() * 26;
      g.strokeStyle = `rgba(210,225,245,${0.18 + r() * 0.3})`;
      g.lineWidth = 1 + r() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y + len); g.stroke();
      g.fillStyle = `rgba(220,235,255,${0.25 + r() * 0.3})`;
      g.beginPath(); g.arc(x, y + len, 1.4, 0, TAU); g.fill();
    }
  }, { srgb: false });
}
/** Tijolinho à vista. */
function brickTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(23);
    g.fillStyle = '#d8cbb6'; g.fillRect(0, 0, w, h);
    const bh = 16, bw = 32;
    for (let j = 0; j < h / bh; j++) {
      for (let i = -1; i < w / bw + 1; i++) {
        const tone = 0.8 + r() * 0.3;
        g.fillStyle = `rgb(${(168 * tone) | 0},${(86 * tone) | 0},${(60 * tone) | 0})`;
        g.fillRect(i * bw + (j % 2 ? bw / 2 : 0) + 1.5, j * bh + 1.5, bw - 3, bh - 3);
      }
    }
  });
}

// ------------------------------------------------------------------ peças
/** Caixa de parede com a faixa escura do corte no topo (poche). */
function wallBox(grp, x, y0, z, w, h, d, mat, poche = true) {
  const m = new THREE.Mesh(rbox(w, h, d, 0.01), mat);
  m.position.set(x, y0 + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  grp.add(m);
  if (poche) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 0.02, d + 0.004), stdMat(POCHE, { roughness: 0.95 }));
    p.position.set(x, y0 + h + 0.01, z);
    grp.add(p);
  }
  return m;
}
/** Material de parede com papel (repetição em metros). */
function paperMat(base, stripe, motif, tile = 0.5) {
  const tex = wallpaperTexture(base, stripe, motif);
  tex.repeat.set(1 / tile, 1 / tile);
  return { mat: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), tex };
}

function buildFloors(layout) {
  const grp = new THREE.Group();
  grp.name = 'pisos';
  const B = layout.WORLD.bounds;
  const { WALL_EH, WALL_HL, WALL_LJ } = layout;
  const D = B.maxZ - B.minZ;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(B.maxX - B.minX + 0.4, 0.32, D + 0.6), stdMat(POCHE, { roughness: 0.95 }));
  slab.position.set((B.minX + B.maxX) / 2, -0.161, (B.minZ + B.maxZ) / 2 + 0.1);
  grp.add(slab);
  /** @type {[number, number, THREE.Texture, number, number][]} */
  const rooms = [
    [B.minX, WALL_EH.x, herringboneTexture(), 0.8, 0.5],
    [WALL_EH.x, WALL_HL.x, checkerTexture(), 0.6, 0.35],
    [WALL_HL.x, WALL_LJ.x, plankTexture(), 1.2, 0.45],
    [WALL_LJ.x, B.maxX, terracottaTexture(), 0.9, 0.7],
  ];
  for (const [x0, x1, tex, rep, rough] of rooms) {
    const W = x1 - x0;
    tex.repeat.set(W / rep, D / rep);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: rough }));
    f.position.set((x0 + x1) / 2, 0.001, (B.minZ + B.maxZ) / 2);
    f.receiveShadow = true;
    grp.add(f);
  }
  return grp;
}

function buildWalls(layout, updaters) {
  const grp = new THREE.Group();
  grp.name = 'paredes';
  const { WALLS, WORLD, WALL_EH, WALL_HL, WALL_LJ, CONSERVATORY, FRONT_DOOR } = layout;
  const B = WORLD.bounds;
  const H = WALLS.northH, C = WALLS.cutH, T = WALLS.t;
  const zN = B.minZ - T / 2;
  const x0 = B.minX - T + 0.02, x1 = B.maxX + T - 0.02;
  const office = paperMat('#3d5a46', '#45654f', '#c9b77a', 0.42);
  const hall = paperMat('#e8d9b8', '#e1d0ab', '#b06a4a', 0.4);
  const library = paperMat('#6b2a2a', '#742f2f', '#d8b25a', 0.45);
  const brickTex = brickTexture();
  brickTex.repeat.set(1 / 0.5, 1 / 0.5);
  const brick = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.92 });
  const side = plasterMat('#e9dcc0');

  // ---- parede do fundo: escritório | hall (com a porta da frente) | biblioteca | jardim de inverno
  wallBox(grp, (x0 + WALL_EH.x) / 2, 0, zN, WALL_EH.x - x0, H, T, office.mat);
  const da = FRONT_DOOR.x - FRONT_DOOR.w / 2, db = FRONT_DOOR.x + FRONT_DOOR.w / 2;
  wallBox(grp, (WALL_EH.x + da) / 2, 0, zN, da - WALL_EH.x, H, T, hall.mat);
  wallBox(grp, (db + WALL_HL.x) / 2, 0, zN, WALL_HL.x - db, H, T, hall.mat);
  wallBox(grp, FRONT_DOOR.x, FRONT_DOOR.h, zN, FRONT_DOOR.w, H - FRONT_DOOR.h, T, hall.mat);
  wallBox(grp, (WALL_HL.x + WALL_LJ.x) / 2, 0, zN, WALL_LJ.x - WALL_HL.x, H, T, library.mat);
  // jardim de inverno: alvenaria (com o duto) e vidraças com peitoril baixo de tijolinho
  const br = CONSERVATORY.brick;
  wallBox(grp, (br.x0 + br.x1) / 2, 0, zN, br.x1 - br.x0, H, T, brick);
  const glassSpans = [[WALL_LJ.x, br.x0], [br.x1, x1]];
  const parapet = 0.55;
  const garden = new THREE.MeshBasicMaterial({ map: nightGardenTexture(), fog: false });
  const rainTex = rainTexture();
  const rainMat = new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, depthWrite: false, fog: false });
  const frameMat = stdMat('#f2efe6', { roughness: 0.45 });
  for (const [a, b] of glassSpans) {
    wallBox(grp, (a + b) / 2, 0, zN, b - a, parapet, T, brick);
    const gh = H - 0.18 - parapet;
    const view = new THREE.Mesh(new THREE.PlaneGeometry(b - a, gh), garden);
    view.position.set((a + b) / 2, parapet + gh / 2, zN - 0.05);
    const rain = new THREE.Mesh(new THREE.PlaneGeometry(b - a, gh), rainMat);
    rain.position.set((a + b) / 2, parapet + gh / 2, zN + 0.02);
    rain.material.map.repeat.set((b - a) / 0.6, gh / 1.0);
    grp.add(view, rain);
    // caixilhos (montantes a cada ~0,55 m) e a viga de cima
    const n = Math.max(1, Math.round((b - a) / 0.55));
    for (let i = 0; i <= n; i++) {
      const fx = Math.min(b - 0.03, Math.max(a + 0.03, a + ((b - a) * i) / n));
      const fm = new THREE.Mesh(rbox(0.045, gh, 0.07, 0.008), frameMat);
      fm.position.set(fx, parapet + gh / 2, zN + 0.04);
      grp.add(fm);
    }
    for (const fy of [parapet + 0.02, parapet + gh * 0.62, H - 0.2]) {
      const fm = new THREE.Mesh(rbox(b - a - 0.01, 0.045, 0.07, 0.008), frameMat);
      fm.position.set((a + b) / 2, fy, zN + 0.04);
      grp.add(fm);
    }
    wallBox(grp, (a + b) / 2, H - 0.18, zN, b - a, 0.18, T, brick);
  }
  updaters.push((dt) => { rainTex.offset.y -= dt * 0.22; });

  // ---- porta da frente (fechada): almofadas, vitral com a chuva e a maçaneta
  const doorMat = woodMat('#5a3a24', { key: 'f9-porta-frente', rough: 0.6 });
  const door = new THREE.Mesh(rbox(FRONT_DOOR.w - 0.06, FRONT_DOOR.h - 0.03, 0.06, 0.01), doorMat);
  door.position.set(FRONT_DOOR.x, (FRONT_DOOR.h - 0.03) / 2, zN + 0.03);
  door.castShadow = door.receiveShadow = true;
  grp.add(door);
  const panelMat = woodMat('#6b4630', { key: 'f9-porta-almofada', rough: 0.55 });
  for (const [px, py, pw, ph] of [[-0.2, 0.5, 0.3, 0.62], [0.2, 0.5, 0.3, 0.62]]) {
    const p = new THREE.Mesh(rbox(pw, ph, 0.02, 0.012), panelMat);
    p.position.set(FRONT_DOOR.x + px, py, zN + 0.067);
    grp.add(p);
  }
  const vit = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.62), new THREE.MeshBasicMaterial({ map: nightGardenTexture(), fog: false }));
  vit.position.set(FRONT_DOOR.x, 1.5, zN + 0.062);
  const vitRain = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.62), rainMat);
  vitRain.position.set(FRONT_DOOR.x, 1.5, zN + 0.066);
  grp.add(vit, vitRain);
  const brass = stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 });
  for (const [w, h, y] of [[0.72, 0.035, 1.82], [0.72, 0.035, 1.18], [0.035, 0.66, 1.5]]) {
    const f = new THREE.Mesh(rbox(w, h, 0.03, 0.006), panelMat);
    f.position.set(FRONT_DOOR.x, y, zN + 0.072);
    grp.add(f);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), brass);
  knob.position.set(FRONT_DOOR.x + 0.36, 1.0, zN + 0.1);
  grp.add(knob);
  const frame = stdMat('#efe6d6', { roughness: 0.55 });
  for (const [w, h, x, y] of [[0.08, FRONT_DOOR.h + 0.06, da - 0.04, (FRONT_DOOR.h + 0.06) / 2], [0.08, FRONT_DOOR.h + 0.06, db + 0.04, (FRONT_DOOR.h + 0.06) / 2], [FRONT_DOOR.w + 0.16, 0.08, FRONT_DOOR.x, FRONT_DOOR.h + 0.04]]) {
    const f = new THREE.Mesh(rbox(w, h, 0.05, 0.01), frame);
    f.position.set(x, y, zN + 0.125);
    grp.add(f);
  }
  // capacho na frente da porta
  const mat = new THREE.Mesh(rbox(0.8, 0.012, 0.42, 0.006), stdMat('#8a6a3c', { roughness: 0.95 }));
  mat.position.set(FRONT_DOOR.x, 0.007, B.minZ + 0.3);
  mat.receiveShadow = true;
  grp.add(mat);

  // ---- lambri de madeira até 0,95 m (hall e biblioteca) e roda-meio
  const wains = woodMat('#7a5236', { key: 'f9-lambri', rough: 0.6 });
  for (const [a, b] of [[WALL_EH.x, da - 0.08], [db + 0.08, WALL_HL.x]]) {
    const w = new THREE.Mesh(rbox(b - a, 0.85, 0.02, 0.006), wains);
    w.position.set((a + b) / 2, 0.1 + 0.425, B.minZ + 0.01);
    const cap = new THREE.Mesh(rbox(b - a, 0.035, 0.035, 0.008), wains);
    cap.position.set((a + b) / 2, 0.97, B.minZ + 0.018);
    grp.add(w, cap);
  }
  // sanca no alto da parede do fundo (as paredes não têm teto)
  const crown = new THREE.Mesh(rbox(x1 - x0 - 0.02, 0.07, 0.05, 0.012), stdMat('#f1e8d6', { roughness: 0.5 }));
  crown.position.set((x0 + x1) / 2, H - 0.035, B.minZ + 0.025);
  grp.add(crown);

  // ---- divisórias cortadas: escritório | hall (porta e portinha), hall | biblioteca (arco), biblioteca | jardim
  const dSide = plasterMat('#efe3c6');
  const zs = (z0, z1) => [(z0 + z1) / 2, z1 - z0];
  const parts = [
    [WALL_EH.x, B.minZ, WALL_EH.door.z0], [WALL_EH.x, WALL_EH.door.z1, WALL_EH.catFlap.z0], [WALL_EH.x, WALL_EH.catFlap.z1, B.maxZ],
    [WALL_HL.x, B.minZ, WALL_HL.gap.z0], [WALL_HL.x, WALL_HL.gap.z1, B.maxZ],
    [WALL_LJ.x, B.minZ, WALL_LJ.gap.z0], [WALL_LJ.x, WALL_LJ.gap.z1, B.maxZ],
  ];
  for (const [x, z0, z1] of parts) {
    const [zc, len] = zs(z0, z1);
    wallBox(grp, x, 0, zc, T, C, len, dSide);
  }
  // em cima da portinha de gato a parede continua (a passagem fica embaixo)
  const flapH = 0.26;
  const [fzc, flen] = zs(WALL_EH.catFlap.z0, WALL_EH.catFlap.z1);
  wallBox(grp, WALL_EH.x, flapH, fzc, T, C - flapH, flen, dSide);
  // a portinha: um buraco de verdade (forro escuro por dentro da parede), moldura de madeira em arco dos dois lados,
  // a aba âmbar que balança quando alguém passa, a plaquinha com a patinha e um capacho de cada lado
  const liner = stdMat('#1c1611', { roughness: 0.95 });
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(T - 0.012, 0.012, flen - 0.008), liner);
  ceil.position.set(WALL_EH.x, flapH - 0.008, fzc);
  grp.add(ceil);
  for (const s of [-1, 1]) {
    const sideLiner = new THREE.Mesh(new THREE.BoxGeometry(T - 0.012, flapH - 0.016, 0.012), liner);
    sideLiner.position.set(WALL_EH.x, (flapH - 0.016) / 2, fzc + s * (flen / 2 - 0.008));
    grp.add(sideLiner);
  }
  const trim = woodMat('#6b4630', { key: 'f9-portinha', rough: 0.45 });
  const pawTex = pawPlaqueTexture();
  for (const fs of [-1, 1]) {
    const fx = WALL_EH.x + fs * (T / 2 + 0.012);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(rbox(0.024, flapH + 0.02, 0.05, 0.008), trim);
      post.position.set(fx, (flapH + 0.02) / 2, fzc + s * (flen / 2 + 0.025));
      grp.add(post);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(flen / 2 + 0.025, 0.02, 8, 24, Math.PI), trim);
    arch.rotation.y = Math.PI / 2;
    arch.position.set(fx, flapH + 0.02, fzc);
    grp.add(arch);
    const sill = new THREE.Mesh(rbox(0.05, 0.016, flen + 0.1, 0.006), stdMat('#c99a45', { roughness: 0.35, metalness: 0.7 }));
    sill.position.set(WALL_EH.x + fs * (T / 2 + 0.02), 0.008, fzc);
    grp.add(sill);
    const plaque = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), new THREE.MeshStandardMaterial({ map: pawTex, roughness: 0.5 }));
    plaque.scale.set(1, 0.78, 1);
    plaque.rotation.y = fs * Math.PI / 2;
    plaque.position.set(WALL_EH.x + fs * (T / 2 + 0.004), flapH + 0.36, fzc);
    grp.add(plaque);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: doormatTexture(), roughness: 0.95 }));
    mat.position.set(WALL_EH.x + fs * (T / 2 + 0.22), 0.005, fzc);
    mat.receiveShadow = true;
    grp.add(mat);
  }
  const flapPivot = new THREE.Group();
  flapPivot.position.set(WALL_EH.x, flapH - 0.02, fzc);
  const flapLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.01, flapH - 0.05, flen - 0.06), new THREE.MeshStandardMaterial({ color: '#e8b45a', roughness: 0.3, transparent: true, opacity: 0.82, depthWrite: false }));
  flapLeaf.position.y = -(flapH - 0.05) / 2;
  flapPivot.add(flapLeaf);
  grp.add(flapPivot);
  const flap = { swing: 0, target: 0 };
  updaters.push((dt) => {
    flap.swing += (flap.target - flap.swing) * (1 - Math.exp(-dt * 10));
    flapPivot.rotation.z = flap.swing * 1.1;
  });
  // batentes da porta do escritório e o arco do hall
  const casing = stdMat('#f3ecdd', { roughness: 0.5 });
  for (const z of [WALL_EH.door.z0 - 0.02, WALL_EH.door.z1 + 0.02]) {
    const c = new THREE.Mesh(rbox(T + 0.06, C + 0.035, 0.06, 0.01), casing);
    c.position.set(WALL_EH.x, (C + 0.035) / 2, z);
    grp.add(c);
  }
  for (const z of [WALL_HL.gap.z0 - 0.03, WALL_HL.gap.z1 + 0.03]) {
    const c = new THREE.Mesh(rbox(T + 0.08, C + 0.04, 0.08, 0.02), casing);
    c.position.set(WALL_HL.x, (C + 0.04) / 2, z);
    grp.add(c);
  }
  // portas de vidro abertas para o jardim de inverno, encostadas na divisória (o trilho do vaso passa ao lado)
  // vidro só tingido (sem brilho especular): o reflexo do luar na folha transparente estourava em branco
  const glassMat = new THREE.MeshBasicMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.16, depthWrite: false });
  const leafFrame = stdMat('#f2efe6', { roughness: 0.45 });
  const leafW = (WALL_LJ.gap.z1 - WALL_LJ.gap.z0) / 2;
  for (const [hz, dir] of [[WALL_LJ.gap.z0, 1], [WALL_LJ.gap.z1, -1]]) {
    const leaf = new THREE.Group();
    leaf.position.set(WALL_LJ.x + T / 2, 0, hz);
    leaf.rotation.y = dir * Math.PI * 0.965;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(leafW - 0.06, C - 0.1), glassMat);
    pane.position.set(0, C / 2, dir * leafW / 2);
    pane.rotation.y = Math.PI / 2;
    leaf.add(pane);
    for (const [w, h, y, zc] of [[0.04, C, C / 2, 0.02 * dir], [0.04, C, C / 2, dir * (leafW - 0.02)], [0.04, 0.05, 0.03, dir * leafW / 2], [0.04, 0.05, C - 0.03, dir * leafW / 2]]) {
      const len = h === C ? 0.04 : leafW;
      const f = new THREE.Mesh(rbox(0.04, h, len, 0.006), leafFrame);
      f.position.set(0, y, zc);
      leaf.add(f);
    }
    grp.add(leaf);
  }

  // ---- laterais (cortadas; a do jardim de inverno com vidraça) e o rodapé do corte no sul
  const zMid = (B.minZ + B.maxZ) / 2 - 0.1;
  const sideLen = B.maxZ - B.minZ + 0.5;
  wallBox(grp, B.minX - T / 2, 0, zMid, T, C, sideLen, side);
  wallBox(grp, B.maxX + T / 2, 0, zMid, T, parapet, sideLen, brick);
  const ev = new THREE.Mesh(new THREE.PlaneGeometry(sideLen, C - parapet), garden);
  ev.rotation.y = -Math.PI / 2;
  ev.position.set(B.maxX + T / 2 + 0.05, parapet + (C - parapet) / 2, zMid);
  grp.add(ev);
  for (let i = 0; i <= 10; i++) {
    const fz = zMid - sideLen / 2 + (sideLen * i) / 10;
    const fm = new THREE.Mesh(rbox(0.07, C - parapet, 0.045, 0.008), frameMat);
    fm.position.set(B.maxX + 0.02, parapet + (C - parapet) / 2, fz);
    grp.add(fm);
  }
  const capZ0 = B.minZ + 0.005, capZ1 = zMid + sideLen / 2;
  const cap = new THREE.Mesh(rbox(0.09, 0.05, capZ1 - capZ0, 0.01), frameMat);
  cap.position.set(B.maxX + 0.02, C - 0.005, (capZ0 + capZ1) / 2);
  grp.add(cap);
  wallBox(grp, (B.minX + B.maxX) / 2, 0, B.maxZ + T / 2, B.maxX - B.minX + 2 * T + 0.008, 0.22, T, stdMat('#e6dccb', { roughness: 0.8 }));

  // ---- rodapés de madeira (parede do fundo e laterais; as divisórias ganham os seus)
  const sk = [];
  sk.push(new THREE.BoxGeometry(B.maxX - B.minX - 0.01, 0.09, 0.02).translate((B.minX + B.maxX) / 2, 0.045, B.minZ + 0.012));
  sk.push(new THREE.BoxGeometry(0.02, 0.09, B.maxZ - B.minZ - 0.01).translate(B.minX + 0.012, 0.045, (B.minZ + B.maxZ) / 2));
  const skMesh = new THREE.Mesh(mergeGeometries(sk), stdMat('#4a3020', { roughness: 0.6 }));
  skMesh.receiveShadow = true;
  grp.add(skMesh);

  return { group: grp, flapPivot, setFlapSwing(v) { flap.target = Math.max(-1, Math.min(1, v)); } };
}

// ------------------------------------------------------------------ duto do aquecedor
/**
 * Cano de seção redonda no alto da parede do fundo: desce até a grade de baixo no jardim de inverno (entrada) e até
 * a grade alta em cima do armário do escritório (saída). Os pontos vão da entrada à saída.
 */
function buildDuct(layout) {
  const grp = new THREE.Group();
  grp.name = 'duto';
  const { DUCT, WORLD } = layout;
  const B = WORLD.bounds;
  const z = B.minZ + 0.12;
  const yTop = DUCT.y;
  const inlet = { x: DUCT.inlet.x, y: 0.42 };
  const outletY = layout.CAT.top.y + 0.32;
  const pts = [
    new THREE.Vector3(inlet.x, inlet.y, z), new THREE.Vector3(inlet.x, yTop, z),
    new THREE.Vector3(DUCT.outlet.x, yTop, z), new THREE.Vector3(DUCT.outlet.x, outletY, z),
  ];
  const metal = new THREE.MeshStandardMaterial({ color: '#b9b2a6', roughness: 0.35, metalness: 0.75 });
  const R = 0.075;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = a.distanceTo(b);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 18, 1, true), metal);
    cyl.position.copy(a).add(b).multiplyScalar(0.5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    cyl.castShadow = true;
    grp.add(cyl);
    // cintas a cada ~0,8 m
    const n = Math.floor(len / 0.8);
    for (let k = 1; k <= n; k++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(R + 0.004, 0.006, 6, 18), metal);
      band.position.copy(a).lerp(b, k / (n + 1));
      band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
      grp.add(band);
    }
  }
  for (const p of pts.slice(1, 3)) {
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 16, 12), metal);
    elbow.position.copy(p);
    grp.add(elbow);
  }
  // grade de baixo (entrada) no jardim de inverno e grade alta (saída) do escritório
  const slatMat = new THREE.MeshStandardMaterial({ color: '#8a8378', roughness: 0.4, metalness: 0.6 });
  const darkMat = stdMat('#1e1a16', { roughness: 0.9 });
  /** Grade na parede do fundo; `slats` recebe as palhetas (registro que abre). @param {THREE.Object3D[] | null} [slats] */
  function grille(x, y, w, h, slats = null) {
    const g = new THREE.Group();
    const back = new THREE.Mesh(rbox(w, h, 0.04, 0.01), darkMat);
    const box = new THREE.Mesh(rbox(w + 0.04, h + 0.04, 0.03, 0.01), metal);
    box.position.z = -0.006;
    g.add(box, back);
    const n = Math.round(h / 0.03);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(rbox(w - 0.02, 0.012, 0.03, 0.004), slatMat);
      s.position.set(0, -h / 2 + (i + 0.5) * (h / n), 0.012);
      s.rotation.x = slats ? 1.5 : 0.5;
      g.add(s);
      slats?.push(s);
    }
    g.position.set(x, y, B.minZ + 0.035);
    grp.add(g);
    return g;
  }
  // a grade de baixo é o registro: palhetas em pé (fechado) que deitam quando o botão do chão abre, e a lâmpada
  const louvers = [];
  grille(inlet.x, 0.24, 0.42, 0.34, louvers);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#5a2420', roughness: 0.3, emissive: '#ff3a2a', emissiveIntensity: 0.8 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), lampMat);
  lamp.position.set(inlet.x + 0.26, 0.38, B.minZ + 0.03);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14).rotateX(Math.PI / 2), metal);
  lampBase.position.set(inlet.x + 0.26, 0.38, B.minZ + 0.01);
  grp.add(lamp, lampBase);
  const damper = { open: false, k: 0 };
  const RED = new THREE.Color('#ff3a2a');
  const GREEN = new THREE.Color('#5fe08a');
  const outletGrille = grille(DUCT.outlet.x, outletY - 0.12, 0.34, 0.2);

  // baforadas: brilhinhos verdes que correm por fora do cano (u 0..1 da entrada à saída)
  const segLen = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); segLen.push(l); total += l; }
  const pointAt = (u, out = new THREE.Vector3()) => {
    let d = Math.min(1, Math.max(0, u)) * total;
    for (let i = 0; i < segLen.length; i++) {
      if (d <= segLen[i] || i === segLen.length - 1) return out.copy(pts[i]).lerp(pts[i + 1], Math.min(1, d / segLen[i]));
      d -= segLen[i];
    }
    return out.copy(pts[pts.length - 1]);
  };
  const puffTex = canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(210,240,160,0.95)'); grd.addColorStop(0.5, 'rgba(170,220,120,0.4)'); grd.addColorStop(1, 'rgba(170,220,120,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { repeat: false });
  const puffMat = new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(puffMat.clone());
    s.scale.setScalar(0.32);
    s.visible = false;
    grp.add(s);
    puffs.push(s);
  }
  // a baforada saindo pela grade em cima do gato
  const outPuffs = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(puffMat.clone());
    s.visible = false;
    grp.add(s);
    outPuffs.push(s);
  }
  const S = { outT: -1 };
  return {
    group: grp,
    pointAt,
    outletGrille,
    setDamper(on) { damper.open = !!on; },
    /** @param {number[]} list */
    setPuffs(list) {
      puffs.forEach((s, i) => {
        const u = list[i];
        s.visible = u != null;
        if (u == null) return;
        pointAt(u, s.position);
        s.position.z += R + 0.02;
        s.material.opacity = 0.55 + 0.35 * Math.sin(u * 30);
      });
    },
    outletPuff() { S.outT = 0; },
    update(dt) {
      damper.k += ((damper.open ? 1 : 0) - damper.k) * (1 - Math.exp(-dt * 5));
      for (const [i, s] of louvers.entries()) s.rotation.x = 1.5 - 1.3 * Math.min(1, Math.max(0, damper.k * 1.25 - i * 0.025));
      lampMat.emissive.copy(RED).lerp(GREEN, damper.k);
      lampMat.color.setRGB(0.35 * (1 - damper.k) + 0.2, 0.15 + 0.3 * damper.k, 0.13);
      if (S.outT < 0) return;
      S.outT += dt;
      const u = S.outT / 1.2;
      outPuffs.forEach((s, i) => {
        const k = u - i * 0.06;
        s.visible = k > 0 && k < 1;
        if (!s.visible) return;
        s.position.set(DUCT.outlet.x + Math.sin(i * 2.3) * 0.08 * k, outletY - 0.12 - k * 0.42, B.minZ + 0.16 + k * 0.18);
        s.scale.setScalar(0.18 + k * 0.4);
        s.material.opacity = (1 - k) * 0.8;
      });
      if (u > 1.4) { S.outT = -1; for (const s of outPuffs) s.visible = false; }
    },
  };
}

/** Plaquinha oval com a patinha (em cima da portinha de gato). */
function pawPlaqueTexture() {
  return canvasTexture(96, 96, (g, w, h) => {
    g.fillStyle = '#f3e6c8'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#6b4630'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 5, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#6b4630';
    g.beginPath(); g.ellipse(w / 2, h / 2 + 12, 17, 14, 0, 0, Math.PI * 2); g.fill();
    for (const [dx, dy] of [[-21, -6], [-8, -20], [8, -20], [21, -6]]) { g.beginPath(); g.ellipse(w / 2 + dx, h / 2 + dy, 7, 9, dx * 0.02, 0, Math.PI * 2); g.fill(); }
  }, { repeat: false });
}
/** Capacho de fibra com borda e uma patinha. */
function doormatTexture() {
  return canvasTexture(96, 128, (g, w, h) => {
    g.fillStyle = '#8a6a3c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${60 + (i % 40)},${40 + (i % 30)},20,0.25)`; g.fillRect((i * 37) % w, (i * 53) % h, 2, 3); }
    g.strokeStyle = '#4a3420'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#4a3420';
    g.beginPath(); g.ellipse(w / 2, h / 2 + 10, 14, 12, 0, 0, Math.PI * 2); g.fill();
    for (const [dx, dy] of [[-17, -5], [-6, -17], [6, -17], [17, -5]]) { g.beginPath(); g.ellipse(w / 2 + dx, h / 2 + dy, 6, 7, 0, 0, Math.PI * 2); g.fill(); }
  }, { repeat: false });
}

export function buildRoom(layout) {
  const updaters = [];
  const floors = buildFloors(layout);
  const walls = buildWalls(layout, updaters);
  const duct = buildDuct(layout);
  const group = new THREE.Group();
  group.name = 'casa-do-vovo';
  group.add(floors, walls.group, duct.group);
  return {
    group, walls: walls.group, duct, flapPivot: walls.flapPivot, setFlapSwing: walls.setFlapSwing,
    update: (dt, t) => { for (const f of updaters) f(dt, t); duct.update(dt); },
  };
}
