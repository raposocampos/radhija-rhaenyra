import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareSite } from '../tools/deploy/prepare-site.mjs';
import { storageKey } from '../src/game/storageKey.js';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'rr-pages-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const site = join(root, 'site');
  const build = join(root, 'build');
  for (const dir of [site, build]) mkdirSync(dir);
  writeFileSync(join(site, 'index.html'), 'produção aprovada');
  writeFileSync(join(site, 'old.js'), 'asset em uso');
  writeFileSync(join(build, 'index.html'), 'nova versão');
  writeFileSync(join(build, 'new.js'), 'asset novo');
  writeFileSync(join(build, 'version.json'), '{"head":"test"}');
  return { site, build };
}

test('prévia preserva a produção e as prévias de outros PRs', t => {
  const paths = fixture(t);
  prepareSite({ ...paths, mode: 'preview', pr: '2', version: '100-1' });
  prepareSite({ ...paths, mode: 'preview', pr: '3', version: '101-1' });
  prepareSite({ ...paths, mode: 'preview', pr: '2', version: '102-1' });
  assert.equal(readFileSync(join(paths.site, 'index.html'), 'utf8'), 'produção aprovada');
  assert.equal(readFileSync(join(paths.site, 'old.js'), 'utf8'), 'asset em uso');
  assert.ok(existsSync(join(paths.site, 'previews/pr-3/101-1/index.html')));
  assert.ok(existsSync(join(paths.site, 'previews/pr-2/102-1/index.html')));
  assert.ok(!existsSync(join(paths.site, 'previews/pr-2/100-1')));
});

test('produção troca assets antigos e preserva a prévia para comparação', t => {
  const paths = fixture(t);
  prepareSite({ ...paths, mode: 'preview', pr: '2', version: '100-1' });
  prepareSite({ ...paths, mode: 'production' });
  assert.equal(readFileSync(join(paths.site, 'index.html'), 'utf8'), 'nova versão');
  assert.ok(!existsSync(join(paths.site, 'old.js')));
  assert.ok(existsSync(join(paths.site, 'new.js')));
  assert.ok(existsSync(join(paths.site, 'previews/pr-2/100-1/index.html')));
});

test('entrada inválida não altera a produção', t => {
  const paths = fixture(t);
  for (const args of [
    { mode: 'preview', pr: '../2', version: '100-1' },
    { mode: 'preview', pr: '2', version: '../100' },
    { mode: 'unknown' },
  ]) assert.throws(() => prepareSite({ ...paths, ...args }));
  rmSync(join(paths.build, 'version.json'));
  assert.throws(() => prepareSite({ ...paths, mode: 'production' }));
  assert.equal(readFileSync(join(paths.site, 'index.html'), 'utf8'), 'produção aprovada');
});

test('prévias isolam progresso e volume por PR, mantendo as chaves de produção', () => {
  for (const key of ['rr-progress-v1', 'operacao-cenoura:volume']) {
    assert.equal(storageKey(key, '/radhija-rhaenyra/'), key);
    assert.equal(storageKey(key, '/'), key);
    assert.equal(storageKey(key, '/radhija-rhaenyra/previews/pr-2/100-1/'), `rr-preview-pr-2:${key}`);
    assert.equal(storageKey(key, '/radhija-rhaenyra/previews/pr-2/101-2/'), `rr-preview-pr-2:${key}`);
    assert.notEqual(storageKey(key, '/previews/pr-2/100-1/'), storageKey(key, '/previews/pr-3/100-1/'));
  }
});
