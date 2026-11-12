// Botão de pular cena: segurar E (ou Espaço, Enter) no teclado, ✕ ou ○ no controle, ou o botão ⏩ da tela de toque,
// por HOLD segundos. Só conta o que foi apertado DEPOIS de a cena começar (uma tecla segurada desde antes, ou o botão
// do controle que já estava no fundo, não pula nada sem querer). O HUD mostra o anel enchendo (story:skipHold).
// O botão da tela avisa pelo barramento: ui:storySkip { on }.
import { events } from '../../core/events.js';
import { readGamepad, PAD } from '../../game/input.js';

export const SKIP_HOLD = 0.8;
const KEYS = new Set(['KeyE', 'Space', 'Enter', 'NumpadEnter']);

/** @param {{ emit?: (name: string, payload?: object) => void, hold?: number }} [opts] */
export function createSkipInput({ emit = () => {}, hold = SKIP_HOLD } = {}) {
  const S = { armed: false, keys: new Set(), padLatch: true, touch: false, t: 0, lastK: -1 };
  const onDown = (e) => {
    if (!S.armed || e.repeat || !KEYS.has(e.code)) return;
    S.keys.add(e.code);
  };
  const onUp = (e) => { S.keys.delete(e.code); };
  const onTouch = (/** @type {{ on?: boolean }} */ p = {}) => { S.touch = !!p.on && S.armed; };
  const onBlur = () => { S.keys.clear(); S.touch = false; };
  globalThis.addEventListener?.('keydown', onDown);
  globalThis.addEventListener?.('keyup', onUp);
  globalThis.addEventListener?.('blur', onBlur);
  const offTouch = events.on('ui:storySkip', onTouch);

  function padHeld() {
    const g = readGamepad();
    if (!g.connected) {
      S.padLatch = false;
      return false;
    }
    const down = g.down[PAD.A] || g.down[PAD.B];
    if (S.padLatch) {
      if (!down) S.padLatch = false; // soltou: a partir daqui, segurar conta
      return false;
    }
    return down;
  }

  return {
    /** Liga para uma cena nova: o que já estava apertado não conta até soltar. */
    arm() {
      S.armed = true;
      S.keys.clear();
      S.touch = false;
      S.padLatch = true;
      S.t = 0;
      S.lastK = -1;
    },
    disarm() {
      S.armed = false;
      S.keys.clear();
      S.touch = false;
      S.t = 0;
      if (S.lastK !== 0) emit('story:skipHold', { k: 0 });
      S.lastK = 0;
    },
    /** Um quadro: → true quando completou o tempo segurando. */
    update(dt) {
      if (!S.armed) return false;
      const held = S.keys.size > 0 || S.touch || padHeld();
      S.t = held ? S.t + dt : 0;
      const k = Math.min(1, S.t / hold);
      const q = Math.round(k * 20) / 20;
      if (q !== S.lastK) {
        S.lastK = q;
        emit('story:skipHold', { k: q });
      }
      return k >= 1;
    },
    get progress() { return Math.min(1, S.t / hold); },
    dispose() {
      globalThis.removeEventListener?.('keydown', onDown);
      globalThis.removeEventListener?.('keyup', onUp);
      globalThis.removeEventListener?.('blur', onBlur);
      offTouch?.();
    },
  };
}
