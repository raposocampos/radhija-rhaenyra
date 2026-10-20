// Versão do jogo (AGENTS.md, "Versão do jogo"): um contador automático de PRs integrados ao main.
// MAJOR.MINOR vêm do campo "version" do package.json (só mudam em marcos pedidos pelo usuário); o PATCH soma os
// commits de primeiro pai do main (1 PR = 1 squash) desde o último que mudou esse campo; o build conta todos e
// nunca volta. Precisa do histórico completo (checkout com fetch-depth: 0).
//
// CI (ci.yml): node tools/deploy/version.mjs --github-env
//   exporta GAME_VERSION_INFO, que o vite.config.js embute no jogo e o ci.yml grava no version.json.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** "0.10.0" → { major: 0, minor: 10, patch: 0 }. Só MAJOR.MINOR.PATCH, sem sufixos. */
export function parseVersion(text) {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(text ?? ''));
  if (!m) throw new Error(`Versão inválida no package.json: ${JSON.stringify(text)} (use MAJOR.MINOR.PATCH, ex.: 0.10.0).`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Texto do canto do menu. Produção: "v0.10.0 · build 90"; prévia: "prévia PR #49 · sobre v0.10.0" (o main sob ela). */
export function versionLabel(info) {
  if (!info?.version) return 'versão de desenvolvimento';
  return info.pr ? `prévia PR #${info.pr} · sobre v${info.version}` : `v${info.version} · build ${info.build}`;
}

/** Valor do define __GAME_VERSION__ (vite.config.js): o que o CI calculou ou, sem ele, a versão de desenvolvimento. */
export function gameVersionFromEnv(env = process.env) {
  if (env.GAME_VERSION_INFO) return JSON.parse(env.GAME_VERSION_INFO);
  return { version: null, build: null, pr: null, label: versionLabel(null) };
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Campo "version" do package.json num commit; null se o arquivo não existe nele ou não é um JSON. */
function declaredAt(commit, cwd) {
  try {
    return JSON.parse(git(['show', `${commit}:package.json`], cwd)).version ?? null;
  } catch {
    return null;
  }
}

/** Versão e build de um commit do main, pelo histórico de primeiro pai. */
export function versionAt(rev = 'HEAD', { cwd } = {}) {
  if (git(['rev-parse', '--is-shallow-repository'], cwd) === 'true') {
    throw new Error('Histórico raso: a versão conta os commits do main. Use actions/checkout com fetch-depth: 0.');
  }
  const commit = git(['rev-parse', '--verify', `${rev}^{commit}`], cwd);
  const base = parseVersion(declaredAt(commit, cwd));
  // Candidatos: os commits de primeiro pai que mexeram no package.json (comparados só com o primeiro pai). O mais
  // recente cujo "version" difere do primeiro pai é a âncora; mudar só dependências ou a formatação não conta.
  let since = null;
  for (const c of git(['rev-list', '--first-parent', commit, '--', 'package.json'], cwd).split('\n').filter(Boolean)) {
    let parent = null;
    try { parent = git(['rev-parse', '--verify', '--quiet', `${c}^1`], cwd); } catch { /* commit inicial */ }
    if (!parent || declaredAt(parent, cwd) !== declaredAt(c, cwd)) { since = c; break; }
  }
  if (!since) throw new Error('Nenhum commit do histórico define o campo "version" do package.json.');
  const count = (range) => Number(git(['rev-list', '--count', '--first-parent', range], cwd));
  return { version: `${base.major}.${base.minor}.${base.patch + count(`${since}..${commit}`)}`, build: count(commit) };
}

/** O que o build do CI embute e grava no version.json. Num PR, version/build são os do main sob a prévia (base). */
export function resolveBuildInfo({ cwd, head = 'HEAD', base = '', pr = '' } = {}) {
  if (pr && (!/^[1-9]\d*$/.test(String(pr)) || !/^[0-9a-f]{40}$/.test(base))) throw new Error('PR ou base inválidos para a versão da prévia.');
  const at = versionAt(pr ? base : head, { cwd });
  const info = { version: at.version, build: at.build, pr: pr ? Number(pr) : null };
  return { ...info, label: versionLabel(info) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const info = resolveBuildInfo({ base: process.env.VERSION_BASE, pr: process.env.VERSION_PR });
  if (process.argv.includes('--github-env')) {
    appendFileSync(process.env.GITHUB_ENV, `GAME_VERSION_INFO=${JSON.stringify(info)}\n`);
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Versão do jogo: ${info.label}\n`);
  }
  console.log(JSON.stringify(info, null, 2));
}
