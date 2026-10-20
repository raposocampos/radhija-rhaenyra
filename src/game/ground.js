// Chão das dogs em cima de coisas baixas de pisar (placas de pressão, pedais, botões do chão): retorno do usuário,
// "é como se só existisse a colisão do chão" (a pata entrava no estrado do botão). O cenário marca o desenho dessas
// coisas com `userData.walkable = true`; heightAt(x, z) é o alto do que está embaixo do ponto (0 = o chão), medido
// por um raio para baixo no desenho de agora (a placa que afunda ao ser pisada já vem afundada). Só as malhas contam
// (o brilho de destaque em sprite, sem câmera no raio, quebraria o raycast do three.js).
import * as THREE from 'three';
import { shown, meshesOf } from './pushRest.js';

/** Mais alto que isto não é "coisa baixa de pisar" (a dog não sobe): o raio ignora. */
export const GROUND_MAX = 0.3;

/** Os desenhos marcados para pisar dentro de `root`. @param {THREE.Object3D | null} root */
export function walkablesOf(root) {
  /** @type {THREE.Object3D[]} */
  const out = [];
  root?.traverse((o) => {
    if (o.userData?.walkable) out.push(o);
  });
  return out;
}

/** @param {THREE.Object3D[]} objects */
export function createGround(objects) {
  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();
  // cada desenho com o círculo (no chão) que o contém e as malhas dele: os longe nem entram no raio
  const items = objects.map((obj) => {
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    box.getBoundingSphere(sphere);
    return { meshes: meshesOf(obj), x: sphere.center.x, z: sphere.center.z, r: sphere.radius };
  });
  /** @type {THREE.Object3D[]} */
  const near = [];
  return {
    /** Alto (m) do que dá para pisar embaixo de (x, z); 0 no chão. */
    heightAt(x, z) {
      near.length = 0;
      for (const it of items) if (Math.hypot(x - it.x, z - it.z) < it.r + 0.02) near.push(...it.meshes);
      if (!near.length) return 0;
      from.set(x, GROUND_MAX + 0.5, z);
      ray.set(from, down);
      ray.far = GROUND_MAX + 0.6;
      let top = 0;
      for (const h of ray.intersectObjects(near, false)) if (h.point.y > top && h.point.y <= GROUND_MAX && shown(h.object)) top = h.point.y;
      return top;
    },
    /** Quantos desenhos dá para pisar (testes). */
    get count() { return items.length; },
  };
}
