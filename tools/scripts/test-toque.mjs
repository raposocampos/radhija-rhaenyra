// Celular (suíte 'toque'): Chromium emulando um celular deitado (844×390, DPR 3, toque, isMobile) e DEDOS REAIS pelo
// protocolo do navegador (Input.dispatchTouchEvent → touch + pointer events, como num celular de verdade).
// Confere o perfil de qualidade do celular, os controles que só aparecem depois de um toque, o layout compacto sem
// sobreposição com o HUD, um trecho da fase 1 jogado só com o joystick e os botões virtuais (abertura, cordinha,
// troca, carrinho empurrado com dois dedos, cenoura), multitoque, dicas com ícones de toque, menu de qualidade,
// aviso de girar o celular, volta ao teclado e o cartão de abertura. No fim, uma página de PC (sem toque) confirma
// que lá nada mudou (perfil 'alta' com os valores de sempre, sem controles de toque).
//   node tools/scripts/test-toque.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const PHONE = { width: 844, height: 390 };
const H = await createHarness({
  base: BASE,
  outDir: 'shots/toque',
  viewport: PHONE,
  device: {
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, screen: PHONE,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  },
});
const { page, check, sleep, info, ev, shot, logOf, clearLog, load, waitFor } = H;

// ---------- dedos (CDP) ----------
const cdp = await page.context().newCDPSession(page);
const fingers = new Map();
async function sendTouch(type) {
  const touchPoints = type === 'touchEnd' ? [] : [...fingers].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 8, radiusY: 8, force: 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
}
const finger = {
  async down(id, x, y) { fingers.set(id, { x, y }); await sendTouch('touchStart'); },
  async move(id, x, y) { fingers.set(id, { x, y }); await sendTouch('touchMove'); },
  /** Levanta o último dedo na tela (o protocolo só solta todos de uma vez: touchEnd sem pontos). */
  async up(id) {
    if (!fingers.delete(id)) return;
    if (fingers.size) throw new Error('finger.up com outro dedo na tela: use liftOne');
    await sendTouch('touchEnd');
  },
  /**
   * Levanta UM dedo com outros na tela. O protocolo do navegador não solta um ponto sozinho (só touchEnd, que
   * solta todos): o dedo sobe por um pointerup do próprio ponteiro (o id real, lido no pointerdown), como a trava
   * de teclas usa keyup. O protocolo ainda o considera na tela até o próximo upAll, e o jogo ignora o resto.
   */
  async liftOne(sel) {
    await ev((s) => {
      const b = document.querySelector(s);
      b.dispatchEvent(new PointerEvent('pointerup', { pointerId: window.__lastPointer, pointerType: 'touch', bubbles: true, isPrimary: false }));
    }, sel);
  },
  async upAll() { fingers.clear(); await sendTouch('touchEnd'); },
};
/** Centro e tamanho de um elemento visível (ou null). */
const rect = (sel) => ev((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}, sel);
async function tap(sel, { id = 9, hold = 90 } = {}) {
  const r = await rect(sel);
  if (!r) throw new Error(`sem elemento ${sel}`);
  await finger.down(id, r.x, r.y);
  await sleep(hold);
  await finger.up(id);
  await sleep(150);
}
const uiState = () => ev(() => {
  const root = document.querySelector('.rr');
  const touch = document.querySelector('.rr-touch');
  return { device: root.dataset.device, mobile: root.dataset.mobile ?? null, dog: root.dataset.dog, touchOn: touch.classList.contains('is-on'), ui: window.__game.ui.touch.state() };
});
const quality = () => ev(() => {
  const { engine, THREE } = window.__game;
  const q = engine.quality;
  return {
    device: q.device, mode: q.mode, level: q.level, adaptive: q.adaptive, state: engine.qualityState,
    shadow: engine.sun.shadow.mapSize.x, soft: engine.renderer.shadowMap.type === THREE.PCFSoftShadowMap,
    samples: engine.composer.renderTarget1.samples, stored: localStorage.getItem('rr-quality'),
    sky: engine.sky.renderOrder, everyFrame: engine.renderer.shadowMap.autoUpdate, cap: q.capFps, lowGpu: q.lowGpu,
  };
});
/** Texto visível de um botão de toque (o CSS esconde o rótulo da outra cachorrinha). */
const label = (id) => ev((i) => document.querySelector(`.rr-tbtn[data-touch="${i}"] .rr-tbtn__label`).innerText.trim(), id);
/** Glifo do dispositivo atual dentro de `sel`: qual das três versões aparece. */
const glyphShown = (sel) => ev((s) => {
  const g = document.querySelector(`${s} .rr-g`);
  if (!g) return null;
  const vis = (c) => { const e = g.querySelector(c); return !!e && getComputedStyle(e).display !== 'none'; };
  const tg = [...g.querySelectorAll('.k-touch .rr-tg')].map((e) => e.className.replace('rr-tg rr-tg--', ''));
  return { kb: vis('.k-kb'), pad: vis('.k-pad'), touch: vis('.k-touch'), tg };
}, sel);
const overlaps = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const inView = (r, vw = PHONE.width, vh = PHONE.height) => r && r.left >= 0 && r.top >= 0 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5;

// ---------- joystick em malha fechada ----------
let ring = null;
/** Anda até (x, z) só com o joystick virtual. A página solta o joystick no quadro em que a dog chega (ou passa). */
async function stickWalkTo(x, z, { tol = 0.22, timeout = 20000 } = {}) {
  ring = ring || await rect('.rr-touch__stick');
  const travel = (ring.w / 2) * 0.72;
  const B = await ev(() => window.__game.game.debug.cam.basis());
  const t0 = Date.now();
  for (let attempt = 0; attempt < 8; attempt++) {
    let i = await info();
    let d = i.dogs[i.activeDog];
    let dist = Math.hypot(x - d.x, z - d.z);
    if (dist < tol || i.state !== 'playing') break;
    await ev(({ x: tx, z: tz, tol: tl }) => {
      const g = window.__game.game;
      const t = window.__game.ui.touch;
      const w = { tripped: false, min: Infinity };
      window.__stickGuard = w;
      const loop = () => {
        if (window.__stickGuard !== w) return;
        const c = g.debug.ctrls[g.activeDog];
        const dd = Math.hypot(tx - c.x, tz - c.z);
        w.min = Math.min(w.min, dd);
        if (t.stickActive && (dd < tl * 0.7 || dd > w.min + 0.2)) { t.releaseStick(); w.tripped = true; return; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }, { x, z, tol });
    await finger.down(1, ring.x, ring.y);
    for (;;) {
      i = await info();
      d = i.dogs[i.activeDog];
      const dx = x - d.x;
      const dz = z - d.z;
      dist = Math.hypot(dx, dz);
      const tripped = await ev(() => window.__stickGuard?.tripped);
      if (tripped || dist < tol || i.state !== 'playing' || Date.now() - t0 > timeout * (process.env.CI ? 6 : 1)) break;
      const fwd = dx * B.fx + dz * B.fz;
      const rgt = dx * B.rx + dz * B.rz;
      const L = Math.hypot(fwd, rgt) || 1;
      const m = dist < 0.7 ? 0.42 : 1;
      await finger.move(1, ring.x + (rgt / L) * travel * m, ring.y - (fwd / L) * travel * m);
      await sleep(40);
    }
    await finger.up(1);
    await ev(() => { window.__stickGuard = null; });
    await sleep(120);
  }
  const i = await info();
  return i.dogs[i.activeDog];
}

try {
  console.log('\n== Celular: tela inicial e perfil ==');
  await load('');
  let s = await uiState();
  let q = await quality();
  check(s.mobile === 'phone' && q.device === 'phone', 'celular detectado (data-mobile=phone)', `${s.mobile}/${q.device}`);
  check(q.mode === 'auto' && q.level === 'media' && q.adaptive, 'modo automático começa no perfil médio, com governador', q);
  check(q.state.pixelRatio === 1 && q.shadow === 1024 && !q.soft && q.samples === 0 && q.everyFrame, 'perfil médio aplicado: pixel ratio 1, sombras PCF 1024 a cada quadro, sem MSAA', q);
  check(q.sky > 0 && q.cap && !q.lowGpu, 'celular: céu depois do cenário e teto de 60 quadros (GPU do teste não é de entrada)', q);
  check(s.device === 'keyboard' && !s.touchOn, 'antes do primeiro toque: sem controles de toque', s);
  const title = await ev(() => ['.rr-logo__svg', '.rr-btn--play', '.rr-levels'].map((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect();
    return { sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }));
  check(title.every((r) => inView(r)), 'tela inicial cabe na tela deitada', title);
  check(!overlaps(title[1], title[2]) && !overlaps(title[0], title[1]), 'logotipo, Jogar e fases sem sobreposição', title);
  check(await ev(() => getComputedStyle(document.querySelector('.rr-title__controls')).display === 'none'), 'barra de teclas escondida no celular');
  await shot('01-titulo-celular.png');

  console.log('\n== Primeiro toque: Jogar ==');
  await tap('.rr-btn--play');
  await waitFor((x) => x.state === 'playing', { timeout: 8000 });
  await sleep(1800);
  s = await uiState();
  check((await info()).state === 'playing', 'toque em Jogar começa a partida');
  check(s.device === 'touch' && s.touchOn, 'depois do toque: controles virtuais aparecem', s);
  check((await info()).input.device === 'touch', 'jogo com input.device touch');
  const layout = await ev(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el || getComputedStyle(el).display === 'none' || el.classList.contains('is-empty')) return null;
      const r = el.getBoundingClientRect();
      return { sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    return {
      buttons: [...document.querySelectorAll('.rr-tbtn')].map((b) => box(`.rr-tbtn[data-touch="${b.dataset.touch}"]`)),
      stick: box('.rr-touch__stick'),
      hud: ['.rr-chip', '.rr-comp', '.rr-objective', '.rr-level', '.rr-treats', '.rr-hud__bottom'].map(box).filter(Boolean),
    };
  });
  const controls = [...layout.buttons, layout.stick];
  check(controls.every((r) => inView(r)), 'joystick e botões inteiros na tela', controls.map((r) => r.sel));
  const pairs = [];
  for (let a = 0; a < controls.length; a++) for (let b = a + 1; b < controls.length; b++) if (overlaps(controls[a], controls[b])) pairs.push([controls[a].sel, controls[b].sel]);
  check(pairs.length === 0, 'botões sem sobreposição entre si', pairs);
  const hits = [];
  for (const c of controls) for (const h of layout.hud) if (overlaps(c, h)) hits.push([c.sel, h.sel]);
  check(hits.length === 0, 'controles fora das áreas do HUD', hits);
  check(Math.min(...layout.buttons.filter((b) => !b.sel.includes('pause')).map((b) => b.right - b.left)) >= 44, 'botões grandes (≥ 44 px)', layout.buttons.map((b) => Math.round(b.right - b.left)));
  await shot('02-jogando-controles.png');

  console.log('\n== Trecho da fase 1 só com toque ==');
  await clearLog();
  await stickWalkTo(0.3, -2.1);
  let d = await stickWalkTo(1.7, -2.05);
  let i = await info();
  check(i.stage === 'east' && d.x > 1.15, 'joystick: Radhija passou pela abertura → etapa east', `x=${d.x} ${i.stage}`);
  await stickWalkTo(1.5, 0.9);
  i = await waitFor((x) => x.prompt === 'Puxar a cordinha', { timeout: 6000 });
  check(i.prompt === 'Puxar a cordinha', 'prompt da cordinha', i.prompt);
  check(await ev(() => document.querySelector('.rr-tbtn--act').classList.contains('is-ready')), 'Agir pulsa com o prompt');
  const pg = await glyphShown('.rr-prompt');
  check(pg?.touch && !pg.kb && !pg.pad && pg.tg[0] === 'act', 'prompt mostra o ícone do botão Agir', pg);
  await shot('03-prompt-agir.png');
  await tap('.rr-tbtn--act');
  i = await waitFor((x) => x.stage === 'gateOpen', { timeout: 6000 });
  check(i.stage === 'gateOpen', 'Agir puxou a cordinha → portão aberto', i.stage);
  check((await logOf('rope:tug')).length === 1, 'rope:tug uma vez');
  await stickWalkTo(2.4, 0.9);
  i = await waitFor((x) => x.dogs.rhaenyra.x > 1.05, { timeout: 8000 });
  check(i.dogs.rhaenyra.x > 1.05, 'Rhaenyra veio pelo portão');
  await tap('.rr-tbtn--swap');
  i = await info();
  s = await uiState();
  check(i.activeDog === 'rhaenyra' && s.dog === 'rhaenyra', 'Trocar → Rhaenyra', `${i.activeDog}/${s.dog}`);
  check(await label('bafo') === 'Lamber' && await label('dash') === 'Empurrar', 'botões viram Lamber e Empurrar', `${await label('bafo')} / ${await label('dash')}`);
  await stickWalkTo(2.6, -1.0);
  await stickWalkTo(3.5, -2.25, { tol: 0.15 });
  // encostar no carrinho sem Empurrar → dica com o ícone de toque
  ring = await rect('.rr-touch__stick');
  const travel = (ring.w / 2) * 0.72;
  await finger.down(1, ring.x, ring.y);
  await finger.move(1, ring.x + travel, ring.y);
  await sleep(700);
  check((await logOf('hint')).some((h) => h.text === 'Segure Shift para empurrar'), 'dica "Segure Shift para empurrar"');
  const hg = await glyphShown('.rr-hint');
  const pushIcon = await ev(() => getComputedStyle(document.querySelector('.rr-hint .k-touch .tg-h')).display !== 'none');
  check(hg?.touch && !hg.kb && hg.tg[0] === 'dash' && pushIcon, 'dica mostra o botão Empurrar (ícone de toque)', hg);
  await shot('04-dica-empurrar.png');
  // dois dedos: joystick para a direita + Empurrar segurado
  const dash = await rect('.rr-tbtn--dash');
  await finger.down(2, dash.x, dash.y);
  i = await waitFor((x) => x.cart.pushing, { timeout: 4000 });
  check(i.cart.pushing && i.dogs.rhaenyra.action === 'push', 'multitoque: joystick + Empurrar empurram o carrinho', `${i.cart.pushing}/${i.dogs.rhaenyra.action}`);
  check((await uiState()).ui.held.includes('dash'), 'Empurrar segurado enquanto o outro dedo está no joystick');
  await shot('05-empurrando-dois-dedos.png');
  i = await waitFor((x) => x.cart.x >= 5.25, { timeout: 6000 });
  await finger.upAll();
  await sleep(300);
  i = await info();
  check(i.cart.x >= 5.25 && i.stage === 'cartMoved', 'carrinho empurrado até liberar a cenoura → cartMoved', `x=${i.cart.x} ${i.stage}`);
  s = await uiState();
  check(s.ui.pointers === 0 && s.ui.held.length === 0 && !s.ui.stick, 'dedos levantados: nada segurado', s.ui);
  await sleep(1500);
  await stickWalkTo(4.4, -3.55, { tol: 0.15 });
  i = await waitFor((x) => x.prompt === 'Pegar a cenoura', { timeout: 4000 });
  check(i.prompt === 'Pegar a cenoura', 'prompt "Pegar a cenoura"', i.prompt);
  await tap('.rr-tbtn--act');
  i = await waitFor((x) => x.stage === 'carrying', { timeout: 3000 });
  check(i.stage === 'carrying' && i.carrier === 'rhaenyra', 'Agir: Rhaenyra pegou a cenoura', `${i.stage}/${i.carrier}`);

  console.log('\n== Demais botões ==');
  await clearLog();
  await tap('.rr-tbtn--jump');
  await sleep(700);
  check((await logOf('dog:jump')).length === 1, 'Pular (Rhaenyra)');
  await tap('.rr-tbtn--stay');
  i = await info();
  check(i.stay.radhija === true && await label('stay') === 'Vem', 'Fica: a Radhija espera e o botão vira Vem', `${i.stay.radhija} ${await label('stay')}`);
  await tap('.rr-tbtn--stay');
  check((await info()).stay.radhija === false && await label('stay') === 'Fica', 'Vem: volta a seguir');
  await tap('.rr-tbtn--swap');
  check((await info()).activeDog === 'radhija' && await label('bafo') === 'Bafo' && await label('dash') === 'Arrancada', 'de volta à Radhija: Bafo e Arrancada');
  await stickWalkTo(3.0, -0.5);
  await clearLog();
  const bafo = await rect('.rr-tbtn--bafo');
  await finger.down(3, bafo.x, bafo.y);
  await sleep(700);
  check((await info()).bafo.aiming, 'segurar Bafo: mira');
  await finger.up(3);
  await sleep(250);
  check((await logOf('dog:bafo')).length === 1, 'soltar Bafo: sopra');
  // arrancada com o joystick segurado (o dedo da arrancada sobe antes)
  await sleep(1200);
  await finger.down(1, ring.x, ring.y);
  await finger.move(1, ring.x, ring.y - travel);
  await sleep(300);
  await ev(() => { addEventListener('pointerdown', (e) => { window.__lastPointer = e.pointerId; }, { capture: true, once: true }); });
  await finger.down(2, dash.x, dash.y);
  await sleep(120);
  await finger.liftOne('.rr-tbtn--dash');
  await sleep(200);
  s = await uiState();
  check((await logOf('dog:dash')).length === 1, 'Arrancada com o joystick segurado');
  check(!s.ui.held.includes('dash') && s.ui.stick, 'o dedo da arrancada subiu e o do joystick continua', s.ui);
  await finger.upAll();
  await sleep(300);
  await tap('.rr-tbtn--jump');
  await sleep(200);
  const jg = await glyphShown('.rr-hint');
  check(jg?.touch && jg.tg[0] === 'swap', 'dica "Só a Rhaenyra pula" com o ícone de Trocar', jg);
  await shot('06-dica-toque.png');

  console.log('\n== Pausa e qualidade ==');
  await tap('.rr-tbtn--pause');
  i = await info();
  s = await uiState();
  check(i.state === 'paused' && !s.touchOn, 'botão de pausa pausa e esconde os controles', `${i.state} ${s.touchOn}`);
  await sleep(600);
  const card = await rect('.rr-card--pause');
  check(inView(card), 'menu de pausa inteiro na tela deitada', card);
  check(await ev(() => getComputedStyle(document.querySelector('.rr-ctl-table')).display === 'none'), 'tabela de teclas escondida no celular');
  await shot('07-pausa.png');
  await tap('.rr-qopt[data-quality="baixa"]');
  q = await quality();
  check(q.mode === 'baixa' && q.level === 'baixa' && q.state.level === 'baixa' && q.state.pixelRatio === 0.85 && !q.everyFrame && !q.adaptive, 'forçar Baixa: aplica na hora (pixel ratio 0,85, sombra a cada 2 quadros)', q);
  check(q.stored === 'baixa', 'escolha salva no navegador', q.stored);
  check(await ev(() => document.querySelector('.rr-qopt[data-quality="baixa"]').classList.contains('is-selected')), 'opção marcada');
  await tap('.rr-qopt[data-quality="auto"]');
  q = await quality();
  check(q.mode === 'auto' && q.level === 'media' && q.adaptive && q.everyFrame && q.stored === null, 'Auto: volta ao médio com governador', q);
  check(await ev(() => document.querySelector('.rr-quality__now').textContent) === 'agora: média', 'mostra o perfil atual no automático');
  const fs = await ev(() => ({ api: !!document.fullscreenEnabled, hidden: document.querySelector('.rr-fullscreen').hidden }));
  check(fs.hidden === !fs.api, 'botão Tela cheia só se o navegador permitir', fs);
  await tap('[data-action="resume"]');
  await sleep(400);
  check((await info()).state === 'playing' && (await uiState()).touchOn, 'Continuar: volta com os controles');

  console.log('\n== Teclado e toque de novo ==');
  await page.keyboard.press('KeyW');
  await sleep(200);
  s = await uiState();
  check(s.device === 'keyboard' && !s.touchOn, 'tecla: controles de toque somem', s);
  const kg = await glyphShown('.rr-chip__swap');
  check(kg?.kb && !kg.touch, 'teclado: o HUD volta a mostrar as teclas', kg);
  await tap('#app canvas', { id: 4 });
  s = await uiState();
  check(s.device === 'touch' && s.touchOn, 'toque na tela: controles voltam', s);

  console.log('\n== Celular de pé ==');
  await page.setViewportSize({ width: PHONE.height, height: PHONE.width });
  await sleep(500);
  i = await info();
  const rot = await ev(() => getComputedStyle(document.querySelector('.rr-rotate')).display);
  check(rot === 'grid' && i.state === 'paused', 'de pé: aviso para girar e partida pausada', `${rot} ${i.state}`);
  await shot('08-gire-o-celular.png');
  await page.setViewportSize(PHONE);
  await sleep(500);
  check(await ev(() => getComputedStyle(document.querySelector('.rr-rotate')).display) === 'none', 'deitado de novo: aviso some');
  await tap('[data-action="resume"]');
  await sleep(300);
  check((await info()).state === 'playing', 'continua de onde parou');

  console.log('\n== Menu, fases e cartão de abertura ==');
  await tap('.rr-tbtn--pause');
  await sleep(500);
  await tap('[data-action="menu"]');
  await waitFor((x) => x.state === 'title', { timeout: 5000 });
  await sleep(900);
  await shot('09-titulo-depois-de-jogar.png');
  // a fase 2 só libera depois da 1: o cartão da fase 1 abre o cartão de abertura dela
  await tap('.rr-lvcard[data-index="0"]');
  i = await waitFor((x) => x.state === 'intro' && x.level === 0, { timeout: 60000 });
  await sleep(1500);
  const intro = await rect('.rr-introcard');
  check(i.state === 'intro' && inView(intro), 'cartão de abertura inteiro na tela', intro);
  await shot('10-abertura.png');
  await tap('[data-action="start"]');
  i = await waitFor((x) => x.state === 'playing', { timeout: 5000 });
  await sleep(1500);
  check(i.state === 'playing' && (await uiState()).touchOn, 'Começar (toque): partida com os controles');

  console.log('\n== PC (sem toque): nada muda ==');
  const pc = await H.browser.newPage({ viewport: { width: 1280, height: 720 } });
  pc.on('console', (m) => { if (m.type() === 'error') H.errors.push(`[pc console.error] ${m.text()}`); });
  pc.on('pageerror', (e) => H.errors.push(`[pc pageerror] ${e.message}`));
  pc.setDefaultTimeout(180000);
  await pc.goto(BASE, { waitUntil: 'load', timeout: 180000 });
  await pc.waitForFunction(() => window.__game?.game?.state === 'title', null, { timeout: 180000 });
  const pcq = await pc.evaluate(() => {
    const { engine, THREE, ui } = window.__game;
    const root = document.querySelector('.rr');
    return {
      device: engine.quality.device, mode: engine.quality.mode, level: engine.quality.level, adaptive: engine.quality.adaptive,
      pr: engine.renderer.getPixelRatio(), shadow: engine.sun.shadow.mapSize.x, soft: engine.renderer.shadowMap.type === THREE.PCFSoftShadowMap,
      samples: engine.composer.renderTarget1.samples, bloom: engine.bloom.enabled, castShadow: engine.sun.castShadow,
      sky: engine.sky.renderOrder, everyFrame: engine.renderer.shadowMap.autoUpdate, cap: engine.quality.capFps,
      mobile: root.dataset.mobile ?? null, uiMobile: ui.mobile, touch: document.querySelector('.rr-touch').classList.contains('is-on'),
      controlsBar: getComputedStyle(document.querySelector('.rr-title__controls')).display,
    };
  });
  check(pcq.device === 'desktop' && pcq.level === 'alta' && !pcq.adaptive, 'PC: perfil alta, sem governador', pcq);
  check(pcq.pr === 1 && pcq.shadow === 2048 && pcq.soft && pcq.samples === 4 && pcq.bloom && pcq.castShadow, 'PC: pixel ratio, sombras PCFSoft 2048, MSAA 4 e bloom como sempre', pcq);
  check(pcq.sky === -10 && pcq.everyFrame && !pcq.cap, 'PC: céu primeiro, sombra a cada quadro e sem teto de quadros, como sempre', pcq);
  check(pcq.mobile === null && pcq.uiMobile === null && !pcq.touch && pcq.controlsBar !== 'none', 'PC: sem layout de celular nem controles de toque', pcq);
  await pc.mouse.click(640, 360);
  check(await pc.evaluate(() => document.querySelector('.rr').dataset.device) === 'keyboard', 'PC: clique do mouse não vira toque');
  await pc.close();
} catch (err) {
  check(false, `erro inesperado: ${err.stack || err.message}`);
} finally {
  const failed = await H.close();
  process.exit(failed ? 1 : 0);
}
