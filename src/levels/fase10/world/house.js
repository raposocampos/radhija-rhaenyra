// FASE 10 · A casa em corte de maquete: laje com a borda do corte à mostra, o assoalho de tábuas cor de mel da sala e
// o ladrilho de cozinha creme e terracota, a parede do fundo inteira (papel de parede verde-menta com raminhos e
// lambri na sala; azulejo de metrô e amarelo-manteiga na cozinha) com duas janelas que mostram o céu do pôr do sol,
// divisória e parede da frente cortadas (a faixa escura do corte em cima), o arco largo entre os dois cômodos e a
// parede leste, que por fora é a fachada da varanda (reboco pêssego, rodapé de pedra, beiral de telhas, a porta de
// vidro aberta, a janela com floreira, a torneira alta e a tomada externa).
//   Sala: sofá, mesa de centro com docinhos, aparador com o QUADRO "Festa do ano passado" (a pista da ordem dos
//   enfeites), estante, poltrona, abajur, tapete oval, as caminhas das duas e o balão do número 3.
//   Cozinha: bancada com pia, fogão e a bagunça do bolo, armários, geladeira com desenhos, mesa com toalha xadrez,
//   cadeiras, as tigelas das dogs e o quadro de luz com a etiqueta "Luzes da festa".
// API: buildHouse(root, layout) → { group, walls (ver através), painting, lampPos, pendantPos, panelPos, update(dt, t) }
import * as THREE from 'three';
import { rng, rbox, canvasTexture, plasterMat, stdMat, woodMat, mergeGeometries, paint, contactShadow, terracottaMat, potProfile, soilDisc, foliageCluster, glazeMat, brassMat } from '../../../world/util.js';
import { plantMat, geranium, lavender } from '../../../world/plants.js';

const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

const POCHE = '#3b2a20';
const TAU = Math.PI * 2;
const FLOOR_Y = 0.012;

// ------------------------------------------------------------------ texturas
/** Tábuas cor de mel, compridas, com veios e pregos (repetição de 1,2 m). */
function honeyPlankTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(41);
    const rows = 7;
    for (let j = 0; j < rows; j++) {
      let x = -r() * 120;
      while (x < w) {
        const len = 100 + r() * 120;
        const tone = 0.86 + r() * 0.24;
        g.fillStyle = `rgb(${(196 * tone) | 0},${(140 * tone) | 0},${(84 * tone) | 0})`;
        g.fillRect(x, (j * h) / rows, len - 2, h / rows - 2);
        g.fillStyle = 'rgba(90,50,20,0.12)';
        for (let k = 0; k < 5; k++) g.fillRect(x + r() * len, (j * h) / rows + 2 + r() * (h / rows - 6), 20 + r() * 40, 1);
        g.fillStyle = 'rgba(60,36,18,0.5)';
        g.fillRect(x + 4, (j * h) / rows + 4, 2, 2);
        g.fillRect(x + len - 8, (j * h) / rows + h / rows - 7, 2, 2);
        x += len;
      }
    }
  });
}
/** Ladrilho de cozinha 20 × 20 cm em xadrez creme e terracota com rejunte claro (repetição de 0,8 m). */
function kitchenTileTexture() {
  return canvasTexture(256, 256, (g) => {
    const r = rng(7);
    const n = 4, px = 64;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const dark = (i + j) % 2 === 1;
      const t = 0.93 + r() * 0.1;
      g.fillStyle = dark ? `rgb(${(196 * t) | 0},${(104 * t) | 0},${(72 * t) | 0})` : `rgb(${(242 * t) | 0},${(226 * t) | 0},${(196 * t) | 0})`;
      g.fillRect(i * px, j * px, px, px);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(i * px + 6, j * px + 6, px * 0.4, 3);
    }
    g.fillStyle = 'rgba(214,202,180,0.9)';
    for (let i = 0; i <= n; i++) { g.fillRect(i * px - 1.5, 0, 3, 256); g.fillRect(0, i * px - 1.5, 256, 3); }
  });
}
/** Papel de parede verde-menta com listras finas e raminhos (repetição de 0,5 m). */
function mintPaperTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#cfe3d2'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 6, h);
    const r = rng(5);
    for (let k = 0; k < 4; k++) {
      const cx = 16 + (k % 2) * 64 + r() * 8, cy = 20 + Math.floor(k / 2) * 64 + r() * 8;
      g.strokeStyle = 'rgba(96,140,104,0.7)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(cx, cy + 14); g.quadraticCurveTo(cx + 3, cy, cx, cy - 12); g.stroke();
      g.fillStyle = 'rgba(96,140,104,0.75)';
      for (let s = 0; s < 3; s++) {
        g.beginPath(); g.ellipse(cx - 4, cy - 6 + s * 7, 4, 2, -0.6, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(cx + 4, cy - 3 + s * 7, 4, 2, 0.6, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(240,160,170,0.85)';
      g.beginPath(); g.arc(cx, cy - 13, 2.6, 0, TAU); g.fill();
    }
  });
}
/** Azulejo de metrô branco (repetição de 0,3 m). */
function subwayTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(3);
    g.fillStyle = '#d8d2c6'; g.fillRect(0, 0, w, h);
    const rows = 8, tw = 32;
    for (let j = 0; j < rows; j++) {
      const off = j % 2 ? tw / 2 : 0;
      for (let x = -tw; x < w + tw; x += tw) {
        const t = 0.95 + r() * 0.06;
        g.fillStyle = `rgb(${(246 * t) | 0},${(244 * t) | 0},${(238 * t) | 0})`;
        g.fillRect(x + off + 1, j * (h / rows) + 1, tw - 2, h / rows - 2);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(x + off + 3, j * (h / rows) + 3, tw * 0.5, 2);
      }
    }
  });
}
/** Céu do pôr do sol visto pela janela: laranja embaixo, lilás em cima, nuvens e a copa escura das árvores. */
function sunsetWindowTexture(seed) {
  return canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#6c5a9a');
    gr.addColorStop(0.45, '#e58a74');
    gr.addColorStop(0.8, '#ffc27a');
    gr.addColorStop(1, '#ffd89a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(seed);
    g.fillStyle = 'rgba(255,214,190,0.55)';
    for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(r() * w, 20 + r() * 40, 20 + r() * 18, 5, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#3a2e3a';
    for (let x = -10; x < w + 10; x += 14 + r() * 10) { g.beginPath(); g.arc(x, h - 8 - r() * 14, 12 + r() * 10, 0, TAU); g.fill(); }
    g.fillRect(0, h - 10, w, 10);
  }, { repeat: false });
}
/** Reboco pêssego da fachada com manchinhas. */
const facadeMat = () => plasterMat('#f2c4a2');

// ------------------------------------------------------------------ o quadro "Festa do ano passado"
/**
 * O quadro da festa de 2 anos: as duas ao lado do bolo de três andares, com o laço no andar de baixo, a vela do 2 no
 * do meio e o chapeuzinho no topo (a mesma ordem pedida agora), e a faixa "Feliz 2 anos" no varal de bandeirinhas.
 */
export function paintingTexture() {
  return canvasTexture(512, 368, (g, w, h) => {
    // parede da festa de dia: azul-claro com bolinhas e o chão de grama
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#bfe0ef'); sky.addColorStop(0.7, '#e4f1e6'); sky.addColorStop(1, '#cfe6b8');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    const r = rng(9);
    for (let k = 0; k < 40; k++) { g.beginPath(); g.arc(r() * w, r() * h * 0.6, 3 + r() * 3, 0, TAU); g.fill(); }
    g.fillStyle = '#8fc66a'; g.fillRect(0, h * 0.8, w, h * 0.2);
    g.fillStyle = 'rgba(70,120,50,0.35)';
    for (let k = 0; k < 120; k++) g.fillRect(r() * w, h * 0.8 + r() * h * 0.2, 2, 5);
    // varal de bandeirinhas com "FELIZ 2 ANOS"
    const letters = 'FELIZ 2 ANOS';
    const cols = ['#f27a8a', '#f6c453', '#7cc4e8', '#9bd57a', '#c79af0'];
    g.strokeStyle = '#7a5a3a'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(10, 30); g.quadraticCurveTo(w / 2, 70, w - 10, 30); g.stroke();
    for (let i = 0; i < letters.length; i++) {
      const u = (i + 0.5) / letters.length;
      const x = 10 + u * (w - 20);
      const y = 30 + 4 * 40 * u * (1 - u) * 0.95;
      g.fillStyle = cols[i % cols.length];
      g.beginPath(); g.moveTo(x - 17, y); g.lineTo(x + 17, y); g.lineTo(x, y + 36); g.closePath(); g.fill();
      if (letters[i] !== ' ') {
        g.fillStyle = '#fffaf0';
        g.font = 'bold 19px "Trebuchet MS", sans-serif';
        g.textAlign = 'center';
        g.fillText(letters[i], x, y + 20);
      }
    }
    // mesa com toalha
    const tx = w * 0.5, ty = h * 0.74;
    g.fillStyle = '#f7f1e4';
    g.beginPath(); g.moveTo(tx - 130, ty); g.lineTo(tx + 130, ty); g.lineTo(tx + 142, h * 0.95); g.lineTo(tx - 142, h * 0.95); g.closePath(); g.fill();
    g.fillStyle = 'rgba(242,122,138,0.5)';
    for (let x = tx - 140; x < tx + 140; x += 20) { g.beginPath(); g.arc(x + 10, h * 0.95, 10, 0, Math.PI); g.fill(); }
    // o bolo de três andares (de baixo para cima: laço, vela do 2, chapeuzinho)
    const tier = (cx, by, tw, th, col) => {
      g.fillStyle = col;
      g.fillRect(cx - tw / 2, by - th, tw, th);
      g.beginPath(); g.ellipse(cx, by - th, tw / 2, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#fffaf2'; // cobertura escorrendo
      g.beginPath();
      g.moveTo(cx - tw / 2, by - th);
      for (let k = 0; k <= 10; k++) {
        const x = cx - tw / 2 + (k / 10) * tw;
        g.lineTo(x, by - th + (k % 2 ? 14 : 6));
      }
      g.lineTo(cx + tw / 2, by - th); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(cx, by - th, tw / 2, 7, 0, 0, TAU); g.fill();
    };
    const b0 = ty + 2;
    tier(tx, b0, 160, 52, '#f6b2c4');
    tier(tx, b0 - 52, 116, 44, '#fbe3a8');
    tier(tx, b0 - 96, 76, 38, '#f6b2c4');
    // granulado
    for (let k = 0; k < 60; k++) {
      g.fillStyle = cols[k % cols.length];
      const lv = k % 3;
      const tw = [160, 116, 76][lv], by = [b0, b0 - 52, b0 - 96][lv], th = [52, 44, 38][lv];
      g.fillRect(tx - tw / 2 + 6 + r() * (tw - 12), by - th + 16 + r() * (th - 20), 4, 2);
    }
    // laço no andar de baixo
    const lx = tx, ly = b0 - 26;
    g.fillStyle = '#e0568e';
    g.beginPath(); g.ellipse(lx - 18, ly, 18, 11, -0.2, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(lx + 18, ly, 18, 11, 0.2, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(lx - 4, ly + 4); g.lineTo(lx - 14, ly + 26); g.lineTo(lx - 4, ly + 22); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(lx + 4, ly + 4); g.lineTo(lx + 14, ly + 26); g.lineTo(lx + 4, ly + 22); g.closePath(); g.fill();
    g.fillStyle = '#b83a6e'; g.beginPath(); g.arc(lx, ly, 6, 0, TAU); g.fill();
    // vela do 2 no anel do andar do meio, ao lado do andar de cima (com a chaminha)
    const cx2 = tx + 48, cy2 = b0 - 96 + 5;
    g.fillStyle = '#3a2a20'; g.fillRect(cx2 - 1.5, cy2 - 2, 3, 6); // o espeto entrando no bolo
    g.fillStyle = '#7cc4e8';
    g.font = 'bold 30px "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.fillText('2', cx2, cy2);
    g.strokeStyle = '#fffaf0'; g.lineWidth = 2; g.strokeText('2', cx2, cy2);
    g.strokeStyle = '#3a2a20'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx2, cy2 - 22); g.lineTo(cx2, cy2 - 27); g.stroke();
    g.fillStyle = '#ffb63d'; g.beginPath(); g.ellipse(cx2, cy2 - 33, 4.5, 8, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff3b0'; g.beginPath(); g.ellipse(cx2, cy2 - 31, 2.2, 4.5, 0, 0, TAU); g.fill();
    // chapeuzinho no topo
    const hx = tx, hy = b0 - 134;
    g.fillStyle = '#ff8fc4';
    g.beginPath(); g.moveTo(hx - 22, hy); g.lineTo(hx + 22, hy); g.lineTo(hx, hy - 58); g.closePath(); g.fill();
    g.fillStyle = '#fff1d9';
    g.beginPath(); g.moveTo(hx - 15, hy - 18); g.lineTo(hx + 15, hy - 18); g.lineTo(hx + 11, hy - 28); g.lineTo(hx - 11, hy - 28); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(hx - 7, hy - 40); g.lineTo(hx + 7, hy - 40); g.lineTo(hx + 4, hy - 48); g.lineTo(hx - 4, hy - 48); g.closePath(); g.fill();
    g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(hx, hy - 60, 7, 0, TAU); g.fill();
    // as duas, sentadinhas dos lados do bolo (a Rhaenyra branca à esquerda, a Radhija bege à direita)
    const dog = (x, y, s, body, ear, flip) => {
      g.save(); g.translate(x, y); g.scale(flip ? -s : s, s);
      g.fillStyle = body;
      g.beginPath(); g.ellipse(0, 0, 30, 34, 0, 0, TAU); g.fill(); // corpo sentado
      g.beginPath(); g.ellipse(4, -46, 26, 24, 0, 0, TAU); g.fill(); // cabeça
      g.fillStyle = ear;
      g.beginPath(); g.ellipse(-16, -40, 10, 20, 0.3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(24, -40, 10, 20, -0.3, 0, TAU); g.fill();
      g.fillStyle = body; g.beginPath(); g.ellipse(10, -38, 14, 11, 0, 0, TAU); g.fill(); // focinho
      g.fillStyle = '#2a1c14';
      g.beginPath(); g.arc(-4, -52, 3.4, 0, TAU); g.fill();
      g.beginPath(); g.arc(14, -52, 3.4, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(12, -40, 4.5, 3.4, 0, 0, TAU); g.fill();
      g.strokeStyle = '#2a1c14'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(10, -34, 5, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = '#f27a8a'; g.beginPath(); g.ellipse(10, -30, 3, 4, 0, 0, TAU); g.fill(); // linguinha
      g.restore();
    };
    dog(tx - 178, h * 0.82, 1.15, '#f6f1e8', '#ece2d2', false);
    dog(tx + 178, h * 0.84, 0.98, '#efcf9e', '#d9ae72', true);
    // moldura pintada (vinheta) e a assinatura
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,40,20,0.28)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(80,60,40,0.7)'; g.font = 'italic 13px Georgia, serif'; g.textAlign = 'right';
    g.fillText('2 anos', w - 14, h - 10);
  }, { repeat: false });
}
/** Plaquinha de latão embaixo do quadro. */
function plaqueTexture(text) {
  return canvasTexture(256, 48, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e8c77a'); gr.addColorStop(1, '#b88a3c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,60,20,0.6)'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#4a3010'; g.font = 'italic bold 22px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
  }, { repeat: false });
}
/** Etiqueta escrita à mão (fita crepe). */
function labelTexture(text, { bg = '#f4e6b8', ink = '#3a2a20', w = 192, h = 48, font = 'bold 22px "Comic Sans MS", "Trebuchet MS", sans-serif' } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 1, h);
    g.fillStyle = ink; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
  }, { repeat: false });
}
/** Desenho de criança na porta da geladeira: as duas e um coração. */
function drawingTexture() {
  return canvasTexture(128, 160, (g, w, h) => {
    g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, w, h);
    g.lineWidth = 3; g.lineCap = 'round';
    g.strokeStyle = '#e8a23a';
    g.beginPath(); g.ellipse(40, 100, 22, 18, 0, 0, TAU); g.stroke();
    g.beginPath(); g.arc(40, 70, 15, 0, TAU); g.stroke();
    g.strokeStyle = '#8aa0c8';
    g.beginPath(); g.ellipse(92, 104, 24, 20, 0, 0, TAU); g.stroke();
    g.beginPath(); g.arc(92, 72, 16, 0, TAU); g.stroke();
    g.fillStyle = '#e8566a';
    g.beginPath(); g.moveTo(64, 40); g.bezierCurveTo(50, 22, 38, 42, 64, 56); g.bezierCurveTo(90, 42, 78, 22, 64, 40); g.fill();
    g.strokeStyle = '#6bb04a'; g.beginPath(); g.moveTo(0, 140); g.lineTo(w, 140); g.stroke();
    g.fillStyle = '#e8566a'; g.font = 'bold 16px "Comic Sans MS", sans-serif'; g.textAlign = 'center'; g.fillText('R + R', w / 2, 156);
  }, { repeat: false });
}

// ------------------------------------------------------------------ peças
/** Caixa de parede com a faixa escura do corte no topo (poche). */
function wallBox(grp, x, y0, z, w, h, d, material, poche = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
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
/** Material de parede: um mapa por face (BoxGeometry: +x, −x, +y, −y, +z, −z). */
function faceMats(base, faces) {
  return [0, 1, 2, 3, 4, 5].map((i) => faces[i] || base);
}
function texMat(tex, repeatX, repeatY, opts = {}) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(repeatX, repeatY);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, ...opts });
}
/** Janela emoldurada com o céu do pôr do sol (brilho próprio) e caixilhos brancos. Frente para +Z local. */
function sunsetWindow(w, h, seed) {
  const grp = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: sunsetWindowTexture(seed), toneMapped: true }));
  glass.position.z = 0.004;
  grp.add(glass);
  const frameMat = stdMat('#f6f1e6', { roughness: 0.5 });
  const t = 0.05;
  for (const [x, y, ww, hh] of [[0, h / 2 + t / 2, w + t * 2, t], [0, -h / 2 - t / 2, w + t * 2, t], [-w / 2 - t / 2, 0, t, h], [w / 2 + t / 2, 0, t, h], [0, 0, 0.025, h], [0, 0, w, 0.025]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 0.04), frameMat);
    f.position.set(x, y, 0.02);
    f.castShadow = true;
    grp.add(f);
  }
  const sill = new THREE.Mesh(rbox(w + 0.2, 0.04, 0.12, 0.012), frameMat);
  sill.position.set(0, -h / 2 - t - 0.02, 0.06);
  sill.castShadow = true;
  grp.add(sill);
  return grp;
}
/** Plantinha num vaso esmaltado (decoração). */
function pottedPlant(r, h, color, seed, kind = 'fern') {
  const grp = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potProfile(r, h, { foot: 0.8 }), 20), glazeMat(color));
  pot.castShadow = true;
  grp.add(pot);
  const soil = new THREE.Mesh(soilDisc(r * 0.88, seed), stdMat('#4a3322'));
  soil.position.y = h * 0.86;
  grp.add(soil);
  let plant;
  if (kind === 'geranium') plant = new THREE.Mesh(geranium({ radius: r * 1.1, height: h * 0.9, seed, flower: '#ff6a7a' }), plantMat());
  else if (kind === 'lavender') plant = new THREE.Mesh(lavender({ stems: 20, height: h * 1.6, spread: r * 0.7, seed }), plantMat());
  else {
    plant = new THREE.Mesh(foliageCluster([
      { x: 0, y: 0, z: 0, r: r * 1.1, sy: 0.8 }, { x: r * 0.5, y: r * 0.3, z: 0, r: r * 0.8 }, { x: -r * 0.4, y: r * 0.4, z: r * 0.3, r: r * 0.7 },
    ], { seed, dark: '#2f5a2a', mid: '#4f8a3a', light: '#8fc25a', amp: 0.3 }), plantMat());
  }
  plant.position.y = h * 0.86;
  plant.castShadow = true;
  grp.add(plant);
  return grp;
}

// ------------------------------------------------------------------ casa
/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
/**
 * Luzinhas em volta do quadro: um fio de lâmpadas que sobe pela direita, faz gomos por cima (passando sobre a
 * arandela) e desce pela esquerda. Apagadas até o disjuntor; o ramal do conduíte chega no canto de cima à direita
 * (`start`) e elas acendem em onda a partir dali, junto com a arandela, o halo na parede e o brilho da tela.
 * @param {THREE.Group} group
 * @param {{ x: number, y: number, z: number, w: number, h: number }} PAINTING
 * @param {number} zN face de dentro da parede do fundo
 * @param {{ glow: THREE.Mesh, halo: THREE.Mesh, canvasMat: THREE.MeshStandardMaterial }} parts
 */
function buildPaintingLights(group, PAINTING, zN, { glow, halo, canvasMat }) {
  const g = new THREE.Group();
  g.name = 'luzinhas-do-quadro';
  const sx = PAINTING.w / 2 + 0.17, top = PAINTING.h / 2 + 0.19, bot = -PAINTING.h / 2 - 0.03;
  const V = (x, y) => new THREE.Vector3(x, y, 0);
  const pts = [V(sx, bot), V(sx + 0.012, (bot + top) / 2), V(sx, top)];
  const gomos = 4;
  for (let i = 1; i <= gomos; i++) {
    const x0 = sx - (2 * sx * (i - 1)) / gomos, x1 = sx - (2 * sx * i) / gomos;
    pts.push(V((x0 + x1) / 2, top - 0.06), V(x1, top));
  }
  pts.push(V(-sx - 0.012, (bot + top) / 2), V(-sx, bot));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.004, 5, false), stdMat('#3d5a2e', { roughness: 0.6 }));
  wire.position.z = 0.012;
  g.add(wire);
  // pregos nos cantos e nos topos dos gomos
  const nailG = new THREE.CylinderGeometry(0.006, 0.006, 0.02, 6).rotateX(Math.PI / 2);
  const nailM = brassMat();
  for (const p of [pts[0], pts[2], ...pts.slice(3, 3 + gomos * 2).filter((_, k) => k % 2 === 1), pts[pts.length - 1]]) {
    const nl = new THREE.Mesh(nailG, nailM);
    nl.position.set(p.x, p.y, 0.012);
    g.add(nl);
  }
  // as lâmpadas (cores quentes alternadas), penduradas um pouco abaixo do fio
  const N = 26;
  const entry = 2 / (pts.length - 1); // o canto de cima à direita, onde o ramal chega
  const bulbG = new THREE.SphereGeometry(0.019, 10, 8);
  bulbG.scale(1, 1.3, 1);
  const bulbs = new THREE.InstancedMesh(bulbG, new THREE.MeshBasicMaterial({ color: '#ffffff' }), N);
  bulbs.name = 'lampadas-do-quadro';
  const capG = new THREE.CylinderGeometry(0.009, 0.009, 0.014, 8);
  const caps = new THREE.InstancedMesh(capG, stdMat('#3d5a2e', { roughness: 0.6 }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const OFF = new THREE.Color('#9a8c70');
  const ON = ['#ffd36a', '#ff9ec8', '#fff1b0', '#9bdcff'].map((c) => new THREE.Color(c).multiplyScalar(1.7));
  const order = [];
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    curve.getPointAt(u, p);
    p.y -= 0.024;
    p.z = 0.03;
    bulbs.setMatrixAt(i, m4.compose(p, q, one));
    caps.setMatrixAt(i, m4.compose(p.setY(p.y + 0.026), q, one));
    bulbs.setColorAt(i, OFF);
    order.push(Math.abs(curve.getUtoTmapping(u) - entry) / Math.max(entry, 1 - entry));
  }
  bulbs.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = true;
  g.add(bulbs, caps);
  g.position.set(PAINTING.x, PAINTING.y, zN + 0.004);
  group.add(g);
  const start = new THREE.Vector3(PAINTING.x + sx, PAINTING.y + top + 0.01, zN + 0.016);
  const lampOff = new THREE.Color('#5a4a36'), lampOn = new THREE.Color('#fff0c8');
  const glowMat = /** @type {THREE.MeshBasicMaterial} */ (glow.material);
  const haloMat = /** @type {THREE.MeshBasicMaterial} */ (halo.material);
  const c = new THREE.Color();
  const st = { on: false, k: 0, level: 0, dirty: true };
  return {
    start,
    get lit() { return st.on && st.k > 1.2; },
    setOn(on) {
      if (!!on !== st.on) { st.on = !!on; st.k = 0; st.dirty = true; }
    },
    update(dt, t) {
      st.k += dt;
      st.level = ease(st.level, st.on ? 1 : 0, dt, 2.4);
      if (!st.on && !st.dirty && st.level < 0.001) return;
      for (let i = 0; i < N; i++) {
        const b = st.on ? Math.max(0, Math.min(1, (st.k * 1.4 - order[i]) * 5)) : 0;
        const tw = 0.86 + 0.14 * Math.sin(t * 3.1 + i * 1.7);
        bulbs.setColorAt(i, c.copy(OFF).lerp(ON[i % ON.length], b * tw));
      }
      if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
      glowMat.color.copy(lampOff).lerp(lampOn, st.level);
      haloMat.opacity = st.level;
      canvasMat.emissiveIntensity = 0.12 + 0.16 * st.level;
      st.dirty = false;
    },
  };
}

export function buildHouse(root, layout) {
  const {
    WALLS, HOUSE, WALL_LK, PORCH_DOOR, SOFA, COFFEE_TABLE, SIDEBOARD, PAINTING, BOOKSHELF, ARMCHAIR, FLOOR_LAMP, RUG,
    COUNTER, FRIDGE, KITCHEN_TABLE, KITCHEN_CHAIRS, DOG_BOWLS, BREAKER, WORLD,
  } = layout;
  const group = new THREE.Group();
  group.name = 'casa';
  const walls = new THREE.Group();
  walls.name = 'paredes-da-casa';
  group.add(walls);
  const T = WALLS.t;
  const zN = WORLD.bounds.minZ; // face de dentro da parede do fundo
  const xW = HOUSE.x0; // face de dentro da parede oeste
  const xE = HOUSE.x1; // centro da parede leste
  const zS = HOUSE.zS; // centro da parede da frente
  const xL = WALL_LK.x;

  // ---------------- laje e pisos
  const slab = new THREE.Mesh(new THREE.BoxGeometry(xE - xW + T * 2 + 0.1, 0.3, zS - zN + T * 2 + 0.1), stdMat(POCHE, { roughness: 0.95 }));
  slab.position.set((xW + xE) / 2, -0.15 + 0.004, (zN + zS) / 2);
  slab.receiveShadow = true;
  group.add(slab);
  const livingFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(xL - xW, zS - zN).rotateX(-Math.PI / 2),
    texMat(honeyPlankTexture(), (xL - xW) / 1.2, (zS - zN) / 1.2, { roughness: 0.6 }),
  );
  livingFloor.position.set((xW + xL) / 2, FLOOR_Y, (zN + zS) / 2);
  livingFloor.receiveShadow = true;
  const kitchenFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(xE - xL, zS - zN).rotateX(-Math.PI / 2),
    texMat(kitchenTileTexture(), (xE - xL) / 0.8, (zS - zN) / 0.8, { roughness: 0.45 }),
  );
  kitchenFloor.position.set((xL + xE) / 2, FLOOR_Y, (zN + zS) / 2);
  kitchenFloor.receiveShadow = true;
  group.add(livingFloor, kitchenFloor);

  // ---------------- paredes
  const mintTex = mintPaperTexture();
  /** Papel de parede com a repetição certa para a parede (w × h em metros). */
  const mintFor = (w, h) => texMat(mintTex, w / 0.5, h / 0.5);
  const butter = plasterMat('#f6e2a6');
  const subway = subwayTexture();
  const facade = facadeMat();
  const wainscotMat = woodMat('#f2ece0', { vertical: true, rough: 0.6, key: 'f10-lambri' });
  const baseMat = stdMat('#f6f1e6', { roughness: 0.55 });
  // fundo: sala (papel de parede) e cozinha (amarelo-manteiga com azulejo atrás da bancada)
  const northH = WALLS.northH;
  wallBox(walls, (xW + xL) / 2 - T / 4, 0, zN - T / 2, xL - xW + T / 2, northH, T, faceMats(facade, { 4: mintFor(xL - xW, northH) }), false);
  wallBox(walls, (xL + xE) / 2 + T / 4, 0, zN - T / 2, xE - xL + T / 2, northH, T, faceMats(facade, { 4: butter }), false);
  // lambri da sala (até 0,9 m) com o friso
  const wains = new THREE.Mesh(new THREE.BoxGeometry(xL - xW, 0.9, 0.025), wainscotMat);
  wains.position.set((xW + xL) / 2, 0.45, zN + 0.0125);
  wains.receiveShadow = true;
  const rail = new THREE.Mesh(rbox(xL - xW, 0.04, 0.04, 0.01), baseMat);
  rail.position.set((xW + xL) / 2, 0.91, zN + 0.02);
  walls.add(wains, rail);
  // azulejo da cozinha atrás da bancada
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(COUNTER.x1 - COUNTER.x0 + 0.3, 0.7), texMat(subway, (COUNTER.x1 - COUNTER.x0 + 0.3) / 0.3, 0.7 / 0.3, { roughness: 0.25 }));
  tile.position.set((COUNTER.x0 + COUNTER.x1) / 2, COUNTER.h + 0.35, zN + 0.004);
  walls.add(tile);
  // oeste (alta) e frente (cortada baixa)
  wallBox(walls, xW - T / 2, 0, (zN + zS) / 2 - T / 4, T, 2.2, zS - zN + T / 2, faceMats(facade, { 0: mintFor(zS - zN, 2.2) }));
  wallBox(walls, (xW + xE) / 2, 0, zS, xE - xW + T, WALLS.frontH, T, faceMats(facade, { 5: mintFor(xE - xW, WALLS.frontH), 4: facade }));
  // divisória sala | cozinha (cortada) com o arco largo
  const divMat = faceMats(butter, { 1: mintFor(zS - zN, WALLS.cutH), 0: butter });
  wallBox(walls, xL, 0, (zN + WALL_LK.gap.z0) / 2, T, WALLS.cutH, WALL_LK.gap.z0 - zN, divMat);
  wallBox(walls, xL, 0, (WALL_LK.gap.z1 + zS) / 2, T, WALLS.cutH, zS - WALL_LK.gap.z1, divMat);
  for (const z of [WALL_LK.gap.z0, WALL_LK.gap.z1]) {
    const post = new THREE.Mesh(rbox(T + 0.06, WALLS.cutH + 0.05, 0.07, 0.015), baseMat);
    post.position.set(xL, (WALLS.cutH + 0.05) / 2, z + (z === WALL_LK.gap.z0 ? 0.035 : -0.035));
    post.castShadow = true;
    walls.add(post);
  }
  // leste: por dentro amarelo; por fora a fachada da varanda (porta de vidro aberta, janela com floreira)
  const eastH = 2.4;
  const eastMat = faceMats(facade, { 1: butter, 0: facade });
  wallBox(walls, xE, 0, (zN - T + PORCH_DOOR.z0) / 2, T, eastH, PORCH_DOOR.z0 - zN + T, eastMat, false);
  wallBox(walls, xE, 0, (PORCH_DOOR.z1 + zS + T / 2) / 2, T, eastH, zS + T / 2 - PORCH_DOOR.z1, eastMat, false);
  wallBox(walls, xE, 2.05, (PORCH_DOOR.z0 + PORCH_DOOR.z1) / 2, T, eastH - 2.05, PORCH_DOOR.z1 - PORCH_DOOR.z0, eastMat, false);
  // rodapé de pedra da fachada e o beiral de telhas
  // começa 3 mm dentro da parede e termina 4 mm antes da quina (nenhuma face no plano da fachada ou do muro)
  const sbZ0 = zN, sbZ1 = zS + T / 2 - 0.004;
  const stoneBase = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.32, sbZ1 - sbZ0), stdMat('#9a8e7e', { roughness: 0.9 }));
  stoneBase.position.set(xE + T / 2 + 0.012, 0.16, (sbZ0 + sbZ1) / 2);
  walls.add(stoneBase);
  const tileMat = stdMat('#b8553a', { roughness: 0.7 });
  const eave = new THREE.Group();
  for (let z = zN - T; z < zS + T; z += 0.22) {
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.24, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), tileMat);
    tl.rotation.z = -0.35;
    tl.position.set(xE + 0.25, eastH + 0.08, z + 0.11);
    tl.castShadow = true;
    eave.add(tl);
  }
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, zS - zN + T * 2), stdMat('#f6f1e6', { roughness: 0.6 }));
  fascia.position.set(xE + 0.15, eastH + 0.02, (zN + zS) / 2);
  fascia.castShadow = true;
  eave.add(fascia);
  walls.add(eave);
  // porta de vidro de correr (aberta, a folha para o norte) com o batente
  const doorFrame = stdMat('#f6f1e6', { roughness: 0.5 });
  for (const z of [PORCH_DOOR.z0, PORCH_DOOR.z1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(T + 0.04, 2.05, 0.05), doorFrame);
    jamb.position.set(xE, 1.025, z);
    jamb.castShadow = true;
    walls.add(jamb);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(T + 0.04, 0.06, PORCH_DOOR.z1 - PORCH_DOOR.z0 + 0.1), doorFrame);
  head.position.set(xE, 2.05, (PORCH_DOOR.z0 + PORCH_DOOR.z1) / 2);
  walls.add(head);
  const sliding = new THREE.Group();
  const dw = PORCH_DOOR.z1 - PORCH_DOOR.z0;
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#cfe6ee', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.28, metalness: 0.1, depthWrite: false });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.08, 1.9).rotateY(Math.PI / 2), glassMat);
  pane.position.y = 1.0;
  sliding.add(pane);
  for (const [y, h2] of [[0.04, 0.08], [1.97, 0.06]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, h2, dw), doorFrame);
    bar.position.y = y;
    sliding.add(bar);
  }
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.0, 0.05), doorFrame);
    st.position.set(0, 1.0, s * (dw / 2 - 0.025));
    sliding.add(st);
  }
  sliding.position.set(xE + T / 2 + 0.04, 0, PORCH_DOOR.z0 - dw / 2 + 0.05);
  walls.add(sliding);
  // capacho na porta (pelo lado da varanda) com a patinha
  const mat2 = new THREE.Mesh(rbox(0.5, 0.015, 0.8, 0.006), new THREE.MeshStandardMaterial({ map: labelTexture('BEM-VINDAS', { bg: '#a8743e', ink: '#5a3a1a', w: 256, h: 96, font: 'bold 30px Georgia, serif' }), roughness: 1 }));
  mat2.position.set(xE + 0.42, 0.013, (PORCH_DOOR.z0 + PORCH_DOOR.z1) / 2);
  mat2.rotation.y = Math.PI / 2;
  mat2.receiveShadow = true;
  group.add(mat2);
  // janela da cozinha na fachada (com floreira de gerânios), entre a porta e a torneira
  const kWin = sunsetWindow(0.9, 0.7, 13);
  kWin.position.set(xE + T / 2 + 0.002, 1.45, -2.55);
  kWin.rotation.y = Math.PI / 2;
  walls.add(kWin);
  const box = new THREE.Mesh(rbox(0.16, 0.16, 0.95, 0.02), woodMat('#7a4a2a', { key: 'f10-floreira' }));
  box.position.set(xE + T / 2 + 0.09, 0.98, -2.55);
  box.castShadow = true;
  walls.add(box);
  for (let k = 0; k < 3; k++) {
    const gm = new THREE.Mesh(geranium({ radius: 0.14, height: 0.16, seed: 31 + k, flower: k === 1 ? '#ffffff' : '#ff5a6a' }), plantMat());
    gm.position.set(xE + T / 2 + 0.09, 1.05, -2.85 + k * 0.3);
    walls.add(gm);
  }

  // ---------------- janelas do fundo (céu do pôr do sol)
  const winL = sunsetWindow(0.62, 0.95, 3);
  winL.position.set(-8.95, 1.55, zN + 0.005);
  const winK = sunsetWindow(1.1, 0.8, 7);
  winK.position.set(-6.8, 1.78, zN + 0.005);
  walls.add(winL, winK);
  // cortininhas da sala
  const curtainMat = stdMat('#f3d7d0', { roughness: 0.9, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const cg = new THREE.PlaneGeometry(0.22, 1.25, 6, 1);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 40) * 0.015);
    cg.computeVertexNormals();
    const c = new THREE.Mesh(cg, curtainMat);
    c.position.set(-8.95 + s * 0.38, 1.45, zN + 0.06);
    walls.add(c);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15, 8).rotateZ(Math.PI / 2), brassMat());
  rod.position.set(-8.95, 2.12, zN + 0.07);
  walls.add(rod);

  // ---------------- rodapés
  const skirting = (x, z, w, d) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), baseMat);
    s.position.set(x, 0.04 + FLOOR_Y, z);
    s.receiveShadow = true;
    group.add(s);
  };
  skirting((xL + xE) / 2, zN + 0.012, xE - xL - T, 0.024);
  skirting(xW + 0.012, (zN + zS) / 2, 0.024, zS - zN - T);
  skirting((xW + xE) / 2, zS - T / 2 - 0.012, xE - xW - T, 0.024);

  // ================================================================ SALA
  // ---- sofá de veludo rosa-antigo (encosto para o sul) com almofadas e a saia até o chão
  const velvet = new THREE.MeshPhysicalMaterial({ color: '#c97f86', roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#ffd0d4'), sheenRoughness: 0.5 });
  const sofa = new THREE.Group();
  sofa.name = 'sofa';
  const seat = new THREE.Mesh(rbox(SOFA.hx * 2, 0.16, SOFA.hz * 2 - 0.12, 0.06), velvet);
  seat.position.set(0, SOFA.legs + 0.08, -0.06);
  const back = new THREE.Mesh(rbox(SOFA.hx * 2, 0.5, 0.16, 0.07), velvet);
  back.position.set(0, SOFA.legs + 0.32, SOFA.hz - 0.08);
  back.rotation.x = 0.12;
  sofa.add(seat, back);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(rbox(0.16, 0.28, SOFA.hz * 2, 0.07), velvet);
    arm.position.set(s * (SOFA.hx - 0.08), SOFA.legs + 0.16, 0);
    sofa.add(arm);
  }
  for (const [x, c] of /** @type {[number, string][]} */ ([[-0.45, '#f6e3a8'], [0.42, '#a8cfc0']])) {
    const pil = new THREE.Mesh(rbox(0.3, 0.28, 0.1, 0.05), stdMat(c, { roughness: 0.9 }));
    pil.position.set(x, SOFA.legs + 0.3, SOFA.hz - 0.2);
    pil.rotation.set(0.25, x * 0.3, x * 0.2);
    sofa.add(pil);
  }
  // saia de veludo até o chão (ninguém passa por baixo) e pezinhos torneados aparecendo nos cantos
  const skirt = new THREE.Mesh(rbox(SOFA.hx * 2 - 0.04, 0.178, SOFA.hz * 2 - 0.04, 0.03), velvet);
  skirt.position.set(0, 0.101, 0);
  sofa.add(skirt);
  const legMat = woodMat('#5a3a22', { key: 'f10-perna-escura' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 6), legMat);
    leg.scale.y = 0.6;
    leg.position.set(sx * (SOFA.hx - 0.03), 0.018, sz * (SOFA.hz - 0.03));
    sofa.add(leg);
  }
  sofa.position.set(SOFA.x, FLOOR_Y, SOFA.z);
  sofa.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(sofa);
  const sofaShadow = contactShadow(SOFA.hx + 0.1, SOFA.hz + 0.08, 0.5, FLOOR_Y + 0.003);
  sofaShadow.position.x = SOFA.x; sofaShadow.position.z = SOFA.z;
  group.add(sofaShadow);

  // ---- tapete oval com borda e o desenho de flor
  const rugTex = canvasTexture(256, 180, (g, w, h) => {
    g.fillStyle = '#e9d6b8'; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, TAU); g.fill();
    g.strokeStyle = '#c96b5a'; g.lineWidth = 8; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 14, h / 2 - 14, 0, 0, TAU); g.stroke();
    g.strokeStyle = '#6f9a8a'; g.lineWidth = 3; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 26, h / 2 - 26, 0, 0, TAU); g.stroke();
    g.fillStyle = '#c96b5a';
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 24, h / 2 + Math.sin(a) * 16, 12, 6, a, 0, TAU); g.fill(); }
    g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(w / 2, h / 2, 10, 0, TAU); g.fill();
  }, { repeat: false });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1, transparent: true, alphaTest: 0.5 }));
  rug.scale.set(RUG.rx, 1, RUG.rz);
  rug.position.set(RUG.x, FLOOR_Y + 0.004, RUG.z);
  rug.receiveShadow = true;
  group.add(rug);

  // ---- mesa de centro (madeira clara) com os docinhos da festa e o vasinho
  const ctable = new THREE.Group();
  const ctTop = new THREE.Mesh(rbox(COFFEE_TABLE.hx * 2, 0.05, COFFEE_TABLE.hz * 2, 0.02), woodMat('#c79a62', { key: 'f10-mesa-centro' }));
  ctTop.position.y = COFFEE_TABLE.h - 0.025;
  ctable.add(ctTop);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, COFFEE_TABLE.h - 0.05, 8), legMat);
    leg.position.set(sx * (COFFEE_TABLE.hx - 0.06), (COFFEE_TABLE.h - 0.05) / 2, sz * (COFFEE_TABLE.hz - 0.05));
    leg.rotation.set(sz * 0.08, 0, -sx * 0.08);
    ctable.add(leg);
  }
  // bandeja de brigadeiros com forminhas coloridas
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.015, 24), stdMat('#f4f1ea', { roughness: 0.3 }));
  tray.position.set(-0.12, COFFEE_TABLE.h + 0.008, 0);
  ctable.add(tray);
  const cupCols = ['#f27a8a', '#7cc4e8', '#f6c453', '#9bd57a', '#c79af0'];
  const brig = new THREE.SphereGeometry(0.018, 10, 8);
  const cupG = new THREE.CylinderGeometry(0.024, 0.018, 0.018, 10, 1, true);
  for (let k = 0; k < 9; k++) {
    const a = (k / 8) * TAU, rr = k === 8 ? 0 : 0.09;
    const cup = new THREE.Mesh(cupG, stdMat(cupCols[k % 5], { roughness: 0.6, side: THREE.DoubleSide }));
    cup.position.set(-0.12 + Math.cos(a) * rr, COFFEE_TABLE.h + 0.025, Math.sin(a) * rr);
    const b = new THREE.Mesh(brig, stdMat('#4a2a18', { roughness: 0.7 }));
    b.position.copy(cup.position).y += 0.012;
    ctable.add(cup, b);
  }
  const bud = pottedPlant(0.05, 0.1, '#7cc4e8', 21, 'geranium');
  bud.position.set(0.25, COFFEE_TABLE.h, 0.02);
  ctable.add(bud);
  ctable.position.set(COFFEE_TABLE.x, FLOOR_Y, COFFEE_TABLE.z);
  ctable.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(ctable);

  // ---- aparador com o quadro em cima
  const sb = new THREE.Group();
  const sbWood = woodMat('#8a5a36', { key: 'f10-aparador' });
  const sbBody = new THREE.Mesh(rbox(SIDEBOARD.hx * 2, SIDEBOARD.h - 0.12, SIDEBOARD.hz * 2, 0.02), sbWood);
  sbBody.position.y = 0.12 + (SIDEBOARD.h - 0.12) / 2;
  sb.add(sbBody);
  for (let k = 0; k < 3; k++) {
    const dr = new THREE.Mesh(rbox(SIDEBOARD.hx * 2 / 3 - 0.04, SIDEBOARD.h - 0.2, 0.02, 0.008), woodMat('#9c6a42', { key: 'f10-aparador-gaveta' }));
    dr.position.set((k - 1) * (SIDEBOARD.hx * 2 / 3), 0.12 + (SIDEBOARD.h - 0.12) / 2, SIDEBOARD.hz + 0.005);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), brassMat());
    knob.position.set((k - 1) * (SIDEBOARD.hx * 2 / 3), 0.12 + (SIDEBOARD.h - 0.12) / 2, SIDEBOARD.hz + 0.02);
    sb.add(dr, knob);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.014, 0.12, 8), legMat);
    leg.position.set(sx * (SIDEBOARD.hx - 0.05), 0.06, sz * (SIDEBOARD.hz - 0.04));
    sb.add(leg);
  }
  // em cima: porta-retratos das duas (pequenos), um vaso de lavanda e um balãozinho amarrado
  const frameG = rbox(0.14, 0.18, 0.02, 0.006);
  for (const [x, col] of /** @type {[number, string][]} */ ([[-0.6, '#efcf9e'], [-0.42, '#f6f1e8']])) {
    const fr = new THREE.Mesh(frameG, stdMat('#f6f1e6', { roughness: 0.5 }));
    fr.position.set(x, SIDEBOARD.h + 0.09, -0.05);
    fr.rotation.set(-0.15, 0.2, 0);
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.13), new THREE.MeshStandardMaterial({ map: canvasTexture(64, 80, (g) => {
      g.fillStyle = '#bfe0ef'; g.fillRect(0, 0, 64, 80);
      g.fillStyle = col; g.beginPath(); g.ellipse(32, 56, 20, 18, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(32, 32, 14, 0, TAU); g.fill();
      g.fillStyle = '#2a1c14'; g.beginPath(); g.arc(27, 30, 2, 0, TAU); g.arc(37, 30, 2, 0, TAU); g.fill();
    }, { repeat: false }) }));
    ph.position.set(0, 0, 0.011);
    fr.add(ph);
    sb.add(fr);
  }
  const lav = pottedPlant(0.07, 0.12, '#f4f1ea', 17, 'lavender');
  lav.position.set(0.62, SIDEBOARD.h, -0.02);
  sb.add(lav);
  sb.position.set(SIDEBOARD.x, FLOOR_Y, SIDEBOARD.z);
  sb.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(sb);

  // ---- O QUADRO: moldura dourada entalhada, tela pintada (a festa de 2 anos) e a plaquinha
  const painting = new THREE.Group();
  painting.name = 'quadro-festa-do-ano-passado';
  const canvasTex = paintingTexture();
  const canvasMat = new THREE.MeshStandardMaterial({ map: canvasTex, roughness: 0.7, emissive: '#ffffff', emissiveMap: canvasTex, emissiveIntensity: 0.12 });
  const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(PAINTING.w, PAINTING.h), canvasMat);
  canvasMesh.position.z = 0.03;
  painting.add(canvasMesh);
  const gilt = new THREE.MeshStandardMaterial({ color: '#d6a84c', metalness: 0.85, roughness: 0.32 });
  const fw = 0.07;
  for (const [x, y, w2, h2] of [[0, PAINTING.h / 2 + fw / 2, PAINTING.w + fw * 2, fw], [0, -PAINTING.h / 2 - fw / 2, PAINTING.w + fw * 2, fw], [-PAINTING.w / 2 - fw / 2, 0, fw, PAINTING.h], [PAINTING.w / 2 + fw / 2, 0, fw, PAINTING.h]]) {
    const f = new THREE.Mesh(rbox(w2, h2, 0.06, 0.018), gilt);
    f.position.set(x, y, 0.03);
    f.castShadow = true;
    painting.add(f);
  }
  // rosetas nos cantos da moldura
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const ro = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), gilt);
    ro.scale.z = 0.5;
    ro.position.set(sx * (PAINTING.w / 2 + fw / 2), sy * (PAINTING.h / 2 + fw / 2), 0.065);
    painting.add(ro);
  }
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.08), new THREE.MeshStandardMaterial({ map: plaqueTexture('Festa do ano passado'), metalness: 0.5, roughness: 0.35 }));
  plaque.position.set(0, -PAINTING.h / 2 - fw - 0.07, 0.012);
  painting.add(plaque);
  // luzinha de quadro (arandela de latão) em cima
  const picLamp = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8).rotateX(Math.PI / 2), brassMat());
  arm.position.set(0, 0, 0.07);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.32, 16, 1, true).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c99a45', metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  shade.position.set(0, -0.02, 0.14);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.02), new THREE.MeshBasicMaterial({ color: '#5a4a36' }));
  glow.position.set(0, -0.045, 0.14);
  glow.rotation.x = -Math.PI / 2;
  picLamp.add(arm, shade, glow);
  picLamp.position.set(0, PAINTING.h / 2 + fw + 0.06, 0);
  painting.add(picLamp);
  painting.position.set(PAINTING.x, PAINTING.y, zN + 0.003);
  group.add(painting);
  // halo de luz quente da arandela na parede, por cima do quadro
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(PAINTING.w * 1.6, PAINTING.h * 1.5), new THREE.MeshBasicMaterial({
    map: canvasTexture(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h * 0.15, 4, w / 2, h * 0.4, w * 0.6);
      gr.addColorStop(0, 'rgba(255,220,160,0.55)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, { repeat: false }),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.position.set(PAINTING.x, PAINTING.y + 0.05, zN + 0.008);
  halo.material.opacity = 0;
  group.add(halo);
  const paintingLights = buildPaintingLights(group, PAINTING, zN, { glow, halo, canvasMat });

  // ---- estante de livros no canto
  const shelf = new THREE.Group();
  const shelfWood = woodMat('#7a5234', { key: 'f10-estante' });
  // encostada na parede do fundo, com as prateleiras viradas para a sala (e para a câmera)
  const sw = BOOKSHELF.hx * 2, sd = BOOKSHELF.hz * 2;
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, BOOKSHELF.h, sd), shelfWood);
    side.position.set(s * (sw / 2 - 0.015), BOOKSHELF.h / 2, 0);
    shelf.add(side);
  }
  const backP = new THREE.Mesh(new THREE.BoxGeometry(sw, BOOKSHELF.h, 0.02), shelfWood);
  backP.position.set(0, BOOKSHELF.h / 2, -sd / 2 + 0.01);
  shelf.add(backP);
  const r = rng(77);
  const bookCols = ['#c96b5a', '#6f9a8a', '#f2c14e', '#5a6fa0', '#e8a0a8', '#8a6a9a', '#a0c070', '#f0e0c0'];
  const books = [];
  for (let k = 0; k < 5; k++) {
    const y = 0.08 + k * 0.42;
    const board = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.04, 0.03, sd - 0.02), shelfWood);
    board.position.set(0, y, 0.01);
    shelf.add(board);
    if (k === 4) break;
    let x = -sw / 2 + 0.05;
    while (x < sw / 2 - 0.08) {
      const bw = 0.03 + r() * 0.035, bh = 0.2 + r() * 0.13;
      if (r() < 0.12) { x += 0.06; continue; }
      const g = new THREE.BoxGeometry(bw, bh, 0.2 + r() * 0.05);
      if (r() < 0.15) g.rotateZ(0.12);
      g.translate(x + bw / 2, y + 0.015 + bh / 2, -sd / 2 + 0.14);
      paint(g, bookCols[Math.floor(r() * bookCols.length)]);
      books.push(g);
      x += bw + 0.004;
    }
  }
  const bookMesh = new THREE.Mesh(mergeGeometries(books), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  shelf.add(bookMesh);
  // em cima: um aquário-de-mentirinha? não: um vaso de samambaia caindo
  const fern = pottedPlant(0.1, 0.16, '#c96b5a', 29);
  fern.position.set(0, BOOKSHELF.h, 0);
  shelf.add(fern);
  shelf.position.set(BOOKSHELF.x, FLOOR_Y, BOOKSHELF.z);
  shelf.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(shelf);

  // ---- poltrona de leitura (mostarda) com manta
  const chair = new THREE.Group();
  const mustard = new THREE.MeshPhysicalMaterial({ color: '#d9a441', roughness: 0.85, sheen: 0.8, sheenColor: new THREE.Color('#ffe2a0') });
  const cSeat = new THREE.Mesh(rbox(0.66, 0.16, 0.6, 0.06), mustard);
  cSeat.position.y = 0.3;
  const cBack = new THREE.Mesh(rbox(0.66, 0.6, 0.14, 0.07), mustard);
  cBack.position.set(0, 0.6, -0.26);
  cBack.rotation.x = -0.12;
  chair.add(cSeat, cBack);
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(rbox(0.12, 0.3, 0.6, 0.05), mustard);
    a.position.set(s * 0.31, 0.42, 0);
    chair.add(a);
  }
  const throwB = new THREE.Mesh(rbox(0.5, 0.02, 0.36, 0.01), stdMat('#7cc4e8', { roughness: 1 }));
  throwB.position.set(0.08, 0.395, 0.05);
  throwB.rotation.set(0.05, 0.4, -0.1);
  chair.add(throwB);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.22, 8), legMat);
    leg.position.set(sx * 0.28, 0.11, sz * 0.24);
    chair.add(leg);
  }
  chair.position.set(ARMCHAIR.x, FLOOR_Y, ARMCHAIR.z);
  chair.rotation.y = 1.0;
  chair.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(chair);

  // ---- abajur de pé (cúpula de tecido acesa)
  const lamp = new THREE.Group();
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.03, 20), brassMat());
  lampBase.position.y = 0.015;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.38, 8), brassMat());
  pole.position.y = 0.72;
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.26, 24, 1, true), new THREE.MeshStandardMaterial({
    color: '#fff1d6', emissive: '#ffcf8a', emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.9,
  }));
  lampShade.position.y = 1.45;
  lamp.add(lampBase, pole, lampShade);
  lamp.position.set(FLOOR_LAMP.x, FLOOR_Y, FLOOR_LAMP.z);
  lamp.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(lamp);
  const lampPos = new THREE.Vector3(FLOOR_LAMP.x, 1.42, FLOOR_LAMP.z);

  // ---- caminhas das duas, no canto perto da estante (com o nome bordado)
  const bedTex = (name, col) => canvasTexture(128, 32, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fffaf0'; g.font = 'bold 20px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, w / 2, h / 2 + 1);
  }, { repeat: false });
  for (const [x, z, col, name, rr] of /** @type {[number, number, string, string, number][]} */ ([[-11.45, -3.75, '#e8a0a8', 'Radhija', 0.3], [-11.35, -4.55, '#8fc0d8', 'Rhaenyra', 0.36]])) {
    const bed = new THREE.Group();
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.07, 10, 28).rotateX(Math.PI / 2), stdMat(col, { roughness: 0.95 }));
    rim2.position.y = 0.07;
    rim2.scale.set(1, 1.2, 0.8);
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(rr - 0.02, rr - 0.02, 0.05, 28), stdMat('#fbf3e4', { roughness: 1 }));
    cushion.scale.z = 0.8;
    cushion.position.y = 0.035;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: bedTex(name, col), roughness: 1 }));
    tag.position.set(0, 0.09, rr * 0.8 + 0.071);
    tag.rotation.x = -0.25;
    bed.add(rim2, cushion, tag);
    bed.position.set(x, FLOOR_Y, z);
    bed.rotation.y = 0.9;
    bed.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(bed);
  }

  // ---- balão do número 3 (metalizado dourado) amarrado no braço do sofá
  const three = new THREE.Group();
  three.name = 'balao-3';
  const sh = new THREE.Shape();
  // um "3" de duas barrigas (contorno), extrudado e arredondado
  sh.moveTo(-0.12, 0.2);
  sh.bezierCurveTo(-0.08, 0.32, 0.16, 0.32, 0.16, 0.16);
  sh.bezierCurveTo(0.16, 0.06, 0.09, 0.02, 0.05, 0.0);
  sh.bezierCurveTo(0.12, -0.03, 0.18, -0.09, 0.17, -0.17);
  sh.bezierCurveTo(0.16, -0.34, -0.1, -0.36, -0.15, -0.2);
  sh.lineTo(-0.07, -0.16);
  sh.bezierCurveTo(-0.04, -0.25, 0.08, -0.25, 0.08, -0.16);
  sh.bezierCurveTo(0.08, -0.08, 0.0, -0.05, -0.04, -0.05);
  sh.lineTo(-0.04, 0.05);
  sh.bezierCurveTo(0.02, 0.05, 0.08, 0.08, 0.08, 0.15);
  sh.bezierCurveTo(0.08, 0.24, -0.04, 0.24, -0.05, 0.16);
  sh.closePath();
  const tGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 4, curveSegments: 16 });
  tGeo.center();
  const foil = new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.9, roughness: 0.22, emissive: '#3a2a08', emissiveIntensity: 0.4 });
  const tMesh = new THREE.Mesh(tGeo, foil);
  tMesh.castShadow = true;
  three.add(tMesh);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1.0, 4), stdMat('#f4f1ea'));
  string.position.y = -0.62;
  three.add(string);
  three.position.set(SOFA.x + SOFA.hx - 0.05, 1.35, SOFA.z - 0.05);
  group.add(three);

  // ================================================================ COZINHA
  const cab = woodMat('#8fb8a8', { key: 'f10-armario-verde', rough: 0.55 });
  const counterTop = stdMat('#efe8da', { roughness: 0.3 });
  const cw = COUNTER.x1 - COUNTER.x0;
  const counter = new THREE.Group();
  const cBody = new THREE.Mesh(rbox(cw, COUNTER.h - 0.06, COUNTER.hz * 2 - 0.04, 0.02), cab);
  cBody.position.set(0, (COUNTER.h - 0.06) / 2, -0.02);
  const cTop = new THREE.Mesh(rbox(cw + 0.04, 0.05, COUNTER.hz * 2 + 0.02, 0.015), counterTop);
  cTop.position.y = COUNTER.h - 0.025;
  counter.add(cBody, cTop);
  // portinhas e puxadores
  const nDoors = 6;
  for (let k = 0; k < nDoors; k++) {
    const x = -cw / 2 + (k + 0.5) * (cw / nDoors);
    const dr = new THREE.Mesh(rbox(cw / nDoors - 0.03, COUNTER.h - 0.2, 0.02, 0.01), woodMat('#a4c8b8', { key: 'f10-armario-porta', rough: 0.5 }));
    dr.position.set(x, (COUNTER.h - 0.06) / 2, COUNTER.hz - 0.02);
    const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 6), brassMat());
    pull.position.set(x + (k % 2 ? -1 : 1) * (cw / nDoors / 2 - 0.05), COUNTER.h - 0.22, COUNTER.hz + 0.005);
    counter.add(dr, pull);
  }
  // pia com torneira
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 0.36), stdMat('#c8ccd0', { metalness: 0.8, roughness: 0.25 }));
  sink.position.set(0, COUNTER.h + 0.001, 0);
  const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 16, Math.PI), stdMat('#d8dce0', { metalness: 0.9, roughness: 0.2 }));
  faucet.position.set(0, COUNTER.h + 0.12, -0.18);
  faucet.rotation.y = Math.PI / 2;
  const fStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 8), faucet.material);
  fStem.position.set(0, COUNTER.h + 0.06, -0.26);
  counter.add(sink, faucet, fStem);
  // fogão (quatro bocas) com a chaleira
  const stove = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.015, 0.44), stdMat('#2d2a28', { roughness: 0.4 }));
  stove.position.set(0.82, COUNTER.h + 0.004, 0);
  counter.add(stove);
  for (const [dx, dz] of [[-0.13, -0.1], [0.13, -0.1], [-0.13, 0.1], [0.13, 0.1]]) {
    const burner = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16).rotateX(Math.PI / 2), stdMat('#4a4644', { roughness: 0.5, metalness: 0.5 }));
    burner.position.set(0.82 + dx, COUNTER.h + 0.015, dz);
    counter.add(burner);
  }
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 12), glazeMat('#e8554a'));
  kettle.scale.y = 0.85;
  kettle.position.set(0.95, COUNTER.h + 0.085, 0.08);
  counter.add(kettle);
  // a bagunça do bolo: tigela com batedor, saco de farinha, pote de granulado e o livro de receitas aberto
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', roughness: 0.3, clearcoat: 1, side: THREE.DoubleSide }));
  bowl.position.set(-0.62, COUNTER.h + 0.13, 0.02);
  const batter = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20).rotateX(-Math.PI / 2), stdMat('#f6d6a0', { roughness: 0.4 }));
  batter.position.set(-0.62, COUNTER.h + 0.08, 0.02);
  const whisk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.26, 6), stdMat('#d8dce0', { metalness: 0.9, roughness: 0.2 }));
  whisk.position.set(-0.57, COUNTER.h + 0.16, 0.02);
  whisk.rotation.z = -0.6;
  const flour = new THREE.Mesh(rbox(0.13, 0.2, 0.09, 0.03), stdMat('#f4ecdc', { roughness: 1 }));
  flour.position.set(-0.35, COUNTER.h + 0.1, -0.1);
  flour.rotation.y = 0.3;
  const flourLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshStandardMaterial({ map: labelTexture('FARINHA', { bg: '#f4ecdc', ink: '#c96b5a', w: 128, h: 64, font: 'bold 22px Georgia, serif' }) }));
  flourLabel.position.set(0, 0.02, 0.046);
  flour.add(flourLabel);
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.11, 14), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.45 }));
  jar.position.set(-0.86, COUNTER.h + 0.055, 0.12);
  const sprinkles = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 14), new THREE.MeshStandardMaterial({ map: canvasTexture(64, 32, (g, w, h) => {
    const rr2 = rng(4);
    g.fillStyle = '#fff6ea'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 120; k++) { g.fillStyle = cupCols[k % 5]; g.fillRect(rr2() * w, rr2() * h, 3, 1.5); }
  }, { repeat: false }) }));
  sprinkles.position.set(-0.86, COUNTER.h + 0.04, 0.12);
  const recipe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.18), new THREE.MeshStandardMaterial({ map: labelTexture('Bolo de 3 andares', { bg: '#fbf8f0', ink: '#7a4a2a', w: 256, h: 160, font: 'italic 24px Georgia, serif' }) }));
  recipe.position.set(-1.12, COUNTER.h + 0.006, 0.05);
  recipe.rotation.y = -0.15;
  counter.add(bowl, batter, whisk, flour, jar, sprinkles, recipe);
  counter.position.set((COUNTER.x0 + COUNTER.x1) / 2, FLOOR_Y, COUNTER.z);
  counter.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(counter);
  // armários de cima (dos lados da janela) com prateleira de potes
  for (const x of [COUNTER.x0 + 0.38, COUNTER.x1 - 0.38]) {
    const up = new THREE.Mesh(rbox(0.72, 0.62, 0.34, 0.02), cab);
    up.position.set(x, 2.05, zN + 0.18);
    up.castShadow = true;
    walls.add(up);
    for (const s of [-1, 1]) {
      const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), brassMat());
      pull.position.set(x + s * 0.06, 1.82, zN + 0.36);
      walls.add(pull);
    }
  }
  const pendantPos = new THREE.Vector3(KITCHEN_TABLE.x, 1.9, KITCHEN_TABLE.z);

  // ---- geladeira retrô creme com o desenho e os ímãs
  const fridge = new THREE.Group();
  const fBody = new THREE.Mesh(rbox(FRIDGE.hx * 2, FRIDGE.h, FRIDGE.hz * 2, 0.08), stdMat('#f3e6c8', { roughness: 0.35 }));
  fBody.position.y = FRIDGE.h / 2;
  fridge.add(fBody);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(FRIDGE.hx * 2 - 0.04, 0.012, 0.01), stdMat('#c8b898'));
  seam.position.set(0, 1.25, FRIDGE.hz + 0.002);
  fridge.add(seam);
  for (const y of [1.45, 0.9]) {
    const handle = new THREE.Mesh(rbox(0.03, 0.22, 0.04, 0.012), stdMat('#d8dce0', { metalness: 0.9, roughness: 0.2 }));
    handle.position.set(-FRIDGE.hx + 0.07, y, FRIDGE.hz + 0.03);
    fridge.add(handle);
  }
  const drawing = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), new THREE.MeshStandardMaterial({ map: drawingTexture(), roughness: 0.95 }));
  drawing.position.set(0.04, 0.85, FRIDGE.hz + 0.004);
  drawing.rotation.z = 0.06;
  fridge.add(drawing);
  for (const [x, y, c] of /** @type {[number, number, string][]} */ ([[0.13, 0.98, '#e8554a'], [-0.06, 0.74, '#f2c14e'], [0.16, 1.5, '#7cc4e8'], [-0.1, 1.62, '#9bd57a']])) {
    const mg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12).rotateX(Math.PI / 2), stdMat(c, { roughness: 0.4 }));
    mg.position.set(x, y, FRIDGE.hz + 0.008);
    fridge.add(mg);
  }
  fridge.position.set(FRIDGE.x, FLOOR_Y, FRIDGE.z);
  fridge.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(fridge);

  // ---- mesa da cozinha com toalha xadrez, pratinhos de festa e o pendente
  const kt = new THREE.Group();
  const gingham = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(214,80,90,0.5)';
    for (let k = 0; k < 4; k++) { g.fillRect(k * 16, 0, 8, h); g.fillRect(0, k * 16, w, 8); }
  });
  gingham.repeat.set(4, 3);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(KITCHEN_TABLE.hx * 2 + 0.12, 0.03, KITCHEN_TABLE.hz * 2 + 0.12), new THREE.MeshStandardMaterial({ map: gingham, roughness: 0.95 }));
  cloth.position.y = KITCHEN_TABLE.h - 0.01;
  const drape = new THREE.Mesh(new THREE.BoxGeometry(KITCHEN_TABLE.hx * 2 + 0.13, 0.16, KITCHEN_TABLE.hz * 2 + 0.13), new THREE.MeshStandardMaterial({ map: gingham, roughness: 0.95, side: THREE.DoubleSide }));
  drape.position.y = KITCHEN_TABLE.h - 0.09;
  kt.add(cloth, drape);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, KITCHEN_TABLE.h - 0.03, 8), woodMat('#c79a62', { key: 'f10-mesa-cozinha' }));
    leg.position.set(sx * (KITCHEN_TABLE.hx - 0.06), (KITCHEN_TABLE.h - 0.03) / 2, sz * (KITCHEN_TABLE.hz - 0.06));
    kt.add(leg);
  }
  const plateG = new THREE.CylinderGeometry(0.09, 0.075, 0.012, 20);
  for (let k = 0; k < 4; k++) {
    const pl = new THREE.Mesh(plateG, stdMat(cupCols[k], { roughness: 0.5 }));
    pl.position.set(-0.35 + (k % 2) * 0.7, KITCHEN_TABLE.h + 0.012, -0.22 + Math.floor(k / 2) * 0.44);
    kt.add(pl);
  }
  // pilha de chapeuzinhos de festa (enfeites, não o do bolo) e a jarra de suco
  for (let k = 0; k < 3; k++) {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 16, 1, true), stdMat(cupCols[k + 1], { roughness: 0.6, side: THREE.DoubleSide }));
    hat.position.set(0.02 + k * 0.012, KITCHEN_TABLE.h + 0.09 + k * 0.03, 0.0);
    kt.add(hat);
  }
  const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 16), new THREE.MeshPhysicalMaterial({ color: '#ffb07a', roughness: 0.05, transparent: true, opacity: 0.75 }));
  jug.position.set(0.32, KITCHEN_TABLE.h + 0.1, 0.05);
  kt.add(jug);
  kt.position.set(KITCHEN_TABLE.x, FLOOR_Y, KITCHEN_TABLE.z);
  kt.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(kt);
  // pendente de vidro âmbar sobre a mesa
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, northH - 2.05, 4), stdMat('#2d2a28'));
  cord.position.set(pendantPos.x, (northH + 2.05) / 2, pendantPos.z);
  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 12, 0, TAU, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#e8a050', emissive: '#ff9a3c', emissiveIntensity: 0.8, side: THREE.DoubleSide, roughness: 0.4 }));
  pendant.position.set(pendantPos.x, 2.05, pendantPos.z);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff0c8' }));
  bulb.position.set(pendantPos.x, 1.98, pendantPos.z);
  group.add(cord, pendant, bulb);
  // cadeiras de madeira pintada
  const chairMat = woodMat('#e8d0a8', { key: 'f10-cadeira' });
  KITCHEN_CHAIRS.forEach((c, i) => {
    const ch = new THREE.Group();
    const s = new THREE.Mesh(rbox(0.36, 0.04, 0.36, 0.015), chairMat);
    s.position.y = 0.45;
    ch.add(s);
    const bk = new THREE.Mesh(rbox(0.36, 0.4, 0.03, 0.012), chairMat);
    bk.position.set(0, 0.67, -0.17);
    ch.add(bk);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.45, 6), chairMat);
      leg.position.set(sx * 0.15, 0.225, sz * 0.15);
      ch.add(leg);
    }
    const pad = new THREE.Mesh(rbox(0.3, 0.035, 0.3, 0.015), stdMat(['#e8a0a8', '#8fc0d8', '#f2c14e'][i], { roughness: 1 }));
    pad.position.y = 0.485;
    ch.add(pad);
    ch.position.set(c.x, FLOOR_Y, c.z);
    ch.rotation.y = Math.atan2(KITCHEN_TABLE.x - c.x, KITCHEN_TABLE.z - c.z) + Math.PI;
    ch.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(ch);
  });

  // ---- tigelas das dogs no tapetinho, com os nomes
  const bowlMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1 });
  const placemat = new THREE.Mesh(rbox(0.62, 0.008, 0.36, 0.004), stdMat('#c96b5a', { roughness: 1 }));
  placemat.position.set(DOG_BOWLS.x, FLOOR_Y + 0.005, DOG_BOWLS.z);
  group.add(placemat);
  const nameTag = (txt, col) => canvasTexture(128, 32, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fffaf0'; g.font = 'bold 18px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, w / 2, h / 2 + 1);
  }, { repeat: false });
  for (const [dx, col, name] of /** @type {[number, string, string][]} */ ([[-0.15, '#e8a0a8', 'RADHIJA'], [0.15, '#8fc0d8', 'RHAENYRA']])) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.06, 20, 1, true), bowlMat(col));
    b.material.side = THREE.DoubleSide;
    b.position.set(DOG_BOWLS.x + dx, FLOOR_Y + 0.04, DOG_BOWLS.z);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20).rotateX(-Math.PI / 2), dx < 0 ? stdMat('#a06a3a', { roughness: 0.9 }) : new THREE.MeshPhysicalMaterial({ color: '#9cc8e8', roughness: 0.05, transparent: true, opacity: 0.8 }));
    inner.position.set(DOG_BOWLS.x + dx, FLOOR_Y + 0.045, DOG_BOWLS.z);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshStandardMaterial({ map: nameTag(name, col), roughness: 0.6 }));
    tag.position.set(DOG_BOWLS.x + dx, FLOOR_Y + 0.04, DOG_BOWLS.z + 0.103);
    tag.rotation.x = -0.1;
    b.castShadow = true;
    group.add(b, inner, tag);
  }

  // ---- quadro de luz (na divisória, do lado da cozinha) com a etiqueta "Luzes da festa"
  const panel = new THREE.Group();
  const pBox = new THREE.Mesh(rbox(0.04, 0.42, 0.34, 0.012), stdMat('#d8dcd6', { roughness: 0.5 }));
  pBox.position.set(0.02, 0, 0);
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.07), new THREE.MeshStandardMaterial({ map: labelTexture('Luzes da festa ✦', { w: 256, h: 60, font: 'bold 24px "Comic Sans MS", "Trebuchet MS", sans-serif' }), roughness: 0.9 }));
  lbl.rotation.y = Math.PI / 2;
  lbl.position.set(0.042, -0.27, 0);
  panel.add(pBox, lbl);
  panel.position.set(BREAKER.x + 0.0, BREAKER.top - 0.62 + 0.21, BREAKER.z + 0.3);
  panel.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(panel);
  const panelPos = new THREE.Vector3(BREAKER.x + 0.04, BREAKER.top + 0.05, BREAKER.z);

  root.add(group);
  return {
    group, walls, painting, paintingLights, lampPos, pendantPos, panelPos, balloon: three,
    update(dt, t) {
      paintingLights.update(dt, t);
      three.position.y = 1.35 + Math.sin(t * 1.1) * 0.03;
      three.rotation.y = Math.sin(t * 0.6) * 0.35;
      three.rotation.z = Math.sin(t * 0.8 + 1) * 0.06;
    },
  };
}
