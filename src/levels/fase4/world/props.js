// FASE 4 · Props do terraço (todos procedurais). Interativos: ventilador industrial no trilho (com fitas
// que mostram o vento e luz verde no encaixe), corredor dos aparelhos de ar-condicionado (canos baixos no
// vão, mureta baixa, grade), duto de exaustão, mureta com portão de ferro, poleiros com a placa e a
// corda até a trava, os pombos (o da passagem, o do portão e dois no pombal), a bacia com o patinho.
// Decoração com colisão: mesa com guarda-sol, espreguiçadeiras, limoeiro, banco, vasos, pombal, antena.
import * as THREE from 'three';
import {
  rng, rbox, stdMat, woodMat, plasterMat, ironMat, contactShadow, shadowAll, rippleNormalTexture, canvasTexture, stripeTexture,
} from '../../../world/util.js';
import { plantMat, geranium, boxwood } from '../../../world/plants.js';
import { createPigeon } from '../../../world/pigeon.js';
import { createRubberDuck } from '../../../world/toys.js';
import { buildTreats } from '../../../world/treats.js';

const TAU = Math.PI * 2;
const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// ================================================================== ventilador industrial + trilho
function buildFan(root, FAN, updaters) {
  // trilho embutido no piso com a marca amarela (listras) no encaixe
  const rail = new THREE.Group();
  rail.name = 'trilho';
  const railMat = stdMat('#7d7f80', { metalness: 0.7, roughness: 0.35 });
  const len = FAN.maxZ - FAN.minZ + FAN.half * 2 + 0.4;
  const zc = (FAN.minZ + FAN.maxZ) / 2;
  for (const dx of [-0.2, 0.2]) {
    const r = new THREE.Mesh(rbox(0.05, 0.025, len, 0.008, 1), railMat);
    r.position.set(FAN.start.x + dx, 0.0125, zc);
    rail.add(r);
  }
  const bed = new THREE.Mesh(rbox(0.52, 0.008, len + 0.06, 0.004, 1), stdMat('#8b8378', { roughness: 0.95 }));
  bed.position.set(FAN.start.x, 0.004, zc);
  rail.add(bed);
  const stripes = canvasTexture(128, 32, (g, w, h) => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2620';
    for (let x = -h; x < w; x += 24) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 12, h); g.lineTo(x + 12 + h, 0); g.lineTo(x + h, 0); g.fill(); }
  }, { repeat: false });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.7 }));
  mark.position.set(FAN.start.x, 0.011, FAN.alignZ + FAN.half + 0.12);
  rail.add(mark);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 3).rotateX(-Math.PI / 2), stdMat('#f2c230', { roughness: 0.6 }));
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(FAN.start.x + 0.45, 0.012, FAN.alignZ);
  arrow.scale.set(1, 0.05, 1);
  rail.add(arrow);
  rail.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) o.receiveShadow = true; });
  root.add(rail);

  // ventilador: carrinho com rodinhas, coluna, motor e gaiola com hélice
  const fan = new THREE.Group();
  fan.name = 'ventilador';
  const paint = stdMat('#3e6e8e', { roughness: 0.45, metalness: 0.3 });
  const chrome = stdMat('#c8ccd0', { roughness: 0.25, metalness: 0.9 });
  const rubber = stdMat('#222222', { roughness: 0.9 });
  const cart = new THREE.Mesh(rbox(0.56, 0.08, 0.56, 0.02), paint);
  cart.position.y = 0.09;
  fan.add(cart);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14).rotateZ(Math.PI / 2), rubber);
    wheel.position.set(sx * 0.2, 0.04, sz * 0.2);
    fan.add(wheel);
  }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.36, 12), chrome);
  col.position.y = 0.3;
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.014, 6, 24, Math.PI).rotateY(Math.PI / 2), chrome);
  yoke.position.set(0, 0.58, 0);
  yoke.rotation.x = Math.PI;
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.16, 16).rotateZ(Math.PI / 2), paint);
  motor.position.set(-0.08, 0.6, 0);
  fan.add(col, yoke, motor);
  // gaiola (anéis + raios), com a frente virada para +X
  const cage = new THREE.Group();
  cage.position.set(0.04, 0.6, 0);
  const cageMat = chrome;
  for (const [rr, x] of [[0.26, 0.06], [0.2, 0.08], [0.13, 0.095], [0.26, -0.04]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.006, 5, 40).rotateY(Math.PI / 2), cageMat);
    ring.position.x = x;
    cage.add(ring);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.26, 4), cageMat);
    sp.position.set(0.075, Math.sin(a) * 0.13, Math.cos(a) * 0.13);
    sp.rotation.x = -a;
    cage.add(sp);
  }
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 40, 1, true).rotateZ(Math.PI / 2), stdMat('#3e6e8e', { roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }));
  rim.position.x = 0.01;
  cage.add(rim);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), chrome);
  hub.position.x = 0.07;
  cage.add(hub);
  const blades = new THREE.Group();
  blades.position.x = 0.03;
  const bladeMat = stdMat('#d9dde0', { roughness: 0.35, metalness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Shape();
    s.moveTo(0, 0.02); s.quadraticCurveTo(0.09, 0.12, 0.05, 0.22); s.quadraticCurveTo(-0.03, 0.2, -0.03, 0.03); s.closePath();
    const b = new THREE.Mesh(new THREE.ShapeGeometry(s, 6).rotateY(Math.PI / 2), bladeMat);
    b.rotation.x = (i / 3) * TAU;
    b.rotation.order = 'XYZ';
    const holder = new THREE.Group();
    holder.rotation.x = (i / 3) * TAU;
    b.rotation.set(0, 0, 0.35);
    holder.add(b);
    blades.add(holder);
  }
  cage.add(blades);
  fan.add(cage);
  // luz do encaixe (vermelha → verde) no motor
  const ledMat = new THREE.MeshStandardMaterial({ color: '#ff6a4a', emissive: '#ff3a1a', emissiveIntensity: 1.2, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), ledMat);
  led.position.set(-0.16, 0.66, 0.07);
  fan.add(led);
  // fitas presas na gaiola: mostram o vento
  const ribbons = [];
  const ribbonCols = ['#ff7a59', '#ffd25a', '#7fd2ff'];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(0.36, 0.03, 8, 1).translate(0.18, 0, 0);
    const rb = new THREE.Mesh(g, stdMat(ribbonCols[i], { side: THREE.DoubleSide, roughness: 0.7 }));
    rb.name = 'fita-do-vento'; // tecido leve: não tem colisor
    rb.position.set(0.12, 0.6 + (i - 1) * 0.12, (i - 1) * 0.1);
    rb.userData.base = Float32Array.from(g.attributes.position.array);
    ribbons.push(rb);
    fan.add(rb);
  }
  shadowAll(fan);
  const sh = contactShadow(0.36, 0.36, 0.4);
  fan.add(sh);
  root.add(fan);
  let aligned = false;
  updaters.push((dt, t) => {
    blades.rotation.x += dt * 16;
    for (const [i, rb] of ribbons.entries()) {
      const p = rb.geometry.attributes.position;
      const base = rb.userData.base;
      for (let k = 0; k < p.count; k++) {
        const x = base[k * 3];
        const u = x / 0.36;
        p.setY(k, base[k * 3 + 1] + Math.sin(t * 14 + u * 7 + i * 1.7) * 0.025 * u);
        p.setZ(k, Math.sin(t * 11 + u * 5 + i) * 0.03 * u);
      }
      p.needsUpdate = true;
    }
  });
  return {
    object: fan,
    setPos(x, z) { fan.position.set(x, 0, z); },
    setAligned(on) {
      if (on === aligned) return;
      aligned = on;
      ledMat.color.set(on ? '#7ef08a' : '#ff6a4a');
      ledMat.emissive.set(on ? '#2fd04a' : '#ff3a1a');
    },
  };
}

// ================================================================== corredor dos aparelhos
function buildCorridor(root, layout, updaters) {
  const { CORRIDOR: C, AC_UNITS: A } = layout;
  const grp = new THREE.Group();
  grp.name = 'corredor-aparelhos';
  const zFront = C.z - C.half; // face sul dos aparelhos (onde fica a grade da hélice)
  const zc = zFront - A.depth / 2;
  const body = stdMat('#eef0ee', { roughness: 0.5, metalness: 0.1 });
  const grill = stdMat('#3a3d40', { roughness: 0.6, metalness: 0.5 });
  const bladeMat = stdMat('#9aa0a4', { roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
  const fans = [];
  const segs = [[C.x0, C.door.x0], [C.door.x1, C.x1]];
  for (const [a, b] of segs) {
    const n = Math.max(1, Math.round((b - a) / 0.78));
    const w = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const x = a + (i + 0.5) * w;
      const unit = new THREE.Mesh(rbox(w - 0.03, A.height, A.depth, 0.025), body);
      unit.position.set(x, A.height / 2 + 0.05, zc);
      grp.add(unit);
      // pés
      for (const sx of [-1, 1]) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, A.depth + 0.06), stdMat('#555a5e', { metalness: 0.4 }));
        foot.position.set(x + sx * (w / 2 - 0.08), 0.025, zc);
        grp.add(foot);
      }
      // grade redonda da hélice (virada para o corredor) e lâminas girando
      const rr = Math.min(0.24, w * 0.32);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.012, 6, 32), grill);
      ring.position.set(x - w * 0.12, A.height / 2 + 0.05, zFront + 0.002);
      grp.add(ring);
      for (let k = 1; k <= 3; k++) {
        const rg = new THREE.Mesh(new THREE.TorusGeometry((rr * k) / 4, 0.004, 4, 24), grill);
        rg.position.copy(ring.position);
        grp.add(rg);
      }
      const hole = new THREE.Mesh(new THREE.CircleGeometry(rr, 28), stdMat('#202326', { roughness: 1 }));
      hole.position.set(ring.position.x, ring.position.y, zFront - 0.01);
      grp.add(hole);
      const blades = new THREE.Group();
      blades.position.set(ring.position.x, ring.position.y, zFront - 0.004);
      for (let k = 0; k < 4; k++) {
        const bl = new THREE.Mesh(new THREE.PlaneGeometry(rr * 0.42, rr * 0.9).translate(0, rr * 0.45, 0), bladeMat);
        bl.rotation.z = (k / 4) * TAU;
        bl.rotation.y = 0.4;
        const h = new THREE.Group();
        h.rotation.z = (k / 4) * TAU;
        bl.rotation.set(0, 0.4, 0);
        h.add(bl);
        blades.add(h);
      }
      grp.add(blades);
      fans.push({ blades, speed: 1.2 + (i % 3) * 0.4 });
      // painel lateral com aletas
      for (let k = 0; k < 5; k++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 0.012, 0.01), stdMat('#c9cdcb', { roughness: 0.6 }));
        fin.position.set(x + w * 0.26, 0.2 + k * 0.1, zFront + 0.004);
        grp.add(fin);
      }
    }
  }
  // canos de cobre com isolamento atravessando o vão: acima da cabeça da Radhija, baixos demais para a Rhaenyra
  const pipeY = 0.52;
  const insul = stdMat('#2d2f31', { roughness: 0.95 });
  const copper = stdMat('#c07a4a', { roughness: 0.35, metalness: 0.9 });
  const x0 = C.door.x0 - 0.15, x1 = C.door.x1 + 0.15;
  for (const [dy, dz, rr, m] of [[0, 0, 0.035, insul], [0.075, -0.05, 0.025, insul], [-0.04, 0.05, 0.014, copper]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, x1 - x0, 12).rotateZ(Math.PI / 2), m);
    p.position.set((x0 + x1) / 2, pipeY + dy, zc + dz);
    grp.add(p);
  }
  // fita de alerta enrolada nos canos
  const tape = stdMat('#f2c230', { roughness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.03, 12).rotateZ(Math.PI / 2), tape);
    tp.position.set(C.door.x0 + 0.08 + i * 0.17, pipeY, zc);
    grp.add(tp);
  }
  // mureta baixa ao sul (com pingadeira)
  const curbH = 0.3;
  const curb = new THREE.Mesh(rbox(C.x1 - C.x0, curbH, 0.12, 0.02), plasterMat('#e2d2bb'));
  curb.position.set((C.x0 + C.x1) / 2, curbH / 2, C.z + C.half);
  const curbCap = new THREE.Mesh(rbox(C.x1 - C.x0 + 0.04, 0.035, 0.16, 0.01), stdMat('#d1c5b3'));
  curbCap.position.set((C.x0 + C.x1) / 2, curbH + 0.017, C.z + C.half);
  grp.add(curb, curbCap);
  // vasinhos de suculenta em cima da mureta baixa
  const potMat = stdMat('#c9764f', { roughness: 0.85 });
  for (const x of [-0.1, 0.9, 1.8]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 12), potMat);
    pot.position.set(x, curbH + 0.07, C.z + C.half);
    const pl = new THREE.Mesh(boxwood(0.05, 50 + Math.round(x * 10)), plantMat());
    pl.position.set(x, curbH + 0.13, C.z + C.half);
    grp.add(pot, pl);
  }
  // grade do lado oeste (o vento passa)
  const grate = new THREE.Group();
  grate.name = 'grade';
  const barMat = ironMat();
  const gz0 = zFront - 0.04, gz1 = C.z + C.half + 0.04;
  for (let i = 0; i <= 8; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.52, 6), barMat);
    bar.position.set(C.x0 - 0.02, 0.26, gz0 + (i / 8) * (gz1 - gz0));
    grate.add(bar);
  }
  for (const y of [0.05, 0.5]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, gz1 - gz0 + 0.02), barMat);
    t.position.set(C.x0 - 0.02, y, (gz0 + gz1) / 2);
    grate.add(t);
  }
  grp.add(grate);
  shadowAll(grp);
  root.add(grp);
  updaters.push((dt) => { for (const f of fans) f.blades.rotation.z += dt * f.speed; });
  return { group: grp, grate };
}

// ================================================================== duto de exaustão
function buildDuct(root, layout) {
  const { DUCT: D, WALL } = layout;
  const grp = new THREE.Group();
  grp.name = 'duto';
  const metal = new THREE.MeshStandardMaterial({ color: '#b9bec2', roughness: 0.32, metalness: 0.85 });
  const seam = stdMat('#8e9397', { roughness: 0.4, metalness: 0.8 });
  const dark = stdMat('#151618', { roughness: 1 });
  const R = 0.11, top = WALL.height + 0.42;
  // boca (para o oeste, dentro do corredor)
  const inBox = new THREE.Mesh(rbox(0.26, 0.42, 0.48, 0.02), metal);
  inBox.position.set(D.inlet.x + 0.1, 0.23, D.inlet.z);
  const inHole = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.3).rotateY(-Math.PI / 2), dark);
  inHole.position.set(D.inlet.x - 0.038, 0.22, D.inlet.z); // 8 mm à frente da chapa (sem z-fighting)
  grp.add(inBox, inHole);
  // moldura da boca (4 barras em volta do buraco)
  for (const [h, d, y, z] of /** @type {[number, number, number, number][]} */ ([
    [0.03, 0.46, 0.22 + 0.165, 0], [0.03, 0.46, 0.22 - 0.165, 0], [0.3, 0.03, 0.22, 0.205], [0.3, 0.03, 0.22, -0.205],
  ])) {
    const bar = new THREE.Mesh(rbox(0.03, h, d, 0.008), seam);
    bar.position.set(D.inlet.x - 0.045, y, D.inlet.z + z);
    grp.add(bar);
  }
  // tubo: sobe, cruza a mureta, desce
  const pts = [
    new THREE.Vector3(D.inlet.x + 0.12, 0.42, D.inlet.z),
    new THREE.Vector3(D.inlet.x + 0.12, top - 0.2, D.inlet.z),
    new THREE.Vector3(D.inlet.x + 0.2, top, D.inlet.z),
    new THREE.Vector3(D.outlet.x - 0.08, top, D.inlet.z),
    new THREE.Vector3(D.outlet.x, top - 0.2, D.outlet.z),
    new THREE.Vector3(D.outlet.x, 0.62, D.outlet.z),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, R, 16), metal);
  grp.add(tube);
  for (let i = 1; i < 8; i++) {
    const u = i / 8;
    const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.006, 0.008, 6, 20), seam);
    ring.position.copy(p);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
    grp.add(ring);
  }
  // saída (para o leste, junto ao poleiro A) com chapéu e tela
  const outBox = new THREE.Mesh(rbox(0.26, 0.32, 0.38, 0.02), metal);
  outBox.position.set(D.outlet.x, 0.5, D.outlet.z);
  const outHole = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.2).rotateY(Math.PI / 2), dark);
  outHole.position.set(D.outlet.x + 0.136, 0.5, D.outlet.z); // 6 mm à frente da chapa
  const hood = new THREE.Mesh(rbox(0.18, 0.03, 0.42, 0.01), seam);
  hood.position.set(D.outlet.x + 0.16, 0.66, D.outlet.z);
  hood.rotation.z = -0.35;
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), ironMat());
  stand.position.set(D.outlet.x, 0.17, D.outlet.z);
  grp.add(outBox, outHole, hood, stand);
  shadowAll(grp);
  root.add(grp);
  return grp;
}

// ================================================================== mureta B|C, portão e corda
function buildWallGate(root, layout) {
  const { WALL, GATE } = layout;
  const grp = new THREE.Group();
  grp.name = 'mureta-portao';
  const wall = plasterMat('#e7d6bd');
  const cap = stdMat('#d6cab8', { roughness: 0.88 });
  const runs = [[-4.2, -WALL.gapZ], [WALL.gapZ, 3.8]];
  for (const [a, b] of runs) {
    const m = new THREE.Mesh(rbox(WALL.half * 2, WALL.height, b - a, 0.02), wall);
    m.position.set(WALL.x, WALL.height / 2, (a + b) / 2);
    const c = new THREE.Mesh(rbox(WALL.half * 2 + 0.06, 0.05, b - a + 0.02, 0.012), cap);
    c.position.set(WALL.x, WALL.height + 0.025, (a + b) / 2);
    grp.add(m, c);
  }
  // pilares do portão
  const pillarMat = plasterMat('#d9c2a0');
  for (const z of [-WALL.gapZ, WALL.gapZ]) {
    const p = new THREE.Mesh(rbox(0.28, WALL.height + 0.18, 0.204, 0.02), pillarMat);
    p.position.set(WALL.x, (WALL.height + 0.18) / 2, z + Math.sign(z) * 0.098);
    const pc = new THREE.Mesh(rbox(0.34, 0.06, 0.26, 0.015), cap);
    pc.position.set(WALL.x, WALL.height + 0.21, z + Math.sign(z) * 0.1);
    grp.add(p, pc);
  }
  shadowAll(grp);
  root.add(grp);

  // portão de ferro (pivô na dobradiça, folha ao longo de -Z local)
  const pivot = new THREE.Group();
  pivot.name = 'portao';
  pivot.position.set(GATE.hinge.x, 0, GATE.hinge.z);
  const iron = stdMat('#2f5a4f', { roughness: 0.45, metalness: 0.45 });
  const L = GATE.length;
  for (const y of [0.1, 0.5, 0.9]) {
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, L - 0.04), iron);
    rl.position.set(0, y, -L / 2);
    pivot.add(rl);
  }
  for (let i = 0; i <= 10; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.86, 6), iron);
    bar.position.set(0, 0.5, -0.04 - (i / 10) * (L - 0.08));
    pivot.add(bar);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), iron);
    tip.position.set(0, 0.95, bar.position.z);
    pivot.add(tip);
  }
  // arabescos (círculos) no meio
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 20).rotateY(Math.PI / 2), iron);
    c.position.set(0, 0.7, -0.17 - i * ((L - 0.34) / 3));
    pivot.add(c);
  }
  // trava (lingueta) na ponta
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.12), brass());
  latch.position.set(0, 0.62, -L + 0.06);
  pivot.add(latch);
  shadowAll(pivot);
  root.add(pivot);
  return { pivot };
}
const brass = () => stdMat('#c99a45', { metalness: 0.9, roughness: 0.35 });

// ================================================================== poleiros, placa e corda
/** @returns {import('../../../types').Fase4Props['plate'] & { readonly pressed: boolean }} */
function buildPerches(root, layout, updaters) {
  const { PERCH_A, PERCH_B, GATE, WALL } = layout;
  const wood = woodMat('#8a6240', { key: 'f4-perch', rough: 0.8 });
  const make = (p) => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, p.y, 10), wood);
    post.position.y = p.y / 2;
    const plat = new THREE.Mesh(rbox(0.4, 0.04, 0.28, 0.012), wood);
    plat.position.y = p.y;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 16), stdMat('#9b9288', { roughness: 0.9 }));
    foot.position.y = 0.025;
    // poleirinho de varetas
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.44, 6).rotateZ(Math.PI / 2), wood);
    rod.position.set(0, p.y - 0.15, 0);
    g.add(post, plat, foot, rod);
    g.position.set(p.x, 0, p.z);
    shadowAll(g);
    root.add(g);
    return g;
  };
  make(PERCH_A);
  const b = make(PERCH_B);
  // Placa saliente, molas expostas e base escura tornam o botão legível de cima.
  const plateMat = new THREE.MeshStandardMaterial({ color: '#ffcf45', roughness: 0.45, emissive: '#d49312', emissiveIntensity: 0.2 });
  const plate = new THREE.Mesh(rbox(0.46, 0.025, 0.34, 0.008), plateMat);
  plate.name = 'placa-poleiro';
  plate.position.y = PERCH_B.y + 0.12;
  const socket = new THREE.Mesh(rbox(0.5, 0.025, 0.38, 0.012), ironMat());
  socket.position.y = PERCH_B.y + 0.025;
  const springs = new THREE.Group();
  springs.position.y = PERCH_B.y + 0.04;
  const springMat = stdMat('#d8dde0', { metalness: 0.7, roughness: 0.35 });
  for (const x of [-0.15, 0.15]) {
    const points = Array.from({ length: 49 }, (_, i) => {
      const a = i / 48 * TAU * 3;
      return new THREE.Vector3(x + Math.cos(a) * 0.025, i / 48 * 0.065, Math.sin(a) * 0.025);
    });
    springs.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 0.005, 5), springMat));
  }
  b.add(socket, springs);
  b.add(plate);
  // corda: placa → topo da mureta → trava do portão
  const cordMat = stdMat('#e5b638', { roughness: 0.65 });
  const ctrl = [
    new THREE.Vector3(PERCH_B.x - 0.22, PERCH_B.y + 0.055, PERCH_B.z),
    new THREE.Vector3((PERCH_B.x + WALL.x) / 2, PERCH_B.y - 0.18, PERCH_B.z * 0.7),
    new THREE.Vector3(WALL.x + 0.14, WALL.height + 0.06, -1.6),
    new THREE.Vector3(WALL.x + 0.12, WALL.height + 0.05, GATE.latchPost.z - 0.25),
    new THREE.Vector3(WALL.x + 0.06, 0.66, GATE.latchPost.z - 0.05),
  ];
  const cordPath = new THREE.CatmullRomCurve3(ctrl);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(cordPath, 48, 0.014, 6), cordMat);
  cord.castShadow = true;
  root.add(cord);
  // O pulso percorre a ligação física quando a placa é pressionada.
  const signal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff4b0' }));
  signal.visible = false;
  root.add(signal);
  const latchLight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), plateMat);
  latchLight.position.copy(ctrl[ctrl.length - 1]);
  root.add(latchLight);
  let target = 0, press = 0, signalT = 1;
  const idleColor = new THREE.Color('#ffcf45'), pressedColor = new THREE.Color('#83d59a');
  updaters.push((dt, t) => {
    press = ease(press, target, dt, 18);
    plate.position.y = PERCH_B.y + 0.12 - 0.065 * press;
    springs.scale.y = 1 - 0.9 * press;
    plateMat.color.copy(idleColor).lerp(pressedColor, press);
    plateMat.emissive.set(press > 0.5 ? '#318c4f' : '#d49312');
    plateMat.emissiveIntensity = target ? 0.45 : 0.2 + 0.1 * Math.sin(t * 2.8);
    signalT = Math.min(1, signalT + dt / 0.65);
    signal.visible = signalT < 1;
    if (signal.visible) signal.position.copy(cordPath.getPoint(signalT));
  });
  return {
    object: plate,
    get pressed() { return target > 0; },
    get surfaceY() { return plate.position.y + 0.0125; },
    setPress(t) {
      if (t > target) signalT = 0;
      target = THREE.MathUtils.clamp(t, 0, 1);
      if (!target) {
        press = 0; signalT = 1; signal.visible = false;
        plate.position.y = PERCH_B.y + 0.12;
        springs.scale.y = 1;
        plateMat.color.copy(idleColor);
      }
    },
  };
}

// ================================================================== pombal
function buildCoop(root, layout) {
  const { COOP } = layout;
  const g = new THREE.Group();
  g.name = 'pombal';
  const white = woodMat('#f1ebe0', { key: 'f4-coop', vertical: true, rough: 0.8 });
  const trim = woodMat('#4f7ea3', { key: 'f4-coop-trim', rough: 0.7 });
  const w = COOP.hx * 2, d = COOP.hz * 2;
  // pernas
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), trim);
    leg.position.set(sx * (w / 2 - 0.08), 0.3, sz * (d / 2 - 0.08));
    g.add(leg);
  }
  const box = new THREE.Mesh(rbox(w, 0.9, d, 0.02), white);
  box.position.y = 1.05;
  g.add(box);
  // telhado de duas águas
  const roofMat = stdMat('#b2523e', { roughness: 0.75 });
  for (const s of [-1, 1]) {
    const rf = new THREE.Mesh(rbox(w + 0.2, 0.04, d / 2 + 0.16, 0.01), roofMat);
    rf.position.set(0, 1.62, s * (d / 4 + 0.02));
    rf.rotation.x = s * 0.5;
    g.add(rf);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-d / 2, 0); gable.lineTo(d / 2, 0); gable.lineTo(0, 0.12 + d * 0.27); gable.closePath();
  for (const s of [-1, 1]) {
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable).rotateY(Math.PI / 2), white);
    gm.position.set(s * (w / 2 - 0.005), 1.5, 0);
    g.add(gm);
  }
  // portinhas em arco + varandinha
  const hole = stdMat('#1e1a17', { roughness: 1 });
  for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 0.22 + i * ((w - 0.44) / 3);
    const y = 0.82 + row * 0.42;
    const arch = new THREE.Shape();
    arch.moveTo(-0.07, 0); arch.lineTo(0.07, 0); arch.lineTo(0.07, 0.1); arch.absarc(0, 0.1, 0.07, 0, Math.PI, false); arch.closePath();
    const am = new THREE.Mesh(new THREE.ShapeGeometry(arch, 8), hole);
    am.position.set(x, y, d / 2 + 0.002);
    const ledge = new THREE.Mesh(rbox(0.22, 0.02, 0.1, 0.005), trim);
    ledge.position.set(x, y - 0.01, d / 2 + 0.05);
    g.add(am, ledge);
  }
  g.position.set(COOP.x, 0, COOP.z);
  shadowAll(g);
  root.add(g);
  // alpiste espalhado no chão
  const seeds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 5, 4), stdMat('#d8b46a', { roughness: 0.9 }), 160);
  const r = rng(9);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 160; i++) {
    const a = r() * TAU, rr = Math.sqrt(r()) * 0.9;
    m4.makeTranslation(COOP.x - 0.3 + Math.cos(a) * rr * 1.3, 0.005, COOP.z + 1.15 + Math.sin(a) * rr * 0.5);
    seeds.setMatrixAt(i, m4);
  }
  root.add(seeds);
  return { group: g, roofY: 1.72 };
}

// ================================================================== bacia d'água + patinho
function buildBasin(root, layout, updaters) {
  const { BASIN, DUCK } = layout;
  const g = new THREE.Group();
  g.name = 'bacia';
  const zinc = new THREE.MeshStandardMaterial({ color: '#a7adb1', roughness: 0.35, metalness: 0.85 });
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(BASIN.r * (0.78 + 0.22 * t), 0.02 + t * 0.16));
  }
  pts.unshift(new THREE.Vector2(0, 0.02));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshStandardMaterial({ color: '#a7adb1', roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }));
  const lip = new THREE.Mesh(new THREE.TorusGeometry(BASIN.r, 0.014, 8, 40).rotateX(Math.PI / 2), zinc);
  lip.position.y = 0.18;
  const ripple = rippleNormalTexture().clone();
  ripple.needsUpdate = true;
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.repeat.set(2, 2);
  const waterMat = new THREE.MeshPhysicalMaterial({ color: '#6fa9c4', roughness: 0.08, metalness: 0.0, transmission: 0, normalMap: ripple, normalScale: new THREE.Vector2(0.4, 0.4), clearcoat: 1, transparent: true, opacity: 0.88 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(BASIN.r * 0.96, 40).rotateX(-Math.PI / 2), waterMat);
  water.position.y = 0.145;
  g.add(shell, lip, water);
  g.position.set(BASIN.x, 0, BASIN.z);
  shadowAll(g);
  water.castShadow = false;
  const sh = contactShadow(BASIN.r + 0.08, BASIN.r + 0.08, 0.35);
  g.add(sh);
  root.add(g);

  const duck = createRubberDuck(0.17);
  duck.position.set(DUCK.x, 0.15, DUCK.z);
  duck.rotation.y = -2.4;
  root.add(duck);
  const home = duck.position.clone();
  const st = { ripple: 0 };
  updaters.push((dt, t) => {
    ripple.offset.set(t * 0.02, t * 0.013);
    st.ripple = Math.max(0, st.ripple - dt * 0.8);
    waterMat.normalScale.setScalar(0.4 + st.ripple * 0.9);
    if (duck.parent === root) {
      duck.position.y = home.y + Math.sin(t * 2.1) * 0.006;
      duck.rotation.z = Math.sin(t * 1.7) * 0.05;
      duck.rotation.x = Math.sin(t * 1.3 + 1) * 0.04;
    }
  });
  return {
    duck: { object: duck, home, setHighlight() {} },
    basin: { object: g, setRipple(k) { st.ripple = k; } },
  };
}

// ================================================================== decoração das zonas A e B
function buildDecor(root, layout) {
  const grp = new THREE.Group();
  grp.name = 'decoracao';
  const wood = woodMat('#b68858', { key: 'f4-teak', rough: 0.75 });
  const alu = stdMat('#d9dcdf', { roughness: 0.35, metalness: 0.8 });
  // ---- mesa redonda com guarda-sol + 2 cadeiras
  const umbrella = new THREE.Group();
  umbrella.name = 'guarda-sol';
  {
    const T = { x: -4.5, z: 1.2 };
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.035, 32), wood);
    top.position.set(T.x, 0.72, T.z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 10), alu);
    leg.position.set(T.x, 0.36, T.z);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 20), alu);
    foot.position.set(T.x, 0.02, T.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 8), alu);
    pole.position.set(T.x, 1.15, T.z);
    // guarda-sol ainda fechado (é cedo): lona listrada enrolada no mastro, com a fita amarrada
    const lona = new THREE.MeshStandardMaterial({ map: stripeTexture('#f6f1e6', '#e86a52', 16), roughness: 0.85 });
    const furled = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.11, 0.95, 8, 3), lona);
    furled.position.set(T.x, 1.62, T.z);
    furled.rotation.y = 0.3;
    const tipCap = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), lona);
    tipCap.position.set(T.x, 2.15, T.z);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 6, 16).rotateX(Math.PI / 2), stdMat('#e86a52', { roughness: 0.8 }));
    strap.position.set(T.x, 1.55, T.z);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), alu);
    finial.position.set(T.x, 2.22, T.z);
    umbrella.add(furled, tipCap, strap, finial);
    // jarra e copos
    const glass = new THREE.MeshPhysicalMaterial({ color: '#f3fbff', roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.55 });
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.16, 16), glass);
    jar.position.set(T.x + 0.08, 0.82, T.z - 0.05);
    const juice = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.1, 16), stdMat('#ffb43a', { roughness: 0.2 }));
    juice.position.set(T.x + 0.08, 0.79, T.z - 0.05);
    grp.add(top, leg, foot, pole, umbrella, jar, juice);
    for (const [dx, dz, rot] of [[-0.62, 0.15, 1.4], [0.55, 0.42, -2.2]]) {
      const ch = new THREE.Group();
      const seat = new THREE.Mesh(rbox(0.4, 0.04, 0.4, 0.012), wood);
      seat.position.y = 0.45;
      const back = new THREE.Mesh(rbox(0.4, 0.4, 0.035, 0.012), wood);
      back.position.set(0, 0.68, -0.19);
      back.rotation.x = -0.12;
      ch.add(seat, back);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 6), alu);
        l.position.set(sx * 0.17, 0.225, sz * 0.17);
        ch.add(l);
      }
      ch.position.set(T.x + dx, 0, T.z + dz);
      ch.rotation.y = rot;
      grp.add(ch);
    }
  }
  // ---- espreguiçadeiras com almofada listrada e toalha
  /** @type {[number, number, string, string | null][]} */
  const loungers = [[-5.75, 2.45, '#5aa6c8', '#ffd25a'], [-4.85, 2.75, '#e86a52', null]];
  for (const [x, z, col, towel] of loungers) {
    const ch = new THREE.Group();
    const frame = new THREE.Mesh(rbox(0.56, 0.06, 1.6, 0.015), wood);
    frame.position.y = 0.28;
    const cushion = new THREE.Mesh(rbox(0.5, 0.07, 1.05, 0.03), new THREE.MeshStandardMaterial({ map: stripeTexture('#f6f1e6', col, 10), roughness: 0.9 }));
    cushion.position.set(0, 0.35, 0.22);
    const backrest = new THREE.Group();
    backrest.position.set(0, 0.34, -0.3);
    backrest.rotation.x = -0.75;
    const bf = new THREE.Mesh(rbox(0.56, 0.05, 0.6, 0.015), wood);
    bf.position.z = -0.3;
    const bc = new THREE.Mesh(rbox(0.5, 0.06, 0.55, 0.03), cushion.material);
    bc.position.set(0, 0.05, -0.3);
    backrest.add(bf, bc);
    ch.add(frame, cushion, backrest);
    for (const sz of [-0.7, 0.7]) for (const sx of [-0.24, 0.24]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.04), wood);
      l.position.set(sx, 0.13, sz);
      ch.add(l);
    }
    if (towel) {
      const tw = new THREE.Mesh(rbox(0.42, 0.02, 0.5, 0.01), new THREE.MeshStandardMaterial({ map: stripeTexture('#ffffff', towel, 6), roughness: 1 }));
      tw.position.set(0.02, 0.395, 0.45);
      tw.rotation.y = 0.15;
      ch.add(tw);
    }
    ch.position.set(x, 0.03, z);
    ch.rotation.y = Math.PI;
    grp.add(ch);
  }
  // ---- limoeiro no vaso
  {
    const L = { x: -3.45, z: -3.65 };
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.5, 20), stdMat('#c9764f', { roughness: 0.85 }));
    pot.position.set(L.x, 0.25, L.z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.7, 8), woodMat('#6b4f3a', { key: 'tree-bark', vertical: true, rough: 0.95 }));
    trunk.position.set(L.x, 0.82, L.z);
    const crown = new THREE.Mesh(boxwood(0.42, 61), plantMat());
    crown.position.set(L.x, 1.35, L.z);
    grp.add(pot, trunk, crown);
    const lemonMat = stdMat('#f5d43a', { roughness: 0.5 });
    const r = rng(4);
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, e = (r() - 0.3) * 1.2;
      const lm = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), lemonMat);
      lm.scale.set(1, 0.85, 0.85);
      lm.position.set(L.x + Math.cos(a) * Math.cos(e) * 0.42, 1.35 + Math.sin(e) * 0.32, L.z + Math.sin(a) * Math.cos(e) * 0.42);
      grp.add(lm);
    }
  }
  // ---- banco de ripas junto à mureta norte
  {
    const B = { x: 0.3, z: -3.75 };
    const base = plasterMat('#d9c9b2');
    for (const sx of [-0.6, 0.6]) {
      const p = new THREE.Mesh(rbox(0.14, 0.4, 0.42, 0.02), base);
      p.position.set(B.x + sx, 0.2, B.z);
      grp.add(p);
    }
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(rbox(1.5, 0.035, 0.09, 0.01), wood);
      s.position.set(B.x, 0.42, B.z - 0.15 + i * 0.1);
      grp.add(s);
    }
    // regador esquecido
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 14), stdMat('#5fae6e', { roughness: 0.5, metalness: 0.3 }));
    can.position.set(B.x + 0.45, 0.52, B.z);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.2, 8), can.material);
    spout.position.set(B.x + 0.56, 0.56, B.z);
    spout.rotation.z = -1.0;
    grp.add(can, spout);
  }
  // ---- vasos com plantas (zona B)
  /** @type {[number, number, number, number, string][]} */
  const pots = [[-1.9, -3.75, 0.28, 0.42, 'ger'], [1.75, -3.8, 0.24, 0.38, 'box']];
  for (const [x, z, rr, h, kind] of pots) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.8, h, 20), stdMat(kind === 'ger' ? '#d58a5a' : '#8fa3a8', { roughness: 0.8 }));
    pot.position.set(x, h / 2, z);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(rr * 0.92, 20).rotateX(-Math.PI / 2), stdMat('#5b3e2b', { roughness: 1 }));
    soil.position.set(x, h - 0.02, z);
    const pl = new THREE.Mesh(kind === 'ger' ? geranium({ radius: rr * 0.9, height: 0.22, seed: 71, flower: '#f0525a', clusters: 6 }) : boxwood(rr * 0.85, 72), plantMat());
    pl.position.set(x, h - 0.02 + (kind === 'ger' ? 0 : rr * 0.6), z);
    grp.add(pot, soil, pl);
  }
  // ---- antena de TV e parabólica na mureta norte
  {
    const mastMat = stdMat('#7a7f84', { metalness: 0.7, roughness: 0.4 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 2.2, 8), mastMat);
    mast.position.set(3.6, 1.1 + 1.1, -4.35);
    grp.add(mast);
    for (let i = 0; i < 6; i++) {
      const el = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5 - i * 0.05, 4).rotateZ(Math.PI / 2), mastMat);
      el.position.set(3.6, 2.7 + i * 0.12, -4.35);
      grp.add(el);
    }
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 12, 0, TAU, 0, 0.6), stdMat('#eceae6', { roughness: 0.5, side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI / 2 + 0.5;
    dish.position.set(-1.2, 1.55, -4.25);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 6), mastMat);
    arm.position.set(-1.2, 1.4, -4.1);
    arm.rotation.x = 0.9;
    grp.add(dish, arm);
  }
  shadowAll(grp);
  root.add(grp);
  return { group: grp, umbrella };
}

// ================================================================== tudo junto
export function buildProps({ root, layout, house }) {
  const { FAN, PERCH_A, PERCH_B, NAP_PIGEON, COOP, COLLECTIBLES } = layout;
  const updaters = [];
  const fan = buildFan(root, FAN, updaters);
  const corridor = buildCorridor(root, layout, updaters);
  const duct = buildDuct(root, layout);
  const wallGate = buildWallGate(root, layout);
  const perches = buildPerches(root, layout, updaters);
  const coop = buildCoop(root, layout);
  const basin = buildBasin(root, layout, updaters);
  const decor = buildDecor(root, layout);
  const treats = buildTreats(root, COLLECTIBLES, { glow: 0.14 });

  // ---- pombos
  // pombos um pouco maiores que o natural, para lerem bem com a câmera alta
  const napPigeon = createPigeon({ seed: 3, tint: '#9198a8', scale: 1.3 });
  const gatePigeon = createPigeon({ seed: 7, tint: '#858c9c', scale: 1.15 });
  const coopPigeons = [createPigeon({ seed: 11, tint: '#a2a6b0' }), createPigeon({ seed: 13, tint: '#7d8494' })];
  root.add(napPigeon.object, gatePigeon.object, ...coopPigeons.map((p) => p.object));
  const coopSpots = [
    { x: COOP.x - 0.35, y: coop.roofY, z: COOP.z + 0.02, yaw: 0.4 },
    { x: COOP.x + 0.4, y: coop.roofY, z: COOP.z - 0.02, yaw: -0.6 },
  ];
  coopPigeons.forEach((p, i) => p.setPose({ ...coopSpots[i], flying: false, asleep: false }));
  const pigeons = [napPigeon, gatePigeon, ...coopPigeons];

  const goalMat = house.doormatMat;
  const goalSt = { on: false, k: 0 };
  /** @satisfies {import('../../../types').Fase4Props} */
  const props = {
    fan,
    gate: { object: wallGate.pivot, setOpen(t) { wallGate.pivot.rotation.y = layout.GATE.openYaw * THREE.MathUtils.clamp(t, 0, 1); } },
    plate: perches,
    pigeon: { object: gatePigeon.object, setPose(p) { gatePigeon.setPose(p); } },
    napPigeon: { object: napPigeon.object, setPose(p) { napPigeon.setPose(p); }, peek() { napPigeon.peek(); } },
    duck: basin.duck,
    basin: basin.basin,
    goal: { object: house.doormat, setHighlight(on) { goalSt.on = !!on; } },
    collectibles: treats.list,
    fireflies: false,
    update(dt, t) {
      for (const f of updaters) f(dt, t);
      if (perches.pressed) gatePigeon.setPose({ y: perches.surfaceY });
      for (const p of pigeons) p.update(dt, t);
      treats.update(dt, t);
      goalSt.k = ease(goalSt.k, goalSt.on ? 1 : 0, dt, 4);
      goalMat.emissiveIntensity = goalSt.k * (0.25 + 0.12 * Math.sin(t * 4));
    },
    reset() {
      props.gate.setOpen(0);
      props.plate.setPress(0);
      fan.setAligned(false);
      gatePigeon.setPose({ x: PERCH_A.x, y: PERCH_A.y + 0.02, z: PERCH_A.z, yaw: -Math.PI / 2, flying: false, asleep: false });
      napPigeon.setPose({ x: NAP_PIGEON.x, y: 0, z: NAP_PIGEON.z, yaw: -0.4, flying: false, asleep: true });
      goalSt.on = false;
      for (const c of treats.list) c.reset();
    },
  };
  fan.setPos(FAN.start.x, FAN.start.z);
  props.reset();
  return { props, seeThrough: [wallGate.pivot, duct, corridor.grate, coop.group, decor.umbrella] };
}
