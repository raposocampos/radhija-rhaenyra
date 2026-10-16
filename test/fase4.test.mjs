// Fase 4 (Operação Patinho): o terraço do superbafo, jogado no jogo headless com teclas simuladas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import fase4 from '../src/levels/fase4/index.js';

const L = fase4.layout;
const P = L.NAP_PIGEON;

/** Radhija para na frente do vão das floreiras (lado oeste), olha para o pombo e sopra. */
function blowAtNapPigeon(h) {
  h.walkPath([[-4.0, 0.2], [-3.75, P.z, { tol: 0.1 }]]);
  h.hold([1, 0]);
  h.run(0.15);
  h.hold(null);
  h.keyDown('KeyR');
  h.run(0.4);
  h.keyUp('KeyR');
  h.run(0.1);
}

/** Rhaenyra empurra o ventilador para o sul até o encaixe (z = alignZ). */
function alignFan(h) {
  h.walkPath([[-2.1, -0.6], [L.FAN.start.x - 0.05, L.FAN.start.z - L.FAN.half - 0.3, { tol: 0.08 }]]);
  h.hold([0, 1], ['ShiftLeft']);
  h.run(8, { until: (s) => s.fan.z > L.FAN.alignZ - 0.12 });
  h.hold(null);
  h.run(0.4);
}

/** Radhija entra no corredor por baixo dos canos e sopra para o leste. */
function blowInCorridor(h) {
  const doorX = (L.CORRIDOR.door.x0 + L.CORRIDOR.door.x1) / 2;
  h.walkPath([[doorX, 1.3], [doorX, L.CORRIDOR.z, { tol: 0.12 }]]);
  h.hold([1, 0]);
  h.run(0.2);
  h.keyDown('KeyR');
  h.run(0.4);
  h.keyUp('KeyR');
  h.hold(null);
  h.run(0.1);
}

test('fase 4: partida completa (pombo da passagem → ventilador → corredor → duto → portão → patinho → capacho)', async () => {
  const h = await createHeadlessGame({ level: 4 });
  let i = h.info();
  assert.equal(i.levelId, 'fase4');
  assert.equal(i.objective, 'Acorde o pombo da passagem com um superbafo (segure R e solte)');
  assert.equal(i.nap, 'asleep');

  // O pombo bloqueia a passagem; latir não adianta.
  h.walkPath([[-4.0, 0.2], [-3.6, P.z]]);
  h.hold([1, 0]);
  h.run(0.8);
  h.hold(null);
  assert.ok(h.ctrls.radhija.x < L.PLANTERS.x - L.PLANTERS.half, 'não atravessa o pombo');
  h.tap('KeyE'); // nada para interagir: late
  assert.ok(h.log('hint').some((x) => x.text.startsWith('O pombo nem liga para latido')));
  assert.equal(h.info().nap, 'asleep');

  // Superbafo direto: ele voa para a caixa d'água e a passagem abre.
  blowAtNapPigeon(h);
  assert.equal(h.log('dog:bafo').length, 1);
  assert.ok(h.run(3, { until: (s) => s.nap !== 'asleep' }), 'o pombo sentiu o cheiro');
  assert.equal(h.info().stage, 'passOpen');
  assert.ok(h.run(3, { until: (s) => s.nap === 'roof' }), 'pousou na caixa d\'água');
  assert.equal(h.info().objective, 'O ventilador é pesado: troque para a Rhaenyra (Q)');

  // Rhaenyra empurra o ventilador até a marca (a Radhija atravessa a passagem com ela).
  h.walkTo(-2.1, P.z);
  h.tap('KeyQ');
  h.walkPath([[-3.6, P.z], [-2.2, P.z]]);
  alignFan(h);
  i = h.info();
  assert.ok(i.fan.aligned, `ventilador encaixado (z=${i.fan.z})`);
  assert.equal(h.log('fan:aligned').length, 1);
  assert.equal(i.objective, 'Agora a Radhija (Q): só ela passa por baixo dos canos');

  // Radhija sopra no vento; o duto leva o cheiro até o pombo do portão.
  h.tap('KeyQ');
  blowInCorridor(h);
  assert.equal(h.log('dog:bafo').length, 2);
  assert.ok(h.run(4, { until: () => h.log('scent:duct').length > 0 }), 'o vento levou a nuvem para o duto');
  assert.ok(h.run(3, { until: () => h.log('scent:exit').length > 0 }), 'a nuvem saiu do outro lado');
  assert.ok(h.run(3, { until: (s) => s.pigeon === 'flying' }), 'o pombo do portão voou');
  assert.ok(h.run(3, { until: (s) => s.stage === 'gateOpen' }), 'pousou na placa: portão aberto');
  i = h.info();
  assert.ok(i.gate.locked && i.pigeon === 'B');
  assert.ok(h.log('item:revealed').some((p) => p.item === 'duck'));

  // Radhija sai do corredor, atravessa o portão e pega o patinho.
  const doorX = (L.CORRIDOR.door.x0 + L.CORRIDOR.door.x1) / 2;
  h.walkPath([[doorX, 1.3], [1.75, 0.0], [3.1, 0.0], [L.DUCK.x - 0.62, L.DUCK.z - 0.1, { tol: 0.15 }]]);
  h.hold([1, 0]);
  h.run(0.12);
  h.hold(null);
  assert.equal(h.info().prompt, 'Pegar o patinho');
  h.tap('KeyE');
  i = h.info();
  assert.equal(i.carrier, 'radhija');
  assert.equal(i.stage, 'carrying');
  assert.equal(i.objective, 'Leve o patinho para o capacho da escada');
  assert.ok(h.log('item:pickup').some((p) => p.item === 'duck'));

  // De volta pelo portão e pela passagem até o capacho.
  h.walkPath([[3.1, 0.0], [1.75, 0.0], [-0.3, -0.5], [-2.05, -0.75], [-2.2, P.z], [-3.5, P.z], [-4.0, 0.0], [L.GOAL.x, L.GOAL.z + 0.2]]);
  assert.ok(h.run(6, { until: (s) => s.state === 'victory' }), 'vitória');
  const vic = h.log('victory');
  assert.equal(vic[0].levelId, 'fase4');

  h.events.emit('ui:restart', {});
  h.run(0.3);
  i = h.info();
  assert.ok(i.stage === 'start' && i.nap === 'asleep' && !i.gate.locked && !i.carrier && !i.fan.aligned);
});

test('fase 4: a Rhaenyra não tem superbafo; o pombo da passagem continua dormindo', async () => {
  const h = await createHeadlessGame({ level: 4, query: 'dog=rhaenyra' });
  assert.equal(h.info().objective, 'Só a Radhija tem o superbafo: troque para ela (Q)');
  h.walkPath([[-4.0, 0.2], [-3.75, P.z, { tol: 0.12 }]]);
  h.keyDown('KeyR');
  h.run(0.4);
  h.keyUp('KeyR');
  h.run(1.5);
  assert.equal(h.log('dog:bafo').length, 0);
  assert.equal(h.info().nap, 'asleep');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Só a Radhija tem o superbafo')));
});

test('fase 4: sem o ventilador alinhado, o cheiro fica no corredor (dica) e o pombo do portão não sai', async () => {
  const h = await createHeadlessGame({ level: 4, query: 'stage=passOpen' });
  blowInCorridor(h);
  h.run(3);
  assert.equal(h.log('scent:duct').length, 0, 'sem vento o duto não puxa');
  assert.equal(h.info().pigeon, 'A');
  assert.ok(h.log('hint').some((x) => x.text === 'Sem vento, o cheiro não vai longe…'));
});

test('fase 4: a Radhija não move o ventilador; a Rhaenyra não passa por baixo dos canos', async () => {
  const h = await createHeadlessGame({ level: 4, query: 'stage=passOpen' });
  h.walkTo(L.FAN.start.x - 0.05, L.FAN.start.z - L.FAN.half - 0.25, { tol: 0.08 });
  h.hold([0, 1], ['ShiftLeft']);
  h.run(1.0);
  h.hold(null);
  assert.ok(Math.abs(h.info().fan.z - L.FAN.start.z) < 0.01, 'o ventilador não andou');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Pesado demais para a Radhija')));
  h.tap('KeyQ');
  const doorX = (L.CORRIDOR.door.x0 + L.CORRIDOR.door.x1) / 2;
  h.walkTo(doorX, 1.3);
  h.hold([0, 1]);
  h.run(1.2);
  h.hold(null);
  assert.ok(h.ctrls.rhaenyra.z < L.CORRIDOR.z - L.CORRIDOR.half - L.AC_UNITS.depth + 0.05, 'parou antes dos canos');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('A Rhaenyra não passa por baixo dos canos')));
});

test('fase 4: a companheira espera do lado certo da passagem e do portão', async () => {
  let h = await createHeadlessGame({ level: 4 });
  // pombo ainda dormindo: a Rhaenyra não tem caminho para o leste
  const N = L.NAV_NODES;
  const radius = L.DOGS.rhaenyra.radius;
  const find = (hh, a, b) => {
    hh.world.setCompanionMode(true);
    try { return hh.nav.findPath(a, b, { size: 'large', r: radius, flags: hh.puzzle.navFlags() }); } finally { hh.world.setCompanionMode(false); }
  };
  let p = find(h, N.A_mid, N.B_mid);
  assert.ok(!p.reachable && p.waitNode === 'A_pass', 'espera na frente da passagem');
  h = await createHeadlessGame({ level: 4, query: 'stage=passOpen' });
  assert.ok(find(h, N.A_mid, N.B_mid).reachable, 'pombo foi embora: passa');
  p = find(h, N.B_mid, N.E_duck);
  assert.ok(!p.reachable && p.waitNode === 'B_gate', 'portão fechado: espera junto ao portão');
  h = await createHeadlessGame({ level: 4, query: 'stage=gateOpen' });
  assert.ok(find(h, N.B_mid, N.E_duck).reachable, 'portão aberto: chega ao patinho');
});

test('fase 4: ?stage= pula para cada etapa', async () => {
  for (const s of ['passOpen', 'gateOpen', 'carrying']) {
    const h = await createHeadlessGame({ level: 4, query: `stage=${s}` });
    assert.equal(h.info().stage, s);
  }
});
