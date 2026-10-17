// Protótipo DEV: teleporte prepara estações; ações do puzzle usam entrada real.
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
try {
  await load('?level=fase6&play');
  let state = await info();
  const layout = await ev(() => {
    const { PEDAL, BLOW_SPOT, TRAY, GOAL } = window.__game.layout;
    return { PEDAL, BLOW_SPOT, TRAY, GOAL };
  });
  check(state.levelId === 'fase6' && state.state === 'playing', 'protótipo carregado pelo id');
  check(state.stage === 'waiting' && state.expresso.route === 'loop', 'início com trilho circular e trem parado');
  await shot('01-oficina.png');
  await station('radhija', layout.BLOW_SPOT);
  await H.press('KeyE');
  check((await info()).expresso.trips === 0, 'interagir/latir não substitui superbafo');
  await H.clearLog();
  await blow();
  state = await waitFor((i) => i.expresso.trips === 1, { timeout: 6000 });
  check(state.expresso.trips === 1 && state.expresso.tripRoute === 'loop', 'nuvem real inicia a rota escolhida');
  check((await H.logOf('dog:bafo')).length === 1, 'comando real de superbafo confirmado');
  state = await waitFor((i) => i.stage === 'waiting' && i.expresso.armed, { timeout: 25000 });
  check(state.stage === 'waiting' && state.ball.holder === null, 'rota circular retorna com o item e permite nova tentativa');

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
  state = await waitFor((i) => i.expresso.route === 'delivery', { timeout: 3000 });
  check(state.expresso.route === 'delivery' && state.expresso.routeChanges === 1, 'pouso pelo controle troca trilho uma única vez');
  check((await H.logOf('dog:jump')).length === 1 && (await H.logOf('dog:land')).length === 1, 'pulo e pouso reais confirmados');
  await ev(() => { window.__fakePads = []; });
  await H.sleep(700);
  check((await info()).expresso.routeChanges === 1, 'permanecer no pedal não repete a troca');
  await shot('02-trilho-da-estrela.png');

  await station('radhija', layout.BLOW_SPOT);
  check((await info()).expresso.route === 'delivery', 'troca de personagem preserva escolha');
  await blow();
  state = await waitFor((i) => ['sneezing', 'movingDelivery'].includes(i.stage), { timeout: 6000 });
  check(['sneezing', 'movingDelivery'].includes(state.stage), 'segundo sopro inicia viagem à bandeja');
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
  state = await waitFor((i) => i.stage === 'ready', { timeout: 25000 });
  check(state.stage === 'ready' && state.expresso.trips === 2, 'viagem entrega uma única bolinha');
  await H.press('KeyE');
  state = await info();
  check(state.stage === 'carrying' && state.ball.holder === 'radhija', 'interação pega item após chegada');
  await H.walkPath([[layout.TRAY.x, 2.6], [layout.GOAL.x, 2.6], [layout.GOAL.x, layout.GOAL.z]]);
  state = await waitFor((i) => ['celebrating', 'victory'].includes(i.state), { timeout: 8000 });
  check(state.stage === 'done' && ['celebrating', 'victory'].includes(state.state), 'percurso externo e entrega concluem missão');
  await shot('03-planeta-entregue.png');
  await ev(() => window.__game.game.reset());
  state = await info();
  check(state.stage === 'waiting' && state.expresso.route === 'loop' && state.ball.holder === null, 'reinício restaura trem, rota e item');
  check(state.expresso.trips === 0 && state.expresso.routeChanges === 0 && state.expresso.blockedCloudIdsCount === 0, 'reinício limpa contadores e bloqueios de nuvens');
  await load('?play');
  check(!(await ev(() => window.__game.levels.some((level) => level.id === 'fase6'))), 'catálogo normal continua sem o protótipo');
} catch (error) {
  check(false, `exceção: ${error.stack || error}`);
}
const failures = await H.close();
process.exit(failures ? 1 : 0);
