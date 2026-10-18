// Capturas de revisão do Lambe-Lambe e da fase 7 em qualidade visual completa (sombras, bloom, resolução 1).
// Roda no GitHub Actions (E2E manual, suíte lambe), depois da partida; não usa a redução gráfica do harness.
// O laço do jogo fica congelado e o script avança quadro a quadro (1/60 s): cada imagem mostra o instante
// exato da animação (língua para fora, varrida, descida). Teclas reais chegam pelos ouvintes do jogo.
// Saída: shots/lambe-revisao/*.png. Erros do navegador reprovam o passo.
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/lambe-revisao';
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
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });
  await page.goto(`${url}?level=fase7&play`);
  await page.waitForFunction(() => window.__game?.game?.state === 'playing', null, { timeout: 180000 });
  await page.evaluate(() => {
    window.__freezeReview = true;
    document.getElementById('loading')?.remove();
    const G = window.__game;
    const rev = { t: 20 };
    window.__rev = rev;
    window.__step = (n = 1) => {
      for (let i = 0; i < n; i++) {
        rev.t += 1 / 60;
        G.game.update(1 / 60, rev.t);
        G.seeThrough();
        G.feedback.update(1 / 60, rev.t);
        G.particles.update(1 / 60);
      }
    };
    /** Avança até `src(info)` virar verdade (no máximo `max` quadros). */
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
  });
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  const until = async (pred, max = 600) => {
    const ok = await page.evaluate(({ src, max: m }) => window.__stepUntil(src, m), { src: pred.toString(), max });
    if (!ok) throw new Error(`condição não alcançada: ${pred}`);
  };
  const shot = async (name, cam = null) => {
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${name}.png`, style: '#ui, #loading { display: none !important; }' });
    shots++;
    console.log(`  captura: ${OUT}/${name}.png`);
  };
  /** Prepara uma cena: etapa, dog ativa e posições (teleporte só no preparo). */
  const setup = (opts) => page.evaluate((o) => {
    const g = window.__game.game;
    if (o.stage) g.debug.setStage(o.stage, o.active);
    if (o.active && g.activeDog !== o.active) {
      window.dispatchEvent(Object.assign(new KeyboardEvent('keydown', { code: 'KeyQ' })));
      window.__step(1);
      window.dispatchEvent(Object.assign(new KeyboardEvent('keyup', { code: 'KeyQ' })));
      window.__step(1);
    }
    for (const [name, p] of Object.entries(o.place || {})) {
      g.debug.teleport(name, p.x, p.z);
      g.debug.ctrls[name].yaw = p.yaw;
    }
    if (o.stay) g.setStay(o.stay, true);
    window.__step(o.settle ?? 20);
  }, opts);
  const L = await page.evaluate(() => {
    const l = window.__game.layout;
    return { TUNNEL: l.TUNNEL, SLIDE: l.SLIDE, SLIDE_ENTRY: l.SLIDE_ENTRY, GOAL: l.GOAL, GATE: l.GATE, LATCH: l.LATCH, MOUND: l.MOUND };
  });

  // 1. visão geral com a câmera do jogo
  await step(90);
  await shot('01-pracinha');
  // 2. a boca do túnel e a lama (de perto, olhando para dentro da manilha)
  await shot('02-boca-do-tunel', { pos: [L.TUNNEL.x1 + 1.35, 0.55, L.TUNNEL.z + 0.55], look: [L.TUNNEL.x1 - 0.4, 0.2, L.TUNNEL.z] });
  // 3. a Radhija dentro do túnel (câmera do jogo com o "ver através")
  await setup({ stage: 'start', active: 'radhija', place: { radhija: { x: (L.TUNNEL.x0 + L.TUNNEL.x1) / 2, z: L.TUNNEL.z, yaw: Math.PI / 2 }, rhaenyra: { x: L.TUNNEL.x0 - 0.7, z: L.TUNNEL.z + 0.4, yaw: Math.PI / 2 } }, stay: 'rhaenyra', settle: 60 });
  await shot('03-dentro-do-tunel');
  // 4. enlameada andando (pegadas de barro) e de perto
  await setup({ stage: 'inside', active: 'radhija', place: { radhija: { x: 0.2, z: -0.7, yaw: Math.PI / 2 } }, stay: 'rhaenyra' });
  await page.keyboard.down('KeyD');
  await step(70);
  await page.keyboard.up('KeyD');
  await step(25);
  const rad = await page.evaluate(() => { const c = window.__game.game.debug.ctrls.radhija; return { x: c.x, z: c.z }; });
  await shot('04-enlameada-pegadas', { pos: [rad.x + 0.2, 1.05, rad.z + 1.5], look: [rad.x - 0.35, 0.15, rad.z] });
  await shot('05-enlameada-de-perto', { pos: [rad.x + 0.75, 0.42, rad.z + 0.65], look: [rad.x, 0.26, rad.z] });
  // 6. Lambe-Lambe: a Rhaenyra ao lado da cabeça da Radhija, câmera de frente para as duas
  const C = { x: 1.0, z: -0.45 };
  await setup({ stage: 'muddy', active: 'rhaenyra', place: { radhija: { x: C.x, z: C.z, yaw: Math.PI / 2 }, rhaenyra: { x: C.x + 0.18, z: C.z - 0.62, yaw: Math.PI } }, stay: 'radhija', settle: 30 });
  const faceCam = { pos: [C.x + 1.25, 0.62, C.z - 0.05], look: [C.x + 0.12, 0.36, C.z - 0.28] };
  await page.keyboard.down('KeyR');
  await until((i) => i.lick.stage === 'licking' && i.lick.strokes >= 1 && i.lick.phase > 0.9, 400);
  // um ciclo inteiro em cinco instantes: língua saindo, encostando, varrendo, no alto e voltando
  const phases = [0.18, 0.34, 0.5, 0.64, 0.82];
  for (const [k, ph] of phases.entries()) {
    await until(new Function('i', `return i.lick.stage === 'licking' && i.lick.strokes >= 2 && i.lick.phase >= ${ph}`), 200);
    await shot(`06-lambe-lambe-${k + 1}`, faceCam);
  }
  await shot('07-lambe-lambe-de-lado', { pos: [C.x + 0.35, 0.75, C.z + 1.15], look: [C.x + 0.1, 0.3, C.z - 0.3] });
  // 8. a lama saindo em placas (meio do caminho) e limpinha (brilho + sacudida)
  await until((i) => i.lambe.mud.radhija.k <= 0.41, 600);
  await step(10);
  await shot('08-lama-saindo', faceCam);
  await until((i) => i.lambe.mud.radhija.k === 0, 600);
  await page.keyboard.up('KeyR');
  await step(8);
  await shot('09-sacudindo', faceCam);
  await step(40);
  await shot('10-limpinha-brilho', { pos: [C.x + 1.0, 0.55, C.z + 0.5], look: [C.x, 0.28, C.z] });
  // 11. escorregador: subindo com a arrancada, pegando o frisbee, descendo de barriga
  await setup({ stage: 'clean', active: 'radhija', place: { radhija: { x: L.SLIDE_ENTRY.minX - 0.25, z: L.SLIDE.z, yaw: Math.PI / 2 } }, stay: 'rhaenyra', settle: 20 });
  const sideCam = { pos: [(L.SLIDE.x0 + L.SLIDE.x1) / 2 + 0.3, 1.1, L.SLIDE.z + 2.1], look: [(L.SLIDE.x0 + L.SLIDE.x1) / 2 + 0.3, 0.55, L.SLIDE.z] };
  await page.keyboard.down('KeyD');
  await page.keyboard.press('ShiftLeft');
  await until((i) => !!i.lambe.slide, 60);
  await page.keyboard.up('KeyD');
  await until((i) => i.lambe.slide?.phase === 'up' && i.dogs.radhija.x > 2.5, 120);
  await shot('11-subindo', sideCam);
  await until((i) => i.lambe.slide?.phase === 'grab' && !!i.frisbee.holder, 120);
  await shot('12-pegou-o-frisbee', { pos: [L.SLIDE.x1 + 0.2, 1.75, L.SLIDE.z + 1.4], look: [L.SLIDE.x1 + 0.45, 1.15, L.SLIDE.z] });
  await until((i) => i.lambe.slide?.phase === 'down' && i.dogs.radhija.x < 2.6, 200);
  await shot('13-descendo-de-barriga', sideCam);
  await until((i) => !i.lambe.slide, 200);
  await step(10);
  await shot('14-chegou-embaixo');
  // 15. portão com o trinco e a plaquinha
  await shot('15-portao', { pos: [L.GATE.hinge.x + 0.5, 0.9, L.GATE.hinge.z + 1.6], look: [L.GATE.hinge.x + 0.5, 0.4, L.GATE.hinge.z - 0.2] });
  // 16. piquenique com os dois objetos (comemoração)
  await setup({ stage: 'done', active: 'radhija', settle: 2 });
  await step(150);
  await shot('16-piquenique');
  if (errors.length) throw new Error(`erros no navegador:\n${errors.join('\n')}`);
  console.log(`\n${shots} capturas de revisão; sem erros de console`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
}
