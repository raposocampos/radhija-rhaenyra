// Capturas na nuvem: mesmo enquadramento/iluminação/tempo para base e head.
// Não usa a redução de qualidade visual do harness de partidas.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const head = git('rev-parse', 'HEAD');
const base = git('merge-base', 'HEAD', 'origin/main');
const baselinePath = 'src/world/.pigeon-baseline.js';
// wx evita sobrescrever qualquer arquivo que não pertença a esta execução.
writeFileSync(baselinePath, git('show', `${base}:src/world/pigeon.js`), { flag: 'wx' });
mkdirSync('shots/pombos', { recursive: true });
let server, browser;
const errors = [];
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(browserOptions());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1272 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${url}tools/pigeon-review.html`);
  await page.waitForFunction(() => !!window.reviewPigeons, null, { timeout: 120000 });
  await page.evaluate(() => window.reviewPigeons());
  await page.screenshot({ path: 'shots/pombos/01-silhuetas.png', fullPage: true });
  const stats = await page.evaluate(() => window.reviewPigeons(true));
  await page.screenshot({ path: 'shots/pombos/02-animacoes.png', fullPage: true });
  // Limite explícito: não dobrar triângulos, nem aumentar os meshes do personagem.
  const old = stats.find((s) => s.label === 'Antes');
  const next = stats.find((s) => s.label === 'Depois');
  if (next.meshes > old.meshes || next.triangles > old.triangles * 2) throw new Error('Orçamento geométrico excedido.');

  // Cena real: congela apenas depois do boot; desenha com sombras e pós-processamento normais.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });
  await page.goto(`${url}?level=4&play`);
  await page.waitForFunction(() => !!window.__game?.game, null, { timeout: 120000 });
  await page.evaluate(() => { window.__freezeReview = true; });
  await page.evaluate(() => {
    const g = window.__game;
    document.getElementById('loading')?.remove();
    for (let i = 1; i <= 120; i++) g.game.update(1 / 60, i / 60);
    g.engine.render(0, 2);
  });
  await page.screenshot({ path: 'shots/pombos/03-fase4.png' });
  await page.evaluate(() => {
    const g = window.__game, p = g.layout.NAP_PIGEON;
    g.engine.camera.position.set(p.x + 0.7, 0.6, p.z + 0.9);
    g.engine.camera.lookAt(p.x, 0.16, p.z);
    g.engine.render(0, 2);
  });
  await page.screenshot({ path: 'shots/pombos/04-cochilo-no-cenario.png' });
  writeFileSync('shots/pombos/metrics.json', JSON.stringify({ base, head, stats, errors }, null, 2));
  console.log(JSON.stringify({ base, head, before: old, after: next, errors }, null, 2));
  if (errors.length) throw new Error('Erros no navegador durante a revisão visual.');
} finally {
  await browser?.close();
  await server?.close();
  unlinkSync(baselinePath);
}
