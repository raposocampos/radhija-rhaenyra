// O quadro de dedução do Modo História, a parte do modelo (src/story/deduction.js; pedido do usuário em 2026-11-11:
// "dá pra melhorar a mecânica dele, deixar ele mais de detetive ainda"):
//  - ligar as pistas é do jogador: a pista achada cai na bandeja; ligada à pergunta certa, encaixa (e sai da bandeja);
//    errada, "não tem a ver" sem custo; uma pista pode servir a mais de uma pergunta;
//  - a conclusão só fica pronta com TODAS as necessárias ligadas; a história que resolve liga as necessárias sozinha;
//  - depoimentos: cartão com quem falou e a fala; confrontado com a pista que o desmente, sai a pergunta nova;
//  - o capítulo 1 é coerente com o catálogo (ids, tipos, respostas) e não entrega a virada do capítulo 8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER1_BOARD, clueCard, createDeduction } from '../src/story/deduction.js';
import { CLUES, CHAPTER1_CLUES, CHAPTER1_TESTIMONIES, createClueBook } from '../src/story/clues.js';
import { PICTOS } from '../src/story/ui/pictos.js';

/** O quadro com a lupa de verdade e o registro de eventos. */
function setup() {
  const log = [];
  const emit = (name, p) => log.push([name, p]);
  /** @type {any} */
  let d = null;
  const book = createClueBook({ emit, onAdd: (id, silent) => d?.sync(silent ? null : id) });
  const resolved = [];
  const insights = [];
  d = createDeduction({ emit, book, onResolve: (id) => resolved.push(id), onInsight: (i) => insights.push(i) });
  const last = (name) => log.filter(([n]) => n === name).map(([, p]) => p).at(-1);
  const count = (name) => log.filter(([n]) => n === name).length;
  const node = (id) => d.state().nodes.find((n) => n.id === id);
  const tray = () => d.state().tray.map((c) => c.id);
  return { d, book, log, last, count, node, tray, resolved, insights };
}

test('ligar: a pista achada cai na bandeja; a certa encaixa, a errada "não tem a ver" e fica na bandeja', () => {
  const T = setup();
  T.d.ask('quem');
  for (const id of ['pombos', 'abraco', 'trilha', 'pote', 'pena']) T.book.add(id);
  assert.deepEqual(T.tray(), ['pombos', 'abraco', 'trilha', 'pote', 'pena'], 'achadas, soltas, na ordem em que chegaram');
  assert.equal(T.node('quem').state, 'aberta', 'achar não basta: falta ligar');
  assert.equal(T.d.isReady('quem'), false);
  assert.equal(T.d.hasClues('quem'), true, 'todas achadas (hora de abrir o quadro)');
  assert.deepEqual(T.node('quem').clues, []);
  assert.equal(T.node('quem').need, 3);
  assert.equal(T.node('quem').slots, 3);
  assert.equal(T.last('story:board').fresh, 'pena', 'a pista nova chega marcada');

  // errada: a pergunta não é dela
  T.d.ask('tempestade', { silent: true });
  assert.equal(T.d.link('trilha', 'tempestade'), false);
  assert.deepEqual(T.last('story:linkWrong'), { clue: 'trilha', node: 'tempestade', reason: 'errada' });
  assert.ok(T.tray().includes('trilha'), 'volta para a bandeja (sem custo)');
  // inválidas: pista não achada, pergunta que ainda não apareceu
  assert.equal(T.d.link('boia', 'quem'), false);
  assert.equal(T.last('story:linkWrong').reason, 'invalida');
  assert.equal(T.d.link('trilha', 'borracha'), false);
  assert.equal(T.last('story:linkWrong').reason, 'invalida');

  // certas: encaixam uma a uma, o fio acende (link no estado), a pergunta fica pronta com as três
  assert.equal(T.d.link('trilha', 'quem'), true);
  assert.deepEqual(T.last('story:board').link, { clue: 'trilha', node: 'quem' });
  assert.equal(T.node('quem').slots, 2);
  assert.deepEqual(T.node('quem').clues.map((c) => c.id), ['trilha']);
  assert.ok(!T.tray().includes('trilha'), 'saiu da bandeja');
  assert.equal(T.d.link('trilha', 'quem'), true, 'ligar de novo não muda nada');
  assert.deepEqual(T.node('quem').clues.map((c) => c.id), ['trilha']);
  T.d.link('pote', 'quem');
  // uma extra também serve, mas não conta como necessária
  assert.equal(T.d.link('pombos', 'quem'), true);
  assert.equal(T.node('quem').state, 'aberta');
  assert.equal(T.node('quem').slots, 1);
  assert.equal(T.d.nextLink?.clue, 'pena', 'a dica aponta a necessária que falta ligar');
  T.d.link('pena', 'quem');
  assert.equal(T.node('quem').state, 'pronta');
  assert.equal(T.node('quem').slots, 0);
  assert.deepEqual(T.node('quem').options, CHAPTER1_BOARD.questions[0].options);
  assert.equal(T.d.pending, 'quem');
  assert.deepEqual(T.tray(), ['abraco'], 'só a solta continua na bandeja');
});

test('conclusão: só pronta com as necessárias ligadas; a errada treme, a certa resolve e segue a história', () => {
  const T = setup();
  T.d.ask('quem');
  for (const id of ['trilha', 'pote', 'pena']) T.book.add(id);
  assert.equal(T.d.deduce('quem', 0), false, 'sem ligar, não deduz');
  assert.equal(T.count('story:deduceWrong'), 0);
  assert.deepEqual(T.resolved, []);
  for (const id of ['trilha', 'pote', 'pena']) T.d.link(id, 'quem');
  assert.equal(T.d.deduce('quem', 2), false);
  assert.deepEqual(T.last('story:deduceWrong'), { node: 'quem' });
  assert.equal(T.d.deduce('quem', 0), true);
  assert.equal(T.node('quem').state, 'resolvida');
  assert.equal(T.node('quem').conclusion, 'Foram os pombos! Entraram pela janela.');
  assert.equal(T.node('quem').slots, 0);
  assert.deepEqual(T.resolved, ['quem']);
  assert.equal(T.d.pending, null);
  // ligar uma extra depois de resolvida ainda vale
  T.book.add('abraco');
  assert.equal(T.d.link('abraco', 'quem'), true);
});

test('a história que resolve liga sozinha as necessárias achadas (pular etapas fica igual a jogar)', () => {
  const T = setup();
  for (const id of ['pombos', 'abraco', 'trilha', 'pote', 'pena']) T.book.add(id, { silent: true });
  T.d.ask('quem', { silent: true });
  T.d.resolve('quem', { silent: true });
  assert.deepEqual(T.node('quem').clues.map((c) => c.id), ['trilha', 'pote', 'pena']);
  assert.deepEqual(T.tray(), ['pombos', 'abraco'], 'as extras continuam soltas');
  assert.deepEqual(T.resolved, [], 'silent: sem seguir a história');
  assert.equal(T.count('story:question'), 0, 'silent: sem letreiro');
  assert.deepEqual(T.d.snapshot(), { asked: ['quem'], solved: ['quem'], links: { quem: ['trilha', 'pote', 'pena'] }, contradicted: [] });
  T.d.resolve('onde');
  assert.deepEqual(T.resolved, ['onde']);
  assert.equal(T.node('onde').state, 'resolvida');
  T.d.reset();
  assert.deepEqual(T.d.snapshot(), { asked: [], solved: [], links: {}, contradicted: [] });
  assert.deepEqual(T.d.state().nodes, []);
});

test('uma pista que serve a duas perguntas aparece ligada nas duas; o depoimento vem com quem falou e a fala', () => {
  const T = setup();
  T.d.ask('onde', { silent: true });
  T.d.ask('senha', { silent: true });
  T.book.add('dep-gansa');
  const clue = T.last('story:clue');
  assert.equal(clue.type, 'depoimento');
  assert.equal(clue.who, 'gansa');
  assert.match(clue.quote, /a nota é o fim/);
  const card = T.d.state().tray[0];
  assert.deepEqual(card, clueCard('dep-gansa'));
  assert.equal(card.type, 'depoimento');
  assert.equal(card.who, 'gansa');
  assert.equal(card.picto, 'gansa');
  assert.ok(card.quote && card.name === 'Dona Gansa');
  assert.equal(T.d.link('dep-gansa', 'onde'), true, 'extra da pergunta "onde"');
  assert.equal(T.d.link('dep-gansa', 'senha'), true, 'necessária da senha');
  assert.deepEqual(T.node('onde').clues.map((c) => c.id), ['dep-gansa']);
  assert.deepEqual(T.node('senha').clues.map((c) => c.id), ['dep-gansa']);
  assert.deepEqual(T.d.state().found.find((c) => c.id === 'dep-gansa').links, ['onde', 'senha']);
  assert.equal(T.node('senha').state, 'aberta', 'falta a pista da senha');
  T.book.add('senha');
  T.d.link('senha', 'senha');
  assert.equal(T.node('senha').state, 'pronta');
  assert.equal(T.d.deduce('senha', 1), false, 'sino, osso, peixe: não');
  assert.equal(T.d.deduce('senha', 0), true, 'sino, osso, nota');
  assert.equal(T.node('senha').conclusion, 'A senha é sino, osso, nota!');
  // a borracha: boia + o depoimento do Bichano
  T.d.ask('borracha', { silent: true });
  T.book.add('boia');
  T.book.add('dep-bichano');
  T.d.link('boia', 'borracha');
  assert.equal(T.node('borracha').state, 'aberta');
  T.d.link('dep-bichano', 'borracha');
  assert.equal(T.d.deduce('borracha', 0), true);
  assert.equal(T.node('borracha').conclusion, 'Para tapar uma goteira… mas onde?');
});

test('confronto: o depoimento desmentido pela pista certa abre a pergunta nova; o par errado só treme', () => {
  const T = setup();
  T.d.ask('quem', { silent: true });
  T.book.add('dep-luiz');
  T.book.add('pote');
  assert.equal(T.d.confront('dep-luiz', 'pote'), null);
  assert.deepEqual(T.last('story:confrontWrong'), { testimony: 'dep-luiz', clue: 'pote', reason: 'errada' });
  assert.equal(T.d.confront('pote', 'dep-luiz'), null, 'só depoimento se confronta');
  assert.equal(T.last('story:confrontWrong').reason, 'invalida');
  assert.equal(T.d.confront('dep-luiz', 'grelha'), null, 'a grelha ainda não foi achada');
  assert.equal(T.last('story:confrontWrong').reason, 'invalida');
  assert.equal(T.d.isAsked('luiz'), false);
  T.book.add('grelha');
  const ins = T.d.confront('dep-luiz', 'grelha');
  assert.deepEqual(ins, { kind: 'question', id: 'luiz', text: 'O Sr. Luiz viu os pombos saindo?', testimony: 'dep-luiz', clue: 'grelha' });
  assert.deepEqual(T.last('story:insight'), ins);
  assert.deepEqual(T.insights, [ins]);
  assert.equal(T.d.isAsked('luiz'), true, 'a pergunta nova aparece no quadro');
  assert.equal(T.node('luiz').state, 'aberta');
  assert.deepEqual(T.node('luiz').clues.map((c) => c.id), ['dep-luiz', 'grelha'], 'o depoimento e a pista ficam ligados a ela');
  const st = T.last('story:board');
  assert.equal(st.fresh, 'luiz');
  assert.deepEqual(st.insight, { kind: 'question', id: 'luiz' });
  assert.deepEqual(st.contradicted, ['dep-luiz']);
  assert.equal(T.d.confront('dep-luiz', 'grelha'), null, 'de novo, não');
  assert.equal(T.last('story:confrontWrong').reason, 'feito');
  assert.deepEqual(T.d.snapshot().contradicted, ['dep-luiz|grelha']);
});

test('confronto que dá uma pista nova: ela cai na bandeja (a lupa guarda)', () => {
  const log = [];
  let d = null;
  const book = createClueBook({ emit: (n, p) => log.push([n, p]), onAdd: () => d?.sync() });
  const board = {
    root: 'r',
    questions: [{ id: 'q', text: 'Q?', clues: [], conclusion: '' }],
    contradictions: [{ testimony: 'dep-bichano', clue: 'boia', insight: { kind: 'clue', id: 'ralo' } }],
  };
  d = createDeduction({ emit: (n, p) => log.push([n, p]), book, board });
  book.add('dep-bichano', { silent: true });
  book.add('boia', { silent: true });
  const ins = d.confront('dep-bichano', 'boia');
  assert.equal(ins?.kind, 'clue');
  assert.equal(ins.id, 'ralo');
  assert.ok(book.has('ralo'));
  assert.ok(d.state().tray.some((c) => c.id === 'ralo'));
});

test('capítulo 1: as perguntas, as pistas e as contradições existem no catálogo e fazem sentido', () => {
  const ids = new Set();
  for (const q of CHAPTER1_BOARD.questions) {
    assert.ok(!ids.has(q.id), `pergunta repetida ${q.id}`);
    ids.add(q.id);
    assert.ok(q.text.endsWith('?'), `${q.id}: é pergunta`);
    for (const c of [...q.clues, ...(q.extra || [])]) assert.ok(CLUES[c], `${q.id}: pista ${c} no catálogo`);
    if (q.options) {
      assert.ok(q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length, `${q.id}: resposta entre as opções`);
      assert.ok(q.clues.length > 0, `${q.id}: dedução precisa de pista`);
      assert.ok(q.conclusion, `${q.id}: conclusão`);
    }
  }
  for (const k of CHAPTER1_BOARD.contradictions) {
    assert.equal(CLUES[k.testimony]?.type, 'depoimento', `${k.testimony} é depoimento`);
    assert.ok(CLUES[k.clue], k.clue);
    assert.ok(k.insight.kind === 'question' ? ids.has(k.insight.id) : CLUES[k.insight.id], `insight ${k.insight.id}`);
  }
  // os depoimentos: quem falou, a fala, o retratinho
  for (const id of CHAPTER1_TESTIMONIES) {
    const c = CLUES[id];
    assert.equal(c.type, 'depoimento', id);
    assert.ok(c.who && c.quote && c.name && c.text, `${id}: quem, fala, nome e anotação`);
    assert.ok(PICTOS[c.picto], `${id}: retratinho ${c.picto}`);
  }
  assert.ok(PICTOS.grelha && CHAPTER1_CLUES.includes('grelha'));
  assert.match(CLUES.senha.text, /sino e o osso/);
  // a virada do capítulo 8 fica guardada: nada no quadro diz que foi a Rhaenyra
  const all = JSON.stringify(CHAPTER1_BOARD) + JSON.stringify(CHAPTER1_TESTIMONIES.map((id) => CLUES[id]));
  assert.doesNotMatch(all, /Rhaenyra|sonâmbul/i);
});
