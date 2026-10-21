// Desempenho segurando o R1 (retorno do usuário: "é queda de performance, como se o fps baixasse muito quando eu
// aperto o R1 pra empurrar algo"): no navegador do CI, com um build servido aqui e um controle falso (o R1 e o
// analógico de verdade, pela API de gamepad), mede o tempo de CPU de cada quadro:
//  • empurrando: a Rhaenyra parada de frente para o carrinho (fase 1), o caixote (fase 2) e o ventilador (fase 4), com o
//    R1 segurado e o analógico para ele, e andando para trás sem o R1;
//  • no aberto (fase 1, nada à frente): parada, andando, R1 segurado andando (a postura de empurrar sem nada), R1
//    segurado parada; e a Radhija andando e dando arrancadas (R1).
// Por quadro: game.update, engine.render (1 de cada DRAW quadros é desenhado: o SwiftShader do CI desenhando todos
// deixaria o jogo lento demais para andar), a animação da dog ativa (dogs[n].update), os raios do three.js em cada
// malha (Mesh.raycast: quantos e quanto tempo; vale com o Raycaster e com o atalho nearestHit do pushRest) e as medidas
// novas do desenho empurrado (debug.pushMeasures, quando o jogo tem). Com --profile, o perfil de CPU (CDP) de cada fase, somado por
// função (build sem minificar: os nomes ficam legíveis). A irmã segue, como no jogo.
//   node tools/scripts/measure-push.mjs --dist <pasta do build> --label <nome> [--queries "padrao,dogs=atual"] [--profile]
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
const OUT = resolve(`shots/push/${LABEL}`);
const MOUNT = '/medir/';
const VIEWPORT = { width: 800, height: 450 };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const DRAW = 10;
const RB = 5; // R1
const LB = 4; // L1 (trocar)
/** Os objetos empurrados: fase e id do colisor. */
const PUSHES = [
  { name: 'carrinho', level: 1, id: 'cart' },
  { name: 'caixote', level: 2, id: 'crate' },
  { name: 'ventilador', level: 4, id: 'ventilador' },
];

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

/** Ganchos de medida e o controle falso, só na página de medida (o jogo não muda). */
function probe(DRAW_EVERY) {
  window.__fakePads = [];
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value() { return window.__fakePads; } });
  window.__pad = ({ down = [], axes = [0, 0, 0, 0] } = {}) => {
    const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 }));
    window.__fakePads = [{ id: 'Controle falso', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(), axes, buttons }];
  };
  let api;
  Object.defineProperty(window, '__game', {
    configurable: true, get: () => api,
    set(value) {
      api = value;
      const { engine, game, dogs, THREE } = value;
      engine.renderer.setPixelRatio(0.5);
      engine.composer?.setPixelRatio?.(0.5);
      engine.renderer.shadowMap.enabled = false;
      if (engine.bloom) engine.bloom.enabled = false;
      const M = window.__push = { on: false, frames: [], cur: null, phase: null };
      const fresh = () => ({ rayN: 0, rayMs: 0, animMs: 0, action: null, measures: 0 });
      M.cur = fresh();
      const ray = THREE.Mesh.prototype.raycast;
      THREE.Mesh.prototype.raycast = function (...a) {
        const t0 = performance.now();
        const r = ray.apply(this, a);
        M.cur.rayN++;
        M.cur.rayMs += performance.now() - t0;
        return r;
      };
      let measures = null;
      for (const n of Object.keys(dogs)) {
        const up = dogs[n].update;
        dogs[n].update = function (...a) {
          const t0 = performance.now();
          const r = up.apply(this, a);
          if (n === game.activeDog) {
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
        const pm = game.debug.pushMeasures;
        if (typeof pm === 'number') {
          M.cur.measures = measures === null ? 0 : pm - measures;
          measures = pm;
        }
        if (M.on && M.phase) M.frames.push({ phase: M.phase, u, r: rm, ...M.cur });
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
  for (const ph of [...new Set(frames.map((x) => x.phase))]) {
    const f = frames.filter((x) => x.phase === ph).slice(2); // os dois primeiros quadros da fase são a troca
    const drawn = f.filter((x) => x.r != null).map((x) => x.r);
    const acts = {};
    for (const x of f) acts[x.action] = (acts[x.action] || 0) + 1;
    out[ph] = {
      frames: f.length,
      updateMs: { median: r2(pct(f.map((x) => x.u), 0.5)), p95: r2(pct(f.map((x) => x.u), 0.95)), mean: r2(mean(f.map((x) => x.u))) },
      renderMs: { median: r2(pct(drawn, 0.5)), mean: r2(mean(drawn)) },
      animMs: { mean: r2(mean(f.map((x) => x.animMs))) },
      rays: { perFrame: r2(mean(f.map((x) => x.rayN))), ms: r2(mean(f.map((x) => x.rayMs))), maxMs: r2(Math.max(0, ...f.map((x) => x.rayMs))) },
      measures: f.reduce((a, x) => a + (x.measures || 0), 0),
      updateMaxMs: r2(Math.max(0, ...f.map((x) => x.u))),
      actions: acts,
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
    const extra = q === 'padrao' ? '' : `&${q}`;
    for (const S of [...PUSHES, { name: 'aberto', level: 1, open: true }]) {
      const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      page.setDefaultTimeout(180000);
      page.on('pageerror', (e) => report.errors.push(`${LABEL}/${q}/${S.name}: ${e.message}`));
      await page.addInitScript(probe, DRAW);
      const gameWait = async (sec) => {
        const t0 = await page.evaluate(() => window.__game.game.debug.info().timeSec);
        await page.waitForFunction((t) => window.__game.game.debug.info().timeSec >= t, t0 + sec, { timeout: 180000, polling: 50 });
      };
      /** O analógico (0..1 de força) para a direção do mundo (dx, dz), pela câmera. */
      const stickFor = (dx, dz, k = 1) => page.evaluate(([x, z, m]) => {
        const B = window.__game.game.debug.cam.basis();
        const fwd = x * B.fx + z * B.fz, rgt = x * B.rx + z * B.rz;
        const L = Math.hypot(fwd, rgt) || 1;
        return [(rgt / L) * m, (-fwd / L) * m, 0, 0];
      }, [dx, dz, k]);
      const pad = (o) => page.evaluate((v) => window.__pad(v), o);
      let cdp = null;
      const profiles = {};
      /** Uma fase medida: segura o controle `o` por `sec` s de jogo. */
      const phase = async (name, o, sec) => {
        await page.evaluate((n) => { window.__push.phase = n; }, name);
        if (PROFILE) {
          cdp = cdp || await page.context().newCDPSession(page);
          await cdp.send('Profiler.enable');
          await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
          await cdp.send('Profiler.start');
        }
        await pad(o);
        await gameWait(sec);
        await pad({});
        if (PROFILE) profiles[name] = topFunctions((await cdp.send('Profiler.stop')).profile);
        await page.evaluate(() => { window.__push.phase = null; });
      };
      const load = async () => {
        await page.goto(`${base}?level=${S.level}&play&dog=rhaenyra${extra}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__game?.game?.state === 'playing' && !document.getElementById('loading'), null, { timeout: 180000 });
        await page.waitForTimeout(500);
        await page.evaluate(() => window.__game.game.debug.idle?.setPee?.(false));
      };
      /** Põe a dog `n` (e a irmã atrás dela) em (x, z) olhando para (dx, dz). */
      const place = (n, x, z, dx, dz) => page.evaluate(({ n: name, x: px, z: pz, dx: fx, dz: fz }) => {
        const g = window.__game.game;
        const W = g.debug.world;
        g.debug.teleport(name, px, pz);
        g.debug.ctrls[name].yaw = Math.atan2(fx, fz);
        const other = name === 'radhija' ? 'rhaenyra' : 'radhija';
        for (const [bx, bz] of [[-1.1, 0.5], [-1.1, -0.5], [-1.4, 0], [-0.6, 1.0], [-0.6, -1.0]]) {
          const ox = px + fx * bx + fz * bz, oz = pz + fz * bx - fx * bz;
          if (W.overlaps(ox, oz, g.debug.ctrls[other].r + 0.02, g.debug.ctrls[other].size)) continue;
          g.debug.teleport(other, ox, oz);
          break;
        }
      }, { n, x, z, dx, dz });
      const run = { query: q, scene: S.name, level: S.level };
      try {
        if (!S.open) {
          /** Onde a Rhaenyra fica para empurrar pelo lado (dx, dz), ou null se não cabe. */
          const spot = async (d) => page.evaluate(({ id, d: [dx, dz] }) => {
            const g = window.__game.game;
            const W = g.debug.world;
            const col = W.getDynamic(id);
            if (!col) return { error: `sem o colisor ${id}` };
            const c = g.debug.ctrls.rhaenyra;
            const ext = col.shape === 'box' ? Math.abs(dx) * col.hx + Math.abs(dz) * col.hz : col.r ?? 0.3;
            const x = col.x - dx * (ext + c.r + 0.1), z = col.z - dz * (ext + c.r + 0.1);
            if (W.overlaps(x, z, c.r + 0.02, c.size)) return null;
            return { x, z, col: { x: col.x, z: col.z } };
          }, { id: S.id, d });
          const movedFrom = (p) => page.evaluate(({ id, x, z }) => {
            const col = window.__game.game.debug.world.getDynamic(id);
            return Math.round(Math.hypot(col.x - x, col.z - z) * 100) / 100;
          }, { id: S.id, x: p.col.x, z: p.col.z });
          // acha um lado de onde o empurrão anda (o objeto sai do lugar), numa tentativa curta
          let found = sideOf[S.name] ?? null;
          for (const d of found ? [] : [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            await load();
            const p = await spot(d);
            if (!p || p.error) continue;
            await place('rhaenyra', p.x, p.z, d[0], d[1]);
            await gameWait(0.4);
            await pad({ down: [RB], axes: await stickFor(d[0], d[1]) });
            await gameWait(1.6);
            await pad({});
            if (await movedFrom(p) > 0.08) { found = d; break; }
          }
          if (!found) throw new Error('nenhum lado move o objeto');
          sideOf[S.name] = found;
          run.dir = found;
          await load();
          const p = await spot(found);
          if (!p || p.error) throw new Error(p?.error || 'sem lugar');
          await place('rhaenyra', p.x, p.z, found[0], found[1]);
          await gameWait(0.5);
          await page.evaluate(() => { window.__push.frames = []; window.__push.on = true; });
          await phase('parada', {}, 2.5);
          await phase('empurrando', { down: [RB], axes: await stickFor(found[0], found[1]) }, 3.5);
          await phase('andando', { axes: await stickFor(-found[0], -found[1], 0.6) }, 2.5);
          run.moved = await movedFrom(p);
        } else {
          await load();
          // o lugar mais aberto da fase: nada a 2,2 m em volta
          const o = await page.evaluate(() => {
            const W = window.__game.game.debug.world;
            const b = W.bounds;
            for (const r of [2.4, 2.2, 2.0]) {
              for (let z = b.minZ + r; z <= b.maxZ - r; z += 0.25) {
                for (let x = b.minX + r; x <= b.maxX - r; x += 0.25) if (!W.overlaps(x, z, r, 'large')) return { x, z, r };
              }
            }
            return null;
          });
          if (!o) throw new Error('sem lugar aberto');
          run.open = o;
          const fromCenter = async (n) => { await place(n, o.x - 0.9, o.z, 1, 0); await gameWait(0.4); };
          await fromCenter('rhaenyra');
          await page.evaluate(() => { window.__push.frames = []; window.__push.on = true; });
          await phase('parada', {}, 2.0);
          await phase('andando', { axes: await stickFor(1, 0, 0.6) }, 1.8);
          await fromCenter('rhaenyra');
          await phase('r1-andando', { down: [RB], axes: await stickFor(1, 0, 1) }, 2.2);
          await fromCenter('rhaenyra');
          await phase('r1-parada', { down: [RB] }, 2.0);
          // a Radhija: andando e arrancadas (R1)
          await pad({ down: [LB] });
          await gameWait(0.1);
          await pad({});
          await gameWait(0.3);
          const active = await page.evaluate(() => window.__game.game.activeDog);
          if (active !== 'radhija') throw new Error(`a troca não foi (${active})`);
          await fromCenter('radhija');
          await phase('radhija-andando', { axes: await stickFor(1, 0, 0.6) }, 1.8);
          for (let i = 0; i < 3; i++) {
            await fromCenter('radhija');
            const ax = await stickFor(1, 0, 0.6);
            await page.evaluate(() => { window.__push.phase = 'arrancada'; });
            await pad({ down: [RB], axes: ax });
            await gameWait(0.12);
            await pad({ axes: ax });
            await gameWait(0.6);
            await pad({});
            await page.evaluate(() => { window.__push.phase = null; });
          }
        }
        const frames = await page.evaluate(() => { window.__push.on = false; return window.__push.frames; });
        run.summary = summarize(frames);
        if (PROFILE) run.profiles = profiles;
      } catch (e) {
        run.error = String(e.message || e);
        report.errors.push(`${LABEL}/${q}/${S.name}: ${run.error}`);
      }
      report.runs.push(run);
      await page.close();
      if (run.summary) {
        for (const [ph, s] of Object.entries(run.summary)) {
          console.log(`[push ${LABEL}] ${q.padEnd(10)} ${S.name.padEnd(10)} ${ph.padEnd(16)} update ms mediana ${String(s.updateMs.median).padStart(6)} p95 ${String(s.updateMs.p95).padStart(6)} máx ${String(s.updateMaxMs).padStart(6)} | malhas testadas/quadro ${String(s.rays.perFrame).padStart(7)} (${s.rays.ms} ms; pior quadro ${s.rays.maxMs} ms) | medidas ${s.measures} | animação ${s.animMs.mean} ms | render ${s.renderMs.median} ms | ${s.frames} quadros ${JSON.stringify(s.actions)}`);
          const pf = run.profiles?.[ph];
          if (pf) for (const t of pf.top.slice(0, 10)) console.log(`      ${String(t.ms).padStart(8)} ms ${String(t.pct).padStart(5)}%  ${t.fn}`);
        }
        if (run.moved != null) console.log(`[push ${LABEL}] ${q.padEnd(10)} ${S.name.padEnd(10)} o objeto andou ${run.moved} m`);
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
