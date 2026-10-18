// Expresso do Superbafo · a oficina de brinquedos em corte de maquete (mesma linguagem da casa da fase 5):
// laje com o corte escuro à mostra, assoalho de tábuas largas, parede do fundo inteira com lambri, duas
// janelas de fim de tarde ensolarado, painel de ferramentas, placa "OFICINA DAS IRMÃS" e bandeirinhas;
// paredes laterais cortadas a meia altura com mural de desenhos. Móveis encostados nas paredes (colisão em
// ../layout.js): bancada com torno, trenzinho em construção e luminária; baú de brinquedos aberto com o
// ursinho; estante de nichos com globo; armário baixo com latas de tinta; caixotes de blocos; planta e
// luminária de pé. Tudo procedural; as luzes quentes não fazem sombra.
import * as THREE from 'three';
import { rng, rbox, canvasTexture, plasterMat, stdMat, woodMat, mergeGeometries, paint, potProfile, shadowAll } from '../../../world/util.js';
import { createRubberDuck, createTeddyBear } from '../../../world/toys.js';
import { BENCH, TOY_CHEST, TOY_SHELF, LOW_CABINET, BLOCK_CRATES, PLANT, FLOOR_LAMP, RAG_RUG, TOY_PILE } from '../layout.js';

const TAU = Math.PI * 2;
const POCHE = '#4a3426';
const H = 2.7; // parede do fundo
const C = 1.05; // corte das laterais
const ZN = -4.0; // face interna da parede do fundo
const XW = 5.5; // faces internas das laterais

/** @param {THREE.Object3D} parent @param {THREE.BufferGeometry} geo @param {THREE.Material} mat @param {number} [x] @param {number} [y] @param {number} [z] */
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const overlay = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

// ------------------------------------------------------------------ texturas
/** Tábuas largas de pinho (20 cm), emendas desencontradas e nós; repetição de 1,2 m. */
function plankTexture() {
  const S = 512, rows = 6, rh = S / rows;
  return canvasTexture(S, S, (g) => {
    const r = rng(23);
    for (let j = 0; j < rows; j++) {
      let x = -r() * S * 0.5;
      while (x < S) {
        const len = S * (0.45 + r() * 0.5);
        const tone = 0.86 + r() * 0.22;
        g.fillStyle = `rgb(${(196 * tone) | 0},${(146 * tone) | 0},${(96 * tone) | 0})`;
        for (const ox of [0, S]) g.fillRect(x - ox, j * rh, len, rh);
        for (let i = 0; i < 9; i++) {
          g.strokeStyle = `rgba(110,66,34,${0.05 + r() * 0.08})`;
          g.lineWidth = 0.8 + r() * 1.2;
          const yy = j * rh + 3 + r() * (rh - 6);
          g.beginPath();
          g.moveTo(x, yy);
          g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 6, x + len * 0.7, yy + (r() - 0.5) * 6, x + len, yy);
          g.stroke();
        }
        if (r() < 0.45) {
          const kx = x + r() * len, ky = j * rh + rh * (0.3 + r() * 0.4);
          const grd = g.createRadialGradient(kx, ky, 0, kx, ky, 9);
          grd.addColorStop(0, 'rgba(100,58,30,0.5)'); grd.addColorStop(1, 'rgba(100,58,30,0)');
          g.fillStyle = grd; g.fillRect(kx - 10, ky - 10, 20, 20);
        }
        g.fillStyle = 'rgba(80,46,24,0.55)';
        g.fillRect(x, j * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(80,46,24,0.5)';
      g.fillRect(0, j * rh, S, 2);
      g.fillStyle = 'rgba(255,236,200,0.07)';
      g.fillRect(0, j * rh + 3, S, 3);
    }
  });
}
/** Lambri de réguas verticais verde-sálvia (repetição de 0,6 m). */
function beadboardTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    const n = 6, bw = w / n;
    for (let i = 0; i < n; i++) {
      const grd = g.createLinearGradient(i * bw, 0, (i + 1) * bw, 0);
      grd.addColorStop(0, '#93ad91'); grd.addColorStop(0.15, '#a4bea2'); grd.addColorStop(1, '#9ab598');
      g.fillStyle = grd; g.fillRect(i * bw, 0, bw, h);
      g.fillStyle = 'rgba(50,70,50,0.35)'; g.fillRect(i * bw, 0, 2, h);
    }
  });
}
/** Painel perfurado de ferramentas. */
function pegboardTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#d8b88c'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,46,26,0.55)';
    for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); }
  });
}
/** Vista da janela: jardim ensolarado de fim de tarde, levemente desfocado. */
function windowViewTexture(seed) {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(seed);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#8fb9de'); sky.addColorStop(0.5, '#cfe0ea'); sky.addColorStop(0.62, '#f6dcb2'); sky.addColorStop(0.63, '#8db36a'); sky.addColorStop(1, '#6f9a54');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.filter = 'blur(5px)';
    const sun = g.createRadialGradient(w * 0.75, h * 0.32, 0, w * 0.75, h * 0.32, 70);
    sun.addColorStop(0, 'rgba(255,244,214,0.95)'); sun.addColorStop(1, 'rgba(255,244,214,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(${70 + r() * 30},${110 + r() * 30},${60 + r() * 20},0.95)`;
      g.beginPath(); g.ellipse(r() * w, h * (0.55 + r() * 0.06), 30 + r() * 30, 34 + r() * 26, 0, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(240,226,200,0.85)';
    g.fillRect(0, h * 0.7, w, h * 0.05);
    g.filter = 'none';
  }, { repeat: false });
}
/** Placa pintada da oficina, com patinhas. */
function signTexture() {
  return canvasTexture(1024, 180, (g, w, h) => {
    g.fillStyle = '#e9cfa1'; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 36); g.fill();
    g.strokeStyle = '#a76d46'; g.lineWidth = 10; g.beginPath(); g.roundRect(18, 18, w - 36, h - 36, 26); g.stroke();
    g.font = '700 92px "Fredoka", "Comic Sans MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#4f8f8b'; g.fillText('OFICINA DAS IRMÃS', w / 2, h / 2 + 6);
    const paw = (x, y, s) => {
      g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#c8553d';
      g.beginPath(); g.ellipse(0, 8, 15, 12, 0, 0, TAU); g.fill();
      for (const [dx, dy] of [[-15, -9], [-5, -17], [5, -17], [15, -9]]) { g.beginPath(); g.ellipse(dx, dy, 5, 7, 0, 0, TAU); g.fill(); }
      g.restore();
    };
    paw(70, h / 2, 1.5);
    paw(w - 70, h / 2, 1.5);
  }, { repeat: false });
}
/** Desenhos de criança presos no mural: as duas cachorrinhas, o foguete e o trem com o planeta. */
function drawingTexture(kind) {
  return canvasTexture(192, 144, (g, w, h) => {
    g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, w, h);
    g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 'dogs') {
      g.fillStyle = '#f6e7c8'; g.strokeStyle = '#9a7a52';
      g.beginPath(); g.ellipse(62, 92, 34, 20, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.arc(36, 70, 18, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.strokeStyle = '#8a8a8a';
      g.beginPath(); g.ellipse(134, 88, 38, 24, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.arc(166, 62, 20, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#e2493b';
      for (const [x, y] of [[100, 40], [112, 30], [124, 40]]) { g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); }
      g.beginPath(); g.moveTo(93, 42); g.lineTo(112, 62); g.lineTo(131, 42); g.fill();
    } else if (kind === 'rocket') {
      g.fillStyle = '#2f4a6a'; g.fillRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#f6e6b8'; for (const [x, y] of [[30, 30], [160, 40], [150, 110], [40, 116]]) { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }
      g.fillStyle = '#f3e6cc'; g.beginPath(); g.moveTo(96, 22); g.quadraticCurveTo(124, 60, 112, 112); g.lineTo(80, 112); g.quadraticCurveTo(68, 60, 96, 22); g.fill();
      g.fillStyle = '#c8553d'; g.beginPath(); g.moveTo(80, 100); g.lineTo(62, 124); g.lineTo(82, 116); g.fill(); g.beginPath(); g.moveTo(112, 100); g.lineTo(130, 124); g.lineTo(110, 116); g.fill();
      g.fillStyle = '#f2c766'; g.beginPath(); g.arc(96, 124, 10, 0, TAU); g.fill();
    } else {
      g.strokeStyle = '#7a4a2c'; g.beginPath(); g.moveTo(10, 112); g.lineTo(182, 112); g.stroke();
      g.fillStyle = '#4f8f8b'; g.fillRect(40, 66, 64, 34); g.fillStyle = '#c8553d'; g.fillRect(100, 52, 34, 48);
      g.fillStyle = '#e0a84a'; g.fillRect(140, 74, 40, 26);
      g.fillStyle = '#2f2724'; for (const x of [54, 90, 118, 154, 170]) { g.beginPath(); g.arc(x, 104, 8, 0, TAU); g.fill(); }
      g.fillStyle = '#5e9fb8'; g.beginPath(); g.arc(160, 62, 14, 0, TAU); g.fill();
      g.fillStyle = '#e2493b'; g.beginPath(); g.arc(34, 84, 7, 0, TAU); g.fill();
      g.fillStyle = 'rgba(200,200,200,0.8)'; for (const [x, y, r] of [[60, 50, 9], [74, 40, 11], [92, 30, 13]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    }
  }, { repeat: false });
}
function corkTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(8);
    g.fillStyle = '#c49a6c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,80,44' : '230,200,160'},${0.15 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  });
}
/** Globo da estante: oceano com continentes arredondados. */
function globeTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    const r = rng(41);
    g.fillStyle = '#5e9fb8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9c37a';
    for (let i = 0; i < 7; i++) {
      const x = r() * w, y = h * (0.25 + r() * 0.5), rx = 14 + r() * 22, ry = 10 + r() * 16;
      g.beginPath(); g.ellipse(x, y, rx, ry, r() * 3, 0, TAU); g.fill();
      g.fillStyle = i % 2 ? '#d9c37a' : '#a7c56a';
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
    for (let y = 16; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, { repeat: false });
}
/** Tapete de retalhos trançado: anéis de cores alternadas, com o tecido riscado. */
function ragRugTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(53);
    const colors = ['#c8553d', '#e8d6b0', '#4f8f8b', '#e0a84a', '#7ca8b2', '#e8d6b0'];
    for (let i = 0; i < 12; i++) {
      g.fillStyle = colors[i % colors.length];
      g.beginPath(); g.arc(w / 2, h / 2, w / 2 - i * 10.5, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(60,40,24,0.18)'; g.lineWidth = 1.5;
    for (let i = 0; i < 160; i++) {
      const a = r() * TAU, rad = 8 + r() * 118;
      g.beginPath(); g.arc(w / 2, h / 2, rad, a, a + 0.12); g.stroke();
    }
  }, { repeat: false });
}
function checkTexture(a, b) {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 16, y * 16, 16, 16);
  });
}

// ------------------------------------------------------------------ peças
/** Parede (caixa) com a faixa escura do corte no topo. */
function cutWall(grp, x, z, w, d, h, wallMat, poche = true) {
  const m = add(grp, rbox(w, h, d, 0.012), wallMat, x, h / 2, z);
  if (poche) add(grp, new THREE.BoxGeometry(w + 0.004, 0.02, d + 0.004), stdMat(POCHE, { roughness: 0.95 }), x, h + 0.01, z);
  return m;
}
/** Caixote de ripas (aberto em cima) cheio de blocos coloridos. */
function blockCrate(w, h, d, seed) {
  const g = new THREE.Group();
  const slat = woodMat('#c79a64', { key: 'expresso-caixote', rough: 0.8 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      add(g, rbox(w, h * 0.26, 0.02, 0.006), slat, 0, h * (0.17 + i * 0.32), s * (d / 2 - 0.01));
      add(g, rbox(0.02, h * 0.26, d - 0.04, 0.006), slat, s * (w / 2 - 0.01), h * (0.17 + i * 0.32), 0);
    }
  }
  add(g, rbox(w - 0.04, 0.02, d - 0.04, 0.005), slat, 0, 0.012, 0);
  const r = rng(seed);
  const blocks = [];
  const colors = ['#c8553d', '#e0a84a', '#4f8f8b', '#f3e6cc', '#7ca8b2'];
  for (let i = 0; i < 14; i++) {
    const s = 0.07 + r() * 0.03;
    const b = new THREE.BoxGeometry(s, s, s).rotateY(r() * 1.5).rotateX((r() - 0.5) * 0.5)
      .translate((r() - 0.5) * (w - 0.14), h * 0.72 + r() * 0.08, (r() - 0.5) * (d - 0.14));
    blocks.push(paint(b, colors[i % colors.length]));
  }
  add(g, mergeGeometries(blocks), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  return g;
}

// ================================================================== construção
export function buildWorkshop(root) {
  const grp = new THREE.Group();
  grp.name = 'oficina';
  root.add(grp);
  const lights = [];
  const addLight = (x, y, z, color, intensity, dist, decay = 1.6) => {
    const l = new THREE.PointLight(color, intensity, dist, decay);
    l.position.set(x, y, z);
    root.add(l);
    lights.push(l);
    return l;
  };

  // ---- laje (corte escuro à mostra) e assoalho
  add(grp, new THREE.BoxGeometry(11.6, 0.32, 8.4), stdMat(POCHE, { roughness: 0.95 }), 0, -0.161, -0.1);
  const planks = plankTexture();
  planks.repeat.set(11 / 1.2, 8 / 1.2);
  const floor = add(grp, new THREE.PlaneGeometry(11, 8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.6 }), 0, 0.001, 0);
  floor.receiveShadow = true;
  // manchas de sol entrando pelas janelas (decalques somados, sem sombra)
  const sunMat = new THREE.MeshBasicMaterial({ color: '#ffe7b8', transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, ...overlay });
  for (const x of [-3.6, 3.6]) {
    const sh = new THREE.Shape();
    sh.moveTo(-0.7, 0); sh.lineTo(0.7, 0); sh.lineTo(0.95, 1.25); sh.lineTo(-0.45, 1.25); sh.closePath();
    const patch = add(grp, new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), sunMat, x, 0.004, ZN + 0.12);
    patch.renderOrder = 1;
    patch.userData.noShadow = true;
  }

  // ---- parede do fundo com duas janelas, lambri, rodapé e cimalha
  const walls = new THREE.Group();
  walls.name = 'paredes-oficina';
  grp.add(walls);
  const wallMat = plasterMat('#eedac0');
  const zW = ZN - 0.1;
  const wins = [{ cx: -3.6, w: 1.4, sill: 0.95, h: 1.15 }, { cx: 3.6, w: 1.4, sill: 0.95, h: 1.15 }];
  let cur = -XW - 0.2;
  const frameMat = stdMat('#f7f1e4', { roughness: 0.5 });
  const sillMat = stdMat('#e9dfcd', { roughness: 0.6 });
  const curtainTex = checkTexture('#f2dfb2', '#e7c37a');
  const curtainMat = new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 1, side: THREE.DoubleSide });
  wins.forEach((wi, i) => {
    const a = wi.cx - wi.w / 2, b = wi.cx + wi.w / 2;
    cutWall(walls, (cur + a) / 2, zW, a - cur, 0.2, H, wallMat);
    cutWall(walls, wi.cx, zW, wi.w, 0.2, wi.sill, wallMat, false);
    const top = H - (wi.sill + wi.h);
    add(walls, rbox(wi.w, top, 0.2, 0.012), wallMat, wi.cx, wi.sill + wi.h + top / 2, zW);
    add(walls, new THREE.BoxGeometry(wi.w + 0.004, 0.02, 0.204), stdMat(POCHE, { roughness: 0.95 }), wi.cx, H + 0.01, zW);
    add(walls, new THREE.PlaneGeometry(wi.w, wi.h), new THREE.MeshBasicMaterial({ map: windowViewTexture(30 + i), fog: false }), wi.cx, wi.sill + wi.h / 2, zW - 0.04)
      .userData.noShadow = true;
    const t = 0.055;
    /** @type {[number, number, number, number][]} */
    const bars = [[wi.w + 0.1, t, wi.cx, wi.sill + wi.h], [wi.w + 0.1, t, wi.cx, wi.sill], [t, wi.h, a, wi.sill + wi.h / 2], [t, wi.h, b, wi.sill + wi.h / 2],
      [t * 0.6, wi.h, wi.cx, wi.sill + wi.h / 2], [wi.w, t * 0.6, wi.cx, wi.sill + wi.h * 0.55]];
    for (const [w, h, x, y] of bars) add(walls, rbox(w, h, 0.07, 0.01), frameMat, x, y, ZN + 0.005);
    add(walls, rbox(wi.w + 0.22, 0.04, 0.2, 0.01), sillMat, wi.cx, wi.sill - 0.008, ZN + 0.08);
    const sillTop = wi.sill - 0.008 + 0.02;
    // cortininhas xadrez (acima do peitoril) e o varão
    for (const s of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(0.36, 1.2, 10, 1);
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(p.getX(k) * 36) * 0.022);
      geo.computeVertexNormals();
      add(walls, geo, curtainMat, wi.cx + s * (wi.w / 2 + 0.12), wi.sill + wi.h - 0.45, ZN + 0.12);
    }
    add(walls, new THREE.CylinderGeometry(0.012, 0.012, wi.w + 0.6, 8).rotateZ(Math.PI / 2), stdMat('#7a4a2c', { roughness: 0.5 }), wi.cx, wi.sill + wi.h + 0.12, ZN + 0.12);
    // vasinhos de suculenta no peitoril
    for (const dx of [-0.4, 0.35]) {
      add(walls, new THREE.CylinderGeometry(0.055, 0.045, 0.09, 14), stdMat(i ? '#c8553d' : '#4f8f8b', { roughness: 0.6 }), wi.cx + dx, sillTop + 0.045, ZN + 0.1);
      const leaf = add(walls, new THREE.SphereGeometry(0.055, 10, 8), stdMat('#7aa857', { roughness: 0.9 }), wi.cx + dx, sillTop + 0.11, ZN + 0.1);
      leaf.scale.y = 0.75;
    }
    cur = b;
  });
  cutWall(walls, (cur + XW + 0.2) / 2, zW, XW + 0.2 - cur, 0.2, H, wallMat);
  // lambri até 0,9 m, cimalha e rodapé (passam por baixo das janelas)
  const bead = beadboardTexture();
  bead.repeat.set((XW * 2) / 0.6, 1);
  add(walls, new THREE.BoxGeometry(XW * 2, 0.9, 0.02), new THREE.MeshStandardMaterial({ map: bead, roughness: 0.75 }), 0, 0.45, ZN + 0.01);
  const trim = stdMat('#f3ead9', { roughness: 0.6 });
  add(walls, rbox(XW * 2, 0.04, 0.045, 0.01), trim, 0, 0.9, ZN + 0.0225);
  add(walls, rbox(XW * 2, 0.1, 0.03, 0.008), trim, 0, 0.05, ZN + 0.035);

  // ---- laterais cortadas, com rodapé; mural de cortiça com desenhos na parede oeste
  for (const s of [-1, 1]) {
    cutWall(walls, s * (XW + 0.1), 0, 0.2, 8.0, C, wallMat);
    add(walls, rbox(0.03, 0.1, 7.96, 0.008), trim, s * (XW - 0.015), 0.05, 0.02);
  }
  // mural: moldura rente à parede, cortiça 1 cm à frente, desenhos 3 mm à frente da cortiça
  add(walls, rbox(0.025, 0.54, 1.19, 0.008), stdMat('#8a5a3a', { roughness: 0.7 }), -XW + 0.0125, 0.7, 0.3);
  add(walls, rbox(0.03, 0.5, 1.15, 0.008), new THREE.MeshStandardMaterial({ map: corkTexture(), roughness: 0.95 }), -XW + 0.02, 0.7, 0.3);
  /** @type {[string, number, number, number][]} */
  const drawings = [['dogs', 0.0, 0.73, -0.05], ['rocket', 0.38, 0.7, 0.08], ['train', 0.76, 0.74, -0.06]];
  for (const [kind, dz, y, rot] of drawings) {
    const d = add(walls, new THREE.PlaneGeometry(0.32, 0.24), new THREE.MeshStandardMaterial({ map: drawingTexture(kind), roughness: 0.9 }), -XW + 0.038, y, 0.3 - 0.38 + dz);
    d.rotation.set(0, Math.PI / 2, rot);
    add(walls, new THREE.SphereGeometry(0.012, 8, 6), stdMat('#e2493b', { roughness: 0.4 }), -XW + 0.045, y + 0.1, 0.3 - 0.38 + dz);
  }

  // ---- painel de ferramentas, placa da oficina e bandeirinhas (entre as janelas)
  const peg = pegboardTexture();
  peg.repeat.set(2.2 / 0.5, 0.9 / 0.25);
  add(walls, rbox(2.2, 0.9, 0.02, 0.006), new THREE.MeshStandardMaterial({ map: peg, roughness: 0.85 }), 0, 1.45, ZN + 0.01);
  add(walls, rbox(2.26, 0.96, 0.016, 0.006), stdMat('#9a6a42', { roughness: 0.7 }), 0, 1.45, ZN + 0.008);
  const tools = new THREE.Group();
  tools.position.z = ZN + 0.045;
  walls.add(tools);
  const handleMat = woodMat('#a8743e', { key: 'expresso-cabo', rough: 0.6 });
  const steel = stdMat('#8f969a', { roughness: 0.35, metalness: 0.7 });
  // martelo, serrote, chave inglesa, chave de fenda, tesoura, rolo de fita e carretel
  add(tools, rbox(0.035, 0.32, 0.03, 0.01), handleMat, -0.85, 1.5, 0);
  add(tools, rbox(0.16, 0.05, 0.04, 0.01), steel, -0.85, 1.68, 0);
  const saw = new THREE.Shape();
  saw.moveTo(0, 0); saw.lineTo(0.42, 0.02); saw.lineTo(0.42, 0.1); saw.lineTo(0, 0.13); saw.closePath();
  add(tools, new THREE.ShapeGeometry(saw), stdMat('#b8bec2', { roughness: 0.3, metalness: 0.75, side: THREE.DoubleSide }), -0.55, 1.62, 0).rotation.z = -Math.PI / 2;
  add(tools, rbox(0.1, 0.13, 0.035, 0.03), handleMat, -0.49, 1.68, 0);
  add(tools, rbox(0.03, 0.28, 0.016, 0.008), steel, -0.18, 1.52, 0);
  const jaw = add(tools, new THREE.TorusGeometry(0.04, 0.014, 6, 12, Math.PI * 1.4), steel, -0.18, 1.69, 0);
  jaw.rotation.z = -0.55;
  add(tools, new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), stdMat('#e0a84a', { roughness: 0.4 }), 0.1, 1.66, 0);
  add(tools, new THREE.CylinderGeometry(0.005, 0.005, 0.16, 6), steel, 0.1, 1.52, 0);
  for (const s of [-1, 1]) {
    const loop = add(tools, new THREE.TorusGeometry(0.03, 0.009, 6, 14), stdMat('#c8553d', { roughness: 0.4 }), 0.38 + s * 0.035, 1.66, 0);
    loop.rotation.z = s * 0.3;
    const blade = add(tools, rbox(0.012, 0.16, 0.006, 0.003), steel, 0.38 + s * 0.012, 1.55, 0.004 * s);
    blade.rotation.z = -s * 0.12;
  }
  const tape = add(tools, new THREE.TorusGeometry(0.05, 0.025, 8, 20), stdMat('#e8d9b4', { roughness: 0.8 }), 0.66, 1.62, 0);
  tape.scale.z = 0.8;
  // carretel 2 cm para a frente: a aba de trás fica 7 mm à frente do painel (sem plano em comum)
  const spool = add(tools, new THREE.CylinderGeometry(0.045, 0.045, 0.06, 14), stdMat('#c8553d', { roughness: 0.9 }), 0.88, 1.6, 0.02);
  spool.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const flange = add(tools, new THREE.CylinderGeometry(0.058, 0.058, 0.008, 14), handleMat, 0.88, 1.6, 0.02 + s * 0.034);
    flange.rotation.x = Math.PI / 2;
  }
  // rodas de trenzinho penduradas num pino
  for (let i = 0; i < 3; i++) {
    const w = add(tools, new THREE.CylinderGeometry(0.05, 0.05, 0.025, 16), stdMat('#b9473a', { roughness: 0.5 }), -0.25 + i * 0.12, 1.3, 0.004 * i);
    w.rotation.x = Math.PI / 2;
  }
  add(walls, rbox(2.5, 0.44, 0.024, 0.02), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.8 }), 0, 2.15, ZN + 0.012);
  // bandeirinhas: barbante preso em cinco pregos, caindo entre eles, e triângulos coloridos (uma malha só)
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    pts.push(new THREE.Vector3(-5.3 + 10.6 * k, 2.64 - Math.sin(Math.PI * ((k * 4) % 1)) * 0.07, ZN + 0.06));
  }
  const string = new THREE.CatmullRomCurve3(pts);
  add(walls, new THREE.TubeGeometry(string, 120, 0.005, 4, false), stdMat('#7a5a3a', { roughness: 0.9 })).userData.noShadow = true;
  const flags = [];
  const flagColors = ['#c8553d', '#e0a84a', '#4f8f8b', '#f3e6cc'];
  for (let i = 0; i < 36; i++) {
    const p = string.getPointAt((i + 0.5) / 36);
    const tri = new THREE.Shape();
    tri.moveTo(-0.09, 0); tri.lineTo(0.09, 0); tri.lineTo(0, -0.17); tri.closePath();
    flags.push(paint(new THREE.ShapeGeometry(tri).translate(p.x, p.y, p.z + 0.002 + (i % 2) * 0.003), flagColors[i % 4]));
  }
  const flagMesh = add(walls, mergeGeometries(flags), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  flagMesh.userData.noShadow = true;

  // ---- armário baixo sob o painel, com latas de tinta, potes de pincel e um robozinho
  const cab = new THREE.Group();
  cab.position.set(LOW_CABINET.x, 0, LOW_CABINET.z + 0.01);
  grp.add(cab);
  const cabW = LOW_CABINET.hx * 2, cabD = LOW_CABINET.hz * 2 - 0.02, cabH = LOW_CABINET.height;
  add(cab, rbox(cabW, cabH - 0.04, cabD, 0.015), stdMat('#f0e4cc', { roughness: 0.65 }), 0, (cabH - 0.04) / 2, 0);
  add(cab, rbox(cabW + 0.04, 0.04, cabD + 0.03, 0.01), woodMat('#c6935e', { key: 'expresso-tampo', rough: 0.55 }), 0, cabH - 0.02, 0.005);
  const doorMat = stdMat('#4f8f8b', { roughness: 0.55 });
  for (let i = 0; i < 4; i++) {
    const x = -cabW / 2 + cabW * (i + 0.5) / 4;
    add(cab, rbox(cabW / 4 - 0.05, cabH - 0.14, 0.012, 0.008), doorMat, x, (cabH - 0.04) / 2, cabD / 2 + 0.004);
    add(cab, new THREE.SphereGeometry(0.018, 10, 8), stdMat('#e0a84a', { roughness: 0.4 }), x + (i % 2 ? -1 : 1) * (cabW / 8 - 0.07), (cabH - 0.04) / 2, cabD / 2 + 0.02);
  }
  const canColors = ['#c8553d', '#4f8f8b', '#e0a84a', '#7ca8b2'];
  canColors.forEach((c, i) => {
    const x = -1.3 + i * 0.22;
    add(cab, new THREE.CylinderGeometry(0.075, 0.075, 0.15, 18), stdMat('#c9ccce', { roughness: 0.35, metalness: 0.6 }), x, cabH + 0.075, 0);
    add(cab, new THREE.CylinderGeometry(0.077, 0.077, 0.04, 18), stdMat(c, { roughness: 0.5 }), x, cabH + 0.1, 0);
    add(cab, new THREE.CylinderGeometry(0.068, 0.068, 0.006, 18), stdMat(c, { roughness: 0.3 }), x, cabH + 0.153, 0);
  });
  // pote com pincéis
  add(cab, new THREE.CylinderGeometry(0.06, 0.055, 0.14, 16), stdMat('#e9dfcd', { roughness: 0.4 }), 0.2, cabH + 0.07, 0);
  const r = rng(29);
  for (let i = 0; i < 5; i++) {
    const br = add(cab, new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6), handleMat, 0.2 + (r() - 0.5) * 0.06, cabH + 0.18, (r() - 0.5) * 0.06);
    br.rotation.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
    add(br, new THREE.ConeGeometry(0.012, 0.04, 6), stdMat(canColors[i % 4], { roughness: 0.6 }), 0, 0.15, 0);
  }
  // robozinho de lata
  const robot = new THREE.Group();
  robot.position.set(0.62, cabH, 0);
  robot.rotation.y = -0.4;
  cab.add(robot);
  add(robot, rbox(0.14, 0.16, 0.1, 0.02), stdMat('#7ca8b2', { roughness: 0.35, metalness: 0.5 }), 0, 0.12, 0);
  add(robot, rbox(0.1, 0.09, 0.09, 0.02), stdMat('#9fbfc6', { roughness: 0.35, metalness: 0.5 }), 0, 0.25, 0);
  for (const s of [-1, 1]) {
    add(robot, new THREE.SphereGeometry(0.014, 8, 6), stdMat('#f2c766', { emissive: '#f2c766', emissiveIntensity: 0.4 }), s * 0.025, 0.26, 0.046);
    add(robot, rbox(0.035, 0.05, 0.05, 0.01), stdMat('#5f8a92', { roughness: 0.4, metalness: 0.5 }), s * 0.04, 0.025, 0);
  }
  add(robot, new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), steel, 0, 0.32, 0);
  add(robot, new THREE.SphereGeometry(0.012, 8, 6), stdMat('#c8553d'), 0, 0.355, 0);
  // pilha de blocos de letras: dois lado a lado e um em cima
  /** @type {[number, number, number, string][]} */
  const letterBlocks = [[1.08, 0.05, 0, '#e0a84a'], [1.2, 0.05, 0.01, '#c8553d'], [1.14, 0.15, 0.2, '#f3e6cc']];
  for (const [x, y, rot, c] of letterBlocks) add(cab, rbox(0.1, 0.1, 0.1, 0.012), stdMat(c, { roughness: 0.6 }), x, cabH + y, 0).rotation.y = rot;

  // ---- caixotes de blocos (sob a janela leste)
  const crates = new THREE.Group();
  crates.position.set(BLOCK_CRATES.x, 0, BLOCK_CRATES.z);
  grp.add(crates);
  const crateA = blockCrate(0.52, BLOCK_CRATES.height, 0.38, 3);
  crateA.position.x = -0.27;
  const crateB = blockCrate(0.5, BLOCK_CRATES.height - 0.06, 0.36, 9);
  crateB.position.x = 0.27;
  crateB.rotation.y = 0.06;
  crates.add(crateA, crateB);

  // ---- bancada (parede leste)
  const bench = new THREE.Group();
  bench.position.set(BENCH.x, 0, BENCH.z);
  grp.add(bench);
  const butcher = woodMat('#d8a970', { key: 'expresso-bancada', rough: 0.55 });
  const frame = woodMat('#8a5a3a', { key: 'expresso-estrutura', rough: 0.7 });
  const bw = BENCH.hx * 2, bd = BENCH.hz * 2, bh = BENCH.height;
  add(bench, rbox(bw, 0.07, bd, 0.015), butcher, 0, bh - 0.035, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(bench, rbox(0.07, bh - 0.07, 0.07, 0.01), frame, sx * (bw / 2 - 0.06), (bh - 0.07) / 2, sz * (bd / 2 - 0.06));
  for (const sx of [-1, 1]) add(bench, rbox(0.04, 0.06, bd - 0.16, 0.01), frame, sx * (bw / 2 - 0.06), 0.25, 0);
  add(bench, rbox(bw - 0.1, 0.03, bd - 0.1, 0.008), frame, 0, 0.19, 0);
  // caixa de ferramentas vermelha e latas na prateleira de baixo
  add(bench, rbox(0.42, 0.18, 0.26, 0.02), stdMat('#c8553d', { roughness: 0.45, metalness: 0.2 }), -0.02, 0.295, 0.45);
  add(bench, rbox(0.3, 0.025, 0.04, 0.01), steel, -0.02, 0.4, 0.45);
  /** @type {[number, string][]} */
  const benchCans = [[-0.3, '#4f8f8b'], [-0.55, '#e0a84a']];
  for (const [dz, c] of benchCans) add(bench, new THREE.CylinderGeometry(0.08, 0.08, 0.17, 16), stdMat(c, { roughness: 0.5 }), 0.05, 0.29, dz);
  // em cima: torno, trenzinho em construção, rodinhas soltas, potes de tinta, pincel, régua e lascas
  const top = bh;
  add(bench, rbox(0.14, 0.09, 0.16, 0.012), stdMat('#4f6f73', { roughness: 0.4, metalness: 0.5 }), -0.3, top + 0.045, 0.82);
  add(bench, rbox(0.14, 0.07, 0.04, 0.008), stdMat('#5c7f84', { roughness: 0.4, metalness: 0.5 }), -0.3, top + 0.12, 0.76);
  add(bench, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6).rotateX(Math.PI / 2), steel, -0.3, top + 0.12, 0.9);
  const toy = new THREE.Group();
  toy.position.set(-0.08, top, 0.15);
  toy.rotation.y = 0.35;
  bench.add(toy);
  add(toy, rbox(0.14, 0.07, 0.28, 0.012), woodMat('#e6c79a', { key: 'expresso-brinquedo', rough: 0.6 }), 0, 0.07, 0);
  const tb = add(toy, new THREE.CylinderGeometry(0.05, 0.05, 0.14, 16), stdMat('#4f8f8b', { roughness: 0.55 }), 0, 0.15, 0.04);
  tb.rotation.x = Math.PI / 2;
  add(toy, rbox(0.12, 0.12, 0.08, 0.012), woodMat('#e6c79a', { key: 'expresso-brinquedo', rough: 0.6 }), 0, 0.16, -0.09);
  for (const z of [-0.08, 0.08]) for (const s of [-1, 1]) {
    const w = add(toy, new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14), stdMat('#b9473a', { roughness: 0.5 }), s * 0.08, 0.035, z);
    w.rotation.z = Math.PI / 2;
  }
  for (const [x, z] of [[0.12, -0.15], [0.2, -0.05]]) {
    const w = add(bench, new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14), stdMat('#b9473a', { roughness: 0.5 }), x, top + 0.01, z);
    w.rotation.x = 0;
  }
  canColors.slice(0, 3).forEach((c, i) => {
    add(bench, new THREE.CylinderGeometry(0.04, 0.04, 0.06, 14), stdMat('#f1ece2', { roughness: 0.4 }), 0.22, top + 0.03, -0.45 - i * 0.1);
    add(bench, new THREE.CylinderGeometry(0.034, 0.034, 0.004, 14), stdMat(c, { roughness: 0.25 }), 0.22, top + 0.0605, -0.45 - i * 0.1); // tinta 2,5 mm acima da borda
  });
  const brush = add(bench, new THREE.CylinderGeometry(0.007, 0.007, 0.2, 6), handleMat, 0.05, top + 0.01, -0.62);
  brush.rotation.set(Math.PI / 2, 0, 0.6);
  add(bench, rbox(0.035, 0.006, 0.5, 0.002), stdMat('#e0a84a', { roughness: 0.5 }), 0.3, top + 0.003, 0.45);
  const shavingMat = stdMat('#efd3a4', { roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const sv = add(bench, new THREE.TorusGeometry(0.02 + r() * 0.012, 0.004, 4, 10, Math.PI * (1.2 + r() * 0.6)), shavingMat, -0.15 + r() * 0.3, top + 0.012, 0.3 + r() * 0.45);
    sv.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.6, r() * TAU, 0);
  }
  // luminária articulada de bancada (luz quente)
  const lamp = new THREE.Group();
  lamp.position.set(0.18, top, -0.78);
  bench.add(lamp);
  const lampMat = stdMat('#e0a84a', { roughness: 0.4, metalness: 0.3 });
  add(lamp, new THREE.CylinderGeometry(0.08, 0.09, 0.03, 18), lampMat, 0, 0.015, 0);
  const arm1 = add(lamp, new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), steel, -0.06, 0.18, 0);
  arm1.rotation.z = 0.35;
  const arm2 = add(lamp, new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), steel, -0.22, 0.38, 0);
  arm2.rotation.z = -1.1;
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#e0a84a', roughness: 0.4, metalness: 0.2, emissive: '#ffcf8a', emissiveIntensity: 0.25, side: THREE.DoubleSide });
  const shade = add(lamp, new THREE.CylinderGeometry(0.035, 0.1, 0.12, 18, 1, true), shadeMat, -0.36, 0.42, 0);
  shade.rotation.z = 0.6;
  add(lamp, new THREE.SphereGeometry(0.03, 10, 8), stdMat('#fff4dc', { emissive: '#ffe1a8', emissiveIntensity: 1.2 }), -0.35, 0.39, 0);
  addLight(BENCH.x - 0.25, BENCH.height + 0.4, BENCH.z - 0.78, '#ffc98a', 1.8, 4.5);

  // ---- baú de brinquedos aberto (o ursinho espiando lá de dentro)
  const chest = new THREE.Group();
  chest.position.set(TOY_CHEST.x, 0, TOY_CHEST.z);
  grp.add(chest);
  const cw = TOY_CHEST.hx * 2, cd = TOY_CHEST.hz * 2, ch = TOY_CHEST.height;
  const chestMat = stdMat('#c8553d', { roughness: 0.55 });
  const trimMat = stdMat('#e0a84a', { roughness: 0.5 });
  // paredes (aberto em cima) + fundo
  add(chest, rbox(cw, 0.04, cd, 0.01), chestMat, 0, 0.03, 0);
  for (const s of [-1, 1]) {
    add(chest, rbox(cw, ch - 0.01, 0.04, 0.012), chestMat, 0, (ch - 0.01) / 2 + 0.01, s * (cd / 2 - 0.02));
    add(chest, rbox(0.04, ch - 0.01, cd - 0.08, 0.012), chestMat, s * (cw / 2 - 0.02), (ch - 0.01) / 2 + 0.01, 0);
  }
  // faixa mostarda em volta (6 mm para fora das tábuas; as cantoneiras ficam 2 mm além dela)
  add(chest, rbox(cw + 0.012, 0.05, cd + 0.012, 0.012), trimMat, 0, 0.2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(chest, rbox(0.06, ch - 0.02, 0.06, 0.01), stdMat('#c99a52', { roughness: 0.38, metalness: 0.55 }), sx * (cw / 2 - 0.022), ch / 2, sz * (cd / 2 - 0.022));
  // tampa aberta, encostada na parede (dobradiça na borda leste)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(cw / 2, ch, 0);
  lidPivot.rotation.z = -1.72;
  chest.add(lidPivot);
  add(lidPivot, rbox(cw, 0.05, cd, 0.015), chestMat, -cw / 2, 0.025, 0);
  add(lidPivot, rbox(cw * 0.6, 0.006, cd * 0.6, 0.004), trimMat, -cw / 2, -0.002, 0);
  // conteúdo: blocos, bola listrada e o ursinho
  const toyBlocks = [];
  const rr = rng(77);
  for (let i = 0; i < 12; i++) {
    const s = 0.08 + rr() * 0.03;
    toyBlocks.push(paint(new THREE.BoxGeometry(s, s, s).rotateY(rr() * 1.5).rotateZ((rr() - 0.5) * 0.6)
      .translate((rr() - 0.5) * (cw - 0.2), ch - 0.07 + rr() * 0.05, (rr() - 0.5) * (cd - 0.2)), canColors[i % 4]));
  }
  add(chest, mergeGeometries(toyBlocks), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  add(chest, new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ map: checkTexture('#f3e6cc', '#4f8f8b'), roughness: 0.5 }), 0.18, ch + 0.02, -0.12);
  const bear = createTeddyBear(0.24);
  bear.name = 'ursinho-do-bau';
  bear.traverse((o) => { delete o.userData.carryKind; });
  bear.userData.sit();
  bear.position.set(-0.05, ch - 0.16, 0.05);
  bear.rotation.y = -0.85; // olhando para o sudoeste: a câmera vê o rostinho
  chest.add(bear);

  // ---- estante de nichos (parede oeste) com cestos, globo, foguete e patinho
  const shelf = new THREE.Group();
  shelf.position.set(TOY_SHELF.x, 0, TOY_SHELF.z);
  grp.add(shelf);
  const sMat = woodMat('#efe2c8', { key: 'expresso-estante', rough: 0.65 });
  const sw = TOY_SHELF.hx * 2 - 0.02, sl = TOY_SHELF.hz * 2, sh = TOY_SHELF.height;
  for (const s of [-1, 1]) add(shelf, rbox(sw, sh, 0.03, 0.008), sMat, 0, sh / 2, s * (sl / 2 - 0.015));
  add(shelf, rbox(sw, sh - 0.06, 0.025, 0.006), sMat, 0, sh / 2, 0);
  for (const y of [0.025, sh / 2, sh - 0.015]) add(shelf, rbox(sw + 0.012, 0.03, sl - 0.06, 0.008), sMat, 0.006, y, 0);
  add(shelf, rbox(0.02, sh - 0.06, sl - 0.06, 0.006), sMat, -sw / 2 + 0.01, sh / 2, 0);
  const binColors = ['#4f8f8b', '#e0a84a', '#c8553d', '#7ca8b2'];
  let bi = 0;
  for (const y of [0.04, sh / 2 + 0.015]) for (const z of [-sl / 4, sl / 4]) {
    const bin = add(shelf, rbox(sw - 0.1, sh / 2 - 0.1, sl / 2 - 0.08, 0.03), stdMat(binColors[bi], { roughness: 0.95 }), 0.04 + (bi % 2) * 0.03, y + (sh / 2 - 0.1) / 2, z);
    bin.rotation.y = (bi % 2 ? 1 : -1) * 0.03;
    add(shelf, rbox(0.012, 0.04, 0.16, 0.008), stdMat('#f3e6cc', { roughness: 0.9 }), 0.04 + (bi % 2) * 0.03 + (sw - 0.1) / 2 + 0.006, y + (sh / 2 - 0.1) * 0.75, z);
    bi++;
  }
  // globo de planeta no seu pé
  const globe = new THREE.Group();
  globe.position.set(0.02, sh, -0.42);
  shelf.add(globe);
  add(globe, new THREE.CylinderGeometry(0.06, 0.075, 0.025, 16), frame, 0, 0.0125, 0);
  const arc = add(globe, new THREE.TorusGeometry(0.135, 0.008, 6, 24, Math.PI), stdMat('#c99a52', { roughness: 0.38, metalness: 0.55 }), 0, 0.165, 0);
  arc.rotation.set(0, Math.PI / 2, 0.4);
  const globeBall = add(globe, new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshStandardMaterial({ map: globeTexture(), roughness: 0.45 }), 0, 0.165, 0);
  globeBall.rotation.z = 0.4;
  // foguete de brinquedo e o patinho de borracha
  const toyRocket = new THREE.Group();
  toyRocket.position.set(0.0, sh, 0.15);
  shelf.add(toyRocket);
  add(toyRocket, new THREE.CylinderGeometry(0.045, 0.05, 0.2, 14), stdMat('#f3e6cc', { roughness: 0.5 }), 0, 0.12, 0);
  add(toyRocket, new THREE.ConeGeometry(0.046, 0.1, 14), stdMat('#c8553d', { roughness: 0.5 }), 0, 0.27, 0);
  for (let i = 0; i < 3; i++) {
    const fin = add(toyRocket, rbox(0.01, 0.07, 0.05, 0.004), stdMat('#4f8f8b', { roughness: 0.55 }), Math.cos((i / 3) * TAU) * 0.05, 0.05, Math.sin((i / 3) * TAU) * 0.05);
    fin.rotation.y = -(i / 3) * TAU;
  }
  const duck = createRubberDuck(0.14);
  duck.name = 'patinho-da-estante';
  duck.traverse((o) => { delete o.userData.carryKind; });
  duck.position.set(0.03, sh, 0.5);
  duck.rotation.y = Math.PI / 2 - 0.3;
  shelf.add(duck);
  for (let i = 0; i < 4; i++) {
    const b = add(shelf, rbox(0.16, 0.035, 0.22, 0.005), stdMat(binColors[(i + 1) % 4], { roughness: 0.8 }), 0.02, sh + 0.018 + i * 0.035, -0.08);
    b.rotation.y = (i % 2 ? 0.12 : -0.08);
  }

  // ---- planta de folhas grandes num vaso esmaltado
  const plant = new THREE.Group();
  plant.position.set(PLANT.x, 0, PLANT.z);
  grp.add(plant);
  add(plant, new THREE.LatheGeometry(potProfile(0.24, 0.38, { foot: 0.72, belly: 1.05 }), 24), stdMat('#4f8f8b', { roughness: 0.35 }));
  add(plant, new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20), stdMat('#5b3e2b', { roughness: 1 }), 0, 0.33, 0);
  const leafMat = stdMat('#4c8a46', { roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.bezierCurveTo(0.2, 0.06, 0.24, 0.34, 0, 0.44); s.bezierCurveTo(-0.24, 0.34, -0.2, 0.06, 0, 0);
    const a = (i / 8) * TAU;
    const lf = add(plant, new THREE.ShapeGeometry(s, 8), leafMat, Math.cos(a) * 0.06, 0.4 + (i % 3) * 0.1, Math.sin(a) * 0.06);
    lf.rotation.set(-0.85 + (i % 3) * 0.22, a + Math.PI / 2, 0);
    add(plant, new THREE.CylinderGeometry(0.006, 0.008, 0.36, 5), stdMat('#5f8f4a', { roughness: 0.8 }), Math.cos(a) * 0.03, 0.36 + (i % 3) * 0.05, Math.sin(a) * 0.03);
  }

  // ---- tapete de retalhos (lado sul, por onde as duas passam) e o cantinho de brinquedos
  const rag = add(grp, new THREE.CylinderGeometry(RAG_RUG.r, RAG_RUG.r, 0.012, 48), new THREE.MeshStandardMaterial({ map: ragRugTexture(), roughness: 1 }), RAG_RUG.x, 0.006, RAG_RUG.z);
  rag.userData.noShadow = true;
  rag.receiveShadow = true;
  const pile = new THREE.Group();
  pile.position.set(TOY_PILE.x, 0, TOY_PILE.z);
  pile.rotation.y = -0.3;
  grp.add(pile);
  // xilofone: base de madeira e teclas coloridas em pininhos (3 mm acima da base)
  add(pile, rbox(0.42, 0.05, 0.22, 0.012), woodMat('#c79a64', { key: 'expresso-caixote', rough: 0.8 }), 0, 0.025, 0.08);
  const keys = ['#c8553d', '#e0a84a', '#f2c766', '#7aa857', '#4f8f8b', '#7ca8b2'];
  // teclas vizinhas alternam 3 mm de altura (nenhum topo no mesmo plano do vizinho)
  keys.forEach((c, i) => add(pile, rbox(0.05, 0.016, 0.17 - i * 0.012, 0.005), stdMat(c, { roughness: 0.45 }), -0.16 + i * 0.064, 0.061 + (i % 2) * 0.003, 0.08));
  for (const s of [-1, 1]) {
    const mallet = add(pile, new THREE.CylinderGeometry(0.007, 0.007, 0.22, 6), handleMat, 0.05 * s, 0.075, -0.07);
    mallet.rotation.set(Math.PI / 2, 0, 0.3 * s);
    add(pile, new THREE.SphereGeometry(0.02, 10, 8), stdMat('#c8553d', { roughness: 0.4 }), 0.05 * s - 0.033 * s, 0.075, -0.175);
  }
  // torre de blocos: cada um um pouco girado sobre o de baixo
  ['#4f8f8b', '#e0a84a', '#c8553d'].forEach((c, i) => {
    const b = add(pile, rbox(0.11, 0.11, 0.11, 0.014), stdMat(c, { roughness: 0.6 }), 0.24, 0.055 + i * 0.11, -0.12);
    b.rotation.y = i * 0.35;
  });

  // ---- luminária de pé (canto noroeste)
  const fl = new THREE.Group();
  fl.position.set(FLOOR_LAMP.x, 0, FLOOR_LAMP.z);
  grp.add(fl);
  const flMat = stdMat('#3a3330', { metalness: 0.5, roughness: 0.4 });
  add(fl, new THREE.CylinderGeometry(0.16, 0.18, 0.035, 20), flMat, 0, 0.0175, 0);
  add(fl, new THREE.CylinderGeometry(0.014, 0.014, 1.45, 8), flMat, 0, 0.75, 0);
  const flShade = new THREE.MeshStandardMaterial({ color: '#f6e7cc', roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0.85, side: THREE.DoubleSide });
  add(fl, new THREE.CylinderGeometry(0.16, 0.25, 0.3, 24, 1, true), flShade, 0, 1.5, 0);
  addLight(FLOOR_LAMP.x, 1.45, FLOOR_LAMP.z + 0.1, '#ffc07a', 2.2, 6);
  // claridade quente das janelas
  for (const x of [-3.6, 3.6]) addLight(x, 1.55, ZN + 0.7, '#ffe0b0', 1.1, 4.5);

  shadowAll(grp);
  floor.castShadow = false;
  flagMesh.castShadow = false;
  return { group: grp, walls, lights, seeThrough: [] };
}
