// Menu inicial (Jogar → mapa das fases; Modo História "em breve"; Opções com música e efeitos; sem o mapa, Jogar →
// Continuar e cartões), modo sem dicas e o atalho
// do núcleo que abre o cartão da fase já montada. Sem navegador: o save (src/ui/progress.js), as opções
// (src/core/settings.js), o template (src/ui/markup.js) e o jogo headless. A navegação por teclado, controle e
// toque é conferida no E2E (suíte menu, tools/scripts/test-menu.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadProgress, recordLastPlayed, recordLevelClear, continueTarget, PROG_KEY } from '../src/ui/progress.js';
import { createSettings, loadSettings, saveSettings, normalizeSettings, SETTINGS_KEY } from '../src/core/settings.js';
import { template, settingsBlock, MODES, HINTS_NOTE } from '../src/ui/markup.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const IDS = ['fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase6', 'fase7'];
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { done: true, best: 60, treats: 1, total: 3, clears: 1 }]));
const prog = (levels = {}, last) => (last === undefined ? { v: 1, levels } : { v: 1, levels, last });
/** Espera a troca de fase do jogo headless (a cortina tem 420 ms de relógio). */
async function untilLoaded(h, timeout = 5000) {
  const t0 = Date.now();
  while (h.game.state === 'loading' && Date.now() - t0 < timeout) await new Promise((r) => setTimeout(r, 10));
  assert.notEqual(h.game.state, 'loading', 'a fase não terminou de carregar');
}

/** localStorage de mentira (Map), devolvido ao estado anterior no fim do teste. */
function memoryStorage(t, initial = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map(Object.entries(initial));
  const writes = [];
  const api = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { writes.push({ key, value }); values.set(key, String(value)); },
    removeItem: (key) => values.delete(key),
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: api });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  return { api, values, writes };
}

// ---------------------------------------------------------------------------------------------- Continuar
test('Continuar: save novo começa pela fase 1 (botão Começar)', () => {
  assert.deepEqual(continueTarget(IDS, prog()), { index: 0, fresh: true });
});

test('Continuar: a próxima fase não concluída, na ordem da campanha', () => {
  assert.deepEqual(continueTarget(IDS, prog(done('fase1', 'fase2'))), { index: 2, fresh: false });
  // uma fase concluída fora de ordem (save de outra versão) não libera a seguinte da primeira pendente
  assert.equal(continueTarget(IDS, prog(done('fase1', 'fase3'))).index, 1);
});

test('Continuar: volta à última fase escolhida enquanto ela não for concluída', () => {
  // jogou a 1 e a 2, voltou para refazer a 1 e saiu: a 3 (a 1 já está concluída)
  assert.equal(continueTarget(IDS, prog(done('fase1', 'fase2'), 'fase1')).index, 2);
  // a 2 e a 4 pendentes e liberadas (a 3 concluída num save antigo): vale a escolhida, não a primeira pendente
  assert.equal(continueTarget(IDS, prog(done('fase1', 'fase3'), 'fase4')).index, 3);
  assert.equal(continueTarget(IDS, prog(done('fase1', 'fase3'), 'fase2')).index, 1);
  // com tudo liberado no catálogo de desenvolvimento, a última escolhida vale mesmo fora de ordem
  assert.equal(continueTarget(IDS, prog(done('fase1'), 'fase5'), { unlockAll: true }).index, 4);
  // sem o catálogo de desenvolvimento, uma escolhida bloqueada cai na primeira liberada pendente
  assert.equal(continueTarget(IDS, prog(done('fase1'), 'fase5')).index, 1);
});

test('Continuar: com tudo concluído, a última escolhida (ou a última fase)', () => {
  assert.deepEqual(continueTarget(IDS, prog(done(...IDS), 'fase4')), { index: 3, fresh: false });
  assert.equal(continueTarget(IDS, prog(done(...IDS))).index, IDS.length - 1);
  // id de uma fase que não existe mais (save de outra versão): ignorado
  assert.equal(continueTarget(IDS, prog(done('fase1'), 'fase-antiga')).index, 1);
  assert.deepEqual(continueTarget(IDS, prog({}, 'fase-antiga')), { index: 0, fresh: true });
  assert.deepEqual(continueTarget([], prog()), { index: 0, fresh: true });
});

test('Continuar: só a escolha de uma fase já tira o botão do "Começar"', () => {
  assert.deepEqual(continueTarget(IDS, prog({}, 'fase1')), { index: 0, fresh: false });
});

// ---------------------------------------------------------------------------------------------- save: last
test('save: a última fase escolhida fica no v1, sem mexer nas conclusões, e sobrevive à vitória', (t) => {
  const s = memoryStorage(t, { [PROG_KEY]: JSON.stringify(prog(done('fase1'))) });
  const r = recordLastPlayed('fase2');
  assert.equal(r.saved, true);
  assert.equal(loadProgress().last, 'fase2');
  assert.deepEqual(loadProgress().levels, done('fase1'), 'conclusões preservadas');
  assert.equal(recordLastPlayed('fase2').saved, false, 'a mesma fase não regrava');
  recordLevelClear('fase2', { timeSec: 30, collected: 2, total: 3 }, 3);
  assert.equal(loadProgress().last, 'fase2', 'vitória preserva a última escolhida');
  assert.equal(JSON.parse(s.values.get(PROG_KEY)).v, 1);
});

test('save: last inválido é descartado; save sem last continua igual ao lido', (t) => {
  const s = memoryStorage(t);
  for (const last of ['', 42, null, 'x'.repeat(65), ['fase1']]) {
    s.values.set(PROG_KEY, JSON.stringify({ v: 1, levels: done('fase1'), last }));
    assert.equal(Object.hasOwn(loadProgress(), 'last'), false, JSON.stringify(last));
  }
  s.values.set(PROG_KEY, JSON.stringify(prog(done('fase1'))));
  assert.deepEqual(loadProgress(), prog(done('fase1')));
  assert.equal(s.writes.length, 0, 'ler não grava');
});

test('save: versão desconhecida nunca é sobrescrita pela escolha de uma fase', (t) => {
  const future = JSON.stringify({ v: 2, levels: {}, extra: true });
  const s = memoryStorage(t, { [PROG_KEY]: future });
  const r = recordLastPlayed('fase1');
  assert.equal(r.saved, false);
  assert.equal(r.prog.last, 'fase1', 'vale na memória');
  assert.equal(s.values.get(PROG_KEY), future);
});

test('save: storage cheio ou bloqueado não faz a escolha esquecer fases concluídas nesta aba', (t) => {
  // gravar falha (cota cheia): a vitória e a escolha seguem só na memória da UI
  const s = memoryStorage(t, { [PROG_KEY]: JSON.stringify(prog(done('fase1'))) });
  s.api.setItem = () => { throw new Error('QuotaExceededError'); };
  const clear = recordLevelClear('fase2', { timeSec: 40, collected: 1, total: 3 }, 3);
  assert.equal(clear.saved, false);
  const r = recordLastPlayed('fase3', clear.prog);
  assert.equal(r.saved, false);
  assert.deepEqual(Object.keys(r.prog.levels).sort(), ['fase1', 'fase2'], 'a fase 2 concluída nesta aba continua');
  assert.equal(r.prog.last, 'fase3');
  assert.equal(continueTarget(IDS, r.prog).index, 2, 'a fase 3 continua liberada');
  // leitura negada: vale só a memória
  s.api.getItem = () => { throw new Error('SecurityError'); };
  const r2 = recordLastPlayed('fase2', r.prog);
  assert.deepEqual(Object.keys(r2.prog.levels).sort(), ['fase1', 'fase2']);
  assert.equal(r2.prog.last, 'fase2');
});

test('save: o gravado (outra aba) prevalece sobre a memória na mesma fase', (t) => {
  const newer = { done: true, best: 20, treats: 3, total: 3, clears: 2 };
  memoryStorage(t, { [PROG_KEY]: JSON.stringify({ v: 1, levels: { fase1: newer } }) });
  const r = recordLastPlayed('fase2', prog(done('fase1')));
  assert.equal(r.saved, true);
  assert.deepEqual(loadProgress(), { v: 1, levels: { fase1: newer }, last: 'fase2' });
});

// ---------------------------------------------------------------------------------------------- opções
test('opções: padrão com dicas; JSON corrompido ou campos estranhos voltam ao padrão', () => {
  assert.equal(SETTINGS_KEY, 'rr-settings-v1');
  const store = (raw) => ({ getItem: () => raw, setItem() {} });
  assert.deepEqual(loadSettings(store(null)), { noHints: false });
  assert.deepEqual(loadSettings(store('{"noHints":')), { noHints: false });
  assert.deepEqual(loadSettings(store('{"noHints":"sim"}')), { noHints: false });
  assert.deepEqual(loadSettings(store('[true]')), { noHints: false });
  assert.deepEqual(loadSettings(store('{"noHints":true,"outra":1}')), { noHints: true });
  assert.deepEqual(normalizeSettings(undefined), { noHints: false });
  assert.deepEqual(loadSettings({ getItem() { throw new Error('negado'); } }), { noHints: false });
  assert.equal(saveSettings({ noHints: true }, { setItem() { throw new Error('cheio'); } }), false);
  assert.equal(saveSettings({ noHints: true }, null), false);
});

test('opções: o modo sem dicas fica salvo, vale ao recarregar e avisa a interface', () => {
  const values = new Map();
  const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const emitted = [];
  const a = createSettings({ storage, emit: (name, data) => emitted.push([name, data]) });
  assert.equal(a.noHints, false);
  a.setNoHints(true);
  assert.equal(a.noHints, true);
  assert.deepEqual(JSON.parse(values.get(SETTINGS_KEY)), { noHints: true });
  assert.deepEqual(emitted, [['settings:change', { noHints: true }]]);
  a.setNoHints(true);
  assert.equal(emitted.length, 1, 'sem mudança, sem aviso');
  // "recarregar a página": outra instância lê o mesmo storage
  const b = createSettings({ storage, emit() {} });
  assert.equal(b.noHints, true);
  b.setNoHints(false);
  assert.equal(createSettings({ storage, emit() {} }).noHints, false);
  assert.deepEqual(b.values, { noHints: false });
});

// ---------------------------------------------------------------------------------------------- template
test('template: a tela principal tem Jogar, Modo História em breve e Opções; a nota da música; Voltar em Esc · ○', () => {
  const html = template();
  const title = html.slice(html.indexOf('rr-layer rr-title'), html.indexOf('rr-layer rr-intro'));
  const main = title.slice(title.indexOf('rr-screen--main'), title.indexOf('rr-screen--levels'));
  assert.deepEqual([...main.matchAll(/data-action="([a-z]+)"/g)].map((m) => m[1]), ['play', 'story', 'options'], 'Jogar, Modo História e Opções');
  assert.match(main, /data-action="play"[^>]*data-default/, 'Jogar é o foco inicial');
  assert.match(main, /data-action="story"[^>]*aria-disabled="true"/, 'Modo História aparece, mas não abre');
  assert.ok(main.includes(MODES.story.badge) && MODES.story.badge === 'Em breve');
  assert.ok(!title.includes('rr-screen--modes'), 'a tela dos modos saiu (o Jogar vai direto ao mapa)');
  assert.match(title, /data-screen="main"/);
  // a nota no canto liga e desliga a música; o progresso fica ao lado do logotipo
  assert.match(title, /class="rr-music-toggle"[^>]*data-action="music"[^>]*aria-pressed="true"/);
  assert.match(title, /class="rr-home__stats"/);
  // sem o mapa (catálogo de desenvolvimento): o Continuar e a grade de cartões continuam
  assert.match(title, /data-action="continue"[^>]*data-default/, 'Continuar é o foco inicial da tela das fases');
  assert.match(title, /class="rr-levels"/, 'a grade de cartões continua na tela das fases');
  // Voltar: na tela inicial e no cartão de abertura, com Esc (teclado) e ○ · B (controle), sem ícone de toque
  const backs = [...html.matchAll(/<button class="rr-back[^"]*"[\s\S]*?<\/button>/g)].map((m) => m[0]);
  assert.equal(backs.length, 2);
  for (const bk of backs) {
    assert.ok(bk.includes('>Esc<') && bk.includes('rr-pad--b') && !bk.includes('rr-tg'), bk);
  }
});

test('template: Opções e pausa têm o mesmo bloco (música, efeitos, qualidade, dicas, tela cheia)', () => {
  const html = template();
  const block = settingsBlock();
  assert.equal(html.split(block).length - 1, 2, 'tela Opções e pausa');
  for (const sel of ['rr-range--music', 'rr-range--sfx', 'data-quality="auto"', 'data-hints="on"', 'data-hints="off"', 'rr-fullscreen']) {
    assert.ok(block.includes(sel), sel);
  }
  assert.ok(block.includes(HINTS_NOTE.on));
  // o HUD tem o selo do modo sem dicas (o CSS só o mostra com .rr[data-hints="off"])
  assert.match(html, /class="rr-nohints[^"]*"/);
  // a pausa continua com a tabela de controles (acessível também no modo sem dicas)
  assert.match(html.slice(html.indexOf('rr-layer rr-pause')), /rr-ctl-table/);
});

test('ui.js não esconde window.screen (a tela cheia trava a paisagem por ele)', async () => {
  const src = await readFile(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\b(?:let|const|var|function)\s+screen\b/, 'uma variável "screen" esconderia window.screen');
  assert.match(src, /window\.screen\)\.orientation\?\.lock/);
});

// ---------------------------------------------------------------------------------------------- núcleo
test('núcleo: escolher na tela inicial a fase já montada abre o cartão dela sem recarregar', async () => {
  const h = await createHeadlessGame({ level: 1, mode: 'title' });
  const built = h.game.built;
  h.clearLog();
  h.events.emit('ui:selectLevel', { index: 0 });
  assert.equal(h.game.state, 'intro');
  assert.equal(h.game.built, built, 'mesma montagem');
  assert.equal(h.log('level:loading').length, 0);
  // Voltar do cartão de abertura (a UI emite ui:menu): tela inicial com a mesma fase
  h.events.emit('ui:menu', {});
  assert.equal(h.game.state, 'title');
  assert.equal(h.game.built, built);
  // outra fase: carrega como sempre e chega ao cartão dela
  h.events.emit('ui:selectLevel', { index: 1 });
  assert.equal(h.game.state, 'loading');
  await untilLoaded(h);
  assert.equal(h.game.state, 'intro');
  assert.equal(h.game.levelDef.id, 'fase2');
  h.events.emit('ui:play', {});
  assert.equal(h.game.state, 'playing');
});

test('núcleo: fora da tela inicial, escolher a mesma fase recarrega (cartão a partir do zero)', async () => {
  const h = await createHeadlessGame({ level: 1, mode: 'play' });
  const built = h.game.built;
  h.events.emit('ui:selectLevel', { index: 0 });
  assert.equal(h.game.state, 'loading');
  await untilLoaded(h);
  assert.equal(h.game.state, 'intro');
  assert.notEqual(h.game.built, built);
});
