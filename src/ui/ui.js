// Interface (DOM em #ui): tela inicial + seleção de fases, transição entre fases, cartão de abertura,
// HUD, pausa, comemoração e vitória. Navegação por teclado e controle (gamepad). Dono: Agente Polimento.
// API: createUI({ audio, layout, levels, params }) → { update(dt, t), state, progress, device, ... }
// Ouve: game:state, game:reset, level:loading, level:loaded, objective, dog:switch, companion:stay,
//       interact:prompt, hint, collectible:pickup, victory, input:device.
// Emite: ui:play, ui:pause, ui:resume, ui:restart, ui:nextLevel, ui:selectLevel {index}, ui:menu.
// Progresso salvo em localStorage 'rr-progress-v1' = { v:1, levels: { [id]: { done, best, treats, total, clears } } }.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './ui.css';
import { events } from '../core/events.js';
import {
  boneIcon, dogIcon, pawIcon, clockIcon, speakerIcon, sparkIcon, playIcon, restartIcon,
  itemIcon, lockIcon, checkIcon, trophyIcon, heartIcon, homeIcon, nextIcon, followIcon, stayIcon,
  keyboardIcon, gamepadIcon,
} from './icons.js';

const DOG_INFO = {
  radhija: { name: 'Radhija', trait: 'ágil' },
  rhaenyra: { name: 'Rhaenyra', trait: 'forte' },
};
const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
const ITEM_NOUN = { carrot: 'a cenoura', ball: 'a bolinha', slipper: 'a pantufa' };
const PROG_KEY = 'rr-progress-v1';
const CURTAIN_MIN_MS = 1250; // tempo mínimo da cortina na tela (para ler "Fase N · Nome")

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------------------
//  Teclas e botões do controle (os dois são desenhados; o CSS mostra o do dispositivo atual)
// ---------------------------------------------------------------------------
function keyLabel(k) {
  if (!k) return '';
  let s = String(k).replace(/^Key/, '').replace(/^Digit/, '').replace(/(Left|Right)$/, '');
  if (s === 'Escape') s = 'Esc';
  if (s === ' ' || s === 'Space') s = 'Espaço';
  if (s.length === 1) s = s.toUpperCase();
  return s;
}
const kbd = (k) => {
  const l = keyLabel(k);
  return `<kbd class="rr-key${l.length > 2 ? ' is-wide' : ''}">${esc(l)}</kbd>`;
};
const MENU_LINES = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 3.5h7M2.5 6h7M2.5 8.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const PAD_BTN = {
  A: '<span class="rr-pad rr-pad--a" aria-label="A">A</span>',
  B: '<span class="rr-pad rr-pad--b" aria-label="B">B</span>',
  X: '<span class="rr-pad rr-pad--x" aria-label="X">X</span>',
  Y: '<span class="rr-pad rr-pad--y" aria-label="Y">Y</span>',
  LB: '<span class="rr-pad rr-pad--sh" aria-label="LB">LB</span>',
  RB: '<span class="rr-pad rr-pad--sh" aria-label="RB">RB</span>',
  RT: '<span class="rr-pad rr-pad--sh" aria-label="RT">RT</span>',
  Start: `<span class="rr-pad rr-pad--menu" aria-label="Start">${MENU_LINES}</span>`,
  LS: '<span class="rr-pad rr-pad--stick" aria-label="Analógico esquerdo"><i></i></span>',
  DPad: '<span class="rr-pad rr-pad--dpad" aria-label="Direcional"><i></i></span>',
};
const KEY_TO_PAD = {
  E: ['A'], Enter: ['A'], Q: ['LB', 'RB'], F: ['Y'], Shift: ['B'], Esc: ['Start'], X: ['X'], WASD: ['LS'],
};
/** Tecla lógica → tecla desenhada + botão do controle equivalente. */
function glyph(k, { pad } = {}) {
  const l = k === 'WASD' ? 'WASD' : keyLabel(k);
  const kb = l === 'WASD' ? `<span class="rr-keys">${['W', 'A', 'S', 'D'].map(kbd).join('')}</span>` : kbd(l);
  const pads = pad || KEY_TO_PAD[l];
  if (!pads) return kb;
  return `<span class="rr-g"><span class="k-kb">${kb}</span><span class="k-pad">${pads.map((p) => PAD_BTN[p] || '').join('')}</span></span>`;
}

// Troca "(E)", "(Q)", "(F)", "(segure Shift)" por teclas/botões desenhados.
function richText(text) {
  const safe = esc(text);
  return safe.replace(/\(([^)]{1,24})\)/g, (m, inner) => {
    const t = inner.trim();
    if (/^(E|Q|F|Shift|Esc|Enter)$/.test(t)) return glyph(t);
    if (/\b(E|Q|F|Shift|Esc)\b/.test(t)) return `<span class="rr-aside">${t.replace(/\b(Shift|Esc|E|Q|F)\b/g, (k) => glyph(k))}</span>`;
    return m;
  });
}

function fmtTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function treatMessage(n, total, item) {
  if (total > 0 && n >= total) return 'Todos os petiscos! Que faro de campeãs!';
  if (total - n === 1) return 'Faltou só um petisco escondidinho. Quase lá!';
  if (n > 0) return 'Uns petiscos no bolso — e muitos carinhos!';
  return `Os petiscos ficaram para a próxima… mas ${ITEM_NOUN[item] || 'o tesouro'} voltou para casa!`;
}

function confettiPieces(n) {
  const colors = ['#F08A3C', '#7FA36B', '#FFF6E6', '#F27B6B', '#B9A3E3', '#F6C85F', '#4E9A9A'];
  let html = '';
  for (let i = 0; i < n; i++) {
    const left = (i / n) * 100 + (Math.random() * 6 - 3);
    const dur = 3.6 + Math.random() * 3;
    const delay = -Math.random() * dur;
    const sway = Math.round(Math.random() * 120 - 60);
    const spin = Math.round(360 + Math.random() * 540) * (Math.random() < 0.5 ? -1 : 1);
    const c = colors[i % colors.length];
    html += `<i class="${Math.random() < 0.25 ? 'is-round' : ''}" style="left:${left.toFixed(1)}%;background:${c};--dur:${dur.toFixed(2)}s;--delay:${delay.toFixed(2)}s;--sway:${sway}px;--spin:${spin}deg"></i>`;
  }
  return html;
}

// Padrão de patinhas da cortina (SVG em data URI).
function pawPattern(color) {
  const paw = (x, y, r, s) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})" fill="${color}">
    <path d="M0 2.5c-3 0-5.6 3.2-5.6 5.6 0 1.8 1.4 2.6 2.8 2.6 1.2 0 1.8-.6 2.8-.6s1.6.6 2.8.6c1.4 0 2.8-.8 2.8-2.6C5.6 5.7 3 2.5 0 2.5z"/>
    <ellipse cx="-6.4" cy="1.5" rx="1.9" ry="2.4"/><ellipse cx="-2.6" cy="-2.3" rx="1.9" ry="2.5"/><ellipse cx="2.6" cy="-2.3" rx="1.9" ry="2.5"/><ellipse cx="6.4" cy="1.5" rx="1.9" ry="2.4"/></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">${paw(34, 38, -22, 1.5)}${paw(108, 104, 18, 1.5)}${paw(112, 30, 30, 0.9)}${paw(36, 118, -35, 0.9)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const CONTROLS = [
  ['Mover', 'WASD', ['LS', 'DPad']],
  ['Interagir · latir', 'E', ['A']],
  ['Latir', null, ['X']],
  ['Correr · empurrar (segure)', 'Shift', ['B', 'RT']],
  ['Trocar de cachorrinha', 'Q', ['LB', 'RB']],
  ['Fica · Vem (companheira)', 'F', ['Y']],
  ['Pausar', 'Esc', ['Start']],
];

function template() {
  const ctlBar = [
    `<span class="rr-ctl">${glyph('WASD')}Mover</span>`,
    `<span class="rr-ctl">${glyph('Q')}Trocar</span>`,
    `<span class="rr-ctl">${glyph('E')}Interagir</span>`,
    `<span class="rr-ctl">${glyph('F')}Fica · Vem</span>`,
    `<span class="rr-ctl">${glyph('Shift')}Correr · empurrar</span>`,
    `<span class="rr-ctl">${glyph('Esc')}Pausar</span>`,
  ].join('<i class="rr-dot"></i>');
  const ctlRows = CONTROLS.map(([label, key, pads]) => {
    const kb = key ? (key === 'WASD' ? `<span class="rr-keys">${['W', 'A', 'S', 'D'].map(kbd).join('')}</span>` : kbd(key)) : '<span class="rr-none">—</span>';
    return `<span class="rr-ctl-table__label">${esc(label)}</span><span class="rr-ctl-table__kb">${kb}</span><span class="rr-ctl-table__pad">${pads.map((p) => PAD_BTN[p]).join('')}</span>`;
  }).join('');

  return `
  <section class="rr-layer rr-title" aria-label="Tela inicial">
    <div class="rr-title__shade"></div>
    <div class="rr-title__center">
      <div class="rr-logo">
        <svg class="rr-logo__svg" viewBox="0 0 1000 150" role="img" aria-label="Radhija &amp; Rhaenyra">
          <g class="rr-logo__words" text-anchor="middle" font-size="108" stroke-linejoin="round" letter-spacing="1">
            <text x="500" y="122" fill="#3A2719" stroke="#3A2719" stroke-width="16">Radhija <tspan>&amp;</tspan> Rhaenyra</text>
            <text x="500" y="114" fill="#FFF6E6" stroke="#4A3426" stroke-width="14" paint-order="stroke">Radhija <tspan fill="#F08A3C">&amp;</tspan> Rhaenyra</text>
          </g>
        </svg>
        <div class="rr-logo__ribbon"><span class="rr-logo__item"></span><span class="rr-logo__name">Operação Cenoura</span><span class="rr-logo__dogs">${dogIcon('radhija')}${dogIcon('rhaenyra')}</span></div>
      </div>
      <button class="rr-btn rr-btn--primary rr-btn--play" data-action="play" data-nav data-default>${playIcon()}<span>Jogar</span>${glyph('Enter')}</button>
    </div>
    <div class="rr-levels" role="group" aria-label="Fases"></div>
    <div class="rr-title__controls rr-glass">${ctlBar}</div>
  </section>

  <section class="rr-layer rr-intro" aria-label="Abertura da fase">
    <div class="rr-intro__shade"></div>
    <div class="rr-introcard">
      <div class="rr-introcard__top">
        <div class="rr-introcard__badge"></div>
        <div class="rr-introcard__heading">
          <div class="rr-introcard__eyebrow">Fase 1</div>
          <h2 class="rr-introcard__name">Operação Cenoura</h2>
          <div class="rr-introcard__sub"></div>
        </div>
      </div>
      <p class="rr-introcard__text"></p>
      <div class="rr-introcard__foot">
        <button class="rr-btn rr-btn--primary rr-btn--start" data-action="start" data-nav data-default>${playIcon()}<span>Começar</span>${glyph('Enter')}</button>
        <div class="rr-introcard__meta"></div>
      </div>
    </div>
  </section>

  <section class="rr-layer rr-hud" aria-label="Interface do jogo">
    <div class="rr-hud__tl">
      <div class="rr-hud__dogs">
        <div class="rr-chip rr-glass" data-dog="radhija">
          <div class="rr-chip__avatar">${dogIcon('radhija')}</div>
          <div class="rr-chip__text">
            <div class="rr-chip__name"><span class="rr-chip__dogname">Radhija</span><span class="rr-chip__trait">· ágil</span></div>
            <div class="rr-chip__swap">${glyph('Q')}trocar</div>
          </div>
        </div>
        <div class="rr-comp rr-glass" data-dog="rhaenyra" data-stay="0">
          <div class="rr-comp__avatar">${dogIcon('rhaenyra')}</div>
          <div class="rr-comp__text">
            <div class="rr-comp__name">Rhaenyra</div>
            <div class="rr-comp__state"><span class="rr-comp__ico">${followIcon()}</span><span class="rr-comp__label">seguindo</span></div>
          </div>
          <div class="rr-comp__key">${glyph('F')}</div>
        </div>
      </div>
      <div class="rr-objective rr-glass is-empty">
        <span class="rr-objective__icon">${pawIcon()}</span>
        <span class="rr-objective__body"><span class="rr-objective__label">Objetivo</span><span class="rr-objective__text"></span></span>
      </div>
    </div>
    <div class="rr-hud__tr">
      <div class="rr-hud__row">
        <div class="rr-level rr-glass"><span class="rr-level__item"></span><span class="rr-level__num">Fase 1</span><i class="rr-level__sep"></i><span class="rr-level__name">Operação Cenoura</span></div>
        <div class="rr-treats rr-glass" aria-label="Petiscos">${boneIcon()}<span class="rr-treats__count">0</span><span class="rr-treats__total">/3</span></div>
      </div>
      <div class="rr-esc">${glyph('Esc')}pausa</div>
    </div>
    <div class="rr-hud__bottom">
      <div class="rr-hint" role="status">${sparkIcon()}<span class="rr-hint__text"></span></div>
      <div class="rr-prompt rr-glass"><span class="rr-prompt__key"></span><span class="rr-prompt__text"></span></div>
    </div>
  </section>

  <section class="rr-layer rr-celebrate" aria-hidden="true">
    <div class="rr-celebrate__banner rr-glass"><span class="rr-celebrate__item"></span><span class="rr-celebrate__text">Eba!</span></div>
  </section>

  <section class="rr-layer rr-pause" aria-label="Pausa">
    <div class="rr-card rr-card--pause">
      <div class="rr-card__head">${pawIcon()}<h2>Pausa</h2></div>
      <div class="rr-pause__level"></div>
      <div class="rr-card__actions">
        <button class="rr-btn rr-btn--primary" data-action="resume" data-nav data-default>${playIcon()}<span>Continuar</span></button>
        <div class="rr-card__pair">
          <button class="rr-btn rr-btn--soft" data-action="restart" data-nav>${restartIcon()}<span>Reiniciar fase</span></button>
          <button class="rr-btn rr-btn--soft" data-action="menu" data-nav>${homeIcon()}<span>Menu inicial</span></button>
        </div>
      </div>
      <label class="rr-volume" data-nav data-slider>${speakerIcon()}<span>Volume</span><input class="rr-range" type="range" min="0" max="100" step="1" value="70" tabindex="-1"><output>70%</output></label>
      <div class="rr-ctl-table">
        <span></span>
        <span class="rr-ctl-table__head">${keyboardIcon()}Teclado</span>
        <span class="rr-ctl-table__head">${gamepadIcon()}Controle</span>
        ${ctlRows}
      </div>
    </div>
  </section>

  <section class="rr-layer rr-victory" aria-label="Vitória">
    <div class="rr-confetti">${confettiPieces(44)}</div>
    <div class="rr-card rr-card--victory">
      <div class="rr-victory__badge"></div>
      <div class="rr-victory__end">${heartIcon()}<span>Fim da demo! Obrigado por jogar</span>${heartIcon()}</div>
      <h2 class="rr-victory__title">Fase concluída!</h2>
      <p class="rr-victory__sub"></p>
      <div class="rr-stats">
        <div class="rr-stat"><span class="rr-stat__label">${clockIcon()}Tempo</span><strong class="rr-v-time">0:00</strong><span class="rr-stat__best"></span></div>
        <div class="rr-stat"><span class="rr-stat__label">${boneIcon()}Petiscos</span><strong class="rr-v-treats">0<small>/3</small></strong><span class="rr-stat__best rr-stat__best--treats"></span></div>
      </div>
      <p class="rr-victory__msg"></p>
      <div class="rr-victory__actions"></div>
    </div>
  </section>

  <section class="rr-curtain" aria-live="polite">
    <div class="rr-curtain__pattern"></div>
    <div class="rr-curtain__box">
      <div class="rr-curtain__badge"></div>
      <div class="rr-curtain__eyebrow">Fase 2</div>
      <div class="rr-curtain__name">Operação Bolinha</div>
      <div class="rr-curtain__sub"></div>
      <div class="rr-curtain__paws">${pawIcon()}${pawIcon()}${pawIcon()}${pawIcon()}${pawIcon()}</div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
//  Progresso (localStorage, sempre com try/catch)
// ---------------------------------------------------------------------------
function loadProgress() {
  try {
    const o = JSON.parse(localStorage.getItem(PROG_KEY) || 'null');
    if (o && typeof o === 'object' && o.levels && typeof o.levels === 'object') return o;
  } catch (_) { /* sem storage ou JSON inválido */ }
  return { v: 1, levels: {} };
}
function saveProgress(p) {
  try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch (_) { /* sem storage */ }
}

export function createUI({ audio, layout, levels, params } = {}) {
  const LV = levels?.length ? levels : [{ id: 'fase1', number: 1, name: 'Operação Cenoura', item: 'carrot', layout, texts: {} }];
  const host = document.getElementById('ui');
  host.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'rr';
  root.dataset.device = 'keyboard';
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
  };
  const chip = $('.rr-chip');
  const chipAvatar = $('.rr-chip__avatar');
  const chipName = $('.rr-chip__dogname');
  const chipTrait = $('.rr-chip__trait');
  const comp = $('.rr-comp');
  const objective = $('.rr-objective');
  const objectiveText = $('.rr-objective__text');
  const treats = $('.rr-treats');
  const treatsCount = $('.rr-treats__count');
  const treatsTotal = $('.rr-treats__total');
  const prompt = $('.rr-prompt');
  const promptKey = $('.rr-prompt__key');
  const promptText = $('.rr-prompt__text');
  const hint = $('.rr-hint');
  const hintText = $('.rr-hint__text');
  const range = $('.rr-range');
  const rangeOut = $('.rr-volume output');
  const curtainEl = $('.rr-curtain');
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
  let activeDog = null;
  const stay = { radhija: false, rhaenyra: false };
  let objText = '';
  let count = 0;
  let victoryData = null;
  let victoryRec = null;
  let playClock = 0;
  let hintTimer = 0;
  let starting = false;
  let victoryAt = 0;
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
  const isUnlocked = (i) => i === 0 || isDone(i - 1) || isDone(i);

  // ---------- camadas ----------
  const curtain = { phase: 'off', since: 0, loaded: false, timers: [] };
  const blocking = () => curtain.phase === 'cover';

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
    const layer = menuLayer();
    if (layer && (!nav.el || !layer.contains(nav.el))) setFocus(defaultFocus(), { silent: true });
    if (!layer) setFocus(null, { silent: true });
  }

  function setState(s) {
    if (s === uiState) return;
    const prev = uiState;
    uiState = s;
    if (s !== 'title') L.title.classList.remove('is-leaving');
    if (s === 'title') { starting = false; resetRun(); renderCards(); }
    if (s === 'intro') renderIntro();
    if (s === 'playing' && (prev === 'title' || prev === 'intro' || prev === 'victory' || prev === null)) playClock = 0;
    if (s === 'paused') syncVolume();
    if (s === 'victory') { renderVictory(); victoryAt = performance.now(); }
    if (s !== 'playing') setPrompt(null);
    if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    refreshLayers();
  }

  function resetRun() {
    count = 0;
    treatsCount.textContent = '0';
    treats.classList.remove('is-full');
    victoryData = null;
    victoryRec = null;
    stay.radhija = stay.rhaenyra = false;
    renderComp();
    setPrompt(null);
    hideHint();
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
    treatsTotal.textContent = `/${cur.total}`;
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

  function renderCards() {
    const box = $('.rr-levels');
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
      const cls = ['rr-lvcard', locked && 'is-locked', done && 'is-done', i === cur.index && 'is-current'].filter(Boolean).join(' ');
      return `<button class="${cls}" data-action="select" data-index="${i}" data-nav aria-label="Fase ${m.number}: ${esc(m.name)}${locked ? ' (bloqueada)' : ''}">
        <span class="rr-lvcard__icon">${itemIcon(m.item)}<b class="rr-lvcard__num">${m.number}</b>${done ? `<i class="rr-lvcard__check">${checkIcon()}</i>` : ''}${locked ? `<i class="rr-lvcard__lock">${lockIcon()}</i>` : ''}</span>
        <span class="rr-lvcard__body"><span class="rr-lvcard__eyebrow">Fase ${m.number}</span><span class="rr-lvcard__name">${esc(m.name)}</span><span class="rr-lvcard__stats">${stat}</span></span>
      </button>`;
    }).join('');
    if (nav.el && !root.contains(nav.el)) setFocus(null, { silent: true });
  }

  // ---------- transição entre fases ----------
  function clearCurtainTimers() { curtain.timers.forEach(clearTimeout); curtain.timers.length = 0; }
  function curtainCover(info) {
    clearCurtainTimers();
    const m = { ...meta(info.index ?? cur.index), ...info };
    $('.rr-curtain__badge').innerHTML = itemIcon(LV[m.index]?.item || m.item);
    $('.rr-curtain__eyebrow').textContent = `Fase ${m.number}`;
    $('.rr-curtain__name').textContent = m.name || '';
    $('.rr-curtain__sub').textContent = m.subtitle || '';
    curtainEl.classList.remove('is-revealing');
    void curtainEl.offsetWidth;
    curtainEl.classList.add('is-on', 'is-covering');
    curtain.phase = 'cover';
    curtain.since = performance.now();
    curtain.loaded = false;
    audio?.play?.('curtainIn');
    setPrompt(null);
    hideHint();
    refreshLayers();
    curtain.timers.push(setTimeout(curtainReveal, 9000)); // segurança: nunca prende a tela
  }
  function curtainLoaded() {
    if (curtain.phase !== 'cover') return;
    curtain.loaded = true;
    const wait = Math.max(0, CURTAIN_MIN_MS - (performance.now() - curtain.since));
    curtain.timers.push(setTimeout(curtainReveal, wait));
  }
  function curtainReveal() {
    if (curtain.phase !== 'cover') return;
    clearCurtainTimers();
    curtain.phase = 'reveal';
    curtainEl.classList.remove('is-covering');
    curtainEl.classList.add('is-revealing');
    audio?.play?.('curtainOut');
    refreshLayers();
    curtain.timers.push(setTimeout(() => {
      curtainEl.classList.remove('is-on', 'is-revealing');
      curtain.phase = 'off';
    }, 950));
  }

  // ---------- HUD ----------
  function retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function setDog(name) {
    const info = DOG_INFO[name];
    if (!info || name === activeDog) return;
    const first = activeDog === null;
    activeDog = name;
    stay[name] = false; // quem vira ativa perde o "fica"
    chip.dataset.dog = name;
    chipAvatar.innerHTML = dogIcon(name);
    chipName.textContent = info.name;
    chipTrait.textContent = `· ${info.trait}`;
    if (!first) retrigger(chip, 'is-swap');
    renderComp(!first);
  }

  function renderComp(animate) {
    const name = other(activeDog || 'radhija');
    const st = !!stay[name];
    const changedDog = comp.dataset.dog !== name;
    const changedStay = comp.dataset.stay !== (st ? '1' : '0');
    comp.dataset.dog = name;
    comp.dataset.stay = st ? '1' : '0';
    if (changedDog) {
      $('.rr-comp__avatar').innerHTML = dogIcon(name);
      $('.rr-comp__name').textContent = DOG_INFO[name].name;
    }
    $('.rr-comp__ico').innerHTML = st ? stayIcon() : followIcon();
    $('.rr-comp__label').textContent = st ? 'esperando' : 'seguindo';
    comp.title = st ? 'Fica: ela espera aqui. Aperte de novo para chamar (Vem).' : 'Vem: ela segue você. Aperte para ela esperar (Fica).';
    if (animate && (changedDog || changedStay)) retrigger(comp, 'is-pop');
  }

  function setObjective(text) {
    const t = text ? String(text) : '';
    if (t === objText) return;
    objText = t;
    if (!t) { objective.classList.add('is-empty'); return; }
    objectiveText.innerHTML = richText(t);
    objective.classList.remove('is-empty');
    retrigger(objective, 'is-new');
  }

  function setCount(n, total = cur.total) {
    const prev = count;
    count = Math.max(0, n | 0);
    treatsCount.textContent = String(count);
    if (Number.isFinite(total)) treatsTotal.textContent = `/${total}`;
    treats.classList.toggle('is-full', total > 0 && count >= total);
    if (count > prev) retrigger(treats, 'is-pop');
  }

  let promptOn = false;
  function setPrompt(p) {
    const text = p?.text;
    if (!text) {
      if (promptOn) prompt.classList.remove('is-on');
      promptOn = false;
      return;
    }
    promptKey.innerHTML = glyph(p.key ?? 'E');
    promptText.innerHTML = richText(text);
    if (!promptOn) prompt.classList.add('is-on');
    promptOn = true;
  }

  function showHint(text, duration) {
    clearTimeout(hintTimer);
    if (!text) { hideHint(); return; }
    hintText.innerHTML = richText(text);
    if (hint.classList.contains('is-on')) retrigger(hint, 'is-on');
    else hint.classList.add('is-on');
    const ms = Math.max(1.2, Number(duration) || 3.4) * 1000;
    hintTimer = setTimeout(hideHint, ms);
  }
  function hideHint() {
    clearTimeout(hintTimer);
    hint.classList.remove('is-on');
  }

  // ---------- vitória ----------
  function recordVictory(d) {
    const idx = Number.isFinite(d.level) ? d.level : cur.index;
    const id = d.levelId ?? LV[idx]?.id ?? cur.id;
    if (!id) return null;
    prog = loadProgress(); // outra aba pode ter salvo
    const e = prog.levels[id] || {};
    const t = Number(d.timeSec);
    const prevBest = Number.isFinite(e.best) ? e.best : null;
    const better = Number.isFinite(t) && (prevBest === null || t < prevBest);
    prog.levels[id] = {
      done: true,
      best: better ? t : prevBest,
      treats: Math.max(e.treats ?? 0, d.collected ?? 0),
      total: d.total ?? e.total ?? cur.total,
      clears: (e.clears || 0) + 1,
    };
    saveProgress(prog);
    return { best: prog.levels[id].best, record: better && prevBest !== null, first: !e.done, prevTreats: e.treats ?? null };
  }

  function renderVictory() {
    const d = victoryData || {};
    const texts = d.texts || cur.texts || {};
    const total = d.total ?? cur.total;
    const got = d.collected ?? count;
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
  function syncVolume() {
    const v = Math.round((audio?.getVolume?.() ?? 0.7) * 100);
    range.value = String(v);
    rangeOut.textContent = `${v}%`;
    range.style.setProperty('--pct', `${v}%`);
  }
  function setVolumePct(v) {
    v = Math.max(0, Math.min(100, Math.round(v)));
    range.value = String(v);
    audio?.setVolume?.(v / 100);
    rangeOut.textContent = `${v}%`;
    range.style.setProperty('--pct', `${v}%`);
  }
  syncVolume();
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

  // ---------- foco (teclado / controle) ----------
  const nav = { el: null };
  function menuLayer() {
    if (blocking()) return null;
    if (uiState === 'title') return L.title;
    if (uiState === 'intro') return L.intro;
    if (uiState === 'paused') return L.pause;
    if (uiState === 'victory') return L.victory;
    return null;
  }
  function focusables() {
    const layer = menuLayer();
    if (!layer) return [];
    return [...layer.querySelectorAll('[data-nav]')].filter((e) => !e.disabled && e.offsetParent !== null);
  }
  function defaultFocus() {
    const list = focusables();
    if (uiState === 'title') return list.find((e) => e.dataset.action === 'play') || list[0] || null;
    return list.find((e) => e.hasAttribute('data-default')) || list[0] || null;
  }
  function setFocus(el, { silent = false } = {}) {
    if (el === nav.el) return;
    nav.el?.classList.remove('is-focus');
    nav.el = el || null;
    if (nav.el) nav.el.classList.add('is-focus');
    if (!silent && el) audio?.play?.('uiMove');
  }
  function showNav(on) { root.classList.toggle('is-nav', on); }
  function moveFocus(dx, dy) {
    const list = focusables();
    if (!list.length) return;
    showNav(true);
    if (!nav.el || !list.includes(nav.el)) { setFocus(defaultFocus()); return; }
    if (nav.el.hasAttribute('data-slider') && dx) {
      setVolumePct(Number(range.value) + dx * 5);
      audio?.play?.('uiMove');
      return;
    }
    const r0 = nav.el.getBoundingClientRect();
    const cx = r0.left + r0.width / 2;
    const cy = r0.top + r0.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === nav.el) continue;
      const r = el.getBoundingClientRect();
      const vx = r.left + r.width / 2 - cx;
      const vy = r.top + r.height / 2 - cy;
      const along = dx ? vx * dx : vy * dy;
      if (along <= 4) continue;
      // distância perpendicular entre as faixas (0 se elas se sobrepõem): prefere o vizinho "alinhado"
      const ortho = dx
        ? Math.max(0, Math.max(r.top, r0.top) - Math.min(r.bottom, r0.bottom))
        : Math.max(0, Math.max(r.left, r0.left) - Math.min(r.right, r0.right));
      const center = dx ? Math.abs(vy) : Math.abs(vx);
      const score = along + ortho * 3 + center * 0.05;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) setFocus(best);
  }
  function cycleFocus(dir) {
    const list = focusables();
    if (!list.length) return;
    showNav(true);
    const i = list.indexOf(nav.el);
    setFocus(list[(i + dir + list.length) % list.length]);
  }
  function activateFocused() {
    const el = nav.el && focusables().includes(nav.el) ? nav.el : defaultFocus();
    if (!el || el.hasAttribute('data-slider')) return;
    if (uiState === 'victory' && performance.now() - victoryAt < 900) return;
    el.classList.add('is-press');
    setTimeout(() => el.classList.remove('is-press'), 160);
    runAction(el);
  }

  // ---------- ações ----------
  function startGame() {
    if (starting || uiState !== 'title') return;
    starting = true;
    audio?.unlock?.();
    audio?.play?.('uiClick');
    L.title.classList.add('is-leaving');
    events.emit('ui:play', {});
    setTimeout(() => {
      if (uiState === 'title') { starting = false; L.title.classList.remove('is-leaving'); }
    }, 2500);
  }

  function runAction(b) {
    const a = b.dataset.action;
    if (!a) return;
    if (a === 'play') { startGame(); return; }
    audio?.unlock?.();
    if (a === 'select') {
      const i = Number(b.dataset.index);
      if (b.classList.contains('is-locked')) {
        audio?.play?.('uiDenied');
        retrigger(b, 'is-deny');
        showTitleNote('Conclua a fase anterior para liberar esta.');
        return;
      }
      audio?.play?.('uiClick');
      events.emit('ui:selectLevel', { index: i });
      return;
    }
    audio?.play?.('uiClick');
    if (a === 'start') { if (uiState === 'intro') events.emit('ui:play', {}); }
    else if (a === 'resume') events.emit('ui:resume', {});
    else if (a === 'restart') events.emit('ui:restart', {});
    else if (a === 'next') events.emit('ui:nextLevel', {});
    else if (a === 'menu') events.emit('ui:menu', {});
  }

  let noteTimer = 0;
  function showTitleNote(text) {
    let n = $('.rr-levels__note');
    if (!n) {
      n = document.createElement('div');
      n.className = 'rr-levels__note';
      L.title.appendChild(n);
    }
    n.innerHTML = `${lockIcon()}<span>${esc(text)}</span>`;
    retrigger(n, 'is-on');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => n.classList.remove('is-on'), 2200);
  }

  root.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) e.preventDefault(); // botão não rouba o foco do teclado
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    b.blur();
    runAction(b);
  });
  root.addEventListener('pointerover', (e) => {
    const b = e.target.closest('[data-nav]');
    if (!b || b === nav.el) return;
    if (b.tagName === 'BUTTON') audio?.play?.('uiHover');
    if (focusables().includes(b)) setFocus(b, { silent: true });
  });
  addEventListener('pointermove', () => showNav(false), { passive: true });

  // ---------- dispositivo ----------
  function setDevice(type) {
    const t = type === 'gamepad' ? 'gamepad' : 'keyboard';
    if (t === device) return;
    device = t;
    root.dataset.device = t;
  }

  // Teclado: setas/Tab navegam, Enter confirma. Qualquer gesto destrava o áudio.
  const gestureUnlock = (e) => {
    if (e.type === 'keydown' && (e.code === 'Escape' || e.repeat)) return;
    if (audio && !audio.unlocked && uiState && uiState !== 'title') audio.unlock();
  };
  addEventListener('pointerdown', (e) => { gestureUnlock(e); setDevice('keyboard'); }, true);
  const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  addEventListener('keydown', (e) => {
    gestureUnlock(e);
    setDevice('keyboard');
    const layer = menuLayer();
    if (!layer) return;
    if (DIRS[e.code]) {
      if (e.target === range) return;
      e.preventDefault();
      moveFocus(...DIRS[e.code]);
      return;
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      cycleFocus(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      activateFocused();
    }
  });

  // ---------- controle (polling no update) ----------
  const pad = { prev: {}, hold: { up: 0, down: 0, left: 0, right: 0 }, frameState: null };
  function pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    let gp = null;
    if (pads) for (const p of pads) if (p && p.connected !== false) { gp = p; break; }
    if (!gp) { pad.prev = {}; return; }
    const b = (i) => { const x = gp.buttons?.[i]; return !!x && (x.pressed || x.value > 0.5); };
    const ax = gp.axes?.[0] || 0;
    const ay = gp.axes?.[1] || 0;
    const now = {
      A: b(0), B: b(1), X: b(2), Y: b(3), LB: b(4), RB: b(5), Start: b(9),
      up: b(12) || ay < -0.55, down: b(13) || ay > 0.55, left: b(14) || ax < -0.55, right: b(15) || ax > 0.55,
    };
    const prev = pad.prev;
    pad.prev = now;
    const edge = (k) => now[k] && !prev[k];
    let active = false;
    for (const k in now) if (edge(k)) active = true;
    if (Math.hypot(ax, ay) > 0.5 || Math.hypot(gp.axes?.[2] || 0, gp.axes?.[3] || 0) > 0.5) active = true;
    if (active) setDevice('gamepad');

    const gm = window.__game?.game;
    const gstate = gm?.state ?? uiState;
    const before = pad.frameState;
    // Start: pausa/retoma, sem dupla ação se o jogo já tratou neste quadro.
    if (edge('Start')) {
      if (before === 'playing' && gstate === 'playing') events.emit('ui:pause', {});
      else if (before === 'paused' && gstate === 'paused') { audio?.play?.('uiClick'); events.emit('ui:resume', {}); }
      else if (gstate === 'title' || gstate === 'intro') activateFocused();
    }
    const layer = menuLayer();
    if (!layer) return;
    // Direções com repetição ao segurar.
    for (const [k, dx, dy] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]]) {
      if (!now[k]) { pad.hold[k] = 0; continue; }
      if (!prev[k]) { pad.hold[k] = -0.42; moveFocus(dx, dy); continue; }
      pad.hold[k] += dt;
      if (pad.hold[k] >= 0) { pad.hold[k] -= 0.13; moveFocus(dx, dy); }
    }
    if (edge('A')) { showNav(true); activateFocused(); }
    if (edge('B') && uiState === 'paused' && before === 'paused') { audio?.play?.('uiBack'); events.emit('ui:resume', {}); }
  }

  // ---------- eventos do jogo ----------
  events.on('game:state', ({ state }) => setState(state));
  events.on('game:reset', () => { resetRun(); setObjective(''); });
  events.on('level:loading', (info = {}) => {
    if (!info.initial) curtainCover(info);
  });
  events.on('level:loaded', (info = {}) => {
    applyLevel(info);
    resetRun();
    objText = '';
    objective.classList.add('is-empty');
    curtainLoaded();
  });
  events.on('objective', ({ text }) => setObjective(text));
  events.on('dog:switch', ({ name }) => setDog(name));
  events.on('companion:stay', ({ name, stay: st }) => {
    if (!DOG_INFO[name]) return;
    stay[name] = !!st;
    renderComp(true);
  });
  events.on('interact:prompt', (p) => setPrompt(p));
  events.on('hint', ({ text, duration }) => showHint(text, duration));
  events.on('collectible:pickup', ({ count: n, total }) => setCount(n ?? count + 1, total ?? cur.total));
  events.on('input:device', ({ type } = {}) => setDevice(type));
  events.on('victory', (d = {}) => {
    victoryData = { ...d };
    victoryRec = recordVictory(d);
    if (uiState === 'victory') renderVictory();
  });

  applyLevel(cur);
  setDog('radhija');
  // Com ?play, o jogo entra direto em 'playing': não pisca a tela inicial.
  if (!params?.has?.('play')) setState('title');

  return {
    update(dt) {
      if (uiState === 'playing') playClock += dt;
      // robustez: espelha o estado exposto pelo jogo, caso algum evento tenha se perdido
      const gm = window.__game?.game;
      if (gm) {
        if (typeof gm.state === 'string' && gm.state !== uiState && !(starting && gm.state === 'title')) setState(gm.state);
        if (gm.activeDog && gm.activeDog !== activeDog) setDog(gm.activeDog);
      }
      try { pollPad(dt); } catch (_) { /* controle indisponível */ }
      pad.frameState = gm?.state ?? uiState;
    },
    get state() { return uiState; },
    get device() { return device; },
    setDevice,
    get progress() { return prog; },
    resetProgress() { prog = { v: 1, levels: {} }; saveProgress(prog); renderCards(); },
    get curtain() { return curtain.phase; },
    get level() { return cur; },
    get focus() { return nav.el; },
  };
}
