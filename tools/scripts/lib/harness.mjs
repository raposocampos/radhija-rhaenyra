// Utilitários das partidas automatizadas (Playwright + Chrome do sistema) com TECLAS REAIS.
// Malha fechada: lê a posição por debug.info() e segura WASD (8 direções relativas à câmera).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { browserOptions } from './browser.mjs';

export function parseArgs(argv = process.argv.slice(2)) {
  return Object.fromEntries(argv.reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]);
    return acc;
  }, []));
}

export async function createHarness({ base, outDir, initScript = null, viewport = { width: 1280, height: 720 } }) {
  const OUT = resolve(outDir);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(browserOptions());
  const page = await browser.newPage({ viewport });
  // Isola os testes de controles REAIS conectados ao Windows (o Chrome headless enxerga XInput):
  // navigator.getGamepads devolve só o controle falso do teste (window.__fakePads), se houver.
  await page.addInitScript(() => {
    window.__fakePads = window.__fakePads || [];
    Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value() { return window.__fakePads; } });
  });
  if (process.env.CI) {
    // SwiftShader não tem GPU: reduz só o custo visual dos testes, antes do primeiro quadro.
    // A lógica, a entrada, as animações e o WebGL continuam reais; o jogo publicado não muda.
    await page.addInitScript(() => {
      Object.defineProperty(window, '__game', {
        configurable: true,
        set(value) {
          const { renderer, composer, bloom } = value.engine;
          renderer.setPixelRatio(0.25);
          composer.setPixelRatio(0.25);
          renderer.shadowMap.enabled = false;
          bloom.enabled = false;
          // A fase 1 tem milhares de objetos: até em baixa resolução desenhar todo quadro
          // satura a CPU do runner. A simulação/entrada continua em todo rAF; desenha 1/30
          // dos quadros e sempre força um desenho real antes de capturar a tela.
          const render = value.engine.render.bind(value.engine);
          let frame = 0;
          let last = [0, 0];
          value.engine.render = (dt, t) => {
            last = [dt, t];
            if (frame++ % 30 === 0) render(dt, t);
          };
          window.__e2eRender = () => render(...last);
          Object.defineProperty(window, '__game', { value, writable: true, configurable: true });
        },
      });
    });
    console.log('[e2e] CI sem GPU: desenho a cada 30 quadros, resolução 3D reduzida, sem sombras/bloom. Simulação e controles reais a cada quadro.');
    page.setDefaultTimeout(120000);
  }
  if (initScript) await page.addInitScript(initScript);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  let pass = 0;
  let fail = 0;
  const failures = [];
  function check(cond, msg, extra = '') {
    if (cond) pass++; else { fail++; failures.push(msg); }
    console.log(`${cond ? '  ok    ' : '  FALHOU'} ${msg}${extra !== '' ? `  (${typeof extra === 'string' ? extra : JSON.stringify(extra)})` : ''}`);
    return cond;
  }
  const sleep = (ms) => page.waitForTimeout(ms);
  // Razão tempo de jogo / relógio entre leituras seguidas (diagnóstico: < 1 = abaixo de 20 fps, máquina carregada).
  // Também a latência de cada leitura (ida e volta): alta = o próprio teste está sem CPU e as teclas chegam atrasadas.
  const pace = { sim: 0, real: 0, last: null, n: 0, lat: 0, maxLat: 0 };
  const info = async () => {
    const t = Date.now();
    const i = await page.evaluate(() => {
      const r = window.__game.game.debug.info();
      if (window.__walkGuard) r.walkTripped = window.__walkGuard.tripped; // ver walkTo
      return r;
    });
    const now = Date.now();
    pace.n++;
    pace.lat += now - t;
    pace.maxLat = Math.max(pace.maxLat, now - t);
    if (pace.last && typeof i.simSec === 'number' && i.simSec >= pace.last.sim && now - pace.last.real < 2000) {
      pace.sim += i.simSec - pace.last.sim;
      pace.real += (now - pace.last.real) / 1000;
    }
    pace.last = { sim: i.simSec, real: now };
    return i;
  };
  const ev = (js, arg) => page.evaluate(js, arg);
  const shot = async (name) => {
    if (process.env.CI) await page.evaluate(() => window.__e2eRender?.());
    await page.screenshot({ path: resolve(OUT, name) });
    console.log(`  captura: ${outDir.replace(/\\/g, '/')}/${name}`);
  };
  const logOf = (name) => page.evaluate((n) => window.__game.game.debug.events(n).map((e) => e.payload), name);
  const clearLog = () => page.evaluate(() => window.__game.game.debug.clearLog());

  // Base da câmera (lida do layout da fase atual)
  let F = [0, -1];
  let R = [1, 0];
  async function readBasis() {
    const off = await page.evaluate(() => window.__game.layout.CAMERA.offset);
    const L = Math.hypot(off[0], off[2]);
    F = [-off[0] / L, -off[2] / L];
    R = [off[2] / L, -off[0] / L];
  }
  const held = new Set();
  async function setKeys(want) {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k); }
      if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k); }
    }
  }
  function keysFor(dx, dz) {
    const fwd = dx * F[0] + dz * F[1];
    const rgt = dx * R[0] + dz * R[1];
    const a = Math.atan2(rgt, fwd);
    const s = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
    return [['KeyW'], ['KeyW', 'KeyD'], ['KeyD'], ['KeyS', 'KeyD'], ['KeyS'], ['KeyS', 'KeyA'], ['KeyA'], ['KeyW', 'KeyA']][s];
  }
  /** Prazo em tempo de JOGO: vence quando passaram `ms` no relógio E `ms` simulados (debug.info().simSec). Sem carga
   *  as duas coisas andam juntas; sob carga (menos de 20 fps) o jogo anda mais devagar e o prazo espera por ele.
   *  Teto de segurança: `slow`× o prazo em tempo real (a página travada não segura o teste para sempre). */
  function deadline(ms, { slow = 8 } = {}) {
    const t0 = Date.now();
    let s0 = null;
    return {
      t0,
      over(i) {
        const real = Date.now() - t0;
        // Até uma espera de 110 ms precisa tolerar a compilação/desenho de um quadro
        // pesado por software; não solte o botão antes de a página conseguir lê-lo.
        if (real >= Math.max(10000, ms * slow)) return true;
        const sim = i?.simSec;
        if (typeof sim !== 'number') return real >= ms;
        if (s0 === null || sim < s0) s0 = sim; // primeira leitura (ou página recarregada)
        return real >= ms && (sim - s0) * 1000 >= ms;
      },
    };
  }
  /** Anda com a dog ativa até (x, z) segurando as teclas reais. */
  async function walkTo(x, z, { tol = 0.22, timeout = 15000, extra = [], stopIf = null } = {}) {
    const dl = deadline(timeout);
    // Trava dentro da página: com WASD segurado longe do alvo, solta as teclas NO QUADRO em que a dog entra na zona de
    // aproximação (0,6 m) ou passa a se afastar do alvo. Sob carga, a leitura seguinte (e o keyup) pode levar segundos
    // e a dog corria metros além do ponto.
    await page.evaluate(({ x: tx, z: tz }) => {
      const g = window.__game.game;
      const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
      const dist = () => { const c = g.debug.ctrls[g.activeDog]; return Math.hypot(tx - c.x, tz - c.z); };
      const w = { tripped: false, armed: false, min: Infinity, down: new Set() };
      w.onDown = (e) => {
        if (!MOVE.includes(e.code)) return;
        w.down.add(e.code);
        const d = dist();
        if (d >= 0.6) { w.armed = true; w.tripped = false; w.min = d; }
      };
      w.onUp = (e) => { w.down.delete(e.code); };
      addEventListener('keydown', w.onDown);
      addEventListener('keyup', w.onUp);
      window.__walkGuard = w;
      const loop = () => {
        if (window.__walkGuard !== w) {
          removeEventListener('keydown', w.onDown);
          removeEventListener('keyup', w.onUp);
          return;
        }
        if (w.armed && w.down.size) {
          const d = dist();
          w.min = Math.min(w.min, d);
          if (d < 0.6 || d > w.min + 0.25) {
            for (const code of [...w.down]) window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
            w.armed = false;
            w.tripped = true;
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }, { x, z });
    for (const k of extra) await page.keyboard.down(k);
    let last = null;
    for (;;) {
      const i = await info();
      if (i.walkTripped) await setKeys(new Set()); // a trava soltou na página: solta as teclas reais também
      if (dl.over(i)) break;
      const d = i.dogs[i.activeDog];
      last = d;
      if (i.state !== 'playing') break;
      if (stopIf && stopIf(i)) break;
      const dx = x - d.x;
      const dz = z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist < tol) break;
      if (dist < 0.6) {
        // perto: toque curto que a própria página solta ao chegar (ou ao passar do alvo), sem depender da latência
        await setKeys(new Set());
        await holdUntil(keysFor(dx, dz), (s, a) => {
          const p = s.dogs[s.activeDog];
          const ex = a.x - p.x;
          const ez = a.z - p.z;
          return Math.hypot(ex, ez) < a.tol * 0.6 || ex * a.dx + ez * a.dz <= 0;
        }, { timeout: 60, arg: { x, z, tol, dx, dz } });
        await sleep(25);
        continue;
      }
      await setKeys(new Set(keysFor(dx, dz)));
      await sleep(45);
    }
    await setKeys(new Set());
    for (const k of extra) await page.keyboard.up(k);
    await page.evaluate(() => { window.__walkGuard = null; });
    await sleep(120);
    const i = await info();
    return i.dogs[i.activeDog] || last;
  }
  /** Percorre uma lista de pontos. */
  async function walkPath(points, opts = {}) {
    let d = null;
    for (const [x, z, o] of points) d = await walkTo(x, z, { ...opts, ...(o || {}) });
    return d;
  }
  /** Segura as teclas por `ms` de tempo de JOGO, soltas pela própria página (ver holdUntil): sob carga, nem o relógio
   *  nem o keyup do teste servem de medida (a dog deslizava além da ponta da cerca-viva no cantinho da fase 3). */
  async function hold(keys, ms) {
    await holdUntil(keys, () => false, { timeout: ms });
  }
  /** Segura as teclas (reais) até `pred(info(), arg)` virar verdade, conferida QUADRO A QUADRO dentro da página, que
   *  solta as teclas no mesmo quadro (keyup na janela, como o do teclado). Sob carga, o keyup do Playwright chega
   *  centenas de ms depois e o caixote/dog passava do ponto. `pred` é serializada (só pode usar `arg`).
   *  Prazo em tempo de jogo (`timeout` ms). Devolve o info() do fim. */
  async function holdUntil(keys, pred, { timeout = 8000, arg = null, during = null } = {}) {
    await page.evaluate(({ src, keys: ks, arg: a, ms }) => {
      const fn = new Function(`return (${src})`)();
      const g = window.__game.game;
      const h = { done: false, ok: false, t0: null };
      window.__hold = h;
      // o prazo e a condição só contam depois que os keydown reais chegaram à página
      const seen = new Set();
      const onDown = (e) => { if (ks.includes(e.code)) seen.add(e.code); };
      addEventListener('keydown', onDown);
      const loop = () => {
        const i = g.debug.info();
        if (seen.size === ks.length) {
          if (h.t0 === null) h.t0 = i.simSec;
          let ok = false;
          try { ok = !!fn(i, a); } catch {}
          if (ok || (i.simSec - h.t0) * 1000 >= ms) {
            for (const code of [...ks].reverse()) window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
            removeEventListener('keydown', onDown);
            h.ok = ok;
            h.done = true;
            return;
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }, { src: pred.toString(), keys, arg, ms: timeout });
    for (const k of keys) await page.keyboard.down(k);
    if (during) await during(); // ex.: um toque de Shift (arrancada) com as teclas seguradas
    await page.waitForFunction(() => window.__hold.done, null, { polling: 30, timeout: Math.max(5000, timeout * 8) }).catch(() => {});
    for (const k of [...keys].reverse()) await page.keyboard.up(k);
    return info();
  }
  async function press(key, after = 120) {
    await page.keyboard.press(key);
    await (process.env.CI ? gsleep : sleep)(after);
  }
  async function load(query) {
    await page.goto(`${base}${query}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__game?.game?.debug?.info, null, { timeout: 120000 });
    await page.waitForFunction(() => window.__game.game.debug.info().timeSec > 0.3 || window.__game.game.state === 'title', null, { timeout: 120000 });
    await readBasis();
    await (process.env.CI ? gsleep : sleep)(1500);
  }
  /** Espera `pred(info())` virar verdade; o prazo conta em tempo de JOGO (ver `deadline`). Devolve o último info(). */
  async function waitFor(pred, { timeout = 10000, step = 80 } = {}) {
    const dl = deadline(timeout);
    let i = await info();
    while (!pred(i) && !dl.over(i)) {
      await sleep(step);
      i = await info();
    }
    return i;
  }
  /** Espera `ms` de tempo de JOGO (o quadro limita dt a 1/20 s: abaixo de 20 fps o jogo anda mais devagar que o relógio). */
  async function gsleep(ms) {
    const dl = deadline(ms);
    for (;;) {
      const i = await info();
      if (dl.over(i)) return i;
      await sleep(Math.min(40, Math.max(10, ms - (Date.now() - dl.t0))));
    }
  }
  /** Gravação quadro a quadro na página: `sample(game)` roda em todo requestAnimationFrame (depois do quadro do jogo).
   *  `sample` é serializada (não pode usar variáveis de fora). `stop()` devolve a lista. Para eventos curtos ou
   *  saltos de posição, que a leitura por info() (uma ida e volta por amostra) perde quando a máquina está carregada. */
  async function record(sample) {
    await page.evaluate((src) => {
      const fn = new Function(`return (${src})`)();
      const rec = { on: true, frames: [] };
      window.__rec = rec;
      const loop = () => {
        if (!rec.on) return;
        try { rec.frames.push(fn(window.__game.game)); } catch (e) { rec.frames.push({ error: String(e) }); }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }, sample.toString());
    return {
      stop: () => page.evaluate(() => { window.__rec.on = false; return window.__rec.frames; }),
    };
  }
  async function close() {
    await browser.close();
    if (pace.real > 0) {
      console.log(`\nritmo do jogo: ${(pace.sim / pace.real).toFixed(2)}× o relógio (abaixo de 1 = menos de 20 fps); `
        + `leitura do estado: ${Math.round(pace.lat / pace.n)} ms em média, ${pace.maxLat} ms no pior caso`);
    }
    console.log(`\n${pass} ok, ${fail} falha(s)`);
    if (failures.length) console.log(`falhas: ${failures.join(' | ')}`);
    if (errors.length) { console.log(`ERROS DE CONSOLE (${errors.length}):`); for (const e of errors.slice(0, 20)) console.log(e); } else console.log('sem erros de console');
    return fail;
  }

  return {
    browser, page, errors, check, sleep, gsleep, info, ev, shot, logOf, clearLog, walkTo, walkPath, hold, holdUntil, press, load, waitFor, record, close, keysFor, readBasis,
    // As suítes antigas também esperam o tempo simulado no runner sem GPU.
    ...(process.env.CI ? { sleep: gsleep } : {}),
    get pass() { return pass; },
    get fail() { return fail; },
  };
}
