// FASE 10 · O chiqueiro ao sul do galpão: cerca de tábuas largas (os porcos não pulam), a porteira para a horta (abre
// girando para fora), a casinha dos porcos com telhado de zinco, o cocho de madeira com lavagem, a poça de lama e a
// placa "Chiqueiro"; e, na parede do galpão, a caixinha de força onde os fios dos dois botões altos se juntam, com um
// cabo para a roldana da porta e outro, pelo chão, até a trava da porteira (qual botão vai para onde é sorteado).
// API: buildSty(root, layout) → { group, gate: GateProp (setOpen 0..1), links: { door, gate } (pulso), update(dt) }
import * as THREE from 'three';
import { rng, rbox, canvasTexture, stdMat, woodMat, contactShadow, mergeGeometries } from '../../../world/util.js';
import { makeLink } from '../../../world/links.js';

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildSty(root, layout) {
  const { STY, SHED, SHED_BUTTONS } = layout;
  const group = new THREE.Group();
  group.name = 'chiqueiro';
  const r = rng(81);
  const plankMat = woodMat('#a07a52', { key: 'f10-chiqueiro', rough: 0.9 });
  const postMat = woodMat('#7a5a3a', { key: 'f10-chiqueiro-mourao', vertical: true, rough: 0.95 });
  const H = STY.fenceH;

  // ---------------- cerca de tábuas horizontais (três por vão) e mourões
  const planks = [];
  const posts = [];
  const fenceRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    for (const y of [0.14, 0.34, 0.54]) {
      const g = new THREE.BoxGeometry(0.03, 0.11, len);
      g.rotateY(ang);
      g.translate((x0 + x1) / 2, y + (r() - 0.5) * 0.01, (z0 + z1) / 2);
      planks.push(g);
    }
    const n = Math.max(1, Math.round(len / 0.9));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const g = rbox(0.08, H + 0.08, 0.08, 0.01);
      g.translate(x0 + (x1 - x0) * t, (H + 0.08) / 2, z0 + (z1 - z0) * t);
      posts.push(g);
    }
  };
  fenceRun(STY.x0, STY.z0 + 0.06, STY.x1 - 0.05, STY.z0 + 0.06);
  fenceRun(STY.x0, STY.z1, STY.x1 - 0.05, STY.z1);
  fenceRun(STY.x1 - 0.05, STY.z0 + 0.06, STY.x1 - 0.05, STY.z1);
  fenceRun(STY.x0, STY.z0 + 0.06, STY.x0, STY.gate.z0);
  fenceRun(STY.x0, STY.gate.z1, STY.x0, STY.z1);
  const postMesh = new THREE.Mesh(mergeGeometries(posts), postMat);
  postMesh.castShadow = true;
  group.add(postMesh);
  const plankMesh = new THREE.Mesh(mergeGeometries(planks), plankMat);
  plankMesh.castShadow = true;
  plankMesh.receiveShadow = true;
  group.add(plankMesh);

  // ---------------- chão de terra com a poça de lama
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(STY.x1 - STY.x0 - 0.1, STY.z1 - STY.z0 - 0.1).rotateX(-Math.PI / 2), stdMat('#7a5a38', { roughness: 1 }));
  dirt.position.set((STY.x0 + STY.x1) / 2, 0.008, (STY.z0 + STY.z1) / 2);
  dirt.receiveShadow = true;
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#4a3220', roughness: 0.25, clearcoat: 0.6 }));
  puddle.scale.set(1.3, 1, 0.8);
  puddle.position.set(STY.x0 + 0.95, 0.012, STY.z0 + 0.9);
  group.add(dirt, puddle);

  // ---------------- casinha dos porcos (tábuas, telhado de zinco ondulado)
  const house = new THREE.Group();
  const hx = 0.76, hz = 0.76, hh = 0.62;
  const walls = new THREE.Mesh(rbox(hx, hh, hz, 0.02), woodMat('#b08a5a', { key: 'f10-casinha-porcos', vertical: true }));
  walls.position.y = hh / 2;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.36), stdMat('#3a2418', { roughness: 1 }));
  door.position.set(-hx / 2 - 0.002, 0.18, 0);
  door.rotation.y = -Math.PI / 2;
  const roof = new THREE.Mesh(rbox(hx + 0.2, 0.03, hz + 0.2, 0.005), stdMat('#9aa4ac', { metalness: 0.6, roughness: 0.45 }));
  roof.position.y = hh + 0.08;
  roof.rotation.x = 0.18;
  house.add(walls, door, roof);
  house.position.set(STY.x1 - 0.45, 0, STY.z1 - 0.45);
  house.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(house);
  // cocho com lavagem
  const trough = new THREE.Group();
  const tBody = new THREE.Mesh(rbox(0.7, 0.18, 0.26, 0.02), woodMat('#7a5234', { key: 'f10-cocho' }));
  tBody.position.y = 0.09;
  const slop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.01, 0.18), stdMat('#c8a060', { roughness: 0.6 }));
  slop.position.y = 0.17;
  trough.add(tBody, slop);
  trough.position.set(STY.x1 - 0.5, 0, STY.z0 + 0.35);
  group.add(trough);
  // placa
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshStandardMaterial({ map: canvasTexture(192, 60, (g, w, h) => {
    g.fillStyle = '#f6e3b0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5a3a2a'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#c94a5a'; g.font = 'bold 26px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Chiqueiro', w / 2, h / 2 + 1);
  }, { repeat: false }), roughness: 0.8 }));
  sign.position.set(STY.x0 - 0.035, H + 0.12, STY.gate.z1 + 0.3);
  sign.rotation.y = -Math.PI / 2;
  group.add(sign);
  const shSty = contactShadow(0.5, 0.5, 0.3);
  shSty.position.set(house.position.x, 0.01, house.position.z);
  group.add(shSty);

  // ---------------- a porteira (dobradiça no norte da abertura; abre girando para fora, para a horta)
  const gw = STY.gate.z1 - STY.gate.z0;
  const gate = new THREE.Group();
  gate.name = 'porteira';
  const leaf = new THREE.Group();
  for (const y of [0.14, 0.34, 0.54]) {
    const b = new THREE.Mesh(rbox(0.03, 0.1, gw - 0.04, 0.008), plankMat);
    b.position.set(0, y, gw / 2);
    leaf.add(b);
  }
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.08, Math.hypot(gw - 0.1, 0.4)), plankMat);
  brace.position.set(0.02, 0.34, gw / 2);
  brace.rotation.x = Math.atan2(0.4, gw - 0.1);
  const latch = new THREE.Mesh(rbox(0.04, 0.05, 0.1, 0.006), stdMat('#3a3634', { metalness: 0.7, roughness: 0.4 }));
  latch.position.set(-0.03, 0.45, gw - 0.06);
  leaf.add(brace, latch);
  leaf.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  gate.add(leaf);
  gate.position.set(STY.x0, 0, STY.gate.z0);
  group.add(gate);

  // ---------------- a caixinha de força na parede do galpão e os fios (botões → caixinha → porta | porteira)
  const xw = SHED.x0 - SHED.t / 2 - 0.02;
  const boxZ = (SHED_BUTTONS[0].z + SHED_BUTTONS[1].z) / 2 + 0.55;
  const jbox = new THREE.Mesh(rbox(0.05, 0.2, 0.16, 0.01), stdMat('#d8dcd6', { roughness: 0.5 }));
  jbox.position.set(xw - 0.005, 0.82, boxZ);
  group.add(jbox);
  const cableOpts = { radius: 0.007, color: '#3a3634', glow: '#ffd36a', metal: true };
  for (const b of SHED_BUTTONS) {
    const lk = makeLink([
      new THREE.Vector3(xw, b.top - 0.12, b.z),
      new THREE.Vector3(xw, 0.82, b.z),
      new THREE.Vector3(xw, 0.82, boxZ + (b.z < boxZ ? -0.1 : 0.1)),
    ], { ...cableOpts, clips: 2 });
    group.add(lk.object);
  }
  // da caixinha até a roldana da porta (por cima) e até a trava da porteira (pelo chão)
  const toDoor = makeLink([
    new THREE.Vector3(xw, 0.92, boxZ),
    new THREE.Vector3(xw, SHED.door.h + 0.06, boxZ),
    new THREE.Vector3(xw, SHED.door.h + 0.06, SHED.door.z1 - 0.12),
  ], { ...cableOpts, clips: 2 });
  const toGate = makeLink([
    new THREE.Vector3(xw, 0.72, boxZ),
    new THREE.Vector3(xw, 0.025, boxZ),
    new THREE.Vector3(xw, 0.025, STY.z0 - 0.08),
    new THREE.Vector3(STY.x0 - 0.06, 0.025, STY.z0 - 0.08),
    new THREE.Vector3(STY.x0 - 0.06, 0.025, STY.gate.z1 - 0.06),
    new THREE.Vector3(STY.x0 - 0.06, 0.45, STY.gate.z1 - 0.06),
  ], { ...cableOpts, clips: 4 });
  group.add(toDoor.object, toGate.object);

  const st = { open: 0 };
  root.add(group);
  return {
    group,
    gate: {
      object: gate,
      setOpen(t) {
        st.open = Math.max(0, Math.min(1, t));
        // gira para fora (para o oeste, a horta), no mesmo ângulo do colisor dos porquinhos (STY.swing)
        gate.rotation.y = -st.open * STY.swing;
      },
    },
    links: { door: toDoor, gate: toGate },
    update(dt) {
      toDoor.update(dt);
      toGate.update(dt);
    },
  };
}
