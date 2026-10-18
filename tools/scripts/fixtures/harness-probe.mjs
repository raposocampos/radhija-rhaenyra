// Página mínima: prova a cadeia navegador → harness → processo da suíte → runner.
// Só executada pelo teste de infraestrutura no GitHub; não integra o jogo.
import { fileURLToPath } from 'node:url';
import { createHarness, parseArgs } from '../lib/harness.mjs';
import { runSuites } from '../lib/suite-runner.mjs';

const args = parseArgs();
const kind = args.case;
if (!['clean', 'console', 'exception', 'assertion', 'paced', 'stalled', 'slow', 'hung'].includes(kind)) throw new Error('caso inválido');

// Tetos de relógio curtos só nas provas de travamento (os padrões são de dezenas de segundos).
const LIMITS = {
  stalled: { stallMs: 1500, wallMinMs: 60000 }, // teto de 16 min na espera: só o detector de jogo parado encerra
  slow: { wallFactor: 2, wallMinMs: 1000, stallMs: 60000 },
  hung: { evalMs: 2000, closeMs: 10000 },
};

if (args.runner) {
  process.exitCode = await runSuites([{
    id: kind, script: fileURLToPath(import.meta.url), args: ['--case', kind],
  }], 'about:blank', process.cwd());
} else {
  const H = await createHarness({ base: 'about:blank', outDir: 'shots/infra', limits: LIMITS[kind] });
  /** Jogo de mentira: debug.info() com o simSec andando `rate`× o relógio (0 = parado). */
  const fakeGame = (rate) => H.page.evaluate((r) => {
    const t0 = performance.now();
    const info = () => {
      const sim = (r * (performance.now() - t0)) / 1000;
      return { state: 'playing', levelId: 'prova', stage: null, timeSec: +sim.toFixed(2), simSec: +sim.toFixed(3), activeDog: 'radhija', dogs: { radhija: { x: 0, z: 0 } } };
    };
    // defineProperty: no CI o harness intercepta a atribuição de window.__game (redução gráfica do jogo de verdade)
    Object.defineProperty(window, '__game', { configurable: true, writable: true, value: { game: { state: 'playing', debug: { info } } } });
  }, rate);
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
    } else if (kind === 'paced') {
      // jogo devagar, mas andando: o prazo continua em tempo de JOGO (1 s de jogo a 0,4× ≈ 2,5 s de relógio)
      await fakeGame(0.4);
      const t0 = Date.now();
      const start = await H.info();
      const end = await H.waitFor(() => false, { timeout: 1000 });
      const waited = Date.now() - t0;
      const played = end.simSec - start.simSec;
      H.check(waited >= 2300 && waited < 9000 && played >= 1, 'jogo a 0,4×: waitFor espera 1 s de jogo, sem teto de relógio', `${waited} ms de relógio, ${played.toFixed(2)} s de jogo`);
    } else if (kind === 'stalled') {
      await fakeGame(0);
      await H.waitFor(() => false, { timeout: 120000 });
    } else if (kind === 'slow') {
      await fakeGame(0.05); // 1 s de jogo levaria 20 s; o teto (2×) vence em 2 s
      await H.gsleep(1000);
    } else if (kind === 'hung') {
      await fakeGame(1);
      await H.info();
      await H.page.evaluate(() => { setTimeout(() => { for (;;); }, 0); }); // responde e então trava a página
      try {
        await H.info();
      } finally {
        const t0 = Date.now();
        const again = await H.ev(() => 1).then(() => 'respondeu', (e) => e.message);
        H.check(again.includes('já estava travada') && Date.now() - t0 < 1000, 'com a página travada, a ida seguinte ao navegador falha na hora', again);
      }
    }
  } catch (e) {
    H.check(false, `exceção: ${e.message}`);
  } finally {
    process.exitCode = (await H.close()) ? 1 : 0;
  }
}
