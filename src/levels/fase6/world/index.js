// Oficina em corte de maquete, com os mesmos materiais procedurais e escala das outras fases.
import * as THREE from 'three';
import { rbox, stdMat, woodMat, canvasTexture, contactShadow } from '../../../world/util.js';
import { buildTreats } from '../../../world/treats.js';
import { RAIL_YARD, PEDAL, JUNCTION, TRAIN, NOSE, TRAY, BALL, ROUTES, GOAL, COLLECTIBLES } from '../layout.js';

/** @param {THREE.Object3D} parent @param {THREE.BufferGeometry} geometry @param {THREE.Material} material
 * @param {number} x @param {number} y @param {number} z */
function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
/** @param {THREE.Object3D} parent @param {THREE.Material} material @param {number[]} size @param {number[]} pos */
function box(parent, material, size, pos) {
  return mesh(parent, rbox(size[0], size[1], size[2], Math.min(0.025, Math.min(...size) / 4)), material, .../** @type {[number, number, number]} */ (pos));
}
/** @param {THREE.Object3D} parent @param {THREE.Material} material @param {THREE.Vector3} a @param {THREE.Vector3} b @param {number} radius */
function rod(parent, material, a, b, radius) {
  const m = mesh(parent, new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
/** Etiqueta pintada em madeira; texturas pertencem ao material sob root. */
function label(parent, text, x, y, z, width, color = '#e7cda2') {
  const texture = canvasTexture(512, 128, (c) => {
    c.fillStyle = color; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = '#a76d46'; c.lineWidth = 5; c.strokeRect(7, 7, 498, 114);
    c.font = 'bold 42px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#59442f'; c.fillText(text, 256, 64);
  }, { repeat: false });
  const sign = mesh(parent, new THREE.PlaneGeometry(width, width / 4), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }), x, y, z);
  return sign;
}

/** @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase6Props>} */
export function buildWorld({ root }) {
  const wood = woodMat('#ba8961', { key: 'expresso-madeira' });
  const paleWood = woodMat('#e0bd83', { key: 'expresso-clara' });
  const cream = stdMat('#f3e3c8', { roughness: 0.9 });
  const teal = stdMat('#608f8c', { roughness: 0.68 });
  const red = stdMat('#b66b59', { roughness: 0.7 });
  const mustard = stdMat('#d5a557', { roughness: 0.65 });
  const iron = stdMat('#55585b', { roughness: 0.58, metalness: 0.25 });
  const brass = stdMat('#bf975f', { roughness: 0.5, metalness: 0.35 });
  const dark = stdMat('#363c3a', { roughness: 0.85 });
  const walls = new THREE.Group(); walls.name = 'paredes-oficina'; root.add(walls);
  box(root, wood, [11.5, 0.12, 8.4], [0, -0.065, 0]).name = 'assoalho';
  // Sul aberto; paredes laterais cortadas como a maquete da fase 5.
  box(walls, cream, [11.3, 2.7, 0.15], [0, 1.35, -4.08]);
  for (const x of [-5.58, 5.58]) {
    box(walls, cream, [0.14, 1.05, 8.05], [x, 0.525, 0.05]);
    box(walls, wood, [0.17, 0.05, 8.07], [x, 1.083, 0.05]);
  }
  box(walls, wood, [11.2, 0.1, 0.04], [0, 0.05, -3.98]);
  // Janelas e prateleiras encostadas na parede, sem obstáculos invisíveis no passeio.
  for (const x of [-3.7, 3.7]) {
    const glass = stdMat('#a9c4c6', { roughness: 0.42, emissive: '#9cae91', emissiveIntensity: 0.16 });
    box(walls, paleWood, [1.85, 1.45, 0.09], [x, 1.65, -3.95]);
    box(walls, glass, [1.64, 1.24, 0.05], [x, 1.65, -3.88]);
    box(walls, cream, [0.045, 1.25, 0.06], [x, 1.65, -3.827]);
    box(walls, cream, [1.64, 0.045, 0.04], [x, 1.65, -3.815]);
    box(walls, wood, [2.02, 0.08, 0.27], [x, 0.87, -3.86]);
  }
  label(walls, 'OFICINA DAS IRMÃS', 0, 2.15, -3.97, 2.8);
  box(walls, wood, [2.6, 0.07, 0.28], [0, 1.38, -3.84]);
  for (let i = 0; i < 7; i++) {
    const x = -1.03 + i * 0.34;
    const h = 0.18 + (i % 3) * 0.05;
    const m = [red, teal, mustard][i % 3];
    box(walls, m, [0.21, h, 0.17], [x, 1.42 + h / 2, -3.83]);
    mesh(walls, new THREE.SphereGeometry(0.05, 10, 8), cream, x, 1.46 + h, -3.83);
  }
  // Grandes tábuas e borda contínua deixam explícita a área reservada ao trem.
  box(root, paleWood, [RAIL_YARD.hx * 2, RAIL_YARD.height, RAIL_YARD.hz * 2], [RAIL_YARD.x, RAIL_YARD.height / 2, RAIL_YARD.z]);
  // As tábuas apoiam sobre a base: não duplicar suas faces externas.
  const fenceHeight = 0.7 - RAIL_YARD.height;
  const fenceY = RAIL_YARD.height + fenceHeight / 2;
  for (const x of [-RAIL_YARD.hx + 0.035, RAIL_YARD.hx - 0.035]) {
    box(root, wood, [0.07, fenceHeight, 3.3], [x, fenceY, RAIL_YARD.z]);
    box(root, teal, [0.085, 0.055, 3.31], [x, 0.735, RAIL_YARD.z]);
  }
  box(root, wood, [5.11, fenceHeight, 0.07], [0, fenceY, -2.665]);
  // A janela tem grades estreitas: nariz fica próximo, dogs não entram.
  for (const [x, w] of [[-1.68, 1.8], [1.1, 0.64], [2.4, 0.36]]) box(root, wood, [w, fenceHeight, 0.07], [x, fenceY, 0.565]);
  // A descarga tem uma abertura visível acima da canaleta, sem atravessar a tábua.
  box(root, teal, [0.72, 0.09, 0.085], [TRAY.x, 0.735, 0.565]);
  box(root, teal, [1.48, 0.06, 0.085], [0, 0.73, 0.565]);
  for (let i = -2; i <= 2; i++) rod(root, brass, new THREE.Vector3(i * 0.27, 0.16, 0.565), new THREE.Vector3(i * 0.27, 0.7, 0.565), 0.017);

  // Trilhos: cada trecho compartilhado é criado uma vez, sem faces duplicadas.
  const segments = new Set();
  for (const path of Object.values(ROUTES)) for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const key = [[a.x, a.z].join(','), [b.x, b.z].join(',')].sort().join('|');
    if (segments.has(key)) continue;
    segments.add(key);
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    for (const side of [-1, 1]) {
      const ox = -dz / length * 0.18 * side, oz = dx / length * 0.18 * side;
      rod(root, iron, new THREE.Vector3(a.x + ox, 0.202, a.z + oz), new THREE.Vector3(b.x + ox, 0.202, b.z + oz), 0.016);
    }
    for (let d = 0.16; d < length - 0.1; d += 0.28) {
      const tie = box(root, wood, [0.48, 0.025, 0.07], [a.x + dx * d / length, 0.177, a.z + dz * d / length]);
      tie.rotation.y = Math.atan2(dx, dz);
    }
  }
  const junctionObject = new THREE.Group(); junctionObject.name = 'seta-do-trilho';
  junctionObject.position.set(JUNCTION.x, 0.4, JUNCTION.z); root.add(junctionObject);
  box(junctionObject, mustard, [0.1, 0.05, 0.42], [0, 0, 0.09]);
  const arrowHead = mesh(junctionObject, new THREE.ConeGeometry(0.16, 0.22, 3), mustard, 0, 0, 0.38);
  arrowHead.rotation.x = Math.PI / 2;
  /** @type {import('../../../types').Fase6Props['junction']} */
  const junction = { object: junctionObject, setRoute(route) { junctionObject.rotation.y = route === 'delivery' ? Math.PI / 2 : -Math.PI / 2; } };
  // O pedestal do pedal não eleva o chão: a área aceita coincide com o disco.
  const pedalObject = new THREE.Group(); pedalObject.name = 'pedal-de-pulo'; pedalObject.position.set(PEDAL.x, 0, PEDAL.z); root.add(pedalObject);
  mesh(pedalObject, new THREE.CylinderGeometry(PEDAL.r + 0.05, PEDAL.r + 0.06, 0.045, 32), iron, 0, 0.0225, 0);
  const pedalTop = mesh(pedalObject, new THREE.CylinderGeometry(PEDAL.r, PEDAL.r, 0.035, 32), mustard, 0, 0.075, 0);
  for (const x of [-0.65, 0.65]) for (const y of [0.053, 0.063, 0.073]) {
    const coil = mesh(pedalObject, new THREE.TorusGeometry(0.055, 0.007, 6, 16), brass, x, y, 0);
    coil.rotation.x = Math.PI / 2;
  }
  rod(root, brass, new THREE.Vector3(PEDAL.x + PEDAL.r, 0.028, PEDAL.z), new THREE.Vector3(-2.5, 0.028, PEDAL.z), 0.014);
  // Patinhas pintadas, sem texto obrigatório para descobrir o salto.
  const pawMat = stdMat('#725445', { roughness: 0.9 });
  for (const x of [-0.24, 0.24]) {
    const pad = mesh(pedalTop, new THREE.SphereGeometry(0.095, 12, 8), pawMat, x, 0.022, 0.05); pad.scale.set(1, 0.14, 1.25);
    for (const dx of [-0.09, 0, 0.09]) {
      const toe = mesh(pedalTop, new THREE.SphereGeometry(0.042, 10, 8), pawMat, x + dx, 0.022, -0.12); toe.scale.y = 0.3;
    }
  }
  /** @type {import('../../../types').Fase6Props['pedal']} */
  const pedal = { object: pedalObject, setPress(t) { pedalTop.position.y = 0.075 - Math.max(0, Math.min(1, t)) * 0.025; } };

  const trainObject = new THREE.Group(); trainObject.name = 'locomotiva'; root.add(trainObject);
  box(trainObject, teal, [0.52, 0.19, 0.73], [0, 0.365, 0.05]);
  const boiler = mesh(trainObject, new THREE.CylinderGeometry(0.19, 0.19, 0.5, 16), teal, 0, 0.56, 0.12); boiler.rotation.x = Math.PI / 2;
  box(trainObject, red, [0.49, 0.42, 0.29], [0, 0.59, -0.32]);
  box(trainObject, paleWood, [0.62, 0.065, 0.43], [0, 0.835, -0.32]);
  mesh(trainObject, new THREE.CylinderGeometry(0.07, 0.055, 0.22, 12), brass, 0, 0.79, 0.23);
  const wheels = [];
  for (const z of [-0.3, 0.3, -0.65, -1]) for (const x of [-0.29, 0.29]) {
    const wheel = mesh(trainObject, new THREE.CylinderGeometry(0.12, 0.12, 0.055, 12), dark, x, 0.31, z);
    wheel.rotation.z = Math.PI / 2; wheels.push(wheel);
  }
  box(trainObject, mustard, [0.53, 0.14, 0.58], [0, 0.345, -TRAIN.cargoOffset]);
  rod(trainObject, brass, new THREE.Vector3(0, 0.32, -0.44), new THREE.Vector3(0, 0.32, -0.6), 0.025);
  const face = mesh(trainObject, new THREE.SphereGeometry(0.2, 16, 12), cream, 0, 0.57, 0.39); face.scale.set(1, 0.9, 0.4);
  const noseObject = mesh(trainObject, new THREE.SphereGeometry(0.105, 16, 12), red, 0, 0.56, NOSE.z - TRAIN.start.z); noseObject.name = 'nariz-de-mola';
  rod(trainObject, brass, new THREE.Vector3(0, 0.56, 0.44), new THREE.Vector3(0, 0.56, 0.63), 0.025);
  const eyes = [];
  for (const x of [-0.095, 0.095]) {
    const eye = mesh(trainObject, new THREE.SphereGeometry(0.035, 12, 8), dark, x, 0.64, 0.464); eye.scale.z = 0.3; eyes.push(eye);
  }
  /** @type {import('../../../types').Fase6Props['nose']} */
  const nose = { object: noseObject, setSneeze(t) {
    const k = Math.max(0, Math.min(1, t));
    noseObject.scale.set(1 + k * 0.3, 1 + k * 0.15, 1 - k * 0.55);
    for (const eye of eyes) eye.scale.y = 1 - k * 0.85;
  } };
  /** @type {import('../../../types').Fase6Props['train']} */
  const train = { object: trainObject, setPose(pose) {
    const d = Math.hypot(trainObject.position.x - pose.x, trainObject.position.z - pose.z);
    for (const wheel of wheels) wheel.rotation.x += d / 0.12;
    trainObject.position.set(pose.x, 0, pose.z); trainObject.rotation.y = pose.yaw;
  } };

  // Canaleta à frente da estação: bolinha sai até o passeio, sem precisar entrar nos trilhos.
  const ramp = box(root, paleWood, [0.47, 0.055, 0.9], [TRAY.x, 0.235, 0.87]); ramp.rotation.x = -0.34;
  mesh(root, new THREE.CylinderGeometry(0.35, 0.38, 0.07, 24), mustard, TRAY.x, 0.045, TRAY.z);
  const starMat = stdMat('#f2ddb1', { roughness: 0.7 });
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.11 : 0.24;
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starShape.closePath();
  const star = mesh(root, new THREE.ShapeGeometry(starShape), starMat, TRAY.x, 0.084, TRAY.z); star.rotation.x = -Math.PI / 2;
  // Ponto de mira amplo, pintado no chão antes da janela.
  const aimMark = mesh(root, new THREE.RingGeometry(0.26, 0.3, 32), new THREE.MeshStandardMaterial({ color: '#6b9992', roughness: 0.9, side: THREE.DoubleSide }), 0, 0.006, 1.65); aimMark.rotation.x = -Math.PI / 2;

  const ballObject = new THREE.Group(); ballObject.name = 'ball'; ballObject.userData.carryKind = 'ball'; root.add(ballObject);
  const ballMat = stdMat('#7ca8b2', { roughness: 0.55, emissive: '#d9aa62', emissiveIntensity: 0 });
  mesh(ballObject, new THREE.SphereGeometry(0.09, 24, 16), ballMat);
  const equator = mesh(ballObject, new THREE.TorusGeometry(0.09, 0.005, 6, 36), mustard); equator.rotation.x = Math.PI / 2.7;
  for (const [x, y, z, radius] of [[0.03, 0.064, 0.055, 0.019], [-0.058, 0.02, 0.062, 0.014], [0.06, -0.036, 0.05, 0.012]]) {
    mesh(ballObject, new THREE.SphereGeometry(radius, 10, 8), cream, x, y, z);
  }
  const ballHome = new THREE.Vector3(BALL.x, BALL.y, BALL.z);
  /** @type {import('../../../types').ItemProp} */
  const ball = { object: ballObject, home: ballHome, setHighlight(on) { ballMat.emissiveIntensity = on ? 0.2 : 0; } };
  // Tapete de tecido com um foguete aplicado; mesma escala/material das caminhas.
  const goalObject = new THREE.Group(); goalObject.name = 'tapete-foguete'; goalObject.position.set(GOAL.x, 0, GOAL.z); root.add(goalObject);
  const rugMat = stdMat('#698c91', { roughness: 1, emissive: '#d4a857', emissiveIntensity: 0 });
  box(goalObject, rugMat, [1.85, 0.025, 1.45], [0, 0.013, 0]);
  const rocket = mesh(goalObject, new THREE.CapsuleGeometry(0.19, 0.45, 4, 12), cream, 0, 0.04, 0); rocket.rotation.x = Math.PI / 2; rocket.scale.z = 0.08;
  const porthole = mesh(goalObject, new THREE.CircleGeometry(0.09, 20), teal, 0, 0.065, -0.04); porthole.rotation.x = -Math.PI / 2;
  for (const x of [-0.24, 0.24]) {
    const fin = mesh(goalObject, new THREE.ConeGeometry(0.13, 0.3, 3), red, x, 0.04, 0.23); fin.rotation.x = -Math.PI / 2; fin.scale.z = 0.1;
  }
  /** @type {import('../../../types').Fase6Props['goal']} */
  const goal = { object: goalObject, setHighlight(on) { rugMat.emissiveIntensity = on ? 0.2 : 0; } };
  const sh = contactShadow(0.58, 0.8, 0.22, 0.165); sh.position.set(0, 0.165, -0.3); root.add(sh);
  const treats = buildTreats(root, COLLECTIBLES, { glow: 0.1 });
  /** @type {import('../../../types').Fase6Props} */
  const props = {
    pedal, junction, train, nose, ball, goal, collectibles: treats.list, fireflies: false,
    update(dt, t) { treats.update(dt, t); },
    reset() {
      pedal.setPress(0); junction.setRoute('loop'); nose.setSneeze(0);
      train.setPose(TRAIN.start); for (const wheel of wheels) wheel.rotation.x = 0;
      ballObject.position.copy(ballHome); ballObject.rotation.set(0, 0, 0); ball.setHighlight(false); goal.setHighlight(false);
      for (const treat of treats.list) treat.reset();
    },
  };
  props.reset();
  return { props, seeThrough: [walls], update(dt, t) { props.update(dt, t); } };
}
