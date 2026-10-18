// Lambe-Lambe e a fase 7 (protótipo DEV) no navegador: teleporte só prepara trechos; túnel, trinco,
// Lambe-Lambe, arrancada no escorregador, pegar e entregar usam entrada real (teclado e controle falso).
// Fluxo: a Radhija atravessa o túnel e sai enlameada → sem arrancada e escorregando → destrava o portão →
// a Rhaenyra lambe até limpar → arrancada sobe o escorregador e desce com o frisbee → bolinha e frisbee
// no piquenique. Antes, o Lambe-Lambe na fase 1 (teclado e L2) não pode virar superbafo.
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
  let state = await H.holdUntil(['KeyR'], (i) => i.lick.strokes >= 2, { timeout: 3000 });
  check(state.lick.strokes >= 2 || (await H.logOf('dog:lick')).length >= 2, 'segurar R lambe a irmã em ritmo');
  check((await H.logOf('dog:bafo')).length === 0, 'R com a Rhaenyra não vira superbafo');
  check((await H.logOf('hint')).some((h) => h.text.startsWith('Só a Radhija tem o superbafo') && h.text.includes('Lambe-Lambe')), 'dica explica o botão compartilhado');
  state = await waitFor((i) => !i.lick.on, { timeout: 2000 });
  check(!state.lick.on, 'soltar R termina a lambida');
  // L2 do controle faz o mesmo
  await fakePad();
  await H.sleep(150);
  await H.clearLog();
  await padButton(6, true);
  state = await waitFor((i) => i.lick.strokes >= 1, { timeout: 3000 });
  await padButton(6, false);
  check((await H.logOf('lick:start')).length === 1 && state.lick.strokes >= 1, 'L2/LT também lambe');
  await ev(() => { window.__fakePads = []; });
  await H.sleep(300);

  // ---------------------------------------------------------------- fase 7
  console.log('\n== Fase 7: Lambe-Lambe na Pracinha ==');
  await load('?level=fase7&play');
  state = await info();
  const L = await ev(() => {
    const l = window.__game.layout;
    return { TUNNEL: l.TUNNEL, LATCH: l.LATCH, FENCE: l.FENCE, SLIDE: l.SLIDE, SLIDE_ENTRY: l.SLIDE_ENTRY, BALL: l.BALL, GOAL: l.GOAL };
  });
  check(state.levelId === 'fase7' && state.stage === 'start', 'protótipo carregado pelo id');
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

  // Lambe-Lambe até limpar
  await station('rhaenyra', { x: L.LATCH.x - 0.35, z: L.LATCH.z - 0.75, yaw: 0.4 });
  await H.clearLog();
  await page.keyboard.down('KeyR');
  state = await waitFor((i) => i.lick.strokes >= 2 && i.lick.stage === 'licking' && i.lick.phase > 0.25 && i.lick.phase < 0.55, { timeout: 5000 });
  await shot('05-lambe-lambe.png');
  state = await waitFor((i) => lambe(i).mud.radhija.k === 0, { timeout: 8000 });
  await page.keyboard.up('KeyR');
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
  await ev(() => window.__game.game.reset());
  state = await info();
  check(state.stage === 'start' && lambe(state).mud.radhija.k === 0 && !lambe(state).gateOpen && lambe(state).place.frisbee === 'top', 'reinício restaura portão, lama, bolinha e frisbee');
  await load('?play');
  check(!(await ev(() => window.__game.levels.some((level) => level.id === 'fase7'))), 'catálogo normal continua sem o protótipo');
} catch (error) {
  check(false, `exceção: ${error.stack || error}`);
}
const failures = await H.close();
process.exit(failures ? 1 : 0);
