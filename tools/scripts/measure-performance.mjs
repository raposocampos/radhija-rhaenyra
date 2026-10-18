// EST-08: render normal, cinco fases publicadas, nenhuma bateria local automática.
// Cada job mede uma fase isolada; A/B sequenciais usam o mesmo runner/build.
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { cpus, platform, release, arch, totalmem } from 'node:os';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { installPerformanceProbe } from './lib/performance-probe.mjs';
import { validateWindow, summarizeWindow } from './lib/performance-report.mjs';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const REFERENCE = process.env.PERFORMANCE_REFERENCE || 'a';
if (!/^[ab]$/.test(REFERENCE)) throw new Error('PERFORMANCE_REFERENCE must be a or b');
const LEVEL = process.env.PERFORMANCE_LEVEL;
if (!/^fase[1-5]$/.test(LEVEL || '')) throw new Error('PERFORMANCE_LEVEL must be fase1..fase5');
const INDEX = Number(LEVEL.slice(4)) - 1;
const OUT = fileURLToPath(new URL(`../../shots/performance/${LEVEL}/${REFERENCE}/`, import.meta.url));
const MOUNT = '/previews/pr-performance/1-1/';
const VIEWPORT = { width: 1280, height: 720 };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const report = {
  startedAtUtc: new Date().toISOString(),
  schema: 2, selectedLevel: LEVEL, reference: REFERENCE, commit: process.env.MEASURE_SHA || process.env.GITHUB_SHA || null,
  run: process.env.GITHUB_RUN_ID || null, attempt: process.env.GITHUB_RUN_ATTEMPT || null,
  environment: { node: process.version, os: platform(), release: release(), arch: arch(),
    cpu: cpus()[0]?.model, logicalCpus: cpus().length, systemMemoryBytes: totalmem(),
    runner: process.env.RUNNER_NAME || null, runnerImage: process.env.ImageOS || null, runnerImageVersion: process.env.ImageVersion || null },
  conditions: { protocol: 'isolated-level-v2', viewport: VIEWPORT, deviceScaleFactor: 1, warmupCycles: 1, measuredCycles: 3,
    minimumFrames: 20, minimumDurationMs: 8000, postGcWarmupFrames: 4, postGcWarmupMs: 1000,
    scope: 'boot directly into selected published level; one warmup reload then three measured reloads of that level; no visits to other levels',
    state: 'playing', inputs: 'none; idle puzzle and companion update normally', camera: 'bounds-based fixed overview per phase',
    quality: 'normal engine; shadows 2048, bloom and all four compositor passes; no gl.finish',
    cadence: 'rAF timestamps of callbacks that executed game.update and engine.render; not capped game dt',
    frameCpu: 'game.update entry through engine.render return; includes UI/effects and probe overhead, not GPU completion',
    renderCpu: 'synchronous engine.render call; not GPU time',
    load: 'level:loading to level:loaded; includes procedural build and engine preparation, not isolated module/build/compile timings',
    uiReleasedRender: 'first synchronous render return after boot overlay removed and transition curtain fully gone; submission proxy, not GPU presentation',
    heap: 'CDP collectGarbage + Runtime.getHeapUsage between load and temporal warmup; JS heap, not VRAM/process memory',
    limitations: 'headless Chromium on SwiftShader is a CI reference, not physical GPU/mobile performance or a complete gameplay workload',
  },
  initialLoad: null, samples: [], negativeProof: null, errors: [], warnings: [], failures: [],
};
const save = () => writeFile(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = (ok, message) => { if (!ok) report.failures.push(message); };
async function step(stage, action, { cycle = null, timeoutMs = 180000 } = {}) {
  report.pendingStage = { stage, cycle, level: LEVEL, startedAtUtc: new Date().toISOString(), timeoutMs };
  console.log(`[performance ${LEVEL}/${REFERENCE}] ${stage}${cycle === null ? '' : ` cycle=${cycle}`}`);
  await save();
  let timer;
  try {
    return await Promise.race([action(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${LEVEL}/${REFERENCE} cycle=${cycle} stage=${stage} exceeded ${timeoutMs}ms`)), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(MOUNT)) { response.writeHead(404).end(); return; }
    const file = resolve(DIST, pathname.slice(MOUNT.length) || 'index.html');
    if (!file.startsWith(resolve(DIST) + sep)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(); }
});
async function hashBuild() {
  const hash = createHash('sha256');
  const files = (await readdir(DIST, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile()).map((entry) => relative(DIST, resolve(entry.parentPath, entry.name))).sort();
  for (const path of files) {
    hash.update(path.replaceAll('\\', '/')).update('\0').update(await readFile(resolve(DIST, path))).update('\0');
  }
  return hash.digest('hex');
}
let browser;
const watchdog = setTimeout(() => {
  report.errors.push('measurement exceeded 25 minutes');
  void browser?.close(); server.closeAllConnections();
}, 25 * 60 * 1000);
watchdog.unref();
try {
  await mkdir(OUT, { recursive: true });
  report.buildHash = await hashBuild();
  if (!report.commit) throw new Error('missing commit identity');
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const base = `http://127.0.0.1:${server.address().port}${MOUNT}`;
  const options = browserOptions(); report.conditions.browserArguments = options.args;
  browser = await chromium.launch(options); report.environment.browser = browser.version();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180000);
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(`console.error: ${message.text()}`);
    if (message.type() === 'warning') report.warnings.push(message.text());
  });
  page.on('pageerror', (error) => report.errors.push(`pageerror: ${error.message}`));
  page.on('crash', () => report.errors.push('page crashed'));
  page.on('requestfailed', (request) => report.errors.push(`request failed: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (response.status() >= 400) report.errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on('request', (request) => { if (request.url().startsWith('http') && !request.url().startsWith(base)) report.errors.push(`outside build mount: ${request.url()}`); });
  await page.addInitScript(installPerformanceProbe);
  await step('boot', () => page.goto(`${base}?level=${INDEX + 1}&play`, { waitUntil: 'load', timeout: 180000 }));
  const waitVisible = () => page.waitForFunction(() => window.__performanceMeasurement?.loads.at(-1).firstUiReleasedRenderAt !== null && window.__game?.game.state === 'playing');
  await step('boot-ui-released', waitVisible);
  await page.evaluate(() => document.fonts.ready);
  report.initialLoad = await page.evaluate(() => ({ ...window.__performanceMeasurement.loads[0],
    navigationToFirstRenderSubmissionMs: window.__performanceMeasurement.loads[0].firstRenderSubmittedAt,
    navigationToFirstUiReleasedRenderMs: window.__performanceMeasurement.loads[0].firstUiReleasedRenderAt }));
  const levels = await page.evaluate(() => window.__game.levels.map((level) => level.id));
  report.catalog = levels; report.levels = [LEVEL];
  if (levels.join(',') !== 'fase1,fase2,fase3,fase4,fase5') throw new Error('this reference protocol requires exactly the five published phases');
  if (report.initialLoad.level !== LEVEL) throw new Error(`boot selected ${report.initialLoad.level}, expected ${LEVEL}`);
  const cdp = await page.context().newCDPSession(page);
  const warmup = async () => {
    const start = await page.evaluate(() => ({ frames: window.__performanceMeasurement.framesDrawn, at: performance.now() }));
    await page.waitForFunction(({ frames, at }) => window.__performanceMeasurement.framesDrawn >= frames + 4 && performance.now() >= at + 1000, start);
  };
  for (let cycle = 0; cycle <= report.conditions.measuredCycles; cycle++) {
    const load = await step('reload', () => page.evaluate(async (index) => {
      const m = window.__performanceMeasurement, before = m.loads.at(-1);
      const startedAt = performance.now();
      if (await window.__game.game.loadLevel(index, { mode: 'play' }) !== true) throw new Error(`load failed: ${index}`);
      const current = m.loads.at(-1);
      if (current.generation <= before.generation || current.root === before.root) throw new Error('load did not create a new generation/root');
      current.promiseMs = performance.now() - startedAt;
      return current.generation;
    }, INDEX), { cycle });
    await step('ui-released', waitVisible, { cycle });
    await step('warmup-before-heap', warmup, { cycle });
    // GC e coleta de heap nunca concorrem com a janela temporal.
    const heap = await step('heap', async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      return cdp.send('Runtime.getHeapUsage');
    }, { cycle });
    await step('warmup-after-heap', warmup, { cycle });
    const sample = await step('temporal-window', () => page.evaluate(async ({ cycle, generation, minimumFrames, minimumDurationMs }) => {
      const m = window.__performanceMeasurement;
      const value = await m.collect({ minimumFrames, minimumDurationMs });
      if (value.generation !== generation) throw new Error('load changed before sampling');
      return { ...value, cycle, measured: cycle > 0, load: { ...m.loads.at(-1) } };
    }, { cycle, generation: load, minimumFrames: cycle === 0 ? 4 : report.conditions.minimumFrames, minimumDurationMs: cycle === 0 ? 1000 : report.conditions.minimumDurationMs }), { cycle, timeoutMs: 300000 });
    sample.heap = heap;
    sample.summary = summarizeWindow(sample);
    sample.validation = validateWindow(sample);
    report.failures.push(...sample.validation.map((message) => `cycle ${cycle} ${sample.level}: ${message}`));
    check(sample.level === LEVEL, `cycle ${cycle}: wrong level`);
    check(sample.load.firstRenderSubmittedAt >= sample.load.loadedAt && sample.load.firstUiReleasedRenderAt >= sample.load.firstRenderSubmittedAt, `${sample.level}: invalid render submission/UI ordering`);
    check(heap.usedSize > 0 && heap.totalSize >= heap.usedSize, `${sample.level}: invalid JS heap sample`);
    report.samples.push(sample);
    console.log(`[performance ${LEVEL}/${REFERENCE}] cycle=${cycle} frames=${sample.frames.length} cadenceP95=${sample.summary.cadenceMs.p95.toFixed(1)}ms load=${(sample.load.loadedAt - sample.load.startedAt).toFixed(1)}ms heap=${heap.usedSize}`);
    await save();
  }
  // Prova negativa real: um render vazio parece rápido, mas DEVE ser recusado.
  // Injeção termina antes do fechamento e não entra nas referências/estatísticas.
  const negative = await step('negative-proof', () => page.evaluate(async () => {
    const m = window.__performanceMeasurement; m.skipDraw = true;
    try { return await m.collect({ minimumFrames: 4, minimumDurationMs: 100 }); }
    finally { m.skipDraw = false; }
  }));
  const rejectedBy = validateWindow(negative);
  report.negativeProof = { kind: 'skip engine.render in instrumented page only', sample: negative, rejectedBy };
  check(rejectedBy.length === 1 && rejectedBy[0] === 'draw: scene was not rendered', `negative proof failed or had unrelated errors: ${rejectedBy.join('; ')}`);
  check(report.samples.length === 4, `incomplete isolated protocol for ${LEVEL}`);
  report.pendingStage = null;
} catch (error) { report.errors.push(error.stack || String(error)); }
finally {
  clearTimeout(watchdog);
  try { await browser?.close(); } catch (error) { report.errors.push(String(error)); }
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  report.passed = report.errors.length === 0 && report.failures.length === 0 && report.samples.length === 4 && !!report.negativeProof;
  report.endedAtUtc = new Date().toISOString();
  await save();
  console.log(JSON.stringify({ reference: REFERENCE, passed: report.passed, samples: report.samples.length, errors: report.errors, warnings: report.warnings, failures: report.failures }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
