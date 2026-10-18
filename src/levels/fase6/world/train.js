// Expresso do Superbafo · a composição de brinquedo: locomotiva de madeira pintada com cara (olhos com
// pálpebras, bochechas, sorriso e o nariz vermelho na ponta de uma mola), vagão-caçamba articulado que
// bascula para a canaleta e o engate entre os dois. Tudo em coordenadas locais com +Z = cara da locomotiva.
//
//   const T = buildTrain(root);
//   T.train.setPose({ x, z, yaw, wagon: { x, z, yaw }, tip })   // sem `wagon`: vagão rígido atrás
//   T.nose.setSneeze(fase)                                       // 0..1 = espirro inteiro (0 e 1 = repouso)
//   T.update(dt, t)                                              // piscar e respirar parado
import * as THREE from 'three';
import { rbox, stdMat, woodMat, canvasTexture } from '../../../world/util.js';
import { TRAIN } from '../layout.js';

const TAU = Math.PI * 2;
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };

/** @param {THREE.Object3D} parent @param {THREE.BufferGeometry} geo @param {THREE.Material} mat @param {number} [x] @param {number} [y] @param {number} [z] */
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Placa pintada (decalque por cima da madeira: não briga com a face de baixo). */
function decalMat(draw, w, h) {
  const map = canvasTexture(w, h, draw, { repeat: false });
  return new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

/** Mola em hélice ao longo de +Z, de 0 a 1 (escala em Z = comprimento). */
function springGeometry(radius, turns, tube) {
  const n = Math.round(turns * 18);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * TAU;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, t));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, tube, 6, false);
}

/**
 * Roda pintada com cubo; o eixo é X. `pin` = raio do pino da biela (do lado de fora, `side`).
 * @param {number} r @param {number} w @param {number} side @param {number} [pin]
 */
function wheel(parent, r, w, mats, side, x, y, z, pin = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const rim = add(g, new THREE.CylinderGeometry(r, r, w, 20), mats.wheel);
  rim.rotation.z = Math.PI / 2;
  const hub = add(g, new THREE.CylinderGeometry(r * 0.38, r * 0.38, w + 0.005, 12), mats.hub);
  hub.rotation.z = Math.PI / 2;
  // anel escuro do aro (dá leitura de roda de brinquedo de longe)
  for (const s of [-1, 1]) {
    const ring = add(g, new THREE.TorusGeometry(r * 0.78, r * 0.07, 6, 20), mats.dark, s * (w / 2 + 0.001), 0, 0);
    ring.rotation.y = Math.PI / 2;
  }
  if (pin) {
    const p = add(g, new THREE.CylinderGeometry(0.011, 0.011, 0.03, 8), mats.brass, side * (w / 2 + 0.012), pin, 0);
    p.rotation.z = Math.PI / 2;
  }
  parent.add(g);
  return g;
}

/** Limpa-trilhos: perfil triangular (frente × altura) estendido na largura. */
function cowcatcherGeometry(width, depth, height) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(depth, 0);
  shape.lineTo(0, height);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(width / 2, 0, 0);
}

/** @param {THREE.Object3D} root */
export function buildTrain(root) {
  const mats = {
    teal: stdMat('#4f8f8b', { roughness: 0.55 }),
    tealDark: stdMat('#3b706d', { roughness: 0.6 }),
    red: stdMat('#c8553d', { roughness: 0.55 }),
    mustard: stdMat('#e0a84a', { roughness: 0.55 }),
    cream: stdMat('#f3e6cc', { roughness: 0.6 }),
    brass: stdMat('#c99a52', { roughness: 0.38, metalness: 0.55 }),
    dark: stdMat('#2f2724', { roughness: 0.7 }),
    chassis: woodMat('#6a4632', { key: 'expresso-chassi', rough: 0.7 }),
    wheel: stdMat('#b9473a', { roughness: 0.5 }),
    hub: stdMat('#f1dfb8', { roughness: 0.5 }),
    pink: stdMat('#ef9a8f', { roughness: 0.8 }),
    white: stdMat('#fbf6ec', { roughness: 0.35 }),
    pupil: stdMat('#2a211d', { roughness: 0.25 }),
    noseRed: stdMat('#e2493b', { roughness: 0.3 }),
  };
  const railY = TRAIN.railY;

  // ================================================================ locomotiva
  const loco = new THREE.Group();
  loco.name = 'locomotiva';
  root.add(loco);
  const LR = 0.105; // raio das rodas motrizes
  const axleY = railY + LR;
  /** @type {THREE.Group[]} */
  const locoWheels = [];
  for (const z of [-0.27, 0, 0.27]) for (const s of [-1, 1]) locoWheels.push(wheel(loco, LR, 0.045, mats, s, s * 0.17, axleY, z, 0.055));
  // bielas: ligam as três rodas de cada lado e giram com elas
  const rods = [-1, 1].map((s) => {
    const rod = add(loco, rbox(0.016, 0.024, 0.62, 0.006), mats.brass, s * 0.205, axleY + 0.055, 0);
    return rod;
  });
  // corpo (inclina e respira sobre o eixo de trás; rodas e bielas ficam no trilho)
  const pivot = new THREE.Vector3(0, axleY, -0.27);
  const body = new THREE.Group();
  body.position.copy(pivot);
  loco.add(body);
  const B = (geo, mat, x, y, z) => add(body, geo, mat, x - pivot.x, y - pivot.y, z - pivot.z);
  B(rbox(0.28, 0.175, 0.86, 0.02), mats.chassis, 0, 0.3275, 0);
  B(rbox(0.48, 0.04, 0.92, 0.012), mats.red, 0, 0.43, 0);
  // caldeira, cintas de latão, domo e chaminé
  const boiler = B(new THREE.CylinderGeometry(0.165, 0.165, 0.5, 28), mats.teal, 0, 0.61, 0.15);
  boiler.rotation.x = Math.PI / 2;
  for (const z of [0.0, 0.24]) B(new THREE.TorusGeometry(0.167, 0.009, 8, 32), mats.brass, 0, 0.61, z);
  // caixa de fumaça: a tampa da frente fica 2 mm à frente da ponta do estrado (sem faces no mesmo plano)
  const smokebox = B(new THREE.CylinderGeometry(0.172, 0.172, 0.062, 28), mats.tealDark, 0, 0.61, 0.431);
  smokebox.rotation.x = Math.PI / 2;
  const faceDisc = B(new THREE.CylinderGeometry(0.158, 0.158, 0.02, 28), mats.cream, 0, 0.61, 0.472);
  faceDisc.rotation.x = Math.PI / 2;
  B(new THREE.SphereGeometry(0.07, 16, 10, 0, TAU, 0, Math.PI / 2), mats.brass, 0, 0.765, 0.04);
  B(new THREE.CylinderGeometry(0.075, 0.05, 0.2, 18, 1, true), mats.dark, 0, 0.845, TRAIN.chimney.z);
  B(new THREE.CircleGeometry(0.066, 18).rotateX(-Math.PI / 2), stdMat('#151110', { roughness: 0.9 }), 0, 0.915, TRAIN.chimney.z);
  B(new THREE.TorusGeometry(0.074, 0.013, 8, 22).rotateX(Math.PI / 2), mats.brass, 0, 0.945, TRAIN.chimney.z);
  // cabine com janelas, teto creme e plaquinha com o nome
  B(rbox(0.46, 0.36, 0.32, 0.03), mats.red, 0, 0.63, -0.27);
  B(rbox(0.54, 0.045, 0.4, 0.02), mats.cream, 0, 0.835, -0.27);
  const winMat = decalMat((g, w, h) => {
    g.fillStyle = '#2b3a3c'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 18); g.fill();
    g.fillStyle = 'rgba(255,248,230,0.35)'; g.beginPath(); g.roundRect(14, 12, w * 0.32, h * 0.4, 10); g.fill();
  }, 128, 128);
  for (const s of [-1, 1]) {
    const win = add(body, new THREE.PlaneGeometry(0.18, 0.15), winMat, s * 0.2315 - pivot.x, 0.71 - pivot.y, -0.27 - pivot.z);
    win.rotation.y = s * Math.PI / 2;
    win.castShadow = false;
  }
  const plateMat = decalMat((g, w, h) => {
    g.fillStyle = '#e0a84a'; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 14); g.fill();
    g.strokeStyle = '#7a4a24'; g.lineWidth = 4; g.beginPath(); g.roundRect(7, 7, w - 14, h - 14, 10); g.stroke();
    g.fillStyle = '#5a2f1c'; g.font = '700 46px "Fredoka", "Comic Sans MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXPRESSO', w / 2, h / 2 + 2);
  }, 320, 80);
  for (const s of [-1, 1]) {
    const plate = add(body, new THREE.PlaneGeometry(0.26, 0.065), plateMat, s * 0.2315 - pivot.x, 0.545 - pivot.y, -0.27 - pivot.z);
    plate.rotation.y = s * Math.PI / 2;
    plate.castShadow = false;
  }
  // frente: travessa vermelha, para-choques de latão e limpa-trilhos (nada passa de 0,5 m do centro:
  // TRAIN_BODY.loco, usado no teste da cerca)
  B(rbox(0.46, 0.07, 0.05, 0.012), mats.red, 0, 0.4, 0.44);
  for (const s of [-1, 1]) {
    const buf = B(new THREE.CylinderGeometry(0.026, 0.026, 0.035, 12), mats.brass, s * 0.16, 0.4, 0.4825);
    buf.rotation.x = Math.PI / 2;
  }
  B(cowcatcherGeometry(0.32, 0.07, 0.13), mats.mustard, 0, 0.222, 0.42);
  // engate de trás
  B(rbox(0.06, 0.04, 0.06, 0.01), mats.brass, 0, 0.33, -0.455);

  // ---- a cara
  const faceZ = 0.482;
  /** @type {{ lid: THREE.Group }[]} */
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = B(new THREE.SphereGeometry(0.042, 16, 12), mats.white, s * 0.062, 0.655, faceZ);
    eye.scale.z = 0.55;
    const pupil = B(new THREE.SphereGeometry(0.022, 12, 10), mats.pupil, s * 0.058, 0.648, faceZ + 0.018);
    pupil.scale.z = 0.5;
    B(new THREE.SphereGeometry(0.007, 8, 6), mats.white, s * 0.058 + 0.007, 0.657, faceZ + 0.03);
    // pálpebra: meia esfera presa no centro do olho; gira para a frente para fechar
    const lid = new THREE.Group();
    lid.position.set(s * 0.062 - pivot.x, 0.655 - pivot.y, faceZ - pivot.z);
    lid.scale.set(1, 1, 0.62);
    add(lid, new THREE.SphereGeometry(0.046, 16, 8, 0, TAU, 0, Math.PI / 2), mats.teal);
    body.add(lid);
    eyes.push({ lid });
    const brow = B(rbox(0.05, 0.01, 0.012, 0.004), mats.dark, s * 0.062, 0.715, faceZ + 0.004);
    brow.rotation.z = s * -0.18;
  }
  const cheeks = [-1, 1].map((s) => {
    const c = B(new THREE.SphereGeometry(0.03, 12, 10), mats.pink, s * 0.108, 0.58, faceZ);
    c.scale.set(1, 0.7, 0.35);
    return c;
  });
  const mouth = B(new THREE.TorusGeometry(0.034, 0.007, 6, 16, Math.PI), mats.dark, 0, 0.56, faceZ + 0.006);
  mouth.rotation.z = Math.PI;
  // nariz de mola: o grupo é o prop `nose` (escala = inchaço); a mola estica no "atchim"
  const noseObject = new THREE.Group();
  noseObject.name = 'nariz-de-mola';
  noseObject.position.set(0 - pivot.x, TRAIN.noseY - pivot.y, faceZ + 0.005 - pivot.z);
  body.add(noseObject);
  const SPRING_REST = 0.045;
  const spring = add(noseObject, springGeometry(0.024, 3.5, 0.0055), mats.brass);
  spring.scale.z = SPRING_REST;
  const noseBall = add(noseObject, new THREE.SphereGeometry(0.062, 20, 14), mats.noseRed, 0, 0, SPRING_REST + 0.052);
  add(noseBall, new THREE.SphereGeometry(0.014, 8, 6), stdMat('#ffd8c8', { roughness: 0.2 }), -0.022, 0.025, 0.045);

  // ================================================================ vagão-caçamba
  const wagonObject = new THREE.Group();
  wagonObject.name = 'vagao';
  root.add(wagonObject);
  const WR = 0.085;
  const wAxle = railY + WR;
  /** @type {THREE.Group[]} */
  const wagonWheels = [];
  for (const z of [-0.17, 0.17]) for (const s of [-1, 1]) wagonWheels.push(wheel(wagonObject, WR, 0.04, mats, s, s * 0.17, wAxle, z));
  add(wagonObject, rbox(0.28, 0.07, 0.52, 0.015), mats.chassis, 0, 0.29, 0);
  for (const z of [-0.15, 0.15]) add(wagonObject, rbox(0.2, 0.06, 0.06, 0.01), mats.chassis, 0, 0.34, z);
  // engate só do lado da locomotiva: a ponta de longe encosta no para-choque da entrega
  add(wagonObject, rbox(0.06, 0.04, 0.06, 0.01), mats.brass, 0, 0.3, 0.29);
  // caçamba: articulada na ponta de longe da locomotiva (-Z local), bascula para lá
  const bed = new THREE.Group();
  bed.name = 'cacamba';
  bed.position.set(0, 0.368, -0.27);
  wagonObject.add(bed);
  const D = (geo, mat, x, y, z) => add(bed, geo, mat, x, y - 0.368, z + 0.27);
  D(rbox(0.44, 0.04, 0.54, 0.01), mats.mustard, 0, 0.39, 0);
  for (const s of [-1, 1]) {
    D(rbox(0.03, 0.15, 0.54, 0.01), mats.mustard, s * 0.205, 0.485, 0);
    for (const y of [0.44, 0.5]) D(new THREE.BoxGeometry(0.004, 0.007, 0.5), mats.dark, s * 0.2215, y, 0);
  }
  D(rbox(0.44, 0.15, 0.03, 0.01), mats.mustard, 0, 0.485, 0.255);
  D(rbox(0.44, 0.06, 0.03, 0.01), mats.mustard, 0, 0.44, -0.255);
  const starDecal = decalMat((g, w, h) => {
    g.fillStyle = '#fff4d6';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? w * 0.2 : w * 0.46;
      g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  }, 64, 64);
  for (const s of [-1, 1]) {
    const st = add(bed, new THREE.PlaneGeometry(0.1, 0.1), starDecal, s * 0.2205, 0.485 - 0.368, 0.27);
    st.rotation.y = s * Math.PI / 2;
    st.castShadow = false;
  }
  // ninho de feltro onde a bolinha viaja
  const nest = D(new THREE.TorusGeometry(0.07, 0.022, 8, 20), stdMat('#d9705a', { roughness: 1 }), 0, 0.43, 0);
  nest.rotation.x = Math.PI / 2;

  // ================================================================ engate
  const coupler = add(root, new THREE.CylinderGeometry(0.012, 0.012, 1, 6).rotateX(Math.PI / 2), mats.brass);
  coupler.name = 'engate';
  const hookA = new THREE.Vector3(), hookB = new THREE.Vector3();
  function updateCoupler() {
    loco.updateMatrixWorld();
    wagonObject.updateMatrixWorld();
    hookA.set(0, 0.33, -0.48).applyMatrix4(loco.matrix);
    hookB.set(0, 0.3, 0.31).applyMatrix4(wagonObject.matrix);
    coupler.position.copy(hookA).add(hookB).multiplyScalar(0.5);
    coupler.lookAt(hookB.x, hookB.y, hookB.z);
    coupler.scale.z = Math.max(0.01, hookA.distanceTo(hookB));
  }

  // ================================================================ pose
  let locoSpin = 0, wagonSpin = 0;
  /** Distância andada no sentido da cara (para trás é negativa), com trava para teletransportes. */
  function rolled(obj, x, z) {
    const dx = x - obj.position.x, dz = z - obj.position.z;
    const d = Math.sin(obj.rotation.y) * dx + Math.cos(obj.rotation.y) * dz;
    return Math.abs(d) < 0.5 ? d : 0;
  }
  function applySpin() {
    for (const w of locoWheels) w.rotation.x = locoSpin;
    for (const w of wagonWheels) w.rotation.x = wagonSpin;
    rods.forEach((rod) => rod.position.set(rod.position.x, axleY + Math.cos(locoSpin) * 0.055, Math.sin(locoSpin) * 0.055));
  }
  /** @type {import('../../../types').Fase6Props['train']} */
  const train = {
    object: loco,
    setPose(pose) {
      locoSpin += rolled(loco, pose.x, pose.z) / LR;
      loco.position.set(pose.x, 0, pose.z);
      loco.rotation.y = pose.yaw;
      const w = pose.wagon || {
        x: pose.x - Math.sin(pose.yaw) * TRAIN.cargoOffset, z: pose.z - Math.cos(pose.yaw) * TRAIN.cargoOffset, yaw: pose.yaw,
      };
      wagonSpin += rolled(wagonObject, w.x, w.z) / WR;
      wagonObject.position.set(w.x, 0, w.z);
      wagonObject.rotation.y = w.yaw;
      bed.rotation.x = -smooth(pose.tip ?? 0) * 0.62;
      applySpin();
      updateCoupler();
    },
  };

  // ================================================================ espirro e vida parada
  const BURST = TRAIN.burstAt / TRAIN.sneezeTime;
  const st = { sneeze: 0, blinkAt: 2.2, blink: 0 };
  const LID_OPEN = -1.3, LID_SHUT = 1.45;
  function setLids(k) { for (const e of eyes) e.lid.rotation.x = LID_OPEN + (LID_SHUT - LID_OPEN) * k; }
  /** @type {import('../../../types').Fase6Props['nose']} */
  const nose = {
    object: noseObject,
    setSneeze(phase) {
      const p = Math.min(1, Math.max(0, phase));
      st.sneeze = p;
      const inhale = p < BURST ? smooth(p / BURST) : 0;
      const post = p < BURST ? 0 : (p - BURST) / (1 - BURST);
      const blast = p < BURST ? 0 : (1 - post) * (1 - post);
      // inspira: nariz incha, olhos apertam, cara levanta; atchim: a mola estica e o corpo dá o tranco
      noseObject.scale.setScalar(1 + 0.3 * inhale + 0.12 * blast);
      const len = SPRING_REST + 0.11 * blast * Math.abs(Math.cos(post * Math.PI * 2.5));
      spring.scale.z = len;
      noseBall.position.z = len + 0.052;
      setLids(Math.max(inhale * 0.75, blast > 0 ? Math.min(1, blast * 1.6) : 0, st.blink));
      body.rotation.x = -0.07 * inhale + 0.09 * blast;
      body.scale.set(1 + 0.03 * blast, 1 - 0.04 * blast, 1 + 0.03 * blast);
      for (const c of cheeks) c.scale.set(1 + 0.35 * inhale, 0.7 + 0.25 * inhale, 0.35);
    },
  };
  nose.setSneeze(0);

  function update(dt, t) {
    // piscadinha de vez em quando (o espirro manda nas pálpebras enquanto acontece)
    if (t >= st.blinkAt) { st.blink = 1; st.blinkAt = t + 2.6 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 2.4; }
    st.blink = Math.max(0, st.blink - dt * 7);
    if (st.sneeze === 0) setLids(smooth(st.blink));
  }
  function reset() {
    st.blink = 0;
    nose.setSneeze(0);
    train.setPose(TRAIN.start);
    locoSpin = wagonSpin = 0;
    applySpin();
  }
  return { train, nose, loco, wagon: wagonObject, bed, coupler, update, reset };
}
