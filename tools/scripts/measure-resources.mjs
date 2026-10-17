// EST-05: contagens do Three.js após trocas de fase na MESMA aba/contexto WebGL.
// Executar depois do build no E2E manual; não mede bytes, VRAM, FPS nem heap/GC.
// Não usa createHarness: ele reduz a qualidade gráfica nos runners de partidas.
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const OUT = fileURLToPath(new URL('../../shots/resources/', import.meta.url));
const MOUNT = '/previews/pr-resources/1-1/';
const WARMUP = 2;
const MEASURED = 3;
const VIEWPORT = { width: 1280, height: 720 };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const report = {
  commit: process.env.GITHUB_SHA || null, run: process.env.GITHUB_RUN_ID || null,
  attempt: process.env.GITHUB_RUN_ATTEMPT || null, node: process.version,
  conditions: {
    viewport: VIEWPORT, deviceScaleFactor: 1, warmupCycles: WARMUP, measuredCycles: MEASURED,
    mode: 'title', debug: true, scent: 'render one cloud and preview, expire cloud, render again before leaving phase',
    simulation: '60 fixed steps of 1/60 s, then two full renders; automatic updates/render paused in test page',
    camera: 'same bounds-based overview per phase', quality: 'normal engine shadows and postprocessing',
    criterion: 'each count must plateau exactly for the same phase across all three measured visits; no zero baseline',
    limits: 'counts of geometries/textures/programs, not GPU bytes, FPS, JavaScript heap, buffer attributes or exhaustive gameplay coverage',
  },
  samples: [], comparisons: [], errors: [], warnings: [], failures: [],
};
const save = () => writeFile(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = (ok, message) => { if (!ok) report.failures.push(message); };
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

let browser;
const watchdog = setTimeout(() => {
  report.errors.push('measurement exceeded 20 minutes');
  void browser?.close();
  server.closeAllConnections();
}, 20 * 60 * 1000);
watchdog.unref();
try {
  await mkdir(OUT, { recursive: true });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const base = `http://127.0.0.1:${server.address().port}${MOUNT}`;
  const options = browserOptions();
  report.conditions.browserArguments = options.args;
  browser = await chromium.launch(options);
  report.browser = browser.version();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(`console.error: ${message.text()}`);
    if (message.type() === 'warning') report.warnings.push(message.text());
  });
  page.on('pageerror', (error) => report.errors.push(`pageerror: ${error.message}`));
  page.on('crash', () => report.errors.push('page crashed'));
  page.on('requestfailed', (request) => report.errors.push(`request failed: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (response.status() >= 400) report.errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on('request', (request) => { if (request.url().startsWith('http') && !request.url().startsWith(base)) report.errors.push(`outside build mount: ${request.url()}`); });
  await page.addInitScript(() => {
    // rAF continua livre para o carregador/UI. Somente esta página de medição
    // controla o avanço da simulação e chama o render original, sem reduzir DPR,
    // sombra, bloom, geometrias ou passes. Não é um benchmark de cadência/FPS.
    let api;
    Object.defineProperty(window, '__game', {
      configurable: true, get: () => api,
      set(value) {
        api = value;
        const originals = {};
        for (const [key, owner, method] of [
          ['render', value.engine, 'render'], ['game', value.game, 'update'],
          ['feedback', value.feedback, 'update'], ['particles', value.particles, 'update'],
        ]) {
          originals[key] = owner[method].bind(owner);
          owner[method] = () => {};
        }
        window.__resourceMeasurement = {
          originals,
          globals: value.engine.scene.children.filter((o) => !o.name.startsWith('fase:') && o.name !== 'debug-draw'),
          dogs: Object.fromEntries(Object.entries(value.dogs).map(([name, dog]) => [name, dog.object])),
          disposedGlobals: [],
        };
        const observed = new Set();
        for (const root of window.__resourceMeasurement.globals) root.traverse((object) => {
          for (const resource of [object.geometry, ...[].concat(object.material || [])]) {
            if (!resource || observed.has(resource)) continue;
            observed.add(resource);
            resource.addEventListener('dispose', () => window.__resourceMeasurement.disposedGlobals.push({ uuid: resource.uuid, type: resource.type }));
          }
        });
      },
    });
  });
  await page.goto(`${base}?debug`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__resourceMeasurement && window.__game.game.state === 'title', null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  // Captura só o canvas; overlays de UI não participam da medição gráfica.
  const levels = await page.evaluate(() => window.__game.levels.map((level) => level.id));
  report.levels = levels;
  if (!levels.length) throw new Error('empty level catalog');
  for (let cycle = 1; cycle <= WARMUP + MEASURED; cycle++) {
    for (let index = 0; index < levels.length; index++) {
      const sample = await page.evaluate(async ({ index, cycle, warmup }) => {
        const { engine, game, dogs, THREE } = window.__game;
        const measurement = window.__resourceMeasurement;
        if (await game.loadLevel(index, { mode: 'title' }) !== true) throw new Error(`load failed: ${index}`);
        for (let step = 1; step <= 60; step++) {
          measurement.originals.game(1 / 60, step / 60);
          measurement.originals.feedback(1 / 60, step / 60);
          measurement.originals.particles(1 / 60);
        }
        const ctrl = game.debug.ctrls.radhija;
        const shot = { x: ctrl.x, z: ctrl.z, dirX: 0, dirZ: 1, speed: 2.6, life: 5 };
        game.debug.scent.spawn(shot);
        game.debug.scent.update(0.25);
        game.debug.scent.showPreview(game.debug.scent.preview(shot));
        const b = game.levelDef.layout.WORLD.bounds;
        const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
        const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
        engine.camera.position.set(cx + span * 0.65, span * 0.8, cz + span * 1.1);
        engine.camera.lookAt(cx, 0, cz);
        engine.camera.updateMatrixWorld();
        const { renderer, scene } = engine;
        renderer.info.autoReset = false; // agrega também os passes do compositor
        const draws = [];
        for (let frame = 0; frame < 2; frame++) {
          // A primeira imagem aloca a esfera na GPU; ao expirar, sua malha sai
          // da árvore. A próxima troca precisa liberar também esse recurso.
          if (frame === 1) game.debug.scent.update(6);
          renderer.info.reset();
          measurement.originals.render(1 / 60, 1);
          renderer.getContext().finish(); // amostra após comandos de desenho reais
          draws.push({ ...renderer.info.render });
        }
        const size = renderer.getDrawingBufferSize(new THREE.Vector2());
        const phaseRoots = scene.children.filter((o) => o.name.startsWith('fase:'));
        const debugRoots = scene.children.filter((o) => o.name === 'debug-draw');
        let objects = 0;
        scene.traverse(() => objects++);
        const gl = renderer.getContext();
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          cycle, measured: cycle > warmup, level: game.levelDef.id, state: game.state,
          geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
          programs: renderer.info.programs.length, draws, objects,
          phaseRoots: phaseRoots.map((o) => o.name), debugRoots: debugRoots.length,
          globalsPresent: measurement.globals.every((o) => o.parent === scene),
          dogsPresent: Object.entries(measurement.dogs).every(([name, o]) => dogs[name].object === o && o.parent === scene),
          globals: measurement.globals.map((o) => ({ uuid: o.uuid, name: o.name, type: o.type })),
          dogs: Object.fromEntries(Object.entries(dogs).map(([name, dog]) => [name, dog.object.uuid])),
          disposedGlobals: [...measurement.disposedGlobals],
          rootCount: scene.children.length,
          quality: { pixelRatio: renderer.getPixelRatio(), buffer: [size.x, size.y],
            shadows: renderer.shadowMap.enabled, shadowSize: engine.sun.shadow.mapSize.toArray(),
            bloom: engine.bloom.enabled, passes: engine.composer.passes.map((p) => p.enabled),
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) },
          camera: { position: engine.camera.position.toArray(), fov: engine.camera.fov },
        };
      }, { index, cycle, warmup: WARMUP });
      report.samples.push(sample);
      const label = `cycle ${cycle} ${levels[index]}`;
      check(sample.level === levels[index] && sample.state === 'title', `${label}: wrong level/state`);
      check(sample.phaseRoots.length === 1 && sample.phaseRoots[0] === `fase:${sample.level}` && sample.debugRoots === 1, `${label}: wrong phase/debug roots`);
      check(sample.globalsPresent && sample.dogsPresent, `${label}: missing/replaced global object or dog`);
      check(sample.disposedGlobals.length === 0, `${label}: disposed geometry/material still owned by global objects`);
      check(sample.quality.pixelRatio === 1 && sample.quality.buffer.join('x') === '1280x720' && sample.quality.shadows && sample.quality.bloom && sample.quality.passes.every(Boolean), `${label}: reduced rendering quality`);
      check(sample.draws.every((d) => d.calls > 20 && d.triangles > 1000), `${label}: scene was not actually rendered`);
      console.log(`[resources] ${label}: geometry=${sample.geometries} texture=${sample.textures} programs=${sample.programs} roots=${sample.rootCount} calls=${sample.draws[1].calls}`);
      await save();
      if (cycle === WARMUP + MEASURED) await page.locator('canvas').first().screenshot({ path: resolve(OUT, `${sample.level}.png`), timeout: 60000 });
    }
  }
  for (const level of levels) {
    const samples = report.samples.filter((sample) => sample.measured && sample.level === level);
    for (const metric of ['geometries', 'textures', 'programs', 'objects', 'rootCount']) {
      const values = samples.map((sample) => sample[metric]);
      const stable = values.length === MEASURED && values.every((value) => value === values[0]);
      report.comparisons.push({ level, metric, values, stable });
      check(stable, `${level} ${metric} did not plateau: ${values.join(' -> ')}`);
    }
  }
} catch (error) {
  report.errors.push(error.stack || String(error));
} finally {
  clearTimeout(watchdog);
  try { await browser?.close(); } catch (error) { report.errors.push(String(error)); }
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  report.passed = report.errors.length === 0 && report.failures.length === 0 && report.comparisons.length > 0;
  await save();
  console.log(JSON.stringify({ passed: report.passed, samples: report.samples.length, comparisons: report.comparisons, errors: report.errors, failures: report.failures }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
