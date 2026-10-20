// FASE 10 · O quintal: a piscininha inflável (três boias listradas, o fundo estampado de peixinhos e estrelas, a água
// que sobe com o nível, ondinhas, o jato da mangueira caindo e o anel de respingos), o barquinho de brinquedo com a
// vela de coração (boia, balança e é levado pelo vento), a mangueira verde da torneira até a borda (a água corre
// por dentro em pulsos azuis; esmagada pelo caixote, ela incha e a torneira pinga), a torneira de latão com o cano até
// o botão da parede, o caixote de brinquedos, o ventilador de pedestal (hélice, grade, fitinhas e as linhas de vento)
// com o fio até a tomada da fachada, os vasos grandes, a arvorezinha, o canteiro de flores e a toalha de piquenique.
// API: buildYard(root, layout) → { group, pool, boat, crate, fan, hose, outletPos, seeThrough, update(dt, t) }
import * as THREE from 'three';
import {
  rng, rbox, canvasTexture, stdMat, woodMat, terracottaMat, potProfile, soilDisc, foliageCluster, leafSkin, contactShadow,
  rippleNormalTexture, brassMat, mergeGeometries,
} from '../../../world/util.js';
import { plantMat, crownMat, geranium, lavender, boxwood, smallFlowers } from '../../../world/plants.js';
import { makeLink } from '../../../world/links.js';

const TAU = Math.PI * 2;
const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Fundo da piscininha: azul com peixinhos e estrelas-do-mar. */
function poolFloorTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#7cc8e8'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
    for (let rr = 30; rr < w / 2; rr += 28) { g.beginPath(); g.arc(w / 2, h / 2, rr, 0, TAU); g.stroke(); }
    const r = rng(3);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.3, d = 60 + r() * 40;
      const x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
      g.fillStyle = k % 2 ? '#ffb347' : '#ff7a8a';
      g.beginPath(); g.ellipse(0, 0, 14, 8, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-12, 0); g.lineTo(-22, -7); g.lineTo(-22, 7); g.closePath(); g.fill();
      g.fillStyle = '#2a1c14'; g.beginPath(); g.arc(7, -2, 1.8, 0, TAU); g.fill();
      g.restore();
    }
    g.fillStyle = '#ffd94d';
    for (let k = 0; k < 3; k++) {
      const x = w / 2 + (k - 1) * 40, y = h / 2 + (k % 2 ? 26 : -18);
      g.beginPath();
      for (let t = 0; t < 10; t++) { const rr = t % 2 ? 5 : 12; const an = (t / 10) * TAU - Math.PI / 2; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
      g.fill();
    }
  }, { repeat: false });
}
/** Listras da boia inflável (azul e branco). */
function stripeRingTexture(a, b) {
  return canvasTexture(256, 32, (g, w, h) => {
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect((i * w) / 12, 0, w / 12 + 1, h); }
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, 4, w, 4);
  });
}
/** Faixa de água correndo (para o jato da mangueira). */
function streamTexture() {
  return canvasTexture(32, 128, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = 'rgba(190,230,255,0.75)'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.5})`; g.fillRect(r() * w, r() * h, 2 + r() * 3, 8 + r() * 14); }
  });
}
/** Ripas do caixote de brinquedos, pintadas de azul com as bolinhas desbotadas. */
function crateTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(11);
    for (let j = 0; j < 4; j++) {
      const t = 0.9 + r() * 0.15;
      g.fillStyle = `rgb(${(110 * t) | 0},${(170 * t) | 0},${(210 * t) | 0})`;
      g.fillRect(0, (j * h) / 4 + 1, w, h / 4 - 3);
      g.fillStyle = 'rgba(40,60,90,0.25)';
      g.fillRect(0, ((j + 1) * h) / 4 - 3, w, 2);
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(14 + (k % 3) * 46, 18 + Math.floor(k / 3) * 44, 6, 0, TAU); g.fill(); }
    g.fillStyle = '#fffaf0'; g.font = 'bold 22px "Trebuchet MS", sans-serif'; g.textAlign = 'center';
    g.fillText('BRINQUEDOS', w / 2, h / 2 + 8);
  });
}

/** Barquinho de brinquedo: casco vermelho e branco, vela com coração, bandeirinha. Base do casco em y = 0. */
function createToyBoat() {
  const g = new THREE.Group();
  g.name = 'barquinho';
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-0.2, 0.0);
  hullShape.quadraticCurveTo(-0.22, 0.09, -0.04, 0.1);
  hullShape.lineTo(0.12, 0.1);
  hullShape.quadraticCurveTo(0.26, 0.09, 0.24, 0.0);
  hullShape.quadraticCurveTo(0.0, -0.1, -0.2, 0.0);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 10 });
  hullGeo.translate(0, 0.04, -0.08);
  // vista de cima: casco em forma de gota (estreito na proa) — afina as pontas
  const p = hullGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const k = 1 - Math.min(1, Math.abs(x) / 0.27) ** 2 * (x > 0 ? 0.85 : 0.45);
    p.setZ(i, z * k);
  }
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshPhysicalMaterial({ color: '#e8554a', roughness: 0.35, clearcoat: 0.8 }));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.17), stdMat('#fffaf0', { roughness: 0.4 }));
  stripe.position.y = 0.12;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.12), woodMat('#e8c89a', { key: 'f10-barco-deck' }));
  deck.position.y = 0.135;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.36, 8), woodMat('#c79a62', { key: 'f10-barco-mastro' }));
  mast.position.set(-0.06, 0.32, 0);
  const sailTex = canvasTexture(64, 64, (c, w, h) => {
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ff7aa8';
    c.beginPath(); c.moveTo(32, 42); c.bezierCurveTo(14, 28, 22, 14, 32, 24); c.bezierCurveTo(42, 14, 50, 28, 32, 42); c.fill();
  }, { repeat: false });
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.3, 0, 0.2, 0, 0], 3));
  sailGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0.1, 0, 0.1, 1, 1, 0], 2));
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({ map: sailTex, side: THREE.DoubleSide, roughness: 0.8 }));
  sail.position.set(-0.05, 0.17, 0);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.035), stdMat('#f6c453', { side: THREE.DoubleSide }));
  flag.position.set(-0.03, 0.48, 0);
  g.add(hull, stripe, deck, mast, sail, flag);
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  return { object: g, sail, flag };
}

/** Ventilador de pedestal (frente para +X local): base, haste, motor, grade, hélice e as fitinhas. */
function createPatioFan(height) {
  const g = new THREE.Group();
  g.name = 'ventilador';
  const white = stdMat('#f4f1ea', { roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.05, 24), white);
  base.position.y = 0.025;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, height - 0.28, 10), stdMat('#c8ccd0', { metalness: 0.8, roughness: 0.25 }));
  pole.position.y = (height - 0.28) / 2 + 0.05;
  const head = new THREE.Group();
  head.position.y = height - 0.18;
  const motor = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.1, 6, 12).rotateZ(Math.PI / 2), white);
  motor.position.x = -0.06;
  const cageMat = new THREE.MeshStandardMaterial({ color: '#e8eef2', metalness: 0.6, roughness: 0.3 });
  const cage = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2 - k * 0.06, 0.004, 6, 32).rotateY(Math.PI / 2), cageMat);
    ring.position.x = 0.07;
    cage.add(ring);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 4), cageMat);
    spoke.position.set(0.07, Math.cos(a) * 0.1, Math.sin(a) * 0.1);
    spoke.rotation.x = -a;
    cage.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), stdMat('#7cc4e8', { roughness: 0.4 }));
  hub.position.x = 0.07;
  const blades = new THREE.Group();
  blades.position.x = 0.05;
  const bladeMat = new THREE.MeshPhysicalMaterial({ color: '#9be0ff', roughness: 0.2, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  for (let k = 0; k < 4; k++) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12, -0.5, 1.0).rotateY(Math.PI / 2), bladeMat);
    b.position.set(0, 0, 0);
    b.rotation.x = (k / 4) * TAU;
    b.scale.set(1, 1.5, 1);
    blades.add(b);
  }
  // fitinhas coloridas na grade (voam com o vento)
  const ribbons = [];
  ['#f27a8a', '#f6c453', '#9bd57a', '#c79af0'].forEach((c, k) => {
    const geo = new THREE.PlaneGeometry(0.22, 0.02, 8, 1);
    geo.translate(0.11, 0, 0);
    const rb = new THREE.Mesh(geo, stdMat(c, { side: THREE.DoubleSide, roughness: 0.8 }));
    const a = (k / 4) * TAU + 0.4;
    rb.position.set(0.075, Math.cos(a) * 0.17, Math.sin(a) * 0.17);
    cage.add(rb);
    ribbons.push({ rb, base: geo.attributes.position.array.slice(), ph: k * 1.3 });
  });
  head.add(motor, cage, hub, blades);
  g.add(base, pole, head);
  g.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  return { object: g, head, blades, ribbons };
}

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildYard(root, layout) {
  const { POOL, BOAT, TAP, HOSE, CRATE, FAN, OUTLET, PLANTERS, LITTLE_TREE, FLOWER_BED, PICNIC } = layout;
  const group = new THREE.Group();
  group.name = 'quintal';

  // ================================================================ piscininha
  const pool = new THREE.Group();
  pool.name = 'piscininha';
  const ringTexA = stripeRingTexture('#4aa8e0', '#fffaf0');
  ringTexA.repeat.set(3, 1);
  const tubeR = POOL.rim / 6;
  const ringR = POOL.r - tubeR;
  const ringMats = [
    new THREE.MeshPhysicalMaterial({ map: ringTexA, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }),
    new THREE.MeshPhysicalMaterial({ color: '#ffd94d', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }),
  ];
  for (let k = 0; k < 3; k++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringR, tubeR, 14, 64).rotateX(Math.PI / 2), ringMats[k === 1 ? 1 : 0]);
    ring.position.y = tubeR + k * tubeR * 2 * 0.98;
    ring.castShadow = true;
    ring.receiveShadow = true;
    pool.add(ring);
  }
  // válvula de encher (detalhe) e a parede interna
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10).rotateZ(Math.PI / 2), stdMat('#fffaf0', { roughness: 0.3 }));
  valve.position.set(POOL.r - 0.005, tubeR * 5, 0.2);
  pool.add(valve);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(ringR - tubeR * 0.6, ringR - tubeR * 0.6, POOL.rim - 0.02, 48, 1, true), new THREE.MeshStandardMaterial({ color: '#6cb8e0', roughness: 0.5, side: THREE.BackSide }));
  inner.position.y = POOL.rim / 2;
  pool.add(inner);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ringR - tubeR * 0.5, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: poolFloorTexture(), roughness: 0.6 }));
  floor.position.y = 0.012;
  floor.receiveShadow = true;
  pool.add(floor);
  // água: superfície com ondinhas + "corpo" azul translúcido do fundo até ela
  const ripple = rippleNormalTexture().clone();
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.repeat.set(2, 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: '#5fb8e0', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.62, normalMap: ripple,
    normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6, depthWrite: false,
  });
  const waterR = ringR - tubeR * 0.6 - 0.004;
  const water = new THREE.Mesh(new THREE.CircleGeometry(waterR, 48).rotateX(-Math.PI / 2), waterMat);
  water.renderOrder = 2;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(waterR, waterR, 1, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: '#3f9ad0', transparent: true, opacity: 0.25, roughness: 0.1, side: THREE.BackSide, depthWrite: false }));
  body.renderOrder = 1;
  pool.add(water, body);
  // anel de respingos onde o jato cai e as bolhinhas
  const splashMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(64, 64, (g, w, h) => {
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 5;
      g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, TAU); g.stroke();
    }, { repeat: false }),
    transparent: true, depthWrite: false, opacity: 0,
  });
  const splashes = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3).rotateX(-Math.PI / 2), splashMat.clone());
    m.renderOrder = 3;
    pool.add(m);
    return m;
  });
  pool.position.set(POOL.x, 0, POOL.z);
  group.add(pool);
  const poolShadow = contactShadow(POOL.r + 0.12, POOL.r + 0.12, 0.35);
  poolShadow.position.set(POOL.x, 0.006, POOL.z);
  group.add(poolShadow);

  // ================================================================ barquinho
  const boat = createToyBoat();
  boat.object.position.set(BOAT.start.x, POOL.water.min, BOAT.start.z);
  group.add(boat.object);

  // ================================================================ torneira, cano até o botão e a mangueira
  const tapX = TAP.x + 0.02;
  const faucet = new THREE.Group();
  faucet.name = 'torneira';
  const brass = brassMat();
  const valveBody = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), brass);
  valveBody.position.set(0.04, 0.42, 0);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.1, 10).rotateZ(-Math.PI / 2 + 0.5), brass);
  spout.position.set(0.09, 0.39, 0);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 6, 14), stdMat('#e8554a', { roughness: 0.4 }));
  handle.position.set(0.05, 0.47, 0);
  handle.rotation.x = Math.PI / 2;
  const clip = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 10), stdMat('#c87a4a', { metalness: 0.8, roughness: 0.3 }));
  clip.position.set(0.02, 0.9, 0);
  clip.rotation.y = Math.PI / 2;
  faucet.add(valveBody, spout, handle, clip);
  faucet.position.set(tapX, 0, TAP.z);
  faucet.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(faucet);
  // o cano de cobre do botão até o registro: a ligação (um pulso azul desce quando o botão abre a torneira)
  const tapLink = makeLink([
    new THREE.Vector3(tapX + 0.02, TAP.top - 0.14, TAP.z),
    new THREE.Vector3(tapX + 0.02, 0.5, TAP.z),
    new THREE.Vector3(tapX + 0.035, 0.45, TAP.z),
  ], { radius: 0.016, color: '#c87a4a', glow: '#8fd8ff', metal: true });
  group.add(tapLink.object);
  // gotinhas que escapam da torneira quando a mangueira está esmagada
  const dripG = new THREE.SphereGeometry(0.012, 8, 6);
  const dripMat = new THREE.MeshPhysicalMaterial({ color: '#bfe6ff', roughness: 0.05, transparent: true, opacity: 0.85 });
  const drips = Array.from({ length: 7 }, (_, i) => {
    const m = new THREE.Mesh(dripG, dripMat);
    m.visible = false;
    group.add(m);
    return { m, ph: i / 7 };
  });
  // a mangueira: do bico da torneira, desce a parede e corre pelo chão até subir na borda da piscininha
  const nozzleStart = new THREE.Vector3(tapX + 0.13, 0.34, TAP.z);
  const hosePts = [nozzleStart, new THREE.Vector3(tapX + 0.16, 0.18, TAP.z + 0.02), new THREE.Vector3(HOSE[0].x, 0.025, HOSE[0].z)];
  for (let i = 1; i < HOSE.length; i++) hosePts.push(new THREE.Vector3(HOSE[i].x, 0.025, HOSE[i].z));
  const last = HOSE[HOSE.length - 1];
  const toPool = new THREE.Vector2(POOL.x - last.x, POOL.z - last.z).normalize();
  const rimY = POOL.rim + 0.03;
  hosePts.push(new THREE.Vector3(last.x + toPool.x * 0.12, 0.2, last.z + toPool.y * 0.12));
  const nozzle = new THREE.Vector3(last.x + toPool.x * 0.26, rimY + 0.04, last.z + toPool.y * 0.26);
  hosePts.push(nozzle);
  const hoseCurve = new THREE.CatmullRomCurve3(hosePts, false, 'centripetal', 0.3);
  const hoseLine = hoseCurve.getSpacedPoints(90);
  const hose = makeLink(hoseLine, { radius: 0.02, color: '#3f9a4a', glow: '#8fd8ff' });
  hose.object.name = 'mangueira';
  group.add(hose.object);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 0.08, 10), stdMat('#f6c453', { roughness: 0.4 }));
  tip.position.copy(nozzle);
  tip.lookAt(nozzle.x + toPool.x, nozzle.y - 0.6, nozzle.z + toPool.y);
  tip.rotateX(Math.PI / 2);
  group.add(tip);
  // o calombo da mangueira inchada (antes do caixote) quando a água não passa
  const bulge = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), stdMat('#3f9a4a', { roughness: 0.5 }));
  bulge.visible = false;
  group.add(bulge);
  // o jato que cai na piscininha
  const sTex = streamTexture();
  sTex.wrapS = sTex.wrapT = THREE.RepeatWrapping;
  const streamMat = new THREE.MeshBasicMaterial({ map: sTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  let stream = null;
  const streamLand = new THREE.Vector3(nozzle.x + toPool.x * 0.32, 0, nozzle.z + toPool.y * 0.32);
  function rebuildStream(y) {
    const a = nozzle.clone().add(new THREE.Vector3(toPool.x * 0.04, -0.02, toPool.y * 0.04));
    const b = new THREE.Vector3(streamLand.x, POOL.water.min + Math.max(0, y - POOL.water.min) + 0.01, streamLand.z);
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(toPool.x * 0.05, 0.05, toPool.y * 0.05));
    const geo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 16, 0.016, 6);
    if (stream) { stream.geometry.dispose(); stream.geometry = geo; } else {
      stream = new THREE.Mesh(geo, streamMat);
      stream.renderOrder = 4;
      group.add(stream);
    }
  }
  rebuildStream(POOL.water.min);

  // ================================================================ caixote de brinquedos
  const crate = new THREE.Group();
  crate.name = 'caixote';
  const cTex = crateTexture();
  const cMat = new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.75, emissive: '#ffd36a', emissiveIntensity: 0 });
  const h = CRATE.height, s = CRATE.half * 2;
  const box = new THREE.Mesh(rbox(s, h, s, 0.025), cMat);
  box.position.y = h / 2;
  crate.add(box);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(s + 0.02, 0.04, s + 0.02), woodMat('#f6f1e6', { key: 'f10-caixote-borda' }));
  rim.position.y = h - 0.016; // 4 mm acima da tampa (sem face no mesmo plano)
  crate.add(rim);
  const inside = new THREE.Mesh(new THREE.BoxGeometry(s - 0.06, 0.02, s - 0.06), stdMat('#3a4a5a'));
  inside.position.y = h - 0.05;
  crate.add(inside);
  // brinquedos aparecendo por cima: bola, coelhinho de pelúcia, martelinho e um carrinho
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 12), new THREE.MeshPhysicalMaterial({ color: '#ff7a8a', roughness: 0.3, clearcoat: 0.6 }));
  ball.position.set(-0.12, h + 0.02, 0.08);
  const bunny = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), stdMat('#f4e6d2', { roughness: 1 }));
  bb.scale.y = 1.2;
  const bh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), bb.material);
  bh.position.y = 0.1;
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.07, 3, 6), stdMat('#f4e6d2', { roughness: 1 }));
    ear.position.set(sx * 0.022, 0.18, 0);
    ear.rotation.z = -sx * 0.25;
    bunny.add(ear);
  }
  bunny.add(bb, bh);
  bunny.position.set(0.1, h, -0.06);
  bunny.rotation.z = -0.3;
  const hammer = new THREE.Group();
  const hHead = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10).rotateZ(Math.PI / 2), stdMat('#f6c453', { roughness: 0.5 }));
  const hStick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), stdMat('#7cc4e8', { roughness: 0.5 }));
  hStick.position.y = -0.11;
  hammer.add(hHead, hStick);
  hammer.position.set(0.02, h + 0.12, 0.13);
  hammer.rotation.set(0.4, 0, 0.6);
  crate.add(ball, bunny, hammer);
  crate.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const crateShadow = contactShadow(CRATE.half + 0.06, CRATE.half + 0.06, 0.45);
  crate.add(crateShadow);
  crate.position.set(CRATE.start.x, 0, CRATE.start.z);
  group.add(crate);

  // ================================================================ ventilador (fixo, soprando para o leste) e o fio até a tomada
  const fan = createPatioFan(FAN.height);
  fan.object.position.set(FAN.x, 0, FAN.z);
  group.add(fan.object);
  // tomada externa na fachada (caixinha com tampa) e o fio do ventilador pelo chão
  const outletPos = new THREE.Vector3(OUTLET.x, OUTLET.y, OUTLET.z);
  const outlet = new THREE.Group();
  const oBox = new THREE.Mesh(rbox(0.04, 0.12, 0.09, 0.01), stdMat('#f4f1ea', { roughness: 0.4 }));
  const oLid = new THREE.Mesh(rbox(0.012, 0.06, 0.08, 0.004), stdMat('#d8d2c6', { roughness: 0.4 }));
  oLid.position.set(0.03, 0.05, 0);
  oLid.rotation.z = -0.8;
  const oLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: '#5a5650' }));
  oLed.position.set(0.022, -0.035, 0.03);
  outlet.add(oBox, oLid, oLed);
  outlet.position.copy(outletPos);
  group.add(outlet);
  const plug = new THREE.Mesh(rbox(0.035, 0.05, 0.04, 0.008), stdMat('#2d2a28'));
  plug.position.set(outletPos.x + 0.035, outletPos.y - 0.01, outletPos.z);
  group.add(plug);
  const fanCable = makeLink([
    new THREE.Vector3(outletPos.x + 0.05, outletPos.y - 0.01, outletPos.z),
    new THREE.Vector3(outletPos.x + 0.09, 0.05, outletPos.z + 0.06),
    new THREE.Vector3(outletPos.x + 0.22, 0.012, outletPos.z + 0.3),
    new THREE.Vector3(-4.0, 0.012, 0.25),
    new THREE.Vector3(-3.55, 0.012, 0.85),
    new THREE.Vector3(FAN.x - 0.15, 0.012, FAN.z - 0.08),
    new THREE.Vector3(FAN.x - 0.1, 0.03, FAN.z - 0.04),
  ], { radius: 0.008, color: '#2d2a28', glow: '#ffd36a' });
  group.add(fanCable.object);
  // linhas de vento (só com o ventilador ligado): faixas claras indo para a piscininha
  const windTex = canvasTexture(128, 16, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, h / 2 - 2, w, 4);
  }, { repeat: false });
  const winds = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.06), new THREE.MeshBasicMaterial({ map: windTex, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2 + 0.3;
    m.renderOrder = 5;
    group.add(m);
    return { m, ph: i / 6, dz: ((i * 37) % 7) / 7 - 0.5, y: 0.35 + ((i * 13) % 5) * 0.08 };
  });

  // ================================================================ vasos grandes (entre eles só a Radhija passa)
  PLANTERS.forEach((p, i) => {
    const pot = new THREE.Mesh(new THREE.LatheGeometry(potProfile(p.r, 0.62, { foot: 0.7, belly: 1.05 }), 24), terracottaMat('#c47a52'));
    pot.position.set(p.x, 0, p.z);
    pot.castShadow = true;
    pot.receiveShadow = true;
    const soil = new THREE.Mesh(soilDisc(p.r * 0.9, i + 4), stdMat('#4a3322'));
    soil.position.set(p.x, 0.56, p.z);
    const bush = new THREE.Mesh(boxwood(p.r * 1.2, 40 + i), plantMat());
    bush.position.set(p.x, 0.62 + p.r * 0.6, p.z);
    bush.castShadow = true;
    const fl = new THREE.Mesh(smallFlowers({ count: 24, radius: p.r * 0.9, height: 0.1, color: i ? '#ff9ed2' : '#fff1b0', seed: 9 + i }), plantMat());
    fl.position.set(p.x, 0.62 + p.r * 1.0, p.z);
    group.add(pot, soil, bush, fl);
    const sh = contactShadow(p.r + 0.08, p.r + 0.08, 0.4);
    sh.position.set(p.x, 0.006, p.z);
    group.add(sh);
  });

  // ================================================================ arvorezinha (segura o varal de luzinhas)
  const tree = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.1, 1.5, 10, 4);
  const tp = trunkGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setX(i, tp.getX(i) + Math.sin(tp.getY(i) * 2.2) * 0.04);
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, woodMat('#6a4a32', { vertical: true, key: 'f10-tronco-fino' }));
  trunk.position.y = 0.75;
  const crownGeo = foliageCluster([
    { x: 0, y: 1.8, z: 0, r: 0.55 }, { x: 0.35, y: 1.65, z: 0.1, r: 0.38 }, { x: -0.32, y: 1.7, z: -0.1, r: 0.4 }, { x: 0.05, y: 2.15, z: 0.05, r: 0.36 },
  ], { seed: 21, dark: '#2f5226', mid: '#4f7f36', light: '#93bf58' });
  const crown = new THREE.Mesh(crownGeo, crownMat());
  crown.castShadow = true;
  const crownLeaves = leafSkin(crownGeo, { count: 500, size: 0.08, seed: 21, material: crownMat() });
  tree.add(trunk, crown, crownLeaves);
  tree.position.set(LITTLE_TREE.x, 0, LITTLE_TREE.z);
  tree.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(tree);
  const tsh = contactShadow(0.7, 0.6, 0.35);
  tsh.position.set(LITTLE_TREE.x + 0.15, 0.006, LITTLE_TREE.z + 0.1);
  group.add(tsh);

  // ================================================================ canteiro de flores (baixinho: dá para pular)
  const bed = new THREE.Group();
  const edgeMat = woodMat('#8a5a36', { key: 'f10-canteiro' });
  const H = 0.22;
  for (const [x, z, w, d] of [[0, -FLOWER_BED.hz, FLOWER_BED.hx * 2 + 0.06, 0.06], [0, FLOWER_BED.hz, FLOWER_BED.hx * 2 + 0.06, 0.06], [-FLOWER_BED.hx, 0, 0.06, FLOWER_BED.hz * 2], [FLOWER_BED.hx, 0, 0.06, FLOWER_BED.hz * 2]]) {
    const e = new THREE.Mesh(rbox(w, H, d, 0.01), edgeMat);
    e.position.set(x, H / 2, z);
    bed.add(e);
  }
  const bedSoil = new THREE.Mesh(new THREE.BoxGeometry(FLOWER_BED.hx * 2 - 0.04, 0.02, FLOWER_BED.hz * 2 - 0.04), stdMat('#4a3322', { roughness: 1 }));
  bedSoil.position.y = H - 0.03;
  bed.add(bedSoil);
  const r = rng(61);
  for (let k = 0; k < 6; k++) {
    const x = -FLOWER_BED.hx + 0.16 + k * ((FLOWER_BED.hx * 2 - 0.32) / 5);
    const fl = k % 3 === 1
      ? new THREE.Mesh(lavender({ stems: 22, height: 0.32, spread: 0.1, seed: 50 + k }), plantMat())
      : new THREE.Mesh(geranium({ radius: 0.14, height: 0.16, seed: 60 + k, flower: ['#ff6a7a', '#ff9ed2', '#fff1b0', '#ff6a7a', '#c79af0', '#ffb347'][k] }), plantMat());
    fl.position.set(x, H - 0.02, (r() - 0.5) * 0.1);
    bed.add(fl);
  }
  bed.position.set(FLOWER_BED.x, 0, FLOWER_BED.z);
  bed.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(bed);

  // ================================================================ toalha de piquenique com cesta (perto do gramado macio)
  const pic = new THREE.Group();
  const picTex = canvasTexture(64, 64, (g, w, hh) => {
    g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, w, hh);
    g.fillStyle = 'rgba(232,85,74,0.6)';
    for (let k = 0; k < 4; k++) { g.fillRect(k * 16, 0, 8, hh); g.fillRect(0, k * 16, w, 8); }
  });
  picTex.repeat.set(3, 2);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(PICNIC.hx * 2, PICNIC.hz * 2, 8, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: picTex, roughness: 1 }));
  const cp = cloth.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setY(i, 0.004 + Math.max(0, Math.sin(cp.getX(i) * 3 + cp.getZ(i) * 2)) * 0.006);
  cloth.geometry.computeVertexNormals();
  cloth.position.y = 0.006;
  cloth.rotation.y = 0.12;
  cloth.receiveShadow = true;
  pic.add(cloth);
  const basket = new THREE.Group();
  const bk = new THREE.Mesh(rbox(0.34, 0.2, 0.24, 0.03), woodMat('#c89a5a', { key: 'f10-cesta' }));
  bk.position.y = 0.1;
  const bkH = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 16, Math.PI), woodMat('#a07040', { key: 'f10-cesta-alca' }));
  bkH.position.y = 0.2;
  const napkin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.2), new THREE.MeshStandardMaterial({ map: picTex, roughness: 1 }));
  napkin.position.y = 0.205;
  basket.add(bk, bkH, napkin);
  basket.position.set(-0.45, 0.008, -0.15); // em cima da toalha
  basket.rotation.y = 0.4;
  pic.add(basket);
  const tball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshPhysicalMaterial({ color: '#d8f25a', roughness: 0.7, sheen: 1 }));
  tball.position.set(0.4, 0.06, 0.2);
  pic.add(tball);
  pic.position.set(PICNIC.x, 0, PICNIC.z);
  pic.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(pic);

  // ================================================================ estado
  const st = { level: 0, y: POOL.water.min, flowing: false, blocked: false, flowK: 0, power: false, spin: 0, spinV: 0, hl: false, hlK: 0, pulseT: 0, drift: false, bob: 0, boatY: POOL.water.min, lastStreamY: -1 };
  const api = {
    pool: {
      object: pool,
      setLevel(k, y) { st.level = k; st.y = y; },
      setFlow(on, blocked) {
        if (on && !st.flowing) { hose.pulse(); st.pulseT = 0; }
        st.flowing = !!on;
        st.blocked = !!blocked;
        hose.setOn(!!on);
      },
    },
    boat: {
      object: boat.object,
      setPos(x, z, y, drifting) {
        boat.object.position.x = x;
        boat.object.position.z = z;
        st.boatY = y;
        st.drift = !!drifting;
      },
    },
    crate: {
      object: crate,
      setPos(x, z) { crate.position.set(x, 0, z); },
      setHighlight(on) { st.hl = !!on; },
    },
    fan: {
      object: fan.object,
      setPower(on) {
        if (on && !st.power) fanCable.pulse();
        st.power = !!on;
        fanCable.setOn(!!on);
      },
    },
    hose,
    tapLink,
  };

  root.add(group);
  return {
    group, ...api, outletPos, outletLed: oLed, boatModel: boat,
    seeThrough: [tree, fan.object],
    update(dt, t) {
      hose.update(dt);
      tapLink.update(dt);
      fanCable.update(dt);
      // água: nível suave, corpo do fundo até a superfície, ondinhas mais fortes com o jato
      const wy = st.y;
      const dry = st.level < 0.01;
      water.visible = body.visible = !dry;
      water.position.y = wy;
      body.scale.y = Math.max(0.001, wy - 0.012);
      body.position.y = 0.012 + (wy - 0.012) / 2;
      st.flowK = ease(st.flowK, st.flowing ? 1 : 0, dt, 5);
      ripple.offset.set(Math.sin(t * 0.3) * 0.2 + t * 0.02, t * (0.03 + st.flowK * 0.12));
      waterMat.normalScale.setScalar(0.25 + st.flowK * 0.4);
      // pulsos de água pela mangueira enquanto corre
      if (st.flowing) {
        st.pulseT += dt;
        if (st.pulseT > 1.25) { st.pulseT = 0; hose.pulse(); }
      }
      // jato e respingos
      streamMat.opacity = st.flowK * 0.85;
      if (stream) stream.visible = st.flowK > 0.02;
      sTex.offset.y = -t * 2.2;
      if (Math.abs(wy - st.lastStreamY) > 0.01) { rebuildStream(wy); st.lastStreamY = wy; }
      splashes.forEach((sp, i) => {
        const u = (t * 1.6 + i / 3) % 1;
        sp.position.set(streamLand.x - POOL.x, wy + 0.004, streamLand.z - POOL.z);
        sp.scale.setScalar(0.3 + u * 1.4);
        sp.material.opacity = st.flowK * (1 - u) * 0.7 * (dry ? 0 : 1);
      });
      // mangueira esmagada: incha antes do caixote e a torneira pinga
      bulge.visible = st.blocked;
      if (st.blocked) {
        const k = 0.5 + 0.5 * Math.sin(t * 6);
        bulge.position.set(crate.position.x - 0.5, 0.03, crate.position.z - 0.25);
        // ponto da mangueira mais perto do caixote, um pouco antes dele
        let best = 0, bd = Infinity;
        hoseLine.forEach((p, i) => { const d = Math.hypot(p.x - crate.position.x, p.z - crate.position.z); if (d < bd) { bd = d; best = i; } });
        const pp = hoseLine[Math.max(0, best - 9)];
        bulge.position.set(pp.x, 0.03, pp.z);
        bulge.scale.setScalar(0.9 + k * 0.35);
      }
      drips.forEach((d) => {
        d.m.visible = st.blocked;
        if (!st.blocked) return;
        const u = (t * 1.4 + d.ph) % 1;
        d.m.position.set(tapX + 0.12 + u * 0.12 * Math.cos(d.ph * 9), 0.4 + 0.12 * u - 0.9 * u * u, TAP.z + 0.1 * Math.sin(d.ph * 9) * u);
      });
      // barquinho: boia e balança; levado pelo vento inclina e a vela enche
      st.bob += dt;
      const floating = st.boatY > POOL.water.min + 0.02;
      const by = floating ? st.boatY - 0.035 + Math.sin(t * 2.1) * 0.008 : 0.012;
      boat.object.position.y = ease(boat.object.position.y, by, dt, 6);
      boat.object.rotation.z = floating ? Math.sin(t * 1.7) * 0.06 + (st.drift ? -0.08 : 0) : 0.18;
      boat.object.rotation.x = floating ? Math.sin(t * 1.3 + 1) * 0.05 : 0.05;
      boat.object.rotation.y = floating ? Math.sin(t * 0.4) * 0.25 : 0.4;
      boat.sail.scale.z = 1;
      boat.sail.rotation.y = st.drift ? 0.35 + Math.sin(t * 5) * 0.05 : Math.sin(t * 0.8) * 0.1;
      boat.flag.rotation.y = st.drift ? Math.sin(t * 12) * 0.3 : Math.sin(t * 2) * 0.2;
      // ventilador
      st.spinV = ease(st.spinV, st.power ? 18 : 0, dt, st.power ? 1.6 : 0.8);
      st.spin += st.spinV * dt;
      fan.blades.rotation.x = st.spin;
      fan.head.rotation.z = Math.sin(t * 0.7) * 0.03;
      const flutter = st.spinV / 18;
      for (const rbn of fan.ribbons) {
        const pos = rbn.rb.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const bx = rbn.base[i * 3];
          const k = bx / 0.22;
          pos.setX(i, bx * (0.25 + 0.75 * flutter) );
          pos.setY(i, rbn.base[i * 3 + 1] - (1 - flutter) * k * 0.16 + Math.sin(t * 22 + k * 6 + rbn.ph) * 0.015 * flutter * k);
          pos.setZ(i, Math.sin(t * 18 + k * 5 + rbn.ph) * 0.02 * flutter * k);
        }
        pos.needsUpdate = true;
      }
      winds.forEach((w) => {
        const u = (t * 0.9 + w.ph) % 1;
        w.m.position.set(FAN.x + 0.3 + u * 2.3, w.y + Math.sin(u * 6 + w.ph * 9) * 0.04, FAN.z + w.dz * 0.5);
        w.m.material.opacity = flutter * Math.sin(Math.PI * u) * 0.5;
      });
      oLed.material.color.set(st.power ? '#9be05a' : '#5a5650');
      // destaque do caixote (quem pode empurrar vê o brilho)
      st.hlK = ease(st.hlK, st.hl ? 1 : 0, dt, 5);
      cMat.emissiveIntensity = st.hlK * (0.15 + 0.1 * Math.sin(t * 4));
    },
  };
}
