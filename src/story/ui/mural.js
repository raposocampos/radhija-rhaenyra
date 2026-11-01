// O mural provisório do fim do capítulo 1 (docs/MODO-HISTORIA.md, etapa 2): só o caso 3, "A noite da cenoura", com a
// linha do tempo da noite da garoa entre a lua e o sol. Um tutorial curto e sem a Pandora: uma patinha fantasma mostra o
// primeiro cartão indo até perto da lua, em loop, até a primeira jogada. As regras são as de src/story/mural/rules.js:
// a ligação errada volta (o cartão quica de volta e a Radhija balança a cabeça) e o caso só fecha com as pistas
// necessárias — aqui ele não fecha: a casa do cartão que chega num capítulo futuro fica com o "?".
// Arrastar o cartão até a casa, ou tocar no cartão e depois na casa; teclado (setas e Enter/E) e controle (direcional e
// ✕/A) andam pelos cartões e pelas casas. Fecha com "Continuar" → ui:muralDone { errors }.
import { createCaseBoard, CASE3_TIMELINE } from '../mural/rules.js';
import { CASES, CLUES } from '../clues.js';
import { pictoOf, HUD_ICONS } from './pictos.js';
import { pollMenuPad } from '../../game/input.js';

const TRAY_ORDER = ['trilha', 'abraco', 'pote', 'pombos'];
const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' };

/**
 * @param {{ host: HTMLElement, emit: (name: string, payload?: object) => void, sfx?: (name: string) => void }} opts
 */
export function createMuralUI({ host, emit, sfx = () => {} }) {
  const el = document.createElement('section');
  el.className = 'rr-mural';
  el.hidden = true;
  el.setAttribute('aria-label', CASES.C3.name);
  el.innerHTML = `<div class="rr-mural__board">
    <div class="rr-mural__head"><span class="rr-mural__case">${CASES.C3.name}</span></div>
    <div class="rr-mural__line"></div>
    <div class="rr-mural__tray"></div>
    <div class="rr-mural__side"></div>
    <div class="rr-mural__foot"><span class="rr-mural__face">${HUD_ICONS.radhija}</span>
      <button class="rr-btn rr-btn--primary rr-mural__go" type="button" hidden>Continuar</button></div>
    <div class="rr-mural__paw">${HUD_ICONS.pata}</div>
  </div>`;
  host.appendChild(el);
  const $ = (s) => /** @type {HTMLElement} */ (el.querySelector(s));
  const line = $('.rr-mural__line'), tray = $('.rr-mural__tray'), side = $('.rr-mural__side'), face = $('.rr-mural__face');
  const go = /** @type {HTMLButtonElement} */ ($('.rr-mural__go'));
  const paw = $('.rr-mural__paw');

  /** @type {ReturnType<typeof createCaseBoard> | null} */
  let board = null;
  let sel = null;
  let focus = { zone: 'tray', i: 0 };
  let tutorial = true;
  let pawTimer = 0;
  let pawT = 0;
  let open = false;

  const keys = () => board?.keys ?? [];
  const locked = (k) => board?.missing().includes(k);
  const looseCards = () => TRAY_ORDER.filter((id) => board?.loose().includes(id));

  function cardHTML(id, extra = '') {
    return `<div class="rr-mural__card ${extra}" data-id="${id}" role="button" tabindex="-1" aria-label="${CLUES[id]?.name ?? '?'}">${pictoOf(id)}</div>`;
  }
  function render() {
    if (!board) return;
    const placed = board.placed;
    line.innerHTML = `<span class="rr-mural__end">${HUD_ICONS.lua}</span>${keys().map((k, i) => {
      if (locked(k)) return `<div class="rr-mural__slot is-lock${board.settled ? ' is-glow' : ''}" data-slot="${k}" aria-label="casa ${i + 1}">${pictoOf('q')}</div>`;
      const id = placed[k];
      const f = focus.zone === 'line' && focus.i === i ? ' is-focus' : '';
      return id
        ? `<div class="rr-mural__slot is-ok${f}" data-slot="${k}"><span class="rr-mural__pin"></span>${cardHTML(id)}</div>`
        : `<div class="rr-mural__slot${f}" data-slot="${k}" aria-label="casa ${i + 1}">${i + 1}</div>`;
    }).join('')}<span class="rr-mural__end">${HUD_ICONS.sol}</span>`;
    const loose = looseCards();
    tray.innerHTML = loose.map((id, i) => cardHTML(id, `${sel === id ? 'is-sel' : ''} ${focus.zone === 'tray' && focus.i === i ? 'is-focus' : ''}`)).join('');
    go.hidden = !board.settled;
    if (board.settled && focus.zone !== 'go') { focus = { zone: 'go', i: 0 }; go.focus?.(); }
  }
  function renderSide(owned) {
    side.innerHTML = ['pena', 'baba'].filter((id) => owned.includes(id)).map((id) => cardHTML(id)).join('');
  }

  function tryPlace(id, key) {
    if (!board || !id) return;
    const r = board.place(id, key);
    if (r.reason === 'certo') {
      sfx('pino');
      sel = null;
      stopPaw();
      tutorial = false;
      const loose = looseCards();
      focus = loose.length ? { zone: 'tray', i: 0 } : { zone: 'go', i: 0 };
      render();
    } else if (r.reason === 'errado') {
      sfx('erro');
      sel = null;
      stopPaw();
      tutorial = false;
      render();
      tray.querySelector(`[data-id="${id}"]`)?.classList.add('is-bounce');
      face.classList.remove('is-shake');
      void face.offsetWidth;
      face.classList.add('is-shake');
    }
  }

  // ---------------------------------------------------------------- toque e mouse
  tray.addEventListener('click', (e) => {
    const c = /** @type {HTMLElement} */ (e.target).closest?.('.rr-mural__card');
    if (!c) return;
    sel = sel === c.dataset.id ? null : c.dataset.id;
    render();
  });
  line.addEventListener('click', (e) => {
    const s = /** @type {HTMLElement} */ (e.target).closest?.('.rr-mural__slot');
    if (s && sel) tryPlace(sel, s.dataset.slot);
  });
  tray.addEventListener('pointerdown', (e) => {
    const c = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (e.target).closest?.('.rr-mural__card'));
    if (!c || e.button > 0) return;
    const sx = e.clientX, sy = e.clientY, id = c.dataset.id;
    let moved = false;
    /** @type {HTMLElement | null} */
    let ghost = null;
    const mv = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
      if (!moved) {
        moved = true;
        ghost = /** @type {HTMLElement} */ (c.cloneNode(true));
        ghost.classList.add('is-drag');
        ghost.style.width = `${c.offsetWidth}px`;
        document.body.appendChild(ghost);
        c.style.visibility = 'hidden';
        stopPaw();
      }
      ghost.style.left = `${ev.clientX - c.offsetWidth / 2}px`;
      ghost.style.top = `${ev.clientY - c.offsetHeight * 0.6}px`;
    };
    const up = (ev) => {
      removeEventListener('pointermove', mv);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      if (!moved) return;
      ghost?.remove();
      c.style.visibility = '';
      const under = /** @type {HTMLElement} */ (document.elementFromPoint(ev.clientX, ev.clientY));
      const s = under?.closest?.('.rr-mural__slot');
      if (s) tryPlace(id, /** @type {HTMLElement} */ (s).dataset.slot);
      else render();
    };
    addEventListener('pointermove', mv);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  });
  go.addEventListener('click', finish);

  // ---------------------------------------------------------------- teclado e controle
  function move(dir) {
    const loose = looseCards();
    const nk = keys().length;
    if (dir === 'up' || dir === 'down') {
      const zones = board?.settled ? ['line', 'go'] : ['line', 'tray'];
      const zi = Math.max(0, zones.indexOf(focus.zone));
      const next = zones[Math.max(0, Math.min(zones.length - 1, zi + (dir === 'down' ? 1 : -1)))];
      focus = { zone: next, i: 0 };
    } else if (focus.zone === 'tray' && loose.length) {
      focus.i = (focus.i + (dir === 'right' ? 1 : -1) + loose.length) % loose.length;
    } else if (focus.zone === 'line') {
      focus.i = (focus.i + (dir === 'right' ? 1 : -1) + nk) % nk;
    }
    stopPaw();
    render();
  }
  function confirm() {
    if (focus.zone === 'go') { if (board?.settled) finish(); return; }
    if (focus.zone === 'tray') {
      const id = looseCards()[focus.i];
      if (!id) return;
      sel = id;
      const free = keys().findIndex((k) => !locked(k) && !board.placed[k]);
      focus = { zone: 'line', i: Math.max(0, free) };
      render();
      return;
    }
    if (focus.zone === 'line' && sel) tryPlace(sel, keys()[focus.i]);
  }
  function onKey(e) {
    if (!open || e.repeat) return;
    if (KEYS[e.code]) { e.preventDefault(); e.stopImmediatePropagation(); move(KEYS[e.code]); return; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); confirm(); return; }
    if (e.code === 'Escape' && sel) { e.stopImmediatePropagation(); sel = null; render(); }
  }

  // ---------------------------------------------------------------- a patinha do tutorial
  function stopPaw() { tutorial = false; paw.style.opacity = '0'; paw.style.transition = 'none'; }
  function runPaw() {
    if (!tutorial || !open) return;
    const box = $('.rr-mural__board').getBoundingClientRect();
    const card = /** @type {HTMLElement} */ (tray.querySelector('[data-id="pombos"]'));
    const slot = /** @type {HTMLElement} */ (line.querySelector('[data-slot="0"]'));
    if (!card || !slot) return;
    const a = card.getBoundingClientRect(), b = slot.getBoundingClientRect();
    paw.style.transition = 'none';
    paw.style.opacity = '1';
    paw.style.left = `${a.left - box.left + a.width / 2 - 23}px`;
    paw.style.top = `${a.top - box.top + a.height / 2 - 23}px`;
    void paw.offsetWidth;
    paw.style.transition = 'left 1.3s ease-in-out, top 1.3s ease-in-out, opacity .3s';
    paw.style.left = `${b.left - box.left + b.width / 2 - 23}px`;
    paw.style.top = `${b.top - box.top + b.height / 2 - 23}px`;
  }

  function finish() {
    if (!open || !board?.settled) return;
    const errors = board.errors;
    close();
    emit('ui:muralDone', { errors, settled: true });
  }
  function close() {
    open = false;
    el.hidden = true;
    removeEventListener('keydown', onKey, true);
    stopPaw();
  }

  return {
    /** Abre com os cartões que a jogadora tem (os do caso 3; a pena e a baba ficam ao lado, de apoio). */
    open({ owned = [] } = {}) {
      board = createCaseBoard(CASE3_TIMELINE, { owned });
      sel = null;
      tutorial = true;
      pawT = 0;
      pawTimer = 0.6;
      focus = { zone: 'tray', i: 0 };
      open = true;
      el.hidden = false;
      renderSide(owned);
      render();
      addEventListener('keydown', onKey, true);
    },
    close,
    update(dt) {
      if (!open) return;
      if (tutorial) {
        pawTimer -= dt;
        pawT += dt;
        if (pawTimer <= 0) { pawTimer = 3.2; runPaw(); }
        if (pawTimer < 1.2) paw.style.opacity = '0';
      }
      let p = null;
      try { p = pollMenuPad(); } catch (_) { p = null; }
      if (!p?.connected) return;
      if (p.left) move('left');
      if (p.right) move('right');
      if (p.up) move('up');
      if (p.down) move('down');
      if (p.confirm) confirm();
      if (p.back && sel) { sel = null; render(); }
    },
    get isOpen() { return open; },
    get board() { return board; },
    dispose() { close(); el.remove(); },
  };
}
