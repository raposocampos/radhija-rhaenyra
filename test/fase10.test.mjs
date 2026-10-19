// Fase 10 (Festa no Quintal): o bolo de três andares e o enigma da ordem (o quadro da sala mostra laço embaixo,
// vela no meio e chapéu no topo); o chapeuzinho no barquinho (caixote fora da mangueira, torneira no alto da parede,
// a piscininha enchendo e o ventilador ligado pelo disjuntor da cozinha); o laço na casa na árvore (a Dona Gansa
// guardando a cordinha do portão, o superbafo pelo cano de brinquedo até o pombo, o elevador de balde com a Rhaenyra
// puxando a corda, o deque onde a Radhija anda livre, desamarra o laço e escolhe o escorregador ou o balde); a vela
// do 3 no galpão (a lama da horta, o Lambe-Lambe, a placa que segura a porta e fica com a Rhaenyra na troca, a rampa
// só com arrancada); e as regras de cada passo. Headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { WALL_BUTTON_SHAPE } from '../src/game/mechanics/wallButton.js';
import { DOG_CONFIG } from '../src/dogs/config.js';
import { TEXT } from '../src/levels/fase10/puzzle.js';
import { LEVELS } from '../src/levels/index.js';
import fase10 from '../src/levels/fase10/index.js';

const L = fase10.layout;
const LEVEL = LEVELS.indexOf(fase10) + 1;
const D = DOG_CONFIG.rhaenyra.wallJumpTime;
const q = (h) => h.info().quintal;
const game = (query = '') => createHeadlessGame({ level: LEVEL, query });
const puz = (h) => h.game.debug.puzzle;
const hints = (h) => h.log('hint').map((x) => x.text);
const NOUN = { hat: 'o chapeuzinho', ribbon: 'o laço', candle: 'a vela do 3' };
const fill = (s, item) => s.replace('{item}', NOUN[item]);
const GOAL_IN = { x: L.GOAL.x, z: L.GOAL.z + 1.0 };

/** Fica ativa a dog `name` (Q se precisar). */
function as(h, name) {
  if (h.info().activeDog !== name) h.tap('KeyQ');
  assert.equal(h.info().activeDog, name);
}
/** Onde ficar para o impulso no botão/alavanca `cfg` (de frente, com a dog um pouco à esquerda dele). */
function kickSpot(cfg) {
  const lat = WALL_BUTTON_SHAPE[cfg.kind].lat;
  return { x: cfg.x + cfg.nx * 0.6 + -cfg.nz * lat, z: cfg.z + cfg.nz * 0.6 + cfg.nx * lat };
}
/** A Rhaenyra (ativa) vai para a frente do botão `cfg`, de frente para a parede, e dá o impulso. */
function wallJump(h, cfg) {
  const k = kickSpot(cfg);
  h.teleport('rhaenyra', k.x, k.z, Math.atan2(-cfg.nx, -cfg.nz));
  h.run(0.3);
  assert.equal(h.info().prompt, TEXT.prompt.wall, 'prompt do impulso');
  h.tap('Space');
  h.run(D + 0.2);
}
/** Coloca a dog `name` em (x, z) olhando para o ângulo `yaw` e assenta um instante. */
function put(h, name, x, z, yaw) {
  h.teleport(name, x, z, yaw);
  h.run(0.15);
}
/** A dog ativa leva o que tem na boca até a mesa do bolo (entra no círculo da entrega pela frente da mesa). */
function toCake(h, from = { x: -1.0, z: -2.9 }) {
  const name = h.info().activeDog;
  put(h, name, from.x, from.z, Math.PI);
  h.walkTo(GOAL_IN.x, GOAL_IN.z, { tol: 0.12 });
}
/** A Radhija sopra o superbafo para a frente (segura R e solta). */
function bafo(h) {
  h.keyDown('KeyR');
  h.run(0.3);
  h.keyUp('KeyR');
}

test('fase 10: na campanha, a última, com o cenário sob demanda, chapéu como item e extras', () => {
  assert.equal(LEVELS[LEVEL - 1].id, 'fase10');
  assert.equal(LEVEL, LEVELS.length, 'a fase 10 fecha a campanha');
  assert.equal(fase10.number, 10);
  assert.equal(fase10.item, 'hat');
  assert.equal(fase10.ambience, 'dusk');
  assert.equal(typeof fase10.load, 'function');
  assert.equal(L.COLLECTIBLES.length, 3);
  assert.ok(fase10.extras.length >= 1);
  assert.deepEqual([...L.CAKE_ORDER], ['ribbon', 'candle', 'hat'], 'a ordem do quadro: laço, vela e chapéu');
});

test('fase 10: partida completa (chapéu fora de ordem, o quadro, e o bolo na ordem certa)', async () => {
  const h = await game();
  h.run(0.3);
  let s = q(h);
  assert.deepEqual([s.stage, s.water, s.power, s.gateOpen, s.pigeon, s.crateOnHose], ['start', 0, false, false, 'asleep', true]);
  assert.equal(h.info().objective, TEXT.objective.crateRad);

  // ---- CHAPÉU: caixote fora da mangueira, torneira, piscininha enchendo, disjuntor e o vento até a borda
  as(h, 'rhaenyra');
  put(h, 'radhija', -5.0, 1.6, 0);
  h.tap('KeyF'); // a Radhija espera longe do caixote
  put(h, 'rhaenyra', L.CRATE.start.x, L.CRATE.start.z - 1.15, 0);
  h.walkTo(L.CRATE.start.x, L.CRATE.start.z - (L.CRATE.half + 0.3), { tol: 0.07 });
  h.hold([0, 1], ['ShiftLeft']);
  assert.ok(h.run(6, { until: (i) => !i.quintal.crateOnHose && i.quintal.crate.z > 0.0 }), 'caixote empurrado para fora da mangueira');
  h.hold(null);
  h.run(0.3);
  assert.equal(q(h).flowing, false, 'sem a torneira aberta, nada corre');
  wallJump(h, L.TAP);
  assert.equal(q(h).tap, true, 'o impulso abriu a torneira');
  assert.equal(q(h).flowing, true, 'a água corre pela mangueira');
  assert.ok(h.log('water:start').length >= 1);
  assert.ok(h.run(9, { until: (i) => i.quintal.full }), 'a piscininha encheu');
  assert.equal(q(h).boat.docked, false, 'sem energia o barquinho fica no meio');
  wallJump(h, L.BREAKER);
  assert.equal(q(h).power, true, 'o disjuntor ligou a energia da festa');
  assert.ok(h.log('power:on').length === 1);
  assert.ok(h.run(5, { until: (i) => i.quintal.boat.docked }), 'o vento levou o barquinho até a borda');
  as(h, 'radhija');
  put(h, 'radhija', L.BOAT.dock.x + 0.65, L.BOAT.dock.z, -Math.PI / 2);
  assert.equal(h.info().prompt, TEXT.prompt.hat, 'prompt do chapeuzinho');
  h.tap('KeyE');
  assert.equal(h.info().hat.holder, 'radhija', 'pegou o chapeuzinho');
  assert.equal(h.info().objective, fill(TEXT.objective.carryCheck, 'hat'), 'o objetivo lembra do quadro, sem dar a ordem');

  // ---- o chapéu primeiro: fora de ordem, ele balança e cai ao lado da mesa
  h.clearLog();
  toCake(h);
  assert.equal(h.log('cake:wrong').length, 1, 'fora de ordem');
  s = q(h);
  assert.equal(s.wrong, 1);
  assert.deepEqual(s.cake, []);
  assert.equal(s.place.hat, 'floor');
  assert.equal(h.info().hat.holder, null);
  assert.ok(hints(h).includes(TEXT.hint.wrongOrder));
  assert.ok(h.run(2, { until: () => h.log('cake:fall').length === 1 }), 'o chapéu caiu na grama');
  assert.equal(h.info().objective, TEXT.objective.lookPainting, 'o objetivo manda olhar o quadro');

  // ---- o quadro da sala
  put(h, 'radhija', L.PAINTING.x, L.PAINTING.z + 0.95, Math.PI);
  assert.equal(h.info().prompt, TEXT.prompt.painting);
  h.clearLog();
  h.tap('KeyE');
  assert.equal(q(h).lookedPainting, true, 'olhou o quadro de perto');
  assert.equal(h.log('painting:look').length, 1);
  assert.equal(h.info().objective, TEXT.objective.gateLure, 'agora o laço: a gansa guarda o portão');

  // ---- LAÇO: latido de longe atrai a gansa; a cordinha abre o portão
  put(h, 'radhija', 1.8, 1.4, Math.PI / 2);
  h.clearLog();
  h.tap('KeyE'); // nada para interagir aqui: ela late
  assert.ok(h.log('goose:lured').length >= 1, 'o latido atraiu a gansa');
  h.walkPath([[2.8, -1.6], [4.5, -1.2], [L.CORD.x - 0.43, L.CORD.z - 0.06, { tol: 0.06 }]], { tol: 0.12 });
  h.hold([1, 0]);
  h.run(0.08);
  h.hold(null);
  h.run(0.1);
  assert.equal(h.info().prompt, TEXT.prompt.cord, 'prompt da cordinha');
  h.tap('KeyE');
  assert.ok(h.run(1, { until: (i) => i.quintal.gateOpen }), 'a cordinha destravou o portãozinho');
  assert.equal(h.log('gate:open').length, 1);
  h.run(0.6); // termina de puxar (enquanto puxa, ela fica presa na cordinha)

  // ---- o pombo: superbafo no funil do cano de brinquedo
  put(h, 'radhija', L.TUBE.inlet.x, L.TUBE.inlet.z + 0.85, Math.PI);
  h.clearLog();
  bafo(h);
  assert.ok(h.run(5, { until: (i) => i.quintal.pigeon !== 'asleep' }), `o cheiro subiu pelo cano e o pombo voou ${JSON.stringify({ spawn: h.log('scent:spawn'), duct: h.log('scent:duct'), smell: h.log('scent:smell') })}`);
  assert.ok(h.log('scent:duct').length >= 1, 'entrou no cano');
  assert.equal(h.log('pigeon:flee').length, 1);

  // ---- o balde: a Radhija entra, a Rhaenyra puxa a corda e ela sobe até o deque
  put(h, 'radhija', L.BUCKET.x, L.BUCKET.z + 0.7, Math.PI);
  assert.equal(h.info().prompt, TEXT.prompt.bucket);
  h.tap('KeyE');
  assert.ok(h.run(1.6, { until: (i) => i.quintal.bucket.riding }), 'a Radhija pulou para dentro do balde');
  as(h, 'rhaenyra'); // a troca vale com ela no balde
  put(h, 'rhaenyra', L.ROPE.rest.x, L.ROPE.rest.z + 0.5, Math.PI);
  assert.equal(h.info().prompt, TEXT.prompt.rope);
  h.tap('KeyE');
  assert.equal(q(h).rope.holder, 'rhaenyra', 'a Rhaenyra pegou a corda');
  h.walkTo(L.ROPE.ring.x, L.ROPE.ring.z + 3.2, { tol: 0.1, timeout: 10, until: (i) => i.quintal.onDeck });
  assert.ok(h.run(1.5, { until: (i) => i.quintal.onDeck }), `o balde chegou lá em cima e ela pulou para o deque ${JSON.stringify(q(h).bucket)}`);
  assert.equal(h.ctrls.radhija.y, L.DECK.h, 'no alto do deque');
  // ---- lá em cima quem anda é o jogador: o corrimão segura, E desamarra o laço, E escorrega
  as(h, 'radhija');
  h.hold([0, 1]);
  h.run(0.8);
  h.hold(null);
  assert.ok(h.ctrls.radhija.z < L.DECK.z1 - 0.15 && h.ctrls.radhija.y === L.DECK.h, 'o corrimão da frente segura');
  assert.equal(h.info().objective, TEXT.objective.untieRad);
  h.walkTo(L.DECK_PATH.ribbon.x, L.DECK_PATH.ribbon.z, { tol: 0.1 });
  assert.equal(h.info().prompt, TEXT.prompt.untie, 'prompt do laço');
  h.tap('KeyE');
  assert.ok(h.run(1.5, { until: (i) => i.ribbon.holder === 'radhija' && i.quintal.deck === 'free' }), 'desamarrou o laço e continua no deque');
  assert.equal(h.info().objective, TEXT.objective.slideRad, 'com o laço, o objetivo é descer');
  h.walkTo(L.DECK_PATH.slideTop.x, L.DECK_PATH.slideTop.z, { tol: 0.1 });
  assert.equal(h.info().prompt, TEXT.prompt.slide, 'prompt do escorregador');
  h.tap('KeyE');
  assert.ok(h.run(3, { until: (i) => !i.quintal.deck && !i.quintal.onDeck }), 'desceu pelo escorregador');
  assert.equal(h.ctrls.radhija.y, 0, 'de volta ao chão');
  assert.equal(h.info().ribbon.holder, 'radhija', 'com o laço na boca');
  assert.ok(h.log('slide:down').length >= 1);
  as(h, 'rhaenyra');
  h.run(0.1);
  assert.equal(h.info().prompt, TEXT.prompt.ropeDrop);
  h.tap('KeyE');
  assert.equal(q(h).rope.holder, null, 'soltou a corda');

  // ---- o laço no andar de baixo
  as(h, 'radhija');
  h.clearLog();
  toCake(h);
  assert.equal(h.log('cake:place').length, 1, 'laço no andar de baixo');
  assert.deepEqual(q(h).cake, ['ribbon']);
  assert.equal(h.info().stage, 'cake1');

  // ---- VELA: a Radhija pelo vão da horta, cai na lama; a Rhaenyra pula a cerca e lambe
  put(h, 'radhija', L.HORTA.x0 - 0.5, (L.HORTA.gap.z0 + L.HORTA.gap.z1) / 2, Math.PI / 2);
  h.walkPath([[L.HORTA.x0 + 0.45, 1.55], [8.1, 1.85]], { tol: 0.12 });
  assert.ok(q(h).mud.k > 0, 'enlameada');
  assert.equal(q(h).inHorta.radhija, true);
  as(h, 'rhaenyra');
  h.tap('KeyF'); // a Radhija espera
  put(h, 'rhaenyra', 8.95, L.HORTA.z0 - 0.42, 0);
  h.hold([0, 1]);
  h.tap('Space');
  h.run(0.55);
  h.hold(null);
  h.run(0.2);
  assert.equal(q(h).inHorta.rhaenyra, true, 'a Rhaenyra pulou a cerca baixa');
  h.keyDown('KeyR');
  const clean = h.run(6, { until: (i) => i.quintal.mud.k === 0 });
  h.keyUp('KeyR');
  assert.ok(clean, `o Lambe-Lambe limpou a Radhija ${JSON.stringify(q(h).mud)}`);
  h.walkTo(L.PLATE.x, L.PLATE.z, { tol: 0.08 });
  assert.ok(h.run(1.5, { until: (i) => i.quintal.doorOpen }), 'com a Rhaenyra na placa, a porta do galpão subiu');
  as(h, 'radhija');
  assert.equal(h.info().stay.rhaenyra, true, 'trocando, a Rhaenyra fica na placa');
  h.run(0.5);
  assert.equal(q(h).doorOpen, true, 'a porta continua aberta');

  // ---- a rampa: arrancada e a vela lá no alto
  h.walkPath([[9.0, 2.0], [9.9, 2.0], [9.8, L.RAMP.z - 0.05, { tol: 0.08 }]], { tol: 0.12 });
  put(h, 'radhija', h.ctrls.radhija.x, h.ctrls.radhija.z, Math.PI / 2); // de frente para a rampa, parada
  h.tap('ShiftLeft');
  assert.ok(h.run(4, { until: (i) => i.candle.holder === 'radhija' && !i.quintal.ramp }), `subiu a rampa e pegou a vela ${JSON.stringify({ ramp: q(h).ramp, x: h.ctrls.radhija.x, z: h.ctrls.radhija.z })}`);
  assert.equal(h.ctrls.radhija.y, 0);

  // ---- a vela no meio e o chapéu no topo
  h.clearLog();
  toCake(h);
  assert.deepEqual(q(h).cake, ['ribbon', 'candle'], 'vela no andar do meio');
  assert.equal(h.info().stage, 'cake2');
  const hat = q(h).floor.hat;
  h.walkTo(hat.x, hat.z + 0.32, { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.08);
  h.hold(null);
  h.run(0.1);
  assert.equal(h.info().prompt, TEXT.prompt.pick);
  h.tap('KeyE');
  assert.equal(h.info().hat.holder, 'radhija', 'pegou o chapéu do chão');
  h.walkTo(GOAL_IN.x, GOAL_IN.z, { tol: 0.12 });
  assert.ok(h.run(10, { until: (i) => i.state === 'victory' }), 'o bolo pronto: vitória');
  assert.equal(h.log('cake:lit').length, 1, 'a vela acendeu');
  const vic = h.log('victory');
  assert.equal(vic.length, 1);
  assert.equal(vic[0].levelId, 'fase10');
  assert.equal(vic[0].hasNext, false, 'a 10 é a última');
});

test('fase 10: a mangueira esmagada não deixa a água passar; sem energia o barquinho fica no meio', async () => {
  const h = await game();
  h.run(0.3);
  as(h, 'rhaenyra');
  put(h, 'radhija', -5.0, 1.6, 0);
  h.tap('KeyF');
  wallJump(h, L.TAP);
  assert.equal(q(h).tap, true);
  h.run(2);
  assert.equal(q(h).flowing, false, 'caixote em cima da mangueira: a água não passa');
  assert.equal(q(h).water, 0);
  assert.equal(h.props.pool.blocked, true, 'a mangueira incha (esmagada)');
  puz(h).placeCrate('caixote', L.CRATE.start.x, 0.1);
  h.run(0.2);
  assert.equal(q(h).flowing, true, 'sem o caixote, a água corre');
  assert.ok(h.run(9, { until: (i) => i.quintal.full }), 'encheu');
  h.run(2);
  assert.ok(Math.abs(q(h).boat.x - L.BOAT.start.x) < 1e-6 && !q(h).boat.docked, 'sem energia, o barquinho não sai do meio');
  puz(h).placeCrate('caixote', L.CRATE.start.x, L.CRATE.start.z);
  h.run(0.2);
  assert.equal(q(h).flowing, false, 'cheia, a água para');
  puz(h).debugSet('power');
  assert.ok(h.run(5, { until: (i) => i.quintal.boat.docked }), 'com energia, o vento leva o barquinho');
});

test('fase 10: a gansa guarda a cordinha; latido de longe distrai; com o portão aberto ela só passeia', async () => {
  const h = await game();
  h.run(0.3);
  // direto na cordinha: a gansa não deixa (e avança)
  put(h, 'radhija', L.CORD.x - 0.43, L.CORD.z - 0.06, Math.PI / 2);
  h.clearLog();
  h.tap('KeyE');
  h.run(0.5);
  assert.equal(q(h).gateOpen, false, 'com a gansa de guarda, a cordinha não abre');
  assert.ok(hints(h).includes(TEXT.hint.gooseGuard), 'dica da gansa de guarda');
  assert.ok(h.run(3, { until: (i) => i.quintal.goose.hits >= 1 }), 'a gansa avançou');
  // de longe: latido, e a outra vai até a cordinha
  put(h, 'radhija', 1.8, 1.4, Math.PI / 2);
  h.run(2.5);
  h.clearLog();
  h.tap('KeyE');
  assert.ok(h.log('goose:lured').length >= 1, 'latido atraiu');
  h.walkPath([[2.8, -1.6], [4.5, -1.2], [L.CORD.x - 0.43, L.CORD.z - 0.06, { tol: 0.06 }]], { tol: 0.12 });
  h.hold([1, 0]);
  h.run(0.08);
  h.hold(null);
  h.run(0.1);
  h.tap('KeyE');
  assert.ok(h.run(1, { until: (i) => i.quintal.gateOpen }), 'abriu');
  // depois do portão aberto, chegar perto da gansa não dá investida
  const hits = q(h).goose.hits;
  const g = q(h).goose;
  put(h, 'radhija', g.x + 0.8, g.z, -Math.PI / 2);
  h.run(3);
  assert.equal(q(h).goose.hits, hits, 'com o portão aberto, a gansa não avança mais');
});

test('fase 10: o pombo não sai com latido nem com superbafo direto; pelo cano, voa', async () => {
  const h = await game();
  h.run(0.3);
  puz(h).debugSet('gate');
  put(h, 'radhija', L.PIGEON.x + 0.2, L.PIGEON.z + 0.55, Math.PI);
  assert.equal(q(h).sawPigeon, true, 'no fundo do quintal, a câmera mostra o pombo dormindo em cima do laço');
  assert.ok(hints(h).includes(TEXT.hint.pigeonSeen));
  h.clearLog();
  h.tap('KeyE');
  assert.ok(hints(h).includes(TEXT.hint.pigeonBark), 'latido não adianta');
  h.run(0.6);
  h.clearLog();
  bafo(h);
  h.run(3);
  assert.equal(q(h).pigeon, 'asleep', 'superbafo de baixo não chega lá em cima');
  assert.ok(hints(h).includes(TEXT.hint.pigeonHigh), 'dica do cano');
  put(h, 'radhija', L.TUBE.inlet.x, L.TUBE.inlet.z + 0.85, Math.PI);
  h.run(0.8);
  bafo(h);
  assert.ok(h.run(5, { until: (i) => i.quintal.pigeon !== 'asleep' }), 'pelo cano, o pombo voa');
  assert.ok(h.props.tube.calls.some(([name, list]) => name === 'setPuffs' && list.length > 0), 'a baforada aparece subindo pelo cano');
  assert.ok(h.run(4, { until: (i) => i.quintal.pigeon === 'gone' }), 'e vai embora');
});

test('fase 10: o balde (só a Radhija entra, só a Rhaenyra puxa, solto desce; com o pombo lá em cima, ela volta)', async () => {
  const h = await game();
  h.run(0.3);
  puz(h).debugSet('gate');
  as(h, 'rhaenyra');
  put(h, 'radhija', 7.0, -1.0, 0);
  h.tap('KeyF');
  put(h, 'rhaenyra', L.BUCKET.x, L.BUCKET.z + 0.72, Math.PI);
  h.clearLog();
  h.tap('KeyE');
  h.run(0.5);
  assert.equal(q(h).bucket.riding, false, 'a Rhaenyra não entra no balde');
  assert.ok(hints(h).includes(TEXT.hint.bucketHeavy));
  as(h, 'radhija');
  put(h, 'radhija', L.ROPE.rest.x, L.ROPE.rest.z + 0.45, Math.PI);
  h.clearLog();
  h.tap('KeyE');
  assert.equal(q(h).rope.holder, null, 'a Radhija não puxa a corda');
  assert.ok(hints(h).includes(TEXT.hint.ropeLight));
  put(h, 'radhija', L.BUCKET.x, L.BUCKET.z + 0.7, Math.PI);
  h.tap('KeyE');
  assert.ok(h.run(1.6, { until: (i) => i.quintal.bucket.riding }), 'no balde');
  as(h, 'rhaenyra');
  put(h, 'rhaenyra', L.ROPE.rest.x, L.ROPE.rest.z + 0.5, Math.PI);
  h.tap('KeyE');
  assert.equal(q(h).rope.holder, 'rhaenyra');
  h.walkTo(L.ROPE.ring.x, L.ROPE.ring.z + 1.6, { tol: 0.08 });
  const y = q(h).bucket.y;
  assert.ok(y > 0.6 && y < 1.6, `o balde subiu até a metade (${y})`);
  // trocando, ela continua segurando
  as(h, 'radhija');
  h.run(1);
  assert.equal(q(h).rope.holder, 'rhaenyra', 'a Rhaenyra segura a corda depois da troca');
  assert.ok(Math.abs(q(h).bucket.y - y) < 0.05, 'e o balde fica onde estava');
  as(h, 'rhaenyra');
  h.tap('KeyE');
  assert.equal(q(h).rope.holder, null, 'soltou');
  assert.ok(h.run(3, { until: (i) => i.quintal.bucket.y === 0 }), 'solto, o balde desce');
  assert.equal(q(h).bucket.riding, true, 'com a Radhija dentro');
  // com o pombo lá em cima: o balde chega, o pombo acorda, bate as asas e ela não sai do balde
  h.walkTo(L.ROPE.rest.x, L.ROPE.rest.z + 0.5, { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.08);
  h.hold(null);
  h.run(0.1);
  h.tap('KeyE');
  assert.equal(q(h).rope.holder, 'rhaenyra');
  h.clearLog();
  h.walkTo(L.ROPE.ring.x, L.ROPE.ring.z + 3.2, { tol: 0.1, timeout: 10, until: (i) => i.quintal.bucket.y >= L.BUCKET.top - 0.02 });
  h.run(1.5);
  assert.equal(h.log('pigeon:peck').length, 1, 'o pombo acordou e bateu as asas');
  assert.ok(hints(h).includes(TEXT.hint.pigeonDeck));
  assert.equal(q(h).bucket.riding, true, 'ela ficou no balde');
  assert.equal(q(h).onDeck, false, 'sem pular para o deque');
  assert.equal(h.info().ribbon.holder, null, 'sem o laço');
});

test('fase 10: no deque a Radhija anda livre (tronco e casinha seguram) e escolhe voltar para o balde ou escorregar', async () => {
  const h = await game();
  h.run(0.3);
  puz(h).debugSet('gate');
  puz(h).debugSet('pigeon');
  put(h, 'radhija', L.BUCKET.x, L.BUCKET.z + 0.7, Math.PI);
  h.tap('KeyE');
  assert.ok(h.run(1.6, { until: (i) => i.quintal.bucket.riding }), 'no balde');
  as(h, 'rhaenyra');
  put(h, 'rhaenyra', L.ROPE.rest.x, L.ROPE.rest.z + 0.5, Math.PI);
  h.tap('KeyE');
  h.clearLog();
  h.walkTo(L.ROPE.ring.x, L.ROPE.ring.z + 3.2, { tol: 0.1, timeout: 10, until: (i) => i.quintal.onDeck });
  assert.ok(h.run(1.5, { until: (i) => i.quintal.onDeck }), 'pulou para o deque');
  assert.ok(hints(h).includes(TEXT.hint.deckArrive), 'dica de chegada no deque');
  assert.equal(h.info().objective, TEXT.objective.upRh, 'a Rhaenyra ativa: trocar para a Radhija');
  // como companheira lá em cima, ela espera (não segue a irmã)
  const rad = h.ctrls.radhija;
  const w = { x: rad.x, z: rad.z };
  h.run(1);
  assert.ok(Math.hypot(rad.x - w.x, rad.z - w.z) < 1e-3 && rad.y === L.DECK.h, 'espera no deque');
  as(h, 'radhija');
  // o tronco segura
  h.walkTo(L.TREE.x, L.TREE.z, { tol: 0.05, timeout: 2 });
  assert.ok(Math.hypot(rad.x - L.TREE.x, rad.z - L.TREE.z) >= L.TREE.r + rad.r - 0.03, `não atravessa o tronco (${rad.x.toFixed(2)}, ${rad.z.toFixed(2)})`);
  assert.equal(rad.y, L.DECK.h);
  // a casinha segura
  h.walkTo(L.DECK_PATH.slideTop.x, L.DECK_PATH.slideTop.z, { tol: 0.1 });
  h.walkTo((L.HUT.x0 + L.HUT.x1) / 2, L.HUT.z0 + 0.2, { tol: 0.05, timeout: 2 });
  assert.ok(rad.z >= L.HUT.z1 + rad.r - 0.03 || rad.x <= L.HUT.x0 - rad.r + 0.03, `não entra na casinha (${rad.x.toFixed(2)}, ${rad.z.toFixed(2)})`);
  // o corrimão do oeste segura
  h.walkTo(L.DECK_PATH.arrive.x, L.DECK_PATH.arrive.z, { tol: 0.08 });
  h.hold([-1, 0]);
  h.run(1);
  h.hold(null);
  assert.ok(rad.x > L.DECK.x0 + 0.15 && rad.x < L.DECK.x0 + 0.3 && rad.y === L.DECK.h, `o corrimão do oeste segura (${rad.x.toFixed(2)})`);
  // de volta para o balde (lá em cima, com a Rhaenyra segurando a corda)
  h.walkTo(L.DECK_PATH.arrive.x, L.DECK_PATH.arrive.z, { tol: 0.08 });
  assert.equal(h.info().prompt, TEXT.prompt.bucketBack);
  h.tap('KeyE');
  assert.ok(h.run(1, { until: (i) => i.quintal.bucket.riding && !i.quintal.onDeck }), 'voltou para o balde');
  h.run(1);
  assert.equal(q(h).onDeck, false, 'não pula de novo para o deque sozinha');
  // a Rhaenyra solta: o balde desce com ela; E e ela sai
  as(h, 'rhaenyra');
  h.tap('KeyE');
  assert.ok(h.run(5, { until: (i) => i.quintal.bucket.y === 0 && i.quintal.rope.pulled === 0 }), 'o balde desceu e deitou');
  as(h, 'radhija');
  h.tap('KeyE');
  // o pulinho para fora termina no chão
  assert.ok(h.run(1.5, { until: (i) => !i.quintal.bucket.riding && i.dogs.radhija.y === 0 }), 'saiu do balde');
  assert.equal(rad.y, 0);
  assert.equal(h.info().ribbon.holder, null, 'o laço ficou lá em cima');
  assert.equal(q(h).place.ribbon, 'home');
});

test('fase 10: lama sem arrancada; placa só com a Rhaenyra (e ela fica na troca); a rampa só com arrancada', async () => {
  const h = await game();
  h.run(0.3);
  puz(h).debugSet('gate');
  // a Radhija é leve demais para a placa
  put(h, 'radhija', L.PLATE.x, L.PLATE.z, 0);
  h.run(0.3);
  assert.equal(q(h).plate, false, 'a Radhija não aperta a placa');
  assert.equal(q(h).doorOpen, false);
  // enlameada: sem arrancada
  puz(h).debugSet('clean', false);
  h.clearLog();
  h.hold([1, 0]);
  h.tap('ShiftLeft');
  h.hold(null);
  h.run(0.2);
  assert.ok(h.log('dog:dashBlocked').length >= 1, 'enlameada, a arrancada não sai');
  assert.ok(hints(h).includes(TEXT.hint.noDash));
  // a Rhaenyra na placa abre a porta; trocando, ela fica
  as(h, 'rhaenyra');
  put(h, 'rhaenyra', L.PLATE.x, L.PLATE.z, 0);
  assert.ok(h.run(1.5, { until: (i) => i.quintal.doorOpen }), 'a porta subiu');
  as(h, 'radhija');
  assert.equal(h.info().stay.rhaenyra, true, 'a Rhaenyra fica na placa');
  // enlameada, a Radhija escorrega na tábua
  put(h, 'radhija', 9.9, 2.0, Math.PI / 2);
  h.walkTo(9.8, L.RAMP.z - 0.05, { tol: 0.08 });
  h.clearLog();
  h.hold([1, 0]);
  const slipped = h.run(2, { until: () => h.log('slide:slip').length > 0 });
  h.hold(null);
  assert.ok(slipped, 'andando na tábua, ela escorrega');
  assert.ok(h.run(3, { until: (i) => !i.quintal.ramp }));
  assert.ok(hints(h).includes(TEXT.hint.rampMud), 'dica da lama');
  // com a Radhija lá dentro, a porta não desce nem com a Rhaenyra fora da placa
  as(h, 'rhaenyra');
  h.walkTo(8.3, 1.9, { tol: 0.1 });
  h.run(1.5);
  assert.equal(q(h).plate, false);
  assert.equal(q(h).doorOpen, true, 'com alguém no galpão, a porta fica aberta');
  // limpinha, andando ainda escorrega; com arrancada sobe e pega a vela
  as(h, 'radhija');
  puz(h).debugSet('clean');
  h.walkTo(9.8, L.RAMP.z - 0.05, { tol: 0.08 });
  h.clearLog();
  h.hold([1, 0]);
  assert.ok(h.run(2, { until: () => h.log('slide:slip').length > 0 }), 'sem arrancada, escorrega');
  h.hold(null);
  assert.ok(h.run(3, { until: (i) => !i.quintal.ramp }));
  assert.ok(hints(h).includes(TEXT.hint.rampSlip));
  h.run(1);
  h.walkTo(9.8, L.RAMP.z - 0.05, { tol: 0.08 });
  put(h, 'radhija', h.ctrls.radhija.x, h.ctrls.radhija.z, Math.PI / 2);
  h.tap('ShiftLeft');
  assert.ok(h.run(4, { until: (i) => i.candle.holder === 'radhija' && !i.quintal.ramp }), 'com arrancada, pegou a vela');
});

test('fase 10: fora de ordem duas vezes, a dica muda; o quadro de perto; o enfeite volta do chão', async () => {
  const h = await game();
  h.run(0.3);
  puz(h).debugSet('water');
  puz(h).debugSet('power');
  assert.ok(h.run(5, { until: (i) => i.quintal.boat.docked }));
  put(h, 'radhija', L.BOAT.dock.x + 0.65, L.BOAT.dock.z, -Math.PI / 2);
  h.tap('KeyE');
  assert.equal(h.info().hat.holder, 'radhija');
  toCake(h);
  assert.equal(q(h).wrong, 1);
  h.run(1.4);
  const hat = q(h).floor.hat;
  h.walkTo(hat.x, hat.z + 0.32, { tol: 0.08 });
  h.hold([0, -1]);
  h.run(0.08);
  h.hold(null);
  h.run(0.1);
  h.tap('KeyE');
  assert.equal(h.info().hat.holder, 'radhija', 'o chapéu volta do chão');
  h.clearLog();
  h.walkTo(GOAL_IN.x, GOAL_IN.z, { tol: 0.12 });
  assert.equal(q(h).wrong, 2, 'de novo fora de ordem');
  assert.ok(hints(h).includes(TEXT.hint.wrongOrder2), 'a segunda dica manda olhar o quadro de perto');
  assert.equal(h.info().objective, TEXT.objective.lookPainting);
  put(h, 'radhija', L.PAINTING.x, L.PAINTING.z + 0.95, Math.PI);
  h.tap('KeyE');
  assert.equal(q(h).lookedPainting, true);
  assert.notEqual(h.info().objective, TEXT.objective.lookPainting, 'depois do quadro, o objetivo volta aos enfeites');
});

test('fase 10: etapas ?stage=, pausa congela a água, reinício e stage=done', async () => {
  const h = await game();
  h.run(0.3);
  for (const [st, cake] of [['cake1', ['ribbon']], ['cake2', ['ribbon', 'candle']]]) {
    assert.ok(h.game.debug.setStage(st), st);
    assert.equal(h.info().stage, st);
    assert.deepEqual(q(h).cake, cake);
  }
  assert.deepEqual(h.props.cake.placed, ['ribbon', 'candle']);
  // pausa com a água correndo
  h.game.debug.setStage('start');
  puz(h).placeCrate('caixote', L.CRATE.start.x, 0.1);
  puz(h).debugSet('tap');
  h.run(1.0);
  assert.equal(q(h).flowing, true);
  h.tap('Escape');
  assert.equal(h.info().state, 'paused');
  const w = q(h).water;
  h.run(2);
  assert.equal(q(h).water, w, 'pausado, a água não sobe');
  h.events.emit('ui:resume', {});
  h.run(0.5);
  assert.ok(q(h).water > w, 'retomado, ela volta a subir');
  // reinício devolve tudo
  h.events.emit('ui:restart', {});
  h.run(0.2);
  const s = q(h);
  assert.deepEqual([s.stage, s.water, s.tap, s.power, s.gateOpen, s.pigeon, s.doorOpen, s.cake.length], ['start', 0, false, false, false, 'asleep', false, 0]);
  assert.deepEqual(s.place, { hat: 'home', ribbon: 'home', candle: 'home' });
  assert.ok(Math.abs(s.crate.x - L.CRATE.start.x) < 1e-3 && Math.abs(s.crate.z - L.CRATE.start.z) < 1e-3);
  h.game.debug.setStage('done');
  assert.ok(h.run(10, { until: (st) => st.state === 'victory' }), 'stage=done termina a fase');
});
