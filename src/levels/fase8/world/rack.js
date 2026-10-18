// FASE 8 · Varal elétrico de teto: quatro varetas de madeira presas em duas cabeceiras de metal, penduradas por
// cordas que somem para cima (a maquete não tem teto). Roupinhas presas com pregadores: uma toalhinha, um par de
// meias azuis, uma bandana e a MEIA LISTRADA na vareta sul (em sockAnchor; o pregador fica no varal quando ela sai).
// setLower(t): 0 lá em cima … 1 embaixo, com um balancinho quando para.
import * as THREE from 'three';
import { rbox, stdMat, woodMat, shadowAll } from '../../../world/util.js';

const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };

/** Pregador de madeira (duas lâminas e a mola), com o topo em y = 0. */
function clothespin(color = '#d8b48a') {
  const g = new THREE.Group();
  const wood = stdMat(color, { roughness: 0.7 });
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(rbox(0.012, 0.07, 0.008, 0.003), wood);
    blade.position.set(0, -0.03, s * 0.005);
    blade.rotation.x = -s * 0.08;
    g.add(blade);
  }
  const spring = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 6, 12), new THREE.MeshStandardMaterial({ color: '#c9c4bb', roughness: 0.3, metalness: 0.8 }));
  spring.rotation.y = Math.PI / 2;
  spring.position.y = -0.03;
  g.add(spring);
  return g;
}

/** Toalhinha dobrada por cima da vareta (dois panos caindo, um de cada lado). */
function towel(color, w = 0.3, h = 0.2) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(w, h, 8, 4);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w) * Math.PI * 3) * 0.006);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, -h / 2 - 0.012, s * 0.016);
    m.rotation.x = s * 0.08;
    g.add(m);
  }
  const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, w, 10).rotateZ(Math.PI / 2), mat);
  g.add(fold);
  return g;
}

/** Meinha simples (cano e pé) presa pelo punho, com o topo em y = 0. */
function smallSock(color) {
  const g = new THREE.Group();
  const mat = stdMat(color, { roughness: 0.95 });
  const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.12, 4, 10), mat);
  leg.position.y = -0.08;
  const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.07, 4, 10).rotateX(Math.PI / 2), mat);
  foot.position.set(0, -0.16, 0.04);
  g.add(leg, foot);
  return g;
}

/**
 * @param {{ root: THREE.Object3D, layout: import('../../../types').LevelLayout, sock: THREE.Object3D }} args
 * → { object, sockAnchor, setLower(t), update(dt, t) }
 */
export function buildRack({ root, layout, sock }) {
  const { RACK: R, SOCK } = layout;
  const cx = (R.x0 + R.x1) / 2;
  const L = R.x1 - R.x0;
  const rack = new THREE.Group();
  rack.name = 'varal';
  rack.position.set(cx, R.up, R.z);
  // varetas e cabeceiras
  const wood = woodMat('#c99a6a', { key: 'f8-varal', rough: 0.55 });
  const zs = [-R.halfDepth, -R.halfDepth / 3, R.halfDepth / 3, R.halfDepth];
  for (const z of zs) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, L, 10).rotateZ(Math.PI / 2), wood);
    bar.position.z = z;
    rack.add(bar);
  }
  const metal = new THREE.MeshStandardMaterial({ color: '#dfe2e4', roughness: 0.3, metalness: 0.7 });
  for (const x of [-L / 2 + 0.03, L / 2 - 0.03]) {
    const head = new THREE.Mesh(rbox(0.03, 0.04, R.halfDepth * 2 + 0.06, 0.008), metal);
    head.position.x = x;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 12), metal);
    hook.position.set(x, 0.04, 0);
    rack.add(head, hook);
  }
  // roupinhas
  const pinAt = (x, z, color) => { const p = clothespin(color); p.position.set(x, 0.022, z); rack.add(p); return p; };
  const t1 = towel('#7fb0c8', 0.3, 0.2);
  t1.position.set(-0.62, 0, -R.halfDepth / 3);
  rack.add(t1);
  for (const [dx, c] of /** @type {[number, string][]} */ ([[-0.12, '#3f6f78'], [0.02, '#3f6f78']])) {
    const s = smallSock(c);
    s.position.set(dx, -0.012, -R.halfDepth);
    s.rotation.y = 0.2;
    rack.add(s);
    pinAt(dx, -R.halfDepth, '#f2c14e');
  }
  const bandana = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 3, 1), new THREE.MeshStandardMaterial({ color: '#e89ab0', roughness: 0.95 }));
  bandana.scale.z = 0.12;
  bandana.rotation.x = Math.PI;
  bandana.position.set(0.6, -0.09, R.halfDepth / 3);
  rack.add(bandana);
  pinAt(0.6, R.halfDepth / 3, '#7f9c8a');
  // a meia listrada: pregador vermelho no varal e o ponto onde ela fica
  const sx = SOCK.x - cx;
  pinAt(sx, R.halfDepth, '#e8554a');
  const sockAnchor = new THREE.Object3D();
  sockAnchor.name = 'varal:meia';
  sockAnchor.position.set(sx, -0.012, R.halfDepth);
  rack.add(sockAnchor);
  sockAnchor.add(sock);
  shadowAll(rack);
  root.add(rack);

  // cordas: das cabeceiras até bem alto (somem acima do quadro); o comprimento acompanha a altura
  const cordMat = stdMat('#f4efe6', { roughness: 0.8 });
  const TOP = 4.6;
  const cords = [];
  for (const x of [-L / 2 + 0.03, L / 2 - 0.03]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 5), cordMat);
    c.position.set(cx + x, 0, R.z);
    root.add(c);
    cords.push(c);
  }

  const S = { t: 0, y: R.up, v: 0, sway: 0, swayV: 0 };
  const place = () => {
    rack.position.y = S.y + 0;
    rack.rotation.x = S.sway;
    for (const c of cords) {
      const h = TOP - (S.y + 0.06);
      c.scale.y = h;
      c.position.y = S.y + 0.06 + h / 2;
    }
  };
  place();
  return {
    object: rack,
    sockAnchor,
    /** 0 em cima … 1 embaixo (o puzzle avança o tempo). */
    setLower(t) { S.t = Math.min(1, Math.max(0, t)); },
    /** @param {number} dt */
    update(dt) {
      const y = R.up + (R.down - R.up) * smooth(S.t);
      const v = (y - S.y) / Math.max(dt, 1e-3);
      // quando para (ou muda de sentido), balança um pouco e acalma
      S.swayV += (-(v - S.v) * 0.02 - S.sway * 40 - S.swayV * 5) * dt;
      S.sway += S.swayV * dt;
      S.v = v;
      S.y = y;
      place();
    },
    reset() { S.t = 0; S.y = R.up; S.v = 0; S.sway = 0; S.swayV = 0; place(); },
  };
}
