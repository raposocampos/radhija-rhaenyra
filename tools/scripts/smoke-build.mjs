// Verificação do build gerado nesta execução E2E, sem Vite nem fontes disponíveis.
// Não é o artefato binário produzido pelo CI da prévia.
// node tools/scripts/smoke-build.mjs (depois do build; workflow E2E manual no GitHub).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarness } from './lib/harness.mjs';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const MOUNT = '/previews/pr-smoke/1-1/';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(MOUNT)) { response.writeHead(404).end(); return; }
    const file = resolve(DIST, pathname.slice(MOUNT.length) || 'index.html');
    if (!file.startsWith(resolve(DIST) + sep)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
});

let H;
let timedOut = false;
// Também interrompe um import pendurado dentro de evaluate(); o finally libera tudo.
const watchdog = setTimeout(() => {
  timedOut = true;
  console.error('[smoke] excedeu o limite de quatro minutos');
  void H?.browser.close();
  server.closeAllConnections();
}, 240000);
watchdog.unref();

try {
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  const base = `http://127.0.0.1:${server.address().port}${MOUNT}`;
  H = await createHarness({ base, outDir: 'shots/smoke-build' });
  const { page, check } = H;
  const scripts = new Set();
  const failedRequests = [];
  const outsideMount = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('http') && !url.startsWith(base)) outsideMount.push(url);
    if (request.resourceType() === 'script') scripts.add(url);
  });
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${base}?play`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__game?.game?.debug?.info().timeSec > 0.3, null, { timeout: 120000 });
  const levels = await page.evaluate(() => window.__game.levels.map((level) => ({ id: level.id, lazy: typeof level.load === 'function' })));
  check(levels.length > 0, 'registro de fases presente no build');
  check(scripts.size >= 2, 'entrada e cenário inicial carregados como arquivos JavaScript');
  for (const [index, level] of levels.entries()) {
    const before = new Set(scripts);
    if (index > 0) {
      // Usa o carregador compilado real, preservando o contexto da mesma aba.
      await page.evaluate(async (next) => { await window.__game.game.loadLevel(next, { mode: 'play' }); }, index);
      await page.waitForFunction(() => window.__game.game.debug.info().timeSec > 0.3, null, { timeout: 120000 });
    }
    const state = await H.info();
    check(state.levelId === level.id && state.state === 'playing', `${level.id}: cena e puzzle inicializados`, state.state);
    check(Number.isFinite(state.dogs.radhija.x) && Number.isFinite(state.dogs.rhaenyra.x), `${level.id}: personagens com estado válido`);
    if (index > 0 && level.lazy) {
      check([...scripts].some((url) => !before.has(url)), `${level.id}: import sob demanda buscou um novo chunk compilado`);
    }
  }
  await page.evaluate(() => document.fonts.ready);
  check(outsideMount.length === 0, 'todos os recursos respeitam o subcaminho da prévia', outsideMount);
  check(failedRequests.length === 0, 'nenhum recurso ausente ou requisição malsucedida', failedRequests);
  check([...scripts].every((url) => new URL(url).pathname.startsWith(`${MOUNT}assets/`) && /\.js$/.test(new URL(url).pathname)), 'executou somente chunks do dist, sem servidor de desenvolvimento');
} catch (error) {
  console.error(`[smoke] ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  try {
    if (H && await H.close()) process.exitCode = 1;
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  if (timedOut) process.exitCode = 1;
}
