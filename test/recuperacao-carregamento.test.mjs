import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';

const failure = () => new Error('EST03_FALHA_CONTROLADA');

test('carregamento: seleção pela UI contém a rejeição e permite voltar ao menu intacto', async () => {
  const h = await createHeadlessGame({ mode: 'title' });
  h.levels[1].load = () => Promise.reject(failure());
  const failed = new Promise((resolve) => {
    const off = h.events.on('level:error', () => { if (h.game.state === 'load-error') { off(); resolve(); } });
  });
  h.events.emit('ui:selectLevel', { index: 1 });
  await failed;
  assert.equal(h.game.state, 'load-error');
  h.events.emit('ui:cancelLoad');
  assert.equal(h.game.state, 'title');
  assert.equal(h.game.levelDef.id, 'fase1');
});

test('carregamento: rejeição imediata não escapa durante a cortina e preserva a fase atual', async () => {
  const h = await createHeadlessGame({ query: 'stage=carrying' });
  const previous = { built: h.game.built, puzzle: h.game.puzzle, info: h.info() };
  assert.equal(previous.info.carrier, 'rhaenyra', 'cenário começa carregando o item');
  let calls = 0;
  h.levels[1].load = () => { calls++; return Promise.reject(failure()); };
  h.clearLog();
  const results = await Promise.all([h.game.loadLevel(1), h.game.loadLevel(1)]);
  assert.deepEqual(results, [false, false]);
  assert.equal(calls, 1, 'requisições concorrentes compartilham a tentativa');
  assert.equal(h.game.state, 'load-error');
  assert.equal(h.game.built, previous.built);
  assert.equal(h.game.puzzle, previous.puzzle);
  assert.equal(h.info().carrier, previous.info.carrier, 'item não foi devolvido nem descartado');
  assert.equal(h.log('level:error').length, 1);
  assert.equal(h.log('level:error')[0].canReturn, true);
  assert.equal(h.log('level:loaded').length, 0);
  h.run(0.5);
  assert.equal(h.info().timeSec, previous.info.timeSec, 'simulação fica congelada no erro');
  h.game.cancelLoad();
  assert.equal(h.game.state, previous.info.state);
  assert.equal(h.game.built, previous.built);
  h.levels[1].load = undefined;
  assert.equal(await h.game.loadLevel(1, { mode: 'play' }), true);
  assert.equal(h.game.levelDef.id, 'fase2');
  assert.equal(h.log('level:loaded').length, 1, 'retomada não duplica o evento');
});

test('carregamento: exceção síncrona na primeira carga tem ação de recarga, sem retorno inválido', async () => {
  const h = await createHeadlessGame({ configure({ levels }) { levels[0].load = () => { throw failure(); }; } });
  assert.equal(h.game.state, 'load-error');
  assert.equal(h.log('level:error')[0].initial, true);
  assert.equal(h.log('level:error')[0].canReturn, false);
  assert.equal(h.info().state, 'load-error', 'diagnóstico funciona antes da primeira montagem');
  assert.deepEqual(h.info().dogs, { radhija: null, rhaenyra: null });
  assert.doesNotThrow(() => h.run(0.5));
  h.game.cancelLoad();
  assert.equal(h.game.state, 'load-error');
  assert.equal(await h.game.loadLevel(0), false, 'não reconstrói estado incompleto na mesma página');
});

for (const point of ['build', 'createPuzzle', 'reset', 'dispose', 'compile']) {
  test(`carregamento: falha em ${point} impede uso e remontagem de objetos parciais`, async () => {
    const h = await createHeadlessGame();
    let brokenCalls = 0;
    const fail = () => { brokenCalls++; throw failure(); };
    if (point === 'build') h.levels[1].build = fail;
    if (point === 'createPuzzle') h.levels[1].createPuzzle = fail;
    if (point === 'reset') {
      const original = h.levels[1].createPuzzle;
      h.levels[1].createPuzzle = (context) => ({ ...original(context), reset: fail });
    }
    if (point === 'dispose') h.game.built.dispose = fail;
    if (point === 'compile') h.engine.renderer.compile = fail;
    h.clearLog();
    assert.equal(await h.game.loadLevel(1), false);
    assert.equal(h.game.state, 'load-error');
    assert.equal(h.log('level:error')[0].canReturn, false);
    assert.equal(h.log('level:loaded').length, 0);
    const snapshot = h.info();
    assert.equal(snapshot.state, 'load-error', 'diagnóstico continua disponível após descarte');
    assert.equal(snapshot.stage, null);
    assert.equal(snapshot.scent, null);
    assert.equal(snapshot.carrier, null);
    assert.doesNotThrow(() => h.run(1), 'nenhum update usa referências parciais');
    h.game.cancelLoad();
    assert.equal(h.game.state, 'load-error');
    assert.equal(await h.game.loadLevel(1), false);
    assert.equal(brokenCalls, 1, 'nova tentativa não duplica recursos');
  });
}
