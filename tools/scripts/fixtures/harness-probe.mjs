// Página mínima: prova a cadeia navegador → harness → processo da suíte → runner.
// Só executada pelo teste de infraestrutura no GitHub; não integra o jogo.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHarness, parseArgs } from '../lib/harness.mjs';
import { runSuites } from '../lib/suite-runner.mjs';

const args = parseArgs();
const kind = args.case;
if (!['clean', 'console', 'exception', 'assertion', 'paced', 'stalled', 'slow', 'hung', 'stuck', 'mute', 'crash'].includes(kind)) throw new Error('caso inválido');

// Tetos de relógio curtos só nas provas de travamento (os padrões são de dezenas de segundos).
const LIMITS = {
  stalled: { stallMs: 2500, wallMinMs: 1000 }, // cada espera curta termina no próprio teto: o detector soma entre elas
  slow: { wallFactor: 2, wallMinMs: 1000 },
  hung: { evalMs: 2000, closeMs: 10000 },
  stuck: { opMaxMs: 3000 }, // a navegação tem 120 s de prazo; aqui o harness desiste antes, como se o prazo falhasse
  crash: { opMaxMs: 20000 }, // rede de segurança da própria prova: a queda da aba precisa encerrar bem antes
};

if (args.runner) {
  process.exitCode = await runSuites([{
    id: kind, script: fileURLToPath(import.meta.url), args: ['--case', kind],
  }], 'about:blank', process.cwd(), { silenceMs: kind === 'mute' ? 8000 : undefined });
} else {
  let base = 'about:blank';
  if (kind === 'stuck' || kind === 'crash') {
    // stuck: aceita a conexão e nunca responde (page.goto fica em curso); crash: página sem jogo (load() fica
    // esperando window.__game, como no boot que travou no CI)
    const server = createServer(kind === 'stuck' ? () => {} : (req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>Sem jogo</title><p>sem window.__game</p>');
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    server.unref();
    base = `http://127.0.0.1:${server.address().port}/`;
  }
  const H = await createHarness({ base, outDir: 'shots/infra', limits: LIMITS[kind] });
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
      // jogo parado com a página respondendo: 100 esperas de 200 ms levariam 100 s, uma por teto de relógio
      await fakeGame(0);
      for (let k = 0; k < 100; k++) await H.gsleep(200);
    } else if (kind === 'slow') {
      // jogo andando devagar demais: a espera termina no teto de relógio (2×) com aviso e a suíte segue, como sempre
      await fakeGame(0.05);
      const t0 = Date.now();
      await H.gsleep(1000);
      const waited = Date.now() - t0;
      H.check(waited >= 1900 && waited < 6000, 'jogo a 0,05×: a espera termina no teto de relógio e a suíte segue', `${waited} ms`);
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
    } else if (kind === 'stuck') {
      await H.load('?trava'); // o sinal do harness encerra o processo em opMaxMs
    } else if (kind === 'crash') {
      // derruba a aba (renderer) no meio da espera por window.__game
      setTimeout(() => {
        H.page.context().newCDPSession(H.page).then((cdp) => cdp.send('Page.crash')).catch(() => {});
      }, 1500);
      await H.load('?sem-jogo');
    } else if (kind === 'mute') {
      for (;;); // o próprio processo da suíte trava (event loop bloqueado): só o runner, de fora, pode encerrá-lo
    }
  } catch (e) {
    H.check(false, `exceção: ${e.message}`);
  } finally {
    process.exitCode = (await H.close()) ? 1 : 0;
  }
}
