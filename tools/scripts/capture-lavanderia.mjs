// Capturas de revisão da fase 8 (Lavanderia de Domingo) em qualidade visual completa (sombras, bloom, resolução 1).
// Roda no GitHub Actions (E2E manual, suíte lavanderia), depois da partida; não usa a redução gráfica do harness.
// O laço do jogo fica congelado e o script avança quadro a quadro (1/60 s): cada imagem mostra um instante exato
// (impulso no botão, máquina chacoalhando, mantinha caindo, varal embaixo, arrancada na meia). Teclas reais chegam
// pelos ouvintes do jogo; teleporte e etapas só preparam as cenas. Saída: shots/lavanderia-revisao/*.png.
import './lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium em shots/diagnostico/
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { attachHangProbe, waitForBoot } from './lib/hang-probe.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/lavanderia-revisao';
mkdirSync(OUT, { recursive: true });
let server, browser;
const errors = [];
let shots = 0;
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(browserOptions());
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const probe = await attachHangProbe(page); // diagnóstico se a aba travar no boot (hang-probe.mjs)
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });
  await page.goto(`${url}?level=fase8&play`);
  await waitForBoot(page, probe, () => window.__game?.game?.state === 'playing', null, { timeout: 180000 });
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
    if (!ok) throw new Error(`condição não alcançada: ${pred}`);
  };
  const key = (code) => page.evaluate((c) => { window.__key(c, true); window.__step(1); window.__key(c, false); window.__step(1); }, code);
  const keyDown = (code) => page.evaluate((c) => window.__key(c, true), code);
  const keyUp = (code) => page.evaluate((c) => window.__key(c, false), code);
  const shot = async (name, cam = null) => {
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${name}.png`, style: '#ui, #loading { display: none !important; }' });
    shots++;
    console.log(`  captura: ${OUT}/${name}.png`);
  };
  /** Etapa, dog ativa e posições (teleporte só no preparo). */
  const setup = (o) => page.evaluate((opts) => {
    const g = window.__game.game;
    if (opts.stage) g.debug.setStage(opts.stage, opts.active);
    if (opts.active && g.activeDog !== opts.active) {
      window.__key('KeyQ', true); window.__step(1); window.__key('KeyQ', false); window.__step(1);
    }
    for (const [name, p] of Object.entries(opts.place || {})) {
      g.debug.teleport(name, p.x, p.z);
      g.debug.ctrls[name].yaw = p.yaw;
    }
    if (opts.stay) g.setStay(opts.stay, true);
    window.__step(opts.settle ?? 20);
  }, o);
  const L = await page.evaluate(() => {
    const l = window.__game.layout;
    return { SPIN: l.SPIN_BUTTON, RACK: l.RACK_BUTTON, SOCK: l.SOCK, CATCH: l.CATCH, BED: l.DOG_BED, WASHER: l.WASHER, TANK: l.TANK, BOARD: l.BOARD, RACKC: l.RACK, WINDOW: l.WINDOW };
  });
  const W = L.WASHER;
  const north = Math.PI; // de frente para a parede do fundo

  // 1. a lavanderia com a câmera do jogo e de cima
  await step(60);
  await shot('01-lavanderia');
  await shot('02-visao-geral', { pos: [0.6, 5.6, 6.2], look: [0, 0.4, -0.6] });
  // 2. detalhes: máquinas e botões, tanque, tábua, janela, varal lá em cima com a meia
  await shot('03-maquinas-e-botoes', { pos: [W.x + 0.9, 1.25, W.z + 2.2], look: [W.x + 0.4, 0.85, W.z] });
  await shot('04-tanque', { pos: [L.TANK.x - 0.9, 1.4, L.TANK.z + 1.9], look: [L.TANK.x, 1.0, L.TANK.z] });
  await shot('05-tabua-e-cesto', { pos: [L.BOARD.x - 1.6, 1.3, L.BOARD.z + 2.0], look: [L.BOARD.x - 1.2, 0.5, L.BOARD.z + 0.3] });
  await shot('06-janela-com-sol', { pos: [L.WINDOW.cx + 0.9, 1.3, -1.0], look: [L.WINDOW.cx, 1.1, -3.2] });
  await shot('07-varal-com-a-meia', { pos: [L.SOCK.x - 0.6, 1.1, L.SOCK.z + 2.0], look: [L.SOCK.x - 0.3, 1.55, L.SOCK.z] });

  // 3. impulso no botão de centrifugar, a máquina chacoalhando e a mantinha caindo no cesto
  await setup({ stage: 'start', active: 'rhaenyra', place: { rhaenyra: { x: L.SPIN.x - 0.14, z: L.SPIN.z + 0.6, yaw: north }, radhija: { x: -3.6, z: -0.5, yaw: 1.5 } }, stay: 'radhija' });
  // o cesto já na frente da máquina (o empurrão longo é coberto pela partida e pelos testes headless)
  await page.evaluate((c) => { window.__game.game.puzzle.placeBasket(c.x, c.z); window.__step(2); }, L.CATCH);
  await key('Space');
  await until((i) => (i.dogs.rhaenyra.wall?.k ?? 0) >= 0.52, 120);
  await shot('08-impulso-no-botao-da-maquina', { pos: [L.SPIN.x + 0.9, 1.25, L.SPIN.z + 1.8], look: [L.SPIN.x - 0.2, 0.75, L.SPIN.z + 0.2] });
  await until((i) => !i.dogs.rhaenyra.wall, 120);
  await step(25);
  await shot('09-maquina-chacoalhando', { pos: [W.x + 0.75, 1.15, W.z + 1.7], look: [W.x, 0.75, W.z + 0.1] });
  await until((i) => i.lavanderia.blanket === 'falling', 200);
  await step(12);
  await shot('10-mantinha-caindo', { pos: [W.x + 1.1, 0.95, W.z + 1.9], look: [W.x, 0.5, W.z + 0.5] });
  await until((i) => i.lavanderia.blanket !== 'falling', 120);
  await step(20);
  await shot('11-mantinha-pousou', { pos: [W.x + 1.1, 0.95, W.z + 1.9], look: [W.x, 0.35, W.z + 0.55] });

  // 4. varal embaixo e a arrancada da Radhija na meia
  await setup({ stage: 'start', active: 'rhaenyra', place: { rhaenyra: { x: L.RACK.x - 0.14, z: L.RACK.z + 0.6, yaw: north }, radhija: { x: L.SOCK.x, z: L.SOCK.z + 1.05, yaw: north } }, stay: 'radhija' });
  await key('Space');
  await until((i) => i.lavanderia.rackDown, 200);
  await step(10);
  await shot('12-varal-embaixo', { pos: [L.SOCK.x + 0.9, 1.1, L.SOCK.z + 2.2], look: [L.SOCK.x - 0.2, 0.6, L.SOCK.z] });
  await key('KeyQ');
  await keyDown('KeyW');
  await step(4);
  await key('ShiftLeft');
  await until((i) => i.dogs.radhija.dashing, 30);
  await step(5);
  await shot('13-arrancada-na-meia', { pos: [L.SOCK.x + 1.1, 0.8, L.SOCK.z + 0.9], look: [L.SOCK.x, 0.45, L.SOCK.z] });
  await until((i) => i.sock.holder === 'radhija', 60);
  await keyUp('KeyW');
  await step(30);
  const rad = await page.evaluate(() => { const c = window.__game.game.debug.ctrls.radhija; return { x: c.x, z: c.z }; });
  await shot('14-meia-na-boca', { pos: [rad.x + 0.75, 0.55, rad.z + 0.8], look: [rad.x, 0.32, rad.z] });

  // 5. tudo entregue: a caminha com a meia e a mantinha, o cesto estacionado do lado
  await setup({ stage: 'done', settle: 2 });
  await step(150);
  await shot('15-caminha', { pos: [L.BED.x - 0.6, 1.2, L.BED.z + 1.6], look: [L.BED.x, 0.2, L.BED.z] });
  await step(60);
  await shot('16-comemoracao');
  if (errors.length) throw new Error(`erros no navegador:\n${errors.join('\n')}`);
  console.log(`\n${shots} capturas de revisão; sem erros de console`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
}
