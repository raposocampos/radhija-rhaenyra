// Cocozinho de desenho (extra escondido, src/game/extras.js): uma espiral contínua de "sorvete" marrom e brilhante
// que afina até a pontinha enrolada, com base arredondada, carinha discreta (olhos com brilho e sorrisinho) e três
// fumacinhas claras de cheiro. Base no chão (y = 0), ~11 cm de largura na escala 1. Tudo procedural.
//   appear(dur): vai saindo de baixo para cima em `dur` s (a espiral se revela ao longo do tubo) e assenta com um
//   balancinho; os olhinhos abrem no fim. update(dt): o balancinho e as fumacinhas.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const TURNS = 2.7;
const SEG = 120; // segmentos ao longo da espiral
const RAD = 12; // segmentos em volta do tubo

/** Ponto da espiral em u (0 = base, 1 = ponta) e o raio do tubo ali. */
function spiral(u, out) {
  const a = u * TURNS * TAU;
  const R = 0.044 * (1 - u) ** 0.9 + 0.003; // raio da volta: largo embaixo, fino em cima
  const y = 0.022 + 0.082 * (1 - (1 - u) ** 1.25); // sobe mais rápido no começo (base cheia)
  out.set(Math.cos(a) * R, y, Math.sin(a) * R);
  // pontinha: a última parte se enrola para o lado
  if (u > 0.9) {
    const k = (u - 0.9) / 0.1;
    out.x += k * k * 0.016;
    out.y += k * 0.012;
  }
  return out;
}
const tubeR = (u) => 0.024 * (1 - u) ** 0.55 + 0.004 * (1 - u) + 0.0025;

/** @param {{ scale?: number }} [opts] */
export function createPoop({ scale = 1 } = {}) {
  const root = new THREE.Group();
  root.name = 'cocozinho';
  const body = new THREE.Group();
  root.add(body);

  // tubo da espiral com raio variável (montado à mão: TubeGeometry não afina) e cor que escurece embaixo
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  const P = new THREE.Vector3();
  const P2 = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const Bv = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const dark = new THREE.Color('#4a2814');
  const light = new THREE.Color('#8a5532');
  const c = new THREE.Color();
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG;
    spiral(u, P);
    spiral(Math.min(1, u + 1 / SEG), P2);
    if (i === SEG) spiral(u - 1 / SEG, P2).sub(P).negate().add(P);
    T.subVectors(P2, P).normalize();
    Bv.crossVectors(T, up).normalize();
    N.crossVectors(Bv, T).normalize();
    const r = tubeR(u);
    for (let j = 0; j <= RAD; j++) {
      const a = (j / RAD) * TAU;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      // seção achatada embaixo (assenta na volta de baixo)
      const nx = N.x * cs + Bv.x * sn;
      const ny = N.y * cs * (cs < 0 ? 0.75 : 1) + Bv.y * sn;
      const nz = N.z * cs + Bv.z * sn;
      pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r);
      nor.push(nx, ny, nz);
      c.copy(dark).lerp(light, Math.min(1, u * 1.4) * (0.6 + 0.4 * Math.max(0, cs)));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < SEG; i++) {
    for (let j = 0; j < RAD; j++) {
      const a = i * (RAD + 1) + j;
      const b = a + RAD + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', vertexColors: true, roughness: 0.38, clearcoat: 0.75, clearcoatRoughness: 0.22, sheen: 0.35, sheenColor: new THREE.Color('#c08a5e'),
  });
  const coil = new THREE.Mesh(geo, mat);
  coil.castShadow = true;
  body.add(coil);
  const triCount = idx.length;
  // base: um disquinho arredondado que fecha o começo da espiral
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.047, 20, 10), new THREE.MeshPhysicalMaterial({ color: '#52301a', roughness: 0.45, clearcoat: 0.6 }));
  base.scale.set(1, 0.42, 1);
  base.position.y = 0.016;
  base.castShadow = true;
  body.add(base);
  // pontinha arredondada
  const tip = new THREE.Mesh(new THREE.SphereGeometry(tubeR(1) * 1.05, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#8a5532', roughness: 0.38, clearcoat: 0.75 }));
  spiral(1, tip.position);
  body.add(tip);

  // carinha discreta na volta de baixo (+Z): olhos com brilho (abrem no fim) e sorrisinho
  const face = new THREE.Group();
  face.position.set(0, 0.038, 0.064);
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#140b07', roughness: 0.1, clearcoat: 1 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 14, 10), eyeMat);
    eye.position.set(sx * 0.0125, 0.004, 0);
    eye.scale.set(1, 1.2, 0.55);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), shine);
    glint.position.set(-0.002, 0.003, 0.0045);
    eye.add(glint);
    face.add(eye);
    eyes.push(eye);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0016, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#2a160c', roughness: 0.5 }));
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.009, 0.002);
  face.add(smile);
  body.add(face);

  // fumacinhas de cheiro: tubinhos ondulados claros que sobem e somem
  const stinks = [];
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let k = 0; k <= 10; k++) pts.push(new THREE.Vector3(Math.sin(k * 0.9 + i) * 0.011, k * 0.011, 0));
    const smat = new THREE.MeshBasicMaterial({ color: '#e7eecb', transparent: true, opacity: 0, depthWrite: false });
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0016, 5, false), smat);
    const holder = new THREE.Group();
    holder.position.set((i - 1) * 0.032, 0.13, (i % 2) * 0.01);
    holder.add(line);
    root.add(holder);
    stinks.push({ holder, mat: smat, ph: i * 0.33 });
  }
  root.scale.setScalar(scale);

  const S = { t: -1, age: 0, dur: 0.6 };
  function update(dt) {
    if (S.t < 0) return;
    S.t += dt;
    S.age += dt;
    // saindo: a espiral se revela de baixo para cima (a base cresce junto)
    const k = Math.min(1, S.t / S.dur);
    const shown = Math.max(6, Math.round((triCount * k) / 6) * 6);
    geo.setDrawRange(0, shown);
    base.scale.set(Math.min(1, k * 3), 0.42 * Math.min(1, k * 3), Math.min(1, k * 3));
    tip.visible = k >= 1;
    // depois de sair: assenta com um balancinho (mola amortecida) e respira devagar
    const u = Math.max(0, S.t - S.dur);
    const wob = u < 0.9 ? Math.exp(-u * 6) * Math.sin(u * 24) : 0;
    body.scale.set(1 + wob * 0.12, 1 - wob * 0.18, 1 + wob * 0.12);
    body.rotation.y = Math.sin(S.age * 1.3) * 0.06;
    // olhinhos abrem um tempinho depois e piscam de vez em quando
    const open = Math.min(1, Math.max(0, (u - 0.35) / 0.2));
    const blink = (S.age % 3.2) > 3.05 ? 0.15 : 1;
    for (const e of eyes) e.scale.y = 1.2 * Math.max(0.05, open * blink);
    face.visible = k >= 1;
    // fumacinhas: sobem em ciclos nos primeiros segundos e depois só de vez em quando
    for (const s of stinks) {
      const cyc = (S.age * 0.45 + s.ph) % 1;
      const fade = u <= 0 ? 0 : S.age < 7 ? 1 : 0.35;
      s.holder.position.y = 0.13 + cyc * 0.07;
      s.mat.opacity = Math.sin(Math.PI * cyc) * 0.5 * fade;
      s.holder.rotation.y = Math.sin(S.age * 2 + s.ph * TAU) * 0.4;
    }
  }
  return {
    object: root,
    /** Começa a sair (dur s até a ponta). */
    appear(dur = 0.6) {
      S.t = 0;
      S.age = 0;
      S.dur = Math.max(0.05, dur);
      root.visible = true;
      update(0);
    },
    update,
  };
}
