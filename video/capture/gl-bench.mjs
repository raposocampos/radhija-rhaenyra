// Bancada: quanto custa um quadro do jogo em 1080p com cada renderizador por software do runner (o padrão dos testes,
// SwiftShader, e os do Mesa: llvmpipe pelo OpenGL e lavapipe pelo Vulkan). Grava 1 quadro de cada para comparar.
//   TRAILER_GL=swiftshader|gl|vulkan node video/capture/gl-bench.mjs
import '../../tools/scripts/lib/browser-log.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from '../../tools/scripts/lib/browser.mjs';
import { installRecorder } from './page-helpers.js';
import { glArgs } from './gl.mjs';

if (!process.env.CI) throw new Error('Roda no GitHub Actions.');
const mode = process.env.TRAILER_GL || 'swiftshader';
const OUT = 'shots/trailer/bancada';
mkdirSync(OUT, { recursive: true });
const server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls.local[0];
const opts = glArgs(browserOptions(), mode);
console.log(`modo ${mode}: ${opts.args.join(' ')}`);
const browser = await chromium.launch(opts);
const result = { mode, levels: [] };
try {
  for (const level of ['fase10', 'fase7', '4']) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.setDefaultTimeout(180000);
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
    });
    const t0 = Date.now();
    await page.goto(`${url}?level=${level}&play`);
    await page.waitForFunction(() => window.__game?.game?.state === 'playing', null, { timeout: 180000 });
    const bootMs = Date.now() - t0;
    await page.evaluate(installRecorder);
    const gpu = await page.evaluate(() => {
      const gl = window.__game.engine.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    await page.evaluate(() => window.__step(120));
    // a câmera do jogo e um close nas dogs (pelo nas cascas ocupando a tela)
    const times = [];
    for (let k = 0; k < 8; k++) {
      if (k === 4) {
        await page.evaluate(() => window.__setCam(((t, H) => {
          const d = H.dog(H.G.game.activeDog);
          return { pos: [d.x + 0.7, 0.45, d.z + 0.6], look: [d.x, 0.25, d.z] };
        }).toString()));
      }
      const s = Date.now();
      const r = await page.evaluate((i) => window.__frame(i, 30, 0.92), k);
      times.push(Date.now() - s);
      if (k === 3 || k === 7) writeFileSync(`${OUT}/${mode}-${level}-${k}.jpg`, Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64'));
    }
    result.levels.push({ level, gpu, bootMs, frameMs: times });
    console.log(`  ${level}: ${gpu}; boot ${bootMs} ms; quadros ${times.join(', ')} ms`);
    await page.close();
  }
} finally {
  writeFileSync(`${OUT}/${mode}.json`, JSON.stringify(result, null, 2));
  await browser.close();
  await server.close();
}
