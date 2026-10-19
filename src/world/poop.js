// Cocozinho de desenho (extra escondido, src/game/extras.js): uma espiral contínua de "sorvete" marrom e brilhante
// que afina até a pontinha enrolada, com base arredondada, carinha discreta (olhos com brilho e sorrisinho) e três
// fumacinhas claras de cheiro. Base no chão (y = 0), ~11 cm de largura na escala 1. Tudo procedural.
//   appear(dur): vai saindo de baixo para cima em `dur` s (a espiral se revela ao longo do tubo) e assenta com um
//   balancinho; os olhinhos abrem no fim. update(dt): o balancinho e as fumacinhas.
//   shine(): a recompensa do segredo. Acende uma luz dourada, sobe um feixe de luz, dá um pulinho feliz (olhinhos
//   fechados de alegria e bochechas rosadas) e a estrelinha da ponta brilha; depois fica um calorzinho dourado e a
//   estrelinha pisca de vez em quando. dispose(): tira da cena e libera geometrias e materiais.
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
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Feixe de luz: cilindro aberto, mais largo em cima, que some para cima (alfa por vértice). */
function beamGeometry(r0, r1, h) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 24, 8, true);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / h;
    col.set([1, 0.8, 0.4, (1 - y) ** 1.8 * Math.min(1, 0.25 + y * 6)], i * 4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  return g;
}
/** Estrelinha de quatro pontas no plano XY. */
function starGeometry(rOut, rIn) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 2;
    const r = i % 2 ? rIn : rOut;
    if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(sh);
}

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
  const dark = new THREE.Color('#4e2b14');
  const light = new THREE.Color('#a86c3e');
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
      // sulco escuro entre as voltas (embaixo do tubo) e crista clara em cima
      c.copy(dark).lerp(light, (0.35 + 0.65 * Math.min(1, 0.4 + u)) * (0.35 + 0.65 * Math.max(0, 0.3 + 0.7 * cs)));
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
    color: '#ffffff', vertexColors: true, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.16, sheen: 0.35, sheenColor: new THREE.Color('#c08a5e'),
    side: THREE.DoubleSide, // enquanto sai, a ponta aberta mostra o lado de dentro (marrom, não cinza)
  });
  const coil = new THREE.Mesh(geo, mat);
  coil.castShadow = true;
  body.add(coil);
  const triCount = idx.length;
  // base: um disquinho arredondado que fecha o começo da espiral
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.047, 20, 10), new THREE.MeshPhysicalMaterial({ color: '#5a3219', roughness: 0.42, clearcoat: 0.6 }));
  base.scale.set(1, 0.42, 1);
  base.position.y = 0.016;
  base.castShadow = true;
  body.add(base);
  // pontinha arredondada
  const tip = new THREE.Mesh(new THREE.SphereGeometry(tubeR(1) * 1.05, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#a86c3e', roughness: 0.34, clearcoat: 0.8 }));
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
  // alegria (shine): olhinhos fechados em arco e bochechas rosadas
  const arcMat = new THREE.MeshStandardMaterial({ color: '#140b07', roughness: 0.4 });
  const arcs = [];
  for (const sx of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.0058, 0.0017, 6, 14, Math.PI), arcMat);
    arc.position.set(sx * 0.0125, 0.002, 0.002);
    arc.scale.setScalar(0.001);
    face.add(arc);
    arcs.push(arc);
  }
  const blushMat = new THREE.MeshBasicMaterial({ color: '#ff8da1', transparent: true, opacity: 0, depthWrite: false });
  for (const sx of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.0062, 16), blushMat);
    blush.position.set(sx * 0.0235, -0.006, 0.0015);
    blush.scale.y = 0.7;
    face.add(blush);
  }
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

  // brilho do segredo: luz dourada no próprio cocô, feixe de luz e a estrelinha da ponta (com um halo)
  const glowMats = [mat, base.material, tip.material];
  for (const m of glowMats) {
    m.emissive.set('#ffb12e');
    m.emissiveIntensity = 0;
  }
  const beamMat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beam = new THREE.Group();
  beam.add(new THREE.Mesh(beamGeometry(0.05, 0.1, 0.95), beamMat), new THREE.Mesh(beamGeometry(0.13, 0.24, 0.7), beamMat));
  beam.visible = false;
  root.add(beam);
  const glintMat = new THREE.MeshBasicMaterial({ color: '#fff3c2', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const haloMat = new THREE.MeshBasicMaterial({ color: '#ffcf5a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const glint = new THREE.Group();
  glint.add(new THREE.Mesh(new THREE.CircleGeometry(0.026, 20), haloMat), new THREE.Mesh(starGeometry(0.045, 0.007), glintMat));
  spiral(1, glint.position);
  glint.position.x += 0.014;
  glint.position.y += 0.026;
  glint.position.z += 0.02;
  glint.visible = false;
  body.add(glint);
  root.scale.setScalar(scale);
  beam.scale.setScalar(1 / scale); // o feixe tem o mesmo tamanho com as duas dogs

  const S = { t: -1, age: 0, dur: 0.6, shine: -1 };
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
    let wob = u < 0.9 ? Math.exp(-u * 6) * Math.sin(u * 24) : 0;
    const happy = S.shine >= 0 ? stepShine(dt) : 0;
    // pulinho do brilho: estica subindo e amassa no pouso (mola)
    const jt = S.shine - 0.08;
    const lw = jt - 0.42;
    const jumping = S.shine >= 0 && jt > 0 && jt < 0.42;
    if (jumping) wob -= Math.sin((Math.PI * jt) / 0.42) * 0.45;
    if (S.shine >= 0 && lw > 0 && lw < 1) wob += Math.exp(-lw * 7) * Math.sin(lw * 26) * 1.1;
    body.position.y = jumping ? Math.sin((Math.PI * jt) / 0.42) * 0.045 : 0;
    body.scale.set(1 + wob * 0.12, 1 - wob * 0.18, 1 + wob * 0.12);
    body.rotation.y = Math.sin(S.age * 1.3) * 0.06;
    // olhinhos abrem um tempinho depois e piscam de vez em quando (felizes: fechados em arco)
    const open = Math.min(1, Math.max(0, (u - 0.35) / 0.2));
    const blink = (S.age % 3.2) > 3.05 ? 0.15 : 1;
    for (const e of eyes) e.scale.y = 1.2 * Math.max(0.05, open * blink * (1 - happy));
    for (const a of arcs) a.scale.setScalar(Math.max(0.001, happy));
    smile.scale.set(1 + happy * 0.45, 1 + happy * 0.3, 1);
    blushMat.opacity = happy * 0.6;
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
  /** O brilho, s desde shine(); devolve a alegria da carinha (0..1). */
  function stepShine(dt) {
    S.shine += dt;
    const g = S.shine;
    // luz dourada: acende rápido, fica e assenta num calorzinho
    const glow = g < 0.12 ? g / 0.12 : g < 0.9 ? 1 - (g - 0.12) * 0.3 : Math.max(0.07, 0.77 * Math.exp(-(g - 0.9) * 1.3));
    for (const m of glowMats) m.emissiveIntensity = glow * 0.85;
    // feixe de luz: sobe, gira devagar e some
    const bo = g < 0.18 ? g / 0.18 : Math.max(0, 1 - (g - 0.18) / 1.6);
    beam.visible = bo > 0.003;
    beamMat.opacity = bo * 0.85;
    beam.rotation.y += dt * 0.8;
    const grow = 0.55 + 0.45 * sstep(0, 0.3, g);
    beam.scale.set((1 + g * 0.12) / scale, grow / scale, (1 + g * 0.12) / scale);
    // estrelinha: abre grande girando, assenta e depois pisca a cada 2,4 s
    let st = 0;
    let so = 0;
    if (g > 0.2 && g < 1.6) {
      st = sstep(0.2, 0.36, g) * (1.4 - 0.4 * sstep(0.36, 0.6, g));
      so = 1 - sstep(1.1, 1.6, g);
    } else if (g >= 1.6) {
      const c = (g - 1.6) % 2.4;
      st = c < 0.36 ? Math.sin((Math.PI * c) / 0.36) * 0.75 : 0;
      so = st > 0 ? 0.9 : 0;
    }
    glint.visible = st > 0.01;
    glint.scale.setScalar(Math.max(0.001, st));
    glint.rotation.z = g * 1.6;
    glintMat.opacity = so;
    haloMat.opacity = so * 0.45;
    return sstep(0.05, 0.2, g) * (1 - sstep(3.2, 3.8, g));
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
    /** A recompensa do segredo (brilho dourado, feixe, pulinho e carinha feliz). */
    shine() {
      S.shine = 0;
    },
    /** Tira da cena e libera os recursos (o reinício limpa o chão). */
    dispose() {
      root.removeFromParent();
      root.traverse((o) => {
        const m = /** @type {any} */ (o);
        m.geometry?.dispose();
        if (m.material) for (const x of Array.isArray(m.material) ? m.material : [m.material]) x.dispose();
      });
    },
  };
}
