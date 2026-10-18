// Interface (DOM em #ui): tela inicial com o menu, transição entre fases, cartão de abertura,
// HUD, pausa, comemoração e vitória. Navegação por teclado e controle (gamepad); menus também por ponteiro/toque.
// Telas do menu inicial (data-screen da camada .rr-title): main (Jogar, Opções) → modes (Modo História "em breve",
// Fases) → levels (Continuar e os cartões das fases); options (volume, qualidade, dicas, tela cheia). Voltar com
// Esc, ○ · B ou o botão do canto; do cartão de abertura, Voltar leva de novo à tela das fases.
// API: createUI({ audio, layout, levels, params, unlockAll, input, quality, settings }) → { update(dt), state, screen, ... }
// unlockAll: catálogo de desenvolvimento (?level=<id>), com todas as fases liberadas no menu para teste.
// input: a entrada do jogo (controles de toque, touchControls.js); quality: engine.quality (menu de qualidade);
// settings: opções salvas (src/core/settings.js; modo sem dicas: .rr[data-hints="off"] esconde objetivo e dicas).
// No celular/tablet (quality.device), a raiz ganha data-mobile e o CSS usa o layout compacto; o PC não muda.
// Ouve: game:state, game:reset, level:loading, level:loaded, level:error, objective, dog:switch, companion:stay,
//       interact:prompt, hint, collectible:pickup, victory, input:device, quality:change, settings:change.
// Emite: ui:play, ui:pause, ui:resume, ui:restart, ui:nextLevel, ui:selectLevel {index}, ui:menu, ui:cancelLoad.
// Partes: markup.js (template e HTML gerado), hud.js, curtain.js (transição), menuNav.js (foco e
// controle nos menus), touchControls.js (joystick e botões de toque), progress.js (progresso salvo), icons.js e ui.css.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './ui.css';
import { events } from '../core/events.js';
import { boneIcon, clockIcon, restartIcon, itemIcon, lockIcon, checkIcon, trophyIcon, homeIcon, nextIcon, sparkIcon } from './icons.js';
import { esc, fmtTime, treatMessage, pawPattern, template, QUALITY_NAMES, HINTS_NOTE, MODES } from './markup.js';
import { loadProgress, saveProgress, recordLevelClear, recordLastPlayed, continueTarget } from './progress.js';
import { createHud, retrigger } from './hud.js';
import { createCurtain } from './curtain.js';
import { createMenuFocus, createMenuPad } from './menuNav.js';
import { createTouchControls } from './touchControls.js';

/** Telas do menu inicial e a tela de onde cada uma é aberta (Voltar). */
const SCREEN_PARENT = { main: null, modes: 'main', levels: 'modes', options: 'main' };
/** Botão que abre cada tela: ganha o foco ao voltar dela. */
const SCREEN_OPENER = { modes: 'play', levels: 'levels', options: 'options' };

/**
 * @param {{ audio?: any, layout?: import('../types').LevelLayout, levels?: import('../types').LevelDef[], params?: URLSearchParams,
 *           unlockAll?: boolean, input?: any, quality?: any, settings?: { noHints: boolean, setNoHints(on: boolean): void } }} [opts]
 */
export function createUI({ audio, layout, levels, params, unlockAll = false, input = null, quality = null, settings = null } = {}) {
  /** @type {Partial<import('../types').LevelDef>[]} */
  const LV = levels?.length ? levels : [{ id: 'fase1', number: 1, name: 'Operação Cenoura', item: 'carrot', layout, texts: {} }];
  const host = document.getElementById('ui');
  host.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'rr';
  root.dataset.device = 'keyboard';
  root.dataset.pad = 'ps'; // desenho dos botões: 'ps' (padrão) ou 'xbox', conforme o controle conectado
  root.dataset.dog = 'radhija'; // cachorrinha ativa: os botões de toque de bafo/arrancada mudam com ela
  // Celular ou tablet: layout compacto (ui.css, .rr[data-mobile]); no PC o atributo não existe e nada muda.
  const mobile = quality?.device && quality.device !== 'desktop' ? quality.device : null;
  if (mobile) root.dataset.mobile = mobile;
  root.innerHTML = template();
  host.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const L = {
    title: $('.rr-title'),
    intro: $('.rr-intro'),
    hud: $('.rr-hud'),
    celebrate: $('.rr-celebrate'),
    pause: $('.rr-pause'),
    victory: $('.rr-victory'),
    loadError: $('.rr-load-error'),
  };
  /** @param {string} s */
  const $$ = (s) => /** @type {HTMLElement[]} */ ([...root.querySelectorAll(s)]);
  // volume, qualidade, dicas e tela cheia existem na tela Opções e na pausa (settingsBlock): todas as cópias juntas
  const ranges = /** @type {HTMLInputElement[]} */ ($$('.rr-range'));
  $('.rr-curtain__pattern').style.backgroundImage = pawPattern('rgba(196, 132, 74, 0.13)');

  // Ajusta o viewBox do logotipo ao texto real (depois que a fonte carregar).
  const fitLogo = () => {
    try {
      const svg = $('.rr-logo__svg');
      const bb = svg.querySelector('.rr-logo__words').getBBox();
      if (bb.width > 10) svg.setAttribute('viewBox', `${bb.x - 12} ${bb.y - 6} ${bb.width + 24} ${bb.height + 14}`);
    } catch (_) { /* svg ainda não renderizado */ }
  };
  if (document.fonts?.ready) document.fonts.ready.then(fitLogo);
  document.fonts?.load?.('700 100px Fredoka').then(fitLogo).catch(() => {});
  requestAnimationFrame(fitLogo);

  // ---------- estado ----------
  let uiState = null;
  let victoryData = null;
  let victoryRec = null;
  let playClock = 0;
  let victoryAt = 0;
  let menuScreen = 'main'; // tela do menu inicial (não chamar de screen: esconderia window.screen)
  let nextTitleScreen = 'main'; // tela ao voltar à tela inicial (do cartão de abertura: a das fases)
  let device = 'keyboard';
  let prog = loadProgress();

  const meta = (i) => {
    const d = LV[i] || LV[0];
    return {
      index: i, id: d.id, number: d.number ?? i + 1, name: d.name, subtitle: d.subtitle, intro: d.intro,
      item: d.item || 'carrot', texts: d.texts || {}, total: d.layout?.COLLECTIBLES?.length ?? 0, hasNext: i < LV.length - 1,
    };
  };
  let cur = meta(Math.max(0, Math.min(LV.length - 1, (parseInt(params?.get?.('level') || '1', 10) || 1) - 1)));

  const isDone = (i) => !!prog.levels[LV[i]?.id]?.done;
  const isUnlocked = (i) => unlockAll || i === 0 || isDone(i - 1) || isDone(i);

  // ---------- partes ----------
  const hud = createHud({ $, getTotal: () => cur.total });
  const curtain = createCurtain({
    $, audio,
    levelMeta: (info) => ({ ...meta(info.index ?? cur.index), ...info }),
    itemOf: (m) => LV[m.index]?.item || m.item,
    onCover: () => { hud.setPrompt(null); hud.hideHint(); refreshLayers(); },
    onChange: () => refreshLayers(),
  });
  const blocking = () => curtain.phase === 'cover';
  function menuLayer() {
    if (uiState === 'load-error') return L.loadError;
    if (blocking()) return null;
    if (uiState === 'title') return L.title;
    if (uiState === 'intro') return L.intro;
    if (uiState === 'paused') return L.pause;
    if (uiState === 'victory') return L.victory;
    return null;
  }
  const focus = createMenuFocus({
    root, audio, getLayer: menuLayer,
    slider: { step: (dx, el) => setVolumePct(Number(el.querySelector('input')?.value ?? 70) + dx * 5) },
  });
  const { setFocus, defaultFocus } = focus;

  // ---------- controles de toque ----------
  const touch = createTouchControls({ root, input: () => input });
  // só durante a partida (sem cortina) e com o toque como último dispositivo usado
  const syncTouch = () => touch.setActive(uiState === 'playing' && !blocking() && device === 'touch');

  // ---------- camadas ----------
  function show(name, on) { L[name].classList.toggle('is-on', on); }
  function refreshLayers() {
    const s = uiState;
    const b = blocking();
    show('title', s === 'title' && !b);
    show('intro', s === 'intro' && !b);
    show('hud', s === 'playing' && !b);
    show('pause', s === 'paused' && !b);
    show('celebrate', s === 'celebrating');
    show('victory', s === 'victory');
    show('loadError', s === 'load-error');
    syncTouch();
    const layer = menuLayer();
    // foco fora da camada ou numa tela do menu escondida: o padrão da tela visível
    if (layer && (!focus.el || !focus.focusables().includes(focus.el))) setFocus(defaultFocus(), { silent: true });
    if (!layer) setFocus(null, { silent: true });
  }

  function setState(s) {
    if (s === uiState) return;
    const prev = uiState;
    uiState = s;
    if (s === 'title') {
      resetRun();
      showScreen(nextTitleScreen);
      nextTitleScreen = 'main';
    }
    if (s === 'intro') renderIntro();
    if (s === 'playing' && (prev === 'title' || prev === 'intro' || prev === 'victory' || prev === null)) playClock = 0;
    if (s === 'paused') renderSettings();
    if (s === 'playing') checkOrientation();
    if (s === 'victory') { renderVictory(); victoryAt = performance.now(); }
    if (s !== 'playing') hud.setPrompt(null);
    if (document.activeElement && root.contains(document.activeElement)) /** @type {HTMLElement} */ (document.activeElement).blur();
    refreshLayers();
  }

  function resetRun() {
    hud.reset();
    victoryData = null;
    victoryRec = null;
  }

  // ---------- informação da fase ----------
  function applyLevel(info) {
    cur = { ...meta(info.index ?? cur.index), ...info };
    cur.texts = info.texts || cur.texts || {};
    cur.total = Number.isFinite(info.total) ? info.total : cur.total;
    const ico = itemIcon(cur.item);
    $('.rr-logo__item').innerHTML = ico;
    $('.rr-logo__name').textContent = cur.name || '';
    $('.rr-level__item').innerHTML = ico;
    $('.rr-level__num').textContent = `Fase ${cur.number}`;
    $('.rr-level__name').textContent = cur.name || '';
    hud.setTotalLabel(cur.total);
    $('.rr-celebrate__item').innerHTML = ico;
    $('.rr-celebrate__text').textContent = cur.texts.celebrate || 'Eba! Missão cumprida!';
    $('.rr-victory__badge').innerHTML = ico;
    $('.rr-pause__level').innerHTML = `${ico}<span>Fase ${cur.number} · ${esc(cur.name)}</span>`;
    root.dataset.level = cur.id || '';
    renderIntro();
    renderCards();
  }

  function renderIntro() {
    $('.rr-introcard__badge').innerHTML = itemIcon(cur.item);
    $('.rr-introcard__eyebrow').textContent = `Fase ${cur.number}`;
    $('.rr-introcard__name').textContent = cur.name || '';
    $('.rr-introcard__sub').textContent = cur.subtitle || '';
    $('.rr-introcard__text').textContent = cur.intro || '';
    const p = prog.levels[cur.id];
    const bits = [];
    if (cur.total > 0) bits.push(`<span>${boneIcon()}${cur.total} petiscos escondidos</span>`);
    if (p?.done && Number.isFinite(p.best)) bits.push(`<span>${trophyIcon()}melhor ${fmtTime(p.best)}</span>`);
    $('.rr-introcard__meta').innerHTML = bits.join('');
  }

  // ---------- menu inicial: telas, Continuar e modos ----------
  const levelIds = () => LV.map((d) => d.id);
  const continueInfo = () => continueTarget(levelIds(), prog, { unlockAll });

  /** Mostra uma tela do menu inicial (main, modes, levels, options) e põe o foco no padrão dela. */
  function showScreen(name) {
    const next = Object.hasOwn(SCREEN_PARENT, name) ? name : 'main';
    // depois da primeira troca de tela, as entradas do Jogar e do Opções ficam rápidas (ui.css, .is-moved)
    if (next !== menuScreen) L.title.classList.add('is-moved');
    menuScreen = next;
    L.title.dataset.screen = menuScreen;
    hideTitleNote();
    if (menuScreen === 'modes') renderModes();
    if (menuScreen === 'levels') { renderContinue(); renderCards(); }
    if (menuScreen === 'options') renderSettings();
    if (uiState === 'title') setFocus(defaultFocus(), { silent: true });
  }

  /** Esc, ○ · B ou o botão Voltar: uma tela acima no menu; no cartão de abertura, de volta às fases. */
  function goBack() {
    if (uiState === 'title') {
      const parent = SCREEN_PARENT[menuScreen];
      if (!parent) return;
      audio?.play?.('uiBack');
      const from = menuScreen;
      showScreen(parent);
      const opener = /** @type {HTMLElement} */ (L.title.querySelector(`.rr-screen [data-action="${SCREEN_OPENER[from]}"]`));
      if (opener && focus.focusables().includes(opener)) setFocus(opener, { silent: true });
      return;
    }
    if (uiState === 'intro' && !blocking()) {
      audio?.play?.('uiBack');
      nextTitleScreen = 'levels';
      events.emit('ui:menu', {});
    }
  }

  function renderModes() {
    const done = LV.filter((d) => prog.levels[d.id]?.done).length;
    const treats = LV.reduce((n, d) => n + (prog.levels[d.id]?.treats ?? 0), 0);
    $('.rr-mode__count').textContent = `${LV.length} fases`;
    const bits = [`<span>${checkIcon()}${done} de ${LV.length} concluídas</span>`];
    if (treats > 0) bits.push(`<span>${boneIcon()}${treats}</span>`);
    $('.rr-mode__progress').innerHTML = bits.join('');
  }

  function renderContinue() {
    const { index, fresh } = continueInfo();
    const m = meta(index);
    const verb = fresh ? 'Começar' : 'Continuar';
    const btn = $('.rr-btn--continue');
    btn.dataset.index = String(index);
    btn.setAttribute('aria-label', `${verb}: Fase ${m.number}, ${m.name}`);
    $('.rr-continue__badge').innerHTML = itemIcon(m.item);
    $('.rr-continue__label').textContent = verb;
    $('.rr-continue__level').textContent = `Fase ${m.number} · ${m.name}`;
  }

  function renderCards() {
    const box = $('.rr-levels');
    const target = continueInfo().index;
    // até cinco cartões por linha; com mais fases, linhas equilibradas (7 → 4 + 3)
    box.style.setProperty('--per-row', String(Math.ceil(LV.length / Math.ceil(LV.length / 5))));
    box.innerHTML = LV.map((d, i) => {
      const m = meta(i);
      const p = prog.levels[d.id];
      const locked = !isUnlocked(i) && i !== cur.index;
      const done = !!p?.done;
      let stat;
      if (locked) stat = `<span class="rr-lvcard__stat is-locked">${lockIcon()}Bloqueada</span>`;
      else if (done) {
        stat = `<span class="rr-lvcard__stat">${clockIcon()}${Number.isFinite(p.best) ? fmtTime(p.best) : '—'}</span>`
          + `<span class="rr-lvcard__stat">${boneIcon()}${p.treats ?? 0}/${p.total ?? m.total}</span>`;
      } else stat = '<span class="rr-lvcard__stat is-new">Nova!</span>';
      // realce na fase do Continuar
      const cls = ['rr-lvcard', locked && 'is-locked', done && 'is-done', i === target && 'is-current'].filter(Boolean).join(' ');
      return `<button class="${cls}" data-action="select" data-index="${i}" data-nav aria-label="Fase ${m.number}: ${esc(m.name)}${locked ? ' (bloqueada)' : ''}">
        <span class="rr-lvcard__icon">${itemIcon(m.item)}<b class="rr-lvcard__num">${m.number}</b>${done ? `<i class="rr-lvcard__check">${checkIcon()}</i>` : ''}${locked ? `<i class="rr-lvcard__lock">${lockIcon()}</i>` : ''}</span>
        <span class="rr-lvcard__body"><span class="rr-lvcard__eyebrow">Fase ${m.number}</span><span class="rr-lvcard__name">${esc(m.name)}</span><span class="rr-lvcard__stats">${stat}</span></span>
      </button>`;
    }).join('');
    if (focus.el && !root.contains(focus.el)) setFocus(null, { silent: true });
  }

  // ---------- vitória ----------
  function recordVictory(d) {
    const idx = Number.isFinite(d.level) ? d.level : cur.index;
    const id = d.levelId ?? LV[idx]?.id ?? cur.id;
    if (!id) return null;
    const r = recordLevelClear(id, d, cur.total);
    prog = r.prog;
    return r.rec;
  }

  function renderVictory() {
    const d = victoryData || {};
    const texts = d.texts || cur.texts || {};
    const total = d.total ?? cur.total;
    const got = d.collected ?? hud.count;
    const hasNext = d.hasNext ?? cur.hasNext;
    const rec = victoryRec;
    $('.rr-victory__title').textContent = texts.victoryTitle || `${cur.name || 'Fase'} concluída!`;
    $('.rr-victory__sub').textContent = texts.victorySub || '';
    $('.rr-v-time').textContent = fmtTime(d.timeSec ?? playClock);
    $('.rr-v-treats').innerHTML = `${got}<small>/${total}</small>`;
    const best = $('.rr-stat__best');
    if (rec?.record) best.innerHTML = `<b class="rr-badge">${trophyIcon()}Novo recorde!</b>`;
    else if (rec?.first) best.innerHTML = `${checkIcon()}tempo salvo`;
    else if (rec && Number.isFinite(rec.best)) best.innerHTML = `${trophyIcon()}melhor ${fmtTime(rec.best)}`;
    else best.innerHTML = '';
    const bt = $('.rr-stat__best--treats');
    bt.innerHTML = total > 0 && got >= total ? `<b class="rr-badge rr-badge--sage">${checkIcon()}Todos!</b>` : '';
    $('.rr-victory__msg').textContent = treatMessage(got, total, cur.item);
    L.victory.classList.toggle('is-final', !hasNext);
    const acts = $('.rr-victory__actions');
    acts.innerHTML = hasNext
      ? `<button class="rr-btn rr-btn--primary" data-action="next" data-nav data-default><span>Próxima fase</span>${nextIcon()}</button>
         <button class="rr-btn rr-btn--soft" data-action="restart" data-nav>${restartIcon()}<span>Jogar novamente</span></button>`
      : `<button class="rr-btn rr-btn--primary" data-action="restart" data-nav data-default>${restartIcon()}<span>Jogar novamente</span></button>
         <button class="rr-btn rr-btn--soft" data-action="menu" data-nav>${homeIcon()}<span>Menu inicial</span></button>`;
    if (uiState === 'victory') setFocus(defaultFocus(), { silent: true });
  }

  // ---------- volume ----------
  function paintVolume(v) {
    for (const range of ranges) {
      range.value = String(v);
      range.style.setProperty('--pct', `${v}%`);
      const out = range.parentElement?.querySelector('output');
      if (out) out.textContent = `${v}%`;
    }
  }
  function syncVolume() { paintVolume(Math.round((audio?.getVolume?.() ?? 0.7) * 100)); }
  function setVolumePct(v) {
    v = Math.max(0, Math.min(100, Math.round(v)));
    audio?.setVolume?.(v / 100);
    paintVolume(v);
  }
  syncVolume();
  for (const range of ranges) {
    range.addEventListener('input', () => setVolumePct(Number(range.value)));
    range.addEventListener('change', () => {
      audio?.play?.('uiClick');
      range.blur();
    });
    range.addEventListener('pointerup', () => setTimeout(() => range.blur(), 0));
    range.addEventListener('keydown', (e) => {
      // deixa Esc chegar ao jogo e não prende as setas no slider
      if (!['ArrowLeft', 'ArrowRight'].includes(e.code)) range.blur();
    });
  }

  // ---------- qualidade gráfica (engine.quality) ----------
  function renderQuality() {
    for (const box of $$('.rr-quality:not(.rr-hints)')) box.hidden = !quality;
    if (!quality) return;
    for (const b of $$('.rr-qopt[data-quality]')) {
      const on = b.dataset.quality === quality.mode;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    const now = quality.mode === 'auto' ? `agora: ${QUALITY_NAMES[quality.level] || quality.level}` : '';
    for (const n of $$('.rr-quality:not(.rr-hints) .rr-quality__now')) n.textContent = now;
  }
  events.on('quality:change', () => renderQuality());
  renderQuality();

  // ---------- dicas: modo desafio (settings.noHints) ----------
  function renderHints() {
    const off = !!settings?.noHints;
    root.dataset.hints = off ? 'off' : 'on';
    hud.setNoHints(off);
    for (const box of $$('.rr-hints')) box.hidden = !settings;
    for (const b of $$('.rr-hopt')) {
      const on = (b.dataset.hints === 'off') === off;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    for (const n of $$('.rr-hints__now')) n.textContent = off ? HINTS_NOTE.off : HINTS_NOTE.on;
  }
  events.on('settings:change', () => renderHints());
  renderHints();

  /** Volume, qualidade, dicas e tela cheia em dia (ao abrir Opções ou a pausa). */
  function renderSettings() {
    syncVolume();
    renderQuality();
    renderHints();
    renderFullscreen();
  }

  // ---------- tela cheia e orientação (celular) ----------
  const docAny = /** @type {any} */ (document);
  const fsTarget = /** @type {any} */ (document.documentElement);
  const canFullscreen = () => !!(docAny.fullscreenEnabled || docAny.webkitFullscreenEnabled) && !!(fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen);
  const isFullscreen = () => !!(docAny.fullscreenElement || docAny.webkitFullscreenElement);
  const standalone = () => {
    try { return matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches; } catch { return false; }
  };
  function enterFullscreen() {
    const req = fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen;
    if (!req) return;
    try {
      Promise.resolve(req.call(fsTarget, { navigationUI: 'hide' }))
        .then(() => /** @type {any} */ (window.screen).orientation?.lock?.('landscape'))
        .catch(() => { /* recusado pelo navegador: segue sem tela cheia */ });
    } catch { /* idem */ }
  }
  function exitFullscreen() {
    try { Promise.resolve((docAny.exitFullscreen || docAny.webkitExitFullscreen)?.call(document)).catch(() => {}); } catch { /* idem */ }
  }
  function renderFullscreen() {
    for (const fsBtn of $$('.rr-fullscreen')) {
      fsBtn.hidden = !mobile || !canFullscreen();
      fsBtn.querySelector('span').textContent = isFullscreen() ? 'Sair da tela cheia' : 'Tela cheia';
    }
  }
  document.addEventListener('fullscreenchange', renderFullscreen);
  document.addEventListener('webkitfullscreenchange', renderFullscreen);
  renderFullscreen();
  // No celular, o primeiro toque num botão do menu (Jogar, Começar, uma fase…) já pede tela cheia, uma vez só.
  let autoFullscreen = !!mobile;
  function maybeAutoFullscreen() {
    if (!autoFullscreen || device !== 'touch') return;
    autoFullscreen = false;
    if (canFullscreen() && !isFullscreen() && !standalone()) enterFullscreen();
  }
  // Celular de pé: o aviso "Gire o celular" cobre a tela (CSS) e a partida pausa.
  const portrait = (() => {
    try { return matchMedia('(orientation: portrait)'); } catch { return null; }
  })();
  function checkOrientation() {
    if (mobile === 'phone' && portrait?.matches && uiState === 'playing') events.emit('ui:pause', {});
  }
  portrait?.addEventListener?.('change', checkOrientation);
  // iOS ignora user-scalable=no: a pinça não pode dar zoom na página do jogo (só no celular/tablet)
  if (mobile) for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });

  // ---------- foco e ações ----------
  function activateFocused() {
    const el = focus.el && focus.focusables().includes(focus.el) ? focus.el : defaultFocus();
    if (!el || el.hasAttribute('data-slider')) return;
    if (uiState === 'victory' && performance.now() - victoryAt < 900) return;
    el.classList.add('is-press');
    setTimeout(() => el.classList.remove('is-press'), 160);
    runAction(el);
  }

  /** Abre o cartão da fase `i` (Continuar, um cartão, Próxima fase) e a guarda como a última escolhida. */
  function chooseLevel(i) {
    const id = LV[i]?.id;
    if (id) prog = recordLastPlayed(id, prog).prog;
    events.emit('ui:selectLevel', { index: i });
  }

  function runAction(b) {
    const a = b.dataset.action;
    if (!a) return;
    if (uiState === 'load-error') {
      if (a === 'reload') location.reload();
      else if (a === 'cancel-load') events.emit('ui:cancelLoad', {});
      return;
    }
    if (a === 'fullscreen') {
      audio?.play?.('uiClick');
      if (isFullscreen()) exitFullscreen();
      else enterFullscreen();
      autoFullscreen = false;
      return;
    }
    if (a === 'quality') {
      audio?.play?.('uiClick');
      quality?.setMode(b.dataset.quality);
      renderQuality();
      return;
    }
    if (a === 'hints') {
      audio?.play?.('uiClick');
      settings?.setNoHints(b.dataset.hints === 'off');
      renderHints();
      return;
    }
    if (a === 'back') { goBack(); return; }
    maybeAutoFullscreen();
    audio?.unlock?.();
    if (uiState === 'title') {
      if (a === 'story') {
        audio?.play?.('uiDenied');
        retrigger(b, 'is-deny');
        showTitleNote(`${MODES.story.name}: em breve! Ainda está em desenvolvimento.`, { below: b, icon: sparkIcon() });
        return;
      }
      if (a === 'play' || a === 'options' || a === 'levels') {
        audio?.play?.('uiClick');
        showScreen(a === 'play' ? 'modes' : a);
        return;
      }
      if (a === 'continue') {
        audio?.play?.('uiClick');
        chooseLevel(Number(b.dataset.index) || 0);
        return;
      }
    }
    if (a === 'select') {
      const i = Number(b.dataset.index);
      if (b.classList.contains('is-locked')) {
        audio?.play?.('uiDenied');
        retrigger(b, 'is-deny');
        showTitleNote('Conclua a fase anterior para liberar esta.');
        return;
      }
      audio?.play?.('uiClick');
      chooseLevel(i);
      return;
    }
    audio?.play?.('uiClick');
    if (a === 'start') { if (uiState === 'intro') events.emit('ui:play', {}); }
    else if (a === 'resume') events.emit('ui:resume', {});
    else if (a === 'restart') events.emit('ui:restart', {});
    else if (a === 'next') {
      const nextId = LV[cur.index + 1]?.id;
      if (nextId) prog = recordLastPlayed(nextId, prog).prog;
      events.emit('ui:nextLevel', {});
    } else if (a === 'menu') events.emit('ui:menu', {});
  }

  let noteTimer = 0;
  /**
   * Aviso curto na tela inicial. Sem `below`: 20 px acima da linha de cima dos cartões das fases (quantas linhas a
   * largura da tela fizer); com `below`, logo abaixo desse elemento (o cartão do Modo História).
   * @param {string} text @param {{ below?: HTMLElement | null, icon?: string }} [opts]
   */
  function showTitleNote(text, { below = null, icon = lockIcon() } = {}) {
    let n = $('.rr-levels__note');
    if (!n) {
      n = document.createElement('div');
      n.className = 'rr-levels__note';
      L.title.appendChild(n);
    }
    n.innerHTML = `${icon}<span>${esc(text)}</span>`;
    if (below) {
      n.style.top = `${Math.round(below.getBoundingClientRect().bottom - L.title.getBoundingClientRect().top + 16)}px`;
      n.style.bottom = 'auto';
    } else {
      const above = L.title.getBoundingClientRect().bottom - $('.rr-levels').getBoundingClientRect().top;
      n.style.top = '';
      n.style.bottom = above > 0 ? `${Math.round(above + 20)}px` : '';
    }
    retrigger(n, 'is-on');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => n.classList.remove('is-on'), 2200);
  }
  function hideTitleNote() {
    clearTimeout(noteTimer);
    $('.rr-levels__note')?.classList.remove('is-on');
  }

  root.addEventListener('mousedown', (e) => {
    if (/** @type {Element} */ (e.target).closest('button')) e.preventDefault(); // botão não rouba o foco do teclado
  });
  root.addEventListener('click', (e) => {
    const b = /** @type {HTMLElement} */ (/** @type {Element} */ (e.target).closest('[data-action]'));
    if (!b) return;
    b.blur();
    runAction(b);
  });
  root.addEventListener('pointerover', (e) => {
    const b = /** @type {HTMLElement} */ (/** @type {Element} */ (e.target).closest('[data-nav]'));
    if (!b || b === focus.el) return;
    if (b.tagName === 'BUTTON') audio?.play?.('uiHover');
    if (focus.focusables().includes(b)) setFocus(b, { silent: true });
  });
  addEventListener('pointermove', () => focus.showNav(false), { passive: true });

  // ---------- dispositivo ----------
  function setDevice(type) {
    const t = type === 'gamepad' || type === 'touch' ? type : 'keyboard';
    if (t === device) return;
    device = t;
    root.dataset.device = t;
    syncTouch();
  }

  // Teclado: setas/Tab navegam, Enter confirma. Qualquer gesto destrava o áudio.
  const gestureUnlock = (e) => {
    if (e.type === 'keydown' && (e.code === 'Escape' || e.repeat)) return;
    if (audio && !audio.unlocked && uiState && uiState !== 'title') audio.unlock();
  };
  addEventListener('pointerdown', (e) => {
    gestureUnlock(e);
    setDevice(e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'keyboard');
  }, true);
  // iOS só libera o áudio no fim do toque (pointerdown não basta): também destrava ao soltar o dedo.
  addEventListener('touchend', (e) => gestureUnlock(e), { capture: true, passive: true });
  const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  addEventListener('keydown', (e) => {
    gestureUnlock(e);
    setDevice('keyboard');
    const layer = menuLayer();
    if (!layer) return;
    if (e.code === 'Escape' && (uiState === 'title' || uiState === 'intro')) {
      // Esc nas telas do menu volta uma tela (a pausa continua com o Esc do jogo)
      e.preventDefault();
      if (!e.repeat) goBack();
      return;
    }
    if (DIRS[e.code]) {
      if (/** @type {Element} */ (e.target)?.classList?.contains('rr-range')) return;
      e.preventDefault();
      focus.moveFocus(...DIRS[e.code]);
      if (uiState === 'load-error') focus.el?.focus();
      return;
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      focus.cycleFocus(e.shiftKey ? -1 : 1);
      if (uiState === 'load-error') focus.el?.focus();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      activateFocused();
    }
  });

  // ---------- controle (polling no update) ----------
  // Botões desenhados como os do controle conectado: Xbox (XInput) ou PlayStation (padrão).
  const setPadStyle = (id) => {
    const style = /xbox|xinput|045e/i.test(id) ? 'xbox' : 'ps';
    if (root.dataset.pad !== style) root.dataset.pad = style;
  };
  const menuPad = createMenuPad({ focus, audio, getLayer: menuLayer, getUiState: () => uiState, activate: activateFocused, back: goBack, setDevice, setPadStyle });

  // ---------- eventos do jogo ----------
  events.on('game:state', ({ state }) => setState(state));
  events.on('game:reset', () => { resetRun(); hud.setObjective(''); });
  events.on('level:loading', (info = {}) => {
    if (!info.initial) curtain.cover(info);
  });
  events.on('level:loaded', (info = {}) => {
    applyLevel(info);
    resetRun();
    hud.clearObjective();
    curtain.loaded();
  });
  events.on('level:error', ({ message, canReturn }) => {
    $('#rr-load-error-message').textContent = message;
    const back = /** @type {HTMLButtonElement} */ ($('[data-action="cancel-load"]'));
    back.hidden = !canReturn;
    back.disabled = !canReturn;
    curtain.dismiss();
    document.getElementById('loading')?.remove();
    setState('load-error');
    const reload = /** @type {HTMLButtonElement} */ ($('[data-action="reload"]'));
    setFocus(reload, { silent: true });
    focus.showNav(true);
    reload.focus();
  });
  events.on('objective', ({ text }) => hud.setObjective(text));
  events.on('dog:switch', ({ name }) => {
    hud.setDog(name);
    if (name === 'radhija' || name === 'rhaenyra') root.dataset.dog = name;
  });
  events.on('companion:stay', ({ name, stay: st }) => hud.setStay(name, st));
  events.on('interact:prompt', (p) => hud.setPrompt(p));
  events.on('hint', ({ text, duration }) => hud.showHint(text, duration));
  events.on('collectible:pickup', ({ count: n, total }) => hud.setCount(n ?? hud.count + 1, total ?? cur.total));
  events.on('input:device', (/** @type {{ type?: string }} */ { type } = {}) => setDevice(type));
  events.on('victory', (d = {}) => {
    victoryData = { ...d };
    victoryRec = recordVictory(d);
    if (uiState === 'victory') renderVictory();
  });

  applyLevel(cur);
  hud.setDog('radhija');
  // Com ?play, o jogo entra direto em 'playing': não pisca a tela inicial.
  if (!params?.has?.('play')) setState('title');

  return {
    update(dt) {
      if (uiState === 'playing') playClock += dt;
      // robustez: espelha o estado exposto pelo jogo, caso algum evento tenha se perdido
      const gm = window.__game?.game;
      if (gm) {
        if (typeof gm.state === 'string' && gm.state !== uiState) setState(gm.state);
        if (gm.activeDog && gm.activeDog !== hud.activeDog) { hud.setDog(gm.activeDog); root.dataset.dog = gm.activeDog; }
      }
      try { menuPad.poll(dt); } catch (_) { /* controle indisponível */ }
      menuPad.frameState = gm?.state ?? uiState;
    },
    get state() { return uiState; },
    /** Tela do menu inicial: 'main', 'modes', 'levels' ou 'options'. */
    get screen() { return menuScreen; },
    get device() { return device; },
    setDevice,
    /** Controles de toque (diagnóstico e testes: state(), releaseAll()). */
    touch,
    get mobile() { return mobile; },
    get progress() { return prog; },
    resetProgress() { prog = { v: 1, levels: {} }; saveProgress(prog); renderCards(); renderContinue(); renderModes(); },
    get curtain() { return curtain.phase; },
    get level() { return cur; },
    get focus() { return focus.el; },
  };
}
