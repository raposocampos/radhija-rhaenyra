// FASE 7 · Chão da pracinha depois da chuva: gramado com manchas molhadas (mapa de cor procedural), tufos de
// grama com vento, piso emborrachado do parquinho em placas coloridas e brilhosas de chuva, calçada de pedra
// portuguesa em ondas do piquenique até o portão, e poças d'água que refletem o céu.
// Medidas do layout (FENCE, PUDDLES, PICNIC, GATE); nada de assets: texturas em canvas.
import * as THREE from 'three';
import { rng, fbm2, vnoise2, smoothstep, canvasTexture, mergeGeometries, paint, rippleNormalTexture, mat, addFoliageWind } from '../../../world/util.js';

const R = { x0: -15, x1: 15, z0: -12, z1: 11 };
const MW = 360, MH = 276;

/** Linha central da calçada (do piquenique ao portão e para o leste), em pontos [x, z]. */
export const WALK = [[-3.35, 2.45], [-2.4, 2.62], [-1.0, 2.66], [0.6, 2.6], [1.9, 2.5], [3.2, 2.6], [4.6, 2.75], [6.6, 2.8]];
export const WALK_WIDTH = 0.92;

/** Distância de (x, z) até a calçada (polilinha). */
function walkDist(x, z) {
  let best = Infinity;
  for (let i = 0; i < WALK.length - 1; i++) {
    const [ax, az] = WALK[i], [bx, bz] = WALK[i + 1];
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    best = Math.min(best, Math.hypot(x - (ax + vx * t), z - (az + vz * t)));
  }
  return best;
}
const puddleField = (layout, x, z) => {
  let m = 0;
  for (const p of layout.PUDDLES) {
    const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
    const dx = x - p.x, dz = z - p.z;
    const u = (cs * dx + sn * dz) / (p.rx * 1.6), v = (-sn * dx + cs * dz) / (p.rz * 1.8);
    m = Math.max(m, 1 - Math.min(1, Math.sqrt(u * u + v * v)));
  }
  return m;
};

/** Gramado: mapa de cor com variação, manchas encharcadas e terra perto das árvores e do morrinho. */
function lawnTexture(layout) {
  const cA = new THREE.Color('#4f7a32'), cB = new THREE.Color('#6f9a3e'), cC = new THREE.Color('#8fae4c');
  const cWet = new THREE.Color('#355a26'), cSoil = new THREE.Color('#5a4630');
  const col = new THREE.Color();
  return canvasTexture(MW, MH, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let j = 0; j < h; j++) {
      const z = R.z0 + ((j + 0.5) / h) * (R.z1 - R.z0);
      for (let i = 0; i < w; i++) {
        const x = R.x0 + ((i + 0.5) / w) * (R.x1 - R.x0);
        const n = fbm2(x * 0.45, z * 0.45, 4);
        const fine = vnoise2(x * 3.1, z * 3.1);
        col.copy(cA).lerp(cB, smoothstep(0.3, 0.62, n)).lerp(cC, smoothstep(0.62, 0.8, n) * 0.6);
        col.multiplyScalar(0.9 + fine * 0.2);
        // encharcado: perto das poças e em manchas baixas do terreno
        const wet = Math.max(puddleField(layout, x, z), smoothstep(0.58, 0.72, fbm2(x * 0.3 + 7, z * 0.3 - 3, 3)) * 0.6);
        col.lerp(cWet, wet * 0.7);
        // terra batida: em volta das árvores e no pé do morrinho; grama gasta na borda da calçada
        let soil = 0;
        for (const t of layout.TREES) soil = Math.max(soil, 1 - smoothstep(0.25, 0.7, Math.hypot(x - t.x, z - t.z)));
        const wd = walkDist(x, z);
        soil = Math.max(soil, (1 - smoothstep(WALK_WIDTH / 2, WALK_WIDTH / 2 + 0.25, wd)) * 0.35 * (0.6 + 0.4 * fine));
        col.lerp(cSoil, soil * 0.75);
        const k = (j * w + i) * 4; // linha 0 do canvas = norte (v = 1 depois do flipY)
        img.data[k] = Math.min(255, col.r * 255);
        img.data[k + 1] = Math.min(255, col.g * 255);
        img.data[k + 2] = Math.min(255, col.b * 255);
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, { repeat: false });
}

/** Piso emborrachado: placas de 0,5 m em cores de parquinho, rejunte e brilho de chuva irregular. */
function rubberTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const cols = ['#b5523f', '#5e8c5a', '#4f7898', '#c9953f', '#b5523f', '#5e8c5a'];
    const r = rng(17);
    const n = 4; // 4 x 4 placas por repetição (2 m)
    const s = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.fillStyle = cols[(i * 2 + j * 3 + ((i * j) % 2)) % cols.length];
      g.fillRect(i * s, j * s, s, s);
      // grânulos de borracha
      for (let k = 0; k < 900; k++) {
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
        g.fillRect(i * s + r() * s, j * s + r() * s, 1.5, 1.5);
      }
    }
    g.strokeStyle = 'rgba(40,30,25,0.55)';
    g.lineWidth = 3;
    for (let k = 0; k <= n; k++) {
      g.beginPath(); g.moveTo(k * s, 0); g.lineTo(k * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, k * s); g.lineTo(w, k * s); g.stroke();
    }
  });
}
/** Rugosidade do piso molhado: manchas lisas (água parada) sobre a borracha fosca. */
function wetRoughTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = fbm2(x / 38, y / 38, 4);
      const rough = 0.35 + 0.55 * smoothstep(0.42, 0.62, v);
      const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = rough * 255;
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { srgb: false });
}

/** Pedra portuguesa: pedrinhas brancas e pretas em ondas (como nos calçadões), rejunte escuro. */
function cobbleTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#5b544c';
    g.fillRect(0, 0, w, h);
    const r = rng(23);
    const cell = 9;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const cx = x + cell / 2, cy = y + cell / 2;
        // ondas ao longo da calçada (U = comprimento): duas faixas pretas sinuosas
        const u = cx / w, v = cy / h;
        const wave = Math.sin(u * Math.PI * 4) * 0.22;
        const band = Math.abs(((v - 0.5 - wave) * 2.6) % 1);
        const dark = band < 0.32;
        const shade = 0.88 + r() * 0.16;
        const base = dark ? [52, 50, 48] : [236, 230, 218];
        g.fillStyle = `rgb(${base[0] * shade},${base[1] * shade},${base[2] * shade})`;
        const jx = (r() - 0.5) * 2, jy = (r() - 0.5) * 2;
        const sw = cell - 1.6 - r() * 1.4, sh = cell - 1.6 - r() * 1.4;
        g.beginPath();
        g.moveTo(x + 1 + jx, y + 1 + jy);
        g.lineTo(x + 1 + sw + jx * 0.5, y + 1.3 + jy);
        g.lineTo(x + 0.8 + sw + jx, y + sh + jy * 0.5);
        g.lineTo(x + 1.3 + jx * 0.5, y + 0.9 + sh + jy);
        g.closePath();
        g.fill();
        if (!dark && r() < 0.35) {
          g.fillStyle = 'rgba(255,255,255,0.35)'; // brilho molhado
          g.fillRect(x + 2 + jx, y + 2 + jy, 2, 1);
        }
      }
    }
  });
}

/** Faixa ao longo da polilinha (UV: u = metros ao longo, v = 0..1 na largura). */
function ribbonGeometry(points, width, y) {
  const pos = [], uv = [], idx = [];
  // reamostra a polilinha suavizada (Catmull-Rom)
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const N = 120;
  let len = 0;
  let prev = curve.getPoint(0);
  for (let i = 0; i <= N; i++) {
    const p = curve.getPoint(i / N);
    len += p.distanceTo(prev);
    prev = p;
    const t = curve.getTangent(i / N);
    const nx = -t.z, nz = t.x;
    const wob = (vnoise2(len * 1.7, 3.1) - 0.5) * 0.06;
    for (const side of [-1, 1]) {
      pos.push(p.x + nx * side * (width / 2 + wob), y, p.z + nz * side * (width / 2 + wob));
      uv.push(len / 2.0, side < 0 ? 0 : 1);
    }
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Meio-fio de concreto dos dois lados da calçada. */
function curbGeometry(points, width) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const parts = [];
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const p = curve.getPoint(i / 80);
      const t = curve.getTangent(i / 80);
      pts.push(new THREE.Vector3(p.x - t.z * side * (width / 2 + 0.035), 0.012, p.z + t.x * side * (width / 2 + 0.035)));
    }
    const path = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(path, 80, 0.032, 5, false);
    g.scale(1, 0.55, 1);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

/** Tufos de grama instanciados (com vento), fora da calçada, do parquinho e das poças. */
function grassTufts(root, layout) {
  const blade = new THREE.ConeGeometry(0.012, 0.11, 3, 1, true).translate(0, 0.055, 0);
  const parts = [];
  for (let k = 0; k < 5; k++) {
    const b = blade.clone();
    b.rotateZ((k - 2) * 0.22);
    b.rotateY(k * 1.3);
    b.translate((k - 2) * 0.012, 0, (k % 2) * 0.01);
    b.scale(1, 0.8 + (k % 3) * 0.18, 1);
    parts.push(b);
  }
  const tuft = paint(mergeGeometries(parts), (p) => new THREE.Color('#4f7a2e').lerp(new THREE.Color('#a9c46a'), Math.min(1, p.y / 0.12)));
  const material = mat('f7-grass', () => addFoliageWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }), { amp: 0.02, freq: 1.8 }));
  const B = layout.WORLD.bounds, F = layout.FENCE;
  const r = rng(41);
  const list = [];
  for (let i = 0; i < 2600 && list.length < 1500; i++) {
    const x = B.minX - 1.5 + r() * (B.maxX - B.minX + 3);
    const z = B.minZ - 1.5 + r() * (B.maxZ - B.minZ + 3);
    const inPark = x > F.west - 0.05 && z < F.south + 0.05 && x < B.maxX + 0.3 && z > B.minZ - 0.3;
    if (inPark || walkDist(x, z) < WALK_WIDTH / 2 + 0.06 || puddleField(layout, x, z) > 0.35) continue;
    const P = layout.PICNIC;
    if (Math.abs(x - P.x) < P.hx + 0.05 && Math.abs(z - P.z) < P.hz + 0.05) continue;
    if (fbm2(x * 0.9, z * 0.9, 2) < 0.38 && r() < 0.6) continue; // grama mais rala em manchas
    list.push({ x, z, s: 0.75 + r() * 0.6, a: r() * Math.PI * 2 });
  }
  const im = new THREE.InstancedMesh(tuft, material, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  list.forEach((t, i) => {
    q.setFromAxisAngle(up, t.a);
    s.set(t.s, t.s, t.s);
    p.set(t.x, 0, t.z);
    m4.compose(p, q, s);
    im.setMatrixAt(i, m4);
  });
  im.receiveShadow = true;
  im.name = 'grama';
  root.add(im);
  return im;
}

/** Poças: água rasa que reflete o céu, com ondinhas e a borda escura de terra molhada. */
function buildPuddles(root, layout) {
  const ripple = rippleNormalTexture().clone();
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.repeat.set(2.5, 2.5);
  const water = new THREE.MeshPhysicalMaterial({
    color: '#6f8796', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.86,
    normalMap: ripple, normalScale: new THREE.Vector2(0.18, 0.18), clearcoat: 1, clearcoatRoughness: 0.05,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  const rim = new THREE.MeshStandardMaterial({ color: '#2d2a1c', transparent: true, opacity: 0.35, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const group = new THREE.Group();
  group.name = 'pocas';
  for (const [i, p] of layout.PUDDLES.entries()) {
    // contorno irregular
    const shape = new THREE.Shape();
    const N = 28;
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const wob = 1 + (vnoise2(Math.cos(a) * 2 + i * 5, Math.sin(a) * 2) - 0.5) * 0.35;
      const x = Math.cos(a) * p.rx * wob, z = Math.sin(a) * p.rz * wob;
      if (k === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
    }
    const geo = new THREE.ShapeGeometry(shape, 2).rotateX(-Math.PI / 2);
    // UV no plano para as ondinhas
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let k = 0; k < pos.count; k++) { uv[k * 2] = pos.getX(k) * 1.4; uv[k * 2 + 1] = pos.getZ(k) * 1.4; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const m = new THREE.Mesh(geo, water);
    m.position.set(p.x, 0.009, p.z);
    m.rotation.y = -p.rot;
    m.receiveShadow = true;
    const ring = new THREE.Mesh(geo.clone().scale(1.22, 1, 1.28), rim);
    ring.position.set(p.x, 0.0075, p.z);
    ring.rotation.y = -p.rot;
    group.add(ring, m);
  }
  root.add(group);
  return {
    group,
    update(t) {
      ripple.offset.set(Math.sin(t * 0.21) * 0.3, t * 0.025);
    },
  };
}

/** @param {THREE.Group} root @param {import('../../../types').LevelLayout} layout */
export function buildGround(root, layout) {
  const group = new THREE.Group();
  group.name = 'chao';
  // gramado
  const lawnMat = new THREE.MeshStandardMaterial({ map: lawnTexture(layout), roughness: 0.92 });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0).rotateX(-Math.PI / 2), lawnMat);
  lawn.position.set((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2);
  lawn.receiveShadow = true;
  lawn.name = 'gramado';
  group.add(lawn);
  // piso emborrachado do parquinho (de cerca a cerca, até depois dos limites norte e leste)
  const F = layout.FENCE, B = layout.WORLD.bounds;
  const px0 = F.west + 0.02, px1 = B.maxX + 0.9, pz0 = B.minZ - 0.9, pz1 = F.south - 0.02;
  const rubberMap = rubberTexture();
  rubberMap.repeat.set((px1 - px0) / 2, (pz1 - pz0) / 2);
  const rough = wetRoughTexture();
  rough.repeat.set((px1 - px0) / 3.1, (pz1 - pz0) / 3.1);
  const rubber = new THREE.Mesh(
    new THREE.PlaneGeometry(px1 - px0, pz1 - pz0).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: rubberMap, roughness: 1, roughnessMap: rough, envMapIntensity: 1.2 }),
  );
  rubber.position.set((px0 + px1) / 2, 0.004, (pz0 + pz1) / 2);
  rubber.receiveShadow = true;
  rubber.name = 'piso-emborrachado';
  group.add(rubber);
  // calçada de pedra portuguesa com meio-fio
  const cob = cobbleTexture();
  cob.wrapS = THREE.RepeatWrapping;
  const walk = new THREE.Mesh(ribbonGeometry(WALK, WALK_WIDTH, 0.006), new THREE.MeshStandardMaterial({ map: cob, roughness: 0.55, envMapIntensity: 1.1 }));
  walk.receiveShadow = true;
  walk.name = 'calcada';
  const curb = new THREE.Mesh(curbGeometry(WALK, WALK_WIDTH), new THREE.MeshStandardMaterial({ color: '#c9c2b4', roughness: 0.8 }));
  curb.receiveShadow = true;
  curb.castShadow = true;
  group.add(walk, curb);
  const tufts = grassTufts(group, layout);
  const puddles = buildPuddles(group, layout);
  root.add(group);
  return {
    group, tufts,
    update(dt, t) {
      puddles.update(t);
    },
  };
}
