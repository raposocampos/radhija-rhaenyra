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

// Tetos de relógio: o jogo lento continua em tempo de jogo (e, devagar demais, segue com aviso no teto, como sempre);
// parado ou com a aba travada, a suíte reprova em segundos, dizendo qual espera, em que linha e a última leitura do
// estado (antes, só o timeout do workflow).
test('infra E2E: jogo lento mas andando mantém o prazo em tempo de jogo', { timeout: 65000 }, async () => {
  const result = await run('paced');
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /2 ok, 0 falha\(s\)/);
  assert.doesNotMatch(result.stdout, /\[harness\]/);
});

test('infra E2E: jogo devagar demais termina a espera no teto de relógio, com aviso, sem reprovar', { timeout: 65000 }, async () => {
  const result = await run('slow');
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /2 ok, 0 falha\(s\)/);
  assert.match(result.stdout, /\[harness\] aviso: gsleep\(1000 ms\) \(harness-probe\.mjs:\d+\) terminou pelo teto de relógio de 2 s, com [\d.]+ s de jogo \(ritmo 0\.0\d+×\) dos 1 s pedidos/);
  assert.match(result.stdout, /esperas encerradas pelo teto de relógio: 1 /);
  assert.doesNotMatch(result.stdout, /parou de avançar|FALHOU/);
});

for (const [kind, label, diagnosis] of [
  ['stalled', 'jogo parado (várias esperas curtas)', /gsleep\(200 ms\) \(harness-probe\.mjs:\d+\): o jogo parou de avançar: simSec 0 sem mudar há [\d.]+ s; prazo pedido 0\.2 s de jogo\. Última leitura: estado=playing fase=prova/],
  ['hung', 'aba travada', /info\(\) \(harness-probe\.mjs:\d+\): a página não respondeu em 2 s .*Última leitura do estado, há [\d.]+ s: estado=playing/],
]) {
  test(`infra E2E: ${label} reprova em segundos com diagnóstico`, { timeout: 65000 }, async () => {
    const t0 = Date.now();
    const result = await run(kind);
    const sec = (Date.now() - t0) / 1000;
    assert.equal(result.code, 1, `${result.stdout}\n${result.stderr}`);
    assert.equal(result.signal, null, 'não pode depender do timeout do processo');
    assert.ok(sec < 45, `levou ${sec} s`);
    assert.match(result.stdout, /FALHOU exceção: \[harness\] /);
    assert.match(result.stdout, diagnosis);
    if (kind === 'hung') assert.match(result.stdout, /ok +com a página travada, a ida seguinte ao navegador falha na hora/);
    assert.match(result.stdout, new RegExp(`FALHOU ${kind}`));
  });
}

// Quando nem os prazos do harness funcionam: uma operação em curso além de opMaxMs encerra o processo da suíte; um
// processo calado (event loop bloqueado) é encerrado de fora pelo runner, com o navegador e o diagnóstico da máquina.
test('infra E2E: operação sem retorno apesar do prazo encerra a suíte com diagnóstico', { timeout: 65000 }, async () => {
  const t0 = Date.now();
  const result = await run('stuck');
  const sec = (Date.now() - t0) / 1000;
  assert.equal(result.code, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.signal, null);
  assert.ok(sec < 45, `levou ${sec} s`);
  assert.match(result.stdout, /FALHOU \[harness\] load\('\?trava'\): abrir a página sem retorno há [\d.]+ s, mesmo com os prazos/);
  assert.match(result.stdout, /1 ok, 1 falha\(s\)/);
  assert.match(result.stdout, /FALHOU stuck/);
});

// Hipótese dos travamentos no primeiro load() (lavanderia, expresso): a aba cai e o Playwright deixa a espera pendente.
test('infra E2E: aba que cai no meio do load() reprova na hora, dizendo que caiu', { timeout: 65000 }, async () => {
  const t0 = Date.now();
  const result = await run('crash');
  const sec = (Date.now() - t0) / 1000;
  assert.equal(result.code, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.signal, null);
  assert.ok(sec < 15, `levou ${sec} s (antes do prazo de 120 s do Playwright e do opMaxMs de 20 s)`);
  assert.match(result.stdout, /\[harness\] a aba do navegador caiu \(crash do renderer\)/);
  assert.match(result.stdout, /FALHOU exceção: \[harness\] load\('\?sem-jogo'\): [^(]+ \(harness-probe\.mjs:\d+\): a aba do navegador caiu \(crash do renderer\)/);
  assert.match(result.stdout, /FALHOU crash/);
});

test('infra E2E: suíte calada é encerrada pelo runner com o diagnóstico', { timeout: 65000 }, async () => {
  const t0 = Date.now();
  const result = await run('mute');
  const sec = (Date.now() - t0) / 1000;
  assert.equal(result.code, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.signal, null, 'o runner encerra a suíte; ele mesmo termina normalmente');
  assert.ok(sec < 45, `levou ${sec} s`);
  assert.match(result.stdout, /\[e2e\] mute: \d+ s sem nenhuma saída; a suíte travou fora do alcance dos prazos do harness/);
  assert.match(result.stdout, /sinal do harness: o último foi há \d+ s; o processo da suíte parou de responder/);
  assert.match(result.stdout, /em curso: nada no harness/);
  assert.match(result.stdout, /máquina: carga [\d.]+\/[\d.]+\/[\d.]+ em \d+ CPUs/);
  assert.match(result.stdout, /FALHOU mute +sem contagem/);
});
