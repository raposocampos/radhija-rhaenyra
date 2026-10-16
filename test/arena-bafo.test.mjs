// Arena do Bafo (src/levels/_bafo/): "o pombo e o portão", jogado no jogo headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { LEVELS } from '../src/levels/index.js';
import bafo from '../src/levels/_bafo/index.js';

const levels = [...LEVELS, bafo];
const L = bafo.layout;
const arena = (query = '') => createHeadlessGame({ level: levels.length, levels, query });

/** Rhaenyra empurra o ventilador para o norte até o encaixe (z = alignZ). */
function alignFan(h) {
  h.walkTo(L.FAN.start.x - 0.05, L.FAN.start.z - L.FAN.half - 0.3, { tol: 0.08 });
  h.hold([0, 1], ['ShiftLeft']);
  h.run(8, { until: (s) => s.fan.z > L.FAN.alignZ - 0.12 });
  h.hold(null);
  h.run(0.4);
}

/** Radhija entra no corredor e sopra para o leste. */
function blowInCorridor(h) {
  h.walkPath([[-0.4, 1.5], [-0.4, L.CORRIDOR.z, { tol: 0.12 }], [0.1, L.CORRIDOR.z, { tol: 0.12 }]]);
  h.hold([1, 0]);
  h.run(0.2);
  h.keyDown('KeyR');
  h.run(0.4);
  h.keyUp('KeyR');
  h.hold(null);
  h.run(0.1);
}

test('Arena do Bafo: partida completa (ventilador → corredor → bafo → duto → pombo → portão → cenoura)', async () => {
  const h = await arena();
  let i = h.info();
  assert.equal(i.levelId, 'bafo');
  assert.equal(i.objective, 'O ventilador é pesado: troque para a Rhaenyra (Q)');
  h.tap('KeyQ');
  alignFan(h);
  i = h.info();
  assert.ok(i.fan.aligned, `ventilador encaixado (z=${i.fan.z})`);
  assert.equal(h.log('fan:aligned').length, 1);
  assert.equal(i.objective, 'Agora a Radhija (Q): só ela cabe no corredor');

  h.tap('KeyQ');
  blowInCorridor(h);
  assert.equal(h.log('dog:bafo').length, 1);
  assert.ok(h.run(4, { until: () => h.log('scent:duct').length > 0 }), 'o vento levou a nuvem para o duto');
  assert.ok(h.run(3, { until: () => h.log('scent:exit').length > 0 }), 'a nuvem saiu do outro lado');
  assert.ok(h.run(3, { until: (s) => s.pigeon === 'flying' }), 'o pombo sentiu o cheiro e voou');
  assert.ok(h.run(3, { until: (s) => s.stage === 'gateOpen' }), 'pousou na placa: portão aberto');
  i = h.info();
  assert.ok(i.gate.locked && i.pigeon === 'B');
  assert.equal(h.log('pigeon:flee').length, 1);

  // as duas atravessam; a Radhija pega a cenoura e leva para casa
  h.walkPath([[-0.4, 1.4], [0.4, 0.0], [2.0, 0.0], [3.7, 1.2], [L.CARROT.x - 0.4, L.CARROT.z, { tol: 0.15 }]]);
  assert.equal(h.info().prompt, 'Pegar a cenoura');
  h.tap('KeyE');
  assert.equal(h.info().carrier, 'radhija');
  h.walkPath([[2.0, 0.0], [0.4, 0.0], [-1.5, -0.3], [-4.1, -2.8]]);
  assert.ok(h.run(6, { until: (s) => s.state === 'victory' }), 'vitória');
});

test('Arena do Bafo: sem o ventilador alinhado, o cheiro fica no corredor (dica) e o pombo não sai', async () => {
  const h = await arena();
  blowInCorridor(h);
  h.run(3);
  assert.equal(h.log('scent:duct').length, 0, 'sem vento o duto não puxa');
  assert.equal(h.info().pigeon, 'A');
  assert.ok(h.log('hint').some((x) => x.text === 'Sem vento, o cheiro não vai longe…'));
});

test('Arena do Bafo: a Radhija não move o ventilador; a Rhaenyra não entra no corredor', async () => {
  const h = await arena();
  h.walkTo(L.FAN.start.x - 0.05, L.FAN.start.z - L.FAN.half - 0.25, { tol: 0.08 });
  h.hold([0, 1], ['ShiftLeft']);
  h.run(1.0);
  h.hold(null);
  assert.ok(Math.abs(h.info().fan.z - L.FAN.start.z) < 0.01, 'o ventilador não andou');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Pesado demais para a Radhija')));
  h.tap('KeyQ');
  h.walkTo(-0.4, 1.6);
  h.hold([0, 1]);
  h.run(1.2);
  h.hold(null);
  assert.ok(h.ctrls.rhaenyra.z < L.CORRIDOR.z - L.CORRIDOR.half, 'parou na entrada');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('A Rhaenyra não cabe no corredor')));
});

test('Arena do Bafo: ?stage= pula para cada etapa', async () => {
  for (const s of ['gateOpen', 'carrying']) {
    const h = await arena(`stage=${s}`);
    assert.equal(h.info().stage, s);
  }
});
