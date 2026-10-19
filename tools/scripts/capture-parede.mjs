// Capturas de revisão do impulso na parede em qualidade visual completa (sombras, bloom, resolução 1).
// Roda no GitHub Actions (E2E manual, suíte pulo), depois da partida; não usa a redução gráfica do harness.
// O laço do jogo fica congelado e o script avança quadro a quadro (1/60 s): cada imagem mostra um instante exato
// do impulso (agachada, saltando, traseiras nas patinhas, pata no botão, descendo). Teclas reais chegam pelos
// ouvintes do jogo. Saída: shots/parede-revisao/*.png. Erros do navegador reprovam o passo.
import './lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium em shots/diagnostico/
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/parede-revisao';
mkdirSync(OUT, { recursive: true });
let server, browser;
const errors = [];
let shots = 0;
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(browserOptions());
  // redes de prazo (lib/page-guard.mjs): uma aba que trava ou cai encerra o passo em minutos, com o passo e o estado
  const { page, guard } = await openPage(browser, { viewport: { width: 1280, height: 720 } }, { name: 'parede' });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });
  await page.goto(`${url}?level=pulo&play&dog=rhaenyra`);
  await page.waitForFunction(() => window.__game?.game?.state === 'playing', null, { timeout: 120000 });
  await page.evaluate(() => {
    window.__freezeReview = true;
    document.getElementById('loading')?.remove();
    const G = window.__game;
    const rev = { t: 20 };
    window.__step = (n = 1) => {
      for (let i = 0; i < n; i++) {
        rev.t += 1 / 60;
        G.game.update(1 / 60, rev.t);
        G.seeThrough();
        G.feedback.update(1 / 60, rev.t);
        G.particles.update(1 / 60);
      }
    };
    window.__stepUntil = (src, max = 600) => {
      const fn = new Function(`return (${src})`)();
      for (let i = 0; i < max; i++) {
        window.__step(1);
        if (fn(G.game.debug.info())) return true;
      }
      return false;
    };
    window.__render = (cam) => {
      if (cam) {
        G.engine.camera.position.set(...cam.pos);
        G.engine.camera.lookAt(...cam.look);
        G.engine.camera.updateMatrixWorld();
      }
      G.engine.render(1 / 60, rev.t);
      G.engine.renderer.getContext().finish();
    };
    window.__key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
  });
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  const until = async (pred, max = 600) => {
    const ok = await page.evaluate(({ src, max: m }) => window.__stepUntil(src, m), { src: pred.toString(), max });
    if (!ok) throw new Error(`condição não alcançada: ${pred}; ${await guard.peek()}`);
  };
  const key = async (code) => {
    await page.evaluate((c) => { window.__key(c, true); window.__step(1); window.__key(c, false); window.__step(1); }, code);
  };
  const shot = async (name, cam = null) => {
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${name}.png`, style: '#ui, #loading { display: none !important; }' });
    shots++;
    guard.note(`captura ${name}`);
    console.log(`  captura: ${OUT}/${name}.png`);
  };
  /** Coloca a Rhaenyra 12 cm atrás do ponto de impulso de `cfg` (à esquerda do botão), de frente para a parede,
   *  e a Radhija longe (Fica). */
  const ready = (cfg) => page.evaluate((c) => {
    const g = window.__game.game;
    const r = g.debug.ctrls.rhaenyra;
    const d = r.r + 0.03 + 0.12;
    const lat = 0.14; // WALL_BUTTON_SHAPE.lat
    g.debug.teleport('rhaenyra', c.x + c.nx * d - c.nz * lat, c.z + c.nz * d + c.nx * lat);
    r.yaw = Math.atan2(-c.nx, -c.nz);
    g.debug.teleport('radhija', c.x + 1.3, c.z + 1.4);
    g.setStay('radhija', true);
    window.__step(30);
  }, cfg);
  const L = await page.evaluate(() => {
    const l = window.__game.layout;
    return { B: l.WALL_BUTTON, V: l.WALL_LEVER, C: l.CUBBY };
  });
  const B = L.B;
  // câmeras: de lado (perfil, vinda do oeste, sem o armarinho na frente), de três quartos por trás e de perto do
  // botão pela direita (a cabeça dela fica à esquerda)
  const side = { pos: [B.x - 1.85, 0.9, B.z + 0.6], look: [B.x - 0.1, 0.68, B.z + 0.22] };
  const back = { pos: [B.x + 0.55, 1.45, B.z + 2.2], look: [B.x - 0.08, 0.72, B.z + 0.1] };
  const close = { pos: [B.x + 0.62, 1.22, B.z + 0.72], look: [B.x - 0.06, 1.04, B.z + 0.05] };

  // 1. parede de treino com a câmera do jogo
  await ready(B);
  await step(60);
  await shot('01-parede-de-treino');
  await shot('02-botao-e-patinhas', { pos: [B.x + 0.45, 0.9, B.z + 1.6], look: [B.x - 0.05, 0.7, B.z] });
  await shot('03-alavanca', { pos: [L.V.x + 0.45, 1.15, L.V.z + 0.8], look: [L.V.x, 1.0, L.V.z] });

  // 2. o impulso inteiro, de lado e por trás, nos mesmos instantes
  const phases = [0.1, 0.22, 0.32, 0.42, 0.52, 0.6, 0.72, 0.86];
  for (const [view, cam] of [['lado', side], ['tras', back]]) {
    await ready(B);
    await key('Space');
    for (const [k, ph] of phases.entries()) {
      await until(new Function('i', `return (i.dogs.rhaenyra.wall?.k ?? 1) >= ${ph}`), 120);
      await shot(`1${view === 'lado' ? 0 : 1}-${view}-${k + 1}-${Math.round(ph * 100)}`, cam);
    }
    await until((i) => !i.dogs.rhaenyra.wall, 120);
    await step(12);
    await shot(`1${view === 'lado' ? 0 : 1}-${view}-9-pousou`, cam);
    if (view === 'lado') {
      await shot('20-anel-de-luzes', close);
      await shot('21-portinhola-aberta', { pos: [L.C.x1 + 1.1, 0.8, L.C.zFront + 1.3], look: [(L.C.x0 + L.C.x1) / 2, 0.3, L.C.zFront - 0.1] });
    }
    await page.evaluate(() => { window.__game.game.reset(); window.__step(5); });
  }

  // 3. pata no botão de perto e a alavanca puxada com as luzinhas acesas
  await ready(B);
  await key('Space');
  await until((i) => (i.dogs.rhaenyra.wall?.k ?? 0) >= 0.52, 120);
  await shot('22-pata-no-botao', close);
  await until((i) => !i.dogs.rhaenyra.wall, 120);
  await ready(L.V);
  await key('Space');
  await until((i) => (i.dogs.rhaenyra.wall?.k ?? 0) >= 0.53, 120);
  await shot('23-pata-na-alavanca', { pos: [L.V.x + 0.62, 1.22, L.V.z + 0.75], look: [L.V.x - 0.06, 1.02, L.V.z + 0.05] });
  await until((i) => !i.dogs.rhaenyra.wall, 120);
  await step(40);
  await shot('24-luzinhas-acesas');
  if (errors.length) throw new Error(`erros no navegador:\n${errors.join('\n')}`);
  console.log(`\n${shots} capturas de revisão; sem erros de console`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await closeBrowser(browser);
  await server?.close();
}
