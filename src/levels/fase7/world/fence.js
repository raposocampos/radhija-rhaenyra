// FASE 7 · Cerca do parquinho em "lápis de cor": ripas sextavadas coloridas com ponta apontada (madeira e
// grafite), postes brancos com bolinha, travessas do lado de dentro. O portão é um quadro com os mesmos lápis
// e a plaquinha PARQUINHO do lado de fora; o trinco (ferrolho) fica do lado de dentro, na ponta livre.
// Tudo segue FENCE/GATE/MOUND do layout (os colisores são os mesmos segmentos).
import * as THREE from 'three';
import { woodMat, stdMat, rbox, rng, canvasTexture, contactShadow } from '../../../world/util.js';

const PENCIL_COLORS = ['#e8574a', '#f39a3d', '#f4cf4a', '#6fbf5a', '#4fa3d9', '#8a6fd1', '#ef7fb0'];
const BODY_H = 0.62;
const TIP_H = 0.11;
const LEAD_H = 0.035;
const RADIUS = 0.036;
const SPACING = 0.112;

/** Geometrias dos lápis (corpo sextavado, ponta apontada e grafite), com a base em y = 0. */
function pencilGeometries(h = BODY_H) {
  const body = new THREE.CylinderGeometry(RADIUS, RADIUS, h, 6).translate(0, h / 2, 0);
  // ponta sem tampas e afundada 3 mm no corpo; o grafite também entra na ponta (nenhuma face no mesmo plano)
  const tip = new THREE.CylinderGeometry(RADIUS * 0.34, RADIUS, TIP_H, 6, 1, true).translate(0, h - 0.003 + TIP_H / 2, 0);
  const lead = new THREE.ConeGeometry(RADIUS * 0.36, LEAD_H, 6).translate(0, h - 0.006 + TIP_H + LEAD_H / 2, 0);
  return { body, tip, lead };
}

/**
 * Lápis instanciados ao longo de linhas retas. lines: [{ ax, az, bx, bz }] (a ripa fica no ponto).
 * @param {THREE.Group} group @param {{ x: number, z: number }[]} spots @param {number} seed
 */
function pencilRow(group, spots, seed, h = BODY_H) {
  const geo = pencilGeometries(h);
  const r = rng(seed);
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
  const tipMat = woodMat('#e7c99a', { key: 'f7-pencil-wood', rough: 0.7 });
  const leadMat = stdMat('#3a3633', { roughness: 0.35, metalness: 0.2 });
  const bodies = new THREE.InstancedMesh(geo.body, bodyMat, spots.length);
  const tips = new THREE.InstancedMesh(geo.tip, tipMat, spots.length);
  const leads = new THREE.InstancedMesh(geo.lead, leadMat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const c = new THREE.Color();
  spots.forEach((sp, i) => {
    e.set((r() - 0.5) * 0.03, r() * Math.PI, (r() - 0.5) * 0.03);
    q.setFromEuler(e);
    p.set(sp.x, 0.01, sp.z);
    s.set(1, 0.96 + r() * 0.08, 1);
    m4.compose(p, q, s);
    for (const im of [bodies, tips, leads]) im.setMatrixAt(i, m4);
    c.set(PENCIL_COLORS[(i + seed) % PENCIL_COLORS.length]).offsetHSL(0, (r() - 0.5) * 0.08, (r() - 0.5) * 0.06);
    bodies.setColorAt(i, c);
  });
  for (const im of [bodies, tips, leads]) {
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  }
  return { bodies, tips, leads };
}

/** Pontos dos lápis entre a e b (sem encostar nos postes das pontas). */
function spotsAlong(ax, az, bx, bz, pad = 0.07) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.round((len - pad * 2) / SPACING));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (pad + ((len - pad * 2) * i) / n) / len;
    out.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t });
  }
  return out;
}

/** Plaquinha PARQUINHO (canvas). */
function signTexture() {
  return canvasTexture(256, 96, (g, w, h) => {
    g.fillStyle = '#fff3d6';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4a3426';
    g.lineWidth = 8;
    g.strokeRect(6, 6, w - 12, h - 12);
    const letters = 'PARQUINHO';
    const cols = ['#e8574a', '#f39a3d', '#6fbf5a', '#4fa3d9', '#8a6fd1', '#ef7fb0', '#e8574a', '#f39a3d', '#4fa3d9'];
    g.font = '700 50px Fredoka, "Segoe UI", sans-serif';
    g.textBaseline = 'middle';
    let x = 22;
    for (let i = 0; i < letters.length; i++) {
      g.fillStyle = cols[i];
      g.fillText(letters[i], x, h / 2 + (i % 2 ? 3 : -3));
      x += g.measureText(letters[i]).width + 1 || 24;
    }
  }, { repeat: false });
}

/** Poste branco com chapéu e bolinha. */
function post(group, x, z, h = 0.86) {
  const m = stdMat('#f2ede2', { roughness: 0.5 });
  const p = new THREE.Mesh(rbox(0.1, h, 0.1, 0.018), m);
  p.position.set(x, h / 2, z);
  const cap = new THREE.Mesh(rbox(0.13, 0.035, 0.13, 0.012), m);
  cap.position.set(x, h + 0.017, z);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), stdMat('#e8574a', { roughness: 0.4 }));
  knob.position.set(x, h + 0.06, z);
  group.add(p, cap, knob);
}

/** Travessa de madeira entre dois pontos na altura y, deslocada para dentro (normal nx, nz). */
function rail(group, ax, az, bx, bz, y, nx, nz) {
  const len = Math.hypot(bx - ax, bz - az);
  const m = new THREE.Mesh(rbox(len, 0.06, 0.035, 0.012), woodMat('#d9b98c', { key: 'f7-rail', rough: 0.75 }));
  m.position.set((ax + bx) / 2 + nx * 0.055, y, (az + bz) / 2 + nz * 0.055);
  m.rotation.y = -Math.atan2(bz - az, bx - ax);
  group.add(m);
}

/** @param {THREE.Group} root @param {import('../../../types').LevelLayout} layout */
export function buildFence(root, layout) {
  const F = layout.FENCE, G = layout.GATE, M = layout.MOUND;
  const group = new THREE.Group();
  group.name = 'cerca-lapis';
  const west = F.west, south = F.south;
  const lines = [
    // [ax, az, bx, bz, dentro nx, nz]
    [west, -4.75, west, M.z - M.hz + 0.05, 1, 0],
    [west, M.z + M.hz - 0.05, west, south, 1, 0],
    [west, south, G.hinge.x - 0.07, south, 0, -1],
    [G.latchPost.x + 0.07, south, 6.7, south, 0, -1],
  ];
  const spots = [];
  /** @type {[number, number][]} */
  const posts = [];
  lines.forEach(([ax, az, bx, bz, nx, nz], i) => {
    spots.push(...spotsAlong(ax, az, bx, bz));
    // travessas param antes dos postes das pontas (não se cruzam no canto)
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    for (const y of [0.16, 0.5]) rail(group, ax + ux * 0.07, az + uz * 0.07, bx - ux * 0.07, bz - uz * 0.07, y, nx, nz);
    // postes a cada ~1,6 m; sem os das pontas que o morrinho ou o portão já cobrem
    const n = Math.max(1, Math.round(len / 1.6));
    for (let k = 0; k <= n; k++) {
      if ((i === 0 && k === n) || (i === 1 && k === 0) || (i === 2 && (k === 0 || k === n)) || (i === 3 && k === 0)) continue;
      posts.push([ax + ((bx - ax) * k) / n + nx * 0.02, az + ((bz - az) * k) / n + nz * 0.02]);
    }
  });
  posts.push([west + 0.02, south - 0.02]); // o canto, uma vez só
  for (const [x, z] of posts) post(group, x, z);
  pencilRow(group, spots, 3);
  // postes do portão (mais grossos)
  for (const [x, z] of [[G.hinge.x - 0.05, south], [G.latchPost.x + 0.05, south]]) {
    const pm = stdMat('#f2ede2', { roughness: 0.5 });
    const p = new THREE.Mesh(rbox(0.13, 0.98, 0.13, 0.02), pm);
    p.position.set(x, 0.49, z);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), stdMat('#f4cf4a', { roughness: 0.4 }));
    knob.position.set(x, 1.03, z);
    group.add(p, knob);
  }
  root.add(group);

  // ---------------------------------------------------------------- portão (folha ao longo de -Z local)
  const gate = new THREE.Group();
  gate.name = 'portao';
  gate.position.set(G.hinge.x, 0, G.hinge.z);
  const L = G.length;
  const frameMat = stdMat('#f2ede2', { roughness: 0.5 });
  for (const z of [-0.035, -L + 0.035]) {
    const st = new THREE.Mesh(rbox(0.055, 0.82, 0.055, 0.012), frameMat);
    st.position.set(0, 0.43, z);
    gate.add(st);
  }
  for (const y of [0.13, 0.55]) {
    const r = new THREE.Mesh(rbox(0.035, 0.055, L - 0.04, 0.01), woodMat('#d9b98c', { key: 'f7-rail', rough: 0.75 }));
    r.position.set(-0.042, y, -L / 2); // entra 3 mm nos montantes
    gate.add(r);
  }
  // diagonal (mão-francesa) do lado de dentro
  const diag = new THREE.Mesh(rbox(0.03, 0.05, Math.hypot(L - 0.12, 0.4), 0.01), woodMat('#d9b98c', { key: 'f7-rail', rough: 0.75 }));
  diag.position.set(-0.05, 0.34, -L / 2);
  diag.rotation.x = Math.atan2(0.4, L - 0.12);
  gate.add(diag);
  const gateSpots = [];
  for (let k = 0; k < 8; k++) gateSpots.push({ x: 0, z: -0.11 - k * ((L - 0.22) / 7) });
  pencilRow(gate, gateSpots, 5, 0.56);
  // plaquinha do lado de fora (+X local = sul com o portão fechado)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.6 }));
  sign.position.set(0.05, 0.36, -L / 2);
  sign.rotation.y = Math.PI / 2;
  const signBack = new THREE.Mesh(rbox(0.02, 0.25, 0.65, 0.01), frameMat);
  signBack.position.set(0.035, 0.36, -L / 2);
  gate.add(signBack, sign);
  // ferrolho do lado de dentro, na ponta livre: a lingueta desliza para fora do batente (setTurn)
  const bolt = new THREE.Group();
  bolt.position.set(-0.03, 0.47, -L + 0.06);
  const plate = new THREE.Mesh(rbox(0.012, 0.07, 0.16, 0.004), stdMat('#8d8a84', { metalness: 0.7, roughness: 0.35 }));
  plate.position.z = 0.04;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.17, 10).rotateX(Math.PI / 2), stdMat('#b8b4ac', { metalness: 0.8, roughness: 0.25 }));
  rod.position.set(-0.016, 0, 0);
  const handle = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), stdMat('#b8b4ac', { metalness: 0.8, roughness: 0.25 }));
  stem.position.y = 0.03;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 8), stdMat('#e8574a', { roughness: 0.4 }));
  ball.position.y = 0.065;
  handle.add(stem, ball);
  handle.position.set(-0.016, 0, 0.03);
  rod.add(handle);
  bolt.add(plate, rod);
  gate.add(bolt);
  gate.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const gateShadow = contactShadow(0.08, L / 2, 0.3);
  gateShadow.position.set(0, 0.006, -L / 2);
  gate.add(gateShadow);
  root.add(gate);

  const yaw = (t) => (G.closedYaw ?? 0) + (G.openYaw - (G.closedYaw ?? 0)) * t;
  /** @type {import('../../../types').GateProp} */
  const gateProp = { object: gate, setOpen(t) { gate.rotation.y = yaw(t); } };
  /** Trinco: k 0..1 — a alavanquinha sobe e a lingueta corre para dentro da folha (sai do batente). */
  const latchProp = {
    object: bolt,
    /** @param {number} k */
    setTurn(k) {
      const up = Math.min(1, k / 0.35);
      const slide = Math.max(0, (k - 0.3) / 0.7);
      handle.rotation.z = -up * 1.3;
      rod.position.z = -0.06 + slide * 0.09;
    },
  };
  gateProp.setOpen(0);
  latchProp.setTurn(0);
  return { group, gate: gateProp, latch: latchProp, seeThrough: [group, gate] };
}
