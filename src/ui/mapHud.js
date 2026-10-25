// HUD do mapa das fases (Pandorópolis, src/levels/mapa/): a placa da cidade com o total (fases concluídas e
// biscoitos), o atalho (◀ Ir para fase ▶, também L/R, L2/R2 e os números) e a plaquinha da bandeirinha mais perto:
// número, nome, lugar e hora do dia, os três biscoitos, o recorde, o estado (nova, concluída, trancada) e a barrinha da
// fase carregando por baixo enquanto as dogs estão na frente dela.
// Ouve: map:sign, map:preload. Só aparece com .rr[data-hub] (ui.js liga ao carregar o mapa). A marcação entra no HUD
// na criação: a placa na linha do canto direito, a plaquinha logo acima do prompt e o atalho embaixo de tudo.
// API: createMapHud({ $, levels, getProgress }) → { refresh(), reset() }
import { events } from '../core/events.js';
import { fmtTime, glyph } from './markup.js';
import { boneIcon, checkIcon, lockIcon, trophyIcon, itemIcon } from './icons.js';

/**
 * @param {{ $: (s: string) => any, levels: Partial<import('../types').LevelDef>[],
 *           getProgress: () => { levels: Record<string, any> } }} opts
 */
export function createMapHud({ $, levels, getProgress }) {
  $('.rr-hud__row').insertAdjacentHTML('afterbegin', PLATE);
  $('.rr-prompt').insertAdjacentHTML('beforebegin', SIGN);
  $('.rr-hud__bottom').insertAdjacentHTML('beforeend', TRAVEL());
  const plate = $('.rr-mapplate');
  const sign = $('.rr-sign');
  const travel = $('.rr-travel');
  /** @type {any} */
  let cur = null; // plaquinha mostrada
  /** @type {{ index: number | null, progress: number, status: string }} */
  let load = { index: null, progress: 0, status: 'idle' };

  const totalOf = (d) => d?.layout?.COLLECTIBLES?.length ?? 0;

  /** Placa da cidade: fases concluídas e biscoitos de todas. */
  function refresh() {
    const prog = getProgress()?.levels || {};
    const done = levels.filter((d) => prog[d.id]?.done).length;
    const treats = levels.reduce((n, d) => n + (prog[d.id]?.treats ?? 0), 0);
    const total = levels.reduce((n, d) => n + (prog[d.id]?.total ?? totalOf(d)), 0);
    plate.querySelector('.rr-mapplate__done').innerHTML = `${checkIcon()}<b>${done}</b><small>/${levels.length}</small>`;
    plate.querySelector('.rr-mapplate__bones').innerHTML = `${boneIcon()}<b>${treats}</b><small>/${total}</small>`;
    plate.setAttribute('aria-label', `Pandorópolis: ${done} de ${levels.length} fases, ${treats} de ${total} biscoitos`);
  }

  function renderLoad() {
    const bar = sign.querySelector('.rr-sign__load');
    if (!cur || cur.state === 'locked') { bar.hidden = true; return; }
    bar.hidden = false;
    const mine = load.index === cur.index;
    const k = mine ? load.progress : 0;
    const ready = mine && load.status === 'ready';
    bar.classList.toggle('is-ready', ready);
    /** @type {HTMLElement} */ (bar.querySelector('i')).style.setProperty('--k', String(Math.max(0.04, Math.min(1, k))));
    bar.querySelector('span').textContent = ready ? 'Pronta para entrar!' : mine && load.status === 'error' ? 'A fase carrega ao entrar' : 'Preparando a fase…';
  }

  function render(s) {
    cur = s && Number.isFinite(s.n) ? s : null;
    sign.classList.toggle('is-on', !!cur);
    if (!cur) return;
    const locked = cur.state === 'locked';
    sign.dataset.state = cur.state;
    sign.querySelector('.rr-sign__num').textContent = String(cur.n);
    sign.querySelector('.rr-sign__item').innerHTML = itemIcon(cur.item);
    sign.querySelector('.rr-sign__eyebrow').textContent = `Fase ${cur.n}${cur.when ? ` · ${cur.when}` : ''}`;
    sign.querySelector('.rr-sign__name').textContent = cur.name || '';
    sign.querySelector('.rr-sign__place').textContent = cur.place || '';
    const total = cur.total ?? 3;
    const bones = Array.from({ length: Math.max(1, Math.min(5, total)) }, (_, i) => `<i class="${i < (cur.treats ?? 0) ? 'is-got' : ''}">${boneIcon()}</i>`).join('');
    const bits = [];
    if (locked) bits.push(`<span class="rr-sign__state is-locked">${lockIcon()}Trancada: termine a fase ${cur.n - 1}</span>`);
    else {
      bits.push(`<span class="rr-sign__bones" aria-label="${cur.treats ?? 0} de ${total} biscoitos">${bones}</span>`);
      if (Number.isFinite(cur.best)) bits.push(`<span class="rr-sign__best">${trophyIcon()}${fmtTime(cur.best)}</span>`);
      bits.push(cur.state === 'done' ? `<span class="rr-sign__state is-done">${checkIcon()}Concluída</span>` : '<span class="rr-sign__state is-new">Nova!</span>');
    }
    sign.querySelector('.rr-sign__row').innerHTML = bits.join('');
    renderLoad();
    sign.classList.remove('is-pop');
    void sign.offsetWidth;
    sign.classList.add('is-pop');
  }

  events.on('map:sign', (s) => render(s));
  events.on('map:preload', (p) => {
    load = { index: p?.index ?? null, progress: p?.progress ?? 0, status: p?.status ?? 'idle' };
    renderLoad();
  });
  // atalho na tela (mouse e toque)
  travel.querySelector('.rr-travel__prev').addEventListener('click', () => events.emit('ui:mapTravel', { dir: -1 }));
  travel.querySelector('.rr-travel__next').addEventListener('click', () => events.emit('ui:mapTravel', { dir: 1 }));

  refresh();
  return {
    refresh,
    reset() { render(null); load = { index: null, progress: 0, status: 'idle' }; refresh(); },
  };
}

// Marcação (o CSS só mostra com .rr[data-hub]).
const PLATE = `<div class="rr-mapplate rr-glass" role="status">
  <span class="rr-mapplate__city">Pandorópolis</span><span class="rr-mapplate__done"></span><span class="rr-mapplate__bones"></span>
</div>`;
const SIGN = `<div class="rr-sign rr-glass" role="status" aria-live="polite" data-state="next">
  <div class="rr-sign__head">
    <span class="rr-sign__badge"><b class="rr-sign__num">1</b><span class="rr-sign__item"></span></span>
    <span class="rr-sign__text"><span class="rr-sign__eyebrow"></span><span class="rr-sign__name"></span><span class="rr-sign__place"></span></span>
  </div>
  <div class="rr-sign__row"></div>
  <div class="rr-sign__load" hidden><i></i><span>Preparando a fase…</span></div>
</div>`;
const TRAVEL = () => `<div class="rr-travel rr-glass">
  <button class="rr-travel__prev" type="button" aria-label="Bandeirinha anterior">◀</button>
  <span class="rr-travel__label">${glyph('L', { pad: ['LT'], touch: [] })}<span>Ir para fase</span>${glyph('R', { pad: ['RT'], touch: [] })}</span>
  <button class="rr-travel__next" type="button" aria-label="Próxima bandeirinha">▶</button>
</div>`;
