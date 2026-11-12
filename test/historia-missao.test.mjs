// Modo História (etapa 2): a missão do capítulo 1 no jogo de verdade (headless, cenário do Recanto), com os controles
// de verdade. A investigação e os puzzles de causa e efeito, na ordem:
//   quarto (farejar com V, examinar com E a trilha, o pote e a pena) → casa (a Radhija pela portinha de gato, o pedal
//   solta a grade; a Rhaenyra empurra o saco de ração e pula na maçaneta; o latido manda o aspirador robô para a base;
//   o impulso no interruptor acende a despensa; a Radhija puxa a toalha e a lata cai; o pufe até o sofá, a Radhija sobe
//   até o trinco e a Rhaenyra empurra a porta dos fundos) → quintal (o jabuti e a alface, a irrigação e o registro, o
//   galho; a Radhija pela passagem do muro puxa a argola do ferrolho) → piscina (o Faro e a Reconstrução) → varal (o cesto embaixo da cenoura e a
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
  h.teleport('rhaenyra', Sk.start.x - Sk.half - 0.26, Sk.start.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 8, () => S().flags.sackFree), `a Rhaenyra empurra o saco para o lado (${JSON.stringify(S().pushables.sack)})`);
  watch();
  assert.equal(h.puzzle.wallSpots().length, 1, 'agora dá para alcançar a maçaneta');
  boost(h, L.KITCHEN_HANDLE);
  assert.ok(S().flags.kitchenOpen, 'o impulso na maçaneta abre a porta da cozinha');
  assert.equal(S().stage, 'casa', 'a porta da cozinha dá no corredor: a casa continua');
  // a porta acorda o aspirador robô (cena); a Radhija morre de medo dele, e o latido grosso da Rhaenyra o manda
  // para a base
  skipScene(h, 'aspirador');
  h.run(0.3);
  assert.equal(h.log('objective').at(-1)?.text, 'Um aspirador robô! A Radhija morre de medo dele');
  const KD = L.KITCHEN_DOOR, kd = mid(KD);
  h.teleport('rhaenyra', kd.x - 0.1, kd.z + 0.85, 0);
  h.run(8, { until: () => { watch(); const v = S().casa.vac; return Math.hypot(v.x - h.ctrls.rhaenyra.x, v.z - h.ctrls.rhaenyra.z) < L.VACUUM.barkR - 0.4; } });
  h.tap('KeyE');
  h.run(0.2);
  assert.equal(S().casa.vacuum, 'scared', 'o latido grosso assusta o aspirador');
  assert.ok(h.run(15, { until: () => { watch(); return S().casa.vacuum === 'docked'; } }), 'e ele volta para a base');
  // a despensa no escuro: o impulso da Rhaenyra no interruptor alto acende a luz, e a goteira aparece
  assert.equal(h.log('objective').at(-1)?.text, 'A despensa está no escuro: acendam a luz');
  boost(h, L.PANTRY.switch);
  assert.ok(S().casa.pantryLit, 'a luz da despensa acende');
  assert.ok(S().revealed.includes('goteira'), 'a goteira brilha');
  watch();
  // a sala de jantar: a Radhija puxa a toalha, a lata cai e dela saem o petisco e a etiqueta
  become(h, 'radhija');
  const TC = L.TABLECLOTH;
  h.teleport('radhija', TC.bite.x + 0.45, TC.bite.z + 0.05, -Math.PI / 2);
  h.run(0.3);
  h.tap('KeyE');
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), `a toalha na boca (fase ${S().tug})`);
  const cloth = h.puzzle.lockFor('radhija');
  assert.ok(holdWorld(h, [cloth.pull.ax, cloth.pull.az], 6, () => { watch(); return S().casa.tin !== 'mesa'; }), 'puxando a toalha, a lata cai');
  assert.ok(h.run(3, { until: () => { watch(); return S().casa.tin === 'chao'; } }), 'a lata para no chão');
  h.run(0.3);
  assert.ok(examine(h, 'etiqueta'), 'a etiqueta da cenoura vira pista');
  watch();
  // a sala de estar: a Rhaenyra leva o pufe até o sofá; a Radhija sobe até o trinco; a Rhaenyra empurra a porta
  const PF = L.POUF, EX = L.HOUSE_EXIT, ez = (EX.z0 + EX.z1) / 2;
  h.teleport('radhija', -15.6, 16.2, Math.PI / 2);
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', PF.start.x, PF.start.z + PF.half + 0.26, Math.PI);
  h.run(0.2);
  assert.ok(push(h, [0, -1], 8, () => S().casa.pouf.z <= PF.minZ + 0.02), `o pufe vai para o norte (${JSON.stringify(S().casa.pouf)})`);
  h.teleport('rhaenyra', S().casa.pouf.x - PF.half - 0.26, S().casa.pouf.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 10, () => S().casa.poufAtSofa), `o pufe encosta no sofá (${JSON.stringify(S().casa.pouf)})`);
  watch();
  h.teleport('rhaenyra', -14.0, 18.9, Math.PI / 2);
  become(h, 'radhija');
  h.teleport('radhija', S().casa.pouf.x - 0.7, S().casa.pouf.z, Math.PI / 2);
  h.run(0.3);
  h.tap('KeyE');
  assert.ok(h.run(10, { until: () => { watch(); return S().casa.latchOpen && S().casa.climb === null; } }), 'a Radhija sobe pelo pufe e abre o trinco');
  h.teleport('radhija', EX.x - 1.4, ez - 0.6, Math.PI / 2);
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', EX.x - 0.5, ez, Math.PI / 2);
  h.run(0.2);
  assert.ok(holdWorld(h, [1, 0], 4, () => !!S().scene, ['ShiftLeft']), 'destrancada, a Rhaenyra empurra a porta dos fundos');
  skipScene(h, 'portaFundos');
  assert.equal(S().stage, 'quintal');
  h.run(1.0);
  watch();

  // 3. quintal: as duas saem pela porta dos fundos, andando; do lado de fora, a cena da chegada. Depois, o quintal
  // maior inteiro com os controles de verdade (yardChain): o jabuti, a alface, a irrigação, o registro, o galho e a
  // argola do ferrolho, até a porta da área de serviço
  become(h, 'radhija');
  h.walkTo(EX.x - 0.45, ez, { timeout: 5, tol: 0.2 });
  h.walkTo(EX.x + 1.36, EX.z0 + 0.15, { timeout: 6, tol: 0.2 });
  assert.ok(h.ctrls.radhija.x > EX.x + 0.6, `a Radhija sai pela porta dos fundos (x ${h.ctrls.radhija.x.toFixed(2)})`);
  watch();
  assert.ok(h.run(3, { until: () => !!S().scene }), 'do lado de fora, a cena da chegada ao quintal');
  skipScene(h, 'quintalChega');
  become(h, 'rhaenyra');
  h.walkTo(EX.x - 0.45, ez, { timeout: 5, tol: 0.2 });
  h.walkTo(EX.x + 0.6, ez, { timeout: 5, tol: 0.2 });
  h.walkTo(EX.x + 1.31, EX.z1 + 0.05, { timeout: 6, tol: 0.2 });
  assert.ok(h.ctrls.rhaenyra.x > EX.x + 0.6, `a Rhaenyra também sai (x ${h.ctrls.rhaenyra.x.toFixed(2)})`);
  watch();
  // (os lugares exatos de onde o teste do quintal maior começa)
  h.teleport('rhaenyra', EX.x + 1.31, EX.z1 + 0.05, Math.PI / 2);
  become(h, 'radhija');
  h.teleport('radhija', EX.x + 1.36, EX.z0 + 0.15, Math.PI / 2);
  h.run(0.3);
  yardChain(h, watch, { intro: false });
  assert.equal(S().stage, 'piscina');

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
  // as escondidas: a baba, o ralo, a goteira da despensa, a etiqueta da lata e a rabiola da pipa do quintal; as meias:
  // antena, depósito, casinha e a do baldão
  assert.deepEqual({ chapter: end.chapter, title: end.title, hiddenTotal: end.hiddenTotal, socksTotal: end.socksTotal }, { chapter: 1, title: 'Cadê a Cenoura?', hiddenTotal: 5, socksTotal: 4 });
  assert.ok(end.clues >= 8, `pistas na lupa: ${end.clues}`);
  assert.deepEqual([...bad], [], 'ninguém atravessa nada no caminho');
  assert.equal(h.puzzle.lockFor('radhija'), null);
  assert.equal(h.puzzle.lockFor('rhaenyra'), null);
});

/**
 * O quintal maior (4ª rodada), com os controles de verdade: da porta dos fundos até a porta da área de serviço (da etapa
 * 'quintal' à 'piscina'). Começa com as duas do lado de fora da porta dos fundos (nos lugares de STAGE_SPOTS.quintal), a
 * Radhija com a jogadora e, se `intro`, a cena da chegada a ponto de começar. Usado pela missão inteira (depois da casa)
 * e pelo teste do quintal maior.
 *   o jabuti na passagem da horta → a alface (a Rhaenyra segura com o Fica, a Radhija puxa) → a folha para o Seu Bento
 *   → a irrigação (a Rhaenyra tampa o aspersor do meio, a Radhija passa no tempo certo) → o registro → o galho, a
 *   passagem baixa e a argola do ferrolho.
 */
function yardChain(h, watch, { intro = true } = {}) {
  const L = h.layout;
  const S = () => storyInfo(h);
  const Y = () => S().yard;
  const yard = h.puzzle.quintal;
  /** Anda pelos pontos, olhando o "nada atravessa nada" a cada trecho. */
  const walk = (pts, o = {}) => { for (const [x, z] of pts) { h.walkTo(x, z, { timeout: 10, ...o }); watch(); } };
  const JB = L.JABUTI, LT = L.LETTUCE, SP = L.SPRINKLERS, VV = L.VALVE;
  // 0. a cena da chegada: o quintal dos fundos, o jabuti e os aspersores
  if (intro) skipScene(h, 'quintalChega');
  assert.equal(h.log('objective').at(-1)?.text, 'Um jabuti dorme na passagem da horta');

  // 1. o jabuti tapa a passagem estreita da horta: nem a Radhija passa
  walk([[-9.0, 17.95], [JB.x, 17.5]]);
  holdWorld(h, [0, -1], 2.0, () => false);
  assert.ok(h.ctrls.radhija.z > JB.z + 0.25, `o jabuti segura a Radhija do lado sul (z ${h.ctrls.radhija.z.toFixed(2)})`);
  watch();
  h.tap('KeyE'); // conversa com o Seu Bento
  h.run(0.5);
  assert.equal(Y().metJabuti, true);
  assert.equal(h.log('objective').at(-1)?.text, 'O Seu Bento quer alface: peguem uma folha na horta');

  // 2. a alface: sozinha, a Radhija puxa e o pé inteiro escapa
  walk([[-9.6, 18.4], [-10.4, 21.1], [-12.6, 22.05], [LT.x + 0.45, 22.3]]);
  h.walkTo(LT.bite.x, LT.bite.z - 0.42, { timeout: 5, tol: 0.15 });
  h.tap('KeyE');
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), `a folha na boca (fase ${S().tug})`);
  let lock = h.puzzle.lockFor('radhija');
  holdWorld(h, [lock.pull.ax, lock.pull.az], 4, () => !h.puzzle.lockFor('radhija')?.pull);
  h.run(0.6);
  assert.equal(Y().leaf, 'pe', 'sem a irmã segurando, a alface inteira estica e escapa');
  watch();
  // a Rhaenyra vem segurar o pé: trocando para a Radhija com ela ali, ela fica (Fica automático)
  become(h, 'rhaenyra');
  walk([[-13.0, 22.0], [LT.x + 0.62, 22.32]]);
  become(h, 'radhija');
  assert.equal(h.game.stay.rhaenyra, true, 'a Rhaenyra fica segurando o pé de alface');
  h.walkTo(LT.bite.x - 0.05, LT.bite.z - 0.42, { timeout: 5, tol: 0.15 });
  h.tap('KeyE');
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), 'a folha na boca de novo');
  lock = h.puzzle.lockFor('radhija');
  holdWorld(h, [lock.pull.ax, lock.pull.az], 4, () => Y().leaf === 'boca');
  assert.equal(Y().leaf, 'boca', 'com a irmã segurando, a folha solta: vai na boca da Radhija');
  assert.ok(h.dogs.radhija.mouthSocket.children.some((o) => o.name === 'alface:folha'), 'a folha pendurada na boca dela');
  h.run(0.4);
  watch();

  // 3. a folha para o Seu Bento: a cena, e ele sai da passagem devagar (para quando alguém está na frente)
  walk([[-12.6, 22.05], [-10.4, 21.1], [-9.3, 18.3], [JB.x, 17.45]]);
  h.tap('KeyE');
  skipScene(h, 'quintalJabuti');
  assert.equal(Y().leaf, 'jabuti');
  assert.equal(Y().jabuti.phase, 'anda', 'ele começa a andar');
  assert.equal(h.log('objective').at(-1)?.text, 'O Seu Bento está saindo… devagarinho');
  assert.ok(h.run(20, { until: () => storyInfo(h).yard.jabuti.moved }), `o jabuti sai da passagem (${JSON.stringify(Y().jabuti)})`);
  watch();
  assert.ok(h.puzzle.navFlags().jabutiMoved);

  // 4. a irrigação: sozinha, a Radhija não atravessa (o jato da frente a barra, e quem liga em cima dela a molha)
  become(h, 'radhija');
  h.game.setStay('rhaenyra', false);
  walk([[JB.x, 17.4], [JB.x, 15.35]]);
  const wet0 = Y().irrigation.wet;
  holdWorld(h, [0, -1], 7, () => h.ctrls.radhija.z < SP.lane.z0);
  assert.ok(h.ctrls.radhija.z > SP.heads[0].z, `sozinha, a Radhija não passa do jardim (z ${h.ctrls.radhija.z.toFixed(2)}, molhadas ${Y().irrigation.wet - wet0})`);
  h.run(1.6);
  watch();
  // a Rhaenyra senta em cima do aspersor do meio (passa molhada mesmo) e, trocando, fica tampando
  become(h, 'rhaenyra');
  walk([[JB.x, 15.4], [SP.heads[1].x, SP.heads[1].z]], { tol: 0.12 });
  become(h, 'radhija');
  assert.ok(h.run(1.0, { until: () => storyInfo(h).yard.irrigation.plugged === 'meio' }), `a Rhaenyra tampa o do meio (${JSON.stringify(Y().irrigation)})`);
  assert.equal(h.log('objective').at(-1)?.text, 'Os aspersores ligam um depois do outro: a Radhija não passa molhada');
  // de volta para a frente do jardim; espera o do sul desligar, passa até a irmã, espera o do norte e passa
  walk([[JB.x, 15.3]]);
  const wet1 = Y().irrigation.wet;
  assert.ok(h.run(8, { until: () => { const u = yard.headState(2).u; return u >= 2.45 && u < 2.6; } }), 'o do sul desliga');
  walk([[-8.72, 12.0]], { tol: 0.12 });
  assert.ok(h.ctrls.radhija.z < 12.4, `a Radhija espera ao lado da irmã, no seco (z ${h.ctrls.radhija.z.toFixed(2)})`);
  assert.ok(h.run(8, { until: () => { const u = yard.headState(0).u; return u >= 2.45 && u < 2.6; } }), 'o do norte desliga');
  walk([[-8.5, 9.6], [-8.4, 8.0]], { tol: 0.15 });
  assert.ok(h.ctrls.radhija.z < SP.lane.z0, `a Radhija atravessou o jardim (z ${h.ctrls.radhija.z.toFixed(2)})`);
  assert.equal(Y().irrigation.wet, wet1, 'sem se molhar');
  assert.equal(h.log('objective').at(-1)?.text, 'Fechem o registro da irrigação');
  watch();
  // 5. o registro: só o focinho da Radhija cabe; a irrigação desliga e a irmã levanta
  h.walkTo(VV.at.x, VV.at.z, { timeout: 5, tol: 0.15 });
  h.tap('KeyE');
  h.run(1.0);
  assert.equal(Y().irrigation.off, true, 'a irrigação desligou');
  assert.equal(h.game.stay.rhaenyra, false, 'a Rhaenyra levanta do aspersor');
  assert.ok(h.puzzle.navFlags().irrigationOff);
  // a Rhaenyra atravessa o jardim (seco agora)
  become(h, 'rhaenyra');
  walk([[SP.heads[1].x, 10.0], [-8.3, 7.4]]);
  assert.ok(h.ctrls.rhaenyra.z < SP.lane.z0, 'a Rhaenyra também atravessa');
  watch();

  // 6. o final de antes: a porta trancada por fora, o galho na frente da passagem do muro, a argola do ferrolho
  const Br = L.BRANCH, SD = L.SERVICE_DOOR, sd = mid(SD);
  walk([[sd.x - 0.2, sd.z + 0.8]]);
  h.tap('KeyE');
  h.run(0.5);
  assert.equal(h.log('objective').at(-1)?.text, 'Tem uma passagem no muro, atrás do galho');
  h.run(2.6);
  walk([[Br.start.x + Br.half + 0.6, Br.start.z + 0.5], [Br.start.x + Br.half + 0.24, Br.start.z]], { tol: 0.1 });
  assert.ok(push(h, [-1, 0], 10, () => S().flags.branchFree), `o galho sai da frente da passagem (${JSON.stringify(S().pushables.branch)})`);
  watch();
  become(h, 'radhija');
  const YG = L.YARD_GAP, gx = YG.x1 - 0.3;
  walk([[gx, YG.z + 0.75], [gx, YG.z - 0.85]], { tol: 0.15 });
  assert.ok(h.ctrls.radhija.z < YG.z - 0.3, 'a Radhija sai pela passagem baixa');
  const SB = L.SERVICE_BOLT;
  h.walkTo(SB.ring.x, SB.ring.z - 0.45, { timeout: 6, tol: 0.15 });
  h.tap('KeyE');
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), 'a argola na boca');
  lock = h.puzzle.lockFor('radhija');
  assert.ok(holdWorld(h, [lock.pull.ax, lock.pull.az], 6, () => S().flags.boltOpen), 'puxando a argola, o ferrolho corre');
  assert.ok(h.run(2, { until: () => S().flags.serviceOpen }), 'e a porta da área de serviço abre');
  assert.equal(S().stage, 'piscina');
  h.run(1.0);
  watch();
}

/** O quintal maior sozinho: começa na etapa 'quintal' (?stage=quintal), do lado de fora da porta dos fundos. */
test('quintal maior: da porta dos fundos à porta da área de serviço, com o jabuti, a alface e a irrigação', async () => {
  const h = await createStoryGame({ query: 'stage=quintal' });
  const L = h.layout;
  const S = () => storyInfo(h);
  const bad = new Set();
  const watch = () => { for (const m of intrusions(h)) bad.add(`[${S().stage}] ${m}`); };
  const E = L.HOUSE_EXIT;
  assert.equal(S().stage, 'quintal');
  assert.ok(h.ctrls.radhija.x > E.x && Math.abs(h.ctrls.radhija.z - (E.z0 + E.z1) / 2) < 1, 'as duas começam do lado de fora da porta dos fundos');
  yardChain(h, watch);
  assert.deepEqual([...bad], [], 'ninguém atravessa nada no quintal');
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
  // a nuvem sai dela e vai para o próximo passo da casa: com a Rhaenyra presa no quarto, a grade (o resto da casa está
  // em test/historia-casa.test.mjs)
  const c = S().cloud;
  assert.ok(c.on && c.puffs >= 2, `a nuvem de cheiro aparece (${JSON.stringify(c)})`);
  assert.ok(near(c.lead, mid(L.PET_GATE), 0.1), 'e leva até a grade');
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
  // no quintal (a casa resolvida), de dentro do quarto: a marca da piscina, pelo caminho de andar (pela casa e pela
  // porta dos fundos), não em linha reta por cima das paredes
  assert.ok(near(leadAt('quintal', { x: L.BED.x + 1.6, z: L.BED.z + 2.0 }), L.RECON, 0.1), 'no quintal: a marca da piscina');
  assert.ok(S().cloud.puffs >= 10 && S().cloud.total > 15, `o caminho é o de andar (${JSON.stringify(S().cloud)})`);
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
