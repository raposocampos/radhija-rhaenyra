// Capturas de revisão da fase 9 (Biblioteca do Vovô) em qualidade visual completa (sombras, bloom, resolução 1).
// Roda no GitHub Actions (E2E manual, suíte biblioteca), depois da partida. O laço do jogo fica congelado e o script
// avança quadro a quadro (1/60 s): cada imagem mostra um instante exato (impulso no freio, a Radhija no alto da escada,
// o Bichano acordando e pulando, o livro caindo, a porta segura no vão). Teclas reais chegam pelos ouvintes do jogo;
// teleporte, etapas e placeCrate só preparam as cenas. Saída: shots/biblioteca-revisao/*.png.
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { closeBrowser, openPage } from './lib/page-guard.mjs';

if (!process.env.CI) throw new Error('Esta revisão deve rodar no GitHub Actions, conforme AGENTS.md.');
const OUT = 'shots/biblioteca-revisao';
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
  const { page, guard } = await openPage(browser, { viewport: { width: 1280, height: 720 } }, { name: 'biblioteca' });
  page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => raf((t) => { if (!window.__freezeReview) fn(t); });
  });
  await page.goto(`${url}?level=fase9&play`);
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
  /** Etapa, dog ativa, posições (teleporte só no preparo) e o Fica. */
  const setup = (o) => page.evaluate((opts) => {
    const g = window.__game.game;
    if (opts.stage) g.debug.setStage(opts.stage, opts.active);
    if (opts.active && g.activeDog !== opts.active) window.__tap('KeyQ');
    for (const [name, p] of Object.entries(opts.place || {})) {
      g.debug.teleport(name, p.x, p.z);
      g.debug.ctrls[name].yaw = p.yaw;
    }
    for (const [id, x, z] of opts.crates || []) g.puzzle.placeCrate(id, x, z);
    if (opts.stay) g.setStay(opts.stay, true);
    window.__step(opts.settle ?? 20);
  }, o);
  const L = await page.evaluate(() => {
    const l = window.__game.layout;
    return {
      BRAKE: l.BRAKE_LEVER, BREAKER: l.BREAKER, PLANTER: l.PLANTER, PLATE: l.DAMPER_PLATE, HANDLE: l.DOOR_HANDLE, LADDER: l.LADDER, GLOBE: l.GLOBE, HOLD: l.LADDER_HOLD,
      GLASSES: l.GLASSES, FAN: l.FAN, DUCT: l.DUCT, CAT: l.CAT, WARDROBE: l.WARDROBE, BOOK_FALL: l.BOOK_FALL, GOAL: l.GOAL,
      FIRE: l.FIREPLACE, WALL_EH: l.WALL_EH, DOOR: l.DOOR,
    };
  });
  const kick = (c) => ({ x: c.x + c.nx * 0.6 - c.nz * 0.14, z: c.z + c.nz * 0.6 + c.nx * 0.14, yaw: Math.atan2(-c.nx, -c.nz) });

  // 0. a apresentação com a câmera do jogo: os óculos lá no alto e o Bichano dormindo no armário
  await step(75);
  await shot('00a-apresentacao-oculos');
  await step(170);
  await shot('00b-apresentacao-gato');
  await step(200);
  // 1. a casa com a câmera do jogo e de cima; cada cômodo de perto
  await shot('01-hall-camera-do-jogo');
  await shot('02-visao-geral', { pos: [0, 9.5, 8.8], look: [0, 0.3, -0.6] });
  await shot('03-biblioteca', { pos: [1.4, 1.7, 1.4], look: [1.6, 1.0, -3.0] });
  await shot('04-lareira-e-poltrona', { pos: [2.2, 1.2, 0.6], look: [0.6, 0.6, -2.4] });
  await shot('05-escritorio', { pos: [-5.0, 1.8, 1.6], look: [-6.6, 1.2, -2.6] });
  await shot('06-gato-no-armario', { pos: [-6.3, 2.35, -1.6], look: [L.CAT.top.x, L.CAT.top.y, L.CAT.top.z] });
  await shot('07-hall', { pos: [-2.2, 1.5, 2.0], look: [-3.4, 0.9, -2.8] });
  await shot('08-jardim-de-inverno', { pos: [5.4, 1.6, 2.0], look: [6.6, 0.8, -2.0] });
  await shot('09-duto-no-alto', { pos: [1.0, 2.0, -0.8], look: [-1.0, 2.6, -3.5] });
  await shot('09b-portinha-de-gato', { pos: [-3.3, 1.1, 2.9], look: [-4.4, 0.2, 2.05] });
  await shot('09c-freio-travado', { pos: [4.1, 1.1, -1.1], look: [3.75, 0.25, -2.45] });
  // o escritório com a câmera do jogo: o Bichano no alto do armário precisa aparecer
  await setup({ active: 'radhija', place: { radhija: { x: -6.0, z: -1.0, yaw: Math.PI }, rhaenyra: { x: -3.6, z: 0.5, yaw: 2 } }, stay: 'rhaenyra', settle: 120 });
  await shot('05b-escritorio-camera-do-jogo');

  // 2. impulso no freio da escadinha
  const kb = kick(L.BRAKE);
  await setup({ stage: 'start', active: 'rhaenyra', place: { rhaenyra: kb, radhija: { x: 2.0, z: -0.8, yaw: 1.5 } }, stay: 'radhija' });
  await tap('Space');
  await until((i) => (i.dogs.rhaenyra.wall?.k ?? 0) >= 0.52, 120);
  await shot('10-impulso-no-freio', { pos: [L.BRAKE.x - 1.6, 1.3, L.BRAKE.z + 0.9], look: [L.BRAKE.x - 0.2, 0.9, L.BRAKE.z] });
  await until((i) => !i.dogs.rhaenyra.wall, 120);
  await step(50);
  await shot('10b-trava-solta', { pos: [4.1, 1.1, -1.1], look: [3.75, 0.25, -2.45] });

  // 3. a escada debaixo dos óculos, a Rhaenyra segurando (E) e a Radhija no alto
  const hold = { x: L.LADDER.minX + L.HOLD.side, z: L.HOLD.z + 0.02 };
  await setup({
    crates: [['globo', L.GLOBE.minX, L.GLOBE.start.z], ['escadinha', L.LADDER.minX, L.LADDER.start.z]],
    place: { rhaenyra: { ...hold, yaw: -Math.PI / 2 }, radhija: { x: L.LADDER.minX, z: -1.98, yaw: Math.PI } },
  });
  await tap('KeyE'); // a Rhaenyra (ativa) segura a escada
  await tap('KeyQ'); // Radhija ativa; a Rhaenyra continua segurando
  await step(10);
  await shot('11-escada-pronta', { pos: [L.LADDER.minX + 1.4, 1.2, -1.0], look: [L.LADDER.minX, 0.8, -2.7] });
  await tap('KeyE');
  await until((i) => i.biblioteca.climb?.phase === 'up' && i.biblioteca.climb.y > 0.5, 200);
  await shot('12-subindo', { pos: [L.LADDER.minX + 1.3, 1.2, -1.3], look: [L.LADDER.minX, 0.9, -2.8] });
  await until((i) => i.biblioteca.climb?.phase === 'grab', 200);
  await step(25);
  await shot('13-pegando-os-oculos', { pos: [L.LADDER.minX + 0.9, 1.9, -1.8], look: [L.GLASSES.x, L.GLASSES.y - 0.2, L.GLASSES.z] });
  await until((i) => i.biblioteca.climb?.phase === 'down', 200);
  await step(20);
  await shot('14-descendo-com-os-oculos', { pos: [L.LADDER.minX + 1.2, 1.1, -1.2], look: [L.LADDER.minX, 0.6, -2.6] });
  await until((i) => !i.biblioteca.climb, 200);

  // 4. o jardim de inverno: disjuntor (energia), botão do ventilador, ventilador na grade, vaso no botão do registro e o
  //    superbafo no vento; o Bichano acorda, pula e o livro cai
  const darkCam = { pos: [5.9, 1.9, -0.9], look: [6.3, 1.2, -3.4] };
  await setup({ stage: 'start', active: 'rhaenyra', place: { rhaenyra: kick(L.BREAKER) }, stay: 'radhija' });
  await shot('14b-jardim-sem-luz', darkCam);
  await tap('Space');
  await until((i) => !i.dogs.rhaenyra.wall && i.biblioteca.power, 200);
  await step(12);
  await shot('14c-disjuntor-pulso', darkCam);
  await step(60);
  await shot('14d-jardim-com-luz', darkCam);
  await setup({ active: 'radhija', place: { radhija: { x: L.FAN.start.x + 0.1, z: L.FAN.start.z + 0.5, yaw: Math.PI } } });
  await tap('KeyE');
  await step(60);
  await shot('14e-ventilador-ligado', { pos: [L.FAN.start.x + 1.0, 1.2, L.FAN.start.z + 1.7], look: [L.FAN.start.x, 0.55, L.FAN.start.z] });
  await setup({ crates: [['ventilador', L.DUCT.inlet.x, L.FAN.alignZ - 0.25], ['vaso', L.PLANTER.start.x, -1.2]] });
  await shot('14f-vaso-a-caminho', { pos: [L.PLATE.x + 1.6, 1.6, L.PLATE.z + 2.4], look: [L.PLATE.x + 0.3, 0.3, L.PLATE.z - 0.2] });
  await setup({ crates: [['vaso', L.PLATE.x, L.PLATE.z]] });
  await step(50);
  await shot('14g-vaso-no-botao', { pos: [L.PLATE.x + 1.6, 1.6, L.PLATE.z + 2.4], look: [L.PLATE.x + 0.3, 0.3, L.PLATE.z - 0.2] });
  await shot('14h-registro-aberto', { pos: [L.DUCT.inlet.x + 0.6, 0.9, L.DUCT.inlet.z + 1.2], look: [L.DUCT.inlet.x, 0.25, L.DUCT.inlet.z - 0.2] });
  await step(5);
  const fanAt = await page.evaluate(() => window.__game.game.debug.info().biblioteca.fan);
  await setup({ active: 'radhija', place: { radhija: { x: fanAt.x + 0.12, z: fanAt.z - 0.75, yaw: Math.PI } } });
  // de cima e de trás do ventilador, como a câmera do jogo (rente ao chão, a captura pegava um clarão branco do luar)
  await shot('15-ventilador-na-grade', { pos: [fanAt.x + 1.2, 2.4, fanAt.z + 2.0], look: [fanAt.x, 0.4, fanAt.z - 1.4] });
  await shot('15b-fio-do-ventilador', { pos: [fanAt.x + 0.4, 4.4, fanAt.z + 1.9], look: [fanAt.x + 0.2, 0, fanAt.z - 1.5] });
  await keyDown('KeyR');
  await step(18);
  await keyUp('KeyR');
  await step(30);
  await shot('16-cheiro-no-vento', { pos: [fanAt.x + 1.6, 1.4, fanAt.z + 1.0], look: [fanAt.x, 0.5, fanAt.z - 1.6] });
  await until((i) => (i.scent?.clouds || []).some((c) => c.state === 'duct'), 400);
  await step(85); // a baforada já passou da metade do cano, em cima do hall
  await shot('17-cheiro-no-duto', { pos: [0.5, 2.2, -0.6], look: [-1.5, 2.5, -3.5] });
  await until((i) => i.biblioteca.cat === 'waking', 600);
  await step(30);
  await shot('18-bichano-acordando', { pos: [-6.3, 2.3, -1.7], look: [L.CAT.top.x, L.CAT.top.y, L.CAT.top.z] });
  await until((i) => i.biblioteca.cat === 'jumping', 200);
  await step(25);
  await shot('19-bichano-pulando', { pos: [-5.2, 1.7, -0.3], look: [-6.6, 1.25, -2.6] });
  await until((i) => i.biblioteca.book === 'floor', 200);
  await step(20);
  await shot('20-livro-no-chao', { pos: [-5.6, 1.0, -1.2], look: [L.BOOK_FALL.x, 0.1, L.BOOK_FALL.z] });
  await until((i) => i.biblioteca.cat === 'walking', 200);
  await until((i) => i.biblioteca.catAt.x > -4.62, 600);
  await step(6);
  await shot('21-bichano-saindo', { pos: [-3.0, 1.0, 2.85], look: [-4.45, 0.15, 2.0] });
  await until((i) => i.biblioteca.cat === 'bed', 900);
  await step(200);
  await shot('22-bichano-na-almofada', { pos: [-1.8, 0.9, 1.6], look: [L.CAT.bed.x, 0.1, L.CAT.bed.z] });
  // o gato desceu: no escritório a câmera do jogo volta ao enquadramento normal
  await setup({ active: 'radhija', place: { radhija: { x: -6.0, z: -1.0, yaw: Math.PI } }, settle: 150 });
  await shot('22b-escritorio-depois-do-gato');

  // 5. a porta: impulso na maçaneta e a Radhija segurando o vão
  const kd = kick(L.HANDLE);
  await setup({ active: 'rhaenyra', place: { rhaenyra: kd, radhija: { x: -3.3, z: 1.2, yaw: -Math.PI / 2 } }, stay: 'radhija' });
  await tap('Space');
  await until((i) => (i.dogs.rhaenyra.wall?.k ?? 0) >= 0.52, 120);
  await shot('23-impulso-na-macaneta', { pos: [-2.9, 1.3, 0.6], look: [-4.3, 0.9, -0.4] });
  await until((i) => i.biblioteca.door.open, 200);
  // aberta, a Radhija entra no vão e fica: a mola espera ela sair (antes de abrir, a folha a empurraria para dentro)
  await setup({ place: { radhija: { x: L.WALL_EH.x - 0.08, z: 0.03, yaw: Math.PI / 2 } } });
  await step(260);
  await shot('24-radhija-segura-a-porta', { pos: [-3.0, 1.3, 1.4], look: [-4.6, 0.5, 0.2] });

  // 6. tudo entregue: a mesinha com os óculos e o livro, e a comemoração
  await setup({ stage: 'done', settle: 2 });
  await step(150);
  await shot('25-mesinha', { pos: [L.GOAL.x + 0.7, 1.1, L.GOAL.z + 1.0], look: [L.GOAL.x, 0.55, L.GOAL.z] });
  await step(60);
  await shot('26-comemoracao');
  if (errors.length) throw new Error(`erros no navegador:\n${errors.join('\n')}`);
  console.log(`\n${shots} capturas de revisão; sem erros de console`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
} finally {
  await closeBrowser(browser);
  await server?.close();
}
