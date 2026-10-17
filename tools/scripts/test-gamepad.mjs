// Controle (Gamepad API) por simulação: um navigator.getGamepads falso (window.__fakePads) com
// mapeamento "standard" (posições PlayStation: ✕=A, ○=B, □=X, △=Y, L1=LB, R1=RB, L2=LT, R2=RT).
// Testa analógico proporcional + zona morta, D-pad, ✕/○/□/△/L1/R1/R2/Options,
// vibração, input:device, trava ao voltar do menu, desconexão e pollMenuPad().
//   node tools/scripts/test-gamepad.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/mecanica' });
const { check, sleep, info, ev, shot, logOf, clearLog, load, page } = H;
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

const connect = () => ev(() => {
  window.__rumbles = [];
  const pad = {
    id: 'Controle falso (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    vibrationActuator: { type: 'dual-rumble', playEffect(type, p) { window.__rumbles.push({ type, ...p }); return Promise.resolve('complete'); } },
  };
  window.__fakePads = [pad];
  window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
});
const btn = (i, on) => ev(([ii, o]) => { const p = window.__fakePads[0]; p.buttons[ii] = { pressed: o, touched: o, value: o ? 1 : 0 }; p.timestamp = performance.now(); }, [i, on]);
const axes = (x, y) => ev(([xx, yy]) => { const p = window.__fakePads[0]; p.axes = [xx, yy, 0, 0]; p.timestamp = performance.now(); }, [x, y]);
async function tap(i, ms = 110) { await btn(i, true); await sleep(ms); await btn(i, false); await sleep(110); }

try {
  console.log('\n== Controle (gamepad simulado) ==');
  // O foco não pode reiniciar a entrada do botão Jogar e fazê-lo desaparecer.
  // Amostra no navegador, inclusive na troca de classes: uma leitura tardia
  // pelo protocolo pode perder o intervalo invisível em runners sem GPU.
  await load('');
  const watchPlay = () => ev(() => {
    const root = document.querySelector('.rr');
    const play = root.querySelector('[data-action="play"]');
    const watch = { minOpacity: 1, visible: true, samples: 0, running: true };
    const sample = () => {
      const css = getComputedStyle(play);
      watch.minOpacity = Math.min(watch.minOpacity, Number(css.opacity));
      watch.visible &&= css.visibility === 'visible' && css.display !== 'none';
      watch.samples++;
    };
    const observer = new MutationObserver(sample);
    observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['class', 'data-device'] });
    const frame = () => { if (watch.running) { sample(); requestAnimationFrame(frame); } };
    sample();
    requestAnimationFrame(frame);
    window.__stopPlayWatch = () => {
      watch.running = false;
      observer.disconnect();
      sample();
      return { minOpacity: watch.minOpacity, visible: watch.visible, samples: watch.samples,
        action: document.querySelector('.rr-title .is-focus')?.dataset.action,
        state: window.__game.game.state };
    };
  });
  const checkPlay = async (move, expectedAction, label) => {
    await watchPlay();
    await move();
    await sleep(1100);
    const result = await ev(() => window.__stopPlayWatch());
    check(result.action === expectedAction && result.state === 'title', `${label}: navega sem iniciar a fase`, result);
    check(result.samples > 1 && result.visible && result.minOpacity >= 0.99, `${label}: Jogar continua visível durante toda a navegação`, result);
  };
  await page.keyboard.press('ArrowUp'); // ativa o realce com Jogar selecionado
  await sleep(200);
  await checkPlay(() => page.keyboard.press('ArrowDown'), 'select', 'teclado baixo');
  await checkPlay(() => page.keyboard.press('ArrowUp'), 'play', 'teclado cima');
  await connect();
  await tap(B.UP); // ativa o dispositivo com Jogar selecionado
  await checkPlay(() => tap(B.DOWN), 'select', 'D-pad baixo');
  await checkPlay(() => tap(B.UP), 'play', 'D-pad cima');
  await checkPlay(async () => { await axes(0, 1); await sleep(110); await axes(0, 0); }, 'select', 'analógico baixo');
  await checkPlay(() => page.keyboard.press('ArrowUp'), 'play', 'retorno ao teclado');
  await checkPlay(() => page.mouse.move(2, 2), 'play', 'retorno ao mouse');
  await shot('gp-00-menu-jogar-visivel.png');

  await load('?play');
  await clearLog();
  await connect();
  await sleep(200);

  // Analógico: zona morta e velocidade proporcional
  await axes(0, 0.14);
  await sleep(700);
  let i = await info();
  check(i.dogs.radhija.speed < 0.05, 'zona morta (0,14 de inclinação): parada', i.dogs.radhija.speed);
  const open = () => ev(() => window.__game.game.debug.teleport('radhija', -2.0, -0.2));
  await open();
  await axes(0, 0.5);
  await sleep(900);
  i = await info();
  const half = i.dogs.radhija.speed;
  check(half > 0.55 && half < 1.25, 'meia inclinação: anda devagar (velocidade proporcional)', `${half} m/s`);
  check(i.input.device === 'gamepad' && (await logOf('input:device')).some((d) => d.type === 'gamepad'), 'input:device {type: gamepad}');
  await axes(0, 0);
  await open();
  await sleep(300);
  await axes(0, 1);
  await sleep(800);
  i = await info();
  check(i.dogs.radhija.speed > 2.1, 'inclinação total: trote (~2,4 m/s)', `${i.dogs.radhija.speed} m/s`);
  await axes(0, 0);
  await sleep(500);
  // D-pad
  const x0 = (await info()).dogs.radhija;
  await btn(B.DOWN, true);
  await sleep(500);
  await btn(B.DOWN, false);
  await sleep(300);
  i = await info();
  check(Math.hypot(i.dogs.radhija.x - x0.x, i.dogs.radhija.z - x0.z) > 0.6, 'D-pad move a dog');

  // ○ (interagir/latir) e □ (latir sempre)
  await clearLog();
  await tap(B.B);
  await sleep(400);
  await tap(B.X);
  i = await info();
  check((await logOf('dog:bark')).length === 2, '○ (sem nada perto) e □ latem', `${(await logOf('dog:bark')).length} latidos`);

  // △ = Fica/Vem
  await tap(B.Y);
  i = await info();
  check(i.stay.rhaenyra && (await logOf('companion:stay')).at(-1)?.stay === true, '△: Fica (companion:stay true)');
  await tap(B.Y);
  i = await info();
  check(!i.stay.rhaenyra && (await logOf('companion:stay')).at(-1)?.stay === false, '△ de novo: Vem (stay false)');

  // L1 = trocar (ida e volta); com a Rhaenyra, ✕ pula
  await tap(B.LB);
  i = await info();
  check(i.activeDog === 'rhaenyra', 'L1 troca para a Rhaenyra');
  await clearLog();
  await tap(B.A);
  await sleep(600);
  const jumps = await logOf('dog:jump');
  check(jumps.length === 1, '✕ com a Rhaenyra pula', JSON.stringify(jumps));
  await tap(B.LB);
  i = await info();
  check(i.activeDog === 'radhija', 'L1 troca de volta para a Radhija');

  // R2 e R1 = arrancada (borda) — e vibração
  await clearLog();
  await open();
  await axes(0, 1);
  await sleep(250);
  await tap(B.RT);
  await sleep(900);
  await axes(0, 0);
  await open();
  await axes(0, 1);
  await sleep(700); // arrancada 0,3 s + resfriamento 0,8 s
  await tap(B.RB);
  await axes(0, 0);
  await sleep(300);
  check((await logOf('dog:dash')).length === 2, 'R2 e R1: arrancada (borda, não repete segurando)', `${(await logOf('dog:dash')).length}`);
  const rum = await ev(() => window.__rumbles);
  check(rum.length >= 2 && rum.every((r) => r.type === 'dual-rumble' && r.duration <= 300 && r.strongMagnitude <= 0.6), 'vibração dual-rumble curta e suave na arrancada', JSON.stringify(rum[0] || {}));

  // Segurar R1 com a Rhaenyra = empurrar (postura)
  await tap(B.LB);
  await btn(B.RB, true);
  await axes(0, -1);
  await sleep(500);
  i = await info();
  check(i.dogs.rhaenyra.action === 'push', 'segurar R1 com a Rhaenyra: postura de empurrar', i.dogs.rhaenyra.action);
  await btn(B.RB, false);
  await axes(0, 0);

  // A mesma dica deve acompanhar o dispositivo, mesmo sem parênteses na tecla.
  // Passa pelo evento real do HUD; não injeta HTML nem muda o dispositivo na UI.
  await ev(() => window.__game.events.emit('hint', { text: 'Segure Shift para empurrar', duration: 60 }));
  const hintText = () => page.locator('.rr-hint__text').innerText();
  let hint = await hintText();
  check(/R1/.test(hint) && !/Shift|RB/.test(hint), 'dica de empurrar no PlayStation mostra R1, sem Shift', hint);

  await ev(() => { window.__fakePads[0].id = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)'; });
  await page.waitForFunction(() => document.querySelector('.rr').dataset.pad === 'xbox');
  hint = await hintText();
  check(/RB/.test(hint) && !/Shift|R1/.test(hint), 'a mesma dica no Xbox mostra RB, sem Shift', hint);

  await page.keyboard.press('ShiftLeft');
  await page.waitForFunction(() => document.querySelector('.rr').dataset.device === 'keyboard');
  hint = await hintText();
  check(/Shift/.test(hint) && !/R1|RB/.test(hint), 'a mesma dica volta a Shift ao usar o teclado', hint);
  await ev(() => {
    window.__fakePads[0].id = 'Controle falso (STANDARD GAMEPAD)';
    window.__game.events.emit('hint', { text: '' });
  });
  await tap(B.LB);

  // Options = pausar; no menu ✕/○/D-pad não vazam para o jogo
  await clearLog();
  await tap(B.START);
  await sleep(150);
  i = await info();
  check(i.state === 'paused', 'Options pausa', i.state);

  // Navegação espacial real: o botão largo Continuar não pode capturar as
  // direções laterais entre Reiniciar fase e Menu inicial, na linha de baixo.
  const focused = () => ev(() => {
    const el = document.querySelector('.rr-pause .is-focus');
    return el?.getAttribute('data-action') || (el?.hasAttribute('data-slider') ? 'volume' : null);
  });
  const checkFocus = async (target, label) => {
    const actual = await focused();
    check(actual === target, label, actual);
  };
  await tap(B.DOWN);
  await checkFocus('restart', 'D-pad baixo: Continuar → Reiniciar fase');
  await tap(B.RIGHT);
  await checkFocus('menu', 'D-pad direita: Reiniciar fase → Menu inicial');
  await tap(B.LEFT);
  await checkFocus('restart', 'D-pad esquerda: Menu inicial → Reiniciar fase');
  await tap(B.DOWN);
  await checkFocus('volume', 'D-pad baixo: Reiniciar fase → Volume');
  const volumeBefore = Number(await page.locator('.rr-range').inputValue());
  await tap(B.RIGHT);
  const volumeAfter = Number(await page.locator('.rr-range').inputValue());
  check(await focused() === 'volume' && volumeAfter === Math.min(100, volumeBefore + 5), 'D-pad direita no volume ajusta o valor e mantém o foco');
  await tap(B.LEFT);
  check(await focused() === 'volume' && Number(await page.locator('.rr-range').inputValue()) === Math.max(0, volumeAfter - 5), 'D-pad esquerda no volume ajusta o valor e mantém o foco');
  await tap(B.UP);
  await checkFocus('restart', 'D-pad cima: Volume → Reiniciar fase');
  await tap(B.UP);
  await checkFocus('resume', 'D-pad cima: Reiniciar fase → Continuar');

  for (const [x, y, target] of [[0, 1, 'restart'], [1, 0, 'menu'], [-1, 0, 'restart'], [0, -1, 'resume']]) {
    await axes(x, y);
    await sleep(110);
    await axes(0, 0);
    await sleep(110);
    await checkFocus(target, `analógico (${x}, ${y}): foco em ${target}`);
  }
  for (const [key, target] of [['ArrowDown', 'restart'], ['ArrowRight', 'menu'], ['ArrowLeft', 'restart'], ['ArrowUp', 'resume']]) {
    await page.keyboard.press(key);
    await checkFocus(target, `teclado ${key}: foco em ${target}`);
  }

  const p0 = i.dogs.radhija;
  await axes(0, -1);
  await btn(B.X, true);
  await sleep(400);
  i = await info();
  check(Math.hypot(i.dogs.radhija.x - p0.x, i.dogs.radhija.z - p0.z) < 1e-3 && (await logOf('dog:bark')).length === 0, 'pausado: analógico e botões não mexem a dog');
  await shot('gp-01-pausa-controle.png');
  await axes(0, 0);
  await btn(B.X, false);
  await sleep(150);
  await tap(B.START);
  await sleep(200);
  i = await info();
  check(i.state === 'playing' && (await logOf('dog:bark')).length === 0, 'Options retoma (□ segurado no menu não vira latido)', i.state);
  // ✕ no menu (Continuar) segurado: retoma e NÃO pula/late no primeiro quadro de jogo
  await tap(B.START);
  await sleep(200);
  await btn(B.A, true);
  await sleep(500);
  i = await info();
  const barkA = (await logOf('dog:bark')).length;
  await btn(B.A, false);
  await sleep(250);
  check(i.state === 'playing' && barkA === 0 && (await logOf('dog:bark')).length === 0 && (await logOf('dog:jump')).length === 0, '✕ no menu retoma e fica travado até soltar (sem pulo nem latido)', `${i.state}, latidos=${barkA}`);
  // ○ no menu (voltar) segurado: retoma e não vira interação/latido
  await tap(B.START);
  await sleep(200);
  await btn(B.B, true);
  await sleep(300);
  await axes(0, 1);
  await sleep(500);
  i = await info();
  check(i.state === 'playing' && (await logOf('dog:bark')).length === 0, '○ no menu (voltar) retoma e não vaza como latido', i.state);
  await btn(B.B, false);
  await axes(0, 0);
  await sleep(200);

  // Teclado volta a ser o dispositivo
  await page.keyboard.press('KeyW');
  await sleep(100);
  i = await info();
  check(i.input.device === 'keyboard' && (await logOf('input:device')).at(-1)?.type === 'keyboard', 'tecla → input:device {type: keyboard}');

  // Desconectar no meio: solta tudo
  await open();
  await axes(0, 1);
  await sleep(600);
  check((await info()).dogs.radhija.speed > 1.5, 'andando pelo controle antes de desconectar');
  await ev(() => { const p = window.__fakePads[0]; window.__fakePads = []; window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: p })); });
  await sleep(500);
  i = await info();
  check(i.dogs.radhija.speed < 0.2 && !i.input.pad, 'desconectado: a dog para (sem eixo preso)', `${i.dogs.radhija.speed}`);
  await connect();
  await open();
  await axes(0, 1);
  await sleep(600);
  check((await info()).dogs.radhija.speed > 1.5, 'reconectado no meio do jogo: volta a responder');
  await axes(0, 0);

  // pollMenuPad (para os menus da UI)
  const menu = await ev(async () => {
    const m = await import('/src/game/input.js');
    const p = window.__fakePads[0];
    const set = (i, on) => { p.buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; };
    const out = [];
    let t = 1000;
    m.pollMenuPad(t);
    set(13, true); // D-pad baixo
    out.push(m.pollMenuPad((t += 16)).down);
    let reps = 0;
    for (let k = 0; k < 60; k++) if (m.pollMenuPad((t += 16)).down) reps++; // ~0,96 s segurando
    set(13, false);
    m.pollMenuPad((t += 16));
    set(0, true);
    const a = m.pollMenuPad((t += 16));
    const a2 = m.pollMenuPad((t += 16));
    set(0, false);
    return { first: out[0], reps, confirm: a.confirm, confirmHeld: a2.confirm };
  });
  check(menu.first && menu.reps >= 3 && menu.reps <= 6 && menu.confirm && !menu.confirmHeld, 'pollMenuPad(): borda + repetição ao segurar + confirmar (✕)', JSON.stringify(menu));

  // Troca de fase com item na boca: a fase nova começa com as bocas vazias
  console.log('== Troca de fase com item na boca ==');
  await load('?play&stage=carrying');
  i = await info();
  check(i.carrier === 'rhaenyra', 'fase 1 em carrying (cenoura na boca da Rhaenyra)', i.carrier);
  await ev(() => window.__game.events.emit('ui:nextLevel', {}));
  await page.waitForFunction(() => window.__game.game.level === 1 && window.__game.game.state !== 'loading', null, { timeout: 120000 });
  await sleep(500);
  const mouths = await ev(() => { const d = window.__game.dogs; return [d.radhija.mouthSocket?.children.length ?? -1, d.rhaenyra.mouthSocket?.children.length ?? -1]; });
  check(mouths[0] === 0 && mouths[1] === 0, 'fase 2 começa com as bocas vazias (mouthSocket sem filhos)', JSON.stringify(mouths));
  await ev(() => window.__game.events.emit('ui:play', {}));
  await sleep(600);
  i = await info();
  check(i.levelId === 'fase2' && !i.carrier && i.stage === 'start', 'fase 2 jogável e sem item carregado', `${i.levelId}/${i.stage}/${i.carrier}`);
  await shot('gp-02-fase2-boca-vazia.png');
} catch (e) {
  check(false, `exceção: ${e.message}`);
}
const fails = await H.close();
process.exit(fails ? 1 : 0);
