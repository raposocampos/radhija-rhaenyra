// Modelo de fase (src/levels/_modelo/, não registrado no jogo): garante que o ponto de partida das fases
// novas continua funcionando conforme o núcleo evolui. Também serve de modelo para o teste de uma fase nova.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { LEVELS } from '../src/levels/index.js';
import modelo from '../src/levels/_modelo/index.js';

const levels = [...LEVELS, modelo];

test('modelo: Rhaenyra na placa com Fica, Radhija busca a bolinha e volta', async () => {
  const h = await createHeadlessGame({ level: levels.length, levels });
  assert.equal(h.info().levelId, 'modelo');

  // Rhaenyra vai para a placa; troca para a Radhija e pede o Fica.
  h.tap('KeyQ');
  h.walkPath([[-1.6, 0.2], [-1.6, 2.6, { tol: 0.15 }]]);
  h.run(1.0);
  assert.ok(h.info().gate.t > 0.97, 'portão abriu com a Rhaenyra na placa');
  assert.equal(h.info().stage, 'gateOpen');
  h.tap('KeyQ');
  h.tap('KeyF');
  assert.ok(h.info().stay.rhaenyra);

  // Radhija atravessa o portão, pega a bolinha e volta.
  h.walkPath([[-0.8, 0.9], [0.8, 0.9], [2.2, -0.4], [3.0, -1.6, { tol: 0.15 }]]);
  assert.equal(h.info().prompt, 'Pegar a bolinha');
  h.tap('KeyE');
  assert.equal(h.info().carrier, 'radhija');
  h.walkPath([[2.2, -0.4], [0.8, 0.9], [-0.8, 0.9], [-1.6, 0.2], [-3.5, -2.9]]);
  assert.ok(h.run(6, { until: (s) => s.state === 'victory' }), 'vitória');
});

test('modelo: ?stage= pula para cada etapa', async () => {
  for (const s of ['gateOpen', 'carrying']) {
    const h = await createHeadlessGame({ level: levels.length, levels, query: `stage=${s}` });
    assert.equal(h.info().stage, s);
  }
});
