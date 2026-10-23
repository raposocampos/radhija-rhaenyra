// Grava as cenas do trailer. Uso (na raiz do repositório, no GitHub Actions):
//   node video/capture/record.mjs <grupo|cena>[,<grupo|cena>...] [--so-horizontal]
// Saída: shots/trailer/clips/<cena>.mp4 (1920×1080) e <cena>-v.mp4 (1080×1920, quando a cena tem `vertical`), cada
// um com o <cena>.json (sons do jogo, marcas e avisos). Usa o servidor Vite sem HMR dos scripts de captura.
import '../../tools/scripts/lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from '../../tools/scripts/lib/browser.mjs';
import { closeBrowser, openPage } from '../../tools/scripts/lib/page-guard.mjs';
import { Recorder } from './recorder.mjs';
import { glArgs } from './gl.mjs';
import { GROUPS, SHOTS } from './shots.mjs';

if (!process.env.CI) throw new Error('A gravação das cenas roda no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/trailer/clips';
mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const onlyH = args.includes('--so-horizontal');
// cada item: um grupo, uma cena, ou "cena@h" / "cena@v" (só a versão 16:9 ou só a 9:16; o @ vale no nome do artefato)
const wanted = (args.find((a) => !a.startsWith('--')) || '').split(/[,+]/).filter(Boolean);
const only = {};
const ids = [...new Set(wanted.flatMap((w) => {
  const [name, v] = w.split('@');
  if (v) only[name] = v;
  return GROUPS[name] || [name];
}))];
for (const id of ids) if (!SHOTS[id]) throw new Error(`cena desconhecida: ${id}`);
if (!ids.length) throw new Error(`nenhuma cena; grupos: ${Object.keys(GROUPS).join(', ')}`);
const DPR = Number(process.env.TRAILER_DPR || 1);

let server;
let browser;
const report = [];
let failed = 0;
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(glArgs(browserOptions()));
  for (const id of ids) {
    const shot = SHOTS[id];
    let variants = [{ v: 'h', w: 1920, h: 1080 }];
    if (shot.vertical && !onlyH) variants.push({ v: 'v', w: 1080, h: 1920 });
    if (only[id]) variants = variants.filter((x) => x.v === only[id]);
    for (const { v, w, h } of variants) {
      const t0 = Date.now();
      const errors = [];
      const { page, guard } = await openPage(browser, { viewport: { width: w, height: h }, deviceScaleFactor: DPR }, { name: `${id}/${v}` });
      page.setDefaultTimeout(180000);
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.addInitScript(() => {
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
      });
      const r = new Recorder(page, guard, { id, out: OUT, variant: v });
      try {
        console.log(`\n== ${id} (${v === 'h' ? '16:9' : '9:16'}) fase ${shot.level}`);
        const L = await r.open(`${url}?level=${shot.level}&play${shot.query || ''}`);
        await shot.run(r, L);
        if (!r.frames) throw new Error('a cena não gravou nenhum quadro');
        const json = await r.finish({ level: shot.level, errors, wallSec: Math.round((Date.now() - t0) / 1000) });
        report.push({ id, v, frames: json.frames, msPerFrame: json.msPerFrame, warnings: json.warnings.length, errors: errors.length });
      } catch (error) {
        failed++;
        console.error(`  FALHOU ${id}/${v}: ${error.stack || error}`);
        try { await r.finish({ level: shot.level, errors: [...errors, String(error)], failed: true }); } catch {}
        report.push({ id, v, failed: String(error.message || error) });
      } finally {
        await page.close().catch(() => {});
      }
    }
  }
} catch (error) {
  failed++;
  console.error(error.stack || error);
} finally {
  writeFileSync(`${OUT}/relatorio-${process.pid}.json`, JSON.stringify(report, null, 2));
  await closeBrowser(browser);
  await server?.close();
}
console.log(`\n${JSON.stringify(report)}`);
if (failed) process.exitCode = 1;
