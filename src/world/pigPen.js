// Chiqueiro (fase 10 e a arena ?level=porcos): cerca de tábuas com mourões, porteira de fazenda com a mão-francesa
// em diagonal, chão de terra batida com uma poça de lama e palha espalhada, o cocho de madeira (com uns grãos de
// milho) e a plaquinha com a carinha de porco. Desenha o mesmo cercado que pigPenLayout (src/game/mechanics/pigHerd.js)
// usa para os colisores e a porteira.
//   buildPigPen(PEN, L = pigPenLayout(PEN)) → { group, gate: { object, setOpen(t 0..1) }, update(dt, t) }
//   gate.setOpen(t) recebe a mesma abertura do createHingedGate (yaw = closedYaw + (openYaw − closedYaw)·t).
import * as THREE from 'three';
import { rbox, woodMat, stdMat, canvasTexture, shadowAll, mergeGeometries, rng } from './util.js';

const TAU = Math.PI * 2;

/** Plaquinha com a carinha de porco (canvas). */
function signTexture() {
  return canvasTexture(128, 96, (g, w, h) => {
    g.fillStyle = '#e9d6b0';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a5c3a';
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6);
    // carinha
    g.fillStyle = '#f2a9ad';
    g.beginPath(); g.arc(w / 2, h / 2 + 4, 28, 0, TAU); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + s * 14, h / 2 - 18); g.lineTo(w / 2 + s * 30, h / 2 - 30); g.lineTo(w / 2 + s * 28, h / 2 - 8); g.fill(); }
    g.fillStyle = '#e48a93';
    g.beginPath(); g.ellipse(w / 2, h / 2 + 12, 13, 9, 0, 0, TAU); g.fill();
    g.fillStyle = '#7d434a';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * 5, h / 2 + 12, 2.6, 4, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#2a1a16';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(w / 2 + s * 11, h / 2 - 2, 3.4, 0, TAU); g.fill(); }
  }, { repeat: false });
}

/**
 * @param {any} PEN cercado (ver pigPenLayout) @param {ReturnType<typeof import('../game/mechanics/pigHerd.js').pigPenLayout>} L
 */
export function buildPigPen(PEN, L) {
  const group = new THREE.Group();
  group.name = 'chiqueiro';
  const { x0, x1, z0, z1, door: D } = PEN;
  const t = PEN.t ?? 0.08;
  const H = PEN.h ?? 0.72;
  const postMat = woodMat('#8d6240', { key: 'chiqueiro-mourao' });
  const boardMat = woodMat('#b4865a', { key: 'chiqueiro-tabua' });
  const railH = [0.13, 0.36, 0.59].filter((y) => y < H - 0.06);

  // ---------------------------------------------------------------- cercas: mourões e três tábuas por lado
  const posts = [];
  const boards = [];
  /** Uma cerca reta de (ax, az) a (bx, bz), do lado de fora do miolo. */
  function fence(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 0.7));
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
      // um mourão por lugar (os cantos são de duas cercas; os da porteira são os grandes)
      if (posts.some((q) => Math.hypot(q.x - x, q.z - z) < 0.06) || [L.gate.hinge, L.gate.latchPost].some((q) => Math.hypot(q.x - x, q.z - z) < 0.08)) continue;
      posts.push({ x, z, h: H + 0.06 });
    }
    const yaw = Math.atan2(bx - ax, bz - az);
    for (const y of railH) {
      // as pontas ficam dentro dos mourões (as tábuas dos cantos não se cruzam)
      const g = rbox(0.026, 0.085, len - 0.06, 0.008);
      g.rotateY(yaw);
      g.translate((ax + bx) / 2, y, (az + bz) / 2);
      boards.push(g);
    }
  }
  const xa = x0 - t / 2, xb = x1 + t / 2, za = z0 - t / 2, zb = z1 + t / 2;
  const sides = {
    n: [[xa, za], [xb, za]], s: [[xa, zb], [xb, zb]], w: [[xa, za], [xa, zb]], e: [[xb, za], [xb, zb]],
  };
  for (const [side, [[ax, az], [bx, bz]]] of Object.entries(sides)) {
    if (side !== D.side) { fence(ax, az, bx, bz); continue; }
    const alongX = side === 'n' || side === 's';
    if (alongX) { fence(ax, az, D.a, az); fence(D.b, az, bx, bz); }
    else { fence(ax, az, ax, D.a); fence(ax, D.b, bx, bz); }
  }
  const postGeos = posts.map((p) => {
    const g = rbox(0.075, p.h, 0.075, 0.012);
    g.translate(p.x, p.h / 2, p.z);
    return g;
  });
  // mourões da porteira, mais altos, com um chapéu
  for (const q of [L.gate.hinge, L.gate.latchPost]) {
    const g = rbox(0.1, H + 0.16, 0.1, 0.014);
    g.translate(q.x, (H + 0.16) / 2, q.z);
    postGeos.push(g);
    const cap = rbox(0.13, 0.03, 0.13, 0.01);
    cap.translate(q.x, H + 0.175, q.z);
    postGeos.push(cap);
  }
  const postMesh = new THREE.Mesh(mergeGeometries(postGeos), postMat);
  const boardMesh = new THREE.Mesh(mergeGeometries(boards), boardMat);
  for (const g of [...postGeos, ...boards]) g.dispose();
  group.add(postMesh, boardMesh);

  // ---------------------------------------------------------------- porteira (folha ao longo de −Z local)
  const pivot = new THREE.Group();
  pivot.name = 'porteira';
  pivot.position.set(L.gate.hinge.x, 0, L.gate.hinge.z);
  const leafL = L.gate.length - 0.06;
  const leafParts = [];
  const leafH = H - 0.04;
  for (const z of [-0.05, -leafL + 0.02]) {
    const g = rbox(0.05, leafH - 0.06, 0.05, 0.01);
    g.translate(0, 0.04 + (leafH - 0.06) / 2, z);
    leafParts.push(g);
  }
  for (const y of [0.12, leafH * 0.52, leafH - 0.08]) {
    const g = rbox(0.03, 0.08, leafL - 0.04, 0.008);
    g.translate(0, y, -leafL / 2 - 0.015);
    leafParts.push(g);
  }
  {
    // mão-francesa em diagonal (de baixo, perto da dobradiça, ao alto da ponta)
    const dz = leafL - 0.12, dy = leafH - 0.24;
    const g = rbox(0.026, 0.07, Math.hypot(dz, dy), 0.008);
    g.rotateX(Math.atan2(dy, dz));
    g.translate(0.006, 0.12 + dy / 2, -0.06 - dz / 2);
    leafParts.push(g);
  }
  const leaf = new THREE.Mesh(mergeGeometries(leafParts), boardMat);
  for (const g of leafParts) g.dispose();
  const ironMat = stdMat('#3a3533', { roughness: 0.45, metalness: 0.6 });
  const hinges = [0.16, leafH - 0.1].map((y) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 8), ironMat);
    m.position.set(0, y, -0.012);
    return m;
  });
  const latch = new THREE.Mesh(rbox(0.05, 0.03, 0.09, 0.006), ironMat);
  latch.position.set(0, leafH * 0.52, -leafL + 0.02);
  pivot.add(leaf, ...hinges, latch);
  group.add(pivot);

  // plaquinha na face de fora da porteira (o +X local da folha olha para fora nas porteiras 's' e 'w'), numa tabuinha
  const out = D.side === 's' || D.side === 'w' ? 1 : -1;
  const back = new THREE.Mesh(rbox(0.012, 0.17, 0.235, 0.004), boardMat);
  back.position.set(out * 0.0218, leafH - 0.08, -leafL / 2);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.15),
    new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  sign.position.set(out * 0.0285, leafH - 0.08, -leafL / 2);
  sign.rotation.y = out * Math.PI / 2;
  pivot.add(back, sign);

  // ---------------------------------------------------------------- chão: terra batida, lama e palha
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const dirt = new THREE.Mesh(rbox(x1 - x0 + 0.04, 0.012, z1 - z0 + 0.04, 0.005), stdMat('#8a6a4a', { roughness: 0.97 }));
  dirt.position.set(cx, 0.0035, cz);
  dirt.receiveShadow = true;
  group.add(dirt);
  const mud = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4f3826', roughness: 0.22, metalness: 0.05 }));
  const mx = PEN.mud?.x ?? x0 + (x1 - x0) * 0.28, mz = PEN.mud?.z ?? z0 + (z1 - z0) * 0.62;
  mud.scale.set(PEN.mud?.rx ?? 0.42, 1, PEN.mud?.rz ?? 0.3);
  mud.position.set(mx, 0.0112, mz);
  mud.receiveShadow = true;
  group.add(mud);
  const r = rng(31);
  const straw = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.005, 0.012), stdMat('#e6c46a', { roughness: 0.9 }), 70);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), e = new THREE.Euler();
  let k = 0;
  for (let i = 0; i < 70; i++) {
    const x = x0 + 0.05 + r() * (x1 - x0 - 0.1), z = z0 + 0.05 + r() * (z1 - z0 - 0.1);
    if (Math.hypot((x - mx) / 0.5, (z - mz) / 0.38) < 1) continue; // nada de palha na lama
    p.set(x, 0.0128 + r() * 0.004, z);
    q.setFromEuler(e.set((r() - 0.5) * 0.1, r() * TAU, (r() - 0.5) * 0.1));
    s.set(0.6 + r() * 0.8, 1, 1);
    straw.setMatrixAt(k++, m4.compose(p, q, s));
  }
  straw.count = k;
  straw.receiveShadow = true;
  group.add(straw);

  // ---------------------------------------------------------------- cocho com uns grãos de milho
  if (PEN.trough) {
    const T = PEN.trough;
    const trough = new THREE.Group();
    trough.name = 'cocho';
    const wood = woodMat('#7e5636', { key: 'chiqueiro-cocho' });
    const along = T.hx >= T.hz;
    const len = 2 * Math.max(T.hx, T.hz), wid = 2 * Math.min(T.hx, T.hz);
    const parts = [];
    const bottom = rbox(len, 0.03, wid, 0.008);
    bottom.translate(0, 0.045, 0);
    parts.push(bottom);
    for (const sgn of [-1, 1]) {
      const side = rbox(len, 0.15, 0.025, 0.008);
      side.translate(0, 0.095, sgn * (wid / 2 - 0.0125));
      parts.push(side);
      const end = rbox(0.025, 0.15, wid - 0.05, 0.008);
      end.translate(sgn * (len / 2 - 0.0125), 0.095, 0);
      parts.push(end);
      const foot = rbox(0.05, 0.035, wid + 0.03, 0.008);
      foot.translate(sgn * (len / 2 - 0.1), 0.0175, 0);
      parts.push(foot);
    }
    const tm = new THREE.Mesh(mergeGeometries(parts), wood);
    for (const g of parts) g.dispose();
    trough.add(tm);
    const kernels = new THREE.InstancedMesh(new THREE.SphereGeometry(0.009, 6, 4), stdMat('#ffcf4a', { roughness: 0.5 }), 26);
    for (let i = 0; i < 26; i++) {
      p.set((r() - 0.5) * (len - 0.12), 0.066 + r() * 0.008, (r() - 0.5) * (wid - 0.08));
      kernels.setMatrixAt(i, m4.compose(p, q.identity(), s.set(1, 0.8, 1)));
    }
    trough.add(kernels);
    trough.position.set(T.x, 0, T.z);
    if (!along) trough.rotation.y = Math.PI / 2;
    group.add(trough);
  }

  shadowAll(group);
  dirt.castShadow = mud.castShadow = straw.castShadow = false;

  const gate = {
    object: pivot,
    /** 0 fechada … 1 aberta (para fora do cercado). */
    setOpen(tt) {
      const c = THREE.MathUtils.clamp(tt, 0, 1);
      pivot.rotation.y = L.gate.closedYaw + (L.gate.openYaw - L.gate.closedYaw) * c;
    },
  };
  gate.setOpen(0);
  return {
    group,
    gate,
    /** Brilho da lama mexendo de leve. */
    update(dt, tt) {
      mud.material.roughness = 0.2 + 0.05 * Math.sin(tt * 0.7);
    },
  };
}
