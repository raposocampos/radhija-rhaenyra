// Capturas de revisão da fase 10 (Festa no Quintal) em qualidade visual completa (sombras, bloom, resolução 1).
// Roda no GitHub Actions (E2E manual, suíte quintal), depois da partida. O laço do jogo fica congelado e o script
// avança quadro a quadro (1/60 s): cada imagem mostra um instante exato (a água subindo, as luzinhas acendendo em
// onda, o chapéu caindo do bolo, o quadro de perto, a gansa, o cheiro subindo pelo cano, o balde, o escorregador, a
// lama, a porta basculante, a rampa e o bolo pronto). Teclas reais chegam pelos ouvintes do jogo; teleporte, etapas e
// atalhos de depuração só preparam as cenas. Saída: shots/quintal-revisao/*.png.
import './lib/browser-log.mjs'; // antes do playwright-core: registro do Chromium em shots/diagnostico/
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/quintal-revisao';
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
  const { page, guard } = await openPage(browser, { viewport: { width: 1280, height: 720 } }, { name: 'quintal' });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });
  await page.goto(`${url}?level=fase10&play`);
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
    window.__tap = (code) => { window.__key(code, true); window.__step(1); window.__key(code, false); window.__step(1); };
  });
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  const until = async (pred, max = 900) => {
    const ok = await page.evaluate(({ src, max: m }) => window.__stepUntil(src, m), { src: pred.toString(), max });
    if (!ok) throw new Error(`condição não alcançada: ${pred}; ${await guard.peek()}`);
  };
  const tap = (code) => page.evaluate((c) => window.__tap(c), code);
  const keyDown = (code) => page.evaluate((c) => window.__key(c, true), code);
  const keyUp = (code) => page.evaluate((c) => window.__key(c, false), code);
  const shot = async (name, cam = null) => {
    await page.evaluate((c) => window.__render(c), cam);
    await page.screenshot({ path: `${OUT}/${name}.png`, style: '#ui, #loading { display: none !important; }' });
    shots++;
    guard.note(`captura ${name}`);
    console.log(`  captura: ${OUT}/${name}.png`);
  };
  /** Etapa, dog ativa, posições (teleporte só no preparo), atalhos de estado e o Fica. */
  const setup = (o) => page.evaluate((opts) => {
    const g = window.__game.game;
    if (opts.stage) g.debug.setStage(opts.stage, opts.active);
    if (opts.active && g.activeDog !== opts.active) window.__tap('KeyQ');
    for (const [name, p] of Object.entries(opts.place || {})) {
      g.debug.teleport(name, p.x, p.z);
      g.debug.ctrls[name].yaw = p.yaw;
    }
    for (const [id, x, z] of opts.crates || []) g.puzzle.placeCrate(id, x, z);
    for (const [key, value] of opts.set || []) g.puzzle.debugSet(key, value);
    if (opts.stay) g.setStay(opts.stay, true);
    window.__step(opts.settle ?? 20);
  }, o);
  const L = await page.evaluate(() => {
    const l = window.__game.layout;
    return {
      TAP: l.TAP, BREAKER: l.BREAKER, CRATE: l.CRATE, BOAT: l.BOAT, POOL: l.POOL, GOAL: l.GOAL, CAKE: l.CAKE, PAINTING: l.PAINTING,
      CORD: l.CORD, GATE: l.GATE, TUBE: l.TUBE, PIGEON: l.PIGEON, BUCKET: l.BUCKET, ROPE: l.ROPE, DECK: l.DECK, SLIDE: l.SLIDE,
      HORTA: l.HORTA, MUD: l.MUD, PLATE: l.PLATE, SHED: l.SHED, RAMP: l.RAMP, CANDLE: l.CANDLE, FAN: l.FAN, TREE: l.TREE,
    };
  });
  const kick = (c) => ({ x: c.x + c.nx * 0.6 - c.nz * 0.14, z: c.z + c.nz * 0.6 + c.nx * 0.14, yaw: Math.atan2(-c.nx, -c.nz) });
  const cakeCam = { pos: [L.CAKE.x + 0.9, 1.45, L.CAKE.z + 1.6], look: [L.CAKE.x, 0.95, L.CAKE.z] };
  const poolCam = { pos: [L.POOL.x + 1.4, 2.0, L.POOL.z + 2.4], look: [L.POOL.x - 0.2, 0.2, L.POOL.z - 0.3] };

  // 0. a apresentação com a câmera do jogo: o bolo vazio e o quadro da festa do ano passado
  await step(80);
  await shot('00a-apresentacao-bolo');
  await step(175);
  await shot('00b-apresentacao-quadro');
  await step(230);
  // 1. os cenários: a sala com a câmera do jogo e de cima; cada canto de perto
  await shot('01-sala-camera-do-jogo');
  await shot('02-visao-geral', { pos: [0, 13.5, 10.5], look: [0, 0.3, -1.0] });
  await shot('02b-visao-casa-e-varanda', { pos: [-4.5, 7.0, 6.0], look: [-5.0, 0.4, -2.6] });
  await shot('02c-visao-fundo', { pos: [8.5, 7.5, 5.5], look: [8.4, 0.6, -1.2] });
  await shot('03-quadro-de-perto', { pos: [L.PAINTING.x, L.PAINTING.y - 0.05, L.PAINTING.z + 1.5], look: [L.PAINTING.x, L.PAINTING.y, L.PAINTING.z] });
  await shot('04-sala', { pos: [-8.8, 1.6, 0.9], look: [-10.4, 0.8, -3.4] });
  await shot('05-cozinha', { pos: [-5.6, 1.6, 0.6], look: [-7.0, 0.9, -4.0] });
  await shot('06-varanda-e-bolo', { pos: [-0.6, 1.9, -0.9], look: [-2.4, 1.0, -4.4] });
  await shot('06b-bolo-de-perto', cakeCam);
  await shot('06c-faixa-feliz-3-anos', { pos: [-2.4, 1.7, 0.2], look: [-2.4, 2.1, -2.75] });
  await shot('07-piscininha-e-barquinho', poolCam);
  await shot('07b-torneira-mangueira-caixote', { pos: [-2.4, 1.5, 0.9], look: [-3.9, 0.5, -0.9] });
  await shot('07c-ventilador-e-tomada', { pos: [-2.4, 1.2, 2.4], look: [-3.6, 0.5, 0.4] });
  await shot('08-portaozinho-e-cordinha', { pos: [3.6, 1.4, 1.6], look: [L.CORD.x, 0.5, L.CORD.z] });
  await shot('09-casa-na-arvore', { pos: [9.6, 3.0, 0.4], look: [8.6, 1.9, -4.2] });
  await shot('09b-pombo-e-laco', { pos: [8.2, 2.7, -2.6], look: [8.0, 2.35, -3.95] });
  await shot('09c-funil-e-cano', { pos: [6.9, 1.2, -1.6], look: [6.9, 0.8, -3.6] });
  await shot('09d-roldana-e-balde', { pos: [11.0, 1.8, -1.6], look: [10.0, 1.2, -3.6] });
  await shot('09e-escorregador', { pos: [11.6, 2.0, -2.8], look: [10.5, 0.9, -5.2] });
  await shot('10-horta', { pos: [7.4, 1.8, 4.2], look: [8.0, 0.2, 1.6] });
  await shot('10b-vao-e-lama', { pos: [6.2, 1.1, 2.6], look: [7.2, 0.15, 1.6] });
  await shot('11-galpao', { pos: [10.4, 2.3, 4.6], look: [10.6, 0.5, 1.8] });
  await shot('11b-rampa-e-vela', { pos: [10.2, 1.5, 4.0], look: [11.2, 0.9, 3.0] });
  // a câmera do jogo em cada cenário
  await setup({ active: 'radhija', place: { radhija: { x: -2.0, z: -2.2, yaw: Math.PI }, rhaenyra: { x: -1.2, z: -2.0, yaw: 3 } }, settle: 120 });
  await shot('12-varanda-camera-do-jogo');
  await setup({ active: 'radhija', place: { radhija: { x: -0.4, z: 1.6, yaw: Math.PI }, rhaenyra: { x: 0.4, z: 1.8, yaw: 3 } }, settle: 120 });
  await shot('12b-quintal-camera-do-jogo');
  await setup({ set: [['gate', true]], active: 'radhija', place: { radhija: { x: 8.4, z: -2.4, yaw: Math.PI }, rhaenyra: { x: 7.4, z: -2.0, yaw: 3 } }, settle: 150 });
  await shot('12c-casa-na-arvore-camera-do-jogo');
  await setup({ active: 'radhija', place: { radhija: { x: 8.2, z: 2.6, yaw: Math.PI / 2 }, rhaenyra: { x: 8.9, z: 1.0, yaw: 3 } }, settle: 120 });
  await shot('12d-horta-camera-do-jogo');

  // 2. CHAPÉU: o caixote na mangueira, a torneira, a água subindo, o disjuntor e as luzinhas em onda
  await setup({ stage: 'start', active: 'rhaenyra', place: { rhaenyra: kick(L.TAP), radhija: { x: -5.0, z: 1.6, yaw: 0 } }, stay: 'radhija' });
  await tap('Space');
  await until((i) => (i.dogs.rhaenyra.wall?.k ?? 0) >= 0.52, 120);
  await shot('13-impulso-na-torneira', { pos: [L.TAP.x + 1.6, 1.3, L.TAP.z + 1.3], look: [L.TAP.x + 0.2, 0.9, L.TAP.z] });
  await until((i) => !i.dogs.rhaenyra.wall, 120);
  await step(40);
  await shot('13b-mangueira-esmagada', { pos: [-2.6, 1.2, 0.4], look: [-3.6, 0.3, -0.9] });
  await setup({ crates: [['caixote', L.CRATE.start.x, 0.1]], settle: 90 });
  await shot('14-agua-correndo', poolCam);
  await until((i) => i.quintal.water > 0.5, 600);
  await shot('14b-agua-subindo', poolCam);
  await until((i) => i.quintal.full, 600);
  await step(30);
  await shot('14c-piscininha-cheia', poolCam);
  const lightsCam = { pos: [0.6, 3.2, 1.2], look: [-2.0, 1.6, -3.6] };
  await setup({ active: 'rhaenyra', place: { rhaenyra: kick(L.BREAKER) } });
  await shot('15-festa-sem-luz', lightsCam);
  await tap('Space');
  await until((i) => (i.dogs.rhaenyra.wall?.k ?? 0) >= 0.52, 120);
  await shot('15b-impulso-no-disjuntor', { pos: [L.BREAKER.x + 1.5, 1.4, L.BREAKER.z + 1.2], look: [L.BREAKER.x + 0.2, 1.0, L.BREAKER.z] });
  await until((i) => i.quintal.power, 200);
  await step(25);
  await shot('15c-pulso-no-conduite', { pos: [-5.2, 2.6, -1.8], look: [-5.6, 2.2, -5.6] });
  await step(40);
  await shot('15d-luzinhas-em-onda', lightsCam);
  await step(90);
  await shot('15e-festa-iluminada', lightsCam);
  await shot('15f-ventilador-soprando', poolCam);
  await until((i) => i.quintal.boat.docked, 400);
  await step(20);
  await shot('16-barquinho-na-borda', poolCam);
  await setup({ active: 'radhija', place: { radhija: { x: L.BOAT.dock.x + 0.65, z: L.BOAT.dock.z, yaw: -Math.PI / 2 } } });
  await tap('KeyE');
  await step(30);
  await shot('16b-chapeuzinho-na-boca', { pos: [L.BOAT.dock.x + 1.6, 0.9, L.BOAT.dock.z + 1.2], look: [L.BOAT.dock.x + 0.6, 0.35, L.BOAT.dock.z] });

  // 3. fora de ordem: o chapéu balança e cai; o quadro de perto com a câmera do jogo
  await setup({ place: { radhija: { x: L.GOAL.x + 0.1, z: L.GOAL.z + 1.0, yaw: Math.PI } }, settle: 2 });
  await step(14);
  await shot('17-chapeu-balancando', cakeCam);
  await step(40);
  await shot('17b-chapeu-caindo', cakeCam);
  await step(40);
  await shot('17c-chapeu-na-grama', cakeCam);
  await setup({ place: { radhija: { x: L.PAINTING.x, z: L.PAINTING.z + 0.95, yaw: Math.PI } } });
  await tap('KeyE');
  await step(70);
  await shot('18-quadro-camera-do-jogo');

  // 4. LAÇO: a gansa atraída, a cordinha, o portão abrindo; o cheiro pelo cano e o pombo voando
  await setup({ stage: 'start', active: 'radhija', place: { radhija: { x: 1.8, z: 1.4, yaw: Math.PI / 2 }, rhaenyra: { x: 4.6, z: -1.4, yaw: Math.PI / 2 } }, stay: 'rhaenyra' });
  await tap('KeyE');
  await step(50);
  await shot('19-gansa-atraida', { pos: [3.0, 2.2, 3.2], look: [3.4, 0.3, 0.0] });
  await setup({ active: 'rhaenyra', place: { rhaenyra: { x: L.CORD.x - 0.48, z: L.CORD.z - 0.06, yaw: Math.PI / 2 } } });
  await tap('KeyE');
  await step(14);
  await shot('20-puxando-a-cordinha', { pos: [L.CORD.x - 1.4, 1.2, L.CORD.z + 1.3], look: [L.CORD.x, 0.6, L.CORD.z] });
  await step(50);
  await shot('20b-portao-aberto', { pos: [3.8, 1.6, 2.0], look: [5.6, 0.5, 0.1] });
  await setup({ active: 'radhija', place: { radhija: { x: L.TUBE.inlet.x, z: L.TUBE.inlet.z + 0.85, yaw: Math.PI } }, settle: 30 });
  await keyDown('KeyR');
  await step(18);
  await keyUp('KeyR');
  await step(16);
  await shot('21-superbafo-no-funil', { pos: [L.TUBE.inlet.x + 1.3, 1.3, L.TUBE.inlet.z + 1.8], look: [L.TUBE.inlet.x, 0.6, L.TUBE.inlet.z] });
  await until((i) => (i.scent?.clouds || []).some((c) => c.state === 'duct'), 300);
  await step(45);
  await shot('21b-cheiro-subindo-pelo-cano', { pos: [7.6, 1.8, -1.6], look: [7.1, 1.3, -3.9] });
  await until((i) => i.quintal.pigeon !== 'asleep', 300);
  await step(30);
  await shot('22-pombo-voando', { pos: [8.4, 2.6, -1.5], look: [8.6, 2.8, -4.4] });

  // 5. o balde: a Radhija dentro, a Rhaenyra puxando, o deque, o laço e o escorregador
  await setup({ set: [['pigeon', true]], active: 'radhija', place: { radhija: { x: L.BUCKET.x, z: L.BUCKET.z + 0.7, yaw: Math.PI } } });
  await tap('KeyE');
  await step(40);
  await shot('23-no-balde', { pos: [L.BUCKET.x + 1.2, 1.2, L.BUCKET.z + 1.6], look: [L.BUCKET.x, 0.4, L.BUCKET.z] });
  await setup({ active: 'rhaenyra', place: { rhaenyra: { x: L.ROPE.rest.x, z: L.ROPE.rest.z + 0.5, yaw: Math.PI } } });
  await tap('KeyE');
  // anda para longe da árvore com a corda (teclas reais, para o sul)
  await keyDown('KeyS');
  await step(40);
  await shot('24-puxando-a-corda-camera-do-jogo');
  await until((i) => !!i.quintal.deck, 400);
  await keyUp('KeyS');
  await shot('24b-balde-la-em-cima-camera-do-jogo');
  await shot('24c-balde-la-em-cima', { pos: [10.6, 2.6, -1.2], look: [9.6, 2.0, -4.0] });
  await until((i) => i.quintal.deck === 'grab', 300);
  await step(20);
  await shot('25-desamarrando-o-laco', { pos: [8.8, 2.9, -2.6], look: [8.4, 2.25, -4.1] });
  await until((i) => i.quintal.deck === 'slide', 300);
  await step(30);
  await shot('26-escorregando', { pos: [12.0, 1.6, -3.4], look: [10.6, 1.0, -5.2] });
  await until((i) => !i.quintal.deck, 300);

  // 6. VELA: a lama, o Lambe-Lambe, a placa e a porta, a rampa
  await setup({ stage: 'cake1', active: 'radhija', place: { radhija: { x: L.MUD.x0 + 0.5, z: (L.MUD.z0 + L.MUD.z1) / 2, yaw: Math.PI / 2 }, rhaenyra: { x: 8.4, z: 2.0, yaw: -Math.PI / 2 } }, settle: 60 });
  await shot('27-radhija-na-lama', { pos: [7.9, 1.1, 2.8], look: [7.3, 0.25, 1.6] });
  await setup({ place: { radhija: { x: 8.1, z: 1.85, yaw: Math.PI / 2 } }, settle: 30 });
  await setup({ active: 'rhaenyra', place: { rhaenyra: { x: 8.9, z: 1.9, yaw: -Math.PI / 2 } }, stay: 'radhija', settle: 10 });
  await keyDown('KeyR');
  await step(70);
  await shot('28-lambe-lambe', { pos: [8.6, 1.0, 3.0], look: [8.4, 0.35, 1.8] });
  await until((i) => i.quintal.mud.k === 0, 600);
  await keyUp('KeyR');
  await setup({ place: { rhaenyra: { x: L.PLATE.x, z: L.PLATE.z, yaw: Math.PI / 2 } }, settle: 70 });
  await shot('29-porta-basculante-aberta', { pos: [8.3, 1.5, 3.4], look: [9.3, 0.6, 1.6] });
  await setup({ active: 'radhija', place: { radhija: { x: 9.8, z: L.RAMP.z - 0.05, yaw: Math.PI / 2 } }, settle: 10 });
  await tap('ShiftLeft');
  await until((i) => i.quintal.ramp === 'up', 60);
  await step(18);
  await shot('30-arrancada-na-rampa', { pos: [10.3, 1.4, 4.3], look: [10.8, 0.7, 3.0] });
  await until((i) => i.quintal.ramp === 'grab', 200);
  await step(16);
  await shot('30b-pegando-a-vela', { pos: [10.9, 1.7, 4.1], look: [11.4, 1.1, 3.05] });
  await until((i) => !i.quintal.ramp, 300);

  // 7. o bolo na ordem do quadro e a comemoração
  await setup({ stage: 'cake2', settle: 30 });
  await shot('31-bolo-quase-pronto', cakeCam);
  await setup({ stage: 'done', settle: 2 });
  await step(90);
  await shot('32-bolo-pronto', cakeCam);
  await step(60);
  await shot('33-comemoracao');
  if (errors.length) throw new Error(`erros no navegador:\n${errors.join('\n')}`);
  console.log(`\n${shots} capturas de revisão; sem erros de console`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await closeBrowser(browser);
  await server?.close();
}
