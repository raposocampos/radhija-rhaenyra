// O gato Bichano (fase 9): um gato laranja rajado, procedural, com corpo, cabeça, orelhas, focinho, bigodes, quatro
// patas de dois gomos e um rabo de oito gomos que curva. Sem esqueleto de malha: cada parte é um grupo com pivô na
// articulação (cabeça no pescoço, coxa no quadril…), então a pose é só rotação de grupos.
//   setPose({ x, y, z, yaw, mode, k }): mode 'sleep' (enroladinho no alto do armário), 'wake' (k 0..1: levanta a
//   cabeça, abre os olhos bravo, se espreguiça), 'jump' (k 0..1: o salto, esticado), 'walk' (k = metros andados: o
//   passo e o rabo em pé de quem foi ofendido), 'sit' (k 0..1: chega na almofada, senta e depois volta a dormir).
//   update(dt, t): respiração, piscadas, pontinha do rabo. ~0,42 m do focinho ao quadril.
import * as THREE from 'three';
import { canvasTexture } from './util.js';

const TAU = Math.PI * 2;
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Pelagem rajada: listras escuras transversais sobre laranja, barriga mais clara (UV da esfera: u em volta, v de cima a baixo). */
function tabbyTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#d98a3c');
    grd.addColorStop(0.55, '#e79a4c');
    grd.addColorStop(0.8, '#f3cf9e');
    grd.addColorStop(1, '#fbe6c8');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,72,22,0.55)';
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * w;
      g.lineWidth = 5 + (i % 3) * 2;
      g.beginPath();
      g.moveTo(x, 4);
      g.bezierCurveTo(x + 8, h * 0.2, x - 6, h * 0.38, x + 4, h * 0.55);
      g.stroke();
    }
  });
}

export function createCat() {
  const root = new THREE.Group();
  root.name = 'bichano';
  const tex = tabbyTexture();
  const fur = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color('#ffd9a8'), sheenRoughness: 0.6 });
  const furPlain = new THREE.MeshPhysicalMaterial({ color: '#df9346', roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color('#ffd9a8') });
  const cream = new THREE.MeshPhysicalMaterial({ color: '#f8e2c2', roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') });
  const pink = new THREE.MeshStandardMaterial({ color: '#e8908f', roughness: 0.5 });
  const dark = new THREE.MeshPhysicalMaterial({ color: '#141008', roughness: 0.15, clearcoat: 1 });
  const iris = new THREE.MeshPhysicalMaterial({ color: '#9bc23a', roughness: 0.2, clearcoat: 1, emissive: '#2a3a08', emissiveIntensity: 0.3 });

  // corpo: pivô no meio do tronco
  const body = new THREE.Group();
  body.position.y = 0.16;
  root.add(body);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 18), fur);
  torso.scale.set(0.95, 0.9, 1.75);
  torso.rotation.x = 0;
  body.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12), cream);
  chest.scale.set(1, 1.1, 0.8);
  chest.position.set(0, -0.02, 0.12);
  body.add(chest);
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 12), fur);
  haunch.scale.set(1.08, 1, 1.1);
  haunch.position.set(0, -0.005, -0.1);
  body.add(haunch);

  // cabeça: pivô no pescoço
  const neck = new THREE.Group();
  neck.position.set(0, 0.04, 0.15);
  body.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.06, 0.03);
  neck.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), fur);
  skull.scale.set(1.08, 0.92, 0.95);
  head.add(skull);
  const cheeks = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), cream);
  cheeks.scale.set(1.25, 0.75, 0.85);
  cheeks.position.set(0, -0.025, 0.04);
  head.add(cheeks);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), pink);
  nose.scale.set(1.3, 0.8, 0.8);
  nose.position.set(0, -0.006, 0.083);
  head.add(nose);
  // orelhas (cones achatados com o miolo rosa): pivô na base
  const ears = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * 0.042, 0.05, -0.005);
    ear.rotation.z = -sx * 0.25;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4, 1), furPlain);
    outer.rotation.y = Math.PI / 4;
    outer.scale.set(1, 1, 0.5);
    outer.position.y = 0.026;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.04, 4, 1), pink);
    inner.rotation.y = Math.PI / 4;
    inner.scale.set(1, 1, 0.35);
    inner.position.set(0, 0.022, 0.009);
    ear.add(outer, inner);
    head.add(ear);
    ears.push(ear);
  }
  // olhos: íris verde, pupila vertical e pálpebra (achata para fechar)
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.03, 0.012, 0.064);
    eye.rotation.y = sx * 0.3;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), iris);
    ball.scale.set(1, 1, 0.6);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), dark);
    pupil.scale.set(0.45, 1.25, 0.5);
    pupil.position.z = 0.007;
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    glint.position.set(-0.004, 0.005, 0.009);
    eye.add(ball, pupil, glint);
    // pálpebra: semiesfera da cor do pelo que desce sobre o olho
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 14, 8, 0, TAU, 0, Math.PI / 2), furPlain);
    lid.position.z = 0.001;
    eye.add(lid);
    head.add(eye);
    eyes.push({ eye, lid, ball });
  }
  // boquinha e bigodes
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0015, 4, 10, Math.PI), new THREE.MeshStandardMaterial({ color: '#5a2e1a' }));
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.022, 0.078);
  head.add(mouth);
  const whiskerMat = new THREE.MeshBasicMaterial({ color: '#fff8ee' });
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0004, 0.07, 3).rotateZ(Math.PI / 2), whiskerMat);
    w.position.set(sx * 0.05, -0.012 - i * 0.006, 0.07);
    w.rotation.set(0, sx * 0.25, sx * (0.12 - i * 0.12));
    head.add(w);
  }

  // patas: dois gomos (coxa e canela) com a patinha creme; pivô no ombro/quadril e no joelho
  const legs = [];
  const legDefs = [
    { x: 0.05, z: 0.11, front: true }, { x: -0.05, z: 0.11, front: true },
    { x: 0.055, z: -0.11, front: false }, { x: -0.055, z: -0.11, front: false },
  ];
  for (const d of legDefs) {
    const hip = new THREE.Group();
    hip.position.set(d.x, -0.03, d.z);
    body.add(hip);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(d.front ? 0.022 : 0.03, 0.06, 4, 10), fur);
    upper.position.y = -0.04;
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.075;
    hip.add(knee);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.05, 4, 10), furPlain);
    lower.position.y = -0.03;
    knee.add(lower);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), cream);
    paw.scale.set(1, 0.6, 1.3);
    paw.position.set(0, -0.062, 0.008);
    knee.add(paw);
    legs.push({ ...d, hip, knee });
  }

  // rabo: oito gomos encadeados (cada um gira em relação ao anterior), ponta mais escura
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.03, -0.17);
  body.add(tailRoot);
  const tail = [];
  let parent = tailRoot;
  const SEGS = 8;
  for (let i = 0; i < SEGS; i++) {
    const seg = new THREE.Group();
    if (i > 0) seg.position.z = -0.032;
    const r = 0.017 - i * 0.0009;
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.022, 4, 8).rotateX(Math.PI / 2), i >= SEGS - 2 ? new THREE.MeshPhysicalMaterial({ color: '#a8561e', roughness: 0.85, sheen: 0.5 }) : furPlain);
    m.position.z = -0.016;
    seg.add(m);
    parent.add(seg);
    parent = seg;
    tail.push(seg);
  }
  root.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });

  const S = { mode: 'sleep', k: 0, t: 0, sitT: 0, blinkT: 2, blink: 0 };

  /** Pose do rabo: curva base (rad por gomo), balanço e levantar a base. */
  function poseTail(raise, curl, sway, t) {
    tail.forEach((seg, i) => {
      const w = Math.sin(t * 1.6 - i * 0.55) * sway * (i / SEGS);
      seg.rotation.set(i === 0 ? -raise : curl * (i < 3 ? 0.4 : 1), w, 0);
    });
  }
  /** Patas: ângulo da coxa e do joelho por pata (rad; + = para a frente). */
  function poseLegs(fn) {
    legs.forEach((l, i) => {
      const [h, k] = fn(l, i);
      l.hip.rotation.x = h;
      l.knee.rotation.x = k;
    });
  }
  function setEyes(open) {
    for (const e of eyes) {
      // pálpebra fechada = semiesfera girada para frente cobrindo o olho
      e.lid.rotation.x = lerp(Math.PI / 2 + 0.05, -0.15, open);
      e.lid.visible = open < 0.98;
    }
  }

  function apply(t) {
    const { mode, k } = S;
    // valores padrão: em pé
    let bodyY = 0.16, bodyPitch = 0, bodyRoll = 0, headPitch = 0, headYaw = 0, headRoll = 0, neckPitch = 0;
    let eyesOpen = 1, earsBack = 0;
    let tailRaise = 0.4, tailCurl = 0.1, tailSway = 0.3;
    /** @type {(leg: { front: boolean }, i: number) => number[]} */
    let legFn = () => [0, 0];
    const breathe = Math.sin(t * 2.1) * 0.004;
    if (mode === 'sleep' || (mode === 'sit' && S.sitT > 2.2)) {
      // enroladinho: corpo baixo, cabeça deitada nas patas, rabo em volta
      const curl = mode === 'sit' ? smooth((S.sitT - 2.2) / 1.2) : 1;
      bodyY = lerp(0.1, 0.075, curl);
      bodyRoll = 0.25 * curl;
      headPitch = 0.45 * curl;
      headYaw = 0.5 * curl;
      neckPitch = 0.35 * curl;
      eyesOpen = 1 - curl;
      tailRaise = -0.6;
      tailCurl = 0.42 * curl;
      tailSway = 0.02;
      legFn = (l) => (l.front ? [1.25 * curl, -1.6 * curl] : [-0.9, 2.0]);
      torso.scale.y = 0.9 + breathe * 8;
    } else if (mode === 'wake') {
      // levanta a cabeça, abre os olhos bravo e se espreguiça (dianteiras para a frente, garupa para cima)
      const lift = smooth(k / 0.3);
      const stretch = smooth((k - 0.35) / 0.3) * (1 - smooth((k - 0.75) / 0.25));
      bodyY = lerp(0.075, 0.15, smooth((k - 0.2) / 0.5));
      bodyPitch = stretch * 0.35;
      headPitch = lerp(0.45, -0.1, lift) + stretch * -0.2;
      headYaw = lerp(0.5, 0.25, lift);
      eyesOpen = smooth((k - 0.1) / 0.25) * 0.55; // olhos meio fechados: ofendido
      earsBack = smooth((k - 0.2) / 0.3) * 0.6;
      tailRaise = lerp(-0.6, 0.2, k);
      tailCurl = 0.2;
      tailSway = 0.6 * k;
      legFn = (l) => (l.front ? [lerp(1.25, 0.9 * stretch, lift), lerp(-1.6, -0.2 * stretch, lift)] : [lerp(-0.9, -0.3, lift), lerp(2.0, 0.7, lift)]);
    } else if (mode === 'jump') {
      // esticado no ar: dianteiras para a frente, traseiras para trás, rabo para equilibrar
      const ext = Math.sin(Math.PI * k);
      bodyY = 0.16;
      bodyPitch = lerp(-0.25, 0.35, k);
      headPitch = -0.15;
      eyesOpen = 0.65;
      earsBack = 0.5;
      tailRaise = 0.1;
      tailCurl = -0.05;
      tailSway = 0.1;
      legFn = (l) => (l.front ? [0.7 * ext + 0.3 * k, -0.2] : [-0.8 * ext, 0.5]);
    } else if (mode === 'walk') {
      // passo de gato (diagonais) e o rabo em pé com a pontinha curva: de nariz em pé
      const ph = k * 6.2;
      bodyY = 0.16 + Math.abs(Math.sin(ph)) * 0.006;
      headPitch = -0.12 + Math.sin(ph * 2) * 0.02;
      eyesOpen = 0.6;
      earsBack = 0.35;
      tailRaise = 1.25;
      tailCurl = 0.18;
      tailSway = 0.25;
      legFn = (l, i) => {
        const p = ph + (i === 0 || i === 3 ? 0 : Math.PI);
        const sw = Math.sin(p) * 0.45;
        return [sw, Math.max(0, -Math.cos(p)) * (l.front ? -0.5 : 0.6)];
      };
    } else if (mode === 'sit') {
      // chega e senta na almofada (depois volta a dormir: S.sitT > 2,2 cai no ramo de dormir acima)
      const s = smooth(S.sitT / 0.6);
      bodyY = lerp(0.16, 0.13, s);
      bodyPitch = -0.55 * s;
      headPitch = 0.55 * s - 0.1;
      eyesOpen = lerp(0.6, 0.3, smooth((S.sitT - 1) / 1));
      tailRaise = lerp(1.2, -0.5, s);
      tailCurl = 0.3 * s;
      tailSway = 0.1;
      legFn = (l) => (l.front ? [0.55 * s, -0.1 * s] : [-1.2 * s, 2.2 * s]);
    }
    body.position.y = bodyY;
    body.rotation.set(bodyPitch, 0, bodyRoll);
    neck.rotation.x = neckPitch;
    head.rotation.set(headPitch, headYaw, headRoll);
    for (const [i, e] of ears.entries()) e.rotation.x = -earsBack * 0.8 * (i ? 1 : 1);
    poseLegs(legFn);
    poseTail(tailRaise, tailCurl, tailSway, t);
    // piscadas (só com os olhos abertos)
    const blinkK = S.blink > 0 ? Math.sin(Math.PI * Math.min(1, S.blink / 0.15)) : 0;
    setEyes(eyesOpen * (1 - blinkK));
  }

  const obj = {
    object: root,
    /** @param {{ x: number, y?: number, z: number, yaw?: number, mode: string, k?: number }} p */
    setPose(p) {
      root.position.set(p.x, p.y ?? 0, p.z);
      if (p.yaw != null) root.rotation.y = p.yaw;
      if (p.mode !== S.mode) {
        S.mode = p.mode;
        S.sitT = 0;
      }
      S.k = p.k ?? 0;
      apply(S.t);
    },
    /** @param {number} dt @param {number} t */
    update(dt, t) {
      S.t = t;
      if (S.mode === 'sit') S.sitT += dt;
      S.blinkT -= dt;
      if (S.blinkT <= 0) { S.blink = 0.0001; S.blinkT = 2.5 + Math.random() * 3; }
      if (S.blink > 0) { S.blink += dt; if (S.blink > 0.15) S.blink = 0; }
      apply(t);
    },
    get mode() { return S.mode; },
  };
  apply(0);
  return obj;
}
