// Celular (suíte 'toque'): Chromium emulando um celular deitado (844×390, DPR 3, toque, isMobile) e DEDOS REAIS pelo
// protocolo do navegador (Input.dispatchTouchEvent → touch + pointer events, como num celular de verdade).
// Confere o perfil de qualidade do celular, o menu inicial pelo toque (Jogar → modos → Fases → Continuar; Opções com o
// modo sem dicas; Voltar), os controles que só aparecem depois de um toque, o layout compacto sem
// sobreposição com o HUD, um trecho da fase 1 jogado só com o joystick e os botões virtuais (abertura, cordinha,
// troca, carrinho empurrado com dois dedos, cenoura), multitoque, dicas com ícones de toque, menu de qualidade,
// aviso de girar o celular, volta ao teclado e o cartão de abertura. No fim, uma página de PC (sem toque) confirma
// que lá nada mudou (perfil 'alta' com os valores de sempre, sem controles de toque), e páginas de iPhone (Safari sem
// a API de tela cheia, como o de verdade) conferem a dica de "Adicionar à Tela de Início" e o modo aplicativo.
//   node tools/scripts/test-toque.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';
import { SCREENS, boxesIn, fakeHoverScript, outside, overlapPairs as pairsOf } from './lib/screens.mjs';

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
/** Caixas de elementos visíveis (seletor → caixa; null se escondido). */
const boxes = (sels) => ev((list) => list.map((sel) => {
  const el = document.querySelector(sel);
  if (!el || !el.getClientRects().length) return null;
  const r = el.getBoundingClientRect();
  return { sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}), sels);
/** Nenhum par de caixas se sobrepõe. → lista dos pares que se sobrepõem. */
const overlapPairs = (list) => {
  const out = [];
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) if (overlaps(list[a], list[b])) out.push([list[a].sel, list[b].sel]);
  return out;
};
const menuState = () => ev(() => ({ state: window.__game.game.state, screen: window.__game.ui.screen, level: window.__game.game.level }));

/**
 * Tamanhos de tela (lib/screens.mjs) deitados, na partida: HUD compacto e proporcional (sem o HUD do PC numa tela
 * pequena, o "HUD de navegador" do Android compacto), controles de toque inteiros, sem se encostar nem cobrir o HUD,
 * botões de pelo menos 39 px, prompt e dica entre os controles, pausa e vitória inteiras na tela. O iPhone 13
 * (844×390) é o da partida principal desta suíte. Capturas em shots/toque/telas-*.png.
 */
async function screenSizes() {
  for (const scr of SCREENS.filter((s) => !s.portrait && s.id !== 'iphone13-844x390')) {
    const { width: vw, height: vh } = scr.opts.viewport;
    console.log(`\n== Tamanho de tela na partida: ${scr.label} (${vw}×${vh}) ==`);
    const p = await H.newPage(scr.opts, scr.id, { lowGfx: true });
    try {
      if (scr.fakeHover) await p.addInitScript(fakeHoverScript);
      await p.goto(`${BASE}?level=1&play`, { waitUntil: 'load', timeout: 120000 });
      await p.waitForFunction(() => window.__game?.game?.state === 'playing', null, { timeout: 120000 });
      await p.evaluate(() => window.__game.game.debug.idle?.setPee(false));
      await p.waitForTimeout(1500);
      const pinfo = () => p.evaluate(() => window.__game.game.debug.info());
      const snap = async (name) => {
        await p.evaluate(() => window.__e2eRender?.());
        await p.screenshot({ path: `shots/toque/telas-${scr.id}-${name}.png` });
        console.log(`  captura: shots/toque/telas-${scr.id}-${name}.png`);
      };
      if (scr.touch) {
        // um toque no cenário liga os controles, como a jogadora faria
        await p.touchscreen.tap(vw / 2, vh * 0.4);
        await p.waitForTimeout(500);
      }
      const st = await p.evaluate(() => {
        const r = document.querySelector('.rr');
        return { compact: r.hasAttribute('data-compact'), mobile: r.dataset.mobile ?? null, device: r.dataset.device, touchOn: document.querySelector('.rr-touch').classList.contains('is-on'), u: getComputedStyle(r).getPropertyValue('--u').trim() };
      });
      check(st.compact === scr.compact && st.mobile === scr.mobile, `${scr.id}: layout ${scr.compact ? 'compacto' : 'normal'}, aparelho ${scr.mobile ?? 'PC'}`, st);
      check(st.touchOn === scr.touch, `${scr.id}: controles de toque ${scr.touch ? 'depois do toque' : 'escondidos (teclado)'}`, st);

      // prompt da cordinha (Agir pulsando) e uma dica com o ícone do dispositivo
      await p.evaluate(() => {
        const g = window.__game.game;
        g.debug.setStage('east', 'radhija');
        g.debug.teleport('radhija', 1.5, 0.9);
      });
      await p.waitForFunction(() => window.__game.game.debug.info().prompt === 'Puxar a cordinha', null, { timeout: 60000 }).catch(() => {});
      await p.evaluate(() => window.__game.events.emit('hint', { text: 'Só a Rhaenyra pula! (Q)', duration: 60 }));
      await p.waitForTimeout(700);
      const i = await pinfo();
      check(i.prompt === 'Puxar a cordinha', `${scr.id}: prompt da cordinha na tela`, i.prompt);

      const HUD = ['.rr-chip', '.rr-comp', '.rr-objective', '.rr-level', '.rr-treats', '.rr-hint', '.rr-prompt'];
      const BTN = ['act', 'jump', 'dash', 'lick', 'bafo', 'swap', 'stay', 'pause'].map((id) => `.rr-tbtn[data-touch="${id}"]`);
      const hud = await boxesIn(p, HUD);
      const ctl = scr.touch ? await boxesIn(p, [...BTN, '.rr-touch__stick']) : [];
      const shownHud = hud.filter(Boolean).map((b) => b.sel);
      check(['.rr-chip', '.rr-comp', '.rr-objective', '.rr-level', '.rr-treats', '.rr-hint', '.rr-prompt'].every((s) => shownHud.includes(s)), `${scr.id}: HUD completo (dogs, objetivo, fase, petiscos, dica e prompt)`, shownHud);
      check(outside([...hud, ...ctl], vw, vh).length === 0, `${scr.id}: HUD e controles inteiros na tela`, outside([...hud, ...ctl], vw, vh));
      check(pairsOf(hud).length === 0, `${scr.id}: HUD sem sobreposição`, pairsOf(hud));
      if (scr.touch) {
        check(ctl.every(Boolean), `${scr.id}: joystick e os oito botões visíveis`, ctl.map((b) => b?.sel ?? null));
        check(pairsOf(ctl).length === 0, `${scr.id}: botões sem sobreposição entre si`, pairsOf(ctl));
        const hits = [];
        for (const c of ctl.filter(Boolean)) for (const h of hud.filter(Boolean)) if (pairsOf([c, h]).length) hits.push([c.sel, h.sel]);
        check(hits.length === 0, `${scr.id}: controles fora do HUD (prompt e dica entre o joystick e os botões)`, hits);
        const sizes = ctl.filter((b) => b && !b.sel.includes('pause') && !b.sel.includes('stick')).map((b) => Math.round(b.w));
        check(Math.min(...sizes) >= 39, `${scr.id}: botões fáceis de apertar (≥ 39 px)`, sizes);
      }
      // proporção: o HUD do PC numa tela pequena ocupava quase um quinto da altura só no chip da cachorrinha
      const chip = hud[0];
      const fonts = await p.evaluate(() => ({
        objective: parseFloat(getComputedStyle(document.querySelector('.rr-objective__text')).fontSize),
        name: parseFloat(getComputedStyle(document.querySelector('.rr-chip__name')).fontSize),
      }));
      check(chip && chip.h <= vh * 0.1, `${scr.id}: HUD proporcional à tela (chip com ${chip && Math.round(chip.h)} px de ${vh})`, chip);
      check(fonts.objective >= 9 && fonts.name >= 10, `${scr.id}: textos do HUD legíveis (≥ 9 px)`, fonts);
      await snap('01-jogando');

      await p.evaluate(() => window.__game.events.emit('ui:pause', {}));
      await p.waitForTimeout(700);
      const pause = await boxesIn(p, ['.rr-card--pause']);
      check(pause[0] && outside(pause, vw, vh).length === 0, `${scr.id}: menu de pausa inteiro na tela`, pause[0]);
      await snap('02-pausa');
      await p.evaluate(() => window.__game.events.emit('ui:resume', {}));
      await p.waitForTimeout(400);

      // vitória: a Rhaenyra leva a cenoura até a porta
      await p.evaluate(() => {
        const g = window.__game.game;
        const z = window.__game.layout.DOOR.zone;
        g.debug.setStage('carrying', 'rhaenyra');
        g.debug.teleport('rhaenyra', z.x, z.z);
      });
      await p.waitForFunction(() => window.__game.game.state === 'victory', null, { timeout: 120000 });
      await p.waitForTimeout(2600);
      const vic = await boxesIn(p, ['.rr-card--victory', '.rr-victory__badge', '.rr-victory__actions']);
      check(vic.every(Boolean) && outside(vic, vw, vh).length === 0, `${scr.id}: vitória inteira na tela (selo, cartão e botões)`, outside(vic, vw, vh));
      await snap('03-vitoria');
    } catch (err) {
      check(false, `${scr.id}: erro inesperado: ${err.stack || err.message}`);
    } finally {
      await p.close().catch(() => {});
    }
  }
}

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
  const title = await boxes(['.rr-logo__svg', '.rr-logo__ribbon', '.rr-btn--play', '.rr-btn--options']);
  check(title.every((r) => inView(r)), 'tela inicial (logotipo, Jogar e Opções) cabe na tela deitada', title);
  check(overlapPairs(title).filter((p) => p.join() !== '.rr-logo__svg,.rr-logo__ribbon').length === 0, 'logotipo, Jogar e Opções sem sobreposição', title);
  check(await ev(() => getComputedStyle(document.querySelector('.rr-title__controls')).display === 'none'), 'barra de teclas escondida no celular');
  await shot('01-titulo-celular.png');

  console.log('\n== Menu pelo toque: Jogar, modos, Opções, Fases ==');
  await tap('.rr-btn--play');
  let m = await menuState();
  check(m.state === 'title' && m.screen === 'modes', 'toque em Jogar: escolha do modo', m);
  await sleep(600);
  const modes = await boxes(['.rr-logo__svg', '.rr-title .rr-back', '.rr-mode--story', '.rr-mode--levels']);
  check(modes.every((r) => inView(r)), 'modos inteiros na tela deitada', modes);
  check(overlapPairs(modes).length === 0, 'logotipo, Voltar e os dois modos sem sobreposição', modes);
  await shot('01b-modos-celular.png');
  await tap('.rr-mode--story');
  m = await menuState();
  check(m.screen === 'modes' && /em breve/i.test(await ev(() => document.querySelector('.rr-levels__note.is-on')?.textContent || '')), 'toque no Modo História: aviso "em breve", sem sair dos modos', m);
  await tap('.rr-title .rr-back');
  m = await menuState();
  check(m.screen === 'main', 'toque em Voltar: tela principal', m);
  await tap('.rr-btn--options');
  m = await menuState();
  check(m.screen === 'options', 'toque em Opções', m);
  await sleep(600);
  const opts = await boxes(['.rr-title .rr-back', '.rr-card--options', '.rr-title .rr-hopt[data-hints="off"]', '.rr-title .rr-qopt[data-quality="baixa"]']);
  check(opts.every((r) => inView(r)), 'cartão de Opções inteiro na tela deitada', opts);
  check(!overlaps(opts[0], opts[1]), 'Voltar fora do cartão de Opções', opts);
  await tap('.rr-title .rr-hopt[data-hints="off"]');
  check(await ev(() => window.__game.settings.noHints && document.querySelector('.rr').dataset.hints === 'off'), 'toque em Dicas desligadas: modo sem dicas');
  await shot('01c-opcoes-celular.png');
  await tap('.rr-title .rr-hopt[data-hints="on"]');
  check(await ev(() => !window.__game.settings.noHints), 'toque em Dicas ligadas: dicas de volta');
  await tap('.rr-title .rr-back');
  await tap('.rr-btn--play');
  await tap('.rr-mode--levels');
  m = await menuState();
  check(m.screen === 'levels', 'toque em Fases: tela das fases', m);
  await sleep(700);
  const levels = await boxes(['.rr-logo__svg', '.rr-title .rr-back', '.rr-btn--continue', '.rr-levels']);
  check(levels.every((r) => inView(r)), 'Continuar e cartões inteiros na tela deitada', levels);
  check(overlapPairs(levels).length === 0, 'logotipo, Voltar, Continuar e cartões sem sobreposição', levels);
  await shot('01d-fases-celular.png');

  console.log('\n== Continuar pelo toque ==');
  await tap('.rr-btn--continue');
  m = await menuState();
  check(m.state === 'intro' && m.level === 0, 'toque em Continuar (save novo): cartão da fase 1', m);
  await sleep(1200);
  await tap('[data-action="start"]');
  await waitFor((x) => x.state === 'playing', { timeout: 8000 });
  await sleep(1800);
  s = await uiState();
  check((await info()).state === 'playing', 'toque em Começar começa a partida');
  check(s.device === 'touch' && s.touchOn, 'depois do toque: controles virtuais aparecem', s);
  check((await info()).input.device === 'touch', 'jogo com input.device touch');
  const andFs = await ev(() => ({ fs: !!document.fullscreenElement, tip: !!document.querySelector('.rr-ios-tip'), mark: document.querySelector('.rr').dataset.installTip ?? null }));
  check(andFs.fs, 'Android: o primeiro toque em Jogar já põe em tela cheia', andFs);
  check(!andFs.tip && andFs.mark === null, 'Android: sem a dica do iPhone', andFs);
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
  // Agir: ela anda até a cordinha e morde; o joystick para longe do portão puxa de ré até ele abrir
  i = await waitFor((x) => x.rope.phase === 'hold', { timeout: 6000 });
  check(i.rope.phase === 'hold', 'Agir: ela morde a cordinha e segura', i.rope.phase);
  await stickWalkTo(2.15, 0.65, { tol: 0.15 });
  i = await waitFor((x) => x.stage === 'gateOpen', { timeout: 6000 });
  check(i.stage === 'gateOpen', 'joystick puxou a cordinha → portão aberto', i.stage);
  check((await logOf('rope:tug')).length === 1, 'rope:tug uma vez');
  await stickWalkTo(2.4, 0.9);
  i = await waitFor((x) => x.dogs.rhaenyra.x > 1.05, { timeout: 8000 });
  check(i.dogs.rhaenyra.x > 1.05, 'Rhaenyra veio pelo portão');
  await tap('.rr-tbtn--swap');
  i = await info();
  s = await uiState();
  check(i.activeDog === 'rhaenyra' && s.dog === 'rhaenyra', 'Trocar → Rhaenyra', `${i.activeDog}/${s.dog}`);
  const bafoDim = () => ev(() => Number(getComputedStyle(document.querySelector('.rr-tbtn--bafo')).opacity));
  check(await label('dash') === 'Empurrar' && await label('lick') === 'Lamber' && await bafoDim() < 0.6, 'Arrancada vira Empurrar; Lamber continua; o Superbafo (só da Radhija) fica apagado', `${await label('dash')} / ${await label('lick')} / ${await bafoDim()}`);
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
  check((await info()).activeDog === 'radhija' && await label('bafo') === 'Superbafo' && await label('dash') === 'Arrancada' && await bafoDim() > 0.95, 'de volta à Radhija: Superbafo aceso e Arrancada');
  await stickWalkTo(3.0, -0.5);
  await clearLog();
  const bafo = await rect('.rr-tbtn--bafo');
  await finger.down(3, bafo.x, bafo.y);
  await sleep(700);
  check((await info()).bafo.aiming, 'segurar Superbafo: mira');
  await finger.up(3);
  await sleep(250);
  check((await logOf('dog:bafo')).length === 1, 'soltar Superbafo: sopra');
  // Lamber (as duas dogs): a Radhija lambe a irmã com o botão segurado (a irmã a oeste: a leste, perto de (3, −0,5),
  // fica o bebedouro de pássaros, e com ele no meio a lambida não alcança)
  await ev(() => {
    const g = window.__game.game;
    const r = g.debug.ctrls.radhija;
    g.debug.teleport('rhaenyra', r.x - 0.9, r.z);
    g.setStay('rhaenyra', true);
  });
  await sleep(300);
  await clearLog();
  const lickBtn = await rect('.rr-tbtn--lick');
  await finger.down(3, lickBtn.x, lickBtn.y);
  i = await waitFor((x) => x.lick.on && x.lick.stage === 'licking' && x.lick.strokes >= 1, { timeout: 3000 });
  check(i.lick.by === 'radhija' && i.lick.target === 'rhaenyra' && (await logOf('dog:bafo')).length === 0, 'segurar Lamber: a Radhija lambe a irmã', JSON.stringify(i.lick));
  await finger.up(3);
  i = await waitFor((x) => !x.lick.on, { timeout: 2000 });
  check(!i.lick.on, 'soltar Lamber: para de lamber');
  await ev(() => window.__game.game.setStay('rhaenyra', false));
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
  await tap('.rr-pause .rr-qopt[data-quality="baixa"]');
  q = await quality();
  check(q.mode === 'baixa' && q.level === 'baixa' && q.state.level === 'baixa' && q.state.pixelRatio === 0.85 && !q.everyFrame && !q.adaptive, 'forçar Baixa: aplica na hora (pixel ratio 0,85, sombra a cada 2 quadros)', q);
  check(q.stored === 'baixa', 'escolha salva no navegador', q.stored);
  check(await ev(() => document.querySelector('.rr-pause .rr-qopt[data-quality="baixa"]').classList.contains('is-selected')), 'opção marcada');
  await tap('.rr-pause .rr-qopt[data-quality="auto"]');
  q = await quality();
  check(q.mode === 'auto' && q.level === 'media' && q.adaptive && q.everyFrame && q.stored === null, 'Auto: volta ao médio com governador', q);
  check(await ev(() => document.querySelector('.rr-pause .rr-quality__now').textContent) === 'agora: média', 'mostra o perfil atual no automático');
  // volume, qualidade e tela cheia existem na tela Opções e na pausa: aqui, a cópia da pausa
  const fsState = () => ev(() => ({
    api: !!document.fullscreenEnabled, on: !!document.fullscreenElement,
    hidden: document.querySelector('.rr-pause .rr-fullscreen').hidden, label: document.querySelector('.rr-pause .rr-fullscreen span').textContent,
    ios: !!document.querySelector('.rr-ios-fs'),
  }));
  let fs = await fsState();
  check(fs.api && !fs.hidden && fs.on && fs.label === 'Sair da tela cheia' && !fs.ios, 'Android: botão da pausa mostra a tela cheia ligada', fs);
  await tap('.rr-pause .rr-fullscreen');
  await sleep(400);
  fs = await fsState();
  check(!fs.on && fs.label === 'Tela cheia', 'Android: o botão sai da tela cheia', fs);
  await tap('.rr-pause .rr-fullscreen');
  await sleep(400);
  fs = await fsState();
  check(fs.on && fs.label === 'Sair da tela cheia', 'Android: e entra de novo', fs);
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
  // tela maior (tela cheia, tablet): o pixel ratio desce para caber no orçamento do perfil atual e volta
  const prof = await ev(() => ({ ...window.__game.engine.quality.profile }));
  const expect = (w, h) => Math.min(3, prof.pixelRatio, Math.max(0.5, Math.sqrt(prof.pixelBudget / (w * h))));
  await page.setViewportSize({ width: 1300, height: 700 });
  await sleep(400);
  const big = (await quality()).state.pixelRatio;
  await page.setViewportSize(PHONE);
  await sleep(400);
  const back = (await quality()).state.pixelRatio;
  check(Math.abs(big - expect(1300, 700)) < 0.01 && Math.abs(back - expect(PHONE.width, PHONE.height)) < 0.01 && big < back,
    'orçamento de pixels acompanha o tamanho da tela', { level: prof.name, big, back });
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
  check((await menuState()).screen === 'main', 'Menu inicial: volta à tela principal');
  await tap('.rr-btn--play');
  await tap('.rr-mode--levels');
  // a fase 2 só libera depois da 1: o cartão da fase 1 abre o cartão de abertura dela
  await tap('.rr-lvcard[data-index="0"]');
  i = await waitFor((x) => x.state === 'intro' && x.level === 0, { timeout: 60000 });
  await sleep(1500);
  const intro = await boxes(['.rr-introcard', '.rr-intro .rr-back']);
  check(i.state === 'intro' && intro.every((r) => inView(r)) && !overlaps(intro[0], intro[1]), 'cartão de abertura e Voltar inteiros na tela', intro);
  await shot('10-abertura.png');
  await tap('.rr-intro .rr-back');
  m = await menuState();
  check(m.state === 'title' && m.screen === 'levels', 'toque em Voltar no cartão de abertura: de volta às fases', m);
  await tap('.rr-lvcard[data-index="0"]');
  i = await waitFor((x) => x.state === 'intro' && x.level === 0, { timeout: 10000 });
  await sleep(1200);
  await tap('[data-action="start"]');
  i = await waitFor((x) => x.state === 'playing', { timeout: 5000 });
  await sleep(1500);
  check(i.state === 'playing' && (await uiState()).touchOn, 'Começar (toque): partida com os controles');

  console.log('\n== PC (sem toque): nada muda ==');
  // páginas extras com as redes do harness (tetos de relógio, vigia e escuta de queda; erros do navegador reprovam)
  const pc = await H.newPage({ viewport: { width: 1280, height: 720 } }, 'pc');
  await pc.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await pc.waitForFunction(() => window.__game?.game?.state === 'title', null, { timeout: 120000 });
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

  console.log('\n== iPhone (Safari): dica de tela cheia e modo aplicativo ==');
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  /** Página de iPhone: sem a API de tela cheia (como o Safari do iPhone), opcionalmente aberta pelo ícone (standalone). */
  const iphonePage = async ({ standalone = false } = {}) => {
    const p = await H.newPage({ viewport: PHONE, screen: PHONE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IPHONE_UA }, 'iphone');
    await p.addInitScript(({ app, ci }) => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { configurable: true, get: () => false });
      Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { configurable: true, get: () => false });
      Element.prototype.requestFullscreen = undefined;
      Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => app });
      window.__fakePads = [];
      Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value() { return window.__fakePads; } });
      if (!ci) return;
      // a mesma redução gráfica do harness no CI sem GPU (só o custo de desenho; o jogo é o mesmo), inclusive desenhar
      // 1 de cada 30 quadros: desenhando todos, cada quadro do iPhone levava 0,7–2 s no SwiftShader, dividindo o
      // processo da GPU com a página principal (que segue jogando); a simulação e a entrada continuam em todo quadro
      Object.defineProperty(window, '__game', {
        configurable: true,
        set(value) {
          const { renderer, composer, bloom } = value.engine;
          const low = () => { renderer.setPixelRatio(0.25); composer.setPixelRatio(0.25); renderer.shadowMap.enabled = false; bloom.enabled = false; };
          low();
          value.events?.on?.('quality:change', low);
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
    }, { app: standalone, ci: !!process.env.CI });
    await p.goto(BASE, { waitUntil: 'load', timeout: 120000 });
    await p.waitForFunction(() => window.__game?.game?.state === 'title', null, { timeout: 120000 });
    await p.waitForTimeout(2500);
    return p;
  };
  /** Captura de uma página de iPhone: no CI ela desenha 1 de 30 quadros, então força um desenho real antes. */
  const snap = async (p, path) => {
    await p.evaluate(() => window.__e2eRender?.());
    await p.screenshot({ path });
  };
  const center = (p, sel) => p.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect();
    return r && { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  }, sel);
  const ip = await iphonePage();
  let ios = await ip.evaluate(() => ({
    mark: document.querySelector('.rr').dataset.installTip ?? null, tip: document.querySelector('.rr-ios-tip')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
    fsBtnHidden: document.querySelector('.rr-fullscreen').hidden, iosBtn: !!document.querySelector('.rr-ios-fs__how'), rotateLine: !!document.querySelector('.rr-rotate__ios'),
    mobile: document.querySelector('.rr').dataset.mobile ?? null,
  }));
  check(ios.mobile === 'phone' && ios.mark === '1', 'iPhone fora do app: dica ativa', ios);
  check(/Compartilhar/.test(ios.tip || '') && /Adicionar à Tela de Início/.test(ios.tip || ''), 'cartão explica Compartilhar → Adicionar à Tela de Início', ios.tip);
  check(ios.fsBtnHidden && ios.iosBtn && ios.rotateLine, 'sem o botão de tela cheia do Android; na pausa, o passo a passo; no aviso de girar, a dica', ios);
  const tipBox = await center(ip, '.rr-ios-tip');
  const playBox = await center(ip, '.rr-btn--play');
  const optionsBox = await center(ip, '.rr-btn--options');
  check(inView(tipBox) && !overlaps(tipBox, playBox) && !overlaps(tipBox, optionsBox) && tipBox.top >= optionsBox.bottom, 'cartão da dica cabe sob o Jogar e o Opções', { tipBox, playBox, optionsBox });
  await snap(ip, 'shots/toque/12-iphone-dica.png');
  // fechar no × some e não volta mais
  const close = await center(ip, '.rr-ios-tip__close');
  await ip.touchscreen.tap(close.x, close.y);
  // o clique do toque chega quando a página (desenhando no SwiftShader) fica livre: espera o efeito, não um tempo fixo
  await ip.waitForFunction(() => !document.querySelector('.rr-ios-tip'), null, { timeout: 15000 }).catch(() => {});
  ios = await ip.evaluate(() => ({ tip: !!document.querySelector('.rr-ios-tip'), saved: localStorage.getItem('rr-dica-tela-inicial'), state: window.__game.game.state }));
  check(!ios.tip && ios.saved === '1' && ios.state === 'title', 'fechar a dica: some, fica salvo e não começa a partida', ios);
  await ip.reload({ waitUntil: 'load' });
  await ip.waitForFunction(() => window.__game?.game?.state === 'title', null, { timeout: 120000 });
  await ip.waitForTimeout(1500);
  check(await ip.evaluate(() => !document.querySelector('.rr-ios-tip') && !!document.querySelector('.rr-ios-fs__how')), 'recarregando: a dica não volta, a nota da pausa continua');
  // a pausa mostra o passo a passo: Jogar → Fases → Continuar → Começar. Cada toque só quando o botão aparece: com o
  // SwiftShader ocupado, o clique do toque anterior chega atrasado, a tela seguinte ainda está escondida e o toque caía
  // em (0, 0) (o cartão de abertura não vinha).
  const tapShown = async (sel) => {
    await ip.waitForFunction((s) => (document.querySelector(s)?.getClientRects().length ?? 0) > 0, sel, { timeout: 30000 });
    const b = await center(ip, sel);
    await ip.touchscreen.tap(b.x, b.y);
  };
  for (const sel of ['.rr-btn--play', '.rr-mode--levels', '.rr-btn--continue']) {
    await tapShown(sel);
    await ip.waitForTimeout(400);
  }
  await ip.waitForFunction(() => window.__game.game.state === 'intro', null, { timeout: 60000 });
  await ip.waitForTimeout(1200);
  await tapShown('[data-action="start"]');
  await ip.waitForFunction(() => window.__game.game.state === 'playing', null, { timeout: 60000 });
  await ip.waitForTimeout(1500);
  check(await ip.evaluate(() => !document.fullscreenElement), 'iPhone: Jogar não tenta a tela cheia (o Safari não deixa)');
  const pauseBtn = await center(ip, '.rr-tbtn--pause');
  await ip.touchscreen.tap(pauseBtn.x, pauseBtn.y);
  await ip.waitForFunction(() => window.__game.game.state === 'paused', null, { timeout: 30000 });
  await ip.waitForTimeout(700);
  const how = await ip.evaluate(() => {
    const el = document.querySelector('.rr-pause .rr-ios-fs__how');
    const r = el.getBoundingClientRect();
    return { shown: getComputedStyle(el).display !== 'none' && r.height > 0, text: el.textContent, nav: !!el.closest('[data-nav]') || !!el.querySelector('[data-nav]') };
  });
  check(how.shown && /Adicionar à Tela de Início/.test(how.text) && !how.nav, 'pausa: nota com o passo a passo (só texto, nada focável sem efeito)', how);
  check(inView(await center(ip, '.rr-card--pause')), 'pausa com o passo a passo cabe na tela');
  await snap(ip, 'shots/toque/13-iphone-pausa.png');
  await ip.setViewportSize({ width: PHONE.height, height: PHONE.width });
  await ip.waitForTimeout(500);
  const rotIos = await ip.evaluate(() => ({ overlay: getComputedStyle(document.querySelector('.rr-rotate')).display, line: getComputedStyle(document.querySelector('.rr-rotate__ios')).display }));
  check(rotIos.overlay === 'grid' && rotIos.line !== 'none', 'de pé: o aviso de girar traz a dica do iPhone', rotIos);
  await snap(ip, 'shots/toque/14-iphone-de-pe.png');
  await ip.close();

  // aberto pelo ícone da tela inicial: tela cheia de verdade, nada de dica
  const app = await iphonePage({ standalone: true });
  const appState = await app.evaluate(() => ({
    mark: document.querySelector('.rr').dataset.installTip ?? null, tip: !!document.querySelector('.rr-ios-tip'),
    iosBtn: !!document.querySelector('.rr-ios-fs__how'), rotateLine: !!document.querySelector('.rr-rotate__ios'),
    mobile: document.querySelector('.rr').dataset.mobile ?? null,
  }));
  check(appState.mobile === 'phone' && appState.mark === null && !appState.tip && !appState.iosBtn && !appState.rotateLine, 'iPhone pelo ícone (modo aplicativo): sem dica nenhuma', appState);
  await snap(app, 'shots/toque/15-iphone-app.png');
  await app.close();

  await screenSizes();
} catch (err) {
  check(false, `erro inesperado: ${err.stack || err.message}`);
} finally {
  const failed = await H.close();
  process.exit(failed ? 1 : 0);
}
