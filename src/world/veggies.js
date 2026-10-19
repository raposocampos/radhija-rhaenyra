// Legumes que as dogs carregam e largam no chão para distrair os porquinhos (fase 10 e a arena ?level=porcos):
// espiga de milho (grãos em fileiras, sabugo e palha), cenoura de verdade (com a rama) e uma aboborinha com gomos e
// cabinho. Tudo procedural, com UM material de cor por vértice para todos (barato). Cada um é centrado, com o eixo
// comprido em X local (o jeito que a boca da dog segura: 'carrot' atravessado; a abóbora vai como a bolinha).
//   createVeggie(kind) → { object, kind, carry, groundY, setEaten(k 0..1), reset(), setHighlight(on) }
//   kind: 'corn' | 'carrot' | 'pumpkin'. carry: pose da boca ('carrot' | 'ball'). groundY: altura do centro no chão.
//   setEaten(k): o porco come aos poucos (a ponta da espiga e da cenoura some, a abóbora abre por cima até sumir).
import * as THREE from 'three';
import { shareResource } from '../core/resources.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const tmp = new THREE.Color();
const lin = (hex) => { tmp.set(hex); return [tmp.r, tmp.g, tmp.b]; };
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/** Ruído de valor 1D barato (variação de cor por grão/gomo). */
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const GEO = {};
function veggieMaterial() {
  return GEO.mat || (GEO.mat = shareResource(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 })));
}

/**
 * Sólido de revolução em torno de +Y, com os anéis em ordem da base (u = 0) ao topo (u = 1): um drawRange com os
 * primeiros N anéis "come" a peça de cima para baixo. radius(u, a) e color(u, a) → [r, g, b]; as pontas fecham em 0.
 */
function revolve({ rings, around, len, radius, color }) {
  const pos = new Float32Array((rings + 1) * around * 3);
  const col = new Float32Array((rings + 1) * around * 3);
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    for (let j = 0; j < around; j++) {
      const a = (j / around) * TAU;
      const r = radius(u, a);
      const k = (i * around + j) * 3;
      pos[k] = Math.cos(a) * r;
      pos[k + 1] = u * len;
      pos[k + 2] = Math.sin(a) * r;
      col.set(color(u, a), k);
    }
  }
  const idx = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j, b = a + around, a1 = i * around + ((j + 1) % around), b1 = a1 + around;
      idx.push(a, b, a1, b, b1, a1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.ringTris = around * 6;
  g.userData.rings = rings;
  return g;
}

/** Folha (palha, rama): elipsoide achatado e comprido em +Z, com a cor da base à ponta. */
function leaf(len, width, thick, base, tip) {
  const g = new THREE.SphereGeometry(1, 10, 6);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const z = (p.getZ(i) + 1) / 2; // 0 base … 1 ponta
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, 0.15 + z * 0.9)), 0.7);
    p.setXYZ(i, p.getX(i) * w, p.getY(i) * thick + z * z * len * 0.12, z * len);
    col.set(mix(base, tip, z), i * 3);
  }
  g.deleteAttribute('uv');
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------- milho
const CORN = { len: 0.22, R: 0.03 };
function cornGeometries() {
  if (GEO.corn) return GEO.corn;
  const gap = lin('#c98a1e'), kern = lin('#ffd451'), kernHi = lin('#fff0a6');
  const prof = (u) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 6)), 1 / 6) * (1 - 0.28 * u);
  const ROWS = 14, ALONG = 16;
  const kernel = (u, a) => {
    const row = (a / TAU) * ROWS;
    const off = Math.floor(row + 0.5) % 2 ? 0.5 : 0;
    const ka = 0.5 + 0.5 * Math.cos(TAU * row);
    const ku = 0.5 + 0.5 * Math.cos(TAU * (u * ALONG + off));
    return { k: Math.pow(ka * ku, 0.55), id: Math.floor(row + 0.5) * 31 + Math.floor(u * ALONG + off) };
  };
  const grains = revolve({
    rings: 52, around: 42, len: CORN.len,
    radius: (u, a) => CORN.R * prof(u) + 0.0034 * kernel(u, a).k * sstep(0, 0.08, u) * sstep(1, 0.9, u),
    color: (u, a) => {
      const { k, id } = kernel(u, a);
      const c = mix(gap, mix(kern, kernHi, k * 0.35), sstep(0.15, 0.6, k));
      const v = 0.93 + hash(id) * 0.12;
      return [c[0] * v, c[1] * v, c[2] * v];
    },
  });
  const cob = revolve({
    rings: 12, around: 14, len: CORN.len * 0.98,
    radius: (u) => CORN.R * 0.72 * prof(u),
    color: (u, a) => mix(lin('#e9d59a'), lin('#d9bf7a'), 0.5 + 0.5 * Math.cos(a * 7 + u * 40)),
  });
  // palha: três folhas abertas para trás na base da espiga
  const husk = [];
  const green = lin('#93b552'), pale = lin('#dcd99a');
  for (let i = 0; i < 3; i++) {
    const l = leaf(0.095, 0.026, 0.0035, green, pale);
    l.rotateX(-0.3); // abre para fora do eixo…
    l.rotateZ((i * TAU) / 3 + 0.4); // …cada folha para um lado
    l.rotateY(-Math.PI / 2); // +Z da folha vira −X: sai da base para trás
    l.translate(-CORN.len / 2 + 0.012, 0, 0);
    husk.push(l);
  }
  for (const g of [grains, cob]) {
    g.rotateZ(-Math.PI / 2); // +Y (do comprimento) vira +X
    g.translate(-CORN.len / 2, 0, 0);
  }
  GEO.corn = { grains: shareResource(grains), cob: shareResource(cob), husk: husk.map(shareResource) };
  return GEO.corn;
}

// ---------------------------------------------------------------------------- cenoura
const CARROT = { len: 0.22, R: 0.029 };
const carrotR = (u) => CARROT.R * Math.pow(1 - u, 0.9) * Math.sqrt(sstep(0, 0.07, u)) + 0.0012 * (1 - u);
function carrotGeometries() {
  if (GEO.carrot) return GEO.carrot;
  const orange = lin('#f0862a'), light = lin('#f9ae57'), top = lin('#c9892f');
  const body = revolve({
    rings: 34, around: 16, len: CARROT.len,
    radius: (u, a) => carrotR(u) * (1 - 0.06 * Math.pow(Math.abs(Math.sin(u * 46 + hash(Math.floor(u * 9)) * 3)), 8)) * (1 + 0.03 * Math.cos(a * 3 + u * 9)),
    color: (u) => {
      const groove = Math.pow(Math.abs(Math.sin(u * 46 + hash(Math.floor(u * 9)) * 3)), 8);
      return mix(mix(orange, light, groove * 0.6), top, sstep(0.08, 0, u) * 0.6);
    },
  });
  // rama: folhinhas finas saindo do topo
  const fronds = [];
  const g1 = lin('#4f8f32'), g2 = lin('#8cc85a');
  for (let i = 0; i < 4; i++) {
    const l = leaf(0.08 + (i % 2) * 0.018, 0.009, 0.0025, g1, g2);
    l.rotateX(-0.35 - (i % 2) * 0.2);
    l.rotateZ((i / 4) * TAU);
    fronds.push(l);
  }
  // mordida: disco mais clarinho que tampa o corte
  const bite = new THREE.CircleGeometry(1, 14);
  const bc = new Float32Array(bite.attributes.position.count * 3);
  for (let i = 0; i < bite.attributes.position.count; i++) bc.set(mix(lin('#fbc173'), lin('#f39a3d'), Math.hypot(bite.attributes.position.getX(i), bite.attributes.position.getY(i))), i * 3);
  bite.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  bite.deleteAttribute('uv');
  bite.rotateY(Math.PI / 2); // a normal (+Z) olha para a ponta (+X), de onde a cenoura foi comida
  body.rotateZ(-Math.PI / 2);
  body.translate(-CARROT.len / 2, 0, 0);
  for (const f of fronds) {
    f.rotateY(-Math.PI / 2); // +Z da folha vira −X (sai do topo, que fica em −X)
    f.translate(-CARROT.len / 2 + 0.004, 0, 0);
  }
  GEO.carrot = { body: shareResource(body), fronds: fronds.map(shareResource), bite: shareResource(bite) };
  return GEO.carrot;
}

// ---------------------------------------------------------------------------- abóbora
const PUMPKIN = { R: 0.082, H: 0.12 };
function pumpkinGeometries() {
  if (GEO.pumpkin) return GEO.pumpkin;
  const o1 = lin('#e9781f'), o2 = lin('#f6a03c'), base = lin('#c95e18');
  const ribs = (a) => 0.5 + 0.5 * Math.cos(a * 8);
  const shell = revolve({
    rings: 22, around: 40, len: PUMPKIN.H,
    radius: (u, a) => PUMPKIN.R * Math.pow(Math.sin(Math.PI * u), 0.62) * (0.93 + 0.07 * Math.pow(ribs(a), 0.6)),
    color: (u, a) => {
      const c = mix(o1, o2, Math.pow(ribs(a), 1.5) * 0.7);
      return mix(c, base, sstep(0.25, 0, u) * 0.5 + (1 - Math.pow(ribs(a), 0.25)) * 0.25);
    },
  });
  shell.translate(0, -PUMPKIN.H / 2, 0);
  const flesh = new THREE.SphereGeometry(1, 16, 10);
  flesh.scale(PUMPKIN.R * 0.86, PUMPKIN.H * 0.42, PUMPKIN.R * 0.86);
  const fc = new Float32Array(flesh.attributes.position.count * 3);
  for (let i = 0; i < flesh.attributes.position.count; i++) fc.set(mix(lin('#ffc46a'), lin('#e9a24a'), hash(i) * 0.5), i * 3);
  flesh.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  flesh.deleteAttribute('uv');
  const stem = revolve({
    rings: 6, around: 8, len: 0.04,
    radius: (u) => 0.011 * (1 - 0.35 * u) * (u > 0.94 ? 0.5 : 1) + 0.002,
    color: (u) => mix(lin('#6c5a2a'), lin('#8f8b45'), u),
  });
  stem.rotateZ(0.25);
  stem.translate(0.004, PUMPKIN.H / 2 - 0.012, 0);
  GEO.pumpkin = { shell: shareResource(shell), flesh: shareResource(flesh), stem: shareResource(stem) };
  return GEO.pumpkin;
}

// ---------------------------------------------------------------------------- criação
/** @param {'corn' | 'carrot' | 'pumpkin'} kind */
export function createVeggie(kind) {
  const mat = veggieMaterial();
  const object = new THREE.Group();
  object.name = { corn: 'milho', carrot: 'cenoura-da-horta', pumpkin: 'aboborinha' }[kind] || kind;
  // a boca da dog lê o tipo por aqui (src/dogs/carryPose.js): milho e cenoura atravessados, abóbora como a bolinha
  const carry = kind === 'pumpkin' ? 'ball' : 'carrot';
  object.userData.carryKind = carry;
  const meshes = [];
  const add = (geo) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    object.add(m);
    meshes.push(m);
    return m;
  };
  let setEaten;
  let groundY;
  if (kind === 'corn') {
    const G = cornGeometries();
    const grains = add(G.grains);
    add(G.cob);
    const husk = G.husk.map(add);
    groundY = CORN.R + 0.002;
    setEaten = (k) => {
      // os grãos somem da ponta para a base, mostrando o sabugo; a palha vai por último
      const rings = G.grains.userData.rings;
      const left = Math.round(rings * (1 - clamp(k, 0, 1) * 0.92));
      grains.userData.count = left * G.grains.userData.ringTris;
      grains.visible = left > 0;
      for (const h of husk) h.visible = k < 0.97;
    };
  } else if (kind === 'carrot') {
    const G = carrotGeometries();
    const body = add(G.body);
    const fronds = G.fronds.map(add);
    const bite = add(G.bite);
    bite.visible = false;
    groundY = CARROT.R + 0.001;
    setEaten = (k) => {
      // a ponta some (do fim para o topo) e o disco mais clarinho tampa a mordida
      const rings = G.body.userData.rings;
      const keep = Math.max(2, Math.round(rings * (1 - clamp(k, 0, 1) * 0.9)));
      body.userData.count = keep * G.body.userData.ringTris;
      const u = keep / rings;
      const r = carrotR(u);
      bite.visible = k > 0.01 && k < 0.999;
      bite.position.set(-CARROT.len / 2 + u * CARROT.len, 0, 0);
      bite.scale.setScalar(Math.max(0.002, r * 0.97));
      for (const f of fronds) f.visible = k < 0.9;
    };
  } else {
    const G = pumpkinGeometries();
    const shell = add(G.shell);
    const flesh = add(G.flesh);
    const stem = add(G.stem);
    groundY = PUMPKIN.H / 2 + 0.001;
    setEaten = (k) => {
      // a casca abre por cima (os anéis de cima somem) e a polpa diminui
      k = clamp(k, 0, 1);
      const rings = G.shell.userData.rings;
      const keep = Math.round(rings * (1 - k * 0.85));
      shell.userData.count = keep * G.shell.userData.ringTris;
      flesh.scale.setScalar(1 - k * 0.55);
      flesh.position.y = -k * PUMPKIN.H * 0.18;
      stem.visible = k < 0.25;
    };
  }
  // drawRange por malha (a geometria é compartilhada: o corte vale só para este legume)
  for (const m of meshes) {
    const cut = () => {
      const n = m.userData.count;
      m.geometry.setDrawRange(0, n == null ? Infinity : n);
    };
    const whole = () => m.geometry.setDrawRange(0, Infinity);
    m.onBeforeRender = cut;
    m.onAfterRender = whole;
    m.onBeforeShadow = cut;
    m.onAfterShadow = whole;
  }
  let eaten = 0;
  const api = {
    object, kind, carry, groundY,
    /** k: quanto já foi comido (0..1); 1 = acabou (some). */
    setEaten(k) {
      eaten = clamp(k, 0, 1);
      setEaten(eaten);
      object.visible = eaten < 0.999;
    },
    get eaten() { return eaten; },
    reset() {
      eaten = 0;
      setEaten(0);
      object.visible = true;
    },
    setHighlight(on) {},
  };
  api.reset();
  return api;
}
