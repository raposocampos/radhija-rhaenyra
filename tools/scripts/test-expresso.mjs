// Fase 6 (Expresso do Superbafo): teleporte prepara estações; ações do puzzle usam entrada real.
// Fluxo: volta → pedal (lua) → o trem busca a lua no pórtico → pedal (estrela) → cancela fechada barra →
// Rhaenyra fica na placa → as duas cargas descem até a bandeja → uma em cada boca até o foguete, que decola.
// No fim, o menu da campanha: nove fases em linhas equilibradas e o save liberando a 6, a 7, a 8 e a 9 em ordem.
import { createHarness, parseArgs } from './lib/harness.mjs';
const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/expresso' });
const { check, info, ev, load, waitFor, page, shot } = H;
const station = async (name, point) => {
  if ((await info()).activeDog !== name) await H.press('KeyQ');
  await ev(({ name, point }) => {
    const g = window.__game.game;
    g.debug.teleport(name, point.x, point.z);
    if (point.yaw !== undefined) g.debug.ctrls[name].yaw = point.yaw;
  }, { name, point });
  await H.sleep(200);
};
const blow = () => H.hold(['KeyR'], 450);
const CAMPAIGN = 'fase1,fase2,fase3,fase4,fase5,fase6,fase7,fase8,fase9';
const done = (id) => [id, { done: true, best: 95.5, treats: 1, total: 3, clears: 1 }];
/** Grava um save v1 (chave de produção: o servidor do E2E não é uma prévia), abre Jogar → Fases e lê os cartões. */
const menuWith = async (ids) => {
  const saved = JSON.stringify({ v: 1, levels: Object.fromEntries(ids.map(done)) });
  await ev((saved) => localStorage.setItem('rr-progress-v1', saved), saved);
  await load('');
  await page.click('.rr-btn--play');
  await page.click('.rr-mode--levels');
  await H.sleep(700);
  return ev((saved) => ({
    state: window.__game.game.state,
    unchanged: localStorage.getItem('rr-progress-v1') === saved,
    cards: [...document.querySelectorAll('.rr-levels .rr-lvcard')].map((card) => ({
      num: card.querySelector('.rr-lvcard__num')?.textContent,
      locked: card.classList.contains('is-locked'),
      top: card.offsetTop, // posição de layout (sem o transform do foco)
    })),
  }), saved);
};
/** Quantos cartões em cada linha, pela posição de layout (sem o transform do foco). */
const rowsOf = (cards) => [...new Set(cards.map((card) => card.top))].map((top) => cards.filter((card) => card.top === top).length).join();
const layoutCards = () => ev(() => [...document.querySelectorAll('.rr-levels .rr-lvcard')].map((card) => ({ top: card.offsetTop })));
/** Clica num cartão bloqueado: o aviso aparece acima da linha de cima, sem cobrir nenhum cartão. */
const lockedNote = async () => {
  await page.click('.rr-levels .rr-lvcard.is-locked');
  await H.sleep(400);
  return ev(() => {
    const note = document.querySelector('.rr-levels__note.is-on')?.getBoundingClientRect();
    const top = Math.min(...[...document.querySelectorAll('.rr-levels .rr-lvcard')].map((card) => card.getBoundingClientRect().top));
    return { shown: !!note, bottom: note?.bottom, top, clear: !!note && note.bottom <= top - 4 };
  });
};
try {
  await load('?level=fase6&play');
  let state = await info();
  const layout = await ev(() => {
    const { PEDAL, BLOW_SPOT, TRAY, GOAL, TRAIN, BARRIER_PLATE, MOON } = window.__game.layout;
    return { PEDAL, BLOW_SPOT, TRAY, GOAL, TRAIN_START: TRAIN.start, BARRIER_PLATE, MOON };
  });
  check(state.levelId === 'fase6' && state.state === 'playing', 'link por id (?level=fase6) abre a fase 6');
  const catalog = await ev(() => ({ ids: window.__game.levels.map((level) => level.id).join(), level: window.__game.game.debug.info().level }));
  check(catalog.ids === CAMPAIGN && catalog.level === 5, 'o link usa a campanha (sexta de nove), sem catálogo de desenvolvimento', JSON.stringify(catalog));
  check(state.stage === 'waiting' && state.expresso.route === 'loop', 'início com trilho circular e trem parado');
  check(state.expresso.barrier.open === 0 && state.expresso.place.moon === 'gantry', 'cancela fechada e lua presa no pórtico');
  await shot('01-oficina.png');
  await station('radhija', layout.BLOW_SPOT);
  await H.press('KeyE');
  check((await info()).expresso.trips === 0, 'interagir/latir não substitui superbafo');
  await H.clearLog();
  await blow();
  state = await waitFor((i) => i.expresso.trips === 1, { timeout: 6000 });
  check(state.expresso.trips === 1 && state.expresso.tripRoute === 'loop', 'nuvem real inicia a rota escolhida');
  check((await H.logOf('dog:bafo')).length === 1, 'comando real de superbafo confirmado');
  state = await waitFor((i) => (i.expresso.distance || 0) > 2.3 || i.stage === 'waiting', { timeout: 8000 });
  await shot('01b-volta-na-curva.png');
  check(state.stage !== 'sneezing', 'o atchim deu a partida de ré');
  state = await waitFor((i) => i.stage === 'returning' || i.stage === 'waiting', { timeout: 12000 });
  check(['returning', 'waiting'].includes(state.stage), 'a volta chega pela curva do sul');
  state = await waitFor((i) => i.stage === 'waiting' && i.expresso.armed, { timeout: 25000 });
  check(state.stage === 'waiting' && state.ball.holder === null, 'rota circular retorna com o item e permite nova tentativa');
  check(Math.abs(state.expresso.train.yaw - layout.TRAIN_START.yaw) < 1e-6 && Math.abs(state.expresso.train.z - layout.TRAIN_START.z) < 1e-6,
    'o trem volta à estação olhando para a janela, sem girar no lugar');
  check((await H.logOf('expresso:atchim')).length === 1 && (await H.logOf('expresso:return')).length === 1, 'um atchim e um apito de volta por viagem');

  // pedal pelo controle: a agulha aponta para a lua
  await station('rhaenyra', layout.PEDAL);
  await H.sleep(750);
  await H.press('KeyE');
  check((await info()).expresso.route === 'loop', 'ficar no pedal e interagir não mudam o trilho');
  await H.clearLog();
  await ev(() => {
    window.__fakePads = [{ id: 'Controle falso (DualSense)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
  });
  await H.sleep(100);
  await ev(() => { const p = window.__fakePads[0]; p.buttons[0] = { pressed: true, value: 1 }; p.timestamp = performance.now(); });
  await H.sleep(800);
  await ev(() => { const p = window.__fakePads[0]; p.buttons[0] = { pressed: false, value: 0 }; p.timestamp = performance.now(); });
  state = await waitFor((i) => i.expresso.route === 'moon', { timeout: 3000 });
  check(state.expresso.route === 'moon' && state.expresso.routeChanges === 1, 'pouso pelo controle leva a agulha à lua, uma única vez');
  check((await H.logOf('dog:jump')).length === 1 && (await H.logOf('dog:land')).length === 1, 'pulo e pouso reais confirmados');
  check(await page.locator('.rr-objective__text .k-pad [aria-label="L2 / LT"]').isVisible(), 'dica do superbafo mostra L2/LT quando o controle está ativo');
  await ev(() => { window.__fakePads = []; });
  await H.sleep(700);
  check((await info()).expresso.routeChanges === 1, 'permanecer no pedal não repete a troca');
  await shot('02-seta-da-lua.png');

  // o trem busca a lua: a portinhola do pórtico abre e ela cai no vagão, ao lado do planeta
  await station('radhija', layout.BLOW_SPOT);
  check((await info()).expresso.route === 'moon', 'troca de personagem preserva escolha');
  await blow();
  state = await waitFor((i) => i.expresso.loading, { timeout: 12000 });
  check(state.expresso.loading && state.stage === 'movingMoon', 'o trem chegou embaixo do pórtico');
  await H.gsleep(420); // a lua no meio da queda
  await shot('02a-lua-caindo.png');
  state = await waitFor((i) => i.stage === 'moonLoaded' && i.expresso.mode === 'idle', { timeout: 15000 });
  check(state.stage === 'moonLoaded' && state.expresso.cargo.join() === 'planet,moon', 'o trem voltou com as duas cargas');

  // pulo até a estrela; sem ninguém na placa, a cancela segura o trem e ele volta com as cargas
  await station('rhaenyra', layout.PEDAL);
  await H.sleep(300);
  await H.press('Space');
  state = await waitFor((i) => i.expresso.route === 'delivery', { timeout: 3000 });
  check(state.expresso.route === 'delivery' && state.expresso.routeChanges === 2, 'da lua, um pulo leva à estrela');
  check(/placa/.test(state.objective || ''), 'com a cancela fechada, o objetivo manda a Rhaenyra para a placa');
  await station('radhija', layout.BLOW_SPOT);
  await H.clearLog();
  await blow();
  state = await waitFor((i) => i.stage === 'blocked', { timeout: 15000 });
  check(state.stage === 'blocked' && state.expresso.barrier.open === 0, 'cancela fechada barra a viagem da estrela');
  await shot('02b-cancela-fechada.png');
  check((await H.logOf('expresso:blocked')).length === 1, 'um apito de cancela fechada');
  state = await waitFor((i) => i.stage === 'moonLoaded' && i.expresso.mode === 'idle' && i.expresso.armed, { timeout: 20000 });
  check(state.expresso.cargo.length === 2 && state.expresso.trips === 3, 'o trem volta à estação com as duas cargas');

  // a Rhaenyra fica na placa (F) e a cancela sobe
  await station('rhaenyra', layout.BARRIER_PLATE);
  await H.press('KeyQ');
  await H.press('KeyF');
  state = await waitFor((i) => i.expresso.barrier.open === 1, { timeout: 4000 });
  check(state.activeDog === 'radhija' && state.stay.rhaenyra && state.expresso.barrier.plate, 'Fica: a Rhaenyra segura a placa da cancela');
  check(state.expresso.barrier.open === 1, 'a cancela subiu');
  await shot('02c-cancela-aberta.png');

  await station('radhija', layout.BLOW_SPOT);
  await blow();
  state = await waitFor((i) => ['sneezing', 'movingDelivery'].includes(i.stage), { timeout: 6000 });
  check(['sneezing', 'movingDelivery'].includes(state.stage), 'com a cancela aberta, o sopro inicia viagem à bandeja');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__game.game.state === 'paused');
  const paused = await info();
  // simSec acompanha o loop mesmo em pausa; timeSec e o puzzle devem ficar parados.
  // O intervalo ultrapassa o espirro, provando que a página processou quadros.
  state = await waitFor((i) => i.simSec >= paused.simSec + 1.5, { timeout: 3000 });
  check(state.state === 'paused' && state.simSec >= paused.simSec + 1.5 && state.timeSec === paused.timeSec
    && state.stage === paused.stage && JSON.stringify(state.expresso.train) === JSON.stringify(paused.expresso.train), 'pausa conserva tempo da partida, estágio e trem enquanto o loop continua');
  await ev((p) => window.__game.game.debug.teleport('radhija', p.x, p.z), layout.TRAY);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__game.game.state === 'playing');
  await H.press('KeyE');
  check((await info()).ball.holder === null, 'retirada recusada durante percurso');
  state = await waitFor((i) => i.expresso.unloading || i.stage === 'ready', { timeout: 25000 });
  if (state.expresso.unloading) {
    await H.sleep(520); // caçamba no alto, as duas descendo a canaleta
    await shot('03-descarga-das-duas.png');
  }
  check((await H.logOf('expresso:unload')).length === 1, 'a caçamba bascula uma vez no fim da entrega');
  state = await waitFor((i) => i.stage === 'ready', { timeout: 25000 });
  check(state.stage === 'ready' && state.expresso.trips === 4 && state.expresso.place.moon === 'tray', 'uma viagem leva as duas cargas à bandeja');
  const earlyHint = await ev(() => window.__game.game.puzzle.TEXT.hint.early);
  await station('radhija', { x: layout.TRAY.x, z: layout.TRAY.z + 0.7, yaw: 0 });
  await H.sleep(2700); // expira o cooldown da dica usada antes da chegada.
  await H.clearLog();
  await H.press('KeyE');
  state = await info();
  check(state.stage === 'ready' && state.ball.holder === null && state.moon.holder === null, 'interação na borda da bandeja não retira carga');
  check(!(await H.logOf('hint')).some((hint) => hint.text === earlyHint), 'carga na bandeja não recebe dica de que ainda está no trem');
  await station('radhija', { x: layout.TRAY.x - 0.1, z: layout.TRAY.z + 0.35, yaw: Math.PI });
  await H.press('KeyE');
  state = await info();
  check(state.stage === 'carrying' && state.ball.holder === 'radhija', 'interação pega o planeta após a chegada');
  await H.sleep(2700);
  await H.clearLog();
  await H.press('KeyE');
  check((await info()).ball.holder === 'radhija' && !(await H.logOf('hint')).some((hint) => hint.text === earlyHint),
    'interagir novamente com a bolinha na boca não anuncia que ela está no trem');
  // a outra boca: a Rhaenyra sai da placa, pega a lua e as duas levam juntas ao foguete
  await station('rhaenyra', { x: layout.TRAY.x + 0.1, z: layout.TRAY.z + 0.35, yaw: Math.PI });
  await H.press('KeyE');
  state = await info();
  check(state.moon.holder === 'rhaenyra' && state.ball.holder === 'radhija', 'cada irmã leva uma carga na boca');
  check(state.dogs.radhija.carrying && state.dogs.rhaenyra.carrying, 'as duas aparecem carregando');
  await shot('04-as-duas-na-boca.png');
  await H.walkPath([[layout.TRAY.x + 0.1, 2.6], [layout.GOAL.x, 2.6], [layout.GOAL.x, layout.GOAL.z]]);
  state = await waitFor((i) => ['celebrating', 'victory'].includes(i.state), { timeout: 10000 });
  check(state.stage === 'done' && ['celebrating', 'victory'].includes(state.state), 'as duas chegam juntas e o foguete conclui a missão');
  check((await H.logOf('expresso:launch')).length === 1, 'o foguete decola uma vez');
  await H.gsleep(1600); // tremeu, acendeu e está subindo
  await shot('05-foguete-decola.png');
  state = await waitFor((i) => i.state === 'victory', { timeout: 12000 });
  await H.gsleep(400);
  const next = await ev(() => !!document.querySelector('.rr-victory [data-action="next"]'));
  check(state.state === 'victory' && next, 'vitória da fase 6 oferece "Próxima fase" (a 7)');
  await ev(() => window.__game.game.reset());
  state = await info();
  check(state.stage === 'waiting' && state.expresso.route === 'loop' && state.ball.holder === null && state.moon.holder === null, 'reinício restaura trem, rota e cargas');
  check(state.expresso.place.planet === 'wagon' && state.expresso.place.moon === 'gantry' && state.expresso.barrier.open === 0, 'reinício devolve planeta, lua e cancela');
  check(state.expresso.trips === 0 && state.expresso.routeChanges === 0 && state.expresso.blockedCloudIdsCount === 0, 'reinício limpa contadores e bloqueios de nuvens');
  await load('?level=6&play');
  state = await info();
  check(state.levelId === 'fase6' && (await ev(() => window.__game.levels.map((level) => level.id).join())) === CAMPAIGN, 'posição na lista (?level=6) também abre a fase 6');

  // ---------------------------------------------------------------- menu da campanha e save v1
  let menu = await menuWith(['fase1', 'fase2', 'fase3', 'fase4', 'fase5']);
  const nums = menu.cards.map((card) => card.num).join();
  check(menu.state === 'title' && nums === '1,2,3,4,5,6,7,8,9', 'menu com as nove fases em ordem', nums);
  check(rowsOf(menu.cards) === '5,4', 'cartões em duas linhas equilibradas (5 + 4)', rowsOf(menu.cards));
  check(menu.cards.map((card) => card.locked).join() === 'false,false,false,false,false,false,true,true,true', 'fase 5 concluída libera a 6; a 7, a 8 e a 9 continuam bloqueadas', JSON.stringify(menu.cards));
  check(menu.unchanged, 'abrir o menu não reescreve o save antigo (medalhas e conclusões preservadas)');
  await page.evaluate(() => document.fonts.ready);
  check(await ev(() => [...document.querySelectorAll('.rr-levels .rr-lvcard__name')].every((name) => name.scrollWidth <= name.clientWidth)), 'nomes das nove fases inteiros nos cartões (sem reticências) em 1280 px');
  await shot('00-menu-nove-fases.png');
  let note = await lockedNote();
  check(note.clear, 'aviso de fase bloqueada acima das duas linhas, sem cobrir cartões', JSON.stringify(note));
  await shot('00b-aviso-fase-bloqueada.png');
  // perto do modo compacto (761–800 px) os cartões encolhem e as linhas continuam 5 + 4
  for (const width of [780, 1024]) {
    await page.setViewportSize({ width, height: 720 });
    await H.sleep(400);
    const cards = await layoutCards();
    check(rowsOf(cards) === '5,4', `${width} px: cartões em 5 + 4`, rowsOf(cards));
    note = await lockedNote();
    check(note.clear, `${width} px: aviso acima dos cartões`, JSON.stringify(note));
    if (width === 780) await shot('00c-menu-780px.png');
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await H.sleep(300);
  menu = await menuWith(['fase1', 'fase2', 'fase3', 'fase4']);
  check(menu.cards[5]?.locked === true && menu.cards[6]?.locked === true && menu.cards[7]?.locked === true && menu.cards[8]?.locked === true, 'sem a fase 5 concluída, a 6, a 7, a 8 e a 9 ficam bloqueadas');
  menu = await menuWith(['fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase6']);
  check(!menu.cards[6]?.locked && menu.cards[7]?.locked === true && menu.unchanged, 'fase 6 concluída libera a 7 (a 8 espera a 7)');
  menu = await menuWith(['fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase6', 'fase7']);
  check(!menu.cards[7]?.locked && menu.cards[8]?.locked === true && menu.unchanged, 'fase 7 concluída libera a 8 (a 9 espera a 8)');
  menu = await menuWith(['fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase6', 'fase7', 'fase8']);
  check(menu.cards.every((card) => !card.locked) && menu.unchanged, 'fase 8 concluída libera a 9');
  await ev(() => localStorage.removeItem('rr-progress-v1'));
} catch (error) {
  check(false, `exceção: ${error.stack || error}`);
}
const failures = await H.close();
process.exit(failures ? 1 : 0);
