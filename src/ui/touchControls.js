// Controles de toque: joystick virtual à esquerda e botões à direita (Agir, Pular, Bafo/Lamber, Arrancada/Empurrar,
// Trocar, Fica/Vem), mais a pausa no canto. Só aparecem durante a partida e depois de um toque na tela (dispositivo
// 'touch'); teclado ou controle os escondem (a UI chama setActive). Cada botão vira a mesma entrada lógica do teclado
// e do controle por input.touch (TOUCH_BUTTONS em src/game/input.js).
// Multitoque por Pointer Events: um dedo no joystick e outros nos botões; arrastar o dedo de um botão para outro
// troca o botão apertado. O joystick é flutuante: tocando fora do aro, ele vem para baixo do dedo.
// API: createTouchControls({ root, input }) → { setActive(on), releaseAll(), releaseStick(), active, stickActive, state() }
import { events } from '../core/events.js';
import { touchStick } from '../game/input.js';
import {
  pawIcon, jumpIcon, windIcon, lickIcon, dashIcon, pushIcon, swapIcon, stayIcon, followIcon, pauseIcon,
} from './icons.js';

/** Rótulo e ícone por cachorrinha (tg-r = Radhija, tg-h = Rhaenyra; o CSS mostra o da ativa por .rr[data-dog]). */
const byDog = (r, h) => `<span class="tg-r">${r}</span><span class="tg-h">${h}</span>`;
const button = (id, icon, label) => `<div class="rr-tbtn rr-tbtn--${id}" data-touch="${id}">
  <span class="rr-tbtn__ico">${icon}</span><span class="rr-tbtn__label">${label}</span></div>`;

function markup() {
  return `<div class="rr-touch__zone"></div>
  <div class="rr-touch__stick"><div class="rr-touch__ring"></div><div class="rr-touch__knob"></div></div>
  <div class="rr-touch__pad">
    ${button('act', pawIcon(), 'Agir')}
    ${button('jump', jumpIcon(), 'Pular')}
    ${button('bafo', byDog(windIcon(), lickIcon()), byDog('Bafo', 'Lamber'))}
    ${button('dash', byDog(dashIcon(), pushIcon()), byDog('Arrancada', 'Empurrar'))}
    ${button('swap', swapIcon(), 'Trocar')}
    ${button('stay', `<span class="tg-fica">${stayIcon()}</span><span class="tg-vem">${followIcon()}</span>`, '<span class="tg-fica">Fica</span><span class="tg-vem">Vem</span>')}
  </div>
  ${button('pause', pauseIcon(), 'Pausa')}`;
}

const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');

/**
 * @param {{ root: HTMLElement, input: () => any }} opts input(): a entrada do jogo (game.input), lida na hora
 */
export function createTouchControls({ root, input }) {
  const el = document.createElement('div');
  el.className = 'rr-touch';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = markup();
  root.appendChild(el);
  const zone = /** @type {HTMLElement} */ (el.querySelector('.rr-touch__zone'));
  const stick = /** @type {HTMLElement} */ (el.querySelector('.rr-touch__stick'));
  const knob = /** @type {HTMLElement} */ (el.querySelector('.rr-touch__knob'));
  const btnEl = (id) => /** @type {HTMLElement} */ (el.querySelector(`[data-touch="${id}"]`));

  let active = false;
  /** @type {Map<number, { kind: 'stick' } | { kind: 'btn', id: string }>} */
  const pointers = new Map();
  const holds = new Map(); // id do botão → quantos dedos
  const st = { pointer: -1, cx: 0, cy: 0, travel: 1 };

  const inp = () => input?.()?.touch;

  // ---------- botões ----------
  function press(id) {
    const n = holds.get(id) || 0;
    holds.set(id, n + 1);
    if (n) return;
    btnEl(id)?.classList.add('is-down');
    inp()?.press(id);
    try { navigator.vibrate?.(8); } catch { /* sem vibração */ }
  }
  function release(id) {
    const n = (holds.get(id) || 0) - 1;
    if (n > 0) { holds.set(id, n); return; }
    holds.delete(id);
    btnEl(id)?.classList.remove('is-down');
    inp()?.release(id);
  }

  // ---------- joystick ----------
  function stickStart(e) {
    const zr = zone.getBoundingClientRect();
    const sr = stick.getBoundingClientRect();
    const r = sr.width / 2;
    st.travel = r * 0.72;
    const restX = sr.left + r;
    const restY = sr.top + r;
    // dentro do aro: o centro fica onde está; fora dele, o joystick vem para baixo do dedo (sem sair da zona)
    if (Math.hypot(e.clientX - restX, e.clientY - restY) <= r) {
      st.cx = restX;
      st.cy = restY;
    } else {
      st.cx = Math.min(zr.right - r, Math.max(zr.left + r, e.clientX));
      st.cy = Math.min(zr.bottom - r, Math.max(zr.top + r, e.clientY));
      const rr = root.getBoundingClientRect();
      stick.style.left = `${st.cx - r - rr.left}px`;
      stick.style.top = `${st.cy - r - rr.top}px`;
      stick.style.bottom = 'auto';
    }
    st.pointer = e.pointerId;
    stick.classList.add('is-on');
    stickMove(e);
  }
  function stickMove(e) {
    let dx = e.clientX - st.cx;
    let dy = e.clientY - st.cy;
    const d = Math.hypot(dx, dy);
    if (d > st.travel) {
      dx *= st.travel / d;
      dy *= st.travel / d;
    }
    knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    const a = touchStick(dx, dy, st.travel);
    inp()?.stick(a.x, a.y, a.m);
  }
  function stickEnd() {
    st.pointer = -1;
    stick.classList.remove('is-on');
    stick.style.left = stick.style.top = stick.style.bottom = '';
    knob.style.transform = '';
    inp()?.stick(0, 0, 0);
  }

  // ---------- ponteiros ----------
  el.addEventListener('pointerdown', (e) => {
    if (!active) return;
    const t = /** @type {Element} */ (e.target);
    const b = /** @type {HTMLElement} */ (t.closest?.('[data-touch]'));
    if (b) {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
      pointers.set(e.pointerId, { kind: 'btn', id: b.dataset.touch });
      press(b.dataset.touch);
      return;
    }
    if ((t === zone || t.closest?.('.rr-touch__stick')) && st.pointer < 0) {
      e.preventDefault();
      try { /** @type {HTMLElement} */ (t).setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
      pointers.set(e.pointerId, { kind: 'stick' });
      stickStart(e);
    }
  });
  el.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (p.kind === 'stick') { stickMove(e); return; }
    if (p.id === 'pause') return;
    // arrastou o dedo para outro botão: solta o antigo e aperta o novo (a pausa só com toque direto)
    const hit = /** @type {HTMLElement} */ (document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-touch]'));
    const id = hit?.dataset.touch;
    if (!id || id === p.id || id === 'pause' || !el.contains(hit)) return;
    release(p.id);
    p.id = id;
    press(id);
  });
  const end = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (p.kind === 'stick') stickEnd();
    else release(p.id);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
  // Toques nos controles não viram rolagem, zoom, menu de contexto nem cliques/mouse simulados.
  for (const type of ['touchstart', 'touchmove', 'touchend']) el.addEventListener(type, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  function releaseAll() {
    for (const [, p] of pointers) if (p.kind === 'btn') btnEl(p.id)?.classList.remove('is-down');
    pointers.clear();
    holds.clear();
    for (const b of el.querySelectorAll('.is-down')) b.classList.remove('is-down');
    if (st.pointer >= 0) stickEnd();
    inp()?.releaseAll();
  }

  // ---------- rótulos que dependem do jogo ----------
  const stay = { radhija: false, rhaenyra: false };
  let activeDog = 'radhija';
  const renderStay = () => { btnEl('stay').dataset.stay = stay[other(activeDog)] ? '1' : '0'; };
  events.on('dog:switch', ({ name }) => {
    if (name !== 'radhija' && name !== 'rhaenyra') return;
    activeDog = name;
    stay[name] = false; // quem vira ativa perde o "fica" (como o HUD)
    renderStay();
  });
  events.on('companion:stay', ({ name, stay: on }) => {
    if (name in stay) stay[name] = !!on;
    renderStay();
  });
  events.on('game:reset', () => {
    stay.radhija = stay.rhaenyra = false;
    renderStay();
  });
  // Agir pulsa quando há o que fazer (o mesmo prompt que mostra a tecla E no HUD)
  events.on('interact:prompt', (p) => btnEl('act').classList.toggle('is-ready', !!p?.text));
  renderStay();

  return {
    el,
    /** Liga/desliga (partida rodando com o toque como dispositivo). Desligar solta tudo. */
    setActive(on) {
      on = !!on;
      if (on === active) return;
      active = on;
      el.classList.toggle('is-on', on);
      if (!on) releaseAll();
    },
    releaseAll,
    /** Solta só o joystick (o dedo continua na tela, mas não move mais a dog até tocar de novo). */
    releaseStick() {
      if (st.pointer < 0) return;
      pointers.delete(st.pointer);
      stickEnd();
    },
    get active() { return active; },
    get stickActive() { return st.pointer >= 0; },
    /** Diagnóstico (testes): ponteiros, botões apertados e o joystick. */
    state() {
      return { active, pointers: pointers.size, held: [...holds.keys()], stick: st.pointer >= 0, input: inp()?.stickState ?? null };
    },
  };
}
