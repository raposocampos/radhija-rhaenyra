// Legendas e vozes do Modo História.
//  - A máquina de escrever (charTimes / typedCount): ~45 caracteres/s, com uma pausinha depois da pontuação. A mesma
//    conta serve à legenda do jogo (aqui) e à camada de HQ das cenas (src/story/ui/comic.js), para o texto e a voz
//    andarem juntos.
//  - A voz (createVoice): sílabas sintetizadas por personagem enquanto o texto "digita" (sons voz-* em
//    src/fx/audio/soundsHistoria.js), baixinho, uma a cada 2–4 letras, nunca num espaço ou numa pontuação.
//  - A legenda do jogo (createSubtitles): só as falas com mode 'jogo' (as das cenas são da HQ). Uma de cada vez,
//    embaixo, entre o joystick e os botões de toque (dentro de .rr-hud__bottom, acima da dica e do aviso de agir).
// Eventos (storyHud.js liga): story:say toca a voz SEMPRE (cena e jogo) e desenha a legenda só no 'jogo';
// story:sayClear apaga a legenda e cala a voz; story:voice { who, text | chars, mood?, cps? } só toca a voz (para quem
// desenha o próprio texto); story:voiceStop cala a voz (ex.: a HQ pulou a digitação).
// A parte pura (sem DOM) fica exportada para os testes (test/historia-ui.test.mjs).

/** Caracteres por segundo da máquina de escrever. */
export const TYPE_CPS = 45;
/** Pausa extra depois de ponto, exclamação, interrogação e reticências (s) e depois de vírgula e afins. */
export const PAUSE_LONG = 0.12;
export const PAUSE_SHORT = 0.05;
/** Tempo mínimo de leitura depois de o texto terminar de digitar (s). */
export const READ_TAIL = 1.2;

/** As falas: nome (o que aparece na legenda), som da voz, de quantas em quantas letras sai uma sílaba, tom. */
export const SPEAKERS = {
  radhija: { name: 'Radhija', sound: 'voz-radhija', every: 2, pitch: 1 },
  rhaenyra: { name: 'Rhaenyra', sound: 'voz-rhaenyra', every: 3, pitch: 1 },
  capitao: { name: 'Capitão Migalha', sound: 'voz-pombo', every: 3, pitch: 0.82 },
  farelo: { name: 'Farelo', sound: 'voz-pombo', every: 3, pitch: 1.05 },
  soneca: { name: 'Soneca', sound: 'voz-pombo', every: 4, pitch: 1.18 },
  porteiro: { name: 'Seu Porteiro', sound: 'voz-porteiro', every: 4, pitch: 1 },
};
/** @typedef {'normal' | 'grito' | 'sussurro' | 'sono' | 'pensa'} Mood */

const LONG = /[.!?…]/;
const SHORT = /[,;:—–]/;
const QUIET = /[\s.,;:!?…—–"'()«»\-]/;

/**
 * Quando cada letra aparece (s, a partir do começo da fala): times[i] é o instante da letra i.
 * Uma pontuação que não é a última atrasa a letra seguinte (a "respiração").
 * @param {string} text @param {number} [cps]
 * @returns {number[]}
 */
export function charTimes(text, cps = TYPE_CPS) {
  const step = 1 / Math.max(1, cps);
  const out = [];
  let t = 0;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    out.push(t);
    t += step;
    const c = s[i];
    const next = s[i + 1];
    // reticências e "?!" seguidos: a pausa só depois do último sinal
    if (next !== undefined && !LONG.test(next) && LONG.test(c)) t += PAUSE_LONG;
    else if (next !== undefined && SHORT.test(c)) t += PAUSE_SHORT;
  }
  return out;
}

/** Quanto tempo a fala leva para digitar inteira (s). */
export function typeDuration(text, cps = TYPE_CPS) {
  const ts = charTimes(text, cps);
  return ts.length ? ts[ts.length - 1] + 1 / Math.max(1, cps) : 0;
}

/**
 * Quantas letras já apareceram no instante t (busca binária em charTimes).
 * @param {number[]} times @param {number} t
 */
export function typedCount(times, t) {
  let lo = 0, hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * As letras em que a voz faz uma sílaba: uma a cada `every` letras "faladas" (espaço e pontuação não contam e nunca
 * soam); a primeira letra sempre soa.
 * @param {string} text @param {number} [every]
 * @returns {number[]}
 */
export function voiceBeats(text, every = 2) {
  const s = String(text ?? '');
  const out = [];
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (QUIET.test(s[i])) continue;
    if (n % Math.max(1, every) === 0) out.push(i);
    n++;
  }
  return out;
}

/** Quanto tempo a legenda fica na tela: o pedido (dur) ou, se a fala for longa, a digitação mais a leitura. */
export function holdTime(text, dur, cps = TYPE_CPS) {
  return Math.max(Number(dur) || 0, typeDuration(text, cps) + READ_TAIL);
}

/** Volume e tom da voz conforme o jeito de falar. */
export function moodVoice(mood) {
  if (mood === 'grito') return { volume: 1.5, pitch: 1.08 };
  if (mood === 'sussurro') return { volume: 0.5, pitch: 1 };
  if (mood === 'sono') return { volume: 0.55, pitch: 0.86 };
  return { volume: 1, pitch: 1 };
}

/**
 * A voz: toca as sílabas no ritmo da digitação. Uma voz por vez (a fala nova corta a anterior).
 * play(name, opts) é o audio.play do jogo; opts leva volume, pitch e mood (o som usa o mood).
 * @param {{ play: (name: string, opts?: object) => void }} opts
 */
export function createVoice({ play }) {
  /** @type {{ sound: string, pitch: number, volume: number, mood: string, beats: number[], times: number[], t: number, next: number } | null} */
  let cur = null;
  return {
    /**
     * Começa a falar. who null (narração) ou sem voz: fica calada.
     * @param {string | null} who @param {string} text @param {{ mood?: Mood, cps?: number }} [o]
     */
    start(who, text, { mood = 'normal', cps = TYPE_CPS } = {}) {
      const sp = who ? SPEAKERS[who] : null;
      // narração e pensamento não têm voz
      if (!sp || !text || mood === 'pensa') { cur = null; return; }
      const mv = moodVoice(mood);
      cur = {
        sound: sp.sound, pitch: sp.pitch * mv.pitch, volume: mv.volume, mood,
        beats: voiceBeats(text, sp.every + (mood === 'sono' ? 1 : 0)), times: charTimes(text, cps), t: 0, next: 0,
      };
    },
    /** Avança o tempo e toca as sílabas que chegaram (no máximo uma por quadro: nada de rajada depois de um engasgo). */
    update(dt) {
      if (!cur) return;
      cur.t += dt;
      let fired = false;
      while (cur.next < cur.beats.length && cur.times[cur.beats[cur.next]] <= cur.t) {
        if (!fired) play(cur.sound, { volume: cur.volume, pitch: cur.pitch, mood: cur.mood, syl: cur.next });
        fired = true;
        cur.next++;
      }
      if (cur.next >= cur.beats.length) cur = null;
    },
    stop() { cur = null; },
    get speaking() { return !!cur; },
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** O HTML de uma legenda (nome + texto com a parte ainda não digitada invisível, para a caixa não mudar de tamanho). */
export function subtitleHtml({ who = null, name = '', text = '' }, typed = Infinity) {
  const s = String(text ?? '');
  const n = Math.max(0, Math.min(s.length, typed));
  const label = who ? (name || SPEAKERS[who]?.name || '') : '';
  return (label ? `<span class="rr-sub__name">${esc(label)}</span>` : '')
    + `<span class="rr-sub__text"><span class="rr-sub__on">${esc(s.slice(0, n))}</span><span class="rr-sub__off">${esc(s.slice(n))}</span></span>`;
}

/**
 * A legenda das falas do jogo (mode 'jogo'). host: onde ela entra (o .rr-hud__bottom do HUD, primeira da coluna).
 * onSkip: tocaram na legenda para pular a digitação (o HUD cala a voz).
 * @param {{ host: HTMLElement, onSkip?: () => void }} opts
 */
export function createSubtitles({ host, onSkip = () => {} }) {
  const box = document.createElement('div');
  box.className = 'rr-sub';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  host.insertBefore(box, host.firstChild);
  /** @type {{ id: number, who: string | null, name: string, text: string, times: number[], t: number, hold: number, typed: number } | null} */
  let cur = null;
  let on = null;
  let off = null;
  /** o fade de saída (s) */
  let outT = 0;

  function paint(n) {
    if (!cur || !on || !off) return;
    on.textContent = cur.text.slice(0, n);
    off.textContent = cur.text.slice(n);
  }
  /** Some com um fade curto (a legenda nova pode entrar por cima antes de acabar). */
  function hide() {
    if (cur && box.classList.contains('is-on')) { box.classList.add('is-out'); outT = 0.35; }
    cur = null;
  }
  // tocar a legenda completa a digitação (pular)
  box.addEventListener('pointerdown', () => { if (cur) { cur.t = Math.max(cur.t, cur.times[cur.times.length - 1] ?? 0); onSkip(); } });

  return {
    /** @param {{ id?: number, who?: string | null, name?: string, text: string, dur?: number, mood?: Mood }} p */
    show(p) {
      const text = String(p.text ?? '');
      cur = { id: p.id ?? 0, who: p.who ?? null, name: p.name ?? '', text, times: charTimes(text), t: 0, hold: holdTime(text, p.dur), typed: 0 };
      box.dataset.who = p.who || 'narrador';
      box.dataset.mood = p.mood || 'normal';
      box.innerHTML = subtitleHtml(cur, 0);
      on = /** @type {HTMLElement} */ (box.querySelector('.rr-sub__on'));
      off = /** @type {HTMLElement} */ (box.querySelector('.rr-sub__off'));
      // a nova entra por cima da anterior com uma transição curta (reinicia a animação)
      outT = 0;
      box.classList.remove('is-in', 'is-out');
      void box.offsetWidth;
      box.classList.add('is-on', 'is-in');
    },
    clear: hide,
    /** Pula a digitação da atual. */
    complete() { if (cur) cur.t = Math.max(cur.t, cur.times[cur.times.length - 1] ?? 0); },
    update(dt) {
      if (outT > 0 && (outT -= dt) <= 0) box.classList.remove('is-on', 'is-out', 'is-in');
      if (!cur) return;
      cur.t += dt;
      const n = typedCount(cur.times, cur.t);
      if (n !== cur.typed) { cur.typed = n; paint(n); }
      if (cur.t >= cur.hold) hide();
    },
    get current() { return cur ? { id: cur.id, who: cur.who, text: cur.text, typed: cur.typed } : null; },
    dispose() { box.remove(); },
  };
}
