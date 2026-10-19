// Extras escondidos no navegador (src/game/extras.js), com teclas reais: na cozinha da fase 5, o C antes dos
// ossinhos não faz nada; com os três, a dog anda a voltinha, faz o cocô uma vez só e comemora (brilho dourado e
// jingle; nenhum texto aparece); o E nos potinhos toca comer e beber; reiniciar libera o cocô de novo. A lógica nas
// oito fases está em test/extras.test.mjs.
//   node tools/scripts/test-extras.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/extras' });
const { check, info, ev, shot, logOf, clearLog, load, page, waitFor } = H;
// tetos de src/game/extras.js: voltinha (POOP_PRE) + agachada (POOP_TIME) + comemoração (PARTY_MAX)
const PRE_MS = 4200;
const SQUAT_MS = 4800;
const PARTY_MS = 5200;

try {
  console.log('\n== Extras: fase 5 ==');
  await load('?level=fase5&play');
  let state = await info();
  check(state.levelId === 'fase5' && state.extras && !state.extras.used, 'fase 5 aberta, extras prontos');
  await clearLog();
  await page.keyboard.press('KeyC');
  await H.gsleep(400);
  check((await logOf('extra:start')).length === 0, 'sem os ossinhos, o C não faz nada');
  // os três ossinhos (teleporte só no preparo)
  const treats = await ev(() => window.__game.layout.COLLECTIBLES.map((c) => ({ x: c.x, z: c.z })));
  for (const t of treats) {
    await ev((p) => window.__game.game.debug.teleport('radhija', p.x, p.z), t);
    await H.gsleep(300);
  }
  state = await info();
  check(state.collected === 3, 'pegou os três ossinhos', `${state.collected}`);
  await ev(() => window.__game.game.debug.teleport('radhija', 0.2, 1.2));
  await H.gsleep(300);
  await clearLog();
  const hintsBefore = (await logOf('hint')).length;
  await page.keyboard.press('KeyC');
  state = await waitFor((s) => !!s.extras?.poop, { timeout: 1500 });
  check(state.extras?.poop?.who === 'radhija', 'C com os ossinhos: começa o cocô');
  const yaw0 = await ev(() => window.__game.game.debug.ctrls.radhija.yaw);
  await H.gsleep(1200);
  await shot('01-voltinha.png');
  state = await waitFor((s) => s.extras?.poop?.phase === 'squat', { timeout: PRE_MS + 1000 });
  const yaw1 = await ev(() => window.__game.game.debug.ctrls.radhija.yaw);
  check(state.extras.poop.circle > 0.3 && (await logOf('extra:sniff')).length >= 2, 'anda a voltinha farejando',
    `caminho ${state.extras.poop.circle} m, virou ${(Math.atan2(Math.sin(yaw1 - yaw0), Math.cos(yaw1 - yaw0))).toFixed(2)} rad`);
  await H.gsleep(SQUAT_MS * 0.4);
  await shot('02-forca.png');
  state = await waitFor((s) => s.extras?.poop?.phase === 'party', { timeout: SQUAT_MS + 1000 });
  await H.gsleep(700);
  await shot('03-comemoracao.png');
  state = await waitFor((s) => !s.extras?.poop, { timeout: PARTY_MS + 1500 });
  check(state.extras.poops === 1 && (await logOf('extra:plop')).length === 1, 'um cocozinho no chão');
  check((await logOf('extra:secret')).length === 1, 'a recompensa: brilho dourado e jingle');
  check((await logOf('extra:yip')).length === 1 && (await logOf('extra:bounce')).length >= 2, 'reverência e pulinhos de alegria');
  check((await logOf('hint')).length === hintsBefore, 'nenhum texto na tela');
  await shot('04-depois.png');
  await clearLog();
  await page.keyboard.press('KeyC');
  await H.gsleep(400);
  check((await logOf('extra:start')).length === 0, 'só uma vez por tentativa');
  // potinhos: E perto da ração e da água
  for (const [id, kind] of [['racao', 'eat'], ['agua', 'drink']]) {
    const sp = await ev((i) => window.__game.game.levelDef.extras.find((e) => e.id === i), id);
    await ev((p) => { const g = window.__game.game; g.debug.teleport('radhija', p.stand.x, p.stand.z + 0.1); g.debug.ctrls.radhija.yaw = Math.PI; }, sp);
    await H.gsleep(200);
    await clearLog();
    await page.keyboard.press('KeyE');
    state = await waitFor((s) => !!s.extras?.act, { timeout: 1200 });
    check(state.extras?.act?.kind === kind, `E no potinho: ${kind === 'eat' ? 'come a ração' : 'bebe a água'}`);
    await H.gsleep(1400);
    await shot(`05-${kind}.png`);
    state = await waitFor((s) => !s.extras?.act, { timeout: 4000 });
    check(!state.extras.act, `${kind}: termina e solta a dog`);
  }
  await ev(() => window.__game.events.emit('ui:restart', {}));
  await H.gsleep(300);
  state = await info();
  check(!state.extras.used && state.extras.poops === 0, 'reiniciar libera o cocô e limpa o chão');
} catch (e) {
  check(false, `exceção: ${e.stack || e}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
