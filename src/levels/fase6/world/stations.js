// Expresso do Superbafo · as estações do puzzle fora da maquete: pedal de mola (desenho de patinhas
// saltando), canaleta e bandeja da estrela, placa da cancela, marca de mira diante da janela do nariz, tapete
// com o foguete de dois berços (decola na comemoração) e as duas cargas: a bolinha-planeta (com anel), que
// começa no vagão, e a lua de brinquedo, que começa na cestinha do pórtico, dentro da maquete.
import * as THREE from 'three';
import { rbox, stdMat, woodMat, canvasTexture, contactShadow } from '../../../world/util.js';
import { PEDAL, CHUTE, TRAY, BLOW_SPOT, GOAL, BALL, MOON, BARRIER_PLATE, ROCKET, RAIL_YARD } from '../layout.js';
import { starShape } from './railway.js';

const TAU = Math.PI * 2;

/** @param {THREE.Object3D} parent @param {THREE.BufferGeometry} geo @param {THREE.Material} mat @param {number} [x] @param {number} [y] @param {number} [z] */
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const decalOpts = { transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.9 };

/** Mola vertical (hélice) de altura 1 (escala em Y = altura). */
function coilGeometry(radius, turns, tube) {
  const n = Math.round(turns * 16);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t, Math.sin(a) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, tube, 6, false);
}

// ------------------------------------------------------------------ texturas
function pawPadTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const paw = (x, y, s, rot) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
      g.fillStyle = '#7a4f36';
      g.beginPath(); g.ellipse(0, 10, 20, 16, 0, 0, TAU); g.fill();
      for (const [dx, dy] of [[-20, -12], [-7, -22], [7, -22], [20, -12]]) { g.beginPath(); g.ellipse(dx, dy, 7, 9, 0, 0, TAU); g.fill(); }
      g.restore();
    };
    paw(92, 150, 1.2, -0.25);
    paw(168, 112, 1.2, 0.25);
    // arcos de pulo entre as patinhas
    g.strokeStyle = 'rgba(122,79,54,0.75)'; g.lineWidth = 7; g.lineCap = 'round'; g.setLineDash([14, 14]);
    g.beginPath(); g.moveTo(70, 96); g.quadraticCurveTo(110, 30, 156, 58); g.stroke();
    g.setLineDash([]);
    g.beginPath(); g.moveTo(146, 46); g.lineTo(160, 58); g.lineTo(142, 66); g.stroke();
  }, { repeat: false });
}
function aimTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(79,143,139,0.85)'; g.lineWidth = 10; g.setLineDash([22, 16]);
    g.beginPath(); g.arc(w / 2, h / 2, 108, 0, TAU); g.stroke();
    g.setLineDash([]);
    // nuvenzinha de superbafo indo para a janela (para o norte = topo da textura)
    g.fillStyle = 'rgba(168,215,127,0.9)';
    for (const [x, y, r] of [[104, 150, 22], [128, 136, 27], [154, 150, 21], [128, 160, 22]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(79,143,139,0.9)'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(128, 104); g.lineTo(128, 52); g.stroke();
    g.beginPath(); g.moveTo(104, 74); g.lineTo(128, 48); g.lineTo(152, 74); g.stroke();
  }, { repeat: false });
}
function rugTexture() {
  return canvasTexture(512, 400, (g, w, h) => {
    g.fillStyle = '#365a7e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f1e2c4'; g.lineWidth = 10; g.strokeRect(16, 16, w - 32, h - 32);
    g.strokeStyle = '#e0a84a'; g.lineWidth = 5; g.setLineDash([16, 12]); g.strokeRect(34, 34, w - 68, h - 68); g.setLineDash([]);
    // estrelinhas e dois planetas
    const star = (x, y, r) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill();
    };
    g.fillStyle = '#f6e6b8';
    for (const [x, y, r] of [[80, 80, 12], [430, 70, 9], [440, 320, 13], [90, 320, 9], [250, 60, 7], [380, 200, 6], [130, 210, 7]]) star(x, y, r);
    g.fillStyle = '#d9705a'; g.beginPath(); g.arc(400, 120, 26, 0, TAU); g.fill();
    g.strokeStyle = '#f2c766'; g.lineWidth = 6; g.beginPath(); g.ellipse(400, 120, 42, 11, -0.3, 0, TAU); g.stroke();
    g.fillStyle = '#7ca8b2'; g.beginPath(); g.arc(110, 140, 18, 0, TAU); g.fill();
    // foguete no meio, subindo para o norte, com fumacinha
    g.save(); g.translate(w / 2, h / 2 + 10);
    g.fillStyle = '#f3e6cc';
    g.beginPath(); g.moveTo(0, -110); g.quadraticCurveTo(46, -60, 34, 60); g.lineTo(-34, 60); g.quadraticCurveTo(-46, -60, 0, -110); g.fill();
    g.fillStyle = '#c8553d';
    g.beginPath(); g.moveTo(0, -110); g.quadraticCurveTo(28, -84, 30, -64); g.lineTo(-30, -64); g.quadraticCurveTo(-28, -84, 0, -110); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 32, 20); g.lineTo(s * 66, 76); g.lineTo(s * 30, 64); g.closePath(); g.fill(); }
    g.fillStyle = '#4f8f8b'; g.beginPath(); g.arc(0, -20, 20, 0, TAU); g.fill();
    g.fillStyle = '#bfe2e6'; g.beginPath(); g.arc(0, -20, 12, 0, TAU); g.fill();
    g.fillStyle = '#f2c766';
    for (const [x, y, r] of [[-14, 84, 16], [14, 88, 14], [0, 104, 18]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  }, { repeat: false });
}
function planetTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#5e9fb8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a7c56a';
    for (const [x, y, rx, ry, a] of [[40, 50, 26, 16, 0.4], [70, 70, 18, 22, -0.2], [150, 40, 30, 14, 0.1], [190, 84, 22, 18, 0.6], [236, 52, 16, 20, 0]]) {
      g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, TAU); g.fill();
      if (x + rx > w) { g.beginPath(); g.ellipse(x - w, y, rx, ry, a, 0, TAU); g.fill(); }
    }
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [x, y, rx] of [[30, 28, 30], [120, 96, 36], [210, 30, 26]]) { g.beginPath(); g.ellipse(x, y, rx, 5, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#f2f7f9'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8);
  }, { repeat: false });
}
/** Lua de brinquedo: creme com crateras e uma carinha dormindo (de frente para +Z da esfera). */
function moonTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#ece3c8'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(160,150,120,0.55)';
    for (const [x, y, r] of [[30, 40, 12], [60, 90, 9], [110, 30, 7], [150, 95, 13], [200, 45, 10], [236, 88, 8], [180, 20, 6]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    // carinha em U = 0,25 (na SphereGeometry, é o lado +Z)
    const cx = w * 0.25, cy = h * 0.52;
    g.strokeStyle = '#6e5a46'; g.lineWidth = 4; g.lineCap = 'round';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 13, cy - 6, 7, 0.2, Math.PI - 0.2); g.stroke(); }
    g.beginPath(); g.arc(cx, cy + 8, 6, 0.3, Math.PI - 0.3); g.stroke();
    g.fillStyle = 'rgba(232,140,128,0.6)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 22, cy + 6, 6, 4, 0, 0, TAU); g.fill(); }
  }, { repeat: false });
}
/** Placa da cancela: listras de atenção na borda e o desenho de uma cancela levantada. */
function plateTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e8d4a6'; g.beginPath(); g.arc(w / 2, h / 2, 126, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(w / 2, h / 2, 124, 0, TAU); g.arc(w / 2, h / 2, 96, 0, TAU, true); g.clip();
    for (let i = 0; i < 24; i++) {
      g.fillStyle = i % 2 ? '#f6efe2' : '#d9473a';
      g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, 130, (i * TAU) / 24, ((i + 1) * TAU) / 24); g.closePath(); g.fill();
    }
    g.restore();
    g.fillStyle = '#3f7d79'; g.fillRect(84, 150, 16, 46);
    g.save(); g.translate(92, 152); g.rotate(-1.2);
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#f6efe2' : '#d9473a'; g.fillRect(i * 14, -6, 14, 12); }
    g.restore();
    g.fillStyle = '#7a4f36';
    g.beginPath(); g.ellipse(160, 168, 20, 16, 0, 0, TAU); g.fill();
    for (const [dx, dy] of [[-20, -12], [-7, -22], [7, -22], [20, -12]]) { g.beginPath(); g.ellipse(160 + dx, 168 + dy, 7, 9, 0, 0, TAU); g.fill(); }
  }, { repeat: false });
}

/**
 * Canaleta de madeira inclinada de (z0, y0) a (z1, y1), descendo para o lado de z1, com apoio na borda da
 * maquete e dois pés perto da bandeja.
 */
function buildChute(root, C, woodM, tealM, footM) {
  const dir = Math.sign(C.z1 - C.z0);
  const len = Math.hypot(C.z1 - C.z0, C.y0 - C.y1);
  const slope = Math.atan2(C.y0 - C.y1, Math.abs(C.z1 - C.z0));
  const chute = new THREE.Group();
  chute.name = 'canaleta';
  chute.position.set(C.x, (C.y0 + C.y1) / 2, (C.z0 + C.z1) / 2);
  chute.rotation.order = 'YXZ';
  chute.rotation.set(slope, dir > 0 ? 0 : Math.PI, 0);
  root.add(chute);
  add(chute, rbox(C.halfWidth * 2, 0.025, len, 0.008), woodM, 0, -0.0125, 0);
  for (const s of [-1, 1]) add(chute, rbox(0.025, 0.075, len, 0.008), tealM, s * (C.halfWidth + 0.0125), 0.025, 0);
  add(root, rbox(C.halfWidth * 2 + 0.06, C.y0 - RAIL_YARD.height - 0.03, 0.06, 0.01), tealM, C.x, (C.y0 + RAIL_YARD.height - 0.03) / 2, C.z0 + dir * 0.03);
  const footY = C.y1 + (C.y0 - C.y1) * 0.25;
  for (const s of [-1, 1]) {
    add(root, rbox(0.03, footY - 0.03, 0.03, 0.006), footM, C.x + s * (C.halfWidth - 0.02), (footY - 0.03) / 2, C.z1 - (C.z1 - C.z0) * 0.25);
  }
  return chute;
}
/** Bandeja de madeira com um ícone no fundo (a carga assenta com o centro em tray.y). */
function buildTray(root, tray, woodMap, iconMat) {
  const floorY = tray.y - BALL.r;
  // o fundo fica 5 mm acima do assoalho (as duas faces da bandeja aparecem: sem plano em comum com o chão)
  const dish = [[0.0001, floorY], [0.22, floorY], [0.262, floorY + 0.016], [0.288, floorY + 0.036], [0.31, floorY + 0.036], [0.32, floorY + 0.02], [0.315, 0.016], [0.296, 0.005], [0.0001, 0.005]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  add(root, new THREE.LatheGeometry(dish, 40), new THREE.MeshStandardMaterial({ map: woodMap, color: '#c79563', roughness: 0.55, side: THREE.DoubleSide }), tray.x, 0, tray.z);
  return { floorY, icon: (geo) => { const m = add(root, geo, iconMat, tray.x, floorY + 0.001, tray.z); m.castShadow = false; return m; } };
}

/** @param {THREE.Object3D} root */
export function buildStations(root) {
  const brass = stdMat('#c99a52', { roughness: 0.38, metalness: 0.55 });
  const teal = stdMat('#4f8f8b', { roughness: 0.55 });
  const iron = stdMat('#55585b', { roughness: 0.55, metalness: 0.3 });

  // ================================================================ pedal de mola (baixo: as dogs pisam nele)
  const pedalObject = new THREE.Group();
  pedalObject.name = 'pedal-de-pulo';
  pedalObject.position.set(PEDAL.x, 0, PEDAL.z);
  root.add(pedalObject);
  add(pedalObject, new THREE.CylinderGeometry(PEDAL.r + 0.05, PEDAL.r + 0.07, 0.03, 40), iron, 0, 0.015, 0);
  const coilGeo = coilGeometry(0.045, 4, 0.008);
  const coils = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    const c = add(pedalObject, coilGeo, brass, Math.cos(a) * (PEDAL.r + 0.01), 0.03, Math.sin(a) * (PEDAL.r + 0.01));
    c.scale.y = 0.05;
    coils.push(c);
  }
  const top = new THREE.Group();
  top.position.y = 0.08;
  pedalObject.add(top);
  add(top, new THREE.CylinderGeometry(PEDAL.r, PEDAL.r, 0.03, 40), stdMat('#e0a84a', { roughness: 0.5 }), 0, -0.015, 0);
  const rim = add(top, new THREE.TorusGeometry(PEDAL.r - 0.01, 0.016, 8, 48), brass, 0, 0, 0);
  rim.rotation.x = Math.PI / 2;
  const paws = add(top, new THREE.CircleGeometry(PEDAL.r - 0.06, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pawPadTexture(), ...decalOpts }), 0, 0.001, 0);
  paws.castShadow = false;
  /** @type {import('../../../types').Fase6Props['pedal']} */
  const pedal = {
    object: pedalObject,
    setPress(t) {
      const k = Math.max(0, Math.min(1, t));
      top.position.y = 0.08 - k * 0.03;
      for (const c of coils) c.scale.y = top.position.y - 0.03;
    },
  };

  // ================================================================ canaleta e bandeja da estrela (as duas cargas cabem nela)
  const chuteWood = woodMat('#d7b07c', { key: 'expresso-moldura', rough: 0.6 });
  const footMat = stdMat('#5a3b2c', { roughness: 0.7 });
  buildChute(root, CHUTE, chuteWood, teal, footMat);
  const starTray = buildTray(root, TRAY, chuteWood.map, new THREE.MeshStandardMaterial({ color: '#f2c766', emissive: '#e0a84a', emissiveIntensity: 0.18, ...decalOpts, transparent: false }));
  starTray.icon(new THREE.ShapeGeometry(starShape(0.15)).rotateX(-Math.PI / 2));

  // ================================================================ placa que segura a cancela (prop barrierPlate)
  const plateObject = new THREE.Group();
  plateObject.name = 'placa-da-cancela';
  plateObject.position.set(BARRIER_PLATE.x, 0, BARRIER_PLATE.z);
  root.add(plateObject);
  add(plateObject, new THREE.CylinderGeometry(BARRIER_PLATE.r + 0.03, BARRIER_PLATE.r + 0.04, 0.02, 32), iron, 0, 0.01, 0);
  const plateTop = new THREE.Group();
  plateTop.position.y = 0.035;
  plateObject.add(plateTop);
  add(plateTop, new THREE.CylinderGeometry(BARRIER_PLATE.r, BARRIER_PLATE.r, 0.02, 32), woodMat('#cfa678', { key: 'expresso-plataforma', rough: 0.7 }), 0, -0.01, 0);
  const plateFace = add(plateTop, new THREE.CircleGeometry(BARRIER_PLATE.r - 0.01, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: plateTexture(), ...decalOpts }), 0, 0.001, 0);
  plateFace.castShadow = false;
  /** @type {import('../../../types').Fase6Props['barrierPlate']} */
  const barrierPlate = { object: plateObject, setPress(t) { plateTop.position.y = 0.035 - Math.min(1, Math.max(0, t)) * 0.012; } };

  // ================================================================ marca de mira (superbafo daqui, pela janela)
  const aim = add(root, new THREE.PlaneGeometry(0.72, 0.72).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: aimTexture(), ...decalOpts }), BLOW_SPOT.x, 0.003, BLOW_SPOT.z);
  aim.castShadow = false;

  // ================================================================ tapete de foguete e o foguete com os dois berços
  const goalObject = new THREE.Group();
  goalObject.name = 'tapete-foguete';
  goalObject.position.set(GOAL.x, 0, GOAL.z);
  root.add(goalObject);
  const rugMat = new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1, emissive: '#d4a857', emissiveIntensity: 0 });
  const rug = add(goalObject, rbox(1.85, 0.014, 1.45, 0.006, 1), rugMat, 0, 0.007, 0);
  rug.castShadow = false;
  const pad = new THREE.Group();
  pad.name = 'base-do-foguete';
  pad.position.set(ROCKET.x, 0.014, ROCKET.z);
  root.add(pad);
  add(pad, new THREE.CylinderGeometry(ROCKET.r, ROCKET.r + 0.02, 0.04, 28), woodMat('#b98457', { key: 'expresso-caixa', rough: 0.7 }), 0, 0.02, 0);
  add(pad, new THREE.TorusGeometry(ROCKET.r - 0.03, 0.012, 6, 28).rotateX(Math.PI / 2), stdMat('#e0a84a', { roughness: 0.45 }), 0, 0.045, 0);
  const rocket = new THREE.Group();
  rocket.name = 'foguete';
  pad.add(rocket);
  const cream = stdMat('#f3e6cc', { roughness: 0.45 });
  const red = stdMat('#c8553d', { roughness: 0.45 });
  add(rocket, new THREE.CylinderGeometry(0.1, 0.12, 0.5, 24), cream, 0, 0.32, 0);
  add(rocket, new THREE.ConeGeometry(0.1, 0.22, 24), red, 0, 0.68, 0);
  add(rocket, new THREE.CylinderGeometry(0.07, 0.09, 0.07, 18, 1, true), stdMat('#3a3330', { roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), 0, 0.075, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 2;
    const fin = add(rocket, rbox(0.02, 0.18, 0.12, 0.006), teal, Math.cos(a) * 0.13, 0.125, Math.sin(a) * 0.13);
    fin.rotation.y = -a;
  }
  for (const y of [0.18, 0.5]) add(rocket, new THREE.TorusGeometry(0.112, 0.01, 6, 28).rotateX(Math.PI / 2), stdMat('#c99a52', { roughness: 0.38, metalness: 0.55 }), 0, y + (y < 0.3 ? 0.002 : 0), 0);
  // janelinha redonda (o corpo tem ~0,107 m de raio nessa altura: vidro e aro ficam à frente da superfície)
  const windowRing = add(rocket, new THREE.TorusGeometry(0.04, 0.01, 8, 20), brass, 0, 0.4, 0.11);
  windowRing.castShadow = false;
  add(rocket, new THREE.CircleGeometry(0.036, 18), stdMat('#9fd0d6', { roughness: 0.15, emissive: '#7fc0c8', emissiveIntensity: 0.2 }), 0, 0.4, 0.112).castShadow = false;
  // berços: braço de latão e um ninho de feltro; o soquete fica no centro da carga encaixada
  /** @type {Record<import('../../../types').Fase6Cargo, THREE.Object3D>} */
  const sockets = /** @type {any} */ ({});
  for (const cargo of /** @type {import('../../../types').Fase6Cargo[]} */ (['planet', 'moon'])) {
    const S = ROCKET.sockets[cargo];
    const arm = add(rocket, new THREE.CylinderGeometry(0.012, 0.012, Math.abs(S.x) - 0.08, 8), brass, S.x / 2 + Math.sign(S.x) * 0.04, S.y - BALL.r - 0.01, S.z);
    arm.rotation.z = Math.PI / 2;
    const nest = add(rocket, new THREE.TorusGeometry(0.065, 0.02, 8, 20).rotateX(Math.PI / 2), stdMat(cargo === 'planet' ? '#e0a84a' : '#a8c4d8', { roughness: 0.9 }), S.x, S.y - BALL.r + 0.012, S.z);
    nest.name = `berco-${cargo}`;
    const socket = new THREE.Group();
    socket.name = `encaixe-${cargo}`;
    socket.position.set(S.x, S.y, S.z);
    rocket.add(socket);
    sockets[cargo] = socket;
  }
  // chama da decolagem (só aparece subindo)
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, depthWrite: false });
  const flame = add(rocket, new THREE.ConeGeometry(0.07, 0.24, 16).rotateX(Math.PI), flameMat, 0, -0.08, 0);
  flame.castShadow = false;
  flame.visible = false;
  const launchState = { on: false, t: 0 };
  function setLaunchPose() {
    const t = launchState.t;
    // treme, sobe devagar e acelera; a chama pisca
    const rise = t < 0.6 ? 0 : (t - 0.6) * (t - 0.6) * 0.4;
    rocket.position.set(t < 0.6 ? Math.sin(t * 60) * 0.006 : 0, Math.min(rise, 6), 0);
    flame.visible = launchState.on && t > 0.2;
    flame.scale.set(1, 0.8 + Math.abs(Math.sin(t * 30)) * 0.6, 1);
  }
  /** @type {import('../../../types').Fase6Props['goal']} */
  const goal = {
    object: goalObject,
    setHighlight(on) { rugMat.emissiveIntensity = on ? 0.22 : 0; },
    socket(cargo) { return sockets[cargo]; },
    launch() { launchState.on = true; launchState.t = 0; },
  };

  // ================================================================ as duas cargas: bolinha-planeta (no vagão) e a lua (no pórtico)
  const ballObject = new THREE.Group();
  ballObject.name = 'ball';
  ballObject.userData.carryKind = 'ball';
  root.add(ballObject);
  const ballMat = new THREE.MeshStandardMaterial({ map: planetTexture(), roughness: 0.5, emissive: '#d9aa62', emissiveIntensity: 0 });
  add(ballObject, new THREE.SphereGeometry(BALL.r, 28, 18), ballMat);
  const ring = add(ballObject, new THREE.TorusGeometry(BALL.r * 1.38, 0.007, 6, 40), stdMat('#f2c766', { roughness: 0.4 }));
  ring.rotation.set(Math.PI / 2.4, 0.3, 0);
  const ballHome = new THREE.Vector3(BALL.x, BALL.y, BALL.z);
  /** @type {import('../../../types').ItemProp} */
  const ball = { object: ballObject, home: ballHome, setHighlight(on) { ballMat.emissiveIntensity = on ? 0.22 : 0; } };
  const moonObject = new THREE.Group();
  moonObject.name = 'moon';
  moonObject.userData.carryKind = 'ball';
  root.add(moonObject);
  const moonMat = new THREE.MeshStandardMaterial({ map: moonTexture(), roughness: 0.65, emissive: '#e8d48a', emissiveIntensity: 0 });
  add(moonObject, new THREE.SphereGeometry(MOON.r, 28, 18), moonMat);
  const moonHome = new THREE.Vector3(MOON.x, MOON.y, MOON.z);
  /** @type {import('../../../types').ItemProp} */
  const moon = { object: moonObject, home: moonHome, setHighlight(on) { moonMat.emissiveIntensity = on ? 0.25 : 0; } };
  const shadows = [ballObject, moonObject].map((o) => {
    const sh = contactShadow(0.13, 0.13, 0.3, 0.008);
    root.add(sh);
    return { o, sh };
  });

  return {
    pedal, goal, ball, moon, barrierPlate,
    update(dt) {
      // sombrinha das cargas só quando estão na bandeja (não no vagão, no pórtico, na boca ou no foguete)
      for (const { o, sh } of shadows) {
        const p = o.position;
        sh.visible = o.parent === root && o.visible && p.y < TRAY.y + 0.05;
        sh.position.set(p.x, TRAY.y - BALL.r + 0.002, p.z);
      }
      if (launchState.on) { launchState.t += dt; setLaunchPose(); }
    },
    reset() {
      pedal.setPress(0);
      barrierPlate.setPress(0);
      for (const [o, home] of /** @type {[THREE.Object3D, THREE.Vector3][]} */ ([[ballObject, ballHome], [moonObject, moonHome]])) {
        o.position.copy(home);
        o.rotation.set(0, 0, 0);
        o.visible = true;
      }
      ball.setHighlight(false);
      moon.setHighlight(false);
      goal.setHighlight(false);
      launchState.on = false;
      launchState.t = 0;
      setLaunchPose();
    },
  };
}
