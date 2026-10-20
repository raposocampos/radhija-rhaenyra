// Fase 2 (Operação Bolinha): lógica do puzzle rodando no jogo headless, com teclas simuladas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { interpenetration, surfacePoints } from './helpers/interpenetra.mjs';

const TAU = Math.PI * 2;

/** Atravessa o irrigador com a Radhija (arrancada na fase boa dos jatos, ver tools/scripts/sim-sprinkler.mjs). */
function crossSprinkler(h, maxTries = 6) {
  const SPR = h.layout.SPRINKLER;
  for (let k = 0; k < maxTries; k++) {
    const p0 = h.ctrls.radhija;
    if (p0.z > 1.45 && p0.x < -0.9) h.walkPath([[-0.7, Math.max(1.9, p0.z)], [-0.7, 1.15]]);
    h.walkTo(-1.714, 0.707, { tol: 0.1 });
    h.walkTo(-1.714, 0.707, { tol: 0.1 });
    const per = TAU / SPR.jets;
    h.run(3, { until: (i) => { const a = ((i.sprinkler.angle % per) + per) % per; return a > 0.45 && a < 0.85; } });
    h.hold([0.476, -0.88]);
    h.tap('ShiftLeft', 0);
    let res = null;
    for (let f = 0; f < 60 * 9 && !res; f++) {
      const i = h.info();
      const d = i.dogs.radhija;
      if (!d.dashing && Math.hypot(d.x - SPR.x, d.z - SPR.z) < SPR.r + 0.4) h.tap('ShiftLeft', 0);
      if (i.fx.radhija.busy) res = 'wet';
      else if (Math.hypot(d.x - SPR.x, d.z - SPR.z) > SPR.r + 0.3 && d.z < -2.5) res = 'ok';
      h.hold([0.476, -0.88]);
      h.step();
    }
    h.hold(null);
    if (res === 'ok') return k + 1;
    h.run(1.8);
  }
  return 0;
}

test('fase 2: partida completa (tábua → Fica → calço → irrigador → registro → caixote → ponte → caminha)', async () => {
  const h = await createHeadlessGame({ level: 2 });
  let i = h.info();
  assert.equal(i.levelId, 'fase2');
  assert.equal(i.stage, 'start');
  assert.equal(i.objective, 'Encontre um jeito de abrir o portão');

  // Radhija na tábua: leve demais.
  h.walkPath([[-4.2, -0.6], [-3.5, 2.55, { tol: 0.12 }]]);
  h.run(0.5);
  i = h.info();
  assert.ok(!i.plank.pressed && i.gate.t === 0);
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Leve demais')));

  // Rhaenyra na tábua abre o portão.
  h.walkTo(-4.3, 1.4);
  h.tap('KeyQ');
  h.walkTo(-3.5, 2.6, { tol: 0.12 });
  h.run(1.2);
  i = h.info();
  assert.ok(i.plank.pressed && i.plank.by === 'rhaenyra');
  assert.ok(i.gate.t > 0.97, `portão aberto (t=${i.gate.t})`);

  // Troca SEM Fica: ela sai da tábua seguindo e o portão fecha.
  h.tap('KeyQ');
  assert.equal(h.info().objective, 'Peça para a Rhaenyra ficar na tábua (F)');
  h.walkTo(-4.6, 0.3);
  h.run(1.6);
  i = h.info();
  assert.ok(!i.plank.pressed && i.gate.t < 0.05, `portão fechou (t=${i.gate.t})`);
  assert.ok(h.log('hint').some((x) => x.text === 'Peça para a Rhaenyra ficar na tábua (F)!'));

  // De novo, com Fica.
  h.tap('KeyQ');
  h.walkTo(-3.5, 2.6, { tol: 0.12 });
  h.run(0.9);
  h.tap('KeyQ');
  h.tap('KeyF');
  i = h.info();
  assert.ok(i.stay.rhaenyra);
  h.walkTo(-3.2, 0.9);
  h.run(0.7);
  i = h.info();
  assert.ok(i.plank.pressed && i.gate.t > 0.97);
  assert.equal(i.dogs.rhaenyra.mode, 'stay');
  assert.equal(i.objective, 'Passe pelo portão com a Radhija');

  // Arrancada no calço trava o portão.
  h.walkPath([[-1.7, 0.95], [-0.75, 1.3], [-0.72, 2.35, { tol: 0.1 }]]);
  assert.ok(h.info().objective.startsWith('Trave o portão'));
  h.walkTo(-0.95, 2.35, { tol: 0.06 });
  h.hold([-1, 0]);
  h.run(0.06);
  h.tap('ShiftLeft');
  h.run(0.5);
  h.hold(null);
  h.run(0.4);
  i = h.info();
  assert.ok(i.wedge.locked, JSON.stringify(i.wedge));
  assert.equal(i.stage, 'gateLocked');
  assert.equal(h.log('gate:locked').length, 1);

  // Vem (F): ela sai da tábua e o portão segue travado.
  h.tap('KeyF');
  h.run(1.5);
  i = h.info();
  assert.ok(!i.stay.rhaenyra && i.gate.t > 0.97 && i.gate.locked);

  // Irrigador e registro.
  h.run(1.5);
  const tries = crossSprinkler(h);
  assert.ok(tries > 0, 'Radhija atravessa o irrigador');
  h.walkTo(1.2, -4.05, { tol: 0.15 });
  h.run(0.2);
  assert.equal(h.info().prompt, 'Fechar o registro');
  h.tap('KeyE');
  assert.equal(h.info().dogs.radhija.action, 'turn');
  h.run(1.4);
  i = h.info();
  assert.ok(!i.sprinkler.running);
  assert.equal(i.stage, 'sprinklersOff');

  // A Rhaenyra atravessa o gramado e alcança a Radhija.
  const near = (s) => Math.hypot(s.dogs.rhaenyra.x - s.dogs.radhija.x, s.dogs.rhaenyra.z - s.dogs.radhija.z) < 1.8;
  assert.ok(h.run(14, { until: near }), 'Rhaenyra alcança a Radhija');

  // Caixote: leste, sul até o vão, leste para cair no canal.
  h.walkPath([[2.3, -4.2], [2.3, -3.25, { tol: 0.1 }]]);
  h.hold([1, 0]);
  h.run(0.7);
  h.hold(null);
  assert.ok(h.log('hint').some((x) => x.text.startsWith('Pesado demais para a Radhija')));
  h.walkTo(2.4, -2.3);
  h.tap('KeyQ');
  h.run(0.3);
  h.walkPath([[2.3, -2.8], [2.33, -3.25, { tol: 0.07 }]]);
  h.hold([1, 0], ['ShiftLeft']);
  h.run(2.4);
  h.hold(null);
  i = h.info();
  assert.ok(i.crate.x > 3.95, `caixote no leste (x=${i.crate.x})`);
  h.walkPath([[3.4, -4.1], [i.crate.x, -3.25 - 0.38 - 0.24, { tol: 0.06 }]]);
  h.hold([0, 1], ['ShiftLeft']);
  h.run(9, { until: (s) => s.crate.z > 1.32 });
  h.hold(null);
  h.run(0.3);
  i = h.info();
  assert.ok(Math.abs(i.crate.z - 1.4) < 0.3, `caixote no vão (z=${i.crate.z})`);
  h.walkPath([[i.crate.x - 0.75, i.crate.z - 0.7], [i.crate.x - 0.62, i.crate.z, { tol: 0.06 }]]);
  h.hold([1, 0], ['ShiftLeft']);
  h.run(4, { until: (s) => s.crate.enabled === false });
  h.hold(null);
  h.run(1.2);
  i = h.info();
  assert.ok(i.bridge);
  assert.equal(i.stage, 'bridge');

  // Bolinha e caminha.
  h.walkPath([[3.9, 1.4], [5.75, 1.4], [5.82, -2.78, { tol: 0.1 }]]);
  assert.equal(h.info().prompt, 'Pegar a bolinha');
  h.tap('KeyE');
  i = h.info();
  assert.equal(i.stage, 'carrying');
  assert.equal(i.carrier, 'rhaenyra');
  h.walkPath([[5.75, 1.4], [3.8, 1.4], [3.75, -1.0], [3.4, -3.9], [2.2, -4.3], [1.0, -3.9], [-0.4, -1.5], [-1.6, 0.9], [-3.1, 0.9], [-4.2, -0.6], [-5.0, -3.4]]);
  h.run(0.4);
  assert.ok(['celebrating', 'victory'].includes(h.info().state));
  assert.ok(h.run(5, { until: (s) => s.state === 'victory' }));
  assert.equal(h.log('victory')[0].levelId, 'fase2');

  // Reiniciar zera a fase.
  h.events.emit('ui:restart', {});
  h.run(0.3);
  i = h.info();
  assert.ok(i.stage === 'start' && !i.gate.locked && i.gate.t === 0 && i.sprinkler.running && i.crate.enabled && !i.bridge && !i.carrier && !i.stay.rhaenyra);
});

test('fase 2: Radhija molhada pelo jato é empurrada para fora e chacoalha', async () => {
  const h = await createHeadlessGame({ level: 2, query: 'stage=gateLocked' });
  const SPR = h.layout.SPRINKLER;
  assert.equal(h.info().stage, 'gateLocked');
  h.walkTo(-1.1, -0.2, { timeout: 6 });
  assert.ok(h.run(6, { until: (s) => s.fx.radhija.busy }), 'molhou');
  h.run(0.8);
  const i = h.info();
  assert.ok(Math.hypot(i.dogs.radhija.x - SPR.x, i.dogs.radhija.z - SPR.z) > SPR.r, 'fora do disco');
  assert.equal(i.dogs.radhija.action, 'shake');
  const c = h.ctrls.radhija;
  assert.ok(!h.world.overlaps(c.x, c.z, c.r * 0.95, c.size), 'posição válida depois do empurrão');
});

// Retorno do usuário na prévia do PR #48 (2026-10-20): "essa madeira que fica atravessando o portão da fase 2". Travado,
// o calço fica de frente para a folha aberta com a ponta fina por baixo dela; em nenhuma abertura do portão, em nenhum
// ponto do caminho do calço e nem quicando a madeira entra na folha (cenário de verdade: test/helpers/worldBuild.mjs).
test('fase 2: o calço nunca entra na folha do portão (travado, a ponta fica por baixo dela)', async () => {
  const [{ buildLevelWorld }, { LEVELS }] = await Promise.all([import('./helpers/worldBuild.mjs'), import('../src/levels/index.js')]);
  const def = LEVELS.find((d) => d.id === 'fase2');
  const { built, dispose } = await buildLevelWorld(def);
  try {
    const { gate, wedge } = built.props;
    const bad = [];
    const check = (label) => {
      const hit = interpenetration(wedge.object, gate.object, { maxY: 0.2 });
      if (hit.length) bad.push(`${label}: ${JSON.stringify(hit[0])}`);
    };
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 20; j++) {
        gate.setOpen(i / 10);
        wedge.setState(j / 20);
        check(`portão ${i / 10}, calço ${j / 20}`);
      }
    }
    for (const t of [0, 0.5, 0.84]) {
      gate.setOpen(t);
      wedge.setState(0);
      wedge.bump();
      for (let f = 0; f < 72; f++) {
        built.update(1 / 60, f / 60);
        check(`quicando, portão ${t}, quadro ${f}`);
      }
    }
    assert.deepEqual(bad.slice(0, 4), [], `${bad.length} posição(ões) com o calço dentro da folha`);
    // travado: a ponta passa da linha da folha (por baixo dela) e a madeira ali fica abaixo da barra de baixo (5,5 cm)
    const { GATE } = def.layout;
    gate.setOpen(1);
    wedge.setState(1);
    wedge.object.updateMatrixWorld(true);
    const u = { x: -Math.sin(GATE.openYaw), z: -Math.cos(GATE.openYaw) };
    let north = Infinity, under = 0;
    wedge.object.traverse((/** @type {any} */ o) => {
      if (!o.isMesh) return;
      for (const v of surfacePoints(o, 0.004)) {
        const off = -(v.x - GATE.hinge.x) * u.z + (v.z - GATE.hinge.z) * u.x; // > 0: ao sul da folha
        north = Math.min(north, off);
        if (Math.abs(off) < 0.015) under = Math.max(under, v.y);
      }
    });
    assert.ok(north < -0.005, `a ponta passa por baixo da folha (${(north * 100).toFixed(1)} cm além da linha dela)`);
    assert.ok(under > 0.03 && under < 0.05, `debaixo da folha o calço tem ${(under * 100).toFixed(1)} cm (encosta quase na barra de baixo)`);
  } finally {
    dispose();
  }
});
