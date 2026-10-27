import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suiteResult } from '../tools/scripts/lib/suite-runner.mjs';
import { angleArgs, browserOptions, disabledFeaturesOptions, playwrightDisabledFeaturesArg } from '../tools/scripts/lib/browser.mjs';
import { summarizeStacks } from '../tools/scripts/lib/hang-probe.mjs';

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

test('E2E: o Chromium dos testes desliga o streaming de scripts sem apagar a lista do Playwright', () => {
  const pw = '--disable-features=PaintHolding,LazyFrameLoading';
  const opts = disabledFeaturesOptions(pw, ['ScriptStreaming']);
  // o Chromium só lê o último --disable-features: a lista do Playwright sai e entra uma só, com as duas
  assert.deepEqual(opts.ignoreDefaultArgs, [pw]);
  assert.deepEqual(opts.args, ['--disable-features=PaintHolding,LazyFrameLoading,ScriptStreaming']);
  assert.deepEqual(disabledFeaturesOptions('--disable-features=ScriptStreaming', ['ScriptStreaming']).args, ['--disable-features=ScriptStreaming']);
  // sem achar a lista do Playwright, nada muda (melhor sem a correção do que sem a lista dele)
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.deepEqual(disabledFeaturesOptions(null), { ignoreDefaultArgs: [], args: [] });
  } finally {
    console.warn = warn;
  }
  // a versão instalada do Playwright ainda expõe a lista (se mudar de lugar, este teste avisa)
  const real = playwrightDisabledFeaturesArg();
  assert.match(real ?? '', /^--disable-features=.+/);
  const { ignoreDefaultArgs, args } = browserOptions();
  assert.deepEqual(ignoreDefaultArgs, [real]);
  const merged = args.filter((a) => a.startsWith('--disable-features='));
  assert.equal(merged.length, 1);
  assert.ok(merged[0].split('=')[1].split(',').includes('ScriptStreaming'));
  for (const f of real.split('=')[1].split(',')) assert.ok(merged[0].includes(f), f);
});

test('E2E: no CI, o SwiftShader sobe sem o estado dinâmico de entrada de vértices (todas as suítes)', () => {
  const off = '--disable-angle-features=supportsVertexInputDynamicState';
  assert.deepEqual(angleArgs({ CI: 'true' }), ['--use-angle=swiftshader', off]);
  // a variável volta ao padrão do Chromium, para comparar
  assert.deepEqual(angleArgs({ CI: 'true', E2E_VERTEX_INPUT_DYNAMIC: '1' }), ['--use-angle=swiftshader']);
  // fora do CI fica o Chrome do sistema com a GPU de verdade
  assert.deepEqual(angleArgs({}), []);
  // e é o browserOptions (suítes, capturas e medições) que leva a chave
  const ci = process.env.CI;
  const dyn = process.env.E2E_VERTEX_INPUT_DYNAMIC;
  process.env.CI = 'true';
  delete process.env.E2E_VERTEX_INPUT_DYNAMIC;
  try {
    const { args } = browserOptions();
    assert.equal(args.filter((a) => a === off).length, 1);
    assert.equal(args.filter((a) => a.startsWith('--disable-angle-features=')).length, 1);
    assert.ok(args.includes('--use-angle=swiftshader'));
  } finally {
    if (ci === undefined) delete process.env.CI; else process.env.CI = ci;
    if (dyn === undefined) delete process.env.E2E_VERTEX_INPUT_DYNAMIC; else process.env.E2E_VERTEX_INPUT_DYNAMIC = dyn;
  }
});

test('E2E: resumo das pilhas nativas do gdb agrupa threads iguais e marca a biblioteca', () => {
  const text = [
    'Thread 3 (Thread 0x7f12 (LWP 3622) "ThreadPoolForeg"):',
    '#0  0x00007f in ?? () from /lib/x86_64-linux-gnu/libc.so.6',
    '#1  0x00007f in pthread_cond_wait () from /lib/x86_64-linux-gnu/libc.so.6',
    '#2  0x00055 in v8::internal::CollectionBarrier::AwaitCollectionBackground(v8::internal::LocalHeap*) ()',
    'Thread 2 (Thread 0x7f13 (LWP 3623) "ThreadPoolForeg"):',
    '#0  0x00007f in ?? () from /lib/x86_64-linux-gnu/libc.so.6',
    '#1  0x00007f in pthread_cond_wait () from /lib/x86_64-linux-gnu/libc.so.6',
    '#2  0x00055 in v8::internal::CollectionBarrier::AwaitCollectionBackground(v8::internal::LocalHeap*) ()',
    'Thread 1 (Thread 0x7f14 (LWP 3600) "headless_shell"):',
    '#0  0x00007f in ?? () from /lib/x86_64-linux-gnu/libc.so.6',
    '#1  0x00007f in std::__Cr::condition_variable::wait(std::__Cr::unique_lock<std::__Cr::mutex>&) () from /x/libvk_swiftshader.so',
    '#2  0x00055 in ?? ()',
    '#3  0x00055 in ?? ()',
  ].join('\n');
  assert.deepEqual(summarizeStacks(text), [
    '2× ThreadPoolForeg: ??@libc.so.6 ← pthread_cond_wait ← v8::internal::CollectionBarrier::AwaitCollectionBackground',
    'headless_shell: ??@libc.so.6 ← std::__Cr::condition_variable::wait@libvk_swiftshader.so ← ??@headless_shell',
  ]);
});
