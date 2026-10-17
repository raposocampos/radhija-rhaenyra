import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameEvents } from '../src/game/gameEvents.js';
import { createHeadlessGame } from './helpers/headless.mjs';

test('eventos: registra antes do dispatch e calcula a vibração depois dos listeners', () => {
  const order = [];
  const payload = { strength: 0.2 };
  const gameEvents = createGameEvents({
    now: () => { order.push('clock'); return 12.6; },
    dispatch(name, received) {
      order.push('dispatch');
      assert.equal(name, 'dog:bump');
      assert.equal(received, payload);
      assert.deepEqual(gameEvents.log, [{ t: 13, name, payload }]);
      received.strength = 0.8;
    },
    rumble(pattern) {
      order.push('rumble');
      assert.deepEqual(pattern(), [0.42, 0.35, 90]);
    },
  });
  gameEvents.emit('dog:bump', payload);
  assert.deepEqual(order, ['clock', 'dispatch', 'rumble']);
  assert.equal(gameEvents.log[0].payload, payload, 'histórico preserva a referência do payload');
});

test('eventos: eventos sem vibração recebem payload próprio sem efeitos na criação', () => {
  const dispatched = [];
  const gameEvents = createGameEvents({
    now: () => 1,
    dispatch: (name, payload) => dispatched.push({ name, payload }),
    rumble: () => assert.fail('evento sem padrão não consulta a vibração'),
  });
  assert.deepEqual(dispatched, []);
  assert.deepEqual(gameEvents.log, []);
  gameEvents.emit('input:device');
  gameEvents.emit('custom:event');
  assert.deepEqual(dispatched.map((e) => e.payload), [{}, {}]);
  assert.notEqual(dispatched[0].payload, dispatched[1].payload);
  assert.equal(gameEvents.log[0].payload, dispatched[0].payload);
  assert.equal(gameEvents.log[1].payload, dispatched[1].payload);
});

test('eventos: mistura diagnóstico e dispatch no limite de 500 sem trocar o array', () => {
  let tick = 0;
  const gameEvents = createGameEvents({ dispatch() {}, now: () => tick++, rumble() {} });
  const originalLog = gameEvents.log;
  for (let i = 0; i < 502; i++) {
    if (i % 2) gameEvents.recordCameraShot(i, -i);
    else gameEvents.emit('custom:event', { i });
  }
  assert.equal(gameEvents.log, originalLog);
  assert.equal(gameEvents.log.length, 500);
  assert.equal(gameEvents.log[0].t, 2, 'descarta os mais antigos de ambas as origens');
  assert.equal(gameEvents.log.at(-1).t, 501);
  const filtered = gameEvents.events('camera:shot');
  assert.equal(filtered.length, 250);
  assert.ok(filtered.every((entry) => entry.name === 'camera:shot'));
  assert.equal(filtered[0], gameEvents.log[1]);
  const all = gameEvents.events();
  assert.notEqual(all, originalLog, 'consulta devolve uma lista independente');
  assert.deepEqual(all, originalLog);
  gameEvents.clearLog();
  assert.equal(gameEvents.log, originalLog);
  assert.equal(originalLog.length, 0);
  assert.equal(all.length, 500, 'limpeza não modifica consultas já devolvidas');
  gameEvents.emit('custom:event', { i: 502 });
  assert.equal(originalLog.length, 1, 'a mesma referência volta a receber eventos');
});

test('eventos: camera:shot arredonda coordenadas e não passa pelo barramento', () => {
  const gameEvents = createGameEvents({
    now: () => 20.4,
    dispatch: () => assert.fail('foco de câmera é só diagnóstico'),
    rumble: () => assert.fail('foco de câmera não vibra'),
  });
  gameEvents.recordCameraShot(1.234, -2.346);
  assert.deepEqual(gameEvents.events('camera:shot'), [
    { t: 20, name: 'camera:shot', payload: { x: 1.23, z: -2.35 } },
  ]);
});

test('eventos: callback pode recusar vibração sem ler seus campos do payload', () => {
  let allowed = false;
  let reads = 0;
  const pulses = [];
  const gameEvents = createGameEvents({
    now: () => 0,
    dispatch() {},
    rumble: (pattern) => { if (allowed) pulses.push(pattern()); },
  });
  const payload = { get locked() { reads++; return true; } };
  gameEvents.emit('wedge:kick', payload);
  assert.equal(reads, 0);
  allowed = true;
  gameEvents.emit('wedge:kick', payload);
  assert.equal(reads, 1);
  assert.deepEqual(pulses, [[0.35, 0.3, 160]]);
});

test('eventos: falha de dispatch mantém diagnóstico e não executa vibração', () => {
  const error = new Error('dispatch interrompido');
  const gameEvents = createGameEvents({
    now: () => 0,
    dispatch: () => { throw error; },
    rumble: () => assert.fail('dispatch deve terminar antes da vibração'),
  });
  assert.throws(() => gameEvents.emit('dog:dash'), (caught) => caught === error);
  assert.equal(gameEvents.log[0].name, 'dog:dash');
});

test('eventos: núcleo decide vibração pelo estado atual após dispatch e mantém debug público', async (t) => {
  let emit;
  const pulses = [];
  const h = await createHeadlessGame({
    mode: 'title',
    configure({ game, levels }) {
      game.input.rumble = (...pattern) => pulses.push(pattern);
      const createPuzzle = levels[0].createPuzzle;
      levels[0].createPuzzle = (ctx) => { emit = ctx.emit; return createPuzzle(ctx); };
    },
  });
  const log = h.game.debug.log;
  emit('dog:dash');
  assert.equal(pulses.length, 0, 'menu não vibra por evento do puzzle');
  h.events.emit('ui:play');
  emit('dog:dash');
  assert.deepEqual(pulses, [[0.05, 0.28, 70]]);
  const offPause = h.events.on('dog:dash', () => h.events.emit('ui:pause'));
  t.after(offPause);
  emit('dog:dash');
  assert.equal(h.game.state, 'paused');
  assert.equal(pulses.length, 1, 'listener que pausa impede vibração do mesmo evento');
  offPause();
  emit('dog:dash');
  assert.equal(pulses.length, 1);
  h.events.emit('ui:resume');
  h.game.puzzle.update = () => 'delivered';
  h.step();
  assert.equal(h.game.state, 'celebrating');
  pulses.length = 0;
  emit('dog:dash');
  assert.deepEqual(pulses, [[0.05, 0.28, 70]], 'comemoração ainda permite vibração');
  h.run(3.2);
  assert.equal(h.game.state, 'victory');
  pulses.length = 0;
  emit('dog:dash');
  assert.deepEqual(pulses, [], 'tela de vitória não vibra');

  let cameraDispatches = 0;
  const offCamera = h.events.on('camera:shot', () => cameraDispatches++);
  t.after(offCamera);
  h.clearLog();
  h.game.debug.cam.focusShot(1.234, -2.346);
  assert.equal(cameraDispatches, 0);
  assert.equal(h.game.debug.log, log);
  assert.deepEqual(h.log('camera:shot'), [{ x: 1.23, z: -2.35 }]);
  assert.equal(h.game.debug.cam.shotActive, true, 'wrapper ainda executa o foco real');
  h.clearLog();
  assert.equal(h.game.debug.log, log);
  assert.equal(log.length, 0);
});
