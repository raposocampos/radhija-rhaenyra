// FASE 3 · Luzes de clima: cordões de lâmpadas em catenária (fachada ↔ postes fora dos limites),
// lâmpadas emissivas instanciadas (bloom) e vagalumes piscando sobre o lago (pontos em shader).
import * as THREE from 'three';
import { rng, stdMat, ironMat, shared } from '../../../world/util.js';

function catenary(a, b, sag, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

export function buildStringLights(layout) {
  const group = new THREE.Group();
  group.name = 'cordoes-de-luz';
  const B = layout.WORLD.bounds;
  const Zf = layout.WORLD.houseWallZ + 0.04;
  const W = B.minX - 0.42, E = B.maxX + 0.45;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // postes altos fora dos limites (leste/oeste)
  const poles = [V(W, 2.8, 2.6), V(E, 2.8, -2.6), V(E, 2.8, 2.9), V(W, 2.8, -3.6)];
  const strands = [
    // guirlanda ao longo da fachada (sob a laje), em festões
    ...[[-8.0, -5.6], [-5.6, -3.4], [-3.4, -0.6], [-0.6, 2.2], [2.2, 5.0], [5.0, 7.6]].map(([a, b]) => ({ a: V(a, 2.78, Zf + 0.5), b: V(b, 2.78, Zf + 0.5), sag: 0.28 })),
    { a: V(-3.2, 2.82, Zf + 0.5), b: poles[0], sag: 0.55 },      // quintal, em diagonal até o poste oeste
    { a: poles[3], b: V(-6.0, 2.82, Zf + 0.5), sag: 0.2 },
    { a: V(-0.4, 2.82, Zf + 0.5), b: poles[2], sag: 0.85 },      // sobre o lago (diagonal NO → SE)
    { a: V(2.6, 2.82, Zf + 0.5), b: poles[1], sag: 0.4 },
    { a: poles[0], b: poles[2], sag: 0.95 },                       // travessia longa ao sul do lago
  ];
  const wirePts = [];
  const bulbs = [];
  const r = rng(404);
  const warm = [new THREE.Color('#ffd08a'), new THREE.Color('#ffbf70'), new THREE.Color('#ffe3b0'), new THREE.Color('#ffb066')];
  for (const s of strands) {
    const len = s.a.distanceTo(s.b);
    const n = Math.max(6, Math.round(len / 0.42));
    const pts = catenary(s.a, s.b, s.sag, n * 4);
    const curve = new THREE.CatmullRomCurve3(pts);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, n * 4, 0.006, 4), stdMat('#151312', { roughness: 0.6 })));
    for (let i = 1; i < n; i++) {
      const p = curve.getPointAt(i / n);
      bulbs.push({ p, c: warm[Math.floor(r() * warm.length)], ph: r() * 10 });
    }
    wirePts.push(pts);
  }
  // lâmpada: bulbo + soquete
  const bulbGeo = new THREE.SphereGeometry(0.028, 10, 8);
  bulbGeo.scale(1, 1.3, 1);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const im = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbs.length);
  const sockGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.035, 6);
  const sock = new THREE.InstancedMesh(sockGeo, stdMat('#1d1a18', { roughness: 0.5 }), bulbs.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  bulbs.forEach((b, i) => {
    m4.makeTranslation(b.p.x, b.p.y - 0.06, b.p.z);
    im.setMatrixAt(i, m4);
    c.copy(b.c).multiplyScalar(4.2);
    im.setColorAt(i, c);
    m4.makeTranslation(b.p.x, b.p.y - 0.025, b.p.z);
    sock.setMatrixAt(i, m4);
  });
  im.frustumCulled = false; sock.frustumCulled = false;
  group.add(im, sock);
  // postes de madeira escura com braço
  for (const p of poles) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, p.y + 0.15, 8), stdMat('#3b2c22', { roughness: 0.85 }));
    pole.position.set(p.x, (p.y + 0.15) / 2, p.z);
    pole.castShadow = true;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12), ironMat());
    hook.position.set(p.x, p.y, p.z);
    group.add(pole, hook);
  }
  // ganchos na fachada
  for (const s of strands) for (const q of [s.a, s.b]) {
    if (Math.abs(q.z - (Zf + 0.5)) > 0.01) continue;
    const hk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5).rotateX(Math.PI / 2), ironMat());
    hk.position.set(q.x, q.y + 0.01, Zf + 0.25);
    group.add(hk);
  }
  // pontos de amostra para os reflexos no lago (lâmpadas sobre/perto da água)
  const P = layout.POND.island;
  const nearPond = bulbs.filter((b) => Math.hypot(b.p.x - P.x, b.p.z - P.z) < 3.6).sort((a, b) => a.p.distanceTo(new THREE.Vector3(P.x, 2, P.z)) - b.p.distanceTo(new THREE.Vector3(P.x, 2, P.z)));
  const waterSamples = [];
  const step = Math.max(1, Math.floor(nearPond.length / 8));
  for (let i = 0; i < nearPond.length && waterSamples.length < 8; i += step) waterSamples.push({ pos: nearPond[i].p.clone().add(new THREE.Vector3(0, -0.06, 0)), col: nearPond[i].c.clone(), k: 0.55 });
  return { group, bulbs: im, waterSamples, count: bulbs.length };
}

export function buildFireflies(layout, field) {
  const B = layout.WORLD.bounds;
  const r = rng(77);
  const N = 70;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  const P = layout.POND.island;
  for (let i = 0; i < N; i++) {
    let x, z;
    if (i < 46) { // concentrados sobre o lago e a ilha
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 2.9;
      x = P.x + Math.cos(a) * d; z = P.z + Math.sin(a) * d * 0.95;
    } else {
      x = B.minX + r() * (B.maxX - B.minX); z = B.minZ + 0.6 + r() * (B.maxZ - B.minZ - 0.8);
    }
    pos[i * 3] = x; pos[i * 3 + 1] = 0.25 + r() * 0.9; pos[i * 3 + 2] = z;
    seed[i] = r() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.time, uScale: { value: 500 }, uColor: { value: new THREE.Color('#d9ff7a') } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uScale; varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * 0.35 + aSeed;
        p.x += sin(t * 0.9 + aSeed) * 0.35 + sin(t * 2.3) * 0.06;
        p.z += cos(t * 0.7 + aSeed * 1.3) * 0.3;
        p.y += sin(t * 1.3 + aSeed * 0.7) * 0.18;
        // pisca: pulsos curtos com pausas
        float cyc = fract(uTime * (0.16 + fract(aSeed * 0.37) * 0.12) + aSeed * 0.13);
        vA = smoothstep(0.0, 0.08, cyc) * (1.0 - smoothstep(0.12, 0.42, cyc));
        vA = max(vA, 0.06);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * 0.075 * (0.6 + vA * 0.6) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vA;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        float core = smoothstep(0.5, 0.0, d);
        float a = core * core * vA;
        gl_FragColor = vec4(uColor * (1.5 + 3.0 * smoothstep(0.18, 0.0, d)) * a, a);
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.name = 'vagalumes';
  pts.renderOrder = 5;
  return { points: pts, material: m };
}
