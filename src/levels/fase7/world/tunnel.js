// FASE 7 · Morrinho de grama com o túnel de manilha (concreto) atravessando de oeste para leste. O fundo da
// manilha guarda a lama da chuva (brilhante, com bolotas e respingos nas paredes); as bocas têm a bolsa da
// manilha e pedrinhas em volta. A Radhija passa abaixada; a Rhaenyra não cabe (os batentes do layout).
import * as THREE from 'three';
import { rng, vnoise2, fbm2, smoothstep, paint, plasterTexture, mat, contactShadow, canvasTexture } from '../../../world/util.js';
import { smallFlowers, plantMat } from '../../../world/plants.js';

/** Concreto da manilha: cinza claro com manchas escuras de umidade embaixo. */
function concreteTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm2(x / 22, y / 22, 4);
      const pits = vnoise2(x * 0.9, y * 0.9) > 0.86 ? -26 : 0;
      const v = 168 + n * 50 + pits;
      const k = (y * w + x) * 4;
      img.data[k] = v; img.data[k + 1] = v * 0.98; img.data[k + 2] = v * 0.93; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

/** Terreno do morrinho: retângulo de cantos arredondados que sobe em domo até `height`. */
function moundGeometry(M) {
  const ex = 0.32; // a grama desce um pouco além do retângulo
  const geo = new THREE.PlaneGeometry((M.hx + ex) * 2, (M.hz + ex) * 2, 46, 56).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    // distância "arredondada" ao retângulo interno (0 dentro do núcleo, cresce para fora)
    const qx = Math.max(Math.abs(x) - (M.hx - M.corner), 0), qz = Math.max(Math.abs(z) - (M.hz - M.corner), 0);
    const d = Math.hypot(qx, qz) / (M.corner + ex); // 0 no núcleo … 1 na borda da grama
    const core = 1 - smoothstep(0, 1, d);
    // domo suave: mais alto no meio, com ondulação de terreno
    const dome = 1 - 0.18 * ((x / M.hx) ** 2 + (z / M.hz) ** 2);
    const bump = (fbm2(x * 2.2 + 3, z * 2.2, 3) - 0.5) * 0.08;
    const y = Math.max(0, M.height * core * dome + bump * core) - 0.01;
    p.setY(i, y);
  }
  geo.computeVertexNormals();
  const dark = new THREE.Color('#3f6a2a'), mid = new THREE.Color('#5f8c38'), light = new THREE.Color('#93b551'), soil = new THREE.Color('#5b4732');
  const c = new THREE.Color();
  paint(geo, (pos, n) => {
    const t = Math.min(1, pos.y / M.height);
    const sun = Math.max(0, n.x * 0.55 + n.y * 0.7 + n.z * 0.35);
    c.copy(dark).lerp(mid, smoothstep(0.1, 0.5, t + sun * 0.3)).lerp(light, smoothstep(0.55, 1.0, sun) * 0.6);
    c.multiplyScalar(0.9 + vnoise2(pos.x * 9, pos.z * 9) * 0.2);
    // pé do morrinho mais escuro (terra molhada)
    c.lerp(soil, (1 - smoothstep(0.0, 0.08, pos.y)) * 0.45);
    return c;
  });
  return geo;
}

/** Tubo (cilindro aberto) ao longo de X, do x0 ao x1, com raio r. inner: normais para dentro. */
function tubeX(r, x0, x1, inner, radial = 32) {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, radial, 6, true);
  if (inner) {
    // vira as faces para dentro
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
    g.computeVertexNormals();
  }
  g.rotateZ(Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
}

/** Lama no fundo da manilha: faixa que acompanha a curva do tubo, com bolotas e borda irregular. */
function mudGeometry(T, x0, x1) {
  const nx = 60, nz = 14;
  const half = 0.2;
  const geo = new THREE.PlaneGeometry(x1 - x0, half * 2, nx, nz).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const wx = x + (x0 + x1) / 2;
    // borda irregular: aperta a faixa nas pontas e em ondas
    const edge = half * (0.75 + 0.25 * vnoise2(wx * 4, 1.3)) * Math.min(1, (Math.min(wx - x0, x1 - wx) / 0.25) + 0.35);
    const zz = Math.max(-edge, Math.min(edge, z));
    // a superfície acompanha o fundo curvo do tubo, um pouco acima
    const wall = T.r - Math.sqrt(Math.max(0, T.r * T.r - zz * zz));
    const lump = (fbm2(wx * 7, zz * 7 + 2, 3) - 0.45) * 0.03 + Math.max(0, vnoise2(wx * 14, zz * 14) - 0.7) * 0.05;
    p.setXYZ(i, x, wall + 0.022 + lump, zz);
  }
  geo.computeVertexNormals();
  geo.translate((x0 + x1) / 2, 0, T.z);
  return geo;
}

/** @param {THREE.Group} root @param {import('../../../types').LevelLayout} layout */
export function buildTunnel(root, layout) {
  const M = layout.MOUND, T = layout.TUNNEL;
  const group = new THREE.Group();
  group.name = 'morrinho-tunel';
  // morrinho
  const moundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const mound = new THREE.Mesh(moundGeometry(M), moundMat);
  mound.position.set(M.x, 0, M.z);
  mound.receiveShadow = true;
  mound.castShadow = true;
  mound.name = 'morrinho';
  group.add(mound);
  // flores e tufos em cima do morrinho
  const r = rng(13);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = 0.25 + r() * 0.45;
    const fx = M.x + Math.cos(a) * d * M.hx, fz = M.z + Math.sin(a) * d * M.hz;
    if (Math.abs(fz - T.z) < 0.42) continue;
    const qx = Math.max(Math.abs(fx - M.x) - (M.hx - M.corner), 0), qz = Math.max(Math.abs(fz - M.z) - (M.hz - M.corner), 0);
    const core = 1 - smoothstep(0, 1, Math.hypot(qx, qz) / (M.corner + 0.32));
    const fy = M.height * core * (1 - 0.18 * (((fx - M.x) / M.hx) ** 2 + ((fz - M.z) / M.hz) ** 2)) - 0.02;
    const fl = new THREE.Mesh(smallFlowers({ count: 14, radius: 0.1, height: 0.1, color: ['#fff6ee', '#ffd65a', '#f6a6c1'][i % 3], seed: 30 + i }), plantMat());
    fl.position.set(fx, fy, fz);
    group.add(fl);
  }
  // manilha (concreto) com a bolsa nas duas bocas
  const conc = mat('f7-concrete', () => new THREE.MeshStandardMaterial({ color: '#d8d4cb', map: concreteTexture(), roughness: 0.88, bumpMap: plasterTexture(), bumpScale: 0.8 }));
  const concIn = mat('f7-concrete-in', () => new THREE.MeshStandardMaterial({ color: '#8f8b82', map: concreteTexture(), roughness: 0.75, side: THREE.FrontSide }));
  const outerR = T.r + T.wall;
  const pipe = new THREE.Group();
  pipe.name = 'manilha';
  pipe.position.set(0, T.r, T.z);
  const outer = new THREE.Mesh(tubeX(outerR, T.x0, T.x1, false), conc);
  const inner = new THREE.Mesh(tubeX(T.r, T.x0 + 0.002, T.x1 - 0.002, true), concIn);
  pipe.add(outer, inner);
  for (const [x, dir] of [[T.x0, 1], [T.x1, -1]]) {
    // bolsa: anel mais grosso na boca; aro de concreto fecha a parede
    const bell = new THREE.Mesh(tubeX(outerR + 0.035, x - (dir > 0 ? 0 : 0.11), x + (dir > 0 ? 0.11 : 0), false), conc);
    const lip = new THREE.Mesh(new THREE.RingGeometry(T.r, outerR + 0.035, 36, 1), conc);
    lip.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    lip.position.x = x - dir * 0.001;
    pipe.add(bell, lip);
  }
  pipe.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(pipe);
  // lama no fundo
  const mudMat = new THREE.MeshPhysicalMaterial({ color: '#4a3020', roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.15, metalness: 0 });
  const mud = new THREE.Mesh(mudGeometry(T, T.x0 + 0.12, T.x1 - 0.12), mudMat);
  mud.receiveShadow = true;
  mud.name = 'lama';
  group.add(mud);
  // respingos de lama nas paredes de dentro (decalques escuros)
  const splatMat = new THREE.MeshStandardMaterial({ color: '#3d2a1c', roughness: 0.35, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) {
    const x = T.x0 + 0.2 + r() * (T.x1 - T.x0 - 0.4);
    const a = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7); // ângulo a partir do fundo
    const s = 0.03 + r() * 0.05;
    const splat = new THREE.Mesh(new THREE.CircleGeometry(s, 9), splatMat);
    const rr = T.r - 0.004;
    splat.position.set(x, T.r - Math.cos(a) * rr, T.z + Math.sin(a) * rr);
    splat.lookAt(x, T.r, T.z);
    splat.scale.set(1, 0.6 + r() * 0.6, 1);
    group.add(splat);
  }
  // pedrinhas em volta das bocas
  const stoneMat = mat('f7-stone', () => new THREE.MeshStandardMaterial({ color: '#9b958a', roughness: 0.85 }));
  for (const [x, dir] of [[T.x0 - 0.05, -1], [T.x1 + 0.05, 1]]) {
    for (let i = 0; i < 7; i++) {
      const a = -1.2 + (i / 6) * 2.4;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.045 + r() * 0.04, 0), stoneMat);
      st.position.set(x + dir * (0.04 + r() * 0.08), 0.015, T.z + Math.sin(a) * (outerR + 0.12) + (r() - 0.5) * 0.05);
      st.scale.y = 0.55;
      st.rotation.set(r(), r() * 3, r());
      st.castShadow = true;
      st.receiveShadow = true;
      group.add(st);
    }
    const sh = contactShadow(0.22, outerR + 0.1, 0.4);
    sh.position.set(x + dir * 0.02, 0.006, T.z);
    group.add(sh);
  }
  root.add(group);
  return { group, seeThrough: [mound, pipe], mud };
}
