// Galinha (NPC de ambientação da fase 10). Corpo em gota (peito cheio, garupa subindo para o rabo), coxas fofas, rabo
// de penas em leque, asas de três penas sobrepostas, pescoço com a gola de penas, cabeça com crista serrilhada,
// barbelas, bico de duas partes e olhos com brilho; patas amarelas com três dedos e o esporão. Cores por vértice
// (dorso mais escuro, barriga mais clara) num material só, liso.
// Animação: a cabeça "fica parada no ar" e dá o tranco para a frente a cada passo (como galinha de verdade), o corpo
// balança de lado no passo, o rabo abana; ciscar = uma pata raspa para trás antes das bicadas; bater asas e planar
// com as asas abertas e as patas encolhidas; parada, olha em volta aos trancos, pisca e às vezes arrepia as penas.
// API: createChicken({ variant }) → { object, setPose(x, y, z, yaw), animate(dt, { speed, peck, flap, alarm, scratch, air }) }
//   variant 0 = branca, 1 = vermelha (carijó).
import * as THREE from 'three';
import { mergeGeometries } from '../world/util.js';

const TAU = Math.PI * 2;
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

const PALETTES = [
  { back: '#ece4d4', belly: '#fbf7ee', wing: '#e2d8c4', tail: '#e8dfcc', tip: '#cfc3ab' },
  { back: '#9a4a26', belly: '#c8763c', wing: '#7e3a1e', tail: '#2a2a24', tip: '#3b4a30' },
];
/** @type {Record<string, THREE.Material>} */
const MATS = {};
const vcMat = () => (MATS.vc ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
const mat = (hex, rough = 0.6) => (MATS[`${hex}|${rough}`] ||= new THREE.MeshStandardMaterial({ color: hex, roughness: rough }));

/** Pinta a geometria com um degradê vertical (de baixo para cima) entre duas cores. */
function paintY(g, low, high, y0, y1) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const a = new THREE.Color(low), b = new THREE.Color(high), c = new THREE.Color();
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    c.copy(a).lerp(b, clamp01((pos.getY(i) - y0) / (y1 - y0)));
    arr.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
const ell = (rx, ry, rz, x, y, z, w = 20, h = 14) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz).translate(x, y, z);

/** @param {{ variant?: number }} [opts] */
export function createChicken({ variant = 0 } = {}) {
  const P = PALETTES[variant % PALETTES.length];
  const object = new THREE.Group();
  object.name = 'galinha';
  const body = new THREE.Group(); // balança e inclina
  object.add(body);

  // ---- corpo em gota (uma malha só): peito, barriga, garupa e as coxas fofas
  const bodyGeo = mergeGeometries([
    paintY(ell(0.115, 0.105, 0.15, 0, 0.21, -0.01), P.belly, P.back, 0.12, 0.3),
    paintY(ell(0.1, 0.105, 0.09, 0, 0.2, 0.075), P.belly, P.back, 0.12, 0.3),
    paintY(ell(0.085, 0.09, 0.1, 0, 0.26, -0.1).rotateX(-0.35), P.back, P.back, 0, 1),
    ...[-1, 1].map((s) => paintY(ell(0.05, 0.06, 0.06, s * 0.055, 0.15, -0.01, 12, 10), P.belly, P.back, 0.1, 0.22)),
  ]);
  const trunk = new THREE.Mesh(bodyGeo, vcMat());
  body.add(trunk);
  // ---- rabo: cinco penas em leque, para cima e para trás (abana)
  const tail = new THREE.Group();
  tail.position.set(0, 0.28, -0.15);
  body.add(tail);
  const tailGeo = mergeGeometries([-0.5, -0.25, 0, 0.25, 0.5].map((a, k) => {
    const g = ell(0.012, 0.1 - Math.abs(a) * 0.04, 0.04, 0, 0.07, 0, 10, 8);
    g.rotateX(-0.45 - Math.abs(a) * 0.2);
    g.rotateZ(a * 0.9);
    g.translate(a * 0.03, 0, -0.01 * k);
    return paintY(g, P.tail, P.tip, 0, 0.17);
  }));
  tail.add(new THREE.Mesh(tailGeo, vcMat()));
  // ---- asas: três penas sobrepostas, pivô no ombro (abrem para os lados e para cima)
  const wings = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.1, 0.26, 0.03);
    const feathers = new THREE.Group();
    pivot.add(feathers);
    const g = mergeGeometries([0, 1, 2].map((k) => {
      const f = ell(0.02, 0.06 - k * 0.008, 0.11 - k * 0.012, 0, -0.04 - k * 0.012, -0.03 - k * 0.035, 12, 8);
      f.rotateX(0.18 + k * 0.08);
      return paintY(f, P.wing, P.back, -0.12, 0.02);
    }));
    const m = new THREE.Mesh(g, vcMat());
    m.position.x = sx * 0.012;
    feathers.add(m);
    body.add(pivot);
    return { pivot, feathers, sx };
  });
  // ---- pescoço com a gola de penas e a cabeça (o pescoço leva a cabeça para a frente e para baixo)
  const neck = new THREE.Group();
  neck.position.set(0, 0.27, 0.085);
  body.add(neck);
  const neckGeo = mergeGeometries([
    paintY(new THREE.CylinderGeometry(0.038, 0.06, 0.1, 14, 1, true).translate(0, 0.04, 0.01).rotateX(0.25), P.back, P.back, 0, 1),
    paintY(ell(0.062, 0.05, 0.06, 0, 0.0, 0.0, 14, 10), P.back, P.back, 0, 1),
  ]);
  neck.add(new THREE.Mesh(neckGeo, vcMat()));
  const head = new THREE.Group();
  head.position.set(0, 0.095, 0.03);
  neck.add(head);
  const skull = new THREE.Mesh(paintY(ell(0.045, 0.048, 0.052, 0, 0, 0.005, 18, 14), P.back, P.belly, -0.05, 0.05), vcMat());
  const red = mat('#d8302a', 0.55);
  // crista serrilhada: cinco gomos num arco por cima da cabeça
  const combGeo = mergeGeometries([-2, -1, 0, 1, 2].map((k) => {
    const r = 0.016 - Math.abs(k) * 0.002;
    return ell(0.007, r * 1.2, r, 0, 0.045 + (2 - Math.abs(k)) * 0.006, 0.01 + k * 0.016, 8, 6);
  }));
  const comb = new THREE.Mesh(combGeo, red);
  // barbelas: duas gotinhas embaixo do bico
  const wattles = new THREE.Mesh(mergeGeometries([-1, 1].map((s) => ell(0.009, 0.018, 0.01, s * 0.008, -0.03, 0.05, 8, 6))), red);
  // bico de duas partes (o de cima curvado)
  const beakMat = mat('#f2b33d', 0.45);
  const upper = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 8).rotateX(Math.PI / 2 + 0.25).translate(0, 0.002, 0.065), beakMat);
  const lower = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.026, 8).rotateX(Math.PI / 2 - 0.15).translate(0, -0.01, 0.058), beakMat);
  // olhos com o brilhinho e a pálpebra (piscar)
  const eyeM = mat('#1a1410', 0.25), shineM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyes = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.036, 0.012, 0.03);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), eyeM);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 6, 4), shineM);
    sh.position.set(sx * 0.004, 0.004, 0.006);
    g.add(e, sh);
    return g;
  });
  head.add(skull, comb, wattles, upper, lower, ...eyes);
  // ---- patas: canela amarela, três dedos para a frente e um para trás (pivô no quadril)
  const legM = mat('#e8a23a', 0.55);
  const legs = [-1, 1].map((sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.05, 0.13, 0);
    /** @type {THREE.BufferGeometry[]} */
    const parts = [new THREE.CylinderGeometry(0.008, 0.01, 0.12, 8).translate(0, -0.06, 0)];
    for (const a of [-0.45, 0, 0.45]) parts.push(new THREE.CapsuleGeometry(0.0045, 0.04, 2, 6).rotateX(Math.PI / 2).rotateY(a).translate(Math.sin(a) * 0.022, -0.122, Math.cos(a) * 0.022));
    parts.push(new THREE.CapsuleGeometry(0.004, 0.018, 2, 6).rotateX(Math.PI / 2).translate(0, -0.12, -0.014));
    hip.add(new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), legM));
    object.add(hip);
    return hip;
  });
  object.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });

  const st = { wag: 0, phase: 0, peck: 0, flap: 0, flapPh: 0, alarm: 0, air: 0, look: 0, lookT: 0.5, headYaw: 0, blinkT: 2, blink: 0, ruffle: 0, ruffleT: 4, scratch: 0, scratchPh: 0, thrust: 0 };
  return {
    object,
    setPose(x, y, z, yaw) {
      object.position.set(x, y, z);
      object.rotation.y = yaw;
    },
    /** @param {number} dt @param {{ speed?: number, peck?: number, flap?: number, alarm?: boolean, scratch?: boolean, air?: number }} s */
    animate(dt, s = {}) {
      const v = s.speed ?? 0;
      st.peck = damp(st.peck, s.peck ?? 0, 22, dt);
      st.flap = damp(st.flap, s.flap ?? 0, 10, dt);
      st.alarm = damp(st.alarm, s.alarm ? 1 : 0, 8, dt);
      st.air = damp(st.air, s.air ?? 0, 10, dt);
      st.scratch = damp(st.scratch, s.scratch ? 1 : 0, 10, dt);
      const moving = v > 0.02;
      // passos: frequência sobe com a velocidade (a corridinha é bem rápida)
      const stepHz = moving ? 2.2 + v * 3.2 : 0;
      st.phase = (st.phase + dt * stepHz) % 1;
      const stride = Math.min(1, v / 0.5);
      const sw = Math.sin(st.phase * TAU);
      // ciscar: uma pata (alternando) raspa o chão para trás, rapidinho
      st.scratchPh = (st.scratchPh + dt * 2.4 * st.scratch) % 2;
      const sLeg = st.scratchPh < 1 ? 0 : 1, sk = st.scratchPh % 1;
      const scrape = st.scratch * (sk < 0.5 ? Math.sin((sk / 0.5) * Math.PI) : 0);
      legs.forEach((leg, i) => {
        const walkRot = (i === 0 ? sw : -sw) * 0.55 * stride;
        const tuck = st.air * 0.9;
        leg.rotation.x = walkRot + (i === sLeg ? scrape * 0.9 : 0) - tuck;
        leg.position.y = 0.13 + st.air * 0.03;
      });
      // corpo: balança de lado a cada passo e sobe um pouquinho; inclina correndo, bicando e no ar
      body.rotation.z = sw * 0.08 * stride;
      body.position.y = Math.abs(sw) * 0.01 * stride - st.peck * 0.01;
      body.rotation.x = 0.1 * Math.min(1, v / 1.5) + st.peck * 0.32 - st.alarm * 0.1 + st.air * 0.15 + scrape * 0.08;
      // arrepio de penas de vez em quando (parada)
      st.ruffleT -= dt;
      if (st.ruffleT <= 0 && !moving) { st.ruffleT = 5 + Math.random() * 7; st.ruffle = 1; }
      st.ruffle = Math.max(0, st.ruffle - dt * 2.2);
      const rf = st.ruffle * Math.sin(st.ruffle * 40) * 0.04;
      trunk.scale.set(1 + Math.abs(rf), 1 + Math.abs(rf) * 0.5, 1);
      // rabo: abana de lado (mais bicando e ciscando)
      tail.rotation.z = Math.sin(st.phase * TAU * 2) * 0.12 * stride + Math.sin((st.wag += dt) * 9) * 0.1 * (st.peck + st.scratch) + rf * 3;
      tail.rotation.x = -st.air * 0.3;
      // cabeça: fica parada no ar e dá o tranco para a frente no fim de cada passo
      const hold = st.phase < 0.75 ? st.phase / 0.75 : 1 - (st.phase - 0.75) / 0.25;
      st.thrust = damp(st.thrust, moving ? hold : 0, 30, dt);
      neck.position.z = 0.085 - st.thrust * 0.045 * stride + 0.02 * st.alarm;
      neck.position.y = 0.27 + st.alarm * 0.035 - st.peck * 0.02;
      neck.rotation.x = st.peck * 1.15 - st.alarm * 0.25 + st.air * 0.2;
      // olhar em volta aos trancos (parada), mais rápido em alerta; bicando olha para baixo
      st.lookT -= dt * (1 + st.alarm * 2);
      if (st.lookT <= 0) { st.lookT = 0.5 + Math.random() * 1.3; st.look = (Math.random() - 0.5) * 1.6; }
      st.headYaw = damp(st.headYaw, (1 - st.peck) * (moving ? st.look * 0.3 : st.look), 28, dt);
      head.rotation.y = st.headYaw;
      head.rotation.z = Math.sin(st.headYaw * 3) * 0.12;
      lower.rotation.x = st.peck > 0.5 ? 0.1 : 0;
      // piscar
      st.blinkT -= dt;
      if (st.blinkT <= 0) { st.blinkT = 1.8 + Math.random() * 3; st.blink = 1; }
      st.blink = Math.max(0, st.blink - dt * 9);
      for (const e of eyes) e.scale.y = 1 - st.blink * 0.85;
      // asas: fechadas; meio abertas correndo; batendo, sobem e descem rápido; no ar, abertas planando
      st.flapPh += dt * (14 + st.flap * 6);
      const beat = st.flap * (0.55 + 0.55 * Math.sin(st.flapPh));
      const open = Math.max(beat, 0.22 * Math.min(1, v / 1.2), st.air * 0.95) + rf;
      for (const w of wings) {
        w.pivot.rotation.z = -w.sx * open * 1.25;
        w.feathers.rotation.y = w.sx * open * 0.35; // as penas se abrem em leque
      }
    },
  };
}
