// HUD do Modo História (só com a área da história carregada: .rr[data-story]). Ouve os eventos story:* do puzzle e:
//  - põe as faixas de cinema e some com o HUD do jogo nas cenas (story:cinema), faz o preto (story:fade) e mostra o
//    anel de pular (story:skipHold; no toque, o botão ⏩ avisa ui:storySkip);
//  - mostra a cartela do capítulo (story:title) e o aviso do primeiro Faro com o botão do aparelho (story:prompt);
//  - guarda as pistas na lupa: o cartão aparece no meio da tela e voa para a lupa (story:clue); tocar na lupa mostra os
//    cartões por caso; conta as meias (story:sock);
//  - abre o mural provisório (story:mural) e o fim do capítulo (story:chapterEnd), com Jogar de novo e Menu inicial;
//  - toca os sons e o ambiente da história (story:sfx, story:ambience). A música fica no main.js (story:music).
// Nada de texto nas cenas: só desenhos, os títulos e os botões dos menus.
import './story.css';
import { events } from '../../core/events.js';
import { CASES, CLUES } from '../clues.js';
import { pictoOf, HUD_ICONS } from './pictos.js';
import { createMuralUI } from './mural.js';

const ico = (svg) => svg.replace('<svg ', '<svg class="ico" ');

/**
 * @param {{ root: HTMLElement, audio?: any }} opts
 */
export function createStoryHud({ root, audio = null }) {
  const host = document.createElement('div');
  host.className = 'rr-story';
  host.innerHTML = `
    <div class="rr-story__bar rr-story__bar--top"></div>
    <div class="rr-story__bar rr-story__bar--bottom"></div>
    <div class="rr-story__counters">
      <button class="rr-story__chip rr-story__lupa" type="button" aria-label="Lupa: pistas achadas">${ico(HUD_ICONS.lupa)}<span class="rr-story__n" data-n="pistas">0</span></button>
      <div class="rr-story__chip rr-story__meias" aria-label="Meias perdidas">${ico(HUD_ICONS.meia)}<span class="rr-story__n" data-n="meias">0</span><small>/3</small></div>
    </div>
    <div class="rr-story__panel" role="dialog" aria-label="Lupa"></div>
    <div class="rr-story__prompt" role="button" aria-label="Faro">${ico(HUD_ICONS.focinho)}
      <span class="rr-story__key" data-dev="keyboard">V</span><span class="rr-story__key" data-dev="gamepad">L3</span><span class="rr-story__key" data-dev="touch">${ico(HUD_ICONS.focinho)}</span></div>
    <div class="rr-story__keys" aria-hidden="true"><span class="rr-story__key" data-dev="keyboard">E</span><span class="rr-story__key" data-dev="gamepad">✕</span></div>
    <div class="rr-story__skip" role="button" aria-label="Segure para pular a cena">${ico(HUD_ICONS.pular)}
      <svg class="rr-story__ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" stroke-dasharray="106.8" stroke-dashoffset="106.8"/></svg></div>
    <div class="rr-story__title" aria-live="polite"><span class="t-eyebrow"></span><span class="t-name"></span><span class="t-chapter"></span></div>
    <div class="rr-story__fade"></div>
    <div class="rr-story__end" hidden><div class="rr-story__endcard" role="dialog" aria-label="Fim do capítulo">
      <h2></h2><p></p><div class="rr-story__stats"></div>
      <div class="rr-story__endbtns"><button class="rr-btn rr-btn--primary" type="button" data-act="again">Jogar de novo</button>
      <button class="rr-btn rr-btn--soft" type="button" data-act="menu">Menu inicial</button></div></div></div>`;
  root.appendChild(host);
  const $ = (s) => /** @type {HTMLElement} */ (host.querySelector(s));
  const fade = $('.rr-story__fade');
  const ring = /** @type {SVGCircleElement} */ (/** @type {unknown} */ (host.querySelector('.rr-story__ring circle')));
  const title = $('.rr-story__title');
  const prompt = $('.rr-story__prompt');
  const panel = $('.rr-story__panel');
  const lupa = $('.rr-story__lupa');
  const meias = $('.rr-story__meias');
  const end = $('.rr-story__end');
  const skipBtn = $('.rr-story__skip');
  const nPistas = $('[data-n="pistas"]');
  const nMeias = $('[data-n="meias"]');
  // a lupa e as meias entram na coluna do canto do HUD do jogo (abaixo dos petiscos e da pausa): nada se sobrepõe
  const counters = $('.rr-story__counters');
  root.querySelector('.rr-hud__tr')?.appendChild(counters);
  const mural = createMuralUI({ host, emit: (n, p) => events.emit(n, p), sfx: (n) => audio?.play?.(n) });

  /** As pistas na lupa, na ordem em que chegaram, e a fila dos cartões voando. */
  let found = [];
  const queue = [];
  let flyT = 0;
  let titleT = 0;
  let socks = 0;
  /** O Faro recarregando: o pulso dura 6 s e some em 0,6 s (FARO em src/story/faro/faro.js); o botão do focinho apaga. */
  let faroCool = 0;
  const coolFaro = (on) => root.querySelector('.rr-tbtn--faro')?.classList.toggle('is-cool', on);

  const play = (name, opts = {}) => { try { audio?.play?.(name, opts); } catch (_) { /* sem áudio */ } };
  const setStory = (on) => { if (on) root.dataset.story = '1'; else { delete root.dataset.story; delete root.dataset.cinema; } };
  const pop = (elm) => { elm.classList.remove('is-pop'); void elm.offsetWidth; elm.classList.add('is-pop'); };

  function renderPanel() {
    panel.innerHTML = ['C3', 'C2', 'C1'].map((c) => {
      const ids = found.filter((id) => CLUES[id]?.case === c);
      if (!ids.length) return '';
      return `<div class="rr-story__case"><h3>${CASES[c].name}</h3><div class="rr-story__cards">${ids.map((id) => `<span title="${CLUES[id].name}">${pictoOf(id)}</span>`).join('')}</div></div>`;
    }).join('');
  }
  /** O cartão aparece no meio da tela e voa até a lupa. */
  function flyCard(id) {
    const card = document.createElement('div');
    card.className = 'rr-story__fly';
    card.innerHTML = pictoOf(id);
    card.style.transform = 'scale(.4)';
    card.style.opacity = '0';
    host.appendChild(card);
    requestAnimationFrame(() => {
      card.style.transform = 'scale(1.1)';
      card.style.opacity = '1';
      setTimeout(() => {
        const a = card.getBoundingClientRect(), b = lupa.getBoundingClientRect();
        const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
        card.style.transform = `translate(${dx}px, ${dy}px) scale(.22)`;
        card.style.opacity = '0.2';
        setTimeout(() => {
          card.remove();
          nPistas.textContent = String(found.length);
          pop(lupa);
        }, 650);
      }, 700);
    });
    play('pista');
  }

  const offs = [
    events.on('level:loaded', (/** @type {any} */ info) => {
      const story = !!(info?.story || window.__game?.game?.levelDef?.story);
      setStory(story);
      if (!story) { mural.close(); end.hidden = true; }
    }),
    events.on('level:loading', () => { delete root.dataset.cinema; mural.close(); end.hidden = true; }),
    events.on('story:cinema', (/** @type {any} */ p) => {
      if (p.on) root.dataset.cinema = '1';
      else delete root.dataset.cinema;
      panel.classList.remove('is-on');
    }),
    events.on('story:fade', (/** @type {any} */ p) => {
      fade.style.transitionDuration = `${Math.max(0, p.dur ?? 0.5)}s`;
      fade.style.opacity = String(p.to ?? 0);
    }),
    events.on('story:skipHold', (/** @type {any} */ p) => {
      ring.style.strokeDashoffset = String(106.8 * (1 - (p.k ?? 0)));
    }),
    events.on('story:title', (/** @type {any} */ p) => {
      title.querySelector('.t-eyebrow').textContent = p.eyebrow || '';
      title.querySelector('.t-name').innerHTML = String(p.title || '').replace('&', '<b>&amp;</b>');
      title.querySelector('.t-chapter').textContent = p.chapter || '';
      title.classList.add('is-on');
      titleT = 3.4;
    }),
    events.on('story:prompt', (/** @type {any} */ p) => { prompt.classList.toggle('is-on', !!p.on); }),
    events.on('story:faro', () => { faroCool = 6.6; coolFaro(true); }),
    events.on('story:clue', (/** @type {any} */ p) => {
      if (!found.includes(p.id)) found.push(p.id);
      queue.push(p.id);
      renderPanel();
    }),
    events.on('story:sock', (/** @type {any} */ p) => {
      socks = p.count ?? socks + 1;
      nMeias.textContent = String(socks);
      pop(meias);
      play('meia');
    }),
    events.on('story:mural', (/** @type {any} */ p) => { if (p.open) mural.open({ owned: [...(p.owned || []), ...(p.clues || []).filter((id) => CLUES[id]?.case === 'C3')] }); }),
    events.on('story:chapterEnd', (/** @type {any} */ p) => {
      end.querySelector('h2').textContent = `Fim do Capítulo ${p.chapter} · ${p.title}`;
      end.querySelector('p').textContent = '';
      end.querySelector('.rr-story__stats').innerHTML = [
        `<span>${ico(HUD_ICONS.lupa)}${p.clues}</span>`,
        `<span>${ico(HUD_ICONS.focinho)}${p.hidden}/${p.hiddenTotal}</span>`,
        `<span>${ico(HUD_ICONS.meia)}${p.socks}/${p.socksTotal}</span>`,
      ].join('');
      end.hidden = false;
      /** @type {HTMLElement} */ (end.querySelector('[data-act="again"]')).focus?.();
    }),
    events.on('story:reset', () => {
      faroCool = 0;
      coolFaro(false);
      found = [];
      queue.length = 0;
      socks = 0;
      nPistas.textContent = '0';
      nMeias.textContent = '0';
      panel.classList.remove('is-on');
      panel.innerHTML = '';
      end.hidden = true;
      mural.close();
      title.classList.remove('is-on');
      prompt.classList.remove('is-on');
      delete root.dataset.cinema;
      fade.style.transitionDuration = '0s';
      fade.style.opacity = '0';
    }),
    events.on('story:sfx', (/** @type {any} */ p) => play(p.name, { volume: p.volume ?? 1 })),
    events.on('story:ambience', (/** @type {any} */ p) => { try { audio?.setAmbience?.(p.kind); } catch (_) { /* sem áudio */ } }),
  ];

  lupa.addEventListener('click', () => { if (found.length) panel.classList.toggle('is-on'); });
  end.addEventListener('click', (e) => {
    const b = /** @type {HTMLElement} */ (e.target).closest?.('[data-act]');
    if (!b) return;
    end.hidden = true;
    events.emit(b.getAttribute('data-act') === 'again' ? 'ui:restart' : 'ui:menu', {});
  });
  // o aviso do primeiro Faro também é botão (no toque os controles somem durante a cena)
  prompt.addEventListener('pointerdown', (e) => { e.preventDefault?.(); if (prompt.classList.contains('is-on')) events.emit('ui:storyFaro', {}); });
  // o botão de pular no toque: segurar avisa o puzzle (o anel enche pelo story:skipHold)
  const skipOn = (on) => (e) => { e.preventDefault?.(); events.emit('ui:storySkip', { on }); };
  skipBtn.addEventListener('pointerdown', skipOn(true));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) skipBtn.addEventListener(ev, skipOn(false));

  return {
    update(dt) {
      mural.update(dt);
      if (faroCool > 0) { faroCool -= dt; if (faroCool <= 0) coolFaro(false); }
      if (titleT > 0) { titleT -= dt; if (titleT <= 0) title.classList.remove('is-on'); }
      if (queue.length) {
        flyT -= dt;
        if (flyT <= 0) { flyT = 0.45; flyCard(queue.shift()); }
      }
    },
    /** Para os testes de tela: o que está aberto. */
    state() {
      return { story: root.dataset.story === '1', cinema: root.dataset.cinema === '1', clues: found.slice(), socks, mural: mural.isOpen, end: !end.hidden, title: title.classList.contains('is-on') };
    },
    mural,
    dispose() {
      for (const off of offs) off();
      mural.dispose();
      counters.remove();
      host.remove();
    },
  };
}
