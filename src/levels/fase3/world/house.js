// FASE 3 · Fachada térrea do condomínio à noite: apartamento (zona A) com porta de vidro de correr
// e sala acesa por trás (interior com profundidade), deck de madeira, janelas acesas com jardineiras,
// arandelas e o salão do condomínio (zona B). Andar de cima com varandas e janelas acesas.
import * as THREE from 'three';
import { plasterMat, woodMat, stdMat, brassMat, ironMat, rbox, canvasTexture, mat, rng, foliageCluster, paint } from '../../../world/util.js';
import { lavender, geranium, smallFlowers } from '../../../world/plants.js';
import { DECK } from './ground.js';

const WALL_H = 3.0;

function interiorWallTexture(seed, { lamp = 0.4, art = true, shelf = true } = {}) {
  return canvasTexture(512, 400, (g, w, h) => {
    const r = rng(seed);
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#6a3f22'); grd.addColorStop(0.5, '#c27a44'); grd.addColorStop(1, '#7a4a2a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const lx = w * lamp, ly = h * 0.42;
    const rg = g.createRadialGradient(lx, ly, 6, lx, ly, w * 0.75);
    rg.addColorStop(0, 'rgba(255,226,170,1)'); rg.addColorStop(0.3, 'rgba(255,180,100,0.55)'); rg.addColorStop(1, 'rgba(255,150,70,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    if (art) {
      g.fillStyle = 'rgba(60,35,20,0.85)'; g.fillRect(w * 0.58, h * 0.16, w * 0.24, h * 0.22);
      g.fillStyle = 'rgba(120,150,170,0.9)'; g.fillRect(w * 0.6, h * 0.18, w * 0.2, h * 0.18);
      g.fillStyle = 'rgba(240,200,120,0.9)'; g.beginPath(); g.arc(w * 0.66, h * 0.24, 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(70,100,70,0.9)'; g.beginPath(); g.moveTo(w * 0.6, h * 0.36); g.lineTo(w * 0.7, h * 0.27); g.lineTo(w * 0.8, h * 0.36); g.fill();
    }
    if (shelf) {
      g.fillStyle = 'rgba(55,32,18,0.9)'; g.fillRect(w * 0.06, h * 0.3, w * 0.3, h * 0.025); g.fillRect(w * 0.06, h * 0.45, w * 0.3, h * 0.025);
      for (let i = 0; i < 9; i++) {
        g.fillStyle = ['#8e3b2c', '#3e5f7a', '#d6b46a', '#4d6b3a', '#e7dcc6'][Math.floor(r() * 5)];
        g.fillRect(w * 0.07 + i * 16, h * 0.3 - 30 - r() * 12, 12, 30 + r() * 12);
      }
    }
    // sofá
    g.fillStyle = 'rgba(60,70,95,0.95)';
    g.beginPath(); g.roundRect(w * 0.2, h * 0.66, w * 0.6, h * 0.2, 18); g.fill();
    g.fillStyle = 'rgba(80,92,120,0.95)';
    g.beginPath(); g.roundRect(w * 0.16, h * 0.74, w * 0.68, h * 0.16, 16); g.fill();
    g.fillStyle = 'rgba(230,170,90,0.95)'; g.beginPath(); g.roundRect(w * 0.27, h * 0.68, w * 0.1, h * 0.08, 8); g.fill();
    g.fillStyle = 'rgba(200,90,80,0.95)'; g.beginPath(); g.roundRect(w * 0.62, h * 0.69, w * 0.09, h * 0.07, 8); g.fill();
    // rodapé
    g.fillStyle = 'rgba(40,24,14,0.9)'; g.fillRect(0, h * 0.96, w, h * 0.04);
  }, { repeat: false });
}
function floorTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#a0643a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = 'rgba(60,30,15,0.35)'; g.fillRect(0, y, w, 2);
      const off = (y / 32) % 2 ? 60 : 0;
      for (let x = off; x < w; x += 120) g.fillRect(x, y, 2, 32);
    }
    // tapete
    g.fillStyle = 'rgba(200,170,130,0.9)'; g.beginPath(); g.ellipse(w * 0.5, h * 0.5, w * 0.36, h * 0.26, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(150,80,60,0.9)'; g.lineWidth = 6; g.beginPath(); g.ellipse(w * 0.5, h * 0.5, w * 0.3, h * 0.2, 0, 0, Math.PI * 2); g.stroke();
  }, { repeat: false });
}
function windowInteriorTexture(seed, cool = false) {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(seed);
    const grd = g.createLinearGradient(0, 0, 0, h);
    if (cool) { grd.addColorStop(0, '#1a2440'); grd.addColorStop(0.5, '#3a5a8a'); grd.addColorStop(1, '#1c2a44'); }
    else { grd.addColorStop(0, '#4a2c1a'); grd.addColorStop(0.45, '#b26a3a'); grd.addColorStop(1, '#5b3520'); }
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const lx = w * (0.3 + r() * 0.4), ly = h * 0.4;
    const rg = g.createRadialGradient(lx, ly, 4, lx, ly, w * 0.8);
    rg.addColorStop(0, cool ? 'rgba(170,200,255,0.9)' : 'rgba(255,220,160,1)');
    rg.addColorStop(0.3, cool ? 'rgba(90,130,220,0.4)' : 'rgba(255,170,90,0.5)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    for (const side of [0, 1]) {
      const x0 = side ? w * 0.78 : 0, x1 = side ? w : w * 0.22;
      for (let x = x0; x < x1; x++) {
        const f = 0.7 + 0.3 * Math.sin((x - x0) * 0.35 + side);
        g.fillStyle = cool ? `rgba(${150 * f | 0},${170 * f | 0},${210 * f | 0},0.9)` : `rgba(${250 * f | 0},${215 * f | 0},${170 * f | 0},0.92)`;
        g.fillRect(x, 0, 1, h);
      }
    }
    g.fillStyle = 'rgba(40,30,20,0.6)';
    for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(w * 0.5 + (r() - 0.5) * 40, h * 0.85 - r() * 36, 8 + r() * 10, 12 + r() * 10, r() * 3, 0, Math.PI * 2); g.fill(); }
  });
}

function makeWindow({ w, h, seed, cool = false, intensity = 1.4, box = true }) {
  const grp = new THREE.Group();
  const frameMat = woodMat('#e9e0d0', { key: 'f3-win-frame', rough: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#2a2018', emissive: '#ffffff', emissiveMap: windowInteriorTexture(seed, cool), emissiveIntensity: intensity, roughness: 0.08,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), glassMat);
  glass.position.z = -0.08;
  grp.add(glass);
  const t = 0.06;
  for (const [a, b, c, x, y] of [[w, t, 0.08, 0, h / 2 - t / 2], [w, t, 0.08, 0, -h / 2 + t / 2], [t, h, 0.08, -w / 2 + t / 2, 0], [t, h, 0.08, w / 2 - t / 2, 0], [0.035, h, 0.05, 0, 0], [w, 0.035, 0.05, 0, h * 0.15]]) {
    const m = new THREE.Mesh(rbox(a, b, c, 0.01), frameMat);
    m.position.set(x, y, -0.06);
    grp.add(m);
  }
  const sill = new THREE.Mesh(rbox(w + 0.18, 0.05, 0.18, 0.02), stdMat('#cfc3ae', { roughness: 0.85 }));
  sill.position.set(0, -h / 2 - 0.023, 0.03); // topo 2 mm acima do fundo do vão (sem z-fighting)
  grp.add(sill);
  if (box) {
    // jardineira (acima da altura das dogs)
    const bx = new THREE.Mesh(rbox(w + 0.1, 0.16, 0.2, 0.03), woodMat('#6f4b33', { key: 'f3-planter', rough: 0.8 }));
    bx.position.set(0, -h / 2 - 0.15, 0.12);
    grp.add(bx);
    const r = rng(seed * 3);
    const n = Math.max(3, Math.round(w / 0.22));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * (w / n);
      const geo = i % 3 === 1 ? lavender({ seed: seed * 10 + i, height: 0.26, spread: 0.08, stems: 16 })
        : geranium({ seed: seed * 10 + i, radius: 0.1, height: 0.1, flower: r() < 0.5 ? '#ff6a7a' : '#ffffff' });
      const pl = new THREE.Mesh(geo, mat('f3-house-plant', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })));
      pl.position.set(x, -h / 2 - 0.085, 0.12); // base enterrada na jardineira (nenhuma face no plano do topo dela nem do peitoril)
      grp.add(pl);
    }
  }
  return { group: grp, glassMat };
}

function sconce() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(rbox(0.08, 0.16, 0.03, 0.01), ironMat());
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6).rotateX(Math.PI / 2), ironMat());
  arm.position.set(0, 0.03, 0.06);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffb45e', emissiveIntensity: 3.2, roughness: 0.3 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.14, 6), glowMat);
  glass.position.set(0, -0.0, 0.13);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.06, 6), ironMat());
  cap.position.set(0, 0.1, 0.13);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.025, 6), ironMat());
  base.position.set(0, -0.08, 0.13);
  g.add(back, arm, glass, cap, base);
  return { group: g, glowMat };
}

export function buildHouse(layout) {
  const group = new THREE.Group();
  group.name = 'fachada';
  const Z = layout.WORLD.houseWallZ;
  const D = layout.GLASS_DOOR;
  const dH = D.height, dW = D.width;
  const dL = D.x - dW / 2, dR = D.x + dW / 2;
  const x0 = -8.2, xMid = -2.0, x1 = 8.4;

  // ------------------------------------------------ parede do apartamento (zona A) com vãos
  const winA = { x: -3.0, y: 1.6, w: 0.95, h: 1.05 };
  const winA2 = { x: -7.1, y: 1.6, w: 0.8, h: 1.05 };
  const shape = new THREE.Shape();
  shape.moveTo(x0, 0); shape.lineTo(dL - 0.06, 0); shape.lineTo(dL - 0.06, dH + 0.06); shape.lineTo(dR + 0.06, dH + 0.06);
  shape.lineTo(dR + 0.06, 0); shape.lineTo(xMid, 0); shape.lineTo(xMid, WALL_H); shape.lineTo(x0, WALL_H); shape.lineTo(x0, 0);
  for (const wd of [winA, winA2]) {
    const hole = new THREE.Path();
    hole.moveTo(wd.x - wd.w / 2, wd.y - wd.h / 2); hole.lineTo(wd.x + wd.w / 2, wd.y - wd.h / 2);
    hole.lineTo(wd.x + wd.w / 2, wd.y + wd.h / 2); hole.lineTo(wd.x - wd.w / 2, wd.y + wd.h / 2); hole.closePath();
    shape.holes.push(hole);
  }
  const depth = 0.3;
  const wallGeo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  wallGeo.translate(0, 0, Z - depth);
  const wall = new THREE.Mesh(wallGeo, plasterMat('#e8c7a6'));
  group.add(wall);
  // salão do condomínio (zona B): reboco mais claro com rodapé de pedra
  const hallW = x1 - xMid;
  const hall = new THREE.Mesh(new THREE.BoxGeometry(hallW, WALL_H, 0.3), plasterMat('#dcd2c2'));
  hall.position.set(xMid + hallW / 2, WALL_H / 2, Z - 0.15);
  group.add(hall);
  const pil = new THREE.Mesh(rbox(0.3, WALL_H + 0.3, 0.12, 0.03), plasterMat('#efe3cf'));
  pil.position.set(xMid, (WALL_H + 0.3) / 2, Z + 0.04);
  group.add(pil);
  const skirtMat = stdMat('#8f8173', { roughness: 0.9 });
  for (const [a, b] of [[x0, dL - 0.14], [dR + 0.14, x1]]) {
    const m = new THREE.Mesh(rbox(b - a, 0.3, 0.05, 0.015), skirtMat);
    m.position.set((a + b) / 2, 0.15, Z + 0.02);
    group.add(m);
  }

  // ------------------------------------------------ sala por trás da porta de vidro (profundidade)
  const room = new THREE.Group();
  const rw = dW + 0.9, rd = 2.2, rh = 2.5;
  const rz0 = Z - depth;
  const backTex = interiorWallTexture(4, { lamp: 0.3 });
  const sideTex = interiorWallTexture(9, { lamp: 0.8, art: false });
  const interiorMats = {
    back: new THREE.MeshBasicMaterial({ map: backTex, color: '#ffffff' }),
    side: new THREE.MeshBasicMaterial({ map: sideTex, color: '#e8d8c8' }),
    floor: new THREE.MeshBasicMaterial({ map: floorTexture(), color: '#d8b090' }),
    ceil: new THREE.MeshBasicMaterial({ color: '#c9925e' }),
  };
  const back = new THREE.Mesh(new THREE.PlaneGeometry(rw, rh), interiorMats.back);
  back.position.set(D.x, rh / 2, rz0 - rd);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(rd, rh), interiorMats.side);
  left.rotation.y = Math.PI / 2; left.position.set(D.x - rw / 2, rh / 2, rz0 - rd / 2);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(rd, rh), interiorMats.side);
  right.rotation.y = -Math.PI / 2; right.position.set(D.x + rw / 2, rh / 2, rz0 - rd / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd).rotateX(-Math.PI / 2), interiorMats.floor);
  floor.position.set(D.x, 0.002, rz0 - rd / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd).rotateX(Math.PI / 2), interiorMats.ceil);
  ceil.position.set(D.x, rh, rz0 - rd / 2);
  room.add(back, left, right, floor, ceil);
  // luminária de pé e planta dentro da sala
  const lampShadeMat = new THREE.MeshStandardMaterial({ color: '#fff0d0', emissive: '#ffc77a', emissiveIntensity: 2.4 });
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 6), stdMat('#2a2420'));
  lampPole.position.set(D.x - 0.55, 0.7, rz0 - 1.3);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.24, 16, 1, true), lampShadeMat);
  shade.position.set(D.x - 0.55, 1.45, rz0 - 1.3);
  room.add(lampPole, shade);
  const plantPot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.3, 14), stdMat('#c9764f'));
  plantPot.position.set(D.x + 0.6, 0.15, rz0 - 0.7);
  const plant = new THREE.Mesh(foliageCluster([{ x: 0, y: 0.5, z: 0, r: 0.25 }, { x: 0.1, y: 0.75, z: 0.05, r: 0.18 }], { detail: 2, amp: 0.3, freq: 5, seed: 3, dark: '#2c3f20', mid: '#4f6b30', light: '#7f9a48' }),
    new THREE.MeshBasicMaterial({ vertexColors: true, color: '#c8b090' }));
  plant.position.set(D.x + 0.6, 0, rz0 - 0.7);
  room.add(plantPot, plant);
  group.add(room);

  // ------------------------------------------------ porta de vidro de correr (2 folhas; a da direita entreaberta)
  const alu = stdMat('#3a3634', { roughness: 0.4, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#cfe0e8', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false,
  });
  const doorGroup = new THREE.Group();
  const panelW = dW / 2 + 0.03;
  const glowFrame = new THREE.MeshStandardMaterial({ color: '#3a3634', emissive: '#ffb062', emissiveIntensity: 0, roughness: 0.4, metalness: 0.5 });
  for (const [cx, cz] of [[dL + panelW / 2, Z - 0.2], [dR - panelW / 2 + 0.0, Z - 0.12]]) {
    const pnl = new THREE.Group();
    pnl.position.set(cx, 0, cz);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.08, dH - 0.1), glassMat);
    gl.position.y = dH / 2;
    gl.renderOrder = 2;
    pnl.add(gl);
    for (const [a, b, x, y] of [[panelW, 0.05, 0, 0.025], [panelW, 0.05, 0, dH - 0.025], [0.05, dH, -panelW / 2 + 0.025, dH / 2], [0.05, dH, panelW / 2 - 0.025, dH / 2]]) {
      const f = new THREE.Mesh(rbox(a, b, 0.045, 0.008), glowFrame);
      f.position.set(x, y, 0);
      pnl.add(f);
    }
    const handle = new THREE.Mesh(rbox(0.02, 0.28, 0.03, 0.008), brassMat());
    handle.position.set(cx < D.x ? panelW / 2 - 0.08 : -panelW / 2 + 0.08, 1.0, 0.04);
    pnl.add(handle);
    doorGroup.add(pnl);
  }
  group.add(doorGroup);
  // batente e soleira
  for (const [a, b, x, y] of [[0.1, dH + 0.12, dL - 0.05, (dH + 0.12) / 2], [0.1, dH + 0.12, dR + 0.05, (dH + 0.12) / 2], [dW + 0.2, 0.12, D.x, dH + 0.06]]) {
    const m = new THREE.Mesh(rbox(a, b, 0.09, 0.012), alu);
    m.position.set(x, y, Z + 0.02);
    group.add(m);
  }
  const sill = new THREE.Mesh(rbox(dW + 0.3, 0.03, 0.18, 0.01), stdMat('#bdb2a0', { roughness: 0.85 }));
  sill.position.set(D.x, 0.015, Z + 0.06);
  group.add(sill);
  // toldo de lona listrado sobre a porta
  {
    const awnTex = canvasTexture(256, 64, (g, w, h) => {
      for (let x = 0; x < w; x += 32) { g.fillStyle = '#2f5d6b'; g.fillRect(x, 0, 16, h); g.fillStyle = '#efe6d2'; g.fillRect(x + 16, 0, 16, h); }
    });
    awnTex.repeat.set(3, 1);
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(dW + 0.7, 0.7, 1, 1), new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.9, side: THREE.DoubleSide }));
    awn.rotation.x = -Math.PI / 2 + 0.55;
    awn.position.set(D.x, dH + 0.42 - Math.sin(0.55) * 0.35, Z + Math.cos(0.55) * 0.35);
    group.add(awn);
    // franja recortada
    const fr = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.065, 10, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ color: i % 2 ? '#efe6d2' : '#2f5d6b', roughness: 0.9, side: THREE.DoubleSide }));
      s.position.set(dL - 0.35 + (i + 0.5) * ((dW + 0.7) / 12), 0, 0);
      fr.add(s);
    }
    fr.position.set(0, dH + 0.42 - Math.sin(0.55) * 0.7, Z + Math.cos(0.55) * 0.7);
    group.add(fr);
  }

  // ------------------------------------------------ arandelas ao lado da porta e do salão
  const sconces = [];
  for (const [x, y] of [[dL - 0.4, 1.95], [dR + 0.4, 1.95], [1.3, 2.1], [4.6, 2.1]]) {
    const s = sconce();
    s.group.position.set(x, y, Z + 0.01);
    group.add(s.group);
    sconces.push(s);
  }

  // ------------------------------------------------ janelas acesas
  const windows = [];
  for (const [wd, seed, cool] of /** @type {[{ x: number, y: number, w: number, h: number }, number, boolean][]} */ ([[winA, 2, false], [winA2, 6, false]])) {
    const w = makeWindow({ w: wd.w, h: wd.h, seed, cool });
    w.group.position.set(wd.x, wd.y, Z);
    group.add(w.group);
    windows.push(w);
  }
  // salão: janelões com caixilhos (um quente, um azulado de TV)
  for (const [x, seed, cool] of /** @type {[number, number, boolean][]} */ ([[0.4, 11, false], [2.9, 12, false], [5.9, 13, true]])) {
    const w = makeWindow({ w: 1.3, h: 1.25, seed, cool, intensity: cool ? 0.9 : 1.3, box: !cool });
    w.group.position.set(x, 1.55, Z + 0.09);
    group.add(w.group);
    windows.push(w);
  }

  // ------------------------------------------------ laje, beiral e andar de cima (varandas e janelas)
  {
    const slab = new THREE.Mesh(rbox(x1 - x0 + 0.2, 0.22, 0.9, 0.03), stdMat('#d6cbbb', { roughness: 0.85 }));
    slab.position.set((x0 + x1) / 2, WALL_H + 0.08, Z + 0.3);
    group.add(slab);
    const up = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 6.0, 0.4), plasterMat('#d9c9b6'));
    up.position.set((x0 + x1) / 2, WALL_H + 3.2, Z - 0.35);
    group.add(up);
    const railMat = stdMat('#2d2a2a', { roughness: 0.5, metalness: 0.5 });
    const r = rng(5);
    for (let fl = 0; fl < 2; fl++) {
      const y = WALL_H + 0.3 + fl * 3.0;
      for (let x = x0 + 1.0; x < x1 - 0.6; x += 2.3) {
        const lit = r() < 0.55;
        const w = makeWindow({ w: 1.1, h: 1.5, seed: 30 + fl * 10 + Math.round(x), cool: r() < 0.25, intensity: lit ? 1.25 : 0.12, box: false });
        w.group.position.set(x, y + 1.1, Z - 0.06);
        group.add(w.group);
        // guarda-corpo de varanda
        const bar = new THREE.Mesh(rbox(1.5, 0.04, 0.04, 0.01), railMat);
        bar.position.set(x, y + 0.95, Z + 0.68);
        group.add(bar);
        for (let k = 0; k <= 10; k++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.9, 0.015), railMat);
          b.position.set(x - 0.75 + k * 0.15, y + 0.5, Z + 0.68);
          group.add(b);
        }
      }
    }
    const top = new THREE.Mesh(rbox(x1 - x0 + 0.3, 0.4, 0.7, 0.04), stdMat('#cdbfac', { roughness: 0.85 }));
    top.position.set((x0 + x1) / 2, WALL_H + 6.3, Z - 0.25);
    group.add(top);
  }

  // ------------------------------------------------ deck de madeira em frente à porta (rente ao chão)
  {
    const deck = new THREE.Group();
    deck.name = 'deck';
    const dMat = woodMat('#8a6343', { key: 'f3-deck', rough: 0.66 });
    const dMat2 = woodMat('#7a5539', { key: 'f3-deck2', rough: 0.7 });
    const r = rng(41);
    const bw = 0.14;
    for (let z = DECK.z0 + 0.02 + bw / 2; z < DECK.z1; z += bw + 0.012) {
      // tábuas em comprimentos variados
      let x = DECK.x0 - 0.3;
      while (x < DECK.x1) {
        const len = Math.min(DECK.x1 - x, 1.2 + r() * 1.4);
        const b = new THREE.Mesh(rbox(len - 0.01, 0.028, bw, 0.006), r() < 0.5 ? dMat : dMat2);
        b.position.set(x + len / 2, 0.012, z);
        b.rotation.y = (r() - 0.5) * 0.004;
        deck.add(b);
        x += len;
      }
    }
    // borda
    const edge = new THREE.Mesh(rbox(DECK.x1 - DECK.x0 + 0.3, 0.04, 0.08, 0.01), dMat2);
    edge.position.set((DECK.x0 + DECK.x1) / 2 - 0.15, 0.014, DECK.z1 + 0.02);
    const edgeE = new THREE.Mesh(rbox(0.08, 0.04, DECK.z1 - DECK.z0, 0.01), dMat2);
    edgeE.position.set(DECK.x1 + 0.02, 0.014, (DECK.z0 + DECK.z1) / 2);
    deck.add(edge, edgeE);
    // capacho com patinha
    const matTex = canvasTexture(256, 160, (g, w, h) => {
      g.fillStyle = '#9a7240'; g.fillRect(0, 0, w, h);
      const rr = rng(4);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rr() < 0.5 ? '70,45,20' : '210,175,110'},${0.15 + rr() * 0.2})`; g.fillRect(rr() * w, rr() * h, 1, 2 + rr() * 3); }
      g.strokeStyle = 'rgba(60,38,18,0.8)'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = 'rgba(70,42,20,0.8)';
      const cx = w / 2, cy = h / 2 + 8;
      g.beginPath(); g.ellipse(cx, cy + 6, 22, 18, 0, 0, Math.PI * 2); g.fill();
      for (const [dx, dy] of [[-26, -18], [-9, -32], [9, -32], [26, -18]]) { g.beginPath(); g.ellipse(cx + dx, cy + dy, 8, 10, dx * 0.02, 0, Math.PI * 2); g.fill(); }
    }, { repeat: false });
    const matMesh = new THREE.Mesh(rbox(0.9, 0.016, 0.56, 0.008), new THREE.MeshStandardMaterial({ map: matTex, roughness: 1 }));
    matMesh.position.set(D.x, 0.034, Z + 0.5);
    deck.add(matMesh);
    deck.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
    group.add(deck);
  }

  group.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  return { group, interiorMats, lampShadeMat, glowFrame, sconces, windows };
}
