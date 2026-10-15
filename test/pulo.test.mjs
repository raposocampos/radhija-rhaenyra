// Pulo da Rhaenyra: física (dogController), colisão com obstáculos puláveis, entrada (Espaço / ✕),
// eventos e a Arena do Pulo (src/levels/_pulo/, fase de desenvolvimento).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollisionWorld } from '../src/game/collision.js';
import { createPressurePlate } from '../src/game/mechanics/pressurePlate.js';
import { PAD } from '../src/game/input.js';
import { LEVELS } from '../src/levels/index.js';
import pulo from '../src/levels/_pulo/index.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const levels = [...LEVELS, pulo];
const arena = () => createHeadlessGame({ level: levels.length, levels, query: 'dog=rhaenyra' });
const FENCE = pulo.layout.LOG_FENCE;

test('colisão: obstáculo jumpable só deixa passar quem está no ar', () => {
  const world = createCollisionWorld({
    WORLD: { bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } },
    STATIC_COLLIDERS: [
      { id: 'tronco', shape: 'box', x: 0, z: 0, hx: 0.15, hz: 3, jumpable: true },
      { id: 'muro', shape: 'box', x: 2, z: 0, hx: 0.1, hz: 3 },
    ],
  });
  assert.ok(world.move(-0.6, 0, 1.2, 0, 0.22, 'large').x < -0.3, 'no chão, o tronco bloqueia');
  assert.ok(world.move(-0.6, 0, 1.2, 0, 0.22, 'large', { airborne: true }).x > 0.5, 'no ar, passa por cima');
  assert.ok(world.move(1.4, 0, 1.5, 0, 0.22, 'large', { airborne: true }).x < 1.9, 'no ar, o muro alto segue bloqueando');
  assert.ok(world.overlaps(0, 0, 0.22, 'large') && !world.overlaps(0, 0, 0.22, 'large', { airborne: true }));
});

test('pulo: Rhaenyra pula a cerca de troncos; sem pular, não passa', async () => {
  const h = await arena();
  const r = h.ctrls.rhaenyra.r;
  h.teleport('rhaenyra', FENCE.x - 1.2, -0.5, Math.PI / 2);
  h.hold([1, 0]);
  h.run(1.5);
  h.hold(null);
  let c = h.ctrls.rhaenyra;
  assert.ok(c.x < FENCE.x - FENCE.hx - r + 0.02, `sem pular, parou na cerca (x=${c.x.toFixed(2)})`);

  h.teleport('rhaenyra', FENCE.x - 1.0, -0.5, Math.PI / 2);
  h.run(0.2);
  h.clearLog();
  h.hold([1, 0]);
  h.run(0.25);
  h.tap('Space', 0);
  let peak = 0;
  for (let i = 0; i < 60; i++) { h.step(); peak = Math.max(peak, h.ctrls.rhaenyra.y); }
  h.hold(null);
  h.run(0.2);
  c = h.ctrls.rhaenyra;
  assert.ok(c.x > FENCE.x + FENCE.hx + r, `pulou para o outro lado (x=${c.x.toFixed(2)})`);
  assert.ok(Math.abs(peak - pulo.layout.DOGS.rhaenyra.jumpHeight) < 0.02, `altura do pulo ≈ jumpHeight (${peak.toFixed(3)})`);
  assert.equal(c.y, 0);
  assert.equal(h.log('dog:jump').length, 1);
  assert.equal(h.log('dog:land').length, 1);
  assert.ok(!h.world.overlaps(c.x, c.z, c.r * 0.99, c.size), 'pousou num lugar livre');
});

test('pulo: a Radhija não pula (nem passa a cerca de troncos com arrancada)', async () => {
  const h = await createHeadlessGame({ level: levels.length, levels });
  assert.equal(h.info().activeDog, 'radhija');
  h.teleport('radhija', FENCE.x - 1.0, -0.5, Math.PI / 2);
  h.run(0.2);
  h.clearLog();
  h.hold([1, 0]);
  h.run(0.2);
  h.tap('Space');
  h.tap('ShiftLeft');
  h.run(1.0);
  h.hold(null);
  assert.equal(h.log('dog:jump').length, 0);
  assert.ok(h.ctrls.radhija.x < FENCE.x, 'parou na cerca');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('A Radhija não pula')), 'dica de trocar para a Rhaenyra');
});

test('pulo: a mureta alta não dá para pular', async () => {
  const h = await arena();
  const W = pulo.layout.TALL_WALL;
  h.teleport('rhaenyra', W.x - 1.0, 2.6, Math.PI / 2);
  h.run(0.2);
  h.hold([1, 0]);
  h.run(0.25);
  h.tap('Space', 0);
  h.run(1.0);
  h.hold(null);
  assert.ok(h.ctrls.rhaenyra.x < W.x, `não atravessou (x=${h.ctrls.rhaenyra.x.toFixed(2)})`);
  assert.ok(h.log('hint').some((x) => x.text === 'Alto demais para pular!'));
});

test('pulo: parado é no lugar; pousar em cima do tronco devolve para um lugar livre', async () => {
  const h = await arena();
  h.teleport('rhaenyra', -2.5, -0.5, 0);
  h.run(0.5);
  const x0 = h.ctrls.rhaenyra.x;
  const z0 = h.ctrls.rhaenyra.z;
  h.tap('Space');
  h.run(0.8);
  assert.ok(Math.hypot(h.ctrls.rhaenyra.x - x0, h.ctrls.rhaenyra.z - z0) < 0.05, 'pulo no lugar');
  // Pulo curto e lento que termina sobre a cerca: o pouso empurra para fora do tronco.
  for (const startX of [FENCE.x - 0.75, FENCE.x - 0.6, FENCE.x - 0.45]) {
    h.teleport('rhaenyra', startX, -0.5, Math.PI / 2);
    h.run(0.3);
    h.ctrls.rhaenyra.v = 0.9;
    h.tap('Space', 0);
    h.ctrls.rhaenyra.v = 0.9; // mantém o pulo curto
    h.run(1.0);
    const c = h.ctrls.rhaenyra;
    assert.ok(!h.world.overlaps(c.x, c.z, c.r * 0.99, c.size), `livre depois de pousar (início x=${startX.toFixed(2)}, fim x=${c.x.toFixed(2)})`);
  }
});

test('pulo: ✕ do controle pula; ✕ segurado no menu não pula ao voltar', async () => {
  const h = await arena();
  const lt = (on) => h.setPad(h.pad({ down: on ? [PAD.A] : [] }));
  lt(false);
  h.run(0.2);
  h.clearLog();
  lt(true);
  h.run(0.1);
  lt(false);
  h.run(0.8);
  assert.equal(h.log('dog:jump').length, 1, '✕ pula');
  // pausa → ✕ segurado → retoma: não pula
  h.tap('Escape');
  assert.equal(h.info().state, 'paused');
  lt(true);
  h.events.emit('ui:resume', {});
  h.run(0.5);
  assert.equal(h.log('dog:jump').length, 1, '✕ do menu travado até soltar');
  h.setPad(null);
});

test('pulo: trocar de dog no ar — a Rhaenyra termina o pulo como companheira e pousa uma vez', async () => {
  const h = await arena();
  h.teleport('rhaenyra', -2.5, -0.5, 0);
  h.run(0.3);
  h.clearLog();
  h.tap('Space');
  h.tap('KeyQ');
  assert.equal(h.info().activeDog, 'radhija');
  h.run(1.0);
  assert.equal(h.log('dog:land').length, 1);
  assert.equal(h.ctrls.rhaenyra.y, 0);
});

test('pulo: placa de pressão não conta quem está no ar', () => {
  const plate = createPressurePlate({ id: 'p', x: 0, z: 0, r: 0.5, requires: 'large', emit: () => {} });
  const dog = { name: 'rhaenyra', size: 'large', x: 0, z: 0, r: 0.22, jumpT: 0.2 };
  assert.equal(plate.update(1 / 60, { ctrls: { rhaenyra: dog } }).pressed, false, 'no ar');
  dog.jumpT = 0;
  assert.equal(plate.update(1 / 60, { ctrls: { rhaenyra: dog } }).pressed, true, 'no chão');
});

test('Arena do Pulo: partida completa (pula, pega a bolinha, pula de volta, entrega)', async () => {
  const h = await createHeadlessGame({ level: levels.length, levels });
  assert.equal(h.info().levelId, 'pulo');
  assert.equal(h.info().objective, 'Troque para a Rhaenyra (Q): só ela pula');
  h.tap('KeyQ');
  const jumpEast = (dir) => {
    h.hold([dir, 0]);
    h.run(0.15);
    h.tap('Space', 0);
    h.run(0.6);
    h.hold(null);
    h.run(0.2);
  };
  h.walkTo(FENCE.x - 0.8, -0.8);
  jumpEast(1);
  assert.ok(h.ctrls.rhaenyra.x > FENCE.x, 'do outro lado');
  h.walkTo(pulo.layout.BALL.x - 0.4, pulo.layout.BALL.z + 0.1, { tol: 0.15 });
  assert.equal(h.info().prompt, 'Pegar a bolinha');
  h.tap('KeyE');
  assert.equal(h.info().carrier, 'rhaenyra');
  h.walkTo(FENCE.x + 0.8, -0.8);
  jumpEast(-1);
  assert.ok(h.ctrls.rhaenyra.x < FENCE.x, 'de volta, com a bolinha');
  h.walkPath([[-1.2, -0.8], [-3.5, -2.8]]);
  assert.ok(h.run(6, { until: (s) => s.state === 'victory' }), 'vitória');
});
