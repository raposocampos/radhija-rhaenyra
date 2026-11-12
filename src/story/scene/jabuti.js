// O JABUTI do quintal (o Seu Bento), no Modo História (cap. 1): um jabuti-piranga de verdade, feito só de formas. A
// carapaça em domo com os escudos desenhados por vértice (o miolo amarelo-alaranjado de cada escudo, o resto quase preto,
// as linhas de crescimento e as emendas), o plastrão creme, as quatro patas grossas de escamas vermelhas, a cabeça de
// pálpebras pesadas (sonolento), a boca que mastiga e o rabinho. Tudo lento: respira, boceja, olha devagar para quem
// chega, anda com as patas em diagonal (a carapaça balança de leve), come a folha de alface e se esconde no casco com
// um latido perto.
// createJabuti() → { object, update(dt, t), setState(name), lookAt(p | null), say(on), reset(), state, headPoint() }
//   Estados: 'cochila' (a cabeça meio para fora, olhos fechados), 'acordado' (olhos meio abertos, olhando quem chega),
//   'anda' (as patas no passo: o puzzle move o object; walkSpeed acompanha a velocidade dele), 'come' (a cabeça no chão,
//   mastigando), 'esconde' (cabeça, patas e rabo para dentro; volta devagar depois de `hideT`).
//   A origem fica no chão, no meio do colisor (raio 0,3 m: nada dele passa disso); ele olha para +Z.
import * as THREE from 'three';

const { clamp, lerp, smoothstep: ss } = THREE.MathUtils;
const TAU = Math.PI * 2;

/** As cores do jabuti-piranga. */
const COL = {
  dark: new THREE.Color('#2a1d14'), seam: new THREE.Color('#120b07'), areola: new THREE.Color('#e3a43c'), ring: new THREE.Color('#5a3a1e'),
  plastron: new THREE.Color('#e8cf8e'), skin: new THREE.Color('#3b2b22'), scale: new THREE.Color('#d6552a'), nail: new THREE.Color('#d9c9a8'),
  yellow: new THREE.Color('#e9b046'), eye: new THREE.Color('#141010'), glint: new THREE.Color('#ffffff'),
};
/** Medidas da carapaça (meia largura, meio comprimento, altura) e onde ela começa. */
const SHELL = { rx: 0.19, rz: 0.215, h: 0.165, y0: 0.075 };

/** Os centros dos escudos, vistos de cima, na carapaça normalizada (−1..1): vertebrais, costais e marginais. */
const SCUTES = (() => {
  const out = [];
  for (const z of [-0.6, -0.3, 0, 0.3, 0.6]) out.push([0, z]);
  for (const s of [-1, 1]) for (const z of [-0.44, -0.15, 0.15, 0.44]) out.push([s * 0.47, z]);
  for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU; out.push([Math.sin(a) * 0.93, Math.cos(a) * 0.93]); }
  return out;
})();

/** Pinta uma geometria por vértice: fn(posição, normal) → Color. */
function paintBy(g, fn) {
  const p = g.attributes.position, n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (n) nn.fromBufferAttribute(n, i);
    const c = fn(v, nn);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

/** A carapaça: o domo achatado com a borda um pouco virada para fora, pintado escudo por escudo. */
function shellGeo() {
  const g = new THREE.SphereGeometry(1, 44, 16, 0, TAU, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // a beirada (y perto de 0) abre um pouco: as marginais viradas para fora, como no bicho
    const flare = 1 + 0.07 * (1 - ss(y, 0, 0.35));
    // o alto achatado no meio (o domo do jabuti é mais alto atrás do meio)
    const hump = 1 + 0.08 * Math.max(0, -z) * y;
    p.setXYZ(i, x * SHELL.rx * flare, y * SHELL.h * hump, z * SHELL.rz * flare);
  }
  g.computeVertexNormals();
  const c = new THREE.Color();
  return paintBy(g, (v) => {
    const nx = v.x / SHELL.rx, nz = v.z / SHELL.rz;
    let d1 = 9, d2 = 9;
    for (const [sx, sz] of SCUTES) {
      const d = Math.hypot(nx - sx, nz - sz);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    const seam = ss(d2 - d1, 0.0, 0.07);
    c.copy(COL.dark);
    // as linhas de crescimento (anéis em volta do miolo) e o miolo amarelo-alaranjado de cada escudo
    c.lerp(COL.ring, 0.35 * (0.5 + 0.5 * Math.sin(d1 * 70)) * (1 - ss(d1, 0.1, 0.28)));
    c.lerp(COL.areola, 1 - ss(d1, 0.07, 0.13));
    c.multiplyScalar(0.92 + 0.16 * hash(Math.round(nx * 9), Math.round(nz * 9)));
    return c.lerp(COL.seam, 1 - seam);
  });
}

/** Elipsoide (esfera esticada) com a base na origem do grupo dela. */
const ellipsoid = (rx, ry, rz, w = 14, h = 10) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
/** Junta peças já pintadas numa geometria só. */
function merge(parts) {
  let pos = [], nor = [], col = [];
  for (const g0 of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos = pos.concat(Array.from(g.attributes.position.array));
    nor = nor.concat(Array.from(g.attributes.normal.array));
    col = col.concat(Array.from(g.attributes.color.array));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
/** Pele de escamas: o marrom-escuro com as escamas vermelho-alaranjadas espalhadas (pernas e pescoço). */
function scaly(g, seed, amount = 0.45) {
  const c = new THREE.Color();
  return paintBy(g, (v) => {
    const k = hash(Math.round(v.x * 90 + seed), Math.round(v.y * 90) + Math.round(v.z * 90) * 7);
    c.copy(COL.skin).lerp(COL.scale, k > 1 - amount ? 0.85 : 0.08 * k);
    return c;
  });
}

export function createJabuti() {
  const object = new THREE.Group();
  object.name = 'jabuti:seu-bento';
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  const shellMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.02 });
  const mesh = (g, name, m = mat) => { const o = new THREE.Mesh(g, m); o.name = name; o.castShadow = true; o.receiveShadow = true; return o; };

  // ---------------------------------------------------------------- o corpo (carapaça e plastrão): balança no passo
  const body = new THREE.Group();
  body.name = 'jabuti:corpo';
  object.add(body);
  const shell = mesh(shellGeo(), 'jabuti:carapaca', shellMat);
  shell.position.y = SHELL.y0;
  body.add(shell);
  {
    // o plastrão por baixo (creme, com as emendas) e a pele entre o casco e as patas
    const plas = paintBy(new THREE.CylinderGeometry(SHELL.rx * 0.93, SHELL.rx * 0.86, 0.03, 24).scale(1, 1, SHELL.rz / SHELL.rx), (v) => COL.plastron.clone().multiplyScalar(Math.abs(v.z) % 0.06 < 0.006 || Math.abs(v.x) < 0.004 ? 0.7 : 1));
    plas.translate(0, SHELL.y0 - 0.005, 0);
    const skin = scaly(ellipsoid(SHELL.rx * 0.82, 0.04, SHELL.rz * 0.82), 3, 0.2);
    skin.translate(0, SHELL.y0 + 0.012, 0);
    body.add(mesh(merge([plas, skin]), 'jabuti:plastrao'));
  }

  // ---------------------------------------------------------------- o pescoço e a cabeça (saem e entram do casco)
  const neck = new THREE.Group();
  neck.name = 'jabuti:pescoco';
  neck.position.set(0, SHELL.y0 + 0.042, SHELL.rz * 0.78);
  body.add(neck);
  {
    const n = scaly(new THREE.CylinderGeometry(0.034, 0.042, 0.1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.04), 7, 0.35);
    neck.add(mesh(n, 'jabuti:pescoco-pele'));
  }
  const head = new THREE.Group();
  head.name = 'jabuti:cabeca';
  head.position.set(0, 0.012, 0.06);
  neck.add(head);
  {
    // o crânio arredondado e o focinho rombudo; em cima, as escamas amarelas do jabuti-piranga (a ponta do focinho fica
    // dentro do raio de 0,3 m do colisor, com o pescoço todo esticado)
    const skull = ellipsoid(0.042, 0.036, 0.048);
    skull.translate(0, 0.006, 0.012);
    paintBy(skull, (v) => {
      const top = ss(v.y, 0.012, 0.04);
      const k = hash(Math.round(v.x * 120), Math.round(v.z * 120));
      return COL.skin.clone().lerp(COL.yellow, top * (k > 0.45 ? 0.85 : 0.35)).lerp(COL.scale, (1 - top) * (k > 0.8 ? 0.6 : 0));
    });
    const beak = paintBy(ellipsoid(0.03, 0.016, 0.018).translate(0, -0.006, 0.048), () => COL.skin.clone().multiplyScalar(0.8));
    head.add(mesh(merge([skull, beak]), 'jabuti:cranio'));
  }
  // a mandíbula (mastiga e fala)
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.012, 0.004);
  head.add(jaw);
  jaw.add(mesh(paintBy(ellipsoid(0.03, 0.012, 0.04).translate(0, -0.006, 0.026), () => COL.skin.clone().lerp(COL.plastron, 0.25)), 'jabuti:boca'));
  // os olhos (pretos, com o brilhinho) e as pálpebras pesadas
  /** @type {THREE.Group[]} */
  const lids = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.03, 0.016, 0.034);
    head.add(eye);
    const ball = paintBy(new THREE.SphereGeometry(0.0095, 10, 8), () => COL.eye);
    const glint = paintBy(new THREE.SphereGeometry(0.003, 6, 4).translate(s * 0.002, 0.004, 0.008), () => COL.glint);
    eye.add(mesh(merge([ball, glint]), `jabuti:olho-${s < 0 ? 'e' : 'd'}`));
    const lid = new THREE.Group();
    eye.add(lid);
    // meia casca de pele que desce sobre o olho (giro em x: 0 aberto, ~1,5 fechado)
    lid.add(mesh(paintBy(new THREE.SphereGeometry(0.0115, 10, 6, 0, TAU, 0, Math.PI * 0.55).rotateX(-0.25), () => COL.skin.clone().lerp(COL.yellow, 0.15)), 'jabuti:palpebra'));
    lids.push(lid);
  }

  // ---------------------------------------------------------------- as patas (diagonais no passo) e o rabinho
  /** @type {{ g: THREE.Group, base: THREE.Vector3, front: boolean, side: number, phase: number }[]} */
  const legs = [];
  for (const [sx, sz, front] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]]) {
    const g = new THREE.Group();
    const base = new THREE.Vector3(sx * SHELL.rx * 0.66, SHELL.y0 + 0.013, sz * SHELL.rz * 0.6);
    g.position.copy(base);
    body.add(g);
    // a pata de elefante: um tronco de cone grosso, com as unhas claras na frente
    const leg = scaly(new THREE.CylinderGeometry(front ? 0.036 : 0.04, front ? 0.042 : 0.046, 0.085, 10).translate(0, -0.04, 0), 11 + sx * 3 + sz, 0.5);
    const nails = [];
    for (let k = -1; k <= 1; k++) nails.push(paintBy(new THREE.ConeGeometry(0.008, 0.016, 5).rotateX(Math.PI / 2).translate(k * 0.016, -0.078, 0.034), () => COL.nail));
    g.add(mesh(merge([leg, ...nails]), 'jabuti:pata'));
    // diagonal: a da frente esquerda com a de trás direita
    legs.push({ g, base, front, side: sx, phase: (sx * sz > 0 ? 0 : 0.5) });
  }
  const tail = new THREE.Group();
  tail.position.set(0, SHELL.y0 + 0.02, -SHELL.rz * 0.9);
  body.add(tail);
  tail.add(mesh(scaly(new THREE.ConeGeometry(0.018, 0.05, 7).rotateX(-Math.PI / 2).translate(0, 0, -0.02), 21, 0.3), 'jabuti:rabo'));

  // ---------------------------------------------------------------- o estado e a animação
  const S = {
    state: 'cochila', t: 0, stateT: 0, walk: 0, walkPh: 0, out: 0.55, outGoal: 0.55, lid: 1, lidGoal: 1, blinkT: 2.5,
    look: /** @type {null | { x: number, y: number, z: number }} */ (null), yawHead: 0, pitchHead: 0, talk: false, jawK: 0,
    yawnT: 6, yawn: 0, hideT: 0, eat: 0, speed: 0, prevX: 0, prevZ: 0, first: true,
  };
  const _w = new THREE.Vector3();
  /** O estado: 'cochila' | 'acordado' | 'anda' | 'come' | 'esconde'. */
  function setState(name) {
    if (name === S.state) return;
    S.state = name;
    S.stateT = 0;
    if (name === 'esconde') S.hideT = 2.6;
  }

  function update(dt, t) {
    S.t = t;
    S.stateT += dt;
    // a velocidade de verdade (o puzzle move o object): o passo acompanha
    if (S.first) { S.prevX = object.position.x; S.prevZ = object.position.z; S.first = false; }
    const v = dt > 0 ? Math.hypot(object.position.x - S.prevX, object.position.z - S.prevZ) / dt : 0;
    S.prevX = object.position.x;
    S.prevZ = object.position.z;
    S.speed += (v - S.speed) * Math.min(1, dt * 8);
    const st = S.state;
    // quanto a cabeça fica para fora e quanto o olho abre
    if (st === 'esconde') {
      S.hideT -= dt;
      S.outGoal = S.hideT > 0 ? 0 : 0.55;
      if (S.hideT <= -1.2) setState('acordado');
    } else S.outGoal = st === 'cochila' ? 0.45 : st === 'come' ? 1.0 : 0.85;
    S.out += (S.outGoal - S.out) * Math.min(1, dt * (S.outGoal < S.out ? 9 : 1.2));
    S.lidGoal = st === 'cochila' ? 1 : st === 'esconde' ? 1 : st === 'come' ? 0.55 : 0.5;
    // piscadas lentas quando acordado
    S.blinkT -= dt;
    let blink = 0;
    if (st !== 'cochila' && S.blinkT < 0) { blink = Math.sin(clamp(-S.blinkT / 0.45, 0, 1) * Math.PI); if (S.blinkT < -0.45) S.blinkT = 3 + hash(t, 3) * 3; }
    S.lid += (S.lidGoal - S.lid) * Math.min(1, dt * 3);
    const lidK = clamp(S.lid + blink * (1 - S.lid), 0, 1);
    for (const l of lids) l.rotation.x = lerp(-0.2, 1.45, lidK);
    // o passo: patas em diagonal, devagar (ciclo de ~1,4 s a 0,22 m/s)
    const walking = st === 'anda' || S.speed > 0.03;
    S.walk += ((walking ? 1 : 0) - S.walk) * Math.min(1, dt * 4);
    S.walkPh += dt * (0.25 + S.speed * 3.0) * S.walk;
    // o corpo: a respiração (devagar, só para cima) e, andando, o balanço de lado e o sobe-desce do passo
    const tuck = 1 - clamp(S.out / 0.55, 0, 1);
    const breath = (Math.sin(t * 1.1) + 1) * 0.0012;
    body.position.y = breath + Math.abs(Math.sin(S.walkPh * TAU)) * 0.006 * S.walk - tuck * 0.03;
    body.rotation.z = Math.sin(S.walkPh * TAU) * 0.03 * S.walk;
    body.rotation.x = Math.cos(S.walkPh * TAU * 2) * 0.01 * S.walk;
    const sz = Math.sin(body.rotation.z), sx = Math.sin(body.rotation.x);
    for (const L of legs) {
      const ph = (S.walkPh + L.phase) * TAU;
      const lift = Math.max(0, Math.sin(ph)) * 0.016 * S.walk;
      const swing = Math.cos(ph) * 0.022 * S.walk;
      // o pé no chão mesmo com o casco balançando (o giro do corpo compensado em cada pata); escondido, as patas sobem
      // para dentro do casco
      const rx = -Math.cos(ph) * 0.16 * S.walk;
      const comp = -L.base.x * sz + L.base.z * sx + Math.abs(Math.sin(rx)) * 0.048;
      L.g.position.set(L.base.x * (1 - tuck * 0.25), L.base.y + lift + tuck * 0.05 + comp, L.base.z + swing);
      L.g.rotation.x = rx;
    }
    // a cabeça: sai e entra (o pescoço estica), olha devagar para quem chega, boceja de vez em quando, come no chão
    neck.position.z = SHELL.rz * lerp(0.42, 0.78, clamp(S.out, 0, 1));
    neck.scale.setScalar(lerp(0.75, 1, clamp(S.out, 0, 1)));
    let wantYaw = 0, wantPitch = st === 'cochila' ? 0.22 : 0;
    if (S.look && st !== 'come' && st !== 'esconde') {
      object.updateWorldMatrix(true, false);
      _w.set(S.look.x, S.look.y, S.look.z);
      object.worldToLocal(_w);
      wantYaw = clamp(Math.atan2(_w.x, _w.z - 0.2), -0.7, 0.7);
      wantPitch = clamp(-Math.atan2(_w.y - 0.15, Math.hypot(_w.x, _w.z)), -0.45, 0.3);
    }
    if (st === 'come') wantPitch = 0.5 + Math.sin(t * 2.2) * 0.04;
    S.yawHead += (wantYaw - S.yawHead) * Math.min(1, dt * 1.6);
    S.pitchHead += (wantPitch - S.pitchHead) * Math.min(1, dt * 2);
    S.yawnT -= dt;
    if (S.yawnT < 0 && (st === 'cochila' || st === 'acordado')) { S.yawn = Math.min(1, S.yawn + dt / 0.9); if (S.yawnT < -2.4) { S.yawnT = 7 + hash(t, 9) * 6; } } else S.yawn = Math.max(0, S.yawn - dt / 0.6);
    const yawnK = Math.sin(clamp(S.yawn, 0, 1) * Math.PI);
    neck.rotation.y = S.yawHead;
    neck.rotation.x = S.pitchHead - yawnK * 0.35;
    // a boca: fala, mastiga (comendo) e o bocejo
    const chew = st === 'come' ? Math.max(0, Math.sin(t * 5.5)) * 0.35 : 0;
    const talk = S.talk ? Math.max(0, Math.sin(t * 7.0)) * 0.3 : 0;
    jaw.rotation.x = Math.max(chew, talk, yawnK * 0.55);
    tail.rotation.y = Math.sin(t * 0.7) * 0.15 * (1 - S.walk) + Math.sin(S.walkPh * TAU) * 0.2 * S.walk;
  }

  /** Onde fica a cabeça (o balão das falas), no mundo. */
  const _h = new THREE.Vector3();
  function headPoint() {
    head.updateWorldMatrix(true, false);
    return head.localToWorld(_h.set(0, 0.06, 0.02));
  }

  return {
    object,
    update,
    setState,
    get state() { return S.state; },
    /** Olha para um ponto do mundo (ou para a frente, com null). */
    lookAt(p) { S.look = p ? { x: p.x, y: p.y ?? 0.3, z: p.z } : null; },
    /** A boca mexe (falando). */
    say(on) { S.talk = !!on; },
    headPoint,
    reset() {
      S.state = 'cochila'; S.stateT = 0; S.walk = 0; S.walkPh = 0; S.out = 0.45; S.lid = 1; S.look = null; S.talk = false;
      S.yawHead = 0; S.pitchHead = 0.22; S.yawn = 0; S.yawnT = 6; S.hideT = 0; S.speed = 0; S.first = true;
      update(0, 0);
    },
    dispose() {
      object.traverse((o) => { const m = /** @type {THREE.Mesh} */ (o); if (m.isMesh) m.geometry.dispose(); });
      mat.dispose();
      shellMat.dispose();
    },
  };
}
