// FASE 2 · Operação Bolinha — partida completa com TECLAS REAIS + casos de borda.
//   node tools/scripts/playthrough-fase2.mjs [--url http://127.0.0.1:5176/] [--only full|tests]
// Capturas em shots/mecanica/f2-*.png. Sai com código 1 se algo falhar.
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const ONLY = args.only || 'all';
const H = await createHarness({ base: BASE, outDir: 'shots/mecanica' });
const { check, sleep, gsleep, info, ev, shot, logOf, clearLog, walkTo, walkPath, hold, holdUntil, press, load, waitFor, record, page } = H;

const SPR = { x: -0.4, z: -1.5, r: 2.2 };
const TAU = Math.PI * 2;

/** Atravessa o irrigador com a Radhija (arrancada), mirando a fase boa dos jatos (ver sim-sprinkler.mjs). */
async function crossSprinkler({ maxTries = 8 } = {}) {
  for (let k = 0; k < maxTries; k++) {
    const p0 = (await info()).dogs.radhija;
    // ao sul da folha aberta do portão: contorna pela ponta (leste) antes de ir ao ponto de partida
    if (p0.z > 1.45 && p0.x < -0.9) await walkPath([[-0.7, Math.max(1.9, p0.z)], [-0.7, 1.15]]);
    await walkTo(-1.714, 0.707, { tol: 0.1 });
    await walkTo(-1.714, 0.707, { tol: 0.1 });
    await sleep(250);
    // espera a fase boa dos jatos (0,45–0,85 rad, mod 2π/3) lendo o ângulo do PRÓPRIO jogo
    // (o tempo de jogo pode andar mais devagar que o relógio quando o FPS cai abaixo de 20).
    const per = TAU / 3;
    const tw = Date.now();
    while (Date.now() - tw < 8000) {
      const a = (await info()).sprinkler.angle;
      const cur = ((a % per) + per) % per;
      if (cur > 0.45 && cur < 0.85) break;
    }
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.keyboard.press('ShiftLeft');
    const t0 = Date.now();
    let res = null;
    while (Date.now() - t0 < 9000) {
      const i = await info();
      const d = i.dogs.radhija;
      // arrancada sempre que possível enquanto estiver no disco
      if (!d.dashing && Math.hypot(d.x - SPR.x, d.z - SPR.z) < SPR.r + 0.4) await page.keyboard.press('ShiftLeft');
      if (i.fx.radhija.busy) { res = 'wet'; break; }
      if (Math.hypot(d.x - SPR.x, d.z - SPR.z) > SPR.r + 0.3 && d.z < -2.5) { res = 'ok'; break; }
      await sleep(15);
    }
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    console.log(`    tentativa ${k + 1}: ${res}`);
    if (res === 'ok') return k + 1;
    await sleep(1800); // empurrada para fora + chacoalhar
  }
  return 0;
}

// =====================================================================
async function fullRun() {
  console.log('\n== Fase 2: partida completa (teclas reais) ==');
  await load('?level=2&play');
  let i = await info();
  check(i.state === 'playing' && i.levelId === 'fase2' && i.stage === 'start', 'fase 2 começa jogando na etapa start', `${i.levelId}/${i.stage}`);
  check(i.objective === 'Encontre um jeito de abrir o portão', 'objetivo inicial', i.objective);
  await clearLog();
  await shot('f2-01-inicio.png');

  // 1) Radhija na tábua: leve demais
  await walkPath([[-4.2, -0.6], [-3.5, 2.55, { tol: 0.12 }]]);
  await sleep(500);
  i = await info();
  check(!i.plank.pressed && i.gate.t === 0, 'Radhija na tábua não aciona (leve demais)', JSON.stringify(i.plank));
  check((await logOf('hint')).some((h) => h.text.startsWith('Leve demais')), 'dica "Leve demais! Precisa de alguém mais pesado…"');
  await shot('f2-02-radhija-tabua-leve.png');

  // 2) Rhaenyra na tábua → portão abre
  await walkTo(-4.3, 1.4);
  await press('KeyQ', 300);
  i = await info();
  check(i.activeDog === 'rhaenyra', 'Q troca para a Rhaenyra');
  await walkTo(-3.5, 2.6, { tol: 0.12 });
  await sleep(1200);
  i = await info();
  check(i.plank.pressed && i.plank.by === 'rhaenyra', 'Rhaenyra pressiona a tábua', JSON.stringify(i.plank));
  check(i.gate.t > 0.97, 'portão abre com a tábua pressionada', `t=${i.gate.t}`);
  check((await logOf('plate:press')).some((p) => p.id === 'plank' && p.by === 'rhaenyra'), 'plate:press {id:plank, by:rhaenyra}');
  check((await logOf('gate:open')).length >= 1, 'gate:open emitido');
  check(i.objective.startsWith('Portão aberto'), 'objetivo: troque para a Radhija', i.objective);
  await shot('f2-03-rhaenyra-tabua-portao-aberto.png');

  // 3) Caso de borda: troca SEM Fica → a Rhaenyra sai da tábua seguindo → o portão fecha
  await press('KeyQ', 30);
  i = await info();
  check(i.activeDog === 'radhija' && (i.dogs.rhaenyra.mode === 'hold' || i.plank.pressed), 'troca: a nova companheira espera um instante antes de seguir (hold)', i.dogs.rhaenyra.mode);
  check(i.objective === 'Peça para a Rhaenyra ficar na tábua (F)', 'objetivo pede o Fica', i.objective);
  await walkTo(-4.6, 0.3);
  await sleep(1600);
  i = await info();
  check(!i.plank.pressed && i.gate.t < 0.05, 'Rhaenyra saiu da tábua seguindo → portão fechou', `plank=${i.plank.pressed} t=${i.gate.t}`);
  check((await logOf('gate:close')).length >= 1, 'gate:close emitido');
  check((await logOf('hint')).some((h) => h.text === 'Peça para a Rhaenyra ficar na tábua (F)!'), 'dica "Peça para a Rhaenyra ficar na tábua (F)!"');
  check((await logOf('plate:release')).some((p) => p.id === 'plank'), 'plate:release emitido');
  await shot('f2-04-portao-fechou.png');

  // 4) De novo, agora com Fica (F)
  await press('KeyQ', 300);
  await walkTo(-3.5, 2.6, { tol: 0.12 });
  await sleep(900);
  await press('KeyQ', 120);
  await press('KeyF', 250);
  i = await info();
  check(i.stay.rhaenyra && i.dogs.rhaenyra.stay, 'F: Rhaenyra fica (stay)', JSON.stringify(i.stay));
  const cs = await logOf('companion:stay');
  check(cs.at(-1)?.name === 'rhaenyra' && cs.at(-1)?.stay === true, 'companion:stay {name, stay:true}');
  await walkTo(-3.2, 0.9);
  await sleep(700);
  i = await info();
  check(i.plank.pressed && i.gate.t > 0.97, 'com Fica ela continua na tábua e o portão aberto', `t=${i.gate.t}`);
  check(i.dogs.rhaenyra.sitting && i.dogs.rhaenyra.mode === 'stay', 'Rhaenyra senta e espera (mode stay)', `${i.dogs.rhaenyra.action}/${i.dogs.rhaenyra.mode}`);
  check(i.objective === 'Passe pelo portão com a Radhija', 'objetivo: passe pelo portão', i.objective);
  await shot('f2-05-fica-na-tabua.png');

  // 5) Passa o portão e dá a arrancada no calço
  await walkPath([[-1.7, 0.95], [-0.75, 1.3], [-0.72, 2.35, { tol: 0.1 }]]);
  i = await info();
  check(i.objective.startsWith('Trave o portão'), 'objetivo: trave o portão com a arrancada', i.objective);
  await walkTo(-0.95, 2.35, { tol: 0.06 });
  let nShots = (await logOf('camera:shot')).length;
  await page.keyboard.down('KeyA');
  await gsleep(60);
  await page.keyboard.press('ShiftLeft');
  await gsleep(500);
  await page.keyboard.up('KeyA');
  await gsleep(400);
  i = await info();
  const wk = await logOf('wedge:kick');
  check(i.wedge.locked && wk.some((w) => w.locked), 'arrancada no calço com o portão aberto → travado (wedge:kick locked)', JSON.stringify(i.wedge));
  check((await logOf('gate:locked')).length === 1, 'gate:locked emitido');
  check(i.stage === 'gateLocked', 'etapa gateLocked', i.stage);
  check((await logOf('camera:shot')).length > nShots, 'plano de foco do calço/portão');
  await shot('f2-06-calco-travado.png');

  // 6) Vem (F): a Rhaenyra sai da tábua e o portão continua aberto
  await press('KeyF', 1500);
  i = await info();
  check(!i.stay.rhaenyra && i.gate.t > 0.97 && i.gate.locked, 'Vem (F): ela sai da tábua e o portão segue travado', `t=${i.gate.t}`);

  // 7) Irrigador: atravessar com a arrancada no ritmo
  i = await info();
  check(i.objective.startsWith('Atravesse o irrigador'), 'objetivo do irrigador', i.objective);
  await sleep(1500);
  i = await info();
  const rh = i.dogs.rhaenyra;
  check(Math.hypot(rh.x - SPR.x, rh.z - SPR.z) > SPR.r, 'companheira não entra no irrigador ligado (espera fora)', `(${rh.x}, ${rh.z}) modo=${rh.mode}`);
  const tries = await crossSprinkler();
  check(tries > 0, 'Radhija atravessa o irrigador com a arrancada', `${tries} tentativa(s)`);
  await shot('f2-07-atravessou-irrigador.png');

  // 8) Registro
  await walkTo(1.2, -4.05, { tol: 0.15 });
  await sleep(200);
  i = await info();
  check(i.prompt === 'Fechar o registro', 'prompt "Fechar o registro"', i.prompt);
  nShots = (await logOf('camera:shot')).length;
  await press('KeyE', 300);
  i = await info();
  check(i.dogs.radhija.action === 'turn', 'Radhija gira o registro (action turn)', i.dogs.radhija.action);
  await sleep(500);
  await shot('f2-08-registro.png');
  await sleep(900);
  i = await info();
  check(!i.sprinkler.running && i.stage === 'sprinklersOff', 'registro fechado → irrigador desligado (sprinklersOff)', JSON.stringify(i.sprinkler));
  check((await logOf('valve:turn')).length === 1 && (await logOf('sprinkler:off')).length === 1, 'valve:turn e sprinkler:off');
  check((await logOf('camera:shot')).length > nShots, 'plano de foco do irrigador desligando');
  await sleep(600);
  await shot('f2-09-irrigador-desligado.png');

  // 9) Rhaenyra vem pelo gramado
  i = await waitFor((s) => Math.hypot(s.dogs.rhaenyra.x - s.dogs.radhija.x, s.dogs.rhaenyra.z - s.dogs.radhija.z) < 1.8, { timeout: 14000 });
  check(Math.hypot(i.dogs.rhaenyra.x - i.dogs.radhija.x, i.dogs.rhaenyra.z - i.dogs.radhija.z) < 1.8, 'Rhaenyra atravessa o gramado e alcança a Radhija', `(${i.dogs.rhaenyra.x}, ${i.dogs.rhaenyra.z})`);

  // 10) Radhija força o caixote (pesado) → troca → Rhaenyra empurra
  await walkPath([[2.3, -4.2], [2.3, -3.25, { tol: 0.1 }]]);
  await hold(['KeyD'], 700);
  check((await logOf('hint')).some((h) => h.text.startsWith('Pesado demais para a Radhija')), 'Radhija não move o caixote (dica)');
  await walkTo(2.4, -2.3);
  await press('KeyQ', 400);
  await walkPath([[2.3, -2.8], [2.33, -3.25, { tol: 0.07 }]]);
  await hold(['KeyD'], 500);
  check((await logOf('hint')).some((h) => h.text === 'Segure Shift para empurrar'), 'dica "Segure Shift para empurrar"');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');
  i = await gsleep(700);
  check(i.crate.pushing && i.dogs.rhaenyra.action === 'push', 'empurrando o caixote (push)', JSON.stringify(i.crate));
  await shot('f2-10-empurrando-caixote.png');
  await gsleep(1700);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ShiftLeft');
  i = await info();
  check(i.crate.x > 3.95, 'caixote foi para o leste (eixo X)', `x=${i.crate.x}`);
  // empurra para o sul até o vão
  await walkPath([[3.4, -4.1], [i.crate.x, -3.25 - 0.38 - 0.24, { tol: 0.06 }]]);
  await holdUntil(['ShiftLeft', 'KeyS'], (s) => s.crate.z > 1.32, { timeout: 9000 });
  await sleep(300);
  i = await info();
  check(Math.abs(i.crate.z - 1.4) < 0.3, 'caixote empurrado para o sul até o vão (eixo Z)', `z=${i.crate.z}`);
  // empurra para o leste no vão → cai e vira ponte
  await walkPath([[i.crate.x - 0.75, i.crate.z - 0.7], [i.crate.x - 0.62, i.crate.z, { tol: 0.06 }]]);
  await holdUntil(['ShiftLeft', 'KeyD'], (s) => s.crate.enabled === false, { timeout: 4000 });
  await sleep(300);
  await shot('f2-11-caixote-caindo.png');
  await sleep(900);
  i = await info();
  check(i.bridge && i.stage === 'bridge', 'caixote caiu no canal → ponte (etapa bridge)', `bridge=${i.bridge} stage=${i.stage}`);
  check((await logOf('crate:sink')).length === 1 && (await logOf('item:revealed')).some((p) => p.item === 'ball'), 'crate:sink + item:revealed {item:ball}');
  check((await logOf('crate:move')).length > 30, 'crate:move contínuo');
  await shot('f2-12-ponte.png');

  // 11) Atravessa a ponte e pega a bolinha
  await walkPath([[3.9, 1.4], [5.75, 1.4], [5.82, -2.78, { tol: 0.1 }]]);
  i = await info();
  check(i.prompt === 'Pegar a bolinha', 'prompt "Pegar a bolinha"', i.prompt);
  await press('KeyE', 300);
  i = await info();
  check(i.stage === 'carrying' && i.carrier === 'rhaenyra', 'Rhaenyra pegou a bolinha (carrying)');
  const pk = await logOf('item:pickup');
  check(pk.some((p) => p.item === 'ball' && p.name === 'rhaenyra'), 'item:pickup {item:ball}');
  await shot('f2-13-bolinha.png');

  // 12) Volta até a caminha
  await walkPath([[5.75, 1.4], [3.8, 1.4], [3.75, -1.0], [3.4, -3.9], [2.2, -4.3], [1.0, -3.9], [-0.4, -1.5], [-1.6, 0.9], [-3.1, 0.9], [-4.2, -0.6]]);
  await walkTo(-5.0, -3.4, { timeout: 8000 });
  await sleep(400);
  i = await info();
  check(i.state === 'celebrating' || i.state === 'victory', 'entregou na caminha → comemoração', i.state);
  await sleep(1300);
  await shot('f2-14-comemoracao.png');
  i = await waitFor((s) => s.state === 'victory', { timeout: 5000 });
  check(i.state === 'victory', 'vitória da fase 2');
  const vic = await logOf('victory');
  check(vic.length === 1 && vic[0].levelId === 'fase2', 'evento victory (fase2)', JSON.stringify(vic[0] || {}));
  await sleep(1500);
  await shot('f2-15-vitoria.png');

  // 13) Reiniciar
  await ev(() => window.__game.events.emit('ui:restart', {}));
  await sleep(500);
  i = await info();
  check(i.stage === 'start' && !i.gate.locked && i.gate.t === 0 && i.sprinkler.running && i.crate.enabled && !i.bridge && !i.carrier && !i.stay.rhaenyra,
    'ui:restart zera a fase 2 (portão, irrigador, caixote, ponte, bolinha, Fica)');
}

// =====================================================================
async function sideTests() {
  console.log('\n== Fase 2: casos de borda ==');
  // --- Arrancada no calço com o portão fechado
  await load('?level=2&play');
  await clearLog();
  await ev(() => window.__game.game.debug.teleport('radhija', -0.95, 2.35));
  await sleep(300);
  await page.keyboard.down('KeyA');
  await sleep(60);
  await page.keyboard.press('ShiftLeft');
  await sleep(450);
  await page.keyboard.up('KeyA');
  await sleep(200);
  let i = await info();
  const wk = await logOf('wedge:kick');
  check(!i.wedge.locked && wk.length >= 1 && wk[0].locked === false, 'arrancada no calço com o portão fechado: quica, não trava', JSON.stringify(wk[0] || {}));
  check((await logOf('hint')).some((h) => h.text === 'O calço só trava com o portão aberto!'), 'dica do calço com portão fechado');
  await shot('f2-20-calco-portao-fechado.png');
  // sem beco sem saída: a Rhaenyra ainda alcança a tábua e reabre
  await press('KeyQ', 300);
  await walkPath([[-4.2, -0.6], [-3.5, 2.6, { tol: 0.12 }]]);
  await sleep(1100);
  i = await info();
  check(i.gate.t > 0.97, 'Radhija presa do lado leste: Rhaenyra reabre pela tábua (sem beco sem saída)', `t=${i.gate.t}`);

  // --- Molhar e voltar (Radhija andando para dentro do disco)
  await load('?level=2&play&stage=gateLocked');
  await clearLog();
  i = await info();
  check(i.stage === 'gateLocked' && i.stay.rhaenyra, '?stage=gateLocked (Rhaenyra fica na tábua)', `${i.stage} stay=${i.stay.rhaenyra}`);
  // a reação dura frações de segundo: grava a animação quadro a quadro em vez de ler num instante
  const recWet = await record((g) => { const i = g.debug.info(); return { busy: i.fx.radhija.busy, action: i.dogs.radhija.action, t: i.simSec }; });
  await walkTo(-1.1, -0.2, { timeout: 6000, stopIf: (s) => s.fx.radhija.busy });
  i = await waitFor((s) => s.fx.radhija.busy, { timeout: 6000, step: 30 });
  check(i.fx.radhija.busy, 'Radhija molhada pelo jato');
  await gsleep(800);
  const wetFrames = await recWet.stop();
  const hitAt = wetFrames.findIndex((f) => f.busy);
  const after = hitAt < 0 ? [] : wetFrames.slice(hitAt).filter((f) => f.t - wetFrames[hitAt].t < 1.0).map((f) => f.action);
  const seq = [...new Set(after)].join(' → ');
  check(after.some((a) => a === 'startled' || a === 'shake'), 'reação ao jato (startled → shake)', seq);
  i = await info();
  const dOut = Math.hypot(i.dogs.radhija.x - SPR.x, i.dogs.radhija.z - SPR.z);
  check(dOut > SPR.r, 'empurrada para fora do disco', `d=${dOut.toFixed(2)}`);
  check(after.includes('shake'), 'chacoalha (action shake)', seq);
  check(i.fx.radhija.wet > 0.9, 'molhada (wet ≈ 1)', i.fx.radhija.wet);
  const okPos = await ev(() => { const g = window.__game.game; const c = g.debug.ctrls.radhija; return !g.debug.world.overlaps(c.x, c.z, c.r * 0.95, c.size); });
  check(okPos, 'posição válida depois do empurrão');
  check((await logOf('sprinkler:hit')).some((h) => h.name === 'radhija'), 'sprinkler:hit {name}');
  check((await logOf('hint')).some((h) => h.text.startsWith('Molhou!')), 'dica "Molhou!…"');
  await shot('f2-21-molhada-chacoalhando.png');
  await sleep(6500);
  i = await info();
  check(i.fx.radhija.wet < 0.35, 'molhado decai com o tempo', i.fx.radhija.wet);

  // --- Rhaenyra tenta o irrigador a pé
  await ev(() => window.__game.game.debug.teleport('rhaenyra', -1.5, 1.0));
  await press('KeyQ', 300);
  await clearLog();
  await walkTo(0.5, -3.6, { timeout: 7000, stopIf: (s) => s.fx.rhaenyra.busy });
  i = await waitFor((s) => s.fx.rhaenyra.busy, { timeout: 3000, step: 30 });
  check((await logOf('sprinkler:hit')).some((h) => h.name === 'rhaenyra'), 'Rhaenyra a pé é molhada');
  check((await logOf('hint')).some((h) => h.text.startsWith('A Rhaenyra é devagar')), 'dica "A Rhaenyra é devagar para os jatos…"');

  // --- Caixote em todos os cantos (sem beco sem saída) e ponte no fim
  await load('?level=2&play&stage=sprinklersOff&dog=rhaenyra');
  await clearLog();
  i = await info();
  check(i.stage === 'sprinklersOff' && i.activeDog === 'rhaenyra', '?stage=sprinklersOff com a Rhaenyra', `${i.stage}/${i.activeDog}`);
  const push = async (key, until, timeout = 8000) => {
    // solta no quadro em que a condição vale (sob carga, o keyup do teste chega tarde e o caixote passava do ponto)
    const r = await holdUntil(['ShiftLeft', key], until, { timeout });
    await sleep(250);
    return r;
  };
  // (a) para o norte → canto (minX, minZ)
  await walkPath([[2.4, -2.3], [2.95, -2.63, { tol: 0.06 }]]);
  i = await push('KeyW', (s) => s.crate.z <= -3.49, 3000);
  check(Math.abs(i.crate.z + 3.5) < 0.02 && Math.abs(i.crate.x - 2.95) < 0.02, 'caixote no canto (minX, minZ)', `${i.crate.x}, ${i.crate.z}`);
  // (b) leste até x≈3.5 (vão de 0,52 m atrás dele: a Rhaenyra cabe)
  await walkPath([[2.3, -2.8], [2.33, -3.5, { tol: 0.06 }]]);
  i = await push('KeyD', (s) => s.crate.x >= 3.48, 3000);
  check(i.crate.x >= 3.45, 'empurrado do vão atrás do caixote (gap 0,52 m)', `x=${i.crate.x}`);
  // (c) sul: os tijolos bloqueiam (dica)
  await walkPath([[3.3, -4.3], [i.crate.x, -4.12, { tol: 0.06 }]]);
  i = await push('KeyS', (s) => s.crate.blockedBy === 'tijolos', 5000);
  check(i.crate.blockedBy === 'tijolos' || Math.abs(i.crate.z + 1.64) < 0.05, 'tijolos bloqueiam o caixote', `z=${i.crate.z} ${i.crate.blockedBy}`);
  await sleep(300);
  check((await logOf('hint')).some((h) => h.text.startsWith('Os tijolos')), 'dica dos tijolos');
  // (d) oeste até minX (empurrando pela face leste)
  i = await info();
  await walkPath([[4.15, i.crate.z - 0.9], [i.crate.x + 0.62, i.crate.z, { tol: 0.06 }]]);
  i = await push('KeyA', (s) => s.crate.x <= 2.96, 3000);
  check(Math.abs(i.crate.x - 2.95) < 0.03, 'caixote no limite oeste (minX)', `x=${i.crate.x}`);
  await shot('f2-22-caixote-oeste.png');
  // (e) leste até maxX → empurrar mais no leste fora do vão: dica
  await walkPath([[2.3, i.crate.z - 0.8], [2.33, i.crate.z, { tol: 0.06 }]]);
  i = await push('KeyD', (s) => s.crate.x >= 4.0, 4000);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');
  await sleep(900);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ShiftLeft');
  check((await logOf('hint')).some((h) => h.text.startsWith('O caixote só entra no canal')), 'na margem fora do vão: dica do meio-fio');
  // (f) sul até maxZ (canto maxX, maxZ)
  i = await info();
  await walkPath([[3.5, i.crate.z - 0.9], [i.crate.x, i.crate.z - 0.62, { tol: 0.06 }]]);
  i = await push('KeyS', (s) => s.crate.z >= 3.56, 9000);
  check(i.crate.z >= 3.55, 'caixote no canto (maxX, maxZ)', `z=${i.crate.z}`);
  // ainda dá para ficar ao sul dele e empurrar para o norte
  await walkPath([[3.2, 3.0], [3.2, 4.16, { tol: 0.06 }], [i.crate.x, 4.16, { tol: 0.06 }]]);
  i = await info();
  check(i.dogs.rhaenyra.z > 3.95 + 0.15, 'Rhaenyra cabe ao sul do caixote no canto', `(${i.dogs.rhaenyra.x}, ${i.dogs.rhaenyra.z})`);
  await shot('f2-23-caixote-canto-sul.png');
  i = await push('KeyW', (s) => s.crate.z <= 1.45, 7000);
  check(Math.abs(i.crate.z - 1.4) < 0.3, 'de volta ao vão empurrando para o norte', `z=${i.crate.z}`);
  await walkPath([[i.crate.x - 0.75, i.crate.z - 0.7], [i.crate.x - 0.62, i.crate.z, { tol: 0.06 }]]);
  i = await push('KeyD', (s) => s.bridge, 4000);
  await sleep(1200);
  i = await info();
  check(i.bridge, 'caixote vira ponte depois do tour pelos cantos');
}

try {
  if (ONLY === 'all' || ONLY === 'full') await fullRun();
  if (ONLY === 'all' || ONLY === 'tests') await sideTests();
} catch (e) {
  check(false, `exceção: ${e.message}`);
  try { await shot('f2-99-erro.png'); } catch {}
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
