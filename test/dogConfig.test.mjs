import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOG_CONFIG, withStart } from '../src/dogs/config.js';
import { createController, canDash, canJump } from '../src/game/dogController.js';
import fase1 from '../src/levels/fase1/layout.js';
import fase2 from '../src/levels/fase2/layout.js';
import fase3 from '../src/levels/fase3/layout.js';
import fase4 from '../src/levels/fase4/layout.js';
import fase5 from '../src/levels/fase5/layout.js';
import modelo from '../src/levels/_modelo/layout.js';
import pulo from '../src/levels/_pulo/layout.js';
import bafo from '../src/levels/_bafo/layout.js';

test('atributos comuns não têm posição inicial e resistem a alterações acidentais', () => {
  const before = structuredClone(DOG_CONFIG);
  for (const name of ['radhija', 'rhaenyra']) {
    assert.equal(Object.hasOwn(DOG_CONFIG[name], 'start'), false);
    assert.throws(() => { DOG_CONFIG[name].walkSpeed = 999; }, TypeError);
    assert.throws(() => { DOG_CONFIG[name].visual.headTop = 999; }, TypeError);
    assert.throws(() => { DOG_CONFIG[name] = {}; }, TypeError);
  }
  assert.deepEqual(DOG_CONFIG, before);
});

test('configurações de layout não compartilham posição nem guia visual mutáveis', () => {
  for (const name of ['radhija', 'rhaenyra']) {
    const start = { x: 1, z: 2, yaw: 0.3 };
    const first = withStart(name, start);
    const second = withStart(name, start);
    const expected = structuredClone(second);
    first.walkSpeed = 999;
    first.visual.headTop = 999;
    first.start.x = 999;
    start.z = 999;
    assert.deepEqual(second, expected);
    assert.equal(first.start.z, 2, 'o layout não deve guardar a posição recebida por referência');
    assert.equal(start.x, 1, 'alterar a configuração não deve editar o objeto do chamador');
    assert.deepEqual(withStart(name, expected.start), expected, 'uma fase não pode modificar a definição comum');
  }
});

// Posições existentes antes da extração, para detectar uma migração que muda o
// ponto de entrada de qualquer fase, inclusive as arenas fora do menu.
const layouts = [
  ['fase1', fase1, [-3.25, -3.75, 0.6], [-3.95, -3.85, 0.9]],
  ['fase2', fase2, [-4.4, -3.25, 2.3], [-5.1, -3.4, 2.6]],
  ['fase3', fase3, [-4.6, -3.4, 2.4], [-5.4, -3.5, 2.7]],
  ['fase4', fase4, [-4.4, -1.7, 1.4], [-5.2, -1.85, 1.3]],
  ['fase5', fase5, [-4.5, 1.15, 1.7], [-5.1, 0.95, 1.6]],
  ['modelo', modelo, [-3.0, -2.4, 0.6], [-3.7, -2.6, 0.8]],
  ['pulo', pulo, [-3.0, -1.9, 1.2], [-3.7, -2.2, 1.2]],
  ['bafo', bafo, [-3.6, -1.6, 1.2], [-4.2, -2.1, 1.2]],
];

test('todos os layouts preservam os pontos de entrada e as habilidades das personagens', () => {
  const objects = new Set();
  for (const [id, layout, radhijaStart, rhaenyraStart] of layouts) {
    for (const [name, expectedStart] of [['radhija', radhijaStart], ['rhaenyra', rhaenyraStart]]) {
      const cfg = layout.DOGS[name];
      const { start, ...attributes } = cfg;
      assert.deepEqual(attributes, DOG_CONFIG[name], `${id}: atributos comuns da ${name}`);
      for (const object of [cfg, cfg.start, cfg.visual]) {
        assert.ok(!objects.has(object), `${id}: configuração independente da ${name}`);
        objects.add(object);
      }
      assert.notEqual(cfg.visual, DOG_CONFIG[name].visual);
      const controller = createController(name, cfg);
      assert.deepEqual([controller.x, controller.z, controller.yaw], expectedStart, `${id}: início da ${name}`);
      assert.equal(!!canDash(controller), name === 'radhija', `${id}: arrancada`);
      assert.equal(canJump(controller), name === 'rhaenyra', `${id}: pulo`);
      assert.equal(!!cfg.bafoSpeed, name === 'radhija', `${id}: superbafo`);
      assert.ok(cfg.lickStroke > 0 && cfg.lickReach > 0, `${id}: Lambe-Lambe (as duas)`);
    }
  }
});
