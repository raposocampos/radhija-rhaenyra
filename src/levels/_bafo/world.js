// ARENA DO BAFO — cenário provisório (blocos do _placeholder.js) + os props do puzzle, todos procedurais:
// ventilador com fitas que mostram o vento, trilho com o encaixe marcado, grade do corredor, duto, poleiros,
// o pombo, o portão e a cenoura de pelúcia. Formato dos props: ver o puzzle (./puzzle.js).
import * as THREE from 'three';
import { buildPlaceholderWorld } from '../_placeholder.js';
import { createPlushCarrot } from '../../dogs/plushCarrot.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shadowAll = (g) => g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

/**
 * @param {import('../../types').LevelBuildArgs} args
 * @returns {import('../../types').LevelBuild<import('../../types').BafoProps>}
 */
export function buildBafoWorld({ root, layout }) {
  const { FAN, CORRIDOR, DUCT, PERCH_A, PERCH_B, GATE, CARROT, COLLECTIBLES } = layout;
  const base = buildPlaceholderWorld({ root, layout, skip: new Set(['grade', 'poleiro-a', 'poleiro-b', 'duto-boca', 'duto-saida']) });
  const updaters = [];

  // ---------------------------------------------------------------- trilho do ventilador
  const rail = new THREE.Group();
  const railMat = std('#6d6a66', { metalness: 0.3, roughness: 0.5 });
  for (const dx of [-0.22, 0.22]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, FAN.maxZ - FAN.minZ + FAN.half * 2 + 0.2), railMat);
    r.position.set(FAN.start.x + dx, 0.015, (FAN.minZ + FAN.maxZ) / 2);
    rail.add(r);
  }
  // encaixe: marca amarela no trilho onde o ventilador mira a grade
  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.08), std('#f2c14e', { emissive: '#8a5a00', emissiveIntensity: 0.3 }));
  notch.position.set(FAN.start.x, 0.035, FAN.alignZ);
  rail.add(notch);
  root.add(rail);

  // ---------------------------------------------------------------- ventilador
  const fan = new THREE.Group();
  fan.name = 'ventilador';
  const body = std('#4d5a63', { metalness: 0.2, roughness: 0.55 });
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.56), body);
  foot.position.y = 0.06;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 10), body);
  neck.position.y = 0.22;
  const ringMat = std('#9aa6ad', { metalness: 0.4, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 28).rotateY(Math.PI / 2), ringMat);
  ring.position.y = 0.48;
  const blades = new THREE.Group();
  blades.position.set(0.02, 0.48, 0);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.2, 0.07), std('#e7e1d6'));
    b.position.y = 0.1;
    const arm = new THREE.Group();
    arm.rotation.x = (i * Math.PI) / 2;
    arm.add(b);
    blades.add(arm);
  }
  // fitas na frente: mostram a direção do vento
  const ribbons = [];
  for (let i = 0; i < 3; i++) {
    const rb = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.035).translate(0.17, 0, 0), std('#ff7a59', { side: THREE.DoubleSide }));
    rb.name = 'fita-do-vento'; // tecido leve: não tem colisor
    rb.position.set(0.26, 0.4 + i * 0.08, (i - 1) * 0.08);
    ribbons.push(rb);
    fan.add(rb);
  }
  fan.add(foot, neck, ring, blades);
  shadowAll(fan);
  root.add(fan);
  let fanAligned = false;
  updaters.push((dt, t) => {
    blades.rotation.x += dt * 18;
    ribbons.forEach((r, i) => { r.rotation.y = Math.sin(t * 13 + i * 1.7) * 0.25; r.rotation.x = Math.sin(t * 9 + i) * 0.4; });
  });

  // ---------------------------------------------------------------- grade do corredor
  const grate = new THREE.Group();
  const barMat = std('#3b3f44', { metalness: 0.5, roughness: 0.45 });
  for (let i = 0; i <= 6; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), barMat);
    bar.position.set(CORRIDOR.x0 - 0.02, 0.225, CORRIDOR.z - CORRIDOR.half + (i / 6) * CORRIDOR.half * 2);
    grate.add(bar);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, CORRIDOR.half * 2), barMat);
  top.position.set(CORRIDOR.x0 - 0.02, 0.45, CORRIDOR.z);
  grate.add(top);
  shadowAll(grate);
  root.add(grate);

  // ---------------------------------------------------------------- duto (boca → por cima da mureta → saída)
  const duct = new THREE.Group();
  const pipe = std('#8b9298', { metalness: 0.45, roughness: 0.35 });
  const dark = std('#1d1f22', { roughness: 1 });
  const inletBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.46), pipe);
  inletBox.position.set(DUCT.inlet.x + 0.08, 0.21, DUCT.inlet.z);
  const inletHole = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3).rotateY(-Math.PI / 2), dark);
  inletHole.position.set(DUCT.inlet.x - 0.035, 0.2, DUCT.inlet.z);
  const up1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 14), pipe);
  up1.position.set(DUCT.inlet.x + 0.08, 0.9, DUCT.inlet.z);
  const across = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, DUCT.outlet.x - DUCT.inlet.x + 0.1, 14).rotateZ(Math.PI / 2), pipe);
  across.position.set((DUCT.inlet.x + DUCT.outlet.x) / 2 + 0.04, 1.38, DUCT.inlet.z);
  const down = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 14), pipe);
  down.position.set(DUCT.outlet.x, 0.98, DUCT.outlet.z);
  const outletBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.36), pipe);
  outletBox.position.set(DUCT.outlet.x, 0.5, DUCT.outlet.z);
  const outletHole = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22).rotateY(Math.PI / 2), dark);
  outletHole.position.set(DUCT.outlet.x + 0.125, 0.5, DUCT.outlet.z);
  duct.add(inletBox, inletHole, up1, across, down, outletBox, outletHole);
  shadowAll(duct);
  root.add(duct);

  // ---------------------------------------------------------------- poleiros + placa + corda até o portão
  const perchMat = std('#7b5a3c');
  const perchTop = (p) => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, p.y, 10), perchMat);
    post.position.y = p.y / 2;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.26), perchMat);
    plat.position.y = p.y;
    g.add(post, plat);
    g.position.set(p.x, 0, p.z);
    shadowAll(g);
    root.add(g);
    return g;
  };
  perchTop(PERCH_A);
  const perchB = perchTop(PERCH_B);
  const plateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.18), std('#f2c14e', { emissive: '#7a4b00', emissiveIntensity: 0.2 }));
  plateMesh.position.y = PERCH_B.y + 0.035;
  perchB.add(plateMesh);
  const cordGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(PERCH_B.x, PERCH_B.y + 0.04, PERCH_B.z),
    new THREE.Vector3(GATE.hinge.x + 0.05, 1.05, GATE.latchPost.z - 0.4),
    new THREE.Vector3(GATE.hinge.x + 0.05, 0.95, GATE.hinge.z),
  ]);
  root.add(new THREE.Line(cordGeo, new THREE.LineBasicMaterial({ color: '#d9c8a5' })));

  // ---------------------------------------------------------------- pombo
  const pigeon = new THREE.Group();
  pigeon.name = 'pombo';
  const grey = std('#8f939e', { roughness: 0.7 });
  const pBody = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), grey);
  pBody.scale.set(0.1, 0.085, 0.14);
  pBody.position.y = 0.1;
  const neckRing = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), std('#4f8f7a', { roughness: 0.35, metalness: 0.3 }));
  neckRing.scale.set(0.055, 0.05, 0.05);
  neckRing.position.set(0, 0.16, 0.09);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), std('#767a85'));
  head.position.set(0, 0.21, 0.12);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 8).rotateX(Math.PI / 2), std('#e09a4a'));
  beak.position.set(0, 0.205, 0.175);
  const eyeMat = std('#1b0f0a', { roughness: 0.2 });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), eyeMat);
    e.position.set(sx * 0.03, 0.22, 0.15);
    pigeon.add(e);
  }
  const wings = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.07, 0.13, 0);
    const w = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), std('#7d8290'));
    w.scale.set(0.02, 0.06, 0.12);
    w.position.set(sx * 0.03, -0.01, -0.02);
    pivot.add(w);
    pigeon.add(pivot);
    return { pivot, sx };
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.1), std('#5f636e'));
  tail.position.set(0, 0.09, -0.15);
  tail.rotation.x = 0.25;
  pigeon.add(pBody, neckRing, head, beak, tail);
  shadowAll(pigeon);
  root.add(pigeon);
  const pigeonPose = { x: PERCH_A.x, y: PERCH_A.y + 0.02, z: PERCH_A.z, yaw: -Math.PI / 2, flying: false };
  updaters.push((dt, t) => {
    pigeon.position.set(pigeonPose.x, pigeonPose.y, pigeonPose.z);
    pigeon.rotation.y = pigeonPose.yaw;
    const flap = pigeonPose.flying ? Math.sin(t * 34) * 1.1 : Math.sin(t * 2.3) * 0.04;
    for (const w of wings) w.pivot.rotation.z = w.sx * (pigeonPose.flying ? 0.5 + flap : 0.1 + flap);
    head.position.z = 0.12 + (pigeonPose.flying ? 0 : Math.max(0, Math.sin(t * 5.5)) * 0.015); // cabecinha indo e vindo
  });

  // ---------------------------------------------------------------- portão (pivô na dobradiça, folha ao longo de -Z local)
  const gatePivot = new THREE.Group();
  gatePivot.name = 'portao';
  gatePivot.position.set(GATE.hinge.x, 0, GATE.hinge.z);
  const leafMat = std('#5c6f7a', { metalness: 0.35, roughness: 0.5 });
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.04), leafMat);
    bar.position.set(0, 0.45, -0.08 - (i / 6) * (GATE.length - 0.16));
    gatePivot.add(bar);
  }
  for (const y of [0.15, 0.8]) {
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, GATE.length - 0.04), leafMat);
    rail2.position.set(0, y, -GATE.length / 2);
    gatePivot.add(rail2);
  }
  shadowAll(gatePivot);
  root.add(gatePivot);

  // ---------------------------------------------------------------- cenoura e ossinho
  const carrot = createPlushCarrot(0.3);
  carrot.name = 'cenoura';
  carrot.position.set(CARROT.x, 0.05, CARROT.z);
  carrot.rotation.y = 0.6;
  root.add(carrot);
  const carrotHome = carrot.position.clone();
  const collectibles = COLLECTIBLES.map((c) => {
    const bone = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.025, 8, 16), std('#e8c06a', { emissive: '#7a5200', emissiveIntensity: 0.4 }));
    bone.name = `osso-${c.id}`;
    bone.rotation.x = Math.PI / 2;
    bone.position.set(c.x, 0.12, c.z);
    root.add(bone);
    updaters.push((dt, t) => { bone.rotation.z = t * 1.5; bone.position.y = 0.12 + Math.sin(t * 2) * 0.02; });
    return { id: c.id, object: bone, collect() { bone.visible = false; }, reset() { bone.visible = true; } };
  });

  /** @satisfies {import('../../types').BafoProps} */
  const props = {
    fan: {
      object: fan,
      setPos(x, z) { fan.position.set(x, 0, z); },
      setAligned(on) {
        if (on === fanAligned) return;
        fanAligned = on;
        ringMat.color.set(on ? '#7fd26b' : '#9aa6ad');
      },
    },
    gate: { object: gatePivot, setOpen(t) { gatePivot.rotation.y = GATE.openYaw * t; } },
    plate: { object: plateMesh, setPress(t) { plateMesh.position.y = PERCH_B.y + 0.035 - 0.02 * t; } },
    pigeon: { object: pigeon, setPose(p) { Object.assign(pigeonPose, p); } },
    carrot: { object: carrot, home: carrotHome, setHighlight() {} },
    collectibles,
    update(dt, t) { for (const f of updaters) f(dt, t); },
    reset() {
      props.gate.setOpen(0);
      props.plate.setPress(0);
      props.fan.setAligned(false);
      props.pigeon.setPose({ x: PERCH_A.x, y: PERCH_A.y + 0.02, z: PERCH_A.z, yaw: -Math.PI / 2, flying: false });
      for (const c of collectibles) c.reset();
    },
  };
  props.fan.setPos(FAN.start.x, FAN.start.z);
  return {
    props,
    seeThrough: [gatePivot, duct, grate],
    update(dt, t) { base.update?.(dt, t); props.update(dt, t); },
  };
}
