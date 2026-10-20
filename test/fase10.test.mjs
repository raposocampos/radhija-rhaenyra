// Fase 10 (Festa no Quintal): o bolo com cinco enfeites e o enigma da ordem (o quadro da sala mostra, de baixo para
// cima, laço, biscoito de osso, vela do 3, chapéu e estrela); o chapeuzinho no barquinho (caixote fora da mangueira,
// torneira no alto da parede, a piscininha enchendo e o ventilador ligado pelo disjuntor da cozinha); o laço na casa na
// árvore (a Dona Gansa guardando a cordinha do portão, o superbafo pelo cano de brinquedo até o pombo, o elevador de
// balde com a Rhaenyra puxando a corda, o deque onde a Radhija anda livre, desamarra o laço e escorrega); o biscoito
// em cima do armário da despensa (a Rhaenyra puxa três caixotes até as marcas do chão, a Radhija sobe); a vela do 3 no
// galpão (o gerador que liga o painel, os dois botões altos sorteados: porta ou chiqueiro, o vão da horta lá no fundo,
// a lama, o Lambe-Lambe, a Rhaenyra enlameada sem pulo, e a rampa só com arrancada); a estrela na piñata em cima da
// roseira (o empurrão no tronco pelo oeste, o superbafo balança, a Rhaenyra pula e bate); os legumes do campinho; os
// porquinhos do chiqueiro; as galinhas do quintal; e as regras de cada passo. Headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { withSeedAsync } from './helpers/seeded.mjs';
import { WALL_BUTTON_SHAPE } from '../src/game/mechanics/wallButton.js';
import { DOG_CONFIG } from '../src/dogs/config.js';
import { shoveStance } from '../src/game/dogController.js';
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
/**
 * Todos os testes daqui rodam com semente (Math.random sorteia os porquinhos, o botão da porta sem ?botao=, a fase da
 * passada e as piscadas das dogs): cada caso dá sempre o mesmo resultado em qualquer máquina. Os que dependem do
 * sorteio guardam quantas sementes uma varredura deve cobrir quando um deles parecer instável (sweep).
 * @type {{ name: string, fn: () => any, sweep: number }[]}
 */
const SEEDED = [];
/** @param {string} name @param {number} seed @param {() => any} fn @param {{ sweep?: number }} [o] */
function seededTest(name, seed, fn, { sweep = 0 } = {}) {
  SEEDED.push({ name, fn, sweep });
  test(name, () => withSeedAsync(seed, fn));
}
const NOUN = { hat: 'o chapeuzinho', ribbon: 'o laço', candle: 'a vela do 3', cookie: 'o biscoito de osso', star: 'a estrela' };
const fill = (s, item) => s.replace('{item}', NOUN[item]);
const GOAL_IN = { x: L.GOAL.x, z: L.GOAL.z + 1.0 };
/** Os caixotes da despensa e o pé da escadinha (na frente do caixote baixo). */
const CR = L.PANTRY_CRATES;
const FOOT = { x: CR.x1, z: CR.list[2].z + CR.hz + 0.3 };

/** Fica ativa a dog `name` (Q se precisar). */
function as(h, name) {
  if (h.info().activeDog !== name) h.tap('KeyQ');
  assert.equal(h.info().activeDog, name);
}
/** Onde ficar para o impulso no botão/alavanca `cfg` (de frente, com a dog um pouco à esquerda dele). */
function kickSpot(cfg) {
  const lat = WALL_BUTTON_SHAPE[cfg.kind].lat;
  return { x: cfg.x + cfg.nx * 0.5 + -cfg.nz * lat, z: cfg.z + cfg.nz * 0.5 + cfg.nx * lat };
}
/** A Rhaenyra (ativa) puxa a cordinha do gerador do painel e espera ele pegar. */
function startGenerator(h) {
  const G = L.GENERATOR;
  put(h, 'rhaenyra', G.cord.x + 0.3, G.cord.z, -Math.PI / 2);
  assert.equal(h.info().prompt, TEXT.prompt.gen, 'prompt do gerador');
  h.tap('KeyE');
  assert.equal(q(h).generator.pulling, true, 'puxando a cordinha');
  assert.ok(h.run(G.pull + G.crank + 0.5, { until: (i) => i.quintal.generator.on }), 'o gerador pegou');
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
/** A Rhaenyra (ativa) pega a alça do caixote i (no começo do trilho) e anda para trás até ele travar na marca. */
function pullCrate(h, i) {
  put(h, 'rhaenyra', q(h).crates[i].x + CR.hx + 0.03 + 0.3, CR.list[i].z, -Math.PI / 2);
  assert.equal(h.info().prompt, TEXT.prompt.crateGrab, `prompt do caixote ${i}`);
  h.tap('KeyE');
  assert.equal(q(h).crateHold, i, `segurando o caixote ${i}`);
  h.hold([1, 0]);
  assert.ok(h.run(4, { until: (s) => s.quintal.crates[i].locked }), `o caixote ${i} chegou na marca ${JSON.stringify(q(h).crates[i])}`);
  h.hold(null);
  assert.equal(q(h).crateHold, null, 'na marca, ela solta a alça sozinha');
  assert.equal(q(h).crates[i].x, CR.x1);
}
/** A Radhija (ativa) no pé da escadinha: E para subir; espera a subida (e a descida) terminar. */
function climbCrates(h) {
  put(h, 'radhija', FOOT.x, FOOT.z, Math.PI);
  assert.equal(h.info().prompt, TEXT.prompt.climb, 'prompt da subida');
  h.tap('KeyE');
  assert.ok(h.run(0.2, { until: (s) => s.quintal.climb }), 'começou a subir');
  const seen = { air: false, crouch: false };
  assert.ok(h.run(12, { until: (s) => {
    const an = h.dogs.radhija.anim;
    if (an.airK >= 0) seen.air = true;
    if (an.crouch > 0.6) seen.crouch = true;
    return !s.quintal.climb;
  } }), 'terminou a subida');
  return seen;
}
/** A piñata enroscada: a Rhaenyra fica de pé de frente para o tronco da mangueira e empurra (Shift) até ela descer. */
function shoveTree(h) {
  as(h, 'rhaenyra');
  const M = L.MANGO_SHOVE;
  const K = shoveStance(M, h.ctrls.rhaenyra.r);
  put(h, 'rhaenyra', K.x + M.nx * 0.25, K.z + M.nz * 0.25, Math.atan2(-M.nx, -M.nz)); // do lado de cá do tronco (oeste), olhando para ele
  h.clearLog();
  h.hold([-M.nx, -M.nz], ['ShiftLeft']);
  assert.ok(h.run(2, { until: (i) => !!i.dogs.rhaenyra.shove }), 'de pé, com as patas no tronco');
  h.hold(null, ['ShiftLeft']);
  assert.ok(h.run(6, { until: (i) => i.quintal.pinata.stage !== 'tree' }), `três empurrões soltam a piñata ${JSON.stringify(q(h).pinata)}`);
  h.hold(null);
  assert.ok(h.run(3, { until: (i) => i.quintal.pinata.stage === 'free' }), 'a piñata desceu na corda');
  assert.ok(h.log('dog:shove').length >= 3);
  assert.ok(hints(h).includes(TEXT.hint.pinataFall));
  h.run(1.0); // ela volta às quatro patas
}
/** A estrela: a Radhija sopra a piñata do oeste; a Rhaenyra, do leste, pula quando ela passa por cima. */
function breakPinata(h) {
  const west = { x: L.ROSE_BUSH.x - 1.5, z: L.ROSE_BUSH.z };
  const east = { x: L.ROSE_BUSH.x + 0.98, z: L.ROSE_BUSH.z };
  const blow = () => {
    as(h, 'radhija');
    put(h, 'radhija', west.x, west.z, Math.PI / 2);
    bafo(h);
    h.run(0.1); // soltou: sai a nuvem (só então troca)
    as(h, 'rhaenyra');
    put(h, 'rhaenyra', east.x, east.z, -Math.PI / 2);
  };
  h.clearLog();
  blow();
  assert.ok(h.run(2, { until: () => h.log('pinata:swing').length >= 1 }), 'o superbafo balançou a piñata');
  let blows = 1;
  for (let k = 0; k < 1500 && !q(h).pinata.broken; k++) {
    const p = q(h).pinata;
    const c = h.ctrls.rhaenyra;
    if (!c.jumpT && Math.hypot(p.x - c.x, p.z - c.z) < 0.5) h.tap('Space');
    else h.run(1 / 60);
    // quase parada: mais um superbafo
    if (Math.hypot(p.ax, p.az) < 0.08 && Math.abs(q(h).pinata.ax) < 0.08 && !c.jumpT && blows < 12) {
      blows++;
      blow();
    }
  }
  assert.equal(q(h).pinata.broken, true, `três batidas abriram a piñata ${JSON.stringify(q(h).pinata)}`);
}

seededTest('fase 10: na campanha, a última, com o cenário sob demanda, chapéu como item e extras', 1, () => {
  assert.equal(LEVELS[LEVEL - 1].id, 'fase10');
  assert.equal(LEVEL, LEVELS.length, 'a fase 10 fecha a campanha');
  assert.equal(fase10.number, 10);
  assert.equal(fase10.item, 'hat');
  assert.equal(fase10.ambience, 'dusk');
  assert.equal(typeof fase10.load, 'function');
  assert.equal(L.COLLECTIBLES.length, 5, 'a última fase tem cinco ossinhos');
  assert.ok(fase10.extras.length >= 1);
  assert.deepEqual([...L.CAKE_ORDER], ['ribbon', 'cookie', 'candle', 'hat', 'star'], 'a ordem do quadro: laço, biscoito, vela, chapéu e estrela');
});

seededTest('fase 10: partida completa (chapéu fora de ordem, o quadro, e os cinco enfeites na ordem certa)', 1, async () => {
  const h = await game('botao=1');
  h.run(0.3);
  let s = q(h);
  assert.deepEqual([s.stage, s.water, s.power, s.gateOpen, s.pigeon, s.crateOnHose, s.shed.doorBtn], ['start', 0, false, false, 'asleep', true, 0]);
  assert.equal(h.info().objective, TEXT.objective.cookieRad, 'começando na casa, o objetivo é o biscoito da despensa');

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
  assert.equal(h.info().objective, TEXT.objective.cookieRad, 'de volta aos enfeites: na casa, o biscoito');

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

  // ---- BISCOITO: a Rhaenyra puxa os três caixotes até as marcas (eles travam sozinhos); a Radhija sobe por eles
  as(h, 'rhaenyra');
  put(h, 'rhaenyra', q(h).crates[0].x + CR.hx + 0.33, CR.list[0].z, -Math.PI / 2);
  assert.equal(h.info().objective, TEXT.objective.cookieRh);
  h.clearLog();
  for (const i of [0, 1, 2]) pullCrate(h, i);
  assert.equal(q(h).stairs, true, `os caixotes viraram uma escadinha ${JSON.stringify(q(h).crates)}`);
  assert.equal(h.log('crate:lock').length, 3);
  assert.ok(hints(h).includes(TEXT.hint.cratesDone));
  assert.equal(h.info().objective, TEXT.objective.climbRh);
  as(h, 'radhija');
  assert.equal(h.info().objective, TEXT.objective.climbRad);
  const seen = climbCrates(h);
  assert.ok(seen.air && seen.crouch, `pulinhos com a pose de pulo e a agachadinha antes ${JSON.stringify(seen)}`);
  assert.equal(h.info().cookie.holder, 'radhija', 'pegou o biscoito lá em cima');
  assert.equal(h.ctrls.radhija.y, 0, 'de volta ao chão');
  h.clearLog();
  toCake(h);
  assert.deepEqual(q(h).cake, ['ribbon', 'cookie'], 'o biscoito no segundo andar');
  assert.equal(h.info().stage, 'cake2');

  // ---- VELA: o gerador ao lado da cerca branca liga o painel; o botão certo (com ?botao=1, o primeiro) abre a porta
  as(h, 'rhaenyra');
  put(h, 'rhaenyra', L.GENERATOR.cord.x + 0.3, L.GENERATOR.cord.z, -Math.PI / 2);
  assert.equal(h.info().objective, TEXT.objective.genRh);
  h.clearLog();
  startGenerator(h);
  assert.deepEqual(['generator:pull', 'generator:crank', 'generator:start'].map((e) => h.log(e).length), [1, 1, 1]);
  assert.ok(hints(h).includes(TEXT.hint.genOn));
  assert.equal(h.info().objective, TEXT.objective.buttonsRh);
  h.clearLog();
  wallJump(h, L.SHED_BUTTONS[0]);
  assert.ok(h.run(1.5, { until: (i) => i.quintal.doorOpen }), 'o botão certo abriu a porta do galpão');
  assert.equal(q(h).shed.sty, false, 'o chiqueiro continua fechado');
  assert.ok(hints(h).includes(TEXT.hint.doorButton));
  // ---- a Radhija entra pelo vão, lá no fundo (perto do chiqueiro), e cai na lama; a Rhaenyra pula a cerca e lambe
  as(h, 'radhija');
  assert.equal(h.info().objective, TEXT.objective.hortaRad);
  const gz = (L.HORTA.gap.z0 + L.HORTA.gap.z1) / 2;
  put(h, 'radhija', L.HORTA.x0 - 0.45, gz, Math.PI / 2);
  h.walkPath([[L.HORTA.x0 + 0.5, gz], [8.6, 4.2]], { tol: 0.12 });
  assert.ok(q(h).mud.k > 0, 'enlameada');
  assert.equal(q(h).inHorta.radhija, true);
  as(h, 'rhaenyra');
  h.tap('KeyF'); // a Radhija espera
  assert.equal(h.info().objective, TEXT.objective.jumpLickRh);
  put(h, 'rhaenyra', L.HORTA.x0 - 0.42, 4.0, Math.PI / 2);
  h.hold([1, 0]);
  h.tap('Space');
  h.run(0.55);
  h.hold(null);
  h.run(0.2);
  assert.equal(q(h).inHorta.rhaenyra, true, 'a Rhaenyra pulou a cerca baixa');
  assert.equal(q(h).mudRh.k, 0, 'longe da lama, ela continua limpinha');
  h.keyDown('KeyL');
  const clean = h.run(6, { until: (i) => i.quintal.mud.k === 0 });
  h.keyUp('KeyL');
  assert.ok(clean, `o Lambe-Lambe limpou a Radhija ${JSON.stringify(q(h).mud)}`);
  as(h, 'radhija');

  // ---- a rampa: arrancada e a vela lá no alto
  h.walkPath([[9.0, 2.0], [9.9, 2.0], [9.8, L.RAMP.z - 0.05, { tol: 0.08 }]], { tol: 0.12 });
  put(h, 'radhija', h.ctrls.radhija.x, h.ctrls.radhija.z, Math.PI / 2); // de frente para a rampa, parada
  h.tap('ShiftLeft');
  assert.ok(h.run(4, { until: (i) => i.candle.holder === 'radhija' && !i.quintal.ramp }), `subiu a rampa e pegou a vela ${JSON.stringify({ ramp: q(h).ramp, x: h.ctrls.radhija.x, z: h.ctrls.radhija.z })}`);
  assert.equal(h.ctrls.radhija.y, 0);

  // ---- a vela no terceiro andar e o chapéu (que ficou no chão) no quarto
  h.clearLog();
  toCake(h);
  assert.deepEqual(q(h).cake, ['ribbon', 'cookie', 'candle'], 'vela no terceiro andar');
  assert.equal(h.info().stage, 'cake3');
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
  assert.deepEqual(q(h).cake, ['ribbon', 'cookie', 'candle', 'hat'], 'o chapéu no quarto andar');
  assert.equal(h.info().stage, 'cake4');

  // ---- ESTRELA: a piñata enroscada no alto da mangueira; a Rhaenyra empurra o tronco e ela desce em cima da roseira
  put(h, 'radhija', L.ROSE_BUSH.x - 1.5, L.ROSE_BUSH.z, Math.PI / 2);
  assert.equal(h.info().objective, TEXT.objective.treeRad);
  shoveTree(h);
  as(h, 'radhija');
  put(h, 'radhija', L.ROSE_BUSH.x - 1.5, L.ROSE_BUSH.z, Math.PI / 2);
  assert.equal(h.info().objective, TEXT.objective.starRad);
  breakPinata(h);
  assert.equal(h.log('pinata:burst').length, 1);
  assert.ok(hints(h).includes(TEXT.hint.pinataOpen));
  const star = q(h).floor.star;
  assert.equal(q(h).place.star, 'floor', 'a estrela caiu no gramado');
  assert.ok(Math.hypot(star.x - L.ROSE_BUSH.x, star.z - L.ROSE_BUSH.z) > L.ROSE_BUSH.r, 'fora da roseira');
  h.walkTo(star.x + 0.3, star.z, { tol: 0.1 });
  assert.equal(h.info().prompt, TEXT.prompt.pick);
  h.tap('KeyE');
  assert.equal(h.info().star.holder, 'rhaenyra', 'a Rhaenyra pegou a estrela');
  toCake(h);
  assert.ok(h.run(10, { until: (i) => i.state === 'victory' }), 'o bolo pronto: vitória');
  assert.deepEqual(q(h).cake, ['ribbon', 'cookie', 'candle', 'hat', 'star']);
  assert.equal(h.log('cake:lit').length, 1, 'a vela acendeu');
  const vic = h.log('victory');
  assert.equal(vic.length, 1);
  assert.equal(vic[0].levelId, 'fase10');
  assert.equal(vic[0].hasNext, false, 'a 10 é a última');
});

seededTest('fase 10: a mangueira esmagada não deixa a água passar; sem energia o barquinho fica no meio', 1, async () => {
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

seededTest('fase 10: a gansa guarda a cordinha; latido de longe distrai; com o portão aberto ela só passeia', 1, async () => {
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

seededTest('fase 10: o pombo não sai com latido nem com superbafo direto; pelo cano, voa', 1, async () => {
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

seededTest('fase 10: o balde (só a Radhija entra, só a Rhaenyra puxa, solto desce; com o pombo lá em cima, ela volta)', 1, async () => {
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

seededTest('fase 10: no deque a Radhija anda livre (tronco e casinha seguram) e escolhe voltar para o balde ou escorregar', 1, async () => {
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

seededTest('fase 10: lama sem arrancada; o gerador liga o painel; os dois botões (um abre a porta, o outro o chiqueiro); a rampa só com arrancada', 1, async () => {
  const h = await game('botao=2');
  h.run(0.3);
  puz(h).debugSet('gate');
  assert.equal(q(h).shed.doorBtn, 1, '?botao=2: o segundo botão abre a porta');
  // enlameada: sem arrancada
  put(h, 'radhija', 9.0, 2.0, Math.PI / 2);
  puz(h).debugSet('clean', false);
  h.clearLog();
  h.hold([1, 0]);
  h.tap('ShiftLeft');
  h.hold(null);
  h.run(0.2);
  assert.ok(h.log('dog:dashBlocked').length >= 1, 'enlameada, a arrancada não sai');
  assert.ok(hints(h).includes(TEXT.hint.noDash));
  assert.equal(h.info().objective, TEXT.objective.genRad, 'primeiro, o gerador do painel');
  // a Radhija não tem força para a cordinha do gerador
  const G = L.GENERATOR;
  put(h, 'radhija', G.cord.x + 0.28, G.cord.z, -Math.PI / 2);
  assert.equal(h.info().prompt, TEXT.prompt.gen);
  h.clearLog();
  h.tap('KeyE');
  h.run(0.3);
  assert.ok(hints(h).includes(TEXT.hint.genHeavy));
  assert.deepEqual(q(h).generator, { on: false, pulling: false });
  // a Rhaenyra: com o painel apagado, nada de impulso (o Espaço é um pulo comum) e nenhum botão afunda
  as(h, 'rhaenyra');
  const k0 = kickSpot(L.SHED_BUTTONS[0]);
  h.clearLog();
  put(h, 'rhaenyra', k0.x, k0.z, Math.atan2(-L.SHED_BUTTONS[0].nx, -L.SHED_BUTTONS[0].nz));
  h.run(0.3);
  assert.notEqual(h.info().prompt, TEXT.prompt.wall, 'sem força, sem impulso');
  assert.ok(hints(h).includes(TEXT.hint.noPowerBoard));
  h.tap('Space');
  h.run(D + 0.2);
  assert.equal(h.log('dog:wallJump').length, 0);
  assert.deepEqual([q(h).shed.open, q(h).shed.sty], [false, false], 'nenhum botão apertado');
  // a partida: puxa a cordinha, o motor engasga e pega; ligado, o "tá-tá-tá" e a fumacinha
  h.clearLog();
  startGenerator(h);
  assert.deepEqual(['generator:pull', 'generator:crank', 'generator:start'].map((e) => h.log(e).length), [1, 1, 1]);
  assert.ok(h.run(1.2, { until: () => h.log('generator:hum').length > 0 }), 'ligado, o motor faz tá-tá-tá');
  // o primeiro botão abre o chiqueiro (a porta continua fechada); o segundo, a porta
  h.clearLog();
  wallJump(h, L.SHED_BUTTONS[0]);
  assert.equal(q(h).shed.sty, true, 'o primeiro botão abriu o chiqueiro');
  assert.equal(h.log('sty:open').length, 1);
  assert.ok(hints(h).includes(TEXT.hint.styButton));
  h.run(1);
  assert.equal(q(h).doorOpen, false, 'a porta do galpão continua fechada');
  h.clearLog();
  wallJump(h, L.SHED_BUTTONS[1]);
  assert.ok(h.run(1.5, { until: (i) => i.quintal.doorOpen }), 'o outro botão abriu a porta');
  assert.ok(hints(h).includes(TEXT.hint.doorButton));
  // enlameada, a Radhija escorrega na tábua
  as(h, 'radhija');
  put(h, 'radhija', 9.85, L.RAMP.z, Math.PI / 2);
  h.clearLog();
  h.hold([1, 0]);
  const slipped = h.run(2, { until: () => h.log('slide:slip').length > 0 });
  h.hold(null);
  assert.ok(slipped, 'andando na tábua, ela escorrega');
  assert.ok(h.run(3, { until: (i) => !i.quintal.ramp }));
  assert.ok(hints(h).includes(TEXT.hint.rampMud), 'dica da lama');
  h.run(1);
  // limpinha, andando ainda escorrega; com arrancada sobe e pega a vela
  puz(h).debugSet('clean');
  put(h, 'radhija', 9.85, L.RAMP.z, Math.PI / 2);
  h.clearLog();
  h.hold([1, 0]);
  assert.ok(h.run(2, { until: () => h.log('slide:slip').length > 0 }), 'sem arrancada, escorrega');
  h.hold(null);
  assert.ok(h.run(3, { until: (i) => !i.quintal.ramp }));
  assert.ok(hints(h).includes(TEXT.hint.rampSlip));
  h.run(1);
  put(h, 'radhija', 9.85, L.RAMP.z, Math.PI / 2);
  h.tap('ShiftLeft');
  assert.ok(h.run(4, { until: (i) => i.candle.holder === 'radhija' && !i.quintal.ramp }), 'com arrancada, pegou a vela');
});

seededTest('fase 10: o botão da porta é sorteado a cada partida (sem ?botao=)', 1, async () => {
  const seen = new Set();
  const h = await game();
  seen.add(q(h).shed.doorBtn);
  for (let k = 0; k < 40 && seen.size < 2; k++) {
    h.events.emit('ui:restart', {});
    h.run(0.05);
    seen.add(q(h).shed.doorBtn);
  }
  assert.deepEqual([...seen].sort(), [0, 1], 'os dois botões aparecem');
}, { sweep: 40 });

seededTest('fase 10: caixotes — a Radhija não puxa e só sobe com os três na marca; solto no meio, o caixote fica onde parou', 1, async () => {
  const h = await game();
  h.run(0.3);
  // a Radhija na alça: pesado demais; no pé da escadinha sem os caixotes: ainda não
  as(h, 'radhija');
  h.clearLog();
  put(h, 'radhija', CR.x0 + CR.hx + 0.03 + 0.25, CR.list[1].z, -Math.PI / 2);
  h.tap('KeyE');
  assert.equal(q(h).crateHold, null);
  assert.ok(hints(h).includes(TEXT.hint.crateHeavy), 'a Radhija não puxa');
  put(h, 'radhija', FOOT.x, FOOT.z, Math.PI);
  assert.equal(h.info().prompt, TEXT.prompt.climb);
  h.tap('KeyE');
  h.run(0.2);
  assert.equal(q(h).climb, null, 'sem a escadinha, ela não sobe');
  assert.ok(hints(h).includes(TEXT.hint.cratesNotReady));
  // a Rhaenyra puxa o do meio até a metade e solta: ele fica ali; pega de novo e leva até a marca
  as(h, 'rhaenyra');
  put(h, 'rhaenyra', CR.x0 + CR.hx + 0.33, CR.list[1].z, -Math.PI / 2);
  h.tap('KeyE');
  h.hold([1, 0]);
  assert.ok(h.run(3, { until: (s) => s.quintal.crates[1].x > (CR.x0 + CR.x1) / 2 }));
  h.hold(null);
  assert.equal(h.info().prompt, TEXT.prompt.crateRelease);
  h.tap('KeyE');
  h.run(0.3);
  const mid = q(h).crates[1];
  assert.ok(mid.x > CR.x0 + 0.1 && mid.x < CR.x1 - 0.1 && !mid.locked, `solto no meio do trilho ${JSON.stringify(mid)}`);
  assert.equal(h.info().prompt, TEXT.prompt.crateGrab, 'a alça continua ao alcance');
  h.tap('KeyE');
  h.hold([1, 0]);
  assert.ok(h.run(3, { until: (s) => s.quintal.crates[1].locked }), 'travou na marca');
  h.hold(null);
  // andando para a frente (para o caixote), ele não volta
  const x = q(h).crates[1].x;
  h.hold([-1, 0]);
  h.run(0.6);
  h.hold(null);
  assert.equal(q(h).crates[1].x, x, 'travado, não sai da marca');
  // a Rhaenyra não sobe a escadinha
  puz(h).debugSet('stairs');
  put(h, 'rhaenyra', FOOT.x, FOOT.z, Math.PI);
  assert.notEqual(h.info().prompt, TEXT.prompt.climb);
});

seededTest('fase 10: a piñata parada em cima da roseira; legumes do campinho (colher, largar, pegar do chão, rebrotar)', 1, async () => {
  const h = await game();
  h.run(0.3);
  // enroscada no alto da mangueira: a dica do tronco; o superbafo nem chega lá
  as(h, 'rhaenyra');
  h.clearLog();
  put(h, 'rhaenyra', L.ROSE_BUSH.x + 0.98, L.ROSE_BUSH.z, -Math.PI / 2);
  assert.ok(hints(h).includes(TEXT.hint.pinataHigh));
  assert.equal(h.info().objective, TEXT.objective.treeRh);
  puz(h).debugSet('pinataDown');
  // longe um pouco (a dica anterior acaba) e de volta: parada em cima da roseira, a Rhaenyra pula do lado e não alcança
  put(h, 'rhaenyra', L.ROSE_BUSH.x + 3.5, L.ROSE_BUSH.z - 1.5, -Math.PI / 2);
  h.run(4.5);
  h.clearLog();
  put(h, 'rhaenyra', L.ROSE_BUSH.x + 0.98, L.ROSE_BUSH.z, -Math.PI / 2);
  for (let k = 0; k < 3; k++) { h.tap('Space'); h.run(0.8); }
  assert.equal(q(h).pinata.hits, 0, 'parada, ninguém alcança');
  assert.ok(hints(h).includes(TEXT.hint.pinataThorns));
  // os legumes: a Radhija colhe uma cenoura, larga, pega de novo do chão; o pé rebrota
  as(h, 'radhija');
  const C = L.PLANTATION.carrots;
  put(h, 'radhija', C.x, C.z + C.hz + 0.35, Math.PI);
  assert.equal(h.info().prompt, TEXT.prompt.pickVeg);
  h.clearLog();
  h.tap('KeyE');
  assert.equal(q(h).veg.held.radhija, 'carrot', 'colheu uma cenoura');
  assert.equal(h.log('veg:pick').length, 1);
  const spot = h.props.farm.spots.find((sp) => sp.kind === 'carrot');
  assert.equal(spot.ready, false, 'o pé ficou sem');
  put(h, 'radhija', C.x + 0.6, C.z + C.hz + 0.9, Math.PI / 2);
  assert.equal(h.info().prompt, TEXT.prompt.dropVeg);
  h.tap('KeyE');
  assert.equal(q(h).veg.held.radhija, null);
  assert.equal(q(h).veg.floor, 1, 'largou no chão');
  h.run(0.1);
  assert.equal(h.info().prompt, TEXT.prompt.pickVeg);
  h.tap('KeyE');
  assert.equal(q(h).veg.held.radhija, 'carrot', 'pegou de novo do chão');
  assert.equal(q(h).veg.floor, 0);
  assert.ok(h.run(L.PLANTATION.regrow + 0.5, { until: () => spot.ready }), 'o pé rebrotou');
  h.tap('KeyE');
  assert.equal(q(h).veg.held.radhija, null, 'E larga o legume');
});

seededTest('fase 10: as galinhas — de frente fogem correndo; por trás nem ligam; o latido as faz voar e elas não saem da área', 1, async () => {
  const h = await game();
  h.run(0.3);
  const hen = () => q(h).chickens[0];
  const A = L.CHICKENS.area;
  const inArea = (c) => c.x >= A.minX - 1e-3 && c.x <= A.maxX + 1e-3 && c.z >= A.minZ - 1e-3 && c.z <= A.maxZ + 1e-3;
  as(h, 'radhija');
  // por trás: chega a 1 m, nas costas dela, e ela continua ciscando
  let c0 = hen();
  const yaw0 = L.CHICKENS.start[0].yaw;
  put(h, 'radhija', c0.x - Math.sin(yaw0) * 1.0, c0.z - Math.cos(yaw0) * 1.0, yaw0);
  h.clearLog();
  h.run(0.6);
  assert.ok(!['flee', 'glide'].includes(hen().state), `por trás ela nem liga (${hen().state})`);
  assert.equal(h.log('chicken:alarm').length, 0);
  // de frente: a 1 m, na frente do bico, ela foge correndo
  h.events.emit('ui:restart', {});
  h.run(0.2);
  c0 = hen();
  put(h, 'radhija', c0.x + Math.sin(yaw0) * 1.0, c0.z + Math.cos(yaw0) * 1.0, yaw0 + Math.PI);
  assert.ok(h.run(0.6, { until: () => hen().state === 'flee' }), `de frente, ela foge (${hen().state})`);
  assert.ok(h.log('chicken:alarm').length >= 1);
  const d0 = Math.hypot(hen().x - h.ctrls.radhija.x, hen().z - h.ctrls.radhija.z);
  h.run(1.0);
  const d1 = Math.hypot(hen().x - h.ctrls.radhija.x, hen().z - h.ctrls.radhija.z);
  assert.ok(d1 > d0 + 0.3, `correu para longe (${d0.toFixed(2)} → ${d1.toFixed(2)} m)`);
  // o latido (E sem nada por perto) faz as duas voarem; pousam dentro da área
  h.events.emit('ui:restart', {});
  h.run(0.2);
  put(h, 'radhija', (A.minX + A.maxX) / 2 - 1.2, (A.minZ + A.maxZ) / 2, Math.PI / 2);
  h.clearLog();
  h.tap('KeyE');
  assert.ok(h.log('chicken:flap').length >= 1, 'latido: voo curto');
  let maxY = 0;
  assert.ok(h.run(2.5, { until: (s) => { maxY = Math.max(maxY, ...s.quintal.chickens.map((k) => k.y)); return s.quintal.chickens.every((k) => k.state !== 'glide'); } }), 'pousaram');
  assert.ok(maxY > 0.25, `subiram batendo as asas (${maxY.toFixed(2)} m)`);
  assert.ok(q(h).chickens.every(inArea), `continuam na área ${JSON.stringify(q(h).chickens)}`);
  // ninguém tem texto
  assert.equal(h.log('hint').filter((x) => /galinha/i.test(x.text || '')).length, 0);
}, { sweep: 100 });

seededTest('fase 10: a Rhaenyra que pisa na lama escorrega (sem pulo nem impulso) até a Radhija lambê-la (L)', 1, async () => {
  const h = await game('botao=1');
  h.run(0.3);
  puz(h).debugSet('gate');
  puz(h).debugSet('generator');
  as(h, 'rhaenyra');
  h.clearLog();
  // parada na lama (como na troca) ela não se suja; andando ali, sim
  put(h, 'rhaenyra', (L.MUD.x0 + L.MUD.x1) / 2, (L.MUD.z0 + L.MUD.z1) / 2, 0);
  h.run(0.4);
  assert.equal(q(h).mudRh.k, 0, 'parada, não se suja');
  h.hold([1, 0]);
  h.run(0.35);
  h.hold(null);
  assert.ok(q(h).mudRh.k > 0, `andando na lama, enlameada ${JSON.stringify(q(h).mudRh)}`);
  assert.ok(hints(h).includes(TEXT.hint.mudRh));
  assert.equal(h.info().objective, TEXT.objective.muddyRh);
  // enlameada, nem pulo: o Espaço só espirra lama (e a dica)
  h.clearLog();
  h.hold([1, 0]);
  h.tap('Space');
  h.run(0.3);
  h.hold(null);
  assert.ok(h.log('dog:jumpBlocked').length >= 1, 'enlameada, o pulo não sai');
  assert.equal(h.log('dog:jump').length, 0);
  assert.equal(h.ctrls.rhaenyra.jumpT || 0, 0);
  assert.ok(hints(h).includes(TEXT.hint.jumpMud));
  // no botão do painel: sem prompt de impulso; o Espaço não pula e o botão não afunda
  const k = kickSpot(L.SHED_BUTTONS[0]);
  put(h, 'rhaenyra', k.x, k.z, Math.atan2(-L.SHED_BUTTONS[0].nx, -L.SHED_BUTTONS[0].nz));
  h.run(0.2);
  assert.notEqual(h.info().prompt, TEXT.prompt.wall, 'enlameada, sem impulso');
  assert.ok(hints(h).includes(TEXT.hint.wallMud));
  h.clearLog();
  h.tap('Space');
  h.run(D + 0.2);
  assert.equal(h.log('dog:wallJump').length + h.log('dog:jump').length, 0, 'nem impulso nem pulo');
  assert.equal(q(h).shed.open, false, 'o botão não foi apertado');
  // a Radhija lambe a irmã (L): limpinha, o impulso volta
  as(h, 'radhija');
  assert.equal(h.info().objective, TEXT.objective.lickRad);
  put(h, 'rhaenyra', k.x, k.z, Math.atan2(-L.SHED_BUTTONS[0].nx, -L.SHED_BUTTONS[0].nz));
  const rh = h.ctrls.rhaenyra;
  put(h, 'radhija', rh.x + 0.45, rh.z + 0.05, -Math.PI / 2);
  h.keyDown('KeyL');
  const clean = h.run(8, { until: (i) => i.quintal.mudRh.k === 0 });
  h.keyUp('KeyL');
  assert.ok(clean, `a Radhija limpou a Rhaenyra com o Lambe-Lambe ${JSON.stringify(q(h).mudRh)}`);
  assert.ok(hints(h).includes(TEXT.hint.cleanRh));
  h.run(1.6); // limpinha, ela se sacode antes de voltar a pular
  as(h, 'rhaenyra');
  h.clearLog();
  wallJump(h, L.SHED_BUTTONS[0]);
  assert.ok(h.run(1.5, { until: (i) => i.quintal.doorOpen }), 'limpinha, o impulso abriu a porta');
});

seededTest('fase 10: o botão errado solta os porquinhos; eles derrubam o legume da boca, comem por um tempo e voltam a atrapalhar', 1, async () => {
  const h = await game('botao=2'); // com ?botao=2, o primeiro botão abre o chiqueiro
  h.run(0.3);
  puz(h).debugSet('gate');
  puz(h).debugSet('generator');
  as(h, 'rhaenyra');
  h.clearLog();
  wallJump(h, L.SHED_BUTTONS[0]);
  assert.equal(q(h).shed.sty, true, 'o botão errado abriu o chiqueiro');
  assert.ok(h.run(10, { until: (i) => i.quintal.pigs.released && i.quintal.pigs.inPen === 0 }), `os três saíram ${JSON.stringify(q(h).pigs.pigs)}`);
  assert.ok(h.log('pig:release').length >= 1);
  assert.ok(hints(h).includes(TEXT.hint.pigsBlock));
  // a Radhija colhe uma cenoura e entra na horta com ela na boca: os porquinhos vão atrás e derrubam
  as(h, 'radhija');
  const C = L.PLANTATION.carrots;
  put(h, 'radhija', C.x, C.z + C.hz + 0.35, Math.PI);
  h.tap('KeyE');
  assert.equal(q(h).veg.held.radhija, 'carrot');
  put(h, 'rhaenyra', 5.5, 0.6, 0);
  h.tap('KeyQ');
  h.tap('KeyF'); // a Rhaenyra espera fora da horta
  h.tap('KeyQ');
  // no meio da horta, longe das cercas: na beirada da área deles (o lugar do primeiro porquinho é sorteado e às vezes
  // ficava junto da cerca oeste) eles mal encostam nela
  put(h, 'radhija', 8.7, 4.1, -Math.PI / 2);
  h.clearLog();
  assert.ok(h.run(25, { until: (i) => i.quintal.veg.held.radhija === null }), `um porquinho derrubou a cenoura ${JSON.stringify(q(h).pigs)}`);
  assert.ok(h.log('pig:knock').length >= 1);
  assert.ok(hints(h).includes(TEXT.hint.pigKnock));
  // a Radhija pega a cenoura de volta e larga no meio da horta: um porco come e cochila (distraído) e depois volta
  const fv = q(h).veg;
  assert.equal(fv.floor, 1, 'a cenoura caiu no chão');
  put(h, 'radhija', 8.75, 3.05, 0);
  puz(h).debugSet('vegHere');
  h.run(0.1);
  h.clearLog();
  // um porquinho pode estar dando um esbarrão nela (trava o E por um instante): tenta de novo
  for (let k = 0; k < 20 && q(h).veg.held.radhija; k++) { h.tap('KeyE'); h.run(0.1); }
  assert.equal(q(h).veg.held.radhija, null, 'largou a cenoura no meio da horta');
  put(h, 'radhija', 8.0, 1.3, Math.PI);
  assert.ok(h.run(15, { until: () => h.log('pig:eat').length >= 1 }), `um porco foi comer ${JSON.stringify(q(h).pigs.pigs)}`);
  assert.ok(q(h).pigs.distracted >= 1);
  assert.ok(hints(h).includes(TEXT.hint.pigsEat));
  assert.ok(h.run(45, { until: () => h.log('pig:done').length >= 1 }), 'acabou a distração');
  assert.ok(h.run(2, { until: (i) => i.quintal.pigs.distracted === 0 }), 'voltou a atrapalhar');
  assert.ok(hints(h).includes(TEXT.hint.pigsBack));
  // reinício: todos de volta ao chiqueiro, porteira fechada
  h.events.emit('ui:restart', {});
  h.run(0.2);
  assert.deepEqual([q(h).pigs.inPen, q(h).pigs.open, q(h).shed.sty], [3, false, false]);
}, { sweep: 120 });

seededTest('fase 10: com algo na boca a Radhija não sobe a rampa nem pega a vela (a boca já está ocupada)', 1, async () => {
  const h = await game('botao=1');
  h.run(0.3);
  puz(h).debugSet('gate');
  puz(h).debugSet('shed');
  puz(h).debugSet('water');
  puz(h).debugSet('power');
  assert.ok(h.run(5, { until: (i) => i.quintal.boat.docked }));
  as(h, 'radhija');
  put(h, 'radhija', L.BOAT.dock.x + 0.65, L.BOAT.dock.z, -Math.PI / 2);
  h.tap('KeyE');
  assert.equal(h.info().hat.holder, 'radhija', 'com o chapéu na boca');
  h.run(1.0);
  put(h, 'radhija', 9.85, L.RAMP.z, Math.PI / 2);
  h.clearLog();
  h.tap('ShiftLeft');
  h.run(1.5);
  assert.equal(q(h).ramp, null, 'nem sobe a rampa');
  assert.equal(q(h).place.candle, 'home', 'a vela continua lá em cima');
  assert.equal(h.info().candle.holder, null);
  assert.equal(h.info().hat.holder, 'radhija', 'o chapéu continua na boca');
  assert.ok(hints(h).includes(TEXT.hint.mouthFull));
  // larga o chapéu: aí sobe e pega a vela
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(h.info().hat.holder, null);
  put(h, 'radhija', 9.85, L.RAMP.z, Math.PI / 2);
  h.run(1.0);
  h.tap('ShiftLeft');
  assert.ok(h.run(4, { until: (i) => i.candle.holder === 'radhija' && !i.quintal.ramp }), 'com a boca livre, pegou a vela');
});

seededTest('fase 10: a tábua solta do muro só cede quando está pronta; lá dentro, o quadro (sem texto)', 1, async () => {
  const h = await game();
  h.run(0.3);
  const boardZ = (L.SECRET.board.z0 + L.SECRET.board.z1) / 2;
  // fechada: o muro segura e não há o que fazer ali
  put(h, 'radhija', L.EAST_WALL.x - 0.35, boardZ, Math.PI / 2);
  assert.notEqual(h.info().prompt, TEXT.prompt.board);
  h.hold([1, 0]);
  h.run(0.8);
  h.hold(null);
  assert.ok(h.ctrls.radhija.x < L.EAST_WALL.x, 'o muro segura');
  assert.equal(q(h).secret.ready, false);
  // pronta (atalho de depuração): E empurra a tábua e ela passa
  puz(h).debugSet('secret');
  put(h, 'radhija', L.EAST_WALL.x - 0.35, boardZ, Math.PI / 2);
  assert.equal(h.info().prompt, TEXT.prompt.board);
  h.clearLog();
  h.tap('KeyE');
  assert.equal(q(h).secret.open, true);
  assert.equal(h.log('secret:board').length, 1);
  h.run(0.9);
  h.walkTo(L.SECRET.photo.x - 0.6, L.SECRET.photo.z, { tol: 0.12 });
  assert.ok(h.run(1, { until: (i) => i.quintal.secret.seen }), 'lá dentro, o quadro');
  assert.equal(h.log('secret:photo').length, 1);
  assert.equal(h.log('hint').length, 0, 'nenhum texto na tela');
});

seededTest('fase 10: fora de ordem duas vezes, a dica muda; o quadro de perto; o enfeite volta do chão', 1, async () => {
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

seededTest('fase 10: etapas ?stage=, pausa congela a água, reinício e stage=done', 1, async () => {
  const h = await game();
  h.run(0.3);
  const order = ['ribbon', 'cookie', 'candle', 'hat'];
  for (const [i, st] of ['cake1', 'cake2', 'cake3', 'cake4'].entries()) {
    assert.ok(h.game.debug.setStage(st), st);
    assert.equal(h.info().stage, st);
    assert.deepEqual(q(h).cake, order.slice(0, i + 1));
  }
  assert.deepEqual(h.props.cake.placed, order);
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
  assert.deepEqual(s.place, { hat: 'home', ribbon: 'home', candle: 'home', cookie: 'home', star: 'home' });
  assert.deepEqual([s.shed.open, s.shed.sty, s.stairs, s.pinata.hits, s.pinata.stage, s.secret.ready], [false, false, false, 0, 'tree', false]);
  assert.ok(s.crates.every((k) => k.x === CR.x0 && !k.locked), 'os caixotes voltam para o começo do trilho');
  assert.ok(Math.abs(s.crate.x - L.CRATE.start.x) < 1e-3 && Math.abs(s.crate.z - L.CRATE.start.z) < 1e-3);
  h.game.debug.setStage('done');
  assert.ok(h.run(10, { until: (st) => st.state === 'victory' }), 'stage=done termina a fase');
});

// Varredura de sementes: roda cada teste que depende do sorteio com muitas sementes (sweep: porquinhos 120, galinhas
// 100, botão da porta 40; a partir de FASE10_SEMENTES_DE, padrão 1) e lista o que falhar. Desligada por padrão (leva uns
// 4 min): para investigar um teste instável no CI, ligue com FASE10_SEMENTES=1 no passo de testes (ou troque o `skip`
// por false num commit temporário). Cada partida headless deixa ouvintes globais: mais de ~350 num processo só estoura
// a memória do CI.
test('fase 10: varredura de sementes dos testes que dependem do sorteio', { skip: !process.env.FASE10_SEMENTES }, async () => {
  const from = Number(process.env.FASE10_SEMENTES_DE) || 1;
  /** @type {Record<string, string[]>} */
  const bad = {};
  for (const { name, fn, sweep } of SEEDED) {
    for (let seed = from; seed < from + sweep; seed++) {
      try {
        await withSeedAsync(seed, fn);
      } catch (err) {
        (bad[name.slice(0, 60)] ||= []).push(`${seed}: ${String(err.message).replace(/\s+/g, ' ').slice(0, 220)}`);
      }
    }
  }
  const summary = Object.fromEntries(Object.entries(bad).map(([k, v]) => [k, { falhas: v.length, primeiras: v.slice(0, 4) }]));
  assert.deepEqual(summary, {});
});
