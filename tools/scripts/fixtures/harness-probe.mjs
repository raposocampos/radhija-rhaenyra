// Página mínima: prova a cadeia navegador → harness → processo da suíte → runner.
// Só executada pelo teste de infraestrutura no GitHub; não integra o jogo.
import { fileURLToPath } from 'node:url';
import { createHarness, parseArgs } from '../lib/harness.mjs';
import { runSuites } from '../lib/suite-runner.mjs';

const args = parseArgs();
const kind = args.case;
if (!['clean', 'console', 'exception', 'assertion'].includes(kind)) throw new Error('caso inválido');

if (args.runner) {
  process.exitCode = await runSuites([{
    id: kind, script: fileURLToPath(import.meta.url), args: ['--case', kind],
  }], 'about:blank', process.cwd());
} else {
  const H = await createHarness({ base: 'about:blank', outDir: 'shots/infra' });
  try {
    await H.page.setContent('<!doctype html><title>Prova do harness</title><p>Pronto</p>');
    H.check(await H.page.title() === 'Prova do harness', 'página mínima carregou');
    if (kind === 'console') {
      const captured = H.page.waitForEvent('console', { predicate: (message) => message.type() === 'error', timeout: 5000 });
      await H.page.evaluate(() => console.error('EST01_CONSOLE_INJETADO'));
      await captured;
    } else if (kind === 'exception') {
      const captured = H.page.waitForEvent('pageerror', { timeout: 5000 });
      await H.page.evaluate(() => { setTimeout(() => { throw new Error('EST01_EXCECAO_INJETADA'); }, 0); });
      await captured;
    } else if (kind === 'assertion') {
      H.check(false, 'EST01_ASSERCAO_INJETADA');
    }
  } finally {
    process.exitCode = (await H.close()) ? 1 : 0;
  }
}
