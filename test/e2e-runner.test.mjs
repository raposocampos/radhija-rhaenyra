import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suiteResult } from '../tools/scripts/lib/suite-runner.mjs';

test('E2E: exige processo bem-sucedido, resumo presente e ausência de erros', () => {
  assert.equal(suiteResult(0, '3 ok, 0 falha(s)\nsem erros de console').failed, false);
  assert.equal(suiteResult(1, '3 ok, 0 falha(s)').failed, true);
  assert.equal(suiteResult(null, '3 ok, 0 falha(s)').failed, true);
  assert.equal(suiteResult(0, 'processo interrompido sem resumo').failed, true);
});

test('E2E: resumo com falhas reprova mesmo se a suíte sair com código zero', () => {
  assert.equal(suiteResult(0, '2 ok, 1 falha(s)').failed, true);
});

test('E2E: erros de console não desaparecem atrás de um diagnóstico longo', () => {
  const output = `3 ok, 0 falha(s)\nERROS DE CONSOLE (1):\n${'diagnóstico '.repeat(1000)}`;
  assert.equal(suiteResult(0, output).failed, true);
  assert.equal(suiteResult(0, output).consoleErrors, true);
});
