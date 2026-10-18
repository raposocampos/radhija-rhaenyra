// Expresso do Superbafo · a maquete do trem: base pintada com moldura de madeira e feltro verde, o trilho de
// madeira com dois sulcos (o MESMO desenho de track.js que move o trem), emendas das peças, cerquinha de
// ripas com a janela do nariz e a abertura da canaleta, placa da agulha (seta da volta / seta da estrela),
// alavanca ao lado do pedal, estação com plataforma, linha de estrelas até a bandeja e cenário de feltro.
import * as THREE from 'three';
import { rng, rbox, stdMat, woodMat, woodTexture, canvasTexture, mergeGeometries } from '../../../world/util.js';
import { createRubberDuck } from '../../../world/toys.js';
import {
  RAIL_YARD, TRACK, TRAIN, NOSE, CHUTE, MOON_CHUTE, SWITCH_SIGN, SWITCH_LEVER, PEDAL, BARRIER, BARRIER_PLATE, LOADER,
  YARD_DECOR as DECOR,
} from '../layout.js';

const TAU = Math.PI * 2;

/** @param {THREE.Object3D} parent @param {THREE.BufferGeometry} geo @param {THREE.Material} mat @param {number} [x] @param {number} [y] @param {number} [z] */
function add(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Estrela de cinco pontas (no plano XY). */
export function starShape(outer, inner = outer * 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? inner : outer;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

/** Decalque deitado no chão/feltro (polygonOffset: fica por cima sem brigar com a superfície). */
function decal(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...opts });
}

// ------------------------------------------------------------------ trilho de madeira
// Perfil (lateral u, altura y): laterais, topo e dois sulcos onde as rodas correm (fundo em TRAIN.railY).
const Y0 = RAIL_YARD.height - 0.002;
const YT = TRAIN.railY + 0.015;
const YG = TRAIN.railY;
function profile() {
  const W = TRACK.width / 2, g = TRACK.gauge / 2, hw = 0.02;
  // [u, y, tom] de cada vértice; o tom da aresta vem do ponto de chegada
  return [
    [-W, Y0, 0.86], [-W, YT, 0.86], [-g - hw, YT, 1], [-g - hw, YG, 0.62], [-g + hw, YG, 0.42], [-g + hw, YT, 0.62],
    [g - hw, YT, 1], [g - hw, YG, 0.62], [g + hw, YG, 0.42], [g + hw, YT, 0.62], [W, YT, 1], [W, Y0, 0.86],
  ];
}

/**
 * Faixa de trilho ao longo de uma peça: extrusão do perfil pelas amostras (retas: 2; curvas: a cada 4 cm),
 * com normais por aresta (madeira chanfrada) e cor de vértice escurecendo os sulcos.
 */
function trackStrip(track, seg) {
  const P = profile();
  const n = seg.kind === 'line' ? 1 : Math.max(4, Math.ceil(seg.length / 0.04));
  const pos = [], nor = [], uv = [], col = [];
  const a = { x: 0, z: 0, dx: 0, dz: 0 }, b = { x: 0, z: 0, dx: 0, dz: 0 };
  const v = (s, pt, u, y) => {
    // eixo lateral = direita de quem anda: (-dz, dx)
    return [pt.x - pt.dz * u, y + seg.lift, pt.z + pt.dx * u];
  };
  for (let i = 0; i < n; i++) {
    const s0 = (seg.length * i) / n, s1 = (seg.length * (i + 1)) / n;
    track.sample(seg, s0, a);
    track.sample(seg, s1, b);
    for (let k = 0; k < P.length - 1; k++) {
      const [u0, y0] = P[k], [u1, y1, tone] = P[k + 1];
      // normal da aresta no perfil (para fora do sólido) levada ao mundo pela lateral do ponto
      const du = u1 - u0, dy = y1 - y0, len = Math.hypot(du, dy);
      const nu = -dy / len, ny = du / len;
      const quad = [v(s0, a, u0, y0), v(s0, a, u1, y1), v(s1, b, u1, y1), v(s1, b, u0, y0)];
      const nrm = [[-a.dz * nu, ny, a.dx * nu], [-a.dz * nu, ny, a.dx * nu], [-b.dz * nu, ny, b.dx * nu], [-b.dz * nu, ny, b.dx * nu]];
      // orienta o triângulo pela normal desejada (perfil percorrido em qualquer sentido)
      const e1 = quad[1].map((c, j) => c - quad[0][j]), e2 = quad[3].map((c, j) => c - quad[0][j]);
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const facing = cr[0] * nrm[0][0] + cr[1] * nrm[0][1] + cr[2] * nrm[0][2] > 0;
      const order = facing ? [0, 1, 2, 0, 2, 3] : [0, 3, 2, 0, 2, 1];
      const uvs = [[s0 / 0.7, (u0 / TRACK.width + 0.5) * 0.25], [s0 / 0.7, (u1 / TRACK.width + 0.5) * 0.25], [s1 / 0.7, (u1 / TRACK.width + 0.5) * 0.25], [s1 / 0.7, (u0 / TRACK.width + 0.5) * 0.25]];
      for (const j of order) {
        pos.push(...quad[j]);
        nor.push(...nrm[j]);
        uv.push(...uvs[j]);
        col.push(tone, tone * 0.97, tone * 0.93);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ------------------------------------------------------------------ texturas
function feltTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const r = rng(61);
    g.fillStyle = '#8fb06a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const t = r();
      g.fillStyle = t < 0.5 ? `rgba(70,100,50,${0.05 + r() * 0.08})` : `rgba(220,235,180,${0.04 + r() * 0.06})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
  });
}
/** Lua crescente pintada (placas e decalques). */
function paintMoon(g, x, y, r, fill = '#f3e6b0', stroke = '#a8742c') {
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.closePath();
  g.fillStyle = fill; g.fill();
  g.lineWidth = Math.max(3, r * 0.14); g.strokeStyle = stroke; g.stroke();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(x + r * 0.55, y - r * 0.2, r * 0.82, 0, TAU); g.fill();
  g.restore();
}
/** Faces da placa da agulha: 'loop' (seta circular), 'star' (seta para a estrela) e 'moon' (seta para a lua). */
function signTexture(kind) {
  return canvasTexture(256, 192, (g, w, h) => {
    g.fillStyle = '#f6ebd2'; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 26); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#4f8f8b'; g.beginPath(); g.roundRect(14, 14, w - 28, h - 28, 20); g.stroke();
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 'loop') {
      g.strokeStyle = '#4f8f8b'; g.lineWidth = 18;
      g.beginPath(); g.arc(w / 2, h / 2 + 4, 50, -Math.PI * 0.15, Math.PI * 1.55); g.stroke();
      // ponta da seta
      const a = -Math.PI * 0.15, x = w / 2 + Math.cos(a) * 50, y = h / 2 + 4 + Math.sin(a) * 50;
      g.fillStyle = '#4f8f8b'; g.beginPath(); g.moveTo(x + 22, y + 6); g.lineTo(x - 18, y - 6); g.lineTo(x + 6, y + 34); g.closePath(); g.fill();
    } else if (kind === 'moon') {
      // seta para cima (o norte da maquete) e a lua
      g.strokeStyle = '#3e5f86'; g.lineWidth = 18;
      g.beginPath(); g.moveTo(84, h - 36); g.lineTo(84, 58); g.stroke();
      g.fillStyle = '#3e5f86'; g.beginPath(); g.moveTo(54, 74); g.lineTo(84, 34); g.lineTo(114, 74); g.closePath(); g.fill();
      paintMoon(g, 176, h / 2 + 4, 40);
    } else {
      g.strokeStyle = '#c8553d'; g.lineWidth = 18;
      g.beginPath(); g.moveTo(40, h / 2 + 4); g.lineTo(150, h / 2 + 4); g.stroke();
      g.fillStyle = '#c8553d'; g.beginPath(); g.moveTo(132, h / 2 - 26); g.lineTo(170, h / 2 + 4); g.lineTo(132, h / 2 + 34); g.closePath(); g.fill();
      g.fillStyle = '#e0a84a'; g.strokeStyle = '#a8742c'; g.lineWidth = 5;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const an = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 16 : 36;
        g.lineTo(206 + Math.cos(an) * r, h / 2 + 4 + Math.sin(an) * r);
      }
      g.closePath(); g.fill(); g.stroke();
    }
  }, { repeat: false });
}
/** Plaquinha da janela do nariz: uma nuvenzinha de cheiro entrando num nariz. */
function noseBadgeTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#f6ebd2'; g.beginPath(); g.arc(w / 2, h / 2, 58, 0, TAU); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#4f8f8b'; g.stroke();
    g.fillStyle = '#a8d77f';
    for (const [x, y, r] of [[40, 52, 16], [58, 42, 19], [76, 52, 15], [56, 60, 16]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.fillStyle = '#e2493b'; g.beginPath(); g.arc(78, 86, 16, 0, TAU); g.fill();
    g.strokeStyle = '#6f9a54'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(46, 78); g.quadraticCurveTo(54, 90, 62, 84); g.stroke();
  }, { repeat: false });
}

/**
 * @param {THREE.Object3D} root
 * @param {ReturnType<typeof import('../track.js').createTrack>} track
 */
export function buildRailway(root, track) {
  const grp = new THREE.Group();
  grp.name = 'maquete-do-trem';
  root.add(grp);
  const Y = RAIL_YARD;
  const W = Y.hx * 2, D = Y.hz * 2;
  const frameW = 0.07;
  // ---- base pintada, moldura de madeira e feltro (o feltro fica 1 cm abaixo da moldura)
  add(grp, rbox(W, Y.height - 0.01, D, 0.02), stdMat('#4f8f8b', { roughness: 0.6 }), Y.x, (Y.height - 0.01) / 2, Y.z);
  const frameMat = woodMat('#d7b07c', { key: 'expresso-moldura', rough: 0.6 });
  for (const s of [-1, 1]) {
    add(grp, rbox(W, 0.02, frameW, 0.006), frameMat, Y.x, Y.height, Y.z + s * (Y.hz - frameW / 2));
    add(grp, rbox(frameW, 0.02, D - frameW * 2, 0.006), frameMat, Y.x + s * (Y.hx - frameW / 2), Y.height, Y.z);
  }
  const felt = feltTexture();
  felt.repeat.set((W - frameW * 2) / 1.2, (D - frameW * 2) / 1.2);
  const feltMesh = add(grp, rbox(W - frameW * 2, 0.012, D - frameW * 2, 0.004), new THREE.MeshStandardMaterial({ map: felt, roughness: 1 }), Y.x, Y.height - 0.006, Y.z);
  feltMesh.castShadow = false;

  // ---- trilho: uma faixa por peça (a entrega passa 3 mm acima da volta na agulha) e emendas escuras
  const trackMat = new THREE.MeshStandardMaterial({ map: woodTexture(), vertexColors: true, roughness: 0.62, color: '#e8c79a' });
  const strips = add(grp, mergeGeometries(track.pieces.map((seg) => trackStrip(track, seg))), trackMat);
  strips.name = 'trilho';
  strips.castShadow = false;
  const seams = [];
  const seen = [];
  for (const seg of track.pieces) {
    const p = { x: seg.x0, z: seg.z0 };
    if (seen.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.05)) continue;
    seen.push(p);
    seams.push(new THREE.BoxGeometry(TRACK.width + 0.006, 0.006, 0.012)
      .rotateY(Math.atan2(seg.dx0, seg.dz0)).translate(p.x, YT + seg.lift + 0.002, p.z));
  }
  add(grp, mergeGeometries(seams), stdMat('#8a5a3a', { roughness: 0.7 })).castShadow = false;
  // para-choques no fim do trilho da estrela e da lua (o vagão para encostado neles)
  for (const tail of [track.tails.delivery, track.tails.moon]) {
    const tailEnd = track.sample(tail, tail.length);
    const bumper = new THREE.Group();
    bumper.position.set(tailEnd.x, 0, tailEnd.z);
    bumper.rotation.y = Math.atan2(tailEnd.dx, tailEnd.dz);
    for (const s of [-1, 1]) add(bumper, rbox(0.05, 0.16, 0.05, 0.01), stdMat('#5a3b2c', { roughness: 0.7 }), s * 0.13, Y.height + 0.08, 0.05);
    add(bumper, rbox(0.38, 0.09, 0.06, 0.02), stdMat('#c8553d', { roughness: 0.55 }), 0, 0.31, 0.05);
    for (const s of [-1, 1]) {
      const pad = add(bumper, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), stdMat('#c99a52', { roughness: 0.38, metalness: 0.55 }), s * 0.12, 0.31, 0.01);
      pad.rotation.x = Math.PI / 2;
    }
    grp.add(bumper);
  }

  // ---- cerquinha de ripas sobre a moldura (aberturas: janela do nariz e canaleta)
  const fenceIn = 0.035;
  const fx = Y.hx - fenceIn, zN = Y.z - Y.hz + fenceIn, zS = Y.z + Y.hz - fenceIn;
  const windowHalf = NOSE.halfWidth + 0.06;
  const chuteGap = [CHUTE.x - CHUTE.halfWidth - 0.07, CHUTE.x + CHUTE.halfWidth + 0.07];
  const moonGap = [MOON_CHUTE.x - MOON_CHUTE.halfWidth - 0.07, MOON_CHUTE.x + MOON_CHUTE.halfWidth + 0.07];
  const picketShape = new THREE.Shape();
  picketShape.moveTo(-0.024, 0); picketShape.lineTo(0.024, 0); picketShape.lineTo(0.024, 0.26); picketShape.lineTo(0, 0.3); picketShape.lineTo(-0.024, 0.26); picketShape.closePath();
  const picketBase = new THREE.ExtrudeGeometry(picketShape, { depth: 0.018, bevelEnabled: false }).translate(0, 0, -0.009);
  const pickets = [], rails = [];
  const railY = [Y.height + 0.1, Y.height + 0.24];
  /**
   * Lado da cerca de (ax, az) a (bx, bz). As travessas ficam do lado de fora (`ox`, `oz` = normal para fora),
   * encostadas nas ripas sem dividir o plano delas.
   */
  const side = (ax, az, bx, bz, ox, oz) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.08) return;
    const ang = Math.atan2(bx - ax, bz - az) - Math.PI / 2;
    const n = Math.max(1, Math.round(len / 0.11));
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      pickets.push(picketBase.clone().rotateY(ang).translate(ax + (bx - ax) * k, Y.height + 0.01, az + (bz - az) * k));
    }
    for (const ry of railY) {
      rails.push(new THREE.BoxGeometry(len, 0.03, 0.02).rotateY(ang).translate((ax + bx) / 2 + ox * 0.018, ry, (az + bz) / 2 + oz * 0.018));
    }
  };
  side(-fx, zN, moonGap[0], zN, 0, -1);
  side(moonGap[1], zN, fx, zN, 0, -1);
  side(-fx, zN, -fx, zS, -1, 0);
  side(fx, zN, fx, zS, 1, 0);
  side(-fx, zS, -windowHalf, zS, 0, 1);
  side(windowHalf, zS, chuteGap[0], zS, 0, 1);
  side(chuteGap[1], zS, fx, zS, 0, 1);
  const picketMat = stdMat('#f4ead6', { roughness: 0.7 });
  add(grp, mergeGeometries(pickets), picketMat);
  add(grp, mergeGeometries(rails), stdMat('#4f8f8b', { roughness: 0.55 }));
  // mourões nos cantos e nas aberturas, com bolinhas no topo
  const postMat = stdMat('#3f7d79', { roughness: 0.55 });
  const knobMat = stdMat('#e0a84a', { roughness: 0.5 });
  const posts = [[-fx, zN], [fx, zN], [-fx, zS], [fx, zS], [-windowHalf, zS], [windowHalf, zS], [chuteGap[0], zS], [chuteGap[1], zS],
    [moonGap[0], zN], [moonGap[1], zN]];
  for (const [x, z] of posts) {
    add(grp, rbox(0.065, Y.fenceTop - Y.height + 0.02, 0.065, 0.012), postMat, x, (Y.fenceTop + Y.height + 0.02) / 2, z);
    add(grp, new THREE.SphereGeometry(0.04, 12, 10), knobMat, x, Y.fenceTop + 0.06, z);
  }
  // estrelinhas no topo dos mourões da canaleta (a bandeja da estrela)
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.06), { depth: 0.016, bevelEnabled: false }).translate(0, 0, -0.008);
  for (const x of chuteGap) {
    const st = add(grp, starGeo, stdMat('#e0a84a', { roughness: 0.45, emissive: '#e0a84a', emissiveIntensity: 0.12 }), x, Y.fenceTop + 0.16, zS);
    st.rotation.z = 0.1;
  }
  // luas crescentes no topo dos mourões da canaleta do norte (a bandeja da lua)
  const crescent = new THREE.TorusGeometry(0.05, 0.02, 8, 18, Math.PI * 1.25);
  for (const x of moonGap) {
    const mn = add(grp, crescent, stdMat('#f3e6b0', { roughness: 0.45, emissive: '#e8d48a', emissiveIntensity: 0.12 }), x, Y.fenceTop + 0.16, zN);
    mn.rotation.z = Math.PI * 0.62;
  }
  // janela do nariz: grades de latão nos lados (o meio fica livre para o nariz) e as plaquinhas
  const brass = stdMat('#c99a52', { roughness: 0.38, metalness: 0.55 });
  for (const x of [-0.42, -0.24, 0.24, 0.42]) add(grp, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), brass, x, Y.height + 0.16, zS);
  const bar = add(grp, new THREE.CylinderGeometry(0.014, 0.014, windowHalf * 2 - 0.06, 8), brass, 0, Y.height + 0.31, zS);
  bar.rotation.z = Math.PI / 2;
  const badgeMat = new THREE.MeshStandardMaterial({ map: noseBadgeTexture(), roughness: 0.7 });
  for (const s of [-1, 1]) {
    const b = add(grp, new THREE.CylinderGeometry(0.075, 0.075, 0.018, 24), postMat, s * windowHalf, Y.fenceTop + 0.16, zS);
    b.rotation.x = Math.PI / 2;
    const face = add(grp, new THREE.CircleGeometry(0.07, 24), badgeMat, s * windowHalf, Y.fenceTop + 0.16, zS + 0.0115);
    face.castShadow = false;
  }

  // ---- placa da agulha (prop junction): prisma de três faces que gira para a seta da volta, da estrela ou
  // da lua (sempre para a frente, como uma catraca)
  const sign = new THREE.Group();
  sign.name = 'seta-do-trilho';
  sign.position.set(SWITCH_SIGN.x, 0, SWITCH_SIGN.z);
  grp.add(sign);
  add(sign, new THREE.CylinderGeometry(0.025, 0.03, 0.86, 10), postMat, 0, Y.height + 0.43, 0);
  add(sign, new THREE.CylinderGeometry(0.07, 0.08, 0.03, 16), postMat, 0, Y.height + 0.015, 0);
  const faces = ['loop', 'star', 'moon'].map((k) => new THREE.MeshStandardMaterial({ map: signTexture(k), roughness: 0.6 }));
  /** Prisma triangular com uma face por rota; a face 0 (volta) olha para +Z com o prisma em 0. */
  const prism = (parent, w, h) => {
    const g = new THREE.Group();
    parent.add(g);
    // núcleo: cilindro de 3 lados com as faces a w/(2√3) do eixo (uma delas virada para +Z)
    add(g, new THREE.CylinderGeometry(w / Math.sqrt(3), w / Math.sqrt(3), h + 0.02, 3, 1, false, Math.PI / 3), knobMat);
    const d = w / (2 * Math.sqrt(3)) + 0.003;
    faces.forEach((m, k) => {
      const a = (k * 2 * Math.PI) / 3;
      const f = add(g, new THREE.PlaneGeometry(w * 0.9, h * 0.9), m, Math.sin(a) * d, 0, Math.cos(a) * d);
      f.rotation.y = a;
      f.castShadow = false;
    });
    return g;
  };
  const board = prism(sign, 0.38, 0.28);
  board.position.set(0, 1.12, 0);
  // alavanca dentro da maquete, do lado do pedal: caixa de madeira, alavanca que tomba e uma plaquinha igual à
  // placa grande (o pulo vira as duas ao mesmo tempo)
  const lever = new THREE.Group();
  lever.name = 'alavanca-da-agulha';
  lever.position.set(SWITCH_LEVER.x, Y.height, SWITCH_LEVER.z);
  grp.add(lever);
  add(lever, rbox(SWITCH_LEVER.hx * 2, 0.28, SWITCH_LEVER.hz * 2, 0.02), woodMat('#b98457', { key: 'expresso-caixa', rough: 0.7 }), 0, 0.14, 0);
  add(lever, rbox(SWITCH_LEVER.hx * 2 + 0.012, 0.03, SWITCH_LEVER.hz * 2 + 0.012, 0.01), postMat, 0, 0.27, 0);
  const handle = new THREE.Group();
  handle.position.set(0, 0.285, 0);
  lever.add(handle);
  add(handle, new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), brass, 0, 0.15, 0);
  add(handle, new THREE.SphereGeometry(0.045, 14, 10), stdMat('#c8553d', { roughness: 0.4 }), 0, 0.31, 0);
  // plaquinha num pino na frente da caixa, acima da cerca (a câmera e quem está no pedal veem)
  const mini = prism(lever, 0.16, 0.12);
  mini.position.set(0, 0.43, SWITCH_LEVER.hz - 0.02);
  add(lever, new THREE.CylinderGeometry(0.01, 0.01, 0.14, 6), brass, 0, 0.32, SWITCH_LEVER.hz - 0.02);
  // haste do pedal: corre no chão até a base da maquete e, por cima do feltro, até a caixa da alavanca
  const baseX = Y.x - Y.hx;
  const floorLink = add(grp, new THREE.CylinderGeometry(0.014, 0.014, baseX - (PEDAL.x + PEDAL.r) + 0.03, 8), brass,
    (baseX + PEDAL.x + PEDAL.r) / 2, 0.035, PEDAL.z);
  floorLink.rotation.z = Math.PI / 2;
  const feltLink = add(grp, new THREE.CylinderGeometry(0.012, 0.012, SWITCH_LEVER.x - SWITCH_LEVER.hx - (baseX + 0.07) + 0.02, 8), brass,
    (SWITCH_LEVER.x - SWITCH_LEVER.hx + baseX + 0.07) / 2, Y.height + 0.03, SWITCH_LEVER.z);
  feltLink.rotation.z = Math.PI / 2;
  // a catraca só anda para a frente: cada rota nova soma um terço de volta ao alvo
  const ORDER = ['loop', 'delivery', 'moon'];
  const STEP = (2 * Math.PI) / 3;
  const sw = { route: 'loop', turns: 0, angle: 0, lever: 0.5 };
  /** @type {import('../../../types').Fase6Props['junction']} */
  const junction = {
    object: sign,
    setRoute(route) {
      sw.turns += (ORDER.indexOf(route) - ORDER.indexOf(sw.route) + 3) % 3;
      sw.route = route;
    },
  };
  function updateSwitch(dt) {
    const target = -sw.turns * STEP;
    sw.angle += Math.sign(target - sw.angle) * Math.min(Math.abs(target - sw.angle), dt * 4.2);
    board.rotation.y = sw.angle;
    mini.rotation.y = sw.angle;
    const tilt = 0.5 - ORDER.indexOf(sw.route) * 0.5;
    sw.lever += Math.sign(tilt - sw.lever) * Math.min(Math.abs(tilt - sw.lever), dt * 3);
    handle.rotation.z = sw.lever;
  }
  function snapSwitch() { sw.turns = ORDER.indexOf(sw.route); sw.angle = -sw.turns * STEP; sw.lever = 0.5 - sw.turns * 0.5; updateSwitch(0); }

  // ---- estação: plataforma, casinha com telhado, poste de luz e banquinho (posições em YARD_DECOR)
  const station = new THREE.Group();
  station.name = 'estacao';
  grp.add(station);
  const cream = stdMat('#f3e6cc', { roughness: 0.7 });
  const roofMat = stdMat('#c8553d', { roughness: 0.6 });
  const P = DECOR.platform, Hs = DECOR.station;
  add(station, rbox(P.hx * 2, 0.06, P.hz * 2, 0.012), woodMat('#cfa678', { key: 'expresso-plataforma', rough: 0.7 }), P.x, Y.height + 0.03, P.z);
  add(station, rbox(Hs.hx * 2, 0.28, Hs.hz * 2, 0.015), cream, Hs.x, Y.height + 0.14, Hs.z);
  for (const s of [-1, 1]) {
    const r = add(station, rbox(Hs.hx * 2 + 0.08, 0.025, Hs.hz + 0.06, 0.008), roofMat, Hs.x, Y.height + 0.355, Hs.z + s * 0.135);
    r.rotation.x = s * 0.5;
  }
  // janelas e porta nas faces que a câmera vê (sul e leste)
  const winDecal = new THREE.MeshStandardMaterial({ color: '#3e5a5e', roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const dx of [-0.13, 0.13]) {
    const w = add(station, new THREE.PlaneGeometry(0.08, 0.08), winDecal, Hs.x + dx, Y.height + 0.19, Hs.z + Hs.hz + 0.001);
    w.castShadow = false;
  }
  const east = add(station, new THREE.PlaneGeometry(0.14, 0.08), winDecal, Hs.x + Hs.hx + 0.001, Y.height + 0.19, Hs.z);
  east.rotation.y = Math.PI / 2;
  east.castShadow = false;
  const door = add(station, new THREE.PlaneGeometry(0.09, 0.16), decal('#7a4a2c'), Hs.x, Y.height + 0.08, Hs.z + Hs.hz + 0.001);
  door.castShadow = false;
  const L = DECOR.lampPost, Bn = DECOR.bench;
  add(station, new THREE.CylinderGeometry(0.012, 0.014, 0.42, 8), postMat, L.x, Y.height + 0.27, L.z);
  add(station, new THREE.SphereGeometry(0.04, 12, 10), stdMat('#fff1cf', { roughness: 0.4, emissive: '#ffd58a', emissiveIntensity: 0.5 }), L.x, Y.height + 0.5, L.z);
  add(station, rbox(0.06, 0.05, 0.2, 0.008), woodMat('#8a5a3a', { key: 'expresso-banco', rough: 0.7 }), Bn.x, Y.height + 0.085, Bn.z);

  // ---- cancela da estrela (prop barrier): braço listrado que sobe com alguém na placa do lado de fora
  const barrierGrp = new THREE.Group();
  barrierGrp.name = 'cancela';
  barrierGrp.position.set(BARRIER.postX, Y.height, BARRIER.z);
  grp.add(barrierGrp);
  add(barrierGrp, rbox(0.06, 0.42, 0.06, 0.012), postMat, 0, 0.21, 0);
  add(barrierGrp, rbox(0.1, 0.03, 0.1, 0.01), postMat, 0, 0.015, 0);
  const lamp = { red: new THREE.MeshStandardMaterial({ color: '#d9473a', emissive: '#ff4a32', emissiveIntensity: 0.9, roughness: 0.3 }),
    green: new THREE.MeshStandardMaterial({ color: '#4f9b5a', emissive: '#52e07a', emissiveIntensity: 0, roughness: 0.3 }) };
  // caixinha das luzes no alto do mourão, virada para a câmera (vermelha = fechada, verde = aberta)
  add(barrierGrp, rbox(0.07, 0.12, 0.05, 0.012), stdMat('#2f2724', { roughness: 0.6 }), 0, 0.48, 0.02);
  add(barrierGrp, new THREE.SphereGeometry(0.02, 10, 8), lamp.red, 0, 0.51, 0.048);
  add(barrierGrp, new THREE.SphereGeometry(0.02, 10, 8), lamp.green, 0, 0.45, 0.048);
  const armPivot = new THREE.Group();
  armPivot.position.set(-0.045, 0.34, 0);
  barrierGrp.add(armPivot);
  const stripes = canvasTexture(128, 16, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f6efe2' : '#d9473a'; g.fillRect((i * w) / 8, 0, w / 8 + 1, h); }
  }, { repeat: false });
  const ARM = BARRIER.postX - BARRIER.x + 0.3; // passa do outro lado do trilho
  add(armPivot, rbox(ARM, 0.04, 0.025, 0.01), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.55 }), -ARM / 2, 0, 0);
  add(armPivot, rbox(0.08, 0.06, 0.04, 0.012), stdMat('#2f2724', { roughness: 0.6 }), 0.06, 0, 0);
  /** @type {import('../../../types').Fase6Props['barrier']} */
  const barrier = {
    object: barrierGrp,
    setOpen(k) {
      const e = Math.min(1, Math.max(0, k));
      armPivot.rotation.z = -e * (Math.PI / 2);
      lamp.red.emissiveIntensity = 0.9 * (1 - e);
      lamp.green.emissiveIntensity = 0.9 * e;
    },
  };
  barrier.setOpen(0);
  // cabo da placa até a cancela: no chão até a base e, por cima do feltro, até o mourão
  const yardE = Y.x + Y.hx;
  const plateLink = add(grp, new THREE.CylinderGeometry(0.012, 0.012, BARRIER_PLATE.x - BARRIER_PLATE.r - yardE + 0.03, 8), brass,
    (BARRIER_PLATE.x - BARRIER_PLATE.r + yardE) / 2, 0.03, BARRIER.z + 0.08);
  plateLink.rotation.z = Math.PI / 2;
  const feltCable = add(grp, new THREE.CylinderGeometry(0.01, 0.01, yardE - 0.07 - BARRIER.postX, 8), brass, (yardE - 0.07 + BARRIER.postX) / 2, Y.height + 0.025, BARRIER.z + 0.08);
  feltCable.rotation.z = Math.PI / 2;

  // ---- elevador de vidro da estação (prop loader): a lua sobe por ele e a bica despeja no vagão
  const loaderGrp = new THREE.Group();
  loaderGrp.name = 'elevador-da-lua';
  loaderGrp.position.set(LOADER.x, Y.height, LOADER.z);
  grp.add(loaderGrp);
  add(loaderGrp, rbox(0.16, 0.06, 0.16, 0.012), postMat, 0, 0.03, 0);
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe6ee', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false });
  const tube = add(loaderGrp, new THREE.CylinderGeometry(0.055, 0.055, LOADER.top - 0.22, 18, 1, true), glass, 0, (LOADER.top - 0.22) / 2 + 0.06, 0);
  tube.castShadow = false;
  for (const y of [0.07, LOADER.top - 0.16]) {
    const ring = add(loaderGrp, new THREE.TorusGeometry(0.058, 0.01, 6, 20), brass, 0, y, 0);
    ring.rotation.x = Math.PI / 2;
  }
  add(loaderGrp, new THREE.CylinderGeometry(0.075, 0.07, 0.06, 16), knobMat, 0, LOADER.top - Y.height + 0.0, 0);
  const spout = new THREE.Group();
  spout.position.set(-0.04, LOADER.top - Y.height, 0);
  loaderGrp.add(spout);
  add(spout, rbox(0.26, 0.025, 0.07, 0.008), brass, -0.13, 0, 0);
  for (const s of [-1, 1]) add(spout, rbox(0.26, 0.04, 0.012, 0.004), brass, -0.13, 0.02, s * 0.035);
  /** @type {import('../../../types').Fase6Props['loader']} */
  const loader = {
    object: loaderGrp,
    setSpout(k) { spout.rotation.z = -1.1 + Math.min(1, Math.max(0, k)) * 1.55; },
  };
  loader.setSpout(0);

  // ---- linha de estrelas ao lado do trilho da entrega, até a canaleta
  const stars = [];
  const del = track.routes.delivery;
  const tmp = { x: 0, z: 0, dx: 0, dz: 0 };
  for (let s = 1.45; s < del.length + TRACK.tail.delivery - 0.4; s += 0.42) {
    del.at(s, tmp);
    stars.push(new THREE.ShapeGeometry(starShape(0.05)).rotateX(-Math.PI / 2).rotateY(Math.atan2(tmp.dx, tmp.dz) + Math.PI)
      .translate(tmp.x - tmp.dz * 0.34, Y.height + 0.001, tmp.z + tmp.dx * 0.34));
  }
  add(grp, mergeGeometries(stars), decal('#f2c766', { emissive: '#e0a84a', emissiveIntensity: 0.25 })).castShadow = false;

  // ---- cenário de feltro: laguinho com patinho, arvorezinhas, arbustos e caixa d'água de brinquedo
  const Pd = DECOR.pond;
  const pond = add(grp, new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), decal('#7fb5c9', { roughness: 0.35 }), Pd.x, Y.height + 0.002, Pd.z);
  pond.scale.set(Pd.hx - 0.04, 1, Pd.hz - 0.04);
  pond.castShadow = false;
  const r = rng(17);
  const pebbleMat = stdMat('#cfc6b4', { roughness: 0.9 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + r() * 0.2;
    const p = add(grp, new THREE.SphereGeometry(0.018 + r() * 0.01, 8, 6), pebbleMat, Pd.x + Math.cos(a) * (Pd.hx - 0.025), Y.height + 0.008, Pd.z + Math.sin(a) * (Pd.hz - 0.025));
    p.scale.y = 0.55;
  }
  const duck = createRubberDuck(0.09);
  duck.name = 'patinho-do-laguinho';
  duck.traverse((o) => { delete o.userData.carryKind; });
  duck.position.set(Pd.x + 0.02, Y.height + 0.002, Pd.z - 0.05);
  duck.rotation.y = 0.8;
  grp.add(duck);
  const treeMats = [stdMat('#5f8f4a', { roughness: 1 }), stdMat('#7aa857', { roughness: 1 })];
  const trunkMat = stdMat('#8a5a3a', { roughness: 0.8 });
  // a copa de cada árvore tem o raio do enfeite (r = 0,12 · tamanho)
  [DECOR.treeA, DECOR.treeB, DECOR.treeC, DECOR.treeD, DECOR.treeE, DECOR.treeF].forEach(({ x, z, r: rad }, i) => {
    const k = rad / 0.12;
    add(grp, new THREE.CylinderGeometry(0.018 * k, 0.022 * k, 0.1 * k, 8), trunkMat, x, Y.height + 0.05 * k, z);
    add(grp, new THREE.ConeGeometry(0.12 * k, 0.22 * k, 12), treeMats[i % 2], x, Y.height + 0.19 * k, z);
    add(grp, new THREE.ConeGeometry(0.09 * k, 0.17 * k, 12), treeMats[(i + 1) % 2], x, Y.height + 0.31 * k, z);
  });
  for (const { x, z, r: s } of [DECOR.bushA, DECOR.bushB, DECOR.bushC]) {
    const b = add(grp, new THREE.SphereGeometry(s, 12, 10), treeMats[0], x, Y.height + s * 0.6, z);
    b.scale.y = 0.75;
  }
  // caixa d'água: quatro pés, tanque e chapéu
  const tower = new THREE.Group();
  tower.position.set(DECOR.tower.x, Y.height, DECOR.tower.z);
  grp.add(tower);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(tower, new THREE.CylinderGeometry(0.012, 0.014, 0.36, 6), trunkMat, dx * 0.08, 0.18, dz * 0.08);
  add(tower, new THREE.CylinderGeometry(0.12, 0.12, 0.18, 18), stdMat('#4f8f8b', { roughness: 0.55 }), 0, 0.45, 0);
  add(tower, new THREE.ConeGeometry(0.14, 0.1, 18), roofMat, 0, 0.59, 0);

  return {
    group: grp, junction, barrier, loader,
    update(dt) { updateSwitch(dt); },
    reset() { sw.route = 'loop'; snapSwitch(); barrier.setOpen(0); loader.setSpout(0); },
  };
}
