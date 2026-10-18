// Cocozinho de desenho (extra escondido, src/game/extras.js): três voltas marrons brilhantes que afinam até uma
// pontinha enrolada, com carinha (dois olhos com brilho e um sorrisinho) e três "fumacinhas" de cheiro que sobem e
// somem. Base no chão (y = 0), ~12 cm de largura na escala das dogs. Tudo procedural.
//   appear(): aparece com um "plop" (achata, estica e assenta). update(dt): o balancinho e as fumacinhas.
import * as THREE from 'three';

const TAU = Math.PI * 2;

/** @param {{ scale?: number }} [opts] */
export function createPoop({ scale = 1 } = {}) {
  const root = new THREE.Group();
  root.name = 'cocozinho';
  const body = new THREE.Group();
  root.add(body);
  const brown = new THREE.MeshPhysicalMaterial({ color: '#7a4a2a', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color('#c58a5a') });
  // três voltas (toros achatados) e a pontinha
  const rings = [
    { r: 0.046, t: 0.026, y: 0.024 },
    { r: 0.034, t: 0.023, y: 0.058 },
    { r: 0.021, t: 0.019, y: 0.088 },
  ];
  rings.forEach(({ r, t, y }, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 28), brown);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = i * 0.9;
    ring.position.y = y;
    ring.scale.set(1, 1, 0.82);
    body.add(ring);
    // miolo para não ver o furo do toro de cima
    const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.98, 16, 10), brown);
    core.scale.set(1, 0.7, 1);
    core.position.y = y;
    body.add(core);
  });
  // pontinha enrolada: uma curvinha de tubo que afina
  const tipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0.006, 0.118, 0.002), new THREE.Vector3(0.016, 0.128, -0.002), new THREE.Vector3(0.024, 0.126, -0.006),
  ]);
  const tipGeo = new THREE.TubeGeometry(tipCurve, 16, 0.012, 10, false);
  {
    // afina até a ponta
    const p = tipGeo.attributes.position;
    const v = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const seg = Math.floor(i / 11) / 16;
      tipCurve.getPoint(Math.min(1, seg), c);
      const k = 1 - 0.75 * seg;
      v.sub(c).multiplyScalar(k).add(c);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    tipGeo.computeVertexNormals();
  }
  const tip = new THREE.Mesh(tipGeo, brown);
  const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 8), brown);
  tipBall.position.set(0, 0.1, 0);
  body.add(tip, tipBall);
  // carinha: olhos com brilho e sorrisinho, na frente (+Z)
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#140b07', roughness: 0.1, clearcoat: 1 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 14, 10), eyeMat);
    eye.position.set(sx * 0.015, 0.064, 0.036);
    eye.scale.set(1, 1.15, 0.6);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), shine);
    glint.position.set(-0.003, 0.004, 0.005);
    eye.add(glint);
    body.add(eye);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#2a160c', roughness: 0.5 }));
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.046, 0.044);
  body.add(smile);
  // bochechinhas rosadas
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.0065, 12), new THREE.MeshBasicMaterial({ color: '#e88a8a', transparent: true, opacity: 0.55, depthWrite: false }));
    cheek.position.set(sx * 0.027, 0.05, 0.039);
    cheek.rotation.y = sx * 0.55;
    body.add(cheek);
  }
  body.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });

  // fumacinhas de cheiro: três tubinhos ondulados que sobem e somem
  const stinkMat = new THREE.MeshBasicMaterial({ color: '#b5c96a', transparent: true, opacity: 0, depthWrite: false });
  const stinks = [];
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let k = 0; k <= 10; k++) pts.push(new THREE.Vector3(Math.sin(k * 0.9 + i) * 0.012, k * 0.012, 0));
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0028, 5, false), stinkMat.clone());
    const holder = new THREE.Group();
    holder.position.set((i - 1) * 0.035, 0.11, (i % 2) * 0.012);
    holder.add(line);
    root.add(holder);
    stinks.push({ holder, mat: /** @type {THREE.MeshBasicMaterial} */ (line.material), ph: i * 0.33 });
  }
  root.scale.setScalar(scale);

  const S = { t: -1, age: 0 };
  function update(dt) {
    if (S.t < 0) return;
    S.t += dt;
    S.age += dt;
    // plop: achata, estica e assenta (mola amortecida)
    const u = S.t;
    const grow = Math.min(1, u / 0.12);
    const wob = u < 0.9 ? Math.exp(-u * 6) * Math.sin(u * 26) : 0;
    body.scale.set(grow * (1 + wob * 0.25), grow * (1 - wob * 0.35), grow * (1 + wob * 0.25));
    body.rotation.y = Math.sin(S.age * 1.3) * 0.08;
    // fumacinhas: sobem em ciclos nos primeiros segundos e depois só de vez em quando
    for (const s of stinks) {
      const cyc = (S.age * 0.45 + s.ph) % 1;
      const fade = S.age < 6 ? 1 : 0.35;
      s.holder.position.y = 0.11 + cyc * 0.06;
      s.mat.opacity = Math.sin(Math.PI * cyc) * 0.75 * fade;
      s.holder.rotation.y = Math.sin(S.age * 2 + s.ph * TAU) * 0.4;
    }
  }
  return {
    object: root,
    appear() {
      S.t = 0;
      S.age = 0;
      root.visible = true;
      update(0);
    },
    update,
  };
}
