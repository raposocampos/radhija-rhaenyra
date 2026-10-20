// FASE 10 · O cantinho do outro lado do muro leste, atrás da casa na árvore: a tábua solta do muro (dobradiça no
// norte; abre para o leste) e, lá dentro, sob o telheiro do vizinho, o quadro com a foto das duas filhotes (com as
// luzinhas em volta, a plaquinha e os primeiros brinquedos delas no tapetinho). Fica fora da vista da câmera.
// O cantinho é um nicho da largura exata da fresta (sem cantos para ficar presa) e a tábua abre para fora.
// API: buildSecret(root, layout) → { group, board: { object, setOpen(t), setLoose(on) }, photoAt, seeThrough, update(dt, t) }
import * as THREE from 'three';
import { rbox, canvasTexture, stdMat, woodMat, brassMat } from '../../../world/util.js';

const TAU = Math.PI * 2;
const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Plaquinha de latão com o texto. */
function plaqueTexture(text) {
  return canvasTexture(256, 56, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e9c46a'); gr.addColorStop(1, '#b8892f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7a5520'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#4a3010'; g.font = 'italic bold 24px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 1);
  }, { repeat: false });
}

/** A foto (a imagem limpa em public/img; no Node, sem carregador de imagens, fica a cor de fundo). */
function photoMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: '#f6e6d6' });
  try {
    if (typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
      new THREE.TextureLoader().load('img/quintal-quadro.jpg', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        m.map = tex;
        m.color.set('#ffffff');
        m.needsUpdate = true;
      }, undefined, () => {});
    }
  } catch { /* sem imagem: fica a moldura com o fundo claro */ }
  return m;
}

/** @param {THREE.Object3D} root @param {import('../../../types').LevelLayout} layout */
export function buildSecret(root, layout) {
  const { SECRET, EAST_WALL } = layout;
  const N = SECRET.nook;
  const group = new THREE.Group();
  group.name = 'cantinho';
  const wallH = 1.9;

  // ---------------- a tábua solta do muro (pivô no norte da fresta; a folha vai ao longo de +Z)
  const bw = SECRET.board.z1 - SECRET.board.z0;
  const boardMat = woodMat('#92623f', { key: 'f10-tabua-solta', vertical: true, rough: 0.9 });
  const pivot = new THREE.Group();
  const panel = new THREE.Mesh(rbox(EAST_WALL.t, wallH - 0.04, bw - 0.012, 0.008), boardMat);
  panel.position.set(0, (wallH - 0.04) / 2, bw / 2);
  panel.castShadow = true;
  panel.receiveShadow = true;
  // dois pregos frouxos e um tufo de grama na fresta
  const nailM = stdMat('#5a5650', { metalness: 0.7, roughness: 0.4 });
  for (const y of [0.4, 1.5]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6).rotateZ(Math.PI / 2), nailM);
    n.position.set(-EAST_WALL.t / 2 - 0.006, y, bw - 0.06);
    pivot.add(n);
  }
  pivot.add(panel);
  pivot.position.set(EAST_WALL.x, 0, SECRET.board.z0);
  group.add(pivot);

  // ---------------- o cantinho: paredes do vizinho, telheiro, tapetinho e os brinquedos
  const nook = new THREE.Group();
  const fenceMat = woodMat('#7a5a3c', { key: 'f10-vizinho', vertical: true, rough: 0.9 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, wallH, N.z1 - N.z0), fenceMat);
  back.position.set(N.x1 + 0.03, wallH / 2, (N.z0 + N.z1) / 2);
  nook.add(back);
  for (const z of [N.z0 - 0.03, N.z1 + 0.03]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(N.x1 - N.x0, wallH, 0.06), fenceMat);
    side.position.set((N.x0 + N.x1) / 2 + 0.002, wallH / 2, z);
    nook.add(side);
  }
  // telheiro (esconde o cantinho de cima)
  const roof = new THREE.Mesh(rbox(N.x1 - N.x0 + 0.5, 0.05, N.z1 - N.z0 + 0.5, 0.01), stdMat('#8a3a2a', { roughness: 0.8 }));
  roof.position.set((N.x0 + N.x1) / 2 + 0.1, wallH + 0.12, (N.z0 + N.z1) / 2);
  roof.rotation.z = -0.12;
  nook.add(roof);
  // tapetinho redondo e os brinquedos de filhote (o ossinho rosa e a bolinha)
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.01, 28), stdMat('#f3c6d4', { roughness: 1 }));
  rug.position.set((N.x0 + N.x1) / 2 + 0.05, 0.006, SECRET.photo.z);
  rug.scale.z = 0.8;
  nook.add(rug);
  const toyBone = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 10).rotateZ(Math.PI / 2), stdMat('#ff6fae', { roughness: 0.5 }));
  toyBone.add(shaft);
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), shaft.material);
    knob.position.set(s * 0.085, 0, t * 0.018);
    toyBone.add(knob);
  }
  toyBone.position.set(SECRET.photo.x - 0.42, 0.04, SECRET.photo.z + 0.16);
  toyBone.rotation.y = 0.6;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), stdMat('#7cc4e8', { roughness: 0.45 }));
  ball.position.set(SECRET.photo.x - 0.55, 0.05, SECRET.photo.z - 0.17);
  nook.add(toyBone, ball);
  nook.traverse((o) => { if (/** @type {THREE.Mesh} */ (o).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(nook);

  // ---------------- o quadro: moldura de madeira dourada, a foto, a plaquinha e as luzinhas em volta
  const P = SECRET.photo;
  const frame = new THREE.Group();
  const gilt = new THREE.MeshStandardMaterial({ color: '#d6a84c', metalness: 0.75, roughness: 0.35 });
  const fw = 0.05;
  const backing = new THREE.Mesh(new THREE.BoxGeometry(0.02, P.h + fw * 2, P.w + fw * 2), stdMat('#3a2a20'));
  frame.add(backing);
  for (const [y, z, h, w] of [[P.h / 2 + fw / 2, 0, fw, P.w + fw * 2], [-P.h / 2 - fw / 2, 0, fw, P.w + fw * 2], [0, P.w / 2 + fw / 2, P.h, fw], [0, -P.w / 2 - fw / 2, P.h, fw]]) {
    const f = new THREE.Mesh(rbox(0.04, h, w, 0.012), gilt);
    f.position.set(-0.02, y, z);
    frame.add(f);
  }
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(P.w, P.h), photoMaterial());
  photo.rotation.y = -Math.PI / 2;
  photo.position.x = -0.0125;
  frame.add(photo);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.075), new THREE.MeshStandardMaterial({ map: plaqueTexture('Raniri e Radidi'), metalness: 0.4, roughness: 0.4 }));
  plaque.rotation.y = -Math.PI / 2;
  plaque.position.set(-0.012, -P.h / 2 - fw - 0.08, 0);
  frame.add(plaque);
  // luzinhas: um arco de lampadinhas por cima da moldura
  const nb = 13;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), nb);
  const bulbAt = [];
  const bm = new THREE.Matrix4(), bc = new THREE.Color();
  for (let i = 0; i < nb; i++) {
    const u = i / (nb - 1);
    const z = (u - 0.5) * (P.w + 0.06);
    const y = P.h / 2 + fw + 0.07 + Math.sin(Math.PI * u) * 0.05 - 0.04 * Math.cos(TAU * u * 2);
    bulbAt.push(new THREE.Vector3(-0.03, y, z));
    bulbs.setMatrixAt(i, bm.makeTranslation(-0.03, y, z));
    bulbs.setColorAt(i, bc.set(['#ffd36a', '#ff9ec8', '#9bdcff', '#fff1b0'][i % 4]).multiplyScalar(1.4));
  }
  frame.add(bulbs);
  frame.position.set(P.x, P.y, P.z);
  group.add(frame);
  // brilho quente na parede (sem luz de verdade)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({
    map: canvasTexture(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,214,150,0.6)'); gr.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, { repeat: false }),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.rotation.y = -Math.PI / 2;
  glow.position.set(N.x1 - 0.004, P.y + 0.05, P.z);
  group.add(glow);
  const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), brassMat());
  brass.position.set(N.x1 - 0.01, P.y + P.h / 2 + 0.2, P.z);
  group.add(brass);

  const st = { open: 0, loose: false, wob: 0 };
  root.add(group);
  return {
    group,
    photoAt: new THREE.Vector3(P.x, P.y, P.z),
    /** As paredes e o telheiro do nicho: com a dog lá dentro, a câmera vê através. */
    seeThrough: [nook, pivot],
    board: {
      object: pivot,
      /** 0 fechada … 1 aberta (para fora, para o quintal: o nicho fica livre). */
      setOpen(t) {
        st.open = Math.max(0, Math.min(1, t));
        pivot.rotation.y = -st.open * 1.45;
      },
      /** Depois de tudo achado, a tábua fica frouxa (balança de leve com o vento). */
      setLoose(on) { st.loose = !!on; },
    },
    update(dt, t) {
      st.wob = ease(st.wob, st.loose && st.open < 0.01 ? 1 : 0, dt, 2);
      pivot.rotation.y = -st.open * 1.45 + st.wob * 0.035 * (0.6 + 0.4 * Math.sin(t * 1.7));
      bulbAt.forEach((v, i) => {
        const k = 0.85 + 0.15 * Math.sin(t * 2.4 + i);
        bulbs.setMatrixAt(i, bm.makeScale(k, k, k).setPosition(v));
      });
      bulbs.instanceMatrix.needsUpdate = true;
    },
  };
}
