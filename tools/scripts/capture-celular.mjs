// Capturas de revisão do celular e do PC, cada aparelho com a SUA qualidade gráfica (sem a redução do harness):
// celular deitado (844×390, DPR 3, perfil médio), celular pequeno (667×375, DPR 2), tablet (1180×820, DPR 2) e PC
// (1280×720, perfil alta, como sempre). Tela inicial, partida com os controles de toque, prompt e dica com ícones de
// toque, pausa com o menu de qualidade, vitória, cartão de abertura, aviso de girar o celular e a fase 4.
// Roda no GitHub Actions (E2E manual, suíte toque), depois da partida. O laço do jogo fica congelado e o script
// avança quadro a quadro e desenha só na hora da captura (SwiftShader é lento). Saída: shots/celular-revisao/*.png.
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/celular-revisao';
mkdirSync(OUT, { recursive: true });

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const touchDevice = (w, h, dpr) => ({ viewport: { width: w, height: h }, screen: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, userAgent: MOBILE_UA });
const DEVICES = [
  // celular: perfil médio fixo (o automático começa nele; o governador mudaria no SwiftShader lento)
  { id: 'celular', opts: touchDevice(844, 390, 3), touch: true, quality: 'media', full: true },
  { id: 'celular-pequeno', opts: touchDevice(667, 375, 2), touch: true, quality: 'media' },
  { id: 'tablet', opts: touchDevice(1180, 820, 2), touch: true, quality: 'media' },
  { id: 'pc', opts: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, touch: false, quality: null, full: true },
];

let server, browser;
const errors = [];
let shots = 0;
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(browserOptions());

  for (const dev of DEVICES) {
    console.log(`\n== ${dev.id} ==`);
    const page = await browser.newPage(dev.opts);
    page.setDefaultTimeout(180000);
    page.on('pageerror', (e) => errors.push(`[${dev.id}] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${dev.id}] ${m.text()}`); });
    await page.addInitScript((q) => {
      if (q) localStorage.setItem('rr-quality', q);
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
    }, dev.quality);

    /** Abre a página, espera o estado e congela o laço; o script avança e desenha. */
    const open = async (query, state) => {
      await page.goto(`${url}${query}`);
      await page.waitForFunction((s) => window.__game?.game?.state === s, state, { timeout: 180000 });
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        window.__freezeReview = true;
        document.getElementById('loading')?.remove();
        const G = window.__game;
        const rev = { t: 30 };
        window.__step = (n = 1) => {
          for (let i = 0; i < n; i++) {
            rev.t += 1 / 60;
            G.game.update(1 / 60, rev.t);
            G.seeThrough();
            G.feedback.update(1 / 60, rev.t);
            G.particles.update(1 / 60);
            G.ui.update(1 / 60);
          }
        };
        window.__stepUntil = (src, max = 900) => {
          const fn = new Function(`return (${src})`)();
          for (let i = 0; i < max; i++) {
            window.__step(1);
            if (fn(G.game.debug.info())) return true;
          }
          return false;
        };
        window.__render = () => {
          G.engine.render(1 / 60, rev.t);
          G.engine.renderer.getContext().finish();
        };
      });
    };
    const step = (n) => page.evaluate((k) => window.__step(k), n);
    const until = async (pred, max = 900) => {
      const ok = await page.evaluate(({ src, m }) => window.__stepUntil(src, m), { src: pred.toString(), m: max });
      if (!ok) errors.push(`[${dev.id}] condição não alcançada: ${pred}`);
    };
    const shot = async (name, wait = 700) => {
      await page.waitForTimeout(wait); // transições de CSS (tempo real)
      await page.evaluate(() => window.__render());
      await page.screenshot({ path: `${OUT}/${dev.id}-${name}.png`, timeout: 120000 });
      shots++;
      console.log(`  captura: ${OUT}/${dev.id}-${name}.png`);
    };
    const center = (sel) => page.evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, sel);
    /** Toque (celular) ou Enter/clique (PC) num botão do menu. */
    const press = async (sel) => {
      if (dev.touch) {
        const c = await center(sel);
        await page.touchscreen.tap(c.x, c.y);
      } else {
        await page.click(sel);
      }
    };
    /** Um botão de ação do jogo, pelo dispositivo do aparelho. */
    const action = async (touchId, key) => {
      if (dev.touch) await page.evaluate((id) => { const t = window.__game.game.input.touch; t.press(id); window.__step(1); t.release(id); }, touchId);
      else { await page.keyboard.press(key); await step(1); }
    };

    await open('', 'title');
    await step(20);
    await shot('01-titulo');

    await press('.rr-btn--play');
    await step(150);
    await shot('02-jogando');

    // prompt da cordinha (Agir pulsando) e uma dica com o ícone do dispositivo
    await page.evaluate(() => {
      const g = window.__game.game;
      g.debug.setStage('east', 'radhija');
      g.debug.teleport('radhija', 1.5, 0.9);
    });
    await until((i) => i.prompt === 'Puxar a cordinha');
    await step(30);
    await action('jump', 'Space');
    await step(20);
    await shot('03-prompt-e-dica');

    await page.evaluate(() => window.__game.events.emit('ui:pause', {}));
    await step(2);
    await shot('04-pausa');
    await page.evaluate(() => window.__game.events.emit('ui:resume', {}));
    await step(2);

    if (dev.full) {
      // vitória: a Rhaenyra leva a cenoura até a porta
      await page.evaluate(() => {
        const g = window.__game.game;
        const z = window.__game.layout.DOOR.zone;
        g.debug.setStage('carrying', 'rhaenyra');
        g.debug.teleport('rhaenyra', z.x, z.z);
      });
      await until((i) => i.state === 'victory', 1800);
      await step(60);
      await shot('05-vitoria', 2200);

      // cartão de abertura (menu → fase 1)
      await page.evaluate(() => window.__game.events.emit('ui:menu', {}));
      await step(5);
      // o carregamento espera um quadro (nextPaint): descongela só durante a troca (o laço principal já parou)
      await page.evaluate(() => {
        window.__freezeReview = false;
        window.__game.events.emit('ui:selectLevel', { index: 0 });
      });
      await page.waitForFunction(() => window.__game.game.state === 'intro', null, { timeout: 120000 });
      await page.evaluate(() => { window.__freezeReview = true; });
      await step(60);
      await shot('06-abertura', 2500);
    }

    if (dev.id === 'celular') {
      await page.setViewportSize({ width: 390, height: 844 });
      await step(2);
      await shot('07-de-pe', 900);
      await page.setViewportSize({ width: 844, height: 390 });
      await open('?level=4&play', 'playing');
      // um toque na tela (como a jogadora faria) liga os controles
      await page.touchscreen.tap(422, 120);
      await step(150);
      await shot('08-fase4');
    }
    await page.close();
  }
} catch (err) {
  errors.push(err.stack || err.message);
} finally {
  await browser?.close();
  await server?.close();
}
console.log(`\n${shots} capturas em ${OUT}`);
if (errors.length) {
  console.log(`ERROS (${errors.length}):`);
  for (const e of errors.slice(0, 20)) console.log(e);
  process.exit(1);
}
