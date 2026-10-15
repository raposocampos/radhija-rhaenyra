// Utilitários das partidas automatizadas (Playwright + Chrome do sistema) com TECLAS REAIS.
// Malha fechada: lê a posição por debug.info() e segura WASD (8 direções relativas à câmera).
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function parseArgs(argv = process.argv.slice(2)) {
  return Object.fromEntries(argv.reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]);
    return acc;
  }, []));
}

export async function createHarness({ base, outDir, initScript = null, viewport = { width: 1280, height: 720 } }) {
  const OUT = resolve(outDir);
  mkdirSync(OUT, { recursive: true });
  const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport });
  // Isola os testes de controles REAIS conectados ao Windows (o Chrome headless enxerga XInput):
  // navigator.getGamepads devolve só o controle falso do teste (window.__fakePads), se houver.
  await page.addInitScript(() => {
    window.__fakePads = window.__fakePads || [];
    Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value() { return window.__fakePads; } });
  });
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
  const info = () => page.evaluate(() => window.__game.game.debug.info());
  const ev = (js, arg) => page.evaluate(js, arg);
  const shot = async (name) => {
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
  /** Anda com a dog ativa até (x, z) segurando as teclas reais. */
  async function walkTo(x, z, { tol = 0.22, timeout = 15000, extra = [], stopIf = null } = {}) {
    const t0 = Date.now();
    for (const k of extra) await page.keyboard.down(k);
    let last = null;
    while (Date.now() - t0 < timeout) {
      const i = await info();
      const d = i.dogs[i.activeDog];
      last = d;
      if (i.state !== 'playing') break;
      if (stopIf && stopIf(i)) break;
      const dx = x - d.x;
      const dz = z - d.z;
      const dist = Math.hypot(dx, dz);
      if (dist < tol) break;
      await setKeys(new Set(keysFor(dx, dz)));
      await sleep(dist < 0.6 ? 25 : 45);
      if (dist < 0.6) { await setKeys(new Set()); await sleep(25); }
    }
    await setKeys(new Set());
    for (const k of extra) await page.keyboard.up(k);
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
  async function hold(keys, ms) {
    for (const k of keys) await page.keyboard.down(k);
    await sleep(ms);
    for (const k of [...keys].reverse()) await page.keyboard.up(k);
  }
  async function press(key, after = 120) {
    await page.keyboard.press(key);
    await sleep(after);
  }
  async function load(query) {
    await page.goto(`${base}${query}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__game?.game?.debug?.info, null, { timeout: 120000 });
    await page.waitForFunction(() => window.__game.game.debug.info().timeSec > 0.3 || window.__game.game.state === 'title', null, { timeout: 120000 });
    await readBasis();
    await sleep(1500);
  }
  async function waitFor(pred, { timeout = 10000, step = 80 } = {}) {
    const t0 = Date.now();
    let i = await info();
    while (Date.now() - t0 < timeout) {
      if (pred(i)) return i;
      await sleep(step);
      i = await info();
    }
    return i;
  }
  async function close() {
    await browser.close();
    console.log(`\n${pass} ok, ${fail} falha(s)`);
    if (failures.length) console.log(`falhas: ${failures.join(' | ')}`);
    if (errors.length) { console.log(`ERROS DE CONSOLE (${errors.length}):`); for (const e of errors.slice(0, 20)) console.log(e); } else console.log('sem erros de console');
    return fail;
  }

  return {
    browser, page, errors, check, sleep, info, ev, shot, logOf, clearLog, walkTo, walkPath, hold, press, load, waitFor, close, keysFor, readBasis,
    get pass() { return pass; },
    get fail() { return fail; },
  };
}
