// FASE 5 · Móveis e objetos de cena (com colisão em ../layout.js, todos procedurais):
// SALA — sofá com almofadas e manta, mesa de centro (pulável) com caneca e livros, poltrona, estante com
//        TV e livros, abajur de pé (luz quente), tapete, vaso de costela-de-adão, cortinas.
// CORREDOR — escada de madeira com corrimão, cabideiro com capa de chuva, aparador com chaves e porta-retrato,
//        porta-guarda-chuva com o guarda-chuva pingando numa poça, sapateira com galochas, aspirador
//        robô na base (luzinha piscando), passadeira, arandela.
// COZINHA — bancada com pia, torneira, cooktop e chaleira, armários de cima, geladeira com ímãs,
//        saco de ração e potinhos das dogs, pilhas de caixas da mudança, cadeiras.
import * as THREE from 'three';
import { rng, rbox, canvasTexture, stdMat, woodMat, contactShadow, shadowAll, stripeTexture } from '../../../world/util.js';
import { plantMat, boxwood } from '../../../world/plants.js';

const TAU = Math.PI * 2;

/**
 * Caixa de papelão da mudança com fita e etiqueta escrita (na face +Z, ou na tampa com onTop).
 * @param {number} w @param {number} h @param {number} d @param {string} [label] @param {number} [seed]
 * @param {{ onTop?: boolean }} [opts]
 */
export function movingBox(w, h, d, label = '', seed = 1, { onTop = false } = {}) {
  const r = rng(seed);
  const card = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a06b').offsetHSL(0, 0, (r() - 0.5) * 0.06), roughness: 0.92 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(rbox(w, h, d, 0.012), card);
  body.position.y = h / 2;
  const tapeMat = stdMat('#d8b98a', { roughness: 0.4, metalness: 0.05 });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, d + 0.004), tapeMat);
  tape.position.y = h + 0.002;
  const tapeF = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.3, 0.004), tapeMat);
  tapeF.position.set(0, h * 0.85, d / 2 + 0.002);
  g.add(body, tape, tapeF);
  if (label) {
    const tex = canvasTexture(256, 96, (c, cw, ch) => {
      c.fillStyle = 'rgba(0,0,0,0)';
      c.clearRect(0, 0, cw, ch);
      c.fillStyle = '#3a2a1e';
      c.font = '700 52px "Fredoka", "Comic Sans MS", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.save();
      c.translate(cw / 2, ch / 2);
      c.rotate((r() - 0.5) * 0.12);
      c.fillText(label, 0, 2);
      c.restore();
    }, { repeat: false });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.85, 0.42), Math.min(w * 0.85, 0.42) * 0.375), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9 }));
    if (onTop) {
      lab.rotation.x = -Math.PI / 2;
      lab.position.set(0, h + 0.004, d * 0.18);
    } else lab.position.set(0, h * 0.45, d / 2 + 0.003);
    g.add(lab);
  }
  return g;
}

// ================================================================== sala
function buildLivingRoom(root, layout) {
  const grp = new THREE.Group();
  grp.name = 'sala';
  const { SOFA, COFFEE_TABLE: CT } = layout;
  // ---- tapete
  const rugTex = canvasTexture(256, 192, (g, w, h) => {
    g.fillStyle = '#c7674e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f1e2c9'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = '#3f6f78'; g.lineWidth = 5; g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = '#f1e2c9';
    for (let i = 0; i < 5; i++) { g.save(); g.translate(w / 2, h / 2); g.rotate((i * TAU) / 5); g.beginPath(); g.ellipse(0, -26, 9, 22, 0, 0, TAU); g.fill(); g.restore(); }
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  }, { repeat: false });
  const rug = new THREE.Mesh(rbox(2.6, 0.012, 1.9, 0.005, 1), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.position.set(-4.4, 0.006, -1.55);
  rug.receiveShadow = true;
  grp.add(rug);

  // ---- sofá
  const fabric = new THREE.MeshStandardMaterial({ color: '#5f8b94', roughness: 0.95 });
  const fabricD = new THREE.MeshStandardMaterial({ color: '#4f7a83', roughness: 0.95 });
  const sofa = new THREE.Group();
  const W = SOFA.hx * 2, D = SOFA.hz * 2;
  const base = new THREE.Mesh(rbox(W, 0.28, D, 0.06), fabricD);
  base.position.y = 0.2;
  const back = new THREE.Mesh(rbox(W, 0.5, 0.2, 0.08), fabric);
  back.position.set(0, 0.55, -D / 2 + 0.1);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(rbox(0.2, 0.36, D, 0.08), fabric);
    arm.position.set(sx * (W / 2 - 0.1), 0.42, 0);
    sofa.add(arm);
  }
  for (const sx of [-1, 1]) {
    const seat = new THREE.Mesh(rbox(W / 2 - 0.22, 0.14, D - 0.26, 0.06), fabric);
    seat.position.set(sx * (W / 4 - 0.05), 0.41, 0.06);
    sofa.add(seat);
  }
  /** @type {[number, string, number][]} */
  const pillows = [[-0.62, '#f2c14e', 0.2], [0.5, '#e86a52', -0.15], [0.02, '#f4efe6', 0.05]];
  for (const [x, col, rot] of pillows) {
    const pil = new THREE.Mesh(rbox(0.36, 0.34, 0.12, 0.06), stdMat(col, { roughness: 0.95 }));
    pil.position.set(x, 0.62, -D / 2 + 0.26);
    pil.rotation.set(-0.25, 0, rot);
    sofa.add(pil);
  }
  // manta listrada caída no braço
  const throwMat = new THREE.MeshStandardMaterial({ map: stripeTexture('#efe1c4', '#c98a4a', 10), roughness: 1 });
  const thr = new THREE.Mesh(rbox(0.42, 0.04, D * 0.9, 0.02), throwMat);
  thr.position.set(W / 2 - 0.1, 0.62, 0.02);
  thr.rotation.z = -0.25;
  sofa.add(base, back, thr);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.08, 8), woodMat('#5b3f2a', { key: 'f5-dark-wood' }));
    leg.position.set(sx * (W / 2 - 0.1), 0.04, sz * (D / 2 - 0.1));
    sofa.add(leg);
  }
  sofa.position.set(SOFA.x, 0, SOFA.z);
  grp.add(sofa);

  // ---- mesa de centro (baixa: a Rhaenyra pula por cima)
  const ctWood = woodMat('#a87a52', { key: 'f5-oak', rough: 0.6 });
  const ct = new THREE.Group();
  const top = new THREE.Mesh(rbox(CT.hx * 2, 0.05, CT.hz * 2, 0.02), ctWood);
  top.position.y = CT.height - 0.025;
  const shelf = new THREE.Mesh(rbox(CT.hx * 2 - 0.1, 0.03, CT.hz * 2 - 0.1, 0.01), ctWood);
  shelf.position.y = 0.1;
  ct.add(top, shelf);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(rbox(0.05, CT.height - 0.05, 0.05, 0.01), ctWood);
    leg.position.set(sx * (CT.hx - 0.05), (CT.height - 0.05) / 2, sz * (CT.hz - 0.05));
    ct.add(leg);
  }
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 16), stdMat('#f4efe6', { roughness: 0.4 }));
  mug.position.set(0.22, CT.height + 0.045, 0.05);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.034, 16).rotateX(-Math.PI / 2), stdMat('#8a5a32', { roughness: 0.2 }));
  tea.position.set(0.22, CT.height + 0.08, 0.05);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12), mug.material);
  handle.position.set(0.265, CT.height + 0.05, 0.05);
  handle.rotation.y = Math.PI / 2;
  ct.add(mug, tea, handle);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(rbox(0.24 - i * 0.02, 0.035, 0.17, 0.005), stdMat(['#3f6f78', '#e86a52', '#f2c14e'][i], { roughness: 0.8 }));
    b.position.set(-0.2, CT.height + 0.018 + i * 0.035, -0.02);
    b.rotation.y = i * 0.18;
    ct.add(b);
  }
  ct.position.set(CT.x, 0, CT.z);
  grp.add(ct);

  // ---- poltrona
  const arm = new THREE.Group();
  const aMat = new THREE.MeshStandardMaterial({ color: '#d9a35a', roughness: 0.95 });
  const aBase = new THREE.Mesh(rbox(0.8, 0.26, 0.8, 0.07), aMat);
  aBase.position.y = 0.24;
  const aBack = new THREE.Mesh(rbox(0.8, 0.5, 0.18, 0.08), aMat);
  aBack.position.set(0, 0.6, -0.31);
  for (const sx of [-1, 1]) {
    const aa = new THREE.Mesh(rbox(0.16, 0.3, 0.78, 0.07), aMat);
    aa.position.set(sx * 0.32, 0.47, 0);
    arm.add(aa);
  }
  const aSeat = new THREE.Mesh(rbox(0.5, 0.12, 0.6, 0.05), stdMat('#e2b26e', { roughness: 0.95 }));
  aSeat.position.set(0, 0.42, 0.06);
  arm.add(aBase, aBack, aSeat);
  arm.position.set(-2.75, 0, -2.95);
  arm.rotation.y = -0.35;
  grp.add(arm);

  // ---- estante com TV e livros (parede oeste)
  const shelfMat = woodMat('#efe4d2', { key: 'f5-white-wood', rough: 0.7 });
  const st = new THREE.Group();
  const cab = new THREE.Mesh(rbox(0.5, 0.5, 1.8, 0.02), shelfMat);
  cab.position.y = 0.25;
  st.add(cab);
  const tv = new THREE.Mesh(rbox(0.06, 0.55, 1.0, 0.01), stdMat('#1d1f23', { roughness: 0.3, metalness: 0.3 }));
  tv.position.set(0.0, 0.85, -0.15);
  const tvFoot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.3), stdMat('#2a2c30', { metalness: 0.5 }));
  tvFoot.position.set(0, 0.53, -0.15);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.5), new THREE.MeshStandardMaterial({ color: '#0d1014', roughness: 0.15, metalness: 0.5, emissive: '#1a2230', emissiveIntensity: 0.2 }));
  screen.rotation.y = Math.PI / 2;
  screen.position.set(0.035, 0.85, -0.15);
  st.add(tv, tvFoot, screen);
  const r = rng(5);
  for (let i = 0; i < 9; i++) {
    const bh = 0.16 + r() * 0.08;
    const book = new THREE.Mesh(rbox(0.16, bh, 0.045, 0.005), stdMat(['#3f6f78', '#e86a52', '#f2c14e', '#7f9c8a', '#8a5a7a'][i % 5], { roughness: 0.8 }));
    book.position.set(0.02, 0.5 + bh / 2, 0.45 + i * 0.05);
    book.rotation.x = i === 8 ? 0.3 : 0;
    st.add(book);
  }
  const plant = new THREE.Mesh(boxwood(0.12, 81), plantMat());
  plant.position.set(0.02, 0.62, -0.72);
  st.add(plant);
  st.position.set(-6.15, 0, -0.9);
  grp.add(st);

  // ---- abajur de pé (canto noroeste)
  const lampMat = stdMat('#2f2a26', { metalness: 0.6, roughness: 0.4 });
  const lamp = new THREE.Group();
  const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 20), lampMat);
  lb.position.y = 0.02;
  const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 8), lampMat);
  lp.position.y = 0.72;
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#f6e7cc', roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0.9, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 24, 1, true), shadeMat);
  shade.position.y = 1.48;
  lamp.add(lb, lp, shade);
  lamp.position.set(-6.0, 0, -3.35);
  grp.add(lamp);

  // ---- vaso de costela-de-adão (perto da porta da sala)
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.36, 20), stdMat('#e9e1d3', { roughness: 0.5 }));
  pot.position.set(-6.05, 0.18, 0.75);
  grp.add(pot);
  const leafMat = stdMat('#3f7a3f', { roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.bezierCurveTo(0.16, 0.05, 0.2, 0.28, 0, 0.36); s.bezierCurveTo(-0.2, 0.28, -0.16, 0.05, 0, 0);
    const lf = new THREE.Mesh(new THREE.ShapeGeometry(s, 8), leafMat);
    const a = (i / 7) * TAU;
    lf.position.set(-6.05 + Math.cos(a) * 0.08, 0.36 + 0.25 + (i % 2) * 0.12, 0.75 + Math.sin(a) * 0.08);
    lf.rotation.set(-0.9 + (i % 3) * 0.2, a + Math.PI / 2, 0);
    grp.add(lf);
  }
  // ---- cortinas da janela
  const curtMat = new THREE.MeshStandardMaterial({ color: '#efe1c4', roughness: 1, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(0.42, 1.9, 12, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 40) * 0.025);
    geo.computeVertexNormals();
    const c = new THREE.Mesh(geo, curtMat);
    c.position.set(-4.6 + sx * 0.98, 1.45, -3.74);
    grp.add(c);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.4, 8).rotateZ(Math.PI / 2), lampMat);
  rod.position.set(-4.6, 2.42, -3.72);
  grp.add(rod);
  shadowAll(grp);
  rug.castShadow = false;
  root.add(grp);
  return { group: grp, lampShade: shadeMat, lampPos: new THREE.Vector3(-6.0, 1.48, -3.35) };
}

// ================================================================== corredor
function buildHall(root, layout, updaters) {
  const grp = new THREE.Group();
  grp.name = 'corredor';
  const { STAIRS } = layout;
  // ---- passadeira
  const runTex = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#3f6f78'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f1e2c9';
    for (let x = 8; x < w; x += 24) { g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 8, h / 2 - 10); g.lineTo(x + 16, h / 2); g.lineTo(x + 8, h / 2 + 10); g.fill(); }
    g.strokeStyle = '#e86a52'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
  }, { repeat: false });
  const runner = new THREE.Mesh(rbox(3.0, 0.01, 0.7, 0.004, 1), new THREE.MeshStandardMaterial({ map: runTex, roughness: 1 }));
  runner.position.set(0.15, 0.005, 0.3);
  runner.receiveShadow = true;
  grp.add(runner);

  // ---- escada de madeira subindo para o oeste junto à parede norte
  const stepMat = woodMat('#a87a52', { key: 'f5-oak', rough: 0.6 });
  const riserMat = stdMat('#f4efe6', { roughness: 0.6 });
  const n = 9;
  const run = (STAIRS.x1 - STAIRS.x0) / n;
  const depth = STAIRS.z1 - STAIRS.z0;
  for (let i = 0; i < n; i++) {
    const h = 0.18 * (i + 1);
    const x = STAIRS.x1 - (i + 0.5) * run;
    const riser = new THREE.Mesh(new THREE.BoxGeometry(run, h, depth - 0.04), riserMat);
    riser.position.set(x, h / 2, (STAIRS.z0 + STAIRS.z1) / 2 - 0.02);
    const tread = new THREE.Mesh(rbox(run + 0.03, 0.035, depth, 0.008), stepMat);
    tread.position.set(x, h + 0.017, (STAIRS.z0 + STAIRS.z1) / 2);
    grp.add(riser, tread);
  }
  // corrimão
  const railMat = woodMat('#5b3f2a', { key: 'f5-dark-wood' });
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(STAIRS.x1 - i * run, 0.18 * i + 0.9, STAIRS.z1 - 0.04));
  const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 8), railMat);
  grp.add(rail);
  for (let i = 0; i <= n; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), railMat);
    post.position.set(STAIRS.x1 - i * run, 0.18 * i + 0.45 + (i > 0 ? 0.02 : 0), STAIRS.z1 - 0.04);
    grp.add(post);
  }

  // ---- cabideiro com capa de chuva amarela
  const crMat = woodMat('#6b4a33', { key: 'f5-walnut' });
  const cr = new THREE.Group();
  const crBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 16), crMat);
  crBase.position.y = 0.02;
  const crPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.6, 8), crMat);
  crPole.position.y = 0.8;
  cr.add(crBase, crPole);
  for (let i = 0; i < 4; i++) {
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6), crMat);
    hook.position.set(Math.cos((i * TAU) / 4) * 0.06, 1.52, Math.sin((i * TAU) / 4) * 0.06);
    hook.rotation.set(Math.sin((i * TAU) / 4) * 0.8, 0, -Math.cos((i * TAU) / 4) * 0.8);
    cr.add(hook);
  }
  const coatGeo = new THREE.CylinderGeometry(0.07, 0.2, 0.85, 16, 4, true);
  const coat = new THREE.Mesh(coatGeo, stdMat('#f2c14e', { roughness: 0.35, side: THREE.DoubleSide }));
  coat.position.set(0.08, 1.08, 0.06);
  coat.rotation.z = -0.08;
  cr.add(coat);
  cr.position.set(-1.35, 0, -2.25);
  grp.add(cr);

  // ---- aparador com chaves e porta-retrato
  const ap = new THREE.Group();
  const apMat = woodMat('#efe4d2', { key: 'f5-white-wood', rough: 0.7 });
  const apTop = new THREE.Mesh(rbox(0.6, 0.04, 0.4, 0.01), apMat);
  apTop.position.y = 0.78;
  ap.add(apTop);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.76, 6), crMat);
    l.position.set(sx * 0.26, 0.38, sz * 0.16);
    ap.add(l);
  }
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8, 0, TAU, Math.PI / 2, Math.PI / 2), stdMat('#c98a4a', { roughness: 0.4 }));
  bowl.rotation.x = Math.PI;
  bowl.position.set(-0.12, 0.88, 0.02);
  const keys = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 12), stdMat('#d8c38a', { metalness: 0.9, roughness: 0.3 }));
  keys.position.set(-0.1, 0.83, 0.02);
  keys.rotation.x = 1.2;
  const photo = new THREE.Mesh(rbox(0.14, 0.18, 0.02, 0.005), stdMat('#6b4a33'));
  photo.position.set(0.16, 0.89, -0.05);
  photo.rotation.set(-0.15, -0.3, 0);
  ap.add(bowl, keys, photo);
  ap.position.set(1.55, 0, -1.95);
  grp.add(ap);

  // ---- porta-guarda-chuva com guarda-chuva pingando
  const us = new THREE.Group();
  const usBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.45, 16, 1, true), stdMat('#3f6f78', { roughness: 0.5, side: THREE.DoubleSide }));
  usBody.position.y = 0.225;
  const umb = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.75, 8), stdMat('#d94a5a', { roughness: 0.4 }));
  umb.position.set(0.02, 0.62, 0);
  umb.rotation.set(Math.PI, 0, 0.12);
  const hookU = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), stdMat('#3a2a1e'));
  hookU.position.set(0.05, 1.02, 0);
  us.add(usBody, umb, hookU);
  us.position.set(-1.4, 0, 2.9);
  grp.add(us);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#9fb4c8', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45 }));
  puddle.scale.set(1.2, 1, 0.8);
  puddle.position.set(-1.1, 0.004, 2.72);
  grp.add(puddle);
  const drip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), stdMat('#cfe0f0', { roughness: 0.05, transparent: true, opacity: 0.8 }));
  grp.add(drip);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.03, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#e6f0fa', transparent: true, opacity: 0 }));
  ring.position.set(-1.33, 0.006, 2.9);
  grp.add(ring);
  updaters.push((dt, t) => {
    const k = (t * 0.7) % 1;
    drip.position.set(-1.33, 0.3 * (1 - k * k), 2.9);
    drip.visible = k < 0.98;
    const rk = ((t * 0.7) % 1);
    ring.scale.setScalar(1 + rk * 5);
    ring.material.opacity = rk < 0.05 ? 0 : 0.5 * (1 - rk);
  });

  // ---- sapateira com galochas
  const sr = new THREE.Group();
  const srMat = woodMat('#a87a52', { key: 'f5-oak', rough: 0.6 });
  for (const y of [0.04, 0.22]) {
    const s = new THREE.Mesh(rbox(1.0, 0.03, 0.34, 0.008), srMat);
    s.position.y = y;
    sr.add(s);
  }
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(rbox(0.03, 0.26, 0.34, 0.006), srMat);
    side.position.set(sx * 0.49, 0.13, 0);
    sr.add(side);
  }
  const boot = (x, col) => {
    const b = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 12), stdMat(col, { roughness: 0.35 }));
    leg.position.y = 0.13;
    const foot = new THREE.Mesh(rbox(0.1, 0.06, 0.18, 0.03), leg.material);
    foot.position.set(0, 0.03, 0.04);
    b.add(leg, foot);
    b.position.set(x, 0.24, 0);
    return b;
  };
  sr.add(boot(-0.3, '#f2c14e'), boot(-0.18, '#f2c14e'), boot(0.18, '#e86a7a'), boot(0.28, '#e86a7a'));
  for (const x of [-0.25, 0.1, 0.32]) {
    const sh = new THREE.Mesh(rbox(0.1, 0.05, 0.22, 0.025), stdMat('#5b3f2a', { roughness: 0.7 }));
    sh.position.set(x, 0.08, 0);
    sr.add(sh);
  }
  sr.position.set(0.3, 0, 3.15);
  grp.add(sr);

  // ---- aspirador robô dormindo na base (luzinha pisca)
  const rob = new THREE.Group();
  const dock = new THREE.Mesh(rbox(0.3, 0.14, 0.1, 0.03), stdMat('#2a2c30', { roughness: 0.4 }));
  dock.position.set(0, 0.07, -0.18);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 32), stdMat('#eceeef', { roughness: 0.35, metalness: 0.1 }));
  body.position.y = 0.045;
  const topDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 28), stdMat('#3a3d42', { roughness: 0.2, metalness: 0.4 }));
  topDisc.position.y = 0.084;
  const ledMat = new THREE.MeshStandardMaterial({ color: '#7ef08a', emissive: '#2fd04a', emissiveIntensity: 1.5 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), ledMat);
  led.position.set(0, 0.092, 0.08);
  rob.add(dock, body, topDisc, led);
  rob.position.set(1.55, 0, 2.95);
  grp.add(rob);
  updaters.push((dt, t) => { ledMat.emissiveIntensity = 0.3 + 1.4 * Math.max(0, Math.sin(t * 1.4)) ** 8; });

  // ---- arandela
  const sconceMat = new THREE.MeshStandardMaterial({ color: '#fff3dc', roughness: 0.6, emissive: '#ffcf8a', emissiveIntensity: 1.0 });
  const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, TAU, 0, Math.PI / 2), sconceMat);
  sconce.rotation.x = Math.PI;
  sconce.scale.set(1, 0.7, 0.6);
  sconce.position.set(-0.45, 1.95, -3.72);
  grp.add(sconce);
  shadowAll(grp);
  runner.castShadow = false;
  puddle.castShadow = false;
  root.add(grp);
  return { group: grp, sconcePos: new THREE.Vector3(-0.45, 1.85, -3.6) };
}

// ================================================================== cozinha
function buildKitchen(root, layout) {
  const grp = new THREE.Group();
  grp.name = 'cozinha';
  const { COUNTER: K, FRIDGE: F, TABLE: T } = layout;
  const cabMat = stdMat('#7f9c8a', { roughness: 0.55 });
  const topMat = stdMat('#efe9df', { roughness: 0.3, metalness: 0.05 });
  const handleMat = stdMat('#c99a45', { metalness: 0.9, roughness: 0.3 });
  const w = K.x1 - K.x0, d = K.z1 - K.z0, cx = (K.x0 + K.x1) / 2, cz = (K.z0 + K.z1) / 2;
  // ---- armários de baixo + tampo
  const base = new THREE.Mesh(rbox(w, K.height - 0.05, d - 0.04, 0.012), cabMat);
  base.position.set(cx, (K.height - 0.05) / 2, cz - 0.02);
  const top = new THREE.Mesh(rbox(w + 0.04, 0.05, d + 0.03, 0.01), topMat);
  top.position.set(cx, K.height - 0.025, cz);
  grp.add(base, top);
  const nDoors = 5;
  for (let i = 0; i < nDoors; i++) {
    const x = K.x0 + (i + 0.5) * (w / nDoors);
    const door = new THREE.Mesh(rbox(w / nDoors - 0.03, K.height - 0.2, 0.02, 0.008), stdMat('#88a594', { roughness: 0.5 }));
    door.position.set(x, (K.height - 0.05) / 2 + 0.02, K.z1 - 0.02);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.02), handleMat);
    h.position.set(x, K.height - 0.18, K.z1 + 0.005);
    grp.add(door, h);
  }
  const kick = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.02), stdMat('#3a3d42'));
  kick.position.set(cx, 0.04, K.z1 - 0.03);
  grp.add(kick);
  // ---- pia + torneira (embaixo da janela)
  const sink = new THREE.Mesh(rbox(0.55, 0.02, 0.4, 0.01), stdMat('#c6cbcf', { metalness: 0.9, roughness: 0.25 }));
  sink.position.set(3.6, K.height + 0.001, cz);
  const basin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.32), stdMat('#7d848a', { metalness: 0.9, roughness: 0.3 }));
  basin.position.set(3.6, K.height + 0.006, cz);
  const tapMat = stdMat('#d9dde0', { metalness: 1, roughness: 0.15 });
  const tapPts = [new THREE.Vector3(3.6, K.height, cz - 0.22), new THREE.Vector3(3.6, K.height + 0.28, cz - 0.22), new THREE.Vector3(3.6, K.height + 0.32, cz - 0.12), new THREE.Vector3(3.6, K.height + 0.22, cz - 0.04)];
  const tap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tapPts), 16, 0.014, 8), tapMat);
  grp.add(sink, basin, tap);
  // ---- cooktop + chaleira
  const ck = new THREE.Mesh(rbox(0.56, 0.012, 0.44, 0.01), stdMat('#15171a', { roughness: 0.15, metalness: 0.2 }));
  ck.position.set(2.55, K.height + 0.006, cz);
  grp.add(ck);
  for (const [dx, dz] of [[-0.13, -0.1], [0.13, -0.1], [-0.13, 0.1], [0.13, 0.1]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 24).rotateX(-Math.PI / 2), stdMat('#6a6e74'));
    ring.position.set(2.55 + dx, K.height + 0.013, cz + dz);
    grp.add(ring);
  }
  const kettle = new THREE.Group();
  const kb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), stdMat('#e86a52', { roughness: 0.25, metalness: 0.2 }));
  kb.scale.set(1, 0.85, 1);
  kb.position.y = 0.085;
  const kl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.03, 12), stdMat('#2a1c14'));
  kl.position.y = 0.17;
  const kspout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.12, 8), kb.material);
  kspout.position.set(0.1, 0.11, 0);
  kspout.rotation.z = -0.9;
  const kh = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 16, Math.PI), stdMat('#2a1c14'));
  kh.position.y = 0.15;
  kettle.add(kb, kl, kspout, kh);
  kettle.position.set(2.42, K.height + 0.012, cz - 0.1);
  grp.add(kettle);
  // fruteira e ervinha no tampo
  const fb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 8, 0, TAU, Math.PI / 2, Math.PI / 2), stdMat('#f4efe6', { roughness: 0.4 }));
  fb.rotation.x = Math.PI;
  fb.position.set(4.6, K.height + 0.1, cz);
  grp.add(fb);
  const fr = rng(3);
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), stdMat(['#e8493a', '#f2a03a', '#f5d43a', '#8fbf4a', '#e8493a'][i], { roughness: 0.5 }));
    const a = (i / 5) * TAU;
    f.position.set(4.6 + Math.cos(a) * 0.06, K.height + 0.07 + fr() * 0.03, cz + Math.sin(a) * 0.06);
    grp.add(f);
  }
  const herbPot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 12), stdMat('#c9764f'));
  herbPot.position.set(3.1, K.height + 0.05, cz - 0.15);
  const herb = new THREE.Mesh(boxwood(0.07, 91), plantMat());
  herb.position.set(3.1, K.height + 0.14, cz - 0.15);
  grp.add(herbPot, herb);
  // ---- armários de cima (dos lados da janela)
  for (const [x0, x1] of [[2.1, 2.9], [4.3, 5.1]]) {
    const up = new THREE.Mesh(rbox(x1 - x0, 0.62, 0.34, 0.012), cabMat);
    up.position.set((x0 + x1) / 2, 1.85, -3.63);
    grp.add(up);
    const n2 = 2;
    for (let i = 0; i < n2; i++) {
      const x = x0 + (i + 0.5) * ((x1 - x0) / n2);
      const door = new THREE.Mesh(rbox((x1 - x0) / n2 - 0.025, 0.56, 0.02, 0.008), stdMat('#88a594', { roughness: 0.5 }));
      door.position.set(x, 1.85, -3.455);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.02), handleMat);
      h.position.set(x + (i ? -1 : 1) * 0.15, 1.65, -3.44);
      grp.add(door, h);
    }
  }
  // ---- geladeira retrô com ímãs
  const fMat = stdMat('#f2e6d0', { roughness: 0.3, metalness: 0.1 });
  const fridge = new THREE.Mesh(rbox(F.hx * 2, F.height, F.hz * 2, 0.08), fMat);
  fridge.position.set(F.x, F.height / 2, F.z);
  const line = new THREE.Mesh(new THREE.BoxGeometry(F.hx * 2 - 0.04, 0.012, 0.01), stdMat('#c9b9a2'));
  line.position.set(F.x, F.height * 0.66, F.z + F.hz + 0.003);
  grp.add(fridge, line);
  for (const y of [F.height * 0.8, F.height * 0.5]) {
    const h = new THREE.Mesh(rbox(0.04, 0.22, 0.04, 0.015), handleMat);
    h.position.set(F.x - F.hx + 0.08, y, F.z + F.hz + 0.03);
    grp.add(h);
  }
  const mr = rng(7);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(i % 2 ? new THREE.CircleGeometry(0.035, 12) : new THREE.PlaneGeometry(0.08, 0.1), stdMat(['#e86a52', '#3f6f78', '#f2c14e', '#7f9c8a', '#ffffff', '#d94a5a'][i], { roughness: 0.6 }));
    m.position.set(F.x - 0.12 + mr() * 0.3, F.height * 0.72 + mr() * 0.35, F.z + F.hz + 0.004);
    m.rotation.z = (mr() - 0.5) * 0.4;
    grp.add(m);
  }
  // desenho preso na geladeira (as dogs!)
  const drawing = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), new THREE.MeshStandardMaterial({
    map: canvasTexture(128, 96, (g, cw, ch) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, cw, ch);
      g.lineWidth = 3; g.strokeStyle = '#4a3426';
      g.fillStyle = '#f2d3a0'; g.beginPath(); g.ellipse(40, 56, 22, 16, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#fbf6ec'; g.beginPath(); g.ellipse(88, 52, 26, 19, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#e86a7a'; g.beginPath(); g.arc(64, 20, 8, 0, TAU); g.fill();
    }, { repeat: false }), roughness: 0.9,
  }));
  drawing.position.set(F.x + 0.08, F.height * 0.42, F.z + F.hz + 0.004);
  drawing.rotation.z = 0.06;
  grp.add(drawing);

  // ---- saco de ração e potinhos
  const bag = new THREE.Group();
  const bagMat = new THREE.MeshStandardMaterial({
    map: canvasTexture(128, 160, (g, cw, ch) => {
      g.fillStyle = '#e86a52'; g.fillRect(0, 0, cw, ch);
      g.fillStyle = '#fff6e6'; g.beginPath(); g.ellipse(cw / 2, ch * 0.45, 40, 34, 0, 0, TAU); g.fill();
      g.fillStyle = '#4a3426';
      g.beginPath(); g.ellipse(cw / 2, ch * 0.5, 14, 11, 0, 0, TAU); g.fill();
      for (const [dx, dy] of [[-16, -16], [-6, -24], [6, -24], [16, -16]]) { g.beginPath(); g.ellipse(cw / 2 + dx, ch * 0.5 + dy, 5, 6, 0, 0, TAU); g.fill(); }
      g.font = '700 22px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('RAÇÃO', cw / 2, ch * 0.82);
    }, { repeat: false }), roughness: 0.7,
  });
  const sack = new THREE.Mesh(rbox(0.42, 0.62, 0.3, 0.08), [stdMat('#d95a44', { roughness: 0.7 }), stdMat('#d95a44', { roughness: 0.7 }), stdMat('#d95a44', { roughness: 0.7 }), stdMat('#d95a44', { roughness: 0.7 }), bagMat, stdMat('#d95a44', { roughness: 0.7 })]);
  sack.position.y = 0.31;
  const fold = new THREE.Mesh(rbox(0.42, 0.06, 0.12, 0.02), stdMat('#c24e3a', { roughness: 0.7 }));
  fold.position.set(0, 0.64, -0.06);
  bag.add(sack, fold);
  bag.position.set(2.5, 0, -2.75);
  bag.rotation.y = 0.25;
  grp.add(bag);
  /** @type {[number, string][]} */
  const bowls = [[3.0, '#9a5a2a'], [3.32, '#8fc8e8']];
  for (const [x, fill] of bowls) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 20, 1, true), stdMat('#c6cbcf', { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
    b.position.set(x, 0.03, -2.65);
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.095, 20).rotateX(-Math.PI / 2), stdMat(fill, { roughness: fill === '#8fc8e8' ? 0.05 : 0.9 }));
    f.position.set(x, 0.045, -2.65);
    grp.add(b, f);
  }
  // ---- pilhas de caixas da mudança (decoração com colisão)
  const stackA = new THREE.Group();
  const b1 = movingBox(0.6, 0.42, 0.7, 'COZINHA', 11);
  const b2 = movingBox(0.52, 0.38, 0.6, 'FRÁGIL', 12);
  b2.position.y = 0.42;
  b2.rotation.y = 0.12;
  stackA.add(b1, b2);
  stackA.position.set(2.42, 0, -1.2);
  stackA.rotation.y = Math.PI / 2;
  const stackB = new THREE.Group();
  const b3 = movingBox(0.7, 0.44, 0.62, 'PANELAS', 13);
  const b4 = movingBox(0.56, 0.36, 0.5, 'COPOS', 14);
  b4.position.y = 0.44;
  b4.rotation.y = -0.2;
  const b5 = movingBox(0.42, 0.3, 0.4, '', 15);
  b5.position.y = 0.8;
  b5.rotation.y = 0.3;
  stackB.add(b3, b4, b5);
  stackB.position.set(5.75, 0, 2.8);
  grp.add(stackA, stackB);
  // ---- cadeiras (2 empurradas do lado norte da mesa, 1 puxada no leste)
  const chairWood = woodMat('#a87a52', { key: 'f5-oak', rough: 0.6 });
  const chair = (x, z, rot) => {
    const c = new THREE.Group();
    const seat = new THREE.Mesh(rbox(0.4, 0.04, 0.38, 0.012), chairWood);
    seat.position.y = 0.45;
    const cush = new THREE.Mesh(rbox(0.34, 0.035, 0.32, 0.015), stdMat('#e86a52', { roughness: 0.95 }));
    cush.position.y = 0.485;
    const back = new THREE.Group();
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(rbox(0.035, 0.5, 0.035, 0.008), chairWood);
      p.position.set(sx * 0.17, 0.7, -0.17);
      back.add(p);
    }
    for (const y of [0.78, 0.9]) {
      const s = new THREE.Mesh(rbox(0.36, 0.05, 0.025, 0.008), chairWood);
      s.position.set(0, y, -0.17);
      back.add(s);
    }
    c.add(seat, cush, back);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.45, 6), chairWood);
      l.position.set(sx * 0.17, 0.225, sz * 0.16);
      c.add(l);
    }
    c.position.set(x, 0, z);
    c.rotation.y = rot;
    return c;
  };
  grp.add(
    chair(T.x - 0.3, T.z - T.hz - 0.12, 0),
    chair(T.x + 0.3, T.z - T.hz - 0.12, 0),
    chair(T.x + T.hx + 0.42, T.z + 0.15, -Math.PI / 2 - 0.3),
  );
  shadowAll(grp);
  root.add(grp);
  const sh = contactShadow(0.5, 0.4, 0.3);
  sh.position.set(F.x, 0.004, F.z + 0.05);
  root.add(sh);
  return { group: grp };
}

export function buildFurniture({ root, layout }) {
  const updaters = [];
  const sala = buildLivingRoom(root, layout);
  const hall = buildHall(root, layout, updaters);
  const kitchen = buildKitchen(root, layout);
  return { sala, hall, kitchen, update: (dt, t) => { for (const f of updaters) f(dt, t); } };
}
