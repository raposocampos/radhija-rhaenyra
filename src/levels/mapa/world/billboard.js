// PANDORÓPOLIS — o outdoor da campanha: a Amora, golden retriever dourada, para prefeita (Vote 1313). Desenhado em
// canvas (nada de imagem externa), virado para a câmera, em dois postes, com três refletores em cima.
// API: buildBillboard(kit, root, L) → { mesh, redraw() }
import * as THREE from 'three';
import { canvasTexture } from '../../../world/util.js';
import { rb, cyl, sphere } from './kit.js';

const FONT = '"Fredoka", "Nunito", system-ui, sans-serif';
const W = 1024, H = 512;

/** A arte do outdoor (o retrato da Amora à esquerda, o slogan à direita). */
function drawBillboard(g) {
  g.clearRect(0, 0, W, H);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2e6fb8');
  bg.addColorStop(1, '#1d4e8c');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const star = (x, y, r) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };
  g.fillStyle = 'rgba(255,255,255,.18)';
  for (const [x, y, r] of [[500, 52, 16], [990, 64, 12], [470, 290, 10], [960, 300, 14], [860, 30, 9]]) star(x, y, r);
  g.fillStyle = '#ffc94a';
  g.beginPath(); g.moveTo(380, H); g.lineTo(W, 340); g.lineTo(W, H); g.closePath(); g.fill();

  // retrato da Amora
  const ell = (x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
  const cx = 228, cy = 256, R = 206;
  g.save();
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = '#ffe7b8'; g.fill(); g.clip();
  g.fillStyle = '#e3a54a'; ell(cx, cy + 210, 170, 120); g.fill(); // peito
  g.fillStyle = '#f4d08c'; ell(cx, cy + 196, 92, 82); g.fill();
  g.fillStyle = '#b8792c'; ell(cx - 106, cy + 8, 52, 98, 0.32); g.fill(); ell(cx + 106, cy + 8, 52, 98, -0.32); g.fill(); // orelhas
  g.fillStyle = '#e3a54a'; ell(cx, cy - 26, 112, 118); g.fill(); // cabeça
  g.fillStyle = '#ecbb62'; ell(cx, cy - 78, 62, 44); g.fill();
  g.fillStyle = '#f4d08c'; ell(cx, cy + 44, 76, 57); g.fill(); // focinho
  g.fillStyle = '#ee7c98'; ell(cx, cy + 92, 24, 30); g.fill(); // língua
  g.strokeStyle = '#c9506e'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(cx, cy + 78); g.lineTo(cx, cy + 110); g.stroke();
  g.strokeStyle = '#4a2a1a'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy + 34); g.lineTo(cx, cy + 58); g.stroke();
  g.beginPath(); g.moveTo(cx, cy + 58); g.quadraticCurveTo(cx - 22, cy + 80, cx - 48, cy + 60); g.stroke();
  g.beginPath(); g.moveTo(cx, cy + 58); g.quadraticCurveTo(cx + 22, cy + 80, cx + 48, cy + 60); g.stroke();
  g.fillStyle = '#2b1c14'; // nariz
  g.beginPath(); g.moveTo(cx - 31, cy + 12); g.quadraticCurveTo(cx, cy + 2, cx + 31, cy + 12);
  g.quadraticCurveTo(cx + 27, cy + 40, cx, cy + 44); g.quadraticCurveTo(cx - 27, cy + 40, cx - 31, cy + 12); g.fill();
  g.fillStyle = 'rgba(255,255,255,.4)'; ell(cx - 11, cy + 15, 9, 5); g.fill();
  for (const s of [-1, 1]) { // olhos e sobrancelhas
    g.fillStyle = '#2b1c14'; ell(cx + s * 45, cy - 30, 15, 17); g.fill();
    g.fillStyle = '#ffffff'; ell(cx + s * 45 - 5, cy - 36, 5, 5); g.fill();
    g.strokeStyle = '#b8792c'; g.lineWidth = 6;
    g.beginPath(); g.arc(cx + s * 45, cy - 48, 18, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  }
  g.fillStyle = '#d93a3a'; // gravatinha de candidata
  g.beginPath(); g.moveTo(cx, cy + 168); g.lineTo(cx - 52, cy + 140); g.lineTo(cx - 52, cy + 196); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(cx, cy + 168); g.lineTo(cx + 52, cy + 140); g.lineTo(cx + 52, cy + 196); g.closePath(); g.fill();
  g.fillStyle = '#b02a2a'; ell(cx, cy + 168, 14, 16); g.fill();
  g.restore();
  g.lineWidth = 12; g.strokeStyle = '#ffffff';
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();

  // slogan
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const txt = (t, x, y, size, fill, lw = size * 0.16, weight = 700) => {
    g.font = `${weight} ${size}px ${FONT}`;
    if (lw) { g.lineWidth = lw; g.strokeStyle = '#2a1a10'; g.strokeText(t, x, y); }
    g.fillStyle = fill;
    g.fillText(t, x, y);
  };
  txt('AMORA', 728, 148, 124, '#ffffff');
  txt('PARA PREFEITA', 728, 210, 48, '#ffc94a');
  g.fillStyle = '#ffffff';
  g.beginPath();
  if (g.roundRect) g.roundRect(530, 236, 396, 124, 28); else g.rect(530, 236, 396, 124);
  g.fill();
  g.lineWidth = 8; g.strokeStyle = '#2a1a10'; g.stroke();
  txt('VOTE', 628, 318, 54, '#2a1a10', 0);
  txt('1313', 812, 336, 104, '#e8577a', 9);
  g.font = `600 28px ${FONT}`;
  g.fillStyle = '#2a1a10';
  g.fillText('Mais petiscos e parques para todos!', 738, 486);
}

/**
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../types').LevelLayout} L
 */
export function buildBillboard(kit, root, L) {
  const Bb = L.TOWN.billboard;
  const w = Bb.w, h = w / 2;
  const yaw = Math.PI / 4; // de frente para a câmera (sudeste)
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, lz) => ({ x: Bb.x + lx * c + lz * s, z: Bb.z - lx * s + lz * c });
  const bottom = 2.25;
  for (const k of [-1, 1]) {
    const p = at(k * 2.9, -0.22);
    kit.add(rb(0.26, bottom + 0.4, 0.26, 0.04, 1), { color: '#8e5a33', ...p, ry: yaw });
  }
  kit.add(rb(w + 0.3, h + 0.3, 0.18, 0.05, 1), { color: '#3a2719', ...at(0, -0.1), y: bottom - 0.15, ry: yaw });
  kit.add(rb(w + 0.1, 0.1, 0.5, 0.03, 1), { color: '#4a3426', ...at(0, 0.12), y: bottom - 0.2, ry: yaw });
  // refletores
  for (const k of [-2.2, 0, 2.2]) {
    const p = at(k, 0.55);
    kit.add(cyl(0.025, 0.025, 0.55, 6).rotateX(Math.PI / 2 - 0.3), { color: '#3a3a40', ...at(k, 0.3), y: bottom + h + 0.12, ry: yaw });
    kit.add(sphere(0.12, 10, 8), { color: '#fff0c0', slot: 'lit', ...p, y: bottom + h + 0.2 });
  }
  const tex = canvasTexture(W, H, drawBillboard, { repeat: false });
  tex.anisotropy = 8;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.18 }));
  face.name = 'mapa:outdoor';
  const fp = at(0, 0.005);
  face.position.set(fp.x, bottom + h / 2, fp.z);
  face.rotation.y = yaw;
  face.receiveShadow = true;
  root.add(face);
  return {
    mesh: face,
    redraw() {
      const g = tex.image?.getContext?.('2d');
      if (!g) return;
      drawBillboard(g);
      tex.needsUpdate = true;
    },
  };
}
