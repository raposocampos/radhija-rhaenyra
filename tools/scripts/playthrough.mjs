// Partida completa automatizada com TECLAS REAIS (Playwright + Chrome do sistema), em malha fechada:
// lê a posição pelo debug.info() e segura WASD (8 direções relativas à câmera) até chegar a cada ponto.
//   node tools/scripts/playthrough.mjs [--url http://127.0.0.1:5173/] [--only full|tests]
// Capturas em shots/game/. Imprime ok/FALHOU por verificação e sai com código 1 se algo falhar.
import { NAV_NODES } from '../../src/levels/fase1/layout.js';
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const ONLY = args.only || 'all';
const H = await createHarness({ base: BASE, outDir: 'shots/game' });
const { page, check, sleep, gsleep, info, ev, shot, logOf, clearLog, walkTo, hold, waitFor, record } = H;

/** Carrega a página e espera os primeiros quadros (compilação de shaders) e a transição da câmera. */
async function load(query) {
  await H.load(query);
  await sleep(300);
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
  // a companheira vem andando atrás: espera ela chegar ao nó do portão (o prazo conta em tempo de jogo)
  const nearGate = (r) => Math.hypot(r.x - NAV_NODES.W_gate.x, r.z - NAV_NODES.W_gate.z) < 0.6;
  i = await waitFor((s) => s.dogs.rhaenyra.mode === 'wait' && nearGate(s.dogs.rhaenyra), { timeout: 6000 });
  check(i.prompt === 'Puxar a cordinha', 'prompt da cordinha aparece', i.prompt);
  const rh = i.dogs.rhaenyra;
  check(rh.x < 1.0 && rh.mode === 'wait', 'Rhaenyra espera do lado oeste (sem caminho)', `x=${rh.x} z=${rh.z} modo=${rh.mode}`);
  check(nearGate(rh), 'Rhaenyra espera junto ao portão (nó mais próximo da líder)', `(${rh.x}, ${rh.z})`);
  i = await waitFor((s) => s.dogs.rhaenyra.sitting, { timeout: 3000 });
  check(i.dogs.rhaenyra.sitting, 'Rhaenyra senta enquanto espera', i.dogs.rhaenyra.action);
  await shot('13-rhaenyra-esperando-portao.png');
  await page.keyboard.press('KeyE');
  i = await waitFor((s) => s.dogs.radhija.action === 'tug', { timeout: 1000, step: 30 });
  check(i.dogs.radhija.action === 'tug', 'Radhija puxa a cordinha (action tug)', i.dogs.radhija.action);
  await sleep(700);
  await shot('14-plano-portao-abrindo.png');
  i = await waitFor((s) => s.stage === 'gateOpen' && s.gate.open, { timeout: 2500 });
  check(i.stage === 'gateOpen' && i.gate.open, 'portão aberto → etapa gateOpen', `t=${i.gate.t}`);
  // o plano dura ~2 s: confere o registro em vez do instante
  const shots = await logOf('camera:shot');
  check(shots.length === 1 && Math.hypot(shots[0].x - 1.35, shots[0].z - 1.75) < 0.5, 'plano de foco do portão ativo', JSON.stringify(shots));
  const tug = await logOf('rope:tug');
  const go = await logOf('gate:open');
  check(tug.length === 1 && go.length === 1, 'eventos rope:tug e gate:open emitidos uma vez');

  // 3) Companheira volta a seguir pelo portão
  // a líder se afasta da cerca (x = 1,0): parada a 0,5 m dela, a companheira podia estacionar dentro do vão
  await walkTo(2.4, 0.9);
  i = await waitFor((s) => s.dogs.rhaenyra.x > 1.05, { timeout: 6000 });
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
  // a comemoração dura ~3 s de jogo (sob carga, a captura acima pode levar quase tudo isso): espera as duas juntas
  i = await waitFor((s) => s.dogs.radhija.action === 'celebrate' && s.dogs.rhaenyra.action === 'celebrate', { timeout: 2500, step: 40 });
  check(i.dogs.radhija.action === 'celebrate' && i.dogs.rhaenyra.action === 'celebrate', 'as duas comemoram na porta',
    `${i.dogs.radhija.action}/${i.dogs.rhaenyra.action} R=(${i.dogs.radhija.x},${i.dogs.radhija.z}) H=(${i.dogs.rhaenyra.x},${i.dogs.rhaenyra.z})`);
  await shot('21-comemoracao.png');
  i = await waitFor((s) => s.state === 'victory', { timeout: 3500 });
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
  // segura S até a velocidade de corrida; o tempo (de jogo) que levou é o que se confere
  const t0 = (await info()).simSec;
  await page.keyboard.down('KeyS');
  i = await waitFor((s) => s.dogs.radhija.speed > 2.0, { timeout: 1500, step: 30 });
  const v1 = i.dogs.radhija.speed;
  const tAcc = i.simSec - t0;
  check(v1 > 2.0 && tAcc < 1.0, 'acelera até ~2.4 m/s', `${v1} em ${tAcc.toFixed(2)} s de jogo`);
  // inversão: grava a velocidade quadro a quadro (uma leitura a 90 ms perde o pivô quando a máquina está carregada)
  const rec = await record((g) => ({ v: g.debug.ctrls.radhija.v, piv: g.debug.ctrls.radhija.pivoting }));
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyW');
  await gsleep(500);
  await page.keyboard.up('KeyW');
  const frames = await rec.stop();
  const piv = frames.filter((f) => f.piv);
  const pivotSpeed = piv.length ? Math.min(...piv.map((f) => f.v)) : null;
  check(piv.length > 0 && pivotSpeed < 1.2, 'inversão brusca: pivô com queda de velocidade', `v=${pivotSpeed?.toFixed(3)} (${piv.length} quadros de pivô)`);
  await gsleep(250);
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
    // trajetória quadro a quadro: sob carga as teclas ficam seguradas mais tempo e a dog pode passar pela abertura
    // e seguir adiante; o que importa é ONDE ela cruzou a linha da cerca, não onde terminou
    const rec = await record((g) => ({ x: g.debug.ctrls.radhija.x, z: g.debug.ctrls.radhija.z }));
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyS'); // diagonal S+D ≈ +X com leve +Z
    await gsleep(120);
    await page.keyboard.press('ShiftLeft'); // arrancada contra a cerca
    await gsleep(450);
    await page.keyboard.up('KeyS');
    await page.keyboard.up('KeyD');
    const across = (await rec.stop()).find((f) => f.x > 0.95);
    // Deslizar pela face da cerca até a abertura (z ≈ -2.1) e passar por ela é legítimo.
    const viaGap = across && Math.abs(across.z + 2.1) < 0.45;
    if (across && !viaGap) { crossed++; console.log(`    atravessou em z=${z}: x=${across.x.toFixed(3)} z=${across.z.toFixed(3)}`); }
    else if (across) console.log(`    (z=${z}: deslizou pela cerca e passou pela abertura — ok)`);
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
  check(false, `exceção: ${e.message}`);
  try { await shot('99-erro.png'); } catch {}
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
