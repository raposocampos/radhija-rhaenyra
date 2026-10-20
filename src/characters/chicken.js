// Galinha caipira marrom (NPC de ambientação da fase 10), no jeito de uma galinha de verdade: o corpo é uma malha só,
// lisa (sem calombos), com o peito cheio e baixo na frente, o dorso reto subindo para o rabo e a traseira afinando
// para dentro das penas; o rabo é um leque de penas compridas e escuras, em pé e arqueadas para trás, com as penas
// curtas da sela na base; asas dobradas junto do corpo (pontas escuras); pescoço com a gola de penas douradas; cabeça
// com a crista vermelha alta e serrilhada, barbelas, bico curvo e olho laranja; patas amarelas com três dedos para a
// frente e um para trás. Cores por vértice num material liso (as penas do rabo, dos dois lados).
// Animação: a cabeça "fica parada no ar" e dá o tranco para a frente a cada passo (como galinha de verdade), o corpo
// balança de lado no passo, o rabo abana; ciscar = uma pata raspa para trás antes das bicadas; bater asas e planar
// com as asas abertas e as patas encolhidas; parada, olha em volta aos trancos, pisca e às vezes arrepia as penas.
// API: createChicken({ variant }) → { object, setPose(x, y, z, yaw), animate(dt, { speed, peck, flap, alarm, scratch, air }) }
//   variant 0 = dourada, 1 = marrom-avermelhada.
import * as THREE from 'three';
import { mergeGeometries } from '../world/util.js';

const TAU = Math.PI * 2;
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

const PALETTES = [
  { back: '#9c5428', belly: '#d69c5c', hackle: '#e6b058', hackleTip: '#a8642a', wing: '#8a4620', wingTip: '#36220f', tail: '#3a2a1a', tailTip: '#1c2219', covert: '#7c3c1a' },
  { back: '#7c381a', belly: '#bc7840', hackle: '#cf9040', hackleTip: '#8c4a1c', wing: '#6a3016', wingTip: '#2a1a0e', tail: '#2e2016', tailTip: '#161c14', covert: '#5e2a12' },
];
/** @type {Record<string, THREE.Material>} */
const MATS = {};
const vcMat = () => (MATS.vc ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 }));
const featherMat = () => (MATS.feather ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }));
const mat = (hex, rough = 0.6) => (MATS[`${hex}|${rough}`] ||= new THREE.MeshStandardMaterial({ color: hex, roughness: rough }));

/** Pinta a geometria vértice a vértice: fn(x, y, z, cor) acerta a cor. */
function paint(g, fn) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    fn(pos.getX(i), pos.getY(i), pos.getZ(i), c);
    arr.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
/** Degradê vertical (de baixo para cima) entre duas cores. */
const paintY = (g, low, high, y0, y1) => {
  const a = new THREE.Color(low), b = new THREE.Color(high);
  return paint(g, (x, y, z, c) => c.copy(a).lerp(b, clamp01((y - y0) / (y1 - y0))));
};
const ell = (rx, ry, rz, x, y, z, w = 20, h = 14) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz).translate(x, y, z);

/**
 * O corpo inteiro numa malha só: uma esfera esticada ao longo do comprimento (u = −1 na traseira … 1 no peito) com o
 * centro descendo na frente (peito baixo) e subindo atrás (a traseira vai para o rabo), afinando nas duas pontas, e a
 * barriga um pouco mais fofa embaixo, atrás das patas.
 */
function bodyGeometry(P) {
  const g = new THREE.SphereGeometry(1, 36, 26).rotateX(Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), u = pos.getZ(i);
    const back = u < 0 ? u * u : 0, front = u > 0 ? u * u : 0;
    const rx = 0.098 - 0.042 * back - 0.02 * front;
    const ry = 0.106 - 0.04 * back - 0.012 * front;
    const cy = 0.198 + 0.075 * back - 0.025 * u;
    const fluff = y < 0 ? 1 + 0.16 * Math.max(0, 1 - Math.abs(u + 0.15) * 1.6) : 1;
    pos.setXYZ(i, x * rx * fluff, cy + y * ry * fluff, u * 0.158);
  }
  g.computeVertexNormals();
  const belly = new THREE.Color(P.belly), back = new THREE.Color(P.back), hackle = new THREE.Color(P.hackle);
  return paint(g, (x, y, z, c) => {
    c.copy(belly).lerp(back, clamp01((y - 0.12) / 0.16));
    // os ombros e o peito de cima puxam para o dourado da gola
    const k = clamp01((z - 0.02) / 0.12) * clamp01((y - 0.18) / 0.1);
    c.lerp(hackle, k * 0.6);
  });
}

/**
 * Uma pena comprida: lâmina chata (com uma quilha leve no meio) no plano YZ, ao longo de uma curva que sobe e arqueia
 * para trás (curl = quanto a ponta cai), larga no meio e pontuda na ponta. Cor da base até a ponta.
 */
function featherGeometry(len, wid, curl, base, tip, segs = 12) {
  const P0 = new THREE.Vector2(0, 0);
  const P1 = new THREE.Vector2(len * 0.85, -len * 0.18);
  const P2 = new THREE.Vector2(len * 0.75 - curl, -len * 0.72);
  const pts = [], cols = [];
  const cb = new THREE.Color(base), ct = new THREE.Color(tip), c = new THREE.Color();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, s = 1 - t;
    const py = s * s * P0.x + 2 * s * t * P1.x + t * t * P2.x;
    const pz = s * s * P0.y + 2 * s * t * P1.y + t * t * P2.y;
    let ty = 2 * s * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
    let tz = 2 * s * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
    const tl = Math.hypot(ty, tz) || 1;
    ty /= tl; tz /= tl;
    const w = wid * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05))) * (t > 0.82 ? (1 - t) / 0.18 : 1);
    // lados (x = 0) e o meio, um pouco para fora (a quilha da pena)
    pts.push([0, py + tz * w * 0.5, pz - ty * w * 0.5], [0.004, py, pz], [0, py - tz * w * 0.5, pz + ty * w * 0.5]);
    c.copy(cb).lerp(ct, Math.pow(t, 0.7));
    cols.push(c.r, c.g, c.b, c.r * 0.85, c.g * 0.85, c.b * 0.85, c.r, c.g, c.b);
  }
  const pos = new Float32Array(pts.length * 3);
  pts.forEach((p, i) => pos.set(p, i * 3));
  const idx = [];
  for (let i = 0; i < segs; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** A crista simples, alta e serrilhada (cinco pontas), de lado (plano YZ), com uma espessurinha. */
function combGeometry() {
  const s = new THREE.Shape();
  const pts = [
    [-0.024, 0.026], [-0.026, 0.044], [-0.016, 0.04], [-0.012, 0.062], [-0.003, 0.05], [0.004, 0.07], [0.012, 0.052],
    [0.02, 0.066], [0.026, 0.048], [0.036, 0.056], [0.038, 0.038], [0.046, 0.04], [0.044, 0.024], [0.03, 0.02], [-0.01, 0.018],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0025, bevelSegments: 1, curveSegments: 2 });
  // o desenho é em X (comprimento) e Y (altura): gira para o comprimento ficar em Z e centra a espessura em X
  g.rotateY(-Math.PI / 2).translate(0.0035, 0, 0);
  return g;
}

/** @param {{ variant?: number }} [opts] */
export function createChicken({ variant = 0 } = {}) {
  const P = PALETTES[variant % PALETTES.length];
  const object = new THREE.Group();
  object.name = 'galinha';
  // o desenho é em tamanho de galinha grande; o rig deixa do tamanho certo perto das dogs
  const rig = new THREE.Group();
  rig.scale.setScalar(0.9);
  object.add(rig);
  const body = new THREE.Group(); // balança e inclina
  rig.add(body);

  // ---- corpo (uma malha só, lisa)
  const trunk = new THREE.Mesh(bodyGeometry(P), vcMat());
  body.add(trunk);

  // ---- rabo: leque de penas compridas e escuras, em pé e arqueadas para trás, e as penas curtas da sela na base
  const tail = new THREE.Group();
  tail.position.set(0, 0.275, -0.128);
  tail.rotation.x = -0.12;
  body.add(tail);
  /** @type {THREE.BufferGeometry[]} */
  const tailParts = [];
  const fan = [-0.42, -0.28, -0.14, 0, 0.14, 0.28, 0.42];
  fan.forEach((a, k) => {
    const len = 0.21 - Math.abs(a) * 0.1;
    const g = featherGeometry(len, 0.044 - Math.abs(a) * 0.012, 0.05 + Math.abs(a) * 0.03, P.tail, P.tailTip);
    g.rotateX(-0.08 - Math.abs(a) * 0.35);
    g.rotateZ(a * 1.05);
    g.translate(a * 0.03, -Math.abs(a) * 0.02, -0.004 * (k % 2));
    tailParts.push(g);
  });
  // penas da sela: curtas, marrons, deitando por cima da base do rabo
  for (const a of [-0.32, -0.1, 0.1, 0.32]) {
    const g = featherGeometry(0.1, 0.034, 0.05, P.covert, P.tail);
    g.rotateX(-0.75 - Math.abs(a) * 0.3);
    g.rotateZ(a * 1.2);
    g.translate(a * 0.05, -0.012, 0.03);
    tailParts.push(g);
  }
  tail.add(new THREE.Mesh(mergeGeometries(tailParts), featherMat()));

  // ---- asas dobradas junto do corpo (pivô no ombro: abrem para os lados e para cima); pontas escuras atrás
  const wings = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.074, 0.242, 0.05);
    const feathers = new THREE.Group();
    pivot.add(feathers);
    const g = new THREE.SphereGeometry(1, 20, 14);
    const wp = g.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      const x = wp.getX(i), y = wp.getY(i), z = wp.getZ(i);
      // gota achatada: larga no ombro, afinando para trás (as rêmiges saem em ponta)
      const taper = z < 0 ? 1 + z * 0.55 : 1;
      wp.setXYZ(i, x * 0.02, y * 0.05 * taper - 0.03 - (z < 0 ? z * z * 0.012 : 0), z * 0.1 - 0.07);
    }
    g.computeVertexNormals();
    const cw = new THREE.Color(P.wing), ctp = new THREE.Color(P.wingTip), cb = new THREE.Color(P.back);
    const wg = paint(g, (x, y, z, c) => {
      c.copy(cb).lerp(cw, clamp01((0.0 - z) / 0.08) * 0.7);
      c.lerp(ctp, Math.min(1, clamp01((-z - 0.12) / 0.05) * 0.8 + clamp01((-y - 0.065) / 0.02) * 0.25));
    });
    const m = new THREE.Mesh(wg, vcMat());
    m.position.x = sx * 0.012;
    feathers.add(m);
    body.add(pivot);
    return { pivot, feathers, sx };
  });

  // ---- pescoço com a gola de penas douradas e a cabeça (o pescoço leva a cabeça para a frente e para baixo)
  const neck = new THREE.Group();
  neck.position.set(0, 0.258, 0.09);
  body.add(neck);
  const hk = new THREE.Color(P.hackle), hkt = new THREE.Color(P.hackleTip);
  // o pescoço engrossa embaixo (a gola de penas) e se emenda no peito; dourado em cima, mais escuro embaixo
  const neckGeo = new THREE.CylinderGeometry(0.031, 0.068, 0.135, 18, 6, true);
  const np = neckGeo.attributes.position;
  for (let i = 0; i < np.count; i++) {
    const y = np.getY(i);
    // a gola estufa um pouco no terço de baixo
    const k = 1 + 0.12 * Math.max(0, 1 - Math.abs(y + 0.035) / 0.04);
    np.setXYZ(i, np.getX(i) * k, y, np.getZ(i) * k);
  }
  neckGeo.translate(0, 0.052, -0.006).rotateX(0.3);
  neckGeo.computeVertexNormals();
  neck.add(new THREE.Mesh(paint(neckGeo, (x, y, z, c) => c.copy(hkt).lerp(hk, clamp01((y + 0.0) / 0.09))), vcMat()));
  const head = new THREE.Group();
  head.position.set(0, 0.122, 0.05);
  neck.add(head);
  const skull = new THREE.Mesh(paintY(ell(0.036, 0.039, 0.047, 0, 0, 0.004, 18, 14), P.hackleTip, P.hackle, -0.04, 0.04), vcMat());
  const red = mat('#d42a22', 0.5);
  const comb = new THREE.Mesh(combGeometry(), red);
  comb.position.set(0, 0.005, 0);
  // barbelas embaixo do bico
  const wattles = new THREE.Mesh(mergeGeometries([-1, 1].map((s) => ell(0.009, 0.02, 0.012, s * 0.0075, -0.04, 0.05, 10, 8))), red);
  // bico curvo (o de cima com a pontinha para baixo), cor de chifre
  const beakMat = mat('#e8b04a', 0.4);
  const upper = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.034, 10).rotateX(Math.PI / 2 + 0.3).translate(0, 0.0, 0.062), beakMat);
  const lower = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.022, 8).rotateX(Math.PI / 2 - 0.1).translate(0, -0.011, 0.055), beakMat);
  // olho laranja com a pupila e o brilhinho (piscar)
  const irisM = mat('#e8862a', 0.3), pupilM = mat('#140e0a', 0.25), shineM = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyes = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.036, 0.01, 0.026);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), irisM);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 8, 6), pupilM);
    pupil.position.set(sx * 0.005, 0, 0.002);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 6, 4), shineM);
    sh.position.set(sx * 0.0075, 0.003, 0.004);
    g.add(iris, pupil, sh);
    return g;
  });
  head.add(skull, comb, wattles, upper, lower, ...eyes);

  // ---- patas: canela amarela com escamas lisas, três dedos para a frente e um para trás (pivô no quadril)
  const legM = mat('#e8b23a', 0.5);
  const legs = [-1, 1].map((sx) => {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.045, 0.112, 0.0);
    /** @type {THREE.BufferGeometry[]} */
    const parts = [new THREE.CylinderGeometry(0.009, 0.011, 0.105, 8).translate(0, -0.052, 0)];
    for (const a of [-0.45, 0, 0.45]) parts.push(new THREE.CapsuleGeometry(0.0048, 0.042, 2, 6).rotateX(Math.PI / 2).rotateY(a).translate(Math.sin(a) * 0.023, -0.106, Math.cos(a) * 0.023));
    parts.push(new THREE.CapsuleGeometry(0.0042, 0.018, 2, 6).rotateX(Math.PI / 2).translate(0, -0.104, -0.014));
    hip.add(new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), legM));
    rig.add(hip);
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
        leg.position.y = 0.112 + st.air * 0.03;
      });
      // corpo: balança de lado a cada passo e sobe um pouquinho; inclina correndo, bicando e no ar
      body.rotation.z = sw * 0.07 * stride;
      body.position.y = Math.abs(sw) * 0.01 * stride - st.peck * 0.01;
      body.rotation.x = 0.1 * Math.min(1, v / 1.5) + st.peck * 0.3 - st.alarm * 0.1 + st.air * 0.15 + scrape * 0.08;
      // arrepio de penas de vez em quando (parada)
      st.ruffleT -= dt;
      if (st.ruffleT <= 0 && !moving) { st.ruffleT = 5 + Math.random() * 7; st.ruffle = 1; }
      st.ruffle = Math.max(0, st.ruffle - dt * 2.2);
      const rf = st.ruffle * Math.sin(st.ruffle * 40) * 0.04;
      trunk.scale.set(1 + Math.abs(rf), 1 + Math.abs(rf) * 0.5, 1);
      // rabo: abana de lado (mais bicando e ciscando); no ar abre um pouco para trás
      tail.rotation.z = Math.sin(st.phase * TAU * 2) * 0.1 * stride + Math.sin((st.wag += dt) * 9) * 0.09 * (st.peck + st.scratch) + rf * 3;
      tail.rotation.x = -0.12 - st.air * 0.3 + st.alarm * 0.08;
      // cabeça: fica parada no ar e dá o tranco para a frente no fim de cada passo
      const hold = st.phase < 0.75 ? st.phase / 0.75 : 1 - (st.phase - 0.75) / 0.25;
      st.thrust = damp(st.thrust, moving ? hold : 0, 30, dt);
      neck.position.z = 0.09 - st.thrust * 0.045 * stride + 0.02 * st.alarm;
      neck.position.y = 0.258 + st.alarm * 0.035 - st.peck * 0.02;
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
