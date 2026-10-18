// Fase 8 (Lavanderia de Domingo) no navegador: partida inteira com teclas reais (impulso na parede, empurrar o
// cesto com Shift, arrancada da Radhija). A lógica e os casos de borda estão em test/fase8.test.mjs.
//   node tools/scripts/test-lavanderia.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/lavanderia' });
const { check, info, ev, shot, logOf, clearLog, walkTo, walkPath, load, page, waitFor, keysFor } = H;
const lav = (s) => s.lavanderia || {};
const HALF = 0.27;

/** De frente para as patinhas do botão `cfg` (a dog fica 14 cm à esquerda dele), Espaço: impulso na parede. */
async function wallJump(cfg, via = []) {
  if (via.length) await walkPath(via, { tol: 0.15 });
  await walkTo(cfg.x - 0.14, cfg.z + 0.6, { tol: 0.1 });
  await H.hold(keysFor(0, -1), 250);
  await page.keyboard.press('Space');
  await waitFor((s) => !!s.dogs.rhaenyra.wall, { timeout: 1500 });
  return waitFor((s) => !s.dogs.rhaenyra.wall, { timeout: 3000 });
}
/** Empurra o cesto na direção (dx, dz) com Shift, da face de trás, até `pred(info, arg)` (conferida quadro a quadro). */
async function push(dx, dz, pred, arg, via = [], timeout = 10000) {
  if (via.length) await walkPath(via, { tol: 0.12 });
  const b = lav(await info()).basket;
  await walkTo(b.x - dx * (HALF + 0.3), b.z - dz * (HALF + 0.3), { tol: 0.07 });
  return H.holdUntil([...keysFor(dx, dz), 'ShiftLeft'], pred, { timeout, arg });
}

try {
  console.log('\n== Fase 8: Lavanderia de Domingo ==');
  await load('?level=fase8&play');
  let state = await info();
  const L = await ev(() => {
    const l = window.__game.layout;
    return { SPIN: l.SPIN_BUTTON, RACK: l.RACK_BUTTON, SOCK: l.SOCK, CATCH: l.CATCH, BED: l.DOG_BED };
  });
  check(state.levelId === 'fase8' && state.state === 'playing', 'link por id (?level=fase8) abre a fase 8');
  const catalog = await ev(() => ({ ids: window.__game.levels.map((level) => level.id).join(), level: window.__game.game.debug.info().level }));
  check(catalog.ids.endsWith('fase7,fase8') && catalog.level === 7, 'na campanha, depois da fase 7', JSON.stringify(catalog));
  check(lav(state).sock === 'rack' && lav(state).blanket === 'machine', 'meia no varal e mantinha em cima da máquina');
  await shot('01-lavanderia.png');

  // ---- MANTINHA: a Rhaenyra empurra o cesto até a frente da máquina e aperta a centrífuga
  await page.keyboard.press('KeyQ');
  await page.keyboard.press('KeyF'); // a Radhija fica no canto dela
  await push(1, 0, (s, a) => s.lavanderia.basket.x >= a - 0.03, L.CATCH.x, [[-4.6, 1.0]]);
  state = await push(0, -1, (s) => s.lavanderia.atCatch, null, [[L.CATCH.x - 0.6, 2.15]]);
  check(lav(state).atCatch, 'cesto empurrado (Shift) até a frente da máquina', JSON.stringify(lav(state).basket));
  await clearLog();
  await wallJump(L.SPIN, [[-0.7, -1.8]]);
  state = await waitFor((s) => lav(s).blanket === 'basket', { timeout: 4000 });
  check((await logOf('wall:touch')).length === 1 && (await logOf('washer:spin')).length === 1, 'impulso na parede liga a centrífuga');
  check(lav(state).blanket === 'basket' && (await logOf('blanket:land'))[0]?.inBasket === true, 'a máquina chacoalha e a mantinha cai no cesto');
  await shot('02-mantinha-no-cesto.png');
  await push(1, 0, (s) => s.lavanderia.basket.x >= 3.0, null, [[-1.0, -1.6], [L.CATCH.x - 0.65, -1.6]]);
  await push(0, 1, (s, a) => s.lavanderia.basket.z >= a - 0.05, L.BED.z, [[2.43, -2.9]]);
  state = await push(1, 0, (s) => s.lavanderia.blanket === 'bed', null, [[2.3, 1.13]]);
  state = await waitFor((s) => lav(s).blanket === 'bed', { timeout: 2000 });
  check(lav(state).blanket === 'bed', 'o cesto encostado na caminha entrega a mantinha');

  // ---- MEIA: impulso no botão do varal; troca para a Radhija e arrancada até a meia
  await clearLog();
  await wallJump(L.RACK, [[2.2, -1.9]]);
  state = await waitFor((s) => lav(s).rackDown, { timeout: 2500 });
  check(lav(state).rackDown && (await logOf('rack:move')).length >= 1, 'o varal desceu');
  await shot('03-varal-embaixo.png');
  await page.keyboard.press('KeyQ');
  await walkTo(L.SOCK.x, L.SOCK.z + 1.05, { tol: 0.12 });
  await H.holdUntil(keysFor(0, -1), (s) => s.sock?.holder === 'radhija', {
    timeout: 1200,
    during: async () => { await H.sleep(60); await page.keyboard.press('ShiftLeft'); },
  });
  state = await waitFor((s) => s.sock?.holder === 'radhija', { timeout: 1500 });
  check(state.sock?.holder === 'radhija' && (await logOf('sock:yank')).length === 1, 'o tranco da arrancada soltou a meia');
  await shot('04-meia-na-boca.png');
  await walkPath([[3.4, 0.6], [L.BED.x - 0.3, L.BED.z - 0.3]], { tol: 0.2 });
  state = await waitFor((s) => s.state === 'celebrating' || s.state === 'victory', { timeout: 6000 });
  check(['celebrating', 'victory'].includes(state.state) && lav(state).sock === 'bed', 'meia e mantinha na caminha: fase concluída');
  await H.gsleep(1400);
  await shot('05-caminha.png');
  state = await waitFor((s) => s.state === 'victory', { timeout: 12000 });
  await H.gsleep(400);
  const actions = await ev(() => [...document.querySelectorAll('.rr-victory__actions [data-action]')].map((b) => b.dataset.action).join());
  check(state.state === 'victory' && actions.split(',').includes('next'), 'vitória da 8 oferece "Próxima fase" (a 9)', actions);
  await ev(() => window.__game.game.reset());
  state = await info();
  check(lav(state).sock === 'rack' && lav(state).blanket === 'machine' && !lav(state).rackDown, 'reinício devolve meia, mantinha, cesto e varal');
} catch (e) {
  check(false, `exceção: ${e.stack || e}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
