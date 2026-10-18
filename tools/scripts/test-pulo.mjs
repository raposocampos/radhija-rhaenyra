// Pulo da Rhaenyra no navegador (Arena do Pulo, ?level=pulo): teclas reais, renderização real.
// A lógica completa está em test/pulo.test.mjs e test/parede.test.mjs; aqui, a integração com a página (Espaço, ✕,
// animação, eventos), inclusive o impulso na parede de treino.
//   node tools/scripts/test-pulo.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/mecanica' });
const { check, sleep, info, ev, shot, logOf, clearLog, walkTo, load, page } = H;

try {
  console.log('\n== Pulo da Rhaenyra (Arena do Pulo) ==');
  await load('?level=pulo&play&dog=rhaenyra');
  let i = await info();
  check(i.levelId === 'pulo' && i.activeDog === 'rhaenyra', 'arena carregada com a Rhaenyra', `${i.levelId}/${i.activeDog}`);
  const fence = await ev(() => window.__game.layout.LOG_FENCE);

  // Sem pular: a cerca de troncos bloqueia.
  await walkTo(fence.x - 0.9, -0.6);
  await H.hold(['KeyD'], 900);
  i = await info();
  check(i.dogs.rhaenyra.x < fence.x - fence.hx, 'sem pular, a cerca de troncos bloqueia', `x=${i.dogs.rhaenyra.x}`);

  // Espaço: pula por cima.
  await walkTo(fence.x - 0.9, -0.6);
  await clearLog();
  await page.keyboard.down('KeyD');
  await sleep(150);
  await page.keyboard.press('Space');
  await sleep(160);
  i = await info();
  check(i.dogs.rhaenyra.jumping && i.dogs.rhaenyra.y > 0.1 && i.dogs.rhaenyra.action === 'jump', 'no ar: jumping, altura e action jump', `y=${i.dogs.rhaenyra.y} ${i.dogs.rhaenyra.action}`);
  const anim = await ev(() => window.__game.dogs.rhaenyra.object.children[0].position.y);
  check(anim > 0.1, 'o modelo sobe junto (inner.position.y)', anim.toFixed(3));
  await shot('pulo-no-ar.png');
  await sleep(700);
  await page.keyboard.up('KeyD');
  await sleep(200);
  i = await info();
  check(i.dogs.rhaenyra.x > fence.x + fence.hx && !i.dogs.rhaenyra.jumping && i.dogs.rhaenyra.y === 0, 'pousou do outro lado', `x=${i.dogs.rhaenyra.x}`);
  check((await logOf('dog:jump')).length === 1 && (await logOf('dog:land')).length === 1, 'dog:jump e dog:land uma vez cada');

  // ✕ do controle.
  await ev(() => {
    const pad = { id: 'Controle falso', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.__fakePads = [pad];
  });
  await sleep(200);
  await clearLog();
  await ev(() => { const p = window.__fakePads[0]; p.buttons[0] = { pressed: true, value: 1 }; p.timestamp = performance.now(); });
  await sleep(150);
  await ev(() => { const p = window.__fakePads[0]; p.buttons[0] = { pressed: false, value: 0 }; p.timestamp = performance.now(); });
  await sleep(700);
  check((await logOf('dog:jump')).length === 1, '✕ pula');
  await ev(() => { window.__fakePads = []; });

  // Impulso na parede: de frente para as patinhas pintadas, Espaço vira impulso; o botão abre a portinhola.
  console.log('\n== Impulso na parede (parede de treino) ==');
  await load('?level=pulo&play&dog=rhaenyra'); // de novo do começo: a parede de treino fica do lado de cá da cerca
  const W = await ev(() => { const l = window.__game.layout; return { B: l.WALL_BUTTON, V: l.WALL_LEVER, C: l.CUBBY }; });
  await page.keyboard.press('KeyF'); // a Radhija fica
  await walkTo(W.B.x, W.B.z + 0.55, { tol: 0.12 });
  await H.hold(['KeyW'], 250);
  i = await H.gsleep(250);
  check(i.prompt === 'Impulso na parede', 'prompt do impulso de frente para as patinhas', String(i.prompt));
  await clearLog();
  const rec = await H.record((g) => {
    const c = g.debug.ctrls.rhaenyra;
    const inner = window.__game.dogs.rhaenyra.object.children[0];
    return { k: c.wallDur > 0 ? c.wallT / c.wallDur : -1, y: c.y, z: c.z, rx: inner.rotation.x, iy: inner.position.y };
  });
  await page.keyboard.press('Space');
  await H.waitFor((s) => (s.dogs.rhaenyra.wall?.k ?? 0) > 0.5, { timeout: 3000 });
  await shot('parede-impulso-no-alto.png');
  i = await H.waitFor((s) => !s.dogs.rhaenyra.wall && s.dogs.rhaenyra.y === 0, { timeout: 4000 });
  const frames = await rec.stop();
  const top = Math.max(...frames.map((f) => f.iy));
  const stood = Math.max(...frames.map((f) => -f.rx));
  check(frames.some((f) => f.k > 0.4 && f.k < 0.6), 'gravou o meio do impulso', `${frames.length} quadros`);
  check(top > 0.35 && stood > 1.2, 'o modelo fica de pé e sobe na parede', `sobe ${top.toFixed(2)} m, ${stood.toFixed(2)} rad`);
  check((await logOf('dog:wallJump')).length === 1 && (await logOf('dog:jump')).length === 0, 'Espaço vira impulso (e não pulo comum)');
  check((await logOf('wall:touch')).length === 1 && (await logOf('wall:button')).length === 1, 'a pata alcança o botão uma vez');
  check((await logOf('dog:land')).length === 1, 'volta ao chão uma vez');
  check(i.wall.hatch === true && i.wall.button.on === true, 'a portinhola abriu e o botão conta o tempo', JSON.stringify(i.wall));
  await shot('parede-portinhola-aberta.png');
  const mid = (W.C.x0 + W.C.x1) / 2;
  await walkTo(mid, W.C.zFront + 0.45, { tol: 0.12 });
  await walkTo(mid, W.C.zBack + 0.36, { tol: 0.12 });
  i = await info();
  check(i.collected === 1, 'pegou o ossinho do armarinho', `${i.collected}/${i.total}`);
  await walkTo(mid, W.C.zFront + 0.8, { tol: 0.15 });
  i = await H.waitFor((s) => !s.wall.hatch, { timeout: 9000 });
  check(i.wall.hatch === false && i.wall.button.on === false, 'depois do tempo, com ela fora, a portinhola fecha');

  // Alavanca pelo ✕ do controle: liga as luzinhas.
  await walkTo(W.V.x, W.V.z + 0.55, { tol: 0.12 });
  await H.hold(['KeyW'], 250);
  await clearLog();
  await ev(() => {
    window.__fakePads = [{ id: 'Controle falso', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
  });
  await sleep(200);
  await ev(() => { const p = window.__fakePads[0]; p.buttons[0] = { pressed: true, value: 1 }; p.timestamp = performance.now(); });
  await sleep(150);
  await ev(() => { const p = window.__fakePads[0]; p.buttons[0] = { pressed: false, value: 0 }; p.timestamp = performance.now(); });
  i = await H.waitFor((s) => s.wall.lever.on && !s.dogs.rhaenyra.wall, { timeout: 4000 });
  check(i.wall.lever.on && (await logOf('lantern:on')).length === 1, '✕ pega impulso e a alavanca liga as luzinhas');
  await shot('parede-luzinhas.png');
  await ev(() => { window.__fakePads = []; });
  await page.keyboard.press('KeyF'); // a Radhija volta a seguir

  // A Radhija não pula.
  await page.keyboard.press('KeyQ');
  await sleep(300);
  await clearLog();
  await page.keyboard.press('Space');
  await sleep(400);
  check((await info()).activeDog === 'radhija' && (await logOf('dog:jump')).length === 0, 'a Radhija não pula');
} catch (e) {
  check(false, `exceção: ${e.message}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
