// Capturas de revisão da fase 10 (Festa no Quintal) em qualidade visual completa (sombras, bloom, resolução 1).
// Roda no GitHub Actions (E2E manual, suíte quintal), depois da partida. O laço do jogo fica congelado e o script
// avança quadro a quadro (1/60 s): cada imagem mostra um instante exato (a água subindo, as luzinhas do quadro e da
// festa acendendo em onda, o chapéu caindo do bolo, o quadro de perto, a gansa, o pombo em cima do laço, o cheiro
// subindo pelo cano, o balde, o deque, o escorregador, os caixotes da despensa, o gerador e o painel dos botões, a
// lama, a porta do galpão e o chiqueiro, a rampa, o campinho, as galinhas, a piñata e o bolo pronto). Teclas reais chegam pelos ouvintes do jogo; teleporte,
// etapas e atalhos de depuração só preparam as cenas. Saída: shots/quintal-revisao/*.png.
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
  await page.goto(`${url}?level=fase10&play&botao=1`);
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
    // teclas (8 direções relativas à câmera) para andar na direção (dx, dz) do mundo, como nos testes
    window.__keysFor = (dx, dz) => {
      const B = G.game.debug.cam.basis();
      const fwd = dx * B.fx + dz * B.fz, rgt = dx * B.rx + dz * B.rz;
      const k = ((Math.round(Math.atan2(rgt, fwd) / (Math.PI / 4)) % 8) + 8) % 8;
      return [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyW', 'KeyA']][k];
    };
  });
  const step = (n) => page.evaluate((k) => window.__step(k), n);
  const until = async (pred, max = 900) => {
    const ok = await page.evaluate(({ src, max: m }) => window.__stepUntil(src, m), { src: pred.toString(), max });
    if (!ok) throw new Error(`condição não alcançada: ${pred}; ${await guard.peek()}`);
  };
  const tap = (code) => page.evaluate((c) => window.__tap(c), code);
  const keyDown = (code) => page.evaluate((c) => window.__key(c, true), code);
  const keyUp = (code) => page.evaluate((c) => window.__key(c, false), code);
  /** Segura o direcional para (dx, dz) do mundo até `pred` (puxando uma corda de ré, por exemplo). */
  const holdDir = async (dx, dz, pred, max = 300) => {
    const keys = await page.evaluate(([x, z]) => window.__keysFor(x, z), [dx, dz]);
    for (const k of keys) await keyDown(k);
    try {
      await until(pred, max);
    } finally {
      for (const k of keys) await keyUp(k);
    }
  };
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
      HORTA: l.HORTA, MUD: l.MUD, SHED: l.SHED, RAMP: l.RAMP, CANDLE: l.CANDLE, FAN: l.FAN, TREE: l.TREE,
      DECK_PATH: l.DECK_PATH, HUT: l.HUT, SOFA: l.SOFA, COLLECTIBLES: l.COLLECTIBLES, HOUSE: l.HOUSE,
      CUPBOARD: l.CUPBOARD, PANTRY_CRATES: l.PANTRY_CRATES, CHICKENS: l.CHICKENS, MANGO_SHOVE: l.MANGO_SHOVE, PANTRY: l.PANTRY, PLANTATION: l.PLANTATION, ROSE_BUSH: l.ROSE_BUSH, STY: l.STY,
      SHED_BUTTONS: l.SHED_BUTTONS, SECRET: l.SECRET, EAST_WALL: l.EAST_WALL, DOG_BOWLS: l.DOG_BOWLS,
      GENERATOR: l.GENERATOR, BUTTON_BOARD: l.BUTTON_BOARD,
    };
  });
  const kick = (c) => ({ x: c.x + c.nx * 0.5 - c.nz * 0.14, z: c.z + c.nz * 0.5 + c.nx * 0.14, yaw: Math.atan2(-c.nx, -c.nz) });
  const cakeCam = { pos: [L.CAKE.x + 0.9, 1.45, L.CAKE.z + 1.6], look: [L.CAKE.x, 0.95, L.CAKE.z] };
  const poolCam = { pos: [L.POOL.x + 1.4, 2.0, L.POOL.z + 2.4], look: [L.POOL.x - 0.2, 0.2, L.POOL.z - 0.3] };

  // 0. a apresentação com a câmera do jogo: só o bolo vazio (o quadro fica para o E na frente dele)
  await step(80);
  await shot('00a-apresentacao-bolo');
  await step(175);
  await shot('00b-depois-da-apresentacao');
  await step(230);
  // 1. os cenários: a sala com a câmera do jogo e de cima; cada canto de perto
  await shot('01-sala-camera-do-jogo');
  await shot('02-visao-geral', { pos: [0, 13.5, 10.5], look: [0, 0.3, -1.0] });
  await shot('02b-visao-casa-e-varanda', { pos: [-4.5, 7.0, 6.0], look: [-5.0, 0.4, -2.6] });
  await shot('02c-visao-fundo', { pos: [8.5, 7.5, 5.5], look: [8.4, 0.6, -1.2] });
  await shot('02d-visao-campinho-e-despensa', { pos: [-8.0, 8.0, 9.5], look: [-8.0, 0.3, 2.6] });
  await shot('02e-visao-horta-galpao-chiqueiro', { pos: [9.0, 8.5, 10.0], look: [9.6, 0.3, 3.4] });
  await shot('02f-roseira-e-mangueira', { pos: [1.6, 2.0, 7.4], look: [1.8, 1.3, 4.4] });
  await shot('03b-potes-de-racao-e-agua', { pos: [L.DOG_BOWLS.x + 0.9, 1.1, L.DOG_BOWLS.z + 1.4], look: [L.DOG_BOWLS.x, 0.1, L.DOG_BOWLS.z] });
  await shot('04c-despensa', { pos: [L.PANTRY.x0 + 0.6, 1.55, L.PANTRY.zS - 0.25], look: [L.CUPBOARD.x, 0.6, L.CUPBOARD.z + 0.5] });
  await shot('04d-armario-caixotes-e-marcas', { pos: [L.CUPBOARD.x + 0.75, 1.4, L.CUPBOARD.z + 1.85], look: [L.CUPBOARD.x - 0.4, 0.35, L.CUPBOARD.z + 0.55] });
  await shot('04e-galinhas-no-campinho', { pos: [(L.CHICKENS.area.minX + L.CHICKENS.area.maxX) / 2 + 0.6, 3.0, L.CHICKENS.area.maxZ + 0.9], look: [(L.CHICKENS.area.minX + L.CHICKENS.area.maxX) / 2, 0.15, (L.CHICKENS.area.minZ + L.CHICKENS.area.maxZ) / 2] });
  await shot('10e-campinho-milho-cenouras-aboboras', { pos: [-8.6, 1.7, 7.2], look: [-10.0, 0.4, 4.3] });
  await shot('10f-botoes-do-galpao-e-chiqueiro', { pos: [7.4, 1.7, 4.6], look: [9.6, 0.8, 2.6] });
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
  await shot('04b-sofa-e-o-vao-atras', { pos: [-9.7, 2.6, 0.7], look: [-10.3, 0.1, -0.7] });
  await shot('08b-portao-fechado-do-fundo', { pos: [6.9, 1.6, 2.6], look: [5.6, 0.4, 0.6] });
  await shot('09-casa-na-arvore', { pos: [8.6, 3.4, 1.2], look: [8.2, 1.9, -4.4] });
  await shot('09b-pombo-em-cima-do-laco', { pos: [8.95, 2.75, -2.45], look: [L.PIGEON.x, L.PIGEON.y - 0.05, L.PIGEON.z] });
  await shot('09c-funil-e-cano', { pos: [7.1, 1.4, -1.0], look: [8.1, 0.9, -3.3] });
  await shot('09c2-funil-na-altura-das-dogs', { pos: [L.TUBE.inlet.x + 0.5, 0.55, L.TUBE.inlet.z + 1.3], look: [L.TUBE.inlet.x, 0.3, L.TUBE.inlet.z] });
  await shot('09d-roldana-e-balde', { pos: [5.9, 1.9, -0.9], look: [L.BUCKET.x, 1.3, L.BUCKET.z] });
  await shot('09e-escorregador', { pos: [11.0, 1.9, -0.4], look: [9.4, 0.9, -2.6] });
  await shot('09f-deque-visto-de-cima', { pos: [8.2, 5.6, -1.4], look: [8.2, L.DECK.h, -4.8] });
  await shot('09g-casinha-luneta-e-bau', { pos: [7.9, 3.2, -3.0], look: [8.6, 2.4, -5.4] });
  await shot('10-horta', { pos: [7.4, 1.8, 4.2], look: [8.0, 0.2, 1.6] });
  await shot('10b-vao-e-lama', { pos: [6.3, 1.2, 6.4], look: [7.3, 0.15, 5.1] });
  await shot('10c-painel-e-gerador', { pos: [L.BUTTON_BOARD.x + 1.8, 1.3, L.GENERATOR.z + 1.0], look: [L.BUTTON_BOARD.x + 0.1, 0.75, (L.BUTTON_BOARD.z0 + L.BUTTON_BOARD.z1) / 2 + 0.3] });
  await shot('11-galpao', { pos: [10.4, 2.3, 4.6], look: [10.6, 0.5, 1.8] });
  await shot('11b-rampa-e-vela', { pos: [10.2, 1.5, 4.0], look: [11.2, 0.9, 3.0] });
  // a câmera do jogo em cada cenário
  await setup({ active: 'radhija', place: { radhija: { x: -2.0, z: -2.2, yaw: Math.PI }, rhaenyra: { x: -1.2, z: -2.0, yaw: 3 } }, settle: 120 });
  await shot('12-varanda-camera-do-jogo');
  // a saída da porta da varanda para o quintal (o canto livre, sem vaso)
  await setup({ active: 'radhija', place: { radhija: { x: -3.9, z: -2.9, yaw: 2.6 }, rhaenyra: { x: -3.4, z: -3.6, yaw: 2.4 } }, settle: 60 });
  await shot('12a-saida-da-porta-da-varanda', { pos: [-2.6, 1.6, -0.6], look: [-4.3, 0.4, -3.2] });
  await setup({ active: 'radhija', place: { radhija: { x: -0.4, z: 1.6, yaw: Math.PI }, rhaenyra: { x: 0.4, z: 1.8, yaw: 3 } }, settle: 120 });
  await shot('12b-quintal-camera-do-jogo');
  // a primeira vez no fundo do quintal: a câmera mostra o pombo dormindo em cima do laço
  await setup({ set: [['gate', true]], active: 'radhija', place: { radhija: { x: 7.6, z: -1.6, yaw: Math.PI }, rhaenyra: { x: 6.8, z: -1.2, yaw: 3 } }, settle: 75 });
  await shot('12c-pombo-em-cima-do-laco-camera-do-jogo');
  await step(200);
  await shot('12c2-casa-na-arvore-camera-do-jogo');
  await setup({ active: 'radhija', place: { radhija: { x: L.SOFA.x - 0.78, z: (L.SOFA.z + L.SOFA.hz + L.HOUSE.zS - 0.1) / 2 + 0.02, yaw: -Math.PI / 2 }, rhaenyra: { x: -9.0, z: -2.2, yaw: 3 } }, settle: 90 });
  await shot('12e-atras-do-sofa-camera-do-jogo');
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
  await shot('15c-pulso-no-conduite', { pos: [-8.6, 2.4, -2.4], look: [-8.6, 2.0, -5.9] });
  // a energia chega primeiro nas luzinhas em volta do quadro (com a câmera do jogo), depois segue para a varanda
  await until((i) => i.quintal.powerStage === 'painting', 200);
  await step(45);
  await shot('15d-ramal-do-quadro-camera-do-jogo');
  await step(50);
  await shot('15d2-luzinhas-do-quadro-camera-do-jogo');
  await shot('15d3-quadro-iluminado', { pos: [L.PAINTING.x + 0.2, L.PAINTING.y - 0.1, L.PAINTING.z + 1.9], look: [L.PAINTING.x, L.PAINTING.y, L.PAINTING.z] });
  await until((i) => i.quintal.powerStage === 'porch', 300);
  await step(40);
  await shot('15e-camera-vai-para-a-varanda');
  await until((i) => i.quintal.powerStage === 'on', 200);
  await step(30);
  await shot('15f-luzinhas-em-onda', lightsCam);
  await step(90);
  await shot('15g-festa-iluminada', lightsCam);
  await shot('15h-ventilador-soprando', poolCam);
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
  // ela anda até a cordinha e morde; puxando de ré (para longe da cerca), o portãozinho vem junto, para o quintal
  await tap('KeyE');
  await until((i) => i.quintal.cord.phase === 'hold', 200);
  await holdDir(-1, 0, (i) => i.quintal.gate.t > 0.15, 200);
  await shot('20-puxando-a-cordinha', { pos: [L.CORD.x - 1.4, 1.2, L.CORD.z + 1.3], look: [L.CORD.x, 0.6, L.CORD.z] });
  await holdDir(-1, 0, (i) => i.quintal.gateOpen, 200);
  await step(50);
  await shot('20b-portao-aberto', { pos: [3.8, 1.6, 2.0], look: [5.6, 0.5, 0.1] });
  await shot('20b2-portao-aberto-encostado', { pos: [6.9, 1.6, 2.6], look: [5.6, 0.4, 0.6] });
  // com o pombo lá em cima: o balde chega, ele acorda e bate as asas em cima do laço (ela fica no balde)
  await setup({ active: 'radhija', place: { radhija: { x: L.BUCKET.x, z: L.BUCKET.z + 0.7, yaw: Math.PI } }, settle: 10 });
  await tap('KeyE');
  await until((i) => i.quintal.bucket.riding, 80);
  await setup({ active: 'rhaenyra', place: { rhaenyra: { x: L.ROPE.rest.x, z: L.ROPE.rest.z + 0.5, yaw: Math.PI } }, settle: 10 });
  await tap('KeyE');
  await keyDown('KeyS');
  await until((i) => i.quintal.bucket.y >= window.__game.layout.BUCKET.top - 0.02, 500);
  await keyUp('KeyS');
  await step(14);
  await shot('20c-pombo-nao-deixa-subir', { pos: [6.3, 3.3, -0.6], look: [7.8, 2.3, -3.6] });
  await tap('KeyE'); // a Rhaenyra solta a corda
  await until((i) => i.quintal.bucket.y === 0, 400);
  await tap('KeyQ');
  await step(20);
  await tap('KeyE'); // a Radhija sai do balde
  await until((i) => !i.quintal.bucket.riding && i.dogs.radhija.y === 0, 120); // o pulinho para fora terminou
  await setup({ active: 'radhija', place: { radhija: { x: L.TUBE.inlet.x, z: L.TUBE.inlet.z + 0.85, yaw: Math.PI } }, settle: 30 });
  await keyDown('KeyR');
  await step(18);
  await keyUp('KeyR');
  await step(16);
  await shot('21-superbafo-no-funil', { pos: [L.TUBE.inlet.x + 1.3, 1.0, L.TUBE.inlet.z + 1.8], look: [L.TUBE.inlet.x, 0.3, L.TUBE.inlet.z] });
  await until((i) => (i.scent?.clouds || []).some((c) => c.state === 'duct'), 300);
  await step(45);
  await shot('21b-cheiro-subindo-pelo-cano', { pos: [7.6, 1.8, -1.6], look: [7.1, 1.3, -3.9] });
  await until((i) => i.quintal.pigeon !== 'asleep', 300);
  await step(30);
  await shot('22-pombo-voando', { pos: [8.6, 2.6, -1.3], look: [9.2, 3.0, -4.4] });

  // 5. o balde: a Radhija dentro, a Rhaenyra puxando, o deque, o laço e o escorregador
  const bucketCam = { pos: [L.BUCKET.x - 1.0, 1.2, L.BUCKET.z + 1.7], look: [L.BUCKET.x, 0.3, L.BUCKET.z] };
  await setup({ set: [['pigeon', true]], active: 'radhija', place: { radhija: { x: L.BUCKET.x, z: L.BUCKET.z + 0.7, yaw: Math.PI } } });
  await shot('23-balde-deitado', bucketCam);
  await tap('KeyE');
  await step(40);
  await shot('23a-entrando-no-balde', bucketCam);
  await until((i) => i.quintal.bucket.riding, 90);
  await step(10);
  await shot('23b-deitada-no-balde', bucketCam);
  await setup({ active: 'rhaenyra', place: { rhaenyra: { x: L.ROPE.rest.x, z: L.ROPE.rest.z + 0.5, yaw: Math.PI } } });
  await tap('KeyE');
  // anda para longe do balde com a corda (teclas reais, para o sul): primeiro o balde fica em pé
  await keyDown('KeyS');
  await until((i) => i.quintal.bucket.tilt < 0.55, 200);
  await shot('23c-balde-levantando', bucketCam);
  await step(30);
  await shot('24-puxando-a-corda-camera-do-jogo');
  await until((i) => i.quintal.deck === 'hop', 400);
  await keyUp('KeyS');
  // sentada no balde, ela se apoia (agacha) e salta por cima da borda para o deque
  await step(12);
  await shot('24b-se-apoiando-no-balde', { pos: [5.9, 3.1, -0.9], look: [7.1, 2.2, -3.7] });
  await step(24);
  await shot('24b2-pulando-para-o-deque', { pos: [5.9, 3.1, -0.9], look: [7.1, 2.2, -3.7] });
  await until((i) => i.quintal.onDeck, 120);
  // lá em cima quem anda é o jogador (troca para a Radhija)
  await tap('KeyQ');
  await step(70);
  await shot('24c-no-deque-camera-do-jogo');
  await setup({ place: { radhija: { x: L.DECK_PATH.ribbon.x - 0.05, z: L.DECK_PATH.ribbon.z, yaw: 0 } }, settle: 40 });
  await shot('25-perto-do-laco-camera-do-jogo');
  await tap('KeyE');
  await until((i) => i.quintal.deck === 'untie', 30);
  await step(30);
  await shot('25b-desamarrando-o-laco', { pos: [8.95, 2.95, -2.3], look: [8.6, 2.3, -3.8] });
  await until((i) => i.quintal.deck === 'free', 120);
  await step(10);
  await shot('25c-laco-na-boca-camera-do-jogo');
  await setup({ place: { radhija: { x: L.DECK_PATH.slideTop.x - 0.1, z: L.DECK_PATH.slideTop.z, yaw: Math.PI / 2 } }, settle: 30 });
  await shot('25d-boca-do-escorregador-camera-do-jogo');
  await tap('KeyE');
  await until((i) => i.quintal.deck === 'slide', 60);
  await step(28);
  await shot('26-escorregando', { pos: [10.9, 1.7, -0.6], look: [9.4, 1.0, -2.6] });
  await until((i) => !i.quintal.deck, 300);
  await step(20);
  await shot('26b-no-gramado-com-o-laco-camera-do-jogo');

  // 6. VELA: o gerador e o painel ao lado da cerca branca, o botão alto e a porta, o vão lá no fundo, a lama, o
  // Lambe-Lambe e a rampa
  const GEN = L.GENERATOR, BB = L.BUTTON_BOARD;
  const genCam = { pos: [GEN.x + 1.4, 1.0, GEN.z + 0.9], look: [GEN.x + 0.1, 0.55, GEN.z - 0.55] };
  await setup({ stage: 'cake1', active: 'rhaenyra', place: { rhaenyra: { x: GEN.cord.x + 0.3, z: GEN.cord.z, yaw: -Math.PI / 2 }, radhija: { x: 6.5, z: 1.6, yaw: Math.PI } }, stay: 'radhija', settle: 40 });
  await shot('27a-painel-apagado-camera-do-jogo');
  await shot('27b-gerador-desligado', genCam);
  // dois puxões: ela anda até a alça, morde e puxa de ré (para longe do gerador); o primeiro engasga, o segundo pega
  await tap('KeyE');
  await until((i) => i.quintal.generator.phase === 'hold', 200);
  await holdDir(1, 0, (i) => i.quintal.generator.pulls >= 1, 200);
  await shot('27c-puxando-a-cordinha', genCam);
  await until((i) => !i.quintal.generator.pulling, 200);
  await tap('KeyE');
  await until((i) => i.quintal.generator.phase === 'hold', 200);
  await holdDir(1, 0, (i) => i.quintal.generator.pulls >= 2, 200);
  await until((i) => i.quintal.generator.on, 200);
  await step(50);
  await shot('27d-gerador-ligado-painel-aceso', genCam);
  await shot('27e-painel-aceso-camera-do-jogo');
  await setup({ active: 'radhija', place: { radhija: { x: L.HORTA.x0 + 0.3, z: (L.HORTA.gap.z0 + L.HORTA.gap.z1) / 2, yaw: Math.PI / 2 } }, settle: 60 });
  await shot('27-radhija-na-lama', { pos: [8.1, 1.1, 6.5], look: [7.5, 0.25, 5.1] });
  await shot('27f-vao-perto-do-chiqueiro-camera-do-jogo');
  await setup({ place: { radhija: { x: 8.6, z: 4.2, yaw: Math.PI / 2 } }, settle: 30 });
  await setup({ active: 'rhaenyra', place: { rhaenyra: { x: 9.05, z: 4.25, yaw: -Math.PI / 2 } }, stay: 'radhija', settle: 10 });
  await keyDown('KeyL');
  await step(70);
  await shot('28-lambe-lambe', { pos: [8.9, 1.0, 5.5], look: [8.8, 0.35, 4.2] });
  await until((i) => i.quintal.mud.k === 0, 600);
  await keyUp('KeyL');
  // a Rhaenyra pisa na lama: nem pulo (o Espaço só espirra lama); a Radhija a lambe
  await setup({ active: 'rhaenyra', set: [['cleanRh', false]], place: { rhaenyra: { x: (L.MUD.x0 + L.MUD.x1) / 2, z: (L.MUD.z0 + L.MUD.z1) / 2, yaw: 0 }, radhija: { x: 8.6, z: 4.2, yaw: Math.PI / 2 } }, stay: 'radhija', settle: 50 });
  await shot('28b-rhaenyra-na-lama', { pos: [8.0, 1.1, 6.6], look: [7.6, 0.3, 5.2] });
  await tap('Space');
  await step(6);
  await shot('28b2-enlameada-sem-pulo', { pos: [8.0, 1.1, 6.6], look: [7.6, 0.3, 5.2] });
  await setup({ active: 'radhija', place: { rhaenyra: { x: 8.3, z: 4.15, yaw: -Math.PI / 2 }, radhija: { x: 7.85, z: 4.2, yaw: Math.PI / 2 } }, stay: 'rhaenyra', settle: 10 });
  await keyDown('KeyL');
  await step(70);
  await shot('28c-radhija-lambendo-a-rhaenyra', { pos: [8.1, 1.0, 5.4], look: [8.1, 0.35, 4.2] });
  await until((i) => i.quintal.mudRh.k === 0, 700);
  await keyUp('KeyL');
  await step(100); // limpinha, ela se sacode
  await setup({ active: 'rhaenyra', place: { rhaenyra: kick(L.SHED_BUTTONS[0]) }, settle: 10 });
  await tap('Space');
  await step(14);
  await shot('29-impulso-no-botao-do-painel', { pos: [BB.x + 1.9, 1.4, BB.z1 + 1.2], look: [BB.x + 0.1, 0.85, (BB.z0 + BB.z1) / 2] });
  await until((i) => i.quintal.doorOpen, 200);
  await step(40);
  await shot('29b-porta-basculante-aberta', { pos: [8.3, 1.5, 3.4], look: [9.3, 0.6, 1.6] });
  await setup({ active: 'radhija', set: [['clean', true]], place: { radhija: { x: 9.8, z: L.RAMP.z - 0.05, yaw: Math.PI / 2 } }, settle: 10 });
  await tap('ShiftLeft');
  await until((i) => i.quintal.ramp === 'up', 60);
  await step(18);
  await shot('30-arrancada-na-rampa', { pos: [10.3, 1.4, 4.3], look: [10.8, 0.7, 3.0] });
  await until((i) => i.quintal.ramp === 'grab', 200);
  await step(16);
  await shot('30b-pegando-a-vela', { pos: [10.9, 1.7, 4.1], look: [11.4, 1.1, 3.05] });
  await until((i) => i.quintal.ramp === 'down', 200);
  await step(14);
  await shot('30c-agachando-antes-de-pular', { pos: [10.2, 1.5, 1.4], look: [11.4, 0.9, 3.1] });
  await step(28);
  await shot('30d-pulando-para-o-chao', { pos: [10.2, 1.5, 1.4], look: [11.2, 0.6, 2.9] });
  await until((i) => !i.quintal.ramp, 300);

  // 6b. o outro botão abre o chiqueiro (com ?botao=1, o segundo)
  await setup({ active: 'rhaenyra', place: { rhaenyra: kick(L.SHED_BUTTONS[1]) }, settle: 10 });
  await tap('Space');
  await until((i) => i.quintal.shed.sty, 120);
  await step(50);
  await shot('29c-porteira-do-chiqueiro-aberta', { pos: [8.0, 1.5, 6.3], look: [9.7, 0.4, 5.0] });
  await step(300);
  await shot('29d-porquinhos-soltos-na-horta', { pos: [7.4, 2.6, 6.9], look: [8.4, 0.2, 3.6] });
  await shot('29e-porquinhos-de-perto', { pos: [8.9, 1.0, 5.6], look: [8.3, 0.25, 4.2] });

  // 6c. BISCOITO: a Rhaenyra puxa os caixotes até as marcas e a Radhija sobe por eles
  const CR = L.PANTRY_CRATES;
  const pantryCam = { pos: [L.CUPBOARD.x + 0.75, 1.4, L.CUPBOARD.z + 1.85], look: [L.CUPBOARD.x - 0.4, 0.35, L.CUPBOARD.z + 0.55] };
  await setup({ stage: 'cake1', active: 'rhaenyra', place: { rhaenyra: { x: CR.x0 + CR.hx + 0.33, z: CR.list[1].z, yaw: -Math.PI / 2 } }, settle: 20 });
  await tap('KeyE');
  const back = await page.evaluate(() => window.__keysFor(1, 0));
  for (const k of back) await keyDown(k);
  await step(40);
  await shot('34-puxando-o-caixote', pantryCam);
  await until((i) => i.quintal.crates[1].locked, 300);
  for (const k of back) await keyUp(k);
  await step(8);
  await shot('34a-caixote-na-marca', pantryCam);
  await setup({ set: [['stairs', true]], place: { rhaenyra: { x: CR.x1 + 0.8, z: CR.list[2].z + 0.5, yaw: Math.PI } }, settle: 10 });
  await shot('34b-escadinha-de-caixotes', pantryCam);
  await setup({ active: 'radhija', place: { radhija: { x: CR.x1, z: CR.list[2].z + CR.hz + 0.3, yaw: Math.PI } }, settle: 10 });
  await tap('KeyE');
  await until((i) => i.quintal.climb === 'up', 30);
  await step(11);
  await shot('34c-agachando-antes-do-pulo', pantryCam);
  await step(16);
  await shot('34c2-pulando-no-caixote', pantryCam);
  await until((i) => i.quintal.climb === 'grab', 400);
  await step(20);
  await shot('34d-pegando-o-biscoito', { pos: [L.CUPBOARD.x + 0.8, 1.6, L.CUPBOARD.z + 1.3], look: [L.CUPBOARD.x, 1.05, L.CUPBOARD.z] });
  await until((i) => i.quintal.climb === 'down', 200);
  await step(12);
  await shot('34d2-descendo-agachada', pantryCam);
  await until((i) => !i.quintal.climb, 400);
  await step(10);
  await shot('34e-com-o-biscoito-camera-do-jogo');

  // 6c2. as galinhas: de frente uma foge correndo; o latido faz as duas voarem
  const CH = L.CHICKENS, hen0 = CH.start[0];
  const henCam = { pos: [(CH.area.minX + CH.area.maxX) / 2 + 0.6, 3.0, CH.area.maxZ + 0.9], look: [(CH.area.minX + CH.area.maxX) / 2, 0.15, (CH.area.minZ + CH.area.maxZ) / 2] };
  await setup({ stage: 'start', active: 'radhija', place: { radhija: { x: 2.0, z: 2.0, yaw: 0 } }, settle: 120 });
  await shot('38-galinhas-ciscando', henCam);
  const hp = await page.evaluate(() => window.__game.game.debug.info().quintal.chickens[0]);
  await shot('38a-galinha-de-perto', { pos: [hp.x + 0.75, 0.55, hp.z + 0.85], look: [hp.x, 0.2, hp.z] });
  await setup({ place: { radhija: { x: hp.x + Math.sin(hen0.yaw) * 0.9, z: hp.z + Math.cos(hen0.yaw) * 0.9, yaw: hen0.yaw + Math.PI } }, settle: 2 });
  await until((i) => i.quintal.chickens[0].state === 'flee', 60);
  await step(18);
  await shot('38b-galinha-fugindo-de-frente', henCam);
  await setup({ place: { radhija: { x: (CH.area.minX + CH.area.maxX) / 2 - 1.2, z: (CH.area.minZ + CH.area.maxZ) / 2, yaw: Math.PI / 2 } }, settle: 90 });
  await tap('KeyE');
  await step(24);
  await shot('38c-galinhas-voando-com-o-latido', henCam);
  await step(80);

  // 6d. os legumes do campinho
  const car = L.PLANTATION.carrots;
  await setup({ active: 'radhija', place: { radhija: { x: car.x, z: car.z + car.hz + 0.35, yaw: Math.PI } }, settle: 10 });
  await tap('KeyE');
  await step(20);
  await shot('35-colhendo-cenoura', { pos: [car.x + 0.9, 1.0, car.z + 1.5], look: [car.x, 0.3, car.z + 0.3] });
  await tap('KeyE');
  await step(30);
  await shot('35b-cenoura-no-chao', { pos: [car.x + 0.9, 1.0, car.z + 1.5], look: [car.x, 0.2, car.z + 0.5] });

  // 6d2. a piñata enroscada no alto da mangueira: a Rhaenyra empurra o tronco de pé e ela desce em cima da roseira
  const MS = L.MANGO_SHOVE;
  const treeCam = { pos: [MS.x - 3.4, 2.5, MS.z - 3.2], look: [MS.x - 1.2, 1.7, MS.z - 0.9] };
  await setup({ stage: 'cake4', active: 'rhaenyra', place: { rhaenyra: { x: MS.x + MS.nx * 0.55, z: MS.z + MS.nz * 0.55, yaw: Math.atan2(-MS.nx, -MS.nz) }, radhija: { x: MS.x - 1.9, z: MS.z + 0.3, yaw: 1 } }, stay: 'radhija', settle: 20 });
  await shot('36a0-pinata-enroscada', treeCam);
  const toTrunk = await page.evaluate((m) => window.__keysFor(-m.nx, -m.nz), MS);
  for (const k of [...toTrunk, 'ShiftLeft']) await keyDown(k);
  await until((i) => !!i.dogs.rhaenyra.shove, 120);
  await step(30);
  await shot('36a-empurrando-a-mangueira', { pos: [MS.x - 1.1, 1.3, MS.z + 1.9], look: [MS.x + 0.1, 0.8, MS.z] });
  await shot('36a1-empurrando-camera-do-jogo');
  await until((i) => i.quintal.pinata.stage === 'slide', 400);
  await step(12);
  await shot('36a2-pinata-escorregando', treeCam);
  await until((i) => i.quintal.pinata.stage === 'drop', 120);
  for (const k of [...toTrunk, 'ShiftLeft']) await keyUp(k);
  await step(18);
  await shot('36a3-pinata-descendo-na-corda', treeCam);
  await until((i) => i.quintal.pinata.stage === 'free', 120);
  await step(60);

  // 6e. ESTRELA: o superbafo balança a piñata; a Rhaenyra pula e bate três vezes
  const R = L.ROSE_BUSH;
  await setup({ active: 'radhija', set: [['pinataDown', true]], place: { radhija: { x: R.x - 1.5, z: R.z, yaw: Math.PI / 2 }, rhaenyra: { x: R.x + 0.98, z: R.z, yaw: -Math.PI / 2 } }, stay: 'rhaenyra', settle: 20 });
  await keyDown('KeyR');
  await step(18);
  await keyUp('KeyR');
  await until((i) => Math.abs(i.quintal.pinata.ax) > 0.4, 120);
  await shot('36-pinata-balancando', { pos: [R.x, 1.6, R.z + 3.0], look: [R.x + 0.3, 1.1, R.z] });
  const broke = await page.evaluate(({ rx, rz }) => {
    const g = window.__game.game;
    const q = () => g.debug.info().quintal;
    if (g.activeDog !== 'rhaenyra') window.__tap('KeyQ');
    let blows = 0;
    for (let k = 0; k < 3600 && !q().pinata.broken; k++) {
      const p = q().pinata;
      const c = g.debug.ctrls.rhaenyra;
      if (!c.jumpT && Math.hypot(p.x - c.x, p.z - c.z) < 0.5) { window.__tap('Space'); continue; }
      if (Math.hypot(p.ax, p.az) < 0.06 && !c.jumpT && blows < 12) {
        blows++;
        window.__tap('KeyQ');
        g.debug.teleport('radhija', rx - 1.5, rz);
        g.debug.ctrls.radhija.yaw = Math.PI / 2;
        window.__key('KeyR', true);
        window.__step(18);
        window.__key('KeyR', false);
        window.__step(6);
        window.__tap('KeyQ');
        g.debug.teleport('rhaenyra', rx + 0.98, rz);
        g.debug.ctrls.rhaenyra.yaw = -Math.PI / 2;
      }
      window.__step(1);
    }
    return q().pinata.broken;
  }, { rx: R.x, rz: R.z });
  if (!broke) throw new Error(`a piñata não abriu; ${await guard.peek()}`);
  await step(12);
  await shot('36b-pinata-abrindo', { pos: [R.x, 1.6, R.z + 3.0], look: [R.x + 0.3, 0.9, R.z] });
  await step(80);
  await shot('36c-estrela-no-gramado', { pos: [R.x + 2.0, 1.2, R.z + 1.6], look: [R.x + 0.8, 0.2, R.z] });

  // 6f. o cantinho atrás do muro (atalho de depuração: pronto)
  const S2 = L.SECRET, bz = (S2.board.z0 + S2.board.z1) / 2;
  await setup({ stage: 'start', set: [['secret', true]], active: 'radhija', place: { radhija: { x: L.EAST_WALL.x - 0.35, z: bz, yaw: Math.PI / 2 } }, settle: 30 });
  await shot('37-tabua-frouxa', { pos: [L.EAST_WALL.x - 1.4, 1.2, bz + 1.2], look: [L.EAST_WALL.x, 0.7, bz] });
  await tap('KeyE');
  await step(60);
  await shot('37b-tabua-aberta', { pos: [L.EAST_WALL.x - 1.4, 1.2, bz + 1.2], look: [L.EAST_WALL.x, 0.7, bz] });
  await setup({ place: { radhija: { x: S2.photo.x - 0.6, z: S2.photo.z, yaw: Math.PI / 2 } }, settle: 2 });
  await until((i) => i.quintal.secret.seen, 60);
  await step(90);
  await shot('37c-cantinho-camera-do-jogo');
  await shot('37d-quadro-das-filhotes', { pos: [S2.photo.x - 0.75, S2.photo.y + 0.05, S2.photo.z], look: [S2.photo.x, S2.photo.y, S2.photo.z] });

  // 7. o bolo na ordem do quadro e a comemoração
  await setup({ stage: 'cake4', settle: 30 });
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
