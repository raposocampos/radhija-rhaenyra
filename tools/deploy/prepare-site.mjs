// Um único site Pages: produção na raiz e uma prévia atual por PR.
// Só copia arquivos estáticos; não instala nem executa código da build.
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

function checkTree(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = lstatSync(path);
    if (name.startsWith('.') || stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
      throw new Error(`Arquivo não permitido no site: ${name}`);
    }
    if (stat.isDirectory()) checkTree(path);
  }
}

export function prepareSite({ site, build, mode, pr, version }) {
  site = resolve(site);
  build = resolve(build);
  if (site === build || site.startsWith(build + sep) || build.startsWith(site + sep)) {
    throw new Error('Build e site devem ficar em diretórios separados.');
  }
  if (!['preview', 'production'].includes(mode)) throw new Error('Modo inválido.');
  if (mode === 'preview' && (!/^[1-9]\d*$/.test(pr ?? '') || !/^\d+-\d+$/.test(version ?? ''))) {
    throw new Error('PR ou versão de prévia inválidos.');
  }
  if (!existsSync(join(build, 'index.html')) || !existsSync(join(build, 'version.json'))) {
    throw new Error('Build incompleta.');
  }
  if (existsSync(join(build, 'previews'))) throw new Error('A build não pode reservar o caminho previews.');
  checkTree(build);
  // Falhar antes de apagar qualquer arquivo quando o estado inicial estiver ausente.
  if (!existsSync(join(site, 'index.html'))) throw new Error('Inicialize pages-state com a produção atual.');
  // .nojekyll é gerenciado aqui; todos os demais caminhos devem ser comuns.
  for (const name of readdirSync(site)) {
    const stat = lstatSync(join(site, name));
    if (name === '.nojekyll' && stat.isFile()) continue;
    if (name.startsWith('.') || stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) throw new Error('Estado estático inválido.');
    if (stat.isDirectory()) checkTree(join(site, name));
  }

  if (mode === 'preview') {
    const parent = join(site, 'previews', `pr-${pr}`);
    // Nova URL por execução: não mudar silenciosamente uma versão já testada.
    rmSync(parent, { recursive: true, force: true });
    mkdirSync(parent, { recursive: true });
    cpSync(build, join(parent, version), { recursive: true });
  } else {
    // Remover assets antigos da produção, preservando todas as prévias.
    for (const name of readdirSync(site)) {
      if (name !== 'previews') rmSync(join(site, name), { recursive: true, force: true });
    }
    cpSync(build, site, { recursive: true });
  }
  writeFileSync(join(site, '.nojekyll'), '');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prepareSite({
    site: process.argv[2], build: process.argv[3], mode: process.env.SITE_MODE,
    pr: process.env.PR_NUMBER, version: process.env.PREVIEW_VERSION,
  });
}
