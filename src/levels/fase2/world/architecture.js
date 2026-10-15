// FASE 2 · Arquitetura: parede dos fundos com porta da lavanderia, janelas acesas e arandela "tartaruga",
// muro do condomínio, mureta com pilares e lanterna, cerca-viva, canal de drenagem com água corrente,
// meio-fio com o vão, cordão de lâmpadas, muros laterais, fundo (prédios na névoa, árvores) e primeiro plano.
import * as THREE from 'three';
import {
  shared, rng, rbox, canvasTexture, plasterTexture, speckleTexture, rippleNormalTexture, woodTexture, woodTextureV,
  stdMat, woodMat, plasterMat, ironMat, brassMat, foliageCluster, leafSkin, addFoliageWind, contactShadow, mergeGeometries, radialTexture,
} from '../../../world/util.js';
import { makeBuilding, makeTree } from '../../../world/background.js';
import { plantMat, crownMat, hedgeMat, geranium, smallFlowers, lavender } from '../../../world/plants.js';

const WALL_H = 3.0;

function interiorTexture(seed, { warm = true } = {}) {
  return canvasTexture(256, 320, (g, w, h) => {
    const r = rng(seed);
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#3a2416'); grd.addColorStop(0.45, warm ? '#b0703c' : '#8a7a60'); grd.addColorStop(1, '#4a2c1a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const lx = w * (0.3 + r() * 0.4), ly = h * 0.3;
    const rg = g.createRadialGradient(lx, ly, 4, lx, ly, w * 0.85);
    rg.addColorStop(0, 'rgba(255,224,160,1)'); rg.addColorStop(0.3, 'rgba(255,175,95,0.6)'); rg.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(50,30,18,0.55)';
    g.fillRect(w * 0.1, h * 0.58, w * 0.55, h * 0.05);
    g.fillRect(w * 0.15, h * 0.48, w * 0.08, h * 0.1); g.fillRect(w * 0.3, h * 0.5, w * 0.06, h * 0.08);
    for (const side of [0, 1]) {
      const x0 = side ? w * 0.82 : 0, x1 = side ? w : w * 0.18;
      for (let x = x0; x < x1; x++) {
        const f = 0.75 + 0.25 * Math.sin((x - x0) * 0.4 + side);
        g.fillStyle = `rgba(${250 * f | 0},${222 * f | 0},${180 * f | 0},0.9)`;
        g.fillRect(x, 0, 1, h);
      }
    }
  });
}
function frostedTexture(seed) {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(seed);
    const grd = g.createRadialGradient(w * 0.5, h * 0.35, 4, w * 0.5, h * 0.4, w * 0.8);
    grd.addColorStop(0, '#ffe2a8'); grd.addColorStop(0.5, '#e09a55'); grd.addColorStop(1, '#6e4224');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // vidro canelado (estrias verticais)
    for (let x = 0; x < w; x += 4) { g.fillStyle = `rgba(255,255,255,${0.05 + 0.06 * Math.sin(x)})`; g.fillRect(x, 0, 2, h); }
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(70,40,20,0.25)'; g.fillRect(r() * w, h * 0.55 + r() * h * 0.3, 10 + r() * 20, 30); }
  });
}

function makeWindow({ w, h, seed, frame = '#f0e6d4', grille = 'basculante' }) {
  const grp = new THREE.Group();
  const frameMat = stdMat(frame, { roughness: 0.55, metalness: 0.15 });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, h - 0.05), new THREE.MeshStandardMaterial({
    color: '#2a1e18', emissive: '#ffffff', emissiveMap: interiorTexture(seed), emissiveIntensity: 1.35, roughness: 0.08, envMapIntensity: 1.4,
  }));
  glass.position.z = -0.1;
  grp.add(glass);
  const t = 0.05;
  const bars = [[w, t, 0, h / 2 - t / 2], [w, t, 0, -h / 2 + t / 2], [t, h, -w / 2 + t / 2, 0], [t, h, w / 2 - t / 2, 0]];
  if (grille === 'basculante') { for (let i = 1; i < 3; i++) bars.push([w, 0.03, 0, -h / 2 + (i * h) / 3]); bars.push([0.03, h, 0, 0]); }
  else { bars.push([0.035, h, 0, 0]); bars.push([w, 0.035, 0, h * 0.18]); }
  for (const [a, b, x, y] of bars) {
    const m = new THREE.Mesh(rbox(a, b, 0.06, 0.008), frameMat);
    m.position.set(x, y, -0.07);
    grp.add(m);
  }
  const sill = new THREE.Mesh(rbox(w + 0.16, 0.05, 0.18, 0.015), stdMat('#cfc2ab', { roughness: 0.85 }));
  sill.position.set(0, -h / 2 - 0.025, 0.02);
  grp.add(sill);
  return grp;
}

/** Arandela "tartaruga" (luminária oval de parede com grade). */
function tartaruga() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.18, 1.35).rotateX(Math.PI / 2), stdMat('#2b2a2a', { roughness: 0.5, metalness: 0.4 }));
  g.add(base);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffc24d', emissiveIntensity: 3.2, roughness: 0.3, transparent: true, opacity: 0.96 });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.105, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1.3).rotateX(Math.PI / 2), glowMat);
  glass.position.z = 0.012;
  g.add(glass);
  const barMat = stdMat('#262524', { roughness: 0.5, metalness: 0.5 });
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.006, 5, 20, Math.PI), barMat);
    bar.scale.set(1, 1.3, 0.62);
    bar.rotation.set(0, Math.PI / 2, Math.PI / 2);
    bar.position.set(i * 0.035, 0, 0.012);
    bar.scale.x = 0.62; bar.scale.y = Math.sqrt(Math.max(0.05, 1 - (i * 0.035 / 0.11) ** 2)) * 1.3;
    g.add(bar);
  }
  return { group: g, glowMat };
}

export function buildArchitecture({ root, layout }) {
  const g = new THREE.Group();
  g.name = 'arquitetura';
  root.add(g);
  const Z = layout.WORLD.houseWallZ;
  const D = layout.LAUNDRY_DOOR;
  const B = layout.WORLD.bounds;
  const lights = [];
  const animated = [];
  const seeThrough = [];

  // ================================================================ parede dos fundos da casa
  const hx0 = -9.5, hx1 = 1.7;
  const dL = D.x - D.width / 2, dR = D.x + D.width / 2;
  const winTank = { x: -3.3, y: 1.62, w: 0.95, h: 0.62 };
  const winKitchen = { x: -0.55, y: 1.55, w: 1.3, h: 1.05 };
  const winWest = { x: -6.3, y: 1.7, w: 0.6, h: 0.5 };
  {
    const shape = new THREE.Shape();
    shape.moveTo(hx0, 0); shape.lineTo(dL - 0.02, 0); shape.lineTo(dL - 0.02, D.height + 0.02);
    shape.lineTo(dR + 0.02, D.height + 0.02); shape.lineTo(dR + 0.02, 0); shape.lineTo(hx1, 0);
    shape.lineTo(hx1, WALL_H); shape.lineTo(hx0, WALL_H); shape.lineTo(hx0, 0);
    for (const wd of [winTank, winKitchen, winWest]) {
      const hole = new THREE.Path();
      hole.moveTo(wd.x - wd.w / 2, wd.y - wd.h / 2); hole.lineTo(wd.x + wd.w / 2, wd.y - wd.h / 2);
      hole.lineTo(wd.x + wd.w / 2, wd.y + wd.h / 2); hole.lineTo(wd.x - wd.w / 2, wd.y + wd.h / 2);
      hole.lineTo(wd.x - wd.w / 2, wd.y - wd.h / 2);
      shape.holes.push(hole);
    }
    const depth = 0.4;
    const wallGeo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    wallGeo.translate(0, 0, Z - depth);
    const wallMat = plasterMat('#e3c79a');
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.receiveShadow = true;
    g.add(wall);
    // interior escuro atrás da porta e das janelas
    const back = new THREE.Mesh(new THREE.PlaneGeometry(D.width + 0.1, D.height + 0.1), stdMat('#1c130d'));
    back.position.set(D.x, D.height / 2, Z - depth + 0.01);
    g.add(back);
    // barrado inferior (azulejo/tinta mais escura até 0.9 m) — típico de área de serviço
    const barMat = new THREE.MeshStandardMaterial({ color: '#7a9c9a', roughness: 0.35, map: canvasTexture(256, 128, (c, w, h) => {
      c.fillStyle = '#d8e6e2'; c.fillRect(0, 0, w, h);
      for (let x = 0; x <= w; x += 32) { c.fillStyle = 'rgba(80,100,100,0.55)'; c.fillRect(x, 0, 2, h); }
      for (let y = 0; y <= h; y += 32) { c.fillStyle = 'rgba(80,100,100,0.55)'; c.fillRect(0, y, w, 2); }
    }) });
    barMat.map.repeat.set(1, 1);
    for (const [a, b] of [[hx0, dL - 0.1], [dR + 0.1, hx1]]) {
      const len = b - a;
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.02), barMat.clone());
      m.material.map = barMat.map.clone(); m.material.map.repeat.set(len / 0.8, 1.1); m.material.map.needsUpdate = true;
      m.position.set((a + b) / 2, 0.45, Z + 0.01);
      m.receiveShadow = true;
      g.add(m);
    }
    // friso de arremate sobre o barrado
    for (const [a, b] of [[hx0, dL - 0.1], [dR + 0.1, hx1]]) {
      const trim = new THREE.Mesh(rbox(b - a, 0.04, 0.035, 0.01), stdMat('#c9d6d0', { roughness: 0.5 }));
      trim.position.set((a + b) / 2, 0.91, Z + 0.02);
      g.add(trim);
    }
    // beiral + telhado
    const eaveMat = woodMat('#e8dcc6', { key: 'f2-eave', rough: 0.7 });
    const fascia = new THREE.Mesh(rbox(hx1 - hx0 + 0.1, 0.2, 0.06, 0.02), eaveMat);
    fascia.position.set((hx0 + hx1) / 2, WALL_H + 0.02, Z + 0.62);
    const soffit = new THREE.Mesh(new THREE.BoxGeometry(hx1 - hx0 + 0.1, 0.03, 0.62), eaveMat);
    soffit.position.set((hx0 + hx1) / 2, WALL_H - 0.06, Z + 0.31);
    g.add(fascia, soffit);
    for (let x = hx0 + 0.3; x < hx1; x += 0.6) {
      const r = new THREE.Mesh(rbox(0.06, 0.09, 0.6, 0.01), eaveMat);
      r.position.set(x, WALL_H - 0.1, Z + 0.3);
      g.add(r);
    }
    const tileTex = canvasTexture(128, 128, (c, w, h) => {
      for (let x = 0; x < w; x++) {
        const s = Math.sin((x / w) * Math.PI * 2);
        const v = 0.62 + 0.19 * Math.abs(s) ** 0.6 * Math.sign(s) + 0.2;
        c.fillStyle = `rgb(${190 * v | 0},${100 * v | 0},${70 * v | 0})`;
        c.fillRect(x, 0, 1, h);
      }
      for (let y = 0; y < h; y += 32) { c.fillStyle = 'rgba(50,20,10,0.4)'; c.fillRect(0, y, w, 4); }
    });
    tileTex.repeat.set((hx1 - hx0) / 0.22, 7);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(hx1 - hx0 + 0.2, 3.2), new THREE.MeshStandardMaterial({ map: tileTex, bumpMap: tileTex, bumpScale: 3, roughness: 0.75 }));
    roof.rotation.x = -Math.PI / 2 + 0.55;
    roof.position.set((hx0 + hx1) / 2, WALL_H + 0.1 + Math.sin(0.55) * 1.6 * 0.95, Z + 0.68 - Math.cos(0.55) * 1.6);
    g.add(roof);
    const attic = new THREE.Mesh(new THREE.BoxGeometry(hx1 - hx0, 1.7, 2.6), plasterMat('#e3c79a'));
    attic.position.set((hx0 + hx1) / 2, WALL_H + 0.2, Z - 1.6);
    g.add(attic);
    // calha + condutor descendo no canto leste da casa
    const gutterMat = stdMat('#9aa3a6', { roughness: 0.45, metalness: 0.5 });
    const gutter = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, hx1 - hx0, 10, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), gutterMat);
    gutter.position.set((hx0 + hx1) / 2, WALL_H + 0.04, Z + 0.68);
    g.add(gutter);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, WALL_H, 10), gutterMat);
    pipe.position.set(hx1 - 0.25, WALL_H / 2, Z + 0.07);
    g.add(pipe);
  }

  // ---------------------------------------------------------------- porta da lavanderia (azul-petróleo, vidro canelado aceso)
  {
    const door = new THREE.Group();
    door.position.set(D.x, 0, Z - 0.14);
    const doorMat = new THREE.MeshStandardMaterial({ color: '#3f7a80', roughness: 0.5, map: woodTextureV(), envMapIntensity: 0.7 });
    const slab = new THREE.Mesh(rbox(D.width - 0.04, D.height - 0.02, 0.05, 0.012), doorMat);
    slab.position.y = D.height / 2;
    door.add(slab);
    const pnl = new THREE.Mesh(rbox(0.7, 0.62, 0.03, 0.02), doorMat);
    pnl.position.set(0, 0.48, 0.03);
    door.add(pnl);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.78), new THREE.MeshStandardMaterial({
      color: '#2a1e18', emissive: '#ffffff', emissiveMap: frostedTexture(4), emissiveIntensity: 1.5, roughness: 0.15,
    }));
    glass.position.set(0, 1.45, 0.029);
    door.add(glass);
    for (const [a, b, x, y] of [[0.76, 0.05, 0, 1.87], [0.76, 0.05, 0, 1.04], [0.05, 0.86, -0.355, 1.45], [0.05, 0.86, 0.355, 1.45], [0.03, 0.8, 0, 1.45]]) {
      const m = new THREE.Mesh(rbox(a, b, 0.04, 0.01), doorMat);
      m.position.set(x, y, 0.035);
      door.add(m);
    }
    const knob = new THREE.Mesh(rbox(0.12, 0.025, 0.03, 0.01), brassMat());
    knob.position.set(0.33, 1.0, 0.07);
    const plate = new THREE.Mesh(rbox(0.04, 0.18, 0.012, 0.005), brassMat());
    plate.position.set(0.37, 0.98, 0.035);
    door.add(knob, plate);
    g.add(door);
    const trimMat = stdMat('#efe4d0', { roughness: 0.6 });
    for (const [a, b, x, y] of [[0.1, D.height + 0.1, dL - 0.05, (D.height + 0.1) / 2], [0.1, D.height + 0.1, dR + 0.05, (D.height + 0.1) / 2], [D.width + 0.3, 0.12, D.x, D.height + 0.1]]) {
      const m = new THREE.Mesh(rbox(a, b, 0.07, 0.015), trimMat);
      m.position.set(x, y, Z + 0.03);
      g.add(m);
    }
    const sill = new THREE.Mesh(rbox(D.width + 0.26, 0.03, 0.2, 0.01), stdMat('#cdbfa8', { roughness: 0.85 }));
    sill.position.set(D.x, 0.015, Z + 0.08);
    g.add(sill);
    // capacho
    const mt = canvasTexture(128, 80, (c, w, h) => {
      c.fillStyle = '#7d5a3a'; c.fillRect(0, 0, w, h);
      const r = rng(3);
      for (let i = 0; i < 1600; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '50,32,18' : '170,130,85'},${0.2 + r() * 0.2})`; c.fillRect(r() * w, r() * h, 1, 2 + r() * 2); }
      c.strokeStyle = 'rgba(40,25,12,0.8)'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    }, { repeat: false });
    const matMesh = new THREE.Mesh(rbox(0.8, 0.018, 0.48, 0.008), new THREE.MeshStandardMaterial({ map: mt, roughness: 1 }));
    matMesh.position.set(D.x, 0.009, Z + 0.42);
    g.add(matMesh);
  }

  // ---------------------------------------------------------------- janelas
  for (const [wd, seed, kind] of /** @type {[{ x: number, y: number, w: number, h: number }, number, string][]} */ ([[winTank, 6, 'basculante'], [winKitchen, 3, 'cozinha'], [winWest, 9, 'basculante']])) {
    const wg = makeWindow({ w: wd.w, h: wd.h, seed, grille: kind });
    wg.position.set(wd.x, wd.y, Z);
    g.add(wg);
  }
  // vasinhos no peitoril da cozinha
  {
    const terra = stdMat('#b8613f', { roughness: 0.85, map: speckleTexture() });
    for (const [dx, col] of /** @type {[number, string][]} */ ([[-0.42, '#f25c7a'], [0.0, '#ffd04a'], [0.4, '#ffffff']])) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.12, 12), terra);
      pot.position.set(winKitchen.x + dx, winKitchen.y - winKitchen.h / 2 + 0.06, Z + 0.06);
      const pl = new THREE.Mesh(smallFlowers({ seed: 40 + dx * 10, radius: 0.09, height: 0.1, color: col }), plantMat());
      pl.position.set(pot.position.x, pot.position.y + 0.05, pot.position.z);
      g.add(pot, pl);
    }
  }

  // ---------------------------------------------------------------- arandela tartaruga + luz
  {
    const t = tartaruga();
    t.group.position.set(dL - 0.38, 1.95, Z + 0.02);
    g.add(t.group);
    const L = new THREE.PointLight('#ffbf6a', 2.6, 6.5, 1.6);
    L.position.set(dL - 0.38, 1.85, Z + 0.4);
    g.add(L);
    lights.push(L);
    // fio elétrico até o beiral
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.9, 4), stdMat('#3a3a3a'));
    wire.position.set(dL - 0.38, 2.5, Z + 0.015);
    g.add(wire);
  }
  // luz quente que vaza da janela da cozinha
  {
    const L = new THREE.PointLight('#ffa65c', 1.6, 4.5, 1.7);
    L.position.set(winKitchen.x, 1.4, Z + 0.7);
    g.add(L);
    lights.push(L);
  }

  // ================================================================ muro do condomínio (leste da casa)
  {
    const ex0 = hx1, ex1 = 10, eh = 2.3;
    const cMat = plasterMat('#b9b4a8');
    const ewall = new THREE.Mesh(new THREE.BoxGeometry(ex1 - ex0, eh, 0.4), cMat);
    ewall.position.set((ex0 + ex1) / 2, eh / 2, Z - 0.2);
    ewall.receiveShadow = true;
    g.add(ewall);
    const coping = new THREE.Mesh(rbox(ex1 - ex0, 0.1, 0.5, 0.03), stdMat('#9b968c', { roughness: 0.85 }));
    coping.position.set((ex0 + ex1) / 2, eh + 0.05, Z - 0.18);
    g.add(coping);
    const skirt = new THREE.Mesh(rbox(ex1 - ex0, 0.28, 0.04, 0.012), stdMat('#7f7a72', { roughness: 0.9 }));
    skirt.position.set((ex0 + ex1) / 2, 0.14, Z + 0.02);
    g.add(skirt);
    const pil = new THREE.Mesh(rbox(0.32, WALL_H + 0.3, 0.14, 0.03), plasterMat('#e9d6b2'));
    pil.position.set(hx1, (WALL_H + 0.3) / 2, Z + 0.04);
    g.add(pil);
    // luminária industrial (gaiola) sobre a zona C
    const lamp = new THREE.Group();
    lamp.position.set(2.75, 1.95, Z + 0.02);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8).rotateX(Math.PI / 2), ironMat());
    arm.position.z = 0.11;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 18, 1, true), stdMat('#2f4d44', { roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }));
    shade.position.set(0, 0.0, 0.24);
    const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffcf7a', emissiveIntensity: 4 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), bulbMat);
    bulb.position.set(0, -0.05, 0.24);
    lamp.add(arm, shade, bulb);
    g.add(lamp);
    const L = new THREE.PointLight('#ffc27a', 2.2, 6, 1.6);
    L.position.set(2.75, 1.75, Z + 0.45);
    g.add(L);
    lights.push(L);
  }

  // ================================================================ muros laterais (fora dos limites)
  {
    const wMat = plasterMat('#b9ab96');
    const west = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.1, 12), wMat);
    west.position.set(B.minX - 0.2, 1.05, 0.3);
    g.add(west);
    const wcap = new THREE.Mesh(rbox(0.4, 0.08, 12, 0.02), stdMat('#a8a090', { roughness: 0.85 }));
    wcap.position.set(B.minX - 0.2, 2.14, 0.3);
    g.add(wcap);
    const east = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.7, 12), plasterMat('#b9b4a8'));
    east.position.set(B.maxX + 0.25, 0.85, 0.3);
    g.add(east);
    const ecap = new THREE.Mesh(rbox(0.4, 0.08, 12, 0.02), stdMat('#9b968c', { roughness: 0.85 }));
    ecap.position.set(B.maxX + 0.25, 1.74, 0.3);
    g.add(ecap);
    // barrado de azulejo no muro oeste (continua o da casa)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 12), stdMat('#9fb8b3', { roughness: 0.4 }));
    bar.position.set(B.minX - 0.04, 0.45, 0.3);
    g.add(bar);
  }

  // ================================================================ mureta + pilares + lanterna
  {
    const W = layout.WALL_AB, GT = layout.GATE;
    const mur = new THREE.Group();
    mur.name = 'mureta';
    const plaster = new THREE.MeshStandardMaterial({ color: '#d9c39c', map: plasterTexture(), bumpMap: plasterTexture(), bumpScale: 1.2, roughness: 0.92 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#a59d90', map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 0.8, roughness: 0.85 });
    const footMat = new THREE.MeshStandardMaterial({ color: '#8d7f6c', roughness: 0.95, map: speckleTexture() });
    const capH = 0.06;
    for (const s of W.segments) {
      const len = s.zMax - s.zMin;
      const zc = (s.zMin + s.zMax) / 2;
      const body = new THREE.Mesh(rbox(W.thickness, W.height - capH, len, 0.02), plaster);
      body.position.set(W.x, (W.height - capH) / 2, zc);
      const cap = new THREE.Mesh(rbox(W.thickness + 0.08, capH, len + 0.04, 0.015), capMat);
      cap.position.set(W.x, W.height - capH / 2, zc);
      const foot = new THREE.Mesh(rbox(W.thickness + 0.03, 0.14, len, 0.01), footMat);
      foot.position.set(W.x, 0.07, zc);
      mur.add(body, cap, foot);
    }
    // pilares do portão
    const pilH = 1.06;
    for (const [z, sgn] of [[GT.hinge.z, 1], [GT.latchPost.z, -1]]) {
      const zc = z + sgn * 0.13;
      const p = new THREE.Mesh(rbox(0.28, pilH, 0.26, 0.02), plaster);
      p.position.set(W.x, pilH / 2, zc);
      const c = new THREE.Mesh(rbox(0.34, 0.06, 0.32, 0.015), capMat);
      c.position.set(W.x, pilH + 0.03, zc);
      const c2 = new THREE.Mesh(rbox(0.22, 0.05, 0.2, 0.015), capMat);
      c2.position.set(W.x, pilH + 0.085, zc);
      mur.add(p, c, c2);
    }
    mur.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(mur);
    seeThrough.push(mur);
    // lanterna sobre o pilar da dobradiça (ilumina tábua + portão)
    const lan = new THREE.Group();
    lan.position.set(W.x, pilH + 0.11, GT.latchPost.z - 0.13);
    const lMat = stdMat('#1f2422', { roughness: 0.45, metalness: 0.5 });
    const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 4).rotateY(Math.PI / 4), lMat);
    const lglowM = new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffb84d', emissiveIntensity: 3.4, roughness: 0.2, transparent: true, opacity: 0.92 });
    const lglow = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.14, 4).rotateY(Math.PI / 4), lglowM);
    lglow.position.y = 0.09;
    const lroof = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.07, 4).rotateY(Math.PI / 4), lMat);
    lroof.position.y = 0.2;
    const ltop = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), lMat);
    ltop.position.y = 0.245;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.15, 0.008), lMat);
      post.position.set(Math.cos(a) * 0.052, 0.09, Math.sin(a) * 0.052);
      lan.add(post);
    }
    lan.add(lbase, lglow, lroof, ltop);
    g.add(lan);
    const L = new THREE.PointLight('#ffb65e', 2.2, 5.2, 1.5);
    L.position.set(W.x - 0.25, pilH + 0.3, GT.latchPost.z + 0.3);
    g.add(L);
    lights.push(L);
    animated.push((dt, t) => { lglowM.emissiveIntensity = 3.2 + Math.sin(t * 7.1) * 0.12 + Math.sin(t * 13.3) * 0.08; });
  }

  // ================================================================ cerca-viva B|C
  {
    const H = layout.HEDGE_BC;
    const r = rng(31);
    const blobs = [];
    const len = H.zMax - H.zMin;
    const n = Math.round(len / 0.32);
    for (let i = 0; i <= n; i++) {
      const z = H.zMin + 0.12 + (i / n) * (len - 0.1);
      blobs.push({ x: H.x + (r() - 0.5) * 0.05, y: H.height * 0.5, z, r: 0.27 + r() * 0.04, sx: 0.95, sy: 1.25, sz: 1.0 });
      blobs.push({ x: H.x + (r() - 0.5) * 0.06, y: H.height * 0.82, z: z + 0.15, r: 0.2 + r() * 0.04, sx: 1.0, sy: 0.75 });
    }
    const hg = foliageCluster(blobs, { detail: 2, amp: 0.14, freq: 5, seed: 13, dark: '#1c3517', mid: '#2f5424', light: '#6a8c3f', sunBias: 0.4 });
    // aparar: achata o topo e as laterais (cerca-viva podada)
    const p = hg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i);
      if (y > H.height) p.setY(i, H.height + (y - H.height) * 0.25);
      const dx = x - H.x, lim = H.hx + 0.02;
      if (Math.abs(dx) > lim) p.setX(i, H.x + Math.sign(dx) * (lim + (Math.abs(dx) - lim) * 0.3));
      if (y < 0) p.setY(i, y * 0.2);
    }
    hg.computeVertexNormals();
    const hMat = addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { amp: 0.005, freq: 1.1 });
    hMat.customProgramCacheKey = () => 'f2-hedge';
    const hedge = new THREE.Group();
    hedge.name = 'cerca-viva';
    const hm = new THREE.Mesh(hg, hMat);
    hm.castShadow = true; hm.receiveShadow = true;
    hedge.add(hm);
    const skinMat = addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide }), { amp: 0.012, freq: 1.6 });
    skinMat.customProgramCacheKey = () => 'f2-hedge-skin';
    hedge.add(leafSkin(hg, { count: 2600, size: 0.065, seed: 7, material: skinMat, minNormalY: -0.4 }));
    g.add(hedge);
    seeThrough.push(hedge);
  }

  // ================================================================ canal de drenagem
  const channel = buildChannel(g, layout, animated);

  // ================================================================ cordão de lâmpadas (junto à parede)
  {
    const hooks = [];
    for (let x = -6.3; x <= 1.5; x += 1.56) hooks.push(new THREE.Vector3(x, 2.62, Z + 0.1));
    const pts = [];
    for (let i = 0; i < hooks.length - 1; i++) {
      const a = hooks[i], b = hooks[i + 1];
      for (let k = 0; k < 16; k++) {
        const s = k / 16;
        pts.push(new THREE.Vector3(a.x + (b.x - a.x) * s, a.y - Math.sin(s * Math.PI) * 0.26, a.z + 0.06 * Math.sin(s * Math.PI)));
      }
    }
    pts.push(hooks[hooks.length - 1].clone());
    const curve = new THREE.CatmullRomCurve3(pts);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.006, 4), stdMat('#262422', { roughness: 0.6 }));
    g.add(wire);
    const bulbs = [];
    const nb = 34;
    for (let i = 0; i < nb; i++) bulbs.push(curve.getPointAt((i + 0.5) / nb));
    const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffbe5c', emissiveIntensity: 3.6, roughness: 0.25 });
    const sockMat = stdMat('#2a2826', { roughness: 0.5 });
    const bg = new THREE.SphereGeometry(0.032, 10, 8).scale(1, 1.25, 1);
    const sg = new THREE.CylinderGeometry(0.014, 0.014, 0.035, 6);
    const ib = new THREE.InstancedMesh(bg, bulbMat, nb), is = new THREE.InstancedMesh(sg, sockMat, nb);
    const m4 = new THREE.Matrix4();
    bulbs.forEach((p, i) => {
      m4.makeTranslation(p.x, p.y - 0.06, p.z); ib.setMatrixAt(i, m4);
      m4.makeTranslation(p.x, p.y - 0.022, p.z); is.setMatrixAt(i, m4);
    });
    g.add(ib, is);
    for (const h of hooks) {
      const hk = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), ironMat());
      hk.position.copy(h);
      g.add(hk);
    }
    const L = new THREE.PointLight('#ffc070', 1.5, 5.5, 1.6);
    L.position.set(-1.6, 2.2, Z + 0.6);
    g.add(L);
    lights.push(L);
    animated.push((dt, t) => { bulbMat.emissiveIntensity = 3.5 + Math.sin(t * 2.3) * 0.15; });
  }

  // ================================================================ fundo
  buildBackdrop(g, layout);
  // ================================================================ primeiro plano (sul, baixo)
  buildForeground(g, layout);

  return {
    group: g, lights, seeThrough, channel,
    update(dt, t) { for (const f of animated) f(dt, t); },
  };
}

// ------------------------------------------------------------------ canal
function buildChannel(g, layout, animated) {
  const CH = layout.CHANNEL, Z = layout.WORLD.houseWallZ;
  const depth = layout.CRATE.height + 0.012; // fundo visual: o caixote afundado fica com o topo rente ao chão
  const z0 = Z, z1 = 7.5;
  const len = z1 - z0, zc = (z0 + z1) / 2;
  const w = CH.xMax - CH.xMin, xc = (CH.xMin + CH.xMax) / 2;
  const cg = new THREE.Group();
  cg.name = 'canal';
  const concrete = new THREE.MeshStandardMaterial({ color: '#8d8a83', map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 1.0, roughness: 0.9 });
  const wetConc = new THREE.MeshStandardMaterial({ color: '#4d5654', map: speckleTexture(), roughness: 0.45 });
  // paredes internas + fundo
  for (const [x, nx] of [[CH.xMin, 1], [CH.xMax, -1]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, depth), concrete);
    wall.rotation.y = nx > 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(x, -depth / 2, zc);
    wall.receiveShadow = true;
    cg.add(wall);
    // faixa molhada/escura perto da água
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.14), wetConc);
    wet.rotation.y = wall.rotation.y;
    wet.position.set(x + nx * 0.002, -depth * 0.52, zc);
    cg.add(wet);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2), wetConc);
  floor.position.set(xc, -depth, zc);
  cg.add(floor);
  // bordas de concreto (lábio) dos dois lados
  const lipMat = new THREE.MeshStandardMaterial({ color: '#b3ada2', map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 0.8, roughness: 0.85 });
  const slot = CH.slot;
  // margem leste (lábio baixo)
  {
    const lip = new THREE.Mesh(rbox(0.12, 0.05, len, 0.015), lipMat);
    lip.position.set(CH.xMax + 0.04, 0.012, zc);
    lip.receiveShadow = true;
    cg.add(lip);
  }
  // meio-fio oeste: ao longo do canal, interrompido no vão
  const curbH = 0.15, curbW = 0.14;
  const curbMat = new THREE.MeshStandardMaterial({ color: '#c9c2b4', map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 0.8, roughness: 0.8 });
  for (const [a, b] of [[z0, slot.zMin], [slot.zMax, z1]]) {
    const m = new THREE.Mesh(rbox(curbW, curbH, b - a, 0.025), curbMat);
    m.position.set(CH.xMin + curbW / 2, curbH / 2 - 0.005, (a + b) / 2);
    m.castShadow = true; m.receiveShadow = true;
    cg.add(m);
    // faixa amarela de sinalização nas pontas do vão
    const endZ = a === z0 ? b : a;
    const sgn = a === z0 ? -1 : 1;
    const stripe = new THREE.Mesh(rbox(curbW + 0.004, curbH + 0.004, 0.12, 0.02), stdMat('#f2c230', { roughness: 0.55 }));
    stripe.position.set(CH.xMin + curbW / 2, curbH / 2 - 0.004, endZ + sgn * 0.06);
    cg.add(stripe);
  }
  // no vão: chanfro inclinado (rampa) + chevrons amarelos/pretos no chão, apontando para o canal
  {
    const rampW = 0.16;
    const ramp = new THREE.Mesh(new THREE.PlaneGeometry(rampW, slot.zMax - slot.zMin), lipMat);
    ramp.rotation.set(-Math.PI / 2, -0.55, 0, 'YXZ');
    ramp.rotation.set(0, 0, 0);
    const rg = new THREE.PlaneGeometry(rampW, slot.zMax - slot.zMin).rotateX(-Math.PI / 2).rotateZ(-0.6);
    ramp.geometry = rg;
    ramp.position.set(CH.xMin + 0.05, -0.05, slot.z);
    cg.add(ramp);
    const chevTex = canvasTexture(128, 256, (c, ww, hh) => {
      c.fillStyle = '#1e1d1b'; c.fillRect(0, 0, ww, hh);
      c.fillStyle = '#f2c230';
      for (let y = -64; y < hh + 64; y += 64) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(ww * 0.55, y + 32); c.lineTo(0, y + 64); c.lineTo(0, y + 40); c.lineTo(ww * 0.3, y + 32); c.lineTo(0, y + 24); c.closePath();
        c.moveTo(ww * 0.4, y); c.lineTo(ww, y + 32); c.lineTo(ww * 0.4, y + 64); c.lineTo(ww * 0.4, y + 40); c.lineTo(ww * 0.72, y + 32); c.lineTo(ww * 0.4, y + 24); c.closePath();
        c.fill();
      }
    }, { repeat: false });
    const chev = new THREE.Mesh(new THREE.PlaneGeometry(0.3, slot.zMax - slot.zMin - 0.04).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
      map: chevTex, roughness: 0.6, transparent: true, opacity: 0.92, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
    }));
    chev.position.set(CH.xMin - 0.17, 0.004, slot.z);
    chev.receiveShadow = true;
    cg.add(chev);
    // grelha de drenagem logo antes do vão
    const grate = new THREE.Group();
    const gm = stdMat('#3b3d3c', { roughness: 0.45, metalness: 0.7 });
    const gw = 0.36, gl = slot.zMax - slot.zMin - 0.1;
    const frame = new THREE.Mesh(rbox(gw, 0.012, gl, 0.004), stdMat('#555856', { roughness: 0.5, metalness: 0.6 }));
    grate.add(frame);
    for (let i = 0; i < 9; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.04, 0.016, 0.022), gm);
      bar.position.set(0, 0.004, -gl / 2 + 0.06 + i * ((gl - 0.12) / 8));
      grate.add(bar);
    }
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(gw - 0.03, gl - 0.03).rotateX(-Math.PI / 2), stdMat('#0d0d0c'));
    hole.position.y = 0.002;
    grate.add(hole);
    grate.position.set(CH.xMin - 0.55, 0.006, slot.z);
    cg.add(grate);
  }
  // saída de água (manilha) no muro norte + cascatinha
  {
    const pipeMat = stdMat('#7c776e', { roughness: 0.9, map: speckleTexture() });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 24, 1, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6d695f', roughness: 0.9, side: THREE.DoubleSide }));
    pipe.position.set(xc, -0.05, Z + 0.05);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), pipeMat);
    rim.position.set(xc, -0.05, Z + 0.2);
    const dark = new THREE.Mesh(new THREE.CircleGeometry(0.29, 24), stdMat('#0b0b0a'));
    dark.position.set(xc, -0.05, Z - 0.08);
    cg.add(pipe, rim, dark);
  }
  // água corrente (shader: faixas de espuma, normal map rolando, reflexo quente das luzes)
  const waterY = -depth + 0.22;
  const waterU = { uTime: shared.time };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, len, 4, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
    color: '#2b5a63', roughness: 0.05, metalness: 0.1, normalMap: rippleNormalTexture(), normalScale: new THREE.Vector2(0.55, 0.55),
    transparent: true, opacity: 0.93, envMapIntensity: 1.6,
  }));
  water.material.normalMap = rippleNormalTexture().clone();
  water.material.normalMap.wrapS = water.material.normalMap.wrapT = THREE.RepeatWrapping;
  water.material.normalMap.repeat.set(1.2, len * 1.6);
  water.material.normalMap.needsUpdate = true;
  water.material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, waterU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += sin(position.z * 9.0 - uTime * 6.0) * 0.006 + sin(position.x * 20.0 + uTime * 3.0) * 0.003;`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; uniform float uTime;
        float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(wh(i), wh(i+vec2(1,0)), f.x), mix(wh(i+vec2(0,1)), wh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <normal_fragment_maps>', `
        vec2 fuv = vNormalMapUv + vec2(0.0, -uTime * 0.9);
        vec3 mapN = texture2D(normalMap, fuv).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D(normalMap, vNormalMapUv * 0.6 + vec2(0.3, -uTime * 0.55)).xyz * 2.0 - 1.0;
        mapN = normalize(mapN + mapN2);
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // espuma: faixas alongadas descendo o canal (norte → sul) + borda junto às paredes
          vec2 q = vec2(vWP.x * 6.0, vWP.z * 1.4 - uTime * 1.6);
          float f = wn(q) * 0.6 + wn(q * 2.7 + 3.1) * 0.4;
          float streak = smoothstep(0.62, 0.86, f);
          float edge = smoothstep(0.12, 0.0, min(vWP.x - ${CH.xMin.toFixed(3)}, ${CH.xMax.toFixed(3)} - vWP.x));
          float foam = max(streak * 0.55, edge * (0.4 + 0.6 * wn(vec2(vWP.z * 5.0 - uTime * 2.4, vWP.x * 30.0))));
          // cascatinha junto à manilha
          foam = max(foam, smoothstep(${(Z + 0.9).toFixed(2)}, ${(Z + 0.1).toFixed(2)}, vWP.z) * (0.5 + 0.5 * wn(vec2(vWP.x * 12.0, vWP.z * 8.0 - uTime * 5.0))));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.82, 0.84), foam * 0.7);
        }`);
  };
  water.material.customProgramCacheKey = () => 'f2-water';
  water.position.set(xc, waterY, zc);
  water.receiveShadow = true;
  water.renderOrder = 2;
  cg.add(water);
  // véu da cascata saindo da manilha
  const fallMat = new THREE.MeshBasicMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const fallTex = canvasTexture(64, 128, (c, ww, hh) => {
    const r = rng(5);
    c.clearRect(0, 0, ww, hh);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`; c.fillRect(r() * ww, 0, 1 + r() * 3, hh); }
  }, { srgb: false });
  fallMat.map = fallTex; fallMat.alphaMap = fallTex;
  fallTex.repeat.set(1, 1);
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4, 1, 6), fallMat);
  {
    const p = fall.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const t = (0.2 - y) / 0.4; p.setZ(i, t * t * 0.18); }
  }
  fall.position.set(xc, -0.06 - 0.2, Z + 0.2);
  cg.add(fall);
  animated.push((dt, t) => { fallTex.offset.y = (t * 1.8) % 1; });
  g.add(cg);
  return { group: cg, depth, waterY };
}

// ------------------------------------------------------------------ fundo
function buildBackdrop(g, layout) {
  const bg = new THREE.Group();
  bg.name = 'fundo';
  const bdefs = [
    { x: -9, z: -15, w: 12, h: 15, d: 8, floors: 5, seed: 11, color: '#c9b8a4', ry: 0 },
    { x: 5.5, z: -18, w: 14, h: 19, d: 9, floors: 6, seed: 12, color: '#bfb0a2', ry: -0.08 },
    { x: 19, z: -9, w: 10, h: 13, d: 12, floors: 4, seed: 13, color: '#c7b9a6', ry: -Math.PI / 2 + 0.12 },
    { x: -21, z: -4, w: 11, h: 12, d: 10, floors: 4, seed: 14, color: '#c2b3a0', ry: Math.PI / 2 - 0.15 },
    { x: -2, z: -30, w: 16, h: 26, d: 10, floors: 8, seed: 15, color: '#b4a99e', ry: 0.05 },
  ];
  for (const b of bdefs) {
    const m = makeBuilding(b);
    m.position.set(b.x, 0, b.z);
    m.rotation.y = b.ry;
    m.traverse((/** @type {THREE.Mesh} */ o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false;
      const mats = /** @type {THREE.MeshStandardMaterial[]} */ (Array.isArray(o.material) ? o.material : [o.material]);
      for (const mm of mats) if (mm.emissiveMap) mm.emissiveIntensity = 1.6;
    });
    bg.add(m);
  }
  const tdefs = [
    { x: -9.5, z: -7.5, height: 7.5, crown: 2.3, seed: 3 },
    { x: -4.5, z: -9.0, height: 6.5, crown: 2.0, seed: 5 },
    { x: 1.5, z: -10.5, height: 8.0, crown: 2.5, seed: 7 },
    { x: 8.5, z: -8.0, height: 6.8, crown: 2.2, seed: 9 },
    { x: 10.5, z: -1.0, height: 6.0, crown: 2.0, seed: 11 },
    { x: 10.0, z: 5.0, height: 5.2, crown: 1.8, seed: 13 },
    { x: -10.5, z: 2.0, height: 6.2, crown: 2.0, seed: 15 },
    { x: -11, z: 8.0, height: 5.5, crown: 1.9, seed: 17 },
  ];
  for (const t of tdefs) {
    const tr = makeTree(t);
    tr.position.set(t.x, 0, t.z);
    tr.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) o.castShadow = false; });
    bg.add(tr);
  }
  // arbustos escuros atrás dos muros (as copas aparecem por cima)
  const r = rng(3);
  const bushes = [];
  for (let x = 2.0; x < 9.5; x += 0.6 + r() * 0.3) bushes.push({ x, y: 2.3 + r() * 0.3, z: -5.6 - r() * 0.6, r: 0.6 + r() * 0.3, sy: 1.1 });
  for (let z = -4.6; z < 5.0; z += 0.6 + r() * 0.3) bushes.push({ x: 7.5 + r() * 0.5, y: 1.5 + r() * 0.4, z, r: 0.6 + r() * 0.25, sy: 1.15 });
  for (let z = -4.4; z < 5.0; z += 0.6 + r() * 0.3) bushes.push({ x: -7.4 - r() * 0.5, y: 2.0 + r() * 0.4, z, r: 0.6 + r() * 0.25, sy: 1.1 });
  const bm = new THREE.Mesh(foliageCluster(bushes, { detail: 2, amp: 0.25, freq: 2.2, seed: 2, dark: '#14261a', mid: '#2a4426', light: '#5f7a42' }), crownMat());
  bm.receiveShadow = true;
  bg.add(bm);
  bg.add(leafSkin(bm.geometry, { count: 2600, size: 0.12, seed: 4, material: plantMat(), minNormalY: -0.2 }));
  g.add(bg);
}

// ------------------------------------------------------------------ primeiro plano (sul)
function buildForeground(g, layout) {
  const B = layout.WORLD.bounds;
  const fg = new THREE.Group();
  fg.name = 'primeiro-plano';
  // murinho baixo de tijolinho + floreira (≤ 0.55 m) ao longo do limite sul
  const r = rng(51);
  const brick = new THREE.MeshStandardMaterial({ color: '#a8583c', map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 0.8, roughness: 0.9 });
  const zW = B.maxZ + 0.55;
  const segs = [[B.minX - 0.4, layout.WALL_AB.x - 0.4], [layout.WALL_AB.x + 0.35, layout.HEDGE_BC.x - 0.4], [layout.HEDGE_BC.x + 0.45, layout.CHANNEL.xMin - 0.05], [layout.CHANNEL.xMax + 0.15, B.maxX + 0.5]];
  const blobs = [];
  for (const [a, b] of segs) {
    const len = b - a;
    const wallM = new THREE.Mesh(rbox(len, 0.32, 0.26, 0.03), brick);
    wallM.position.set((a + b) / 2, 0.16, zW);
    const cap = new THREE.Mesh(rbox(len + 0.04, 0.05, 0.32, 0.015), stdMat('#cdbfa8', { roughness: 0.85 }));
    cap.position.set((a + b) / 2, 0.345, zW);
    wallM.receiveShadow = true;
    fg.add(wallM, cap);
    for (let x = a + 0.12; x < b - 0.08; x += 0.2 + r() * 0.08) blobs.push({ x, y: 0.4 + r() * 0.04, z: zW + (r() - 0.5) * 0.08, r: 0.12 + r() * 0.04, sy: 0.8 });
  }
  const fol = foliageCluster(blobs, { detail: 2, amp: 0.3, freq: 7, seed: 9, dark: '#2c4a22', mid: '#4a7a32', light: '#8fbf55' });
  fg.add(new THREE.Mesh(fol, plantMat()));
  fg.add(leafSkin(fol, { count: 1600, size: 0.06, seed: 12, material: plantMat(), minNormalY: -0.2 }));
  // flores coloridas sobre a floreira
  const colors = ['#ff6a55', '#ffd04a', '#f25c7a', '#ffffff', '#b98cff'];
  const fm = new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: '#331a10', emissiveIntensity: 0.2 });
  const fi = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.03, 0), fm, 220);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < 220; i++) {
    const b = blobs[Math.floor(r() * blobs.length)];
    m4.makeTranslation(b.x + (r() - 0.5) * 0.2, b.y + 0.07 + r() * 0.04, b.z + (r() - 0.5) * 0.16);
    fi.setMatrixAt(i, m4);
    fi.setColorAt(i, c.set(colors[Math.floor(r() * colors.length)]));
  }
  fg.add(fi);
  // gramado e touceiras mais além (fora dos limites)
  g.add(fg);
}
