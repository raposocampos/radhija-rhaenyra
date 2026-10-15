// Pequena cenoura de pelúcia para testes (sandbox/dogs.html); o jogo usa a do cenário da fase 1.
import * as THREE from 'three';

export function createPlushCarrot(len = 0.28) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.008, len * 0.8, 14, 4).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#f07a1a', roughness: 0.85 }),
  );
  body.position.x = len * 0.06;
  const leaf = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, len * 0.22, 8).rotateZ(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#4c9a3a', roughness: 0.9 }),
  );
  leaf.position.x = -len * 0.43;
  g.add(body, leaf);
  g.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
