// Fachada da casa (z = -4.8): reboco pêssego com rodapé, porta verde-sálvia com batente e maçaneta de latão,
// arandela acesa, janelas com brilho quente, beiral de telhas, capacho com chinelos. A leste: muro creme do condomínio.
import * as THREE from 'three';
import {
  plasterMat, woodMat, stdMat, brassMat, ironMat, rbox, canvasTexture, mat, shadowAll, rng, mergeGeometries,
} from './util.js';

const WALL_H = 3.0;

function windowInteriorTexture(seed) {
  return canvasTexture(256, 320, (g, w, h) => {
    const r = rng(seed);
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#4a2c1a'); grd.addColorStop(0.45, '#a8643a'); grd.addColorStop(1, '#5b3520');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // luminária interna
    const lx = w * (0.35 + r() * 0.3), ly = h * 0.38;
    const rg = g.createRadialGradient(lx, ly, 4, lx, ly, w * 0.8);
    rg.addColorStop(0, 'rgba(255,214,150,1)'); rg.addColorStop(0.25, 'rgba(255,170,90,0.55)'); rg.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    // estante / quadro escuros
    g.fillStyle = 'rgba(60,35,20,0.55)';
    g.fillRect(w * 0.08, h * 0.62, w * 0.5, h * 0.05);
    g.fillRect(w * 0.62, h * 0.18, w * 0.22, h * 0.16);
    // cortinas de linho nas laterais (dobras)
    for (const side of [0, 1]) {
      const x0 = side ? w * 0.8 : 0, x1 = side ? w : w * 0.2;
      for (let x = x0; x < x1; x++) {
        const f = 0.75 + 0.25 * Math.sin((x - x0) * 0.35 + side);
        g.fillStyle = `rgba(${248 * f | 0},${226 * f | 0},${196 * f | 0},0.92)`;
        g.fillRect(x, 0, 1, h);
      }
    }
    // planta no peitoril
    g.fillStyle = 'rgba(40,55,25,0.85)';
    for (let i = 0; i < 9; i++) {
      g.beginPath(); g.ellipse(w * 0.5 + (r() - 0.5) * 40, h * 0.86 - r() * 40, 8 + r() * 10, 14 + r() * 10, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(150,80,50,0.95)'; g.fillRect(w * 0.44, h * 0.86, w * 0.12, h * 0.1);
  });
}

function makeWindow({ w, h, seed, shutters = '#86a58a' }) {
  const grp = new THREE.Group();
  const frameMat = woodMat('#f1e6d2', { key: 'win-frame', rough: 0.6 });
  const tex = windowInteriorTexture(seed);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshStandardMaterial({
    color: '#3a2a20', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 1.25, roughness: 0.08, metalness: 0.0,
    envMapIntensity: 1.6,
  }));
  glass.position.z = -0.1;
  grp.add(glass);
  // caixilho
  const t = 0.06;
  const parts = [
    [w, t, 0.08, 0, h / 2 - t / 2], [w, t, 0.08, 0, -h / 2 + t / 2],
    [t, h, 0.08, -w / 2 + t / 2, 0], [t, h, 0.08, w / 2 - t / 2, 0],
    [0.035, h, 0.05, 0, 0], [w, 0.035, 0.05, 0, h * 0.12],
  ];
  for (const [a, b, c, x, y] of parts) {
    const m = new THREE.Mesh(rbox(a, b, c, 0.01), frameMat);
    m.position.set(x, y, -0.08);
    grp.add(m);
  }
  // peitoril de pedra
  const sill = new THREE.Mesh(rbox(w + 0.2, 0.06, 0.2, 0.02), stdMat('#d9cbb5', { roughness: 0.85 }));
  sill.position.set(0, -h / 2 - 0.03, 0.02);
  grp.add(sill);
  // venezianas
  if (shutters) {
    const shMat = woodMat(shutters, { key: 'shutter-' + shutters, rough: 0.7 });
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      const board = new THREE.Mesh(rbox(w * 0.42, h + 0.04, 0.035, 0.012), shMat);
      sh.add(board);
      for (let i = 0; i < 9; i++) {
        const slat = new THREE.Mesh(rbox(w * 0.36, 0.035, 0.02, 0.008), shMat);
        slat.position.set(0, -h / 2 + 0.12 + i * ((h - 0.2) / 8), 0.02);
        slat.rotation.x = -0.35;
        sh.add(slat);
      }
      sh.position.set(s * (w / 2 + w * 0.21 + 0.03), 0, 0.03);
      grp.add(sh);
    }
  }
  return grp;
}

export function buildHouse(engine, layout) {
  const { scene } = engine;
  const Z = layout.WORLD.houseWallZ; // -4.8
  const D = layout.DOOR;
  const group = new THREE.Group();
  group.name = 'casa';

  // ------------------------------------------------ fachada oeste (unidade da casa)
  const x0 = -9.0, x1 = 1.0;
  const dL = D.x - D.width / 2, dR = D.x + D.width / 2;
  const win1 = { x: -5.75, y: 1.55, w: 0.9, h: 1.15 };
  const win2 = { x: -0.7, y: 1.6, w: 1.25, h: 1.15 };
  const shape = new THREE.Shape();
  shape.moveTo(x0, 0); shape.lineTo(dL - 0.02, 0); shape.lineTo(dL - 0.02, D.height + 0.02);
  shape.lineTo(dR + 0.02, D.height + 0.02); shape.lineTo(dR + 0.02, 0); shape.lineTo(x1, 0);
  shape.lineTo(x1, WALL_H); shape.lineTo(x0, WALL_H); shape.lineTo(x0, 0);
  for (const wdw of [win1, win2]) {
    const hole = new THREE.Path();
    hole.moveTo(wdw.x - wdw.w / 2, wdw.y - wdw.h / 2); hole.lineTo(wdw.x + wdw.w / 2, wdw.y - wdw.h / 2);
    hole.lineTo(wdw.x + wdw.w / 2, wdw.y + wdw.h / 2); hole.lineTo(wdw.x - wdw.w / 2, wdw.y + wdw.h / 2);
    hole.lineTo(wdw.x - wdw.w / 2, wdw.y - wdw.h / 2);
    shape.holes.push(hole);
  }
  const depth = 0.4;
  const wallGeo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  wallGeo.translate(0, 0, Z - depth);
  const peach = plasterMat('#efb995');
  const wall = new THREE.Mesh(wallGeo, peach);
  group.add(wall);
  // fundo (interior escuro atrás da porta)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(D.width + 0.1, D.height + 0.1), stdMat('#2a1d14'));
  back.position.set(D.x, D.height / 2, Z - depth + 0.01);
  group.add(back);

  // rodapé (pedra quente)
  const skirtMat = stdMat('#a48f7c', { roughness: 0.9 });
  for (const [a, b] of [[x0, dL - 0.12], [dR + 0.12, x1]]) {
    const m = new THREE.Mesh(rbox(b - a, 0.34, 0.06, 0.015), skirtMat);
    m.position.set((a + b) / 2, 0.17, Z + 0.025);
    group.add(m);
  }
  // friso sob o beiral
  const band = new THREE.Mesh(rbox(x1 - x0, 0.12, 0.05, 0.015), plasterMat('#f6e3c8'));
  band.position.set((x0 + x1) / 2, WALL_H - 0.28, Z + 0.02);
  group.add(band);

  // ------------------------------------------------ porta
  const door = new THREE.Group();
  door.position.set(D.x, 0, Z - 0.16);
  const sage = new THREE.MeshStandardMaterial({ color: '#7f9f86', roughness: 0.55, map: woodMat('#fff', { vertical: true }).map, envMapIntensity: 0.8 });
  const slab = new THREE.Mesh(rbox(D.width - 0.04, D.height - 0.02, 0.05, 0.012), sage);
  slab.position.y = D.height / 2;
  door.add(slab);
  // almofadas (painéis em relevo)
  for (const [px, py, pw, ph] of [[-0.21, 0.55, 0.32, 0.72], [0.21, 0.55, 0.32, 0.72]]) {
    const pnl = new THREE.Mesh(rbox(pw, ph, 0.03, 0.02), sage);
    pnl.position.set(px, py, 0.03);
    door.add(pnl);
  }
  // vidro superior com brilho quente e travessas
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.62), new THREE.MeshStandardMaterial({
    color: '#3a2a20', emissive: '#ffffff', emissiveMap: windowInteriorTexture(5), emissiveIntensity: 1.1, roughness: 0.06, envMapIntensity: 1.5,
  }));
  doorGlass.position.set(0, 1.55, 0.029);
  door.add(doorGlass);
  for (const [a, b, x, y] of [[0.78, 0.05, 0, 1.87], [0.78, 0.05, 0, 1.23], [0.04, 0.66, 0, 1.55], [0.78, 0.035, 0, 1.55], [0.05, 0.66, -0.38, 1.55], [0.05, 0.66, 0.38, 1.55]]) {
    const m = new THREE.Mesh(rbox(a, b, 0.04, 0.01), sage);
    m.position.set(x, y, 0.035);
    door.add(m);
  }
  // maçaneta e espelho de latão
  const plate = new THREE.Mesh(rbox(0.05, 0.2, 0.012, 0.005), brassMat());
  plate.position.set(0.38, 1.0, 0.035);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), brassMat());
  knob.scale.set(1, 1, 0.8);
  knob.position.set(0.38, 1.0, 0.075);
  const slot = new THREE.Mesh(rbox(0.26, 0.05, 0.012, 0.006), brassMat());
  slot.position.set(0, 0.98, 0.04);
  door.add(plate, knob, slot);
  group.add(door);
  // batente (moldura creme)
  const trimMat = woodMat('#f3e8d6', { key: 'trim', rough: 0.6 });
  for (const [a, b, x, y] of [[0.11, D.height + 0.1, dL - 0.06, (D.height + 0.1) / 2], [0.11, D.height + 0.1, dR + 0.06, (D.height + 0.1) / 2], [D.width + 0.34, 0.13, D.x, D.height + 0.1]]) {
    const m = new THREE.Mesh(rbox(a, b, 0.07, 0.015), trimMat);
    m.position.set(x < -1 && a < 0.2 ? x : x, y, Z + 0.03);
    if (a > 0.2) m.position.x = D.x;
    group.add(m);
  }
  // soleira de pedra (baixa: as dogs passam por cima)
  const sill = new THREE.Mesh(rbox(D.width + 0.3, 0.035, 0.24, 0.012), stdMat('#cdbfa8', { roughness: 0.85 }));
  sill.position.set(D.x, 0.0175, Z + 0.09);
  group.add(sill);

  // ------------------------------------------------ arandela
  const lampX = dR + 0.42;
  const lamp = new THREE.Group();
  lamp.position.set(lampX, 1.78, Z + 0.02);
  const bracket = new THREE.Mesh(rbox(0.07, 0.14, 0.03, 0.01), ironMat());
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8).rotateX(Math.PI / 2), ironMat());
  arm.position.set(0, 0.02, 0.07);
  const cage = new THREE.Group();
  cage.position.set(0, -0.02, 0.15);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffb45e', emissiveIntensity: 2.6, roughness: 0.3, transparent: true, opacity: 0.95 });
  const glassL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.17, 6), glowMat);
  const capL = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.07, 6), ironMat());
  capL.position.y = 0.12;
  const baseL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.03, 6), ironMat());
  baseL.position.y = -0.1;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 4), ironMat());
    bar.position.set(Math.cos(a) * 0.055, 0, Math.sin(a) * 0.055);
    cage.add(bar);
  }
  cage.add(glassL, capL, baseL);
  lamp.add(bracket, arm, cage);
  group.add(lamp);
  const lampLight = new THREE.PointLight('#ffb066', 1.6, 5.5, 1.6);
  lampLight.position.set(lampX, 1.72, Z + 0.32);
  group.add(lampLight);

  // ------------------------------------------------ janelas
  for (const [wdw, seed] of [[win1, 2], [win2, 3]]) {
    const wg = makeWindow({ w: wdw.w, h: wdw.h, seed });
    wg.position.set(wdw.x, wdw.y, Z);
    group.add(wg);
  }

  // ------------------------------------------------ beiral e telhado (só na casa, oeste)
  {
    const eaveMat = woodMat('#efe2cc', { key: 'eave', rough: 0.7 });
    const fascia = new THREE.Mesh(rbox(x1 - x0 + 0.1, 0.2, 0.06, 0.02), eaveMat);
    fascia.position.set((x0 + x1) / 2, WALL_H + 0.02, Z + 0.62);
    const soffit = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.1, 0.03, 0.62), eaveMat);
    soffit.position.set((x0 + x1) / 2, WALL_H - 0.06, Z + 0.31);
    group.add(fascia, soffit);
    // caibros
    for (let x = x0 + 0.3; x < x1; x += 0.6) {
      const r = new THREE.Mesh(rbox(0.06, 0.09, 0.6, 0.01), eaveMat);
      r.position.set(x, WALL_H - 0.1, Z + 0.3);
      group.add(r);
    }
    // telhas: textura de canal
    const tileTex = canvasTexture(128, 128, (g, w, h) => {
      for (let x = 0; x < w; x++) {
        const s = Math.sin((x / w) * Math.PI * 2);
        const v = 0.62 + 0.38 * Math.abs(s) ** 0.6 * Math.sign(s) * 0.5 + 0.2;
        g.fillStyle = `rgb(${200 * v | 0},${108 * v | 0},${72 * v | 0})`;
        g.fillRect(x, 0, 1, h);
      }
      for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(60,25,10,0.35)'; g.fillRect(0, y, w, 4); }
    });
    tileTex.repeat.set((x1 - x0) / 0.22, 7);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 0.2, 3.2), new THREE.MeshStandardMaterial({
      map: tileTex, bumpMap: tileTex, bumpScale: 3, roughness: 0.8, color: '#ffffff',
    }));
    roof.rotation.x = -Math.PI / 2 + 0.55;
    roof.position.set((x0 + x1) / 2, WALL_H + 0.1 + Math.sin(0.55) * 1.6 * 0.95, Z + 0.68 - Math.cos(0.55) * 1.6);
    group.add(roof);
    // cumeeira / volume atrás para não ver "vazio"
    const attic = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.6, 2.6), plasterMat('#efb995'));
    attic.position.set((x0 + x1) / 2, WALL_H + 0.2, Z - 1.6);
    group.add(attic);
  }

  // ------------------------------------------------ pilastra na divisa + muro/fachada leste (condomínio)
  const pil = new THREE.Mesh(rbox(0.32, WALL_H + 0.4, 0.12, 0.03), plasterMat('#f4e4c9'));
  pil.position.set(1.0, (WALL_H + 0.4) / 2, Z + 0.03);
  group.add(pil);
  {
    const ex0 = 1.0, ex1 = 9.5, eh = 2.6;
    const ewall = new THREE.Mesh(new THREE.BoxGeometry(ex1 - ex0, eh, 0.4), plasterMat('#efdcbc'));
    ewall.position.set((ex0 + ex1) / 2, eh / 2, Z - 0.2);
    group.add(ewall);
    const coping = new THREE.Mesh(rbox(ex1 - ex0, 0.1, 0.5, 0.03), stdMat('#cdb89a', { roughness: 0.85 }));
    coping.position.set((ex0 + ex1) / 2, eh + 0.05, Z - 0.18);
    group.add(coping);
    const eskirt = new THREE.Mesh(rbox(ex1 - ex0, 0.3, 0.05, 0.015), skirtMat);
    eskirt.position.set((ex0 + ex1) / 2, 0.15, Z + 0.02);
    group.add(eskirt);
    // janelinha alta (basculante) acima da horta
    const small = makeWindow({ w: 0.7, h: 0.5, seed: 8, shutters: null });
    small.position.set(3.2, 1.95, Z + 0.06);
    group.add(small);
    // torneira de latão + mangueira enrolada no suporte (no nicho, atrás da cenoura)
    const reel = new THREE.Group();
    reel.position.set(4.4, 0.95, Z + 0.02);
    const hook = new THREE.Mesh(rbox(0.12, 0.16, 0.05, 0.01), stdMat('#3d6b5a', { roughness: 0.5, metalness: 0.3 }));
    reel.add(hook);
    const hoseMat = stdMat('#3f8a4a', { roughness: 0.45 });
    for (let i = 0; i < 6; i++) {
      const tor = new THREE.Mesh(new THREE.TorusGeometry(0.2 + (i % 3) * 0.012, 0.018, 8, 32), hoseMat);
      tor.position.set((i - 2.5) * 0.008, -0.17, 0.07 + i * 0.033);
      tor.rotation.set(0, 0, i * 0.4);
      reel.add(tor);
    }
    // ponta da mangueira descendo até o chão
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.18, -0.28, 0.2), new THREE.Vector3(0.28, -0.6, 0.18), new THREE.Vector3(0.3, -0.92, 0.25), new THREE.Vector3(0.12, -0.93, 0.45),
    ]);
    reel.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 8), hoseMat));
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8).rotateX(Math.PI / 2), brassMat());
    tap.position.set(-0.32, 0.12, 0.06);
    const tapHandle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 12), brassMat());
    tapHandle.position.set(-0.32, 0.17, 0.1);
    tapHandle.rotation.x = Math.PI / 2;
    reel.add(tap, tapHandle);
    group.add(reel);
  }

  // ------------------------------------------------ capacho (fibra de coco com patinha) + chinelos
  {
    const m = D.mat;
    const tex = canvasTexture(256, 160, (g, w, h) => {
      g.fillStyle = '#b48848'; g.fillRect(0, 0, w, h);
      const r = rng(4);
      for (let i = 0; i < 3500; i++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '90,60,25' : '225,190,120'},${0.15 + r() * 0.2})`;
        g.fillRect(r() * w, r() * h, 1, 2 + r() * 3);
      }
      g.strokeStyle = 'rgba(70,45,20,0.8)'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
      // patinha
      g.fillStyle = 'rgba(80,50,22,0.78)';
      const cx = w / 2, cy = h / 2 + 8;
      g.beginPath(); g.ellipse(cx, cy + 6, 22, 18, 0, 0, Math.PI * 2); g.fill();
      for (const [dx, dy] of [[-26, -18], [-9, -32], [9, -32], [26, -18]]) {
        g.beginPath(); g.ellipse(cx + dx, cy + dy, 8, 10, dx * 0.02, 0, Math.PI * 2); g.fill();
      }
    }, { repeat: false });
    const matMesh = new THREE.Mesh(rbox(m.w, 0.022, m.d, 0.01), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    // textura só no topo: RoundedBox tem uv por face (topo usa 0..1)
    matMesh.position.set(m.x, 0.011, m.z);
    group.add(matMesh);
    const slipperMat = stdMat('#e8735a', { roughness: 0.75 });
    const strapMat = stdMat('#f4ead8', { roughness: 0.8 });
    for (const [dx, dz, ry] of [[0.62, -0.06, 0.35], [0.74, 0.08, 0.15]]) {
      const s = new THREE.Group();
      const sole = new THREE.Mesh(rbox(0.1, 0.025, 0.24, 0.012), slipperMat);
      sole.position.y = 0.0125;
      sole.scale.set(1, 1, 1);
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 16, 1, true, -Math.PI / 2, Math.PI), strapMat);
      strap.rotation.z = Math.PI / 2;
      strap.rotation.y = Math.PI / 2;
      strap.scale.set(1, 1, 0.6);
      strap.position.set(0, 0.022, 0.04);
      s.add(sole, strap);
      s.position.set(m.x + dx - 0.2, 0, m.z + dz);
      s.rotation.y = ry;
      group.add(s);
    }
  }

  shadowAll(group, true, true);
  wall.castShadow = false; // a fachada não projeta no jardim (sol do sul-oeste)
  scene.add(group);

  // arandela: estado de destaque (usado por props.door.setHighlight)
  const lampState = { glowMat, light: lampLight, doorMat: sage, baseLight: lampLight.intensity, baseEmissive: glowMat.emissiveIntensity };
  return { group, occluders: [group], lampState };
}
