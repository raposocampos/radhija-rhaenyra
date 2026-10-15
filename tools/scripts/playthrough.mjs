// Partida completa automatizada com TECLAS REAIS (Playwright + Chrome do sistema), em malha fechada:
// lê a posição pelo debug.info() e segura WASD (8 direções relativas à câmera) até chegar a cada ponto.
//   node tools/scripts/playthrough.mjs [--url http://127.0.0.1:5173/] [--only full|tests]
// Capturas em shots/game/. Imprime ok/FALHOU por verificação e sai com código 1 se algo falhar.
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NAV_NODES } from '../../src/levels/fase1/layout.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, cur, i, arr) => {
  if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]);
  return acc;
}, []));
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const ONLY = args.only || 'all';
const OUT = resolve('shots/game');
mkdirSync(OUT, { recursive: true });

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

let pass = 0;
let fail = 0;
const results = [];
function check(cond, msg, extra = '') {
  if (cond) pass++; else fail++;
  const line = `${cond ? '  ok    ' : '  FALHOU'} ${msg}${extra ? `  (${extra})` : ''}`;
  results.push(line);
  console.log(line);
  return cond;
}
const sleep = (ms) => page.waitForTimeout(ms);
const info = () => page.evaluate(() => window.__game.game.debug.info());
const ev = (js, arg) => page.evaluate(js, arg);
const shot = async (name) => { await page.screenshot({ path: resolve(OUT, name) }); console.log(`  captura: shots/game/${name}`); };
const logOf = (name) => page.evaluate((n) => window.__game.game.debug.events(n).map((e) => e.payload), name);
const clearLog = () => page.evaluate(() => window.__game.game.debug.clearLog());

// Base da câmera (CAMERA.offset = [1.4, 4.3, 4.7])
const L = Math.hypot(1.4, 4.7);
const F = [-1.4 / L, -4.7 / L];
const R = [4.7 / L, -1.4 / L];
const held = new Set();
async function setKeys(want) {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
    if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
  }
}
function keysFor(dx, dz) {
  const fwd = dx * F[0] + dz * F[1];
  const rgt = dx * R[0] + dz * R[1];
  const a = Math.atan2(rgt, fwd); // 0 = frente(W), +90° = direita(D)
  const s = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyW', 'KeyA']][s];
}
/** Anda com a dog ativa até (x, z) segurando as teclas reais. */
async function walkTo(x, z, { tol = 0.22, timeout = 15000, extra = [] } = {}) {
  const t0 = Date.now();
  for (const k of extra) await page.keyboard.down(k);
  let last = null;
  while (Date.now() - t0 < timeout) {
    const i = await info();
    const d = i.dogs[i.activeDog];
    last = d;
    if (i.state !== 'playing') break;
    const dx = x - d.x;
    const dz = z - d.z;
    const dist = Math.hypot(dx, dz);
    if (dist < tol) break;
    await setKeys(new Set(keysFor(dx, dz)));
    await sleep(dist < 0.6 ? 25 : 50);
    if (dist < 0.6) { await setKeys(new Set()); await sleep(30); }
  }
  await setKeys(new Set());
  for (const k of extra) await page.keyboard.up(k);
  await sleep(120);
  const i = await info();
  return i.dogs[i.activeDog] || last;
}
async function hold(keys, ms) {
  for (const k of keys) await page.keyboard.down(k);
  await sleep(ms);
  for (const k of [...keys].reverse()) await page.keyboard.up(k);
}
async function load(query) {
  await page.goto(`${BASE}${query}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__game?.game?.debug?.info, null, { timeout: 30000 });
  // espera os primeiros quadros (compilação de shaders) e a transição da câmera
  await page.waitForFunction(() => window.__game.game.debug.info().timeSec > 0.3 || window.__game.game.state === 'title', null, { timeout: 60000 });
  await sleep(1800);
}

// =====================================================================
async function fullRun() {
  console.log('\n== Partida completa (teclas reais) ==');
  await load('?play');
  let i = await info();
  check(i.state === 'playing' && i.stage === 'start' && i.activeDog === 'radhija', 'começa jogando com a Radhija na etapa start', `${i.state}/${i.stage}`);
  await clearLog();
  await shot('10-partida-inicio.png');

  // 1) Radhija até a abertura e através dela
  await walkTo(0.3, -2.1);
  await shot('11-diante-da-abertura.png');
  let d = await walkTo(1.7, -2.05);
  i = await info();
  check(i.stage === 'east' && d.x > 1.15, 'Radhija passou pela abertura → etapa east', `x=${d.x}`);
  await shot('12-radhija-leste.png');

  // 2) Cordinha: Rhaenyra (companheira) deve esperar do outro lado da cerca
  d = await walkTo(1.5, 0.9);
  await sleep(1600);
  i = await info();
  check(i.prompt === 'Puxar a cordinha', 'prompt da cordinha aparece', i.prompt);
  const rh = i.dogs.rhaenyra;
  check(rh.x < 1.0 && rh.mode === 'wait', 'Rhaenyra espera do lado oeste (sem caminho)', `x=${rh.x} z=${rh.z} modo=${rh.mode}`);
  check(Math.hypot(rh.x - NAV_NODES.W_gate.x, rh.z - NAV_NODES.W_gate.z) < 0.6, 'Rhaenyra espera junto ao portão (nó mais próximo da líder)', `(${rh.x}, ${rh.z})`);
  await sleep(1200);
  i = await info();
  check(i.dogs.rhaenyra.sitting, 'Rhaenyra senta enquanto espera', i.dogs.rhaenyra.action);
  await shot('13-rhaenyra-esperando-portao.png');
  await page.keyboard.press('KeyE');
  await sleep(250);
  i = await info();
  check(i.dogs.radhija.action === 'tug', 'Radhija puxa a cordinha (action tug)', i.dogs.radhija.action);
  await sleep(700);
  await shot('14-plano-portao-abrindo.png');
  i = await info();
  check(i.camera.shot, 'plano de foco do portão ativo');
  await sleep(1300);
  i = await info();
  check(i.stage === 'gateOpen' && i.gate.open, 'portão aberto → etapa gateOpen', `t=${i.gate.t}`);
  const tug = await logOf('rope:tug');
  const go = await logOf('gate:open');
  check(tug.length === 1 && go.length === 1, 'eventos rope:tug e gate:open emitidos uma vez');

  // 3) Companheira volta a seguir pelo portão
  await sleep(3500);
  i = await info();
  check(i.dogs.rhaenyra.x > 1.05, 'Rhaenyra passou pelo portão e voltou a seguir', `x=${i.dogs.rhaenyra.x} modo=${i.dogs.rhaenyra.mode}`);
  await shot('15-rhaenyra-seguindo.png');

  // 4) Troca para a Rhaenyra
  await page.keyboard.press('KeyQ');
  await sleep(200);
  i = await info();
  check(i.activeDog === 'rhaenyra', 'Q troca para a Rhaenyra');
  const sw = await logOf('dog:switch');
  check(sw.at(-1)?.name === 'rhaenyra' && sw.at(-1)?.displayName === 'Rhaenyra', 'dog:switch {name, displayName}');
  await sleep(900);
  await shot('16-troca-rhaenyra.png');

  // 5) Rhaenyra até o carrinho e empurra com Shift
  await walkTo(2.6, -1.0);
  d = await walkTo(3.5, -2.25, { tol: 0.15 });
  await hold(['KeyD'], 600); // encosta sem Shift → dica
  const h1 = await logOf('hint');
  check(h1.some((h) => h.text === 'Segure Shift para empurrar'), 'dica "Segure Shift para empurrar"');
  i = await info();
  check(Math.abs(i.cart.x - 4.4) < 0.01, 'sem Shift o carrinho não se move', `x=${i.cart.x}`);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');
  await sleep(700);
  i = await info();
  check(i.cart.pushing && i.dogs.rhaenyra.action === 'push', 'empurrando: pushing + action push', `${i.cart.pushing}/${i.dogs.rhaenyra.action}`);
  await shot('17-empurrando-carrinho.png');
  await sleep(1300);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ShiftLeft');
  await sleep(300);
  i = await info();
  check(i.cart.x >= 5.25 && i.stage === 'cartMoved', 'carrinho passou de revealX → etapa cartMoved', `x=${i.cart.x}`);
  const cm = await logOf('cart:move');
  check(cm.length > 20, 'cart:move contínuo', `${cm.length} eventos`);
  const ps = await logOf('dog:pushStart');
  const pe = await logOf('dog:pushEnd');
  check(ps.length >= 1 && pe.length >= 1, 'dog:pushStart / dog:pushEnd');
  check((await logOf('carrot:revealed')).length === 1, 'carrot:revealed emitido');
  await sleep(200);
  await shot('18-plano-cenoura-liberada.png');

  // 6) Pegar a cenoura
  await sleep(1500);
  d = await walkTo(4.4, -3.55, { tol: 0.15 });
  i = await info();
  check(i.prompt === 'Pegar a cenoura', 'prompt "Pegar a cenoura"', i.prompt);
  await page.keyboard.press('KeyE');
  await sleep(300);
  i = await info();
  check(i.stage === 'carrying' && i.carrier === 'rhaenyra' && i.dogs.rhaenyra.carrying, 'Rhaenyra pegou a cenoura → carrying');
  const parentOk = await ev(() => {
    const g = window.__game;
    const o = g.props.carrot.object;
    return o.parent === g.dogs.rhaenyra.mouthSocket && o.position.length() < 1e-6;
  });
  check(parentOk, 'cenoura reparentada no mouthSocket com posição zerada');
  await shot('19-cenoura-na-boca.png');

  // 7) Levar até a porta (andando de verdade, pelo portão)
  await walkTo(3.0, -1.2);
  await walkTo(1.75, 1.6);
  await walkTo(0.35, 1.75);
  await shot('20-voltando-pelo-portao.png');
  await walkTo(-2.0, -1.0);
  d = await walkTo(-3.6, -3.7, { timeout: 8000 });
  await sleep(300);
  i = await info();
  check(i.state === 'celebrating' || i.state === 'victory', 'entregou na porta → celebrating', i.state);
  check((await logOf('celebrate:start')).length === 1, 'celebrate:start emitido');
  await sleep(400);
  await shot('21a-comemoracao-inicio.png');
  await sleep(1100);
  i = await info();
  check(i.dogs.radhija.action === 'celebrate' && i.dogs.rhaenyra.action === 'celebrate', 'as duas comemoram na porta',
    `${i.dogs.radhija.action}/${i.dogs.rhaenyra.action} R=(${i.dogs.radhija.x},${i.dogs.radhija.z}) H=(${i.dogs.rhaenyra.x},${i.dogs.rhaenyra.z})`);
  await shot('21-comemoracao.png');
  await sleep(1500);
  i = await info();
  check(i.state === 'victory', 'estado victory após ~3 s');
  await sleep(1800);
  const vic = await logOf('victory');
  check(vic.length === 1 && vic[0].timeSec > 5 && vic[0].total === 3, 'evento victory {timeSec, collected, total}', JSON.stringify(vic[0]));
  await shot('22-vitoria.png');
  const states = (await logOf('game:state')).map((s) => `${s.prev}→${s.state}`);
  console.log(`  estados: ${states.join(', ')}`);

  // 8) Reiniciar
  await ev(() => window.__game.events.emit('ui:restart', {}));
  await sleep(500);
  i = await info();
  check(i.state === 'playing' && i.stage === 'start' && !i.carrier && i.cart.x === 4.4 && i.gate.t === 0 && i.collected === 0,
    'ui:restart volta ao início (estado, etapa, carrinho, portão, cenoura)', `${i.state}/${i.stage}`);
  check(Math.abs(i.dogs.radhija.x + 3.25) < 0.05 && Math.abs(i.dogs.rhaenyra.x + 3.95) < 0.05, 'dogs de volta à porta');
  const home = await ev(() => {
    const g = window.__game;
    return g.props.carrot.object.parent !== g.dogs.rhaenyra.mouthSocket && g.props.carrot.object.parent !== g.dogs.radhija.mouthSocket;
  });
  check(home, 'cenoura devolvida à cena');
  check((await logOf('game:reset')).length >= 1, 'game:reset emitido');
  await shot('23-reiniciado.png');
}

// =====================================================================
async function sideTests() {
  console.log('\n== Testes específicos ==');
  // --- Pausa / retomada
  await load('?play');
  await clearLog();
  await page.keyboard.press('Escape');
  await sleep(150);
  let i = await info();
  check(i.state === 'paused', 'Esc pausa');
  const before = i.dogs.radhija;
  await hold(['KeyS'], 500);
  i = await info();
  check(Math.abs(i.dogs.radhija.x - before.x) < 1e-3 && Math.abs(i.dogs.radhija.z - before.z) < 1e-3, 'pausado: entrada ignorada');
  await shot('30-pausa.png');
  await page.keyboard.press('Escape');
  await sleep(150);
  i = await info();
  check(i.state === 'playing', 'Esc retoma');
  await page.keyboard.press('Escape');
  await sleep(100);
  await ev(() => window.__game.events.emit('ui:resume', {}));
  await sleep(100);
  i = await info();
  check(i.state === 'playing', 'ui:resume retoma');
  const st = (await logOf('game:state')).map((s) => `${s.prev}→${s.state}`).join(', ');
  check(st.includes('playing→paused') && st.includes('paused→playing'), 'game:state {state, prev}', st);

  // --- Latido (E sem nada perto)
  await page.keyboard.press('KeyE');
  await sleep(100);
  check((await logOf('dog:bark')).length === 1, 'E sem nada perto → dog:bark');

  // --- Movimento: aceleração, parada, pivô, sem deslize lateral
  await hold(['KeyS'], 700);
  i = await info();
  const v1 = i.dogs.radhija.speed;
  check(v1 > 2.0, 'acelera até ~2.4 m/s', `${v1}`);
  await page.keyboard.down('KeyS');
  await sleep(300);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyW');
  await sleep(90);
  i = await info();
  const pivotSpeed = i.dogs.radhija.v;
  await sleep(400);
  await page.keyboard.up('KeyW');
  check(pivotSpeed < 1.2, 'inversão brusca: pivô com queda de velocidade', `v=${pivotSpeed}`);
  await sleep(250);
  i = await info();
  check(i.dogs.radhija.speed < 0.3, 'desacelera e para rápido ao soltar', `${i.dogs.radhija.speed}`);

  // --- Colecionável
  await ev(() => window.__game.game.debug.teleport('radhija', -4.0, 1.7));
  await sleep(100);
  await walkTo(-4.7, 1.7, { tol: 0.15 });
  const cp = await logOf('collectible:pickup');
  check(cp.length === 1 && cp[0].count === 1 && cp[0].total === 3, 'colecionável coletado ao encostar', JSON.stringify(cp[0] || {}));

  // --- Cerca: não atravessa em vários pontos (andando e na arrancada)
  let crossed = 0;
  for (const z of [-4.2, -3.0, -1.5, -0.5, 0.5, 1.0, 1.6, 2.1, 3.0, 4.0]) {
    await ev((zz) => window.__game.game.debug.teleport('radhija', 0.2, zz), z);
    await sleep(60);
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyS'); // diagonal S+D ≈ +X com leve +Z
    await sleep(120);
    await page.keyboard.press('ShiftLeft'); // arrancada contra a cerca
    await sleep(450);
    await page.keyboard.up('KeyS');
    await page.keyboard.up('KeyD');
    i = await info();
    // Deslizar pela face da cerca até a abertura (z ≈ -2.1) e passar por ela é legítimo.
    const viaGap = Math.abs(i.dogs.radhija.z + 2.1) < 0.45;
    if (i.dogs.radhija.x > 0.95 && !viaGap) { crossed++; console.log(`    atravessou em z=${z}: x=${i.dogs.radhija.x} z=${i.dogs.radhija.z}`); }
    else if (i.dogs.radhija.x > 0.95) console.log(`    (z=${z}: deslizou pela cerca e passou pela abertura — ok)`);
  }
  check(crossed === 0, 'arrancada contra a cerca/portão fechado em 10 pontos: nunca atravessa');
  const bumps = await logOf('dog:bump');
  check(bumps.length >= 3, 'dog:bump ao bater com velocidade alta', `${bumps.length}`);
  const dashes = await logOf('dog:dash');
  check(dashes.length >= 5, 'dog:dash emitido', `${dashes.length}`);
  check((await logOf('hint')).some((h) => h.text.startsWith('Trancado')), 'dica do portão trancado pelo oeste');

  // --- Arrancada pela abertura (ela cabe) e contra o carrinho
  await ev(() => window.__game.game.debug.teleport('radhija', 0.0, -2.1));
  await sleep(1300);
  await page.keyboard.down('KeyD');
  await sleep(60);
  await page.keyboard.press('ShiftLeft');
  await sleep(500);
  await page.keyboard.up('KeyD');
  i = await info();
  check(i.dogs.radhija.x > 1.1, 'arrancada atravessa a abertura (Radhija cabe)', `x=${i.dogs.radhija.x}`);
  await ev(() => window.__game.game.debug.teleport('radhija', 3.2, -2.25));
  await sleep(1300);
  await clearLog();
  await page.keyboard.down('KeyD');
  await sleep(80);
  await page.keyboard.press('ShiftLeft');
  await sleep(700);
  i = await info();
  check(i.dogs.radhija.x < 4.4 - 0.575 - 0.17 + 0.02 && i.cart.x === 4.4, 'Radhija não atravessa nem move o carrinho', `x=${i.dogs.radhija.x} cart=${i.cart.x}`);
  check(i.dogs.radhija.action === 'strain', 'Radhija força o carrinho (strain)', i.dogs.radhija.action);
  await shot('31-radhija-strain.png');
  await page.keyboard.up('KeyD');
  check((await logOf('hint')).some((h) => h.text.startsWith('Pesado demais')), 'dica "Pesado demais para a Radhija…"');

  // --- Rhaenyra bloqueada na abertura
  await load('?play&dog=rhaenyra');
  await clearLog();
  i = await info();
  check(i.activeDog === 'rhaenyra', '?dog=rhaenyra começa com a Rhaenyra');
  await walkTo(0.3, -2.1);
  await hold(['KeyD'], 1200);
  i = await info();
  check(i.dogs.rhaenyra.x < 0.75, 'Rhaenyra não passa pela abertura', `x=${i.dogs.rhaenyra.x}`);
  await page.keyboard.down('KeyD');
  await page.keyboard.press('ShiftLeft');
  await sleep(500);
  await page.keyboard.up('KeyD');
  i = await info();
  check(i.dogs.rhaenyra.x < 0.75, 'nem com Shift', `x=${i.dogs.rhaenyra.x}`);
  check((await logOf('hint')).some((h) => h.text.startsWith('A Rhaenyra não cabe')), 'dica "A Rhaenyra não cabe aqui…"');
  await shot('32-rhaenyra-bloqueada-abertura.png');

  // --- Companheira Radhija segue pela abertura quando a líder Rhaenyra está do outro lado? (ao contrário: ok)
  // --- Etapas por URL
  for (const s of ['east', 'gateOpen', 'cartMoved', 'carrying']) {
    await load(`?play&stage=${s}`);
    i = await info();
    check(i.stage === s, `?stage=${s}`, `${i.stage} ativa=${i.activeDog} R=(${i.dogs.radhija.x},${i.dogs.radhija.z}) H=(${i.dogs.rhaenyra.x},${i.dogs.rhaenyra.z})`);
  }
  await shot('33-stage-carrying.png');
  // a partir de carrying: entrega com teclas → vitória
  await walkTo(3.0, -1.2);
  await walkTo(1.75, 1.6);
  await walkTo(0.35, 1.75);
  await walkTo(-2.0, -1.0);
  await walkTo(-3.6, -3.7, { timeout: 8000 });
  await sleep(3600);
  i = await info();
  check(i.state === 'victory', '?stage=carrying → entrega → vitória');

  // --- Tela inicial → ui:play
  await load('');
  i = await info();
  check(i.state === 'title' && i.camera.mode === 'title', 'tela inicial com câmera cinematográfica');
  await shot('34-titulo.png');
  await ev(() => window.__game.events.emit('ui:play', {}));
  await sleep(800);
  await shot('35-transicao-titulo-jogo.png');
  await sleep(1200);
  i = await info();
  check(i.state === 'playing' && i.camera.mode === 'follow', 'ui:play → playing com transição para o seguimento');

  // --- Depuração
  await load('?play&debug');
  await shot('36-debug.png');
}

try {
  if (ONLY === 'all' || ONLY === 'full') await fullRun();
  if (ONLY === 'all' || ONLY === 'tests') await sideTests();
} catch (e) {
  fail++;
  console.log(`  FALHOU  exceção: ${e.message}`);
  try { await shot('99-erro.png'); } catch {}
} finally {
  await browser.close();
  console.log(`\n${pass} ok, ${fail} falha(s)`);
  if (errors.length) { console.log(`ERROS DE CONSOLE (${errors.length}):`); for (const e of errors.slice(0, 20)) console.log(e); } else console.log('sem erros de console');
  process.exit(fail ? 1 : 0);
}
