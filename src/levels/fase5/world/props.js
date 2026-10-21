// FASE 5 · Props interativos (todos procedurais): portãozinho de bebê (pulável) com a trava do lado do
// corredor, a barricada (caixa de LIVROS fixa e caixa de ALMOFADAS que desmonta), a soleira, a mesa da
// cozinha com a toalha xadrez comprida e o ursinho embaixo, o cercadinho de brinquedos, a caminha das
// dogs (GOAL), os ossinhos e as luzes da casa (abajur, pendente, arandela, claridade das janelas).
import * as THREE from 'three';
import { rng, rbox, canvasTexture, stdMat, woodMat, contactShadow, shadowAll } from '../../../world/util.js';
import { createTeddyBear } from '../../../world/toys.js';
import { buildTreats } from '../../../world/treats.js';
import { movingBox } from './furniture.js';

const TAU = Math.PI * 2;
const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// ================================================================== portãozinho + trava
/** @returns {{ gate: import('../../../types').Fase5Props['petGate'], latch: import('../../../types').Fase5Props['latch'] }} */
function buildPetGate(root, layout) {
  const { PET_GATE: G } = layout;
  const white = stdMat('#f7f4ee', { roughness: 0.45 });
  const grey = stdMat('#c9c4bb', { roughness: 0.5 });
  // postes de pressão nos batentes
  for (const z of [G.hinge.z, G.latchPost.z]) {
    const post = new THREE.Mesh(rbox(0.06, G.height + 0.04, 0.05, 0.015), white);
    post.position.set(G.hinge.x, (G.height + 0.04) / 2, z + (z === G.hinge.z ? -0.01 : 0.01));
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10).rotateX(Math.PI / 2), grey);
    pad.position.set(G.hinge.x, G.height * 0.7, z + (z === G.hinge.z ? 0.015 : -0.015));
    root.add(post, pad);
  }
  // folha (pivô na dobradiça, ao longo de -Z local)
  const pivot = new THREE.Group();
  pivot.name = 'portaozinho';
  pivot.position.set(G.hinge.x, 0, G.hinge.z);
  const L = G.length - 0.04;
  for (const y of [0.04, G.height - 0.02]) {
    const rail = new THREE.Mesh(rbox(0.035, 0.035, L, 0.012), white);
    rail.position.set(0, y, -L / 2 - 0.02);
    pivot.add(rail);
  }
  const nBars = 13;
  for (let i = 0; i <= nBars; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, G.height - 0.05, 6), white);
    bar.position.set(0, G.height / 2, -0.04 - (i / nBars) * (L - 0.04));
    pivot.add(bar);
  }
  // portinha do meio desenhada (moldura interna) + desenho de patinha
  const inner = new THREE.Mesh(rbox(0.02, G.height * 0.55, 0.42, 0.01), grey);
  inner.position.set(0.012, G.height * 0.48, -L / 2);
  inner.scale.set(1, 1, 1);
  pivot.add(inner);
  // trava (do lado leste = +X local quando fechado)
  const latchBox = new THREE.Mesh(rbox(0.06, 0.09, 0.08, 0.015), stdMat('#3f6f78', { roughness: 0.4 }));
  latchBox.position.set(0.04, G.height - 0.06, -L + 0.02);
  const lever = new THREE.Group();
  lever.position.set(0.075, G.height - 0.06, -L + 0.02);
  const lev = new THREE.Mesh(rbox(0.02, 0.022, 0.1, 0.008), stdMat('#f2c14e', { roughness: 0.4 }));
  lev.position.z = 0.04;
  lever.add(lev);
  pivot.add(latchBox, lever);
  shadowAll(pivot);
  root.add(pivot);
  return {
    gate: { object: pivot, setOpen(t) { pivot.rotation.y = G.openYaw * THREE.MathUtils.clamp(t, 0, 1); } },
    latch: { object: lever, setTurn(k) { lever.rotation.x = -1.2 * THREE.MathUtils.clamp(k, 0, 1); } },
  };
}

// ================================================================== barricada
function buildBarricade(root, layout) {
  const { BOX_BOOKS: A, BOX_PILLOWS: B, THRESHOLD: T } = layout;
  const books = movingBox(A.half * 2, A.height, A.half * 2, 'LIVROS', 21, { onTop: true });
  books.position.set(A.x, 0, A.z);
  books.rotation.y = Math.PI / 2;
  // livros aparecendo pela tampa entreaberta
  const r = rng(4);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(rbox(0.05, 0.2, 0.15, 0.005), stdMat(['#3f6f78', '#e86a52', '#7f9c8a'][i], { roughness: 0.8 }));
    b.position.set(-0.12 + i * 0.06, A.height + 0.02, -0.12 + r() * 0.04);
    b.rotation.z = (r() - 0.5) * 0.3;
    books.add(b);
  }
  shadowAll(books);
  root.add(books);

  // caixa de almofadas: desmonta (achata, abas abrem, almofadas escorregam para o oeste)
  const box = new THREE.Group();
  box.name = 'caixa-almofadas';
  const body = movingBox(B.half * 2, B.height, B.half * 2, 'ALMOFADAS', 22, { onTop: true });
  // desmontada (achatada no chão, sem colisor), a caixa é chão de pisar; inteira, o tampo fica alto demais para contar
  Object.assign(body.userData, { walkable: true, moving: true });
  box.add(body);
  const flapMat = new THREE.MeshStandardMaterial({ color: '#c49a64', roughness: 0.92, side: THREE.DoubleSide });
  const flaps = [];
  /** @type {[number, number, string][]} */
  const flapDirs = [[-1, 0, 'z'], [1, 0, 'z'], [0, -1, 'x'], [0, 1, 'x']];
  for (const [dx, dz, ax] of flapDirs) {
    const f = new THREE.Group();
    f.position.set(dx * B.half, B.height, dz * B.half);
    // aberta no chão, a aba é chão de pisar (escondida, nem conta)
    Object.assign(f.userData, { walkable: true, moving: true });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ax === 'z' ? B.half : B.half * 2, ax === 'z' ? B.half * 2 : B.half).rotateX(-Math.PI / 2), flapMat);
    m.position.set(-dx * B.half / 2, 0.002, -dz * B.half / 2);
    f.add(m);
    f.visible = false;
    box.add(f);
    flaps.push({ f, dx, dz, ax });
  }
  const pillowCols = ['#e86a52', '#f2c14e', '#7fb0c8'];
  const pillows = pillowCols.map((col, i) => {
    const p = new THREE.Mesh(rbox(0.3, 0.1, 0.28, 0.05), stdMat(col, { roughness: 0.95 }));
    p.visible = false;
    p.userData.to = new THREE.Vector3(-0.55 - i * 0.12, 0.05 + (i === 1 ? 0.06 : 0), (i - 1) * 0.3);
    p.userData.rot = (i - 1) * 0.6;
    // espalhadas no chão, as almofadas são chão de pisar (retorno do usuário: as dogs as atravessavam); elas mudam de
    // lugar (o chão as acompanha)
    Object.assign(p.userData, { walkable: true, moving: true });
    box.add(p);
    return p;
  });
  shadowAll(box);
  root.add(box);

  // soleira de madeira do lado da cozinha
  const sill = new THREE.Mesh(rbox(0.07, 0.022, T.z1 - T.z0 + 0.1, 0.006), woodMat('#7a5a3c', { key: 'f5-threshold', rough: 0.7 }));
  sill.position.set(T.x, 0.011, (T.z0 + T.z1) / 2);
  sill.receiveShadow = true;
  root.add(sill);

  let collapse = 0;
  return {
    object: box,
    setPos(x, z) { box.position.set(x, 0, z); },
    /** 0 = caixa inteira · 1 = desmontada no chão com as almofadas espalhadas. */
    setCollapse(k) {
      collapse = THREE.MathUtils.clamp(k, 0, 1);
      const e = 1 - (1 - collapse) ** 3;
      body.scale.set(1 + 0.25 * e, 1 - 0.88 * e, 1 + 0.12 * e);
      for (const { f, dx, dz } of flaps) {
        f.visible = collapse > 0;
        f.position.y = B.height * (1 - 0.88 * e);
        // abas caem para fora
        if (dx) f.rotation.z = dx * (Math.PI - 0.15) * e * 0.5 * (1 + e);
        if (dz) f.rotation.x = -dz * (Math.PI - 0.15) * e * 0.5 * (1 + e);
      }
      for (const p of pillows) {
        p.visible = collapse > 0;
        p.position.lerpVectors(new THREE.Vector3(0, B.height * 0.5, 0), p.userData.to, e);
        p.position.y += Math.sin(e * Math.PI) * 0.18;
        p.rotation.y = p.userData.rot * e;
      }
    },
    get collapse() { return collapse; },
  };
}

// ================================================================== mesa com toalha
function tableclothTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const n = 8, s = w / n;
    g.fillStyle = '#fbf6ec';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(214,72,72,0.55)';
    for (let i = 0; i < n; i += 2) { g.fillRect(i * s, 0, s, h); g.fillRect(0, i * s, w, s); }
    g.fillStyle = 'rgba(190,40,48,0.35)';
    for (let i = 0; i < n; i += 2) for (let j = 0; j < n; j += 2) g.fillRect(i * s, j * s, s, s);
    g.fillStyle = 'rgba(0,0,0,0.04)';
    for (let y = 0; y < h; y += 2) g.fillRect(0, y, w, 1);
  });
}
function buildTable(root, layout, updaters) {
  const { TABLE: T } = layout;
  const grp = new THREE.Group();
  grp.name = 'mesa-cozinha';
  const wood = woodMat('#a87a52', { key: 'f5-oak', rough: 0.6 });
  const top = new THREE.Mesh(rbox(T.hx * 2, 0.04, T.hz * 2, 0.012), wood);
  top.position.y = T.height - 0.02;
  grp.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(rbox(0.05, T.height - 0.04, 0.05, 0.012), wood);
    leg.position.set(sx * (T.hx - 0.07), (T.height - 0.04) / 2, sz * (T.hz - 0.07));
    grp.add(leg);
  }
  // toalha: tampo + 4 abas que caem até `drop` do chão, com a barra ondulada
  const tex = tableclothTexture();
  const clothMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide });
  const ov = 0.05;
  const cw = T.hx * 2 + ov * 2, cd = T.hz * 2 + ov * 2;
  tex.repeat.set(cw / 0.5, cd / 0.5);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(cw, cd).rotateX(-Math.PI / 2), clothMat);
  cloth.position.y = T.height + 0.002;
  grp.add(cloth);
  const hang = T.height - T.drop;
  const sideTex = tex.clone();
  sideTex.needsUpdate = true;
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.95, side: THREE.DoubleSide });
  const drapes = [];
  for (const [len, x, z, ry] of /** @type {[number, number, number, number][]} */ ([
    [cw, 0, cd / 2, 0], [cw, 0, -cd / 2, Math.PI], [cd, cw / 2, 0, Math.PI / 2], [cd, -cw / 2, 0, -Math.PI / 2],
  ])) {
    const geo = new THREE.PlaneGeometry(len, hang, 24, 4);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = (p.getY(i) + hang / 2) / hang; // v: 0 embaixo, 1 em cima
      p.setZ(i, Math.sin(u * 18) * 0.018 * (1 - v) + 0.012 * (1 - v));
      p.setY(i, p.getY(i) + (1 - v) * Math.sin(u * 9) * 0.012);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, sideMat);
    m.position.set(x, T.height - hang / 2, z);
    m.rotation.y = ry;
    grp.add(m);
    drapes.push(m);
  }
  // vaso com flores e pratos
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.16, 16), stdMat('#3f6f78', { roughness: 0.3 }));
  vase.position.set(0.05, T.height + 0.08, -0.05);
  grp.add(vase);
  const fr = rng(6);
  for (let i = 0; i < 6; i++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 4), stdMat('#5b8a3e'));
    const a = (i / 6) * TAU;
    stem.position.set(0.05 + Math.cos(a) * 0.02, T.height + 0.24, -0.05 + Math.sin(a) * 0.02);
    stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), stdMat(['#f2c14e', '#e86a7a', '#ffffff'][i % 3], { roughness: 0.7 }));
    fl.position.set(0.05 + Math.cos(a) * 0.06, T.height + 0.33 + fr() * 0.03, -0.05 + Math.sin(a) * 0.06);
    grp.add(stem, fl);
  }
  for (const [x, z] of [[-0.32, 0.12], [0.34, 0.1]]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.015, 24), stdMat('#ffffff', { roughness: 0.25 }));
    plate.position.set(x, T.height + 0.01, z);
    grp.add(plate);
  }
  grp.position.set(T.x, 0, T.z);
  shadowAll(grp);
  root.add(grp);
  const sh = contactShadow(T.hx + 0.1, T.hz + 0.1, 0.4);
  sh.position.set(T.x, 0.004, T.z);
  root.add(sh);

  // luminária pendente sobre a mesa
  const pend = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.8, 4), stdMat('#2a1c14'));
  cord.position.y = 2.3;
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#e86a52', roughness: 0.5, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.2, 24, 1, true), shadeMat);
  shade.position.y = 1.82;
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff2d6', emissive: '#ffd59a', emissiveIntensity: 2.2 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), bulbMat);
  bulb.position.y = 1.74;
  pend.add(cord, shade, bulb);
  pend.position.set(T.x, 0, T.z);
  root.add(pend);
  // a toalha balança de leve (corrente de ar da janela)
  updaters.push((dt, t) => { for (const [i, d] of drapes.entries()) d.rotation.x = Math.sin(t * 0.9 + i) * 0.012; });
  return { group: grp, pendantPos: new THREE.Vector3(T.x, 1.7, T.z) };
}

// ================================================================== cercadinho de brinquedos
function buildPlaypen(root, layout) {
  const { PEN: P } = layout;
  const grp = new THREE.Group();
  grp.name = 'cercadinho';
  const wood = woodMat('#e9d2a6', { key: 'f5-pen', rough: 0.6 });
  const cols = ['#e86a52', '#f2c14e', '#7fb0c8', '#7f9c8a'];
  const sides = [
    [P.x0, P.z0, P.x1, P.z0], [P.x1, P.z0, P.x1, P.z1], [P.x1, P.z1, P.x0, P.z1], [P.x0, P.z1, P.x0, P.z0],
  ];
  sides.forEach(([ax, az, bx, bz], si) => {
    const len = Math.hypot(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const rot = Math.atan2(bx - ax, bz - az);
    for (const y of [0.06, P.height - 0.03]) {
      const rail = new THREE.Mesh(rbox(0.04, 0.035, len, 0.01), wood);
      rail.position.set(mx, y, mz);
      rail.rotation.y = rot;
      grp.add(rail);
    }
    const n = 10;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, P.height - 0.06, 6), stdMat(cols[(i + si) % 4], { roughness: 0.6 }));
      bar.position.set(ax + (bx - ax) * k, P.height / 2, az + (bz - az) * k);
      grp.add(bar);
    }
  });
  // colchonete e brinquedos dentro
  const mat = new THREE.Mesh(rbox(P.x1 - P.x0 - 0.08, 0.03, P.z1 - P.z0 - 0.08, 0.012), stdMat('#f6e3c8', { roughness: 1 }));
  mat.position.set((P.x0 + P.x1) / 2, 0.015, (P.z0 + P.z1) / 2);
  grp.add(mat);
  const r = rng(9);
  const letters = ['A', 'B', 'C'];
  for (let i = 0; i < 3; i++) {
    const tex = canvasTexture(64, 64, (g, w, h) => {
      g.fillStyle = cols[i]; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff8ec'; g.font = '700 44px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(letters[i], w / 2, h / 2 + 3);
    }, { repeat: false });
    const cube = new THREE.Mesh(rbox(0.1, 0.1, 0.1, 0.012), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    cube.position.set(P.x0 + 0.25 + i * 0.12, 0.08 + (i === 2 ? 0.1 : 0), P.z1 - 0.3 + (i === 2 ? 0 : r() * 0.05));
    cube.rotation.y = r() * 0.8;
    grp.add(cube);
  }
  const ring = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.22, 8), stdMat('#c98a4a'));
  ring.position.set(P.x1 - 0.3, 0.14, P.z0 + 0.3);
  grp.add(ring);
  for (let i = 0; i < 4; i++) {
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.075 - i * 0.012, 0.022, 8, 20).rotateX(Math.PI / 2), stdMat(cols[i], { roughness: 0.5 }));
    tor.position.set(P.x1 - 0.3, 0.05 + i * 0.04, P.z0 + 0.3);
    grp.add(tor);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), stdMat('#e86a52', { roughness: 0.5 }));
  ball.position.set(P.x0 + 0.3, 0.1, P.z0 + 0.35);
  grp.add(ball);
  shadowAll(grp);
  root.add(grp);
  return grp;
}

// ================================================================== caminha (GOAL)
function buildDogBed(root, layout) {
  const { DOG_BED: B } = layout;
  const grp = new THREE.Group();
  grp.name = 'caminha';
  const plaid = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#c4794e'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,240,214,0.45)';
    for (let i = 0; i < w; i += 32) { g.fillRect(i, 0, 10, h); g.fillRect(0, i, w, 10); }
    g.fillStyle = 'rgba(110,52,30,0.35)';
    for (let i = 16; i < w; i += 32) { g.fillRect(i, 0, 4, h); g.fillRect(0, i, w, 4); }
  });
  const rimMat = new THREE.MeshStandardMaterial({ map: plaid, roughness: 1, emissive: '#ffb347', emissiveIntensity: 0 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(B.r - 0.1, 0.11, 14, 40).rotateX(Math.PI / 2), rimMat);
  rim.scale.set(1, 1.15, 1);
  rim.position.y = 0.11;
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(B.r - 0.12, B.r - 0.1, 0.08, 32), new THREE.MeshStandardMaterial({ color: '#f6eadb', roughness: 1 }));
  cushion.position.y = 0.06;
  // ossinho de pelúcia e mantinha
  const blanket = new THREE.Mesh(rbox(0.4, 0.02, 0.3, 0.01), new THREE.MeshStandardMaterial({ color: '#e8a87c', roughness: 1 }));
  blanket.position.set(0.12, 0.11, 0.08);
  blanket.rotation.set(0.05, 0.6, 0.04);
  grp.add(rim, cushion, blanket);
  // as dogs entram na caminha (game/ground.js): pisam na almofada e, andando para a borda, dão um pulinho por cima dela
  // em vez de atravessar
  cushion.userData.walkable = true;
  Object.assign(rim.userData, { walkable: true, rim: { r: B.r - 0.1, t: 0.11 } });
  grp.position.set(B.x, 0, B.z);
  shadowAll(grp);
  root.add(grp);
  const sh = contactShadow(B.r + 0.05, B.r + 0.05, 0.3);
  sh.position.set(B.x, 0.004, B.z);
  root.add(sh);
  return { group: grp, rimMat };
}

// ================================================================== tudo junto
export function buildProps({ root, layout, furniture }) {
  const { BEAR, COLLECTIBLES, BOX_PILLOWS } = layout;
  const updaters = [];
  const gate = buildPetGate(root, layout);
  const barricade = buildBarricade(root, layout);
  const table = buildTable(root, layout, updaters);
  const pen = buildPlaypen(root, layout);
  const bed = buildDogBed(root, layout);
  const treats = buildTreats(root, COLLECTIBLES, { glow: 0.22 });

  // ursinho sentado debaixo da mesa (deitado quando vai na boca)
  const bear = createTeddyBear(0.22);
  bear.userData.sit();
  bear.position.set(BEAR.x, 0, BEAR.z);
  bear.rotation.y = 0.35;
  root.add(bear);
  const bearHome = bear.position.clone();

  // ---- luzes da casa (sem sombra)
  const lights = [];
  const addLight = (pos, color, intensity, dist, decay = 1.6) => {
    const l = new THREE.PointLight(color, intensity, dist, decay);
    l.position.copy(pos);
    root.add(l);
    lights.push(l);
    return l;
  };
  addLight(furniture.sala.lampPos, '#ffc07a', 3.2, 7.5);
  addLight(table.pendantPos, '#ffc98a', 3.4, 6.5);
  addLight(furniture.hall.sconcePos, '#ffcf8a', 1.6, 4.5);
  addLight(new THREE.Vector3(-4.8, 0.9, 2.0), '#ffb36a', 0.9, 3.5); // calor perto da caminha
  // claridade fria das janelas
  addLight(new THREE.Vector3(-4.6, 1.6, -3.2), '#a9bde0', 1.2, 4.5);
  addLight(new THREE.Vector3(3.6, 1.7, -3.1), '#a9bde0', 1.0, 4.0);

  const bedSt = { on: false, k: 0 };
  /** @satisfies {import('../../../types').Fase5Props} */
  const props = {
    petGate: gate.gate,
    latch: gate.latch,
    pillowBox: barricade,
    bear: {
      object: bear, home: bearHome, setHighlight() {},
      setCarried(on) { if (on) bear.userData.lie(); else bear.userData.sit(); },
    },
    bed: { object: bed.group, setHighlight(on) { bedSt.on = !!on; } },
    collectibles: treats.list,
    fireflies: false,
    update(dt, t) {
      for (const f of updaters) f(dt, t);
      furniture.update(dt, t);
      treats.update(dt, t);
      bedSt.k = ease(bedSt.k, bedSt.on ? 1 : 0, dt, 4);
      bed.rimMat.emissiveIntensity = bedSt.k * (0.22 + 0.1 * Math.sin(t * 4));
    },
    reset() {
      gate.gate.setOpen(0);
      gate.latch.setTurn(0);
      barricade.setPos(BOX_PILLOWS.start.x, BOX_PILLOWS.start.z);
      barricade.setCollapse(0);
      bear.userData.sit();
      bedSt.on = false;
      for (const c of treats.list) c.reset();
    },
  };
  props.reset();
  return { props, seeThrough: [table.group, gate.gate.object, pen], lights };
}
