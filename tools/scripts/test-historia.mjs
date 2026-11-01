// Modo História (suíte 'historia'): a fatia jogável no navegador de verdade, pela entrada das prévias (?historia).
//  - a abertura "A noite da garoa" com o HUD da história: faixas de cinema, o HUD do jogo escondido, o aviso do primeiro
//    Faro com a tecla do aparelho, o V dispara o pulso, os cartões voam para a lupa, segurar E pula o resto;
//  - a missão com as teclas reais: a maçaneta (impulso da Rhaenyra), o galho, a porta da área de serviço, o Faro na
//    piscina (a Reconstrução, assistida), a arrancada no varal, a porta de mola da torre com a irmã segurando, o
//    porteiro (o latido fino não basta, o grave sim), o portãozinho (o fechamento, assistido);
//  - o mural provisório: a patinha do tutorial, a ligação errada volta, arrastar e tocar, Continuar, o fim do capítulo
//    e Jogar de novo; ninguém atravessa nada no caminho;
//  - no celular (iPhone 13): o toque no aviso do Faro, o botão ⏩ segurado pula, o botão do focinho;
//  - o HUD da história (lupa e meias, faixas, cartela, aviso, mural, fim) nos 11 tamanhos de tela, com capturas.
//   node tools/scripts/test-historia.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';
import { SCREENS, boxesIn, outside, overlapPairs, settle, touchDevice, IPHONE_UA } from './lib/screens.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/historia' });
const { page, check, info, ev, shot, logOf, clearLog, load, press, waitFor, walkTo, walkPath, holdUntil, keysFor } = H;

const story = async () => (await info()).story;
const hudState = () => ev(() => window.__game.storyHud?.state() ?? null);
/** Nenhuma dog no chão dentro de um colisor (nada atravessa nada). */
const noOverlap = () => ev(() => {
  const g = window.__game.game;
  const w = g.debug.world;
  const out = [];
  for (const n of ['radhija', 'rhaenyra']) {
    const c = g.debug.ctrls[n];
    if ((c.y || 0) > 0.05) continue;
    const hits = w.contacts(c.x, c.z, c.r * 0.85, c.size).filter((h) => h.depth > 0.02);
    if (hits.length) out.push({ n, x: +c.x.toFixed(2), z: +c.z.toFixed(2), hits: hits.map((h) => h.id) });
  }
  return out;
});
/** Troca para a dog (Q) se preciso. */
async function become(name) {
  // logo depois de uma arrancada um extra pode ocupar a dog por um instante: tenta de novo
  for (let k = 0; k < 4 && (await info()).activeDog !== name; k++) await press('KeyQ', 400);
  const i = await info();
  check(i.activeDog === name, `${name} ativa`, i.activeDog);
}
/** Pula a cena que está rodando segurando E (o anel enche) e espera a cena acabar. */
async function skipScene(label) {
  const s0 = await story();
  if (!s0.scene) { check(false, `${label}: nenhuma cena rodando para pular`, s0); return; }
  await holdUntil(['KeyE'], (i) => !i.story.scene, { timeout: 6000, label: `pular ${label}` });
  const s = await story();
  check(!s.scene, `${label}: segurar E pula a cena`, { scene: s.scene, stage: s.stage });
}
/** Espera a etapa. */
const stageIs = (st, timeout = 20000) => waitFor((i) => i.story?.stage === st && !i.story.scene, { timeout });

try {
  console.log('\n== Abertura: "A noite da garoa" ==');
  await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await ev(() => { localStorage.removeItem('rr-progress-v1'); localStorage.removeItem('rr-settings-v1'); });
  await load('?historia');
  let i = await info();
  check(await ev(() => window.__game.game.isStory), '?historia abre a área da história (prévia/desenvolvimento)');
  check(i.story?.scene === 'abertura', 'a abertura começa sozinha', i.story);
  let hs = await hudState();
  check(hs?.story && hs.cinema, 'HUD da história com as faixas de cinema', hs);
  const hudHidden = await ev(() => getComputedStyle(document.querySelector('.rr-hud')).visibility === 'hidden');
  check(hudHidden, 'na cena, o HUD do jogo some (nada de texto em cena)');
  await shot('01-abertura-noite.png');
  // o primeiro Faro: a cena espera o botão (com a tecla do aparelho no aviso)
  i = await waitFor((x) => x.story?.waitingFaro, { timeout: 60000 });
  check(i.story.waitingFaro, 'a abertura espera o primeiro Faro', i.story);
  const prompt = await ev(() => {
    const el = document.querySelector('.rr-story__prompt');
    const key = [...el.querySelectorAll('[data-dev]')].find((k) => getComputedStyle(k).display !== 'none');
    return { on: el.classList.contains('is-on'), key: key?.textContent?.trim() ?? null };
  });
  check(prompt.on && prompt.key === 'V', 'o aviso do focinho com a tecla V (teclado)', prompt);
  await shot('02-abertura-aviso-faro.png');
  await clearLog();
  await press('KeyV', 600);
  i = await waitFor((x) => !x.story.waitingFaro, { timeout: 5000 });
  check(!i.story.waitingFaro && (await logOf('story:faro')).length >= 1, 'V dispara o pulso do Faro', i.story);
  await H.sleep(2500);
  await shot('03-abertura-faro.png');
  hs = await hudState();
  check(['trilha', 'pote', 'pena'].every((id) => hs.clues.includes(id)), 'a trilha, o pote e a pena chegam à lupa', hs.clues);
  // a cartela do capítulo (assistindo até o fim)
  i = await waitFor((x) => x.story.beat === 'titulo', { timeout: 30000 });
  await H.sleep(900);
  hs = await hudState();
  check(hs.title, 'a cartela "As Aventuras de Radhija & Rhaenyra" · "Capítulo 1 · Cadê a Cenoura?"', hs);
  const titleText = await ev(() => document.querySelector('.rr-story__title').innerText.replace(/\s+/g, ' ').trim());
  check(/Radhija/.test(titleText) && /Rhaenyra/.test(titleText) && /Cadê a Cenoura/.test(titleText), 'o texto da cartela', titleText);
  await shot('04-abertura-cartela.png');
  i = await stageIs('cozinha', 20000);
  check(i.story.stage === 'cozinha', 'a abertura termina na missão da cozinha', i.story.stage);
  hs = await hudState();
  check(!hs.cinema, 'as faixas saem e o HUD volta', hs);
  check(hs.clues.length === 5, 'a lupa guarda 5 pistas', hs.clues);
  await H.sleep(3000); // os cartões voam até a lupa, um por vez
  check((await ev(() => document.querySelector('[data-n="pistas"]').textContent)) === '5', 'o contador da lupa mostra 5', await ev(() => document.querySelector('[data-n="pistas"]').textContent));
  check((await noOverlap()).length === 0, 'ninguém dentro de nada', await noOverlap());

  console.log('\n== Passo 1: a maçaneta da cozinha (impulso da Rhaenyra) ==');
  await become('rhaenyra');
  await walkPath([[-10.0, 3.0], [-7.32, 3.12]], { timeout: 20000 });
  // de frente para a porta (leste) e o pulo
  await H.hold(keysFor(1, 0), 120);
  await press('Space', 1500);
  i = await waitFor((x) => x.story.flags.kitchenOpen, { timeout: 6000 });
  check(i.story.flags.kitchenOpen && i.story.stage === 'galho', 'o impulso na maçaneta abre a porta da cozinha', i.story);
  await shot('05-cozinha-porta.png');

  console.log('\n== Passo 2: o galho e a porta da área de serviço ==');
  // pela porta aberta e em volta da ponta da folha (ela abre para o quintal) até a face oeste do galho
  await walkPath([[-6.0, 2.95], [-5.35, 2.75], [-5.55, 1.95]], { timeout: 20000 });
  i = await holdUntil([...keysFor(1, 0), 'ShiftLeft'], (x) => x.story.flags.branchFree, { timeout: 12000, label: 'empurrar o galho' });
  check(i.story.flags.branchFree, 'a Rhaenyra empurra o galho para longe da porta', i.story.flags);
  check(i.story.clues.includes('telhas'), 'as telhas da tempestade (caso 2) na lupa', i.story.clues);
  await walkTo(-4.83, 1.95, { timeout: 8000 });
  await press('KeyE', 800);
  i = await stageIs('piscina', 6000);
  check(i.story.flags.serviceOpen, 'E abre a porta da área de serviço', i.story);

  console.log('\n== Passo 3: o Faro na piscina (a Reconstrução, assistida) ==');
  await become('radhija');
  await walkPath([[-4.83, 2.2], [-4.83, 0.5], [-4.8, -0.6]], { timeout: 25000 });
  await clearLog();
  await press('KeyV', 800);
  i = await waitFor((x) => x.story.scene === 'reconstrucao', { timeout: 6000 });
  check(i.story.scene === 'reconstrucao', 'o pulso perto da piscina mostra a Reconstrução', i.story);
  await H.sleep(2000);
  await shot('06-reconstrucao.png');
  i = await stageIs('varal', 30000);
  check(i.story.clues.includes('boia'), 'a boia (caso 1) na lupa', i.story.clues);

  console.log('\n== Passo 4: a arrancada no varal ==');
  await walkPath([[-4.8, 0.4], [-6.85, -3.2], [-5.6, -6.3], [-2.0, -6.35], [2.25, -6.6]], { timeout: 40000 });
  await holdUntil(keysFor(0, -1), (x) => !!x.story.scene, { timeout: 1500, during: () => press('ShiftLeft', 60), label: 'arrancada no poste' });
  i = await waitFor((x) => x.story.scene === 'varal' || x.story.stage === 'torre', { timeout: 3000 });
  check(i.story.scene === 'varal' || i.story.stage === 'torre', 'a arrancada no poste sacode o varal', i.story);
  if (i.story.scene) await skipScene('varal');
  i = await stageIs('torre', 10000);
  check(i.story.stage === 'torre', 'os pombos levam a cenoura para a torre', i.story.stage);

  console.log('\n== Passo 5: a porta de mola da torre, a irmã segurando ==');
  await become('rhaenyra');
  await walkTo(3.22, -6.17, { timeout: 15000 });
  i = await holdUntil([...keysFor(1, 0), 'ShiftLeft'], (x) => x.story.doors.tower > 0.65, { timeout: 5000, label: 'empurrar a porta de mola' });
  check(i.story.doors.tower > 0.6, 'a Rhaenyra abre a porta de mola', i.story.doors);
  // segurando, troca para a Radhija: a irmã no vão fica segurando
  await holdUntil([...keysFor(1, 0), 'ShiftLeft'], () => false, { timeout: 500, during: () => press('KeyQ', 100), label: 'trocar segurando a porta' });
  i = await info();
  check(i.activeDog === 'radhija' && i.stay.rhaenyra, 'trocando com a irmã no vão, ela fica segurando (Fica automático)', { active: i.activeDog, stay: i.stay });
  await H.sleep(800);
  check((await story()).doors.tower > 0.3, 'com a irmã no vão, a mola não fecha', (await story()).doors);
  // a irmã segura encostada na folha (do lado da dobradiça): a Radhija passa pelo lado do batente e entra no saguão
  await walkPath([[3.1, -6.0], [3.76, -5.95], [4.4, -5.6]], { timeout: 12000 });
  i = await waitFor((x) => x.story.scene === 'terraco' || x.story.stage === 'portaria', { timeout: 6000 });
  check(i.story.scene === 'terraco' || i.story.stage === 'portaria', 'a Radhija passa pela irmã e entra no saguão: o terraço', i.story);
  if (i.story.scene) {
    await H.sleep(2500);
    await shot('07-terraco.png');
    await skipScene('terraço');
  }
  i = await stageIs('portaria', 10000);
  check((await noOverlap()).length === 0, 'ninguém dentro de nada na torre', await noOverlap());

  console.log('\n== Passo 6: o porteiro ==');
  await walkPath([[3.3, -3.9], [8.6, -3.9], [9.6, -3.95], [10.7, -6.0]], { timeout: 40000 });
  await press('KeyE', 900);
  i = await info();
  check(!i.story.scene && i.story.stage === 'portaria', 'o latido fino da Radhija não acorda o porteiro', i.story);
  await become('rhaenyra');
  await walkTo(11.6, -6.05, { timeout: 15000 });
  await press('KeyE', 600);
  i = await waitFor((x) => x.story.scene === 'porteiro', { timeout: 4000 });
  check(i.story.scene === 'porteiro', 'o latido grave da Rhaenyra acorda o porteiro', i.story);
  await H.sleep(3000);
  await shot('08-porteiro.png');
  await skipScene('porteiro');
  i = await stageIs('fechamento', 10000);
  check(i.story.flags.gateOpen, 'o portãozinho aberto', i.story.flags);

  console.log('\n== Passo 7: o portãozinho (o fechamento, assistido) e o mural ==');
  await walkPath([[12.6, -6.4], [13.0, -8.25]], { timeout: 15000 });
  i = await waitFor((x) => x.story.scene === 'fechamento', { timeout: 4000 });
  check(i.story.scene === 'fechamento', 'no portãozinho, o fechamento', i.story);
  await H.sleep(4000);
  await shot('09-fechamento.png');
  i = await waitFor((x) => x.story.stage === 'mural', { timeout: 30000 });
  await H.sleep(800);
  hs = await hudState();
  check(hs.mural, 'o mural provisório abre', hs);
  const tray = await ev(() => [...document.querySelectorAll('.rr-mural__tray .rr-mural__card')].map((c) => c.dataset.id));
  check(tray.length === 4 && ['pombos', 'pote', 'trilha', 'abraco'].every((id) => tray.includes(id)), 'os quatro cartões do caso 3 na bandeja', tray);
  check(await ev(() => !!document.querySelector('.rr-mural__slot.is-lock')), 'a casa do cartão que falta tem o "?"');
  await H.sleep(1200);
  await shot('10-mural-tutorial.png');
  // a ligação errada volta
  await page.click('.rr-mural__tray [data-id="trilha"]');
  await page.click('.rr-mural__slot[data-slot="0"]');
  await H.sleep(300);
  let board = await ev(() => { const b = window.__game.storyHud.mural.board; return { errors: b.errors, placed: b.placed, loose: b.loose() }; });
  check(board.errors === 1 && board.placed['0'] === null && board.loose.includes('trilha'), 'a ligação errada volta (e conta um erro)', board);
  // arrastar o primeiro cartão até perto da lua
  const a = await page.locator('.rr-mural__tray [data-id="pombos"]').boundingBox();
  const b0 = await page.locator('.rr-mural__slot[data-slot="0"]').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 - 10, { steps: 4 });
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2, { steps: 10 });
  await page.mouse.up();
  await H.sleep(300);
  board = await ev(() => window.__game.storyHud.mural.board.placed);
  check(board['0'] === 'pombos', 'arrastar o cartão dos pombos até perto da lua', board);
  // os outros tocando (cartão, depois casa)
  for (const [id, slot] of [['pote', 2], ['trilha', 3], ['abraco', 4]]) {
    await page.click(`.rr-mural__tray [data-id="${id}"]`);
    await page.click(`.rr-mural__slot[data-slot="${slot}"]`);
    await H.sleep(250);
  }
  const done = await ev(() => { const b = window.__game.storyHud.mural.board; return { settled: b.settled, closed: b.closed }; });
  check(done.settled && !done.closed, 'tudo no lugar; o caso continua aberto (falta o cartão de um capítulo futuro)', done);
  check(await ev(() => !document.querySelector('.rr-mural__go').hidden), 'aparece o Continuar');
  await shot('11-mural-completo.png');
  await clearLog();
  await page.click('.rr-mural__go');
  i = await waitFor((x) => x.story.stage === 'fim', { timeout: 5000 });
  await H.sleep(500);
  hs = await hudState();
  const end = (await logOf('story:chapterEnd')).at(-1);
  check(hs.end && end?.chapter === 1, 'o fim do capítulo, com a lupa, as escondidas e as meias', end);
  await shot('12-fim-do-capitulo.png');
  check((await noOverlap()).length === 0, 'ninguém dentro de nada no fim', await noOverlap());
  // Jogar de novo: a abertura de novo, do começo
  await page.click('.rr-story__end [data-act="again"]');
  i = await waitFor((x) => x.story?.scene === 'abertura', { timeout: 8000 });
  check(i.story.scene === 'abertura' && (await hudState()).clues.length === 0, 'Jogar de novo começa a abertura do zero', i.story);

  console.log('\n== Celular (iPhone 13): o toque no aviso do Faro, o ⏩ segurado e o botão do focinho ==');
  const p = await H.newPage(touchDevice(844, 390, 3, IPHONE_UA), 'iphone13', { lowGfx: true });
  try {
    await p.goto(`${BASE}?historia`, { waitUntil: 'load', timeout: 120000 });
    await p.waitForFunction(() => window.__game?.game?.isStory && window.__game.game.debug.info().story?.scene === 'abertura', null, { timeout: 120000 });
    await p.touchscreen.tap(422, 195);
    await p.waitForFunction(() => window.__game.game.debug.info().story?.waitingFaro, null, { timeout: 120000 });
    const touchKey = await p.evaluate(() => {
      const el = document.querySelector('.rr-story__prompt');
      const key = [...el.querySelectorAll('[data-dev]')].find((k) => getComputedStyle(k).display !== 'none');
      return key?.dataset.dev ?? null;
    });
    check(touchKey === 'touch', 'iPhone: o aviso mostra o botão do focinho (sem tecla)', touchKey);
    const pb = await p.locator('.rr-story__prompt').boundingBox();
    await p.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await p.waitForFunction(() => !window.__game.game.debug.info().story.waitingFaro, null, { timeout: 8000 }).catch(() => {});
    check(!(await p.evaluate(() => window.__game.game.debug.info().story.waitingFaro)), 'iPhone: tocar no aviso dispara o Faro');
    // segurar o ⏩ pula a abertura (o dedo fica no botão)
    await p.evaluate(() => document.querySelector('.rr-story__skip').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true })));
    await p.waitForFunction(() => !window.__game.game.debug.info().story.scene, null, { timeout: 15000 }).catch(() => {});
    await p.evaluate(() => document.querySelector('.rr-story__skip').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', isPrimary: true })));
    const st = await p.evaluate(() => window.__game.game.debug.info().story);
    check(!st.scene && st.stage === 'cozinha', 'iPhone: segurar o ⏩ pula a cena', st);
    await p.touchscreen.tap(422, 195);
    await p.waitForTimeout(800);
    const faroBtn = await p.evaluate(() => {
      const el = document.querySelector('.rr-tbtn--faro');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { shown: el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none', x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    check(faroBtn?.shown, 'iPhone: o botão do focinho nos controles de toque', faroBtn);
    if (faroBtn?.shown) {
      await p.evaluate(() => window.__game.game.debug.clearLog());
      await p.touchscreen.tap(faroBtn.x, faroBtn.y);
      await p.waitForTimeout(600);
      const faros = await p.evaluate(() => window.__game.game.debug.events('story:faro').length);
      check(faros >= 1, 'iPhone: o botão do focinho solta o pulso do Faro', faros);
    }
    await p.evaluate(() => window.__e2eRender?.());
    await p.screenshot({ path: 'shots/historia/13-iphone-faro.png' });
  } catch (err) {
    check(false, `iPhone: erro inesperado: ${err.stack || err.message}`);
  } finally {
    await p.close().catch(() => {});
  }

  console.log('\n== O HUD da história nos tamanhos de tela ==');
  for (const scr of SCREENS) {
    const q = await H.newPage(scr.opts, scr.id, { lowGfx: true });
    try {
      await q.goto(`${BASE}?historia&stage=cozinha`, { waitUntil: 'load', timeout: 120000 });
      await q.waitForFunction(() => window.__game?.game?.isStory && window.__game.game.state === 'playing' && window.__game.game.debug.info().story?.stage === 'cozinha', null, { timeout: 120000 });
      if (scr.touch) await q.touchscreen.tap(scr.opts.viewport.width / 2, scr.opts.viewport.height / 2);
      await q.waitForTimeout(800);
      await settle(q);
      const { width: vw, height: vh } = scr.opts.viewport;
      const name = (s) => `shots/historia/telas-${scr.id}-${s}.png`;
      const snap = async (s) => { await q.evaluate(() => window.__e2eRender?.()); await q.screenshot({ path: name(s) }); };
      if (!scr.portrait) {
        // jogando: a lupa e as meias junto do HUD do jogo, sem sobrepor nada
        const sels = ['.rr-story__lupa', '.rr-story__meias', '.rr-hud__dogs', '.rr-objective', '.rr-level', '.rr-treats', '.rr-esc'];
        const bx = await boxesIn(q, sels);
        check(bx[0] && bx[1], `${scr.id}: lupa e meias na tela`, bx.slice(0, 2));
        check(outside(bx, vw, vh).length === 0, `${scr.id}: HUD inteiro na tela`, outside(bx, vw, vh));
        check(overlapPairs(bx).length === 0, `${scr.id}: HUD sem sobreposição`, overlapPairs(bx));
        await snap('jogando');
        // em cena: as faixas, o pular e o aviso do Faro (o HUD do jogo some)
        await q.evaluate(() => { const e = window.__game.events; e.emit('story:cinema', { on: true, id: 'teste' }); e.emit('story:prompt', { kind: 'faro', on: true }); });
        await q.waitForTimeout(700);
        await settle(q);
        const cine = await boxesIn(q, ['.rr-story__prompt', '.rr-story__skip', '.rr-story__bar--top', '.rr-story__bar--bottom']);
        check(cine[0] && outside([cine[0], cine[1]], vw, vh).length === 0, `${scr.id}: aviso do Faro e pular na tela`, cine.slice(0, 2));
        check(!overlapPairs([cine[0], cine[1]]).length, `${scr.id}: aviso e pular sem sobreposição`, overlapPairs([cine[0], cine[1]]));
        await snap('cena');
        await q.evaluate(() => { const e = window.__game.events; e.emit('story:prompt', { kind: 'faro', on: false }); e.emit('story:title', { eyebrow: 'Capítulo 1', title: 'As Aventuras de Radhija & Rhaenyra', chapter: 'Cadê a Cenoura?' }); });
        await q.waitForTimeout(900);
        const tb = await boxesIn(q, ['.rr-story__title .t-name', '.rr-story__title .t-chapter']);
        check(tb[0] && outside(tb, vw, vh).length === 0, `${scr.id}: cartela do capítulo inteira na tela`, tb);
        await snap('cartela');
        await q.evaluate(() => window.__game.events.emit('story:cinema', { on: false, id: 'teste' }));
        // o mural: tudo na tela, sem sobreposição
        await q.evaluate(() => window.__game.game.debug.setStage('mural'));
        await q.waitForFunction(() => window.__game.storyHud.state().mural, null, { timeout: 8000 });
        await q.waitForTimeout(700);
        const mb = await boxesIn(q, ['.rr-mural__board', '.rr-mural__line', '.rr-mural__tray', '.rr-mural__head']);
        check(mb[0] && outside(mb, vw, vh).length === 0, `${scr.id}: mural inteiro na tela`, outside(mb, vw, vh));
        const cards = await q.evaluate(() => [...document.querySelectorAll('.rr-mural__card, .rr-mural__slot')].map((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; }));
        const small = cards.filter((c) => Math.min(c.w, c.h) < 30);
        check(cards.length >= 9 && small.length === 0, `${scr.id}: cartões e casas grandes o bastante para o dedo (≥ 30 px)`, { n: cards.length, small });
        await snap('mural');
      } else {
        const rot = await q.evaluate(() => { const el = document.querySelector('.rr-rotate'); return !!el && getComputedStyle(el).display !== 'none'; });
        check(rot, `${scr.id}: de pé, o aviso de girar cobre a tela`);
        await snap('de-pe');
      }
      console.log(`  capturas: shots/historia/telas-${scr.id}-*.png`);
    } catch (err) {
      check(false, `${scr.id}: erro inesperado: ${err.stack || err.message}`);
    } finally {
      await q.close().catch(() => {});
    }
  }
} catch (err) {
  check(false, `erro inesperado: ${err.stack || err.message}`);
} finally {
  const failed = await H.close();
  process.exit(failed ? 1 : 0);
}
