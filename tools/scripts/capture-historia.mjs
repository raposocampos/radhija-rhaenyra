// Capturas de revisão do Modo História (capítulo 1, Cadê a Cenoura?), cada aparelho com a SUA qualidade gráfica (sem a
// redução do harness): PC (1280×720, perfil alta), iPhone 13 (844×390, DPR 3, perfil médio) e Infinix Note 30 5G
// (893×393, DPR 2,75, perfil baixo, sem pós-processamento: o Faro sem pós). Em cada um, os momentos da fatia: a abertura
// beat a beat (a câmera de cinema dentro do quarto), o quarto (o Faro com a nuvem de cheiro, as pistas, os pombos na
// janela com a cenoura nas patas, a cartela), vistas de JOGO em 3ª pessoa pela casa e pelo condomínio (no PC, todas),
// os puzzles e as cenas da missão (a grade, a Reconstrução, o varal, a senha, o terraço, a guarita, o porteiro, o
// fechamento), o mural e o fim do capítulo. No PC, também vistas altas do condomínio inteiro (câmera livre).
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
        const far0 = G.engine.camera.far;
        if (cam) {
          G.engine.camera.far = 400;
          G.engine.camera.updateProjectionMatrix();
          G.engine.camera.position.set(...cam.pos);
          G.engine.camera.lookAt(...cam.look);
          G.engine.camera.updateMatrixWorld();
          G.engine.focusShadow?.(cam.look[0], cam.look[2], { half: 16, top: 12 });
        }
        G.engine.render(1 / 60, rev.t);
        G.engine.renderer.getContext().finish();
        if (cam) { G.engine.camera.far = far0; G.engine.camera.updateProjectionMatrix(); }
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

  /** Põe uma dog num lugar, olhando para `yaw` (radianos; π = norte). */
  const place = (name, x, z, yaw = Math.PI) => page.evaluate(({ n, px, pz, y }) => {
    const g = window.__game.game;
    g.debug.teleport(n, px, pz);
    g.debug.ctrls[n].yaw = y;
  }, { n: name, px: x, pz: z, y: yaw });
  /** A câmera do jogo (3ª pessoa) atrás da dog ativa, olhando para `heading` (padrão: para onde ela olha). */
  const behind = (heading = null) => page.evaluate((h) => {
    const g = window.__game.game;
    const c = g.debug.ctrls[g.activeDog];
    g.debug.cam.autoRecenter = false;
    g.debug.cam.heading = h ?? c.yaw;
    g.debug.cam.snapFollow(c.x, c.z);
  }, heading);
  /** Uma vista de jogo: a dog ativa em (x, z) olhando para `yaw`, a câmera atrás dela, assentada. */
  const view = async (name, x, z, yaw = Math.PI, { who = 'radhija', frames = 100 } = {}) => {
    await place(who, x, z, yaw);
    await behind(yaw);
    await step(frames);
    await shot(name);
  };
  const LY = () => page.evaluate(() => {
    const L = window.__game.game.levelDef.layout;
    return JSON.parse(JSON.stringify({
      BED: L.BED, ROOMS: L.ROOMS, HOUSE: L.HOUSE, spots: L.CLUE_SPOTS, flap: L.PET_FLAP, gate: L.PET_GATE, pedal: L.PET_PEDAL, sack: L.FOOD_SACK,
      handle: L.KITCHEN_HANDLE, kdoor: L.KITCHEN_DOOR, yard: L.YARD, branch: L.BRANCH, sdoor: L.SERVICE_DOOR, gap: L.YARD_GAP, bolt: L.SERVICE_BOLT,
      pool: L.POOL, recon: L.RECON, line: L.LINE, pin: L.CARROT_PIN, post: L.DASH_POST, laundry: L.LAUNDRY, tower: L.TOWER, tdoor: L.TOWER_DOOR,
      intercom: L.INTERCOM, lobby: L.TOWER_LOBBY, booth: L.BOOTH, vent: L.BOOTH_VENT, lgate: L.GATE, lake: L.LAKE, pier: L.PIER, car: L.CAR,
      carport: L.CARPORT, storage: L.STORAGE, wall: L.WALL, tanks: L.TANKS,
    }));
  });

  // ---- a abertura, beat a beat: a grua lá fora, a noite no quarto, a página de HQ dos pombos, o trovão, a manhã e a
  // página do susto, as apresentações e a cartela (passos de 1/60 s a partir do começo de cada beat)
  await open();
  const Y = await LY();
  await step(200);
  await shot('00-fora-grua-na-garoa');
  await until((i) => i.story.beat === 'noite');
  await step(280);
  await shot('01-noite-squeak');
  await step(140);
  await shot('02-noite-falando-dormindo');
  await until((i) => i.story.beat === 'pombos');
  await step(90);
  await shot('03-hq-pombos-flap');
  await step(80);
  await shot('04-hq-capitao-abrigo');
  await step(110);
  await shot('05-hq-soneca-atchim');
  await step(120);
  await shot('06-hq-quadro-do-capitao');
  await step(110);
  await shot('07-hq-capitao-mede');
  await step(70);
  await shot('08-hq-o-que-precisamos');
  await step(230);
  await shot('09-hq-trovao');
  await until((i) => i.story.beat === 'manha');
  await step(150);
  await shot('10-manha-mao-da-tutora');
  await step(230);
  await shot('11-radhija-boceja');
  await step(70);
  await shot('12-hq-cade-a-cenoura');
  await step(70);
  await shot('13-hq-lugar-vazio');
  await step(70);
  await shot('14-hq-o-grito');
  await until((i) => i.story.beat === 'acorda');
  await step(90);
  await shot('15-hq-rhaenyra-acorda');
  await step(120);
  await shot('16-hq-chua');
  await step(70);
  await shot('17-hq-molhada');
  await step(120);
  await shot('18-hq-radhija-promete');
  await step(140);
  await shot('19-hq-rhaenyra-eba');
  await until((i) => i.story.beat === 'titulo', 600);
  await step(80);
  await shot('20-cartela');
  await until((i) => !i.story.scene);
  await step(80);
  await shot('21-quarto-comeca-o-jogo');

  // ---- o quarto: o Faro, a nuvem de cheiro e as pistas
  await tap('KeyV');
  await step(50);
  await shot('22-quarto-faro-e-nuvem');
  for (const id of ['trilha', 'pote', 'pena']) {
    const at = Y.spots[id].at ?? Y.spots[id];
    await place('radhija', at.x, at.z, Math.PI);
    await behind(Math.PI);
    await step(30);
    if (id === 'pote') await shot('23-quarto-pista-brilhando');
    await tap('KeyE');
    await step(45);
    if (id === 'trilha') await shot('24-quarto-examinando-close-e-fala');
    await step(80);
  }
  // ---- a árvore de pistas (Tab): a pergunta pronta, as opções, a conclusão
  await step(60);
  await tap('Tab');
  await step(20);
  await shot('25-arvore-de-pistas', { wait: 1400 });
  // ligar as três pistas da bandeja à pergunta
  for (const id of ['trilha', 'pote', 'pena']) {
    await page.click(`.rr-board__tcard[data-tray="${id}"]`).catch(() => {});
    await page.waitForTimeout(250);
    if (id === 'trilha') await shot('25b-arvore-pista-escolhida', { wait: 200 });
    await page.click('.rr-board__node[data-node="quem"]').catch(() => {});
    await page.waitForTimeout(450);
  }
  await shot('25c-arvore-pistas-ligadas', { wait: 600 });
  await page.click('.rr-board__node[data-node="quem"]').catch(() => {});
  await step(10);
  await shot('26-arvore-qual-a-conclusao', { wait: 900 });
  await page.click('.rr-board__opt[data-opt="0"]').catch(() => {});
  await step(20);
  await shot('27-arvore-conclusao-dourada', { wait: 900 });
  await until((i) => i.story.scene === 'janela', 300);
  await until((i) => i.story.beat === 'voo', 240);
  await step(90);
  await shot('28-hq-janela-olha-la-fora');
  await step(70);
  await shot('29-hq-janela-farelo-com-a-cenoura');
  await step(70);
  await shot('30-hq-janela-a-nossa-cenoura');
  await until((i) => i.story.beat === 'reacao', 600);
  await step(60);
  await shot('31-hq-janela-eu-sabia');
  await step(150);
  await shot('32-hq-janela-bora');
  await until((i) => !i.story.scene);
  await step(60);
  await shot('33-casa-depois-da-janela');

  // ---- vistas de jogo (3ª pessoa) pela casa e pelo condomínio: [etapa, nome, x, z, rumo, também no celular?]
  const Q = Y.ROOMS.quarto, K = Y.ROOMS.cozinha, SL = Y.ROOMS.sala;
  const VIEWS = [
    ['casa', '30-jogo-quarto-para-a-janela', (Q.x0 + Q.x1) / 2 + 0.5, Q.z1 - 1.4, Math.PI, true],
    ['casa', '31-jogo-quarto-para-a-grade', (Q.x0 + Q.x1) / 2 - 0.6, (Q.z0 + Q.z1) / 2 + 0.3, Math.PI / 2],
    ['casa', '32-jogo-quarto-encostada-na-parede', (Q.x0 + Q.x1) / 2 + 0.8, Q.z1 - 0.5, Math.PI, true],
    ['casa', '33-jogo-quarto-no-canto', Q.x0 + 1.4, Q.z1 - 0.55, Math.PI * 0.75],
    ['casa', '34-jogo-grade-e-portinha-de-gato', Y.flap.x - 1.5, (Y.flap.z0 + Y.gate.hinge.z) / 2, Math.PI / 2],
    ['quintal', '35-jogo-cozinha-para-a-porta', (K.x0 + K.x1) / 2 - 0.6, (K.z0 + K.z1) / 2 + 0.3, Math.PI / 2, true],
    ['quintal', '36-jogo-cozinha-bancada', (K.x0 + K.x1) / 2, K.z1 - 1.3, Math.PI],
    ['quintal', '37-jogo-sala', (SL.x0 + SL.x1) / 2 + 1.5, SL.z0 + 1.2, 0],
    ['quintal', '38-jogo-sala-para-a-cozinha', (SL.x0 + SL.x1) / 2 - 2.0, SL.z1 - 1.6, Math.PI * 0.75],
    ['quintal', '39-jogo-quintal-galho-e-porta', Y.branch.start.x + 0.9, Y.yard.z0 + 3.6, Math.PI, true],
    ['quintal', '40-jogo-quintal-para-o-sul', (Y.yard.x0 + Y.yard.x1) / 2, Y.yard.z0 + 2.2, 0],
    ['piscina', '41-jogo-saindo-pela-porta-de-servico', (Y.sdoor.hinge.x + Y.sdoor.latchPost.x) / 2, Y.sdoor.hinge.z + 1.6, Math.PI],
    ['piscina', '42-jogo-ferrolho-do-lado-de-fora', Y.bolt.ring.x + 0.4, Y.bolt.ring.z - 1.5, 0],
    ['piscina', '43-jogo-gramado-para-a-piscina', Y.recon.x - 2.2, Y.recon.z + 3.6, Math.PI * 0.82, true],
    ['piscina', '44-jogo-piscina-deque', Y.pool.x1 + 0.9, Y.pool.z1 + 1.2, -Math.PI * 0.78],
    ['varal', '45-jogo-varal-com-os-pombos', Y.pin.x - 0.4, Y.pin.z + 3.4, Math.PI, true],
    ['varal', '46-jogo-area-de-servico-tanques', Y.tanks.x1 + 1.6, Y.tanks.z1 + 1.8, -Math.PI * 0.72],
    ['torre', '47-jogo-torre-porta-e-interfone', Y.tdoor.hinge.x - 2.8, Y.intercom.buttons[1].z + 0.3, Math.PI / 2, true],
    ['torre', '48-jogo-torre-de-longe', Y.tower.x0 - 5.5, Y.tower.z1 + 3.5, Math.PI * 0.68],
    ['portaria', '49-jogo-guarita-e-portaozinho', (Y.booth.x0 + Y.booth.x1) / 2 + 0.6, Y.booth.z1 + 4.2, Math.PI, true],
    ['portaria', '50-jogo-guarita-grelha', Y.vent.x - 2.2, Y.vent.z + 0.6, Math.PI / 2],
    ['portaria', '51-jogo-lago-do-pier', Y.pier.x0 - 1.2, (Y.pier.z0 + Y.pier.z1) / 2, Math.PI / 2, true],
    ['portaria', '52-jogo-lago-margem-sul-barquinho', Y.lake.island.x - 3.4, Y.wall.maxZ - 3.4, Math.PI * 0.78],
    ['portaria', '53-jogo-garagem', (Y.carport.x0 + Y.car.x0) / 2 - 0.2, Y.carport.z0 - 2.2, 0.3, true],
    ['portaria', '54-jogo-garagem-caminhonete-de-perto', Y.car.x0 - 1.3, (Y.car.z0 + Y.car.z1) / 2, Math.PI / 2],
    ['portaria', '55-jogo-embaixo-da-caminhonete', (Y.car.x0 + Y.car.x1) / 2, Y.car.z0 + 2.0, 0],
    ['portaria', '56-jogo-gramado-oeste', Y.wall.minX + 6.5, -6.0, Math.PI / 2 + 0.4],
    ['portaria', '57-jogo-muro-norte-e-cidade', 0.5, Y.wall.minZ + 4.2, Math.PI, true],
    ['portaria', '58-jogo-centro-do-condominio', 3.2, 0.6, Math.PI * 0.6],
  ];
  let opened = null;
  for (const [stage, name, x, z, yaw, mobile] of VIEWS) {
    if (!dev.full && !mobile) continue;
    if (opened !== stage) { await open(stage); opened = stage; }
    await view(name, x, z, yaw);
  }

  // ---- os puzzles e as cenas da missão
  // a grade aberta pelo pedal
  await open('casa');
  await place('radhija', Y.pedal.x, Y.pedal.z, -Math.PI / 2);
  await step(90);
  await behind(-Math.PI / 2);
  await step(40);
  await shot('60-pedal-e-grade-aberta');
  // a Reconstrução: o pulso perto da piscina
  await open('piscina');
  await place('radhija', Y.recon.x - 0.9, Y.recon.z + 1.5, Math.PI);
  await step(20);
  await tap('KeyV');
  await until((i) => i.story.scene === 'reconstrucao', 200);
  await step(170);
  await shot('61-reconstrucao-da-boia');
  // o varal: o cesto embaixo, a arrancada, o Farelo pega no ar
  await open('varal');
  await page.evaluate(() => { const g = window.__game.game; g.debug.setStage('torre', 'radhija'); g.debug.setStage('varal', 'radhija'); });
  await page.evaluate(() => { const g = window.__game.game; const L = g.levelDef.layout; g.debug.teleport('rhaenyra', L.LAUNDRY.start.x - L.LAUNDRY.half - 0.28, L.LAUNDRY.start.z); g.debug.ctrls.rhaenyra.yaw = Math.PI / 2; });
  await tap('KeyQ');
  await step(10);
  // a câmera atrás dela, olhando para o leste: o W empurra o cesto ao longo do varal
  await behind(Math.PI / 2);
  await step(4);
  await page.evaluate(() => { for (const c of ['KeyW', 'ShiftLeft']) window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c })); });
  await until((i) => i.story.flags.basketUnder, 900);
  await step(10);
  await page.evaluate(() => { for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c })); });
  await step(20);
  await behind(Math.PI);
  await step(30);
  await shot('62-varal-cesto-embaixo-da-cenoura');
  // o empurra-empurra da Rhaenyra no poste do leste (Shift de frente para ele, com a câmera atrás dela)
  await page.evaluate(() => { const g = window.__game.game; const P = g.levelDef.layout.DASH_POST; g.debug.teleport('rhaenyra', P.x, P.z + 0.62); g.debug.ctrls.rhaenyra.yaw = Math.PI; });
  await behind(Math.PI);
  await step(8);
  await page.evaluate(() => { for (const c of ['KeyW', 'ShiftLeft']) window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c })); });
  await step(50);
  await shot('62b-varal-empurra-empurra');
  await until((i) => i.story.scene === 'varal', 420);
  await page.evaluate(() => { for (const c of ['KeyW', 'ShiftLeft']) window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c })); });
  await until((i) => i.story.beat === 'cai', 200);
  await step(16);
  await shot('63-varal-a-cenoura-cai');
  await step(34);
  await shot('64-varal-farelo-agarra-no-ar');
  await until((i) => i.story.beat === 'voa', 300);
  await step(80);
  await shot('65-varal-voam-para-a-torre');
  await until((i) => i.story.beat === 'pousam', 600);
  await step(40);
  await shot('66-varal-pousam-na-caixa-dagua');
  // a senha do interfone
  await open('torre');
  await step(80);
  await tap('KeyV');
  await until((i) => i.story.scene === 'senha', 200);
  await step(120);
  await shot('67-senha-farelo-primeiro-botao');
  await step(180);
  await shot('68-senha-os-tres-botoes');
  await until((i) => !i.story.scene, 900);
  // o terraço da torre
  await page.evaluate(() => { const g = window.__game.game; const T = g.levelDef.layout.TOWER_LOBBY; g.debug.teleport('radhija', (T.x0 + T.x1) / 2, (T.z0 + T.z1) / 2); });
  await until((i) => i.story.scene === 'telhadoChega', 90);
  await until((i) => i.story.beat === 'saem', 600);
  await step(90);
  await shot('69-telhado-chegada');
  await until((i) => i.story.beat === 'desafio', 600);
  await step(80);
  await shot('70-telhado-desafio-do-capitao');
  await until((i) => i.story.beat === 'plano', 600);
  await step(90);
  await shot('71-telhado-o-plano');
  await until((i) => !i.story.scene, 900);
  // jogando lá em cima: vistas de jogo (a câmera atrás da dog) dos poleiros, do caixote e da caixa d'água
  await page.evaluate(() => { const L = window.__game.game.levelDef.layout; const g = window.__game.game; g.debug.teleport('radhija', L.ROOF_ARRIVE.rad.x + 0.6, L.ROOF_ARRIVE.rad.z - 0.4); g.debug.ctrls.radhija.yaw = Math.PI * 0.7; });
  await behind(Math.PI * 0.7);
  await step(40);
  await shot('72-telhado-jogando-poleiros');
  await page.evaluate(() => { const L = window.__game.game.levelDef.layout; const g = window.__game.game; g.debug.teleport('radhija', L.ROOF_CRATE.start.x - 0.9, L.ROOF_CRATE.start.z + 0.9); g.debug.ctrls.radhija.yaw = Math.PI * 0.85; });
  await behind(Math.PI * 0.85);
  await step(40);
  await shot('72b-telhado-caixote-e-caixa-dagua');
  await page.evaluate(() => { const L = window.__game.game.levelDef.layout; const g = window.__game.game; g.debug.teleport('radhija', (L.ROOFTOP.x0 + L.ROOFTOP.x1) / 2, L.ROOFTOP.z1 - 0.8); g.debug.ctrls.radhija.yaw = Math.PI; });
  await behind(Math.PI);
  await step(40);
  await shot('72c-telhado-mureta-e-cidade');
  await page.evaluate(() => window.__game.game.puzzle.rooftop.skipToEnd());
  await step(20);
  // a guarita: o Superbafo na grelha, a janela abre, o latido grosso
  await open('portaria');
  await place('radhija', Y.vent.x - 0.75, Y.vent.z, Math.PI / 2);
  await behind(Math.PI / 2);
  await step(30);
  await shot('73-guarita-grelha-antes-do-sopro');
  await tap('KeyR');
  await until((i) => i.story.scene === 'cheiro', 400);
  await step(60);
  await shot('74-guarita-cheiro');
  await until((i) => i.story.beat === 'abre', 600);
  await step(80);
  await shot('75-guarita-janela-abrindo');
  await until((i) => !i.story.scene, 900);
  await tap('KeyQ');
  await step(10);
  await page.evaluate(() => { const g = window.__game.game; const B = g.levelDef.layout.BOOTH; g.debug.teleport('rhaenyra', (B.x0 + B.x1) / 2 + 0.4, B.awning.z1 + 0.9); g.debug.ctrls.rhaenyra.yaw = Math.PI; });
  await step(20);
  await tap('KeyE');
  // o Sr. Luiz: a página de HQ na guarita (acorda, as duas latem, o depoimento), o portãozinho e o aceno
  await until((i) => i.story.scene === 'porteiro', 600);
  await step(60);
  await shot('76-sr-luiz-acorda');
  await step(100);
  await shot('76b-sr-luiz-as-duas-latem');
  await step(140);
  await shot('76c-sr-luiz-o-depoimento');
  // ele sai pela porta da guarita e anda até o portãozinho
  await until((i) => i.story.beat === 'sai', 600);
  await step(80);
  await shot('76d-sr-luiz-vai-ao-portaozinho');
  await until((i) => i.story.beat === 'abre', 600);
  await step(80);
  await shot('77-sr-luiz-abre-o-portaozinho');
  await until((i) => i.story.beat === 'acena', 600);
  await step(50);
  await shot('77b-sr-luiz-acena');
  // o fechamento: os pombos sobre a cidade e a borboleta
  await open('fechamento');
  await page.evaluate(() => { const g = window.__game.game; const G = g.levelDef.layout.GATE; g.debug.teleport('radhija', (G.x0 + G.x1) / 2, G.z + 0.6); });
  await until((i) => i.story.scene === 'fechamento', 60);
  await step(70);
  await shot('78-fechamento-saem');
  await until((i) => i.story.beat === 'pombos', 600);
  await step(110);
  await shot('79-pombos-sobre-a-cidade');
  await until((i) => i.story.beat === 'borboleta', 600);
  await step(80);
  await shot('80-borboleta');
  await until((i) => i.story.stage === 'mural', 1200);
  await step(60);
  await shot('81-mural');
  await page.evaluate(() => window.__game.events.emit('ui:muralDone', { errors: 0, settled: true }));
  await step(30);
  await shot('82-fim-do-capitulo');

  // a Rhaenyra distraída (src/story/scene/lesada.js): a voltinha atrás do rabo e a borboleta, com a câmera atrás da
  // Radhija olhando para a irmã
  if (dev.full) {
    await open('piscina');
    await step(240);
    const aim = () => page.evaluate(() => {
      const g = window.__game.game;
      const a = g.debug.ctrls.radhija, b = g.debug.ctrls.rhaenyra;
      g.debug.cam.autoRecenter = false;
      g.debug.cam.heading = Math.atan2(b.x - a.x, b.z - a.z);
      g.debug.cam.snapFollow(a.x, a.z);
    });
    await aim();
    if (await page.evaluate(() => !!window.__game.game.puzzle.lesada?.start('rabo'))) {
      await until((i) => i.story.lesada?.run?.ph === 'volta', 120);
      await step(45);
      await shot('97-rhaenyra-atras-do-rabo');
    }
    await until((i) => !i.story.lesada?.run, 400);
    await step(30);
    if (await page.evaluate(() => !!window.__game.game.puzzle.lesada?.start('borboleta'))) {
      await until((i) => i.story.lesada?.run?.ph === 'nota', 400);
      await aim();
      await step(10);
      await shot('98-borboleta-no-focinho');
      await until((i) => i.story.lesada?.run?.ph === 'corre', 200);
      await step(20);
      await shot('98b-rhaenyra-atras-da-borboleta');
    }
  }

  if (dev.full) {
    await open('casa');
    await step(10);
    // vistas altas (câmera livre, sem a interface): o condomínio inteiro e cada canto
    for (const [name, cam] of [
      ['90-vista-condominio', { pos: [10, 44, 41], look: [0, 0, -1.7] }],
      ['91-vista-casa-quintal', { pos: [-10, 15, 16], look: [-15, 0, 6] }],
      ['92-vista-piscina-varal', { pos: [0, 15, 6], look: [-2.7, 0, -7.8] }],
      ['93-vista-torre-guarita', { pos: [20, 15, 2.5], look: [14.5, 1.4, -11.2] }],
      ['94-vista-lago', { pos: [22, 13.5, 14.5], look: [16.3, 0, 2.7] }],
      ['95-vista-garagem', { pos: [6.8, 12, 20.4], look: [2.7, 0.7, 10.9] }],
      ['96-vista-rua-cidade', { pos: [22, 5.4, -10.9], look: [22, 4, -40] }],
    ]) await shot(name, { cam, hideUi: true });
  }
  await page.close();
}
