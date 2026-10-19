// Capturas de revisão dos porquinhos (Arena dos Porquinhos, ?level=porcos) em qualidade visual completa (sombras,
// bloom, resolução 1). Roda no GitHub Actions (E2E manual, suíte porcos), depois da partida. O laço do jogo fica
// congelado e o script avança quadro a quadro (1/60 s). Duas partes: (1) "estúdio": um porquinho num canto livre do
// gramado, posado direto no modelo (cada ação e cada gesto, de vários lados, e as três variantes lado a lado);
// (2) o jogo: o chiqueiro, a porteira abrindo, os porcos atrás das dogs, o esbarrão, os legumes na boca, o milho
// largado e comido, o cochilo, a sacudida e o sininho. Teclas reais chegam pelos ouvintes do jogo; teleporte e
// etapas só preparam as cenas. Saída: shots/porcos-revisao/*.png.
import './lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium em shots/diagnostico/
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/porcos-revisao';
mkdirSync(OUT, { recursive: true });
let server, browser;
const errors = [];
let shots = 0;
try {
  server = await createServer({ configFile: 'tools/scripts/vite.nohmr.config.mjs', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch(browserOptions());
  const { page, guard } = await openPage(browser, { viewport: { width: 1280, height: 720 } }, { name: 'porcos' });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });
  await page.goto(`${url}?level=porcos&play`);
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
        if (fn(G.game.debug.info(), G.game)) return true;
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
    window.__tap = (code) => { window.__key(code, true); window.__step(1); window.__key(code, false); window.__step(1); };
    /** Estúdio: posa o porquinho i direto no modelo (o jogo fica parado). gesture: 'oink' | 'bump' | 'shake' no quadro g. */
    window.__pose = ({ i, x, z, yaw, anim, frames, gesture = null, at = 0 }) => {
      const P = G.game.puzzle.pigs.pigs[i];
      const m = P.model;
      m.object.position.set(x, 0, z);
      m.object.rotation.y = yaw;
      for (let k = 0; k < frames; k++) {
        if (gesture && k === at) m[gesture]();
        rev.t += 1 / 60;
        m.update(1 / 60, anim);
      }
      return +m.lowestY().toFixed(4);
    };
  });
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  const until = async (pred, max = 900) => {
    const ok = await page.evaluate(({ src, max: m }) => window.__stepUntil(src, m), { src: pred.toString(), max });
    if (!ok) throw new Error(`condição não alcançada: ${pred}; ${await guard.peek()}`);
  };
  const tap = (code) => page.evaluate((c) => window.__tap(c), code);
  const shot = async (name, cam = null) => {
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${name}.png`, style: '#ui, #loading { display: none !important; }' });
    shots++;
    guard.note(`captura ${name}`);
    console.log(`  captura: ${OUT}/${name}.png`);
  };
  const setup = (o) => page.evaluate((opts) => {
    const g = window.__game.game;
    if (opts.stage) g.debug.setStage(opts.stage, opts.active);
    if (opts.active && g.activeDog !== opts.active) window.__tap('KeyQ');
    for (const [name, p] of Object.entries(opts.place || {})) {
      g.debug.teleport(name, p.x, p.z);
      g.debug.ctrls[name].yaw = p.yaw;
    }
    for (const [name, kind] of Object.entries(opts.give || {})) g.puzzle.give(kind, name);
    window.__step(opts.settle ?? 20);
  }, o);
  const pigsAt = () => page.evaluate(() => window.__game.game.puzzle.pigs.pigs.map((P) => ({ x: P.x, z: P.z, yaw: P.yaw, state: P.state, action: P.action })));
  const L = await page.evaluate(() => {
    const l = window.__game.layout;
    return { PEN: l.PEN, BUTTON: l.BUTTON, BELL: l.BELL, VEG: l.VEGGIES, HORTA: l.HORTA, GOAL: l.GOAL };
  });

  // ---------------------------------------------------------------- o quintal e o chiqueiro
  await step(120);
  await shot('00-camera-do-jogo');
  await shot('01-visao-geral', { pos: [0.5, 8.5, 8.4], look: [0.5, 0.2, -0.4] });
  await step(240);
  const pc = { x: (L.PEN.x0 + L.PEN.x1) / 2, z: (L.PEN.z0 + L.PEN.z1) / 2 };
  await shot('02-chiqueiro', { pos: [pc.x - 1.2, 1.7, pc.z + 3.0], look: [pc.x, 0.25, pc.z] });
  await shot('03-chiqueiro-de-perto', { pos: [pc.x + 0.2, 1.05, L.PEN.z1 + 1.35], look: [pc.x, 0.25, pc.z + 0.1] });

  // ---------------------------------------------------------------- estúdio: um porquinho no gramado, cada pose
  const S = { x: -2.2, z: -1.2 };
  const cam = {
    frente: (y = 0.2) => ({ pos: [S.x + 0.55, 0.66, S.z + 0.95], look: [S.x, y, S.z] }),
    lado: (y = 0.22) => ({ pos: [S.x + 1.25, 0.36, S.z + 0.05], look: [S.x, y, S.z] }),
    tras: () => ({ pos: [S.x - 0.55, 0.55, S.z - 1.05], look: [S.x, 0.24, S.z] }),
    cima: () => ({ pos: [S.x + 0.5, 1.35, S.z + 0.8], look: [S.x, 0.12, S.z] }),
    rente: () => ({ pos: [S.x + 0.9, 0.16, S.z + 0.7], look: [S.x, 0.12, S.z] }),
  };
  const lows = {};
  const pose = async (name, o, views) => {
    lows[name] = await page.evaluate((a) => window.__pose(a), { i: 0, x: S.x, z: S.z, yaw: 0, frames: 90, ...o });
    for (const [v, c] of views) await shot(`${name}-${v}`, c);
  };
  // os outros dois longe da câmera do estúdio
  await page.evaluate(({ x, z }) => {
    const P = window.__game.game.puzzle.pigs.pigs;
    P[1].model.object.position.set(x + 5, 0, z - 5);
    P[2].model.object.position.set(x + 6, 0, z - 5);
  }, S);
  await pose('10-parado', { anim: { action: 'idle' } }, [['frente', cam.frente()], ['lado', cam.lado()], ['tras', cam.tras()], ['cima', cam.cima()]]);
  await pose('11-andando', { anim: { action: 'walk', speed: 0.55 }, frames: 77 }, [['lado', cam.lado()], ['frente', cam.frente()]]);
  await pose('12-trotando', { anim: { action: 'walk', speed: 1.55 }, frames: 83 }, [['lado', cam.lado()]]);
  await pose('13-girando-parado', { anim: { action: 'idle', turn: 2.4 }, frames: 70 }, [['cima', cam.cima()]]);
  await pose('14-fucando', { anim: { action: 'sniff' }, frames: 120 }, [['frente', cam.frente(0.14)], ['rente', cam.rente()]]);
  // comendo: um milho na frente do focinho
  await page.evaluate(({ x, z }) => {
    const v = window.__game.game.built.props.veggies.corn;
    v.object.position.set(x + 0.02, v.groundY, z + 0.33);
    v.object.rotation.set(0, 0.5, 0);
    v.setEaten(0.35);
  }, S);
  await pose('15-comendo', { anim: { action: 'eat' }, frames: 120 }, [['frente', cam.frente(0.14)], ['lado', cam.lado(0.15)]]);
  await page.evaluate(() => { const v = window.__game.game.built.props.veggies.corn; v.reset(); v.object.position.copy(v.home); });
  await pose('16-alerta', { anim: { action: 'alert' } }, [['frente', cam.frente()]]);
  await pose('17-oinc', { anim: { action: 'idle' }, frames: 75, gesture: 'oink', at: 62 }, [['frente', cam.frente()]]);
  await pose('18-esbarrao', { anim: { action: 'idle' }, frames: 90, gesture: 'bump', at: 66 }, [['lado', cam.lado()]]);
  await pose('19-sacudindo', { anim: { action: 'idle' }, frames: 90, gesture: 'shake', at: 60 }, [['frente', cam.frente()]]);
  await pose('20-deitado', { anim: { action: 'lie' }, frames: 240 }, [['frente', cam.frente(0.14)], ['lado', cam.lado(0.12)], ['rente', cam.rente()]]);
  await pose('21-dormindo', { anim: { action: 'sleep' }, frames: 300 }, [['frente', cam.frente(0.12)], ['cima', cam.cima()], ['rente', cam.rente()]]);
  // as três variantes lado a lado
  await page.evaluate(({ x, z }) => {
    window.__game.game.puzzle.pigs.pigs.forEach((P, i) => {
      const m = P.model;
      m.object.position.set(x - 0.55 + i * 0.55, 0, z + (i === 1 ? 0.15 : 0));
      m.object.rotation.y = -0.35 + i * 0.35;
      for (let k = 0; k < 60; k++) m.update(1 / 60, { action: 'idle' });
    });
  }, S);
  await shot('22-tres-porquinhos', { pos: [S.x + 0.3, 0.7, S.z + 1.9], look: [S.x, 0.22, S.z] });
  console.log(`  ponto mais baixo por pose (m): ${JSON.stringify(lows)}`);
  const bad = Object.entries(lows).filter(([, y]) => y < -0.006);
  if (bad.length) throw new Error(`pose abaixo do chão: ${JSON.stringify(bad)}`);

  // ---------------------------------------------------------------- o jogo: porteira, porcos soltos, legumes
  await page.evaluate(() => window.__game.game.puzzle.reset());
  await setup({ active: 'radhija', place: { radhija: { x: L.BUTTON.x, z: L.BUTTON.z, yaw: Math.PI }, rhaenyra: { x: L.HORTA.x - 0.8, z: -0.5, yaw: Math.PI / 2 } }, settle: 4 });
  await until((i) => i.porcos.gateT > 0.5, 200);
  await shot('30-porteira-abrindo', { pos: [L.BUTTON.x + 0.4, 1.6, L.BUTTON.z + 2.4], look: [4.75, 0.3, L.PEN.z1] });
  await until((i) => i.porcos.pigs.filter((p) => p.state !== 'pen').length >= 2, 400);
  await step(40);
  await shot('31-saindo', { pos: [4.0, 1.4, -0.2], look: [4.8, 0.25, -2.2] });
  await until((i) => i.porcos.pestering >= 2, 900);
  await step(120);
  await shot('32-atrapalhando');
  let p = await pigsAt();
  await shot('33-atrapalhando-de-perto', { pos: [L.BUTTON.x + 1.3, 0.9, L.BUTTON.z + 1.7], look: [(p[0].x + p[1].x) / 2, 0.2, (p[0].z + p[1].z) / 2] });
  await until((_, g) => g.debug.events('pig:bump').length > 0, 900);
  await step(8);
  const at = await page.evaluate(() => { const c = window.__game.game.debug.ctrls.radhija; return { x: c.x, z: c.z }; });
  await shot('34-esbarrao', { pos: [at.x + 1.0, 0.85, at.z + 1.4], look: [at.x, 0.2, at.z] });
  // legumes na boca
  await setup({ place: { radhija: { x: -2.5, z: 1.6, yaw: 0.6 } }, give: { radhija: 'corn' }, settle: 30 });
  await shot('35-radhija-com-milho', { pos: [-2.2, 0.55, 2.45], look: [-2.45, 0.32, 1.65] });
  await setup({ place: { rhaenyra: { x: -3.6, z: 1.6, yaw: 0.5 } }, give: { rhaenyra: 'pumpkin' }, settle: 30 });
  await shot('36-rhaenyra-com-abobora', { pos: [-3.25, 0.62, 2.5], look: [-3.55, 0.36, 1.65] });
  // larga o milho na horta: o arco, no chão, o porquinho comendo e cochilando
  await setup({ place: { radhija: { x: 2.4, z: 0.9, yaw: Math.PI / 2 } }, settle: 10 });
  await tap('KeyE');
  await step(8);
  await shot('37-largando-o-milho', { pos: [3.1, 0.7, 2.1], look: [2.9, 0.25, 0.9] });
  await until((i) => i.porcos.pigs.some((q) => q.state === 'eat'), 900);
  await step(240);
  p = await pigsAt();
  const e = p.find((q) => q.state === 'eat') || p[0];
  await shot('38-comendo-o-milho', { pos: [e.x + 0.85, 0.6, e.z + 0.9], look: [e.x, 0.15, e.z] });
  await until((i) => i.porcos.pigs.some((q) => q.state === 'nap'), 1500);
  await step(240);
  p = await pigsAt();
  const n = p.find((q) => q.state === 'nap') || p[0];
  await shot('39-cochilando', { pos: [n.x + 0.9, 0.7, n.z + 0.9], look: [n.x, 0.12, n.z] });
  await until((_, g) => g.debug.events('pig:shake').length > 0, 2400);
  await step(24);
  p = await pigsAt();
  const w = p.find((q) => q.state === 'wake') || n;
  await shot('40-acordou-se-sacudindo', { pos: [w.x + 0.9, 0.65, w.z + 0.9], look: [w.x, 0.2, w.z] });
  // o sininho: todos de volta
  await setup({ place: { radhija: { x: L.BELL.x + 0.05, z: L.BELL.z + 0.6, yaw: Math.PI } }, settle: 10 });
  await tap('KeyE');
  await step(20);
  await shot('41-sininho', { pos: [L.BELL.x + 0.9, 1.1, L.BELL.z + 1.6], look: [L.BELL.x, 0.7, L.BELL.z] });
  await setup({ place: { radhija: { x: 1.4, z: -1.0, yaw: Math.PI } }, settle: 2 });
  await until((i) => i.porcos.inPen === 3 && i.porcos.gateT < 0.05, 2400);
  await step(60);
  await shot('42-de-volta-ao-chiqueiro', { pos: [pc.x - 0.6, 1.6, pc.z + 2.6], look: [pc.x, 0.25, pc.z] });
  if (errors.length) throw new Error(`erros no navegador:\n${errors.join('\n')}`);
  console.log(`\n${shots} capturas de revisão; sem erros de console`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await closeBrowser(browser);
  await server?.close();
}
