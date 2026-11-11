// Modo História, a interface das falas e das pistas (pedido de 2026-11-10: legendas curtas de cinema com "voz" e o
// quadro de dedução no lugar da lupa). Só a parte pura, sem DOM:
//  - a máquina de escrever (45 letras/s, pausinha na pontuação) e as sílabas da voz (nunca num espaço ou pontuação;
//    narração e pensamento calados; cada falante com o próprio som, que existe na biblioteca);
//  - o HTML da legenda (nome de quem fala, texto escapado, a parte não digitada invisível);
//  - o quadro: layout (nada encavalado, encaixes vazios = pistas que faltam, fios acesos/dourados/apagados), o HTML
//    (conclusão na resolvida, "Deduzir" na pronta, "falta 1 pista" na aberta), a câmera (zoom legível no celular,
//    o quadro inteiro no PC, o ponto sob o dedo parado no zoom) e o foco ao abrir;
//  - o controle preso pela UI (capturePad): nada vaza para o jogo enquanto o quadro está aberto, nem ao fechar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TYPE_CPS, PAUSE_LONG, SPEAKERS, charTimes, typeDuration, typedCount, voiceBeats, holdTime, createVoice, subtitleHtml, moodVoice,
} from '../src/story/ui/subtitles.js';
import {
  BOARD, ZOOM, VIEW_PAD, readableFor, layoutBoard, boardHtml, clampView, initialView, zoomAt, pickFocus, boardSummary, missingLabel, fitScale, focusOf,
} from '../src/story/ui/board.js';
import { HUD_ICONS } from '../src/story/ui/pictos.js';
import { SOUND_NAMES } from '../src/fx/audio/sounds.js';
import { installBrowserStubs } from './helpers/headless.mjs';
import { createInput, capturePad, PAD } from '../src/game/input.js';

// ---------------------------------------------------------------------------------------------- legendas e voz
test('máquina de escrever: 45 letras/s, pausa depois da pontuação (não no fim), contagem pelo tempo', () => {
  assert.equal(TYPE_CPS, 45);
  const plain = charTimes('abcde');
  assert.equal(plain.length, 5);
  assert.ok(Math.abs(plain[4] - 4 / 45) < 1e-9);
  const t = charTimes('Oi. Tudo?');
  // a letra depois do ponto atrasa a pausa longa; o "?" final não atrasa nada
  assert.ok(Math.abs(t[3] - t[2] - (1 / 45 + PAUSE_LONG)) < 1e-9, 'pausa depois do ponto');
  assert.ok(Math.abs(typeDuration('Oi. Tudo?') - (t[8] + 1 / 45)) < 1e-9);
  // reticências: a pausa só depois do último ponto
  const r = charTimes('a...b');
  assert.ok(Math.abs(r[2] - r[1] - 1 / 45) < 1e-9 && r[4] - r[3] > PAUSE_LONG);
  assert.equal(typedCount(plain, -1), 0);
  assert.equal(typedCount(plain, 0), 1);
  assert.equal(typedCount(plain, 10), 5);
  assert.equal(typedCount(plain, 2 / 45 + 1e-6), 3);
  // a legenda fica o pedido ou, se a fala for longa, a digitação mais a leitura
  assert.equal(holdTime('oi', 3), 3);
  const long = 'x'.repeat(200);
  assert.ok(holdTime(long, 1) > typeDuration(long));
});

test('voz: sílabas a cada N letras faladas, nunca em espaço ou pontuação; a primeira letra soa', () => {
  assert.deepEqual(voiceBeats('abcd', 2), [0, 2]);
  assert.deepEqual(voiceBeats('a b c d', 2), [0, 4]);
  const s = 'Foram os pombos!!! E agora... cadê?';
  for (const i of voiceBeats(s, 2)) assert.doesNotMatch(s[i], /[\s.,!?]/, `letra ${i} "${s[i]}"`);
  assert.deepEqual(voiceBeats('... !?', 2), []);
});

test('voz: cada falante tem o som dele na biblioteca; narração e pensamento ficam calados; a voz para', () => {
  for (const who of ['radhija', 'rhaenyra', 'capitao', 'farelo', 'soneca', 'porteiro']) {
    assert.ok(SPEAKERS[who], who);
    assert.ok(SOUND_NAMES.includes(SPEAKERS[who].sound), `${who}: ${SPEAKERS[who].sound}`);
  }
  const played = [];
  const v = createVoice({ play: (name, o) => played.push({ name, ...o }) });
  const text = 'Cadê a cenoura, Rhaenyra?';
  v.start('radhija', text);
  for (let i = 0; i < 200; i++) v.update(1 / 60);
  // no máximo uma por quadro: a 60 quadros/s, todas as sílabas saem
  assert.equal(played.length, voiceBeats(text, SPEAKERS.radhija.every).length);
  assert.ok(played.every((p) => p.name === 'voz-radhija' && p.volume === 1));
  assert.equal(v.speaking, false);
  played.length = 0;
  v.start(null, 'A noite estava calma.');
  v.update(5);
  v.start('rhaenyra', 'hmm...', { mood: 'pensa' });
  v.update(5);
  assert.equal(played.length, 0, 'narração e pensamento sem voz');
  v.start('porteiro', 'Quem está aí?', { mood: 'grito' });
  v.update(1 / 60);
  assert.equal(played[0].name, 'voz-porteiro');
  assert.ok(played[0].volume > 1, 'o grito é mais alto');
  v.stop();
  v.update(5);
  assert.equal(played.length, 1, 'parou de falar');
  assert.ok(moodVoice('sussurro').volume < 1 && moodVoice('sono').pitch < 1);
  // um engasgo de 1 s não vira rajada: uma sílaba por quadro
  played.length = 0;
  v.start('soneca', 'Zzz... ronc... prrru');
  v.update(1);
  assert.equal(played.length, 1);
  assert.ok(played[0].pitch > 1, 'o Soneca é mais agudo');
});

test('legenda: o nome de quem fala, o texto escapado, a parte não digitada invisível; narração sem nome', () => {
  const h = subtitleHtml({ who: 'capitao', name: 'Capitão Migalha', text: 'Pru <b>pru</b> & cia' }, 5);
  assert.match(h, /rr-sub__name">Capitão Migalha</);
  assert.match(h, /rr-sub__on">Pru &lt;/);
  assert.match(h, /rr-sub__off">b&gt;pru&lt;\/b&gt; &amp; cia</);
  assert.doesNotMatch(h, /<b>/);
  const n = subtitleHtml({ who: null, name: '', text: 'Naquela noite...' });
  assert.doesNotMatch(n, /rr-sub__name/);
  assert.match(n, /rr-sub__off"><\/span>/, 'sem limite: tudo digitado');
  // sem nome no evento, o do falante
  assert.match(subtitleHtml({ who: 'radhija', text: 'Oi' }), /Radhija/);
});

// ---------------------------------------------------------------------------------------------- o quadro de dedução
const STATE = {
  root: { text: 'O que aconteceu com a cenoura?' },
  nodes: [
    { id: 'quem', text: 'Quem entrou no quarto?', conclusion: 'Foram os pombos!', state: 'resolvida', need: 2, clues: [{ id: 'pombos', picto: 'pombos', text: 'Pombos encharcados no parapeito.' }, { id: 'pena', picto: 'pena', text: 'Uma pena molhada.' }] },
    { id: 'onde', text: 'Para onde levaram a cenoura?', conclusion: null, state: 'pronta', options: ['Para o telhado', 'Para a torre', 'Para o quintal'], need: 2, clues: [{ id: 'trilha', picto: 'trilha', text: 'Pegadas molhadas... vieram da janela!' }, { id: 'boia', picto: 'boia', text: 'Um pombo levando a boia.' }] },
    { id: 'como', text: 'Como abriram o pote?', conclusion: null, state: 'aberta', need: 3, clues: [{ id: 'pote', picto: 'pote', text: 'O pote <virado> & vazio.' }] },
    { id: 'quando', text: 'Quando foi?', conclusion: null, state: 'aberta', need: 1, clues: [] },
  ],
  fresh: 'trilha',
};
const overlap = (a, b) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

test('quadro: layout sem nada encavalado, encaixes vazios para as pistas que faltam, fios com o brilho certo', () => {
  const L = layoutBoard(STATE);
  assert.equal(L.nodes.length, 4);
  const boxes = [L.root, ...L.nodes, ...L.nodes.flatMap((n) => [...n.clues, ...n.slots])];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) assert.ok(!overlap(boxes[i], boxes[j]), `caixas ${i} e ${j} encavaladas`);
    assert.ok(boxes[i].x - boxes[i].w / 2 >= 0 && boxes[i].x + boxes[i].w / 2 <= L.width, `caixa ${i} dentro do quadro`);
    assert.ok(boxes[i].y + boxes[i].h / 2 <= L.height);
  }
  const byId = Object.fromEntries(L.nodes.map((n) => [n.id, n]));
  assert.equal(byId.quem.slots.length, 0, 'resolvida: sem encaixe');
  assert.equal(byId.como.slots.length, 2, 'falta 2');
  assert.equal(byId.quando.slots.length, 1, 'falta 1');
  assert.ok(L.nodes.every((n) => n.y > L.root.y), 'as perguntas descem da raiz');
  // as pistas (e encaixes) de cada pergunta lado a lado embaixo dela, e as perguntas lado a lado na largura
  for (const n of L.nodes) {
    const row = [...n.clues, ...n.slots];
    assert.ok(row.every((c) => c.y === row[0].y && c.y - c.h / 2 > n.y + n.h / 2), `${n.id}: fileira embaixo da pergunta`);
    for (let i = 1; i < row.length; i++) assert.ok(row[i].x - row[i - 1].x >= BOARD.clueW, `${n.id}: lado a lado`);
  }
  assert.ok(L.nodes.every((n, i) => i === 0 || (n.y === L.nodes[0].y && n.x > L.nodes[i - 1].x)), 'perguntas na mesma linha');
  const tronco = (id) => L.links.find((k) => k.kind === 'tronco' && k.node === id);
  assert.equal(tronco('quem').glow, 'ouro');
  assert.equal(tronco('onde').glow, 'luz');
  assert.equal(tronco('como').glow, 'luz');
  assert.equal(tronco('quando').glow, 'apagado');
  assert.ok(L.links.filter((k) => k.kind === 'pista' && k.node === 'quem').every((k) => k.glow === 'ouro'));
  assert.equal(L.links.filter((k) => k.kind === 'vazio').length, 3);
  assert.ok(L.links.every((k) => /^M[\d.]+,[\d.]+ /.test(k.d)), 'caminhos SVG válidos');
  // o vazio e o quadro de uma pergunta só
  assert.ok(layoutBoard({ root: { text: '' }, nodes: [] }).width > 0);
  assert.equal(layoutBoard({ root: { text: 'x' }, nodes: [STATE.nodes[3]] }).nodes[0].x, layoutBoard({ root: { text: 'x' }, nodes: [STATE.nodes[3]] }).width / 2);
});

test('quadro: o HTML tem a conclusão dourada, o "Deduzir", o "falta N pista(s)", a pista nova e tudo escapado', () => {
  const L = layoutBoard(STATE);
  const h = boardHtml(STATE, L, { sel: 'onde', fresh: 'trilha' });
  assert.match(h, /O que aconteceu com a cenoura\?/);
  assert.match(h, /is-resolvida[^"]*" data-node="quem"/);
  assert.match(h, /rr-board__conc">Foram os pombos!</);
  assert.match(h, /is-pronta is-sel" data-node="onde"/);
  assert.match(h, /rr-board__cta">Deduzir</);
  assert.match(h, /faltam 2 pistas/);
  assert.match(h, /falta 1 pista</);
  assert.match(h, /rr-board__clue is-fresh" data-clue="trilha"/);
  assert.match(h, /O pote &lt;virado&gt; &amp; vazio\./);
  assert.doesNotMatch(h, /<virado>/);
  assert.match(h, /<animateMotion/, 'faíscas correndo nos fios acesos');
  assert.doesNotMatch(boardHtml(STATE, L, { motion: false }), /animateMotion/, 'sem movimento: sem faíscas');
  assert.equal((h.match(/class="rr-board__slot"/g) || []).length, 3);
  assert.equal(missingLabel(0), '');
  assert.equal(missingLabel(1), 'falta 1 pista');
  assert.equal(missingLabel(3), 'faltam 3 pistas');
});

test('quadro: câmera — tudo enquadrado e legível no PC, zoom legível no celular deitado, o ponto sob o dedo parado', () => {
  // as letras do quadro (px do mundo, story.css): pergunta 20, pista 18; na tela de 720p, pergunta ≥ 15 e pista ≥ 13
  const NODE_PX = 20;
  const CLUE_PX = 18;
  // o começo do capítulo (uma pergunta, três pistas): o quadro inteiro na tela do PC, letra grande, raiz fora da barra
  const one = { root: { text: 'O que aconteceu com a cenoura?' }, nodes: [{ id: 'quem', text: 'Quem entrou no quarto de noite?', conclusion: null, state: 'pronta', options: ['a', 'b'], need: 3, clues: STATE.nodes.slice(0, 2).flatMap((n) => n.clues).slice(0, 3) }] };
  for (const st of [one, { ...STATE, nodes: STATE.nodes.slice(0, 2) }]) {
    const L1 = layoutBoard(st);
    const pc = initialView(L1, 1280, 720, pickFocus(st));
    assert.ok(fitScale(L1, 1280, 720) >= ZOOM.readable, `cabe inteiro (${fitScale(L1, 1280, 720)})`);
    assert.ok(NODE_PX * pc.s >= 15 && CLUE_PX * pc.s >= 13, `letra legível no PC (zoom ${pc.s})`);
    const sx = (x) => 640 + (x - pc.x) * pc.s;
    const sy = (y) => 360 + (y - pc.y) * pc.s;
    assert.ok(sy(L1.root.y - L1.root.h / 2) >= VIEW_PAD.top - 1, 'a raiz abaixo da barra de cima');
    const boxes = [L1.root, ...L1.nodes, ...L1.nodes.flatMap((n) => [...n.clues, ...n.slots])];
    for (const bx of boxes) {
      assert.ok(sx(bx.x - bx.w / 2) >= 0 && sx(bx.x + bx.w / 2) <= 1280, 'tudo na largura');
      assert.ok(sy(bx.y + bx.h / 2) <= 720 - VIEW_PAD.bottom + 1, 'tudo acima da ajuda de baixo');
    }
    // o quadro espalhado: ocupa boa parte da largura (nada de coluna estreita no meio)
    assert.ok(L1.width * pc.s >= 0.5 * 1280, `largura na tela ${L1.width * pc.s}`);
  }
  // o capítulo inteiro (4 perguntas) no PC: se não couber legível, zoom legível na pergunta em foco
  const L = layoutBoard(STATE);
  const pcAll = initialView(L, 1280, 720, 'onde');
  assert.ok(pcAll.s >= Math.min(ZOOM.readable, fitScale(L, 1280, 720)) - 1e-9);
  // Infinix deitado (759×334) e iPhone 13 deitado (844×390): zoom legível, olhando para a pergunta em foco
  for (const [vw, vh] of [[759, 334], [844, 390]]) {
    const v = initialView(L, vw, vh, 'onde');
    assert.ok(v.s >= readableFor(vh) - 1e-9, `${vw}×${vh}: zoom ${v.s}`);
    const onde = L.nodes.find((n) => n.id === 'onde');
    // a pergunta inteira na tela, abaixo da barra do título
    const sx = (x) => vw / 2 + (x - v.x) * v.s;
    const sy = (y) => vh / 2 + (y - v.y) * v.s;
    assert.ok(sx(onde.x - onde.w / 2) >= 0 && sx(onde.x + onde.w / 2) <= vw, `${vw}: pergunta na largura`);
    assert.ok(sy(onde.y - onde.h / 2) >= VIEW_PAD.top - 1 && sy(onde.y + onde.h / 2) <= vh, `${vw}: pergunta na altura (${sy(onde.y - onde.h / 2)})`);
    // no celular (px CSS maiores na mão), a letra da pista fica em ≥ 11 px
    assert.ok(CLUE_PX * v.s >= 11, 'letra legível no celular');
  }
  // preso: arrastar para longe não perde o quadro
  const far = clampView({ x: -5000, y: 9000, s: 0.8 }, L, 759, 334);
  assert.ok(far.x * 0.8 >= 759 / 2 - VIEW_PAD.side - 1e-6 && far.y <= L.height);
  assert.ok(clampView({ x: 0, y: 0, s: 99 }, L, 759, 334).s <= ZOOM.max);
  // zoom na pinça/rodinha: o ponto do mundo sob o dedo não sai do lugar
  const v0 = { x: 400, y: 300, s: 0.8 };
  const v1 = zoomAt(v0, 1.3, 100, 50, 759, 334);
  const world = (v, px, py) => [v.x + (px - 759 / 2) / v.s, v.y + (py - 334 / 2) / v.s];
  const [a, b] = [world(v0, 100, 50), world(v1, 100, 50)];
  assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9);
  assert.ok(Math.abs(v1.s - 1.04) < 1e-9);
  // o foco de uma pergunta sem pistas também existe
  assert.ok(Number.isFinite(focusOf(L, 'quando', 334, 0.8).y));
});

test('quadro: o foco ao abrir e o resumo do botão (pistas e o "!" de pronta)', () => {
  assert.equal(pickFocus(STATE), 'onde', 'a pronta para deduzir');
  const noReady = { ...STATE, nodes: STATE.nodes.map((n) => (n.state === 'pronta' ? { ...n, state: 'aberta' } : n)) };
  assert.equal(pickFocus(noReady), 'onde', 'a da pista nova');
  assert.equal(pickFocus({ ...noReady, fresh: undefined }), 'onde', 'a primeira aberta');
  assert.equal(pickFocus({ root: { text: '' }, nodes: [] }), null);
  assert.deepEqual(boardSummary(STATE), { clues: 5, ready: 1 });
  assert.deepEqual(boardSummary(null), { clues: 0, ready: 0 });
  assert.match(HUD_ICONS.quadro, /^<svg /);
});

test('sons novos do quadro, das vozes e do trovão estão na biblioteca', () => {
  for (const n of ['voz-radhija', 'voz-rhaenyra', 'voz-pombo', 'voz-porteiro', 'quadro-abre', 'quadro-fecha', 'neuronio', 'deduz-certo', 'rabisco', 'pergunta', 'trovao', 'erro', 'pista', 'uiMove', 'uiDenied']) {
    assert.ok(SOUND_NAMES.includes(n), n);
  }
  // as classes que o HUD usa existem no CSS
  const css = readFileSync('src/story/ui/story.css', 'utf8');
  for (const c of ['.rr-sub', '.rr-sub__name', '.rr-sub__off', '.rr-clue', '.rr-clue.is-fly', '.rr-ask', '.rr-board', '.rr-board__node', '.rr-board__clue', '.rr-board__slot', '.rr-board__deduce', '.rr-board__opt.is-wrong', '.rr-story__quadro', 'prefers-reduced-motion']) {
    assert.ok(css.includes(c), c);
  }
});

// ---------------------------------------------------------------------------------------------- o controle preso
test('controle preso pela UI (quadro aberto): nada vaza para o jogo, nem o botão ainda apertado ao fechar', () => {
  installBrowserStubs();
  const pads = [];
  Object.defineProperty(globalThis.navigator, 'getGamepads', { configurable: true, value: () => pads });
  const buttons = (down = []) => Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 }));
  const setPad = (down, axes = [0, 0, 0, 0]) => { pads.length = 0; pads.push({ connected: true, mapping: 'standard', timestamp: 1, axes, buttons: buttons(down) }); };
  const input = createInput();
  try {
    setPad([]);
    input.poll();
    capturePad(true);
    setPad([PAD.A], [0.9, 0, 0, 0]);
    input.poll();
    assert.equal(input.consume('Jump'), false, 'o ✕/A do quadro não pula');
    assert.equal(input.axis().m, 0, 'o analógico do quadro não anda');
    capturePad(false);
    input.poll();
    assert.equal(input.consume('Jump'), false, 'ainda segurado ao fechar: não pula');
    setPad([]);
    input.poll();
    setPad([PAD.A]);
    input.poll();
    assert.equal(input.consume('Jump'), true, 'soltou e apertou de novo: pula');
  } finally {
    capturePad(false);
  }
});

test('quadro e cartão: o desenho da pista vem pelo id ou já como SVG (o que o deduction.js manda)', async () => {
  const { PICTOS, pictoSvg } = await import('../src/story/ui/pictos.js');
  assert.equal(pictoSvg('pombos', 'x'), PICTOS.pombos);
  assert.equal(pictoSvg(PICTOS.pena, 'pena'), PICTOS.pena);
  assert.equal(pictoSvg(undefined, 'trilha'), PICTOS.trilha);
  assert.equal(pictoSvg(null, 'nao-existe'), PICTOS.q);
  const st = { root: { text: 'r' }, nodes: [{ id: 'n', text: 't', conclusion: null, state: 'aberta', need: 1, clues: [{ id: 'pena', picto: PICTOS.pena, text: 'Uma pena.' }] }] };
  const h = boardHtml(st, layoutBoard(st));
  assert.ok(h.includes(PICTOS.pena) && !h.includes(PICTOS.q));
});
