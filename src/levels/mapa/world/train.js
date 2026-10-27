// PANDORÓPOLIS — o trenzinho de brinquedo dando voltas no trilho da brinquedoteca (a fase 6), com fumacinha.
// API: buildTrain(root, trackPoint) → { group, update(dt, t) }
import * as THREE from 'three';
import { paint, mergeGeometries, mat } from '../../../world/util.js';
import { rb, cyl, sphere, SLOTS } from './kit.js';

/** Peças pintadas (cores por vértice) de um vagão, comprido em z. */
function car(parts) {
  const geos = parts.map(([g, color, x = 0, y = 0, z = 0]) => {
    const n = (g.index ? g.toNonIndexed() : g).translate(x, y, z);
    n.deleteAttribute('uv');
    return paint(n, color);
  });
  return mergeGeometries(geos);
}

/**
 * @param {THREE.Group} root
 * @param {(t: number) => { x: number, z: number, yaw: number }} trackPoint
 */
export function buildTrain(root, trackPoint) {
  const group = new THREE.Group();
  group.name = 'mapa:trenzinho';
  root.add(group);
  const wheels = (len) => {
    const out = [];
    for (const z of [-len * 0.3, len * 0.3]) for (const x of [-0.24, 0.24]) {
      out.push([new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12).rotateZ(Math.PI / 2), '#2b2b30', x, 0.13, z]);
    }
    return out;
  };
  const loco = car([
    [rb(0.5, 0.12, 0.95, 0.03, 1), '#4a3426', 0, 0.1, 0],
    [new THREE.CylinderGeometry(0.2, 0.2, 0.5, 14).rotateX(Math.PI / 2), '#e8577a', 0, 0.42, 0.2],
    [rb(0.46, 0.5, 0.38, 0.05, 2), '#e8577a', 0, 0.2, -0.24],
    [rb(0.54, 0.07, 0.46, 0.03, 1), '#ffd15c', 0, 0.71, -0.24],
    [rb(0.3, 0.2, 0.02, 0.02, 1), '#9fd6ef', 0, 0.45, -0.04],
    [cyl(0.07, 0.09, 0.22, 10), '#3a3a40', 0, 0.58, 0.32],
    [sphere(0.05, 8, 6), '#ffd15c', 0, 0.42, 0.46],
    ...wheels(0.95),
  ]);
  const wagon = (color) => car([
    [rb(0.5, 0.12, 0.8, 0.03, 1), '#4a3426', 0, 0.1, 0],
    [rb(0.46, 0.3, 0.72, 0.05, 2), color, 0, 0.2, 0],
    [rb(0.18, 0.18, 0.18, 0.03, 1), '#ffd15c', -0.08, 0.5, -0.12],
    [sphere(0.1, 10, 8), '#6ec3e8', 0.08, 0.56, 0.16],
    ...wheels(0.8),
  ]);
  const solid = SLOTS.solid();
  const cars = [loco, wagon('#6ec3e8'), wagon('#7fd36b')].map((g) => {
    const m = new THREE.Mesh(g, solid);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  });
  // fumacinha: três bolinhas que sobem da chaminé e somem
  const smokeMat = mat('mapa-fumaca', () => new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 1, transparent: true, opacity: 0.8, depthWrite: false }));
  const puffs = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(sphere(0.09, 10, 8), smokeMat);
    m.userData.ph = i / 3;
    group.add(m);
    return m;
  });
  const GAP = [0, 0.27, 0.5];
  let s = 0;
  const chim = new THREE.Vector3();
  return {
    group,
    update(dt, t) {
      s += dt * 0.32;
      cars.forEach((m, i) => {
        const p = trackPoint(-s - GAP[i]);
        // anda no sentido horário visto de cima: a frente aponta para o lado contrário da tangente
        m.position.set(p.x, 0.04 + Math.abs(Math.sin(t * 9 + i)) * 0.006, p.z);
        m.rotation.y = p.yaw + Math.PI;
      });
      chim.set(0, 0.8, 0.32).applyMatrix4(cars[0].matrixWorld);
      for (const pf of puffs) {
        const k = (t * 0.8 + pf.userData.ph) % 1;
        pf.position.set(chim.x, 0.8 + k * 0.9, chim.z);
        pf.scale.setScalar(0.25 + Math.sin(k * Math.PI) * 1.3);
      }
    },
  };
}
