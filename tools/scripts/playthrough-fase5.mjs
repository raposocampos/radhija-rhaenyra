// FASE 5 · Operação Ursinho — partida no navegador com TECLAS REAIS para as ações (Espaço, E, Shift, Q)
// e teletransportes entre os trechos (a lógica fina está em test/fase5.test.mjs). Inclui o ✕ do controle.
//   node tools/scripts/playthrough-fase5.mjs [--url http://127.0.0.1:5176/]
// Capturas em shots/mecanica/f5-*.png. Sai com código 1 se algo falhar.
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/mecanica' });
const { check, sleep, info, ev, shot, logOf, clearLog, walkTo, press, load, waitFor, page, keysFor } = H;
const place = (name, x, z, yaw) => ev(([n, a, b, y]) => {
  window.__game.game.debug.teleport(n, a, b);
  window.__game.game.debug.ctrls[n].yaw = y;
}, [name, x, z, yaw]);
const pos = (n) => ev((nn) => { const c = window.__game.game.debug.ctrls[nn]; return { x: c.x, z: c.z }; }, n);
/** Segura a direção (dx, dz) e aperta Espaço no meio. */
async function jumpToward(dx, dz) {
  const keys = keysFor(dx, dz);
  for (const k of keys) await page.keyboard.down(k);
  await sleep(140);
  await page.keyboard.press('Space');
  await sleep(600);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
  await sleep(250);
}

try {
  console.log('\n== Fase 5: partida (dentro de casa) ==');
  await load('?level=5&play');
  const lay = await ev(() => window.__game.layout);
  let i = await info();
  check(i.state === 'playing' && i.levelId === 'fase5' && i.stage === 'start', 'fase 5 começa na etapa start', `${i.levelId}/${i.stage}`);
  check(i.objective === 'Só a Rhaenyra pula: troque para ela (Q)', 'objetivo inicial (com a Radhija)', i.objective);
  check(await ev(() => !!document.querySelector('.rr .ico-bear')), 'ícone do ursinho no HUD');
  await shot('f5-01-inicio.png');
  await clearLog();
  await press('Space', 300);
  check((await logOf('hint')).some((h) => h.text === 'Só a Rhaenyra pula! (Q)') && (await logOf('dog:jump')).length === 0, 'Espaço com a Radhija: dica, sem pulo');

  // 1) Rhaenyra pula o portãozinho e abre a trava (E)
  await press('KeyQ', 300);
  await place('rhaenyra', lay.WALL_SH.x - 0.62, 0.4, Math.PI / 2);
  await sleep(300);
  await jumpToward(1, 0);
  let p = await pos('rhaenyra');
  check(p.x > lay.WALL_SH.x && (await logOf('dog:jump')).length === 1, 'Espaço: a Rhaenyra pula o portãozinho', `x=${p.x.toFixed(2)}`);
  await shot('f5-02-pulou-portaozinho.png');
  await place('rhaenyra', lay.LATCH.x + 0.32, lay.LATCH.z + 0.1, -Math.PI / 2);
  i = await waitFor((s) => s.prompt === 'Abrir a trava', { timeout: 2000 });
  check(i.prompt === 'Abrir a trava', 'prompt "Abrir a trava"', i.prompt);
  await press('KeyE', 200);
  i = await waitFor((s) => s.stage === 'gateOpen', { timeout: 3000 });
  check(i.stage === 'gateOpen' && i.gate.locked, 'E na trava: portãozinho abre e fica aberto', i.stage);
  await sleep(600);
  await shot('f5-03-portaozinho-aberto.png');

  // 2) Barricada: pela frente encalha; pula e empurra de dentro (A + Shift)
  const B = lay.BOX_PILLOWS;
  await clearLog();
  await place('rhaenyra', B.start.x - B.half - 0.24, B.start.z, Math.PI / 2);
  await sleep(250);
  let keys = [...keysFor(1, 0), 'ShiftLeft'];
  for (const k of keys) await page.keyboard.down(k);
  await sleep(1200);
  for (const k of keys.reverse()) await page.keyboard.up(k);
  i = await info();
  check(Math.abs(i.box.x - B.start.x) < 0.01 && (await logOf('hint')).some((h) => h.text.startsWith('Do lado de cá a caixa encalha')), 'pelo corredor a caixa encalha na soleira (dica)', `x=${i.box.x}`);
  await place('rhaenyra', B.start.x - B.half - 0.36, B.start.z, Math.PI / 2);
  await sleep(250);
  await jumpToward(1, 0);
  p = await pos('rhaenyra');
  check(p.x > B.start.x + B.half, 'pula a barricada para dentro da cozinha', `x=${p.x.toFixed(2)}`);
  await place('rhaenyra', B.start.x + B.half + 0.28, B.start.z, -Math.PI / 2);
  await sleep(250);
  keys = [...keysFor(-1, 0), 'ShiftLeft'];
  for (const k of keys) await page.keyboard.down(k);
  i = await waitFor((s) => s.stage === 'boxClear', { timeout: 6000 });
  for (const k of keys.reverse()) await page.keyboard.up(k);
  check(i.stage === 'boxClear' && i.box.collapsed, 'Shift empurrando de dentro: a caixa de almofadas desmonta', i.stage);
  await sleep(700);
  await shot('f5-04-caixa-desmontou.png');

  // 3) Radhija pega o ursinho debaixo da mesa e leva para a caminha
  await press('KeyQ', 300);
  await place('radhija', lay.BEAR.x, lay.BEAR.z + 0.34, Math.PI);
  i = await waitFor((s) => s.prompt === 'Pegar o ursinho', { timeout: 2000 });
  check(i.prompt === 'Pegar o ursinho', 'prompt "Pegar o ursinho"', i.prompt);
  await press('KeyE', 300);
  i = await info();
  check(i.carrier === 'radhija' && i.stage === 'carrying', 'Radhija pega o ursinho', `${i.carrier}/${i.stage}`);
  await shot('f5-05-ursinho.png');
  await place('radhija', lay.GOAL.x + 1.0, lay.GOAL.z - 0.6, -2.0);
  await sleep(300);
  await walkTo(lay.GOAL.x, lay.GOAL.z, { tol: 0.25 });
  i = await waitFor((s) => s.state === 'victory', { timeout: 6000 });
  check(i.state === 'victory', 'entrega na caminha → vitória');
  const vic = await logOf('victory');
  check(vic.length === 1 && vic[0].levelId === 'fase5' && vic[0].hasNext === true, 'evento victory (fase5, com a fase 6 depois)', JSON.stringify(vic[0] || {}));
  await sleep(1200);
  check(await ev(() => !!document.querySelector('.rr-victory [data-action="next"]')), 'vitória da fase 5 oferece "Próxima fase"');
  await shot('f5-06-vitoria.png');

  console.log('\n== Fase 5: controle (✕ pula) e etapas ==');
  await load('?level=5&play&dog=rhaenyra');
  await ev(() => {
    window.__fakePads = [{ id: 'Controle falso (DualSense)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
  });
  await sleep(1000);
  await place('rhaenyra', lay.WALL_SH.x - 0.62, 0.4, Math.PI / 2);
  await sleep(250);
  await clearLog();
  await ev(() => { const pd = window.__fakePads[0]; pd.axes = [1, 0, 0, 0]; pd.buttons[0] = { pressed: true, value: 1 }; pd.timestamp = performance.now(); });
  await sleep(160);
  await ev(() => { const pd = window.__fakePads[0]; pd.buttons[0] = { pressed: false, value: 0 }; pd.timestamp = performance.now(); });
  await sleep(500);
  await ev(() => { const pd = window.__fakePads[0]; pd.axes = [0, 0, 0, 0]; pd.timestamp = performance.now(); });
  p = await pos('rhaenyra');
  check((await logOf('dog:jump')).length === 1 && p.x > lay.WALL_SH.x, '✕ do controle: a Rhaenyra pula o portãozinho', `x=${p.x.toFixed(2)}`);
  await ev(() => { window.__fakePads = []; });
  for (const s of ['gateOpen', 'boxClear', 'carrying']) {
    await load(`?level=5&play&stage=${s}`);
    check((await info()).stage === s, `?stage=${s}`);
  }
} catch (e) {
  check(false, `exceção: ${e.message}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
