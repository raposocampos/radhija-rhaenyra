// FASE 7 · Brinquedos do parquinho, todos molhados de chuva: escorregador com casinha (deque, telhadinho
// listrado, painéis com escotilha, escadinha e a rampa amarela brilhante), balanço com correntes, gangorra,
// caixa de areia (areia molhada, baldinho, pazinha e um castelinho derretido) e a joaninha de mola.
// As medidas vêm do layout (SLIDE, TOWER, SWINGS, SEESAW, SANDBOX, SPRING_RIDER), as mesmas dos colisores.
import * as THREE from 'three';
import { woodMat, stdMat, rbox, rng, fbm2, vnoise2, paint, mat, contactShadow, stripeTexture } from '../../../world/util.js';

const wetPlastic = (color, key) => mat(`f7-plastic-${key || color}`, () => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.1,
}));
const wetMetal = (color) => mat(`f7-metal-${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.55 }));

function shadowed(obj) {
  obj.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

/** Gotinhas de chuva paradas numa superfície (pontinhos brilhantes instanciados). */
function droplets(group, count, place, seed) {
  const geo = new THREE.SphereGeometry(0.006, 6, 4);
  geo.scale(1, 0.45, 1);
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transmission: 0, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.55 });
  const im = new THREE.InstancedMesh(geo, m, count);
  const r = rng(seed);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const { x, y, z, nx = 0, ny = 1, nz = 0 } = place(r);
    p.set(x, y, z);
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, ny, nz).normalize());
    const k = 0.6 + r() * 1.2;
    s.set(k, k, k);
    m4.compose(p, q, s);
    im.setMatrixAt(i, m4);
  }
  im.userData.noShadow = true;
  group.add(im);
  return im;
}

// ==================================================================== escorregador
function buildSlide(group, layout) {
  const SL = layout.SLIDE, T = layout.TOWER;
  const g = new THREE.Group();
  g.name = 'escorregador';
  const wood = woodMat('#c79a63', { key: 'f7-tower-wood', vertical: true, rough: 0.7 });
  const x0 = T.x - T.hx, x1 = T.x + T.hx, z0 = T.z - T.hz, z1 = T.z + T.hz;
  // postes
  for (const [x, z] of [[x0 + 0.05, z0 + 0.05], [x1 - 0.05, z0 + 0.05], [x0 + 0.05, z1 - 0.05], [x1 - 0.05, z1 - 0.05]]) {
    const p = new THREE.Mesh(rbox(0.095, T.roof, 0.095, 0.015), wood);
    p.position.set(x, T.roof / 2, z);
    g.add(p);
    const foot = contactShadow(0.1, 0.1, 0.4);
    foot.position.set(x, 0.006, z);
    g.add(foot);
  }
  // deque (topo em SLIDE.deck)
  const deck = new THREE.Mesh(rbox(T.hx * 2 + 0.04, 0.06, T.hz * 2 + 0.04, 0.012), woodMat('#b98a55', { key: 'f7-deck', rough: 0.6 }));
  deck.position.set(T.x, SL.deck - 0.03, T.z);
  g.add(deck);
  // tábuas do deque (frestas) por cima
  for (let k = 0; k < 6; k++) {
    const pl = new THREE.Mesh(rbox(T.hx * 2 - 0.02, 0.012, (T.hz * 2 - 0.06) / 6 - 0.012, 0.004), woodMat('#c69a62', { key: 'f7-plank', rough: 0.55 }));
    pl.position.set(T.x, SL.deck + 0.003, z0 + 0.04 + ((k + 0.5) * (T.hz * 2 - 0.08)) / 6);
    g.add(pl);
  }
  // painéis com escotilha nos lados norte e sul
  const panelMat = wetPlastic('#4fa3d9', 'panel');
  const ringMat = wetPlastic('#f4cf4a', 'ring');
  // painel com escotilha só no lado norte; no sul (de onde a câmera olha) um guarda-corpo vazado, para a dog no deque aparecer
  for (const z of [z0 + 0.02]) {
    const shape = new THREE.Shape();
    const w = T.hx * 2 - 0.14, h = 0.5;
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h); shape.lineTo(-w / 2, h); shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, h * 0.52, 0.13, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const panel = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 }), panelMat);
    panel.position.set(T.x, SL.deck + 0.05, z - 0.015);
    g.add(panel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 8, 28), ringMat);
    ring.position.set(T.x, SL.deck + 0.05 + h * 0.52, z + (z < T.z ? -0.03 : 0.03));
    g.add(ring);
  }
  for (const y of [0.24, 0.5]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, T.hx * 2 - 0.12, 10).rotateZ(Math.PI / 2), ringMat);
    bar.position.set(T.x, SL.deck + y, z1 - 0.05);
    g.add(bar);
  }
  for (let k = 1; k < 5; k++) {
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), wetMetal('#4fa3d9'));
    spindle.position.set(x0 + 0.05 + (k * (T.hx * 2 - 0.1)) / 5, SL.deck + 0.36, z1 - 0.05);
    g.add(spindle);
  }
  // corrimãos do lado da rampa (oeste) e da escadinha (leste)
  for (const z of [T.z - 0.28, T.z + 0.28]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.017, 8, 20, Math.PI), wetMetal('#e8574a'));
    h.position.set(x0 + 0.06, SL.deck + 0.02, z);
    h.rotation.y = Math.PI / 2;
    g.add(h);
  }
  // telhadinho listrado (quatro águas)
  const roofTex = stripeTexture('#fff4e2', '#e8574a', 10);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(T.hx, T.hz) * 1.06, 0.55, 4, 1, false, Math.PI / 4), new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.55 }));
  roof.position.set(T.x, T.roof + 0.27, T.z);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), ringMat);
  tip.position.set(T.x, T.roof + 0.57, T.z);
  // bandeirinha
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), wetMetal('#d8d4cb'));
  mast.position.set(T.x, T.roof + 0.74, T.z);
  const flagGeo = new THREE.PlaneGeometry(0.2, 0.12, 6, 1).translate(0.1, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: '#6fbf5a', side: THREE.DoubleSide, roughness: 0.7 }));
  flag.position.set(T.x, T.roof + 0.83, T.z);
  g.add(roof, tip, mast, flag);
  // escadinha (lado leste)
  const ladderX = x1 + 0.1;
  for (const z of [T.z - 0.22, T.z + 0.22]) {
    const rail = new THREE.Mesh(rbox(0.05, SL.deck + 0.42, 0.05, 0.012), wood);
    rail.position.set(ladderX + 0.04, (SL.deck + 0.42) / 2, z);
    rail.rotation.z = 0.08;
    g.add(rail);
  }
  for (let k = 1; k <= 4; k++) {
    const y = (k * SL.deck) / 4.6;
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8).rotateX(Math.PI / 2), wetMetal('#f4cf4a'));
    rung.position.set(ladderX + 0.04 - y * 0.08, y, T.z);
    g.add(rung);
  }
  // rampa: do deque (x1 do escorregador) ao chão (x0), a superfície coincide com slideY do puzzle
  const L = Math.hypot(SL.x1 - SL.x0, SL.deck);
  const ang = Math.atan2(SL.deck, SL.x1 - SL.x0);
  const chute = new THREE.Group();
  chute.position.set((SL.x0 + SL.x1) / 2, SL.deck / 2, SL.z);
  chute.rotation.z = ang;
  const yellow = wetPlastic('#f6c33f', 'chute');
  const bed = new THREE.Mesh(rbox(L + 0.04, 0.035, SL.halfWidth * 2 - 0.04, 0.012), yellow);
  bed.position.y = -0.018;
  chute.add(bed);
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(rbox(L + 0.06, 0.16, 0.04, 0.015), wetPlastic('#f39a3d', 'chute-wall'));
    wall.position.set(0, 0.05, s * (SL.halfWidth - 0.02));
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, L + 0.06, 10).rotateZ(Math.PI / 2), wetPlastic('#f39a3d', 'chute-wall'));
    lip.position.set(0, 0.13, s * (SL.halfWidth - 0.02));
    chute.add(wall, lip);
  }
  // gotas paradas na rampa
  droplets(chute, 70, (r) => ({ x: (r() - 0.5) * L * 0.95, y: 0.001, z: (r() - 0.5) * (SL.halfWidth * 2 - 0.12) }), 5);
  g.add(chute);
  // pé de apoio no meio da rampa
  const legX = SL.x0 + (SL.x1 - SL.x0) * 0.45;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, SL.deck * 0.45, 10), wetMetal('#4fa3d9'));
  leg.position.set(legX, SL.deck * 0.225 - 0.03, SL.z);
  g.add(leg);
  const sh = contactShadow((SL.x1 - SL.x0) * 0.55, SL.halfWidth + 0.12, 0.32);
  sh.position.set((SL.x0 + SL.x1) / 2 - 0.1, 0.007, SL.z);
  g.add(sh);
  const tsh = contactShadow(T.hx + 0.2, T.hz + 0.2, 0.42);
  tsh.position.set(T.x, 0.007, T.z);
  g.add(tsh);
  shadowed(g);
  group.add(g);
  return {
    object: g,
    update(t) {
      // a bandeirinha balança com o vento
      const p = flagGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        p.setZ(i, Math.sin(t * 5 - x * 25) * 0.02 * (x / 0.2));
      }
      p.needsUpdate = true;
    },
  };
}

// ==================================================================== balanço
function buildSwings(group, layout) {
  const S = layout.SWINGS;
  const g = new THREE.Group();
  g.name = 'balanco';
  const frame = wetMetal('#3f6fa8');
  const joint = wetPlastic('#f4cf4a', 'joint');
  const legLen = Math.hypot(S.height, 0.42);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, legLen, 12), frame);
      leg.position.set(S.x + sx * S.halfSpan, S.height / 2, S.z + sz * 0.21);
      leg.rotation.x = -sz * Math.atan2(0.42, S.height);
      g.add(leg);
      const foot = contactShadow(0.08, 0.08, 0.4);
      foot.position.set(S.x + sx * S.halfSpan, 0.006, S.z + sz * 0.42);
      g.add(foot);
    }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), joint);
    cap.position.set(S.x + sx * (S.halfSpan + 0.02), S.height, S.z);
    g.add(cap);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, S.halfSpan * 2 + 0.06, 12).rotateZ(Math.PI / 2), frame);
  beam.position.set(S.x, S.height, S.z);
  g.add(beam);
  const seats = [];
  const seatCols = ['#e8574a', '#6fbf5a'];
  S.seats.forEach((ox, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(S.x + ox, S.height - 0.02, S.z);
    const chainMat = wetMetal('#5b5752');
    for (const sx of [-1, 1]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, S.height - 0.45, 5), chainMat);
      chain.position.set(sx * 0.17, -(S.height - 0.45) / 2, 0);
      pivot.add(chain);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), chainMat);
      hook.position.set(sx * 0.17, 0, 0);
      pivot.add(hook);
    }
    // assento de borracha curvo
    const seatGeo = new THREE.BoxGeometry(0.42, 0.025, 0.16, 12, 1, 2);
    const p = seatGeo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) + (p.getX(k) / 0.21) ** 2 * 0.04);
    seatGeo.computeVertexNormals();
    const seat = new THREE.Mesh(seatGeo, wetPlastic(seatCols[i], `seat${i}`));
    seat.position.y = -(S.height - 0.45) - 0.02;
    pivot.add(seat);
    droplets(seat, 10, (r) => ({ x: (r() - 0.5) * 0.36, y: 0.014 + 0.0, z: (r() - 0.5) * 0.12 }), 9 + i);
    g.add(pivot);
    seats.push({ pivot, ph: i * 2.1 });
  });
  shadowed(g);
  group.add(g);
  return {
    object: g,
    update(t) {
      for (const s of seats) s.pivot.rotation.z = Math.sin(t * 1.1 + s.ph) * 0.035 + Math.sin(t * 0.37 + s.ph) * 0.02;
    },
  };
}

// ==================================================================== gangorra
function buildSeesaw(group, layout) {
  const S = layout.SEESAW;
  const g = new THREE.Group();
  g.name = 'gangorra';
  g.position.set(S.x, 0, S.z);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.3, 4).rotateY(Math.PI / 4), wetPlastic('#4fa3d9', 'stand'));
  stand.position.y = 0.15;
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 12).rotateX(Math.PI / 2), wetMetal('#d8d4cb'));
  axle.position.y = 0.32;
  const beamGroup = new THREE.Group();
  beamGroup.position.y = 0.33;
  beamGroup.rotation.z = -0.17;
  const plank = new THREE.Mesh(rbox(S.halfLength * 2, 0.05, 0.2, 0.015), wetPlastic('#e8574a', 'seesaw'));
  plank.position.y = 0.03;
  beamGroup.add(plank);
  for (const sx of [-1, 1]) {
    const seat = new THREE.Mesh(rbox(0.26, 0.04, 0.24, 0.02), wetPlastic('#f4cf4a', 'seesaw-seat'));
    seat.position.set(sx * (S.halfLength - 0.15), 0.072, 0); // assento afundado 3 mm na tábua
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 16, Math.PI), wetMetal('#3f6fa8'));
    handle.position.set(sx * (S.halfLength - 0.36), 0.06, 0);
    handle.rotation.y = Math.PI / 2;
    beamGroup.add(seat, handle);
    const bump = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 12), stdMat('#3a3633', { roughness: 0.9 }));
    bump.position.set(sx * (S.halfLength - 0.12), 0.025, 0);
    g.add(bump);
  }
  g.add(stand, axle, beamGroup);
  const sh = contactShadow(S.halfLength + 0.1, 0.2, 0.35);
  sh.position.y = 0.006;
  g.add(sh);
  shadowed(g);
  group.add(g);
}

// ==================================================================== caixa de areia
function buildSandbox(group, layout) {
  const B = layout.SANDBOX;
  const g = new THREE.Group();
  g.name = 'caixa-de-areia';
  g.position.set(B.x, 0, B.z);
  const log = woodMat('#b98a55', { key: 'f7-sandbox-wood', rough: 0.75 });
  // as toras leste e oeste entram 2 cm nas do norte e do sul (sem faces encostadas no mesmo plano)
  for (const [x, z, w, d] of [[0, -B.hz + 0.05, B.hx * 2, 0.1], [0, B.hz - 0.05, B.hx * 2, 0.1], [-B.hx + 0.05, 0, 0.1, B.hz * 2 - 0.16], [B.hx - 0.05, 0, 0.1, B.hz * 2 - 0.16]]) {
    const m = new THREE.Mesh(rbox(w, 0.16, d, 0.03), log);
    m.position.set(x, 0.08, z);
    g.add(m);
  }
  // areia molhada (mais escura) com montinhos
  const sandGeo = new THREE.PlaneGeometry(B.hx * 2 - 0.2, B.hz * 2 - 0.2, 30, 24).rotateX(-Math.PI / 2);
  const p = sandGeo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, 0.075 + (fbm2(p.getX(i) * 4 + 9, p.getZ(i) * 4, 3) - 0.5) * 0.05);
  sandGeo.computeVertexNormals();
  paint(sandGeo, (pos) => new THREE.Color('#9c8159').multiplyScalar(0.85 + vnoise2(pos.x * 20, pos.z * 20) * 0.25));
  const sand = new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  g.add(sand);
  // castelinho derretido pela chuva
  const castleMat = new THREE.MeshStandardMaterial({ color: '#a88b62', roughness: 0.95 });
  for (const [x, z, r, h] of [[0.12, -0.05, 0.11, 0.12], [0.24, 0.08, 0.06, 0.09], [0.0, 0.1, 0.06, 0.08]]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 10, 2), castleMat);
    const cp = c.geometry.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setX(i, cp.getX(i) * (1 + (vnoise2(cp.getY(i) * 30, i) - 0.5) * 0.25));
    c.geometry.computeVertexNormals();
    c.position.set(x, 0.07 + h / 2, z);
    g.add(c);
  }
  // baldinho e pazinha
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.06, 0), new THREE.Vector2(0.075, 0.11), new THREE.Vector2(0.08, 0.115), new THREE.Vector2(0.072, 0.115), new THREE.Vector2(0.067, 0.012), new THREE.Vector2(0, 0.012)];
  const bucket = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), wetPlastic('#e8574a', 'bucket'));
  bucket.position.set(-0.32, 0.075, -0.12);
  bucket.rotation.z = 1.4;
  bucket.position.y = 0.13;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.005, 6, 16, Math.PI), wetPlastic('#f4cf4a', 'bucket-h'));
  handle.position.set(0, 0.115, 0);
  bucket.add(handle);
  const shovel = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), wetPlastic('#4fa3d9', 'shovel'));
  blade.scale.set(1, 0.3, 1.3);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8).rotateX(Math.PI / 2), wetPlastic('#4fa3d9', 'shovel'));
  stick.position.z = 0.15;
  shovel.add(blade, stick);
  shovel.position.set(-0.2, 0.1, 0.2);
  shovel.rotation.set(0.35, 0.9, 0);
  g.add(bucket, shovel);
  const sh = contactShadow(B.hx + 0.1, B.hz + 0.1, 0.35);
  sh.position.y = 0.006;
  g.add(sh);
  shadowed(g);
  group.add(g);
}

// ==================================================================== joaninha de mola
function buildLadybug(group, layout) {
  const R = layout.SPRING_RIDER;
  const g = new THREE.Group();
  g.name = 'joaninha';
  g.position.set(R.x, 0, R.z);
  g.rotation.y = 0.6;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 20), wetMetal('#8d8a84'));
  base.position.y = 0.015;
  const coil = [];
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI * 2 * 5;
    coil.push(new THREE.Vector3(Math.cos(a) * 0.07, 0.03 + (i / 80) * 0.28, Math.sin(a) * 0.07));
  }
  const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 160, 0.011, 6), wetMetal('#d8d4cb'));
  const body = new THREE.Group();
  body.position.y = 0.4;
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), wetPlastic('#e23b30', 'ladybug'));
  shell.scale.set(1, 0.75, 1.25);
  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.04, 24), stdMat('#2b2622', { roughness: 0.6 }));
  belly.scale.z = 1.25;
  belly.position.y = -0.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), stdMat('#2b2622', { roughness: 0.45 }));
  head.position.set(0, 0.03, 0.25);
  const dotMat = stdMat('#1f1a17', { roughness: 0.4 });
  // pintinhas pretas no casco (no referencial da meia-esfera, antes da escala do casco)
  const dotFront = new THREE.Vector3(0, 0, 1);
  for (const [a, b] of [[0.6, 0.9], [-0.6, 0.9], [1.15, 0.45], [-1.15, 0.45], [2.2, 0.55], [-2.2, 0.55], [Math.PI, 1.2]]) {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.034, 12), dotMat);
    const dir = new THREE.Vector3(Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b));
    dot.position.copy(dir).multiplyScalar(0.2 * 1.012);
    dot.quaternion.setFromUnitVectors(dotFront, dir);
    shell.add(dot);
  }
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), stdMat('#ffffff', { roughness: 0.3 }));
    eye.position.set(s * 0.045, 0.06, 0.33);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 5), dotMat);
    ant.position.set(s * 0.04, 0.15, 0.27);
    ant.rotation.set(0.3, 0, -s * 0.4);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), dotMat);
    knob.position.set(0, 0.06, 0);
    ant.add(knob);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8).rotateZ(Math.PI / 2), wetPlastic('#f4cf4a', 'grip'));
    grip.position.set(s * 0.13, 0.03, 0.2);
    body.add(eye, ant, grip);
  }
  body.add(shell, belly, head);
  g.add(base, spring, body);
  const sh = contactShadow(0.22, 0.26, 0.38);
  sh.position.y = 0.006;
  g.add(sh);
  shadowed(g);
  group.add(g);
  return { update(t) { body.rotation.x = Math.sin(t * 1.7) * 0.03; body.rotation.z = Math.sin(t * 1.3 + 1) * 0.025; } };
}

/** @param {THREE.Group} root @param {import('../../../types').LevelLayout} layout */
export function buildEquipment(root, layout) {
  const group = new THREE.Group();
  group.name = 'brinquedos';
  const slide = buildSlide(group, layout);
  const swings = buildSwings(group, layout);
  buildSeesaw(group, layout);
  buildSandbox(group, layout);
  const bug = buildLadybug(group, layout);
  root.add(group);
  return {
    group,
    seeThrough: [slide.object, swings.object],
    update(dt, t) {
      slide.update(t);
      swings.update(t);
      bug.update(t);
    },
  };
}
