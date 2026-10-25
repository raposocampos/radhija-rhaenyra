// FASE 3 · Operação Pantufa — partida completa com TECLAS REAIS + casos de borda.
//   node tools/scripts/playthrough-fase3.mjs [--url http://127.0.0.1:5176/] [--only full|tests]
// Capturas em shots/mecanica/f3-*.png. Sai com código 1 se algo falhar.
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const ONLY = args.only || 'all';
const H = await createHarness({ base: BASE, outDir: 'shots/mecanica' });
const { check, sleep, info, ev, shot, logOf, clearLog, walkTo, walkPath, press, load, waitFor, record, page } = H;

const inWater = () => ev(() => {
  const g = window.__game.game;
  const out = {};
  for (const n of ['radhija', 'rhaenyra']) {
    const c = g.debug.ctrls[n];
    const water = g.debug.world.contacts(c.x, c.z, c.r * 0.9, c.size).some((h) => h.kind === 'water');
    const B = g.debug.world.bounds;
    out[n] = water || c.x < B.minX || c.x > B.maxX || c.z < B.minZ || c.z > B.maxZ;
  }
  return out;
});

// =====================================================================
async function fullRun() {
  console.log('\n== Fase 3: partida completa (teclas reais) ==');
  await load('?level=3&play');
  let i = await info();
  check(i.state === 'playing' && i.levelId === 'fase3' && i.stage === 'start', 'fase 3 começa jogando na etapa start', `${i.levelId}/${i.stage}`);
  check(i.objective === 'Descubra como abrir o portão de treliça', 'objetivo inicial', i.objective);
  await clearLog();
  await shot('f3-01-inicio.png');

  // 1) Radhija na pedra pesada: leve demais
  await walkPath([[-5.9, -1.6], [-5.6, 1.4], [-5.0, 2.9, { tol: 0.12 }]]);
  await sleep(500);
  i = await info();
  check(!i.plateH.pressed, 'Radhija não afunda a pedra pesada', JSON.stringify(i.plateH));
  check((await logOf('hint')).some((h) => h.text.startsWith('Leve demais para a pedra grande')), 'dica "Leve demais para a pedra grande…"');
  await shot('f3-02-radhija-pedra-pesada.png');

  // 2) Rhaenyra na pedra pesada → lanterna H
  await walkTo(-4.0, 2.4);
  await press('KeyQ', 300);
  await walkTo(-5.0, 2.9, { tol: 0.12 });
  await sleep(700);
  i = await info();
  check(i.plateH.pressed && i.plateH.by === 'rhaenyra', 'Rhaenyra afunda a pedra pesada');
  check((await logOf('lantern:on')).some((l) => l.id === 'H'), 'lantern:on {id:H}');
  check(i.objective.startsWith('Lanterna acesa! Agora troque para a Radhija'), 'objetivo: troque para a Radhija', i.objective);
  await shot('f3-03-lanterna-H.png');

  // 3) Sem Fica: ela sai da pedra seguindo → lanterna apaga + dica
  await press('KeyQ', 200);
  await walkTo(-3.4, 1.0);
  await sleep(1500);
  i = await info();
  check(!i.plateH.pressed, 'Rhaenyra saiu da pedra seguindo a líder', JSON.stringify(i.plateH));
  check((await logOf('lantern:off')).some((l) => l.id === 'H'), 'lantern:off {id:H}');
  check((await logOf('hint')).some((h) => h.text.startsWith('Use Fica (F)')), 'dica "Use Fica (F)…"');

  // 4) De novo com Fica
  await press('KeyQ', 300);
  await walkTo(-5.0, 2.9, { tol: 0.12 });
  await sleep(800);
  await press('KeyQ', 120);
  await press('KeyF', 300);
  i = await info();
  check(i.stay.rhaenyra && i.plateH.pressed, 'Fica: Rhaenyra fica na pedra pesada', JSON.stringify(i.stay));
  check(i.objective === 'Agora a pedrinha do cantinho, com a Radhija', 'objetivo: pedrinha do cantinho', i.objective);

  // 5) Radhija no cantinho → as duas pedras → portão abre e trava
  await walkPath([[-3.4, 1.0], [-3.1, -1.6], [-3.04, -2.4, { tol: 0.1 }], [-3.04, -3.3, { tol: 0.12 }], [-2.95, -3.85, { tol: 0.1 }]]);
  await sleep(500);
  i = await info();
  check(i.plateL.pressed && i.plateL.by === 'radhija', 'Radhija pressiona a pedrinha do cantinho', JSON.stringify(i.plateL));
  check(i.gate.locked && i.stage === 'gateOpen', 'as duas pedras juntas → portão abre e trava (gateOpen)', JSON.stringify(i.gate));
  check((await logOf('gate:open')).length === 1 && (await logOf('gate:locked')).length === 1, 'gate:open + gate:locked');
  check((await logOf('item:revealed')).some((p) => p.item === 'slipper'), 'item:revealed {item:slipper}');
  // o plano dura ~2 s e começa no meio do caminho: confere o registro (camera:shot) em vez do instante
  const go = (await logOf('gate:open'))[0];
  const camShots = await logOf('camera:shot');
  check(!!go && camShots.some((c) => Math.hypot(c.x - (go.x - 0.2), c.z - go.z) < 0.3), 'plano de foco do portão com as lanternas', JSON.stringify(camShots));
  await sleep(500);
  await shot('f3-04-portao-aberto-lanternas.png');

  // 6) Sai do cantinho; Vem (F); a Radhija vai até a gansa e leva uma investida
  await walkPath([[-3.04, -3.3, { tol: 0.12 }], [-3.04, -2.4, { tol: 0.1 }], [-3.4, 1.4], [-2.9, 3.0], [-1.1, 3.0]]);
  await press('KeyF', 200);
  i = await info();
  check(!i.stay.rhaenyra, 'Vem (F): a Rhaenyra volta a seguir');
  await clearLog();
  // o knockback (startled) dura frações de segundo: grava a animação quadro a quadro
  const recHit = await record((g) => g.debug.info().dogs.radhija.action);
  await walkTo(-0.9, 0.6, { timeout: 6000, stopIf: (s) => s.goose.state === 'alert' || s.goose.state === 'charge' });
  await walkTo(0.0, -0.4, { timeout: 4000, stopIf: (s) => s.fx.radhija.busy });
  i = await waitFor((s) => s.fx.radhija.busy, { timeout: 4000, step: 30 });
  check((await logOf('goose:alert')).length >= 1 && (await logOf('goose:charge')).length >= 1, 'gansa: goose:alert + goose:charge');
  check((await logOf('goose:hit')).some((h) => h.name === 'radhija'), 'gansa acerta a Radhija (goose:hit)');
  i = await waitFor((s) => s.dogs.radhija.action === 'startled', { timeout: 1500, step: 20 });
  const hitActions = await recHit.stop();
  check(hitActions.includes('startled'), 'knockback com action startled', i.dogs.radhija.action);
  await shot('f3-05-gansa-investida.png');
  await sleep(700);
  const w1 = await inWater();
  check(!w1.radhija, 'knockback não joga na água nem para fora dos limites');
  check((await logOf('hint')).some((h) => h.text.startsWith('A Dona Gansa não deixa')), 'dica "A Dona Gansa não deixa ninguém passar!…"');
  i = await info();
  check(i.objective === 'Distraia a Dona Gansa com um latido (E)', 'objetivo: distrair com latido', i.objective);

  // 7) Posiciona a Rhaenyra perto da ponte (fora do alerta) com Fica; Radhija vai latir no gramado sul
  await walkTo(-1.2, 2.1, { tol: 0.15 });
  i = await waitFor((s) => Math.hypot(s.dogs.rhaenyra.x + 1.2, s.dogs.rhaenyra.z - 2.1) < 1.4 && s.dogs.rhaenyra.speed < 0.1, { timeout: 8000 });
  await walkTo(-0.4, 2.9, { tol: 0.15 });
  await sleep(300);
  await press('KeyF', 200);
  i = await info();
  check(i.stay.rhaenyra, 'Rhaenyra fica esperando perto da ponte', `(${i.dogs.rhaenyra.x}, ${i.dogs.rhaenyra.z})`);
  await walkPath([[0.8, 3.5], [2.3, 3.5, { tol: 0.15 }]]);
  await clearLog();
  const gooseTiming = await record((g) => {
    const s = g.debug.info();
    return { time: s.timeSec, state: s.goose.state };
  });
  const curiousTime = await ev(() => window.__game.layout.GOOSE.curiousTime);
  await press('KeyE', 150);
  const tBark = Date.now();
  i = await info();
  const gBark = i.timeSec; // tempo de JOGO (o FPS pode cair abaixo de 20 com a máquina carregada)
  check((await logOf('dog:bark')).length === 1, 'latido (E sem nada perto)');
  check((await logOf('goose:lured')).length === 1, 'gansa atraída pelo latido (goose:lured)');
  check(i.goose.state === 'lured' || i.goose.state === 'curious', 'gansa indo ver', i.goose.state);
  await shot('f3-06-gansa-atraida.png');

  // 8) Espera a gansa chegar para ver; troca para a Rhaenyra, atravessa a ponte, pega a pantufa, volta
  await sleep(600);
  await press('KeyQ', 120);
  await press('KeyF', 120); // a Radhija espera no gramado (não disputa a ponte estreita)
  i = await info();
  check(i.activeDog === 'rhaenyra' && !i.stay.rhaenyra, 'quem vira ativa perde o Fica');
  check(i.objective === 'Rápido! Atravesse a ponte e pegue a pantufa (E)', 'objetivo: rápido, a pantufa', i.objective);
  await walkPath([[-0.45, 0.2, { tol: 0.35 }], [-0.1, -0.6, { tol: 0.25 }], [2.5, -0.6, { tol: 0.35 }], [3.05, -0.4, { tol: 0.2 }]], { timeout: 8000 });
  i = await info();
  console.log(`    Rhaenyra (${i.dogs.rhaenyra.x}, ${i.dogs.rhaenyra.z}) · gansa ${i.goose.state} (${i.goose.x}, ${i.goose.z}) · ${((Date.now() - tBark) / 1000).toFixed(1)} s`);
  check(i.prompt === 'Pegar a pantufa', 'prompt "Pegar a pantufa"', i.prompt);
  await press('KeyE', 250);
  i = await info();
  check(i.stage === 'carrying' && i.carrier === 'rhaenyra', 'Rhaenyra pegou a pantufa (carrying)');
  check((await logOf('item:pickup')).some((p) => p.item === 'slipper'), 'item:pickup {item:slipper}');
  await shot('f3-07-pantufa.png');
  await walkPath([[2.4, -0.6, { tol: 0.3 }], [0.0, -0.6, { tol: 0.3 }], [-0.9, 1.0, { tol: 0.35 }], [-1.1, 3.0]]);
  i = await info();
  const tOut = i.timeSec - gBark;
  const hitsOut = (await logOf('goose:hit')).length;
  console.log(`    robô saiu da ponte ${tOut.toFixed(1)} s (jogo) depois do latido; investidas na volta: ${hitsOut} (o robô anda em 8 direções com paradas — um jogador é mais rápido)`);
  console.log(`    janela usada: ${tOut.toFixed(1)} s de jogo; gansa: ${i.goose.state}`);
  i = await waitFor((s) => s.goose.state === 'return' || s.goose.state === 'patrol', { timeout: 20000 });
  const tBack = i.timeSec - gBark;
  check(i.goose.state === 'return' || i.goose.state === 'patrol', 'gansa volta depois de curiosa (goose:return)', `${tBack.toFixed(1)} s de jogo`);
  // O caminho até o latido varia com a posição da patrulha. A garantia da mecânica
  // é curiousTime parada, e não 12 s fixos somando um trajeto variável.
  const gooseFrames = await gooseTiming.stop();
  const curiousAt = gooseFrames.find((f) => f.state === 'curious')?.time;
  const returnedAt = gooseFrames.find((f) => f.state === 'return' && f.time > curiousAt)?.time;
  const curiousElapsed = returnedAt - curiousAt;
  // Amostragem por quadro, dt limitado a 0,05 s; timeSec arredonda a centésimos.
  check(curiousElapsed >= curiousTime - 0.06, 'gansa respeita todo o tempo de curiosidade configurado', `${curiousElapsed.toFixed(2)} s / ${curiousTime} s`);
  check((await logOf('goose:return')).length >= 1, 'goose:return emitido');

  // 9) Leva a pantufa até a porta de vidro
  await walkPath([[-2.9, 3.0], [-3.4, 1.4], [-3.3, -1.6], [-4.4, -3.0]]);
  await walkTo(-5.0, -3.6, { timeout: 6000 });
  await sleep(400);
  i = await info();
  check(i.state === 'celebrating' || i.state === 'victory', 'entregou na porta de vidro → comemoração', i.state);
  await sleep(1300);
  await shot('f3-08-comemoracao.png');
  i = await waitFor((s) => s.state === 'victory', { timeout: 5000 });
  check(i.state === 'victory', 'vitória da fase 3');
  const vic = await logOf('victory');
  check(vic.length === 1 && vic[0].levelId === 'fase3' && vic[0].hasNext === true, 'evento victory (fase3, com a fase 4 depois)', JSON.stringify(vic[0] || {}));
  await sleep(1500);
  await shot('f3-09-vitoria.png');

  await ev(() => window.__game.events.emit('ui:restart', {}));
  await sleep(500);
  i = await info();
  check(i.stage === 'start' && !i.gate.locked && !i.carrier && i.goose.state === 'patrol' && i.lanterns.H < 0.5, 'ui:restart zera a fase 3');
}

// =====================================================================
async function sideTests() {
  console.log('\n== Fase 3: casos de borda ==');
  // --- Rhaenyra não cabe no cantinho
  // Ela chega a LESTE do vão e segura W (a frente da câmera puxa 17° para oeste): encosta na cerca-viva baixa e
  // escorrega rente a ela pela frente do vão inteiro, sempre empurrando para dentro. A página solta o W quando o centro
  // dela passa a oeste do vão (prazo em tempo de jogo). Antes ela parava no meio do vão e segurava W 0,9 s: conforme o
  // ponto (tolerância de 10 cm) e o rumo em que chegava, encostava já a oeste do vão, só na cerca comum, e a dica não
  // saía (~11% das chegadas no jogo headless, igual a 20, 30 e 60 fps; 2 de 44 execuções da suíte no CI).
  await load('?level=3&play&dog=rhaenyra');
  await clearLog();
  const gap = await ev(() => window.__game.layout.NOOK.gap);
  await walkPath([[-3.1, -1.6], [-2.66, -2.3, { tol: 0.1 }]]);
  const sweep = await record((g) => {
    const c = g.debug.ctrls.rhaenyra;
    return { x: c.x, z: c.z };
  });
  let i = await H.holdUntil(['KeyW'], (s, a) => s.dogs.rhaenyra.x < a.xMin - 0.05, { timeout: 4000, arg: gap, label: 'W rente à cerca-viva pela frente do vão' });
  const path = await sweep.stop();
  const deepest = path.reduce((m, p) => (p.z < m.z ? p : m), { x: 0, z: Infinity });
  // encostada na cerca-viva (o peito a 0,36 m da linha do vão) com o centro na frente do vão
  const atGap = path.filter((p) => p.x > gap.xMin && p.x < gap.xMax && p.z < gap.z + 0.4).length;
  check(atGap > 0 && i.dogs.rhaenyra.x < gap.xMin - 0.05, 'Rhaenyra empurra a cerca-viva pela frente do vão inteiro', `${atGap} quadros no vão; fim (${i.dogs.rhaenyra.x}, ${i.dogs.rhaenyra.z})`);
  check(path.length > 0 && deepest.z > gap.z + 0.1, 'Rhaenyra não entra no cantinho', `mais funda (${deepest.x.toFixed(3)}, ${deepest.z.toFixed(3)}) em ${path.length} quadros`);
  check((await logOf('hint')).some((h) => h.text.startsWith('A Rhaenyra não cabe no cantinho')), 'dica do cantinho');
  await shot('f3-20-rhaenyra-cantinho.png');

  // --- Radhija tenta a pantufa (pesada)
  await load('?level=3&play&stage=gateOpen');
  await clearLog();
  i = await info();
  check(i.stage === 'gateOpen' && i.gate.locked, '?stage=gateOpen');
  await ev(() => window.__game.game.debug.teleport('radhija', 2.9, -0.45));
  await sleep(200);
  await walkTo(3.05, -0.4, { tol: 0.1 });
  i = await info();
  check(i.prompt !== 'Pegar a pantufa', 'sem prompt de pegar para a Radhija', i.prompt);
  await press('KeyE', 200);
  i = await info();
  check(!i.carrier, 'Radhija não pega a pantufa');
  check((await logOf('hint')).some((h) => h.text === 'A pantufa é pesada demais para a Radhija!'), 'dica "A pantufa é pesada demais para a Radhija!"');

  // --- Knockback em vários pontos ao redor da gansa: nunca na água / fora dos limites
  await load('?level=3&play&stage=gateOpen');
  const spots = [[-0.1, 1.9], [1.0, -0.6], [-1.4, -0.6], [0.5, 0.6], [0.6, -1.9], [-0.1, -3.0], [1.6, -0.6]];
  let bad = 0;
  let hits = 0;
  for (const [x, z] of spots) {
    await ev(() => window.__game.game.debug.puzzle.mech.goose.reset());
    await ev(([xx, zz]) => window.__game.game.debug.teleport('radhija', xx, zz), [x, z]);
    await clearLog();
    await sleep(2600);
    const hit = (await logOf('goose:hit')).length;
    hits += hit ? 1 : 0;
    await sleep(500);
    const w = await inWater();
    i = await info();
    if (w.radhija) { bad++; console.log(`    na água/fora em (${x}, ${z}) → (${i.dogs.radhija.x}, ${i.dogs.radhija.z})`); }
  }
  check(bad === 0, 'knockback em 7 pontos ao redor da gansa: nunca na água/fora dos limites', `${hits} investidas acertaram`);
  check(hits >= 4, 'gansa investe quando a dog ativa chega perto', `${hits}/7`);
  await shot('f3-21-knockback-ponte.png');

  // --- Gansa atraída e voltando: medir a janela
  await load('?level=3&play&stage=gateOpen');
  await clearLog();
  await walkPath([[0.8, 3.5], [2.3, 3.5, { tol: 0.15 }]]);
  await press('KeyE', 100);
  const t0 = (await info()).timeSec;
  i = await waitFor((s) => s.goose.state === 'curious', { timeout: 15000 });
  const tC = i.timeSec - t0;
  i = await waitFor((s) => s.goose.state === 'return', { timeout: 25000 });
  const tR = i.timeSec - t0;
  i = await waitFor((s) => s.goose.state === 'patrol', { timeout: 20000 });
  const tP = i.timeSec - t0;
  check(i.goose.state === 'patrol', 'gansa atraída → curiosa → volta à patrulha', `curiosa ${tC.toFixed(1)} s · volta ${tR.toFixed(1)} s · patrulha ${tP.toFixed(1)} s`);
  check(tR >= 9.5 && tR <= 16, 'janela do latido até ela voltar ≈ 10–16 s (folgada)', `${tR.toFixed(1)} s`);
  // --- latido fora do alcance não atrai
  await load('?level=3&play&stage=gateOpen');
  await clearLog();
  await ev(() => window.__game.game.debug.teleport('radhija', 6.2, 3.8));
  await sleep(300);
  await press('KeyE', 150);
  check((await logOf('goose:lured')).length === 0, 'latido longe demais (> lureR) não atrai a gansa');
}

try {
  if (ONLY === 'all' || ONLY === 'full') await fullRun();
  if (ONLY === 'all' || ONLY === 'tests') await sideTests();
} catch (e) {
  check(false, `exceção: ${e.message}`);
  try { await shot('f3-99-erro.png'); } catch {}
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
