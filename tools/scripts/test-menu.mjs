// Menu inicial (suíte 'menu'): a tela principal (logotipo e progresso | Jogar, História "em breve" e Opções; a nota da
// música no canto), Jogar → o mapa das fases (Pandorópolis) na frente da próxima fase; Opções (efeitos, música,
// qualidade, dicas). Navegação com TECLAS REAIS (setas, Enter, Esc) e com o CONTROLE simulado (D-pad, analógico,
// ✕ confirma, ○ volta), como na suíte controle. Também: a música começa ligada no primeiro gesto, com o tema de cada
// tela (menu, mapa, fase), a nota liga e desliga; o mapa abre na frente da próxima fase do save, a bandeirinha abre o
// cartão de abertura, o Voltar dele volta ao mapa, a pausa do mapa (só Menu inicial), e o modo sem dicas salvo no
// navegador: sem objetivo escrito, marcador do objetivo e dicas em balão, valendo depois de recarregar e religável na
// pausa. O toque fica na suíte toque (dedos reais no celular deitado); o mapa em si, na suíte mapa.
//   node tools/scripts/test-menu.mjs [--url http://127.0.0.1:5176/]
import { createHarness, parseArgs } from './lib/harness.mjs';
import { SCREENS, boxesIn, fakeHoverScript, outside, overlapPairs, settle } from './lib/screens.mjs';

const args = parseArgs();
const BASE = (args.url || 'http://127.0.0.1:5176/').replace(/\?.*$/, '');
const H = await createHarness({ base: BASE, outDir: 'shots/menu' });
const { page, check, sleep, info, ev, shot, logOf, clearLog, load, press, waitFor } = H;
const B = { A: 0, B: 1, X: 2, Y: 3, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DONE = { done: true, best: 80, treats: 2, total: 3, clears: 1 };

/** Estado da UI: estado do jogo, tela do menu, fase e o elemento com foco (nome legível). */
const ui = () => ev(() => {
  const g = window.__game;
  const f = /** @type {HTMLElement} */ (document.querySelector('.rr .is-focus'));
  let focus = null;
  if (f) {
    const a = f.dataset.action;
    if (f.hasAttribute('data-slider')) focus = f.classList.contains('rr-volume--music') ? 'music-volume' : 'volume';
    else if (a === 'quality') focus = `quality:${f.dataset.quality}`;
    else if (a === 'hints') focus = `hints:${f.dataset.hints}`;
    else if (a === 'select') focus = `select:${f.dataset.index}`;
    else focus = a ?? null;
  }
  return { state: g.game.state, screen: g.ui.screen, level: g.game.level, hub: g.game.isHub, focus, device: document.querySelector('.rr').dataset.device };
});
/** Ações visíveis (com caixa na tela) dentro da camada da tela inicial. */
const visibleActions = () => ev(() => [...document.querySelectorAll('.rr-title [data-action]')]
  .filter((el) => el.getClientRects().length > 0)
  .map((el) => el.dataset.action + (el.dataset.index ? `:${el.dataset.index}` : '')));
/** Música: ligada, tema pedido e o que toca, volume (0–100), a nota do canto e o que ficou salvo. */
const music = () => ev(() => {
  const a = window.__game.audio;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('operacao-cenoura:musica') || 'null'); } catch (_) {}
  return { on: a.musicOn, theme: a.musicTheme, playing: a.musicPlaying, vol: Math.round(a.musicVolume * 100), pressed: document.querySelector('.rr-music-toggle').getAttribute('aria-pressed'), stored };
});
/** Progresso ao lado do logotipo e o subtítulo do Jogar. */
const home = () => ev(() => ({
  stats: [...document.querySelectorAll('.rr-home__stats .rr-stat-chip')].map((e) => e.getAttribute('aria-label')),
  sub: document.querySelector('.rr-play__sub').textContent,
}));
const shown = (sel) => ev((s) => {
  const el = document.querySelector(s);
  return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}, sel);
/** Aperta uma tecla até o foco satisfazer `ok` (no máximo `max` vezes). */
async function pressUntil(key, ok, max = 6) {
  for (let n = 0; n < max; n++) {
    const u = await ui();
    if (ok(u.focus)) return u;
    await press(key, 150);
  }
  return ui();
}

// ---------- controle falso (mesmo mapeamento da suíte controle) ----------
const connect = () => ev(() => {
  const pad = {
    id: 'Controle falso (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  };
  window.__fakePads = [pad];
  window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
});
const btn = (i, on) => ev(([ii, o]) => { const p = window.__fakePads[0]; p.buttons[ii] = { pressed: o, touched: o, value: o ? 1 : 0 }; p.timestamp = performance.now(); }, [i, on]);
const axes = (x, y) => ev(([xx, yy]) => { const p = window.__fakePads[0]; p.axes = [xx, yy, 0, 0]; p.timestamp = performance.now(); }, [x, y]);
async function tap(i, ms = 110) { await btn(i, true); await sleep(ms); await btn(i, false); await sleep(160); }

/**
 * Tamanhos de tela (lib/screens.mjs): em cada aparelho, a tela principal, os modos, as Opções, o HUD do mapa das fases
 * e o cartão de abertura cabem inteiros na tela e sem sobreposição; o layout compacto liga pelo tamanho (também numa janela pequena
 * no PC e num Android cujo navegador diz ter mouse), e o PC de tamanho normal fica com o layout de sempre. De pé, o
 * celular mostra o aviso de girar. Capturas em shots/menu/telas-*.png.
 */
async function screenSizes() {
  for (const scr of SCREENS) {
    console.log(`\n== Tamanho de tela: ${scr.label} (${scr.opts.viewport.width}×${scr.opts.viewport.height}) ==`);
    const p = await H.newPage(scr.opts, scr.id, { lowGfx: true });
    try {
      if (scr.fakeHover) await p.addInitScript(fakeHoverScript);
      await p.goto(BASE, { waitUntil: 'load', timeout: 120000 });
      await p.evaluate(() => { localStorage.removeItem('rr-progress-v1'); localStorage.removeItem('rr-settings-v1'); });
      await p.waitForFunction(() => window.__game?.game?.state === 'title', null, { timeout: 120000 });
      await p.waitForTimeout(800);
      await settle(p);
      const { width: vw, height: vh } = scr.opts.viewport;
      const snap = async (name) => {
        await p.evaluate(() => window.__e2eRender?.());
        await p.screenshot({ path: `shots/menu/telas-${scr.id}-${name}.png` });
        console.log(`  captura: shots/menu/telas-${scr.id}-${name}.png`);
      };
      const root = await p.evaluate(() => {
        const r = document.querySelector('.rr');
        const g = window.__game;
        return { compact: r.hasAttribute('data-compact'), mobile: r.dataset.mobile ?? null, uiCompact: g.ui.compact, device: g.engine.quality.device, u: getComputedStyle(r).getPropertyValue('--u').trim() };
      });
      check(root.compact === scr.compact && root.uiCompact === scr.compact, `${scr.id}: layout ${scr.compact ? 'compacto' : 'normal'}`, root);
      check(root.mobile === scr.mobile, `${scr.id}: aparelho ${scr.mobile ?? 'PC'}`, root);
      if (!scr.compact) check(root.u === '1px', `${scr.id}: medidas de sempre (--u = 1px)`, root.u);

      const go = async (sel) => { await p.evaluate((s) => document.querySelector(s).click(), sel); await p.waitForTimeout(150); await settle(p); };
      /** Elementos visíveis inteiros na tela e sem sobreposição entre si. */
      const fits = async (what, sels, ignore = []) => {
        const bx = await boxesIn(p, sels);
        const shownSels = bx.filter(Boolean).map((b) => b.sel);
        const out = outside(bx, vw, vh);
        const pairs = overlapPairs(bx, ignore);
        check(out.length === 0, `${scr.id}: ${what} inteiro na tela`, out.length ? { out, vw, vh, bx: bx.filter(Boolean) } : shownSels.length);
        check(pairs.length === 0, `${scr.id}: ${what} sem sobreposição`, pairs);
        return bx;
      };

      if (scr.portrait) {
        // de pé: o aviso de girar cobre tudo, com o texto inteiro
        const rot = await p.evaluate(() => getComputedStyle(document.querySelector('.rr-rotate')).display);
        check(rot === 'grid', `${scr.id}: de pé, o aviso de girar o celular`, rot);
        await fits('aviso de girar', ['.rr-rotate .ico-rotate', '.rr-rotate strong', '.rr-rotate__box > span']);
        await snap('01-de-pe');
        continue;
      }

      const logo = ['.rr-logo__svg', '.rr-logo__ribbon'];
      await fits('tela principal (logotipo, progresso, Jogar, História, Opções, nota da música, versão)', [...logo, '.rr-home__stats', '.rr-btn--play', '.rr-tile--story', '.rr-tile--options', '.rr-music-toggle', '.rr-version'], [['.rr-logo__svg', '.rr-logo__ribbon']]);
      // o texto do Jogar (a fase em que continua) cabe no botão, sem cortar
      const sub = await p.evaluate(() => { const s = document.querySelector('.rr-play__sub'); return { sw: s.scrollWidth, cw: s.clientWidth, text: s.textContent }; });
      check(sub.sw <= sub.cw + 1, `${scr.id}: o subtítulo do Jogar cabe`, sub);
      await snap('01-principal');
      await go('.rr-btn--options');
      await fits('Opções', ['.rr-title .rr-back', '.rr-music-toggle', '.rr-card--options']);
      // o cartão rola (se precisar) em vez de cortar: a última linha alcançável
      const optScroll = await p.evaluate(() => { const c = document.querySelector('.rr-card--options'); return { sh: c.scrollHeight, ch: c.clientHeight, oy: getComputedStyle(c).overflowY }; });
      check(optScroll.sh <= optScroll.ch + 1 || optScroll.oy === 'auto', `${scr.id}: Opções cabem ou rolam`, optScroll);
      await snap('02-opcoes');
      await go('.rr-title .rr-back');
      await go('.rr-btn--play');
      // Jogar: o mapa das fases, com as dogs na frente da bandeirinha 1 (a plaquinha aparece)
      await p.waitForFunction(() => window.__game.game.isHub && window.__game.game.state === 'playing' && window.__game.game.debug.info().near === 1, null, { timeout: 120000 });
      await p.waitForTimeout(900);
      await settle(p);
      await fits('HUD do mapa (dogs, objetivo, placa da cidade, plaquinha, Entrar e o atalho)', ['.rr-hud__dogs', '.rr-objective', '.rr-mapplate', '.rr-sign', '.rr-prompt', '.rr-travel', '.rr-esc']);
      await snap('03-mapa');
      await p.keyboard.press('KeyE');
      await p.waitForFunction(() => window.__game.game.state === 'intro', null, { timeout: 60000 });
      await p.waitForTimeout(600);
      await settle(p);
      // o selo do item sobe por cima da borda do cartão (de propósito): só precisa caber na tela
      await fits('cartão de abertura da fase', ['.rr-intro .rr-back', '.rr-introcard', '.rr-introcard__badge'], [['.rr-introcard', '.rr-introcard__badge']]);
      await snap('05-abertura');
    } catch (err) {
      check(false, `${scr.id}: erro inesperado: ${err.stack || err.message}`);
    } finally {
      await p.close().catch(() => {});
    }
  }
}

try {
  console.log('\n== Teclado: tela principal, música e Jogar → mapa ==');
  await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
  await ev(() => { localStorage.removeItem('rr-progress-v1'); localStorage.removeItem('rr-settings-v1'); localStorage.removeItem('operacao-cenoura:musica'); });
  await load('');
  let u = await ui();
  check(u.state === 'title' && u.screen === 'main', 'tela inicial abre na tela principal', u);
  let acts = await visibleActions();
  check(acts.join() === 'music,play,story,options', 'tela principal: a nota da música, Jogar, História e Opções (sem cartões nem Voltar)', acts);
  check(!(await shown('.rr-levels .rr-lvcard')), 'cartões das fases fora da tela principal');
  let hm = await home();
  check(hm.stats.length === 2 && /^0 de \d+ biscoitos$/.test(hm.stats[0]) && /^0 de \d+ fases concluídas$/.test(hm.stats[1]), 'progresso ao lado do logotipo: biscoitos e fases (save novo)', hm.stats);
  check(/^Começar · Fase 1 · /.test(hm.sub), 'o Jogar diz onde começa: Fase 1', hm.sub);
  const story = await ev(() => {
    const t = document.querySelector('.rr-tile--story');
    return { badge: t.querySelector('.rr-tile__badge').textContent, disabled: t.getAttribute('aria-disabled'), label: t.getAttribute('aria-label') };
  });
  check(story.badge === 'Em breve' && story.disabled === 'true' && /Modo História/.test(story.label), 'História visível com o selo "Em breve"', story);
  await shot('menu-01-principal.png');

  // a primeira tecla destrava o áudio: a música (ligada por padrão) começa com o tema do menu
  u = await pressUntil('ArrowDown', (f) => f === 'story' || f === 'options');
  check(u.focus === 'story', 'seta para baixo: Jogar → História (a primeira da linha de baixo)', u);
  await sleep(300);
  let m = await music();
  check(m.on && m.pressed === 'true' && m.theme === 'menu' && m.playing === 'menu', 'música ligada por padrão: o tema do menu toca depois da primeira tecla', m);
  u = await pressUntil('ArrowRight', (f) => f === 'options', 2);
  check(u.focus === 'options', 'seta para a direita: Opções', u);
  await press('ArrowLeft', 150);
  u = await ui();
  check(u.focus === 'story', 'seta para a esquerda: História', u);
  await press('Enter', 300);
  u = await ui();
  const note = await ev(() => document.querySelector('.rr-levels__note.is-on')?.textContent || '');
  check(u.state === 'title' && u.screen === 'main' && /em breve/i.test(note), 'História não abre nada: aviso "em breve"', { u, note });
  await shot('menu-02-historia-em-breve.png');
  await press('ArrowUp', 150);
  u = await ui();
  check(u.focus === 'play', 'seta para cima: Jogar', u);
  u = await pressUntil('ArrowUp', (f) => f === 'music', 2);
  check(u.focus === 'music', 'seta para cima de novo: a nota da música, no canto', u);
  await press('Enter', 250);
  m = await music();
  check(!m.on && m.pressed === 'false' && m.stored?.on === false && m.playing === 'menu', 'Enter na nota: música desligada (o tema segue mudo) e salva', m);
  await shot('menu-03-musica-desligada.png');
  await press('Enter', 250);
  m = await music();
  check(m.on && m.pressed === 'true' && m.stored?.on === true, 'Enter de novo: música ligada', m);
  await press('ArrowDown', 150);
  u = await ui();
  check(u.focus === 'play', 'seta para baixo: de volta ao Jogar', u);
  await press('Enter', 300);
  let i = await waitFor((x) => x.state === 'playing' && x.level === -1 && x.near === 1, { timeout: 60000 });
  check(i.state === 'playing' && i.hub && i.near === 1, 'Enter em Jogar: o mapa das fases, na frente da bandeirinha 1 (save novo)', { state: i.state, level: i.level, near: i.near });
  const sign = await ev(() => ({ on: document.querySelector('.rr-sign').classList.contains('is-on'), text: document.querySelector('.rr-sign__name').textContent, prompt: document.querySelector('.rr-prompt__text').textContent }));
  check(sign.on && sign.text.length > 0 && sign.prompt === 'Entrar', 'plaquinha da fase 1 e o prompt Entrar', sign);
  m = await music();
  check(m.theme === 'mapa' && m.playing === 'mapa', 'no mapa, o tema do mapa', m);
  await sleep(500);
  await shot('menu-04-mapa.png');
  // pausa do mapa: Continuar e Menu inicial (sem Reiniciar fase nem Mapa)
  await press('Escape', 300);
  u = await ui();
  const pauseActs = await ev(() => [...document.querySelectorAll('.rr-pause [data-action]')].filter((el) => el.getClientRects().length > 0).map((el) => el.dataset.action));
  check(u.state === 'paused' && u.focus === 'resume' && !pauseActs.includes('restart') && !pauseActs.includes('map') && pauseActs.includes('menu'), 'pausa no mapa: Continuar e Menu inicial', { u, pauseActs });
  u = await pressUntil('ArrowDown', (f) => f === 'menu', 4);
  await press('Enter', 400);
  u = await waitFor((x) => x.state === 'title', { timeout: 10000 }).then(() => ui());
  check(u.state === 'title' && u.screen === 'main' && u.hub, 'Menu inicial: a tela inicial sobre o mapa', u);
  m = await music();
  check(m.theme === 'menu', 'de volta à tela inicial: o tema do menu', m);
  await press('Escape', 250);
  u = await ui();
  check(u.state === 'title' && u.screen === 'main', 'Esc na tela principal não faz nada', u);

  console.log('\n== Teclado: Opções (efeitos e música) ==');
  u = await pressUntil('ArrowDown', (f) => f === 'story' || f === 'options');
  u = await pressUntil('ArrowRight', (f) => f === 'options', 2);
  check(u.focus === 'options', 'setas: Opções', u);
  await press('Enter', 300);
  u = await ui();
  check(u.screen === 'options' && u.focus === 'volume', 'Opções abre com o foco no volume dos efeitos', u);
  acts = await visibleActions();
  check(['back', 'quality:', 'hints'].every((a) => acts.some((x) => x.startsWith(a.replace(':', '')))), 'Opções: Voltar, qualidade e dicas', acts);
  check(!(await shown('.rr-title__controls')), 'barra de teclas escondida em Opções');
  const vol0 = await ev(() => Math.round(window.__game.audio.getVolume() * 100));
  await press('ArrowRight', 150);
  const vol = await ev(() => ({ audio: Math.round(window.__game.audio.getVolume() * 100), ranges: [...document.querySelectorAll('.rr-range--sfx')].map((r) => Number(r.value)) }));
  check(vol.audio === Math.min(100, vol0 + 5) && vol.ranges.length === 2 && vol.ranges.every((v) => v === vol.audio), 'seta para a direita nos efeitos: +5 e as duas cópias (Opções e pausa) iguais', { vol0, vol });
  await press('ArrowLeft', 150);
  // os dois volumes um embaixo do outro: ↓ passa para o da música, ←/→ mexem só nele
  await press('ArrowDown', 150);
  u = await ui();
  check(u.focus === 'music-volume', 'seta para baixo: o volume da música', u);
  const mv0 = (await music()).vol;
  await press('ArrowLeft', 150);
  const mv = await ev(() => ({ music: Math.round(window.__game.audio.musicVolume * 100), sfx: Math.round(window.__game.audio.getVolume() * 100), ranges: [...document.querySelectorAll('.rr-range--music')].map((r) => Number(r.value)) }));
  check(mv.music === Math.max(0, mv0 - 5) && mv.sfx === vol0 && mv.ranges.length === 2 && mv.ranges.every((v) => v === mv.music), 'seta para a esquerda na música: −5 só na música, nas duas cópias', { mv0, vol0, mv });
  m = await music();
  check(m.stored?.volume === mv.music / 100, 'volume da música salvo no navegador', m.stored);
  await press('ArrowRight', 150);
  await shot('menu-05-opcoes.png');
  u = await pressUntil('ArrowDown', (f) => /^hints:/.test(f || ''));
  check(/^hints:/.test(u.focus || ''), 'setas para baixo alcançam a linha das dicas', u);
  u = await pressUntil('ArrowRight', (f) => f === 'hints:off', 3);
  check(u.focus === 'hints:off', 'seta para a direita: Desligadas', u);
  await press('Enter', 200);
  const off = await ev(() => ({
    setting: window.__game.settings.noHints,
    stored: localStorage.getItem('rr-settings-v1'),
    hints: document.querySelector('.rr').dataset.hints,
    selected: document.querySelector('.rr-title .rr-hopt[data-hints="off"]').classList.contains('is-selected'),
    note: document.querySelector('.rr-title .rr-hints__now').textContent,
  }));
  check(off.setting === true && off.hints === 'off' && off.selected && /desafio/.test(off.note), 'Enter: modo sem dicas ligado e marcado', off);
  check(off.stored === '{"noHints":true}', 'escolha salva no navegador (rr-settings-v1)', off.stored);
  await shot('menu-06-opcoes-sem-dicas.png');
  await press('Escape', 250);
  u = await ui();
  check(u.screen === 'main' && u.focus === 'options', 'Esc: volta à tela principal com o foco em Opções', u);

  console.log('\n== O mapa segue o save; o modo sem dicas depois de recarregar ==');
  await ev((saved) => localStorage.setItem('rr-progress-v1', saved), JSON.stringify({ v: 1, levels: { fase1: DONE, fase2: DONE }, last: 'fase2' }));
  await load('');
  const kept = await ev(() => ({ noHints: window.__game.settings.noHints, hints: document.querySelector('.rr').dataset.hints }));
  check(kept.noHints === true && kept.hints === 'off', 'recarregou: o modo sem dicas continua ligado', kept);
  hm = await home();
  check(/^4 de \d+ biscoitos$/.test(hm.stats[0]) && /^2 de \d+ fases concluídas$/.test(hm.stats[1]), 'a tela inicial conta os biscoitos e as fases do save', hm.stats);
  check(/^Continuar · Fase 3 · /.test(hm.sub), 'o Jogar continua na Fase 3', hm.sub);
  await press('Enter', 300);
  i = await waitFor((x) => x.state === 'playing' && x.hub && x.near === 3, { timeout: 60000 });
  check(i.hub && i.near === 3 && i.next === 3, 'fases 1 e 2 concluídas: o mapa abre na frente da bandeirinha 3', { near: i.near, next: i.next });
  const plate = await ev(() => document.querySelector('.rr-mapplate__done').textContent);
  check(/^2\/\d+/.test(plate.replace(/\s/g, '')), 'a placa da cidade conta as fases concluídas', plate);
  await shot('menu-07-mapa-fase3.png');
  await press('KeyE', 200);
  i = await waitFor((x) => x.state === 'intro' && x.level === 2, { timeout: 60000 });
  check(i.state === 'intro' && i.levelId === 'fase3', 'E na bandeirinha: o cartão da fase 3', i.levelId);
  await sleep(1200);
  check(await shown('.rr-intro .rr-back'), 'cartão de abertura com Voltar');
  await press('Escape', 300);
  i = await waitFor((x) => x.state === 'playing' && x.hub && x.near === 3, { timeout: 60000 });
  check(i.hub && i.near === 3, 'Esc no cartão de abertura: de volta ao mapa, na frente da bandeirinha 3', { near: i.near, level: i.level });
  await press('KeyE', 200);
  i = await waitFor((x) => x.state === 'intro', { timeout: 60000 });
  check(i.state === 'intro' && i.levelId === 'fase3', 'E de novo: o cartão da fase 3', i.levelId);
  await sleep(800);
  await press('Enter', 300);
  i = await waitFor((x) => x.state === 'playing', { timeout: 10000 });
  check(i.state === 'playing', 'Começar: partida da fase 3');
  await H.gsleep(1500);
  m = await music();
  check(m.theme === 'fase3' && m.playing === 'fase3', 'na fase 3, o tema dela', m);

  // marcador: com a dog longe do alvo do objetivo (perto dele o marcador some de qualquer jeito)
  const away = async () => {
    const t = (await logOf('objective')).at(-1)?.target ?? (await ev(() => window.__game.game.puzzle.objective(window.__game.game.activeDog).target));
    let d = (await info()).dogs[(await info()).activeDog];
    let dist = Math.hypot(d.x - t.x, d.z - t.z);
    if (dist < 2) {
      await ev(([tx, tz]) => { const g = window.__game.game; g.debug.teleport(g.activeDog, tx + 2.6, tz); }, [t.x, t.z]);
      await H.gsleep(300);
      d = (await info()).dogs[(await info()).activeDog];
      dist = Math.hypot(d.x - t.x, d.z - t.z);
    }
    return { target: t, dist };
  };
  let where = await away();
  await H.gsleep(800);
  const hud = () => ev(() => {
    const g = window.__game;
    const vis = (s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== 'none' && !el.classList.contains('is-empty'); };
    return {
      text: g.game.puzzle.objective(g.game.activeDog)?.text || '',
      objective: vis('.rr-objective'),
      chip: vis('.rr-nohints'),
      marker: g.feedback.marker.visible,
      hint: vis('.rr-hint') && document.querySelector('.rr-hint').classList.contains('is-on'),
    };
  });
  await ev(() => window.__game.events.emit('hint', { text: 'Uma dica de teste (E)', duration: 30 }));
  await sleep(300);
  let h = await hud();
  check(h.text.length > 0 && !h.objective, 'sem dicas: a fase tem objetivo, mas o texto não aparece', h);
  check(where.dist > 1.6 && h.marker === false, 'sem dicas: marcador do objetivo escondido (dog longe do alvo)', { ...where, marker: h.marker });
  check(!h.hint, 'sem dicas: dica em balão não aparece', h);
  check(h.chip, 'selo "sem dicas" no HUD', h);
  await shot('menu-08-jogando-sem-dicas.png');

  console.log('\n== Pausa: religar as dicas ==');
  await press('Escape', 300);
  u = await ui();
  check(u.state === 'paused' && u.focus === 'resume', 'Esc pausa com o foco em Continuar', u);
  check(await shown('.rr-pause .rr-ctl-table'), 'controles continuam na pausa');
  u = await pressUntil('ArrowDown', (f) => /^hints:/.test(f || ''), 8);
  u = await pressUntil('ArrowLeft', (f) => f === 'hints:on', 3);
  check(u.focus === 'hints:on', 'pausa: setas alcançam Dicas ligadas', u);
  await press('Enter', 200);
  const on = await ev(() => ({ setting: window.__game.settings.noHints, stored: localStorage.getItem('rr-settings-v1'), hints: document.querySelector('.rr').dataset.hints }));
  check(on.setting === false && on.hints === 'on' && on.stored === '{"noHints":false}', 'pausa: dicas religadas e salvas', on);
  const card = await ev(() => {
    const el = document.querySelector('.rr-card--pause');
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, vh: innerHeight, scroll: el.scrollHeight - el.clientHeight };
  });
  check(card.top >= 0 && card.bottom <= card.vh && card.scroll <= 1, 'pausa com a linha das dicas cabe em 1280×720, sem rolar', card);
  await shot('menu-09-pausa-dicas.png');
  await press('Escape', 300);
  i = await waitFor((x) => x.state === 'playing', { timeout: 5000 });
  where = await away();
  await H.gsleep(1200);
  await ev(() => window.__game.events.emit('hint', { text: 'Outra dica de teste (E)', duration: 30 }));
  await sleep(300);
  h = await hud();
  check(h.objective && !h.chip && h.hint, 'com dicas: objetivo e dica de volta, sem o selo', h);
  check(where.dist > 1.6 && h.marker === true, 'com dicas: marcador do objetivo de volta', { ...where, marker: h.marker });
  await shot('menu-10-jogando-com-dicas.png');

  console.log('\n== Controle: tela principal, Opções e Jogar → mapa ==');
  await ev(() => localStorage.removeItem('rr-progress-v1'));
  await load('');
  await connect();
  await tap(B.UP);
  u = await ui();
  check(u.device === 'gamepad' && u.screen === 'main' && u.focus === 'play', 'controle conectado: foco em Jogar', u);
  await tap(B.DOWN);
  u = await ui();
  check(u.focus === 'story', 'D-pad baixo: História', u);
  await tap(B.RIGHT);
  u = await ui();
  check(u.focus === 'options', 'D-pad: Opções', u);
  await tap(B.LEFT);
  u = await ui();
  check(u.focus === 'story', 'D-pad esquerda: História', u);
  await tap(B.UP);
  await axes(0, 1);
  await sleep(120);
  await axes(0, 0);
  await sleep(160);
  u = await ui();
  check(u.focus === 'story', 'analógico para baixo: História', u);
  await tap(B.LEFT);
  await tap(B.A);
  u = await ui();
  check(u.screen === 'main' && u.focus === 'story' && u.state === 'title', '✕ na História: continua na tela principal (em breve)', u);
  await tap(B.B);
  u = await ui();
  check(u.screen === 'main' && u.state === 'title', '○ na tela principal não faz nada', u);
  await tap(B.RIGHT);
  await tap(B.A);
  u = await ui();
  check(u.screen === 'options' && u.focus === 'volume', '✕ em Opções: foco no volume dos efeitos', u);
  await tap(B.DOWN);
  u = await ui();
  check(u.focus === 'music-volume', 'D-pad baixo: o volume da música', u);
  const glyphs = await ev(() => {
    const g = document.querySelector('.rr-title .rr-back .rr-g');
    const vis = (s) => { const e = g.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; };
    return { pad: vis('.k-pad'), kb: vis('.k-kb'), circle: !!g.querySelector('.k-pad .rr-pad--b') };
  });
  check(glyphs.pad && !glyphs.kb && glyphs.circle, 'Voltar mostra o ○ do controle', glyphs);
  await sleep(400);
  await shot('menu-11-opcoes-controle.png');
  await tap(B.B);
  u = await ui();
  check(u.screen === 'main' && u.focus === 'options', '○ volta de Opções com o foco em Opções', u);
  // Jogar → o mapa; na frente da bandeirinha, ○ (interagir) abre o cartão; ○ no cartão volta ao mapa
  await tap(B.UP);
  u = await ui();
  check(u.focus === 'play', 'D-pad cima: Jogar', u);
  await tap(B.A);
  i = await waitFor((x) => x.state === 'playing' && x.hub && x.near === 1, { timeout: 60000 });
  check(i.hub && i.near === 1, '✕ em Jogar: o mapa, na frente da bandeirinha 1', { near: i.near });
  await tap(B.B);
  i = await waitFor((x) => x.state === 'intro', { timeout: 60000 });
  check(i.state === 'intro' && i.levelId === 'fase1', '○ na frente da bandeirinha: cartão da fase 1', i.levelId);
  await sleep(600);
  await tap(B.B);
  i = await waitFor((x) => x.state === 'playing' && x.hub && x.near != null, { timeout: 60000 });
  check(i.hub && i.near === 1, '○ no cartão de abertura: de volta ao mapa', { near: i.near, state: i.state });
  await tap(B.B);
  i = await waitFor((x) => x.state === 'intro', { timeout: 60000 });
  await sleep(600);
  await tap(B.A);
  i = await waitFor((x) => x.state === 'playing', { timeout: 10000 });
  check(i.state === 'playing' && (await logOf('dog:jump')).length === 0, '✕ em Começar: partida (o ✕ do menu não vira pulo)', i.state);

  await screenSizes();
} catch (err) {
  check(false, `erro inesperado: ${err.stack || err.message}`);
} finally {
  const failed = await H.close();
  process.exit(failed ? 1 : 0);
}
