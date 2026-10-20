// Fase 9 (Biblioteca do Vovô) no navegador, com teclas reais: o impulso no freio da escadinha, o globo e a escada
// empurrados com Shift, a Rhaenyra segurando a escada (E) e a Radhija subindo (E) até os óculos; depois o disjuntor,
// o botão do ventilador, o ventilador na grade, o vaso no botão do registro e o superbafo no vento que acorda o
// Bichano e derruba o livro. A porta com mola e as regras de cada passo estão em test/fase9.test.mjs (headless).
//   node tools/scripts/test-biblioteca.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/biblioteca' });
const { check, info, ev, shot, logOf, clearLog, walkTo, walkPath, load, page, waitFor, keysFor } = H;
const lib = (s) => s.biblioteca || {};

/** De frente para a alavanca `cfg` (a dog fica 14 cm à esquerda dela), Espaço: impulso na parede. */
async function wallJump(cfg, via = []) {
  if (via.length) await walkPath(via, { tol: 0.15 });
  await walkTo(cfg.x + cfg.nx * 0.6 - cfg.nz * 0.14, cfg.z + cfg.nz * 0.6 + cfg.nx * 0.14, { tol: 0.1 });
  await H.hold(keysFor(-cfg.nx, -cfg.nz), 250);
  await page.keyboard.press('Space');
  await waitFor((s) => !!s.dogs.rhaenyra.wall, { timeout: 1500 });
  return waitFor((s) => !s.dogs.rhaenyra.wall, { timeout: 3000 });
}
/** Empurra (Shift) a caixa de `pick(info)` na direção (dx, dz) até `pred(info, arg)` (roda na página: dados de fora
 *  só pelo `arg`). */
async function push(pick, half, dx, dz, pred, { via = [], timeout = 10000, arg = null } = {}) {
  if (via.length) await walkPath(via, { tol: 0.12 });
  const b = pick(await info());
  await walkTo(b.x - dx * (half + 0.3), b.z - dz * (half + 0.3), { tol: 0.08, timeout: 6000 });
  return H.holdUntil([...keysFor(dx, dz), 'ShiftLeft'], pred, { timeout, arg });
}

try {
  console.log('\n== Fase 9: Biblioteca do Vovô ==');
  await load('?level=fase9&play');
  let state = await info();
  const L = await ev(() => {
    const l = window.__game.layout;
    return { BRAKE: l.BRAKE_LEVER, BREAKER: l.BREAKER, PLANTER: l.PLANTER, LADDER: l.LADDER, GLOBE: l.GLOBE, HOLD: l.LADDER_HOLD, FAN: l.FAN, DUCT: l.DUCT, GOAL: l.GOAL };
  });
  check(state.levelId === 'fase9' && state.state === 'playing', 'link por id (?level=fase9) abre a fase 9');
  const catalog = await ev(() => ({ ids: window.__game.levels.map((level) => level.id).join(), level: window.__game.game.debug.info().level }));
  check(catalog.ids.includes('fase8,fase9,fase10') && catalog.level === 8, 'na campanha, depois da fase 8 (e antes da 10)', JSON.stringify(catalog));
  check(lib(state).glasses === 'shelf' && lib(state).book === 'wardrobe' && lib(state).cat === 'asleep', 'óculos na estante, livro no armário com o gato dormindo');
  await shot('01-biblioteca.png');

  // ---- ÓCULOS: freio, globo, escada, segurar (E) e subir
  await page.keyboard.press('KeyQ');
  await page.keyboard.press('KeyF'); // a Radhija espera no hall
  state = await wallJump(L.BRAKE, [[-2.2, 0.2], [-0.9, 0.15], [1.4, 0.35], [3.6, -1.0]]);
  check(!lib(state).braked, 'impulso na alavanca solta o freio da escadinha');
  state = await push((s) => lib(s).globe, L.GLOBE.half, -1, 0, (s) => s.biblioteca.globeClear, { via: [[2.75, -2.2]] });
  check(lib(state).globeClear, 'globo empurrado (Shift) para a frente da lareira');
  state = await push((s) => lib(s).ladder, L.LADDER.half, -1, 0, (s) => s.biblioteca.atGlasses, { via: [[2.6, -2.0], [4.0, -2.0]] });
  check(lib(state).atGlasses, 'escadinha empurrada pelo trilho até debaixo dos óculos', JSON.stringify(lib(state).ladder));
  const hx = L.LADDER.minX + L.HOLD.side;
  await walkPath([[hx + 0.2, -1.9], [hx + 0.05, L.HOLD.z + 0.05]], { tol: 0.1 });
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.biblioteca.holding, { timeout: 1500 });
  check(lib(state).holding && lib(state).held, 'E no pé da escada: a Rhaenyra segura a escadinha');
  // troca para a Radhija (que estava no hall com o Fica): a Rhaenyra continua segurando
  await page.keyboard.press('KeyQ');
  state = await waitFor((s) => s.activeDog === 'radhija', { timeout: 1500 });
  check(lib(state).held, 'depois da troca, a escada continua segura');
  await walkPath([[-0.9, 0.15], [1.4, 0.35], [L.LADDER.minX + 0.1, -1.5], [L.LADDER.minX, -1.98]], { tol: 0.1 });
  await H.hold(keysFor(0, -1), 150);
  await clearLog();
  await page.keyboard.press('KeyE');
  state = await waitFor((s) => s.glasses?.holder === 'radhija', { timeout: 6000 });
  check(state.glasses?.holder === 'radhija' && (await logOf('ladder:climb')).length === 1, 'a Radhija sobe (E), pega os óculos lá em cima');
  await shot('02-oculos.png');
  state = await waitFor((s) => !s.biblioteca.climb, { timeout: 4000 });
  await walkTo(L.GOAL.x + 0.6, L.GOAL.z - 0.2, { tol: 0.2 });
  state = await waitFor((s) => s.biblioteca.glasses === 'table', { timeout: 3000 });
  check(lib(state).glasses === 'table', 'óculos na mesinha da poltrona');

  // ---- LIVRO: disjuntor, botão do ventilador, ventilador na grade, vaso no botão do registro, superbafo no vento
  await page.keyboard.press('KeyQ');
  state = await wallJump(L.BREAKER, [[2.2, -0.6], [3.7, 0.25], [5.55, 0.25], [6.3, -1.5]]);
  check(lib(state).power, 'impulso no disjuntor liga a energia do jardim de inverno');
  await walkPath([[6.6, -0.3], [7.45, 0.2], [7.45, 1.25], [7.0, 1.3]], { tol: 0.12 });
  await page.keyboard.press('KeyE');
  // ela aperta o botão com a pata: o ventilador liga no aperto (uns 0,3 s de jogo depois do E)
  state = await waitFor((s) => s.biblioteca.fanOn, { timeout: 3000 });
  check(lib(state).fanOn, 'E no botão da base liga o ventilador');
  await shot('02b-pata-no-botao.png'); // a pata em cima do botão, no aperto
  state = await push((s) => lib(s).fan, L.FAN.half, -1, 0, (s, x) => s.biblioteca.fan.x < x + 0.08, { via: [[7.45, 1.0], [7.45, 0.7]], arg: L.DUCT.inlet.x });
  check(Math.abs(lib(state).fan.x - L.DUCT.inlet.x) < L.FAN.alignTol, 'ventilador empurrado (Shift) até a linha da grade', JSON.stringify(lib(state).fan));
  state = await push((s) => lib(s).fan, L.FAN.half, 0, -1, (s) => s.biblioteca.aligned, { via: [[6.7, 1.3]] });
  check(lib(state).aligned, 'ventilador empurrado até a grade do duto', JSON.stringify(lib(state).fan));
  state = await push((s) => lib(s).planter, L.PLANTER.half, 0, -1, (s) => s.biblioteca.damper, { via: [[6.6, 1.2], [5.6, 1.95], [L.PLANTER.start.x, 2.12]], timeout: 14000 });
  check(lib(state).damper, 'o vaso de rodinhas no botão do chão abre o registro', JSON.stringify(lib(state).planter));
  await page.keyboard.press('KeyQ');
  await page.keyboard.press('KeyF'); // a Rhaenyra fica perto do vaso (seguindo, ela parava na frente do sopro)
  state = await info();
  const f = lib(state).fan;
  // fica na frente do ventilador (pelo norte, ou contornando pelo leste), no vento
  const r0 = state.dogs.radhija;
  await walkPath(r0.z > f.z - 0.2 ? [[f.x + 0.85, f.z + 0.6], [f.x + 0.8, f.z - 0.75]] : [[f.x + 0.6, f.z - 1.3]], { tol: 0.12 });
  await walkTo(f.x + 0.12, f.z - 0.75, { tol: 0.08 });
  await H.hold(keysFor(0, -1), 250);
  await clearLog();
  await H.hold(['KeyR'], 350);
  state = await waitFor((s) => s.biblioteca.cat !== 'asleep', { timeout: 8000 });
  const why = { power: lib(state).power, fanOn: lib(state).fanOn, aligned: lib(state).aligned, damper: lib(state).damper, fan: lib(state).fan,
    planter: lib(state).planter, rad: state.dogs.radhija, bafo: await logOf('dog:bafo'), spawn: await logOf('scent:spawn'),
    duct: await logOf('scent:duct'), fade: await logOf('scent:fade'), hints: (await logOf('hint')).map((x) => x.text) };
  check(lib(state).cat !== 'asleep' && (await logOf('scent:duct')).length >= 1, 'o superbafo no vento passa pelo duto e acorda o Bichano', JSON.stringify(why));
  state = await waitFor((s) => s.biblioteca.book === 'floor', { timeout: 6000 });
  check(lib(state).book === 'floor', 'o Bichano pula e derruba o livro no escritório');
  await shot('03-livro-caiu.png');
  await ev(() => window.__game.game.reset());
  state = await info();
  check(lib(state).glasses === 'shelf' && lib(state).book === 'wardrobe' && lib(state).cat === 'asleep' && lib(state).braked && !lib(state).power && !lib(state).damper, 'reinício devolve óculos, livro, gato, freio, energia e registro');
} catch (e) {
  check(false, `exceção: ${e.stack || e}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
