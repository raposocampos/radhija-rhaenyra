// FASE 10 · O chiqueiro ao sul do galpão: cerca de tábuas largas (os porcos não pulam), a porteira para a horta (abre
// girando para fora), o chão de barro (manchas molhadas que brilham, marcas de casco, palha) com a poça de lama, a
// casinha dos porcos com telhado de zinco, o cocho de madeira com lavagem e a placa "Chiqueiro". Na faixa de grama ao
// lado da cerca branca, o painel de madeira grande dos dois botões altos (de costas para a cerca, com a luz de força) e
// o gerador pequeno que dá força a ele (partida de cordinha); na parede do galpão, a caixinha de força onde os fios dos
// botões se juntam, com um cabo para a roldana da porta e outro, pelo chão, até a trava da porteira (qual botão vai
// para onde é sorteado).
// API: buildSty(root, layout) → { group, gate: GateProp (setOpen 0..1), links: { door, gate } (pulso), seeThrough,
//   generator: { object, setPull(k), setState(s), state }, update(dt) }
import * as THREE from 'three';
import { rng, rbox, canvasTexture, stdMat, woodMat, contactShadow, mergeGeometries, rippleNormalTexture } from '../../../world/util.js';
import { makeLink } from '../../../world/links.js';

/** Desenha `fn(x, y)` também nas cópias do outro lado das bordas (textura que se repete sem emenda). */
function wrapDraw(w, h, x, y, rad, fn) {
  for (const ox of [-w, 0, w]) {
    for (const oy of [-h, 0, h]) {
      if (x + ox < -rad || x + ox > w + rad || y + oy < -rad || y + oy > h + rad) continue;
      fn(x + ox, y + oy);
    }
  }
}
/**
 * O barro do chiqueiro (cor e aspereza juntas, da mesma semente): marrom molhado com manchas mais escuras e
 * brilhantes (aspereza baixa), marcas de casco de porquinho, palha espalhada e torrões.
 */
function barroTextures() {
  const blobs = [];
  const r = rng(91);
  for (let k = 0; k < 70; k++) blobs.push({ x: r() * 256, y: r() * 256, rad: 10 + r() * 30, wet: r() < 0.45 });
  const hoofs = [];
  for (let k = 0; k < 26; k++) hoofs.push({ x: r() * 256, y: r() * 256, a: r() * Math.PI * 2 });
  const straws = [];
  for (let k = 0; k < 55; k++) straws.push({ x: r() * 256, y: r() * 256, a: r() * Math.PI, l: 6 + r() * 10 });
  const map = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#6a4528'; g.fillRect(0, 0, w, h);
    for (const b of blobs) {
      wrapDraw(w, h, b.x, b.y, b.rad, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, b.rad);
        gr.addColorStop(0, b.wet ? 'rgba(40,24,12,0.75)' : 'rgba(140,100,62,0.45)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(px - b.rad, py - b.rad, b.rad * 2, b.rad * 2);
      });
    }
    // marcas de casco (dois gomos fundos)
    for (const f of hoofs) {
      wrapDraw(w, h, f.x, f.y, 10, (px, py) => {
        g.save(); g.translate(px, py); g.rotate(f.a);
        g.fillStyle = 'rgba(28,16,8,0.7)';
        for (const sx of [-3, 3]) { g.beginPath(); g.ellipse(sx, 0, 2.4, 4.4, sx * 0.04, 0, Math.PI * 2); g.fill(); }
        g.restore();
      });
    }
    // torrões e palha
    const rr = rng(13);
    for (let k = 0; k < 500; k++) {
      const x = rr() * w, y = rr() * h, sz = 1 + rr() * 2;
      g.fillStyle = 'rgba(30,18,8,0.45)'; g.fillRect(x, y + 1, sz, sz);
      g.fillStyle = 'rgba(150,108,70,0.55)'; g.fillRect(x, y, sz, sz);
    }
    g.strokeStyle = 'rgba(226,196,118,0.75)';
    g.lineWidth = 1.2;
    for (const st of straws) {
      wrapDraw(w, h, st.x, st.y, st.l, (px, py) => {
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(st.a) * st.l, py + Math.sin(st.a) * st.l); g.stroke();
      });
    }
  });
  const rough = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = 'rgb(225,225,225)'; g.fillRect(0, 0, w, h);
    for (const b of blobs) {
      if (!b.wet) continue;
      wrapDraw(w, h, b.x, b.y, b.rad, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, b.rad);
        gr.addColorStop(0, 'rgba(40,40,40,0.95)');
        gr.addColorStop(1, 'rgba(40,40,40,0)');
        g.fillStyle = gr;
        g.fillRect(px - b.rad, py - b.rad, b.rad * 2, b.rad * 2);
      });
    }
  }, { srgb: false });
  return { map, rough };
}

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildSty(root, layout) {
  const { STY, SHED, SHED_BUTTONS, BUTTON_BOARD, GENERATOR, HORTA } = layout;
  const group = new THREE.Group();
  group.name = 'chiqueiro';
  const r = rng(81);
  const plankMat = woodMat('#a07a52', { key: 'f10-chiqueiro', rough: 0.9 });
  const postMat = woodMat('#7a5a3a', { key: 'f10-chiqueiro-mourao', vertical: true, rough: 0.95 });
  const H = STY.fenceH;

  // ---------------- cerca de tábuas horizontais (três por vão) e mourões
  const planks = [];
  const posts = [];
  const fenceRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    for (const y of [0.14, 0.34, 0.54]) {
      const g = new THREE.BoxGeometry(0.03, 0.11, len);
      g.rotateY(ang);
      g.translate((x0 + x1) / 2, y + (r() - 0.5) * 0.01, (z0 + z1) / 2);
      planks.push(g);
    }
    const n = Math.max(1, Math.round(len / 0.9));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const g = rbox(0.08, H + 0.08, 0.08, 0.01);
      g.translate(x0 + (x1 - x0) * t, (H + 0.08) / 2, z0 + (z1 - z0) * t);
      posts.push(g);
    }
  };
  fenceRun(STY.x0, STY.z0 + 0.06, STY.x1 - 0.05, STY.z0 + 0.06);
  fenceRun(STY.x0, STY.z1, STY.x1 - 0.05, STY.z1);
  fenceRun(STY.x1 - 0.05, STY.z0 + 0.06, STY.x1 - 0.05, STY.z1);
  fenceRun(STY.x0, STY.z0 + 0.06, STY.x0, STY.gate.z0);
  fenceRun(STY.x0, STY.gate.z1, STY.x0, STY.z1);
  const postMesh = new THREE.Mesh(mergeGeometries(posts), postMat);
  postMesh.castShadow = true;
  group.add(postMesh);
  const plankMesh = new THREE.Mesh(mergeGeometries(planks), plankMat);
  plankMesh.castShadow = true;
  plankMesh.receiveShadow = true;
  group.add(plankMesh);

  // ---------------- chão de barro (manchas molhadas que brilham, cascos, palha) com a poça de lama
  const bw0 = STY.x1 - STY.x0 - 0.1, bd0 = STY.z1 - STY.z0 - 0.1;
  const barro = barroTextures();
  for (const t of [barro.map, barro.rough]) t.repeat.set(bw0 / 1.3, bd0 / 1.3);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(bw0, bd0).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({
    map: barro.map, roughnessMap: barro.rough, roughness: 1, clearcoat: 0.35, clearcoatRoughness: 0.35,
  }));
  dirt.position.set((STY.x0 + STY.x1) / 2, 0.008, (STY.z0 + STY.z1) / 2);
  dirt.receiveShadow = true;
  const ripple = rippleNormalTexture().clone();
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.5, 28).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({
    color: '#5a3a22', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06, normalMap: ripple, normalScale: new THREE.Vector2(0.2, 0.2),
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  puddle.scale.set(1.3, 1, 0.82);
  puddle.position.set(STY.x0 + 0.95, 0.012, STY.z0 + 0.9);
  group.add(dirt, puddle);

  // ---------------- casinha dos porcos (tábuas, telhado de zinco ondulado)
  const house = new THREE.Group();
  const hx = 0.76, hz = 0.76, hh = 0.62;
  const walls = new THREE.Mesh(rbox(hx, hh, hz, 0.02), woodMat('#b08a5a', { key: 'f10-casinha-porcos', vertical: true }));
  walls.position.y = hh / 2;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.36), stdMat('#3a2418', { roughness: 1 }));
  door.position.set(-hx / 2 - 0.002, 0.18, 0);
  door.rotation.y = -Math.PI / 2;
  const roof = new THREE.Mesh(rbox(hx + 0.2, 0.03, hz + 0.2, 0.005), stdMat('#9aa4ac', { metalness: 0.6, roughness: 0.45 }));
  roof.position.y = hh + 0.08;
  roof.rotation.x = 0.18;
  house.add(walls, door, roof);
  house.position.set(STY.x1 - 0.45, 0, STY.z1 - 0.45);
  house.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(house);
  // cocho com lavagem
  const trough = new THREE.Group();
  const tBody = new THREE.Mesh(rbox(0.7, 0.18, 0.26, 0.02), woodMat('#7a5234', { key: 'f10-cocho' }));
  tBody.position.y = 0.09;
  const slop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.01, 0.18), stdMat('#c8a060', { roughness: 0.6 }));
  slop.position.y = 0.17;
  trough.add(tBody, slop);
  trough.position.set(STY.x1 - 0.5, 0, STY.z0 + 0.35);
  group.add(trough);
  // placa
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshStandardMaterial({ map: canvasTexture(192, 60, (g, w, h) => {
    g.fillStyle = '#f6e3b0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5a3a2a'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#c94a5a'; g.font = 'bold 26px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Chiqueiro', w / 2, h / 2 + 1);
  }, { repeat: false }), roughness: 0.8 }));
  sign.position.set(STY.x0 - 0.035, H + 0.12, STY.gate.z1 + 0.3);
  sign.rotation.y = -Math.PI / 2;
  group.add(sign);
  const shSty = contactShadow(0.5, 0.5, 0.3);
  shSty.position.set(house.position.x, 0.01, house.position.z);
  group.add(shSty);

  // ---------------- a porteira (dobradiça no norte da abertura; abre girando para fora, para a horta)
  const gw = STY.gate.z1 - STY.gate.z0;
  const gate = new THREE.Group();
  gate.name = 'porteira';
  const leaf = new THREE.Group();
  for (const y of [0.14, 0.34, 0.54]) {
    const b = new THREE.Mesh(rbox(0.03, 0.1, gw - 0.04, 0.008), plankMat);
    b.position.set(0, y, gw / 2);
    leaf.add(b);
  }
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.08, Math.hypot(gw - 0.1, 0.4)), plankMat);
  brace.position.set(0.02, 0.34, gw / 2);
  brace.rotation.x = Math.atan2(0.4, gw - 0.1);
  const latch = new THREE.Mesh(rbox(0.04, 0.05, 0.1, 0.006), stdMat('#3a3634', { metalness: 0.7, roughness: 0.4 }));
  latch.position.set(-0.03, 0.45, gw - 0.06);
  leaf.add(brace, latch);
  leaf.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) o.castShadow = true; });
  gate.add(leaf);
  gate.position.set(STY.x0, 0, STY.gate.z0);
  group.add(gate);

  // ---------------- o painel dos botões (tábuas verticais), grande, de costas para a cerca branca e virado para o leste:
  // presilhas pregadas nos mourões da cerca, moldura em cima, a luz de força no alto (vermelha fraca apagado; verde com
  // o gerador ligado) e um raio pintado
  const B = BUTTON_BOARD;
  const bw = B.z1 - B.z0;
  const zc = (B.z0 + B.z1) / 2;
  const board = new THREE.Group();
  board.name = 'painel-dos-botoes';
  const boardMat = woodMat('#c8a070', { key: 'f10-painel', vertical: true, rough: 0.85 });
  const boardFace = new THREE.Mesh(rbox(B.t, B.h, bw, 0.01), boardMat);
  boardFace.position.set(B.x, B.h / 2 + 0.02, zc);
  board.add(boardFace);
  // as frestas entre as tábuas (riscos escuros na frente)
  const gapMat = stdMat('#7a5234', { roughness: 0.9 });
  for (let k = 1; k < 5; k++) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.004, B.h - 0.04, 0.008), gapMat);
    g.position.set(B.x + B.t / 2 + 0.001, B.h / 2 + 0.02, B.z0 + (bw * k) / 5);
    board.add(g);
  }
  // duas travessas atrás, presas na cerca
  for (const y of [0.35, B.h - 0.25]) {
    const batten = new THREE.Mesh(rbox(0.05, 0.07, bw - 0.1, 0.008), postMat);
    batten.position.set(B.x - B.t / 2 - 0.025, y, zc);
    board.add(batten);
  }
  const trim = new THREE.Mesh(rbox(B.t + 0.04, 0.05, bw + 0.04, 0.01), postMat);
  trim.position.set(B.x, B.h + 0.045, zc);
  board.add(trim);
  board.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(board);
  const xf = B.x + B.t / 2 + 0.01;
  const lampZ = B.z1 - 0.17, lampY = B.h - 0.2;
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.024, 20).rotateZ(Math.PI / 2), stdMat('#2d2a28', { metalness: 0.5, roughness: 0.4 }));
  bezel.position.set(xf, lampY, lampZ);
  const powerMat = new THREE.MeshStandardMaterial({ color: '#6a1c18', emissive: '#ff3a2a', emissiveIntensity: 0.18, roughness: 0.3 });
  const powerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), powerMat);
  powerLamp.scale.x = 0.6;
  powerLamp.position.set(xf + 0.014, lampY, lampZ);
  const boltMat = new THREE.MeshStandardMaterial({ map: canvasTexture(64, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.beginPath();
    g.moveTo(38, 4); g.lineTo(12, 52); g.lineTo(30, 52); g.lineTo(22, 92); g.lineTo(54, 38); g.lineTo(35, 38); g.lineTo(46, 4); g.closePath();
    g.fillStyle = '#ffd400'; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#2d2a28'; g.stroke();
  }, { repeat: false }), transparent: true, roughness: 0.6 });
  const boltSign = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.19).rotateY(Math.PI / 2), boltMat);
  boltSign.position.set(xf - 0.006, lampY - 0.2, lampZ);
  group.add(bezel, powerLamp, boltSign);

  // ---------------- o gerador pequeno, encostado na cerca branca do lado do painel: estrutura de tubos vermelha,
  // tanque amarelo, motor, escapamento virado para o sul e a partida de cordinha (alça preta) no lado leste. Ligado, ele
  // treme; na partida, engasga e chacoalha. O cabo dele sobe pela beirada do painel até a luz de força.
  const G = GENERATOR;
  const gen = new THREE.Group();
  gen.name = 'gerador';
  gen.position.set(G.x, 0, G.z);
  const genBody = new THREE.Group();
  gen.add(genBody);
  const W = G.hx * 2 - 0.02, D = G.hz * 2 - 0.02, GH = G.h;
  /** @type {THREE.BufferGeometry[]} */
  const frame = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const up = new THREE.CylinderGeometry(0.013, 0.013, GH - 0.03, 8);
      up.translate((sx * W) / 2, (GH - 0.03) / 2 + 0.03, (sz * D) / 2);
      frame.push(up);
    }
  }
  for (const y of [0.04, GH]) {
    for (const sz of [-1, 1]) {
      const rg = new THREE.CylinderGeometry(0.013, 0.013, W, 8).rotateZ(Math.PI / 2);
      rg.translate(0, y, (sz * D) / 2);
      frame.push(rg);
    }
    for (const sx of [-1, 1]) {
      const rg = new THREE.CylinderGeometry(0.013, 0.013, D, 8).rotateX(Math.PI / 2);
      rg.translate((sx * W) / 2, y, 0);
      frame.push(rg);
    }
  }
  const frameMesh = new THREE.Mesh(mergeGeometries(frame), stdMat('#c9302c', { metalness: 0.45, roughness: 0.4 }));
  const tank = new THREE.Mesh(rbox(W - 0.05, 0.11, D - 0.03, 0.035), stdMat('#f2b51c', { roughness: 0.35, metalness: 0.1 }));
  tank.position.y = GH - 0.075;
  const fuelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 14), stdMat('#2d2a28', { roughness: 0.5 }));
  fuelCap.position.set(-W * 0.2, GH - 0.008, 0);
  const engine = new THREE.Mesh(rbox(W * 0.62, 0.17, D * 0.72, 0.02), stdMat('#5a5856', { metalness: 0.55, roughness: 0.45 }));
  engine.position.set(0.01, 0.15, -0.01);
  /** @type {THREE.BufferGeometry[]} */
  const fins = [];
  for (let k = 0; k < 4; k++) fins.push(new THREE.BoxGeometry(W * 0.5, 0.008, D * 0.6).translate(0.01, 0.245 + k * 0.016, -0.01));
  const finMesh = new THREE.Mesh(mergeGeometries(fins), stdMat('#6e6c6a', { metalness: 0.6, roughness: 0.4 }));
  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15, 14).rotateZ(Math.PI / 2), stdMat('#b8bcc0', { metalness: 0.85, roughness: 0.3 }));
  muffler.position.set(G.exhaust.x - G.x + 0.08, G.exhaust.y, D / 2 - 0.05);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.07, 10).rotateX(Math.PI / 2), stdMat('#3a3634', { metalness: 0.7, roughness: 0.4 }));
  pipe.position.set(G.exhaust.x - G.x, G.exhaust.y, D / 2 - 0.01);
  const starter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.045, 20).rotateZ(Math.PI / 2), stdMat('#2d2a28', { metalness: 0.3, roughness: 0.5 }));
  starter.position.set(W / 2 - 0.035, G.cord.y - 0.06, 0);
  const faceZ = -0.01 + D * 0.36;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.075), stdMat('#2d2a28', { roughness: 0.6 }));
  plate.position.set(W * 0.16, 0.16, faceZ + 0.002);
  const toggle = new THREE.Mesh(rbox(0.016, 0.03, 0.016, 0.004), stdMat('#e23d3d', { roughness: 0.4 }));
  toggle.position.set(W * 0.16 - 0.03, 0.165, faceZ + 0.01);
  const genLampMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: '#5aff6a', emissiveIntensity: 0, roughness: 0.3 });
  const genLamp = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), genLampMat);
  genLamp.position.set(W * 0.16 + 0.03, 0.17, faceZ + 0.006);
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), boltMat);
  sticker.position.set(0.05, GH - 0.075, (D - 0.03) / 2 + 0.002);
  const skids = new THREE.Mesh(mergeGeometries([-1, 1].map((sx) => new THREE.BoxGeometry(0.04, 0.025, D + 0.04).translate((sx * W) / 2.4, 0.0125, 0))), stdMat('#2a2624', { roughness: 0.9 }));
  genBody.add(frameMesh, tank, fuelCap, engine, finMesh, muffler, pipe, starter, plate, toggle, genLamp, sticker, skids);
  genBody.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // a cordinha de partida e a alça (fora do corpo que treme: é ela que a Rhaenyra puxa)
  const startCord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 6), stdMat('#e8e2d0', { roughness: 0.8 }));
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.07, 4, 10).rotateX(Math.PI / 2), stdMat('#1e1c1a', { roughness: 0.55 }));
  gen.add(startCord, handle);
  const genShadow = contactShadow(0.3, 0.26, 0.35);
  genShadow.position.set(0, 0.006, 0);
  gen.add(genShadow);
  group.add(gen);
  // do gerador, pelo chão, até a ponta sul do painel e subindo por ela até a luz de força
  const genLink = makeLink([
    new THREE.Vector3(G.x - 0.08, 0.1, G.z - G.hz - 0.004),
    new THREE.Vector3(G.x - 0.08, 0.022, G.z - G.hz - 0.07),
    new THREE.Vector3(xf + 0.03, 0.022, B.z1 - 0.05),
    new THREE.Vector3(xf, 0.07, B.z1 - 0.05),
    new THREE.Vector3(xf, lampY, B.z1 - 0.05),
    new THREE.Vector3(xf, lampY, lampZ + 0.055),
  ], { radius: 0.011, color: '#1e1c1a', glow: '#9cff7a', clips: 2 });
  group.add(genLink.object);

  // ---------------- a caixinha de força na parede do galpão e os fios: de cada botão, pela frente do painel até a ponta
  // dele, pelo chão da faixa e da horta (entre os canteiros) até a caixinha; dela, um cabo até a roldana da porta e
  // outro, pelo chão, até a trava da porteira (qual botão vai para onde é sorteado)
  const xw = SHED.x0 - SHED.t / 2 - 0.02;
  const boxZ = 3.14;
  const jbox = new THREE.Mesh(rbox(0.05, 0.2, 0.16, 0.01), stdMat('#d8dcd6', { roughness: 0.5 }));
  jbox.position.set(xw - 0.005, 0.82, boxZ);
  group.add(jbox);
  const cableOpts = { radius: 0.007, color: '#3a3634', glow: '#ffd36a', metal: true };
  SHED_BUTTONS.forEach((b, i) => {
    const zg = boxZ - 0.03 + i * 0.06;
    // desce pela frente do painel, embaixo do botão, e segue pelo chão da faixa e da horta
    const lk = makeLink([
      new THREE.Vector3(xf, b.top - 0.13, b.z),
      new THREE.Vector3(xf, 0.06, b.z),
      new THREE.Vector3(xf + 0.03, 0.02, b.z),
      new THREE.Vector3(HORTA.x0 - 0.1, 0.02, zg),
      new THREE.Vector3(xw, 0.02, zg),
      new THREE.Vector3(xw, 0.72, zg),
    ], { ...cableOpts, clips: 3 });
    group.add(lk.object);
  });
  // da caixinha até a roldana da porta (subindo pela parede) e até a trava da porteira (pelo chão)
  const toDoor = makeLink([
    new THREE.Vector3(xw, 0.92, boxZ),
    new THREE.Vector3(xw, SHED.door.h + 0.06, boxZ),
    new THREE.Vector3(xw, SHED.door.h + 0.06, SHED.door.z1 - 0.12),
  ], { ...cableOpts, clips: 2 });
  const toGate = makeLink([
    new THREE.Vector3(xw, 0.72, boxZ + 0.05),
    new THREE.Vector3(xw, 0.025, boxZ + 0.09),
    new THREE.Vector3(xw, 0.025, STY.z0 - 0.08),
    new THREE.Vector3(STY.x0 - 0.06, 0.025, STY.z0 - 0.08),
    new THREE.Vector3(STY.x0 - 0.06, 0.025, STY.gate.z1 - 0.06),
    new THREE.Vector3(STY.x0 - 0.06, 0.45, STY.gate.z1 - 0.06),
  ], { ...cableOpts, clips: 4 });
  group.add(toDoor.object, toGate.object);

  // ---------------- o gerador por quadro: a alça sai com o puxão, o corpo treme e as luzes acendem
  const gst = { pull: 0, state: 'off', t: 0, lit: 0 };
  const hRest = new THREE.Vector3(G.cord.x - G.x, G.cord.y, G.cord.z - G.z);
  const sPos = new THREE.Vector3(W / 2 - 0.01, G.cord.y - 0.06, 0);
  const _hp = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  function layoutGen() {
    _hp.set(hRest.x + 0.24 * gst.pull, hRest.y + 0.05 * gst.pull, hRest.z);
    handle.position.copy(_hp);
    startCord.position.copy(sPos).add(_hp).multiplyScalar(0.5);
    const d = _hp.clone().sub(sPos);
    startCord.scale.y = Math.max(0.01, d.length());
    startCord.quaternion.setFromUnitVectors(_up, d.normalize());
  }
  layoutGen();
  function genUpdate(dt) {
    gst.t += dt;
    let amp = 0, rock = 0;
    if (gst.state === 'crank') {
      const k = 0.5 + 0.5 * Math.sin(gst.t * 9) * Math.sin(gst.t * 23);
      amp = 0.006 * k;
      rock = 0.035 * k * Math.sin(gst.t * 27);
    } else if (gst.state === 'on') {
      amp = 0.0022;
      rock = 0.006 * Math.sin(gst.t * 33);
    }
    genBody.position.set(Math.sin(gst.t * 61) * amp, Math.abs(Math.sin(gst.t * 47)) * amp, Math.cos(gst.t * 53) * amp);
    genBody.rotation.set(Math.cos(gst.t * 31) * rock * 0.6, 0, rock);
    const want = gst.state === 'on' ? 1 : 0;
    gst.lit += (want - gst.lit) * (1 - Math.exp(-dt * 6));
    const flick = gst.state === 'crank' ? 0.4 + 0.4 * Math.sin(gst.t * 40) : 0;
    const on = gst.lit > 0.5;
    powerMat.color.set(on ? '#1f6a24' : '#6a1c18');
    powerMat.emissive.set(on ? '#5aff6a' : '#ff3a2a');
    powerMat.emissiveIntensity = on ? 0.9 + 0.25 * Math.sin(gst.t * 6) : 0.18 + flick * 0.3;
    genLampMat.emissiveIntensity = gst.lit * 1.4 + flick;
    genLink.update(dt);
  }

  const st = { open: 0 };
  root.add(group);
  return {
    group,
    gate: {
      object: gate,
      setOpen(t) {
        st.open = Math.max(0, Math.min(1, t));
        // gira para fora (para o oeste, a horta), no mesmo ângulo do colisor dos porquinhos (STY.swing)
        gate.rotation.y = -st.open * STY.swing;
      },
    },
    links: { door: toDoor, gate: toGate },
    // o painel e o gerador podem ficar entre a câmera e as dogs (na faixa, atrás deles)
    seeThrough: [board, gen],
    /** O gerador: setPull(k) tira a alça (0..1), setState('off' | 'crank' | 'on') e o pulso do cabo até o painel. */
    generator: {
      object: gen,
      setPull(k) { gst.pull = Math.max(0, Math.min(1, k)); layoutGen(); },
      setState(state) {
        if (state === 'on' && gst.state !== 'on') { genLink.pulse(); genLink.setOn(true); }
        if (state === 'off') genLink.setOn(false);
        gst.state = state;
      },
      get state() { return gst.state; },
    },
    update(dt) {
      toDoor.update(dt);
      toGate.update(dt);
      genUpdate(dt);
    },
  };
}
