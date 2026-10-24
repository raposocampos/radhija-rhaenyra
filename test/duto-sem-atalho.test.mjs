// O cheiro não fura o caminho do duto. Retorno do usuário (2026-10-24, no PC e no celular), fase 4: "Na parte do duto,
// se você encosta e usa o superbafo, acaba atravessando e atingindo o pombo, sem precisar fazer a mecânica do
// ventilador."
// Causa: a nuvem nascia na boca da Radhija, 0,36 m à frente do centro dela. Com o focinho encostado na caixa do duto
// (ou na mureta, no portão, nos aparelhos), a boca ficava dentro do colisor, e a colisão da nuvem a empurrava para o
// lado mais perto, às vezes o de lá: do outro lado da mureta, ao lado do poleiro, onde o pombo cheirava pela distância
// no chão. Agora a nuvem vai do centro da Radhija até a boca sem atravessar nada (src/game/mechanics/scent.js,
// birthPlace), a boca do duto só engole o que está na frente dela (inlet.dirX/dirZ) e o pombo do portão (fase 4 e
// Arena do Bafo) só aceita a nuvem que veio pelo duto, como o pombo da fase 10 e o Bichano da fase 9.
// Os casos com semente sorteiam o lugar e o rumo da Radhija encostada (sempre os mesmos em qualquer máquina).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScentField } from '../src/game/mechanics/scent.js';
import { createCollisionWorld } from '../src/game/collision.js';
import { LEVELS } from '../src/levels/index.js';
import fase4 from '../src/levels/fase4/index.js';
import bafo from '../src/levels/_bafo/index.js';
import { createHeadlessGame } from './helpers/headless.mjs';
import { mulberry32, withSeedAsync } from './helpers/seeded.mjs';

const DT = 1 / 60;
const COLLIDE_R = 0.12; // raio de colisão da nuvem (scent.js)
const HIGH = 0.8; // acima disso, a nuvem saiu de um duto lá em cima (scent.js)
const openWorld = (colliders = []) => createCollisionWorld({ WORLD: { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } }, STATIC_COLLIDERS: colliders });
const runField = (f, secs) => { for (let t = 0; t < secs; t += DT) f.update(DT); };
const r3 = (v) => +v.toFixed(3);

// ------------------------------------------------------------------------------------------------ o campo de cheiro

test('cheiro: com o focinho encostado numa parede, a nuvem nasce do lado de quem soprou (e a mira mostra o mesmo)', () => {
  const wall = { id: 'mureta', shape: 'box', x: 1, z: 0, hx: 0.1, hz: 3 };
  const f = createScentField({ world: openWorld([wall]) });
  const face = wall.x - wall.hx;
  // a Radhija encostada (centro a 0,2 m da face) e a boca 0,36 m à frente: depois do meio da mureta
  const shot = { x: face - 0.2 + 0.36, z: 0.4, fromX: face - 0.2, fromZ: 0.4, dirX: 1, dirZ: 0, speed: 2.6 };
  const c = f.spawn(shot);
  assert.ok(c.x <= face - COLLIDE_R + 1e-6, `nasce do lado dela, encostada na mureta (x=${r3(c.x)})`);
  runField(f, 3);
  assert.ok(c.x < face, `e não passa para o outro lado (x=${r3(c.x)})`);
  const p = f.preview(shot, { secs: 2 });
  assert.ok(p.points.every((q) => q.x < face), `a mira também fica do lado dela: ${JSON.stringify(p.points.map((q) => r3(q.x)))}`);
  // de lado, com a boca dentro da ponta da mureta: também fica do lado dela
  const side = f.spawn({ x: 1.0, z: -3.05, fromX: 1.0, fromZ: -3.36, dirX: 0, dirZ: 1 });
  assert.ok(side.z <= wall.z - wall.hz - COLLIDE_R + 1e-6, `de frente para a ponta (z=${r3(side.z)})`);
  // longe da parede, nasce na boca, como sempre
  const free = f.spawn({ x: -2 + 0.36, z: 2, fromX: -2, fromZ: 2, dirX: 1, dirZ: 0 });
  assert.ok(Math.abs(free.x - (-2 + 0.36)) < 1e-9 && Math.abs(free.z - 2) < 1e-9, 'sem nada no caminho, na boca');
  // sem a origem (as fases que soltam uma nuvem num lugar certo), também como antes
  const placed = f.spawn({ x: -3, z: -2, speed: 0 });
  assert.equal(placed.x, -3);
});

test('cheiro: o obstáculo baixo embaixo de quem sopra não segura a nuvem (nasce na boca, como antes)', () => {
  const log = { id: 'tronco', shape: 'box', x: 0, z: 0, hx: 0.3, hz: 0.3, jumpable: true, height: 0.2 };
  const f = createScentField({ world: openWorld([log]) });
  const c = f.spawn({ x: 0.36, z: 0, fromX: 0, fromZ: 0, dirX: 1, dirZ: 0, speed: 0 });
  assert.ok(Math.abs(c.x - 0.36) < 1e-9, `em cima do tronco, a nuvem sai na boca (x=${r3(c.x)})`);
});

test('cheiro: a boca do duto virada para um lado só engole a nuvem que está na frente dela', () => {
  const events = [];
  const f = createScentField({ world: openWorld(), emit: (n, p) => events.push([n, p]) });
  f.addDuct({ id: 'duto', inlet: { x: 0, z: 0, r: 0.4, dirX: -1, dirZ: 0 }, outlet: { x: 5, z: 5, dirX: 1, dirZ: 0 }, travel: 1 });
  const behind = f.spawn({ x: 0.25, z: 0.1, speed: 0 }); // atrás da boca: do lado de dentro da caixa e da parede
  f.update(DT);
  assert.equal(behind.state, 'free', 'a nuvem atrás da boca não entra');
  const front = f.spawn({ x: -0.25, z: 0.1, speed: 0 });
  f.update(DT);
  assert.equal(front.state, 'duct', 'a da frente, sim');
  assert.equal(events.filter(([n]) => n === 'scent:duct').length, 1);
  // sem direção (um funil no chão, fase 10), entra de qualquer lado, como antes
  f.addDuct({ id: 'funil', inlet: { x: 4, z: -4, r: 0.4 }, outlet: { x: 5, z: 5, dirX: 1, dirZ: 0 }, travel: 1 });
  const around = f.spawn({ x: 4.25, z: -4, speed: 0 });
  f.update(DT);
  assert.equal(around.state, 'duct', 'o funil engole de qualquer lado');
});

// ------------------------------------------------------------------------------------------------ jogo headless

/**
 * A Radhija ativa em (x, z), olhando para `yaw` (a frente dela é (sin, cos) no chão), encostada no que estiver ali (o
 * corpo se ajeita contra a parede) e solta o superbafo (segura R e solta, sem mexer o analógico).
 */
function pressAndBlow(h, x, z, yaw) {
  const before = h.log('dog:bafo').length;
  h.teleport('radhija', x, z, yaw);
  h.run(0.25);
  h.keyDown('KeyR');
  h.run(0.25);
  h.keyUp('KeyR');
  h.step();
  const at = { x: r3(h.ctrls.radhija.x), z: r3(h.ctrls.radhija.z), yaw: r3(h.ctrls.radhija.yaw) };
  assert.equal(h.log('dog:bafo').length, before + 1, `soprou em ${JSON.stringify(at)}`);
  return at;
}

/** Roda `secs` segundos olhando as nuvens do chão: a primeira em que `bad(nuvem)` dá verdadeiro (ou null). */
function watch(h, secs, bad) {
  const n = Math.round(secs / DT);
  let found = null;
  for (let i = 0; i < n; i++) {
    h.step();
    for (const c of h.game.debug.scent.clouds) {
      if (!found && c.state === 'free' && c.y < HIGH && bad(c)) found = { x: r3(c.x), z: r3(c.z), age: r3(c.age) };
    }
  }
  return found;
}

/**
 * Entre um sopro e outro: tira as nuvens (natural: espera elas sumirem, como quem joga) e espera a recarga do
 * superbafo, que já passou na olhada de `watch`.
 */
function clearScent(h, { natural = false } = {}) {
  if (natural) h.run(6, { until: () => h.game.debug.scent.clouds.length === 0 });
  else h.game.debug.scent.reset();
  h.run(0.2);
}

/** Sorteios de um caso: `n` amostras de `make(rng)`, com a semente `seed`. */
function samples(seed, n, make) {
  const rng = mulberry32(seed);
  const span = (a, b) => a + (b - a) * rng();
  return Array.from({ length: n }, () => make(span));
}

// ---------------------------------------------------------------- fase 4

const L4 = fase4.layout;
const WALL_FACE = L4.WALL.x - L4.WALL.half; // a face oeste da mureta B|C (o lado das dogs antes do portão abrir)
const BOX4 = L4.STATIC_COLLIDERS.find((c) => c.id === 'duto-boca');
const AC4 = L4.STATIC_COLLIDERS.find((c) => c.id === 'aparelhos-leste');
const SOUTH4 = L4.STATIC_COLLIDERS.find((c) => c.id === 'corredor-sul');
const EAST = Math.PI / 2;
const fase4Game = (query = 'stage=passOpen') => createHeadlessGame({ level: LEVELS.indexOf(fase4) + 1, query });
const inCorridor4 = (c) => c.x > L4.CORRIDOR.x0 && c.x < L4.CORRIDOR.x1 && Math.abs(c.z - L4.CORRIDOR.z) < L4.CORRIDOR.half;
/** O ventilador: 'start' (no começo do trilho), 'fora' (no meio do caminho, fora da marca) ou 'marca' (encaixado). */
function setFan(h, where) {
  const z = where === 'marca' ? L4.FAN.alignZ : where === 'fora' ? 1.6 : L4.FAN.start.z;
  h.puzzle.mech.fan.setPos(L4.FAN.start.x, z);
  h.run(0.1);
  assert.equal(h.info().fan.aligned, where === 'marca', `ventilador ${where}`);
  h.run(1.2); // o plano da câmera do encaixe
}
/** Depois de um sopro errado: nada de nuvem passando da mureta, nada no duto, e o pombo do portão no poleiro A. */
function assertNoShortcut(h, label, { bad = (c) => c.x > WALL_FACE, secs = 4 } = {}) {
  const ducts = h.log('scent:duct').length;
  const smells = h.log('scent:smell').filter((s) => s.id === 'pombo').length;
  const leak = watch(h, secs, bad);
  assert.equal(leak, null, `${label}: a nuvem passou para o outro lado ${JSON.stringify(leak)}`);
  assert.equal(h.log('scent:duct').length, ducts, `${label}: a nuvem entrou no duto sem passar pela boca`);
  assert.equal(h.log('scent:smell').filter((s) => s.id === 'pombo').length, smells, `${label}: o pombo do portão sentiu o cheiro`);
  assert.equal(h.info().pigeon, 'A', `${label}: o pombo do portão saiu do poleiro A`);
  assert.equal(h.info().stage, 'passOpen', label);
}

test('fase 4: encostada na boca do duto, de frente e de lado, sem o ventilador na marca, o cheiro não atravessa', () => withSeedAsync(404, async () => {
  const h = await fase4Game();
  assert.equal(h.info().activeDog, 'radhija');
  // o relato do usuário: de frente para a caixa do duto, no meio do corredor
  const cases = [{ z: 2.27, yaw: EAST }, ...samples(41, 10, (s) => ({ z: s(2.18, 2.36), yaw: EAST + s(-0.5, 0.5) }))];
  for (const fan of ['start', 'fora']) {
    setFan(h, fan);
    for (const k of cases) {
      const at = pressAndBlow(h, BOX4.x - BOX4.hx - 0.15, k.z, k.yaw);
      assertNoShortcut(h, `ventilador ${fan}, encostada no duto ${JSON.stringify(at)}`);
      clearScent(h);
    }
  }
}));

test('fase 4: encostada na mureta e no portão, antes do portão abrir, o cheiro não passa para o lado do pombo', () => withSeedAsync(405, async () => {
  const h = await fase4Game();
  const x = WALL_FACE - 0.15;
  const cases = [
    { z: 3.2, yaw: EAST }, { z: 1.0, yaw: EAST }, { z: 0, yaw: EAST }, // de frente: atrás do duto, ao norte e no portão
    ...samples(42, 6, (s) => ({ z: s(2.9, 3.6), yaw: EAST + s(-0.6, 0.6) })), // ao sul do corredor, atrás do duto
    ...samples(43, 4, (s) => ({ z: s(0.75, 1.4), yaw: EAST + s(-0.6, 0.6) })), // entre o portão e os aparelhos
    ...samples(44, 4, (s) => ({ z: s(-0.45, 0.45), yaw: EAST + s(-0.6, 0.6) })), // no portão fechado
  ];
  for (const fan of ['start', 'marca']) {
    setFan(h, fan);
    for (const k of cases) {
      const at = pressAndBlow(h, x, k.z, k.yaw);
      assertNoShortcut(h, `ventilador ${fan}, encostada na mureta ${JSON.stringify(at)}`);
      clearScent(h);
    }
  }
}));

test('fase 4: pela lateral do corredor (aparelhos e mureta baixa), mesmo com o ventilador na marca, o cheiro não entra', () => withSeedAsync(406, async () => {
  const h = await fase4Game();
  setFan(h, 'marca');
  const north = AC4.z - AC4.hz - 0.15; // do lado de cá dos aparelhos (norte), olhando para o sul
  const south = SOUTH4.z + SOUTH4.hz + 0.15; // atrás da mureta baixa (sul), olhando para o norte
  const cases = [
    { x: 2.0, z: north, yaw: 0 }, { x: 2.0, z: south, yaw: Math.PI }, { x: 1.3, z: south, yaw: Math.PI },
    ...samples(45, 5, (s) => ({ x: s(1.05, 2.1), z: north, yaw: s(-0.6, 0.6) })),
    ...samples(46, 3, (s) => ({ x: s(-0.45, 0.35), z: north, yaw: s(-0.6, 0.6) })),
    ...samples(47, 8, (s) => ({ x: s(-0.4, 2.1), z: south, yaw: Math.PI + s(-0.6, 0.6) })),
  ];
  for (const k of cases) {
    const at = pressAndBlow(h, k.x, k.z, k.yaw);
    assertNoShortcut(h, `encostada do lado de fora do corredor ${JSON.stringify(at)}`, { bad: (c) => inCorridor4(c) || c.x > WALL_FACE });
    clearScent(h);
  }
}));

test('fase 4: o caminho certo continua funcionando (ventilador na marca, a Radhija no corredor, até encostada no duto)', () => withSeedAsync(407, async () => {
  const cases = [
    { x: 0.7, z: 2.27, yaw: EAST }, // como na partida completa
    { x: BOX4.x - BOX4.hx - 0.15, z: 2.27, yaw: EAST }, // encostada na boca do duto: sopra dentro dela
    ...samples(48, 4, (s) => ({ x: s(0.2, 1.5), z: s(2.2, 2.34), yaw: EAST + s(-0.8, 0.8) })),
    ...samples(49, 2, (s) => ({ x: BOX4.x - BOX4.hx - 0.15, z: s(2.18, 2.36), yaw: EAST + s(-0.5, 0.5) })),
  ];
  for (const k of cases) {
    const h = await fase4Game();
    setFan(h, 'marca');
    const at = pressAndBlow(h, k.x, k.z, k.yaw);
    const label = `no corredor ${JSON.stringify(at)}`;
    assert.ok(h.run(4, { until: () => h.log('scent:duct').length > 0 }), `${label}: o vento levou a nuvem para o duto`);
    assert.ok(h.run(4, { until: (s) => s.pigeon !== 'A' }), `${label}: o pombo do portão voou`);
    assert.ok(h.run(4, { until: (s) => s.stage === 'gateOpen' }), `${label}: pousou na placa e o portão abriu`);
  }
}));

test('fase 4: dá para refazer depois de errar (encostada no duto, ventilador fora da marca, de fora do corredor)', () => withSeedAsync(408, async () => {
  const h = await fase4Game();
  // 1) encostada na boca do duto, com o ventilador no começo do trilho
  pressAndBlow(h, BOX4.x - BOX4.hx - 0.15, 2.27, EAST);
  assertNoShortcut(h, 'sem ventilador');
  assert.ok(h.log('hint').some((x) => x.text === 'Sem vento, o cheiro não vai longe…'), 'a dica do vento');
  clearScent(h, { natural: true });
  // 2) o ventilador no meio do trilho, fora da marca: no corredor, também não vai
  setFan(h, 'fora');
  pressAndBlow(h, 0.7, 2.27, EAST);
  assertNoShortcut(h, 'ventilador fora da marca');
  clearScent(h, { natural: true });
  // 3) na marca, mas soprando de fora do corredor: atrás da mureta baixa e na mureta do portão
  setFan(h, 'marca');
  pressAndBlow(h, 1.6, SOUTH4.z + SOUTH4.hz + 0.15, Math.PI);
  assertNoShortcut(h, 'de fora do corredor', { bad: (c) => inCorridor4(c) || c.x > WALL_FACE });
  clearScent(h, { natural: true });
  pressAndBlow(h, WALL_FACE - 0.15, 3.2, EAST);
  assertNoShortcut(h, 'na mureta');
  clearScent(h, { natural: true });
  // 4) e agora certo: no corredor, no vento
  pressAndBlow(h, 0.7, 2.27, EAST);
  assert.ok(h.run(4, { until: () => h.log('scent:duct').length > 0 }), 'o vento levou a nuvem para o duto');
  assert.ok(h.run(4, { until: (s) => s.stage === 'gateOpen' }), 'o pombo voou para a placa e o portão abriu');
}));

test('fase 4: a nuvem do chão perto do poleiro não conta; o pombo do portão só sai com o cheiro do duto', () => withSeedAsync(409, async () => {
  const h = await fase4Game();
  // uma nuvem no chão, bem embaixo do poleiro (como as que atravessavam): só a dica
  h.game.debug.scent.spawn({ x: L4.PERCH_A.x - 0.3, z: L4.PERCH_A.z, speed: 0 });
  h.run(2);
  assert.equal(h.info().pigeon, 'A', 'a nuvem do chão não alcança o pombo lá em cima');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('O pombo do portão está alto demais')), 'a dica do duto');
  clearScent(h, { natural: true });
  setFan(h, 'marca');
  pressAndBlow(h, 0.7, 2.27, EAST);
  assert.ok(h.run(6, { until: (s) => s.pigeon !== 'A' }), 'pelo duto, voa');
}));

// ---------------------------------------------------------------- Arena do Bafo (mesmo puzzle, com a saída baixa)

const LB = bafo.layout;
const levelsB = [...LEVELS, bafo];
const arena = () => createHeadlessGame({ level: levelsB.length, levels: levelsB });
const BOXB = LB.STATIC_COLLIDERS.find((c) => c.id === 'duto-boca');
const WALLB = LB.WALL.x - LB.WALL.half;

test('Arena do Bafo: encostada no duto ou na mureta, sem o ventilador, o cheiro não fura; na marca, pelo duto, sim', () => withSeedAsync(410, async () => {
  const h = await arena();
  assert.equal(h.info().activeDog, 'radhija');
  const box = [{ z: 2.4, yaw: EAST }, ...samples(51, 6, (s) => ({ z: s(2.32, 2.48), yaw: EAST + s(-0.5, 0.5) }))];
  const wall = [{ z: 3.3, yaw: EAST }, ...samples(52, 4, (s) => ({ z: s(2.95, 3.7), yaw: EAST + s(-0.6, 0.6) })), ...samples(53, 3, (s) => ({ z: s(0.75, 1.8), yaw: EAST + s(-0.6, 0.6) }))];
  const spots = [...box.map((k) => ({ ...k, x: BOXB.x - BOXB.hx - 0.15 })), ...wall.map((k) => ({ ...k, x: WALLB - 0.15 }))];
  for (const k of spots) {
    const at = pressAndBlow(h, k.x, k.z, k.yaw);
    const leak = watch(h, 4, (c) => c.x > WALLB);
    assert.equal(leak, null, `encostada ${JSON.stringify(at)}: a nuvem passou da mureta ${JSON.stringify(leak)}`);
    assert.equal(h.info().pigeon, 'A', `encostada ${JSON.stringify(at)}: o pombo saiu`);
    clearScent(h);
  }
  // o caminho certo: ventilador na marca e o sopro encostado na boca do duto
  h.puzzle.mech.fan.setPos(LB.FAN.start.x, LB.FAN.alignZ);
  h.run(0.2);
  assert.ok(h.info().fan.aligned, 'ventilador na marca');
  pressAndBlow(h, BOXB.x - BOXB.hx - 0.15, 2.4, EAST);
  assert.ok(h.run(4, { until: () => h.log('scent:duct').length > 0 }), 'a nuvem entrou no duto');
  assert.ok(h.run(4, { until: (s) => s.pigeon !== 'A' }), 'o pombo voou');
}));
