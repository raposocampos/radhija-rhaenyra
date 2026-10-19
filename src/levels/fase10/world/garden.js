// FASE 10 · Fundo do quintal, lado sul: a HORTA cercada (ripas baixas e rústicas; no oeste, o vão da tábua quebrada,
// com uma ripa pendurada torta e outra caída na grama), canteiros de alface e cenoura, o pé de tomate no tutor, os
// girassóis junto da cerca, o regador; e o GALPÃO de ferramentas em corte (tábuas verde-sálvia, a faixa do corte em
// cima), com a porta basculante (sobe girando pela dobradiça de cima e entra no galpão; o cabo da caixinha de força
// chega na roldana dela), a bancada com morsa e o painel de ferramentas, latas de tinta, a vassoura, a lâmpada
// pendurada, a rampa de tábua com travessinhas e a prateleira alta onde fica a vela.
// API: buildGarden(root, layout) → { group, door: { setOpen(t) }, bulbPos, seeThrough, update(dt, t) }
import * as THREE from 'three';
import { picketGeometry } from '../../../world/fence.js';
import { rng, rbox, canvasTexture, stdMat, woodMat, foliageCluster, contactShadow, mergeGeometries, brassMat, ironMat } from '../../../world/util.js';
import { plantMat, lettuce, carrotTops } from '../../../world/plants.js';

const TAU = Math.PI * 2;
const POCHE = '#3b2a20';

/** Tábuas verticais do galpão (verde-sálvia desbotado). */
function shedBoardTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    const r = rng(73);
    for (let x = 0; x < w; x += 21) {
      const t = 0.86 + r() * 0.18;
      g.fillStyle = `rgb(${(132 * t) | 0},${(164 * t) | 0},${(138 * t) | 0})`;
      g.fillRect(x, 0, 20, h);
      g.fillStyle = 'rgba(40,50,40,0.4)'; g.fillRect(x + 20, 0, 1, h);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (let k = 0; k < 6; k++) g.fillRect(x + r() * 18, r() * h, 1, 14 + r() * 20);
    }
  });
}
/** Painel de furinhos com as silhuetas das ferramentas. */
function pegboardTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#c8a070'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,40,20,0.55)';
    for (let y = 8; y < h; y += 12) for (let x = 8; x < w; x += 12) { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(40,30,20,0.25)';
    g.fillRect(30, 30, 10, 60); g.fillRect(20, 26, 30, 12); // martelo
    g.beginPath(); g.moveTo(80, 30); g.lineTo(130, 30); g.lineTo(130, 70); g.closePath(); g.fill(); // serrote
    g.fillRect(160, 30, 8, 64); g.beginPath(); g.arc(164, 28, 10, 0, TAU); g.fill(); // chave
    g.fillRect(200, 40, 34, 8); g.fillRect(212, 48, 8, 46); // pá de jardim
  }, { repeat: false });
}
/** Porta basculante: tábuas em diagonal com moldura. */
function doorTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#e8d2a8'; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4);
    for (let x = -100; x < 100; x += 14) { g.fillStyle = x % 28 ? '#dcc496' : '#e8d2a8'; g.fillRect(x, -100, 13, 200); }
    g.restore();
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.beginPath(); g.moveTo(5, 5); g.lineTo(w - 5, h - 5); g.stroke();
  }, { repeat: false });
}

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildGarden(root, layout) {
  const { HORTA, VEG_BEDS, SHED, STY, WORKBENCH, RAMP, CANDLE } = layout;
  const group = new THREE.Group();
  group.name = 'horta-e-galpao';
  const seeThrough = [];

  // ================================================================ cerca baixa da horta (rústica)
  const rustic = woodMat('#b08a5a', { key: 'f10-horta-ripa', rough: 0.85 });
  const postMat = woodMat('#8a6a42', { key: 'f10-horta-mourao', vertical: true, rough: 0.9 });
  const pk = picketGeometry(0.08, 0.9, 0.02);
  const fh = HORTA.fenceH;
  const pickets = [];
  const r = rng(39);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  /** Ripas de (x0, z0) a (x1, z1), viradas para fora da horta. */
  const run = (x0, z0, x1, z1, yaw) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 0.12));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (r() - 0.5) * 0.08));
      sc.set(1, (fh / 0.9) * (0.9 + r() * 0.2), 1);
      m4.compose(pv.set(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t), q, sc);
      pickets.push(m4.clone());
    }
  };
  run(HORTA.x0, HORTA.z0, HORTA.x1, HORTA.z0, Math.PI); // norte (face para fora = −Z)
  run(HORTA.x0, HORTA.z0, HORTA.x0, HORTA.gap.z0, -Math.PI / 2); // oeste, até o vão
  run(HORTA.x0, HORTA.gap.z1, HORTA.x0, HORTA.z1 + 0.2, -Math.PI / 2);
  run(HORTA.x1, HORTA.z0, HORTA.x1, SHED.z0, Math.PI / 2);
  run(HORTA.x1, SHED.z1, HORTA.x1, STY.z0, Math.PI / 2);
  const pkMesh = new THREE.InstancedMesh(pk, rustic, pickets.length);
  pickets.forEach((m, i) => pkMesh.setMatrixAt(i, m));
  pkMesh.castShadow = true;
  pkMesh.receiveShadow = true;
  group.add(pkMesh);
  // travessa e mourões
  const rails = [];
  for (const [x0, z0, x1, z1] of [[HORTA.x0, HORTA.z0, HORTA.x1, HORTA.z0], [HORTA.x0, HORTA.z0, HORTA.x0, HORTA.gap.z0], [HORTA.x0, HORTA.gap.z1, HORTA.x0, HORTA.z1 + 0.2], [HORTA.x1, HORTA.z0, HORTA.x1, SHED.z0], [HORTA.x1, SHED.z1, HORTA.x1, STY.z0]]) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.BoxGeometry(0.035, 0.05, len);
    g.rotateY(Math.atan2(x1 - x0, z1 - z0));
    g.translate((x0 + x1) / 2 + (x0 === x1 ? 0.03 : 0), fh * 0.6, (z0 + z1) / 2 + (z0 === z1 ? 0.03 : 0));
    rails.push(g);
  }
  const railMesh = new THREE.Mesh(mergeGeometries(rails), postMat);
  railMesh.castShadow = true;
  group.add(railMesh);
  for (const [x, z] of [[HORTA.x0, HORTA.z0], [HORTA.x1, HORTA.z0], [HORTA.x0, HORTA.gap.z0 - 0.03], [HORTA.x0, HORTA.gap.z1 + 0.03], [HORTA.x0, 3.2], [HORTA.x0, 5.0], [(HORTA.x0 + HORTA.x1) / 2, HORTA.z0]]) {
    const p = new THREE.Mesh(rbox(0.07, fh + 0.1, 0.07, 0.01), postMat);
    p.position.set(x, (fh + 0.1) / 2, z);
    p.castShadow = true;
    group.add(p);
  }
  // o vão: uma ripa pendurada torta num prego e outra caída na grama
  const hanging = new THREE.Mesh(pk, rustic);
  hanging.scale.y = fh / 0.9;
  hanging.position.set(HORTA.x0 - 0.05, fh * 0.6 + 0.02, HORTA.gap.z0 + 0.05);
  hanging.rotation.set(0, -Math.PI / 2, 2.6);
  hanging.castShadow = true;
  const fallen = new THREE.Mesh(pk, rustic);
  fallen.scale.y = fh / 0.9;
  fallen.position.set(HORTA.x0 - 0.35, 0.015, HORTA.gap.z1 + 0.15);
  fallen.rotation.set(-Math.PI / 2, 0, 0.9);
  fallen.castShadow = true;
  const nail = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), ironMat());
  nail.position.set(HORTA.x0 - 0.03, fh * 0.6 + 0.03, HORTA.gap.z0 - 0.02);
  group.add(hanging, fallen, nail);

  // ================================================================ canteiros, tomateiro, girassóis e o regador
  const bedWood = woodMat('#7a5234', { key: 'f10-canteiro-horta' });
  VEG_BEDS.forEach((b, i) => {
    const bed = new THREE.Group();
    const H = 0.22;
    for (const [x, z, w, d] of [[0, -b.hz, b.hx * 2 + 0.05, 0.05], [0, b.hz, b.hx * 2 + 0.05, 0.05], [-b.hx, 0, 0.05, b.hz * 2], [b.hx, 0, 0.05, b.hz * 2]]) {
      const e = new THREE.Mesh(rbox(w, H, d, 0.008), bedWood);
      e.position.set(x, H / 2, z);
      bed.add(e);
    }
    const soil = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 - 0.04, 0.02, b.hz * 2 - 0.04), stdMat('#4a3322', { roughness: 1 }));
    soil.position.y = H - 0.03;
    bed.add(soil);
    const n = Math.round(b.hx * 2 / 0.22);
    for (let k = 0; k < n; k++) {
      const x = -b.hx + 0.12 + k * ((b.hx * 2 - 0.24) / Math.max(1, n - 1));
      const plant = i % 2 === 0 ? new THREE.Mesh(lettuce({ r: 0.1, seed: 80 + 7 * i + k }), plantMat()) : new THREE.Mesh(carrotTops({ seed: 90 + k, height: 0.2 }), plantMat());
      plant.position.set(x, H - 0.02, (k % 2 ? 0.05 : -0.05));
      bed.add(plant);
    }
    bed.position.set(b.x, 0, b.z);
    bed.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(bed);
  });
  // tomateiro no tutor (perto da cerca norte, longe do caminho)
  const tomato = new THREE.Group();
  const stakeMat = woodMat('#c8a070', { key: 'f10-tutor', vertical: true });
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), stakeMat);
    st.position.set(s * 0.12, 0.45, 0);
    st.rotation.z = s * 0.12;
    tomato.add(st);
  }
  const vine = new THREE.Mesh(foliageCluster([{ x: 0, y: 0.35, z: 0, r: 0.2, sy: 1.6 }, { x: 0.05, y: 0.65, z: 0.03, r: 0.14 }], { seed: 77, dark: '#2c5226', mid: '#4a7f36', light: '#86b850', amp: 0.4 }), plantMat());
  tomato.add(vine);
  const tomG = new THREE.SphereGeometry(0.035, 10, 8);
  for (let k = 0; k < 7; k++) {
    const t = new THREE.Mesh(tomG, new THREE.MeshPhysicalMaterial({ color: k % 3 ? '#e8402a' : '#f08a2a', roughness: 0.3, clearcoat: 0.8 }));
    t.position.set((r() - 0.5) * 0.25, 0.25 + r() * 0.5, 0.12 + (r() - 0.5) * 0.1);
    tomato.add(t);
  }
  tomato.position.set(layout.TOMATO.x, 0, layout.TOMATO.z);
  tomato.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(tomato);
  // girassóis junto da cerca norte da horta (do lado de fora, altos)
  const sunflower = (x, z, h, seed) => {
    const f = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, h, 6), stdMat('#5d8a2a', { roughness: 0.8 }));
    stem.position.y = h / 2;
    f.add(stem);
    for (const [y, s] of [[h * 0.4, 1], [h * 0.65, -1]]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), stdMat('#5d8a2a', { roughness: 0.8 }));
      leaf.scale.set(1, 0.2, 0.55);
      leaf.position.set(s * 0.07, y, 0);
      leaf.rotation.z = s * 0.4;
      f.add(leaf);
    }
    const head = new THREE.Group();
    const petals = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU;
      const g = new THREE.SphereGeometry(0.04, 6, 4);
      g.scale(0.5, 1.4, 0.15);
      g.translate(0, 0.08, 0);
      g.rotateZ(a);
      petals.push(g);
    }
    const pm = new THREE.Mesh(mergeGeometries(petals), stdMat('#ffc62a', { roughness: 0.6 }));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16).rotateX(Math.PI / 2), stdMat('#5a3a1a', { roughness: 0.9 }));
    disc.position.z = 0.01;
    head.add(pm, disc);
    head.position.y = h;
    head.rotation.set(-0.15, (rng(seed)() - 0.5) * 0.6, 0);
    f.add(head);
    f.position.set(x, 0, z);
    f.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
    group.add(f);
    return head;
  };
  const heads = [sunflower(7.1, HORTA.z0 - 0.18, 1.1, 1), sunflower(7.6, HORTA.z0 - 0.22, 1.25, 2), sunflower(8.85, HORTA.z0 - 0.18, 1.0, 3)];
  // regador azul encostado no canteiro
  const can = new THREE.Group();
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.18, 16), stdMat('#5a8fc0', { roughness: 0.4, metalness: 0.3 }));
  canBody.position.y = 0.09;
  const canSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.22, 8), canBody.material);
  canSpout.position.set(0.14, 0.13, 0);
  canSpout.rotation.z = -1.0;
  const canHandle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 12, Math.PI), canBody.material);
  canHandle.position.set(-0.02, 0.18, 0);
  can.add(canBody, canSpout, canHandle);
  can.position.set(layout.WATERING_CAN.x, 0, layout.WATERING_CAN.z);
  can.rotation.y = 0.6;
  can.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  group.add(can);

  // ================================================================ galpão
  const shed = new THREE.Group();
  shed.name = 'galpao';
  const bTex = shedBoardTexture();
  const shedMat = (w, h) => {
    const t = bTex.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 1.3, h / 0.9);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  };
  const inside = stdMat('#d8c8a8', { roughness: 0.9 });
  const T = SHED.t, H = SHED.wallH;
  const wall = (x, z, w, d, h = H, y0 = 0) => {
    const len = Math.max(w, d);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), shedMat(len, h));
    m.position.set(x, y0 + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    shed.add(m);
    const p = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 0.02, d + 0.004), stdMat(POCHE, { roughness: 0.95 }));
    p.position.set(x, y0 + h + 0.01, z);
    shed.add(p);
    return m;
  };
  wall((SHED.x0 + SHED.x1) / 2, SHED.z0, SHED.x1 - SHED.x0 + T, T);
  wall((SHED.x0 + SHED.x1) / 2, SHED.z1, SHED.x1 - SHED.x0 + T, T, 0.62); // a parede da frente (sul) é baixa: o corte mostra a rampa
  // leste e oeste entre as paredes do norte e do sul (as pontas não ficam no mesmo plano delas)
  const zA = SHED.z0 + T / 2, zB = SHED.z1 - T / 2;
  wall(SHED.x1, (zA + zB) / 2, T, zB - zA);
  wall(SHED.x0, (zA + SHED.door.z0) / 2, T, SHED.door.z0 - zA);
  wall(SHED.x0, (SHED.door.z1 + zB) / 2, T, zB - SHED.door.z1);
  wall(SHED.x0, (SHED.door.z0 + SHED.door.z1) / 2, T, SHED.door.z1 - SHED.door.z0, H - SHED.door.h, SHED.door.h);
  // batente da porta
  const jambMat = woodMat('#8a5a3c', { key: 'f10-galpao-batente', vertical: true });
  for (const z of [SHED.door.z0, SHED.door.z1]) {
    const j = new THREE.Mesh(rbox(T + 0.04, SHED.door.h, 0.05, 0.01), jambMat);
    j.position.set(SHED.x0, SHED.door.h / 2, z + (z === SHED.door.z0 ? 0.025 : -0.025));
    j.castShadow = true;
    shed.add(j);
  }
  // plaquinha "Ferramentas" em cima da porta
  const signM = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.14), new THREE.MeshStandardMaterial({ map: canvasTexture(256, 60, (g, w, h) => {
    g.fillStyle = '#f6e3b0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5a3a2a'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#5a3a2a'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Ferramentas', w / 2, h / 2 + 1);
  }, { repeat: false }), roughness: 0.8 }));
  signM.position.set(SHED.x0 - T / 2 - 0.006, SHED.door.h + 0.1, (SHED.door.z0 + SHED.door.z1) / 2);
  signM.rotation.y = -Math.PI / 2;
  shed.add(signM);
  // janela na parede leste (pôr do sol do outro lado)
  const winM = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), new THREE.MeshBasicMaterial({ color: '#f2a46a' }));
  winM.position.set(SHED.x1 - T / 2 - 0.004, 1.05, 1.6);
  winM.rotation.y = -Math.PI / 2;
  shed.add(winM);
  for (const [w, h, dy, dz] of [[0.66, 0.04, 0.22, 0], [0.66, 0.04, -0.22, 0], [0.04, 0.44, 0, 0.32], [0.04, 0.44, 0, -0.32], [0.03, 0.4, 0, 0]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, w === 0.04 ? 0.04 : w), stdMat('#fffaf0', { roughness: 0.6 }));
    f.position.set(SHED.x1 - T / 2 - 0.012, 1.05 + dy, 1.6 + dz);
    shed.add(f);
  }

  // ---------------- bancada com morsa, vasinhos, pacotes de sementes e o painel de ferramentas
  const bench = new THREE.Group();
  const bTop = new THREE.Mesh(rbox(WORKBENCH.hx * 2, 0.06, WORKBENCH.hz * 2, 0.01), woodMat('#c79a62', { key: 'f10-bancada' }));
  bTop.position.y = WORKBENCH.h - 0.03;
  bench.add(bTop);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(rbox(0.06, WORKBENCH.h - 0.06, 0.06, 0.008), woodMat('#8a5a3c', { key: 'f10-bancada-perna', vertical: true }));
    leg.position.set(sx * (WORKBENCH.hx - 0.06), (WORKBENCH.h - 0.06) / 2, sz * (WORKBENCH.hz - 0.05));
    bench.add(leg);
  }
  const lower = new THREE.Mesh(rbox(WORKBENCH.hx * 2 - 0.1, 0.03, WORKBENCH.hz * 2 - 0.06, 0.006), woodMat('#c79a62', { key: 'f10-bancada' }));
  lower.position.y = 0.22;
  bench.add(lower);
  const vise = new THREE.Mesh(rbox(0.14, 0.1, 0.1, 0.01), stdMat('#3a6a8a', { metalness: 0.6, roughness: 0.4 }));
  vise.position.set(WORKBENCH.hx - 0.2, WORKBENCH.h + 0.05, WORKBENCH.hz - 0.06);
  bench.add(vise);
  for (let k = 0; k < 3; k++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 12), stdMat('#c96b5a', { roughness: 0.85 }));
    pot.position.set(-WORKBENCH.hx + 0.2 + k * 0.13, WORKBENCH.h + 0.04, 0);
    bench.add(pot);
  }
  for (let k = 0; k < 3; k++) {
    const pk2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.01), stdMat(['#f6c453', '#9bd57a', '#f27a8a'][k], { roughness: 0.7 }));
    pk2.position.set(-0.1 + k * 0.09, WORKBENCH.h + 0.05, -0.05);
    pk2.rotation.set(-0.2, (k - 1) * 0.2, 0);
    bench.add(pk2);
  }
  // potes de tinta embaixo
  for (let k = 0; k < 3; k++) {
    const pc = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 14), stdMat(['#e8554a', '#7cc4e8', '#f4f1ea'][k], { roughness: 0.4, metalness: 0.4 }));
    pc.position.set(0.25 + k * 0.17, 0.3, 0);
    bench.add(pc);
  }
  bench.position.set(WORKBENCH.x, 0, WORKBENCH.z);
  bench.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  shed.add(bench);
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshStandardMaterial({ map: pegboardTexture(), roughness: 0.85 }));
  peg.position.set(WORKBENCH.x, 1.18, SHED.z0 + T / 2 + 0.006);
  shed.add(peg);
  // ferramentas penduradas: martelo, serrote, chave, pazinha
  const tools = new THREE.Group();
  const hammer = new THREE.Group();
  const hH = new THREE.Mesh(rbox(0.1, 0.035, 0.035, 0.006), ironMat());
  hH.position.y = 0.11;
  const hS = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.22, 8), woodMat('#c79a62', { key: 'f10-cabo' }));
  hammer.add(hH, hS);
  hammer.position.set(-0.6, 1.12, 0.03);
  const saw = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.32, 0, 0), new THREE.Vector3(0.32, 0.12, 0)]), stdMat('#c8ccd0', { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  saw.geometry.setIndex([0, 1, 2]);
  saw.geometry.computeVertexNormals();
  saw.position.set(-0.32, 1.1, 0.02);
  const wrench = new THREE.Mesh(rbox(0.025, 0.24, 0.01, 0.005), ironMat());
  wrench.position.set(0.18, 1.18, 0.02);
  const trowel = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12, Math.PI, Math.PI), stdMat('#c8ccd0', { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  trowel.position.set(0.55, 1.12, 0.02);
  tools.add(hammer, saw, wrench, trowel);
  tools.position.set(WORKBENCH.x, 0, SHED.z0 + T / 2 + 0.01);
  tools.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  shed.add(tools);
  // vassoura encostada no canto
  const broom = new THREE.Group();
  const bStick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 6), woodMat('#c79a62', { key: 'f10-cabo' }));
  bStick.position.y = 0.7;
  const bHead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 10), stdMat('#d8b060', { roughness: 1 }));
  bHead.position.y = 0.11;
  broom.add(bStick, bHead);
  broom.position.set(SHED.x1 - 0.16, 0, SHED.z0 + 0.95);
  broom.rotation.z = 0.12;
  broom.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  shed.add(broom);
  // lâmpada pendurada (o ponto de luz do galpão)
  const bulbPos = new THREE.Vector3((SHED.x0 + SHED.x1) / 2 + 0.2, 1.75, 2.0);
  const bulbCord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), stdMat('#2d2a28'));
  bulbCord.position.set(bulbPos.x, bulbPos.y + 0.27, bulbPos.z);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff0c8' }));
  bulb.position.copy(bulbPos);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.08, 16, 1, true), stdMat('#3a6a8a', { side: THREE.DoubleSide, metalness: 0.4 }));
  shade.position.set(bulbPos.x, bulbPos.y + 0.05, bulbPos.z);
  shed.add(bulbCord, bulb, shade);
  // trave por cima (segura a lâmpada)
  const joist = new THREE.Mesh(rbox(0.08, 0.08, SHED.z1 - SHED.z0 + 0.1, 0.01), woodMat('#8a5a3c', { key: 'f10-galpao-trave' }));
  joist.position.set(bulbPos.x, 2.06, (SHED.z0 + SHED.z1) / 2);
  joist.castShadow = true;
  const joistPosts = [SHED.z0, SHED.z1].map((z) => {
    const jp = new THREE.Mesh(rbox(0.07, 2.06 - H, 0.07, 0.01), woodMat('#8a5a3c', { key: 'f10-galpao-trave' }));
    jp.position.set(bulbPos.x, H + (2.06 - H) / 2, z);
    return jp;
  });
  shed.add(joist, ...joistPosts);

  // ---------------- rampa de tábua (com travessinhas) e a prateleira alta da vela
  const rampLen = Math.hypot(RAMP.x1 - RAMP.x0, RAMP.top);
  const rampAng = Math.atan2(RAMP.top, RAMP.x1 - RAMP.x0);
  const plank = new THREE.Group();
  const board = new THREE.Mesh(rbox(rampLen, 0.04, RAMP.halfWidth * 2, 0.01), woodMat('#d8b080', { key: 'f10-rampa' }));
  plank.add(board);
  for (let k = 1; k < 7; k++) {
    const cleat = new THREE.Mesh(rbox(0.025, 0.02, RAMP.halfWidth * 2 - 0.04, 0.005), woodMat('#a07040', { key: 'f10-rampa-trava' }));
    cleat.position.set(-rampLen / 2 + k * (rampLen / 7), 0.03, 0);
    plank.add(cleat);
  }
  plank.position.set((RAMP.x0 + RAMP.x1) / 2, RAMP.top / 2 + 0.01, RAMP.z);
  plank.rotation.z = rampAng;
  plank.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  shed.add(plank);
  const shelf = new THREE.Group();
  const sw = SHED.x1 - T / 2 - RAMP.x1;
  const sBoard = new THREE.Mesh(rbox(sw + 0.06, 0.04, 0.5, 0.01), woodMat('#c79a62', { key: 'f10-prateleira' }));
  sBoard.position.set(RAMP.x1 + sw / 2 - 0.03, RAMP.top - 0.02, RAMP.z);
  shelf.add(sBoard);
  for (const x of [RAMP.x1 + 0.08, SHED.x1 - T / 2 - 0.08]) {
    const leg = new THREE.Mesh(rbox(0.05, RAMP.top - 0.03, 0.05, 0.008), woodMat('#8a5a3c', { key: 'f10-galpao-trave' }));
    leg.position.set(x, (RAMP.top - 0.03) / 2, RAMP.z - 0.2); // o topo entra 1 cm na tábua
    shelf.add(leg);
  }
  // caixas e um vaso velho embaixo da prateleira
  const boxU = new THREE.Mesh(rbox(0.3, 0.26, 0.3, 0.01), woodMat('#b08a5a', { key: 'f10-caixa' }));
  boxU.position.set(RAMP.x1 + 0.3, 0.13, RAMP.z + 0.02);
  shelf.add(boxU);
  shelf.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  shed.add(shelf);
  void CANDLE;
  group.add(shed);
  seeThrough.push(shed);

  // ================================================================ porta basculante (dobradiça em cima; abre girando para dentro)
  const dH = SHED.door.h, dW = SHED.door.z1 - SHED.door.z0;
  const door = new THREE.Group();
  door.name = 'porta-basculante';
  const panel = new THREE.Mesh(rbox(0.05, dH - 0.04, dW - 0.06, 0.01), [
    new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.8 }), new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.8 }),
    jambMat, jambMat, jambMat, jambMat,
  ]);
  panel.position.y = -(dH - 0.04) / 2 - 0.02;
  panel.castShadow = true;
  panel.receiveShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), brassMat());
  knob.position.set(-0.04, -dH + 0.2, 0);
  door.add(panel, knob);
  door.position.set(SHED.x0, dH, (SHED.door.z0 + SHED.door.z1) / 2);
  group.add(door);

  // ================================================================ a roldana da porta (o cabo vem da caixinha de força, sty.js)
  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 14).rotateZ(Math.PI / 2), stdMat('#c9483c', { roughness: 0.5 }));
  pulley.position.set(SHED.x0 - T / 2 - 0.03, SHED.door.h + 0.06, SHED.door.z1 - 0.14);
  group.add(pulley);

  const st = { open: 0 };
  root.add(group);
  return {
    group, bulbPos, seeThrough,
    door: {
      object: door,
      setOpen(t) {
        st.open = t;
        // sobe girando pela dobradiça de cima, entrando no galpão (para o leste)
        door.rotation.z = (t * t * (3 - 2 * t)) * (Math.PI / 2) * 0.96;
        pulley.rotation.x = t * 6;
      },
    },
    update(dt, t) {
      heads.forEach((h, i) => { h.rotation.z = Math.sin(t * 0.8 + i) * 0.06; });
    },
  };
}
