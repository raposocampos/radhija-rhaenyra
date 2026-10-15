// Pulo da Rhaenyra no navegador (Arena do Pulo, ?level=pulo): teclas reais, renderização real.
// A lógica completa está em test/pulo.test.mjs; aqui, a integração com a página (Espaço, ✕, animação, eventos).
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
