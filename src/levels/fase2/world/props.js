// FASE 2 · Props interativos (a Mecânica controla o estado; API em docs/CONTRATO.md §6 "Fase 2").
// Portão de ferro com tambor da corda, tábua de pressão (pallet com molas) + corda + roldana, calço,
// irrigador giratório com jatos legíveis, registro, caixote de feira, bolinha de tênis, caminha e ossinhos.
import * as THREE from 'three';
import {
  shared, rng, rbox, canvasTexture, woodTexture, woodTextureV, radialTexture, contactShadow, mergeGeometries,
  stdMat, woodMat, ironMat, brassMat, vnoise3,
} from '../../../world/util.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t);

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
    if (i < nPts - 1 && j < radial) { const a = k, b = k + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), Bv = new THREE.Vector3(), prevT = new THREE.Vector3(), tmp = new THREE.Vector3();
  function update(points, r) {
    const pos = g.attributes.position.array, nor = g.attributes.normal.array;
    for (let i = 0; i < nPts; i++) {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(nPts - 1, i + 1)];
      T.subVectors(b, a).normalize();
      if (i === 0) {
        N.set(0, 1, 0);
        if (Math.abs(T.dot(N)) > 0.9) N.set(1, 0, 0);
        N.sub(tmp.copy(T).multiplyScalar(N.dot(T))).normalize();
      } else {
        const axis = tmp.crossVectors(prevT, T);
        const len = axis.length();
        if (len > 1e-5) N.applyAxisAngle(axis.divideScalar(len), Math.asin(Math.min(1, len)));
        N.sub(tmp.copy(T).multiplyScalar(N.dot(T))).normalize();
      }
      Bv.crossVectors(T, N);
      prevT.copy(T);
      for (let j = 0; j <= radial; j++) {
        const ang = (j / radial) * TAU, cx = Math.cos(ang), sy = Math.sin(ang);
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
function ropeTexture() {
  return canvasTexture(32, 64, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((x / w) * 2 + (y / h) * 3) % 1;
      const v = 0.6 + 0.4 * Math.sin(s * Math.PI);
      const i = (y * w + x) * 4;
      img.data[i] = 222 * v; img.data[i + 1] = 196 * v; img.data[i + 2] = 150 * v; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
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
/** Mola helicoidal (tubo) de altura 1 (escala Y comprime). */
function springGeometry(r = 0.04, turns = 5, wire = 0.008) {
  const pts = [];
  const N = turns * 16;
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector3(Math.cos(t * turns * TAU) * r, t, Math.sin(t * turns * TAU) * r)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, wire, 6);
}

export function buildProps({ root, layout, engine }) {
  const { GATE, PLANK, WEDGE, SPRINKLER, VALVE, CRATE, CHANNEL, BALL, DOG_BED, COLLECTIBLES } = layout;
  const updaters = [];
  const starTex = starTexture();

  // ================================================================== PORTÃO DE FERRO (+ tambor da corda)
  const gatePivot = new THREE.Group();
  gatePivot.name = 'portao-ferro';
  gatePivot.position.set(GATE.hinge.x, 0, GATE.hinge.z);
  const gL = GATE.length;
  const paint = new THREE.MeshStandardMaterial({ color: '#2e5446', roughness: 0.42, metalness: 0.55, envMapIntensity: 1.1 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a04a', roughness: 0.35, metalness: 0.9 });
  {
    const H = 0.95, y0 = 0.05;
    const bar = (a, b, r = 0.014) => {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), paint);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      gatePivot.add(m);
      return m;
    };
    const zs = -0.03, ze = -gL + 0.03;
    // quadro
    const frame = [[0.04, H, zs], [0.04, H, ze]];
    for (const [w, h, z] of frame) {
      const st = new THREE.Mesh(rbox(0.035, h, 0.035, 0.008), paint);
      st.position.set(0, y0 + h / 2, z);
      gatePivot.add(st);
    }
    for (const y of [y0 + 0.02, y0 + 0.26, y0 + H - 0.2]) {
      const rail = new THREE.Mesh(rbox(0.03, 0.03, gL - 0.06, 0.008), paint);
      rail.position.set(0, y, -gL / 2);
      gatePivot.add(rail);
    }
    // barras verticais com ponteiras de lança douradas (topo em arco)
    const nb = 9;
    for (let i = 1; i < nb; i++) {
      const s = i / nb;
      const z = zs + (ze - zs) * s;
      const top = y0 + H - 0.04 + Math.sin(s * Math.PI) * 0.08;
      bar(new THREE.Vector3(0, y0 + 0.02, z), new THREE.Vector3(0, top, z), 0.009);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 6), gold);
      tip.position.set(0, top + 0.03, z);
      gatePivot.add(tip);
    }
    // arco superior
    const arcPts = [];
    for (let i = 0; i <= 16; i++) { const s = i / 16; arcPts.push(new THREE.Vector3(0, y0 + H - 0.1 + Math.sin(s * Math.PI) * 0.08, zs + (ze - zs) * s)); }
    gatePivot.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 32, 0.011, 6), paint));
    // arabescos (volutas em C e S) entre o trilho do meio e o de cima
    const scroll = (cz, cy, rr, flip, ry = 0) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const ang = t * Math.PI * 1.7;
        const rad = rr * (1 - t * 0.62);
        pts.push(new THREE.Vector3(0, cy + Math.sin(ang) * rad * flip, cz + Math.cos(ang) * rad));
      }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.007, 5), paint);
      m.rotation.x = ry;
      gatePivot.add(m);
    };
    const ym = y0 + 0.26 + (H - 0.2 - 0.26) / 2;
    for (let i = 0; i < 4; i++) {
      const cz = zs + (ze - zs) * ((i + 0.5) / 4);
      scroll(cz - 0.05, ym + 0.08, 0.07, 1);
      scroll(cz + 0.05, ym - 0.08, 0.07, -1);
    }
    // rosácea central dourada
    const ros = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 18), gold);
    ros.rotation.y = Math.PI / 2;
    ros.position.set(0, ym, -gL / 2);
    gatePivot.add(ros);
    // trinco
    const latch = new THREE.Mesh(rbox(0.02, 0.04, 0.1, 0.006), gold);
    latch.position.set(0.03, y0 + 0.55, ze + 0.02);
    gatePivot.add(latch);
    // dobradiças
    for (const y of [0.18, 0.78]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 8), stdMat('#262626', { metalness: 0.6, roughness: 0.5 }));
      barrel.position.set(0, y, 0.0);
      gatePivot.add(barrel);
    }
  }
  // tambor (polia fixa no eixo do portão): a corda enrola aqui e gira a folha
  const drumR = 0.11, drumY = 1.26;
  const drum = new THREE.Group();
  drum.position.set(0, drumY, -0.01);
  {
    const red = new THREE.MeshStandardMaterial({ color: '#c8402c', roughness: 0.45, metalness: 0.3 });
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(drumR, drumR, 0.05, 28), red);
    const flangeA = new THREE.Mesh(new THREE.CylinderGeometry(drumR + 0.02, drumR + 0.02, 0.012, 28), red);
    flangeA.position.y = 0.03;
    const flangeB = flangeA.clone(); flangeB.position.y = -0.03;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.09, 10), gold);
    // marcas brancas (para ler a rotação)
    for (let i = 0; i < 4; i++) {
      const mk = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, drumR * 0.9), stdMat('#f3ead8', { roughness: 0.5 }));
      mk.position.y = 0.037;
      mk.rotation.y = (i / 4) * Math.PI;
      drum.add(mk);
    }
    // voltas de corda enroladas
    const coil = new THREE.Mesh(new THREE.TorusGeometry(drumR + 0.004, 0.012, 6, 28), new THREE.MeshStandardMaterial({ map: ropeTexture(), roughness: 0.9 }));
    coil.rotation.x = Math.PI / 2;
    drum.add(wheel, flangeA, flangeB, hub, coil);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, drumY - 0.95, 6), paint);
    shaft.position.y = -(drumY - 0.95) / 2;
    drum.add(shaft);
  }
  gatePivot.add(drum);
  gatePivot.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(gatePivot);
  const gate = {
    object: gatePivot,
    t: 0,
    setOpen(t) {
      this.t = clamp01(t);
      gatePivot.rotation.y = GATE.openYaw * this.t;
    },
  };

  // ================================================================== TÁBUA DE PRESSÃO (pallet com molas) + CORDA + ROLDANA
  const plankRoot = new THREE.Group();
  plankRoot.name = 'tabua-pressao';
  plankRoot.position.set(PLANK.x, 0, PLANK.z);
  const pw = PLANK.hx * 2, pd = PLANK.hz * 2;
  const deckRest = 0.115, deckDown = 0.05;
  const palletWood = woodMat('#b98d5c', { key: 'f2-pallet', rough: 0.85 });
  const palletDark = woodMat('#8a6440', { key: 'f2-pallet-dark', rough: 0.9 });
  // moldura de base (caixa rasa)
  {
    const fh = 0.045;
    for (const [w, d, x, z] of [[pw + 0.08, 0.05, 0, pd / 2 + 0.015], [pw + 0.08, 0.05, 0, -pd / 2 - 0.015], [0.05, pd, pw / 2 + 0.015, 0], [0.05, pd, -pw / 2 - 0.015, 0]]) {
      const b = new THREE.Mesh(rbox(w, fh, d, 0.01), palletDark);
      b.position.set(x, fh / 2, z);
      plankRoot.add(b);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd).rotateX(-Math.PI / 2), stdMat('#3a2c20', { roughness: 1 }));
    floor.position.y = 0.004;
    plankRoot.add(floor);
  }
  // molas (vermelhas, bem visíveis nos cantos)
  const springMat = new THREE.MeshStandardMaterial({ color: '#d4442e', roughness: 0.35, metalness: 0.6 });
  const sGeo = springGeometry(0.035, 4, 0.0075);
  const springs = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]) {
    const s = new THREE.Mesh(sGeo, springMat);
    s.position.set(sx * (pw / 2 - 0.08), 0.0, sz * (pd / 2 - 0.07));
    plankRoot.add(s);
    springs.push(s);
  }
  // tampo do pallet (sobe e desce)
  const deck = new THREE.Group();
  {
    const nBoards = 5;
    for (let i = 0; i < nBoards; i++) {
      const z = -pd / 2 + 0.06 + (i / (nBoards - 1)) * (pd - 0.12);
      const b = new THREE.Mesh(rbox(pw, 0.022, 0.1, 0.006), palletWood);
      b.position.set(0, -0.011, z);
      b.rotation.y = (i % 2 ? 1 : -1) * 0.006;
      deck.add(b);
    }
    for (const x of [-pw / 2 + 0.05, 0, pw / 2 - 0.05]) {
      const st = new THREE.Mesh(rbox(0.07, 0.03, pd - 0.02, 0.006), palletDark);
      st.position.set(x, -0.036, 0);
      deck.add(st);
    }
    // pregos
    const nailM = stdMat('#5b5b58', { metalness: 0.8, roughness: 0.4 });
    for (let i = 0; i < 5; i++) for (const x of [-pw / 2 + 0.05, 0, pw / 2 - 0.05]) {
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 6), nailM);
      n.position.set(x, 0.001, -pd / 2 + 0.06 + (i / 4) * (pd - 0.12));
      deck.add(n);
    }
    // patinha pintada (dica: "pise aqui")
    const pawTex = canvasTexture(128, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(245,236,214,0.92)';
      const cx = w / 2, cy = h / 2 + 10;
      c.beginPath(); c.ellipse(cx, cy + 8, 26, 21, 0, 0, TAU); c.fill();
      for (const [dx, dy] of [[-30, -20], [-11, -36], [11, -36], [30, -20]]) { c.beginPath(); c.ellipse(cx + dx, cy + dy, 9, 12, dx * 0.02, 0, TAU); c.fill(); }
    }, { repeat: false });
    const paw = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pawTex, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    paw.position.y = 0.002;
    paw.rotation.y = 0.2;
    deck.add(paw);
    // argola onde a corda amarra (borda leste)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 14), ironMat());
    ring.position.set(pw / 2 + 0.01, -0.01, 0.0);
    ring.rotation.y = Math.PI / 2;
    deck.add(ring);
  }
  deck.position.y = deckRest;
  plankRoot.add(deck);
  plankRoot.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(plankRoot);
  root.add(contactShadow(pw / 2 + 0.12, pd / 2 + 0.12, 0.4).translateX(PLANK.x).translateZ(PLANK.z));

  // poste da roldana (madeira) + roldanas
  const PU = PLANK.pulley;
  const post = new THREE.Group();
  post.position.set(PU.x, 0, PU.z);
  {
    const pm = woodMat('#b08a5e', { key: 'f2-post', vertical: true, rough: 0.85 });
    const pole = new THREE.Mesh(rbox(0.11, PU.y + 0.12, 0.11, 0.015), pm);
    pole.position.y = (PU.y + 0.12) / 2;
    const capP = new THREE.Mesh(rbox(0.15, 0.03, 0.15, 0.01), pm);
    capP.position.y = PU.y + 0.135;
    const foot = new THREE.Mesh(rbox(0.18, 0.06, 0.18, 0.01), stdMat('#8f877a', { roughness: 0.9 }));
    foot.position.y = 0.03;
    post.add(pole, capP, foot);
  }
  const pulleyMat = new THREE.MeshStandardMaterial({ color: '#c8402c', roughness: 0.4, metalness: 0.4 });
  const makePulley = (r) => {
    const w = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 22).rotateX(Math.PI / 2), pulleyMat);
    const groove = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 22), stdMat('#7a2a1d', { roughness: 0.6 }));
    const hubp = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 8).rotateX(Math.PI / 2), brassMat());
    w.add(disc, groove, hubp);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, 0.012, 0.036), stdMat('#f3ead8', { roughness: 0.5 }));
      sp.rotation.z = (i / 3) * Math.PI;
      w.add(sp);
    }
    return w;
  };
  const topPulley = makePulley(0.095);
  topPulley.position.set(-0.02, PU.y, 0);
  const bracket = new THREE.Mesh(rbox(0.04, 0.16, 0.06, 0.008), ironMat());
  bracket.position.set(0.0, PU.y + 0.04, 0);
  const lowPulley = makePulley(0.04);
  lowPulley.position.set(-0.07, 0.11, 0);
  post.add(topPulley, bracket, lowPulley);
  post.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(post);
  // a roldana gira no plano da corda que vem da tábua (oeste) — gira o poste para encarar a tábua
  post.rotation.y = Math.atan2(-(PLANK.z - PU.z), PLANK.x - PU.x) + Math.PI;

  // corda: argola da tábua → roldana de baixo → sobe o poste → roldana de cima → tambor do portão
  const ropeMat = new THREE.MeshStandardMaterial({ map: ropeTexture(), roughness: 0.9, color: '#f0e2c4' });
  ropeMat.map.repeat.set(1, 30);
  const NP = 90;
  const ropeTube = makeDynamicTube(NP, 6);
  const ropeMesh = new THREE.Mesh(ropeTube.geometry, ropeMat);
  ropeMesh.castShadow = true;
  ropeMesh.frustumCulled = false;
  root.add(ropeMesh);
  const ropePts = Array.from({ length: NP }, () => new THREE.Vector3());
  const _v = new THREE.Vector3();
  const plankState = { press: 0 };
  const worldOf = (obj, x, y, z) => { obj.updateMatrixWorld(true); return _v.set(x, y, z).applyMatrix4(obj.matrixWorld).clone(); };
  function updateRope(t) {
    const k = plankState.press;
    // pontos-chave (mundo)
    const ring = new THREE.Vector3(PLANK.x + pw / 2 + 0.01, deck.position.y - 0.01, PLANK.z);
    const low = worldOf(post, -0.07, 0.11 - 0.04, 0);
    const lowTop = worldOf(post, -0.07 - 0.04, 0.11, 0);
    const up = worldOf(post, -0.02 - 0.095, PU.y, 0);
    const over = worldOf(post, -0.02, PU.y + 0.095, 0);
    // tangente no tambor (lado leste em relação à direção da corda)
    const hc = new THREE.Vector3(GATE.hinge.x, drumY, GATE.hinge.z);
    const dir = new THREE.Vector3(over.x - hc.x, 0, over.z - hc.z).normalize();
    const tan = new THREE.Vector3(hc.x + dir.z * drumR, drumY, hc.z - dir.x * drumR);
    const segs = /** @type {[THREE.Vector3, THREE.Vector3, number][]} */ ([[ring, low, 0.03 * (1 - k)], [lowTop, up, 0], [over, tan, 0.09 * (1 - k) + 0.006]]);
    const counts = [22, 18, 50];
    let i = 0;
    segs.forEach(([a, b, sag], si) => {
      const n = counts[si];
      for (let j = 0; j < n; j++) {
        const s = j / (n - 1);
        ropePts[i++].set(a.x + (b.x - a.x) * s, a.y + (b.y - a.y) * s - Math.sin(s * Math.PI) * sag, a.z + (b.z - a.z) * s);
      }
    });
    ropeTube.update(ropePts, 0.011);
    // vibração quando tensiona
    topPulley.rotation.z = -k * 4.2;
    lowPulley.rotation.z = k * 6.0;
  }
  const plank = {
    object: plankRoot,
    setPress(t) {
      plankState.press = clamp01(t);
      const k = plankState.press;
      deck.position.y = deckRest + (deckDown - deckRest) * k;
      for (const s of springs) s.scale.y = deck.position.y - 0.035;
    },
  };
  plank.setPress(0);

  // ================================================================== CALÇO (cunha de madeira com faixa amarela)
  const wedgeRoot = new THREE.Group();
  wedgeRoot.name = 'calco';
  {
    const shape = new THREE.Shape();
    const L = 0.3, Hh = 0.1;
    shape.moveTo(-L / 2, 0); shape.lineTo(L / 2, 0); shape.lineTo(L / 2, Hh * 0.35); shape.lineTo(-L / 2 + 0.03, Hh); shape.lineTo(-L / 2, Hh); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
    geo.translate(0, 0, -0.07);
    const uv = geo.attributes.uv, p = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 2 + 0.5, p.getY(i) * 3 + p.getZ(i) * 2);
    const m = new THREE.Mesh(geo, woodMat('#c79a62', { key: 'f2-wedge', rough: 0.75 }));
    // a ponta fina aponta para +X local
    wedgeRoot.add(m);
    const band = new THREE.Mesh(rbox(0.045, 0.09, 0.162, 0.008), stdMat('#f2c230', { roughness: 0.55 }));
    band.position.set(-0.07, 0.045, 0);
    wedgeRoot.add(band);
    const knob = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12), ironMat());
    knob.position.set(-0.165, 0.06, 0);
    knob.rotation.y = Math.PI / 2;
    wedgeRoot.add(knob);
  }
  wedgeRoot.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const wedgeShadow = contactShadow(0.2, 0.12, 0.45);
  root.add(wedgeRoot, wedgeShadow);
  const wA = new THREE.Vector2(WEDGE.x, WEDGE.z), wB = new THREE.Vector2(WEDGE.lockedAt.x, WEDGE.lockedAt.z);
  // na posição inicial aponta para o portão; travado, encaixa sob a ponta da folha aberta
  const tipOpen = new THREE.Vector2(GATE.hinge.x + Math.sin(-GATE.openYaw) * gL, GATE.hinge.z - Math.cos(-GATE.openYaw) * gL);
  const yawA = Math.atan2(-(tipOpen.y - wA.y), tipOpen.x - wA.x);
  const yawB = Math.atan2(-(tipOpen.y - wB.y), tipOpen.x - wB.x);
  const wedgeState = { t: 0, bump: -1 };
  function placeWedge() {
    const k = ease(wedgeState.t);
    const x = wA.x + (wB.x - wA.x) * k, z = wA.y + (wB.y - wA.y) * k;
    let y = 0, roll = 0, yawJ = 0;
    if (wedgeState.bump >= 0) {
      const b = wedgeState.bump;
      y = Math.max(0, Math.sin(b * Math.PI * 2.2)) * 0.06 * Math.exp(-b * 2.5);
      roll = Math.sin(b * 18) * 0.15 * Math.exp(-b * 4);
      yawJ = Math.sin(b * 11) * 0.1 * Math.exp(-b * 3);
    }
    // escorrega girando um pouco durante o empurrão
    const spin = Math.sin(k * Math.PI) * 0.6;
    wedgeRoot.position.set(x, y, z);
    wedgeRoot.rotation.set(roll, yawA + (yawB - yawA) * k + spin + yawJ, 0);
    wedgeShadow.position.set(x, 0.006, z);
    wedgeShadow.rotation.y = wedgeRoot.rotation.y;
  }
  const wedge = {
    object: wedgeRoot,
    setState(t) { wedgeState.t = clamp01(t); placeWedge(); },
    bump() { wedgeState.bump = 0; },
  };
  updaters.push((dt) => {
    if (wedgeState.bump >= 0) { wedgeState.bump += dt; if (wedgeState.bump > 1.2) wedgeState.bump = -1; placeWedge(); }
  });
  wedge.setState(0);

  // ================================================================== IRRIGADOR GIRATÓRIO
  const spr = buildSprinkler(root, SPRINKLER);

  // ================================================================== REGISTRO (válvula com roda vermelha) + mangueira até o irrigador
  const valveRoot = new THREE.Group();
  valveRoot.name = 'registro';
  valveRoot.position.set(VALVE.x, 0, VALVE.z);
  const wheel = new THREE.Group();
  {
    const pipeM = stdMat('#9aa0a2', { roughness: 0.35, metalness: 0.8 });
    const brass = brassMat();
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, VALVE.y + 0.1, 10), pipeM);
    riser.position.set(0, (VALVE.y + 0.1) / 2, -0.06);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), pipeM);
    elbow.position.set(0, VALVE.y + 0.1, -0.06);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12), brass);
    body.position.set(0, VALVE.y, -0.04);
    const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.08, 10).rotateX(Math.PI / 2), brass);
    bonnet.position.set(0, VALVE.y, 0.03);
    const base = new THREE.Mesh(rbox(0.2, 0.06, 0.16, 0.01), stdMat('#8f877a', { roughness: 0.9 }));
    base.position.set(0, 0.03, -0.05);
    // saída inferior (onde a mangueira encaixa)
    const out = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8).rotateX(Math.PI / 2), brass);
    out.position.set(0, 0.12, 0.02);
    const outV = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, VALVE.y - 0.12, 8), pipeM);
    outV.position.set(0, (VALVE.y + 0.12) / 2, -0.04);
    valveRoot.add(riser, elbow, body, bonnet, base, out, outV);
    // roda (plano XY, eixo Z → encara o sul)
    const red = new THREE.MeshStandardMaterial({ color: '#d63a28', roughness: 0.38, metalness: 0.25, emissive: '#3a0800', emissiveIntensity: 0.4 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.016, 8, 26), red);
    wheel.add(rim);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 6), red);
      sp.position.set(Math.cos((i / 5) * TAU) * 0.05, Math.sin((i / 5) * TAU) * 0.05, 0);
      sp.rotation.z = (i / 5) * TAU - Math.PI / 2;
      wheel.add(sp);
    }
    const hubw = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12).rotateX(Math.PI / 2), red);
    wheel.add(hubw);
    // pegador
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6).rotateX(Math.PI / 2), stdMat('#f3ead8', { roughness: 0.5 }));
    grip.position.set(0.1, 0, 0.025);
    wheel.add(grip);
    wheel.position.set(0, VALVE.y, 0.08);
    valveRoot.add(wheel);
    // plaquinha com gota d'água
    const plateTex = canvasTexture(64, 64, (c, w, h) => {
      c.fillStyle = '#2f6fb8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(32, 10); c.bezierCurveTo(46, 30, 50, 40, 32, 54); c.bezierCurveTo(14, 40, 18, 30, 32, 10); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, h - 6);
    }, { repeat: false });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.4, metalness: 0.2 }));
    plate.position.set(0, VALVE.y + 0.32, -0.115);
    valveRoot.add(plate);
  }
  valveRoot.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(valveRoot);
  {
    // mangueira verde serpenteando pelo gramado até o irrigador
    const a = new THREE.Vector3(VALVE.x, 0.12, VALVE.z + 0.09);
    const pts = [a, new THREE.Vector3(VALVE.x, 0.03, VALVE.z + 0.35), new THREE.Vector3(VALVE.x - 0.3, 0.02, VALVE.z + 0.9),
      new THREE.Vector3(0.6, 0.02, -3.1), new THREE.Vector3(0.1, 0.02, -2.5), new THREE.Vector3(-0.15, 0.02, -1.95), new THREE.Vector3(SPRINKLER.x + 0.12, 0.02, SPRINKLER.z - 0.12)];
    const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.017, 7), stdMat('#3d8a3f', { roughness: 0.42 }));
    hose.castShadow = true; hose.receiveShadow = true;
    root.add(hose);
  }
  const valve = {
    object: valveRoot,
    setTurn(t) { wheel.rotation.z = -clamp01(t) * TAU * 1.5; },
  };

  // ================================================================== CAIXOTE DE FEIRA
  const crate = buildCrate(root, layout, updaters);

  // ================================================================== BOLINHA DE TÊNIS
  const ball = buildBall(root, BALL, starTex, updaters);

  // ================================================================== CAMINHA DAS DOGS
  const bed = buildBed(root, DOG_BED, starTex, updaters);

  // ================================================================== OSSINHOS (iguais aos da fase 1)
  const collectibles = buildBones(root, COLLECTIBLES, starTex);

  // ================================================================== update / reset
  function update(dt, t) {
    updateRope(t);
    spr.update(dt);
    for (const f of updaters) f(dt, t);
    for (const c of collectibles) c._update(dt, t);
  }
  function reset() {
    gate.setOpen(0);
    plank.setPress(0);
    wedgeState.bump = -1;
    wedge.setState(0);
    spr.sprinkler.setOn(1);
    spr.sprinkler.setAngle(0);
    valve.setTurn(0);
    crate._reset();
    ball._reset();
    bed.setHighlight(false);
    for (const c of collectibles) c.reset();
  }
  return {
    gate, plank, wedge, sprinkler: spr.sprinkler, valve, crate, ball, bed, collectibles,
    item: ball, // compatível com o puzzle provisório (_placeholder.js)
    update, reset,
  };
}

// ==================================================================== irrigador
function buildSprinkler(root, S) {
  const grp = new THREE.Group();
  grp.name = 'irrigador';
  grp.position.set(S.x, 0, S.z);
  root.add(grp);
  // corpo: base tipo "estaca" verde + cabeça de latão com 3 braços
  const green = stdMat('#2f7a46', { roughness: 0.45 });
  const brass = brassMat();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 16), green);
  base.position.y = 0.025;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.14, 10), green);
  stem.position.y = 0.11;
  grp.add(base, stem);
  const head = new THREE.Group();
  head.position.y = 0.19;
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), brass);
  head.add(hub);
  const nozY = 0.235;
  for (let i = 0; i < S.jets; i++) {
    const a = (i / S.jets) * TAU;
    const arm = new THREE.Group();
    arm.rotation.y = -a; // braço ao longo de (cos a, sin a) no plano XZ
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.06, 0.012, 0.0), new THREE.Vector3(0.11, 0.035, -0.015)]);
    arm.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.009, 6), brass));
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.013, 0.03, 8).rotateZ(-Math.PI / 2 + 0.5), brass);
    noz.position.set(0.115, 0.04, -0.015);
    arm.add(noz);
    head.add(arm);
  }
  grp.add(head);
  grp.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  grp.add(contactShadow(0.12, 0.12, 0.5));

  // ---------------- jatos: gotas (Points) seguindo arcos balísticos, leque do pé do irrigador até a borda
  const U = {
    uTime: shared.time, uAngle: { value: 0 }, uOn: { value: 1 }, uR: { value: S.r }, uMinR: { value: S.minR || 0.25 },
    uNoz: { value: nozY + 0.02 }, uJets: { value: S.jets }, uScale: { value: 420 }, uOmega: { value: S.omega || 1.25 },
  };
  const commonGLSL = `
    uniform float uTime, uAngle, uOn, uR, uMinR, uNoz, uJets, uScale, uOmega;
    vec3 arcPos(float jet, float F, float s, float side, out float alpha) {
      float L = mix(uMinR + 0.12, uR, F) * mix(0.15, 1.0, uOn);
      float tTravel = 0.55 + F * 0.45;
      float lag = s * tTravel * uOmega * 0.22;           // leve curvatura (gotas antigas ficam para trás)
      float ang = uAngle + jet * 6.2831853 / uJets - lag + side;
      float d = L * s;
      float H = (0.2 + 0.5 * F) * mix(0.25, 1.0, uOn);
      float y = uNoz + 4.0 * H * s * (1.0 - s) - uNoz * s * s;
      alpha = smoothstep(0.0, 0.06, s) * (1.0 - smoothstep(0.9, 1.0, s));
      return vec3(cos(ang) * d, y, sin(ang) * d);
    }`;
  const N = 3 * 340;
  const aJet = new Float32Array(N), aF = new Float32Array(N), aPh = new Float32Array(N), aSide = new Float32Array(N), aSz = new Float32Array(N);
  const r = rng(91);
  for (let i = 0; i < N; i++) {
    aJet[i] = i % S.jets;
    aF[i] = Math.pow(r(), 0.65);
    aPh[i] = r();
    aSide[i] = (r() - 0.5) * 2 * (S.halfWidth || 0.2) * 0.55;
    aSz[i] = 0.5 + r() * 0.8;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  dg.setAttribute('aJet', new THREE.BufferAttribute(aJet, 1));
  dg.setAttribute('aF', new THREE.BufferAttribute(aF, 1));
  dg.setAttribute('aPh', new THREE.BufferAttribute(aPh, 1));
  dg.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  dg.setAttribute('aSz', new THREE.BufferAttribute(aSz, 1));
  const dropMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `${commonGLSL}
      attribute float aJet, aF, aPh, aSide, aSz; varying float vA;
      void main() {
        float tTravel = 0.55 + aF * 0.45;
        float s = fract(aPh + uTime / tTravel);
        float al;
        vec3 p = arcPos(aJet, aF, s, aSide * (0.4 + s), al);
        vA = al * uOn;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSz * uScale * 0.022 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        float a = smoothstep(0.5, 0.1, d);
        gl_FragColor = vec4(vec3(1.25, 1.55, 1.8) * (0.6 + 0.6 * smoothstep(0.3, 0.0, d)), a * vA * 0.9);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const drops = new THREE.Points(dg, dropMat);
  drops.frustumCulled = false;
  grp.add(drops);

  // fio contínuo do jato principal (fita brilhante com pulsos correndo para fora)
  const SEG = 40;
  const ribPos = [], ribS = [], ribSide = [], ribJet = [], ribIdx = [];
  for (let j = 0; j < S.jets; j++) {
    const base0 = ribPos.length / 3;
    for (let i = 0; i <= SEG; i++) for (const sd of [-1, 1]) { ribPos.push(0, 0, 0); ribS.push(i / SEG); ribSide.push(sd); ribJet.push(j); }
    for (let i = 0; i < SEG; i++) { const a = base0 + i * 2; ribIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(ribPos, 3));
  rg.setAttribute('aS', new THREE.Float32BufferAttribute(ribS, 1));
  rg.setAttribute('aSd', new THREE.Float32BufferAttribute(ribSide, 1));
  rg.setAttribute('aJet', new THREE.Float32BufferAttribute(ribJet, 1));
  rg.setIndex(ribIdx);
  const ribMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `${commonGLSL}
      attribute float aS, aSd, aJet; varying float vS; varying float vA; varying float vSd;
      void main() {
        float al;
        vec3 p = arcPos(aJet, 0.97, aS, 0.0, al);
        float al2; vec3 p2 = arcPos(aJet, 0.97, min(1.0, aS + 0.02), 0.0, al2);
        vec3 tng = normalize(p2 - p + vec3(1e-4, 0.0, 0.0));
        vec3 side = normalize(cross(tng, vec3(0.0, 1.0, 0.0)));
        p += side * aSd * (0.012 + aS * 0.03);
        vS = aS; vSd = aSd;
        vA = smoothstep(0.0, 0.05, aS) * (1.0 - smoothstep(0.8, 1.0, aS)) * uOn;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime; varying float vS; varying float vA; varying float vSd;
      void main() {
        float pulse = 0.55 + 0.45 * sin(vS * 38.0 - uTime * 22.0);
        float edge = 1.0 - abs(vSd);
        float a = vA * (0.2 + 0.4 * pulse) * smoothstep(0.0, 0.9, edge) * (1.0 - vS * 0.5);
        gl_FragColor = vec4(vec3(1.2, 1.5, 1.75), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const ribbon = new THREE.Mesh(rg, ribMat);
  ribbon.frustumCulled = false;
  grp.add(ribbon);

  // névoa (pufes grandes e suaves perto da queda)
  const M = 3 * 40;
  const mg = new THREE.BufferGeometry();
  const mJet = new Float32Array(M), mF = new Float32Array(M), mPh = new Float32Array(M), mSide = new Float32Array(M), mSz = new Float32Array(M);
  for (let i = 0; i < M; i++) { mJet[i] = i % S.jets; mF[i] = 0.35 + r() * 0.65; mPh[i] = r(); mSide[i] = (r() - 0.5) * 0.35; mSz[i] = 2.5 + r() * 3.5; }
  mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
  mg.setAttribute('aJet', new THREE.BufferAttribute(mJet, 1));
  mg.setAttribute('aF', new THREE.BufferAttribute(mF, 1));
  mg.setAttribute('aPh', new THREE.BufferAttribute(mPh, 1));
  mg.setAttribute('aSide', new THREE.BufferAttribute(mSide, 1));
  mg.setAttribute('aSz', new THREE.BufferAttribute(mSz, 1));
  const mistMat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `${commonGLSL}
      attribute float aJet, aF, aPh, aSide, aSz; varying float vA;
      void main() {
        float s = 0.62 + 0.38 * fract(aPh + uTime * 0.35);
        float al;
        vec3 p = arcPos(aJet, aF, s, aSide, al);
        p.y = max(p.y, 0.05) + fract(aPh + uTime * 0.35) * 0.12;
        vA = sin(fract(aPh + uTime * 0.35) * 3.14159) * uOn;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSz * uScale * 0.03 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.75, 0.88, 1.0), a * a * vA * 0.16);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mist = new THREE.Points(mg, mistMat);
  mist.frustumCulled = false;
  grp.add(mist);

  // faixa molhada no chão sob cada jato (mostra exatamente onde molha) + respingos
  const hw = S.halfWidth || 0.2;
  const wPos = [], wUv = [], wJet = [], wIdx = [];
  const AS = 10, RS = 16;
  for (let j = 0; j < S.jets; j++) {
    const b0 = wPos.length / 3;
    for (let ri = 0; ri <= RS; ri++) for (let ai = 0; ai <= AS; ai++) {
      wPos.push(0, 0, 0); wUv.push(ai / AS, ri / RS); wJet.push(j);
    }
    for (let ri = 0; ri < RS; ri++) for (let ai = 0; ai < AS; ai++) {
      const a = b0 + ri * (AS + 1) + ai, b = a + AS + 1;
      wIdx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  wg.setAttribute('uv', new THREE.Float32BufferAttribute(wUv, 2));
  wg.setAttribute('aJet', new THREE.Float32BufferAttribute(wJet, 1));
  wg.setIndex(wIdx);
  const wetMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uHW: { value: hw } },
    vertexShader: `
      uniform float uAngle, uOn, uR, uMinR, uJets, uHW; attribute float aJet; varying vec2 vUv; varying vec2 vP;
      void main() {
        vUv = uv;
        float ang = uAngle + aJet * 6.2831853 / uJets + (uv.x - 0.5) * 2.0 * uHW * 1.1;
        float d = mix(uMinR, uR * mix(0.15, 1.0, uOn), uv.y);
        vec3 p = vec3(cos(ang) * d, 0.014, sin(ang) * d);
        vP = p.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime, uOn; varying vec2 vUv; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float side = 1.0 - smoothstep(0.55, 1.0, abs(vUv.x - 0.5) * 2.0);
        float ends = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
        // respingos cintilando
        vec2 cell = floor(vP * 18.0);
        float rnd = h(cell);
        float tw = step(0.82, fract(rnd * 7.0 + uTime * (1.5 + rnd * 2.0)));
        float sp = tw * smoothstep(0.45, 0.0, length(fract(vP * 18.0) - 0.5));
        float a = (0.16 * side + sp * 0.6 * side) * ends * uOn;
        gl_FragColor = vec4(vec3(0.8, 1.0, 1.25) * (1.0 + sp), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const wet = new THREE.Mesh(wg, wetMat);
  wet.frustumCulled = false;
  wet.renderOrder = 3;
  grp.add(wet);

  const st = { angle: 0, on: 1, shown: 1 };
  const sprinkler = {
    object: grp,
    setAngle(a) {
      st.angle = a;
      U.uAngle.value = a;
      head.rotation.y = -a;
    },
    setOn(k) { st.on = clamp01(k); },
  };
  return {
    sprinkler,
    update(dt) {
      // suaviza: jatos "murcham" ao desligar
      st.shown += (st.on - st.shown) * Math.min(1, dt * 5);
      if (Math.abs(st.shown - st.on) < 0.002) st.shown = st.on;
      U.uOn.value = st.shown;
      const vis = st.shown > 0.003;
      drops.visible = ribbon.visible = mist.visible = wet.visible = vis;
    },
  };
}

// ==================================================================== caixote de feira
function buildCrate(root, layout, updaters) {
  const C = layout.CRATE, CH = layout.CHANNEL;
  const hs = C.half, H = C.height;
  const g = new THREE.Group();
  g.name = 'caixote';
  const body = new THREE.Group(); // inclina durante a queda
  g.add(body);
  const slat = woodMat('#c9a26b', { key: 'f2-crate-slat', rough: 0.85 });
  const slatV = woodMat('#b88f58', { key: 'f2-crate-post', vertical: true, rough: 0.85 });
  const r = rng(61);
  // ripas laterais (3 por face, com frestas)
  const nS = 4, sh = 0.085, gap = (H - 0.04 - nS * sh) / (nS - 1);
  for (let f = 0; f < 4; f++) {
    const face = new THREE.Group();
    face.rotation.y = (f * Math.PI) / 2;
    for (let i = 0; i < nS; i++) {
      const s = new THREE.Mesh(rbox(hs * 2 - 0.02, sh, 0.022, 0.006), slat);
      s.position.set(0, 0.03 + sh / 2 + i * (sh + gap), hs - 0.011);
      s.rotation.z = (r() - 0.5) * 0.012;
      face.add(s);
    }
    // alça recortada (ripa de cima com furo escuro)
    const hole = new THREE.Mesh(rbox(0.14, 0.035, 0.024, 0.012), stdMat('#2a1d12'));
    hole.position.set(0, 0.03 + sh / 2 + (nS - 1) * (sh + gap), hs - 0.009);
    face.add(hole);
    body.add(face);
  }
  // cantoneiras
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = new THREE.Mesh(rbox(0.05, H, 0.05, 0.008), slatV);
    p.position.set(sx * (hs - 0.025), H / 2, sz * (hs - 0.025));
    body.add(p);
  }
  // fundo
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(rbox(hs * 2 - 0.04, 0.02, 0.15, 0.005), slat);
    b.position.set(0, 0.03, -hs + 0.12 + i * 0.17);
    body.add(b);
  }
  // palha + frutas
  {
    const straw = new THREE.Mesh(
      (() => {
        const geo = new THREE.PlaneGeometry(hs * 2 - 0.06, hs * 2 - 0.06, 14, 14).rotateX(-Math.PI / 2);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, (vnoise3(p.getX(i) * 9, 0, p.getZ(i) * 9) - 0.5) * 0.05);
        geo.computeVertexNormals();
        return geo;
      })(),
      new THREE.MeshStandardMaterial({ color: '#d8b968', roughness: 1, map: canvasTexture(128, 128, (c, w, h) => {
        c.fillStyle = '#c9a04c'; c.fillRect(0, 0, w, h);
        const rr = rng(4);
        for (let i = 0; i < 500; i++) {
          c.strokeStyle = `rgba(${rr() < 0.5 ? '255,230,150' : '140,100,40'},${0.4 + rr() * 0.4})`;
          c.lineWidth = 1 + rr();
          const x = rr() * w, y = rr() * h, a = rr() * Math.PI;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); c.stroke();
        }
      }) }),
    );
    straw.position.y = H - 0.17;
    body.add(straw);
    // fiapos de palha escapando pelas frestas
    const fiapo = new THREE.MeshStandardMaterial({ color: '#e0c174', roughness: 1 });
    for (let i = 0; i < 16; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09 + r() * 0.06, 3), fiapo);
      const a = r() * TAU;
      f.position.set(Math.cos(a) * hs * 0.9, H - 0.12 + r() * 0.1, Math.sin(a) * hs * 0.9);
      f.rotation.set((r() - 0.5) * 1.8, r() * 3, (r() - 0.5) * 1.8);
      body.add(f);
    }
    const orange = stdMat('#f08a1e', { roughness: 0.55 });
    const apple = stdMat('#c8322a', { roughness: 0.45 });
    const greenA = stdMat('#8cbf3a', { roughness: 0.5 });
    const fr = [[-0.18, -0.14, orange], [0.0, -0.18, orange], [0.17, -0.06, apple], [-0.08, 0.06, greenA], [0.12, 0.16, orange], [-0.2, 0.17, apple], [0.05, 0.02, orange]];
    for (const [x, z, m] of fr) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.06 + r() * 0.012, 14, 10), m);
      s.position.set(x, H - 0.13 + r() * 0.02, z);
      s.scale.y = 0.92;
      body.add(s);
    }
  }
  body.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const shadow = contactShadow(hs + 0.1, hs + 0.1, 0.5);
  g.add(shadow);
  g.position.set(C.start.x, 0, C.start.z);
  root.add(g);

  // respingos ao cair no canal
  const SPL = 60;
  const sp = new Float32Array(SPL * 3), sv = new Float32Array(SPL * 3);
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const splash = new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 0.05, map: radialTexture(), color: '#d8f0ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  splash.frustumCulled = false;
  splash.visible = false;
  root.add(splash);
  let splashT = -1;
  const waterY = -(C.height + 0.012) + 0.22;
  function startSplash(x, z) {
    for (let i = 0; i < SPL; i++) {
      const a = r() * TAU, s = 0.6 + r() * 1.6;
      sp[i * 3] = x + Math.cos(a) * hs * 0.9; sp[i * 3 + 1] = waterY; sp[i * 3 + 2] = z + Math.sin(a) * hs * 0.9;
      sv[i * 3] = Math.cos(a) * s * 0.5; sv[i * 3 + 1] = 1.2 + r() * 1.8; sv[i * 3 + 2] = Math.sin(a) * s * 0.5;
    }
    splashT = 0;
    splash.visible = true;
  }
  updaters.push((dt) => {
    if (splashT < 0) return;
    splashT += dt;
    for (let i = 0; i < SPL; i++) {
      sv[i * 3 + 1] -= 9.8 * dt;
      sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt;
    }
    sgeo.attributes.position.needsUpdate = true;
    splash.material.opacity = 0.9 * Math.max(0, 1 - splashT / 0.9);
    if (splashT > 0.9) { splashT = -1; splash.visible = false; }
  });

  const st = { sink: 0, from: null, splashed: false };
  const bridgeX = (CH.xMin + CH.xMax) / 2, bridgeZ = CH.slot.z;
  const bottomY = -(C.height + 0.01);
  function apply() {
    const t = st.sink;
    if (t <= 0 || !st.from) {
      body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
      shadow.visible = true;
      return;
    }
    const f = st.from;
    // 0..0.35: escorrega até a borda inclinando para leste; 0.35..1: cai e assenta
    const a = clamp01(t / 0.35), b = clamp01((t - 0.35) / 0.65);
    const edgeX = CH.xMin + hs * 0.35;
    let x = f.x + (edgeX - f.x) * ease(a);
    let z = f.z + (bridgeZ - f.z) * ease(a);
    let y = 0, tilt = -0.5 * ease(a);
    if (b > 0) {
      x = edgeX + (bridgeX - edgeX) * ease(b);
      z = bridgeZ;
      const fall = b < 0.8 ? (b / 0.8) ** 2 : 1;
      const settle = b >= 0.8 ? Math.sin(((b - 0.8) / 0.2) * Math.PI) * 0.05 : 0;
      y = bottomY * fall + settle;
      tilt = -0.5 * (1 - ease(b)) + (b > 0.8 ? Math.sin(((b - 0.8) / 0.2) * Math.PI * 2) * 0.03 : 0);
    }
    g.position.set(x, 0, z);
    body.position.set(0, y, 0);
    // inclina em torno da aresta inferior leste
    body.rotation.set(0, 0, tilt);
    shadow.visible = b <= 0;
    if (b > 0.75 && !st.splashed) { st.splashed = true; startSplash(bridgeX, bridgeZ); }
    if (t < 0.3) st.splashed = false;
  }
  return {
    object: g,
    setPos(x, z) {
      if (st.sink > 0) return;
      g.position.x = x; g.position.z = z;
    },
    setSink(t) {
      t = clamp01(t);
      if (t > 0 && !st.from) st.from = { x: g.position.x, z: g.position.z };
      st.sink = t;
      if (t <= 0) { st.from = null; st.splashed = false; }
      apply();
    },
    _reset() {
      st.sink = 0; st.from = null; st.splashed = false;
      g.position.set(C.start.x, 0, C.start.z);
      apply();
    },
  };
}

// ==================================================================== bolinha de tênis
function tennisTexture() {
  return canvasTexture(256, 128, (c, w, h) => {
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const lon = u * TAU, lat = (0.5 - v) * Math.PI;
      // curva da costura: lat = 0.42 * sin(2·lon)
      const seam = Math.abs(lat - 0.42 * Math.sin(2 * lon) * Math.cos(lat * 0.2));
      const n = vnoise3(x * 0.35, y * 0.35, 0) * 0.5 + vnoise3(x * 1.3, y * 1.3, 2) * 0.5;
      let r = 205 + n * 40, gg = 232 + n * 22, b = 40 + n * 30;
      const k = Math.max(0, 1 - Math.abs(seam - 0.0) / 0.075);
      const line = k > 0 ? Math.min(1, k * 2.2) : 0;
      r = r + (246 - r) * line; gg = gg + (246 - gg) * line; b = b + (236 - b) * line;
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, { repeat: false });
}
function buildBall(root, BALL, starTex, updaters) {
  const R = 0.068;
  const g = new THREE.Group();
  g.name = 'ball'; // as dogs detectam a pose de carregar pelo nome
  g.userData.carryKind = 'ball';
  const tex = tennisTexture();
  const felt = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: tex, roughness: 0.85, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#f4ff9a'),
    emissive: '#c8e632', emissiveIntensity: 0.12,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), felt);
  m.castShadow = true; m.receiveShadow = true;
  m.rotation.set(0.4, 0.8, 0.2);
  g.add(m);
  // penugem: casca levemente maior, translúcida
  const fuzz = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 24, 16), new THREE.MeshStandardMaterial({ color: '#efff8a', transparent: true, opacity: 0.18, roughness: 1, depthWrite: false }));
  g.add(fuzz);
  const home = new THREE.Vector3(BALL.x, R, BALL.z);
  g.position.copy(home);
  root.add(g);
  const homeParent = root;
  const shadow = contactShadow(0.1, 0.1, 0.55);
  shadow.position.set(BALL.x, 0.006, BALL.z);
  root.add(shadow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#e8ff6a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(0.6, 0.6, 1);
  root.add(halo);
  const stars = [0, 1, 2].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#fbffd0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.08);
    root.add(s);
    return { s, ph: i * 2.1 };
  });
  // luz de destaque (sempre um leve brilho para a bolinha ser vista no crepúsculo)
  const L = new THREE.PointLight('#f2ffb0', 0.9, 2.4, 1.8);
  L.position.set(BALL.x - 0.25, 0.55, BALL.z + 0.35);
  root.add(L);
  let hl = 0, hlT = 0;
  updaters.push((dt, t) => {
    hl += (hlT - hl) * Math.min(1, dt * 4);
    const inScene = g.parent === homeParent;
    const pulse = hl * (0.6 + 0.4 * Math.sin(t * 3.2));
    felt.emissiveIntensity = 0.12 + 0.35 * pulse;
    halo.visible = inScene && hl > 0.01;
    halo.position.copy(g.position);
    halo.material.opacity = 0.55 * pulse;
    shadow.visible = inScene;
    if (inScene) shadow.position.set(g.position.x, 0.006, g.position.z);
    L.intensity = inScene ? 0.6 + 0.8 * hl : 0;
    stars.forEach((cs, i) => {
      const cyc = ((t * 0.8 + cs.ph) % 2.4) / 2.4;
      const f = Math.sin(cyc * Math.PI) * hl * (inScene ? 1 : 0);
      cs.s.material.opacity = f * 0.9;
      const a = t * 0.6 + i * 2.09;
      cs.s.position.set(g.position.x + Math.cos(a) * 0.15, g.position.y + 0.04 + cyc * 0.16, g.position.z + Math.sin(a) * 0.12);
      cs.s.scale.setScalar(0.05 + f * 0.05);
    });
  });
  return {
    object: g,
    home: home.clone(),
    setHighlight(on) { hlT = on ? 1 : 0; },
    _reset() {
      if (g.parent !== homeParent) homeParent.add(g);
      g.position.copy(home);
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(1);
      hlT = 0;
    },
  };
}

// ==================================================================== caminha
function plaidTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#b8473a'; c.fillRect(0, 0, w, h);
    const band = (pos, wd, col, vert) => { c.fillStyle = col; vert ? c.fillRect(pos, 0, wd, h) : c.fillRect(0, pos, w, wd); };
    for (const v of [false, true]) {
      band(10, 18, 'rgba(60,30,30,0.45)', v); band(70, 18, 'rgba(60,30,30,0.45)', v);
      band(40, 6, 'rgba(245,225,180,0.6)', v); band(100, 4, 'rgba(240,190,80,0.55)', v);
    }
    const r = rng(2);
    for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.06})`; c.fillRect(r() * w, r() * h, 1, 1); }
  });
}
function fleeceTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#f3e6cf'; c.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '200,175,140'},${0.15 + r() * 0.25})`;
      c.beginPath(); c.arc(r() * w, r() * h, 0.8 + r() * 1.8, 0, TAU); c.fill();
    }
  });
}
function buildBed(root, BED, starTex, updaters) {
  const g = new THREE.Group();
  g.name = 'caminha';
  g.position.set(BED.x, 0, BED.z);
  root.add(g);
  const ax = BED.w / 2 - 0.08, az = BED.d / 2 - 0.07;
  // aro estofado (tubo com espessura variável: encosto alto atrás/norte)
  const plaid = plaidTexture();
  plaid.repeat.set(6, 1);
  const rimMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: plaid, roughness: 0.9, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffc9a8'), emissive: '#ff7a3a', emissiveIntensity: 0 });
  const NU = 64, NV = 16;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, phi = u * TAU;
    const back = Math.max(0, -Math.sin(phi)); // norte = -z
    const rr = 0.075 + back * 0.045;
    const cx = Math.cos(phi) * ax, cz = Math.sin(phi) * az;
    const nx = Math.cos(phi) / ax, nz = Math.sin(phi) / az;
    const nl = Math.hypot(nx, nz);
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, psi = v * TAU;
      const out = Math.cos(psi) * rr, up = Math.sin(psi) * rr * (1.0 + back * 0.5);
      const puff = 1 + 0.06 * Math.sin(phi * 10) * Math.cos(psi);
      pos.push(cx + (nx / nl) * out * puff, rr * (1 + back * 0.5) + up, cz + (nz / nl) * out * puff);
      uv.push(u * 3, v);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = i * (NV + 1) + j, b = a + NV + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  rg.setIndex(idx);
  rg.computeVertexNormals();
  const rim = new THREE.Mesh(rg, rimMat);
  g.add(rim);
  // base
  const baseG = new THREE.CylinderGeometry(1, 1, 0.05, 40).scale(ax + 0.06, 1, az + 0.06);
  const base = new THREE.Mesh(baseG, new THREE.MeshStandardMaterial({ color: '#7a3a2e', roughness: 0.95 }));
  base.position.y = 0.025;
  g.add(base);
  // almofada fofinha (fleece creme)
  const fleece = fleeceTexture();
  const cushMat = new THREE.MeshPhysicalMaterial({ color: '#fff6e8', map: fleece, bumpMap: fleece, bumpScale: 2, roughness: 1, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#fff0d8'), emissive: '#ffb060', emissiveIntensity: 0 });
  const cg = new THREE.SphereGeometry(1, 36, 14);
  {
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const puff = 1 + (vnoise3(x * 3, y * 3, z * 3) - 0.5) * 0.12;
      p.setXYZ(i, x * (ax - 0.02) * puff, Math.max(y, -0.2) * 0.07 * puff, z * (az - 0.02) * puff);
    }
    cg.computeVertexNormals();
  }
  const cush = new THREE.Mesh(cg, cushMat);
  cush.position.y = 0.075;
  g.add(cush);
  // mantinha dobrada sobre a borda + brinquedo de corda
  const blanket = new THREE.Mesh(rbox(0.26, 0.03, 0.2, 0.012, 3), new THREE.MeshStandardMaterial({ color: '#6c8fb0', roughness: 1, map: fleece }));
  blanket.position.set(ax - 0.05, 0.17, -az * 0.4);
  blanket.rotation.set(0.1, 0.5, -0.45);
  g.add(blanket);
  const toy = new THREE.Group();
  const toyM = new THREE.MeshStandardMaterial({ map: ropeTexture(), roughness: 0.9, color: '#ffb0a0' });
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8).rotateZ(Math.PI / 2), toyM);
  const k1 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), toyM); k1.position.x = -0.1;
  const k2 = k1.clone(); k2.position.x = 0.1;
  toy.add(tb, k1, k2);
  toy.position.set(-0.08, 0.14, 0.04);
  toy.rotation.y = 0.6;
  g.add(toy);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(contactShadow(ax + 0.14, az + 0.14, 0.55));
  // destaque: brilho quente pulsante + halo no chão + estrelinhas
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTexture(), color: '#ffbf6a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set((ax + 0.35) * 2, 1, (az + 0.35) * 2);
  halo.position.y = 0.01;
  g.add(halo);
  const stars = [0, 1, 2, 3].map((i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#fff0c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.1);
    g.add(s);
    return { s, ph: i * 1.6 };
  });
  let hl = 0, hlT = 0;
  updaters.push((dt, t) => {
    hl += (hlT - hl) * Math.min(1, dt * 3);
    const pulse = hl * (0.7 + 0.3 * Math.sin(t * 3));
    rimMat.emissiveIntensity = 0.12 * pulse;
    cushMat.emissiveIntensity = 0.22 * pulse;
    halo.material.opacity = 0.5 * pulse;
    stars.forEach((cs, i) => {
      const cyc = ((t * 0.7 + cs.ph) % 2.6) / 2.6;
      const f = Math.sin(cyc * Math.PI) * hl;
      cs.s.material.opacity = f * 0.9;
      const a = t * 0.5 + i * 1.57;
      cs.s.position.set(Math.cos(a) * (ax + 0.05), 0.22 + cyc * 0.25, Math.sin(a) * (az + 0.05));
      cs.s.scale.setScalar(0.05 + f * 0.06);
    });
  });
  return { object: g, setHighlight(on) { hlT = on ? 1 : 0; } };
}

// ==================================================================== ossinhos dourados
function buildBones(root, list, starTex) {
  const boneMat = new THREE.MeshStandardMaterial({ color: '#dba04f', roughness: 0.5, metalness: 0.2, emissive: '#ffb347', emissiveIntensity: 0 });
  /** @type {THREE.BufferGeometry[]} */
  const parts = [new THREE.CapsuleGeometry(0.021, 0.1, 4, 10).rotateZ(Math.PI / 2)];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(new THREE.SphereGeometry(0.03, 12, 10).translate(sx * 0.068, 0, sz * 0.022));
  const boneGeo = mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; q.deleteAttribute('uv'); return q; }));
  boneGeo.scale(1, 0.62, 1);
  return list.map((c, i) => {
    const grp = new THREE.Group();
    grp.name = `osso-${c.id}`;
    const r = rng(i + 3);
    const mesh = new THREE.Mesh(boneGeo, boneMat.clone());
    mesh.castShadow = true; mesh.receiveShadow = true;
    grp.add(mesh);
    const baseRot = r() * Math.PI;
    root.add(grp);
    const sh = contactShadow(0.11, 0.06, 0.45);
    sh.position.set(c.x, 0.006, c.z);
    sh.rotation.y = baseRot;
    root.add(sh);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#fff1c2', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    star.scale.setScalar(0.12);
    root.add(star);
    // brilho próprio sutil (crepúsculo: o ossinho precisa aparecer)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffc46a', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(0.32);
    root.add(glow);
    const st = { anim: -1, collected: false, phase: r() * 10 };
    const o = {
      id: c.id,
      object: grp,
      collect() { if (st.collected) return; st.collected = true; st.anim = 0; },
      reset() {
        st.collected = false; st.anim = -1;
        grp.visible = true; sh.visible = true; glow.visible = true;
        grp.position.set(c.x, 0.021, c.z);
        grp.rotation.set(0, baseRot, 0.06);
        grp.scale.setScalar(1);
        sh.scale.set(0.22, 1, 0.12);
        sh.material.opacity = 0.45;
        glow.position.set(c.x, 0.05, c.z);
      },
      _update(dt, t) {
        if (st.anim >= 0) {
          st.anim += dt;
          const k = Math.min(1, st.anim / 0.55);
          grp.position.y = 0.021 + Math.sin(k * Math.PI) * 0.28;
          grp.rotation.y = baseRot + k * Math.PI * 3;
          const s = k < 0.35 ? 1 + k * 0.6 : Math.max(0, 1.21 * (1 - (k - 0.35) / 0.65));
          grp.scale.setScalar(s);
          sh.material.opacity = 0.45 * (1 - k);
          glow.material.opacity = 0.25 * (1 - k);
          star.material.opacity = Math.sin(k * Math.PI) * 0.9;
          star.position.set(grp.position.x, grp.position.y + 0.05, grp.position.z);
          if (k >= 1) { grp.visible = false; sh.visible = false; glow.visible = false; st.anim = -1; star.material.opacity = 0; }
          return;
        }
        if (st.collected) return;
        const cyc = ((t + st.phase) % 4.2) / 4.2;
        const f = cyc < 0.12 ? Math.sin((cyc / 0.12) * Math.PI) : 0;
        star.material.opacity = f * 0.85;
        star.material.rotation = t * 0.8;
        star.scale.setScalar(0.07 + f * 0.07);
        star.position.set(c.x + 0.03, 0.07, c.z);
        mesh.material.emissiveIntensity = 0.15 + f * 0.5;
        glow.material.opacity = 0.2 + 0.08 * Math.sin(t * 2 + st.phase);
        grp.position.y = 0.021 + Math.max(0, Math.sin(t * 2 + st.phase)) * 0.004;
      },
    };
    o.reset();
    return o;
  });
}
