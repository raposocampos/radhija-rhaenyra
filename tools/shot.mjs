// Captura de tela headless (Chrome do sistema) + roteiro de ações para testar o jogo.
//
// Uso básico:
//   node tools/shot.mjs --url "http://127.0.0.1:5173/?play" --out shots/a.png --wait 2500
// Com roteiro (JSON com lista de ações):
//   node tools/shot.mjs --url "http://127.0.0.1:5173/?play" --script tools/scripts/x.json
//
// Ações suportadas no roteiro (array JSON):
//   {"type":"wait","ms":500}
//   {"type":"hold","key":"KeyW","ms":1200}          segura tecla (KeyboardEvent.code)
//   {"type":"holdMany","keys":["KeyW","ShiftLeft"],"ms":800}
//   {"type":"press","key":"KeyE"}                   aperta e solta
//   {"type":"down","key":"ShiftLeft"} / {"type":"up","key":"ShiftLeft"}
//   {"type":"click","selector":"#play"}             clique em elemento DOM
//   {"type":"eval","js":"window.__game.game.state"} roda JS e imprime o resultado
//   {"type":"shot","out":"shots/x.png"}              captura
//   {"type":"fps","ms":2000}                         mede quadros por segundo
//
// Opções: --w 1280 --h 720 --wait <ms antes do roteiro/captura> --eval "<js antes da captura>"
// Imprime erros de console/página no final (saída "ERROS:").
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]);
    return acc;
  }, []),
);

const url = args.url || 'http://127.0.0.1:5173/?play';
const width = Number(args.w || 1280);
const height = Number(args.h || 720);
const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = CHROME_PATHS.find((p) => existsSync(p));

const errors = [];
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width, height } });
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[console.${m.type()}] ${m.text()}`);
  if (args.verbose) console.log(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`));

async function shot(out) {
  const p = resolve(out);
  mkdirSync(dirname(p), { recursive: true });
  await page.screenshot({ path: p });
  console.log(`captura: ${p}`);
}

try {
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  // páginas do jogo montam tudo de forma assíncrona: espera o window.__game (sandbox não tem → segue)
  if (!url.includes('/sandbox/')) {
    await page.waitForFunction(() => window.__game?.game, null, { timeout: 30000 }).catch(() => {});
  }
  await page.waitForTimeout(Number(args.wait || 2500));

  const actions = args.script ? JSON.parse(readFileSync(args.script, 'utf8')) : [];
  for (const a of actions) {
    switch (a.type) {
      case 'wait': await page.waitForTimeout(a.ms); break;
      case 'hold':
        await page.keyboard.down(a.key); await page.waitForTimeout(a.ms); await page.keyboard.up(a.key); break;
      case 'holdMany':
        for (const k of a.keys) await page.keyboard.down(k);
        await page.waitForTimeout(a.ms);
        for (const k of a.keys) await page.keyboard.up(k);
        break;
      case 'press': await page.keyboard.press(a.key); break;
      case 'down': await page.keyboard.down(a.key); break;
      case 'up': await page.keyboard.up(a.key); break;
      case 'click': await page.click(a.selector); break;
      case 'eval': {
        const r = await page.evaluate(a.js);
        console.log(`eval: ${JSON.stringify(r)}`);
        break;
      }
      case 'shot': await shot(a.out); break;
      case 'fps': {
        const fps = await page.evaluate((ms) => new Promise((res) => {
          let n = 0; const t0 = performance.now();
          const tick = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res((n * 1000) / (performance.now() - t0)); };
          requestAnimationFrame(tick);
        }), a.ms || 2000);
        console.log(`fps: ${fps.toFixed(1)}`);
        break;
      }
      default: console.log(`ação desconhecida: ${a.type}`);
    }
  }
  if (args.eval) console.log(`eval: ${JSON.stringify(await page.evaluate(args.eval))}`);
  if (args.out) await shot(args.out);
} catch (e) {
  errors.push(`[shot.mjs] ${e.message}`);
} finally {
  await browser.close();
  if (errors.length) {
    console.log(`ERROS (${errors.length}):`);
    for (const e of errors.slice(0, 30)) console.log(e);
  } else console.log('sem erros de console');
}
