// Modo História (etapa 2): as seis cenas do capítulo 1 no jogo de verdade (headless, com o cenário do Recanto).
// Para cada cena, assistida até o fim e pulada (segurar E logo depois de começar):
//  - o jogo fica no MESMO estado (etapa, pistas, meias, posição das dogs, música, travas);
//  - nenhuma trava sobra: a dog ativa anda de novo e a entrada volta (fora do mural);
//  - ninguém atravessa nada a cada quadro, nem nas transições (dog no chão dentro de colisor, ou uma dentro da outra).
// E a abertura: o primeiro Faro pelo botão (V), pelo toque no aviso (ui:storyFaro) e sozinho depois de 5 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoryGame, storyInfo, playScene, intrusions, moved } from './helpers/historia.mjs';

/** Monta o jogo com a cena a ponto de começar: a etapa, a dog certa e o gatilho de verdade. */
const SCENES = {
  abertura: {
    async prepare() { return createStoryGame(); },
    free: [1, 0], // do quarto para a porta da cozinha
    after: 'cozinha',
  },
  reconstrucao: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('piscina', 'radhija');
      h.run(0.2);
      h.tap('KeyV'); // o pulso do Faro perto da piscina acha a boia
      return h;
    },
    free: [1, 0],
    after: 'varal',
  },
  varal: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('varal', 'radhija');
      h.run(0.2);
      const P = h.layout.DASH_POST;
      h.teleport('radhija', P.x, P.z + 0.45, Math.PI);
      h.tap('ShiftLeft'); // a arrancada no poste do varal
      return h;
    },
    free: [-1, 0],
    after: 'torre',
  },
  terraco: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('torre', 'radhija');
      h.run(0.2);
      const T = h.layout.TOWER_LOBBY;
      h.teleport('radhija', (T.x0 + T.x1) / 2, (T.z0 + T.z1) / 2, Math.PI / 2); // entrou no saguão da torre
      return h;
    },
    free: [-1, 0],
    after: 'portaria',
  },
  porteiro: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('portaria', 'rhaenyra');
      h.run(0.2);
      const B = h.layout.BOOTH;
      h.teleport('rhaenyra', (B.x0 + B.x1) / 2, B.z1 + 0.6, Math.PI);
      h.tap('KeyE'); // o latido grave da Rhaenyra acorda o porteiro
      return h;
    },
    free: [0, 1],
    after: 'fechamento',
  },
  fechamento: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('fechamento', 'radhija');
      h.run(0.2);
      const G = h.layout.GATE;
      h.teleport('radhija', (G.x0 + G.x1) / 2, G.z + 0.6, Math.PI); // na frente do portãozinho aberto
      return h;
    },
    free: null, // depois dela, o mural (a entrada fica com ele)
    after: 'mural',
  },
};

for (const [id, S] of Object.entries(SCENES)) {
  test(`cena ${id}: assistida ou pulada, o jogo fica igual, sem trava e sem ninguém atravessar nada`, async () => {
    const A = await S.prepare();
    assert.deepEqual(intrusions(A), [], 'antes da cena');
    const pa = playScene(A, { skip: false });
    assert.equal(pa.id, id, 'a cena certa começou (assistida)');
    const B = await S.prepare();
    const pb = playScene(B, { skip: true });
    assert.equal(pb.id, id, 'a cena certa começou (pulada)');
    assert.ok(pb.seconds < pa.seconds, `pular encurta (${pb.seconds.toFixed(1)} s × ${pa.seconds.toFixed(1)} s)`);

    assert.deepEqual(pa.bad, [], 'assistida: ninguém atravessa nada');
    assert.deepEqual(pb.bad, [], 'pulada: ninguém atravessa nada');

    const sa = A.puzzle.snapshot();
    const sb = B.puzzle.snapshot();
    assert.equal(sa.stage, S.after, `assistida: a etapa seguinte (${S.after})`);
    assert.deepEqual(sb, sa, 'o mesmo estado, pulando ou não');

    for (const [h, how] of [[A, 'assistida'], [B, 'pulada']]) {
      assert.equal(h.info().state, 'playing', `${how}: jogando`);
      assert.equal(h.puzzle.lockFor('radhija'), null, `${how}: sem trava na Radhija`);
      assert.equal(h.puzzle.lockFor('rhaenyra'), null, `${how}: sem trava na Rhaenyra`);
      assert.equal(storyInfo(h).scene, null, `${how}: a cena acabou`);
      if (S.free) {
        assert.equal(h.puzzle.cinematic(), false, `${how}: a entrada volta`);
        const d = moved(h, 0.7, S.free);
        assert.ok(d > 0.3, `${how}: a dog ativa anda de novo (${d.toFixed(2)} m)`);
        assert.deepEqual(intrusions(h), [], `${how}: andando depois`);
      }
    }
  });
}

test('abertura: o primeiro Faro pelo toque no aviso (ui:storyFaro) e sozinho, depois de 5 s', async () => {
  // pelo toque no aviso: a cena segue na hora
  const h = await createStoryGame();
  let guard = 0;
  while (!h.puzzle.waitingFaro && guard++ < 60 * 60) h.step();
  assert.ok(h.puzzle.waitingFaro, 'a abertura espera o primeiro Faro');
  const prompts = h.log('story:prompt');
  assert.ok(prompts.some((p) => p.on), 'o aviso do Faro aparece');
  h.events.emit('ui:storyFaro', {});
  h.step();
  assert.equal(h.puzzle.waitingFaro, false, 'o toque no aviso dispara o Faro');
  assert.ok(h.log('story:faro').length >= 1, 'o pulso saiu');
  for (const id of ['trilha', 'pote', 'pena']) assert.ok(storyInfo(h).clues.includes(id), `pista ${id} na lupa`);

  // sem apertar nada: sai sozinho
  const g = await createStoryGame();
  guard = 0;
  while (!g.puzzle.waitingFaro && guard++ < 60 * 60) g.step();
  const t0 = g.time;
  while (g.puzzle.waitingFaro && g.time - t0 < 8) g.step();
  assert.equal(g.puzzle.waitingFaro, false);
  assert.ok(g.time - t0 > 4.5 && g.time - t0 < 6, `sozinho em ~5 s (${(g.time - t0).toFixed(2)} s)`);
});

test('abertura: com a Rhaenyra ativa (?dog=rhaenyra), o primeiro Faro ainda é da Radhija e o L3 do controle vale', async () => {
  const h = await createStoryGame({ query: 'dog=rhaenyra' });
  let guard = 0;
  while (!h.puzzle.waitingFaro && guard++ < 60 * 60) h.step();
  assert.ok(h.puzzle.waitingFaro);
  // L3 (apertar o analógico esquerdo) → 'Faro'
  h.setPad(h.pad({ down: [] }));
  h.step();
  h.setPad(h.pad({ down: [10] }));
  h.step();
  h.setPad(h.pad({ down: [] }));
  h.step();
  h.setPad(null);
  assert.equal(h.puzzle.waitingFaro, false, 'o L3 dispara o Faro na abertura');
});

test('abertura: durante a cena, nada de trocar de dog, Fica, pulo ou latido', async () => {
  const h = await createStoryGame();
  h.run(2);
  assert.ok(storyInfo(h).scene === 'abertura');
  const before = h.game.activeDog;
  const barks = h.dogs.radhija.barks + h.dogs.rhaenyra.barks;
  for (const k of ['KeyQ', 'KeyF', 'Space', 'KeyC']) h.tap(k);
  assert.equal(h.game.activeDog, before, 'Q não troca');
  assert.deepEqual(h.game.stay, { radhija: false, rhaenyra: false }, 'F não põe no Fica');
  assert.equal(h.dogs.radhija.barks + h.dogs.rhaenyra.barks, barks, 'ninguém late');
  assert.ok(storyInfo(h).scene === 'abertura', 'a cena segue');
});
