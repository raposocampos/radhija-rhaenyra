// PANDORÓPOLIS — a casa das dogs e o jardim da frente, com as três fases que acontecem aqui:
//   fase 1 (jardim, fim de tarde): a cerca divisória com o portão aberto e a cordinha no trinco, o carrinho de jardim
//     de madeira e a cenoura de pelúcia no nicho do outro lado, o bebedouro dos passarinhos com a poça;
//   fase 5 (dentro de casa, tarde de chuva): a casa em corte de maquete com a sala (sofá, caminha, cercadinho, tapete,
//     abajur), o corredor (escada, cabideiro, o portãozinho de bebê) e a cozinha (bancada, geladeira, a mesa com a
//     toalha comprida e o ursinho escondido embaixo), a barricada das caixas da mudança e a nuvem de chuva em cima;
//   fase 8 (lavanderia, manhã de domingo): o anexo em corte com o armário, a secadora, a máquina (a mantinha dobrada em
//     cima), o tanque, o varal de teto com a meia listrada no pregador, a tábua de passar, o cesto de rodinhas, a
//     caminha e a parede com as patinhas e os dois botões.
// API: buildCasa(kit, root, L) → { update(dt, t) }
import * as THREE from 'three';
import { rb, cyl, sphere, slab, picketFence } from './kit.js';
import { openHouse, rainCloud, lantern } from './pecas.js';
import { carrotTops } from '../../../world/plants.js';

const tiles = (hex, under = '#f3e9d8') => {
  const base = new THREE.Color(hex), ceil = new THREE.Color(under), c = new THREE.Color();
  return (p, n) => (n.y < -0.5 ? ceil : c.copy(base).offsetHSL(0, 0, Math.floor(p.y / 0.16) % 2 ? -0.035 : 0.02));
};
const check = (a, b, size = 0.12) => {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return (p) => ((Math.floor((p.x + 50) / size) + Math.floor((p.z + 50) / size)) % 2 ? ca : cb);
};
const planks = (a, b, w = 0.18) => {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return (p) => (Math.floor((p.x + 50) / w) % 2 ? ca : cb);
};

/**
 * @param {ReturnType<typeof import('./kit.js').createKit>} kit
 * @param {THREE.Group} root
 * @param {import('../../../types').LevelLayout} L
 */
export function buildCasa(kit, root, L) {
  const Hs = L.HOUSE;
  const A = Hs.annex;

  // ====================================================== fase 5: a casa em corte
  const H = openHouse(kit, {
    x: Hs.x, z: Hs.z, w: Hs.w, d: Hs.d, h: Hs.h, low: 1.05, wall: '#f6e6cb', inside: '#fbf1e1', floor: planks('#c99a6c', '#bf8f62'),
    door: { x: Hs.door.x, w: 1.1 }, windows: [-24.6, -19.4], roof: { kind: 'gable', h: 1.7, color: tiles('#d9733a'), open: 0.78, over: 0.4 },
  });
  // divisórias baixas (corte a meia altura): sala | corredor (vão do portãozinho), corredor | cozinha (vão das caixas)
  const divider = (x, gz0, gz1) => {
    kit.add(rb(0.12, 0.95, gz0 - (H.z0 + 0.16), 0.03, 1), { color: '#fbf1e1', x, z: (H.z0 + 0.16 + gz0) / 2 });
    kit.add(rb(0.12, 0.95, H.z1 - 0.16 - gz1, 0.03, 1), { color: '#fbf1e1', x, z: (gz1 + H.z1 - 0.16) / 2 });
    for (const zz of [(H.z0 + 0.16 + gz0) / 2, (gz1 + H.z1 - 0.16) / 2]) kit.add(rb(0.16, 0.05, 0.1, 0.01, 1), { color: '#fffaf0', x, y: 0.95, z: zz, sz: 1 });
  };
  divider(-23.0, 6.4, 7.4);
  divider(-21.0, 6.7, 7.7);
  // sala: sofá, tapete, caminha, cercadinho, abajur
  kit.add(rb(2.0, 0.42, 0.8, 0.1, 2), { color: '#6ec3e8', x: -25.4, y: 0.06, z: 4.85 });
  kit.add(rb(2.0, 0.5, 0.22, 0.1, 2), { color: '#5aaed4', x: -25.4, y: 0.46, z: 4.5 });
  for (const s of [-1, 1]) kit.add(rb(0.22, 0.56, 0.8, 0.1, 2), { color: '#5aaed4', x: -25.4 + s * 0.98, y: 0.06, z: 4.85 });
  for (const s of [-0.5, 0.5]) kit.add(rb(0.6, 0.14, 0.5, 0.07, 2), { color: '#fffaf0', x: -25.4 + s, y: 0.5, z: 4.95 });
  kit.add(cyl(0.95, 0.95, 0.02, 24), { color: '#f2b24c', x: -24.9, y: 0.06, z: 7.3, ao: false });
  kit.add(cyl(0.7, 0.7, 0.025, 24), { color: '#fff0d6', x: -24.9, y: 0.06, z: 7.3, ao: false });
  kit.add(new THREE.TorusGeometry(0.38, 0.14, 8, 18).rotateX(Math.PI / 2), { color: '#e8577a', x: -25.9, y: 0.2, z: 9.2 });
  kit.add(cyl(0.38, 0.38, 0.08, 18), { color: '#f7c3d0', x: -25.9, y: 0.07, z: 9.2 });
  for (const [px, pz] of [[-24.4, 8.6], [-23.4, 8.6], [-24.4, 9.6], [-23.4, 9.6]]) kit.add(cyl(0.03, 0.03, 0.5, 6), { color: '#fffaf0', x: px, y: 0.06, z: pz });
  for (const [a, b, ry] of [[-23.9, 8.6, 0], [-23.9, 9.6, 0], [-24.4, 9.1, Math.PI / 2], [-23.4, 9.1, Math.PI / 2]]) kit.add(rb(1.0, 0.04, 0.04, 0.01, 1), { color: '#fffaf0', x: a, y: 0.48, z: b, ry });
  kit.add(cyl(0.03, 0.05, 1.2, 8), { color: '#8e5a33', x: -26.3, y: 0.06, z: 4.6 });
  kit.add(cyl(0.2, 0.14, 0.24, 12), { color: '#ffe6b0', slot: 'lit', x: -26.3, y: 1.24, z: 4.6, ao: false });
  // corredor: escada, cabideiro, o portãozinho de bebê aberto
  for (let k = 0; k < 6; k++) kit.add(rb(1.1, 0.2 * (k + 1), 0.28, 0.02, 1), { color: k % 2 ? '#b77a48' : '#c98a55', x: -22.0, y: 0.06, z: 4.45 + k * 0.28 });
  kit.add(cyl(0.025, 0.03, 1.5, 6), { color: '#6b4a34', x: -21.4, y: 0.06, z: 9.6 });
  kit.add(sphere(0.12, 8, 6), { color: '#e8577a', x: -21.35, y: 1.45, z: 9.6, sx: 1.2 });
  kit.add(rb(0.04, 0.55, 0.85, 0.01, 1), { color: '#fffaf0', x: -23.0, y: 0.06, z: 6.0, ry: -1.0 });
  // cozinha: bancada com a pia, geladeira, mesa com a toalha comprida, o ursinho embaixo, cadeiras
  kit.add(rb(2.2, 0.9, 0.6, 0.03, 1), { color: '#fffaf0', x: -19.9, y: 0.06, z: 4.62 });
  kit.add(rb(2.26, 0.05, 0.66, 0.02, 1), { color: '#9a8f86', x: -19.9, y: 0.96, z: 4.62 });
  kit.add(rb(0.5, 0.06, 0.36, 0.03, 1), { color: '#c9d2dc', x: -20.4, y: 0.98, z: 4.62, ao: false });
  kit.add(rb(0.7, 1.9, 0.68, 0.08, 2), { color: '#f4f6f8', x: -18.3, y: 0.06, z: 4.7 });
  kit.add(rb(0.04, 0.4, 0.04, 0.01, 1), { color: '#9a8f86', x: -18.0, y: 1.2, z: 5.06 });
  kit.add(rb(1.5, 0.05, 0.95, 0.02, 1), { color: '#c98a55', x: -19.4, y: 0.78, z: 7.7 });
  kit.add(rb(1.62, 0.74, 1.07, 0.02, 1), { color: check('#f7c3d0', '#fffaf0', 0.14), x: -19.4, y: 0.06, z: 7.7 });
  // o ursinho espiando debaixo da toalha
  kit.add(sphere(0.16, 12, 10), { color: '#a87a52', x: -19.4, y: 0.2, z: 8.33 });
  kit.add(sphere(0.12, 12, 10), { color: '#a87a52', x: -19.4, y: 0.4, z: 8.36 });
  for (const s of [-1, 1]) kit.add(sphere(0.05, 8, 6), { color: '#8a5a3a', x: -19.4 + s * 0.09, y: 0.5, z: 8.34 });
  kit.add(sphere(0.045, 8, 6), { color: '#f2d6b0', x: -19.4, y: 0.37, z: 8.47 });
  for (const s of [-1, 1]) {
    kit.add(rb(0.42, 0.06, 0.42, 0.03, 1), { color: '#c98a55', x: -19.4 + s * 1.05, y: 0.45, z: 7.7 });
    kit.add(rb(0.06, 0.45, 0.42, 0.02, 1), { color: '#c98a55', x: -19.4 + s * 1.26, y: 0.5, z: 7.7 });
  }
  // a barricada: as caixas da mudança na porta da cozinha (a de livros e a de almofadas)
  const box = (x, y, z, s, ry = 0) => {
    kit.add(rb(s, s * 0.8, s, 0.02, 1), { color: '#c99a5e', x, y, z, ry });
    kit.add(rb(s + 0.01, 0.04, 0.12, 0.01, 1), { color: '#e9d7a8', x, y: y + s * 0.8 - 0.02, z, ry, ao: false });
  };
  box(-21.0, 0.06, 7.0, 0.62, 0.1);
  box(-21.05, 0.06, 7.55, 0.55, -0.15);
  box(-21.0, 0.56, 7.25, 0.5, 0.3);
  box(-20.4, 0.06, 9.5, 0.5, 0.4);
  box(-26.2, 0.06, 6.3, 0.48, -0.3);
  // a nuvem de chuva da tarde (fase 5): chove no gramado da frente, do lado do bebedouro (não dentro da casa aberta)
  const rain1 = rainCloud(root, { x: Hs.x - 3.2, y: 7.2, z: Hs.z + 5.4, w: 3.0, d: 2.2, drops: 26, seed: 5 });

  // ====================================================== fase 8: a lavanderia em corte (o anexo)
  const ax0 = A.x - A.w / 2, ax1 = A.x + A.w / 2, az0 = A.z - A.d / 2;
  openHouse(kit, {
    x: A.x, z: A.z, w: A.w, d: A.d, h: A.h, low: 0.9, wall: '#fff0d6', inside: '#e9f4f8', floor: check('#e6eef2', '#d4dfe6', 0.3),
    door: { x: A.x + 0.35, w: 0.85 }, windows: [A.x + 0.2], roof: { kind: 'flat', color: '#c98a55', open: 0.95, over: 0.2 },
  });
  // na parede do fundo: armário de limpeza, secadora, máquina (com a mantinha dobrada em cima) e o tanque
  kit.add(rb(0.4, 1.7, 0.42, 0.04, 1), { color: '#7fa36b', x: ax0 + 0.36, y: 0.06, z: az0 + 0.38 });
  const machine = (x, color) => {
    kit.add(rb(0.56, 0.6, 0.56, 0.06, 2), { color, x, y: 0.06, z: az0 + 0.45 });
    kit.add(cyl(0.18, 0.18, 0.03, 18).rotateX(Math.PI / 2), { color: '#9fd6ef', slot: 'glass', x, y: 0.36, z: az0 + 0.74, ao: false });
    kit.add(new THREE.TorusGeometry(0.19, 0.03, 6, 18), { color: '#c9d2dc', x, y: 0.36, z: az0 + 0.74, ao: false });
  };
  machine(ax0 + 0.86, '#f4f6f8');
  machine(ax0 + 1.44, '#f4f6f8');
  kit.add(rb(0.5, 0.12, 0.42, 0.04, 1), { color: '#6ec3e8', x: ax0 + 1.44, y: 0.66, z: az0 + 0.45 });
  kit.add(rb(0.5, 0.82, 0.48, 0.04, 1), { color: '#e3e8ec', x: ax1 - 0.36, y: 0.06, z: az0 + 0.42 });
  kit.add(rb(0.4, 0.05, 0.36, 0.02, 1), { color: '#9fb6c2', x: ax1 - 0.36, y: 0.86, z: az0 + 0.42, ao: false });
  // o varal de teto: dois trilhos, as roupas e a meia listrada no pregador
  for (const zz of [az0 + 1.5, az0 + 1.85]) kit.add(cyl(0.015, 0.015, A.w - 0.4, 6).rotateZ(Math.PI / 2), { color: '#9a8f86', x: A.x, y: 2.05, z: zz, ao: false });
  [['#fffaf0', -0.6], ['#f2b24c', 0.1], ['#6ec3e8', 0.55]].forEach(([c, dx]) => kit.add(rb(0.42, 0.48, 0.03, 0.01, 1), { color: /** @type {string} */ (c), x: A.x + /** @type {number} */ (dx), y: 1.55, z: az0 + 1.5 }));
  for (let k = 0; k < 6; k++) kit.add(rb(0.12, 0.09, 0.06, 0.02, 1), { color: k % 2 ? '#e8577a' : '#fffaf0', x: A.x - 0.15, y: 1.92 - k * 0.09, z: az0 + 1.86 });
  kit.add(rb(0.22, 0.1, 0.06, 0.04, 1), { color: '#e8577a', x: A.x - 0.08, y: 1.4, z: az0 + 1.86 });
  kit.add(rb(0.04, 0.12, 0.05, 0.01, 1), { color: '#ffd15c', x: A.x - 0.15, y: 1.98, z: az0 + 1.86, ao: false });
  // tábua de passar, o cesto de rodinhas, a caminha
  kit.add(rb(1.0, 0.04, 0.32, 0.12, 2), { color: '#9fd6ef', x: A.x + 0.2, y: 0.8, z: az0 + 2.6 });
  for (const s of [-1, 1]) kit.add(rb(0.03, 0.8, 0.03, 0.01, 1), { color: '#9a8f86', x: A.x + 0.2 + s * 0.3, y: 0.02, z: az0 + 2.6, rz: s * 0.35 });
  kit.add(rb(0.5, 0.38, 0.4, 0.06, 2), { color: '#fffaf0', x: ax1 - 0.5, y: 0.1, z: az0 + 1.3 });
  for (const s of [-1, 1]) for (const t of [-1, 1]) kit.add(sphere(0.045, 8, 6), { color: '#3a3a40', x: ax1 - 0.5 + s * 0.2, y: 0.09, z: az0 + 1.3 + t * 0.15, ao: false });
  kit.add(new THREE.TorusGeometry(0.28, 0.1, 8, 16).rotateX(Math.PI / 2), { color: '#7fa36b', x: ax1 - 0.45, y: 0.16, z: az0 + 3.55 });
  kit.add(cyl(0.28, 0.28, 0.06, 16), { color: '#e9f4f8', x: ax1 - 0.45, y: 0.06, z: az0 + 3.55 });
  // a parede das patinhas (a da casa, por dentro da lavanderia) e os dois botões lá no alto
  const paw = (y, z) => {
    kit.add(cyl(0.06, 0.06, 0.02, 10).rotateZ(Math.PI / 2), { color: '#a0603a', x: ax0 + 0.17, y, z, ao: false });
    for (const [dy, dz] of [[0.08, -0.05], [0.1, 0], [0.08, 0.05]]) kit.add(cyl(0.022, 0.022, 0.02, 8).rotateZ(Math.PI / 2), { color: '#a0603a', x: ax0 + 0.17, y: y + dy, z: z + dz, ao: false });
  };
  paw(0.5, az0 + 2.2);
  paw(0.85, az0 + 2.45);
  paw(1.2, az0 + 2.2);
  for (const [y, c] of /** @type {[number, string][]} */ ([[1.6, '#e8577a'], [1.95, '#7fd36b']])) {
    kit.add(rb(0.04, 0.2, 0.2, 0.02, 1), { color: '#fffaf0', x: ax0 + 0.18, y: y - 0.1, z: az0 + 2.75, ao: false });
    kit.add(sphere(0.06, 10, 8), { color: c, slot: 'lit', x: ax0 + 0.22, y, z: az0 + 2.75, ao: false });
  }

  // ====================================================== fase 1: o jardim
  const dv = Hs.divider;
  picketFence(kit, { x0: dv.x, z0: dv.z0, x1: dv.x, z1: dv.z1 - 0.05 });
  for (const zz of [dv.gate.z0, dv.z0]) {
    kit.add(rb(0.14, 0.82, 0.14, 0.03, 1), { color: '#fffaf0', x: dv.x, z: zz });
    kit.add(sphere(0.07, 10, 8), { color: '#fffaf0', x: dv.x, y: 0.88, z: zz });
  }
  // o portão aberto, com a cordinha (e o brinquedo de corda) no trinco, do lado leste
  picketFence(kit, { x0: dv.x + 0.05, z0: dv.gate.z0 - 0.02, x1: dv.x + 0.85, z1: dv.gate.z0 - 0.45, h: 0.6 });
  kit.add(cyl(0.012, 0.012, 0.45, 4), { color: '#c98a55', x: dv.x + 0.86, y: 0.15, z: dv.gate.z0 - 0.47, ao: false });
  kit.add(new THREE.TorusGeometry(0.07, 0.025, 6, 12), { color: '#e8577a', x: dv.x + 0.86, y: 0.1, z: dv.gate.z0 - 0.47, ao: false });
  // o carrinho de jardim (vagão de madeira) e a cenoura de pelúcia no nicho
  const C = Hs.cart;
  kit.add(rb(C.w, 0.34, C.d, 0.04, 1), { color: planks('#a0603a', '#b06c42', 0.2), x: C.x, y: 0.16, z: C.z });
  kit.add(rb(C.w - 0.1, 0.06, C.d - 0.1, 0.02, 1), { color: '#7a4a32', x: C.x, y: 0.47, z: C.z, ao: false });
  for (const s of [-1, 1]) for (const t of [-1, 1]) kit.add(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12).rotateX(Math.PI / 2), { color: '#3a3a40', x: C.x + s * 0.38, y: 0.13, z: C.z + t * 0.33 });
  kit.add(cyl(0.02, 0.02, 0.7, 6).rotateZ(Math.PI / 2 - 0.5), { color: '#3a3a40', x: C.x - C.w / 2, y: 0.3, z: C.z });
  const cr = Hs.carrot;
  kit.add(new THREE.ConeGeometry(0.11, 0.42, 10).rotateZ(Math.PI / 2 + 0.2), { color: '#f08a3c', x: cr.x - 0.1, y: 0.12, z: cr.z, ry: 0.4 });
  kit.add(carrotTops({ height: 0.18, seed: 3 }), { color: null, slot: 'plant', x: cr.x + 0.15, y: 0.1, z: cr.z - 0.1, rz: -1.2 });
  // o bebedouro dos passarinhos com a poça e um passarinho
  const bb = Hs.birdbath;
  kit.add(cyl(0.12, 0.2, 0.62, 12), { color: '#d9cfc2', x: bb.x, z: bb.z });
  kit.add(cyl(0.34, 0.2, 0.14, 18), { color: '#d9cfc2', x: bb.x, y: 0.62, z: bb.z });
  kit.add(cyl(0.29, 0.29, 0.02, 18), { color: '#8ec9ea', slot: 'glass', x: bb.x, y: 0.74, z: bb.z, ao: false });
  kit.add(sphere(0.06, 8, 6), { color: '#6b8fb8', x: bb.x + 0.22, y: 0.82, z: bb.z, sx: 1.4, ao: false });
  kit.add(new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2), { color: '#7d9cb0', slot: 'ground', x: bb.x + 0.3, y: 0.012, z: bb.z + 0.4, sx: 1.4 });
  // caminho de pedrinhas do portão até a porta
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    kit.add(cyl(0.34, 0.36, 0.05, 9), { color: '#e3d9c9', slot: 'ground', x: -21 + (Hs.door.x + 21) * t + (k % 2 ? 0.12 : -0.12), y: 0.006, z: 21.1 - t * 9.9 });
  }
  // as lanternas nos mourões do portãozinho (fim de tarde)
  for (const gx of [Hs.fence.gate.x0, Hs.fence.gate.x1]) lantern(kit, { x: gx, y: 0.86, z: Hs.fence.z, post: false });

  return {
    update(dt, t) {
      rain1.update(dt, t);
    },
  };
}
