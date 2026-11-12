// Modo História (etapa 2): as onze cenas do capítulo 1 no jogo de verdade (headless, com o cenário do Recanto).
// Para cada cena, assistida até o fim e pulada (segurar E logo depois de começar):
//  - o jogo fica no MESMO estado (etapa, pistas, meias, posição das dogs, música, travas);
//  - nenhuma trava sobra: a dog ativa anda de novo e a entrada volta (fora do mural);
//  - ninguém atravessa nada a cada quadro, nem nas transições (dog no chão dentro de colisor, ou uma dentro da outra).
// Cada cena começa pelo gatilho de verdade (as três pistas do quarto examinadas, a maçaneta da cozinha, a porta dos
// fundos empurrada, o Faro na piscina e na porta da torre, o cesto e a arrancada no varal, o Superbafo na grelha, o
// latido grosso).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoryGame, storyInfo, playScene, skipScene, intrusions, moved, become, push, sniff, examine, deduce, holdWorld } from './helpers/historia.mjs';

/** O Superbafo da Radhija na grelha da guarita (o gatilho da cena do cheiro). */
function blowVent(h) {
  const V = h.layout.BOOTH_VENT;
  become(h, 'radhija');
  h.teleport('radhija', V.x - 0.75, V.z, Math.PI / 2);
  h.run(0.3);
  h.tap('KeyR');
}

/** Monta o jogo com a cena a ponto de começar: a etapa, a dog certa e o gatilho de verdade. */
const SCENES = {
  abertura: {
    async prepare() { return createStoryGame(); },
    free: [1, 0], // do quarto para a grade
    after: 'quarto',
  },
  janela: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('quarto', 'radhija');
      h.run(0.3);
      // o Faro revela as três pistas do quarto; examinadas as três, os pombos passam pela janela
      const seen = sniff(h);
      for (const id of ['trilha', 'pote', 'pena']) assert.ok(seen.includes(id), `o Faro revela ${id}`);
      for (const id of ['trilha', 'pote', 'pena']) assert.ok(examine(h, id), `${id} examinada`);
      // a pergunta fica pronta na árvore de pistas; a conclusão certa traz os pombos à janela
      deduce(h, 'quem', 0);
      return h;
    },
    free: [1, 0],
    after: 'casa',
  },
  aspirador: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('casa', 'radhija');
      h.run(0.3);
      // a Radhija pisa no pedal (a grade solta); a Rhaenyra tira o saco de ração e pula na maçaneta: a porta da cozinha
      // abre para o corredor, e o barulho acorda o aspirador
      const L = h.layout;
      h.teleport('radhija', L.PET_PEDAL.x - 0.5, L.PET_PEDAL.z + 0.3, 0);
      h.run(0.2);
      h.walkTo(L.PET_PEDAL.x, L.PET_PEDAL.z, { timeout: 5, tol: 0.12, until: () => storyInfo(h).flags.petGateOpen });
      h.run(1.2);
      become(h, 'rhaenyra');
      const Sk = L.FOOD_SACK, KH = L.KITCHEN_HANDLE;
      h.teleport('rhaenyra', Sk.start.x - Sk.half - 0.26, Sk.start.z, Math.PI / 2);
      h.run(0.2);
      assert.ok(push(h, [1, 0], 8, () => storyInfo(h).flags.sackFree), 'o saco sai da frente da maçaneta');
      h.teleport('rhaenyra', KH.x + KH.nx * 0.44, KH.z + KH.nz * 0.44, Math.atan2(-KH.nx, -KH.nz));
      h.run(0.25);
      h.tap('Space');
      return h;
    },
    free: [0, -1], // de volta para a cozinha
    after: 'casa',
  },
  portaFundos: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('casa', 'rhaenyra');
      h.run(0.3);
      // a casa resolvida até o trinco aberto; a Rhaenyra empurra a porta dos fundos
      h.puzzle.casa.jump('porta');
      become(h, 'rhaenyra');
      const EX = h.layout.HOUSE_EXIT;
      h.teleport('rhaenyra', EX.x - 0.5, (EX.z0 + EX.z1) / 2, Math.PI / 2);
      h.run(0.2);
      holdWorld(h, [1, 0], 4, () => !!storyInfo(h).scene, ['ShiftLeft']);
      return h;
    },
    free: [1, 0], // pela porta aberta, para o quintal
    after: 'quintal',
  },
  reconstrucao: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('piscina', 'radhija');
      h.run(0.3);
      h.tap('KeyV'); // o pulso do Faro perto da piscina acha a marca da boia
      return h;
    },
    free: [1, 0],
    after: 'varal',
  },
  senha: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('torre', 'rhaenyra');
      h.run(0.3);
      h.tap('KeyV'); // as duas farejam: aqui, a Rhaenyra, perto da porta da torre
      return h;
    },
    free: [-1, 0],
    after: 'torre',
  },
  varal: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('varal', 'rhaenyra');
      h.run(0.3);
      // a Rhaenyra empurra o cesto de roupa até embaixo da cenoura
      const C = h.layout.LAUNDRY;
      h.teleport('rhaenyra', C.start.x - C.half - 0.26, C.start.z, Math.PI / 2);
      h.run(0.2);
      assert.ok(push(h, [1, 0], 14, () => storyInfo(h).flags.basketUnder), 'o cesto chega embaixo da cenoura');
      // e o empurra-empurra da Rhaenyra no poste do leste solta o pregador (o terceiro empurrão começa a cena)
      const P = h.layout.POLE_SHOVE;
      h.teleport('rhaenyra', P.x, P.z + 0.5, Math.PI);
      h.run(0.2);
      holdWorld(h, [0, -1], 6, () => !!storyInfo(h).scene, ['ShiftLeft']);
      return h;
    },
    free: [0, 1],
    after: 'torre',
  },
  telhadoChega: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('torre', 'radhija');
      h.run(0.3);
      const T = h.layout.TOWER_LOBBY;
      h.teleport('radhija', (T.x0 + T.x1) / 2, (T.z0 + T.z1) / 2, Math.PI / 2); // entrou no saguão da torre: o terraço
      return h;
    },
    free: [1, 0],
    after: 'torre', // a etapa segue: o pega-pega no terraço é jogável
  },
  cheiro: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('portaria', 'radhija');
      h.run(0.3);
      blowVent(h);
      return h;
    },
    free: [-1, 0],
    after: 'portaria',
  },
  porteiro: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('portaria', 'radhija');
      h.run(0.3);
      blowVent(h);
      skipScene(h, 'cheiro');
      assert.ok(storyInfo(h).flags.windowOpen, 'a janela da guarita abriu');
      become(h, 'rhaenyra');
      const B = h.layout.BOOTH;
      h.teleport('rhaenyra', (B.x0 + B.x1) / 2, B.awning.z1 + 0.9, Math.PI);
      h.run(0.2);
      h.tap('KeyE'); // o latido grosso da Rhaenyra acorda o porteiro
      return h;
    },
    free: [0, 1],
    after: 'fechamento',
  },
  fechamento: {
    async prepare() {
      const h = await createStoryGame();
      h.game.debug.setStage('fechamento', 'radhija');
      h.run(0.3);
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
    assert.equal(pa.id, id, `a cena certa começou (assistida): ${JSON.stringify(storyInfo(A).flags)}`);
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
      // a volta para trás da dog é suave (menos de 1 s); depois dela, nenhum plano de cena sobra
      if (S.free) {
        h.run(1.1);
        assert.equal(h.game.debug.cam.shotActive, false, `${how}: a câmera voltou para trás da dog`);
        assert.equal(h.game.debug.cam.mode, 'follow', `${how}: seguindo a dog`);
      }
      if (S.free) {
        assert.equal(h.puzzle.cinematic(), false, `${how}: a entrada volta`);
        const d = moved(h, 0.7, S.free);
        assert.ok(d > 0.3, `${how}: a dog ativa anda de novo (${d.toFixed(2)} m)`);
        assert.deepEqual(intrusions(h), [], `${how}: andando depois`);
      }
    }
  });
}

test('reconstruções: as silhuetas aparecem de verdade (o material não fica apagado) e o pombo fica à vista', async () => {
  for (const [stage, dog, id] of [['piscina', 'radhija', 'reconstrucao'], ['torre', 'rhaenyra', 'senha']]) {
    const h = await createStoryGame();
    h.game.debug.setStage(stage, dog);
    h.run(0.3);
    h.tap('KeyV');
    const mat = h.props.ghosts.material;
    const gp = h.props.ghosts.pigeon.object;
    let best = 0;
    let shown = 0;
    let frames = 0;
    playScene(h, {
      each() {
        if (storyInfo(h).scene !== id || storyInfo(h).beat !== 'silhuetas') return;
        frames++;
        best = Math.max(best, mat.opacity);
        let up = true;
        for (let p = gp; p; p = p.parent) if (!p.visible) up = false;
        if (up && mat.opacity > 0.25) shown++;
      },
    });
    assert.ok(frames > 60, `${id}: a Reconstrução roda (${frames} quadros)`);
    assert.ok(best > 0.4, `${id}: o material das silhuetas acende (no máximo ${best.toFixed(2)})`);
    assert.ok(shown > frames * 0.6, `${id}: o pombo fantasma fica à vista na maior parte (${shown}/${frames})`);
  }
});

test('abertura: termina com a jogadora no quarto, a cenoura sumida e o aviso do Faro na tela', async () => {
  const h = await createStoryGame();
  const r = playScene(h, { skip: false });
  assert.equal(r.id, 'abertura');
  assert.ok(r.seconds > 40 && r.seconds < 70, `a abertura dura ${r.seconds.toFixed(1)} s`);
  const s = storyInfo(h);
  assert.equal(s.stage, 'quarto');
  // as pistas de cena chegam com a abertura; as do quarto, só farejando e examinando
  assert.deepEqual(s.clues.slice().sort(), ['abraco', 'pombos']);
  assert.equal(h.props.carrot.object.visible, false, 'a cenoura sumiu');
  h.run(0.3);
  assert.ok(h.log('story:prompt').some((p) => p.on), 'o aviso do Faro aparece no quarto');
  assert.equal(h.log('objective').at(-1)?.text, 'A cenoura sumiu! Farejem o quarto');
  // o toque no aviso (ui:storyFaro) fareja; o aviso some
  h.events.emit('ui:storyFaro', {});
  h.run(0.3);
  assert.ok(h.log('story:faro').length >= 1, 'o pulso saiu pelo toque no aviso');
  assert.equal(h.log('story:prompt').at(-1).on, false, 'depois do primeiro Faro, o aviso some');
});

test('abertura: durante a cena, nada de trocar de dog, Fica, pulo, latido ou Faro', async () => {
  const h = await createStoryGame();
  h.run(2);
  assert.ok(storyInfo(h).scene === 'abertura');
  const before = h.game.activeDog;
  const barks = h.dogs.radhija.barks + h.dogs.rhaenyra.barks;
  for (const k of ['KeyQ', 'KeyF', 'Space', 'KeyC', 'KeyV']) h.tap(k);
  assert.equal(h.game.activeDog, before, 'Q não troca');
  assert.deepEqual(h.game.stay, { radhija: false, rhaenyra: false }, 'F não põe no Fica');
  assert.equal(h.dogs.radhija.barks + h.dogs.rhaenyra.barks, barks, 'ninguém late');
  assert.equal(h.log('story:faro').length, 0, 'o Faro não sai no meio da cena');
  assert.ok(storyInfo(h).scene === 'abertura', 'a cena segue');
});

test('cenas: a cenoura vai nas patas do Farelo quando os pombos a levam (nada de flutuar)', async () => {
  const h = await createStoryGame();
  h.game.debug.setStage('quarto', 'radhija');
  h.run(0.3);
  sniff(h);
  for (const id of ['trilha', 'pote', 'pena']) examine(h, id);
  deduce(h, 'quem', 0);
  const far = h.props.squad.far;
  const carrot = h.props.carrot;
  assert.equal(typeof carrot.holdBy, 'function', 'a cenoura sabe ser agarrada');
  assert.equal(typeof far.feetPoint, 'function', 'o pombo diz onde as patas seguram');
  let seen = 0;
  let worst = 0;
  playScene(h, {
    each() {
      if (storyInfo(h).scene !== 'janela' || storyInfo(h).beat !== 'voo' || !carrot.object.visible || !far.object.visible) return;
      const f = far.feetPoint();
      const c = carrot.object.position;
      const d = Math.hypot(c.x - f.x, c.y - f.y, c.z - f.z);
      // os primeiros quadros são a cenoura chegando às patas
      if (seen++ > 6) worst = Math.max(worst, d);
      assert.ok(c.y < far.object.position.y + 0.25, 'a cenoura fica embaixo do pombo');
    },
  });
  assert.ok(seen > 40, `a cenoura aparece no voo (${seen} quadros)`);
  assert.ok(worst < 0.14, `a cenoura não sai das patas (no máximo ${worst.toFixed(3)} m)`);
});

test('árvore de pistas: três pistas deixam a pergunta pronta; a conclusão errada não passa, a certa traz os pombos', async () => {
  const h = await createStoryGame();
  h.game.debug.setStage('quarto', 'radhija');
  h.run(0.3);
  const board = () => storyInfo(h).board;
  assert.deepEqual(board().asked, ['quem'], 'a abertura deixa a primeira pergunta');
  sniff(h);
  for (const id of ['trilha', 'pote', 'pena']) examine(h, id);
  h.run(0.5);
  assert.equal(storyInfo(h).scene, null, 'só examinar não basta: falta deduzir');
  assert.match(h.log('objective').at(-1)?.text ?? '', /árvore de pistas/, 'o objetivo manda abrir a árvore');
  h.clearLog();
  deduce(h, 'quem', 2);
  assert.equal(h.log('story:deduceWrong').length, 1, 'a conclusão errada treme e volta');
  assert.ok(!board().solved.includes('quem'));
  deduce(h, 'quem', 0);
  assert.ok(board().solved.includes('quem'), 'a certa vira conclusão');
  h.run(0.6);
  assert.equal(storyInfo(h).scene, null, 'o quadro mostra a conclusão antes da cena');
  h.run(1.0);
  assert.equal(storyInfo(h).scene, 'janela', 'e os pombos passam pela janela');
});

test('falas: as cenas falam com texto (balões de HQ), sem balão de ícone, e a página de HQ fecha no fim', async () => {
  const h = await createStoryGame();
  const r = playScene(h, { skip: false });
  assert.equal(r.id, 'abertura');
  const says = h.log('story:say');
  assert.ok(says.length >= 12, `a abertura tem falas (${says.length})`);
  assert.ok(says.every((p) => typeof p.text === 'string' && p.text.length > 0), 'toda fala tem texto');
  assert.ok(says.some((p) => p.who === 'capitao') && says.some((p) => p.who === 'radhija') && says.some((p) => p.who === 'rhaenyra'), 'falam os pombos e as duas');
  assert.ok(h.log('story:panel').length >= 5, 'quadros de HQ');
  assert.ok(h.log('story:onomato').length >= 4, 'onomatopeias');
  assert.equal(h.log('story:comic').at(-1)?.on, false, 'a página de HQ fecha no fim');
});
