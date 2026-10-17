// Regressões no build desta execução E2E (não no artefato da prévia).
// Falhas identificadas abaixo são controladas; o harness continua rigoroso para qualquer outra.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHarness } from './lib/harness.mjs';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const MOUNT = '/previews/pr-903/1-1/';
const PROGRESS_KEY = 'rr-preview-pr-903:rr-progress-v1';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const temporary = await mkdtemp(join(tmpdir(), 'rr-load-recovery-'));
let serving = DIST;
let H;
let timedOut = false;
const missing = [];
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(MOUNT)) { response.writeHead(404).end(); return; }
    const file = resolve(serving, pathname.slice(MOUNT.length) || 'index.html');
    if (!file.startsWith(resolve(serving) + sep)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch (error) {
    if (error.code === 'ENOENT') missing.push(request.url);
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
});
const watchdog = setTimeout(() => {
  timedOut = true;
  console.error('[recuperacao] excedeu o limite de oito minutos');
  void H?.browser.close();
  server.closeAllConnections();
}, 480000);
watchdog.unref();

// Simula a publicação de nomes de chunks novos, removendo os nomes da versão A.
// Mesmos bytes de lógica, referências reescritas: isola o problema de URL obsoleta.
async function nextVersion() {
  const next = join(temporary, 'version-b');
  await cp(DIST, next, { recursive: true });
  const files = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      if (entry.isDirectory()) await walk(file); else files.push(file);
    }
  }
  await walk(next);
  const chunks = files.filter((file) => extname(file) === '.js');
  const names = chunks.map((file) => [basename(file), basename(file).replace(/\.js$/, '.next.js')]);
  for (const file of files.filter((file) => ['.html', '.js', '.json'].includes(extname(file)))) {
    let source = await readFile(file, 'utf8');
    for (const [before, after] of names) source = source.replaceAll(before, after);
    await writeFile(file, source);
  }
  for (const file of chunks) await rename(file, file.replace(/\.js$/, '.next.js'));
  return next;
}

try {
  const manifest = JSON.parse(await readFile(join(DIST, '.vite/manifest.json'), 'utf8'));
  const firstWorld = manifest['src/levels/fase1/world.js']?.file;
  const secondWorld = manifest['src/levels/fase2/world.js']?.file;
  assert.ok(firstWorld && secondWorld, 'manifest identifica os chunks reais das duas fases');
  const versionB = await nextVersion();
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const base = `http://127.0.0.1:${server.address().port}${MOUNT}`;
  H = await createHarness({ base, outDir: 'shots/load-recovery' });
  const { page, check } = H;
  const diagnostics = [];
  const responses = [];
  const scripts = [];
  page.on('console', (message) => diagnostics.push({ type: message.type(), text: message.text(), url: message.location().url }));
  page.on('response', (response) => { if (response.status() >= 400) responses.push({ url: response.url(), status: response.status() }); });
  page.on('request', (request) => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  const ready = async () => {
    await page.waitForFunction(() => window.__game?.game.state === 'playing' && window.__game.game.debug.info().timeSec > 0.1, null, { timeout: 120000 });
    await page.waitForSelector('#loading', { state: 'detached' });
  };
  const errorScreen = async (canReturn) => {
    await page.waitForSelector('.rr-load-error.is-on', { state: 'visible' });
    const view = await page.evaluate(() => ({
      state: window.__game?.game.state,
      curtain: window.__game?.ui.curtain,
      loading: !!document.getElementById('loading'),
      focused: document.activeElement?.getAttribute('data-action'),
      back: !document.querySelector('[data-action="cancel-load"]').hidden,
      dialog: document.querySelector('.rr-load-error').getAttribute('role'),
    }));
    check(view.state === 'load-error' && view.curtain === 'off' && !view.loading, 'erro tem tela utilizável, sem cortina ou overlay prendendo a entrada', view);
    check(view.back === canReturn && view.focused === 'reload' && view.dialog === 'alertdialog', 'ações seguras e foco nativo acessível no diálogo', view);
  };
  const expectedWarning = (marker) => {
    const found = diagnostics.filter((m) => m.type === 'warning' && m.text.includes('[game] falha no carregamento da fase') && m.text.includes(marker));
    check(found.length === 1, `falha confirmada pelo marcador ${marker}`, found);
  };

  // 1. O import inicial rejeita, antes de existir puzzle. A resposta JS é válida,
  // mas lança o marcador: nenhuma falha de rede pode produzir um falso positivo.
  await page.route(`${base}${firstWorld}`, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: 'throw new Error("EST03_INITIAL");' }));
  await page.goto(`${base}?play`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__game);
  await errorScreen(false);
  expectedWarning('EST03_INITIAL');
  check(H.errors.length === 0, 'rejeição inicial tratada sem pageerror/console.error', H.errors);
  await page.screenshot({ path: 'shots/load-recovery/initial-error.png' });
  await page.unroute(`${base}${firstWorld}`);
  await page.keyboard.press('Enter');
  await ready();
  check(await page.evaluate(() => window.__game.game.levelDef.id === 'fase1'), 'Enter recarrega e monta a fase inicial');

  // 2. UI descarta a Promise de seleção; ainda assim a rejeição é observada já
  // durante o fade. Voltar por Tab/Enter preserva puzzle, item e relógio.
  await page.evaluate(() => {
    const { game, levels, events } = window.__game;
    window.__beforeFailure = { built: game.built, puzzle: game.puzzle, time: game.debug.info().timeSec, load: levels[1].load };
    levels[1].load = () => Promise.reject(new Error('EST03_BEFORE_DISPOSE'));
    events.emit('ui:selectLevel', { index: 1 });
  });
  await errorScreen(true);
  expectedWarning('EST03_BEFORE_DISPOSE');
  await page.waitForTimeout(500);
  check(await page.evaluate(() => window.__game.game.debug.info().timeSec === window.__beforeFailure.time), 'erro anterior ao descarte congela o relógio');
  await page.keyboard.press('Tab');
  check(await page.evaluate(() => document.activeElement?.getAttribute('data-action') === 'cancel-load'), 'Tab alcança Voltar sem sair do diálogo');
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => {
    const { game, levels } = window.__game;
    levels[1].load = window.__beforeFailure.load;
    return game.state === 'playing' && game.built === window.__beforeFailure.built && game.puzzle === window.__beforeFailure.puzzle && game.levelDef.id === 'fase1';
  }), 'Voltar retoma os mesmos objetos da fase anterior');

  // 3. O build lança após descarte. Os efeitos e o render não podem tocar a
  // fase parcial; a única ação oferecida é recarregar a página.
  await page.evaluate(() => {
    const { game, levels, engine, feedback, particles, events } = window.__game;
    levels[1].load = async () => ({ build() { throw new Error('EST03_PARTIAL_BUILD'); } });
    events.once('level:error', () => {
      window.__partialUses = 0;
      for (const [object, method] of [[engine, 'render'], [feedback, 'update'], [particles, 'update']]) object[method] = () => { window.__partialUses++; };
    });
    void game.loadLevel(1);
  });
  await errorScreen(false);
  expectedWarning('EST03_PARTIAL_BUILD');
  await page.waitForTimeout(500);
  check(await page.evaluate(() => window.__partialUses === 0), 'nenhum efeito/render usa objetos após montagem parcial');
  await page.screenshot({ path: 'shots/load-recovery/partial-error.png' });
  await page.locator('[data-action="reload"]').click();
  await ready();

  // 4. Publicação substitui os chunks enquanto a aba A segue aberta. Prova que
  // a URL específica da fase 2 foi removida; só esses 404 podem ser consumidos.
  const saved = await page.evaluate((key) => {
    const total = window.__game.levels[0].layout.COLLECTIBLES.length;
    const value = JSON.stringify({ v: 1, levels: { fase1: { done: true, best: 90, treats: 2, total, clears: 1 } } });
    localStorage.setItem(key, value);
    return value;
  }, PROGRESS_KEY);
  const diagnosticStart = diagnostics.length;
  const responseStart = responses.length;
  serving = versionB;
  check(await page.evaluate(() => window.__game.game.loadLevel(1)) === false, 'import da aba antiga termina em falha recuperável');
  await errorScreen(true);
  const expectedMissing = new Set(Object.values(manifest).map((entry) => `${base}${entry.file}`).filter((url) => url.endsWith('.js')));
  const staleResponses = responses.slice(responseStart);
  check(staleResponses.some((r) => r.url === `${base}${secondWorld}` && r.status === 404) && missing.includes(`${MOUNT}${secondWorld}`), 'erro veio do chunk antigo da fase 2 realmente removido', staleResponses);
  check(staleResponses.length > 0 && staleResponses.every((r) => r.status === 404 && expectedMissing.has(r.url)), 'somente chunks da versão A ficaram ausentes', staleResponses);
  const networkErrors = diagnostics.slice(diagnosticStart).filter((m) => m.type === 'error');
  assert.ok(networkErrors.length > 0, 'Chromium registrou o 404 esperado');
  for (const message of networkErrors) {
    assert.ok(expectedMissing.has(message.url) && staleResponses.some((r) => r.url === message.url && r.status === 404) && /^Failed to load resource: the server responded with a status of 404 \(/.test(message.text), `console inesperado: ${JSON.stringify(message)}`);
    const index = H.errors.indexOf(`[console.error] ${message.text}`);
    assert.ok(index >= 0, 'diagnóstico esperado também foi coletado pelo harness');
    H.errors.splice(index, 1); // Apenas a ocorrência com URL/status comprovados neste cenário.
  }
  check(H.errors.length === 0, 'aba antiga não gerou rejeições ou erros além dos 404 identificados', H.errors);
  const scriptStart = scripts.length;
  const missingCount = missing.length;
  await page.locator('[data-action="reload"]').click();
  await ready();
  check(await page.evaluate(() => window.__game.game.loadLevel(1, { mode: 'play' })), 'nova página carrega a fase 2 da versão B');
  await ready();
  check(scripts.slice(scriptStart).some((url) => url === `${base}${secondWorld.replace(/\.js$/, '.next.js')}`) && scripts.slice(scriptStart).every((url) => url.endsWith('.next.js')), 'recarga usa entrada e imports com os nomes novos', scripts.slice(scriptStart));
  check(missing.length === missingCount, 'recarga não busca arquivos removidos');
  check(await page.evaluate(({ key, value }) => localStorage.getItem(key) === value && window.__game.ui.progress.levels.fase1.best === 90, { key: PROGRESS_KEY, value: saved }), 'recarga preserva e lê o progresso salvo');

  // 5. Falha antes de engine/UI/__game existirem. O botão nativo continua
  // operável por teclado e sua recarga não depende de nenhum gancho do jogo.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('est03-boot-failed')) return;
    const get = document.getElementById.bind(document);
    document.getElementById = (id) => {
      if (id === 'app') { sessionStorage.setItem('est03-boot-failed', '1'); throw new Error('EST03_BOOT'); }
      return get(id);
    };
  });
  const bootStart = diagnostics.length;
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.rr-boot-reload', { state: 'visible' });
  check(await page.evaluate(() => !window.__game && document.activeElement?.className === 'rr-boot-reload'), 'fallback inicial tem foco e funciona sem __game');
  const bootErrors = diagnostics.slice(bootStart).filter((m) => m.type === 'error');
  assert.equal(bootErrors.length, 1, 'somente o erro de boot injetado foi registrado');
  assert.match(bootErrors[0].text, /^Error: EST03_BOOT(?:\n|$)/);
  const bootIndex = H.errors.indexOf(`[console.error] ${bootErrors[0].text}`);
  assert.ok(bootIndex >= 0);
  H.errors.splice(bootIndex, 1);
  await page.screenshot({ path: 'shots/load-recovery/boot-error.png' });
  await page.keyboard.press('Enter');
  await ready();
  check(await page.evaluate(() => window.__game.game.state === 'playing'), 'fallback recarrega o jogo por teclado');
  check(H.errors.length === 0, 'nenhum erro de console/pageerror fora das injeções identificadas', H.errors);
} catch (error) {
  console.error(`[recuperacao] ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  try {
    if (H && await H.close()) process.exitCode = 1;
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
    await rm(temporary, { recursive: true, force: true });
  }
  if (timedOut) process.exitCode = 1;
}
