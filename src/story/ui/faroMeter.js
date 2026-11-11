// O medidor do fôlego do Faro (pedido do usuário em 2026-11-11; o fôlego é do src/story/faro/faroMode.js). Ouve
// story:faroState { on, stamina (0..1), who, locked?, min?, tired? } e desenha:
//  - no toque: um anel em volta do botão do focinho (.rr-tbtn--faro, src/ui/touchControls.js); o botão acende
//    (is-faro-on) com o Faro ligado;
//  - no teclado e no controle: um arco discreto em volta do retrato da dog ativa (.rr-chip, src/ui/hud.js), que some
//    com o fôlego cheio e o Faro desligado.
// Abaixo de 25% (ou travada depois de esvaziar, com a marca dos 25% que falta alcançar) fica laranja-avermelhado;
// cansada (tired), pisca. O botão e o chip são do HUD do jogo: o medidor só põe um SVG dentro deles (achados na hora,
// porque o botão do focinho entra com a área da história) e tira tudo no dispose.
// API: createFaroMeter({ root, events }) → { state(), dispose() }.
import './faroMeter.css';

/** O raio do arco no viewBox 48×48 e o comprimento da volta inteira. */
const R = 20;
const C = 2 * Math.PI * R;

/** O SVG do medidor (o fundo, a marca dos 25% e o fôlego); o CSS gira −90° para começar no alto. */
function meterSvg(cls) {
  return `<svg class="${cls} rr-faro" viewBox="0 0 48 48" aria-hidden="true" focusable="false">`
    + `<circle class="rr-faro__track" cx="24" cy="24" r="${R}"/>`
    + `<circle class="rr-faro__fill" cx="24" cy="24" r="${R}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="0"/>`
    + '<line class="rr-faro__mark" x1="24" y1="40.5" x2="24" y2="47.5"/>'
    + '</svg>';
}

/** Reinicia uma animação de classe (também em SVG, que não tem offsetWidth). */
function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.getBoundingClientRect?.();
  el.classList.add(cls);
}

/**
 * @param {{ root: HTMLElement, events: { on: (name: string, fn: (p: any) => void) => () => void } }} opts
 */
export function createFaroMeter({ root, events }) {
  /** O último estado recebido. */
  let st = { on: false, stamina: 1, who: /** @type {string | null} */ (null), locked: false, min: 0.25 };
  /** @type {Set<Element>} os SVGs que pusemos (para tirar no dispose) */
  const mine = new Set();

  /**
   * O SVG do medidor dentro de `host` (põe se faltar e `make`: o botão do focinho é recriado a cada área da história).
   * @param {HTMLElement | null} host @param {string} cls @param {boolean} make
   */
  function meterIn(host, cls, make) {
    if (!host) return null;
    let el = host.querySelector(`.${cls}`);
    if (!el && make) {
      host.insertAdjacentHTML('beforeend', meterSvg(cls));
      el = host.querySelector(`.${cls}`);
      host.classList.add('has-faro-meter');
      // o pisca de cansada acaba sozinho (a classe sai para a próxima vez)
      const svg = el;
      svg?.addEventListener('animationend', (e) => {
        if (/** @type {AnimationEvent} */ (e).animationName === 'rr-faro-tired') svg.classList.remove('is-tired');
      });
    }
    if (el) mine.add(el);
    return el;
  }

  /** @param {boolean} [tired] pisca @param {boolean} [make] põe o medidor onde ainda não tem */
  function draw(tired = false, make = true) {
    const s = Math.min(1, Math.max(0, Number.isFinite(st.stamina) ? st.stamina : 1));
    const low = !!st.locked || s < (st.min ?? 0.25);
    const full = s >= 0.999 && !st.on;
    const btn = /** @type {HTMLElement | null} */ (root.querySelector('.rr-tbtn--faro'));
    const chip = /** @type {HTMLElement | null} */ (root.querySelector('.rr-chip'));
    for (const [host, cls] of /** @type {[HTMLElement | null, string][]} */ ([[btn, 'rr-faroring'], [chip, 'rr-faroarc']])) {
      const el = meterIn(host, cls, make);
      if (!el) continue;
      const fill = /** @type {SVGCircleElement | null} */ (el.querySelector('.rr-faro__fill'));
      if (fill) {
        fill.style.strokeDashoffset = (C * (1 - s)).toFixed(2);
        // vazio: sem a bolinha da ponta redonda
        fill.style.opacity = s < 0.005 ? '0' : '';
      }
      el.classList.toggle('is-full', full);
      el.classList.toggle('is-low', low);
      el.classList.toggle('is-locked', !!st.locked);
      el.classList.toggle('is-on', !!st.on);
      if (tired) retrigger(el, 'is-tired');
      host.classList.toggle('is-faro-on', !!st.on);
    }
  }

  const offs = [
    events.on('story:faroState', (/** @type {any} */ p) => {
      if (!p) return;
      st = {
        on: !!p.on,
        stamina: Number.isFinite(p.stamina) ? p.stamina : st.stamina,
        who: p.who ?? st.who,
        locked: !!p.locked,
        min: Number.isFinite(p.min) ? p.min : 0.25,
      };
      draw(!!p.tired);
    }),
    // área nova ou de novo: fôlego cheio e desligado (só arruma o que já existe: fora da história não põe nada)
    events.on('story:reset', () => { st = { ...st, on: false, stamina: 1, locked: false }; draw(false, false); }),
    events.on('level:loading', () => { st = { ...st, on: false, stamina: 1, locked: false }; draw(false, false); }),
  ];

  return {
    /** Para os testes de tela: o que o medidor mostra. */
    state() { return { ...st }; },
    dispose() {
      for (const off of offs) off();
      for (const el of mine) {
        el.parentElement?.classList.remove('has-faro-meter', 'is-faro-on');
        el.remove();
      }
      mine.clear();
    },
  };
}
