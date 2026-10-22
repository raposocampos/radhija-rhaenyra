// Primeira passagem pelas áreas de cada fase: o que a GPU ainda prepara depois da carga e quanto isso custa.
// Para cada fase e qualidade, um navegador novo (sem programas guardados de outra fase) abre a fase com ?play e a
// câmera percorre os nós de navegação duas vezes pelo mesmo caminho (a dog ativa vai de nó em nó; a câmera segue
// como no jogo); no fim, um superbafo. Os quadros são dados pela página de medição, com passo fixo e esperando a GPU
// terminar cada um (leitura de um pixel), para que a 1ª e a 2ª passagem sejam comparáveis quadro a quadro: o que a
// 1ª custa a mais é o trabalho de "primeira vez".
// Reprova (FIRST_PASS_STRICT, ligado por padrão) se, depois da carga, o renderer compilar um programa ou enviar uma
// textura ou geometria, ou se a 1ª passagem tiver picos: quadros que custam mais de FIRST_PASS_EXCESS_MS e mais de
// FIRST_PASS_EXCESS_REL (fração) que o mesmo quadro da 2ª, com a mesma cena (desenhos a 2%). Tolera até
// FIRST_PASS_MAX_PEAKS (3) quadros isolados, nenhum acima de FIRST_PASS_MAX_RATIO (2,5×) o mesmo da 2ª: no SwiftShader,
// alguns objetos ainda custam um pouco mais na primeira vez que pintam de perto, sem nada novo no renderer (o relatório
// diz o que acabou de entrar na câmera). O 1º quadro sem o aquecimento custava de 5 a 30× o normal.
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
const VIEWPORT = { width: 480, height: 270 };
const DT = 1 / 30;
// Na posição inicial (os primeiros quadros depois da carga). Par, como os 18 de cada nó e os 30 da volta: no 'baixa' a
// sombra é redesenhada a cada 2 quadros, e a 2ª passagem precisa começar na mesma paridade para os quadros se compararem.
const START_FRAMES = 16;
const NODE_FRAMES = 18; // em cada nó: a câmera (amortecimento de 0,24 s) chega e assenta (96% em 0,6 s)
const RETURN_FRAMES = 30; // volta ao início entre as passagens (não entra nas contas)
// Antes da 1ª passagem, a página fica parada um pouco: no runner de 4 núcleos, logo depois da carga o navegador ainda
// trabalha em segundo plano (os quadros saíam ~30% mais caros por 3–8 s e depois caíam de uma vez para o normal,
// sem nada novo no renderer). Não é a primeira vez numa área, e o jogador também não sai andando antes da cortina abrir.
const SETTLE_MS = Number(process.env.FIRST_PASS_SETTLE_MS || 3000);
const LEVELS = (process.env.FIRST_PASS_LEVELS || '1,2,3,4,5,6,7,8,9,10').split(',').map((s) => s.trim()).filter(Boolean);
const QUALITIES = (process.env.FIRST_PASS_QUALITY || 'alta,celular-media,celular-baixa').split(',').map((s) => s.trim()).filter(Boolean);
// Aparelhos: o PC (480×270 para caber no tempo do job; o programa não depende do tamanho) e os celulares-alvo emulados
// (toque, sem mouse, tela de celular: o jogo escolhe o perfil e o pelo do celular), com o perfil fixo para o governador
// de FPS não descer sozinho no SwiftShader lento. iPhone 13: 844×390, DPR 3, 'media'. Infinix Note 30 5G (Mali-G57,
// começa no 'baixa'): 893×393, DPR 2,75.
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const touchDevice = (w, h, dpr) => ({ viewport: { width: w, height: h }, screen: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, userAgent: MOBILE_UA });
const DEVICES = {
  alta: { level: 'alta', page: { viewport: VIEWPORT, deviceScaleFactor: 1 } },
  media: { level: 'media', page: { viewport: VIEWPORT, deviceScaleFactor: 1 } },
  baixa: { level: 'baixa', page: { viewport: VIEWPORT, deviceScaleFactor: 1 } },
  'celular-media': { level: 'media', page: touchDevice(844, 390, 3), as: 'iPhone 13' },
  'celular-baixa': { level: 'baixa', page: touchDevice(893, 393, 2.75), as: 'Infinix Note 30 5G' },
};
const DOGS = process.env.FIRST_PASS_DOGS || '';
const STRICT = process.env.FIRST_PASS_STRICT !== '0';
const EXCESS_MS = Number(process.env.FIRST_PASS_EXCESS_MS || 150);
const EXCESS_REL = Number(process.env.FIRST_PASS_EXCESS_REL || 0.35);
const MAX_PEAKS = Number(process.env.FIRST_PASS_MAX_PEAKS || 3);
const MAX_RATIO = Number(process.env.FIRST_PASS_MAX_RATIO || 2.5);
for (const l of LEVELS) if (!/^([1-9]|10)$/.test(l)) throw new Error(`FIRST_PASS_LEVELS inválido: ${l}`);
for (const q of QUALITIES) if (!DEVICES[q]) throw new Error(`FIRST_PASS_QUALITY inválido: ${q}`);
if (DOGS && !/^novo$/.test(DOGS)) throw new Error('FIRST_PASS_DOGS só aceita "novo"');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

const report = {
  commit: process.env.GITHUB_SHA || null, run: process.env.GITHUB_RUN_ID || null, attempt: process.env.GITHUB_RUN_ATTEMPT || null,
  node: process.version,
  conditions: {
    viewport: VIEWPORT, deviceScaleFactor: 1, dt: DT, startFrames: START_FRAMES, nodeFrames: NODE_FRAMES, returnFrames: RETURN_FRAMES,
    settleMs: SETTLE_MS,
    dogs: DOGS || 'padrao', strict: STRICT, peak: { ms: EXCESS_MS, relative: EXCESS_REL, sameDrawsWithin: 0.02, tolerated: MAX_PEAKS, maxRatio: MAX_RATIO },
    tour: 'greedy nearest-neighbour tour of layout NAV_NODES from the active dog start; the active dog is teleported node to node, camera rig follows; same tour twice',
    frame: 'game.update + seeThrough + feedback + particles + engine.render + 1-pixel readPixels (waits for the GPU), driven by the measurement page (rAF loop paused)',
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
async function pageTour({ dt, startFrames, nodeFrames, returnFrames, settleMs }) {
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
  // Diagnóstico dos picos: o que entra na câmera pela primeira vez em cada quadro da 1ª passagem (fora do tempo medido)
  const seen = new WeakSet();
  const frustum = new THREE.Frustum();
  const pv = new THREE.Matrix4();
  const describe = (o) => {
    const m = [].concat(o.material)[0] || {};
    const flags = [m.transparent && 'transparente', m.side === THREE.DoubleSide && 'dois lados', m.side === THREE.BackSide && 'verso',
      m.blending !== THREE.NormalBlending && `mistura ${m.blending}`, m.map && 'mapa', o.isInstancedMesh && `instâncias ${o.count}`,
      o.matrixWorld.determinant() < 0 && 'espelhado', o.castShadow && 'sombra'].filter(Boolean);
    return `${pathOf(o)} · ${m.type || o.type}${flags.length ? ` (${flags.join(', ')})` : ''}`;
  };
  function firstSeen() {
    const camera = engine.camera;
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    const out = [];
    scene.traverseVisible((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || seen.has(o)) return;
      if (o.frustumCulled && !(o.isSprite ? frustum.intersectsSprite(o) : frustum.intersectsObject(o))) return;
      seen.add(o);
      out.push(describe(o));
    });
    return out;
  }
  const seenAtStart = firstSeen().length;
  const appeared = [];
  if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs));

  let t = 0;
  // gl.finish() não espera a GPU no Chromium (os quadros se enfileiram e o tempo sai em degraus de 5 e 600 ms):
  // ler um pixel da tela obriga o quadro a terminar, então cada quadro mede o próprio custo
  const px = new Uint8Array(4);
  const finish = () => {
    renderer.setRenderTarget(null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  };
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
  function visit(frames, pass, node, count) {
    for (let i = 0; i < count; i++) {
      const f = frame();
      f.node = node.id;
      frames.push(f);
      if (pass === 1) {
        const names = firstSeen();
        if (names.length) appeared.push({ frame: frames.length - 1, node: node.id, count: names.length, names: names.slice(0, 20) });
      }
      if (f.programs > 0 || f.textures > 0 || f.geometries > 0) {
        const s = scan(true);
        news.push({ pass, node: node.id, frame: frames.length - 1, programs: f.programs, textures: f.textures, geometries: f.geometries,
          ms: f.ms, materials: s.mats.slice(0, 12), moreMaterials: Math.max(0, s.mats.length - 12), textureList: s.texs.slice(0, 8),
          newProgramNames: f.programs > 0 ? renderer.info.programs.slice(-f.programs).map((p) => p.name) : [] });
      }
    }
  }
  async function runPass(pass) {
    const frames = [];
    visit(frames, pass, start, startFrames);
    for (const n of tour) { await breathe(); tp(n); visit(frames, pass, n, nodeFrames); }
    return frames;
  }
  const pass1 = await runPass(1);
  const back = [];
  tp(start);
  visit(back, 'volta', start, returnFrames);
  game.debug.cam.snapFollow(start.x, start.z);
  const pass2 = await runPass(2);
  // o que só aparece num evento da partida: a nuvem do superbafo e a mira
  const events = [];
  const scent = game.debug.scent;
  const ctrl = game.debug.ctrls[active];
  const shot = { x: ctrl.x, z: ctrl.z, dirX: 0, dirZ: 1, speed: 2.6, life: 5 };
  scent.spawn(shot);
  scent.showPreview(scent.preview(shot));
  visit(events, 'eventos', { id: 'superbafo' }, 20);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    level: game.levelDef.id, state: game.state, active, tour: tour.map((n) => n.id),
    load: fp.load,
    after: { programs: renderer.info.programs.length, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries },
    quality: { ...engine.qualityState, device: engine.quality.device, buffer: [size.x, size.y], shadows: renderer.shadowMap.enabled && engine.sun.castShadow,
      shadowType: renderer.shadowMap.type, shadowSize: engine.sun.shadow.mapSize.x, bloom: engine.bloom.enabled,
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) },
    passes: [pass1, pass2], back, events, news, seenAtStart, appeared,
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
  // Cada medição já abre um perfil novo (cache de shaders em disco vazio); desligar o cache só tira a gravação em
  // segundo plano dos programas recém-compilados, que no runner deixava os quadros ~30% mais caros por alguns segundos
  // depois da carga. FIRST_PASS_SHADER_CACHE=1 mantém o cache.
  if (process.env.FIRST_PASS_SHADER_CACHE !== '1') options.args = [...options.args, '--disable-gpu-shader-disk-cache'];
  report.conditions.browserArguments = options.args;
  for (const level of LEVELS) {
    for (const quality of QUALITIES) {
      const label = `fase${level}/${quality}`;
      console.log(`[primeira-passagem] ${label}: abrindo num navegador novo`);
      // navegador novo por medição: nada compilado antes (o cache de programas do processo da GPU é por navegador)
      browser = await chromium.launch(options);
      const errors = [];
      try {
        const page = await browser.newPage(DEVICES[quality].page);
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('crash', () => errors.push('page crashed'));
        page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
        await page.addInitScript(pageSetup, { quality: DEVICES[quality].level });
        const url = `${base}?level=${level}&play${DOGS ? `&dogs=${DOGS}` : ''}`;
        await page.goto(url, { waitUntil: 'load', timeout: 180000 });
        await page.waitForFunction(() => window.__firstPass && window.__game?.game.state === 'playing', null, { timeout: 180000 });
        const run = await page.evaluate(pageTour, { dt: DT, startFrames: START_FRAMES, nodeFrames: NODE_FRAMES, returnFrames: RETURN_FRAMES, settleMs: SETTLE_MS });
        const [p1, p2] = run.passes;
        const excess = p1.map((f, i) => +(f.ms - (p2[i]?.ms ?? f.ms)).toFixed(1));
        const worst = excess.map((e, i) => ({ e, i })).sort((a, b) => b.e - a.e).slice(0, 8)
          .map(({ e, i }) => ({ frame: i, node: p1[i].node, excessMs: e, firstMs: p1[i].ms, secondMs: p2[i].ms, programs: p1[i].programs, textures: p1[i].textures }));
        // pico: bem mais caro que o mesmo quadro da 2ª passagem, com a mesma cena (a mesma quantidade de desenhos;
        // um bicho ou um objeto do puzzle em outro lugar muda o quadro, não é trabalho de primeira vez)
        const peaks = p1.map((f, i) => ({ f, s: p2[i], i }))
          .filter(({ f, s }) => s && f.ms - s.ms > Math.max(EXCESS_MS, EXCESS_REL * s.ms) && Math.abs(f.calls - s.calls) <= 0.02 * s.calls)
          .map(({ f, s, i }) => ({ frame: i, node: f.node, firstMs: f.ms, secondMs: s.ms, gpuMs: f.gpu, calls: f.calls }));
        const sum = (frames, k) => frames.reduce((a, f) => a + f[k], 0);
        const marks = run.load.marks;
        const between = (a, b) => (markAt(marks, a) != null && markAt(marks, b) != null ? +(markAt(marks, b) - markAt(marks, a)).toFixed(1) : null);
        const summary = {
          label, level: run.level, quality: run.quality.level, renderer: run.quality.renderer,
          load: {
            programs: run.load.programs, textures: run.load.textures, geometries: run.load.geometries,
            prepareMs: markAt(marks, 'rr:level:compile') != null && markAt(marks, 'rr:level:setup') != null
              ? +(markAt(marks, 'rr:level:compile') - markAt(marks, 'rr:level:setup')).toFixed(1) : null,
            levelMs: markAt(marks, 'rr:level:loaded') != null && markAt(marks, 'rr:boot:ui') != null
              ? +(markAt(marks, 'rr:level:loaded') - markAt(marks, 'rr:boot:ui')).toFixed(1) : null,
            // engine.prepare: compilar, desenhar tudo + um quadro, esperar a GPU
            gpu: { compileMs: between('rr:level:setup', 'rr:gpu:compiled'), drawMs: between('rr:gpu:compiled', 'rr:gpu:drawn'),
              idleMs: between('rr:gpu:drawn', 'rr:gpu:idle') },
          },
          afterLoad: {
            programs: sum(p1, 'programs') + sum(run.back, 'programs') + sum(p2, 'programs'),
            textures: sum(p1, 'textures') + sum(run.back, 'textures') + sum(p2, 'textures'),
            geometries: sum(p1, 'geometries') + sum(run.back, 'geometries') + sum(p2, 'geometries'),
            programsSecondPass: sum(p2, 'programs'), texturesSecondPass: sum(p2, 'textures'),
          },
          // trabalho de compilação que não depende do aparelho: todos os programas criados até ver a fase inteira
          programsTotal: run.load.programs + sum(p1, 'programs') + sum(run.back, 'programs') + sum(p2, 'programs') + sum(run.events, 'programs'),
          device: run.quality.device, buffer: run.quality.buffer, as: DEVICES[quality].as || 'PC',
          events: { programs: sum(run.events, 'programs'), textures: sum(run.events, 'textures'), geometries: sum(run.events, 'geometries'),
            max: Math.max(...run.events.map((f) => f.ms)) },
          first: stats(p1), second: stats(p2),
          excess: { max: Math.max(...excess), sum: +excess.filter((e) => e > 0).reduce((a, e) => a + e, 0).toFixed(0),
            over50: excess.filter((e) => e > 50).length, over100: excess.filter((e) => e > 100).length, worst },
          peaks,
        };
        // para cada pico, o que tinha acabado de entrar na câmera (no quadro dele ou no anterior)
        for (const k of summary.peaks) k.appeared = run.appeared.filter((a) => a.frame === k.frame || a.frame === k.frame - 1);
        report.runs.push({ ...summary, tour: run.tour, quality: run.quality, news: run.news, errors,
          seenAtStart: run.seenAtStart, appeared: run.appeared,
          frames: { first: p1, second: p2, back: run.back, events: run.events } });
        console.log(`[primeira-passagem] ${label}: carga ${summary.load.programs} programas/${summary.load.textures} texturas `
          + `(preparo ${summary.load.prepareMs} ms); depois da carga +${summary.afterLoad.programs} programas, +${summary.afterLoad.textures} texturas, `
          + `+${summary.afterLoad.geometries} geometrias, superbafo +${summary.events.programs} programas; 1ª passagem máx ${summary.first.max} ms (p95 ${summary.first.p95}), `
          + `2ª máx ${summary.second.max} ms (p95 ${summary.second.p95}); excesso máx ${summary.excess.max} ms, ${summary.peaks.length} picos`
          + (summary.peaks.length ? ` (${summary.peaks.slice(0, 6).map((k) => `${k.frame}@${k.node} ${k.firstMs}/${k.secondMs}`).join(', ')})` : ''));
        for (const e of errors) report.errors.push(`${label}: ${e}`);
        const want = DEVICES[quality];
        if (run.quality.level !== want.level || (want.as && run.quality.device !== 'phone') || (!want.as && run.quality.device !== 'desktop')) {
          fail(`${label}: aparelho ou perfil errado (${run.quality.device}/${run.quality.level})`);
        }
        if (run.state !== 'playing' && run.state !== 'celebrate' && run.state !== 'victory') fail(`${label}: estado inesperado ${run.state}`);
        if (STRICT) {
          if (summary.afterLoad.programs > 0) fail(`${label}: ${summary.afterLoad.programs} programas compilados depois da carga`);
          if (summary.afterLoad.textures > 0) fail(`${label}: ${summary.afterLoad.textures} texturas enviadas depois da carga`);
          if (summary.afterLoad.geometries > 0) fail(`${label}: ${summary.afterLoad.geometries} geometrias enviadas depois da carga`);
          if (summary.events.programs > 0 || summary.events.textures > 0) fail(`${label}: o primeiro superbafo compilou ${summary.events.programs} programas e enviou ${summary.events.textures} texturas`);
          const big = summary.peaks.filter((k) => k.firstMs > MAX_RATIO * k.secondMs);
          if (summary.peaks.length > MAX_PEAKS || big.length) fail(`${label}: ${summary.peaks.length} picos na 1ª passagem (tolerados ${MAX_PEAKS}, `
            + `nenhum acima de ${MAX_RATIO}×): ` + summary.peaks.slice(0, 6).map((k) => `quadro ${k.frame} em ${k.node}, ${k.firstMs} ms contra ${k.secondMs} ms`).join('; '));
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
  const rows = report.runs.map((r) => `| ${r.label} (${r.as}, ${r.buffer.join('×')}) | ${r.programsTotal} | ${r.load.programs} | ${r.load.levelMs ?? '–'} | ${r.load.prepareMs ?? '–'} | ${r.afterLoad.programs} | ${r.afterLoad.textures} | ${r.afterLoad.geometries} | ${r.events.programs} | `
    + `${r.first.max} / ${r.first.p95} | ${r.second.max} / ${r.second.p95} | ${r.excess.max} | ${r.peaks.length} |`);
  const md = [
    `## Primeira passagem pelas áreas${report.commit ? ` — \`${report.commit.slice(0, 7)}\`` : ''}`,
    '',
    `${report.passed ? '✅ Aprovada' : '❌ Reprovada'} · ${VIEWPORT.width}×${VIEWPORT.height}, passo de ${(DT * 1000).toFixed(1)} ms, dogs: ${DOGS || 'padrão'} · SwiftShader (os ms não são de um aparelho; as contagens são exatas)`,
    '',
    '| Fase/qualidade | Programas no total | Programas na carga | Carga (ms) | Preparo (ms) | Programas depois | Texturas depois | Geometrias depois | Programas no superbafo | 1ª passagem máx / p95 (ms) | 2ª passagem máx / p95 (ms) | Excesso máx (ms) | Picos |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
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
