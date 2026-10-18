// FASE 9 · O jardim de inverno: vasos grandes de barro com samambaia e costela-de-adão (entre eles só a Radhija
// passa), mesinha de plantas com suculentas e o regador, poltrona de vime com manta, lanterna pendurada acesa e o
// ventilador de chão (empurrável): hélice girando, grade, luzinha verde quando encaixa na grade do duto e fitinhas
// que voam no vento dele.
import * as THREE from 'three';
import { rng, rbox, stdMat, woodMat, contactShadow, shadowAll } from '../../../world/util.js';

const TAU = Math.PI * 2;
const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Vaso de barro com borda e uma planta: 'fern' (samambaia, folhas em arco) ou 'monstera' (folhas largas). */
function potPlant(x, z, r, kind, seed) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const clay = new THREE.MeshStandardMaterial({ color: '#b5643e', roughness: 0.85 });
  const h = r * 1.3;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.78, h, 22), clay);
  pot.position.y = h / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 8, 22).rotateX(Math.PI / 2), clay);
  rim.position.y = h;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, 20).rotateX(-Math.PI / 2), stdMat('#3a2a1c', { roughness: 1 }));
  soil.position.y = h - 0.03;
  g.add(pot, rim, soil);
  const leafMat = new THREE.MeshStandardMaterial({ color: kind === 'fern' ? '#4f8a3a' : '#3f7a3a', roughness: 0.65, side: THREE.DoubleSide });
  const rr = rng(seed);
  if (kind === 'fern') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + rr() * 0.3;
      const len = 0.45 + rr() * 0.25;
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        pts.push(new THREE.Vector3(Math.cos(a) * len * u, h + Math.sin(Math.PI * u * 0.8) * 0.35 - u * u * 0.25, Math.sin(a) * len * u));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const frond = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.012, 4, false), leafMat);
      g.add(frond);
      for (let k = 2; k < 8; k++) {
        const p = curve.getPoint(k / 8);
        const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.1 * (1 - k / 10), 0.03), leafMat);
        lf.position.copy(p);
        lf.rotation.set(0.3, -a, 0.4);
        g.add(lf);
      }
    }
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + rr() * 0.4;
      const len = 0.4 + rr() * 0.35;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, len, 5), stdMat('#4f7a3a', { roughness: 0.7 }));
      stem.position.set(Math.cos(a) * len * 0.3, h + len / 2, Math.sin(a) * len * 0.3);
      stem.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.13 + rr() * 0.05, 14), leafMat);
      leaf.position.set(Math.cos(a) * len * 0.62, h + len * 0.95, Math.sin(a) * len * 0.62);
      leaf.rotation.set(-1.1 + rr() * 0.4, -a + Math.PI / 2, 0);
      g.add(stem, leaf);
    }
  }
  return g;
}

/** Ventilador de chão (circulador): base, haste, cesto de grade e hélice; a luzinha do encaixe na base. */
function buildFan(F) {
  const holder = new THREE.Group();
  holder.name = 'ventilador';
  const body = stdMat('#f1ece0', { roughness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c9c4bb', roughness: 0.3, metalness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.06, 24), body);
  base.position.y = 0.03;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, F.height - 0.3, 10), metal);
  stem.position.y = 0.06 + (F.height - 0.3) / 2;
  holder.add(base, stem);
  // cabeça virada para o norte (−Z): motor, cesto e hélice
  const head = new THREE.Group();
  head.position.y = F.height - 0.2;
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 16).rotateX(Math.PI / 2), body);
  motor.position.z = 0.07;
  head.add(motor);
  const cage = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const wire = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.003, 4, 24, Math.PI), metal);
    wire.rotation.set(0, Math.PI / 2, (i / 12) * TAU);
    cage.add(wire);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.008, 6, 32), metal);
  cage.add(rim);
  cage.scale.z = 0.45;
  head.add(cage);
  const blades = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#7fb0c8', roughness: 0.35, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.075, 12), bladeMat);
    b.scale.set(0.6, 1.25, 1);
    b.position.set(Math.sin((i / 4) * TAU) * 0.08, Math.cos((i / 4) * TAU) * 0.08, 0);
    b.rotation.z = -(i / 4) * TAU;
    blades.add(b);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), body);
  blades.add(hub);
  blades.position.z = -0.01;
  head.add(blades);
  holder.add(head);
  // luzinha do encaixe
  const ledMat = new THREE.MeshStandardMaterial({ color: '#3a4a3a', emissive: '#5fe08a', emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), ledMat);
  led.position.set(0, 0.07, -0.2);
  holder.add(led);
  // fitinhas no vento (só um enfeite que mostra para onde sopra)
  const ribbons = [];
  for (let i = 0; i < 3; i++) {
    const rb = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.22, 1, 6), new THREE.MeshStandardMaterial({ color: ['#e8554a', '#f2c14e', '#7fb0c8'][i], roughness: 0.8, side: THREE.DoubleSide }));
    rb.geometry.translate(0, -0.11, 0);
    rb.position.set(-0.1 + i * 0.1, 0.17, -0.09);
    head.add(rb);
    ribbons.push(rb);
  }
  shadowAll(holder);
  const sh = contactShadow(0.3, 0.3, 0.38);
  sh.position.y = 0.004;
  holder.add(sh);
  holder.position.set(F.start.x, 0, F.start.z);
  const st = { aligned: false, glow: 0 };
  return {
    object: holder,
    setPos(x, z) { holder.position.set(x, 0, z); },
    setAligned(on) { st.aligned = !!on; },
    update(dt, t) {
      blades.rotation.z -= dt * 18;
      st.glow = ease(st.glow, st.aligned ? 1 : 0, dt, 6);
      ledMat.emissiveIntensity = st.glow * (1.2 + 0.3 * Math.sin(t * 6));
      ribbons.forEach((rb, i) => { rb.rotation.x = -1.25 + Math.sin(t * 14 + i * 1.7) * 0.18; });
    },
  };
}

export function buildConservatory({ root, layout }) {
  const { POTS, WICKER_CHAIR: WC, PLANT_TABLE: PT, FAN, WORLD } = layout;
  const B = WORLD.bounds;
  const grp = new THREE.Group();
  grp.name = 'jardim-de-inverno';
  POTS.forEach((p, i) => grp.add(potPlant(p.x, p.z, p.r * 0.85, i === 0 ? 'fern' : 'monstera', 31 + i)));
  // vasinhos pequenos no peitoril das vidraças (só enfeite, perto do vidro)
  for (const [x, k] of /** @type {[number, string][]} */ ([[4.85, 'fern'], [7.4, 'monstera']])) {
    const small = potPlant(x, B.minZ + 0.18, 0.09, k, 70 + x);
    small.scale.setScalar(0.55);
    small.position.y = 0.0;
    grp.add(small);
  }
  // mesinha de plantas com suculentas e o regador
  const table = new THREE.Group();
  table.position.set(PT.x, 0, PT.z);
  const tw = woodMat('#8a6a48', { key: 'f9-mesa-plantas', rough: 0.7 });
  const top = new THREE.Mesh(rbox(PT.hx * 2, 0.04, PT.hz * 2, 0.01), tw);
  top.position.y = PT.h - 0.02;
  table.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(rbox(0.04, PT.h - 0.04, 0.04, 0.008), tw);
    l.position.set(sx * (PT.hx - 0.04), (PT.h - 0.04) / 2, sz * (PT.hz - 0.04));
    table.add(l);
  }
  const succ = stdMat('#6f9a68', { roughness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 14), stdMat('#d8cba8', { roughness: 0.6 }));
    pot.position.set(-0.22 + i * 0.16, PT.h + 0.04, -0.05);
    const plant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055, 0), succ);
    plant.position.set(-0.22 + i * 0.16, PT.h + 0.11, -0.05);
    plant.scale.set(1, 0.7, 1);
    table.add(pot, plant);
  }
  const can = new THREE.Group();
  can.position.set(0.24, PT.h, 0.06);
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 16), stdMat('#3f8fb0', { roughness: 0.3, metalness: 0.4 }));
  canBody.position.y = 0.08;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.22, 8), stdMat('#3f8fb0', { roughness: 0.3, metalness: 0.4 }));
  spout.position.set(-0.1, 0.13, 0);
  spout.rotation.z = 1.0;
  can.add(canBody, spout);
  table.add(can);
  grp.add(table);
  // poltrona de vime com a manta
  const chair = new THREE.Group();
  chair.position.set(WC.x, 0, WC.z);
  chair.rotation.y = -0.6;
  const wicker = new THREE.MeshStandardMaterial({ color: '#c9a46a', roughness: 0.9 });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(WC.r, WC.r * 0.85, 0.32, 20), wicker);
  seat.position.y = 0.16;
  const back = new THREE.Mesh(new THREE.SphereGeometry(WC.r, 20, 12, 0, Math.PI, 0, Math.PI / 2), wicker);
  back.position.set(0, 0.32, 0);
  back.rotation.y = Math.PI;
  back.scale.set(1, 1.6, 0.9);
  const throwBlanket = new THREE.Mesh(rbox(WC.r * 1.3, 0.04, WC.r * 0.9, 0.02), new THREE.MeshStandardMaterial({ color: '#8a2f3a', roughness: 0.95 }));
  throwBlanket.position.set(0.05, 0.34, 0.06);
  throwBlanket.rotation.y = 0.4;
  chair.add(seat, back, throwBlanket);
  grp.add(chair);
  // lanterna pendurada, acesa
  const lantern = new THREE.Group();
  lantern.position.set(6.2, 2.25, 0.4);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.8, 4), stdMat('#2a2420'));
  cord.position.y = 0.45;
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 0.5, wireframe: true }));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd38a' }));
  lantern.add(cord, cage, glow);
  grp.add(lantern);
  shadowAll(grp);
  for (const p of POTS) {
    const sh = contactShadow(p.r + 0.06, p.r + 0.06, 0.4);
    sh.position.set(p.x, 0.004, p.z);
    root.add(sh);
  }
  root.add(grp);
  const fan = buildFan(FAN);
  root.add(fan.object);
  return {
    group: grp, fan,
    lanternPos: new THREE.Vector3(6.2, 2.2, 0.4),
    update(dt, t) {
      fan.update(dt, t);
      lantern.rotation.z = Math.sin(t * 0.8) * 0.03;
    },
  };
}
