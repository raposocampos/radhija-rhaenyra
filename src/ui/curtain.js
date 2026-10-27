// Cortina de transição entre fases: cobre a tela no `level:loading` (mostrando "Fase N · Nome"), espera a
// fase carregar e um tempo mínimo de leitura, e revela. Nunca prende a tela (revela sozinha em 9 s).
import { itemIcon } from './icons.js';

const CURTAIN_MIN_MS = 1250; // tempo mínimo da cortina na tela (para ler "Fase N · Nome")

/**
 * opts: { $, audio, levelMeta(info) → { index, number, name, subtitle, item }, itemOf(m) → id do ícone,
 *         onCover() (chamado ao cobrir), onChange() (camadas visíveis mudaram) }
 */
export function createCurtain({ $, audio, levelMeta, itemOf, onCover, onChange }) {
  const curtainEl = $('.rr-curtain');
  const curtain = { phase: 'off', since: 0, loaded: false, timers: [] };

  function clearCurtainTimers() { curtain.timers.forEach(clearTimeout); curtain.timers.length = 0; }
  function cover(info) {
    clearCurtainTimers();
    const m = levelMeta(info);
    $('.rr-curtain__badge').innerHTML = itemIcon(itemOf(m));
    $('.rr-curtain__eyebrow').textContent = m.hub ? 'Mapa das fases' : `Fase ${m.number}`;
    $('.rr-curtain__name').textContent = m.name || '';
    $('.rr-curtain__sub').textContent = m.subtitle || '';
    curtainEl.classList.remove('is-revealing');
    void curtainEl.offsetWidth;
    curtainEl.classList.add('is-on', 'is-covering');
    curtain.phase = 'cover';
    curtain.since = performance.now();
    curtain.loaded = false;
    audio?.play?.('curtainIn');
    onCover();
    curtain.timers.push(setTimeout(reveal, 9000)); // segurança: nunca prende a tela
  }
  function loaded() {
    if (curtain.phase !== 'cover') return;
    curtain.loaded = true;
    const wait = Math.max(0, CURTAIN_MIN_MS - (performance.now() - curtain.since));
    curtain.timers.push(setTimeout(reveal, wait));
  }
  function reveal() {
    if (curtain.phase !== 'cover') return;
    clearCurtainTimers();
    curtain.phase = 'reveal';
    curtainEl.classList.remove('is-covering');
    curtainEl.classList.add('is-revealing');
    audio?.play?.('curtainOut');
    onChange();
    curtain.timers.push(setTimeout(() => {
      curtainEl.classList.remove('is-on', 'is-revealing');
      curtain.phase = 'off';
    }, 950));
  }
  function dismiss() {
    clearCurtainTimers();
    curtain.phase = 'off';
    curtain.loaded = false;
    curtainEl.classList.remove('is-on', 'is-covering', 'is-revealing');
    onChange();
  }

  return {
    cover, loaded, reveal, dismiss,
    /** 'off' | 'cover' | 'reveal' */
    get phase() { return curtain.phase; },
  };
}
