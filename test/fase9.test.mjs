// Fase 9 (Biblioteca do Vovô): a escadinha travada (impulso no freio), o globo no trilho, a escada empurrada até os
// óculos, a Rhaenyra segurando (E no pé da escada, ou o Fica) enquanto a Radhija sobe; o disjuntor (impulso) que liga
// a energia, o botão do ventilador, o ventilador na grade, o vaso de rodinhas no botão do registro, o superbafo no
// vento que acorda o Bichano e derruba o livro; a porta com mola que a Radhija segura; e as regras de cada passo
// (escada rolando, freio, sem energia, botão só com o vaso, sem vento, superbafo direto, livro sem impulso). Headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { WALL_BUTTON_SHAPE } from '../src/game/mechanics/wallButton.js';
import { DOG_CONFIG } from '../src/dogs/config.js';
import { TEXT } from '../src/levels/fase9/puzzle.js';
import { LEVELS } from '../src/levels/index.js';
import fase9 from '../src/levels/fase9/index.js';

const L = fase9.layout;
const LEVEL = LEVELS.indexOf(fase9) + 1;
const LAT = WALL_BUTTON_SHAPE.lever.lat;
const D = DOG_CONFIG.rhaenyra.wallJumpTime;
const lib = (h) => h.info().biblioteca;
const game = (query = '') => createHeadlessGame({ level: LEVEL, query });

/** Fica ativa a dog `name` (Q se precisar). */
function as(h, name) {
  if (h.info().activeDog !== name) h.tap('KeyQ');
  assert.equal(h.info().activeDog, name);
}
/** Onde ficar para o impulso no botão/alavanca `cfg` (de frente, com a dog um pouco à esquerda dele). */
function kickSpot(cfg) {
  return { x: cfg.x + cfg.nx * 0.6 + -cfg.nz * LAT, z: cfg.z + cfg.nz * 0.6 + cfg.nx * LAT };
}
/** A Rhaenyra vai até a alavanca `cfg` (passando por `via`), fica de frente para a parede e dá o impulso. */
function wallJump(h, cfg, via = []) {
  for (const [x, z] of via) h.walkTo(x, z, { tol: 0.15 });
  const k = kickSpot(cfg);
  h.walkTo(k.x, k.z, { tol: 0.08 });
  h.hold([-cfg.nx, -cfg.nz]);
  h.run(0.2);
  h.hold(null);
  h.run(0.15);
  assert.equal(h.info().prompt, TEXT.prompt.wall, 'prompt do impulso');
  h.tap('Space');
  h.run(D + 0.15);
}
/** Empurra a caixa `info` (escada, globo ou ventilador) na direção `dir` até `until(info)`. */
function push(h, get, half, dir, until, via = [], timeout = 9) {
  for (const [x, z] of via) h.walkTo(x, z, { tol: 0.12 });
  const b = get(h);
  h.walkTo(b.x - dir[0] * (half + 0.3), b.z - dir[1] * (half + 0.3), { tol: 0.07 });
  h.hold(dir, ['ShiftLeft']);
  const ok = h.run(timeout, { until });
  h.hold(null);
  h.run(0.3);
  return ok;
}
const ladderOf = (h) => lib(h).ladder;
const planterOf = (h) => lib(h).planter;
const globeOf = (h) => lib(h).globe;
const fanOf = (h) => lib(h).fan;

test('fase 9: na campanha, depois da 8, com o cenário sob demanda, livro como item e extras', () => {
  assert.equal(LEVELS[LEVEL - 1].id, 'fase9');
  assert.equal(fase9.number, 9);
  assert.equal(fase9.item, 'book');
  assert.equal(typeof fase9.load, 'function');
  assert.equal(L.COLLECTIBLES.length, 3);
  assert.ok(fase9.extras.length >= 1);
});

test('fase 9: partida completa (óculos pela escadinha, livro pelo duto e pela porta)', async () => {
  const h = await game();
  h.run(0.3);
  let s = lib(h);
  assert.deepEqual([s.glasses, s.book, s.cat, s.braked], ['shelf', 'wardrobe', 'asleep', true]);
  assert.equal(h.info().objective, TEXT.objective.brakeRad);

  // ÓCULOS: freio, globo, escada, segurar e subir
  as(h, 'rhaenyra');
  wallJump(h, L.BRAKE_LEVER, [[-2.2, 0.2], [-0.9, 0.15], [1.4, 0.35], [3.6, -1.0]]);
  assert.equal(lib(h).braked, false, 'o impulso soltou o freio');
  assert.ok(push(h, globeOf, L.GLOBE.half, [-1, 0], (i) => i.biblioteca.globeClear, [[2.75, -2.2]]), 'globo empurrado para a frente da lareira');
  assert.ok(push(h, ladderOf, L.LADDER.half, [-1, 0], (i) => i.biblioteca.atGlasses, [[2.6, -2.0], [4.0, -2.0]]), 'escada debaixo dos óculos');
  const hold = { x: L.LADDER.minX + L.LADDER_HOLD.side, z: L.LADDER_HOLD.z };
  h.walkPath([[hold.x + 0.2, -1.9], [hold.x + 0.05, hold.z + 0.05]], { tol: 0.1 });
  h.hold(null);
  h.run(0.1);
  assert.equal(h.info().prompt, TEXT.prompt.hold, 'prompt de segurar a escada');
  h.clearLog();
  h.tap('KeyE');
  assert.equal(lib(h).holding, true, 'a Rhaenyra segura a escada (E)');
  assert.equal(h.log('ladder:hold').length, 1);
  const rh0 = { x: h.ctrls.rhaenyra.x, z: h.ctrls.rhaenyra.z };
  h.tap('KeyQ');
  h.run(0.6);
  assert.equal(lib(h).held, true, 'continua segurando depois da troca');
  assert.ok(Math.hypot(h.ctrls.rhaenyra.x - rh0.x, h.ctrls.rhaenyra.z - rh0.z) < 0.05, 'e não sai do pé da escada');
  assert.equal(h.info().objective, TEXT.objective.climbRad);
  h.walkPath([[L.LADDER.minX + 0.1, -1.55], [L.LADDER.minX, -1.98]], { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.15);
  h.hold(null);
  h.run(0.1);
  assert.equal(h.info().prompt, TEXT.prompt.climb);
  h.clearLog();
  h.tap('KeyE');
  assert.equal(h.log('ladder:climb').length, 1, 'subiu');
  assert.ok(h.run(6, { until: (i) => i.glasses.holder === 'radhija' }), 'pegou os óculos lá em cima');
  assert.ok(h.run(4, { until: (i) => !i.biblioteca.climb }), 'desceu');
  assert.equal(h.ctrls.radhija.y, 0);
  h.walkTo(L.GOAL.x + 0.6, L.GOAL.z - 0.2, { tol: 0.15 });
  assert.ok(h.run(2, { until: (i) => i.biblioteca.glasses === 'table' }), 'óculos na mesinha');
  assert.equal(h.info().stage, 'glasses');

  // LIVRO: disjuntor (energia), botão do ventilador, ventilador na grade, vaso no botão do registro, superbafo no vento
  as(h, 'rhaenyra');
  wallJump(h, L.BREAKER, [[2.2, -0.6], [3.7, 0.25], [5.55, 0.25], [6.3, -1.5]]);
  assert.equal(lib(h).power, true, 'o disjuntor ligou a energia');
  assert.equal(h.info().objective, TEXT.objective.fanOn);
  h.walkPath([[6.6, -0.3], [7.45, 0.2], [7.45, 1.25], [7.0, 1.3]], { tol: 0.12 });
  h.hold(null);
  h.run(0.1);
  assert.equal(h.info().prompt, TEXT.prompt.fan, 'prompt do botão do ventilador');
  h.tap('KeyE');
  assert.equal(lib(h).fanOn, true, 'ventilador ligado (E)');
  assert.ok(push(h, fanOf, L.FAN.half, [-1, 0], (i) => Math.abs(i.biblioteca.fan.x - L.DUCT.inlet.x) < 0.12, [[7.45, 1.0], [7.45, 0.7]]), 'ventilador para o oeste');
  assert.ok(push(h, fanOf, L.FAN.half, [0, -1], (i) => i.biblioteca.aligned, [[6.7, 1.3]]), 'ventilador na grade do duto');
  assert.equal(lib(h).damper, false, 'o registro continua fechado');
  assert.equal(h.info().objective, TEXT.objective.planterRh);
  h.clearLog();
  assert.ok(push(h, planterOf, L.PLANTER.half, [0, -1], (i) => i.biblioteca.damper, [[6.6, 1.2], [5.6, 1.95], [L.PLANTER.start.x, 2.12]], 14), 'o vaso no botão do chão abre o registro');
  assert.equal(h.log('duct:open').length, 1);
  as(h, 'radhija');
  const f = fanOf(h);
  // fica na frente do ventilador (pelo norte, ou contornando pelo leste), no vento, de frente para a grade do duto
  const r0 = h.ctrls.radhija;
  const around = r0.z > f.z - 0.2 ? [[f.x + 0.85, f.z + 0.6], [f.x + 0.8, f.z - 0.75]] : [[f.x + 0.6, f.z - 1.3]];
  h.walkPath([...around, [f.x + 0.12, f.z - 0.75, { tol: 0.06 }]], { tol: 0.1 });
  const rad = h.ctrls.radhija;
  assert.ok(Math.hypot(rad.x - f.x - 0.12, rad.z - f.z + 0.75) < 0.15, `a Radhija na frente do ventilador (${rad.x.toFixed(2)}, ${rad.z.toFixed(2)})`);
  h.hold([0, -1]);
  h.run(0.25);
  h.hold(null);
  h.run(0.1);
  h.clearLog();
  h.keyDown('KeyR');
  h.run(0.3);
  h.keyUp('KeyR');
  const woke = h.run(6, { until: (i) => i.biblioteca.cat !== 'asleep' });
  const why = JSON.stringify({ fan: fanOf(h), aligned: lib(h).aligned, damper: lib(h).damper, power: lib(h).power, fanOn: lib(h).fanOn, bafo: h.log('dog:bafo'), spawn: h.log('scent:spawn'), duct: h.log('scent:duct'), smell: h.log('scent:smell'), fade: h.log('scent:fade') });
  assert.ok(woke, `o cheiro foi pelo duto e acordou o Bichano ${why}`);
  assert.ok(h.log('scent:duct').length >= 1, 'entrou no duto');
  assert.ok(h.run(5, { until: (i) => i.biblioteca.book === 'floor' }), 'o livro caiu no chão do escritório');
  assert.ok(h.run(10, { until: (i) => i.biblioteca.cat === 'bed' }), 'o Bichano saiu pela portinha e foi para a almofada');
  assert.equal(h.info().stage, 'carrying');

  // PORTA: a Radhija perto do vão, a Rhaenyra abre, a Radhija segura (Fica) e a Rhaenyra traz o livro
  h.walkPath([[5.55, 0.25], [3.7, 0.25], [1.4, 0.35], [-0.9, 0.15], [-2.5, 0.1], [-4.05, 0.1]], { tol: 0.15 });
  as(h, 'rhaenyra');
  h.tap('KeyF');
  assert.equal(h.info().stay.radhija, true);
  wallJump(h, L.DOOR_HANDLE, [[-2.5, -0.1]]);
  assert.ok(h.run(1.2, { until: (i) => i.biblioteca.door.open }), 'a porta abriu');
  as(h, 'radhija');
  h.walkTo(-4.48, 0.03, { tol: 0.08 });
  as(h, 'rhaenyra');
  h.tap('KeyF');
  assert.equal(h.info().stay.radhija, true, 'a Radhija ficou no vão');
  h.run(4);
  assert.equal(lib(h).door.open, true, 'com a Radhija no vão, a porta espera');
  h.walkPath([[-4.0, 0.48], [-4.85, 0.48], [-5.6, -0.9], [L.BOOK_FALL.x + 0.25, L.BOOK_FALL.z + 0.3]], { tol: 0.12 });
  assert.equal(h.info().prompt, TEXT.prompt.book);
  h.tap('KeyE');
  assert.equal(h.info().book.holder, 'rhaenyra', 'pegou o livro');
  h.walkPath([[-5.6, -0.9], [-4.85, 0.48], [-4.0, 0.48], [-2.2, 0.2], [-0.9, 0.15], [L.GOAL.x - 0.4, L.GOAL.z + 0.5]], { tol: 0.15 });
  assert.ok(h.run(8, { until: (i) => i.state === 'victory' }), 'óculos e livro na mesinha: vitória');
  const vic = h.log('victory');
  assert.equal(vic.length, 1);
  assert.equal(vic[0].levelId, 'fase9');
  assert.equal(vic[0].hasNext, false, 'a 9 é a última por enquanto');
});

test('fase 9: E no pé da escada segura (e continua depois da troca); andando, ela solta', async () => {
  const h = await game();
  h.run(0.3);
  as(h, 'rhaenyra');
  wallJump(h, L.BRAKE_LEVER, [[-2.2, 0.2], [-0.9, 0.15], [1.4, 0.35], [3.6, -1.0]]);
  h.game.debug.puzzle.placeCrate('globo', L.GLOBE.minX);
  h.game.debug.puzzle.placeCrate('escadinha', L.LADDER.minX);
  h.run(0.1);
  const hold = { x: L.LADDER.minX + L.LADDER_HOLD.side, z: L.LADDER_HOLD.z };
  const toHold = () => {
    h.walkPath([[hold.x + 0.2, -1.9], [hold.x + 0.05, hold.z + 0.05]], { tol: 0.1 });
    h.hold(null);
    h.run(0.1);
  };
  toHold();
  h.tap('KeyE');
  assert.equal(lib(h).holding, true, 'segurou');
  assert.equal(lib(h).held, true);
  h.clearLog();
  h.hold([1, 0]);
  h.run(0.3);
  h.hold(null);
  assert.equal(lib(h).holding, false, 'andando, ela solta');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.letGo));
  toHold();
  h.tap('KeyE');
  h.tap('KeyQ');
  h.run(0.2);
  h.walkTo(1.2, -1.0, { tol: 0.2 }); // a Radhija vai longe: a Rhaenyra não a segue
  h.hold(null);
  assert.equal(lib(h).held, true, 'a escada continua segura');
  assert.equal(lib(h).holding, true);
  h.tap('KeyQ');
  h.run(0.2);
  assert.equal(lib(h).holding, true, 'de volta à Rhaenyra, ela segue segurando até andar');
  h.tap('KeyE');
  assert.equal(lib(h).holding, false, 'E de novo solta');
});

test('fase 9: se a Rhaenyra solta no meio da subida, a escada rola e a Radhija desce sem os óculos', async () => {
  const h = await game();
  h.run(0.3);
  as(h, 'rhaenyra');
  wallJump(h, L.BRAKE_LEVER, [[-2.2, 0.2], [-0.9, 0.15], [1.4, 0.35], [3.6, -1.0]]);
  h.game.debug.puzzle.placeCrate('globo', L.GLOBE.minX);
  h.game.debug.puzzle.placeCrate('escadinha', L.LADDER.minX);
  h.run(0.1);
  const hold = { x: L.LADDER.minX + L.LADDER_HOLD.side, z: L.LADDER_HOLD.z };
  h.walkPath([[hold.x + 0.2, -1.9], [hold.x + 0.05, hold.z + 0.05]], { tol: 0.1 });
  h.tap('KeyQ');
  h.tap('KeyF');
  assert.equal(lib(h).held, true, 'a Rhaenyra segura a escada');
  h.walkPath([[L.LADDER.minX + 0.1, -1.55], [L.LADDER.minX, -1.98]], { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.15);
  h.hold(null);
  h.run(0.1);
  h.tap('KeyE');
  assert.equal(lib(h).climb?.phase, 'up', 'começou a subir');
  h.run(0.5);
  h.tap('KeyF'); // a Rhaenyra deixa de ficar no meio da subida
  h.run(0.05);
  assert.equal(lib(h).climb?.phase, 'fall', 'sem apoio, a escada rola e ela desce');
  assert.ok(h.run(2, { until: (i) => !i.biblioteca.climb }), 'desceu');
  assert.equal(h.ctrls.radhija.y, 0);
  assert.equal(lib(h).glasses, 'shelf', 'os óculos continuam na estante');
  assert.ok(ladderOf(h).x > L.LADDER.minX + 0.1, 'a escada rolou para o leste');
});

test('fase 9: travada, a escada não anda; sem segurar, ela rola; a Rhaenyra não sobe', async () => {
  const h = await game();
  h.run(0.3);
  as(h, 'rhaenyra');
  // empurrando a escada travada: ela não sai do lugar e a dica explica o freio
  h.walkPath([[-2.2, 0.2], [-0.9, 0.15], [1.4, 0.35], [3.6, -1.0]], { tol: 0.15 });
  h.clearLog();
  push(h, ladderOf, L.LADDER.half, [-1, 0], () => false, [[4.0, -2.0]], 1.5);
  assert.ok(Math.abs(ladderOf(h).x - L.LADDER.start.x) < 1e-3, 'travada não anda');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.braked), 'dica do freio');
  // solta o freio, põe a escada debaixo dos óculos e tenta subir sem ninguém segurando
  wallJump(h, L.BRAKE_LEVER, [[3.6, -1.0]]);
  h.game.debug.puzzle.placeCrate('globo', L.GLOBE.minX);
  h.game.debug.puzzle.placeCrate('escadinha', L.LADDER.minX);
  h.run(0.1);
  assert.equal(lib(h).atGlasses, true);
  // a Rhaenyra na frente dos degraus: E só dá a dica
  h.walkPath([[L.LADDER.minX + 0.2, -1.5], [L.LADDER.minX, -1.98]], { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.15);
  h.hold(null);
  h.clearLog();
  h.tap('KeyE');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.climbRh), 'a Rhaenyra não sobe');
  // a Radhija sobe sem ninguém segurando: a escada rola e ela desce
  h.walkTo(L.LADDER.minX + 1.2, -1.5, { tol: 0.15 });
  as(h, 'radhija');
  h.walkPath([[L.LADDER.minX + 0.1, -1.55], [L.LADDER.minX, -1.98]], { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.15);
  h.hold(null);
  h.clearLog();
  h.tap('KeyE');
  assert.equal(h.log('ladder:slip').length, 1, 'sem segurar, começa a escorregar');
  assert.ok(h.run(3, { until: (i) => !i.biblioteca.climb }), 'voltou ao chão');
  assert.ok(ladderOf(h).x > L.LADDER.minX + 0.2, 'a escada rolou para o leste');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.roll), 'dica de segurar a escada');
  assert.equal(lib(h).glasses, 'shelf');
  assert.equal(h.ctrls.radhija.y, 0);
});

test('fase 9: sem energia o ventilador não liga; o botão do registro só abre com o vaso; registro fechado ou superbafo direto não adiantam', async () => {
  const h = await game();
  h.run(0.3);
  // sem energia: E no botão do ventilador só explica
  as(h, 'radhija');
  h.teleport('radhija', L.FAN.start.x, L.FAN.start.z + 0.5, Math.PI);
  h.run(0.2);
  h.clearLog();
  h.tap('KeyE');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.noPower), 'sem energia: dica do disjuntor');
  assert.equal(lib(h).fanOn, false);
  // o disjuntor (impulso) liga a energia
  as(h, 'rhaenyra');
  h.teleport('rhaenyra', L.BREAKER.x - 0.4, L.BREAKER.z + 1.1, Math.PI);
  h.run(0.2);
  wallJump(h, L.BREAKER);
  assert.equal(lib(h).power, true, 'energia ligada');
  // a Rhaenyra em cima do botão do registro: leve demais, não abre
  h.walkTo(L.DAMPER_PLATE.x, L.DAMPER_PLATE.z + 0.05, { tol: 0.1 });
  h.hold(null);
  h.clearLog();
  h.run(0.4);
  assert.equal(lib(h).damper, false, 'a Rhaenyra não pesa o bastante');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.plateLight), 'dica do vaso');
  // o vaso no botão abre; fora dele, fecha de novo
  h.walkTo(L.DAMPER_PLATE.x + 0.7, L.DAMPER_PLATE.z + 0.6, { tol: 0.15 });
  h.game.debug.puzzle.placeCrate('vaso', L.DAMPER_PLATE.x, L.DAMPER_PLATE.z);
  h.run(0.3);
  assert.equal(lib(h).damper, true, 'com o vaso em cima, o registro abre');
  h.game.debug.puzzle.placeCrate('vaso', L.PLANTER.start.x, 0);
  h.run(0.3);
  assert.equal(lib(h).damper, false, 'sem o vaso, fecha');
  as(h, 'radhija');
  // a Radhija sopra perto da grade de baixo sem o registro aberto
  h.teleport('radhija', L.DUCT.inlet.x, L.DUCT.inlet.z + 0.8, Math.PI);
  h.run(0.2);
  h.clearLog();
  h.keyDown('KeyR');
  h.run(0.3);
  h.keyUp('KeyR');
  assert.ok(h.run(3, { until: () => h.log('hint').some((x) => x.text === TEXT.hint.damperClosed) }), 'registro fechado: dica');
  assert.equal(lib(h).cat, 'asleep');
  // dentro do escritório (pela portinha a Radhija entra), soprando no armário: o cheiro não chega lá em cima
  h.teleport('radhija', L.WARDROBE.x + 0.2, L.WARDROBE.z + L.WARDROBE.hz + 0.45, Math.PI);
  h.run(1.5);
  h.clearLog();
  h.keyDown('KeyR');
  h.run(0.3);
  h.keyUp('KeyR');
  assert.ok(h.run(3, { until: () => h.log('hint').some((x) => x.text === TEXT.hint.catHigh) }), 'superbafo direto: dica da grade');
  assert.equal(lib(h).cat, 'asleep', 'o gato continua dormindo');
  h.tap('KeyE');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.catSleep), 'E perto do armário: o gato dorme lá em cima');
});

test('fase 9: a porta fecha sozinha; com o livro na boca não dá impulso; E larga e pega o livro', async () => {
  const h = await game();
  h.run(0.3);
  as(h, 'rhaenyra');
  wallJump(h, L.DOOR_HANDLE, [[-2.5, 0.3], [-3.0, -0.2]]);
  assert.ok(h.run(1.2, { until: (i) => i.biblioteca.door.open }), 'abriu');
  assert.ok(h.run(L.DOOR_HANDLE.holdTime + 2.5, { until: (i) => !i.biblioteca.door.open && i.biblioteca.door.t < 0.05 }), 'a mola fechou de novo');
  // com o livro (etapa 'book': o gato na almofada, o livro com a Rhaenyra no hall), dentro do escritório e a porta fechada
  assert.ok(h.game.debug.setStage('book', 'rhaenyra'));
  assert.equal(h.info().book.holder, 'rhaenyra');
  const k = kickSpot(L.DOOR_HANDLE_IN);
  h.clearLog();
  h.teleport('rhaenyra', k.x, k.z, Math.atan2(-L.DOOR_HANDLE_IN.nx, -L.DOOR_HANDLE_IN.nz));
  h.run(0.4);
  assert.notEqual(h.info().prompt, TEXT.prompt.wall, 'com o livro, sem o prompt do impulso');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.bookNoJump), 'dica: largue o livro');
  h.clearLog();
  h.tap('Space');
  h.run(D);
  assert.equal(h.log('dog:wallJump').length, 0, 'com o livro na boca não dá impulso');
  h.tap('KeyE');
  assert.equal(lib(h).book, 'floor', 'largou o livro');
  assert.equal(h.info().book.holder, null);
  // pega de novo (E perto) e larga de novo
  h.run(0.2);
  const b = lib(h).bookAt;
  h.walkTo(b.x + 0.2, b.z + 0.25, { tol: 0.1 });
  h.tap('KeyE');
  assert.equal(h.info().book.holder, 'rhaenyra', 'pegou de volta');
  // a Radhija (que entra pela portinha de gato) não carrega o livro
  h.tap('KeyE');
  const b2 = lib(h).bookAt;
  h.teleport('radhija', b2.x - 0.35, b2.z + 0.2, Math.atan2(0.35, -0.2));
  as(h, 'radhija');
  h.run(0.2);
  h.clearLog();
  h.tap('KeyE');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.bookHeavy), 'pesado para a Radhija');
});

test('fase 9: etapas ?stage=, pausa congela a porta, reinício e stage=done', async () => {
  const h = await game();
  h.run(0.3);
  for (const st of ['glasses', 'book', 'carrying']) {
    assert.ok(h.game.debug.setStage(st), st);
    assert.equal(h.info().stage, st);
  }
  assert.equal(h.info().glasses.holder, 'radhija');
  assert.equal(h.info().book.holder, 'rhaenyra');
  // pausa com a porta abrindo
  h.game.debug.setStage('start');
  as(h, 'rhaenyra');
  const k = kickSpot(L.DOOR_HANDLE);
  h.teleport('rhaenyra', k.x, k.z);
  h.ctrls.rhaenyra.yaw = Math.atan2(-L.DOOR_HANDLE.nx, -L.DOOR_HANDLE.nz);
  h.run(0.3);
  h.tap('Space');
  h.run(D + 0.4);
  h.tap('Escape');
  assert.equal(h.info().state, 'paused');
  const t = lib(h).door.t;
  h.run(3);
  assert.equal(lib(h).door.t, t, 'pausado, a porta não anda');
  h.events.emit('ui:resume', {});
  h.run(0.2);
  // reinício devolve tudo
  h.events.emit('ui:restart', {});
  h.run(0.2);
  const s = lib(h);
  assert.deepEqual([s.glasses, s.book, s.cat, s.braked, s.damper, s.door.t], ['shelf', 'wardrobe', 'asleep', true, false, 0]);
  assert.ok(Math.abs(s.ladder.x - L.LADDER.start.x) < 1e-3 && Math.abs(s.fan.x - L.FAN.start.x) < 1e-3);
  h.game.debug.setStage('done');
  assert.ok(h.run(8, { until: (st) => st.state === 'victory' }), 'stage=done termina a fase');
});
