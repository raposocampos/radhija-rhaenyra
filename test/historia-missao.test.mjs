// Modo História (etapa 2): a missão do capítulo 1 no jogo de verdade (headless, cenário do Recanto), com os controles
// de verdade. A investigação e os puzzles de causa e efeito, na ordem:
//   quarto (farejar com V, examinar com E a trilha, o pote e a pena) → casa (a Radhija pela portinha de gato, o pedal
//   solta a grade; a Rhaenyra empurra o saco de ração e pula na maçaneta) → quintal (o galho; a Radhija pela passagem
//   do muro puxa a argola do ferrolho) → piscina (o Faro e a Reconstrução) → varal (o cesto embaixo da cenoura e a
//   arrancada no poste) → torre (o Faro mostra a senha; os três botões na ordem; a porta de mola com a irmã segurando)
//   → portaria (o Superbafo na grelha abre a janela; o latido grosso acorda o porteiro) → portãozinho → mural → fim.
// E os três enigmas paralelos: o barquinho até a ilha (com a Dona Gansa distraída por um latido), a lixeira e o toldo
// até a meia da antena, a corda, o balde e a bola até a meia do depósito. As cenas são puladas aqui (o teste das cenas
// confere que pular dá no mesmo).
import { test } from 'node:test';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { createStoryGame, storyInfo, skipScene, intrusions, become, holdWorld, push, sniff, examine, deduce } from './helpers/historia.mjs';

const near = (c, p, r) => Math.hypot(c.x - p.x, c.z - p.z) <= r;
const mid = (D) => ({ x: (D.hinge.x + D.latchPost.x) / 2, z: (D.hinge.z + D.latchPost.z) / 2 });
/** A Rhaenyra pula na parede, na frente do botão (ou da alavanca) `spot`, e espera voltar ao chão. */
function boost(h, spot) {
  h.teleport('rhaenyra', spot.x + spot.nx * 0.44, spot.z + spot.nz * 0.44, Math.atan2(-spot.nx, -spot.nz));
  h.run(0.25);
  h.tap('Space');
  h.run(1.5);
}

test('missão do capítulo 1: do quarto ao portãozinho, com os puzzles das duas, o mural e o fim', async () => {
  const h = await createStoryGame();
  const L = h.layout;
  const S = () => storyInfo(h);
  const bad = new Set();
  const watch = () => { for (const m of intrusions(h)) bad.add(`[${S().stage}] ${m}`); };

  // 0. a abertura (pulada): só as pistas de cena; a cenoura sumiu
  skipScene(h, 'abertura');
  assert.equal(S().stage, 'quarto');
  assert.deepEqual(S().clues.slice().sort(), ['abraco', 'pombos']);

  // 1. quarto: o Faro revela a trilha, o pote e a pena; cada uma se examina de perto, com o E
  assert.deepEqual(S().revealed, [], 'sem farejar, nada brilha');
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(S().exam, null, 'sem farejar, não há o que examinar');
  const seen = sniff(h);
  for (const id of ['trilha', 'pote', 'pena']) assert.ok(seen.includes(id), `o Faro revela ${id}`);
  assert.ok(S().cloud.on && S().cloud.puffs >= 2, `a nuvem de cheiro sai do focinho (${JSON.stringify(S().cloud)})`);
  for (const id of ['trilha', 'pote', 'pena']) {
    assert.ok(examine(h, id), `${id} examinada vira pista na lupa`);
    watch();
  }
  // examinadas as três, a pergunta fica pronta na árvore de pistas; a conclusão certa traz os pombos à janela com a
  // cenoura, e a missão vira ir atrás deles
  deduce(h, 'quem', 0);
  skipScene(h, 'janela');
  assert.equal(S().stage, 'casa');
  assert.equal(h.log('objective').at(-1)?.text, 'Atrás dos pombos! Saiam de casa');

  // 2. casa: a grade do quarto barra a Rhaenyra; a Radhija passa pela portinha de gato e pisa no pedal
  become(h, 'rhaenyra');
  const G = L.PET_GATE, F = L.PET_FLAP;
  h.walkTo(G.hinge.x + 1.2, mid(G).z, { timeout: 4 });
  assert.ok(h.ctrls.rhaenyra.x < G.hinge.x - 0.1, `a grade segura a Rhaenyra no quarto (x ${h.ctrls.rhaenyra.x.toFixed(2)})`);
  h.walkTo(F.x + 1.0, (F.z0 + F.z1) / 2, { timeout: 4 });
  assert.ok(h.ctrls.rhaenyra.x < F.x - 0.1, 'e ela não cabe na portinha de gato');
  watch();
  become(h, 'radhija');
  h.teleport('radhija', F.x - 0.7, (F.z0 + F.z1) / 2, Math.PI / 2);
  h.run(0.2);
  h.walkTo(F.x + 0.8, (F.z0 + F.z1) / 2, { timeout: 5, tol: 0.15 });
  assert.ok(h.ctrls.radhija.x > F.x + 0.3, `a Radhija passa pela portinha de gato (x ${h.ctrls.radhija.x.toFixed(2)})`);
  watch();
  assert.equal(S().flags.petGateOpen, false);
  h.walkTo(L.PET_PEDAL.x, L.PET_PEDAL.z, { timeout: 5, tol: 0.12, until: () => S().flags.petGateOpen });
  assert.ok(h.run(1.5, { until: () => S().flags.petGateOpen }) || S().flags.petGateOpen, 'o pedal solta a grade');
  h.run(1.2);
  assert.ok(S().doors.petGate > 0.9, `a grade abre e fica aberta (${S().doors.petGate})`);
  watch();
  // a Rhaenyra passa pela grade aberta
  become(h, 'rhaenyra');
  h.walkTo(G.hinge.x - 0.9, mid(G).z, { timeout: 6 });
  h.walkTo(G.hinge.x + 1.3, mid(G).z, { timeout: 6 });
  assert.ok(h.ctrls.rhaenyra.x > G.hinge.x + 0.6, 'a Rhaenyra passa para a cozinha');
  watch();
  // o saco de ração na frente da maçaneta: sem tirar, o pulo não alcança
  assert.equal(S().flags.sackFree, false);
  assert.deepEqual(h.puzzle.wallSpots(), [], 'com o saco na frente, não há onde apoiar as patas');
  const Sk = L.FOOD_SACK;
  h.teleport('rhaenyra', Sk.start.x, Sk.start.z + Sk.half + 0.26, Math.PI);
  h.run(0.2);
  assert.ok(push(h, [0, -1], 8, () => S().flags.sackFree), `a Rhaenyra empurra o saco para o lado (${JSON.stringify(S().pushables.sack)})`);
  watch();
  assert.equal(h.puzzle.wallSpots().length, 1, 'agora dá para alcançar a maçaneta');
  boost(h, L.KITCHEN_HANDLE);
  assert.ok(S().flags.kitchenOpen, 'o impulso na maçaneta abre a porta da cozinha');
  assert.equal(S().stage, 'quintal');
  h.run(1.0);
  watch();

  // 3. quintal: a porta do muro tem o ferrolho por fora; a passagem baixa do muro fica atrás do galho
  const Br = L.BRANCH, SD = L.SERVICE_DOOR, sd = mid(SD);
  assert.equal(h.log('objective').at(-1)?.text, 'Atrás dos pombos! Saiam pela porta do quintal');
  h.teleport('rhaenyra', sd.x - 0.2, sd.z + 0.75, Math.PI);
  h.run(0.2);
  h.tap('KeyE');
  h.run(0.5);
  assert.equal(S().flags.serviceOpen, false, 'o E na porta não abre: o ferrolho é por fora');
  assert.equal(h.log('objective').at(-1)?.text, 'Tem uma passagem no muro, atrás do galho');
  h.run(2.6); // o plano da câmera na passagem do muro
  // a Rhaenyra empurra o galho para o oeste, até perto da parede da casa
  h.teleport('rhaenyra', Br.start.x + Br.half + 0.24, Br.start.z, -Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [-1, 0], 10, () => S().flags.branchFree), `o galho sai da frente da passagem (${JSON.stringify(S().pushables.branch)})`);
  assert.ok(S().clues.includes('telhas'), 'as telhas da tempestade viram pista (caso 2)');
  assert.equal(h.log('objective').at(-1)?.text, 'O ferrolho fica do outro lado do muro');
  watch();
  // a Radhija passa pela passagem baixa do muro e puxa a argola do ferrolho com a boca
  become(h, 'radhija');
  const YG = L.YARD_GAP, gx = YG.x1 - 0.3;
  h.teleport('radhija', gx, YG.z + 0.75, Math.PI);
  h.run(0.2);
  h.walkTo(gx, YG.z - 0.85, { timeout: 5, tol: 0.15 });
  assert.ok(h.ctrls.radhija.z < YG.z - 0.3, `a Radhija sai do outro lado do muro (z ${h.ctrls.radhija.z.toFixed(2)})`);
  watch();
  const SB = L.SERVICE_BOLT;
  h.walkTo(SB.ring.x, SB.ring.z - 0.45, { timeout: 6, tol: 0.15 });
  h.tap('KeyE');
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), `a argola na boca (fase ${S().tug}, ${S().tugWhat})`);
  const lock = h.puzzle.lockFor('radhija');
  assert.ok(holdWorld(h, [lock.pull.ax, lock.pull.az], 6, () => S().flags.boltOpen), 'puxando a argola, o ferrolho corre');
  assert.ok(h.run(2, { until: () => S().flags.serviceOpen }), 'e a porta da área de serviço abre');
  assert.equal(S().stage, 'piscina');
  h.run(1.2);
  assert.equal(h.puzzle.lockFor('radhija'), null, 'a argola solta sozinha');
  watch();

  // 4. piscina: o pulso do Faro perto da piscina acha a marca da boia → a Reconstrução (caso 1)
  h.teleport('radhija', L.RECON.x - 0.9, L.RECON.z + 1.4, Math.PI);
  h.run(1.3);
  h.tap('KeyV');
  skipScene(h, 'reconstrucao');
  assert.ok(S().clues.includes('boia'), 'a boia (caso 1)');
  assert.equal(S().stage, 'varal');

  // 5. varal: o empurra-empurra da Rhaenyra no poste (Shift de frente para ele). Sem o cesto embaixo, sacudir o
  // varal não adianta (a Radhija avisa); com o cesto, no terceiro empurrão o pregador solta
  const P = L.POLE_SHOVE;
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', P.x, P.z + 0.5, Math.PI);
  h.run(0.2);
  holdWorld(h, [0, -1], 3.0, () => false, ['ShiftLeft']);
  assert.equal(S().scene, null, 'sem o cesto embaixo da cenoura, o pregador não solta');
  assert.equal(S().stage, 'varal');
  const C = L.LAUNDRY;
  h.teleport('rhaenyra', C.start.x - C.half - 0.26, C.start.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 14, () => S().flags.basketUnder), `a Rhaenyra põe o cesto embaixo da cenoura (${JSON.stringify(S().pushables.laundry)})`);
  watch();
  h.teleport('rhaenyra', P.x, P.z + 0.5, Math.PI);
  h.run(0.3);
  assert.ok(holdWorld(h, [0, -1], 6, () => !!S().scene, ['ShiftLeft']), `o empurra-empurra no poste solta o pregador (${JSON.stringify(S().flags)})`);
  skipScene(h, 'varal');
  assert.equal(S().stage, 'torre');

  // 6. torre: a porta só destrava com a senha do interfone; o Faro mostra o Farelo apertando
  become(h, 'rhaenyra');
  const TD = L.TOWER_DOOR, td = mid(TD);
  h.teleport('rhaenyra', TD.hinge.x - 0.36, td.z, Math.PI / 2);
  h.run(0.2);
  push(h, [1, 0], 1.2, () => false);
  assert.ok(S().doors.tower < 0.05, 'trancada, a porta de mola não abre');
  assert.equal(S().flags.towerUnlocked, false);
  h.teleport('rhaenyra', TD.hinge.x - 1.6, td.z + 1.2, Math.PI / 2);
  h.run(1.3);
  h.tap('KeyV'); // a Rhaenyra também fareja
  skipScene(h, 'senha');
  assert.ok(S().clues.includes('senha') && S().flags.codeSeen, 'a senha vira pista');
  const IC = L.INTERCOM;
  const spotOf = (id) => IC.buttons.find((b) => b.id === id);
  // na ordem da parede (errada): o interfone recusa
  for (const b of IC.buttons) boost(h, b);
  h.run(1.6);
  assert.equal(S().flags.towerUnlocked, false, 'a ordem errada não destrava');
  assert.deepEqual(S().code, [], 'e o interfone volta a esperar');
  // na ordem da senha
  for (const id of IC.code) { boost(h, spotOf(id)); watch(); }
  h.run(0.8);
  assert.equal(S().flags.towerUnlocked, true, 'a senha certa destrava a porta');
  // a Rhaenyra empurra a porta de mola; trocando para a Radhija com a irmã no vão, ela fica segurando
  h.teleport('rhaenyra', TD.hinge.x - 0.36, td.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 4, () => h.puzzle.navFlags().towerOpen), 'destrancada, a porta de mola abre com o empurrão');
  holdWorld(h, [1, 0], 0.3, () => false, ['ShiftLeft']);
  h.hold([1, 0], ['ShiftLeft']);
  h.tap('KeyQ'); // segurando: troca para a Radhija
  h.hold(null);
  assert.equal(h.game.activeDog, 'radhija');
  assert.equal(h.game.stay.rhaenyra, true, 'a Rhaenyra no vão fica segurando a porta (Fica automático)');
  h.run(1.0);
  assert.ok(S().doors.tower > 0.3, `com a irmã no vão, a mola não fecha (${S().doors.tower})`);
  watch();
  const T = L.TOWER_LOBBY;
  h.teleport('radhija', (T.x0 + T.x1) / 2 + 0.2, (T.z0 + T.z1) / 2 + 0.6, Math.PI / 2);
  // o terraço da torre: a chegada (cena) e o pega-pega jogável lá em cima (test/historia-telhado.test.mjs joga com as
  // teclas); aqui, de uma vez
  skipScene(h, 'telhadoChega');
  assert.ok(h.puzzle.rooftop.active, 'as duas estão no terraço');
  h.puzzle.rooftop.skipToEnd();
  h.run(0.3);
  assert.ok(S().clues.includes('tampa'), 'a tampa de borracha da caixa d’água sumiu (pista)');
  assert.equal(S().stage, 'portaria');

  // 7. portaria: de janela fechada nenhum latido entra; o Superbafo da Radhija pela grelha faz a janela abrir
  const B = L.BOOTH, bx = (B.x0 + B.x1) / 2;
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', bx + 0.4, B.awning.z1 + 0.9, Math.PI);
  h.run(0.3);
  h.tap('KeyE');
  h.run(0.5);
  assert.equal(S().scene, null, 'com a janela fechada, o latido grosso não entra');
  assert.equal(S().stage, 'portaria');
  become(h, 'radhija');
  const V = L.BOOTH_VENT;
  h.teleport('radhija', V.x - 0.75, V.z, Math.PI / 2);
  h.run(0.3);
  h.tap('KeyR');
  skipScene(h, 'cheiro');
  assert.equal(S().flags.windowOpen, true, 'o cheiro lá dentro faz a janela abrir');
  // de janela aberta: o latido fino da Radhija não acorda o porteiro; o grosso da Rhaenyra sim
  h.teleport('radhija', bx - 0.5, B.awning.z1 + 0.9, Math.PI);
  h.run(0.3);
  h.tap('KeyE');
  h.run(0.4);
  assert.equal(S().scene, null, 'o latido da Radhija não basta');
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', bx + 0.4, B.awning.z1 + 0.9, Math.PI);
  h.run(0.4);
  h.tap('KeyE');
  skipScene(h, 'porteiro');
  assert.equal(S().stage, 'fechamento');
  assert.equal(S().flags.gateOpen, true, 'o portãozinho aberto');

  // 8. fechamento: no portãozinho, os pombos voam para a cidade e a Rhaenyra segue a borboleta → o mural
  const Gt = L.GATE;
  h.teleport('rhaenyra', (Gt.x0 + Gt.x1) / 2, Gt.z + 0.6, Math.PI);
  skipScene(h, 'fechamento');
  assert.equal(S().stage, 'mural');
  const mural = h.log('story:mural').at(-1);
  assert.ok(mural?.open, 'o mural provisório abre');
  for (const id of ['pombos', 'pote', 'trilha', 'abraco']) assert.ok(mural.owned.includes(id), `cartão ${id} no mural`);
  assert.equal(h.puzzle.cinematic(), true, 'com o mural aberto, a entrada fica com ele');

  // o mural fecha (Continuar) → o fim do capítulo
  h.events.emit('ui:muralDone', { errors: 1, settled: true });
  h.run(0.2);
  assert.equal(S().stage, 'fim');
  const end = h.log('story:chapterEnd').at(-1);
  assert.ok(end, 'o fim do capítulo');
  assert.deepEqual({ chapter: end.chapter, title: end.title, hiddenTotal: end.hiddenTotal, socksTotal: end.socksTotal }, { chapter: 1, title: 'Cadê a Cenoura?', hiddenTotal: 2, socksTotal: 3 });
  assert.ok(end.clues >= 8, `pistas na lupa: ${end.clues}`);
  assert.deepEqual([...bad], [], 'ninguém atravessa nada no caminho');
  assert.equal(h.puzzle.lockFor('radhija'), null);
  assert.equal(h.puzzle.lockFor('rhaenyra'), null);
});

test('Faro: as duas farejam, e a nuvem de cheiro leva até a próxima pista de cada etapa', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const L = h.layout;
  const S = () => storyInfo(h);
  // com a Rhaenyra: o Faro liga, sem dica de "só a Radhija"
  become(h, 'rhaenyra');
  h.clearLog();
  h.run(1.3);
  h.tap('KeyV');
  h.run(0.4);
  const faro = h.log('story:faro');
  assert.equal(faro.length, 1, 'o pulso da Rhaenyra sai');
  assert.equal(faro[0].who, 'rhaenyra');
  // a nuvem sai dela e vai para o rastro dos pombos, lá fora (a pista seguinte), pelo caminho de dentro da casa
  const c = S().cloud;
  assert.ok(c.on && c.puffs >= 10, `a nuvem de cheiro aparece (${JSON.stringify(c)})`);
  assert.ok(near(c.lead, L.RECON, 0.1), 'e leva até a marca da piscina');
  assert.ok(c.total > 15, `o caminho é o de andar, não em linha reta por cima das paredes (${c.total} m)`);
  const mesh = h.engine.scene.getObjectByName('faro:nuvem-de-cheiro');
  assert.ok(mesh && mesh.visible && mesh.count === c.puffs, 'a malha da nuvem está na cena');
  // a nuvem acompanha quem fareja: trocando para a Radhija com o Faro aceso, sai dela
  become(h, 'radhija');
  h.run(0.5);
  assert.ok(S().cloud.on, 'a nuvem segue com a outra dog');
  // o modo Faro gasta o fôlego de quem fareja: em uns 8 s a Radhija cansa, o modo desliga e a nuvem some
  h.run(9.5);
  assert.equal(S().faroMode.on, false, 'sem fôlego, o Faro desliga sozinho');
  assert.equal(S().cloud.on, false, 'a nuvem some com ele');
  assert.ok(h.log('story:faroState').some((p) => p.tired), 'a Radhija funga cansada');
  h.tap('KeyV');
  h.run(0.3);
  assert.equal(S().faroMode.on, false, 'cansada, apertar não liga');
  assert.equal(h.log('story:faro').length, 1);
  // a irmã tem o fôlego dela: liga; e apertar de novo desliga
  become(h, 'rhaenyra');
  h.tap('KeyV');
  h.run(0.3);
  assert.equal(S().faroMode.on, true, 'com a Rhaenyra descansada, liga');
  assert.equal(h.log('story:faro').length, 2);
  h.tap('KeyV');
  h.run(0.5);
  assert.equal(S().faroMode.on, false, 'apertar de novo desliga');
  // em cada etapa, a nuvem aponta a pista certa
  const leadAt = (stage, at = null) => {
    h.game.debug.setStage(stage, 'radhija');
    if (at) h.teleport('radhija', at.x, at.z, 0);
    h.run(1.4);
    h.tap('KeyV');
    h.run(0.4);
    return S().cloud.lead;
  };
  assert.ok(near(leadAt('varal'), L.CARROT_PIN, 0.6), 'no varal: a cenoura');
  // na torre, de longe (de perto, o próprio pulso já mostra a Reconstrução da senha)
  assert.ok(near(leadAt('torre', L.NAV_NODES.P_south), L.INTERCOM.recon, 0.1), 'na torre, sem a senha: o lugar da Reconstrução');
  const gate = { x: (L.GATE.x0 + L.GATE.x1) / 2, z: L.GATE.z };
  assert.ok(near(leadAt('fechamento'), gate, 1.0), 'no fim: o portãozinho');
});

test('pistas escondidas: a baba no parapeito de dentro e o ralo sem rolha, só com o Faro de perto e examinando', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const L = h.layout;
  const S = () => storyInfo(h);
  assert.ok(!S().clues.includes('baba'));
  // do meio do quarto: a baba não aparece
  h.teleport('radhija', L.BED.x + 2.6, L.BED.z + 3.6, 0);
  assert.ok(!sniff(h).includes('baba'), 'de longe, a baba não aparece');
  if (S().faroMode?.on) h.tap('KeyV'); // desliga o Faro (o fôlego volta)
  h.run(1.0);
  // pertinho do parapeito de dentro, no chão do quarto ao lado da caminha
  h.teleport('radhija', L.BED.x + L.BED.r + 0.2, L.WINDOW.z + 0.5, -Math.PI / 2);
  assert.ok(sniff(h).includes('baba'), 'de perto, o Faro revela a baba');
  assert.ok(!S().clues.includes('baba'), 'revelada ainda não é pista: falta examinar');
  assert.ok(S().faro.pinned.includes('baba'), 'e continua brilhando depois do pulso');
  assert.ok(examine(h, 'baba'), 'examinada, a baba (escondida) entra na lupa');
  assert.ok(!S().faro.pinned.includes('baba'), 'e para de brilhar');
  // o ralo do tanque, na área de serviço (com as portas abertas)
  h.game.debug.setStage('varal', 'radhija');
  h.run(0.2);
  h.teleport('radhija', L.DRAIN.x + 0.8, L.TANKS.z1 + 0.9, Math.PI);
  assert.ok(sniff(h).includes('ralo'), 'o Faro revela o ralo');
  assert.ok(examine(h, 'ralo'), 'o ralo sem rolha (escondida, caso 1)');
  assert.deepEqual(intrusions(h), []);
});

test('paralelo A: o latido distrai a Dona Gansa, a Rhaenyra empurra o barquinho até o canal e só a Radhija atravessa para a ilha', async () => {
  const h = await createStoryGame({ query: 'stage=portaria' });
  const L = h.layout;
  const S = () => storyInfo(h);
  const bad = new Set();
  const watch = () => { for (const m of intrusions(h)) bad.add(m); };
  // a Radhija late de longe, a oeste do píer: a gansa vai ver o que é
  become(h, 'radhija');
  h.teleport('radhija', L.PIER.x0 - 2.0, (L.PIER.z0 + L.PIER.z1) / 2, Math.PI / 2);
  h.run(0.3);
  h.tap('KeyE');
  h.run(0.5);
  assert.notEqual(S().goose, 'patrol', `a gansa deixa a patrulha (${S().goose})`);
  // a Rhaenyra empurra o barquinho pela margem sul até a frente do canal; ele encaixa e vira ponte
  become(h, 'rhaenyra');
  h.tap('KeyF'); // a Radhija espera onde está
  const Bt = L.BOAT;
  const boatAt = () => h.props.boat.object.position;
  h.teleport('rhaenyra', Bt.start.x - Bt.half - 0.24, Bt.start.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 16, () => boatAt().x >= Bt.dock.x - 0.1), `pela margem até a frente do canal (x ${boatAt().x.toFixed(2)}, gansa: ${S().goose})`);
  watch();
  // de frente para o canal, um empurrão para o norte: ele entra no canal e vira ponte
  h.teleport('rhaenyra', boatAt().x, Bt.start.z + Bt.half + 0.24, Math.PI);
  h.run(0.2);
  const docked = push(h, [0, -1], 4, () => S().flags.boatDocked);
  watch();
  assert.ok(docked, `o barquinho encaixa no canal (gansa: ${S().goose})`);
  // a Rhaenyra não cabe no barquinho
  h.teleport('rhaenyra', Bt.dock.x, L.CHANNEL.z1 + 0.5, Math.PI);
  h.run(0.2);
  h.walkTo(Bt.dock.x, L.CHANNEL.z0 - 0.4, { timeout: 4 });
  assert.ok(h.ctrls.rhaenyra.z > L.CHANNEL.z1 - 0.05, `a Rhaenyra fica na margem (z ${h.ctrls.rhaenyra.z.toFixed(2)})`);
  // a Radhija atravessa e pega o petisco da ilha
  h.teleport('rhaenyra', Bt.dock.x + 1.2, L.CHANNEL.z1 + 0.9, Math.PI);
  become(h, 'radhija');
  h.teleport('radhija', Bt.dock.x, L.CHANNEL.z1 + 0.45, Math.PI);
  h.run(0.2);
  const before = h.puzzle.collected;
  h.walkTo(Bt.dock.x, L.CHANNEL.z0 - 0.5, { timeout: 6 });
  assert.ok(h.ctrls.radhija.z < L.CHANNEL.z0, `a Radhija chega à ilha pelo barquinho (z ${h.ctrls.radhija.z.toFixed(2)})`);
  const treat = L.COLLECTIBLES.find((c) => c.id === 'ilha');
  h.walkTo(treat.x, treat.z, { timeout: 6 });
  assert.equal(h.puzzle.collected, before + 1, 'o petisco da ilha');
  watch();
  assert.deepEqual([...bad], [], 'ninguém atravessa nada');
});

test('paralelo B: a Rhaenyra leva a lixeira até o toldo e segura (Fica); a Radhija sobe e pega a meia da antena', async () => {
  const h = await createStoryGame({ query: 'stage=portaria&dog=rhaenyra' });
  const L = h.layout;
  const S = () => storyInfo(h);
  const binPos = () => h.props.bin.object.position;
  const Bn = L.BIN, Sp = L.BIN_SPOT;
  const tx = (Sp.x0 + Sp.x1) / 2, tz = (Sp.z0 + Sp.z1) / 2;
  become(h, 'rhaenyra');
  // para o leste, pela frente da torre
  h.teleport('rhaenyra', Bn.start.x - Bn.half - 0.26, Bn.start.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 12, () => binPos().x >= tx), `a lixeira vai para o leste (x ${binPos().x.toFixed(2)})`);
  // para o norte, até encostar no toldo da guarita
  const bx = binPos().x;
  h.teleport('rhaenyra', bx, binPos().z + Bn.half + 0.26, Math.PI);
  h.run(0.2);
  assert.ok(push(h, [0, -1], 12, () => binPos().z <= tz), `a lixeira encosta no toldo (z ${binPos().z.toFixed(2)})`);
  const p = binPos();
  assert.ok(p.x >= Sp.x0 && p.x <= Sp.x1 && p.z >= Sp.z0 - 0.05 && p.z <= Sp.z1, `no lugar (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
  // sem a irmã segurando, a lixeira escapa
  become(h, 'radhija');
  h.teleport('radhija', p.x + Bn.half + 0.45, p.z, -Math.PI / 2);
  h.run(0.2);
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(S().climb, null, 'sem a Rhaenyra no Fica, a Radhija não sobe');
  // com a irmã no Fica, encostada na lixeira
  h.game.setStay('rhaenyra', true);
  const q = binPos();
  h.teleport('rhaenyra', q.x, q.z + Bn.half + 0.3, Math.PI);
  h.teleport('radhija', q.x + Bn.half + 0.45, q.z, -Math.PI / 2);
  h.run(0.2);
  h.tap('KeyE');
  h.run(0.1);
  assert.notEqual(S().climb, null, 'a Radhija sobe pela lixeira e pelo toldo');
  const bad = new Set();
  assert.ok(h.run(12, { until: () => { for (const m of intrusions(h)) bad.add(m); return S().climb === null; } }), 'a subida termina');
  assert.ok(S().socks.includes('antena'), 'a meia da antena');
  assert.deepEqual([...bad], [], 'ninguém atravessa nada na subida');
  assert.equal(h.puzzle.lockFor('radhija'), null, 'a Radhija volta ao controle');
  assert.equal(h.ctrls.radhija.y || 0, 0, 'no chão');
});

test('paralelo C: a corda debaixo da caminhonete derruba o balde na bola; a porta do depósito abre e a meia está lá', async () => {
  const h = await createStoryGame({ query: 'stage=portaria' });
  const L = h.layout;
  const S = () => storyInfo(h);
  // a Rhaenyra empurra a porta: a bola entalada não deixa
  become(h, 'rhaenyra');
  const SD = L.STORAGE_DOOR;
  const midZ = (SD.hinge.z + SD.latchPost.z) / 2;
  h.teleport('rhaenyra', SD.hinge.x - 0.36, midZ, Math.PI / 2);
  h.run(0.2);
  push(h, [1, 0], 1.5, () => false);
  assert.equal(S().flags.storageOpen, false, 'com a bola atrás, a porta não abre');
  // a Radhija morde a corda debaixo da caminhonete e puxa
  h.teleport('rhaenyra', SD.hinge.x - 0.9, midZ + 0.9, Math.PI / 2);
  become(h, 'radhija');
  const E = L.ROPE.end;
  h.teleport('radhija', E.x - 0.2, E.z - 0.15, Math.PI / 2);
  h.run(0.2);
  h.tap('KeyE');
  // ela vai até a corda (o passinho), morde e segura
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), `a corda na boca (fase ${storyInfo(h).tug})`);
  assert.equal(S().tugWhat, 'corda');
  const lock = h.puzzle.lockFor('radhija');
  // a ponta da corda desenhada fica na boca dela enquanto puxa (o reset do jogo, no começo, soltava essa ligação:
  // retorno do usuário em 2026-11-11, "Radhija não está com as cordas na boca quando ela está puxando")
  const mouth = new THREE.Vector3();
  const tipGap = () => {
    h.dogs.radhija.mouthSocket.getWorldPosition(mouth);
    const t = h.props.rope.tip();
    return Math.hypot(t.x - mouth.x, t.y - mouth.y, t.z - mouth.z);
  };
  let worstTip = 0;
  assert.ok(holdWorld(h, [lock.pull.ax, lock.pull.az], 6, () => {
    if (h.puzzle.lockFor('radhija')?.pull) worstTip = Math.max(worstTip, tipGap());
    return S().flags.ballClear;
  }), 'puxando, o balde cai e a bola rola para longe da porta');
  assert.ok(worstTip < 0.05, `a corda na boca o puxão inteiro (pior distância ${(worstTip * 100).toFixed(1)} cm)`);
  h.run(0.3);
  assert.equal(h.puzzle.lockFor('radhija'), null, 'a corda solta sozinha');
  // agora a porta abre
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', SD.hinge.x - 0.36, midZ, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 4, () => S().flags.storageOpen), 'a porta do depósito abre');
  // a meia do depósito
  become(h, 'radhija');
  const sock = L.SOCKS.find((s) => s.id === 'deposito');
  h.teleport('radhija', SD.hinge.x + 0.5, midZ, Math.PI / 2);
  h.run(0.2);
  h.walkTo(sock.x, sock.z, { timeout: 8, until: () => S().socks.includes('deposito') });
  assert.ok(S().socks.includes('deposito'), 'a meia do depósito');
  assert.deepEqual(intrusions(h), []);
});

test('meia da casinha e petiscos: só a Radhija entra na casinha do quintal; os cinco petiscos existem', async () => {
  const h = await createStoryGame({ query: 'stage=piscina' });
  const L = h.layout;
  const S = () => storyInfo(h);
  const D = L.DOGHOUSE;
  // a Rhaenyra não cabe na porta da casinha
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', D.x - D.hx - 0.5, D.z, Math.PI / 2);
  h.run(0.2);
  h.walkTo(D.x, D.z, { timeout: 3 });
  assert.ok(!near(h.ctrls.rhaenyra, D, D.hx - 0.05), 'a Rhaenyra fica do lado de fora');
  assert.ok(!S().socks.includes('casinha'));
  // a Radhija entra
  h.teleport('rhaenyra', D.x - D.hx - 0.9, D.z - 1.1, Math.PI / 2);
  become(h, 'radhija');
  h.teleport('radhija', D.x - D.hx - 0.45, D.z, Math.PI / 2);
  h.run(0.2);
  const sock = L.SOCKS.find((s) => s.id === 'casinha');
  h.walkTo(sock.x, sock.z, { timeout: 5, until: () => S().socks.includes('casinha') });
  assert.ok(S().socks.includes('casinha'), 'a meia da casinha');
  assert.equal(h.puzzle.total, 5, 'cinco petiscos no capítulo');
  // o da mesa da cozinha: só a Radhija passa por baixo dela
  const treat = L.COLLECTIBLES.find((c) => c.id === 'mesa');
  const before = h.puzzle.collected;
  h.teleport('radhija', treat.x, treat.z + 0.9, Math.PI);
  h.run(0.2);
  h.walkTo(treat.x, treat.z, { timeout: 4 });
  assert.equal(h.puzzle.collected, before + 1, 'o petisco embaixo da mesa da cozinha');
  assert.deepEqual(intrusions(h), []);
});

test('o botão do focinho (toque, só no Modo História) solta o Faro de quem está com a jogadora', async () => {
  const h = await createStoryGame({ query: 'stage=casa&dog=rhaenyra' });
  h.run(1.3);
  h.clearLog();
  assert.equal(h.game.input.touch.press('faro'), true, 'o botão existe no Modo História');
  h.step();
  h.game.input.touch.release('faro');
  h.step();
  const f = h.log('story:faro');
  assert.ok(f.length >= 1, 'o pulso saiu pelo botão do focinho');
  assert.equal(f[0].who, h.game.activeDog, 'da dog que está com a jogadora');
});
