// Fase 8 (Lavanderia de Domingo): o impulso na parede da Rhaenyra nos dois botões, a meia no varal (só o tranco
// da arrancada da Radhija solta), a mantinha da máquina para o cesto e o cesto até a caminha. Jogo headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { WALL_BUTTON_SHAPE } from '../src/game/mechanics/wallButton.js';
import { DOG_CONFIG } from '../src/dogs/config.js';
import { TEXT } from '../src/levels/fase8/puzzle.js';
import { LEVELS } from '../src/levels/index.js';
import fase8 from '../src/levels/fase8/index.js';

const L = fase8.layout;
const BK = L.BASKET;
const C = L.CATCH;
const SOCK = L.SOCK;
const BED = L.DOG_BED;
const BOARD = L.BOARD;
const LEVEL = LEVELS.indexOf(fase8) + 1;
const LAT = WALL_BUTTON_SHAPE.button.lat;
const D = DOG_CONFIG.rhaenyra.wallJumpTime;
const lav = (h) => h.info().lavanderia;
const game = (query = '') => createHeadlessGame({ level: LEVEL, query });

/**
 * A Rhaenyra empurra o cesto na direção dir (eixo X ou Z) até until(info). `via`: pontos de passagem até a face
 * de trás do cesto (para não esbarrar nele no caminho).
 */
function pushBasket(h, dir, until, via = [], timeout = 9) {
  for (const [x, z] of via) h.walkTo(x, z, { tol: 0.12 });
  const b = lav(h).basket;
  h.walkTo(b.x - dir[0] * (BK.half + 0.3), b.z - dir[1] * (BK.half + 0.3), { tol: 0.06 });
  h.hold(dir, ['ShiftLeft']);
  const ok = h.run(timeout, { until });
  h.hold(null);
  h.run(0.3);
  return ok;
}
/** A Rhaenyra vai até a frente das patinhas do botão `cfg`, fica de frente para a parede e dá o impulso. */
function wallJump(h, cfg, via = []) {
  for (const [x, z] of via) h.walkTo(x, z, { tol: 0.15 });
  h.walkTo(cfg.x - LAT, cfg.z + 0.6, { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.2);
  h.hold(null);
  h.run(0.15);
  assert.equal(h.info().prompt, TEXT.prompt.wall, 'prompt do impulso');
  h.tap('Space');
  h.run(D + 0.15);
}
/** Cesto do canto sudoeste até a frente da máquina: para o leste na fileira dele, depois para o norte. */
function basketToMachine(h) {
  assert.ok(pushBasket(h, [1, 0], (s) => s.lavanderia.basket.x >= C.x - 0.03, [[-4.6, 1.0]]), 'cesto para o leste');
  assert.ok(pushBasket(h, [0, -1], (s) => s.lavanderia.atCatch, [[C.x - 0.6, 2.15]]), 'cesto na frente da máquina');
}

test('fase 8: na campanha, depois da 7, com o cenário sob demanda e a meia como item', () => {
  assert.equal(LEVELS[LEVEL - 1].id, 'fase8');
  assert.equal(fase8.number, 8);
  assert.equal(fase8.item, 'sock');
  assert.equal(typeof fase8.load, 'function');
  assert.equal(L.COLLECTIBLES.length, 3, 'três ossinhos');
});

test('fase 8: partida completa (cesto → centrífuga → mantinha no cesto → caminha; varal → arrancada → meia → caminha)', async () => {
  const h = await game();
  const i = h.info();
  assert.equal(i.levelId, 'fase8');
  assert.equal(i.activeDog, 'radhija');
  assert.equal(i.objective, TEXT.objective.rackRad);
  assert.deepEqual([lav(h).sock, lav(h).blanket], ['rack', 'machine']);
  h.tap('KeyQ');
  h.tap('KeyF'); // a Radhija fica no canto dela, longe do caminho do cesto
  assert.equal(h.info().objective, TEXT.objective.toMachine);

  // MANTINHA: cesto na frente da máquina, impulso no botão de centrifugar, ela cai no cesto
  basketToMachine(h);
  assert.equal(h.info().objective, TEXT.objective.spin);
  h.clearLog();
  wallJump(h, L.SPIN_BUTTON, [[-0.7, -1.8]]);
  assert.equal(h.log('dog:wallJump').length, 1);
  assert.equal(h.log('wall:touch').length, 1);
  assert.equal(lav(h).spinning, true, 'centrifugando');
  assert.ok(h.run(2.5, { until: (s) => s.lavanderia.blanket === 'basket' }), 'a mantinha caiu no cesto');
  assert.equal(h.log('blanket:fall').length, 1);
  assert.equal(h.log('blanket:land').at(-1).inBasket, true);
  assert.equal(h.info().stage, 'basket');
  assert.equal(h.info().objective, TEXT.objective.pushHome);

  // cesto até a caminha: para o leste pela frente das máquinas, para o sul, e encosta na caminha
  assert.ok(pushBasket(h, [1, 0], (s) => s.lavanderia.basket.x >= 3.0, [[-1.0, -1.6], [C.x - 0.65, -1.6]]), 'cesto para o leste');
  assert.ok(pushBasket(h, [0, 1], (s) => s.lavanderia.basket.z >= BED.z - 0.05, [[2.43, -2.9]]), 'cesto para o sul');
  assert.ok(pushBasket(h, [1, 0], (s) => s.lavanderia.blanket === 'bed', [[2.3, 1.13]]), 'cesto encosta na caminha');
  assert.equal(h.log('bed:deliver').at(-1)?.item, 'blanket');
  const parked = lav(h).basket;
  assert.ok(Math.hypot(parked.x - BED.x, parked.z - BED.z) > BK.half + 0.35, 'o cesto estaciona ao lado, sem entrar na caminha');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.needSock));

  // MEIA: impulso no botão do varal, troca para a Radhija e arrancada até a meia
  assert.equal(h.info().objective, TEXT.objective.rackRh);
  wallJump(h, L.RACK_BUTTON, [[2.2, -1.9]]);
  assert.ok(h.run(1.2, { until: (s) => s.lavanderia.rackDown }), 'o varal desceu');
  h.tap('KeyQ');
  assert.equal(h.info().activeDog, 'radhija');
  assert.equal(h.info().objective, TEXT.objective.dashRad);
  h.walkTo(SOCK.x, SOCK.z + 1.05, { tol: 0.1 });
  h.hold([0, -1]);
  h.run(0.08);
  h.tap('ShiftLeft');
  assert.ok(h.run(0.8, { until: (s) => s.sock.holder === 'radhija' }), 'o tranco da arrancada soltou a meia');
  h.hold(null);
  assert.equal(h.log('sock:yank').length, 1);
  assert.equal(h.info().objective, TEXT.objective.carrySock);
  h.walkPath([[3.4, 0.6], [BED.x - 0.3, BED.z - 0.3]], { tol: 0.15 });
  assert.ok(h.run(8, { until: (s) => s.state === 'victory' }), 'meia e mantinha na caminha: vitória');
  const vic = h.log('victory');
  assert.equal(vic.length, 1);
  assert.equal(vic[0].levelId, 'fase8');
  assert.equal(vic[0].hasNext, true, 'depois da 8 vem a 9');
});

test('fase 8: andando, a Radhija só puxa a meia (dica); a Rhaenyra não solta; o varal sobe sozinho e dá para repetir', async () => {
  const h = await game();
  // a Radhija espera pertinho da meia; a Rhaenyra vai ao botão do varal
  h.walkTo(SOCK.x + 0.45, SOCK.z + 0.4, { tol: 0.1 });
  h.tap('KeyQ');
  h.tap('KeyF');
  wallJump(h, L.RACK_BUTTON);
  assert.ok(h.run(1.2, { until: (s) => s.lavanderia.rackDown }));
  // a Rhaenyra vai até a meia e tenta (E): o pregador segura
  h.walkTo(SOCK.x - 0.2, SOCK.z + 0.55, { tol: 0.1 });
  h.hold([0, -1]);
  h.run(0.1);
  h.hold(null);
  h.clearLog();
  h.tap('KeyE');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.clipRh), 'a Rhaenyra puxa, mas o pregador segura');
  assert.equal(lav(h).sock, 'rack');
  // a Radhija, ali do lado, só puxa andando
  h.tap('KeyQ');
  h.hold([-1, -1]);
  h.run(0.12);
  h.hold(null);
  h.run(1.1);
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.clip), 'parada perto da meia, a dica do tranco');
  h.tap('KeyE');
  assert.equal(lav(h).sock, 'rack');
  assert.equal(h.log('sock:yank').length, 0);
  // o tempo acaba: o varal sobe; com ele em cima, a meia está lá no alto
  assert.ok(h.run(7, { until: (s) => s.lavanderia.lower === 0 }), 'o varal subiu sozinho');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.rackUp));
  h.clearLog();
  h.tap('KeyE');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.high));
  assert.equal(h.info().objective, TEXT.objective.rackRad);
});

test('fase 8: sem o cesto, a mantinha cai no chão; o cesto encostado recolhe (E); a Radhija não leva na boca', async () => {
  const h = await game();
  h.tap('KeyQ');
  h.tap('KeyF');
  h.clearLog();
  wallJump(h, L.SPIN_BUTTON, [[-0.7, -1.8]]);
  assert.ok(h.run(2.5, { until: (s) => s.lavanderia.blanket === 'floor' }), 'caiu no chão');
  assert.equal(h.log('blanket:land').at(-1).inBasket, false);
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.floor));
  assert.equal(h.info().objective, TEXT.objective.loadFloor);
  // sem o cesto por perto: a Rhaenyra pede o cesto; a Radhija diz que é grande demais
  h.walkTo(C.x + 0.1, C.z + 0.6, { tol: 0.1 });
  h.hold([0, -1]);
  h.run(0.1);
  h.hold(null);
  h.tap('KeyE');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.needBasket));
  h.tap('KeyQ');
  h.walkTo(C.x - 0.35, C.z + 0.55, { tol: 0.1 });
  h.tap('KeyE');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.tooBig));
  assert.equal(lav(h).blanket, 'floor');
  // a Radhija sai do caminho do cesto e fica lá
  h.walkTo(-3.5, -0.5, { tol: 0.2 });
  h.tap('KeyQ');
  h.tap('KeyF');
  // o cesto até a mantinha e E: vai para o cesto
  basketToMachine(h);
  assert.equal(h.info().prompt, TEXT.prompt.load);
  h.tap('KeyE');
  assert.equal(lav(h).blanket, 'basket');
  assert.equal(h.log('blanket:load').length, 1);
});

test('fase 8: o cesto não passa pela tábua de passar (dica); só a Radhija passa por baixo e pega o ossinho de lá', async () => {
  const h = await game();
  // o ossinho debaixo da tábua: a Rhaenyra não alcança
  h.tap('KeyQ');
  h.tap('KeyF');
  h.walkTo(BOARD.x, BOARD.z + 0.62, { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.6);
  h.hold(null);
  assert.equal(h.info().collected, 0, 'a Rhaenyra não cabe debaixo da tábua');
  // o cesto empurrado para o norte contra a tábua para (dica)
  assert.ok(pushBasket(h, [1, 0], (s) => s.lavanderia.basket.x >= BOARD.x - 0.03, [[-4.6, 1.0]]), 'cesto até a linha da tábua');
  h.clearLog();
  pushBasket(h, [0, -1], (s) => s.lavanderia.basket.blockedBy === 'tabua', [[BOARD.x - 0.6, 2.15]], 4);
  assert.ok(lav(h).basket.z > BOARD.z + BOARD.hz + BK.half - 0.02, 'o cesto não atravessa a tábua');
  assert.ok(h.log('hint').some((x) => x.text === TEXT.hint.board));
  // a Radhija passa por baixo (pelo norte) e pega o ossinho
  h.tap('KeyQ');
  h.walkPath([[BOARD.x - 1.0, BOARD.z - 0.7], [BOARD.x, BOARD.z - 0.55], [BOARD.x, BOARD.z + 0.02]], { tol: 0.1 });
  assert.equal(h.info().collected, 1, 'a Radhija pegou o ossinho de debaixo da tábua');
});

test('fase 8: etapas por ?stage=, pausa congela o varal, reinício devolve tudo', async () => {
  const h = await game();
  for (const st of ['sock', 'basket', 'carrying']) {
    assert.ok(h.game.debug.setStage(st), st);
    assert.equal(h.info().stage, st);
  }
  let s = lav(h);
  assert.deepEqual([s.sock, s.blanket], ['carried', 'basket']);
  assert.equal(h.info().sock.holder, 'radhija');
  // pausa no meio do varal descendo
  h.game.debug.setStage('start');
  h.tap('KeyQ');
  h.tap('KeyF');
  h.walkTo(L.RACK_BUTTON.x - LAT, L.RACK_BUTTON.z + 0.6, { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.2);
  h.hold(null);
  h.tap('Space');
  h.run(0.75);
  h.tap('Escape');
  assert.equal(h.info().state, 'paused');
  const k = lav(h).lower;
  assert.ok(k > 0 && k < 1, `o varal está descendo (${k})`);
  h.run(2);
  assert.equal(lav(h).lower, k, 'pausado, o varal não anda');
  h.events.emit('ui:resume', {});
  h.run(1.5);
  assert.equal(lav(h).rackDown, true);
  // reiniciar no meio
  h.events.emit('ui:restart', {});
  h.step();
  s = lav(h);
  assert.deepEqual([s.sock, s.blanket, s.lower, s.rackDown, s.spinning], ['rack', 'machine', 0, false, false]);
  assert.ok(Math.abs(s.basket.x - BK.start.x) < 1e-6 && Math.abs(s.basket.z - BK.start.z) < 1e-6, 'cesto de volta ao canto');
  assert.equal(h.info().stage, 'start');
  // etapa final pronta: as duas na caminha, comemoração
  h.game.debug.setStage('done');
  assert.ok(h.run(8, { until: (st) => st.state === 'victory' }), 'stage=done termina a fase');
});
