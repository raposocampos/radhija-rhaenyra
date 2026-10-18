// Navegação nos menus por teclado (setas/Tab) e controle (D-pad/analógico/A/B/Start): foco espacial
// entre os elementos [data-nav] da camada de menu visível, com o mesmo realce para os dois dispositivos.
import { events } from '../core/events.js';

/**
 * Foco espacial. opts: { root, audio, getLayer() (camada de menu ativa ou null),
 *                        slider: { step(dx, el) } (um controle de volume [data-slider] consome esquerda/direita) }
 * Foco inicial: o primeiro [data-default] visível da camada (na tela inicial, o da tela do menu aberta).
 */
export function createMenuFocus({ root, audio, getLayer, slider }) {
  const nav = { el: null };
  function focusables() {
    const layer = getLayer();
    if (!layer) return [];
    return [...layer.querySelectorAll('[data-nav]')].filter((e) => !e.disabled && e.offsetParent !== null);
  }
  function defaultFocus() {
    const list = focusables();
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
      slider.step(dx, nav.el);
      audio?.play?.('uiMove');
      return;
    }
    const r0 = nav.el.getBoundingClientRect();
    const cx = r0.left + r0.width / 2;
    const cy = r0.top + r0.height / 2;
    let best = null;
    let bestAligned = false;
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
      // Um vizinho na mesma faixa tem prioridade sobre qualquer diagonal.
      // O centro de um botão largo na linha de cima pode estar mais perto,
      // mas não deve capturar esquerda/direita entre os botões lado a lado.
      const aligned = ortho === 0;
      if ((aligned && !bestAligned) || (aligned === bestAligned && score < bestScore)) {
        bestAligned = aligned;
        bestScore = score;
        best = el;
      }
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

  return {
    focusables, defaultFocus, setFocus, showNav, moveFocus, cycleFocus,
    /** Elemento com foco (ou null). */
    get el() { return nav.el; },
  };
}

/**
 * Controle nos menus (polling a cada quadro, chamado pelo update da UI).
 * opts: { focus (createMenuFocus), audio, getLayer(), getUiState(), activate(), back?() (○ · B fora da pausa),
 *         setDevice(type), setPadStyle?(id) }
 * → { poll(dt), frameState } (frameState: estado do jogo no fim do quadro anterior, para o Start não
 *    pausar e retomar no mesmo toque)
 */
export function createMenuPad({ focus, audio, getLayer, getUiState, activate, back, setDevice, setPadStyle }) {
  const pad = { prev: {}, hold: { up: 0, down: 0, left: 0, right: 0 }, frameState: null };
  function poll(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : null;
    let gp = null;
    if (pads) for (const p of pads) if (p && p.connected !== false) { gp = p; break; }
    if (!gp) { pad.prev = {}; return; }
    setPadStyle?.(gp.id || '');
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

    const uiState = getUiState();
    const gm = window.__game?.game;
    const gstate = gm?.state ?? uiState;
    const before = pad.frameState;
    // Start: pausa/retoma, sem dupla ação se o jogo já tratou neste quadro.
    if (edge('Start')) {
      if (before === 'playing' && gstate === 'playing') events.emit('ui:pause', {});
      else if (before === 'paused' && gstate === 'paused') { audio?.play?.('uiClick'); events.emit('ui:resume', {}); }
      else if (gstate === 'title' || gstate === 'intro') activate();
    }
    const layer = getLayer();
    if (!layer) return;
    // Direções com repetição ao segurar.
    for (const [k, dx, dy] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]]) {
      if (!now[k]) { pad.hold[k] = 0; continue; }
      if (!prev[k]) { pad.hold[k] = -0.42; focus.moveFocus(dx, dy); continue; }
      pad.hold[k] += dt;
      if (pad.hold[k] >= 0) { pad.hold[k] -= 0.13; focus.moveFocus(dx, dy); }
    }
    if (edge('A')) { focus.showNav(true); activate(); }
    if (edge('B')) {
      // ○ · B volta: na pausa retoma (o mesmo quadro do Start não conta), nas telas do menu volta uma tela
      if (getUiState() === 'paused') {
        if (before === 'paused') { audio?.play?.('uiBack'); events.emit('ui:resume', {}); }
      } else back?.();
    }
  }
  return {
    poll,
    get frameState() { return pad.frameState; },
    set frameState(s) { pad.frameState = s; },
  };
}
