import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Recursos do Chromium desligados nos testes, além dos que o próprio Playwright desliga.
// ScriptStreaming: sem ele, o travamento intermitente do boot (cerca de 1% das páginas no CI, ver
// docs/ARQUITETURA.md §10, "Travamento no primeiro carregamento") era um impasse dentro da aba: os módulos que o
// Vite serve um a um eram compilados em segundo plano (BackgroundResourceScriptStreamer) no pool de threads da aba,
// que no runner de 4 núcleos tem 3 vagas; essas compilações pediam uma coleta de lixo e esperavam a thread principal;
// a thread principal, no layout do primeiro texto (logotipo, fonte web ainda carregando), esperava o serviço de
// fontes, cuja tarefa vai para o MESMO pool e não achava vaga. Ninguém andava, sem CPU (pilhas nativas pelo gdb,
// hang-probe.mjs). Sem o streaming, os scripts compilam na thread principal e nada no pool espera por ela.
// O jogo publicado não muda: é só uma otimização de carregamento do navegador dos testes.
export const EXTRA_DISABLED_FEATURES = ['ScriptStreaming'];

/** O `--disable-features=…` que o Playwright já passa (chromiumSwitches.js do pacote), ou null se não achar. */
export function playwrightDisabledFeaturesArg() {
  try {
    const require = createRequire(import.meta.url);
    const dir = dirname(require.resolve('playwright-core/package.json'));
    const { chromiumSwitches } = require(join(dir, 'lib/server/chromium/chromiumSwitches.js'));
    return chromiumSwitches.find((arg) => arg.startsWith('--disable-features=')) ?? null;
  } catch {
    return null;
  }
}

/**
 * O Chromium só lê o ÚLTIMO --disable-features da linha de comando, e o Playwright acrescenta os nossos argumentos
 * depois dos dele: um segundo --disable-features apagaria a lista dele (PaintHolding, LazyFrameLoading...). Então
 * a lista dele sai (ignoreDefaultArgs) e entra uma só, com a dele e a nossa. Sem achar a dele (Playwright mudou o
 * arquivo), nada muda e sai um aviso: melhor ficar sem a correção do que apagar a lista do Playwright.
 */
export function disabledFeaturesOptions(defaultArg = playwrightDisabledFeaturesArg(), extra = EXTRA_DISABLED_FEATURES) {
  if (!defaultArg) {
    console.warn(`[e2e] aviso: não achei o --disable-features do Playwright; ${extra.join(', ')} continua ligado no Chromium dos testes`);
    return { ignoreDefaultArgs: [], args: [] };
  }
  const own = defaultArg.slice('--disable-features='.length).split(',').filter(Boolean);
  const all = [...own, ...extra.filter((f) => !own.includes(f))];
  return { ignoreDefaultArgs: [defaultArg], args: [`--disable-features=${all.join(',')}`] };
}

/**
 * A GPU dos testes no CI: o SwiftShader (renderização por software) pelo ANGLE em Vulkan, sem o estado dinâmico de
 * entrada de vértices (supportsVertexInputDynamicState). O SwiftShader compila uma rotina de vértices para cada
 * combinação de formatos dos 16 locais de atributo, e o vkCmdSetVertexInputEXT dele só escreve os locais da lista
 * nova: os outros guardam o formato do desenho anterior. Com esse estado dinâmico, a mesma malha pedia uma rotina nova
 * conforme o que foi desenhado antes dela (o three ordena os desenhos pela câmera): 150–500 ms de compilação (JIT
 * Subzero) num quadro qualquer, sem nada novo no WebGL. Sem ele, o ANGLE põe os atributos no pipeline e a rotina não
 * depende da ordem. GPU de verdade não compila por ordem de desenho, e fora do CI (Chrome do sistema, D3D/Metal) a
 * chave nem existe. E2E_VERTEX_INPUT_DYNAMIC=1 volta ao padrão do Chromium (para comparar). Ver ARQUITETURA §10.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function angleArgs(env = process.env) {
  if (!env.CI) return [];
  return [
    '--use-angle=swiftshader',
    ...(env.E2E_VERTEX_INPUT_DYNAMIC === '1' ? [] : ['--disable-angle-features=supportsVertexInputDynamicState']),
  ];
}

// No CI, usa a versão do Chromium instalada pelo Playwright do package-lock.
// Localmente, mantém Chrome/Edge do sistema; CHROME_PATH permite escolher outro.
export function browserOptions() {
  const configured = process.env.CHROME_PATH;
  if (configured && !existsSync(configured)) {
    throw new Error('CHROME_PATH aponta para um navegador que não existe.');
  }
  const systemPaths = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const features = disabledFeaturesOptions();
  return {
    executablePath: configured || (process.env.CI ? undefined : systemPaths.find((p) => existsSync(p))),
    headless: true,
    ignoreDefaultArgs: features.ignoreDefaultArgs,
    args: [
      '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required',
      ...features.args,
      // Os runners Linux não têm GPU física; WebGL usa renderização por software (angleArgs, acima).
      ...angleArgs(),
      // Registro do próprio Chromium (queda/travamento da GPU, processos, OOM) no stderr do navegador, que o
      // browser-log.mjs desvia para shots/diagnostico/ (ver hang-probe.mjs).
      ...(process.env.CI || process.env.E2E_BROWSER_LOG ? ['--enable-logging=stderr'] : []),
    ],
  };
}
