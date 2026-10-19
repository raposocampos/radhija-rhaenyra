// Superbafo da Radhija no navegador: teclas reais e controle (R2), prévia e nuvem desenhadas na cena,
// e a cadeia da Arena do Bafo (?level=bafo). A lógica completa está em test/bafo.test.mjs e
// test/arena-bafo.test.mjs.
//   node tools/scripts/test-bafo.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/mecanica' });
const { check, sleep, info, ev, shot, logOf, clearLog, load, page, waitFor } = H;
const sceneVisible = (name) => ev((n) => {
  let vis = false;
  window.__game.engine.scene.traverse((o) => { if (o.name === n) vis = o.visible; });
  return vis;
}, name);

try {
  console.log('\n== Superbafo (fase 1) ==');
  await load('?play');
  await ev(() => window.__game.game.debug.teleport('radhija', -2.2, -1.0));
  await ev(() => { window.__game.game.debug.ctrls.radhija.yaw = Math.PI / 2; });
  await sleep(300);
  await clearLog();
  await page.keyboard.down('KeyR');
  await sleep(450);
  let i = await info();
  check(i.bafo.aiming && i.dogs.radhija.action === 'bafoAim', 'segurar R: mira (action bafoAim)', i.dogs.radhija.action);
  check(await sceneVisible('mira-do-bafo'), 'prévia da mira desenhada no chão');
  await shot('bafo-mira.png');
  await page.keyboard.up('KeyR');
  await sleep(200);
  i = await info();
  check((await logOf('dog:bafo')).length === 1 && i.scent.clouds.length === 1, 'soltar R: "HÁÁÁ!" e uma nuvem', JSON.stringify(i.scent));
  check(!(await sceneVisible('mira-do-bafo')), 'a prévia some depois do sopro');
  await shot('bafo-nuvem.png');

  // R2 do controle (o L2 é o Lambe-Lambe)
  await ev(() => {
    window.__fakePads = [{ id: 'Controle falso (DualSense)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
  });
  await sleep(1200);
  await clearLog();
  await ev(() => { const p = window.__fakePads[0]; p.buttons[7] = { pressed: true, value: 1 }; p.timestamp = performance.now(); });
  await sleep(350);
  check((await info()).bafo.aiming, 'R2 segurado: mira');
  await ev(() => { const p = window.__fakePads[0]; p.buttons[7] = { pressed: false, value: 0 }; p.timestamp = performance.now(); });
  await sleep(200);
  check((await logOf('dog:bafo')).length === 1, 'soltar R2: sopra');
  check((await ev(() => document.querySelector('.rr')?.dataset.pad)) === 'ps', 'botões desenhados no estilo PlayStation');
  await ev(() => { window.__fakePads = []; });

  // A Rhaenyra não tem bafo
  await page.keyboard.press('KeyQ');
  await sleep(300);
  await clearLog();
  // R é um comando de segurar, lido no quadro; down/up no mesmo instante pode sumir.
  await H.hold(['KeyR'], 150);
  await sleep(300);
  check((await logOf('dog:bafo')).length === 0 && (await logOf('hint')).some((h) => h.text.startsWith('Só a Radhija tem o superbafo')), 'a Rhaenyra não sopra (dica)');

  console.log('\n== Arena do Bafo: o pombo e o portão ==');
  await load('?level=bafo&play');
  i = await info();
  check(i.levelId === 'bafo' && i.pigeon === 'A' && !i.gate.locked, 'arena carregada (pombo no poleiro A, portão fechado)');
  await ev(() => window.__game.game.debug.puzzle.mech.fan.setPos(-2.5, 2.4));
  await sleep(200);
  check((await info()).fan.aligned, 'ventilador no encaixe');
  await ev(() => window.__game.game.debug.teleport('radhija', 0.1, 2.4));
  await ev(() => { window.__game.game.debug.ctrls.radhija.yaw = Math.PI / 2; });
  await sleep(300);
  await clearLog();
  await page.keyboard.down('KeyR');
  await sleep(400);
  await page.keyboard.up('KeyR');
  i = await waitFor((s) => s.stage === 'gateOpen', { timeout: 9000 });
  check(i.stage === 'gateOpen' && i.pigeon === 'B' && i.gate.locked, 'bafo no vento → duto → pombo → placa → portão aberto e travado', `${i.stage} pombo=${i.pigeon}`);
  check((await logOf('scent:duct')).length === 1 && (await logOf('scent:exit')).length === 1 && (await logOf('pigeon:flee')).length === 1, 'eventos scent:duct, scent:exit e pigeon:flee');
  await sleep(600);
  await shot('bafo-arena-portao.png');
} catch (e) {
  check(false, `exceção: ${e.message}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
