// Modo História (etapa 2): a missão do capítulo 1 no jogo de verdade (headless, cenário do Recanto), com os controles
// de verdade: o impulso da Rhaenyra na maçaneta, o empurrão no galho, o E na porta da área de serviço, o pulso do Faro
// na piscina, a arrancada no poste do varal, a porta de mola da torre, o latido grave na guarita e o portãozinho; o
// mural no fim (só fecha o que dá) e o fim do capítulo. E os três enigmas paralelos: o barquinho até a ilha (com a
// Dona Gansa distraída por um latido), a lixeira e o toldo até a meia da antena, a corda, o balde e a bola até a
// meia do depósito. As cenas são puladas aqui (o teste das cenas confere que pular dá no mesmo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoryGame, storyInfo, playScene, intrusions } from './helpers/historia.mjs';

const near = (c, p, r) => Math.hypot(c.x - p.x, c.z - p.z) <= r;
/**
 * Segura uma direção do MUNDO (com as teclas extras) até `until` ou `sec` s, recalculando as teclas a cada quadro: em
 * 3ª pessoa a câmera gira e a mesma tecla aponta para outro lado.
 */
function holdWorld(h, dir, sec, until, extra = []) {
  const n = Math.max(1, Math.round(sec * 60));
  let ok = false;
  for (let i = 0; i < n; i++) {
    h.hold(dir, extra);
    h.step();
    if (until(h)) { ok = true; break; }
  }
  h.hold(null);
  return ok;
}
/** Segura a direção (do mundo) com Shift (empurrar) até `until` ou `sec` s. */
function push(h, dir, sec, until) {
  const ok = holdWorld(h, dir, sec, until, ['ShiftLeft']);
  h.run(0.2);
  return ok;
}
/** Pula a cena que começou (ou vai começar) e confere que ninguém atravessou nada nela. */
function skipScene(h, id) {
  const r = playScene(h, { skip: true });
  assert.equal(r.id, id, `a cena ${id} começou`);
  assert.deepEqual(r.bad, [], `${id}: ninguém atravessa nada`);
}
/** Troca para a dog `name` (Q) se ainda não for ela. */
function become(h, name) {
  for (let i = 0; i < 8 && h.game.activeDog !== name; i++) {
    h.tap('KeyQ');
    if (h.game.activeDog !== name) h.run(0.2);
  }
  const why = { cine: h.puzzle.cinematic(), lock: !!h.puzzle.lockFor(h.game.activeDog), extras: h.info().extras?.act ?? null, scene: storyInfo(h).scene };
  assert.equal(h.game.activeDog, name, `${name} ativa ${JSON.stringify(why)}`);
}

test('missão do capítulo 1: os sete passos, do quarto ao portãozinho, o mural e o fim', async () => {
  const h = await createStoryGame();
  const L = h.layout;
  const S = () => storyInfo(h);
  const bad = new Set();
  const watch = () => { for (const m of intrusions(h)) bad.add(`[${S().stage}] ${m}`); };

  // 0. a abertura (pulada): o Faro já leu a trilha, o pote e a pena
  skipScene(h, 'abertura');
  assert.equal(S().stage, 'cozinha');
  for (const id of ['pombos', 'abraco', 'pote', 'trilha', 'pena']) assert.ok(S().clues.includes(id), `pista ${id}`);

  // 1. cozinha: a Radhija não alcança; a Rhaenyra pula na maçaneta de alavanca e a porta abre para o quintal
  become(h, 'rhaenyra');
  const Hd = L.KITCHEN_HANDLE;
  h.teleport('rhaenyra', Hd.x - 0.44, Hd.z, Math.PI / 2);
  h.run(0.2);
  h.tap('Space');
  assert.ok(h.run(3, { until: () => S().flags.kitchenOpen }), 'o impulso na maçaneta abre a porta da cozinha');
  assert.equal(S().stage, 'galho');
  h.run(1.2, { until: () => false });
  watch();

  // 2. galho: a Rhaenyra empurra o galho para o leste (as telhas aparecem) e o E abre a porta da área de serviço
  const Br = L.BRANCH;
  h.teleport('rhaenyra', Br.start.x - Br.half - 0.24, Br.start.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 8, () => S().flags.branchFree), 'o galho sai da frente da porta');
  assert.ok(S().clues.includes('telhas'), 'as telhas da tempestade viram pista (caso 2)');
  watch();
  const sd = { x: (L.SERVICE_DOOR.hinge.x + L.SERVICE_DOOR.latchPost.x) / 2, z: L.SERVICE_DOOR.hinge.z };
  h.teleport('rhaenyra', sd.x, sd.z + 0.7, Math.PI);
  h.run(0.2);
  h.tap('KeyE');
  h.run(0.5);
  assert.equal(S().flags.serviceOpen, true, 'E na porta abre a área de serviço');
  assert.equal(S().stage, 'piscina');
  h.run(1.2);
  watch();

  // 3. piscina: o pulso do Faro da Radhija perto da piscina acha a boia → a Reconstrução (caso 1)
  become(h, 'radhija');
  h.teleport('radhija', L.RECON.x + 0.8, L.POOL.z1 + 1.2, Math.PI);
  h.run(0.2);
  h.tap('KeyV');
  skipScene(h, 'reconstrucao');
  assert.ok(S().clues.includes('boia'), 'a boia (caso 1)');
  assert.equal(S().stage, 'varal');

  // 4. varal: a arrancada da Radhija no poste sacode o varal, o pregador solta e os pombos levam a cenoura
  const P = L.DASH_POST;
  h.teleport('radhija', P.x, P.z + 0.45, Math.PI);
  h.run(0.2);
  h.tap('ShiftLeft');
  skipScene(h, 'varal');
  assert.equal(S().stage, 'torre');

  // 5. torre: a Rhaenyra empurra a porta de mola; trocando para a Radhija com a irmã no vão, ela fica segurando
  become(h, 'rhaenyra');
  const TD = L.TOWER_DOOR;
  h.teleport('rhaenyra', TD.hinge.x - 0.36, (TD.hinge.z + TD.latchPost.z) / 2, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 4, () => h.puzzle.navFlags().towerOpen), 'a porta de mola abre com o empurrão');
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
  skipScene(h, 'terraco');
  assert.equal(S().stage, 'portaria');

  // 6. portaria: o latido fino da Radhija não acorda o porteiro; o grave da Rhaenyra sim, e ele abre o portãozinho
  const B = L.BOOTH;
  h.teleport('radhija', (B.x0 + B.x1) / 2 - 0.5, B.z1 + 0.7, Math.PI);
  h.run(0.2);
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(S().scene, null, 'o latido da Radhija não basta');
  assert.equal(S().stage, 'portaria');
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', (B.x0 + B.x1) / 2 + 0.4, B.z1 + 0.7, Math.PI);
  h.run(0.4);
  h.tap('KeyE');
  skipScene(h, 'porteiro');
  assert.equal(S().stage, 'fechamento');
  assert.equal(S().flags.gateOpen, true, 'o portãozinho aberto');

  // 7. fechamento: no portãozinho, os pombos voam para a cidade e a Rhaenyra segue a borboleta → o mural
  const G = L.GATE;
  h.teleport('rhaenyra', (G.x0 + G.x1) / 2, G.z + 0.6, Math.PI);
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
  assert.ok(end.clues >= 7, `pistas na lupa: ${end.clues}`);
  assert.deepEqual([...bad], [], 'ninguém atravessa nada no caminho');
  assert.equal(h.puzzle.lockFor('radhija'), null);
  assert.equal(h.puzzle.lockFor('rhaenyra'), null);
});

test('pistas escondidas: a baba no parapeito de dentro e o ralo sem rolha só com o Faro de perto', async () => {
  const h = await createStoryGame({ query: 'stage=cozinha' });
  const L = h.layout;
  const S = () => storyInfo(h);
  assert.equal(S().stage, 'cozinha');
  assert.ok(!S().clues.includes('baba'));
  // longe do basculante: nada
  h.teleport('radhija', -9.2, 2.9, 0);
  h.run(0.2);
  h.tap('KeyV');
  h.run(1);
  assert.ok(!S().clues.includes('baba'), 'de longe, a baba não aparece');
  h.run(6.5); // o pulso acaba
  // pertinho do parapeito de dentro, no chão do quarto ao lado da caminha
  h.teleport('radhija', L.BED.x + L.BED.r + 0.15, L.WINDOW.z + 0.55, -Math.PI / 2);
  h.run(0.2);
  h.tap('KeyV');
  h.run(1);
  assert.ok(S().clues.includes('baba'), 'de perto, a baba (escondida) entra na lupa');
  // o ralo do tanque, na área de serviço (com as portas abertas)
  h.game.debug.setStage('varal', 'radhija');
  h.run(0.2);
  h.teleport('radhija', L.DRAIN.x + 0.8, L.TANKS.z0 + 1.2, Math.PI);
  h.run(0.2);
  h.tap('KeyV');
  h.run(1);
  assert.ok(S().clues.includes('ralo'), 'o ralo sem rolha (escondida, caso 1)');
  // com a Rhaenyra, o Faro não sai (é da Radhija): dica
  become(h, 'rhaenyra');
  h.clearLog();
  h.tap('KeyV');
  h.run(0.2);
  assert.equal(h.log('story:faro').length, 0, 'a Rhaenyra não tem Faro');
  assert.ok(h.log('hint').length >= 1, 'a dica diz que o Faro é da Radhija');
});

test('paralelo A: o latido distrai a Dona Gansa, a Rhaenyra empurra o barquinho até o canal e só a Radhija atravessa para a ilha', async () => {
  const h = await createStoryGame({ query: 'stage=portaria' });
  const L = h.layout;
  const S = () => storyInfo(h);
  const bad = new Set();
  const watch = () => { for (const m of intrusions(h)) bad.add(m); };
  // a Radhija late de longe, a oeste do píer: a gansa vai ver o que é
  become(h, 'radhija');
  h.teleport('radhija', 4.3, 1.55, Math.PI / 2);
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
  assert.ok(push(h, [1, 0], 10, () => boatAt().x >= Bt.dock.x - 0.1), `pela margem até a frente do canal (x ${boatAt().x.toFixed(2)}, gansa: ${S().goose})`);
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
  assert.ok(push(h, [1, 0], 10, () => binPos().x >= tx), `a lixeira vai para o leste (x ${binPos().x.toFixed(2)})`);
  // para o norte, até encostar no toldo da guarita
  const bx = binPos().x;
  h.teleport('rhaenyra', bx, binPos().z + Bn.half + 0.26, Math.PI);
  h.run(0.2);
  assert.ok(push(h, [0, -1], 8, () => binPos().z <= tz), `a lixeira encosta no toldo (z ${binPos().z.toFixed(2)})`);
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
  const lock = h.puzzle.lockFor('radhija');
  assert.ok(holdWorld(h, [lock.pull.ax, lock.pull.az], 6, () => S().flags.ballClear), 'puxando, o balde cai e a bola rola para longe da porta');
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
  h.walkTo(sock.x, sock.z, { timeout: 6, until: () => S().socks.includes('deposito') });
  assert.ok(S().socks.includes('deposito'), 'a meia do depósito');
  assert.deepEqual(intrusions(h), []);
});

test('meia da casinha e petiscos: só a Radhija entra na casinha do quintal; os quatro petiscos existem', async () => {
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
  assert.equal(h.puzzle.total, 4, 'quatro petiscos no capítulo');
  assert.deepEqual(intrusions(h), []);
});

test('o botão do focinho (toque, só no Modo História) solta o Faro da Radhija', async () => {
  const h = await createStoryGame({ query: 'stage=cozinha' });
  h.clearLog();
  assert.equal(h.game.input.touch.press('faro'), true, 'o botão existe no Modo História');
  h.step();
  h.game.input.touch.release('faro');
  h.step();
  assert.ok(h.log('story:faro').length >= 1, 'o pulso saiu pelo botão do focinho');
});
