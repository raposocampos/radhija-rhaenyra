// ARENA DO EMPURRÃO (fase de desenvolvimento) — CENÁRIO.
// Base provisória (_placeholder.js: gramado e os limites) + os três empurráveis de src/world/shoveProps.js
// (arvorezinha com a bolinha presa nos galhos, mesinha com o patinho, estante baixa com o ursinho), a caminha de casa e
// os ossinhos dourados. Os itens ficam presos no que balança (socket) até caírem.
import * as THREE from 'three';
import { buildPlaceholderWorld } from '../_placeholder.js';
import { buildLittleTree, buildSideTable, buildLowShelf, SHOVE_PROP_SIZE } from '../../world/shoveProps.js';
import { createRubberDuck, createTeddyBear } from '../../world/toys.js';
import { buildTreats } from '../../world/treats.js';
import { canvasTexture, contactShadow, stdMat, shadowAll } from '../../world/util.js';

/** Bolinha de tênis (o item do objetivo). */
function tennisBall() {
  const tex = canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = '#d4ec3c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f7f9ee';
    g.lineWidth = 5;
    g.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = h / 2 + Math.sin((x / w) * Math.PI * 4) * h * 0.28;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.072, 22, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  ball.name = 'bolinha';
  ball.castShadow = true;
  const g = new THREE.Group();
  g.name = 'ball';
  g.add(ball);
  return g;
}

/** Caminha redonda com almofada (a casa da arena). */
function buildBed(root, B) {
  const g = new THREE.Group();
  g.name = 'caminha';
  g.position.set(B.x, 0, B.z);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(B.r * 0.78, B.r * 0.22, 14, 36).rotateX(Math.PI / 2), stdMat('#d97b5a', { roughness: 0.95 }));
  rim.position.y = B.r * 0.22;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(B.r * 0.92, B.r * 0.95, 0.04, 36), stdMat('#c2684b', { roughness: 0.95 }));
  base.position.y = 0.022;
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(B.r * 0.7, B.r * 0.72, 0.07, 36), stdMat('#f1dfc4', { roughness: 1 }));
  cushion.position.y = 0.075;
  g.add(rim, base, cushion);
  shadowAll(g);
  root.add(g);
  const sh = contactShadow(B.r * 1.1, B.r * 1.1, 0.4);
  sh.position.set(B.x, 0.006, B.z);
  root.add(sh);
}

/**
 * @param {import('../../types').LevelBuildArgs} args
 * @returns {import('../../types').LevelBuild<import('../../types').EmpurraProps>}
 */
export function buildEmpurraWorld({ root, layout }) {
  const { TREE, TABLE, SHELF, BED, COLLECTIBLES } = layout;
  const base = buildPlaceholderWorld({ root, layout, colors: { ground: '#6a8a4c' }, skip: new Set(['arvorezinha', 'mesinha', 'estante']) });
  const place = (prop, o) => {
    prop.object.position.set(o.x, 0, o.z);
    prop.object.rotation.y = Math.atan2(o.nx, o.nz);
    root.add(prop.object);
    return prop;
  };
  const tree = place(buildLittleTree({ seed: 4 }), TREE);
  const table = place(buildSideTable(), TABLE);
  const shelf = place(buildLowShelf({ seed: 7 }), SHELF);

  // itens presos lá em cima (filhos do que balança)
  const ball = tennisBall();
  tree.socket(TREE.ball.lx, TREE.ball.ly, TREE.ball.lz).add(ball);
  const duck = createRubberDuck(0.2);
  duck.rotation.y = 0.5;
  table.socket(TABLE.duck.lx, SHOVE_PROP_SIZE.table.h, TABLE.duck.lz).add(duck);
  const bear = createTeddyBear(0.26);
  bear.userData.sit?.();
  bear.rotation.y = Math.PI;
  shelf.socket(SHELF.bear.lx, SHOVE_PROP_SIZE.shelf.h, SHELF.bear.lz).add(bear);

  buildBed(root, BED);
  const treats = buildTreats(root, COLLECTIBLES);

  /** @type {import('../../types').EmpurraProps} */
  const props = {
    ...base.props,
    tree: { object: tree.object, setSway: tree.setSway },
    table: { object: table.object, setSway: table.setSway },
    shelf: { object: shelf.object, setSway: shelf.setSway },
    ball: { object: ball },
    duck: { object: duck },
    bear: { object: bear },
    collectibles: treats.list,
    reset() {
      tree.setSway(0, 0);
      table.setSway(0, 0);
      shelf.setSway(0, 0);
    },
  };
  return {
    props,
    seeThrough: [tree.object],
    update(dt, t) {
      treats.update(dt, t);
    },
  };
}
