// FASE 9 · O escritório do vovô: armário alto de madeira (o Bichano dorme em cima, deitado no livro), escrivaninha com
// a máquina de escrever, a luminária acesa e papéis (a Radhija passa por baixo), cadeira, arquivo de aço, cesto de
// papel, quadro do veleiro, tapetinho e a porta (folha com almofadas e a maçaneta de alavanca dos dois lados).
// A porta segue o contrato do portão com dobradiça: yaw = closedYaw + (openYaw − closedYaw)·t, folha ao longo de −Z.
import * as THREE from 'three';
import { rbox, canvasTexture, stdMat, woodMat, contactShadow, shadowAll } from '../../../world/util.js';

const TAU = Math.PI * 2;

function sailboatTexture() {
  return canvasTexture(160, 120, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#9cc0d8'); sky.addColorStop(0.6, '#d8e4ea'); sky.addColorStop(0.61, '#3f6f8a'); sky.addColorStop(1, '#2a4f66');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7a4a2a';
    g.beginPath(); g.moveTo(52, 82); g.lineTo(112, 82); g.lineTo(104, 92); g.lineTo(60, 92); g.closePath(); g.fill();
    g.fillStyle = '#f4ecd8';
    g.beginPath(); g.moveTo(82, 22); g.lineTo(82, 80); g.lineTo(54, 80); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(85, 30); g.lineTo(85, 80); g.lineTo(108, 80); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 6; i++) g.fillRect(10 + i * 26, 98 + (i % 2) * 6, 14, 2);
  }, { repeat: false });
}

/** Armário alto de duas portas, com cornija e puxadores de latão. Topo em WARDROBE.h. */
function buildWardrobe(root, W) {
  const grp = new THREE.Group();
  grp.name = 'armario';
  grp.position.set(W.x, 0, W.z);
  const wood = woodMat('#5a3a24', { key: 'f9-armario', rough: 0.5 });
  const dark = woodMat('#4a2e1c', { key: 'f9-armario-escuro', rough: 0.55 });
  const brass = stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 });
  const body = new THREE.Mesh(rbox(W.hx * 2, W.h - 0.08, W.hz * 2, 0.015), wood);
  body.position.y = 0.04 + (W.h - 0.08) / 2;
  const plinth = new THREE.Mesh(rbox(W.hx * 2 + 0.03, 0.08, W.hz * 2 + 0.03, 0.01), dark);
  plinth.position.y = 0.04;
  const corn = new THREE.Mesh(rbox(W.hx * 2 + 0.08, 0.05, W.hz * 2 + 0.06, 0.012), dark);
  corn.position.y = W.h - 0.025;
  grp.add(body, plinth, corn);
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(rbox(W.hx - 0.03, W.h - 0.28, 0.02, 0.01), dark);
    door.position.set(s * (W.hx / 2), 0.14 + (W.h - 0.28) / 2, W.hz + 0.006);
    const panel = new THREE.Mesh(rbox(W.hx - 0.12, W.h - 0.5, 0.012, 0.012), wood);
    panel.position.set(s * (W.hx / 2), 0.14 + (W.h - 0.28) / 2, W.hz + 0.02);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), brass);
    knob.position.set(s * 0.04, 1.0, W.hz + 0.035);
    grp.add(door, panel, knob);
  }
  shadowAll(grp);
  root.add(grp);
  return grp;
}

/** Escrivaninha de pés finos (vão livre embaixo), com gavetinha, máquina de escrever, luminária e papéis. */
function buildDesk(root, D) {
  const grp = new THREE.Group();
  grp.name = 'escrivaninha';
  grp.position.set(D.x, 0, D.z);
  const wood = woodMat('#6b4630', { key: 'f9-escrivaninha', rough: 0.45 });
  const top = new THREE.Mesh(rbox(D.hx * 2, 0.04, D.hz * 2, 0.012), wood);
  top.position.y = D.h - 0.02;
  const apron = new THREE.Mesh(rbox(D.hx * 2 - 0.04, 0.09, D.hz * 2 - 0.04, 0.01), wood);
  apron.position.y = D.h - 0.085;
  grp.add(top, apron);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, D.h - 0.06, 8), wood);
    leg.position.set(sx * (D.hx - 0.05), (D.h - 0.06) / 2, sz * (D.hz - 0.05));
    grp.add(leg);
  }
  // máquina de escrever (corpo, teclinhas, rolo e papel)
  const tw = new THREE.Group();
  tw.position.set(0.04, D.h, -0.05);
  tw.rotation.y = Math.PI / 2;
  const body = new THREE.Mesh(rbox(0.3, 0.1, 0.24, 0.03), stdMat('#2f5a46', { roughness: 0.35, metalness: 0.3 }));
  body.position.y = 0.05;
  const keysMat = stdMat('#f1ead8', { roughness: 0.4 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.008, 8), keysMat);
    k.position.set(-0.11 + c * 0.0275, 0.1 + r * 0.008, 0.07 - r * 0.026);
    tw.add(k);
  }
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 12).rotateZ(Math.PI / 2), stdMat('#1d1d1d', { roughness: 0.5 }));
  roller.position.set(0, 0.12, -0.08);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.16), stdMat('#fbf7ec', { roughness: 0.8, side: THREE.DoubleSide }));
  paper.position.set(0, 0.2, -0.09);
  paper.rotation.x = -0.15;
  tw.add(body, roller, paper);
  grp.add(tw);
  // luminária de mesa (cúpula verde de banqueiro) acesa
  const lamp = new THREE.Group();
  lamp.position.set(-0.05, D.h, 0.42);
  const brass = stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.025, 16), brass);
  base.position.y = 0.012;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 8), brass);
  stem.position.y = 0.15;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.1, 0.07, 20, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#2f6a4a', roughness: 0.3, emissive: '#1f4a32', emissiveIntensity: 0.3, side: THREE.DoubleSide }));
  shade.rotation.set(0, Math.PI / 2, Math.PI / 2);
  shade.position.set(0, 0.29, 0);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff1c8' }));
  bulb.position.set(0, 0.27, 0);
  lamp.add(base, stem, shade, bulb);
  grp.add(lamp);
  // papéis espalhados, porta-lápis e um livro aberto
  const paperMat = stdMat('#f8f3e6', { roughness: 0.85 });
  for (const [x, z, r] of [[0.06, 0.22, 0.2], [-0.08, 0.28, -0.3], [0.1, -0.42, 0.5]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.002, 0.22), paperMat);
    p.position.set(x, D.h + 0.003 + Math.abs(r) * 0.002, z);
    p.rotation.y = r;
    grp.add(p);
  }
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 12, 1, true), stdMat('#7a2a28', { roughness: 0.6, side: THREE.DoubleSide }));
  cup.position.set(-0.18, D.h + 0.045, -0.5);
  grp.add(cup);
  for (const [dx, c] of /** @type {[number, string][]} */ ([[-0.01, '#e8c040'], [0.012, '#3f6f8a'], [0.0, '#d94a3a']])) {
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.15, 6), stdMat(c, { roughness: 0.4 }));
    pen.position.set(-0.18 + dx, D.h + 0.1, -0.5 + dx);
    pen.rotation.z = dx * 6;
    grp.add(pen);
  }
  shadowAll(grp);
  root.add(grp);
  return { group: grp, lampPos: new THREE.Vector3(D.x - 0.05, D.h + 0.27, D.z + 0.42) };
}

/** Cadeira de escritório com rodinhas e encosto de couro. */
function buildChair(root, C) {
  const grp = new THREE.Group();
  grp.position.set(C.x, 0, C.z);
  grp.rotation.y = -1.9;
  const leather = new THREE.MeshPhysicalMaterial({ color: '#5a2a1c', roughness: 0.45, clearcoat: 0.3 });
  const metal = stdMat('#3a3a3a', { roughness: 0.4, metalness: 0.6 });
  const seat = new THREE.Mesh(rbox(0.42, 0.08, 0.4, 0.04), leather);
  seat.position.y = 0.46;
  const back = new THREE.Mesh(rbox(0.4, 0.42, 0.07, 0.05), leather);
  back.position.set(0, 0.74, -0.18);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8), metal);
  post.position.y = 0.26;
  grp.add(seat, back, post);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const arm = new THREE.Mesh(rbox(0.04, 0.03, 0.26, 0.01), metal);
    arm.position.set(Math.sin(a) * 0.12, 0.07, Math.cos(a) * 0.12);
    arm.rotation.y = a;
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), stdMat('#1f1f1f'));
    w.position.set(Math.sin(a) * 0.24, 0.028, Math.cos(a) * 0.24);
    grp.add(arm, w);
  }
  shadowAll(grp);
  root.add(grp);
}

/**
 * Porta do escritório: grupo no pivô da dobradiça; a folha vai ao longo de −Z local (do pivô até o batente da
 * fechadura). setOpen(t) gira de closedYaw a openYaw (o mesmo cálculo da colisão).
 */
function buildDoor(root, cfg, cutH) {
  const pivot = new THREE.Group();
  pivot.name = 'porta-escritorio';
  pivot.position.set(cfg.hinge.x, 0, cfg.hinge.z);
  const wood = woodMat('#6b4630', { key: 'f9-porta-escritorio', rough: 0.55 });
  const light = woodMat('#7a5236', { key: 'f9-porta-almofada', rough: 0.5 });
  const L = cfg.length;
  const H = Math.min(cfg.height, cutH + 0.02); // a folha acompanha o corte da maquete
  const leaf = new THREE.Mesh(rbox(0.045, H, L - 0.02, 0.01), wood);
  leaf.position.set(0, H / 2, -L / 2);
  pivot.add(leaf);
  for (const s of [-1, 1]) for (const y of [0.35, 0.95]) {
    const p = new THREE.Mesh(rbox(0.012, 0.42, L * 0.36, 0.01), light);
    p.position.set(s * 0.026, y, -L / 2);
    pivot.add(p);
  }
  // maçaneta de alavanca dos dois lados, perto do batente
  const brass = stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 });
  for (const s of [-1, 1]) {
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 14).rotateZ(Math.PI / 2), brass);
    rose.position.set(s * 0.03, 0.95, -L + 0.09);
    const lever = new THREE.Mesh(rbox(0.02, 0.018, 0.11, 0.006), brass);
    lever.position.set(s * 0.045, 0.95, -L + 0.13);
    pivot.add(rose, lever);
  }
  shadowAll(pivot);
  root.add(pivot);
  return {
    object: pivot,
    setOpen(t) { pivot.rotation.y = (cfg.closedYaw ?? 0) + (cfg.openYaw - (cfg.closedYaw ?? 0)) * t; },
  };
}

export function buildOffice({ root, layout }) {
  const { WARDROBE, DESK, DESK_CHAIR, DOOR, WALLS, WORLD } = layout;
  const B = WORLD.bounds;
  buildWardrobe(root, WARDROBE);
  const desk = buildDesk(root, DESK);
  buildChair(root, DESK_CHAIR);
  // arquivo de aço com três gavetas
  const cab = new THREE.Group();
  cab.position.set(-5.15, 0, -3.35);
  const steel = stdMat('#7a8a86', { roughness: 0.4, metalness: 0.55 });
  const cbody = new THREE.Mesh(rbox(0.6, 1.05, 0.5, 0.012), steel);
  cbody.position.y = 0.525;
  cab.add(cbody);
  for (let i = 0; i < 3; i++) {
    const dr = new THREE.Mesh(rbox(0.54, 0.3, 0.02, 0.01), stdMat('#86968f', { roughness: 0.4, metalness: 0.55 }));
    dr.position.set(0, 0.2 + i * 0.33, 0.255);
    const h = new THREE.Mesh(rbox(0.12, 0.02, 0.03, 0.006), stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 }));
    h.position.set(0, 0.26 + i * 0.33, 0.275);
    cab.add(dr, h);
  }
  // pilha de pastas em cima do arquivo
  for (let k = 0; k < 4; k++) {
    const f = new THREE.Mesh(rbox(0.32, 0.03, 0.24, 0.006), stdMat(['#d8b25a', '#9c2f2a', '#3f6f8a', '#e8dcc0'][k], { roughness: 0.8 }));
    f.position.set(0.02 * (k % 2), 1.065 + k * 0.032, 0);
    f.rotation.y = (k - 1.5) * 0.08;
    cab.add(f);
  }
  shadowAll(cab);
  root.add(cab);
  // cesto de papel com bolinhas de papel amassado
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.28, 16, 1, true), stdMat('#8a6a4a', { roughness: 0.9, side: THREE.DoubleSide }));
  basket.position.set(-7.6, 0.14, 0.45);
  root.add(basket);
  for (let i = 0; i < 4; i++) {
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), stdMat('#f4efe2', { roughness: 0.9 }));
    ball.position.set(-7.6 + Math.sin(i * 2) * 0.05, 0.26 + (i % 2) * 0.03, 0.45 + Math.cos(i * 2) * 0.05);
    root.add(ball);
  }
  // quadro do veleiro e um tapetinho
  const frame = new THREE.Mesh(rbox(0.66, 0.52, 0.03, 0.01), woodMat('#c99a45', { key: 'f9-moldura', rough: 0.35 }));
  frame.position.set(-6.05, 1.6, B.minZ + 0.016);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.44), new THREE.MeshStandardMaterial({ map: sailboatTexture(), roughness: 0.6 }));
  pic.position.set(-6.05, 1.6, B.minZ + 0.0345);
  root.add(frame, pic);
  const rug = new THREE.Mesh(rbox(1.6, 0.008, 1.0, 0.004), new THREE.MeshStandardMaterial({ map: canvasTexture(128, 80, (g, w, h) => {
    g.fillStyle = '#3f5a6b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8cba8'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#b06a4a';
    for (let i = 0; i < 5; i++) g.fillRect(20 + i * 20, h / 2 - 6, 10, 12);
  }, { repeat: false }), roughness: 0.95 }));
  rug.position.set(-6.2, 0.005, -0.9);
  rug.receiveShadow = true;
  root.add(rug);
  const door = buildDoor(root, DOOR, WALLS.cutH);
  const sh = contactShadow(WARDROBE.hx + 0.1, WARDROBE.hz + 0.1, 0.5);
  sh.position.set(WARDROBE.x, 0.004, WARDROBE.z);
  root.add(sh);
  return { door, deskLampPos: desk.lampPos };
}
