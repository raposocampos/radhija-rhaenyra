import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPigeon } from '../src/world/pigeon.js';

// Somente a textura de sono usa canvas; a malha/animação Three.js é real.
globalThis.document = { createElement: () => ({ getContext: () => ({ strokeText() {}, fillText() {} }) }) };
const tick = (p, seconds, fps = 60) => {
  for (let i = 1; i <= Math.round(seconds * fps); i++) p.update(1 / fps, i / fps);
};
const wing = (p) => p.object.getObjectByName('asa-direita');
function feetHeight(p) {
  p.object.updateMatrixWorld(true);
  const mesh = p.object.getObjectByName('pes').children[0], v = new THREE.Vector3();
  let y = Infinity;
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
    y = Math.min(y, v.y);
  }
  return y;
}
function extent(p) {
  p.object.updateMatrixWorld(true);
  const w = wing(p), v = new THREE.Vector3();
  let max = -Infinity;
  for (let i = 0; i < w.geometry.attributes.position.count; i++) {
    w.getVertexPosition(i, v).applyMatrix4(w.matrixWorld);
    max = Math.max(max, v.x);
  }
  return max;
}

test('pombo abre asas lateralmente no voo, sem recriar a geometria', () => {
  const p = createPigeon();
  p.update(0, 0);
  const folded = extent(p), geometry = wing(p).geometry;
  p.setPose({ flying: true });
  let spread = 0, low = Infinity, high = -Infinity;
  for (let i = 1; i <= 120; i++) {
    p.update(1 / 60, i / 60);
    spread = Math.max(spread, extent(p));
    low = Math.min(low, wing(p).parent.rotation.z);
    high = Math.max(high, wing(p).parent.rotation.z);
  }
  assert.ok(spread > folded * 2, `envergadura: ${folded} → ${spread}`);
  assert.ok(high > 0.8 && low < -0.6, 'batida passa acima e abaixo dos ombros');
  assert.equal(wing(p).geometry, geometry);
});

test('pouso recolhe asas gradualmente e devolve os pés ao apoio', () => {
  const p = createPigeon();
  p.setPose({ flying: true }); tick(p, 0.6);
  const feet = p.object.getObjectByName('pes');
  const tucked = feetHeight(p);
  p.setPose({ flightProgress: 0.98 }); tick(p, 0.1);
  assert.ok(feetHeight(p) < tucked, 'pés antecipam o contato');
  p.setPose({ flying: false }); p.update(1 / 60, 1);
  assert.ok(Math.abs(feetHeight(p)) < 0.005, 'pés permanecem apoiados enquanto as asas recolhem');
  assert.ok(wing(p).morphTargetInfluences.reduce((a, b) => a + b) > 0.5, 'sem estalo no primeiro quadro');
  tick(p, 1);
  assert.ok(wing(p).morphTargetInfluences.reduce((a, b) => a + b) < 0.001);
  assert.ok(Math.abs(feetHeight(p)) < 0.005);
  assert.ok(Math.abs(feet.scale.y - 1) < 0.001);
});

test('raízes das pernas permanecem dentro do tronco ao decolar, virar, frear e pousar', () => {
  const p = createPigeon();
  const feet = p.object.getObjectByName('pes').children[0];
  const torso = p.object.getObjectByName('tronco');
  torso.material.side = THREE.DoubleSide;
  feet.geometry.computeBoundingBox();
  const legTop = feet.geometry.boundingBox.max.y;
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 180; i++) {
    p.setPose({ flying: i < 120, flightProgress: Math.min(i / 120, 1), yaw: i < 60 ? 0 : 1.3 });
    p.update(1 / 60, i / 60);
    p.object.updateMatrixWorld(true);
    for (const x of [-0.03, 0.03]) {
      ray.set(new THREE.Vector3(x, legTop - 0.001, 0).applyMatrix4(feet.matrixWorld), up);
      const hit = ray.intersectObject(torso, false)[0];
      assert.ok(hit, `perna sem contato no quadro ${i}`);
      const normal = hit.face.normal.clone().transformDirection(torso.matrixWorld);
      assert.ok(normal.dot(up) > 0, `raiz da perna fora do corpo no quadro ${i}`);
    }
    if (i >= 120) assert.ok(Math.abs(feetHeight(p)) < 0.005, 'contato com o chão no pouso');
  }
});

test('direção atravessa ±pi pelo caminho curto e sem salto ao pousar', () => {
  const p = createPigeon();
  p.setPose({ yaw: Math.PI - 0.02 }); p.update(0, 0);
  const start = p.object.rotation.y;
  p.setPose({ yaw: -Math.PI + 0.02, flying: true }); p.update(1 / 60, 0.1);
  assert.ok(Math.abs(p.object.rotation.y - start) < 0.02);
  p.setPose({ yaw: 0.3, flying: false }); p.update(1 / 60, 0.2);
  assert.ok(Math.abs(p.object.rotation.y - start) < 0.6);
});

test('sono e retorno da espiada continuam funcionando após um voo', () => {
  const p = createPigeon();
  p.setPose({ flying: true }); tick(p, 0.4);
  p.setPose({ flying: false, asleep: true }); tick(p, 2);
  const sleepingY = p.object.children[0].position.y;
  p.peek(); tick(p, 0.5);
  assert.ok(p.object.children[0].position.y > sleepingY + 0.02);
  tick(p, 3);
  assert.ok(Math.abs(p.object.children[0].position.y - sleepingY) < 0.002);
});
