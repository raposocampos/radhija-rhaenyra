import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPigeon } from '../src/world/pigeon.js';

// Somente a textura de sono usa canvas; a malha/animação Three.js é real.
globalThis.document = { createElement: () => ({ getContext: () => ({ strokeText() {}, fillText() {} }) }) };
const tick = (p, seconds, fps = 60, from = 0) => {
  for (let i = 1; i <= Math.round(seconds * fps); i++) p.update(1 / fps, from + i / fps);
};
const wing = (p) => p.object.getObjectByName('asa-direita');
const head = (p) => p.object.getObjectByName('cabeca');
const eyes = (p) => head(p).morphTargetInfluences;
/** Menor altura (mundo) entre os vértices de uma malha, com os alvos de morph aplicados. */
function lowest(mesh) {
  mesh.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let y = Infinity;
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
    mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
    y = Math.min(y, v.y);
  }
  return y;
}
function feetHeight(p) {
  p.object.updateMatrixWorld(true);
  return lowest(p.object.getObjectByName('pes').children[0]);
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
    low = Math.min(low, wing(p).rotation.z);
    high = Math.max(high, wing(p).rotation.z);
  }
  assert.ok(spread > folded * 2, `envergadura: ${folded} → ${spread}`);
  assert.ok(high > 0.8 && low < -0.6, 'batida passa acima e abaixo dos ombros');
  assert.equal(wing(p).geometry, geometry);
});

test('pouso recolhe asas gradualmente, abre o leque da cauda e devolve os pés ao apoio', () => {
  const p = createPigeon();
  p.setPose({ flying: true }); tick(p, 0.6);
  const feet = p.object.getObjectByName('pes');
  const tucked = feetHeight(p);
  p.setPose({ flightProgress: 0.98 }); tick(p, 0.1);
  assert.ok(feetHeight(p) < tucked, 'pés antecipam o contato');
  assert.ok(p.object.getObjectByName('cauda').morphTargetInfluences[0] > 0.8, 'leque aberto na frenagem');
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
    for (const x of [-0.026, 0.026]) {
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

test('sono e espiada (um olho só) continuam funcionando após um voo', () => {
  const p = createPigeon();
  p.setPose({ flying: true }); tick(p, 0.4);
  p.setPose({ flying: false, asleep: true }); tick(p, 2);
  const sleepingY = p.object.children[0].position.y;
  assert.ok(eyes(p)[0] > 0.95 && eyes(p)[1] > 0.95, 'dormindo de olhos fechados');
  p.peek(); tick(p, 0.5);
  assert.ok(p.object.children[0].position.y > sleepingY + 0.02);
  assert.ok(eyes(p)[0] < 0.3 && eyes(p)[1] > 0.9, `espia com um olho: ${eyes(p)}`);
  tick(p, 3);
  assert.ok(Math.abs(p.object.children[0].position.y - sleepingY) < 0.002);
  assert.ok(eyes(p)[0] > 0.95);
});

test('dormindo, a barriga encosta no apoio sem atravessar e os pés continuam no chão', () => {
  const p = createPigeon();
  p.setPose({ asleep: true }); tick(p, 3);
  const belly = lowest(p.object.getObjectByName('tronco'));
  assert.ok(belly > -0.01 && belly < 0.012, `barriga: ${belly}`);
  assert.ok(Math.abs(feetHeight(p)) < 0.005);
});

test('bicada: estica o pescoço, bate as asas no lugar e volta a cochilar', () => {
  const p = createPigeon();
  p.setPose({ x: 1, y: 0.5, z: -2, asleep: true }); tick(p, 3);
  p.object.updateMatrixWorld(true);
  const sleeping = head(p).getWorldPosition(new THREE.Vector3());
  const v = new THREE.Vector3();
  p.peck();
  let reach = -Infinity, flap = 0, open = 1;
  for (let i = 1; i <= 60; i++) {
    p.update(1 / 60, 3 + i / 60);
    p.object.updateMatrixWorld(true);
    reach = Math.max(reach, head(p).getWorldPosition(v).z - sleeping.z);
    flap = Math.max(flap, wing(p).rotation.z);
    if (i === 30) open = Math.max(...eyes(p));
    assert.ok(Math.abs(feetHeight(p) - 0.5) < 0.005, `pés no apoio no quadro ${i}`);
  }
  assert.ok(reach > 0.03, `cabeça avança na bicada: ${reach}`);
  assert.ok(flap > 0.4, `asas batem no lugar: ${flap}`);
  assert.ok(open < 0.2, 'olhos abertos no susto');
  assert.deepEqual(p.object.position.toArray(), [1, 0.5, -2], 'não sai do lugar');
  tick(p, 3, 60, 4);
  assert.ok(eyes(p)[0] > 0.95, 'volta a cochilar');
  assert.ok(Math.abs(wing(p).rotation.z) < 0.06, 'asas recolhidas');
});

test('acordado pisca de vez em quando e olha em volta', () => {
  const p = createPigeon({ seed: 5 });
  let blinks = 0, closedSum = 0, turned = 0, frames = 0;
  let last = 0;
  for (let i = 1; i <= 15 * 60; i++) {
    p.update(1 / 60, i / 60);
    const e = eyes(p)[0];
    if (e > 0.9 && last <= 0.9) blinks++;
    last = e;
    closedSum += e;
    turned = Math.max(turned, Math.abs(head(p).rotation.y));
    frames++;
  }
  assert.ok(blinks >= 2, `piscadas em 15 s: ${blinks}`);
  assert.ok(closedSum / frames < 0.15, 'olhos abertos quase o tempo todo');
  assert.ok(turned > 0.15, `gira a cabeça: ${turned}`);
});

test('custo: 7 malhas, 1 material e poucos triângulos por pombo', () => {
  const p = createPigeon();
  const meshes = [];
  p.object.traverse((o) => { if (o.isMesh) meshes.push(o); });
  assert.equal(meshes.length, 7);
  assert.equal(new Set(meshes.map((m) => m.material)).size, 1, 'um material para o pombo inteiro');
  const triangles = meshes.reduce((sum, m) => sum + m.geometry.index.count / 3, 0);
  assert.ok(triangles < 8000, `${triangles} triângulos`);
  for (const name of ['asa-direita', 'asa-esquerda', 'cauda', 'cabeca']) {
    const g = p.object.getObjectByName(name).geometry;
    for (const target of g.morphAttributes.position) assert.equal(target.count, g.attributes.position.count, name);
  }
  assert.deepEqual(Object.keys(head(p).morphTargetDictionary), ['olho-direito-fechado', 'olho-esquerdo-fechado']);
  const fx = p.object.getObjectByName('pescoco').geometry.getAttribute('pigeonFx');
  let irid = 0;
  for (let i = 0; i < fx.count; i++) irid = Math.max(irid, fx.getX(i));
  assert.ok(irid > 0.8, 'pescoço furta-cor');
});

test('furta-cor e brilho entram no shader padrão do Three com uma chave de programa só', () => {
  const material = createPigeon().object.getObjectByName('tronco').material;
  const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader, null);
  assert.match(shader.vertexShader, /attribute vec3 pigeonFx;/);
  assert.match(shader.vertexShader, /vPigeonFx = pigeonFx;/);
  assert.match(shader.fragmentShader, /varying vec3 vPigeonFx;/);
  assert.match(shader.fragmentShader, /diffuseColor\.rgb = mix\(diffuseColor\.rgb, pigeonIrid/);
  assert.match(shader.fragmentShader, /totalEmissiveRadiance \+= diffuseColor\.rgb \* \(vPigeonFx\.y/);
  const other = createPigeon({ seed: 9, tint: '#777b88' }).object.getObjectByName('tronco').material;
  assert.equal(material.customProgramCacheKey(), other.customProgramCacheKey());
});
