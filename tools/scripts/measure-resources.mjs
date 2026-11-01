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
const DEV_LEVEL = process.env.MEASURE_DEV_LEVEL || '';
// MEASURE_STORY=1: só a fase 10 (o teto) e a área do Modo História (job próprio no E2E manual: recursos-historia)
const STORY_MODE = process.env.MEASURE_STORY === '1';
if (DEV_LEVEL && !/^[a-z][a-z0-9_-]*$/i.test(DEV_LEVEL)) throw new Error('MEASURE_DEV_LEVEL inválido');
const WARMUP = 2;
const MEASURED = 3;
const VIEWPORT = { width: 1280, height: 720 };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const report = {
  commit: process.env.GITHUB_SHA || null, run: process.env.GITHUB_RUN_ID || null,
  attempt: process.env.GITHUB_RUN_ATTEMPT || null, node: process.version,
  conditions: {
    devLevel: DEV_LEVEL || null,
    viewport: VIEWPORT, deviceScaleFactor: 1, warmupCycles: WARMUP, measuredCycles: MEASURED,
    mode: 'title', debug: true, scent: 'render one cloud and preview, expire cloud, render again before leaving phase',
    simulation: '60 fixed steps of 1/60 s, then two full renders; automatic updates/render paused in test page',
    camera: 'same bounds-based overview per phase', quality: 'normal engine shadows and postprocessing',
    screenshots: 'scenario canvas with UI/loading hidden only during capture; not a UI visual test',
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
  await page.goto(`${base}?debug${DEV_LEVEL ? `&level=${encodeURIComponent(DEV_LEVEL)}` : ''}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__resourceMeasurement && window.__game.game.state === 'title', null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  // As capturas do cenário ocultam overlays só durante screenshot (abaixo).
  const allLevels = await page.evaluate(() => window.__game.levels.map((level) => level.id));
  const levels = STORY_MODE ? allLevels.filter((id) => id === 'fase10') : allLevels;
  report.levels = levels;
  if (!levels.length) throw new Error('empty level catalog');
  if (DEV_LEVEL && !levels.includes(DEV_LEVEL)) throw new Error(`missing development level: ${DEV_LEVEL}`);
  for (let cycle = 1; cycle <= WARMUP + MEASURED; cycle++) {
    for (let index = 0; index < levels.length; index++) {
      const catalogIndex = allLevels.indexOf(levels[index]);
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
      }, { index: catalogIndex, cycle, warmup: WARMUP });
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
      if (cycle === WARMUP + MEASURED) await page.locator('canvas').first().screenshot({
        path: resolve(OUT, `${sample.level}.png`), timeout: 60000,
        // visibility é sobrescrita pelos filhos ativos da UI; display remove
        // todo o overlay só nesta captura, sem tocar no canvas ou no render.
        style: '#ui, #loading { display: none !important; }',
      });
      if (cycle === WARMUP + MEASURED && sample.level === DEV_LEVEL) {
        // Imagem adicional para revisão artística. A amostra acima continua
        // incluindo debug; só ocultamos suas linhas após terminar a medição.
        const debugVisible = await page.evaluate(() => {
          const { engine } = window.__game;
          const debug = engine.scene.getObjectByName('debug-draw');
          const previous = debug.visible;
          debug.visible = false;
          window.__resourceMeasurement.originals.render(1 / 60, 1);
          engine.renderer.getContext().finish();
          return previous;
        });
        try {
          await page.locator('canvas').first().screenshot({
            path: resolve(OUT, `${sample.level}-cenario.png`), timeout: 60000,
            style: '#ui, #loading { display: none !important; }',
          });
        } finally {
          await page.evaluate((previous) => {
            const { engine } = window.__game;
            engine.scene.getObjectByName('debug-draw').visible = previous;
            window.__resourceMeasurement.originals.render(1 / 60, 1);
            engine.renderer.getContext().finish();
          }, debugVisible);
        }
      }
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
  if (STORY_MODE) await measureStory(page, base);
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

/**
 * Modo História (docs/MODO-HISTORIA.md): a área do capítulo 1 (o Recanto) entra pela entrada das prévias
 * (?historia). Mede com a mesma câmera de visão geral e a mesma qualidade das fases, alternando a área com a fase 1
 * na mesma aba (os recursos voltam ao mesmo platô a cada visita: o descarte da área não vaza) e confere o teto da
 * fase 10 (chamadas de desenho e triângulos). Também o pior quadro da câmera do jogo pelos nós de navegação.
 */
async function measureStory(page, base) {
  await page.goto(`${base}?debug&historia&stage=cozinha`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__resourceMeasurement && window.__game.game.isStory && window.__game.game.state === 'playing', null, { timeout: 120000 });
  const samples = [];
  for (let cycle = 1; cycle <= WARMUP + MEASURED; cycle++) {
    const sample = await page.evaluate(async ({ cycle, warmup, last }) => {
      const { engine, game, THREE } = window.__game;
      const measurement = window.__resourceMeasurement;
      // uma fase de verdade no meio: a área sai e volta (o descarte precisa liberar tudo)
      if (cycle > 1) {
        if (await game.loadLevel(0, { mode: 'title' }) !== true) throw new Error('load failed: fase 1');
        if (await game.loadLevel(-2, { mode: 'play' }) !== true) throw new Error('load failed: historia');
      }
      game.debug.setStage('cozinha');
      for (let step = 1; step <= 60; step++) {
        measurement.originals.game(1 / 60, step / 60);
        measurement.originals.feedback(1 / 60, step / 60);
        measurement.originals.particles(1 / 60);
      }
      const b = game.levelDef.layout.WORLD.bounds;
      const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      engine.camera.position.set(cx + span * 0.65, span * 0.8, cz + span * 1.1);
      engine.camera.lookAt(cx, 0, cz);
      engine.camera.updateMatrixWorld();
      const { renderer, scene } = engine;
      renderer.info.autoReset = false;
      const draws = [];
      for (let frame = 0; frame < 2; frame++) {
        renderer.info.reset();
        measurement.originals.render(1 / 60, 1);
        renderer.getContext().finish();
        draws.push({ ...renderer.info.render });
      }
      // o pior quadro da câmera do jogo andando pelos nós de navegação (a área toda passa pela tela)
      let worst = { calls: 0, triangles: 0, at: null };
      const L = game.levelDef.layout;
      const off = L.CAMERA.offset;
      for (const [id, p] of last ? Object.entries(L.NAV_NODES) : []) {
        engine.camera.position.set(p.x + off[0], off[1], p.z + off[2]);
        engine.camera.lookAt(p.x, 0.3, p.z);
        engine.camera.updateMatrixWorld();
        renderer.info.reset();
        measurement.originals.render(1 / 60, 1);
        renderer.getContext().finish();
        const r = renderer.info.render;
        if (r.calls > worst.calls) worst = { calls: r.calls, triangles: r.triangles, at: id };
      }
      let objects = 0;
      scene.traverse(() => objects++);
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      return {
        cycle, measured: cycle > warmup, level: game.levelDef.id, state: game.state, story: game.isStory,
        geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        programs: renderer.info.programs.length, draws, worst, objects, rootCount: scene.children.length,
        phaseRoots: scene.children.filter((o) => o.name.startsWith('fase:')).map((o) => o.name),
        quality: { pixelRatio: renderer.getPixelRatio(), buffer: [size.x, size.y], shadows: renderer.shadowMap.enabled, bloom: engine.bloom.enabled },
      };
    }, { cycle, warmup: WARMUP, last: cycle === WARMUP + MEASURED });
    samples.push(sample);
    report.samples.push({ ...sample, kind: 'historia' });
    const label = `historia cycle ${cycle}`;
    check(sample.story && sample.level === 'recanto' && sample.state === 'playing', `${label}: wrong area/state`);
    check(sample.phaseRoots.length === 1 && sample.phaseRoots[0] === 'fase:recanto', `${label}: wrong roots ${sample.phaseRoots}`);
    check(sample.quality.pixelRatio === 1 && sample.quality.shadows && sample.quality.bloom, `${label}: reduced rendering quality`);
    check(sample.draws.every((d) => d.calls > 20 && d.triangles > 1000), `${label}: area was not actually rendered`);
    console.log(`[resources] ${label}: geometry=${sample.geometries} texture=${sample.textures} programs=${sample.programs} calls=${sample.draws[1].calls} triangles=${sample.draws[1].triangles} worst=${sample.worst.calls}@${sample.worst.at}`);
    await save();
    if (cycle === WARMUP + MEASURED) {
      // captura de revisão (a tela inteira: o canvas ocupa tudo); não reprova a medição se demorar
      try {
        await page.screenshot({ path: resolve(OUT, 'historia-recanto.png'), timeout: 60000, style: '#ui, #loading { display: none !important; }' });
      } catch (error) {
        report.warnings.push(`historia: captura não saiu (${String(error.message || error).split(/\r?\n/)[0]})`);
      }
    }
  }
  const measured = samples.filter((s) => s.measured);
  for (const metric of ['geometries', 'textures', 'programs', 'objects', 'rootCount']) {
    const values = measured.map((s) => s[metric]);
    const stable = values.length === MEASURED && values.every((v) => v === values[0]);
    report.comparisons.push({ level: 'historia:recanto', metric, values, stable });
    check(stable, `historia ${metric} did not plateau: ${values.join(' -> ')}`);
  }
  // o teto da fase 10, na mesma câmera de visão geral
  const ref = report.samples.filter((s) => s.measured && s.level === 'fase10' && !s.kind).at(-1);
  const area = measured.at(-1);
  if (ref && area) {
    const ceiling = { calls: ref.draws[1].calls, triangles: ref.draws[1].triangles };
    report.story = { area: { calls: area.draws[1].calls, triangles: area.draws[1].triangles, worst: area.worst }, ceiling };
    console.log(`[resources] historia vs fase10: calls ${area.draws[1].calls}/${ceiling.calls} triangles ${area.draws[1].triangles}/${ceiling.triangles}`);
    check(area.draws[1].calls <= ceiling.calls, `historia: ${area.draws[1].calls} draw calls above the fase10 ceiling (${ceiling.calls})`);
    check(area.draws[1].triangles <= ceiling.triangles, `historia: ${area.draws[1].triangles} triangles above the fase10 ceiling (${ceiling.triangles})`);
  } else {
    report.warnings.push('historia: no fase10 sample to compare with');
  }
}
