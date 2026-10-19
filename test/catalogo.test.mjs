// Catálogo das fases: a campanha publicada (src/levels/index.js), as fases de desenvolvimento (src/levels/dev.js)
// e a resolução de ?level= feita pelo main.js (posição na lista ou id). As fases 6 e 7 começaram como protótipos
// abertos por ?level=fase6&play / ?level=fase7&play; promovidas, esses links continuam abrindo a mesma fase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS, publishedLevelIndex } from '../src/levels/index.js';
import { DEV_LEVELS, devCatalog } from '../src/levels/dev.js';
import { createHeadlessGame } from './helpers/headless.mjs';

const ids = (levels) => levels.map((def) => def.id);

test('campanha: as dez fases em ordem, numeradas 1…10, com cenário sob demanda', () => {
  assert.deepEqual(ids(LEVELS), ['fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase6', 'fase7', 'fase8', 'fase9', 'fase10']);
  LEVELS.forEach((def, i) => assert.equal(def.number, i + 1, `${def.id}: número do cartão = posição no menu`));
  for (const def of LEVELS.slice(5)) assert.equal(typeof def.load, 'function', `${def.id}: world/ continua num chunk à parte`);
  assert.equal(LEVELS.find((def) => def.id === 'fase6').name, 'Expresso do Superbafo');
  assert.equal(LEVELS.find((def) => def.id === 'fase7').name, 'Lambe-Lambe na Pracinha');
  assert.equal(LEVELS.find((def) => def.id === 'fase8').name, 'Lavanderia de Domingo');
  assert.equal(LEVELS.find((def) => def.id === 'fase9').name, 'Biblioteca do Vovô');
  assert.equal(LEVELS.find((def) => def.id === 'fase10').name, 'Festa no Quintal');
});

test('catálogo: nenhum id repetido entre a campanha e as fases de desenvolvimento', () => {
  const all = ids([...LEVELS, ...DEV_LEVELS]);
  assert.equal(new Set(all).size, all.length, all.join(', '));
  assert.deepEqual(ids(DEV_LEVELS), ['pulo', 'bafo', 'modelo', 'canil'], 'só as arenas ficam no catálogo de desenvolvimento');
});

test('links: ?level= por posição e por id abrem a fase publicada; outro id fica para o catálogo de desenvolvimento', () => {
  // links das fases promovidas, publicados enquanto eram protótipos
  assert.equal(publishedLevelIndex(LEVELS, 'fase6'), 5);
  assert.equal(publishedLevelIndex(LEVELS, 'fase7'), 6);
  assert.equal(publishedLevelIndex(LEVELS, 'fase8'), 7);
  assert.equal(publishedLevelIndex(LEVELS, 'fase9'), 8);
  assert.equal(publishedLevelIndex(LEVELS, 'fase10'), 9);
  // posição 1-based, limitada à lista, como antes
  assert.equal(publishedLevelIndex(LEVELS, '6'), 5);
  assert.equal(publishedLevelIndex(LEVELS, '7'), 6);
  assert.equal(publishedLevelIndex(LEVELS, '8'), 7);
  assert.equal(publishedLevelIndex(LEVELS, '9'), 8);
  assert.equal(publishedLevelIndex(LEVELS, '10'), 9);
  assert.equal(publishedLevelIndex(LEVELS, '99'), 9);
  assert.equal(publishedLevelIndex(LEVELS, '0'), 0);
  assert.equal(publishedLevelIndex(LEVELS, ''), 0);
  assert.equal(publishedLevelIndex(LEVELS, null), 0);
  assert.equal(publishedLevelIndex(LEVELS, 'fase1'), 0);
  // ids que não são da campanha: o main.js consulta levels/dev.js
  for (const id of ['pulo', 'bafo', 'modelo', 'nada']) assert.equal(publishedLevelIndex(LEVELS, id), null, id);
  // fases promovidas não estão mais no catálogo de desenvolvimento (o menu da partida fica sem unlockAll)
  assert.equal(devCatalog(LEVELS, 'fase6'), null);
  assert.equal(devCatalog(LEVELS, 'fase7'), null);
});

test('links: o main.js resolve a fase publicada antes de baixar o catálogo de desenvolvimento', () => {
  // Sem isso ?level=fase6&play caía na fase 1 (parseInt) depois que a fase saiu de DEV_LEVELS.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const published = publishedLevelIndex\(ALL_LEVELS, levelParam\);/);
  assert.match(main, /const dev = published === null\s*\? \(await import\('\.\/levels\/dev\.js'\)\)\.devCatalog\(ALL_LEVELS, levelParam\)/);
  assert.match(main, /const lv = dev \? dev\.index : published \?\? 0;/);
  assert.doesNotMatch(main, /parseInt\(params\.get\('level'\)/, 'nenhuma outra leitura de ?level= no boot');
});

test('arenas: entram sozinhas no fim da campanha; protótipos futuros entram juntos e em ordem', () => {
  const published = ids(LEVELS);
  for (const id of ['pulo', 'bafo', 'modelo']) {
    const catalog = devCatalog(LEVELS, id);
    assert.deepEqual(ids(catalog.levels), [...published, id], `${id}: arena entra sozinha no fim`);
    assert.equal(catalog.index, published.length);
  }
  assert.equal(devCatalog(LEVELS, 'nada'), null);
  // protótipos de exemplo com número depois da última publicada (a próxima fase nova seguirá este caminho)
  const proto = (id, number) => ({ ...DEV_LEVELS[2], id, number });
  const dev = [...DEV_LEVELS, proto('fase12', 12), proto('fase11', 11)];
  for (const [id, index] of [['fase11', 10], ['fase12', 11]]) {
    const catalog = devCatalog(LEVELS, id, dev);
    assert.deepEqual(ids(catalog.levels), [...published, 'fase11', 'fase12'], `${id}: o menu da prévia mostra as fases 11 e 12`);
    assert.equal(catalog.index, index, `${id}: começa na fase pedida`);
    catalog.levels.forEach((def, i) => assert.equal(def.number, i + 1, `${def.id}: numeração em sequência no menu`));
  }
  assert.deepEqual(ids(devCatalog(LEVELS, 'pulo', dev).levels), [...published, 'pulo'], 'arena não puxa os protótipos');
  assert.deepEqual(ids(LEVELS), published, 'a campanha publicada não muda');
});

test('campanha: fases 5 a 9 oferecem a próxima; a 10 é a última', async () => {
  const h = await createHeadlessGame({ level: 5, mode: 'title' });
  const loaded = [];
  const off = h.events.on('level:loaded', (info) => loaded.push(info));
  try {
    for (const index of [4, 5, 6, 7, 8, 9]) assert.equal(await h.game.loadLevel(index, { mode: 'title', initial: true }), true);
  } finally {
    off?.();
  }
  assert.deepEqual(loaded.map((info) => [info.id, info.number, info.count, info.hasNext]), [
    ['fase5', 5, 10, true], ['fase6', 6, 10, true], ['fase7', 7, 10, true], ['fase8', 8, 10, true], ['fase9', 9, 10, true],
    ['fase10', 10, 10, false],
  ]);
});
