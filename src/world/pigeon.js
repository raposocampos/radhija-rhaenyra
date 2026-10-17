// Pombo procedural (fase 4): corpo cinza-azulado, pescoço furta-cor, faixas escuras nas asas, olho
// laranja, pezinhos rosados. createPigeon({ seed, tint }) → { object, setPose(p), peek(), update(dt, t) }.
// setPose({ x, y, z, yaw, flying, flightProgress?, asleep }): posição dos pés; flying bate as asas; asleep encolhe a
// cabeça, fecha os olhos e solta "zzz".
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, rng } from './util.js';

// Cor na própria malha: barras e penas não acrescentam draw calls nem texturas.
/** @param {THREE.BufferGeometry} geo @param {(x: number, y: number, z: number) => THREE.Color} colorAt */
function paint(geo, colorAt) {
  const p = geo.getAttribute('position');
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    colorAt(p.getX(i), p.getY(i), p.getZ(i)).toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Une partes estáticas do mesmo material e libera as malhas intermediárias. */
function join(parts) {
  const geo = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geo;
}

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
  const featherMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const neckMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.22 });
  const beakMat = new THREE.MeshStandardMaterial({ color: '#3a3335', roughness: 0.5 });
  const cereMat = new THREE.MeshStandardMaterial({ color: '#efe9e2', roughness: 0.7 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#e8822e', roughness: 0.25, emissive: '#5a2a00', emissiveIntensity: 0.2 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: '#120a06', roughness: 0.2 });
  const feetMat = new THREE.MeshStandardMaterial({ color: '#d98a8f', roughness: 0.6 });

  // Corpo em gota: peito cheio e dorso que afina até a cauda, sem peças sobrepostas no peito.
  const torsoGeo = new THREE.SphereGeometry(1, 20, 16);
  const tp = torsoGeo.getAttribute('position');
  for (let i = 0; i < tp.count; i++) {
    const z = tp.getZ(i);
    const fullness = 0.88 + 0.12 * z;
    tp.setXYZ(i, tp.getX(i) * 0.092 * fullness,
      tp.getY(i) * 0.086 * fullness + z * 0.016, z * 0.137);
  }
  torsoGeo.computeVertexNormals();
  const torso = new THREE.Mesh(torsoGeo, grey);
  torso.position.set(0, 0.119, 0.012);
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.175, 0.1);
  const headColor = new THREE.Color(tint).multiplyScalar(0.72);
  const headMat = new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.7 });
  // Pescoço cônico arredondado acompanha a cabeça ao cochilar e ao espiar.
  const neckGeo = new THREE.SphereGeometry(1, 16, 14);
  const np = neckGeo.getAttribute('position');
  for (let i = 0; i < np.count; i++) {
    const y = np.getY(i);
    const taper = 1 - y * 0.24;
    np.setXYZ(i, np.getX(i) * 0.047 * taper, y * 0.068 - 0.008,
      np.getZ(i) * 0.044 * taper + y * 0.015 + 0.006);
  }
  neckGeo.computeVertexNormals();
  const green = new THREE.Color('#427b70');
  const violet = new THREE.Color('#706080');
  const bodyColor = new THREE.Color(tint);
  paint(neckGeo, (x, y) => {
    const c = violet.clone().lerp(green, THREE.MathUtils.smoothstep(y, -0.038, 0.018));
    c.lerp(bodyColor, 1 - THREE.MathUtils.smoothstep(y, -0.065, -0.035));
    return c.lerp(headColor, THREE.MathUtils.smoothstep(y, 0.012, 0.05));
  });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), headMat);
  head.scale.set(0.045, 0.047, 0.049);
  head.position.set(0, 0.045, 0.03);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.010, 0.036, 12).rotateX(Math.PI / 2), beakMat);
  beak.scale.y = 0.65;
  beak.position.set(0, 0.029, 0.089);
  const cere = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), cereMat);
  cere.scale.set(1, 0.6, 1.1);
  cere.position.set(0, 0.037, 0.076);
  headPivot.add(neck, head, beak, cere);
  const eyes = [-1, 1].map((sx) => {
    const e = new THREE.Group();
    e.position.set(sx * 0.040, 0.054, 0.048);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 10, 8), eyeMat);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), pupilMat);
    iris.scale.set(0.38, 0.9, 1);
    pupil.scale.x = 0.4;
    pupil.position.set(sx * 0.0035, 0, 0.0015);
    e.add(iris, pupil);
    headPivot.add(e);
    return e;
  });
  const wings = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.068, 0.135, 0.02);
    // Uma asa contínua em folha, larga no ombro e estreita nas penas primárias.
    const wGeo = new THREE.SphereGeometry(1, 12, 28);
    const openGeo = wGeo.clone();
    const recoveryGeo = wGeo.clone();
    const wp = wGeo.getAttribute('position');
    const wingColor = bodyColor.clone().lerp(new THREE.Color('#c5cad2'), 0.2);
    const barColor = new THREE.Color('#39404c');
    paint(wGeo, (x, y) => {
      const band = Math.max(
        1 - THREE.MathUtils.smoothstep(Math.abs(y + 0.12), 0.065, 0.13),
        1 - THREE.MathUtils.smoothstep(Math.abs(y + 0.49), 0.065, 0.13));
      return wingColor.clone().lerp(barColor, Math.max(band, 0.7 * (1 - THREE.MathUtils.smoothstep(y, -0.9, -0.65))));
    });
    for (let i = 0; i < wp.count; i++) {
      const x = wp.getX(i), y = wp.getY(i), z = wp.getZ(i);
      const taper = 0.78 + 0.22 * y;
      wp.setXYZ(i, x * 0.025 * taper + sx * 0.013,
        -z * 0.058 * taper - 0.012, y * 0.137 - 0.042);
      // Ombro → ponta: abre lateralmente, com superfície larga na batida de força.
      // A orientação dos eixos preserva as normais dos dois lados, sem espelhar a malha.
      const u = (1 - y) / 2;
      const wrist = THREE.MathUtils.smoothstep(u, 0.38, 0.95);
      openGeo.getAttribute('position').setXYZ(i,
        sx * (0.005 + u * 0.255), sx * x * 0.012,
        z * 0.085 * (1 - 0.35 * u) - u * 0.065);
      // Na recuperação, o punho cede e a ponta recua. Não é uma pá rígida.
      recoveryGeo.getAttribute('position').setXYZ(i,
        sx * (0.005 + u * 0.255 - wrist * 0.065), sx * x * 0.012 + wrist * 0.025,
        z * 0.072 * (1 - 0.35 * u) - u * 0.065 - wrist * 0.06);
    }
    wGeo.computeVertexNormals();
    openGeo.computeVertexNormals();
    recoveryGeo.computeVertexNormals();
    wGeo.morphAttributes.position = [openGeo.getAttribute('position'), recoveryGeo.getAttribute('position')];
    wGeo.morphAttributes.normal = [openGeo.getAttribute('normal'), recoveryGeo.getAttribute('normal')];
    const wing = new THREE.Mesh(wGeo, featherMat);
    wing.name = `asa-${sx < 0 ? 'esquerda' : 'direita'}`;
    pivot.add(wing);
    body.add(pivot);
    return { pivot, wing, sx };
  });
  // Leque de penas com extremidades macias, integrado em uma única malha.
  const tailParts = [];
  for (let i = -2; i <= 2; i++) {
    const feather = new THREE.SphereGeometry(1, 8, 10).rotateX(Math.PI / 2);
    feather.scale(0.014, 0.006, 0.066 - Math.abs(i) * 0.003);
    feather.rotateY(i * -0.075);
    feather.translate(i * 0.016, 0, Math.abs(i) * 0.004);
    paint(feather, (x, y, z) => bodyColor.clone().multiplyScalar(
      0.63 - 0.28 * (1 - THREE.MathUtils.smoothstep(z, -0.048, -0.034))));
    tailParts.push(feather);
  }
  const tail = new THREE.Mesh(join(tailParts), featherMat);
  tail.position.set(0, 0.096, -0.16);
  tail.rotation.x = 0.28;
  body.add(torso, headPivot, tail);
  // pés
  const feet = new THREE.Group();
  feet.name = 'pes';
  const footParts = [];
  for (const sx of [-1, 1]) {
    footParts.push(new THREE.CylinderGeometry(0.005, 0.006, 0.045, 6)
      .translate(sx * 0.03, 0.031, 0.01));
    for (const a of [-0.5, 0, 0.5]) {
      footParts.push(new THREE.CapsuleGeometry(0.003, 0.028, 2, 5)
        .rotateX(Math.PI / 2).rotateY(a)
        .translate(sx * 0.03 + Math.sin(a) * 0.014, 0.004, 0.026));
    }
    footParts.push(new THREE.CapsuleGeometry(0.003, 0.016, 2, 5)
      .rotateX(Math.PI / 2).translate(sx * 0.03, 0.004, -0.003));
  }
  feet.add(new THREE.Mesh(join(footParts), feetMat));
  root.add(feet);
  root.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // "zzz" de quem cochila
  const zs = [0, 1, 2].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(0.08);
    root.add(s);
    return s;
  });

  const pose = { x: 0, y: 0, z: 0, yaw: 0, flying: false, asleep: false, flightProgress: null };
  const st = { sleepK: 0, peekT: 0, phase: r() * 10, flap: 0, airK: 0,
    flightAge: 0, landingT: 0, wasFlying: false, yawReady: false };
  root.scale.setScalar(scale);
  return {
    object: root,
    /** @param {Partial<typeof pose>} p */
    setPose(p) {
      if (p.flying && !pose.flying) pose.flightProgress = null;
      Object.assign(pose, p);
    },
    /** Abre um olho e volta a dormir (reação ao latido). */
    peek() { st.peekT = 1.1; },
    /** @param {number} dt @param {number} t */
    update(dt, t) {
      root.position.set(pose.x, pose.y, pose.z);
      if (!st.yawReady) { root.rotation.y = pose.yaw; st.yawReady = true; }
      const turn = Math.atan2(Math.sin(pose.yaw - root.rotation.y), Math.cos(pose.yaw - root.rotation.y));
      root.rotation.y += turn * (1 - Math.exp(-dt * 12));
      if (pose.flying && !st.wasFlying) { st.flap = 0; st.flightAge = 0; st.landingT = 0; }
      if (!pose.flying && st.wasFlying) st.landingT = 0.24;
      st.wasFlying = pose.flying;
      st.flightAge = pose.flying ? st.flightAge + dt : 0;
      st.landingT = Math.max(0, st.landingT - dt);
      st.airK += ((pose.flying ? 1 : 0) - st.airK) * (1 - Math.exp(-dt * (pose.flying ? 18 : 11)));
      const air = st.airK;
      const brake = pose.flying && pose.flightProgress !== null
        ? THREE.MathUtils.smoothstep(pose.flightProgress, 0.72, 1) : 0;
      const sleepTarget = pose.asleep && !pose.flying && st.peekT <= 0 ? 1 : 0;
      if (st.peekT > 0) st.peekT -= dt;
      st.sleepK += (sleepTarget - st.sleepK) * (1 - Math.exp(-dt * 5));
      const k = st.sleepK;
      // dormindo: cabeça encolhida no peito, corpo mais redondo, olhos fechados
      headPivot.position.set(0, 0.175 - 0.028 * k, 0.1 - 0.012 * k);
      headPivot.rotation.x = 0.42 * k - 0.12 * air;
      torso.scale.set(1 + 0.08 * k, 1 - 0.05 * k + 0.02 * Math.sin(t * 1.6 + st.phase) * k, 1);
      for (const e of eyes) e.scale.set(1, Math.max(0.12, 1 - k), 1);
      // Mais energia ao decolar; descida firme e recuperação mais longa/flexível.
      st.flap = (st.flap + dt * (4.6 + 1.2 * Math.exp(-st.flightAge * 8)) * air) % 1;
      const down = st.flap < 0.42;
      const stroke = down ? st.flap / 0.42 : (st.flap - 0.42) / 0.58;
      const arc = (1 - Math.cos(stroke * Math.PI)) / 2;
      const elevation = down ? 1.1 - 1.95 * arc : -0.85 + 1.95 * arc;
      const recover = down ? 0 : Math.sin(stroke * Math.PI) * 0.85;
      for (const w of wings) {
        const idle = 0.05 + Math.sin(t * 2.3 + st.phase) * 0.03;
        w.pivot.rotation.z = w.sx * THREE.MathUtils.lerp(idle, elevation, air);
        w.pivot.rotation.y = -w.sx * 0.12 * air * Math.sin(stroke * Math.PI);
        w.wing.morphTargetInfluences[0] = air * (1 - recover);
        w.wing.morphTargetInfluences[1] = air * recover;
      }
      const tuck = air * (1 - brake);
      feet.position.y = 0.055 * tuck;
      feet.rotation.x = -0.65 * tuck;
      feet.scale.y = 1 - 0.4 * tuck;
      const settle = Math.sin((st.landingT / 0.24) * Math.PI);
      body.position.y = -0.04 * k + air * (0.012 + 0.006 * Math.cos(st.flap * Math.PI * 2)) - 0.012 * settle;
      body.rotation.x += (air * (0.18 - 0.6 * brake) - body.rotation.x) * (1 - Math.exp(-dt * 14));
      body.rotation.z += (THREE.MathUtils.clamp(-turn * 0.18, -0.16, 0.16) * air - body.rotation.z) * (1 - Math.exp(-dt * 10));
      tail.rotation.x += (0.28 + air * (0.15 + 0.45 * brake) - tail.rotation.x) * (1 - Math.exp(-dt * 12));
      tail.scale.x = 1 + air * (0.18 + 0.3 * brake);
      // A cabeça permanece estável no ar; o balanço volta gradualmente ao pousar.
      if (k < 0.5) headPivot.position.z += Math.max(0, Math.sin(t * 5.2 + st.phase)) * 0.012 * (1 - k * 2) * (1 - air);
      zs.forEach((s, i) => {
        const c = ((t * 0.45 + i / 3) % 1);
        s.position.set(0.06 + c * 0.08, 0.24 + c * 0.22, 0.02 + Math.sin(c * 6 + i) * 0.02);
        s.material.opacity = k * Math.sin(c * Math.PI) * 0.95;
        s.scale.setScalar(0.05 + c * 0.05);
      });
    },
  };
}
