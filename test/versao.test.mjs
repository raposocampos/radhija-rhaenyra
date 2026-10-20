// Versão do jogo (tools/deploy/version.mjs, regra em docs/ENTREGA.md): PATCH pelos commits de primeiro pai desde a
// última mudança do campo "version", build pelo total deles, rótulos do menu, prévia de PR e a conferência da
// publicação. Os casos com Git usam repositórios temporários pequenos (alguns commits cada).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseVersion, formatVersion, versionLabel, gameVersionFromEnv, versionAt, resolveBuildInfo, checkArtifact,
} from '../tools/deploy/version.mjs';
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
  assert.equal(formatVersion({ major: 1, minor: 2, patch: 3 }), '1.2.3');
  for (const bad of ['0.10', 'v0.10.0', '0.10.0-beta', '01.2.3', '', null]) assert.throws(() => parseVersion(bad), /MAJOR\.MINOR\.PATCH/);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  parseVersion(pkg.version);
});

test('versão: rótulos do canto do menu (produção, prévia, teste, desenvolvimento)', () => {
  assert.equal(versionLabel({ version: '0.10.0', build: 90, pr: null }), 'v0.10.0 · build 90');
  assert.equal(versionLabel({ version: '0.10.0', build: 90, pr: 49, next: { version: '0.10.1', build: 91 } }), 'prévia PR #49 · sobre v0.10.0');
  assert.equal(versionLabel({ version: '0.10.3', build: 93, pr: 51, next: { version: '0.11.0', build: 94 } }), 'prévia PR #51 · sobre v0.10.3 → v0.11.0');
  assert.equal(versionLabel({ version: '0.12.4', build: 99, pr: 60, next: { version: '1.0.0', build: 100 } }), 'prévia PR #60 · sobre v0.12.4 → v1.0.0');
  assert.equal(versionLabel({ version: '0.10.0', build: 90, pr: 49, next: null }), 'prévia PR #49 · sobre v0.10.0');
  assert.equal(versionLabel({ version: '0.10.2', build: 92, pr: null, test: true }), 'v0.10.2 · build 92 · teste');
  assert.equal(versionLabel(null), 'versão de desenvolvimento');
  // Fora do Vite (Node) não há o define: o menu mostra a versão de desenvolvimento, sem erro.
  assert.equal(VERSION_LABEL, 'versão de desenvolvimento');
  assert.match(template(), /<p class="rr-version">versão de desenvolvimento<\/p>/);
  assert.equal(gameVersionFromEnv({}).label, 'versão de desenvolvimento');
  const info = { version: '0.10.0', build: 90, pr: null, label: 'v0.10.0 · build 90' };
  assert.deepEqual(gameVersionFromEnv({ GAME_VERSION_INFO: JSON.stringify(info) }), info);
});

test('versão: o PATCH sobe a cada commit de primeiro pai e volta a 0 quando o PR muda a versão; o build nunca volta', t => {
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

test('versão: a prévia mostra o main sob ela e o que o merge vira', t => {
  const r = repo(t);
  r.commit({ version: '0.10.0' });
  const base = r.commit();
  // PR comum: o merge de teste do GitHub (refs/pull/N/merge) tem o main como primeiro pai.
  r.git('checkout', '-q', '-b', 'pr7');
  r.commit();
  r.git('checkout', '-q', '--detach', base);
  r.git('merge', '-q', '--no-ff', '--no-edit', 'pr7');
  const info = resolveBuildInfo({ cwd: r.dir, head: 'HEAD', base, pr: '7' });
  assert.deepEqual(info, { version: '0.10.1', build: 2, pr: 7, next: { version: '0.10.2', build: 3 }, label: 'prévia PR #7 · sobre v0.10.1' });
  // PR que traz uma fase nova e sobe o MINOR.
  r.git('checkout', '-q', '-b', 'pr8', base);
  r.commit({ version: '0.11.0' });
  r.git('checkout', '-q', '--detach', base);
  r.git('merge', '-q', '--no-ff', '--no-edit', 'pr8');
  const bump = resolveBuildInfo({ cwd: r.dir, base, pr: 8 });
  assert.deepEqual(bump.next, { version: '0.11.0', build: 3 });
  assert.equal(bump.label, 'prévia PR #8 · sobre v0.10.1 → v0.11.0');
  // Merge sobre outra base (o main andou): sem previsão do número.
  r.git('checkout', '-q', 'main');
  const newer = r.commit();
  r.git('checkout', '-q', '--detach', newer);
  r.git('merge', '-q', '--no-ff', '--no-edit', 'pr7');
  assert.equal(resolveBuildInfo({ cwd: r.dir, base, pr: 7 }).next, null);
  assert.throws(() => resolveBuildInfo({ cwd: r.dir, base: 'main', pr: 7 }), /inválidos/);
  assert.throws(() => resolveBuildInfo({ cwd: r.dir, base, pr: '7; rm' }), /inválidos/);
});

test('versão: main, outro branch e a conferência da publicação', t => {
  const r = repo(t);
  r.commit({ version: '0.10.0' });
  const head = r.commit();
  r.git('checkout', '-q', 'main');
  assert.deepEqual(resolveBuildInfo({ cwd: r.dir, ref: 'refs/heads/main' }), { version: '0.10.1', build: 2, pr: null, label: 'v0.10.1 · build 2' });
  assert.equal(resolveBuildInfo({ cwd: r.dir, ref: 'refs/heads/claude/x' }).label, 'v0.10.1 · build 2 · teste');

  const production = { cwd: r.dir, mode: 'production', head };
  assert.equal(checkArtifact({ version: '0.10.1', build: 2 }, production).label, 'v0.10.1 · build 2');
  assert.throws(() => checkArtifact({ version: '0.10.1', build: 3 }, production), /difere/);
  assert.throws(() => checkArtifact({}, production), /difere/, 'artefato sem versão não vai para a produção');
  assert.throws(() => checkArtifact({ version: '0.10.1', build: 2 }, { ...production, head: 'HEAD' }), /inválido/);

  const preview = { cwd: r.dir, mode: 'preview', base: head, pr: '7' };
  const ok = checkArtifact({ version: '0.10.1', build: 2, pr: 7 }, preview);
  assert.deepEqual([ok.label, ok.warnings], ['prévia PR #7 · sobre v0.10.1', []]);
  const old = checkArtifact({ head: 'x' }, preview); // PR com o CI antigo ou que mudou o cálculo: só avisa
  assert.equal(old.label, 'prévia PR #7 · sobre v0.10.1');
  assert.equal(old.warnings.length, 1);
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

test('versão: o CI e a publicação contam com o histórico completo', () => {
  const read = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');
  const checkouts = (yml) => yml.split('- uses: actions/checkout@').slice(1).map((s) => s.split(/\n\s+- (?:uses|name|run|id):/)[0]);
  const ci = read('ci.yml');
  assert.ok(checkouts(ci).every((c) => /fetch-depth: 0\b/.test(c)), 'ci.yml: checkout com fetch-depth: 0');
  assert.match(ci, /node tools\/deploy\/version\.mjs --github-env/);
  assert.match(ci, /\.\.\.JSON\.parse\(process\.env\.GAME_VERSION_INFO\)/);
  const deploy = read('deploy.yml');
  const source = checkouts(deploy).filter((c) => /path: source\b/.test(c));
  assert.equal(source.length, 1);
  assert.match(source[0], /fetch-depth: 0\b/, 'deploy.yml: checkout do main com fetch-depth: 0');
  assert.match(deploy, /node source\/tools\/deploy\/version\.mjs --check build\/version\.json/);
});
