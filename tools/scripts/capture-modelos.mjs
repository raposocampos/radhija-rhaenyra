// Capturas de revisão da troca dos modelos das cachorrinhas (etapa 1), em qualidade visual completa: o modelo atual e
// o novo lado a lado no sandbox (sandbox/dogs.html?model=both) em várias vistas e em cada pose, uma tira do trote
// quadro a quadro, e o jogo com o modelo novo (Canil das Dogs e fases com ?dogs=novo).
// Roda no GitHub Actions (E2E manual, suíte canil), depois da partida. Saída: shots/modelos/*.png.
import './lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium em shots/diagnostico/
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/modelos';
mkdirSync(OUT, { recursive: true });
let server, browser;
const errors = [];
let shots = 0;
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(browserOptions());

  // ---------------------------------------------------------------- sandbox: atual × novo (2 × 2)
  {
    const { page, guard } = await openPage(browser, { viewport: { width: 1280, height: 960 } }, { name: 'sandbox' });
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => errors.push(`[sandbox] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[sandbox] ${m.text()}`); });
    await page.goto(`${url}sandbox/dogs.html?model=both&dog=both&sim=1`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
    const stats = await page.evaluate(() => window.__dogs.stats);
    console.log(`  modelos: ${JSON.stringify(stats)}`);
    const pose = async (name, cfg) => {
      guard.note(`pose ${name}`);
      const res = await page.evaluate((c) => window.__pose(c), cfg);
      await page.screenshot({ path: `${OUT}/${name}.png` });
      shots++;
      console.log(`  captura: ${OUT}/${name}.png  ${JSON.stringify(res.map((r) => `${r.kind}/${r.model}: chão ${r.lowest === null ? '-' : r.lowest.toFixed(3)}${r.tilt ? ` girou ${(r.tilt * 180 / Math.PI).toFixed(1)}°` : ''}${r.lift ? ` subiu ${(r.lift * 1000).toFixed(0)} mm` : ''}${r.tilt || r.lift ? ` (${r.bone})` : ''}`))}`);
    };
    for (const view of ['34', 'side', 'front', 'back', 'top', 'face', 'ear', 'hero']) await pose(`01-repouso-${view}`, { view, sim: 1.5 });
    const side = (extra) => ({ view: 'side', sim: 1.6, ...extra });
    await pose('02-passo', side({ speed: 0.7 }));
    await pose('03-trote', side({ speed: 1.9, sim: 1.3 }));
    await pose('04-galope', side({ speed: 5.5, action: 'dash', sim: 1.0 }));
    await pose('05-sentada', side({ action: 'sit', sim: 3 }));
    await pose('05-sentada-34', { view: '34', action: 'sit', sim: 3 });
    await pose('06-deitada', side({ extra: 'roll', xk: 0.145, sim: 2 }));
    await pose('06-deitada-34', { view: '34', extra: 'roll', xk: 0.145, sim: 2 });
    await pose('07-de-costas', { view: '34', extra: 'roll', xk: 0.5, sim: 2 });
    await pose('08-farejando', side({ action: 'sniff', speed: 0.25 }));
    await pose('09-comemorando', { view: '34', action: 'celebrate', sim: 1.5 });
    await pose('10-chacoalhando', { view: 'front', action: 'shake', sim: 0.45 });
    await pose('11-empurrando', side({ action: 'push', speed: 0.6 }));
    await pose('12-puxando', side({ action: 'tug' }));
    await pose('13-pulo', side({ airk: 0.5, jumph: 0.5, sim: 1 }));
    await pose('14-parede', side({ wallk: 0.52, sim: 1 }));
    await pose('15-lambendo', side({ action: 'lick', lick: '1', sim: 1.13 }));
    await pose('16-carregando', { view: '34', carry: 'ball', speed: 0.9, sim: 1.5 });
    await pose('17-bebendo', side({ extra: 'drink', xk: 0.5 }));
    await pose('18-cavando', side({ extra: 'dig', xk: 0.5 }));
    await pose('19-agachada', side({ poop: 0.35, sim: 2 }));
    await pose('20-escorregando', side({ action: 'slide' }));
    await pose('21-latindo', { view: 'face', bark: 1.85, sim: 1.95 });
    await pose('22-molhada', { view: '34', wet: 1, sim: 1 });
    // tira do trote, quadro a quadro (fluidez do passo)
    for (let k = 0; k < 8; k++) await pose(`30-trote-${k}`, side({ speed: 1.9, sim: 1.2 + k * 0.05 }));
    await page.close();
  }

  // ---------------------------------------------------------------- jogo: o Canil e as fases com o modelo novo
  {
    const { page, guard } = await openPage(browser, { viewport: { width: 1280, height: 720 } }, { name: 'jogo' });
    page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => errors.push(`[jogo] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[jogo] ${m.text()}`); });
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
    });
    const game = async (name, query, frames = 120, setup = null) => {
      guard.note(`abrir ${query}`);
      await page.evaluate(() => { window.__freezeReview = false; }).catch(() => {});
      await page.goto(`${url}${query}`);
      await page.waitForFunction(() => window.__game?.game?.state === 'playing', null, { timeout: 120000 });
      await page.evaluate(({ n, src }) => {
        window.__freezeReview = true;
        document.getElementById('loading')?.remove();
        const G = window.__game;
        if (src) new Function('G', src)(G);
        for (let i = 1; i <= n; i++) G.game.update(1 / 60, 10 + i / 60);
        G.engine.render(1 / 60, 10 + n / 60);
        G.engine.renderer.getContext().finish();
      }, { n: frames, src: setup });
      await page.screenshot({ path: `${OUT}/${name}.png` });
      shots++;
      console.log(`  captura: ${OUT}/${name}.png`);
    };
    await game('40-canil', '?level=canil&play', 150);
    await game('41-canil-trote-de-lado', '?level=canil&play', 120, 'G.game.puzzle.setPose("trote"); G.game.puzzle.setView("lado");');
    await game('42-canil-radhijas-sentadas', '?level=canil&play', 180, 'G.game.puzzle.setPose("sentada"); G.game.puzzle.setView("tres-quartos"); G.game.puzzle.setCamera("radhija");');
    await game('43-canil-rhaenyras-de-lado', '?level=canil&play', 150, 'G.game.puzzle.setView("lado"); G.game.puzzle.setCamera("rhaenyra");');
    await game('44-canil-rhaenyras-frente', '?level=canil&play', 150, 'G.game.puzzle.setView("frente"); G.game.puzzle.setCamera("rhaenyra");');
    await game('50-fase1-modelo-novo', '?level=1&play&dogs=novo', 120);
    await game('51-fase5-modelo-novo', '?level=5&play&dogs=novo', 120);
    await game('52-fase7-modelo-novo', '?level=7&play&dogs=novo', 120);
    await game('53-fase9-modelo-novo', '?level=9&play&dogs=novo', 120);
  }

  if (errors.length) throw new Error(`erros no navegador:\n${errors.join('\n')}`);
  console.log(`\n${shots} capturas de revisão; sem erros de console`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await closeBrowser(browser);
  await server?.close();
}
