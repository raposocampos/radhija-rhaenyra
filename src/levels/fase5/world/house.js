// FASE 5 · A casa em corte de maquete: laje com a borda do corte à mostra, piso de tábua corrida
// (sala e corredor) e ladrilho hidráulico xadrez (cozinha), parede do fundo inteira com as janelas de chuva
// (vidro animado: gotas escorrendo sobre o quintal embaçado), paredes laterais e divisórias cortadas a
// meia altura com o "poché" escuro no topo, rodapés, batentes, azulejos atrás da bancada e quadros.
import * as THREE from 'three';
import { rng, rbox, canvasTexture, plasterMat, stdMat, mergeGeometries } from '../../../world/util.js';

const POCHE = '#4a3426'; // cor do corte (topo das paredes cortadas e borda da laje)

// ------------------------------------------------------------------ texturas
/** Tábua corrida (réguas de 12 cm com emendas desencontradas; repetição de 1,2 m). */
function plankTexture() {
  const S = 512, rows = 10, rh = S / rows;
  return canvasTexture(S, S, (g) => {
    const r = rng(12);
    for (let j = 0; j < rows; j++) {
      let x = -r() * S * 0.6;
      while (x < S) {
        const len = S * (0.35 + r() * 0.5);
        const tone = 0.84 + r() * 0.26;
        g.fillStyle = `rgb(${(158 * tone) | 0},${(108 * tone) | 0},${(68 * tone) | 0})`;
        // desenha também a parte que passa da borda (a textura repete)
        for (const ox of [0, S]) g.fillRect(x - ox, j * rh, len, rh);
        for (let i = 0; i < 7; i++) {
          g.strokeStyle = `rgba(70,40,20,${0.05 + r() * 0.08})`;
          g.lineWidth = 0.8 + r();
          const yy = j * rh + 2 + r() * (rh - 4);
          g.beginPath();
          g.moveTo(x, yy);
          g.bezierCurveTo(x + len * 0.3, yy + (r() - 0.5) * 4, x + len * 0.7, yy + (r() - 0.5) * 4, x + len, yy);
          g.stroke();
        }
        g.fillStyle = 'rgba(60,34,18,0.55)';
        g.fillRect(x, j * rh, 2, rh); // emenda
        x += len;
      }
      g.fillStyle = 'rgba(60,34,18,0.5)';
      g.fillRect(0, j * rh, S, 1.5); // junta entre réguas
      g.fillStyle = 'rgba(255,232,196,0.07)';
      g.fillRect(0, j * rh + 2, S, 2);
    }
  });
}

/** Ladrilho hidráulico xadrez creme/verde-sálvia com miolo de flor (repetição de 1,2 m = 4 × 4). */
function kitchenTileTexture() {
  const N = 4, px = 128, S = N * px;
  return canvasTexture(S, S, (g) => {
    const r = rng(31);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const dark = (i + j) % 2 === 1;
      g.fillStyle = dark ? '#7f9c8a' : '#efe6d4';
      g.fillRect(i * px, j * px, px, px);
      // flor de 4 pétalas no centro (ladrilho hidráulico)
      const cx = i * px + px / 2, cy = j * px + px / 2;
      g.fillStyle = dark ? '#e9dfca' : '#a9bfae';
      for (let a = 0; a < 4; a++) {
        g.beginPath();
        g.ellipse(cx + Math.cos((a * Math.PI) / 2) * 16, cy + Math.sin((a * Math.PI) / 2) * 16, 13, 7, (a * Math.PI) / 2, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fillStyle = '#c98f6a'; g.fill();
      // cantos
      g.fillStyle = dark ? 'rgba(233,223,202,0.7)' : 'rgba(127,156,138,0.55)';
      for (const [ox, oy] of [[0, 0], [px, 0], [0, px], [px, px]]) { g.beginPath(); g.arc(i * px + ox, j * px + oy, 18, 0, Math.PI * 2); g.fill(); }
      // desgaste
      for (let s = 0; s < 40; s++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '80,60,40'},${0.03 + r() * 0.05})`;
        g.fillRect(i * px + r() * px, j * px + r() * px, 2 + r() * 4, 1 + r() * 2);
      }
    }
    g.strokeStyle = 'rgba(90,80,70,0.55)';
    g.lineWidth = 2;
    for (let i = 0; i <= N; i++) {
      g.beginPath(); g.moveTo(i * px, 0); g.lineTo(i * px, S); g.stroke();
      g.beginPath(); g.moveTo(0, i * px); g.lineTo(S, i * px); g.stroke();
    }
  });
}

/** Azulejo de metrô (bancada da cozinha). */
function subwayTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#d9d3c8';
    g.fillRect(0, 0, w, h);
    const bw = 64, bh = 32;
    for (let y = 0; y < h / bh; y++) for (let x = -1; x < w / bw + 1; x++) {
      const ox = x * bw + (y % 2 ? bw / 2 : 0);
      const grd = g.createLinearGradient(0, y * bh, 0, y * bh + bh);
      grd.addColorStop(0, '#fbf8f2'); grd.addColorStop(1, '#ece5d9');
      g.fillStyle = grd;
      g.fillRect(ox + 2, y * bh + 2, bw - 4, bh - 4);
    }
  });
}

/** Vidro de chuva: quintal embaçado lá fora + gotas e filetes (mapa de cor e de gotas em movimento). */
function rainBackTexture(seed) {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(seed);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#6e7d92'); sky.addColorStop(0.55, '#8a97a8'); sky.addColorStop(0.56, '#4e6150'); sky.addColorStop(1, '#2f3d33');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    // árvores e muro borrados
    g.filter = 'blur(6px)';
    for (let i = 0; i < 7; i++) {
      g.fillStyle = `rgba(${40 + r() * 30},${70 + r() * 30},${50 + r() * 20},0.9)`;
      g.beginPath(); g.ellipse(r() * w, h * (0.45 + r() * 0.1), 30 + r() * 40, 40 + r() * 30, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(150,140,130,0.6)';
    g.fillRect(0, h * 0.62, w, h * 0.08);
    g.filter = 'none';
  }, { repeat: false });
}
function rainDropsTexture(seed) {
  return canvasTexture(128, 256, (g, w, h) => {
    const r = rng(seed);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h, len = 10 + r() * 40;
      const grd = g.createLinearGradient(x, y, x, y + len);
      grd.addColorStop(0, 'rgba(230,240,255,0)'); grd.addColorStop(1, 'rgba(230,240,255,0.55)');
      g.strokeStyle = grd;
      g.lineWidth = 1 + r();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + len); g.stroke();
      g.fillStyle = 'rgba(240,248,255,0.75)';
      g.beginPath(); g.arc(x, y + len, 1.6 + r() * 1.2, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(235,245,255,${0.2 + r() * 0.35})`;
      g.beginPath(); g.arc(r() * w, r() * h, 0.6 + r() * 1.4, 0, Math.PI * 2); g.fill();
    }
  });
}

/** Quadrinho na parede (desenhos simples: paisagem, patinha, flor). */
function pictureTexture(kind) {
  return canvasTexture(128, 96, (g, w, h) => {
    g.fillStyle = '#f6efe2'; g.fillRect(0, 0, w, h);
    if (kind === 'paisagem') {
      g.fillStyle = '#9cc4d8'; g.fillRect(8, 8, w - 16, h * 0.5);
      g.fillStyle = '#7fae6a'; g.beginPath(); g.moveTo(8, h - 8); g.quadraticCurveTo(w * 0.4, h * 0.35, w - 8, h * 0.62); g.lineTo(w - 8, h - 8); g.fill();
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(w * 0.72, h * 0.3, 9, 0, Math.PI * 2); g.fill();
    } else if (kind === 'patinha') {
      g.fillStyle = '#e8a87c';
      g.beginPath(); g.ellipse(w / 2, h * 0.62, 18, 14, 0, 0, Math.PI * 2); g.fill();
      for (const [dx, dy] of [[-20, -16], [-7, -26], [7, -26], [20, -16]]) { g.beginPath(); g.ellipse(w / 2 + dx, h * 0.62 + dy, 6, 8, 0, 0, Math.PI * 2); g.fill(); }
    } else {
      g.strokeStyle = '#6b8f5a'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(w / 2, h - 10); g.lineTo(w / 2, h * 0.4); g.stroke();
      g.fillStyle = '#e86a7a';
      for (let a = 0; a < 6; a++) { g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 10, h * 0.36 + Math.sin(a) * 10, 7, 5, a, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(w / 2, h * 0.36, 5, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: false });
}

// ------------------------------------------------------------------ laje e pisos
function buildFloors(layout) {
  const grp = new THREE.Group();
  grp.name = 'pisos';
  const { WALL_HK } = layout;
  // laje (com a borda do corte à mostra no sul)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.32, 7.9), stdMat(POCHE, { roughness: 0.95 }));
  slab.position.set(0, -0.161, -0.2);
  grp.add(slab);
  // taco (sala + corredor)
  const wood = plankTexture();
  const woodW = WALL_HK.x + 6.4, D = 7.2;
  wood.repeat.set(woodW / 1.2, D / 1.2);
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.0 });
  const woodFloor = new THREE.Mesh(new THREE.PlaneGeometry(woodW, D).rotateX(-Math.PI / 2), woodMat);
  woodFloor.position.set(-6.4 + woodW / 2, 0.001, -0.2);
  woodFloor.receiveShadow = true;
  // ladrilho (cozinha)
  const tile = kitchenTileTexture();
  const kW = 6.4 - WALL_HK.x;
  tile.repeat.set(kW / 1.2, D / 1.2);
  const tileFloor = new THREE.Mesh(new THREE.PlaneGeometry(kW, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.4 }));
  tileFloor.position.set(WALL_HK.x + kW / 2, 0.001, -0.2);
  tileFloor.receiveShadow = true;
  grp.add(woodFloor, tileFloor);
  return grp;
}

// ------------------------------------------------------------------ paredes
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

function buildWalls(layout, updaters) {
  const grp = new THREE.Group();
  grp.name = 'paredes';
  const { WALLS, WALL_SH, WALL_HK } = layout;
  const H = WALLS.northH, C = WALLS.cutH;
  const salaMat = plasterMat('#ead7bf');
  const hallMat = plasterMat('#dfe3d2');
  const kitMat = plasterMat('#f1ebdf');
  const zN = -3.9; // centro da parede norte (face em -3,8)

  // ---- parede norte com janelas: [x0, x1, material, janelas [{cx, w, sill, h}]]
  const runs = [
    [-6.5, WALL_SH.x, salaMat, [{ cx: -4.6, w: 1.5, sill: 0.95, h: 1.25 }]],
    [WALL_SH.x, WALL_HK.x, hallMat, [{ cx: 1.45, w: 0.7, sill: 1.35, h: 0.85 }]],
    [WALL_HK.x, 6.5, kitMat, [{ cx: 3.6, w: 1.3, sill: 1.25, h: 0.95 }]],
  ];
  const frameMat = stdMat('#f4efe6', { roughness: 0.5 });
  const sillMat = stdMat('#e7dfd2', { roughness: 0.6 });
  const glassBacks = [];
  const drops = [];
  runs.forEach(([x0, x1, wm, wins], ri) => {
    // fatia a parede em torno das janelas
    let cur = x0;
    for (const wi of wins) {
      const a = wi.cx - wi.w / 2, b = wi.cx + wi.w / 2;
      if (a > cur) cutWall(grp, (cur + a) / 2, zN, a - cur, 0.2, H, wm, true);
      cutWall(grp, wi.cx, zN, wi.w, 0.2, wi.sill, wm, false);
      const top = H - (wi.sill + wi.h);
      const lintel = new THREE.Mesh(rbox(wi.w, top, 0.2, 0.012), wm);
      lintel.position.set(wi.cx, wi.sill + wi.h + top / 2, zN);
      lintel.castShadow = lintel.receiveShadow = true;
      const lp = new THREE.Mesh(new THREE.BoxGeometry(wi.w + 0.004, 0.02, 0.204), stdMat(POCHE, { roughness: 0.95 }));
      lp.position.set(wi.cx, H + 0.01, zN);
      grp.add(lintel, lp);
      // vidro: fundo (quintal na chuva) + camada de gotas que escorre
      const back = rainBackTexture(40 + ri);
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(wi.w, wi.h), new THREE.MeshBasicMaterial({ map: back, fog: false }));
      bg.position.set(wi.cx, wi.sill + wi.h / 2, zN - 0.06);
      const dropTex = rainDropsTexture(60 + ri);
      dropTex.repeat.set(wi.w / 0.7, wi.h / 1.0);
      const dm = new THREE.Mesh(new THREE.PlaneGeometry(wi.w, wi.h), new THREE.MeshBasicMaterial({ map: dropTex, transparent: true, depthWrite: false, fog: false }));
      dm.position.set(wi.cx, wi.sill + wi.h / 2, zN - 0.05);
      const sheen = new THREE.Mesh(new THREE.PlaneGeometry(wi.w, wi.h), new THREE.MeshStandardMaterial({ color: '#c8d6e6', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.18 }));
      sheen.position.set(wi.cx, wi.sill + wi.h / 2, zN - 0.04);
      grp.add(bg, dm, sheen);
      glassBacks.push(bg);
      drops.push({ tex: dropTex, speed: 0.09 + ri * 0.015 });
      // caixilho em cruz + peitoril
      const t = 0.05;
      for (const [w, h, x, y] of [[wi.w + 0.08, t, wi.cx, wi.sill + wi.h], [wi.w + 0.08, t, wi.cx, wi.sill], [t, wi.h, a, wi.sill + wi.h / 2], [t, wi.h, b, wi.sill + wi.h / 2], [t * 0.6, wi.h, wi.cx, wi.sill + wi.h / 2], [wi.w, t * 0.6, wi.cx, wi.sill + wi.h * 0.62]]) {
        const fm = new THREE.Mesh(rbox(w, h, 0.07, 0.01), frameMat);
        fm.position.set(x, y, zN + 0.1);
        grp.add(fm);
      }
      const sill = new THREE.Mesh(rbox(wi.w + 0.2, 0.04, 0.2, 0.01), sillMat);
      sill.position.set(wi.cx, wi.sill - 0.01, zN + 0.18);
      grp.add(sill);
      cur = b;
    }
    if (x1 > cur) cutWall(grp, (cur + x1) / 2, zN, x1 - cur, 0.2, H, wm, true);
  });
  // azulejo de metrô atrás da bancada
  const sub = subwayTexture();
  sub.repeat.set(3.0 / 0.5, 0.6 / 0.25);
  const subMat = new THREE.MeshStandardMaterial({ map: sub, roughness: 0.25 });
  // duas faixas dos lados da janela e uma embaixo dela
  for (const [x0, x1] of [[2.1, 2.95], [4.25, 5.1]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 0.62), subMat);
    p.position.set((x0 + x1) / 2, 1.21, -3.795);
    grp.add(p);
  }
  const lower = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.35), subMat);
  lower.position.set(3.6, 1.075, -3.795);
  grp.add(lower);

  // ---- laterais (cortadas) e sul (só o rodapé do corte)
  cutWall(grp, -6.5, -0.2, 0.2, 7.6, C, salaMat);
  cutWall(grp, 6.5, -0.2, 0.2, 7.6, C, kitMat);
  cutWall(grp, 0, 3.5, 13.2, 0.2, 0.22, stdMat('#efe6d6', { roughness: 0.8 }));
  // ---- divisórias (cortadas), com batentes nas passagens
  const jambMat = stdMat('#f4efe6', { roughness: 0.5 });
  const part = (x, gap, wm) => {
    cutWall(grp, x, (-3.8 + gap.z0) / 2, WALLS.t, gap.z0 + 3.8, C, wm);
    cutWall(grp, x, (gap.z1 + 3.4) / 2, WALLS.t, 3.4 - gap.z1, C, wm);
    for (const z of [gap.z0, gap.z1]) {
      const j = new THREE.Mesh(rbox(WALLS.t + 0.06, C, 0.06, 0.01), jambMat);
      j.position.set(x, C / 2, z + (z === gap.z0 ? -0.03 : 0.03));
      grp.add(j);
    }
  };
  part(WALL_SH.x, WALL_SH.gap, salaMat);
  part(WALL_HK.x, WALL_HK.gap, kitMat);

  // ---- rodapés brancos
  const skMat = stdMat('#f7f3ea', { roughness: 0.6 });
  const sk = [];
  const addSk = (x, z, w, d) => sk.push(new THREE.BoxGeometry(w, 0.08, d).translate(x, 0.04, z));
  addSk(-0.0, -3.79, 12.8, 0.02);
  addSk(-6.39, -0.2, 0.02, 7.2);
  addSk(6.39, -0.2, 0.02, 7.2);
  for (const [x, gap] of [[WALL_SH.x, WALL_SH.gap], [WALL_HK.x, WALL_HK.gap]]) {
    for (const s of [-1, 1]) {
      addSk(x + s * 0.07, (-3.8 + gap.z0) / 2, 0.02, gap.z0 + 3.8);
      addSk(x + s * 0.07, (gap.z1 + 3.4) / 2, 0.02, 3.4 - gap.z1);
    }
  }
  const skMesh = new THREE.Mesh(mergeGeometries(sk), skMat);
  skMesh.receiveShadow = true;
  grp.add(skMesh);

  // ---- quadros na parede da sala e do corredor + relógio
  const frameDark = stdMat('#6b4a33', { roughness: 0.6 });
  for (const [x, y, w, h, kind] of /** @type {[number, number, number, number, string][]} */ ([
    [-2.65, 1.7, 0.5, 0.38, 'paisagem'], [-3.25, 1.95, 0.32, 0.26, 'patinha'], [-0.5, 1.85, 0.36, 0.28, 'flor'],
  ])) {
    const f = new THREE.Mesh(rbox(w + 0.05, h + 0.05, 0.03, 0.008), frameDark);
    f.position.set(x, y, -3.785);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: pictureTexture(kind), roughness: 0.8 }));
    pic.position.set(x, y, -3.768);
    grp.add(f, pic);
  }
  const clock = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshStandardMaterial({ color: '#fbf6ec', roughness: 0.5 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 32), stdMat('#c98a4a', { roughness: 0.4, metalness: 0.5 }));
  const hourH = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.08, 0.004).translate(0, 0.04, 0), stdMat('#2a1c14'));
  const minH = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.12, 0.004).translate(0, 0.06, 0), stdMat('#2a1c14'));
  const secH = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.13, 0.003).translate(0, 0.05, 0), stdMat('#d94a3a'));
  hourH.position.z = minH.position.z = secH.position.z = 0.006;
  clock.add(face, rim, hourH, minH, secH);
  clock.position.set(4.95, 2.05, -3.78);
  grp.add(clock);
  hourH.rotation.z = -1.9;
  minH.rotation.z = -4.2;
  updaters.push((dt, t) => {
    for (const d of drops) d.tex.offset.y = (d.tex.offset.y + dt * d.speed) % 1;
    secH.rotation.z = -Math.floor(t) * (Math.PI / 30);
  });
  return { group: grp, glassBacks };
}

export function buildHouse(layout) {
  const updaters = [];
  const floors = buildFloors(layout);
  const walls = buildWalls(layout, updaters);
  const group = new THREE.Group();
  group.name = 'casa';
  group.add(floors, walls.group);
  return { group, walls: walls.group, update: (dt, t) => { for (const f of updaters) f(dt, t); } };
}
