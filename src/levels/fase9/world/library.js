// FASE 9 · A biblioteca: duas estantes altas cheias de livros (InstancedMesh, cores variadas, alguns tombados), a
// lareira acesa com o fogo que tremula, consolo com relógio e porta-retratos, o trilho de latão da escadinha, a
// escadinha de rodinhas (degraus largos e patamar), o globo terrestre de rodinhas, a poltrona do vovô com o cardigã,
// a mesinha com o abajur (onde os óculos e o livro ficam), o abajur de pé, o pufe e o tapete persa.
import * as THREE from 'three';
import { rng, rbox, canvasTexture, stdMat, woodMat, contactShadow, shadowAll } from '../../../world/util.js';

const TAU = Math.PI * 2;
const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const SHELF_YS = [0.1, 0.5, 0.9, 1.3, 1.7, 2.1];

// ------------------------------------------------------------------ estantes
/** Estante de madeira escura com prateleiras em SHELF_YS e livros instanciados (deixa um vão livre em `gapX`). */
function buildBookcase(root, S, { seed, gap = null }) {
  const grp = new THREE.Group();
  const W = S.x1 - S.x0, D = S.depth, H = S.h;
  const cx = (S.x0 + S.x1) / 2;
  const zBack = S.z - D / 2;
  const wood = woodMat('#4a2e1c', { key: 'f9-estante', rough: 0.55 });
  const t = 0.035;
  // laterais, fundo, topo com cornija e as prateleiras
  for (const x of [S.x0 + t / 2, S.x1 - t / 2]) {
    const s = new THREE.Mesh(rbox(t, H, D, 0.008), wood);
    s.position.set(x, H / 2, S.z);
    grp.add(s);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * t, H - 0.02, 0.015), woodMat('#3a2416', { key: 'f9-estante-fundo', rough: 0.7 }));
  back.position.set(cx, H / 2, zBack + 0.01);
  grp.add(back);
  const corn = new THREE.Mesh(rbox(W + 0.06, 0.06, D + 0.05, 0.015), wood);
  corn.position.set(cx, H + 0.03, S.z + 0.01);
  grp.add(corn);
  // montantes intermediários a cada ~0,9 m
  const bays = Math.max(1, Math.round(W / 0.9));
  for (let i = 1; i < bays; i++) {
    const m = new THREE.Mesh(rbox(t * 0.8, H - 0.04, D - 0.02, 0.006), wood);
    m.position.set(S.x0 + (W * i) / bays, H / 2, S.z);
    grp.add(m);
  }
  for (const y of SHELF_YS) {
    const sh = new THREE.Mesh(rbox(W - 2 * t + 0.004, 0.028, D - 0.01, 0.006), wood);
    sh.position.set(cx, y - 0.014, S.z + 0.005);
    grp.add(sh);
  }
  // livros: uma InstancedMesh com cor por instância
  const r = rng(seed);
  const palette = ['#8c2f2a', '#2f5a6b', '#3d6b3a', '#c9a24a', '#5a3a6b', '#a8562e', '#1f3a52', '#7a1f2a', '#d8cba8', '#4a5a2a', '#b07a3a', '#2a2a32'];
  const items = [];
  for (let si = 0; si < SHELF_YS.length; si++) {
    const y = SHELF_YS[si];
    const clear = si < SHELF_YS.length - 1 ? SHELF_YS[si + 1] - y - 0.04 : 0.3;
    let x = S.x0 + t + 0.01;
    while (x < S.x1 - t - 0.04) {
      // vão livre (os óculos ficam ali) e um respiro aleatório com um livro tombado
      if (gap && si === gap.shelf && x > gap.x - gap.w / 2 - 0.04 && x < gap.x + gap.w / 2) { x = gap.x + gap.w / 2 + 0.01; continue; }
      const w = 0.025 + r() * 0.028;
      const h = Math.min(clear, 0.18 + r() * 0.13);
      const d = Math.min(D - 0.04, 0.17 + r() * 0.08);
      if (r() < 0.06 && x + 0.2 < S.x1 - t) {
        // pilha deitada
        const n = 2 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) items.push({ x: x + 0.1, y: y + 0.015 + k * 0.032, z: S.z + 0.03, w: 0.2 - k * 0.012, h: 0.03, d: d - k * 0.01, rot: 0, lay: true, c: palette[Math.floor(r() * palette.length)] });
        x += 0.23;
        continue;
      }
      const lean = r() < 0.05 ? 0.25 : 0;
      items.push({ x: x + w / 2 + (lean ? h * 0.12 : 0), y: y + h / 2, z: S.z + (D - d) / 2 - 0.005 + 0.012, w, h, d, rot: lean, lay: false, c: palette[Math.floor(r() * palette.length)] });
      x += w + 0.002 + (lean ? h * 0.25 : 0);
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const books = new THREE.InstancedMesh(geo, mat, items.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  items.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -b.rot);
    m4.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    books.setMatrixAt(i, m4);
    books.setColorAt(i, col.set(b.c).multiplyScalar(0.85 + r() * 0.25));
  });
  books.castShadow = true;
  books.receiveShadow = true;
  grp.add(books);
  shadowAll(grp);
  root.add(grp);
  return grp;
}

// ------------------------------------------------------------------ lareira
function flameTexture() {
  return canvasTexture(64, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h * 0.78, 2, w / 2, h * 0.7, h * 0.6);
    grd.addColorStop(0, 'rgba(255,250,210,1)');
    grd.addColorStop(0.25, 'rgba(255,200,90,0.95)');
    grd.addColorStop(0.55, 'rgba(240,110,30,0.6)');
    grd.addColorStop(1, 'rgba(200,50,10,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(w / 2, 4);
    g.bezierCurveTo(w * 0.95, h * 0.45, w * 0.95, h * 0.95, w / 2, h - 2);
    g.bezierCurveTo(w * 0.05, h * 0.95, w * 0.05, h * 0.45, w / 2, 4);
    g.fill();
  }, { repeat: false });
}

function buildFireplace(root, F, B, photo) {
  const grp = new THREE.Group();
  grp.name = 'lareira';
  const W = F.x1 - F.x0, cx = (F.x0 + F.x1) / 2;
  const zF = B.minZ + F.depth; // frente da lareira
  const stone = new THREE.MeshStandardMaterial({ color: '#cbbfae', roughness: 0.85 });
  const dark = stdMat('#151110', { roughness: 0.95 });
  // corpo de pedra com a abertura (três blocos em volta da boca)
  const mouthW = 0.72, mouthH = 0.62;
  for (const [x, w, y0, h] of [[F.x0 + (W - mouthW) / 4, (W - mouthW) / 2, 0, F.h], [F.x1 - (W - mouthW) / 4, (W - mouthW) / 2, 0, F.h], [cx, mouthW, mouthH, F.h - mouthH]]) {
    const b = new THREE.Mesh(rbox(w, h, F.depth, 0.015), stone);
    b.position.set(x, y0 + h / 2, B.minZ + F.depth / 2);
    grp.add(b);
  }
  const firebox = new THREE.Mesh(new THREE.BoxGeometry(mouthW, mouthH, F.depth - 0.04), dark);
  firebox.position.set(cx, mouthH / 2, B.minZ + F.depth / 2 - 0.03);
  grp.add(firebox);
  // consolo de madeira e a pedra da frente (laje rasa, rente ao chão)
  const mantel = new THREE.Mesh(rbox(W + 0.14, 0.06, F.depth + 0.1, 0.012), woodMat('#5a3a24', { key: 'f9-consolo', rough: 0.5 }));
  mantel.position.set(cx, F.h + 0.03, B.minZ + F.depth / 2 + 0.03);
  grp.add(mantel);
  const hearth = new THREE.Mesh(rbox(W + 0.1, 0.012, F.hearth, 0.004), stdMat('#8a7d6c', { roughness: 0.8 }));
  hearth.position.set(cx, 0.006, zF + F.hearth / 2);
  grp.add(hearth);
  // lenha e o fogo (planos aditivos que tremulam) + brasas
  const logMat = woodMat('#4a2e1c', { key: 'f9-lenha', rough: 0.9 });
  for (const [x, ry] of [[-0.12, 0.35], [0.12, -0.3], [0, 0]]) {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.42, 10).rotateZ(Math.PI / 2), logMat);
    lg.position.set(cx + x, 0.06 + (x === 0 ? 0.06 : 0), B.minZ + F.depth / 2 - 0.02);
    lg.rotation.y = ry;
    grp.add(lg);
  }
  const embers = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff6a1a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.position.set(cx, 0.03, B.minZ + F.depth / 2 - 0.02);
  grp.add(embers);
  const fTex = flameTexture();
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.34), new THREE.MeshBasicMaterial({ map: fTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    fm.position.set(cx - 0.18 + i * 0.09, 0.2, B.minZ + F.depth / 2 - 0.02 + (i % 2) * 0.03);
    grp.add(fm);
    flames.push({ m: fm, ph: i * 1.7 });
  }
  // decoração do consolo: relógio, castiçais e o porta-retratos das dogs
  const clock = new THREE.Group();
  const body = new THREE.Mesh(rbox(0.24, 0.2, 0.09, 0.03), woodMat('#6b4630', { key: 'f9-relogio', rough: 0.4 }));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), stdMat('#f4ecd8', { roughness: 0.4 }));
  face.position.z = 0.047;
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.05, 0.003).translate(0, 0.022, 0), stdMat('#1f1612'));
  hand.position.z = 0.05;
  clock.add(body, face, hand);
  clock.position.set(cx, F.h + 0.16, B.minZ + F.depth / 2);
  grp.add(clock);
  const brass = stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 });
  const candle = stdMat('#f5ead2', { roughness: 0.6 });
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.14, 12), brass);
    st.position.set(cx + s * 0.5, F.h + 0.13, B.minZ + F.depth / 2);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 10), candle);
    c.position.set(cx + s * 0.5, F.h + 0.26, B.minZ + F.depth / 2);
    grp.add(st, c);
  }
  const frame = new THREE.Mesh(rbox(0.2, 0.16, 0.02, 0.006), brass);
  frame.position.set(cx + 0.3, F.h + 0.14, B.minZ + F.depth / 2 - 0.02);
  frame.rotation.x = -0.12;
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshStandardMaterial({ map: photo, roughness: 0.6 }));
  pic.position.set(0, 0, 0.0115);
  frame.add(pic);
  grp.add(frame);
  shadowAll(grp);
  for (const f of flames) f.m.castShadow = false;
  embers.castShadow = false;
  root.add(grp);
  return {
    group: grp,
    update(dt, t) {
      for (const f of flames) {
        const k = 0.85 + 0.25 * Math.sin(t * 9 + f.ph) * Math.sin(t * 5.3 + f.ph * 2);
        f.m.scale.set(0.9 + 0.2 * Math.sin(t * 7 + f.ph), k, 1);
        f.m.position.y = 0.06 + 0.17 * k;
        f.m.rotation.y = Math.sin(t * 0.6 + f.ph) * 0.4;
      }
      embers.material.opacity = 0.7 + 0.2 * Math.sin(t * 3.1);
      hand.rotation.z = -t * 0.05;
    },
  };
}

/** Foto das duas dogs no porta-retratos (desenho simples). */
function photoTexture() {
  return canvasTexture(128, 96, (g, w, h) => {
    g.fillStyle = '#cfe0e8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9cc48a'; g.fillRect(0, h * 0.62, w, h);
    for (const [x, c] of /** @type {[number, string][]} */ ([[44, '#f3e2c4'], [84, '#fbfbf6']])) {
      g.fillStyle = c;
      g.beginPath(); g.ellipse(x, 58, 16, 12, 0, 0, TAU); g.fill();
      g.beginPath(); g.arc(x - 10, 40, 11, 0, TAU); g.fill();
      g.fillStyle = '#1a120c';
      g.beginPath(); g.arc(x - 13, 38, 1.8, 0, TAU); g.arc(x - 6, 38, 1.8, 0, TAU); g.fill();
    }
  }, { repeat: false });
}

// ------------------------------------------------------------------ escadinha e globo
/** Escadinha de biblioteca com rodinhas: degraus largos do sul para o norte até o patamar, corrimãos e o gancho no trilho. */
function buildLadder(root, L, laneZ) {
  const grp = new THREE.Group();
  grp.name = 'escadinha';
  const wood = woodMat('#7a4f2e', { key: 'f9-escada', rough: 0.5 });
  const tread = woodMat('#8a5d38', { key: 'f9-degrau', rough: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c99a45', roughness: 0.3, metalness: 0.8, emissive: '#ffcf7a', emissiveIntensity: 0 });
  const half = L.half;
  const n = L.steps;
  const rise = L.top / n;
  const front = half, back = -half;
  // degraus (do sul +Z para o norte −Z) e o patamar
  for (let i = 1; i <= n; i++) {
    const isTop = i === n;
    const z1 = front - 0.04 - (i - 1) * ((2 * half - 0.42) / (n - 1));
    const depth = isTop ? 0.36 : 0.2;
    const zc = isTop ? back + 0.2 : z1 - depth / 2;
    const tr = new THREE.Mesh(rbox(half * 2 - 0.12, 0.04, depth, 0.01), tread);
    tr.position.set(0, i * rise - 0.02, zc);
    grp.add(tr);
    // espelho do degrau
    const riser = new THREE.Mesh(rbox(half * 2 - 0.14, rise - 0.04, 0.02, 0.006), wood);
    riser.position.set(0, i * rise - rise / 2 - 0.02, zc + depth / 2 - 0.012);
    grp.add(riser);
  }
  // laterais em degrau (vigas diagonais) e os montantes de trás que sobem até o trilho
  for (const sx of [-1, 1]) {
    const x = sx * (half - 0.04);
    const len = Math.hypot(L.top, 2 * half - 0.3);
    const beam = new THREE.Mesh(rbox(0.04, 0.09, len, 0.01), wood);
    beam.position.set(x, L.top / 2, 0.05);
    beam.rotation.x = Math.atan2(L.top, 2 * half - 0.3);
    grp.add(beam);
    const post = new THREE.Mesh(rbox(0.045, 2.15, 0.045, 0.01), wood);
    post.position.set(x, 2.15 / 2, back + 0.03);
    grp.add(post);
    // corrimão de latão
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, Math.hypot(0.62, 2 * half - 0.2), 8), brass);
    rail.position.set(x, L.top / 2 + 0.55, 0.0);
    rail.rotation.x = Math.atan2(2 * half - 0.2, 0.62) - Math.PI / 2 + 0.75;
    grp.add(rail);
    // gancho no trilho do alto
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), brass);
    hook.position.set(x, 2.17, back + 0.0);
    hook.rotation.y = Math.PI / 2;
    grp.add(hook);
  }
  // rodinhas
  const wheelMat = stdMat('#2a2420', { roughness: 0.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 14).rotateZ(Math.PI / 2), wheelMat);
    w.position.set(sx * (half - 0.06), 0.035, sz * (half - 0.08));
    grp.add(w);
  }
  shadowAll(grp);
  const sh = contactShadow(half * 1.1, half * 1.1, 0.4);
  sh.position.y = 0.004;
  const holder = new THREE.Group();
  holder.add(grp, sh);
  holder.position.set(L.start.x, 0, L.start.z);
  root.add(holder);
  void laneZ;
  const st = { hl: false, glow: 0 };
  return {
    object: holder,
    setPos(x, z) { holder.position.set(x, 0, z); },
    setHighlight(on) { st.hl = !!on; },
    update(dt, t) {
      st.glow = ease(st.glow, st.hl ? 1 : 0, dt, 5);
      brass.emissiveIntensity = st.glow * (0.35 + 0.15 * Math.sin(t * 4));
    },
  };
}

/** Globo terrestre num pé de madeira com rodinhas (gira quando anda). */
function buildGlobe(root, G) {
  const holder = new THREE.Group();
  holder.name = 'globo';
  const wood = woodMat('#5a3a24', { key: 'f9-globo', rough: 0.5 });
  const brass = stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 });
  const r = rng(4);
  const tex = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#5f8fb0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9b77a';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      const cx = r() * w, cy = h * (0.25 + r() * 0.5);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU;
        const rr = 10 + r() * 18;
        g.lineTo(cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr);
      }
      g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < w; x += 21) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 16; y < h; y += 21) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  const R = 0.17;
  const tilt = new THREE.Group();
  tilt.position.y = 0.62;
  tilt.rotation.z = 0.41;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.008, 6, 40, Math.PI * 1.3), brass);
  ring.rotation.z = -Math.PI * 0.15;
  tilt.add(ball, ring);
  holder.add(tilt);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.4, 10), wood);
  stem.position.y = 0.26;
  holder.add(stem);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const leg = new THREE.Mesh(rbox(0.03, 0.03, 0.22, 0.008), wood);
    leg.position.set(Math.sin(a) * 0.09, 0.07, Math.cos(a) * 0.09);
    leg.rotation.set(0.5, a, 0);
    holder.add(leg);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), stdMat('#2a2420'));
    w.position.set(Math.sin(a) * 0.18, 0.022, Math.cos(a) * 0.18);
    holder.add(w);
  }
  shadowAll(holder);
  const sh = contactShadow(G.half * 1.2, G.half * 1.2, 0.35);
  sh.position.y = 0.004;
  holder.add(sh);
  holder.position.set(G.start.x, 0, G.start.z);
  root.add(holder);
  const st = { x: G.start.x };
  return {
    object: holder,
    setPos(x, z) {
      ball.rotation.y += (x - st.x) / R;
      st.x = x;
      holder.position.set(x, 0, z);
    },
  };
}

// ------------------------------------------------------------------ poltrona, mesinha e sala de leitura
function buildReadingCorner(root, layout) {
  const { ARMCHAIR: A, SIDE_TABLE: T, FOOTSTOOL: F, FLOOR_LAMP: Lp, RUG, TABLE_SPOTS } = layout;
  const grp = new THREE.Group();
  grp.name = 'sala-de-leitura';
  // tapete persa oval
  const rugTex = canvasTexture(256, 160, (g, w, h) => {
    g.fillStyle = '#7a2a28'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8b25a'; g.lineWidth = 6;
    g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 10, h / 2 - 10, 0, 0, TAU); g.stroke();
    g.strokeStyle = '#1f3a52'; g.lineWidth = 10;
    g.beginPath(); g.ellipse(w / 2, h / 2, w / 2 - 24, h / 2 - 22, 0, 0, TAU); g.stroke();
    g.fillStyle = '#d8b25a';
    g.beginPath(); g.ellipse(w / 2, h / 2, 34, 22, 0, 0, TAU); g.fill();
    g.fillStyle = '#1f3a52';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 70, h / 2 + Math.sin(a) * 40, 9, 6, a, 0, TAU); g.fill(); }
  }, { repeat: false });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 }));
  rug.scale.set(RUG.rx, 1, RUG.rz);
  rug.position.set(RUG.x, 0.006, RUG.z);
  rug.receiveShadow = true;
  grp.add(rug);

  // poltrona de orelhas (veludo verde), com almofada e o cardigã do vovô
  const chair = new THREE.Group();
  chair.position.set(A.x, 0, A.z);
  chair.rotation.y = A.yaw;
  const velvet = new THREE.MeshPhysicalMaterial({ color: '#2f5a46', roughness: 0.8, sheen: 0.8, sheenColor: new THREE.Color('#7fb09a') });
  const legMat = woodMat('#3a2416', { key: 'f9-poltrona-pe', rough: 0.5 });
  const seat = new THREE.Mesh(rbox(0.72, 0.18, 0.66, 0.06), velvet);
  seat.position.y = 0.32;
  const backrest = new THREE.Mesh(rbox(0.72, 0.72, 0.16, 0.07), velvet);
  backrest.position.set(0, 0.72, -0.28);
  backrest.rotation.x = -0.12;
  chair.add(seat, backrest);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(rbox(0.14, 0.24, 0.6, 0.06), velvet);
    arm.position.set(sx * 0.33, 0.5, 0.0);
    const wing = new THREE.Mesh(rbox(0.1, 0.36, 0.2, 0.05), velvet);
    wing.position.set(sx * 0.32, 0.92, -0.24);
    chair.add(arm, wing);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.22, 8), legMat);
    l.position.set(sx * 0.3, 0.11, sz * 0.26);
    chair.add(l);
  }
  const cushion = new THREE.Mesh(rbox(0.5, 0.1, 0.46, 0.05), new THREE.MeshStandardMaterial({ color: '#d8b25a', roughness: 0.9 }));
  cushion.position.set(0, 0.46, 0.02);
  chair.add(cushion);
  // cardigã dobrado no braço
  const card = new THREE.Mesh(rbox(0.16, 0.05, 0.42, 0.02), new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.95 }));
  card.position.set(0.33, 0.645, 0.02);
  card.rotation.z = 0.08;
  chair.add(card);
  grp.add(chair);
  // pantufas do vovô na frente da poltrona
  const slip = new THREE.MeshStandardMaterial({ color: '#7a2a28', roughness: 0.9 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 10).rotateX(Math.PI / 2), slip);
    p.scale.set(1, 0.6, 1);
    p.position.set(A.x + 0.35 + s * 0.06, 0.025, A.z + 0.45);
    p.rotation.y = A.yaw + s * 0.1;
    grp.add(p);
  }

  // mesinha redonda com o abajur; os pontos dos óculos e do livro
  const table = new THREE.Group();
  table.position.set(T.x, 0, T.z);
  const tw = woodMat('#5a3a24', { key: 'f9-mesinha', rough: 0.4 });
  const tableMat = new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.4, emissive: '#ffcf7a', emissiveIntensity: 0 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(T.r, T.r, 0.03, 32), tableMat);
  top.position.y = T.h - 0.015;
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, T.h - 0.05, 12), tw);
  ped.position.y = (T.h - 0.05) / 2 + 0.02;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.03, 20), tw);
  foot.position.y = 0.015;
  table.add(top, ped, foot);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.04, 16), stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 }));
  lampBase.position.set(0.1, T.h + 0.02, -0.08);
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.26, 8), stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 }));
  lampStem.position.set(0.1, T.h + 0.17, -0.08);
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#f1dcae', roughness: 0.8, emissive: '#ffcf7a', emissiveIntensity: 0.55, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.13, 20, 1, true), shadeMat);
  shade.position.set(0.1, T.h + 0.33, -0.08);
  table.add(lampBase, lampStem, shade);
  const spots = {};
  for (const k of /** @type {const} */ (['glasses', 'book'])) {
    const sp = new THREE.Object3D();
    sp.position.set(TABLE_SPOTS[k].x - T.x, TABLE_SPOTS[k].y, TABLE_SPOTS[k].z - T.z);
    // o livro já deita sozinho (props.book.setLying); os óculos deitam dobrados, as lentes para cima
    if (k === 'book') sp.rotation.set(0, 0.4, 0);
    else sp.rotation.set(-Math.PI / 2 + 0.15, 0, 0.5);
    table.add(sp);
    spots[k] = sp;
  }
  grp.add(table);

  // abajur de pé e o pufe
  const lamp = new THREE.Group();
  lamp.position.set(Lp.x, 0, Lp.z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.5, 8), stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 }));
  pole.position.y = 0.75;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.03, 20), stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 }));
  base.position.y = 0.015;
  const bigShade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.26, 24, 1, true), shadeMat);
  bigShade.position.y = 1.55;
  lamp.add(pole, base, bigShade);
  grp.add(lamp);
  const stool = new THREE.Mesh(rbox(F.hx * 2, F.h - 0.06, F.hz * 2, 0.06), velvet);
  stool.position.set(F.x, (F.h - 0.06) / 2 + 0.06, F.z);
  grp.add(stool);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.06, 6), legMat);
    l.position.set(F.x + sx * (F.hx - 0.04), 0.03, F.z + sz * (F.hz - 0.04));
    grp.add(l);
  }
  shadowAll(grp);
  rug.castShadow = false;
  root.add(grp);
  const st = { hl: false, glow: 0 };
  return {
    group: grp, spots, lampPos: new THREE.Vector3(Lp.x, 1.5, Lp.z), tablePos: new THREE.Vector3(T.x + 0.1, T.h + 0.33, T.z - 0.08),
    setHighlight(on) { st.hl = !!on; },
    update(dt, t) {
      st.glow = ease(st.glow, st.hl ? 1 : 0, dt, 5);
      tableMat.emissiveIntensity = st.glow * (0.25 + 0.1 * Math.sin(t * 4));
    },
  };
}

// ------------------------------------------------------------------ tudo junto
export function buildLibrary({ root, layout }) {
  const { SHELF_W, SHELF_E, FIREPLACE, LADDER, GLOBE, GLASSES, WORLD } = layout;
  const B = WORLD.bounds;
  buildBookcase(root, SHELF_W, { seed: 7 });
  const shelfE = buildBookcase(root, SHELF_E, { seed: 19, gap: { shelf: SHELF_YS.indexOf(1.7), x: GLASSES.x, w: 0.26 } });
  // trilho de latão da escadinha ao longo da estante leste
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, SHELF_E.x1 - SHELF_E.x0 - 0.1, 10).rotateZ(Math.PI / 2), stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 }));
  rail.position.set((SHELF_E.x0 + SHELF_E.x1) / 2, 2.17, SHELF_E.z + SHELF_E.depth / 2 + 0.04);
  root.add(rail);
  for (const x of [SHELF_E.x0 + 0.1, SHELF_E.x1 - 0.1, (SHELF_E.x0 + SHELF_E.x1) / 2]) {
    const br = new THREE.Mesh(rbox(0.02, 0.03, 0.06, 0.006), stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 }));
    br.position.set(x, 2.17, SHELF_E.z + SHELF_E.depth / 2 + 0.02);
    root.add(br);
  }
  const fire = buildFireplace(root, FIREPLACE, B, photoTexture());
  const ladder = buildLadder(root, LADDER, LADDER.start.z);
  const globe = buildGlobe(root, GLOBE);
  const corner = buildReadingCorner(root, layout);
  return {
    shelfE, fire, ladder, globe, corner,
    firePos: new THREE.Vector3((FIREPLACE.x0 + FIREPLACE.x1) / 2, 0.5, B.minZ + FIREPLACE.depth + 0.2),
    update(dt, t) {
      fire.update(dt, t);
      ladder.update(dt, t);
      corner.update(dt, t);
    },
  };
}
