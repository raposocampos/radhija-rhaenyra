// Visual dos objetos interativos (a Mecânica controla o estado). API exata em docs/CONTRATO.md → props.js.
import * as THREE from 'three';
import { woodMat, stdMat, ironMat, brassMat, terracottaMat, rbox, canvasTexture, contactShadow, radialTexture, potProfile, soilDisc, rng, paint } from './util.js';
import { picketGeometry } from './fence.js';
import { plantMat, smallFlowers, succulent } from './plants.js';

// ------------------------------------------------------------------ texturas
function braidTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const cols = ['#e5332a', '#e5332a', '#f6ecd8', '#2d62c9', '#2d62c9', '#f6ecd8'];
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const s = (u * 2 + v * 1) % 1 * 6;
      const k = Math.floor(s);
      const f = s - k;
      const c = new THREE.Color(cols[k]);
      const shade = 0.62 + 0.38 * Math.sin(f * Math.PI); // fios arredondados
      const i = (y * w + x) * 4;
      img.data[i] = c.r * 255 * shade; img.data[i + 1] = c.g * 255 * shade; img.data[i + 2] = c.b * 255 * shade; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}
function ballTexture() {
  return canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = '#2f5fb8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8322b';
    for (let i = 0; i < 4; i++) { g.save(); g.translate(i * 32 + 8, 0); g.transform(1, 0, 0.5, 1, 0, 0); g.fillRect(0, 0, 14, h); g.restore(); }
    g.fillStyle = '#f3e7d3'; g.fillRect(0, h * 0.46, w, h * 0.08);
  });
}
function starTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,240,200,0.7)'); grd.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,250,235,0.95)';
    g.beginPath(); g.moveTo(32, 2); g.lineTo(35, 29); g.lineTo(62, 32); g.lineTo(35, 35); g.lineTo(32, 62); g.lineTo(29, 35); g.lineTo(2, 32); g.lineTo(29, 29); g.closePath(); g.fill();
  }, { srgb: false, repeat: false });
}

// ------------------------------------------------------------------ tubo atualizável (corda)
function makeDynamicTube(nPts, radial) {
  const g = new THREE.BufferGeometry();
  const vCount = nPts * (radial + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
  const uv = new Float32Array(vCount * 2);
  const idx = [];
  for (let i = 0; i < nPts; i++) for (let j = 0; j <= radial; j++) {
    const k = i * (radial + 1) + j;
    uv[k * 2] = j / radial; uv[k * 2 + 1] = i / (nPts - 1);
    if (i < nPts - 1 && j < radial) {
      const a = k, b = k + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), Bv = new THREE.Vector3(), prevT = new THREE.Vector3(), tmp = new THREE.Vector3();
  function update(points, radiusFn) {
    const pos = g.attributes.position.array, nor = g.attributes.normal.array;
    for (let i = 0; i < nPts; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(nPts - 1, i + 1)];
      T.subVectors(b, a).normalize();
      if (i === 0) {
        N.set(1, 0, 0);
        if (Math.abs(T.dot(N)) > 0.9) N.set(0, 0, 1);
        N.sub(tmp.copy(T).multiplyScalar(N.dot(T))).normalize();
      } else {
        // transporte paralelo
        const axis = tmp.crossVectors(prevT, T);
        const len = axis.length();
        if (len > 1e-5) N.applyAxisAngle(axis.divideScalar(len), Math.asin(Math.min(1, len)));
        N.sub(tmp.copy(T).multiplyScalar(N.dot(T))).normalize();
      }
      Bv.crossVectors(T, N);
      prevT.copy(T);
      const r = radiusFn(i / (nPts - 1));
      for (let j = 0; j <= radial; j++) {
        const ang = (j / radial) * Math.PI * 2;
        const cx = Math.cos(ang), sy = Math.sin(ang);
        const nx = N.x * cx + Bv.x * sy, ny = N.y * cx + Bv.y * sy, nz = N.z * cx + Bv.z * sy;
        const k = (i * (radial + 1) + j) * 3;
        pos[k] = points[i].x + nx * r; pos[k + 1] = points[i].y + ny * r; pos[k + 2] = points[i].z + nz * r;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
  }
  return { geometry: g, update };
}

export function createProps(engine, layout) {
  const { scene } = engine;
  const { FENCE, ROPE, CART, CARROT, COLLECTIBLES } = layout;
  let time = 0;

  // ================================================================== PORTÃO
  const gatePivot = new THREE.Group();
  gatePivot.name = 'portao';
  gatePivot.position.set(FENCE.gate.hinge.x, 0, FENCE.gate.hinge.z);
  const gL = FENCE.gate.length;
  const pMat = woodMat('#8fb096', { key: 'gate-picket', rough: 0.62 });
  const railMat = woodMat('#7c9f86', { key: 'gate-rail', rough: 0.65 });
  const pg = picketGeometry(0.085, 0.86);
  const nP = 9;
  for (let i = 0; i < nP; i++) {
    const z = -0.08 - (i / (nP - 1)) * (gL - 0.16);
    const pk = new THREE.Mesh(pg, pMat);
    pk.position.set(-0.012, 0.05, z);
    pk.rotation.set(0, Math.PI / 2, (i % 2 ? 1 : -1) * 0.008);
    // topo em arco suave: ripas do meio um pouco mais altas
    pk.scale.y = 1 + Math.sin((i / (nP - 1)) * Math.PI) * 0.06;
    gatePivot.add(pk);
  }
  for (const y of [0.22, 0.68]) {
    const rail = new THREE.Mesh(rbox(0.035, 0.08, gL - 0.06, 0.012), railMat);
    rail.position.set(0.022, y, -gL / 2);
    gatePivot.add(rail);
  }
  {
    // travessa diagonal (dobradiça embaixo → trinco em cima)
    const a = new THREE.Vector3(0.024, 0.24, -0.1), b = new THREE.Vector3(0.024, 0.66, -gL + 0.1);
    const len = a.distanceTo(b);
    const brace = new THREE.Mesh(rbox(0.035, 0.07, len, 0.012), railMat);
    brace.position.copy(a).add(b).multiplyScalar(0.5);
    brace.rotation.x = Math.atan2(b.y - a.y, -(b.z - a.z));
    gatePivot.add(brace);
  }
  // dobradiças de ferro (face leste)
  for (const y of [0.22, 0.68]) {
    const strap = new THREE.Mesh(rbox(0.01, 0.05, 0.34, 0.005), ironMat());
    strap.position.set(0.045, y, -0.15);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 8), ironMat());
    barrel.position.set(0.045, y, 0.0);
    gatePivot.add(strap, barrel);
  }
  // trinco (alavanca de ferro na ponta da folha; levanta quando a corda é puxada)
  const latch = new THREE.Group();
  latch.position.set(0.05, 0.8, -gL + 0.12);
  const latchBar = new THREE.Mesh(rbox(0.012, 0.03, 0.24, 0.006), ironMat());
  latchBar.position.z = -0.1;
  const latchPin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8).rotateZ(Math.PI / 2), ironMat());
  const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), brassMat());
  thumb.position.set(0.01, 0.0, -0.2);
  latch.add(latchBar, latchPin, thumb);
  gatePivot.add(latch);
  gatePivot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(gatePivot);
  // gancho (keeper) no poste do trinco
  const keeper = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI), ironMat());
  keeper.position.set(FENCE.x + 0.065, 0.79, FENCE.gate.latchPost.z - 0.07);
  keeper.rotation.set(0, Math.PI / 2, Math.PI);
  scene.add(keeper);

  const gate = {
    object: gatePivot,
    t: 0,
    setOpen(t) {
      this.t = THREE.MathUtils.clamp(t, 0, 1);
      gatePivot.rotation.y = FENCE.gate.openYaw * this.t;
    },
  };

  // ================================================================== CORDINHA (brinquedo de corda trançada)
  const ropeRoot = new THREE.Group();
  ropeRoot.name = 'cordinha';
  scene.add(ropeRoot);
  const A = new THREE.Vector3(ROPE.anchor.x, ROPE.anchor.y, ROPE.anchor.z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 16), brassMat());
  ring.position.copy(A).add(new THREE.Vector3(-0.012, 0.0, 0));
  ring.rotation.y = Math.PI / 2;
  ropeRoot.add(ring);
  const braid = braidTexture();
  braid.repeat.set(1, 5);
  const ropeMat = new THREE.MeshStandardMaterial({ map: braid, roughness: 0.85, bumpMap: braid, bumpScale: 2 });
  const NP = 26;
  const tube = makeDynamicTube(NP, 10);
  const ropeMesh = new THREE.Mesh(tube.geometry, ropeMat);
  ropeMesh.castShadow = true;
  ropeMesh.frustumCulled = false;
  ropeRoot.add(ropeMesh);
  const knotGeo = new THREE.SphereGeometry(1, 14, 10);
  const knots = [0.08, 0.55].map((s) => {
    const k = new THREE.Mesh(knotGeo, ropeMat);
    k.scale.set(0.045, 0.038, 0.045);
    k.castShadow = true;
    ropeRoot.add(k);
    return { s, mesh: k };
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.072, 20, 14), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.6 }));
  ball.castShadow = true;
  ropeRoot.add(ball);
  // franjas na ponta
  const tassel = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.006, 0.09, 5), stdMat(i % 2 ? '#d8322b' : '#2f5fb8', { roughness: 0.9 }));
    const a = (i / 6) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.012, -0.035, Math.sin(a) * 0.012);
    f.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    tassel.add(f);
  }
  ropeRoot.add(tassel);
  const ropePts = Array.from({ length: NP }, () => new THREE.Vector3());
  const ropeLen = 0.47;
  const rope = {
    object: ropeRoot,
    t: 0,
    setTug(t) { this.t = THREE.MathUtils.clamp(t, 0, 1); },
  };
  const _end = new THREE.Vector3(), _mid = new THREE.Vector3();
  function updateRope(t) {
    const k = rope.t;
    const swayX = Math.sin(t * 1.3) * 0.025 * (1 - k), swayZ = Math.sin(t * 0.9 + 1) * 0.018 * (1 - k);
    // ponta: pendurada (repouso) → puxada para baixo e para fora (leste/sul, onde a dog fica)
    _end.set(A.x + 0.03 + swayX + k * 0.3, A.y - ropeLen - k * 0.06, A.z + swayZ - k * 0.05);
    _mid.copy(A).lerp(_end, 0.5);
    _mid.x += 0.035 * (1 - k); // barriguinha da corda solta
    for (let i = 0; i < NP; i++) {
      const s = i / (NP - 1);
      // bezier quadrática A → mid → end
      const a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s;
      ropePts[i].set(
        a * A.x + b * _mid.x + c * _end.x,
        a * A.y + b * _mid.y + c * _end.y,
        a * A.z + b * _mid.z + c * _end.z,
      );
    }
    tube.update(ropePts, (s) => 0.026 * (1 - k * 0.12) * (1 + 0.1 * Math.sin(s * 70)));
    for (const kn of knots) {
      const i = Math.round(kn.s * (NP - 1));
      kn.mesh.position.copy(ropePts[i]);
    }
    ball.position.copy(_end).add(new THREE.Vector3(0, -0.05, 0));
    ball.rotation.set(k * 0.6, t * 0.1, swayX * 3);
    tassel.position.copy(ball.position).add(new THREE.Vector3(0, -0.06, 0));
    tassel.rotation.z = swayX * 4 + k * 0.5;
    // o trinco do portão levanta junto
    latch.rotation.x = -0.5 * k;
  }
  updateRope(0);

  // ================================================================== CARRINHO (vagão vermelho-tijolo)
  const cartRoot = new THREE.Group();
  cartRoot.name = 'carrinho';
  cartRoot.position.set(CART.start.x, 0, CART.start.z);
  const hx = CART.halfSize.x, hz = CART.halfSize.z;
  const red = woodMat('#b5432f', { key: 'cart-red', rough: 0.62 });
  const redDark = woodMat('#8e3424', { key: 'cart-red-dark', vertical: true, rough: 0.7 });
  const bedW = hx * 2 - 0.13, bedD = hz * 2 - 0.12, bedY = 0.17;
  const floor = new THREE.Mesh(rbox(bedW, 0.03, bedD, 0.01), redDark);
  floor.position.y = bedY;
  cartRoot.add(floor);
  for (const s of [-1, 1]) {
    for (const y of [0.05, 0.15]) {
      const side = new THREE.Mesh(rbox(bedW + 0.02, 0.08, 0.028, 0.012), red);
      side.position.set(0, bedY + y + 0.015, s * (bedD / 2 + 0.005));
      const end = new THREE.Mesh(rbox(0.028, 0.08, bedD, 0.012), red);
      end.position.set(s * (bedW / 2 + 0.005), bedY + y + 0.015, 0);
      cartRoot.add(side, end);
    }
    // estacas verticais
    for (const x of [-bedW / 2 + 0.02, 0, bedW / 2 - 0.02]) {
      const st = new THREE.Mesh(rbox(0.035, 0.23, 0.035, 0.01), redDark);
      st.position.set(x, bedY + 0.11, s * (bedD / 2 + 0.02));
      cartRoot.add(st);
    }
  }
  // rodas
  const wheelR = 0.11;
  const wheels = [];
  const tire = stdMat('#2a2624', { roughness: 0.85 });
  const hubM = woodMat('#d9b27a', { key: 'cart-hub', rough: 0.7 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(sx * (hx - 0.2), wheelR, sz * (hz - 0.022));
    const t = new THREE.Mesh(new THREE.TorusGeometry(wheelR - 0.018, 0.02, 10, 24), tire);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(wheelR - 0.025, wheelR - 0.025, 0.026, 20).rotateX(Math.PI / 2), hubM);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.04, 12).rotateX(Math.PI / 2), stdMat('#d8322b', { roughness: 0.5 }));
    w.add(t, disc, cap);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(rbox(0.012, wheelR * 1.5, 0.03, 0.004), redDark);
      sp.rotation.z = (i / 4) * Math.PI;
      w.add(sp);
    }
    cartRoot.add(w);
    wheels.push(w);
  }
  for (const sx of [-1, 1]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, hz * 2 - 0.05, 8).rotateX(Math.PI / 2), ironMat());
    axle.position.set(sx * (hx - 0.2), wheelR, 0);
    cartRoot.add(axle);
  }
  // alça levantada (lado leste, à frente do movimento)
  const handle = new THREE.Group();
  handle.position.set(bedW / 2 + 0.02, bedY - 0.02, 0);
  handle.rotation.z = 0.22;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 8), ironMat());
  bar.position.y = 0.25;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 10).rotateX(Math.PI / 2), woodMat('#3b2a20', { key: 'grip' }));
  grip.position.y = 0.5;
  const yoke = new THREE.Mesh(rbox(0.04, 0.04, 0.14, 0.01), ironMat());
  handle.add(bar, grip, yoke);
  cartRoot.add(handle);
  // carga: saco de terra + vasinhos
  {
    const sack = new THREE.Mesh(rbox(0.42, 0.17, 0.34, 0.07, 4), new THREE.MeshStandardMaterial({
      color: '#c9ab78', roughness: 1, map: canvasTexture(128, 128, (g, w, h) => {
        g.fillStyle = '#c9ab78'; g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(120,90,50,0.15)'; g.fillRect(0, y, w, 1); }
        for (let x = 0; x < w; x += 3) { g.fillStyle = 'rgba(120,90,50,0.12)'; g.fillRect(x, 0, 1, h); }
        g.fillStyle = '#5e7a34'; g.beginPath(); g.ellipse(64, 64, 26, 18, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#f0e2c0'; g.beginPath(); g.ellipse(64, 64, 14, 9, 0, 0, Math.PI * 2); g.fill();
      }),
    }));
    const p = sack.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 - 0.25 * (p.getX(i) / 0.21) ** 2));
    sack.geometry.computeVertexNormals();
    sack.position.set(-0.17, bedY + 0.1, 0.0);
    sack.rotation.y = 0.12;
    cartRoot.add(sack);
    const terra = terracottaMat('#cc7a50');
    for (const [x, z, rr] of [[0.2, -0.08, 0.08], [0.27, 0.1, 0.065]]) {
      const potG = new THREE.Group();
      potG.position.set(x, bedY + 0.015, z);
      potG.add(new THREE.Mesh(new THREE.LatheGeometry(potProfile(rr, rr * 1.4), 20), terra));
      const s = new THREE.Mesh(soilDisc(rr * 0.85, 3), stdMat('#4a3424', { roughness: 1 }));
      s.position.y = rr * 1.25;
      potG.add(s);
      const pl = new THREE.Mesh(x > 0.22 ? smallFlowers({ seed: 12, radius: rr, height: 0.09, color: '#ffd04a' }) : succulent({ r: rr * 0.9, seed: 14 }), plantMat());
      pl.position.y = rr * 1.25;
      potG.add(pl);
      cartRoot.add(potG);
    }
  }
  cartRoot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  cartRoot.add(contactShadow(hx + 0.08, hz + 0.08, 0.5));
  scene.add(cartRoot);
  const cart = {
    object: cartRoot,
    setX(x) {
      cartRoot.position.x = x;
      const ang = -(x - CART.start.x) / wheelR;
      for (const w of wheels) w.rotation.z = ang;
    },
    rollWheels() {},
  };

  // ================================================================== CENOURA DE PELÚCIA
  const carrotRoot = new THREE.Group();
  carrotRoot.name = 'cenoura';
  {
    const L = 0.21, R = 0.056;
    const prof = [];
    for (let i = 0; i <= 22; i++) {
      const s = i / 22; // 0 = ponta, 1 = topo
      let r = R * Math.pow(s, 0.62);
      if (s > 0.86) r *= Math.sqrt(Math.max(0, 1 - ((s - 0.86) / 0.14) ** 2)) * 0.55 + 0.45 * (1 - (s - 0.86) / 0.14);
      r *= 1 + 0.05 * Math.sin(s * 38); // gomos costurados
      prof.push(new THREE.Vector2(Math.max(0.002, r), s * L));
    }
    prof.push(new THREE.Vector2(0.0001, L + 0.002));
    const bodyGeo = new THREE.LatheGeometry(prof, 24);
    bodyGeo.rotateZ(-Math.PI / 2); // eixo Y → +X (topo no +X)
    bodyGeo.translate(-0.15, 0, 0);
    const orange = new THREE.MeshPhysicalMaterial({
      color: '#ff6f12', roughness: 0.7, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ffc58a'),
      emissive: '#ff5a00', emissiveIntensity: 0,
    });
    const body = new THREE.Mesh(bodyGeo, orange);
    carrotRoot.add(body);
    // costuras (anéis escuros sutis)
    const stitchMat = stdMat('#c4500c', { roughness: 0.9 });
    for (const s of [0.35, 0.6, 0.8]) {
      const rr = R * Math.pow(s, 0.62) * 1.02;
      const st = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0035, 5, 20), stitchMat);
      st.rotation.y = Math.PI / 2;
      st.position.x = -0.15 + s * L;
      carrotRoot.add(st);
    }
    // folhas de feltro
    const felt = new THREE.MeshPhysicalMaterial({ color: '#46a638', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#a8e07a'), side: THREE.DoubleSide });
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, -0.012);
    leafShape.quadraticCurveTo(0.045, -0.02, 0.085, 0);
    leafShape.quadraticCurveTo(0.045, 0.02, 0, 0.012);
    leafShape.closePath();
    const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
    leafGeo.translate(0, 0, -0.003);
    const topX = -0.15 + L - 0.005;
    for (let i = 0; i < 3; i++) {
      const lf = new THREE.Mesh(leafGeo, felt);
      lf.position.set(topX, 0, 0);
      lf.rotation.set((i - 1) * 1.1 + Math.PI / 2, 0, 0);
      lf.rotateY((i - 1) * 0.45);
      lf.rotateZ(0.25 + (i === 1 ? 0.15 : 0));
      lf.scale.setScalar(i === 1 ? 1.1 : 0.9);
      carrotRoot.add(lf);
    }
    carrotRoot.userData.orange = orange;
  }
  carrotRoot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const carrotHome = new THREE.Vector3(CARROT.x, 0.057, CARROT.z);
  const carrotHomeRotY = 0.35;
  carrotRoot.position.copy(carrotHome);
  carrotRoot.rotation.set(0, carrotHomeRotY, 0);
  scene.add(carrotRoot);
  const carrotShadow = contactShadow(0.16, 0.08, 0.5);
  carrotShadow.position.set(CARROT.x, 0.006, CARROT.z);
  carrotShadow.rotation.y = carrotHomeRotY;
  scene.add(carrotShadow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffb35a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(0.7, 0.7, 1);
  scene.add(halo);
  const starTex = starTexture();
  const carrotStars = [0, 1, 2].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#fff2c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.08);
    scene.add(s);
    return { s, ph: i * 2.1 };
  });
  let carrotHL = 0, carrotHLTarget = 0;
  const carrot = {
    object: carrotRoot,
    home: carrotHome.clone(),
    setHighlight(on) { carrotHLTarget = on ? 1 : 0; },
  };

  // ================================================================== OSSINHOS (colecionáveis)
  const boneMat = new THREE.MeshStandardMaterial({ color: '#dba04f', roughness: 0.55, emissive: '#ffb347', emissiveIntensity: 0 });
  const boneGeo = (() => {
    const parts = [];
    const shaft = new THREE.CapsuleGeometry(0.021, 0.1, 4, 10).rotateZ(Math.PI / 2);
    parts.push(shaft);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const s = new THREE.SphereGeometry(0.03, 12, 10);
      s.translate(sx * 0.068, 0, sz * 0.022);
      parts.push(s);
    }
    const merged = mergeBones(parts);
    merged.scale(1, 0.62, 1);
    return merged;
  })();
  const collectibles = COLLECTIBLES.map((c, i) => {
    const root = new THREE.Group();
    root.name = `osso-${c.id}`;
    const r = rng(i + 3);
    const mesh = new THREE.Mesh(boneGeo, i === 0 ? boneMat : boneMat.clone());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    const baseRot = r() * Math.PI;
    root.position.set(c.x, 0.021, c.z);
    root.rotation.set(0, baseRot, 0.06);
    scene.add(root);
    const sh = contactShadow(0.11, 0.06, 0.45);
    sh.position.set(c.x, 0.006, c.z);
    sh.rotation.y = baseRot;
    scene.add(sh);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#fff1c2', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    star.scale.setScalar(0.12);
    star.position.set(c.x + 0.03, 0.07, c.z);
    scene.add(star);
    const st = { anim: -1, collected: false, phase: r() * 10 };
    return {
      id: c.id,
      object: root,
      collect() {
        if (st.collected) return;
        st.collected = true; st.anim = 0;
      },
      reset() {
        st.collected = false; st.anim = -1;
        root.visible = true; sh.visible = true;
        root.position.set(c.x, 0.021, c.z);
        root.rotation.set(0, baseRot, 0.06);
        root.scale.setScalar(1);
        sh.scale.set(0.22, 1, 0.12);
        sh.material.opacity = 0.45;
      },
      _update(dt, t) {
        if (st.anim >= 0) {
          st.anim += dt;
          const k = Math.min(1, st.anim / 0.55);
          root.position.y = 0.021 + Math.sin(k * Math.PI) * 0.28;
          root.rotation.y = baseRot + k * Math.PI * 3;
          const s = k < 0.35 ? 1 + k * 0.6 : Math.max(0, 1.21 * (1 - (k - 0.35) / 0.65));
          root.scale.setScalar(s);
          sh.material.opacity = 0.45 * (1 - k);
          star.material.opacity = Math.sin(k * Math.PI) * 0.9;
          star.position.set(root.position.x, root.position.y + 0.05, root.position.z);
          if (k >= 1) { root.visible = false; sh.visible = false; st.anim = -1; star.material.opacity = 0; }
          return;
        }
        if (st.collected) return;
        // brilho ocasional discreto (a cada ~4 s)
        const cyc = ((t + st.phase) % 4.2) / 4.2;
        const f = cyc < 0.12 ? Math.sin((cyc / 0.12) * Math.PI) : 0;
        star.material.opacity = f * 0.85;
        star.material.rotation = t * 0.8;
        star.scale.setScalar(0.07 + f * 0.07);
        mesh.material.emissiveIntensity = 0.08 + f * 0.5;
        root.position.y = 0.021 + Math.max(0, Math.sin(t * 2 + st.phase)) * 0.004;
      },
      _shadow: sh,
    };
  });
  for (const c of collectibles) c.reset();

  // ================================================================== PORTA
  let doorHL = 0, doorHLTarget = 0;
  const door = {
    setHighlight(on) { doorHLTarget = on ? 1 : 0; },
  };
  function updateDoor(dt, t) {
    doorHL += (doorHLTarget - doorHL) * Math.min(1, dt * 3);
    const ls = engine.userData && engine.userData.lampState;
    if (!ls) return;
    const pulse = doorHL * (0.85 + 0.15 * Math.sin(t * 3));
    ls.light.intensity = ls.baseLight * (1 + 1.8 * pulse);
    ls.glowMat.emissiveIntensity = ls.baseEmissive * (1 + 0.9 * pulse);
    ls.doorMat.emissive.setRGB(0.55, 0.32, 0.12);
    ls.doorMat.emissiveIntensity = 0.12 * pulse;
  }

  // ================================================================== update / reset
  function update(dt, t) {
    time = t;
    updateRope(t);
    // cenoura: brilho quando liberada
    carrotHL += (carrotHLTarget - carrotHL) * Math.min(1, dt * 4);
    const inScene = carrotRoot.parent === scene;
    const pulse = carrotHL * (0.6 + 0.4 * Math.sin(t * 3.2));
    carrotRoot.userData.orange.emissiveIntensity = 0.32 * pulse;
    halo.visible = carrotHL > 0.01 && inScene;
    halo.position.copy(carrotRoot.position).add(new THREE.Vector3(0, 0.05, 0));
    halo.material.opacity = 0.6 * pulse;
    carrotShadow.visible = inScene;
    if (inScene) { carrotShadow.position.x = carrotRoot.position.x; carrotShadow.position.z = carrotRoot.position.z; }
    carrotStars.forEach((cs, i) => {
      const cyc = ((t * 0.8 + cs.ph) % 2.4) / 2.4;
      const f = Math.sin(cyc * Math.PI) * carrotHL * (inScene ? 1 : 0);
      cs.s.material.opacity = f * 0.9;
      const a = t * 0.6 + i * 2.09;
      cs.s.position.set(carrotRoot.position.x + Math.cos(a) * 0.17, carrotRoot.position.y + 0.06 + cyc * 0.16, carrotRoot.position.z + Math.sin(a) * 0.12);
      cs.s.scale.setScalar(0.05 + f * 0.05);
    });
    for (const c of collectibles) c._update(dt, t);
    updateDoor(dt, t);
  }

  function reset() {
    gate.setOpen(0);
    rope.setTug(0);
    cart.setX(CART.start.x);
    if (carrotRoot.parent !== scene) scene.add(carrotRoot);
    carrotRoot.position.copy(carrotHome);
    carrotRoot.rotation.set(0, carrotHomeRotY, 0);
    carrotRoot.scale.setScalar(1);
    carrot.setHighlight(false);
    for (const c of collectibles) c.reset();
    door.setHighlight(false);
  }

  return { gate, rope, cart, carrot, collectibles, door, update, reset };
}

function mergeBones(parts) {
  // funde geometrias simples (mesmos atributos)
  const geos = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
