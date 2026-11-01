// Capturas de revisão do Modo História (capítulo 1, Cadê a Cenoura?), cada aparelho com a SUA qualidade gráfica (sem a
// redução do harness): PC (1280×720, perfil alta), iPhone 13 (844×390, DPR 3, perfil médio) e Infinix Note 30 5G
// (893×393, DPR 2,75, perfil baixo, sem pós-processamento: o Faro sem pós). Em cada um, os momentos da fatia: a abertura
// (o quarto à noite com a garoa, os pombos no parapeito, a mão da tutora, o primeiro pulso do Faro, a cartela) e a
// missão em cada etapa (cozinha, galho, piscina com a Reconstrução, varal, torre e terraço, guarita, portãozinho), o
// mural e o fim do capítulo. No PC, também vistas altas do condomínio inteiro (câmera livre).
// Roda no GitHub Actions (E2E manual, suíte historia), depois da partida. O laço do jogo fica congelado e o script avança
// quadro a quadro e desenha só na hora da captura (SwiftShader é lento). Saída: shots/historia-revisao/*.png.
import './lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium em shots/diagnostico/
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';
import { touchDevice, IPHONE_UA } from './lib/screens.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/historia-revisao';
mkdirSync(OUT, { recursive: true });
const DEVICES = [
  { id: 'pc', opts: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, touch: false, quality: null, full: true },
  { id: 'iphone13', opts: touchDevice(844, 390, 3, IPHONE_UA), touch: true, quality: 'media' },
  { id: 'infinix', opts: touchDevice(893, 393, 2.75), touch: true, quality: 'baixa' },
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

  /** Abre a área da história (na etapa `stage`, ou na abertura) e congela o laço: o script avança os quadros. */
  const open = async (stage = null) => {
    guard.note(`abrir a história (${stage || 'abertura'})`);
    await page.goto(`${url}?historia${stage ? `&stage=${stage}` : ''}`);
    await page.waitForFunction(() => window.__game?.game?.isStory && window.__game.game.state === 'playing', null, { timeout: 180000 });
    await page.evaluate(() => {
      window.__freezeReview = true;
      document.getElementById('loading')?.remove();
      const G = window.__game;
      const rev = { t: 10 };
      window.__step = (n = 1) => {
        for (let i = 0; i < n; i++) {
          rev.t += 1 / 60;
          G.game.update(1 / 60, rev.t);
          G.seeThrough();
          G.feedback.update(1 / 60, rev.t);
          G.particles.update(1 / 60);
          G.ui.update(1 / 60);
          G.storyHud?.update(1 / 60);
        }
      };
      window.__render = (cam) => {
        if (cam) {
          G.engine.camera.position.set(...cam.pos);
          G.engine.camera.lookAt(...cam.look);
          G.engine.camera.updateMatrixWorld();
          G.engine.focusShadow?.(cam.look[0], cam.look[2], { half: 16, top: 12 });
        }
        G.engine.render(1 / 60, rev.t);
        G.engine.renderer.getContext().finish();
      };
      /** Avança até `pred(info)` (no máximo n quadros). */
      window.__until = (src, n = 3000) => {
        const fn = new Function('i', `return (${src})(i)`);
        for (let k = 0; k < n; k++) {
          if (fn(G.game.debug.info())) return k;
          window.__step(1);
        }
        return -1;
      };
    });
    if (dev.touch) await page.touchscreen.tap(dev.opts.viewport.width / 2, 40);
  };
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  const until = (pred, n = 3000) => page.evaluate(({ src, n: m }) => window.__until(src, m), { src: pred.toString(), n });
  const shot = async (name, { cam = null, hideUi = false, wait = 400 } = {}) => {
    await page.waitForTimeout(wait);
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${dev.id}-${name}.png`, timeout: 120000, style: hideUi ? '#ui, #loading { display: none !important; }' : undefined });
    shots++;
    guard.note(`captura ${dev.id}-${name}`);
    console.log(`  captura: ${OUT}/${dev.id}-${name}.png`);
  };
  const key = (code, down) => page.evaluate(({ c, d }) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, key: c })), { c: code, d: down });
  const tap = async (code) => { await key(code, true); await step(2); await key(code, false); await step(2); };

  // ---- a abertura, beat a beat
  await open();
  await step(150);
  await shot('01-noite-garoa');
  await until((i) => i.story.beat === 'pombos');
  await step(200);
  await shot('02-pombos-no-parapeito');
  await step(160);
  await shot('03-capitao-mede-a-cenoura');
  await until((i) => i.story.beat === 'manha');
  await step(120);
  await shot('04-manha-mao-da-tutora');
  await step(200);
  await shot('05-manha-radhija-acorda');
  await until((i) => i.story.waitingFaro);
  await step(20);
  await shot('06-aviso-do-faro');
  await tap('KeyV');
  await step(40);
  await shot('07-pulso-do-faro');
  await step(110);
  await shot('08-pombos-pela-janela');
  await until((i) => i.story.beat === 'acorda');
  await step(170);
  await shot('09-rhaenyra-acorda');
  await until((i) => i.story.beat === 'titulo');
  await step(80);
  await shot('10-cartela');
  await until((i) => !i.story.scene);
  await step(60);
  await shot('11-quarto-de-dia');

  // ---- a missão, etapa a etapa (as cenas tocando nos momentos fortes)
  for (const [stage, name, frames] of [['cozinha', '12-cozinha', 30], ['galho', '13-quintal-galho', 30], ['piscina', '14-piscina', 30],
    ['varal', '16-varal', 30], ['torre', '18-torre', 30], ['portaria', '20-guarita', 30], ['fechamento', '22-portaozinho', 30]]) {
    await open(stage);
    await step(frames);
    await shot(name);
  }
  // a Reconstrução: o pulso perto da piscina
  await open('piscina');
  await step(20);
  await tap('KeyV');
  await until((i) => i.story.scene === 'reconstrucao', 200);
  await step(160);
  await shot('15-reconstrucao');
  // o varal sacudindo (a arrancada no poste)
  await open('varal');
  await page.evaluate(() => { const g = window.__game.game; const P = g.levelDef.layout.DASH_POST; g.debug.teleport('radhija', P.x, P.z + 0.45); g.debug.ctrls.radhija.yaw = Math.PI; });
  await step(5);
  await tap('ShiftLeft');
  await until((i) => i.story.scene === 'varal', 60);
  await step(70);
  await shot('17-varal-sacode');
  // o terraço da torre
  await open('torre');
  await page.evaluate(() => { const g = window.__game.game; const T = g.levelDef.layout.TOWER_LOBBY; g.debug.teleport('radhija', (T.x0 + T.x1) / 2, (T.z0 + T.z1) / 2); });
  await until((i) => i.story.scene === 'terraco', 60);
  await until((i) => i.story.beat === 'vento', 2000);
  await step(60);
  await shot('19-terraco-vento');
  // o porteiro e a botina
  await open('portaria');
  await page.evaluate(() => { const g = window.__game.game; g.debug.setStage('portaria', 'rhaenyra'); const B = g.levelDef.layout.BOOTH; g.debug.teleport('rhaenyra', (B.x0 + B.x1) / 2, B.z1 + 0.6); });
  await step(10);
  await tap('KeyE');
  await until((i) => i.story.beat === 'botina', 1200);
  await step(60);
  await shot('21-botina-do-porteiro');
  // o fechamento: os pombos sobre a cidade e a borboleta
  await open('fechamento');
  await page.evaluate(() => { const g = window.__game.game; const G = g.levelDef.layout.GATE; g.debug.teleport('radhija', (G.x0 + G.x1) / 2, G.z + 0.6); });
  await until((i) => i.story.scene === 'fechamento', 60);
  await until((i) => i.story.beat === 'pombos', 600);
  await step(80);
  await shot('23-pombos-sobre-a-cidade');
  await until((i) => i.story.beat === 'borboleta', 600);
  await step(70);
  await shot('24-borboleta');
  await until((i) => i.story.stage === 'mural', 1200);
  await step(60);
  await shot('25-mural');
  await page.evaluate(() => window.__game.events.emit('ui:muralDone', { errors: 0, settled: true }));
  await step(30);
  await shot('26-fim-do-capitulo');

  if (dev.full) {
    await open('cozinha');
    await step(10);
    // vistas altas (câmera livre, sem a interface): o condomínio inteiro e cada canto
    for (const [name, cam] of [
      ['30-vista-condominio', { pos: [6, 26, 24], look: [0, 0, -1] }],
      ['31-vista-casa-quintal', { pos: [-6, 9, 9.5], look: [-9, 0, 3.6] }],
      ['32-vista-piscina-varal', { pos: [0, 9, 3.5], look: [-1.6, 0, -4.6] }],
      ['33-vista-torre-guarita', { pos: [12, 9, 1.5], look: [8.5, 0.8, -6.6] }],
      ['34-vista-lago', { pos: [13, 8, 8.5], look: [9.6, 0, 1.6] }],
      ['35-vista-garagem', { pos: [4, 7, 12], look: [1.6, 0.4, 6.4] }],
      ['36-vista-rua-cidade', { pos: [13, 3.2, -6.4], look: [13, 2.4, -24] }],
    ]) await shot(name, { cam, hideUi: true });
  }
  await page.close();
}
