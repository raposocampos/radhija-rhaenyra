// Lambe-Lambe e a fase 7 (depois dela vem a 8) no navegador: teleporte só prepara trechos; túnel, trinco,
// Lambe-Lambe, arrancada no escorregador, pegar e entregar usam entrada real (teclado e controle falso).
// Fluxo: a Radhija atravessa o túnel e sai enlameada → sem arrancada e escorregando → destrava o portão →
// a Rhaenyra lambe até limpar → arrancada sobe o escorregador e desce com o frisbee → bolinha e frisbee
// no piquenique. Antes, o Lambe-Lambe na fase 1 com as duas dogs (teclado L e L2): não vira superbafo, e o R e o
// R2 continuam sendo o superbafo da Radhija.
import { createHarness, parseArgs } from './lib/harness.mjs';
const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/lambe' });
const { check, info, ev, load, waitFor, page, shot } = H;
const lambe = (i) => i.lambe || {};
/** Põe a dog num ponto (preparo) e a deixa ativa; a outra fica (Fica). */
const station = async (name, point) => {
  if ((await info()).activeDog !== name) await H.press('KeyQ');
  await ev(({ name, point }) => {
    const g = window.__game.game;
    g.debug.teleport(name, point.x, point.z);
    if (point.yaw !== undefined) g.debug.ctrls[name].yaw = point.yaw;
    g.setStay(name === 'radhija' ? 'rhaenyra' : 'radhija', true);
  }, { name, point });
  await H.sleep(250);
};
const fakePad = () => ev(() => {
  window.__fakePads = [{ id: 'Controle falso (DualSense)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
});
const padButton = (index, on) => ev(({ index, on }) => {
  const p = window.__fakePads[0];
  p.buttons[index] = { pressed: on, value: on ? 1 : 0 };
  p.timestamp = performance.now();
}, { index, on });

try {
  // ---------------------------------------------------------------- Lambe-Lambe na fase 1 (sem efeito de fase)
  console.log('\n== Lambe-Lambe na fase 1 ==');
  await load('?level=1&play&dog=rhaenyra');
  await ev(() => {
    const g = window.__game.game;
    const r = g.debug.ctrls.rhaenyra;
    g.debug.teleport('radhija', r.x + 0.85, r.z);
    g.debug.ctrls.radhija.yaw = -Math.PI / 2;
    g.setStay('radhija', true);
  });
  await H.sleep(300);
  await H.clearLog();
  let state = await H.holdUntil(['KeyL'], (i) => i.lick.strokes >= 2, { timeout: 3000 });
  check(state.lick.strokes >= 2 || (await H.logOf('dog:lick')).length >= 2, 'segurar L lambe a irmã em ritmo');
  check((await H.logOf('dog:bafo')).length === 0, 'L com a Rhaenyra não vira superbafo');
  state = await waitFor((i) => !i.lick.on, { timeout: 2000 });
  check(!state.lick.on, 'soltar L termina a lambida');
  await H.clearLog();
  await H.hold(['KeyR'], 300);
  await H.sleep(200);
  state = await info();
  check(!state.lick.on && (await H.logOf('lick:start')).length === 0 && (await H.logOf('hint')).some((h) => h.text.startsWith('Só a Radhija tem o superbafo')), 'R com a Rhaenyra: só a dica do superbafo (não lambe)');
  // L2 do controle faz o mesmo
  await fakePad();
  await H.sleep(150);
  await H.clearLog();
  await padButton(6, true);
  state = await waitFor((i) => i.lick.on && i.lick.stage === 'licking' && i.lick.strokes >= 1, { timeout: 3000 });
  await padButton(6, false);
  check((await H.logOf('lick:start')).length === 1 && state.lick.strokes >= 1, 'L2/LT também lambe');
  await waitFor((i) => !i.lick.on, { timeout: 2000 });
  await ev(() => { window.__fakePads = []; });
  await H.sleep(300);

  // a Radhija também lambe (L), na bochecha da irmã maior; R e R2 seguem sendo o superbafo dela
  console.log('\n== A Radhija lambe a Rhaenyra ==');
  await H.press('KeyQ');
  await ev(() => {
    const g = window.__game.game;
    const r = g.debug.ctrls.rhaenyra;
    r.yaw = Math.PI / 2;
    g.debug.teleport('radhija', r.x + 0.32, r.z - 0.62);
    g.debug.ctrls.radhija.yaw = 0;
    g.setStay('rhaenyra', true);
  });
  await H.sleep(300);
  await H.clearLog();
  await page.keyboard.down('KeyL');
  state = await waitFor((i) => i.lick.on && i.lick.by === 'radhija' && i.lick.stage === 'licking' && i.lick.strokes >= 2 && i.lick.phase > 0.3 && i.lick.phase < 0.6, { timeout: 4000 });
  check(state.lick.by === 'radhija' && state.lick.target === 'rhaenyra' && state.dogs.radhija.action === 'lick' && state.dogs.rhaenyra.action === 'licked', 'L com a Radhija lambe a Rhaenyra (e ela fecha os olhos)', `${state.lick.by}→${state.lick.target} ${state.dogs.radhija.action}/${state.dogs.rhaenyra.action}`);
  await shot('00-radhija-lambe.png');
  await page.keyboard.up('KeyL');
  state = await waitFor((i) => !i.lick.on, { timeout: 2000 });
  const licksRad = await H.logOf('dog:lick');
  check(!state.lick.on && licksRad.length >= 2 && licksRad.every((l) => l.name === 'radhija' && l.target === 'rhaenyra'), 'soltar L termina; cada lambida chegou na irmã', JSON.stringify(licksRad.slice(0, 2)));
  check((await H.logOf('dog:bafo')).length === 0, 'L com a Radhija não sopra');
  await H.clearLog();
  await page.keyboard.down('KeyR');
  state = await waitFor((i) => i.bafo.aiming, { timeout: 2000 });
  await page.keyboard.up('KeyR');
  await H.sleep(250);
  check((await H.logOf('dog:bafo')).length === 1 && (await H.logOf('lick:start')).length === 0, 'R com a Radhija continua sendo o superbafo');
  await H.sleep(900); // resfriamento do bafo
  await fakePad();
  await H.sleep(150);
  await H.clearLog();
  await padButton(7, true);
  state = await waitFor((i) => i.bafo.aiming, { timeout: 2000 });
  await padButton(7, false);
  await H.sleep(250);
  check((await H.logOf('dog:bafo')).length === 1, 'R2/RT: superbafo');
  await ev(() => { window.__fakePads = []; });
  await H.sleep(300);

  // ---------------------------------------------------------------- fase 7
  console.log('\n== Fase 7: Lambe-Lambe na Pracinha ==');
  await load('?level=fase7&play');
  state = await info();
  const L = await ev(() => {
    const l = window.__game.layout;
    return { TUNNEL: l.TUNNEL, LATCH: l.LATCH, FENCE: l.FENCE, GATE: l.GATE, SLIDE: l.SLIDE, SLIDE_ENTRY: l.SLIDE_ENTRY, BALL: l.BALL, GOAL: l.GOAL };
  });
  check(state.levelId === 'fase7' && state.stage === 'start', 'link por id (?level=fase7) abre a fase 7');
  const catalog = await ev(() => ({ ids: window.__game.levels.map((level) => level.id).join(), level: window.__game.game.debug.info().level }));
  check(catalog.ids.startsWith('fase1,fase2,fase3,fase4,fase5,fase6,fase7,') && !/pulo|bafo|modelo/.test(catalog.ids) && catalog.level === 6, 'o link usa a campanha (a sétima fase), sem catálogo de desenvolvimento', JSON.stringify(catalog));
  check(lambe(state).place?.frisbee === 'top' && lambe(state).place?.ball === 'ground' && !lambe(state).gateOpen, 'frisbee no escorregador, bolinha no parquinho, portão fechado');
  await shot('01-pracinha.png');

  // a Rhaenyra não cabe no túnel
  await station('rhaenyra', { x: L.TUNNEL.x0 - 0.6, z: L.TUNNEL.z, yaw: Math.PI / 2 });
  await H.hold(H.keysFor(1, 0), 900);
  state = await info();
  check(state.dogs.rhaenyra.x < L.TUNNEL.x0, 'a Rhaenyra empaca na boca do túnel');

  // a Radhija atravessa e sai enlameada
  await station('radhija', { x: L.TUNNEL.x0 - 0.5, z: L.TUNNEL.z, yaw: Math.PI / 2 });
  await H.clearLog();
  await H.walkTo((L.TUNNEL.x0 + L.TUNNEL.x1) / 2, L.TUNNEL.z, { tol: 0.15 });
  await shot('02-dentro-do-tunel.png');
  await H.walkTo(L.TUNNEL.x1 + 0.55, L.TUNNEL.z + 0.1, { tol: 0.2 });
  state = await info();
  check(lambe(state).mud.radhija.k === 1 && lambe(state).inside.radhija, 'atravessou o túnel e saiu enlameada');
  check(state.stage === 'inside', 'etapa: dentro do parquinho com o portão fechado');
  check((await H.logOf('mud:soak')).length >= 1, 'entrou na lama (evento para som e respingos)');
  await H.walkTo(L.TUNNEL.x1 + 0.9, L.TUNNEL.z + 0.45, { tol: 0.2 }); // pegadas de barro no piso
  await shot('03-enlameada.png');
  await H.clearLog();
  await H.holdUntil(H.keysFor(1, 0), () => false, { timeout: 400, during: () => page.keyboard.press('ShiftLeft') });
  check((await H.logOf('dog:dash')).length === 0 && (await H.logOf('dog:dashBlocked')).length >= 1, 'enlameada não tem arrancada');

  // enlameada, escorrega no escorregador
  await station('radhija', { x: L.SLIDE_ENTRY.minX - 0.35, z: L.SLIDE.z, yaw: Math.PI / 2 });
  await H.clearLog();
  state = await H.holdUntil(H.keysFor(1, 0), (i) => !!i.lambe.slide, { timeout: 2500 });
  state = await waitFor((i) => !lambe(i).slide, { timeout: 4000 });
  const slips = await H.logOf('slide:slip');
  check(slips.length === 1 && slips[0].reason === 'slipMud' && lambe(state).place.frisbee === 'top', 'enlameada escorrega de volta');

  // destrava o portão por dentro
  await station('radhija', { x: L.LATCH.x - 0.3, z: L.LATCH.z - 0.6, yaw: 0 });
  await H.walkTo(L.LATCH.x, L.LATCH.z - 0.05, { tol: 0.12 });
  await H.press('KeyE');
  state = await waitFor((i) => lambe(i).gateOpen, { timeout: 4000 });
  check(lambe(state).gateOpen, 'a Radhija destrava o portão por dentro');
  await H.gsleep(900);
  await shot('04-portao-aberto.png');
  // a folha abre por cima do trinco: a Radhija pula para fora do caminho dela, do lado do vão (antes, sob carga, a
  // folha a arrastava para trás dela e a Rhaenyra não a alcançava para o Lambe-Lambe)
  const rad = await ev(() => { const c = window.__game.game.debug.ctrls.radhija; return { x: c.x, z: c.z, r: c.r }; });
  check(rad.x > L.GATE.hinge.x && Math.hypot(rad.x - L.GATE.hinge.x, rad.z - L.GATE.hinge.z) > L.GATE.length + rad.r, 'a folha do portão não arrasta a Radhija (ela pula para o lado do vão)', `${rad.x.toFixed(2)}, ${rad.z.toFixed(2)}`);

  // Lambe-Lambe até limpar
  await station('rhaenyra', { x: L.LATCH.x - 0.35, z: L.LATCH.z - 0.75, yaw: 0.4 });
  await H.clearLog();
  await page.keyboard.down('KeyL');
  state = await waitFor((i) => i.lick.strokes >= 2 && i.lick.stage === 'licking' && i.lick.phase > 0.25 && i.lick.phase < 0.55, { timeout: 5000 });
  await shot('05-lambe-lambe.png');
  state = await waitFor((i) => lambe(i).mud.radhija.k === 0, { timeout: 8000 });
  await page.keyboard.up('KeyL');
  // pelo registro da página (não depende de a leitura pegar o instante): a lambida começou e foi na irmã
  check((await H.logOf('lick:start')).some((l) => l.name === 'rhaenyra' && l.target === 'radhija'), 'segurar L com a Rhaenyra começa o Lambe-Lambe na irmã', (await H.logOf('hint')).map((h) => h.text).join(' | '));
  check(lambe(state).mud.radhija.k === 0, 'cinco lambidas limpam a Radhija');
  check((await H.logOf('mud:lick')).length === 5 && (await H.logOf('mud:clean')).length === 1, 'cada lambida tira uma placa; a última deixa limpinha');
  await H.gsleep(800);
  await shot('06-limpinha.png');
  state = await waitFor((i) => i.stage === 'clean' && !i.lick.on, { timeout: 3000 });
  check(state.stage === 'clean', 'etapa: limpinha, frisbee ainda no alto');

  // a Rhaenyra pega a bolinha
  await station('rhaenyra', { x: L.BALL.x, z: L.BALL.z + 0.4, yaw: Math.PI });
  await H.press('KeyE');
  check((await info()).ball.holder === 'rhaenyra', 'a Rhaenyra pega a bolinha (E)');

  // arrancada sobe o escorregador; lá em cima pega o frisbee e desce de barriga
  await station('radhija', { x: L.SLIDE_ENTRY.minX - 0.3, z: L.SLIDE.z, yaw: Math.PI / 2 });
  await H.clearLog();
  await H.holdUntil(H.keysFor(1, 0), (i) => !!i.lambe.slide, { timeout: 2000, during: () => page.keyboard.press('ShiftLeft') });
  state = await waitFor((i) => lambe(i).slide?.phase === 'grab', { timeout: 4000 });
  check(lambe(state).slide?.mode === 'climb' && lambe(state).slide.y > L.SLIDE.deck - 0.05, 'a arrancada sobe a rampa até o deque');
  await shot('07-no-alto.png');
  state = await waitFor((i) => lambe(i).slide?.phase === 'down', { timeout: 4000 });
  await H.gsleep(380);
  await shot('08-descendo.png');
  state = await waitFor((i) => !lambe(i).slide, { timeout: 5000 });
  check(state.frisbee.holder === 'radhija' && state.dogs.radhija.y === 0, 'desceu com o frisbee na boca');
  check((await H.logOf('slide:down')).length === 1 && (await H.logOf('slide:land')).length === 1, 'eventos da descida (som do escorregador)');

  // as duas levam ao piquenique (a Rhaenyra deixa de ficar e acompanha com a bolinha)
  await H.press('KeyF');
  await H.walkPath([[1.0, -0.6], [1.95, 0.75], [1.95, 2.35], [-2.4, 2.6], [L.GOAL.x + 0.45, L.GOAL.z - 0.2]]);
  state = await waitFor((i) => ['celebrating', 'victory'].includes(i.state), { timeout: 12000 });
  check(['celebrating', 'victory'].includes(state.state) && lambe(state).place.ball === 'picnic' && lambe(state).place.frisbee === 'picnic', 'bolinha e frisbee no piquenique: fase concluída');
  await H.gsleep(1400);
  await shot('09-piquenique.png');
  state = await waitFor((i) => i.state === 'victory', { timeout: 12000 });
  await H.gsleep(400);
  const actions = await ev(() => [...document.querySelectorAll('.rr-victory__actions [data-action]')].map((b) => b.dataset.action).join());
  check(state.state === 'victory' && actions.split(',').includes('next'), 'vitória da 7 oferece "Próxima fase" (a 8)', actions);
  await ev(() => window.__game.game.reset());
  state = await info();
  check(state.stage === 'start' && lambe(state).mud.radhija.k === 0 && !lambe(state).gateOpen && lambe(state).place.frisbee === 'top', 'reinício restaura portão, lama, bolinha e frisbee');
} catch (error) {
  check(false, `exceção: ${error.stack || error}`);
}
const failures = await H.close();
process.exit(failures ? 1 : 0);
