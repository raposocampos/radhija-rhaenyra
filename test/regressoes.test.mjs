// Regressões: bugs que já apareceram e foram corrigidos. Cada teste reproduz o cenário original no jogo
// headless (game.js de verdade) e falha se o bug voltar. A arrancada atravessando a cerca está em
// test/colisao.test.mjs (todas as paredes finas de todas as fases).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { PAD } from '../src/game/input.js';
import { LEVELS } from '../src/levels/index.js';

/** Espera a troca de fase em andamento terminar (o carregamento é assíncrono: cobre a tela, troca, revela). */
async function untilLoaded(h, timeout = 5000) {
  const t0 = Date.now();
  while (h.game.state === 'loading' && Date.now() - t0 < timeout) await new Promise((r) => setTimeout(r, 10));
  assert.notEqual(h.game.state, 'loading', 'a fase não terminou de carregar');
}

const mouthItems = (h) => ['radhija', 'rhaenyra'].map((n) => h.dogs[n].mouthSocket.children.length);

/** Entrega o item da fase 1 a partir de ?stage=carrying e espera a vitória. */
function deliverFase1(h) {
  h.walkPath([[3.0, -1.2], [1.75, 1.6], [0.35, 1.75], [-2.0, -1.0], [-3.6, -3.7]]);
  assert.ok(h.run(6, { until: (s) => s.state === 'victory' }), 'vitória da fase 1');
}

// ---------------------------------------------------------------------------------------------------
// Item preso na boca ao trocar de fase: as dogs sobrevivem entre fases, então o item da fase anterior
// ficava no mouthSocket (e a pose de boca continuava "carregando").
// ---------------------------------------------------------------------------------------------------
test('regressão: item na boca não passa para a fase seguinte (vitória → próxima fase)', async () => {
  const h = await createHeadlessGame({ level: 1, query: 'stage=carrying' });
  assert.equal(h.info().carrier, 'rhaenyra');
  assert.deepEqual(mouthItems(h), [0, 1], 'cenoura na boca da Rhaenyra');
  deliverFase1(h);
  h.events.emit('ui:nextLevel', {});
  await untilLoaded(h);
  const i = h.info();
  assert.equal(i.levelId, 'fase2');
  assert.equal(i.carrier, null);
  assert.deepEqual(mouthItems(h), [0, 0], 'bocas vazias na fase 2');
  assert.equal(h.dogs.rhaenyra.carryKind, null, 'pose de boca desfeita');
});

test('regressão: item na boca não passa para outra fase escolhida no meio da partida', async () => {
  const h = await createHeadlessGame({ level: 2, query: 'stage=carrying' });
  assert.ok(mouthItems(h).some(Boolean), 'bolinha na boca');
  h.events.emit('ui:selectLevel', { index: 2 });
  await untilLoaded(h);
  assert.equal(h.info().levelId, 'fase3');
  assert.deepEqual(mouthItems(h), [0, 0]);
  h.events.emit('ui:selectLevel', { index: 0 });
  await untilLoaded(h);
  assert.equal(h.info().levelId, 'fase1');
  assert.deepEqual(mouthItems(h), [0, 0]);
  assert.equal(h.info().stage, 'start');
});

// ---------------------------------------------------------------------------------------------------
// A do menu virando latido: o A que confirma "Começar"/"Continuar" na UI não pode chegar ao jogo como
// interagir/latir (nem o B como arrancada). A UI pode ver o botão no mesmo quadro, antes do jogo.
// ---------------------------------------------------------------------------------------------------
test('regressão: botão que confirma/volta no menu não vaza para o jogo (tela inicial e pausa)', async () => {
  // Com a Rhaenyra ativa, ✕ (A) no jogo é pulo; ○ (B) é interagir (late sem nada perto).
  const h = await createHeadlessGame({ level: 1, mode: 'title', query: 'dog=rhaenyra' });
  h.setPad(h.pad());
  h.run(0.2);
  assert.equal(h.info().state, 'title');
  // ✕ desce e a UI confirma "Começar" antes de o jogo ler o controle neste quadro.
  h.setPad(h.pad({ down: [PAD.A] }));
  h.events.emit('ui:play', {});
  h.run(1.0);
  assert.equal(h.info().state, 'playing');
  assert.equal(h.log('dog:jump').length, 0, '✕ segurado do menu não pulou');
  assert.equal(h.log('dog:bark').length, 0, '✕ segurado do menu não latiu');
  // Soltou e apertou de novo: agora sim é pulo (o teste enxerga pulos).
  h.setPad(h.pad());
  h.run(0.1);
  h.setPad(h.pad({ down: [PAD.A] }));
  h.run(0.1);
  h.setPad(h.pad());
  h.run(0.6);
  assert.equal(h.log('dog:jump').length, 1, '✕ no jogo pula');

  // Pausa (Options) → ✕ confirma "Continuar" → nada de pulo; ○ (voltar) não vira latido; R1 não vira empurrar.
  h.clearLog();
  h.setPad(h.pad({ down: [PAD.START] }));
  h.run(0.1);
  h.setPad(h.pad());
  h.run(0.1);
  assert.equal(h.info().state, 'paused');
  h.setPad(h.pad({ down: [PAD.A] }));
  h.events.emit('ui:resume', {});
  h.run(0.5);
  assert.equal(h.info().state, 'playing');
  assert.equal(h.log('dog:jump').length, 0, '✕ do "Continuar" não pulou');
  for (const [btn, what, bad] of [[PAD.B, '○ (voltar)', (s) => h.log('dog:bark').length > 0], [PAD.RB, 'R1', (s) => s.dogs.rhaenyra.action === 'push']]) {
    h.setPad(h.pad());
    h.run(0.1);
    h.tap('Escape');
    assert.equal(h.info().state, 'paused');
    h.setPad(h.pad({ down: [btn] }));
    h.events.emit('ui:resume', {});
    h.run(0.5);
    assert.ok(!bad(h.info()), `${what} segurado do menu não vazou para o jogo`);
  }
  h.setPad(null);
});

// ---------------------------------------------------------------------------------------------------
// Dog atrasada chegando à comemoração: a companheira longe do objetivo (ex.: em "Fica" do outro lado do
// jardim) não pode comemorar parada no meio do caminho, nem aparecer do nada na frente da câmera; ela
// vem trotando (ou reaparece fora de quadro perto do objetivo) e só então comemora/senta.
// ---------------------------------------------------------------------------------------------------
// Com pontos de reentrada (GOAL.entryPoints), ela costuma reaparecer fora de quadro e chegar a tempo.
// Sem eles, a caminhada passa da comemoração (3,1 s) e ela termina o trajeto já na vitória.
const fase1SemReentrada = () => {
  const def = LEVELS[0];
  return [{ ...def, layout: { ...def.layout, GOAL: { ...def.layout.GOAL, entryPoints: [] } } }, ...LEVELS.slice(1)];
};
for (const [variant, levels] of [['com reentrada fora de quadro', null], ['caminhando até a vitória', fase1SemReentrada()]]) test(`regressão: dog atrasada chega ao lugar da comemoração antes de comemorar (${variant})`, async () => {
  const h = await createHeadlessGame({ level: 1, query: 'stage=carrying', levels });
  const L = h.layout;
  h.tap('KeyF'); // a Radhija (companheira) fica no lado leste
  assert.ok(h.info().stay.radhija);
  if (levels) h.teleport('radhija', 5.2, 3.6); // canto sudeste: bem longe da porta
  h.walkPath([[3.0, -1.2], [1.75, 1.6], [0.35, 1.75], [-2.0, -1.0], [-3.6, -3.7]]);
  let i = h.info();
  assert.equal(i.state, 'celebrating');
  const spot = L.GOAL.celebrate.radhija;
  const far = Math.hypot(i.dogs.radhija.x - spot.x, i.dogs.radhija.z - spot.z);
  assert.ok(far > 3, `a Radhija começou longe (${far.toFixed(1)} m)`);

  let prev = h.info().dogs.radhija;
  let arrivedAt = null;
  const wrong = [];
  for (let f = 0; f < 60 * 14; f++) {
    h.step();
    i = h.info();
    const d = i.dogs.radhija;
    const dist = Math.hypot(d.x - spot.x, d.z - spot.z);
    const act = d.action;
    if ((act === 'celebrate' || act === 'sit') && dist > 0.8) wrong.push(`${i.state}: ${act} a ${dist.toFixed(2)} m do lugar`);
    const jump = Math.hypot(d.x - prev.x, d.z - prev.z);
    if (jump > 0.5 && (prev.visible || d.visible)) wrong.push(`reapareceu à vista (${jump.toFixed(2)} m em um quadro)`);
    if (arrivedAt === null && dist < 0.6 && (act === 'celebrate' || act === 'sit')) arrivedAt = i.state;
    prev = d;
  }
  assert.deepEqual(wrong.slice(0, 5), []);
  assert.ok(arrivedAt, 'a Radhija chegou ao lugar e comemorou/sentou');
  if (levels) assert.equal(arrivedAt, 'victory', 'sem reentrada, ela chega já na vitória');
  assert.equal(h.info().state, 'victory');
});

// ---------------------------------------------------------------------------------------------------
// Calço da fase 2: com o portão aberto, a arrancada leva o calço até `lockedAt`, EMBAIXO da folha aberta
// (perto da ponta), e o portão fica travado. O calço não pode travar com o portão fechado, nem ficar no
// meio da passagem prendendo as dogs.
// ---------------------------------------------------------------------------------------------------
test('regressão: calço da fase 2 trava sob a folha aberta do portão, sem bloquear a passagem', async () => {
  const h = await createHeadlessGame({ level: 2 });
  const { GATE, WEDGE } = h.layout;

  // Geometria: lockedAt fica sob a folha aberta, perto da ponta (85% do comprimento).
  const yaw = GATE.openYaw;
  const ux = -Math.sin(yaw);
  const uz = -Math.cos(yaw); // direção da folha (ao longo de -Z local girado por yaw)
  const rx = WEDGE.lockedAt.x - GATE.hinge.x;
  const rz = WEDGE.lockedAt.z - GATE.hinge.z;
  const along = (rx * ux + rz * uz) / GATE.length;
  const across = Math.abs(rx * uz - rz * ux);
  assert.ok(across < 0.06, `lockedAt a ${across.toFixed(3)} m da linha da folha aberta`);
  assert.ok(along > 0.6 && along < 1.0, `lockedAt a ${(along * 100).toFixed(0)}% do comprimento da folha`);

  // Portão fechado: a arrancada só quica o calço.
  h.teleport('radhija', -0.95, 2.35);
  h.run(0.3);
  h.hold([-1, 0]);
  h.run(0.06);
  h.tap('ShiftLeft');
  h.run(0.5);
  h.hold(null);
  h.run(0.3);
  let i = h.info();
  assert.ok(!i.wedge.locked, 'não trava com o portão fechado');
  assert.ok(h.log('wedge:kick').some((k) => k.locked === false));

  // Portão aberto (Rhaenyra em Fica na tábua): a arrancada trava o calço sob a folha.
  h.teleport('rhaenyra', h.layout.PLANK.x, h.layout.PLANK.z);
  h.game.setStay('rhaenyra', true);
  h.run(1.2);
  assert.ok(h.info().gate.t > 0.97, 'portão aberto');
  h.teleport('radhija', -0.95, 2.35);
  h.run(0.3);
  h.hold([-1, 0]);
  h.run(0.06);
  h.tap('ShiftLeft');
  h.run(0.5);
  h.hold(null);
  h.run(0.6);
  i = h.info();
  assert.ok(i.wedge.locked, JSON.stringify(i.wedge));
  assert.equal(i.stage, 'gateLocked');
  assert.ok(Math.abs(i.wedge.x - WEDGE.lockedAt.x) < 0.02 && Math.abs(i.wedge.z - WEDGE.lockedAt.z) < 0.02, 'colisor do calço em lockedAt');
  assert.ok(h.props.wedge.calls.some(([m, t]) => m === 'setState' && t === 1), 'calço visual no estado travado');

  // A Rhaenyra sai da tábua e o portão continua aberto.
  h.game.setStay('rhaenyra', false);
  h.teleport('rhaenyra', -4.2, -0.6);
  h.run(2.0);
  i = h.info();
  assert.ok(i.gate.locked && i.gate.t > 0.97, 'portão segue travado aberto');

  // A passagem do portão fica livre nos dois sentidos para as duas (o calço não prende ninguém).
  const mid = { x: GATE.hinge.x, z: (GATE.hinge.z + GATE.latchPost.z) / 2 };
  for (const name of ['radhija', 'rhaenyra']) {
    const c = h.ctrls[name];
    assert.ok(h.world.segmentClear(mid.x - 0.8, mid.z, mid.x + 0.8, mid.z, c.r * 0.9, c.size), `${name}: passagem livre`);
  }
  h.teleport('radhija', -1.0, 1.3);
  h.run(0.2);
  const back = h.walkTo(-3.2, 0.9, { timeout: 6 });
  assert.ok(back.x < GATE.hinge.x - 0.3, `Radhija volta pelo portão (x=${back.x.toFixed(2)})`);
  h.tap('KeyQ');
  h.run(0.3);
  const thru = h.walkPath([[-2.9, 0.9], [-1.2, 1.0]]);
  assert.ok(thru.x > GATE.hinge.x + 0.5, `Rhaenyra atravessa o portão travado (x=${thru.x.toFixed(2)})`);
});
