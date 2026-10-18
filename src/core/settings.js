// Opções da jogadora salvas no navegador (chave própria, como o volume e a qualidade gráfica; nas prévias, uma chave
// por PR). Valem em todas as fases.
//   noHints: modo desafio, sem dicas e guia. O HUD esconde o objetivo escrito e as dicas em balão, e o feedback
//            esconde o marcador do objetivo (a gota laranja). Os puzzles não mudam; os controles seguem na pausa.
// API: createSettings({ storage?, emit? }) → { noHints, setNoHints(on), values }. Uma mudança emite
// settings:change { noHints } no barramento.
import { events } from './events.js';
import { storageKey } from '../game/storageKey.js';

export const SETTINGS_KEY = storageKey('rr-settings-v1');

/** @typedef {{ noHints: boolean }} Settings */

/** @returns {Settings} */
export function defaultSettings() { return { noHints: false }; }

/** Valores válidos de um objeto qualquer (campos desconhecidos ou inválidos voltam ao padrão). @returns {Settings} */
export function normalizeSettings(value) {
  const s = defaultSettings();
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (typeof value.noHints === 'boolean') s.noHints = value.noHints;
  }
  return s;
}

/** Lê as opções; sem storage ou com JSON corrompido, o padrão (com dicas). */
export function loadSettings(storage = globalThis.localStorage) {
  try {
    return normalizeSettings(JSON.parse(storage?.getItem(SETTINGS_KEY) || 'null'));
  } catch (_) {
    return defaultSettings();
  }
}

/** Grava as opções; false se o storage recusar (a escolha vale só nesta aba). */
export function saveSettings(settings, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
    return true;
  } catch (_) {
    return false;
  }
}

/** @param {{ storage?: Storage | null, emit?: (name: string, data: any) => void }} [opts] */
export function createSettings({ storage = globalThis.localStorage, emit = (name, data) => events.emit(name, data) } = {}) {
  let cur = loadSettings(storage);
  return {
    /** Modo desafio: sem objetivo escrito, marcador do objetivo e dicas. */
    get noHints() { return cur.noHints; },
    setNoHints(on) {
      const next = !!on;
      if (next === cur.noHints) return;
      cur = { ...cur, noHints: next };
      saveSettings(cur, storage);
      emit('settings:change', { ...cur });
    },
    /** Cópia dos valores atuais. */
    get values() { return { ...cur }; },
  };
}
