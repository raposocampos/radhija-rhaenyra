// Cachorrinhas (src/dogs/): o modelo procedural monta no Node e a API pública se comporta como o jogo espera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';

installBrowserStubs();
const { createDog } = await import('../src/dogs/dog.js');
const dogs = { radhija: createDog('radhija'), rhaenyra: createDog('rhaenyra') };

const item = (geo, name = '') => {
  const g = new THREE.Group();
  g.name = name;
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial()));
  return g;
};

test('createDog: API pública (object, mouthSocket, markerAnchor, update, triggerBark, setCarryPose, setWet)', () => {
  for (const [kind, d] of Object.entries(dogs)) {
    assert.equal(d.kind, kind);
    assert.ok(d.object.isObject3D && d.mouthSocket.isObject3D && d.markerAnchor.isObject3D);
    assert.equal(d.object.name, kind);
    assert.ok(d.bones.length > 20, 'esqueleto');
    for (const k of ['update', 'triggerBark', 'setCarryPose', 'setWet']) assert.equal(typeof d[k], 'function', k);
  }
  assert.ok(dogs.rhaenyra.markerAnchor.position.y > dogs.radhija.markerAnchor.position.y, 'Rhaenyra é mais alta');
});

test('createDog: pose de boca detectada pelo item (bola, pantufa, cenoura) e forçada por setCarryPose', () => {
  const d = dogs.radhija;
  const cases = [
    [item(new THREE.SphereGeometry(0.035, 8, 6)), 'ball'],
    [item(new THREE.BoxGeometry(0.06, 0.03, 0.16), 'pantufa'), 'slipper'],
    [item(new THREE.CylinderGeometry(0.03, 0.01, 0.2, 6).rotateZ(Math.PI / 2)), 'carrot'],
  ];
  for (const [obj, kind] of cases) {
    d.mouthSocket.clear();
    d.mouthSocket.add(obj);
    d.update(1 / 60, { speed: 0, action: 'none', carrying: true });
    assert.equal(d.carryKind, kind);
  }
  d.setCarryPose('slipper');
  d.update(1 / 60, { speed: 0, action: 'none', carrying: true });
  assert.equal(d.carryKind, 'slipper', 'forçada');
  d.setCarryPose(null);
  d.mouthSocket.clear();
  d.update(1 / 60, { speed: 0, action: 'none' });
  assert.equal(d.carryKind, 'carrot', 'boca vazia volta à pose padrão');
});

test('createDog: passos (onFootstep) ao trotar e nenhum parada', () => {
  const d = dogs.rhaenyra;
  let steps = 0;
  d.onFootstep = () => steps++;
  for (let i = 0; i < 120; i++) d.update(1 / 60, { speed: 0, action: 'none' });
  assert.equal(steps, 0, 'parada não pisa');
  for (let i = 0; i < 120; i++) d.update(1 / 60, { speed: 2.0, action: 'none' });
  assert.ok(steps >= 6, `trotando 2 s: ${steps} passos`);
  d.onFootstep = null;
});

test('createDog: todas as ações rodam sem NaN nos ossos', () => {
  const d = dogs.radhija;
  for (const action of ['sit', 'push', 'strain', 'tug', 'celebrate', 'sniff', 'dash', 'turn', 'shake', 'startled', 'none']) {
    for (let i = 0; i < 30; i++) d.update(i % 5 ? 1 / 60 : 1 / 20, { speed: action === 'dash' ? 4 : 0.5, turn: 0.8, action, lookAt: new THREE.Vector3(1, 0.3, 1) });
    for (const b of d.bones) assert.ok(Number.isFinite(b.quaternion.x + b.position.y), `${action}: osso ${b.name} inválido`);
  }
  d.triggerBark();
  d.setWet(2);
  d.update(1 / 60, { speed: 0, action: 'none' });
  assert.equal(d.meshes.fur.material.userData.uniforms.uWet.value, 1, 'setWet limita a 1');
  d.setWet(0);
});
