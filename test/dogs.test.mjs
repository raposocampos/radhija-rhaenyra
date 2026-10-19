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

test('comemoração: a volta é andando (o corpo percorre um círculo e as patas pisam), não um giro parado', () => {
  for (const kind of ['radhija', 'rhaenyra']) {
    for (const side of [1, -1]) {
      const d = createDog(kind);
      const inner = d.object.children[0];
      let steps = 0;
      d.onFootstep = () => steps++;
      for (let i = 0; i < 30; i++) d.update(1 / 60, { speed: 0, action: 'none' });
      let far = 0;
      let halfX = 0;
      let maxTurn = 0;
      let stepsInCircle = 0;
      for (let f = 0; f < Math.round(3.2 * 60); f++) {
        const t = f / 60;
        const before = steps;
        d.update(1 / 60, { speed: 0, action: 'celebrate', celebrateSide: side });
        const off = Math.hypot(inner.position.x, inner.position.z);
        far = Math.max(far, off);
        maxTurn = Math.max(maxTurn, Math.abs(inner.rotation.y));
        // no meio da voltinha (de costas para onde estava olhando), ela está do lado pedido, longe do lugar
        if (Math.abs(Math.abs(inner.rotation.y) - Math.PI) < 0.25) halfX = inner.position.x;
        if (t > 0.8 && t < 2.1) stepsInCircle += steps - before;
      }
      d.onFootstep = null;
      assert.ok(maxTurn > 5.5, `${kind}: deu a volta inteira (${maxTurn.toFixed(2)} rad)`);
      assert.ok(far > 0.3, `${kind}: andou o círculo (afastou ${far.toFixed(2)} m do lugar)`);
      assert.ok(halfX * side > 0.25, `${kind}: a voltinha vai para o lado ${side > 0 ? 'esquerdo' : 'direito'} (x ${halfX.toFixed(2)} m)`);
      assert.ok(stepsInCircle >= 3, `${kind}: as patas pisam na voltinha (${stepsInCircle} pisadas)`);
      assert.ok(Math.hypot(inner.position.x, inner.position.z) < 0.02 && Math.abs(inner.rotation.y % (2 * Math.PI)) < 0.05, `${kind}: termina de frente, no lugar dela`);
    }
  }
});

test('comemoração: mandada sentar no meio da voltinha, ela termina a volta (sem corte brusco) e depois senta', () => {
  for (const kind of ['radhija', 'rhaenyra']) {
    const d = createDog(kind);
    const inner = d.object.children[0];
    for (let i = 0; i < 30; i++) d.update(1 / 60, { speed: 0, action: 'none' });
    // começa a comemorar e, no meio da voltinha (1,4 s), o jogo manda sentar (o fim da vitória)
    for (let f = 0; f < Math.round(1.4 * 60); f++) d.update(1 / 60, { speed: 0, action: 'celebrate', celebrateSide: 1 });
    assert.ok(Math.hypot(inner.position.x, inner.position.z) > 0.15, `${kind}: estava no meio da voltinha`);
    let jump = 0;
    let spinJump = 0;
    let px = inner.position.x, pz = inner.position.z, py = inner.rotation.y;
    let backAt = -1;
    for (let f = 0; f < 120; f++) {
      d.update(1 / 60, { speed: 0, action: 'sit' });
      jump = Math.max(jump, Math.hypot(inner.position.x - px, inner.position.z - pz));
      let dy = Math.abs(inner.rotation.y - py) % (2 * Math.PI);
      dy = Math.min(dy, 2 * Math.PI - dy);
      spinJump = Math.max(spinJump, dy);
      px = inner.position.x;
      pz = inner.position.z;
      py = inner.rotation.y;
      if (backAt < 0 && Math.hypot(inner.position.x, inner.position.z) < 0.005) backAt = f / 60;
    }
    // a 1,4 m/s, um quadro anda ~2,5 cm; um corte voltaria tudo (~0,4 m) de uma vez
    assert.ok(jump < 0.04, `${kind}: sem salto de lugar ao mandar sentar (${(jump * 100).toFixed(1)} cm num quadro)`);
    assert.ok(spinJump < 0.2, `${kind}: sem virar de uma vez (${spinJump.toFixed(2)} rad num quadro)`);
    assert.ok(backAt > 0.3 && backAt < 1.0, `${kind}: terminou a voltinha no lugar dela (${backAt.toFixed(2)} s)`);
  }
});

test('comemoração: o tamanho da voltinha segue o espaço (celebrateLoop); sem espaço, pulinhos no lugar até a reverência', () => {
  for (const kind of ['radhija', 'rhaenyra']) {
    const res = {};
    for (const loop of [1, 0.5, 0]) {
      const d = createDog(kind);
      const inner = d.object.children[0];
      for (let i = 0; i < 30; i++) d.update(1 / 60, { speed: 0, action: 'none' });
      let far = 0, hopsMid = 0, maxTurn = 0;
      for (let f = 0; f < Math.round(2.1 * 60); f++) {
        d.update(1 / 60, { speed: 0, action: 'celebrate', celebrateSide: 1, celebrateLoop: loop });
        far = Math.max(far, Math.hypot(inner.position.x, inner.position.z));
        maxTurn = Math.max(maxTurn, Math.abs(inner.rotation.y));
        if (f / 60 > 1.0 && f / 60 < 2.0) hopsMid = Math.max(hopsMid, inner.position.y);
      }
      res[loop] = { far, hopsMid, maxTurn };
    }
    assert.ok(res[0.5].far > res[1].far * 0.4 && res[0.5].far < res[1].far * 0.6, `${kind}: voltinha pela metade (${res[0.5].far.toFixed(2)} × ${res[1].far.toFixed(2)} m)`);
    assert.ok(res[0.5].maxTurn > 5.5, `${kind}: a voltinha menor também dá a volta inteira`);
    assert.ok(res[0].far < 0.005 && res[0].maxTurn < 0.05, `${kind}: sem espaço, não sai do lugar nem gira (${res[0].far.toFixed(3)} m, ${res[0].maxTurn.toFixed(2)} rad)`);
    assert.ok(res[0].hopsMid > 0.03, `${kind}: sem espaço, segue nos pulinhos (${res[0].hopsMid.toFixed(3)} m)`);
  }
});

test('comemoração: interrompida no meio da voltinha por outra ação, ela volta ao lugar sem salto', () => {
  for (const kind of ['radhija', 'rhaenyra']) {
    const d = createDog(kind);
    const inner = d.object.children[0];
    for (let i = 0; i < 30; i++) d.update(1 / 60, { speed: 0, action: 'none' });
    for (let f = 0; f < Math.round(1.4 * 60); f++) d.update(1 / 60, { speed: 0, action: 'celebrate', celebrateSide: -1 });
    assert.ok(Math.hypot(inner.position.x, inner.position.z) > 0.15, `${kind}: estava no meio da voltinha`);
    let jump = 0;
    let px = inner.position.x, pz = inner.position.z;
    for (let f = 0; f < 90; f++) {
      d.update(1 / 60, { speed: 0, action: 'shake' });
      jump = Math.max(jump, Math.hypot(inner.position.x - px, inner.position.z - pz));
      px = inner.position.x;
      pz = inner.position.z;
    }
    assert.ok(jump < 0.06, `${kind}: sem salto de lugar (${(jump * 100).toFixed(1)} cm num quadro)`);
    assert.ok(Math.hypot(inner.position.x, inner.position.z) < 0.01, `${kind}: de volta ao lugar dela`);
  }
});

test('comemoração: as pisadas da voltinha levam a passada da animação (som e pegadas no jogo)', () => {
  for (const kind of ['radhija', 'rhaenyra']) {
    const d = createDog(kind);
    const speeds = [];
    d.onFootstep = (_i, v) => speeds.push(v);
    for (let i = 0; i < 30; i++) d.update(1 / 60, { speed: 0, action: 'none' });
    for (let f = 0; f < Math.round(2.1 * 60); f++) d.update(1 / 60, { speed: 0, action: 'celebrate', celebrateSide: 1 });
    d.onFootstep = null;
    // o jogo descarta pisada com passada < 0,4 m/s (src/fx/feedback.js)
    assert.ok(speeds.filter((v) => v >= 0.4).length >= 3, `${kind}: pisadas com passada (${speeds.map((v) => v.toFixed(2)).join(', ')})`);
  }
});
