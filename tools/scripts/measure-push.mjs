// Desempenho empurrando (retorno do usuário: "toda vez que eu vou empurrar algum item tem uma queda de performance
// grande"): no navegador do CI, com um build servido aqui, mede o tempo de CPU de cada quadro com a Rhaenyra parada de
// frente para o objeto, empurrando-o (Shift + direção) e andando sem empurrar, no carrinho (fase 1), no caixote
// (fase 2) e no ventilador (fase 4). Por quadro: game.update, engine.render, a animação da dog (dogs.rhaenyra.update)
// e os raios do three.js (Raycaster.intersectObjects: quantos e quanto tempo). A Radhija segue a irmã, como no jogo (a
// IA dela e a navegação entram na conta; com --fica, ela fica parada). Com --profile, o perfil de CPU (CDP)
// enquanto ela empurra, somado por função (build sem minificar: os nomes ficam legíveis).
//   node tools/scripts/measure-push.mjs --dist <pasta do build> --label <nome> [--queries "padrao,dogs=atual"] [--profile] [--fica]
// Saída: shots/push/<label>/report.json e uma tabela no log. Só no CI (o PC do usuário fica livre).
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chromium } from 'playwright-core';
import { browserOptions } from './lib/browser.mjs';
import { parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const DIST = resolve(String(args.dist || 'dist'));
const LABEL = String(args.label || 'build');
const QUERIES = String(args.queries || 'padrao').split(',').map((q) => q.trim()).filter(Boolean);
const PROFILE = !!args.profile;
const STAY = !!args.fica;
const OUT = resolve(`shots/push/${LABEL}`);
const MOUNT = '/medir/';
const VIEWPORT = { width: 800, height: 450 };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
/** Os objetos empurrados: fase, id do colisor e o nome. */
const SCENES = [
  { name: 'carrinho', level: 1, id: 'cart' },
  { name: 'caixote', level: 2, id: 'crate' },
  { name: 'ventilador', level: 4, id: 'ventilador' },
];
/** Fases da medida (s de jogo): parada de frente, empurrando, andando sem empurrar. */
const PHASES = { idle: 2.5, push: 3.5, walk: 2.5 };
/** Desenha 1 de cada DRAW quadros (o SwiftShader do CI desenhando todo quadro deixa o jogo lento demais para andar). */
const DRAW = 10;

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

/** Ganchos de medida, só na página de medida (o jogo não muda). */
function probe(DRAW_EVERY) {
  let api;
  Object.defineProperty(window, '__game', {
    configurable: true, get: () => api,
    set(value) {
      api = value;
      const { engine, game, dogs, THREE } = value;
      // qualidade baixa e fixa (o SwiftShader do CI não tem GPU): o que se compara é a CPU, igual nos dois builds
      engine.renderer.setPixelRatio(0.5);
      engine.composer?.setPixelRatio?.(0.5);
      engine.renderer.shadowMap.enabled = false;
      if (engine.bloom) engine.bloom.enabled = false;
      const M = window.__push = { on: false, frames: [], cur: null };
      const fresh = () => ({ rayN: 0, rayMs: 0, animMs: 0, action: null });
      M.cur = fresh();
      const ray = THREE.Raycaster.prototype.intersectObjects;
      THREE.Raycaster.prototype.intersectObjects = function (...a) {
        const t0 = performance.now();
        const r = ray.apply(this, a);
        M.cur.rayN++;
        M.cur.rayMs += performance.now() - t0;
        return r;
      };
      for (const n of Object.keys(dogs)) {
        const up = dogs[n].update;
        dogs[n].update = function (...a) {
          const t0 = performance.now();
          const r = up.apply(this, a);
          if (n === 'rhaenyra') {
            M.cur.animMs += performance.now() - t0;
            M.cur.action = a[1]?.action ?? null;
          }
          return r;
        };
      }
      const update = game.update;
      let u = 0;
      game.update = function (...a) {
        const t0 = performance.now();
        const r = update.apply(this, a);
        u = performance.now() - t0;
        return r;
      };
      const render = engine.render;
      let frame = 0;
      engine.render = function (...a) {
        const draw = frame++ % DRAW_EVERY === 0;
        const t0 = performance.now();
        const r = draw ? render.apply(this, a) : undefined;
        const rm = draw ? performance.now() - t0 : null;
        if (M.on) M.frames.push({ phase: M.phase, u, r: rm, ...M.cur });
        M.cur = fresh();
        return r;
      };
    },
  });
}

const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
function summarize(frames) {
  const out = {};
  for (const ph of Object.keys(PHASES)) {
    const f = frames.filter((x) => x.phase === ph).slice(2); // os dois primeiros quadros da fase são a troca
    out[ph] = {
      frames: f.length,
      updateMs: { median: r2(pct(f.map((x) => x.u), 0.5)), p95: r2(pct(f.map((x) => x.u), 0.95)), mean: r2(mean(f.map((x) => x.u))) },
      renderMs: { median: r2(pct(f.filter((x) => x.r != null).map((x) => x.r), 0.5)), mean: r2(mean(f.filter((x) => x.r != null).map((x) => x.r))) },
      animMs: { mean: r2(mean(f.map((x) => x.animMs))) },
      rays: { perFrame: r2(mean(f.map((x) => x.rayN))), ms: r2(mean(f.map((x) => x.rayMs))) },
      pushingFrames: f.filter((x) => x.action === 'push' || x.action === 'strain' || x.action === 'shove').length,
    };
  }
  return out;
}

/** Soma o perfil do CDP por função (tempo próprio, ms): as que mais gastam. */
function topFunctions(profile, n = 25) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const dt = profile.timeDeltas || [];
  for (let i = 0; i < profile.samples.length; i++) {
    const node = byId.get(profile.samples[i]);
    if (!node) continue;
    const f = node.callFrame;
    const file = (f.url || '').split('/').pop();
    const key = `${f.functionName || '(anônima)'} ${file}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000);
  }
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  return { totalMs: r2(total), top: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, ms]) => ({ fn: k, ms: r2(ms), pct: r2((100 * ms) / total) })) };
}

const report = { label: LABEL, dist: DIST, queries: QUERIES, startedAtUtc: new Date().toISOString(), runs: [], errors: [] };
let browser;
/** O lado que move cada objeto (achado na primeira medida; o cenário é o mesmo nas outras). */
const sideOf = {};
try {
  await mkdir(OUT, { recursive: true });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const base = `http://127.0.0.1:${server.address().port}${MOUNT}`;
  browser = await chromium.launch(browserOptions());
  for (const q of QUERIES) {
    for (const S of SCENES) {
      const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      page.setDefaultTimeout(180000);
      page.on('pageerror', (e) => report.errors.push(`${LABEL}/${q}/${S.name}: ${e.message}`));
      await page.addInitScript(probe, DRAW);
      const extra = q === 'padrao' ? '' : `&${q}`;
      /** Carrega a fase e põe a Rhaenyra de frente para o objeto, recuada; devolve a direção do empurrão ou null. */
      const setup = async (dir) => {
        await page.goto(`${base}?level=${S.level}&play&dog=rhaenyra${extra}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__game?.game?.state === 'playing' && !document.getElementById('loading'), null, { timeout: 180000 });
        await page.waitForTimeout(500);
        return page.evaluate(({ id, dir: d, stay }) => {
          const g = window.__game.game;
          g.debug.idle?.setPee?.(false);
          if (stay) g.setStay?.('radhija', true);
          const W = g.debug.world;
          const col = W.getDynamic(id);
          if (!col) return { error: `sem o colisor ${id}` };
          const c = g.debug.ctrls.rhaenyra;
          const dirs = d ? [d] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dz] of dirs) {
            const ext = col.shape === 'box' ? Math.abs(dx) * col.hx + Math.abs(dz) * col.hz : col.r ?? 0.3;
            const x = col.x - dx * (ext + c.r + 0.1), z = col.z - dz * (ext + c.r + 0.1);
            if (W.overlaps(x, z, c.r + 0.02, c.size)) continue;
            g.debug.teleport('rhaenyra', x, z);
            c.yaw = Math.atan2(dx, dz);
            // a irmã atrás dela, um pouco para o lado (segue, como no jogo)
            for (const [bx, bz] of [[-1.1, 0.5], [-1.1, -0.5], [-1.4, 0], [-0.6, 1.0], [-0.6, -1.0]]) {
              const px = x + dx * bx + dz * bz, pz = z + dz * bx - dx * bz;
              if (W.overlaps(px, pz, g.debug.ctrls.radhija.r + 0.02, 'small')) continue;
              g.debug.teleport('radhija', px, pz);
              break;
            }
            return { dir: [dx, dz], col: { x: col.x, z: col.z } };
          }
          return { error: 'sem lugar para empurrar' };
        }, { id: S.id, dir, stay: STAY });
      };
      /** As teclas (relativas à câmera) para andar na direção do mundo (dx, dz). */
      const keysFor = (dx, dz) => page.evaluate(([x, z]) => {
        const B = window.__game.game.debug.cam.basis();
        const fwd = x * B.fx + z * B.fz, rgt = x * B.rx + z * B.rz;
        const s = ((Math.round(Math.atan2(rgt, fwd) / (Math.PI / 4)) % 8) + 8) % 8;
        return [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyW', 'KeyA']][s];
      }, [dx, dz]);
      /** Espera `sec` s do relógio do jogo (o runner é mais lento que o tempo real). */
      const gameWait = async (sec) => {
        const t0 = await page.evaluate(() => window.__game.game.debug.info().timeSec);
        await page.waitForFunction((t) => window.__game.game.debug.info().timeSec >= t, t0 + sec, { timeout: 180000, polling: 50 });
      };
      const holdFor = async (keys, sec) => {
        for (const k of keys) await page.keyboard.down(k);
        await gameWait(sec);
        for (const k of [...keys].reverse()) await page.keyboard.up(k);
      };
      const run = { query: q, scene: S.name, level: S.level };
      try {
        // acha um lado de onde o empurrão anda (o objeto sai do lugar), numa tentativa curta
        let found = sideOf[S.name] ?? null;
        for (const d of found ? [] : [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const st = await setup(d);
          if (st?.error) continue;
          const keys = await keysFor(d[0], d[1]);
          await gameWait(0.5);
          await holdFor(['ShiftLeft', ...keys], 1.6);
          const moved = await page.evaluate(({ id, x, z }) => {
            const col = window.__game.game.debug.world.getDynamic(id);
            return Math.hypot(col.x - x, col.z - z);
          }, { id: S.id, x: st.col.x, z: st.col.z });
          if (moved > 0.08) { found = d; break; }
        }
        if (!found) throw new Error('nenhum lado move o objeto');
        sideOf[S.name] = found;
        const st = await setup(found);
        if (st?.error) throw new Error(st.error);
        run.dir = found;
        const keys = await keysFor(found[0], found[1]);
        const back = await keysFor(-found[0], -found[1]);
        await gameWait(0.5);
        await page.evaluate(() => { window.__push.frames = []; window.__push.on = true; window.__push.phase = 'idle'; });
        await gameWait(PHASES.idle);
        await page.evaluate(() => { window.__push.phase = 'push'; });
        let cdp = null;
        if (PROFILE) {
          cdp = await page.context().newCDPSession(page);
          await cdp.send('Profiler.enable');
          await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
          await cdp.send('Profiler.start');
        }
        await holdFor(['ShiftLeft', ...keys], PHASES.push);
        if (cdp) {
          const { profile } = await cdp.send('Profiler.stop');
          run.profile = topFunctions(profile);
          await cdp.detach();
        }
        await page.evaluate(() => { window.__push.phase = 'walk'; });
        await holdFor(back, PHASES.walk);
        const frames = await page.evaluate(() => { window.__push.on = false; return window.__push.frames; });
        run.summary = summarize(frames);
        run.moved = await page.evaluate(({ id, x, z }) => {
          const col = window.__game.game.debug.world.getDynamic(id);
          return Math.round(Math.hypot(col.x - x, col.z - z) * 100) / 100;
        }, { id: S.id, x: st.col.x, z: st.col.z });
      } catch (e) {
        run.error = String(e.message || e);
        report.errors.push(`${LABEL}/${q}/${S.name}: ${run.error}`);
      }
      report.runs.push(run);
      await page.close();
      const s = run.summary;
      if (s) {
        console.log(`[push ${LABEL}] ${q.padEnd(10)} ${S.name.padEnd(10)} moveu ${run.moved} m | update ms (mediana/p95): parada ${s.idle.updateMs.median}/${s.idle.updateMs.p95}  empurrando ${s.push.updateMs.median}/${s.push.updateMs.p95}  andando ${s.walk.updateMs.median}/${s.walk.updateMs.p95} | raios/quadro empurrando ${s.push.rays.perFrame} (${s.push.rays.ms} ms) | animação ${s.push.animMs.mean} ms | render ${s.push.renderMs.median} ms | quadros ${s.idle.frames}/${s.push.frames}/${s.walk.frames}`);
        if (run.profile) for (const t of run.profile.top.slice(0, 12)) console.log(`    ${String(t.ms).padStart(8)} ms ${String(t.pct).padStart(5)}%  ${t.fn}`);
      } else console.log(`[push ${LABEL}] ${q} ${S.name}: ERRO ${run.error}`);
    }
  }
} catch (e) {
  report.errors.push(String(e.stack || e));
  console.error(e);
} finally {
  await writeFile(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n').catch(() => {});
  await browser?.close();
  server.close();
}
if (report.runs.every((r) => r.error)) process.exit(1);
