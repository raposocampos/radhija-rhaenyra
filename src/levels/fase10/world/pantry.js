// FASE 10 · A despensa, o cômodo novo ao sul da cozinha (em corte, como o resto da casa): piso de lajotinhas, a parede
// da frente da cozinha com a porta, paredes baixas, as prateleiras de latas, potes e pacotes, os sacos de farinha, a
// cestinha de batatas, o ARMÁRIO alto com o pote de vidro dos biscoitos de osso em cima e os três CAIXOTES de
// mantimentos (alturas diferentes, alça de corda no lado leste) que deslizam pelo trilho pontilhado até a marca no chão.
// API: buildPantry(root, layout) → { group, walls (ver através), crates: { setCrate(i, x, locked) },
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
  const { PANTRY, CUPBOARD, PANTRY_CRATES, PANTRY_SHELF, WALLS } = layout;
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

  // ---------------- o armário alto (portas fechadas, tampo) com o pote de biscoitos em cima
  const D = CUPBOARD;
  const cab = new THREE.Group();
  const cabWood = woodMat('#e8d2a8', { key: 'f10-armario' });
  const dw = D.hx * 2, dd = D.hz * 2;
  const body = new THREE.Mesh(rbox(dw, D.top - 0.04, dd, 0.012), cabWood);
  body.position.y = (D.top - 0.04) / 2;
  const topP = new THREE.Mesh(rbox(dw + 0.04, 0.04, dd + 0.03, 0.01), woodMat('#c79a62', { key: 'f10-armario-tampo' }));
  topP.position.set(0, D.top - 0.02, 0.008);
  cab.add(body, topP);
  // duas portas (azul-claro, com almofada e puxador de latão)
  const doorMat = woodMat('#8fc0d8', { key: 'f10-armario-porta', rough: 0.6 });
  const panelMat = woodMat('#a9d0e2', { key: 'f10-armario-almofada', rough: 0.6 });
  for (const sx of [-1, 1]) {
    const door = new THREE.Mesh(rbox(D.hx - 0.04, D.top - 0.16, 0.02, 0.008), doorMat);
    door.position.set(sx * (D.hx / 2), (D.top - 0.04) / 2 + 0.03, D.hz + 0.004);
    const panel = new THREE.Mesh(rbox(D.hx - 0.14, D.top - 0.36, 0.012, 0.006), panelMat);
    panel.position.set(sx * (D.hx / 2), (D.top - 0.04) / 2 + 0.03, D.hz + 0.016);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), brassMat());
    knob.position.set(sx * 0.045, (D.top - 0.04) / 2 + 0.03, D.hz + 0.024);
    cab.add(door, panel, knob);
  }
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
  jar.position.set(-0.2, D.top, -0.04);
  cab.add(jar);
  // o lugar do biscoito do bolo (na frente do pote, encostado nele)
  const cookieSpot = new THREE.Object3D();
  cookieSpot.position.set(0.08, D.top + 0.035, 0.05);
  cab.add(cookieSpot);
  // etiqueta "Biscoitos" no pote
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshStandardMaterial({ map: labelTex('Biscoitos', '#fffaf0', '#c94a5a'), roughness: 0.8 }));
  tag.position.set(jar.position.x, D.top + 0.12, jar.position.z + 0.113);
  cab.add(tag);
  cab.position.set(D.x, FLOOR_Y, D.z);
  cab.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh && o !== glass) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(cab);

  // ---------------- os três caixotes de mantimentos (tampa fechada para pisar, ripas, rótulo e a alça de corda)
  const C = PANTRY_CRATES;
  const crateWood = woodMat('#c8955a', { key: 'f10-caixote', rough: 0.85 });
  const slatWood = woodMat('#9a6a3e', { key: 'f10-caixote-ripa', rough: 0.9 });
  const ropeMat = stdMat('#d8c49a', { roughness: 0.95 });
  const labelInk = ['#c94a5a', '#7a4a2a', '#4a7a2a'];
  const crates = C.list.map((cr, i) => {
    const g = new THREE.Group();
    g.name = `caixote-${cr.id}`;
    const w = C.hx * 2, d = C.hz * 2;
    const bodyC = new THREE.Mesh(rbox(w, cr.h - 0.03, d, 0.012), crateWood);
    bodyC.position.y = (cr.h - 0.03) / 2;
    const lidC = new THREE.Mesh(rbox(w + 0.02, 0.03, d + 0.02, 0.008), slatWood);
    lidC.position.y = cr.h - 0.015;
    g.add(bodyC, lidC);
    // ripas horizontais nas quatro faces
    const nSl = Math.max(1, Math.round((cr.h - 0.06) / 0.16));
    for (let k = 0; k < nSl; k++) {
      const y = 0.06 + (k + 0.5) * ((cr.h - 0.09) / nSl);
      for (const [sx, sz, lw, ld] of [[0, d / 2 + 0.006, w - 0.02, 0.012], [0, -d / 2 - 0.006, w - 0.02, 0.012], [w / 2 + 0.006, 0, 0.012, d - 0.02], [-w / 2 - 0.006, 0, 0.012, d - 0.02]]) {
        const sl = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.05, ld), slatWood);
        sl.position.set(sx, y, sz);
        g.add(sl);
      }
    }
    // o rótulo virado para o sul (para a câmera)
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.1), new THREE.MeshStandardMaterial({ map: labelTex(cr.label, '#fffaf0', labelInk[i]), roughness: 0.8 }));
    lab.position.set(0, Math.min(cr.h - 0.08, 0.2), d / 2 + 0.014);
    g.add(lab);
    // a alça de corda no lado leste (meia argola grossa, na altura da boca da Rhaenyra)
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI), ropeMat);
    loop.rotation.set(0, Math.PI / 2, -Math.PI / 2);
    loop.position.set(w / 2 + 0.012, Math.min(0.2, cr.h - 0.06), 0);
    g.add(loop);
    g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(C.x0, FLOOR_Y, cr.z);
    group.add(g);
    return g;
  });
  // marcas no chão (contorno do lugar de cada caixote) e o trilho pontilhado do começo até elas
  const markMats = C.list.map(() => new THREE.MeshStandardMaterial({ color: '#f6efe0', emissive: '#000000', roughness: 0.6 }));
  C.list.forEach((cr, i) => {
    const w = C.hx * 2 + 0.06, d = C.hz * 2 + 0.06, t = 0.025;
    const parts = [[0, d / 2, w, t], [0, -d / 2, w, t], [w / 2, 0, t, d], [-w / 2, 0, t, d]].map(([x, z, lw, ld]) => {
      const p = new THREE.PlaneGeometry(lw, ld).rotateX(-Math.PI / 2);
      p.translate(C.x1 + x, FLOOR_Y + 0.003, cr.z + z);
      return p;
    });
    for (let x = C.x0 + C.hx + 0.12; x < C.x1 - C.hx - 0.08; x += 0.12) {
      const p = new THREE.CircleGeometry(0.018, 8).rotateX(-Math.PI / 2);
      p.translate(x, FLOOR_Y + 0.003, cr.z);
      parts.push(p);
    }
    const mark = new THREE.Mesh(mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p.index ? p.toNonIndexed() : p; })), markMats[i]);
    mark.receiveShadow = true;
    group.add(mark);
  });
  const crateSt = C.list.map(() => ({ x: C.x0, locked: false, flash: 0 }));
  root.add(group);
  return {
    group, walls, cookieSpot,
    crates: {
      /** Onde está o caixote i (x, ao longo do trilho) e se ele já travou na marca (a marca fica verde). */
      setCrate(i, x, locked) {
        const c = crateSt[i];
        if (locked && !c.locked) c.flash = 1;
        c.x = x;
        c.locked = !!locked;
      },
    },
    update(dt) {
      crates.forEach((g, i) => {
        const c = crateSt[i];
        g.position.x = c.x;
        c.flash = Math.max(0, c.flash - dt * 1.6);
        const m = markMats[i];
        m.color.set(c.locked ? '#7ad66a' : '#f6efe0');
        m.emissive.set(c.locked ? '#2f8a2a' : '#000000');
        m.emissiveIntensity = c.locked ? 0.35 + c.flash * 1.2 : 0;
      });
    },
  };
}
