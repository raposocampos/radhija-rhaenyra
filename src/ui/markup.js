// Marcação da interface: o template HTML das camadas (tela inicial, cartão da fase, HUD, pausa,
// comemoração, vitória e cortina) e os pedaços de HTML gerados (teclas e botões do controle desenhados,
// texto com "(E)" virando tecla, confete, padrão de patinhas). Só funções puras que devolvem strings.
import {
  boneIcon, dogIcon, pawIcon, clockIcon, speakerIcon, sparkIcon, playIcon, restartIcon,
  heartIcon, homeIcon, followIcon, keyboardIcon, gamepadIcon,
} from './icons.js';

export const DOG_INFO = {
  radhija: { name: 'Radhija', trait: 'ágil' },
  rhaenyra: { name: 'Rhaenyra', trait: 'forte' },
};
export const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
export const ITEM_NOUN = { carrot: 'a cenoura', ball: 'a bolinha', slipper: 'a pantufa', duck: 'o patinho', bear: 'o ursinho' };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------------------
//  Teclas e botões do controle (os dois são desenhados; o CSS mostra o do dispositivo atual)
// ---------------------------------------------------------------------------
export function keyLabel(k) {
  if (!k) return '';
  let s = String(k).replace(/^Key/, '').replace(/^Digit/, '').replace(/(Left|Right)$/, '');
  if (s === 'Escape') s = 'Esc';
  if (s === ' ' || s === 'Space') s = 'Espaço';
  if (s.length === 1) s = s.toUpperCase();
  return s;
}
export const kbd = (k) => {
  const l = keyLabel(k);
  return `<kbd class="rr-key${l.length > 2 ? ' is-wide' : ''}">${esc(l)}</kbd>`;
};
const MENU_LINES = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 3.5h7M2.5 6h7M2.5 8.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
// Cada botão é desenhado nos dois estilos; o CSS mostra o do controle conectado (.rr[data-pad="ps"|"xbox"]).
const face = (cls, xb, ps, label) => `<span class="rr-pad rr-pad--${cls}" aria-label="${label}"><b class="pg-xb">${xb}</b>${ps}</span>`;
const shoulder = (xb, ps) => `<span class="rr-pad rr-pad--sh" aria-label="${ps} / ${xb}"><b class="pg-xb">${xb}</b><b class="pg-ps">${ps}</b></span>`;
export const PAD_BTN = {
  A: face('a', 'A', '<svg class="pg-ps" viewBox="0 0 12 12" aria-hidden="true"><path d="M3.2 3.2l5.6 5.6M8.8 3.2l-5.6 5.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>', 'Xis / A'),
  B: face('b', 'B', '<svg class="pg-ps" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>', 'Bolinha / B'),
  X: face('x', 'X', '<svg class="pg-ps" viewBox="0 0 12 12" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx=".6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>', 'Quadrado / X'),
  Y: face('y', 'Y', '<svg class="pg-ps" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.6l3.5 6H2.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>', 'Triângulo / Y'),
  LB: shoulder('LB', 'L1'),
  RB: shoulder('RB', 'R1'),
  RT: shoulder('RT', 'R2'),
  LT: shoulder('LT', 'L2'),
  Start: `<span class="rr-pad rr-pad--menu" aria-label="Start">${MENU_LINES}</span>`,
  LS: '<span class="rr-pad rr-pad--stick" aria-label="Analógico esquerdo"><i></i></span>',
  DPad: '<span class="rr-pad rr-pad--dpad" aria-label="Direcional"><i></i></span>',
};
const KEY_TO_PAD = {
  E: ['B'], Enter: ['A'], Q: ['LB'], F: ['Y'], Shift: ['RB'], Esc: ['Start'], X: ['X'], WASD: ['LS'], Espaço: ['A'], R: ['LT'],
};
/** Tecla lógica → tecla desenhada + botão do controle equivalente. */
/** @param {string} k @param {{ pad?: string[] }} [opts] */
export function glyph(k, { pad } = {}) {
  const l = k === 'WASD' ? 'WASD' : keyLabel(k);
  const kb = l === 'WASD' ? `<span class="rr-keys">${['W', 'A', 'S', 'D'].map(kbd).join('')}</span>` : kbd(l);
  const pads = pad || KEY_TO_PAD[l];
  if (!pads) return kb;
  return `<span class="rr-g"><span class="k-kb">${kb}</span><span class="k-pad">${pads.map((p) => PAD_BTN[p] || '').join('')}</span></span>`;
}

// Troca "(E)", "(Q)", "(F)", "(segure Shift)" e Shift no texto corrido por
// teclas/botões desenhados. Letras soltas como "E" continuam sendo texto normal.
export function richText(text) {
  const safe = esc(text);
  return safe.replace(/\(([^)]{1,24})\)|\bShift\b/g, (m, inner) => {
    if (inner === undefined) return glyph('Shift');
    const t = inner.trim();
    if (/^(E|Q|F|Shift|Esc|Enter|Espaço)$/.test(t)) return glyph(t);
    if (/\b(E|Q|F|Shift|Esc)\b/.test(t)) return `<span class="rr-aside">${t.replace(/\b(Shift|Esc|E|Q|F)\b/g, (k) => glyph(k))}</span>`;
    return m;
  });
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function treatMessage(n, total, item) {
  if (total > 0 && n >= total) return 'Todos os petiscos! Que faro de campeãs!';
  if (total - n === 1) return 'Faltou só um petisco escondidinho. Quase lá!';
  if (n > 0) return 'Uns petiscos no bolso — e muitos carinhos!';
  return `Os petiscos ficaram para a próxima… mas ${ITEM_NOUN[item] || 'o tesouro'} voltou para casa!`;
}

export function confettiPieces(n) {
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
export function pawPattern(color) {
  const paw = (x, y, r, s) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})" fill="${color}">
    <path d="M0 2.5c-3 0-5.6 3.2-5.6 5.6 0 1.8 1.4 2.6 2.8 2.6 1.2 0 1.8-.6 2.8-.6s1.6.6 2.8.6c1.4 0 2.8-.8 2.8-2.6C5.6 5.7 3 2.5 0 2.5z"/>
    <ellipse cx="-6.4" cy="1.5" rx="1.9" ry="2.4"/><ellipse cx="-2.6" cy="-2.3" rx="1.9" ry="2.5"/><ellipse cx="2.6" cy="-2.3" rx="1.9" ry="2.5"/><ellipse cx="6.4" cy="1.5" rx="1.9" ry="2.4"/></g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">${paw(34, 38, -22, 1.5)}${paw(108, 104, 18, 1.5)}${paw(112, 30, 30, 0.9)}${paw(36, 118, -35, 0.9)}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** @type {[label: string, key: string | null, pads: string[]][]} */
export const CONTROLS = [
  ['Mover', 'WASD', ['LS', 'DPad']],
  ['Interagir · latir', 'E', ['B']],
  ['Latir', null, ['X']],
  ['Pular (Rhaenyra)', 'Space', ['A']],
  ['Superbafo (Radhija): segure e solte', 'R', ['LT']],
  ['Correr · empurrar (segure)', 'Shift', ['RB', 'RT']],
  ['Trocar de cachorrinha', 'Q', ['LB']],
  ['Fica · Vem (companheira)', 'F', ['Y']],
  ['Pausar', 'Esc', ['Start']],
];

export function template() {
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

  <section class="rr-layer rr-load-error" role="alertdialog" aria-modal="true" aria-labelledby="rr-load-error-title" aria-describedby="rr-load-error-message">
    <div class="rr-load-error__card">
      <h2 id="rr-load-error-title">Não foi possível carregar a fase</h2>
      <p id="rr-load-error-message"></p>
      <div class="rr-load-error__actions">
        <button class="rr-btn rr-btn--primary" data-action="reload" data-nav data-default>Recarregar jogo</button>
        <button class="rr-btn rr-btn--soft" data-action="cancel-load" data-nav hidden>Voltar à fase atual</button>
      </div>
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
