import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCameraRig } from '../src/game/cameraRig.js';
import layout from '../src/levels/fase4/layout.js';

test('plano acompanha alvo em três dimensões e retorna ao seguimento', () => {
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);
  const rig = createCameraRig(camera, layout);
  rig.snapFollow(0, 2.3);
  const target = { x: 3.5, y: 1.43, z: 2.3 };
  rig.focusShot(target.x, target.z, { target, inT: 0.3, hold: 2, outT: 0.8 });
  const ctx = { t: 0, target: { x: 0, z: 2.3, vx: 0, vz: 0 } };
  for (let i = 0; i < 120; i++) {
    ctx.t += 1 / 60;
    if (i > 20) { target.y = 1.6 + Math.sin(i / 120 * Math.PI); target.z -= 0.04; }
    rig.update(1 / 60, ctx);
    if (i > 20) assert.ok(rig.lookTarget.distanceTo(new THREE.Vector3(target.x, target.y, target.z)) < 1e-6);
  }
  for (let i = 0; i < 120; i++) rig.update(1 / 60, ctx);
  assert.equal(rig.shotActive, false);
  assert.ok(rig.lookTarget.distanceTo(new THREE.Vector3(0, 0.3, 2.3)) < 1e-6);
});

test('substituir um foco parte da câmera atual, sem salto para a dog', () => {
  const rig = createCameraRig(new THREE.PerspectiveCamera(), layout);
  rig.snapFollow(0, 0);
  const ctx = { t: 1, target: { x: 0, z: 0, vx: 0, vz: 0 } };
  rig.focusShot(3.5, 2.3);
  rig.update(1, ctx);
  const before = rig.position.clone();
  rig.focusShot(3.5, -2.2, { y: 1.4 });
  rig.update(1 / 60, ctx);
  assert.ok(rig.position.distanceTo(before) < 0.01);
  rig.snapFollow(0, 0);
  assert.equal(rig.shotActive, false);
});
