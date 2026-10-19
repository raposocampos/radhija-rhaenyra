// Fase 5 (Operação Ursinho): dentro de casa com o pulo da Rhaenyra, jogado no jogo headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import fase5 from '../src/levels/fase5/index.js';

const L = fase5.layout;
const N = L.NAV_NODES;
const B = L.BOX_PILLOWS;

/** Anda até (x, z), vira para (dx, dz) e pula. */
function jumpFrom(h, x, z, dx, dz) {
  h.walkTo(x, z, { tol: 0.08 });
  h.hold([dx, dz]);
  h.run(0.12);
  h.tap('Space');
  h.run(0.55);
  h.hold(null);
  h.run(0.2);
}

/** Rhaenyra pula o portãozinho e abre a trava. */
function openPetGate(h) {
  jumpFrom(h, L.WALL_SH.x - 0.62, 0.4, 1, 0);
  assert.ok(h.ctrls.rhaenyra.x > L.WALL_SH.x, `pulou o portãozinho (x=${h.ctrls.rhaenyra.x.toFixed(2)})`);
  h.walkTo(L.LATCH.x + 0.32, L.LATCH.z + 0.1, { tol: 0.1 });
  h.hold([-1, -0.2]);
  h.run(0.15);
  h.hold(null);
  assert.equal(h.info().prompt, 'Abrir a trava');
  h.tap('KeyE');
  assert.ok(h.run(2, { until: (s) => s.stage === 'gateOpen' }), 'a trava abriu o portãozinho');
}

/** Rhaenyra pula a barricada e empurra a caixa de almofadas de dentro da cozinha. */
function clearBarricade(h) {
  jumpFrom(h, B.start.x - B.half - 0.36, B.start.z, 1, 0);
  assert.ok(h.ctrls.rhaenyra.x > B.start.x + B.half, `pulou para a cozinha (x=${h.ctrls.rhaenyra.x.toFixed(2)})`);
  h.walkTo(B.start.x + B.half + 0.3, B.start.z, { tol: 0.08 });
  h.hold([-1, 0], ['ShiftLeft']);
  assert.ok(h.run(5, { until: (s) => s.stage === 'boxClear' }), 'a caixa desmontou');
  h.hold(null);
  h.run(0.6);
}

test('fase 5: partida completa (portãozinho → trava → barricada → caixa desmonta → ursinho → caminha)', async () => {
  const h = await createHeadlessGame({ level: 5 });
  let i = h.info();
  assert.equal(i.levelId, 'fase5');
  assert.equal(i.objective, 'Só a Rhaenyra pula: troque para ela (Q)');

  // A Radhija não passa nem pula; do lado da sala, a trava não alcança.
  h.walkTo(L.WALL_SH.x - 0.5, 0.4);
  h.hold([1, 0]);
  h.run(0.8);
  h.hold(null);
  assert.ok(h.ctrls.radhija.x < L.WALL_SH.x, 'o portãozinho segura a Radhija');
  h.tap('Space');
  assert.ok(h.log('hint').some((x) => x.text === 'Só a Rhaenyra pula! (Q)'));
  assert.equal(h.log('dog:jump').length, 0);
  h.tap('KeyE');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('A trava fica do outro lado')));

  // Rhaenyra pula e abre a trava; a Radhija atravessa atrás dela.
  h.tap('KeyQ');
  assert.equal(h.info().objective, 'Pule o portãozinho com a Rhaenyra (Espaço)');
  openPetGate(h);
  i = h.info();
  assert.ok(i.gate.locked);
  assert.equal(h.log('dog:jump').length, 1);
  assert.equal(i.objective, 'Uma barricada de caixas! Pule por cima com a Rhaenyra (Espaço)');

  // Pelo corredor, a caixa de almofadas encalha na soleira.
  h.walkTo(B.start.x - B.half - 0.24, B.start.z, { tol: 0.06 });
  h.hold([1, 0], ['ShiftLeft']);
  h.run(1.2);
  h.hold(null);
  assert.ok(Math.abs(h.info().box.x - B.start.x) < 0.01, 'a caixa não andou para o leste');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Do lado de cá a caixa encalha na soleira')));

  // Pula para a cozinha e empurra de lá: desmonta e libera a porta.
  clearBarricade(h);
  i = h.info();
  assert.ok(i.box.collapsed && !i.box.enabled);
  assert.equal(h.log('box:collapse').length, 1);
  assert.equal(i.objective, 'A Rhaenyra é grande demais para a mesa: troque para a Radhija (Q)');

  // A Rhaenyra bate na toalha; a Radhija entra debaixo da mesa.
  h.walkTo(L.TABLE.x, N.K_table.z);
  h.hold([0, -1]);
  h.run(0.9);
  h.hold(null);
  assert.ok(h.ctrls.rhaenyra.z > L.TABLE.z + L.TABLE.hz, 'não entrou debaixo da mesa');
  assert.ok(h.log('hint').some((x) => x.text.startsWith('A Rhaenyra é grande demais para entrar debaixo da mesa')));
  h.tap('KeyQ');
  h.walkPath([[N.K_door.x, N.K_door.z], [N.K_mid.x, N.K_mid.z], [L.BEAR.x, N.K_table.z], [L.BEAR.x, L.BEAR.z + 0.32, { tol: 0.1 }]]);
  assert.equal(h.info().prompt, 'Pegar o ursinho');
  h.tap('KeyE');
  i = h.info();
  assert.equal(i.carrier, 'radhija');
  assert.equal(i.stage, 'carrying');
  assert.ok(h.log('item:pickup').some((p) => p.item === 'bear'));

  // De volta para a caminha.
  h.walkPath([[L.BEAR.x, N.K_table.z], [N.K_mid.x, N.K_mid.z], [N.K_door.x, N.K_door.z], [N.H_box.x, N.H_box.z], [N.H_gate.x, N.H_gate.z], [N.S_gate.x, N.S_gate.z], [N.S_bed.x, N.S_bed.z], [L.GOAL.x, L.GOAL.z]]);
  assert.ok(h.run(6, { until: (s) => s.state === 'victory' }), 'vitória');
  const vic = h.log('victory');
  assert.equal(vic[0].levelId, 'fase5');
  assert.equal(vic[0].hasNext, true); // depois dela vem a fase 6
  // as duas comemoram dentro da caminha: a voltinha passaria por cima da borda, então ficam nos pulinhos
  h.run(2);
  const di = h.info().dogs.radhija, spot = L.GOAL.celebrate.radhija;
  assert.ok(Math.hypot(di.x - spot.x, di.z - spot.z) < 0.6, 'a Radhija comemora no lugar dela, na caminha');
  assert.equal(h.dogs.radhija.anim.celebrateLoop, 0, 'na caminha, sem voltinha (pulinhos)');

  h.events.emit('ui:restart', {});
  h.run(0.3);
  i = h.info();
  assert.ok(i.stage === 'start' && !i.gate.locked && !i.box.collapsed && i.box.enabled && !i.carrier);
});

test('fase 5: o ossinho do cercadinho só sai pulando (e a Radhija não entra)', async () => {
  let h = await createHeadlessGame({ level: 5 });
  const P = L.PEN;
  const cx = (P.x0 + P.x1) / 2;
  h.walkTo(cx, P.z0 - 0.5);
  h.hold([0, 1]);
  h.run(0.8);
  h.hold(null);
  assert.ok(h.ctrls.radhija.z < P.z0, 'a Radhija fica do lado de fora');
  h = await createHeadlessGame({ level: 5, query: 'dog=rhaenyra' });
  jumpFrom(h, cx, P.z0 - 0.36, 0, 1);
  assert.ok(h.ctrls.rhaenyra.z > P.z0 && h.ctrls.rhaenyra.z < P.z1, 'pulou para dentro');
  h.walkTo(cx, (P.z0 + P.z1) / 2, { tol: 0.1 });
  assert.equal(h.info().collected, 1);
  jumpFrom(h, cx, P.z1 - 0.36, 0, 1);
  assert.ok(h.ctrls.rhaenyra.z > P.z1, 'pulou para fora');
});

test('fase 5: a companheira espera no portãozinho e na barricada', async () => {
  const radius = L.DOGS.rhaenyra.radius;
  const find = (hh, a, b, size = 'small') => {
    hh.world.setCompanionMode(true);
    try { return hh.nav.findPath(a, b, { size, r: size === 'small' ? L.DOGS.radhija.radius : radius, flags: hh.puzzle.navFlags() }); } finally { hh.world.setCompanionMode(false); }
  };
  let h = await createHeadlessGame({ level: 5 });
  let p = find(h, N.S_mid, N.H_mid);
  assert.ok(!p.reachable && p.waitNode === 'S_gate', 'portãozinho fechado: espera na sala');
  h = await createHeadlessGame({ level: 5, query: 'stage=gateOpen' });
  assert.ok(find(h, N.S_mid, N.H_mid).reachable, 'portãozinho aberto: passa');
  p = find(h, N.H_mid, N.K_mid);
  assert.ok(!p.reachable && p.waitNode === 'H_box', 'barricada: espera no corredor');
  h = await createHeadlessGame({ level: 5, query: 'stage=boxClear' });
  assert.ok(find(h, N.H_mid, N.K_mid).reachable, 'caixa desmontada: entra na cozinha');
});

test('fase 5: ?stage= pula para cada etapa', async () => {
  for (const s of ['gateOpen', 'boxClear', 'carrying']) {
    const h = await createHeadlessGame({ level: 5, query: `stage=${s}` });
    assert.equal(h.info().stage, s);
  }
});
