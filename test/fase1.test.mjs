// Fase 1 (Operação Cenoura): lógica do puzzle rodando no jogo headless, com teclas simuladas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';

test('fase 1: partida completa (abertura → cordinha → carrinho → cenoura → porta → vitória)', async () => {
  const h = await createHeadlessGame({ level: 1 });
  let i = h.info();
  assert.equal(i.state, 'playing');
  assert.equal(i.stage, 'start');
  assert.equal(i.activeDog, 'radhija');

  // Radhija passa pela abertura da cerca.
  h.walkTo(0.3, -2.1);
  h.walkTo(1.7, -2.05);
  i = h.info();
  assert.equal(i.stage, 'east');

  // A Rhaenyra fica esperando do lado oeste, junto ao portão (sem caminho).
  h.walkTo(1.5, 0.9);
  h.run(2.8);
  i = h.info();
  assert.equal(i.prompt, 'Puxar a cordinha');
  assert.ok(i.dogs.rhaenyra.x < 1.0, `Rhaenyra no oeste (x=${i.dogs.rhaenyra.x})`);
  assert.equal(i.dogs.rhaenyra.mode, 'wait');

  // Cordinha → portão abre.
  h.tap('KeyE');
  assert.equal(h.info().dogs.radhija.action, 'tug');
  h.run(2.2);
  i = h.info();
  assert.equal(i.stage, 'gateOpen');
  assert.ok(i.gate.open);
  assert.equal(h.log('gate:open').length, 1);

  // A companheira atravessa o portão.
  h.run(3.5);
  assert.ok(h.info().dogs.rhaenyra.x > 1.05, 'Rhaenyra passou pelo portão');

  // Rhaenyra empurra o carrinho (Shift).
  h.tap('KeyQ');
  assert.equal(h.info().activeDog, 'rhaenyra');
  h.walkTo(2.6, -1.0);
  h.walkTo(3.5, -2.25, { tol: 0.15 });
  h.hold([1, 0]);
  h.run(0.6);
  assert.ok(h.log('hint').some((x) => x.text === 'Segure Shift para empurrar'));
  assert.equal(h.info().cart.x, 4.4, 'sem Shift o carrinho não anda');
  h.hold([1, 0], ['ShiftLeft']);
  h.run(2.0);
  h.hold(null);
  h.run(0.3);
  i = h.info();
  assert.ok(i.cart.x >= 5.25, `carrinho movido (x=${i.cart.x})`);
  assert.equal(i.stage, 'cartMoved');

  // Pega a cenoura e leva até a porta.
  h.run(1.5);
  h.walkTo(4.4, -3.55, { tol: 0.15 });
  assert.equal(h.info().prompt, 'Pegar a cenoura');
  h.tap('KeyE');
  i = h.info();
  assert.equal(i.stage, 'carrying');
  assert.equal(i.carrier, 'rhaenyra');
  assert.equal(h.props.carrot.object.parent, h.dogs.rhaenyra.mouthSocket, 'cenoura no mouthSocket');

  h.walkPath([[3.0, -1.2], [1.75, 1.6], [0.35, 1.75], [-2.0, -1.0], [-3.6, -3.7]]);
  assert.ok(['celebrating', 'victory'].includes(h.info().state), h.info().state);
  h.run(3.5);
  i = h.info();
  assert.equal(i.state, 'victory');
  const vic = h.log('victory');
  assert.equal(vic.length, 1);
  assert.equal(vic[0].total, 3);

  // Reiniciar devolve tudo ao começo.
  h.events.emit('ui:restart', {});
  h.run(0.2);
  i = h.info();
  assert.equal(i.state, 'playing');
  assert.equal(i.stage, 'start');
  assert.equal(i.carrier, null);
  assert.equal(i.cart.x, 4.4);
  assert.equal(i.gate.t, 0);
  assert.notEqual(h.props.carrot.object.parent, h.dogs.rhaenyra.mouthSocket, 'cenoura devolvida à cena');
});

test('fase 1: Rhaenyra não passa pela abertura nem com arrancada; Radhija não move o carrinho', async () => {
  const h = await createHeadlessGame({ level: 1, query: 'dog=rhaenyra' });
  h.walkTo(0.3, -2.1);
  h.hold([1, 0]);
  h.run(1.2);
  h.tap('ShiftLeft');
  h.run(0.5);
  h.hold(null);
  assert.ok(h.info().dogs.rhaenyra.x < 0.75, `Rhaenyra bloqueada (x=${h.info().dogs.rhaenyra.x})`);
  assert.ok(h.log('hint').some((x) => x.text.startsWith('A Rhaenyra não cabe')));

  h.tap('KeyQ');
  h.teleport('radhija', 3.2, -2.25);
  h.run(1.2);
  h.hold([1, 0]);
  h.run(0.1);
  h.tap('ShiftLeft');
  h.run(0.7);
  const i = h.info();
  h.hold(null);
  assert.equal(i.cart.x, 4.4, 'carrinho não se move');
  assert.equal(i.dogs.radhija.action, 'strain');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Pesado demais')));
});

test('fase 1: ?stage=<etapa> pula para cada etapa', async () => {
  for (const s of ['east', 'gateOpen', 'cartMoved', 'carrying']) {
    const h = await createHeadlessGame({ level: 1, query: `stage=${s}` });
    assert.equal(h.info().stage, s);
  }
});
