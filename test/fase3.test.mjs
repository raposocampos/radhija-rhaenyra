// Fase 3 (Operação Pantufa): lógica do puzzle rodando no jogo headless, com teclas simuladas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';

/** A dog está na água ou fora dos limites? */
function inWater(h, n) {
  const c = h.ctrls[n];
  const B = h.world.bounds;
  return h.world.contacts(c.x, c.z, c.r * 0.9, c.size).some((x) => x.kind === 'water') || c.x < B.minX || c.x > B.maxX || c.z < B.minZ || c.z > B.maxZ;
}

test('fase 3: partida completa (duas pedras → portão → latido distrai a gansa → pantufa → porta)', async () => {
  const h = await createHeadlessGame({ level: 3 });
  let i = h.info();
  assert.equal(i.levelId, 'fase3');
  assert.equal(i.objective, 'Descubra como abrir o portão de treliça');

  // Radhija é leve demais para a pedra grande.
  h.walkPath([[-5.9, -1.6], [-5.6, 1.4], [-5.0, 2.9, { tol: 0.12 }]]);
  h.run(0.5);
  assert.ok(!h.info().plateH.pressed);
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Leve demais para a pedra grande')));

  // Rhaenyra acende a lanterna H; sem Fica, ela sai e a lanterna apaga.
  h.walkTo(-4.0, 2.4);
  h.tap('KeyQ');
  h.walkTo(-5.0, 2.9, { tol: 0.12 });
  h.run(0.7);
  i = h.info();
  assert.ok(i.plateH.pressed && i.plateH.by === 'rhaenyra');
  assert.ok(h.log('lantern:on').some((l) => l.id === 'H'));
  h.tap('KeyQ');
  h.walkTo(-3.4, 1.0);
  h.run(1.5);
  assert.ok(!h.info().plateH.pressed);
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Use Fica (F)')));

  // Com Fica: as duas pedras abrem e travam o portão.
  h.tap('KeyQ');
  h.walkTo(-5.0, 2.9, { tol: 0.12 });
  h.run(0.8);
  h.tap('KeyQ');
  h.tap('KeyF');
  i = h.info();
  assert.ok(i.stay.rhaenyra && i.plateH.pressed);
  assert.equal(i.objective, 'Agora a pedrinha do cantinho, com a Radhija');
  h.walkPath([[-3.4, 1.0], [-3.1, -1.6], [-3.04, -2.4, { tol: 0.1 }], [-3.04, -3.3, { tol: 0.12 }], [-2.95, -3.85, { tol: 0.1 }]]);
  h.run(0.5);
  i = h.info();
  assert.ok(i.plateL.pressed && i.plateL.by === 'radhija');
  assert.ok(i.gate.locked);
  assert.equal(i.stage, 'gateOpen');
  assert.ok(h.log('item:revealed').some((p) => p.item === 'slipper'));

  // A gansa investe na Radhija sem jogá-la na água.
  h.walkPath([[-3.04, -3.3, { tol: 0.12 }], [-3.04, -2.4, { tol: 0.1 }], [-3.4, 1.4], [-2.9, 3.0], [-1.1, 3.0]]);
  h.tap('KeyF');
  assert.ok(!h.info().stay.rhaenyra);
  h.clearLog();
  h.walkTo(-0.9, 0.6, { timeout: 6, until: (s) => s.goose.state === 'alert' || s.goose.state === 'charge' });
  h.walkTo(0.0, -0.4, { timeout: 4, until: (s) => s.fx.radhija.busy });
  assert.ok(h.run(4, { until: (s) => s.fx.radhija.busy }) || h.info().fx.radhija.busy, 'investida acertou');
  assert.ok(h.log('goose:hit').some((x) => x.name === 'radhija'));
  h.run(0.7);
  assert.ok(!inWater(h, 'radhija'), 'knockback não joga na água');
  assert.equal(h.info().objective, 'Distraia a Dona Gansa com um latido (E)');

  // Rhaenyra espera perto da ponte; a Radhija late no gramado sul.
  h.walkTo(-1.2, 2.1, { tol: 0.15 });
  h.run(8, { until: (s) => Math.hypot(s.dogs.rhaenyra.x + 1.2, s.dogs.rhaenyra.z - 2.1) < 1.4 && s.dogs.rhaenyra.speed < 0.1 });
  h.walkTo(-0.4, 2.9, { tol: 0.15 });
  h.run(0.3);
  h.tap('KeyF');
  assert.ok(h.info().stay.rhaenyra);
  h.walkPath([[0.8, 3.5], [2.3, 3.5, { tol: 0.15 }]]);
  h.clearLog();
  h.tap('KeyE');
  const tBark = h.info().timeSec;
  assert.equal(h.log('dog:bark').length, 1);
  assert.equal(h.log('goose:lured').length, 1);

  // Rhaenyra atravessa a ponte, pega a pantufa e volta.
  h.run(0.6);
  h.tap('KeyQ');
  h.tap('KeyF');
  i = h.info();
  assert.ok(i.activeDog === 'rhaenyra' && !i.stay.rhaenyra);
  assert.equal(i.objective, 'Rápido! Atravesse a ponte e pegue a pantufa (E)');
  h.walkPath([[-0.45, 0.2, { tol: 0.35 }], [-0.1, -0.6, { tol: 0.25 }], [2.5, -0.6, { tol: 0.35 }], [3.05, -0.4, { tol: 0.2 }]], { timeout: 8 });
  assert.equal(h.info().prompt, 'Pegar a pantufa');
  h.tap('KeyE');
  i = h.info();
  assert.equal(i.stage, 'carrying');
  assert.equal(i.carrier, 'rhaenyra');
  h.walkPath([[2.4, -0.6, { tol: 0.3 }], [0.0, -0.6, { tol: 0.3 }], [-0.9, 1.0, { tol: 0.35 }], [-1.1, 3.0]]);
  assert.ok(h.run(20, { until: (s) => s.goose.state === 'return' || s.goose.state === 'patrol' }));
  const tBack = h.info().timeSec - tBark;
  // A janela exata depende de por onde a gansa anda (ela pode ficar curiosa antes se travar no caminho).
  assert.ok(tBack >= 9.5, `a gansa só volta ≥ 9,5 s depois do latido (${tBack.toFixed(1)} s, ${h.info().goose.state})`);

  // Entrega na porta de vidro.
  h.walkPath([[-2.9, 3.0], [-3.4, 1.4], [-3.3, -1.6], [-4.4, -3.0], [-5.0, -3.6]]);
  h.run(0.4);
  assert.ok(['celebrating', 'victory'].includes(h.info().state));
  assert.ok(h.run(5, { until: (s) => s.state === 'victory' }));
  const vic = h.log('victory');
  assert.equal(vic[0].levelId, 'fase3');
  assert.equal(vic[0].hasNext, true); // depois dela vem a fase 4

  h.events.emit('ui:restart', {});
  h.run(0.3);
  i = h.info();
  assert.ok(i.stage === 'start' && !i.gate.locked && !i.carrier && i.goose.state === 'patrol' && i.lanterns.H < 0.5);
});

test('fase 3: Rhaenyra não cabe no cantinho; Radhija não pega a pantufa', async () => {
  let h = await createHeadlessGame({ level: 3, query: 'dog=rhaenyra' });
  h.walkPath([[-3.1, -1.6], [-3.04, -2.45, { tol: 0.1 }]]);
  h.hold([0, -1]);
  h.run(0.9);
  h.hold(null);
  assert.ok(h.info().dogs.rhaenyra.z > -2.975 + 0.1);
  assert.ok(h.log('hint').some((x) => x.text.startsWith('A Rhaenyra não cabe no cantinho')));

  h = await createHeadlessGame({ level: 3, query: 'stage=gateOpen' });
  h.teleport('radhija', 2.9, -0.45);
  h.walkTo(3.05, -0.4, { tol: 0.1 });
  assert.notEqual(h.info().prompt, 'Pegar a pantufa');
  h.tap('KeyE');
  assert.equal(h.info().carrier, null);
  assert.ok(h.log('hint').some((x) => x.text === 'A pantufa é pesada demais para a Radhija!'));
});

// O passo do cantinho na partida do navegador (tools/scripts/playthrough-fase3.mjs): a Rhaenyra chega a leste do vão e
// segura W até passar a oeste dele. A chegada varia (tolerância, rumo, ritmo do quadro com a máquina carregada): de
// qualquer uma, ela escorrega rente à cerca-viva pela frente do vão inteiro, não entra e a dica sai.
test('fase 3: dica do cantinho de qualquer chegada a leste do vão (rumo, ponto e ritmo do quadro)', async () => {
  const h = await createHeadlessGame({ level: 3, query: 'dog=rhaenyra' });
  const GAP = h.layout.NOOK.gap;
  const STAGE = { x: -2.66, z: -2.3, tol: 0.1 }; // o ponto de chegada da partida

  // o caminho da partida chega lá
  const p = h.walkPath([[-3.1, -1.6], [STAGE.x, STAGE.z, { tol: STAGE.tol }]]);
  assert.ok(Math.hypot(p.x - STAGE.x, p.z - STAGE.z) < STAGE.tol + 0.05, `chegada (${p.x.toFixed(3)}, ${p.z.toFixed(3)})`);

  const offs = [[0, 0], ...Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)])];
  const bad = [];
  for (const dt of [1 / 60, 1 / 20]) {
    for (let k = 0; k < 8; k++) {
      const yaw = (k * Math.PI) / 4 + 0.2;
      for (const [ux, uz] of offs) {
        h.events.emit('ui:restart', {}); // zera também a espera entre duas dicas iguais
        h.run(0.3);
        h.teleport('rhaenyra', STAGE.x + ux * STAGE.tol, STAGE.z + uz * STAGE.tol, yaw);
        h.teleport('radhija', -3.4, -1.7);
        h.run(0.2, { dt });
        h.clearLog();
        h.hold([0, -1]); // W (a frente da câmera)
        let deepest = Infinity;
        let atGap = 0;
        const passed = h.run(4, { dt, until: (s) => {
          const c = h.ctrls.rhaenyra;
          deepest = Math.min(deepest, c.z);
          if (c.x > GAP.xMin && c.x < GAP.xMax && c.z < GAP.z + 0.4) atGap++;
          return s.dogs.rhaenyra.x < GAP.xMin - 0.05;
        } });
        h.hold(null);
        h.run(0.2, { dt });
        const hint = h.log('hint').some((x) => x.text.startsWith('A Rhaenyra não cabe no cantinho'));
        if (!passed || !atGap || !hint || !(deepest > GAP.z + 0.1)) {
          bad.push({ dt: +dt.toFixed(3), yaw: +yaw.toFixed(2), ux: +ux.toFixed(2), uz: +uz.toFixed(2), passed, atGap, hint, deepest: +deepest.toFixed(3) });
        }
      }
    }
  }
  assert.deepEqual(bad, []);
});

test('fase 3: investida da gansa em vários pontos nunca joga a dog na água', async () => {
  const h = await createHeadlessGame({ level: 3, query: 'stage=gateOpen' });
  let hits = 0;
  for (const [x, z] of [[-0.1, 1.9], [1.0, -0.6], [-1.4, -0.6], [0.5, 0.6], [0.6, -1.9], [-0.1, -3.0], [1.6, -0.6]]) {
    h.puzzle.mech.goose.reset();
    h.teleport('radhija', x, z);
    h.clearLog();
    h.run(2.6);
    if (h.log('goose:hit').length) hits++;
    h.run(0.5);
    assert.ok(!inWater(h, 'radhija'), `na água/fora depois de (${x}, ${z})`);
  }
  assert.ok(hits >= 4, `gansa investe quando a dog chega perto (${hits}/7)`);
});

test('fase 3: latido longe demais não atrai a gansa', async () => {
  const h = await createHeadlessGame({ level: 3, query: 'stage=gateOpen' });
  h.teleport('radhija', 6.2, 3.8);
  h.run(0.3);
  h.tap('KeyE');
  assert.equal(h.log('goose:lured').length, 0);
});
