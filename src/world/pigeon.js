// Pombo procedural (fase 4): corpo cinza-azulado, pescoço furta-cor, faixas escuras nas asas, olho
// laranja, pezinhos rosados. createPigeon({ seed, tint }) → { object, setPose(p), peek(), update(dt, t) }.
// setPose({ x, y, z, yaw, flying, asleep }): posição dos pés; flying bate as asas; asleep encolhe a
// cabeça, fecha os olhos e solta "zzz".
import * as THREE from 'three';
import { canvasTexture, rng } from './util.js';

let _zzz = null;
function zzzTexture() {
  if (_zzz) return _zzz;
  _zzz = canvasTexture(64, 64, (g, w, h) => {
    g.font = '700 40px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(74,52,38,0.9)';
    g.strokeText('z', w / 2, h / 2 + 2);
    g.fillStyle = '#fff8ec';
    g.fillText('z', w / 2, h / 2 + 2);
  }, { repeat: false });
  return _zzz;
}

/** @param {{ seed?: number, tint?: string, scale?: number }} [opts] */
export function createPigeon({ seed = 1, tint = '#8f96a6', scale = 1 } = {}) {
  const r = rng(seed);
  const root = new THREE.Group();
  root.name = 'pombo';
  const body = new THREE.Group(); // tudo menos os pés (inclina ao dormir/voar)
  root.add(body);
  const grey = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(tint).multiplyScalar(0.62), roughness: 0.8 });
  const bars = new THREE.MeshStandardMaterial({ color: '#33363f', roughness: 0.8 });
  const neckMat = new THREE.MeshStandardMaterial({ color: '#4f8f7a', roughness: 0.3, metalness: 0.45, emissive: '#3a2a55', emissiveIntensity: 0.15 });
  const beakMat = new THREE.MeshStandardMaterial({ color: '#3a3335', roughness: 0.5 });
  const cereMat = new THREE.MeshStandardMaterial({ color: '#efe9e2', roughness: 0.7 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#e8822e', roughness: 0.25, emissive: '#5a2a00', emissiveIntensity: 0.2 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: '#120a06', roughness: 0.2 });
  const feetMat = new THREE.MeshStandardMaterial({ color: '#d98a8f', roughness: 0.6 });

  const torsoGeo = new THREE.SphereGeometry(1, 20, 14);
  torsoGeo.scale(0.085, 0.08, 0.13);
  const torso = new THREE.Mesh(torsoGeo, grey);
  torso.position.set(0, 0.11, 0);
  // pescoço furta-cor: faixa achatada entre o peito e a cabeça (não uma bola)
  const chestGeo = new THREE.SphereGeometry(1, 16, 12);
  chestGeo.scale(0.062, 0.05, 0.045);
  const chest = new THREE.Mesh(chestGeo, neckMat);
  chest.position.set(0, 0.168, 0.088);
  const breastGeo = new THREE.SphereGeometry(1, 16, 12);
  breastGeo.scale(0.072, 0.066, 0.06);
  const breast = new THREE.Mesh(breastGeo, grey);
  breast.position.set(0, 0.13, 0.08);
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.175, 0.1);
  const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(tint).multiplyScalar(0.8), roughness: 0.75 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), headMat);
  head.position.set(0, 0.045, 0.03);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.04, 8).rotateX(Math.PI / 2), beakMat);
  beak.position.set(0, 0.032, 0.083);
  const cere = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), cereMat);
  cere.scale.set(1, 0.6, 1.1);
  cere.position.set(0, 0.043, 0.066);
  headPivot.add(head, beak, cere);
  const eyes = [-1, 1].map((sx) => {
    const e = new THREE.Group();
    e.position.set(sx * 0.03, 0.05, 0.05);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 10, 8), eyeMat);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), pupilMat);
    pupil.position.set(sx * 0.006, 0, 0.005);
    e.add(iris, pupil);
    headPivot.add(e);
    return e;
  });
  const wings = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.068, 0.135, 0.02);
    const wGeo = new THREE.SphereGeometry(1, 14, 10);
    wGeo.scale(0.02, 0.055, 0.115);
    const w = new THREE.Mesh(wGeo, grey);
    w.position.set(sx * 0.012, -0.015, -0.035);
    // faixa escura atravessada na asa (fina, rente à pena)
    const barGeo = new THREE.TorusGeometry(0.05, 0.006, 4, 12, Math.PI);
    const bar = new THREE.Mesh(barGeo, bars);
    bar.rotation.set(0, Math.PI / 2, Math.PI / 2);
    bar.scale.set(1.1, 0.42, 1);
    bar.position.set(sx * 0.03, -0.015, -0.07);
    pivot.add(bar);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8).rotateX(-Math.PI / 2), dark);
    tip.scale.set(0.5, 1, 1);
    tip.position.set(sx * 0.02, -0.02, -0.15);
    pivot.add(w, tip);
    body.add(pivot);
    return { pivot, sx };
  });
  const tailGeo = new THREE.BoxGeometry(0.09, 0.014, 0.11);
  const tail = new THREE.Mesh(tailGeo, dark);
  tail.position.set(0, 0.095, -0.17);
  tail.rotation.x = 0.28;
  body.add(torso, breast, chest, headPivot, tail);
  // pés
  const feet = new THREE.Group();
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), feetMat);
    leg.position.set(sx * 0.03, 0.03, 0.01);
    feet.add(leg);
    for (const a of [-0.5, 0, 0.5]) {
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.035, 5).rotateX(Math.PI / 2), feetMat);
      toe.position.set(sx * 0.03 + Math.sin(a) * 0.012, 0.004, 0.025 + Math.cos(a) * 0.006);
      toe.rotation.y = a;
      feet.add(toe);
    }
  }
  root.add(feet);
  root.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // "zzz" de quem cochila
  const zs = [0, 1, 2].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(0.08);
    root.add(s);
    return s;
  });

  const pose = { x: 0, y: 0, z: 0, yaw: 0, flying: false, asleep: false };
  const st = { sleepK: 0, peekT: 0, phase: r() * 10, flap: 0 };
  root.scale.setScalar(scale);
  return {
    object: root,
    /** @param {Partial<typeof pose>} p */
    setPose(p) { Object.assign(pose, p); },
    /** Abre um olho e volta a dormir (reação ao latido). */
    peek() { st.peekT = 1.1; },
    /** @param {number} dt @param {number} t */
    update(dt, t) {
      root.position.set(pose.x, pose.y, pose.z);
      root.rotation.y = pose.yaw;
      const sleepTarget = pose.asleep && st.peekT <= 0 ? 1 : 0;
      if (st.peekT > 0) st.peekT -= dt;
      st.sleepK += (sleepTarget - st.sleepK) * (1 - Math.exp(-dt * 5));
      const k = st.sleepK;
      // dormindo: cabeça encolhida no peito, corpo mais redondo, olhos fechados
      headPivot.position.set(0, 0.175 - 0.028 * k, 0.1 - 0.012 * k);
      headPivot.rotation.x = 0.42 * k;
      torso.scale.set(1 + 0.08 * k, 1 - 0.05 * k + 0.02 * Math.sin(t * 1.6 + st.phase) * k, 1);
      for (const e of eyes) e.scale.set(1, Math.max(0.12, 1 - k), 1);
      feet.visible = !pose.flying;
      body.position.y = -0.04 * k;
      if (pose.flying) {
        st.flap += dt * 30;
        for (const w of wings) w.pivot.rotation.z = w.sx * (0.6 + Math.sin(st.flap) * 1.15);
        body.rotation.x = -0.25;
      } else {
        for (const w of wings) w.pivot.rotation.z = w.sx * (0.05 + Math.sin(t * 2.3 + st.phase) * 0.03);
        body.rotation.x = 0;
        // cabecinha indo e vindo (acordado)
        if (k < 0.5) headPivot.position.z += Math.max(0, Math.sin(t * 5.2 + st.phase)) * 0.012 * (1 - k * 2);
      }
      zs.forEach((s, i) => {
        const c = ((t * 0.45 + i / 3) % 1);
        s.position.set(0.06 + c * 0.08, 0.24 + c * 0.22, 0.02 + Math.sin(c * 6 + i) * 0.02);
        s.material.opacity = k * Math.sin(c * Math.PI) * 0.95;
        s.scale.setScalar(0.05 + c * 0.05);
      });
    },
  };
}
