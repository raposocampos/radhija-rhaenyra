// Cachorrinhas procedurais — Radhija & Rhaenyra.
// Malha: SDF (união suave) → Surface Nets → SkinnedMesh com pesos automáticos + cascas de pelo.
// Animação: procedural (trote com pés plantados via IK, galope na arrancada, ações do contrato).
// API: ver docs/CONTRATO.md → "dogs/dog.js".
import * as THREE from 'three';
import { DOGS } from '../level/layout.js';
import { buildDogGeometry, BONE_NAMES, BONE_INDEX, boneParent } from './dogModel.js';
import { createFurMaterial } from './furMaterial.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);
const SIT_PITCH = 0.62; // inclinação da coluna sentada (rad)
const SIT_HIPS = 0.0; // flexão extra da garupa sentada

let shadowTex = null;
function contactShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(0.35, 'rgba(0,0,0,0.75)');
  grd.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shadowTex;
}

// pequena cenoura de pelúcia para testes (sandbox); o jogo usa a do cenário
export function createPlushCarrot(len = 0.28) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.008, len * 0.8, 14, 4).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#f07a1a', roughness: 0.85 }),
  );
  body.position.x = len * 0.06;
  const leaf = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, len * 0.22, 8).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#4c9a3a', roughness: 0.9 }),
  );
  leaf.position.x = -len * 0.43;
  g.add(body, leaf);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createDog(kind) {
  const cfg = DOGS[kind];
  const G = buildDogGeometry(kind);
  const { P, design } = G;
  const s = P.s;

  const object = new THREE.Group();
  object.name = kind;
  const inner = new THREE.Group(); // giro/pulos da comemoração
  object.add(inner);

  // ------------------------------------------------------------------ esqueleto
  const nB = BONE_NAMES.length;
  const parentIdx = BONE_NAMES.map((n) => (boneParent(n) ? BONE_INDEX[boneParent(n)] : -1));
  const rest = BONE_NAMES.map((n) => new THREE.Vector3(...design.bones[n]));
  const restOff = rest.map((r, i) => (parentIdx[i] < 0 ? r.clone() : r.clone().sub(rest[parentIdx[i]])));
  const bones = BONE_NAMES.map((n, i) => {
    const b = new THREE.Bone();
    b.name = n;
    b.position.copy(restOff[i]);
    return b;
  });
  bones.forEach((b, i) => (parentIdx[i] < 0 ? inner.add(b) : bones[parentIdx[i]].add(b)));
  inner.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const BI = BONE_INDEX;

  // ------------------------------------------------------------------ materiais e malhas
  const skinMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    sheen: 1.0,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(P.colors.body).multiplyScalar(0.55),
  });
  // "subsurface" barato: um pouco da cor base volta como emissão quente (pele clara não fica azulada na sombra)
  const wetU = { value: 0 }; // 0..1 molhada: pele mais escura e brilhante
  skinMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = wetU;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWet;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(1.0, 0.7, uWet);')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.16, 0.12, 0.08) * (1.0 - 0.45 * uWet);',
      );
  };
  skinMat.customProgramCacheKey = () => 'dogSkin_v2';
  const furMat = createFurMaterial({ strandFreq: P.strandFreq / s, gravity: 0.32 });
  const bodyMesh = new THREE.SkinnedMesh(G.bodyGeo, skinMat);
  const earMesh = new THREE.SkinnedMesh(G.earGeo, skinMat);
  const furMesh = new THREE.SkinnedMesh(G.furGeo, furMat);
  for (const m of [bodyMesh, earMesh, furMesh]) {
    m.bind(skeleton);
    m.frustumCulled = false;
    inner.add(m);
  }
  bodyMesh.castShadow = earMesh.castShadow = true;
  bodyMesh.receiveShadow = earMesh.receiveShadow = furMesh.receiveShadow = true;
  furMesh.renderOrder = 1;

  // ------------------------------------------------------------------ rosto (filhos do osso da cabeça)
  const headBone = bones[BI.head];
  const headRest = rest[BI.head];
  const toHead = (p) => new THREE.Vector3(p[0], p[1], p[2]).sub(headRest);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#140b07', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const noseMat = new THREE.MeshPhysicalMaterial({ color: '#16100e', roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.18 });
  const lipMat = new THREE.MeshStandardMaterial({ color: '#2a1b17', roughness: 0.55 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: '#d8707a', roughness: 0.45 });
  const eyeR = design.face.eyeR;
  const eyeGeo = new THREE.SphereGeometry(eyeR, 28, 18);
  const catchGeo = new THREE.CircleGeometry(eyeR * 0.3, 16);
  const catch2Geo = new THREE.CircleGeometry(eyeR * 0.13, 12);
  const eyes = [];
  for (const side of [1, -1]) {
    const e = design.face.eyeL;
    const grp = new THREE.Group();
    grp.position.copy(toHead([e[0] * side, e[1], e[2]]));
    // olhar levemente para fora
    grp.rotation.y = side * 0.32;
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    grp.add(eye);
    const dir = new THREE.Vector3(-0.28 * side, 0.42, 0.86).normalize(); // reflexo de luz (em cima, para dentro)
    const c1 = new THREE.Mesh(catchGeo, catchMat);
    c1.position.copy(dir).multiplyScalar(eyeR * 1.01);
    c1.lookAt(dir.clone().multiplyScalar(2));
    const dir2 = new THREE.Vector3(0.22 * side, -0.3, 0.93).normalize();
    const c2 = new THREE.Mesh(catch2Geo, catchMat);
    c2.position.copy(dir2).multiplyScalar(eyeR * 1.01);
    c2.lookAt(dir2.clone().multiplyScalar(2));
    grp.add(c1, c2);
    headBone.add(grp);
    eyes.push(grp);
  }
  // nariz de botão
  const noseGeo = new THREE.SphereGeometry(design.face.noseR, 28, 18);
  {
    const p = noseGeo.attributes.position;
    const r = design.face.noseR;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      x *= 1.28;
      y *= y > 0 ? 0.92 : 0.78;
      z *= 0.85;
      // narinas: leve afundamento
      for (const sx of [1, -1]) {
        const dx = x - sx * r * 0.5, dy = y + r * 0.12, dz = z - r * 0.8;
        const dd = (dx * dx + dy * dy * 1.5 + dz * dz) / (r * r * 0.09);
        const k = Math.exp(-dd) * r * 0.18;
        z -= k;
      }
      p.setXYZ(i, x, y, z);
    }
    noseGeo.computeVertexNormals();
  }
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.copy(toHead(design.face.nose));
  nose.rotation.x = -0.15;
  headBone.add(nose);
  // boca: linha escura que abre no latido, com língua
  const mouth = new THREE.Group();
  mouth.position.copy(toHead(design.face.mouth));
  const lip = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), lipMat);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), tongueMat);
  mouth.add(lip, tongue);
  headBone.add(mouth);
  const mouthW = 0.017 * s * P.hs;

  // ------------------------------------------------------------------ sockets
  const mouthSocket = new THREE.Object3D();
  mouthSocket.name = `${kind}-mouthSocket`;
  mouthSocket.position.copy(toHead(design.face.mouth)).add(new THREE.Vector3(0, -0.004 * s, 0.006 * s));
  headBone.add(mouthSocket);
  // itens diferentes na boca: o socket se ajusta ao tipo (detecção automática pelo nome/forma do
  // filho, ou forçado com setCarryPose). Cenoura = pose da v1 (atravessada na boca).
  const socketBase = mouthSocket.position.clone();
  const HS = s * P.hs;
  const CARRY = {
    carrot: { open: 0.35, pos: [0, 0, 0], rot: [0, 0, 0] },
    // bolinha: boca bem aberta, bola à frente e abaixo — os dentes da frente "afundam" nela
    ball: { open: 1.0, pos: [0, -0.036, 0.016], rot: [0, 0, 0] },
    // pantufa: mordida por uma ponta, atravessada e caída para o lado
    slipper: { open: 0.6, pos: [0.045, -0.02, 0.014], rot: [0.12, 0.18, -0.32] },
  };
  let carryForced = null, carryChild = null, carryKind = 'carrot', carryOpen = 0.35;
  const _bb = new THREE.Box3(), _bb2 = new THREE.Box3(), _mInv = new THREE.Matrix4(), _mRel = new THREE.Matrix4();
  function localBox(o) {
    _bb.makeEmpty();
    o.updateMatrixWorld(true);
    _mInv.copy(o.matrixWorld).invert();
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      _mRel.multiplyMatrices(_mInv, m.matrixWorld);
      _bb.union(_bb2.copy(m.geometry.boundingBox).applyMatrix4(_mRel));
    });
    return _bb;
  }
  function detectKind(o) {
    let tag = '';
    o.traverse((m) => { tag += ' ' + (m.name || '') + ' ' + (m.userData?.carryKind || m.userData?.kind || ''); });
    tag = tag.toLowerCase();
    if (/ball|bola/.test(tag)) return 'ball';
    if (/slipper|pantufa|chinelo/.test(tag)) return 'slipper';
    if (/carrot|cenoura/.test(tag)) return 'carrot';
    const b = localBox(o);
    if (b.isEmpty()) return 'carrot';
    const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].sort((a, c) => a - c);
    if (d[2] / Math.max(d[0], 1e-4) < 1.5) return 'ball';
    return d[1] / d[2] > 0.36 ? 'slipper' : 'carrot';
  }
  function applyCarryPose(kind, o) {
    const C = CARRY[kind] || CARRY.carrot;
    carryKind = kind;
    carryOpen = C.open;
    mouthSocket.rotation.set(C.rot[0], C.rot[1], C.rot[2]);
    mouthSocket.position.copy(socketBase).add(_v.set(C.pos[0] * HS, C.pos[1] * HS, C.pos[2] * HS));
    if (o && kind !== 'carrot') {
      // alinha o eixo mais longo do item com o X da cabeça (atravessado) e centraliza a caixa
      const b = localBox(o);
      if (!b.isEmpty()) {
        const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
        if (kind === 'slipper') {
          if (dz >= dx && dz >= dy) mouthSocket.rotateY(Math.PI / 2);
          else if (dy >= dx && dy >= dz) mouthSocket.rotateZ(Math.PI / 2);
        }
        b.getCenter(_v2).applyQuaternion(mouthSocket.quaternion);
        mouthSocket.position.sub(_v2);
      }
    }
  }
  const markerAnchor = new THREE.Object3D();
  markerAnchor.position.set(0, cfg.visual.headTop + 0.14, design.face.Hc[2]);
  object.add(markerAnchor);

  // sombra de contato
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      color: 0x2a1a0c,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  shadow.position.y = 0.004;
  shadow.renderOrder = -1;
  object.add(shadow);
  const shadowBase = { x: 0.3 * s, z: cfg.visual.length * 1.05 };

  // ------------------------------------------------------------------ dados da IK
  const v3 = () => new THREE.Vector3();
  const q4 = () => new THREE.Quaternion();
  const Lq = bones.map(() => q4());
  const Wq = bones.map(() => q4());
  const Wp = bones.map(() => v3());
  const posOff = bones.map(() => v3());

  function makeBasisT(dir, n) {
    const e1 = dir.clone().normalize();
    const e3 = n.clone().addScaledVector(e1, -n.dot(e1)).normalize();
    const e2 = new THREE.Vector3().crossVectors(e3, e1);
    return new THREE.Matrix4().makeBasis(e1, e2, e3).transpose();
  }
  const LEGS = [
    { u: 'FLu', l: 'FLl', p: 'FLp', front: true, side: 1 },
    { u: 'FRu', l: 'FRl', p: 'FRp', front: true, side: -1 },
    { u: 'HLu', l: 'HLl', m: 'HLm', p: 'HLp', front: false, side: 1 },
    { u: 'HRu', l: 'HRl', m: 'HRm', p: 'HRp', front: false, side: -1 },
  ].map((L) => {
    const iu = BI[L.u], il = BI[L.l], ip = BI[L.p], im = L.m ? BI[L.m] : -1;
    const Pp = rest[iu], K = rest[il];
    const T = L.front ? rest[ip] : rest[im]; // alvo da IK de 2 ossos: punho (dianteira) ou jarrete (traseira)
    const u0 = K.clone().sub(Pp), l0 = T.clone().sub(K);
    const n0 = new THREE.Vector3().crossVectors(u0, l0).normalize();
    const leg = {
      ...L, iu, il, ip, im,
      a: u0.length(), b: l0.length(),
      n0,
      Bu: makeBasisT(u0, n0),
      Bl: makeBasisT(l0, n0),
      foot0: rest[ip].clone(), // posição neutra do apoio (punho / articulação da pata)
      swing: false,
      prevP: 0,
    };
    if (im >= 0) {
      const m0 = rest[ip].clone().sub(rest[im]);
      leg.m0 = m0;
      leg.c = m0.length();
      leg.Bm = makeBasisT(m0, n0);
    }
    return leg;
  });

  // ------------------------------------------------------------------ estado da animação
  const st = {
    t: Math.random() * 10,
    speed: 0,
    move: 0,
    phase: Math.random(),
    idle: 0,
    lean: 0,
    turnS: 0,
    w: { sit: 0, push: 0, strain: 0, tug: 0, celebrate: 0, sniff: 0, dash: 0, carry: 0, bow: 0, shake: 0, startled: 0, turn: 0 },
    shakeT: 9,
    startT: 9,
    wet: 0,
    lookYaw: 0,
    lookPitch: 0,
    glanceT: 2,
    glanceYaw: 0,
    glancePitch: 0,
    blinkT: 1.5 + Math.random() * 2,
    blink: 0,
    bark: -1,
    celT: 0,
    hop: 0,
    spin: 0,
    wagPhase: 0,
    wagAmp: 0.25,
    wagFreq: 2,
    tailRaise: 0,
    ears: [
      { p: 0, pv: 0, o: 0.08, ov: 0 },
      { p: 0, pv: 0, o: 0.08, ov: 0 },
    ],
    headWorld: null,
    headVel: new THREE.Vector3(),
    headAcc: new THREE.Vector3(),
    mouthOpen: 0,
    prevAction: 'none',
  };

  // temporários
  const _q = q4(), _q2 = q4(), _q3 = q4(), _qi = q4();
  const _e = new THREE.Euler();
  const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
  const _v = v3(), _v2 = v3(), _v3 = v3(), _T = v3(), _K = v3(), _H = v3(), _pole = v3(), _n = v3(), _d = v3(), _dir = v3(), _pl = v3();
  const _rootPos = v3();
  const _X = new THREE.Vector3(1, 0, 0), _Y = new THREE.Vector3(0, 1, 0);
  const qE = (out, x, y, z) => out.setFromEuler(_e.set(x, y, z, 'YXZ'));

  function fk(i) {
    const p = parentIdx[i];
    if (p < 0) return;
    Wq[i].multiplyQuaternions(Wq[p], Lq[i]);
    Wp[i].copy(restOff[i]).add(posOff[i]).applyQuaternion(Wq[p]).add(Wp[p]);
  }
  function setWorld(i, q) {
    const p = parentIdx[i];
    Lq[i].copy(Wq[p]).invert().multiply(q);
    Wq[i].copy(q);
    Wp[i].copy(restOff[i]).add(posOff[i]).applyQuaternion(Wq[p]).add(Wp[p]);
  }
  function basisQuat(out, dir, n, BT) {
    const e1 = _v.copy(dir).normalize();
    const e3 = _v2.copy(n).addScaledVector(e1, -n.dot(e1)).normalize();
    const e2 = _v3.crossVectors(e3, e1);
    _m.makeBasis(e1, e2, e3).multiply(BT);
    return out.setFromRotationMatrix(_m);
  }
  function solve2(Pp, T, a, b, pole, outK) {
    _d.subVectors(T, Pp);
    let d = _d.length();
    const maxD = (a + b) * 0.998, minD = Math.abs(a - b) + 1e-4;
    if (d > maxD) { _d.multiplyScalar(maxD / d); d = maxD; T.copy(Pp).add(_d); }
    if (d < minD) { _d.multiplyScalar(minD / Math.max(d, 1e-6)); d = minD; T.copy(Pp).add(_d); }
    _dir.copy(_d).divideScalar(d);
    _pl.copy(pole).addScaledVector(_dir, -pole.dot(_dir)).normalize();
    const x = (a * a - b * b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    outK.copy(Pp).addScaledVector(_dir, x).addScaledVector(_pl, h);
  }

  const self = {
    kind,
    object,
    mouthSocket,
    markerAnchor,
    onFootstep: null,
    stats: G.stats,
    bones,
    skeleton,
    meshes: { body: bodyMesh, ears: earMesh, fur: furMesh },
    update,
    triggerBark() {
      st.bark = 0;
    },
    /** Força a pose do item na boca: 'carrot' | 'ball' | 'slipper' | null (automático). */
    setCarryPose(kind) {
      carryForced = kind || null;
      carryChild = undefined; // reaplica no próximo update
    },
    get carryKind() { return carryKind; },
    /** Pelo molhado 0..1 (escuro, murcho e brilhante). A Mecânica faz o decaimento. */
    setWet(k) {
      st.wet = clamp(k || 0, 0, 1);
      wetU.value = st.wet;
      furMat.userData.uniforms.uWet.value = st.wet;
      skinMat.roughness = lerp(0.8, 0.42, st.wet);
      skinMat.sheen = lerp(1.0, 0.35, st.wet);
      furMat.roughness = lerp(0.92, 0.5, st.wet);
    },
  };

  // =====================================================================================
  function update(dt, anim) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    const A = anim || {};
    const ch = mouthSocket.children[0] || null;
    if (ch !== carryChild) {
      carryChild = ch;
      applyCarryPose(carryForced || (ch ? detectKind(ch) : 'carrot'), ch);
    }
    const action = A.action || 'none';
    const speedIn = Math.max(0, A.speed || 0);
    const turn = A.turn || 0;
    st.t += dt;
    const t = st.t;
    const damp = (cur, target, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
    const w = st.w;

    // ---------------- blends
    st.speed = damp(st.speed, speedIn, 14);
    const v = st.speed;
    st.move = damp(st.move, sstep(0.03, 0.3, v), 9);
    st.turnS = damp(st.turnS, turn, 8);
    if (action !== st.prevAction) {
      if (action === 'celebrate') st.celT = 0;
      if (action === 'shake') st.shakeT = 0;
      if (action === 'startled') st.startT = 0;
      st.prevAction = action;
    }
    if (v < 0.05 && action === 'none' && Math.abs(turn) < 0.4 && st.bark < 0) st.idle += dt;
    else st.idle = 0;
    const wantSit = action === 'sit' || (action === 'none' && st.idle > 5);
    w.sit = damp(w.sit, wantSit ? 1 : 0, wantSit ? 3.2 : 7);
    for (const k of ['push', 'strain', 'tug', 'celebrate', 'sniff', 'dash', 'turn']) w[k] = damp(w[k], action === k ? 1 : 0, k === 'dash' ? 10 : 6);
    w.shake = damp(w.shake, action === 'shake' ? 1 : 0, action === 'shake' ? 14 : 8);
    w.startled = damp(w.startled, action === 'startled' ? 1 : 0, action === 'startled' ? 22 : 5);
    st.shakeT += dt;
    st.startT += dt;
    // chacoalhar: onda de torção que vai da cabeça à cauda (~0,9 s); k = atraso do segmento
    const shakeEnvAt = (k) => {
      const u = st.shakeT - k * 0.07;
      return sstep(0, 0.1, u) * (1 - sstep(0.62, 0.9, u)) * w.shake;
    };
    const shakePh = st.shakeT * TAU * 6.2;
    const shk = (k) => Math.sin(shakePh - k * 0.9) * shakeEnvAt(k);
    const shkEnv = shakeEnvAt(1);
    // susto: tranco rápido para trás que assenta numa postura baixa e encolhida
    const jolt = sstep(0, 0.07, st.startT) * Math.exp(-Math.max(0, st.startT - 0.07) * 6) * w.startled;
    const ws = w.startled;
    w.carry = damp(w.carry, A.carrying ? 1 : 0, 6);

    // comemoração: pulinhos → giro → "play bow"
    let hopTarget = 0, bowTarget = 0, spinTarget = null, celHappy = w.celebrate;
    if (action === 'celebrate') {
      st.celT += dt;
      const c = st.celT % 2.8;
      if (c < 0.9) {
        const u = (c % 0.45) / 0.45;
        hopTarget = Math.sin(Math.PI * u) * 0.075 * s;
      } else if (c < 1.65) {
        const u = (c - 0.9) / 0.75;
        spinTarget = TAU * Math.floor(st.celT / 2.8) + TAU * (u * u * (3 - 2 * u));
        hopTarget = Math.sin(Math.PI * u) * 0.05 * s;
      } else {
        bowTarget = 1;
      }
      if (spinTarget === null) spinTarget = TAU * Math.round(st.spin / TAU);
      st.spin = c >= 0.9 && c < 1.65 ? spinTarget : damp(st.spin, spinTarget, 10);
    } else {
      st.spin = damp(st.spin, TAU * Math.round(st.spin / TAU), 6);
      if (Math.abs(st.spin - TAU * Math.round(st.spin / TAU)) < 1e-3) st.spin = 0;
    }
    st.hop = action === 'celebrate' ? hopTarget : damp(st.hop, 0, 12);
    w.bow = damp(w.bow, bowTarget, 7);
    inner.rotation.y = st.spin;
    inner.position.y = st.hop;

    // latido
    let barkEnv = 0;
    if (st.bark >= 0) {
      st.bark += dt;
      const u = st.bark / 0.38;
      if (u >= 1) st.bark = -1;
      else barkEnv = Math.sin(Math.PI * u) * (u < 0.5 ? 1 : 1 - (u - 0.5) * 0.6);
    }

    // ---------------- passada
    const kS = 1 / Math.sqrt(s);
    const vEff = Math.max(v, Math.abs(st.turnS) * 0.1 * s);
    const fTrot = (1.8 + 1.6 * Math.min(vEff, 3)) * kS;
    const fBound = (4.6 + 0.15 * v) * kS;
    let f = lerp(fTrot, fBound, w.dash);
    f = lerp(f, f * 0.72, w.push);
    f = lerp(f, 3.8, w.strain);
    const turning = sstep(0.4, 1.5, Math.abs(st.turnS)) * (1 - st.move);
    const gaitAmp = Math.max(st.move, turning * 0.6, w.strain) * (1 - Math.max(w.tug, w.turn)) * (1 - w.sit) * (1 - w.bow) * (1 - shkEnv * 0.9) * (1 - ws * 0.7);
    st.phase = fract(st.phase + f * dt);
    const L = v / Math.max(f, 0.5);
    const walk = 1 - sstep(0.55, 1.1, v);
    let beta = lerp(0.62, 0.4, clamp(v / 2.4, 0, 1));
    beta = lerp(beta, 0.3, w.dash);
    beta = lerp(beta, 0.66, w.push);
    beta = lerp(beta, 0.5, w.strain);
    let stroke = beta * L * (1 - w.strain) + w.strain * 0.06 * s;
    stroke *= 1 - w.tug;
    const lift = (0.026 * s * Math.min(1, 0.45 + v / 1.4) * Math.max(st.move, turning) + w.strain * 0.024 * s + w.push * 0.01 * s + w.dash * 0.02 * s) * (1 - w.sit);
    // fases de cada pata (FL, FR, HL, HR): passo (lateral), trote (diagonais), galope (bound)
    const offWalk = [0.25, 0.75, 0.0, 0.5];
    const offTrot = [0.0, 0.5, 0.5, 0.0];
    const offBound = [0.0, 0.08, 0.5, 0.58];

    // ---------------- corpo (raiz)
    const sp2 = st.phase * TAU;
    const trotK = (1 - w.dash) * gaitAmp;
    const bob = -0.0065 * s * Math.min(1, v / 1.2) * trotK * Math.cos(2 * (sp2 - beta * Math.PI));
    const sway = 0.003 * s * Math.sin(sp2) * trotK;
    const boundPitch = 0.15 * Math.sin(sp2 - 0.9) * w.dash;
    const boundY = 0.022 * s * (0.5 + 0.5 * Math.sin(sp2 - 2.4)) * w.dash;
    st.lean = damp(st.lean, clamp(-st.turnS * v * 0.075, -0.32, 0.32), 6);
    const breathe = Math.sin(t * (2.2 + 3 * st.move)) * 0.0016 * s;
    const tremble = w.strain * Math.sin(t * 57) * 0.0018 * s;

    let pitch = boundPitch + w.push * 0.11 + w.strain * 0.16 + w.sniff * 0.1 - w.tug * 0.13 - barkEnv * 0.04 - ws * 0.07 - jolt * 0.1 + w.turn * 0.06;
    let rootY = bob + boundY + breathe - 0.012 * s * Math.min(1, v / 2) * (1 - w.dash) - w.push * 0.012 * s - w.strain * 0.016 * s - w.tug * 0.02 * s - w.sniff * 0.012 * s - ws * 0.03 * s - shkEnv * 0.006 * s - w.turn * 0.014 * s;
    let rootZ = -w.tug * 0.025 * s - barkEnv * 0.008 * s + w.strain * 0.01 * s - ws * 0.022 * s - jolt * 0.03 * s - w.turn * 0.012 * s;
    const rootX = sway + tremble + shk(2) * 0.006 * s + ws * Math.sin(t * 47) * 0.0012 * s;
    qE(_q, pitch, 0, st.lean + Math.sin(sp2) * 0.025 * trotK + shk(2) * 0.16);
    _rootPos.set(rest[0].x + rootX, rest[0].y + rootY, rest[0].z + rootZ);
    _m.compose(_rootPos, _q, _v.set(1, 1, 1));
    // sentar: gira em torno do peito; play bow: gira em torno do quadril
    if (w.sit > 0.001) {
      // pivô no ombro: as patas dianteiras continuam retas e plantadas; a garupa desce até o chão
      const C = rest[BI.FLu];
      _m2.makeTranslation(0, C.y - 0.004 * s * w.sit, C.z).multiply(_m3.makeRotationX(-SIT_PITCH * w.sit)).multiply(_m3.makeTranslation(0, -C.y, -C.z));
      _m.premultiply(_m2);
    }
    if (w.bow > 0.001) {
      const Hh = rest[BI.hips];
      _m2.makeTranslation(Hh.x, Hh.y + 0.01 * s * w.bow, Hh.z).multiply(_m3.makeRotationX(0.42 * w.bow)).multiply(_m3.makeTranslation(-Hh.x, -Hh.y, -Hh.z));
      _m.premultiply(_m2);
    }
    _m.decompose(_rootPos, Lq[0], _v);
    Wq[0].copy(Lq[0]);
    Wp[0].copy(_rootPos);
    bones[0].position.copy(_rootPos);

    // coluna: curva na direção da curva, flexão no galope, rebolado na comemoração
    const spineYaw = clamp(st.turnS * 0.07, -0.25, 0.25);
    const wiggle = w.bow * Math.sin(t * 14) * 0.18;
    const flex = w.dash * Math.sin(sp2 - 0.4) * 0.12;
    qE(Lq[BI.chest], -flex, spineYaw + shk(1.5) * 0.12, shk(1.5) * 0.3);
    qE(Lq[BI.hips], flex - w.sit * SIT_HIPS + ws * 0.12, -spineYaw * 0.6 + wiggle - shk(3) * 0.14, -wiggle * 0.3 + shk(3) * 0.42);
    posOff[BI.chest].set(0, 0, w.dash * Math.cos(sp2 - 0.4) * 0.018 * s);
    posOff[BI.hips].set(0, 0, -w.dash * Math.cos(sp2 - 0.4) * 0.018 * s);
    fk(BI.hips);
    fk(BI.chest);

    // ---------------- pernas (IK)
    for (let li = 0; li < 4; li++) {
      const leg = LEGS[li];
      const off = lerp(lerp(offTrot[li], offWalk[li], walk * (1 - w.dash)), offBound[li], w.dash);
      const p = fract(st.phase + off);
      let fz = 0, fy = 0, curl = 0, swingU = 0;
      const swing = p >= beta;
      if (!swing) {
        fz = stroke * (0.5 - p / beta);
      } else {
        const u = (p - beta) / (1 - beta);
        const e = u * u * (3 - 2 * u);
        fz = stroke * (-0.5 + e);
        fy = lift * Math.sin(Math.PI * u);
        curl = Math.sin(Math.PI * u);
        swingU = u;
      }
      fz *= gaitAmp;
      fy *= gaitAmp;
      curl *= gaitAmp;
      // pisada
      if (leg.swing && !swing && v > 0.2 && gaitAmp > 0.3) self.onFootstep?.(li);
      leg.swing = swing;
      void swingU;

      const T = _T.copy(leg.foot0);
      T.z += fz;
      T.y += fy;
      if (leg.front) {
        T.z += w.sit * 0.012 * s + w.bow * 0.075 * s + w.tug * 0.04 * s - w.sniff * 0.005 * s;
        T.y += w.bow * 0.004 * s;
        T.x += leg.side * w.bow * 0.006 * s;
      } else {
        T.z += w.sit * 0.07 * s - (w.push + w.strain) * 0.025 * s + w.tug * 0.012 * s - w.turn * 0.02 * s;
        T.x += leg.side * (w.sit * 0.01 + shkEnv * 0.01 + ws * 0.006) * s;
      }
      // pulinho: patas encolhidas
      const tuck = st.hop * 0.55 + (w.dash * Math.max(0, Math.sin(sp2 - 2.4)) * 0.015 * s);
      T.y += tuck;
      // planta do pé nunca abaixo do chão (com o corpo levantado o pé acompanha)
      const parent = leg.front ? BI.chest : BI.hips;
      fk(leg.iu);
      const Pp = Wp[leg.iu];
      // polo: cotovelo para trás, joelho para frente (girando com o tronco)
      _pole.set(0, leg.front ? -0.15 : 0.15, leg.front ? -1 : 1).applyQuaternion(Wq[parent]);
      if (!leg.front && w.sit > 0.001) {
        // SENTADA (anatomia de cão): jarrete no chão logo atrás do quadril, metatarso deitado
        // apontando para a frente, pata plantada à frente do jarrete; soldra para a FRENTE, ao lado
        // da barriga (polo no referencial da dog, não da garupa inclinada).
        const ks = sstep(0, 1, w.sit);
        _v.set(Pp.x + leg.side * 0.012 * s, leg.foot0.y - 0.004 * s, Pp.z - 0.016 * s + leg.c * 0.97);
        T.lerp(_v, ks);
        _v.set(leg.side * 0.34, 0.5, 1).normalize();
        _pole.lerp(_v, ks).normalize();
      }

      if (leg.front) {
        solve2(Pp, T, leg.a, leg.b, _pole, _K);
        _n.crossVectors(_v.subVectors(_K, Pp), _v2.subVectors(T, _K)).normalize();
        basisQuat(_q, _v3.subVectors(_K, Pp), _n, leg.Bu);
        setWorld(leg.iu, _q);
        basisQuat(_q2, _v3.subVectors(T, _K), _n, leg.Bl);
        setWorld(leg.il, _q2);
        qE(_q3, curl * 0.9 - w.bow * 0.0, 0, 0);
        setWorld(leg.ip, _q3);
      } else {
        // metatarso: vertical em pé, deitado para a frente sentado, flexiona no balanço
        const ang = curl * 0.45 - sstep(0, 1, w.sit) * 1.38;
        _v.copy(leg.m0).applyAxisAngle(_X, ang);
        _H.copy(T).sub(_v); // jarrete = pata - metatarso
        const Mdir = _d.copy(_v); // cópia temporária
        const mdx = Mdir.x, mdy = Mdir.y, mdz = Mdir.z;
        solve2(Pp, _H, leg.a, leg.b, _pole, _K);
        _n.crossVectors(_v.subVectors(_K, Pp), _v2.subVectors(_H, _K)).normalize();
        basisQuat(_q, _v3.subVectors(_K, Pp), _n, leg.Bu);
        setWorld(leg.iu, _q);
        basisQuat(_q2, _v3.subVectors(_H, _K), _n, leg.Bl);
        setWorld(leg.il, _q2);
        _n.crossVectors(_v.subVectors(_K, Pp), _v2.subVectors(_H, _K)).normalize();
        basisQuat(_q3, _v3.set(mdx, mdy, mdz), _n, leg.Bm);
        setWorld(leg.im, _q3);
        qE(_qi, curl * 0.7, 0, 0);
        setWorld(leg.ip, _qi);
      }
    }

    // ---------------- olhar
    let tYaw = 0, tPitch = 0;
    if (A.lookAt) {
      const ox = object.position.x, oz = object.position.z, yaw = object.rotation.y;
      const dx = A.lookAt.x - ox, dz = A.lookAt.z - oz;
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      const hp = Wp[BI.head];
      tYaw = clamp(Math.atan2(lx - hp.x, lz - hp.z), -1.15, 1.15);
      const hd = Math.hypot(lx - hp.x, lz - hp.z);
      tPitch = clamp(-Math.atan2((A.lookAt.y ?? 0.3) - (object.position.y + hp.y), Math.max(hd, 0.2)), -0.5, 0.55);
    } else {
      st.glanceT -= dt;
      if (st.glanceT <= 0) {
        st.glanceT = 1.8 + Math.random() * 3.5;
        const calm = 1 - st.move;
        st.glanceYaw = (Math.random() * 2 - 1) * 0.65 * calm;
        st.glancePitch = (Math.random() * 0.35 - 0.2) * calm;
      }
      tYaw = st.glanceYaw * (1 - st.move) + st.turnS * 0.12;
      tPitch = st.glancePitch * (1 - st.move);
    }
    const actionsBusy = Math.max(w.push, w.strain, w.tug, w.sniff, w.bow, w.turn, shkEnv);
    tYaw *= 1 - actionsBusy * 0.8;
    st.lookYaw = damp(st.lookYaw, tYaw, 5);
    st.lookPitch = damp(st.lookPitch, tPitch, 5);

    // ---------------- pescoço e cabeça (cabeça estabilizada)
    const shake = w.tug * Math.sin(t * 15) * 0.32;
    // registro: torce a cabeça (rolagem) em catraca — gira devagar, volta rápido
    const tu = fract(t * 0.85);
    const turnRoll = w.turn * (tu < 0.72 ? lerp(-0.42, 0.48, sstep(0, 0.72, tu)) : lerp(0.48, -0.42, sstep(0.72, 1, tu)));
    const sniffTw = w.sniff * Math.sin(t * 19) * 0.04;
    const neckPitch = 0.05 + w.push * 0.42 + w.strain * 0.5 + w.sniff * 0.95 + w.tug * 0.25 + w.bow * 0.25 - w.carry * 0.08 - w.sit * 0.12 - barkEnv * 0.16 + st.lookPitch * 0.4 - ws * 0.3 + w.turn * 0.32;
    const bodyPitchW = pitch - SIT_PITCH * w.sit + 0.42 * w.bow;
    qE(_q, bodyPitchW * 0.35 + neckPitch, st.lookYaw * 0.45 + shake * 0.3 + shk(0.5) * 0.25, shk(0.5) * 0.3 + turnRoll * 0.3);
    setWorld(BI.neck, _q);
    const headPitch = -0.05 - w.push * 0.3 - w.strain * 0.35 + w.sniff * 0.35 + w.tug * 0.1 - w.carry * 0.08 - barkEnv * 0.32 + st.lookPitch * 0.6 + sniffTw + bob * 4 - ws * 0.12 + w.turn * 0.12;
    const headTilt = celHappy * Math.sin(t * 3.1) * 0.18 + (1 - st.move) * Math.sin(t * 0.7) * 0.04;
    qE(_q, headPitch, st.lookYaw + shake + shk(0) * 0.35, headTilt + st.lean * 0.4 + shk(0) * 0.6 + turnRoll);
    setWorld(BI.head, _q);
    fk(BI.jaw);

    // ---------------- boca (latido, comemoração, carregando)
    const pant = (celHappy * 0.6 + st.move * sstep(1.2, 2.4, v) * 0.5) * (1 - w.carry);
    const openT = Math.max(barkEnv, pant * (0.55 + 0.45 * Math.sin(t * 9)) * (1 - ws), w.carry * carryOpen, w.turn * 0.4);
    st.mouthOpen = damp(st.mouthOpen, openT, 20);
    const mo = st.mouthOpen;
    lip.scale.set(mouthW, 0.0022 * s + mo * 0.011 * s, 0.009 * s + mo * 0.004 * s);
    lip.position.set(0, -mo * 0.006 * s, 0);
    tongue.visible = mo > 0.15;
    tongue.scale.set(mouthW * 0.6, 0.004 * s, 0.012 * s);
    tongue.position.set(0, -mo * 0.011 * s, 0.002 * s);

    // ---------------- orelhas (mola amortecida guiada pela aceleração da cabeça)
    {
      const hp = Wp[BI.head];
      _v.copy(hp).applyQuaternion(inner.quaternion).add(inner.position);
      _v.applyQuaternion(object.quaternion).add(object.position);
      if (!st.headWorld) st.headWorld = _v.clone();
      const idt = 1 / Math.max(dt, 1e-3);
      _v2.subVectors(_v, st.headWorld).multiplyScalar(idt);
      st.headWorld.copy(_v);
      _v3.subVectors(_v2, st.headVel).multiplyScalar(idt);
      st.headVel.lerp(_v2, 0.5);
      st.headAcc.lerp(_v3, 0.3);
      if (st.headAcc.length() > 60) st.headAcc.setLength(60);
      // aceleração no referencial da cabeça
      _q.copy(object.quaternion).multiply(inner.quaternion).multiply(Wq[BI.head]).invert();
      const aL = _v3.copy(st.headAcc).applyQuaternion(_q);
      const pitchT = w.dash * 1.15 + Math.min(v, 2.5) * 0.08 + w.push * 0.2 + w.strain * 0.3 + barkEnv * 0.2 + ws * 1.05;
      const outT = 0.06 + w.dash * 0.35 + celHappy * 0.12 + barkEnv * 0.25 - w.sit * 0.03 - ws * 0.12 + shkEnv * (0.45 + 0.4 * Math.sin(shakePh - 0.4));
      const sub = dt > 0.02 ? 2 : 1;
      const h = dt / sub;
      for (let ei = 0; ei < 2; ei++) {
        const E = st.ears[ei];
        const se = ei === 0 ? 1 : -1;
        for (let k = 0; k < sub; k++) {
          const ap = 160 * (pitchT - E.p) - 9 * E.pv + aL.z * 0.12;
          const ao = 140 * (outT - E.o) - 8 * E.ov - aL.y * 0.1 - se * aL.x * 0.1;
          E.pv += ap * h; E.p += E.pv * h;
          E.ov += ao * h; E.o += E.ov * h;
        }
        E.p = clamp(E.p, -0.5, 1.5);
        E.o = clamp(E.o, -0.12, 1.1);
        qE(Lq[BI[ei === 0 ? 'earL0' : 'earR0']], E.p * 0.8, 0, se * E.o);
        qE(Lq[BI[ei === 0 ? 'earL1' : 'earR1']], E.p * 0.35 + E.pv * 0.012, 0, se * (E.o * 0.35 + E.ov * 0.01));
      }
    }

    // ---------------- cauda
    const happy = Math.max(celHappy, w.carry * 0.7, barkEnv);
    const wagFreqT = lerp(lerp(2.0, 3.2, st.move), 7, happy) * (1 - w.sit * 0.5) * (1 - actionsBusy * 0.5);
    const wagAmpT = lerp(lerp(0.22, 0.16, st.move), 0.55, happy) * (1 - w.sit * 0.6) * (1 - (w.push + w.strain) * 0.7) * (1 - ws * 0.8) + w.bow * 0.2;
    st.wagFreq = damp(st.wagFreq, wagFreqT, 3);
    st.wagAmp = damp(st.wagAmp, wagAmpT, 3);
    st.wagPhase += st.wagFreq * dt * TAU;
    const raiseT = w.sit * -0.55 + (w.push + w.strain + w.sniff) * 0.15 + happy * 0.12 - w.dash * 0.35 + w.bow * 0.2 - ws * 0.95;
    st.tailRaise = damp(st.tailRaise, raiseT, 4);
    for (let k = 0; k < 4; k++) {
      const wag = Math.sin(st.wagPhase - k * 0.7) * st.wagAmp * (k === 0 ? 1 : 0.3) + shk(4 + k * 0.6) * (k === 0 ? 0.5 : 0.25);
      qE(Lq[BI.tail0 + k], k === 0 ? -st.tailRaise * 0.8 : -st.tailRaise * 0.12 + w.dash * 0.1, wag, k === 0 ? 0 : wag * 0.2);
    }

    // ---------------- piscadas
    st.blinkT -= dt;
    if (st.blinkT <= 0) {
      st.blink = 0.0001;
      st.blinkT = 1.8 + Math.random() * 3.8;
      if (Math.random() < 0.18) st.blinkT = 0.28; // piscada dupla
    }
    let lid = 0;
    if (st.blink > 0) {
      st.blink += dt;
      const u = st.blink / 0.16;
      if (u >= 1) st.blink = 0;
      else lid = Math.sin(Math.PI * u);
    }
    const squint = celHappy * 0.25 + w.strain * 0.3;
    const wide = 1 + ws * 0.22;
    const lidK = lid * (1 - ws);
    for (const e of eyes) e.scale.set(wide, wide * Math.max(0.08, 1 - Math.max(lidK, squint * (1 - ws))), wide);

    // ---------------- aplica nos ossos
    for (let i = 0; i < nB; i++) {
      bones[i].quaternion.copy(Lq[i]);
      if (i > 0) bones[i].position.copy(restOff[i]).add(posOff[i]);
    }

    // pelo: vento nas pontas durante a arrancada
    furMat.userData.uniforms.uWind.value.set(shk(1.5) * 0.9, 0.12 * w.dash, -0.9 * w.dash - v * 0.04);

    // sombra de contato e marcador
    const rp = Wp[0];
    const cs = Math.cos(st.spin), sn = Math.sin(st.spin);
    shadow.position.x = rp.x * cs + rp.z * sn;
    shadow.position.z = -rp.x * sn + rp.z * cs - w.sit * 0.03 * s;
    shadow.rotation.y = st.spin;
    const lift01 = clamp(st.hop / (0.1 * s), 0, 1);
    shadow.scale.set(shadowBase.x * (1 - lift01 * 0.3), 1, shadowBase.z * (1 - w.sit * 0.25) * (1 - lift01 * 0.3));
    shadow.material.opacity = 0.55 * (1 - lift01 * 0.5);
    const hp = Wp[BI.head];
    markerAnchor.position.set(
      lerp(markerAnchor.position.x, hp.x * cs + hp.z * sn, 0.2),
      cfg.visual.headTop + 0.14 + st.hop,
      lerp(markerAnchor.position.z, -hp.x * sn + hp.z * cs, 0.2),
    );
  }

  // pose inicial
  for (let i = 0; i < nB; i++) Lq[i].identity();
  Wp[0].copy(rest[0]);
  update(1 / 60, { speed: 0, action: 'none' });
  return self;
}
