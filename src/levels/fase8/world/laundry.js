// FASE 8 · Móveis e eletrodomésticos da lavanderia (todos procedurais): armário de limpeza, secadora, máquina de
// lavar (o tambor gira e ela chacoalha na centrífuga; a mantinha fica em cima, no `top`), tanque com torneira que
// pinga, prateleiras com sabão e pregadores, balde com rodo, pilha de roupa, tábua de passar com o ferro e o tapete.
import * as THREE from 'three';
import { rng, rbox, canvasTexture, stdMat, woodMat, contactShadow, shadowAll } from '../../../world/util.js';

const TAU = Math.PI * 2;

/** Roupinhas: cores alegres de algodão. */
const CLOTH = ['#e8554a', '#7fb0c8', '#f2c14e', '#fff4e2', '#7f9c8a', '#e89ab0', '#9b8ac4'];

// ------------------------------------------------------------------ armário de limpeza
function buildCabinet(root, C) {
  const grp = new THREE.Group();
  grp.name = 'armario';
  const body = new THREE.Mesh(rbox(C.hx * 2, C.h, C.hz * 2, 0.02), stdMat('#9ec5b8', { roughness: 0.6 }));
  body.position.y = C.h / 2;
  grp.add(body);
  const doorMat = stdMat('#b4d6ca', { roughness: 0.55 });
  const knobMat = stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 });
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(rbox(C.hx - 0.03, C.h - 0.14, 0.018, 0.01), doorMat);
    door.position.set(s * (C.hx / 2), C.h / 2 + 0.02, C.hz + 0.006);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), knobMat);
    knob.position.set(s * 0.05, C.h / 2 + 0.05, C.hz + 0.03);
    // painelzinho rebaixado
    const panel = new THREE.Mesh(rbox(C.hx - 0.12, C.h * 0.6, 0.006, 0.006), stdMat('#a9cfc2', { roughness: 0.6 }));
    panel.position.set(s * (C.hx / 2), C.h / 2 + 0.06, C.hz + 0.018);
    grp.add(door, knob, panel);
  }
  // em cima: caixas e um rolo de papel
  const box = new THREE.Mesh(rbox(0.3, 0.16, 0.24, 0.015), stdMat('#d8b48a', { roughness: 0.85 }));
  box.position.set(-0.12, C.h + 0.08, 0);
  box.rotation.y = 0.1;
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 14), stdMat('#fbf7ef', { roughness: 0.9 }));
  roll.position.set(0.2, C.h + 0.06, 0.02);
  grp.add(box, roll);
  grp.position.set(C.x, 0, C.z);
  shadowAll(grp);
  root.add(grp);
}

// ------------------------------------------------------------------ máquinas
/** Roupas girando atrás do vidro: uma textura com manchas coloridas (o tambor gira o plano). */
function drumTexture(seed) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#3b4a55';
    g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, TAU); g.fill();
    const r = rng(seed);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = CLOTH[(r() * CLOTH.length) | 0];
      const a = r() * TAU, rr = 12 + r() * 40;
      g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr, 10 + r() * 14, 7 + r() * 9, r() * 3, 0, TAU); g.fill();
    }
    // furinhos do tambor
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 40; i++) { const a = r() * TAU, rr = r() * 60; g.beginPath(); g.arc(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr, 1.5, 0, TAU); g.fill(); }
  }, { repeat: false });
}

/**
 * Máquina de frente (lavar ou secar): caixa branca arredondada, painel com botão giratório e luzinhas, porta
 * redonda com aro cromado e vidro mostrando o tambor. → { group, drum, top (onde algo fica em cima) }
 */
function buildMachine(M, { panelColor = '#7fb0c8', seed = 1, dryer = false } = {}) {
  const grp = new THREE.Group();
  const w = M.hx * 2, d = M.hz * 2;
  const white = new THREE.MeshPhysicalMaterial({ color: '#f7f6f2', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const body = new THREE.Mesh(rbox(w, M.h, d, 0.04), white);
  body.position.y = M.h / 2;
  grp.add(body);
  // pezinhos e a faixa do rodapé
  const kick = new THREE.Mesh(rbox(w - 0.04, 0.05, 0.02, 0.008), stdMat('#d9d6cf', { roughness: 0.5 }));
  kick.position.set(0, 0.035, M.hz + 0.004);
  grp.add(kick);
  // painel de cima: faixa colorida, botão giratório e luzinhas
  const panel = new THREE.Mesh(rbox(w - 0.06, 0.12, 0.02, 0.01), stdMat(panelColor, { roughness: 0.45 }));
  panel.position.set(0, M.h - 0.09, M.hz + 0.004);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.03, 20).rotateX(Math.PI / 2), stdMat('#ececec', { roughness: 0.3, metalness: 0.4 }));
  dial.position.set(w * 0.28, M.h - 0.09, M.hz + 0.028);
  const tick = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, 0.004), stdMat('#4a3426'));
  tick.position.set(w * 0.28, M.h - 0.077, M.hz + 0.045);
  grp.add(panel, dial, tick);
  const ledMat = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffb347', emissiveIntensity: 0.6 });
  for (let i = 0; i < 3; i++) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), ledMat);
    led.position.set(-w * 0.3 + i * 0.04, M.h - 0.09, M.hz + 0.016);
    grp.add(led);
  }
  // porta redonda
  const doorY = M.h * 0.45;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 12, 40), new THREE.MeshStandardMaterial({ color: '#d6dade', roughness: 0.2, metalness: 0.8 }));
  ring.position.set(0, doorY, M.hz + 0.02);
  const gasket = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.02, 32).rotateX(Math.PI / 2), stdMat('#2d3338', { roughness: 0.8 }));
  gasket.position.set(0, doorY, M.hz + 0.006);
  const drum = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), new THREE.MeshStandardMaterial({ map: drumTexture(seed), roughness: 0.6 }));
  drum.position.set(0, doorY, M.hz + 0.019); // 3 mm à frente da borracha da porta
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#cfe6f2', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.32, depthWrite: false }));
  glass.scale.z = 0.35;
  glass.position.set(0, doorY, M.hz + 0.022);
  const handle = new THREE.Mesh(rbox(0.03, 0.08, 0.025, 0.01), stdMat('#d6dade', { roughness: 0.25, metalness: 0.7 }));
  handle.position.set(0.19, doorY, M.hz + 0.035);
  grp.add(ring, gasket, drum, glass, handle);
  if (dryer) {
    // uma meinha azul escapando da porta da secadora
    const sockTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.06, 4, 8), stdMat('#7fb0c8', { roughness: 0.95 }));
    sockTip.position.set(-0.1, doorY - 0.17, M.hz + 0.04);
    sockTip.rotation.set(0.4, 0, 0.9);
    grp.add(sockTip);
  }
  const top = new THREE.Object3D();
  top.position.set(0, M.h, 0);
  grp.add(top);
  shadowAll(grp);
  return { group: grp, drum, top };
}

// ------------------------------------------------------------------ tanque
function buildTank(root, T, updaters) {
  const grp = new THREE.Group();
  grp.name = 'tanque';
  const cab = new THREE.Mesh(rbox(T.hx * 2, T.h - 0.12, T.hz * 2 - 0.02, 0.015), woodMat('#d8b48a', { key: 'f8-tanque', rough: 0.7 }));
  cab.position.set(0, (T.h - 0.12) / 2, -0.01);
  grp.add(cab);
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(rbox(T.hx - 0.03, T.h - 0.22, 0.016, 0.008), woodMat('#e3c39b', { key: 'f8-tanque-porta', rough: 0.65 }));
    door.position.set(s * T.hx / 2, (T.h - 0.12) / 2 + 0.02, T.hz - 0.012);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 }));
    knob.position.set(s * 0.06, T.h * 0.55, T.hz + 0.008);
    grp.add(door, knob);
  }
  // pia (louça branca) com a bacia escura por dentro
  const sinkMat = new THREE.MeshPhysicalMaterial({ color: '#fbfbf8', roughness: 0.2, clearcoat: 0.8 });
  const rim = new THREE.Mesh(rbox(T.hx * 2 + 0.03, 0.12, T.hz * 2 + 0.02, 0.03), sinkMat);
  rim.position.set(0, T.h - 0.06, 0);
  const basin = new THREE.Mesh(rbox(T.hx * 2 - 0.12, 0.02, T.hz * 2 - 0.12, 0.008), stdMat('#d9e6ec', { roughness: 0.15 }));
  basin.position.set(0, T.h + 0.003, 0);
  grp.add(rim, basin);
  // torneira cromada com as manoplas
  const chrome = new THREE.MeshStandardMaterial({ color: '#dfe4e8', roughness: 0.15, metalness: 0.9 });
  const neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.18, 0), new THREE.Vector3(0, 0.24, 0.06), new THREE.Vector3(0, 0.2, 0.14),
  ]), 16, 0.012, 8), chrome);
  neck.position.set(0, T.h, -T.hz + 0.06);
  grp.add(neck);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.035, 10), chrome);
    h.position.set(s * 0.09, T.h + 0.02, -T.hz + 0.06);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), stdMat(s < 0 ? '#e8554a' : '#3f8fb0', { roughness: 0.3 }));
    cap.position.set(s * 0.09, T.h + 0.045, -T.hz + 0.06);
    grp.add(h, cap);
  }
  // sabão em barra e escovinha na borda
  const soap = new THREE.Mesh(rbox(0.08, 0.025, 0.05, 0.01), stdMat('#f7c6d4', { roughness: 0.5 }));
  soap.position.set(-T.hx + 0.1, T.h + 0.012, T.hz - 0.05);
  const brush = new THREE.Mesh(rbox(0.1, 0.03, 0.04, 0.01), stdMat('#f2c14e', { roughness: 0.6 }));
  brush.position.set(T.hx - 0.12, T.h + 0.015, T.hz - 0.04);
  brush.rotation.y = 0.4;
  grp.add(soap, brush);
  // pinga: a gota cresce, cai e some (avança por dt)
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: '#cfe8f7', roughness: 0.05, transparent: true, opacity: 0.85 }));
  const dropY0 = T.h + 0.19;
  drop.position.set(0, dropY0, -T.hz + 0.2);
  grp.add(drop);
  let dt0 = 0;
  updaters.push((dt) => {
    dt0 = (dt0 + dt) % 2.2;
    if (dt0 < 1.6) { drop.position.y = dropY0; drop.scale.setScalar(0.4 + 0.6 * (dt0 / 1.6)); }
    else { const k = (dt0 - 1.6) / 0.6; drop.position.y = dropY0 - 0.18 * k * k; drop.scale.setScalar(1); }
    drop.visible = drop.position.y > T.h + 0.01;
  });
  grp.position.set(T.x, 0, T.z);
  shadowAll(grp);
  root.add(grp);
}

// ------------------------------------------------------------------ prateleiras
function bottle(color, h = 0.22) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(rbox(0.11, h, 0.08, 0.025), new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.5 }));
  body.position.y = h / 2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10), stdMat('#fbf7ef', { roughness: 0.5 }));
  cap.position.set(0.025, h + 0.012, 0);
  const label = new THREE.Mesh(rbox(0.09, h * 0.4, 0.006, 0.004), stdMat('#ffffff', { roughness: 0.6 }));
  label.position.set(0, h * 0.45, 0.041);
  g.add(body, cap, label);
  return g;
}
function buildShelves(root, layout) {
  const { DRYER, WASHER, TANK, WORLD } = layout;
  const zWall = WORLD.bounds.minZ;
  const plankMat = woodMat('#b98a5e', { key: 'f8-prateleira', rough: 0.6 });
  const bracketMat = stdMat('#fbf7ef', { roughness: 0.5 });
  const shelf = (x0, x1, y) => {
    const grp = new THREE.Group();
    const plank = new THREE.Mesh(rbox(x1 - x0, 0.03, 0.26, 0.008), plankMat);
    plank.position.set((x0 + x1) / 2, y, zWall + 0.135);
    grp.add(plank);
    for (const x of [x0 + 0.12, x1 - 0.12]) {
      const br = new THREE.Mesh(rbox(0.02, 0.14, 0.2, 0.004), bracketMat);
      br.position.set(x, y - 0.085, zWall + 0.11);
      grp.add(br);
    }
    root.add(grp);
    return grp;
  };
  const s1 = shelf(DRYER.x - DRYER.hx - 0.05, WASHER.x + WASHER.hx + 0.05, 1.5);
  const y1 = 1.5 + 0.015;
  const cols = ['#3f8fb0', '#e8554a', '#7f9c8a', '#f2c14e'];
  cols.forEach((c, i) => {
    const b = bottle(c, 0.18 + (i % 2) * 0.05);
    b.position.set(DRYER.x - 0.22 + i * 0.15, y1, zWall + 0.13);
    b.rotation.y = (i - 1.5) * 0.08;
    s1.add(b);
  });
  // pote de pregadores (vidro com pregadores coloridos)
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 16, 1, true), new THREE.MeshPhysicalMaterial({ color: '#dceef5', roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  jar.position.set(WASHER.x + 0.05, y1 + 0.07, zWall + 0.13);
  s1.add(jar);
  const r = rng(23);
  for (let i = 0; i < 9; i++) {
    const pin = new THREE.Mesh(rbox(0.012, 0.06, 0.014, 0.004), stdMat(CLOTH[i % CLOTH.length], { roughness: 0.5 }));
    pin.position.set(WASHER.x + 0.05 + (r() - 0.5) * 0.07, y1 + 0.03 + r() * 0.06, zWall + 0.13 + (r() - 0.5) * 0.07);
    pin.rotation.set(r(), r() * 3, r());
    s1.add(pin);
  }
  // pilha de toalhas dobradas
  ['#fff4e2', '#e89ab0', '#7fb0c8'].forEach((c, i) => {
    const tw = new THREE.Mesh(rbox(0.26, 0.05, 0.2, 0.02), stdMat(c, { roughness: 0.95 }));
    tw.position.set(WASHER.x + 0.24, y1 + 0.026 + i * 0.05, zWall + 0.13);
    tw.rotation.y = (i - 1) * 0.06;
    s1.add(tw);
  });
  // prateleira do tanque com cestinhas e uma planta pendente
  const s2 = shelf(TANK.x - TANK.hx, TANK.x + TANK.hx, 1.55);
  const y2 = 1.55 + 0.015;
  for (const [dx, c] of /** @type {[number, string][]} */ ([[-0.25, '#d8b48a'], [0.05, '#c99a6a']])) {
    const bk = new THREE.Mesh(rbox(0.22, 0.13, 0.18, 0.02), stdMat(c, { roughness: 0.9 }));
    bk.position.set(TANK.x + dx, y2 + 0.065, zWall + 0.13);
    s2.add(bk);
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 12), stdMat('#fbf7ef', { roughness: 0.6 }));
  pot.position.set(TANK.x + 0.32, y2 + 0.05, zWall + 0.13);
  s2.add(pot);
  const leaf = stdMat('#6f9a58', { roughness: 0.8 });
  for (let i = 0; i < 7; i++) {
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), leaf);
    v.position.set(TANK.x + 0.32 + (r() - 0.5) * 0.12, y2 + 0.09 - i * 0.05, zWall + 0.17 + (r() - 0.3) * 0.05);
    v.scale.set(1, 0.6, 1);
    s2.add(v);
  }
  shadowAll(s1);
  shadowAll(s2);
}

// ------------------------------------------------------------------ balde e pilha de roupa
function buildBucket(root, B) {
  const grp = new THREE.Group();
  grp.name = 'balde';
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(B.r, B.r * 0.82, 0.26, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#3f8fb0', roughness: 0.45, side: THREE.DoubleSide }));
  bucket.position.y = 0.13;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(B.r * 0.82, 20).rotateX(-Math.PI / 2), stdMat('#2f7a99', { roughness: 0.5 }));
  bottom.position.y = 0.012;
  const water = new THREE.Mesh(new THREE.CircleGeometry(B.r * 0.95, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#cfe8f2', roughness: 0.05, transparent: true, opacity: 0.8 }));
  water.position.y = 0.2;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(B.r, 0.006, 6, 20, Math.PI), stdMat('#9aa3a8', { roughness: 0.3, metalness: 0.7 }));
  handle.position.y = 0.26;
  handle.rotation.y = 0.5;
  // rodo apoiado no balde
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 8), woodMat('#c99a6a', { key: 'f8-rodo' }));
  stick.position.set(0.05, 0.62, -0.05);
  stick.rotation.set(-0.12, 0, -0.22);
  const head = new THREE.Mesh(rbox(0.32, 0.05, 0.05, 0.01), stdMat('#e8554a', { roughness: 0.6 }));
  head.position.set(0.19, 0.04, 0.02);
  grp.add(bucket, bottom, water, handle, stick, head);
  grp.position.set(B.x, 0, B.z);
  shadowAll(grp);
  root.add(grp);
}

function buildPile(root, P) {
  const grp = new THREE.Group();
  grp.name = 'pilha-de-roupa';
  const r = rng(41);
  for (let i = 0; i < 11; i++) {
    const a = r() * TAU, rr = r() * P.r * 0.7;
    const m = new THREE.Mesh(rbox(0.22 + r() * 0.16, 0.06 + r() * 0.04, 0.16 + r() * 0.1, 0.03), stdMat(CLOTH[i % CLOTH.length], { roughness: 0.95 }));
    m.position.set(Math.cos(a) * rr, 0.04 + (i / 11) * 0.26 * (1 - rr / P.r), Math.sin(a) * rr);
    m.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6);
    grp.add(m);
  }
  grp.position.set(P.x, 0, P.z);
  shadowAll(grp);
  root.add(grp);
  const sh = contactShadow(P.r * 1.1, P.r * 1.1, 0.35);
  sh.position.set(P.x, 0.005, P.z);
  root.add(sh);
}

// ------------------------------------------------------------------ tábua de passar e ferro
function coverTexture() {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#cfe6ee'; g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 26; i++) {
      const cx = r() * w, cy = r() * h;
      g.fillStyle = r() < 0.5 ? '#f2a7b8' : '#f7d27a';
      for (let a = 0; a < 5; a++) { g.beginPath(); g.ellipse(cx + Math.cos(a * 1.26) * 4, cy + Math.sin(a * 1.26) * 4, 3.2, 2, a * 1.26, 0, TAU); g.fill(); }
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, 1.6, 0, TAU); g.fill();
    }
  });
}
function buildIroningBoard(root, Bd) {
  const grp = new THREE.Group();
  grp.name = 'tabua-de-passar';
  // tampo: retângulo arredondado com uma ponta afinada (para o leste)
  const L = Bd.hx * 2, W = 0.34;
  const s = new THREE.Shape();
  s.moveTo(-L / 2 + 0.06, -W / 2);
  s.lineTo(L / 2 - 0.3, -W / 2);
  s.quadraticCurveTo(L / 2, -W * 0.3, L / 2, 0);
  s.quadraticCurveTo(L / 2, W * 0.3, L / 2 - 0.3, W / 2);
  s.lineTo(-L / 2 + 0.06, W / 2);
  s.quadraticCurveTo(-L / 2, W / 2, -L / 2, W / 2 - 0.06);
  s.lineTo(-L / 2, -W / 2 + 0.06);
  s.quadraticCurveTo(-L / 2, -W / 2, -L / 2 + 0.06, -W / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3 }).rotateX(-Math.PI / 2);
  const tex = coverTexture();
  tex.repeat.set(1 / L, 1 / W);
  tex.offset.set(0.5, 0.5);
  const top = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  top.position.y = Bd.h - 0.035;
  grp.add(top);
  // pernas em X (dois pares, um de cada lado) e o descanso do ferro
  const metal = new THREE.MeshStandardMaterial({ color: '#dfe2e4', roughness: 0.3, metalness: 0.7 });
  const legLen = Math.hypot(Bd.h, 0.7);
  for (const side of [-1, 1]) for (const lean of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, legLen, 8), metal);
    leg.position.set(lean * 0.02, Bd.h / 2, side * (W / 2 - 0.05));
    leg.rotation.z = lean * Math.atan2(0.7, Bd.h);
    grp.add(leg);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.06, 4, 8).rotateZ(Math.PI / 2), stdMat('#4a4a46', { roughness: 0.7 }));
    foot.position.set(lean * 0.35, 0.018, side * (W / 2 - 0.05));
    grp.add(foot);
  }
  const rest = new THREE.Mesh(rbox(0.18, 0.012, 0.16, 0.004), metal);
  rest.position.set(-L / 2 - 0.06, Bd.h - 0.02, 0);
  grp.add(rest);
  // ferro de passar (desligado) em pé no descanso
  const iron = new THREE.Group();
  const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 3).scale(1, 1, 0.6), new THREE.MeshStandardMaterial({ color: '#d6dade', roughness: 0.15, metalness: 0.9 }));
  sole.rotation.y = Math.PI / 6;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10, 0, TAU, 0, Math.PI / 2).scale(1.4, 0.9, 0.75), new THREE.MeshPhysicalMaterial({ color: '#5fc3b8', roughness: 0.3, clearcoat: 0.7 }));
  shell.position.y = 0.01;
  const grip = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 8, 16, Math.PI), stdMat('#3a4a4a', { roughness: 0.5 }));
  grip.position.y = 0.06;
  iron.add(sole, shell, grip);
  iron.rotation.z = Math.PI / 2;
  iron.position.set(-L / 2 - 0.06, Bd.h + 0.05, 0);
  grp.add(iron);
  grp.position.set(Bd.x, 0, Bd.z);
  shadowAll(grp);
  root.add(grp);
  return grp;
}

// ------------------------------------------------------------------ tapete
function buildRug(root, R) {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#f2c6b4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 5;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.12 * i, h * 0.12 * i, 0, 0, TAU); g.stroke(); }
    const r = rng(2);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '150,80,60'},0.08)`; g.fillRect(r() * w, r() * h, 2, 2); }
  }, { repeat: false });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  rug.scale.set(R.rx, 1, R.rz);
  rug.position.set(R.x, 0.004, R.z);
  rug.receiveShadow = true;
  root.add(rug);
}

/**
 * @param {{ root: THREE.Object3D, layout: import('../../../types').LevelLayout }} args
 * → { washer: { group, drum, top, setSpin, update }, board, update(dt, t) }
 */
export function buildLaundry({ root, layout }) {
  const { CABINET, DRYER, WASHER, TANK, BUCKET, PILE, BOARD, RUG } = layout;
  const updaters = [];
  buildCabinet(root, CABINET);
  const dryer = buildMachine(DRYER, { panelColor: '#e89ab0', seed: 7, dryer: true });
  dryer.group.name = 'secadora';
  dryer.group.position.set(DRYER.x, 0, DRYER.z);
  root.add(dryer.group);
  const washer = buildMachine(WASHER, { panelColor: '#7fb0c8', seed: 3 });
  washer.group.name = 'maquina';
  const base = new THREE.Vector3(WASHER.x, 0, WASHER.z);
  washer.group.position.copy(base);
  root.add(washer.group);
  for (const [M, w] of [[DRYER, 0.7], [WASHER, 0.7]]) {
    const sh = contactShadow(M.hx * 1.3, M.hz * 1.3, 0.35);
    sh.position.set(M.x, 0.005, M.z + 0.04);
    root.add(sh);
    void w;
  }
  buildTank(root, TANK, updaters);
  buildShelves(root, layout);
  buildBucket(root, BUCKET);
  buildPile(root, PILE);
  const board = buildIroningBoard(root, BOARD);
  buildRug(root, RUG);

  // centrífuga: o tambor gira e a máquina chacoalha (spin 0..1)
  const st = { spin: 0, ang: 0, t: 0 };
  updaters.push((dt, t) => {
    st.t = t;
    st.ang += dt * (0.4 + st.spin * 14);
    washer.drum.rotation.z = -st.ang;
    dryer.drum.rotation.z = -t * 0.3;
    const k = st.spin;
    washer.group.position.set(
      base.x + Math.sin(t * 47) * 0.006 * k,
      Math.abs(Math.sin(t * 31)) * 0.006 * k,
      base.z + Math.cos(t * 53) * 0.004 * k,
    );
    washer.group.rotation.z = Math.sin(t * 39) * 0.012 * k;
  });
  return {
    washer: { ...washer, setSpin(k) { st.spin = THREE.MathUtils.clamp(k, 0, 1); } },
    board,
    update: (dt, t) => { for (const f of updaters) f(dt, t); },
  };
}
