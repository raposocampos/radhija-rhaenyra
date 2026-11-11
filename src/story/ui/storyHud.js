// HUD do Modo História (só com a área da história carregada: .rr[data-story]). Ouve os eventos story:* do puzzle e:
//  - põe as faixas de cinema e some com o HUD do jogo nas cenas (story:cinema), faz o preto (story:fade) e mostra o
//    anel de pular (story:skipHold; no toque, o botão ⏩ avisa ui:storySkip);
//  - mostra a cartela do capítulo (story:title) e o aviso do primeiro Faro com o botão do aparelho (story:prompt);
//  - as falas (story:say): a voz de sílabas de quem fala SEMPRE (cena e jogo) e, no jogo (mode 'jogo'), a legenda
//    curta embaixo (subtitles.js); as das cenas são desenhadas pela camada de HQ (comic.js). story:sayClear apaga e
//    cala; story:voice { who, text | chars, mood?, cps? } só a voz; story:voiceStop cala;
//  - as pistas: o cartão da pista anotada (desenho + frase; no depoimento, o retratinho e a fala) aparece no meio-alto
//    e voa para o botão do quadro (story:clue); a pergunta nova num letreiro no alto (story:question); o quadro de
//    dedução (story:board, board.js), aberto pelo botão do quadro, Tab (teclado) ou Back/Select/View (controle); a
//    ligação sai em ui:storyLink { clue, node } (errada: story:linkWrong), o confronto em ui:storyConfront
//    { testimony, clue } (errado: story:confrontWrong; certo: story:insight), a conclusão em ui:storyDeduce
//    { node, option } (errada: story:deduceWrong { node }); abrir/fechar avisa ui:storyBoard { open };
//  - conta as meias (story:sock); abre o mural provisório (story:mural) e o fim do capítulo (story:chapterEnd);
//  - toca os sons e o ambiente da história (story:sfx, story:ambience). A música fica no main.js (story:music).
import './story.css';
import { events } from '../../core/events.js';
import { CLUES } from '../clues.js';
import { readGamepad, capturePad, PAD } from '../../game/input.js';
import { pictoSvg, HUD_ICONS } from './pictos.js';
import { createMuralUI } from './mural.js';
import { createFaroMeter } from './faroMeter.js';
import { createSubtitles, createVoice } from './subtitles.js';
import { createBoardUI, boardSummary } from './board.js';

const ico = (svg) => svg.replace('<svg ', '<svg class="ico" ');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** O botão Back/Select/View do controle desenhado (duas janelinhas), para a dica do botão do quadro. */
const VIEW_BTN = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="4" width="21" height="16" rx="8" fill="#4A3426"/><rect x="6.5" y="8" width="7" height="6" rx="1" fill="none" stroke="#FFF6E6" stroke-width="1.5"/><rect x="10.5" y="10" width="7" height="6" rx="1" fill="#4A3426" stroke="#FFF6E6" stroke-width="1.5"/></svg>';

/** Tempos (s) do cartão da pista (entra, voa, some) e do letreiro da pergunta. */
const CLUE_T = { fly: 2.1, done: 2.75 };
const ASK_T = { off: 2.6, done: 3.05 };

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
      <button class="rr-story__chip rr-story__lupa rr-story__quadro" type="button" aria-label="Quadro de dedução: pistas e perguntas">${ico(HUD_ICONS.quadro)}<span class="rr-story__n" data-n="pistas">0</span>
        <span class="rr-story__chipkey" data-dev="keyboard">Tab</span><span class="rr-story__chipkey rr-story__chipkey--pad" data-dev="gamepad">${VIEW_BTN}</span><i class="rr-story__ready" aria-hidden="true">!</i></button>
      <div class="rr-story__chip rr-story__meias" aria-label="Meias perdidas">${ico(HUD_ICONS.meia)}<span class="rr-story__n" data-n="meias">0</span><small>/3</small></div>
    </div>
    <div class="rr-story__prompt" role="button" aria-label="Faro">${ico(HUD_ICONS.focinho)}
      <span class="rr-story__key" data-dev="keyboard">V</span><span class="rr-story__key" data-dev="gamepad">L3</span><span class="rr-story__key" data-dev="touch">${ico(HUD_ICONS.focinho)}</span></div>
    <div class="rr-story__keys" aria-hidden="true"><span class="rr-story__key" data-dev="keyboard">E</span><span class="rr-story__key" data-dev="gamepad">✕</span></div>
    <div class="rr-story__skip" role="button" aria-label="Segure para pular a cena">${ico(HUD_ICONS.pular)}
      <svg class="rr-story__ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" stroke-dasharray="106.8" stroke-dashoffset="106.8"/></svg></div>
    <div class="rr-clue" aria-live="polite"><span class="rr-clue__tape rr-clue__tape--l"></span><span class="rr-clue__tape rr-clue__tape--r"></span>
      <span class="rr-clue__eyebrow">Pista anotada</span><span class="rr-clue__pic"></span><p class="rr-clue__text"></p></div>
    <div class="rr-ask" aria-live="polite"><span class="rr-ask__eyebrow">Nova pergunta</span><strong class="rr-ask__text"></strong></div>
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
  const chip = $('.rr-story__quadro');
  const meias = $('.rr-story__meias');
  const end = $('.rr-story__end');
  const skipBtn = $('.rr-story__skip');
  const nPistas = $('[data-n="pistas"]');
  const nMeias = $('[data-n="meias"]');
  const clueCard = $('.rr-clue');
  const askBox = $('.rr-ask');
  // o botão do quadro e as meias entram na coluna do canto do HUD do jogo (abaixo dos petiscos e da pausa)
  const counters = $('.rr-story__counters');
  root.querySelector('.rr-hud__tr')?.appendChild(counters);
  const play = (name, opts = {}) => { try { audio?.play?.(name, opts); } catch (_) { /* sem áudio */ } };
  const mural = createMuralUI({ host, emit: (n, p) => events.emit(n, p), sfx: (n) => audio?.play?.(n) });
  // a legenda do jogo fica entre o joystick e os botões, acima da dica e do aviso de agir (o .rr-hud__bottom)
  const voice = createVoice({ play });
  const subs = createSubtitles({ host: /** @type {HTMLElement} */ (root.querySelector('.rr-hud__bottom')) || host, onSkip: () => voice.stop() });
  // o fôlego do Faro (o medidor em volta do botão do focinho / do retrato da dog ativa)
  const faroMeter = createFaroMeter({ root, events });
  const board = createBoardUI({
    host,
    emit: (n, p) => events.emit(n, p),
    sfx: play,
    onClose: () => { capturePad(false); },
  });

  /** As pistas que chegaram (story:clue), na ordem; o estado do jogo; o recado da vez (cartão ou letreiro). */
  let found = [];
  /** @type {{ kind: 'clue' | 'ask', p: any }[]} */
  const queue = [];
  /** @type {{ kind: 'clue' | 'ask', t: number, flown?: boolean } | null} */
  let ann = null;
  let titleT = 0;
  let socks = 0;
  let gameState = 'playing';
  /** O Faro recarregando: o pulso dura 6 s e some em 0,6 s (FARO em src/story/faro/faro.js); o botão do focinho apaga. */
  let faroCool = 0;
  const coolFaro = (on) => root.querySelector('.rr-tbtn--faro')?.classList.toggle('is-cool', on);
  /** o controle: os botões do quadro do quadro anterior (para as bordas) */
  let padPrev = /** @type {boolean[]} */ ([]);
  let padRep = 0;

  const setStory = (on) => { if (on) root.dataset.story = '1'; else { delete root.dataset.story; delete root.dataset.cinema; } };
  const pop = (elm) => { elm.classList.remove('is-pop'); void elm.offsetWidth; elm.classList.add('is-pop'); };
  const story = () => root.dataset.story === '1';
  /** O quadro só abre jogando: fora das cenas, do mural, do fim do capítulo e da pausa. */
  const canOpen = () => story() && gameState === 'playing' && !root.dataset.cinema && !mural.isOpen && end.hidden;

  function syncChip() {
    const sum = boardSummary(board.state);
    nPistas.textContent = String(Math.max(sum.clues, found.length));
    chip.classList.toggle('has-ready', sum.ready > 0);
    chip.classList.toggle('is-empty', !board.state);
  }
  function openBoard() {
    if (!canOpen() || !board.state) return false;
    if (!board.open()) return false;
    capturePad(true);
    // a pista que está voando já aparece no quadro
    if (ann?.kind === 'clue') endAnn();
    return true;
  }
  const closeBoard = () => board.close();

  // ---------------------------------------------------------------------------------------------- recados
  function startAnn(item) {
    if (item.kind === 'clue') {
      const p = item.p;
      // depoimento: o retratinho de quem falou, o nome e a fala entre aspas (letra à mão)
      const dep = p.type === 'depoimento' || CLUES[p.id]?.type === 'depoimento';
      const quote = dep ? (p.quote || CLUES[p.id]?.quote || '') : '';
      const text = dep && quote ? `“${quote}”` : (p.text || CLUES[p.id]?.name || '');
      clueCard.classList.toggle('is-dep', dep);
      clueCard.querySelector('.rr-clue__eyebrow').textContent = dep ? `Depoimento · ${p.name || CLUES[p.id]?.name || ''}` : 'Pista anotada';
      clueCard.querySelector('.rr-clue__pic').innerHTML = pictoSvg(p.picto, p.id);
      // a frase inteira, palavra a palavra (a tinta entra em sequência; nada fica recortado)
      const line = clueCard.querySelector('.rr-clue__text');
      line.innerHTML = text.split(/\s+/).filter(Boolean).map((w, i) => `<span style="--i:${i}">${esc(w)}</span>`).join(' ');
      line.classList.toggle('is-long', text.length > 56);
      reset(clueCard);
      clueCard.classList.add('is-on');
      play('pista');
      setTimeout(() => play('rabisco', { volume: 0.8 }), 260);
    } else {
      askBox.querySelector('.rr-ask__text').textContent = item.p.text || '';
      reset(askBox);
      askBox.classList.add('is-on');
      play('pergunta');
    }
    ann = { kind: item.kind, t: 0 };
  }
  /** Volta o elemento ao começo sem animar (para o próximo recado entrar do zero). */
  function reset(elm) {
    elm.style.transition = 'none';
    elm.classList.remove('is-on', 'is-fly', 'is-off');
    void elm.offsetWidth;
    elm.style.transition = '';
    void elm.offsetWidth;
  }
  function flyClue() {
    const a = clueCard.getBoundingClientRect();
    const b = chip.getBoundingClientRect();
    if (!b.width) { clueCard.classList.add('is-off'); return; }
    clueCard.style.setProperty('--fx', `${(b.left + b.width / 2 - (a.left + a.width / 2)).toFixed(0)}px`);
    clueCard.style.setProperty('--fy', `${(b.top + b.height / 2 - (a.top + a.height / 2)).toFixed(0)}px`);
    clueCard.classList.add('is-fly');
  }
  function endAnn() {
    if (!ann) return;
    if (ann.kind === 'clue') {
      reset(clueCard);
      syncChip();
      pop(chip);
      play('neuronio', { volume: 0.7 });
    } else reset(askBox);
    ann = null;
  }
  function stepAnn(dt) {
    if (!ann) {
      // nas cenas (HQ), o recado espera a cena acabar: entra quando o jogo volta
      if (queue.length && !board.isOpen && !root.dataset.cinema) startAnn(queue.shift());
      return;
    }
    ann.t += dt;
    if (ann.kind === 'clue') {
      if (!ann.flown && ann.t >= CLUE_T.fly) { ann.flown = true; flyClue(); }
      if (ann.t >= CLUE_T.done) endAnn();
    } else {
      if (!ann.flown && ann.t >= ASK_T.off) { ann.flown = true; askBox.classList.add('is-off'); }
      if (ann.t >= ASK_T.done) endAnn();
    }
  }

  // ---------------------------------------------------------------------------------------------- teclado e controle
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Enter: 'ok', NumpadEnter: 'ok', Space: 'ok', KeyE: 'ok', Backspace: 'back',
    Equal: 'zoomIn', NumpadAdd: 'zoomIn', Minus: 'zoomOut', NumpadSubtract: 'zoomOut', KeyC: 'confront',
    // os números: a opção da conclusão (painel aberto) ou o cartão da bandeja de Achados
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => [[`Digit${n}`, `opt${n}`], [`Numpad${n}`, `opt${n}`]])),
  };
  /** Na captura (antes do jogo): Tab abre/fecha o quadro; com ele aberto, as teclas são dele (o jogo não as vê). */
  const onKey = (/** @type {KeyboardEvent} */ e) => {
    if (!story()) return;
    if (board.isOpen) {
      if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Tab') { if (!e.repeat) closeBoard(); return; }
      if (e.code === 'Escape') { if (!e.repeat) board.command('back'); return; }
      const c = KEYMAP[e.code];
      if (c && (!e.repeat || c === 'left' || c === 'right' || c === 'up' || c === 'down')) board.command(c);
      return;
    }
    if (e.code === 'Tab' && gameState === 'playing' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // jogando, o Tab é do quadro (nunca muda o foco do navegador)
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) openBoard();
    }
  };
  addEventListener('keydown', onKey, true);

  /** O controle, a cada quadro: Back/Select/View abre e fecha; com o quadro aberto, D-pad, ✕/A, ○/B e analógicos. */
  function pollPad(dt) {
    let g;
    try { g = readGamepad(); } catch (_) { return; }
    if (!g.connected) { padPrev = []; return; }
    const edge = (i) => g.down[i] && !padPrev[i];
    if (edge(PAD.BACK)) { if (board.isOpen) closeBoard(); else openBoard(); }
    if (board.isOpen) {
      if (edge(PAD.A)) board.command('ok');
      if (edge(PAD.B)) board.command('back');
      if (edge(PAD.Y)) board.command('confront');
      if (edge(PAD.RB)) board.command('zoomIn');
      if (edge(PAD.LB)) board.command('zoomOut');
      // D-pad com repetição (segurar passa de pergunta em pergunta)
      const dirs = [[PAD.LEFT, 'left'], [PAD.RIGHT, 'right'], [PAD.UP, 'up'], [PAD.DOWN, 'down']];
      let held = false;
      for (const [i, c] of dirs) {
        if (edge(/** @type {number} */ (i))) { board.command(/** @type {string} */ (c)); padRep = 0.42; }
        else if (g.down[/** @type {number} */ (i)]) {
          held = true;
          padRep -= dt;
          if (padRep <= 0) { board.command(/** @type {string} */ (c)); padRep = 0.16; }
        }
      }
      if (!held && !dirs.some(([i]) => edge(/** @type {number} */ (i)))) padRep = 0;
      const z = (g.rt > 0.2 ? g.rt : 0) - (g.lt > 0.2 ? g.lt : 0) + g.stick2.y;
      board.stick(dt, g.stick.x, g.stick.y, Math.abs(z) > 0.15 ? z : 0);
    }
    padPrev = g.down.slice();
  }

  // ---------------------------------------------------------------------------------------------- eventos
  const offs = [
    events.on('level:loaded', (/** @type {any} */ info) => {
      const on = !!(info?.story || window.__game?.game?.levelDef?.story);
      setStory(on);
      if (!on) { mural.close(); end.hidden = true; closeBoard(); subs.clear(); voice.stop(); }
    }),
    events.on('level:loading', () => { delete root.dataset.cinema; mural.close(); end.hidden = true; closeBoard(); subs.clear(); voice.stop(); }),
    events.on('game:state', (/** @type {any} */ p) => {
      gameState = p?.state || gameState;
      if (gameState !== 'playing') closeBoard();
    }),
    events.on('story:cinema', (/** @type {any} */ p) => {
      if (p.on) { root.dataset.cinema = '1'; closeBoard(); }
      else delete root.dataset.cinema;
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
      title.querySelector('.t-name').innerHTML = esc(p.title || '').replace('&amp;', '<b>&amp;</b>');
      title.querySelector('.t-chapter').textContent = p.chapter || '';
      title.classList.add('is-on');
      titleT = 3.4;
    }),
    events.on('story:prompt', (/** @type {any} */ p) => { prompt.classList.toggle('is-on', !!p.on); }),
    events.on('story:faro', () => { faroCool = 1.2; coolFaro(true); }),
    // as falas: a voz sempre; a legenda só no jogo (a das cenas é da HQ)
    events.on('story:say', (/** @type {any} */ p) => {
      if (!p || !p.text) return;
      voice.start(p.who ?? null, String(p.text), { mood: p.mood || 'normal' });
      if (p.mode === 'jogo') subs.show(p);
      else subs.clear();
    }),
    events.on('story:sayClear', () => { subs.clear(); voice.stop(); }),
    events.on('story:voice', (/** @type {any} */ p) => {
      const text = p?.text ? String(p.text) : 'a'.repeat(Math.max(0, Math.min(400, p?.chars | 0)));
      voice.start(p?.who ?? null, text, { mood: p?.mood || 'normal', ...(p?.cps ? { cps: p.cps } : {}) });
    }),
    events.on('story:voiceStop', () => voice.stop()),
    // as pistas e as perguntas
    events.on('story:clue', (/** @type {any} */ p) => {
      if (!p?.id) return;
      if (!found.includes(p.id)) found.push(p.id);
      // com o quadro aberto, a pista nova aparece nele (sem o cartão voando)
      if (board.isOpen) { syncChip(); return; }
      queue.push({ kind: 'clue', p });
    }),
    events.on('story:question', (/** @type {any} */ p) => { if (p?.text) queue.push({ kind: 'ask', p }); }),
    events.on('story:board', (/** @type {any} */ p) => {
      board.set(p);
      // o número do botão só sobe quando o cartão chega nele
      if (!ann && !queue.some((q) => q.kind === 'clue')) syncChip();
      else chip.classList.toggle('has-ready', boardSummary(board.state).ready > 0);
    }),
    events.on('story:deduceWrong', (/** @type {any} */ p) => board.wrong(p?.node)),
    // ligar e confrontar no quadro (src/story/deduction.js responde ao ui:storyLink e ao ui:storyConfront)
    events.on('story:linkWrong', (/** @type {any} */ p) => board.linkWrong(p || {})),
    events.on('story:confrontWrong', (/** @type {any} */ p) => board.confrontWrong(p || {})),
    events.on('story:insight', (/** @type {any} */ p) => board.insight(p || {})),
    events.on('story:sock', (/** @type {any} */ p) => {
      socks = p.count ?? socks + 1;
      nMeias.textContent = String(socks);
      pop(meias);
      play('meia');
    }),
    events.on('story:mural', (/** @type {any} */ p) => {
      if (p.open) { closeBoard(); mural.open({ owned: [...(p.owned || []), ...(p.clues || []).filter((id) => CLUES[id]?.case === 'C3')] }); }
    }),
    events.on('story:chapterEnd', (/** @type {any} */ p) => {
      closeBoard();
      end.querySelector('h2').textContent = `Fim do Capítulo ${p.chapter} · ${p.title}`;
      end.querySelector('p').textContent = '';
      end.querySelector('.rr-story__stats').innerHTML = [
        `<span>${ico(HUD_ICONS.quadro)}${p.clues}</span>`,
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
      if (ann) endAnn();
      reset(clueCard);
      reset(askBox);
      board.reset();
      capturePad(false);
      subs.clear();
      voice.stop();
      socks = 0;
      nPistas.textContent = '0';
      nMeias.textContent = '0';
      syncChip();
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

  chip.addEventListener('click', () => { if (board.isOpen) closeBoard(); else if (!openBoard()) pop(chip); });
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
  syncChip();

  return {
    update(dt) {
      mural.update(dt);
      if (faroCool > 0) { faroCool -= dt; if (faroCool <= 0) coolFaro(false); }
      if (titleT > 0) { titleT -= dt; if (titleT <= 0) title.classList.remove('is-on'); }
      if (story()) pollPad(dt);
      board.update(dt);
      // na pausa, a fala e os recados esperam
      if (gameState === 'paused') return;
      voice.update(dt);
      subs.update(dt);
      stepAnn(dt);
    },
    /** Para os testes de tela: o que está aberto. */
    state() {
      return {
        story: story(), cinema: root.dataset.cinema === '1', clues: found.slice(), socks, mural: mural.isOpen, end: !end.hidden,
        title: title.classList.contains('is-on'), board: board.isOpen, deducing: board.deducing, sub: subs.current,
        note: ann ? ann.kind : null,
      };
    },
    mural,
    board,
    dispose() {
      faroMeter.dispose();
      for (const off of offs) off();
      removeEventListener('keydown', onKey, true);
      capturePad(false);
      board.dispose();
      subs.dispose();
      mural.dispose();
      counters.remove();
      host.remove();
    },
  };
}
