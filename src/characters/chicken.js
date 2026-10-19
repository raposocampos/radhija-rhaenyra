// Galinha (NPC de ambientação da fase 10): corpo redondinho, rabo de penas em leque, crista e barbela vermelhas, bico,
// asas que abrem e batem, e as patas finas que andam. Tudo procedural, materiais compartilhados entre as galinhas.
// API: createChicken({ variant }) → { object, setPose(x, y, z, yaw), animate(dt, { speed, peck, flap, alarm }) }
//   speed: m/s no chão (passo → corridinha); peck 0..1 (cabeça no chão); flap 0..1 (asas batendo); alarm (pescoço
//   esticado, olhando em volta). variant 0 = branca, 1 = carijó marrom.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

const PALETTES = [
  { body: '#f4efe4', wing: '#e6ddcb', tail: '#ece4d4', dark: '#cfc4ae' },
  { body: '#b8693a', wing: '#94512c', tail: '#5a3a28', dark: '#7a4424' },
];
/** @type {Record<string, THREE.Material>} */
const MATS = {};
const mat = (hex, rough = 0.8) => (MATS[`${hex}|${rough}`] ||= new THREE.MeshStandardMaterial({ color: hex, roughness: rough }));
const sphere = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);

/** @param {{ variant?: number }} [opts] */
export function createChicken({ variant = 0 } = {}) {
  const P = PALETTES[variant % PALETTES.length];
  const object = new THREE.Group();
  object.name = 'galinha';
  const body = new THREE.Group();
  object.add(body);

  // corpo e peito
  const trunk = new THREE.Mesh(sphere(1), mat(P.body));
  trunk.scale.set(0.12, 0.11, 0.16);
  trunk.position.set(0, 0.2, 0);
  const breast = new THREE.Mesh(sphere(1), mat(P.body));
  breast.scale.set(0.1, 0.1, 0.09);
  breast.position.set(0, 0.2, 0.09);
  body.add(trunk, breast);
  // rabo em leque, para cima
  for (const [rz, rx, s] of [[-0.35, -0.6, 0.9], [0, -0.75, 1], [0.35, -0.6, 0.9]]) {
    const f = new THREE.Mesh(sphere(1, 10, 8), mat(P.tail));
    f.scale.set(0.035 * s, 0.1 * s, 0.05 * s);
    f.position.set(rz * 0.08, 0.3, -0.14);
    f.rotation.set(rx, 0, rz);
    body.add(f);
  }
  // asas (pivô no alto do corpo: abrem para os lados)
  const wings = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.1, 0.25, 0.0);
    const w = new THREE.Mesh(sphere(1, 12, 8), mat(P.wing));
    w.scale.set(0.028, 0.075, 0.12);
    w.position.set(sx * 0.02, -0.05, -0.01);
    w.rotation.x = 0.15;
    pivot.add(w);
    body.add(pivot);
    return { pivot, sx };
  });
  // pescoço e cabeça (pivô no pescoço: bica o chão)
  const neck = new THREE.Group();
  neck.position.set(0, 0.27, 0.1);
  body.add(neck);
  const head = new THREE.Group();
  neck.add(head);
  const skull = new THREE.Mesh(sphere(0.055), mat(P.body));
  skull.position.set(0, 0.06, 0.03);
  const red = mat('#d8302a', 0.6);
  const combs = [-0.022, 0, 0.022].map((z, k) => {
    const c = new THREE.Mesh(sphere(k === 1 ? 0.021 : 0.017, 8, 6), red);
    c.position.set(0, 0.115 + (k === 1 ? 0.005 : 0), 0.03 + z);
    return c;
  });
  const wattle = new THREE.Mesh(sphere(0.016, 8, 6), red);
  wattle.scale.set(0.8, 1.3, 0.8);
  wattle.position.set(0, 0.01, 0.075);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 6).rotateX(Math.PI / 2), mat('#f2b33d', 0.5));
  beak.position.set(0, 0.05, 0.095);
  const eyeM = mat('#1a1410', 0.3);
  const eyes = [-1, 1].map((sx) => {
    const e = new THREE.Mesh(sphere(0.009, 8, 6), eyeM);
    e.position.set(sx * 0.042, 0.075, 0.06);
    return e;
  });
  head.add(skull, ...combs, wattle, beak, ...eyes);
  // patas (pivô no quadril) com os três dedos
  const legM = mat('#e8a23a', 0.6);
  const legs = [-1, 1].map((sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.045, 0.12, 0.0);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.12, 6), legM);
    shin.position.y = -0.06;
    hip.add(shin);
    for (const a of [-0.45, 0, 0.45]) {
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006, 0.045), legM);
      toe.position.set(Math.sin(a) * 0.02, -0.118, Math.cos(a) * 0.02);
      toe.rotation.y = a;
      hip.add(toe);
    }
    object.add(hip);
    return hip;
  });
  object.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });

  const st = { phase: 0, peck: 0, flap: 0, flapPh: 0, alarm: 0, look: 0, lookT: 0, bob: 0 };
  return {
    object,
    setPose(x, y, z, yaw) {
      object.position.set(x, y, z);
      object.rotation.y = yaw;
    },
    /** @param {number} dt @param {{ speed?: number, peck?: number, flap?: number, alarm?: boolean }} s */
    animate(dt, s = {}) {
      const v = s.speed ?? 0;
      st.peck = damp(st.peck, s.peck ?? 0, 18, dt);
      st.flap = damp(st.flap, s.flap ?? 0, 10, dt);
      st.alarm = damp(st.alarm, s.alarm ? 1 : 0, 8, dt);
      // passos: frequência sobe com a velocidade (a corridinha é bem rápida)
      st.phase += dt * (v > 0.02 ? 5 + v * 7 : 0);
      const stride = Math.min(1, v / 0.6);
      legs[0].rotation.x = Math.sin(st.phase * TAU * 0.5) * 0.6 * stride;
      legs[1].rotation.x = -Math.sin(st.phase * TAU * 0.5) * 0.6 * stride;
      // corpo: sobe e desce no passo; inclina para a frente correndo e quando bica
      body.position.y = Math.abs(Math.sin(st.phase * TAU * 0.5)) * 0.012 * stride;
      body.rotation.x = 0.12 * Math.min(1, v / 1.5) + st.peck * 0.35 - st.alarm * 0.08;
      // cabeça: o vai e vem de galinha andando; bicando, desce até o chão; em alerta, estica e olha em volta
      st.lookT -= dt;
      if (st.lookT <= 0) { st.lookT = 0.6 + Math.random() * 1.4; st.look = (Math.random() - 0.5) * 1.4; }
      const pump = Math.sin(st.phase * TAU * 0.5) * 0.03 * stride;
      neck.position.z = 0.1 + pump;
      neck.rotation.x = lerp(0, 1.25, st.peck);
      neck.position.y = 0.27 + st.alarm * 0.03;
      head.rotation.y = damp(head.rotation.y, (1 - st.peck) * st.look * (0.4 + st.alarm * 0.6), 6, dt);
      // asas: fechadas; abrem um pouco correndo; batendo, sobem e descem rápido
      st.flapPh += dt * 16;
      const open = Math.max(st.flap * (0.6 + 0.6 * Math.sin(st.flapPh)), 0.25 * Math.min(1, v / 1.2));
      for (const w of wings) w.pivot.rotation.z = -w.sx * open * 1.1;
    },
  };
}
