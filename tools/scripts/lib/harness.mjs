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

/** Tetos de RELÓGIO (ms). As esperas continuam contando em tempo de jogo enquanto o jogo anda, mesmo devagar; estes
 *  limites só existem para que uma aba travada ou um jogo parado reprove a suíte em segundos, com diagnóstico, em vez
 *  de prender o job até o timeout do workflow. Ajuste por variável de ambiente ou por `createHarness({ limits })`. */
export const DEFAULT_LIMITS = {
  wallFactor: 8, // E2E_WALL_FACTOR: cada espera de `ms` de jogo vence em max(wallMinMs, wallFactor × ms) de relógio
  wallMinMs: 10000, // E2E_WALL_MIN_MS
  stallMs: 30000, // E2E_STALL_MS: simSec sem mudar por esse tempo de relógio = o jogo parou de avançar
  evalMs: 60000, // E2E_EVAL_MS: cada ida ao navegador (info(), page.evaluate, teclado, mouse)
  closeMs: 30000, // E2E_CLOSE_MS: fechar o navegador no fim
};
const LIMIT_ENV = { wallFactor: 'E2E_WALL_FACTOR', wallMinMs: 'E2E_WALL_MIN_MS', stallMs: 'E2E_STALL_MS', evalMs: 'E2E_EVAL_MS', closeMs: 'E2E_CLOSE_MS' };
function limitsFrom(overrides) {
  const out = {};
  for (const [key, name] of Object.entries(LIMIT_ENV)) {
    const raw = overrides[key] ?? process.env[name];
    const value = raw === undefined || raw === '' ? DEFAULT_LIMITS[key] : Number(raw);
    if (!(value > 0)) throw new Error(`limite do harness inválido: ${key} (${name}) = ${raw}`);
    out[key] = value;
  }
  return out;
}

/** Espera ou ida ao navegador que venceu o teto de relógio. A suíte não deve seguir: a página travou ou o jogo parou. */
export class HarnessAbort extends Error {
  constructor(message) {
    super(`[harness] ${message}`);
    this.name = 'HarnessAbort';
  }
}
const secs = (ms) => `${+(ms / 1000).toFixed(1)} s`;
const snippet = (fn) => String(fn).replace(/\s+/g, ' ').slice(0, 90);
/** Linha da suíte que pediu a espera: o primeiro quadro da pilha fora deste arquivo. */
function siteOf(err) {
  for (const line of String(err.stack).split('\n').slice(1)) {
    const m = line.match(/([^\s()]+):(\d+):\d+\)?\s*$/);
    if (m && m[1] !== import.meta.url && !m[1].startsWith('node:')) return `${m[1].split(/[\\/]/).pop()}:${m[2]}`;
  }
  return null;
}
function describe(i) {
  if (!i) return 'nenhuma';
  const d = i.dogs?.[i.activeDog];
  const dog = d ? ` ${i.activeDog}(${Number(d.x).toFixed(2)}, ${Number(d.z).toFixed(2)})` : '';
  return `estado=${i.state} fase=${i.levelId ?? i.level} etapa=${i.stage} timeSec=${i.timeSec} simSec=${i.simSec}${dog}`;
}

/** device: opções extras da página do Playwright (ex.: celular: isMobile, hasTouch, deviceScaleFactor, screen).
 *  limits: tetos de relógio (ver DEFAULT_LIMITS). */
export async function createHarness({ base, outDir, initScript = null, viewport = { width: 1280, height: 720 }, device = {}, limits: limitOverrides = {} }) {
  const limits = limitsFrom(limitOverrides);
  const OUT = resolve(outDir);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(browserOptions());
  const page = await browser.newPage({ viewport, ...device });
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
          const lowGfx = () => {
            renderer.setPixelRatio(0.25);
            composer.setPixelRatio(0.25);
            renderer.shadowMap.enabled = false;
            bloom.enabled = false;
          };
          lowGfx();
          // uma troca de qualidade (menu ou governador do celular) reaplica o perfil: volta à redução do teste
          value.events?.on?.('quality:change', lowGfx);
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

  // ---- Teto de relógio em cada ida ao navegador. page.evaluate e a entrada do Playwright não têm prazo: com a aba
  // (ou a GPU) travada, a promessa nunca volta e a suíte ficava parada até o timeout do workflow. Vencido o teto, a
  // página fica marcada como travada e as idas seguintes falham na hora (o catch da suíte e o close() terminam rápido).
  let wedged = null; // primeira operação sem resposta
  let lastRead = null; // { i, at }: última leitura do estado que voltou (diagnóstico)
  const aborts = []; // mensagens dos HarnessAbort: o close() reprova as que a suíte não registrou
  const lastReadText = () => (lastRead ? `Última leitura do estado, há ${secs(Date.now() - lastRead.at)}: ${describe(lastRead.i)}` : 'Nenhuma leitura do estado ainda.');
  function abort(what, site, why) {
    const e = new HarnessAbort(`${what}${site ? ` (${site})` : ''}: ${why}`);
    aborts.push(e.message);
    return e;
  }
  const TIMEOUT = Symbol('timeout');
  async function guard(what, start, ms = limits.evalMs) {
    const site = new Error();
    if (wedged) throw new HarnessAbort(`${what} não executado: a página já estava travada (${wedged})`);
    const op = Promise.resolve().then(start);
    let timer;
    try {
      return await Promise.race([op, new Promise((_, fail) => { timer = setTimeout(fail, ms, TIMEOUT); })]);
    } catch (e) {
      if (e !== TIMEOUT) throw e;
      op.catch(() => {}); // a resposta tardia (ou o erro ao fechar o navegador) não vira rejeição solta
      wedged = `${what} ficou ${secs(ms)} sem resposta`;
      throw abort(what, siteOf(site), `a página não respondeu em ${secs(ms)} (page.evaluate/entrada sem retorno: aba ou GPU travada?). ${lastReadText()}`);
    } finally {
      clearTimeout(timer);
    }
  }
  const rawEvaluate = page.evaluate.bind(page);
  const evaluate = (what, fn, arg) => guard(what, () => rawEvaluate(fn, arg));
  // As suítes também usam a página direto (ev, page.keyboard.*): o mesmo teto vale para elas.
  page.evaluate = (fn, arg) => evaluate(`page.evaluate(${snippet(fn)})`, fn, arg);
  for (const [name, obj, methods] of [['keyboard', page.keyboard, ['down', 'up', 'press']], ['mouse', page.mouse, ['move', 'down', 'up', 'click']], ['touchscreen', page.touchscreen, ['tap']]]) {
    for (const m of methods) {
      const raw = obj[m].bind(obj);
      obj[m] = (...a) => guard(`${name}.${m}(${a.filter((x) => typeof x !== 'object').join(', ')})`, () => raw(...a), limits.evalMs + (a.at(-1)?.delay || 0));
    }
  }

  // Razão tempo de jogo / relógio entre leituras seguidas (diagnóstico: < 1 = abaixo de 20 fps, máquina carregada).
  // Também a latência de cada leitura (ida e volta): alta = o próprio teste está sem CPU e as teclas chegam atrasadas.
  const pace = { sim: 0, real: 0, last: null, n: 0, lat: 0, maxLat: 0 };
  /** Lê debug.info(); `what` nomeia a espera no diagnóstico; `withHold` traz também o estado do holdUntil (`__hold`). */
  const read = async (what = 'info()', withHold = false) => {
    const t = Date.now();
    const i = await evaluate(what, (wh) => {
      const r = window.__game.game.debug.info();
      if (window.__walkGuard) r.walkTripped = window.__walkGuard.tripped; // ver walkTo
      if (wh && window.__hold) r.__hold = { done: window.__hold.done, seen: window.__hold.seen.size, of: window.__hold.of };
      return r;
    }, withHold);
    const now = Date.now();
    lastRead = { i, at: now };
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
  const info = () => read();
  const ev = (js, arg) => page.evaluate(js, arg);
  const shot = async (name) => {
    if (wedged) throw new HarnessAbort(`shot(${name}) não executado: a página já estava travada (${wedged})`);
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
   *  Tetos de RELÓGIO (`limits`): a espera reprova a suíte (HarnessAbort, com a espera, a linha e a última leitura) se
   *  o simSec ficar `stallMs` sem mudar (o jogo parou) ou se passar de max(wallMinMs, wallFactor × ms) de relógio
   *  (o jogo anda devagar demais). Até uma espera de 110 ms tolera a compilação/desenho de um quadro pesado por
   *  software: o mínimo de 10 s não solta o botão antes de a página conseguir lê-lo.
   *  over(i): o prazo de jogo venceu? wall(i, extra): só confere os tetos. */
  function deadline(ms, what) {
    const site = new Error();
    const t0 = Date.now();
    const cap = Math.max(limits.wallMinMs, ms * limits.wallFactor);
    let s0 = null;
    let lastSim = null;
    let movedAt = t0;
    const track = (sim, now) => {
      if (s0 === null || sim < s0) s0 = sim; // primeira leitura (ou página recarregada)
      if (sim !== lastSim) {
        lastSim = sim;
        movedAt = now;
      }
    };
    const checkWall = (i, now, extra) => {
      const real = now - t0;
      const still = now - movedAt;
      if (still < limits.stallMs && real < cap) return;
      const played = i.simSec - s0;
      const why = typeof i.simSec !== 'number' ? 'o teto de relógio venceu (info() sem simSec)'
        : played <= 0 || still >= limits.stallMs ? `o jogo parou de avançar (simSec ${i.simSec} sem mudar há ${secs(still)})`
          : `o jogo anda devagar demais: ${played.toFixed(2)} s de jogo em ${secs(real)} de relógio (ritmo ${(played / (real / 1000)).toFixed(3)}×)`;
      throw abort(what, siteOf(site), `${why}; prazo pedido ${secs(ms)} de jogo, teto de relógio ${secs(cap)}${extra}. Última leitura: ${describe(i)}`);
    };
    return {
      t0,
      over(i) {
        const now = Date.now();
        const sim = i?.simSec;
        if (typeof sim !== 'number') return now - t0 >= ms;
        track(sim, now);
        if (now - t0 >= ms && (sim - s0) * 1000 >= ms) return true;
        checkWall(i, now, '');
        return false;
      },
      wall(i, extra = '') {
        const now = Date.now();
        if (typeof i?.simSec === 'number') track(i.simSec, now);
        else movedAt = now; // sem simSec não há como ver o jogo parado: só o teto de relógio vale
        checkWall(i ?? {}, now, extra);
      },
    };
  }
  /** Anda com a dog ativa até (x, z) segurando as teclas reais. */
  async function walkTo(x, z, { tol = 0.22, timeout = 15000, extra = [], stopIf = null } = {}) {
    const what = `walkTo(${x}, ${z})`;
    const dl = deadline(timeout, what);
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
    const release = async () => {
      await setKeys(new Set());
      for (const k of extra) await page.keyboard.up(k);
      await page.evaluate(() => { window.__walkGuard = null; });
    };
    let last = null;
    try {
      for (const k of extra) await page.keyboard.down(k);
      for (;;) {
        const i = await read(what);
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
          }, { timeout: 60, arg: { x, z, tol, dx, dz }, label: `${what}, aproximação final` });
          await sleep(25);
          continue;
        }
        await setKeys(new Set(keysFor(dx, dz)));
        await sleep(45);
      }
    } catch (e) {
      await release().catch(() => {}); // espera abortada: não deixa WASD segurado (com a página travada, falha na hora)
      throw e;
    }
    await release();
    await sleep(120);
    const i = await read(what);
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
    await holdUntil(keys, () => false, { timeout: ms, label: `hold([${keys}], ${ms} ms)` });
  }
  /** Segura as teclas (reais) até `pred(info(), arg)` virar verdade, conferida QUADRO A QUADRO dentro da página, que
   *  solta as teclas no mesmo quadro (keyup na janela, como o do teclado). Sob carga, o keyup do Playwright chega
   *  centenas de ms depois e o caixote/dog passava do ponto. `pred` é serializada (só pode usar `arg`).
   *  Prazo em tempo de jogo (`timeout` ms), com os tetos de relógio do `deadline`. Devolve o info() do fim. */
  async function holdUntil(keys, pred, { timeout = 8000, arg = null, during = null, label = null } = {}) {
    const what = label || `holdUntil([${keys}], ${snippet(pred)}, ${timeout} ms)`;
    await page.evaluate(({ src, keys: ks, arg: a, ms }) => {
      const fn = new Function(`return (${src})`)();
      const g = window.__game.game;
      // o prazo e a condição só contam depois que os keydown reais chegaram à página
      const seen = new Set();
      const h = { done: false, ok: false, t0: null, seen, of: new Set(ks).size };
      window.__hold = h;
      const onDown = (e) => { if (ks.includes(e.code)) seen.add(e.code); };
      addEventListener('keydown', onDown);
      const loop = () => {
        const i = g.debug.info();
        if (seen.size === h.of) {
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
    const release = async () => { for (const k of [...keys].reverse()) await page.keyboard.up(k); };
    try {
      for (const k of keys) await page.keyboard.down(k);
      if (during) await during(); // ex.: um toque de Shift (arrancada) com as teclas seguradas
      // a página solta as teclas sozinha; aqui só se espera ela terminar, com os tetos de relógio
      const dl = deadline(timeout, what);
      for (;;) {
        const i = await read(what, true);
        const h = i.__hold;
        if (!h || h.done) break;
        dl.wall(i, `; teclas que chegaram à página: ${h.seen} de ${h.of}`);
        await sleep(30);
      }
    } catch (e) {
      await release().catch(() => {});
      throw e;
    }
    await release();
    return info();
  }
  async function press(key, after = 120) {
    await page.keyboard.press(key);
    await (process.env.CI ? gsleep : sleep)(after);
  }
  /** Estado do jogo agora, para o diagnóstico de uma etapa que venceu: no máximo 5 s, sem marcar a página como travada. */
  async function peek() {
    let timer;
    const reading = rawEvaluate(() => window.__game?.game?.debug?.info?.() ?? null)
      .then((i) => (i ? `estado agora: ${describe(i)}` : 'window.__game ainda não existe'), (e) => `a leitura do estado falhou: ${String(e.message).split('\n')[0]}`);
    reading.finally(() => clearTimeout(timer)).catch(() => {});
    return Promise.race([reading, new Promise((done) => { timer = setTimeout(done, 5000, 'a página não respondeu à leitura do estado em 5 s'); })]);
  }
  async function load(query) {
    const what = `load('${query}')`;
    const step = async (stage, run) => {
      const site = new Error();
      try {
        return await run();
      } catch (e) {
        if (e instanceof HarnessAbort) throw e;
        throw abort(what, siteOf(site), `${stage}: ${String(e.message).split('\n')[0]}; ${await peek()}`);
      }
    };
    await step('abrir a página', () => page.goto(`${base}${query}`, { waitUntil: 'load', timeout: 120000 }));
    await step('esperar window.__game', () => page.waitForFunction(() => window.__game?.game?.debug?.info, null, { timeout: 120000 }));
    await step('esperar o jogo começar (timeSec > 0,3 ou título)', () => page.waitForFunction(() => window.__game.game.debug.info().timeSec > 0.3 || window.__game.game.state === 'title', null, { timeout: 120000 }));
    await readBasis();
    await (process.env.CI ? gsleep : sleep)(1500);
  }
  /** Espera `pred(info())` virar verdade; o prazo conta em tempo de JOGO (ver `deadline`). Devolve o último info(). */
  async function waitFor(pred, { timeout = 10000, step = 80 } = {}) {
    const what = `waitFor(${snippet(pred)}, ${timeout} ms)`;
    const dl = deadline(timeout, what);
    let i = await read(what);
    while (!pred(i) && !dl.over(i)) {
      await sleep(step);
      i = await read(what);
    }
    return i;
  }
  /** Espera `ms` de tempo de JOGO (o quadro limita dt a 1/20 s: abaixo de 20 fps o jogo anda mais devagar que o relógio). */
  async function gsleep(ms) {
    const what = `gsleep(${ms} ms)`;
    const dl = deadline(ms, what);
    for (;;) {
      const i = await read(what);
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
    let timer;
    const closed = await Promise.race([
      browser.close().then(() => true),
      new Promise((done) => { timer = setTimeout(done, limits.closeMs, false); }),
    ]);
    clearTimeout(timer);
    if (!closed) {
      aborts.push(`[harness] o navegador não fechou em ${secs(limits.closeMs)}`);
      // a conexão presa seguraria o processo da suíte; o Playwright encerra o navegador filho na saída
      setTimeout(() => process.exit(process.exitCode || 1), 2000).unref();
    }
    if (pace.real > 0) {
      console.log(`\nritmo do jogo: ${(pace.sim / pace.real).toFixed(2)}× o relógio (abaixo de 1 = menos de 20 fps); `
        + `leitura do estado: ${Math.round(pace.lat / pace.n)} ms em média, ${pace.maxLat} ms no pior caso`);
    }
    // Uma espera abortada reprova mesmo que a suíte tenha engolido a exceção.
    for (const m of aborts) {
      if (failures.some((f) => f.includes(m))) continue;
      fail++;
      failures.push(m);
      console.log(`  FALHOU ${m}`);
    }
    // Erros do navegador são falhas mesmo quando todas as asserções da partida passaram.
    // Mantém o contrato numérico de close(), usado pelos processos das nove suítes.
    const totalFailures = fail + errors.length;
    console.log(`\n${pass} ok, ${totalFailures} falha(s)`);
    if (failures.length) console.log(`falhas: ${failures.join(' | ')}`);
    if (errors.length) { console.log(`ERROS DE CONSOLE (${errors.length}):`); for (const e of errors.slice(0, 20)) console.log(e); } else console.log('sem erros de console');
    return totalFailures;
  }

  return {
    browser, page, errors, limits, check, sleep, gsleep, info, ev, shot, logOf, clearLog, walkTo, walkPath, hold, holdUntil, press, load, waitFor, record, close, keysFor, readBasis,
    // As suítes antigas também esperam o tempo simulado no runner sem GPU.
    ...(process.env.CI ? { sleep: gsleep } : {}),
    get pass() { return pass; },
    get fail() { return fail; },
  };
}
