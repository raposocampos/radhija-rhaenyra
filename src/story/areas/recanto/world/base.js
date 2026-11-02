// RECANTO DAS PATINHAS — a base do cenário: o gramado com orvalho, os caminhos de lajota, o muro do condomínio com o
// portãozinho, a rua do lado de fora e a cidade ao fundo (o portal e, longe, a torre da Prefeitura com o relógio parado
// a um minuto da uma), as árvores, os postes, os bancos, os canteiros, a placa do condomínio (só desenho), o cartaz da
// eleição (urna, sino e o relógio marcando uma hora) e o da Amora ("1313"), e o que a tempestade deixou pelo chão:
// galhos, folhas, telhas quebradas e poças.
import * as THREE from 'three';
import { rng, foliageCluster, canvasTexture } from '../../../../world/util.js';
import { boxwood, geranium, lavender } from '../../../../world/plants.js';
import { rb, cyl, slab, sphere, tiles, grassTexture } from '../../../../levels/mapa/world/kit.js';
import { puddle } from '../../../../levels/mapa/world/pecas.js';

const CROWNS = {
  verde: { dark: '#3d5a24', mid: '#6b8f35', light: '#a2c056' },
  'ipe-rosa': { dark: '#a24479', mid: '#dc74ab', light: '#f8bcd9' },
  'ipe-amarelo': { dark: '#b2861c', mid: '#e8b62f', light: '#ffe58a' },
  'ipe-roxo': { dark: '#62428c', mid: '#9677c6', light: '#cdb9ef' },
};
const crowns = new Map();
function crown(kind, variant) {
  const key = `${kind}:${variant}`;
  if (crowns.has(key)) return crowns.get(key);
  const R = rng(23 + variant * 11 + kind.length);
  const blobs = [{ x: 0, y: 2.55, z: 0, r: 1.15 }];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.6;
    blobs.push({ x: Math.cos(a) * 0.7, y: 2.25 + R() * 0.55, z: Math.sin(a) * 0.7, r: 0.68 + R() * 0.24 });
  }
  const g = foliageCluster(blobs, { detail: 2, amp: 0.2, freq: 2.0, seed: variant + 3, ...CROWNS[kind] });
  crowns.set(key, g);
  return g;
}

const col = (hex) => new THREE.Color(hex);
/** Cor que varia por posição (lajotas, reboco): base ± ruído barato. */
function speckle(base, amp = 0.06, seed = 1) {
  const c = col(base);
  const out = new THREE.Color();
  return (p) => {
    const n = Math.sin(p.x * 12.9898 + p.z * 78.233 + seed) * 43758.5453;
    const k = 1 + ((n - Math.floor(n)) - 0.5) * 2 * amp;
    return out.copy(c).multiplyScalar(k);
  };
}

/** Relógio desenhado (sem números): mostrador branco, doze marcas e os ponteiros parados a um minuto da uma. */
function clockFace() {
  return canvasTexture(256, 256, (g, w) => {
    g.fillStyle = '#fbf6ea';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.47, 0, Math.PI * 2); g.fill();
    g.lineWidth = w * 0.035; g.strokeStyle = '#3a2719';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.47, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r0 = i % 3 === 0 ? 0.33 : 0.37;
      g.lineWidth = i % 3 === 0 ? w * 0.03 : w * 0.018;
      g.beginPath();
      g.moveTo(w / 2 + Math.sin(a) * w * r0, w / 2 - Math.cos(a) * w * r0);
      g.lineTo(w / 2 + Math.sin(a) * w * 0.43, w / 2 - Math.cos(a) * w * 0.43);
      g.stroke();
    }
    // a uma hora menos um minuto: o ponteiro das horas quase na uma, o dos minutos quase no doze
    const hand = (a, len, width) => {
      g.lineWidth = width; g.lineCap = 'round';
      g.beginPath(); g.moveTo(w / 2, w / 2); g.lineTo(w / 2 + Math.sin(a) * w * len, w / 2 - Math.cos(a) * w * len); g.stroke();
    };
    hand((Math.PI * 2 * (0 + 59 / 60)) / 12, 0.24, w * 0.045);
    hand((Math.PI * 2 * 59) / 60, 0.36, w * 0.03);
    g.fillStyle = '#3a2719';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.03, 0, Math.PI * 2); g.fill();
  }, { repeat: false });
}

/** O cartaz da eleição: urna com patinha, sino e o relógio marcando uma hora (pictogramas, sem letras). */
function electionPoster() {
  return canvasTexture(512, 360, (g, w, h) => {
    g.fillStyle = '#fff3d6'; g.fillRect(0, 0, w, h);
    g.lineWidth = 10; g.strokeStyle = '#3a2719'; g.strokeRect(8, 8, w - 16, h - 16);
    // faixa de cima: bandeirinhas
    for (let i = 0; i < 9; i++) {
      g.fillStyle = ['#e8475f', '#f2c230', '#3d8fd1'][i % 3];
      g.beginPath(); g.moveTo(24 + i * 54, 24); g.lineTo(76 + i * 54, 24); g.lineTo(50 + i * 54, 66); g.closePath(); g.fill();
    }
    // urna com a patinha
    g.fillStyle = '#4f8f6a'; g.fillRect(40, 140, 130, 150);
    g.fillStyle = '#2f5f45'; g.fillRect(60, 150, 90, 14);
    g.fillStyle = '#fff3d6';
    g.beginPath(); g.arc(105, 235, 22, 0, Math.PI * 2); g.fill();
    for (const [dx, dy] of [[-24, -26], [-8, -38], [10, -38], [26, -26]]) { g.beginPath(); g.arc(105 + dx, 235 + dy, 9, 0, Math.PI * 2); g.fill(); }
    // seta → sino → seta → relógio
    const arrow = (x) => { g.strokeStyle = '#3a2719'; g.lineWidth = 9; g.beginPath(); g.moveTo(x, 215); g.lineTo(x + 38, 215); g.moveTo(x + 24, 200); g.lineTo(x + 40, 215); g.lineTo(x + 24, 230); g.stroke(); };
    arrow(184);
    g.fillStyle = '#e8b93a';
    g.beginPath(); g.moveTo(242, 270); g.quadraticCurveTo(246, 150, 292, 150); g.quadraticCurveTo(338, 150, 342, 270); g.closePath(); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#3a2719'; g.stroke();
    g.fillStyle = '#3a2719'; g.beginPath(); g.arc(292, 280, 12, 0, Math.PI * 2); g.fill();
    arrow(354);
    // relógio marcando uma hora
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(440, 215, 52, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#3a2719'; g.stroke();
    g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(440, 215); g.lineTo(440, 172); g.stroke();
    g.beginPath(); g.moveTo(440, 215); g.lineTo(440 + Math.sin(Math.PI / 6) * 30, 215 - Math.cos(Math.PI / 6) * 30); g.stroke();
  }, { repeat: false });
}

/** O cartaz da Amora (a golden de faixa, candidata): o único lugar com o "1313". */
function amoraPoster() {
  return canvasTexture(360, 480, (g, w, h) => {
    g.fillStyle = '#2f6fb1'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c230'; g.fillRect(0, h - 120, w, 120);
    // a cabeça da golden, de frente
    g.fillStyle = '#da9c42';
    g.beginPath(); g.ellipse(w / 2, 175, 92, 100, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a86c24';
    g.beginPath(); g.ellipse(w / 2 - 92, 190, 34, 70, 0.25, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(w / 2 + 92, 190, 34, 70, -0.25, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f6d39a';
    g.beginPath(); g.ellipse(w / 2, 225, 52, 40, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2420';
    g.beginPath(); g.ellipse(w / 2, 205, 18, 13, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w / 2 - 38, 150, 10, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w / 2 + 38, 150, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8708a';
    g.beginPath(); g.ellipse(w / 2, 250, 14, 20, 0, 0, Math.PI); g.fill();
    // faixa de campanha
    g.strokeStyle = '#e8475f'; g.lineWidth = 26;
    g.beginPath(); g.moveTo(60, 290); g.lineTo(300, 330); g.stroke();
    g.fillStyle = '#2a2420';
    g.font = '800 92px "Fredoka", "Nunito", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('1313', w / 2, h - 60);
  }, { repeat: false });
}

/** A placa do condomínio, só com desenhos: um patinho e duas patinhas. */
function condoSign() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#7a4e2e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff3d6'; g.fillRect(14, 14, w - 28, h - 28);
    // patinho
    g.fillStyle = '#f2c230';
    g.beginPath(); g.ellipse(190, 160, 70, 46, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(240, 100, 36, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f08a3c';
    g.beginPath(); g.moveTo(272, 96); g.lineTo(306, 106); g.lineTo(272, 116); g.closePath(); g.fill();
    g.fillStyle = '#2a2420'; g.beginPath(); g.arc(250, 92, 6, 0, Math.PI * 2); g.fill();
    // duas patinhas
    const paw = (x, y, s) => {
      g.fillStyle = '#8a5a3c';
      g.beginPath(); g.ellipse(x, y, 18 * s, 15 * s, 0, 0, Math.PI * 2); g.fill();
      for (const [dx, dy] of [[-18, -18], [-6, -26], [6, -26], [18, -18]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, 6.5 * s, 0, Math.PI * 2); g.fill(); }
    };
    paw(360, 150, 1.1);
    paw(430, 110, 0.9);
  }, { repeat: false });
}

/**
 * @param {ReturnType<typeof import('../../../../levels/mapa/world/kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildBase(kit, root, L) {
  const R = rng(5);
  const W = L.WALL;
  const own = []; // malhas próprias (fora do kit), para o dispose
  const keep = (m) => { own.push(m); root.add(m); return m; };

  // ---------------------------------------------------------------- chão
  // o gramado do condomínio (textura sem emenda) e uma faixa por baixo do muro e da rua
  // o gramado é um contorno com dois buracos: a água da piscina e o lago (a ilha é do lago; a água fica abaixo do chão)
  const shape = new THREE.Shape([
    new THREE.Vector2(W.minX, -W.minZ), new THREE.Vector2(W.maxX, -W.minZ), new THREE.Vector2(W.maxX, -W.maxZ), new THREE.Vector2(W.minX, -W.maxZ),
  ]);
  const Pl = L.POOL;
  shape.holes.push(new THREE.Path([new THREE.Vector2(Pl.x0, -Pl.z0), new THREE.Vector2(Pl.x0, -Pl.z1), new THREE.Vector2(Pl.x1, -Pl.z1), new THREE.Vector2(Pl.x1, -Pl.z0)]));
  shape.holes.push(new THREE.Path(L.LAKE.outline.map((q) => new THREE.Vector2(q.x, -q.z)).reverse()));
  const lawnGeo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  {
    const pos = lawnGeo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / 4.5; uv[i * 2 + 1] = pos.getZ(i) / 4.5; }
    lawnGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const lawn = keep(new THREE.Mesh(lawnGeo, new THREE.MeshStandardMaterial({ map: grassTexture(), color: '#cfe0b0', roughness: 0.95 })));
  lawn.name = 'recanto:gramado';
  lawn.receiveShadow = true;
  // fora do muro (a leste, a oeste e ao sul): um chão neutro até a neblina (sem buraco no horizonte)
  const outside = new THREE.MeshStandardMaterial({ color: '#a9b98a', roughness: 1 });
  for (const [x0, z0, x1, z1] of [[W.minX - 40, -60, W.minX - 0.12, W.maxZ + 40], [W.maxX + 0.12, -60, W.maxX + 40, W.maxZ + 40], [W.minX - 0.12, W.maxZ + 0.12, W.maxX + 0.12, W.maxZ + 40], [W.minX - 0.12, -60, W.maxX + 0.12, L.STREET.z1 - 2.2]]) {
    const m = keep(new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), outside));
    m.name = 'recanto:chao-de-fora';
    m.position.set((x0 + x1) / 2, -0.02, (z0 + z1) / 2);
    m.receiveShadow = true;
  }
  // os caminhos de lajota (planos baixos por cima da grama, sem encostar uns nos outros na mesma altura)
  const pave = speckle('#d8cbb4', 0.07, 2);
  // (nenhum trecho cobre outro: só encostam nas bordas)
  const paths = [
    [-13.9, -0.55, -2.4, 1.1], // passeio ao norte da casa e do quintal
    [-7.2, -6.1, -6.3, -0.55], // descida a oeste da piscina
    [-6.3, -6.4, 3.3, -6.1], // entre a piscina e a área de serviço
    [2.3, -6.1, 3.3, 0.3], // leste da piscina
    [3.3, -4.6, 8.4, -3.8], // ao sul da torre
    [8.4, -6.15, 9.8, -3.8], // a leste da torre
    [9.8, -6.15, 13.9, -5.3], // frente da guarita
    [12.3, -8.8, 13.9, -6.15], // o portãozinho
    [-2.4, 0.3, 4.6, 1.1], // sul da piscina
    [4.6, 0.0, 5.4, 2.2], // até o píer
    [1.0, 1.1, 2.2, 3.6], // até a garagem
  ];
  paths.forEach(([x0, z0, x1, z1], i) => {
    const w = x1 - x0, d = z1 - z0;
    kit.add(tiles(w, d, 0.4, 0.4, (p) => pave({ x: p.x + x0 * 7, z: p.z + z0 * 3 })), { color: null, slot: 'ground', x: (x0 + x1) / 2, y: 0.012 + (i % 3) * 0.0015, z: (z0 + z1) / 2, group: 'base', ao: false });
  });

  // ---------------------------------------------------------------- muro, pilares e o portãozinho
  const wallCol = speckle('#efe2c8', 0.04, 7);
  const capCol = '#d8c6a5';
  /** Um trecho de muro (a, b no plano), com a altura h, rodapé e capa. */
  const wallRun = (ax, az, bx, bz, h) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) return;
    const ry = -Math.atan2(bz - az, bx - ax);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    kit.add(rb(len, h, W.t, 0.03, 1), { color: wallCol, x: cx, z: cz, ry, group: 'muro' });
    kit.add(rb(len + 0.02, 0.06, W.t + 0.08, 0.02, 1), { color: capCol, x: cx, y: h, z: cz, ry, group: 'muro' });
    kit.add(rb(len + 0.01, 0.16, W.t + 0.04, 0.015, 1), { color: '#c9b693', x: cx, z: cz, ry, group: 'muro' });
    // pilares a cada ~3 m
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const px = ax + (bx - ax) * k, pz = az + (bz - az) * k;
      kit.add(rb(0.36, h + 0.12, 0.36, 0.04, 1), { color: wallCol, x: px, z: pz, ry, group: 'muro' });
      kit.add(rb(0.44, 0.07, 0.44, 0.02, 1), { color: capCol, x: px, y: h + 0.12, z: pz, ry, group: 'muro' });
    }
  };
  wallRun(W.minX, W.minZ, L.GATE.x0, W.minZ, W.hNorth);
  wallRun(L.GATE.x1, W.minZ, W.maxX, W.minZ, W.hNorth);
  wallRun(W.maxX, W.minZ, W.maxX, W.maxZ, W.h);
  wallRun(W.minX, W.maxZ, W.maxX, W.maxZ, W.h);
  // o oeste: do canto norte até a casa (a parede da casa faz o resto)
  wallRun(W.minX, W.minZ, W.minX, L.HOUSE.z0, W.h);
  // os pilares do portãozinho, mais altos, com luminárias acesas
  for (const gx of [L.GATE.x0, L.GATE.x1]) {
    kit.add(rb(0.42, 2.0, 0.42, 0.05, 1), { color: '#e6d6b8', x: gx, z: L.GATE.z, group: 'muro' });
    kit.add(rb(0.5, 0.08, 0.5, 0.02, 1), { color: capCol, x: gx, y: 2.0, z: L.GATE.z, group: 'muro' });
    kit.add(sphere(0.12, 12, 8), { color: '#ffe7b0', slot: 'lit', x: gx, y: 2.18, z: L.GATE.z, group: 'muro' });
  }
  // a folha do portãozinho (grade de ferro verde): gira na dobradiça como o hingeTip do núcleo
  const G = L.GATE_LEAF;
  const leafPivot = new THREE.Group();
  leafPivot.name = 'recanto:portaozinho';
  leafPivot.position.set(G.hinge.x, 0, G.hinge.z);
  const iron = new THREE.MeshStandardMaterial({ color: '#2f5f45', roughness: 0.45, metalness: 0.35 });
  const leafLen = G.length - 0.06;
  const bar = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), iron); m.position.set(x, y, z); m.castShadow = true; leafPivot.add(m); return m; };
  bar(0.04, L.GATE.h, 0.04, 0, L.GATE.h / 2, -0.03);
  bar(0.04, L.GATE.h, 0.04, 0, L.GATE.h / 2, -leafLen);
  for (const y of [0.1, 0.75, L.GATE.h - 0.04]) bar(0.035, 0.035, leafLen, 0, y, -leafLen / 2);
  const nBars = 8;
  for (let i = 1; i < nBars; i++) bar(0.018, L.GATE.h - 0.1, 0.018, 0, L.GATE.h / 2, -(leafLen * i) / nBars);
  // o trinco (a mão do porteiro mexe nele na cena)
  const latch = bar(0.06, 0.05, 0.12, 0.03, 1.02, -leafLen + 0.08);
  latch.name = 'trinco';
  keep(leafPivot);
  const setGate = (t) => { leafPivot.rotation.y = G.closedYaw + (G.openYaw - G.closedYaw) * t; };
  setGate(0);

  // ---------------------------------------------------------------- a rua e a cidade (cenário do lado de fora)
  const S = L.STREET;
  kit.add(slab(W.maxX - W.minX + 8, 0.03, S.z0 - S.sidewalk), { color: speckle('#cfc6b6', 0.05, 9), slot: 'ground', x: 0, z: (S.z0 + S.sidewalk) / 2, group: 'rua', ao: false });
  kit.add(rb(W.maxX - W.minX + 8, S.curb, 0.16, 0.02, 1), { color: '#b9b2a6', x: 0, z: S.sidewalk, group: 'rua' });
  kit.add(slab(W.maxX - W.minX + 8, 0.02, S.sidewalk - S.z1), { color: speckle('#5d5f66', 0.05, 11), slot: 'ground', x: 0, z: (S.sidewalk + S.z1) / 2, group: 'rua', ao: false });
  for (let x = W.minX - 3; x < W.maxX + 3; x += 2.2) kit.add(slab(1.2, 0.004, 0.12), { color: '#f2ead8', slot: 'ground', x, y: 0.021, z: (S.sidewalk + S.z1) / 2, group: 'rua', ao: false });
  kit.add(slab(W.maxX - W.minX + 8, 0.03, 2.2), { color: speckle('#cfc6b6', 0.05, 13), slot: 'ground', x: 0, z: S.z1 - 1.1, group: 'rua', ao: false });
  // os prédios do outro lado da rua: fachadas simples, janelas, toldos coloridos
  const facades = ['#f2c8a2', '#bfd8c9', '#f4e3b5', '#d8c3e6', '#f2b5a2', '#c9dbe8'];
  for (let i = 0, x = W.minX - 2.5; x < W.maxX + 3; i++) {
    const w = 3.2 + R() * 2.2, h = 3.4 + R() * 3.4, d = 3.2;
    const cx = x + w / 2, cz = S.z1 - 2.4 - d / 2;
    kit.add(rb(w - 0.12, h, d, 0.05, 1), { color: speckle(facades[i % facades.length], 0.035, i), x: cx, z: cz, group: 'cidade' });
    kit.add(rb(w + 0.08, 0.14, d + 0.12, 0.03, 1), { color: '#efe7d8', x: cx, y: h, z: cz, group: 'cidade' });
    const rows = Math.max(1, Math.floor((h - 0.8) / 1.25));
    const cols = Math.max(1, Math.floor(w / 1.1));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const wx = cx - w / 2 + (c + 0.5) * (w / cols), wy = 0.9 + r * 1.25;
      kit.add(slab(0.55, 0.7, 0.04), { color: R() < 0.22 ? '#ffe2a0' : '#8ec1df', slot: R() < 0.22 ? 'lit' : 'glass', x: wx, y: wy, z: cz + d / 2 + 0.01, group: 'cidade' });
    }
    kit.add(rb(w * 0.7, 0.06, 0.6, 0.02, 1), { color: ['#e8475f', '#3d8fd1', '#f2c230'][i % 3], x: cx, y: 2.2, z: cz + d / 2 + 0.28, rx: 0.25, group: 'cidade' });
    x += w + 0.25;
  }
  // postes da calçada de fora
  for (let x = W.minX + 1; x < W.maxX; x += 6.5) {
    kit.add(cyl(0.05, 0.07, 3.2, 8), { color: '#4a4f57', x, z: S.sidewalk - 0.35, group: 'rua' });
    kit.add(sphere(0.16, 12, 8), { color: '#ffe7b0', slot: 'lit', x, y: 3.25, z: S.sidewalk - 0.35, group: 'rua' });
  }
  // o portal da cidade (lá adiante, na direção do portãozinho) e a torre da Prefeitura, bem longe, com o relógio parado
  const city = new THREE.Group();
  city.name = 'recanto:cidade';
  const portal = new THREE.Group();
  portal.name = 'portal-da-cidade';
  portal.position.set(14.5, 0, -24);
  const brick = new THREE.MeshStandardMaterial({ color: '#d9a07a', roughness: 0.85 });
  const cream = new THREE.MeshStandardMaterial({ color: '#f4e7cf', roughness: 0.8 });
  for (const sx of [-2.6, 2.6]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.6, 0.9), brick);
    p.position.set(sx, 2.3, 0);
    portal.add(p);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.32, 8, 24, Math.PI), cream);
  arch.position.y = 4.4;
  portal.add(arch);
  city.add(portal);
  const tower = new THREE.Group();
  tower.name = 'torre-da-prefeitura';
  tower.position.set(-1.5, 0, -36);
  const tBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 12, 3.2), cream);
  tBody.position.y = 6;
  tower.add(tBody);
  const tRoof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.2, 4), new THREE.MeshStandardMaterial({ color: '#b5523b', roughness: 0.8 }));
  tRoof.position.y = 13.6;
  tRoof.rotation.y = Math.PI / 4;
  tower.add(tRoof);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), new THREE.MeshStandardMaterial({ map: clockFace(), roughness: 0.6 }));
  face.position.set(0, 9.6, 1.62);
  tower.add(face);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.05), new THREE.MeshStandardMaterial({ color: '#3d4766', roughness: 0.4 }));
  win.position.set(0, 7.1, 1.62);
  tower.add(win);
  city.add(tower);
  // casario baixo entre a rua e a torre (silhuetas, na neblina)
  for (let i = 0; i < 14; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(3 + R() * 3, 3 + R() * 5, 3), new THREE.MeshStandardMaterial({ color: facades[(i + 2) % facades.length], roughness: 0.9 }));
    b.position.set(-20 + i * 3.4, b.geometry.parameters.height / 2, -27 - R() * 8);
    city.add(b);
  }
  city.traverse((o) => { if (/** @type {any} */ (o).isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  keep(city);

  // ---------------------------------------------------------------- árvores, postes, bancos, canteiros
  L.TREES.forEach((t, i) => {
    const s = 1.2 + (i % 3) * 0.08;
    kit.add(cyl(0.11 * s, 0.165 * s, 2.1 * s, 9), { color: '#7a4e2e', x: t.x, z: t.z, group: 'arvores' });
    kit.add(crown(t.kind, i % 3), { color: null, slot: 'foliage', x: t.x, z: t.z, ry: R() * Math.PI * 2, sx: s, sy: s * (0.92 + R() * 0.16), sz: s, group: 'arvores' });
    // o canteiro redondo em volta do tronco (baixinho, dá para pisar)
    kit.add(cyl(0.55, 0.58, 0.04, 16), { color: '#7a5a3a', slot: 'ground', x: t.x, z: t.z, group: 'arvores', ao: false });
  });
  for (const l of L.LAMPS) {
    kit.add(cyl(0.05, 0.065, 2.6, 8), { color: '#3f4a52', x: l.x, z: l.z, group: 'postes' });
    kit.add(rb(0.26, 0.04, 0.26, 0.01, 1), { color: '#3f4a52', x: l.x, y: 2.6, z: l.z, group: 'postes' });
    kit.add(rb(0.2, 0.3, 0.2, 0.03, 1), { color: '#ffe7b0', slot: 'lit', x: l.x, y: 2.64, z: l.z, group: 'postes' });
    kit.add(cyl(0.02, 0.15, 0.12, 8), { color: '#3f4a52', x: l.x, y: 2.94, z: l.z, group: 'postes' });
  }
  for (const b of L.BENCHES) {
    const side = Math.abs(Math.sin(b.yaw)) > 0.5;
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    for (let i = 0; i < 4; i++) {
      const lx = -0.6 + (i % 2) * 1.2, lz = i < 2 ? -0.16 : 0.16;
      kit.add(rb(0.05, 0.42, 0.05, 0.01, 1), { color: '#2f3a3f', x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c, group: 'bancos' });
    }
    for (let i = 0; i < 4; i++) kit.add(rb(1.4, 0.035, 0.09, 0.012, 1), { color: '#b07a4b', x: b.x + (-0.15 + i * 0.1) * s, y: 0.42, z: b.z + (-0.15 + i * 0.1) * c, ry: b.yaw, group: 'bancos' });
    for (let i = 0; i < 3; i++) kit.add(rb(1.4, 0.08, 0.03, 0.012, 1), { color: '#b07a4b', x: b.x - 0.2 * s, y: 0.55 + i * 0.12, z: b.z - 0.2 * c, ry: b.yaw, group: 'bancos' });
    void side;
  }
  // canteiros compridos junto ao muro (com colisão no layout: BEDS)
  (L.BEDS || []).forEach((bd, i) => {
    kit.add(rb(bd.hx * 2, 0.22, bd.hz * 2, 0.03, 1), { color: '#c9b693', x: bd.x, z: bd.z, group: 'canteiros' });
    kit.add(slab(bd.hx * 2 - 0.08, 0.02, bd.hz * 2 - 0.08), { color: '#6a4a2e', slot: 'ground', x: bd.x, y: 0.22, z: bd.z, group: 'canteiros', ao: false });
    const long = bd.hx > bd.hz;
    const len = (long ? bd.hx : bd.hz) * 2 - 0.3;
    const n = Math.max(2, Math.round(len / 0.45));
    for (let k = 0; k < n; k++) {
      const u = -len / 2 + (k + 0.5) * (len / n);
      const px = bd.x + (long ? u : 0), pz = bd.z + (long ? 0 : u);
      const plant = [geranium({ radius: 0.16, height: 0.2, seed: i * 7 + k, flower: ['#ff6a55', '#f2c230', '#e8708a'][(k + i) % 3] }), lavender({ stems: 18, height: 0.36, seed: k + i }), boxwood(0.2, k + i)][(k + i) % 3];
      kit.add(plant, { color: null, slot: 'plant', x: px, y: 0.23, z: pz, ry: R() * 6, group: 'canteiros' });
    }
  });

  // ---------------------------------------------------------------- placas e cartazes
  const signTex = condoSign();
  const sign = keep(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.75 })));
  sign.name = 'recanto:placa';
  sign.position.set(L.GATE.x1 + 0.55, 1.15, W.minZ - W.t / 2 - 0.012);
  sign.rotation.y = Math.PI;
  const P = L.ELECTION_POSTER;
  const poster = keep(new THREE.Mesh(new THREE.PlaneGeometry(P.w, P.h), new THREE.MeshStandardMaterial({ map: electionPoster(), roughness: 0.8 })));
  poster.name = 'recanto:cartaz-da-eleicao';
  poster.position.set(P.x, P.y, P.z + 0.003);
  const amora = keep(new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.82), new THREE.MeshStandardMaterial({ map: amoraPoster(), roughness: 0.8 })));
  amora.name = 'recanto:cartaz-da-amora';
  amora.position.set(9.75, 1.1, W.minZ - W.t / 2 - 0.012);
  amora.rotation.y = Math.PI;

  // ---------------------------------------------------------------- o que a tempestade deixou pelo chão
  const twig = (len) => { const g = cyl(0.012, 0.02, len, 5); g.rotateZ(Math.PI / 2); g.translate(0, 0.02, 0); return g; };
  const leaf = new THREE.CircleGeometry(0.05, 6).rotateX(-Math.PI / 2);
  const shard = (() => { const g = new THREE.CylinderGeometry(0.11, 0.11, 0.02, 8, 1, false, 0, 1.6); g.translate(0, 0.012, 0); return g; })();
  const debris = [
    [-1.2, 0.6], [-8.4, -1.2], [-10.5, -4.4], [-7.3, -2.2], [4.2, -3.2], [6.4, -4.6], [10.4, -3.1], [12.6, -4.6],
    [3.4, 1.8], [-0.4, 2.6], [5.6, 2.4], [-12.2, -3.6], [-6.8, -7.4], [11.6, 6.6], [8.2, 7.6],
  ];
  debris.forEach(([x, z], i) => {
    kit.add(twig(0.35 + R() * 0.4), { color: '#6b4a2e', x, z, ry: R() * Math.PI, group: 'entulho', ao: false });
    for (let k = 0; k < 4; k++) kit.add(leaf, { color: ['#7a9a3a', '#b8a24a', '#9a6a3a'][k % 3], slot: 'ground', x: x + (R() - 0.5) * 0.7, y: 0.018 + k * 0.002, z: z + (R() - 0.5) * 0.7, ry: R() * 6, group: 'entulho', ao: false });
    if (i % 3 === 0) kit.add(shard, { color: '#c4643f', x: x + 0.3, z: z - 0.2, ry: R() * 6, group: 'entulho', ao: false });
  });
  for (const [x, z, r, s] of [[-2.0, -0.2, 0.42, 1], [5.0, -2.2, 0.36, 2], [-9.6, -5.4, 0.48, 3], [10.7, -4.2, 0.3, 4], [11.4, 5.8, 0.4, 5]]) {
    puddle(kit, { x, z, r, y: 0.016, seed: s });
  }

  return {
    props: {
      gateLeaf: { object: leafPivot, setOpen: setGate },
      city: { object: city, portal, tower, clockAt: { x: tower.position.x, y: 9.6, z: tower.position.z + 1.62 } },
    },
    seeThrough: [],
    signs: [],
    reset() { setGate(0); },
    // as malhas ficam na árvore: o escopo de recursos da área (src/core/resources.js) libera tudo depois deste dispose
    dispose() {},
  };
}
