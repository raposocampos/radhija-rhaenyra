// Peças pequenas do cenário para as animações escondidas (src/game/extras.js): a bolinha listrada que rola com a
// focinhada (fase 6) e a poça no pé do bebedouro dos passarinhos (fase 1). Tudo procedural, sem colisão.
import * as THREE from 'three';
import { canvasTexture } from './util.js';

/**
 * Bolinha listrada no chão. roll(dirX, dirZ): rola `dist` m nessa direção (quica nos limites e gira de verdade);
 * update(dt) anima; reset() volta ao começo. hook = o gancho dos extras ({ x, z, roll, reset }).
 * @param {{ root: THREE.Object3D, x: number, z: number, bounds: { minX: number, maxX: number, minZ: number, maxZ: number }, r?: number, dist?: number }} opts
 */
export function createToyBall({ root, x, z, bounds, r = 0.075, dist = 0.55 }) {
  const tex = canvasTexture(128, 64, (g, w, h) => {
    const cols = ['#e8554a', '#fff4e2', '#3f8fd8', '#fff4e2', '#f2c14e', '#fff4e2'];
    cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, (i * h) / cols.length, w, h / cols.length + 1); });
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 0.6 }));
  ball.castShadow = true;
  ball.name = 'bolinha-listrada';
  const holder = new THREE.Group();
  holder.add(ball);
  root.add(holder);
  const home = { x, z };
  const S = { x, z, vx: 0, vz: 0 };
  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const place = () => holder.position.set(S.x, r, S.z);
  place();
  return {
    object: holder,
    hook: {
      get x() { return S.x; },
      get z() { return S.z; },
      roll(dx, dz) {
        const L = Math.hypot(dx, dz) || 1;
        // velocidade inicial para parar em ~dist m com o atrito abaixo (v² = 2·a·d)
        const v = Math.sqrt(2 * 1.6 * dist);
        S.vx = (dx / L) * v;
        S.vz = (dz / L) * v;
      },
      reset() {
        S.x = home.x;
        S.z = home.z;
        S.vx = S.vz = 0;
        ball.quaternion.identity();
        place();
      },
    },
    update(dt) {
      const sp = Math.hypot(S.vx, S.vz);
      if (sp < 1e-3) return;
      const nsp = Math.max(0, sp - 1.6 * dt);
      S.vx *= nsp / sp;
      S.vz *= nsp / sp;
      S.x += S.vx * dt;
      S.z += S.vz * dt;
      if (S.x < bounds.minX || S.x > bounds.maxX) { S.x = Math.min(bounds.maxX, Math.max(bounds.minX, S.x)); S.vx *= -0.6; }
      if (S.z < bounds.minZ || S.z > bounds.maxZ) { S.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, S.z)); S.vz *= -0.6; }
      // gira rolando (eixo perpendicular ao movimento, no chão)
      axis.set(S.vz, 0, -S.vx).normalize();
      q.setFromAxisAngle(axis, (nsp * dt) / r);
      ball.quaternion.premultiply(q);
      place();
    },
  };
}

/**
 * Poça rasa no chão (água que reflete o céu, com borda molhada mais escura), centrada em (x, z).
 * @param {{ root: THREE.Object3D, x: number, z: number, rx?: number, rz?: number, y?: number }} opts
 */
export function createPuddle({ root, x, z, rx = 0.17, rz = 0.12, y = 0.006 }) {
  const g = new THREE.Group();
  g.name = 'poca';
  const wet = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2f3a22', roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false }));
  wet.scale.set(rx * 1.3, 1, rz * 1.3);
  wet.position.y = y - 0.002;
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4d7f8a', roughness: 0.05, metalness: 0, envMapIntensity: 2.2, transparent: true, opacity: 0.88 }));
  water.scale.set(rx, 1, rz);
  water.position.y = y;
  water.userData.noShadow = true;
  // contorno irregular: deforma a borda
  for (const m of [wet, water]) {
    const p = m.geometry.attributes.position;
    for (let i = 1; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 + 0.12 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 5);
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
  }
  g.add(wet, water);
  g.position.set(x, 0, z);
  root.add(g);
  return { object: g };
}
