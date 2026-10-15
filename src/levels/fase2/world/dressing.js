// FASE 2 · Cenografia: tanque de lavar roupa, cesto de vime, varal com lençóis e toalhas ao vento,
// vaso de samambaia, pilha de tijolos, canteiro da bolinha, baldes, vasos e detalhes da área de serviço.
import * as THREE from 'three';
import {
  shared, rng, rbox, canvasTexture, speckleTexture, contactShadow, stdMat, woodMat, ironMat, brassMat, terracottaMat,
  potProfile, soilDisc, foliageCluster, leafSkin, paint, mergeGeometries, vnoise3,
} from '../../../world/util.js';
import { plantMat, crownMat, geranium, smallFlowers, lavender, boxwood, merge } from '../../../world/plants.js';

const TAU = Math.PI * 2;
const col = (id, layout) => layout.STATIC_COLLIDERS.find((c) => c.id === id);

// ------------------------------------------------------------------ texturas de tecido
function fabric(kind, seed) {
  return canvasTexture(256, 256, (c, w, h) => {
    const r = rng(seed);
    if (kind === 'stripes') {
      c.fillStyle = '#f4efe4'; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) { c.fillStyle = '#5f8fc4'; c.fillRect(x, 0, 14, h); c.fillStyle = '#a9c6e6'; c.fillRect(x + 18, 0, 4, h); }
    } else if (kind === 'dots') {
      c.fillStyle = '#f2a7a0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff7ef';
      for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < w; x += 32) { c.beginPath(); c.arc(x + 8, y + 8, 6, 0, TAU); c.fill(); }
    } else if (kind === 'towelY') {
      c.fillStyle = '#f2b636'; c.fillRect(0, 0, w, h);
      for (const y of [h * 0.12, h * 0.82]) { c.fillStyle = '#e07a2a'; c.fillRect(0, y, w, 18); c.fillStyle = '#fff4dc'; c.fillRect(0, y + 22, w, 6); }
    } else if (kind === 'towelT') {
      c.fillStyle = '#3f9e95'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 48) { c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(0, y, w, 8); }
    } else if (kind === 'bandana') {
      c.fillStyle = '#d8392f'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(r() * w, r() * h, 3 + r() * 4, 0, TAU); c.fill(); }
    }
    // trama do tecido
    for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.05})`; c.fillRect(r() * w, r() * h, 1, 1); }
  });
}

/** Tecido pendurado no varal: plano com segmentos; o vertex shader balança a barra presa no topo. */
function makeCloth({ w, h, map, seed, stiff = 1 }) {
  const geo = new THREE.PlaneGeometry(w, h, 10, 12);
  geo.translate(0, -h / 2, 0); // topo em y = 0 (preso no varal)
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.92, side: THREE.DoubleSide });
  const U = { uTime: shared.time, uSeed: { value: seed }, uH: { value: h }, uStiff: { value: stiff } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uSeed, uH, uStiff;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = normalize(objectNormal + vec3(0.0, 0.0, 0.0));')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float k = pow(clamp(-position.y / uH, 0.0, 1.0), 1.25);
          float t = uTime + uSeed;
          float gust = 0.6 + 0.4 * sin(t * 0.43) * sin(t * 0.17 + 1.3);
          float wave = sin(t * 2.1 + position.x * 3.2 + position.y * 2.0) * 0.6 + sin(t * 3.7 - position.x * 5.0) * 0.25;
          transformed.z += (0.05 + wave * 0.06) * k * gust * 2.2 / uStiff + 0.02 * k;
          transformed.x += sin(t * 1.3 + position.y * 3.0) * 0.015 * k * gust;
          transformed.y += abs(wave) * 0.01 * k;
        }`);
  };
  m.customProgramCacheKey = () => 'f2-cloth';
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildDressing({ root, layout }) {
  const g = new THREE.Group();
  g.name = 'cenografia';
  root.add(g);
  const Z = layout.WORLD.houseWallZ;
  const shadows = new THREE.Group();
  g.add(shadows);

  // ================================================================ tanque de lavar roupa (granito + coluna)
  {
    const c = col('tanque', layout);
    const t = new THREE.Group();
    t.position.set(c.x, 0, c.z);
    const granite = new THREE.MeshStandardMaterial({ color: '#d9d6cf', map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 0.6, roughness: 0.4 });
    const cementM = new THREE.MeshStandardMaterial({ color: '#a8a39a', map: speckleTexture(), roughness: 0.9 });
    const w = c.hx * 2, d = c.hz * 2, top = 0.86;
    // coluna/pé
    const col1 = new THREE.Mesh(rbox(w * 0.42, top - 0.12, d * 0.62, 0.03), cementM);
    col1.position.set(0, (top - 0.12) / 2, -0.04);
    t.add(col1);
    // bacia (paredes)
    const wall = (ww, hh, dd, x, y, z) => { const m = new THREE.Mesh(rbox(ww, hh, dd, 0.02), granite); m.position.set(x, y, z); t.add(m); };
    wall(w, 0.05, d, 0, top - 0.25, 0); // fundo
    wall(w, 0.26, 0.05, 0, top - 0.13, d / 2 - 0.025); // frente
    wall(w, 0.32, 0.05, 0, top - 0.1, -d / 2 + 0.025); // fundo (encosto)
    wall(0.05, 0.26, d, -w / 2 + 0.025, top - 0.13, 0);
    wall(0.05, 0.26, d, w / 2 - 0.025, top - 0.13, 0);
    // esfregador (tábua com caneluras) na metade oeste
    const ribs = new THREE.Group();
    ribs.position.set(-w * 0.22, top - 0.12, 0.02);
    ribs.rotation.x = -0.35;
    for (let i = 0; i < 9; i++) {
      const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, w * 0.4, 6).rotateZ(Math.PI / 2), granite);
      rb.position.set(0, 0, -0.2 + i * 0.045);
      ribs.add(rb);
    }
    const ribBase = new THREE.Mesh(rbox(w * 0.42, 0.02, 0.44, 0.01), granite);
    ribBase.position.y = -0.012;
    ribs.add(ribBase);
    t.add(ribs);
    // água com espuma na metade leste
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.42, d - 0.12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#a9c6cc', roughness: 0.08, transparent: true, opacity: 0.8 }));
    water.position.set(w * 0.22, top - 0.08, 0);
    t.add(water);
    const foamM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    const r = rng(4);
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.025 + r() * 0.02, 8, 6), foamM);
      b.position.set(w * 0.22 + (r() - 0.5) * w * 0.32, top - 0.075, (r() - 0.5) * (d - 0.2));
      b.scale.y = 0.6;
      t.add(b);
    }
    // sabão em barra + escova
    const soap = new THREE.Mesh(rbox(0.09, 0.03, 0.05, 0.012), stdMat('#8fd0f2', { roughness: 0.4 }));
    soap.position.set(w / 2 - 0.08, top + 0.015, d / 2 - 0.04);
    soap.rotation.y = 0.3;
    const brush = new THREE.Group();
    const bb = new THREE.Mesh(rbox(0.14, 0.025, 0.06, 0.01), woodMat('#c08a52', { key: 'f2-brush' }));
    const br = new THREE.Mesh(rbox(0.13, 0.025, 0.05, 0.005), stdMat('#e9d9a0', { roughness: 1 }));
    br.position.y = -0.022;
    brush.add(bb, br);
    brush.position.set(-w / 2 + 0.1, top + 0.04, d / 2 - 0.04);
    brush.rotation.y = -0.2;
    t.add(soap, brush);
    // torneira na parede
    const tap = new THREE.Group();
    tap.position.set(w * 0.22, 1.12, (Z - c.z) + 0.02);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8).rotateX(Math.PI / 2), brassMat());
    spout.position.z = 0.07;
    const down = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8), brassMat());
    down.position.set(0, -0.03, 0.14);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 6, 12), brassMat());
    handle.position.set(0, 0.05, 0.04);
    handle.rotation.x = Math.PI / 2;
    tap.add(spout, down, handle);
    t.add(tap);
    // gota pingando
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: '#d8f0ff', roughness: 0.05, transparent: true, opacity: 0.85 }));
    t.add(drop);
    t.userData.drop = { drop, x: w * 0.22, top: 1.04, z: tap.position.z + 0.14, bottom: top - 0.08 };
    t.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(t);
    shadows.add(contactShadow(c.hx + 0.1, c.hz + 0.1, 0.5).translateX(c.x).translateZ(c.z));
    g.userData.tank = t;
    // balde azul ao lado do tanque (encostado na parede, dentro do colisor do tanque)
  }

  // ================================================================ cesto de vime com roupas
  {
    const c = col('cesto-roupa', layout);
    const b = new THREE.Group();
    b.position.set(c.x, 0, c.z);
    const weave = canvasTexture(128, 128, (cx, w, h) => {
      cx.fillStyle = '#9a6d3c'; cx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 16) {
        const off = (y / 8) % 2 ? 8 : 0;
        const grd = cx.createLinearGradient(x + off, y, x + off, y + 8);
        grd.addColorStop(0, '#d8ad70'); grd.addColorStop(0.5, '#c0905a'); grd.addColorStop(1, '#7a5228');
        cx.fillStyle = grd; cx.fillRect(x + off + 1, y + 1, 14, 6);
      }
    });
    weave.repeat.set(4, 2);
    const wm = new THREE.MeshStandardMaterial({ map: weave, bumpMap: weave, bumpScale: 2, roughness: 0.9, side: THREE.DoubleSide });
    const prof = [new THREE.Vector2(0.0, 0.0), new THREE.Vector2(c.r * 0.8, 0.0), new THREE.Vector2(c.r * 0.88, 0.05), new THREE.Vector2(c.r * 0.96, 0.32), new THREE.Vector2(c.r, 0.4)];
    b.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 28), wm));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(c.r, 0.018, 8, 28), new THREE.MeshStandardMaterial({ map: weave, roughness: 0.9, color: '#d9b07a' }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.4;
    b.add(rim);
    // roupas amontoadas
    const cloths = ['#f2a7a0', '#5f8fc4', '#f4efe4', '#f2b636', '#7fb069'];
    const r = rng(8);
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), stdMat(cloths[i % cloths.length], { roughness: 0.95 }));
      const a = r() * TAU, d = r() * c.r * 0.5;
      s.position.set(Math.cos(a) * d, 0.38 + r() * 0.06, Math.sin(a) * d);
      s.scale.set(1.1 + r() * 0.4, 0.45, 0.8 + r() * 0.4);
      s.rotation.y = r() * 3;
      b.add(s);
    }
    // toalha caindo pela borda
    const drape = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3, 4, 6), new THREE.MeshStandardMaterial({ map: fabric('towelT', 3), roughness: 0.95, side: THREE.DoubleSide }));
    {
      const p = drape.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = (0.15 - y) / 0.3; p.setZ(i, Math.sin(k * 1.4) * 0.05 + (k > 0.2 ? 0 : 0)); }
      drape.geometry.computeVertexNormals();
    }
    drape.position.set(0.05, 0.3, c.r + 0.02);
    b.add(drape);
    b.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(b);
    shadows.add(contactShadow(c.r + 0.1, c.r + 0.1, 0.5).translateX(c.x).translateZ(c.z));
  }

  // ================================================================ varal (postes + fio + lençóis/toalhas)
  const clothes = [];
  {
    const pw = col('poste-varal-oeste', layout), pe = col('poste-varal-leste', layout);
    const postMat = stdMat('#8f9aa0', { roughness: 0.4, metalness: 0.7 });
    const H = 2.0;
    for (const p of [pw, pe]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, H, 10), postMat);
      post.position.set(p.x, H / 2, p.z);
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8).rotateX(Math.PI / 2), postMat);
      tb.position.set(p.x, H - 0.08, p.z);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 12), stdMat('#9a958c', { roughness: 0.9 }));
      foot.position.set(p.x, 0.03, p.z);
      // braço até a parede (o varal é preso na parede também)
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, Math.abs(p.z - Z), 6).rotateX(Math.PI / 2), postMat);
      arm.position.set(p.x, H - 0.25, (p.z + Z) / 2);
      for (const m of [post, tb, foot, arm]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    }
    // dois fios (frente e trás), com barriga
    const lineY = H - 0.1;
    const lineMat = stdMat('#ece6da', { roughness: 0.6 });
    const sag = 0.07;
    const lineAt = (x, zOff) => {
      const s = (x - pw.x) / (pe.x - pw.x);
      return new THREE.Vector3(x, lineY - Math.sin(s * Math.PI) * sag, pw.z + zOff);
    };
    for (const zOff of [-0.1, 0.1]) {
      const pts = [];
      for (let i = 0; i <= 24; i++) pts.push(lineAt(pw.x + (pe.x - pw.x) * (i / 24), zOff));
      const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.004, 4), lineMat);
      g.add(line);
    }
    // peças: lençol listrado, lençol de bolinhas, bandana (no vão da porta), toalhas
    const items = [
      { x0: -6.05, x1: -5.15, h: 0.86, kind: 'stripes', zOff: -0.1, stiff: 1.0 },
      { x0: -5.1, x1: -4.98, h: 0.0, kind: null },
      { x0: -4.62, x1: -4.42, h: 0.18, kind: 'bandana', zOff: 0.1, stiff: 2.0 },
      { x0: -3.8, x1: -3.32, h: 0.62, kind: 'towelY', zOff: 0.1, stiff: 1.3 },
      { x0: -3.24, x1: -2.88, h: 0.5, kind: 'towelT', zOff: -0.1, stiff: 1.4 },
      { x0: -5.95, x1: -5.45, h: 0.55, kind: 'dots', zOff: 0.1, stiff: 1.2 },
    ];
    const pinMats = [stdMat('#e8473a', { roughness: 0.5 }), stdMat('#3fa1e0', { roughness: 0.5 }), stdMat('#f2c230', { roughness: 0.5 })];
    const pinGeo = rbox(0.014, 0.07, 0.02, 0.004);
    let seed = 1;
    for (const it of items) {
      if (!it.kind) continue;
      const w = it.x1 - it.x0, xc = (it.x0 + it.x1) / 2;
      const top = lineAt(xc, it.zOff);
      const cl = makeCloth({ w, h: it.h, map: fabric(it.kind, seed++), seed: seed * 1.7, stiff: it.stiff });
      cl.position.set(xc, top.y + 0.01, top.z);
      // inclina acompanhando a barriga do fio
      const a = lineAt(it.x0, it.zOff), b = lineAt(it.x1, it.zOff);
      cl.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
      g.add(cl);
      clothes.push(cl);
      for (const px of [it.x0 + 0.03, it.x1 - 0.03, ...(w > 0.6 ? [xc] : [])]) {
        const p = lineAt(px, it.zOff);
        const pin = new THREE.Mesh(pinGeo, pinMats[(seed + Math.round(px * 10)) % 3]);
        pin.position.set(px, p.y - 0.01, p.z + 0.006);
        g.add(pin);
      }
    }
    // prendedores soltos no fio
    for (const px of [-4.85, -4.2, -4.05]) {
      const p = lineAt(px, 0.1);
      const pin = new THREE.Mesh(pinGeo, pinMats[Math.round(px * 7) % 3 < 0 ? 0 : Math.round(px * 7) % 3]);
      pin.position.set(px, p.y - 0.01, p.z + 0.006);
      g.add(pin);
    }
  }

  // ================================================================ samambaia no vaso
  {
    const c = col('vaso-samambaia', layout);
    const f = new THREE.Group();
    f.position.set(c.x, 0, c.z);
    const potM = terracottaMat('#c46a43');
    const pot = new THREE.Mesh(new THREE.LatheGeometry(potProfile(0.25, 0.4, { foot: 0.68, belly: 1.0 }), 24), potM);
    f.add(pot);
    const soil = new THREE.Mesh(soilDisc(0.22, 3), stdMat('#3a2a1e', { roughness: 1 }));
    soil.position.y = 0.36;
    f.add(soil);
    // frondes arqueadas com folíolos
    const parts = [];
    const r = rng(15);
    const NF = 26;
    for (let i = 0; i < NF; i++) {
      const a = (i / NF) * TAU + r() * 0.3;
      const L = 0.36 + r() * 0.16, rise = 0.18 + r() * 0.12, droop = 0.22 + r() * 0.14;
      const curve = (t) => new THREE.Vector3(Math.cos(a) * L * t, 0.36 + rise * Math.sin(t * Math.PI * 0.6) - droop * t * t, Math.sin(a) * L * t);
      const NS = 12;
      for (let s = 1; s < NS; s++) {
        const t = s / NS;
        const p = curve(t), p2 = curve(Math.min(1, t + 0.05));
        const tan = p2.clone().sub(p).normalize();
        const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
        const lw = 0.06 * Math.sin(t * Math.PI) + 0.012;
        for (const sd of [-1, 1]) {
          const leaf = new THREE.PlaneGeometry(lw, 0.022);
          leaf.translate(lw / 2, 0, 0);
          const m4 = new THREE.Matrix4();
          const xA = side.clone().multiplyScalar(sd), zA = tan.clone();
          const up = new THREE.Vector3().crossVectors(xA, zA).normalize();
          xA.y -= 0.35; xA.normalize(); // folíolos pendem um pouco
          m4.makeBasis(xA, zA, up);
          leaf.applyMatrix4(m4);
          leaf.translate(p.x, p.y - lw * 0.15, p.z);
          const cc = new THREE.Color('#4f8a2e').lerp(new THREE.Color('#8fbf4a'), t * 0.7 + r() * 0.2);
          leaf.deleteAttribute('uv');
          paint(leaf, cc);
          parts.push(leaf);
        }
      }
    }
    const fern = new THREE.Mesh(merge(parts), plantMat());
    fern.castShadow = true;
    f.add(fern);
    f.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(f);
    shadows.add(contactShadow(0.42, 0.42, 0.45).translateX(c.x).translateZ(c.z));
  }

  // ================================================================ pilha de tijolos
  {
    const c = col('tijolos', layout);
    const bg = new THREE.Group();
    bg.position.set(c.x, 0, c.z);
    const r = rng(33);
    const bw = 0.19, bh = 0.06, bd = 0.09;
    const bricks = [];
    const tints = ['#b5583a', '#a84e33', '#c0653f', '#9c4a31'];
    const brickMats = [new THREE.MeshStandardMaterial({ color: '#ffffff', map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 1.0, roughness: 0.92 })];
    const brickGeo = rbox(bw, bh, bd, 0.01);
    const im = new THREE.InstancedMesh(brickGeo, brickMats[0], 90);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const cc = new THREE.Color();
    let n = 0;
    for (let layer = 0; layer < 5; layer++) {
      const rotL = layer % 2 === 1;
      const nx = rotL ? 6 : 3, nz = rotL ? 2 : 5;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (layer === 4 && r() < 0.4) continue;
        const x = rotL ? -c.hx + 0.05 + i * ((c.hx * 2 - 0.1) / (nx - 1)) : -c.hx + 0.1 + i * 0.2;
        const z = rotL ? -c.hz + 0.11 + j * (c.hz * 2 - 0.22) : -c.hz + 0.055 + j * ((c.hz * 2 - 0.11) / (nz - 1));
        e.set(0, (rotL ? Math.PI / 2 : 0) + (r() - 0.5) * 0.05, 0); q.setFromEuler(e);
        pv.set(x + (r() - 0.5) * 0.01, bh / 2 + layer * (bh + 0.004), z + (r() - 0.5) * 0.01);
        m4.compose(pv, q, one);
        im.setMatrixAt(n, m4);
        im.setColorAt(n, cc.set(tints[Math.floor(r() * 4)]).multiplyScalar(1.6));
        n++;
      }
    }
    im.count = n;
    bg.add(im);
    // dois tijolos soltos encostados
    const loose = new THREE.Mesh(rbox(bw, bh, bd, 0.01), new THREE.MeshStandardMaterial({ color: '#b5583a', map: speckleTexture(), roughness: 0.9 }));
    loose.position.set(c.hx - 0.02, 0.06, c.hz - 0.02);
    loose.rotation.set(0, 0.6, 1.1);
    bg.add(loose);
    bg.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(bg);
    shadows.add(contactShadow(c.hx + 0.12, c.hz + 0.12, 0.5).translateX(c.x).translateZ(c.z));
  }

  // ================================================================ canteiro da bolinha (faixa leste)
  {
    const c = col('canteiro-bolinha', layout);
    const cb = new THREE.Group();
    const edgeM = new THREE.MeshStandardMaterial({ color: '#b07a5a', map: speckleTexture(), bumpMap: speckleTexture(), bumpScale: 0.8, roughness: 0.9 });
    const x0 = c.x - c.hx, x1 = c.x + c.hx, zf = c.z + c.hz;
    for (let x = x0 + 0.1; x < x1; x += 0.2) { const b = new THREE.Mesh(rbox(0.19, 0.16, 0.09, 0.025), edgeM); b.position.set(x, 0.08, zf - 0.045); cb.add(b); }
    for (let z = c.z - c.hz + 0.1; z < zf - 0.1; z += 0.2) { const b = new THREE.Mesh(rbox(0.09, 0.16, 0.19, 0.025), edgeM); b.position.set(x0 + 0.045, 0.08, z); cb.add(b); }
    const soil = new THREE.Mesh(new THREE.BoxGeometry(c.hx * 2 - 0.1, 0.13, c.hz * 2 - 0.1), stdMat('#3a2a1e', { roughness: 1 }));
    soil.position.set(c.x + 0.03, 0.065, c.z - 0.03);
    cb.add(soil);
    const plants = [
      [lavender({ seed: 51, height: 0.5, spread: 0.16 }), x0 + 0.25, c.z - 0.35],
      [geranium({ seed: 52, radius: 0.16, height: 0.2, flower: '#ff6a55' }), x0 + 0.28, c.z + 0.25],
      [smallFlowers({ seed: 53, radius: 0.14, height: 0.15, color: '#fff6ee' }), x0 + 0.62, c.z + 0.3],
      [geranium({ seed: 54, radius: 0.15, height: 0.2, flower: '#f25c7a' }), x0 + 0.65, c.z - 0.2],
      [lavender({ seed: 55, height: 0.55, spread: 0.15 }), x0 + 0.7, c.z - 0.45],
    ];
    for (const [geo, x, z] of plants) { const m = new THREE.Mesh(geo, plantMat()); m.position.set(x, 0.12, z); m.castShadow = true; cb.add(m); }
    cb.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) o.receiveShadow = true; });
    g.add(cb);
  }

  // ================================================================ detalhes extras (respeitando corredores)
  {
    // vasos junto à parede norte da zona C (z < -4.0)
    const potM = terracottaMat('#c46a43');
    for (const [x, rr, kind] of /** @type {[number, number, string | null][]} */ ([[2.25, 0.16, 'g'], [3.55, 0.14, 'f'], [5.85, 0.0, null]])) {
      if (!kind) continue;
      const pg = new THREE.Group();
      pg.position.set(x, 0, -4.6);
      pg.add(new THREE.Mesh(new THREE.LatheGeometry(potProfile(rr, rr * 1.5), 20), potM));
      const s = new THREE.Mesh(soilDisc(rr * 0.85, 4), stdMat('#3a2a1e', { roughness: 1 }));
      s.position.y = rr * 1.35;
      pg.add(s);
      const pl = new THREE.Mesh(kind === 'g' ? geranium({ seed: 61, radius: rr, height: 0.2 }) : smallFlowers({ seed: 62, radius: rr, height: 0.16, color: '#ffd04a' }), plantMat());
      pl.position.y = rr * 1.35;
      pg.add(pl);
      pg.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(pg);
      shadows.add(contactShadow(rr + 0.08, rr + 0.08, 0.5).translateX(x).translateZ(-4.6));
    }
    // vassoura encostada na parede (zona A, ao lado da porta, z < -4.0)
    const broom = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), woodMat('#d6a86a', { key: 'f2-broom' }));
    stick.position.y = 0.75;
    const head = new THREE.Mesh(rbox(0.26, 0.06, 0.05, 0.01), stdMat('#d83a3a', { roughness: 0.5 }));
    head.position.y = 0.08;
    const bristle = new THREE.Mesh(rbox(0.25, 0.07, 0.04, 0.005), stdMat('#3a3633', { roughness: 1 }));
    bristle.position.y = 0.035;
    broom.add(stick, head, bristle);
    broom.position.set(-3.75 - 0.15, 0, Z + 0.1);
    broom.rotation.set(-0.1, 0, 0.12);
    broom.position.x = -6.4;
    broom.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) o.castShadow = true; });
    g.add(broom);
    // balde azul ao lado da porta
    const bucket = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({ color: '#2f8fd8', roughness: 0.35, side: THREE.DoubleSide });
    bucket.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.28, 18, 1, true), bm));
    const bot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 18).rotateX(-Math.PI / 2), bm);
    bot.position.y = -0.13;
    bucket.add(bot);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 4, 16, Math.PI), stdMat('#3a3a3a'));
    handle.rotation.y = 0.3;
    handle.position.y = 0.14;
    bucket.add(handle);
    bucket.position.set(-5.05, 0.14, -4.55);
    bucket.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(bucket);
    shadows.add(contactShadow(0.2, 0.2, 0.5).translateX(-5.05).translateZ(-4.55));
    // tufos de capim alto no canto sudoeste e na faixa leste (fora dos corredores)
  }

  // gota pingando da torneira
  const tank = g.userData.tank;
  return {
    group: g, clothes,
    update(dt, t) {
      const d = tank?.userData.drop;
      if (d) {
        const cyc = (t * 0.7) % 1;
        const y = cyc < 0.6 ? d.top : d.top - ((cyc - 0.6) / 0.4) ** 2 * (d.top - d.bottom);
        d.drop.position.set(d.x, y, d.z);
        d.drop.scale.setScalar(cyc < 0.6 ? 0.4 + cyc : 1);
      }
    },
  };
}
