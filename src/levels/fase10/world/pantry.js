// FASE 10 · A despensa, o cômodo novo ao sul da cozinha (em corte, como o resto da casa): piso de lajotinhas, a parede
// da frente da cozinha com a porta, paredes baixas, as prateleiras de latas, potes e pacotes, os sacos de farinha, a
// cestinha de batatas e o GAVETEIRO de madeira com três gavetas que deslizam para fora (viram degraus), o pote de vidro
// com os biscoitos de osso de glacê em cima e o puxador de argola de cada gaveta.
// API: buildPantry(root, layout) → { group, walls (ver através), drawers: { setDrawer(i, ext, fallen), handleAt(i) },
//   cookieSpot (Object3D no pote), update(dt, t) }
import * as THREE from 'three';
import { rng, rbox, canvasTexture, stdMat, woodMat, plasterMat, brassMat, paint, mergeGeometries } from '../../../world/util.js';

const FLOOR_Y = 0.012;

/** Lajotinhas de cerâmica (terracota clarinha). */
function tileTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(91);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const t = 0.9 + r() * 0.15;
      g.fillStyle = `rgb(${(214 * t) | 0},${(150 * t) | 0},${(110 * t) | 0})`;
      g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30);
    }
    g.fillStyle = '#efe4d2';
    for (let k = 0; k <= 4; k++) { g.fillRect(k * 32 - 1, 0, 2, h); g.fillRect(0, k * 32 - 1, w, 2); }
  });
}
/** Rótulo de pote/lata. */
function labelTex(txt, bg, ink) {
  return canvasTexture(96, 48, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = ink; g.font = 'bold 18px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, w / 2, h / 2 + 1);
  }, { repeat: false });
}

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildPantry(root, layout) {
  const { PANTRY, DRAWERS, PANTRY_SHELF, WALLS } = layout;
  const group = new THREE.Group();
  group.name = 'despensa';
  const walls = new THREE.Group();
  walls.name = 'paredes-da-despensa';
  group.add(walls);
  const T = WALLS.t;
  const zN = PANTRY.zN + T / 2; // face de dentro da parede da cozinha
  const zS = PANTRY.zS; // centro da parede da frente
  const x0 = PANTRY.x0 + T / 2, x1 = PANTRY.x1 - T / 2;

  // ---------------- laje e piso
  const slab = new THREE.Mesh(new THREE.BoxGeometry(PANTRY.x1 - PANTRY.x0 + T, 0.3, zS - PANTRY.zN + T / 2), stdMat('#3b2a20', { roughness: 0.95 }));
  slab.position.set((PANTRY.x0 + PANTRY.x1) / 2, -0.15 + 0.003, (PANTRY.zN + zS + T / 2) / 2 + 0.002);
  const tiles = tileTexture();
  tiles.repeat.set((x1 - x0) / 0.6, (zS - zN) / 0.6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, zS - T / 2 - zN).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.6 }));
  floor.position.set((x0 + x1) / 2, FLOOR_Y, (zN + zS - T / 2) / 2);
  floor.receiveShadow = true;
  group.add(slab, floor);

  // ---------------- paredes: a da cozinha (com a porta), oeste e leste baixas, frente cortada
  const plaster = plasterMat('#f2e6c8');
  const outside = plasterMat('#f0d6c0');
  const box = (cx, cz, w, h, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [outside, outside, plaster, plaster, plaster, outside]);
    m.position.set(cx, h / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    walls.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 0.02, d + 0.004), stdMat('#3b2a20', { roughness: 0.95 }));
    cap.position.set(cx, h + 0.01, cz);
    walls.add(cap);
    return m;
  };
  const cutH = WALLS.frontH;
  // a parede entre a cozinha e a despensa (no lugar da frente da cozinha), com a porta
  box((PANTRY.x0 + PANTRY.door.x0) / 2, PANTRY.zN, PANTRY.door.x0 - PANTRY.x0, cutH, T);
  box((PANTRY.door.x1 + PANTRY.x1 - T / 2) / 2, PANTRY.zN, PANTRY.x1 - T / 2 - PANTRY.door.x1, cutH, T);
  // oeste e leste (baixas), e a frente (cortada)
  box(PANTRY.x0, (PANTRY.zN + T / 2 + zS - T / 2) / 2, T, WALLS.cutH, zS - T / 2 - PANTRY.zN - T / 2 - 0.004);
  box(PANTRY.x1, (PANTRY.zN + T / 2 + zS - T / 2) / 2, T, WALLS.cutH, zS - T / 2 - PANTRY.zN - T / 2 - 0.004);
  box((PANTRY.x0 + PANTRY.x1) / 2, zS, PANTRY.x1 - PANTRY.x0 + T, cutH, T);
  // batentes da porta
  const jambMat = stdMat('#f6f1e6', { roughness: 0.55 });
  for (const x of [PANTRY.door.x0, PANTRY.door.x1]) {
    const j = new THREE.Mesh(rbox(0.05, cutH + 0.04, T + 0.03, 0.01), jambMat);
    j.position.set(x + (x === PANTRY.door.x0 ? 0.025 : -0.025), (cutH + 0.04) / 2, PANTRY.zN);
    walls.add(j);
  }

  // ---------------- prateleiras de latas e potes (parede oeste, de frente para o gaveteiro)
  const S = PANTRY_SHELF;
  const face = S.x < (PANTRY.x0 + PANTRY.x1) / 2 ? 1 : -1; // para onde as prateleiras abrem (+X ou −X)
  const shelf = new THREE.Group();
  const shelfWood = woodMat('#c79a62', { key: 'f10-despensa-prateleira' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(rbox(0.04, S.h, 0.04, 0.006), shelfWood);
    leg.position.set(sx * (S.hx - 0.03), S.h / 2, sz * (S.hz - 0.03));
    shelf.add(leg);
  }
  const r = rng(93);
  const goods = [['Arroz', '#f4f1ea', '#5a3a2a'], ['Feijão', '#7a4a2a', '#fffaf0'], ['Açúcar', '#9bd5f0', '#1a4a6a'], ['Farinha', '#f6e3b0', '#8a5a3c'], ['Ração', '#f27a8a', '#fffaf0'], ['Mel', '#f6c453', '#5a3a1a']];
  const jarGeos = [];
  [0.32, 0.78, 1.24].forEach((y, row) => {
    const b = new THREE.Mesh(rbox(S.hx * 2, 0.03, S.hz * 2, 0.006), shelfWood);
    b.position.y = y;
    shelf.add(b);
    for (let k = 0; k < 4; k++) {
      const [txt, bg, ink] = goods[(row * 2 + k) % goods.length];
      const h = 0.18 + r() * 0.06;
      const x = (r() - 0.5) * 0.12, z = -S.hz + 0.2 + k * ((S.hz * 2 - 0.4) / 3);
      const g = new THREE.CylinderGeometry(0.065, 0.065, h, 12).toNonIndexed();
      g.translate(x, y + 0.015 + h / 2, z);
      jarGeos.push(paint(g, bg));
      // um rótulo por prateleira (o pote da ponta)
      if (k === 1) {
        const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshStandardMaterial({ map: labelTex(txt, bg, ink), roughness: 0.8 }));
        lab.rotation.y = face * Math.PI / 2;
        lab.position.set(x + face * 0.066, y + 0.015 + h / 2, z);
        shelf.add(lab);
      }
    }
  });
  shelf.add(new THREE.Mesh(mergeGeometries(jarGeos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 })));
  shelf.position.set(S.x, FLOOR_Y, S.z);
  shelf.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(shelf);
  // sacos de farinha e a cestinha de batatas (canto sudoeste)
  for (const [x, z, s] of [[x0 + 0.25, zS - 0.45, 1], [x0 + 0.55, zS - 0.38, 0.85]]) {
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), stdMat('#e8dcc0', { roughness: 1 }));
    sack.scale.set(0.9 * s, 1.25 * s, 0.75 * s);
    sack.position.set(x, 0.24 * s, z);
    sack.castShadow = true;
    group.add(sack);
  }
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.16, 14, 1, true), woodMat('#c89a5a', { key: 'f10-cesta' }));
  basket.material.side = THREE.DoubleSide;
  basket.position.set(x0 + 0.9, 0.09, zS - 0.4);
  group.add(basket);
  for (let k = 0; k < 5; k++) {
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), stdMat('#b8905a', { roughness: 0.9 }));
    pot.position.set(basket.position.x + (r() - 0.5) * 0.18, 0.14, basket.position.z + (r() - 0.5) * 0.18);
    group.add(pot);
  }

  // ---------------- o gaveteiro (corpo, três gavetas que deslizam e o pote de biscoitos em cima)
  const D = DRAWERS;
  const cab = new THREE.Group();
  const cabWood = woodMat('#e8d2a8', { key: 'f10-gaveteiro' });
  const dw = D.hx * 2, dd = D.hz * 2;
  // carcaça aberta na frente: laterais, fundo, tampo e base
  for (const sx of [-1, 1]) {
    // as laterais terminam por dentro do tampo
    const side = new THREE.Mesh(rbox(0.04, D.top - 0.03, dd, 0.008), cabWood);
    side.position.set(sx * (D.hx - 0.02), (D.top - 0.03) / 2, 0);
    cab.add(side);
  }
  const backP = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.08, D.top - 0.04, 0.02), cabWood);
  backP.position.set(0, D.top / 2, -D.hz + 0.012);
  const topP = new THREE.Mesh(rbox(dw + 0.03, 0.04, dd + 0.02, 0.01), woodMat('#c79a62', { key: 'f10-gaveteiro-tampo' }));
  topP.position.set(0, D.top - 0.02, 0.005);
  const baseP = new THREE.Mesh(rbox(dw - 0.06, 0.06, dd - 0.02, 0.008), cabWood);
  baseP.position.set(0, 0.03, 0);
  cab.add(backP, topP, baseP);
  // as gavetas: caixa com a frente pintada e o puxador de argola
  const drawerFrontMat = woodMat('#8fc0d8', { key: 'f10-gaveta', rough: 0.6 });
  const fronts = ['#8fc0d8', '#f6c453', '#f27a8a'];
  const drawerObjs = D.y.map((yTop, i) => {
    const h = 0.24;
    const dr = new THREE.Group();
    const front = new THREE.Mesh(rbox(dw - 0.1, h - 0.02, 0.03, 0.008), i === 0 ? drawerFrontMat : woodMat(fronts[i], { key: `f10-gaveta-${i}`, rough: 0.6 }));
    front.position.set(0, -h / 2, D.hz - 0.015);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.14, 0.02, dd - 0.06), cabWood);
    tray.position.set(0, -h + 0.03, 0);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, h - 0.06, dd - 0.06), cabWood);
    sideL.position.set(-(dw - 0.14) / 2, -h / 2, 0);
    const sideR = sideL.clone();
    sideR.position.x = (dw - 0.14) / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 16), brassMat());
    ring.position.set(0, -h / 2 - 0.02, D.hz + 0.012);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), brassMat());
    knob.position.set(0, -h / 2 + 0.012, D.hz + 0.006);
    dr.add(front, tray, sideL, sideR, ring, knob);
    dr.position.set(0, yTop, 0);
    dr.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    cab.add(dr);
    return dr;
  });
  // o pote de vidro com os biscoitos de osso (o de glacê rosa é o do bolo) em cima
  const jar = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 18, 1, true), new THREE.MeshPhysicalMaterial({ color: '#dff0f4', roughness: 0.05, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = 0.12;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 18), stdMat('#c94a5a', { roughness: 0.5 }));
  lid.position.y = 0.255;
  const boneG = new THREE.CapsuleGeometry(0.015, 0.07, 3, 8).rotateZ(Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const b = new THREE.Mesh(boneG, stdMat('#e8b878', { roughness: 0.7 }));
    b.position.set((r() - 0.5) * 0.1, 0.03 + k * 0.035, (r() - 0.5) * 0.08);
    b.rotation.y = r() * Math.PI;
    jar.add(b);
  }
  jar.add(glass, lid);
  jar.position.set(-0.18, D.top, -0.04);
  cab.add(jar);
  // o lugar do biscoito do bolo (na frente do pote, encostado nele)
  const cookieSpot = new THREE.Object3D();
  cookieSpot.position.set(0.05, D.top + 0.035, 0.06);
  cab.add(cookieSpot);
  // etiqueta "Biscoitos" no pote
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshStandardMaterial({ map: labelTex('Biscoitos', '#fffaf0', '#c94a5a'), roughness: 0.8 }));
  tag.position.set(jar.position.x, D.top + 0.12, jar.position.z + 0.113);
  cab.add(tag);
  cab.position.set(D.x, FLOOR_Y, D.z);
  cab.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh && o !== glass) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(cab);

  const st = drawerObjs.map(() => ({ ext: 0, fallen: false, fall: 0 }));
  root.add(group);
  return {
    group, walls, cookieSpot,
    drawers: {
      /** Quanto a gaveta i está para fora (m) e se ela caiu no chão (aí fica deitada na frente do gaveteiro). */
      setDrawer(i, ext, fallen = false) {
        const s = st[i];
        s.ext = ext;
        s.fallen = fallen;
      },
      /** Onde fica o puxador da gaveta i (para a Rhaenyra). @param {number} i */
      handleAt(i) { return new THREE.Vector3(D.x, D.y[i] - 0.14, D.z + D.hz + st[i].ext + 0.02); },
    },
    update(dt) {
      drawerObjs.forEach((dr, i) => {
        const s = st[i];
        s.fall += ((s.fallen ? 1 : 0) - s.fall) * (1 - Math.exp(-dt * 8));
        // caída: na frente do gaveteiro, no chão, um pouco torta
        const k = s.fall;
        dr.position.set(0.08 * k, D.y[i] * (1 - k) + 0.24 * k, s.ext * (1 - k) + (D.hz + 0.35 + i * 0.05) * k);
        dr.rotation.set(0.35 * k, 0.25 * k * (i % 2 ? 1 : -1), 0);
      });
    },
  };
}
