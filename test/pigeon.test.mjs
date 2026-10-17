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
  const tucked = feet.position.y;
  p.setPose({ flightProgress: 0.98 }); tick(p, 0.1);
  assert.ok(feet.position.y < tucked * 0.1, 'pés antecipam o contato');
  p.setPose({ flying: false }); p.update(1 / 60, 1);
  assert.ok(wing(p).morphTargetInfluences.reduce((a, b) => a + b) > 0.5, 'sem estalo no primeiro quadro');
  tick(p, 1);
  assert.ok(wing(p).morphTargetInfluences.reduce((a, b) => a + b) < 0.001);
  assert.ok(Math.abs(feet.position.y) < 0.001);
  assert.ok(Math.abs(feet.scale.y - 1) < 0.001);
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
