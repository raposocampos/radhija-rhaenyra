// Empurrão em pé da Rhaenyra no navegador (Arena do Empurrão, ?level=empurra): teclas e controle reais, renderização
// real. A lógica completa está em test/empurrao.test.mjs; aqui, a integração com a página (Shift e R1 seguros, a pose
// de pé no modelo, eventos, a bolinha que cai e a entrega), o patinho da mesinha pelo controle e a irmã empurrada.
//   node tools/scripts/test-empurra.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/mecanica' });
const { check, sleep, info, ev, shot, logOf, clearLog, walkTo, walkPath, load, page } = H;

/** Onde a Rhaenyra fica para empurrar o alvo `key` (shoveStance do controlador), recuada `back` m. */
const stanceOf = (key, back = 0) => ev(({ k, b }) => {
  const T = window.__game.layout.SHOVE_TARGETS[k];
  const d = window.__game.game.debug.ctrls.rhaenyra.r + 0.04 + b;
  return { x: T.x + T.nx * d, z: T.z + T.nz * d, nx: T.nx, nz: T.nz, land: T.item.land };
}, { k: key, b: back });

const pad = (down = []) => ev((d) => {
  const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: d.includes(i), value: d.includes(i) ? 1 : 0 }));
  window.__fakePads = [{ id: 'Controle falso', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes: [0, 0, 0, 0], buttons }];
}, down);

try {
  console.log('\n== Empurrão em pé na arvorezinha (Arena do Empurrão) ==');
  await load('?level=empurra&play&dog=rhaenyra');
  let i = await info();
  check(i.levelId === 'empurra' && i.activeDog === 'rhaenyra', 'arena carregada com a Rhaenyra', `${i.levelId}/${i.activeDog}`);
  check(i.empurra?.tree?.pushes === 0 && i.stage === 'start', 'a bolinha está na árvore', JSON.stringify(i.empurra?.tree));
  await page.keyboard.press('KeyF'); // a Radhija fica
  const tree = await stanceOf('arvorezinha', 0.3);
  await walkTo(tree.x, tree.z, { tol: 0.1 });
  await H.hold(H.keysFor(-tree.nx, -tree.nz), 120); // de frente para o tronco
  i = await H.gsleep(200);
  check(i.prompt === 'Empurrar', 'prompt do empurrão de frente para a arvorezinha', String(i.prompt));
  await shot('empurra-antes.png');

  await clearLog();
  const rec = await H.record((g) => {
    const c = g.debug.ctrls.rhaenyra;
    const inner = window.__game.dogs.rhaenyra.object.children[0];
    return { k: c.shoveK, stage: c.shoveStage, n: c.shoveN, rx: inner.rotation.x, x: c.x, z: c.z };
  });
  // segura o Shift (no próprio quadro: holdUntil solta quando a bolinha cair)
  i = await H.holdUntil(['ShiftLeft'], (s) => s.empurra.tree.dropped, { timeout: 4000, label: 'Shift até a bolinha cair' });
  check(i.empurra.tree.dropped, 'três empurrões derrubaram a bolinha', JSON.stringify(i.empurra.tree));
  i = await H.waitFor((s) => s.empurra.tree.landed && !s.dogs.rhaenyra.shove, { timeout: 4000 });
  const frames = await rec.stop();
  const stood = Math.max(...frames.map((f) => -f.rx));
  check(frames.some((f) => f.stage === 'push' && f.k === 1), 'ficou de pé e empurrou', `${frames.length} quadros`);
  check(stood > 0.6, 'o modelo fica de pé (o corpo gira pelo quadril)', `${stood.toFixed(2)} rad`);
  check((await logOf('dog:rear')).length === 1, 'dog:rear uma vez');
  const hits = await logOf('dog:shove');
  check(hits.length === 3 && hits.every((h) => h.id === 'arvorezinha'), 'três empurrões na arvorezinha', String(hits.length));
  check((await logOf('shove:drop')).length === 1 && (await logOf('shove:land')).length === 1, 'a bolinha caiu e parou no chão');
  check((await logOf('shove:bounce')).length >= 2, 'quicou');
  check(i.stage === 'ball' && i.dogs.rhaenyra.shove === null, 'soltou o Shift, ela desceu e a fase pede a bolinha', `${i.stage}`);
  await shot('empurra-bolinha-no-chao.png');

  // pega e leva para a caminha
  const ball = i.empurra.tree.item;
  await walkPath([[tree.x, tree.z + 0.5], [ball.x - 0.3, ball.z]], { tol: 0.12 });
  await page.keyboard.press('KeyE');
  i = await H.gsleep(200);
  check(i.stage === 'carrying', 'pegou a bolinha', i.stage);
  const goal = await ev(() => window.__game.layout.GOAL);
  await walkPath([[-0.6, -0.5], [-2.6, -1.6], [goal.x + 0.3, goal.z + 0.3]]);
  i = await H.waitFor((s) => s.state !== 'playing', { timeout: 4000 });
  check(i.state === 'celebrating' || i.state === 'victory', 'entregou a bolinha', i.state);

  // R1 do controle de frente para a mesinha: o patinho cai do outro lado
  console.log('\n== R1 do controle na mesinha ==');
  await load('?level=empurra&play&dog=rhaenyra');
  await page.keyboard.press('KeyF');
  const table = await stanceOf('mesinha', 0.25);
  await walkTo(table.x, table.z, { tol: 0.1 });
  await H.hold(H.keysFor(-table.nx, -table.nz), 120);
  await clearLog();
  await pad([5]); // R1 / RB seguro
  i = await H.waitFor((s) => s.empurra.table.dropped, { timeout: 5000 });
  await pad([]);
  check(i.empurra.table.dropped, 'R1 seguro: três empurrões e o patinho caiu', JSON.stringify(i.empurra.table));
  i = await H.waitFor((s) => s.empurra.table.landed && !s.dogs.rhaenyra.shove, { timeout: 4000 });
  const duck = i.empurra.table.item;
  const side = (duck.x - table.x) * table.nx + (duck.z - table.z) * table.nz;
  check(i.empurra.table.landed && side < -0.4, 'o patinho caiu do outro lado da mesinha', `${side.toFixed(2)} m`);
  await shot('empurra-patinho.png');
  await ev(() => { window.__fakePads = []; });

  // a irmã: empurrada, ela se afasta e bufa
  console.log('\n== Empurrando a irmã ==');
  await page.keyboard.press('KeyF'); // a Radhija volta a seguir
  await ev(() => {
    const g = window.__game.game;
    g.debug.teleport('radhija', -1.0, -0.4);
    g.debug.ctrls.radhija.yaw = Math.PI / 2;
    g.debug.teleport('rhaenyra', -1.0, 0.25);
    g.debug.ctrls.rhaenyra.yaw = Math.PI;
  });
  await sleep(100);
  await clearLog();
  const z0 = (await info()).dogs.radhija.z;
  const recS = await H.record((g) => ({ z: g.debug.ctrls.radhija.z, d: Math.hypot(g.debug.ctrls.radhija.x - g.debug.ctrls.rhaenyra.x, g.debug.ctrls.radhija.z - g.debug.ctrls.rhaenyra.z) }));
  i = await H.holdUntil(['ShiftLeft'], (s) => s.shove?.reacting === 'radhija', { timeout: 3000, label: 'Shift até empurrar a irmã' });
  await H.waitFor((s) => !s.shove, { timeout: 4000 });
  const fs = await recS.stop();
  const minZ = Math.min(...fs.map((f) => f.z));
  const minD = Math.min(...fs.map((f) => f.d));
  check((await logOf('dog:shoved')).length === 1, 'empurrou a irmã uma vez');
  check(minZ < z0 - 0.15, 'a irmã se afastou uns passinhos', `${z0.toFixed(2)} → ${minZ.toFixed(2)}`);
  check(minD > 0.3, 'nenhuma dentro da outra', `${minD.toFixed(2)} m`);
  check((await logOf('dog:huff')).length === 1, '"hmpf"');

  // a Radhija: Shift é a arrancada, não fica de pé
  console.log('\n== A Radhija não fica de pé ==');
  await load('?level=empurra&play&dog=radhija');
  await page.keyboard.press('KeyF');
  const t2 = await stanceOf('arvorezinha', 0.6);
  await walkTo(t2.x, t2.z, { tol: 0.12 });
  await clearLog();
  await H.holdUntil(H.keysFor(-t2.nx, -t2.nz), () => false, { timeout: 900, during: () => page.keyboard.press('ShiftLeft') });
  i = await H.gsleep(300);
  check(!i.dogs.radhija.shove && (await logOf('dog:rear')).length === 0, 'a Radhija não fica de pé');
  check((await logOf('hint')).some((h) => /Só a Rhaenyra fica de pé/.test(h.text)), 'dica: só a Rhaenyra fica de pé');
} catch (e) {
  check(false, `exceção: ${e.message}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
