// Modo História (etapa 2, a fatia jogável): as regras puras, sem cenário.
//  - o mural: a ligação errada volta (e conta um erro), o caso só fecha com as pistas necessárias, o carimbo dourado é
//    só do caso fechado sem erro; no mural provisório do capítulo 1, o caso 3 fica aberto (falta o cartão do cap. 8);
//  - a lupa (createClueBook) e o catálogo das pistas (casos, tipos, desenho de cada cartão);
//  - o sequenciador: o mesmo estado no fim normal e no pulo (cleanup e commit uma vez, nessa ordem), o beat sem pulo
//    espera acabar, abortar limpa sem commit;
//  - o pular cena (segurar E/Espaço/Enter): só conta o que foi apertado depois de a cena começar;
//  - os sons da história existem na biblioteca e os balões têm os ícones do roteiro (inclusive o cone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createCaseBoard, CASE3_TIMELINE } from '../src/story/mural/rules.js';
import { CLUES, CASES, CHAPTER1_CLUES, createClueBook } from '../src/story/clues.js';
import { createScene } from '../src/story/scene/sequencer.js';
import { createSkipInput, SKIP_HOLD } from '../src/story/scene/skip.js';
import { BALLOON_ICONS, BALLOON_ATLAS } from '../src/story/scene/balloons.js';
import { PICTOS } from '../src/story/ui/pictos.js';
import { SOUND_NAMES } from '../src/fx/audio/sounds.js';
import { THEMES, compileTheme } from '../src/fx/audio/themes.js';
import { installBrowserStubs } from './helpers/headless.mjs';
import { storyAllowed, storyEnabled } from '../src/story/gate.js';
import { TOUCH_BUTTONS, STORY_TOUCH_BUTTONS } from '../src/game/input.js';

// ---------------------------------------------------------------------------------------------- mural
test('mural: a ligação errada volta, conta um erro e não ocupa a casa', () => {
  const board = createCaseBoard(CASE3_TIMELINE, { owned: ['pombos', 'pote', 'trilha', 'abraco'] });
  const r = board.place('trilha', 0);
  assert.deepEqual(r, { ok: false, reason: 'errado' });
  assert.equal(board.errors, 1);
  assert.equal(board.placed['0'], null, 'a casa continua vazia');
  assert.ok(board.loose().includes('trilha'), 'o cartão voltou para a bandeja');
  assert.equal(board.place('pombos', 0).reason, 'certo');
  assert.equal(board.place('pote', 0).reason, 'ocupada');
  assert.equal(board.place('pombos', 2).reason, 'sem-cartao', 'cartão já pregado não vai de novo');
  assert.equal(board.place('baba', 2).reason, 'sem-cartao', 'cartão que não é do caso (ou que ela não tem)');
  assert.equal(board.place('pote', 9).reason, 'casa-invalida');
});

test('mural provisório do capítulo 1: o caso 3 não fecha sem o cartão que só chega no capítulo 8', () => {
  const owned = ['pombos', 'abraco', 'pote', 'trilha', 'pena', 'baba'];
  const board = createCaseBoard(CASE3_TIMELINE, { owned });
  assert.deepEqual(board.missing(), ['1'], 'a casa 2 (o cartão desenhado) fica com o "?"');
  for (const [card, slot] of [['pombos', 0], ['pote', 2], ['trilha', 3], ['abraco', 4]]) assert.equal(board.place(card, slot).reason, 'certo');
  assert.equal(board.settled, true, 'tudo o que dá para pôr está no lugar');
  assert.equal(board.closed, false, 'o caso continua aberto');
  assert.equal(board.stamp, null);
  assert.deepEqual(board.loose(), []);
});

test('mural: o caso fecha só com todas as pistas necessárias, e o carimbo dourado é só sem erro', () => {
  const all = CASE3_TIMELINE.slots;
  const clean = createCaseBoard(CASE3_TIMELINE, { owned: all });
  all.forEach((card, i) => {
    const r = clean.place(card, i);
    assert.equal(r.reason, 'certo');
    assert.equal(r.closed, i === all.length - 1, `fecha só na última casa (${i})`);
  });
  assert.equal(clean.closed, true);
  assert.equal(clean.stamp, 'dourado');
  assert.equal(clean.place('pombos', 0).reason, 'fechado');

  const messy = createCaseBoard(CASE3_TIMELINE, { owned: all });
  assert.equal(messy.place('abraco', 0).reason, 'errado');
  all.forEach((card, i) => messy.place(card, i));
  assert.equal(messy.closed, true);
  assert.equal(messy.stamp, 'comum', 'fechado com erro: carimbo comum');
});

test('mural: casos de perguntas (quem, como, por quê) seguem as mesmas regras', () => {
  const rule = { id: 'C1', kind: /** @type {'perguntas'} */ ('perguntas'), questions: { quem: 'pombos', como: 'boia', porque: 'ralo' } };
  const board = createCaseBoard(rule, { owned: ['pombos', 'boia'] });
  assert.equal(board.place('boia', 'quem').reason, 'errado');
  assert.equal(board.place('pombos', 'quem').reason, 'certo');
  assert.equal(board.place('boia', 'como').reason, 'certo');
  assert.deepEqual(board.missing(), ['porque']);
  assert.equal(board.closed, false, 'sem a pista do ralo o caso não fecha');
});

// ---------------------------------------------------------------------------------------------- pistas
test('pistas: o catálogo do capítulo 1 tem caso, tipo do roteiro e desenho de cartão', () => {
  const TYPES = new Set(['obrigatoria', 'cena', 'escondida', 'falsa']);
  for (const id of CHAPTER1_CLUES) {
    const c = CLUES[id];
    assert.ok(c, `pista ${id}`);
    assert.ok(CASES[c.case], `${id}: caso ${c.case}`);
    assert.ok(TYPES.has(c.type), `${id}: tipo ${c.type}`);
    assert.ok(PICTOS[c.picto], `${id}: desenho do cartão`);
    assert.equal(c.chapter, 1);
  }
  // os cartões da linha do tempo do caso 3 que existem no capítulo 1 são do caso 3
  for (const id of CASE3_TIMELINE.slots.filter((s) => CLUES[s])) assert.equal(CLUES[id].case, 'C3', id);
  // o mural mostra o "?" para o que falta
  assert.ok(PICTOS.q);
  // o capítulo 1 tem pista obrigatória, de cena e escondida (a falsa entra nos capítulos dos casos 1 e 2)
  const types = new Set(CHAPTER1_CLUES.map((id) => CLUES[id].type));
  for (const t of ['obrigatoria', 'cena', 'escondida']) assert.ok(types.has(t), `capítulo 1 tem pista ${t}`);
});

test('lupa: guarda cada pista uma vez, avisa o HUD e conta as escondidas', () => {
  const seen = [];
  const book = createClueBook({ emit: (name, p) => seen.push([name, p]) });
  assert.equal(book.add('pote', { x: 1, y: 0.3, z: 2 }), true);
  assert.equal(book.add('pote'), false, 'a mesma pista não entra de novo');
  assert.equal(book.add('nada'), false, 'pista desconhecida');
  assert.equal(book.add('pombos', { silent: true }), true);
  assert.equal(seen.length, 1, 'silent não avisa');
  assert.equal(seen[0][0], 'story:clue');
  assert.deepEqual({ id: seen[0][1].id, case: seen[0][1].case, type: seen[0][1].type, x: seen[0][1].x }, { id: 'pote', case: 'C3', type: 'obrigatoria', x: 1 });
  assert.deepEqual(book.found, ['pote', 'pombos']);
  assert.deepEqual(book.hidden(1), { found: 0, total: 4 }, 'a baba, o ralo, a goteira da despensa e a etiqueta da lata são as escondidas do capítulo');
  book.add('ralo');
  assert.deepEqual(book.hidden(1), { found: 1, total: 4 });
  assert.deepEqual(book.ofCase('C1'), ['ralo']);
  book.reset();
  assert.equal(book.count, 0);
});

// ---------------------------------------------------------------------------------------------- sequenciador
/** Uma cena de teste: três beats; o permanente vai no commit, o caminho no tick (desfeito no cleanup). */
function sampleScene(log, { noSkipMiddle = false } = {}) {
  return createScene({
    id: 'teste',
    emit: (name, p) => log.push(`${name}:${p.state ?? (p.on ? 'on' : 'off')}`),
    setup: (S) => { S.path = []; S.cam = 'plano'; },
    beats: [
      { id: 'a', dur: 1, tick: (S) => { S.path.push('a'); S.balloon = true; } },
      { id: 'b', dur: 0.5, noSkip: noSkipMiddle, tick: (S) => S.path.push('b') },
      { id: 'c', until: (S) => S.go === true, max: 2, tick: (S) => S.path.push('c') },
    ],
    cleanup: (S) => { log.push('cleanup'); S.balloon = false; S.cam = 'segue'; },
    commit: (S, how) => { log.push(`commit:${how}`); S.stage = 'depois'; S.clues = ['pote']; },
  });
}
const finalOf = (S) => ({ stage: S.stage, clues: S.clues, balloon: S.balloon, cam: S.cam });

test('sequenciador: o fim normal e o pulo deixam o mesmo estado (cleanup e commit uma vez)', () => {
  const runs = [];
  for (const skipAt of [null, 0, 0.4, 1.2, 2.5]) {
    const log = [];
    const sc = sampleScene(log);
    const S = {};
    sc.start(S);
    let t = 0;
    while (sc.active && t < 10) {
      if (skipAt !== null && t >= skipAt) sc.skip();
      else sc.update(1 / 60);
      t += 1 / 60;
    }
    assert.equal(sc.active, false, `terminou (pulo em ${skipAt})`);
    assert.equal(log.filter((l) => l === 'cleanup').length, 1, 'cleanup uma vez');
    assert.equal(log.filter((l) => l.startsWith('commit')).length, 1, 'commit uma vez');
    assert.ok(log.indexOf('cleanup') < log.findIndex((l) => l.startsWith('commit')), 'cleanup antes do commit');
    assert.equal(sc.skipped, skipAt !== null);
    runs.push(finalOf(S));
  }
  for (const r of runs) assert.deepEqual(r, runs[0]);
  assert.deepEqual(runs[0], { stage: 'depois', clues: ['pote'], balloon: false, cam: 'segue' });
});

test('sequenciador: o beat sem pulo acaba antes de pular; abortar limpa sem commit', () => {
  const log = [];
  const sc = sampleScene(log, { noSkipMiddle: true });
  const S = {};
  sc.start(S);
  for (let i = 0; i < 70; i++) sc.update(1 / 60); // no beat b
  assert.equal(sc.beat, 'b');
  assert.equal(sc.skippable, false);
  sc.skip();
  assert.equal(sc.active, true, 'o beat sem pulo continua');
  for (let i = 0; i < 40 && sc.active; i++) sc.update(1 / 60);
  assert.equal(sc.active, false);
  assert.equal(sc.skipped, true);
  assert.ok(!S.path.includes('c'), 'o resto não tocou');
  assert.equal(S.stage, 'depois');

  const log2 = [];
  const sc2 = sampleScene(log2);
  const S2 = {};
  sc2.start(S2);
  sc2.update(0.5);
  sc2.abort();
  assert.equal(sc2.active, false);
  assert.deepEqual(log2.filter((l) => l === 'cleanup' || l.startsWith('commit')), ['cleanup']);
  assert.equal(S2.stage, undefined);
  assert.ok(log2.includes('story:cinema:off'), 'as faixas saem');
});

test('sequenciador: beat que espera (until) termina pelo teto max', () => {
  const sc = sampleScene([]);
  const S = {};
  sc.start(S);
  let t = 0;
  while (sc.active && t < 20) { sc.update(1 / 30); t += 1 / 30; }
  assert.ok(t > 3.4 && t < 3.7, `1 + 0,5 + teto 2 s (${t.toFixed(2)})`);
});

// ---------------------------------------------------------------------------------------------- pular cena
test('pular cena: segurar E conta só depois de a cena começar', () => {
  installBrowserStubs();
  const ks = [];
  const skip = createSkipInput({ emit: (n, p) => ks.push(p.k) });
  const key = (type, code) => { const e = new Event(type); /** @type {any} */ (e).code = code; globalThis.dispatchEvent(e); };
  try {
    key('keydown', 'KeyE'); // segurado desde antes
    skip.arm();
    let done = false;
    for (let i = 0; i < 90; i++) done = skip.update(1 / 60) || done;
    assert.equal(done, false, 'tecla segurada desde antes não pula');
    key('keyup', 'KeyE');
    key('keydown', 'KeyE');
    let frames = 0;
    while (!skip.update(1 / 60) && frames < 200) frames++;
    assert.ok(Math.abs((frames + 1) / 60 - SKIP_HOLD) < 0.05, `segurar ${SKIP_HOLD} s (${((frames + 1) / 60).toFixed(2)})`);
    assert.ok(ks.includes(1), 'o anel chega ao fim');
    key('keyup', 'KeyE');
    skip.disarm();
    key('keydown', 'Space');
    assert.equal(skip.update(5), false, 'desarmado não conta');
  } finally {
    skip.dispose();
  }
});

// ---------------------------------------------------------------------------------------------- sons, trilha e balões
test('sons da história: todo story:sfx e dir.sfx usado nas cenas existe na biblioteca', () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk('src/story');
  const used = new Set();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:story:sfx', \{ name: |\.sfx\()'([\w-]+)'/g)) used.add(m[1]);
  }
  assert.ok(used.size >= 15, `sons achados: ${used.size}`);
  const missing = [...used].filter((n) => !SOUND_NAMES.includes(n));
  assert.deepEqual(missing, []);
});

test('trilha da história: o tema do clarinete (recanto) e o do mistério compilam', () => {
  for (const id of ['recanto', 'misterio']) {
    assert.ok(THEMES[id], id);
    const c = compileTheme(THEMES[id]);
    assert.ok(c, `${id} compila`);
  }
  assert.match(JSON.stringify(THEMES.recanto), /clarinet/, 'o recanto é no clarinete');
});

test('balões: o atlas de ícones continua inteiro, e as cenas e o jogo falam com texto (sem balão de ícone)', () => {
  for (const id of ['cenoura', 'cone', 'osso', 'coracao', 'q', 'ex', 'raiva', 'zzz', 'seta', 'nota', 'relogio', 'lupa']) {
    assert.ok(BALLOON_ICONS.includes(id), id);
  }
  // os que a missão e as cenas usam: cada balão do jogo tem o desenho dele
  for (const id of ['pombo', 'cheiro', 'latido', 'x', 'ok', 'janela', 'porta', 'cesto', 'pote', 'chuva', 'saco', 'empurrar', 'torre', 'gota', 'pena', 'sino']) {
    assert.ok(BALLOON_ICONS.includes(id), id);
  }
  assert.equal(new Set(BALLOON_ICONS).size, BALLOON_ICONS.length, 'sem ícone repetido');
  // os ícones ocupam as primeiras fileiras do atlas; as últimas ficam com os fundos (fala e pensamento, de 1 a 3 ícones)
  const A = BALLOON_ATLAS;
  assert.ok(BALLOON_ICONS.length <= A.iconCells, `os ${BALLOON_ICONS.length} ícones cabem nas ${A.iconCells} casas de ícone`);
  assert.ok(A.iconCells < A.grid * A.grid && A.maxIcons === 3, 'sobram fileiras para os fundos, de 1 a 3 ícones');
  // desde 2026-11-10 (pedido do usuário) as cenas e o jogo falam com texto (dir.say: balões de HQ e legendas), sem
  // balão de ícone: nada no puzzle nem nas cenas usa mais o atlas de ícones
  const files = ['src/story/areas/recanto/puzzle.js', 'src/story/areas/recanto/scenes.js'];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.equal([...src.matchAll(/(?:balloons\.show|dir\.balloon)\(/g)].length, 0, `balão de ícone em ${f}`);
    assert.ok(/dir\.say\(/.test(src), `falas com texto em ${f}`);
  }
});

// ---------------------------------------------------------------------------------------------- entrada
test('entrada: ?historia só abre nas prévias de PR e no desenvolvimento, nunca no link principal', () => {
  // produção (main): versão e build, sem PR, na raiz do Pages
  assert.equal(storyAllowed({ version: '0.10.0', build: 95, pr: null }, '/radhija-rhaenyra/'), false);
  // prévia de PR: pelo número no build e pelo caminho
  assert.equal(storyAllowed({ version: '0.10.0', build: null, pr: 75 }, '/radhija-rhaenyra/previews/pr-75/123-1/'), true);
  assert.equal(storyAllowed({ version: '0.10.0', build: 95, pr: null }, '/radhija-rhaenyra/previews/pr-75/123-1/'), true);
  // desenvolvimento (Vite local, servidor do E2E, testes): sem versão
  assert.equal(storyAllowed({ version: null, build: null, pr: null }, '/'), true);
  assert.equal(storyAllowed(null, '/'), true);
  // a decisão inteira (a do main.js): no link principal, ?historia não abre nada
  const prod = { version: '0.10.24', build: 116, pr: null };
  assert.equal(storyEnabled(new URLSearchParams('historia'), false, prod, '/radhija-rhaenyra/'), false, 'produção ignora ?historia');
  assert.equal(storyEnabled(new URLSearchParams('historia&stage=varal'), false, prod, '/radhija-rhaenyra/'), false);
  assert.equal(storyEnabled(new URLSearchParams('historia'), false, { version: '0.10.24', build: null, pr: 75 }, '/radhija-rhaenyra/previews/pr-75/1-1/'), true, 'prévia do PR abre');
  assert.equal(storyEnabled(new URLSearchParams(''), false, { version: null, build: null, pr: null }, '/'), false, 'sem o parâmetro, nada');
  assert.equal(storyEnabled(new URLSearchParams('historia'), true, { version: null, build: null, pr: null }, '/'), false, 'no catálogo de desenvolvimento das fases, não');
});

test('toque: o botão do focinho fica num mapa só do Modo História (os botões de sempre não mudam)', () => {
  assert.deepEqual(STORY_TOUCH_BUTTONS, { faro: { code: 'Faro' } });
  assert.equal(TOUCH_BUTTONS.faro, undefined, 'o mapa dos botões de sempre continua o mesmo');
  for (const id of Object.keys(STORY_TOUCH_BUTTONS)) assert.equal(TOUCH_BUTTONS[id], undefined, `${id} não repete um botão de sempre`);
});

// ---------------------------------------------------------------------------------------------- cenas
test('cenas: cada "uma vez só" (once) tem chave própria dentro da cena (a mesma chave em dois beats pularia o segundo)', () => {
  const src = readFileSync('src/story/areas/recanto/scenes.js', 'utf8');
  const bad = [];
  for (const part of src.split(/\nexport function /).slice(1)) {
    const name = part.split('(')[0];
    const keys = [...part.matchAll(/once\('(\w+)'/g)].map((m) => m[1]);
    for (const k of new Set(keys)) if (keys.filter((x) => x === k).length > 1) bad.push(`${name}: ${k}`);
  }
  assert.deepEqual(bad, []);
});
