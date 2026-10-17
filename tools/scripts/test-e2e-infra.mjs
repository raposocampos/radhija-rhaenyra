// node --test tools/scripts/test-e2e-infra.mjs (Chromium necessário; executar no CI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const probe = fileURLToPath(new URL('./fixtures/harness-probe.mjs', import.meta.url));
async function run(kind) {
  try {
    return { code: 0, ...await exec(process.execPath, [probe, '--runner', '--case', kind], { timeout: 60000, windowsHide: true }) };
  } catch (error) {
    return { code: error.code, stdout: error.stdout, stderr: error.stderr, signal: error.signal };
  }
}

test('infra E2E: navegador sem erros aprova a cadeia completa', { timeout: 65000 }, async () => {
  const result = await run('clean');
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /1 ok, 0 falha\(s\)/);
  assert.match(result.stdout, /sem erros de console/);
  assert.doesNotMatch(result.stdout, /FALHOU/);
});

for (const [kind, marker] of [
  ['console', '[console.error] EST01_CONSOLE_INJETADO'],
  ['exception', '[pageerror] EST01_EXCECAO_INJETADA'],
]) {
  test(`infra E2E: ${kind} injetado reprova o processo final com asserção aprovada`, { timeout: 65000 }, async () => {
    const result = await run(kind);
    assert.equal(result.code, 1, `${result.stdout}\n${result.stderr}`);
    assert.equal(result.signal, null, 'não pode aprovar por timeout ou sinal');
    assert.match(result.stdout, /1 ok, 1 falha\(s\)/);
    assert.match(result.stdout, /ERROS DE CONSOLE \(1\)/);
    assert.ok(result.stdout.includes(marker), result.stdout);
    assert.match(result.stdout, new RegExp(`FALHOU ${kind}`));
  });
}

test('infra E2E: asserção falha continua reprovando sem erro de console', { timeout: 65000 }, async () => {
  const result = await run('assertion');
  assert.equal(result.code, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.signal, null);
  assert.match(result.stdout, /1 ok, 1 falha\(s\)/);
  assert.match(result.stdout, /EST01_ASSERCAO_INJETADA/);
  assert.match(result.stdout, /sem erros de console/);
  assert.match(result.stdout, /FALHOU assertion/);
});
