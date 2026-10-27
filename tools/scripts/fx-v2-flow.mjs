// Agente Polimento — teste do fluxo completo de fases na UI (com controle falso via window.__pad).
// Uso: node tools/scripts/fx-v2-flow.mjs [--url http://127.0.0.1:5177/] [--out shots/fx]
// Fluxo: tela inicial → Jogar (fase 1) → Fica → pausa (teclado e controle) → vitória → Próxima fase
//        → transição → cartão da fase 2 → … → fim da demo → Menu inicial (progresso) → navegação por controle.
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5177/');
const OUT = arg('out', 'shots/fx');
mkdirSync(resolve(OUT), { recursive: true });
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));

const browser = await chromium.launch({
  executablePath: exe, headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

// Controle falso: window.__pad = { connected, buttons: bool[17], axes: [x,y,x2,y2] }
await page.addInitScript(() => {
  try { localStorage.removeItem('rr-progress-v1'); } catch (_) {}
  window.__pad = { connected: false, buttons: new Array(17).fill(false), axes: [0, 0, 0, 0] };
  const mk = () => {
    const p = window.__pad;
    if (!p.connected) return [null, null, null, null];
    return [{
      id: 'Fake Xbox Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
      buttons: p.buttons.map((b) => ({ pressed: !!b, touched: !!b, value: b ? 1 : 0 })), axes: p.axes.slice(),
    }, null, null, null];
  };
  Object.defineProperty(navigator, 'getGamepads', { value: mk, configurable: true });
});

const wait = (ms) => page.waitForTimeout(ms);
const ev = (js) => page.evaluate(js);
// captura via CDP (não espera fontes nem animações; funciona logo antes do bloqueio da montagem)
let cdp = null;
const shot = async (name) => {
  const p = resolve(OUT, `${name}.png`);
  cdp ||= await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(p, Buffer.from(data, 'base64'));
  console.log('captura:', p);
};
const info = () => ev(`(() => { const g = window.__game; return { game: g.game.state, ui: g.ui.state, level: g.game.level, curtain: g.ui.curtain, device: g.ui.device, focus: g.ui.focus && (g.ui.focus.dataset.action + (g.ui.focus.dataset.index ?? '')) }; })()`);
async function padPress(btn, hold = 90) {
  await ev(`window.__pad.buttons[${btn}] = true`);
  await wait(hold);
  await ev(`window.__pad.buttons[${btn}] = false`);
  await wait(90);
}
async function waitState(s, ms = 60000) {
  await page.waitForFunction((st) => window.__game?.game?.state === st, s, { timeout: ms });
}
async function forceVictory() {
  // pula para 'carrying' e leva quem carrega até o objetivo
  await ev(`(() => { const g = window.__game.game; g.debug.setStage('carrying'); const i = g.debug.info(); const G = window.__game.layout.GOAL; const who = i.carrier || g.activeDog; g.debug.teleport(who, G.x, G.z); if (who !== g.activeDog) g.debug.teleport(g.activeDog, G.x + 0.3, G.z + 0.3); return who; })()`);
  await waitState('celebrating', 30000);
}

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__game?.game?.state === 'title', null, { timeout: 150000 });
  await wait(2600);
  await shot('v2-01-titulo');

  // Jogar → o mapa das fases; na frente da bandeirinha 1, E → cartão → Começar
  await page.click('.rr-btn--play');
  await page.waitForFunction(() => window.__game.game.isHub && window.__game.game.state === 'playing', null, { timeout: 150000 });
  await wait(1200);
  await shot('v2-02-mapa');
  await page.keyboard.press('KeyE');
  await waitState('intro');
  await page.click('.rr-intro [data-action="start"]');
  await waitState('playing');
  await wait(1900);
  console.log('jogando f1:', JSON.stringify(await info()));
  await page.keyboard.press('KeyF');
  await wait(700);
  await shot('v2-03-hud-companheira');

  // pausa (teclado)
  await page.keyboard.press('Escape');
  await wait(700);
  await shot('v2-04-pausa');
  // controle conectado → ícones de controle, navegação, B fecha
  await ev(`window.__pad.connected = true`);
  await padPress(13); // baixo
  await wait(300);
  console.log('pausa + controle:', JSON.stringify(await info()));
  await shot('v2-05-pausa-controle');
  await padPress(1); // B → continuar
  await wait(500);
  console.log('após B:', JSON.stringify(await info()));
  await wait(400);
  await shot('v2-06-hud-controle');
  // Start pausa e Start retoma (sem dupla ação)
  await padPress(9);
  await wait(250);
  const s1 = (await info()).game;
  await padPress(9);
  await wait(250);
  const s2 = (await info()).game;
  console.log('Start → ', s1, ' Start → ', s2);

  // vitória da fase 1
  await forceVictory();
  await wait(600);
  await shot('v2-07-comemoracao');
  await waitState('victory', 30000);
  await wait(1600);
  await shot('v2-08-vitoria-f1');

  // Próxima fase (A no controle)
  await padPress(0);
  await wait(120);
  await shot('v2-09-transicao-cobrindo');
  await wait(180);
  await shot('v2-10-transicao');
  await waitState('intro', 90000);
  await wait(250);
  await shot('v2-11-transicao-revelando');
  await wait(1600);
  console.log('intro f2:', JSON.stringify(await info()));
  await shot('v2-12-intro-f2');
  await ev(`window.__pad.connected = false`);
  await page.keyboard.press('Enter');
  await waitState('playing');
  await wait(2000);
  await shot('v2-13-hud-f2');
  await forceVictory();
  await waitState('victory', 30000);
  await wait(1600);
  await shot('v2-14-vitoria-f2');
  await page.click('.rr-victory [data-action="next"]');
  await waitState('intro', 90000);
  await wait(1800);
  await shot('v2-15-intro-f3');
  await page.click('.rr-intro [data-action="start"]');
  await waitState('playing');
  await wait(2000);
  await shot('v2-16-hud-f3');
  await forceVictory();
  await waitState('victory', 30000);
  await wait(1800);
  console.log('vitória f3:', JSON.stringify(await info()), await ev(`document.querySelector('.rr-victory').className`));
  await shot('v2-17-fim-da-demo');
  await page.click('.rr-victory [data-action="menu"]');
  await waitState('title', 30000);
  await wait(1500);
  await shot('v2-18-titulo-progresso');
  // seleção com o controle: o foco em Jogar; A → o mapa, na frente da próxima bandeirinha; B (interagir) → o cartão dela
  await ev(`window.__pad.connected = true`);
  await padPress(12);
  await wait(300);
  console.log('foco no título:', JSON.stringify(await info()));
  await shot('v2-19-titulo-controle');
  await padPress(0);
  await page.waitForFunction(() => window.__game.game.isHub && window.__game.game.state === 'playing' && window.__game.game.debug.info().near != null, null, { timeout: 150000 });
  await wait(1200);
  await padPress(1);
  await waitState('intro', 90000);
  await wait(1800);
  console.log('seleção → ', JSON.stringify(await info()));
  await shot('v2-20-intro-controle');
  // progresso salvo
  console.log('progresso:', await ev(`localStorage.getItem('rr-progress-v1')`));
  // sons: toca todos (destravado) e verifica exceções
  const snd = await ev(`(async () => { const a = window.__game.audio; a.unlock(); await new Promise(r => setTimeout(r, 300)); const bad = []; for (const n of a.names) { try { a.play(n, { name: 'radhija', speed: 0.8, count: 2, total: 3, locked: true }); } catch (e) { bad.push(n + ': ' + e.message); } await new Promise(r => setTimeout(r, 40)); } for (const k of ['day','dusk','night']) a.setAmbience(k); return { n: a.names.length, bad, ctx: a.context && a.context.state }; })()`);
  console.log('sons:', JSON.stringify(snd));
  await wait(1500);
} catch (e) {
  errors.push(`[script] ${e.message}`);
  await shot('v2-erro').catch(() => {});
} finally {
  await browser.close();
  console.log(errors.length ? `ERROS (${errors.length}):\n${errors.slice(0, 30).join('\n')}` : 'sem erros de console');
}
