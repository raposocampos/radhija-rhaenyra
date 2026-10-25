// Capturas de revisão do mapa das fases (Pandorópolis), cada aparelho com a SUA qualidade gráfica (sem a redução do
// harness): PC (1280×720, perfil alta), iPhone 13 (844×390, DPR 3, perfil médio), Infinix Note 30 5G (893×393, DPR
// 2,75, perfil baixo) e o Android compacto (640×360, DPR 2). Em cada um: a chegada na bandeirinha 1 com a plaquinha e a
// barrinha, um passeio pelo condomínio e, com o save adiantado, o centro aberto (a Av. Pandora, o outdoor da Amora e o
// chafariz), a pracinha, a brinquedoteca com o trenzinho e a chácara do outro lado da ponte. No PC, também vistas
// altas da cidade inteira (câmera livre) e as nuvens abrindo.
// Roda no GitHub Actions (E2E manual, suíte mapa), depois da partida. O laço do jogo fica congelado e o script avança
// quadro a quadro e desenha só na hora da captura (SwiftShader é lento). Saída: shots/mapa-revisao/*.png.
import './lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium em shots/diagnostico/
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';
import { touchDevice, IPHONE_UA } from './lib/screens.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/mapa-revisao';
mkdirSync(OUT, { recursive: true });
const DEVICES = [
  { id: 'pc', opts: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, touch: false, quality: null, full: true },
  { id: 'iphone13', opts: touchDevice(844, 390, 3, IPHONE_UA), touch: true, quality: 'media' },
  { id: 'infinix', opts: touchDevice(893, 393, 2.75), touch: true, quality: 'baixa' },
  { id: 'android-640x360', opts: touchDevice(640, 360, 2), touch: true, quality: 'media' },
];
const DONE = { done: true, best: 75, treats: 2, total: 3, clears: 1 };
const SAVE_ALL = JSON.stringify({ v: 1, levels: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`fase${i + 1}`, i % 3 === 1 ? { ...DONE, treats: 3 } : DONE])) });

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
    try { await captureDevice(dev, url); } catch (err) { errors.push(`[${dev.id}] ${err.stack || err.message}`); }
  }
} catch (err) {
  errors.push(err.stack || err.message);
} finally {
  await closeBrowser(browser);
  await server?.close();
}
console.log(`\n${shots} capturas em ${OUT}`);
if (errors.length) {
  console.log(`ERROS (${errors.length}):`);
  for (const e of errors.slice(0, 20)) console.log(e);
  process.exit(1);
}

async function captureDevice(dev, url) {
  const { page, guard } = await openPage(browser, dev.opts, { name: dev.id });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(`[${dev.id}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${dev.id}] ${m.text()}`); });
  await page.addInitScript((q) => {
    if (q) localStorage.setItem('rr-quality', q);
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  }, dev.quality);

  const open = async (save) => {
    guard.note(`abrir o mapa (${save ? 'save adiantado' : 'save novo'})`);
    // uma página da mesma origem, sem o jogo (o save vai antes do boot)
    await page.goto(`${url}src/core/version.js`);
    await page.evaluate((s) => { if (s) localStorage.setItem('rr-progress-v1', s); else localStorage.removeItem('rr-progress-v1'); }, save);
    await page.goto(`${url}?mapa`);
    await page.waitForFunction(() => window.__game?.game?.isHub && window.__game.game.state === 'playing', null, { timeout: 180000 });
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
      window.__render = (cam) => {
        if (cam) {
          G.engine.camera.position.set(...cam.pos);
          G.engine.camera.lookAt(...cam.look);
          G.engine.camera.updateMatrixWorld();
          G.engine.focusShadow?.(cam.look[0], cam.look[2], { half: 40, top: 12 });
        }
        G.engine.render(1 / 60, rev.t);
        G.engine.renderer.getContext().finish();
      };
    });
  };
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  const shot = async (name, { cam = null, hideUi = false, wait = 600 } = {}) => {
    await page.waitForTimeout(wait);
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${dev.id}-${name}.png`, timeout: 120000, style: hideUi ? '#ui, #loading { display: none !important; }' : undefined });
    shots++;
    guard.note(`captura ${dev.id}-${name}`);
    console.log(`  captura: ${OUT}/${dev.id}-${name}.png`);
  };
  const travel = (n) => page.evaluate((k) => { window.__game.game.debug.travel({ n: k }); window.__step(1); }, n);
  /** Anda com a dog ativa até (x, z) (teclado falso, quadro a quadro). */
  const walk = (x, z, max = 900) => page.evaluate(({ x: tx, z: tz, max: m }) => {
    const g = window.__game.game;
    const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
    for (let i = 0; i < m; i++) {
      const c = g.debug.ctrls[g.activeDog];
      const dx = tx - c.x, dz = tz - c.z;
      if (Math.hypot(dx, dz) < 0.4) break;
      const B = g.debug.cam.basis();
      const fwd = dx * B.fx + dz * B.fz, rgt = dx * B.rx + dz * B.rz;
      const s = ((Math.round(Math.atan2(rgt, fwd) / (Math.PI / 4)) % 8) + 8) % 8;
      const want = [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyW', 'KeyA']][s];
      for (const k of keys) key(k, want.includes(k));
      window.__step(1);
    }
    for (const k of keys) key(k, false);
    window.__step(20);
  }, { x, z, max });

  // save novo: a chegada na fase 1 (a plaquinha, a fase carregando por baixo), um passeio
  await open(null);
  if (dev.touch) await page.touchscreen.tap(dev.opts.viewport.width / 2, 40);
  await step(90);
  await shot('01-chegada-fase1');
  await walk(-29.4, 25.2);
  await walk(-29.4, 14);
  await shot('02-rua-do-condominio');
  await walk(-29.4, 4);
  await shot('03-area-de-servico');

  // save adiantado (fases 1–9): o leste e a chácara abertos
  await open(SAVE_ALL);
  if (dev.touch) await page.touchscreen.tap(dev.opts.viewport.width / 2, 40);
  await step(60);
  await shot('04-chacara-fase10');
  for (const [n, name] of [[9, '05-casa-do-vovo'], [7, '06-pracinha'], [6, '07-brinquedoteca-trenzinho'], [4, '08-torre'], [3, '09-lago'], [5, '10-casa-das-dogs']]) {
    await travel(n);
    await step(90);
    await shot(name);
  }
  await travel(7);
  await walk(3, 2);
  await walk(13.2, 0);
  await walk(13.2, 4);
  await step(30);
  await shot('11-avenida-pandora');
  await walk(18.4, 8.4);
  await step(30);
  await shot('12-outdoor-amora-chafariz');

  if (dev.full) {
    // vistas altas (câmera livre, sem a interface): a cidade inteira e cada bairro
    for (const [name, cam] of [
      ['20-vista-cidade-inteira', { pos: [40, 70, 75], look: [-6, 0, 0] }],
      ['21-vista-condominio', { pos: [-4, 34, 36], look: [-24, 0, 2] }],
      ['22-vista-centro', { pos: [32, 22, 22], look: [16, 0, -2] }],
      ['23-vista-chacara', { pos: [56, 24, 26], look: [41, 0, 0] }],
      ['24-vista-outdoor', { pos: [26, 6, 12], look: [18.4, 3.6, 5.4] }],
    ]) await shot(name, { cam, hideUi: true });
    // save novo de novo: as nuvens fechadas, vistas de cima
    await open(null);
    await step(30);
    await shot('25-vista-nuvens-fechadas', { cam: { pos: [40, 70, 75], look: [-6, 0, 0] }, hideUi: true });
  }
  await page.close();
}
