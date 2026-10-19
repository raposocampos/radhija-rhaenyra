// Capturas de revisão do empurrão em pé em qualidade visual completa (sombras, bloom, resolução 1).
// Roda no GitHub Actions (E2E manual, suíte empurra), depois da partida; não usa a redução gráfica do harness.
// O laço do jogo fica congelado e o script avança quadro a quadro (1/60 s): cada imagem mostra um instante exato
// (ficando de pé, empurrando, a bolinha caindo, o patinho, o ursinho, a irmã empurrada). Teclas reais chegam pelos
// ouvintes do jogo. Saída: shots/empurra-revisao/*.png. Erros do navegador reprovam o passo.
import './lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium em shots/diagnostico/
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/empurra-revisao';
mkdirSync(OUT, { recursive: true });
let server, browser;
const errors = [];
let shots = 0;
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(browserOptions());
  const { page, guard } = await openPage(browser, { viewport: { width: 1280, height: 720 } }, { name: 'empurra' });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });
  /** Abre a arena (query) e congela o laço: daqui em diante o script avança quadro a quadro. */
  const boot = async (query) => {
    await page.goto(`${url}${query}`);
    await page.waitForFunction(() => window.__game?.game?.state === 'playing', null, { timeout: 120000 });
    await page.evaluate(setup);
  };
  const setup = () => {
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
  };
  await boot('?level=empurra&play&dog=rhaenyra');
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  const until = async (pred, max = 600) => {
    const ok = await page.evaluate(({ src, max: m }) => window.__stepUntil(src, m), { src: pred.toString(), max });
    if (!ok) throw new Error(`condição não alcançada: ${pred}; ${await guard.peek()}`);
  };
  const key = (code, down) => page.evaluate(({ c, d }) => window.__key(c, d), { c: code, d: down });
  const shot = async (name, cam = null) => {
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${name}.png`, style: '#ui, #loading { display: none !important; }' });
    shots++;
    guard.note(`captura ${name}`);
    console.log(`  captura: ${OUT}/${name}.png`);
  };
  /** Rhaenyra `back` m atrás de onde fica para empurrar `k`, de frente para ele; a Radhija longe, no Fica. */
  const ready = (k, back = 0.12, sister = null) => page.evaluate(({ k: kk, b, s }) => {
    const g = window.__game.game;
    const T = window.__game.layout.SHOVE_TARGETS[kk];
    const r = g.debug.ctrls.rhaenyra;
    const d = r.r + 0.04 + b;
    g.debug.teleport('rhaenyra', T.x + T.nx * d, T.z + T.nz * d);
    r.yaw = Math.atan2(-T.nx, -T.nz);
    const S = s || { x: -3.6, z: 2.6 };
    g.debug.teleport('radhija', S.x, S.z);
    g.setStay('radhija', true);
    window.__step(30);
    return T;
  }, { k, b: back, s: sister });

  /** Câmeras: de perfil (do lado), de três quartos pela frente da dog e a do jogo. */
  const views = (T, h = 0.5) => {
    const lx = -T.nz;
    const lz = T.nx;
    const cx = T.x + T.nx * 0.42;
    const cz = T.z + T.nz * 0.42;
    return {
      side: { pos: [cx + lx * 1.9, h + 0.2, cz + lz * 1.9], look: [cx, h, cz] },
      front: { pos: [T.x + T.nx * 1.6 - lx * 0.9, h + 0.55, T.z + T.nz * 1.6 - lz * 0.9], look: [cx, h, cz] },
    };
  };

  // 1. a arvorezinha: antes, ficando de pé, empurrando (cada fase do ciclo), a bolinha caindo e no chão
  let T = await ready('arvorezinha');
  let V = views(T, 0.55);
  await shot('01-arena');
  await shot('02-arvorezinha', { pos: [T.x + 0.2, 1.6, T.z + 2.6], look: [T.x + 0.1, 0.9, T.z] });
  await key('ShiftLeft', true);
  for (const [n, k] of [['03-subindo', 0.5], ['04-de-pe', 0.99]]) {
    await until(new Function('i', `return (i.dogs.rhaenyra.shove?.k ?? 0) >= ${k}`), 120);
    await shot(`${n}-lado`, V.side);
  }
  await shot('04-de-pe-frente', V.front);
  for (const [n, c] of [['05-carregando', 0.2], ['06-empurrao', 0.44], ['07-segurando', 0.62], ['08-voltando', 0.88]]) {
    await until(new Function('i', `const s = i.dogs.rhaenyra.shove; return s && s.stage === 'push' && s.n === 1 && s.cycle >= ${c}`), 120);
    await shot(`${n}-lado`, V.side);
    if (c === 0.44) await shot(`${n}-frente`, V.front);
  }
  await until((i) => i.empurra.tree.dropped, 200);
  await step(4);
  await shot('09-bolinha-soltando', { pos: [T.x + 0.4, 1.35, T.z + 1.9], look: [T.x + 0.2, 0.75, T.z + 0.2] });
  await step(10);
  await shot('10-bolinha-caindo', { pos: [T.x + 0.4, 1.35, T.z + 1.9], look: [T.x + 0.2, 0.6, T.z + 0.2] });
  await key('ShiftLeft', false);
  await until((i) => i.empurra.tree.landed && !i.dogs.rhaenyra.shove, 200);
  await step(10);
  await shot('11-bolinha-no-chao');
  await shot('12-descendo-lado', V.side);
  await page.evaluate(() => { window.__game.game.reset(); window.__step(5); });

  // 2. a mesinha (patas em cima do tampo) e a estante (o tampo mais alto)
  for (const [k, id, base] of [['mesinha', 'table', 20], ['estante', 'shelf', 30]]) {
    T = await ready(k);
    V = views(T, T.y);
    await key('ShiftLeft', true);
    await until((i) => (i.dogs.rhaenyra.shove?.k ?? 0) >= 0.99, 120);
    await shot(`${base}-${k}-de-pe-lado`, V.side);
    await shot(`${base + 1}-${k}-de-pe-frente`, V.front);
    await until(new Function('i', `const s = i.dogs.rhaenyra.shove; return s && s.n === 2 && s.cycle >= 0.44`), 200);
    await shot(`${base + 2}-${k}-tombando`, V.side);
    await until(new Function('i', `return i.empurra.${id}.dropped`), 200);
    await step(8);
    await shot(`${base + 3}-${k}-caindo`, V.side);
    await key('ShiftLeft', false);
    await until(new Function('i', `return i.empurra.${id}.landed && !i.dogs.rhaenyra.shove`), 240);
    await step(10);
    await shot(`${base + 4}-${k}-no-chao`);
    await page.evaluate(() => { window.__game.game.reset(); window.__step(5); });
  }

  // 3. a irmã: patas nas costas dela, o empurrão e o "hmpf"
  await page.evaluate(() => {
    const g = window.__game.game;
    g.setStay('radhija', false);
    g.debug.teleport('radhija', -1.0, -0.4);
    g.debug.ctrls.radhija.yaw = Math.PI / 2;
    g.debug.teleport('rhaenyra', -1.0, 0.25);
    g.debug.ctrls.rhaenyra.yaw = Math.PI;
    window.__step(2);
  });
  const sideS = { pos: [0.7, 0.75, -0.1], look: [-1.0, 0.35, -0.1] };
  await key('ShiftLeft', true);
  await until((i) => (i.dogs.rhaenyra.shove?.k ?? 0) >= 0.99, 120);
  await shot('40-irma-patas-nas-costas', sideS);
  await until((i) => i.shove?.reacting === 'radhija', 120);
  await step(6);
  await shot('41-irma-empurrada', sideS);
  await key('ShiftLeft', false);
  await until((i) => (i.shove?.t ?? 0) >= 0.9, 120);
  await shot('42-irma-hmpf', sideS);
  await shot('43-irma-hmpf-perto', { pos: [-1.0 + 0.6, 0.6, -0.9 + 0.9], look: [-1.0, 0.35, -0.85] });

  // 4. o modelo novo das dogs (?dogs=novo, src/dogs/v2/): a mesma pose, guiada pela animação atual
  await boot('?level=empurra&play&dog=rhaenyra&dogs=novo');
  T = await ready('arvorezinha');
  V = views(T, 0.55);
  await key('ShiftLeft', true);
  await until((i) => (i.dogs.rhaenyra.shove?.k ?? 0) >= 0.99, 120);
  await shot('50-modelo-novo-de-pe-lado', V.side);
  await until((i) => { const s = i.dogs.rhaenyra.shove; return s && s.stage === 'push' && s.n === 1 && s.cycle >= 0.44; }, 120);
  await shot('51-modelo-novo-empurrao-frente', V.front);
  await key('ShiftLeft', false);

  if (errors.length) throw new Error(`erros no navegador:\n${errors.join('\n')}`);
  console.log(`\n${shots} capturas de revisão; sem erros de console`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await closeBrowser(browser);
  await server?.close();
}
