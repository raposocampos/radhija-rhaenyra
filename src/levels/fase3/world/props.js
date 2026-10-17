// FASE 3 · Props interativos: portão de treliça, postes com lanternas (H = lua, L = estrela),
// pedras de pressão (anel de musgo + pata + ícone gravado que acende), fios de luzinhas ligando
// cada pedra à sua lanterna, ninho da Dona Gansa, pantufa felpuda rosa e ossinhos dourados.
import * as THREE from 'three';
import {
  woodMat, stdMat, ironMat, brassMat, rbox, canvasTexture, contactShadow, radialTexture, rng, paint, vnoise2, vnoise3,
  mergeGeometries, mergeVertices, speckleTexture, mat,
} from '../../../world/util.js';
import { buildTreats, starTexture } from '../../../world/treats.js';

// ------------------------------------------------------------------ ícones (lua / estrela) e texturas
function drawIcon(g, kind, cx, cy, s) {
  g.beginPath();
  if (kind === 'moon') {
    g.arc(cx, cy, s, 0, Math.PI * 2);
    g.arc(cx + s * 0.45, cy - s * 0.25, s * 0.85, 0, Math.PI * 2, true);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const rr = i % 2 ? s * 0.45 : s;
      i ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
  }
  g.fill('evenodd');
}
function drawPaw(g, cx, cy, s) {
  g.beginPath(); g.ellipse(cx, cy + s * 0.25, s * 0.42, s * 0.34, 0, 0, Math.PI * 2); g.fill();
  for (const [dx, dy] of [[-0.5, -0.32], [-0.18, -0.62], [0.18, -0.62], [0.5, -0.32]]) {
    g.beginPath(); g.ellipse(cx + dx * s, cy + dy * s, s * 0.15, s * 0.19, dx * 0.4, 0, Math.PI * 2); g.fill();
  }
}
function stoneTopTextures(kind, seed) {
  const S = 256;
  const color = canvasTexture(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = vnoise2(x * 0.05 + seed, y * 0.05) * 0.6 + vnoise2(x * 0.2, y * 0.2 + seed) * 0.3 + vnoise2(x * 0.7, y * 0.7) * 0.1;
      const v = 150 + (n - 0.5) * 70;
      const i = (y * w + x) * 4;
      img.data[i] = v * 0.98; img.data[i + 1] = v * 0.96; img.data[i + 2] = v * 0.9; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // anel de musgo na borda
    const rg = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.5);
    rg.addColorStop(0, 'rgba(70,100,45,0)'); rg.addColorStop(0.65, 'rgba(70,100,45,0.55)'); rg.addColorStop(1, 'rgba(60,90,40,0.9)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    // entalhes (escuros): pata + ícone
    g.fillStyle = 'rgba(55,48,40,0.9)';
    drawPaw(g, w * 0.5, h * 0.6, w * 0.2);
    drawIcon(g, kind, w * 0.5, h * 0.27, w * 0.1);
    g.strokeStyle = 'rgba(55,48,40,0.7)'; g.lineWidth = 3;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); g.stroke();
  }, { repeat: false });
  const emissive = canvasTexture(S, S, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    drawPaw(g, w * 0.5, h * 0.6, w * 0.2);
    drawIcon(g, kind, w * 0.5, h * 0.27, w * 0.1);
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); g.stroke();
  }, { repeat: false });
  return { color, emissive };
}
function plaqueTexture(kind) {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    drawIcon(g, kind, w / 2, h / 2, w * 0.36);
  }, { repeat: false, srgb: false });
}

const ease = (cur, target, dt, rate) => cur + (target - cur) * Math.min(1, dt * rate);

// ------------------------------------------------------------------ fio de luzinhas (instanciado)
function makeFairyWire(points, { spacing = 0.11, color = '#ffc070', bulbR = 0.016, wireR = 0.0035, sag = 0 } = {}) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const len = curve.getLength();
  const n = Math.max(2, Math.round(len / spacing));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, n * 2), wireR, 4), stdMat('#1d1a18', { roughness: 0.6 })));
  const bulbGeo = new THREE.SphereGeometry(bulbR, 8, 6);
  bulbGeo.scale(1, 1.25, 1);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: true });
  const im = new THREE.InstancedMesh(bulbGeo, bulbMat, n);
  const m4 = new THREE.Matrix4();
  const P = new THREE.Vector3();
  const off = new THREE.Color('#3a3026'), on = new THREE.Color(color).multiplyScalar(5.0), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    curve.getPointAt((i + 0.5) / n, P);
    m4.makeTranslation(P.x, P.y - bulbR * 1.1, P.z);
    im.setMatrixAt(i, m4);
    im.setColorAt(i, off);
  }
  im.frustumCulled = false;
  g.add(im);
  let shown = -1;
  return {
    group: g, count: n, curve,
    /** progress 0..1 percorre o fio; glow multiplica. */
    set(progress, glow, t) {
      const key = Math.round(progress * 400) * 1000 + Math.round(glow * 100) + (progress > 0 ? Math.round(t * 12) * 1e6 : 0);
      if (key === shown) return;
      shown = key;
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const k = THREE.MathUtils.smoothstep(progress * 1.15 - f, 0.0, 0.15);
        const tw = 0.85 + 0.15 * Math.sin(t * 3 + i * 1.7);
        c.copy(off).lerp(on, k * glow * tw);
        im.setColorAt(i, c);
      }
      im.instanceColor.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------ lanterna (no topo do poste)
function makeLantern(kind) {
  const g = new THREE.Group();
  const iron = ironMat();
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#cfd8e0', roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.32, emissive: '#ffb259', emissiveIntensity: 0, depthWrite: false,
  });
  const H = 0.24, W = 0.15;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(W - 0.01, H - 0.02, W - 0.01), glassMat);
  glass.position.y = H / 2;
  g.add(glass);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const bar = new THREE.Mesh(rbox(0.016, H, 0.016, 0.004), iron);
    bar.position.set(sx * W / 2, H / 2, sz * W / 2);
    g.add(bar);
  }
  const base = new THREE.Mesh(rbox(W + 0.04, 0.03, W + 0.04, 0.008), iron);
  base.position.y = 0.0;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(W * 0.92, 0.1, 4), iron);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = H + 0.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 14), iron);
  ring.position.y = H + 0.12;
  g.add(base, roof, ring);
  // vela + chama
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 12), stdMat('#efe2c8', { roughness: 0.6 }));
  candle.position.y = 0.05;
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a'), transparent: true, opacity: 1 });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), flameMat);
  flame.scale.set(1, 2.2, 1);
  flame.position.y = 0.115;
  g.add(candle, flame);
  // plaquinha com o ícone (frente oeste e leste), em latão; o ícone acende junto
  const plaqueMat = new THREE.MeshStandardMaterial({ color: '#c99a45', metalness: 0.9, roughness: 0.35, emissive: '#ffc070', emissiveMap: plaqueTexture(kind), emissiveIntensity: 0.15 });
  for (const s of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), plaqueMat);
    pl.position.set(s * 0.068, -0.12, 0);
    pl.rotation.y = s * Math.PI / 2;
    g.add(pl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.006, 6, 20), brassMat());
    rim.position.copy(pl.position);
    rim.rotation.y = s * Math.PI / 2;
    g.add(rim);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffb35a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(0.9, 0.9, 1);
  halo.position.y = 0.12;
  g.add(halo);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh && o !== glass && o !== flame) { o.castShadow = true; } });
  return { group: g, glassMat, flame, flameMat, plaqueMat, halo };
}

// ------------------------------------------------------------------ pedra de pressão
function makePlate(P, kind, seed) {
  const root = new THREE.Group();
  root.position.set(P.x, 0, P.z);
  const r = rng(seed);
  // pedra: disco irregular com topo levemente abaulado
  const R = P.r * 0.92;
  const geo = new THREE.CylinderGeometry(1, 1, 1, 40, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const rr = 1 + (vnoise2(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3) - 0.5) * 0.16;
    const top = y > 0.4;
    const d = Math.hypot(x, z);
    const ny = top ? 0.07 + 0.015 * (1 - d * d) : y < -0.4 ? -0.08 : 0.0 + y * 0.06;
    pos.setXYZ(i, x * R * rr * (top ? 0.97 : 1), ny, z * R * rr * (top ? 0.97 : 1));
  }
  geo.computeVertexNormals();
  // uv planar no topo
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (R * 2.2) + 0.5, 0.5 - pos.getZ(i) / (R * 2.2));
  const tex = stoneTopTextures(kind, seed);
  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#d8d0c4', map: tex.color, roughness: 0.82, bumpMap: tex.color, bumpScale: 2.0,
    emissive: '#ffb45a', emissiveMap: tex.emissive, emissiveIntensity: 0.0,
  });
  const stone = new THREE.Mesh(geo, stoneMat);
  stone.castShadow = true; stone.receiveShadow = true;
  const moving = new THREE.Group();
  moving.add(stone);
  root.add(moving);
  // anel de musgo + seixos em volta (fixos no chão)
  const mossGeos = [];
  const n = Math.round(P.r * 70);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.1;
    const rr = R * (1.02 + r() * 0.14);
    const b = new THREE.IcosahedronGeometry(0.03 + r() * 0.025, 1);
    b.scale(1.3, 0.45, 1.3);
    b.translate(Math.cos(a) * rr, 0.0, Math.sin(a) * rr);
    paint(b, new THREE.Color('#4c6e2f').offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.08));
    b.deleteAttribute('uv');
    mossGeos.push(b);
  }
  const moss = new THREE.Mesh(mergeGeometries(mossGeos), mat('f3-moss', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  moss.receiveShadow = true;
  root.add(moss);
  // vão escuro (terra) que aparece quando a pedra afunda
  const gap = new THREE.Mesh(new THREE.CircleGeometry(R * 1.04, 32).rotateX(-Math.PI / 2), stdMat('#1e1912', { roughness: 1 }));
  gap.position.y = 0.002;
  root.add(gap);
  root.add(contactShadow(R * 1.25, R * 1.25, 0.35, 0.004));
  let press = 0, glow = 0;
  return {
    object: root, stoneMat,
    get press() { return press; },
    setPress(t) { press = THREE.MathUtils.clamp(t, 0, 1); },
    _update(dt, t) {
      moving.position.y = -0.055 * press;
      glow = ease(glow, press > 0.5 ? 1 : 0, dt, 5);
      stoneMat.emissiveIntensity = glow * (1.4 + 0.25 * Math.sin(t * 3)) + 0.04 * (0.5 + 0.5 * Math.sin(t * 1.6 + seed));
      return glow;
    },
  };
}

// ------------------------------------------------------------------ pantufa felpuda rosa (eixo longo em X, centrada)
function makeSlipper() {
  const g = new THREE.Group();
  g.name = 'slipper'; // as dogs detectam a pose de carregar pelo nome
  g.userData.carryKind = 'slipper';
  const L = 0.25, Wd = 0.105;
  const plush = new THREE.MeshPhysicalMaterial({
    color: '#ff8fbf', roughness: 0.85, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#ffd1e6'),
    emissive: '#ff5fa2', emissiveIntensity: 0.2,
  });
  const soleMat = stdMat('#f3e6ee', { roughness: 0.9 });
  // sola (formato de pegada)
  const s = new THREE.Shape();
  s.moveTo(-L / 2, 0);
  s.bezierCurveTo(-L / 2, Wd * 0.48, -L * 0.15, Wd * 0.42, L * 0.1, Wd * 0.52);
  s.bezierCurveTo(L * 0.42, Wd * 0.58, L / 2 + 0.01, Wd * 0.3, L / 2, 0);
  s.bezierCurveTo(L / 2 + 0.01, -Wd * 0.3, L * 0.42, -Wd * 0.58, L * 0.1, -Wd * 0.52);
  s.bezierCurveTo(-L * 0.15, -Wd * 0.42, -L / 2, -Wd * 0.48, -L / 2, 0);
  const soleGeo = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 16 });
  soleGeo.rotateX(-Math.PI / 2);
  const sole = new THREE.Mesh(soleGeo, soleMat);
  sole.position.y = -0.045;
  g.add(sole);
  // forro felpudo sobre a sola
  const liner = new THREE.Mesh(soleGeo.clone().scale(0.96, 0.6, 0.94), plush);
  liner.position.y = -0.02;
  g.add(liner);
  // gáspea fofa (meia cúpula sobre a frente)
  const upGeo = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = upGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fuzz = 1 + (vnoise3(x * 9, y * 9, z * 9) - 0.5) * 0.12;
    p.setXYZ(i, x * fuzz, y * fuzz, z * fuzz);
  }
  upGeo.computeVertexNormals();
  const upper = new THREE.Mesh(upGeo, plush);
  upper.scale.set(L * 0.36, 0.06, Wd * 0.56);
  upper.position.set(L * 0.13, -0.02, 0);
  g.add(upper);
  // pompom
  const pomGeo = new THREE.IcosahedronGeometry(1, 3);
  const pp = pomGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
    const k = 1 + (vnoise3(x * 6 + 2, y * 6, z * 6) - 0.5) * 0.35;
    pp.setXYZ(i, x * k, y * k, z * k);
  }
  pomGeo.computeVertexNormals();
  const pom = new THREE.Mesh(pomGeo, new THREE.MeshPhysicalMaterial({ color: '#fff0f6', roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#ffffff'), emissive: '#ffc6dd', emissiveIntensity: 0.12 }));
  pom.scale.setScalar(0.03);
  pom.position.set(L * 0.2, 0.04, 0);
  g.add(pom);
  // pelinhos (tufos) na gáspea
  const tufts = [];
  const rr = rng(5);
  for (let i = 0; i < 70; i++) {
    const a = rr() * Math.PI * 2, b = rr() * Math.PI * 0.45;
    const x = Math.cos(a) * Math.sin(b), y = Math.cos(b), z = Math.sin(a) * Math.sin(b);
    const c = new THREE.ConeGeometry(0.006, 0.02, 4);
    c.lookAt(new THREE.Vector3(x, y, z));
    c.rotateX(Math.PI / 2);
    c.translate(L * 0.13 + x * L * 0.36, -0.02 + y * 0.06, z * Wd * 0.56);
    c.deleteAttribute('uv');
    tufts.push(c);
  }
  const fur = new THREE.Mesh(mergeGeometries(tufts), plush);
  g.add(fur);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, plush };
}

// ------------------------------------------------------------------ ninho de palha da Dona Gansa
function makeNest(N) {
  const g = new THREE.Group();
  g.position.set(N.x, 0, N.z);
  const r = rng(12);
  const straw = [];
  const twigGeo = new THREE.CylinderGeometry(0.004, 0.004, 1, 3);
  twigGeo.deleteAttribute('uv');
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const n = 260;
  const im = new THREE.InstancedMesh(twigGeo, mat('f3-straw', () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })), n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const ring = N.r * (0.55 + r() * 0.5);
    const y = 0.02 + r() * 0.09 * (ring / N.r);
    e.set(Math.PI / 2 + (r() - 0.5) * 0.6, a + Math.PI / 2 + (r() - 0.5) * 0.5, (r() - 0.5) * 0.5);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a) * ring, y, Math.sin(a) * ring), q, new THREE.Vector3(1, 0.12 + r() * 0.14, 1));
    im.setMatrixAt(i, m4);
    c.setHSL(0.1 + r() * 0.03, 0.45 + r() * 0.2, 0.42 + r() * 0.25);
    im.setColorAt(i, c);
  }
  im.castShadow = true; im.receiveShadow = true;
  g.add(im);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(N.r * 0.75, 20, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), stdMat('#7a5a30', { roughness: 1, side: THREE.DoubleSide }));
  bowl.position.y = 0.09;
  bowl.scale.y = 0.5;
  g.add(bowl);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(N.r * 0.8, 0.045, 8, 28), new THREE.MeshStandardMaterial({ color: '#9c7a45', roughness: 1, map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 2 }));
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 0.06;
  ring2.scale.z = 0.9;
  g.add(ring2);
  // ovinhos e penas
  const eggMat = stdMat('#f4efe4', { roughness: 0.5 });
  for (const [x, z] of [[-0.04, 0.02], [0.05, -0.03]]) {
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), eggMat);
    egg.scale.set(1, 0.8, 1.3);
    egg.position.set(x, 0.06, z);
    g.add(egg);
  }
  const featherMat = new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.08), featherMat);
    const a = r() * Math.PI * 2;
    f.position.set(Math.cos(a) * N.r * 1.2, 0.012, Math.sin(a) * N.r * 1.2);
    f.rotation.set(-Math.PI / 2 + 0.2, 0, a);
    g.add(f);
  }
  g.add(contactShadow(N.r * 1.35, N.r * 1.35, 0.5));
  return g;
}

// ------------------------------------------------------------------ portão de treliça
function makeGate(G, H) {
  const pivot = new THREE.Group();
  pivot.name = 'portao-trelica';
  pivot.position.set(G.hinge.x, 0, G.hinge.z);
  const L = G.length - 0.04;
  const frameMat = woodMat('#d2b088', { key: 'f3-gate-frame', vertical: true, rough: 0.66 });
  const slatMat = woodMat('#e3c9a2', { key: 'f3-gate-slat', rough: 0.66 });
  const z0 = -0.03, z1 = -L, y0 = 0.07, yTop = (z) => H - 0.06 + 0.06 * Math.sin(Math.PI * (z - z0) / (z1 - z0));
  for (const z of [z0 - 0.02, z1 + 0.02]) {
    const st = new THREE.Mesh(rbox(0.07, H - 0.02, 0.065, 0.012), frameMat);
    st.position.set(0, (H - 0.02) / 2 + 0.03, z);
    pivot.add(st);
  }
  const bottom = new THREE.Mesh(rbox(0.05, 0.05, L, 0.01), frameMat);
  bottom.position.set(0, y0, (z0 + z1) / 2);
  pivot.add(bottom);
  const topPts = [];
  for (let i = 0; i <= 16; i++) { const z = z0 + (z1 - z0) * (i / 16); topPts.push(new THREE.Vector3(0, yTop(z), z)); }
  const topRail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(topPts), 24, 0.034, 8), frameMat);
  topRail.scale.x = 1.6;
  pivot.add(topRail);
  for (const z of [z0 - 0.02, z1 + 0.02]) {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), frameMat);
    fin.position.set(0, H + 0.03, z);
    pivot.add(fin);
  }
  const midRail = new THREE.Mesh(rbox(0.04, 0.04, L, 0.01), frameMat);
  midRail.position.set(0, 0.48, (z0 + z1) / 2);
  pivot.add(midRail);
  // treliça diagonal (losangos) recortada no quadro
  const sp = 0.15;
  const zs = z1, ze = z0;
  for (const dir of [1, -1]) {
    for (let c = -2; c < 12; c++) {
      // linha y = y0 + dir*(z - zs) + c*sp ... recorta em [zs,ze] x [y0, top]
      const pts = [];
      for (let k = 0; k <= 60; k++) {
        const z = zs + (ze - zs) * (k / 60);
        const y = dir > 0 ? y0 + (z - zs) + c * sp - 0.6 : y0 - (z - zs) + c * sp;
        if (y >= y0 + 0.01 && y <= yTop(z) - 0.02) pts.push([z, y]);
      }
      if (pts.length < 2) continue;
      const a = pts[0], b = pts[pts.length - 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.04) continue;
      const sl = new THREE.Mesh(rbox(0.018, 0.026, len, 0.005), slatMat);
      sl.position.set(dir * 0.006, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2);
      sl.rotation.x = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      pivot.add(sl);
    }
  }
  // dobradiças e trinco
  for (const y of [0.18, H - 0.18]) {
    const strap = new THREE.Mesh(rbox(0.008, 0.04, 0.22, 0.004), ironMat());
    strap.position.set(0.036, y, -0.1); // 4 mm à frente do poste
    pivot.add(strap);
  }
  const latch = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 14), ironMat());
  latch.position.set(0.035, 0.62, z1 + 0.06);
  latch.rotation.y = Math.PI / 2;
  pivot.add(latch);
  pivot.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return pivot;
}

function makePost(x, z, h) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const m = woodMat('#8a6442', { key: 'f3-gatepost', vertical: true, rough: 0.78 });
  const post = new THREE.Mesh(rbox(0.13, h, 0.13, 0.015), m);
  post.position.y = h / 2;
  const cap = new THREE.Mesh(rbox(0.18, 0.04, 0.18, 0.012), woodMat('#76553a', { key: 'f3-gatepost-cap', rough: 0.8 }));
  cap.position.y = h + 0.02;
  g.add(post, cap);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function createProps(layout, field, refs) {
  const root = new THREE.Group();
  root.name = 'props-fase3';
  const { GATE, LANTERNS, PLATE_H, PLATE_L, SLIPPER, NEST, COLLECTIBLES, NOOK, HEDGE_AB } = layout;
  const starTex = starTexture();
  const lightsForWater = [];

  // ================================================================== portão + postes + lanternas
  const gatePivot = makeGate(GATE, 0.86);
  root.add(gatePivot);
  const gate = {
    object: gatePivot, t: 0,
    setOpen(t) { this.t = THREE.MathUtils.clamp(t, 0, 1); gatePivot.rotation.y = GATE.openYaw * this.t; },
  };
  const postH = 1.02;
  const lanterns = {};
  for (const [key, kind] of [['H', 'moon'], ['L', 'star']]) {
    const P = LANTERNS[key];
    root.add(makePost(P.x, P.z, postH));
    const lt = makeLantern(kind);
    lt.group.position.set(P.x, postH + 0.04, P.z);
    root.add(lt.group);
    const light = new THREE.PointLight(kind === 'moon' ? '#ffa94d' : '#ffc46e', 0, 4.2, 1.5);
    light.position.set(P.x + 0.15, P.y + 0.05, P.z);
    root.add(light);
    const water = { pos: new THREE.Vector3(P.x, P.y + 0.1, P.z), col: new THREE.Color(kind === 'moon' ? '#ffa94d' : '#ffc46e'), k: 0 };
    lightsForWater.push(water);
    const st = { k: 0, target: 0 };
    lanterns[key] = {
      object: lt.group, light, kind,
      get k() { return st.k; },
      setOn(k) { st.target = THREE.MathUtils.clamp(k, 0, 1); },
      _update(dt, t) {
        st.k = ease(st.k, st.target, dt, 3.2);
        const k = st.k;
        const flick = 0.9 + 0.06 * Math.sin(t * 13 + P.z) + 0.04 * Math.sin(t * 23.7 + P.z * 3);
        light.intensity = k * 2.6 * flick;
        lt.glassMat.emissiveIntensity = k * 1.1 * flick;
        lt.glassMat.opacity = 0.32 + k * 0.25;
        lt.flame.visible = k > 0.02;
        lt.flame.scale.set(1, 2.2 * (0.8 + 0.2 * flick), 1).multiplyScalar(0.4 + 0.6 * k);
        lt.flameMat.color.setRGB(1.0 * (1 + k * 4), 0.78 * (1 + k * 4), 0.45 * (1 + k * 4));
        lt.plaqueMat.emissiveIntensity = 0.15 + k * 2.2;
        lt.halo.material.opacity = k * 0.55 * flick;
        water.k = k * flick;
      },
    };
  }

  // ================================================================== pedras de pressão
  const plateH = makePlate(PLATE_H, 'moon', 7);
  const plateL = makePlate(PLATE_L, 'star', 13);
  root.add(plateH.object, plateL.object);

  // ================================================================== fios de luzinhas (pedra → lanterna)
  const yGround = 0.025;
  const wireH = makeFairyWire([
    new THREE.Vector3(PLATE_H.x + PLATE_H.r * 0.95, yGround, PLATE_H.z - 0.05),
    new THREE.Vector3(-4.1, yGround, 2.75), new THREE.Vector3(-3.2, yGround, 2.45),
    new THREE.Vector3(-2.4, yGround, 2.3), new THREE.Vector3(LANTERNS.H.x - 0.07, yGround, LANTERNS.H.z),
    new THREE.Vector3(LANTERNS.H.x - 0.07, 0.6, LANTERNS.H.z), new THREE.Vector3(LANTERNS.H.x - 0.07, postH - 0.02, LANTERNS.H.z),
  ], { color: '#ffa04a', spacing: 0.12 });
  root.add(wireH.group);
  const topY = HEDGE_AB.height + 0.04;
  const wireL = makeFairyWire([
    new THREE.Vector3(PLATE_L.x + 0.27, yGround, PLATE_L.z), new THREE.Vector3(-2.45, yGround, PLATE_L.z + 0.02),
    new THREE.Vector3(HEDGE_AB.x - 0.08, 0.5, -3.95), new THREE.Vector3(HEDGE_AB.x - 0.02, topY, -3.6),
    new THREE.Vector3(HEDGE_AB.x + 0.04, topY + 0.01, -1.5), new THREE.Vector3(HEDGE_AB.x - 0.03, topY, 0.4),
    new THREE.Vector3(HEDGE_AB.x + 0.03, topY + 0.01, 1.6), new THREE.Vector3(HEDGE_AB.x, postH + 0.02, LANTERNS.H.z + 0.05),
    // guirlanda sobre o vão do portão até a lanterna L
    new THREE.Vector3(HEDGE_AB.x, 1.0, (LANTERNS.H.z + LANTERNS.L.z) / 2 - 0.3),
    new THREE.Vector3(HEDGE_AB.x, 0.95, (LANTERNS.H.z + LANTERNS.L.z) / 2),
    new THREE.Vector3(HEDGE_AB.x, 1.0, (LANTERNS.H.z + LANTERNS.L.z) / 2 + 0.3),
    new THREE.Vector3(HEDGE_AB.x, postH + 0.02, LANTERNS.L.z - 0.05),
  ], { color: '#ffd88a', spacing: 0.13 });
  root.add(wireL.group);
  const wires = { H: { wire: wireH, p: 0 }, L: { wire: wireL, p: 0 } };

  // ================================================================== ninho + pantufa
  root.add(makeNest(NEST));
  const sl = makeSlipper();
  const slipperHome = new THREE.Vector3(SLIPPER.x, 0.045, SLIPPER.z);
  const slipperRotY = -0.6;
  sl.group.position.copy(slipperHome);
  sl.group.rotation.set(0, slipperRotY, 0);
  root.add(sl.group);
  const slipperShadow = contactShadow(0.17, 0.09, 0.55);
  slipperShadow.position.set(SLIPPER.x, 0.006, SLIPPER.z);
  slipperShadow.rotation.y = slipperRotY;
  root.add(slipperShadow);
  const slipperHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ff7fb8', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
  slipperHalo.scale.set(0.75, 0.75, 1);
  root.add(slipperHalo);
  const slipperGlowLight = new THREE.PointLight('#ff8cc0', 0.5, 1.6, 1.8);
  root.add(slipperGlowLight);
  const slipperStars = [0, 1, 2].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#ffe0f0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.08);
    root.add(s);
    return { s, ph: i * 2.1 };
  });
  const slipperWater = { pos: new THREE.Vector3(), col: new THREE.Color('#ff7fb8'), k: 0.3 };
  lightsForWater.push(slipperWater);
  let slHL = 0, slHLTarget = 0;
  const slipper = {
    object: sl.group,
    home: slipperHome.clone(),
    setHighlight(on) { slHLTarget = on ? 1 : 0; },
  };

  // ================================================================== ossinhos
  const treats = buildTreats(root, COLLECTIBLES, { glow: 0.18, glowPulse: [0.14, 0.06], shine: [0.22, 0.6], metalness: 0, starTex });

  // ================================================================== porta de vidro (destaque)
  let doorHL = 0, doorHLTarget = 0;
  const door = { setHighlight(on) { doorHLTarget = on ? 1 : 0; } };
  const H = refs.house;
  const doorBase = {
    back: H.interiorMats.back.color.clone(), side: H.interiorMats.side.color.clone(), floor: H.interiorMats.floor.color.clone(),
    spot: refs.doorSpot?.intensity ?? 0, lamp: H.lampShadeMat.emissiveIntensity,
  };

  // ================================================================== update / reset
  const tmpV = new THREE.Vector3();
  function update(dt, t) {
    for (const k of ['H', 'L']) lanterns[k]._update(dt, t);
    const gH = plateH._update(dt, t), gL = plateL._update(dt, t);
    // fio: percorre quando a pedra afunda (ou a lanterna já está acesa)
    for (const [k, g] of /** @type {[string, number][]} */ ([['H', gH], ['L', gL]])) {
      const w = wires[k];
      const target = Math.max(g > 0.5 ? 1 : 0, lanterns[k].k > 0.5 ? 1 : 0);
      w.p = target > w.p ? Math.min(1, w.p + dt * 1.25) : Math.max(0, w.p - dt * 2.0);
      w.wire.set(w.p, 1, t);
    }
    // pantufa
    slHL = ease(slHL, slHLTarget, dt, 4);
    const inScene = sl.group.parent === root;
    const pulse = 0.55 + 0.45 * Math.sin(t * 3.0);
    sl.plush.emissiveIntensity = 0.22 + slHL * 0.35 * pulse;
    sl.group.getWorldPosition(tmpV);
    root.worldToLocal(tmpV);
    slipperHalo.position.copy(tmpV).add(new THREE.Vector3(0, 0.03, 0));
    slipperHalo.material.opacity = (inScene ? 0.28 : 0.12) + slHL * 0.35 * pulse;
    slipperGlowLight.position.copy(tmpV).add(new THREE.Vector3(0, 0.25, 0));
    slipperGlowLight.intensity = (inScene ? 0.6 : 0.25) + slHL * 0.5 * pulse;
    slipperWater.pos.copy(tmpV);
    slipperWater.k = 0.25 + slHL * 0.4;
    slipperShadow.visible = inScene;
    if (inScene) { slipperShadow.position.x = sl.group.position.x; slipperShadow.position.z = sl.group.position.z; }
    slipperStars.forEach((cs, i) => {
      const cyc = ((t * 0.8 + cs.ph) % 2.4) / 2.4;
      const f = Math.sin(cyc * Math.PI) * Math.max(slHL, inScene ? 0.45 : 0);
      cs.s.material.opacity = f * 0.9;
      const a = t * 0.6 + i * 2.09;
      cs.s.position.set(tmpV.x + Math.cos(a) * 0.19, tmpV.y + 0.07 + cyc * 0.18, tmpV.z + Math.sin(a) * 0.13);
      cs.s.scale.setScalar(0.05 + f * 0.05);
    });
    treats.update(dt, t);
    // porta: sala mais quente e luz do vão mais forte quando é o objetivo
    doorHL = ease(doorHL, doorHLTarget, dt, 3);
    const dp = doorHL * (0.8 + 0.2 * Math.sin(t * 3));
    H.interiorMats.back.color.copy(doorBase.back).multiplyScalar(1 + dp * 0.45);
    H.interiorMats.side.color.copy(doorBase.side).multiplyScalar(1 + dp * 0.45);
    H.interiorMats.floor.color.copy(doorBase.floor).multiplyScalar(1 + dp * 0.45);
    H.lampShadeMat.emissiveIntensity = doorBase.lamp * (1 + dp * 0.8);
    H.glowFrame.emissiveIntensity = dp * 1.6;
    if (refs.doorSpot) refs.doorSpot.intensity = doorBase.spot * (1 + dp * 0.9);
  }
  function reset() {
    gate.setOpen(0);
    plateH.setPress(0); plateL.setPress(0);
    lanterns.H.setOn(0); lanterns.L.setOn(0);
    if (sl.group.parent !== root) root.add(sl.group);
    sl.group.position.copy(slipperHome);
    sl.group.rotation.set(0, slipperRotY, 0);
    sl.group.scale.setScalar(1);
    slipper.setHighlight(false);
    for (const c of treats.list) c.reset();
    door.setHighlight(false);
  }

  /** @satisfies {import('../../../types').Fase3Props} */
  const props = {
    gate,
    plateH: { object: plateH.object, setPress: (t) => plateH.setPress(t) },
    plateL: { object: plateL.object, setPress: (t) => plateL.setPress(t) },
    lanternH: { object: lanterns.H.object, setOn: (k) => lanterns.H.setOn(k) },
    lanternL: { object: lanterns.L.object, setOn: (k) => lanterns.L.setOn(k) },
    slipper,
    item: slipper, // alias para o puzzle provisório
    door,
    collectibles: treats.list,
    update, reset,
  };
  return { root, props, lightsForWater, lanterns };
}
