// Versão do jogo (tools/deploy/version.mjs, regra no AGENTS.md): PATCH pelos commits de primeiro pai desde a última
// mudança do campo "version", build pelo total deles, os rótulos do menu e a prévia de PR. Os casos com Git usam
// repositórios temporários pequenos (alguns commits cada).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseVersion, versionLabel, gameVersionFromEnv, versionAt, resolveBuildInfo } from '../tools/deploy/version.mjs';
import { VERSION_LABEL } from '../src/core/version.js';
import { template } from '../src/ui/markup.js';

/** Repositório temporário com o branch main e um package.json; commit() devolve o SHA. */
function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rr-versao-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = {
    ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(dir, '.sem-config-global'),
    GIT_AUTHOR_NAME: 'teste', GIT_AUTHOR_EMAIL: 'teste@example.invalid', GIT_COMMITTER_NAME: 'teste', GIT_COMMITTER_EMAIL: 'teste@example.invalid',
  };
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'commit.gpgsign', 'false');
  let n = 0;
  /** @param {{ version?: string, deps?: object, indent?: number }} [pkg] package.json novo (sem: só outro arquivo muda) */
  const commit = (pkg) => {
    if (pkg) writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: pkg.version, dependencies: pkg.deps ?? {} }, null, pkg.indent ?? 2) + '\n');
    writeFileSync(join(dir, `arquivo-${++n}.txt`), `${n}\n`); // um arquivo por commit: os merges não conflitam
    git('add', '-A');
    git('commit', '-q', '-m', `commit ${n}`);
    return git('rev-parse', 'HEAD');
  };
  const at = (rev = 'HEAD') => { const v = versionAt(rev, { cwd: dir }); return `${v.version} · ${v.build}`; };
  return { dir, git, commit, at };
}

test('versão: o package.json declara só MAJOR.MINOR.PATCH (o do jogo também)', () => {
  assert.deepEqual(parseVersion('0.10.0'), { major: 0, minor: 10, patch: 0 });
  for (const bad of ['0.10', 'v0.10.0', '0.10.0-beta', '01.2.3', '', null]) assert.throws(() => parseVersion(bad), /MAJOR\.MINOR\.PATCH/);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  parseVersion(pkg.version);
});

test('versão: rótulos do canto do menu (produção, prévia, desenvolvimento)', () => {
  assert.equal(versionLabel({ version: '0.10.0', build: 90, pr: null }), 'v0.10.0 · build 90');
  assert.equal(versionLabel({ version: '0.10.0', build: 90, pr: 49 }), 'prévia PR #49 · sobre v0.10.0');
  assert.equal(versionLabel(null), 'versão de desenvolvimento');
  // Fora do Vite (Node) não há o define: o menu mostra a versão de desenvolvimento, sem erro.
  assert.equal(VERSION_LABEL, 'versão de desenvolvimento');
  assert.match(template(), /<p class="rr-version">versão de desenvolvimento<\/p>/);
  assert.equal(gameVersionFromEnv({}).label, 'versão de desenvolvimento');
  const info = { version: '0.10.0', build: 90, pr: null, label: 'v0.10.0 · build 90' };
  assert.deepEqual(gameVersionFromEnv({ GAME_VERSION_INFO: JSON.stringify(info) }), info);
});

test('versão: o PATCH sobe a cada commit de primeiro pai e volta a 0 quando a versão muda; o build nunca volta', t => {
  const r = repo(t);
  r.commit({ version: '0.1.0' });
  assert.equal(r.at(), '0.1.0 · 1');
  const c2 = r.commit();
  assert.equal(r.at(), '0.1.1 · 2');
  r.commit({ version: '0.1.0', deps: { three: '0.170.0' } }); // só dependências: não conta como mudança de versão
  assert.equal(r.at(), '0.1.2 · 3');
  r.commit({ version: '0.1.0', deps: { three: '0.170.0' }, indent: 4 }); // só a formatação
  assert.equal(r.at(), '0.1.3 · 4');
  r.commit({ version: '0.10.0', deps: { three: '0.170.0' } }); // o PR que fecha a demo de 10 fases
  assert.equal(r.at(), '0.10.0 · 5');
  r.commit();
  r.commit();
  assert.equal(r.at(), '0.10.2 · 7');
  assert.equal(r.at(c2), '0.1.1 · 2', 'um commit antigo continua com o número dele');
});

test('versão: merge de verdade no primeiro pai conta uma vez; os commits do outro lado não contam', t => {
  const r = repo(t);
  r.commit({ version: '0.1.0' });
  r.git('checkout', '-q', '-b', 'lado');
  r.commit();
  r.commit({ version: '0.2.0' });
  r.git('checkout', '-q', 'main');
  r.commit();
  r.git('merge', '-q', '--no-ff', '--no-edit', 'lado');
  assert.equal(r.at(), '0.2.0 · 3', 'o merge trouxe a versão nova do outro lado');
  r.git('checkout', '-q', '-b', 'lado2');
  r.commit();
  r.commit();
  r.git('checkout', '-q', 'main');
  r.git('merge', '-q', '--no-ff', '--no-edit', 'lado2');
  assert.equal(r.at(), '0.2.1 · 4');
});

test('versão: no main conta o próprio commit; na prévia, o main sob ela', t => {
  const r = repo(t);
  r.commit({ version: '0.10.0' });
  const base = r.commit();
  assert.deepEqual(resolveBuildInfo({ cwd: r.dir }), { version: '0.10.1', build: 2, pr: null, label: 'v0.10.1 · build 2' });
  // O merge de teste do GitHub (refs/pull/N/merge) fica por cima do main; a prévia mostra o main.
  r.git('checkout', '-q', '-b', 'pr7');
  r.commit();
  r.git('checkout', '-q', '--detach', base);
  r.git('merge', '-q', '--no-ff', '--no-edit', 'pr7');
  assert.deepEqual(resolveBuildInfo({ cwd: r.dir, base, pr: '7' }), { version: '0.10.1', build: 2, pr: 7, label: 'prévia PR #7 · sobre v0.10.1' });
  assert.equal(r.at(), '0.10.2 · 3', 'o merge é o número que o squash recebe');
  assert.throws(() => resolveBuildInfo({ cwd: r.dir, base: 'main', pr: 7 }), /inválidos/);
  assert.throws(() => resolveBuildInfo({ cwd: r.dir, base, pr: '7; rm' }), /inválidos/);
});

test('versão: histórico raso é recusado (checkout sem fetch-depth: 0 contaria errado)', t => {
  const r = repo(t);
  r.commit({ version: '0.10.0' });
  r.commit();
  const shallow = mkdtempSync(join(tmpdir(), 'rr-versao-raso-'));
  t.after(() => rmSync(shallow, { recursive: true, force: true }));
  r.git('clone', '-q', '--depth', '1', pathToFileURL(r.dir).href, shallow);
  assert.throws(() => versionAt('HEAD', { cwd: shallow }), /fetch-depth: 0/);
});

test('versão: o CI conta com o histórico completo e grava a versão no version.json', () => {
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const checkouts = ci.split('- uses: actions/checkout@').slice(1).map((s) => s.split(/\n\s+- (?:uses|name|run|id):/)[0]);
  assert.ok(checkouts.length && checkouts.every((c) => /fetch-depth: 0\b/.test(c)), 'ci.yml: checkout com fetch-depth: 0');
  assert.match(ci, /node tools\/deploy\/version\.mjs --github-env/);
  assert.match(ci, /\.\.\.JSON\.parse\(process\.env\.GAME_VERSION_INFO\)/);
});
