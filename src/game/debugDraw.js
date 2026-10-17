// ?debug — desenha colisores (linhas), nós e arestas de navegação, círculos das dogs e a rota da companheira.
import * as THREE from 'three';

const COLORS = {
  all: 0xffe14d,
  large: 0xff8a3d,
  gate: 0x3de0ff,
  cart: 0xff4dd2,
  node: 0x5dff7a,
  edge: 0xffffff,
  small: 0x4d8bff,
  gateOpen: 0x3de0ff,
  cartMoved: 0xff4dd2,
  dog: 0xff3b3b,
  path: 0x7dff4d,
  flag: 0xc77dff, // qualquer outra flag de navegação da fase
  dynamic: 0x3de0ff,
};
const Y = 0.04;

function circlePts(out, x, z, r, n = 28) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    out.push(x + Math.cos(a0) * r, Y, z + Math.sin(a0) * r, x + Math.cos(a1) * r, Y, z + Math.sin(a1) * r);
  }
}
function boxPts(out, x, z, hx, hz) {
  const c = [[x - hx, z - hz], [x + hx, z - hz], [x + hx, z + hz], [x - hx, z + hz]];
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    out.push(a[0], Y, a[1], b[0], Y, b[1]);
  }
}
function capsulePts(out, ax, az, bx, bz, t) {
  const L = Math.hypot(bx - ax, bz - az) || 1;
  const nx = (-(bz - az) / L) * t;
  const nz = ((bx - ax) / L) * t;
  out.push(ax + nx, Y, az + nz, bx + nx, Y, bz + nz, ax - nx, Y, az - nz, bx - nx, Y, bz - nz);
  circlePts(out, ax, az, t, 10);
  circlePts(out, bx, bz, t, 10);
}

function makeLines(color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
  const lines = new THREE.LineSegments(geo, mat);
  lines.renderOrder = 999;
  lines.frustumCulled = false;
  return lines;
}
function setPts(lines, pts) {
  const geometry = lines.geometry;
  let position = geometry.getAttribute('position');
  if (position.array.length < pts.length) {
    // O Three libera somente os atributos atuais no dispose. Liberar antes
    // de substituir evita perder o buffer antigo; crescer é pouco frequente.
    geometry.dispose();
    const capacity = 2 ** Math.ceil(Math.log2(Math.max(2, pts.length / 3)));
    position = new THREE.Float32BufferAttribute(new Float32Array(capacity * 3), 3);
    geometry.setAttribute('position', position);
  }
  position.array.set(pts);
  position.needsUpdate = true;
  geometry.setDrawRange(0, pts.length / 3);
  // Linhas têm frustumCulled=false; drawRange ignora a capacidade não usada.
}

export function createDebugDraw(scene, layout, world, nav) {
  const group = new THREE.Group();
  group.name = 'debug-draw';
  scene.add(group);

  // Estáticos
  const allL = makeLines(COLORS.all);
  const largeL = makeLines(COLORS.large);
  const pa = [];
  const pl = [];
  for (const c of world.statics) {
    const out = c.blocks === 'large' ? pl : pa;
    if (c.shape === 'box') boxPts(out, c.x, c.z, c.hx, c.hz);
    else if (c.shape === 'circle') circlePts(out, c.x, c.z, c.r);
    else if (c.shape === 'segment') capsulePts(out, c.ax, c.az, c.bx, c.bz, c.t ?? 0.05);
  }
  const b = layout.WORLD.bounds;
  boxPts(pa, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, (b.maxX - b.minX) / 2, (b.maxZ - b.minZ) / 2);
  setPts(allL, pa);
  setPts(largeL, pl);
  group.add(allL, largeL);

  // Navegação (estática)
  const nodeL = makeLines(COLORS.node);
  const np = [];
  for (const n of nav.nodes.values()) {
    np.push(n.x - 0.12, Y, n.z, n.x + 0.12, Y, n.z, n.x, Y, n.z - 0.12, n.x, Y, n.z + 0.12);
    circlePts(np, n.x, n.z, 0.08, 10);
  }
  setPts(nodeL, np);
  group.add(nodeL);
  const edgeLines = {};
  for (const key of ['edge', 'small', 'gateOpen', 'cartMoved', 'flag']) {
    edgeLines[key] = makeLines(COLORS[key]);
    edgeLines[key].material.opacity = 0.55;
    group.add(edgeLines[key]);
  }
  const ep = { edge: [], small: [], gateOpen: [], cartMoved: [], flag: [] };
  for (const [a, bb, opt] of layout.NAV_EDGES) {
    const na = nav.nodes.get(a);
    const nb = nav.nodes.get(bb);
    const req = opt?.requires;
    (ep[req || 'edge'] || ep.flag).push(na.x, Y + 0.01, na.z, nb.x, Y + 0.01, nb.z);
  }
  for (const k of Object.keys(ep)) setPts(edgeLines[k], ep[k]);

  // Dinâmicos (todos os registrados pela fase)
  const dynL = makeLines(COLORS.dynamic);
  const dogL = makeLines(COLORS.dog);
  const pathL = makeLines(COLORS.path);
  group.add(dynL, dogL, pathL);

  return {
    group,
    update(ctrls, brains, activeName) {
      const gp = [];
      for (const c of world.dynamics) {
        if (c.enabled === false) continue;
        if (c.shape === 'box') boxPts(gp, c.x, c.z, c.hx, c.hz);
        else if (c.shape === 'circle') circlePts(gp, c.x, c.z, c.r);
        else if (c.shape === 'segment') capsulePts(gp, c.ax, c.az, c.bx, c.bz, c.t ?? 0.05);
      }
      setPts(dynL, gp);
      const dp = [];
      for (const c of Object.values(ctrls)) {
        circlePts(dp, c.x, c.z, c.r, 20);
        dp.push(c.x, Y, c.z, c.x + Math.sin(c.yaw) * c.r * 1.8, Y, c.z + Math.cos(c.yaw) * c.r * 1.8);
      }
      setPts(dogL, dp);
      const pp = [];
      for (const [name, br] of Object.entries(brains)) {
        if (name === activeName) continue;
        const c = ctrls[name];
        let px = c.x;
        let pz = c.z;
        for (const w of br.path) {
          pp.push(px, Y + 0.02, pz, w.x, Y + 0.02, w.z);
          px = w.x;
          pz = w.z;
        }
      }
      setPts(pathL, pp);
    },
  };
}
