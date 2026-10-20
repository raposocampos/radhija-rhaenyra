// FASE 9 · O jardim de inverno: vasos grandes de barro com samambaia e costela-de-adão (entre eles só a Radhija
// passa), mesinha de plantas com suculentas e o regador, poltrona de vime com manta, a lanterna pendurada, o
// disjuntor (caixa com portinhola, raio amarelo, conduíte até o varal de luzinhas e a tomada), o ventilador de chão
// (empurrável; botão de liga, anel de luz, hélice, grade e fitinhas; o fio vai até a tomada), o vaso de rodinhas
// (empurrável) e o botão do registro no chão, com a haste até a grade de baixo do duto.
import * as THREE from 'three';
import { rng, rbox, stdMat, woodMat, canvasTexture, contactShadow, shadowAll } from '../../../world/util.js';
import { makeLink } from '../../../world/links.js';

const TAU = Math.PI * 2;
const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Vaso de barro com borda e uma planta: 'fern' (samambaia, folhas em arco) ou 'monstera' (folhas largas). */
function potPlant(x, z, r, kind, seed) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const clay = new THREE.MeshStandardMaterial({ color: '#b5643e', roughness: 0.85 });
  const h = r * 1.3;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.78, h, 22), clay);
  pot.position.y = h / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 8, 22).rotateX(Math.PI / 2), clay);
  rim.position.y = h;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, 20).rotateX(-Math.PI / 2), stdMat('#3a2a1c', { roughness: 1 }));
  soil.position.y = h - 0.03;
  g.add(pot, rim, soil);
  const leafMat = new THREE.MeshStandardMaterial({ color: kind === 'fern' ? '#4f8a3a' : '#3f7a3a', roughness: 0.65, side: THREE.DoubleSide });
  const rr = rng(seed);
  if (kind === 'fern') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + rr() * 0.3;
      const len = 0.45 + rr() * 0.25;
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        pts.push(new THREE.Vector3(Math.cos(a) * len * u, h + Math.sin(Math.PI * u * 0.8) * 0.35 - u * u * 0.25, Math.sin(a) * len * u));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const frond = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.012, 4, false), leafMat);
      g.add(frond);
      for (let k = 2; k < 8; k++) {
        const p = curve.getPoint(k / 8);
        const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.1 * (1 - k / 10), 0.03), leafMat);
        lf.position.copy(p);
        lf.rotation.set(0.3, -a, 0.4);
        g.add(lf);
      }
    }
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + rr() * 0.4;
      const len = 0.4 + rr() * 0.35;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, len, 5), stdMat('#4f7a3a', { roughness: 0.7 }));
      stem.position.set(Math.cos(a) * len * 0.3, h + len / 2, Math.sin(a) * len * 0.3);
      stem.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.13 + rr() * 0.05, 14), leafMat);
      leaf.position.set(Math.cos(a) * len * 0.62, h + len * 0.95, Math.sin(a) * len * 0.62);
      leaf.rotation.set(-1.1 + rr() * 0.4, -a + Math.PI / 2, 0);
      g.add(stem, leaf);
    }
  }
  return g;
}

/** Hélice moldada (gota larga, levemente torcida). */
function bladeGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.02);
  s.bezierCurveTo(0.05, 0.04, 0.085, 0.11, 0.06, 0.16);
  s.bezierCurveTo(0.035, 0.19, -0.03, 0.18, -0.035, 0.12);
  s.bezierCurveTo(-0.04, 0.07, -0.02, 0.035, 0, 0.02);
  const g = new THREE.ShapeGeometry(s, 10);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getY(i) * 0.12 * (pos.getX(i) > 0 ? 1 : -1)); // torção
  g.computeVertexNormals();
  return g;
}

/**
 * Ventilador de chão (circulador): base pesada com o botão de liga e o anel de luz, haste telescópica, cabeça com
 * motor arredondado, grade de anéis e raios na frente e atrás, hélice de três pás e as fitinhas.
 * Luz da base: apagada sem energia; vermelha com energia e desligado; âmbar ligado; verde ligado e na grade do duto.
 */
function buildFan(F) {
  const holder = new THREE.Group();
  holder.name = 'ventilador';
  const body = new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.38 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c9c4bb', roughness: 0.28, metalness: 0.85 });
  const dark = stdMat('#2c2a28', { roughness: 0.5 });
  // base: disco com aba e o botão de liga
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.245, 0.055, 32), body);
  base.position.y = 0.0275;
  const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.012, 8, 36).rotateX(Math.PI / 2), metal);
  baseRim.position.y = 0.03;
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.025, 20), new THREE.MeshStandardMaterial({ color: '#d8584a', roughness: 0.35 }));
  button.position.set(0, 0.066, 0.12);
  holder.add(base, baseRim, button);
  // anel de luz na base (estado)
  const ledMat = new THREE.MeshStandardMaterial({ color: '#3a3a36', roughness: 0.3, emissive: '#000000', emissiveIntensity: 1 });
  const ledRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 6, 24).rotateX(Math.PI / 2), ledMat);
  ledRing.position.set(0, 0.068, 0.12);
  holder.add(ledRing);
  // haste telescópica com a trava
  const H = F.height - 0.22;
  const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, H * 0.6, 14), metal);
  pole1.position.y = 0.055 + H * 0.3;
  const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, H * 0.5, 12), metal);
  pole2.position.y = 0.055 + H * 0.75;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 14), dark);
  collar.position.y = 0.055 + H * 0.6;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), dark);
  knob.position.set(0.035, 0.055 + H * 0.6, 0);
  holder.add(pole1, pole2, collar, knob);
  // cabeça virada para o norte (−Z): motor, grade e hélice
  const head = new THREE.Group();
  head.position.y = F.height - 0.17;
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 16, Math.PI).rotateZ(Math.PI), metal);
  yoke.position.set(0, -0.02, 0.06);
  yoke.rotation.y = Math.PI / 2;
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.12, 22).rotateX(Math.PI / 2), body);
  motor.position.z = 0.08;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), body);
  cap.position.z = 0.14;
  head.add(yoke, motor, cap);
  // grade: aro, anéis concêntricos e raios (frente e trás)
  const R = 0.2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.009, 8, 40), metal);
  head.add(rim);
  for (const [z, s] of [[-0.05, 1], [0.035, 0.9]]) {
    for (const rr of [0.06, 0.12, 0.17]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr * s, 0.0032, 4, 28), metal);
      ring.position.z = z;
      head.add(ring);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, R * s, 4), metal);
      spoke.position.set(Math.cos(a) * R * s * 0.5, Math.sin(a) * R * s * 0.5, z);
      spoke.rotation.z = a - Math.PI / 2;
      head.add(spoke);
    }
  }
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), new THREE.MeshStandardMaterial({ color: '#3f6f8a', roughness: 0.3, metalness: 0.3 }));
  badge.position.z = -0.053;
  badge.rotation.y = Math.PI;
  head.add(badge);
  const blades = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#8cc0d6', roughness: 0.3, side: THREE.DoubleSide });
  const bg = bladeGeometry();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(bg, bladeMat);
    b.rotation.z = (i / 3) * TAU;
    blades.add(b);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), body);
  blades.add(hub);
  blades.position.z = -0.008;
  head.add(blades);
  holder.add(head);
  // fitinhas no vento
  const ribbons = [];
  for (let i = 0; i < 3; i++) {
    const rb = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.22, 1, 6), new THREE.MeshStandardMaterial({ color: ['#e8554a', '#f2c14e', '#7fb0c8'][i], roughness: 0.8, side: THREE.DoubleSide }));
    rb.geometry.translate(0, -0.11, 0);
    rb.position.set(-0.09 + i * 0.09, 0.17, -0.06);
    head.add(rb);
    ribbons.push(rb);
  }
  shadowAll(holder);
  const sh = contactShadow(0.3, 0.3, 0.38);
  sh.position.y = 0.004;
  holder.add(sh);
  holder.position.set(F.start.x, 0, F.start.z);
  const st = { aligned: false, power: false, running: false, spin: 0, glow: 0 };
  const C_OFF = new THREE.Color('#000000');
  const C_RED = new THREE.Color('#ff4a3a');
  const C_AMB = new THREE.Color('#ffb04a');
  const C_GRN = new THREE.Color('#5fe08a');
  return {
    object: holder,
    /** Ponto do fio na base (lado oeste). */
    plugPoint: () => new THREE.Vector3(holder.position.x - 0.2, 0.02, holder.position.z + 0.08),
    setPos(x, z) { holder.position.set(x, 0, z); },
    setAligned(on) { st.aligned = !!on; },
    setPower(on) { st.power = !!on; },
    setRunning(on) { st.running = !!on; },
    update(dt, t) {
      const run = st.power && st.running;
      st.spin = ease(st.spin, run ? 1 : 0, dt, run ? 1.6 : 0.9);
      blades.rotation.z -= dt * 22 * st.spin;
      const c = !st.power ? C_OFF : !st.running ? C_RED : st.aligned ? C_GRN : C_AMB;
      ledMat.emissive.lerp(c, 1 - Math.exp(-dt * 8));
      ledMat.emissiveIntensity = 1.2 + (st.power ? 0.25 * Math.sin(t * 5) : 0);
      button.position.y = 0.066 - (st.running ? 0.008 : 0);
      ribbons.forEach((rb, i) => {
        const flap = Math.sin(t * 14 + i * 1.7) * 0.18 * st.spin;
        rb.rotation.x = -0.08 - 1.17 * st.spin + flap;
      });
    },
  };
}

/** Caixa do disjuntor em volta da alavanca (moldura, portinhola aberta, raio amarelo) e a tomada embaixo. */
function buildBreakerBox(cfg, B) {
  const g = new THREE.Group();
  g.name = 'disjuntor';
  const zW = B.minZ; // face da parede
  const steel = new THREE.MeshStandardMaterial({ color: '#8f948f', roughness: 0.45, metalness: 0.55 });
  const cy = cfg.top - 0.08;
  const depth = 0.055;
  for (const [x, y, w, h] of [[-0.1775, 0, 0.045, 0.5], [0.1775, 0, 0.045, 0.5], [0, 0.2275, 0.31, 0.045], [0, -0.2275, 0.31, 0.045]]) {
    const bar = new THREE.Mesh(rbox(w, h, depth, 0.008), steel);
    bar.position.set(cfg.x + x, cy + y, zW + depth / 2 + 0.002);
    g.add(bar);
  }
  // portinhola aberta para a esquerda
  const pivot = new THREE.Group();
  pivot.position.set(cfg.x - 0.2, cy, zW + depth + 0.004);
  const door = new THREE.Mesh(rbox(0.3, 0.44, 0.014, 0.008), steel);
  door.position.x = 0.15;
  const vents = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshStandardMaterial({ map: ventTexture(), roughness: 0.6, transparent: true, depthWrite: false }));
  vents.position.set(0.15, -0.12, 0.0095);
  pivot.add(door, vents);
  pivot.rotation.y = -2.0;
  g.add(pivot);
  // placa amarela com o raio, acima da caixa
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.13), new THREE.MeshBasicMaterial({ map: boltTexture(), transparent: true, depthWrite: false }));
  sign.position.set(cfg.x, cy + 0.34, zW + 0.006);
  g.add(sign);
  // tomada na base da alvenaria (de onde sai o fio do ventilador)
  const outlet = new THREE.Mesh(rbox(0.1, 0.13, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.4 }));
  const outletAt = new THREE.Vector3(cfg.x + 0.23, 0.2, zW + 0.017);
  outlet.position.copy(outletAt);
  const holes = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.06), new THREE.MeshBasicMaterial({ map: socketTexture(), transparent: true, depthWrite: false }));
  holes.position.set(outletAt.x, outletAt.y, zW + 0.036);
  g.add(outlet, holes);
  shadowAll(g);
  return { group: g, outletAt, boxTop: new THREE.Vector3(cfg.x, cy + 0.25, zW + 0.02), boxSide: new THREE.Vector3(cfg.x + 0.2, cy - 0.1, zW + 0.02) };
}
function boltTexture() {
  return canvasTexture(64, 56, (g, w, h) => {
    g.fillStyle = '#f2c14e';
    g.strokeStyle = '#1e1a16';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2, 4); g.lineTo(w - 4, h - 4); g.lineTo(4, h - 4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1e1a16';
    g.beginPath(); g.moveTo(35, 16); g.lineTo(24, 34); g.lineTo(32, 34); g.lineTo(27, 48); g.lineTo(41, 29); g.lineTo(33, 29); g.lineTo(38, 16); g.closePath(); g.fill();
  }, { repeat: false });
}
function ventTexture() {
  return canvasTexture(64, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,26,22,0.75)';
    for (let i = 0; i < 4; i++) g.fillRect(6, 4 + i * 7, w - 12, 3);
  }, { repeat: false });
}
function socketTexture() {
  return canvasTexture(32, 40, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#2a2420';
    g.beginPath(); g.arc(10, 14, 3.2, 0, TAU); g.arc(22, 14, 3.2, 0, TAU); g.fill();
    g.beginPath(); g.arc(16, 28, 3, 0, TAU); g.fill();
  }, { repeat: false });
}

/** Varal de luzinhas no alto da parede do fundo (vários vãos com barriga), aceso pelo disjuntor. */
function buildGarland(B, hooksX, y) {
  const g = new THREE.Group();
  g.name = 'varal-de-luzinhas';
  const z = B.minZ + 0.06;
  const wireMat = stdMat('#3a3a2e', { roughness: 0.6 });
  const pts = [];
  const bulbs = [];
  for (let i = 0; i < hooksX.length - 1; i++) {
    const a = hooksX[i], b = hooksX[i + 1];
    const n = Math.max(3, Math.round((b - a) / 0.09));
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      pts.push(new THREE.Vector3(a + (b - a) * u, y - Math.sin(Math.PI * u) * 0.11, z));
    }
    for (let k = 1; k < n; k++) {
      const u = k / n;
      bulbs.push(new THREE.Vector3(a + (b - a) * u, y - Math.sin(Math.PI * u) * 0.11 - 0.03, z + 0.008));
    }
    const hook = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), stdMat('#c99a45', { roughness: 0.35, metalness: 0.7 }));
    hook.position.set(a, y + 0.005, z - 0.03);
    g.add(hook);
  }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, 0.004, 4, false), wireMat);
  g.add(wire);
  // sem luz própria: a cor de cada instância é o brilho (apagada = vidro escuro; acesa = cor quente, que o bloom pega)
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 10, 8).scale(1, 1.3, 1), bulbMat, bulbs.length);
  const m = new THREE.Matrix4();
  bulbs.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(i, m); });
  const OFF = new THREE.Color('#3a3226');
  const tints = ['#ffd27a', '#ffb36b', '#fff0c8', '#ff9a8a'].map((c) => new THREE.Color(c));
  const col = new THREE.Color();
  const level = new Float32Array(bulbs.length);
  for (let i = 0; i < bulbs.length; i++) inst.setColorAt(i, OFF);
  g.add(inst);
  const S = { on: false, t: 0 };
  return {
    group: g,
    setOn(on) { if (on !== S.on) { S.on = on; S.t = 0; } },
    update(dt, t) {
      S.t += dt;
      let dirty = false;
      for (let i = 0; i < bulbs.length; i++) {
        // ao ligar, acendem em onda a partir do disjuntor; depois piscam de leve
        const target = S.on ? (S.t > i * 0.045 ? 0.82 + 0.18 * Math.sin(t * 2.3 + i * 1.9) : 0) : 0;
        const nl = level[i] + (target - level[i]) * (1 - Math.exp(-dt * (S.on ? 9 : 5)));
        if (Math.abs(nl - level[i]) > 1e-3) {
          level[i] = nl;
          col.copy(OFF).lerp(tints[i % tints.length], nl);
          inst.setColorAt(i, col);
          dirty = true;
        }
      }
      if (dirty && inst.instanceColor) inst.instanceColor.needsUpdate = true;
    },
  };
}

/** Vaso de terra com uma palmeirinha num carrinho de madeira com rodízios (empurrável no trilho). */
function buildPlanter(P) {
  const holder = new THREE.Group();
  holder.name = 'vaso-de-rodinhas';
  const wood = woodMat('#7a5232', { key: 'f9-carrinho', rough: 0.6 });
  const dolly = new THREE.Mesh(rbox(P.half * 2, 0.05, P.half * 2, 0.012), wood);
  dolly.position.y = 0.075;
  holder.add(dolly);
  for (const sx of [-1, 1]) {
    const slat = new THREE.Mesh(rbox(0.05, 0.02, P.half * 2 + 0.02, 0.006), wood);
    slat.position.set(sx * (P.half - 0.05), 0.11, 0);
    holder.add(slat);
  }
  const wheelMat = stdMat('#262220', { roughness: 0.6 });
  const forkMat = stdMat('#9a9690', { roughness: 0.35, metalness: 0.7 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), forkMat);
    fork.position.set(sx * (P.half - 0.06), 0.035 + 0.02, sz * (P.half - 0.06));
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 14).rotateZ(Math.PI / 2), wheelMat);
    w.position.set(sx * (P.half - 0.06), 0.03, sz * (P.half - 0.06));
    holder.add(fork, w);
  }
  const clayMat = new THREE.MeshStandardMaterial({ color: '#b5643e', roughness: 0.85, emissive: '#ffcf7a', emissiveIntensity: 0 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.36, 26), clayMat);
  pot.position.y = 0.1 + 0.18;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 26).rotateX(Math.PI / 2), clayMat);
  rim.position.y = 0.46;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.012, 6, 26).rotateX(Math.PI / 2), stdMat('#8a4a2c', { roughness: 0.8 }));
  band.position.y = 0.23;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.2, 22).rotateX(-Math.PI / 2), stdMat('#3a2a1c', { roughness: 1 }));
  soil.position.y = 0.445;
  holder.add(pot, rim, band, soil);
  // palmeirinha: tronquinho e folhas em leque
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.26, 8), stdMat('#7a5a3a', { roughness: 0.9 }));
  trunk.position.y = 0.58;
  holder.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4f8a3a', roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.34 * u, 0.7 + Math.sin(Math.PI * u * 0.7) * 0.16 - u * u * 0.14, Math.sin(a) * 0.34 * u));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    holder.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.006, 4, false), leafMat));
    for (let k = 1; k < 7; k++) {
      const p = curve.getPoint(k / 7);
      for (const sd of [-1, 1]) {
        const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.11 * (1 - k / 9), 0.026), leafMat);
        lf.position.copy(p);
        lf.rotation.set(0.25, -a + sd * 0.9, sd * 0.35);
        holder.add(lf);
      }
    }
  }
  // etiqueta "TERRA" pendurada (pesado!)
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.06), new THREE.MeshStandardMaterial({ map: tagTexture(), roughness: 0.7 }));
  tag.position.set(0, 0.3, 0.2 + 0.005);
  tag.rotation.x = -0.12;
  holder.add(tag);
  shadowAll(holder);
  const sh = contactShadow(P.half + 0.04, P.half + 0.04, 0.4);
  sh.position.y = 0.004;
  holder.add(sh);
  holder.position.set(P.start.x, 0, P.start.z);
  const st = { hl: false, glow: 0 };
  return {
    object: holder,
    setPos(x, z) { holder.position.set(x, 0, z); },
    setHighlight(on) { st.hl = !!on; },
    update(dt, t) {
      st.glow = ease(st.glow, st.hl ? 1 : 0, dt, 5);
      clayMat.emissiveIntensity = st.glow * (0.22 + 0.1 * Math.sin(t * 4));
    },
  };
}
function tagTexture() {
  return canvasTexture(96, 52, (g, w, h) => {
    g.fillStyle = '#efe2c2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a6a48'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#4a3020'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('TERRA', w / 2, h / 2 + 1);
  }, { repeat: false });
}

/** Botão do registro no chão: aro de ferro com faixa amarela e preta, tampa de latão que afunda com o peso. */
function buildPlate(P) {
  const g = new THREE.Group();
  g.name = 'botao-do-registro';
  g.position.set(P.x, 0, P.z);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(P.hx, P.hx + 0.02, 0.022, 36), new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6 }));
  ring.position.y = 0.011;
  const capMat = new THREE.MeshStandardMaterial({ color: '#c99a45', roughness: 0.3, metalness: 0.85, emissive: '#5fe08a', emissiveIntensity: 0 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(P.hx - 0.07, P.hx - 0.06, 0.03, 32), capMat);
  cap.position.y = 0.035;
  const icon = new THREE.Mesh(new THREE.CircleGeometry(P.hx - 0.1, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ventIconTexture(), roughness: 0.4, metalness: 0.3, transparent: true, depthWrite: false }));
  icon.position.y = 0.053;
  g.add(ring, cap, icon);
  shadowAll(g);
  return {
    group: g,
    /** Ponto de onde sai a haste até a grade (lado leste do aro). */
    rodStart: new THREE.Vector3(P.x + P.hx + 0.01, 0.018, P.z),
    setPress(t) {
      cap.position.y = 0.035 - 0.016 * t;
      icon.position.y = 0.053 - 0.016 * t;
      capMat.emissiveIntensity = 0.35 * t;
    },
  };
}
function hazardTexture() {
  return canvasTexture(256, 32, (g, w, h) => {
    g.fillStyle = '#f2c14e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1e1a16';
    for (let x = -h; x < w; x += 24) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 12, h); g.lineTo(x + 12 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
  });
}
function ventIconTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,40,20,0.85)'; g.lineWidth = 4; g.lineCap = 'round';
    g.strokeRect(16, 18, 32, 28);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(21, 25 + i * 7); g.lineTo(43, 25 + i * 7); g.stroke(); }
    g.beginPath(); g.moveTo(32, 14); g.lineTo(32, 6); g.moveTo(27, 10); g.lineTo(32, 5); g.lineTo(37, 10); g.stroke();
  }, { repeat: false });
}

/**
 * Fio do ventilador até a tomada, deitado no chão e sempre à mostra: sai da base pelo oeste (longe dos vasos grandes e
 * das folhas da samambaia, que o escondiam), corre para o norte, segue o pé da parede e sobe até a tomada. Refeito
 * quando o ventilador anda.
 */
function buildFanCord(outletAt, minX) {
  const mat = stdMat('#efe9dc', { roughness: 0.55 });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.name = 'fio-do-ventilador';
  mesh.receiveShadow = true;
  const R = 0.009;
  const FLOOR = R + 0.004; // nunca encosta nem afunda no chão
  let last = null;
  return {
    object: mesh,
    /** @param {THREE.Vector3} plug */
    follow(plug) {
      if (last && last.distanceTo(plug) < 0.02) return;
      last = plug.clone();
      const cx = Math.max(minX, plug.x - 0.12); // nunca por baixo do vaso de rodinhas
      const wallZ = outletAt.z + 0.05;
      const pts = [
        new THREE.Vector3(plug.x, 0.02, plug.z), new THREE.Vector3(cx, FLOOR, plug.z - 0.04),
        new THREE.Vector3(cx, FLOOR, wallZ + 0.3), new THREE.Vector3(cx + 0.15, FLOOR, wallZ + 0.03),
        new THREE.Vector3(outletAt.x - 0.15, FLOOR, wallZ), new THREE.Vector3(outletAt.x, FLOOR + 0.01, wallZ - 0.01),
        new THREE.Vector3(outletAt.x, outletAt.y - 0.065, outletAt.z + 0.02),
      ];
      // curva suave amostrada; os pontos ficam acima do chão (a interpolação podia passar por baixo)
      const smoothCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const samples = smoothCurve.getSpacedPoints(48).map((p) => (p.y < FLOOR ? p.setY(FLOOR) : p));
      /** @type {THREE.CurvePath<THREE.Vector3>} */
      const path = new THREE.CurvePath();
      for (let i = 0; i < samples.length - 1; i++) path.add(new THREE.LineCurve3(samples[i], samples[i + 1]));
      mesh.geometry.dispose();
      mesh.geometry = new THREE.TubeGeometry(path, samples.length - 1, R, 6, false);
    },
  };
}

export function buildConservatory({ root, layout }) {
  const { POTS, WICKER_CHAIR: WC, PLANT_TABLE: PT, FAN, WORLD, BREAKER, PLANTER, DAMPER_PLATE, DUCT } = layout;
  const B = WORLD.bounds;
  const grp = new THREE.Group();
  grp.name = 'jardim-de-inverno';
  POTS.forEach((p, i) => grp.add(potPlant(p.x, p.z, p.r * 0.85, i === 0 ? 'fern' : 'monstera', 31 + i)));
  // vasinhos pequenos no peitoril das vidraças (só enfeite, perto do vidro)
  for (const [x, k] of /** @type {[number, string][]} */ ([[4.85, 'fern'], [7.4, 'monstera']])) {
    const small = potPlant(x, B.minZ + 0.18, 0.09, k, 70 + x);
    small.scale.setScalar(0.55);
    small.position.y = 0.0;
    grp.add(small);
  }
  // mesinha de plantas com suculentas e o regador
  const table = new THREE.Group();
  table.position.set(PT.x, 0, PT.z);
  const tw = woodMat('#8a6a48', { key: 'f9-mesa-plantas', rough: 0.7 });
  const top = new THREE.Mesh(rbox(PT.hx * 2, 0.04, PT.hz * 2, 0.01), tw);
  top.position.y = PT.h - 0.02;
  table.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(rbox(0.04, PT.h - 0.04, 0.04, 0.008), tw);
    l.position.set(sx * (PT.hx - 0.04), (PT.h - 0.04) / 2, sz * (PT.hz - 0.04));
    table.add(l);
  }
  const succ = stdMat('#6f9a68', { roughness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 14), stdMat('#d8cba8', { roughness: 0.6 }));
    pot.position.set(-0.22 + i * 0.16, PT.h + 0.04, -0.05);
    const plant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.055, 0), succ);
    plant.position.set(-0.22 + i * 0.16, PT.h + 0.11, -0.05);
    plant.scale.set(1, 0.7, 1);
    table.add(pot, plant);
  }
  const can = new THREE.Group();
  can.position.set(0.24, PT.h, 0.06);
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.16, 16), stdMat('#3f8fb0', { roughness: 0.3, metalness: 0.4 }));
  canBody.position.y = 0.08;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.22, 8), stdMat('#3f8fb0', { roughness: 0.3, metalness: 0.4 }));
  spout.position.set(-0.1, 0.13, 0);
  spout.rotation.z = 1.0;
  can.add(canBody, spout);
  table.add(can);
  grp.add(table);
  // poltrona de vime com a manta
  const chair = new THREE.Group();
  chair.position.set(WC.x, 0, WC.z);
  chair.rotation.y = -0.6;
  const wicker = new THREE.MeshStandardMaterial({ color: '#c9a46a', roughness: 0.9 });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(WC.r, WC.r * 0.85, 0.32, 20), wicker);
  seat.position.y = 0.16;
  const back = new THREE.Mesh(new THREE.SphereGeometry(WC.r, 20, 12, 0, Math.PI, 0, Math.PI / 2), wicker);
  back.position.set(0, 0.32, 0);
  back.rotation.y = Math.PI;
  back.scale.set(1, 1.6, 0.9);
  const throwBlanket = new THREE.Mesh(rbox(WC.r * 1.3, 0.04, WC.r * 0.9, 0.02), new THREE.MeshStandardMaterial({ color: '#8a2f3a', roughness: 0.95 }));
  throwBlanket.position.set(0.05, 0.34, 0.06);
  throwBlanket.rotation.y = 0.4;
  chair.add(seat, back, throwBlanket);
  grp.add(chair);
  // lanterna pendurada (acende com a energia)
  const lantern = new THREE.Group();
  lantern.position.set(6.2, 2.25, 0.4);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.8, 4), stdMat('#2a2420'));
  cord.position.y = 0.45;
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 0.5, wireframe: true }));
  const glowMat = new THREE.MeshBasicMaterial({ color: '#4a3a24' });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), glowMat);
  lantern.add(cord, cage, glow);
  grp.add(lantern);
  shadowAll(grp);
  for (const p of POTS) {
    const sh = contactShadow(p.r + 0.06, p.r + 0.06, 0.4);
    sh.position.set(p.x, 0.004, p.z);
    root.add(sh);
  }
  root.add(grp);
  const fan = buildFan(FAN);
  root.add(fan.object);

  // ---- energia: o disjuntor, o conduíte até o varal de luzinhas e a tomada do ventilador
  const breakerBox = buildBreakerBox(BREAKER, B);
  root.add(breakerBox.group);
  const garland = buildGarland(B, [4.5, 4.97, 5.45, 5.95, 6.45, 6.85, 7.4, 7.95], 2.86);
  root.add(garland.group);
  const wallZ = B.minZ + 0.022;
  const conduitUp = makeLink([breakerBox.boxTop, new THREE.Vector3(BREAKER.x, 2.9, wallZ), new THREE.Vector3(4.5, 2.9, wallZ)], { radius: 0.014, color: '#8f948f', glow: '#ffd36a', clips: 6, clipColor: '#6a6e6a', metal: true });
  const conduitEast = makeLink([new THREE.Vector3(BREAKER.x, 2.9, wallZ), new THREE.Vector3(7.95, 2.9, wallZ)], { radius: 0.014, color: '#8f948f', glow: '#ffd36a', clips: 2, clipColor: '#6a6e6a', metal: true });
  const conduitDown = makeLink([breakerBox.boxSide, new THREE.Vector3(BREAKER.x + 0.23, breakerBox.boxSide.y, wallZ), new THREE.Vector3(BREAKER.x + 0.23, breakerBox.outletAt.y + 0.07, wallZ)], { radius: 0.012, color: '#8f948f', glow: '#ffd36a', clips: 2, clipColor: '#6a6e6a', metal: true });
  root.add(conduitUp.object, conduitEast.object, conduitDown.object);
  const fanCord = buildFanCord(breakerBox.outletAt, PLANTER.minX + PLANTER.half + 0.12);
  root.add(fanCord.object);
  fanCord.follow(fan.plugPoint());

  // ---- o vaso de rodinhas e o botão do registro, com a haste até a grade de baixo do duto
  const planter = buildPlanter(PLANTER);
  root.add(planter.object);
  const plate = buildPlate(DAMPER_PLATE);
  root.add(plate.group);
  const rodZ = B.minZ + 0.03;
  const rod = makeLink([plate.rodStart, new THREE.Vector3(plate.rodStart.x + 0.08, 0.018, plate.rodStart.z), new THREE.Vector3(plate.rodStart.x + 0.08, 0.018, rodZ), new THREE.Vector3(DUCT.inlet.x - 0.24, 0.018, rodZ), new THREE.Vector3(DUCT.inlet.x - 0.24, 0.08, rodZ)], { radius: 0.011, color: '#c99a45', glow: '#7fe0a0', clips: 4, metal: true });
  root.add(rod.object);

  const S = { power: false, plate: false, lanternLight: /** @type {THREE.PointLight | null} */ (null), lanternK: 0 };
  return {
    group: grp, fan, planter, plate, lanternPos: new THREE.Vector3(6.2, 2.2, 0.4),
    /** A luz de verdade da lanterna (criada em props.js): acende com a energia. */
    setLanternLight(l) { S.lanternLight = l; },
    power: {
      setOn(on) {
        on = !!on;
        if (on === S.power) return;
        S.power = on;
        if (on) { conduitUp.pulse(); conduitEast.pulse(); conduitDown.pulse(); }
        for (const l of [conduitUp, conduitEast, conduitDown]) l.setOn(on);
        garland.setOn(on);
      },
    },
    plateLink: {
      setOn(on) {
        on = !!on;
        if (on === S.plate) return;
        S.plate = on;
        if (on) rod.pulse();
        rod.setOn(on);
      },
    },
    update(dt, t) {
      fan.update(dt, t);
      fanCord.follow(fan.plugPoint());
      planter.update(dt, t);
      garland.update(dt, t);
      for (const l of [conduitUp, conduitEast, conduitDown, rod]) l.update(dt);
      lantern.rotation.z = Math.sin(t * 0.8) * 0.03;
      S.lanternK = ease(S.lanternK, S.power ? 1 : 0, dt, 4);
      glowMat.color.setRGB(0.29 + 0.71 * S.lanternK, 0.23 + 0.6 * S.lanternK, 0.14 + 0.4 * S.lanternK);
      if (S.lanternLight) S.lanternLight.intensity = 0.06 + 0.8 * S.lanternK;
    },
  };
}
