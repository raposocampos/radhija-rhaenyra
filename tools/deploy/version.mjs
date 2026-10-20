// Versão do jogo (regra em AGENTS.md e docs/ENTREGA.md, "Versão do jogo"): MAJOR.MINOR.PATCH mais um número de build.
// MAJOR.MINOR vêm do campo "version" do package.json (mudam à mão, no próprio PR); o PATCH sobe sozinho com cada
// commit de primeiro pai do main (1 PR = 1 squash) desde o último que mudou esse campo; o build conta todos os
// commits de primeiro pai do main e nunca volta. Precisa do histórico completo (checkout com fetch-depth: 0).
//
// CI (ci.yml):        node tools/deploy/version.mjs --github-env
//   calcula a versão do código testado e exporta GAME_VERSION_INFO (lido pelo vite.config.js e pelo version.json).
// Publicação (deploy.yml, cópia confiável do main): node source/tools/deploy/version.mjs --check build/version.json
//   recalcula pelo Git e confere o artefato (na produção, recusa divergência; na prévia, só avisa).
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;

/** "0.10.0" → { major: 0, minor: 10, patch: 0 }. Só MAJOR.MINOR.PATCH, sem sufixos. */
export function parseVersion(text) {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(text ?? ''));
  if (!m) throw new Error(`Versão inválida no package.json: ${JSON.stringify(text)} (use MAJOR.MINOR.PATCH, ex.: 0.10.0).`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export const formatVersion = ({ major, minor, patch }) => `${major}.${minor}.${patch}`;

/**
 * Texto do canto do menu. Produção: "v0.10.0 · build 90". Prévia: "prévia PR #49 · sobre v0.10.0" (a versão do main
 * sob a prévia) e, se o PR muda MAJOR/MINOR, "→ v0.11.0". Fora do main: "· teste". Sem versão: desenvolvimento.
 */
export function versionLabel(info) {
  if (!info?.version) return 'versão de desenvolvimento';
  if (info.pr) {
    const next = info.next?.version;
    const bump = next && next.split('.').slice(0, 2).join('.') !== info.version.split('.').slice(0, 2).join('.');
    return `prévia PR #${info.pr} · sobre v${info.version}${bump ? ` → v${next}` : ''}`;
  }
  return `v${info.version} · build ${info.build}${info.test ? ' · teste' : ''}`;
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

/**
 * Versão e build de um commit do main (ou de um merge sobre ele), pelo histórico de primeiro pai.
 * @returns {{ version: string, build: number, declared: string, since: string, commit: string }}
 */
export function versionAt(rev = 'HEAD', { cwd } = {}) {
  if (git(['rev-parse', '--is-shallow-repository'], cwd) === 'true') {
    throw new Error('Histórico raso: a versão conta os commits do main. Use actions/checkout com fetch-depth: 0.');
  }
  const commit = git(['rev-parse', '--verify', `${rev}^{commit}`], cwd);
  const declared = declaredAt(commit, cwd);
  const base = parseVersion(declared);
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
  return {
    version: formatVersion({ ...base, patch: base.patch + count(`${since}..${commit}`) }),
    build: count(commit),
    declared,
    since,
    commit,
  };
}

/**
 * O que o build do CI embute e grava no version.json.
 * - PR (pr e base): version/build são os do main sob a prévia (base); next é o que o merge vira se entrar agora
 *   (o main exige branch atualizado, então é o número que o squash recebe).
 * - main: a versão do commit; outro branch: a mesma conta, marcada como teste.
 */
export function resolveBuildInfo({ cwd, head = 'HEAD', base = '', pr = '', ref = '' } = {}) {
  if (pr) {
    if (!/^[1-9]\d*$/.test(String(pr)) || !SHA.test(base)) throw new Error('PR ou base inválidos para a versão da prévia.');
    const on = versionAt(base, { cwd });
    const merge = versionAt(head, { cwd });
    let parent = '';
    try { parent = git(['rev-parse', '--verify', '--quiet', `${merge.commit}^1`], cwd); } catch { /* sem pai */ }
    const info = { version: on.version, build: on.build, pr: Number(pr), next: parent === on.commit ? { version: merge.version, build: merge.build } : null };
    return { ...info, label: versionLabel(info) };
  }
  const at = versionAt(head, { cwd });
  const info = { version: at.version, build: at.build, pr: null, ...(ref === 'refs/heads/main' ? {} : { test: true }) };
  return { ...info, label: versionLabel(info) };
}

/**
 * Publicação: recalcula com o Git do main (confiável) e confere o version.json do artefato (dados do CI).
 * Produção: version e build precisam bater (o CI do main roda este mesmo código). Prévia: o PR pode ter mudado este
 * script, então só avisa; o rótulo devolvido é sempre o recalculado.
 */
export function checkArtifact(artifact, { cwd, mode, head, base, pr }) {
  if (mode === 'production') {
    if (!SHA.test(head ?? '')) throw new Error('Head inválido.');
    const at = versionAt(head, { cwd });
    if (artifact.version !== at.version || artifact.build !== at.build) {
      throw new Error(`Versão do artefato (${artifact.version} · build ${artifact.build}) difere da calculada no main (${at.version} · build ${at.build}).`);
    }
    const info = { version: at.version, build: at.build, pr: null };
    return { ...info, label: versionLabel(info), warnings: [] };
  }
  if (mode !== 'preview' || !SHA.test(base ?? '') || !/^[1-9]\d*$/.test(pr ?? '')) throw new Error('Modo, base ou PR inválidos.');
  const on = versionAt(base, { cwd });
  const info = { version: on.version, build: on.build, pr: Number(pr) };
  const warnings = artifact.version === on.version && artifact.build === on.build && artifact.pr === Number(pr)
    ? [] : [`A prévia informa ${JSON.stringify([artifact.version, artifact.build, artifact.pr])}; o main calcula ${JSON.stringify([on.version, on.build, Number(pr)])}.`];
  return { ...info, label: versionLabel(info), warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const env = process.env;
  const out = (file, lines) => { if (file) appendFileSync(file, lines.map((l) => `${l}\n`).join('')); };
  const checkAt = process.argv.indexOf('--check');
  if (checkAt > 0) {
    const artifact = JSON.parse(readFileSync(process.argv[checkAt + 1], 'utf8'));
    const result = checkArtifact(artifact, {
      cwd: env.VERSION_REPO || undefined, mode: env.SITE_MODE, head: env.EXPECTED_HEAD, base: env.EXPECTED_BASE, pr: env.PR_NUMBER,
    });
    for (const w of result.warnings) console.log(`::warning::${w}`);
    out(env.GITHUB_OUTPUT, [`label=${result.label}`, `version=${result.version}`, `build=${result.build}`]);
    console.log(result.label);
  } else {
    const info = resolveBuildInfo({ head: 'HEAD', base: env.VERSION_BASE, pr: env.VERSION_PR, ref: env.GITHUB_REF });
    if (process.argv.includes('--github-env')) {
      out(env.GITHUB_ENV, [`GAME_VERSION_INFO=${JSON.stringify(info)}`]);
      out(env.GITHUB_STEP_SUMMARY, [`### Versão do jogo: ${info.label}`]);
    }
    console.log(JSON.stringify(info, null, 2));
  }
}
