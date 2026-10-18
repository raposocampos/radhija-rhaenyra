// Fase 9 (Biblioteca do Vovô) no navegador, com teclas reais: o impulso no freio da escadinha, o globo e a escada
// empurrados com Shift, a Rhaenyra segurando com o Fica e a Radhija subindo (E) até os óculos; depois o registro, o
// ventilador na grade e o superbafo no vento que acorda o Bichano e derruba o livro. A porta com mola e as regras de
// cada passo estão em test/fase9.test.mjs (headless).
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
/** Empurra (Shift) a caixa de `pick(info)` na direção (dx, dz) até `pred(info)`. */
async function push(pick, half, dx, dz, pred, via = [], timeout = 10000) {
  if (via.length) await walkPath(via, { tol: 0.12 });
  const b = pick(await info());
  await walkTo(b.x - dx * (half + 0.3), b.z - dz * (half + 0.3), { tol: 0.08, timeout: 6000 });
  return H.holdUntil([...keysFor(dx, dz), 'ShiftLeft'], pred, { timeout });
}

try {
  console.log('\n== Fase 9: Biblioteca do Vovô ==');
  await load('?level=fase9&play');
  let state = await info();
  const L = await ev(() => {
    const l = window.__game.layout;
    return { BRAKE: l.BRAKE_LEVER, DAMPER: l.DAMPER_LEVER, LADDER: l.LADDER, GLOBE: l.GLOBE, HOLD: l.LADDER_HOLD, FAN: l.FAN, DUCT: l.DUCT, GOAL: l.GOAL };
  });
  check(state.levelId === 'fase9' && state.state === 'playing', 'link por id (?level=fase9) abre a fase 9');
  const catalog = await ev(() => ({ ids: window.__game.levels.map((level) => level.id).join(), level: window.__game.game.debug.info().level }));
  check(catalog.ids.endsWith('fase8,fase9') && catalog.level === 8, 'na campanha, depois da fase 8', JSON.stringify(catalog));
  check(lib(state).glasses === 'shelf' && lib(state).book === 'wardrobe' && lib(state).cat === 'asleep', 'óculos na estante, livro no armário com o gato dormindo');
  await shot('01-biblioteca.png');

  // ---- ÓCULOS: freio, globo, escada, segurar com o Fica e subir
  await page.keyboard.press('KeyQ');
  await page.keyboard.press('KeyF'); // a Radhija espera no hall
  state = await wallJump(L.BRAKE, [[-2.2, 0.2], [-0.9, 0.15], [1.4, 0.35], [3.6, -1.0]]);
  check(!lib(state).braked, 'impulso na alavanca solta o freio da escadinha');
  state = await push((s) => lib(s).globe, L.GLOBE.half, -1, 0, (s) => s.biblioteca.globeClear, [[2.75, -2.2]]);
  check(lib(state).globeClear, 'globo empurrado (Shift) para a frente da lareira');
  state = await push((s) => lib(s).ladder, L.LADDER.half, -1, 0, (s) => s.biblioteca.atGlasses, [[2.6, -2.0], [4.0, -2.0]]);
  check(lib(state).atGlasses, 'escadinha empurrada pelo trilho até debaixo dos óculos', JSON.stringify(lib(state).ladder));
  const hx = L.LADDER.minX + L.HOLD.side;
  await walkPath([[hx + 0.2, -1.9], [hx + 0.05, L.HOLD.z + 0.05]], { tol: 0.1 });
  // a Radhija vem até a escada (ela estava no hall com o Fica)
  await page.keyboard.press('KeyQ');
  await walkPath([[-0.9, 0.15], [1.4, 0.35], [L.LADDER.minX + 0.1, -1.5], [L.LADDER.minX, -1.98]], { tol: 0.1 });
  await page.keyboard.press('KeyF'); // a Rhaenyra fica no pé da escada
  state = await waitFor((s) => s.biblioteca.held, { timeout: 1500 });
  check(lib(state).held && state.stay.rhaenyra, 'a Rhaenyra parada no pé da escada (Fica) segura a escadinha');
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

  // ---- LIVRO: registro, ventilador na grade, superbafo no vento
  await page.keyboard.press('KeyQ');
  state = await wallJump(L.DAMPER, [[2.2, -0.6], [3.7, 0.25], [5.1, 0.25], [6.3, -1.5]]);
  check(lib(state).damper, 'impulso no registro abre o duto');
  await push((s) => lib(s).fan, L.FAN.half, -1, 0, (s) => Math.abs(s.biblioteca.fan.x - L.DUCT.inlet.x) < 0.12, [[7.3, -0.3], [7.3, 0.7]]);
  state = await push((s) => lib(s).fan, L.FAN.half, 0, -1, (s) => s.biblioteca.aligned, [[6.7, 1.3]]);
  check(lib(state).aligned, 'ventilador empurrado até a grade do duto', JSON.stringify(lib(state).fan));
  await page.keyboard.press('KeyQ');
  const f = lib(await info()).fan;
  await walkTo(f.x + 0.5, f.z - 0.7, { tol: 0.1 });
  await H.hold(keysFor(-1, 0), 120);
  await clearLog();
  await H.hold(['KeyR'], 350);
  state = await waitFor((s) => s.biblioteca.cat !== 'asleep', { timeout: 8000 });
  check(lib(state).cat !== 'asleep' && (await logOf('scent:duct')).length >= 1, 'o superbafo no vento passa pelo duto e acorda o Bichano');
  state = await waitFor((s) => s.biblioteca.book === 'floor', { timeout: 6000 });
  check(lib(state).book === 'floor', 'o Bichano pula e derruba o livro no escritório');
  await shot('03-livro-caiu.png');
  await ev(() => window.__game.game.reset());
  state = await info();
  check(lib(state).glasses === 'shelf' && lib(state).book === 'wardrobe' && lib(state).cat === 'asleep' && lib(state).braked, 'reinício devolve óculos, livro, gato e freio');
} catch (e) {
  check(false, `exceção: ${e.stack || e}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
