// Primeira passagem pelas áreas de cada fase: o que a GPU ainda prepara depois da carga e quanto isso custa.
// Para cada fase e qualidade, um navegador novo (sem programas guardados de outra fase) abre a fase com ?play e a
// câmera percorre os nós de navegação duas vezes pelo mesmo caminho (a dog ativa vai de nó em nó; a câmera segue
// como no jogo). Os quadros são dados pela página de medição, com passo fixo e gl.finish(), para que a 1ª e a 2ª
// passagem sejam comparáveis quadro a quadro: o que a 1ª custa a mais é o trabalho de "primeira vez".
// Reprova (FIRST_PASS_STRICT, ligado por padrão) se, depois da carga, o renderer compilar um programa ou enviar uma
// textura, ou se um quadro da 1ª passagem custar FIRST_PASS_EXCESS_MS a mais que o mesmo quadro da 2ª.
// Executar no CI (workflow E2E manual, suíte primeira-passagem), nunca como bateria no PC.
//   FIRST_PASS_LEVELS=1,2  FIRST_PASS_QUALITY=alta,media  FIRST_PASS_DOGS=novo  FIRST_PASS_STRICT=0
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const OUT = fileURLToPath(new URL('../../shots/first-pass/', import.meta.url));
const MOUNT = '/primeira-passagem/';
const VIEWPORT = { width: 800, height: 450 };
const DT = 1 / 30;
const START_FRAMES = 15; // na posição inicial (os primeiros quadros depois da carga)
const NODE_FRAMES = 24; // em cada nó: a câmera (amortecimento de 0,24 s) chega e assenta
const RETURN_FRAMES = 30; // volta ao início entre as passagens (não entra nas contas)
const LEVELS = (process.env.FIRST_PASS_LEVELS || '1,2,3,4,5,6,7,8,9,10').split(',').map((s) => s.trim()).filter(Boolean);
const QUALITIES = (process.env.FIRST_PASS_QUALITY || 'alta,media').split(',').map((s) => s.trim()).filter(Boolean);
const DOGS = process.env.FIRST_PASS_DOGS || '';
const STRICT = process.env.FIRST_PASS_STRICT !== '0';
const EXCESS_MS = Number(process.env.FIRST_PASS_EXCESS_MS || 120);
for (const l of LEVELS) if (!/^([1-9]|10)$/.test(l)) throw new Error(`FIRST_PASS_LEVELS inválido: ${l}`);
for (const q of QUALITIES) if (!/^(alta|media|baixa)$/.test(q)) throw new Error(`FIRST_PASS_QUALITY inválido: ${q}`);
if (DOGS && !/^novo$/.test(DOGS)) throw new Error('FIRST_PASS_DOGS só aceita "novo"');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

const report = {
  commit: process.env.GITHUB_SHA || null, run: process.env.GITHUB_RUN_ID || null, attempt: process.env.GITHUB_RUN_ATTEMPT || null,
  node: process.version,
  conditions: {
    viewport: VIEWPORT, deviceScaleFactor: 1, dt: DT, startFrames: START_FRAMES, nodeFrames: NODE_FRAMES, returnFrames: RETURN_FRAMES,
    dogs: DOGS || 'padrao', strict: STRICT, excessLimitMs: EXCESS_MS,
    tour: 'greedy nearest-neighbour tour of layout NAV_NODES from the active dog start; the active dog is teleported node to node, camera rig follows; same tour twice',
    frame: 'game.update + seeThrough + feedback + particles + engine.render + gl.finish, driven by the measurement page (rAF loop paused)',
    excess: 'per frame: first pass ms minus the same frame of the second pass',
    limits: 'SwiftShader (software GL) on a CI runner: absolute ms are not a phone/PC GPU; counts of programs/textures/geometries are exact',
  },
  runs: [], errors: [], failures: [],
};
const save = () => writeFile(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const fail = (message) => { report.failures.push(message); console.log(`[primeira-passagem] FALHA: ${message}`); };

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

/** Instalado antes do boot: pausa o laço do jogo (a medição dá os quadros) e guarda as contagens logo na carga. */
function pageSetup({ quality }) {
  try {
    if (quality === 'alta') localStorage.removeItem('rr-quality');
    else localStorage.setItem('rr-quality', quality);
  } catch { /* sem armazenamento: fica no automático */ }
  let api;
  Object.defineProperty(window, '__game', {
    configurable: true, get: () => api,
    set(value) {
      api = value;
      const originals = {};
      for (const [key, owner, method] of [
        ['render', value.engine, 'render'], ['game', value.game, 'update'], ['feedback', value.feedback, 'update'],
        ['particles', value.particles, 'update'], ['ui', value.ui, 'update'],
      ]) {
        originals[key] = owner[method].bind(owner);
        owner[method] = () => {};
      }
      const { renderer } = value.engine;
      const marks = performance.getEntriesByType('mark').filter((m) => m.name.startsWith('rr:')).map((m) => ({ name: m.name, t: +m.startTime.toFixed(1) }));
      window.__firstPass = {
        originals,
        load: {
          programs: renderer.info.programs.length, textures: renderer.info.memory.textures,
          geometries: renderer.info.memory.geometries, marks,
        },
      };
    },
  });
}

/** Na página: percorre a fase duas vezes e devolve os quadros. */
async function pageTour({ dt, startFrames, nodeFrames, returnFrames }) {
  const { engine, game, THREE } = window.__game;
  const fp = window.__firstPass;
  const { renderer, scene } = engine;
  const gl = renderer.getContext();
  renderer.info.autoReset = false; // soma também os passes do compositor
  const L = game.levelDef.layout;
  const nodes = Object.entries(L.NAV_NODES).map(([id, n]) => ({ id, x: n.x, z: n.z }));
  const active = game.activeDog;
  const c0 = game.debug.ctrls[active];
  const start = { id: 'inicio', x: c0.x, z: c0.z };
  // caminho guloso: sempre o nó mais perto ainda não visitado
  const tour = [];
  let at = start;
  const left = [...nodes];
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      if (Math.hypot(left[i].x - at.x, left[i].z - at.z) < Math.hypot(left[best].x - at.x, left[best].z - at.z)) best = i;
    }
    at = left.splice(best, 1)[0];
    tour.push(at);
  }

  const known = new WeakMap();
  const texKnown = new WeakSet();
  const pathOf = (o) => {
    const parts = [];
    for (let p = o; p && parts.length < 4 && p !== scene; p = p.parent) parts.push(p.name || p.type);
    return parts.reverse().join(' > ');
  };
  const texSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'lightMap', 'displacementMap', 'envMap', 'gradientMap', 'specularMap'];
  /** Materiais que ganharam programa e texturas que foram para a GPU desde a última olhada. */
  function scan(record) {
    const mats = [];
    const texs = [];
    scene.traverse((o) => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) {
        const n = renderer.properties.get(m).programs?.size ?? 0;
        if (n > (known.get(m) ?? 0)) {
          known.set(m, n);
          if (record) mats.push(`${pathOf(o)} · ${m.type}${m.name ? ` "${m.name}"` : ''}`);
        }
        for (const k of texSlots) {
          const t = m[k];
          if (!t || !t.isTexture || texKnown.has(t)) continue;
          if (renderer.properties.get(t).__webglInit) {
            texKnown.add(t);
            if (record) texs.push(`${pathOf(o)} · ${k}${t.name ? ` "${t.name}"` : ''}${t.image?.width ? ` ${t.image.width}x${t.image.height}` : ''}`);
          }
        }
      }
    });
    return { mats, texs };
  }
  scan(false); // o que já estava pronto na carga

  let t = 0;
  const finish = () => gl.finish();
  function frame() {
    t += dt;
    const p0 = renderer.info.programs.length, x0 = renderer.info.memory.textures, g0 = renderer.info.memory.geometries;
    const t0 = performance.now();
    fp.originals.game(dt, t);
    window.__game.seeThrough();
    fp.originals.feedback(dt, t);
    fp.originals.particles(dt);
    const r0 = performance.now();
    renderer.info.reset();
    fp.originals.render(dt, t);
    const r1 = performance.now();
    finish();
    const t1 = performance.now();
    return {
      ms: +(t1 - t0).toFixed(1), render: +(r1 - r0).toFixed(1), gpu: +(t1 - r1).toFixed(1),
      programs: renderer.info.programs.length - p0, textures: renderer.info.memory.textures - x0,
      geometries: renderer.info.memory.geometries - g0, calls: renderer.info.render.calls,
    };
  }
  const tp = (n) => game.debug.teleport(active, n.x, n.z);
  const news = [];
  // devolve a vez ao navegador entre os nós (o laço do jogo está pausado; nada roda além do carimbo da UI)
  const breathe = () => new Promise((r) => setTimeout(r, 0));
  async function runPass(pass) {
    const frames = [];
    const visit = (node, count) => {
      for (let i = 0; i < count; i++) {
        const f = frame();
        f.node = node.id;
        frames.push(f);
        if (f.programs > 0 || f.textures > 0 || f.geometries > 0) {
          const s = scan(true);
          news.push({ pass, node: node.id, frame: frames.length - 1, programs: f.programs, textures: f.textures, geometries: f.geometries,
            ms: f.ms, materials: s.mats.slice(0, 12), moreMaterials: Math.max(0, s.mats.length - 12), textureList: s.texs.slice(0, 8),
            newProgramNames: renderer.info.programs.slice(-f.programs).map((p) => p.name) });
        }
      }
    };
    visit(start, startFrames);
    for (const n of tour) { await breathe(); tp(n); visit(n, nodeFrames); }
    return frames;
  }
  const pass1 = await runPass(1);
  tp(start);
  for (let i = 0; i < returnFrames; i++) frame();
  game.debug.cam.snapFollow(start.x, start.z);
  const pass2 = await runPass(2);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    level: game.levelDef.id, state: game.state, active, tour: tour.map((n) => n.id),
    load: fp.load,
    after: { programs: renderer.info.programs.length, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries },
    quality: { ...engine.qualityState, buffer: [size.x, size.y], shadows: renderer.shadowMap.enabled && engine.sun.castShadow,
      shadowType: renderer.shadowMap.type, shadowSize: engine.sun.shadow.mapSize.x, bloom: engine.bloom.enabled,
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) },
    passes: [pass1, pass2], news,
  };
}

const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] : 0;
};
const stats = (frames) => {
  const ms = frames.map((f) => f.ms);
  return { frames: ms.length, median: quantile(ms, 0.5), p95: quantile(ms, 0.95), max: Math.max(...ms),
    over50: ms.filter((v) => v > 50).length, over100: ms.filter((v) => v > 100).length, over250: ms.filter((v) => v > 250).length };
};
const markAt = (marks, name) => marks.find((m) => m.name === name)?.t ?? null;

let browser;
const watchdog = setTimeout(() => {
  report.errors.push('medição passou de 40 minutos');
  void browser?.close();
  server.closeAllConnections();
}, 40 * 60 * 1000);
watchdog.unref();
try {
  await mkdir(OUT, { recursive: true });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const base = `http://127.0.0.1:${server.address().port}${MOUNT}`;
  const options = browserOptions();
  for (const level of LEVELS) {
    for (const quality of QUALITIES) {
      const label = `fase${level}/${quality}`;
      console.log(`[primeira-passagem] ${label}: abrindo num navegador novo`);
      // navegador novo por medição: nada compilado antes (o cache de programas do processo da GPU é por navegador)
      browser = await chromium.launch(options);
      const errors = [];
      try {
        const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('crash', () => errors.push('page crashed'));
        page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
        await page.addInitScript(pageSetup, { quality });
        const url = `${base}?level=${level}&play${DOGS ? `&dogs=${DOGS}` : ''}`;
        await page.goto(url, { waitUntil: 'load', timeout: 180000 });
        await page.waitForFunction(() => window.__firstPass && window.__game?.game.state === 'playing', null, { timeout: 180000 });
        const run = await page.evaluate(pageTour, { dt: DT, startFrames: START_FRAMES, nodeFrames: NODE_FRAMES, returnFrames: RETURN_FRAMES });
        const [p1, p2] = run.passes;
        const excess = p1.map((f, i) => +(f.ms - (p2[i]?.ms ?? f.ms)).toFixed(1));
        const worst = excess.map((e, i) => ({ e, i })).sort((a, b) => b.e - a.e).slice(0, 8)
          .map(({ e, i }) => ({ frame: i, node: p1[i].node, excessMs: e, firstMs: p1[i].ms, secondMs: p2[i].ms, programs: p1[i].programs, textures: p1[i].textures }));
        const sum = (frames, k) => frames.reduce((a, f) => a + f[k], 0);
        const marks = run.load.marks;
        const summary = {
          label, level: run.level, quality: run.quality.level, renderer: run.quality.renderer,
          load: {
            programs: run.load.programs, textures: run.load.textures, geometries: run.load.geometries,
            prepareMs: markAt(marks, 'rr:level:compile') != null && markAt(marks, 'rr:level:setup') != null
              ? +(markAt(marks, 'rr:level:compile') - markAt(marks, 'rr:level:setup')).toFixed(1) : null,
            levelMs: markAt(marks, 'rr:level:loaded') != null && markAt(marks, 'rr:boot:ui') != null
              ? +(markAt(marks, 'rr:level:loaded') - markAt(marks, 'rr:boot:ui')).toFixed(1) : null,
          },
          afterLoad: {
            programs: sum(p1, 'programs') + sum(p2, 'programs'), textures: sum(p1, 'textures') + sum(p2, 'textures'),
            geometries: sum(p1, 'geometries') + sum(p2, 'geometries'),
            programsSecondPass: sum(p2, 'programs'), texturesSecondPass: sum(p2, 'textures'),
          },
          first: stats(p1), second: stats(p2),
          excess: { max: Math.max(...excess), sum: +excess.filter((e) => e > 0).reduce((a, e) => a + e, 0).toFixed(0),
            over50: excess.filter((e) => e > 50).length, over100: excess.filter((e) => e > 100).length, worst },
        };
        report.runs.push({ ...summary, tour: run.tour, quality: run.quality, news: run.news, errors,
          frames: { first: p1, second: p2 } });
        console.log(`[primeira-passagem] ${label}: carga ${summary.load.programs} programas/${summary.load.textures} texturas `
          + `(preparo ${summary.load.prepareMs} ms); depois da carga +${summary.afterLoad.programs} programas, +${summary.afterLoad.textures} texturas, `
          + `+${summary.afterLoad.geometries} geometrias; 1ª passagem máx ${summary.first.max} ms (p95 ${summary.first.p95}), `
          + `2ª máx ${summary.second.max} ms (p95 ${summary.second.p95}); excesso máx ${summary.excess.max} ms, ${summary.excess.over100} quadros > 100 ms`);
        for (const e of errors) report.errors.push(`${label}: ${e}`);
        if (run.state !== 'playing' && run.state !== 'celebrate' && run.state !== 'victory') fail(`${label}: estado inesperado ${run.state}`);
        if (STRICT) {
          if (summary.afterLoad.programs > 0) fail(`${label}: ${summary.afterLoad.programs} programas compilados depois da carga`);
          if (summary.afterLoad.textures > 0) fail(`${label}: ${summary.afterLoad.textures} texturas enviadas depois da carga`);
          if (summary.excess.max > EXCESS_MS) fail(`${label}: quadro da 1ª passagem ${summary.excess.max} ms mais caro que na 2ª (limite ${EXCESS_MS} ms)`);
        }
      } catch (error) {
        report.errors.push(`${label}: ${error.stack || error}`);
      } finally {
        await browser.close().catch(() => {});
        browser = null;
        await save();
      }
    }
  }
} catch (error) {
  report.errors.push(error.stack || String(error));
} finally {
  clearTimeout(watchdog);
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  report.passed = report.errors.length === 0 && report.failures.length === 0 && report.runs.length === LEVELS.length * QUALITIES.length;
  await save();
  const rows = report.runs.map((r) => `| ${r.label} | ${r.load.programs} | ${r.load.prepareMs ?? '–'} | ${r.afterLoad.programs} | ${r.afterLoad.textures} | ${r.afterLoad.geometries} | `
    + `${r.first.max} / ${r.first.p95} | ${r.second.max} / ${r.second.p95} | ${r.excess.max} | ${r.excess.over100} |`);
  const md = [
    `## Primeira passagem pelas áreas${report.commit ? ` — \`${report.commit.slice(0, 7)}\`` : ''}`,
    '',
    `${report.passed ? '✅ Aprovada' : '❌ Reprovada'} · ${VIEWPORT.width}×${VIEWPORT.height}, passo de ${(DT * 1000).toFixed(1)} ms, dogs: ${DOGS || 'padrão'} · SwiftShader (os ms não são de um aparelho; as contagens são exatas)`,
    '',
    '| Fase/qualidade | Programas na carga | Preparo (ms) | Programas depois | Texturas depois | Geometrias depois | 1ª passagem máx / p95 (ms) | 2ª passagem máx / p95 (ms) | Excesso máx (ms) | Quadros +100 ms |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    ...report.failures.map((f) => `- ❌ ${f}`),
    ...report.errors.map((e) => `- ⚠️ ${String(e).split('\n')[0]}`),
  ].join('\n') + '\n';
  await writeFile(resolve(OUT, 'report.md'), md);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, md, { flag: 'a' });
  console.log(md);
  if (!report.passed) process.exitCode = 1;
}
