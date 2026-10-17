import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, saveProgress, recordLevelClear, PROG_KEY } from '../src/ui/progress.js';

const clear = (overrides = {}) => ({ done: true, best: 42.5, treats: 2, total: 5, clears: 3, ...overrides });
const empty = () => ({ v: 1, levels: {} });

function storage(t, initial) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  const writes = [];
  const set = (value, key = PROG_KEY) => values.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  if (initial !== undefined) set(initial);
  const api = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { writes.push({ key, value }); values.set(key, value); },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: api });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  });
  return { api, values, writes, set, raw: (key = PROG_KEY) => values.get(key), read: (key = PROG_KEY) => JSON.parse(values.get(key)) };
}

test('progresso: mantém chave e save v1 válidos, inclusive fase desconhecida', t => {
  const existing = { v: 1, levels: { fase1: clear(), 'fase-futura': clear({ best: 0, treats: 0, clears: 1 }) } };
  const s = storage(t, existing);
  assert.equal(PROG_KEY, 'rr-progress-v1');
  assert.deepEqual(loadProgress(), existing);
  assert.equal(s.writes.length, 0, 'ler não reescreve o save');
  assert.equal(saveProgress(loadProgress()), true);
  assert.deepEqual(s.read(), existing);
});

test('progresso: ausência, estruturas inválidas e versão ausente retornam estado utilizável', t => {
  const s = storage(t);
  assert.deepEqual(loadProgress(), empty());
  for (const value of [null, [], true, 12, { levels: {} }, { v: 1, levels: [] }, { v: 1, levels: null }, { v: 1 }]) {
    s.set(value);
    assert.deepEqual(loadProgress(), empty());
  }
  assert.equal(s.writes.length, 0);
});

test('progresso: recupera JSON corrompido ao registrar uma vitória', t => {
  const s = storage(t, '{"v":1,"levels":');
  assert.deepEqual(loadProgress(), empty());
  assert.equal(s.writes.length, 0);
  const result = recordLevelClear('fase1', { timeSec: 12, collected: 1, total: 5 }, 5);
  assert.equal(result.saved, true);
  assert.deepEqual(s.read().levels.fase1, clear({ best: 12, treats: 1, clears: 1 }));
});

test('progresso: levels array não perde a vitória na serialização', t => {
  const s = storage(t, { v: 1, levels: [] });
  const result = recordLevelClear('fase1', { timeSec: 10, collected: 2, total: 5 }, 5);
  assert.equal(result.saved, true);
  assert.equal(Array.isArray(s.read().levels), false);
  assert.equal(s.read().levels.fase1.clears, 1);
  assert.equal(loadProgress().levels.fase1.done, true);
});

test('progresso: recupera campos inválidos sem apagar dados válidos das outras fases', t => {
  const good = clear();
  const s = storage(t, { v: 1, levels: {
    fase1: { done: 'true', best: -8, treats: '4', total: 5, clears: '3' },
    fase2: good,
    fase3: [], fase4: null, fase5: 'ganhou', '': good,
  } });
  assert.deepEqual(loadProgress(), { v: 1, levels: {
    fase1: { done: false, best: null, treats: 0, total: 5, clears: 0 },
    fase2: good,
  } });
  const result = recordLevelClear('fase1', { timeSec: 20, collected: 2, total: 5 }, 5);
  assert.equal(result.prog.levels.fase1.clears, 1, 'não concatena o contador string');
  assert.equal(result.rec.first, true, 'string não equivale à vitória booleana');
  assert.deepEqual(s.read().levels.fase2, good);
});

test('progresso: rejeita contagens negativas, fracionárias, infinitas e fora da precisão segura', t => {
  const s = storage(t);
  for (const value of [-1, 1.5, Infinity, -Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '2', null, true]) {
    assert.equal(saveProgress({ v: 1, levels: { fase1: clear({ treats: value, total: value, clears: value }) } }), true);
    assert.deepEqual(s.read().levels.fase1, clear({ treats: 0, total: null, clears: 0 }));
  }
  s.set('{"v":1,"levels":{"fase1":{"done":true,"best":1e400,"treats":2,"total":5,"clears":1}}}');
  assert.equal(loadProgress().levels.fase1.best, null, 'overflow numérico de JSON não vira recorde');
});

test('progresso: tempo inválido não substitui recorde válido nem é convertido de string', t => {
  const s = storage(t);
  for (const timeSec of [-1, Infinity, -Infinity, NaN, '1', null, undefined, true]) {
    s.set({ v: 1, levels: { fase1: clear() } });
    const result = recordLevelClear('fase1', { timeSec, collected: '9', total: -3 }, 5);
    assert.equal(result.prog.levels.fase1.best, 42.5);
    assert.equal(result.prog.levels.fase1.treats, 2);
    assert.equal(result.prog.levels.fase1.total, 5);
    assert.equal(result.rec.record, false);
    assert.equal(result.saved, true);
  }
  s.set(empty());
  assert.equal(recordLevelClear('fase1', { timeSec: '0' }, 5).rec.best, null);
  assert.equal(recordLevelClear('fase1', { timeSec: 0 }, 5).rec.best, 0);
});

test('progresso: vitória preserva melhores marcas, conta tentativas e distingue recorde', t => {
  const s = storage(t);
  const first = recordLevelClear('fase1', { timeSec: 30, collected: 3, total: 5 }, 5);
  assert.deepEqual(first.rec, { best: 30, record: false, first: true, prevTreats: null });
  const slower = recordLevelClear('fase1', { timeSec: 40, collected: 1, total: 5 }, 5);
  assert.deepEqual(slower.rec, { best: 30, record: false, first: false, prevTreats: 3 });
  const faster = recordLevelClear('fase1', { timeSec: 20, collected: 4, total: 5 }, 5);
  assert.deepEqual(faster.rec, { best: 20, record: true, first: false, prevTreats: 3 });
  assert.deepEqual(s.read().levels.fase1, clear({ best: 20, treats: 4 }));
});

test('progresso: relê outra aba e mantém fases desconhecidas ao acrescentar uma fase', t => {
  const s = storage(t, { v: 1, levels: { fase1: clear() } });
  loadProgress();
  const other = clear({ best: 15, treats: 5, clears: 8 });
  s.set({ v: 1, levels: { fase1: other, 'fase-outra-versao': clear() } });
  const result = recordLevelClear('fase2', { timeSec: 33, collected: 2 }, 6);
  assert.deepEqual(result.prog.levels.fase1, other);
  assert.deepEqual(s.read().levels['fase-outra-versao'], clear());
  assert.deepEqual(s.read().levels.fase2, clear({ best: 33, total: 6, clears: 1 }));
});

test('progresso: não apaga petiscos históricos nem deixa total menor que a coleta', t => {
  const s = storage(t, { v: 1, levels: { fase1: clear({ treats: 7, total: 5, clears: Number.MAX_SAFE_INTEGER }) } });
  assert.equal(loadProgress().levels.fase1.total, 7);
  const result = recordLevelClear('fase1', { timeSec: 50, collected: 1, total: 3 }, 3);
  assert.equal(result.prog.levels.fase1.treats, 7);
  assert.equal(result.prog.levels.fase1.total, 7);
  assert.equal(result.prog.levels.fase1.clears, Number.MAX_SAFE_INTEGER);
  assert.equal(s.read().levels.fase1.clears, Number.MAX_SAFE_INTEGER);
});

test('progresso: preserva integralmente versões declaradas desconhecidas, inclusive ao tentar resetar', t => {
  const s = storage(t);
  for (const v of [2, 99, 0, '1', null]) {
    s.set({ v, levels: { fase1: clear() }, future: { preserve: true } });
    const original = s.raw();
    assert.deepEqual(loadProgress(), empty());
    const result = recordLevelClear('fase1', { timeSec: 10, collected: 2, total: 5 }, 5);
    assert.equal(result.prog.levels.fase1.done, true, 'a cópia em memória permite continuar a partida');
    assert.equal(result.saved, false);
    assert.equal(saveProgress(empty()), false, 'reset do cliente antigo não apaga formato desconhecido');
    assert.equal(s.raw(), original);
  }
  assert.equal(s.writes.length, 0);
});

test('progresso: detecta versão futura escrita depois da leitura inicial', t => {
  const s = storage(t, { v: 1, levels: { fase1: clear() } });
  const candidate = loadProgress();
  s.set({ v: 2, levels: { fase1: { medals: 9 } } });
  const original = s.raw();
  assert.equal(saveProgress(candidate), false);
  assert.equal(s.raw(), original);
});

test('progresso: leitura negada não é confundida com save vazio nem autoriza escrita', t => {
  const s = storage(t, { v: 1, levels: { fase1: clear() } });
  const original = s.raw();
  s.api.getItem = () => { throw new Error('leitura negada'); };
  assert.deepEqual(loadProgress(), empty());
  assert.equal(recordLevelClear('fase2', { timeSec: 20 }, 4).saved, false);
  assert.equal(saveProgress(empty()), false);
  assert.equal(s.raw(), original);
  assert.equal(s.writes.length, 0);
});

test('progresso: getter de localStorage indisponível não impede registrar vitória em memória', t => {
  storage(t);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage bloqueado'); } });
  assert.deepEqual(loadProgress(), empty());
  const result = recordLevelClear('fase1', { timeSec: 20, collected: 1 }, 5);
  assert.equal(result.prog.levels.fase1.done, true);
  assert.equal(result.saved, false);
  assert.equal(saveProgress(result.prog), false);
});

test('progresso: falha transitória de leitura não apaga dados ao voltar a escrever', t => {
  const s = storage(t, { v: 1, levels: { fase1: clear() } });
  const original = s.raw();
  const getItem = s.api.getItem;
  let reads = 0;
  s.api.getItem = key => {
    if (reads++ === 0) throw new Error('falha transitória');
    return getItem(key);
  };
  assert.equal(recordLevelClear('fase2', { timeSec: 20 }, 4).saved, false);
  assert.equal(s.writes.length, 0);
  assert.equal(s.raw(), original);
  assert.equal(recordLevelClear('fase2', { timeSec: 20 }, 4).saved, true);
  assert.deepEqual(s.read().levels.fase1, clear());
});

test('progresso: quota de escrita preserva o save anterior e retorna falha sem interromper a partida', t => {
  const s = storage(t, { v: 1, levels: { fase1: clear() } });
  const original = s.raw();
  s.api.setItem = () => { throw new Error('quota excedida'); };
  const result = recordLevelClear('fase1', { timeSec: 10, collected: 5, total: 5 }, 5);
  assert.equal(result.saved, false);
  assert.equal(result.rec.best, 10);
  assert.equal(s.raw(), original);
  assert.equal(loadProgress().levels.fase1.best, 42.5);
});

test('progresso: save inválido e ID inválido não sobrescrevem um save válido', t => {
  const s = storage(t, { v: 1, levels: { fase1: clear() } });
  const original = s.raw();
  for (const invalid of [null, [], { v: 2, levels: {} }, { v: 1, levels: [] }]) assert.equal(saveProgress(invalid), false);
  for (const id of ['', null, undefined, 1]) assert.equal(recordLevelClear(id, {}, 5).saved, false);
  assert.equal(s.raw(), original);
});

test('progresso: IDs especiais são fases próprias, sem alterar o protótipo do mapa', t => {
  const s = storage(t);
  for (const id of ['__proto__', 'constructor', 'toString']) {
    const result = recordLevelClear(id, { timeSec: 5, collected: 1 }, 2);
    assert.equal(result.saved, true);
    assert.equal(Object.hasOwn(result.prog.levels, id), true);
    assert.equal(Object.getPrototypeOf(result.prog.levels), Object.prototype);
    assert.equal(s.read().levels[id].clears, 1);
  }
  assert.deepEqual(Object.keys(loadProgress().levels), ['__proto__', 'constructor', 'toString']);
});

test('progresso: prévia usa sua própria chave e não escreve no save de produção', async t => {
  const s = storage(t, { v: 1, levels: { fase1: clear() } });
  const original = s.raw();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: '/radhija-rhaenyra/previews/pr-12/123-1/' } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'location', previous);
    else delete globalThis.location;
  });
  const preview = await import('../src/ui/progress.js?preview-isolation');
  assert.equal(preview.PROG_KEY, 'rr-preview-pr-12:rr-progress-v1');
  assert.equal(preview.recordLevelClear('fase2', { timeSec: 15, collected: 1 }, 4).saved, true);
  assert.equal(s.raw(), original);
  assert.equal(s.read(preview.PROG_KEY).levels.fase2.done, true);
  assert.equal(s.read(preview.PROG_KEY).levels.fase1, undefined);
});
